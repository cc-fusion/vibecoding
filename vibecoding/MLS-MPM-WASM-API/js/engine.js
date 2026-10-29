// JavaScript host for the WebAssembly build of the taichi_mpm full solver.
// Provides a tiny WASI shim, string/config marshalling and a Python-like API
// that mirrors tc.dynamics.MPM from the original repository.
import { MPM_WASM_BASE64, MPM_WASM_SIMD_BASE64 } from './mpmWasm.js';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class WasmTrap extends Error {}

export class MPMEngine {
  constructor(onLog) {
    this.onLog = onLog;
    this.scripts = new Map();
    this.nextScript = 0;
    this.lineBuf = { 1: '', 2: '' };
    this.simd = false;
    this.dim = 2;
    this.ex = null;
  }

  static async create(onLog) {
    const e = new MPMEngine(onLog);
    await e.instantiate();
    return e;
  }

  get mem() {
    return this.ex.memory.buffer;
  }

  async instantiate() {
    let bytes = base64ToBytes(MPM_WASM_SIMD_BASE64);
    this.simd = WebAssembly.validate(bytes);
    if (!this.simd) bytes = base64ToBytes(MPM_WASM_BASE64);
    const module = await WebAssembly.compile(bytes);
    const wasi = this.wasiImports();
    const env = {
      script_eval: (id, t, out) => {
        const f = this.scripts.get(id);
        const o = new Float32Array(this.mem, out, 3);
        if (!f) return;
        const r = f(t);
        if (typeof r === 'number') o[0] = r;
        else {
          o[0] = r[0] ?? 0;
          o[1] = r[1] ?? 0;
          o[2] = r[2] ?? 0;
        }
      },
    };
    const imports = {};
    for (const imp of WebAssembly.Module.imports(module)) {
      if (imp.kind !== 'function') continue;
      imports[imp.module] ??= {};
      const table = imp.module === 'env' ? env : wasi;
      imports[imp.module][imp.name] = table[imp.name] ?? (() => 52);
    }
    const instance = await WebAssembly.instantiate(module, imports);
    this.ex = instance.exports;
    this.ex._initialize?.();
  }

  wasiImports() {
    const view = () => new DataView(this.mem);
    return {
      fd_write: (fd, iovs, iovsLen, nwritten) => {
        const dv = view();
        let total = 0;
        let text = '';
        for (let i = 0; i < iovsLen; i++) {
          const ptr = dv.getUint32(iovs + i * 8, true);
          const len = dv.getUint32(iovs + i * 8 + 4, true);
          text += decoder.decode(new Uint8Array(this.mem, ptr, len));
          total += len;
        }
        dv.setUint32(nwritten, total, true);
        const buf = (this.lineBuf[fd] ?? '') + text;
        const lines = buf.split('\n');
        this.lineBuf[fd] = lines.pop() ?? '';
        for (const line of lines) {
          if (!line) continue;
          const level = line.startsWith('[error]') ? 'error' : line.startsWith('[warn]') ? 'warn' : 'info';
          this.onLog(line.replace(/^\[(info|warn|error)\] /, ''), level);
        }
        return 0;
      },
      fd_close: () => 0,
      fd_seek: () => 70,
      fd_read: () => 52,
      fd_fdstat_get: (_fd, ptr) => {
        const dv = view();
        for (let i = 0; i < 24; i++) dv.setUint8(ptr + i, 0);
        dv.setUint8(ptr, 2);
        dv.setBigUint64(ptr + 8, 0xffffffffffffffffn, true);
        dv.setBigUint64(ptr + 16, 0xffffffffffffffffn, true);
        return 0;
      },
      fd_prestat_get: () => 8,
      fd_prestat_dir_name: () => 8,
      proc_exit: (code) => {
        throw new WasmTrap(`proc_exit(${code})`);
      },
      environ_sizes_get: (c, s) => {
        view().setUint32(c, 0, true);
        view().setUint32(s, 0, true);
        return 0;
      },
      environ_get: () => 0,
      args_sizes_get: (c, s) => {
        view().setUint32(c, 0, true);
        view().setUint32(s, 0, true);
        return 0;
      },
      args_get: () => 0,
      clock_time_get: (_id, _precision, out) => {
        view().setBigUint64(out, BigInt(Math.round(performance.now() * 1e6)), true);
        return 0;
      },
      clock_res_get: (_id, out) => {
        view().setBigUint64(out, 1000n, true);
        return 0;
      },
      random_get: (buf, len) => {
        const a = new Uint8Array(this.mem, buf, len);
        for (let i = 0; i < len; i += 65536) crypto.getRandomValues(a.subarray(i, Math.min(len, i + 65536)));
        return 0;
      },
      sched_yield: () => 0,
    };
  }

  withString(s, fn) {
    const bytes = encoder.encode(s);
    const ptr = this.ex.tc_alloc(bytes.length + 1);
    const m = new Uint8Array(this.mem, ptr, bytes.length + 1);
    m.set(bytes);
    m[bytes.length] = 0;
    try {
      return fn(ptr);
    } finally {
      this.ex.tc_free(ptr);
    }
  }

  readString(ptr) {
    const m = new Uint8Array(this.mem);
    let end = ptr;
    while (m[end] !== 0) end++;
    return decoder.decode(m.subarray(ptr, end));
  }

  registerScript(f) {
    const id = this.nextScript++;
    this.scripts.set(id, f);
    return id;
  }

  serialize(cfg) {
    const lines = [];
    for (const [key, value] of Object.entries(cfg)) {
      if (value === undefined || value === null) continue;
      let k = key;
      let v;
      if (typeof value === 'function') v = String(this.registerScript(value));
      else if (value instanceof Texture) v = String(value.id);
      else if (value instanceof SegmentMesh) {
        k = 'segment_mesh';
        v = value.serialize();
      } else if (value instanceof TriangleMesh) {
        k = 'mesh_id';
        v = String(this.uploadMesh(value.data));
      } else if (Array.isArray(value)) v = `(${value.map((x) => Number(x)).join(',')})`;
      else if (typeof value === 'boolean') v = value ? 'true' : 'false';
      else v = String(value);
      lines.push(`${k}=${v}`);
    }
    return lines.join('\n') + '\n';
  }

  reset() {
    this.ex.tc_reset();
    this.scripts.clear();
    this.nextScript = 0;
  }

  createSim(dim, cfg) {
    this.dim = dim;
    this.withString(this.serialize(cfg), (p) => this.ex.mpm_create(dim, p));
  }

  addParticles(cfg) {
    return this.withString(this.serialize(cfg), (p) => this.readString(this.ex.mpm_add_particles(p)));
  }

  generalAction(cfg) {
    return this.withString(this.serialize(cfg), (p) => this.readString(this.ex.mpm_general_action(p)));
  }

  createTexture(cfg) {
    return this.withString(this.serialize(cfg), (p) => this.ex.tc_create_texture(p));
  }

  uploadMesh(data) {
    const ptr = this.ex.tc_alloc(data.length * 4);
    new Float32Array(this.mem, ptr, data.length).set(data);
    const id = this.ex.tc_upload_mesh(ptr, data.length);
    this.ex.tc_free(ptr);
    return id;
  }

  beginStep(dt) {
    this.ex.mpm_begin_step(dt);
  }

  advance(maxSubsteps) {
    return this.ex.mpm_advance(maxSubsteps) === 1;
  }

  time() {
    return this.ex.mpm_get_time();
  }

  exportParticles(mode) {
    const ptr = this.ex.mpm_export_particles(mode);
    const count = this.ex.mpm_export_particles_count();
    const data = count > 0 ? new Float32Array(this.mem, ptr, count * 4).slice() : new Float32Array(0);
    return { data, count };
  }

  exportRigids() {
    const ptr = this.ex.mpm_export_rigids();
    return new Float32Array(this.mem, ptr, this.ex.mpm_export_rigids_size()).slice();
  }

  exportLevelset() {
    const ptr = this.ex.mpm_export_levelset();
    const n = this.ex.mpm_export_levelset_size();
    return {
      nx: this.ex.mpm_export_levelset_nx(),
      ny: this.ex.mpm_export_levelset_ny(),
      data: n > 0 ? new Float32Array(this.mem, ptr, n).slice() : new Float32Array(0),
    };
  }

  exportBlocks() {
    const ptr = this.ex.mpm_export_blocks();
    const n = this.ex.mpm_export_blocks_size();
    return n > 0 ? new Float32Array(this.mem, ptr, n).slice() : new Float32Array(0);
  }

  exportStats() {
    const ptr = this.ex.mpm_export_stats();
    return new Float64Array(this.mem, ptr, this.ex.mpm_export_stats_size()).slice();
  }

  memoryMB() {
    return this.mem.byteLength / 1048576;
  }
}

// Python-like wrappers (tc.dynamics.MPM, tc.Texture, LevelSet, meshes)
const pad3 = (v, fill = 0.5) => [v[0] ?? fill, v[1] ?? fill, v[2] ?? fill];

export class Texture {
  constructor(engine, id) {
    this.engine = engine;
    this.id = id;
  }
  static make(engine, cfg) {
    return new Texture(engine, engine.createTexture(cfg));
  }
  translate(offset) {
    return Texture.make(this.engine, { type: 'translate', tex: this, offset: pad3(offset, 0) });
  }
  rotate(angleDeg, center = [0.5, 0.5, 0.5], axis = [0, 0, 1]) {
    return Texture.make(this.engine, { type: 'rotate', tex: this, angle: angleDeg, center: pad3(center), axis });
  }
  mul(value) {
    return Texture.make(this.engine, { type: 'multiply', tex: this, value });
  }
  union(o) {
    return Texture.make(this.engine, { type: 'union', a: this, b: o });
  }
  intersect(o) {
    return Texture.make(this.engine, { type: 'intersect', a: this, b: o });
  }
  subtract(o) {
    return Texture.make(this.engine, { type: 'subtract', a: this, b: o });
  }
  bound(axis, lo, hi) {
    return Texture.make(this.engine, { type: 'bound', tex: this, axis, bounds: [lo, hi] });
  }
}

export class SegmentMesh {
  constructor() {
    this.segments = [];
  }
  add_segment(a, b) {
    this.segments.push([a, b]);
    return this;
  }
  serialize() {
    const parts = [this.segments.length];
    for (const [a, b] of this.segments) parts.push(a[0], a[1], b[0], b[1]);
    return parts.map((x) => (Number.isInteger(x) ? String(x) : x.toPrecision(8))).join(' ');
  }
}

export class TriangleMesh {
  constructor(data) {
    this.data = data;
  }
  static fromTriangles(tris) {
    const d = new Float32Array(tris.length * 9);
    tris.forEach((t, i) => t.forEach((v, k) => d.set(v, i * 9 + k * 3)));
    return new TriangleMesh(d);
  }
}

export class LevelSet {
  constructor(mpm, id) {
    this.mpm = mpm;
    this.id = id;
  }
  op(op, params) {
    this.mpm.general_action({ action: 'levelset_op', id: this.id, op, ...params });
    return this;
  }
  add_plane(normal, d) {
    return this.op('add_plane', { normal, d });
  }
  add_sphere(center, radius, inside_out = false) {
    return this.op('add_sphere', { center, radius, inside_out });
  }
  add_box(lower, upper, inside_out = false) {
    return this.op('add_box', { lower, upper, inside_out });
  }
  add_cylinder(center, radius, inside_out = false) {
    return this.op('add_cylinder', { center, radius, inside_out });
  }
  add_polygon(points, inside_out = false) {
    return this.op('add_polygon', { points: points.flat().join(' '), inside_out });
  }
  global_increase(delta) {
    return this.op('global_increase', { delta });
  }
  set_friction(friction) {
    return this.op('set_friction', { friction });
  }
}

export class MPM {
  constructor(engine, dim, config) {
    this.engine = engine;
    this.dim = dim;
    this.config = config;
    engine.createSim(dim, config);
  }
  add_particles(cfg) {
    return Number(this.engine.addParticles(cfg));
  }
  add_articulation(cfg) {
    this.general_action({ action: 'add_articulation', ...cfg });
  }
  create_levelset() {
    return new LevelSet(this, this.general_action({ action: 'create_levelset' }));
  }
  set_levelset(ls) {
    this.general_action({ action: 'set_levelset', id: ls.id });
  }
  general_action(cfg) {
    return this.engine.generalAction(cfg);
  }
}

/** Texture factory bound to an engine/dimension (tc.Texture(...) equivalents). */
export class TextureFactory {
  constructor(engine, dim) {
    this.engine = engine;
    this.dim = dim;
  }
  rect(center, size) {
    return Texture.make(this.engine, { type: 'rect', dim: this.dim, center: pad3(center), size: pad3(size, 1) });
  }
  ring(outer, inner = 0, center = [0.5, 0.5, 0.5]) {
    return Texture.make(this.engine, { type: 'ring', dim: this.dim, center: pad3(center), inner, outer });
  }
  sphere(center, radius) {
    return Texture.make(this.engine, { type: 'sphere', dim: this.dim, center: pad3(center), radius });
  }
  cylinder(center, radius, height, axis = 1) {
    return Texture.make(this.engine, { type: 'cylinder', center: pad3(center), radius, height, axis });
  }
  polygon(points) {
    return Texture.make(this.engine, { type: 'polygon', points: points.flat().join(' ') });
  }
}
