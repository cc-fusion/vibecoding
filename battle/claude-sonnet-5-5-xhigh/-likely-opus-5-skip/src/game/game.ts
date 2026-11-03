// Main engine: lifecycle, game loop, input, interaction, world ticks, rendering, persistence.
import * as THREE from 'three';
import { World } from './world';
import { ChunkManager, createMaterials, U } from './chunks';
import { Terrain, findSpawn, BIOME_NAMES } from './terrain';
import { B, BLOCKS, K, T_KIND, T_SOLID, T_OPAQUE, SEA, CH, TINT_TILE } from './blocks';
import { ITEMDEF, I, RECIPES, ingMatches, blockDrops, miningTime, canHarvest, maxDur, type Stack, type Recipe } from './items';
import { initAtlas, makeCrackTexture, blockColor, TINT_GRASS, TINT_FOLIAGE } from './textures';
import { Sky, Weather } from './sky';
import { Particles } from './particles';
import { AudioEngine } from './audio';
import { Player, type Input } from './player';
import { raycast, type Hit } from './physics';
import { Inventory, newCraft, updateCraft, slotClick, tickFurnace, newFurnace, newChest, autofill, type BlockEntity, type CraftGrid, type Cursor, type SlotKind } from './inventory';
import { Mob, MOBS, Spawner, spawnMob } from './mobs';
import { ItemEntity, Arrow, PrimedTnt, FallingBlock, type Entity } from './entities';
import { itemGeometry, itemMaterial } from './models';
import { openChunkStore, saveWorld, loadSettings, saveSettings, type WorldMeta, type ChunkStore, type Settings } from './storage';

THREE.ColorManagement.enabled = false;

export type Screen = 'none' | 'inventory' | 'table' | 'furnace' | 'chest' | 'pause' | 'death' | 'chat' | 'adv';
export type Phase = 'menu' | 'loading' | 'playing';

export const ACH = [
  { id: 'wood', t: 'Getting Wood', d: 'Punch a tree and collect a log' },
  { id: 'bench', t: 'Benchmarking', d: 'Craft a crafting table' },
  { id: 'pick', t: 'Time to Mine!', d: 'Craft a wooden pickaxe' },
  { id: 'stone', t: 'Stone Age', d: 'Collect cobblestone' },
  { id: 'furnace', t: 'Hot Topic', d: 'Craft a furnace' },
  { id: 'smelt', t: 'Acquire Hardware', d: 'Smelt an iron ingot' },
  { id: 'ironpick', t: "Isn't It Iron Pick", d: 'Craft an iron pickaxe' },
  { id: 'diamond', t: 'DIAMONDS!', d: 'Find a diamond deep underground' },
  { id: 'cook', t: 'Cooking with Fire', d: 'Cook food in a furnace' },
  { id: 'bread', t: 'Baker', d: 'Bake bread from wheat' },
  { id: 'monster', t: 'Monster Hunter', d: 'Defeat a hostile monster' },
  { id: 'deep', t: 'Into the Depths', d: 'Descend below layer 15' },
  { id: 'explorer', t: 'Adventuring Time', d: 'Visit 5 different biomes' },
  { id: 'boom', t: 'Fireworks', d: 'Ignite TNT with Flint and Steel' },
  { id: 'night', t: 'Rise and Shine', d: 'Survive through a night until dawn' },
];

const DAY_LEN = 960;
const dirOf = (yaw: number, pitch: number) => [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];

export class Game {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(75, 1, 0.08, 600);
  handScene = new THREE.Scene();
  handCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
  handGroup = new THREE.Group();
  fog = new THREE.Fog(0xaaccff, 40, 100);
  settings: Settings = loadSettings();
  audio = new AudioEngine();
  atlas = initAtlas();
  mats = createMaterials(this.atlas);
  sky: Sky; weather: Weather; particles: Particles;
  phase: Phase = 'menu'; screen: Screen = 'none';
  world: World | null = null; chunks: ChunkManager | null = null; player: Player | null = null; store: ChunkStore | null = null;
  terrain: Terrain | null = null; meta: WorldMeta | null = null;
  inv = new Inventory(); sel = 0; cursor: Cursor = { stack: null };
  craft2 = newCraft(2, 2); craft3 = newCraft(3, 3); activeCraft: CraftGrid = this.craft2;
  be = new Map<string, BlockEntity>(); openBE: BlockEntity | null = null; openKey = '';
  mobs: Mob[] = []; items: ItemEntity[] = []; arrows: Arrow[] = []; ents: Entity[] = [];
  spawner = new Spawner();
  time = 0; tod = 0.1; days = 0; clockAnim = 0; playTime = 0;
  version = 0; dirtyUI = false; listeners = new Set<() => void>();
  keys = new Set<string>(); mouse = [false, false, false]; locked = false; noLock = false;
  loadText = ''; loadProgress = 0; loadStart = 0; pendingSpawn: { x: number; z: number } | null = null; pendingState: any = null;
  target: Hit | null = null; mineKey = ''; mineProgress = 0; mineTick = 0; mineCool = 0; attackCD = 0; useCD = 0; eatT = 0; swing = 0; swingDir = 0;
  handId = -2; handMesh: THREE.Object3D | null = null; handMat: THREE.MeshBasicMaterial | null = null; equip = 1; handBob = 0;
  outline: THREE.LineSegments; crack: THREE.Mesh; crackTex: THREE.Texture;
  achieved = new Set<string>(); visitedBiomes = new Set<number>(); stats = { mined: 0, killed: 0, deaths: 0, placed: 0 };
  toasts: { id: number; t: string; d: string; at: number }[] = []; chat: { text: string; at: number }[] = [];
  showDebug = false; showMap = true; hideHud = false; fps = 0; dbg: any = {}; frames = 0; fpsT = 0; uiT = 0;
  mapCanvas = document.createElement('canvas'); mapT = 0; mapColors = new Map<number, number[]>();
  saveT = 30; lastSpace = 0; heldTick = 0; lavaNear = false; lavaT = 0; biomeT = 0; sawNight = false;
  menuAngle = 0; menuCenter = { x: 0, z: 0 }; menuTime = 0; selName = ''; selNameT = 0; flash = 0; running = false; raf = 0;
  lastDeathMsg = ''; cmdLock = false;
  rain = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.scene.fog = this.fog;
    this.sky = new Sky(this.scene);
    this.weather = new Weather(this.scene);
    this.particles = new Particles(this.scene, this.atlas);
    this.weather.onSplash = (x, y, z) => this.particles.spawn(x, y, z, (Math.random() - 0.5) * 0.6, 1.6, (Math.random() - 0.5) * 0.6, 0.25, 0.07, 0, 0.7, 0.8, 1, 0.8, 12);
    this.weather.onBolt = () => { const d = 0.6 + Math.random() * 2; setTimeout(() => this.audio.play('thunder', undefined, 1), d * 1000); };
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 }));
    this.outline.visible = false; this.scene.add(this.outline);
    this.crackTex = makeCrackTexture();
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    this.crack.visible = false; this.scene.add(this.crack);
    this.handScene.add(this.handGroup);
    this.mapCanvas.width = this.mapCanvas.height = 80;
    this.noLock = location.hash.includes('nolock');
    this.audio.setVolumes(this.settings.master, this.settings.music, this.settings.sfx);
    this.bindEvents();
    this.resize();
  }

  // ---------- UI plumbing ----------
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  getVersion = () => this.version;
  bump() { this.dirtyUI = true; }
  private flushUI() { if (this.dirtyUI) { this.dirtyUI = false; this.version++; this.listeners.forEach((f) => f()); } }
  get creative() { return this.meta?.mode === 'creative'; }
  say(text: string) { this.chat.push({ text, at: this.time }); if (this.chat.length > 40) this.chat.shift(); this.bump(); }
  toast(t: string, d: string) { this.toasts.push({ id: Math.random(), t, d, at: this.time }); this.bump(); }
  advance(id: string) {
    if (this.achieved.has(id) || this.creative) return;
    const a = ACH.find((x) => x.id === id); if (!a) return;
    this.achieved.add(id); this.toast(a.t, a.d); this.audio.play('achieve', undefined, 0.8);
  }
  heldStack() { return this.inv.slots[this.sel]; }
  applySettings(s: Settings) {
    this.settings = s; saveSettings(s);
    this.audio.setVolumes(s.master, s.music, s.sfx);
    this.chunks?.setRenderDistance(s.renderDist);
    this.bump();
  }

  // ---------- events ----------
  private bindEvents() {
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('keydown', (e) => this.onKey(e, true));
    document.addEventListener('keyup', (e) => this.onKey(e, false));
    this.canvas.addEventListener('mousedown', (e) => this.onMouse(e, true));
    window.addEventListener('mouseup', (e) => this.onMouse(e, false));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.player || this.screen !== 'none' || this.phase !== 'playing') return;
      const s = 0.0022 * this.settings.sens;
      this.player.yaw -= e.movementX * s;
      this.player.pitch = Math.max(-1.55, Math.min(1.55, this.player.pitch - e.movementY * s));
    });
    window.addEventListener('wheel', (e) => {
      if (this.phase !== 'playing' || this.screen !== 'none') return;
      this.sel = (this.sel + (e.deltaY > 0 ? 1 : 8)) % 9; this.onSelect(); 
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked && this.phase === 'playing' && this.screen === 'none' && !this.noLock) this.openScreen('pause');
      this.mouse = [false, false, false];
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse = [false, false, false]; });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.phase === 'playing') this.save(); });
    window.addEventListener('beforeunload', () => { if (this.phase === 'playing') this.save(); });
  }
  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.handCamera.aspect = w / h; this.handCamera.updateProjectionMatrix();
  }
  requestLock() {
    if (this.noLock) { this.locked = true; return; }
    try { const p: any = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }
  }
  private onSelect() {
    const s = this.heldStack();
    this.selName = s ? ITEMDEF[s.id]?.name || '' : ''; this.selNameT = 2; this.equip = 0.4; this.bump();
  }
  private onKey(e: KeyboardEvent, down: boolean) {
    if (this.phase !== 'playing') return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const c = e.code;
    if (!down) { this.keys.delete(c); if (c === 'KeyW') this.wSprint = false; return; }
    if (this.screen === 'chat') return;
    if (c === 'F3') { e.preventDefault(); this.showDebug = !this.showDebug; this.bump(); return; }
    if (c === 'F1') { e.preventDefault(); this.hideHud = !this.hideHud; this.bump(); return; }
    if (c === 'Escape') { if (this.screen !== 'none' && this.screen !== 'pause' && this.screen !== 'death') this.closeScreen(); return; }
    if (this.screen !== 'none') {
      if ((c === 'KeyE' || (c === 'KeyL' && this.screen === 'adv')) && ['inventory', 'table', 'furnace', 'chest', 'adv'].includes(this.screen)) { e.preventDefault(); this.closeScreen(); }
      return;
    }
    if (e.ctrlKey && ['KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(c)) e.preventDefault();
    if (!this.keys.has(c)) {
      this.keys.add(c);
      if (c === 'KeyW') { const t = performance.now(); if (t - this.lastW < 300) this.wSprint = true; this.lastW = t; }
      if (c.startsWith('Digit')) { const n = parseInt(c.slice(5)) - 1; if (n >= 0 && n < 9) { this.sel = n; this.onSelect(); } }
      else if (c === 'KeyE') { e.preventDefault(); this.openScreen('inventory'); }
      else if (c === 'KeyQ') this.dropHeld(e.ctrlKey);
      else if (c === 'KeyT' || c === 'Slash') { e.preventDefault(); this.openScreen('chat'); }
      else if (c === 'KeyM') { this.showMap = !this.showMap; this.bump(); }
      else if (c === 'KeyL') this.openScreen('adv');
      else if (c === 'Space' && this.creative) {
        const t = performance.now();
        if (t - this.lastSpace < 280 && this.player) { this.player.flying = !this.player.flying; this.player.body.vy = 0; }
        this.lastSpace = t;
      } else if (c === 'KeyF' && this.creative && this.player) this.player.flying = !this.player.flying;
    }
    if (c === 'Space' || c === 'Tab') e.preventDefault();
  }
  private onMouse(e: MouseEvent, down: boolean) {
    if (this.phase !== 'playing') return;
    if (down) {
      this.audio.init();
      if (!this.locked && (this.screen === 'none' || this.screen === 'pause') && !this.noLock) { this.resume(); return; }
      if (this.screen !== 'none') return;
      this.mouse[e.button] = true;
      if (e.button === 2) { this.useCD = 0; this.rightClick = true; }
      if (e.button === 1) this.pickBlock();
    } else this.mouse[e.button] = false;
  }
  rightClick = false; lastW = 0; wSprint = false; torchT = 0;

  // ---------- screens ----------
  openScreen(s: Screen) {
    if (this.phase !== 'playing') return;
    this.screen = s;
    if (s === 'inventory') { this.activeCraft = this.craft2; updateCraft(this.craft2); }
    if (s === 'table') { this.activeCraft = this.craft3; updateCraft(this.craft3); }
    if (!this.noLock) document.exitPointerLock();
    this.mouse = [false, false, false];
    if (s === 'pause') this.save();
    this.bump();
  }
  closeScreen() {
    const was = this.screen;
    if (was === 'inventory' || was === 'table') this.returnCraft();
    if (this.cursor.stack) { this.inv.add(this.cursor.stack) > 0 && this.dropStack(this.cursor.stack); this.cursor.stack = null; }
    this.openBE = null; this.openKey = '';
    this.screen = 'none';
    this.requestLock();
    this.bump();
  }
  resume() { this.screen = 'none'; this.requestLock(); this.bump(); }
  private returnCraft() {
    for (const c of [this.craft2, this.craft3]) {
      for (let i = 0; i < c.grid.length; i++) { const s = c.grid[i]; if (s) { const left = this.inv.add(s); if (left > 0) this.dropStack({ ...s, n: left }); c.grid[i] = null; } }
      c.result = null;
    }
  }
  dropStack(s: Stack) {
    const p = this.player; if (!p) return;
    const d = dirOf(p.yaw, 0);
    const e = this.spawnItem(s.id, s.n, p.body.x + d[0] * 0.5, p.body.y + 1.4, p.body.z + d[2] * 0.5, d[0] * 4, 2.5, d[2] * 4, s.d);
    if (e) e.delay = 1.5;
  }
  dropHeld(all: boolean) {
    const s = this.heldStack(); if (!s) return;
    const n = all ? s.n : 1;
    this.dropStack({ id: s.id, n, d: s.d });
    s.n -= n; if (s.n <= 0) this.inv.slots[this.sel] = null;
    this.bump();
  }
  slotClick(list: (Stack | null)[], idx: number, kind: SlotKind, button: number, shift: boolean) {
    const others = this.screen === 'furnace' || this.screen === 'chest' ? this.openBE?.slots : undefined;
    const crafting = this.screen === 'inventory' || this.screen === 'table';
    slotClick({
      cursor: this.cursor, inv: this.inv, creative: this.creative, craft: crafting ? this.activeCraft : null, others,
      onCraft: (id) => this.onCraft(id), changed: () => this.bump(),
    }, list, idx, kind, button, shift);
    if (kind === 'furnace_out' && this.cursor.stack) this.onPickup(this.cursor.stack.id, true);
    this.bump();
  }
  creativePick(id: number, shift: boolean) {
    const max = ITEMDEF[id]?.max ?? 64;
    if (shift) this.inv.add({ id, n: max });
    else this.cursor.stack = { id, n: max };
    this.audio.play('click');
    this.bump();
  }
  trashCursor() { this.cursor.stack = null; this.bump(); }
  dropCursorOutside() { if (this.cursor.stack) { this.dropStack(this.cursor.stack); this.cursor.stack = null; this.bump(); } }
  recipesFor(w: number, h: number) { return RECIPES.filter((r) => r.w <= w && r.h <= h); }
  canCraftRecipe(r: Recipe) {
    const need = new Map<string, number>();
    for (const ing of r.cells) { if (ing === null) continue; const k = String(ing); need.set(k, (need.get(k) || 0) + 1); }
    for (const [k, n] of need) {
      let have = 0;
      for (const s of this.inv.slots) if (s && ingMatches(isNaN(Number(k)) ? k : Number(k), s.id)) have += s.n;
      for (const s of this.activeCraft.grid) if (s && ingMatches(isNaN(Number(k)) ? k : Number(k), s.id)) have += s.n;
      if (have < n) return false;
    }
    return true;
  }
  fillRecipe(r: Recipe) {
    const c = this.activeCraft;
    if (!this.canCraftRecipe(r)) { this.audio.play('click', undefined, 0.3, 0.6); return; }
    autofill(c, this.inv, r.cells, r.w, r.h, ingMatches, r.shapeless);
    this.audio.play('click'); this.bump();
  }

  // ---------- world lifecycle ----------
  disposeWorld() {
    for (const m of this.mobs) m.dispose(this);
    for (const i of this.items) i.dispose(this);
    for (const a of this.arrows) a.dispose(this);
    for (const e of this.ents) e.dispose(this);
    this.mobs = []; this.items = []; this.arrows = []; this.ents = [];
    this.chunks?.dispose(); this.chunks = null; this.world = null; this.player = null; this.store = null;
    this.outline.visible = false; this.crack.visible = false;
    this.be.clear(); this.openBE = null;
  }

  startMenu() {
    this.disposeWorld();
    this.phase = 'menu'; this.screen = 'none';
    const seed = (Math.random() * 2 ** 31) | 0;
    this.world = new World(seed);
    this.terrain = new Terrain(seed);
    this.chunks = new ChunkManager(this.world, this.scene, this.mats);
    this.chunks.setRenderDistance(5);
    const sp = findSpawn(this.terrain);
    this.menuCenter = { x: sp.x, z: sp.z };
    this.tod = 0.12 + Math.random() * 0.1;
    this.weather.rain = 0; this.weather.target = 0; this.weather.timer = 9999;
    this.bump();
    if (!this.running) { this.running = true; this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
  }

  async startWorld(meta: WorldMeta) {
    this.disposeWorld();
    this.audio.init();
    this.requestLock();
    this.phase = 'loading'; this.loadText = 'Preparing world'; this.loadProgress = 0; this.loadStart = performance.now();
    this.meta = meta; this.screen = 'none';
    this.bump();
    this.world = new World(meta.seed);
    this.terrain = new Terrain(meta.seed);
    this.store = await openChunkStore(meta.id);
    this.chunks = new ChunkManager(this.world, this.scene, this.mats);
    this.chunks.store = this.store;
    this.chunks.setRenderDistance(this.settings.renderDist);
    this.player = new Player();
    this.inv.clear(); this.cursor.stack = null; this.sel = 0;
    this.achieved.clear(); this.visitedBiomes.clear(); this.stats = { mined: 0, killed: 0, deaths: 0, placed: 0 };
    this.toasts = []; this.chat = []; this.sawNight = false;
    const st = meta.state;
    this.pendingState = st || null;
    this.days = 0; this.tod = 0.08;
    if (st) {
      const p = this.player, s = st.p;
      p.body.x = s.x; p.body.y = s.y; p.body.z = s.z; p.yaw = s.yaw; p.pitch = s.pitch;
      p.health = s.health; p.food = s.food; p.saturation = s.sat; p.air = s.air; p.flying = !!s.flying; p.spawn = s.spawn;
      this.inv.load(st.inv); this.sel = st.sel || 0; this.tod = st.tod; this.days = st.days || 0;
      this.achieved = new Set(st.ach || []); this.visitedBiomes = new Set(st.biomes || []); this.stats = { ...this.stats, ...(st.stats || {}) };
      for (const [k, v] of st.be || []) this.be.set(k, v);
      this.weather.rain = st.rain || 0; this.weather.target = st.rainT || 0; this.weather.thunder = !!st.thunder;
      this.pendingSpawn = null;
    } else {
      const sp = findSpawn(this.terrain);
      this.player.body.x = sp.x + 0.5; this.player.body.z = sp.z + 0.5; this.player.body.y = 90;
      this.pendingSpawn = sp;
      if (meta.mode === 'survival') this.inv.add({ id: I.APPLE, n: 3 });
      this.weather.rain = 0; this.weather.target = 0; this.weather.timer = 240 + Math.random() * 300;
    }
    this.sel = Math.min(8, this.sel);
    this.bump();
  }

  private finishLoading() {
    const p = this.player!;
    if (this.pendingSpawn) {
      const o = this.openGround(this.pendingSpawn.x, this.pendingSpawn.z);
      p.body.x = o.x + 0.5; p.body.z = o.z + 0.5; p.body.y = o.y + 0.05;
      p.spawn = { x: p.body.x, y: p.body.y, z: p.body.z };
    }
    p.body.vy = 0; p.fallDist = 0;
    const st = this.pendingState;
    if (st) {
      for (const m of st.mobs || []) if (MOBS[m.k]) spawnMob(this, m.k, m.x, m.y, m.z, m.hp);
    } else for (let i = 0; i < 14; i++) this.spawner.tryPassive(this, 6, 40);
    this.pendingState = null; this.pendingSpawn = null;
    this.phase = 'playing'; this.screen = this.locked || this.noLock ? 'none' : 'pause';
    this.handId = -2; this.onSelect();
    this.say(this.meta!.mode === 'creative' ? 'Creative mode: double-tap Space to fly. Press T for commands.' : 'Survive! Press E for inventory, L for goals, F3 for debug.');
    this.bump();
  }

  returnToMenu() {
    this.save();
    this.phase = 'menu';
    this.startMenu();
  }

  // ---------- persistence ----------
  save() {
    if (!this.meta || !this.player || !this.world || this.phase !== 'playing') return;
    const p = this.player;
    this.meta.lastPlayed = Date.now(); this.meta.playTime = this.playTime;
    this.meta.state = {
      p: { x: p.body.x, y: p.body.y, z: p.body.z, yaw: p.yaw, pitch: p.pitch, health: p.health, food: p.food, sat: p.saturation, air: p.air, flying: p.flying, spawn: p.spawn },
      inv: this.inv.serialize(), sel: this.sel, tod: this.tod, days: this.days, ach: [...this.achieved], biomes: [...this.visitedBiomes], stats: this.stats,
      be: [...this.be.entries()], mobs: this.mobs.filter((m) => m.dead <= 0).map((m) => m.serialize()),
      rain: this.weather.rain, rainT: this.weather.target, thunder: this.weather.thunder,
    };
    saveWorld(this.meta);
    this.chunks?.saveAll();
  }

  // ---------- helpers ----------
  skyFactor() { return U.uSun.value; }
  brightnessAt(x: number, y: number, z: number) {
    const w = this.world; if (!w) return 1;
    const l = w.lightAt(Math.floor(x), Math.floor(y), Math.floor(z));
    const f = (v: number) => Math.pow(0.8, (1 - v) * 15);
    const sky = f(((l & 15) / 15) * U.uSun.value), blk = f((l >> 4) / 15);
    return Math.max(0.2, Math.min(1, Math.max(sky, blk * 0.95)));
  }
  addExhaustion(n: number) { if (this.player && !this.creative) this.player.exhaustion += n; }
  damagePlayer(amount: number, fx?: number, fz?: number, _cause?: string) { this.player?.damage(this, amount, fx, fz); this.flash = 1; }
  touchingCactus() {
    const p = this.player, w = this.world; if (!p || !w) return false;
    for (const dy of [0.2, 1.0]) for (const dx of [-0.4, 0.4]) for (const dz of [-0.4, 0.4]) if (w.getBlock(Math.floor(p.body.x + dx), Math.floor(p.body.y + dy), Math.floor(p.body.z + dz)) === B.CACTUS) return true;
    return false;
  }
  spawnItem(id: number, n: number, x: number, y: number, z: number, vx?: number, vy?: number, vz?: number, d?: number) {
    if (!ITEMDEF[id] || n <= 0) return null;
    const e = new ItemEntity(this, { id, n, d }, x, y, z, vx ?? (Math.random() - 0.5) * 2.2, vy ?? 3 + Math.random() * 1.5, vz ?? (Math.random() - 0.5) * 2.2);
    this.items.push(e);
    if (this.items.length > 260) { const o = this.items.shift()!; o.dispose(this); }
    return e;
  }
  onPickup(id: number, fromFurnace = false) {
    if (id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG) this.advance('wood');
    else if (id === B.COBBLE) this.advance('stone');
    else if (id === I.DIAMOND) this.advance('diamond');
    else if (id === I.IRON_INGOT && fromFurnace) this.advance('smelt');
    else if ((id === I.COOKED_BEEF || id === I.COOKED_PORK || id === I.COOKED_CHICKEN || id === I.COOKED_MUTTON) && fromFurnace) this.advance('cook');
  }
  onCraft(id: number) {
    if (id === B.TABLE) this.advance('bench');
    else if (id === 288) this.advance('pick');
    else if (id === B.FURNACE) this.advance('furnace');
    else if (id === 288 + 2 * 8) this.advance('ironpick');
    else if (id === I.BREAD) this.advance('bread');
    this.audio.play('click');
  }
  onMobKilled(m: Mob) {
    this.stats.killed++;
    if (m.type.hostile) this.advance('monster');
  }
  onPlayerDeath() {
    const p = this.player!;
    p.dead = true; this.stats.deaths++;
    this.lastDeathMsg = 'You died!';
    if (!this.creative) {
      for (const s of this.inv.slots) if (s) this.spawnItem(s.id, s.n, p.body.x, p.body.y + 1, p.body.z, (Math.random() - 0.5) * 6, 4, (Math.random() - 0.5) * 6, s.d);
      this.inv.clear();
      if (this.cursor.stack) { this.spawnItem(this.cursor.stack.id, this.cursor.stack.n, p.body.x, p.body.y + 1, p.body.z); this.cursor.stack = null; }
      this.returnCraftDrop();
    }
    this.openScreen('death');
  }
  private returnCraftDrop() {
    for (const c of [this.craft2, this.craft3]) { for (let i = 0; i < c.grid.length; i++) { const s = c.grid[i]; if (s) { this.spawnItem(s.id, s.n, this.player!.body.x, this.player!.body.y + 1, this.player!.body.z); c.grid[i] = null; } } c.result = null; }
  }
  respawn() {
    const p = this.player!;
    p.dead = false; p.health = 20; p.food = 20; p.saturation = 5; p.air = 15; p.burn = 0; p.fallDist = 0; p.exhaustion = 0; p.flying = false;
    const o = this.openGround(Math.floor(p.spawn.x), Math.floor(p.spawn.z));
    p.teleport(o.x + 0.5, o.y + 0.05, o.z + 0.5);
    this.closeScreen();
  }

  // Nearest column (spiral from x,z) with solid non-foliage ground and 2 free blocks above, not under a tree.
  openGround(x: number, z: number) {
    const w = this.world!;
    const foliage = (id: number) => id === B.LEAVES || id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG;
    for (let r = 0; r <= 14; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = x + dx, cz = z + dz, h = w.heightAt(cx, cz);
        if (h < SEA) continue;
        const top = w.getBlock(cx, h, cz);
        if (foliage(top) || top === B.WATER || top === B.ICE || top === B.CACTUS || top === B.LAVA) continue;
        if (w.getBlock(cx, h + 1, cz) !== 0 && T_KIND[w.getBlock(cx, h + 1, cz)] !== K.CROSS) continue;
        return { x: cx, y: h + 1, z: cz };
      }
    }
    const h = w.heightAt(x, z);
    return { x, y: (h < 0 ? 70 : h) + 1, z };
  }

  // ---------- commands ----------
  runCommand(text: string) {
    const t = text.trim();
    if (!t) return;
    if (!t.startsWith('/')) { this.say('<You> ' + t); return; }
    const [cmd, ...a] = t.slice(1).split(/\s+/);
    const p = this.player!;
    switch (cmd.toLowerCase()) {
      case 'help': this.say('Commands: /time set <day|noon|night|midnight|0-1>, /gamemode <s|c>, /tp x y z, /give <item> [n], /weather <clear|rain|thunder>, /summon <mob>, /spawn, /heal, /kill, /seed, /clear'); break;
      case 'time': {
        const v = a[1];
        const map: Record<string, number> = { day: 0.1, noon: 0.25, sunset: 0.45, night: 0.62, midnight: 0.75, dawn: 0.0 };
        const n = map[v] ?? parseFloat(v);
        if (isNaN(n)) this.say('Usage: /time set <day|noon|night|midnight|0..1>'); else { this.tod = ((n % 1) + 1) % 1; this.cmdLock = true; this.sawNight = false; this.say('Time set.'); }
        break;
      }
      case 'gamemode': case 'gm': {
        const m = (a[0] || '')[0] === 'c' ? 'creative' : 'survival';
        if (this.meta) this.meta.mode = m;
        if (m === 'survival') p.flying = false;
        this.say('Game mode: ' + m); break;
      }
      case 'tp': {
        const [x, y, z] = a.map(Number);
        if ([x, y, z].some(isNaN)) { this.say('Usage: /tp x y z'); break; }
        p.teleport(x + 0.5, y, z + 0.5); this.say(`Teleported to ${x} ${y} ${z}`); break;
      }
      case 'give': {
        const last = parseInt(a[a.length - 1]);
        const nameParts = isNaN(last) || a.length < 2 ? a : a.slice(0, -1);
        const q = nameParts.join(' ').toLowerCase().replace(/_/g, ' ');
        const def = ITEMDEF.find((d) => d && (String(d.id) === q || d.name.toLowerCase() === q || d.name.toLowerCase().includes(q)));
        if (!def || !q) { this.say('Unknown item. Try /give diamond 5'); break; }
        const n = !isNaN(last) && a.length > 1 ? last : def.max;
        const left = this.inv.add({ id: def.id, n }); if (left > 0) this.dropStack({ id: def.id, n: left });
        this.say(`Gave ${n} ${def.name}`); break;
      }
      case 'weather': { const k = a[0] as any; if (['clear', 'rain', 'thunder'].includes(k)) { this.weather.set(k); this.say('Weather: ' + k); } else this.say('Usage: /weather clear|rain|thunder'); break; }
      case 'summon': { const k = (a[0] || '').toLowerCase(); if (MOBS[k]) { const d = dirOf(p.yaw, 0); spawnMob(this, k, p.body.x + d[0] * 3, p.body.y + 1, p.body.z + d[2] * 3); this.say('Summoned ' + k); } else this.say('Mobs: ' + Object.keys(MOBS).join(', ')); break; }
      case 'spawn': p.teleport(p.spawn.x, p.spawn.y + 1, p.spawn.z); this.say('Teleported to spawn.'); break;
      case 'heal': p.health = 20; p.food = 20; this.say('Healed.'); break;
      case 'kill': this.damagePlayer(999); break;
      case 'seed': this.say('Seed: ' + this.meta?.seedStr); break;
      case 'clear': this.inv.clear(); this.say('Inventory cleared.'); break;
      default: this.say('Unknown command. Try /help');
    }
    this.bump();
  }

  // ---------- block ops ----------
  setBlockAndUpdate(x: number, y: number, z: number, id: number, urgent = true) {
    const w = this.world!;
    if (!w.setBlock(x, y, z, id, urgent)) return false;
    this.neighborUpdate(x, y, z);
    if (id && BLOCKS[id].gravity) this.checkFall(x, y, z);
    return true;
  }
  private neighborUpdate(x: number, y: number, z: number) {
    for (const [dx, dy, dz] of [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
      this.checkSupport(x + dx, y + dy, z + dz);
      this.checkFall(x + dx, y + dy, z + dz);
    }
  }
  private checkFall(x: number, y: number, z: number) {
    const w = this.world!, id = w.getBlock(x, y, z);
    if (!id || !BLOCKS[id].gravity) return;
    const below = w.getBlock(x, y - 1, z);
    if (y > 0 && (below === 0 || BLOCKS[below].repl || T_KIND[below] === K.CROSS || T_KIND[below] === K.TORCH || below === B.LAVA)) {
      w.setBlock(x, y, z, 0);
      this.ents.push(new FallingBlock(this, id, x + 0.5, y, z + 0.5));
      this.neighborUpdate(x, y, z);
    }
  }
  private checkSupport(x: number, y: number, z: number) {
    const w = this.world!, id = w.getBlock(x, y, z);
    if (!id) return;
    const k = T_KIND[id], below = w.getBlock(x, y - 1, z);
    let bad = false;
    if (k === K.CROSS) {
      const ok = below === B.GRASS || below === B.DIRT || below === B.FARMLAND || below === B.SNOW_GRASS || (id === B.DEADBUSH && below === B.SAND) || (below === B.SAND && id !== B.SAPLING && !(id >= B.WHEAT0 && id <= B.WHEAT3));
      bad = !ok;
    } else if (k === K.TORCH) {
      bad = !(T_SOLID[below] || T_SOLID[w.getBlock(x + 1, y, z)] || T_SOLID[w.getBlock(x - 1, y, z)] || T_SOLID[w.getBlock(x, y, z + 1)] || T_SOLID[w.getBlock(x, y, z - 1)]);
    } else if (k === K.CACTUS) bad = below !== B.SAND && below !== B.CACTUS;
    else if (id === B.FARMLAND) { if (T_OPAQUE[w.getBlock(x, y + 1, z)]) w.setBlock(x, y, z, B.DIRT); }
    if (bad) this.breakBlock(x, y, z, false);
  }

  tintFor(id: number) { const t = BLOCKS[id].tiles[2]; return TINT_TILE[t] === 1 ? TINT_GRASS : TINT_TILE[t] === 2 ? TINT_FOLIAGE : null; }

  breakBlock(x: number, y: number, z: number, byPlayer: boolean) {
    const w = this.world!, id = w.getBlock(x, y, z);
    if (!id) return;
    const held = this.heldStack(), bd = BLOCKS[id];
    const drops = byPlayer && this.creative ? [] : blockDrops(id, Math.random, byPlayer ? canHarvest(id, held) : true);
    w.setBlock(x, y, z, 0);
    this.particles.debris(x + 0.5, y + 0.5, z + 0.5, bd.tiles[2], this.tintFor(id), 14);
    this.audio.block('break', bd.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    for (const [did, n] of drops) this.spawnItem(did, n, x + 0.5, y + 0.4, z + 0.5);
    const key = `${x},${y},${z}`, be = this.be.get(key);
    if (be) { for (const s of be.slots) if (s) this.spawnItem(s.id, s.n, x + 0.5, y + 0.5, z + 0.5, undefined, undefined, undefined, s.d); this.be.delete(key); if (this.openKey === key) this.closeScreen(); }
    this.neighborUpdate(x, y, z);
    if (byPlayer) {
      this.stats.mined++; this.addExhaustion(0.005);
      if (!this.creative && held && ITEMDEF[held.id]?.tool && maxDur(held.id) > 0) this.useTool(1);
    }
  }
  useTool(n: number) {
    const s = this.heldStack(); if (!s || this.creative) return;
    const m = maxDur(s.id); if (!m) return;
    s.d = (s.d || 0) + n;
    if (s.d >= m) { this.inv.slots[this.sel] = null; this.audio.play('hurt', undefined, 0.5, 1.6); this.handId = -2; }
    this.bump();
  }

  explode(x: number, y: number, z: number, r: number, cause: string) {
    const w = this.world!;
    this.audio.play('explode', { x, y, z }, 1.2);
    this.particles.puff(x, y, z, 0.35, 0.35, 0.35, 40, 7, 3, 1.1, 1.3);
    this.particles.puff(x, y, z, 1, 0.55, 0.15, 24, 6, 2, 0.8, 0.6);
    this.flash = Math.max(this.flash, 0.5);
    const R = Math.ceil(r), removed: number[] = [];
    const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z);
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
      const d = Math.hypot(dx, dy, dz);
      if (d > r) continue;
      const bx = cx + dx, by = cy + dy, bz = cz + dz, id = w.getBlock(bx, by, bz);
      if (!id || BLOCKS[id].hardness < 0 || id === B.WATER) continue;
      if (Math.random() > 1.15 - d / (r + 0.4) - (BLOCKS[id].hardness > 4 ? 0.5 : 0)) continue;
      if (id === B.TNT) { w.setBlock(bx, by, bz, 0, false); this.ents.push(new PrimedTnt(this, bx + 0.5, by, bz + 0.5, 0.3 + Math.random() * 0.7)); continue; }
      if (Math.random() < 0.3) for (const [did, n] of blockDrops(id, Math.random, true)) this.spawnItem(did, n, bx + 0.5, by + 0.5, bz + 0.5);
      const key = `${bx},${by},${bz}`, be = this.be.get(key);
      if (be) { for (const s of be.slots) if (s) this.spawnItem(s.id, s.n, bx + 0.5, by + 0.5, bz + 0.5); this.be.delete(key); }
      w.setBlock(bx, by, bz, 0, false);
      removed.push(bx, by, bz);
    }
    for (let i = 0; i < removed.length; i += 3) this.neighborUpdate(removed[i], removed[i + 1], removed[i + 2]);
    const hurtEntity = (ex: number, ey: number, ez: number, cb: (dmg: number, kx: number, kz: number) => void) => {
      const dx = ex - x, dy = ey - y, dz = ez - z, d = Math.hypot(dx, dy, dz);
      if (d > r * 2) return;
      const imp = 1 - d / (r * 2);
      cb(((imp * imp + imp) / 2) * 5 * r + 1, x, z);
    };
    const p = this.player;
    if (p && !p.dead && cause !== 'none') hurtEntity(p.body.x, p.body.y + 1, p.body.z, (dmg, kx, kz) => { this.damagePlayer(dmg, kx, kz); const d = Math.hypot(p.body.x - x, p.body.z - z) || 1; p.body.vy = 6; p.body.vx += ((p.body.x - x) / d) * 7; p.body.vz += ((p.body.z - z) / d) * 7; });
    for (const m of this.mobs) hurtEntity(m.body.x, m.body.y + m.type.h / 2, m.body.z, (dmg, kx, kz) => m.hit(this, dmg * 1.2, kx, kz));
  }

  // ---------- interaction ----------
  mobRay(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) {
    let best: Mob | null = null, bt = max;
    for (const m of this.mobs) {
      if (m.dead > 0) continue;
      const b = m.body, hw = b.w / 2;
      const mn = [b.x - hw, b.y, b.z - hw], mx = [b.x + hw, b.y + b.h, b.z + hw], o = [ox, oy, oz], d = [dx, dy, dz];
      let t0 = 0, t1 = bt;
      for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-8) { if (o[i] < mn[i] || o[i] > mx[i]) { t1 = -1; break; } continue; }
        let a = (mn[i] - o[i]) / d[i], c = (mx[i] - o[i]) / d[i];
        if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) break;
      }
      if (t1 >= t0 && t1 >= 0 && t0 < bt) { bt = t0; best = m; }
    }
    return best ? { mob: best, dist: bt } : null;
  }

  private pickBlock() {
    if (!this.target) return;
    let id = this.target.id; if (id === B.FURNACE_LIT) id = B.FURNACE;
    if (!ITEMDEF[id]) return;
    const i = this.inv.slots.findIndex((s, k) => k < 9 && s && s.id === id);
    if (i >= 0) { this.sel = i; this.onSelect(); }
    else if (this.creative) { const e = this.inv.slots.findIndex((s, k) => k < 9 && !s); const k = e >= 0 ? e : this.sel; this.inv.slots[k] = { id, n: 1 }; this.sel = k; this.onSelect(); }
  }

  private updateInteraction(dt: number) {
    const p = this.player!, w = this.world!;
    this.attackCD -= dt; this.useCD -= dt; this.mineCool -= dt;
    if (this.swing > 0) this.swing = Math.max(0, this.swing - dt * 3.6);
    const ox = p.body.x, oy = p.body.y + p.eye, oz = p.body.z, d = dirOf(p.yaw, p.pitch);
    const reach = this.creative ? 6 : 4.6;
    const hit = raycast(w, ox, oy, oz, d[0], d[1], d[2], reach);
    this.target = hit;
    const mh = this.mobRay(ox, oy, oz, d[0], d[1], d[2], Math.min(hit ? hit.dist : reach, this.creative ? 5 : 3.6));
    const active = this.screen === 'none' && this.locked && !p.dead;
    // outline
    if (hit && active) {
      this.outline.visible = true; this.outline.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else this.outline.visible = false;
    let mining = false;
    if (active && this.mouse[0]) {
      if (mh) {
        this.mineProgress = 0;
        if (this.attackCD <= 0) this.attack(mh.mob);
      } else if (hit) {
        mining = true;
        const key = `${hit.x},${hit.y},${hit.z}`;
        if (key !== this.mineKey) { this.mineKey = key; this.mineProgress = 0; this.mineTick = 0; }
        const bd = BLOCKS[hit.id];
        if (this.creative) {
          if (this.mineCool <= 0) { if (bd.hardness >= 0 || true) { if (hit.id !== B.BEDROCK || true) this.breakBlock(hit.x, hit.y, hit.z, true); } this.mineCool = 0.22; this.swing = 1; }
        } else {
          let t = miningTime(hit.id, this.heldStack());
          if (p.headInWater) t *= 3;
          if (isFinite(t)) {
            this.mineProgress += dt / Math.max(0.05, t);
            this.mineTick -= dt;
            if (this.mineTick <= 0) { this.mineTick = 0.25; this.audio.block('dig', bd.sound, { x: hit.x + 0.5, y: hit.y + 0.5, z: hit.z + 0.5 }); this.swing = 1; this.particles.debris(hit.x + 0.5 + hit.nx * 0.5, hit.y + 0.5 + hit.ny * 0.5, hit.z + 0.5 + hit.nz * 0.5, bd.tiles[2], this.tintFor(hit.id), 2, 2); }
            if (this.mineProgress >= 1) { this.breakBlock(hit.x, hit.y, hit.z, true); this.mineProgress = 0; this.mineKey = ''; this.swing = 1; }
          }
        }
      }
    }
    if (!mining) { this.mineProgress = 0; this.mineKey = ''; }
    if (mining && !this.creative && this.mineProgress > 0 && hit) {
      this.crack.visible = true; this.crack.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      this.crackTex.offset.x = Math.min(9, Math.floor(this.mineProgress * 10)) * 0.1;
    } else this.crack.visible = false;
    // right click
    const held = this.heldStack(), hd = held ? ITEMDEF[held.id] : undefined;
    if (active && this.mouse[2]) {
      if (hd?.food && (p.food < 20 || false) && !this.creative) {
        if (!(hit && ['table', 'furnace', 'chest'].includes(this.interactKind(hit.id)) && !p.sneaking)) {
          this.eatT += dt; this.swing = Math.max(this.swing, 0.01);
          if (Math.floor(this.eatT * 5) !== Math.floor((this.eatT - dt) * 5)) { this.audio.play('eat', undefined, 0.7); this.particles.debris(ox + d[0] * 0.6, oy - 0.25 + d[1] * 0.6, oz + d[2] * 0.6, hd.tile, null, 2, 1.5); }
          if (this.eatT >= 1.6) {
            this.eatT = 0; p.food = Math.min(20, p.food + hd.food.h); p.saturation = Math.min(p.food, p.saturation + hd.food.s);
            held!.n--; if (held!.n <= 0) this.inv.slots[this.sel] = null;
            this.audio.play('burp', undefined, 0.6); this.bump();
          }
          this.rightClick = false;
        } else if (this.rightClick) { this.useItem(hit); this.rightClick = false; }
      } else if (this.rightClick || this.useCD <= 0) {
        this.useCD = 0.22; this.rightClick = false;
        this.useItem(hit);
      }
    } else { this.eatT = 0; this.rightClick = false; }
  }

  interactKind(id: number) { return id === B.TABLE ? 'table' : id === B.FURNACE || id === B.FURNACE_LIT ? 'furnace' : id === B.CHEST ? 'chest' : ''; }

  private attack(m: Mob) {
    const p = this.player!, held = this.heldStack(), tool = held ? ITEMDEF[held.id]?.tool : undefined;
    let dmg = tool ? tool.dmg : 1;
    if (!p.body.onGround && p.body.vy < 0 && !p.inWater) { dmg *= 1.5; this.particles.puff(m.body.x, m.body.y + m.type.h, m.body.z, 1, 1, 0.8, 6, 2, 1.5, 0.15, 0.4); }
    this.attackCD = 0.5; this.swing = 1;
    this.audio.play('hit', m.body, 0.8);
    m.hit(this, dmg, p.body.x, p.body.z);
    this.addExhaustion(0.1);
    if (!this.creative && tool && held) this.useTool(tool.kind === 4 ? 1 : 2);
  }

  private useItem(hit: Hit | null) {
    const p = this.player!, w = this.world!;
    this.swing = 1;
    if (hit) {
      const k = this.interactKind(hit.id);
      if (k && !p.sneaking) {
        this.audio.play('click');
        const key = `${hit.x},${hit.y},${hit.z}`;
        if (k === 'table') this.openScreen('table');
        else {
          let be = this.be.get(key);
          if (!be) { be = k === 'furnace' ? newFurnace() : newChest(); this.be.set(key, be); }
          this.openBE = be; this.openKey = key; this.openScreen(k as Screen);
        }
        return;
      }
    }
    const held = this.heldStack();
    if (!held) return;
    const def = ITEMDEF[held.id]; if (!def) return;
    if (hit) {
      if (held.id === I.FLINT_STEEL) {
        if (hit.id === B.TNT) {
          w.setBlock(hit.x, hit.y, hit.z, 0); this.neighborUpdate(hit.x, hit.y, hit.z);
          this.ents.push(new PrimedTnt(this, hit.x + 0.5, hit.y, hit.z + 0.5));
          this.advance('boom'); this.useTool(1);
        } else { this.audio.play('fire', undefined, 0.6); }
        return;
      }
      if (def.tool?.kind === 5) {
        if ((hit.id === B.GRASS || hit.id === B.DIRT || hit.id === B.SNOW_GRASS) && hit.ny === 1 && (w.getBlock(hit.x, hit.y + 1, hit.z) === 0 || T_KIND[w.getBlock(hit.x, hit.y + 1, hit.z)] === K.CROSS)) {
          if (w.getBlock(hit.x, hit.y + 1, hit.z) !== 0) this.breakBlock(hit.x, hit.y + 1, hit.z, false);
          this.setBlockAndUpdate(hit.x, hit.y, hit.z, B.FARMLAND); this.audio.block('place', 'dirt', { x: hit.x, y: hit.y, z: hit.z }); this.useTool(1);
        }
        return;
      }
      if (held.id === I.SEEDS) {
        if (hit.id === B.FARMLAND && hit.ny === 1 && w.getBlock(hit.x, hit.y + 1, hit.z) === 0) {
          this.setBlockAndUpdate(hit.x, hit.y + 1, hit.z, B.WHEAT0); this.audio.block('place', 'grass', { x: hit.x, y: hit.y + 1, z: hit.z });
          if (!this.creative) { held.n--; if (held.n <= 0) this.inv.slots[this.sel] = null; } this.bump();
        }
        return;
      }
      if (def.block) this.tryPlace(hit, def.block);
    }
  }

  private tryPlace(hit: Hit, id: number) {
    const w = this.world!, p = this.player!, bd = BLOCKS[id];
    let x = hit.x + hit.nx, y = hit.y + hit.ny, z = hit.z + hit.nz;
    if (BLOCKS[hit.id].repl && hit.id !== B.WATER) { x = hit.x; y = hit.y; z = hit.z; }
    if (y < 0 || y >= CH - 1) return;
    const cur = w.getBlock(x, y, z);
    if (cur !== 0 && !BLOCKS[cur].repl) return;
    if (bd.solid) {
      const b = p.body, hw = b.w / 2;
      if (x + 1 > b.x - hw + 0.001 && x < b.x + hw - 0.001 && z + 1 > b.z - hw + 0.001 && z < b.z + hw - 0.001 && y + 1 > b.y + 0.001 && y < b.y + b.h - 0.001) return;
      for (const m of this.mobs) { const mb = m.body, mw = mb.w / 2; if (x + 1 > mb.x - mw && x < mb.x + mw && z + 1 > mb.z - mw && z < mb.z + mw && y + 1 > mb.y && y < mb.y + mb.h) return; }
    }
    const below = w.getBlock(x, y - 1, z);
    if (bd.kind === K.CROSS) {
      const ok = below === B.GRASS || below === B.DIRT || below === B.FARMLAND || below === B.SNOW_GRASS || (below === B.SAND && id === B.DEADBUSH);
      if (!ok) return;
    }
    if (bd.kind === K.TORCH && !(T_SOLID[below] || T_SOLID[w.getBlock(x + 1, y, z)] || T_SOLID[w.getBlock(x - 1, y, z)] || T_SOLID[w.getBlock(x, y, z + 1)] || T_SOLID[w.getBlock(x, y, z - 1)])) return;
    if (bd.kind === K.CACTUS && below !== B.SAND && below !== B.CACTUS) return;
    if (!w.isLoaded(x, z)) return;
    this.setBlockAndUpdate(x, y, z, id);
    this.audio.block('place', bd.sound, { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
    this.stats.placed++;
    if (!this.creative) { const s = this.heldStack()!; s.n--; if (s.n <= 0) this.inv.slots[this.sel] = null; }
    this.bump();
  }

  // ---------- random ticks & growth ----------
  private randomTicks() {
    const p = this.player!, w = this.world!;
    for (let i = 0; i < 24; i++) {
      const x = Math.floor(p.body.x + (Math.random() * 2 - 1) * 36), z = Math.floor(p.body.z + (Math.random() * 2 - 1) * 36);
      const h = w.heightAt(x, z); if (h < 0) continue;
      const id = w.getBlock(x, h, z), up = w.getBlock(x, h + 1, z);
      if (id === B.GRASS) {
        if (T_OPAQUE[up]) { w.setBlock(x, h, z, B.DIRT, false); continue; }
        const nx = x + Math.floor(Math.random() * 3) - 1, nz = z + Math.floor(Math.random() * 3) - 1, ny = h + Math.floor(Math.random() * 3) - 1;
        if (w.getBlock(nx, ny, nz) === B.DIRT && !T_OPAQUE[w.getBlock(nx, ny + 1, nz)] && (w.lightAt(nx, ny + 1, nz) & 15) >= 9) w.setBlock(nx, ny, nz, B.GRASS, false);
      } else if (id === B.DIRT && !T_OPAQUE[up] && up === 0 && (w.lightAt(x, h + 1, z) & 15) >= 12 && Math.random() < 0.1) {
        // dirt with grass neighbours turns to grass
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (w.getBlock(x + dx, h, z + dz) === B.GRASS) { w.setBlock(x, h, z, B.GRASS, false); break; }
      }
      if (up === B.SAPLING && Math.random() < 0.25) this.growTree(x, h + 1, z);
      else if (up >= B.WHEAT0 && up < B.WHEAT3 && (w.lightAt(x, h + 1, z) & 15) >= 9 && Math.random() < 0.35) w.setBlock(x, h + 1, z, up + 1, false);
    }
  }
  private growTree(x: number, y: number, z: number) {
    const w = this.world!, th = 4 + Math.floor(Math.random() * 2);
    for (let k = 0; k < th + 2; k++) { const b = w.getBlock(x, y + k, z); if (k > 0 && b !== 0 && T_KIND[b] !== K.CROSS && b !== B.LEAVES) return; }
    for (let k = 0; k < th; k++) w.setBlock(x, y + k, z, B.LOG, false);
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy <= 0 ? 2 : 1, yy = y + th + dy - 1;
      for (let ox = -rad; ox <= rad; ox++) for (let oz = -rad; oz <= rad; oz++) {
        if (Math.abs(ox) === rad && Math.abs(oz) === rad && (dy >= 1 || Math.random() < 0.5)) continue;
        if (w.getBlock(x + ox, yy, z + oz) === 0) w.setBlock(x + ox, yy, z + oz, B.LEAVES, false);
      }
    }
  }

  // ---------- main loop ----------
  last = 0;
  frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const real = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    this.frames++; this.fpsT += real;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; this.updateDebug(); }
    try {
      const n = Math.max(1, Math.ceil(real / 0.04));
      for (let i = 0; i < n; i++) this.step(real / n);
      this.render(Math.min(real, 0.05));
    } catch (e) { console.error(e); }
    this.flushUI();
  };

  private step(dt: number) {
    this.clockAnim += dt;
    U.uTime.value = this.clockAnim;
    if (this.phase === 'menu') this.stepMenu(dt);
    else if (this.phase === 'loading') this.stepLoading(dt);
    else this.stepPlay(dt);
  }

  private stepMenu(dt: number) {
    this.menuTime += dt;
    this.menuAngle += dt * 0.045;
    this.tod = (this.tod + dt / 2400) % 1;
    const r = 22, c = this.menuCenter;
    const cx = c.x + Math.cos(this.menuAngle) * r, cz = c.z + Math.sin(this.menuAngle) * r;
    this.chunks!.update(cx, cz);
    const h = Math.max(this.world!.heightAt(Math.floor(cx), Math.floor(cz)), SEA);
    const ty = Math.max(h + 14, SEA + 22);
    this.camera.position.set(cx, ty, cz);
    this.camera.lookAt(c.x + Math.cos(this.menuAngle + 1.2) * 40, ty - 10, c.z + Math.sin(this.menuAngle + 1.2) * 40);
    this.weather.update(dt, cx, ty, cz, this.world, false);
  }

  private stepLoading(dt: number) {
    const p = this.player!, c = this.chunks!;
    c.update(p.body.x, p.body.z);
    const prog = c.progress(Math.min(4, this.settings.renderDist - 1));
    this.loadProgress = Math.max(this.loadProgress, prog);
    const t = (performance.now() - this.loadStart) / 1000;
    this.loadText = prog < 0.3 ? 'Generating terrain' : prog < 0.8 ? 'Building meshes' : 'Finishing up';
    const here = this.world!.getChunk(Math.floor(p.body.x / 16), Math.floor(p.body.z / 16));
    const ready = here && here.state === 2 && prog >= 0.9;
    if ((ready && t > 0.6) || t > 30) this.finishLoading();
    this.updateCamera(dt);
    this.bump();
    void dt;
  }

  private stepPlay(dt0: number) {
    const w = this.world!, p = this.player!, c = this.chunks!;
    const paused = this.screen === 'pause';
    c.update(p.body.x, p.body.z);
    this.audio.setListener(p.body.x, p.body.y + p.eye, p.body.z, p.yaw);
    if (paused) return;
    const dt = dt0;
    this.time += dt; this.playTime += dt;
    const prevTod = this.tod;
    this.tod += dt / DAY_LEN;
    if (this.tod >= 1) { this.tod -= 1; this.days++; }
    if (this.sky.daylight > 0.9) this.cmdLock = false;
    if (prevTod > 0.6 && prevTod < 0.99 && this.sky.daylight < 0.2 && !this.cmdLock) this.sawNight = true;
    if (this.sawNight && this.sky.daylight > 0.5 && !p.dead) { this.advance('night'); this.sawNight = false; }
    const clim = w.climateAt(Math.floor(p.body.x), Math.floor(p.body.z));
    this.weather.update(dt, p.body.x, p.body.y + p.eye, p.body.z, w, clim.t < -0.12);
    this.rain = this.weather.rain;
    const k = this.keys, free = this.screen === 'none' && this.locked && !p.dead;
    const inp: Input = free ? { f: k.has('KeyW') || k.has('ArrowUp'), b: k.has('KeyS') || k.has('ArrowDown'), l: k.has('KeyA') || k.has('ArrowLeft'), r: k.has('KeyD') || k.has('ArrowRight'), jump: k.has('Space'), sneak: k.has('ShiftLeft') || k.has('ShiftRight'), sprint: k.has('ControlLeft') || k.has('KeyR') || this.wSprint } : { f: false, b: false, l: false, r: false, jump: false, sneak: false, sprint: false };
    if (w.isLoaded(Math.floor(p.body.x), Math.floor(p.body.z))) p.update(dt, inp, this);
    if (p.body.y < 15 && !this.creative) this.advance('deep');
    if (!p.dead) this.updateInteraction(dt);
    // entities
    const upd = <T extends Entity>(arr: T[]) => { for (let i = arr.length - 1; i >= 0; i--) if (!arr[i].update(dt, this)) { arr[i].dispose(this); arr.splice(i, 1); } };
    upd(this.items); upd(this.arrows); upd(this.ents);
    for (let i = this.mobs.length - 1; i >= 0; i--) if (!this.mobs[i].update(dt, this)) { this.mobs[i].dispose(this); this.mobs.splice(i, 1); }
    this.spawner.update(dt, this);
    // furnaces
    for (const [key, be] of this.be) {
      if (be.type !== 'furnace') continue;
      const [x, y, z] = key.split(',').map(Number);
      if (!w.isLoaded(x, z)) continue;
      if (tickFurnace(be, dt)) {
        const id = w.getBlock(x, y, z);
        if (id === B.FURNACE || id === B.FURNACE_LIT) w.setBlock(x, y, z, be.burn > 0 ? B.FURNACE_LIT : B.FURNACE);
      }
    }
    if (this.screen === 'furnace') this.uiT += dt, this.uiT > 0.2 && ((this.uiT = 0), this.bump());
    this.randomTicks();
    this.torchT -= dt;
    if (this.torchT <= 0) {
      this.torchT = 0.12;
      const px = Math.floor(p.body.x), py = Math.floor(p.body.y + 1), pz = Math.floor(p.body.z);
      for (let dx = -9; dx <= 9; dx++) for (let dz = -9; dz <= 9; dz++) for (let dy = -5; dy <= 5; dy++) {
        const id = w.getBlock(px + dx, py + dy, pz + dz);
        if (id === B.TORCH) { if (Math.random() < 0.6) this.particles.flame(px + dx + 0.5, py + dy + 0.78, pz + dz + 0.5); if (Math.random() < 0.08) this.particles.puff(px + dx + 0.5, py + dy + 0.85, pz + dz + 0.5, 0.35, 0.35, 0.35, 1, 0.1, 0.7, 0.12, 0.9); }
        else if (id === B.FURNACE_LIT && Math.random() < 0.25) this.particles.puff(px + dx + 0.5, py + dy + 1.05, pz + dz + 0.5, 0.3, 0.3, 0.3, 1, 0.2, 0.8, 0.2, 1);
      }
    }
    this.particles.update(dt);
    // ambience
    this.lavaT -= dt;
    if (this.lavaT <= 0) {
      this.lavaT = 0.6; this.lavaNear = false;
      const px = Math.floor(p.body.x), py = Math.floor(p.body.y), pz = Math.floor(p.body.z);
      outer: for (let dx = -4; dx <= 4; dx += 2) for (let dy = -3; dy <= 3; dy += 2) for (let dz = -4; dz <= 4; dz += 2) if (w.getBlock(px + dx, py + dy, pz + dz) === B.LAVA) { this.lavaNear = true; break outer; }
    }
    const hm = w.heightAt(Math.floor(p.body.x), Math.floor(p.body.z));
    const cave = hm >= 0 && p.body.y < hm - 7;
    this.audio.update(dt, { rain: this.weather.rain, underwater: p.headInWater, cave, night: 1 - this.sky.daylight, altitude: p.body.y, nearLava: this.lavaNear, daylight: this.sky.daylight });
    // biome exploration
    this.biomeT -= dt;
    if (this.biomeT <= 0) {
      this.biomeT = 1;
      const b = w.biomeAt(Math.floor(p.body.x), Math.floor(p.body.z));
      if (!this.visitedBiomes.has(b)) { this.visitedBiomes.add(b); if (!this.creative) { this.say(`Entered ${BIOME_NAMES[b]}`); if (this.visitedBiomes.size >= 5) this.advance('explorer'); } }
    }
    if (this.selNameT > 0) { this.selNameT -= dt; if (this.selNameT <= 0) this.bump(); }
    this.flash = Math.max(0, this.flash - dt * 2);
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 30; this.save(); }
    this.mapT -= dt;
    if (this.mapT <= 0 && this.showMap) { this.mapT = 0.4; this.drawMap(); }
    // expire toasts
    if (this.toasts.length && this.time - this.toasts[0].at > 5.5) { this.toasts.shift(); this.bump(); }
    if (this.heldStack()?.id !== this.handId && this.handId !== -2) this.bump();
  }

  private updateDebug() {
    const p = this.player, w = this.world;
    if (!p || !w || this.phase !== 'playing') return;
    const x = Math.floor(p.body.x), y = Math.floor(p.body.y), z = Math.floor(p.body.z);
    const l = w.lightAt(x, y, z);
    this.dbg = {
      fps: this.fps, pos: `${p.body.x.toFixed(1)} ${p.body.y.toFixed(1)} ${p.body.z.toFixed(1)}`, chunk: `${x >> 4}, ${z >> 4}`,
      biome: BIOME_NAMES[w.biomeAt(x, z)], light: `sky ${l & 15} / block ${l >> 4}`, chunks: w.chunks.size, mobs: this.mobs.length, items: this.items.length,
      tris: this.renderer.info.render.triangles, calls: this.renderer.info.render.calls, time: this.tod.toFixed(3), day: this.days + 1,
      weather: this.weather.rain > 0.05 ? (this.weather.thunder ? 'thunder' : this.weather.snowy ? 'snow' : 'rain') : 'clear', facing: ['S', 'W', 'N', 'E'][Math.round(((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI / 2)) % 4],
      workers: this.chunks?.fallback ? 'main thread' : this.chunks?.slots.length,
    };
    if (this.showDebug) this.bump();
  }

  private drawMap() {
    const p = this.player!, w = this.world!, ctx = this.mapCanvas.getContext('2d')!;
    const S = 80, img = ctx.createImageData(S, S);
    const px = Math.floor(p.body.x), pz = Math.floor(p.body.z);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const x = px + i - S / 2, z = pz + j - S / 2;
      const h = w.heightAt(x, z), o = (j * S + i) * 4;
      if (h < 0) { img.data[o + 3] = 120; continue; }
      const id = w.getBlock(x, h, z);
      let col = this.mapColors.get(id);
      if (!col) { col = id === B.WATER ? [40, 90, 190] : id === B.ICE ? [150, 190, 240] : blockColor(id); this.mapColors.set(id, col); }
      const hn = w.heightAt(x, z - 1);
      const sh = hn < 0 ? 1 : Math.max(0.72, Math.min(1.25, 1 + (h - hn) * 0.07));
      let r = col[0] * sh, g = col[1] * sh, b = col[2] * sh;
      if (id === B.WATER) { const d = Math.min(1, (SEA - h) / 20 + 0.0); r *= 1 - d * 0.35; g *= 1 - d * 0.3; b *= 1 - d * 0.1; }
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-p.yaw);
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(3, 3); ctx.lineTo(0, 1); ctx.lineTo(-3, 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  private updateCamera(dt: number) {
    const p = this.player!, cam = this.camera;
    let bobx = 0, boby = 0, roll = 0;
    if (this.settings.bob && p.body.onGround && !p.flying) {
      const sp = Math.hypot(p.body.vx, p.body.vz), a = Math.min(1, sp / 4.3);
      boby = Math.abs(Math.sin(p.bobPhase)) * 0.045 * a; bobx = Math.sin(p.bobPhase) * 0.03 * a; roll = Math.sin(p.bobPhase) * 0.004 * a;
    }
    if (p.hurtT > 0) roll += Math.sin(p.hurtT * 40) * p.hurtT * 0.08;
    if (p.dead) roll = 0.6;
    const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
    cam.position.set(p.body.x + c * bobx, p.body.y + p.eye - boby - (p.dead ? 1.2 : 0), p.body.z - s * bobx);
    cam.rotation.set(p.pitch, p.yaw, roll, 'YXZ');
    const target = this.settings.fov * (p.sprinting ? 1.1 : 1) * (p.flying && p.sprinting ? 1.15 : 1);
    cam.fov += (target - cam.fov) * Math.min(1, dt * 8);
    cam.updateProjectionMatrix();
  }

  private render(dt: number) {
    const cam = this.camera, p = this.player, w = this.world;
    if (this.phase === 'playing' && p) this.updateCamera(dt);
    else if (this.phase === 'loading' && p) this.updateCamera(dt);
    if (this.phase !== 'menu' && cam.fov !== this.settings.fov && !p) { cam.fov = this.settings.fov; cam.updateProjectionMatrix(); }
    if (this.phase === 'menu') { cam.fov = 62; cam.updateProjectionMatrix(); }
    const rain = this.weather.rain;
    this.sky.update(this.tod, rain, cam, this.clockAnim, this.settings.clouds);
    // fog
    const rd = (this.chunks?.renderDist ?? 6) * 16;
    let far = Math.max(48, rd - 8), near = far * 0.55;
    const fogCol = this.sky.fogColor.clone();
    let underwater = false, inLava = false;
    if (p && this.phase === 'playing' && w) {
      underwater = p.headInWater; inLava = p.headInLava;
      if (underwater) { const dl = 0.25 + 0.75 * this.sky.daylight; fogCol.setRGB(0.05 * dl + 0.02, 0.2 * dl + 0.04, 0.4 * dl + 0.08); near = 0.5; far = 20 + 10 * this.sky.daylight; }
      else if (inLava) { fogCol.setRGB(0.6, 0.18, 0.03); near = 0.1; far = 3; }
      else far *= 1 - rain * 0.28;
    }
    this.fog.color.copy(fogCol); this.fog.near = near; this.fog.far = far;
    U.uFogColor.value.copy(fogCol); U.uFogNear.value = near; U.uFogFar.value = far;
    U.uFlash.value = this.weather.flash * 0.7;
    this.renderer.setClearColor(fogCol);
    const h = this.renderer.domElement.height;
    this.particles.uniforms.uScale.value = h / (2 * Math.tan((cam.fov * Math.PI) / 360));
    this.particles.uniforms.uLight.value = Math.max(0.4, this.sky.daylight);
    this.underwaterFx = underwater; this.lavaFx = inLava;
    if (this.phase === 'playing' && p) this.updateHand(dt);
    this.renderer.info.reset();
    this.renderer.clear();
    this.renderer.render(this.scene, cam);
    if (this.phase === 'playing' && p && !p.dead && this.screen !== 'death') {
      this.renderer.clearDepth();
      this.renderer.render(this.handScene, this.handCamera);
    }
  }
  underwaterFx = false; lavaFx = false;

  // ---------- first-person hand ----------
  private updateHand(dt: number) {
    const p = this.player!, held = this.heldStack();
    const id = held ? held.id : -1;
    if (id !== this.handId) {
      this.handId = id;
      if (this.handMesh) { this.handGroup.remove(this.handMesh); this.handMat?.dispose(); this.handMesh = null; }
      if (id >= 0) {
        const m = itemGeometry(id);
        this.handMat = itemMaterial(m.textured);
        const mesh = new THREE.Mesh(m.geo, this.handMat);
        if (m.textured) { mesh.scale.setScalar(0.42); mesh.rotation.set(0.25, -0.7, 0); }
        else { mesh.scale.setScalar(0.34); mesh.rotation.set(0, Math.PI * 0.85, -0.5); }
        this.handMesh = mesh;
      } else {
        this.handMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
        const g = new THREE.BoxGeometry(0.2, 0.2, 0.62);
        const col = new Float32Array(24 * 3);
        for (let i = 0; i < 24; i++) { const sh = [0.8, 0.8, 1, 0.6, 0.85, 0.7][Math.floor(i / 4)]; col[i * 3] = 0.86 * sh; col[i * 3 + 1] = 0.66 * sh; col[i * 3 + 2] = 0.52 * sh; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const mesh = new THREE.Mesh(g, this.handMat);
        mesh.rotation.set(0.1, 0.25, 0); mesh.position.set(0, 0, 0.15);
        this.handMesh = mesh;
      }
      this.handGroup.add(this.handMesh);
    }
    this.equip = Math.min(1, this.equip + dt * 4.5);
    this.handBob += dt;
    const sp = Math.hypot(p.body.vx, p.body.vz) * (p.body.onGround ? 1 : 0.3);
    const bob = Math.min(1, sp / 4.3);
    const sw = Math.sin(this.swing * Math.PI), sq = Math.sin(Math.sqrt(this.swing) * Math.PI);
    const eating = this.eatT > 0;
    const g = this.handGroup;
    const ex = eating ? Math.sin(this.eatT * 22) * 0.02 : 0;
    g.position.set(0.58 + Math.sin(p.bobPhase) * 0.02 * bob - sq * 0.18 + ex, -0.46 - (1 - this.equip) * 0.7 - Math.abs(Math.sin(p.bobPhase)) * 0.03 * bob - sq * 0.12 + (eating ? 0.12 + Math.sin(this.eatT * 22) * 0.03 : 0), -0.85 - sw * 0.28 + (eating ? 0.25 : 0));
    g.rotation.set(-sw * 0.9 + (eating ? -0.6 : 0), sq * 0.35, -sq * 0.4);
    if (this.handMat) this.handMat.color.setScalar(Math.max(0.42, this.brightnessAt(p.body.x, p.body.y + 1.5, p.body.z)));
  }
}
