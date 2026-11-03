import { Renderer } from './renderer.js';
import workerSource from './worker-source.js';
import { DEFAULT_SCENE, clone, validateScene } from './scene-builder.js';

const VERSION = '1.0.0';
const listeners = new Map();
const registry = new Map();
export function registerScene(scene) {
  validateScene(scene);
  if (!scene.id) throw new Error('A registered scene needs an id.');
  registry.set(scene.id, clone(scene));
  return clone(scene);
}
export function unregisterScene(id) { return registry.delete(id); }
export function getRegisteredScenes() { return [...registry.values()].map(clone); }
export const starterScene = clone(DEFAULT_SCENE);
const COLOR_MODES = ['Material colour', 'Velocity', 'CPIC side / affinity', 'Constitutive model', 'Plastic state'];
export { COLOR_MODES };

/** A browser-only, framework-independent wrapper for the WebAssembly solver. */
export class Simulation {
  constructor({ container, canvas, scene = 'cutting', quality = 'medium', autoPlay = false, onStats, onError, onReady, onState, onFrame, workerURL, renderOptions = {}, ...options } = {}) {
    this.options = options;
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!this.container && !canvas) throw new Error('Provide container: an element or selector, or a canvas.');
    this.canvas = canvas || document.createElement('canvas');
    if (!canvas) { this.canvas.className = 'taichi-canvas'; this.container.appendChild(this.canvas); }
    this.scene = scene; this.quality = quality; this.autoPlay = autoPlay; this.stats = null; this.info = null;
    this.running = false; this.ready = false; this.disposed = false; this.requestId = 0; this.pending = new Map(); this.listeners = new Map();
    this.renderer = new Renderer(this.canvas);
    this.renderer.interactionEnabled = false;
    this.renderer.options = { showRigids: true, showBlocks: false, pointScale: 1, grid: true, ...renderOptions };
    this.workerURL = workerURL;
    this.workerObjectURL = null;
    this.url = workerURL || URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }));
    if (!workerURL) this.workerObjectURL = this.url;
    this.worker = new Worker(this.url, { type: 'classic', name: 'taichi-mpm-solver' });
    this.worker.onmessage = (ev) => this.receive(ev.data);
    this.worker.onerror = (event) => {
      this.fail(event.message || 'Could not start the simulation worker.');
    };
    this.on('stats', (s) => { this.stats = s; onStats?.(s); });
    this.on('error', (e) => { onError?.(e); });
    this.on('ready', (r) => { this.ready = true; onReady?.(r); this.loadScene(this.scene, { autoPlay: this.autoPlay }).catch(e => this.fail(e)); });
    this.on('state', (s) => { this.running = s.running; onState?.(s); });
    this.on('frame', (f) => onFrame?.(f));
    this.attachControls();
  }
  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }
  off(event, handler) { this.listeners.get(event)?.delete(handler); }
  emit(event, payload) { for (const handler of this.listeners.get(event) || []) { try { handler(payload); } catch (e) { console.error('TaichiMPM event handler:', e); } } }
  fail(error) {
    this.emit('error', error instanceof Error ? error : new Error(String(error)));
    for (const { reject } of this.pending.values()) reject(error instanceof Error ? error : new Error(String(error)));
    this.pending.clear();
  }
  receive(msg) {
    if (msg.type === 'loaded') {
      this.info = msg.info; this.scene = msg.info.custom ? this.scene : msg.info.sceneId;
      this.renderer.setScene(msg.info, this.cameraForScene(), msg.info.decor || []);
      this.emit('loaded', msg.info);
    }
    if (msg.type === 'frame') {
      this.renderer.setFrame(msg.particles, msg.count, msg.rigids, msg.blocks, msg.stats.blockSize);
      this.stats = msg.stats;
      this.emit('stats', msg.stats); this.emit('frame', msg);
      this.worker.postMessage({ type: 'ack' });
    }
    if (msg.type === 'ready') this.emit('ready', msg);
    if (msg.type === 'state') this.emit('state', msg);
    if (msg.type === 'controls') this.emit('controls', msg.controls);
    if (msg.type === 'log') this.emit('log', msg);
    if (msg.type === 'error') this.fail(msg.message);
    if (msg.type === 'result') {
      const pending = this.pending.get(msg.requestId);
      if (pending) { pending.resolve(msg.result); this.pending.delete(msg.requestId); }
      if (msg.requestId === this.loadRequestId) this.loadRequestId = null;
    }
  }
  request(msg) {
    if (this.disposed) return Promise.reject(new Error('This simulation has been disposed.'));
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ ...msg, requestId: id });
    });
  }
  cameraForScene() {
    const config = this.options.camera || (typeof this.scene === 'object' ? this.scene.camera : null);
    return config || this.info?.camera;
  }
  async loadScene(scene, options = {}) {
    if (this.disposed) throw new Error('This simulation has been disposed.');
    if (typeof scene === 'string' && registry.has(scene)) scene = clone(registry.get(scene));
    if (typeof scene === 'object') validateScene(scene);
    const ready = this.ready ? Promise.resolve() : new Promise((resolve, reject) => {
      const timer = setTimeout(() => { unsubscribe(); reject(new Error('The WebAssembly engine did not initialize in time. Try reloading this page.')); }, 30000);
      const unsubscribe = this.on('ready', () => { clearTimeout(timer); resolve(); });
    });
    await ready;
    this.scene = scene;
    const requestId = ++this.requestId;
    this.loadRequestId = requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage({ type: 'load', scene, quality: options.quality || this.quality, colorMode: this.renderer.colorMode ?? 0, showBlocks: this.renderer.options.showBlocks, autoPlay: options.autoPlay ?? this.autoPlay, requestId });
    });
  }
  play() { this.worker.postMessage({ type: 'play' }); return this; }
  pause() { this.worker.postMessage({ type: 'pause' }); return this; }
  step() { this.worker.postMessage({ type: 'step' }); return this; }
  reset(options = {}) { return this.loadScene(this.scene, { ...options, autoPlay: options.autoPlay ?? this.running }); }
  setOptions(options = {}) {
    this.renderer.options = { ...this.renderer.options, ...options };
    if (options.camera) this.renderer.camera = { ...this.renderer.camera, ...options.camera };
    if (options.colorMode !== undefined) { this.renderer.colorMode = options.colorMode; this.worker.postMessage({ type: 'colorMode', mode: options.colorMode }); }
    if (options.showBlocks !== undefined) this.worker.postMessage({ type: 'showBlocks', value: options.showBlocks });
    this.renderer.requestRender(); return this;
  }
  update(patch) { this.worker.postMessage({ type: 'update', patch }); return this; }
  addParticles(config) { return this.request({ type: 'add', object: { type: 'particles', material: 'water', ...config } }); }
  addRigid(config) { return this.request({ type: 'add', object: { type: 'rigid', ...config } }); }
  emitParticles(position, velocity = [0, 0.4], material = 'water', color) { this.worker.postMessage({ type: 'emit', position, velocity, material, color }); return this; }
  getStats() { return this.stats ? { ...this.stats, prof: [...this.stats.prof] } : null; }
  getCamera() { return clone(this.renderer.camera); }
  setCamera(camera) { this.renderer.camera = { ...this.renderer.camera, ...camera }; this.renderer.requestRender(); return this; }
  resetCamera() { this.renderer.resetCamera(); return this; }
  attachControls() {
    this.pointer = { down: false, x: 0, y: 0, pointerId: null, wasMoving: false, lastTouch: 0 };
    this.interaction = { enabled: true, mode: 'touch' };
    this.canvas.style.touchAction = 'none';
    const c = this.canvas;
    this.cleanupListeners = [];
    const listen = (type, handler, options) => { c.addEventListener(type, handler, options); this.cleanupListeners.push(() => c.removeEventListener(type, handler, options)); };
    listen('pointerdown', (event) => {
      if (!this.interaction.enabled || !this.info) return;
      c.setPointerCapture(event.pointerId);
      this.pointer.down = true; this.pointer.x = event.clientX; this.pointer.y = event.clientY;
      if (this.interaction.mode === 'touch' || this.interaction.mode === 'custom') this.interact(event);
      this.emit('pointerdown', { x: event.clientX, y: event.clientY });
    });
    listen('pointermove', (event) => {
      if (!this.pointer.down) return;
      if (this.interaction.mode === 'touch' || this.interaction.mode === 'custom') this.interact(event);
      else if (this.info?.dim === 3) {
        this.renderer.camera.yaw -= (event.clientX - this.pointer.x) * 0.4;
        this.renderer.camera.pitch = Math.max(-5, Math.min(85, this.renderer.camera.pitch + (event.clientY - this.pointer.y) * 0.3));
        this.renderer.requestRender();
      }
      this.pointer.x = event.clientX; this.pointer.y = event.clientY;
    });
    listen('pointerup', () => { this.pointer.down = false; this.emit('pointerup', {}); });
    listen('pointercancel', () => { this.pointer.down = false; });
    listen('dblclick', () => this.resetCamera());
  }
  setInteraction({ enabled = true, mode = 'touch' } = {}) {
    this.interaction = { enabled, mode };
    this.renderer.interactionEnabled = mode === 'orbit';
    return this;
  }
  interact(event) {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = event.pointerType === 'touch' ? 1 : 1;
    if (performance.now() - this.pointer.lastTouch < 80) return;
    this.pointer.lastTouch = performance.now();
    const nx = (event.clientX - rect.left) / rect.width, ny = 1 - (event.clientY - rect.top) / rect.height;
    let world;
    if (this.info.dim === 2) {
      const a = rect.width / rect.height, m = 0.52;
      const width = a >= 1 ? m * a * 2 : m * 2;
      const height = a >= 1 ? m * 2 : m * 2 / a;
      world = [0.5 + (nx - 0.5) * width, 0.5 + (ny - 0.5) * height];
    } else {
      // 3D emits on a plane through the camera target; orbit controls remain available.
      const a = rect.width / rect.height, m = this.renderer.camera.distance * Math.tan(20 * Math.PI / 180);
      const c = this.renderer.camera.target;
      world = [c[0] + (nx - 0.5) * m * 2 * a, c[1] + (ny - 0.5) * m * 2, c[2]];
    }
    this.emit('interact', { position: world, clientX: event.clientX, clientY: event.clientY });
    if (this.interaction.mode !== 'custom') this.worker.postMessage({ type: 'emit', position: world, velocity: [(event.clientX - this.pointer.x) * 0.015, (this.pointer.y - event.clientY) * 0.015, 0].slice(0, this.info.dim), material: this.options.material || 'water', color: this.options.color });
  }
  snapshot() {
    this.renderer.render();
    const link = document.createElement('a');
    link.download = `taichi-${Date.now()}.png`;
    link.href = this.canvas.toDataURL('image/png');
    link.click();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.worker.terminate(); this.renderer.dispose(); this.cleanupListeners.forEach(fn => fn());
    if (this.workerObjectURL) URL.revokeObjectURL(this.workerObjectURL);
    this.listeners.clear();
    for (const { reject } of this.pending.values()) reject(new Error('Simulation disposed.'));
    this.pending.clear();
    if (this.canvas.parentNode === this.container) this.canvas.remove();
  }
}
export async function create(options = {}) { return new Simulation(options); }
export { Simulation as TaichiSimulation, VERSION as version };
export default { version: VERSION, create, Simulation, registerScene, unregisterScene, getRegisteredScenes, starterScene, COLOR_MODES };
