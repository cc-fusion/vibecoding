import * as THREE from 'three';
import { Block, INITIAL_INVENTORY, ITEMS, RECIPES, blockName, createAtlas, createItemIcons, isPlant, isSolid, itemForBlock } from './blocks';
import { GameAudio } from './audio';
import { addToInventory, cloneInventory, craft } from './inventory';
import { Scenery } from './scenery';
import type { GameCallbacks, GameSnapshot, GameStats, ItemStack, SavedGame } from './types';
import { VoxelWorld, WORLD_HEIGHT } from './world';

const SAVE_KEY = 'wilds-sandbox-world-v1';
const NEXT_SEED_KEY = 'wilds-next-seed';
const PLAYER_WIDTH = 0.3;
const PLAYER_HEIGHT = 1.8;
const EYE_HEIGHT = 1.62;

interface RayHit {
  x: number;
  y: number;
  z: number;
  normal: [number, number, number];
  block: Block;
}

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

function readSave(): SavedGame | null {
  try {
    if (localStorage.getItem(NEXT_SEED_KEY)) return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw) as SavedGame;
    if (save.version !== 1 || !Number.isFinite(save.seed) || !Array.isArray(save.position) || !Array.isArray(save.inventory)) return null;
    return save;
  } catch { return null; }
}

function initialSeed(): number {
  try {
    const seed = Number(localStorage.getItem(NEXT_SEED_KEY));
    if (seed) { localStorage.removeItem(NEXT_SEED_KEY); localStorage.removeItem(SAVE_KEY); return seed; }
  } catch { /* Use the default seed if storage is unavailable. */ }
  return 76483;
}

export function createNewWorld() {
  try {
    localStorage.removeItem(SAVE_KEY);
    localStorage.setItem(NEXT_SEED_KEY, String(Math.floor(Math.random() * 900000) + 10000));
  } finally { window.location.reload(); }
}

export class VoxelGame {
  readonly icons: Record<string, string>;
  readonly touchMode: boolean;
  private host: HTMLElement;
  private callbacks: GameCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private world: VoxelWorld;
  private scenery: Scenery;
  private texture: THREE.CanvasTexture;
  private audio = new GameAudio();
  private inventory: (ItemStack | null)[];
  private selected = 0;
  private position = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private yaw = 0;
  private pitch = -0.09;
  private onGround = false;
  private keys = new Set<string>();
  private active = false;
  private jumpQueued = false;
  private mouseDown = false;
  private hit: RayHit | null = null;
  private breaking = 0;
  private breakingKey = '';
  private outline: THREE.LineSegments;
  private hand: THREE.Group;
  private heldBlock: THREE.Mesh;
  private heldTool: THREE.Group;
  private swing = 0;
  private walkPhase = 0;
  private stepTimer = 0;
  private health = 10;
  private damageCooldown = 0;
  private time = 0.39;
  private weather: 'Clear' | 'Rain' = 'Clear';
  private weatherTimer = 0;
  private stats: GameStats = { mined: 0, logs: 0, placed: 0, crafted: 0 };
  private particles: Particle[] = [];
  private particleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private particleMaterials = new Map<string, THREE.MeshLambertMaterial>();
  private lastFrame = 0;
  private pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  private frameAverage = 16;
  private qualityTimer = 0;
  private snapshotTimer = 0;
  private saveTimer = 0;
  private saved = true;
  private animationFrame = 0;
  private disposed = false;
  private touchId: number | null = null;
  private touchX = 0;
  private touchY = 0;
  private ignoreMouseUntil = 0;
  private lastInventoryFull = 0;
  private saveFailed = false;
  private torchLights: THREE.PointLight[] = [];
  private torchTimer = 0;

  constructor(host: HTMLElement, callbacks: GameCallbacks) {
    this.host = host; this.callbacks = callbacks;
    this.touchMode = window.matchMedia('(pointer: coarse)').matches;
    const save = readSave();
    const seed = save?.seed ?? initialSeed();
    this.inventory = save?.inventory?.length === 27
      ? save.inventory.map(stack => stack && ITEMS[stack.id] && Number.isFinite(stack.count) && stack.count > 0 ? { id: stack.id, count: Math.min(ITEMS[stack.id].tool ? 1 : 64, Math.floor(stack.count)) } : null)
      : cloneInventory(INITIAL_INVENTORY);
    this.selected = Math.max(0, Math.min(8, save?.selected ?? 0));
    this.time = Number.isFinite(save?.time) ? save!.time : 0.39;
    this.health = Number.isFinite(save?.health) ? THREE.MathUtils.clamp(save!.health, 1, 10) : 10;
    this.stats = { ...this.stats, ...(save?.stats ?? {}) };
    this.audio.enabled = save?.sound ?? true;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor('#bcd8cb');
    this.renderer.domElement.className = 'world-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'Voxel world. Use the keyboard and mouse to explore.');
    host.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, host.clientWidth / Math.max(1, host.clientHeight), 0.05, 500);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    const atlas = createAtlas(); this.texture = atlas.texture; this.icons = createItemIcons(atlas.canvas);
    this.world = new VoxelWorld(this.scene, this.texture, seed, save?.edits ?? {});
    const validPosition = save?.position?.length === 3 && save.position.every(Number.isFinite);
    if (validPosition) this.position.fromArray(save!.position);
    else this.position.set(0.5, this.world.terrainHeight(0, 7) + 1.02, 7.5);
    if (save?.rotation?.length === 2 && save.rotation.every(Number.isFinite)) {
      this.yaw = save.rotation[0]; this.pitch = THREE.MathUtils.clamp(save.rotation[1], -1.5, 1.5);
    }
    this.world.initialize(this.position.x, this.position.z);
    this.scenery = new Scenery(this.scene, this.world);
    for (let i = 0; i < 4; i++) {
      const light = new THREE.PointLight('#ffd08a', 12, 9, 2);
      light.visible = false; this.torchLights.push(light); this.scene.add(light);
    }
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008, 1.008, 1.008)), new THREE.LineBasicMaterial({ color: '#fffbed', transparent: true, opacity: 0.85, depthTest: false }));
    this.outline.renderOrder = 5; this.outline.visible = false; this.scene.add(this.outline);

    this.hand = new THREE.Group();
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.48), new THREE.MeshBasicMaterial({ color: '#627c65', depthTest: false }));
    sleeve.position.set(0.13, -0.13, 0.12); sleeve.rotation.x = -0.25;
    const handSkin = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.27, 0.27), new THREE.MeshBasicMaterial({ color: '#d9b28c', depthTest: false }));
    handSkin.position.set(0.1, -0.02, -0.12);
    this.heldBlock = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.27, 0.27), new THREE.MeshBasicMaterial({ color: '#bd9869', depthTest: false }));
    this.heldBlock.position.set(-0.02, 0.08, -0.22); this.heldBlock.rotation.set(0.2, 0.4, 0);
    this.heldTool = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.34, 0.045), new THREE.MeshBasicMaterial({ color: '#8d6542', depthTest: false }));
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.06, 0.055), new THREE.MeshBasicMaterial({ color: '#bb9166', depthTest: false }));
    head.position.y = 0.15; this.heldTool.add(handle, head); this.heldTool.position.set(0.02, 0.12, -0.22); this.heldTool.rotation.z = -0.6;
    this.hand.add(sleeve, handSkin, this.heldBlock, this.heldTool);
    this.hand.position.set(0.61, -0.52, -1.15); this.hand.scale.setScalar(0.48); this.hand.traverse(child => { child.renderOrder = 100; });
    this.camera.add(this.hand); this.hand.visible = false;
    this.updateHeldItem();
    this.syncCamera();
    this.scenery.update(0, this.time, this.camera);
    this.renderer.render(this.scene, this.camera);

    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('contextmenu', this.onContextMenu);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.renderer.domElement.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.renderer.domElement.addEventListener('touchend', this.onTouchEnd);
    this.emitSnapshot();
    queueMicrotask(() => { if (!this.disposed) this.callbacks.onReady(); });
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  lock() {
    this.audio.start();
    if (this.touchMode) {
      this.active = true; this.hand.visible = true; this.callbacks.onLockChange(true); return;
    }
    const request = this.renderer.domElement.requestPointerLock();
    if (request && typeof request.catch === 'function') request.catch(() => this.callbacks.onToast('Unable to capture pointer', 'Click the world to try again.'));
  }

  unlock() {
    if (this.touchMode) {
      this.active = false; this.hand.visible = false; this.keys.clear(); this.mouseDown = false; this.callbacks.onLockChange(false);
    } else if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
  }

  private onPointerLockChange = () => {
    if (this.touchMode) return;
    this.active = document.pointerLockElement === this.renderer.domElement;
    this.hand.visible = this.active;
    if (this.active) this.ignoreMouseUntil = performance.now() + 200;
    if (!this.active) { this.keys.clear(); this.mouseDown = false; this.breaking = 0; }
    this.callbacks.onLockChange(this.active);
  };

  private onResize = () => {
    const width = this.host.clientWidth, height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix();
    this.pixelRatio = Math.min(this.pixelRatio, window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(width, height);
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.code === 'KeyE' && !event.repeat) { event.preventDefault(); this.callbacks.onInventory(); return; }
    if (!this.active) return;
    if (event.code === 'Escape' || event.code === 'KeyP') { event.preventDefault(); this.unlock(); return; }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.code === 'Space' && !event.repeat) this.jumpQueued = true;
    if (/^Digit[1-9]$/.test(event.code)) this.select(Number(event.code.slice(5)) - 1);
  };

  private onKeyUp = (event: KeyboardEvent) => { this.keys.delete(event.code); };
  private onBlur = () => { this.keys.clear(); this.mouseDown = false; };
  private onBeforeUnload = () => { this.save(); };
  private onContextMenu = (event: MouseEvent) => { if (this.active) event.preventDefault(); };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.active || this.touchMode || performance.now() < this.ignoreMouseUntil) return;
    this.yaw -= THREE.MathUtils.clamp(event.movementX, -150, 150) * 0.0022;
    this.pitch = THREE.MathUtils.clamp(this.pitch - THREE.MathUtils.clamp(event.movementY, -150, 150) * 0.0022, -1.52, 1.52);
  };

  private onMouseDown = (event: MouseEvent) => {
    if (!this.active || this.touchMode) return;
    if (event.button === 0) { this.mouseDown = true; this.swing = 1; }
    if (event.button === 2) { event.preventDefault(); this.placeBlock(); }
  };

  private onMouseUp = (event: MouseEvent) => {
    if (event.button === 0) { this.mouseDown = false; this.breaking = 0; this.breakingKey = ''; }
  };

  private onWheel = (event: WheelEvent) => {
    if (!this.active) return;
    event.preventDefault(); this.select((this.selected + (event.deltaY > 0 ? 1 : 8)) % 9);
  };

  private onTouchStart = (event: TouchEvent) => {
    if (!this.active || !this.touchMode || this.touchId !== null) return;
    const touch = event.changedTouches[0]; this.touchId = touch.identifier; this.touchX = touch.clientX; this.touchY = touch.clientY; event.preventDefault();
  };
  private onTouchMove = (event: TouchEvent) => {
    if (!this.active || this.touchId === null) return;
    for (const touch of Array.from(event.changedTouches)) if (touch.identifier === this.touchId) {
      this.yaw -= (touch.clientX - this.touchX) * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (touch.clientY - this.touchY) * 0.005, -1.52, 1.52);
      this.touchX = touch.clientX; this.touchY = touch.clientY; event.preventDefault();
    }
  };
  private onTouchEnd = (event: TouchEvent) => {
    if (Array.from(event.changedTouches).some(touch => touch.identifier === this.touchId)) this.touchId = null;
  };

  touchControl(action: 'forward' | 'back' | 'left' | 'right' | 'jump' | 'mine' | 'place', down: boolean) {
    if (!this.active) return;
    const codes: Record<string, string> = { forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space' };
    if (codes[action]) {
      if (down) this.keys.add(codes[action]); else this.keys.delete(codes[action]);
      if (action === 'jump' && down) this.jumpQueued = true;
    } else if (action === 'mine') {
      this.mouseDown = down; if (down) this.swing = 1; else { this.breaking = 0; this.breakingKey = ''; }
    } else if (action === 'place' && down) this.placeBlock();
  }

  select(index: number) {
    if (index < 0 || index > 8) return;
    this.selected = index; this.audio.play('select'); this.updateHeldItem(); this.emitSnapshot();
  }

  swapSlots(first: number, second: number) {
    if (first < 0 || first >= this.inventory.length || second < 0 || second >= this.inventory.length) return;
    [this.inventory[first], this.inventory[second]] = [this.inventory[second], this.inventory[first]];
    this.saved = false; this.audio.play('select'); this.updateHeldItem(); this.emitSnapshot();
  }

  discardSlot(index: number) {
    if (index < 0 || index >= this.inventory.length || !this.inventory[index]) return;
    const name = ITEMS[this.inventory[index]!.id].name;
    this.inventory[index] = null; this.saved = false; this.audio.play('select');
    this.updateHeldItem(); this.emitSnapshot(); this.callbacks.onToast('A little more room', `${name} removed from your pack.`);
  }

  craft(recipeId: string) {
    if (!craft(this.inventory, recipeId)) {
      this.callbacks.onToast('Not enough room or materials', 'Make space in your pack and try again.'); return;
    }
    this.stats.crafted++; this.saved = false; this.audio.play('craft'); this.updateHeldItem();
    const recipe = RECIPES.find(entry => entry.id === recipeId)!;
    this.callbacks.onToast(this.stats.crafted === 1 ? 'Made by you' : 'Crafted', `${recipe.count} ${ITEMS[recipe.output].name} added to your pack.`);
    this.emitSnapshot();
  }

  toggleSound() { this.audio.enabled = !this.audio.enabled; if (this.audio.enabled) this.audio.start(); this.saved = false; this.emitSnapshot(); }
  toggleWeather() { this.weather = this.weather === 'Clear' ? 'Rain' : 'Clear'; this.scenery.setWeather(this.weather); this.weatherTimer = 0; this.emitSnapshot(); }

  private updateHeldItem() {
    const item = this.inventory[this.selected] ? ITEMS[this.inventory[this.selected]!.id] : null;
    this.heldBlock.visible = !!item && !item.tool;
    this.heldTool.visible = !!item?.tool;
    if (item) (this.heldBlock.material as THREE.MeshBasicMaterial).color.set(item.color);
    if (item?.tool) ((this.heldTool.children[1] as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(item.tool === 'stone' ? '#9da69e' : '#bb9166');
  }

  private animate = (now: number) => {
    if (this.disposed) return;
    const rawDelta = this.lastFrame ? (now - this.lastFrame) / 1000 : 0;
    const dt = Math.min(rawDelta, 0.12);
    this.lastFrame = now;
    if (rawDelta > 0 && rawDelta < 1 && document.visibilityState === 'visible') {
      this.frameAverage = this.frameAverage * 0.95 + rawDelta * 1000 * 0.05;
      this.qualityTimer += rawDelta;
      if (this.qualityTimer > 5) {
        this.qualityTimer = 0;
        const ceiling = Math.min(window.devicePixelRatio || 1, 1.5);
        const next = this.frameAverage > 70 ? Math.max(0.65, this.pixelRatio * 0.8) : this.frameAverage < 25 ? Math.min(ceiling, this.pixelRatio + 0.1) : this.pixelRatio;
        if (next !== this.pixelRatio) { this.pixelRatio = next; this.renderer.setPixelRatio(next); }
      }
    }
    if (this.active) {
      this.time += dt / 600;
      this.weatherTimer += dt;
      if (this.weatherTimer > 210) {
        this.weatherTimer = 0;
        if (Math.random() > 0.45) { this.weather = this.weather === 'Clear' ? 'Rain' : 'Clear'; this.scenery.setWeather(this.weather); }
      }
      this.updatePlayer(dt);
      this.syncCamera();
      this.updateTarget(dt);
    } else this.syncCamera();
    this.world.update(this.position.x, this.position.z);
    this.torchTimer += dt;
    if (this.torchTimer > 0.5) { this.torchTimer = 0; this.updateTorchLights(); }
    this.scenery.update(dt, this.time, this.camera);
    this.updateParticles(dt);
    this.swing = Math.max(0, this.swing - dt * 3.5);
    this.hand.rotation.x = -Math.sin(this.swing * Math.PI) * 0.65;
    this.hand.position.y = -0.52 + (this.active && this.onGround ? Math.sin(this.walkPhase * 2) * 0.008 : 0);
    this.renderer.render(this.scene, this.camera);
    this.snapshotTimer += dt; this.saveTimer += dt;
    if (this.snapshotTimer > 0.15) { this.snapshotTimer = 0; this.emitSnapshot(); }
    if (this.saveTimer > 12) { this.saveTimer = 0; this.save(); }
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private syncCamera() {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.updateMatrixWorld();
  }

  private updatePlayer(dt: number) {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const strafe = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const input = new THREE.Vector2(strafe, forward);
    if (input.lengthSq() > 1) input.normalize();
    const swimming = this.world.getBlock(this.position.x, this.position.y + 0.8, this.position.z) === Block.Water;
    const speed = swimming ? 2.8 : this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 6.4 : 4.3;
    const targetX = (Math.cos(this.yaw) * input.x - Math.sin(this.yaw) * input.y) * speed;
    const targetZ = (-Math.sin(this.yaw) * input.x - Math.cos(this.yaw) * input.y) * speed;
    const acceleration = Math.min(1, dt * (this.onGround ? 14 : 6));
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, targetX, acceleration);
    this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, targetZ, acceleration);
    if (this.jumpQueued && this.onGround && !swimming) { this.velocity.y = 8; this.onGround = false; this.audio.play('jump'); }
    this.jumpQueued = false;
    if (swimming) {
      this.velocity.y = Math.max(-2.8, this.velocity.y - 5 * dt);
      if (this.keys.has('Space')) this.velocity.y = Math.min(4.2, this.velocity.y + 15 * dt);
    } else this.velocity.y = Math.max(-35, this.velocity.y - 22 * dt);
    this.moveAxis('x', this.velocity.x * dt);
    this.moveAxis('z', this.velocity.z * dt);
    const fallingSpeed = this.velocity.y;
    this.onGround = false;
    this.moveAxis('y', this.velocity.y * dt);
    if (this.onGround && fallingSpeed < -12 && this.damageCooldown <= 0) {
      this.health -= Math.max(1, Math.floor((-fallingSpeed - 10) / 3));
      this.damageCooldown = 1; this.audio.play('hurt');
      if (this.health <= 0) this.respawn();
      else this.callbacks.onToast('Watch your step', 'A softer landing next time.');
    }
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    const moving = input.lengthSq() > 0 && this.onGround;
    if (moving) {
      this.walkPhase += dt * speed * 1.7; this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.audio.play('step'); this.stepTimer = speed > 5 ? 0.31 : 0.43; }
    } else this.stepTimer = 0;
    if (this.position.y < -10 || this.position.y > WORLD_HEIGHT + 80) this.respawn();
  }

  private collides(x: number, y: number, z: number): boolean {
    const epsilon = 0.0001;
    for (let bx = Math.floor(x - PLAYER_WIDTH + epsilon); bx <= Math.floor(x + PLAYER_WIDTH - epsilon); bx++) {
      for (let by = Math.floor(y + epsilon); by <= Math.floor(y + PLAYER_HEIGHT - epsilon); by++) {
        for (let bz = Math.floor(z - PLAYER_WIDTH + epsilon); bz <= Math.floor(z + PLAYER_WIDTH - epsilon); bz++) {
          if (isSolid(this.world.getBlock(bx, by, bz))) return true;
        }
      }
    }
    return false;
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number) {
    if (!amount) return;
    const steps = Math.ceil(Math.abs(amount) / 0.18), step = amount / steps;
    for (let i = 0; i < steps; i++) {
      this.position[axis] += step;
      if (this.collides(this.position.x, this.position.y, this.position.z)) {
        this.position[axis] -= step;
        let low = 0, high = 1;
        for (let j = 0; j < 9; j++) {
          const middle = (low + high) / 2; this.position[axis] += step * middle;
          const blocked = this.collides(this.position.x, this.position.y, this.position.z);
          this.position[axis] -= step * middle;
          if (blocked) high = middle; else low = middle;
        }
        this.position[axis] += step * low;
        if (axis === 'y' && step < 0) this.onGround = true;
        this.velocity[axis] = 0; return;
      }
    }
  }

  private respawn() {
    this.world.ensureAt(0, 7);
    let ground = this.world.terrainHeight(0, 7);
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(this.world.getBlock(0, y, 7))) { ground = y; break; }
    }
    this.position.set(0.5, ground + 1.02, 7.5);
    this.velocity.set(0, 0, 0); this.health = 10; this.damageCooldown = 2;
    this.callbacks.onToast('A fresh start', 'You woke up back in the meadow, with your pack intact.');
  }

  private trace(): RayHit | null {
    const origin = this.camera.position;
    const direction = new THREE.Vector3(); this.camera.getWorldDirection(direction);
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const sx = Math.sign(direction.x), sy = Math.sign(direction.y), sz = Math.sign(direction.z);
    const deltaX = direction.x === 0 ? Infinity : Math.abs(1 / direction.x);
    const deltaY = direction.y === 0 ? Infinity : Math.abs(1 / direction.y);
    const deltaZ = direction.z === 0 ? Infinity : Math.abs(1 / direction.z);
    let maxX = direction.x === 0 ? Infinity : direction.x > 0 ? (x + 1 - origin.x) * deltaX : (origin.x - x) * deltaX;
    let maxY = direction.y === 0 ? Infinity : direction.y > 0 ? (y + 1 - origin.y) * deltaY : (origin.y - y) * deltaY;
    let maxZ = direction.z === 0 ? Infinity : direction.z > 0 ? (z + 1 - origin.z) * deltaZ : (origin.z - z) * deltaZ;
    let normal: [number, number, number] = [0, 0, 0], distance = 0;
    for (let i = 0; i < 64 && distance <= 6; i++) {
      const block = this.world.getBlock(x, y, z);
      if (block !== Block.Air && block !== Block.Water) return { x, y, z, normal, block };
      if (maxX < maxY && maxX < maxZ) { x += sx; distance = maxX; maxX += deltaX; normal = [-sx, 0, 0]; }
      else if (maxY < maxZ) { y += sy; distance = maxY; maxY += deltaY; normal = [0, -sy, 0]; }
      else { z += sz; distance = maxZ; maxZ += deltaZ; normal = [0, 0, -sz]; }
    }
    return null;
  }

  private updateTarget(dt: number) {
    this.hit = this.trace();
    this.outline.visible = !!this.hit;
    if (!this.hit) { this.breaking = 0; this.breakingKey = ''; return; }
    this.outline.position.set(this.hit.x + 0.5, this.hit.y + 0.5, this.hit.z + 0.5);
    if (!this.mouseDown) { this.breaking = 0; this.breakingKey = ''; return; }
    const key = `${this.hit.x},${this.hit.y},${this.hit.z}`;
    if (this.breakingKey !== key) { this.breaking = 0; this.breakingKey = key; }
    const item = this.inventory[this.selected] ? ITEMS[this.inventory[this.selected]!.id] : null;
    let duration = 0.45;
    if (this.hit.block === Block.Stone || this.hit.block === Block.Cobble || this.hit.block === Block.CoalOre || this.hit.block === Block.Bricks) duration = item?.tool === 'stone' ? 0.35 : item?.tool === 'wood' ? 0.62 : 1.55;
    if (this.hit.block === Block.Log || this.hit.block === Block.Planks || this.hit.block === Block.Crafting) duration = 0.65;
    if (this.hit.block === Block.Leaves || isPlant(this.hit.block)) duration = 0.16;
    this.breaking += dt / duration;
    if (this.breaking >= 1) { this.mineBlock(this.hit); this.breaking = 0; this.breakingKey = ''; this.swing = 1; }
  }

  private mineBlock(hit: RayHit) {
    const drop = itemForBlock(hit.block);
    if (drop && !addToInventory(this.inventory, drop, 1)) {
      if (performance.now() - this.lastInventoryFull > 2000) { this.callbacks.onToast('Your pack is full', 'Make some room before gathering more.'); this.lastInventoryFull = performance.now(); }
      this.mouseDown = false; return;
    }
    if (!this.world.setBlock(hit.x, hit.y, hit.z, Block.Air)) return;
    const above = this.world.getBlock(hit.x, hit.y + 1, hit.z);
    if (isPlant(above)) this.world.setBlock(hit.x, hit.y + 1, hit.z, Block.Air);
    this.spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, ITEMS[drop ?? 'leaves']?.color ?? '#8dab69');
    this.stats.mined++; this.saved = false; this.audio.play('break');
    if (hit.block === Block.Log && ++this.stats.logs === 1) this.callbacks.onToast('A good beginning', 'Your first log is in your pack. Try crafting planks with E.');
    this.updateHeldItem(); this.emitSnapshot();
  }

  private placeBlock() {
    const hit = this.trace();
    const stack = this.inventory[this.selected];
    const item = stack ? ITEMS[stack.id] : null;
    if (!hit || !stack || item?.block === undefined) return;
    const x = hit.x + hit.normal[0], y = hit.y + hit.normal[1], z = hit.z + hit.normal[2];
    const existing = this.world.getBlock(x, y, z);
    if (existing !== Block.Air && existing !== Block.Water && !isPlant(existing)) return;
    if (isPlant(item.block) && !isSolid(this.world.getBlock(x, y - 1, z))) return;
    if (isSolid(item.block) && x < this.position.x + PLAYER_WIDTH && x + 1 > this.position.x - PLAYER_WIDTH && y < this.position.y + PLAYER_HEIGHT && y + 1 > this.position.y && z < this.position.z + PLAYER_WIDTH && z + 1 > this.position.z - PLAYER_WIDTH) return;
    if (!this.world.setBlock(x, y, z, item.block)) return;
    stack.count--; if (stack.count <= 0) this.inventory[this.selected] = null;
    this.stats.placed++; this.saved = false; this.audio.play('place'); this.swing = 1;
    if (this.stats.placed === 5) this.callbacks.onToast('Making it yours', 'Five blocks placed. This little world is taking shape.');
    this.updateHeldItem(); this.emitSnapshot();
  }

  private spawnParticles(x: number, y: number, z: number, color: string) {
    let material = this.particleMaterials.get(color);
    if (!material) { material = new THREE.MeshLambertMaterial({ color }); this.particleMaterials.set(color, material); }
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, material);
      mesh.position.set(x + (Math.random() - 0.5) * 0.5, y + (Math.random() - 0.5) * 0.5, z + (Math.random() - 0.5) * 0.5);
      mesh.scale.setScalar(0.6 + Math.random() * 0.8); this.scene.add(mesh);
      const life = 0.45 + Math.random() * 0.4;
      this.particles.push({ mesh, velocity: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3.5 + 1, (Math.random() - 0.5) * 3), life, maxLife: life });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i]; particle.life -= dt;
      if (particle.life <= 0) { this.scene.remove(particle.mesh); this.particles.splice(i, 1); continue; }
      particle.velocity.y -= 10 * dt;
      particle.mesh.position.addScaledVector(particle.velocity, dt);
      particle.mesh.rotation.x += dt * 3; particle.mesh.rotation.y += dt * 4;
      particle.mesh.scale.multiplyScalar(Math.max(0.8, 1 - dt / particle.maxLife));
    }
  }

  private updateTorchLights() {
    const torches = Object.entries(this.world.edits)
      .filter(([, block]) => block === Block.Torch)
      .map(([key]) => key.split(',').map(Number))
      .filter(([x, y, z]) => (x - this.position.x) ** 2 + (y - this.position.y) ** 2 + (z - this.position.z) ** 2 < 20 ** 2)
      .sort((a, b) => (a[0] - this.position.x) ** 2 + (a[2] - this.position.z) ** 2 - ((b[0] - this.position.x) ** 2 + (b[2] - this.position.z) ** 2));
    this.torchLights.forEach((light, i) => {
      const position = torches[i]; light.visible = !!position;
      if (position) light.position.set(position[0] + 0.5, position[1] + 0.7, position[2] + 0.5);
    });
  }

  private emitSnapshot() {
    const hour = Math.floor((this.time % 1) * 24);
    const minute = Math.floor(((this.time % 1) * 24 - hour) * 60);
    const snapshot: GameSnapshot = {
      inventory: cloneInventory(this.inventory), selected: this.selected, health: this.health,
      day: Math.floor(this.time) + 1, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
      biome: this.world.biomeAt(this.position.x, this.position.z), weather: this.weather,
      coordinates: [Math.floor(this.position.x), Math.floor(this.position.y), Math.floor(this.position.z)],
      target: this.active && this.hit ? blockName(this.hit.block) : '', breaking: this.breaking,
      stats: { ...this.stats }, sound: this.audio.enabled, saved: this.saved,
    };
    this.callbacks.onSnapshot(snapshot);
  }

  save() {
    const save: SavedGame = {
      version: 1, seed: this.world.seed, edits: this.world.edits,
      position: [this.position.x, this.position.y, this.position.z], rotation: [this.yaw, this.pitch],
      inventory: cloneInventory(this.inventory), selected: this.selected, time: this.time,
      health: this.health, stats: { ...this.stats }, sound: this.audio.enabled,
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); this.saved = true; this.saveFailed = false; }
    catch {
      this.saved = false;
      if (!this.saveFailed) this.callbacks.onToast('Could not save your world', 'Check that this browser allows local storage.');
      this.saveFailed = true;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.save(); this.disposed = true; cancelAnimationFrame(this.animationFrame);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    window.removeEventListener('resize', this.onResize); window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur); window.removeEventListener('mousedown', this.onMouseDown); window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('wheel', this.onWheel); window.removeEventListener('contextmenu', this.onContextMenu); window.removeEventListener('beforeunload', this.onBeforeUnload);
    document.removeEventListener('mousemove', this.onMouseMove); document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('touchstart', this.onTouchStart); this.renderer.domElement.removeEventListener('touchmove', this.onTouchMove); this.renderer.domElement.removeEventListener('touchend', this.onTouchEnd);
    this.world.dispose(); this.scenery.dispose(); this.audio.dispose(); this.texture.dispose();
    this.torchLights.forEach(light => this.scene.remove(light));
    this.outline.geometry.dispose(); (this.outline.material as THREE.Material).dispose();
    this.hand.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
    });
    this.particleGeometry.dispose(); this.particleMaterials.forEach(material => material.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}