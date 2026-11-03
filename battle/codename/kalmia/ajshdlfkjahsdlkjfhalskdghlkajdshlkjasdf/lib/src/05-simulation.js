// ===========================================================================
// Simulation — main-thread public API. Bridges to a SimHost running in a
// dedicated worker (spawned from this very file) or, as a fallback, in-page.
// ===========================================================================
var SCRIPT_URL = (!IS_WORKER && typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || null;

/** Serialize a scene definition (functions -> source) for structured clone. */
function packScene(def) {
  if (typeof def === 'string') return def;
  if (!def || typeof def !== 'object') throw new Error('MPM.js: scene must be an id string or a definition object');
  var out = {};
  for (var key of Object.keys(def)) {
    var v = def[key];
    if (key === 'setup' && typeof v === 'function') out.setupSource = v.toString();
    else if (key === 'frameUpdate' && typeof v === 'function') out.frameUpdateSource = v.toString();
    else out[key] = packValue(v);
  }
  if (!out.id) out.id = def.id || 'custom';
  return out;
}
function packValue(v) {
  if (typeof v === 'function') return { __fn: v.toString() };
  if (Array.isArray(v)) return v.map(packValue);
  if (v && typeof v === 'object' && v.constructor === Object) {
    var o = {};
    for (var k of Object.keys(v)) o[k] = packValue(v[k]);
    return o;
  }
  return v;
}

function hexToRgb(hex) {
  if (Array.isArray(hex)) return hex;
  var m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return [0.043, 0.059, 0.09];
  var n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

var COLOR_MODES = { material: 0, velocity: 1, cpic: 2, default: 3, plasticity: 4 };

class Simulation {
  constructor(target, options) {
    options = options || {};
    this.options = options;
    var el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) throw new Error('MPM.js: target element not found');
    var canvas;
    if (el.tagName === 'CANVAS') canvas = el;
    else {
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
      el.appendChild(canvas);
      this._ownCanvas = canvas;
    }
    canvas.style.touchAction = 'none';
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    if (options.background) this.renderer.options.background = hexToRgb(options.background);
    if (options.pointScale) this.renderer.options.pointScale = options.pointScale;

    this._listeners = {};
    this._actionId = 1;
    this._actions = new Map();
    this._state = { running: false, finished: false, loaded: false, simd: false, mode: 'boot' };
    this.stats = null;
    this.info = null;
    this.quality = options.quality || 'medium';
    this.colorMode = typeof options.colorMode === 'string' ? (COLOR_MODES[options.colorMode] || 0) : (options.colorMode || 0);
    this.showBlocks = !!options.showBlocks;
    this.loop = !!options.loop;
    this.pointerState = Object.assign({ mode: 'off', strength: 10, size: 0.02 }, options.pointer || {});
    this._lastLoad = null;
    this._destroyed = false;
    this._fallbackTried = false;

    var self_ = this;
    this.ready = new Promise(function (resolve, reject) { self_._readyResolve = resolve; self_._readyReject = reject; });
    this.ready.catch(function () {});
    this._attachPointer();
    this._startBridge(options.worker !== false).then(function () {
      if (options.scene !== undefined) {
        self_.loadScene(options.scene, { quality: self_.quality, autostart: options.autostart !== false });
      }
    }).catch(function (e) { self_._emit('error', { message: String((e && e.message) || e) }); });
  }

  // ------------------------------------------------------------- bridge
  async _startBridge(useWorker) {
    var self_ = this;
    if (useWorker && typeof Worker !== 'undefined') {
      try {
        var source = await Simulation._getSource();
        var url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        var worker = new Worker(url);
        URL.revokeObjectURL(url);
        this._worker = worker;
        this._bridge = {
          post: function (msg, transfer) { worker.postMessage(msg, transfer || []); },
          terminate: function () { worker.terminate(); },
        };
        worker.onmessage = function (ev) { self_._onMessage(ev.data); };
        worker.onerror = function (ev) {
          self_._emit('error', { message: 'Worker error: ' + (ev.message || 'unknown') });
          if (!self_._fallbackTried) { self_._fallbackTried = true; self._switchToLocal(); }
        };
        this._state.mode = 'worker';
        return;
      } catch (e) {
        // fall through to local mode (file://, CSP, etc.)
      }
    }
    this._startLocal();
  }

  _startLocal() {
    var self_ = this;
    this._state.mode = 'main';
    this._host = new SimHost(function (msg) { queueMicrotask(function () { self_._onMessage(msg); }); });
    this._bridge = {
      post: function (msg) { queueMicrotask(function () { self_._host.handle(msg); }); },
      terminate: function () {},
    };
    this._host.ensureEngine().catch(function (e) { self_._host.fail(e); });
  }

  _switchToLocal() {
    if (this._worker) { this._worker.terminate(); this._worker = null; }
    this._startLocal();
    if (this._lastLoad) this.loadScene(this._lastLoad.scene, this._lastLoad.opts);
  }

  static _getSource() {
    if (MPM.__inlineSource) return Promise.resolve(MPM.__inlineSource);
    if (!MPM.__sourcePromise) {
      if (!SCRIPT_URL) return Promise.reject(new Error('no script URL; set MPM.__inlineSource'));
      MPM.__sourcePromise = fetch(SCRIPT_URL).then(function (r) {
        if (!r.ok) throw new Error('failed to fetch mpm.js source (' + r.status + ')');
        return r.text();
      });
    }
    return MPM.__sourcePromise;
  }

  // ------------------------------------------------------------- messages
  _onMessage(msg) {
    if (this._destroyed) return;
    switch (msg.type) {
      case 'ready':
        this._state.simd = msg.simd;
        this._readyResolve(this);
        this._emit('ready', { simd: msg.simd, mode: this._state.mode });
        break;
      case 'loaded':
        this.info = msg.info;
        this._state.loaded = true;
        this.renderer.setScene(msg.info, msg.info.camera, msg.info.decor);
        this._post({ type: 'pointer', state: this.pointerState });
        this._emit('loaded', msg.info);
        break;
      case 'frame':
        this.stats = msg.stats;
        this.renderer.setParticles(msg.particles, msg.count);
        this.renderer.setRigids(msg.rigids);
        if (msg.blocks) this.renderer.setBlocks(msg.blocks, msg.stats.blockSize);
        this._post({ type: 'ack' });
        this._emit('frame', msg.stats);
        break;
      case 'state': {
        var wasFinished = this._state.finished;
        this._state.running = msg.running;
        this._state.finished = msg.finished;
        this._emit('state', { running: msg.running, finished: msg.finished });
        if (msg.finished && !wasFinished) {
          this._emit('finished', {});
          if (this.loop && this._lastLoad) {
            var self_ = this;
            setTimeout(function () {
              if (self_.loop && !self_._destroyed) self_.loadScene(self_._lastLoad.scene, Object.assign({}, self_._lastLoad.opts, { autostart: true }));
            }, 400);
          }
        }
        break;
      }
      case 'log':
        this._emit('log', { line: msg.line, level: msg.level });
        break;
      case 'error':
        this._emit('error', { message: msg.message });
        break;
      case 'result': {
        var p = this._actions.get(msg.id);
        if (p) {
          this._actions.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error));
          else p.resolve(msg.value);
        }
        break;
      }
    }
  }

  _post(msg, transfer) { if (this._bridge && !this._destroyed) this._bridge.post(msg, transfer); }

  _action(name, cfg) {
    var self_ = this;
    var id = this._actionId++;
    return new Promise(function (resolve, reject) {
      self_._actions.set(id, { resolve: resolve, reject: reject });
      self_._post({ type: 'action', id: id, name: name, cfg: packValue(cfg === undefined ? {} : cfg) });
    });
  }

  // -------------------------------------------------------------- events
  on(event, fn) {
    (this._listeners[event] = this._listeners[event] || []).push(fn);
    return this;
  }
  off(event, fn) {
    var l = this._listeners[event];
    if (l) this._listeners[event] = l.filter(function (f) { return f !== fn; });
    return this;
  }
  _emit(event, data) {
    var l = this._listeners[event];
    if (!l) return;
    for (var fn of l.slice()) {
      try { fn(data); } catch (e) { if (typeof console !== 'undefined') console.error('MPM.js listener error:', e); }
    }
  }

  // ------------------------------------------------------------ lifecycle
  /** Load a built-in scene id, a declarative scene object or a scripted scene. */
  loadScene(scene, opts) {
    opts = opts || {};
    if (opts.quality) this.quality = opts.quality;
    if (opts.loop !== undefined) this.loop = !!opts.loop;
    var packed = packScene(typeof scene === 'string' ? (MPM.scenes[scene] || scene) : scene);
    this._lastLoad = { scene: scene, opts: Object.assign({}, opts, { quality: this.quality }) };
    this._state.loaded = false;
    this._state.finished = false;
    this._post({
      type: 'load', scene: packed, quality: this.quality,
      colorMode: this.colorMode, showBlocks: this.showBlocks,
      autostart: opts.autostart !== false, pointer: this.pointerState,
    });
    return this;
  }
  play() { this._post({ type: 'play' }); return this; }
  pause() { this._post({ type: 'pause' }); return this; }
  toggle() { return this._state.running ? this.pause() : this.play(); }
  /** Advance a single frame while paused. */
  step() { this._post({ type: 'step' }); return this; }
  /** Rebuild the current scene from scratch. */
  reset(opts) {
    if (!this._lastLoad) return this;
    var autostart = opts && opts.autostart !== undefined ? opts.autostart : this._state.running;
    return this.loadScene(this._lastLoad.scene, Object.assign({}, this._lastLoad.opts, { autostart: autostart }));
  }
  get state() { return Object.assign({}, this._state); }
  get time() { return this.stats ? this.stats.t : 0; }

  // ---------------------------------------------------- live configuration
  setQuality(q) {
    this.quality = q;
    return this.reset();
  }
  setColorMode(mode) {
    this.colorMode = typeof mode === 'string' ? (COLOR_MODES[mode] !== undefined ? COLOR_MODES[mode] : 0) : mode;
    this._post({ type: 'colorMode', mode: this.colorMode });
    return this;
  }
  setShowBlocks(v) {
    this.showBlocks = !!v;
    this.renderer.options.showBlocks = !!v;
    this._post({ type: 'showBlocks', value: !!v });
    return this;
  }
  setPointScale(v) { this.renderer.options.pointScale = v; this.renderer.requestRender(); return this; }
  setBackground(color) { this.renderer.options.background = hexToRgb(color); this.renderer.requestRender(); return this; }
  setShowRigids(v) { this.renderer.options.showRigids = !!v; this.renderer.requestRender(); return this; }

  /** Live physics parameters: {gravity:[x,y], penalty, pushing_force}. */
  setConfig(cfg) { return this._action('setConfig', cfg); }
  setGravity(g) { return this.setConfig({ gravity: g }); }

  // ------------------------------------------------- live scene authoring
  /** Inject material or rigid particles into the running simulation. */
  addParticles(cfg) { return this._action('addParticles', cfg); }
  /** Sugar for addParticles({type:'rigid', ...}). Use shape:{circle|box|polygon|star|wheel}. */
  addRigid(cfg) { return this._action('addRigid', cfg); }
  /** Add a paddle wheel. mode:'motor' spins at opts.speed (deg/s); 'free' is driven by the material. */
  addWheel(opts) { return this._action('addWheel', opts || {}); }
  /** Continuous particle emitter. Returns a source id promise. */
  addSource(opts) { return this._action('addSource', opts || {}); }
  removeSource(id) { return this._action('removeSource', { id: id }); }
  clearSources() { return this._action('clearSources', {}); }
  addArticulation(cfg) { return this._action('addArticulation', cfg); }
  generalAction(cfg) { return this._action('generalAction', cfg); }
  /** Per-frame hook fn(t, dt, api) executed inside the simulation loop. */
  onUpdate(fn) { return this._action('setUpdate', fn ? { __fn: fn.toString() } : null); }
  /** Total mechanical energy of the particle system. */
  energy() { return this._action('energy', {}); }

  // -------------------------------------------------------------- pointer
  /** Pointer tool: {mode:'off'|'push'|'spawn'|'tilt', strength, size, material}. */
  setPointer(opts) {
    Object.assign(this.pointerState, opts || {});
    this._post({ type: 'pointer', state: this.pointerState });
    return this;
  }
  get pointer() { return Object.assign({}, this.pointerState); }

  _attachPointer() {
    var self_ = this;
    var down = false;
    var send = function (e) {
      var w = self_.renderer.screenToWorld(e.clientX, e.clientY);
      self_._post({ type: 'pointer', state: { x: w[0], y: w[1], down: down } });
      self_._emit('pointer', { x: w[0], y: w[1], down: down });
    };
    this.canvas.addEventListener('pointerdown', function (e) {
      if (!self_.info || self_.info.dim !== 2 || self_.pointerState.mode === 'off') return;
      down = true;
      self_.canvas.setPointerCapture(e.pointerId);
      send(e);
    });
    this.canvas.addEventListener('pointermove', function (e) {
      if (!self_.info || self_.info.dim !== 2 || self_.pointerState.mode === 'off') return;
      send(e);
    });
    var up = function (e) {
      if (!down) return;
      down = false;
      send(e);
    };
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
  }

  destroy() {
    this._destroyed = true;
    if (this._bridge) this._bridge.terminate();
    this.renderer.dispose();
    if (this._ownCanvas && this._ownCanvas.parentNode) this._ownCanvas.parentNode.removeChild(this._ownCanvas);
    this._listeners = {};
    this._actions.clear();
  }
}

// ------------------------------------------------------------------ public
MPM.create = function (target, options) { return new Simulation(target, options); };
MPM.registerScene = function (id, def) {
  def = Object.assign({}, def, { id: id });
  MPM.scenes[id] = def;
  return def;
};
MPM.listScenes = function () {
  return Object.keys(MPM.scenes).map(function (id) {
    var s = MPM.scenes[id];
    return { id: id, name: s.name || id, dim: s.dim || 2, description: s.description || '', features: s.features || [], duration: s.duration || 0 };
  });
};
MPM.colorModes = COLOR_MODES;
MPM.Simulation = Simulation;
MPM.Engine = Engine;
MPM.Solver = Solver;
MPM.Texture = Texture;
MPM.TextureFactory = TextureFactory;
MPM.SegmentMesh = SegmentMesh;
MPM.TriangleMesh = TriangleMesh;
MPM.LevelSet = LevelSet;
MPM.Helpers = Helpers;
MPM.Renderer = IS_WORKER ? null : Renderer;
MPM.__internals = { SimHost: SimHost, packScene: packScene, unpackScene: unpackScene, resolveCfg: resolveCfg, buildWheel: buildWheel, buildTexture: buildTexture };