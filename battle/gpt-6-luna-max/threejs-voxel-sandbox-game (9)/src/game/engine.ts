import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import {
  BLOCK,
  BLOCKS,
  DEFAULT_HOTBAR,
  ITEMS,
  ITEM_IDS,
  RECIPES,
  SAVE_KEY,
  STARTING_INVENTORY,
  type BlockId,
  type ItemId,
} from "./data";
import { CHUNK_SIZE, type BiomeName, VoxelWorld } from "./world";

const PLAYER_HEIGHT = 1.78;
const PLAYER_RADIUS = 0.31;
const EYE_HEIGHT = 1.62;

interface StoredWorld {
  version?: number;
  seed?: number;
  edits?: Record<string, number>;
  inventory?: Partial<Record<ItemId, number>>;
  hotbar?: ItemId[];
  selected?: number;
  position?: [number, number, number];
  time?: number;
}

export interface GameSnapshot {
  inventory: Partial<Record<ItemId, number>>;
  hotbar: ItemId[];
  selected: number;
  biome: BiomeName;
  x: number;
  y: number;
  z: number;
  clock: string;
  day: number;
  weather: "clear" | "rain";
  miningProgress: number;
  targetName: string;
  hasWorkbench: boolean;
  seed: string;
  touchMode: boolean;
}

interface GameCallbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onLockChange: (locked: boolean) => void;
  onInventoryToggle: (open: boolean) => void;
  onToast: (message: string) => void;
}

interface BlockTarget {
  kind: "block";
  x: number;
  y: number;
  z: number;
  id: BlockId;
  normal: THREE.Vector3;
  distance: number;
}

interface CreatureTarget {
  kind: "creature";
  creature: Mossling;
  distance: number;
}

type GameTarget = BlockTarget | CreatureTarget;

interface Mossling {
  root: THREE.Group;
  legs: THREE.Group[];
  body: THREE.Mesh;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  turnIn: number;
  friendship: number;
  phase: number;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  material: THREE.MeshBasicMaterial;
}

function smoothstep(low: number, high: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 900_000_000) + 100_000_000;
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function countFor(inventory: Partial<Record<ItemId, number>>, id: ItemId): number {
  return Math.max(0, inventory[id] ?? 0);
}

export class VoxelGame {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(76, 1, 0.08, 280);
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: PointerLockControls;
  readonly world: VoxelWorld;
  readonly touchMode: boolean;

  private readonly host: HTMLElement;
  private readonly callbacks: GameCallbacks;
  private readonly raycaster = new THREE.Raycaster();
  private readonly rayCenter = new THREE.Vector2(0, 0);
  private readonly heldKeys = new Set<string>();
  private readonly particles: Particle[] = [];
  private readonly creatures: Mossling[] = [];
  private readonly particleGeometry = new THREE.BoxGeometry(0.105, 0.105, 0.105);
  private readonly skyColor = new THREE.Color("#98c9d8");
  private readonly nightColor = new THREE.Color("#111b31");
  private readonly dayColor = new THREE.Color("#92c6de");
  private readonly duskColor = new THREE.Color("#e5a06e");
  private readonly sunDirection = new THREE.Vector3();
  private readonly playerPosition = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();
  private readonly movementForward = new THREE.Vector3();
  private readonly movementRight = new THREE.Vector3();
  private readonly desiredMovement = new THREE.Vector3();
  private readonly ambientLight: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private readonly sunMesh: THREE.Mesh;
  private readonly moonMesh: THREE.Mesh;
  private readonly stars: THREE.Points;
  private readonly clouds: THREE.InstancedMesh;
  private readonly rain: THREE.LineSegments;
  private readonly rainData: Float32Array;
  private readonly rainState: { x: number; y: number; z: number }[] = [];
  private readonly selection: THREE.LineSegments;
  private readonly selectionMaterial: THREE.LineBasicMaterial;
  private readonly chunkRadius = 3;
  private readonly inventory: Partial<Record<ItemId, number>> = { ...STARTING_INVENTORY };
  private readonly hotbar: ItemId[] = [...DEFAULT_HOTBAR];
  private readonly savedSeed: number;
  private selected = 0;
  private timeOfDay = 0.28;
  private weather: "clear" | "rain" = "clear";
  private nextWeatherChange = 96;
  private saveElapsed = 0;
  private snapshotElapsed = 0;
  private lastFrame = 0;
  private lastPlayerChunk = "";
  private miningKey = "";
  private miningElapsed = 0;
  private miningProgress = 0;
  private target: GameTarget | null = null;
  private menuOpen = false;
  private gameStarted = false;
  private mining = false;
  private touchPlaying = false;
  private touchForward = 0;
  private touchStrafe = 0;
  private touchMining = false;
  private lookPointerId: number | null = null;
  private lastTouchX = 0;
  private lastTouchY = 0;
  private grounded = false;
  private jumpQueued = false;
  private dirty = false;
  private audioContext: AudioContext | null = null;
  private raf = 0;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;

  private readonly onResize = () => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    this.renderer.setSize(width, height, false);
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "KeyE" || event.code === "Tab") {
      event.preventDefault();
      if (!event.repeat) this.toggleInventory();
      return;
    }

    if (this.menuOpen && event.code === "Escape") {
      event.preventDefault();
      this.closeInventory();
      return;
    }

    if (event.code.startsWith("Digit")) {
      const slot = Number(event.code.slice(5)) - 1;
      if (slot >= 0 && slot < 9) this.selectSlot(slot);
    }

    if ((event.code === "Space" || event.code.startsWith("Arrow")) && this.isActive()) {
      event.preventDefault();
    }
    if (event.code === "Space" && !event.repeat && this.isActive()) this.jumpQueued = true;
    this.heldKeys.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    this.heldKeys.delete(event.code);
  };

  private readonly onBlur = () => {
    this.heldKeys.clear();
    this.mining = false;
    this.jumpQueued = false;
  };

  private readonly onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "touch" && this.touchMode) {
      if (!this.touchPlaying || this.menuOpen) return;
      this.lookPointerId = event.pointerId;
      this.lastTouchX = event.clientX;
      this.lastTouchY = event.clientY;
      this.renderer.domElement.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button === 2) event.preventDefault();
    if (!this.controls.isLocked || this.menuOpen) {
      if (!this.menuOpen) this.controls.lock();
      return;
    }

    if (event.button === 0) {
      if (this.target?.kind === "creature") {
        this.petMossling(this.target.creature);
        return;
      }
      this.mining = true;
      this.miningKey = "";
      this.miningElapsed = 0;
    } else if (event.button === 2) {
      if (this.target?.kind === "creature") this.petMossling(this.target.creature);
      else this.placeBlock();
    }
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "touch" || event.pointerId !== this.lookPointerId) return;
    const deltaX = event.clientX - this.lastTouchX;
    const deltaY = event.clientY - this.lastTouchY;
    this.lastTouchX = event.clientX;
    this.lastTouchY = event.clientY;
    this.camera.rotation.y -= deltaX * 0.0042;
    this.camera.rotation.x = THREE.MathUtils.clamp(
      this.camera.rotation.x - deltaY * 0.0035,
      -Math.PI / 2 + 0.025,
      Math.PI / 2 - 0.025,
    );
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    if (event.pointerId === this.lookPointerId) this.lookPointerId = null;
    if (event.button === 0) {
      this.mining = false;
      this.miningKey = "";
      this.miningElapsed = 0;
      this.miningProgress = 0;
    }
  };

  private readonly onWheel = (event: WheelEvent) => {
    if (this.menuOpen) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    this.selectSlot((this.selected + direction + this.hotbar.length) % this.hotbar.length);
  };

  private readonly onBeforeUnload = () => this.save(false);

  private readonly animate = (time: number) => {
    if (this.disposed) return;
    const dt = this.lastFrame === 0 ? 0 : Math.min((time - this.lastFrame) / 1000, 0.05);
    this.lastFrame = time;

    if (this.isActive() && !this.menuOpen) this.updateGame(dt);
    this.updateParticles(dt);
    this.updateLighting(dt);
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.animate);
  };

  constructor(host: HTMLElement, callbacks: GameCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.touchMode = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

    const stored = this.readSave();
    this.savedSeed = safeNumber(stored?.seed, randomSeed());
    this.world = new VoxelWorld(this.savedSeed, stored?.edits);

    if (stored?.inventory) {
      for (const id of ITEM_IDS) {
        const amount = stored.inventory[id];
        if (typeof amount === "number" && Number.isFinite(amount)) {
          this.inventory[id] = Math.max(0, Math.min(999, Math.floor(amount)));
        }
      }
    }
    if (stored?.hotbar && stored.hotbar.length === 9) {
      for (let slot = 0; slot < 9; slot += 1) {
        if (ITEM_IDS.includes(stored.hotbar[slot])) this.hotbar[slot] = stored.hotbar[slot];
      }
    }
    this.selected = Math.max(0, Math.min(8, Math.floor(safeNumber(stored?.selected, 0))));
    this.timeOfDay = Math.max(0, safeNumber(stored?.time, 0.28));

    if (stored?.position && stored.position.length === 3 && stored.position.every(Number.isFinite)) {
      this.playerPosition.set(stored.position[0], stored.position[1], stored.position[2]);
    } else {
      this.playerPosition.set(0.5, this.world.heightAt(0, 0) + 1, 0.5);
    }

    this.world.ensureAround(this.playerPosition.x, this.playerPosition.z, this.chunkRadius);
    if (this.collidesAt(this.playerPosition)) {
      this.playerPosition.set(0.5, this.world.heightAt(0, 0) + 1, 0.5);
      this.world.ensureAround(this.playerPosition.x, this.playerPosition.z, this.chunkRadius);
    }
    this.camera.position.set(
      this.playerPosition.x,
      this.playerPosition.y + EYE_HEIGHT,
      this.playerPosition.z,
    );
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = 0.16;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.domElement.className = "voxel-canvas";
    this.renderer.domElement.style.touchAction = "none";
    this.renderer.domElement.setAttribute("aria-label", "Moss and Mica game world");
    this.renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
    this.host.appendChild(this.renderer.domElement);
    this.onResize();

    this.controls = new PointerLockControls(this.camera, this.renderer.domElement);
    this.controls.addEventListener("lock", () => this.callbacks.onLockChange(true));
    this.controls.addEventListener("unlock", () => {
      this.mining = false;
      this.callbacks.onLockChange(false);
    });

    this.ambientLight = new THREE.HemisphereLight(0xd7ebea, 0x586150, 0.64);
    this.scene.add(this.ambientLight);
    this.sunLight = new THREE.DirectionalLight(0xffe4b7, 1.15);
    this.sunLight.position.set(40, 80, 30);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
    this.scene.fog = new THREE.FogExp2(this.skyColor, 0.016);
    this.scene.background = this.skyColor;

    this.sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 18, 12),
      new THREE.MeshBasicMaterial({ color: "#ffe5af", fog: false }),
    );
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 16, 12),
      new THREE.MeshBasicMaterial({ color: "#e1e7eb", fog: false }),
    );
    this.scene.add(this.sunMesh, this.moonMesh);

    this.stars = this.createStars();
    this.scene.add(this.stars);
    this.clouds = this.createClouds();
    this.scene.add(this.clouds);
    this.rainData = new Float32Array(280 * 6);
    this.rain = this.createRain();
    this.scene.add(this.rain);

    const outline = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
    this.selectionMaterial = new THREE.LineBasicMaterial({
      color: "#fff1c8",
      transparent: true,
      opacity: 0.82,
      depthTest: true,
      depthWrite: false,
    });
    this.selection = new THREE.LineSegments(outline, this.selectionMaterial);
    this.selection.visible = false;
    this.selection.renderOrder = 5;
    this.scene.add(this.selection);

    for (const mesh of this.world.meshes) this.scene.add(mesh);
    this.createCreatures();

    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(this.host);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointermove", this.onPointerMove);
    document.addEventListener("pointerup", this.onPointerUp);
    this.renderer.domElement.addEventListener("wheel", this.onWheel, { passive: false });

    this.updateLighting(0);
    this.publishSnapshot();
    this.raf = requestAnimationFrame(this.animate);
  }

  enterWorld(): void {
    this.gameStarted = true;
    this.ensureAudio();
    if (this.touchMode) {
      this.touchPlaying = true;
      this.callbacks.onLockChange(true);
    } else {
      this.controls.lock();
    }
  }

  pauseWorld(): void {
    if (this.touchMode) {
      this.touchPlaying = false;
      this.touchMining = false;
      this.touchForward = 0;
      this.touchStrafe = 0;
      this.callbacks.onLockChange(false);
    } else {
      this.controls.unlock();
    }
  }

  setTouchMovement(forward: number, strafe: number): void {
    this.touchForward = THREE.MathUtils.clamp(forward, -1, 1);
    this.touchStrafe = THREE.MathUtils.clamp(strafe, -1, 1);
  }

  setTouchMining(pressed: boolean): void {
    this.touchMining = pressed;
  }

  touchPlace(): void {
    this.placeBlock();
  }

  touchJump(): void {
    if (this.isActive()) this.jumpQueued = true;
  }

  private isActive(): boolean {
    return this.touchMode ? this.touchPlaying : this.controls.isLocked;
  }

  openInventory(): void {
    if (!this.gameStarted || this.menuOpen) return;
    this.menuOpen = true;
    this.mining = false;
    this.touchMining = false;
    if (this.touchMode) {
      this.touchPlaying = false;
      this.callbacks.onLockChange(false);
    } else {
      this.controls.unlock();
    }
    this.callbacks.onInventoryToggle(true);
  }

  closeInventory(): void {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this.callbacks.onInventoryToggle(false);
    if (this.touchMode) {
      this.touchPlaying = true;
      this.callbacks.onLockChange(true);
    } else {
      this.controls.lock();
    }
  }

  toggleInventory(): void {
    if (!this.gameStarted) return;
    if (this.menuOpen) this.closeInventory();
    else this.openInventory();
  }

  selectSlot(slot: number): void {
    if (slot < 0 || slot >= this.hotbar.length) return;
    this.selected = slot;
    this.publishSnapshot();
    this.markDirty();
    this.playTone(540 + slot * 25, 0.045, "sine", 0.025);
  }

  equipItem(item: ItemId): void {
    this.hotbar[this.selected] = item;
    this.publishSnapshot();
    this.markDirty();
    this.playTone(640, 0.055, "triangle", 0.03);
  }

  craft(recipeId: string): boolean {
    const recipe = RECIPES.find((entry) => entry.id === recipeId);
    if (!recipe) return false;
    if (recipe.requiresWorkbench && !this.hasWorkbench()) {
      this.callbacks.onToast("Place a worktable nearby to make that.");
      this.playTone(145, 0.11, "square", 0.025);
      return false;
    }
    for (const [id, amount] of Object.entries(recipe.ingredients) as [ItemId, number][]) {
      if (countFor(this.inventory, id) < amount) {
        this.callbacks.onToast("You are missing a few materials.");
        this.playTone(145, 0.11, "square", 0.025);
        return false;
      }
    }

    for (const [id, amount] of Object.entries(recipe.ingredients) as [ItemId, number][]) {
      this.inventory[id] = countFor(this.inventory, id) - amount;
    }
    for (const [id, amount] of Object.entries(recipe.output) as [ItemId, number][]) {
      this.inventory[id] = Math.min(999, countFor(this.inventory, id) + amount);
    }
    const output = Object.entries(recipe.output)[0] as [ItemId, number] | undefined;
    this.callbacks.onToast(output ? `Made ${output[1]} ${ITEMS[output[0]].name.toLowerCase()}.` : "Made something useful.");
    this.playTone(700, 0.12, "triangle", 0.055);
    this.publishSnapshot();
    this.markDirty();
    return true;
  }

  save(showMessage = true): void {
    const payload: StoredWorld = {
      version: 1,
      seed: this.savedSeed,
      edits: this.world.serializeEdits(),
      inventory: this.inventory,
      hotbar: this.hotbar,
      selected: this.selected,
      position: [this.playerPosition.x, this.playerPosition.y, this.playerPosition.z],
      time: this.timeOfDay,
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      this.dirty = false;
      if (showMessage) this.callbacks.onToast("World saved on this device.");
    } catch {
      if (showMessage) this.callbacks.onToast("This browser could not save the world.");
    }
  }

  resetWorld(): void {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // The fresh world can still be played when storage is unavailable.
    }
    window.location.reload();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver?.disconnect();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointermove", this.onPointerMove);
    this.renderer.domElement.removeEventListener("wheel", this.onWheel);
    document.removeEventListener("pointerup", this.onPointerUp);
    this.controls.dispose();
    this.world.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
        geometries.add(object.geometry);
        const attached = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of attached) materials.add(material);
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.particles.length = 0;
    if (this.audioContext) void this.audioContext.close().catch(() => undefined);
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readSave(): StoredWorld | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as StoredWorld;
      return value && typeof value === "object" ? value : null;
    } catch {
      return null;
    }
  }

  private updateGame(dt: number): void {
    if (dt <= 0) return;
    this.updateMovement(dt);
    this.timeOfDay += dt / 780;
    this.markDirty();
    this.updateWeather(dt);
    this.updateCreatures(dt);
    this.updateTarget();
    this.updateMining(dt);
    this.syncWorldMeshes();

    const chunkKey = `${Math.floor(this.playerPosition.x / CHUNK_SIZE)},${Math.floor(this.playerPosition.z / CHUNK_SIZE)}`;
    if (chunkKey !== this.lastPlayerChunk) {
      this.lastPlayerChunk = chunkKey;
      this.world.ensureAround(this.playerPosition.x, this.playerPosition.z, this.chunkRadius);
      this.syncWorldMeshes();
    }

    this.saveElapsed += dt;
    this.snapshotElapsed += dt;
    if (this.snapshotElapsed > 0.12) {
      this.snapshotElapsed = 0;
      this.publishSnapshot();
    }
    if (this.saveElapsed > 18 && this.dirty) {
      this.save(false);
      this.saveElapsed = 0;
    }
  }

  private updateMovement(dt: number): void {
    this.camera.getWorldDirection(this.movementForward);
    this.movementForward.y = 0;
    this.movementForward.normalize();
    this.movementRight.set(-this.movementForward.z, 0, this.movementForward.x);

    const keyboardForward =
      Number(this.heldKeys.has("KeyW") || this.heldKeys.has("ArrowUp")) -
      Number(this.heldKeys.has("KeyS") || this.heldKeys.has("ArrowDown"));
    const keyboardStrafe =
      Number(this.heldKeys.has("KeyD") || this.heldKeys.has("ArrowRight")) -
      Number(this.heldKeys.has("KeyA") || this.heldKeys.has("ArrowLeft"));
    const touchInputActive = this.touchMode && (this.touchForward !== 0 || this.touchStrafe !== 0);
    const forward = touchInputActive ? this.touchForward : keyboardForward;
    const sideways = touchInputActive ? this.touchStrafe : keyboardStrafe;
    this.desiredMovement.set(0, 0, 0);
    this.desiredMovement.addScaledVector(this.movementForward, forward);
    this.desiredMovement.addScaledVector(this.movementRight, sideways);
    if (this.desiredMovement.lengthSq() > 1) this.desiredMovement.normalize();

    const sprinting = !this.touchMode && (this.heldKeys.has("ShiftLeft") || this.heldKeys.has("ShiftRight"));
    const speed = sprinting ? 7.15 : 4.8;
    const targetX = this.desiredMovement.x * speed;
    const targetZ = this.desiredMovement.z * speed;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, targetX, 16, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, targetZ, 16, dt);
    if (this.desiredMovement.lengthSq() === 0) {
      this.velocity.x = THREE.MathUtils.damp(this.velocity.x, 0, 20, dt);
      this.velocity.z = THREE.MathUtils.damp(this.velocity.z, 0, 20, dt);
    }
    if (this.jumpQueued && this.grounded) {
      this.velocity.y = 8.1;
      this.grounded = false;
      this.playTone(270, 0.09, "triangle", 0.045);
    }
    this.jumpQueued = false;
    this.velocity.y = Math.max(-34, this.velocity.y - 24 * dt);

    const longestStep = Math.max(Math.abs(this.velocity.x), Math.abs(this.velocity.y), Math.abs(this.velocity.z)) * dt;
    const substeps = Math.max(1, Math.ceil(longestStep / 0.28));
    const stepDt = dt / substeps;
    const wasGrounded = this.grounded;
    this.grounded = false;

    for (let step = 0; step < substeps; step += 1) {
      this.moveHorizontal(this.velocity.x * stepDt, true, wasGrounded || this.grounded);
      this.moveHorizontal(this.velocity.z * stepDt, false, wasGrounded || this.grounded);
      this.moveVertical(this.velocity.y * stepDt);
    }

    if (!this.grounded && this.velocity.y <= 0) {
      const probe = this.playerPosition.clone();
      probe.y -= 0.055;
      if (this.collidesAt(probe)) {
        this.grounded = true;
        this.velocity.y = 0;
      }
    }

    if (this.playerPosition.y < -14) {
      this.playerPosition.set(0.5, this.world.heightAt(0, 0) + 1, 0.5);
      this.velocity.set(0, 0, 0);
      this.callbacks.onToast("You found a safe way back to the meadow.");
    }

    this.camera.position.set(
      this.playerPosition.x,
      this.playerPosition.y + EYE_HEIGHT,
      this.playerPosition.z,
    );
  }

  private moveHorizontal(amount: number, alongX: boolean, allowStep: boolean): void {
    if (amount === 0) return;
    const next = this.playerPosition.clone();
    if (alongX) next.x += amount;
    else next.z += amount;

    if (!this.collidesAt(next)) {
      this.playerPosition.copy(next);
      return;
    }

    if (allowStep) {
      const stepped = next.clone();
      stepped.y += 1.02;
      if (!this.collidesAt(stepped)) {
        this.playerPosition.copy(stepped);
        return;
      }
    }

    if (alongX) this.velocity.x = 0;
    else this.velocity.z = 0;
  }

  private moveVertical(amount: number): void {
    if (amount === 0) return;
    const next = this.playerPosition.clone();
    next.y += amount;
    if (!this.collidesAt(next)) {
      this.playerPosition.copy(next);
      return;
    }

    if (amount < 0) {
      this.playerPosition.y = Math.ceil(next.y - 0.0001);
      this.grounded = true;
    } else {
      const ceiling = Math.floor(next.y + PLAYER_HEIGHT);
      this.playerPosition.y = ceiling - PLAYER_HEIGHT;
    }
    this.velocity.y = 0;
  }

  private collidesAt(position: THREE.Vector3): boolean {
    const minX = Math.floor(position.x - PLAYER_RADIUS);
    const maxX = Math.floor(position.x + PLAYER_RADIUS);
    const minY = Math.floor(position.y + 0.035);
    const maxY = Math.floor(position.y + PLAYER_HEIGHT - 0.015);
    const minZ = Math.floor(position.z - PLAYER_RADIUS);
    const maxZ = Math.floor(position.z + PLAYER_RADIUS);

    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          if (this.world.isSolid(x, y, z)) return true;
        }
      }
    }
    return false;
  }

  private updateTarget(): void {
    this.raycaster.setFromCamera(this.rayCenter, this.camera);
    const blockHit = this.raycaster.intersectObjects(this.world.meshes, false).find((hit) => hit.distance <= 6.2);
    const creatureHits = this.raycaster.intersectObjects(
      this.creatures.map((creature) => creature.root),
      true,
    );
    const creatureHit = creatureHits.find((hit) => hit.distance <= 6.2);
    const creature = creatureHit?.object.userData.mossling as Mossling | undefined;

    if (creature && creatureHit && (!blockHit || creatureHit.distance < blockHit.distance)) {
      this.target = { kind: "creature", creature, distance: creatureHit.distance };
      this.selection.visible = false;
      this.miningProgress = 0;
      return;
    }

    if (!blockHit || !blockHit.face) {
      this.target = null;
      this.selection.visible = false;
      this.miningProgress = 0;
      return;
    }

    const normal = blockHit.face.normal.clone().transformDirection(blockHit.object.matrixWorld).round();
    const x = Math.floor(blockHit.point.x - normal.x * 0.002);
    const y = Math.floor(blockHit.point.y - normal.y * 0.002);
    const z = Math.floor(blockHit.point.z - normal.z * 0.002);
    const id = this.world.getBlock(x, y, z);
    if (id === BLOCK.air) {
      this.target = null;
      this.selection.visible = false;
      this.miningProgress = 0;
      return;
    }

    this.target = { kind: "block", x, y, z, id, normal, distance: blockHit.distance };
    this.selection.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.selection.visible = true;
    this.selectionMaterial.opacity = 0.58 + this.miningProgress * 0.4;
  }

  private updateMining(dt: number): void {
    if (!(this.mining || this.touchMining) || this.target?.kind !== "block") {
      this.miningProgress = 0;
      this.miningKey = "";
      this.miningElapsed = 0;
      return;
    }

    const target = this.target;
    const key = `${target.x},${target.y},${target.z}`;
    if (key !== this.miningKey) {
      this.miningKey = key;
      this.miningElapsed = 0;
    }

    const block = BLOCKS[target.id];
    const heldItem = this.hotbar[this.selected];
    const equippedPick = heldItem === "stone_pickaxe" && countFor(this.inventory, "stone_pickaxe") > 0;
    const isStone =
      target.id === BLOCK.stone ||
      target.id === BLOCK.coalOre ||
      target.id === BLOCK.copperOre ||
      target.id === BLOCK.amethyst;
    const toolSpeed = equippedPick && isStone ? 0.3 : equippedPick ? 0.8 : 1;
    this.miningElapsed += dt;
    this.miningProgress = THREE.MathUtils.clamp(this.miningElapsed / (block.hardness * toolSpeed), 0, 1);
    this.selectionMaterial.opacity = 0.58 + this.miningProgress * 0.4;

    if (this.miningProgress >= 1) this.breakBlock(target);
  }

  private breakBlock(target: BlockTarget): void {
    const definition = BLOCKS[target.id];
    this.world.setBlock(target.x, target.y, target.z, BLOCK.air);
    this.spawnBlockParticles(target.x + 0.5, target.y + 0.5, target.z + 0.5, this.blockTint(target.id));
    this.playTone(target.id === BLOCK.stone ? 190 : 290, 0.075, "square", 0.035);

    if (definition.drop) {
      const amount = target.id === BLOCK.coalOre && Math.random() > 0.52 ? 2 : 1;
      this.collect(definition.drop, amount);
      if (target.id === BLOCK.leaves && Math.random() < 0.13) this.collect("sticks", 1);
    }

    this.markDirty();
    this.miningKey = "";
    this.miningElapsed = 0;
    this.miningProgress = 0;
    this.target = null;
  }

  private placeBlock(): void {
    if (this.target?.kind !== "block") {
      this.callbacks.onToast("Aim at a block face to build.");
      return;
    }
    const itemId = this.hotbar[this.selected];
    const item = ITEMS[itemId];
    const blockId = item.block;
    if (!blockId) {
      this.callbacks.onToast(`${item.name} cannot be placed.`);
      this.playTone(145, 0.09, "square", 0.025);
      return;
    }
    if (countFor(this.inventory, itemId) <= 0) {
      this.callbacks.onToast(`You are out of ${item.name.toLowerCase()}.`);
      this.playTone(145, 0.09, "square", 0.025);
      return;
    }

    const target = this.target;
    const x = target.x + Math.round(target.normal.x);
    const y = target.y + Math.round(target.normal.y);
    const z = target.z + Math.round(target.normal.z);
    const existing = this.world.getBlock(x, y, z);
    if (existing !== BLOCK.air && existing !== BLOCK.water) return;
    if (this.blockOverlapsPlayer(x, y, z)) {
      this.callbacks.onToast("There is not enough room to place that here.");
      return;
    }

    this.world.setBlock(x, y, z, blockId);
    this.inventory[itemId] = countFor(this.inventory, itemId) - 1;
    this.spawnBlockParticles(x + 0.5, y + 0.5, z + 0.5, item.color);
    this.playTone(420, 0.055, "triangle", 0.04);
    this.markDirty();
    this.publishSnapshot();
  }

  private blockOverlapsPlayer(x: number, y: number, z: number): boolean {
    const horizontal =
      this.playerPosition.x + PLAYER_RADIUS > x &&
      this.playerPosition.x - PLAYER_RADIUS < x + 1 &&
      this.playerPosition.z + PLAYER_RADIUS > z &&
      this.playerPosition.z - PLAYER_RADIUS < z + 1;
    const vertical = this.playerPosition.y < y + 1 && this.playerPosition.y + PLAYER_HEIGHT > y;
    return horizontal && vertical;
  }

  private collect(item: ItemId, amount: number): void {
    this.inventory[item] = Math.min(999, countFor(this.inventory, item) + amount);
    this.callbacks.onToast(`+${amount} ${ITEMS[item].name}`);
    this.publishSnapshot();
    this.playTone(740, 0.055, "sine", 0.035);
  }

  private updateWeather(dt: number): void {
    this.nextWeatherChange -= dt;
    if (this.nextWeatherChange <= 0) {
      if (this.weather === "clear") {
        this.weather = Math.random() < 0.34 ? "rain" : "clear";
        this.nextWeatherChange = this.weather === "rain" ? 36 + Math.random() * 34 : 82 + Math.random() * 70;
      } else {
        this.weather = "clear";
        this.nextWeatherChange = 105 + Math.random() * 95;
      }
      this.publishSnapshot();
    }

    this.rain.visible = this.weather === "rain";
    if (this.weather !== "rain") return;
    this.rain.position.set(this.playerPosition.x, 0, this.playerPosition.z);
    const attribute = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let index = 0; index < this.rainState.length; index += 1) {
      const drop = this.rainState[index];
      drop.y -= 21 * dt;
      if (drop.y < -4) {
        drop.y = 10 + Math.random() * 13;
        drop.x = Math.random() * 34 - 17;
        drop.z = Math.random() * 34 - 17;
      }
      const offset = index * 6;
      this.rainData[offset] = drop.x;
      this.rainData[offset + 1] = drop.y;
      this.rainData[offset + 2] = drop.z;
      this.rainData[offset + 3] = drop.x + 0.03;
      this.rainData[offset + 4] = drop.y - 0.42;
      this.rainData[offset + 5] = drop.z + 0.03;
    }
    attribute.needsUpdate = true;
  }

  private updateLighting(dt: number): void {
    const daylightFraction = this.timeOfDay - Math.floor(this.timeOfDay);
    const angle = daylightFraction * Math.PI * 2 - Math.PI / 2;
    const sunHeight = Math.sin(angle);
    const daylight = smoothstep(-0.16, 0.18, sunHeight);
    const horizonGlow = (1 - smoothstep(0.12, 0.72, Math.abs(sunHeight))) * (daylight > 0.03 ? 0.72 : 0.3);

    this.skyColor.copy(this.nightColor).lerp(this.dayColor, daylight);
    this.skyColor.lerp(this.duskColor, horizonGlow * 0.22);
    if (this.weather === "rain") this.skyColor.lerp(new THREE.Color("#778a91"), 0.32);
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.skyColor);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.skyColor);
      this.scene.fog.density = this.weather === "rain" ? 0.022 : 0.015 + (1 - daylight) * 0.0045;
    }

    this.sunDirection.set(Math.cos(angle) * 0.72, Math.sin(angle), Math.sin(angle) * 0.48).normalize();
    this.sunLight.position.copy(this.camera.position).addScaledVector(this.sunDirection, 80);
    this.sunLight.target.position.copy(this.camera.position);
    this.sunLight.target.updateMatrixWorld();
    this.sunLight.intensity = (0.05 + daylight * 1.46) * (this.weather === "rain" ? 0.58 : 1);
    this.sunLight.color.copy(new THREE.Color("#fff0d3").lerp(new THREE.Color("#ffe4b5"), horizonGlow * 0.65));
    this.ambientLight.intensity = 0.2 + daylight * 0.58;
    this.clouds.material instanceof THREE.MeshBasicMaterial &&
      (this.clouds.material.opacity = this.weather === "rain" ? 0.72 : 0.32 + daylight * 0.34);

    const sunPosition = this.camera.position.clone().addScaledVector(this.sunDirection, 145);
    const moonPosition = this.camera.position.clone().addScaledVector(this.sunDirection, -145);
    this.sunMesh.position.copy(sunPosition);
    this.moonMesh.position.copy(moonPosition);
    this.sunMesh.visible = sunHeight > -0.16;
    this.moonMesh.visible = sunHeight < 0.05;
    (this.stars.material as THREE.PointsMaterial).opacity = 1 - daylight;
    this.stars.position.copy(this.camera.position);
    this.stars.rotation.y += dt * 0.0018;
  }

  private updateCreatures(dt: number): void {
    for (const creature of this.creatures) {
      const dxPlayer = this.playerPosition.x - creature.x;
      const dzPlayer = this.playerPosition.z - creature.z;
      const playerDistance = Math.hypot(dxPlayer, dzPlayer);
      creature.turnIn -= dt;

      if (playerDistance < 5.4) {
        const awayX = creature.x - this.playerPosition.x;
        const awayZ = creature.z - this.playerPosition.z;
        const length = Math.max(0.001, Math.hypot(awayX, awayZ));
        creature.targetX = creature.x + (awayX / length) * 7;
        creature.targetZ = creature.z + (awayZ / length) * 7;
        creature.turnIn = 1.2;
      } else if (creature.turnIn <= 0) {
        creature.targetX = creature.x + (Math.random() - 0.5) * 12;
        creature.targetZ = creature.z + (Math.random() - 0.5) * 12;
        creature.turnIn = 3.2 + Math.random() * 5;
      }

      const dx = creature.targetX - creature.x;
      const dz = creature.targetZ - creature.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.28) {
        const sample = this.world.terrainAt(creature.targetX, creature.targetZ);
        const currentHeight = this.world.heightAt(creature.x, creature.z);
        if (Math.abs(sample.height - currentHeight) <= 1 && sample.height >= 7) {
          const speed = playerDistance < 5.4 ? 2.4 : 0.72;
          const stride = Math.min(distance, speed * dt);
          creature.x += (dx / distance) * stride;
          creature.z += (dz / distance) * stride;
          creature.root.rotation.y = Math.atan2(-dx, -dz);
          creature.phase += dt * (playerDistance < 5.4 ? 12 : 7);
          creature.legs.forEach((leg, index) => {
            leg.rotation.x = Math.sin(creature.phase + index * Math.PI) * 0.18;
          });
          creature.body.position.y = 0.77 + Math.abs(Math.sin(creature.phase * 0.5)) * 0.025;
        } else {
          creature.turnIn = 0;
        }
      }

      creature.root.position.set(
        creature.x,
        this.world.heightAt(creature.x, creature.z) + 1,
        creature.z,
      );
    }
  }

  private updateParticles(dt: number): void {
    for (let index = this.particles.length - 1; index >= 0; index -= 1) {
      const particle = this.particles[index];
      particle.life -= dt;
      particle.velocity.y -= 8.5 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 4;
      particle.mesh.rotation.y += dt * 5;
      particle.material.opacity = Math.max(0, particle.life / particle.maxLife);
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        particle.material.dispose();
        this.particles.splice(index, 1);
      }
    }
  }

  private syncWorldMeshes(): void {
    for (const mesh of this.world.meshes) {
      if (mesh.parent !== this.scene) this.scene.add(mesh);
    }
    for (const child of [...this.scene.children]) {
      if (
        child instanceof THREE.Mesh &&
        child.name.startsWith("chunk-") &&
        !this.world.chunkMeshes.has(String(child.userData.chunkKey))
      ) {
        this.scene.remove(child);
      }
    }
  }

  private createStars(): THREE.Points {
    const count = 520;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 45 + Math.random() * 130;
      const offset = index * 3;
      positions[offset] = Math.cos(angle) * radius;
      positions[offset + 1] = 18 + Math.random() * 115;
      positions[offset + 2] = Math.sin(angle) * radius;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: "#f5edcf",
      size: 0.72,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    });
    return new THREE.Points(geometry, material);
  }

  private createClouds(): THREE.InstancedMesh {
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({
      color: "#fff7e5",
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const total = 19 * 5;
    const clouds = new THREE.InstancedMesh(geometry, material, total);
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let group = 0; group < 19; group += 1) {
      const baseX = (Math.random() - 0.5) * 170;
      const baseZ = (Math.random() - 0.5) * 170;
      const height = 25 + Math.random() * 13;
      for (let puff = 0; puff < 5; puff += 1) {
        dummy.position.set(baseX + (Math.random() - 0.5) * 7, height + (puff % 2) * 0.6, baseZ + (Math.random() - 0.5) * 6);
        dummy.scale.set(3 + Math.random() * 4, 0.55 + Math.random() * 0.45, 2.2 + Math.random() * 3.4);
        dummy.updateMatrix();
        clouds.setMatrixAt(index, dummy.matrix);
        index += 1;
      }
    }
    clouds.instanceMatrix.needsUpdate = true;
    clouds.frustumCulled = false;
    return clouds;
  }

  private createRain(): THREE.LineSegments {
    for (let index = 0; index < 280; index += 1) {
      this.rainState.push({
        x: Math.random() * 34 - 17,
        y: Math.random() * 22,
        z: Math.random() * 34 - 17,
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.rainData, 3));
    const material = new THREE.LineBasicMaterial({
      color: "#d7eef1",
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    });
    const lines = new THREE.LineSegments(geometry, material);
    lines.visible = false;
    lines.frustumCulled = false;
    return lines;
  }

  private createCreatures(): void {
    const positions: [number, number][] = [
      [8.7, 3.4],
      [-8.4, 4.2],
      [5.1, -10.2],
    ];
    const box = new THREE.BoxGeometry(1, 1, 1);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: "#b7a27b", roughness: 0.94 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: "#c4b18b", roughness: 0.92 });
    const creamMaterial = new THREE.MeshStandardMaterial({ color: "#e5d6b7", roughness: 0.9 });
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: "#30363b", roughness: 0.5 });
    const noseMaterial = new THREE.MeshStandardMaterial({ color: "#7d6252", roughness: 0.8 });

    for (const [x, z] of positions) {
      const root = new THREE.Group();
      const body = new THREE.Mesh(box, bodyMaterial);
      body.scale.set(0.92, 0.57, 1.18);
      body.position.set(0, 0.77, 0);
      root.add(body);

      const head = new THREE.Mesh(box, headMaterial);
      head.scale.set(0.57, 0.52, 0.61);
      head.position.set(0, 1.07, -0.62);
      root.add(head);

      const muzzle = new THREE.Mesh(box, creamMaterial);
      muzzle.scale.set(0.31, 0.2, 0.2);
      muzzle.position.set(0, 0.96, -0.96);
      root.add(muzzle);

      for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(box, creamMaterial);
        ear.scale.set(0.16, 0.32, 0.15);
        ear.position.set(side * 0.23, 1.42, -0.56);
        root.add(ear);
        const eye = new THREE.Mesh(box, eyeMaterial);
        eye.scale.set(0.065, 0.075, 0.055);
        eye.position.set(side * 0.18, 1.16, -0.929);
        root.add(eye);
      }

      const nose = new THREE.Mesh(box, noseMaterial);
      nose.scale.set(0.13, 0.09, 0.08);
      nose.position.set(0, 0.985, -1.055);
      root.add(nose);

      const legs: THREE.Group[] = [];
      for (const legX of [-0.28, 0.28]) {
        for (const legZ of [-0.39, 0.39]) {
          const leg = new THREE.Group();
          leg.position.set(legX, 0.51, legZ);
          const lower = new THREE.Mesh(box, creamMaterial);
          lower.scale.set(0.19, 0.47, 0.19);
          lower.position.y = -0.22;
          leg.add(lower);
          root.add(leg);
          legs.push(leg);
        }
      }

      const creature: Mossling = {
        root,
        legs,
        body,
        x,
        z,
        targetX: x + 2,
        targetZ: z - 2,
        turnIn: Math.random() * 2,
        friendship: 0,
        phase: Math.random() * Math.PI * 2,
      };
      root.traverse((object) => {
        object.userData.mossling = creature;
      });
      root.position.set(x, this.world.heightAt(x, z) + 1, z);
      this.scene.add(root);
      this.creatures.push(creature);
    }
  }

  private petMossling(creature: Mossling): void {
    creature.friendship += 1;
    this.spawnHeartMotes(creature.root.position.x, creature.root.position.y + 1.4, creature.root.position.z);
    this.callbacks.onToast(creature.friendship >= 3 ? "The mossling knows you now." : "A soft, curious little bleat.");
    this.playTone(580, 0.1, "sine", 0.045);
    creature.turnIn = 0.9;
  }

  private spawnBlockParticles(x: number, y: number, z: number, color: string): void {
    for (let index = 0; index < 9; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 });
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
      mesh.scale.setScalar(0.55 + Math.random() * 0.7);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        material,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 4, 1.5 + Math.random() * 3, (Math.random() - 0.5) * 4),
        life: 0.42 + Math.random() * 0.34,
        maxLife: 0.76,
      });
    }
  }

  private spawnHeartMotes(x: number, y: number, z: number): void {
    for (let index = 0; index < 6; index += 1) {
      const material = new THREE.MeshBasicMaterial({ color: "#e89b92", transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6);
      mesh.scale.setScalar(0.42);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        material,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, 1.3 + Math.random(), (Math.random() - 0.5) * 1.5),
        life: 0.8,
        maxLife: 0.8,
      });
    }
  }

  private blockTint(id: BlockId): string {
    switch (id) {
      case BLOCK.grass:
        return "#84a45e";
      case BLOCK.dirt:
        return "#916d50";
      case BLOCK.stone:
        return "#91989a";
      case BLOCK.sand:
        return "#d3bd83";
      case BLOCK.oakLog:
        return "#946a44";
      case BLOCK.leaves:
        return "#759057";
      case BLOCK.planks:
        return "#bd9363";
      case BLOCK.coalOre:
        return "#565e61";
      case BLOCK.copperOre:
        return "#bf7951";
      case BLOCK.amethyst:
        return "#a17bce";
      case BLOCK.snow:
        return "#e4ece7";
      case BLOCK.workbench:
        return "#aa8053";
      case BLOCK.lantern:
        return "#edb663";
      default:
        return "#83a096";
    }
  }

  private hasWorkbench(): boolean {
    return this.world.hasWorkbenchNear(
      Math.floor(this.playerPosition.x),
      Math.floor(this.playerPosition.y),
      Math.floor(this.playerPosition.z),
    );
  }

  private publishSnapshot(): void {
    const minutes = Math.floor((this.timeOfDay - Math.floor(this.timeOfDay)) * 24 * 60);
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    this.callbacks.onSnapshot({
      inventory: { ...this.inventory },
      hotbar: [...this.hotbar],
      selected: this.selected,
      biome: this.world.biomeAt(this.playerPosition.x, this.playerPosition.z),
      x: Math.floor(this.playerPosition.x),
      y: Math.floor(this.playerPosition.y),
      z: Math.floor(this.playerPosition.z),
      clock: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      day: Math.floor(this.timeOfDay) + 1,
      weather: this.weather,
      miningProgress: this.miningProgress,
      targetName: this.target?.kind === "block"
        ? BLOCKS[this.target.id].name
        : this.target?.kind === "creature"
          ? "Mossling"
          : "",
      hasWorkbench: this.hasWorkbench(),
      seed: this.savedSeed.toString(36).toUpperCase(),
      touchMode: this.touchMode,
    });
  }

  private markDirty(): void {
    this.dirty = true;
  }

  private ensureAudio(): void {
    if (!this.audioContext) {
      try {
        const AudioContextClass = window.AudioContext;
        if (AudioContextClass) this.audioContext = new AudioContextClass();
      } catch {
        this.audioContext = null;
      }
    }
    if (this.audioContext?.state === "suspended") void this.audioContext.resume().catch(() => undefined);
  }

  private playTone(frequency: number, duration: number, type: OscillatorType, volume: number): void {
    this.ensureAudio();
    const context = this.audioContext;
    if (!context) return;
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const now = context.currentTime;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 0.72), now + duration);
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch {
      // Audio is an enhancement; gameplay remains available when synthesis is blocked.
    }
  }

}