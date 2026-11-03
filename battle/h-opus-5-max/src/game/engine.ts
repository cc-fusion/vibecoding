import * as THREE from "three";
import {
  B,
  block,
  blockItemId,
  buildLuts,
  initBlocks,
  initItems,
  item,
  itemBlock,
} from "./blocks";
import {
  DAY_LENGTH,
  GRAVITY,
  PLAYER_CROUCH_EYE,
  PLAYER_CROUCH_HEIGHT,
  PLAYER_EYE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  REACH,
  SEA_LEVEL,
  WORLD_HEIGHT,
  clamp,
  lerp,
} from "./constants";
import { buildArrayTexture } from "./textures";
import {
  createCrackMaterial,
  createVoxelMaterial,
  makeCrackTexture,
  makeUniforms,
} from "./materials";
import { initMesherLuts } from "./mesher";
import { World } from "./world";
import { Sky } from "./sky";
import { ParticleSystem, Weather } from "./particles";
import { makeBody, moveBody, type Body } from "./physics";
import { ItemEntity, Mob, MOBS, pickSpawnKind, type MobKind } from "./entities";
import {
  COOK_TIME,
  Inventory,
  RECIPES,
  SMELTING,
  initRecipes,
  matchRecipe,
  newFurnace,
  stackMax,
  tickFurnace,
  type FurnaceState,
  type Stack,
} from "./inventory";
import { audio } from "./audio";
import { BIOME_NAMES } from "./worldgen";
import { hashString, makeRng } from "./noise";
import { loadWorld, saveWorld, type SaveData } from "./persistence";

export type Screen = "none" | "inventory" | "crafting" | "furnace" | "pause" | "death";
export type Mode = "survival" | "creative";

export interface Snapshot {
  v: number;
  health: number;
  hunger: number;
  air: number;
  xp: number;
  xpNeeded: number;
  level: number;
  slots: (Stack | null)[];
  selected: number;
  cursor: Stack | null;
  craft: (Stack | null)[];
  craftW: number;
  craftOut: Stack | null;
  furnace: FurnaceState | null;
  screen: Screen;
  mode: Mode;
  heldName: string | null;
  toast: { text: string; t: number } | null;
  achievement: string | null;
  fps: number;
  pos: [number, number, number];
  biome: string;
  timeStr: string;
  chunks: number;
  tris: number;
  drawCalls: number;
  weather: string;
  underwater: boolean;
  inBlock: boolean;
  damageFlash: number;
  recipes: { out: Stack; i: number }[];
  paused: boolean;
  seed: number;
  worldName: string;
}

const XP_PER_LEVEL = (lvl: number) => 18 + lvl * 9;

interface Keys {
  [k: string]: boolean;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  handScene = new THREE.Scene();
  handCamera: THREE.PerspectiveCamera;
  world!: World;
  sky = new Sky();
  particles = new ParticleSystem();
  weather = new Weather();
  inv = new Inventory();
  uniforms = makeUniforms(buildArrayTexture());
  materials: THREE.ShaderMaterial[];
  handUniforms!: ReturnType<typeof makeUniforms>;
  handMaterial!: THREE.ShaderMaterial;
  crackMat: THREE.ShaderMaterial;
  crackMesh: THREE.Mesh;
  selectBox: THREE.LineSegments;
  container: HTMLElement;

  body: Body;
  yaw = 0;
  pitch = 0;
  mode: Mode = "survival";
  health = 20;
  hunger = 20;
  saturation = 5;
  air = 10;
  xp = 0;
  level = 0;
  spawnPoint = new THREE.Vector3();
  sneaking = false;
  sprinting = false;
  flying = false;
  dead = false;

  keys: Keys = {};
  mouseDown = [false, false, false];
  screen: Screen = "none";
  paused = false;
  pointerLocked = false;

  worldTime = DAY_LENGTH * 0.3;
  elapsed = 0;
  breakTarget: { x: number; y: number; z: number } | null = null;
  breakProgress = 0;
  placeCooldown = 0;
  attackCooldown = 0;
  eatTimer = 0;
  swing = 0;
  bob = 0;
  fallStart: number | null = null;

  mobs: Mob[] = [];
  items: ItemEntity[] = [];
  furnaces = new Map<string, FurnaceState>();
  openFurnaceKey: string | null = null;
  craftGrid: (Stack | null)[] = new Array(9).fill(null);
  craftW = 2;
  cursor: Stack | null = null;

  rainState: "clear" | "rain" | "thunder" = "clear";
  rainIntensity = 0;
  rainTimer = 120;
  lightningTimer = 0;

  stats: Record<string, number> = {};
  achievements = new Set<string>();
  toast: { text: string; t: number } | null = null;
  achievementPopup: { text: string; t: number } | null = null;

  snapshot!: Snapshot;
  onUpdate: (s: Snapshot) => void = () => {};
  private version = 0;
  private lastTime = 0;
  private fps = 60;
  private fpsAcc = 0;
  private fpsCount = 0;
  private rafId = 0;
  private rng = makeRng(12345);
  private spawnTimer = 2;
  private saveTimer = 20;
  private handMesh: THREE.Object3D | null = null;
  private handKey = "";
  private sunLight: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private disposed = false;
  private uiTimer = 0;
  private footTimer = 0;
  private damageFlash = 0;
  private lastHurtSound = 0;
  private caveAmt = 0;
  inBlock = false;

  constructor(
    container: HTMLElement,
    public worldKey: string,
    public worldName: string,
    public seed: number,
  ) {
    initBlocks();
    buildLuts();
    initItems();
    initRecipes();
    initMesherLuts();

    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
      stencil: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.display = "block";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";

    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.06,
      1000,
    );
    this.handCamera = new THREE.PerspectiveCamera(
      62,
      container.clientWidth / container.clientHeight,
      0.01,
      10,
    );

    this.materials = [
      createVoxelMaterial(this.uniforms, "opaque"),
      createVoxelMaterial(this.uniforms, "cutout"),
      createVoxelMaterial(this.uniforms, "water"),
    ];
    this.handUniforms = makeUniforms(this.uniforms.uAtlas.value!);
    this.handUniforms.uDayLight.value = 1;
    this.handUniforms.uFogDensity.value = 0;
    (this.handUniforms.uAmbient.value as THREE.Color).setRGB(0.22, 0.22, 0.24);
    this.handMaterial = createVoxelMaterial(this.handUniforms, "opaque");
    this.crackMat = createCrackMaterial(makeCrackTexture());
    this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.002, 1.002, 1.002), this.crackMat);
    this.crackMesh.visible = false;
    this.scene.add(this.crackMesh);

    const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.selectBox = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }),
    );
    this.selectBox.visible = false;
    this.scene.add(this.selectBox);

    this.world = new World(seed, this.materials);
    this.scene.add(this.world.group);
    this.scene.add(this.sky.group);
    this.scene.add(this.particles.points);
    this.scene.add(this.weather.points);
    this.scene.fog = new THREE.FogExp2(0x9ec5f0, 0.012);

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x51402c, 1.0);
    this.scene.add(this.hemi);
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    this.handScene.add(new THREE.AmbientLight(0xffffff, 1.1));
    const hl = new THREE.DirectionalLight(0xffffff, 1.2);
    hl.position.set(1, 2, 2);
    this.handScene.add(hl);

    this.body = makeBody(0, SEA_LEVEL + 20, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
    this.rng = makeRng(seed ^ 0x9e3779b9);

    this.buildSnapshot();
    this.bindEvents();
  }

  // ── setup helpers ────────────────────────────────────────────────────────
  async init(save: SaveData | null) {
    if (save) {
      this.worldTime = save.time;
      this.body.pos.set(save.player.x, save.player.y, save.player.z);
      this.yaw = save.player.yaw;
      this.pitch = save.player.pitch;
      this.health = save.player.health;
      this.hunger = save.player.hunger;
      this.xp = save.player.xp;
      this.level = save.player.level;
      this.mode = (save.player.mode as Mode) ?? "survival";
      this.spawnPoint.set(...save.player.spawn);
      this.inv.load(save.inventory);
      this.world.loadEdits(save.edits ?? {});
      for (const [k, v] of Object.entries(save.furnaces ?? {}))
        this.furnaces.set(k, v as FurnaceState);
      this.stats = save.stats ?? {};
      this.achievements = new Set(save.achievements ?? []);
    } else {
      // find a nice spawn on land
      let sx = 0,
        sz = 0;
      for (let i = 0; i < 400; i++) {
        const a = i * 0.7;
        sx = Math.round(Math.cos(a) * i * 1.4);
        sz = Math.round(Math.sin(a) * i * 1.4);
        const h = this.world.gen.heightAt(sx, sz);
        if (h > SEA_LEVEL + 2 && h < SEA_LEVEL + 28) break;
      }
      const h = Math.floor(this.world.gen.heightAt(sx, sz)) + 2;
      this.body.pos.set(sx + 0.5, h + 1, sz + 0.5);
      this.spawnPoint.copy(this.body.pos);
      this.inv.add("wooden_pickaxe", 1);
      this.inv.add("torch", 8);
      this.inv.add("bread", 3);
    }
    // pre-generate around spawn so the player doesn't fall through
    this.world.prepare(this.body.pos.x, this.body.pos.z, 3);
    if (!save) {
      const top = this.world.surfaceHeight(
        Math.floor(this.body.pos.x),
        Math.floor(this.body.pos.z),
      );
      this.body.pos.y = top + 0.2;
      this.spawnPoint.copy(this.body.pos);
    }
    this.buildSnapshot();
  }

  // ── input ────────────────────────────────────────────────────────────────
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code === "F3") e.preventDefault();
    if (e.repeat) return;
    const code = e.code;
    this.keys[code] = true;
    if (code === "Escape") {
      if (this.screen !== "none" && this.screen !== "death") this.closeScreen();
      else if (!this.dead) this.setScreen("pause");
      return;
    }
    if (this.screen === "death") return;
    if (code === "KeyE") {
      if (this.screen === "none") {
        this.craftW = 2;
        this.setScreen("inventory");
      }
      else if (this.screen === "inventory" || this.screen === "crafting" || this.screen === "furnace")
        this.closeScreen();
      return;
    }
    if (this.screen !== "none") return;
    if (code.startsWith("Digit")) {
      const n = parseInt(code.slice(5));
      if (n >= 1 && n <= 9) {
        this.inv.selected = n - 1;
        this.markUi();
      }
    }
    if (code === "KeyQ") this.dropHeld(e.shiftKey);
    if (code === "KeyF") {
      if (this.mode === "creative") {
        this.flying = !this.flying;
        this.body.vel.y = 0;
      }
    }
    if (code === "F3") this.toggleDebug();
    if (code === "Space" && this.mode === "creative") {
      const now = performance.now();
      if (now - this.lastSpace < 320) {
        this.flying = !this.flying;
        this.body.vel.y = 0;
      }
      this.lastSpace = now;
    }
  };
  private lastSpace = 0;
  debug = false;
  toggleDebug() {
    this.debug = !this.debug;
    this.markUi();
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    const s = 0.0022 * this.sensitivity;
    this.yaw -= e.movementX * s;
    this.pitch -= e.movementY * s;
    this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
  };
  sensitivity = 1;

  private onMouseDown = (e: MouseEvent) => {
    if (this.screen !== "none") return;
    if (!this.pointerLocked) {
      this.requestLock();
      return;
    }
    this.mouseDown[e.button] = true;
    if (e.button === 2) this.useItem();
    if (e.button === 1) {
      e.preventDefault();
      this.pickBlock();
    }
  };
  private onMouseUp = (e: MouseEvent) => {
    this.mouseDown[e.button] = false;
    if (e.button === 0) {
      this.breakProgress = 0;
      this.breakTarget = null;
      this.crackMesh.visible = false;
    }
    if (e.button === 2) this.eatTimer = 0;
  };
  private onWheel = (e: WheelEvent) => {
    if (this.screen !== "none") return;
    const d = Math.sign(e.deltaY);
    this.inv.selected = (this.inv.selected + d + 9) % 9;
    this.markUi();
  };
  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked && this.screen === "none" && !this.dead) {
      this.setScreen("pause");
    }
  };
  private onResize = () => {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.handCamera.aspect = w / h;
    this.handCamera.updateProjectionMatrix();
  };

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("wheel", this.onWheel, { passive: true });
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    window.addEventListener("resize", this.onResize);
    this.renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  requestLock() {
    this.renderer.domElement.requestPointerLock?.();
    audio.resume();
  }

  setScreen(s: Screen) {
    this.screen = s;
    if (s === "none") {
      this.requestLock();
      this.paused = false;
    } else {
      document.exitPointerLock?.();
      this.paused = s === "pause" || s === "death";
    }
    this.markUi();
  }

  closeScreen() {
    // return crafting grid items + cursor to inventory
    for (let i = 0; i < 9; i++) {
      const s = this.craftGrid[i];
      if (s) {
        this.inv.add(s.id, s.count, s.dur);
        this.craftGrid[i] = null;
      }
    }
    if (this.cursor) {
      this.inv.add(this.cursor.id, this.cursor.count, this.cursor.dur);
      this.cursor = null;
    }
    this.openFurnaceKey = null;
    this.setScreen("none");
  }

  // ── gameplay actions ─────────────────────────────────────────────────────
  private eyeHeight() {
    return this.sneaking ? PLAYER_CROUCH_EYE : PLAYER_EYE;
  }

  getLookRay() {
    const dir = new THREE.Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const origin = new THREE.Vector3(
      this.body.pos.x,
      this.body.pos.y + this.eyeHeight(),
      this.body.pos.z,
    );
    return { origin, dir };
  }

  private mobUnderCrosshair(): Mob | null {
    const { origin, dir } = this.getLookRay();
    let best: Mob | null = null;
    let bestT = REACH;
    for (const m of this.mobs) {
      const hw = m.def.w / 2;
      const min = new THREE.Vector3(m.body.pos.x - hw, m.body.pos.y, m.body.pos.z - hw);
      const max = new THREE.Vector3(
        m.body.pos.x + hw,
        m.body.pos.y + m.def.h,
        m.body.pos.z + hw,
      );
      const box = new THREE.Box3(min, max);
      const ray = new THREE.Ray(origin, dir);
      const hit = ray.intersectBox(box, new THREE.Vector3());
      if (hit) {
        const t = hit.distanceTo(origin);
        if (t < bestT) {
          bestT = t;
          best = m;
        }
      }
    }
    return best;
  }

  private toolInfo() {
    const held = this.inv.held;
    const def = held ? item(held.id) : undefined;
    return def?.tool;
  }

  breakTime(id: number): number {
    const d = block(id);
    if (d.hardness < 0) return Infinity;
    if (this.mode === "creative") return 0.08;
    const tool = this.toolInfo();
    let speed = 1;
    if (tool && tool.class === d.tool) speed = tool.speed;
    if (d.tool !== "none" && tool && tool.class !== d.tool) speed = 1;
    let t = (d.hardness * 1.6) / speed;
    if (d.tier > 0 && (!tool || tool.tier < d.tier)) t *= 3.2;
    if (!this.body.onGround) t *= 1.35;
    if (this.body.inWater) t *= 1.4;
    return Math.max(0.05, t);
  }

  private canHarvest(id: number) {
    const d = block(id);
    if (d.tier === 0) return true;
    const tool = this.toolInfo();
    return !!tool && tool.class === d.tool && tool.tier >= d.tier;
  }

  private addStat(k: string, n = 1) {
    this.stats[k] = (this.stats[k] ?? 0) + n;
  }

  private grantAchievement(id: string, text: string) {
    if (this.achievements.has(id)) return;
    this.achievements.add(id);
    this.achievementPopup = { text, t: 5 };
    audio.levelUp();
    this.markUi();
  }

  private giveXp(n: number) {
    this.xp += n;
    while (this.xp >= XP_PER_LEVEL(this.level)) {
      this.xp -= XP_PER_LEVEL(this.level);
      this.level++;
      audio.levelUp();
      if (this.level === 5) this.grantAchievement("lvl5", "Getting Experienced — Level 5");
    }
  }

  private dropItem(id: string, count: number, x: number, y: number, z: number, dur?: number) {
    const e = new ItemEntity(id, count, x, y, z, this.materials[0], dur);
    e.body.vel.set((Math.random() - 0.5) * 2, 2.2 + Math.random(), (Math.random() - 0.5) * 2);
    this.items.push(e);
    this.scene.add(e.obj);
  }

  private breakBlockAt(x: number, y: number, z: number) {
    const id = this.world.getBlock(x, y, z);
    if (id === 0) return;
    const d = block(id);
    if (d.hardness < 0) return;
    this.world.setBlock(x, y, z, 0);
    audio.breakBlock(d.sound);
    const col = this.blockColor(id);
    this.particles.burst(x + 0.5, y + 0.5, z + 0.5, 14, col, 2.4, 0.11, 0.8, 2.6);

    if (this.mode === "survival" && this.canHarvest(id)) {
      let dropId = d.drops === undefined ? blockItemId(id) : d.drops;
      if (d.drops === null) dropId = "";
      let count = 1;
      if (d.dropCount) {
        count = d.dropCount[0] + Math.floor(Math.random() * (d.dropCount[1] - d.dropCount[0] + 1));
      }
      if (id === B.OAK_LEAVES) {
        const r = Math.random();
        if (r < 0.06) dropId = "oak_sapling";
        else if (r < 0.09) dropId = "apple";
        else if (r < 0.14) dropId = "stick";
        else dropId = "";
      }
      if ((id === B.BIRCH_LEAVES || id === B.SPRUCE_LEAVES || id === B.JUNGLE_LEAVES)) {
        const r = Math.random();
        if (r < 0.08) dropId = id === B.SPRUCE_LEAVES ? "spruce_sapling" : "stick";
        else dropId = "";
      }
      if ((id === B.TALL_GRASS || id === B.FERN) && Math.random() > 0.2) dropId = "";
      if (id === B.GRAVEL && Math.random() < 0.12) dropId = "clay_ball";
      if (dropId && item(dropId) && count > 0) {
        this.dropItem(dropId, count, x + 0.5, y + 0.4, z + 0.5);
      }
    } else if (this.mode === "creative") {
      // no drops
    }

    // xp from ores
    if (
      id === B.COAL_ORE || id === B.DIAMOND_ORE || id === B.EMERALD_ORE ||
      id === B.LAPIS_ORE || id === B.REDSTONE_ORE
    ) {
      this.giveXp(2 + Math.floor(Math.random() * 4));
    }
    if (id === B.DIAMOND_ORE) this.grantAchievement("diamond", "DIAMONDS! — Mine diamond ore");
    if (id === B.OAK_LOG || id === B.BIRCH_LOG || id === B.SPRUCE_LOG)
      this.grantAchievement("wood", "Getting Wood — Punch a tree");

    this.addStat("broken");
    if (this.mode === "survival") this.inv.damageSelected(1);

    // break unsupported plants above & furnace cleanup
    const above = this.world.getBlock(x, y + 1, z);
    if (above && block(above).needsSupport) {
      this.breakBlockAt(x, y + 1, z);
    }
    const key = `${x},${y},${z}`;
    if (this.furnaces.has(key)) {
      const f = this.furnaces.get(key)!;
      for (const s of [f.input, f.fuel, f.output])
        if (s) this.dropItem(s.id, s.count, x + 0.5, y + 0.5, z + 0.5);
      this.furnaces.delete(key);
    }
    this.markUi();
  }

  blockColor(id: number): [number, number, number] {
    const palette: Record<number, [number, number, number]> = {
      [B.GRASS]: [0.42, 0.62, 0.3],
      [B.DIRT]: [0.54, 0.38, 0.25],
      [B.STONE]: [0.49, 0.49, 0.49],
      [B.COBBLESTONE]: [0.44, 0.44, 0.44],
      [B.SAND]: [0.88, 0.82, 0.63],
      [B.OAK_LOG]: [0.54, 0.41, 0.24],
      [B.OAK_PLANKS]: [0.69, 0.54, 0.33],
      [B.OAK_LEAVES]: [0.25, 0.5, 0.19],
      [B.WATER]: [0.2, 0.4, 0.8],
      [B.SNOW]: [0.95, 0.97, 1],
      [B.GRAVEL]: [0.54, 0.53, 0.52],
    };
    return palette[id] ?? [0.5, 0.5, 0.5];
  }

  private useItem() {
    const held = this.inv.held;
    const { origin, dir } = this.getLookRay();
    const hit = this.world.raycast(origin, dir, REACH);

    // interact with blocks first
    if (hit && !this.keys.ShiftLeft) {
      const id = this.world.getBlock(hit.x, hit.y, hit.z);
      if (id === B.CRAFTING_TABLE) {
        this.craftW = 3;
        this.setScreen("crafting");
        return;
      }
      if (id === B.FURNACE || id === B.FURNACE_LIT) {
        const key = `${hit.x},${hit.y},${hit.z}`;
        if (!this.furnaces.has(key)) this.furnaces.set(key, newFurnace());
        this.openFurnaceKey = key;
        this.setScreen("furnace");
        return;
      }
    }

    if (!held) return;
    const def = item(held.id);
    if (!def) return;

    if (def.food && this.mode === "survival") {
      if (this.hunger >= 20 && !def.food.heal) return;
      this.eatTimer += 0.016;
      return;
    }

    if (def.block && this.placeCooldown <= 0) {
      if (!hit) return;
      const px = hit.px,
        py = hit.py,
        pz = hit.pz;
      const target = this.world.getBlock(px, py, pz);
      if (target !== 0 && !block(target).replaceable) return;
      const bd = block(def.block);
      if (bd.needsSupport) {
        const below = this.world.getBlock(px, py - 1, pz);
        if (!below || !block(below).solid) return;
      }
      // don't place inside player
      if (bd.solid) {
        const hw = PLAYER_WIDTH / 2 + 0.02;
        const p = this.body.pos;
        const h = this.sneaking ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;
        if (
          px + 1 > p.x - hw && px < p.x + hw &&
          pz + 1 > p.z - hw && pz < p.z + hw &&
          py + 1 > p.y && py < p.y + h
        )
          return;
        for (const m of this.mobs) {
          const mw = m.def.w / 2 + 0.02;
          if (
            px + 1 > m.body.pos.x - mw && px < m.body.pos.x + mw &&
            pz + 1 > m.body.pos.z - mw && pz < m.body.pos.z + mw &&
            py + 1 > m.body.pos.y && py < m.body.pos.y + m.def.h
          )
            return;
        }
      }
      this.world.setBlock(px, py, pz, def.block);
      if (def.block === B.FURNACE) this.furnaces.set(`${px},${py},${pz}`, newFurnace());
      audio.place(bd.sound);
      this.placeCooldown = 0.2;
      this.swing = 1;
      if (this.mode === "survival") this.inv.consumeSelected(1);
      this.addStat("placed");
      if (this.stats.placed === 1) this.grantAchievement("build", "Builder — Place your first block");
      this.markUi();
    }
  }

  private pickBlock() {
    const { origin, dir } = this.getLookRay();
    const hit = this.world.raycast(origin, dir, REACH);
    if (!hit) return;
    const id = blockItemId(hit.id);
    for (let i = 0; i < 9; i++) {
      if (this.inv.slots[i]?.id === id) {
        this.inv.selected = i;
        this.markUi();
        return;
      }
    }
    if (this.mode === "creative") {
      this.inv.slots[this.inv.selected] = { id, count: 1 };
      this.markUi();
    }
  }

  private dropHeld(all: boolean) {
    const s = this.inv.held;
    if (!s) return;
    const n = all ? s.count : 1;
    const { origin, dir } = this.getLookRay();
    const e = new ItemEntity(
      s.id,
      n,
      origin.x + dir.x * 0.6,
      origin.y - 0.2,
      origin.z + dir.z * 0.6,
      this.materials[0],
      s.dur,
    );
    e.body.vel.set(dir.x * 6, dir.y * 6 + 1.5, dir.z * 6);
    e.pickupDelay = 1.2;
    this.items.push(e);
    this.scene.add(e.obj);
    this.inv.consumeSelected(n);
    this.markUi();
  }

  private attack() {
    if (this.attackCooldown > 0) return;
    const m = this.mobUnderCrosshair();
    this.swing = 1;
    this.attackCooldown = 0.32;
    if (!m) return;
    const tool = this.toolInfo();
    const dmg = tool ? tool.damage : 1;
    const killed = m.damage(dmg);
    audio.hurt();
    this.particles.burst(
      m.body.pos.x,
      m.body.pos.y + m.def.h * 0.6,
      m.body.pos.z,
      6,
      [0.7, 0.1, 0.1],
      2,
      0.09,
      0.5,
      2,
    );
    // knockback
    const dx = m.body.pos.x - this.body.pos.x;
    const dz = m.body.pos.z - this.body.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    m.body.vel.x += (dx / l) * 5;
    m.body.vel.z += (dz / l) * 5;
    m.body.vel.y += 3.5;
    if (this.mode === "survival") this.inv.damageSelected(1);
    if (killed) {
      for (const d of m.def.drops) {
        const n = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
        if (n > 0) this.dropItem(d.id, n, m.body.pos.x, m.body.pos.y + 0.4, m.body.pos.z);
      }
      this.giveXp(m.def.xp);
      this.addStat("kills");
      if (this.stats.kills === 1) this.grantAchievement("hunter", "Hunter — Defeat a creature");
      this.scene.remove(m.group);
      this.mobs.splice(this.mobs.indexOf(m), 1);
    }
  }

  damagePlayer(n: number, cause = "") {
    if (this.mode === "creative" || this.dead) return;
    this.health -= n;
    this.damageFlash = 1;
    const now = performance.now();
    if (now - this.lastHurtSound > 350) {
      audio.hurt();
      this.lastHurtSound = now;
    }
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      this.setScreen("death");
    }
    this.markUi();
    void cause;
  }

  respawn() {
    this.dead = false;
    this.health = 20;
    this.hunger = 20;
    this.air = 10;
    this.body.pos.copy(this.spawnPoint);
    this.body.vel.set(0, 0, 0);
    const top = this.world.surfaceHeight(
      Math.floor(this.spawnPoint.x),
      Math.floor(this.spawnPoint.z),
    );
    this.body.pos.y = Math.max(this.spawnPoint.y, top);
    this.setScreen("none");
  }

  // ── inventory UI operations ──────────────────────────────────────────────
  private slotRef(area: string, i: number): Stack | null {
    if (area === "inv") return this.inv.slots[i];
    if (area === "craft") return this.craftGrid[i];
    if (area === "out") return this.craftOutput();
    if (area === "f_in") return this.currentFurnace()?.input ?? null;
    if (area === "f_fuel") return this.currentFurnace()?.fuel ?? null;
    if (area === "f_out") return this.currentFurnace()?.output ?? null;
    return null;
  }
  private setSlot(area: string, i: number, s: Stack | null) {
    if (area === "inv") this.inv.slots[i] = s;
    else if (area === "craft") this.craftGrid[i] = s;
    else {
      const f = this.currentFurnace();
      if (!f) return;
      if (area === "f_in") f.input = s;
      else if (area === "f_fuel") f.fuel = s;
      else if (area === "f_out") f.output = s;
    }
  }

  currentFurnace(): FurnaceState | null {
    if (!this.openFurnaceKey) return null;
    return this.furnaces.get(this.openFurnaceKey) ?? null;
  }

  craftOutput(): Stack | null {
    const r = matchRecipe(this.craftGrid.slice(0, this.craftW * this.craftW), this.craftW);
    if (!r) return null;
    return { id: r.out.id, count: r.out.count };
  }

  private consumeCraft() {
    for (let i = 0; i < this.craftW * this.craftW; i++) {
      const s = this.craftGrid[i];
      if (s) {
        s.count--;
        if (s.count <= 0) this.craftGrid[i] = null;
      }
    }
  }

  slotClick(area: string, i: number, right: boolean, shift: boolean) {
    const cur = this.cursor;
    if (area === "out") {
      const out = this.craftOutput();
      if (!out) return;
      if (shift) {
        let guard = 0;
        while (this.craftOutput() && guard++ < 64) {
          const o = this.craftOutput()!;
          if (this.inv.add(o.id, o.count) > 0) break;
          this.consumeCraft();
        }
        audio.craft();
        this.addStat("crafted");
        this.markUi();
        return;
      }
      if (!cur) {
        this.cursor = { ...out };
        this.consumeCraft();
        audio.craft();
        this.addStat("crafted");
        if (this.stats.crafted === 1) this.grantAchievement("craft", "Crafter — Craft an item");
      } else if (cur.id === out.id && cur.count + out.count <= stackMax(cur.id)) {
        cur.count += out.count;
        this.consumeCraft();
        audio.craft();
        this.addStat("crafted");
      }
      this.markUi();
      return;
    }
    if (area === "f_out") {
      const f = this.currentFurnace();
      if (!f?.output) return;
      if (!cur) {
        this.cursor = f.output;
        f.output = null;
      } else if (cur.id === f.output.id && cur.count + f.output.count <= stackMax(cur.id)) {
        cur.count += f.output.count;
        f.output = null;
      }
      this.markUi();
      return;
    }

    const slot = this.slotRef(area, i);
    if (shift && slot && area === "inv") {
      // quick move between hotbar and main inventory
      const from = i < 9 ? 9 : 0;
      const to = i < 9 ? 36 : 9;
      const max = stackMax(slot.id);
      for (let k = from; k < to && slot.count > 0; k++) {
        const t = this.inv.slots[k];
        if (t && t.id === slot.id && t.count < max) {
          const n = Math.min(max - t.count, slot.count);
          t.count += n;
          slot.count -= n;
        }
      }
      if (slot.count > 0) {
        for (let k = from; k < to; k++) {
          if (!this.inv.slots[k]) {
            this.inv.slots[k] = { ...slot };
            slot.count = 0;
            break;
          }
        }
      }
      if (slot.count <= 0) this.inv.slots[i] = null;
      this.markUi();
      return;
    }

    if (right) {
      if (cur && !slot) {
        this.setSlot(area, i, { id: cur.id, count: 1, dur: cur.dur });
        cur.count--;
        if (cur.count <= 0) this.cursor = null;
      } else if (cur && slot && slot.id === cur.id && slot.count < stackMax(slot.id)) {
        slot.count++;
        cur.count--;
        if (cur.count <= 0) this.cursor = null;
      } else if (!cur && slot) {
        const half = Math.ceil(slot.count / 2);
        this.cursor = { id: slot.id, count: half, dur: slot.dur };
        slot.count -= half;
        if (slot.count <= 0) this.setSlot(area, i, null);
      }
    } else {
      if (cur && slot && slot.id === cur.id && stackMax(slot.id) > 1) {
        const n = Math.min(stackMax(slot.id) - slot.count, cur.count);
        slot.count += n;
        cur.count -= n;
        if (cur.count <= 0) this.cursor = null;
      } else {
        this.setSlot(area, i, cur);
        this.cursor = slot;
      }
    }
    this.markUi();
  }

  /** craft directly from the recipe list */
  craftRecipe(index: number) {
    const r = RECIPES[index];
    if (!r) return;
    const need = new Map<string, number>();
    const ings = r.shapeless ?? (r.pattern ?? []).flatMap((row) => row.split("").map((ch) => (ch === " " ? null : r.key![ch])));
    for (const id of ings) {
      if (!id) continue;
      need.set(id, (need.get(id) ?? 0) + 1);
    }
    for (const [id, n] of need) if (!this.inv.has(id, n)) return;
    for (const [id, n] of need) this.inv.remove(id, n);
    const left = this.inv.add(r.out.id, r.out.count);
    if (left > 0) this.dropItem(r.out.id, left, this.body.pos.x, this.body.pos.y + 1, this.body.pos.z);
    audio.craft();
    this.addStat("crafted");
    if (this.stats.crafted === 1) this.grantAchievement("craft", "Crafter — Craft an item");
    this.markUi();
  }

  availableRecipes(): { out: Stack; i: number }[] {
    const out: { out: Stack; i: number }[] = [];
    const allow3 = this.screen === "crafting";
    for (let i = 0; i < RECIPES.length; i++) {
      const r = RECIPES[i];
      if (r.big && !allow3) continue;
      const need = new Map<string, number>();
      const ings = r.shapeless ?? (r.pattern ?? []).flatMap((row) => row.split("").map((ch) => (ch === " " ? null : r.key![ch])));
      let ok = true;
      for (const id of ings) {
        if (!id) continue;
        need.set(id, (need.get(id) ?? 0) + 1);
      }
      for (const [id, n] of need) if (!this.inv.has(id, n)) { ok = false; break; }
      if (ok) out.push({ out: { id: r.out.id, count: r.out.count }, i });
    }
    return out;
  }

  // ── main loop ────────────────────────────────────────────────────────────
  start() {
    this.lastTime = performance.now();
    const loop = () => {
      if (this.disposed) return;
      this.rafId = requestAnimationFrame(loop);
      const now = performance.now();
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      if (dt > 0.1) dt = 0.1;
      this.fpsAcc += dt;
      this.fpsCount++;
      if (this.fpsAcc > 0.4) {
        this.fps = this.fpsCount / this.fpsAcc;
        this.fpsAcc = 0;
        this.fpsCount = 0;
      }
      this.tick(dt);
      this.render();
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private tick(dt: number) {
    const active = this.screen !== "pause" && this.screen !== "death";
    if (active) {
      this.worldTime += dt;
      this.elapsed += dt;
    }
    const canControl = this.screen === "none" && !this.dead;

    this.updatePlayer(dt, canControl);
    this.world.update(this.body.pos.x, this.body.pos.z, 9);
    this.world.flushDirty(3);

    if (active) {
      this.updateWeather(dt);
      this.updateMobs(dt);
      this.updateItems(dt);
      this.updateFurnaces(dt);
      if (Math.random() < dt * 1.5) this.world.randomTick(Math.floor(this.body.pos.x), Math.floor(this.body.pos.z), this.rng);
    }
    this.particles.update(dt);
    this.updateEnvironment(dt);
    this.updateHand(dt);

    this.saveTimer -= dt;
    if (this.saveTimer <= 0) {
      this.saveTimer = 45;
      void this.save();
    }

    this.uiTimer -= dt;
    if (this.uiTimer <= 0) {
      this.uiTimer = 0.1;
      this.pushUi();
    }
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }
    if (this.achievementPopup) {
      this.achievementPopup.t -= dt;
      if (this.achievementPopup.t <= 0) this.achievementPopup = null;
    }
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
  }

  private updatePlayer(dt: number, canControl: boolean) {
    const b = this.body;
    const k = this.keys;
    this.sneaking = canControl && !!k.ShiftLeft && !this.flying;
    b.height = this.sneaking ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;

    let fwd = 0,
      strafe = 0;
    if (canControl) {
      if (k.KeyW) fwd += 1;
      if (k.KeyS) fwd -= 1;
      if (k.KeyA) strafe -= 1;
      if (k.KeyD) strafe += 1;
    }
    const moving = fwd !== 0 || strafe !== 0;
    this.sprinting = canControl && !!k.ControlLeft && fwd > 0 && this.hunger > 6;

    const inLiquid = b.inWater || b.inLava;
    let speed = this.sneaking ? 1.7 : this.sprinting ? 6.2 : 4.4;
    if (this.flying) speed = this.sprinting ? 18 : 9;
    if (inLiquid && !this.flying) speed *= 0.62;

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = (-sin * fwd + cos * strafe) * speed;
    let dz = (-cos * fwd - sin * strafe) * speed;
    if (moving) {
      const l = Math.hypot(dx, dz);
      dx = (dx / l) * speed;
      dz = (dz / l) * speed;
    }

    if (this.flying) {
      b.vel.x = dx;
      b.vel.z = dz;
      let vy = 0;
      if (k.Space) vy += speed;
      if (k.ShiftLeft) vy -= speed;
      b.vel.y = vy;
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      b.pos.z += b.vel.z * dt;
      b.onGround = false;
      b.inWater = false;
    } else {
      const accel = b.onGround ? 24 : 7;
      if (moving) {
        b.vel.x += (dx - b.vel.x) * Math.min(1, accel * dt);
        b.vel.z += (dz - b.vel.z) * Math.min(1, accel * dt);
      } else if (b.onGround) {
        const f = Math.pow(1 - b.slip * 0.9, dt * 20);
        b.vel.x *= f;
        b.vel.z *= f;
      }
      if (canControl && k.Space) {
        if (b.onLadder) b.vel.y = 3.2;
        else if (inLiquid) b.vel.y = Math.min(b.vel.y + 26 * dt, 3.6);
        else if (b.onGround) {
          b.vel.y = 8.4;
          this.fallStart = b.pos.y;
        }
      }
      if (b.onLadder && !k.Space) b.vel.y = Math.max(b.vel.y, -1.6);

      const prevY = b.pos.y;
      const wasGround = b.onGround;
      moveBody(this.world, b, dt);
      // fall damage
      if (!wasGround && b.onGround) {
        if (this.fallStart !== null) {
          const fall = this.fallStart - b.pos.y;
          if (fall > 3.5 && !b.inWater) {
            this.damagePlayer(Math.floor((fall - 3) * 1.1));
            this.particles.burst(b.pos.x, b.pos.y, b.pos.z, 8, [0.7, 0.65, 0.55], 2, 0.1, 0.5, 1);
          }
        }
        this.fallStart = null;
      }
      if (!b.onGround && b.vel.y > 0) this.fallStart = b.pos.y;
      if (!b.onGround && this.fallStart === null) this.fallStart = prevY;
      if (b.onGround) this.fallStart = null;
    }

    // footsteps + bob
    if (moving && b.onGround && !this.flying) {
      this.footTimer -= dt * (this.sprinting ? 1.5 : 1);
      this.bob += dt * (this.sprinting ? 13 : 9);
      if (this.footTimer <= 0) {
        this.footTimer = 0.42;
        const under = this.world.getBlock(
          Math.floor(b.pos.x),
          Math.floor(b.pos.y - 0.3),
          Math.floor(b.pos.z),
        );
        if (under) audio.step(block(under).sound);
        if (block(under).sound === "grass" || block(under).sound === "gravel") {
          const c = this.blockColor(under);
          this.particles.spawn(b.pos.x, b.pos.y + 0.05, b.pos.z, (Math.random() - 0.5) * 0.6, 0.6, (Math.random() - 0.5) * 0.6, c[0], c[1], c[2], 0.07, 0.4);
        }
        this.addStat("steps");
      }
    } else {
      this.bob = lerp(this.bob, 0, dt * 6);
    }

    // survival meters
    if (this.mode === "survival" && !this.dead && this.screen !== "pause") {
      const exertion = (moving ? (this.sprinting ? 0.055 : 0.016) : 0.004) + (b.inWater ? 0.01 : 0);
      this.hunger = Math.max(0, this.hunger - exertion * dt * 2.4);
      if (this.hunger > 17 && this.health < 20) {
        this.health = Math.min(20, this.health + dt * 0.6);
        this.hunger = Math.max(0, this.hunger - dt * 0.18);
      }
      if (this.hunger <= 0) {
        this.starveTimer = (this.starveTimer ?? 0) + dt;
        if (this.starveTimer > 4) {
          this.starveTimer = 0;
          this.damagePlayer(1);
        }
      }
      // drowning
      const headBlock = this.world.getBlock(
        Math.floor(b.pos.x),
        Math.floor(b.pos.y + this.eyeHeight()),
        Math.floor(b.pos.z),
      );
      if (headBlock === B.WATER) {
        this.air -= dt * 0.65;
        if (Math.random() < dt * 3)
          this.particles.spawn(
            b.pos.x + (Math.random() - 0.5) * 0.4,
            b.pos.y + this.eyeHeight(),
            b.pos.z + (Math.random() - 0.5) * 0.4,
            0, 1.2, 0, 0.8, 0.9, 1, 0.05, 1.2, -1.5,
          );
        if (this.air <= 0) {
          this.air = 0;
          this.drownTimer = (this.drownTimer ?? 0) + dt;
          if (this.drownTimer > 1.4) {
            this.drownTimer = 0;
            this.damagePlayer(2);
          }
        }
      } else {
        this.air = Math.min(10, this.air + dt * 3);
      }
      if (b.inLava) this.damagePlayer(dt * 5.5);
      // cactus
      const touching = this.world.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y + 0.5), Math.floor(b.pos.z));
      if (touching === B.CACTUS) this.damagePlayer(dt * 2);
    }

    // eating
    const held = this.inv.held;
    if (this.mouseDown[2] && held && item(held.id)?.food && this.mode === "survival") {
      this.eatTimer += dt;
      if (this.eatTimer > 1.3) {
        const f = item(held.id)!.food!;
        this.hunger = Math.min(20, this.hunger + f.hunger);
        if (f.heal) this.health = Math.min(20, this.health + f.heal);
        this.inv.consumeSelected(1);
        audio.eat();
        this.eatTimer = 0;
        this.particles.burst(
          b.pos.x, b.pos.y + this.eyeHeight() - 0.2, b.pos.z, 6, [0.8, 0.6, 0.4], 1, 0.06, 0.4, 1,
        );
        this.markUi();
      }
    } else if (!this.mouseDown[2]) this.eatTimer = 0;

    // breaking
    this.placeCooldown -= dt;
    this.attackCooldown -= dt;
    if (this.mouseDown[0] && this.screen === "none" && !this.dead) {
      const mob = this.mobUnderCrosshair();
      if (mob) {
        this.attack();
        this.breakTarget = null;
        this.crackMesh.visible = false;
      } else {
        const { origin, dir } = this.getLookRay();
        const hit = this.world.raycast(origin, dir, REACH);
        if (hit) {
          if (
            !this.breakTarget ||
            this.breakTarget.x !== hit.x ||
            this.breakTarget.y !== hit.y ||
            this.breakTarget.z !== hit.z
          ) {
            this.breakTarget = { x: hit.x, y: hit.y, z: hit.z };
            this.breakProgress = 0;
          }
          const t = this.breakTime(hit.id);
          this.breakProgress += dt / t;
          this.swing = Math.max(this.swing, 0.4);
          if (Math.random() < dt * 9) {
            const c = this.blockColor(hit.id);
            this.particles.spawn(
              hit.x + 0.5 + hit.nx * 0.55,
              hit.y + 0.5 + hit.ny * 0.55,
              hit.z + 0.5 + hit.nz * 0.55,
              (Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.5,
              c[0], c[1], c[2], 0.07, 0.5,
            );
          }
          if (Math.random() < dt * 4) audio.dig(block(hit.id).sound);
          if (this.breakProgress >= 1) {
            this.breakBlockAt(hit.x, hit.y, hit.z);
            this.breakProgress = 0;
            this.breakTarget = null;
          }
        } else {
          this.breakTarget = null;
          this.breakProgress = 0;
          if (this.attackCooldown <= 0) this.swing = 1;
        }
      }
    }
    if (this.mouseDown[2] && this.placeCooldown <= 0 && this.screen === "none") {
      const held2 = this.inv.held;
      if (held2 && item(held2.id)?.block) this.useItem();
    }

    // camera
    const eye = this.eyeHeight();
    const bobAmt = this.sprinting ? 0.055 : 0.035;
    this.camera.position.set(
      b.pos.x + Math.cos(this.bob) * bobAmt * 0.4,
      b.pos.y + eye + Math.sin(this.bob * 2) * bobAmt,
      b.pos.z,
    );
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw);
    this.camera.rotateX(this.pitch);
    this.camera.rotateZ(Math.sin(this.bob) * 0.012);
    const targetFov = this.sprinting ? 82 : this.flying ? 78 : 75;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    // selection box + crack
    if (this.screen === "none" && !this.dead) {
      const { origin, dir } = this.getLookRay();
      const hit = this.world.raycast(origin, dir, REACH);
      if (hit) {
        this.selectBox.visible = true;
        this.selectBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        if (this.breakTarget && this.breakProgress > 0.02) {
          this.crackMesh.visible = true;
          this.crackMesh.position.set(
            this.breakTarget.x + 0.5,
            this.breakTarget.y + 0.5,
            this.breakTarget.z + 0.5,
          );
          this.crackMat.uniforms.uStage.value = Math.min(9, Math.floor(this.breakProgress * 10));
        } else this.crackMesh.visible = false;
      } else {
        this.selectBox.visible = false;
        this.crackMesh.visible = false;
      }
    } else {
      this.selectBox.visible = false;
      this.crackMesh.visible = false;
    }

    this.swing = Math.max(0, this.swing - dt * 3.4);
  }
  private starveTimer = 0;
  private drownTimer = 0;

  private updateWeather(dt: number) {
    this.rainTimer -= dt;
    if (this.rainTimer <= 0) {
      const r = Math.random();
      if (this.rainState === "clear") {
        this.rainState = r < 0.25 ? "thunder" : "rain";
        this.rainTimer = 50 + Math.random() * 120;
        this.toast = { text: this.rainState === "thunder" ? "A storm rolls in…" : "It begins to rain", t: 4 };
      } else {
        this.rainState = "clear";
        this.rainTimer = 180 + Math.random() * 360;
      }
    }
    const target = this.rainState === "clear" ? 0 : this.rainState === "thunder" ? 1 : 0.7;
    this.rainIntensity += (target - this.rainIntensity) * Math.min(1, dt * 0.35);
    audio.setRain(this.rainIntensity);

    if (this.rainState === "thunder" && this.rainIntensity > 0.5) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 6 + Math.random() * 22;
        this.sky.lightning = 1;
        audio.thunder();
      }
    }
    this.sky.lightning = Math.max(0, this.sky.lightning - dt * 3.5);
    this.uniforms.uLightning.value = this.sky.lightning * 0.8;
  }

  private updateEnvironment(dt: number) {
    const cam = this.camera.position;
    this.sky.update(this.worldTime, cam, this.rainIntensity);
    this.uniforms.uTime.value = this.elapsed;
    (this.uniforms.uSunDir.value as THREE.Vector3).copy(this.sky.sunDir);
    this.uniforms.uDayLight.value = Math.max(0.03, this.sky.dayLight);
    (this.uniforms.uSkyLightColor.value as THREE.Color).setRGB(
      lerp(1, this.sky.sunColor.r, 0.35),
      lerp(1, this.sky.sunColor.g, 0.35),
      lerp(1, this.sky.sunColor.b, 0.35),
    );
    (this.uniforms.uAmbient.value as THREE.Color).copy(this.sky.ambient);
    (this.uniforms.uCamPos.value as THREE.Vector3).copy(cam);

    const headBlock = this.world.getBlock(
      Math.floor(cam.x),
      Math.floor(cam.y),
      Math.floor(cam.z),
    );
    const underwater = headBlock === B.WATER;
    this.inBlock = block(headBlock).opaque && block(headBlock).solid;
    this.uniforms.uUnderwater.value += ((underwater ? 1 : 0) - this.uniforms.uUnderwater.value) * Math.min(1, dt * 8);
    audio.setUnderwater(underwater);

    const renderDist = this.world.renderDistance * 16;
    const baseDensity = 1.9 / renderDist;
    this.uniforms.uFogDensity.value = baseDensity * (1 + this.rainIntensity * 0.9);
    // underground: fade the fog to cave darkness so you cannot see "sky" through rock
    const camSky = this.world.getLight(Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)) >> 4;
    const depth = clamp((SEA_LEVEL + 12 - cam.y) / 26, 0, 1);
    const caveAmt = clamp(depth * (1 - camSky / 15) * 1.3, 0, 1);
    this.caveAmt += (caveAmt - this.caveAmt) * Math.min(1, dt * 2.5);
    const fogCol = this.sky.fogColor.clone().lerp(new THREE.Color(0.022, 0.024, 0.032), this.caveAmt);
    (this.uniforms.uFogColor.value as THREE.Color).copy(fogCol);
    this.sky.uniforms.uUnderwater.value = this.uniforms.uUnderwater.value;
    this.sky.uniforms.uCave.value = this.caveAmt;
    (this.sky.uniforms.uCaveColor.value as THREE.Color).copy(fogCol);
    const f = this.scene.fog as THREE.FogExp2;
    f.density = this.uniforms.uFogDensity.value * (underwater ? 7 : 1) * (1 + this.caveAmt * 0.9);
    this.uniforms.uFogDensity.value *= 1 + this.caveAmt * 0.9;
    f.color.copy(underwater ? new THREE.Color(0.09, 0.26, 0.45) : fogCol);
    this.particles.mat.uniforms.uFogDensity.value = f.density;
    (this.particles.mat.uniforms.uFogColor.value as THREE.Color).copy(f.color);

    // lights for entities
    const dl = this.sky.dayLight;
    this.hemi.intensity = 0.35 + dl * 0.75;
    this.hemi.color.copy(this.sky.skyColor).lerp(new THREE.Color(1, 1, 1), 0.45);
    this.sunLight.position.copy(cam).addScaledVector(this.sky.sunDir, 60);
    this.sunLight.target.position.copy(cam);
    this.sunLight.intensity = Math.max(0, this.sky.sunDir.y) * 1.5 * (1 - this.rainIntensity * 0.6);
    this.sunLight.color.copy(this.sky.sunColor);

    // weather visuals
    const biome = this.world.biomeAt(Math.floor(cam.x), Math.floor(cam.z));
    const snowy = biome === 5 || biome === 6;
    this.weather.update(this.elapsed, cam, this.rainIntensity, snowy);
    this.weather.mat.uniforms.uRange.value = 46;

    // rain splashes
    if (this.rainIntensity > 0.3 && Math.random() < dt * 30) {
      const rx = cam.x + (Math.random() - 0.5) * 20;
      const rz = cam.z + (Math.random() - 0.5) * 20;
      const ry = this.world.surfaceHeight(Math.floor(rx), Math.floor(rz));
      if (Math.abs(ry - cam.y) < 20)
        this.particles.spawn(rx, ry, rz, 0, 1.1, 0, 0.6, 0.7, 0.9, 0.05, 0.3, 9);
    }
    // ambient music
    audio.tickMusic(this.elapsed, this.sky.isNight(this.worldTime));
  }

  private updateMobs(dt: number) {
    const isDay = !this.sky.isNight(this.worldTime);
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      m.update(dt, this.world, this.body.pos, isDay, this.particles);
      const d = m.body.pos.distanceTo(this.body.pos);
      if (d > 88 || m.body.pos.y < -4) {
        this.scene.remove(m.group);
        this.mobs.splice(i, 1);
        continue;
      }
      if (m.def.hostile && d < 1.5 && m.attackCd <= 0 && !this.dead) {
        m.attackCd = 1.1;
        this.damagePlayer(m.def.damage);
        const dx = this.body.pos.x - m.body.pos.x;
        const dz = this.body.pos.z - m.body.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        this.body.vel.x += (dx / l) * 5;
        this.body.vel.z += (dz / l) * 5;
        this.body.vel.y += 3.2;
      }
      if (m.body.inLava) m.damage(dt * 6);
    }

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 3.5;
      this.trySpawn();
    }
  }

  private trySpawn() {
    const night = this.sky.isNight(this.worldTime);
    const hostile = this.mobs.filter((m) => m.def.hostile).length;
    const passive = this.mobs.filter((m) => !m.def.hostile).length;
    const cap = night ? 16 : 14;
    if (this.mobs.length >= cap) return;
    for (let att = 0; att < 8; att++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 26 + Math.random() * 28;
      const x = Math.floor(this.body.pos.x + Math.cos(ang) * r);
      const z = Math.floor(this.body.pos.z + Math.sin(ang) * r);
      if (!this.world.getChunk(x >> 4, z >> 4)) continue;
      const y = this.world.surfaceHeight(x, z);
      if (y <= SEA_LEVEL || y >= WORLD_HEIGHT - 3) continue;
      const ground = this.world.getBlock(x, y - 1, z);
      if (!block(ground).solid) continue;
      if (this.world.getBlock(x, y, z) !== 0 || this.world.getBlock(x, y + 1, z) !== 0) continue;
      const lightSky = this.world.getLight(x, y, z) >> 4;
      const lightBlk = this.world.getLight(x, y, z) & 15;
      const biome = this.world.biomeAt(x, z);
      const dark = lightBlk < 7 && (night || lightSky < 7);
      let kind: MobKind | null;
      if (dark && hostile < 10) kind = pickSpawnKind(biome, true, Math.random);
      else if (!night && passive < 9 && lightSky > 8) kind = pickSpawnKind(biome, false, Math.random);
      else kind = null;
      if (!kind) continue;
      if (MOBS[kind].hostile && !dark) continue;
      const m = new Mob(kind, x + 0.5, y, z + 0.5);
      this.mobs.push(m);
      this.scene.add(m.group);
      return;
    }
  }

  private updateItems(dt: number) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.update(dt, this.world);
      const d = e.body.pos.distanceTo(this.body.pos);
      if (e.pickupDelay <= 0 && d < 1.6) {
        const left = this.inv.add(e.id, e.count, e.dur);
        if (left < e.count) {
          audio.pickup();
          this.toast = { text: `+${e.count - left} ${item(e.id)?.name ?? e.id}`, t: 2 };
          this.addStat("collected", e.count - left);
          this.markUi();
        }
        if (left === 0) {
          this.scene.remove(e.obj);
          this.items.splice(i, 1);
          continue;
        }
        e.count = left;
      }
      if (e.age > 300 || e.body.pos.y < -5) {
        this.scene.remove(e.obj);
        this.items.splice(i, 1);
      }
    }
    // merge nearby stacks occasionally
    if (this.items.length > 48) {
      const e = this.items.shift();
      if (e) this.scene.remove(e.obj);
    }
  }

  private updateFurnaces(dt: number) {
    for (const [key, f] of this.furnaces) {
      const burning = f.burnTime > 0;
      const changed = tickFurnace(f, dt);
      const [x, y, z] = key.split(",").map(Number);
      const id = this.world.getBlock(x, y, z);
      const nowBurning = f.burnTime > 0;
      if (nowBurning && id === B.FURNACE) this.world.setBlock(x, y, z, B.FURNACE_LIT);
      else if (!nowBurning && id === B.FURNACE_LIT) this.world.setBlock(x, y, z, B.FURNACE);
      if (nowBurning && Math.random() < dt * 4) {
        this.particles.spawn(
          x + 0.5 + (Math.random() - 0.5) * 0.4, y + 1.05, z + 0.5 + (Math.random() - 0.5) * 0.4,
          0, 0.5, 0, 0.35, 0.35, 0.37, 0.07, 1.4, -0.6,
        );
      }
      if (changed && key === this.openFurnaceKey) this.markUi();
      void burning;
    }
  }

  private updateHand(dt: number) {
    const held = this.inv.held;
    const key = held ? held.id : "__hand";
    if (key !== this.handKey) {
      this.handKey = key;
      if (this.handMesh) {
        this.handScene.remove(this.handMesh);
        this.handMesh = null;
      }
      const def = held ? item(held.id) : undefined;
      if (def?.block) {
        const e = new ItemEntity(held!.id, 1, 0, 0, 0, this.handMaterial);
        this.handMesh = e.obj;
      } else if (def) {
        const tex = new THREE.TextureLoader().load(def.icon);
        tex.magFilter = THREE.NearestFilter;
        tex.colorSpace = THREE.SRGBColorSpace;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
        this.handMesh = sp;
      } else {
        const g = new THREE.BoxGeometry(0.75, 2.0, 0.75);
        const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xd8a080 }));
        this.handMesh = m;
      }
      if (this.handMesh) this.handScene.add(this.handMesh);
    }
    if (this.handMesh) {
      const sw = this.swing;
      const s = Math.sin(Math.min(1, sw) * Math.PI);
      const isSprite = (this.handMesh as THREE.Sprite).isSprite === true;
      this.handMesh.position.set(
        0.33 - s * 0.06,
        -0.3 - s * 0.1 + Math.sin(this.bob * 2) * 0.01,
        -0.66 + s * 0.1,
      );
      if (!isSprite) this.handMesh.rotation.set(-0.18 + s * 0.85, 0.62 - s * 0.35, 0.12 + s * 0.28);
      this.handMesh.scale.setScalar(isSprite ? 0.19 : 0.17);
      void dt;
    }
  }

  private render() {
    const r = this.renderer;
    r.info.reset();
    r.clear();
    r.render(this.scene, this.camera);
    r.clearDepth();
    r.render(this.handScene, this.handCamera);
  }

  // ── UI bridge ────────────────────────────────────────────────────────────
  markUi() {
    this.version++;
    this.pushUi();
  }

  private buildSnapshot() {
    this.snapshot = {
      v: 0,
      health: 20,
      hunger: 20,
      air: 10,
      xp: 0,
      xpNeeded: XP_PER_LEVEL(0),
      level: 0,
      slots: [],
      selected: 0,
      cursor: null,
      craft: [],
      craftW: 2,
      craftOut: null,
      furnace: null,
      screen: "none",
      mode: "survival",
      heldName: null,
      toast: null,
      achievement: null,
      fps: 60,
      pos: [0, 0, 0],
      biome: "",
      timeStr: "",
      chunks: 0,
      tris: 0,
      drawCalls: 0,
      weather: "clear",
      underwater: false,
      inBlock: false,
      damageFlash: 0,
      recipes: [],
      paused: false,
      seed: this.seed,
      worldName: this.worldName,
    };
  }

  private pushUi() {
    const t = ((this.worldTime / DAY_LENGTH) % 1 + 1) % 1;
    const hours = Math.floor(t * 24);
    const mins = Math.floor((t * 24 * 60) % 60);
    const held = this.inv.held;
    const cam = this.camera.position;
    const info = this.renderer.info;
    const s: Snapshot = {
      v: this.version,
      health: this.health,
      hunger: this.hunger,
      air: this.air,
      xp: this.xp,
      xpNeeded: XP_PER_LEVEL(this.level),
      level: this.level,
      slots: this.inv.slots.slice(),
      selected: this.inv.selected,
      cursor: this.cursor,
      craft: this.craftGrid.slice(),
      craftW: this.craftW,
      craftOut: this.craftOutput(),
      furnace: this.currentFurnace(),
      screen: this.screen,
      mode: this.mode,
      heldName: held ? item(held.id)?.name ?? held.id : null,
      toast: this.toast,
      achievement: this.achievementPopup?.text ?? null,
      fps: this.fps,
      pos: [this.body.pos.x, this.body.pos.y, this.body.pos.z],
      biome: BIOME_NAMES[this.world.biomeAt(Math.floor(cam.x), Math.floor(cam.z))] ?? "",
      timeStr: `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`,
      chunks: this.world.chunks.size,
      tris: info.render.triangles,
      drawCalls: info.render.calls,
      weather: this.rainState,
      underwater: this.uniforms.uUnderwater.value > 0.5,
      inBlock: this.inBlock,
      damageFlash: this.damageFlash,
      recipes: this.screen === "inventory" || this.screen === "crafting" ? this.availableRecipes() : [],
      paused: this.paused,
      seed: this.seed,
      worldName: this.worldName,
    };
    this.snapshot = s;
    this.onUpdate(s);
  }

  setRenderDistance(n: number) {
    this.world.renderDistance = n;
    this.world.chunks.forEach(() => {});
    (this as any).lastCenter = null;
    this.world["lastCenter"] = { cx: 99999, cz: 99999 };
  }

  setMode(m: Mode) {
    this.mode = m;
    if (m === "survival") this.flying = false;
    this.markUi();
  }

  async save() {
    const data: SaveData = {
      version: 1,
      name: this.worldName,
      seed: this.seed,
      time: this.worldTime,
      player: {
        x: this.body.pos.x,
        y: this.body.pos.y,
        z: this.body.pos.z,
        yaw: this.yaw,
        pitch: this.pitch,
        health: this.health,
        hunger: this.hunger,
        xp: this.xp,
        level: this.level,
        mode: this.mode,
        spawn: [this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z],
      },
      inventory: this.inv.serialize(),
      edits: this.world.collectEdits(),
      furnaces: Object.fromEntries(this.furnaces),
      stats: this.stats,
      achievements: [...this.achievements],
      savedAt: Date.now(),
    };
    await saveWorld(this.worldKey, data);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    window.removeEventListener("resize", this.onResize);
    this.world.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export { loadWorld, hashString, SMELTING, COOK_TIME, itemBlock, GRAVITY };
