// Game orchestrator: renderer, streaming, player, interaction, containers,
// spawning, achievements, persistence and the React UI bridge.
import * as THREE from 'three';
import { B, blockDef, breakSeconds, blockDrops, isReplaceable, type ToolInfo } from './blocks';
import { World, SEA, WORLD_H, chunkKey, posKey, type TileEnt, type FurnaceTile } from './world';
import { buildChunkGeometry, getTerrainMaterials } from './mesher';
import { makeBody, moveBody, raycastVoxel, type Body, type RayHit } from './physics';
import { I, itemDef, mkStack, cloneStack, matchRecipe, SMELTING, SMELT_SECONDS, CREATIVE_BLOCKS, CREATIVE_ITEMS, type Stack } from './items';
import { Inventory, canStack, addToSlots } from './inventory';
import { EntityManager, type MobKind } from './entities';
import { ParticleSystem, Precipitation } from './particles';
import { Sky } from './sky';
import { Sfx } from './audio';
import { initTextures, getWaterTexture, getLavaTexture, getCrackTextures, getItemIcon, getTileMaterial } from './textures';
import { listWorlds, saveWorldData, loadWorldData, deleteWorld, registerWorld, loadSettings, saveSettings, emptyStats, type Settings, type Stats, type WorldMeta, type SaveData } from './save';
import { stringSeed, clamp } from './noise';

export type Screen = 'title' | 'loading' | 'playing' | 'paused' | 'inventory' | 'crafting' | 'furnace' | 'chest' | 'dead';
export type SlotList = 'inv' | 'craft' | 'result' | 'furnace' | 'chest' | 'creative';

export interface Toast { id: number; title: string; desc: string; icon: number; until: number }

export interface UIState {
  screen: Screen;
  hp: number; hunger: number; air: number;
  hotbar: (Stack | null)[]; mainInv: (Stack | null)[];
  selected: number; carry: Stack | null;
  craft: (Stack | null)[]; craftW: number; craftResult: Stack | null;
  furnace: { slots: (Stack | null)[]; burnFrac: number; cookFrac: number } | null;
  chest: (Stack | null)[] | null;
  mode: 'survival' | 'creative';
  creativePalette: number[];
  day: number; timeLabel: string; isNight: boolean; weather: string; biome: string;
  pos: { x: number; y: number; z: number };
  fps: number; chunkCount: number;
  toasts: Toast[];
  hint: string | null;
  lockNeeded: boolean;
  hurtFlash: number;
  underwater: boolean; inLavaView: boolean;
  fly: boolean;
  heldName: string; heldNameAt: number;
  deathCause: string;
  loading: { pct: number; label: string } | null;
  worlds: WorldMeta[];
  worldName: string;
  settings: Settings;
  stats: Stats;
  debug: boolean;
  minimapOn: boolean;
}

const ACHIEVEMENTS: Record<string, { title: string; desc: string; icon: number }> = {
  wood: { title: 'Getting Wood', desc: 'Punch a tree until a log pops out', icon: B.Log },
  bench: { title: 'Benchmarking', desc: 'Craft a crafting table', icon: B.CraftingTable },
  pick: { title: 'Time to Mine!', desc: 'Craft a pickaxe', icon: I.WoodPick },
  furnace: { title: 'Hot Topic', desc: 'Build a furnace from cobblestone', icon: B.Furnace },
  iron: { title: 'Acquire Hardware', desc: 'Smelt an iron ingot', icon: I.IronIngot },
  diamond: { title: 'Diamonds!', desc: 'Unearth a diamond', icon: I.Diamond },
  monster: { title: 'Monster Hunter', desc: 'Slay a creature of the night', icon: I.IronSword },
  chef: { title: 'Master Chef', desc: 'Eat a cooked meal', icon: I.Steak },
  torch: { title: 'Let There Be Light', desc: 'Place a torch', icon: B.Torch },
  deep: { title: 'The Deep Dark', desc: 'Descend below y=12', icon: B.DiamondOre },
  architect: { title: 'Architect', desc: 'Place 150 blocks', icon: B.StoneBricks },
  chest: { title: 'Treasure Hunter', desc: 'Open a chest', icon: B.Chest },
};

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private sky: Sky;
  private particles: ParticleSystem;
  private precip: Precipitation;
  private sfx = new Sfx();
  private world: World | null = null;
  private entities: EntityManager | null = null;

  private chunkMeshes = new Map<number, THREE.Group>();
  private body: Body = makeBody(new THREE.Vector3(0.5, 40, 0.5), 0.3, 1.8);
  private yaw = 0; private pitch = -0.1;
  private hp = 20; private hunger = 20; private air = 10;
  private inv = new Inventory();
  private carry: Stack | null = null;
  mode: 'survival' | 'creative' = 'survival';
  private fly = false;
  private spawnPoint = new THREE.Vector3(0.5, 40, 0.5);

  screen: Screen = 'title';
  private meta: WorldMeta | null = null;
  private settings: Settings = loadSettings();
  private stats: Stats = emptyStats();
  private achievements = new Set<string>();
  private toasts: Toast[] = [];
  private toastId = 1;

  private keys = new Set<string>();
  private locked = false;
  private suppressPause = false;
  private mouseL = false; private mouseR = false;
  private breakTarget: string | null = null;
  private breakProgress = 0;
  private digSoundT = 0;
  private placeRepeatT = 0;
  private attackRepeatT = 0;
  private swingT = 1;
  private eatT = -1;
  private bobPhase = 0;
  private stepAcc = 0;
  private fallStartY: number | null = null;
  private wasInWater = false;
  private hurtFlash = 0;
  private shake = 0;
  private lastDamageCause = 'Was slain';
  private fovCurrent: number;

  private highlight: THREE.LineSegments;
  private crackMesh: THREE.Mesh;
  private crackMats: THREE.MeshBasicMaterial[];
  private handGroup = new THREE.Group();
  private handItemId = -999;
  private handTexCache = new Map<number, THREE.Texture>();

  private containerPos: { x: number; y: number; z: number } | null = null;
  private craft2: (Stack | null)[] = new Array(4).fill(null);
  private craft3: (Stack | null)[] = new Array(9).fill(null);
  private craftResult: { out: Stack; consume: number[] } | null = null;
  private hoverSlot: { list: SlotList; index: number } | null = null;

  private streamQueue: { cx: number; cz: number; d: number }[] = [];
  private lastPCX = 99999; private lastPCZ = 99999;
  private unloadT = 0;
  private spawnT = 2;
  private autosaveT = 0;
  private uiT = 0;
  private uiDirty = true;
  private ambientFxT = 0;
  private fpsEma = 60;
  private loadingSince = 0;
  private menuMode = true;
  private menuCenter = new THREE.Vector3(0.5, 40, 0.5);
  private menuAngle = 0;
  private time = 0;
  private debug = false;
  private heldName = ''; private heldNameAt = 0;
  private pickupSfxT = 0;
  private disposed = false;

  constructor(private container: HTMLElement, private onUI: (s: UIState) => void) {
    initTextures();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.quality));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(this.settings.fov, container.clientWidth / container.clientHeight, 0.08, 900);
    this.fovCurrent = this.settings.fov;
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog(0xa8c8e8, 40, 120);
    this.sky = new Sky(this.scene);
    this.sky.onThunder = () => this.sfx.thunder();
    this.sky.setCloudsVisible(this.settings.clouds);
    this.particles = new ParticleSystem(this.scene);
    this.precip = new Precipitation(this.scene);
    this.sfx.setVolume(this.settings.volume);
    this.sfx.musicOn = this.settings.music;
    getTerrainMaterials();

    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.65 }),
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.crackMats = getCrackTextures().map(t => new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), this.crackMats[0]);
    this.crackMesh.visible = false; this.crackMesh.renderOrder = 3;
    this.scene.add(this.crackMesh);
    this.camera.add(this.handGroup);
    this.handGroup.position.set(0.55, -0.55, -0.85);

    this.attachInput();
    this.enterMenuWorld();
    this.onResize();
    this.loop();
  }

  // ---------------- world lifecycle ----------------
  private setupWorld(seed: number, saved?: SaveData) {
    this.teardownWorld();
    const world = new World(seed);
    if (saved) {
      for (const [k, entries] of saved.edits) world.edits.set(k, new Map(entries));
      for (const [k, t] of saved.tiles) world.tiles.set(k, t);
    }
    world.hooks.onPopBlock = (x, y, z, id) => {
      for (const d of blockDrops(id, null, Math.random)) this.entities?.spawnDrop(x + 0.5, y + 0.3, z + 0.5, { id: d.id, count: d.count });
    };
    world.hooks.onTileRemoved = (x, y, z, tile) => this.spillTile(x, y, z, tile);
    this.world = world;
    this.entities = new EntityManager(world, this.scene, this.sfx, this.particles, {
      damagePlayer: (n, from) => this.damagePlayer(n, from, 'Slain by a creature of the night'),
      tryPickup: (st) => this.tryPickup(st),
      onExplosion: (pos, r) => this.explode(pos, r),
      onMobDeath: (kind, _pos, byPlayer) => {
        if (byPlayer) { this.stats.kills++; if (kind === 'zombie' || kind === 'creeper') this.unlock('monster'); }
      },
    });
    this.lastPCX = 99999; this.streamQueue = [];
  }

  private teardownWorld() {
    for (const [, g] of this.chunkMeshes) {
      this.scene.remove(g);
      g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    }
    this.chunkMeshes.clear();
    this.entities?.clearAll();
    this.particles.clear();
    this.carry = null;
    this.craft2.fill(null); this.craft3.fill(null);
    this.containerPos = null;
  }

  private enterMenuWorld() {
    this.menuMode = true;
    const worlds = listWorlds();
    const seed = worlds[0]?.seed ?? 20240607;
    this.setupWorld(seed);
    const sp = this.world!.findSpawn();
    this.menuCenter.set(sp.x, sp.y, sp.z);
    // pre-generate the immediate vista so the title backdrop is never a void
    const mcx = Math.floor(sp.x / 16), mcz = Math.floor(sp.z / 16);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) this.world!.generateChunk(mcx + dx, mcz + dz);
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) this.buildChunkMesh(mcx + dx, mcz + dz);
    this.world!.dirtyChunks.clear();
    this.screen = 'title';
    this.sky.time = 0.06;
    this.uiDirty = true;
  }

  newWorld(name: string, seedText: string, mode: 'survival' | 'creative') {
    this.sfx.ensure();
    const seed = seedText.trim() === '' ? (Math.random() * 1e9) | 0 : (/^-?\d+$/.test(seedText.trim()) ? parseInt(seedText.trim()) | 0 : stringSeed(seedText.trim()));
    const meta: WorldMeta = {
      id: `${Date.now().toString(36)}${((Math.random() * 1e6) | 0).toString(36)}`,
      name: name.trim() || 'My World', seed, mode, created: Date.now(), lastPlayed: Date.now(),
    };
    registerWorld(meta);
    this.beginWorld(meta, undefined);
  }

  loadWorldById(id: string) {
    this.sfx.ensure();
    const data = loadWorldData(id);
    const meta = listWorlds().find(w => w.id === id);
    if (!meta) return;
    this.beginWorld({ ...meta }, data ?? undefined);
  }

  deleteWorldById(id: string) { deleteWorld(id); this.uiDirty = true; }

  private beginWorld(meta: WorldMeta, saved?: SaveData) {
    this.meta = meta;
    this.mode = meta.mode;
    this.setupWorld(meta.seed, saved);
    this.menuMode = false;
    this.inv = new Inventory();
    this.hp = 20; this.hunger = 20; this.air = 10; this.fly = false;
    this.achievements = new Set(saved?.achievements ?? []);
    this.stats = saved?.stats ?? emptyStats();
    this.sky.time = saved?.time ?? 0.03;
    this.sky.dayCount = saved?.dayCount ?? 1;
    const w = this.world!;
    if (saved) {
      this.spawnPoint.set(saved.spawn.x, saved.spawn.y, saved.spawn.z);
      this.body = makeBody(new THREE.Vector3(saved.player.x, saved.player.y, saved.player.z), 0.3, 1.8);
      this.yaw = saved.player.yaw; this.pitch = saved.player.pitch;
      this.hp = saved.player.hp; this.hunger = saved.player.hunger; this.fly = saved.player.fly;
      this.inv.deserialize(saved.inventory);
      this.inv.selected = clamp(saved.selected | 0, 0, 8);
    } else {
      const sp = w.findSpawn();
      this.spawnPoint.set(sp.x, sp.y, sp.z);
      this.body = makeBody(new THREE.Vector3(sp.x, sp.y + 0.1, sp.z), 0.3, 1.8);
      this.yaw = Math.PI * 0.25; this.pitch = -0.08;
    }
    this.handItemId = -999;
    this.updateHeldName();
    this.screen = 'loading';
    this.loadingSince = performance.now();
    this.saveNow();
    this.uiDirty = true;
  }

  saveNow() {
    if (!this.meta || !this.world || this.menuMode) return;
    this.meta.lastPlayed = Date.now();
    const data: SaveData = {
      meta: { ...this.meta },
      time: this.sky.time, dayCount: this.sky.dayCount,
      spawn: { x: this.spawnPoint.x, y: this.spawnPoint.y, z: this.spawnPoint.z },
      player: { x: this.body.pos.x, y: this.body.pos.y, z: this.body.pos.z, yaw: this.yaw, pitch: this.pitch, hp: this.hp, hunger: this.hunger, fly: this.fly },
      inventory: this.inv.serialize(), selected: this.inv.selected,
      edits: [...this.world.edits.entries()].map(([k, m]) => [k, [...m.entries()]] as [number, [number, number][]]),
      tiles: [...this.world.tiles.entries()],
      achievements: [...this.achievements],
      stats: { ...this.stats },
    };
    saveWorldData(data);
  }

  toTitle() {
    this.saveNow();
    this.exitLock();
    this.enterMenuWorld();
  }

  respawn() {
    this.hp = 20; this.hunger = 20; this.air = 10;
    this.body.pos.copy(this.spawnPoint); this.body.pos.y += 0.1;
    this.body.vel.set(0, 0, 0);
    this.fly = false;
    this.screen = 'playing';
    this.requestLock();
    this.saveNow();
    this.uiDirty = true;
  }

  // ---------------- input ----------------
  private canvas() { return this.renderer.domElement; }
  private requestLock() {
    try {
      const p = (this.canvas().requestPointerLock as () => unknown).call(this.canvas()) as Promise<void> | undefined;
      if (p && typeof p.catch === 'function') p.catch(() => { /* user can click to lock */ });
    } catch { /* ignore */ }
  }
  private exitLock(suppress = false) {
    this.suppressPause = suppress;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private attachInput() {
    const el = this.canvas();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (!this.locked) {
        this.mouseL = this.mouseR = false;
        this.breakProgress = 0; this.eatT = -1;
        if (this.screen === 'playing' && !this.suppressPause) {
          this.screen = 'paused';
          this.saveNow();
        }
      }
      this.suppressPause = false;
      this.uiDirty = true;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || this.screen !== 'playing') return;
      const s = 0.0021 * this.settings.sensitivity;
      this.yaw -= e.movementX * s;
      this.pitch -= e.movementY * s * (this.settings.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.55, 1.55);
    });
    el.addEventListener('mousedown', (e) => {
      this.sfx.ensure();
      if (this.screen === 'playing' && !this.locked) { this.requestLock(); return; }
      if (!this.locked || this.screen !== 'playing') return;
      if (e.button === 0) { this.mouseL = true; this.swingT = 0; this.tryAttack(); this.attackRepeatT = 0.35; }
      if (e.button === 2) { this.mouseR = true; this.tryUse(true); this.placeRepeatT = 0.24; }
      if (e.button === 1) { e.preventDefault(); this.pickBlock(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.mouseL = false; this.breakProgress = 0; this.breakTarget = null; }
      if (e.button === 2) { this.mouseR = false; this.eatT = -1; }
    });
    el.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('wheel', (e) => {
      if (this.screen !== 'playing') return;
      const d = e.deltaY > 0 ? 1 : -1;
      this.inv.selected = (this.inv.selected + d + 9) % 9;
      this.updateHeldName(); this.uiDirty = true;
    }, { passive: true });
    window.addEventListener('keydown', (e) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      this.keys.add(e.code);
      if (e.code === 'F3') { e.preventDefault(); this.debug = !this.debug; this.uiDirty = true; return; }
      const inContainer = ['inventory', 'crafting', 'furnace', 'chest'].includes(this.screen);
      if (inContainer) {
        if (e.code === 'KeyE' || e.code === 'Escape') { this.closeContainer(); }
        else if (/^Digit[1-9]$/.test(e.code) && this.hoverSlot) {
          const n = parseInt(e.code.slice(5)) - 1;
          this.swapWithHotbar(this.hoverSlot, n);
        }
        return;
      }
      if (this.screen !== 'playing') return;
      if (/^Digit[1-9]$/.test(e.code)) {
        this.inv.selected = parseInt(e.code.slice(5)) - 1;
        this.updateHeldName(); this.uiDirty = true;
      } else if (e.code === 'KeyE') this.openContainer('inventory');
      else if (e.code === 'KeyF') {
        if (this.mode === 'creative') { this.fly = !this.fly; this.body.vel.y = 0; if (this.fly) this.fallStartY = null; this.uiDirty = true; }
        else this.pushToast('Survival Mode', 'Flying is available in Creative worlds (F)', I.Feather);
      }
      else if (e.code === 'KeyQ') this.dropHeld(e.ctrlKey || e.metaKey);
      else if (e.code === 'KeyM') { this.settings.minimap = !this.settings.minimap; this.persistSettings(); }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('beforeunload', () => this.saveNow());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.saveNow(); });
  }

  private onResize = () => {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.particles.setPixelScale(this.renderer.domElement.height, this.camera.fov);
  };

  // ---------------- public UI API ----------------
  resume() {
    this.sfx.ensure();
    if (this.screen === 'paused') { this.screen = 'playing'; this.requestLock(); this.uiDirty = true; }
  }
  pauseGame() {
    if (this.screen === 'playing') { this.screen = 'paused'; this.exitLock(true); this.saveNow(); this.uiDirty = true; }
  }
  setSettings(p: Partial<Settings>) {
    Object.assign(this.settings, p);
    this.persistSettings();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.settings.quality));
    this.sfx.setVolume(this.settings.volume);
    this.sfx.musicOn = this.settings.music;
    this.sky.setCloudsVisible(this.settings.clouds);
    this.lastPCX = 99999; // re-stream
    this.onResize();
  }
  private persistSettings() { saveSettings(this.settings); this.uiDirty = true; }
  clickSfx() { this.sfx.ensure(); this.sfx.click(); }
  setHover(list: SlotList | null, index = 0) { this.hoverSlot = list ? { list, index } : null; }

  // ---------------- containers ----------------
  private openContainer(type: Screen, pos?: { x: number; y: number; z: number }) {
    this.screen = type;
    this.containerPos = pos ?? null;
    this.mouseL = this.mouseR = false; this.eatT = -1;
    this.recomputeCraft();
    this.exitLock(true);
    if (type === 'chest') { this.sfx.chest(); this.unlock('chest'); }
    this.uiDirty = true;
  }
  closeContainer() {
    // return crafting leftovers to inventory
    for (const grid of [this.craft2, this.craft3]) {
      for (let i = 0; i < grid.length; i++) {
        const s = grid[i];
        if (s) { const left = this.inv.add({ ...s }); if (left > 0) this.entities?.spawnDrop(this.body.pos.x, this.body.pos.y + 1, this.body.pos.z, { id: s.id, count: left }); grid[i] = null; }
      }
    }
    if (this.carry) { const left = this.inv.add({ ...this.carry }); if (left > 0) this.entities?.spawnDrop(this.body.pos.x, this.body.pos.y + 1, this.body.pos.z, { id: this.carry.id, count: left }); this.carry = null; }
    this.containerPos = null;
    this.screen = 'playing';
    this.requestLock();
    this.uiDirty = true;
  }

  private activeCraftGrid(): { grid: (Stack | null)[]; w: number } {
    return this.screen === 'crafting' ? { grid: this.craft3, w: 3 } : { grid: this.craft2, w: 2 };
  }
  private recomputeCraft() {
    const { grid, w } = this.activeCraftGrid();
    this.craftResult = matchRecipe(grid, w, w);
  }

  private currentFurnace(): FurnaceTile | null {
    if (!this.containerPos || !this.world) return null;
    const t = this.world.tiles.get(posKey(this.containerPos.x, this.containerPos.y, this.containerPos.z));
    return t?.type === 'furnace' ? t : null;
  }
  private currentChest(): (Stack | null)[] | null {
    if (!this.containerPos || !this.world) return null;
    const t = this.world.tiles.get(posKey(this.containerPos.x, this.containerPos.y, this.containerPos.z));
    return t?.type === 'chest' ? t.slots : null;
  }

  private getSlotArr(list: SlotList): (Stack | null)[] | null {
    switch (list) {
      case 'inv': return this.inv.slots;
      case 'craft': return this.activeCraftGrid().grid;
      case 'chest': return this.currentChest();
      case 'furnace': { const f = this.currentFurnace(); return f ? [f.input, f.fuel, f.output] : null; }
      default: return null;
    }
  }
  private setSlotArr(list: SlotList, index: number, s: Stack | null) {
    if (list === 'furnace') {
      const f = this.currentFurnace(); if (!f) return;
      if (index === 0) f.input = s; else if (index === 1) f.fuel = s; else f.output = s;
      return;
    }
    const arr = this.getSlotArr(list);
    if (arr) arr[index] = s;
  }
  private getSlot(list: SlotList, index: number): Stack | null {
    if (list === 'furnace') {
      const f = this.currentFurnace(); if (!f) return null;
      return index === 0 ? f.input : index === 1 ? f.fuel : f.output;
    }
    const arr = this.getSlotArr(list);
    return arr ? arr[index] : null;
  }

  private afterSlotChange() { this.recomputeCraft(); this.updateHeldName(); this.uiDirty = true; }

  slotClick(list: SlotList, index: number, button: 0 | 2, shift: boolean) {
    this.sfx.ensure();
    if (list === 'creative') {
      const id = [...CREATIVE_BLOCKS, ...CREATIVE_ITEMS][index];
      if (id === undefined) return;
      const d = itemDef(id);
      if (shift) this.inv.add(mkStack(id, d.maxStack));
      else this.carry = mkStack(id, d.maxStack);
      this.sfx.click();
      this.afterSlotChange();
      return;
    }
    if (list === 'result') { this.takeCraftResult(shift); return; }
    if (list === 'furnace' && index === 2) { this.takeFurnaceOutput(shift); return; }
    if (shift) { this.shiftMove(list, index); this.afterSlotChange(); return; }

    const slot = this.getSlot(list, index);
    if (button === 0) {
      if (!this.carry && slot) { this.carry = slot; this.setSlotArr(list, index, null); }
      else if (this.carry && !slot) { this.setSlotArr(list, index, this.carry); this.carry = null; }
      else if (this.carry && slot) {
        if (canStack(this.carry, slot)) {
          const max = itemDef(slot.id).maxStack;
          const move = Math.min(max - slot.count, this.carry.count);
          slot.count += move; this.carry.count -= move;
          if (this.carry.count <= 0) this.carry = null;
        } else { const tmp = this.carry; this.carry = slot; this.setSlotArr(list, index, tmp); }
      }
    } else {
      if (!this.carry && slot) {
        const take = Math.ceil(slot.count / 2);
        this.carry = { ...slot, count: take };
        slot.count -= take;
        if (slot.count <= 0) this.setSlotArr(list, index, null);
      } else if (this.carry) {
        if (!slot) { this.setSlotArr(list, index, { ...this.carry, count: 1 }); this.carry.count--; }
        else if (canStack(this.carry, slot) && slot.count < itemDef(slot.id).maxStack) { slot.count++; this.carry.count--; }
        if (this.carry && this.carry.count <= 0) this.carry = null;
      }
    }
    this.sfx.click();
    this.afterSlotChange();
  }

  private shiftMove(list: SlotList, index: number) {
    const slot = this.getSlot(list, index);
    if (!slot) return;
    const st = { ...slot };
    let left = st.count;
    if (list === 'inv') {
      const inHotbar = index < 9;
      if (this.screen === 'chest') {
        const chest = this.currentChest();
        if (chest) left = addToSlots(chest, st, [[0, 26]]);
      } else if (this.screen === 'furnace') {
        const f = this.currentFurnace();
        if (f) {
          const targetIsFuel = (itemDef(st.id).fuel ?? 0) > 0;
          const cur = targetIsFuel ? f.fuel : f.input;
          if (!cur) { if (targetIsFuel) f.fuel = { ...st }; else f.input = { ...st }; left = 0; }
          else if (canStack(cur, st)) { const mv = Math.min(itemDef(st.id).maxStack - cur.count, st.count); cur.count += mv; left = st.count - mv; }
        }
      } else if (this.screen === 'crafting' || this.screen === 'inventory') {
        left = addToSlots(this.inv.slots, st, inHotbar ? [[9, 35]] : [[0, 8]]);
      } else left = addToSlots(this.inv.slots, st, inHotbar ? [[9, 35]] : [[0, 8]]);
    } else {
      left = addToSlots(this.inv.slots, st, [[9, 35], [0, 8]]);
    }
    if (left === 0) this.setSlotArr(list, index, null);
    else { const cur = this.getSlot(list, index); if (cur) cur.count = left; }
    this.sfx.click();
  }

  private swapWithHotbar(hover: { list: SlotList; index: number }, hot: number) {
    if (hover.list === 'result' || hover.list === 'creative') return;
    if (hover.list === 'inv' && hover.index === hot) return;
    const a = this.getSlot(hover.list, hover.index);
    const b = this.inv.slots[hot];
    this.setSlotArr(hover.list, hover.index, b ? { ...b } : null);
    this.inv.slots[hot] = a ? { ...a } : null;
    this.afterSlotChange();
  }

  private takeCraftResult(shift: boolean) {
    if (!this.craftResult) return;
    const { grid, w } = this.activeCraftGrid();
    const doCraft = (): boolean => {
      const r = matchRecipe(grid, w, w);
      if (!r) return false;
      for (const i of r.consume) { const s = grid[i]!; s.count--; if (s.count <= 0) grid[i] = null; }
      this.stats.crafted++;
      this.onCrafted(r.out.id);
      return true;
    };
    if (shift) {
      let guard = 0;
      while (guard++ < 64) {
        const r = matchRecipe(grid, w, w);
        if (!r) break;
        const probe = { ...r.out };
        if (addToSlots(this.inv.slots.map(s => (s ? { ...s } : null)), probe, [[0, 35]]) > 0) break;
        if (!doCraft()) break;
        this.inv.add({ ...r.out });
      }
    } else {
      const r = this.craftResult;
      if (this.carry && (!canStack(this.carry, r.out) || this.carry.count + r.out.count > itemDef(r.out.id).maxStack)) return;
      if (!doCraft()) return;
      if (this.carry) this.carry.count += r.out.count;
      else this.carry = { ...r.out };
    }
    this.sfx.craft();
    this.afterSlotChange();
  }

  private onCrafted(id: number) {
    if (id === B.CraftingTable) this.unlock('bench');
    if (id === B.Furnace) this.unlock('furnace');
    const d = itemDef(id);
    if (d.tool === 'pickaxe') this.unlock('pick');
  }

  private takeFurnaceOutput(shift: boolean) {
    const f = this.currentFurnace();
    if (!f || !f.output) return;
    if (shift) {
      const left = this.inv.add({ ...f.output });
      const took = f.output.count - left;
      if (took > 0 && f.output.id === I.IronIngot) this.unlock('iron');
      f.output.count = left;
      if (f.output.count <= 0) f.output = null;
    } else {
      if (this.carry && (!canStack(this.carry, f.output) || this.carry.count + f.output.count > itemDef(f.output.id).maxStack)) return;
      if (f.output.id === I.IronIngot) this.unlock('iron');
      if (this.carry) this.carry.count += f.output.count; else this.carry = { ...f.output };
      f.output = null;
    }
    this.sfx.craft();
    this.afterSlotChange();
  }

  private spillTile(x: number, y: number, z: number, tile: TileEnt) {
    if (!this.entities) return;
    const spill = (s: Stack | null) => { if (s) this.entities!.spawnDrop(x + 0.5, y + 0.5, z + 0.5, { ...s }); };
    if (tile.type === 'chest') tile.slots.forEach(spill);
    else { spill(tile.input); spill(tile.fuel); spill(tile.output); }
  }

  dropCarry() {
    if (!this.carry) return;
    const left = this.inv.add({ ...this.carry });
    if (left > 0) this.entities?.spawnDrop(this.body.pos.x, this.body.pos.y + 1.2, this.body.pos.z, { id: this.carry.id, count: left });
    this.carry = null;
    this.uiDirty = true;
  }

  private dropHeld(all: boolean) {
    const h = this.inv.held();
    if (!h || !this.entities) return;
    const count = all ? h.count : 1;
    const dir = this.lookDir();
    const vel = dir.multiplyScalar(4.5); vel.y += 1.5;
    this.entities.spawnDrop(this.body.pos.x + dir.x * 0.5, this.body.pos.y + 1.4, this.body.pos.z + dir.z * 0.5, { ...h, count }, vel);
    h.count -= count;
    if (h.count <= 0) this.inv.slots[this.inv.selected] = null;
    this.updateHeldName();
    this.uiDirty = true;
  }

  selectSlot(i: number) { this.inv.selected = i; this.updateHeldName(); this.uiDirty = true; }

  // ---------------- helpers ----------------
  private lookDir(): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }
  private eyePos(): THREE.Vector3 {
    const sneak = this.keys.has('KeyC') && !this.fly;
    return _v.set(this.body.pos.x, this.body.pos.y + 1.62 - (sneak ? 0.08 : 0), this.body.pos.z).clone();
  }
  private heldTool(): ToolInfo | null {
    const h = this.inv.held();
    if (!h) return null;
    const d = itemDef(h.id);
    return d.tool ? { type: d.tool, tier: d.tier ?? 0 } : null;
  }
  private updateHeldName() {
    const h = this.inv.held();
    this.heldName = h ? itemDef(h.id).name : '';
    this.heldNameAt = performance.now();
  }
  pushToast(title: string, desc: string, icon: number) {
    this.toasts.push({ id: this.toastId++, title, desc, icon, until: performance.now() + 4200 });
    if (this.toasts.length > 3) this.toasts.shift();
    this.uiDirty = true;
  }
  private unlock(id: string) {
    if (this.achievements.has(id)) return;
    this.achievements.add(id);
    const a = ACHIEVEMENTS[id];
    if (a) { this.pushToast(`Achievement: ${a.title}`, a.desc, a.icon); this.sfx.achievement(); }
  }

  private tryPickup(stack: Stack): number {
    if (this.screen === 'dead') return stack.count;
    const probe = { ...stack };
    const left = this.inv.add(probe);
    if (left < stack.count) {
      if (performance.now() - this.pickupSfxT > 60) { this.sfx.pickup(); this.pickupSfxT = performance.now(); }
      if (stack.id === I.Diamond) this.unlock('diamond');
      if (stack.id === I.IronIngot) this.unlock('iron');
      this.updateHeldName();
      this.uiDirty = true;
    }
    return left;
  }

  damagePlayer(n: number, from?: THREE.Vector3, cause = 'Was slain') {
    if (this.mode === 'creative' || this.screen === 'dead' || this.menuMode) return;
    this.hp -= n;
    this.hurtFlash++;
    this.shake = Math.min(0.7, this.shake + 0.3 + n * 0.04);
    this.lastDamageCause = cause;
    this.sfx.hurt();
    if (from) {
      _v2.copy(this.body.pos).sub(from); _v2.y = 0;
      if (_v2.lengthSq() > 0.01) { _v2.normalize(); this.body.vel.x += _v2.x * 6; this.body.vel.z += _v2.z * 6; this.body.vel.y = Math.max(this.body.vel.y, 3.2); }
    }
    if (this.hp <= 0) this.die();
    this.uiDirty = true;
  }

  private die() {
    this.stats.deaths++;
    if (this.mode === 'survival' && this.entities) {
      for (let i = 0; i < 36; i++) {
        const s = this.inv.slots[i];
        if (s) this.entities.spawnDrop(this.body.pos.x, this.body.pos.y + 0.6, this.body.pos.z, { ...s });
        this.inv.slots[i] = null;
      }
    }
    this.screen = 'dead';
    this.exitLock(true);
    this.saveNow();
    this.uiDirty = true;
  }

  private explode(center: THREE.Vector3, radius: number) {
    if (!this.world || !this.entities) return;
    const w = this.world;
    const distP = center.distanceTo(this.body.pos);
    this.sfx.explosion(clamp(1.2 - distP / 30, 0.1, 1));
    this.shake = Math.min(1, this.shake + clamp(1 - distP / 22, 0, 0.8));
    this.particles.spawn(center.x, center.y, center.z, { count: 70, color: ['#5a5a5a', '#8a8a8a', '#e25822', '#ffc93f'], speed: 7, up: 2, gravity: 5, life: 1.1, size: 0.2, spread: 0.8 });
    const r = Math.ceil(radius);
    const cx = Math.floor(center.x), cy = Math.floor(center.y), cz = Math.floor(center.z);
    for (let x = cx - r; x <= cx + r; x++) for (let yv = cy - r; yv <= cy + r; yv++) for (let z = cz - r; z <= cz + r; z++) {
      if (yv < 1 || yv >= WORLD_H) continue;
      const d = Math.hypot(x + 0.5 - center.x, yv + 0.5 - center.y, z + 0.5 - center.z);
      if (d > radius * (0.72 + Math.random() * 0.4)) continue;
      const id = w.getBlock(x, yv, z);
      if (id === B.Air || id === B.Water || id === B.Lava) continue;
      const def = blockDef(id);
      if (!isFinite(def.hardness) || def.hardness > 2.2) continue;
      const tile = w.tiles.get(posKey(x, yv, z));
      if (tile) { this.spillTile(x, yv, z, tile); w.tiles.delete(posKey(x, yv, z)); }
      w.setBlockRaw(x, yv, z, B.Air, true);
      w.queueRelight(x, yv, z);
      if (Math.random() < 0.25) for (const dr of blockDrops(id, null, Math.random)) this.entities.spawnDrop(x + 0.5, yv + 0.4, z + 0.5, { id: dr.id, count: dr.count });
    }
    // entities & player
    this.entities.explosionDamage(center, radius, 16);
    if (distP < radius * 2.1) {
      const dmg = Math.round(15 * Math.pow(1 - distP / (radius * 2.1), 1.4));
      _v2.copy(this.body.pos).sub(center).normalize();
      this.body.vel.addScaledVector(_v2, 11 * (1 - distP / (radius * 2.1)));
      this.body.vel.y += 4.5 * (1 - distP / (radius * 2.1));
      if (dmg > 0) this.damagePlayer(dmg, undefined, 'Blown up by a creeper');
    }
  }

  // ---------------- interaction ----------------
  private currentHit(): RayHit | null {
    if (!this.world) return null;
    return raycastVoxel(this.world, this.eyePos(), this.lookDir(), this.mode === 'creative' ? 7 : 5.2);
  }

  private tryAttack() {
    if (!this.entities || this.screen !== 'playing') return;
    const eye = this.eyePos(); const dir = this.lookDir();
    const mobHit = this.entities.raycast(eye, dir, this.mode === 'creative' ? 6 : 4.6);
    const blockHit = this.currentHit();
    if (mobHit && (!blockHit || mobHit.dist < blockHit.dist)) {
      const held = this.inv.held();
      const d = held ? itemDef(held.id) : null;
      let dmg = d ? d.damage : 1;
      const crit = !this.body.onGround && this.body.vel.y < -2.5 && !this.fly;
      if (crit) { dmg = Math.round(dmg * 1.5); this.particles.spawn(mobHit.mob.body.pos.x, mobHit.mob.body.pos.y + 1, mobHit.mob.body.pos.z, { count: 10, color: '#ffd75e', speed: 1.6, gravity: 2, life: 0.4, size: 0.07 }); }
      this.entities.damageMob(mobHit.mob, dmg, this.body.pos, true);
      this.sfx.mobHit();
      if (this.mode === 'survival' && d?.tool) {
        if (this.inv.damageHeld(d.tool === 'sword' ? 1 : 2)) { this.sfx.toolBreak(); this.updateHeldName(); }
      }
      this.uiDirty = true;
    }
  }

  private tryUse(first: boolean) {
    if (!this.world || this.screen !== 'playing') return;
    const hit = this.currentHit();
    const held = this.inv.held();
    const sneaking = this.keys.has('KeyC');
    if (first && hit && !sneaking) {
      if (hit.id === B.CraftingTable) { this.openContainer('crafting', hit); return; }
      if (hit.id === B.Furnace) { this.openContainer('furnace', hit); return; }
      if (hit.id === B.Chest) { this.openContainer('chest', hit); return; }
    }
    if (!held) return;
    const d = itemDef(held.id);
    // eat
    if (d.food && (this.hunger < 20 || this.mode === 'creative')) {
      if (first) { this.eatT = 0; this.sfx.eat(); }
      return;
    }
    if (!hit || d.placeBlock === undefined) return;
    this.placeBlock(hit, d.placeBlock);
  }

  private placeBlock(hit: RayHit, blockId: number) {
    const w = this.world!;
    const x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (y < 1 || y >= WORLD_H) return;
    const target = w.getBlock(x, y, z);
    if (!isReplaceable(target)) return;
    const def = blockDef(blockId);
    if (def.shape === 'cross' || def.shape === 'cactus') {
      if (hit.ny !== 1) return;
      const below = w.getBlock(x, y - 1, z);
      if (def.support === 'soil' && !(below === B.Grass || below === B.Dirt || below === B.SnowyGrass)) return;
      if (def.support === 'sand' && !(below === B.Sand || below === B.Sandstone || below === B.Cactus)) return;
      if (def.support === 'any' && !blockDef(below).solid) return;
    }
    if (def.solid) {
      // don't suffocate the player
      const p = this.body.pos;
      if (aabbHitsSolidAtCell(x, y, z, p.x - 0.3, p.y, p.z - 0.3, p.x + 0.3, p.y + 1.8, p.z + 0.3)) return;
    }
    w.setBlock(x, y, z, blockId);
    this.sfx.place(def.sound);
    this.swingT = 0;
    this.stats.placed++;
    if (this.stats.placed >= 150) this.unlock('architect');
    if (blockId === B.Torch) this.unlock('torch');
    if (this.mode === 'survival') {
      this.inv.consumeHeld(1);
      this.updateHeldName();
    }
    this.uiDirty = true;
  }

  private pickBlock() {
    const hit = this.currentHit();
    if (!hit) return;
    const id = hit.id;
    if (id === B.Grass) { /* pick grass block itself */ }
    const slot = this.inv.slots.findIndex(s => s && s.id === id);
    if (slot >= 0 && slot < 9) { this.inv.selected = slot; }
    else if (slot >= 9) {
      const tmp = this.inv.slots[this.inv.selected];
      this.inv.slots[this.inv.selected] = this.inv.slots[slot];
      this.inv.slots[slot] = tmp;
    } else if (this.mode === 'creative') {
      this.inv.slots[this.inv.selected] = mkStack(id, 64);
    } else return;
    this.updateHeldName();
    this.uiDirty = true;
  }

  private breakBlockAt(hit: RayHit) {
    const w = this.world!;
    const id = hit.id;
    if (id === B.Bedrock && this.mode === 'survival') return;
    const tool = this.heldTool();
    w.setBlock(hit.x, hit.y, hit.z, B.Air);
    this.particles.burstBlock(hit.x, hit.y, hit.z, id);
    this.sfx.breakBlock(blockDef(id).sound);
    this.stats.mined++;
    if (this.mode === 'survival') {
      for (const d of blockDrops(id, tool, Math.random)) {
        this.entities?.spawnDrop(hit.x + 0.5, hit.y + 0.35, hit.z + 0.5, { id: d.id, count: d.count });
      }
      const t = this.heldTool();
      if (t && this.inv.damageHeld(1)) { this.sfx.toolBreak(); this.updateHeldName(); }
      this.exhaust(0.012);
    }
    if (id === B.Log || id === B.BirchLog || id === B.PineLog) this.unlock('wood');
    if (id === B.DiamondOre) this.unlock('diamond');
    this.breakProgress = 0; this.breakTarget = null;
    this.uiDirty = true;
  }

  private exhaustAmt = 0;
  private exhaust(n: number) {
    if (this.mode === 'creative') return;
    this.exhaustAmt += n;
    while (this.exhaustAmt >= 1) { this.exhaustAmt -= 1; this.hunger = Math.max(0, this.hunger - 1); this.uiDirty = true; }
  }

  // ---------------- spawning ----------------
  private updateSpawning(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT > 0 || !this.world || !this.entities) return;
    this.spawnT = 1.1;
    const w = this.world, p = this.body.pos;
    const tryPos = (minD: number, maxD: number) => {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      return { x: Math.floor(p.x + Math.cos(a) * d), z: Math.floor(p.z + Math.sin(a) * d) };
    };
    // animals by day on grass
    if (this.entities.countAnimals() < 11) {
      for (let i = 0; i < 3; i++) {
        const { x, z } = tryPos(26, 54);
        if (!w.hasChunk(x >> 4, z >> 4)) continue;
        const y = w.heightAt(x, z);
        if (w.getBlock(x, y, z) !== B.Grass || y <= SEA) continue;
        const kinds: MobKind[] = ['pig', 'cow', 'sheep', 'chicken'];
        const kind = kinds[(Math.random() * kinds.length) | 0];
        const n = 1 + ((Math.random() * 3) | 0);
        for (let j = 0; j < n; j++) this.entities.spawnMob(kind, x + 0.5 + (Math.random() - 0.5) * 3, y + 1.05, z + 0.5 + (Math.random() - 0.5) * 3);
        break;
      }
    }
    // hostiles in darkness
    const dark = this.sky.dayFactor < 0.32 || p.y < SEA - 8;
    if (dark && this.entities.countHostiles() < 7) {
      for (let i = 0; i < 4; i++) {
        const { x, z } = tryPos(24, 48);
        if (!w.hasChunk(x >> 4, z >> 4)) continue;
        let y = w.heightAt(x, z);
        if (p.y < SEA - 8) {
          // cave spawn near player level: find air pocket with floor
          let found = -1;
          for (let yy = Math.floor(p.y) + 6; yy > Math.floor(p.y) - 8 && yy > 2; yy--) {
            if (w.getBlock(x, yy, z) === B.Air && w.getBlock(x, yy + 1, z) === B.Air && blockDef(w.getBlock(x, yy - 1, z)).solid) { found = yy; break; }
          }
          if (found < 0) continue;
          y = found - 1;
        }
        const top = w.getBlock(x, y, z);
        if (!blockDef(top).solid || top === B.Leaves || top === B.PineLeaves) continue;
        const lp = w.getLightPacked(x, y + 1, z);
        const effSun = (lp >> 4) / 15 * this.sky.dayFactor;
        if (effSun > 0.3 || (lp & 15) > 6) continue;
        this.entities.spawnMob(Math.random() < 0.62 ? 'zombie' : 'creeper', x + 0.5, y + 1.05, z + 0.5);
        break;
      }
    }
  }

  // ---------------- furnaces ----------------
  private updateFurnaces(dt: number) {
    if (!this.world) return;
    for (const [key, t] of this.world.tiles) {
      if (t.type !== 'furnace') continue;
      const result = t.input ? SMELTING.get(t.input.id) : undefined;
      const canSmelt = !!t.input && result !== undefined && (!t.output || (t.output.id === result && t.output.count < 64));
      if (t.burn > 0) t.burn -= dt;
      if (t.burn <= 0 && canSmelt && t.fuel) {
        const fv = itemDef(t.fuel.id).fuel ?? 0;
        if (fv > 0) { t.burn = t.burnMax = fv; t.fuel.count--; if (t.fuel.count <= 0) t.fuel = null; }
      }
      if (t.burn > 0 && canSmelt) {
        t.cook += dt;
        if (t.cook >= SMELT_SECONDS) {
          t.cook = 0;
          t.input!.count--; if (t.input!.count <= 0) t.input = null;
          if (t.output) t.output.count++; else t.output = { id: result!, count: 1 };
          if (result === I.IronIngot) this.unlock('iron');
        }
      } else t.cook = Math.max(0, t.cook - dt * 2);
      void key;
    }
    if (this.screen === 'furnace') this.uiDirty = true;
  }

  // ---------------- player update ----------------
  private updatePlayer(dt: number, inputEnabled: boolean) {
    const b = this.body;
    const w = this.world!;
    const inWaterBefore = b.inWater;
    const sneak = inputEnabled && this.keys.has('KeyC') && !this.fly;
    const sprintKey = inputEnabled && this.keys.has('ShiftLeft');
    const canSprint = this.mode === 'creative' || this.hunger > 6;
    const sprinting = sprintKey && canSprint && inputEnabled && this.keys.has('KeyW');

    let ix = 0, iz = 0;
    if (inputEnabled) {
      if (this.keys.has('KeyW')) iz -= 1;
      if (this.keys.has('KeyS')) iz += 1;
      if (this.keys.has('KeyA')) ix -= 1;
      if (this.keys.has('KeyD')) ix += 1;
    }
    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    const wishX = (ix * cos - iz * sin);
    const wishZ = (-ix * sin - iz * cos);
    // note: forward is -z in yaw frame; iz=-1 => forward
    const fwdX = -sin, fwdZ = -cos;
    const rightX = cos, rightZ = -sin;
    const moveX = rightX * ix + fwdX * -iz;
    const moveZ = rightZ * ix + fwdZ * -iz;
    void wishX; void wishZ;

    let speed = 4.3;
    if (this.fly) speed = sprintKey ? 19 : 11;
    else if (sprinting) speed = 5.9;
    else if (sneak) speed = 1.5;
    if (b.inWater && !this.fly) speed = 2.7;
    if (this.eatT >= 0) speed *= 0.45;

    const accelRate = this.fly ? 6 : b.onGround ? 13 : 2.4;
    const t = 1 - Math.exp(-accelRate * dt);
    let tx = moveX * speed, tz = moveZ * speed;
    // sneak edge protection: don't walk off a ledge
    if (sneak && b.onGround && !b.inWater) {
      const nx = b.pos.x + tx * dt * 3, nz = b.pos.z + tz * dt * 3;
      const gy = (x: number, z: number) => {
        for (let y = Math.floor(b.pos.y) + 1; y >= Math.floor(b.pos.y) - 2; y--)
          if (w.isSolidPhys(Math.floor(x), y, Math.floor(z))) return y;
        return -99;
      };
      if (gy(nx, nz) < Math.floor(b.pos.y) - 1) { tx = 0; tz = 0; }
    }
    b.vel.x += (tx - b.vel.x) * t;
    b.vel.z += (tz - b.vel.z) * t;

    const jump = inputEnabled && this.keys.has('Space');
    if (this.fly) {
      let vy = 0;
      if (jump) vy += 10;
      if (inputEnabled && (this.keys.has('KeyC') || this.keys.has('ShiftLeft'))) vy -= 10;
      b.vel.y += (vy - b.vel.y) * (1 - Math.exp(-8 * dt));
      this.fallStartY = null;
    } else if (b.inWater || b.inLava) {
      b.vel.y -= 7 * dt;
      if (jump) b.vel.y += 26 * dt;
      b.vel.y *= Math.max(0, 1 - 1.6 * dt);
      b.vel.y = clamp(b.vel.y, -4, 3.6);
      this.fallStartY = null;
    } else {
      b.vel.y -= 28 * dt;
      b.vel.y = Math.max(b.vel.y, -52);
      if (jump && b.onGround) { b.vel.y = 8.9; b.onGround = false; }
    }

    const prevY = b.pos.y;
    const prevVelY = b.vel.y;
    const wasGround = b.onGround;
    moveBody(w, b, dt);
    // swim-out assist
    if (inWaterBefore && jump && b.hitWall && !this.fly) b.vel.y = Math.max(b.vel.y, 5.4);

    // splash on water entry
    if (!this.wasInWater && b.inWater && prevVelY < -3) {
      this.sfx.splash(prevVelY < -9);
      this.particles.spawn(b.pos.x, b.pos.y + 0.7, b.pos.z, { count: 18, color: ['#5a90ee', '#cfe6ff'], speed: 2, up: 2.5, gravity: 9, life: 0.55, size: 0.08 });
    }
    this.wasInWater = b.inWater;

    // fall damage
    if (!this.fly && !b.inWater) {
      if (!b.onGround && b.vel.y < 0) {
        if (this.fallStartY === null) this.fallStartY = prevY;
      } else if (b.onGround && this.fallStartY !== null) {
        const fall = this.fallStartY - b.pos.y;
        this.fallStartY = null;
        if (fall > 3.4 && !wasGround) {
          this.particles.burstBlock(Math.floor(b.pos.x), Math.floor(b.pos.y) - 1, Math.floor(b.pos.z), w.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y) - 1, Math.floor(b.pos.z)), 10);
          const dmg = Math.floor(fall - 3.4);
          if (dmg > 0) this.damagePlayer(dmg, undefined, 'Fell from a high place');
        }
      }
      if (b.onGround) this.fallStartY = null;
    }

    // void safety
    if (b.pos.y < -16) {
      b.pos.set(b.pos.x, w.heightAt(Math.floor(b.pos.x), Math.floor(b.pos.z)) + 2, b.pos.z);
      b.vel.set(0, 0, 0);
    }

    // stats + steps + bob
    const hSpeed = Math.hypot(b.vel.x, b.vel.z);
    if (inputEnabled) {
      this.stats.distance += hSpeed * dt;
      if (sprinting && hSpeed > 4) this.exhaust(dt * 0.09);
      if (b.onGround && hSpeed > 0.8) {
        this.bobPhase += dt * hSpeed * 1.7;
        this.stepAcc += hSpeed * dt;
        const stride = sprinting ? 2.9 : 2.2;
        if (this.stepAcc > stride) {
          this.stepAcc = 0;
          const below = w.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.4), Math.floor(b.pos.z));
          this.sfx.step(blockDef(below === B.Air ? B.Grass : below).sound);
        }
      }
    }

    // ---- survival systems ----
    if (this.mode === 'survival' && !this.menuMode) {
      // drowning
      if (b.headInWater) {
        this.air -= dt / 1.35;
        if (this.air <= 0) { this.air = 0; this.drownT = (this.drownT || 0) + dt; if (this.drownT > 1) { this.drownT = 0; this.damagePlayer(1, undefined, 'Drowned'); } }
      } else { this.air = Math.min(10, this.air + dt * 7); this.drownT = 0; }
      // lava
      if (b.inLava) {
        this.lavaT = (this.lavaT || 0) + dt;
        if (Math.random() < dt * 10) this.particles.spawn(b.pos.x, b.pos.y + 1, b.pos.z, { count: 3, color: ['#ff9d2e', '#e25822'], speed: 0.6, up: 2, gravity: -2, life: 0.5, size: 0.12 });
        if (this.lavaT > 0.5) { this.lavaT = 0; this.damagePlayer(3, undefined, 'Tried to swim in lava'); }
      }
      // hunger & regen
      this.hungerT = (this.hungerT || 0) + dt;
      if (this.hungerT > 4) {
        this.hungerT = 0;
        if (this.hunger >= 18 && this.hp < 20) { this.hp = Math.min(20, this.hp + 1); this.exhaust(0.35); }
        else if (this.hunger <= 0 && this.hp > 1) this.damagePlayer(1, undefined, 'Starved to death');
      }
      if (b.pos.y < 12) this.unlock('deep');
    }

    // eating channel
    if (this.eatT >= 0) {
      const held = this.inv.held();
      const d = held ? itemDef(held.id) : null;
      if (!held || !d?.food || !this.mouseR) this.eatT = -1;
      else {
        this.eatT += dt;
        if (Math.random() < dt * 7) {
          const f = this.lookDir();
          this.particles.spawn(b.pos.x + f.x * 0.4, b.pos.y + 1.45, b.pos.z + f.z * 0.4, { count: 2, color: blockDef(B.Dirt).mapColor, speed: 0.5, life: 0.4, size: 0.05, gravity: 6 });
        }
        if (this.eatT >= 1.1) {
          this.eatT = -1;
          this.hunger = Math.min(20, this.hunger + (d.food ?? 0));
          if (held.id === I.CookedPork || held.id === I.Steak || held.id === I.CookedChicken || held.id === I.Bread) this.unlock('chef');
          if (this.mode === 'survival') this.inv.consumeHeld(1);
          if (Math.random() < 0.4) this.sfx.burp();
          this.updateHeldName();
        }
      }
      this.uiDirty = true;
    }

    // FOV sprint kick
    const targetFov = this.settings.fov + (sprinting && hSpeed > 4.5 ? 7 : 0) + (this.fly && sprintKey && hSpeed > 8 ? 6 : 0);
    this.fovCurrent += (targetFov - this.fovCurrent) * Math.min(1, dt * 8);
    if (Math.abs(this.fovCurrent - this.camera.fov) > 0.05) {
      this.camera.fov = this.fovCurrent;
      this.camera.updateProjectionMatrix();
      this.particles.setPixelScale(this.renderer.domElement.height, this.camera.fov);
    }
    void inWaterBefore;
  }
  private drownT = 0; private lavaT = 0; private hungerT = 0;

  // ---------------- chunk streaming ----------------
  private buildChunkMesh(cx: number, cz: number) {
    const w = this.world!;
    const chunk = w.getChunk(cx, cz);
    if (!chunk) return;
    const key = chunkKey(cx, cz);
    const old = this.chunkMeshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
    }
    const geoms = buildChunkGeometry(w, chunk);
    const mats = getTerrainMaterials();
    const group = new THREE.Group();
    group.position.set(cx * 16, 0, cz * 16);
    group.matrixAutoUpdate = false;
    group.updateMatrix();
    const add = (g: THREE.BufferGeometry | null, m: THREE.Material, order: number) => {
      if (!g) return;
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = order;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    };
    add(geoms.opaque, mats.opaque, 0);
    add(geoms.cutout, mats.cutout, 0);
    add(geoms.water, mats.water, 2);
    add(geoms.lava, mats.lava, 2);
    this.scene.add(group);
    this.chunkMeshes.set(key, group);
  }

  private updateStreaming(center: THREE.Vector3, radius: number) {
    const w = this.world!;
    const pcx = Math.floor(center.x / 16), pcz = Math.floor(center.z / 16);
    // remesh geometry-dirty chunks first
    if (w.dirtyChunks.size) {
      let n = 0;
      for (const key of [...w.dirtyChunks]) {
        const cx = (key >> 12) - 2048, cz = (key & 0xfff) - 2048;
        const d = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz));
        w.dirtyChunks.delete(key);
        w.lightDirtyChunks.delete(key);
        if (d <= radius + 2 && w.hasChunk(cx, cz)) {
          this.buildChunkMesh(cx, cz);
          if (++n >= 6) break;
        }
      }
    }
    // then light-only updates at low priority (already-meshed chunks)
    if (w.lightDirtyChunks.size) {
      let n = 0;
      for (const key of [...w.lightDirtyChunks]) {
        const cx = (key >> 12) - 2048, cz = (key & 0xfff) - 2048;
        const d = Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz));
        w.lightDirtyChunks.delete(key);
        if (d <= radius + 1 && this.chunkMeshes.has(key) && !w.dirtyChunks.has(key)) {
          this.buildChunkMesh(cx, cz);
          if (++n >= 2) break;
        }
      }
    }
    if (pcx !== this.lastPCX || pcz !== this.lastPCZ) {
      this.lastPCX = pcx; this.lastPCZ = pcz;
      this.streamQueue = [];
      for (let dz = -radius; dz <= radius; dz++) for (let dx = -radius; dx <= radius; dx++) {
        const cx = pcx + dx, cz = pcz + dz;
        if (Math.hypot(dx, dz) > radius + 0.5) continue;
        if (!w.hasChunk(cx, cz) || !this.chunkMeshes.has(chunkKey(cx, cz)))
          this.streamQueue.push({ cx, cz, d: dx * dx + dz * dz });
      }
      this.streamQueue.sort((a, b) => a.d - b.d);
    }
    let gens = 0, meshes = 0;
    const t0 = performance.now();
    while (this.streamQueue.length && performance.now() - t0 < 9) {
      const { cx, cz } = this.streamQueue[0];
      if (!w.hasChunk(cx, cz)) {
        if (gens >= 3) break;
        w.generateChunk(cx, cz);
        gens++;
      } else if (!this.chunkMeshes.has(chunkKey(cx, cz))) {
        if (meshes >= 4) break;
        this.buildChunkMesh(cx, cz);
        meshes++;
        this.streamQueue.shift();
      } else this.streamQueue.shift();
    }
  }

  private updateUnload(center: THREE.Vector3, radius: number, dt: number) {
    this.unloadT -= dt;
    if (this.unloadT > 0) return;
    this.unloadT = 1.6;
    const pcx = Math.floor(center.x / 16), pcz = Math.floor(center.z / 16);
    for (const [key, g] of [...this.chunkMeshes]) {
      const cx = (key >> 12) - 2048, cz = (key & 0xfff) - 2048;
      if (Math.hypot(cx - pcx, cz - pcz) > radius + 1.6) {
        this.scene.remove(g);
        g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); });
        this.chunkMeshes.delete(key);
      }
    }
    // evict far chunk data to bound memory (edits/tiles persist separately)
    const w = this.world!;
    if (w.chunks.size > 650) {
      const arr = [...w.chunks.entries()].map(([k, c]) => ({ k, c, d: Math.hypot(c.cx - pcx, c.cz - pcz) })).sort((a, b) => b.d - a.d);
      for (const e of arr) {
        if (w.chunks.size <= 550) break;
        if (e.d > radius + 2) w.chunks.delete(e.k);
      }
    }
  }

  // ---------------- ambient fx ----------------
  private updateAmbientFx(dt: number) {
    this.ambientFxT -= dt;
    if (this.ambientFxT > 0 || !this.world) return;
    this.ambientFxT = 0.35;
    const w = this.world, p = this.body.pos;
    let torches = 0;
    for (let i = 0; i < 26 && torches < 5; i++) {
      const x = Math.floor(p.x + (Math.random() - 0.5) * 22);
      const y = Math.floor(p.y + (Math.random() - 0.5) * 10);
      const z = Math.floor(p.z + (Math.random() - 0.5) * 22);
      const id = w.getBlock(x, y, z);
      if (id === B.Torch) {
        torches++;
        this.particles.spawn(x + 0.5, y + 0.72, z + 0.5, { count: 1, color: ['#ffc93f', '#ff9d2e'], speed: 0.08, up: 0.55, gravity: -1.2, life: 0.55, size: 0.07, spread: 0.04 });
        if (Math.random() < 0.4) this.particles.spawn(x + 0.5, y + 0.8, z + 0.5, { count: 1, color: '#6a6a6a', speed: 0.05, up: 0.7, gravity: -0.6, life: 0.9, size: 0.06, spread: 0.04 });
      } else if (id === B.Lava && Math.random() < 0.3) {
        this.particles.spawn(x + 0.5, y + 0.95, z + 0.5, { count: 1, color: ['#ffc93f', '#e25822'], speed: 0.3, up: 1.6, gravity: 4, life: 0.7, size: 0.08, spread: 0.3 });
      }
    }
    // burning furnaces: smoke from chimney-top
    if (this.world) {
      for (const [key, t] of this.world.tiles) {
        if (t.type !== 'furnace' || t.burn <= 0) continue;
        const [x, y, z] = key.split(',').map(Number);
        if (Math.abs(x - p.x) > 20 || Math.abs(z - p.z) > 20) continue;
        this.particles.spawn(x + 0.5, y + 0.75, z + 0.5, { count: 1, color: ['#ff9d2e', '#ffc93f', '#777'], speed: 0.15, up: 0.9, gravity: -0.8, life: 0.7, size: 0.09, spread: 0.15 });
      }
    }
  }

  // ---------------- main loop ----------------
  private lastT = performance.now();
  private loop = () => {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    const now = performance.now();
    let dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;
    if (dt <= 0) dt = 0.001;
    this.time += dt;
    this.fpsEma += ((1 / dt) - this.fpsEma) * 0.05;
    this.stats.playSeconds += this.menuMode ? 0 : dt;

    const inGame = !this.menuMode && this.screen !== 'title';
    const paused = this.screen === 'paused';
    const worldActive = !paused && this.screen !== 'title';
    const streamCenter = this.menuMode ? this.menuCenter : this.body.pos;
    const radius = this.menuMode ? Math.min(5, this.settings.renderDistance) : this.settings.renderDistance;

    if (this.world && worldActive) {
      if (inGame) {
        const inputEnabled = this.screen === 'playing';
        if (this.screen !== 'dead') this.updatePlayer(dt, inputEnabled);
        this.world.tick(dt);
        this.updateFurnaces(dt);
        this.updateInteraction(dt);
        this.entities?.update(dt, this.body.pos, this.sky.dayFactor, this.mode === 'survival' && this.screen !== 'dead');
        this.updateSpawning(dt);
        this.updateAmbientFx(dt);
        this.autosaveT += dt;
        if (this.autosaveT > 12) { this.autosaveT = 0; this.saveNow(); }
      } else if (this.menuMode) {
        this.world.tick(dt);
      }
      this.updateStreaming(streamCenter, radius);
      this.updateUnload(streamCenter, radius, dt);
    }

    // loading completion
    if (this.screen === 'loading') {
      const need = Math.max(1, Math.PI * radius * radius);
      const have = this.chunkMeshes.size;
      if ((have >= need * 0.94 && this.streamQueue.length <= 2) || performance.now() - this.loadingSince > 25000) {
        this.screen = 'playing';
        this.requestLock();
        if (!this.achievements.has('wood')) this.pushToast('Welcome to VoxelCraft', 'Punch a tree to get started. Press E for inventory.', B.Log);
      }
      this.uiDirty = true;
    }

    // camera
    this.updateCamera(dt);
    // sky & environment
    this.sky.update(paused ? 0 : dt, this.camera.position, !paused);
    this.updateFog();
    this.particles.update(paused ? 0 : dt);
    // precipitation
    const pBiome = this.world && inGame ? this.world.biomeInfo(Math.floor(this.body.pos.x), Math.floor(this.body.pos.z)).biome : 'plains';
    const sheltered = inGame && this.world ? (this.world.getLightPacked(Math.floor(this.body.pos.x), Math.floor(this.body.pos.y + 2), Math.floor(this.body.pos.z)) >> 4) < 13 : false;
    this.precip.mode = this.sky.raining && inGame && !sheltered ? (pBiome === 'snow' ? 'snow' : 'rain') : null;
    if (inGame) this.precip.update(dt, this.body.pos);
    else this.precip.mode = null;
    this.sfx.setRain(this.sky.raining && inGame && !sheltered ? this.sky.rainAmount : 0);
    this.sfx.setWind(this.body.pos.y > 55 ? 0.7 : 0.15);
    this.sfx.update(dt, inGame && !paused, this.sky.dayFactor > 0.4, pBiome);

    // water/lava scroll
    const wt = getWaterTexture(); wt.offset.y = (this.time * 0.035) % 1; wt.offset.x = Math.sin(this.time * 0.11) * 0.03;
    const lt = getLavaTexture(); lt.offset.y = (this.time * 0.012) % 1; lt.offset.x = (this.time * 0.006) % 1;

    this.updateHand(dt);
    this.renderer.render(this.scene, this.camera);

    // UI emit
    this.uiT -= dt;
    if (this.uiDirty || this.uiT <= 0) {
      this.uiT = 0.2; this.uiDirty = false;
      this.onUI(this.snapshot());
    }
  };

  private updateInteraction(dt: number) {
    if (this.screen !== 'playing' || !this.world) {
      this.highlight.visible = false; this.crackMesh.visible = false;
      return;
    }
    const hit = this.currentHit();
    if (hit) {
      const def = blockDef(hit.id);
      const isPlant = def.shape === 'cross' || def.shape === 'cactus';
      this.highlight.visible = !isPlant;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else this.highlight.visible = false;

    // breaking
    let cracking = false;
    if (this.mouseL && hit && this.locked) {
      const key = `${hit.x},${hit.y},${hit.z}`;
      // if a mob is closer, attacks take precedence (handled on click + repeat)
      this.attackRepeatT -= dt;
      const mobHit = this.entities?.raycast(this.eyePos(), this.lookDir(), 4.6);
      if (mobHit && mobHit.dist < hit.dist) {
        if (this.attackRepeatT <= 0) { this.tryAttack(); this.attackRepeatT = 0.35; this.swingT = 0; }
      } else {
        if (this.breakTarget !== key) { this.breakTarget = key; this.breakProgress = 0; }
        const secs = this.mode === 'creative' ? 0.01 : breakSeconds(hit.id, this.heldTool());
        if (isFinite(secs)) {
          this.breakProgress += dt / secs;
          cracking = true;
          this.swingT = (this.swingT + dt / 0.3) % 1;
          this.digSoundT -= dt;
          if (this.digSoundT <= 0) { this.digSoundT = 0.23; this.sfx.dig(blockDef(hit.id).sound); }
          if (Math.random() < dt * 6) this.particles.burstBlock(hit.x, hit.y, hit.z, hit.id, 2);
          if (this.breakProgress >= 1) this.breakBlockAt(hit);
        }
      }
    } else if (!this.mouseL) {
      this.breakProgress = 0; this.breakTarget = null;
    }
    if (cracking && hit) {
      const stage = Math.min(4, Math.floor(this.breakProgress * 5));
      this.crackMesh.material = this.crackMats[stage];
      this.crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.crackMesh.visible = true;
    } else this.crackMesh.visible = false;

    // place repeat
    if (this.mouseR && this.locked) {
      this.placeRepeatT -= dt;
      if (this.placeRepeatT <= 0) {
        this.placeRepeatT = 0.24;
        const held = this.inv.held();
        if (held && itemDef(held.id).placeBlock !== undefined) this.tryUse(false);
      }
    }
    if (this.swingT < 1 && !this.mouseL) this.swingT = Math.min(1, this.swingT + dt / 0.3);
  }

  private updateCamera(dt: number) {
    if (this.menuMode) {
      this.menuAngle += dt * 0.045;
      const r = 27;
      const cx = this.menuCenter.x + Math.cos(this.menuAngle) * r;
      const cz = this.menuCenter.z + Math.sin(this.menuAngle) * r;
      const cy = Math.max(this.menuCenter.y + 13, (this.world?.heightAt(Math.floor(cx), Math.floor(cz)) ?? 40) + 9);
      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this.menuCenter.x, this.menuCenter.y + 2, this.menuCenter.z);
      this.handGroup.visible = false;
      return;
    }
    this.handGroup.visible = this.screen !== 'dead';
    const b = this.body;
    const sneak = this.keys.has('KeyC') && !this.fly;
    const bobY = b.onGround && !this.fly && this.screen === 'playing' ? Math.abs(Math.sin(this.bobPhase)) * 0.05 : 0;
    this.camera.position.set(b.pos.x, b.pos.y + 1.62 - (sneak ? 0.08 : 0) + bobY, b.pos.z);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const shX = (Math.random() - 0.5) * this.shake * 0.06;
    const shY = (Math.random() - 0.5) * this.shake * 0.06;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch + shX, this.yaw + shY, 0);
    if (this.screen === 'dead') {
      this.camera.position.y = b.pos.y + 0.4;
      this.camera.rotation.z = 0.7;
    }
  }

  private updateFog() {
    const fog = this.scene.fog as THREE.Fog;
    if (!this.menuMode && this.world) {
      const eye = this.eyePos();
      const eyeBlock = this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z));
      if (eyeBlock === B.Water) { fog.color.setRGB(0.08, 0.22, 0.55); fog.near = 0.5; fog.far = 16; return; }
      if (eyeBlock === B.Lava) { fog.color.setRGB(0.85, 0.3, 0.05); fog.near = 0.1; fog.far = 3.5; return; }
    }
    const R = this.settings.renderDistance * 16;
    const rainCut = 1 - this.sky.rainAmount * 0.35;
    fog.color.copy(this.sky.fogColor);
    fog.near = R * 0.42 * rainCut;
    fog.far = R * 0.98 * rainCut;
  }

  private updateHand(dt: number) {
    if (this.menuMode) return;
    const held = this.inv.held();
    const id = held ? held.id : -1;
    if (id !== this.handItemId) {
      this.handItemId = id;
      while (this.handGroup.children.length) {
        const c = this.handGroup.children.pop()!;
        this.handGroup.remove(c);
        if ((c as THREE.Mesh).isMesh) (c as THREE.Mesh).geometry.dispose();
      }
      let obj: THREE.Object3D;
      if (id === -1) {
        obj = new THREE.Group();
        const hand = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.16), new THREE.MeshBasicMaterial({ color: 0xc8966e }));
        hand.position.y = -0.1; hand.rotation.x = 0.5;
        const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.2, 0.19), new THREE.MeshBasicMaterial({ color: 0x2a7d8a }));
        sleeve.position.set(0, -0.32, 0.08); sleeve.rotation.x = 0.5;
        obj.add(hand, sleeve);
      } else if (id < 256 && blockDef(id).shape === 'cube') {
        const mats = blockDef(id).tiles.map(t => getTileMaterial(t, false));
        obj = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), mats);
      } else {
        let tex = this.handTexCache.get(id);
        if (!tex) {
          const img = new Image(); img.src = getItemIcon(id);
          tex = new THREE.Texture(img);
          tex.magFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
          img.onload = () => { tex!.needsUpdate = true; };
          this.handTexCache.set(id, tex);
        }
        obj = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.52), new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }));
      }
      obj.renderOrder = 10;
      this.handGroup.add(obj);
    }
    // animation
    const hSpeed = Math.hypot(this.body.vel.x, this.body.vel.z);
    const bob = this.body.onGround && this.screen === 'playing' ? Math.min(1, hSpeed / 4) : 0;
    let px = 0.55 + Math.sin(this.bobPhase) * 0.02 * bob;
    let py = -0.55 - Math.abs(Math.cos(this.bobPhase)) * 0.03 * bob;
    let rx = 0.08, ry = -0.5, rz = 0.05;
    if (this.eatT >= 0) {
      px = 0.2; py = -0.42 + Math.sin(this.time * 14) * 0.03;
      rx = -0.7 + Math.sin(this.time * 14) * 0.12; ry = -0.15;
      this.handGroup.position.set(px, py, -0.7);
    } else if (this.swingT < 1) {
      const s = Math.sin(this.swingT * Math.PI);
      rx = 0.08 - s * 1.7;
      py -= s * 0.14;
      px -= s * 0.08;
      this.handGroup.position.set(px, py, -0.85 + s * 0.1);
    } else {
      this.handGroup.position.set(px, py, -0.85);
    }
    this.handGroup.rotation.set(rx, ry, rz);
    void dt;
  }

  // ---------------- minimap ----------------
  drawMinimap(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.world || this.menuMode) return;
    const S = canvas.width;
    const RANGE = 46;
    const px = Math.floor(this.body.pos.x), pz = Math.floor(this.body.pos.z);
    const cell = S / (RANGE * 2);
    ctx.fillStyle = '#0a0f14'; ctx.fillRect(0, 0, S, S);
    const col = new THREE.Color();
    for (let dz = -RANGE; dz < RANGE; dz++) for (let dx = -RANGE; dx < RANGE; dx++) {
      const x = px + dx, z = pz + dz;
      const h = this.world.heightAt(x, z);
      const id = this.world.getBlock(x, h, z);
      let c = blockDef(id).mapColor;
      if (id === B.Water) { const depth = clamp((SEA - (this.world.terrainHeight(x, z))) / 8, 0, 1); col.set('#3f76e4').multiplyScalar(1 - depth * 0.45); c = '#' + col.getHexString(); }
      else {
        const slope = clamp(1 + (h - this.world.heightAt(x - 1, z)) * 0.16, 0.72, 1.28);
        col.set(c).multiplyScalar(slope);
        c = '#' + col.getHexString();
      }
      ctx.fillStyle = c;
      ctx.fillRect((dx + RANGE) * cell, (dz + RANGE) * cell, Math.ceil(cell), Math.ceil(cell));
    }
    // player arrow
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-this.yaw);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-4, 5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // spawn marker
    const sx = (this.spawnPoint.x - this.body.pos.x), sz = (this.spawnPoint.z - this.body.pos.z);
    if (Math.abs(sx) < RANGE && Math.abs(sz) < RANGE) {
      ctx.fillStyle = '#ffd75e';
      ctx.fillRect(S / 2 + sx * cell - 2, S / 2 + sz * cell - 2, 4, 4);
    }
  }

  // ---------------- snapshot ----------------
  private currentHint(): string | null {
    if (this.mode === 'creative' || this.menuMode) return null;
    const has = (id: number) => this.inv.count(id) > 0;
    if (!this.achievements.has('wood') && !has(B.Log) && !has(B.BirchLog) && !has(B.PineLog) && !has(B.Planks))
      return 'Punch a tree trunk (hold Left Click) to gather wood';
    if (!this.achievements.has('bench'))
      return 'Press E to open your inventory — craft Planks, then a Crafting Table';
    if (!this.achievements.has('pick'))
      return 'Place the Crafting Table (Right Click), then craft a Wooden Pickaxe';
    if (!has(B.Torch) && !this.achievements.has('torch'))
      return 'Mine stone & coal, craft torches before night falls';
    if (!this.achievements.has('furnace'))
      return 'Craft a Furnace from 8 cobblestone to smelt ore & cook food';
    if (!this.achievements.has('iron'))
      return 'Dig deep for iron ore. Beware what creeps in the dark…';
    return null;
  }

  private snapshot(): UIState {
    const now = performance.now();
    this.toasts = this.toasts.filter(t => t.until > now);
    const slotsCopy = (arr: (Stack | null)[]) => arr.map(s => cloneStack(s));
    const { grid, w } = this.activeCraftGrid();
    const furnace = this.screen === 'furnace' ? this.currentFurnace() : null;
    const chest = this.screen === 'chest' ? this.currentChest() : null;
    const biome = this.world && !this.menuMode ? this.world.biomeInfo(Math.floor(this.body.pos.x), Math.floor(this.body.pos.z)).biome : 'plains';
    const eye = this.eyePos();
    const eyeBlock = this.world && !this.menuMode ? this.world.getBlock(Math.floor(eye.x), Math.floor(eye.y), Math.floor(eye.z)) : B.Air;
    const need = Math.max(1, Math.PI * this.settings.renderDistance ** 2);
    return {
      screen: this.screen,
      hp: Math.max(0, Math.ceil(this.hp)), hunger: Math.round(this.hunger), air: Math.max(0, this.air),
      hotbar: slotsCopy(this.inv.slots.slice(0, 9)),
      mainInv: slotsCopy(this.inv.slots.slice(9, 36)),
      selected: this.inv.selected,
      carry: cloneStack(this.carry),
      craft: slotsCopy(grid), craftW: w,
      craftResult: this.craftResult ? { ...this.craftResult.out } : null,
      furnace: furnace ? {
        slots: [cloneStack(furnace.input), cloneStack(furnace.fuel), cloneStack(furnace.output)],
        burnFrac: furnace.burnMax > 0 ? furnace.burn / furnace.burnMax : 0,
        cookFrac: furnace.cook / SMELT_SECONDS,
      } : null,
      chest: chest ? slotsCopy(chest) : null,
      mode: this.mode,
      creativePalette: [...CREATIVE_BLOCKS, ...CREATIVE_ITEMS],
      day: this.sky.dayCount, timeLabel: this.sky.timeLabel(), isNight: this.sky.isNight,
      weather: this.sky.raining ? (biome === 'snow' ? 'Snow' : 'Rain') : 'Clear',
      biome,
      pos: { x: Math.floor(this.body.pos.x), y: Math.floor(this.body.pos.y), z: Math.floor(this.body.pos.z) },
      fps: Math.round(this.fpsEma), chunkCount: this.chunkMeshes.size,
      toasts: [...this.toasts],
      hint: this.screen === 'playing' ? this.currentHint() : null,
      lockNeeded: this.screen === 'playing' && !this.locked,
      hurtFlash: this.hurtFlash,
      underwater: eyeBlock === B.Water,
      inLavaView: eyeBlock === B.Lava,
      fly: this.fly,
      heldName: this.heldName, heldNameAt: this.heldNameAt,
      deathCause: this.lastDamageCause,
      loading: this.screen === 'loading' ? { pct: Math.min(99, Math.round((this.chunkMeshes.size / need) * 100)), label: 'Generating terrain…' } : null,
      worlds: this.screen === 'title' ? listWorlds() : [],
      worldName: this.meta?.name ?? '',
      settings: { ...this.settings },
      stats: { ...this.stats },
      debug: this.debug,
      minimapOn: this.settings.minimap,
    };
  }

  dispose() {
    this.disposed = true;
    this.saveNow();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    this.container.removeChild(this.renderer.domElement);
  }
}

function aabbHitsSolidAtCell(cx: number, cy: number, cz: number, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
  return cx + 1 > minX && cx < maxX && cy + 1 > minY && cy < maxY && cz + 1 > minZ && cz < maxZ;
}
