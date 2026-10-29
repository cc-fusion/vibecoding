import * as THREE from 'three';
import { Block, BLOCKS, RECIPES, Stack, addItem, canCraft, consume, initialInventory, isSolid } from './blocks';
import { Change, VoxelWorld, WATER_LEVEL, WORLD_RADIUS, biomeAt, hash, riverCenter } from './world';

export const SAVE_KEY = 'verdant-world-v1';
export interface SavedWorld {
  version: number; seed: number; name: string; position: [number, number, number]; yaw: number; pitch: number;
  inventory: (Stack | null)[]; selected: number; health: number; hunger: number; time: number; mode: 'creative' | 'survival';
  changes: Change[]; progress: { mined: number; placed: number; crafted: number; steps: number; discovered: string[] };
  savedAt: number;
}
export interface GameUI {
  ready: boolean; inventory: (Stack | null)[]; selected: number; target: { id: Block; name: string; progress: number } | null;
  health: number; hunger: number; biome: string; coordinates: [number, number, number]; time: number; weather: string;
  mode: 'creative' | 'survival'; daylight: string; playing: boolean; paused: boolean; loading: number;
  progress: SavedWorld['progress']; locationName: string; saveStatus: string; fps: number; water: boolean;
}
export interface Settings { sensitivity: number; distance: number; shadows: boolean; sound: boolean; volume: number; motion: boolean; }
export const DEFAULT_SETTINGS: Settings = { sensitivity: 45, distance: WORLD_RADIUS, shadows: true, sound: true, volume: 45, motion: true };

class GameAudio {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  enabled = true;
  volume = .45;
  init() {
    if (this.context) { void this.context.resume(); return; }
    try {
      this.context = new AudioContext(); this.master = this.context.createGain(); this.master.gain.value = this.volume * .22; this.master.connect(this.context.destination);
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate), channel = buffer.getChannelData(0); let brown = 0;
      for (let i = 0; i < channel.length; i++) { brown = (brown + Math.random() * .04 - .02) / 1.02; channel[i] = brown * 2; }
      const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain(); source.buffer = buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = 650; gain.gain.value = .15; source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start();
    } catch { /* Browsers without Web Audio can still play the game. */ }
  }
  configure(enabled: boolean, volume: number) { this.enabled = enabled; this.volume = volume / 100; if (this.master && this.context) this.master.gain.setTargetAtTime(enabled ? this.volume * .25 : 0, this.context.currentTime, .1); }
  tone(frequency: number, duration = .12, type: OscillatorType = 'sine', volume = .4, delay = 0) {
    if (!this.context || !this.master || !this.enabled) return;
    const t = this.context.currentTime + delay, oscillator = this.context.createOscillator(), gain = this.context.createGain(); oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, t); oscillator.frequency.exponentialRampToValueAtTime(frequency * .73, t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .008); gain.gain.exponentialRampToValueAtTime(.001, t + duration); oscillator.connect(gain); gain.connect(this.master); oscillator.start(t); oscillator.stop(t + duration);
  }
  hit(stone: boolean) { this.tone(stone ? 160 : 115, .065, 'triangle', .25); this.tone(stone ? 380 : 170, .04, 'square', .025); }
  place() { this.tone(240, .1, 'triangle', .35); }
  step() { this.tone(55 + Math.random() * 30, .045, 'triangle', .12); }
  craft() { this.tone(523, .22, 'sine', .24); this.tone(659, .22, 'sine', .2, .1); this.tone(784, .3, 'sine', .15, .2); }
  bird() { this.tone(2000 + Math.random() * 900, .13, 'sine', .055); this.tone(2600, .12, 'sine', .04, .18); }
  dispose() { void this.context?.close(); }
}

interface AmbientCreature { group: THREE.Group; legs: THREE.Mesh[]; dir: THREE.Vector3; age: number; }
interface Particle { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; }

export class GameEngine {
  host: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, 1, .06, 420);
  world: VoxelWorld;
  audio = new GameAudio();
  settings: Settings = { ...DEFAULT_SETTINGS };
  ui: GameUI;
  onUI: (ui: GameUI) => void;
  onNotice: (message: string, kind?: 'item' | 'success' | 'info') => void;
  onMenu: (menu: 'pause' | 'inventory' | 'crafting' | 'map' | null) => void;
  keys = new Set<string>();
  playing = false;
  paused = false;
  firstPerson = false;
  mode: 'creative' | 'survival' = 'creative';
  player = new THREE.Vector3(14, 18, 24);
  velocity = new THREE.Vector3();
  yaw = .32;
  pitch = -.11;
  grounded = false;
  inventory: (Stack | null)[];
  selected = 1;
  progress: SavedWorld['progress'] = { mined: 0, placed: 0, crafted: 0, steps: 0, discovered: ['Riverlands'] };
  worldName = 'Evergreen Valley';
  seed: number;
  health = 10;
  hunger = 10;
  time = .27;
  weather: 'Clear' | 'Rain' = 'Clear';
  weatherTimer = 100;
  lastSave = 0;
  private lastUI = 0;
  private lastFrame = 0;
  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver;
  private sunlight: THREE.DirectionalLight;
  private ambient: THREE.HemisphereLight;
  private fill: THREE.DirectionalLight;
  private outline: THREE.LineSegments;
  private target: { x: number; y: number; z: number; id: Block; normal: THREE.Vector3 } | null = null;
  private mining = false;
  private mineTime = 0;
  private mineKey = '';
  private debris: Particle[] = [];
  private creatures: AmbientCreature[] = [];
  private creatureTimer = 0;
  private autumn = 0;
  private sky: THREE.Mesh;
  private dayColor = new THREE.Color('#c7b88f');
  private nightColor = new THREE.Color('#152b3c');
  private clouds: THREE.Group;
  private rain: THREE.Points;
  private dropPositions: Float32Array;
  private water: THREE.Mesh;
  private ring: THREE.Mesh;
  private touchMove = { x: 0, y: 0 };
  private swipe: { x: number; y: number } | null = null;
  private initialTargetLook = new THREE.Vector3(1, 16, -10);
  private ray = new THREE.Ray();
  private dir = new THREE.Vector3();
  private startCamera = new THREE.Vector3(54, 39, 54);
  private warmCamera = new THREE.Vector3(54, 39, 54);
  private autoSaveWasReady = false;
  private events: [string, EventListener][] = [];

  constructor(host: HTMLDivElement, saved: SavedWorld | null, options: { onUI: (ui: GameUI) => void; onNotice: GameUIEvent; onMenu: (menu: 'pause' | 'inventory' | 'crafting' | 'map' | null) => void }) {
    this.host = host; this.onUI = options.onUI; this.onNotice = options.onNotice; this.onMenu = options.onMenu;
    this.seed = saved?.seed ?? 18374; this.worldName = saved?.name || 'Evergreen Valley';
    this.renderer = new THREE.WebGLRenderer({ antialias: navigator.userAgent.search(/Android|iPhone|iPad/i) < 0, powerPreference: 'high-performance', alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.18;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D voxel world'); host.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog('#cad9c6', 68, 177);
    this.sky = this.makeSky(); this.scene.add(this.sky);
    this.ambient = new THREE.HemisphereLight('#d4e9e6', '#758361', 1.85); this.scene.add(this.ambient);
    this.sunlight = new THREE.DirectionalLight('#fff0d0', 2.65); this.sunlight.position.set(-45, 75, 40); this.sunlight.castShadow = true; this.sunlight.shadow.mapSize.set(2048, 2048); this.sunlight.shadow.camera.left = -55; this.sunlight.shadow.camera.right = 55; this.sunlight.shadow.camera.top = 55; this.sunlight.shadow.camera.bottom = -55; this.sunlight.shadow.camera.far = 210; this.sunlight.shadow.normalBias = .07; this.sunlight.shadow.bias = -.0002; this.sunlight.shadow.radius = 2; this.scene.add(this.sunlight); this.scene.add(this.sunlight.target);
    this.fill = new THREE.DirectionalLight('#b8d9df', .5); this.fill.position.set(40, 30, -30); this.scene.add(this.fill);
    this.world = new VoxelWorld(this.scene, this.seed, saved?.changes || [], navigator.userAgent.search(/Android|iPhone|iPad/i) >= 0);
    this.world.warmStart(12, 30);
    this.sky.position.copy(this.player);
    this.water = this.makeWater(); this.scene.add(this.water);
    this.clouds = this.makeClouds(); this.scene.add(this.clouds);
    this.dropPositions = new Float32Array(1100 * 3);
    for (let i = 0; i < 1100; i++) { this.dropPositions[i * 3] = (hash(i, 16) - .5) * 70; this.dropPositions[i * 3 + 1] = hash(i, 65) * 31; this.dropPositions[i * 3 + 2] = (hash(i, 68) - .5) * 70; }
    const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.dropPositions, 3));
    this.rain = new THREE.Points(rainGeometry, new THREE.PointsMaterial({ color: '#dfebe7', size: .075, transparent: true, opacity: .45, depthWrite: false })); this.rain.visible = false; this.scene.add(this.rain);
    const selection = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.007, 1.007, 1.007)); this.outline = new THREE.LineSegments(selection, new THREE.LineBasicMaterial({ color: '#f7efcc', transparent: true, opacity: .8 })); this.outline.visible = false; this.scene.add(this.outline);
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(.16, .018, 5, 12), new THREE.MeshBasicMaterial({ color: '#ffe8a0' })); this.ring.rotation.x = -Math.PI / 2; this.ring.visible = false; this.scene.add(this.ring);
    this.inventory = saved?.inventory?.length === 36 ? saved.inventory.map(s => s ? { ...s } : null) : initialInventory();
    if (saved) {
      this.player.fromArray(saved.position); this.yaw = saved.yaw; this.pitch = saved.pitch; this.mode = saved.mode; this.selected = saved.selected; this.time = saved.time; this.health = saved.health; this.hunger = saved.hunger; this.progress = saved.progress;
      this.firstPerson = true; this.camera.position.set(this.player.x, this.player.y + 1.65, this.player.z); this.camera.lookAt(this.initialTargetLook);
    } else { this.player.set(0.5, this.world.highest(0, 20) + 1.05, 21.5); this.camera.position.copy(this.startCamera); this.camera.lookAt(this.initialTargetLook); }
    this.ui = this.buildUI();
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize(); this.bind(); this.frameId = requestAnimationFrame(this.frame);
  }
  private makeSky() {
    return new THREE.Mesh(new THREE.SphereGeometry(330, 24, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { top: { value: new THREE.Color('#8fb9bd') }, bottom: { value: new THREE.Color('#dee5cc') } }, vertexShader: 'varying vec3 vPosition; void main(){ vPosition=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }', fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vPosition; void main(){float h=normalize(vPosition).y; float t=clamp(pow(max(h,0.0),0.55),0.0,1.0);gl_FragColor=vec4(mix(bottom,top,t),1.0);}' }));
  }
  private makeWater(): THREE.Mesh {
    const positions: number[] = [], indices: number[] = [], segments = 28, rows = 240;
    const width = 11.5, span = 480;
    for (let z = -span / 2; z <= span / 2; z += span / rows) {
      for (let x = 0; x <= segments; x++) {
        const zz = z + Math.round(this.player.z / 480) * 480;
        positions.push(riverCenter(zz) - width + x / segments * width * 2, WATER_LEVEL + .52, zz);
      }
    }
    const heightAt = (xx: number, zz: number) => 6 + (Math.abs(xx - riverCenter(zz)) / 11.5) * 7 + hash(xx * 18 + zz * 7, this.seed, 75) * .23;
    for (let z = 0; z < rows; z++) for (let x = 0; x < segments; x++) {
      const a = z * (segments + 1) + x, b = a + segments + 1;
      const px = positions[a * 3], pz = positions[a * 3 + 2];
      if (heightAt(px, pz) <= 8) { indices.push(a, b, a + 1, a + 1, b, b + 1); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { time: { value: 0 }, color: { value: new THREE.Color('#68ab99') } }, vertexShader: 'varying vec3 vWorld; void main(){vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}', fragmentShader: 'uniform float time;uniform vec3 color;varying vec3 vWorld;void main(){float ripple=sin(vWorld.x*2.1+vWorld.z*1.3+time*.9)*sin(vWorld.z*2.7-vWorld.x*.8+time*.8);float shine=pow(max(0.0,ripple),18.0)*.15;gl_FragColor=vec4(color+vec3(shine*.65,shine*.85,shine*.8),.82);}' });
    const mesh = new THREE.Mesh(geometry, material); mesh.position.y = .035; mesh.frustumCulled = false; return mesh;
  }
  private makeClouds(): THREE.Group {
    const group = new THREE.Group(), material = new THREE.MeshLambertMaterial({ color: '#fff9e5', transparent: true, opacity: .82, depthWrite: false });
    for (let i = 0; i < 15; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 4; j++) { const box = new THREE.Mesh(new THREE.BoxGeometry(10 + hash(i, j) * 12, 2.5 + hash(i, j + 30) * 2.5, 5 + hash(i, j + 70) * 9), material); box.position.set(j * 6 - 9, hash(i, j + 11) * 2.2, hash(i, j + 20) * 5 - 2); cloud.add(box); }
      cloud.position.set((hash(i, 874, 12) - .5) * 240, 49 + hash(i, 93) * 13, (hash(i, 743) - .5) * 220); group.add(cloud);
    }
    return group;
  }
  private buildUI(): GameUI {
    let target: GameUI['target'] = null;
    if (this.target) target = { id: this.target.id, name: BLOCKS[this.target.id]?.name || 'Block', progress: Math.min(1, this.mineTime / this.mineDuration()) };
    return { ready: this.world.ready >= 9, inventory: this.inventory.map(s => s ? { ...s } : null), selected: this.selected, target, health: this.health, hunger: this.hunger, biome: biomeAt(this.player.x, this.player.z, this.player.y, this.seed), coordinates: [Math.floor(this.player.x), Math.floor(this.player.y), Math.floor(this.player.z)], time: this.time, weather: this.weather, mode: this.mode, daylight: this.time > .23 && this.time < .75 ? 'Golden hour' : 'Starlight', playing: this.playing, paused: this.paused, loading: Math.min(100, Math.round(this.world.ready / Math.min((2 * this.world.radius + 1) ** 2, 121) * 100)), progress: { ...this.progress }, locationName: this.worldName, saveStatus: this.lastSave ? 'Saved just now' : 'Autosave on', fps: Math.min(60, Math.round(1 / Math.max(.001, this.lastFrame - (performance.now() - 1000)))), water: false };
  }
  private publish() { this.ui = this.buildUI(); this.onUI(this.ui); }
  private resize() { const w = this.host.clientWidth, h = this.host.clientHeight; if (!w || !h) return; this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.renderer.setSize(w, h); }
  private bind() {
    const on = (type: string, handler: EventListener, target: EventTarget = window) => { target.addEventListener(type, handler); this.events.push([type, handler]); };
    on('keydown', this.onKeyDown as EventListener);
    on('keyup', this.onKeyUp as EventListener);
    on('mousemove', this.onMouseMove as EventListener);
    on('mousedown', this.onMouseDown as EventListener);
    on('mouseup', this.onMouseUp as EventListener);
    on('contextmenu', ((e: Event) => { if (this.playing) e.preventDefault(); }) as EventListener);
    on('blur', ((e: Event) => { void e; this.keys.clear(); this.touchMove = { x: 0, y: 0 }; this.stopMining(); }) as EventListener);
    on('wheel', this.onWheel as EventListener);
    on('pointerlockchange', (() => { if (document.pointerLockElement === this.renderer.domElement) { this.playing = true; this.paused = false; this.firstPerson = true; this.publish(); } else if (this.playing && !this.paused) this.pause(); }) as EventListener);
    on('touchstart', this.onTouchStart as EventListener, this.renderer.domElement); on('touchmove', this.onTouchMove as EventListener, this.renderer.domElement); on('touchend', (() => { this.swipe = null; this.stopMining(); }) as EventListener, this.renderer.domElement);
  }
  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
    if (!this.playing || this.paused) return;
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Escape') { if (document.pointerLockElement) document.exitPointerLock(); else this.pause(); }
    if (e.code === 'KeyE') this.openMenu('inventory');
    if (e.code === 'KeyC') this.openMenu('crafting');
    if (e.code === 'KeyM') this.openMenu('map');
    if (/^Digit[1-9]$/.test(e.code)) { this.selected = Number(e.code.slice(-1)) - 1; this.publish(); }
    if (e.code === 'KeyQ') { this.eat(); this.publish(); }
    if (e.code === 'KeyR') { this.rescue(); }
    if (e.code === 'KeyF' && this.mode === 'creative') this.onNotice('Double-tap Space to toggle flight.', 'info');
    if (e.code === 'Space' && performance.now() - (this.lastJumpPress || 0) < 300 && this.mode === 'creative') this.flying = !this.flying; this.lastJumpPress = performance.now();
  };
  private lastJumpPress = 0;
  flying = false;
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.code); if (e.code === 'Space') this.jumpHeld = false; };
  private jumpHeld = false;
  private onMouseMove = (e: MouseEvent) => {
    if (!this.playing || this.paused || !this.firstPerson || document.pointerLockElement === null) return;
    this.yaw -= e.movementX * this.settings.sensitivity * .000045; this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * this.settings.sensitivity * .000045, -1.52, 1.52);
  };
  private onMouseDown = (e: MouseEvent) => { if (!this.playing || this.paused) return; if (e.button === 0) this.mining = true; if (e.button === 2) this.place(); if (e.button === 1) this.pick(); };
  private onMouseUp = (e: MouseEvent) => { if (e.button === 0) this.stopMining(); };
  private onWheel = (e: WheelEvent) => { if (!this.playing || this.paused) return; e.preventDefault(); this.selected = (this.selected + (e.deltaY > 0 ? 1 : 8)) % 9; this.publish(); };
  private onTouchStart = (e: TouchEvent) => { if (!this.playing || this.paused) return; const touch = e.changedTouches[0]; if (touch.clientX > window.innerWidth * .6) this.swipe = { x: touch.clientX, y: touch.clientY }; else { this.swipe = null; this.mining = true; } };
  private onTouchMove = (e: TouchEvent) => { if (!this.playing || this.paused) return; e.preventDefault(); const touch = e.changedTouches[0]; if (!this.swipe) return; this.yaw -= (touch.clientX - this.swipe.x) * .006; this.pitch = THREE.MathUtils.clamp(this.pitch - (touch.clientY - this.swipe.y) * .006, -1.52, 1.52); this.swipe = { x: touch.clientX, y: touch.clientY }; };
  setTouchMove(x: number, y: number) { this.touchMove = { x, y }; this.jumpHeld = true; }
  stopTouchMove() { this.touchMove = { x: 0, y: 0 }; this.jumpHeld = false; }
  touchJump() { this.jumpHeld = true; if (this.flying) this.velocity.y = 5; }
  enter() {
    if (this.autoSaveWasReady && this.health <= 0) this.respawn();
    this.paused = false; this.playing = true; this.firstPerson = true; this.keys.clear(); this.audio.init(); this.audio.configure(this.settings.sound, this.settings.volume);
    void this.renderer.domElement.requestPointerLock?.()?.catch(() => this.onNotice('Mouse look is available by dragging. For full FPS controls, allow pointer lock in your browser.', 'info'));
    this.publish(); this.onMenu(null);
  }
  leaveToTitle() { this.save(); this.paused = true; this.playing = false; this.firstPerson = false; this.keys.clear(); this.velocity.set(0, 0, 0); if (document.pointerLockElement) document.exitPointerLock(); this.camera.position.copy(this.startCamera); this.camera.lookAt(this.initialTargetLook); this.publish(); }
  openMenu(menu: 'pause' | 'inventory' | 'crafting' | 'map') { this.paused = true; this.keys.clear(); this.stopMining(); this.onMenu(menu); this.publish(); }
  pause() { this.paused = true; this.keys.clear(); this.stopMining(); this.publish(); this.onMenu('pause'); }
  resume() { this.paused = false; this.keys.clear(); this.onMenu(null); void this.renderer.domElement.requestPointerLock?.()?.catch(() => undefined); this.publish(); }
  setSelected(index: number) { this.selected = Math.max(0, Math.min(35, index)); this.publish(); }
  setMode(mode: 'creative' | 'survival') { this.mode = mode; this.health = 10; this.hunger = 10; this.save(); this.publish(); }
  setWorldName(name: string) { this.worldName = name.trim() || 'Evergreen Valley'; this.save(); }
  setSound(enabled: boolean) { this.settings.sound = enabled; this.audio.configure(enabled, this.settings.volume); }
  configure(settings: Settings) { this.settings = { ...settings }; this.audio.configure(settings.sound, settings.volume); this.sunlight.castShadow = settings.shadows; this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.distance <= 3 ? 1 : 1.6)); if (settings.distance !== this.world.radius) { this.world.radius = settings.distance; const x = Math.floor(this.player.x / 16), z = Math.floor(this.player.z / 16); this.world.centerX = Infinity; this.world.stream(x, z); } }
  selectCreative(id: Block, slot: number) { if (!BLOCKS[id]) return; this.inventory[slot] = { id, count: id === Block.Pickaxe || id === Block.Axe || id === Block.StoneAxe ? 1 : 99 }; this.selected = slot; this.onNotice(`${BLOCKS[id].name} added to hotbar`, 'item'); this.publish(); }
  craft(recipeResult: number) {
    const recipe = RECIPES.find(r => r.result === recipeResult); if (!recipe) return;
    const temporary = this.inventory.map(s => s ? { ...s } : null);
    if (!canCraft(temporary, recipe)) { this.onNotice('Gather a few more materials first.', 'info'); return; }
    for (const ingredient of recipe.inputs) consume(temporary, ingredient.id, ingredient.count);
    if (!addItem(temporary, recipe.result, recipe.count)) { this.onNotice('Your inventory is full. Free a slot first.', 'info'); return; }
    this.inventory = temporary; this.progress.crafted += recipe.count; this.audio.craft(); this.onNotice(`Crafted ${recipe.count > 1 ? `${recipe.count} × ` : ''}${recipe.name}`, 'success'); this.save(); this.publish();
  }
  swapItems(from: number, to: number) {
    if (from < 0 || from > 35 || to < 0 || to > 35 || from === to) return;
    const a = this.inventory[from], b = this.inventory[to];
    if (a && b && a.id === b.id && a.count < 99) { const n = Math.min(b.count, 99 - a.count); a.count += n; b.count -= n; if (!b.count) this.inventory[to] = null; return this.publish(); }
    this.inventory[to] = a; this.inventory[from] = b; this.publish();
  }
  eat() {
    const slot = this.inventory.findIndex(s => s && BLOCKS[s.id].kind === 'food');
    if (slot >= 0) { consume(this.inventory, this.inventory[slot]!.id, 1); this.hunger = Math.min(10, this.hunger + 4); this.health = Math.min(10, this.health + 1); this.audio.tone(340, .2, 'sine'); this.onNotice('A little trail snack. +4 nourishment', 'success'); }
    else this.onNotice('Craft roasted carrots to replenish your nourishment.', 'info');
    this.publish();
  }
  mineDuration() {
    if (this.mode === 'creative') return .28;
    if (!this.target) return 1;
    const item = BLOCKS[this.inventory[this.selected]?.id ?? this.selected] ?? BLOCKS[Block.Pickaxe];
    const id = this.target.id;
    const multiplier = item?.kind === 'tool' ? (item.name.includes('Stone pickaxe') && (id === Block.Stone || id === Block.Cobble || id === Block.Iron || id === Block.Coal) ? .4 : item.name.includes('axe') && id === Block.Log ? .35 : .7) : 1;
    return Math.min(12, (BLOCKS[id]?.hardness ?? 1) * multiplier);
  }
  stopMining() { this.mining = false; this.mineTime = 0; this.outline.scale.setScalar(1); }
  private trace() {
    this.camera.getWorldDirection(this.dir); this.ray.set(this.camera.position, this.dir);
    let ox = Math.floor(this.ray.origin.x), oy = Math.floor(this.ray.origin.y), oz = Math.floor(this.ray.origin.z);
    const sx = this.dir.x > 0 ? 1 : -1, sy = this.dir.y > 0 ? 1 : -1, sz = this.dir.z > 0 ? 1 : -1;
    const tdx = this.dir.x === 0 ? Infinity : Math.abs(1 / this.dir.x), tdy = this.dir.y === 0 ? Infinity : Math.abs(1 / this.dir.y), tdz = this.dir.z === 0 ? Infinity : Math.abs(1 / this.dir.z);
    let tmx = this.dir.x === 0 ? Infinity : (this.dir.x > 0 ? ox + 1 - this.ray.origin.x : this.ray.origin.x - ox) * tdx;
    let tmy = this.dir.y === 0 ? Infinity : (this.dir.y > 0 ? oy + 1 - this.ray.origin.y : this.ray.origin.y - oy) * tdy;
    let tmz = this.dir.z === 0 ? Infinity : (this.dir.z > 0 ? oz + 1 - this.ray.origin.z : this.ray.origin.z - oz) * tdz;
    const normal = new THREE.Vector3(); let distance = 0;
    for (let i = 0; i < 80 && distance < 6; i++) {
      const id = this.world.get(ox, oy, oz);
      if (id !== Block.Air && id !== Block.Carrot && id !== Block.Torch && id !== Block.Bedrock) return { x: ox, y: oy, z: oz, id: id as Block, normal };
      if (tmx < tmy && tmx < tmz) { distance = tmx; tmx += tdx; ox += sx; normal.set(-sx, 0, 0); }
      else if (tmy < tmz) { distance = tmy; tmy += tdy; oy += sy; normal.set(0, -sy, 0); }
      else { distance = tmz; tmz += tdz; oz += sz; normal.set(0, 0, -sz); }
    }
    return null;
  }
  private mine(dt: number) {
    if (!this.target) { this.mineTime = 0; return; }
    if (!this.mining) return;
    const key = `${this.target.x},${this.target.y},${this.target.z}`;
    if (key !== this.mineKey) { this.mineKey = key; this.mineTime = 0; }
    if (this.hitTimer > .18) { this.hitTimer = 0; this.audio.hit([Block.Stone, Block.Cobble, Block.Coal, Block.Iron, Block.Brick].includes(this.target.id)); this.particles(new THREE.Vector3(this.target.x, this.target.y, this.target.z), this.target.id, 2); }
    this.mineTime += dt;
    this.outline.scale.setScalar(1 + Math.sin(this.mineTime * 40) * .025);
    if (this.mineTime >= this.mineDuration()) {
      const { x, y, z, id } = this.target;
      const item = (id === Block.Stone || id === Block.Cobble ? Block.Cobble : id);
      if (addItem(this.inventory, item, 1)) {
        this.world.set(x, y, z, Block.Air); this.progress.mined++; this.particles(new THREE.Vector3(x, y, z), id, 10); this.audio.place(); this.save(); this.publish();
      } else this.onNotice('Inventory full. Open a slot in the inventory.', 'info');
      this.mineTime = 0; this.mineKey = ''; this.target = null;
    }
  }
  private hitTimer = 0;
  place() {
    if (!this.target) return;
    const stack = this.inventory[this.selected];
    if (!stack || BLOCKS[stack.id].kind !== 'block') { if (stack) this.eat(); else this.onNotice('This slot is empty. Choose a block from your hotbar.', 'info'); return; }
    const { x, y, z, normal } = this.target, bx = x + normal.x, by = y + normal.y, bz = z + normal.z;
    if (by <= 0 || by >= 64 || (this.world.get(bx, by, bz) !== Block.Air && this.world.get(bx, by, bz) !== Block.Carrot)) { this.onNotice('Choose an exposed face to place a block.', 'info'); return; }
    if (bx + 1 > this.player.x - .3 && bx < this.player.x + .3 && bz + 1 > this.player.z - .3 && bz < this.player.z + .3 && by < this.player.y + 1.82 && by + 1 > this.player.y) return;
    this.world.set(bx, by, bz, stack.id); if (stack.id === Block.Torch) this.particles(new THREE.Vector3(bx, by, bz), Block.Torch, 3);
    this.progress.placed++; if (this.mode !== 'creative') { stack.count--; if (!stack.count) this.inventory[this.selected] = null; }
    this.audio.place(); this.save(); this.publish();
  }
  private pick() { if (this.target) { this.selected = 0; this.selectCreative(this.target.id, 0); } }
  private particles(position: THREE.Vector3, id: Block, count: number) {
    const material = new THREE.MeshLambertMaterial({ color: BLOCKS[id]?.color || '#c9b783' });
    for (let i = 0; i < count; i++) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(.08 + Math.random() * .1, .1 + Math.random() * .1, .1), material); mesh.position.copy(position).add(new THREE.Vector3(.2 + Math.random() * .6, .2 + Math.random() * .6, .2 + Math.random() * .6)); this.scene.add(mesh); this.debris.push({ mesh, velocity: new THREE.Vector3((Math.random() - .5) * 3, 1.8 + Math.random() * 2, (Math.random() - .5) * 3), life: .6 + Math.random() * .4 }); }
  }
  private spawnCreature() {
    const angle = Math.random() * Math.PI * 2, distance = 6 + Math.random() * 15, x = this.player.x + Math.cos(angle) * distance, z = this.player.z + Math.sin(angle) * distance, y = this.world.highest(x, z) + 1;
    if (y < WATER_LEVEL || y > 35 || this.creatures.length > 7) return;
    const kind = Math.random() > .8 ? 'fox' : Math.random() > .7 ? 'pig' : 'sheep';
    const group = new THREE.Group(), bodyMat = new THREE.MeshLambertMaterial({ color: kind === 'sheep' ? '#e6e4d4' : kind === 'fox' ? '#ca8850' : '#d59d87' });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: THREE.Material) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color); mesh.position.set(x, y, z); mesh.castShadow = true; group.add(mesh); return mesh; };
    box(1.0, .62, 1.5, 0, .9, 0, bodyMat); box(.5, .5, .55, 0, 1.05, .83, bodyMat);
    const legs: THREE.Mesh[] = []; for (const lx of [-.31, .31]) for (const lz of [-.48, .48]) legs.push(box(.17, .62, .18, lx, .34, lz, new THREE.MeshLambertMaterial({ color: '#675d49' })));
    box(.12, .2, .12, -.19, 1.39, .77, bodyMat); box(.12, .2, .12, .19, 1.39, .77, bodyMat);
    if (kind === 'fox') { box(.15, .17, .7, 0, .85, -1, bodyMat); box(.16, .18, .26, 0, .85, -1.4, new THREE.MeshLambertMaterial({ color: '#eee0c7' })); }
    group.position.set(x + .5, y, z + .5); this.scene.add(group); this.creatures.push({ group, legs, dir: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)), age: Math.random() * 5 });
  }
  private animateCreatures(dt: number) {
    for (const animal of this.creatures) {
      animal.age -= dt;
      if (animal.age < 0) { animal.age = 5 + Math.random() * 8; animal.dir.set(Math.random() - .5, 0, Math.random() - .5).normalize(); }
      const direction = animal.group.position.clone().addScaledVector(animal.dir, 1.5); const ground = this.world.highest(direction.x, direction.z);
      if (ground === Math.floor(animal.group.position.y - 1)) { animal.group.position.addScaledVector(animal.dir, dt * .45); animal.group.rotation.y = Math.atan2(animal.dir.x, animal.dir.z); animal.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(this.autumn * 8 + i * Math.PI) * .13; }); }
      if (animal.group.position.distanceTo(this.player) > 45) animal.age = -1000;
    }
    this.creatures = this.creatures.filter(animal => { if (animal.age > -900) return true; this.removeAnimal(animal); return false; });
  }
  private removeAnimal(animal: AmbientCreature) { this.scene.remove(animal.group); animal.group.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); (o as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material?.dispose?.(); }); }
  private intersects(x: number, y: number, z: number): boolean {
    for (let bz = Math.floor(z - .28); bz <= Math.floor(z + .28); bz++) for (let by = Math.floor(y + .01); by <= Math.floor(y + 1.74); by++) for (let bx = Math.floor(x - .28); bx <= Math.floor(x + .28); bx++) if (isSolid(this.world.get(bx, by, bz))) return true;
    return false;
  }
  private physics(dt: number) {
    const forward = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - this.touchMove.y;
    const sideways = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.touchMove.x;
    const length = Math.hypot(forward, sideways) || 1;
    const speed = (this.flying ? 10 : this.keys.has('ShiftLeft') || this.keys.has('ControlLeft') ? 6.4 : 4.4) * (this.mode === 'survival' && this.hunger < 2 ? .7 : 1);
    const swim = this.player.y < WATER_LEVEL + .5;
    const vx = (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * sideways) / length * speed;
    const vz = (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * sideways) / length * speed;
    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, this.flying ? vx : vx, 1 - Math.exp(-15 * dt)); this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, vz, 1 - Math.exp(-15 * dt));
    if (this.flying) this.velocity.y = (Number(this.keys.has('Space') || this.jumpHeld) - Number(this.keys.has('ShiftLeft'))) * 6;
    else {
      this.velocity.y -= (swim ? 4.5 : 24) * dt;
      if ((this.keys.has('Space') || this.jumpHeld) && (this.grounded || swim)) { this.velocity.y = swim ? 4 : 8.4; this.grounded = false; }
    }
    const before = this.player.clone(), step = Math.max(Math.abs(vx * dt), Math.abs(vz * dt), Math.abs(this.velocity.y * dt), .05);
    // Substeps avoid tunneling even during a slow frame or a fast fall.
    const steps = Math.min(12, Math.ceil(step / .35));
    for (let i = 0; i < steps; i++) {
      const sub = dt / steps;
      let xx = this.velocity.x * sub, zz = this.velocity.z * sub;
      if (!this.intersects(this.player.x + xx, this.player.y, this.player.z)) this.player.x += xx;
      else if (!this.flying && this.grounded && !this.intersects(this.player.x + xx, this.player.y + 1.02, this.player.z)) this.player.y += 1.02;
      else { if (!this.intersects(this.player.x + xx, this.player.y, this.player.z + zz)) this.player.x += xx; this.velocity.x = 0; }
      if (!this.intersects(this.player.x, this.player.y, this.player.z + zz)) this.player.z += zz;
      else if (!this.flying && this.grounded && !this.intersects(this.player.x, this.player.y + 1.02, this.player.z + zz)) { this.player.z += zz; this.player.y += 1.02; }
      else this.velocity.z = 0;
      const yy = this.velocity.y * sub;
      if (!this.intersects(this.player.x, this.player.y + yy, this.player.z)) { this.player.y += yy; this.grounded = false; }
      else { if (this.velocity.y < 0) this.grounded = true; this.velocity.y = 0; }
    }
    this.progress.steps += this.player.distanceTo(before);
    const newBiome = biomeAt(this.player.x, this.player.z, this.player.y, this.seed);
    if (!this.progress.discovered.includes(newBiome)) { this.progress.discovered.push(newBiome); this.onNotice(`Discovered ${newBiome}`, 'success'); }
    if (this.progress.steps - this.lastStepDistance > 2 && this.grounded && (vx || vz)) { this.lastStepDistance = this.progress.steps; this.audio.step(); }
    if (this.player.y < -8) { if (this.mode === 'survival') this.health = Math.max(0, this.health - 3); this.rescue(); }
    if (this.mode === 'survival') {
      this.hungerAccumulator += dt; if (this.hungerAccumulator > 45) { this.hunger = Math.max(0, this.hunger - .4); this.hungerAccumulator = 0; }
      if (this.hunger <= .2) { this.healthAccumulator += dt; if (this.healthAccumulator > 8) { this.health = Math.max(0, this.health - 1); this.healthAccumulator = 0; } }
      else if (this.hunger > 8 && this.healthAccumulator > 5) { this.health = Math.min(10, this.health + .4); this.healthAccumulator = 0; }
      if (swim) { this.drownTimer += dt; if (this.drownTimer > 30) { this.health -= Math.ceil(dt); this.drownTimer = 20; } } else this.drownTimer = 0;
      if (this.health <= 0) { this.pause(); this.onNotice('You woke up by the cabin. Your belongings are still in your inventory.', 'info'); this.respawn(); }
    }
    this.camera.position.copy(this.player); this.camera.position.y += 1.65 + (swim ? -.15 : 0);
    if (this.settings.motion && this.grounded && (vx || vz)) this.camera.position.y += Math.sin(this.progress.steps * 4.5) * .035;
    this.camera.rotation.order = 'YXZ'; this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.world.stream(Math.floor(this.player.x), Math.floor(this.player.z));
  }
  private hungerAccumulator = 0;
  private healthAccumulator = 0;
  private lastStepDistance = 0;
  private drownTimer = 0;
  rescue() { this.player.set(.5, highestNearby(this.world, 0, 21) + 1.01, 21.5); this.velocity.set(0, 0, 0); this.onNotice('Back to the cabin. A fresh start.', 'success'); this.publish(); }
  respawn() { this.player.set(.5, highestNearby(this.world, 0, 21) + 1.01, 21.5); this.health = 10; this.hunger = 10; this.velocity.set(0, 0, 0); this.pause(); }
  private frame = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min(.05, Math.max(.001, (now - (this.lastFrame || now - 16)) / 1000)); this.lastFrame = now; this.autumn += dt; this.hitTimer += dt;
    this.world.frameDeadline = performance.now() + 4.5; this.world.ensure();
    if (this.playing && !this.paused && this.ui.ready) this.physics(dt);
    if (!this.firstPerson) {
      this.warmCamera.lerp(this.startCamera, dt * 3); this.camera.position.copy(this.warmCamera); this.camera.lookAt(this.initialTargetLook);
    }
    if (this.firstPerson && !this.paused) {
      this.target = this.trace();
      this.outline.visible = !!this.target;
      if (this.target) { this.outline.position.set(this.target.x + .5, this.target.y + .5, this.target.z + .5); this.mine(dt); }
      this.ring.visible = this.target?.id === Block.Torch;
      if (this.target) { this.ring.position.copy(this.outline.position); this.ring.position.y += .65; }
    } else { this.outline.visible = false; this.ring.visible = false; this.target = null; }
    this.time = (this.time + (this.paused ? dt * .00004 : dt * .00055)) % 1;
    this.updateAtmosphere(dt, now);
    for (const particle of this.debris) { particle.life -= dt; particle.velocity.y -= 10 * dt; particle.mesh.position.addScaledVector(particle.velocity, dt); particle.mesh.rotation.x += dt * 4; particle.mesh.scale.setScalar(Math.max(0, particle.life)); }
    this.debris = this.debris.filter(p => { if (p.life > 0) return true; this.scene.remove(p.mesh); p.mesh.geometry.dispose(); (p.mesh.material as THREE.Material).dispose(); return false; });
    this.creatureTimer += dt;
    if (this.creatureTimer > 5) { this.creatureTimer = 0; if (this.creatures.length < 6) this.spawnCreature(); if (Math.random() > .5) this.audio.bird(); }
    this.animateCreatures(this.paused ? 0 : dt);
    if (now - this.lastUI > 150) { this.publish(); this.lastUI = now; }
    if (this.playing && now - this.lastSave > 35000) this.save();
    this.renderer.render(this.scene, this.camera); this.frameId = requestAnimationFrame(this.frame);
  };
  private updateAtmosphere(dt: number, now: number) {
    const sun = Math.sin(this.time * Math.PI * 2), daylight = Math.max(.055, sun);
    const warm = Math.max(0, 1 - Math.abs(this.time - .28) * 4);
    this.sunlight.intensity = daylight * 2.1 + .06; this.ambient.intensity = daylight * 1.1 + .6;
    this.sunlight.color.setRGB(1, .78 + daylight * .17, .62 + daylight * .2);
    this.sunlight.position.set(-Math.cos(this.time * Math.PI * 2) * 65, Math.max(6, sun * 95), 35);
    this.sunlight.target.position.set(this.player.x, 8, this.player.z); this.sunlight.target.updateMatrixWorld();
    if (this.settings.shadows) { this.sunlight.position.x += this.player.x; this.sunlight.position.z += this.player.z; }
    const sky = (this.sky.material as THREE.ShaderMaterial).uniforms; sky.top.value.copy(this.dayColor).lerp(this.nightColor, 1 - daylight).lerp(new THREE.Color('#4c6e73'), warm * .6); sky.bottom.value.set(daylight > .3 ? '#d7e0c8' : '#354859').lerp(new THREE.Color('#e8cd9d'), warm * .6);
    (this.scene.fog as THREE.Fog).color.copy(sky.bottom.value).lerp(sky.top.value, .4);
    (this.renderer as THREE.WebGLRenderer & { toneMappingExposure: number }).toneMappingExposure = .9 + daylight * .35;
    this.sky.position.copy(this.player); this.clouds.position.x = Math.sin(now * .000008) * 8;
    (this.water.material as THREE.ShaderMaterial).uniforms.time.value += dt;
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) { this.weatherTimer = 180 + Math.random() * 240; this.weather = this.weather === 'Clear' ? 'Rain' : 'Clear'; this.onNotice(this.weather === 'Rain' ? 'Rain is moving through the valley.' : 'The skies are clearing.', 'info'); }
    this.rain.visible = this.weather === 'Rain'; this.rain.position.copy(this.player);
    if (this.rain.visible) { for (let i = 0; i < 1100; i++) this.dropPositions[i * 3 + 1] -= dt * 15; this.rain.geometry.attributes.position.needsUpdate = true; this.ambient.intensity *= .7; }
  }
  save() {
    if (!this.world || this.world.ready < 9) return false;
    try {
      const changes: Change[] = Array.from(this.world.changes, ([key, id]) => { const coordinates = key.split(',').map(Number); return [coordinates[0], coordinates[1], coordinates[2], id]; });
      const data: SavedWorld = { version: 1, seed: this.seed, name: this.worldName, position: this.player.toArray() as [number, number, number], yaw: this.yaw, pitch: this.pitch, inventory: this.inventory, selected: this.selected, mode: this.mode, health: this.health, hunger: this.hunger, time: this.time, changes, progress: this.progress, savedAt: Date.now() };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data)); this.lastSave = performance.now(); this.autoSaveWasReady = true; return true;
    } catch { if (this.autumn < 2 || this.lastSave > 10000) this.onNotice('Local storage is full or unavailable. This session cannot be saved.', 'info'); return false; }
  }
  exportWorld() { if (this.save()) { const blob = new Blob([localStorage.getItem(SAVE_KEY)!], { type: 'application/json' }); const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `${this.worldName.toLowerCase().replace(/\W+/g, '-')}.verdant.json`; a.click(); URL.revokeObjectURL(url); this.onNotice('World exported. Keep this file somewhere safe.', 'success'); } }
  async importWorld(file: File) {
    try {
      if (file.size > 12_000_000) throw new Error('too big');
      const data = JSON.parse(await file.text()) as SavedWorld;
      if (data.version !== 1 || typeof data.seed !== 'number' || !Array.isArray(data.position) || !data.position.every(n => Number.isFinite(n) && Math.abs(n) < 100000) || !Array.isArray(data.inventory) || data.inventory.length !== 36 || !Array.isArray(data.changes) || data.changes.length > 200000 || !data.changes.every(c => Array.isArray(c) && c.length === 4 && c.slice(0, 3).every(n => Number.isInteger(n) && Math.abs(n) <= 100000) && BLOCKS[c[3]])) throw new Error('invalid');
      if (!data.progress || !['creative', 'survival'].includes(data.mode) || data.inventory.some(s => s !== null && (!BLOCKS[s.id] || s.count <= 0 || s.count > 99))) throw new Error('invalid');
      this.world.changes.clear(); for (const [x, y, z, id] of data.changes) if (BLOCKS[id]) this.world.changes.set(`${x},${y},${z}`, id);
      this.world.dispose(); this.world = new VoxelWorld(this.scene, data.seed, data.changes, false); this.world.warmStart(12, 30); this.seed = data.seed; this.inventory = data.inventory; this.player.fromArray(data.position); this.yaw = data.yaw; this.pitch = data.pitch; this.selected = data.selected; this.health = data.health; this.hunger = data.hunger; this.mode = data.mode; this.time = data.time; this.progress = data.progress; this.worldName = data.name || 'Imported world'; this.save(); this.onNotice('A familiar world, a new beginning.', 'success');
    } catch { this.onNotice('That world file is not supported. Choose a valid .verdant.json export.', 'info'); }
  }
  setTime(time: number) { this.time = Math.max(0, Math.min(1, time)); this.weatherTimer = 300; }
  setWeather(weather: 'Clear' | 'Rain') { this.weather = weather; this.weatherTimer = 300; this.publish(); }
  teleport(x: number, z: number) { this.player.set(x, highestNearby(this.world, x, z) + 1.01, z); this.velocity.set(0, 0, 0); this.world.stream(Math.floor(x), Math.floor(z)); this.firstPerson = true; this.onNotice('A new place to call your own.', 'success'); }
  dispose() {
    this.save(); this.disposed = true; cancelAnimationFrame(this.frameId); this.resizeObserver.disconnect();
    for (const [type, handler] of this.events) window.removeEventListener(type, handler);
    this.renderer.domElement.removeEventListener('touchstart', this.onTouchStart); this.renderer.domElement.removeEventListener('touchmove', this.onTouchMove);
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock();
    this.world.dispose(); this.audio.dispose(); this.renderer.dispose();
    this.scene.traverse(object => { if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.LineSegments) { object.geometry.dispose(); const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach(m => m.dispose()); } });
    this.host.replaceChildren();
  }
}
function highestNearby(world: VoxelWorld, x: number, z: number) { return world.highest(x, z); }
type GameUIEvent = (message: string, kind?: 'item' | 'success' | 'info') => void;
