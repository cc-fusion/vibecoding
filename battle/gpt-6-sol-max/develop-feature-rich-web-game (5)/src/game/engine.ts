import * as THREE from "three";
import {
  BIOME_NAMES, BLOCKS, DIFFICULTIES, ITEMS, PERKS, PICK_TIER, PLACEABLES, RECIPES, TOOL_DURABILITY,
  type Biome, type BlockId, type DifficultyId, type ItemId, type MobType, type Panel, type PerkId, type Phase,
} from "./data";
import { SynthAudio } from "./audio";
import { ALTAR, VoxelWorld, WORLD_RADIUS, blockKey, parseBlockKey } from "./world";
import { createBlockMaterials, createSky, VisualKit } from "./visuals";

type Inventory = Partial<Record<ItemId, number>>;
type ToolHealth = Partial<Record<ItemId, number>>;
type Target =
  | { kind: "block"; x: number; y: number; z: number; block: BlockId; normal: THREE.Vector3; distance: number }
  | { kind: "mob"; id: number; distance: number }
  | { kind: "crystal"; index: number; distance: number }
  | { kind: "dragon"; distance: number };

interface Mob {
  id: number; type: MobType; x: number; y: number; z: number; hp: number; maxHp: number;
  group: THREE.Group; cooldown: number; wander: number; wanderTimer: number; flee: number;
  fuse: number; teleport: number; hit: number; age: number;
}
interface Projectile { position: THREE.Vector3; velocity: THREE.Vector3; mesh: THREE.Mesh; owner: "player" | "enemy" | "dragon"; damage: number; life: number; }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: THREE.Color; }
interface FloatText { id: number; text: string; color: string; x: number; y: number; z: number; life: number; }
interface Toast { id: number; title: string; detail?: string; tone: "normal" | "good" | "danger"; life: number; }
interface Crystal { x: number; y: number; z: number; hp: number; group: THREE.Group; gem: THREE.Mesh; }
interface Boss { x: number; y: number; z: number; hp: number; maxHp: number; time: number; fire: number; group: THREE.Group; wings: THREE.Group[]; crystals: Crystal[]; }
interface FurnaceJob { input: ItemId; output: ItemId; progress: number; duration: number; }
interface RunStats { mined: number; placed: number; crafted: number; kills: number; eaten: number; damage: number; distance: number; time: number; }

export interface MetaData {
  embers: number;
  perks: Record<PerkId, number>;
  bestScore: number;
  victories: number;
  runs: number;
  discovered: Biome[];
}

export interface GameSnapshot {
  phase: Phase; panel: Panel; difficulty: DifficultyId; volume: number; muted: boolean; shakeEnabled: boolean;
  health: number; maxHealth: number; hunger: number; xp: number; xpLevel: number; xpProgress: number; xpNext: number;
  inventory: Inventory; hotbar: (ItemId | null)[]; selected: number; toolHealth: ToolHealth;
  day: number; night: boolean; timeLabel: string; biome: Biome; x: number; z: number;
  altarDistance: number; bearing: string; quest: { title: string; detail: string; step: number };
  target: { name: string; hint: string; health?: number; maxHealth?: number } | null;
  mineProgress: number; swing: number; hurt: number; burn: number;
  toasts: Toast[]; floats: { id: number; text: string; color: string; left: number; top: number; opacity: number }[];
  stats: RunStats; score: number; legacyEarned: number; meta: MetaData;
  boss: { hp: number; maxHp: number; crystals: number } | null; dragonSlain: boolean;
  furnace: { job: FurnaceJob | null; fuel: number }; enchants: Record<string, number>;
  nearBench: boolean; nearFurnace: boolean; nearEnchanter: boolean; ritualReady: boolean;
  seed: number;
}

const CYCLE = 156;
const MAX_PARTICLES = 360;
const mobHealth: Record<MobType, number> = {
  zombie: 18, skeleton: 14, spider: 13, creeper: 17, enderman: 31,
  pig: 12, cow: 17, sheep: 13, chicken: 7,
};
const HOSTILES: MobType[] = ["zombie", "skeleton", "spider", "creeper", "enderman"];
const PASSIVES: MobType[] = ["pig", "cow", "sheep", "chicken"];
const emptyStats = (): RunStats => ({ mined: 0, placed: 0, crafted: 0, kills: 0, eaten: 0, damage: 0, distance: 0, time: 0 });
const freshMeta = (): MetaData => ({ embers: 0, perks: { heart: 0, provisions: 0, miner: 0, warden: 0 }, bestScore: 0, victories: 0, runs: 0, discovered: [] });
const random = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const distance2 = (ax: number, az: number, bx: number, bz: number) => Math.hypot(ax - bx, az - bz);

export class WildforgeGame {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.06, 170);
  readonly audio = new SynthAudio();
  readonly kit = new VisualKit();
  world: VoxelWorld;

  phase: Phase = "title";
  panel: Panel = null;
  difficulty: DifficultyId = "survivor";
  shakeEnabled = true;
  meta: MetaData = freshMeta();
  inventory: Inventory = {};
  hotbar: (ItemId | null)[] = ["woodPick", "wood", "stone", null, null, "seeds", "berry", null, null];
  toolHealth: ToolHealth = {};
  selected = 0;
  health = 20;
  maxHealth = 20;
  hunger = 100;
  xp = 0;
  xpLevel = 1;
  xpProgress = 0;
  xpNext = 14;
  enchants: Record<string, number> = { efficiency: 0, edge: 0, ward: 0, harvest: 0 };
  player = { x: 0, y: 3, z: 0, vx: 0, vz: 0, vy: 0, yaw: .65, pitch: -.05, onGround: true };
  stats = emptyStats();
  dayClock = CYCLE * .16;
  boss: Boss | null = null;
  dragonSlain = false;
  legacyEarned = 0;
  furnaceJob: FurnaceJob | null = null;
  furnaceFuel = 0;
  flags = { wood: false, bench: false, stonePick: false, furnace: false, iron: false, diamond: false, pearls: false, summoned: false };

  private host: HTMLElement;
  private onUpdate: (snapshot: GameSnapshot) => void;
  private blockMats = createBlockMaterials();
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private raycaster = new THREE.Raycaster();
  private aimDirection = new THREE.Vector3();
  private blockMeshes: THREE.InstancedMesh[] = [];
  private rayMeshes: THREE.InstancedMesh[] = [];
  private decor: THREE.InstancedMesh | null = null;
  private torchLights: THREE.PointLight[] = [];
  private altarGroup: THREE.Group | null = null;
  private altarBeam: THREE.Mesh | null = null;
  private altarLight: THREE.PointLight | null = null;
  private sky = createSky();
  private sun: THREE.Mesh;
  private moon: THREE.Mesh;
  private stars: THREE.Points;
  private clouds: THREE.Group[] = [];
  private ambient: THREE.HemisphereLight;
  private sunlight: THREE.DirectionalLight;
  private outline: THREE.LineSegments;
  private particleCloud: THREE.Points;
  private particlePositions = new Float32Array(MAX_PARTICLES * 3);
  private particleColors = new Float32Array(MAX_PARTICLES * 3);
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private toasts: Toast[] = [];
  private mobs: Mob[] = [];
  private projectiles: Projectile[] = [];
  private mobId = 1;
  private messageId = 1;
  private target: Target | null = null;
  private mineKey = "";
  private mineProgress = 0;
  private attackCooldown = 0;
  private spawnTimer = 4;
  private passiveTimer = 8;
  private cropTimer = 0;
  private targetTimer = 0;
  private toastCooldown = 0;
  private hungerTick = 0;
  private regenTick = 0;
  private burnTick = 0;
  private burn = 0;
  private hurtCooldown = 0;
  private hurtVisual = 0;
  private swingVisual = 0;
  private shake = 0;
  private viewBob = 0;
  private uiTimer = 0;
  private lastFrame = 0;
  private raf = 0;
  private disposed = false;
  private primary = false;
  private gamepadFire = false;
  private keys = new Set<string>();
  private touchMove = { x: 0, y: 0 };
  private touchLookPointer: number | null = null;
  private touchLast = { x: 0, y: 0 };
  private previousBiome: Biome = "meadow";
  private gamepadPrevious = { jump: false, place: false, interact: false, left: false, right: false, pause: false };
  private wasNight = false;
  private bossContactCooldown = 0;
  private finished = false;

  constructor(host: HTMLElement, onUpdate: (snapshot: GameSnapshot) => void) {
    this.host = host;
    this.onUpdate = onUpdate;
    this.meta = this.readMeta();
    try {
      const settings = JSON.parse(localStorage.getItem("wildforge-settings") || "{}");
      if (Object.prototype.hasOwnProperty.call(DIFFICULTIES, settings.difficulty)) this.difficulty = settings.difficulty;
      if (typeof settings.volume === "number") this.audio.setVolume(settings.volume);
      if (typeof settings.muted === "boolean") this.audio.setMuted(settings.muted);
      if (typeof settings.shake === "boolean") this.shakeEnabled = settings.shake;
    } catch { /* Storage may be unavailable. */ }

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.37;
    this.renderer.domElement.className = "game-canvas";
    this.renderer.domElement.style.touchAction = "none";
    host.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.Fog(0x9bbdbb, 28, 75);
    this.scene.add(this.sky.mesh);
    this.ambient = new THREE.HemisphereLight(0xc9e1e2, 0x59483f, 2.05);
    this.sunlight = new THREE.DirectionalLight(0xffe8bc, 2.35);
    this.scene.add(this.ambient, this.sunlight);
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(3.1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffdeb0, fog: false }));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xdce9e3, fog: false }));
    this.scene.add(this.sun, this.moon);
    const starArray: number[] = [];
    for (let i = 0; i < 190; i++) {
      const theta = Math.random() * Math.PI * 2;
      const height = random(.09, .95);
      const radius = Math.sqrt(1 - height * height) * 105;
      starArray.push(Math.cos(theta) * radius, height * 105, Math.sin(theta) * radius);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starArray, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xf6e7cd, size: .9, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.scene.add(this.stars);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshPhongMaterial({ color: 0x5f9da6, transparent: true, opacity: .8, shininess: 65, side: THREE.DoubleSide }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = .53;
    sea.name = "sea";
    this.scene.add(sea);

    const outlineGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.018, 1.018, 1.018));
    this.outline = new THREE.LineSegments(outlineGeo, new THREE.LineBasicMaterial({ color: 0xf7d9a1, transparent: true, opacity: .85, depthTest: false }));
    this.outline.visible = false;
    this.outline.renderOrder = 8;
    this.scene.add(this.outline);
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(this.particlePositions, 3));
    pointsGeo.setAttribute("color", new THREE.BufferAttribute(this.particleColors, 3));
    pointsGeo.setDrawRange(0, 0);
    this.particleCloud = new THREE.Points(pointsGeo, new THREE.PointsMaterial({ size: .17, vertexColors: true, transparent: true, opacity: .93, depthWrite: false }));
    this.particleCloud.frustumCulled = false;
    this.scene.add(this.particleCloud);

    this.world = new VoxelWorld(17342);
    this.makeClouds();
    this.buildWorld();
    this.addAltar();
    this.addGrass();
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.addEventListener("contextmenu", this.onContextMenu);
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { passive: false });
    this.emit();
    this.raf = requestAnimationFrame(this.loop);
  }

  private readMeta(): MetaData {
    try {
      const stored = JSON.parse(localStorage.getItem("wildforge-legacy") || "null") as Partial<MetaData> | null;
      if (!stored || typeof stored !== "object") return freshMeta();
      const base = freshMeta();
      const safeNumber = (value: unknown) => Number.isFinite(Number(value)) ? clamp(Math.floor(Number(value)), 0, 10000000) : 0;
      const perks = { ...base.perks };
      (Object.keys(PERKS) as PerkId[]).forEach((id) => { perks[id] = clamp(safeNumber(stored.perks?.[id]), 0, PERKS[id].max); });
      return {
        embers: safeNumber(stored.embers), bestScore: safeNumber(stored.bestScore),
        victories: safeNumber(stored.victories), runs: safeNumber(stored.runs), perks,
        discovered: Array.isArray(stored.discovered) ? stored.discovered.filter((b): b is Biome => typeof b === "string" && b in BIOME_NAMES) : [],
      };
    } catch { return freshMeta(); }
  }

  private saveMeta() { try { localStorage.setItem("wildforge-legacy", JSON.stringify(this.meta)); } catch { /* Private browsing is fine. */ } }
  private saveSettings() {
    try { localStorage.setItem("wildforge-settings", JSON.stringify({ difficulty: this.difficulty, volume: this.audio.volume, muted: this.audio.muted, shake: this.shakeEnabled })); } catch { /* Optional persistence. */ }
  }

  private resize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private makeClouds() {
    for (let i = 0; i < 12; i++) {
      const cloud = new THREE.Group();
      const x = random(-60, 60); const z = random(-60, 60);
      cloud.position.set(x, random(16, 24), z);
      const count = 3 + Math.floor(Math.random() * 3);
      for (let j = 0; j < count; j++) this.kit.box(cloud, random(2.6, 5), random(.45, 1), random(1.8, 3.4), "#e8e8d8", (j - count / 2) * 2.55, random(-.2, .2), random(-.8, .8));
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  private buildWorld() {
    for (const mesh of this.blockMeshes) { this.scene.remove(mesh); mesh.dispose(); }
    this.blockMeshes = [];
    this.rayMeshes = [];
    this.torchLights.forEach((light) => this.scene.remove(light));
    this.torchLights = [];
    const groups = new Map<BlockId, [number, number, number][]>();
    this.world.blocks.forEach((block, key) => {
      const [x, y, z] = parseBlockKey(key);
      if (!this.world.exposed(x, y, z, block)) return;
      if (!groups.has(block)) groups.set(block, []);
      groups.get(block)!.push([x, y, z]);
      if (block === "torch" && this.torchLights.length < 7) {
        const light = new THREE.PointLight(0xffb35f, 2.6, 8, 2);
        light.position.set(x, y + .37, z);
        this.scene.add(light);
        this.torchLights.push(light);
      }
    });
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    groups.forEach((positions, block) => {
      const mesh = new THREE.InstancedMesh(this.boxGeometry, this.blockMats.materials[block], positions.length);
      mesh.userData.positions = positions;
      mesh.userData.block = block;
      positions.forEach(([x, y, z], index) => {
        matrix.makeTranslation(x, y, z);
        if (block === "water") scale.set(1, .79, 1);
        else if (block === "crop" || block === "cropRipe") {
          const age = this.world.crops.get(blockKey(x, y, z)) || 0;
          scale.set(.23 + age * .43, .31 + age * .57, .23 + age * .43);
          matrix.setPosition(x, y - .32 + age * .28, z);
        } else if (block === "torch") { scale.set(.15, .64, .15); matrix.setPosition(x, y - .18, z); }
        else if (block === "bed") scale.set(1, .45, 1);
        else scale.set(1, 1, 1);
        matrix.scale(scale);
        mesh.setMatrixAt(index, matrix);
        const tint = .88 + ((Math.sin(x * 78.7 + z * 51.3 + y * 22.9) * 43758.3) % 1 + 1) % 1 * .18;
        color.setRGB(tint, tint, tint);
        mesh.setColorAt(index, color);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
      if (block === "water" || block === "glass") mesh.renderOrder = 2;
      this.scene.add(mesh);
      this.blockMeshes.push(mesh);
      if (block !== "water" && block !== "bedrock") this.rayMeshes.push(mesh);
    });
  }

  private addGrass() {
    if (this.decor) { this.scene.remove(this.decor); this.decor.geometry.dispose(); (this.decor.material as THREE.Material).dispose(); this.decor.dispose(); }
    const positions: [number, number, number, Biome][] = [];
    for (let x = -WORLD_RADIUS + 1; x < WORLD_RADIUS; x++) for (let z = -WORLD_RADIUS + 1; z < WORLD_RADIUS; z++) {
      const h = this.world.terrainHeight(x, z);
      const block = this.world.get(x, h, z);
      const hash = ((Math.sin(x * 69.3 + z * 83.7) * 7234.8) % 1 + 1) % 1;
      if ((block === "grass" || block === "pineGrass") && hash > .73) positions.push([x, h + .69, z, this.world.biomeAt(x, z)]);
    }
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.07, .34, .24), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), positions.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    positions.forEach(([x, y, z, biome], i) => {
      dummy.position.set(x + Math.sin(i * 44) * .29, y, z + Math.cos(i * 37) * .29);
      dummy.rotation.y = i * 2.4;
      dummy.scale.setScalar(.65 + (i % 5) * .1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.set(biome === "pinewood" ? "#649273" : i % 7 === 0 ? "#c2aa72" : "#94b873");
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.decor = mesh;
    this.scene.add(mesh);
  }

  private addAltar() {
    if (this.altarGroup) { this.scene.remove(this.altarGroup); this.kit.disposeGroup(this.altarGroup); (this.altarBeam?.material as THREE.Material | undefined)?.dispose(); }
    const altar = this.kit.altar(this.world);
    this.altarGroup = altar.group;
    this.altarBeam = altar.beam;
    this.altarLight = altar.light;
    this.scene.add(altar.group);
  }

  private updateSky(time: number) {
    const phase = (this.dayClock % CYCLE) / CYCLE;
    const sunHeight = Math.sin(phase * Math.PI * 2);
    const daylight = clamp((sunHeight + .2) * 1.6, .07, 1);
    const warmth = clamp(1 - Math.abs(sunHeight) * 3.2, 0, 1) * daylight;
    this.sky.material.uniforms.uDay.value = daylight;
    this.sky.material.uniforms.uWarm.value = warmth;
    this.sky.mesh.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    (this.stars.material as THREE.PointsMaterial).opacity = (1 - daylight) * .78;
    const angle = phase * Math.PI * 2;
    this.sun.position.set(this.camera.position.x + Math.cos(angle) * 73, this.camera.position.y + Math.sin(angle) * 67, this.camera.position.z - 31);
    this.moon.position.set(this.camera.position.x - Math.cos(angle) * 72, this.camera.position.y - Math.sin(angle) * 67, this.camera.position.z + 25);
    this.sunlight.position.copy(this.sun.position);
    this.sunlight.intensity = .25 + daylight * 2.15;
    this.ambient.intensity = .72 + daylight * 1.35;
    this.ambient.color.set(daylight < .4 ? 0xa2b8d0 : 0xd7ece4);
    this.sunlight.color.set(daylight < .52 ? 0xffbba0 : 0xffe7bd);
    (this.scene.fog as THREE.Fog).color.set(daylight < .32 ? 0x273a46 : 0x9ebcbb);
    if (this.altarBeam) (this.altarBeam.material as THREE.MeshBasicMaterial).opacity = this.boss ? .24 : .08 + (1 - daylight) * .13;
    if (this.altarLight) this.altarLight.intensity = this.boss ? 5 : 2 + (1 - daylight) * 2;
    this.clouds.forEach((cloud, i) => { cloud.position.x += (i % 3 === 0 ? .24 : .13) * time; if (cloud.position.x > 70) cloud.position.x = -70; });
  }

  private loop = (timestamp: number) => {
    if (this.disposed) return;
    const dt = Math.min(.05, this.lastFrame ? (timestamp - this.lastFrame) / 1000 : .016);
    this.lastFrame = timestamp;
    if (this.phase === "title") {
      const t = timestamp * .00016;
      this.camera.position.set(-12 + Math.sin(t) * 1.3, 9.5 + Math.cos(t * .7) * .4, 17 + Math.cos(t) * 1.7);
      this.camera.lookAt(7, 3.1, -8);
      this.dayClock = CYCLE * .115 + Math.sin(timestamp * .00012) * 3;
      this.audio.update(false, false, false);
    } else if (this.phase === "playing") {
      if (!this.panel) {
        this.stats.time += dt;
        this.dayClock += dt * (this.difficulty === "explorer" ? .88 : 1);
        this.updatePlayer(dt);
        this.updateCrops(dt);
        this.updateMobs(dt);
        this.updateBoss(dt);
        this.updateProjectiles(dt);
        this.updateTarget(dt);
        this.updateMining(dt);
        this.spawnTimer -= dt;
        this.passiveTimer -= dt;
        this.manageSpawns();
        this.updateSurvival(dt);
        this.checkBiome();
        this.audio.update(this.isNight(), this.mobs.some((mob) => HOSTILES.includes(mob.type) && distance2(mob.x, mob.z, this.player.x, this.player.z) < 9), !!this.boss);
      }
      this.updateFurnace(dt);
    } else if (this.phase === "paused" && !this.panel) {
      const pressed = !!navigator.getGamepads?.()[0]?.buttons[9]?.pressed;
      if (pressed && !this.gamepadPrevious.pause) this.resume();
      this.gamepadPrevious.pause = pressed;
    }
    this.updateParticles(dt);
    this.updateMessages(dt);
    this.updateSky(dt);
    this.renderer.render(this.scene, this.camera);
    this.uiTimer += dt;
    if (this.uiTimer > (this.phase === "playing" ? .105 : .28)) { this.uiTimer = 0; this.emit(); }
    this.raf = requestAnimationFrame(this.loop);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (event.target instanceof HTMLInputElement && key !== "escape") return;
    if ((this.panel || this.phase !== "playing") && event.target instanceof HTMLElement && event.target.closest("button") && key !== "escape") return;
    if (!this.panel && this.phase === "playing" && (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key) || event.code === "Space")) event.preventDefault();
    if (event.repeat && ["escape", "e", "f", "c", "i", "m", "h"].includes(key)) return;
    this.keys.add(key);
    if (this.phase === "title") {
      if (key === "enter") this.setPanel("newGame");
      if (key === "h") this.setPanel("help");
      if (key === "escape" && this.panel) this.setPanel(null);
      return;
    }
    if (key === "escape") { if (this.panel) this.setPanel(null); else if (this.phase === "playing") this.pause(); else if (this.phase === "paused") this.resume(); return; }
    if (this.phase === "paused") return;
    if (this.phase !== "playing") return;
    if (key === "h") { this.togglePanel("help"); return; }
    if (key === "i" || key === "tab") { event.preventDefault(); this.togglePanel("inventory"); return; }
    if (key === "c") { this.togglePanel("craft"); return; }
    if (key === "m") { this.togglePanel("map"); return; }
    if (this.panel) return;
    if (event.code === "Space" && !event.repeat) this.jump();
    if (key === "e") this.interact();
    if (key === "f") this.eat();
    if (/^[1-9]$/.test(key)) this.select(Number(key) - 1);
  };
  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.key.toLowerCase()); };
  private onMouseMove = (event: MouseEvent) => {
    if (this.phase !== "playing" || this.panel || document.pointerLockElement !== this.renderer.domElement) return;
    this.look(event.movementX, event.movementY);
  };
  private onPointerDown = (event: PointerEvent) => {
    if (this.phase !== "playing" || this.panel) return;
    this.audio.wake();
    if (event.pointerType === "touch") {
      if (event.clientX > window.innerWidth * .3) {
        this.touchLookPointer = event.pointerId;
        this.touchLast = { x: event.clientX, y: event.clientY };
        this.renderer.domElement.setPointerCapture(event.pointerId);
      }
      return;
    }
    if (document.pointerLockElement !== this.renderer.domElement) this.requestLock();
    if (event.button === 0) this.primary = true;
    if (event.button === 2) this.useSelected();
  };
  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "touch" && this.phase === "playing" && !this.panel && document.pointerLockElement !== this.renderer.domElement && event.buttons) {
      this.look(event.movementX * 1.7, event.movementY * 1.7);
      return;
    }
    if (event.pointerId !== this.touchLookPointer || this.panel) return;
    this.look((event.clientX - this.touchLast.x) * 1.9, (event.clientY - this.touchLast.y) * 1.9);
    this.touchLast = { x: event.clientX, y: event.clientY };
  };
  private onPointerUp = (event: PointerEvent) => {
    if (event.pointerType === "touch") { if (event.pointerId === this.touchLookPointer) this.touchLookPointer = null; return; }
    if (event.button === 0) this.primary = false;
  };
  private onPointerLockChange = () => {
    if (this.phase === "playing" && !this.panel && document.pointerLockElement !== this.renderer.domElement && !window.matchMedia("(pointer: coarse)").matches) this.pause();
  };
  private onBlur = () => { this.keys.clear(); this.primary = false; if (this.phase === "playing" && !this.panel) this.pause(); };
  private onVisibility = () => { if (document.hidden) this.onBlur(); };
  private onContextMenu = (event: MouseEvent) => event.preventDefault();
  private onWheel = (event: WheelEvent) => { if (this.phase === "playing" && !this.panel) { event.preventDefault(); this.select((this.selected + (event.deltaY > 0 ? 1 : 8)) % 9); } };

  private requestLock() {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    try { void this.renderer.domElement.requestPointerLock().catch(() => { /* Drag controls remain available on restricted browsers. */ }); } catch { /* Pointer lock is optional. */ }
  }
  private releaseLock() { if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock(); }
  private look(dx: number, dy: number) {
    this.player.yaw -= dx * .0023;
    this.player.pitch = clamp(this.player.pitch - dy * .0023, -1.47, 1.47);
  }
  setTouchMove(x: number, y: number) { this.touchMove = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }; }
  setTouchAction(action: "mine" | "place" | "jump" | "interact", down: boolean) {
    if (this.phase !== "playing" || this.panel) return;
    if (down) this.audio.wake();
    if (action === "mine") this.primary = down;
    if (down && action === "place") this.useSelected();
    if (down && action === "jump") this.jump();
    if (down && action === "interact") this.interact();
  }

  private resetWorld() {
    this.mobs.forEach((mob) => { this.scene.remove(mob.group); this.kit.disposeGroup(mob.group); });
    this.mobs = [];
    this.projectiles.forEach((projectile) => { this.scene.remove(projectile.mesh); projectile.mesh.geometry.dispose(); });
    this.projectiles = [];
    if (this.boss) this.clearBoss();
    this.world = new VoxelWorld(Math.floor(Math.random() * 900000) + 1000);
    this.buildWorld();
    this.addAltar();
    this.addGrass();
    this.particles = [];
    this.floats = [];
    this.toasts = [];
  }

  start(difficulty: DifficultyId = this.difficulty) {
    this.audio.wake();
    this.audio.resetMusic();
    this.difficulty = difficulty;
    this.saveSettings();
    this.resetWorld();
    this.phase = "playing";
    this.panel = null;
    this.finished = false;
    this.dragonSlain = false;
    this.legacyEarned = 0;
    this.player = { x: 0, y: this.world.surfaceY(0, 0) + .025, z: 0, vx: 0, vz: 0, vy: 0, yaw: .65, pitch: -.12, onGround: true };
    this.maxHealth = 20 + this.meta.perks.heart * 2;
    this.health = this.maxHealth;
    this.hunger = 100;
    this.xp = 0;
    this.xpLevel = 1;
    this.xpProgress = 0;
    this.xpNext = 14;
    this.enchants = { efficiency: 0, edge: 0, ward: 0, harvest: 0 };
    this.inventory = { woodPick: 1, wood: 2 + this.meta.perks.provisions * 2, berry: 3 + this.meta.perks.provisions * 2, seeds: 2 };
    this.hotbar = ["woodPick", "wood", "stone", null, null, "seeds", "berry", null, null];
    this.toolHealth = { woodPick: TOOL_DURABILITY.woodPick };
    this.selected = 0;
    this.stats = emptyStats();
    this.dayClock = CYCLE * .16;
    this.furnaceJob = null;
    this.furnaceFuel = 0;
    this.flags = { wood: false, bench: false, stonePick: false, furnace: false, iron: false, diamond: false, pearls: false, summoned: false };
    this.spawnTimer = 7;
    this.passiveTimer = 7;
    this.cropTimer = 0;
    this.attackCooldown = 0;
    this.hurtCooldown = 0;
    this.hungerTick = 0;
    this.regenTick = 0;
    this.burnTick = 0;
    this.hurtVisual = 0;
    this.swingVisual = 0;
    this.shake = 0;
    this.viewBob = 0;
    this.targetTimer = 0;
    this.toastCooldown = 0;
    this.bossContactCooldown = 0;
    this.burn = 0;
    this.primary = false;
    this.gamepadFire = false;
    this.gamepadPrevious = { jump: false, place: false, interact: false, left: false, right: false, pause: false };
    this.touchMove = { x: 0, y: 0 };
    this.touchLookPointer = null;
    this.keys.clear();
    this.mineProgress = 0;
    this.mineKey = "";
    this.target = null;
    this.outline.visible = false;
    this.previousBiome = "meadow";
    if (!this.meta.discovered.includes("meadow")) { this.meta.discovered.push("meadow"); this.saveMeta(); }
    this.mobId = 1;
    this.wasNight = false;
    this.spawnMob("pig", 4, -5);
    this.spawnMob("sheep", -5, 1);
    this.spawnMob("chicken", 2, 5);
    this.spawnMob("cow", -6, 5);
    this.toast("A new world wakes", "Gather timber. The altar is waiting beyond the cinder wastes.", "good");
    this.requestLock();
    this.emit();
  }

  restart() { this.start(this.difficulty); }
  toTitle() {
    this.releaseLock();
    this.phase = "title";
    this.panel = null;
    this.primary = false;
    this.touchMove = { x: 0, y: 0 };
    this.keys.clear();
    this.emit();
  }
  pause() {
    if (this.phase !== "playing") return;
    this.phase = "paused";
    this.primary = false;
    this.touchMove = { x: 0, y: 0 };
    this.keys.clear();
    this.releaseLock();
    this.emit();
  }
  resume() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.panel = null;
    this.requestLock();
    this.emit();
  }
  setPanel(panel: Panel) {
    if (this.phase !== "title" && this.phase !== "playing" && this.phase !== "paused") return;
    this.audio.wake();
    this.panel = panel;
    this.primary = false;
    this.touchMove = { x: 0, y: 0 };
    this.keys.clear();
    if (panel) this.releaseLock();
    else if (this.phase === "playing") this.requestLock();
    this.audio.play("ui");
    this.emit();
  }
  togglePanel(panel: Panel) { this.setPanel(this.panel === panel ? null : panel); }
  select(index: number) { this.selected = clamp(index, 0, 8); this.audio.play("ui"); this.emit(); }
  equip(item: ItemId) {
    if (this.phase !== "playing" || this.count(item) < 1) return;
    this.hotbar[this.selected] = item;
    this.audio.play("ui");
    this.emit();
  }
  setDifficulty(difficulty: DifficultyId) {
    this.difficulty = difficulty;
    this.saveSettings();
    if (this.phase === "playing") this.toast("World altered", `${DIFFICULTIES[difficulty].name} difficulty is now active.`, "normal");
    this.emit();
  }
  setVolume(volume: number) { this.audio.wake(); this.audio.setVolume(volume); this.saveSettings(); this.emit(); }
  setMuted(muted: boolean) { this.audio.wake(); this.audio.setMuted(muted); this.saveSettings(); this.emit(); }
  setShake(enabled: boolean) { this.shakeEnabled = enabled; this.saveSettings(); this.emit(); }

  private isNight() { const t = (this.dayClock % CYCLE) / CYCLE; return t >= .58 || t < .045; }
  private currentDay() { return Math.floor(this.dayClock / CYCLE) + 1; }
  private selectedItem(): ItemId | null {
    const item = this.hotbar[this.selected];
    return item && (this.inventory[item] || 0) > 0 ? item : null;
  }
  private count(item: ItemId) { return this.inventory[item] || 0; }

  private addItem(item: ItemId, amount: number) {
    if (amount <= 0) return;
    this.inventory[item] = this.count(item) + amount;
    if (TOOL_DURABILITY[item] && !this.toolHealth[item]) this.toolHealth[item] = TOOL_DURABILITY[item];
    if (!this.hotbar.includes(item)) {
      const slot = this.hotbar.findIndex((entry) => !entry);
      if (slot >= 0) this.hotbar[slot] = item;
    }
    if (item === "pearl" && this.count("pearl") >= 2) this.flags.pearls = true;
  }
  private takeItem(item: ItemId, amount: number) {
    if (this.count(item) < amount) return false;
    this.inventory[item] = this.count(item) - amount;
    return true;
  }
  private wearTool(item: ItemId | null, amount = 1) {
    if (!item || !TOOL_DURABILITY[item]) return;
    this.toolHealth[item] = (this.toolHealth[item] ?? TOOL_DURABILITY[item]!) - amount;
    if ((this.toolHealth[item] || 0) <= 0) {
      this.takeItem(item, 1);
      this.toolHealth[item] = 0;
      this.toast(`${ITEMS[item].name} broke`, "Craft a replacement at your workbench.", "danger");
      this.audio.play("mine");
    }
  }
  private gainXp(amount: number) {
    this.xp += amount;
    this.xpProgress += amount;
    while (this.xpProgress >= this.xpNext) {
      this.xpProgress -= this.xpNext;
      this.xpLevel++;
      this.xpNext = 10 + this.xpLevel * 5;
      this.audio.play("level");
      this.toast("Experience gained", `You reached level ${this.xpLevel}. Spend XP at an enchanter.`, "good");
    }
  }

  private toast(title: string, detail?: string, tone: Toast["tone"] = "normal") {
    this.toasts.push({ id: this.messageId++, title, detail, tone, life: 4.4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }
  private float(text: string, color: string, x: number, y: number, z: number) {
    this.floats.push({ id: this.messageId++, text, color, x, y, z, life: 1.25 });
    if (this.floats.length > 28) this.floats.shift();
  }
  private burst(x: number, y: number, z: number, color: string, amount = 12, force = 1) {
    const base = new THREE.Color(color);
    for (let i = 0; i < amount && this.particles.length < MAX_PARTICLES; i++) {
      this.particles.push({
        x, y, z,
        vx: random(-2, 2) * force, vy: random(.25, 3.8) * force, vz: random(-2, 2) * force,
        life: random(.35, .85), max: .85, color: base.clone().multiplyScalar(random(.75, 1.35)),
      });
    }
  }
  private updateParticles(dt: number) {
    let index = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy -= dt * 7;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      this.particlePositions[index * 3] = p.x;
      this.particlePositions[index * 3 + 1] = p.y;
      this.particlePositions[index * 3 + 2] = p.z;
      const fade = clamp(p.life / p.max, 0, 1);
      this.particleColors[index * 3] = p.color.r * fade;
      this.particleColors[index * 3 + 1] = p.color.g * fade;
      this.particleColors[index * 3 + 2] = p.color.b * fade;
      index++;
    }
    this.particleCloud.geometry.setDrawRange(0, index);
    (this.particleCloud.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.particleCloud.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
  private updateMessages(dt: number) {
    this.floats.forEach((f) => { f.life -= dt; f.y += dt * .48; });
    this.floats = this.floats.filter((f) => f.life > 0);
    this.toasts.forEach((t) => { t.life -= dt; });
    this.toasts = this.toasts.filter((t) => t.life > 0);
    this.hurtVisual = Math.max(0, this.hurtVisual - dt * 1.7);
    this.swingVisual = Math.max(0, this.swingVisual - dt * 3);
    this.shake = Math.max(0, this.shake - dt * 2.8);
    this.toastCooldown = Math.max(0, this.toastCooldown - dt);
  }

  private collides(x: number, feet: number, z: number) {
    if (x < -WORLD_RADIUS + .35 || x > WORLD_RADIUS - .35 || z < -WORLD_RADIUS + .35 || z > WORLD_RADIUS - .35) return true;
    const r = .28;
    const minX = Math.ceil(x - r - .5), maxX = Math.floor(x + r + .5);
    const minZ = Math.ceil(z - r - .5), maxZ = Math.floor(z + r + .5);
    const minY = Math.ceil(feet - .5), maxY = Math.floor(feet + 1.73 + .5);
    for (let bx = minX; bx <= maxX; bx++) for (let bz = minZ; bz <= maxZ; bz++) for (let by = minY; by <= maxY; by++) {
      if (!this.world.solid(bx, by, bz)) continue;
      if (x + r > bx - .5 && x - r < bx + .5 && z + r > bz - .5 && z - r < bz + .5 && feet < by + .5 && feet + 1.73 > by - .5) return true;
    }
    return false;
  }

  jump() {
    if (this.phase !== "playing" || this.panel || !this.player.onGround) return;
    this.player.vy = 7.45;
    this.player.onGround = false;
    this.audio.play("jump");
  }

  private gamepadInput(dt: number) {
    const pad = navigator.getGamepads?.()[0];
    if (!pad) { this.gamepadFire = false; return { x: 0, y: 0 }; }
    const deadzone = (v: number) => Math.abs(v) > .16 ? v : 0;
    this.look(deadzone(pad.axes[2] || 0) * dt * 950, deadzone(pad.axes[3] || 0) * dt * 950);
    const jump = !!pad.buttons[0]?.pressed;
    const place = !!pad.buttons[6]?.pressed;
    const interact = !!pad.buttons[2]?.pressed;
    const left = !!pad.buttons[4]?.pressed;
    const right = !!pad.buttons[5]?.pressed;
    const pause = !!pad.buttons[9]?.pressed;
    if (jump && !this.gamepadPrevious.jump) this.jump();
    if (place && !this.gamepadPrevious.place) this.useSelected();
    if (interact && !this.gamepadPrevious.interact) this.interact();
    if (left && !this.gamepadPrevious.left) this.select((this.selected + 8) % 9);
    if (right && !this.gamepadPrevious.right) this.select((this.selected + 1) % 9);
    if (pause && !this.gamepadPrevious.pause) this.pause();
    this.gamepadFire = !!pad.buttons[7]?.pressed;
    this.gamepadPrevious = { jump, place, interact, left, right, pause };
    return { x: deadzone(pad.axes[0] || 0), y: -deadzone(pad.axes[1] || 0) };
  }

  private updatePlayer(dt: number) {
    const gamepad = this.gamepadInput(dt);
    const p = this.player;
    const f = Number(this.keys.has("w") || this.keys.has("arrowup")) - Number(this.keys.has("s") || this.keys.has("arrowdown")) + this.touchMove.y + gamepad.y;
    const r = Number(this.keys.has("d") || this.keys.has("arrowright")) - Number(this.keys.has("a") || this.keys.has("arrowleft")) + this.touchMove.x + gamepad.x;
    const length = Math.max(1, Math.hypot(f, r));
    const forward = f / length;
    const right = r / length;
    const sprint = (this.keys.has("shift") || (Math.hypot(this.touchMove.x, this.touchMove.y) > .85)) && this.hunger > 8;
    const inWater = this.world.get(Math.round(p.x), Math.round(p.y + .3), Math.round(p.z)) === "water";
    const speed = (sprint ? 6.6 : 4.25) * (inWater ? .56 : 1);
    const vx = (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * right) * speed;
    const vz = (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * right) * speed;
    p.vx += (vx - p.vx) * Math.min(1, dt * 11);
    p.vz += (vz - p.vz) * Math.min(1, dt * 11);

    const moveAxis = (axis: "x" | "z", amount: number) => {
      if (Math.abs(amount) < .0001) return;
      const nx = axis === "x" ? p.x + amount : p.x;
      const nz = axis === "z" ? p.z + amount : p.z;
      if (!this.collides(nx, p.y, nz)) { p[axis] += amount; return; }
      if (p.onGround && !this.collides(nx, p.y + 1.02, nz) && !this.collides(p.x, p.y + 1.02, p.z)) {
        p.y += 1.02;
        p[axis] += amount;
        p.onGround = false;
      }
    };
    moveAxis("x", p.vx * dt);
    moveAxis("z", p.vz * dt);
    this.stats.distance += Math.hypot(p.vx, p.vz) * dt;
    p.vy -= (inWater ? 8 : 21) * dt;
    p.vy = Math.max(p.vy, -18);
    const steps = Math.ceil(Math.abs(p.vy * dt) / .11) || 1;
    p.onGround = false;
    for (let i = 0; i < steps; i++) {
      const next = p.y + p.vy * dt / steps;
      if (this.collides(p.x, next, p.z)) { if (p.vy < 0) p.onGround = true; p.vy = 0; break; }
      p.y = next;
    }
    if (p.y < .48) { p.y = .52; p.vy = 0; p.onGround = true; }
    const moving = Math.hypot(p.vx, p.vz);
    if (p.onGround && moving > .25) this.viewBob += dt * (sprint ? 13 : 9);
    const bob = p.onGround ? Math.sin(this.viewBob) * Math.min(.045, moving * .008) : 0;
    const jolt = this.shakeEnabled ? this.shake * .06 : 0;
    this.camera.position.set(p.x + random(-jolt, jolt), p.y + 1.58 + bob + random(-jolt, jolt), p.z + random(-jolt, jolt));
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.set(p.pitch, p.yaw, 0);
  }

  private updateSurvival(dt: number) {
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt);
    const moving = Math.hypot(this.player.vx, this.player.vz);
    const sprinting = this.keys.has("shift") && moving > 4.6;
    this.hunger = Math.max(0, this.hunger - dt * (.095 + (sprinting ? .26 : 0) + (this.primary || this.gamepadFire ? .035 : 0)) * DIFFICULTIES[this.difficulty].hunger);
    this.hungerTick += dt;
    this.regenTick += dt;
    if (this.hunger < 1 && this.hungerTick > 3) { this.hungerTick = 0; this.hurt(1, false); }
    if (this.hunger > 72 && this.health < this.maxHealth && this.regenTick > 5.5) { this.regenTick = 0; this.health = Math.min(this.maxHealth, this.health + 1); this.float("+1", "#92d9b1", this.player.x, this.player.y + 2, this.player.z); }
    if (this.burn > 0) {
      this.burn -= dt;
      this.burnTick += dt;
      if (this.world.get(Math.round(this.player.x), Math.round(this.player.y), Math.round(this.player.z)) === "water") this.burn = 0;
      if (this.burnTick > 1.3) { this.burnTick = 0; this.hurt(1, false); }
    }
  }

  private checkBiome() {
    const biome = this.world.biomeAt(Math.round(this.player.x), Math.round(this.player.z));
    if (biome === this.previousBiome) return;
    this.previousBiome = biome;
    this.toast(BIOME_NAMES[biome], "A new corner of the world discovered.", "normal");
    if (!this.meta.discovered.includes(biome)) { this.meta.discovered.push(biome); this.saveMeta(); }
  }

  private updateCrops(dt: number) {
    this.cropTimer += dt;
    if (this.cropTimer < 1) return;
    const elapsed = this.cropTimer;
    this.cropTimer = 0;
    let rebuild = false;
    this.world.crops.forEach((age, key) => {
      const [x, y, z] = parseBlockKey(key);
      if (this.world.get(x, y, z) !== "crop") return;
      let wet = false;
      for (let ox = -2; ox <= 2 && !wet; ox++) for (let oz = -2; oz <= 2; oz++) if (this.world.get(x + ox, y, z + oz) === "water" || this.world.get(x + ox, y - 1, z + oz) === "water") wet = true;
      const growth = elapsed / (this.isNight() ? 170 : 88) * (wet ? 1.75 : 1) * (this.world.biomeAt(x, z) === "cinder" ? .72 : 1);
      const next = Math.min(1, age + growth);
      if (Math.floor(age * 4) !== Math.floor(next * 4)) rebuild = true;
      this.world.crops.set(key, next);
      if (next >= 1) { this.world.set(x, y, z, "cropRipe"); rebuild = true; }
    });
    if (rebuild) this.buildWorld();
  }

  private updateTarget(dt: number, force = false) {
    this.targetTimer -= dt;
    if (!force && this.targetTimer > 0) return;
    this.targetTimer = .075;
    this.camera.getWorldDirection(this.aimDirection);
    this.raycaster.set(this.camera.position, this.aimDirection);
    this.raycaster.far = 6.3;
    const hits = this.raycaster.intersectObjects(this.rayMeshes, false);
    let closest: Target | null = null;
    if (hits.length) {
      const hit = hits[0];
      const mesh = hit.object as THREE.InstancedMesh;
      if (hit.instanceId !== undefined) {
        const coords = (mesh.userData.positions as [number, number, number][])[hit.instanceId];
        if (coords) closest = { kind: "block", x: coords[0], y: coords[1], z: coords[2], block: mesh.userData.block as BlockId, normal: hit.face?.normal.clone() || new THREE.Vector3(0, 1, 0), distance: hit.distance };
      }
    }
    const origin = this.camera.position;
    const ray = this.aimDirection;
    const test = (x: number, y: number, z: number, radius: number, max: number) => {
      const dx = x - origin.x, dy = y - origin.y, dz = z - origin.z;
      const along = dx * ray.x + dy * ray.y + dz * ray.z;
      if (along < 0 || along > max || (closest && along > closest.distance)) return -1;
      const off = dx * dx + dy * dy + dz * dz - along * along;
      return off < radius * radius ? along : -1;
    };
    this.mobs.forEach((mob) => {
      const dist = test(mob.x, mob.y + (mob.type === "spider" || mob.type === "chicken" ? .55 : mob.type === "enderman" ? 1.48 : 1.03), mob.z, mob.type === "spider" ? .75 : .66, 6.3);
      if (dist >= 0) closest = { kind: "mob", id: mob.id, distance: dist };
    });
    if (this.boss) {
      this.boss.crystals.forEach((crystal, index) => {
        const dist = test(crystal.x, crystal.y, crystal.z, .62, 6.3);
        if (dist >= 0) closest = { kind: "crystal", index, distance: dist };
      });
      const dist = test(this.boss.x, this.boss.y, this.boss.z - .55, 1.55, 6.3);
      if (dist >= 0) closest = { kind: "dragon", distance: dist };
    }
    this.target = closest;
    this.outline.visible = !!closest && closest.kind === "block";
    if (closest?.kind === "block") this.outline.position.set(closest.x, closest.y, closest.z);
    if (!closest || closest.kind !== "block" || blockKey(closest.x, closest.y, closest.z) !== this.mineKey) {
      this.mineProgress = 0;
      this.mineKey = "";
    }
  }

  private mineBlock(target: Extract<Target, { kind: "block" }>) {
    const { x, y, z, block } = target;
    if (this.world.get(x, y, z) !== block) return;
    this.world.set(x, y, z);
    const selected = this.selectedItem();
    this.wearTool(selected);
    this.stats.mined++;
    const info = BLOCKS[block];
    if (info.drop) {
      const bonus = ["coalOre", "ironOre", "diamondOre"].includes(block) && Math.random() < this.enchants.harvest * .18 ? 1 : 0;
      this.addItem(info.drop, 1 + bonus);
      this.float(`+${1 + bonus} ${ITEMS[info.drop].name}`, "#e6e0c4", x, y + .7, z);
    }
    if (block === "leaves" || block === "pineLeaves") {
      if (Math.random() < .32) { this.addItem("berry", 1); this.float("+ berries", "#f3a59c", x, y + .7, z); }
      if (Math.random() < .42) this.addItem("seeds", 1);
    }
    if (block === "grass" || block === "pineGrass") if (Math.random() < .22) this.addItem("seeds", 1);
    if (block === "crop" || block === "cropRipe") {
      this.addItem("seeds", block === "cropRipe" ? 2 : 1);
      if (block === "cropRipe") { this.addItem("wheat", 2 + (this.enchants.harvest > 0 ? 1 : 0)); this.gainXp(2); this.float("+ wheat", "#f6d48c", x, y + 1, z); }
    }
    if (block === "wood" || block === "pineWood") this.flags.wood = true;
    if (block === "diamondOre") this.flags.diamond = true;
    if (["coalOre", "ironOre", "diamondOre"].includes(block)) this.gainXp(block === "diamondOre" ? 6 : block === "ironOre" ? 3 : 2);
    if (["workbench", "furnace", "enchanter"].includes(block)) this.toast(`${info.name} recovered`, "The station is back in your inventory.", "normal");
    this.audio.play(block.includes("Wood") || block === "wood" || block === "leaves" || block === "pineLeaves" ? "wood" : "mine");
    this.burst(x, y, z, info.color, 13, .9);
    this.buildWorld();
    this.target = null;
    this.outline.visible = false;
    this.mineProgress = 0;
    this.mineKey = "";
    if (this.stats.mined === 1) this.toast("The world is yours to shape", "Mine resources, build a shelter and follow the altar's light.", "good");
  }

  private updateMining(dt: number) {
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (!this.primary && !this.gamepadFire) { this.mineProgress = Math.max(0, this.mineProgress - dt * 2); return; }
    const selected = this.selectedItem();
    if (selected === "bow") { if (this.attackCooldown <= 0) this.shootArrow(); return; }
    const target = this.target;
    if (target && target.kind !== "block") {
      this.mineProgress = 0;
      if (target.distance < 3.8 && this.attackCooldown <= 0) this.melee(target);
      return;
    }
    if (!target || target.kind !== "block") { this.mineProgress = 0; return; }
    const info = BLOCKS[target.block];
    if (info.hardness > 100) return;
    const tier = selected ? PICK_TIER[selected] || 0 : 0;
    if (info.tier && tier < info.tier) {
      if (this.toastCooldown <= 0) { this.toast(target.block === "diamondOre" ? "An iron pick is required" : "A pickaxe is required", "Upgrade your tools at a workbench.", "danger"); this.toastCooldown = 2.5; }
      return;
    }
    const key = blockKey(target.x, target.y, target.z);
    if (key !== this.mineKey) { this.mineKey = key; this.mineProgress = 0; }
    const isRock = ["stone", "basalt", "coalOre", "ironOre", "diamondOre", "furnace", "enchanter"].includes(target.block);
    const speed = isRock ? [.45, 1.15, 1.8, 2.6, 3.5][tier] : tier ? 1.35 + tier * .2 : 1.0;
    const swordPenalty = selected && selected.toLowerCase().includes("sword") ? .7 : 1;
    this.mineProgress += dt * speed * swordPenalty * (1 + this.meta.perks.miner * .12 + this.enchants.efficiency * .28) / info.hardness;
    this.swingVisual = Math.max(this.swingVisual, .17);
    if (this.mineProgress >= 1) this.mineBlock(target);
  }

  private nearBlock(block: BlockId, radius = 4) {
    const px = Math.round(this.player.x), pz = Math.round(this.player.z);
    const r = Math.ceil(radius);
    for (let x = px - r; x <= px + r; x++) for (let z = pz - r; z <= pz + r; z++) {
      if (distance2(px, pz, x, z) > radius) continue;
      for (let y = 1; y <= 8; y++) if (this.world.get(x, y, z) === block && Math.abs(y - this.player.y) < 4) return true;
    }
    return false;
  }

  craft(recipeId: string) {
    if (this.phase !== "playing") return;
    const recipe = RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    if (recipe.station === "bench" && !this.nearBlock("workbench")) { this.toast("Workbench needed", "Place one nearby to craft this recipe.", "danger"); return; }
    if (!Object.entries(recipe.costs).every(([item, amount]) => this.count(item as ItemId) >= amount)) { this.toast("Missing materials", "Gather the ingredients shown on the recipe.", "danger"); return; }
    Object.entries(recipe.costs).forEach(([item, amount]) => this.takeItem(item as ItemId, amount));
    if (TOOL_DURABILITY[recipe.output] && this.count(recipe.output) > 0) {
      this.toolHealth[recipe.output] = TOOL_DURABILITY[recipe.output];
    } else this.addItem(recipe.output, recipe.amount);
    if (recipe.output === "stonePick") this.flags.stonePick = true;
    this.stats.crafted++;
    this.gainXp(1);
    this.audio.play("craft");
    this.toast(`${ITEMS[recipe.output].name} crafted`, recipe.amount > 1 ? `${recipe.amount} added to your pack.` : "Ready for the journey.", "good");
    if (TOOL_DURABILITY[recipe.output]) {
      const slot = recipe.output.includes("Pick") ? 0 : recipe.output.includes("Sword") ? 3 : recipe.output === "bow" ? 4 : 8;
      this.hotbar[slot] = recipe.output;
      this.selected = slot;
    }
    this.emit();
  }

  private useSelected() {
    if (this.phase !== "playing" || this.panel) return;
    this.updateTarget(.1, true);
    const selected = this.selectedItem();
    if (!selected) { if (this.toastCooldown <= 0) { this.toast("Empty hand", "Select a block, seed, hoe or food from your hotbar."); this.toastCooldown = 2; } return; }
    if (ITEMS[selected].food) { this.eat(selected); return; }
    const target = this.target;
    if (!target || target.kind !== "block") return;
    const { x, y, z, block } = target;
    if (selected === "hoe" && target.normal.y > .5 && ["grass", "pineGrass", "dirt"].includes(block)) {
      if (this.world.get(x, y + 1, z)) return;
      this.world.set(x, y, z, "farmland");
      this.wearTool("hoe");
      this.buildWorld();
      this.audio.play("place");
      this.float("Tilled earth", "#d9bb8b", x, y + 1, z);
      this.emit();
      return;
    }
    if (selected === "seeds" && block === "farmland" && target.normal.y > .5) {
      if (this.world.get(x, y + 1, z)) return;
      this.takeItem("seeds", 1);
      this.world.set(x, y + 1, z, "crop");
      this.world.crops.set(blockKey(x, y + 1, z), 0);
      this.buildWorld();
      this.audio.play("place");
      this.float("Wheat planted", "#b9d298", x, y + 1.3, z);
      this.emit();
      return;
    }
    const place = PLACEABLES[selected];
    if (!place) return;
    const nx = x + Math.round(target.normal.x), ny = y + Math.round(target.normal.y), nz = z + Math.round(target.normal.z);
    if (!this.world.inside(nx, nz) || ny < 1 || ny > 11 || this.world.get(nx, ny, nz)) return;
    this.world.set(nx, ny, nz, place);
    if (this.collides(this.player.x, this.player.y, this.player.z)) { this.world.set(nx, ny, nz); return; }
    this.takeItem(selected, 1);
    this.stats.placed++;
    if (place === "workbench") this.flags.bench = true;
    if (place === "furnace") this.flags.furnace = true;
    this.buildWorld();
    this.audio.play("place");
    this.burst(nx, ny, nz, BLOCKS[place].color, 5, .35);
    this.float(`Placed ${ITEMS[selected].name}`, "#e5d1a4", nx, ny + .8, nz);
    this.emit();
  }

  eat(item?: ItemId) {
    if (this.phase !== "playing" || (this.panel && this.panel !== "inventory")) return;
    const food = item && ITEMS[item].food && this.count(item) ? item :
      ((this.health < this.maxHealth - 2 && this.count("bandage") ? "bandage" : null) ||
      (["cookedMeat", "bread", "berry", "rawMeat"] as ItemId[]).find((id) => this.count(id) > 0));
    if (!food) { this.toast("No food in your pack", "Harvest berries, grow wheat or hunt wildlife.", "danger"); return; }
    const healing = food === "bandage" ? 5 : food === "cookedMeat" ? 2 : food === "bread" ? 1 : 0;
    if (food === "bandage" && this.health >= this.maxHealth) { this.toast("Save your bandage", "Use it when you are injured."); return; }
    if (this.hunger >= 99 && (!healing || this.health >= this.maxHealth)) { this.toast("You're already full", "Save that food for the road."); return; }
    this.takeItem(food, 1);
    this.hunger = clamp(this.hunger + (ITEMS[food].food || 0), 0, 100);
    this.health = Math.min(this.maxHealth, this.health + healing);
    if (food === "rawMeat" && Math.random() < .3) { this.hurt(1, false); this.toast("Uncooked meat", "A furnace makes meals safer and more filling.", "danger"); }
    this.stats.eaten++;
    this.audio.play("eat");
    this.float(food === "bandage" ? "+5 health" : `+${ITEMS[food].food} hunger`, food === "bandage" ? "#a5ddb9" : "#e9c88b", this.player.x, this.player.y + 2, this.player.z);
    this.emit();
  }

  interact() {
    if (this.phase !== "playing" || this.panel) return;
    const altarDist = distance2(this.player.x, this.player.z, ALTAR.x, ALTAR.z);
    if (altarDist < 4.2 && !this.boss && !this.dragonSlain) { this.setPanel("ritual"); return; }
    this.updateTarget(.1, true);
    const target = this.target;
    let block = target?.kind === "block" && target.distance < 4.7 ? target.block : null;
    if (!block || !["workbench", "furnace", "enchanter", "bed"].includes(block)) {
      block = (["furnace", "enchanter", "bed", "workbench"] as BlockId[]).find((id) => this.nearBlock(id, 2.7)) || null;
    }
    if (block === "workbench") this.setPanel("craft");
    else if (block === "furnace") this.setPanel("smelt");
    else if (block === "enchanter") this.setPanel("enchant");
    else if (block === "bed") {
      if (this.boss) { this.toast("No rest while the dragon lives", "Finish what you started.", "danger"); return; }
      if (!this.isNight()) { this.toast("Not sleepy yet", "A bed skips the dangers of night."); return; }
      this.dayClock = (Math.floor(this.dayClock / CYCLE) + 1) * CYCLE + CYCLE * .12;
      this.hunger = Math.max(0, this.hunger - 15);
      this.health = Math.min(this.maxHealth, this.health + 4);
      this.mobs.filter((mob) => HOSTILES.includes(mob.type)).forEach((mob) => this.removeMob(mob));
      this.toast("Morning light", "You slept through the night. Hunger still follows.", "good");
      this.audio.play("level");
    } else this.toast("Nothing to use here", "Aim at a station, or approach the glowing altar.");
  }

  smelt(input: "ironOre" | "rawMeat" | "sand") {
    if (this.phase !== "playing" || !this.nearBlock("furnace")) return;
    if (this.furnaceJob) { this.toast("The furnace is busy", "Its current batch is still cooking."); return; }
    if (!this.count(input)) { this.toast("Missing ingredient", `Collect ${ITEMS[input].name.toLowerCase()} first.`, "danger"); return; }
    if (this.furnaceFuel < 1) {
      if (this.count("coal")) { this.takeItem("coal", 1); this.furnaceFuel += 3; }
      else if (this.count("wood")) { this.takeItem("wood", 1); this.furnaceFuel += 1; }
      else { this.toast("The fire needs fuel", "Feed it coal or timber.", "danger"); return; }
    }
    this.furnaceFuel--;
    this.takeItem(input, 1);
    const output: ItemId = input === "ironOre" ? "ironIngot" : input === "rawMeat" ? "cookedMeat" : "glass";
    this.furnaceJob = { input, output, progress: 0, duration: input === "ironOre" ? 7 : 5 };
    this.audio.play("place");
    this.toast("Furnace lit", `${ITEMS[output].name} will be ready shortly.`, "good");
    this.emit();
  }
  private updateFurnace(dt: number) {
    if (!this.furnaceJob) return;
    this.furnaceJob.progress += dt;
    if (this.furnaceJob.progress < this.furnaceJob.duration) return;
    const output = this.furnaceJob.output;
    this.addItem(output, 1);
    if (output === "ironIngot") this.flags.iron = true;
    this.gainXp(output === "ironIngot" ? 3 : 1);
    this.furnaceJob = null;
    this.audio.play("collect");
    this.toast(`${ITEMS[output].name} is ready`, "The forge has finished its work.", "good");
  }

  enchant(kind: "efficiency" | "edge" | "ward" | "harvest") {
    if (this.phase !== "playing" || !this.nearBlock("enchanter")) return;
    const rank = this.enchants[kind] || 0;
    const cost = 5 + rank * 4;
    if (rank >= 3) return;
    if (this.xp < cost || this.count("coal") < 1) { this.toast("The runes remain dark", `Requires ${cost} XP and one coal.`, "danger"); return; }
    this.xp -= cost;
    this.takeItem("coal", 1);
    this.enchants[kind] = rank + 1;
    this.audio.play("craft");
    this.burst(this.player.x, this.player.y + 1.2, this.player.z, "#b9a6db", 26, 1);
    this.toast("Enchantment bound", `${kind[0].toUpperCase() + kind.slice(1)} is now rank ${rank + 1}.`, "good");
    this.emit();
  }

  purchasePerk(id: PerkId) {
    if (this.phase !== "title" && this.phase !== "dead" && this.phase !== "won") return;
    const perk = PERKS[id];
    const rank = this.meta.perks[id];
    const cost = perk.baseCost * (rank + 1);
    if (rank >= perk.max || this.meta.embers < cost) return;
    this.meta.embers -= cost;
    this.meta.perks[id]++;
    this.saveMeta();
    this.audio.wake(); this.audio.play("craft");
    this.emit();
  }

  private spawnMob(type: MobType, x: number, z: number) {
    if (!this.world.inside(Math.round(x), Math.round(z))) return;
    const y = this.world.surfaceY(x, z);
    if (this.world.get(Math.round(x), Math.round(y + .2), Math.round(z)) === "water") return;
    const group = this.kit.mob(type);
    group.position.set(x, y, z);
    this.scene.add(group);
    this.mobs.push({
      id: this.mobId++, type, x, y, z, hp: mobHealth[type], maxHp: mobHealth[type], group,
      cooldown: random(.3, 2), wander: random(-Math.PI, Math.PI), wanderTimer: random(1, 4),
      flee: 0, fuse: 0, teleport: random(4, 8), hit: 0, age: 0,
    });
  }

  private removeMob(mob: Mob) {
    const index = this.mobs.findIndex((entry) => entry.id === mob.id);
    if (index < 0) return;
    this.mobs.splice(index, 1);
    this.scene.remove(mob.group);
    this.kit.disposeGroup(mob.group);
  }

  private manageSpawns() {
    const night = this.isNight();
    if (night && !this.wasNight) {
      this.toast("Night has fallen", `Day ${this.currentDay()}. Monsters stir beyond the torchlight.`, "danger");
      this.audio.play("boss");
      this.spawnTimer = .2;
    }
    if (!night && this.wasNight) this.toast("First light", "The worst of the night has passed.", "good");
    this.wasNight = night;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (night ? 2.8 : 8.5) / DIFFICULTIES[this.difficulty].spawns;
      const cinder = this.world.biomeAt(Math.round(this.player.x), Math.round(this.player.z)) === "cinder";
      const hostileCount = this.mobs.filter((mob) => HOSTILES.includes(mob.type)).length;
      const cap = Math.min(18, Math.ceil((night ? 5 : cinder ? 3 : 1) + this.currentDay() * (night ? 1.5 : .3) + (this.boss ? 2 : 0)));
      if (hostileCount < cap) {
        for (let attempt = 0; attempt < 14; attempt++) {
          const angle = random(0, Math.PI * 2);
          const range = random(9, 17);
          const x = Math.round(this.player.x + Math.sin(angle) * range);
          const z = Math.round(this.player.z + Math.cos(angle) * range);
          if (!this.world.inside(x, z) || this.world.terrainHeight(x, z) < 2) continue;
          if (this.mobs.some((mob) => distance2(mob.x, mob.z, x, z) < 2.2)) continue;
          let warded = false;
          for (let ox = -5; ox <= 5 && !warded; ox++) for (let oz = -5; oz <= 5; oz++) if (distance2(x, z, x + ox, z + oz) < 5 && this.world.get(x + ox, this.world.terrainHeight(x + ox, z + oz) + 1, z + oz) === "torch") warded = true;
          if (warded) continue;
          const roll = Math.random();
          let type: MobType = roll < .26 ? "zombie" : roll < .47 ? "skeleton" : roll < .69 ? "spider" : roll < .87 ? "creeper" : "enderman";
          if (cinder && Math.random() < .35) type = "enderman";
          if (!night && !cinder && type === "enderman") type = "zombie";
          this.spawnMob(type, x, z);
          break;
        }
      }
    }
    if (this.passiveTimer <= 0) {
      this.passiveTimer = 10;
      if (night || this.mobs.filter((mob) => PASSIVES.includes(mob.type)).length >= 9) return;
      for (let attempt = 0; attempt < 10; attempt++) {
        const x = Math.round(this.player.x + random(-13, 13));
        const z = Math.round(this.player.z + random(-13, 13));
        if (!this.world.inside(x, z) || distance2(x, z, this.player.x, this.player.z) < 5 || this.world.terrainHeight(x, z) < 2) continue;
        const biome = this.world.biomeAt(x, z);
        if (biome === "cinder" || biome === "dunes") continue;
        this.spawnMob(PASSIVES[Math.floor(Math.random() * PASSIVES.length)], x, z);
        break;
      }
    }
  }

  private updateMobs(dt: number) {
    for (const mob of [...this.mobs]) {
      mob.age += dt;
      mob.cooldown -= dt;
      mob.wanderTimer -= dt;
      mob.flee = Math.max(0, mob.flee - dt);
      mob.hit = Math.max(0, mob.hit - dt);
      const dx = this.player.x - mob.x;
      const dz = this.player.z - mob.z;
      const distance = Math.max(.01, Math.hypot(dx, dz));
      const hostile = HOSTILES.includes(mob.type);
      let direction = mob.wander;
      let speed = 0;
      if (hostile && distance < 18) {
        direction = Math.atan2(dx, dz);
        speed = mob.type === "spider" ? 2.35 : mob.type === "enderman" ? 1.8 : mob.type === "creeper" ? 1.55 : 1.35;
        if (mob.type === "skeleton") { if (distance < 5) direction += Math.PI; else if (distance < 9) speed = .25; }
        if (mob.type === "spider" && Math.sin(mob.age * 4) > .75) speed *= 1.8;
      } else if (!hostile) {
        if (mob.wanderTimer <= 0) { mob.wanderTimer = random(2, 5); mob.wander += random(-1.6, 1.6); }
        if (mob.flee > 0) { direction = Math.atan2(-dx, -dz); speed = mob.type === "chicken" ? 2.5 : 2.05; }
        else speed = Math.sin(mob.age * .7 + mob.id) > -.3 ? .49 : 0;
      }
      if (speed > 0) {
        const nx = mob.x + Math.sin(direction) * speed * dt;
        const nz = mob.z + Math.cos(direction) * speed * dt;
        const ny = this.world.surfaceY(nx, nz);
        const blocked = this.world.solid(Math.round(nx), Math.round(ny + .75), Math.round(nz));
        if (this.world.inside(Math.round(nx), Math.round(nz)) && Math.abs(ny - mob.y) < 1.2 && !blocked && this.world.get(Math.round(nx), Math.round(ny), Math.round(nz)) !== "water") {
          mob.x = nx; mob.z = nz; mob.y += (ny - mob.y) * Math.min(1, dt * 9);
        } else if (!hostile) mob.wander += 1.8 * dt;
      }
      mob.group.position.set(mob.x, mob.y + Math.sin(mob.age * (mob.type === "spider" ? 13 : 6)) * (speed > 0 ? .035 : .012), mob.z);
      mob.group.rotation.y = Math.atan2(-Math.sin(direction), -Math.cos(direction));
      const pulse = mob.hit > 0 ? 1 + mob.hit * .25 : mob.type === "creeper" && mob.fuse > 0 ? 1 + Math.sin(mob.age * 23) * .075 : 1;
      mob.group.scale.setScalar(pulse);

      if (!hostile) continue;
      if (!this.isNight() && (mob.type === "zombie" || mob.type === "skeleton") && mob.age > 15) {
        mob.hp -= dt * 1.15;
        if (mob.hp <= 0) { this.burst(mob.x, mob.y + 1, mob.z, "#f0ba7d", 9); this.removeMob(mob); continue; }
      }
      if (mob.type === "creeper") {
        mob.fuse = distance < 2.45 ? mob.fuse + dt : Math.max(0, mob.fuse - dt * 1.5);
        if (mob.fuse > 1.65) { this.creeperExplosion(mob); continue; }
      } else if (mob.type === "skeleton" && distance < 13 && distance > 2 && mob.cooldown <= 0) {
        this.enemyShot(new THREE.Vector3(mob.x, mob.y + 1.52, mob.z), 7.3, 2, "enemy");
        mob.cooldown = random(2.25, 3.3);
      } else if (mob.type === "enderman") {
        mob.teleport -= dt;
        if (mob.teleport <= 0 && distance > 5 && distance < 18) {
          const a = random(0, Math.PI * 2);
          const nx = this.player.x + Math.sin(a) * random(4, 7);
          const nz = this.player.z + Math.cos(a) * random(4, 7);
          if (this.world.inside(Math.round(nx), Math.round(nz))) {
            this.burst(mob.x, mob.y + 1.3, mob.z, "#b391d1", 10, .75);
            mob.x = nx; mob.z = nz; mob.y = this.world.surfaceY(nx, nz);
            this.burst(mob.x, mob.y + 1.3, mob.z, "#b391d1", 10, .75);
          }
          mob.teleport = random(5, 8);
        }
      }
      if (distance < (mob.type === "spider" ? 1.55 : 1.4) && mob.cooldown <= 0 && mob.type !== "creeper") {
        this.hurt(mob.type === "enderman" ? 4 : mob.type === "spider" ? 2.5 : 2);
        mob.cooldown = mob.type === "spider" ? 1.1 : 1.45;
      }
      if (distance > 29 && !this.boss) this.removeMob(mob);
    }
  }

  private creeperExplosion(mob: Mob) {
    this.audio.play("explosion");
    this.shake = 2.1;
    this.burst(mob.x, mob.y + 1, mob.z, "#d8bd8c", 48, 2.3);
    const dist = distance2(mob.x, mob.z, this.player.x, this.player.z);
    if (dist < 4.1) this.hurt(Math.max(2, (4.1 - dist) * 3));
    let changed = false;
    for (let x = Math.round(mob.x) - 2; x <= Math.round(mob.x) + 2; x++) for (let z = Math.round(mob.z) - 2; z <= Math.round(mob.z) + 2; z++) {
      if (distance2(x, z, mob.x, mob.z) > 2.5) continue;
      for (let y = 2; y <= 6; y++) {
        const block = this.world.get(x, y, z);
        if (block && ["leaves", "pineLeaves", "wood", "pineWood", "plank", "glass", "crop", "cropRipe", "torch"].includes(block) && Math.random() < .75) {
          this.world.set(x, y, z); changed = true;
        }
      }
    }
    if (changed) this.buildWorld();
    this.removeMob(mob);
  }

  private hurt(amount: number, scaled = true) {
    if (this.phase !== "playing" || this.hurtCooldown > 0) return;
    const resistance = 1 - this.meta.perks.warden * .08 - this.enchants.ward * .11;
    const damage = Math.max(1, Math.round(amount * (scaled ? DIFFICULTIES[this.difficulty].damage : 1) * resistance));
    this.health = Math.max(0, this.health - damage);
    this.stats.damage += damage;
    this.hurtCooldown = .65;
    this.hurtVisual = .9;
    this.shake = Math.max(this.shake, 1);
    this.audio.play("hurt");
    this.float(`-${damage}`, "#ef8c83", this.player.x, this.player.y + 1.9, this.player.z);
    if (this.health <= 0) this.finish(false);
  }

  private damageMob(mob: Mob, damage: number) {
    mob.hp -= damage;
    mob.hit = .4;
    mob.flee = 3.5;
    mob.x += (mob.x - this.player.x) * .09;
    mob.z += (mob.z - this.player.z) * .09;
    this.burst(mob.x, mob.y + 1, mob.z, HOSTILES.includes(mob.type) ? "#bda29b" : "#e0bc9d", 10, .65);
    this.float(`-${Math.round(damage)}`, "#f4d39c", mob.x, mob.y + 1.6, mob.z);
    this.audio.play("hit");
    if (mob.hp <= 0) this.killMob(mob);
  }

  private killMob(mob: Mob) {
    this.stats.kills++;
    const drops: [ItemId, number][] = mob.type === "pig" ? [["rawMeat", 2]] :
      mob.type === "cow" ? [["rawMeat", 3], ["leather", 1]] :
      mob.type === "sheep" ? [["rawMeat", 1], ["wool", 2]] :
      mob.type === "chicken" ? [["rawMeat", 1], ["arrow", 1]] :
      mob.type === "spider" ? [["string", 1 + (Math.random() > .45 ? 1 : 0)]] :
      mob.type === "enderman" ? [["pearl", 1]] :
      mob.type === "skeleton" ? [["arrow", 3]] :
      mob.type === "creeper" ? [["coal", 2]] : [["coal", 1]];
    drops.forEach(([item, amount]) => { this.addItem(item, amount); this.float(`+${amount} ${ITEMS[item].name}`, "#e3d4b6", mob.x, mob.y + random(1.1, 1.8), mob.z); });
    this.gainXp(HOSTILES.includes(mob.type) ? mob.type === "enderman" ? 7 : 3 : 1);
    this.burst(mob.x, mob.y + 1, mob.z, HOSTILES.includes(mob.type) ? "#ae9fc0" : "#f0d3ad", 20);
    if (mob.type === "enderman") this.toast("Void pearl recovered", "Two pearls, one star crystal and two iron ingots awaken the altar.", "good");
    this.removeMob(mob);
  }

  private melee(target: Exclude<Target, { kind: "block" }>) {
    const selected = this.selectedItem();
    const damage = (selected === "stoneSword" ? 7 : selected === "ironSword" ? 10 : selected === "diamondSword" ? 14 :
      selected === "ironPick" || selected === "diamondPick" ? 4 : selected === "stonePick" ? 3 : 2) * (1 + this.enchants.edge * .16);
    this.attackCooldown = selected?.includes("Sword") ? .44 : .59;
    this.swingVisual = 1;
    this.wearTool(selected);
    if (target.kind === "mob") {
      const mob = this.mobs.find((entry) => entry.id === target.id);
      if (mob) this.damageMob(mob, damage);
    } else if (target.kind === "crystal") this.damageCrystal(target.index, damage);
    else this.damageBoss(damage);
    this.audio.play("swing");
  }

  private shootArrow() {
    if (!this.count("arrow")) {
      if (this.toastCooldown <= 0) { this.toast("Out of arrows", "Craft eight from one timber and one stone.", "danger"); this.toastCooldown = 2.5; }
      this.attackCooldown = .45;
      return;
    }
    this.takeItem("arrow", 1);
    this.wearTool("bow");
    this.camera.getWorldDirection(this.aimDirection);
    const position = this.camera.position.clone().addScaledVector(this.aimDirection, .55);
    this.addProjectile(position, this.aimDirection.clone().multiplyScalar(25), "player", 11 + this.enchants.edge * 2);
    this.attackCooldown = .62;
    this.swingVisual = 1;
    this.audio.play("arrow");
  }

  private addProjectile(position: THREE.Vector3, velocity: THREE.Vector3, owner: Projectile["owner"], damage: number) {
    const isArrow = owner === "player";
    const mesh = new THREE.Mesh(isArrow ? new THREE.BoxGeometry(.075, .075, .42) : new THREE.SphereGeometry(owner === "dragon" ? .23 : .14, 6, 5),
      this.kit.glow(isArrow ? "#e5d5b4" : owner === "dragon" ? "#ed8a61" : "#c1b2cf"));
    mesh.position.copy(position);
    if (isArrow) mesh.lookAt(position.clone().add(velocity));
    this.scene.add(mesh);
    this.projectiles.push({ position, velocity, mesh, owner, damage, life: owner === "player" ? 2.1 : 3.2 });
  }

  private enemyShot(position: THREE.Vector3, speed: number, damage: number, owner: "enemy" | "dragon") {
    const destination = new THREE.Vector3(this.player.x, this.player.y + 1.25, this.player.z);
    const direction = destination.sub(position).normalize();
    this.addProjectile(position, direction.multiplyScalar(speed), owner, damage);
    if (owner === "dragon") this.audio.play("boss");
  }

  private updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      let impact = p.life <= 0;
      const steps = Math.max(1, Math.ceil(p.velocity.length() * dt / .3));
      for (let s = 0; s < steps && !impact; s++) {
        p.position.addScaledVector(p.velocity, dt / steps);
        if (!this.world.inside(Math.round(p.position.x), Math.round(p.position.z)) || this.world.solid(Math.round(p.position.x), Math.round(p.position.y), Math.round(p.position.z))) { impact = true; break; }
        if (p.owner === "player") {
          const mob = this.mobs.find((m) => Math.hypot(m.x - p.position.x, m.y + (m.type === "spider" ? .55 : 1.1) - p.position.y, m.z - p.position.z) < .67);
          if (mob) { this.damageMob(mob, p.damage); impact = true; break; }
          if (this.boss) {
            const crystal = this.boss.crystals.findIndex((c) => Math.hypot(c.x - p.position.x, c.y - p.position.y, c.z - p.position.z) < .7);
            if (crystal >= 0) { this.damageCrystal(crystal, p.damage); impact = true; break; }
            if (Math.hypot(this.boss.x - p.position.x, this.boss.y - p.position.y, this.boss.z - p.position.z) < 1.55) { this.damageBoss(p.damage); impact = true; break; }
          }
        } else if (Math.hypot(this.player.x - p.position.x, this.player.y + 1.15 - p.position.y, this.player.z - p.position.z) < .65) {
          this.hurt(p.damage);
          if (p.owner === "dragon") this.burn = Math.max(this.burn, 3.6);
          impact = true;
        }
      }
      p.mesh.position.copy(p.position);
      if (impact) {
        if (p.owner === "dragon") this.burst(p.position.x, p.position.y, p.position.z, "#eda16d", 13, .9);
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  summon() {
    if (this.phase !== "playing" || this.boss || this.dragonSlain || distance2(this.player.x, this.player.z, ALTAR.x, ALTAR.z) > 5) return;
    if (!this.ritualReady()) { this.toast("The altar is silent", "Bring 2 void pearls, 1 star crystal and 2 iron ingots.", "danger"); return; }
    this.takeItem("pearl", 2); this.takeItem("diamond", 1); this.takeItem("ironIngot", 2);
    this.setPanel(null);
    this.flags.summoned = true;
    this.dayClock = Math.floor(this.dayClock / CYCLE) * CYCLE + CYCLE * .73;
    const dragon = this.kit.dragon();
    const hp = Math.round(124 * DIFFICULTIES[this.difficulty].boss);
    const crystals: Crystal[] = [];
    ([[ALTAR.x - 3, ALTAR.z - 2], [ALTAR.x + 3, ALTAR.z - 2], [ALTAR.x, ALTAR.z + 4]] as [number, number][]).forEach(([x, z]) => {
      const base = this.world.surfaceY(x, z);
      const group = new THREE.Group();
      group.position.set(x, base, z);
      this.kit.box(group, .7, .7, .7, "#47454d", 0, .27, 0);
      this.kit.box(group, .47, .13, .47, "#8e6967", 0, .68, 0);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.49), new THREE.MeshBasicMaterial({ color: 0xffbb84 }));
      gem.position.y = 1.37;
      group.add(gem);
      this.scene.add(group);
      crystals.push({ x, y: base + 1.37, z, hp: 20, group, gem });
    });
    this.boss = { x: ALTAR.x, y: this.world.surfaceY(ALTAR.x, ALTAR.z) + 8, z: ALTAR.z, hp, maxHp: hp, time: 0, fire: 2.5, group: dragon.group, wings: dragon.wings, crystals };
    this.scene.add(dragon.group);
    this.audio.play("boss");
    this.shake = 2.4;
    this.burst(ALTAR.x, this.world.surfaceY(ALTAR.x, ALTAR.z) + 3, ALTAR.z, "#eaa46c", 65, 2.4);
    this.toast("THE ASH DRAGON AWAKENS", "Shatter its three ember wards before striking the beast.", "danger");
    this.emit();
  }

  private ritualReady() { return this.count("pearl") >= 2 && this.count("diamond") >= 1 && this.count("ironIngot") >= 2; }

  private damageCrystal(index: number, damage: number) {
    const boss = this.boss;
    if (!boss || !boss.crystals[index]) return;
    const crystal = boss.crystals[index];
    crystal.hp -= damage;
    this.burst(crystal.x, crystal.y, crystal.z, "#f4bd8d", 13, .9);
    this.float(`-${Math.round(damage)}`, "#f9cba4", crystal.x, crystal.y + .6, crystal.z);
    this.audio.play("hit");
    if (crystal.hp <= 0) {
      this.scene.remove(crystal.group);
      this.kit.disposeGroup(crystal.group);
      (crystal.gem.material as THREE.Material).dispose();
      boss.crystals.splice(index, 1);
      this.burst(crystal.x, crystal.y, crystal.z, "#ffdb9d", 38, 1.6);
      this.shake = 1.2;
      this.toast(boss.crystals.length ? "Ember ward shattered" : "THE WARDS ARE DOWN", boss.crystals.length ? `${boss.crystals.length} wards remain.` : "The dragon is vulnerable. Aim for its body.", "good");
    }
  }

  private damageBoss(damage: number) {
    const boss = this.boss;
    if (!boss) return;
    if (boss.crystals.length) {
      this.float("WARDED", "#ffbf8d", boss.x, boss.y + 1.1, boss.z);
      if (this.toastCooldown <= 0) { this.toast("Protected by ember wards", "Destroy the three glowing crystals first.", "danger"); this.toastCooldown = 2.5; }
      this.audio.play("hit");
      return;
    }
    boss.hp = Math.max(0, boss.hp - damage);
    this.burst(boss.x, boss.y, boss.z, "#e67e72", 17, 1.2);
    this.float(`-${Math.round(damage)}`, "#ffd2a9", boss.x, boss.y + 1.25, boss.z);
    this.shake = Math.max(this.shake, .55);
    this.audio.play("hit");
    if (boss.hp <= 0) {
      this.dragonSlain = true;
      this.burst(boss.x, boss.y, boss.z, "#ffd199", 95, 2.8);
      this.clearBoss();
      this.finish(true);
    }
  }

  private updateBoss(dt: number) {
    const boss = this.boss;
    if (!boss) return;
    boss.time += dt;
    this.bossContactCooldown = Math.max(0, this.bossContactCooldown - dt);
    boss.crystals.forEach((crystal, index) => {
      crystal.gem.rotation.y += dt * 2;
      crystal.gem.position.y = 1.37 + Math.sin(boss.time * 2.5 + index * 2.1) * .16;
      crystal.y = crystal.group.position.y + crystal.gem.position.y;
    });
    const angry = boss.hp < boss.maxHp * .5;
    const cycle = boss.time % (angry ? 7.8 : 10.2);
    const diving = boss.crystals.length === 0 && cycle > (angry ? 4.1 : 5.8) && cycle < (angry ? 6.7 : 8.7);
    if (diving) {
      boss.x += (this.player.x - boss.x) * dt * .95;
      boss.z += (this.player.z - boss.z) * dt * .95;
      const desired = this.world.surfaceY(boss.x, boss.z) + 2.05;
      boss.y += (desired - boss.y) * Math.min(1, dt * 2.1);
      if (distance2(boss.x, boss.z, this.player.x, this.player.z) < 1.9 && Math.abs(boss.y - this.player.y - 1.5) < 2.3 && this.bossContactCooldown <= 0) {
        this.hurt(5);
        this.bossContactCooldown = 1.8;
      }
    } else {
      const radius = boss.crystals.length ? 6.4 : 7.6;
      const desiredX = ALTAR.x + Math.cos(boss.time * .51) * radius;
      const desiredZ = ALTAR.z + Math.sin(boss.time * .51) * radius;
      boss.x += (desiredX - boss.x) * Math.min(1, dt * 1.2);
      boss.z += (desiredZ - boss.z) * Math.min(1, dt * 1.2);
      const desiredY = this.world.surfaceY(boss.x, boss.z) + 7 + Math.sin(boss.time * 1.5) * 1.1;
      boss.y += (desiredY - boss.y) * Math.min(1, dt * 1.4);
    }
    boss.group.position.set(boss.x, boss.y, boss.z);
    boss.group.rotation.y = Math.atan2(boss.x - this.player.x, boss.z - this.player.z);
    boss.wings.forEach((wing, index) => { wing.rotation.z = (index === 0 ? 1 : -1) * (.22 + Math.sin(boss.time * (angry ? 10 : 7)) * .44); });
    boss.fire -= dt;
    if (boss.fire <= 0 && distance2(this.player.x, this.player.z, boss.x, boss.z) < 25) {
      this.enemyShot(new THREE.Vector3(boss.x, boss.y - .2, boss.z - .6), angry ? 10 : 8.5, angry ? 5 : 4, "dragon");
      boss.fire = angry ? 1.85 : 3.15;
    }
  }

  private clearBoss() {
    if (!this.boss) return;
    this.scene.remove(this.boss.group);
    this.kit.disposeGroup(this.boss.group);
    this.boss.crystals.forEach((crystal) => {
      this.scene.remove(crystal.group);
      this.kit.disposeGroup(crystal.group);
      (crystal.gem.material as THREE.Material).dispose();
    });
    this.boss = null;
  }

  private score() {
    return Math.round(this.stats.mined * 8 + this.stats.placed * 5 + this.stats.crafted * 26 + this.stats.kills * 44 +
      Math.floor(this.stats.distance) * 2 + (this.currentDay() - 1) * 120 + (this.dragonSlain ? 1800 : 0));
  }

  private finish(won: boolean) {
    if (this.phase === "dead" || this.phase === "won") return;
    this.phase = won ? "won" : "dead";
    this.panel = null;
    this.primary = false;
    this.touchMove = { x: 0, y: 0 };
    this.releaseLock();
    if (!this.finished) {
      this.legacyEarned = this.stats.time >= 20 || won ? Math.max(1, Math.floor(this.score() / 650)) + (won ? 9 : 0) : 0;
      this.meta.embers += this.legacyEarned;
      this.meta.runs++;
      if (won) this.meta.victories++;
      this.meta.bestScore = Math.max(this.meta.bestScore, this.score());
      this.saveMeta();
      this.finished = true;
    }
    if (won) this.audio.play("win");
    else this.audio.play("hurt");
    this.emit();
  }

  continueAfterVictory() {
    if (this.phase !== "won") return;
    this.phase = "playing";
    this.panel = null;
    this.health = this.maxHealth;
    this.hunger = 100;
    this.burn = 0;
    this.dayClock = (Math.floor(this.dayClock / CYCLE) + 1) * CYCLE + CYCLE * .16;
    this.toast("The world is yours", "Keep building and surviving for as long as you wish.", "good");
    this.requestLock();
    this.emit();
  }

  drawMap(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = canvas.width;
    const size = WORLD_RADIUS * 2 + 1;
    const cell = width / size;
    ctx.fillStyle = "#17252a";
    ctx.fillRect(0, 0, width, width);
    const colors: Record<Biome, string> = { meadow: "#648e6b", pinewood: "#426c5d", dunes: "#c8b27e", frost: "#b7c7c1", cinder: "#615f62" };
    for (let z = -WORLD_RADIUS; z <= WORLD_RADIUS; z++) for (let x = -WORLD_RADIUS; x <= WORLD_RADIUS; x++) {
      const h = this.world.terrainHeight(x, z);
      const top = this.world.get(x, h, z);
      ctx.fillStyle = this.world.get(x, 2, z) === "water" ? "#619aa5" : top === "diamondOre" && this.meta.perks.miner > 0 ? "#9fe1d2" : top === "ironOre" && this.meta.perks.miner > 1 ? "#cc9577" : colors[this.world.biomeAt(x, z)];
      ctx.fillRect((x + WORLD_RADIUS) * cell, (z + WORLD_RADIUS) * cell, cell + .3, cell + .3);
      if (this.world.get(x, h + 1, z) === "wood" || this.world.get(x, h + 1, z) === "pineWood") {
        ctx.fillStyle = "#254d48";
        ctx.fillRect((x + WORLD_RADIUS) * cell + cell * .2, (z + WORLD_RADIUS) * cell + cell * .2, cell * .6, cell * .6);
      }
    }
    const marker = (x: number, z: number, color: string, radius: number) => {
      ctx.beginPath();
      ctx.arc((x + WORLD_RADIUS + .5) * cell, (z + WORLD_RADIUS + .5) * cell, radius, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = "#17252a"; ctx.lineWidth = 2; ctx.stroke();
    };
    marker(ALTAR.x, ALTAR.z, "#f2b977", 7);
    marker(this.player.x, this.player.z, "#f6f3df", 6);
  }

  private quest() {
    if (this.dragonSlain) return { title: "A world remade", detail: "The Ash Dragon is gone. Build your own ending.", step: 9 };
    if (this.boss) return this.boss.crystals.length ?
      { title: "Break the ember wards", detail: `${this.boss.crystals.length} glowing crystals protect the dragon.`, step: 8 } :
      { title: "Defeat the Ash Dragon", detail: "The wards are down. Aim for the beast.", step: 8 };
    if (!this.flags.wood) return { title: "Gather timber", detail: "Hold left click on a nearby tree.", step: 1 };
    if (!this.flags.bench) return { title: "Build a workbench", detail: "Press C to craft one, then place it with right click.", step: 2 };
    if (!this.flags.stonePick) return { title: "Shape a stone pickaxe", detail: "Mine stone and craft at your workbench.", step: 3 };
    if (!this.flags.furnace) return { title: "Raise a furnace", detail: "Craft it from eight stone and place it nearby.", step: 4 };
    if (!this.flags.iron) return { title: "Forge an iron ingot", detail: "Mine iron ore, press E at a furnace and add fuel.", step: 5 };
    if (!this.flags.diamond) return { title: "Find star crystal", detail: "Take an iron pick to the cinder wastes.", step: 6 };
    if (!this.flags.pearls) return { title: "Hunt the voidwalkers", detail: "Endermen emerge at night and near the altar. Find two pearls.", step: 7 };
    return { title: "Awaken the ancient altar", detail: "Bring two pearls, one crystal and two iron ingots. Press E at the beacon.", step: 8 };
  }

  private targetInfo(): GameSnapshot["target"] {
    const target = this.target;
    if (!target || this.phase !== "playing" || this.panel) return null;
    if (target.kind === "mob") {
      const mob = this.mobs.find((entry) => entry.id === target.id);
      return mob ? { name: mob.type[0].toUpperCase() + mob.type.slice(1), hint: HOSTILES.includes(mob.type) ? "Attack to defend yourself" : "Hunt for food and materials", health: Math.ceil(mob.hp), maxHealth: mob.maxHp } : null;
    }
    if (target.kind === "crystal") return { name: "Ember ward", hint: "Destroy to break the dragon's shield", health: this.boss?.crystals[target.index]?.hp, maxHealth: 20 };
    if (target.kind === "dragon") return { name: "Ash Dragon", hint: this.boss?.crystals.length ? "Protected by ember wards" : "Strike while its guard is down", health: this.boss?.hp, maxHealth: this.boss?.maxHp };
    const block = target.block;
    const item = this.selectedItem();
    const tier = item ? PICK_TIER[item] || 0 : 0;
    let hint = "Hold LMB to mine / RMB to place";
    if (BLOCKS[block].hardness > 100) hint = block === "water" ? "Water feeds nearby crops" : "Cannot be broken";
    else if (BLOCKS[block].tier && tier < BLOCKS[block].tier!) hint = block === "diamondOre" ? "Requires an iron pickaxe" : "Requires a pickaxe";
    else if (["workbench", "furnace", "enchanter", "bed"].includes(block)) hint = "Press E to use";
    else if (block === "farmland" && item === "seeds") hint = "Right click to sow wheat";
    else if (block === "cropRipe") hint = "Harvest for wheat and seeds";
    else if (item === "hoe" && ["grass", "pineGrass", "dirt"].includes(block)) hint = "Right click to till";
    return { name: BLOCKS[block].name, hint };
  }

  snapshot(): GameSnapshot {
    const phase = (this.dayClock % CYCLE) / CYCLE;
    const hour = Math.floor((6 + phase * 24) % 24);
    const minute = Math.floor((phase * 24 % 1) * 60);
    const dx = ALTAR.x - this.player.x;
    const dz = ALTAR.z - this.player.z;
    const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const bearing = compass[(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8];
    const rect = this.renderer.domElement.getBoundingClientRect();
    const floats = this.floats.map((f) => {
      const projected = new THREE.Vector3(f.x, f.y, f.z).project(this.camera);
      return { id: f.id, text: f.text, color: f.color, left: (projected.x * .5 + .5) * rect.width, top: (-projected.y * .5 + .5) * rect.height, opacity: projected.z > 1 || projected.z < -1 ? 0 : clamp(f.life / .5, 0, 1) };
    });
    return {
      phase: this.phase, panel: this.panel, difficulty: this.difficulty,
      volume: this.audio.volume, muted: this.audio.muted, shakeEnabled: this.shakeEnabled,
      health: this.health, maxHealth: this.maxHealth, hunger: this.hunger,
      xp: this.xp, xpLevel: this.xpLevel, xpProgress: this.xpProgress, xpNext: this.xpNext,
      inventory: { ...this.inventory }, hotbar: [...this.hotbar], selected: this.selected, toolHealth: { ...this.toolHealth },
      day: this.currentDay(), night: this.isNight(), timeLabel: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      biome: this.world.biomeAt(Math.round(this.player.x), Math.round(this.player.z)), x: this.player.x, z: this.player.z,
      altarDistance: Math.round(Math.hypot(dx, dz)), bearing, quest: this.quest(), target: this.targetInfo(),
      mineProgress: this.mineProgress, swing: this.swingVisual, hurt: this.hurtVisual, burn: this.burn,
      toasts: [...this.toasts], floats,
      stats: { ...this.stats }, score: this.score(), legacyEarned: this.legacyEarned,
      meta: { ...this.meta, perks: { ...this.meta.perks }, discovered: [...this.meta.discovered] },
      boss: this.boss ? { hp: this.boss.hp, maxHp: this.boss.maxHp, crystals: this.boss.crystals.length } : null,
      dragonSlain: this.dragonSlain, furnace: { job: this.furnaceJob ? { ...this.furnaceJob } : null, fuel: this.furnaceFuel },
      enchants: { ...this.enchants }, nearBench: this.nearBlock("workbench"), nearFurnace: this.nearBlock("furnace"),
      nearEnchanter: this.nearBlock("enchanter"), ritualReady: this.ritualReady(), seed: this.world.seed,
    };
  }

  private emit() { if (!this.disposed) this.onUpdate(this.snapshot()); }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.releaseLock();
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("contextmenu", this.onContextMenu);
    this.renderer.domElement.removeEventListener("wheel", this.onWheel);
    this.mobs.forEach((mob) => this.kit.disposeGroup(mob.group));
    this.projectiles.forEach((projectile) => projectile.mesh.geometry.dispose());
    if (this.boss) this.clearBoss();
    this.blockMeshes.forEach((mesh) => mesh.dispose());
    if (this.decor) { this.decor.geometry.dispose(); (this.decor.material as THREE.Material).dispose(); this.decor.dispose(); }
    if (this.altarGroup) { this.kit.disposeGroup(this.altarGroup); (this.altarBeam?.material as THREE.Material | undefined)?.dispose(); }
    this.clouds.forEach((cloud) => this.kit.disposeGroup(cloud));
    this.boxGeometry.dispose();
    this.blockMats.dispose();
    this.kit.dispose();
    this.sky.mesh.geometry.dispose(); this.sky.material.dispose();
    this.sun.geometry.dispose(); (this.sun.material as THREE.Material).dispose();
    this.moon.geometry.dispose(); (this.moon.material as THREE.Material).dispose();
    this.stars.geometry.dispose(); (this.stars.material as THREE.Material).dispose();
    this.outline.geometry.dispose(); (this.outline.material as THREE.Material).dispose();
    this.particleCloud.geometry.dispose(); (this.particleCloud.material as THREE.Material).dispose();
    this.scene.getObjectByName("sea")?.traverse((o) => { if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose(); } });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.audio.dispose();
  }
}