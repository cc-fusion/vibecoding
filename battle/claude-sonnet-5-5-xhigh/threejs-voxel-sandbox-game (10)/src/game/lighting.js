// Flood-fill voxel lighting (sky light + block light), incremental across chunk borders.
import { CS, CH, idx } from './constants.js';
import { OPACITY, EMIT } from './blocks.js';
import { ST_LIT } from './chunk.js';

const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
const DOWN = 3;

class Queue {
  constructor(n = 1 << 15) {
    this.x = new Int32Array(n); this.y = new Int32Array(n); this.z = new Int32Array(n); this.v = new Int32Array(n);
    this.head = 0; this.tail = 0; this.cap = n;
  }
  push(x, y, z, v = 0) {
    if (this.tail === this.cap) this.grow();
    const t = this.tail++;
    this.x[t] = x; this.y[t] = y; this.z[t] = z; this.v[t] = v;
  }
  grow() {
    const n = this.cap * 2;
    for (const k of ['x', 'y', 'z', 'v']) { const a = new Int32Array(n); a.set(this[k]); this[k] = a; }
    this.cap = n;
  }
  clear() { this.head = this.tail = 0; }
}

export class Lighting {
  constructor(world) {
    this.w = world;
    this.addQ = new Queue();
    this.remQ = new Queue();
    this.solidTop = new Int16Array(256);
  }

  // ---- propagation ----------------------------------------------------------------------------
  propagate(ch) {
    const w = this.w, q = this.addQ;
    while (q.head < q.tail) {
      const h = q.head++;
      const x = q.x[h], y = q.y[h], z = q.z[h];
      const chunk = w.getChunk(x >> 4, z >> 4);
      if (!chunk) continue;
      const li = idx(x & 15, y, z & 15);
      const L = ch === 0 ? chunk.light[li] >> 4 : chunk.light[li] & 15;
      if (L <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const ny = y + DY[d];
        if (ny < 0 || ny >= CH) continue;
        const nx = x + DX[d], nz = z + DZ[d];
        const nc = ((nx >> 4) === chunk.cx && (nz >> 4) === chunk.cz) ? chunk : w.getChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = idx(nx & 15, ny, nz & 15);
        const op = OPACITY[nc.blocks[ni]];
        if (op >= 15) continue;
        let nl = L - (op > 1 ? op : 1);
        if (ch === 0 && d === DOWN && L === 15 && op === 0) nl = 15;
        if (nl <= 0) continue;
        const cur = nc.light[ni];
        if (ch === 0) {
          if ((cur >> 4) < nl) { nc.light[ni] = (nl << 4) | (cur & 15); q.push(nx, ny, nz); if (nc !== chunk) w.markDirty(nc); }
        } else if ((cur & 15) < nl) { nc.light[ni] = (cur & 0xf0) | nl; q.push(nx, ny, nz); if (nc !== chunk) w.markDirty(nc); }
      }
    }
    q.clear();
  }

  remove(ch) {
    const w = this.w, rq = this.remQ, aq = this.addQ;
    while (rq.head < rq.tail) {
      const h = rq.head++;
      const x = rq.x[h], y = rq.y[h], z = rq.z[h], v = rq.v[h];
      for (let d = 0; d < 6; d++) {
        const ny = y + DY[d];
        if (ny < 0 || ny >= CH) continue;
        const nx = x + DX[d], nz = z + DZ[d];
        const nc = w.getChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = idx(nx & 15, ny, nz & 15);
        const cur = nc.light[ni];
        const nl = ch === 0 ? cur >> 4 : cur & 15;
        if (nl === 0) continue;
        if (nl < v || (ch === 0 && d === DOWN && v === 15 && nl === 15)) {
          nc.light[ni] = ch === 0 ? cur & 15 : cur & 0xf0;
          rq.push(nx, ny, nz, nl);
          w.markDirty(nc);
        } else if (nl >= v) aq.push(nx, ny, nz);
      }
    }
    rq.clear();
  }

  getL(ch, x, y, z) {
    if (y < 0 || y >= CH) return 0;
    const c = this.w.getChunk(x >> 4, z >> 4);
    if (!c) return 0;
    const l = c.light[idx(x & 15, y, z & 15)];
    return ch === 0 ? l >> 4 : l & 15;
  }
  setL(ch, x, y, z, v) {
    const c = this.w.getChunk(x >> 4, z >> 4);
    if (!c) return;
    const i = idx(x & 15, y, z & 15);
    c.light[i] = ch === 0 ? (v << 4) | (c.light[i] & 15) : (c.light[i] & 0xf0) | v;
    this.w.markDirty(c);
  }

  // ---- incremental update when a block changes ---------------------------------------------
  onBlockChanged(x, y, z, oldId, newId) {
    const oldOp = OPACITY[oldId], newOp = OPACITY[newId];
    const oldEm = EMIT[oldId], newEm = EMIT[newId];
    const seedNeighbours = (ch) => {
      for (let d = 0; d < 6; d++) {
        const ny = y + DY[d];
        if (ny < 0 || ny >= CH) continue;
        const nx = x + DX[d], nz = z + DZ[d];
        if (this.getL(ch, nx, ny, nz) > 1) this.addQ.push(nx, ny, nz);
      }
    };
    if (newOp !== oldOp) {
      for (let ch = 0; ch < 2; ch++) {
        if (newOp > oldOp) {
          const here = this.getL(ch, x, y, z);
          if (here > 0) {
            this.setL(ch, x, y, z, 0);
            this.remQ.push(x, y, z, here);
            this.remove(ch);
          }
          this.propagate(ch);
        } else {
          seedNeighbours(ch);
          this.propagate(ch);
        }
      }
    }
    if (newEm !== oldEm) {
      const here = this.getL(1, x, y, z);
      if (newEm > oldEm) {
        if (here < newEm) { this.setL(1, x, y, z, newEm); this.addQ.push(x, y, z); this.propagate(1); }
      } else {
        if (here > 0) { this.setL(1, x, y, z, 0); this.remQ.push(x, y, z, here); this.remove(1); }
        if (newEm > 0) { this.setL(1, x, y, z, newEm); this.addQ.push(x, y, z); }
        else seedNeighbours(1);
        this.propagate(1);
      }
    }
  }

  // ---- full initialisation of a freshly generated chunk ------------------------------------
  initChunk(chunk) {
    const w = this.w, blocks = chunk.blocks, light = chunk.light;
    light.fill(0);
    const top = Math.min(CH, chunk.maxY + 2);
    if (top < CH) light.fill(0xf0, top << 8);
    const solidTop = this.solidTop;
    let minSolid = CH, maxHeight = 0;
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      let s = 15, hgt = -1, st = 0;
      for (let y = top - 1; y >= 0; y--) {
        const i = idx(x, y, z);
        const op = OPACITY[blocks[i]];
        if (op >= 15) { st = y; if (hgt < 0) hgt = y; break; }
        if (op > 0) { if (hgt < 0) hgt = y; s -= op; if (s < 0) s = 0; }
        light[i] = s << 4;
      }
      const c2 = z * CS + x;
      chunk.height[c2] = hgt < 0 ? 0 : hgt;
      solidTop[c2] = st;
      if (st < minSolid) minSolid = st;
      if (chunk.height[c2] > maxHeight) maxHeight = chunk.height[c2];
    }

    const ox = chunk.cx * CS, oz = chunk.cz * CS;
    const nbrs = [w.getChunk(chunk.cx + 1, chunk.cz), w.getChunk(chunk.cx - 1, chunk.cz), w.getChunk(chunk.cx, chunk.cz + 1), w.getChunk(chunk.cx, chunk.cz - 1)];
    const lit = nbrs.map((n) => (n && n.state >= ST_LIT ? n : null));
    const ymax = Math.min(CH - 1, maxHeight + 1);

    // ---- block light
    const aq = this.addQ;
    aq.clear();
    for (let i = 0, n = top << 8; i < n; i++) {
      const e = EMIT[blocks[i]];
      if (e > 0) {
        light[i] = (light[i] & 0xf0) | e;
        aq.push(ox + (i & 15), i >> 8, oz + ((i >> 4) & 15));
      }
    }
    this.pullFromNeighbours(chunk, lit, 1, Math.min(CH - 1, chunk.maxY + 1));
    this.propagate(1);

    // ---- sky light
    aq.clear();
    for (let y = minSolid; y <= ymax; y++) {
      for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
        const i = idx(x, y, z);
        const s = light[i] >> 4;
        if (s < 2) continue;
        let seed = false;
        for (let d = 0; d < 6 && !seed; d += 1) {
          if (d === 2 || d === 3) continue;
          const nx = x + DX[d], nz = z + DZ[d];
          let nl, nop;
          if (nx >= 0 && nx < CS && nz >= 0 && nz < CS) {
            const ni = idx(nx, y, nz);
            nop = OPACITY[blocks[ni]]; nl = light[ni] >> 4;
          } else {
            const nc = lit[d === 0 ? 0 : d === 1 ? 1 : d === 4 ? 2 : 3];
            if (!nc) continue;
            const ni = idx((nx + CS) & 15, y, (nz + CS) & 15);
            nop = OPACITY[nc.blocks[ni]]; nl = nc.light[ni] >> 4;
          }
          if (nop < 15 && nl < s - 1) seed = true;
        }
        if (seed) aq.push(ox + x, y, oz + z);
      }
    }
    this.pullFromNeighbours(chunk, lit, 0, Math.min(CH - 1, Math.max(ymax, ...lit.map((n) => (n ? n.maxY + 1 : 0)))));
    this.propagate(0);
    chunk.state = ST_LIT;
  }

  // push the lit border cells of already-lit neighbours into the queue
  pullFromNeighbours(chunk, lit, ch, yTop) {
    const aq = this.addQ;
    const ox = chunk.cx * CS, oz = chunk.cz * CS;
    const sides = [
      [0, CS - 1, 0, 1, 0, 0],   // +x neighbour: neighbour column x=0, ours x=15
      [1, 0, CS - 1, -1, 0, 0],
      [2, 0, 0, 0, 1, 0],
      [3, 0, 0, 0, -1, 0],
    ];
    for (let s = 0; s < 4; s++) {
      const nc = lit[s];
      if (!nc) continue;
      for (let a = 0; a < CS; a++) {
        for (let y = 0; y <= yTop; y++) {
          let ox2, oz2, nx2, nz2;
          if (s === 0) { ox2 = CS - 1; oz2 = a; nx2 = 0; nz2 = a; }
          else if (s === 1) { ox2 = 0; oz2 = a; nx2 = CS - 1; nz2 = a; }
          else if (s === 2) { ox2 = a; oz2 = CS - 1; nx2 = a; nz2 = 0; }
          else { ox2 = a; oz2 = 0; nx2 = a; nz2 = CS - 1; }
          const ni = idx(nx2, y, nz2), oi = idx(ox2, y, oz2);
          const nl = ch === 0 ? nc.light[ni] >> 4 : nc.light[ni] & 15;
          if (nl < 2) continue;
          if (OPACITY[chunk.blocks[oi]] >= 15) continue;
          const ol = ch === 0 ? chunk.light[oi] >> 4 : chunk.light[oi] & 15;
          if (ol < nl - 1) aq.push(nc.cx * CS + nx2, y, nc.cz * CS + nz2);
        }
      }
    }
    void sides; void ox; void oz;
  }
}
