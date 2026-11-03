import * as THREE from 'three';
import { CX, CY, CZ, idx, WorldGen } from './worldgen.js';
import { BLOCKS, B } from './blocks.js';
import { computeLight } from './lighting.js';
import { meshChunk } from './mesher.js';

export const chunkKey = (cx, cz) => cx + ',' + cz;

export class Chunk {
  constructor(cx, cz, blocks) {
    this.cx = cx; this.cz = cz;
    this.blocks = blocks;
    this.sky = new Uint8Array(CX * CY * CZ);
    this.light = new Uint8Array(CX * CY * CZ);
    this.lit = false;
    this.meshed = false;
    this.dirty = false;      // needs remesh
    this.relight = false;    // needs relight before remesh
    this.solid = null; this.water = null;
    this.group = new THREE.Group();
    this.group.position.set(cx * CX, 0, cz * CZ);
  }
  get(x, y, z) { return this.blocks[idx(x, y, z)]; }
}

export class World {
  constructor(scene, seed, materials) {
    this.scene = scene;
    this.gen = new WorldGen(seed);
    this.seed = seed;
    this.chunks = new Map();
    this.edits = new Map();     // key -> Map(index -> block)
    this.materials = materials;
    this.renderDistance = 7;
    this.loadQueue = [];
    this.center = { cx: 0, cz: 0 }; this.lastRebuild = -Infinity;
    this.listeners = new Set();
    this.lightCounter = 0;
    this.maxHeightCache = new Map();
  }

  // ---------- block access ----------
  getChunk(cx, cz) { return this.chunks.get(chunkKey(cx, cz)); }
  getChunkAt(x, z) { return this.chunks.get(chunkKey(Math.floor(x / CX), Math.floor(z / CZ))); }

  getBlock(x, y, z) {
    if (y < 0 || y >= CY) return B.AIR;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return B.AIR;
    return c.blocks[idx(x - cx * CX, y, z - cz * CZ)];
  }
  getSky(x, y, z) {
    if (y >= CY) return 15; if (y < 0) return 0;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return 15;
    return c.sky[idx(x - cx * CX, y, z - cz * CZ)];
  }
  getLight(x, y, z) {
    if (y >= CY || y < 0) return 0;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return 0;
    return c.light[idx(x - cx * CX, y, z - cz * CZ)];
  }
  isSolid(x, y, z) { const d = BLOCKS[this.getBlock(x, y, z)]; return d ? d.solid : false; }
  isLoaded(x, z) { const c = this.getChunkAt(x, z); return !!(c && c.lit); }

  setBlock(x, y, z, id, record = true) {
    if (y < 0 || y >= CY) return false;
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return false;
    const lx = x - cx * CX, lz = z - cz * CZ;
    const i = idx(lx, y, lz);
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    if (record) {
      const k = chunkKey(cx, cz);
      let m = this.edits.get(k); if (!m) { m = new Map(); this.edits.set(k, m); }
      m.set(i, id);
    }
    // relight this chunk and any neighbor within light range of the change
    const affected = new Set([c]);
    const near = (v) => v <= 15, far = (v, max) => v >= max - 16;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dz) continue;
      if ((dx === -1 && !near(lx)) || (dx === 1 && !far(lx, CX)) || (dz === -1 && !near(lz)) || (dz === 1 && !far(lz, CZ))) continue;
      const n = this.getChunk(cx + dx, cz + dz); if (n && n.lit) affected.add(n);
    }
    const oldDef = BLOCKS[old], newDef = BLOCKS[id];
    const lightChanged = oldDef.opaque !== newDef.opaque || oldDef.light !== newDef.light || oldDef.transparent !== newDef.transparent;
    for (const ch of affected) { ch.relight = lightChanged; ch.dirty = true; }
    if (!lightChanged) {
      // still need neighbors remeshed if on border for face culling
      for (const ch of affected) ch.dirty = true;
    }
    this.maxHeightCache.delete(chunkKey(cx, cz));
    for (const l of this.listeners) l(x, y, z, old, id);
    return true;
  }

  // ---------- streaming ----------
  setCenter(x, z) {
    const cx = Math.floor(x / CX), cz = Math.floor(z / CZ);
    const now = performance.now();
    if (cx === this.center.cx && cz === this.center.cz && (this.loadQueue.length || now - this.lastRebuild < 1500)) return;
    this.center = { cx, cz }; this.lastRebuild = now;
    this.rebuildQueue();
  }
  rebuildQueue() {
    const { cx, cz } = this.center, rd = this.renderDistance;
    const q = [];
    for (let dx = -rd; dx <= rd; dx++) for (let dz = -rd; dz <= rd; dz++) {
      const d2 = dx * dx + dz * dz; if (d2 > (rd + 0.5) * (rd + 0.5)) continue;
      const k = chunkKey(cx + dx, cz + dz);
      const c = this.chunks.get(k);
      if (!c || !c.meshed || c.dirty) q.push({ cx: cx + dx, cz: cz + dz, d2 });
    }
    q.sort((a, b) => a.d2 - b.d2);
    this.loadQueue = q;
    // unload far chunks
    const maxD = (rd + 2) * (rd + 2);
    for (const [k, c] of this.chunks) {
      const dx = c.cx - cx, dz = c.cz - cz;
      if (dx * dx + dz * dz > maxD) this.unloadChunk(k, c);
    }
  }
  unloadChunk(k, c) {
    this.disposeMesh(c);
    this.scene.remove(c.group);
    this.chunks.delete(k);
    this.maxHeightCache.delete(k);
  }
  disposeMesh(c) {
    for (const m of [c.solid, c.water]) if (m) { c.group.remove(m); m.geometry.dispose(); }
    c.solid = c.water = null;
  }

  ensureChunkData(cx, cz) {
    const k = chunkKey(cx, cz);
    let c = this.chunks.get(k);
    if (c) return c;
    const blocks = this.gen.generateChunk(cx, cz);
    const ed = this.edits.get(k);
    if (ed) for (const [i, v] of ed) blocks[i] = v;
    c = new Chunk(cx, cz, blocks);
    this.chunks.set(k, c);
    this.scene.add(c.group);
    return c;
  }

  // Process load/mesh work within a time budget (ms). Returns remaining queue length.
  update(budgetMs) {
    const start = performance.now();
    // dirty chunks get priority (player edits)
    let dirtyWork = 0;
    for (const c of this.chunks.values()) {
      if (c.dirty && c.meshed) {
        this.lightAndMesh(c);
        if (++dirtyWork >= 6 || performance.now() - start > budgetMs * 0.6) break;
      }
    }
    while (this.loadQueue.length && performance.now() - start < budgetMs) {
      const { cx, cz } = this.loadQueue[0];
      const c = this.ensureChunkData(cx, cz);
      // need neighbor data for seamless meshing & lighting
      let ready = true;
      for (let dx = -1; dx <= 1 && ready; dx++) for (let dz = -1; dz <= 1; dz++) {
        if (!dx && !dz) continue;
        if (!this.getChunk(cx + dx, cz + dz)) { this.ensureChunkData(cx + dx, cz + dz); if (performance.now() - start > budgetMs) { ready = false; break; } }
      }
      if (!ready) break;
      this.loadQueue.shift();
      this.lightAndMesh(c);
    }
    return this.loadQueue.length;
  }

  lightAndMesh(c) {
    if (!c.lit || c.relight) {
      const neighborsToRelight = computeLight(this, c);
      c.lit = true; c.relight = false;
      for (const n of neighborsToRelight) if (n.meshed && !n.relight) { n.relight = true; n.dirty = true; }
    }
    this.disposeMesh(c);
    const { solid, water } = meshChunk(this, c);
    if (solid) { c.solid = new THREE.Mesh(solid, this.materials.solid); c.solid.frustumCulled = true; c.group.add(c.solid); }
    if (water) { c.water = new THREE.Mesh(water, this.materials.water); c.water.renderOrder = 2; c.group.add(c.water); }
    c.meshed = true; c.dirty = false;
  }

  // Highest non-air block at column (for spawning/mobs/rain)
  surfaceY(x, z) {
    for (let y = CY - 1; y >= 0; y--) { const b = this.getBlock(x, y, z); if (b !== B.AIR && !BLOCKS[b].liquid) return y; }
    return 0;
  }
  topY(x, z) {
    for (let y = CY - 1; y >= 0; y--) if (this.getBlock(x, y, z) !== B.AIR) return y;
    return 0;
  }

  // ---------- raycast (DDA) ----------
  raycast(origin, dir, maxDist, includeLiquid = false) {
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
    const tDeltaX = Math.abs(1 / dir.x), tDeltaY = Math.abs(1 / dir.y), tDeltaZ = Math.abs(1 / dir.z);
    let tMaxX = dir.x > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
    let tMaxY = dir.y > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
    let tMaxZ = dir.z > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;
    let face = [0, 0, 0], t = 0;
    for (let i = 0; i < 256; i++) {
      const b = this.getBlock(x, y, z);
      if (b !== B.AIR) {
        const d = BLOCKS[b];
        if (!d.liquid || includeLiquid) return { x, y, z, block: b, face, dist: t };
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0]; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
      } else {
        if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0]; }
        else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ]; }
      }
      if (t > maxDist) return null;
    }
    return null;
  }

  // ---------- persistence ----------
  serializeEdits() {
    const out = {};
    for (const [k, m] of this.edits) { const arr = []; for (const [i, v] of m) arr.push(i, v); out[k] = arr; }
    return out;
  }
  loadEdits(obj) {
    this.edits.clear();
    for (const k in obj) { const arr = obj[k]; const m = new Map(); for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]); this.edits.set(k, m); }
  }
  dispose() {
    for (const [k, c] of this.chunks) this.unloadChunk(k, c);
  }
}
