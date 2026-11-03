/*!
 * MPM.js — real-time MLS-MPM / CPIC multi-physics for the browser.
 * A pure-JavaScript, zero-dependency packaging of the taichi_mpm full solver
 * (WebAssembly) with a WebGL2 renderer, a self-spawning simulation worker and
 * a declarative + scripted scene API. Load with <script src="mpm.js"></script>.
 *
 * Solver: taichi_mpm (Yuanming Hu) — C++/WASM port. Library API: MPM.js.
 * License: MIT.
 */
(function (global) {
'use strict';

var IS_WORKER = typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;

var MPM = {
  version: '1.0.0',
  /** Scene registry (built-ins are added below). */
  scenes: {},
};

// ===========================================================================
// Engine — JavaScript host for the WebAssembly build of the full solver.
// Provides a tiny WASI shim, string/config marshalling and script callbacks.
// ===========================================================================
var decoder = new TextDecoder();
var encoder = new TextEncoder();

function base64ToBytes(b64) {
  var bin = atob(b64);
  var out = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function WasmTrap(message) { this.name = 'WasmTrap'; this.message = message; }
WasmTrap.prototype = Object.create(Error.prototype);

class Engine {
  constructor(onLog) {
    this.onLog = onLog || function () {};
    this.scripts = new Map();
    this.nextScript = 0;
    this.lineBuf = { 1: '', 2: '' };
    this.simd = false;
    this.dim = 2;
    this.ex = null;
  }

  static async create(onLog) {
    var e = new Engine(onLog);
    await e.instantiate();
    return e;
  }

  get mem() { return this.ex.memory.buffer; }

  async instantiate() {
    if (!MPM.__wasm) throw new Error('MPM.js: embedded WASM payload missing');
    var bytes = base64ToBytes(MPM.__wasm.simd);
    this.simd = WebAssembly.validate(bytes);
    if (!this.simd) bytes = base64ToBytes(MPM.__wasm.base);
    var module = await WebAssembly.compile(bytes);
    var wasi = this.wasiImports();
    var self_ = this;
    var env = {
      script_eval: function (id, t, out) {
        var f = self_.scripts.get(id);
        var o = new Float32Array(self_.mem, out, 3);
        if (!f) return;
        var r = f(t);
        if (typeof r === 'number') o[0] = r;
        else if (r) { o[0] = r[0] || 0; o[1] = r[1] || 0; o[2] = r[2] || 0; }
      },
    };
    var imports = {};
    for (var imp of WebAssembly.Module.imports(module)) {
      if (imp.kind !== 'function') continue;
      if (!imports[imp.module]) imports[imp.module] = {};
      var table = imp.module === 'env' ? env : wasi;
      imports[imp.module][imp.name] = table[imp.name] || function () { return 52; /* ENOSYS */ };
    }
    var instance = await WebAssembly.instantiate(module, imports);
    this.ex = instance.exports;
    if (this.ex._initialize) this.ex._initialize();
  }

  wasiImports() {
    var self_ = this;
    var view = function () { return new DataView(self_.mem); };
    return {
      fd_write: function (fd, iovs, iovsLen, nwritten) {
        var dv = view();
        var total = 0, text = '';
        for (var i = 0; i < iovsLen; i++) {
          var ptr = dv.getUint32(iovs + i * 8, true);
          var len = dv.getUint32(iovs + i * 8 + 4, true);
          text += decoder.decode(new Uint8Array(self_.mem, ptr, len));
          total += len;
        }
        dv.setUint32(nwritten, total, true);
        var buf = (self_.lineBuf[fd] || '') + text;
        var lines = buf.split('\n');
        self_.lineBuf[fd] = lines.pop() || '';
        for (var line of lines) {
          if (!line) continue;
          var level = line.indexOf('[error]') === 0 ? 'error' : line.indexOf('[warn]') === 0 ? 'warn' : 'info';
          self_.onLog(line.replace(/^\[(info|warn|error)\] /, ''), level);
        }
        return 0;
      },
      fd_close: function () { return 0; },
      fd_seek: function () { return 70; },
      fd_read: function () { return 52; },
      fd_fdstat_get: function (_fd, ptr) {
        var dv = view();
        for (var i = 0; i < 24; i++) dv.setUint8(ptr + i, 0);
        dv.setUint8(ptr, 2);
        dv.setBigUint64(ptr + 8, 0xffffffffffffffffn, true);
        dv.setBigUint64(ptr + 16, 0xffffffffffffffffn, true);
        return 0;
      },
      fd_prestat_get: function () { return 8; },
      fd_prestat_dir_name: function () { return 8; },
      proc_exit: function (code) { throw new WasmTrap('proc_exit(' + code + ')'); },
      environ_sizes_get: function (c, s) { view().setUint32(c, 0, true); view().setUint32(s, 0, true); return 0; },
      environ_get: function () { return 0; },
      args_sizes_get: function (c, s) { view().setUint32(c, 0, true); view().setUint32(s, 0, true); return 0; },
      args_get: function () { return 0; },
      clock_time_get: function (_id, _precision, out) {
        view().setBigUint64(out, BigInt(Math.round(performance.now() * 1e6)), true);
        return 0;
      },
      clock_res_get: function (_id, out) { view().setBigUint64(out, 1000n, true); return 0; },
      random_get: function (buf, len) {
        var a = new Uint8Array(self_.mem, buf, len);
        for (var i = 0; i < len; i += 65536) crypto.getRandomValues(a.subarray(i, Math.min(len, i + 65536)));
        return 0;
      },
      sched_yield: function () { return 0; },
    };
  }

  // ------------------------------------------------------------ marshalling
  withString(s, fn) {
    var bytes = encoder.encode(s);
    var ptr = this.ex.tc_alloc(bytes.length + 1);
    var m = new Uint8Array(this.mem, ptr, bytes.length + 1);
    m.set(bytes);
    m[bytes.length] = 0;
    try { return fn(ptr); } finally { this.ex.tc_free(ptr); }
  }
  readString(ptr) {
    var m = new Uint8Array(this.mem);
    var end = ptr;
    while (m[end] !== 0) end++;
    return decoder.decode(m.subarray(ptr, end));
  }

  registerScript(f) {
    var id = this.nextScript++;
    this.scripts.set(id, f);
    return id;
  }

  serialize(cfg) {
    var lines = [];
    for (var key of Object.keys(cfg)) {
      var value = cfg[key];
      if (value === undefined || value === null) continue;
      var k = key, v;
      if (typeof value === 'function') v = String(this.registerScript(value));
      else if (value instanceof Texture) v = String(value.id);
      else if (value instanceof SegmentMesh) { k = 'segment_mesh'; v = value.serialize(); }
      else if (value instanceof TriangleMesh) { k = 'mesh_id'; v = String(this.uploadMesh(value.data)); }
      else if (Array.isArray(value)) v = '(' + value.map(Number).join(',') + ')';
      else if (typeof value === 'boolean') v = value ? 'true' : 'false';
      else v = String(value);
      lines.push(k + '=' + v);
    }
    return lines.join('\n') + '\n';
  }

  // ---------------------------------------------------------------- raw API
  reset() { this.ex.tc_reset(); this.scripts.clear(); this.nextScript = 0; }
  createSim(dim, cfg) {
    this.dim = dim;
    var self_ = this;
    this.withString(this.serialize(cfg), function (p) { return self_.ex.mpm_create(dim, p); });
  }
  addParticles(cfg) {
    var self_ = this;
    return this.withString(this.serialize(cfg), function (p) { return self_.readString(self_.ex.mpm_add_particles(p)); });
  }
  generalAction(cfg) {
    var self_ = this;
    return this.withString(this.serialize(cfg), function (p) { return self_.readString(self_.ex.mpm_general_action(p)); });
  }
  createTexture(cfg) {
    var self_ = this;
    return this.withString(this.serialize(cfg), function (p) { return self_.ex.tc_create_texture(p); });
  }
  uploadMesh(data) {
    var ptr = this.ex.tc_alloc(data.length * 4);
    new Float32Array(this.mem, ptr, data.length).set(data);
    var id = this.ex.tc_upload_mesh(ptr, data.length);
    this.ex.tc_free(ptr);
    return id;
  }
  beginStep(dt) { this.ex.mpm_begin_step(dt); }
  /** Runs up to maxSubsteps substeps; true when the requested step completed. */
  advance(maxSubsteps) { return this.ex.mpm_advance(maxSubsteps) === 1; }
  time() { return this.ex.mpm_get_time(); }
  exportParticles(mode) {
    var ptr = this.ex.mpm_export_particles(mode);
    var count = this.ex.mpm_export_particles_count();
    var data = count > 0 ? new Float32Array(this.mem, ptr, count * 4).slice() : new Float32Array(0);
    return { data: data, count: count };
  }
  exportRigids() {
    var ptr = this.ex.mpm_export_rigids();
    return new Float32Array(this.mem, ptr, this.ex.mpm_export_rigids_size()).slice();
  }
  exportLevelset() {
    var ptr = this.ex.mpm_export_levelset();
    var n = this.ex.mpm_export_levelset_size();
    return {
      nx: this.ex.mpm_export_levelset_nx(),
      ny: this.ex.mpm_export_levelset_ny(),
      data: n > 0 ? new Float32Array(this.mem, ptr, n).slice() : new Float32Array(0),
    };
  }
  exportBlocks() {
    var ptr = this.ex.mpm_export_blocks();
    var n = this.ex.mpm_export_blocks_size();
    return n > 0 ? new Float32Array(this.mem, ptr, n).slice() : new Float32Array(0);
  }
  exportStats() {
    var ptr = this.ex.mpm_export_stats();
    return new Float64Array(this.mem, ptr, this.ex.mpm_export_stats_size()).slice();
  }
  memoryMB() { return this.mem.byteLength / 1048576; }
}

// ===========================================================================
// Python-like wrappers (tc.dynamics.MPM, tc.Texture, LevelSet, meshes)
// ===========================================================================
function pad3(v, fill) {
  if (fill === undefined) fill = 0.5;
  return [v[0] !== undefined ? v[0] : fill, v[1] !== undefined ? v[1] : fill, v[2] !== undefined ? v[2] : fill];
}

class Texture {
  constructor(engine, id) { this.engine = engine; this.id = id; }
  static make(engine, cfg) { return new Texture(engine, engine.createTexture(cfg)); }
  translate(offset) { return Texture.make(this.engine, { type: 'translate', tex: this, offset: pad3(offset, 0) }); }
  rotate(angleDeg, center, axis) {
    return Texture.make(this.engine, { type: 'rotate', tex: this, angle: angleDeg, center: pad3(center || [0.5, 0.5, 0.5]), axis: axis || [0, 0, 1] });
  }
  mul(value) { return Texture.make(this.engine, { type: 'multiply', tex: this, value: value }); }
  union(o) { return Texture.make(this.engine, { type: 'union', a: this, b: o }); }
  intersect(o) { return Texture.make(this.engine, { type: 'intersect', a: this, b: o }); }
  subtract(o) { return Texture.make(this.engine, { type: 'subtract', a: this, b: o }); }
  bound(axis, lo, hi) { return Texture.make(this.engine, { type: 'bound', tex: this, axis: axis, bounds: [lo, hi] }); }
}

class SegmentMesh {
  constructor() { this.segments = []; }
  add_segment(a, b) { this.segments.push([a, b]); return this; }
  serialize() {
    var parts = [this.segments.length];
    for (var s of this.segments) parts.push(s[0][0], s[0][1], s[1][0], s[1][1]);
    return parts.map(function (x) { return Number.isInteger(x) ? String(x) : x.toPrecision(8); }).join(' ');
  }
}

class TriangleMesh {
  constructor(data) { this.data = data; }
  static fromTriangles(tris) {
    var d = new Float32Array(tris.length * 9);
    tris.forEach(function (t, i) { t.forEach(function (v, k) { d.set(v, i * 9 + k * 3); }); });
    return new TriangleMesh(d);
  }
}

class LevelSet {
  constructor(mpm, id) { this.mpm = mpm; this.id = id; }
  op(op, params) {
    this.mpm.general_action(Object.assign({ action: 'levelset_op', id: this.id, op: op }, params));
    return this;
  }
  add_plane(normal, d) { return this.op('add_plane', { normal: normal, d: d }); }
  add_sphere(center, radius, inside_out) { return this.op('add_sphere', { center: center, radius: radius, inside_out: !!inside_out }); }
  add_box(lower, upper, inside_out) { return this.op('add_box', { lower: lower, upper: upper, inside_out: !!inside_out }); }
  add_cylinder(center, radius, inside_out) { return this.op('add_cylinder', { center: center, radius: radius, inside_out: !!inside_out }); }
  add_polygon(points, inside_out) { return this.op('add_polygon', { points: points.flat().join(' '), inside_out: !!inside_out }); }
  global_increase(delta) { return this.op('global_increase', { delta: delta }); }
  set_friction(friction) { return this.op('set_friction', { friction: friction }); }
}

class Solver {
  constructor(engine, dim, config) {
    this.engine = engine;
    this.dim = dim;
    this.config = config;
    engine.createSim(dim, config);
  }
  /** Returns the rigid body id for type='rigid', otherwise particles added. */
  add_particles(cfg) { return Number(this.engine.addParticles(cfg)); }
  add_articulation(cfg) { this.general_action(Object.assign({ action: 'add_articulation' }, cfg)); }
  create_levelset() { return new LevelSet(this, this.general_action({ action: 'create_levelset' })); }
  set_levelset(ls) { this.general_action({ action: 'set_levelset', id: ls.id }); }
  general_action(cfg) { return this.engine.generalAction(cfg); }
}

/** Texture factory bound to an engine/dimension (tc.Texture(...) equivalents). */
class TextureFactory {
  constructor(engine, dim) { this.engine = engine; this.dim = dim; }
  rect(center, size) { return Texture.make(this.engine, { type: 'rect', dim: this.dim, center: pad3(center), size: pad3(size, 1) }); }
  ring(outer, inner, center) { return Texture.make(this.engine, { type: 'ring', dim: this.dim, center: pad3(center || [0.5, 0.5, 0.5]), inner: inner || 0, outer: outer }); }
  sphere(center, radius) { return Texture.make(this.engine, { type: 'sphere', dim: this.dim, center: pad3(center), radius: radius }); }
  cylinder(center, radius, height, axis) { return Texture.make(this.engine, { type: 'cylinder', center: pad3(center), radius: radius, height: height, axis: axis === undefined ? 1 : axis }); }
  polygon(points) { return Texture.make(this.engine, { type: 'polygon', points: points.flat().join(' ') }); }
}