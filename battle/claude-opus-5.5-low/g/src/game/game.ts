import * as THREE from 'three';
import { World, CS, H, SEA, BIOME, BIOME_NAMES, ckey } from './world';
import { B, I, BLOCKS, ITEMS, buildAtlas, setIconAtlas, TILE_COLORS, FACE_TILES, TILE_INDEX, ATLAS_TILES, SOLID, RENDER, isBlockItem, matchRecipe, SMELT } from './blocks';
import { Audio } from './audio';
import { Drop, Particles, Mob, PrimedTNT, moveBody, itemObject, type MobKind } from './entities';
import { type Slots, type Stack, addItem, clickSlot, newStack, maxStack, type FurnaceState, newFurnace, clone } from './inventory';
import { type WorldMeta, type Settings, saveMeta, saveWorldData, loadWorldData } from './storage';

THREE.ColorManagement.enabled = false;

export type Screen = 'none' | 'inventory' | 'table' | 'furnace' | 'pause' | 'dead' | 'loading';
export type Container = 'inv' | 'craft' | 'out' | 'fIn' | 'fFuel' | 'fOut' | 'creative';

export const ACHIEVEMENTS: Record<string, { name: string; desc: string }> = {
  wood: { name: 'Getting Wood', desc: 'Punch a tree to collect a log' },
  table: { name: 'Benchmarking', desc: 'Craft a crafting table' },
  pick: { name: 'Time to Mine!', desc: 'Craft a pickaxe' },
  stone: { name: 'Stone Age', desc: 'Mine cobblestone' },
  furnace: { name: 'Hot Topic', desc: 'Build a furnace' },
  iron: { name: 'Acquire Hardware', desc: 'Smelt an iron ingot' },
  diamond: { name: 'Diamonds!', desc: 'Find a diamond' },
  zombie: { name: 'Monster Hunter', desc: 'Defeat a zombie' },
  cook: { name: 'Delicious Fish... Pork', desc: 'Cook some meat' },
  torch: { name: 'Let There Be Light', desc: 'Craft torches' },
  night: { name: 'Survivor', desc: 'Survive a full night' },
  boom: { name: 'Demolition', desc: 'Detonate TNT' },
};

export interface UIState {
  screen: Screen; health: number; hunger: number; air: number; inWater: boolean;
  inv: Slots; selected: number; cursor: Stack | null; craft: Slots; craftSize: number; craftOut: Stack | null;
  furnace: FurnaceState | null; mode: 'survival' | 'creative';
  debug: boolean; debugText: string; hurt: number; toast: { title: string; desc: string; t: number } | null;
  message: string; loading: number; underwater: boolean; heldName: string; heldNameT: number;
  stats: { mined: number; placed: number; killed: number; days: number; deaths: number }; achievements: string[];
  locked: boolean; time: string; flying: boolean; saveStatus: string;
}

interface SaveData {
  player: { pos: number[]; yaw: number; pitch: number; health: number; hunger: number; spawn: number[]; flying: boolean };
  inv: Slots; selected: number; time: number; day: number; rain: number;
  edits: Record<string, number[]>; furnaces: Record<string, FurnaceState>; achievements: string[];
  stats: UIState['stats'];
}

const DAY_LENGTH = 600; // seconds per full cycle
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  handScene = new THREE.Scene();
  handCamera = new THREE.PerspectiveCamera(70, 1, 0.01, 10);
  world: World;
  audio = new Audio();
  atlasTex: THREE.CanvasTexture;
  atlasMat: THREE.MeshBasicMaterial;
  particles = new Particles();
  // player
  pos = new THREE.Vector3(); vel = new THREE.Vector3(); yaw = 0; pitch = 0; onGround = false;
  body = { pos: this.pos, vel: this.vel, w: 0.6, h: 1.8, onGround: false };
  health = 20; hunger = 20; air = 10; exhaustion = 0; regenTimer = 0; starveTimer = 0; airTimer = 0; cactusTimer = 0;
  fallStart = 0; inWater = false; headInWater = false; flying = false; sprinting = false; sneaking = false;
  spawn = new THREE.Vector3(); walkDist = 0; stepDist = 0; bob = 0; hurtTime = 0; shake = 0; lastSpace = 0; lastW = 0;
  // inventory
  inv: Slots = new Array(36).fill(null); selected = 0; cursor: Stack | null = null;
  craft: Slots = new Array(9).fill(null); craftSize = 2;
  furnaces = new Map<string, FurnaceState>(); openFurnace: string | null = null;
  // world state
  time = 0.02; day = 0; rain = 0; rainTarget = 0; weatherTimer = 120; lightning = 0;
  mobs: Mob[] = []; drops: Drop[] = []; tnts: PrimedTNT[] = [];
  spawnTimer = 0; waterQueue: { x: number; y: number; z: number; t: number }[] = [];
  // interaction
  keys = new Set<string>(); mouseL = false; mouseR = false; placeCd = 0; attackCd = 0; eatCd = 0;
  breakKey = ''; breakProgress = 0; digSoundT = 0; swing = 0;
  highlight: THREE.LineSegments; crackMesh: THREE.Mesh; crackStage = -1;
  hand = new THREE.Group(); handItemId = -1; handObj: THREE.Object3D | null = null; handMat: THREE.MeshBasicMaterial;
  // sky
  sky!: THREE.Mesh; sun!: THREE.Mesh; moon!: THREE.Mesh; stars!: THREE.Points; clouds!: THREE.Mesh; skyGroup = new THREE.Group();
  rainLines!: THREE.LineSegments; rainPos!: Float32Array; rainFloor!: Float32Array; snowMode = false;
  // meta
  screen: Screen = 'loading'; debug = false; achievements = new Set<string>();
  stats = { mined: 0, placed: 0, killed: 0, days: 0, deaths: 0 };
  toast: UIState['toast'] = null; message = ''; messageT = 0; heldNameT = 0; saveStatus = '';
  biome = 0; fps = 60; frames = 0; fpsT = 0; uiT = 0; saveT = 0; loadT = 0; nightStart = -1;
  running = true; spawnFixed = false; raf = 0; last = performance.now(); locked = false;
  listeners = new Set<() => void>(); uiState!: UIState;
  canvas: HTMLCanvasElement;

  constructor(public container: HTMLElement, public meta: WorldMeta, public settings: Settings) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    container.appendChild(this.canvas);
    this.camera = new THREE.PerspectiveCamera(settings.fov, 1, 0.08, 1000);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0xffffff, 50, 100);

    const atlasCanvas = buildAtlas();
    setIconAtlas(atlasCanvas);
    this.atlasTex = new THREE.CanvasTexture(atlasCanvas);
    this.atlasTex.magFilter = THREE.NearestFilter; this.atlasTex.minFilter = THREE.NearestFilter; this.atlasTex.generateMipmaps = false;
    this.atlasMat = new THREE.MeshBasicMaterial({ map: this.atlasTex, alphaTest: 0.5 });
    this.handMat = this.atlasMat.clone();

    this.world = new World(meta.seed, this.atlasTex);
    this.world.onBlockChange = (x, y, z, id, old) => this.onBlockChange(x, y, z, id, old);
    this.scene.add(this.world.group);
    this.scene.add(this.particles.points);

    // selection outline + crack overlay
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ map: this.atlasTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    this.buildSky();
    this.buildRain();
    this.handScene.add(this.hand);
    this.handScene.add(this.handCamera);

    this.load();
    this.bindEvents();
    this.resize();
    this.emit(true);
    this.loop();
  }

  // ================= Setup =================
  buildSky() {
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(500, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, glow: { value: new THREE.Color() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; uniform vec3 glow; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = h > 0.0 ? mix(horizon, top, pow(h, 0.55)) : horizon * (1.0 + h * 0.6);
        float s = max(dot(normalize(vDir), sunDir), 0.0); c += glow * (pow(s, 6.0) * 0.6 + pow(s, 64.0) * 0.6) * (1.0 - clamp(abs(h)*1.5, 0.0, 1.0));
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    this.sky.renderOrder = -10;
    const disc = (inner: string, outer: string, moon = false) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const c = cv.getContext('2d')!;
      const g = c.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
      c.fillStyle = inner; c.fillRect(20, 20, 24, 24);
      if (moon) { c.fillStyle = '#b8bccc'; c.fillRect(24, 26, 5, 5); c.fillRect(34, 34, 6, 4); c.fillRect(30, 22, 3, 3); }
      const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter;
      return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
    };
    this.sun = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), disc('#fffbe0', 'rgba(255,230,150,0.55)'));
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), disc('#e8ecf8', 'rgba(180,200,255,0.25)', true));
    const sp = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(450);
      sp.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, fog: false, depthWrite: false }));
    // clouds
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d')!;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const n = Math.sin(x * 0.35 + Math.sin(y * 0.2) * 2) + Math.cos(y * 0.3 + Math.sin(x * 0.15) * 3) + Math.sin((x + y) * 0.13);
      if (n > 0.9 + Math.random() * 0.1) { c.fillStyle = '#fff'; c.fillRect(x, y, 1, 1); }
    }
    const ct = new THREE.CanvasTexture(cv); ct.magFilter = THREE.NearestFilter; ct.minFilter = THREE.NearestFilter;
    ct.wrapS = ct.wrapT = THREE.RepeatWrapping;
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { map: { value: ct }, offset: { value: new THREE.Vector2() }, color: { value: new THREE.Color(1, 1, 1) }, opacity: { value: 0.85 } },
      vertexShader: 'varying vec2 vUv; varying vec2 vP; void main(){ vUv = uv; vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform sampler2D map; uniform vec2 offset; uniform vec3 color; uniform float opacity; varying vec2 vUv; varying vec2 vP;
        void main(){ float a = texture2D(map, vUv * 6.0 + offset).r; float fade = 1.0 - smoothstep(250.0, 580.0, length(vP));
        if (a * fade < 0.02) discard; gl_FragColor = vec4(color, a * opacity * fade); }`,
    }));
    this.clouds.rotation.x = -Math.PI / 2;
    this.skyGroup.add(this.sky, this.stars, this.sun, this.moon);
    this.scene.add(this.skyGroup, this.clouds);
  }

  buildRain() {
    const N = 1600;
    this.rainPos = new Float32Array(N * 6);
    this.rainFloor = new Float32Array(N);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x9fb4d8, transparent: true, opacity: 0.5 }));
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.scene.add(this.rainLines);
  }

  // ================= Persistence =================
  load() {
    const data = loadWorldData<SaveData>(this.meta.id);
    if (data) {
      for (const k in data.edits) {
        const arr = data.edits[k], m = new Map<number, number>();
        for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
        this.world.edits.set(+k, m);
      }
      const p = data.player;
      this.pos.set(p.pos[0], p.pos[1], p.pos[2]); this.yaw = p.yaw; this.pitch = p.pitch;
      this.health = p.health; this.hunger = p.hunger; this.spawn.set(p.spawn[0], p.spawn[1], p.spawn[2]); this.flying = p.flying && this.meta.mode === 'creative';
      this.inv = data.inv; this.selected = data.selected; this.time = data.time; this.day = data.day; this.rain = this.rainTarget = data.rain;
      for (const k in data.furnaces) this.furnaces.set(k, data.furnaces[k]);
      data.achievements.forEach(a => this.achievements.add(a));
      this.stats = { ...this.stats, ...data.stats };
    } else {
      // find a land spawn point
      let found = false;
      for (let r = 0; r < 2000 && !found; r += 24) {
        for (let a = 0; a < 8 && !found; a++) {
          const x = Math.round(Math.cos(a * Math.PI / 4) * r), z = Math.round(Math.sin(a * Math.PI / 4) * r);
          const col = this.world.gen.column(x, z);
          if (col.biome !== BIOME.OCEAN && col.biome !== BIOME.BEACH && col.h > SEA + 1 && col.h < 75) { this.spawn.set(x + 0.5, col.h + 1.5, z + 0.5); found = true; }
        }
      }
      if (!found) this.spawn.set(0.5, 80, 0.5);
      this.pos.copy(this.spawn);
      if (this.meta.mode === 'creative') {
        [B.GRASS, B.STONEBRICK, B.PLANKS, B.GLASS, B.LOG, B.TORCH, B.LAMP, B.TNT, I.DIAMOND_PICK].forEach((id, i) => (this.inv[i] = newStack(id, maxStack(id))));
      }
    }
  }

  save() {
    const edits: Record<string, number[]> = {};
    for (const [k, m] of this.world.edits) { const arr: number[] = []; for (const [i, id] of m) arr.push(i, id); edits[k] = arr; }
    // return crafting items to inventory before saving
    const data: SaveData = {
      player: { pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, pitch: this.pitch, health: this.health, hunger: this.hunger, spawn: [this.spawn.x, this.spawn.y, this.spawn.z], flying: this.flying },
      inv: this.inv, selected: this.selected, time: this.time, day: this.day, rain: this.rainTarget,
      edits, furnaces: Object.fromEntries(this.furnaces), achievements: [...this.achievements], stats: this.stats,
    };
    const ok = saveWorldData(this.meta.id, data);
    this.meta.lastPlayed = Date.now(); this.meta.days = this.day;
    saveMeta(this.meta);
    this.saveStatus = ok ? 'World saved' : 'Save failed (storage full)';
    this.emit(true);
    return ok;
  }

  // ================= Events =================
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'F3') { e.preventDefault(); this.debug = !this.debug; this.emit(true); return; }
    if (this.screen === 'loading' || this.screen === 'dead') return;
    if (e.code === 'KeyE' && !e.repeat) {
      if (this.screen === 'none') this.openScreen('inventory');
      else if (this.screen !== 'pause') this.closeScreen();
      return;
    }
    if (e.code === 'Escape' && this.screen !== 'none' && this.screen !== 'pause') { this.closeScreen(); return; }
    if (this.screen !== 'none') return;
    this.keys.add(e.code);
    if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) this.selectSlot(n - 1); }
    if (e.code === 'Space' && !e.repeat) {
      const now = performance.now();
      if (this.meta.mode === 'creative' && now - this.lastSpace < 300) { this.flying = !this.flying; this.vel.y = 0; this.flash(this.flying ? 'Flying enabled' : 'Flying disabled'); }
      this.lastSpace = now;
    }
    if (e.code === 'KeyW' && !e.repeat) { const now = performance.now(); if (now - this.lastW < 280) this.sprinting = true; this.lastW = now; }
    if (e.code === 'KeyQ') this.dropSelected(e.ctrlKey);
    if (e.code === 'KeyF' && this.meta.mode === 'creative') { this.flying = !this.flying; this.vel.y = 0; }
    if (['Space', 'Tab', 'ControlLeft'].includes(e.code)) e.preventDefault();
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); if (e.code === 'KeyW') this.sprinting = false; };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked || this.screen !== 'none') return;
    const s = 0.0022 * this.settings.sensitivity;
    this.yaw -= e.movementX * s;
    this.pitch = clamp(this.pitch - e.movementY * s, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (this.screen !== 'none') return;
    if (!this.locked) { this.requestLock(); return; }
    if (e.button === 0) { this.mouseL = true; this.tryAttack(); }
    if (e.button === 2) { this.mouseR = true; this.placeCd = 0; this.useItem(); }
    if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
  };
  private onMouseUp = (e: MouseEvent) => { if (e.button === 0) { this.mouseL = false; this.breakProgress = 0; } if (e.button === 2) this.mouseR = false; };
  private onWheel = (e: WheelEvent) => { if (this.screen === 'none' && this.locked) this.selectSlot((this.selected + (e.deltaY > 0 ? 1 : 8)) % 9); };
  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    if (!this.locked) { this.keys.clear(); this.mouseL = this.mouseR = false; if (this.screen === 'none') this.openScreen('pause'); }
    this.emit(true);
  };
  private onResize = () => this.resize();
  private onBlur = () => { this.keys.clear(); };
  private onContext = (e: Event) => e.preventDefault();

  bindEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    document.addEventListener('pointerlockchange', this.onLockChange);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('contextmenu', this.onContext);
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.screen !== 'loading') this.save();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlur);
    if (document.pointerLockElement) document.exitPointerLock();
    this.audio.ctx?.close();
    this.renderer.dispose();
    this.canvas.remove();
  }

  requestLock() {
    this.audio.init();
    try { const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined; p?.catch?.(() => {}); } catch { /* ignore */ }
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.handCamera.aspect = w / h; this.handCamera.updateProjectionMatrix();
  }

  // ================= UI bridge =================
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  getUI = () => this.uiState;
  emit(force = false) {
    if (!force && performance.now() - this.uiT < 100) return;
    this.uiT = performance.now();
    const recipe = this.currentRecipe();
    const held = this.inv[this.selected];
    const hours = Math.floor(((this.time * 24) + 6) % 24), mins = Math.floor(((this.time * 24 * 60) + 360) % 60);
    this.uiState = {
      screen: this.screen, health: this.health, hunger: this.hunger, air: this.air, inWater: this.inWater,
      inv: this.inv.map(clone), selected: this.selected, cursor: clone(this.cursor), craft: this.craft.map(clone), craftSize: this.craftSize,
      craftOut: recipe ? { id: recipe.out, count: recipe.count } : null,
      furnace: this.openFurnace ? { ...this.furnaces.get(this.openFurnace)! } : null,
      mode: this.meta.mode, debug: this.debug, debugText: this.debug ? this.debugText() : '', hurt: this.hurtTime, toast: this.toast,
      message: this.messageT > 0 ? this.message : '', loading: this.loadT, underwater: this.headInWater,
      heldName: held ? ITEMS[held.id].name : '', heldNameT: this.heldNameT, stats: { ...this.stats, days: this.day },
      achievements: [...this.achievements], locked: this.locked, time: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
      flying: this.flying, saveStatus: this.saveStatus,
    };
    this.listeners.forEach(l => l());
  }
  debugText() {
    const p = this.pos;
    const [sl, bl] = this.world.getLight(p.x, p.y + 1, p.z);
    return [
      `VoxelCraft  ${this.fps} fps`,
      `XYZ: ${p.x.toFixed(2)} / ${p.y.toFixed(2)} / ${p.z.toFixed(2)}`,
      `Chunk: ${Math.floor(p.x / CS)}, ${Math.floor(p.z / CS)}  Loaded: ${this.world.chunks.size}`,
      `Biome: ${BIOME_NAMES[this.biome]}   Light: sky ${sl} block ${bl}`,
      `Facing: ${(((-this.yaw * 180 / Math.PI) % 360) + 360) % 360 | 0}°  Day ${this.day + 1}  Rain ${(this.rain * 100) | 0}%`,
      `Entities: ${this.mobs.length} mobs, ${this.drops.length} items  Seed: ${this.meta.seed}`,
    ].join('\n');
  }
  flash(msg: string) { this.message = msg; this.messageT = 2.5; this.emit(true); }
  unlock(id: string) {
    if (this.achievements.has(id)) return;
    this.achievements.add(id);
    this.toast = { title: ACHIEVEMENTS[id].name, desc: ACHIEVEMENTS[id].desc, t: performance.now() };
    this.audio.achievement();
    this.emit(true);
  }

  selectSlot(i: number) { if (i !== this.selected) { this.selected = i; this.heldNameT = performance.now(); this.audio.click(); this.emit(true); } }

  openScreen(s: Screen) {
    this.screen = s;
    if (s === 'inventory') this.craftSize = 2;
    if (s === 'table') this.craftSize = 3;
    this.keys.clear(); this.mouseL = this.mouseR = false;
    if (document.pointerLockElement) document.exitPointerLock();
    this.emit(true);
  }
  closeScreen() {
    if (this.screen === 'dead' || this.screen === 'loading') return;
    // return crafting grid + cursor items
    for (let i = 0; i < 9; i++) { const s = this.craft[i]; if (s) { this.giveStack(s); this.craft[i] = null; } }
    if (this.cursor) { this.giveStack(this.cursor); this.cursor = null; }
    this.openFurnace = null;
    this.screen = 'none';
    this.requestLock();
    this.emit(true);
  }
  resume() { this.screen = 'none'; this.requestLock(); this.emit(true); }

  giveStack(s: Stack) {
    if (ITEMS[s.id].tool) {
      const i = this.inv.findIndex(x => !x);
      if (i >= 0) { this.inv[i] = { ...s }; return; }
      this.spawnDrop(s.id, 1, this.eye(), s.dur, true); return;
    }
    this.giveItem(s.id, s.count);
  }
  giveItem(id: number, count: number) {
    const order = [...Array(36).keys()];
    const left = addItem(this.inv, id, count, order);
    if (left) this.spawnDrop(id, left, this.eye(), undefined, true);
    if (id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG) this.unlock('wood');
    if (id === B.COBBLE) this.unlock('stone');
    if (id === I.DIAMOND) this.unlock('diamond');
    this.emit(true);
  }

  currentRecipe() {
    const w = this.craftSize;
    const grid: number[] = [];
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) grid.push(this.craft[y * 3 + x]?.id ?? 0);
    return matchRecipe(grid, w);
  }

  /** Inventory interaction from UI */
  slotClick(c: Container, i: number, right: boolean, shift: boolean) {
    this.audio.click();
    if (c === 'creative') {
      if (shift) addItem(this.inv, i, maxStack(i));
      else if (this.cursor && !right) this.cursor = null;
      else this.cursor = newStack(i, right ? 1 : maxStack(i));
      this.emit(true); return;
    }
    if (c === 'out') {
      const r = this.currentRecipe();
      if (!r) return;
      const doCraft = () => {
        for (let y = 0; y < this.craftSize; y++) for (let x = 0; x < this.craftSize; x++) {
          const k = y * 3 + x, s = this.craft[k];
          if (s) { s.count--; if (s.count <= 0) this.craft[k] = null; }
        }
        if (r.out === B.TABLE) this.unlock('table');
        if (r.out === B.FURNACE) this.unlock('furnace');
        if (r.out === B.TORCH) this.unlock('torch');
        if (ITEMS[r.out].tool?.type === 'pickaxe') this.unlock('pick');
      };
      if (shift) {
        let n = 0;
        while (n++ < 64) {
          const rr = this.currentRecipe();
          if (rr !== r) break;
          const test = this.inv.map(clone);
          if (ITEMS[r.out].tool ? !test.some(s => !s) : addItem(test, r.out, r.count) > 0) break;
          doCraft();
          if (ITEMS[r.out].tool) this.inv[this.inv.findIndex(s => !s)] = newStack(r.out); else addItem(this.inv, r.out, r.count);
        }
      } else {
        if (this.cursor && (this.cursor.id !== r.out || this.cursor.count + r.count > maxStack(r.out) || ITEMS[r.out].tool)) return;
        doCraft();
        if (this.cursor) this.cursor.count += r.count; else this.cursor = ITEMS[r.out].tool ? newStack(r.out) : { id: r.out, count: r.count };
      }
      this.emit(true); return;
    }
    const f = this.openFurnace ? this.furnaces.get(this.openFurnace)! : null;
    if (c === 'fOut' && f) {
      if (!f.output) return;
      if (shift) { const left = addItem(this.inv, f.output.id, f.output.count); f.output = left ? { ...f.output, count: left } : null; }
      else if (!this.cursor) { this.cursor = f.output; f.output = null; }
      else if (this.cursor.id === f.output.id && this.cursor.count + f.output.count <= maxStack(f.output.id)) { this.cursor.count += f.output.count; f.output = null; }
      this.emit(true); return;
    }
    // generic slots
    const get = (): Stack | null => c === 'inv' ? this.inv[i] : c === 'craft' ? this.craft[i] : c === 'fIn' ? f!.input : f!.fuel;
    const set = (s: Stack | null) => { if (c === 'inv') this.inv[i] = s; else if (c === 'craft') this.craft[i] = s; else if (c === 'fIn') f!.input = s; else f!.fuel = s; };
    if (shift) {
      const s = get(); if (!s) return;
      if (c === 'inv') {
        if (f && SMELT[s.id] !== undefined && (!f.input || f.input.id === s.id)) {
          const n = Math.min(s.count, maxStack(s.id) - (f.input?.count ?? 0));
          f.input = { id: s.id, count: (f.input?.count ?? 0) + n }; s.count -= n; set(s.count ? s : null);
        } else if (f && ITEMS[s.id].fuel && (!f.fuel || f.fuel.id === s.id)) {
          const n = Math.min(s.count, maxStack(s.id) - (f.fuel?.count ?? 0));
          f.fuel = { id: s.id, count: (f.fuel?.count ?? 0) + n }; s.count -= n; set(s.count ? s : null);
        } else {
          const target = i < 9 ? [...Array(27).keys()].map(k => k + 9) : [...Array(9).keys()];
          set(null);
          if (ITEMS[s.id].tool) { const t = target.find(k => !this.inv[k]); if (t !== undefined) this.inv[t] = s; else set(s); }
          else { const left = addItem(this.inv, s.id, s.count, target); if (left) set({ ...s, count: left }); }
        }
      } else { set(null); const left = addItem(this.inv, s.id, s.count); if (left) set({ ...s, count: left }); }
      this.emit(true); return;
    }
    const [ns, nc] = clickSlot(get(), this.cursor, right);
    set(ns); this.cursor = nc;
    this.emit(true);
  }
  /** Drop the cursor stack outside the window */
  dropCursor() {
    if (!this.cursor) return;
    this.spawnDrop(this.cursor.id, this.cursor.count, this.eye(), this.cursor.dur, true);
    this.cursor = null; this.emit(true);
  }

  // ================= Helpers =================
  eye() { return new THREE.Vector3(this.pos.x, this.pos.y + (this.sneaking ? 1.47 : 1.62), this.pos.z); }
  lookDir() { return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')); }
  daylightAt(t = this.time) { const s = Math.sin(t * Math.PI * 2); return clamp(s * 2.5 + 0.45, 0.12, 1) * (1 - this.rain * 0.3); }
  lightFactor(x: number, y: number, z: number) {
    const [s, b] = this.world.getLight(x, y, z);
    return Math.max(Math.pow(0.82, 15 - s) * this.daylightAt(), Math.pow(0.8, 15 - b), 0.06);
  }
  spawnDrop(id: number, count: number, p: THREE.Vector3, dur?: number, thrown = false) {
    const d = new Drop(id, count, p, this.atlasMat, dur);
    if (thrown) { const dir = this.lookDir(); d.vel.set(dir.x * 6, dir.y * 6 + 2, dir.z * 6); d.age = -1.2; }
    this.drops.push(d); this.scene.add(d.obj);
  }
  dropSelected(all: boolean) {
    const s = this.inv[this.selected]; if (!s) return;
    const n = all ? s.count : 1;
    this.spawnDrop(s.id, n, this.eye().add(this.lookDir().multiplyScalar(0.3)), s.dur, true);
    s.count -= n; if (s.count <= 0) this.inv[this.selected] = null;
    this.emit(true);
  }
  blockCenter(x: number, y: number, z: number) { return new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5); }
  tileColor(id: number) { return TILE_COLORS[FACE_TILES[id * 6 + 4]] ?? [128, 128, 128]; }

  // ================= Interaction =================
  targetMob(maxDist: number) {
    const ray = new THREE.Ray(this.eye(), this.lookDir());
    let best: Mob | null = null, bestD = maxDist;
    const box = new THREE.Box3(), hit = new THREE.Vector3();
    for (const m of this.mobs) {
      if (m.dead) continue;
      box.min.set(m.pos.x - m.w / 2, m.pos.y, m.pos.z - m.w / 2); box.max.set(m.pos.x + m.w / 2, m.pos.y + m.h, m.pos.z + m.w / 2);
      if (ray.intersectBox(box, hit)) { const d = hit.distanceTo(ray.origin); if (d < bestD) { bestD = d; best = m; } }
    }
    return best ? { mob: best, dist: bestD } : null;
  }
  tryAttack() {
    this.swing = 1;
    const reach = this.meta.mode === 'creative' ? 6 : 4;
    const t = this.targetMob(reach);
    if (!t) return;
    const blk = this.world.raycast(this.eye(), this.lookDir(), reach);
    if (blk && blk.dist < t.dist) return;
    if (this.attackCd > 0) return;
    this.attackCd = 0.35;
    const held = this.inv[this.selected];
    const tool = held ? ITEMS[held.id].tool : undefined;
    const crit = !this.onGround && this.vel.y < 0;
    const dmg = (tool ? tool.damage : 1) * (crit ? 1.5 : 1);
    this.damageMob(t.mob, dmg, this.lookDir());
    if (crit) this.particles.emit(t.mob.pos.x, t.mob.pos.y + t.mob.h * 0.7, t.mob.pos.z, [255, 240, 180], 12, 4, 6, 0.5);
    this.exhaustion += 0.1;
    if (tool && held && this.meta.mode === 'survival') this.useDurability(tool.type === 'sword' ? 1 : 2);
  }
  damageMob(m: Mob, dmg: number, dir: THREE.Vector3) {
    if (m.dead || m.hurtTime > 0.35) return;
    m.hp -= dmg; m.hurtTime = 0.5; m.fleeTime = 4;
    m.vel.x += dir.x * 7; m.vel.z += dir.z * 7; m.vel.y = 5;
    this.audio.mobHurt(m.kind === 'zombie' ? 0.6 : m.kind === 'sheep' ? 1.4 : 1);
    if (m.hp <= 0) {
      m.dead = true;
      for (const [id, n] of m.drops()) this.spawnDrop(id, n, m.pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
      if (m.kind === 'zombie') { this.unlock('zombie'); this.stats.killed++; }
    }
  }
  useDurability(n: number) {
    const s = this.inv[this.selected];
    if (!s || s.dur === undefined) return;
    s.dur -= n;
    if (s.dur <= 0) { this.inv[this.selected] = null; this.audio.toolBreak(); this.flash(`${ITEMS[s.id].name} broke!`); }
    this.emit(true);
  }
  breakTime(id: number) {
    const b = BLOCKS[id];
    if (b.hardness < 0) return Infinity;
    if (this.meta.mode === 'creative') return 0;
    const held = this.inv[this.selected];
    const tool = held ? ITEMS[held.id].tool : undefined;
    const right = tool && b.tool === tool.type;
    const canHarvest = !b.tier || (tool && tool.type === 'pickaxe' && tool.tier >= b.tier);
    let speed = right ? tool!.speed : 1;
    if (tool?.type === 'sword' && (id === B.LEAVES || id === B.SPRUCE_LEAVES || id === B.BIRCH_LEAVES)) speed = 4;
    let t = b.hardness * (canHarvest ? 1.5 : 5) / speed;
    if (this.inWater && this.headInWater) t *= 5;
    if (!this.onGround && !this.flying && !this.inWater) t *= 5;
    return t;
  }
  canHarvest(id: number) {
    const b = BLOCKS[id];
    if (!b.tier) return true;
    const held = this.inv[this.selected];
    const tool = held ? ITEMS[held.id].tool : undefined;
    return !!tool && tool.type === 'pickaxe' && tool.tier >= b.tier;
  }
  breakBlock(x: number, y: number, z: number, id: number, byPlayer = true) {
    const b = BLOCKS[id];
    this.world.setBlock(x, y, z, B.AIR);
    const c = this.tileColor(id);
    this.particles.emit(x + 0.5, y + 0.5, z + 0.5, c, 24, 3.5, 18, 0.9);
    this.audio.breakBlock(b.sound);
    if (byPlayer) {
      this.stats.mined++;
      this.exhaustion += 0.005;
      if (this.meta.mode === 'survival') {
        if (this.canHarvest(id) && b.drop) this.spawnDrop(b.drop, 1, this.blockCenter(x, y, z));
        if (id === B.LEAVES && Math.random() < 0.05) this.spawnDrop(I.APPLE, 1, this.blockCenter(x, y, z));
        if (id === B.GRAVEL && Math.random() < 0.1) this.spawnDrop(I.COAL, 1, this.blockCenter(x, y, z));
        const held = this.inv[this.selected];
        if (held && ITEMS[held.id].tool && b.hardness > 0) this.useDurability(ITEMS[held.id].tool!.type === 'sword' ? 2 : 1);
      }
    }
    if (id === B.FURNACE) {
      const k = `${x},${y},${z}`, f = this.furnaces.get(k);
      if (f) { for (const s of [f.input, f.fuel, f.output]) if (s) this.spawnDrop(s.id, s.count, this.blockCenter(x, y, z)); this.furnaces.delete(k); }
    }
  }
  onBlockChange(x: number, y: number, z: number, id: number, old: number) {
    if (id === B.AIR) {
      // plants lose support
      const above = this.world.getBlock(x, y + 1, z);
      if (RENDER[above] === 4) setTimeout(() => {
        if (this.world.getBlock(x, y + 1, z) === above && !SOLID[this.world.getBlock(x, y, z)]) {
          this.world.setBlock(x, y + 1, z, B.AIR);
          if (BLOCKS[above].drop && this.meta.mode === 'survival') this.spawnDrop(BLOCKS[above].drop!, 1, this.blockCenter(x, y + 1, z));
        }
      }, 50);
      if (above === B.CACTUS) setTimeout(() => { if (this.world.getBlock(x, y + 1, z) === B.CACTUS && !SOLID[this.world.getBlock(x, y, z)]) { this.world.setBlock(x, y + 1, z, B.AIR); this.spawnDrop(B.CACTUS, 1, this.blockCenter(x, y + 1, z)); } }, 60);
      // falling blocks
      if (above === B.SAND || above === B.GRAVEL) setTimeout(() => this.fall(x, y + 1, z), 80);
      // water flows in
      this.queueWater(x, y, z);
    }
    if (old === B.WATER && id !== B.WATER) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) this.queueWater(x + dx, y + dy, z + dz);
    if (id === B.WATER) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) this.queueWater(x + dx, y + dy, z + dz);
  }
  fall(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (id !== B.SAND && id !== B.GRAVEL) return;
    let ny = y;
    while (ny > 1 && !SOLID[this.world.getBlock(x, ny - 1, z)]) ny--;
    if (ny === y) return;
    this.world.setBlock(x, y, z, B.AIR);
    this.world.setBlock(x, ny, z, id);
  }
  queueWater(x: number, y: number, z: number) {
    if (this.world.getBlock(x, y, z) !== B.AIR && RENDER[this.world.getBlock(x, y, z)] !== 4) return;
    this.waterQueue.push({ x, y, z, t: 0.35 });
  }
  updateWater(dt: number) {
    const pending = this.waterQueue; this.waterQueue = [];
    for (const w of pending) {
      w.t -= dt;
      if (w.t > 0) { this.waterQueue.push(w); continue; }
      const cur = this.world.getBlock(w.x, w.y, w.z);
      if (cur !== B.AIR && RENDER[cur] !== 4) continue;
      const g = (dx: number, dy: number, dz: number) => this.world.getBlock(w.x + dx, w.y + dy, w.z + dz) === B.WATER;
      const sides = (g(1, 0, 0) ? 1 : 0) + (g(-1, 0, 0) ? 1 : 0) + (g(0, 0, 1) ? 1 : 0) + (g(0, 0, -1) ? 1 : 0);
      if (g(0, 1, 0) || sides >= 2 || (sides === 1 && SOLID[this.world.getBlock(w.x, w.y - 1, w.z)] && w.y <= SEA && this.nearSea(w.x, w.y, w.z))) {
        if (this.waterQueue.length < 400) this.world.setBlock(w.x, w.y, w.z, B.WATER);
      }
    }
  }
  nearSea(x: number, y: number, z: number) {
    // spread sideways only when connected to a large body (sea level and open water within 2 blocks)
    let n = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (this.world.getBlock(x + dx, y, z + dz) === B.WATER) n++;
    return n >= 4;
  }
  useItem() {
    if (this.placeCd > 0) return;
    this.placeCd = 0.22;
    const hit = this.world.raycast(this.eye(), this.lookDir(), this.meta.mode === 'creative' ? 6 : 5);
    const held = this.inv[this.selected];
    if (hit && !this.sneaking) {
      if (hit.id === B.TABLE) { this.openScreen('table'); return; }
      if (hit.id === B.FURNACE) {
        const k = `${hit.x},${hit.y},${hit.z}`;
        if (!this.furnaces.has(k)) this.furnaces.set(k, newFurnace());
        this.openFurnace = k; this.openScreen('furnace'); return;
      }
      if (hit.id === B.TNT) { this.world.setBlock(hit.x, hit.y, hit.z, B.AIR); this.primeTNT(hit.x, hit.y, hit.z); return; }
    }
    if (held && ITEMS[held.id].food && (this.hunger < 20 || this.meta.mode === 'creative') && this.eatCd <= 0) {
      const food = ITEMS[held.id].food!;
      this.hunger = Math.min(20, this.hunger + food);
      if (held.id === I.GOLDEN_APPLE) this.health = Math.min(20, this.health + 8);
      if (held.id === I.ROTTEN_FLESH && Math.random() < 0.6) { this.exhaustion += 6; this.flash('You feel queasy...'); }
      this.audio.eat(); this.swing = 1; this.eatCd = 0.8;
      const c = held.id === I.APPLE ? [220, 40, 40] : [200, 120, 80];
      const e = this.eye().add(this.lookDir().multiplyScalar(0.5));
      this.particles.emit(e.x, e.y - 0.2, e.z, c, 10, 2, 12, 0.6, 0.1);
      if (this.meta.mode === 'survival') { held.count--; if (!held.count) this.inv[this.selected] = null; }
      this.emit(true); return;
    }
    if (!hit || !held || !isBlockItem(held.id)) return;
    let px = hit.x + hit.nx, py = hit.y + hit.ny, pz = hit.z + hit.nz;
    if (RENDER[hit.id] === 4 && hit.id !== B.TORCH) { px = hit.x; py = hit.y; pz = hit.z; } // replace plants
    if (py < 1 || py >= H) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== B.AIR && existing !== B.WATER && RENDER[existing] !== 4) return;
    const id = held.id;
    const def = BLOCKS[id];
    if (def.render === 'cross') {
      const below = this.world.getBlock(px, py - 1, pz);
      if (!SOLID[below]) return;
      if (id !== B.TORCH && below !== B.GRASS && below !== B.DIRT && below !== B.SNOW) return;
    }
    if (def.solid) {
      const hw = 0.3;
      const p = this.pos;
      if (px + 1 > p.x - hw && px < p.x + hw && pz + 1 > p.z - hw && pz < p.z + hw && py + 1 > p.y && py < p.y + 1.8) return;
      for (const m of this.mobs) if (px + 1 > m.pos.x - m.w / 2 && px < m.pos.x + m.w / 2 && pz + 1 > m.pos.z - m.w / 2 && pz < m.pos.z + m.w / 2 && py + 1 > m.pos.y && py < m.pos.y + m.h) return;
    }
    this.world.setBlock(px, py, pz, id);
    if (id === B.SAND || id === B.GRAVEL) this.fall(px, py, pz);
    this.audio.place(def.sound);
    this.swing = 1; this.stats.placed++;
    if (this.meta.mode === 'survival') { held.count--; if (!held.count) this.inv[this.selected] = null; }
    this.emit(true);
  }
  pickBlock() {
    const hit = this.world.raycast(this.eye(), this.lookDir(), 6);
    if (!hit) return;
    let id = hit.id;
    if (id === B.GRASS && this.meta.mode === 'survival') id = B.DIRT;
    const idx = this.inv.findIndex((s, i) => i < 9 && s?.id === id);
    if (idx >= 0) { this.selectSlot(idx); return; }
    if (this.meta.mode === 'creative') { this.inv[this.selected] = newStack(id, maxStack(id)); this.emit(true); }
  }
  primeTNT(x: number, y: number, z: number, short = false) {
    const t = new PrimedTNT(new THREE.Vector3(x + 0.5, y, z + 0.5), this.atlasMat);
    if (short) t.fuse = 0.5 + Math.random() * 1;
    this.tnts.push(t); this.scene.add(t.mesh);
    this.audio.fuse();
  }
  explode(c: THREE.Vector3, power: number) {
    this.unlock('boom');
    this.audio.explode();
    const r = power;
    for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > r - Math.random() * 1.2) continue;
      const x = Math.floor(c.x + dx), y = Math.floor(c.y + dy), z = Math.floor(c.z + dz);
      const id = this.world.getBlock(x, y, z);
      if (!id || id === B.BEDROCK || id === B.WATER) continue;
      if (id === B.TNT) { this.world.setBlock(x, y, z, B.AIR); this.primeTNT(x, y, z, true); continue; }
      if (id === B.FURNACE) { this.breakBlock(x, y, z, id, false); continue; }
      this.world.setBlock(x, y, z, B.AIR);
      if (Math.random() < 0.25 && BLOCKS[id].drop) this.spawnDrop(BLOCKS[id].drop!, 1, this.blockCenter(x, y, z));
    }
    for (let i = 0; i < 6; i++) this.particles.emit(c.x, c.y + 0.5, c.z, [70, 70, 70], 30, 9, -1, 1.6, 1.5);
    this.particles.emit(c.x, c.y + 0.5, c.z, [255, 180, 60], 50, 12, 4, 0.6, 1);
    const pd = this.pos.distanceTo(c);
    if (pd < r * 2.2) {
      const f = 1 - pd / (r * 2.2);
      this.hurt(Math.round(f * 18));
      const push = this.pos.clone().sub(c).normalize().multiplyScalar(f * 18);
      this.vel.add(push); this.vel.y += f * 6;
    }
    this.shake = Math.max(this.shake, clamp(1 - pd / 30, 0, 1));
    for (const m of this.mobs) {
      const d = m.pos.distanceTo(c);
      if (d < r * 2.2) { const f = 1 - d / (r * 2.2); m.hurtTime = 0; this.damageMob(m, f * 18, m.pos.clone().sub(c).normalize()); }
    }
  }
  hurt(n: number) {
    if (this.meta.mode === 'creative' || n <= 0 || this.screen === 'dead') return;
    this.health -= n; this.hurtTime = 1; this.audio.hurt(); this.shake = Math.max(this.shake, 0.3);
    if (this.health <= 0) this.die();
    this.emit(true);
  }
  die() {
    this.health = 0; this.stats.deaths++;
    for (let i = 0; i < 36; i++) { const s = this.inv[i]; if (s) { const d = new Drop(s.id, s.count, this.pos.clone().add(new THREE.Vector3(0, 1, 0)), this.atlasMat, s.dur); d.vel.multiplyScalar(1.5); this.drops.push(d); this.scene.add(d.obj); this.inv[i] = null; } }
    this.openScreen('dead');
  }
  respawn() {
    this.health = 20; this.hunger = 20; this.air = 10; this.exhaustion = 0;
    this.pos.copy(this.spawn); this.vel.set(0, 0, 0); this.fallStart = this.pos.y;
    this.screen = 'none'; this.requestLock(); this.emit(true);
  }

  // ================= Update =================
  loop = () => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 1) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    this.update(dt);
    this.render();
  };

  update(dt: number) {
    const rd = this.settings.renderDistance;
    if (this.screen === 'loading') {
      const pending = this.world.update(this.pos.x, this.pos.z, rd, 40);
      const c = this.world.getChunk(Math.floor(this.pos.x / CS), Math.floor(this.pos.z / CS));
      const total = (2 * rd + 3) ** 2;
      this.loadT = clamp(1 - pending / total, 0, 1);
      if (c?.meshed && (pending < total * 0.4 || this.loadT > 0.6)) {
        // ensure we are not inside terrain
        const x = Math.floor(this.pos.x), z = Math.floor(this.pos.z);
        while (this.pos.y < H - 2 && this.world.boxCollides(this.pos.x - 0.3, this.pos.y, this.pos.z - 0.3, this.pos.x + 0.3, this.pos.y + 1.8, this.pos.z + 0.3)) this.pos.y = Math.floor(this.pos.y) + 1;
        if (!this.spawnFixed) {
          this.spawnFixed = true;
          let best: number[] | null = null;
          for (let r = 0; r < 12 && !best; r++) for (let dz = -r; dz <= r && !best; dz++) for (let dx = -r; dx <= r && !best; dx++) {
            const sy = this.world.surfaceY(x + dx, z + dz);
            if (this.world.getBlock(x + dx, sy, z + dz) === B.GRASS || this.world.getBlock(x + dx, sy, z + dz) === B.SNOW || this.world.getBlock(x + dx, sy, z + dz) === B.SAND) best = [x + dx + 0.5, sy + 1, z + dz + 0.5];
          }
          if (best && !loadWorldData(this.meta.id)) { this.pos.set(best[0], best[1], best[2]); this.spawn.copy(this.pos); }
        }
        this.fallStart = this.pos.y;
        this.screen = 'pause';
      }
      this.updateSky(0);
      this.updateCamera(0);
      this.emit();
      return;
    }
    this.world.update(this.pos.x, this.pos.z, rd, 6);
    const paused = this.screen === 'pause';
    if (paused) { this.updateSky(0); this.updateCamera(0); this.emit(); return; }
    this.attackCd -= dt; this.placeCd -= dt; this.eatCd -= dt; this.hurtTime = Math.max(0, this.hurtTime - dt * 2);
    this.shake = Math.max(0, this.shake - dt * 2); this.swing = Math.max(0, this.swing - dt * 4); this.messageT -= dt;
    if (this.toast && performance.now() - this.toast.t > 5000) { this.toast = null; this.emit(true); }

    // time & weather
    const prevT = this.time;
    this.time += dt / DAY_LENGTH;
    if (this.time >= 1) { this.time -= 1; this.day++; this.stats.days = this.day; }
    const sNow = Math.sin(this.time * Math.PI * 2), sPrev = Math.sin(prevT * Math.PI * 2);
    if (sPrev < 0 && sNow >= 0 && this.nightStart >= 0) { this.unlock('night'); }
    if (sPrev >= 0 && sNow < 0) this.nightStart = this.day;
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) { this.rainTarget = this.rainTarget > 0 ? 0 : (Math.random() < 0.6 ? 1 : 0); this.weatherTimer = 90 + Math.random() * 240; }
    this.rain += clamp(this.rainTarget - this.rain, -dt * 0.08, dt * 0.08);
    if (this.rain > 0.8 && Math.random() < dt / 25) { this.lightning = 1; setTimeout(() => this.audio.thunder(), 300 + Math.random() * 1500); }
    this.lightning = Math.max(0, this.lightning - dt * 3);

    if (this.screen === 'none' || this.screen === 'dead' || true) this.updatePlayer(dt);
    this.updateMining(dt);
    if (this.mouseR && this.screen === 'none') this.useItem();
    this.updateEntities(dt);
    this.updateFurnaces(dt);
    this.updateWater(dt);
    this.particles.update(this.world, dt);
    this.updateSky(dt);
    this.updateRain(dt);
    this.updateCamera(dt);
    this.updateHand(dt);
    // ambient
    const night = Math.sin(this.time * Math.PI * 2) < 0;
    this.audio.setAmbience(this.headInWater ? 0.2 : this.rain * (this.snowMode ? 0.2 : 1), this.pos.y > 70 ? 1 : 0.3);
    if (this.settings.music) this.audio.music(dt, night);
    this.saveT += dt;
    if (this.saveT > 30) { this.saveT = 0; this.save(); }
    this.emit();
  }

  updatePlayer(dt: number) {
    const p = this.pos, v = this.vel;
    if (!this.world.isLoaded(p.x, p.z)) return; // wait for terrain
    const active = this.screen === 'none';
    const k = (c: string) => active && this.keys.has(c);
    const feet = this.world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z));
    const wasIn = this.inWater;
    this.inWater = feet === B.WATER || this.world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.8), Math.floor(p.z)) === B.WATER;
    const eyeB = this.world.getBlock(Math.floor(p.x), Math.floor(p.y + 1.62), Math.floor(p.z));
    this.headInWater = eyeB === B.WATER;
    if (this.inWater && !wasIn && v.y < -4) this.audio.splash();
    this.sneaking = k('ShiftLeft') && !this.flying;
    if (k('ControlLeft') && k('KeyW')) this.sprinting = true;
    if (!k('KeyW') || this.sneaking || (this.hunger <= 6 && this.meta.mode === 'survival')) this.sprinting = false;
    let fx = 0, fz = 0;
    if (k('KeyW')) fz -= 1; if (k('KeyS')) fz += 1; if (k('KeyA')) fx -= 1; if (k('KeyD')) fx += 1;
    const len = Math.hypot(fx, fz) || 1; fx /= len; fz /= len;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wx = fx * cos + fz * sin, wz = -fx * sin + fz * cos;
    let speed = this.flying ? (this.sprinting ? 22 : 11) : this.inWater ? 2.6 : this.sneaking ? 1.4 : this.sprinting ? 5.8 : 4.3;
    if (this.inWater && this.sprinting) speed = 4;
    const accel = this.flying ? 8 : this.onGround ? 18 : this.inWater ? 6 : 3.5;
    const a = 1 - Math.exp(-accel * dt);
    v.x += (wx * speed - v.x) * a; v.z += (wz * speed - v.z) * a;
    if (this.flying) {
      const vy = ((k('Space') ? 1 : 0) - (k('ShiftLeft') ? 1 : 0)) * 9;
      v.y += (vy - v.y) * (1 - Math.exp(-10 * dt));
    } else if (this.inWater) {
      v.y -= 9 * dt; v.y *= Math.pow(0.15, dt);
      if (k('Space')) v.y = Math.min(v.y + 30 * dt, 3.5);
      v.y = Math.max(v.y, -4);
    } else {
      v.y -= 30 * dt; v.y = Math.max(v.y, -60);
      if (k('Space') && this.onGround) { v.y = 9.2; this.exhaustion += this.sprinting ? 0.2 : 0.05; if (this.sprinting) { v.x += wx * 2; v.z += wz * 2; } }
    }
    const before = p.clone();
    const col = moveBody(this.world, this.body, dt, this.sneaking);
    // swim up out of water onto ledge
    if (this.inWater && (col.hitX || col.hitZ) && k('Space')) v.y = 4.5;
    const wasGround = this.onGround;
    this.onGround = this.body.onGround;
    if (this.flying && this.onGround && this.meta.mode === 'creative' && v.y <= 0 && k('ShiftLeft')) this.flying = false;
    // fall damage
    if (this.onGround || this.inWater || this.flying) {
      if (this.onGround && !wasGround && !this.inWater && !this.flying) {
        const fall = this.fallStart - p.y;
        if (fall > 3.4) { this.hurt(Math.floor(fall - 3)); const b = this.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)); this.particles.emit(p.x, p.y, p.z, this.tileColor(b), 14, 3, 18, 0.6); }
        else if (fall > 0.5) { const b = this.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z)); if (b) this.audio.step(BLOCKS[b].sound); }
      }
      this.fallStart = p.y;
    } else this.fallStart = Math.max(this.fallStart, p.y);
    // steps & bobbing
    const moved = Math.hypot(p.x - before.x, p.z - before.z);
    if (this.onGround && !this.flying) {
      this.walkDist += moved; this.stepDist += moved;
      if (this.stepDist > 1.8) {
        this.stepDist = 0;
        const b = this.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.5), Math.floor(p.z));
        if (b && BLOCKS[b]) this.audio.step(BLOCKS[b].sound);
      }
      this.exhaustion += moved * (this.sprinting ? 0.1 : 0.01);
    }
    this.bob += ((this.onGround && moved > 0.001 ? 1 : 0) - this.bob) * (1 - Math.exp(-10 * dt));
    if (p.y < -20) { this.hurt(4); if (this.meta.mode === 'creative' || this.health > 0) { p.y = H; } }
    // survival stats
    if (this.meta.mode === 'survival') {
      if (this.exhaustion >= 4) { this.exhaustion -= 4; this.hunger = Math.max(0, this.hunger - 1); this.emit(true); }
      if (this.hunger >= 18 && this.health < 20) { this.regenTimer += dt; if (this.regenTimer > 3) { this.regenTimer = 0; this.health = Math.min(20, this.health + 1); this.exhaustion += 3; this.emit(true); } }
      if (this.hunger <= 0) { this.starveTimer += dt; if (this.starveTimer > 4) { this.starveTimer = 0; if (this.health > 1) this.hurt(1); } }
      if (this.headInWater) {
        this.airTimer += dt;
        if (this.airTimer > 1.5) { this.airTimer = 0; if (this.air > 0) this.air--; else this.hurt(2); this.emit(true); }
      } else if (this.air < 10) { this.airTimer += dt; if (this.airTimer > 0.3) { this.airTimer = 0; this.air++; this.emit(true); } }
      // cactus
      this.cactusTimer -= dt;
      if (this.cactusTimer <= 0 && this.touching(B.CACTUS)) { this.cactusTimer = 0.6; this.hurt(1); }
    } else { this.health = 20; this.hunger = 20; this.air = 10; }
  }
  touching(id: number) {
    const p = this.pos;
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + 1.8); y++) for (let z = Math.floor(p.z - 0.4); z <= Math.floor(p.z + 0.4); z++) for (let x = Math.floor(p.x - 0.4); x <= Math.floor(p.x + 0.4); x++)
      if (this.world.getBlock(x, y, z) === id) return true;
    return false;
  }

  updateMining(dt: number) {
    const active = this.screen === 'none' && this.locked;
    const reach = this.meta.mode === 'creative' ? 6 : 5;
    const hit = active ? this.world.raycast(this.eye(), this.lookDir(), reach) : null;
    if (hit) { this.highlight.visible = true; this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); }
    else this.highlight.visible = false;
    if (hit && RENDER[hit.id] === 4) { this.highlight.scale.set(0.6, 0.8, 0.6); this.highlight.position.y -= 0.1; } else this.highlight.scale.set(1, 1, 1);
    let stage = -1;
    if (hit && this.mouseL && active) {
      const key = `${hit.x},${hit.y},${hit.z}`;
      const mob = this.targetMob(reach);
      if (mob && mob.dist < hit.dist) { this.breakProgress = 0; }
      else {
        if (key !== this.breakKey) { this.breakKey = key; this.breakProgress = 0; }
        const t = this.breakTime(hit.id);
        if (t === 0) {
          if (this.attackCd <= 0) { this.breakBlock(hit.x, hit.y, hit.z, hit.id); this.attackCd = 0.2; this.swing = 1; }
        } else if (isFinite(t)) {
          this.breakProgress += dt / Math.max(0.05, t);
          this.swing = Math.max(this.swing, 0.6);
          this.digSoundT -= dt;
          if (this.digSoundT <= 0) {
            this.digSoundT = 0.22; this.audio.dig(BLOCKS[hit.id].sound);
            this.particles.emit(hit.x + 0.5 + hit.nx * 0.55, hit.y + 0.5 + hit.ny * 0.55, hit.z + 0.5 + hit.nz * 0.55, this.tileColor(hit.id), 4, 2, 18, 0.5, 0.3);
          }
          if (this.breakProgress >= 1) { this.breakBlock(hit.x, hit.y, hit.z, hit.id); this.breakProgress = 0; this.breakKey = ''; }
          else stage = Math.min(7, Math.floor(this.breakProgress * 8));
        }
      }
    } else { this.breakProgress = 0; this.breakKey = ''; }
    if (stage >= 0 && hit) {
      this.crackMesh.visible = true;
      this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      if (stage !== this.crackStage) {
        this.crackStage = stage;
        const ti = TILE_INDEX[`crack${stage}`], ts = 1 / ATLAS_TILES;
        const u0 = (ti % ATLAS_TILES) * ts, v0 = 1 - (Math.floor(ti / ATLAS_TILES) + 1) * ts;
        const uv = this.crackMesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const base = [[0, 1], [1, 1], [0, 0], [1, 0]];
        for (let i = 0; i < 24; i++) uv.setXY(i, u0 + base[i % 4][0] * ts, v0 + base[i % 4][1] * ts);
        uv.needsUpdate = true;
      }
    } else { this.crackMesh.visible = false; this.crackStage = -1; }
  }

  updateEntities(dt: number) {
    const p = this.pos;
    const dayl = this.daylightAt();
    const night = Math.sin(this.time * Math.PI * 2) < -0.05;
    // spawning
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.5;
      const passive = this.mobs.filter(m => m.kind !== 'zombie').length;
      const hostile = this.mobs.length - passive;
      const tryKind: MobKind | null = night && hostile < 7 && this.meta.mode === 'survival' ? 'zombie' : (!night && passive < 10 ? (['pig', 'sheep', 'cow'] as MobKind[])[Math.floor(Math.random() * 3)] : null);
      if (tryKind) {
        const ang = Math.random() * Math.PI * 2, dist = 20 + Math.random() * 22;
        const x = Math.floor(p.x + Math.cos(ang) * dist), z = Math.floor(p.z + Math.sin(ang) * dist);
        if (this.world.isLoaded(x, z)) {
          const y = this.world.surfaceY(x, z);
          const ground = this.world.getBlock(x, y, z);
          const ok = tryKind === 'zombie' ? SOLID[ground] && ground !== B.LEAVES : ground === B.GRASS;
          if (ok && !this.world.boxCollides(x + 0.1, y + 1, z + 0.1, x + 0.9, y + 2.8, z + 0.9)) {
            const n = tryKind === 'zombie' ? 1 : 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < n; i++) this.addMob(tryKind, new THREE.Vector3(x + 0.5 + i * 0.3, y + 1, z + 0.5));
          }
        }
      }
    }
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      const dx = p.x - m.pos.x, dz = p.z - m.pos.z, dist = Math.hypot(dx, dz);
      if (dist > 90 || (m.dead && m.deathTime > 0.9) || m.pos.y < -10) {
        if (m.dead) this.particles.emit(m.pos.x, m.pos.y + 0.5, m.pos.z, [230, 230, 230], 20, 2, -2, 1, 0.5);
        this.scene.remove(m.group); this.mobs.splice(i, 1); continue;
      }
      if (!this.world.isLoaded(m.pos.x, m.pos.z)) continue;
      m.hurtTime -= dt; m.fleeTime -= dt; m.attackCd -= dt;
      const inWater = this.world.getBlock(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.4), Math.floor(m.pos.z)) === B.WATER;
      let speed = 0;
      if (m.dead) { m.deathTime += dt; m.group.rotation.z = Math.min(m.deathTime * 4, Math.PI / 2); }
      else if (m.kind === 'zombie') {
        const dy = p.y - m.pos.y;
        if (dist < 24 && this.screen !== 'dead' && this.meta.mode === 'survival') {
          m.targetYaw = Math.atan2(dx, dz); speed = 2.7; m.moving = true;
          if (dist < 1.3 && Math.abs(dy) < 1.6 && m.attackCd <= 0) {
            m.attackCd = 1; this.hurt(3);
            this.vel.x += dx / dist * 6; this.vel.z += dz / dist * 6; this.vel.y = 4;
          }
        } else this.wander(m, dt);
        if (!m.moving && dist >= 24) speed = 0; else if (dist >= 24) speed = 1.2;
        // burn in daylight
        const [sl] = this.world.getLight(m.pos.x, m.pos.y + 1.6, m.pos.z);
        if (dayl > 0.75 && sl >= 14 && !inWater) {
          m.burnTimer -= dt;
          this.particles.emit(m.pos.x, m.pos.y + 1, m.pos.z, [255, 120 + Math.random() * 80, 30], 1, 1, -3, 0.5, 0.3);
          if (m.burnTimer <= 0) { m.burnTimer = 1; m.hurtTime = 0; this.damageMob(m, 2, new THREE.Vector3()); }
        }
        m.soundTimer -= dt;
        if (m.soundTimer <= 0) { m.soundTimer = 6 + Math.random() * 10; if (dist < 20) this.audio.zombie(); }
      } else {
        if (m.fleeTime > 0) { m.targetYaw = Math.atan2(-dx, -dz) + Math.sin(m.fleeTime * 3) * 0.5; speed = 4.5; m.moving = true; }
        else { this.wander(m, dt); speed = m.moving ? 1.3 : 0; }
        m.soundTimer -= dt;
        if (m.soundTimer <= 0) { m.soundTimer = 8 + Math.random() * 15; if (dist < 16) { if (m.kind === 'pig') this.audio.pig(); else this.audio.sheep(); } }
      }
      let dyaw = m.targetYaw - m.yaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      m.yaw += dyaw * (1 - Math.exp(-6 * dt));
      const tvx = Math.sin(m.yaw) * speed, tvz = Math.cos(m.yaw) * speed;
      const ga = 1 - Math.exp(-(m.onGround ? 10 : 2) * dt);
      if (m.hurtTime < 0.3) { m.vel.x += (tvx - m.vel.x) * ga; m.vel.z += (tvz - m.vel.z) * ga; }
      if (inWater) { m.vel.y += (3 - m.vel.y) * (1 - Math.exp(-3 * dt)); }
      else m.vel.y -= 28 * dt;
      const wasG = m.onGround;
      const c = moveBody(this.world, m, dt);
      if ((c.hitX || c.hitZ) && m.onGround && speed > 0) m.vel.y = 8.5;
      if (m.onGround) { if (!wasG && m.fallStart - m.pos.y > 4) { m.hurtTime = 0; this.damageMob(m, Math.floor(m.fallStart - m.pos.y - 3), new THREE.Vector3()); } m.fallStart = m.pos.y; }
      else m.fallStart = Math.max(m.fallStart, m.pos.y);
      // animate
      const hs = Math.hypot(m.vel.x, m.vel.z);
      m.walkPhase += hs * dt * 3.2;
      const sw = Math.sin(m.walkPhase) * Math.min(1, hs / 2) * 0.7;
      m.legs.forEach((l, li) => (l.rotation.x = (li % 2 === (li >> 1) % 2 ? sw : -sw)));
      if (m.kind === 'zombie') m.arms.forEach((a, ai) => (a.rotation.x = -Math.PI / 2 + Math.sin(m.walkPhase * 0.5 + ai) * 0.08));
      if (m.head && m.kind !== 'zombie') m.head.rotation.x = !m.moving && !m.dead ? Math.sin(performance.now() / 900 + i) * 0.15 + 0.15 : 0;
      m.group.position.copy(m.pos);
      m.group.rotation.y = m.yaw;
      m.setLight(this.lightFactor(m.pos.x, m.pos.y + 0.5, m.pos.z));
    }
    // drops
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      if (!this.world.isLoaded(d.pos.x, d.pos.z)) continue;
      d.update(this.world, dt);
      const lf = this.lightFactor(d.pos.x, d.pos.y + 0.3, d.pos.z);
      const mesh = d.obj as THREE.Mesh;
      if (mesh.material !== this.atlasMat) (mesh.material as THREE.MeshBasicMaterial).color.setScalar(lf);
      if (!isBlockItem(d.id) || BLOCKS[d.id].render === 'cross') d.obj.quaternion.copy(this.camera.quaternion);
      const dd = d.pos.distanceTo(new THREE.Vector3(p.x, p.y + 0.8, p.z));
      if (d.age > 0.5 && dd < 1.8 && this.screen !== 'dead') {
        // magnet + pick up
        if (dd < 1.0) {
          const s: Stack = { id: d.id, count: d.count, dur: d.dur };
          const before = d.count;
          let left: number;
          if (ITEMS[d.id].tool) { const k = this.inv.findIndex(x => !x); if (k >= 0) { this.inv[k] = { id: d.id, count: 1, dur: d.dur ?? ITEMS[d.id].tool!.durability }; left = 0; } else left = 1; }
          else left = addItem(this.inv, s.id, s.count);
          if (left < before) {
            this.audio.pickup();
            this.giveItem(d.id, 0);
            if (left === 0) { this.scene.remove(d.obj); this.drops.splice(i, 1); continue; }
            d.count = left;
          }
        } else d.pos.lerp(new THREE.Vector3(p.x, p.y + 0.5, p.z), dt * 6);
      }
      if (d.age > 300) { this.scene.remove(d.obj); this.drops.splice(i, 1); }
    }
    // shared atlas material brightness for block drops (approximate with player light)
    this.atlasMat.color.setScalar(this.lightFactor(p.x, p.y + 1, p.z));
    // TNT
    for (let i = this.tnts.length - 1; i >= 0; i--) {
      const t = this.tnts[i];
      t.fuse -= dt;
      t.vel.y -= 25 * dt; t.vel.x *= 0.9; t.vel.z *= 0.9;
      moveBody(this.world, t, dt);
      t.mesh.position.set(t.pos.x, t.pos.y + 0.49, t.pos.z);
      const flash = Math.floor(t.fuse * 6) % 2 === 0;
      (t.mesh.material as THREE.MeshBasicMaterial).color.setScalar(flash ? 2.2 : this.lightFactor(t.pos.x, t.pos.y + 0.5, t.pos.z));
      t.mesh.scale.setScalar(1 + Math.max(0, 0.4 - t.fuse) * 0.3);
      if (t.fuse <= 0) { this.scene.remove(t.mesh); this.tnts.splice(i, 1); this.explode(t.pos.clone().add(new THREE.Vector3(0, 0.5, 0)), 4); }
    }
  }
  wander(m: Mob, dt: number) {
    m.wanderTimer -= dt;
    if (m.wanderTimer <= 0) {
      m.wanderTimer = 2 + Math.random() * 5;
      m.moving = Math.random() < 0.55;
      m.targetYaw = Math.random() * Math.PI * 2;
    }
    // avoid walking into water / off cliffs
    if (m.moving) {
      const ax = Math.floor(m.pos.x + Math.sin(m.yaw) * 0.9), az = Math.floor(m.pos.z + Math.cos(m.yaw) * 0.9);
      const y = Math.floor(m.pos.y);
      const below = this.world.getBlock(ax, y - 1, az), below2 = this.world.getBlock(ax, y - 2, az);
      if (below === B.WATER || (!SOLID[below] && !SOLID[below2] && !SOLID[this.world.getBlock(ax, y - 3, az)])) { m.targetYaw += Math.PI; m.wanderTimer = 1.5; }
    }
  }
  addMob(kind: MobKind, pos: THREE.Vector3) {
    const m = new Mob(kind, pos);
    m.fallStart = pos.y;
    this.mobs.push(m); this.scene.add(m.group);
    return m;
  }

  updateFurnaces(dt: number) {
    for (const [k, f] of this.furnaces) {
      const result = f.input ? SMELT[f.input.id] : undefined;
      const canSmelt = result !== undefined && (!f.output || (f.output.id === result && f.output.count < maxStack(result)));
      if (f.burn > 0) f.burn -= dt;
      if (f.burn <= 0 && canSmelt && f.fuel) {
        const fv = ITEMS[f.fuel.id].fuel ?? 0;
        if (fv) { f.burn = f.burnMax = fv; f.fuel.count--; if (!f.fuel.count) f.fuel = null; }
      }
      if (f.burn > 0 && canSmelt) {
        f.progress += dt / 5;
        if (f.progress >= 1) {
          f.progress = 0;
          f.input!.count--; if (!f.input!.count) f.input = null;
          if (f.output) f.output.count++; else f.output = { id: result!, count: 1 };
          if (result === I.IRON_INGOT) this.unlock('iron');
          if (result === I.COOKED_PORK || result === I.COOKED_MUTTON) this.unlock('cook');
        }
        if (Math.random() < dt * 4) { const [x, y, z] = k.split(',').map(Number); if (Math.abs(x - this.pos.x) < 24) this.particles.emit(x + 0.5, y + 1.05, z + 0.5, [90, 90, 90], 1, 0.5, -1.5, 1.2, 0.2); }
      } else f.progress = Math.max(0, f.progress - dt / 10);
    }
    if (this.openFurnace) this.emit();
  }

  updateSky(dt: number) {
    const t = this.time, ang = t * Math.PI * 2;
    const s = Math.sin(ang);
    const sunDir = new THREE.Vector3(Math.cos(ang), s, 0.25).normalize();
    const dayF = THREE.MathUtils.smoothstep(s, -0.25, 0.25);
    const sunset = clamp(1 - Math.abs(s) / 0.3, 0, 1) * (Math.cos(ang) > -2 ? 1 : 0);
    const top = new THREE.Color(0.02, 0.025, 0.07).lerp(new THREE.Color(0.32, 0.56, 0.92), dayF);
    const hor = new THREE.Color(0.05, 0.06, 0.12).lerp(new THREE.Color(0.72, 0.84, 0.97), dayF);
    hor.lerp(new THREE.Color(0.98, 0.55, 0.3), sunset * 0.55);
    const grey = new THREE.Color(0.45, 0.48, 0.52).multiplyScalar(0.25 + 0.75 * dayF);
    top.lerp(grey, this.rain * 0.75); hor.lerp(grey, this.rain * 0.7);
    if (this.lightning > 0) { top.lerp(new THREE.Color(1, 1, 1), this.lightning * 0.6); hor.lerp(new THREE.Color(1, 1, 1), this.lightning * 0.6); }
    const sm = this.sky.material as THREE.ShaderMaterial;
    sm.uniforms.top.value.copy(top); sm.uniforms.horizon.value.copy(hor); sm.uniforms.sunDir.value.copy(sunDir);
    sm.uniforms.glow.value.setRGB(1, 0.6, 0.3).multiplyScalar(sunset * (1 - this.rain));
    const cam = this.camera.position;
    this.skyGroup.position.copy(cam);
    this.sun.position.copy(sunDir).multiplyScalar(420); this.skyGroup.updateMatrixWorld(); this.sun.lookAt(cam);
    this.moon.position.copy(sunDir).multiplyScalar(-420); this.moon.lookAt(cam);
    (this.sun.material as THREE.MeshBasicMaterial).opacity = 1 - this.rain * 0.9;
    (this.moon.material as THREE.MeshBasicMaterial).opacity = 1 - this.rain * 0.9;
    (this.stars.material as THREE.PointsMaterial).opacity = (1 - dayF) * (1 - this.rain);
    this.stars.rotation.x = ang;
    // clouds
    const cm = this.clouds.material as THREE.ShaderMaterial;
    this.clouds.position.set(cam.x, 118, cam.z);
    cm.uniforms.offset.value.set((cam.x + performance.now() * 0.0015) / 200, -cam.z / 200);
    cm.uniforms.color.value.setScalar(0.15 + 0.85 * dayF).lerp(new THREE.Color(0.5, 0.5, 0.55), this.rain * 0.6);
    cm.uniforms.opacity.value = 0.8 + this.rain * 0.2;
    // lighting
    let daylight = this.daylightAt();
    if (this.lightning > 0) daylight = Math.max(daylight, this.lightning);
    const fogNear = this.settings.renderDistance * CS * 0.55, fogFar = this.settings.renderDistance * CS * 0.95;
    let fogColor = hor.clone();
    let near = fogNear * (1 - this.rain * 0.4), far = fogFar * (1 - this.rain * 0.25);
    if (this.headInWater) { fogColor = new THREE.Color(0.05, 0.15, 0.35).multiplyScalar(0.3 + daylight * 0.7); near = 1; far = 24; }
    const skyTint = new THREE.Color(1, 1, 1).lerp(new THREE.Color(1, 0.75, 0.6), sunset * 0.6).lerp(new THREE.Color(0.6, 0.7, 1), 1 - dayF);
    for (const m of [this.world.solidMat, this.world.waterMat]) {
      m.uniforms.daylight.value = daylight; m.uniforms.fogColor.value.copy(fogColor);
      m.uniforms.fogNear.value = near; m.uniforms.fogFar.value = far;
      m.uniforms.time.value = performance.now() / 1000; m.uniforms.skyTint.value.copy(skyTint);
    }
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(fogColor); fog.near = near; fog.far = far;
    this.renderer.setClearColor(fogColor);
    this.sky.visible = !this.headInWater;
    void dt;
  }

  updateRain(dt: number) {
    this.biome = this.world.gen.column(Math.floor(this.pos.x), Math.floor(this.pos.z)).biome;
    const desert = this.biome === BIOME.DESERT;
    this.snowMode = this.biome === BIOME.SNOW || this.pos.y > 80;
    const vis = this.rain > 0.05 && !desert;
    this.rainLines.visible = vis;
    if (!vis) return;
    const N = this.rainFloor.length, p = this.pos, R = 18;
    const count = Math.floor(N * this.rain);
    const fall = this.snowMode ? 3 : 28, len = this.snowMode ? 0.12 : 0.7;
    const mat = this.rainLines.material as THREE.LineBasicMaterial;
    mat.color.set(this.snowMode ? 0xffffff : 0x9fb4d8);
    mat.opacity = (this.snowMode ? 0.9 : 0.45) * Math.min(1, this.daylightAt() + 0.3);
    const rp = this.rainPos;
    for (let i = 0; i < N; i++) {
      const o = i * 6;
      if (i >= count) { rp[o + 1] = rp[o + 4] = -1000; continue; }
      let x = rp[o], y = rp[o + 1], z = rp[o + 2];
      const drift = this.snowMode ? Math.sin(performance.now() / 700 + i) * 0.6 : 0.8;
      y -= fall * dt; x += drift * dt;
      if (y < this.rainFloor[i] || y < p.y - 12 || Math.abs(x - p.x) > R || Math.abs(z - p.z) > R || y > p.y + 30) {
        x = p.x + (Math.random() * 2 - 1) * R; z = p.z + (Math.random() * 2 - 1) * R;
        y = p.y + 8 + Math.random() * 14;
        this.rainFloor[i] = this.world.surfaceY(Math.floor(x), Math.floor(z)) + 1;
        if (this.rainFloor[i] > y) y = -1000;
        else if (!this.snowMode && Math.random() < 0.08 && this.rainFloor[i] > p.y - 8) this.particles.emit(x, this.rainFloor[i] + 0.05, z, [160, 180, 220], 1, 1, 10, 0.25, 0);
      }
      rp[o] = x; rp[o + 1] = y; rp[o + 2] = z;
      rp[o + 3] = x - drift * 0.02; rp[o + 4] = y + len; rp[o + 5] = z;
    }
    (this.rainLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }

  updateCamera(dt: number) {
    const e = this.eye();
    const bobOn = this.settings.bobbing ? this.bob : 0;
    const ph = this.walkDist * 1.9;
    e.y += Math.abs(Math.sin(ph)) * 0.07 * bobOn;
    const side = Math.cos(ph) * 0.04 * bobOn;
    e.x += Math.cos(this.yaw) * side; e.z -= Math.sin(this.yaw) * side;
    if (this.shake > 0) e.add(new THREE.Vector3((Math.random() - 0.5) * this.shake * 0.3, (Math.random() - 0.5) * this.shake * 0.3, (Math.random() - 0.5) * this.shake * 0.3));
    this.camera.position.copy(e);
    this.camera.rotation.set(this.pitch, this.yaw, (this.hurtTime > 0.5 ? (this.hurtTime - 0.5) * 0.12 : 0) + Math.cos(ph) * 0.004 * bobOn);
    const fovT = this.settings.fov * (this.sprinting ? 1.12 : 1) * (this.flying && this.sprinting ? 1.05 : 1);
    if (Math.abs(this.camera.fov - fovT) > 0.05) { this.camera.fov += (fovT - this.camera.fov) * (1 - Math.exp(-10 * dt)); this.camera.updateProjectionMatrix(); }
  }

  updateHand(dt: number) {
    const held = this.inv[this.selected];
    const id = held?.id ?? 0;
    if (id !== this.handItemId) {
      this.handItemId = id;
      if (this.handObj) this.hand.remove(this.handObj);
      if (id) {
        const o = itemObject(id, 0.4, this.handMat);
        if (!isBlockItem(id) || BLOCKS[id].render === 'cross') { o.rotation.set(0, -Math.PI / 2.4, 0.2); o.scale.setScalar(1.5); }
        else o.rotation.set(0, Math.PI / 4, 0);
        this.handObj = o;
      } else {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.55), new THREE.MeshBasicMaterial({ color: 0xd8a888 }));
        arm.position.set(0.12, -0.12, -0.15); arm.rotation.set(0.5, 0.25, 0);
        this.handObj = arm;
      }
      this.hand.add(this.handObj);
    }
    const lf = this.lightFactor(this.pos.x, this.pos.y + 1.6, this.pos.z);
    this.handObj?.traverse(o => { const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined; if (m?.color) m.color.setScalar(lf * (this.handItemId ? 1 : 0.85)); });
    if (!this.handItemId && this.handObj) ((this.handObj as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setRGB(0.85 * lf, 0.66 * lf, 0.53 * lf);
    const ph = this.walkDist * 1.9;
    const bob = this.settings.bobbing ? this.bob : 0;
    const sw = Math.sin(this.swing * Math.PI);
    this.hand.position.set(0.55 + Math.cos(ph) * 0.03 * bob - sw * 0.15, -0.5 - Math.abs(Math.sin(ph)) * 0.04 * bob - sw * 0.1, -0.85 - sw * 0.1);
    this.hand.rotation.set(-sw * 0.9, sw * 0.3, sw * 0.2);
    void dt;
  }

  render() {
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    if (this.screen === 'none' || this.screen === 'inventory' || this.screen === 'table' || this.screen === 'furnace') {
      this.renderer.clearDepth();
      this.renderer.render(this.handScene, this.handCamera);
    }
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.camera.fov = s.fov; this.camera.updateProjectionMatrix();
    this.audio.setVolume(s.volume);
  }
}

export { ckey };
