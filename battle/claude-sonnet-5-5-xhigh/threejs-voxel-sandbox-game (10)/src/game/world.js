// World: chunk storage, streaming, block access, lighting hooks, meshes, raycasting, block entities.
import * as THREE from 'three';
import { CS, CH, SEA, idx, chunkKey } from './constants.js';
import { B, DEFS, SOLID, LIQUID, OPACITY, OPAQUE, SHAPE, S_CROSS, S_TORCH } from './blocks.js';
import { WorldGen } from './worldgen.js';
import { Chunk, ST_GENERATED, ST_LIT, rleEncode, rleDecode } from './chunk.js';
import { Lighting } from './lighting.js';
import { meshChunk } from './mesher.js';

function makeGeometry(data, maxY) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute('aUvw', new THREE.BufferAttribute(data.uvw, 3));
  g.setAttribute('aLight', new THREE.BufferAttribute(data.light, 4, true));
  g.setAttribute('aTint', new THREE.BufferAttribute(data.tint, 4, true));
  g.setIndex(new THREE.BufferAttribute(data.idx, 1));
  const hy = (maxY + 3) / 2;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(8, hy, 8), Math.sqrt(128 + hy * hy) + 2);
  return g;
}

export class World {
  constructor({ seed, scene, materials, saved = null, renderDistance = 8, blockEntities = null }) {
    this.seed = seed | 0;
    this.gen = new WorldGen(this.seed);
    this.scene = scene;
    this.mats = materials;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.chunks = new Map();
    this.saved = saved || new Map();       // key -> {cx,cz,d,m}
    this.savedDirty = new Set();
    this.blockEntities = blockEntities || new Map();
    this.lighting = new Lighting(this);
    this.rd = renderDistance;
    this.wanted = [];
    this.pcx = 1e9; this.pcz = 1e9;
    this.wantedDirty = true;
    this.urgent = new Set();
    this.updateQueue = [];
    this.fluidQueue = [];
    this.hooks = {};
    this._lk = null; this._lc = null;
    this.stats = { chunks: 0, meshed: 0, tris: 0 };
    this.time = 0;
  }

  // ---- chunk access ---------------------------------------------------------------------------
  getChunk(cx, cz) {
    const k = chunkKey(cx, cz);
    if (k === this._lk) return this._lc;
    const c = this.chunks.get(k) || null;
    this._lk = k; this._lc = c;
    return c;
  }

  getBlock(x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < ST_GENERATED) return 0;
    return c.blocks[idx(x & 15, y, z & 15)];
  }
  isLoaded(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    return !!c && c.state >= ST_LIT;
  }
  isSolid(x, y, z) {
    if (y < 0) return true;
    if (y >= CH) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < ST_GENERATED) return true;
    return SOLID[c.blocks[idx(x & 15, y, z & 15)]] === 1;
  }
  getMeta(x, y, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    return c ? c.meta.get(idx(x & 15, y, z & 15)) || 0 : 0;
  }
  getLightRaw(x, y, z) {
    if (y >= CH) return 0xf0;
    if (y < 0) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < ST_LIT) return 0xf0;
    return c.light[idx(x & 15, y, z & 15)];
  }
  getSky(x, y, z) { return this.getLightRaw(x, y, z) >> 4; }
  getBlockLight(x, y, z) { return this.getLightRaw(x, y, z) & 15; }
  getBiome(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    return c ? c.biomes[(z & 15) * 16 + (x & 15)] : 2;
  }
  getClimate(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return [0, 0];
    const i = ((z & 15) * 16 + (x & 15)) * 2;
    return [(c.climate[i] / 255) * 2 - 1, (c.climate[i + 1] / 255) * 2 - 1];
  }
  // highest light-blocking cell in a column (for rain / shelter checks); -1 if unknown
  columnTop(x, z) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < ST_LIT) return -1;
    return c.height[(z & 15) * 16 + (x & 15)];
  }
  topSolidY(x, z) {
    for (let y = CH - 1; y >= 0; y--) if (SOLID[this.getBlock(x, y, z)]) return y;
    return 0;
  }

  // ground level ignoring tree canopies, trunks and cacti
  topGroundY(x, z) {
    for (let y = CH - 1; y >= 0; y--) {
      const id = this.getBlock(x, y, z);
      if (SOLID[id] && !(DEFS[id].leaves || DEFS[id].log || DEFS[id].cactus)) return y;
    }
    return 0;
  }

  markDirty(c) {
    if (c.meshed && !c.dirty) c.dirty = true;
  }

  // ---- modification ---------------------------------------------------------------------------
  setBlock(x, y, z, id, meta, opts = {}) {
    if (y < 0 || y >= CH) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c || c.state < ST_GENERATED) return false;
    const lx = x & 15, lz = z & 15;
    const i = idx(lx, y, lz);
    const old = c.blocks[i];
    const oldMeta = c.meta.get(i);
    if (old === id && (meta === undefined ? oldMeta === undefined : oldMeta === meta)) return false;
    c.blocks[i] = id;
    if (meta) c.meta.set(i, meta); else c.meta.delete(i);
    if (!opts.natural) { c.modified = true; c.needsSave = true; }
    if (y > c.maxY) c.maxY = y;
    // heightmap
    const col = lz * 16 + lx;
    if (OPACITY[id] > 0) { if (y > c.height[col]) c.height[col] = y; }
    else if (y === c.height[col]) {
      let h = y - 1;
      while (h > 0 && OPACITY[c.blocks[idx(lx, h, lz)]] === 0) h--;
      c.height[col] = Math.max(0, h);
    }
    if (c.state >= ST_LIT) this.lighting.onBlockChanged(x, y, z, old, id);
    this.dirtyAround(c, lx, lz, opts.immediate !== false);
    if (!opts.silent) {
      this.updateQueue.push(x, y, z);
      this.updateQueue.push(x + 1, y, z, x - 1, y, z, x, y + 1, z, x, y - 1, z, x, y, z + 1, x, y, z - 1);
    }
    if (old !== id && DEFS[old] && DEFS[old].log) this.hooks.logRemoved && this.hooks.logRemoved(x, y, z);
    return true;
  }

  dirtyAround(c, lx, lz, urgent) {
    const mark = (cx, cz) => {
      const n = this.getChunk(cx, cz);
      if (n && n.meshed) { n.dirty = true; if (urgent) this.urgent.add(n); }
    };
    mark(c.cx, c.cz);
    const ex = lx === 0 ? -1 : lx === 15 ? 1 : 0, ez = lz === 0 ? -1 : lz === 15 ? 1 : 0;
    if (ex) mark(c.cx + ex, c.cz);
    if (ez) mark(c.cx, c.cz + ez);
    if (ex && ez) mark(c.cx + ex, c.cz + ez);
  }

  // ---- block entities ---------------------------------------------------------------------------
  beKey(x, y, z) { return x + ',' + y + ',' + z; }
  getBE(x, y, z) { return this.blockEntities.get(this.beKey(x, y, z)); }
  setBE(x, y, z, data) { this.blockEntities.set(this.beKey(x, y, z), data); }
  removeBE(x, y, z) { this.blockEntities.delete(this.beKey(x, y, z)); }

  // ---- neighbour block updates (support checks, gravity) -----------------------------------------
  processBlockUpdates(max = 96) {
    const q = this.updateQueue;
    let n = 0;
    while (q.length && n < max * 3) {
      const z = q.pop(), y = q.pop(), x = q.pop();
      n += 3;
      this.checkBlock(x, y, z);
    }
  }

  checkBlock(x, y, z) {
    const id = this.getBlock(x, y, z);
    if (id === 0) return;
    const d = DEFS[id];
    if (!d) return;
    if (d.plant || d.cactus) {
      const below = this.getBlock(x, y - 1, z);
      let ok = SOLID[below] === 1 && !d.cactus;
      if (d.cactus) ok = below === B.SAND || below === B.CACTUS;
      if (id === B.DEAD_BUSH) ok = SOLID[below] === 1;
      if (!ok) this.hooks.breakNatural && this.hooks.breakNatural(x, y, z, id);
    } else if (id === B.TORCH) {
      const meta = this.getMeta(x, y, z);
      const [dx, dy, dz] = meta === 0 ? [0, -1, 0] : meta === 1 ? [-1, 0, 0] : meta === 2 ? [1, 0, 0] : meta === 3 ? [0, 0, -1] : [0, 0, 1];
      if (!OPAQUE[this.getBlock(x + dx, y + dy, z + dz)]) this.hooks.breakNatural && this.hooks.breakNatural(x, y, z, id);
    } else if (d.gravity) {
      const below = this.getBlock(x, y - 1, z);
      if (y > 0 && (below === 0 || LIQUID[below] || (DEFS[below] && (DEFS[below].plant || DEFS[below].replaceable))) && this.isLoaded(x, z)) {
        this.hooks.fall && this.hooks.fall(x, y, z, id);
      }
    }
  }

  // ---- fluids: spreading into dug-out space below the fluid level ---------------------------------
  scheduleFluid(x, y, z) {
    this.fluidQueue.push({ x, y, z, t: this.time + 0.18 });
  }
  checkFluidNeighbours(x, y, z) {
    // called after a block is removed at x,y,z
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]) {
      const n = this.getBlock(x + dx, y + dy, z + dz);
      if (n === B.WATER || n === B.LAVA) { this.scheduleFluid(x, y, z); return; }
    }
  }
  processFluids() {
    const q = this.fluidQueue;
    if (!q.length) return;
    let n = 0;
    for (let i = 0; i < q.length && n < 6;) {
      const e = q[i];
      if (e.t > this.time) { i++; continue; }
      q.splice(i, 1);
      const cur = this.getBlock(e.x, e.y, e.z);
      if (cur !== 0 && !(DEFS[cur] && DEFS[cur].plant)) continue;
      // determine which fluid is adjacent
      let fluid = 0;
      for (const [dx, dy, dz] of [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
        const nb = this.getBlock(e.x + dx, e.y + dy, e.z + dz);
        if (nb === B.WATER || nb === B.LAVA) { fluid = nb; break; }
      }
      if (!fluid) continue;
      const lvl = fluid === B.WATER ? SEA : 10;
      if (e.y > lvl) continue;
      this.setBlock(e.x, e.y, e.z, fluid, undefined, { silent: false });
      n++;
      if (q.length < 4000) {
        for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) {
          if (this.getBlock(e.x + dx, e.y + dy, e.z + dz) === 0) q.push({ x: e.x + dx, y: e.y + dy, z: e.z + dz, t: this.time + 0.22 });
        }
      }
    }
  }

  // ---- streaming -----------------------------------------------------------------------------------
  setRenderDistance(rd) {
    this.rd = rd;
    this.wantedDirty = true;
  }

  rebuildWanted(pcx, pcz) {
    this.pcx = pcx; this.pcz = pcz; this.wantedDirty = false;
    const r = this.rd + 1;
    const list = [];
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > r * r + 1) continue;
      list.push({ cx: pcx + dx, cz: pcz + dz, d2 });
    }
    list.sort((a, b) => a.d2 - b.d2);
    this.wanted = list;
    // unload far chunks
    const lim = this.rd + 3;
    for (const c of [...this.chunks.values()]) {
      if (Math.abs(c.cx - pcx) > lim || Math.abs(c.cz - pcz) > lim) this.unloadChunk(c);
    }
  }

  createChunk(cx, cz) {
    const c = new Chunk(cx, cz);
    const key = chunkKey(cx, cz);
    this.chunks.set(key, c);
    this._lk = null;
    const rec = this.saved.get(key);
    if (rec) {
      rleDecode(rec.d, c.blocks);
      c.meta = new Map(rec.m);
      c.modified = true;
      this.gen.fillClimate(cx, cz, c.biomes, c.climate);
      let maxY = 0;
      for (let y = CH - 1; y > 0 && !maxY; y--) {
        const base = y << 8;
        for (let i = 0; i < 256; i++) if (c.blocks[base + i]) { maxY = y; break; }
      }
      c.maxY = maxY;
    } else {
      c.maxY = this.gen.generate(cx, cz, c.blocks, c.meta, c.biomes, c.climate);
    }
    c.state = ST_GENERATED;
    return c;
  }

  serializeChunk(c) {
    return { cx: c.cx, cz: c.cz, d: rleEncode(c.blocks), m: [...c.meta.entries()] };
  }

  unloadChunk(c) {
    if (c.modified && c.needsSave !== false) {
      const k = chunkKey(c.cx, c.cz);
      this.saved.set(k, this.serializeChunk(c));
      this.savedDirty.add(k);
    }
    this.disposeChunkMeshes(c);
    this.chunks.delete(chunkKey(c.cx, c.cz));
    this._lk = null;
    this.urgent.delete(c);
  }

  disposeChunkMeshes(c) {
    for (const k of ['meshSolid', 'meshTrans']) {
      if (c[k]) { this.group.remove(c[k]); c[k].geometry.dispose(); c[k] = null; }
    }
    c.meshed = false;
  }

  // chunks with unsaved edits -> records ready for storage
  collectSaveRecords() {
    const out = [];
    for (const c of this.chunks.values()) {
      if (c.modified && c.needsSave) {
        const k = chunkKey(c.cx, c.cz);
        const rec = this.serializeChunk(c);
        this.saved.set(k, rec);
        out.push({ k, rec });
        c.needsSave = false;
      }
    }
    for (const k of this.savedDirty) {
      const rec = this.saved.get(k);
      if (rec) out.push({ k, rec });
    }
    this.savedDirty.clear();
    return out;
  }

  neighboursLit(c) {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (!n || n.state < ST_LIT) return false;
    }
    return true;
  }

  mesh(c) {
    const res = meshChunk(this, c);
    this.applyGeometry(c, 'meshSolid', res.solid, this.mats.solid, 0);
    this.applyGeometry(c, 'meshTrans', res.trans, this.mats.trans, 1);
    c.meshed = true;
    c.dirty = false;
    this.urgent.delete(c);
  }

  applyGeometry(c, key, data, mat, order) {
    let m = c[key];
    if (!data) {
      if (m) { this.group.remove(m); m.geometry.dispose(); c[key] = null; }
      return;
    }
    const g = makeGeometry(data, c.maxY);
    if (!m) {
      m = new THREE.Mesh(g, mat);
      m.position.set(c.cx * CS, 0, c.cz * CS);
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      m.renderOrder = order;
      this.group.add(m);
      c[key] = m;
    } else {
      m.geometry.dispose();
      m.geometry = g;
    }
  }

  update(px, pz, budget = 6, dt = 0) {
    this.time += dt;
    const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
    if (pcx !== this.pcx || pcz !== this.pcz || this.wantedDirty) this.rebuildWanted(pcx, pcz);
    const t0 = performance.now();
    if (this.urgent.size) {
      for (const c of [...this.urgent]) if (c.meshed && c.state >= ST_LIT && this.neighboursLit(c)) this.mesh(c);
      this.urgent.clear();
    }
    const rd2 = this.rd * this.rd + 1;
    let progressed = false;
    for (const w of this.wanted) {
      let c = this.getChunk(w.cx, w.cz);
      if (!c) {
        c = this.createChunk(w.cx, w.cz);
        progressed = true;
        if (performance.now() - t0 > budget) break;
      }
      if (c.state === ST_GENERATED) {
        this.lighting.initChunk(c);
        progressed = true;
        if (performance.now() - t0 > budget) break;
      }
      if (c.state === ST_LIT && w.d2 <= rd2 && (!c.meshed || c.dirty) && this.neighboursLit(c)) {
        this.mesh(c);
        progressed = true;
        if (performance.now() - t0 > budget) break;
      }
    }
    void progressed;
    this.processBlockUpdates();
    this.processFluids();
    // stats
    let m = 0;
    for (const c of this.chunks.values()) if (c.meshed) m++;
    this.stats.chunks = this.chunks.size;
    this.stats.meshed = m;
  }

  // count of wanted chunks (within render distance) that are meshed
  loadProgress(radius) {
    let total = 0, done = 0;
    for (const w of this.wanted) {
      if (w.d2 > radius * radius) break;
      total++;
      const c = this.getChunk(w.cx, w.cz);
      if (c && c.meshed) done++;
    }
    return total ? done / total : 0;
  }

  // ---- raycast -------------------------------------------------------------------------------------
  raycast(ox, oy, oz, dx, dy, dz, maxDist, hitLiquid = false) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tmx = dx > 0 ? (x + 1 - ox) * tdx : dx < 0 ? (ox - x) * tdx : Infinity;
    let tmy = dy > 0 ? (y + 1 - oy) * tdy : dy < 0 ? (oy - y) * tdy : Infinity;
    let tmz = dz > 0 ? (z + 1 - oz) * tdz : dz < 0 ? (oz - z) * tdz : Infinity;
    let nx = 0, ny = 0, nz = 0, t = 0;
    for (let steps = 0; steps < 200; steps++) {
      const id = this.getBlock(x, y, z);
      if (id !== 0 && (hitLiquid || !LIQUID[id])) {
        return { x, y, z, id, nx, ny, nz, t };
      }
      if (tmx < tmy && tmx < tmz) { t = tmx; if (t > maxDist) return null; x += sx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
      else if (tmy < tmz) { t = tmy; if (t > maxDist) return null; y += sy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
      else { t = tmz; if (t > maxDist) return null; z += sz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
    }
    return null;
  }

  dispose() {
    for (const c of this.chunks.values()) this.disposeChunkMeshes(c);
    this.scene.remove(this.group);
    this.chunks.clear();
  }
}

export { SHAPE, S_CROSS, S_TORCH };
