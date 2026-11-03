// Game orchestrator: wires world, player, entities, rendering, input and UI store together.
import * as THREE from "three";
import { World } from "./world";
import { Player, type InputState } from "./player";
import { Inventory } from "./inventory";
import { MobManager, type Mob } from "./mobs";
import { ItemManager, makeItemGeometry, getEntityMaterial, type ItemEntity } from "./entities";
import { Particles } from "./particles";
import { Sky } from "./sky";
import { AudioEngine } from "./audio";
import { raycast, bodyIntersectsBlock, type RayHit } from "./physics";
import { B, I, BLOCKS, ITEMS, isBlock, getName, getTool, getFood, getStackSize, CREATIVE_ITEMS } from "./blocks";
import { buildAtlas, tileRandomColor, tileIndex, ATLAS_TILES } from "./textures";
import { getUniforms } from "./materials";
import { store } from "./store";
import { BIOME_NAMES, Biome, HEIGHT } from "./worldgen";
import { hashString } from "./noise";
import { type WorldMeta, type SaveData, type Settings, loadWorldData, saveWorldData, updateWorldMeta } from "./save";
import { type Station, type Recipe, craft as doCraft } from "./crafting";

const ACHIEVEMENTS: Record<string, { title: string; body: string; icon: number }> = {
  wood: { title: "Getting Wood", body: "Punch a tree to collect a log", icon: B.LOG },
  table: { title: "Benchmarking", body: "Craft a crafting table", icon: B.CRAFTING_TABLE },
  pickaxe: { title: "Time to Mine!", body: "Craft a wooden pickaxe", icon: I.WOOD_PICKAXE },
  stone_pick: { title: "Getting an Upgrade", body: "Craft a stone pickaxe", icon: I.STONE_PICKAXE },
  furnace: { title: "Hot Topic", body: "Craft a furnace", icon: B.FURNACE },
  iron: { title: "Acquire Hardware", body: "Smelt an iron ingot", icon: I.IRON_INGOT },
  diamond: { title: "DIAMONDS!", body: "Find a diamond", icon: I.DIAMOND },
  torch: { title: "Let There Be Light", body: "Place a torch", icon: B.TORCH },
  food: { title: "Delicious", body: "Eat cooked food", icon: I.STEAK },
  zombie: { title: "Monster Hunter", body: "Slay a zombie", icon: I.IRON_SWORD },
  bed: { title: "Sweet Dreams", body: "Sleep through the night", icon: B.BED },
  explorer: { title: "Explorer", body: "Walk 1000 blocks", icon: B.GRASS },
  night: { title: "Night Owl", body: "Survive your first night", icon: B.GLOWSTONE },
  deep: { title: "Into the Deep", body: "Descend below Y=16", icon: B.BEDROCK },
  swim: { title: "Sea Legs", body: "Take a swim", icon: B.WATER },
  builder: { title: "Architect", body: "Place 100 blocks", icon: B.BRICK },
};

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world: World;
  player = new Player();
  inventory = new Inventory();
  mobs: MobManager;
  items: ItemManager;
  particles: Particles;
  sky: Sky;
  audio = new AudioEngine();
  settings: Settings;
  meta: WorldMeta;
  input: InputState = { forward: false, back: false, left: false, right: false, jump: false, sneak: false, sprint: false };
  keys = new Set<string>();
  mouseDown = [false, false, false];
  running = false;
  paused = false;
  uiOpen = false;
  forceControls = false; // test hook: drive input without pointer lock
  station: Station = "hand";
  achievements = new Set<string>();
  stats: Record<string, number> = { mined: 0, placed: 0, kills: 0, deaths: 0, crafted: 0 };
  playTime = 0;
  private target: RayHit | null = null;
  private breakProgress = 0;
  private breakTarget: string | null = null;
  private placeCooldown = 0;
  private attackCooldown = 0;
  private digSoundTimer = 0;
  private hurtFlash = 0;
  private swing = 0;
  private hudTimer = 0;
  private saveTimer = 0;
  private lastFrame = 0;
  private frames = 0;
  private fpsTimer = 0;
  private fps = 0;
  private raf = 0;
  private handGroup = new THREE.Group();
  private handMesh: THREE.Mesh | null = null;
  private handItemId = -1;
  private highlight: THREE.LineSegments;
  private crackMesh: THREE.Mesh;
  private crackTex: THREE.Texture;
  private sleepFade = 0;
  private sleeping = false;
  private nightSurvived = false;
  private wasNight = false;
  private lastSpaceTime = 0;
  private currentFov = 75;
  private disposed = false;
  private dirtyTimerLightLazy = 0;

  constructor(public canvas: HTMLCanvasElement, meta: WorldMeta, settings: Settings) {
    this.meta = meta;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.05, 1000);
    this.camera.rotation.order = "YXZ";
    this.currentFov = settings.fov;
    buildAtlas();
    this.world = new World(meta.seed);
    this.world.renderDistance = settings.renderDistance;
    this.scene.add(this.world.group);
    this.sky = new Sky(this.scene, this.world);
    this.particles = new Particles(this.world);
    this.particles.setPixelRatio(this.renderer.getPixelRatio());
    this.scene.add(this.particles.points);
    this.items = new ItemManager(this.world);
    this.scene.add(this.items.group);
    this.mobs = new MobManager(this.world, {
      onDrop: (id, n, x, y, z) => this.items.drop(id, n, x, y, z, (Math.random() - 0.5) * 3, 4, (Math.random() - 0.5) * 3),
      onHurtPlayer: (dmg, kx, kz) => {
        this.player.damage(dmg, "zombie");
        this.player.body.vx += kx * 7;
        this.player.body.vz += kz * 7;
        this.player.body.vy = Math.max(this.player.body.vy, 4);
      },
      onSound: (kind, x, y, z) => this.audio.play(kind, x, y, z),
      onParticles: (x, y, z, type) => {
        if (!this.settings.particles) return;
        if (type === "hit") for (let i = 0; i < 8; i++) this.particles.spawn(x, y, z, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 0.8, 0.1, 0.1, 0.1, 0.5);
        else if (type === "fire") this.particles.spawn(x, y, z, 0, 1, 0, 1, 0.5 + Math.random() * 0.4, 0.1, 0.12, 0.5, 2);
        else for (let i = 0; i < 20; i++) this.particles.spawn(x, y, z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5, 0.9, 0.9, 0.9, 0.12, 0.8, 2);
      },
    });
    this.mobs.peaceful = meta.difficulty === "peaceful";
    this.scene.add(this.mobs.group);
    this.player.creative = meta.mode === "creative";

    // highlight + crack
    this.highlight = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthTest: true }));
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.crackTex = buildAtlas().clone();
    this.crackTex.repeat.set(1 / ATLAS_TILES, 1 / ATLAS_TILES);
    this.crackTex.needsUpdate = true;
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.004, 1.004, 1.004), new THREE.MeshBasicMaterial({ map: this.crackTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, fog: false }));
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    // hand
    this.camera.add(this.handGroup);
    this.scene.add(this.camera);

    this.player.onHurt = (amount, cause) => {
      this.hurtFlash = 1;
      this.audio.play("hurt");
      void amount;
      void cause;
    };
    this.player.onDeath = (cause) => this.onDeath(cause);
    this.player.onStep = (block) => {
      const def = BLOCKS[block];
      if (def) this.audio.playMat("step", def.sound);
    };
    this.player.onSplash = () => {
      this.audio.play("splash");
      this.award("swim");
      if (this.settings.particles) {
        const b = this.player.body;
        for (let i = 0; i < 20; i++) this.particles.spawn(b.x + (Math.random() - 0.5), b.y + 0.9, b.z + (Math.random() - 0.5), (Math.random() - 0.5) * 3, Math.random() * 4, (Math.random() - 0.5) * 3, 0.6, 0.75, 1, 0.08, 0.6);
      }
    };
    this.sky.onThunder = (dist) => setTimeout(() => this.audio.play("thunder"), dist * 2000);
    this.world.onBlockChanged = null;
    this.bindEvents();
  }

  // ---------- lifecycle ----------
  async start() {
    store.set({ screen: "loading", loadingProgress: 0, loadingText: "Preparing world…", worldName: this.meta.name, creative: this.player.creative });
    const data = loadWorldData(this.meta.id);
    let spawn: { x: number; y: number; z: number };
    if (data) {
      this.loadSave(data);
      spawn = { x: data.player.x, y: data.player.y, z: data.player.z };
    } else {
      spawn = this.world.gen.findSpawn();
      this.player.spawn = { ...spawn };
      if (this.player.creative) {
        // give creative players nothing; palette is available
      } else {
        // small starter kit for a smoother first minute
      }
    }
    this.player.teleport(spawn.x, spawn.y, spawn.z);
    // pre-generate
    const radius = Math.min(this.world.renderDistance, 6);
    const total = Math.PI * (radius + 1.5) ** 2;
    await new Promise<void>((resolve) => {
      const step = () => {
        if (this.disposed) return resolve();
        this.world.update(this.player.body.x, this.player.body.z, 40);
        const done = this.world.stats.meshed;
        store.set({ loadingProgress: Math.min(0.99, done / total), loadingText: `Generating terrain… ${this.world.stats.generated} chunks` });
        if (this.world.isAreaReady(this.player.body.x, this.player.body.z, radius)) resolve();
        else requestAnimationFrame(step);
      };
      step();
    });
    if (this.disposed) return;
    if (!data) {
      // Snap onto the surface
      const sy = this.findGroundY(Math.floor(spawn.x), Math.floor(spawn.z));
      this.player.teleport(spawn.x, sy + 1, spawn.z);
      this.player.spawn = { x: spawn.x, y: sy + 1, z: spawn.z };
    }
    store.set({ screen: "playing", loadingProgress: 1 });
    this.running = true;
    this.lastFrame = performance.now();
    this.syncHud(true);
    store.toast(`Welcome to ${this.meta.name}`, this.player.creative ? "Creative mode: double-tap Space to fly" : "Punch trees to get started. Press E for inventory.");
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Terrain surface (ignoring trees/flora): first solid non-plant block below the column height with 2 free blocks above. */
  private findGroundY(x: number, z: number): number {
    const h = this.world.gen.column(x, z).height;
    for (let y = Math.min(h + 2, HEIGHT - 3); y > 0; y--) {
      const id = this.world.getBlock(x, y, z);
      const def = BLOCKS[id];
      const free = (id2: number) => !BLOCKS[id2]?.solid && id2 !== B.WATER && id2 !== B.LAVA;
      if (def && def.solid && free(this.world.getBlock(x, y + 1, z)) && free(this.world.getBlock(x, y + 2, z))) return y;
    }
    return this.world.getSurfaceY(x, z);
  }

  dispose() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
    this.mobs.clear();
    this.items.clear();
    for (const c of this.world.chunks.values()) {
      c.opaqueMesh?.geometry.dispose();
      c.waterMesh?.geometry.dispose();
    }
    this.renderer.dispose();
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // ---------- save/load ----------
  private loadSave(d: SaveData) {
    for (const key of Object.keys(d.chunks)) {
      const [cx, cz] = key.split(",").map(Number);
      const arr = d.chunks[key];
      const m = new Map<number, number>();
      for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
      this.world.diffs.set(((cx & 0xffff) << 16) | (cz & 0xffff), m);
    }
    this.inventory.load(d.inventory);
    this.player.yaw = d.player.yaw;
    this.player.pitch = d.player.pitch;
    this.player.health = d.player.health;
    this.player.hunger = d.player.hunger;
    this.player.saturation = d.player.saturation ?? 5;
    this.player.xp = d.player.xp ?? 0;
    this.player.flying = d.player.flying && this.player.creative;
    this.player.spawn = d.player.spawn;
    this.sky.load(d.sky as { time: number; weather: "clear" | "rain" | "storm"; weatherTimer: number });
    this.achievements = new Set(d.achievements ?? []);
    this.stats = { ...this.stats, ...(d.stats ?? {}) };
    this.playTime = d.playTime ?? 0;
  }

  save(): boolean {
    const chunks: Record<string, number[]> = {};
    for (const [key, m] of this.world.diffs) {
      if (m.size === 0) continue;
      const cx = (key >> 16) << 16 >> 16; // sign-extend
      const cz = (key << 16) >> 16;
      const arr: number[] = [];
      for (const [i, id] of m) arr.push(i, id);
      chunks[`${cx},${cz}`] = arr;
    }
    const p = this.player;
    const data: SaveData = {
      player: { x: p.body.x, y: p.body.y, z: p.body.z, yaw: p.yaw, pitch: p.pitch, health: p.health, hunger: p.hunger, saturation: p.saturation, xp: p.xp, flying: p.flying, spawn: p.spawn },
      inventory: this.inventory.serialize(),
      sky: this.sky.serialize(),
      chunks,
      achievements: [...this.achievements],
      stats: this.stats,
      playTime: this.playTime,
    };
    const ok = saveWorldData(this.meta.id, data);
    this.meta.lastPlayed = Date.now();
    this.meta.playTime = this.playTime;
    updateWorldMeta(this.meta);
    return ok;
  }

  // ---------- events ----------
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const k = e.code;
    this.keys.add(k);
    if (store.state.screen === "dead") return;
    if (k === "KeyE" || (k === "Escape" && this.uiOpen)) {
      e.preventDefault();
      if (this.uiOpen) this.closeUI();
      else if (!this.paused) this.openUI("hand");
      return;
    }
    if (this.uiOpen || this.paused) return;
    if (k.startsWith("Digit")) {
      const n = parseInt(k.slice(5));
      if (n >= 1 && n <= 9) {
        this.inventory.selected = n - 1;
        this.inventory.touch();
      }
    }
    if (k === "Space") {
      const now = performance.now();
      if (this.player.creative && now - this.lastSpaceTime < 280) {
        this.player.flying = !this.player.flying;
        this.player.body.vy = 0;
        this.lastSpaceTime = 0;
      } else this.lastSpaceTime = now;
    }
    if (k === "KeyQ") this.dropHeld(e.ctrlKey);
    if (k === "F3") {
      e.preventDefault();
      this.settings.showDebug = !this.settings.showDebug;
    }
    if (k === "KeyF" && this.player.creative) {
      this.player.flying = !this.player.flying;
      this.player.body.vy = 0;
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onMouseDown = (e: MouseEvent) => {
    if (this.uiOpen || this.paused || store.state.screen !== "playing") return;
    if (!document.pointerLockElement) {
      this.requestLock();
      return;
    }
    this.mouseDown[e.button] = true;
    if (e.button === 0) this.attackOrBreak(true);
    if (e.button === 2) this.use();
    if (e.button === 1) this.pickBlock();
  };
  private onMouseUp = (e: MouseEvent) => {
    this.mouseDown[e.button] = false;
    if (e.button === 0) {
      this.breakProgress = 0;
      this.breakTarget = null;
    }
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!document.pointerLockElement || this.uiOpen || this.paused) return;
    const s = 0.0022 * this.settings.sensitivity;
    this.player.yaw -= e.movementX * s;
    this.player.pitch -= e.movementY * s * (this.settings.invertY ? -1 : 1);
    this.player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.player.pitch));
  };
  private onWheel = (e: WheelEvent) => {
    if (this.uiOpen || this.paused) return;
    const dir = e.deltaY > 0 ? 1 : -1;
    this.inventory.selected = (this.inventory.selected + dir + 9) % 9;
    this.inventory.touch();
  };
  private onLockChange = () => {
    const locked = document.pointerLockElement === this.canvas;
    store.set({ pointerLocked: locked });
    if (!locked && !this.uiOpen && store.state.screen === "playing") this.pause();
    if (!locked) {
      this.mouseDown = [false, false, false];
      this.keys.clear();
    }
  };
  private onResize = () => {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  };
  private onBlur = () => {
    this.keys.clear();
    this.mouseDown = [false, false, false];
  };
  private onBeforeUnload = () => {
    if (this.running) this.save();
  };
  private onContext = (e: Event) => e.preventDefault();

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    document.addEventListener("pointerlockchange", this.onLockChange);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    this.canvas.addEventListener("contextmenu", this.onContext);
  }
  private unbindEvents() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("pointerlockchange", this.onLockChange);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    this.canvas.removeEventListener("contextmenu", this.onContext);
  }

  requestLock() {
    this.audio.init();
    this.audio.volumes = { master: this.settings.master, sfx: this.settings.sfx, music: this.settings.music, ambient: this.settings.ambient };
    this.audio.applyVolumes();
    try {
      const p = this.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch { /* ignore */ }
  }

  // ---------- UI state ----------
  openUI(station: Station) {
    this.uiOpen = true;
    this.station = station;
    this.mouseDown = [false, false, false];
    store.set({ screen: "inventory", station });
    this.audio.play("open");
    if (document.pointerLockElement) document.exitPointerLock();
  }
  closeUI() {
    this.uiOpen = false;
    this.inventory.returnCursor();
    store.set({ screen: "playing" });
    this.requestLock();
  }
  pause() {
    if (this.paused || store.state.screen === "dead") return;
    this.paused = true;
    this.uiOpen = false;
    store.set({ screen: "paused" });
    this.save();
    if (document.pointerLockElement) document.exitPointerLock();
  }
  resume() {
    this.paused = false;
    this.uiOpen = false;
    store.set({ screen: "playing" });
    this.lastFrame = performance.now();
    this.requestLock();
  }
  applySettings(s: Settings) {
    this.settings = s;
    this.world.renderDistance = s.renderDistance;
    this.camera.fov = s.fov;
    this.camera.updateProjectionMatrix();
    this.audio.volumes = { master: s.master, sfx: s.sfx, music: s.music, ambient: s.ambient };
    this.audio.applyVolumes();
  }
  respawn() {
    this.player.respawn();
    const sx = Math.floor(this.player.spawn.x), sz = Math.floor(this.player.spawn.z);
    if (this.world.isLoaded(sx, sz)) {
      const sy = this.findGroundY(sx, sz);
      if (sy > 0) this.player.teleport(this.player.spawn.x, sy + 1, this.player.spawn.z);
    }
    this.paused = false;
    this.uiOpen = false;
    store.set({ screen: "playing" });
    this.requestLock();
  }
  private onDeath(cause: string) {
    this.stats.deaths++;
    this.audio.play("death");
    const causes: Record<string, string> = {
      fall: "You fell from a high place",
      lava: "You tried to swim in lava",
      drown: "You drowned",
      starve: "You starved to death",
      zombie: "You were slain by a Zombie",
      cactus: "You were pricked to death",
      void: "You fell out of the world",
    };
    store.set({ screen: "dead", deathCause: causes[cause] ?? "You died" });
    this.mouseDown = [false, false, false];
    if (document.pointerLockElement) document.exitPointerLock();
    // drop inventory in survival
    if (!this.player.creative) {
      const b = this.player.body;
      for (let i = 0; i < 36; i++) {
        const s = this.inventory.slots[i];
        if (s) this.items.drop(s.id, s.count, b.x, b.y + 1, b.z, (Math.random() - 0.5) * 4, 3, (Math.random() - 0.5) * 4, s.durability, 2);
        this.inventory.slots[i] = null;
      }
      this.inventory.touch();
    }
  }

  craft(r: Recipe) {
    if (doCraft(this.inventory, r)) {
      this.audio.play("craft");
      this.stats.crafted++;
      const id = r.out.id;
      if (id === B.CRAFTING_TABLE) this.award("table");
      if (id === I.WOOD_PICKAXE) this.award("pickaxe");
      if (id === I.STONE_PICKAXE) this.award("stone_pick");
      if (id === B.FURNACE) this.award("furnace");
      if (id === I.IRON_INGOT) this.award("iron");
      this.player.xp += 1;
    }
  }

  giveCreative(id: number) {
    this.inventory.add(id, getStackSize(id));
    this.audio.play("pickup");
  }

  award(key: string) {
    if (this.achievements.has(key)) return;
    const a = ACHIEVEMENTS[key];
    if (!a) return;
    this.achievements.add(key);
    store.toast(a.title, a.body, a.icon, "achievement");
    this.audio.play("achievement");
    this.player.xp += 5;
  }

  // ---------- interaction ----------
  private lookDir(): THREE.Vector3 {
    const v = new THREE.Vector3(0, 0, -1);
    v.applyQuaternion(this.camera.quaternion);
    return v;
  }

  private updateTarget() {
    const d = this.lookDir();
    const reach = this.player.creative ? 7 : 5;
    const p = this.player;
    this.target = raycast(this.world, p.body.x, p.eyeY, p.body.z, d.x, d.y, d.z, reach);
    if (this.target && !p.dead && !this.uiOpen) {
      this.highlight.visible = true;
      this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    } else this.highlight.visible = false;
  }

  private attackOrBreak(initial: boolean) {
    const p = this.player;
    if (p.dead) return;
    const d = this.lookDir();
    const hitMob = this.mobs.raycast(p.body.x, p.eyeY, p.body.z, d.x, d.y, d.z, 4);
    if (hitMob && (!this.target || hitMob.dist < this.target.dist) && initial && this.attackCooldown <= 0) {
      const held = this.inventory.held;
      const tool = held ? getTool(held.id) : undefined;
      const dmg = tool ? tool.damage : 1;
      this.mobs.hit(hitMob.mob, dmg, d.x, d.z);
      this.attackCooldown = 0.45;
      this.swing = 1;
      this.audio.play("hit");
      if (tool && tool.type === "sword" && this.inventory.damageHeld()) this.audio.play("tool_break");
      if (hitMob.mob.health <= 0) {
        this.stats.kills++;
        this.player.xp += 2;
        if (hitMob.mob.kind === "zombie") this.award("zombie");
      }
      return;
    }
    if (initial) this.swing = 1;
  }

  private updateBreaking(dt: number) {
    this.placeCooldown -= dt;
    this.attackCooldown -= dt;
    if (!this.mouseDown[0] || this.uiOpen || this.paused || this.player.dead) {
      this.crackMesh.visible = false;
      return;
    }
    if (!this.target) {
      this.breakProgress = 0;
      this.breakTarget = null;
      this.crackMesh.visible = false;
      if (this.swing <= 0) this.swing = 1;
      return;
    }
    // If a mob is in front, swing instead
    const d = this.lookDir();
    const hitMob = this.mobs.raycast(this.player.body.x, this.player.eyeY, this.player.body.z, d.x, d.y, d.z, 4);
    if (hitMob && hitMob.dist < this.target.dist) {
      if (this.attackCooldown <= 0) this.attackOrBreak(true);
      return;
    }
    const t = this.target;
    const key = `${t.x},${t.y},${t.z}`;
    const def = BLOCKS[t.id];
    if (!def) return;
    if (key !== this.breakTarget) {
      this.breakTarget = key;
      this.breakProgress = 0;
    }
    if (this.swing <= 0.2) this.swing = 1;
    const held = this.inventory.held;
    const tool = held ? getTool(held.id) : undefined;
    let time: number;
    let canHarvest = true;
    if (this.player.creative) time = 0.05;
    else {
      if (def.hardness === Infinity) return;
      const correct = tool && tool.type === def.tool;
      let speed = correct ? tool.speed : 1;
      if (def.tool === "none" && tool && tool.type === "sword" && def.sound === "grass") speed = 1.5; // swords cut foliage
      time = (def.hardness * 1.5) / speed;
      if (def.minTier > 0 && (!correct || tool!.tier < def.minTier)) {
        time = def.hardness * 5;
        canHarvest = false;
      }
      if (def.hardness === 0) time = 0.02;
      if (this.player.body.inWater) time *= 3;
      if (!this.player.body.onGround && !this.player.flying) time *= 2;
    }
    this.breakProgress += dt / Math.max(0.02, time);
    this.digSoundTimer -= dt;
    if (this.digSoundTimer <= 0) {
      this.digSoundTimer = 0.22;
      this.audio.playMat("dig", def.sound, t.x + 0.5, t.y + 0.5, t.z + 0.5);
      if (this.settings.particles && def.shape !== "liquid") {
        const cols = [tileRandomColor(def.tex[0], Math.random()), tileRandomColor(def.tex[def.tex.length - 1], Math.random())];
        this.particles.burst(t.x, t.y, t.z, cols, 3, this.lightAt(t.x + t.nx, t.y + t.ny, t.z + t.nz), 0.4);
      }
    }
    // crack overlay
    const stage = Math.min(9, Math.floor(this.breakProgress * 10));
    if (time > 0.15) {
      const ti = tileIndex(`crack_${stage}`);
      this.crackTex.offset.set((ti % ATLAS_TILES) / ATLAS_TILES, 1 - (Math.floor(ti / ATLAS_TILES) + 1) / ATLAS_TILES);
      this.crackMesh.position.set(t.x + 0.5, t.y + 0.5, t.z + 0.5);
      this.crackMesh.visible = true;
    } else this.crackMesh.visible = false;
    if (this.breakProgress >= 1) {
      this.breakBlock(t.x, t.y, t.z, canHarvest);
      this.breakProgress = 0;
      this.breakTarget = null;
      this.crackMesh.visible = false;
      if (this.player.creative) this.mouseDown[0] = this.mouseDown[0]; // allow continuous in creative
    }
  }

  private lightAt(x: number, y: number, z: number): number {
    const [s, b] = this.world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
    return Math.max((s / 15) * this.sky.sun, b / 15, 0.1);
  }

  breakBlock(x: number, y: number, z: number, harvest: boolean) {
    const id = this.world.getBlock(x, y, z);
    const def = BLOCKS[id];
    if (!def || id === B.AIR) return;
    this.world.setBlock(x, y, z, B.AIR);
    this.stats.mined++;
    this.audio.play("break", x + 0.5, y + 0.5, z + 0.5);
    if (this.settings.particles) {
      const cols = [tileRandomColor(def.tex[0], Math.random()), tileRandomColor(def.tex[def.tex.length - 1], Math.random()), tileRandomColor(def.tex[0], Math.random())];
      this.particles.burst(x, y, z, cols, 24, this.lightAt(x, y + 1, z));
    }
    // drops
    if (!this.player.creative) {
      let drop: { id: number; count: number } | null = null;
      if (harvest) {
        if (typeof def.drop === "function") drop = def.drop(Math.random());
        else if (typeof def.drop === "number") drop = { id: def.drop, count: 1 };
        else drop = { id, count: 1 };
      }
      if (drop) {
        this.items.drop(drop.id, drop.count, x + 0.5, y + 0.3, z + 0.5, (Math.random() - 0.5) * 2, 2.5, (Math.random() - 0.5) * 2, undefined, 0.3);
        if (id === B.COAL_ORE || id === B.IRON_ORE || id === B.GOLD_ORE || id === B.DIAMOND_ORE) this.player.xp += 1;
      }
      const held = this.inventory.held;
      const tool = held ? getTool(held.id) : undefined;
      if (tool && tool.type !== "sword" && def.hardness > 0 && this.inventory.damageHeld()) this.audio.play("tool_break");
    }
    // support: break cross blocks above
    const above = this.world.getBlock(x, y + 1, z);
    if (above !== B.AIR && BLOCKS[above]?.shape === "cross") this.breakBlock(x, y + 1, z, true);
    if (id === B.LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG) this.award("wood");
    if (id === B.DIAMOND_ORE) this.award("diamond");
  }

  private use() {
    const p = this.player;
    if (p.dead) return;
    const held = this.inventory.held;
    const t = this.target;
    // interact with block
    if (t && !p.sneaking) {
      const def = BLOCKS[t.id];
      if (def?.interact === "crafting") return this.openUI("table");
      if (def?.interact === "furnace") return this.openUI("furnace");
      if (def?.interact === "bed") return this.sleep(t);
    }
    // eat
    if (held) {
      const food = getFood(held.id);
      if (food !== undefined) {
        if (p.hunger >= 20 && !p.creative) return;
        p.eat(food);
        this.audio.play("eat");
        setTimeout(() => this.audio.play("burp"), 500);
        if (held.id === I.MUSHROOM_STEW) this.inventory.add(I.BOWL, 1);
        if (!p.creative) this.inventory.consumeHeld();
        if (held.id === I.STEAK || held.id === I.COOKED_PORKCHOP || held.id === I.COOKED_MUTTON) this.award("food");
        this.swing = 1;
        this.placeCooldown = 0.5;
        return;
      }
    }
    // place block
    if (!t || !held || !isBlock(held.id) || this.placeCooldown > 0) return;
    const def = BLOCKS[held.id];
    let px = t.x + t.nx, py = t.y + t.ny, pz = t.z + t.nz;
    // replace tall grass / flowers directly
    const targetDef = BLOCKS[t.id];
    if (targetDef?.shape === "cross" && targetDef.id !== B.TORCH) {
      px = t.x; py = t.y; pz = t.z;
    }
    if (py < 0 || py >= HEIGHT) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== B.AIR && existing !== B.WATER && BLOCKS[existing]?.shape !== "cross") return;
    if (def.solid && bodyIntersectsBlock(p.body, px, py, pz)) return;
    if (def.solid) for (const m of this.mobs.mobs) if (bodyIntersectsBlock(m.body, px, py, pz)) return;
    // cross blocks need support below
    if (def.shape === "cross" && def.id !== B.TORCH && def.id !== B.LANTERN) {
      const below = this.world.getBlock(px, py - 1, pz);
      if (!BLOCKS[below]?.solid) return;
    }
    if (def.id === B.TORCH || def.id === B.LANTERN) {
      // need any adjacent solid
      const ok = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]].some(([dx, dy, dz]) => BLOCKS[this.world.getBlock(px + dx, py + dy, pz + dz)]?.solid);
      if (!ok) return;
    }
    this.world.setBlock(px, py, pz, held.id);
    this.audio.playMat("dig", def.sound, px + 0.5, py + 0.5, pz + 0.5);
    this.audio.play("place", px + 0.5, py + 0.5, pz + 0.5);
    if (!p.creative) this.inventory.consumeHeld();
    this.placeCooldown = 0.2;
    this.swing = 1;
    this.stats.placed++;
    if (def.id === B.TORCH) this.award("torch");
    if (this.stats.placed >= 100) this.award("builder");
  }

  private sleep(t: RayHit) {
    if (!this.sky.isNight && this.sky.weather !== "storm") {
      store.toast("You can only sleep at night", undefined, B.BED);
      return;
    }
    for (const m of this.mobs.mobs) {
      if (m.def.hostile && Math.hypot(m.body.x - t.x, m.body.z - t.z) < 10) {
        store.toast("You may not rest now, there are monsters nearby", undefined, B.BED);
        return;
      }
    }
    this.sleeping = true;
    this.player.spawn = { x: t.x + 0.5, y: t.y + 1, z: t.z + 0.5 };
    this.audio.play("bed");
    setTimeout(() => {
      if (this.disposed) return;
      this.sky.skipToMorning();
      this.sky.setWeather("clear");
      this.sleeping = false;
      this.award("bed");
      store.toast("Spawn point set", "You woke up refreshed", B.BED);
      this.player.hunger = Math.max(this.player.hunger, 10);
    }, 1800);
  }

  private pickBlock() {
    if (!this.target || !this.player.creative) return;
    const id = this.target.id;
    const idx = this.inventory.slots.findIndex((s, i) => i < 9 && s?.id === id);
    if (idx >= 0) this.inventory.selected = idx;
    else {
      this.inventory.slots[this.inventory.selected] = { id, count: 64 };
    }
    this.inventory.touch();
  }

  private dropHeld(all: boolean) {
    const held = this.inventory.held;
    if (!held) return;
    const n = all ? held.count : 1;
    const d = this.lookDir();
    const p = this.player;
    this.items.drop(held.id, n, p.body.x + d.x * 0.5, p.eyeY - 0.3, p.body.z + d.z * 0.5, d.x * 5, 2 + d.y * 4, d.z * 5, held.durability, 1.2);
    this.inventory.consumeHeld(n);
    this.swing = 1;
  }

  private tryPickup = (e: ItemEntity): boolean => {
    const left = this.inventory.add(e.id, e.count, e.durability);
    if (left < e.count) {
      this.audio.play("pickup");
      if (e.id === B.LOG || e.id === B.BIRCH_LOG || e.id === B.SPRUCE_LOG) this.award("wood");
      if (e.id === I.DIAMOND) this.award("diamond");
      if (e.id === I.IRON_INGOT) this.award("iron");
    }
    if (left === 0) return true;
    e.count = left;
    return false;
  };

  // ---------- hand ----------
  private updateHand(dt: number) {
    const held = this.inventory.held;
    const id = held ? held.id : 0;
    if (id !== this.handItemId) {
      this.handItemId = id;
      if (this.handMesh) this.handGroup.remove(this.handMesh);
      if (id === 0) {
        const g = new THREE.BoxGeometry(0.16, 0.16, 0.42);
        const col = new Float32Array(g.attributes.position.count * 3);
        for (let i = 0; i < col.length; i += 3) {
          col[i] = 0.93; col[i + 1] = 0.75; col[i + 2] = 0.6;
        }
        g.setAttribute("color", new THREE.BufferAttribute(col, 3));
        this.handMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
        this.handMesh.position.set(0.42, -0.42, -0.72);
        this.handMesh.rotation.set(-0.9, 0.55, 0.35);
      } else {
        const mat = getEntityMaterial().clone();
        mat.fog = false;
        this.handMesh = new THREE.Mesh(makeItemGeometry(id, isBlock(id) && BLOCKS[id].shape !== "cross" ? 0.26 : 0.4), mat);
        if (isBlock(id) && BLOCKS[id].shape !== "cross") {
          this.handMesh.position.set(0.5, -0.46, -1.0);
          this.handMesh.rotation.set(0.12, -Math.PI / 5, 0);
        } else {
          this.handMesh.position.set(0.5, -0.42, -0.95);
          this.handMesh.rotation.set(0.2, -Math.PI / 2 + 0.5, 0.3);
        }
      }
      this.handGroup.add(this.handMesh);
    }
    // swing + bob
    this.swing = Math.max(0, this.swing - dt * 3.2);
    const s = Math.sin(this.swing * Math.PI);
    const bob = this.settings.bobbing ? Math.sin(this.player.walkCycle * 2) * 0.02 * Math.min(1, Math.hypot(this.player.body.vx, this.player.body.vz)) : 0;
    this.handGroup.position.set(Math.sin(this.player.walkCycle) * 0.02 * (this.settings.bobbing ? 1 : 0) - s * 0.3, bob - s * 0.25, s * 0.1);
    this.handGroup.rotation.set(-s * 0.9, s * 0.4, 0);
    if (this.handMesh) {
      const l = this.lightAt(this.player.body.x, this.player.eyeY, this.player.body.z);
      (this.handMesh.material as THREE.MeshBasicMaterial).color.setScalar(Math.max(0.25, l));
    }
  }

  // ---------- loop ----------
  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    if (dt > 0.1) dt = 0.1;
    this.frames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 1) {
      this.fps = this.frames;
      this.frames = 0;
      this.fpsTimer = 0;
    }
    const gameActive = !this.paused;
    const p = this.player;
    if (gameActive) {
      this.playTime += dt;
      // input
      const k = this.keys;
      const controls = !this.uiOpen && (document.pointerLockElement === this.canvas || this.forceControls);
      this.input.forward = controls && (k.has("KeyW") || k.has("ArrowUp"));
      this.input.back = controls && (k.has("KeyS") || k.has("ArrowDown"));
      this.input.left = controls && (k.has("KeyA") || k.has("ArrowLeft"));
      this.input.right = controls && (k.has("KeyD") || k.has("ArrowRight"));
      this.input.jump = controls && k.has("Space");
      this.input.sneak = controls && (k.has("ShiftLeft") || k.has("ShiftRight"));
      this.input.sprint = controls && (k.has("ControlLeft") || k.has("ControlRight") || k.has("KeyR"));

      // Only simulate when the player's chunk is loaded
      if (this.world.isLoaded(Math.floor(p.body.x), Math.floor(p.body.z))) {
        p.update(dt, this.input, this.world, now);
      }
      this.camera.position.set(p.body.x, p.eyeY, p.body.z);
      this.camera.rotation.set(p.pitch, p.yaw, 0);
      // fov
      const targetFov = this.settings.fov * (p.sprinting ? 1.12 : 1) * (p.headInWater ? 0.9 : 1);
      this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 8);
      if (Math.abs(this.camera.fov - this.currentFov) > 0.05) {
        this.camera.fov = this.currentFov;
        this.camera.updateProjectionMatrix();
      }

      this.updateTarget();
      this.updateBreaking(dt);
      if (this.mouseDown[2] && this.placeCooldown <= 0 && !this.uiOpen) this.use();

      // world streaming
      this.world.update(p.body.x, p.body.z, 7);
      this.dirtyTimerLightLazy += dt;

      // entities
      const sun = this.sky.sun;
      this.mobs.update(dt, p.body.x, p.body.y, p.body.z, sun, p.dead, p.creative);
      this.items.update(dt, p.body.x, p.body.y, p.body.z, sun, p.dead ? () => false : this.tryPickup);
      this.particles.update(dt);
      this.updateHand(dt);

      // achievements from state
      if (p.distanceWalked > 1000) this.award("explorer");
      if (p.body.y < 16) this.award("deep");
      if (this.sky.isNight) this.wasNight = true;
      else if (this.wasNight && !this.nightSurvived) {
        this.nightSurvived = true;
        this.award("night");
      }
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
      this.sleepFade = this.sleeping ? Math.min(1, this.sleepFade + dt * 1.5) : Math.max(0, this.sleepFade - dt * 1.5);

      // autosave
      this.saveTimer += dt;
      if (this.saveTimer > 30) {
        this.saveTimer = 0;
        this.save();
      }
    }

    // sky & atmosphere always update (even when paused, but time frozen)
    const biome = this.world.getBiome(Math.floor(p.body.x), Math.floor(p.body.z));
    const cold = biome === Biome.TAIGA || biome === Biome.SNOWY_PEAKS;
    const dry = biome === Biome.DESERT;
    this.sky.update(gameActive ? dt : 0, this.camera.position, this.world.renderDistance, cold, p.headInWater, this.renderer, dry);
    getUniforms().uTime.value = now / 1000;
    // audio ambience
    this.audio.listener = { x: p.body.x, y: p.eyeY, z: p.body.z, yaw: p.yaw };
    const [skyL] = this.world.getLight(Math.floor(p.body.x), Math.floor(p.eyeY), Math.floor(p.body.z));
    const underground = skyL < 4 && p.body.y < this.world.getSurfaceY(Math.floor(p.body.x), Math.floor(p.body.z)) - 3;
    this.audio.updateAmbience(dt, this.sky.weatherIntensity, underground, p.headInWater, this.sky.isNight);

    // main pass, then hand in a depth-cleared overlay pass so it is never occluded by nearby blocks
    this.handGroup.visible = false;
    this.renderer.render(this.scene, this.camera);
    if (!p.dead && !this.uiOpen) {
      this.handGroup.visible = true;
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.handGroup, this.camera);
      this.renderer.autoClear = true;
    }

    this.hudTimer += dt;
    if (this.hudTimer > 0.1) {
      this.hudTimer = 0;
      this.syncHud(false);
    }
  };

  private syncHud(full: boolean) {
    const p = this.player;
    const h = Math.floor(this.sky.hours), m = Math.floor((this.sky.hours % 1) * 60);
    const biome = this.world.getBiome(Math.floor(p.body.x), Math.floor(p.body.z));
    const patch: Parameters<typeof store.set>[0] = {
      health: Math.ceil(p.health),
      maxHealth: p.maxHealth,
      hunger: p.hunger,
      air: p.air,
      maxAir: p.maxAir,
      xp: p.xp,
      hotbar: this.inventory.slots.slice(0, 9),
      selected: this.inventory.selected,
      invVersion: this.inventory.version,
      creative: p.creative,
      flying: p.flying,
      underwater: p.headInWater,
      hurtFlash: this.hurtFlash,
      targetName: this.target ? getName(this.target.id) : null,
      breakProgress: this.breakProgress,
      timeString: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
      biome: BIOME_NAMES[biome] ?? "Unknown",
      fps: this.fps,
      sleepFade: this.sleepFade,
      playTime: this.playTime,
    };
    if (this.settings.showDebug) {
      const b = p.body;
      const [s, bl] = this.world.getLight(Math.floor(b.x), Math.floor(p.eyeY), Math.floor(b.z));
      patch.debug = [
        `Voxelcraft ${this.fps} fps | ${this.meta.mode}`,
        `XYZ: ${b.x.toFixed(2)} / ${b.y.toFixed(2)} / ${b.z.toFixed(2)}`,
        `Chunk: ${Math.floor(b.x) >> 4}, ${Math.floor(b.z) >> 4}  Facing: ${(((-p.yaw * 180) / Math.PI) % 360).toFixed(0)}°`,
        `Biome: ${BIOME_NAMES[biome]}  Light: sky ${s} block ${bl}`,
        `Chunks: ${this.world.chunks.size} loaded, ${this.world.stats.visible} visible, rd ${this.world.renderDistance}`,
        `Entities: ${this.mobs.mobs.length} mobs, ${this.items.items.length} items`,
        `Time: ${this.sky.time.toFixed(3)} sun ${this.sky.sun.toFixed(2)} weather ${this.sky.weather} (${this.sky.weatherIntensity.toFixed(2)})`,
        `Target: ${this.target ? `${getName(this.target.id)} @ ${this.target.x},${this.target.y},${this.target.z}` : "none"}`,
        `Seed: ${this.meta.seed}  Draw calls: ${this.renderer.info.render.calls}  Tris: ${this.renderer.info.render.triangles}`,
      ];
    } else if (store.state.debug.length) patch.debug = [];
    if (full) patch.worldName = this.meta.name;
    store.set(patch);
  }
}

export { CREATIVE_ITEMS, ITEMS, hashString };
export type { Mob };
