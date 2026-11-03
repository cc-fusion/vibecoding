import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import {
  blockForItem,
  blockHardness,
  blockName,
  BlockId,
  ITEM_DEFS,
  itemForBlock,
  RECIPES,
  type ItemId,
} from "./blocks";
import { blockTint, VoxelWorld } from "./world";
import { clearSave, DEFAULT_SEED, makeSeed, writeSave, type SavedGame } from "./storage";
import { SEA_LEVEL, WORLD_HEIGHT } from "./terrain";

export type GameMode = "menu" | "playing" | "paused" | "inventory";

export interface GameSnapshot {
  mode: GameMode;
  seed: string;
  biome: string;
  timeLabel: string;
  phase: string;
  day: number;
  weather: "clear" | "rain";
  daylight: number;
  inventory: Partial<Record<ItemId, number>>;
  hotbar: (ItemId | null)[];
  selectedSlot: number;
  selectedItem: ItemId | null;
  selectedCount: number;
  targetName: string | null;
  miningProgress: number;
  saved: boolean;
  hasSave: boolean;
  soundEnabled: boolean;
  toast: string | null;
  position: { x: number; y: number; z: number };
}

interface Player {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

interface BlockHit {
  x: number;
  y: number;
  z: number;
  id: BlockId;
  normal: { x: number; y: number; z: number };
}

interface Particle {
  mesh: Mesh;
  velocity: Vector3;
  age: number;
  lifetime: number;
}

interface Critter {
  root: Group;
  legs: Group[];
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  idle: number;
  fleeing: number;
  phase: number;
}

const PLAYER_RADIUS = 0.31;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;
const SAVE_INTERVAL = 12_000;
const DAY_LENGTH_SECONDS = 480;
const KEY_TO_CODE = new Map<string, string>([
  ["w", "KeyW"], ["a", "KeyA"], ["s", "KeyS"], ["d", "KeyD"],
  ["arrowup", "ArrowUp"], ["arrowleft", "ArrowLeft"], ["arrowdown", "ArrowDown"], ["arrowright", "ArrowRight"],
]);

function makeEmptyHotbar(): (ItemId | null)[] {
  return Array.from({ length: 9 }, () => null);
}

function safeInventory(source: SavedGame["inventory"] | undefined): Partial<Record<ItemId, number>> {
  const result: Partial<Record<ItemId, number>> = {};
  if (!source) return result;
  for (const [item, amount] of Object.entries(source)) {
    if (item in ITEM_DEFS && typeof amount === "number" && amount > 0 && Number.isFinite(amount)) {
      result[item as ItemId] = Math.floor(amount);
    }
  }
  return result;
}

function formatTime(time: number): { label: string; phase: string; daylight: number } {
  const angle = time * Math.PI * 2 - Math.PI / 2;
  const elevation = Math.sin(angle);
  const daylight = MathUtils.clamp((elevation + 0.12) / 0.78, 0, 1);
  const totalMinutes = Math.floor(time * 24 * 60);
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minute = Math.floor((totalMinutes % 60) / 10) * 10;
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 < 12 ? "AM" : "PM";
  let phase = "Night";
  if (elevation > 0.55) phase = "Daylight";
  else if (elevation > -0.18) phase = elevation > 0 ? "Morning" : "Dusk";
  else if (elevation > -0.55) phase = "Twilight";
  return { label: `${hour12}:${String(minute).padStart(2, "0")} ${meridiem}`, phase, daylight };
}

export class VoxelGame {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.1, 150);
  readonly renderer: WebGLRenderer;
  readonly sky: Sky;
  readonly sun: DirectionalLight;
  readonly hemisphere: HemisphereLight;
  readonly ambient: AmbientLight;
  readonly rain: LineSegments;
  readonly fireflies: Points;

  private readonly host: HTMLElement;
  private readonly onUpdate: (snapshot: GameSnapshot) => void;
  private readonly resizeHandler = () => this.resize();
  private readonly keyDownHandler = (event: KeyboardEvent) => this.onKeyDown(event);
  private readonly keyUpHandler = (event: KeyboardEvent) => this.onKeyUp(event);
  private readonly pointerLockHandler = () => this.onPointerLockChange();
  private readonly pointerErrorHandler = () => this.onPointerLockError();
  private readonly mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
  private readonly pointerMoveHandler = (event: PointerEvent) => this.onPointerMove(event);
  private readonly pointerDownHandler = (event: PointerEvent) => this.onPointerDown(event);
  private readonly pointerUpHandler = (event: PointerEvent) => this.onPointerUp(event);
  private readonly wheelHandler = (event: WheelEvent) => this.onWheel(event);
  private readonly contextMenuHandler = (event: MouseEvent) => event.preventDefault();
  private readonly beforeUnloadHandler = () => this.saveNow(false);
  private readonly visibilityHandler = () => {
    if (document.visibilityState === "hidden") this.saveNow(false);
  };

  private world: VoxelWorld;
  private seed: string;
  private player: Player;
  private velocity = new Vector3();
  private mode: GameMode = "menu";
  private worldTime = 0.38;
  private dayCount = 1;
  private weather: "clear" | "rain" = "clear";
  private weatherTimer = 145;
  private weatherClock = 0;
  private inventory: Partial<Record<ItemId, number>> = {};
  private hotbar = makeEmptyHotbar();
  private selectedSlot = 0;
  private target: BlockHit | null = null;
  private miningKey = "";
  private miningDuration = 0;
  private miningElapsed = 0;
  private leftMouseDown = false;
  private currentToast: string | null = null;
  private toastUntil = 0;
  private hasSave = false;
  private saveSucceeded = true;
  private soundEnabled = true;
  private pointerLocked = false;
  private readonly input = new Set<string>();
  private readonly touchInput = new Set<string>();
  private readonly coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  private lookPointer: { id: number; x: number; y: number } | null = null;
  private elapsed = 0;
  private lastFrame = 0;
  private lastHudUpdate = 0;
  private lastSavedAt = 0;
  private animationFrame = 0;
  private disposed = false;
  private cameraDirection = new Vector3();
  private readonly sunDirection = new Vector3();
  private readonly nightFogColor = new Color("#111d31");
  private readonly dayFogColor = new Color("#b8d8d6");
  private readonly rainFogColor = new Color("#839a9b");
  private readonly workingFogColor = new Color();
  private readonly skyMaterial: import("three").ShaderMaterial;
  private readonly rainPositions: Float32Array;
  private readonly rainOffsets: { x: number; y: number; z: number }[] = [];
  private readonly fireflyPositions: Float32Array;
  private readonly fireflyBase: { x: number; y: number; z: number; phase: number }[] = [];
  private readonly particleGeometry = new BoxGeometry(0.13, 0.13, 0.13);
  private readonly particleMaterials = new Map<BlockId, MeshLambertMaterial>();
  private readonly particles: Particle[] = [];
  private audioContext: AudioContext | null = null;
  private readonly critterGeometries = {
    body: new BoxGeometry(0.62, 0.36, 0.36),
    head: new BoxGeometry(0.31, 0.29, 0.3),
    ear: new BoxGeometry(0.085, 0.29, 0.07),
    leg: new BoxGeometry(0.12, 0.3, 0.12),
    eye: new BoxGeometry(0.045, 0.055, 0.04),
    nose: new BoxGeometry(0.09, 0.07, 0.08),
    tail: new BoxGeometry(0.16, 0.16, 0.16),
  };
  private readonly critterMaterials = {
    body: new MeshLambertMaterial({ color: "#a77952" }),
    light: new MeshLambertMaterial({ color: "#d5b28a" }),
    ear: new MeshLambertMaterial({ color: "#b87973" }),
    eye: new MeshLambertMaterial({ color: "#252c29" }),
  };
  private critters: Critter[] = [];
  private critterTimer = 0;
  private metWildlife = false;

  constructor(host: HTMLElement, saved: SavedGame | null, onUpdate: (snapshot: GameSnapshot) => void) {
    this.host = host;
    this.onUpdate = onUpdate;
    this.seed = saved?.seed ?? DEFAULT_SEED;

    try {
      this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      throw new Error("WebGL is unavailable. Try a browser with hardware acceleration enabled.");
    }
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.14;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = 2;
    this.renderer.domElement.className = "voxel-canvas";
    this.renderer.domElement.setAttribute("aria-label", "Wilds first-person voxel world");
    this.renderer.domElement.tabIndex = 0;
    this.host.appendChild(this.renderer.domElement);

    this.scene.fog = new Fog(new Color("#a7c9cc"), 28, 112);
    this.sky = new Sky();
    this.sky.scale.setScalar(450_000);
    this.skyMaterial = this.sky.material as import("three").ShaderMaterial;
    this.skyMaterial.uniforms["turbidity"].value = 8;
    this.skyMaterial.uniforms["rayleigh"].value = 2.1;
    this.skyMaterial.uniforms["mieCoefficient"].value = 0.006;
    this.skyMaterial.uniforms["mieDirectionalG"].value = 0.82;
    this.scene.add(this.sky);

    this.hemisphere = new HemisphereLight("#d5e9ed", "#786c59", 1.1);
    this.scene.add(this.hemisphere);
    this.ambient = new AmbientLight("#9fb1ad", 0.2);
    this.scene.add(this.ambient);
    this.sun = new DirectionalLight("#fff0d4", 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -46;
    this.sun.shadow.camera.right = 46;
    this.sun.shadow.camera.top = 46;
    this.sun.shadow.camera.bottom = -46;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 130;
    this.sun.shadow.bias = -0.00018;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun, this.sun.target);

    this.world = new VoxelWorld(this.scene, this.seed, saved?.edits ?? []);
    const freshSpawn = this.world.findSpawn();
    const storedPlayer = saved?.player;
    const canUseStoredPosition = storedPlayer && storedPlayer.y > 1 && storedPlayer.y < WORLD_HEIGHT - PLAYER_HEIGHT - 0.5;
    this.player = canUseStoredPosition
      ? {
          x: storedPlayer.x,
          y: storedPlayer.y,
          z: storedPlayer.z,
          yaw: storedPlayer.yaw,
          pitch: MathUtils.clamp(storedPlayer.pitch, -1.45, 1.45),
        }
      : { ...freshSpawn, yaw: -0.58, pitch: -0.12 };
    this.worldTime = saved?.time ?? 0.38;
    this.inventory = safeInventory(saved?.inventory);
    this.hotbar = Array.from({ length: 9 }, (_, index) => saved?.hotbar?.[index] ?? null);
    this.selectedSlot = Math.max(0, Math.min(8, saved?.selectedSlot ?? 0));
    this.hasSave = Boolean(saved);
    this.saveSucceeded = Boolean(saved);

    this.world.streamTo(this.player.x, this.player.z);
    if (!this.canOccupy(this.player.x, this.player.y, this.player.z)) {
      this.player = { ...freshSpawn, yaw: -0.58, pitch: -0.12 };
      this.world.streamTo(this.player.x, this.player.z);
    }
    this.updateCamera();

    const rainCount = 190;
    this.rainPositions = new Float32Array(rainCount * 2 * 3);
    const rainGeometry = new BufferGeometry();
    rainGeometry.setAttribute("position", new BufferAttribute(this.rainPositions, 3));
    const rainMaterial = new LineBasicMaterial({ color: "#b5dce2", transparent: true, opacity: 0.38, depthWrite: false });
    this.rain = new LineSegments(rainGeometry, rainMaterial);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
    for (let index = 0; index < rainCount; index += 1) {
      this.rainOffsets.push({ x: (Math.random() - 0.5) * 30, y: Math.random() * 20, z: (Math.random() - 0.5) * 30 });
    }

    const fireflyCount = 44;
    this.fireflyPositions = new Float32Array(fireflyCount * 3);
    const fireflyGeometry = new BufferGeometry();
    fireflyGeometry.setAttribute("position", new BufferAttribute(this.fireflyPositions, 3));
    const fireflyMaterial = new PointsMaterial({
      color: "#ffe6a0",
      size: 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.fireflies = new Points(fireflyGeometry, fireflyMaterial);
    this.fireflies.frustumCulled = false;
    this.fireflies.visible = false;
    this.scene.add(this.fireflies);
    for (let index = 0; index < fireflyCount; index += 1) {
      this.fireflyBase.push({
        x: (Math.random() - 0.5) * 40,
        y: 0.5 + Math.random() * 4.5,
        z: (Math.random() - 0.5) * 40,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.createWildlife();
    this.attachEvents();
    this.lastFrame = performance.now();
    this.lastSavedAt = this.lastFrame;
    this.updateAtmosphere();
    this.emitSnapshot();
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  startWorld(): void {
    this.setMode("playing");
    this.focusWorld();
    this.playSound("start");
  }

  resumeWorld(): void {
    this.setMode("playing");
    this.focusWorld();
  }

  pauseToMenu(): void {
    this.saveNow();
    this.setMode("menu");
    this.leavePointerLock();
  }

  openInventory(): void {
    if (this.mode !== "playing") return;
    this.setMode("inventory");
    this.input.clear();
    this.touchInput.clear();
    this.leftMouseDown = false;
    this.leavePointerLock();
  }

  closeInventory(resume = true): void {
    if (this.mode !== "inventory") return;
    this.setMode(resume ? "playing" : "paused");
    if (resume) this.focusWorld();
  }

  newWorld(): void {
    this.leavePointerLock();
    clearSave();
    this.world.dispose();
    this.seed = makeSeed();
    this.world = new VoxelWorld(this.scene, this.seed);
    const spawn = this.world.findSpawn();
    this.player = { ...spawn, yaw: -0.58, pitch: -0.12 };
    this.velocity.set(0, 0, 0);
    this.worldTime = 0.38;
    this.dayCount = 1;
    this.weather = "clear";
    this.weatherTimer = 150;
    this.inventory = {};
    this.hotbar = makeEmptyHotbar();
    this.selectedSlot = 0;
    this.hasSave = false;
    this.saveSucceeded = true;
    this.metWildlife = false;
    this.critterTimer = 0;
    this.mode = "menu";
    this.target = null;
    this.clearCritters();
    this.world.streamTo(this.player.x, this.player.z);
    this.createWildlife();
    this.setToast("A new world takes root.", 2800);
    this.updateCamera();
    this.emitSnapshot();
  }

  saveNow(showStatus = true): void {
    const save: SavedGame = {
      version: 1,
      seed: this.seed,
      edits: this.world.getSavedEdits(),
      inventory: this.inventory,
      hotbar: this.hotbar,
      selectedSlot: this.selectedSlot,
      player: { ...this.player },
      time: this.worldTime,
    };
    this.saveSucceeded = writeSave(save);
    this.hasSave = this.saveSucceeded || this.hasSave;
    this.lastSavedAt = performance.now();
    if (showStatus) this.setToast(this.saveSucceeded ? "World saved locally." : "Could not save in this browser.", 2200);
    else this.emitSnapshot();
  }

  selectSlot(index: number): void {
    this.selectedSlot = Math.max(0, Math.min(8, index));
    this.emitSnapshot();
  }

  assignToSelectedSlot(item: ItemId): void {
    if (!this.inventory[item]) return;
    this.hotbar[this.selectedSlot] = item;
    this.playSound("select");
    this.emitSnapshot();
  }

  assignToSlot(item: ItemId, slot: number): void {
    if (!this.inventory[item] || slot < 0 || slot > 8) return;
    this.hotbar[slot] = item;
    this.selectedSlot = slot;
    this.emitSnapshot();
  }

  craft(item: ItemId): void {
    const recipe = RECIPES.find((candidate) => candidate.id === item);
    if (!recipe) return;
    const canCraft = Object.entries(recipe.ingredients).every(([ingredient, count]) =>
      (this.inventory[ingredient as ItemId] ?? 0) >= (count ?? 0),
    );
    if (!canCraft) return;

    for (const [ingredient, count] of Object.entries(recipe.ingredients)) {
      this.removeItem(ingredient as ItemId, count ?? 0);
    }
    this.giveItem(item, recipe.output);
    this.playSound("craft");
    this.setToast(`Crafted ${ITEM_DEFS[item].name.toLowerCase()}.`, 2100);
    this.emitSnapshot();
  }

  setTouchControl(code: string, down: boolean): void {
    if (this.mode !== "playing") return;
    if (down) this.touchInput.add(code);
    else this.touchInput.delete(code);
  }

  setTouchAction(action: string, down: boolean): void {
    if (this.mode !== "playing") return;
    if (action === "mine") {
      this.leftMouseDown = down;
      if (!down) {
        this.miningElapsed = 0;
        this.miningKey = "";
      }
    } else if (action === "place" && down) {
      this.placeFromTarget();
    }
  }

  toggleSound(): void {
    this.soundEnabled = !this.soundEnabled;
    if (this.soundEnabled) this.playSound("select");
    this.emitSnapshot();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    this.detachEvents();
    this.leavePointerLock();
    this.world.dispose();
    this.clearCritters();
    this.scene.remove(this.rain, this.fireflies);
    this.rain.geometry.dispose();
    (this.rain.material as LineBasicMaterial).dispose();
    this.fireflies.geometry.dispose();
    (this.fireflies.material as PointsMaterial).dispose();
    this.particleGeometry.dispose();
    for (const material of this.particleMaterials.values()) material.dispose();
    for (const geometry of Object.values(this.critterGeometries)) geometry.dispose();
    for (const material of Object.values(this.critterMaterials)) material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    if (this.audioContext) void this.audioContext.close();
  }

  private readonly animate = (now: number): void => {
    if (this.disposed) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const delta = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.elapsed += delta;
    this.worldTime += delta / DAY_LENGTH_SECONDS;
    if (this.worldTime >= 1) {
      this.worldTime -= 1;
      this.dayCount += 1;
    }

    if (this.mode === "playing") this.updatePlayer(delta);
    this.world.streamTo(this.player.x, this.player.z);
    this.updateCamera();
    this.target = this.mode === "playing" ? this.castTarget() : null;
    this.updateMining(delta);
    this.updateParticles(delta);
    this.updateWeather(delta);
    this.updateCritters(delta);
    this.updateFireflies();
    this.updateAtmosphere();

    if (this.mode !== "menu" && now - this.lastSavedAt > SAVE_INTERVAL) this.saveNow(false);
    if (this.currentToast && now > this.toastUntil) this.currentToast = null;
    if (now - this.lastHudUpdate > 110) {
      this.lastHudUpdate = now;
      this.emitSnapshot();
    }

    this.renderer.render(this.scene, this.camera);
  };

  private attachEvents(): void {
    window.addEventListener("resize", this.resizeHandler);
    window.addEventListener("keydown", this.keyDownHandler);
    window.addEventListener("keyup", this.keyUpHandler);
    window.addEventListener("pointerup", this.pointerUpHandler);
    window.addEventListener("beforeunload", this.beforeUnloadHandler);
    document.addEventListener("visibilitychange", this.visibilityHandler);
    document.addEventListener("pointerlockchange", this.pointerLockHandler);
    document.addEventListener("pointerlockerror", this.pointerErrorHandler);
    document.addEventListener("mousemove", this.mouseMoveHandler);
    this.renderer.domElement.addEventListener("pointermove", this.pointerMoveHandler);
    this.renderer.domElement.addEventListener("pointerdown", this.pointerDownHandler);
    this.renderer.domElement.addEventListener("contextmenu", this.contextMenuHandler);
    this.renderer.domElement.addEventListener("wheel", this.wheelHandler, { passive: false });
  }

  private detachEvents(): void {
    window.removeEventListener("resize", this.resizeHandler);
    window.removeEventListener("keydown", this.keyDownHandler);
    window.removeEventListener("keyup", this.keyUpHandler);
    window.removeEventListener("pointerup", this.pointerUpHandler);
    window.removeEventListener("beforeunload", this.beforeUnloadHandler);
    document.removeEventListener("visibilitychange", this.visibilityHandler);
    document.removeEventListener("pointerlockchange", this.pointerLockHandler);
    document.removeEventListener("pointerlockerror", this.pointerErrorHandler);
    document.removeEventListener("mousemove", this.mouseMoveHandler);
    this.renderer.domElement.removeEventListener("pointermove", this.pointerMoveHandler);
    this.renderer.domElement.removeEventListener("pointerdown", this.pointerDownHandler);
    this.renderer.domElement.removeEventListener("contextmenu", this.contextMenuHandler);
    this.renderer.domElement.removeEventListener("wheel", this.wheelHandler);
  }

  private setMode(mode: GameMode): void {
    this.mode = mode;
    if (mode !== "playing") {
      this.input.clear();
      this.touchInput.clear();
      this.leftMouseDown = false;
      this.miningKey = "";
      this.miningElapsed = 0;
    }
    this.emitSnapshot();
  }

  private focusWorld(): void {
    if (this.coarsePointer) return;
    try {
      const lockRequest = this.renderer.domElement.requestPointerLock();
      if (lockRequest && typeof lockRequest.catch === "function") {
        void lockRequest.catch(() => {
          if (this.mode === "playing") this.setToast("Click the world to capture your mouse.", 2400);
        });
      }
    } catch {
      this.setToast("Mouse look is ready. Click and drag to look around.", 2400);
    }
  }

  private leavePointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onPointerLockChange(): void {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    if (!this.pointerLocked && this.mode === "playing" && !this.coarsePointer) {
      this.setMode("paused");
    }
  }

  private onPointerLockError(): void {
    if (this.mode === "playing") this.setToast("Pointer lock was blocked. Click Resume to try again.", 3000);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || ["INPUT", "TEXTAREA"].includes(event.target.tagName))) return;
    const key = event.key.toLowerCase();
    const code = KEY_TO_CODE.get(key) ?? event.code;

    if (this.mode === "inventory") {
      if (key === "e" || key === "escape") {
        event.preventDefault();
        this.closeInventory(key !== "escape");
      }
      return;
    }
    if (this.mode === "menu" || this.mode === "paused") {
      if (key === "enter") this.resumeWorld();
      return;
    }

    if (key === "e") {
      event.preventDefault();
      this.openInventory();
      return;
    }
    if (/^[1-9]$/.test(key)) {
      this.selectSlot(Number(key) - 1);
      return;
    }
    if (code === "Space") event.preventDefault();
    this.input.add(code);
  }

  private onKeyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    const code = KEY_TO_CODE.get(key) ?? event.code;
    this.input.delete(code);
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.pointerLocked || this.mode !== "playing") return;
    this.player.yaw -= event.movementX * 0.0024;
    this.player.pitch = MathUtils.clamp(this.player.pitch - event.movementY * 0.0022, -1.48, 1.48);
  }

  private onPointerMove(event: PointerEvent): void {
    if (this.pointerLocked || !this.lookPointer || this.lookPointer.id !== event.pointerId || this.mode !== "playing") return;
    const deltaX = event.clientX - this.lookPointer.x;
    const deltaY = event.clientY - this.lookPointer.y;
    this.lookPointer.x = event.clientX;
    this.lookPointer.y = event.clientY;
    this.player.yaw -= deltaX * 0.0034;
    this.player.pitch = MathUtils.clamp(this.player.pitch - deltaY * 0.0032, -1.48, 1.48);
  }

  private onPointerDown(event: PointerEvent): void {
    if (this.mode !== "playing") return;
    this.renderer.domElement.focus({ preventScroll: true });
    if (!this.pointerLocked && (event.pointerType === "touch" || event.pointerType === "mouse")) {
      this.lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      if (event.pointerType === "touch") {
        try { this.renderer.domElement.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
        event.preventDefault();
        return;
      }
    }

    if (event.button === 0) {
      this.leftMouseDown = true;
      this.target = this.castTarget();
    } else if (event.button === 2) {
      event.preventDefault();
      this.placeFromTarget();
    }
  }

  private onPointerUp(event: PointerEvent): void {
    if (event.button === 0) {
      this.leftMouseDown = false;
      this.miningElapsed = 0;
      this.miningKey = "";
    }
    if (this.lookPointer?.id === event.pointerId) this.lookPointer = null;
  }

  private onWheel(event: WheelEvent): void {
    if (this.mode !== "playing") return;
    event.preventDefault();
    this.selectSlot((this.selectedSlot + (event.deltaY > 0 ? 1 : 8)) % 9);
  }

  private resize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private updatePlayer(delta: number): void {
    const forward = Number(this.input.has("KeyW") || this.input.has("ArrowUp") || this.touchInput.has("KeyW"))
      - Number(this.input.has("KeyS") || this.input.has("ArrowDown") || this.touchInput.has("KeyS"));
    const strafe = Number(this.input.has("KeyD") || this.input.has("ArrowRight") || this.touchInput.has("KeyD"))
      - Number(this.input.has("KeyA") || this.input.has("ArrowLeft") || this.touchInput.has("KeyA"));
    const length = Math.hypot(forward, strafe) || 1;
    const f = forward / length;
    const s = strafe / length;
    const forwardX = -Math.sin(this.player.yaw);
    const forwardZ = -Math.cos(this.player.yaw);
    const rightX = Math.cos(this.player.yaw);
    const rightZ = -Math.sin(this.player.yaw);
    const swimming = this.isInWater();
    const sprinting = this.input.has("ShiftLeft") || this.input.has("ShiftRight") || this.touchInput.has("ShiftLeft");
    const speed = (sprinting ? 7.2 : 4.85) * (swimming ? 0.63 : 1);
    const desiredX = (forwardX * f + rightX * s) * speed;
    const desiredZ = (forwardZ * f + rightZ * s) * speed;
    const acceleration = Math.min(1, delta * (forward || strafe ? 15 : 19));
    this.velocity.x += (desiredX - this.velocity.x) * acceleration;
    this.velocity.z += (desiredZ - this.velocity.z) * acceleration;

    if (this.input.has("Space") || this.touchInput.has("Space")) {
      if (swimming) {
        this.velocity.y = Math.max(this.velocity.y, 4.6);
        this.touchInput.delete("Space");
      } else if (this.isGrounded()) {
        this.velocity.y = 8.1;
        this.playSound("jump");
        this.input.delete("Space");
        this.touchInput.delete("Space");
      }
    }

    this.velocity.y -= (swimming ? 7 : 23) * delta;
    if (swimming) this.velocity.y = Math.max(this.velocity.y, -3.4);

    const nextX = this.player.x + this.velocity.x * delta;
    if (this.canOccupy(nextX, this.player.y, this.player.z)) this.player.x = nextX;
    else this.velocity.x = 0;

    const nextZ = this.player.z + this.velocity.z * delta;
    if (this.canOccupy(this.player.x, this.player.y, nextZ)) this.player.z = nextZ;
    else this.velocity.z = 0;

    const nextY = this.player.y + this.velocity.y * delta;
    if (this.canOccupy(this.player.x, nextY, this.player.z)) {
      this.player.y = nextY;
    } else if (this.velocity.y < 0) {
      this.player.y = Math.floor(nextY) + 1;
      this.velocity.y = 0;
    } else {
      const collision = this.firstCollision(this.player.x, nextY, this.player.z);
      this.player.y = collision ? collision.y - PLAYER_HEIGHT : this.player.y;
      this.velocity.y = 0;
    }

    this.velocity.x *= Math.max(0, 1 - delta * 2.3);
    this.velocity.z *= Math.max(0, 1 - delta * 2.3);
  }

  private isGrounded(): boolean {
    return !this.canOccupy(this.player.x, this.player.y - 0.07, this.player.z);
  }

  private isInWater(): boolean {
    return this.world.getBlock(Math.floor(this.player.x), Math.floor(this.player.y + 0.75), Math.floor(this.player.z)) === BlockId.Water;
  }

  private canOccupy(x: number, y: number, z: number): boolean {
    return this.firstCollision(x, y, z) === null;
  }

  private firstCollision(x: number, y: number, z: number): { x: number; y: number; z: number } | null {
    const minX = Math.floor(x - PLAYER_RADIUS + 0.0001);
    const maxX = Math.floor(x + PLAYER_RADIUS - 0.0001);
    const minY = Math.floor(y + 0.0001);
    const maxY = Math.floor(y + PLAYER_HEIGHT - 0.0001);
    const minZ = Math.floor(z - PLAYER_RADIUS + 0.0001);
    const maxZ = Math.floor(z + PLAYER_RADIUS - 0.0001);
    for (let blockY = minY; blockY <= maxY; blockY += 1) {
      for (let blockZ = minZ; blockZ <= maxZ; blockZ += 1) {
        for (let blockX = minX; blockX <= maxX; blockX += 1) {
          const block = this.world.getBlock(blockX, blockY, blockZ);
          if (block !== BlockId.Air && block !== BlockId.Water) return { x: blockX, y: blockY, z: blockZ };
        }
      }
    }
    return null;
  }

  private updateCamera(): void {
    this.camera.position.set(this.player.x, this.player.y + EYE_HEIGHT, this.player.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.player.yaw;
    this.camera.rotation.x = this.player.pitch;
    this.camera.updateMatrixWorld();
  }

  private castTarget(): BlockHit | null {
    this.camera.getWorldDirection(this.cameraDirection);
    const origin = this.camera.position;
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = Math.sign(this.cameraDirection.x);
    const stepY = Math.sign(this.cameraDirection.y);
    const stepZ = Math.sign(this.cameraDirection.z);
    const deltaX = this.cameraDirection.x === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / this.cameraDirection.x);
    const deltaY = this.cameraDirection.y === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / this.cameraDirection.y);
    const deltaZ = this.cameraDirection.z === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / this.cameraDirection.z);
    let maxX = stepX > 0 ? (Math.floor(origin.x) + 1 - origin.x) * deltaX : (origin.x - Math.floor(origin.x)) * deltaX;
    let maxY = stepY > 0 ? (Math.floor(origin.y) + 1 - origin.y) * deltaY : (origin.y - Math.floor(origin.y)) * deltaY;
    let maxZ = stepZ > 0 ? (Math.floor(origin.z) + 1 - origin.z) * deltaZ : (origin.z - Math.floor(origin.z)) * deltaZ;
    let normal = { x: 0, y: 0, z: 0 };
    let distance = 0;

    for (let step = 0; step < 96 && distance <= 6.2; step += 1) {
      const id = this.world.getBlock(x, y, z);
      if (id !== BlockId.Air && id !== BlockId.Water) return { x, y, z, id, normal };

      if (maxX < maxY && maxX < maxZ) {
        distance = maxX;
        maxX += deltaX;
        x += stepX;
        normal = { x: -stepX, y: 0, z: 0 };
      } else if (maxY < maxZ) {
        distance = maxY;
        maxY += deltaY;
        y += stepY;
        normal = { x: 0, y: -stepY, z: 0 };
      } else {
        distance = maxZ;
        maxZ += deltaZ;
        z += stepZ;
        normal = { x: 0, y: 0, z: -stepZ };
      }
    }
    return null;
  }

  private updateMining(delta: number): void {
    if (!this.leftMouseDown || !this.target || blockHardness(this.target.id) === Number.POSITIVE_INFINITY) {
      this.miningKey = "";
      this.miningElapsed = 0;
      return;
    }

    const key = `${this.target.x},${this.target.y},${this.target.z}`;
    if (this.miningKey !== key) {
      this.miningKey = key;
      this.miningElapsed = 0;
      this.miningDuration = this.miningTime(this.target.id);
    }
    this.miningElapsed += delta;
    if (this.miningElapsed >= this.miningDuration) this.breakTarget(this.target);
  }

  private miningTime(block: BlockId): number {
    const selected = this.hotbar[this.selectedSlot];
    const hardness = blockHardness(block);
    const pickaxeSuitable = [BlockId.Stone, BlockId.Cobblestone, BlockId.CoalOre, BlockId.IronOre].includes(block);
    const axeSuitable = [BlockId.Log, BlockId.Planks, BlockId.CraftingTable].includes(block);
    const hasPickaxe = selected === "wooden_pickaxe" || selected === "stone_pickaxe";
    const hasAxe = selected === "wooden_axe" || selected === "stone_axe";
    const stoneBonus = selected === "stone_pickaxe" || selected === "stone_axe";
    const suitable = (pickaxeSuitable && hasPickaxe) || (axeSuitable && hasAxe);
    return Math.max(0.2, hardness * (suitable ? (stoneBonus ? 0.39 : 0.53) : 0.92) + 0.12);
  }

  private breakTarget(hit: BlockHit): void {
    if (this.world.getBlock(hit.x, hit.y, hit.z) !== hit.id) return;
    const drop = itemForBlock(hit.id);
    this.world.setBlock(hit.x, hit.y, hit.z, BlockId.Air);
    this.spawnBlockParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, hit.id);
    this.playSound("break");
    if (drop) this.giveItem(drop, 1);
    if (hit.id === BlockId.Leaves && Math.random() < 0.32) this.giveItem("sticks", 1);
    const dropLabel = drop ? ` +1 ${ITEM_DEFS[drop].name}` : "";
    this.setToast(`${blockName(hit.id)}${dropLabel}`, 1600);
    this.miningKey = "";
    this.miningElapsed = 0;
  }

  private placeFromTarget(): void {
    const hit = this.castTarget();
    if (!hit) return;
    const item = this.hotbar[this.selectedSlot];
    const block = blockForItem(item);
    if (!item || block === null || (this.inventory[item] ?? 0) <= 0) return;
    const x = hit.x + hit.normal.x;
    const y = hit.y + hit.normal.y;
    const z = hit.z + hit.normal.z;
    const current = this.world.getBlock(x, y, z);
    if (current !== BlockId.Air && current !== BlockId.Water) return;
    if (this.blockOverlapsPlayer(x, y, z)) {
      this.setToast("There is not enough room to place that.", 1300);
      return;
    }
    this.world.setBlock(x, y, z, block);
    this.removeItem(item, 1);
    this.playSound("place");
    this.setToast(`Placed ${ITEM_DEFS[item].name.toLowerCase()}.`, 1200);
    this.emitSnapshot();
  }

  private blockOverlapsPlayer(x: number, y: number, z: number): boolean {
    return x + 1 > this.player.x - PLAYER_RADIUS && x < this.player.x + PLAYER_RADIUS
      && y + 1 > this.player.y && y < this.player.y + PLAYER_HEIGHT
      && z + 1 > this.player.z - PLAYER_RADIUS && z < this.player.z + PLAYER_RADIUS;
  }

  private giveItem(item: ItemId, amount: number): void {
    this.inventory[item] = (this.inventory[item] ?? 0) + amount;
    if (!this.hotbar.includes(item)) {
      const emptySlot = this.hotbar.findIndex((slot) => slot === null);
      if (emptySlot >= 0) this.hotbar[emptySlot] = item;
    }
  }

  private removeItem(item: ItemId, amount: number): void {
    const next = (this.inventory[item] ?? 0) - amount;
    if (next > 0) {
      this.inventory[item] = next;
      return;
    }
    delete this.inventory[item];
    for (let index = 0; index < this.hotbar.length; index += 1) {
      if (this.hotbar[index] === item) this.hotbar[index] = null;
    }
  }

  private spawnBlockParticles(x: number, y: number, z: number, block: BlockId): void {
    let material = this.particleMaterials.get(block);
    if (!material) {
      material = new MeshLambertMaterial({ color: blockTint(block) });
      this.particleMaterials.set(block, material);
    }
    for (let index = 0; index < 9; index += 1) {
      const mesh = new Mesh(this.particleGeometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.56, y + (Math.random() - 0.5) * 0.56, z + (Math.random() - 0.5) * 0.56);
      mesh.scale.setScalar(0.55 + Math.random() * 0.7);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        velocity: new Vector3((Math.random() - 0.5) * 3.4, 1.4 + Math.random() * 2.2, (Math.random() - 0.5) * 3.4),
        age: 0,
        lifetime: 0.45 + Math.random() * 0.25,
      });
    }
  }

  private updateParticles(delta: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.age += delta;
      particle.velocity.y -= 9 * delta;
      particle.mesh.position.addScaledVector(particle.velocity, delta);
      particle.mesh.rotation.x += delta * 5;
      particle.mesh.rotation.y += delta * 6;
      if (particle.age >= particle.lifetime) {
        this.scene.remove(particle.mesh);
        this.particles.splice(index, 1);
      }
    }
  }

  private updateWeather(delta: number): void {
    this.weatherTimer -= delta;
    this.weatherClock += delta * 18;
    if (this.weatherTimer <= 0) {
      this.weather = this.weather === "rain" ? "clear" : (Math.random() < 0.42 ? "rain" : "clear");
      this.weatherTimer = this.weather === "rain" ? 54 + Math.random() * 45 : 125 + Math.random() * 125;
      if (this.weather === "rain") this.setToast("A soft rain moves over the valley.", 2600);
    }
    this.rain.visible = this.weather === "rain";
    if (!this.rain.visible) return;

    for (let index = 0; index < this.rainOffsets.length; index += 1) {
      const offset = this.rainOffsets[index];
      let fall = (offset.y - this.weatherClock) % 19;
      if (fall < 0) fall += 19;
      const x = this.player.x + offset.x;
      const z = this.player.z + offset.z;
      const top = this.player.y + fall + 2;
      const start = index * 6;
      this.rainPositions[start] = x;
      this.rainPositions[start + 1] = top;
      this.rainPositions[start + 2] = z;
      this.rainPositions[start + 3] = x - 0.12;
      this.rainPositions[start + 4] = top - 0.68;
      this.rainPositions[start + 5] = z - 0.06;
    }
    (this.rain.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
  }

  private updateFireflies(): void {
    const daylight = formatTime(this.worldTime).daylight;
    this.fireflies.visible = daylight < 0.24 && this.weather !== "rain";
    this.fireflies.position.set(this.player.x, this.player.y, this.player.z);
    if (!this.fireflies.visible) return;
    for (let index = 0; index < this.fireflyBase.length; index += 1) {
      const firefly = this.fireflyBase[index];
      const offset = index * 3;
      this.fireflyPositions[offset] = firefly.x + Math.sin(this.elapsed * 0.45 + firefly.phase) * 0.3;
      this.fireflyPositions[offset + 1] = firefly.y + Math.sin(this.elapsed * 1.15 + firefly.phase) * 0.22;
      this.fireflyPositions[offset + 2] = firefly.z + Math.cos(this.elapsed * 0.37 + firefly.phase) * 0.3;
    }
    (this.fireflies.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
  }

  private updateAtmosphere(): void {
    const { daylight } = formatTime(this.worldTime);
    const angle = this.worldTime * Math.PI * 2 - Math.PI / 2;
    const elevation = Math.sin(angle);
    this.sunDirection.set(Math.cos(angle), elevation, Math.sin(angle) * 0.72).normalize();
    this.skyMaterial.uniforms["sunPosition"].value.copy(this.sunDirection);
    this.sun.position.set(
      this.player.x + this.sunDirection.x * 80,
      this.player.y + this.sunDirection.y * 80,
      this.player.z + this.sunDirection.z * 80,
    );
    this.sun.target.position.set(this.player.x, this.player.y, this.player.z);
    this.sun.intensity = (0.08 + daylight * 2.15) * (this.weather === "rain" ? 0.62 : 1);
    this.hemisphere.intensity = 0.18 + daylight * 1.08;
    this.ambient.intensity = 0.07 + daylight * 0.19;

    this.workingFogColor.copy(this.nightFogColor).lerp(this.dayFogColor, Math.pow(daylight, 0.68));
    if (this.weather === "rain") this.workingFogColor.lerp(this.rainFogColor, 0.38);
    (this.scene.fog as Fog).color.copy(this.workingFogColor);
    if (this.weather === "rain") {
      (this.scene.fog as Fog).near = 20;
      (this.scene.fog as Fog).far = 83;
    } else {
      (this.scene.fog as Fog).near = 28;
      (this.scene.fog as Fog).far = 112;
    }
  }

  private createWildlife(): void {
    for (let index = 0; index < 3; index += 1) this.spawnCritter();
  }

  private spawnCritter(): void {
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const x = this.player.x + (Math.random() - 0.5) * 38;
      const z = this.player.z + (Math.random() - 0.5) * 38;
      const column = this.world.generator.column(Math.floor(x), Math.floor(z));
      if (column.height <= SEA_LEVEL + 2 || (column.biome !== "woodland" && column.biome !== "meadow")) continue;
      const blockAbove = this.world.getBlock(Math.floor(x), column.height + 1, Math.floor(z));
      if (blockAbove !== BlockId.Air) continue;
      const root = new Group();
      const addPart = (geometry: BoxGeometry, material: MeshLambertMaterial, position: [number, number, number]) => {
        const mesh = new Mesh(geometry, material);
        mesh.position.set(...position);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        root.add(mesh);
        return mesh;
      };
      addPart(this.critterGeometries.body, this.critterMaterials.body, [0, 0.48, 0]);
      addPart(this.critterGeometries.head, this.critterMaterials.light, [0, 0.69, -0.23]);
      addPart(this.critterGeometries.nose, this.critterMaterials.body, [0, 0.64, -0.39]);
      addPart(this.critterGeometries.tail, this.critterMaterials.light, [0, 0.52, 0.34]);
      addPart(this.critterGeometries.eye, this.critterMaterials.eye, [-0.12, 0.73, -0.381]);
      addPart(this.critterGeometries.eye, this.critterMaterials.eye, [0.12, 0.73, -0.381]);
      addPart(this.critterGeometries.ear, this.critterMaterials.body, [-0.085, 0.91, -0.25]);
      addPart(this.critterGeometries.ear, this.critterMaterials.body, [0.085, 0.91, -0.25]);
      const leftInnerEar = addPart(this.critterGeometries.ear, this.critterMaterials.ear, [-0.085, 0.91, -0.292]);
      const rightInnerEar = addPart(this.critterGeometries.ear, this.critterMaterials.ear, [0.085, 0.91, -0.292]);
      leftInnerEar.scale.set(0.5, 0.78, 0.32);
      rightInnerEar.scale.set(0.5, 0.78, 0.32);
      const legs: Group[] = [];
      for (const legX of [-0.21, 0.21]) {
        for (const legZ of [-0.2, 0.2]) {
          const pivot = new Group();
          pivot.position.set(legX, 0.35, legZ);
          const mesh = new Mesh(this.critterGeometries.leg, this.critterMaterials.body);
          mesh.position.y = -0.12;
          mesh.castShadow = false;
          pivot.add(mesh);
          root.add(pivot);
          legs.push(pivot);
        }
      }
      root.position.set(x, column.height + 0.01, z);
      this.scene.add(root);
      const critter: Critter = {
        root,
        legs,
        x,
        z,
        targetX: x,
        targetZ: z,
        idle: 1 + Math.random() * 3,
        fleeing: 0,
        phase: Math.random() * Math.PI * 2,
      };
      this.pickCritterTarget(critter, false);
      this.critters.push(critter);
      return;
    }
  }

  private pickCritterTarget(critter: Critter, fleeing: boolean): void {
    let targetX = critter.x;
    let targetZ = critter.z;
    if (fleeing) {
      const awayX = critter.x - this.player.x;
      const awayZ = critter.z - this.player.z;
      const length = Math.hypot(awayX, awayZ) || 1;
      targetX += (awayX / length) * (7 + Math.random() * 4) + (Math.random() - 0.5) * 3;
      targetZ += (awayZ / length) * (7 + Math.random() * 4) + (Math.random() - 0.5) * 3;
    } else {
      targetX += (Math.random() - 0.5) * 12;
      targetZ += (Math.random() - 0.5) * 12;
    }
    const column = this.world.generator.column(Math.floor(targetX), Math.floor(targetZ));
    if (column.height <= SEA_LEVEL + 1 || column.biome === "dunes" || column.biome === "coast") {
      critter.idle = 1.3;
      return;
    }
    critter.targetX = targetX;
    critter.targetZ = targetZ;
    critter.idle = 0;
  }

  private updateCritters(delta: number): void {
    this.critterTimer -= delta;
    if (this.critterTimer <= 0) {
      this.critterTimer = 8;
      for (let index = this.critters.length - 1; index >= 0; index -= 1) {
        const critter = this.critters[index];
        if (Math.hypot(critter.x - this.player.x, critter.z - this.player.z) > 58) {
          this.scene.remove(critter.root);
          this.critters.splice(index, 1);
        }
      }
      for (let attempt = 0; this.critters.length < 3 && attempt < 5; attempt += 1) this.spawnCritter();
    }

    for (const critter of this.critters) {
      critter.phase += delta * (critter.fleeing > 0 ? 11 : 5.4);
      critter.fleeing = Math.max(0, critter.fleeing - delta);
      const distanceToPlayer = Math.hypot(critter.x - this.player.x, critter.z - this.player.z);
      if (this.mode === "playing" && distanceToPlayer < 4.2 && critter.fleeing <= 0.1) {
        critter.fleeing = 3.1;
        this.pickCritterTarget(critter, true);
        if (!this.metWildlife) {
          this.metWildlife = true;
          this.setToast("A wild hare darts into the brush.", 2400);
        }
      }

      if (critter.idle > 0) {
        critter.idle = Math.max(0, critter.idle - delta);
        if (critter.idle === 0) this.pickCritterTarget(critter, false);
      } else {
        const dx = critter.targetX - critter.x;
        const dz = critter.targetZ - critter.z;
        const distance = Math.hypot(dx, dz);
        if (distance < 0.25) {
          critter.idle = 1.4 + Math.random() * 3.2;
        } else {
          const speed = critter.fleeing > 0 ? 3.3 : 0.8;
          const step = Math.min(distance, speed * delta);
          const nextX = critter.x + (dx / distance) * step;
          const nextZ = critter.z + (dz / distance) * step;
          const column = this.world.generator.column(Math.floor(nextX), Math.floor(nextZ));
          if (column.height <= SEA_LEVEL + 1 || Math.abs(column.height - Math.floor(critter.root.position.y)) > 2) {
            critter.idle = 1.2;
          } else {
            critter.x = nextX;
            critter.z = nextZ;
            critter.root.position.x = nextX;
            critter.root.position.z = nextZ;
            critter.root.position.y = column.height + 0.01 + Math.abs(Math.sin(critter.phase)) * 0.025;
            critter.root.rotation.y = Math.atan2(-dx, -dz);
            for (let index = 0; index < critter.legs.length; index += 1) {
              critter.legs[index].rotation.x = Math.sin(critter.phase + (index % 2) * Math.PI) * (critter.fleeing > 0 ? 0.48 : 0.18);
            }
          }
        }
      }
    }
  }

  private clearCritters(): void {
    for (const critter of this.critters) this.scene.remove(critter.root);
    this.critters = [];
  }

  private updateSnapshot(): GameSnapshot {
    const clock = formatTime(this.worldTime);
    const selectedItem = this.hotbar[this.selectedSlot];
    let miningProgress = 0;
    if (this.miningDuration > 0 && this.miningKey) miningProgress = MathUtils.clamp(this.miningElapsed / this.miningDuration, 0, 1);
    return {
      mode: this.mode,
      seed: this.seed,
      biome: this.world.getBiome(this.player.x, this.player.z),
      timeLabel: clock.label,
      phase: clock.phase,
      day: this.dayCount,
      weather: this.weather,
      daylight: clock.daylight,
      inventory: { ...this.inventory },
      hotbar: [...this.hotbar],
      selectedSlot: this.selectedSlot,
      selectedItem,
      selectedCount: selectedItem ? this.inventory[selectedItem] ?? 0 : 0,
      targetName: this.target ? blockName(this.target.id) : null,
      miningProgress,
      saved: this.saveSucceeded,
      hasSave: this.hasSave,
      soundEnabled: this.soundEnabled,
      toast: this.currentToast,
      position: { x: this.player.x, y: this.player.y, z: this.player.z },
    };
  }

  private emitSnapshot(): void {
    this.onUpdate(this.updateSnapshot());
  }

  private setToast(message: string, duration: number): void {
    this.currentToast = message;
    this.toastUntil = performance.now() + duration;
    this.emitSnapshot();
  }

  private playSound(kind: "start" | "select" | "jump" | "break" | "place" | "craft"): void {
    if (!this.soundEnabled) return;
    try {
      if (!this.audioContext) this.audioContext = new AudioContext();
      if (this.audioContext.state === "suspended") void this.audioContext.resume();
      const audio = this.audioContext;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;
      const tone = kind === "craft" ? 520 : kind === "jump" ? 220 : kind === "place" ? 180 : kind === "break" ? 145 : kind === "start" ? 390 : 320;
      const duration = kind === "break" ? 0.095 : kind === "craft" ? 0.22 : kind === "start" ? 0.28 : 0.09;
      oscillator.type = kind === "break" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(tone + Math.random() * 24, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(65, tone * (kind === "craft" ? 1.4 : 0.62)), now + duration);
      gain.gain.setValueAtTime(kind === "break" ? 0.055 : 0.035, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      // Audio is an enhancement and may be unavailable in restricted browsers.
    }
  }
}