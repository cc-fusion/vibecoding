// ===========================================================================
// SimHost — owns the Engine, executes scenes, streams frames. Runs inside a
// dedicated worker (preferred) or on the main thread as a fallback.
// ===========================================================================
class SimHost {
  constructor(post) {
    this.post = post; // post(msg, transferList)
    this.engine = null;
    this.enginePromise = null;
    this.solver = null;
    this.scene = null;
    this.frameUpdate = null;
    this.running = false;
    this.stepping = false;
    this.inFrame = false;
    this.finished = false;
    this.broken = false;
    this.frame = 0;
    this.ignoreDuration = false;
    this.colorMode = 0;
    this.showBlocks = false;
    this.awaitingAck = false;
    this.pendingPost = false;
    this.lastPost = 0;
    this.lastStatsWall = 0;
    this.lastStatsSim = 0;
    this.recentLogs = [];
    this.sources = [];
    this.nextSourceId = 1;
    this.userUpdate = null;
    this.pending = [];
    this.gravity = [0, -10];
    this.pointer = { x: 0.5, y: 0.5, down: false, mode: 'off', strength: 10, size: 0.02, material: { type: 'water', density: 1000, color: [0.3, 0.6, 1] }, px: 0.5, py: 0.5, vx: 0, vy: 0, padX: 0.5, padY: -2, tiltActive: false };
    var self_ = this;
    // MessageChannel keeps the loop yielding to control messages (setInterval
    // is clamped in workers; MessageChannel is not).
    this.channel = new MessageChannel();
    this.channel.port1.onmessage = function () { self_.tick(); };
    this.schedule = function () { self_.channel.port2.postMessage(0); };
  }

  log(line, level) {
    this.recentLogs.push(line);
    if (this.recentLogs.length > 8) this.recentLogs.shift();
    this.post({ type: 'log', line: line, level: level || 'info' });
  }

  fail(e) {
    this.broken = true;
    this.running = false;
    var trap = e && e.name === 'WasmTrap';
    var detail = this.recentLogs.slice(-3).join(' | ');
    this.post({ type: 'error', message: (trap ? 'WebAssembly trap' : 'Error') + ': ' + ((e && e.message) || e) + (detail ? ' — ' + detail : '') });
    this.post({ type: 'state', running: false, finished: false });
  }

  ensureEngine() {
    if (this.enginePromise) return this.enginePromise;
    var self_ = this;
    this.enginePromise = Engine.create(function (line, level) { self_.log(line, level); }).then(function (eng) {
      self_.engine = eng;
      self_.post({ type: 'ready', simd: eng.simd });
      return eng;
    });
    return this.enginePromise;
  }

  // ------------------------------------------------------------- frame loop
  tick() {
    if (!this.running || !this.engine || !this.scene || this.broken || this.loading) return;
    var start = performance.now();
    try {
      while (performance.now() - start < 28) {
        if (!this.inFrame) {
          this.drainActions();
          var t = this.engine.time();
          if (!this.ignoreDuration && this.scene.duration > 0 && t >= this.scene.duration - 1e-6) {
            this.running = false;
            this.finished = true;
            this.post({ type: 'state', running: false, finished: true });
            this.postFrame(false, true);
            return;
          }
          this.runFrameUpdate(t, this.scene.frameDt);
          this.engine.beginStep(this.scene.frameDt);
          this.inFrame = true;
        }
        if (this.engine.advance(1)) {
          this.inFrame = false;
          this.frame++;
          this.postFrame(false);
          if (this.stepping) {
            this.stepping = false;
            this.running = false;
            this.post({ type: 'state', running: false, finished: false });
            this.postFrame(false, true);
            return;
          }
        }
      }
      if (this.inFrame && performance.now() - this.lastPost > 200) this.postFrame(true);
    } catch (e) {
      this.fail(e);
      return;
    }
    this.schedule();
  }

  runFrameUpdate(t, dt) {
    if (this.frameUpdate) this.frameUpdate(t, dt);
    // declarative + runtime sources (PD sources)
    for (var s of this.sources) {
      if (s.until > 0 && t >= s.until) continue;
      if (s.every > 1 && this.frame % s.every !== 0) continue;
      this.solver.add_particles(Object.assign({}, s.params, { pd_source: true, density_tex: s.texture, delta_t: dt * (s.every || 1) }));
    }
    this.pointerFrame(t, dt);
    if (this.userUpdate) {
      var host = this;
      this.userUpdate(t, dt, {
        pointer: this.pointer,
        addParticles: function (cfg) { return host.actAddParticles(cfg); },
        addWheel: function (cfg) { return buildWheel(host.solver, host.engine, cfg || {}, t); },
        addSource: function (cfg) { return host.actAddSource(cfg); },
        removeSource: function (id) { host.sources = host.sources.filter(function (s) { return s.id !== id; }); },
        setConfig: function (cfg) { host.solver.general_action(Object.assign({ action: 'set_config' }, cfg)); },
        random: Math.random,
      });
    }
  }

  pointerFrame(t, dt) {
    var ps = this.pointer;
    if (!this.solver || this.solver.dim !== 2) return;
    // pointer velocity estimate (for spawn momentum); reset on press so a
    // stale position never produces a launch-velocity spike
    if (ps.down && !ps.prevDown) { ps.px = ps.x; ps.py = ps.y; }
    ps.prevDown = ps.down;
    ps.vx = (ps.x - ps.px) / Math.max(dt, 1e-4);
    ps.vy = (ps.y - ps.py) / Math.max(dt, 1e-4);
    ps.px = ps.x; ps.py = ps.y;
    // rate-limited kinematic paddle follows the pointer (push / cut tool)
    var active = ps.down && ps.mode === 'push';
    var tx = active ? ps.x : ps.padX;
    var ty = active ? ps.y : -2;
    var maxStep = 14 * dt;
    var dx = tx - ps.padX, dy = ty - ps.padY;
    var dist = Math.hypot(dx, dy);
    if (dist > 1e-6) {
      var k = Math.min(1, maxStep / dist);
      ps.padX += dx * k; ps.padY += dy * k;
    }
    if (ps.down && ps.mode === 'spawn') {
      var size = ps.size || 0.02;
      var tex = new TextureFactory(this.engine, 2).rect([ps.x, ps.y], [size, size]).mul(ps.material.ppc || 2.5);
      var clamp = function (v, m) { return Math.max(-m, Math.min(m, v)); };
      var params = Object.assign({ density: 1000, color: [0.3, 0.6, 1] }, ps.material);
      delete params.ppc;
      // PD sources emit on the inflow shell of the texture: a non-zero
      // velocity is required for continuous emission, so pour downward.
      this.solver.add_particles(Object.assign({}, params, {
        pd_source: true, density_tex: tex, delta_t: dt,
        initial_velocity: [clamp(ps.vx * 0.3, 2), clamp(ps.vy * 0.3, 2) - 0.8],
      }));
    }
    if (ps.down && ps.mode === 'tilt') {
      var gx = ps.x - 0.5, gy = ps.y - 0.5;
      var gl = Math.hypot(gx, gy) || 1;
      var g = ps.strength || 10;
      this.solver.general_action({ action: 'set_config', gravity: [(gx / gl) * g, (gy / gl) * g] });
      ps.tiltActive = true;
    } else if (ps.tiltActive) {
      this.solver.general_action({ action: 'set_config', gravity: this.gravity });
      ps.tiltActive = false;
    }
  }

  postFrame(partial, force) {
    if (!this.engine || this.broken) return;
    if (this.awaitingAck && !force) { this.pendingPost = true; return; }
    var exp = this.engine.exportParticles(this.colorMode);
    var rigids = this.engine.exportRigids();
    var blocks = this.showBlocks ? this.engine.exportBlocks() : null;
    var s = this.engine.exportStats();
    var now = performance.now();
    var wall = (now - this.lastStatsWall) / 1000;
    var simAdvance = s[0] - this.lastStatsSim;
    var subs = s[15];
    var stats = {
      t: s[0], frame: this.frame, substeps: s[1], particles: s[2], rigidParticles: s[3],
      blocks: s[4], fatBlocks: s[5], rigidBlocks: s[6], cutting: s[7], dt: s[9], rigids: s[10],
      totalBlocks: s[11], nearBoundary: s[12], blockSize: s[14],
      msPerSubstep: subs > 0 ? s[16] / subs : 0,
      substepsPerSec: wall > 0 ? subs / wall : 0,
      simSpeed: wall > 0 ? simAdvance / wall : 0,
      memoryMB: this.engine.memoryMB(),
    };
    this.lastStatsWall = now;
    this.lastStatsSim = s[0];
    this.lastPost = now;
    var transfer = [exp.data.buffer, rigids.buffer];
    if (blocks) transfer.push(blocks.buffer);
    this.post({ type: 'frame', particles: exp.data, count: exp.count, rigids: rigids, blocks: blocks, stats: stats, partial: partial }, transfer);
    this.awaitingAck = true;
    this.pendingPost = false;
  }

  // ------------------------------------------------------- runtime actions
  drainActions() {
    var queue = this.pending;
    this.pending = [];
    for (var a of queue) this.applyAction(a);
  }

  applyAction(a) {
    var value = null;
    try {
      if (!this.solver) throw new Error('no scene loaded');
      switch (a.name) {
        case 'addParticles': value = this.actAddParticles(a.cfg); break;
        case 'addRigid': value = this.actAddParticles(Object.assign({ type: 'rigid' }, a.cfg)); break;
        case 'addWheel': value = buildWheel(this.solver, this.engine, a.cfg || {}, this.engine.time()); break;
        case 'addSource': value = this.actAddSource(a.cfg); break;
        case 'removeSource': this.sources = this.sources.filter(function (s) { return s.id !== a.cfg.id; }); value = true; break;
        case 'clearSources': this.sources = []; value = true; break;
        case 'setConfig':
          if (a.cfg.gravity) this.gravity = a.cfg.gravity;
          this.solver.general_action(Object.assign({ action: 'set_config' }, a.cfg));
          value = true;
          break;
        case 'generalAction': value = this.solver.general_action(resolveCfg(a.cfg, this.engine, this.solver.dim)); break;
        case 'addArticulation': this.solver.add_articulation(a.cfg); value = true; break;
        case 'setUpdate': this.userUpdate = a.cfg && a.cfg.__fn ? eval('(' + a.cfg.__fn + ')') : null; value = true; break;
        case 'energy': value = Number(this.solver.general_action({ action: 'calculate_energy' })); break;
        default: throw new Error('unknown action ' + a.name);
      }
      this.post({ type: 'result', id: a.id, value: value });
      if (!this.running) this.postFrame(false, true);
    } catch (e) {
      this.post({ type: 'result', id: a.id, error: String((e && e.message) || e) });
    }
  }

  actAddParticles(cfg) {
    return this.solver.add_particles(resolveCfg(cfg, this.engine, this.solver.dim));
  }

  actAddSource(cfg) {
    var id = this.nextSourceId++;
    var params = Object.assign({ density: 1000 }, cfg);
    var texSpec = cfg.texture || { type: 'rect', center: cfg.position || [0.5, 0.9], size: cfg.size || [0.05, 0.03] };
    if (texSpec.mul === undefined) texSpec = Object.assign({}, texSpec, { mul: cfg.ppc || 2.5 });
    var texture = buildTexture(texSpec, this.engine, this.solver.dim);
    delete params.texture; delete params.position; delete params.size; delete params.ppc;
    delete params.until; delete params.every; delete params.velocity;
    // PD sources need a non-zero inflow velocity to emit continuously.
    params.initial_velocity = cfg.velocity || [0, -1];
    if (params.type === undefined) params.type = 'water';
    this.sources.push({ id: id, texture: texture, params: params, until: cfg.until || 0, every: cfg.every || 1 });
    return id;
  }

  // ------------------------------------------------------------------ load
  async load(msg) {
    this.running = false;
    this.stepping = false;
    this.inFrame = false;
    this.frame = 0;
    this.finished = false;
    this.ignoreDuration = false;
    this.awaitingAck = false;
    this.broken = false;
    this.loading = true;
    this.colorMode = msg.colorMode || 0;
    this.showBlocks = !!msg.showBlocks;
    this.sources = [];
    this.userUpdate = null;
    this.pending = [];
    if (msg.pointer) Object.assign(this.pointer, msg.pointer);
    try {
      var eng = await this.ensureEngine();
      var def = typeof msg.scene === 'string' ? MPM.scenes[msg.scene] : unpackScene(msg.scene);
      if (!def) throw new Error('unknown scene "' + msg.scene + '"');
      this.scene = def;
      eng.reset();
      this.recentLogs = [];
      var t0 = performance.now();
      var dim = def.dim || 2;
      var host = this;
      var created = null;
      var ctx = {
        engine: eng,
        tex: new TextureFactory(eng, dim),
        quality: msg.quality || 'medium',
        dim: dim,
        H: Helpers,
        Solver: Solver, Texture: Texture, SegmentMesh: SegmentMesh, TriangleMesh: TriangleMesh, LevelSet: LevelSet,
        constant: constant, pick: pick,
        mpm: function (cfg) {
          var c = typeof cfg === 'number' ? { res: cfg } : Object.assign({}, cfg);
          if (typeof c.res === 'number') c.res = dim === 3 ? [c.res, c.res, c.res] : [c.res, c.res];
          created = new Solver(eng, dim, Object.assign({ pushing_force: 0 }, c));
          host.solver = created;
          return created;
        },
        add: function (cfg) { return host.solver.add_particles(resolveCfg(cfg, eng, dim)); },
        levelset: function (spec) { return buildLevelset(host.solver, spec); },
        wheel: function (opts) { return buildWheel(host.solver, eng, opts || {}, 0); },
        source: function (opts) { return host.actAddSource(opts); },
      };
      var result = null;
      if (def.setup) {
        result = def.setup(ctx) || {};
        this.solver = result.mpm || created;
        this.frameUpdate = result.frameUpdate || null;
      } else {
        this.frameUpdate = null;
        this.compileDeclarative(def, ctx, msg.quality || 'medium');
      }
      if (!this.solver) throw new Error('scene setup did not create a solver (call ctx.mpm(...) or return { mpm })');
      this.gravity = (this.solver.config && this.solver.config.gravity) || [0, -10];
      // Kinematic pointer paddle (2D): parked below the domain when inactive.
      if (this.solver.dim === 2) {
        var ps = this.pointer;
        ps.padX = 0.5; ps.padY = -2; ps.px = ps.x; ps.py = ps.y; ps.tiltActive = false;
        this.solver.add_particles({
          type: 'rigid', codimensional: true, friction: 0.1, color: [0.98, 0.8, 0.35],
          scripted_position: function () { return [host.pointer.padX, host.pointer.padY]; },
          segment_mesh: circleSegments(20, 0.05, true),
        });
      }
      var res = Number(this.solver.config.res[0]);
      this.log('Scene "' + (def.name || def.id || 'custom') + '" (' + dim + 'D, res ' + res + ') initialised in ' + (performance.now() - t0).toFixed(0) + ' ms');
      var ls = eng.exportLevelset();
      var info = {
        sceneId: def.id || 'custom', name: def.name || 'Custom scene', dim: dim, res: res,
        frameDt: def.frameDt || 0.01, duration: def.duration || 0,
        camera: def.camera || null, decor: def.decor || [],
        levelset: ls.nx > 0 ? ls : null,
      };
      this.scene.frameDt = info.frameDt;
      this.scene.duration = info.duration;
      this.post({ type: 'loaded', info: info }, info.levelset ? [info.levelset.data.buffer] : []);
      eng.exportStats();
      this.lastStatsWall = performance.now();
      this.lastStatsSim = 0;
      this.loading = false;
      this.postFrame(false, true);
      this.post({ type: 'state', running: false, finished: false });
      if (msg.autostart) this.handle({ type: 'play' });
      else this.drainActions(); // actions queued during load, scene stays paused
    } catch (e) {
      this.loading = false;
      this.fail(e);
    }
  }

  compileDeclarative(def, ctx, quality) {
    var dim = def.dim || 2;
    var baseRes = def.res || (dim === 3 ? { low: 40, medium: 56, high: 72 } : { low: 144, medium: 192, high: 256 });
    var r = typeof baseRes === 'number' ? baseRes : (baseRes[quality] || baseRes.medium || 192);
    var solverCfg = Object.assign({ base_delta_t: dim === 3 ? (3e-4 * 56) / r : 2e-4 * Math.min(1, 192 / r), penalty: 0 }, def.solver || {});
    if (def.gravity) solverCfg.gravity = def.gravity;
    var mpm = ctx.mpm(Object.assign({ res: r }, solverCfg));
    if (def.levelset) buildLevelset(mpm, def.levelset);
    else if (def.container !== false) {
      // sensible default container so material never leaves the domain
      if (dim === 2) buildLevelset(mpm, { planes: [{ normal: [0, 1], d: -0.06 }, { normal: [1, 0], d: -0.06 }, { normal: [-1, 0], d: 0.94 }], friction: 0.4 });
      else buildLevelset(mpm, { planes: [{ normal: [0, 1, 0], d: -0.2 }], friction: 0.4 });
    }
    var entries = (def.bodies || []).concat(def.materials || []);
    for (var b of entries) {
      var cfg = Object.assign({}, b);
      if (cfg.material && !cfg.type) { cfg.type = cfg.material; delete cfg.material; }
      // texture shorthand: rect/sphere/cylinder/polygon keys + ppc
      if (!cfg.density_tex && cfg.type !== 'rigid') {
        var spec = cfg.texture || (cfg.rect ? { type: 'rect', center: cfg.rect.center || cfg.rect[0], size: cfg.rect.size || cfg.rect[1] } : null)
          || (cfg.sphere ? { type: 'sphere', center: cfg.sphere.center, radius: cfg.sphere.radius } : null)
          || (cfg.cylinder ? { type: 'cylinder', center: cfg.cylinder.center, radius: cfg.cylinder.radius, height: cfg.cylinder.height, axis: cfg.cylinder.axis } : null)
          || (cfg.polygon ? { type: 'polygon', points: cfg.polygon.points || cfg.polygon } : null);
        if (spec) {
          if (cfg.ppc !== undefined && spec.mul === undefined) spec = Object.assign({}, spec, { mul: cfg.ppc });
          cfg.density_tex = spec;
        }
        delete cfg.rect; delete cfg.sphere; delete cfg.cylinder; delete cfg.polygon; delete cfg.texture; delete cfg.ppc;
      }
      mpm.add_particles(resolveCfg(cfg, this.engine, dim));
    }
    for (var w of def.wheels || []) buildWheel(mpm, this.engine, w, 0);
    for (var s of def.sources || []) this.actAddSource(s);
    for (var art of def.articulations || []) mpm.add_articulation(art);
  }

  // -------------------------------------------------------------- messages
  handle(msg) {
    switch (msg.type) {
      case 'load': this.load(msg); break;
      case 'play':
        if (!this.scene || this.broken || this.loading) return;
        if (this.engine && this.scene.duration > 0 && this.engine.time() >= this.scene.duration - 1e-6) this.ignoreDuration = true;
        if (!this.running) {
          this.running = true;
          this.finished = false;
          this.lastStatsWall = performance.now();
          if (this.engine) this.engine.exportStats();
          this.lastStatsSim = this.engine ? this.engine.time() : 0;
          this.post({ type: 'state', running: true, finished: false });
          this.schedule();
        }
        break;
      case 'pause':
        this.running = false;
        this.stepping = false;
        this.post({ type: 'state', running: false, finished: this.finished });
        break;
      case 'step':
        if (!this.scene || this.broken || this.running) return;
        this.ignoreDuration = true;
        this.stepping = true;
        this.running = true;
        this.post({ type: 'state', running: true, finished: false });
        this.schedule();
        break;
      case 'colorMode':
        this.colorMode = msg.mode;
        if (!this.running) this.postFrame(false, true);
        break;
      case 'showBlocks':
        this.showBlocks = msg.value;
        if (!this.running) this.postFrame(false, true);
        break;
      case 'pointer':
        Object.assign(this.pointer, msg.state);
        break;
      case 'action':
        if (this.loading || (this.running && this.inFrame)) this.pending.push(msg);
        else this.applyAction(msg);
        break;
      case 'ack':
        this.awaitingAck = false;
        if (this.pendingPost && !this.running) this.postFrame(false);
        break;
    }
  }
}

/** Rebuild a scene definition transferred from the main thread. */
function unpackScene(packed) {
  if (!packed) return null;
  if (typeof packed === 'string') return MPM.scenes[packed];
  var def = Object.assign({}, packed);
  // Direct eval so scene scripts can use library internals (Solver, helpers…).
  if (def.setupSource) {
    def.setup = eval('(' + def.setupSource + ')');
    delete def.setupSource;
  }
  if (def.frameUpdateSource) {
    def.frameUpdate = eval('(' + def.frameUpdateSource + ')');
    delete def.frameUpdateSource;
  }
  return def;
}

function workerMain() {
  var host = new SimHost(function (msg, transfer) { self.postMessage(msg, transfer || []); });
  self.onmessage = function (ev) { host.handle(ev.data); };
  host.ensureEngine().catch(function (e) { host.fail(e); });
}