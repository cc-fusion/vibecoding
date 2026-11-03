import * as THREE from "three";
import { B, DIMMING, EMIT, OPAQUE, SOLID, block } from "./blocks";
import { Chunk, ChunkState } from "./chunk";
import {
  CHUNK_X,
  CHUNK_Z,
  WORLD_HEIGHT,
  chunkKey,
  idx,
  SEA_LEVEL,
} from "./constants";

/** fast numeric key for chunk coords (|c| < 32768) */
function nkey(cx: number, cz: number): number {
  return ((cx + 32768) << 16) | ((cz + 32768) & 0xffff);
}

const DIRS = new Int8Array([1, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, -1, 0, 1, 0, 0, -1, 0]);

class LQueue {
  x = new Int32Array(4096);
  y = new Int32Array(4096);
  z = new Int32Array(4096);
  l = new Int32Array(4096);
  n = 0;
  head = 0;
  reset() {
    this.n = 0;
    this.head = 0;
  }
  push(x: number, y: number, z: number, l: number) {
    if (this.n === this.x.length) this.grow();
    const i = this.n++;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.l[i] = l;
  }
  private grow() {
    const cap = this.x.length * 2;
    const nx = new Int32Array(cap);
    nx.set(this.x);
    const ny = new Int32Array(cap);
    ny.set(this.y);
    const nz = new Int32Array(cap);
    nz.set(this.z);
    const nl = new Int32Array(cap);
    nl.set(this.l);
    this.x = nx;
    this.y = ny;
    this.z = nz;
    this.l = nl;
  }
}
import { buildPadded, geomFrom, meshChunk } from "./mesher";
import { WorldGen } from "./worldgen";
import { makeRng } from "./noise";

export interface RayHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  id: number;
  dist: number;
  px: number;
  py: number;
  pz: number;
}

export class World {
  chunks = new Map<number, Chunk>();
  private cacheKey = -1;
  private cacheChunk: Chunk | undefined;
  gen: WorldGen;
  group = new THREE.Group();
  renderDistance = 8;
  /** edits to apply when chunk generates: key -> (index -> block) */
  pending = new Map<string, Map<number, number>>();
  savedEdits = new Map<string, Map<number, number>>();
  dirtyQueue: Chunk[] = [];
  private materials: THREE.Material[];
  private genQueue: { cx: number; cz: number; d: number }[] = [];
  private lastCenter = { cx: 9999, cz: 9999 };
  private genCursor = 0;
  private meshCursor = 0;
  public chunksGenerated = 0;
  public meshesBuilt = 0;
  public perf = { gen: 0, dec: 0, light: 0, mesh: 0, n: 0 };

  constructor(
    public seed: number,
    materials: THREE.Material[],
  ) {
    this.gen = new WorldGen(seed);
    this.materials = materials;
    this.group.matrixAutoUpdate = false;
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    const k = nkey(cx, cz);
    if (k === this.cacheKey) return this.cacheChunk;
    const c = this.chunks.get(k);
    this.cacheKey = k;
    this.cacheChunk = c;
    return c;
  }
  private invalidateCache() {
    this.cacheKey = -1;
    this.cacheChunk = undefined;
  }

  // ── block access ─────────────────────────────────────────────────────────
  getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    const cx = x >> 4;
    const cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return 0;
    return c.blocks[idx(x - cx * 16, y, z - cz * 16)];
  }

  isSolid(x: number, y: number, z: number): boolean {
    return SOLID[this.getBlock(x, y, z)] === 1;
  }
  isLiquid(x: number, y: number, z: number): boolean {
    const b = this.getBlock(x, y, z);
    return b === B.WATER || b === B.LAVA;
  }

  getLight(x: number, y: number, z: number): number {
    if (y < 0) return 0;
    if (y >= WORLD_HEIGHT) return 0xf0;
    const cx = x >> 4;
    const cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return 0xf0;
    return c.light[idx(x - cx * 16, y, z - cz * 16)];
  }

  /** combined 0..15 light at a position */
  lightLevel(x: number, y: number, z: number, dayLight: number): number {
    const l = this.getLight(x, y, z);
    return Math.max((l >> 4) * dayLight, l & 15);
  }

  private markDirty(cx: number, cz: number) {
    const c = this.getChunk(cx, cz);
    if (c && c.state === ChunkState.READY) c.dirty = true;
  }

  setBlock(x: number, y: number, z: number, id: number, record = true): boolean {
    if (y < 0 || y >= WORLD_HEIGHT) return false;
    const cx = x >> 4;
    const cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return false;
    const lx = x - cx * 16;
    const lz = z - cz * 16;
    const i = idx(lx, y, lz);
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    if (id !== 0) {
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
    }
    if (record) c.markEdit(lx, y, lz, id);

    this.updateLightForBlockChange(x, y, z, old, id);

    c.dirty = true;
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === 15) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === 15) this.markDirty(cx, cz + 1);
    if (lx === 0 && lz === 0) this.markDirty(cx - 1, cz - 1);
    if (lx === 15 && lz === 0) this.markDirty(cx + 1, cz - 1);
    if (lx === 0 && lz === 15) this.markDirty(cx - 1, cz + 1);
    if (lx === 15 && lz === 15) this.markDirty(cx + 1, cz + 1);
    return true;
  }

  // ── lighting ─────────────────────────────────────────────────────────────
  private setSky(x: number, y: number, z: number, v: number) {
    const cx = x >> 4,
      cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return;
    const i = idx(x - cx * 16, y, z - cz * 16);
    c.light[i] = (c.light[i] & 0x0f) | (v << 4);
    c.dirty = true;
  }
  private setBlk(x: number, y: number, z: number, v: number) {
    const cx = x >> 4,
      cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return;
    const i = idx(x - cx * 16, y, z - cz * 16);
    c.light[i] = (c.light[i] & 0xf0) | v;
    c.dirty = true;
  }
  private hasChunk(x: number, z: number) {
    return this.getChunk(x >> 4, z >> 4) !== undefined;
  }

  private propagateSky(q: LQueue) {
    while (q.head < q.n) {
      const x = q.x[q.head],
        y = q.y[q.head],
        z = q.z[q.head],
        l = q.l[q.head];
      q.head++;
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const dx = DIRS[d * 3],
          dy = DIRS[d * 3 + 1],
          dz = DIRS[d * 3 + 2];
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        const nc = this.getChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = idx(nx - (nx >> 4) * 16, ny, nz - (nz >> 4) * 16);
        const nb = nc.blocks[ni];
        if (OPAQUE[nb]) continue;
        const dim = DIMMING[nb];
        const target = dy === -1 && l === 15 && dim === 0 ? 15 : l - (dim > 1 ? dim : 1);
        if (target <= 0) continue;
        if (nc.light[ni] >> 4 >= target) continue;
        nc.light[ni] = (nc.light[ni] & 0x0f) | (target << 4);
        nc.dirty = true;
        q.push(nx, ny, nz, target);
      }
    }
  }

  private propagateBlk(q: LQueue) {
    while (q.head < q.n) {
      const x = q.x[q.head],
        y = q.y[q.head],
        z = q.z[q.head],
        l = q.l[q.head];
      q.head++;
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const dx = DIRS[d * 3],
          dy = DIRS[d * 3 + 1],
          dz = DIRS[d * 3 + 2];
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        const nc = this.getChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = idx(nx - (nx >> 4) * 16, ny, nz - (nz >> 4) * 16);
        const nb = nc.blocks[ni];
        if (OPAQUE[nb]) continue;
        const dim = DIMMING[nb];
        const target = l - (dim > 1 ? dim : 1);
        if (target <= 0) continue;
        if ((nc.light[ni] & 15) >= target) continue;
        nc.light[ni] = (nc.light[ni] & 0xf0) | target;
        nc.dirty = true;
        q.push(nx, ny, nz, target);
      }
    }
  }

  /** full relight of a freshly generated chunk (plus inflow from neighbours) */
  lightChunk(c: Chunk) {
    const ox = c.cx * 16;
    const oz = c.cz * 16;
    c.light.fill(0);
    const q = new LQueue();
    const bq = new LQueue();
    // everything above the highest block is full skylight; fill in bulk
    const top = Math.min(WORLD_HEIGHT - 1, c.maxY + 1);
    c.light.fill(0xf0, (top + 1) * 256, WORLD_HEIGHT * 256);
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      for (let lx = 0; lx < CHUNK_X; lx++) {
        let level = 15;
        for (let y = top; y >= 0; y--) {
          const i = idx(lx, y, lz);
          const b = c.blocks[i];
          if (OPAQUE[b]) {
            level = 0;
          } else if (DIMMING[b] > 0) {
            level = Math.max(0, level - DIMMING[b]);
          }
          if (level > 0) {
            c.light[i] = level << 4;
            let seed = level < 15 || lx === 0 || lx === 15 || lz === 0 || lz === 15;
            if (!seed) {
              seed =
                OPAQUE[c.blocks[i - 1]] === 1 ||
                OPAQUE[c.blocks[i + 1]] === 1 ||
                OPAQUE[c.blocks[i - CHUNK_X]] === 1 ||
                OPAQUE[c.blocks[i + CHUNK_X]] === 1;
            }
            if (seed) q.push(ox + lx, y, oz + lz, level);
          }
          if (EMIT[b] > 0) {
            c.light[i] = (c.light[i] & 0xf0) | EMIT[b];
            bq.push(ox + lx, y, oz + lz, EMIT[b]);
          }
          if (level === 0 && !OPAQUE[b] && y < c.minY) break;
        }
      }
    }
    // inflow from already lit neighbours
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const n = this.getChunk(c.cx + dx, c.cz + dz);
      if (!n || n.state !== ChunkState.READY) continue;
      const nox = n.cx * 16,
        noz = n.cz * 16;
      const xs = dx === -1 ? 15 : dx === 1 ? 0 : -1;
      const zs = dz === -1 ? 15 : dz === 1 ? 0 : -1;
      const yTop = Math.min(WORLD_HEIGHT - 1, Math.max(c.maxY, n.maxY) + 1);
      for (let k = 0; k < 16; k++) {
        const lx = xs === -1 ? k : xs;
        const lz = zs === -1 ? k : zs;
        for (let y = 0; y <= yTop; y++) {
          const li = n.light[idx(lx, y, lz)];
          if (li >> 4) q.push(nox + lx, y, noz + lz, li >> 4);
          if (li & 15) bq.push(nox + lx, y, noz + lz, li & 15);
        }
      }
    }
    this.propagateSky(q);
    this.propagateBlk(bq);
    c.lightDirty = false;
  }

  private removeLight(x: number, y: number, z: number, sky: boolean) {
    const rq = new LQueue();
    const aq = new LQueue();
    const start = sky ? this.getLight(x, y, z) >> 4 : this.getLight(x, y, z) & 15;
    if (start === 0) return;
    if (sky) this.setSky(x, y, z, 0);
    else this.setBlk(x, y, z, 0);
    rq.push(x, y, z, start);
    while (rq.head < rq.n) {
      const cx = rq.x[rq.head],
        cy = rq.y[rq.head],
        cz = rq.z[rq.head],
        cl = rq.l[rq.head];
      rq.head++;
      for (let d = 0; d < 6; d++) {
        const dx = DIRS[d * 3], dy = DIRS[d * 3 + 1], dz = DIRS[d * 3 + 2];
        const nx = cx + dx,
          ny = cy + dy,
          nz = cz + dz;
        if (ny < 0 || ny >= WORLD_HEIGHT) continue;
        if (!this.hasChunk(nx, nz)) continue;
        const raw = this.getLight(nx, ny, nz);
        const nl = sky ? raw >> 4 : raw & 15;
        if (nl === 0) continue;
        const straightDown = sky && dy === -1 && cl === 15;
        if (nl < cl || straightDown) {
          if (sky) this.setSky(nx, ny, nz, 0);
          else this.setBlk(nx, ny, nz, 0);
          rq.push(nx, ny, nz, nl);
        } else if (nl >= cl) {
          aq.push(nx, ny, nz, nl);
        }
      }
    }
    if (sky) this.propagateSky(aq);
    else this.propagateBlk(aq);
  }

  private updateLightForBlockChange(x: number, y: number, z: number, oldId: number, id: number) {
    const wasOpaque = OPAQUE[oldId] === 1;
    const nowOpaque = OPAQUE[id] === 1;
    const oldEmit = EMIT[oldId];
    const newEmit = EMIT[id];

    if (oldEmit > 0) this.removeLight(x, y, z, false);
    if (nowOpaque || DIMMING[id] > DIMMING[oldId]) {
      this.removeLight(x, y, z, true);
      if (!nowOpaque) {
        // re-seed from neighbours
        const q = new LQueue();
        for (const [dx, dy, dz] of [
          [1, 0, 0],
          [-1, 0, 0],
          [0, 0, 1],
          [0, 0, -1],
          [0, 1, 0],
          [0, -1, 0],
        ]) {
          const l = this.getLight(x + dx, y + dy, z + dz) >> 4;
          if (l > 0) q.push(x + dx, y + dy, z + dz, l);
        }
        this.propagateSky(q);
      }
    }
    if (wasOpaque && !nowOpaque) {
      // light can now flow in
      const q = new LQueue();
      const bq = new LQueue();
      for (const [dx, dy, dz] of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 0, 1],
        [0, 0, -1],
        [0, 1, 0],
        [0, -1, 0],
      ]) {
        const raw = this.getLight(x + dx, y + dy, z + dz);
        if (raw >> 4) q.push(x + dx, y + dy, z + dz, raw >> 4);
        if (raw & 15) bq.push(x + dx, y + dy, z + dz, raw & 15);
      }
      // direct sky column
      if (y + 1 >= WORLD_HEIGHT || (this.getLight(x, y + 1, z) >> 4) === 15) {
        this.setSky(x, y, z, 15);
        q.push(x, y, z, 15);
      }
      this.propagateSky(q);
      this.propagateBlk(bq);
    }
    if (newEmit > 0) {
      this.setBlk(x, y, z, newEmit);
      const bq = new LQueue();
      bq.push(x, y, z, newEmit);
      this.propagateBlk(bq);
    }
  }

  // ── generation pipeline ──────────────────────────────────────────────────
  private addPending(x: number, y: number, z: number, id: number, replace: boolean) {
    const cx = x >> 4,
      cz = z >> 4;
    const key = chunkKey(cx, cz);
    const c = this.getChunk(cx, cz);
    const i = idx(x - cx * 16, y, z - cz * 16);
    if (c && c.state >= ChunkState.TERRAIN) {
      const cur = c.blocks[i];
      if (!replace && cur !== 0 && cur !== B.WATER && !block(cur).replaceable) return;
      c.blocks[i] = id;
      if (y < c.minY) c.minY = y;
      if (y > c.maxY) c.maxY = y;
      if (c.state === ChunkState.READY) {
        c.dirty = true;
        c.lightDirty = true;
      }
      return;
    }
    let m = this.pending.get(key);
    if (!m) {
      m = new Map();
      this.pending.set(key, m);
    }
    m.set(i, id);
  }

  private createChunk(cx: number, cz: number): Chunk {
    const tg = performance.now();
    const c = new Chunk(cx, cz);
    this.chunks.set(nkey(cx, cz), c);
    this.invalidateCache();
    this.gen.generateChunk(cx, cz, c.blocks, c.biomes, c.heightmap);
    c.recomputeBounds();
    c.state = ChunkState.TERRAIN;
    const p = this.pending.get(chunkKey(cx, cz));
    if (p) {
      for (const [i, id] of p) {
        c.blocks[i] = id;
        const y = Math.floor(i / 256);
        if (y < c.minY) c.minY = y;
        if (y > c.maxY) c.maxY = y;
      }
      this.pending.delete(chunkKey(cx, cz));
    }
    this.chunksGenerated++;
    this.perf.gen += performance.now() - tg;
    return c;
  }

  private decorate(c: Chunk) {
    const td = performance.now();
    const place = (x: number, y: number, z: number, id: number, replace = true) => {
      if (y < 0 || y >= WORLD_HEIGHT) return;
      this.addPending(x, y, z, id, replace);
    };
    this.gen.decorateChunk(c.cx, c.cz, place, (x, z) => {
      const ccx = x >> 4,
        ccz = z >> 4;
      const ch = this.getChunk(ccx, ccz);
      if (ch) return ch.heightmap[(z - ccz * 16) * CHUNK_X + (x - ccx * 16)];
      return Math.floor(this.gen.heightAt(x, z));
    }, c.biomes);
    c.state = ChunkState.DECORATED;
    // apply saved player edits on top of generation
    const saved = this.savedEdits.get(chunkKey(c.cx, c.cz));
    if (saved) {
      for (const [i, id] of saved) {
        c.blocks[i] = id;
        const y = Math.floor(i / 256);
        if (id !== 0) {
          if (y < c.minY) c.minY = y;
          if (y > c.maxY) c.maxY = y;
        }
      }
      c.edits = new Map(saved);
    }
    this.perf.dec += performance.now() - td;
  }

  private buildMesh(c: Chunk) {
    buildPadded(this, c);
    const res = meshChunk(c);
    if (!c.group) {
      c.group = new THREE.Group();
      c.group.position.set(c.cx * 16, 0, c.cz * 16);
      c.group.matrixAutoUpdate = false;
      c.group.updateMatrix();
      this.group.add(c.group);
    }
    for (let i = 0; i < 3; i++) {
      const d = res.groups[i];
      const existing = c.meshes[i];
      if (!d) {
        if (existing) {
          existing.geometry.dispose();
          existing.removeFromParent();
          c.meshes[i] = null;
        }
        continue;
      }
      const geo = geomFrom(d);
      geo.computeBoundingSphere();
      if (existing) {
        existing.geometry.dispose();
        existing.geometry = geo;
      } else {
        const m = new THREE.Mesh(geo, this.materials[i]);
        m.frustumCulled = true;
        m.renderOrder = i === 2 ? 2 : 0;
        m.matrixAutoUpdate = false;
        m.updateMatrix();
        c.group.add(m);
        c.meshes[i] = m;
      }
    }
    c.dirty = false;
    this.meshesBuilt++;
  }

  /** run the streaming pipeline within a time budget (ms) */
  update(px: number, pz: number, budgetMs: number) {
    const ccx = Math.floor(px / 16);
    const ccz = Math.floor(pz / 16);
    const R = this.renderDistance;
    if (ccx !== this.lastCenter.cx || ccz !== this.lastCenter.cz) {
      this.lastCenter = { cx: ccx, cz: ccz };
      this.genQueue.length = 0;
      for (let dz = -R - 1; dz <= R + 1; dz++)
        for (let dx = -R - 1; dx <= R + 1; dx++) {
          const d = Math.hypot(dx, dz);
          if (d > R + 1.2) continue;
          this.genQueue.push({ cx: ccx + dx, cz: ccz + dz, d });
        }
      this.genQueue.sort((a, b) => a.d - b.d);
      this.genCursor = 0;
      this.meshCursor = 0;
      this.unloadFar(ccx, ccz);
    }

    const t0 = performance.now();
    const genBudget = budgetMs * 0.45;
    // stage 1+2: terrain & decoration
    while (this.genCursor < this.genQueue.length) {
      if (performance.now() - t0 > genBudget) break;
      const e = this.genQueue[this.genCursor];
      let c = this.getChunk(e.cx, e.cz);
      if (!c) c = this.createChunk(e.cx, e.cz);
      if (c.state === ChunkState.TERRAIN) this.decorate(c);
      this.genCursor++;
    }
    // stage 3+4: light & mesh (needs all 8 neighbours decorated)
    const start = this.meshCursor;
    let scanned = 0;
    while (scanned < this.genQueue.length) {
      if (performance.now() - t0 > budgetMs) break;
      const qi = (start + scanned) % this.genQueue.length;
      scanned++;
      const e = this.genQueue[qi];
      if (e.d > R + 0.3) continue;
      const c = this.getChunk(e.cx, e.cz);
      if (!c || c.state < ChunkState.DECORATED) continue;
      if (c.state === ChunkState.READY && !c.dirty) continue;
      this.meshCursor = qi;
      let ok = true;
      for (let dz = -1; dz <= 1 && ok; dz++)
        for (let dx = -1; dx <= 1; dx++) {
          const n = this.getChunk(e.cx + dx, e.cz + dz);
          if (!n || n.state < ChunkState.DECORATED) {
            ok = false;
            break;
          }
        }
      if (!ok) continue;
      if (c.lightDirty) {
        const tl = performance.now();
        this.lightChunk(c);
        this.perf.light += performance.now() - tl;
      }
      const tm = performance.now();
      this.buildMesh(c);
      this.perf.mesh += performance.now() - tm;
      this.perf.n++;
      c.state = ChunkState.READY;
    }
  }

  /** synchronously build everything within `radius` (used on world load) */
  prepare(px: number, pz: number, radius: number) {
    const ccx = Math.floor(px / 16);
    const ccz = Math.floor(pz / 16);
    for (let dz = -radius - 1; dz <= radius + 1; dz++)
      for (let dx = -radius - 1; dx <= radius + 1; dx++) {
        let c = this.getChunk(ccx + dx, ccz + dz);
        if (!c) c = this.createChunk(ccx + dx, ccz + dz);
        if (c.state === ChunkState.TERRAIN) this.decorate(c);
      }
    for (let dz = -radius; dz <= radius; dz++)
      for (let dx = -radius; dx <= radius; dx++) {
        const c = this.getChunk(ccx + dx, ccz + dz);
        if (!c || c.state < ChunkState.DECORATED) continue;
        if (c.lightDirty) this.lightChunk(c);
        this.buildMesh(c);
        c.state = ChunkState.READY;
      }
  }

  /** immediate remesh of chunks flagged dirty by edits (called each frame) */
  flushDirty(limit = 4) {
    let n = 0;
    for (const c of this.chunks.values()) {
      if (c.state !== ChunkState.READY || !c.dirty) continue;
      if (c.lightDirty) this.lightChunk(c);
      this.buildMesh(c);
      if (++n >= limit) break;
    }
  }

  private unloadFar(ccx: number, ccz: number) {
    const R = this.renderDistance + 3;
    for (const [key, c] of this.chunks) {
      if (Math.hypot(c.cx - ccx, c.cz - ccz) > R) {
        if (c.edits && c.edits.size) this.savedEdits.set(chunkKey(c.cx, c.cz), new Map(c.edits));
        c.dispose();
        this.chunks.delete(key);
      }
    }
    this.invalidateCache();
  }

  collectEdits(): Record<string, Record<number, number>> {
    const out: Record<string, Record<number, number>> = {};
    for (const [k, m] of this.savedEdits) {
      const o: Record<number, number> = {};
      for (const [i, v] of m) o[i] = v;
      out[k] = o;
    }
    for (const c of this.chunks.values()) {
      if (!c.edits || !c.edits.size) continue;
      const k = chunkKey(c.cx, c.cz);
      const o: Record<number, number> = out[k] ?? {};
      for (const [i, v] of c.edits) o[i] = v;
      out[k] = o;
    }
    return out;
  }

  loadEdits(data: Record<string, Record<number, number>>) {
    for (const k of Object.keys(data)) {
      const m = new Map<number, number>();
      for (const i of Object.keys(data[k])) m.set(+i, data[k][+i]);
      this.savedEdits.set(k, m);
    }
  }

  // ── queries ──────────────────────────────────────────────────────────────
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, fluids = false): RayHit | null {
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / (dir.x || 1e-9));
    const tDeltaY = Math.abs(1 / (dir.y || 1e-9));
    const tDeltaZ = Math.abs(1 / (dir.z || 1e-9));
    let tMaxX = ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) || 1e-9) * tDeltaX;
    let tMaxY = ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) || 1e-9) * tDeltaY;
    let tMaxZ = ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) || 1e-9) * tDeltaZ;
    let nx = 0,
      ny = 0,
      nz = 0;
    let t = 0;
    for (let i = 0; i < 256; i++) {
      const id = this.getBlock(x, y, z);
      if (id !== 0 && (fluids || !block(id).liquid)) {
        return {
          x,
          y,
          z,
          nx,
          ny,
          nz,
          id,
          dist: t,
          px: x + nx,
          py: y + ny,
          pz: z + nz,
        };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
      if (t > maxDist) break;
    }
    return null;
  }

  surfaceHeight(x: number, z: number): number {
    const cx = x >> 4,
      cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (c) {
      for (let y = WORLD_HEIGHT - 1; y > 0; y--) {
        const b = c.blocks[idx(x - cx * 16, y, z - cz * 16)];
        if (b !== 0 && b !== B.WATER) return y + 1;
      }
      return SEA_LEVEL + 1;
    }
    return Math.floor(this.gen.heightAt(x, z)) + 1;
  }

  biomeAt(x: number, z: number): number {
    const cx = x >> 4,
      cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (c) return c.biomes[(z - cz * 16) * CHUNK_X + (x - cx * 16)];
    return this.gen.biomeAt(x, z, this.gen.heightAt(x, z));
  }

  /** random block ticks near the player: sapling growth, grass spread */
  randomTick(px: number, pz: number, rng: () => number) {
    const R = 3;
    for (let n = 0; n < 28; n++) {
      const cx = (px >> 4) + Math.floor(rng() * (R * 2 + 1)) - R;
      const cz = (pz >> 4) + Math.floor(rng() * (R * 2 + 1)) - R;
      const c = this.getChunk(cx, cz);
      if (!c || c.state !== ChunkState.READY) continue;
      const lx = Math.floor(rng() * 16);
      const lz = Math.floor(rng() * 16);
      const y = Math.max(1, Math.min(WORLD_HEIGHT - 2, c.heightmap[lz * 16 + lx] + Math.floor(rng() * 5) - 2));
      const wx = cx * 16 + lx;
      const wz = cz * 16 + lz;
      const id = c.blocks[idx(lx, y, lz)];
      if (id === B.OAK_SAPLING || id === B.SPRUCE_SAPLING) {
        if ((this.getLight(wx, y, wz) >> 4) < 8) continue;
        this.setBlock(wx, y, wz, 0);
        const place = (x2: number, y2: number, z2: number, bid: number, replace = true) =>
          this.addPending(x2, y2, z2, bid, replace);
        this.gen.tree(id === B.OAK_SAPLING ? "oak" : "spruce", wx, y, wz, place, rng);
        for (let dz = -3; dz <= 3; dz++)
          for (let dx = -3; dx <= 3; dx++) {
            const nc = this.getChunk(cx + ((lx + dx) >> 4), cz + ((lz + dz) >> 4));
            if (nc) {
              nc.dirty = true;
              nc.lightDirty = true;
            }
          }
      } else if (id === B.DIRT) {
        const above = this.getBlock(wx, y + 1, wz);
        if (above !== 0) continue;
        if ((this.getLight(wx, y + 1, wz) >> 4) < 9) continue;
        let near = false;
        for (let dx = -1; dx <= 1 && !near; dx++)
          for (let dz = -1; dz <= 1; dz++)
            if (this.getBlock(wx + dx, y, wz + dz) === B.GRASS) {
              near = true;
              break;
            }
        if (near) this.setBlock(wx, y, wz, B.GRASS);
      } else if (id === B.GRASS) {
        const above = this.getBlock(wx, y + 1, wz);
        if (OPAQUE[above]) this.setBlock(wx, y, wz, B.DIRT);
      }
    }
  }

  dispose() {
    for (const c of this.chunks.values()) c.dispose();
    this.chunks.clear();
  }
}

export { makeRng };
