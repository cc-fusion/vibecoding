// World data: chunk storage, block access, heightmaps, cross-chunk BFS lighting.
import type * as THREE from 'three';
import { CH, CVOL, T_OPACITY, T_LIGHT, T_SOLID, isSurface } from './blocks';

export const ckey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);

export class Chunk {
  state = 1; // 1 = data, 2 = lit
  light = new Uint8Array(CVOL);
  dirty = true; meshing = false; modified = false; urgent = false;
  version = 0; top = 0;
  mesh: THREE.Mesh | null = null;
  wmesh: THREE.Mesh | null = null;
  constructor(public cx: number, public cz: number, public blocks: Uint8Array, public hm: Int16Array, public biome: Uint8Array, public climate: Uint8Array) {
    this.recomputeTop();
  }
  recomputeTop() {
    let m = 0;
    for (let i = 0; i < 256; i++) if (this.hm[i] > m) m = this.hm[i];
    this.top = Math.min(CH - 2, m + 2);
  }
}

const DXS = [1, -1, 0, 0, 0, 0], DYS = [0, 0, 1, -1, 0, 0], DZS = [0, 0, 0, 0, 1, -1];

export class World {
  chunks = new Map<number, Chunk>();
  dirty = new Set<Chunk>();
  touched = new Set<Chunk>();
  q: number[] = [];
  rq: number[] = [];
  constructor(public seed: number) {}

  getChunk(cx: number, cz: number) { return this.chunks.get(ckey(cx, cz)); }
  chunkAt(x: number, z: number) { return this.chunks.get(ckey(x >> 4, z >> 4)); }
  isLoaded(x: number, z: number) { return this.chunkAt(x, z) !== undefined; }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= CH) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    return c ? c.blocks[(y * 16 + (z & 15)) * 16 + (x & 15)] : 0;
  }
  solidAt(x: number, y: number, z: number): boolean {
    if (y < 0) return false;
    if (y >= CH) return false;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c) return true;
    return T_SOLID[c.blocks[(y * 16 + (z & 15)) * 16 + (x & 15)]] === 1;
  }
  heightAt(x: number, z: number) {
    const c = this.chunkAt(x, z);
    return c ? c.hm[(z & 15) * 16 + (x & 15)] : -1;
  }
  biomeAt(x: number, z: number) {
    const c = this.chunkAt(x, z);
    return c ? c.biome[(z & 15) * 16 + (x & 15)] : 2;
  }
  climateAt(x: number, z: number) {
    const c = this.chunkAt(x, z);
    return c ? { t: c.climate[((z & 15) * 16 + (x & 15)) * 2] / 255 * 2 - 1, h: c.climate[((z & 15) * 16 + (x & 15)) * 2 + 1] / 255 * 2 - 1 } : { t: 0, h: 0 };
  }
  lightAt(x: number, y: number, z: number): number {
    if (y >= CH) return 15;
    if (y < 0) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    return c ? c.light[(y * 16 + (z & 15)) * 16 + (x & 15)] : 0;
  }
  // true if there is no surface block above (x,y,z)
  skyExposed(x: number, y: number, z: number) {
    const h = this.heightAt(x, z);
    return h < 0 || y > h;
  }

  markDirty(c: Chunk, urgent = false) {
    c.dirty = true; c.version++;
    if (urgent) c.urgent = true;
    this.dirty.add(c);
  }

  setBlock(x: number, y: number, z: number, id: number, urgent = true): boolean {
    if (y < 0 || y >= CH) return false;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c || c.state < 2) return false;
    const lx = x & 15, lz = z & 15;
    const i = (y * 16 + lz) * 16 + lx;
    const old = c.blocks[i];
    if (old === id) return false;
    c.blocks[i] = id;
    c.modified = true;
    const hi = lz * 16 + lx;
    if (isSurface(id)) { if (y > c.hm[hi]) c.hm[hi] = y; }
    else if (y === c.hm[hi]) {
      let yy = y - 1;
      while (yy > 0 && !isSurface(c.blocks[(yy * 16 + lz) * 16 + lx])) yy--;
      c.hm[hi] = yy;
    }
    if (y + 2 > c.top) c.top = Math.min(CH - 2, y + 2);
    this.updateLight(x, y, z, id);
    this.markDirty(c, urgent);
    if (lx === 0) this.touchNb(c.cx - 1, c.cz);
    if (lx === 15) this.touchNb(c.cx + 1, c.cz);
    if (lz === 0) this.touchNb(c.cx, c.cz - 1);
    if (lz === 15) this.touchNb(c.cx, c.cz + 1);
    this.flush(urgent);
    return true;
  }
  private touchNb(cx: number, cz: number) { const n = this.getChunk(cx, cz); if (n) this.touched.add(n); }
  private flush(urgent: boolean) {
    for (const c of this.touched) this.markDirty(c, urgent);
    this.touched.clear();
  }

  // ---- lighting ----
  private lget(ch: number, x: number, y: number, z: number): number {
    if (y >= CH) return ch === 0 ? 15 : 0;
    if (y < 0) return 0;
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c || c.state < 2) return -1;
    const v = c.light[(y * 16 + (z & 15)) * 16 + (x & 15)];
    return ch === 0 ? v & 15 : v >> 4;
  }
  private lset(ch: number, x: number, y: number, z: number, val: number) {
    const c = this.chunks.get(ckey(x >> 4, z >> 4));
    if (!c) return;
    const i = (y * 16 + (z & 15)) * 16 + (x & 15);
    c.light[i] = ch === 0 ? (c.light[i] & 0xf0) | val : (c.light[i] & 0x0f) | (val << 4);
    this.touched.add(c);
    const lx = x & 15, lz = z & 15;
    if (lx === 0) this.touchNb(c.cx - 1, c.cz);
    else if (lx === 15) this.touchNb(c.cx + 1, c.cz);
    if (lz === 0) this.touchNb(c.cx, c.cz - 1);
    else if (lz === 15) this.touchNb(c.cx, c.cz + 1);
  }
  private flood(ch: number) {
    const q = this.q;
    let head = 0;
    while (head < q.length) {
      const x = q[head++], y = q[head++], z = q[head++];
      const l = this.lget(ch, x, y, z);
      if (l <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DXS[d], ny = y + DYS[d], nz = z + DZS[d];
        if (ny < 0 || ny >= CH) continue;
        const nc = this.chunks.get(ckey(nx >> 4, nz >> 4));
        if (!nc || nc.state < 2) continue;
        const ni = (ny * 16 + (nz & 15)) * 16 + (nx & 15);
        const op = T_OPACITY[nc.blocks[ni]];
        if (op >= 15) continue;
        let nl = l - (op > 1 ? op : 1);
        if (ch === 0 && d === 3 && l === 15 && op === 0) nl = 15;
        const cur = ch === 0 ? nc.light[ni] & 15 : nc.light[ni] >> 4;
        if (nl > cur) { this.lset(ch, nx, ny, nz, nl); q.push(nx, ny, nz); }
      }
    }
    q.length = 0;
  }
  private unflood(ch: number) {
    const rq = this.rq;
    let head = 0;
    while (head < rq.length) {
      const x = rq[head++], y = rq[head++], z = rq[head++], l = rq[head++];
      for (let d = 0; d < 6; d++) {
        const nx = x + DXS[d], ny = y + DYS[d], nz = z + DZS[d];
        if (ny < 0 || ny >= CH) continue;
        const nl = this.lget(ch, nx, ny, nz);
        if (nl <= 0) continue;
        if (nl < l || (ch === 0 && d === 3 && l === 15 && nl === 15)) {
          this.lset(ch, nx, ny, nz, 0);
          rq.push(nx, ny, nz, nl);
        } else this.q.push(nx, ny, nz);
      }
    }
    rq.length = 0;
  }
  private updateLight(x: number, y: number, z: number, newId: number) {
    for (let ch = 0; ch < 2; ch++) {
      const oldL = this.lget(ch, x, y, z);
      if (oldL > 0) { this.lset(ch, x, y, z, 0); this.rq.push(x, y, z, oldL); this.unflood(ch); }
      const op = T_OPACITY[newId];
      if (ch === 1 && T_LIGHT[newId] > 0) { this.lset(1, x, y, z, T_LIGHT[newId]); this.q.push(x, y, z); }
      if (op < 15) {
        let best = 0;
        for (let d = 0; d < 6; d++) {
          const nl = this.lget(ch, x + DXS[d], y + DYS[d], z + DZS[d]);
          if (nl <= 0) continue;
          let cand = nl - (op > 1 ? op : 1);
          if (ch === 0 && d === 2 && nl === 15 && op === 0) cand = 15;
          if (cand > best) best = cand;
        }
        if (best > this.lget(ch, x, y, z)) { this.lset(ch, x, y, z, best); this.q.push(x, y, z); }
      }
      this.flood(ch);
    }
  }

  initLight(c: Chunk) {
    c.state = 2;
    const { blocks, light } = c;
    const tops = new Int16Array(256);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      let l = 15, top = 0;
      for (let y = CH - 1; y >= 0; y--) {
        const i = (y * 16 + lz) * 16 + lx;
        const op = T_OPACITY[blocks[i]];
        if (op > 0 && top === 0) top = y;
        if (op >= 15) l = 0; else if (op > 0) l = Math.max(0, l - op);
        light[i] = l;
      }
      tops[lz * 16 + lx] = top;
    }
    const x0 = c.cx * 16, z0 = c.cz * 16;
    // block-light sources
    const q = this.q;
    for (let y = 0; y <= c.top; y++) for (let k = 0; k < 256; k++) {
      const i = y * 256 + k, em = T_LIGHT[blocks[i]];
      if (em > 0) { light[i] |= em << 4; q.push(x0 + (k & 15), y, z0 + (k >> 4)); }
    }
    const nbs: { nc: Chunk; dx: number; dz: number }[] = [];
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = this.getChunk(c.cx + dx, c.cz + dz);
      if (nc && nc.state === 2) nbs.push({ nc, dx, dz });
    }
    const border = (ch: number) => {
      for (const { nc, dx, dz } of nbs) {
        const ymax = Math.min(CH - 1, Math.max(c.top, nc.top) + 1);
        for (let t = 0; t < 16; t++) {
          const ax = dx === 1 ? 15 : dx === -1 ? 0 : t, az = dz === 1 ? 15 : dz === -1 ? 0 : t;
          const bx = dx === 1 ? 0 : dx === -1 ? 15 : t, bz = dz === 1 ? 0 : dz === -1 ? 15 : t;
          for (let y = 0; y <= ymax; y++) {
            const ai = (y * 16 + az) * 16 + ax, bi = (y * 16 + bz) * 16 + bx;
            const al = ch === 0 ? c.light[ai] & 15 : c.light[ai] >> 4, bl = ch === 0 ? nc.light[bi] & 15 : nc.light[bi] >> 4;
            if (al > 1 && bl < al - 1 && T_OPACITY[nc.blocks[bi]] < 15) q.push(x0 + ax, y, z0 + az);
            if (bl > 1 && al < bl - 1 && T_OPACITY[blocks[ai]] < 15) q.push(nc.cx * 16 + bx, y, nc.cz * 16 + bz);
          }
        }
      }
    };
    // block channel first (sources already queued), then sky
    border(1);
    this.flood(1);
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const ci = lz * 16 + lx;
      let lo = tops[ci], hi = tops[ci];
      if (lx > 0) { const t = tops[ci - 1]; if (t < lo) lo = t; if (t > hi) hi = t; }
      if (lx < 15) { const t = tops[ci + 1]; if (t < lo) lo = t; if (t > hi) hi = t; }
      if (lz > 0) { const t = tops[ci - 16]; if (t < lo) lo = t; if (t > hi) hi = t; }
      if (lz < 15) { const t = tops[ci + 16]; if (t < lo) lo = t; if (t > hi) hi = t; }
      if (lo === hi && lo === tops[ci]) { /* flat: still may need edge cells below water etc. */ }
      for (let y = lo; y <= hi; y++) {
        const i = (y * 16 + lz) * 16 + lx;
        const sky = light[i] & 15;
        if (sky <= 1) continue;
        let need = false;
        if (lx > 0 && T_OPACITY[blocks[i - 1]] < 15 && (light[i - 1] & 15) < sky - 1) need = true;
        else if (lx < 15 && T_OPACITY[blocks[i + 1]] < 15 && (light[i + 1] & 15) < sky - 1) need = true;
        else if (lz > 0 && T_OPACITY[blocks[i - 16]] < 15 && (light[i - 16] & 15) < sky - 1) need = true;
        else if (lz < 15 && T_OPACITY[blocks[i + 16]] < 15 && (light[i + 16] & 15) < sky - 1) need = true;
        if (need) q.push(x0 + lx, y, z0 + lz);
      }
    }
    border(0);
    this.flood(0);
    this.touched.delete(c);
    this.markDirty(c);
    for (const c2 of this.touched) this.markDirty(c2);
    this.touched.clear();
  }
}
