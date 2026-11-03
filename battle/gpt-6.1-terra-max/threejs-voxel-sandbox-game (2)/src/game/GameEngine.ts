import * as THREE from 'three';
import { GameAudio } from './audio';
import { BLOCK, ITEMS, RECIPES, starterInventory, type Slot } from './catalog';
import { Creatures } from './creatures';
import { Environment, type Weather } from './environment';
import { biomeAt, DEFAULT_SEED, hash2, terrainHeight, WATER_LEVEL } from './noise';
import { VoxelWorld, WORLD_HEIGHT } from './world';

const SAVE_KEY = 'loam-world-v1';
const PLAYER_HEIGHT = 1.8;
const PLAYER_RADIUS = 0.3;
const REACH = 6;

export interface QuestProgress {
  wood: number;
  crafted: number;
  placed: number;
}

export interface GameSnapshot {
  ready: boolean;
  playing: boolean;
  started: boolean;
  touch: boolean;
  inventory: (Slot | null)[];
  selected: number;
  health: number;
  time: string;
  day: number;
  isNight: boolean;
  weather: Weather;
  biome: string;
  coordinates: [number, number, number];
  sound: boolean;
  target: string;
  breakProgress: number;
  quest: QuestProgress;
  toast: string;
  toastId: number;
  underwater: boolean;
}

interface SaveData {
  version: number;
  seed: number;
  edits: Record<string, number>;
  inventory: (Slot | null)[];
  selected: number;
  position: [number, number, number];
  yaw: number;
  pitch: number;
  minutes: number;
  health: number;
  quest: QuestProgress;
  weather: Weather;
  sound: boolean;
}

interface BlockHit {
  x: number;
  y: number;
  z: number;
  id: number;
  previous: [number, number, number];
  distance: number;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

export const initialSnapshot: GameSnapshot = {
  ready: false,
  playing: false,
  started: false,
  touch: false,
  inventory: starterInventory(),
  selected: 0,
  health: 10,
  time: '9:24 AM',
  day: 1,
  isNight: false,
  weather: 'Clear',
  biome: 'Wildflower meadow',
  coordinates: [0, 0, -13],
  sound: true,
  target: '',
  breakProgress: 0,
  quest: { wood: 0, crafted: 0, placed: 0 },
  toast: '',
  toastId: 0,
  underwater: false,
};

function readSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1 || !Number.isFinite(data.seed) || !Array.isArray(data.inventory) || data.inventory.length !== 27 || !Array.isArray(data.position)) return null;
    return data;
  } catch {
    return null;
  }
}

function clockString(minutes: number) {
  const hour24 = Math.floor((minutes % 1440) / 60);
  const minute = Math.floor(minutes % 60);
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

export class GameEngine {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(70, 1, 0.05, 260);
  private world: VoxelWorld;
  private environment: Environment;
  private creatures: Creatures;
  private audio = new GameAudio();
  private player: THREE.Vector3;
  private spawn: THREE.Vector3;
  private seed: number;
  private velocityY = 0;
  private velocityX = 0;
  private velocityZ = 0;
  private grounded = false;
  private jumpQueued = false;
  private yaw = 0;
  private pitch = -0.16;
  private keys = new Set<string>();
  private inventory: (Slot | null)[];
  private selected = 0;
  private health = 10;
  private quest: QuestProgress = { wood: 0, crafted: 0, placed: 0 };
  private minutes = 9 * 60 + 24;
  private weather: Weather = 'Clear';
  private weatherTimer = 0;
  private started = false;
  private playing = false;
  private ready = false;
  private uiOpen = false;
  private touch = window.matchMedia('(pointer: coarse)').matches;
  private fallbackLook = false;
  private dragPointer: { id: number; x: number; y: number } | null = null;
  private currentHit: BlockHit | null = null;
  private animalHit: { index: number; distance: number } | null = null;
  private outline: THREE.LineSegments;
  private held = new THREE.Group();
  private heldSwing = 0;
  private mining = false;
  private mineKey = '';
  private mineProgress = 0;
  private walkCycle = 0;
  private stepTimer = 0;
  private elapsed = 0;
  private emitTimer = 0;
  private saveTimer = 0;
  private toast = '';
  private toastUntil = 0;
  private toastId = 0;
  private underwater = false;
  private particles: Particle[] = [];
  private particleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private particleMaterials = new Map<number, THREE.MeshLambertMaterial>();
  private animationFrame = 0;
  private lastFrame = 0;
  private disposed = false;
  private discardSave = false;
  private readyThreshold = 38;
  private pixelRatio = 1;
  private performanceStart = 0;
  private performanceFrames = 0;

  constructor(
    private mount: HTMLElement,
    private onChange: (snapshot: GameSnapshot) => void,
    private onUiRequest: (panel: 'inventory' | 'help') => void,
  ) {
    const saved = readSave();
    let nextSeed = DEFAULT_SEED;
    try {
      const storedSeed = sessionStorage.getItem('loam-next-seed');
      if (storedSeed) {
        nextSeed = Number(storedSeed) || DEFAULT_SEED;
        sessionStorage.removeItem('loam-next-seed');
      }
    } catch { /* The default seed still works when storage is unavailable. */ }
    this.seed = saved?.seed ?? nextSeed;
    this.inventory = saved?.inventory.map((slot) => slot && ITEMS[slot.id] ? { id: slot.id, count: Math.max(1, Math.min(64, slot.count)) } : null) ?? starterInventory();
    this.selected = Math.max(0, Math.min(8, saved?.selected ?? 0));
    this.health = Math.max(1, Math.min(10, saved?.health ?? 10));
    this.quest = { ...this.quest, ...saved?.quest };
    this.minutes = Number.isFinite(saved?.minutes) ? saved!.minutes : this.minutes;
    this.weather = saved?.weather === 'Rain' ? 'Rain' : 'Clear';
    this.audio.enabled = saved?.sound ?? true;
    this.yaw = Number.isFinite(saved?.yaw) ? saved!.yaw : 0;
    this.pitch = Number.isFinite(saved?.pitch) ? saved!.pitch : -0.16;
    const spawnZ = terrainHeight(0, -13, this.seed) > WATER_LEVEL + 1 ? -12.5 : -7.5;
    const spawnY = terrainHeight(0, Math.floor(spawnZ), this.seed) + 1.01;
    this.spawn = new THREE.Vector3(0.5, spawnY, spawnZ);
    this.player = saved?.position.every(Number.isFinite)
      ? new THREE.Vector3(...saved.position)
      : this.spawn.clone();

    const probe = document.createElement('canvas').getContext('webgl2');
    const debugInfo = probe?.getExtension('WEBGL_debug_renderer_info');
    const gpuName = debugInfo ? String(probe?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : '';
    const softwareRenderer = /swiftshader|llvmpipe|software/i.test(gpuName);
    probe?.getExtension('WEBGL_lose_context')?.loseContext();
    this.renderer = new THREE.WebGLRenderer({ antialias: !softwareRenderer, powerPreference: 'high-performance' });
    this.pixelRatio = softwareRenderer ? 0.65 : Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'game-canvas';
    this.canvas.setAttribute('aria-label', 'The interactive 3D world of Loam');
    this.mount.appendChild(this.canvas);

    this.environment = new Environment(this.scene);
    const viewRadius = softwareRenderer ? 2 : 3;
    this.readyThreshold = (viewRadius * 2 + 1) ** 2 - 11;
    this.world = new VoxelWorld(this.scene, this.seed, saved?.edits ?? {}, viewRadius);
    this.world.updateStreaming(this.player.x, this.player.z);
    this.world.processQueue(4);
    for (let i = 0; i < 12 && this.collides(this.player.x, this.player.y, this.player.z); i++) this.player.y += 1;
    this.creatures = new Creatures(this.scene, this.seed);
    this.scene.add(this.camera);
    this.camera.add(this.held);
    this.held.scale.setScalar(0.58);
    this.rebuildHeldItem();

    const outlineGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008));
    this.outline = new THREE.LineSegments(outlineGeometry, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthTest: false }));
    this.outline.visible = false;
    this.outline.renderOrder = 5;
    this.scene.add(this.outline);

    this.resize();
    this.updateCamera();
    this.environment.update(this.minutes, this.weather, this.camera.position, 0);
    this.addListeners();
    this.emit();
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  private addListeners() {
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('pointerup', this.pointerUp);
    window.addEventListener('pagehide', this.save);
    document.addEventListener('visibilitychange', this.visibilityChange);
    document.addEventListener('pointerlockchange', this.pointerLockChange);
    document.addEventListener('mousemove', this.mouseMove);
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('pointermove', this.pointerMove);
    this.canvas.addEventListener('contextmenu', this.preventContext);
    this.canvas.addEventListener('wheel', this.wheel, { passive: false });
  }

  private resize = () => {
    const width = this.mount.clientWidth || window.innerWidth;
    const height = this.mount.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private keyDown = (event: KeyboardEvent) => {
    if (event.code === 'KeyE' && !event.repeat) {
      event.preventDefault();
      this.onUiRequest('inventory');
      return;
    }
    if (event.code === 'KeyH' && !event.repeat) {
      event.preventDefault();
      this.onUiRequest('help');
      return;
    }
    if (event.code === 'Escape' && this.playing && !this.uiOpen) {
      event.preventDefault();
      this.pause();
      return;
    }
    if (!this.playing || this.uiOpen) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.code)) event.preventDefault();
    if (event.code.startsWith('Digit')) {
      const index = Number(event.code.slice(5)) - 1;
      if (index >= 0 && index < 9) this.selectSlot(index);
    }
    if (event.code === 'Space' && !event.repeat) this.jumpQueued = true;
    this.keys.add(event.code);
  };

  private keyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private pointerDown = (event: PointerEvent) => {
    if (event.pointerType === 'touch') {
      if (this.playing) this.dragPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      return;
    }
    if (!this.playing) {
      if (this.started && !this.uiOpen) this.start();
      return;
    }
    if (this.fallbackLook) this.dragPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    if (event.button === 0) {
      if (this.animalHit) this.shearAnimal();
      else this.mining = true;
    }
    if (event.button === 2) this.placeBlock();
  };

  private pointerMove = (event: PointerEvent) => {
    if (!this.playing || !this.dragPointer || event.pointerId !== this.dragPointer.id) return;
    const dx = event.clientX - this.dragPointer.x;
    const dy = event.clientY - this.dragPointer.y;
    this.dragPointer.x = event.clientX;
    this.dragPointer.y = event.clientY;
    this.look(dx, dy);
  };

  private pointerUp = (event: PointerEvent) => {
    if (event.button === 0 || event.pointerType === 'touch') {
      this.mining = false;
      this.mineProgress = 0;
      this.mineKey = '';
    }
    if (this.dragPointer?.id === event.pointerId) this.dragPointer = null;
  };

  private mouseMove = (event: MouseEvent) => {
    if (!this.playing || document.pointerLockElement !== this.canvas) return;
    // Some browsers report a one-frame cursor warp when pointer lock begins or clicks.
    if (Math.abs(event.movementX) > Math.max(250, window.innerWidth * 0.45) || Math.abs(event.movementY) > Math.max(200, window.innerHeight * 0.45)) return;
    this.look(event.movementX, event.movementY);
  };

  private look(dx: number, dy: number) {
    this.yaw -= dx * 0.0023;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.0023, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
  }

  private wheel = (event: WheelEvent) => {
    if (!this.playing) return;
    event.preventDefault();
    this.selectSlot((this.selected + (event.deltaY > 0 ? 1 : 8)) % 9);
  };

  private preventContext = (event: Event) => event.preventDefault();

  private pointerLockChange = () => {
    if (document.pointerLockElement === this.canvas) {
      this.started = true;
      this.playing = true;
      this.fallbackLook = false;
      this.uiOpen = false;
      this.audio.play('click');
    } else if (!this.touch && !this.fallbackLook) {
      this.playing = false;
      this.keys.clear();
      this.mining = false;
    }
    this.emit();
  };

  private visibilityChange = () => {
    if (document.visibilityState === 'hidden') this.save();
  };

  start() {
    if (!this.ready || this.disposed) return;
    this.uiOpen = false;
    if (this.touch) {
      this.started = true;
      this.playing = true;
      this.audio.play('click');
      this.emit();
      return;
    }
    try {
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') {
        void result.catch(() => this.startFallback());
      }
    } catch {
      this.startFallback();
    }
  }

  private startFallback() {
    if (this.disposed || this.uiOpen) return;
    this.fallbackLook = true;
    this.started = true;
    this.playing = true;
    this.notify('Drag the world to look around');
    this.emit();
  }

  pause() {
    this.playing = false;
    this.keys.clear();
    this.mining = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.save();
    this.emit();
  }

  setUiOpen(open: boolean) {
    this.uiOpen = open;
    if (open) {
      this.playing = false;
      this.keys.clear();
      this.mining = false;
      if (document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.emit();
    } else if (this.started) {
      this.start();
    } else {
      this.emit();
    }
  }

  setTouchKey(key: string, down: boolean) {
    if (down) {
      this.keys.add(key);
      if (key === 'Space') this.jumpQueued = true;
    } else this.keys.delete(key);
  }

  setTouchMining(down: boolean) {
    if (down && this.animalHit) this.shearAnimal();
    else this.mining = down;
    if (!down) this.mineProgress = 0;
  }

  touchPlace() { this.placeBlock(); }

  selectSlot(index: number) {
    if (index < 0 || index > 8) return;
    this.selected = index;
    this.rebuildHeldItem();
    this.emit();
  }

  swapSlots(a: number, b: number) {
    if (a < 0 || a >= 27 || b < 0 || b >= 27) return;
    [this.inventory[a], this.inventory[b]] = [this.inventory[b], this.inventory[a]];
    this.rebuildHeldItem();
    this.audio.play('click');
    this.save();
    this.emit();
  }

  toggleSound() {
    this.audio.enabled = !this.audio.enabled;
    if (this.audio.enabled) this.audio.play('click');
    this.save();
    this.emit();
  }

  toggleWeather() {
    this.weather = this.weather === 'Clear' ? 'Rain' : 'Clear';
    this.weatherTimer = 0;
    this.notify(this.weather === 'Rain' ? 'A little rain is rolling in' : 'The skies are clearing');
    this.save();
    this.emit();
  }

  newWorld() {
    this.discardSave = true;
    try {
      localStorage.removeItem(SAVE_KEY);
      sessionStorage.setItem('loam-next-seed', String(Math.floor(Math.random() * 900000) + 10000));
    } catch { /* Reloading still resets the current in-memory world. */ }
    window.location.reload();
  }

  craft(recipeId: string) {
    const recipe = RECIPES.find((item) => item.id === recipeId);
    if (!recipe) return;
    const totals = (id: number) => this.inventory.reduce((sum, slot) => sum + (slot?.id === id ? slot.count : 0), 0);
    if (recipe.ingredients.some((ingredient) => totals(ingredient.id) < ingredient.count)) {
      this.notify('Not quite enough materials yet');
      return;
    }
    const previous = this.inventory.map((slot) => slot ? { ...slot } : null);
    for (const ingredient of recipe.ingredients) {
      let remaining = ingredient.count;
      for (let i = 0; i < this.inventory.length && remaining > 0; i++) {
        const slot = this.inventory[i];
        if (slot?.id !== ingredient.id) continue;
        const used = Math.min(remaining, slot.count);
        slot.count -= used;
        remaining -= used;
        if (!slot.count) this.inventory[i] = null;
      }
    }
    if (!this.addItem(recipe.output, recipe.amount)) {
      this.inventory = previous;
      this.notify('Your inventory is full');
      return;
    }
    if (recipe.output === BLOCK.PLANKS) {
      const before = this.quest.crafted;
      this.quest.crafted = Math.min(4, this.quest.crafted + recipe.amount);
      if (before < 4 && this.quest.crafted >= 4) this.notify('Field note complete: Craft planks');
      else this.notify(`Crafted ${recipe.amount} ${ITEMS[recipe.output].name.toLowerCase()}`);
    } else this.notify(`Crafted ${recipe.amount} ${ITEMS[recipe.output].name.toLowerCase()}`);
    this.audio.play('craft');
    this.rebuildHeldItem();
    this.save();
    this.emit();
  }

  private addItem(id: number, count: number) {
    let capacity = 0;
    for (const slot of this.inventory) {
      if (!slot) capacity += 64;
      else if (slot.id === id && ITEMS[id]?.kind !== 'tool') capacity += 64 - slot.count;
    }
    if (capacity < count) return false;
    let remaining = count;
    for (const slot of this.inventory) {
      if (!slot || slot.id !== id || ITEMS[id]?.kind === 'tool') continue;
      const amount = Math.min(64 - slot.count, remaining);
      slot.count += amount;
      remaining -= amount;
      if (!remaining) return true;
    }
    for (let i = 0; i < this.inventory.length && remaining; i++) {
      if (this.inventory[i]) continue;
      const amount = Math.min(64, remaining);
      this.inventory[i] = { id, count: amount };
      remaining -= amount;
    }
    return true;
  }

  private frame = (time: number) => {
    if (this.disposed) return;
    const dt = this.lastFrame ? Math.min((time - this.lastFrame) / 1000, 0.25) : 0;
    this.lastFrame = time;
    this.elapsed += dt;
    this.performanceFrames++;
    if (!this.performanceStart) this.performanceStart = time;
    if (time - this.performanceStart > 5000) {
      const fps = this.performanceFrames * 1000 / (time - this.performanceStart);
      if (this.playing && fps < 24 && this.pixelRatio > 0.5) {
        this.pixelRatio = Math.max(0.5, this.pixelRatio - 0.15);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.resize();
      }
      this.performanceStart = time;
      this.performanceFrames = 0;
    }
    this.world.processQueue(2);
    if (!this.ready && this.world.pendingCount <= this.readyThreshold) {
      this.ready = true;
      this.emit();
    }
    if (this.playing) {
      this.minutes += dt * 2;
      this.weatherTimer += dt;
      if (this.weatherTimer > 150) {
        this.weatherTimer = 0;
        if (hash2(Math.floor(this.minutes), Math.floor(this.player.x), this.seed) > 0.45) {
          this.weather = this.weather === 'Clear' ? 'Rain' : 'Clear';
          this.notify(this.weather === 'Rain' ? 'A little rain is rolling in' : 'The skies are clearing');
        }
      }
      // Small physics steps keep collisions stable even if a frame arrives late.
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(remaining, 0.05);
        this.updatePlayer(step);
        remaining -= step;
      }
      this.world.updateStreaming(this.player.x, this.player.z);
      this.saveTimer += dt;
      if (this.saveTimer > 5) {
        this.saveTimer = 0;
        this.save();
      }
    }
    this.updateCamera();
    this.updateTarget();
    if (this.playing && this.mining) this.updateMining(dt);
    this.updateParticles(dt);
    this.creatures.update(dt, this.playing);
    this.environment.update(this.minutes, this.weather, this.camera.position, dt);
    this.heldSwing = Math.max(0, this.heldSwing - dt * 3.5);
    const sway = this.playing && (Math.abs(this.velocityX) + Math.abs(this.velocityZ) > 0.3) ? Math.sin(this.walkCycle * 0.5) * 0.018 : 0;
    this.held.position.set(0.92 + sway, -0.66 + Math.abs(sway) - this.heldSwing * 0.08, -1.2);
    this.held.rotation.set(-0.05 - this.heldSwing * 0.55, -0.25, -0.12 + this.heldSwing * 0.35);
    this.renderer.render(this.scene, this.camera);
    this.emitTimer += dt;
    if (this.emitTimer > 0.22) {
      this.emitTimer = 0;
      this.emit();
    }
    this.animationFrame = requestAnimationFrame(this.frame);
  };

  private updatePlayer(dt: number) {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const strafe = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const length = Math.hypot(forward, strafe) || 1;
    const inWater = this.world.getBlock(Math.floor(this.player.x), Math.floor(this.player.y + 0.7), Math.floor(this.player.z)) === BLOCK.WATER;
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = inWater ? 2.5 : sprint ? 6.6 : 4.4;
    const moveX = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) / length * speed;
    const moveZ = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) / length * speed;
    const response = Math.min(1, dt * (this.grounded ? 15 : 8));
    this.velocityX = THREE.MathUtils.lerp(this.velocityX, moveX, response);
    this.velocityZ = THREE.MathUtils.lerp(this.velocityZ, moveZ, response);
    if (this.jumpQueued && (this.grounded || inWater)) {
      this.velocityY = inWater ? 4.2 : 8.1;
      this.grounded = false;
    }
    this.jumpQueued = false;
    if (inWater && this.keys.has('Space')) this.velocityY = Math.max(this.velocityY, 3.2);
    this.velocityY = Math.max(this.velocityY - (inWater ? 8 : 21) * dt, inWater ? -3 : -26);
    this.moveAxis('x', this.velocityX * dt);
    this.moveAxis('z', this.velocityZ * dt);
    this.grounded = false;
    const fallSpeed = this.velocityY;
    const hitY = this.moveAxis('y', this.velocityY * dt);
    if (hitY) {
      if (fallSpeed < 0) {
        this.grounded = true;
        if (fallSpeed < -13 && !inWater) {
          this.health = Math.max(0, this.health - Math.floor((-fallSpeed - 10) / 3));
          this.notify(this.health ? 'That was quite a fall' : 'A fresh start, back in the meadow');
          if (!this.health) this.respawn();
        }
      }
      this.velocityY = 0;
    }
    const walking = Math.hypot(this.velocityX, this.velocityZ) > 0.7 && this.grounded;
    if (walking) {
      this.walkCycle += dt * (sprint ? 12 : 9);
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.audio.play('step');
        this.stepTimer = sprint ? 0.28 : 0.4;
      }
    } else this.stepTimer = 0;
    if (this.player.y < -10) this.respawn();
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number) {
    const steps = Math.max(1, Math.ceil(Math.abs(amount) / 0.12));
    const step = amount / steps;
    for (let i = 0; i < steps; i++) {
      this.player[axis] += step;
      if (this.collides(this.player.x, this.player.y, this.player.z)) {
        this.player[axis] -= step;
        if (axis === 'x') this.velocityX = 0;
        if (axis === 'z') this.velocityZ = 0;
        return true;
      }
    }
    return false;
  }

  private collides(x: number, y: number, z: number) {
    const minX = Math.floor(x - PLAYER_RADIUS + 0.001);
    const maxX = Math.floor(x + PLAYER_RADIUS - 0.001);
    const minY = Math.floor(y + 0.001);
    const maxY = Math.floor(y + PLAYER_HEIGHT - 0.001);
    const minZ = Math.floor(z - PLAYER_RADIUS + 0.001);
    const maxZ = Math.floor(z + PLAYER_RADIUS - 0.001);
    for (let bx = minX; bx <= maxX; bx++) {
      for (let by = minY; by <= maxY; by++) {
        for (let bz = minZ; bz <= maxZ; bz++) {
          const id = this.world.getBlock(bx, by, bz);
          if (id !== BLOCK.AIR && id !== BLOCK.WATER) return true;
        }
      }
    }
    return false;
  }

  private respawn() {
    this.player.copy(this.spawn);
    this.player.y += 0.1;
    for (let i = 0; i < 12 && this.collides(this.player.x, this.player.y, this.player.z); i++) this.player.y += 1;
    this.velocityX = this.velocityY = this.velocityZ = 0;
    this.health = 10;
  }

  private updateCamera() {
    const bob = this.playing && this.grounded && Math.hypot(this.velocityX, this.velocityZ) > 0.7 ? Math.sin(this.walkCycle) * 0.025 : 0;
    this.camera.position.set(this.player.x, this.player.y + 1.62 + bob, this.player.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.updateMatrixWorld();
    this.underwater = this.world.getBlock(Math.floor(this.camera.position.x), Math.floor(this.camera.position.y), Math.floor(this.camera.position.z)) === BLOCK.WATER;
  }

  private traceBlock(): BlockHit | null {
    const origin = this.camera.position;
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    let previous: [number, number, number] = [Math.floor(origin.x), Math.floor(origin.y), Math.floor(origin.z)];
    let last = previous.join(',');
    for (let distance = 0.04; distance <= REACH; distance += 0.04) {
      const x = Math.floor(origin.x + direction.x * distance);
      const y = Math.floor(origin.y + direction.y * distance);
      const z = Math.floor(origin.z + direction.z * distance);
      const key = `${x},${y},${z}`;
      if (key === last) continue;
      const id = this.world.getBlock(x, y, z);
      if (id !== BLOCK.AIR && id !== BLOCK.WATER) return { x, y, z, id, previous, distance };
      previous = [x, y, z];
      last = key;
    }
    return null;
  }

  private updateTarget() {
    this.currentHit = this.traceBlock();
    const sheep = this.creatures.target(this.camera, REACH);
    this.animalHit = sheep && (!this.currentHit || sheep.distance < this.currentHit.distance) ? sheep : null;
    if (this.currentHit && !this.animalHit && this.playing) {
      this.outline.visible = true;
      this.outline.position.set(this.currentHit.x + 0.5, this.currentHit.y + 0.5, this.currentHit.z + 0.5);
    } else this.outline.visible = false;
  }

  private updateMining(dt: number) {
    const hit = this.currentHit;
    if (!hit || this.animalHit || hit.y <= 0) {
      this.mineProgress = 0;
      this.mineKey = '';
      return;
    }
    const key = `${hit.x},${hit.y},${hit.z}`;
    if (this.mineKey !== key) {
      this.mineKey = key;
      this.mineProgress = 0;
    }
    const selected = this.inventory[this.selected]?.id;
    let multiplier = 1;
    if (selected === BLOCK.AXE && [BLOCK.LOG, BLOCK.PLANKS].includes(hit.id as 4 | 8)) multiplier = 2.6;
    if (selected === BLOCK.PICKAXE && [BLOCK.STONE, BLOCK.COBBLE, BLOCK.BRICKS, BLOCK.SANDSTONE].includes(hit.id as 3 | 10 | 9 | 12)) multiplier = 3;
    this.mineProgress += dt * multiplier / (ITEMS[hit.id]?.hardness || 0.5);
    if (this.mineProgress >= 1) {
      if (!this.addItem(hit.id, 1)) {
        this.notify('Your inventory is full');
        this.mining = false;
      } else if (this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR)) {
        this.spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, hit.id);
        this.audio.play('break');
        this.heldSwing = 1;
        if (hit.id === BLOCK.LOG) {
          const before = this.quest.wood;
          this.quest.wood = Math.min(5, this.quest.wood + 1);
          if (before < 5 && this.quest.wood >= 5) this.notify('Field note complete: Gather wood');
        }
        this.save();
      }
      this.mineProgress = 0;
      this.mineKey = '';
      this.emit();
    }
  }

  private placeBlock() {
    if (!this.playing) return;
    if (!this.currentHit || this.animalHit) {
      this.notify('Look at a nearby block to build');
      return;
    }
    const slot = this.inventory[this.selected];
    if (!slot || ITEMS[slot.id]?.kind !== 'block') {
      this.notify('Choose a block from your hotbar to place');
      return;
    }
    const [x, y, z] = this.currentHit.previous;
    if (y <= 0 || y >= WORLD_HEIGHT || (this.world.getBlock(x, y, z) !== BLOCK.AIR && this.world.getBlock(x, y, z) !== BLOCK.WATER)) return;
    const overlaps = x < this.player.x + PLAYER_RADIUS && x + 1 > this.player.x - PLAYER_RADIUS &&
      y < this.player.y + PLAYER_HEIGHT && y + 1 > this.player.y &&
      z < this.player.z + PLAYER_RADIUS && z + 1 > this.player.z - PLAYER_RADIUS;
    if (overlaps) {
      this.notify('Give yourself a little room to build');
      return;
    }
    if (this.world.setBlock(x, y, z, slot.id)) {
      slot.count--;
      if (!slot.count) this.inventory[this.selected] = null;
      this.audio.play('place');
      this.heldSwing = 1;
      if (!this.quest.placed) {
        this.quest.placed = 1;
        this.notify('Field note complete: Place a block');
      }
      this.save();
      this.emit();
    }
  }

  private shearAnimal() {
    if (!this.animalHit) return;
    if (!this.addItem(BLOCK.WOOL, 1)) {
      this.notify('Your inventory is full');
      return;
    }
    if (this.creatures.shear(this.animalHit.index)) {
      this.audio.play('shear');
      this.heldSwing = 1;
      this.notify('A little wool from a new friend');
      this.save();
    } else {
      const index = this.inventory.findIndex((slot) => slot?.id === BLOCK.WOOL);
      if (index >= 0 && this.inventory[index]) {
        this.inventory[index]!.count--;
        if (!this.inventory[index]!.count) this.inventory[index] = null;
      }
      this.notify('This sheep needs a little time to regrow');
    }
    this.emit();
  }

  private spawnParticles(x: number, y: number, z: number, id: number) {
    if (!this.particleMaterials.has(id)) this.particleMaterials.set(id, new THREE.MeshLambertMaterial({ color: ITEMS[id]?.top ?? '#ffffff' }));
    const material = this.particleMaterials.get(id)!;
    for (let i = 0; i < 14; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.6, y + (Math.random() - 0.5) * 0.6, z + (Math.random() - 0.5) * 0.6);
      this.scene.add(mesh);
      this.particles.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 3, (Math.random() - 0.5) * 3), life: 0.45 + Math.random() * 0.35, maxLife: 0.8 });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      particle.life -= dt;
      particle.velocity.y -= dt * 10;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 4;
      particle.mesh.rotation.z += dt * 3;
      particle.mesh.scale.setScalar(Math.max(0.01, particle.life / particle.maxLife));
      if (particle.life <= 0) {
        this.scene.remove(particle.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  private rebuildHeldItem() {
    this.held.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.held.clear();
    const box = (parent: THREE.Group, size: [number, number, number], position: [number, number, number], color: string | number) => {
      const material = new THREE.MeshLambertMaterial({ color, depthTest: false, depthWrite: false, transparent: true });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.renderOrder = 100;
      parent.add(mesh);
      return mesh;
    };
    box(this.held, [0.3, 0.48, 0.3], [0.29, -0.27, 0.1], '#71855d');
    box(this.held, [0.29, 0.24, 0.3], [0.22, 0.02, 0.02], '#deb28d');
    const id = this.inventory[this.selected]?.id;
    if (!id || !ITEMS[id]) return;
    if (ITEMS[id].kind === 'tool') {
      const tool = new THREE.Group();
      tool.position.set(0.05, 0.1, -0.1);
      tool.rotation.z = -0.65;
      this.held.add(tool);
      box(tool, [0.095, 0.7, 0.09], [0, 0, 0], '#95683d');
      box(tool, [0.12, 0.1, 0.12], [0, -0.27, 0], '#76502f');
      if (id === BLOCK.AXE) {
        box(tool, [0.37, 0.22, 0.11], [-0.08, 0.29, 0], '#bc9260');
        box(tool, [0.16, 0.32, 0.11], [-0.22, 0.27, 0], '#d0ab77');
      } else {
        box(tool, [0.53, 0.12, 0.11], [0, 0.32, 0], '#c29a68');
        box(tool, [0.12, 0.2, 0.11], [-0.23, 0.26, 0], '#d0ad78');
        box(tool, [0.12, 0.2, 0.11], [0.23, 0.26, 0], '#b58b5d');
      }
    } else {
      const info = ITEMS[id];
      const colors = [info.right, info.left, info.top, info.left, info.right, info.left];
      const materials = colors.map((color) => new THREE.MeshLambertMaterial({ color, depthTest: false, depthWrite: false, transparent: true }));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), materials);
      mesh.position.set(0.02, 0.13, -0.1);
      mesh.rotation.set(0.15, 0.55, -0.08);
      mesh.renderOrder = 100;
      this.held.add(mesh);
    }
  }

  private notify(message: string) {
    this.toast = message;
    this.toastUntil = this.elapsed + 3.5;
    this.toastId++;
    this.emit();
  }

  private emit() {
    if (this.disposed) return;
    this.onChange({
      ready: this.ready,
      playing: this.playing,
      started: this.started,
      touch: this.touch,
      inventory: this.inventory.map((slot) => slot ? { ...slot } : null),
      selected: this.selected,
      health: this.health,
      time: clockString(this.minutes),
      day: Math.floor(this.minutes / 1440) + 1,
      isNight: this.minutes % 1440 >= 19 * 60 || this.minutes % 1440 < 6 * 60,
      weather: this.weather,
      biome: biomeAt(Math.floor(this.player.x), Math.floor(this.player.z), this.seed),
      coordinates: [Math.floor(this.player.x), Math.floor(this.player.y), Math.floor(this.player.z)],
      sound: this.audio.enabled,
      target: this.animalHit ? 'Friendly sheep' : this.currentHit ? (ITEMS[this.currentHit.id]?.name ?? '') : '',
      breakProgress: Math.min(1, this.mineProgress),
      quest: { ...this.quest },
      toast: this.elapsed < this.toastUntil ? this.toast : '',
      toastId: this.toastId,
      underwater: this.underwater,
    });
  }

  private save = () => {
    if (this.disposed || this.discardSave || !this.world) return;
    const data: SaveData = {
      version: 1,
      seed: this.seed,
      edits: this.world.edits,
      inventory: this.inventory,
      selected: this.selected,
      position: [this.player.x, this.player.y, this.player.z],
      yaw: this.yaw,
      pitch: this.pitch,
      minutes: this.minutes,
      health: this.health,
      quest: this.quest,
      weather: this.weather,
      sound: this.audio.enabled,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch { /* The game remains playable without storage. */ }
  };

  dispose() {
    this.save();
    this.disposed = true;
    cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
    window.removeEventListener('pointerup', this.pointerUp);
    window.removeEventListener('pagehide', this.save);
    document.removeEventListener('visibilitychange', this.visibilityChange);
    document.removeEventListener('pointerlockchange', this.pointerLockChange);
    document.removeEventListener('mousemove', this.mouseMove);
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('pointermove', this.pointerMove);
    this.canvas.removeEventListener('contextmenu', this.preventContext);
    this.canvas.removeEventListener('wheel', this.wheel);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.environment.dispose();
    this.creatures.dispose();
    this.world.dispose();
    this.audio.dispose();
    this.outline.geometry.dispose();
    (this.outline.material as THREE.Material).dispose();
    this.held.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.particleGeometry.dispose();
    this.particleMaterials.forEach((material) => material.dispose());
    this.renderer.dispose();
    this.canvas.remove();
  }
}