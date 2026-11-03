import * as THREE from 'three';
import { B, BLOCKS, I, ITEMS, isBlock, getName, maxStack, atlasTexture, tileUV } from './blocks';
import { Chunk, CW, CH, SEA, Generator, meshChunk, makeChunkMaterial, ckey, isSolid, isLiquid, isOpaque, Biome, BIOME_NAMES } from './world';
import { audio } from './audio';
import { Inventory, Slot, Slots, craft, FurnaceState, newFurnace, tickFurnace, SMELT, FUEL } from './inventory';
import { Sky } from './sky';
import { Mob, MobType, MOB_SPECS, Drop, Particles, moveBody, collides, setAtlas, itemMesh, blockGeometry, WorldAccess } from './entities';
import { WorldMeta, SaveData, Settings, writeSave, saveWorldMeta, loadSave } from './storage';

export type Screen = 'none' | 'inventory' | 'crafting' | 'furnace' | 'pause' | 'dead' | 'loading';
export type Container = 'inv' | 'craft' | 'craftOut' | 'furnIn' | 'furnFuel' | 'furnOut' | 'creative';

export const ACHIEVEMENTS: Record<string, [string, string]> = {
  wood: ['Getting Wood', 'Punch a tree to collect a log'],
  table: ['Benchmarking', 'Craft a crafting table'],
  pick: ['Time to Mine!', 'Craft a wooden pickaxe'],
  stone: ['Stone Age', 'Mine cobblestone'],
  furnace: ['Hot Topic', 'Craft a furnace'],
  iron: ['Acquire Hardware', 'Smelt an iron ingot'],
  torch: ['Let There Be Light', 'Place a torch'],
  food: ['Delicious', 'Eat something cooked'],
  zombie: ['Monster Hunter', 'Defeat a zombie'],
  diamond: ['Diamonds!', 'Find a diamond'],
  dpick: ['Ultimate Tool', 'Craft a diamond pickaxe'],
  night: ['Survivor', 'Survive your first night'],
  deep: ['Spelunker', 'Reach below Y=16'],
  peak: ['Mountaineer', 'Climb above Y=100'],
};

const DAY_LEN = 720; // seconds per full day
const REACH = 5.5;
interface Toast { id: number; title: string; text: string; t: number }

export class Game implements WorldAccess {
  renderer: THREE.WebGLRenderer; scene = new THREE.Scene(); camera: THREE.PerspectiveCamera;
  viewScene = new THREE.Scene(); viewModel = new THREE.Group(); viewAmbient = new THREE.AmbientLight(0xffffff, 1);
  chunks = new Map<string, Chunk>();
  gen: Generator; mat: THREE.ShaderMaterial; waterMat: THREE.ShaderMaterial;
  sky: Sky; particles: Particles;
  hemi = new THREE.HemisphereLight(0xdde8ff, 0x55504a, 0.6); sunLight = new THREE.DirectionalLight(0xfff2dd, 0.8);
  highlight: THREE.LineSegments; crack: THREE.Mesh;

  // player
  pos = new THREE.Vector3(); vel = new THREE.Vector3(); yaw = 0; pitch = 0; hw = 0.3; h = 1.8;
  onGround = false; hitWall = false; inWater = false; headInWater = false; flying = false; sneaking = false; sprinting = false;
  health = 20; hunger = 20; sat = 5; exhaustion = 0; air = 10; fallStart = 0; hurtT = 0; regenT = 0; starveT = 0; airT = 0;
  stepDist = 0; bob = 0; swingT = 0; fovKick = 0; spawn: [number, number, number] = [0, 80, 0];
  inv = new Inventory(); sel = 0;
  cursor: Slot | null = null; craftGrid: Slots = [null, null, null, null]; craftW = 2;
  furnaces = new Map<string, FurnaceState>(); openFurnace: string | null = null;
  mobs: Mob[] = []; drops: Drop[] = [];
  edits = new Map<string, Map<number, number>>();
  waterQueue: [number, number, number, number][] = []; waterT = 0;

  time = 0.03; day = 0; rain = 0; rainTarget = 0; weatherTimer = 300; thunder = false; thunderT = 10;
  screen: Screen = 'loading'; debug = false; locked = false;
  keys = new Set<string>(); leftDown = false; rightDown = false; placeCD = 0; attackCD = 0;
  target: { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number } | null = null;
  targetMob: Mob | null = null;
  mineProgress = 0; mineKey = ''; mineSoundT = 0;
  lastSpace = 0; lastW = 0;
  toasts: Toast[] = []; toastId = 0; achievements = new Set<string>();
  stats = { mined: 0, placed: 0, kills: 0, crafted: 0, deaths: 0 };
  biome: Biome = 'plains'; fps = 0; frames = 0; fpsT = 0; loadedFrac = 0;
  lastChunk = ''; genQueue: [number, number][] = [];
  saveT = 15; spawnT = 2; ambientT = 0; emitT = 0;
  onUpdate: () => void = () => {};
  version = 0;
  private raf = 0; private last = performance.now(); private disposed = false;
  private listeners: [EventTarget, string, EventListener][] = [];

  constructor(public container: HTMLElement, public meta: WorldMeta, public settings: Settings) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = 'block';
    this.camera = new THREE.PerspectiveCamera(settings.fov, container.clientWidth / container.clientHeight, 0.05, 1000);
    this.scene.add(this.camera);
    const atlas = atlasTexture(); setAtlas(atlas);
    this.mat = makeChunkMaterial(atlas, false); this.waterMat = makeChunkMaterial(atlas, true);
    this.gen = new Generator(meta.seed);
    this.sky = new Sky(this.scene);
    this.particles = new Particles(this.scene);
    this.scene.add(this.hemi, this.sunLight, this.sunLight.target);
    this.viewScene.add(this.viewAmbient, this.viewModel);
    const dl = new THREE.DirectionalLight(0xffffff, 0.5); dl.position.set(-1, 2, 1); this.viewScene.add(dl);
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    this.highlight.visible = false; this.scene.add(this.highlight);
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ map: atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.crack.visible = false; this.scene.add(this.crack);
    audio.setVolume(settings.volume);
    this.load();
    this.bindInput();
    this.rebuildViewModel();
    this.loop();
  }

  // ------------------------------------------------------------ world access
  getChunk(x: number, z: number) { return this.chunks.get(ckey(Math.floor(x / CW), Math.floor(z / CW))); }
  getBlock(x: number, y: number, z: number) {
    if (y < 0) return B.BEDROCK; if (y >= CH) return B.AIR;
    const c = this.getChunk(x, z);
    if (!c) return y < SEA - 20 ? B.STONE : B.AIR;
    return c.data[(x - c.cx * CW) + (z - c.cz * CW) * CW + y * CW * CW];
  }
  heightAt(x: number, z: number) {
    const c = this.getChunk(x, z); if (!c) return 0;
    return c.heights[(x - c.cx * CW) + (z - c.cz * CW) * CW];
  }
  lightAt(x: number, y: number, z: number) {
    const h = this.heightAt(Math.floor(x), Math.floor(z));
    const sky = y > h ? 1 : Math.max(0.05, 0.85 - (h - y) * 0.2);
    let bl = 0;
    const cx = Math.floor(x / CW), cz = Math.floor(z / CW);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = this.chunks.get(ckey(cx + dx, cz + dz)); if (!c) continue;
      for (const li of c.lights) {
        const lx = c.cx * CW + (li % CW), lz = c.cz * CW + (Math.floor(li / CW) % CW), ly = Math.floor(li / (CW * CW));
        const d = Math.abs(lx + 0.5 - x) + Math.abs(ly + 0.5 - y) + Math.abs(lz + 0.5 - z);
        bl = Math.max(bl, 1 - d / 8.7);
      }
    }
    return Math.max(sky * this.sky.sunLevel, bl * 0.9);
  }
  private neighborhood(c: Chunk) {
    const lights: [number, number, number, number][] = [];
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const n = this.chunks.get(ckey(c.cx + dx, c.cz + dz)); if (!n) continue;
      for (const li of n.lights) lights.push([n.cx * CW + (li % CW) + 0.5, Math.floor(li / (CW * CW)) + 0.5, n.cz * CW + (Math.floor(li / CW) % CW) + 0.5, BLOCKS[n.data[li]].light ?? 14]);
    }
    return { get: (x: number, y: number, z: number) => this.getBlock(x, y, z), height: (x: number, z: number) => this.heightAt(x, z), lights };
  }
  private buildMesh(c: Chunk) {
    const { solid, water } = meshChunk(c, this.neighborhood(c));
    if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); c.mesh = null; }
    if (c.waterMesh) { this.scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); c.waterMesh = null; }
    if (solid) { c.mesh = new THREE.Mesh(solid, this.mat); c.mesh.matrixAutoUpdate = false; this.scene.add(c.mesh); }
    if (water) { c.waterMesh = new THREE.Mesh(water, this.waterMat); c.waterMesh.matrixAutoUpdate = false; c.waterMesh.renderOrder = 1; this.scene.add(c.waterMesh); }
    c.dirty = false;
  }
  private hasNeighbors(c: Chunk) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (!this.chunks.has(ckey(c.cx + dx, c.cz + dz))) return false;
    return true;
  }
  private generateChunk(cx: number, cz: number) {
    const c = new Chunk(cx, cz);
    this.gen.generate(c);
    const e = this.edits.get(ckey(cx, cz));
    if (e) {
      for (const [i, id] of e) c.data[i] = id;
      for (let z = 0; z < CW; z++) for (let x = 0; x < CW; x++) c.recomputeHeight(x, z);
      c.recomputeLights();
    }
    this.chunks.set(ckey(cx, cz), c);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = this.chunks.get(ckey(cx + dx, cz + dz)); if (n) n.dirty = true; }
  }
  private streamWorld(budgetMs: number) {
    const R = this.settings.renderDist;
    const pcx = Math.floor(this.pos.x / CW), pcz = Math.floor(this.pos.z / CW);
    const key = pcx + ',' + pcz + ',' + R;
    if (key !== this.lastChunk) {
      this.lastChunk = key;
      this.genQueue = [];
      for (let dx = -R - 1; dx <= R + 1; dx++) for (let dz = -R - 1; dz <= R + 1; dz++) {
        if (dx * dx + dz * dz > (R + 1.5) * (R + 1.5)) continue;
        if (!this.chunks.has(ckey(pcx + dx, pcz + dz))) this.genQueue.push([pcx + dx, pcz + dz]);
      }
      this.genQueue.sort((a, b) => ((b[0] - pcx) ** 2 + (b[1] - pcz) ** 2) - ((a[0] - pcx) ** 2 + (a[1] - pcz) ** 2));
      for (const [k, c] of this.chunks) {
        if ((c.cx - pcx) ** 2 + (c.cz - pcz) ** 2 > (R + 3) ** 2) {
          if (c.mesh) { this.scene.remove(c.mesh); c.mesh.geometry.dispose(); }
          if (c.waterMesh) { this.scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); }
          this.chunks.delete(k);
        }
      }
    }
    const t0 = performance.now();
    while (this.genQueue.length && performance.now() - t0 < budgetMs) {
      const [cx, cz] = this.genQueue.pop()!;
      if (!this.chunks.has(ckey(cx, cz))) this.generateChunk(cx, cz);
    }
    // mesh nearest dirty chunks
    const dirty: Chunk[] = [];
    for (const c of this.chunks.values()) if (c.dirty && (c.cx - pcx) ** 2 + (c.cz - pcz) ** 2 <= (R + 0.5) ** 2 && this.hasNeighbors(c)) dirty.push(c);
    dirty.sort((a, b) => ((a.cx - pcx) ** 2 + (a.cz - pcz) ** 2) - ((b.cx - pcx) ** 2 + (b.cz - pcz) ** 2));
    for (const c of dirty) { if (performance.now() - t0 > budgetMs * 1.6) break; this.buildMesh(c); }
    let total = 0, ready = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) { total++; const c = this.chunks.get(ckey(pcx + dx, pcz + dz)); if (c && !c.dirty) ready++; }
    this.loadedFrac = ready / total;
  }

  setBlock(x: number, y: number, z: number, id: number, sideEffects = true) {
    if (y < 0 || y >= CH) return;
    const c = this.getChunk(x, z); if (!c) return;
    const lx = x - c.cx * CW, lz = z - c.cz * CW, i = lx + lz * CW + y * CW * CW;
    const old = c.data[i];
    if (old === id) return;
    c.data[i] = id;
    let e = this.edits.get(ckey(c.cx, c.cz)); if (!e) { e = new Map(); this.edits.set(ckey(c.cx, c.cz), e); }
    e.set(i, id);
    c.recomputeHeight(lx, lz);
    const lightChange = (BLOCKS[old].light ?? 0) > 0 || (BLOCKS[id].light ?? 0) > 0;
    if (lightChange) c.recomputeLights();
    c.dirty = true;
    const ring = lightChange ? 1 : 0;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const near = ring || ((dx === 0 || (dx < 0 ? lx === 0 : lx === CW - 1)) && (dz === 0 || (dz < 0 ? lz === 0 : lz === CW - 1)));
      if (near) { const n = this.chunks.get(ckey(c.cx + dx, c.cz + dz)); if (n) n.dirty = true; }
    }
    // remesh immediately for responsiveness
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const n = this.chunks.get(ckey(c.cx + dx, c.cz + dz)); if (n && n.dirty && this.hasNeighbors(n)) this.buildMesh(n); }
    if (!sideEffects) return;
    if (id === B.AIR) {
      // gravity blocks above
      const above = this.getBlock(x, y + 1, z);
      if (above === B.SAND || above === B.GRAVEL) { this.setBlock(x, y + 1, z, B.AIR); let ny = y; while (ny > 0 && this.getBlock(x, ny - 1, z) === B.AIR) ny--; this.setBlock(x, ny, z, above); }
      // plants/torches lose support
      const ab = this.getBlock(x, y + 1, z);
      if (BLOCKS[ab].cross) { this.setBlock(x, y + 1, z, B.AIR); if (this.meta.mode === 'survival') this.dropBlockItems(ab, x, y + 1, z, 99); }
      // water inflow
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) if (isLiquid(this.getBlock(x + dx, y + dy, z + dz))) { this.waterQueue.push([x, y, z, dy ? 0 : 1]); break; }
    } else if (id === B.SAND || id === B.GRAVEL) {
      if (this.getBlock(x, y - 1, z) === B.AIR || isLiquid(this.getBlock(x, y - 1, z))) { this.setBlock(x, y, z, B.AIR, false); let ny = y; while (ny > 0 && !isSolid(this.getBlock(x, ny - 1, z))) ny--; this.setBlock(x, ny, z, id); }
    }
  }
  private tickWater() {
    const q = this.waterQueue; this.waterQueue = [];
    for (const [x, y, z, d] of q.slice(0, 200)) {
      const cur = this.getBlock(x, y, z);
      if (cur !== B.AIR && !BLOCKS[cur].cross) continue;
      this.setBlock(x, y, z, B.WATER, false);
      const below = this.getBlock(x, y - 1, z);
      if (below === B.AIR || BLOCKS[below].cross) this.waterQueue.push([x, y - 1, z, d]);
      else if (d < 4 && !isLiquid(below)) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = this.getBlock(x + dx, y, z + dz); if (n === B.AIR || BLOCKS[n].cross) this.waterQueue.push([x + dx, y, z + dz, d + 1]); }
    }
  }

  // ------------------------------------------------------------ persistence
  private findSpawn(): [number, number, number] {
    for (let r = 0; r < 400; r += 8) for (let a = 0; a < 12; a++) {
      const x = Math.round(Math.cos(a * 0.52) * r), z = Math.round(Math.sin(a * 0.52) * r);
      const h = this.gen.height(x, z); const b = this.gen.biome(x, z, h);
      if (h > SEA + 1 && b !== 'ocean' && b !== 'mountains' && b !== 'beach') return [x + 0.5, h + 1, z + 0.5];
    }
    return [0.5, 90, 0.5];
  }
  private load() {
    const s = loadSave(this.meta.id);
    if (s) {
      const p = s.player;
      this.pos.set(p.x, p.y, p.z); this.yaw = p.yaw; this.pitch = p.pitch; this.health = p.health; this.hunger = p.hunger; this.sat = p.sat; this.flying = p.flying;
      this.inv.slots = s.inv; this.sel = s.sel; this.time = s.time; this.day = s.day ?? 0;
      this.rain = s.weather.rain; this.rainTarget = s.weather.target; this.weatherTimer = s.weather.timer; this.thunder = s.weather.thunder;
      for (const [k, arr] of Object.entries(s.edits)) { const m = new Map<number, number>(); for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]); this.edits.set(k, m); }
      for (const [k, f] of Object.entries(s.furnaces || {})) this.furnaces.set(k, f);
      s.achievements.forEach((a) => this.achievements.add(a));
      this.spawn = s.spawn; this.stats = { ...this.stats, ...s.stats };
    } else {
      this.spawn = this.findSpawn();
      this.pos.set(...this.spawn);
      if (this.meta.mode === 'creative') { [B.GRASS, B.STONE, B.PLANKS, B.LOG, B.GLASS, B.BRICKS, B.TORCH, B.GLOWSTONE, B.STONE_BRICKS].forEach((b) => this.inv.add(b, 64)); this.flying = false; }
    }
  }
  save() {
    if (this.screen === 'loading') return;
    const edits: Record<string, number[]> = {};
    for (const [k, m] of this.edits) { const a: number[] = []; m.forEach((v, i) => a.push(i, v)); edits[k] = a; }
    const d: SaveData = {
      v: 1, player: { x: this.pos.x, y: this.pos.y, z: this.pos.z, yaw: this.yaw, pitch: this.pitch, health: this.health, hunger: this.hunger, sat: this.sat, flying: this.flying },
      inv: this.inv.slots, sel: this.sel, time: this.time, day: this.day,
      weather: { rain: this.rain, target: this.rainTarget, timer: this.weatherTimer, thunder: this.thunder },
      edits, furnaces: Object.fromEntries(this.furnaces), achievements: [...this.achievements], spawn: this.spawn, stats: this.stats,
    };
    const ok = writeSave(this.meta.id, d);
    this.meta.played = Date.now(); saveWorldMeta(this.meta);
    if (!ok) this.toast('Save failed', 'Browser storage is full');
  }

  // ------------------------------------------------------------ input
  private on(t: EventTarget, ev: string, fn: EventListener) { t.addEventListener(ev, fn); this.listeners.push([t, ev, fn]); }
  private bindInput() {
    const cv = this.renderer.domElement;
    this.on(window, 'resize', () => {
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight; this.camera.updateProjectionMatrix();
    });
    this.on(cv, 'mousedown', ((e: MouseEvent) => {
      audio.init();
      if (!this.locked) { if (this.screen === 'none') this.lock(); return; }
      if (e.button === 0) { this.leftDown = true; this.attackOrStart(); }
      if (e.button === 2) { this.rightDown = true; this.placeCD = 0; }
    }) as EventListener);
    this.on(window, 'mouseup', ((e: MouseEvent) => { if (e.button === 0) { this.leftDown = false; this.mineProgress = 0; } if (e.button === 2) this.rightDown = false; }) as EventListener);
    this.on(cv, 'contextmenu', (e) => e.preventDefault());
    this.on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === cv;
      if (!this.locked) { this.keys.clear(); this.leftDown = this.rightDown = false; if (this.screen === 'none') this.setScreen('pause'); }
    });
    this.on(document, 'mousemove', ((e: MouseEvent) => {
      if (!this.locked) return;
      const s = 0.0022 * this.settings.sens;
      this.yaw -= e.movementX * s; this.pitch -= e.movementY * s;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    }) as EventListener);
    this.on(window, 'wheel', ((e: WheelEvent) => { if (!this.locked) return; this.selectSlot((this.sel + (e.deltaY > 0 ? 1 : -1) + 9) % 9); }) as EventListener);
    this.on(window, 'keydown', ((e: KeyboardEvent) => {
      if (e.code === 'F3') { e.preventDefault(); this.debug = !this.debug; this.emit(); return; }
      if (e.code === 'Tab') e.preventDefault();
      if (this.screen === 'dead' || this.screen === 'loading') return;
      if (e.code === 'KeyE') {
        if (this.screen === 'none') { this.openInventory(); return; }
        if (['inventory', 'crafting', 'furnace'].includes(this.screen)) { this.closeScreen(); return; }
      }
      if (e.code === 'Escape' && ['inventory', 'crafting', 'furnace'].includes(this.screen)) { this.closeScreen(); return; }
      if (!this.locked) return;
      if (e.repeat && (e.code === 'Space' || e.code === 'KeyW')) { this.keys.add(e.code); return; }
      this.keys.add(e.code);
      if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) this.selectSlot(n - 1); }
      if (e.code === 'Space') {
        const now = performance.now();
        if (this.meta.mode === 'creative' && now - this.lastSpace < 300) { this.flying = !this.flying; this.vel.y = 0; this.toast(this.flying ? 'Flying' : 'Walking', '', 1.2); }
        this.lastSpace = now;
      }
      if (e.code === 'KeyW') { const now = performance.now(); if (now - this.lastW < 280) this.sprinting = true; this.lastW = now; }
      if (e.code === 'KeyQ') this.dropHeld(e.ctrlKey);
    }) as EventListener);
    this.on(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.code); if (e.code === 'KeyW') this.sprinting = false; }) as EventListener);
    this.on(window, 'blur', () => this.keys.clear());
    this.on(window, 'beforeunload', () => this.save());
  }
  lock() {
    const cv = this.renderer.domElement;
    try { const p = cv.requestPointerLock() as unknown as Promise<void> | undefined; if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }
  setScreen(s: Screen) { this.screen = s; this.emit(); }
  resume() { audio.init(); this.screen = 'none'; this.lock(); this.emit(); }
  selectSlot(i: number) { this.sel = i; this.rebuildViewModel(); this.emit(); }
  openInventory() { this.craftW = 2; this.craftGrid = [null, null, null, null]; this.unlockTo('inventory'); }
  private unlockTo(s: Screen) { this.screen = s; if (document.pointerLockElement) document.exitPointerLock(); this.keys.clear(); this.emit(); }
  closeScreen() {
    for (const s of this.craftGrid) if (s) this.giveOrDrop(s);
    this.craftGrid = new Array(this.craftW * this.craftW).fill(null);
    if (this.cursor) { this.giveOrDrop(this.cursor); this.cursor = null; }
    this.openFurnace = null;
    this.screen = 'none'; this.lock(); this.rebuildViewModel(); this.emit();
  }
  private giveOrDrop(s: Slot) {
    const left = this.inv.add(s.id, s.count, s.dur);
    if (left > 0) this.spawnDrop(s.id, left, this.eye(), this.lookDir().multiplyScalar(4), s.dur);
  }

  // ------------------------------------------------------------ inventory clicks
  craftResult(): [number, number] | null { return craft(this.craftGrid, this.craftW); }
  getSlot(c: Container, i: number): Slot | null {
    if (c === 'inv') return this.inv.slots[i];
    if (c === 'craft') return this.craftGrid[i];
    const f = this.openFurnace ? this.furnaces.get(this.openFurnace) : null;
    if (!f) return null;
    return c === 'furnIn' ? f.input : c === 'furnFuel' ? f.fuel : c === 'furnOut' ? f.output : null;
  }
  private setSlot(c: Container, i: number, s: Slot | null) {
    if (s && s.count <= 0) s = null;
    if (c === 'inv') this.inv.slots[i] = s;
    else if (c === 'craft') this.craftGrid[i] = s;
    else { const f = this.furnaces.get(this.openFurnace!); if (!f) return; if (c === 'furnIn') f.input = s; else if (c === 'furnFuel') f.fuel = s; else if (c === 'furnOut') f.output = s; }
  }
  clickSlot(c: Container, i: number, right: boolean, shift: boolean) {
    audio.click();
    if (c === 'creative') {
      const ms = maxStack(i);
      const tool = ITEMS[i]?.tool;
      if (shift) this.inv.add(i, ms); else this.cursor = { id: i, count: right ? 1 : ms, dur: tool?.durability };
      this.emit(); return;
    }
    if (c === 'craftOut') {
      const r = this.craftResult(); if (!r) return;
      const doCraft = () => {
        const tool = ITEMS[r[0]]?.tool;
        for (let k = 0; k < this.craftGrid.length; k++) { const s = this.craftGrid[k]; if (s) { s.count--; if (s.count <= 0) this.craftGrid[k] = null; } }
        this.stats.crafted++; this.onCrafted(r[0]);
        return { id: r[0], count: r[1], dur: tool?.durability } as Slot;
      };
      if (shift) {
        let guard = 0;
        while (guard++ < 64) { const rr = this.craftResult(); if (!rr || rr[0] !== r[0]) break; const s = doCraft(); const left = this.inv.add(s.id, s.count, s.dur); if (left) { this.spawnDrop(s.id, left, this.eye()); break; } }
      } else {
        if (this.cursor && (this.cursor.id !== r[0] || this.cursor.count + r[1] > maxStack(r[0]))) return;
        const s = doCraft();
        if (this.cursor) this.cursor.count += s.count; else this.cursor = s;
      }
      audio.craft(); this.emit(); return;
    }
    const slot = this.getSlot(c, i);
    if (c === 'furnOut') {
      if (!slot) return;
      if (shift) { const left = this.inv.add(slot.id, slot.count); this.setSlot(c, i, left ? { ...slot, count: left } : null); }
      else if (!this.cursor) { this.cursor = slot; this.setSlot(c, i, null); }
      else if (this.cursor.id === slot.id && this.cursor.count + slot.count <= maxStack(slot.id)) { this.cursor.count += slot.count; this.setSlot(c, i, null); }
      if (slot.id === I.IRON_INGOT) this.achieve('iron');
      this.emit(); return;
    }
    if (shift && slot) {
      if (c === 'inv') {
        // move between hotbar & main or into furnace
        if (this.screen === 'furnace') {
          const f = this.furnaces.get(this.openFurnace!)!;
          const target: Container = SMELT[slot.id] !== undefined && (!f.input || f.input.id === slot.id) ? 'furnIn' : FUEL[slot.id] && (!f.fuel || f.fuel.id === slot.id) ? 'furnFuel' : 'inv';
          if (target !== 'inv') {
            const t = this.getSlot(target, 0); const room = maxStack(slot.id) - (t?.count ?? 0); const n = Math.min(room, slot.count);
            this.setSlot(target, 0, { id: slot.id, count: (t?.count ?? 0) + n }); slot.count -= n; this.setSlot(c, i, slot);
            this.emit(); return;
          }
        }
        const [a, b] = i < 9 ? [9, 36] : [0, 9];
        let count = slot.count;
        for (let k = a; k < b && count > 0; k++) { const s = this.inv.slots[k]; if (s && s.id === slot.id && s.count < maxStack(s.id)) { const n = Math.min(maxStack(s.id) - s.count, count); s.count += n; count -= n; } }
        for (let k = a; k < b && count > 0; k++) if (!this.inv.slots[k]) { this.inv.slots[k] = { ...slot, count }; count = 0; }
        this.setSlot(c, i, count ? { ...slot, count } : null);
      } else { const left = this.inv.add(slot.id, slot.count, slot.dur); this.setSlot(c, i, left ? { ...slot, count: left } : null); }
      this.rebuildViewModel(); this.emit(); return;
    }
    const cur = this.cursor;
    if (!cur) {
      if (!slot) return;
      if (right) { const half = Math.ceil(slot.count / 2); this.cursor = { ...slot, count: half }; this.setSlot(c, i, { ...slot, count: slot.count - half }); }
      else { this.cursor = slot; this.setSlot(c, i, null); }
    } else if (!slot) {
      if (right) { this.setSlot(c, i, { ...cur, count: 1 }); cur.count--; if (cur.count <= 0) this.cursor = null; }
      else { this.setSlot(c, i, cur); this.cursor = null; }
    } else if (slot.id === cur.id && maxStack(cur.id) > 1) {
      const ms = maxStack(cur.id);
      if (right) { if (slot.count < ms) { slot.count++; cur.count--; if (cur.count <= 0) this.cursor = null; } }
      else { const n = Math.min(ms - slot.count, cur.count); slot.count += n; cur.count -= n; if (cur.count <= 0) this.cursor = null; }
    } else { this.setSlot(c, i, cur); this.cursor = slot; }
    this.rebuildViewModel(); this.emit();
  }
  private onCrafted(id: number) {
    if (id === B.CRAFTING_TABLE) this.achieve('table');
    if (id === I.WOOD_PICK) this.achieve('pick');
    if (id === B.FURNACE) this.achieve('furnace');
    if (id === I.DIAMOND_PICK) this.achieve('dpick');
  }
  sortInventory() {
    const main = this.inv.slots.slice(9).filter(Boolean) as Slot[];
    const merged: Slot[] = [];
    for (const s of main.sort((a, b) => a.id - b.id)) {
      const last = merged[merged.length - 1];
      if (last && last.id === s.id && maxStack(s.id) > 1 && last.count < maxStack(s.id)) { const n = Math.min(maxStack(s.id) - last.count, s.count); last.count += n; if (s.count - n > 0) merged.push({ ...s, count: s.count - n }); }
      else merged.push({ ...s });
    }
    for (let i = 9; i < 36; i++) this.inv.slots[i] = merged[i - 9] ?? null;
    audio.click(); this.emit();
  }

  // ------------------------------------------------------------ helpers
  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.sneaking ? 1.47 : 1.62), this.pos.z); }
  lookDir() { return new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  held() { return this.inv.slots[this.sel]; }
  toast(title: string, text: string, dur = 4) { this.toasts.push({ id: ++this.toastId, title, text, t: dur }); this.emit(); }
  achieve(k: string) {
    if (this.achievements.has(k)) return;
    this.achievements.add(k); audio.levelUp();
    this.toast('Advancement Made!', ACHIEVEMENTS[k][0], 5);
  }
  emit() { this.version++; this.onUpdate(); }
  spawnDrop(id: number, count: number, p: THREE.Vector3, v?: THREE.Vector3, dur?: number) {
    const d = new Drop(id, count, p, v, dur); this.drops.push(d); this.scene.add(d.mesh);
  }
  dropHeld(all: boolean) {
    const s = this.held(); if (!s) return;
    const n = all ? s.count : 1;
    this.spawnDrop(s.id, n, this.eye().add(this.lookDir().multiplyScalar(0.4)).add(new THREE.Vector3(0, -0.3, 0)), this.lookDir().multiplyScalar(5).add(new THREE.Vector3(0, 1.5, 0)), s.dur);
    const d = this.drops[this.drops.length - 1]; d.age = -1;
    this.inv.take(this.sel, n); this.rebuildViewModel(); this.emit();
  }

  raycast(maxD: number) {
    const o = this.eye(), d = this.lookDir();
    let x = Math.floor(o.x), y = Math.floor(o.y), z = Math.floor(o.z);
    const sx = Math.sign(d.x), sy = Math.sign(d.y), sz = Math.sign(d.z);
    const tdx = Math.abs(1 / d.x), tdy = Math.abs(1 / d.y), tdz = Math.abs(1 / d.z);
    let tx = (sx > 0 ? x + 1 - o.x : o.x - x) * tdx, ty = (sy > 0 ? y + 1 - o.y : o.y - y) * tdy, tz = (sz > 0 ? z + 1 - o.z : o.z - z) * tdz;
    let nx = 0, ny = 0, nz = 0, t = 0;
    while (t <= maxD) {
      const id = this.getBlock(x, y, z);
      if (id !== B.AIR && !isLiquid(id)) return { x, y, z, nx, ny, nz, id, t };
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (ty < tz) { y += sy; t = ty; ty += tdy; nx = 0; ny = -sy; nz = 0; }
      else { z += sz; t = tz; tz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }
  private raycastMob(maxD: number) {
    const o = this.eye(), d = this.lookDir();
    let best: Mob | null = null, bt = maxD;
    for (const m of this.mobs) {
      if (m.dead) continue;
      const mn = [m.pos.x - m.hw, m.pos.y, m.pos.z - m.hw], mx = [m.pos.x + m.hw, m.pos.y + m.h, m.pos.z + m.hw];
      const oo = [o.x, o.y, o.z], dd = [d.x, d.y, d.z];
      let t0 = 0, t1 = bt, ok = true;
      for (let a = 0; a < 3 && ok; a++) {
        const inv = 1 / dd[a]; let ta = (mn[a] - oo[a]) * inv, tb = (mx[a] - oo[a]) * inv;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 > t1) ok = false;
      }
      if (ok && t0 < bt) { bt = t0; best = m; }
    }
    return best ? { mob: best, t: bt } : null;
  }

  // ------------------------------------------------------------ actions
  private attackOrStart() {
    if (this.targetMob && this.attackCD <= 0) {
      const tool = ITEMS[this.held()?.id ?? 0]?.tool;
      const dmg = tool ? tool.damage : 1;
      this.damageMob(this.targetMob, dmg * (this.vel.y < -1 ? 1.5 : 1), this.lookDir());
      this.attackCD = 0.35; this.swingT = 1; this.useTool(1);
      this.exhaustion += 0.1;
    } else this.swingT = 1;
  }
  damageMob(m: Mob, dmg: number, dir: THREE.Vector3) {
    m.hp -= dmg; m.hurtT = 0.3; m.fleeT = 4;
    m.vel.x += dir.x * 7; m.vel.z += dir.z * 7; m.vel.y = 5;
    audio.hit();
    if (m.type === 'pig') audio.pig(); else if (m.type === 'cow') audio.cow(); else if (m.type === 'sheep') audio.sheep(); else audio.zombie();
    if (m.hp <= 0 && !m.dead) {
      m.dead = true; this.stats.kills++;
      if (m.type === 'zombie') this.achieve('zombie');
      if (this.meta.mode === 'survival') for (const [id, n] of MOB_SPECS[m.type].drops()) if (n > 0) this.spawnDrop(id, n, m.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
    }
  }
  private breakTime(id: number) {
    const def = BLOCKS[id];
    if (def.hardness < 0) return Infinity;
    if (this.meta.mode === 'creative') return 0;
    const tool = ITEMS[this.held()?.id ?? 0]?.tool;
    let t = def.hardness * 1.5;
    const right = tool && def.tool === tool.type;
    if (right) t /= tool!.speed;
    if (def.tier && (!right || tool!.tier < def.tier)) t *= 3.3;
    if (this.inWater && !this.onGround) t *= 3;
    return Math.max(0.05, t);
  }
  private canHarvest(id: number) {
    const def = BLOCKS[id]; if (!def.tier) return true;
    const tool = ITEMS[this.held()?.id ?? 0]?.tool;
    return !!tool && tool.type === def.tool && tool.tier >= def.tier;
  }
  private useTool(amount: number) {
    const s = this.held(); if (!s || this.meta.mode === 'creative') return;
    const tool = ITEMS[s.id]?.tool; if (!tool) return;
    s.dur = (s.dur ?? tool.durability) - amount;
    if (s.dur <= 0) { this.inv.slots[this.sel] = null; audio.breakBlock('wood'); this.toast('Tool broke!', getName(s.id), 2); this.rebuildViewModel(); }
  }
  private dropBlockItems(id: number, x: number, y: number, z: number, rnd: number) {
    const def = BLOCKS[id];
    const res = def.drop ? def.drop(rnd) : [id, 1] as [number, number];
    if (res && res[1] > 0) this.spawnDrop(res[0], res[1], new THREE.Vector3(x + 0.5, y + 0.4, z + 0.5));
  }
  private breakBlock(t: { x: number; y: number; z: number; id: number }) {
    const { x, y, z, id } = t;
    const def = BLOCKS[id];
    const light = Math.max(0.3, this.lightAt(x + 0.5, y + 1, z + 0.5));
    this.particles.blockBurst(id, x, y, z, 26, light);
    audio.breakBlock(def.sound);
    this.setBlock(x, y, z, B.AIR);
    this.stats.mined++;
    if (this.meta.mode === 'survival') {
      if (this.canHarvest(id)) this.dropBlockItems(id, x, y, z, Math.random());
      this.useTool(1); this.exhaustion += 0.025;
      if (id === B.LOG || id === B.BIRCH_LOG || id === B.PINE_LOG) this.achieve('wood');
      if (id === B.STONE && this.canHarvest(id)) this.achieve('stone');
      if (id === B.DIAMOND_ORE && this.canHarvest(id)) this.achieve('diamond');
    }
    const fk = `${x},${y},${z}`;
    const f = this.furnaces.get(fk);
    if (f) { for (const s of [f.input, f.fuel, f.output]) if (s) this.spawnDrop(s.id, s.count, new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)); this.furnaces.delete(fk); }
    this.emit();
  }
  private use() {
    const s = this.held();
    const t = this.target;
    // interact with blocks
    if (t && !this.sneaking) {
      if (t.id === B.CRAFTING_TABLE) { this.craftW = 3; this.craftGrid = new Array(9).fill(null); this.unlockTo('crafting'); return; }
      if (t.id === B.FURNACE) {
        const k = `${t.x},${t.y},${t.z}`; if (!this.furnaces.has(k)) this.furnaces.set(k, newFurnace());
        this.openFurnace = k; this.unlockTo('furnace'); return;
      }
    }
    if (!s) return;
    const food = ITEMS[s.id]?.food;
    if (food) {
      if (this.hunger >= 20 && this.meta.mode === 'survival') return;
      this.hunger = Math.min(20, this.hunger + food); this.sat = Math.min(this.hunger, this.sat + food * 0.6);
      audio.eat(); setTimeout(() => audio.burp(), 450); this.swingT = 1;
      if ([I.COOKED_PORK, I.STEAK, I.COOKED_MUTTON, I.BREAD].includes(s.id as never)) this.achieve('food');
      if (this.meta.mode === 'survival') this.inv.take(this.sel, 1);
      this.particles.emit(this.eye().x + this.lookDir().x * 0.5, this.eye().y - 0.2, this.eye().z + this.lookDir().z * 0.5, this.particles.tileColors(ITEMS[s.id].tile), 8, 1.5, 0.06, 10, 0.6, 1);
      this.placeCD = 0.6; this.rebuildViewModel(); this.emit(); return;
    }
    if (!isBlock(s.id) || !t) return;
    const def = BLOCKS[s.id];
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    if (BLOCKS[t.id].cross && t.id !== B.TORCH) { px = t.x; py = t.y; pz = t.z; }
    const existing = this.getBlock(px, py, pz);
    if (existing !== B.AIR && !isLiquid(existing) && !BLOCKS[existing].cross) return;
    if (py < 0 || py >= CH) return;
    if (def.cross) {
      const below = this.getBlock(px, py - 1, pz);
      if (s.id === B.TORCH) { if (!isSolid(below) && !(t.ny === 0 && isSolid(t.id))) return; }
      else if (![B.GRASS, B.DIRT, B.SNOW_GRASS, B.SAND].includes(below as never)) return;
    } else {
      const box = (p: THREE.Vector3, hw: number, h: number) => px + 1 > p.x - hw && px < p.x + hw && py + 1 > p.y && py < p.y + h && pz + 1 > p.z - hw && pz < p.z + hw;
      if (box(this.pos, this.hw, this.h)) return;
      if (this.mobs.some((m) => !m.dead && box(m.pos, m.hw, m.h))) return;
    }
    this.setBlock(px, py, pz, s.id);
    if (s.id === B.FURNACE) this.furnaces.set(`${px},${py},${pz}`, newFurnace());
    audio.place(def.sound); this.swingT = 1; this.stats.placed++;
    if (s.id === B.TORCH) this.achieve('torch');
    if (this.meta.mode === 'survival') { this.inv.take(this.sel, 1); this.rebuildViewModel(); }
    this.placeCD = 0.22; this.emit();
  }
  respawn() {
    this.health = 20; this.hunger = 20; this.sat = 5; this.air = 10; this.vel.set(0, 0, 0);
    this.pos.set(...this.spawn);
    // ensure not inside blocks: climb up
    this.screen = 'none'; this.lock(); this.emit();
  }
  damage(n: number, src = '') {
    if (this.meta.mode === 'creative' || this.health <= 0 || n <= 0) return;
    this.health = Math.max(0, this.health - n); this.hurtT = 0.4; audio.hurt();
    if (this.health <= 0) {
      this.stats.deaths++; this.deathMsg = src;
      this.unlockTo('dead');
    }
    this.emit();
  }
  deathMsg = '';

  // ------------------------------------------------------------ view model
  rebuildViewModel() {
    this.viewModel.clear();
    const s = this.held();
    if (!s) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.42), new THREE.MeshLambertMaterial({ color: '#d8a07a' }));
      arm.position.set(0.48, -0.44, -0.9); arm.rotation.set(0.5, -0.25, 0.1);
      this.viewModel.add(arm); return;
    }
    const isB = isBlock(s.id) && !BLOCKS[s.id].cross;
    const m = itemMesh(s.id, isB ? 0.32 : 0.55);
    m.material = new THREE.MeshLambertMaterial({ map: atlasTexture(), alphaTest: 0.5, side: THREE.DoubleSide });
    if (isB) { m.position.set(0.42, -0.38, -0.65); m.rotation.set(0.15, 0.7, 0); }
    else { m.position.set(0.42, -0.3, -0.6); m.rotation.set(0, -1.2, 0.3); }
    this.viewModel.add(m);
  }

  // ------------------------------------------------------------ main loop
  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = (now - this.last) / 1000; this.last = now;
    dt = Math.min(dt, 0.05);
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    this.streamWorld(this.screen === 'loading' ? 30 : 6);
    if (this.screen === 'loading') {
      if (this.loadedFrac >= 1) {
        // settle spawn position onto ground
        let guard = 0;
        while (collides(this, this.pos, this.hw, this.h) && guard++ < 200) this.pos.y += 1;
        this.screen = 'pause';
        this.emit();
      }
      this.emitT -= dt; if (this.emitT <= 0) { this.emitT = 0.1; this.emit(); }
      this.render(dt);
      return;
    }
    const paused = this.screen === 'pause' || this.screen === 'dead';
    if (!paused) this.update(dt);
    this.render(paused ? 0 : dt);
  };

  private update(dt: number) {
    const creative = this.meta.mode === 'creative';
    // ---- time & weather
    const prevTime = this.time;
    this.time = (this.time + dt / DAY_LEN) % 1;
    if (prevTime > this.time) { this.day++; if (this.meta.mode === 'survival') this.achieve('night'); }
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const raining = this.rainTarget > 0;
      this.rainTarget = raining ? 0 : 0.6 + Math.random() * 0.4;
      this.thunder = !raining && Math.random() < 0.35;
      this.weatherTimer = raining ? 300 + Math.random() * 600 : 120 + Math.random() * 240;
    }
    this.rain += Math.sign(this.rainTarget - this.rain) * Math.min(Math.abs(this.rainTarget - this.rain), dt * 0.08);
    if (this.thunder && this.rain > 0.5) {
      this.thunderT -= dt;
      if (this.thunderT <= 0) { this.thunderT = 8 + Math.random() * 25; this.sky.flash = 0.35; setTimeout(() => audio.thunder(), 300 + Math.random() * 1500); }
    }

    // ---- player movement
    const k = this.keys;
    const inUI = this.screen !== 'none';
    const fwd = inUI ? 0 : (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const str = inUI ? 0 : (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    this.sneaking = !inUI && (k.has('ShiftLeft') || k.has('ShiftRight')) && !this.flying;
    if (k.has('ControlLeft') && fwd > 0) this.sprinting = true;
    if (fwd <= 0 || this.sneaking || (this.hunger <= 6 && !creative)) this.sprinting = false;
    const speed = this.flying ? (this.sprinting ? 22 : 11) : this.sneaking ? 1.3 : this.sprinting ? 5.6 : 4.3;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    let mx = -sin * fwd + cos * str, mz = -cos * fwd - sin * str;
    const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
    const wantX = mx * speed * (this.inWater && !this.flying ? 0.55 : 1), wantZ = mz * speed * (this.inWater && !this.flying ? 0.55 : 1);
    const accel = this.onGround || this.flying ? 14 : this.inWater ? 6 : 3.5;
    this.vel.x += (wantX - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (wantZ - this.vel.z) * Math.min(1, accel * dt);
    const jump = !inUI && k.has('Space');
    if (this.flying) {
      const vy = (jump ? 1 : 0) - (!inUI && (k.has('ShiftLeft') || k.has('ShiftRight')) ? 1 : 0);
      this.vel.y += (vy * 9 - this.vel.y) * Math.min(1, 12 * dt);
    } else if (this.inWater) {
      this.vel.y -= 9 * dt; this.vel.y *= Math.pow(0.15, dt);
      if (jump) this.vel.y = Math.min(this.vel.y + 22 * dt, 3.2);
      if (jump && this.hitWall) this.vel.y = 4;
    } else {
      this.vel.y -= 28 * dt; this.vel.y = Math.max(this.vel.y, -50);
      if (jump && this.onGround) { this.vel.y = 8.6; this.exhaustion += this.sprinting ? 0.2 : 0.05; if (this.sprinting) { this.vel.x += mx * 1.5; this.vel.z += mz * 1.5; } }
    }
    const wasGround = this.onGround, wasWater = this.inWater;
    const prevY = this.pos.y;
    moveBody(this, this as never, dt, this.sneaking);
    // auto-jump
    if (this.settings.autoJump && this.hitWall && wasGround && ml > 0 && !this.flying && !this.sneaking) {
      const fx = Math.floor(this.pos.x + mx * 0.6), fz = Math.floor(this.pos.z + mz * 0.6), fy = Math.floor(this.pos.y + 0.01);
      if (isSolid(this.getBlock(fx, fy, fz)) && !isSolid(this.getBlock(fx, fy + 1, fz)) && !isSolid(this.getBlock(fx, fy + 2, fz)) && !isSolid(this.getBlock(Math.floor(this.pos.x), fy + 2, Math.floor(this.pos.z)))) this.vel.y = 8.6;
    }
    if (this.flying && this.onGround && creative && this.vel.y < 0) this.flying = false;
    // fall damage
    if (!wasGround && this.onGround) {
      const fall = this.fallStart - this.pos.y;
      if (fall > 3.5 && !this.inWater && !creative) this.damage(Math.floor(fall - 3), 'fell from a high place');
      if (fall > 1) { const b = this.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.1), Math.floor(this.pos.z)); audio.step(BLOCKS[b]?.sound ?? 'stone'); }
    }
    if (this.onGround || this.inWater || this.flying) this.fallStart = this.pos.y;
    else if (this.pos.y > this.fallStart) this.fallStart = this.pos.y;
    if (!wasWater && this.inWater && prevY - this.pos.y > 0.05) { audio.splash(); this.particles.emit(this.pos.x, this.pos.y + 0.5, this.pos.z, [new THREE.Color('#9cc0ff'), new THREE.Color('#ffffff')], 20, 3, 0.07, 10, 0.7, this.sky.sunLevel); }
    if (this.pos.y < -30) { this.damage(100, 'fell out of the world'); this.pos.y = 100; }
    // footsteps & head bob
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 0.5) {
      this.stepDist += hs * dt; this.bob += hs * dt * 2.2;
      if (this.stepDist > (this.sprinting ? 2.1 : 1.7)) { this.stepDist = 0; const b = this.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.1), Math.floor(this.pos.z)); audio.step(BLOCKS[b]?.sound ?? 'stone'); }
      this.exhaustion += hs * dt * (this.sprinting ? 0.02 : 0.004);
    } else if (this.inWater && hs > 0.5) { this.stepDist += hs * dt; if (this.stepDist > 2.5) { this.stepDist = 0; audio.swim(); } }
    const eyeB = this.getBlock(Math.floor(this.pos.x), Math.floor(this.eye().y), Math.floor(this.pos.z));
    this.headInWater = isLiquid(eyeB);
    if (this.pos.y < 16) this.achieve('deep');
    if (this.pos.y > 100) this.achieve('peak');

    // ---- survival stats
    if (!creative) {
      if (this.exhaustion >= 4) { this.exhaustion -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else this.hunger = Math.max(0, this.hunger - 1); this.emit(); }
      this.exhaustion += dt * 0.012;
      this.regenT += dt;
      if (this.hunger >= 18 && this.health < 20 && this.regenT > 3) { this.regenT = 0; this.health = Math.min(20, this.health + 1); this.exhaustion += 1.5; this.emit(); }
      if (this.hunger <= 0) { this.starveT += dt; if (this.starveT > 4) { this.starveT = 0; if (this.health > 1) this.damage(1, 'starved'); } }
      if (this.headInWater) { this.airT += dt; if (this.airT > 1.5) { this.airT = 0; if (this.air > 0) this.air--; else this.damage(2, 'drowned'); this.emit(); } }
      else if (this.air < 10) { this.airT += dt; if (this.airT > 0.3) { this.airT = 0; this.air++; this.emit(); } }
      const feet = this.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z));
      const touchCactus = [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]].some(([dx, dz]) => this.getBlock(Math.floor(this.pos.x + dx), Math.floor(this.pos.y + 0.5), Math.floor(this.pos.z + dz)) === B.CACTUS) || feet === B.CACTUS;
      if (touchCactus && this.hurtT <= 0) this.damage(1, 'was pricked to death');
    }
    this.hurtT -= dt;

    // ---- targeting & interaction
    this.attackCD -= dt; this.placeCD -= dt;
    const reach = creative ? 8 : REACH;
    const hit = inUI ? null : this.raycast(reach);
    const mh = inUI ? null : this.raycastMob(reach - 1.5);
    this.targetMob = mh && (!hit || mh.t < hit.t) ? mh.mob : null;
    this.target = this.targetMob ? null : hit;
    if (this.target) {
      const t = this.target;
      this.highlight.visible = true;
      const cross = BLOCKS[t.id].cross;
      this.highlight.position.set(t.x + 0.5, t.y + (cross ? 0.4 : 0.5), t.z + 0.5);
      this.highlight.scale.set(cross ? 0.6 : 1, cross ? 0.8 : 1, cross ? 0.6 : 1);
    } else this.highlight.visible = false;
    if (this.leftDown && !inUI) {
      if (this.targetMob) { if (this.attackCD <= 0) this.attackOrStart(); this.mineProgress = 0; }
      else if (this.target) {
        const t = this.target;
        const key = `${t.x},${t.y},${t.z}`;
        if (key !== this.mineKey) { this.mineKey = key; this.mineProgress = 0; }
        const bt = this.breakTime(t.id);
        if (bt === 0) { if (this.attackCD <= 0) { this.breakBlock(t); this.attackCD = 0.2; } }
        else if (bt !== Infinity) {
          this.mineProgress += dt / bt; this.swingT = Math.max(this.swingT, 0.6);
          this.mineSoundT -= dt;
          if (this.mineSoundT <= 0) { this.mineSoundT = 0.22; audio.dig(BLOCKS[t.id].sound); this.particles.blockBurst(t.id, t.x + t.nx * 0.55, t.y + t.ny * 0.55, t.z + t.nz * 0.55, 3, Math.max(0.3, this.lightAt(t.x + t.nx + 0.5, t.y + t.ny + 0.5, t.z + t.nz + 0.5))); }
          if (this.mineProgress >= 1) { this.breakBlock(t); this.mineProgress = 0; this.mineKey = ''; }
        }
      }
    } else this.mineProgress = 0;
    if (this.mineProgress > 0 && this.target) {
      const stage = Math.min(7, Math.floor(this.mineProgress * 8));
      this.crack.visible = true; this.crack.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
      const uv = tileUV('crack_' + stage); const a = this.crack.geometry.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) a.setXY(i, i % 2 === 0 ? uv[0] : uv[2], i % 4 < 2 ? uv[3] : uv[1]);
      a.needsUpdate = true;
    } else this.crack.visible = false;
    if (this.rightDown && this.placeCD <= 0 && !inUI) { this.use(); if (this.placeCD <= 0) this.placeCD = 0.25; }

    // ---- furnaces
    for (const f of this.furnaces.values()) if (tickFurnace(f, dt) && this.screen === 'furnace') this.emit();
    if (this.screen === 'furnace') { this.emitT -= dt; }

    // ---- water flow
    this.waterT -= dt; if (this.waterT <= 0) { this.waterT = 0.25; if (this.waterQueue.length) this.tickWater(); }

    // ---- entities
    this.updateMobs(dt);
    this.updateDrops(dt);
    this.particles.update(dt, this);
    // ambient particles: torch flames
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = 0.15;
      const pcx = Math.floor(this.pos.x / CW), pcz = Math.floor(this.pos.z / CW);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        const c = this.chunks.get(ckey(pcx + dx, pcz + dz)); if (!c) continue;
        for (const li of c.lights) if (c.data[li] === B.TORCH && Math.random() < 0.4) {
          const x = c.cx * CW + (li % CW) + 0.5, z = c.cz * CW + (Math.floor(li / CW) % CW) + 0.5, y = Math.floor(li / (CW * CW)) + 0.75;
          this.particles.emit(x, y, z, [new THREE.Color('#ffb040'), new THREE.Color('#ff7020'), new THREE.Color('#444')], 1, 0.15, 0.05, -1.5, 0.6, 1.2);
        }
      }
    }
    // ---- biome & ambience
    this.biome = this.gen.biome(Math.floor(this.pos.x), Math.floor(this.pos.z), this.gen.height(Math.floor(this.pos.x), Math.floor(this.pos.z)));
    const exposed = this.eye().y > this.heightAt(Math.floor(this.pos.x), Math.floor(this.pos.z));
    audio.setAmbient(exposed ? this.rain : this.rain * 0.3, exposed ? (this.pos.y > 80 ? 1 : 0.35) : 0.1);
    if (this.settings.music) audio.tickMusic(dt, this.sky.sunLevel < 0.4);

    // ---- periodic
    this.saveT -= dt; if (this.saveT <= 0) { this.saveT = 20; this.save(); }
    this.toasts.forEach((t) => (t.t -= dt));
    if (this.toasts.some((t) => t.t <= 0)) { this.toasts = this.toasts.filter((t) => t.t > 0); this.emit(); }
    this.emitT -= dt; if (this.emitT <= 0) { this.emitT = 0.2; this.emit(); }
  }

  private updateMobs(dt: number) {
    const sun = this.sky.sunLevel;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 1.5;
      const passive = this.mobs.filter((m) => !MOB_SPECS[m.type].hostile).length;
      const hostile = this.mobs.length - passive;
      const night = sun < 0.35 || (this.thunder && this.rain > 0.6);
      const wantHostile = night && hostile < 7 && this.meta.mode === 'survival';
      if (passive < 10 || wantHostile) {
        const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 20;
        const x = Math.floor(this.pos.x + Math.cos(a) * r), z = Math.floor(this.pos.z + Math.sin(a) * r);
        const c = this.getChunk(x, z);
        if (c && !c.dirty) {
          const h = this.heightAt(x, z); const top = this.getBlock(x, h, z);
          const free = !isSolid(this.getBlock(x, h + 1, z)) && !isSolid(this.getBlock(x, h + 2, z)) && !isLiquid(this.getBlock(x, h + 1, z));
          if (free) {
            let type: MobType | null = null;
            if (wantHostile && (Math.random() < 0.6 || passive >= 10)) type = 'zombie';
            else if (passive < 10 && (top === B.GRASS || top === B.SNOW_GRASS)) type = (['pig', 'cow', 'sheep'] as MobType[])[Math.floor(Math.random() * 3)];
            if (type) {
              const n = type === 'zombie' ? 1 : 2 + Math.floor(Math.random() * 2);
              for (let i = 0; i < n; i++) { const m = new Mob(type, x + 0.5 + (i % 2) * 0.8, h + 1, z + 0.5 + Math.floor(i / 2) * 0.8); this.mobs.push(m); this.scene.add(m.group); }
            }
          }
        }
      }
    }
    const pp = this.pos;
    for (const m of this.mobs) {
      const spec = MOB_SPECS[m.type];
      if (m.dead) { m.deathT += dt; if (m.deathT > 0.7) { this.particles.emit(m.pos.x, m.pos.y + 0.5, m.pos.z, [new THREE.Color('#ddd'), new THREE.Color('#aaa')], 14, 1.5, 0.15, -1, 0.8, sun); } m.updateVisual(dt, sun); continue; }
      m.hurtT -= dt; m.fleeT -= dt; m.attackCD -= dt; m.wanderT -= dt; m.soundT -= dt;
      const dx = pp.x - m.pos.x, dz = pp.z - m.pos.z, dist = Math.hypot(dx, dz);
      let speed = 0;
      if (spec.hostile && dist < 24 && this.meta.mode === 'survival' && this.health > 0) {
        m.targetYaw = Math.atan2(dx, dz); speed = spec.speed * (dist < 2 ? 0.4 : 1);
        if (dist < 1.3 && Math.abs(pp.y - m.pos.y) < 1.8 && m.attackCD <= 0) {
          m.attackCD = 1; this.damage(3, 'was slain by a Zombie');
          this.vel.x += (dx / dist) * 6; this.vel.z += (dz / dist) * 6; this.vel.y = 4.5;
        }
      } else if (m.fleeT > 0) {
        m.targetYaw = Math.atan2(-dx, -dz); speed = spec.speed * 1.8;
      } else {
        if (m.wanderT <= 0) { m.wanderT = 2 + Math.random() * 5; m.moving = Math.random() < 0.55; m.targetYaw = Math.random() * Math.PI * 2; }
        speed = m.moving ? spec.speed * 0.6 : 0;
      }
      if (m.soundT <= 0 && dist < 16) { m.soundT = 8 + Math.random() * 15; if (m.type === 'pig') audio.pig(); else if (m.type === 'cow') audio.cow(); else if (m.type === 'sheep') audio.sheep(); else audio.zombie(); }
      const fx = Math.sin(m.yaw), fz = Math.cos(m.yaw);
      // avoid walking off cliffs / into water when wandering
      if (speed > 0 && !spec.hostile && m.fleeT <= 0) {
        const ax = Math.floor(m.pos.x + fx * 0.8), az = Math.floor(m.pos.z + fz * 0.8), ay = Math.floor(m.pos.y);
        if (!isSolid(this.getBlock(ax, ay - 1, az)) && !isSolid(this.getBlock(ax, ay - 2, az))) { speed = 0; m.wanderT = 0; }
        if (isLiquid(this.getBlock(ax, ay, az))) { speed = 0; m.wanderT = 0; }
      }
      const kb = m.hurtT > 0 ? 0.2 : 1;
      m.vel.x += (fx * speed - m.vel.x) * Math.min(1, 8 * dt * kb);
      m.vel.z += (fz * speed - m.vel.z) * Math.min(1, 8 * dt * kb);
      if (m.inWater) { m.vel.y += 14 * dt; m.vel.y = Math.min(m.vel.y, 2); m.vel.y -= 9 * dt; }
      else m.vel.y -= 28 * dt;
      moveBody(this, m, dt);
      if (m.hitWall && m.onGround && speed > 0) m.vel.y = 8;
      // sunburn
      if (spec.hostile && sun > 0.6 && !(this.rain > 0.3) && m.pos.y + 1 > this.heightAt(Math.floor(m.pos.x), Math.floor(m.pos.z))) {
        m.burnT += dt;
        if (Math.random() < 0.3) this.particles.emit(m.pos.x, m.pos.y + 1, m.pos.z, [new THREE.Color('#ff8a20'), new THREE.Color('#ffd040')], 1, 0.6, 0.08, -2, 0.5, 1.3);
        if (m.burnT > 1) { m.burnT = 0; m.hp -= 2; m.hurtT = 0.2; if (m.hp <= 0) m.dead = true; }
      }
      if (m.pos.y < -20) m.dead = true;
      m.updateVisual(dt, sun);
    }
    // remove dead / far
    this.mobs = this.mobs.filter((m) => {
      const far = m.pos.distanceTo(pp) > 80 || !this.getChunk(Math.floor(m.pos.x), Math.floor(m.pos.z));
      const gone = (m.dead && m.deathT > 0.75) || far;
      if (gone) this.scene.remove(m.group);
      return !gone;
    });
  }
  private updateDrops(dt: number) {
    const eye = this.pos.clone().add(new THREE.Vector3(0, 0.8, 0));
    for (const d of this.drops) {
      d.age += dt;
      const dist = d.pos.distanceTo(eye);
      if (d.age > 0.6 && dist < 2.2 && this.health > 0) {
        const pull = eye.clone().sub(d.pos).normalize().multiplyScalar(12);
        d.vel.lerp(pull, Math.min(1, dt * 10));
        d.pos.addScaledVector(d.vel, dt);
        if (dist < 0.7) {
          const left = this.inv.add(d.id, d.count, d.dur);
          if (left < d.count) { audio.pickup(); if (isBlock(d.id) && [B.LOG, B.BIRCH_LOG, B.PINE_LOG].includes(d.id as never)) this.achieve('wood'); if (d.id === I.DIAMOND) this.achieve('diamond'); this.rebuildViewModel(); this.emit(); }
          d.count = left;
        }
      } else {
        if (d.inWater) { d.vel.y += (1.5 - d.vel.y) * dt * 3; d.vel.x *= 0.95; d.vel.z *= 0.95; }
        else d.vel.y -= 20 * dt;
        if (d.onGround) { d.vel.x *= Math.pow(0.02, dt); d.vel.z *= Math.pow(0.02, dt); }
        moveBody(this, d, dt);
      }
      // merge nearby same drops occasionally
      d.mesh.position.set(d.pos.x, d.pos.y + 0.15 + Math.sin(d.age * 3) * 0.06, d.pos.z);
      d.mesh.rotation.y = d.age * 1.8;
    }
    this.drops = this.drops.filter((d) => {
      const gone = d.count <= 0 || d.age > 300 || d.pos.y < -20;
      if (gone) this.scene.remove(d.mesh);
      return !gone;
    });
  }

  private render(dt: number) {
    const eye = this.eye();
    const t = performance.now() / 1000;
    // camera with bob/fov
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const bobAmt = this.onGround && !this.flying ? Math.min(1, hs / 4) : 0;
    this.camera.position.set(eye.x, eye.y + Math.abs(Math.sin(this.bob * Math.PI)) * 0.06 * bobAmt, eye.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.bob * Math.PI) * 0.004 * bobAmt + (this.hurtT > 0 ? this.hurtT * 0.08 : 0));
    const targetFov = this.settings.fov + (this.sprinting ? 10 : 0) + (this.flying && this.sprinting ? 5 : 0);
    this.fovKick += (targetFov - this.fovKick) * Math.min(1, dt * 8 || 1);
    if (Math.abs(this.camera.fov - this.fovKick) > 0.05) { this.camera.fov = this.fovKick; this.camera.updateProjectionMatrix(); }

    const snowy = this.biome === 'snowy' || (this.biome === 'mountains' && this.pos.y > SEA + 40);
    const dry = this.biome === 'desert';
    this.sky.update(this.time, this.camera.position, dry ? 0 : this.rain, dt, (x, z) => this.heightAt(x, z), snowy, this.headInWater);
    const sun = this.sky.sunLevel;
    // chunk shader uniforms
    const R = this.settings.renderDist * CW;
    for (const m of [this.mat, this.waterMat]) {
      const u = m.uniforms;
      u.uSun.value = sun; u.uTime.value = t;
      u.uFogColor.value.copy(this.sky.horizon);
      const tint = new THREE.Color(1, 1, 1).lerp(new THREE.Color('#ffc89a'), Math.max(0, 1 - Math.abs(this.sky.sunDir.y) * 4) * 0.5).lerp(new THREE.Color('#8fa6ff'), Math.max(0, -this.sky.sunDir.y * 2) * 0.6);
      u.uSkyTint.value.copy(tint);
      if (this.headInWater) { u.uFogNear.value = 1; u.uFogFar.value = 22; }
      else { const rf = 1 - this.rain * 0.4; u.uFogNear.value = R * 0.5 * rf; u.uFogFar.value = R * 0.95 * rf; }
      const h = this.held();
      const hl = h && isBlock(h.id) ? BLOCKS[h.id].light ?? 0 : 0;
      u.uHeld.value.set(eye.x, eye.y, eye.z, hl ? 1 : 0);
    }
    this.hemi.intensity = 0.25 + sun * 0.75; this.sunLight.intensity = sun * 0.7;
    this.sunLight.position.copy(this.pos).addScaledVector(this.sky.sunDir, 50); this.sunLight.target.position.copy(this.pos);
    this.renderer.setClearColor(this.sky.horizon);
    // view model
    this.swingT = Math.max(0, this.swingT - dt * 4);
    const sw = Math.sin(this.swingT * Math.PI);
    this.viewModel.position.set(-sw * 0.15 + Math.sin(this.bob * Math.PI) * 0.02 * bobAmt, -sw * 0.12 - Math.abs(Math.cos(this.bob * Math.PI)) * 0.025 * bobAmt, -sw * 0.15);
    this.viewModel.rotation.set(-sw * 0.8, sw * 0.3, 0);
    const vl = this.lightAt(eye.x, eye.y, eye.z);
    const hh = this.held(); const hl2 = hh && isBlock(hh.id) && (BLOCKS[hh.id].light ?? 0) > 0;
    this.viewAmbient.intensity = hl2 ? 1.3 : 0.25 + vl * 1.1;
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.screen !== 'loading') {
      this.renderer.clearDepth();
      const vc = this.camera.clone(); vc.position.set(0, 0, 0); vc.rotation.set(0, 0, 0); vc.fov = 70; vc.updateProjectionMatrix();
      this.renderer.render(this.viewScene, vc);
    }
  }

  dispose() {
    this.save();
    this.disposed = true; cancelAnimationFrame(this.raf);
    for (const [t, e, f] of this.listeners) t.removeEventListener(e, f);
    if (document.pointerLockElement) document.exitPointerLock();
    for (const c of this.chunks.values()) { c.mesh?.geometry.dispose(); c.waterMesh?.geometry.dispose(); }
    this.renderer.dispose();
    this.renderer.domElement.remove();
    audio.setAmbient(0, 0);
  }
  biomeName() { return BIOME_NAMES[this.biome]; }
  timeLabel() { const h = (this.time * 24 + 6) % 24; return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; }
  isOpaqueAt(x: number, y: number, z: number) { return isOpaque(this.getBlock(x, y, z)); }
}
export { blockGeometry };
