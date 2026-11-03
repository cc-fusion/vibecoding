import * as THREE from 'three';
import { B, BLOCKS, RECIPES, createAtlas, getQuests, isPlant, isSolid } from './blocks';
import { GameAudio } from './audio';
import { CHUNK, HEIGHT, SEA, VoxelWorld, chunkKey } from './world';
import { persistWorld } from './storage';
import type { GameSnapshot, Recipe, Screen, Settings, Stats, Target, Toast, Weather, WorldSave } from './types';

interface Callbacks {
  snapshot: (snapshot: GameSnapshot) => void;
  notify: (toast: Omit<Toast, 'id'>) => void;
  screen: (screen: Screen) => void;
  pointer: (locked: boolean) => void;
}
interface Particle { position: THREE.Vector3; velocity: THREE.Vector3; life: number; max: number; color: THREE.Color; }
interface Sheep { group: THREE.Group; legs: THREE.Mesh[]; direction: number; timer: number; moving: boolean; phase: number; }

const UP = new THREE.Vector3(0, 1, 0);
const DAY_LENGTH = 1080;
const PLAYER_HEIGHT = 1.78;
const EYE_HEIGHT = 1.61;
const HALF_WIDTH = 0.28;

export class GameEngine {
  readonly world: VoxelWorld;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.05, 520);
  readonly audio = new GameAudio();
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();
  readonly inventory: Record<number, number>;
  readonly hotbar: number[];
  readonly stats: Stats;
  settings: Settings;
  saveData: WorldSave;
  selected: number;
  yaw: number;
  pitch: number;
  health: number;
  stamina = 100;
  air = 10;
  time: number;
  day: number;
  weather: Weather = 'clear';
  active = false;
  ready = false;
  flying = false;
  target: Target | null = null;
  mining = 0;
  savedAt = 0;
  private callbacks: Callbacks;
  private disposed = false;
  private keys = new Set<string>();
  private grounded = false;
  private inWater = false;
  private underwater = false;
  private mouseDown = false;
  private placing = false;
  private miningKey = '';
  private lastPlace = 0;
  private lastDamage = -30;
  private lastStep = 0;
  private elapsed = 0;
  private previousTime = 0;
  private accumulator = 0;
  private snapshotClock = 0;
  private saveClock = 0;
  private streamClock = 0;
  private atmosphereClock = 0;
  private weatherClock = 0;
  private fps = 60;
  private frameCount = 0;
  private frameClock = 0;
  private queue: [number, number][] = [];
  private initialChunks = 1;
  private lastChunk = '';
  private atlas = createAtlas();
  private opaque: THREE.MeshLambertMaterial;
  private water: THREE.MeshPhongMaterial;
  private glass: THREE.MeshLambertMaterial;
  private sun = new THREE.DirectionalLight(0xffedc3, 2.5);
  private shadowClock = 0;
  private distantTerrain: THREE.Mesh | null = null;
  private hemisphere = new THREE.HemisphereLight(0xdcebcf, 0x697054, 2.1);
  private sky: THREE.Mesh;
  private skyUniforms = {
    top: { value: new THREE.Color('#8bbfcd') },
    bottom: { value: new THREE.Color('#e4e5cd') },
  };
  private sunDisc: THREE.Mesh;
  private moonDisc: THREE.Mesh;
  private stars: THREE.Points;
  private clouds: THREE.InstancedMesh;
  private cloudOrigin: { x: number; y: number; z: number; sx: number; sy: number; sz: number }[] = [];
  private rain: THREE.LineSegments;
  private rainPositions = new Float32Array(720 * 6);
  private fireflies: THREE.Points;
  private fireflyPositions = new Float32Array(80 * 3);
  private sheep: Sheep[] = [];
  private birds: THREE.Group[] = [];
  private particles: Particle[] = [];
  private particleMesh: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private outline: THREE.LineSegments;
  private crack: THREE.Mesh;
  private crackTexture: THREE.CanvasTexture;
  private crackStage = -1;
  private hand = new THREE.Group();
  private heldItem = new THREE.Group();
  private heldId = -1;
  private swing = 0;
  private torchLights: THREE.PointLight[] = [];
  private torchClock = 0;
  private waterTime = { value: 0 };
  private listeners: (() => void)[] = [];
  private touchLast: [number, number] | null = null;
  private visibilityPaused = false;
  private mouseReadyAt = 0;
  private qualityClock = 0;
  private dragLookEnabled = false;

  constructor(container: HTMLElement, data: WorldSave, settings: Settings, callbacks: Callbacks) {
    this.callbacks = callbacks;
    this.saveData = structuredClone(data);
    this.settings = { ...settings };
    this.world = new VoxelWorld(data.seed, data.edits);
    this.inventory = { ...data.inventory };
    this.hotbar = [...data.hotbar];
    this.stats = structuredClone(data.stats);
    this.selected = data.selected;
    this.yaw = data.yaw;
    this.pitch = data.pitch;
    this.health = data.health || 20;
    this.time = data.time;
    this.day = data.day;
    const spawn: [number, number, number] = data.spawn || [24.5, this.world.column(24, 34).height + 1.02, 34.5];
    this.saveData.spawn = spawn;
    this.position.fromArray(data.position || spawn);
    if (this.collides(this.position)) this.position.fromArray(spawn);
    while (this.collides(this.position) && this.position.y < HEIGHT + 2) this.position.y += 1;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = settings.shadows;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.domElement.className = 'world-canvas';
    this.renderer.domElement.setAttribute('aria-label', 'The everwild voxel world. Enter your world to explore, mine, and build.');
    container.appendChild(this.renderer.domElement);
    this.camera.fov = settings.fov;
    this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    this.scene.fog = new THREE.Fog('#d1decd', settings.renderDistance * CHUNK * 0.5, settings.renderDistance * CHUNK - 3);
    this.opaque = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide });
    this.opaque.shadowSide = THREE.FrontSide;
    this.glass = new THREE.MeshLambertMaterial({ map: this.atlas, vertexColors: true, transparent: true, opacity: 0.39, depthWrite: false, side: THREE.DoubleSide });
    this.water = new THREE.MeshPhongMaterial({ color: '#5bb4b4', transparent: true, opacity: 0.76, shininess: 100, specular: '#82b6ad', side: THREE.DoubleSide, depthWrite: false });
    this.water.onBeforeCompile = shader => {
      shader.uniforms.uTime = this.waterTime;
      shader.vertexShader = 'uniform float uTime; varying vec3 vWaterPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vWaterPosition = (modelMatrix * vec4(position, 1.0)).xyz;\n transformed.y += sin(vWaterPosition.x * 0.7 + uTime) * 0.025 + cos(vWaterPosition.z * 0.65 + uTime * 0.8) * 0.025;');
      shader.fragmentShader = 'uniform float uTime; varying vec3 vWaterPosition;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n float ripple = sin(vWaterPosition.x * 2.5 + uTime * 0.8) * cos(vWaterPosition.z * 2.5 - uTime * 0.5);\n diffuseColor.rgb += smoothstep(0.90, 1.0, ripple) * 0.10;');
    };
    this.scene.add(this.hemisphere, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -39, right: 39, top: 39, bottom: -39, near: 1, far: 140 });
    this.sun.shadow.bias = -0.00035;
    this.sun.shadow.normalBias = 0.045;
    this.sun.shadow.camera.updateProjectionMatrix();
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, side: THREE.BackSide, depthWrite: false, toneMapped: false,
      vertexShader: 'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top;uniform vec3 bottom;varying vec3 vPosition;void main(){float h=normalize(vPosition).y;gl_FragColor=vec4(mix(bottom,top,pow(max(0.0,h),0.6)),1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(450, 24, 16), skyMaterial);
    this.scene.add(this.sky);
    this.sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(19, 19), new THREE.MeshBasicMaterial({ color: '#fff2bc', fog: false, side: THREE.DoubleSide }));
    this.moonDisc = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshBasicMaterial({ color: '#d5e4d8', fog: false, side: THREE.DoubleSide }));
    this.scene.add(this.sunDisc, this.moonDisc);
    const starPositions: number[] = [];
    for (let i = 0; i < 650; i++) {
      const theta = Math.random() * Math.PI * 2, y = Math.random() * 0.9 + 0.1;
      const radius = Math.sqrt(1 - y * y);
      starPositions.push(Math.cos(theta) * radius * 390, y * 390, Math.sin(theta) * radius * 390);
    }
    this.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3)), new THREE.PointsMaterial({ color: '#f4edd3', size: 0.75, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    this.scene.add(this.stars);
    this.clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: '#fff9e4', transparent: true, opacity: 0.94 }), 80);
    for (let i = 0; i < 20; i++) {
      const x = this.world.noise.hash(i, 4, 42) * 340 - 170;
      const z = this.world.noise.hash(i, 9, 23) * 340 - 170;
      const y = 66 + this.world.noise.hash(i, 3, 11) * 18;
      for (let n = 0; n < 4; n++) this.cloudOrigin.push({ x: x + n * 5 - 7, y: y + (n === 1 ? 1.1 : 0), z: z + (n % 2) * 3, sx: 8 + this.world.noise.hash(i, n, 87) * 7, sy: 2.1 + (n % 2), sz: 7 + (n % 3) * 2 });
    }
    this.clouds.frustumCulled = false;
    this.scene.add(this.clouds);
    const rainGeometry = new THREE.BufferGeometry();
    for (let i = 0; i < 720; i++) {
      this.rainPositions[i * 6] = Math.random() * 56 - 28;
      this.rainPositions[i * 6 + 1] = Math.random() * 32;
      this.rainPositions[i * 6 + 2] = Math.random() * 56 - 28;
    }
    rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));
    this.rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#ccdcd6', transparent: true, opacity: 0.4, depthWrite: false }));
    this.rain.frustumCulled = false; this.rain.visible = false;
    this.scene.add(this.rain);
    for (let i = 0; i < this.fireflyPositions.length; i++) this.fireflyPositions[i] = Math.random() * 40 - 20;
    this.fireflies = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(this.fireflyPositions, 3)), new THREE.PointsMaterial({ color: '#eff5ad', size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.fireflies.frustumCulled = false; this.scene.add(this.fireflies);
    this.particleMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), new THREE.MeshLambertMaterial(), 160);
    this.particleMesh.count = 0; this.particleMesh.frustumCulled = false; this.scene.add(this.particleMesh);
    this.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.006, 1.006, 1.006)), new THREE.LineBasicMaterial({ color: '#fff6da', transparent: true, opacity: 0.78, depthTest: true }));
    this.outline.visible = false; this.scene.add(this.outline);
    const crackCanvas = document.createElement('canvas'); crackCanvas.width = crackCanvas.height = 32;
    this.crackTexture = new THREE.CanvasTexture(crackCanvas); this.crackTexture.magFilter = THREE.NearestFilter;
    this.crack = new THREE.Mesh(new THREE.BoxGeometry(1.009, 1.009, 1.009), new THREE.MeshBasicMaterial({ map: this.crackTexture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.crack.visible = false; this.scene.add(this.crack);
    this.createHand(); this.createCreatures();
    for (let i = 0; i < 4; i++) { const light = new THREE.PointLight('#ffc176', 0, 10, 1.8); this.scene.add(light); this.torchLights.push(light); }
    this.audio.setVolume(settings.volume);
    this.bindEvents(); this.resize(); this.refreshQueue(); this.updateAtmosphere();
    this.renderer.setAnimationLoop(this.frame);
    this.emitSnapshot();
  }

  private listen(target: EventTarget, type: string, listener: EventListener, options?: AddEventListenerOptions) {
    target.addEventListener(type, listener, options);
    this.listeners.push(() => target.removeEventListener(type, listener, options));
  }

  private bindEvents() {
    this.listen(window, 'resize', () => this.resize());
    this.listen(this.renderer.domElement, 'webglcontextlost', event => { event.preventDefault(); this.pause(); this.notify('Graphics took a little pause. Your world is saved.', 'info'); });
    this.listen(this.renderer.domElement, 'webglcontextrestored', () => this.notify('Your world is back. Pick up where you left off.'));
    this.listen(document, 'contextmenu', e => { if (this.active && (document.pointerLockElement || e.target === this.renderer.domElement)) e.preventDefault(); });
    this.listen(document, 'pointerlockchange', () => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      if (locked) { this.mouseReadyAt = performance.now() + 180; this.dragLookEnabled = false; }
      if (!locked) { this.active = false; this.keys.clear(); this.mouseDown = false; this.placing = false; }
      this.callbacks.pointer(locked);
    });
    this.listen(window, 'blur', () => { this.keys.clear(); this.mouseDown = false; this.placing = false; if (this.active) this.pause(); });
    this.listen(document, 'visibilitychange', () => {
      this.visibilityPaused = document.hidden;
      if (document.hidden) { this.save(); if (this.active) this.pause(); }
      this.previousTime = 0;
    });
    this.listen(window, 'pagehide', () => this.save());
    this.listen(document, 'keydown', event => {
      const e = event as KeyboardEvent;
      if ((e.target as HTMLElement)?.matches('input, textarea, select')) return;
      if (!this.active) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        if (e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); this.callbacks.screen('inventory'); this.pause(false); return; }
        if (e.code === 'KeyJ') { e.preventDefault(); this.callbacks.screen('guide'); this.pause(false); return; }
        if (e.code === 'KeyF') this.toggleFlight();
        if (e.code === 'KeyR') this.interact();
        if (e.code === 'KeyQ') this.eat();
        if (e.code.startsWith('Digit')) { const n = Number(e.code.slice(5)); if (n >= 1 && n <= 9) this.select(n - 1); }
      }
      this.keys.add(e.code);
    });
    this.listen(document, 'keyup', event => this.keys.delete((event as KeyboardEvent).code));
    this.listen(document, 'mousemove', event => {
      const e = event as MouseEvent;
      if (!this.active || (document.pointerLockElement !== this.renderer.domElement && !(this.dragLookEnabled && e.buttons))) return;
      if (performance.now() < this.mouseReadyAt || Math.abs(e.movementX) > 350 || Math.abs(e.movementY) > 350) return;
      this.look(e.movementX, e.movementY);
    });
    this.listen(this.renderer.domElement, 'mousedown', event => {
      const e = event as MouseEvent;
      if (!this.active) return;
      if (!document.pointerLockElement && !this.touchLast && !this.dragLookEnabled) { this.play(); return; }
      if (e.button === 0) this.mouseDown = true;
      if (e.button === 2) { this.placing = true; this.place(); }
      if (e.button === 1 && this.target) { e.preventDefault(); this.assign(this.target.id); }
    });
    this.listen(window, 'mouseup', event => { if ((event as MouseEvent).button === 0) this.mouseDown = false; if ((event as MouseEvent).button === 2) this.placing = false; });
    this.listen(this.renderer.domElement, 'wheel', event => {
      if (!this.active) return;
      event.preventDefault(); this.select((this.selected + ((event as WheelEvent).deltaY > 0 ? 1 : 8)) % 9);
    }, { passive: false });
    this.listen(this.renderer.domElement, 'pointerdown', event => {
      const e = event as PointerEvent;
      if (e.pointerType === 'touch' && this.active) { this.touchLast = [e.clientX, e.clientY]; this.renderer.domElement.setPointerCapture(e.pointerId); }
    });
    this.listen(this.renderer.domElement, 'pointermove', event => {
      const e = event as PointerEvent;
      if (e.pointerType === 'touch' && this.touchLast && this.active) { this.look((e.clientX - this.touchLast[0]) * 1.8, (e.clientY - this.touchLast[1]) * 1.8); this.touchLast = [e.clientX, e.clientY]; }
    });
    this.listen(this.renderer.domElement, 'pointerup', () => { this.touchLast = null; });
    this.listen(this.renderer.domElement, 'pointercancel', () => { this.touchLast = null; });
  }

  private resize() {
    const width = this.renderer.domElement.parentElement?.clientWidth || window.innerWidth;
    const height = this.renderer.domElement.parentElement?.clientHeight || window.innerHeight;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
  }

  play() {
    if (!this.ready) return;
    this.audio.start(); this.audio.play('click'); this.active = true;
    this.mouseReadyAt = performance.now() + 180;
    this.keys.clear(); this.accumulator = 0;
    this.callbacks.pointer(true);
    if (window.matchMedia('(pointer: coarse)').matches) return;
    try {
      const result = this.renderer.domElement.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {
        if (!this.disposed) { this.dragLookEnabled = true; this.notify('Mouse capture is unavailable. Click and drag the world to look around.'); }
      });
    } catch { this.dragLookEnabled = true; this.notify('Click and drag the world to look around.'); }
  }

  pause(showMenu = true) {
    this.active = false; this.mouseDown = false; this.placing = false; this.keys.clear(); this.mining = 0;
    if (showMenu) this.callbacks.screen('paused');
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.save(); this.emitSnapshot();
  }

  setKey(code: string, down: boolean) { if (down) this.keys.add(code); else this.keys.delete(code); }
  setMining(down: boolean) { this.mouseDown = down; }
  touchPlace() { this.place(); }
  touchInteract() { this.interact(); }
  toggleFlight() {
    if (this.settings.mode !== 'creative') return;
    this.flying = !this.flying; this.velocity.set(0, 0, 0);
    this.notify(this.flying ? 'Free flight on. Space to rise, Shift to descend.' : 'Feet on the ground again.'); this.emitSnapshot();
  }
  look(x: number, y: number) {
    const speed = this.settings.sensitivity * 0.000047 + 0.00035;
    this.yaw -= x * speed; this.pitch = THREE.MathUtils.clamp(this.pitch - y * speed, -1.53, 1.53);
  }
  select(slot: number) { this.selected = THREE.MathUtils.clamp(slot, 0, 8); this.swing = 0.18; this.audio.play('click'); this.emitSnapshot(); }
  assign(id: number) {
    if (!(this.inventory[id] > 0) && this.settings.mode !== 'creative') return;
    if (id === B.WATER || id === B.BEDROCK) return;
    this.hotbar[this.selected] = id; this.heldId = -1; this.audio.play('click'); this.emitSnapshot();
  }

  private refreshQueue() {
    const cx = Math.floor(this.position.x / CHUNK), cz = Math.floor(this.position.z / CHUNK);
    const radius = this.settings.renderDistance;
    this.lastChunk = chunkKey(cx, cz);
    this.queue = [];
    for (let x = -radius; x <= radius; x++) for (let z = -radius; z <= radius; z++) {
      if (x * x + z * z > radius * radius + 2) continue;
      const chunk = this.world.chunks.get(chunkKey(cx + x, cz + z));
      if (!chunk?.group) this.queue.push([cx + x, cz + z]);
    }
    this.queue.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cz) - Math.hypot(b[0] - cx, b[1] - cz));
    if (!this.ready) this.initialChunks = this.queue.length;
    for (const [key, chunk] of this.world.chunks) {
      const dist = Math.hypot(chunk.cx - cx, chunk.cz - cz);
      if (dist > radius + 0.8 && chunk.group) { this.world.disposeGroup(chunk.group); chunk.group = null; }
      if (dist > radius + 3) this.world.chunks.delete(key);
    }
    if (this.world.columns.size > 110000) this.world.columns.clear();
    this.createDistantTerrain();
  }

  private createDistantTerrain() {
    if (this.distantTerrain) { this.distantTerrain.geometry.dispose(); (this.distantTerrain.material as THREE.Material).dispose(); this.distantTerrain.removeFromParent(); }
    const positions: number[] = [], colors: number[] = [];
    const size = 8, radius = 224, inner = (this.settings.renderDistance - 0.3) * CHUNK;
    const cx = Math.floor(this.position.x / size) * size, cz = Math.floor(this.position.z / size) * size;
    const fogColor = new THREE.Color('#c4d4c6');
    const color = new THREE.Color();
    const quad = (vertices: number[][], distance: number, shade: number) => {
      color.set('#829d83').multiplyScalar(shade).lerp(fogColor, THREE.MathUtils.clamp((distance - 45) / 195, 0.3, 1));
      for (const i of [0, 1, 2, 2, 1, 3]) { positions.push(...vertices[i]); colors.push(color.r, color.g, color.b); }
    };
    for (let x = cx - radius; x < cx + radius; x += size) for (let z = cz - radius; z < cz + radius; z += size) {
      const distance = Math.hypot(x - this.position.x, z - this.position.z);
      if (distance < inner || distance > radius) continue;
      const h = Math.max(SEA + 0.3, this.world.column(x, z).height + 1);
      const hx = Math.max(SEA + 0.3, this.world.column(x + size, z).height + 1);
      const hz = Math.max(SEA + 0.3, this.world.column(x, z + size).height + 1);
      quad([[x, h, z], [x + size, h, z], [x, h, z + size], [x + size, h, z + size]], distance, 1);
      if (h !== hx) quad([[x + size, h, z], [x + size, hx, z], [x + size, h, z + size], [x + size, hx, z + size]], distance, 0.88);
      if (h !== hz) quad([[x, h, z + size], [x, hz, z + size], [x + size, h, z + size], [x + size, hz, z + size]], distance, 0.93);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.distantTerrain = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
    this.scene.add(this.distantTerrain);
  }

  private stream() {
    const start = performance.now();
    let count = 0;
    while (this.world.dirty.size && count < 4) {
      const key = this.world.dirty.values().next().value as string;
      this.world.dirty.delete(key);
      const chunk = this.world.chunks.get(key);
      if (chunk?.group) {
        this.world.disposeGroup(chunk.group);
        chunk.group = this.world.mesh(chunk, { opaque: this.opaque, water: this.water, glass: this.glass });
        this.scene.add(chunk.group); count++;
      }
    }
    while (this.queue.length && count < 2 && performance.now() - start < 13) {
      const [cx, cz] = this.queue.shift()!;
      const chunk = this.world.getChunk(cx, cz);
      if (!chunk.group) { chunk.group = this.world.mesh(chunk, { opaque: this.opaque, water: this.water, glass: this.glass }); this.scene.add(chunk.group); }
      count++;
    }
    if (!this.ready && (this.initialChunks - this.queue.length >= 21 || this.queue.length === 0)) { this.ready = true; this.emitSnapshot(); }
  }

  private frame = (milliseconds: number) => {
    if (this.disposed || this.visibilityPaused) return;
    if (!this.previousTime) this.previousTime = milliseconds;
    const dt = Math.min((milliseconds - this.previousTime) / 1000, 0.09);
    this.previousTime = milliseconds; this.elapsed += dt;
    this.frameCount++; this.frameClock += dt;
    if (this.frameClock >= 0.8) { this.fps = Math.round(this.frameCount / this.frameClock); this.frameClock = 0; this.frameCount = 0; }
    this.qualityClock += dt;
    if (this.ready && this.qualityClock > 8) {
      this.qualityClock = 0;
      const current = this.renderer.getPixelRatio(), maximum = Math.min(window.devicePixelRatio || 1, 1.7);
      const next = this.fps < 26 ? Math.max(0.75, current - 0.15) : this.fps > 53 ? Math.min(maximum, current + 0.1) : current;
      if (Math.abs(next - current) > 0.01) { this.renderer.setPixelRatio(next); this.resize(); }
    }
    this.stream();
    if (this.active && this.ready) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 90) { this.physics(1 / 90); this.accumulator -= 1 / 90; }
      this.time += dt / DAY_LENGTH;
      if (this.time >= 1) { this.time -= 1; this.day++; this.notify(`Day ${this.day}. A new little beginning.`); }
      this.weatherClock += dt;
      if (this.weatherClock > 150) { this.weatherClock = 0; if (this.settings.weather === 'auto') this.weather = this.world.noise.hash(this.day, Math.floor(this.elapsed / 150), 21) > 0.69 ? 'rain' : 'clear'; }
      this.camera.position.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT, 0));
      if (this.grounded && this.velocity.lengthSq() > 0.3) this.camera.position.y += Math.sin(this.elapsed * (this.keys.has('ShiftLeft') ? 13 : 9)) * 0.025;
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.camera.updateMatrixWorld();
      this.updateTarget(dt);
      if (this.placing && this.elapsed - this.lastPlace > 0.22) this.place();
      this.saveClock += dt;
      if (this.saveClock > 15) { this.saveClock = 0; this.save(); }
      this.streamClock += dt;
      if (this.streamClock > 0.4) { this.streamClock = 0; const ck = chunkKey(Math.floor(this.position.x / CHUNK), Math.floor(this.position.z / CHUNK)); if (ck !== this.lastChunk) this.refreshQueue(); }
    } else {
      this.camera.position.copy(this.position).add(new THREE.Vector3(0, EYE_HEIGHT + Math.sin(this.elapsed * 0.5) * 0.025, 0));
      this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
      this.outline.visible = false; this.crack.visible = false;
    }
    this.waterTime.value = this.elapsed;
    this.atmosphereClock += dt;
    if (this.atmosphereClock > 0.12) { this.updateAtmosphere(); this.atmosphereClock = 0; }
    this.updateCreatures(dt); this.updateParticles(dt); this.updateHand(dt); this.updateRain(dt);
    this.torchClock += dt;
    if (this.torchClock > 0.6) { this.updateTorches(); this.torchClock = 0; }
    this.shadowClock += dt;
    if (this.shadowClock > 0.45) { this.shadowClock = 0; this.renderer.shadowMap.needsUpdate = true; }
    this.audio.update(this.elapsed, this.weather === 'rain', this.active);
    this.renderer.render(this.scene, this.camera);
    this.snapshotClock += dt;
    if (this.snapshotClock > 0.16) { this.snapshotClock = 0; this.emitSnapshot(); }
  };

  private collides(position: THREE.Vector3): boolean {
    const minX = Math.floor(position.x - HALF_WIDTH + 0.0001), maxX = Math.floor(position.x + HALF_WIDTH - 0.0001);
    const minY = Math.floor(position.y + 0.0001), maxY = Math.floor(position.y + PLAYER_HEIGHT - 0.0001);
    const minZ = Math.floor(position.z - HALF_WIDTH + 0.0001), maxZ = Math.floor(position.z + HALF_WIDTH - 0.0001);
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) if (isSolid(this.world.get(x, y, z))) return true;
    return false;
  }

  private moveAxis(axis: 'x' | 'y' | 'z', amount: number): boolean {
    if (amount === 0) return false;
    const old = this.position[axis]; this.position[axis] += amount;
    if (!this.collides(this.position)) return false;
    if (axis !== 'y' && this.settings.autoStep && this.grounded && !this.flying) {
      const oldY = this.position.y;
      this.position.y = Math.floor(oldY + 0.001) + 1.01;
      if (!this.collides(this.position) && this.position.y - oldY <= 1.02) { this.velocity.y = 0; return false; }
      this.position.y = oldY;
    }
    // Binary-search the swept interval instead of rolling back an entire physics step.
    let safe = old, blocked = this.position[axis];
    for (let i = 0; i < 10; i++) {
      this.position[axis] = (safe + blocked) / 2;
      if (this.collides(this.position)) blocked = this.position[axis]; else safe = this.position[axis];
    }
    this.position[axis] = safe;
    if (axis === 'y') {
      if (amount < 0) {
        this.grounded = true;
        if (this.velocity.y < -10 && !this.inWater && this.settings.mode !== 'creative') this.damage(Math.floor((-this.velocity.y - 9) * 1.4));
      }
      this.velocity.y = 0;
    }
    return true;
  }

  private physics(dt: number) {
    const feetWater = this.world.get(this.position.x, this.position.y + 0.3, this.position.z) === B.WATER;
    if (feetWater && !this.inWater) this.audio.play('splash');
    this.inWater = feetWater;
    this.underwater = this.world.get(this.position.x, this.position.y + EYE_HEIGHT, this.position.z) === B.WATER;
    let forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    let right = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const magnitude = Math.hypot(forward, right);
    if (magnitude) { forward /= magnitude; right /= magnitude; }
    const sprint = (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) && this.stamina > 3 && magnitude > 0 && !this.inWater && !this.flying;
    const speed = this.flying ? 9 : this.inWater ? 2.8 : sprint ? 7 : 4.4;
    const dx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * right) * speed;
    const dz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * right) * speed;
    const acceleration = this.grounded || this.flying || this.inWater ? 18 : 5;
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, dx, acceleration, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, dz, acceleration, dt);
    this.stamina = THREE.MathUtils.clamp(this.stamina + (sprint ? -11 : 15) * dt, 0, 100);
    if (this.flying) this.velocity.y = (Number(this.keys.has('Space')) - Number(this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))) * 7;
    else if (this.inWater) {
      this.velocity.y += (this.keys.has('Space') ? 13 : -3) * dt;
      this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -2, 4);
    } else {
      if (this.keys.has('Space') && this.grounded) { this.velocity.y = 7.4; this.grounded = false; }
      this.velocity.y = Math.max(-35, this.velocity.y - 22 * dt);
    }
    const previous = this.position.clone();
    this.moveAxis('x', this.velocity.x * dt); this.moveAxis('z', this.velocity.z * dt);
    this.grounded = false;
    this.moveAxis('y', this.velocity.y * dt);
    this.stats.distance += Math.hypot(this.position.x - previous.x, this.position.z - previous.z);
    if (this.position.y < -8) this.respawn();
    if (magnitude && this.grounded && this.elapsed - this.lastStep > (sprint ? 0.27 : 0.42)) { this.lastStep = this.elapsed; this.audio.play('step'); }
    if (this.underwater && this.settings.mode !== 'creative') {
      this.air = Math.max(0, this.air - dt);
      if (this.air === 0 && this.elapsed - this.lastDamage > 1) this.damage(2);
    } else this.air = Math.min(10, this.air + dt * 3);
    if (this.health < 20 && this.elapsed - this.lastDamage > 25) this.health = Math.min(20, this.health + dt * 0.2);
    const biome = this.world.column(Math.floor(this.position.x), Math.floor(this.position.z)).biome;
    if (!this.stats.biomes.includes(biome)) { this.stats.biomes.push(biome); if (this.stats.biomes.length > 1) this.notify(`Discovered: ${biome}`, 'achievement'); this.checkQuests(); }
  }

  private updateTarget(dt: number) {
    const direction = this.camera.getWorldDirection(new THREE.Vector3());
    this.target = this.world.raycast(this.camera.position, direction);
    this.outline.visible = !!this.target;
    if (this.target) this.outline.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    if (this.mouseDown && this.target) {
      const t = this.target;
      const key = `${t.x},${t.y},${t.z}`;
      if (key !== this.miningKey) { this.miningKey = key; this.mining = 0; }
      const held = this.hotbar[this.selected];
      let hardness = BLOCKS[t.id]?.hardness || 0.5;
      const rock = [B.STONE, B.COBBLE, B.COAL, B.IRON, B.BRICK, B.FURNACE].includes(t.id as never);
      const pick = held === B.IRON_PICK ? 5 : held === B.STONE_PICK ? 3.5 : held === B.WOOD_PICK ? 2.2 : 1;
      if (rock) hardness /= pick;
      if ((t.id === B.LOG || t.id === B.BIRCH) && held === B.AXE) hardness /= 3;
      if (t.id === B.IRON && held !== B.STONE_PICK && held !== B.IRON_PICK && this.settings.mode !== 'creative') {
        if (this.mining === 0) this.notify('Iron needs a stone or iron pickaxe.', 'info');
        this.mining = 0.001; this.crack.visible = false; return;
      }
      if (this.settings.mode === 'creative') hardness = 0.12;
      this.mining += dt / Math.max(0.12, hardness);
      this.swing = 0.6;
      if (this.mining >= 1) { this.breakBlock(t); this.mining = 0; this.miningKey = ''; }
    } else { this.mining = 0; this.miningKey = ''; }
    this.crack.visible = !!this.target && this.mining > 0.03;
    if (this.crack.visible && this.target) {
      this.crack.position.copy(this.outline.position);
      const stage = Math.min(7, Math.floor(this.mining * 8));
      if (stage !== this.crackStage) this.drawCracks(stage);
    }
  }

  private drawCracks(stage: number) {
    this.crackStage = stage;
    const canvas = this.crackTexture.image as HTMLCanvasElement, ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 32, 32); ctx.strokeStyle = 'rgba(39,47,32,0.65)'; ctx.lineWidth = stage > 4 ? 2 : 1;
    for (let i = 0; i <= stage + 1; i++) {
      const angle = i * 2.399; ctx.beginPath(); ctx.moveTo(16, 16);
      ctx.lineTo(16 + Math.cos(angle) * 8, 16 + Math.sin(angle) * 8);
      ctx.lineTo(16 + Math.cos(angle + 0.2) * (12 + stage), 16 + Math.sin(angle + 0.2) * (12 + stage)); ctx.stroke();
    }
    this.crackTexture.needsUpdate = true;
  }

  private breakBlock(target: Target) {
    if (target.id === B.BEDROCK) return;
    this.world.set(target.x, target.y, target.z, B.AIR);
    this.burst(new THREE.Vector3(target.x + 0.5, target.y + 0.5, target.z + 0.5), BLOCKS[target.id].color, 16);
    this.audio.play('break');
    const drop = target.id === B.GRASS ? B.DIRT : target.id === B.FLOWER ? B.BLOOM : target.id === B.TALL_GRASS ? 0 : target.id;
    if ([B.LEAVES, B.GOLD_LEAVES, B.PINE_LEAVES].includes(target.id as never) && Math.random() > 0.8) { this.addItem(B.APPLE, 1); this.callbacks.notify({ text: '+1 wild apple', kind: 'item', item: B.APPLE }); }
    if (drop) {
      this.addItem(drop, 1); this.stats.gathered[drop] = (this.stats.gathered[drop] || 0) + 1;
      this.callbacks.notify({ text: `+1 ${BLOCKS[drop].name.toLowerCase()}`, kind: 'item', item: drop });
    }
    this.checkQuests(); this.emitSnapshot();
  }

  private addItem(id: number, count: number) {
    this.inventory[id] = (this.inventory[id] || 0) + count;
    if (!this.hotbar.includes(id)) {
      const empty = this.hotbar.findIndex(item => !this.inventory[item]);
      if (empty >= 0) this.hotbar[empty] = id;
    }
  }

  private place() {
    if (!this.active) return;
    const id = this.hotbar[this.selected];
    if (id === B.APPLE) { if (this.elapsed - this.lastPlace > 0.45) this.eat(); this.lastPlace = this.elapsed; return; }
    if (!this.target || !BLOCKS[id]?.placeable || (!(this.inventory[id] > 0) && this.settings.mode !== 'creative')) return;
    const t = this.target, [nx, ny, nz] = t.normal;
    const x = t.x + nx, y = t.y + ny, z = t.z + nz;
    if (y < 1 || y >= HEIGHT) { this.notify('This is the edge of the buildable sky.'); return; }
    if (this.world.get(x, y, z) !== B.AIR && this.world.get(x, y, z) !== B.WATER && !isPlant(this.world.get(x, y, z))) return;
    if (isSolid(id) && x + 1 > this.position.x - HALF_WIDTH && x < this.position.x + HALF_WIDTH && y + 1 > this.position.y && y < this.position.y + PLAYER_HEIGHT && z + 1 > this.position.z - HALF_WIDTH && z < this.position.z + HALF_WIDTH) return;
    if ((id === B.TORCH || id === B.CAMPFIRE || id === B.BLOOM) && !isSolid(this.world.get(x, y - 1, z))) { this.notify('This needs solid ground underneath.'); return; }
    this.world.set(x, y, z, id);
    if (this.settings.mode !== 'creative') this.inventory[id]--;
    this.stats.placed++; this.lastPlace = this.elapsed; this.swing = 0.8;
    this.audio.play('place'); this.burst(new THREE.Vector3(x + 0.5, y + 0.1, z + 0.5), BLOCKS[id].color, 5);
    this.checkQuests(); this.emitSnapshot();
  }

  hasStation(id: number): boolean {
    if (this.settings.mode === 'creative' || this.inventory[id] > 0) return true;
    const px = Math.floor(this.position.x), py = Math.floor(this.position.y), pz = Math.floor(this.position.z);
    for (let x = px - 5; x <= px + 5; x++) for (let z = pz - 5; z <= pz + 5; z++) for (let y = py - 2; y <= py + 2; y++) if (this.world.get(x, y, z) === id) return true;
    return false;
  }

  canCraft(recipe: Recipe): boolean {
    return this.settings.mode === 'creative' || (recipe.ingredients.every(([id, count]) => (this.inventory[id] || 0) >= count) && (!recipe.station || this.hasStation(recipe.station)));
  }

  craft(recipeId: string, amount = 1) {
    const recipe = RECIPES.find(r => r.id === recipeId);
    if (!recipe) return;
    if (!this.canCraft(recipe)) { this.notify(recipe.station && !this.hasStation(recipe.station) ? `You need a ${BLOCKS[recipe.station].name.toLowerCase()} nearby or in your backpack.` : 'Gather a few more ingredients first.', 'error'); return; }
    const batches = this.settings.mode === 'creative' ? amount : Math.min(amount, ...recipe.ingredients.map(([id, n]) => Math.floor((this.inventory[id] || 0) / n)));
    if (this.settings.mode !== 'creative') recipe.ingredients.forEach(([id, count]) => { this.inventory[id] -= count * batches; });
    this.addItem(recipe.output, recipe.count * batches);
    this.stats.crafted[recipe.output] = (this.stats.crafted[recipe.output] || 0) + recipe.count * batches;
    this.hotbar[this.selected] = recipe.output; this.heldId = -1;
    this.audio.play('craft');
    this.callbacks.notify({ text: `Made ${recipe.count * batches} ${recipe.name.toLowerCase()}`, kind: 'item', item: recipe.output });
    this.checkQuests(); this.save(); this.emitSnapshot();
  }

  eat() {
    if (!(this.inventory[B.APPLE] > 0) && this.settings.mode !== 'creative') { this.notify('Look for wild apples in the treetops.'); return; }
    if (this.health >= 20 && this.stamina >= 99) { this.notify('You are feeling good. Save that apple for later.'); return; }
    if (this.settings.mode !== 'creative') this.inventory[B.APPLE]--;
    this.health = Math.min(20, this.health + 6); this.stamina = 100; this.swing = 1;
    this.audio.play('pickup'); this.notify('A little refreshment. +3 hearts.'); this.emitSnapshot();
  }

  private interact() {
    const t = this.target;
    if (t && t.id === B.CAMPFIRE && t.distance < 5) {
      this.saveData.spawn = [this.position.x, this.position.y + 0.05, this.position.z]; this.save();
      this.audio.play('achievement'); this.notify('Home is here. Your return point is set.', 'achievement'); return;
    }
    if (t && (t.id === B.BENCH || t.id === B.FURNACE)) { this.callbacks.screen('inventory'); this.pause(false); return; }
    const friend = this.sheep.find(s => s.group.position.distanceTo(this.position) < 3.5);
    if (friend) { this.burst(friend.group.position.clone().add(UP), '#d88b7a', 8); this.audio.play('pickup'); this.notify('A new friend. The sheep seems happy.'); return; }
    this.notify('R to use workbenches, set campfire homes, or pet nearby sheep.');
  }

  private damage(amount: number) {
    if (this.settings.mode === 'creative' || amount <= 0) return;
    this.health = Math.max(0, this.health - amount); this.lastDamage = this.elapsed; this.audio.play('hurt');
    if (this.health <= 0) this.respawn();
  }

  respawn() {
    this.position.fromArray(this.saveData.spawn!); this.velocity.set(0, 0, 0);
    // A home can have been built over since it was saved.
    while (this.collides(this.position) && this.position.y < HEIGHT + 2) this.position.y += 1;
    this.health = 20; this.air = 10; this.stamina = 100; this.flying = false;
    this.refreshQueue(); this.notify('Back to a familiar place. Your belongings are safe.'); this.save(); this.emitSnapshot();
  }

  private checkQuests() {
    for (const [index, q] of getQuests(this.stats).entries()) {
      if (q.current >= q.goal && !this.stats.completed.includes(q.id)) {
        this.stats.completed.push(q.id);
        const reward = index % 2 === 0 ? B.APPLE : B.TORCH;
        this.addItem(reward, reward === B.APPLE ? 2 : 4);
        this.audio.play('achievement'); this.notify(`${q.title} complete. +${q.reward}`, 'achievement');
      }
    }
  }

  updateSettings(settings: Settings) {
    const oldDistance = this.settings.renderDistance;
    this.settings = { ...settings };
    this.audio.setVolume(settings.volume); this.camera.fov = settings.fov; this.camera.updateProjectionMatrix();
    this.renderer.shadowMap.enabled = settings.shadows;
    if (settings.mode !== 'creative') this.flying = false;
    if (oldDistance !== settings.renderDistance) this.refreshQueue();
    if (settings.weather !== 'auto') this.weather = settings.weather;
    this.updateAtmosphere(); this.emitSnapshot();
  }

  private updateAtmosphere() {
    const angle = (this.time - 0.25) * Math.PI * 2;
    const daylight = THREE.MathUtils.clamp(Math.sin(angle) * 2.5 + 0.18, 0.035, 1);
    const rainy = this.weather === 'rain';
    const top = new THREE.Color('#10293a').lerp(new THREE.Color(rainy ? '#829da2' : '#83b4c6'), daylight);
    const bottom = new THREE.Color('#354a52').lerp(new THREE.Color(rainy ? '#bdccc3' : '#d2dfcf'), daylight);
    this.skyUniforms.top.value.copy(top); this.skyUniforms.bottom.value.copy(bottom);
    this.sky.position.copy(this.position); this.stars.position.copy(this.position);
    (this.stars.material as THREE.PointsMaterial).opacity = Math.max(0, 1 - daylight * 1.5);
    this.sun.position.set(this.position.x - 35, this.position.y + Math.max(12, Math.sin(angle) * 75), this.position.z - 34);
    this.sun.target.position.copy(this.position);
    this.sun.intensity = daylight * (rainy ? 0.9 : 2.25);
    this.sun.color.set(daylight < 0.9 ? '#ffd1a1' : '#fff0cc');
    this.hemisphere.intensity = 0.45 + daylight * (rainy ? 1.1 : 1.45);
    this.hemisphere.color.set(daylight < 0.3 ? '#7d9faf' : '#dae9d5');
    if (this.distantTerrain) (this.distantTerrain.material as THREE.MeshBasicMaterial).color.setScalar(0.22 + daylight * 0.78);
    this.sunDisc.position.copy(this.position).add(new THREE.Vector3(-120, Math.sin(angle) * 270, -220));
    this.sunDisc.lookAt(this.position); this.sunDisc.visible = Math.sin(angle) > -0.1;
    this.moonDisc.position.copy(this.position).add(new THREE.Vector3(110, -Math.sin(angle) * 270, 220));
    this.moonDisc.lookAt(this.position); this.moonDisc.visible = Math.sin(angle) < 0.1;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.copy(this.underwater ? new THREE.Color('#438f96') : bottom);
    fog.far = this.underwater ? 23 : this.settings.renderDistance * CHUNK * (rainy ? 0.83 : 1) - 3;
    fog.near = this.underwater ? 0.5 : rainy ? Math.min(25, fog.far * 0.55) : Math.min(52, fog.far * 0.65);
    for (let i = 0; i < this.cloudOrigin.length; i++) {
      const cloud = this.cloudOrigin[i];
      const x = ((cloud.x + this.elapsed * 0.25 - this.position.x + 210) % 420 + 420) % 420 - 210 + this.position.x;
      const z = ((cloud.z - this.position.z + 210) % 420 + 420) % 420 - 210 + this.position.z;
      this.dummy.position.set(x, cloud.y, z); this.dummy.scale.set(cloud.sx, cloud.sy, cloud.sz); this.dummy.rotation.set(0, 0, 0); this.dummy.updateMatrix(); this.clouds.setMatrixAt(i, this.dummy.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;
    this.fireflies.position.set(this.position.x, this.position.y + 2, this.position.z);
    (this.fireflies.material as THREE.PointsMaterial).opacity = (1 - daylight) * 0.9;
    this.fireflies.rotation.y = this.elapsed * 0.015;
  }

  private updateRain(dt: number) {
    this.rain.visible = this.weather === 'rain';
    if (!this.rain.visible) return;
    this.rain.position.copy(this.position);
    for (let i = 0; i < 720; i++) {
      const n = i * 6;
      this.rainPositions[n] -= dt * 1.8; this.rainPositions[n + 1] -= dt * 24;
      if (this.rainPositions[n + 1] < -5) this.rainPositions[n + 1] = 30;
      if (this.rainPositions[n] < -28) this.rainPositions[n] = 28;
      this.rainPositions[n + 3] = this.rainPositions[n] + 0.12;
      this.rainPositions[n + 4] = this.rainPositions[n + 1] + 0.9;
      this.rainPositions[n + 5] = this.rainPositions[n + 2];
    }
    this.rain.geometry.attributes.position.needsUpdate = true;
  }

  private createHand() {
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.33, 0.21), new THREE.MeshBasicMaterial({ color: '#6b8570' }));
    sleeve.position.set(0.02, -0.13, 0.1); sleeve.rotation.x = -0.25;
    const fist = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.19, 0.19), new THREE.MeshBasicMaterial({ color: '#c8aa83' }));
    fist.position.set(0, 0.06, 0);
    this.hand.add(sleeve, fist, this.heldItem); this.hand.position.set(0.43, -0.47, -0.66);
    this.camera.add(this.hand);
  }

  private updateHeldItem() {
    const id = this.hotbar[this.selected]; this.heldId = id;
    this.heldItem.children.forEach(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); } });
    this.heldItem.clear();
    const addBox = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: string) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(x, y, z); this.heldItem.add(mesh); return mesh;
    };
    if ([B.WOOD_PICK, B.STONE_PICK, B.IRON_PICK, B.AXE].includes(id as never)) {
      const stick = addBox(0.045, 0.44, 0.045, 0, 0.21, 0, '#98764b'); stick.rotation.z = -0.38;
      const head = addBox(id === B.AXE ? 0.19 : 0.4, 0.065, 0.07, 0.06, 0.4, 0, BLOCKS[id].color); head.rotation.z = -0.15;
      if (id !== B.AXE) { addBox(0.06, 0.11, 0.07, -0.12, 0.34, 0, BLOCKS[id].color); addBox(0.06, 0.09, 0.07, 0.24, 0.36, 0, BLOCKS[id].color); }
      else addBox(0.12, 0.17, 0.06, 0.15, 0.35, 0, BLOCKS[id].color);
    } else if (id === B.TORCH) {
      addBox(0.055, 0.35, 0.055, 0, 0.2, 0, '#a47c48'); addBox(0.095, 0.12, 0.095, 0, 0.42, 0, '#ffd278');
    } else if (id === B.APPLE) {
      addBox(0.18, 0.17, 0.16, 0, 0.2, 0, '#c56a4f'); addBox(0.035, 0.07, 0.035, 0, 0.31, 0, '#80653e'); addBox(0.08, 0.025, 0.05, 0.05, 0.32, 0, '#7d995b');
    } else if (BLOCKS[id]) {
      const geometry = new THREE.BoxGeometry(0.23, 0.23, 0.23);
      const uv = geometry.attributes.uv;
      for (let face = 0; face < 6; face++) {
        const def = BLOCKS[id]; const tile = face === 2 ? def.topTile ?? def.tile : face === 3 ? def.bottomTile ?? def.tile : def.tile;
        for (let n = 0; n < 4; n++) {
          const i = face * 4 + n;
          uv.setXY(i, ((tile % 8) + uv.getX(i)) / 8, 1 - (Math.floor(tile / 8) + 1 - uv.getY(i)) / 4);
        }
      }
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: this.atlas }));
      mesh.position.set(0, 0.23, 0); mesh.rotation.set(0.15, 0.35, 0); this.heldItem.add(mesh);
    }
  }

  private updateHand(dt: number) {
    this.hand.visible = this.active && !!this.inventory[this.hotbar[this.selected]];
    if (this.settings.mode === 'creative') this.hand.visible = this.active;
    if (this.heldId !== this.hotbar[this.selected]) this.updateHeldItem();
    this.swing = Math.max(0, this.swing - dt * 2.5);
    const walking = this.active && this.grounded && Math.hypot(this.velocity.x, this.velocity.z) > 0.5;
    const bob = walking ? Math.sin(this.elapsed * 9) * 0.012 : Math.sin(this.elapsed * 2) * 0.003;
    const mining = this.mouseDown && this.target ? Math.sin(this.elapsed * 19) * 0.23 : 0;
    this.hand.position.set(0.43 - this.swing * 0.08, -0.47 + bob - this.swing * 0.04, -0.66 + this.swing * 0.1);
    this.hand.rotation.set(mining - this.swing * 0.3, -0.12, mining * 0.7 - this.swing * 0.15);
  }

  private createCreatures() {
    const wool = new THREE.MeshLambertMaterial({ color: '#eee7d1' }), face = new THREE.MeshLambertMaterial({ color: '#8b816c' });
    const hoof = new THREE.MeshLambertMaterial({ color: '#645e4c' }), eyes = new THREE.MeshBasicMaterial({ color: '#354137' });
    const add = (group: THREE.Group, size: number[], pos: number[], material: THREE.Material) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size as [number, number, number]), material);
      mesh.position.fromArray(pos); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
    };
    for (let i = 0; i < 7; i++) {
      let x = 15 + this.world.noise.hash(i, 7, 51) * 42, z = 8 + this.world.noise.hash(i, 4, 71) * 40;
      if (this.world.column(Math.floor(x), Math.floor(z)).height <= SEA) { x = 34 + i * 2; z = 27; }
      const group = new THREE.Group();
      add(group, [0.65, 0.66, 1], [0, 0.83, 0], wool);
      add(group, [0.41, 0.43, 0.45], [0, 0.95, -0.59], face);
      add(group, [0.49, 0.17, 0.36], [0, 1.16, -0.54], wool);
      add(group, [0.045, 0.065, 0.035], [-0.12, 1, -0.825], eyes);
      add(group, [0.045, 0.065, 0.035], [0.12, 1, -0.825], eyes);
      const legs: THREE.Mesh[] = [];
      for (const lx of [-0.22, 0.22]) for (const lz of [-0.33, 0.33]) legs.push(add(group, [0.13, 0.43, 0.14], [lx, 0.3, lz], hoof));
      group.position.set(x, this.world.column(Math.floor(x), Math.floor(z)).height + 1, z); this.scene.add(group);
      this.sheep.push({ group, legs, direction: i * 1.27, timer: 2 + i, moving: false, phase: i });
    }
    const birdMaterial = new THREE.MeshBasicMaterial({ color: '#53665a' });
    for (let i = 0; i < 6; i++) {
      const bird = new THREE.Group();
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.17), birdMaterial); left.position.x = -0.3;
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.04, 0.17), birdMaterial); right.position.x = 0.3;
      bird.add(left, right); this.scene.add(bird); this.birds.push(bird);
    }
  }

  private updateCreatures(dt: number) {
    for (const sheep of this.sheep) {
      if (this.ready && sheep.group.position.distanceToSquared(this.position) > 115 * 115) {
        const x = this.position.x + Math.cos(sheep.phase) * 36, z = this.position.z + Math.sin(sheep.phase) * 36;
        const h = this.world.column(Math.floor(x), Math.floor(z)).height;
        if (h > SEA + 2) sheep.group.position.set(x, h + 1, z); else sheep.phase += 1.27;
      }
      sheep.timer -= dt;
      if (sheep.timer <= 0) { sheep.direction += (Math.random() - 0.5) * 2; sheep.moving = Math.random() > 0.3; sheep.timer = 2 + Math.random() * 5; }
      if (sheep.moving && this.ready) {
        const x = sheep.group.position.x - Math.sin(sheep.direction) * dt * 0.48;
        const z = sheep.group.position.z - Math.cos(sheep.direction) * dt * 0.48;
        const h = this.world.column(Math.floor(x), Math.floor(z)).height + 1;
        if (h > SEA + 1 && Math.abs(h - sheep.group.position.y) < 1.1 && !isSolid(this.world.get(x, h, z)) && Math.hypot(x - 30, z - 25) < 55) {
          sheep.group.position.x = x; sheep.group.position.z = z; sheep.group.position.y = THREE.MathUtils.damp(sheep.group.position.y, h, 6, dt);
          sheep.group.rotation.y = sheep.direction;
          sheep.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(this.elapsed * 6 + i * Math.PI) * 0.28; });
        } else { sheep.direction += 1.7; sheep.timer = 0.5; }
      }
    }
    this.birds.forEach((bird, i) => {
      const angle = this.elapsed * 0.055 + i * 0.4;
      bird.position.set(10 + Math.cos(angle) * (45 + i * 3), 47 + Math.sin(this.elapsed * 0.25 + i) * 2 + i * 0.7, -20 + Math.sin(angle) * 45);
      bird.rotation.y = -angle; bird.children[0].rotation.z = Math.sin(this.elapsed * 4 + i) * 0.35; bird.children[1].rotation.z = -Math.sin(this.elapsed * 4 + i) * 0.35;
    });
  }

  private burst(position: THREE.Vector3, color: string, count: number) {
    for (let i = 0; i < count && this.particles.length < 155; i++) {
      const life = 0.45 + Math.random() * 0.45;
      this.particles.push({ position: position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, Math.random() * 0.4, (Math.random() - 0.5) * 0.6)), velocity: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 3, (Math.random() - 0.5) * 3), life, max: life, color: new THREE.Color(color).multiplyScalar(0.8 + Math.random() * 0.4) });
    }
  }

  private updateParticles(dt: number) {
    this.particles = this.particles.filter(p => p.life > 0);
    this.particles.forEach((p, i) => {
      p.life -= dt; p.velocity.y -= dt * 9; p.position.addScaledVector(p.velocity, dt);
      this.dummy.position.copy(p.position); this.dummy.rotation.set(p.life * 4, p.life * 2, p.life * 3); this.dummy.scale.setScalar(Math.max(0.01, p.life / p.max)); this.dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i, this.dummy.matrix); this.particleMesh.setColorAt(i, p.color);
    });
    this.particleMesh.count = this.particles.length; this.particleMesh.instanceMatrix.needsUpdate = true;
    if (this.particleMesh.instanceColor) this.particleMesh.instanceColor.needsUpdate = true;
  }

  private updateTorches() {
    const items: THREE.Vector3[] = [];
    if (this.hotbar[this.selected] === B.TORCH && this.inventory[B.TORCH] > 0) items.push(this.position.clone().add(new THREE.Vector3(0, 1.3, 0)));
    for (const [key, id] of this.world.edits) {
      if (id !== B.TORCH && id !== B.CAMPFIRE) continue;
      const [x, y, z] = key.split(',').map(Number);
      const pos = new THREE.Vector3(x + 0.5, y + 0.8, z + 0.5);
      if (pos.distanceToSquared(this.position) < 900) items.push(pos);
    }
    items.sort((a, b) => a.distanceToSquared(this.position) - b.distanceToSquared(this.position));
    this.torchLights.forEach((light, i) => {
      light.intensity = i < items.length ? 3 + Math.sin(this.elapsed * 9 + i) * 0.25 : 0;
      if (items[i]) light.position.copy(items[i]);
    });
  }

  save(): WorldSave {
    if (this.disposed) return this.saveData;
    this.saveData = {
      ...this.saveData, updatedAt: Date.now(), position: this.position.toArray() as [number, number, number], yaw: this.yaw, pitch: this.pitch,
      inventory: { ...this.inventory }, hotbar: [...this.hotbar], selected: this.selected, edits: [...this.world.edits],
      time: this.time, day: this.day, health: this.health, stats: structuredClone(this.stats),
    };
    try { persistWorld(this.saveData); this.savedAt = Date.now(); }
    catch { this.notify('Local storage is full or unavailable. Export your world from the pause menu to keep it safe.', 'error'); }
    return this.saveData;
  }

  private notify(text: string, kind: Toast['kind'] = 'info') { this.callbacks.notify({ text, kind }); }

  private emitSnapshot() {
    this.callbacks.snapshot({
      ready: this.ready, loading: 1 - this.queue.length / Math.max(1, this.initialChunks), health: this.health, stamina: this.stamina, air: this.air,
      selected: this.selected, hotbar: [...this.hotbar], inventory: { ...this.inventory }, position: this.position.toArray() as [number, number, number],
      yaw: this.yaw, biome: this.world.column(Math.floor(this.position.x), Math.floor(this.position.z)).biome,
      time: this.time, day: this.day, weather: this.weather, mining: this.mining, target: this.target, fps: this.fps, savedAt: this.savedAt,
      stats: { ...this.stats, biomes: [...this.stats.biomes], completed: [...this.stats.completed] }, flying: this.flying, inWater: this.underwater,
    });
  }

  dispose() {
    if (this.disposed) return;
    this.save(); this.disposed = true;
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.renderer.setAnimationLoop(null); this.listeners.forEach(remove => remove());
    this.world.dispose();
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.scene.traverse(obj => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points || obj instanceof THREE.LineSegments) {
        geometries.add(obj.geometry);
        if (Array.isArray(obj.material)) obj.material.forEach(m => materials.add(m)); else materials.add(obj.material);
      }
    });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); this.atlas.dispose(); this.crackTexture.dispose();
    this.audio.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}