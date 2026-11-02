import { Renderer } from './renderer.js';
import { DEFAULT_SCENE, clone, validateScene } from './scene-builder.js';

const VERSION = '1.1.0';

class MainThreadWorker {
  constructor() {
    this.onmessage = null;
    this.onerror = null;
    this.closed = false;
    this.runtime = null;
    this.handler = null;
    this.queue = Promise.resolve();
    const owner = this;
    this.transport = {
      isMainThread: true,
      postMessage(data) {
        if (!owner.closed) queueMicrotask(() => owner.onmessage?.({ data }));
      },
    };
    Object.defineProperty(this.transport, 'onmessage', {
      get: () => this.handler,
      set: (fn) => { this.handler = fn; },
    });
    this.initPromise = import('./worker.js').then(({ createWorkerRuntime }) => {
      if (!this.closed) this.runtime = createWorkerRuntime(this.transport);
    }).catch(error => this.onerror?.({ message: error?.message || String(error), error }));
  }
  postMessage(data) {
    if (this.closed) return;
    this.queue = this.queue.then(async () => {
      if (this.closed) return;
      await this.initPromise;
      if (!this.closed) await this.handler?.({ data });
    }).catch(error => this.onerror?.({ message: error?.message || String(error), error }));
  }
  terminate() {
    this.closed = true;
    this.runtime?.dispose?.();
    this.runtime = null;
    this.handler = null;
  }
}
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
    this.fallbackAttempted = false;
    this.executionMode = 'worker';
    this.on('stats', (s) => { this.stats = s; onStats?.(s); });
    this.on('error', (e) => { onError?.(e); });
    this.on('ready', (r) => { this.ready = true; clearTimeout(this.startupTimer); onReady?.(r); this.loadScene(this.scene, { autoPlay: this.autoPlay }).catch(e => this.fail(e)); });
    this.on('state', (s) => { this.running = s.running; onState?.(s); });
    this.on('frame', (f) => onFrame?.(f));
    this.attachControls();
    this.startExecution(workerURL);
  }
  bindWorker(worker) {
    this.worker = worker;
    worker.onmessage = (ev) => this.receive(ev.data);
    worker.onerror = (event) => {
      if (!this.ready && !this.fallbackAttempted) this.startFallback(event?.message || 'Worker startup failed.');
      else this.fail(event?.message || 'The simulation worker failed.');
    };
  }
  startExecution(workerURL) {
    try {
      if (typeof Worker !== 'function') throw new Error('Web Workers are unavailable in this browser.');
      this.url = workerURL || new URL('./worker.js', import.meta.url);
      this.bindWorker(new Worker(this.url, { type: 'module', name: 'mpm-studio-solver' }));
      this.startupTimer = setTimeout(() => {
        if (!this.ready && !this.fallbackAttempted) this.startFallback('The worker did not initialize before the startup timeout.');
      }, 12000);
    } catch (error) {
      this.startFallback(error?.message || 'Could not create a Web Worker.');
    }
  }
  startFallback(reason) {
    if (this.fallbackAttempted || this.disposed || this.ready) return;
    this.fallbackAttempted = true;
    clearTimeout(this.startupTimer);
    try { this.worker?.terminate?.(); } catch { /* ignore */ }
    this.workerObjectURL = null;
    this.executionMode = 'main-thread';
    this.bindWorker(new MainThreadWorker());
    this.emit('fallback', { mode: 'main-thread', reason, warning: 'Simulation runs on the main thread and may reduce UI responsiveness.' });
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
    if (msg.type === 'error') {
      if (!this.ready && !this.fallbackAttempted) this.startFallback(`Worker initialization failed: ${msg.message}`);
      else this.fail(msg.message);
    }
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
    const config = this.options.camera || (typeof this.scene === 'object' ? (this.scene.camera || this.scene.metadata?.camera) : null);
    return config || this.info?.camera;
  }
  async loadScene(scene, options = {}) {
    if (this.disposed) throw new Error('This simulation has been disposed.');
    if (typeof scene === 'string' && registry.has(scene)) scene = clone(registry.get(scene));
    const scriptScene = scene && typeof scene === 'object' && ['module', 'inline'].includes(scene.kind);
    if (typeof scene === 'object' && !scriptScene) validateScene(scene);
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
  async loadSceneModule(url, options = {}) {
    const absoluteURL = new URL(url, document.baseURI).href;
    const scene = { kind: 'module', url: absoluteURL, metadata: options.metadata || {} };
    return this.loadScene(scene, options);
  }
  async loadInlineScene(source, metadata = {}, options = {}) {
    if (typeof source !== 'string' || !source.trim()) throw new Error('Inline JavaScript source must be a non-empty string.');
    return this.loadScene({ kind: 'inline', source, metadata }, options);
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
  addWheel(config) { return this.addRigid({ shape: 'wheel', ...config }); }
  addArticulation(config) { return this.request({ type: 'articulation', config }); }
  addEmitter(config) { return this.request({ type: 'add', object: { type: 'emitter', material: 'water', ...config } }); }
  generalAction(config) { return this.request({ type: 'action', config }); }
  setGravity(value) { return this.update({ gravity: value }); }
  /** Send serializable user input to a JavaScript scene's worker-side onMessage(name, payload, api). */
  send(name, payload = {}) { return this.request({ type: 'sceneMessage', name, payload }); }
  emitParticles(position, velocity = [0, 0.4], material = 'water', color) { this.worker.postMessage({ type: 'emit', position, velocity, material, color }); return this; }
  getStats() { return this.stats ? { ...this.stats, prof: [...this.stats.prof] } : null; }
  getCamera() { return clone(this.renderer.camera); }
  setCamera(camera) { this.renderer.camera = { ...this.renderer.camera, ...camera }; this.renderer.requestRender(); return this; }
  resetCamera() { this.renderer.resetCamera(); return this; }
  attachControls() {
    this.pointer = { down: false, x: 0, y: 0, pointerId: null, wasMoving: false, lastTouch: 0 };
    this.interaction = { enabled: true, mode: 'touch', forwardToScene: false };
    this.canvas.style.touchAction = 'none';
    this.canvas.tabIndex = this.canvas.tabIndex >= 0 ? this.canvas.tabIndex : 0;
    const c = this.canvas;
    this.cleanupListeners = [];
    const listen = (type, handler, options) => { c.addEventListener(type, handler, options); this.cleanupListeners.push(() => c.removeEventListener(type, handler, options)); };
    listen('pointerdown', (event) => {
      if (!this.interaction.enabled || !this.info) return;
      c.setPointerCapture(event.pointerId);
      this.pointer.down = true; this.pointer.x = event.clientX; this.pointer.y = event.clientY;
      if (this.interaction.mode === 'touch' || this.interaction.mode === 'custom') this.interact(event);
      const payload = { x: event.clientX, y: event.clientY, position: this.worldPosition(event), pointerType: event.pointerType, buttons: event.buttons };
      this.emit('pointerdown', payload);
      if (this.interaction.forwardToScene) this.send('pointerdown', payload).catch(error => this.emit('error', error));
    });
    listen('pointermove', (event) => {
      if (!this.pointer.down) return;
      if (this.interaction.mode === 'touch' || this.interaction.mode === 'custom') this.interact(event);
      else if (this.info?.dim === 3) {
        this.renderer.camera.yaw -= (event.clientX - this.pointer.x) * 0.4;
        this.renderer.camera.pitch = Math.max(-5, Math.min(85, this.renderer.camera.pitch + (event.clientY - this.pointer.y) * 0.3));
        this.renderer.requestRender();
      }
      const payload = { x: event.clientX, y: event.clientY, position: this.worldPosition(event), pointerType: event.pointerType, buttons: event.buttons };
      this.emit('pointermove', payload);
      if (this.interaction.forwardToScene) this.send('pointermove', payload).catch(error => this.emit('error', error));
      this.pointer.x = event.clientX; this.pointer.y = event.clientY;
    });
    listen('pointerup', (event) => { this.pointer.down = false; const payload = { x: event.clientX, y: event.clientY, position: this.worldPosition(event), pointerType: event.pointerType }; this.emit('pointerup', payload); if (this.interaction.forwardToScene) this.send('pointerup', payload).catch(error => this.emit('error', error)); });
    listen('pointercancel', (event) => { this.pointer.down = false; const payload = { x: event.clientX, y: event.clientY, pointerType: event.pointerType }; this.emit('pointercancel', payload); if (this.interaction.forwardToScene) this.send('pointercancel', payload).catch(error => this.emit('error', error)); });
    listen('keydown', (event) => { const payload = { key: event.key, code: event.code, repeat: event.repeat }; this.emit('keydown', { ...payload, originalEvent: event }); if (this.interaction.forwardToScene) this.send('keydown', payload).catch(error => this.emit('error', error)); });
    listen('keyup', (event) => { const payload = { key: event.key, code: event.code }; this.emit('keyup', { ...payload, originalEvent: event }); if (this.interaction.forwardToScene) this.send('keyup', payload).catch(error => this.emit('error', error)); });
    listen('dblclick', () => this.resetCamera());
  }
  setInteraction({ enabled = true, mode = 'touch', forwardToScene = false } = {}) {
    this.interaction = { enabled, mode, forwardToScene };
    this.renderer.interactionEnabled = mode === 'orbit';
    return this;
  }
  worldPosition(event) {
    if (!this.info) return null;
    const rect = this.canvas.getBoundingClientRect();
    const nx = (event.clientX - rect.left) / rect.width, ny = 1 - (event.clientY - rect.top) / rect.height;
    if (this.info.dim === 2) {
      const a = rect.width / rect.height, m = 0.52;
      const width = a >= 1 ? m * a * 2 : m * 2;
      const height = a >= 1 ? m * 2 : m * 2 / a;
      return [0.5 + (nx - 0.5) * width, 0.5 + (ny - 0.5) * height];
    }
    const a = rect.width / rect.height, m = this.renderer.camera.distance * Math.tan(20 * Math.PI / 180);
    const c = this.renderer.camera.target;
    return [c[0] + (nx - 0.5) * m * 2 * a, c[1] + (ny - 0.5) * m * 2, c[2]];
  }
  interact(event) {
    if (performance.now() - this.pointer.lastTouch < 80) return;
    this.pointer.lastTouch = performance.now();
    const world = this.worldPosition(event);
    if (!world) return;
    this.emit('interact', { position: world, clientX: event.clientX, clientY: event.clientY, pointerType: event.pointerType });
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
    clearTimeout(this.startupTimer);
    this.worker.terminate(); this.renderer.dispose(); this.cleanupListeners.forEach(fn => fn());
    this.workerObjectURL = null;
    this.listeners.clear();
    for (const { reject } of this.pending.values()) reject(new Error('Simulation disposed.'));
    this.pending.clear();
    if (this.canvas.parentNode === this.container) this.canvas.remove();
  }
}
export async function create(options = {}) { return new Simulation(options); }
export { Simulation as TaichiSimulation, VERSION as version };
export default { version: VERSION, create, Simulation, registerScene, unregisterScene, getRegisteredScenes, starterScene, COLOR_MODES };
