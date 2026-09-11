// World: chunk storage, block access, edit tracking and flood-fill lighting.
import type * as THREE from "three";
import { B, BLOCKS } from "./blocks";
import { CHUNK, HEIGHT, CHUNK_VOLUME, WorldGen, SEA, bi, Biome } from "./worldgen";

export class Chunk {
  blocks: Uint8Array;
  light = new Uint8Array(CHUNK_VOLUME); // high nibble: sky, low nibble: block light
  biomes: Uint8Array;
  dirty = true;
  solidMesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  constructor(public cx: number, public cz: number, blocks: Uint8Array, biomes: Uint8Array) {
    this.blocks = blocks;
    this.biomes = biomes;
  }
}

export const chunkKey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);

const DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** blocks that let light through but dim it (leaves, water) */
const ATTEN = new Uint8Array(256);
ATTEN[B.OAK_LEAVES] = ATTEN[B.BIRCH_LEAVES] = ATTEN[B.SPRUCE_LEAVES] = ATTEN[B.WATER] = 1;

export class World {
  chunks = new Map<number, Chunk>();
  edits = new Map<number, Map<number, number>>();
  gen: WorldGen;
  dirty = new Set<number>();
  private lastChunk: Chunk | null = null;
  private queue: number[] = [];

  constructor(public seed: number) {
    this.gen = new WorldGen(seed);
  }

  getChunk(cx: number, cz: number): Chunk | undefined {
    const lc = this.lastChunk;
    if (lc && lc.cx === cx && lc.cz === cz) return lc;
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) this.lastChunk = c;
    return c;
  }
  hasChunk(cx: number, cz: number) {
    return this.chunks.has(chunkKey(cx, cz));
  }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0 || y >= HEIGHT) return B.AIR;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return B.AIR;
    return c.blocks[bi(x & 15, y, z & 15)];
  }

  /** Collision query. Ungenerated chunks and the void count as solid so the player can't fall out of the world. */
  isSolid(x: number, y: number, z: number): boolean {
    if (y < 0) return true;
    if (y >= HEIGHT) return false;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return true;
    return BLOCKS[c.blocks[bi(x & 15, y, z & 15)]].solid;
  }

  getLight(x: number, y: number, z: number): number {
    if (y >= HEIGHT) return 0xf0;
    if (y < 0) return 0;
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return 0;
    return c.light[bi(x & 15, y, z & 15)];
  }
  getSky(x: number, y: number, z: number) {
    return this.getLight(x, y, z) >> 4;
  }
  getBlockLight(x: number, y: number, z: number) {
    return this.getLight(x, y, z) & 15;
  }

  private setChannel(c: Chunk, lx: number, y: number, lz: number, sky: boolean, v: number) {
    const i = bi(lx, y, lz);
    const old = c.light[i];
    c.light[i] = sky ? (old & 0x0f) | (v << 4) : (old & 0xf0) | v;
    this.markDirty(c, lx, lz);
  }

  markDirty(c: Chunk, lx: number, lz: number) {
    c.dirty = true;
    this.dirty.add(chunkKey(c.cx, c.cz));
    if (lx === 0) this.dirty.add(chunkKey(c.cx - 1, c.cz));
    else if (lx === CHUNK - 1) this.dirty.add(chunkKey(c.cx + 1, c.cz));
    if (lz === 0) this.dirty.add(chunkKey(c.cx, c.cz - 1));
    else if (lz === CHUNK - 1) this.dirty.add(chunkKey(c.cx, c.cz + 1));
  }

  biomeAt(x: number, z: number): Biome {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return Biome.PLAINS;
    return c.biomes[(x & 15) * CHUNK + (z & 15)];
  }

  // ---------------- chunk lifecycle ----------------

  ensureChunk(cx: number, cz: number): Chunk {
    const existing = this.getChunk(cx, cz);
    if (existing) return existing;
    const { blocks, biomes } = this.gen.generate(cx, cz);
    const key = chunkKey(cx, cz);
    const ed = this.edits.get(key);
    if (ed) for (const [i, id] of ed) blocks[i] = id;
    const c = new Chunk(cx, cz, blocks, biomes);
    this.chunks.set(key, c);
    this.lastChunk = c;
    this.initLight(c);
    // neighbours need re-meshing since their border faces / lighting may change
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const n = this.getChunk(cx + dx, cz + dz);
        if (n) {
          n.dirty = true;
          this.dirty.add(chunkKey(n.cx, n.cz));
        }
      }
    return c;
  }

  unloadChunk(cx: number, cz: number): Chunk | undefined {
    const key = chunkKey(cx, cz);
    const c = this.chunks.get(key);
    if (!c) return;
    this.chunks.delete(key);
    this.dirty.delete(key);
    if (this.lastChunk === c) this.lastChunk = null;
    return c;
  }

  // ---------------- lighting ----------------

  private initLight(c: Chunk) {
    const blocks = c.blocks,
      light = c.light;
    const ox = c.cx * CHUNK,
      oz = c.cz * CHUNK;
    const q = this.queue;
    q.length = 0;
    const bq: number[] = [];
    // sunlight columns
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++) {
        let y = HEIGHT - 1;
        for (; y >= 0; y--) {
          const i = bi(x, y, z);
          const id = blocks[i];
          if (BLOCKS[id].opaque || ATTEN[id]) break;
          light[i] = 0xf0;
        }
        for (; y >= 0; y--) {
          const i = bi(x, y, z);
          const l = BLOCKS[blocks[i]].light;
          if (l > 0) {
            light[i] = l;
            bq.push(ox + x, y, oz + z);
          }
        }
      }
    // emitters in the sunlit part too
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++)
        for (let y = 0; y < HEIGHT; y++) {
          const i = bi(x, y, z);
          const l = BLOCKS[blocks[i]].light;
          if (l > 0 && (light[i] & 15) === 0) {
            light[i] = (light[i] & 0xf0) | l;
            bq.push(ox + x, y, oz + z);
          }
        }
    // seed sky propagation from sunlit cells bordering darker transparent cells
    for (let x = 0; x < CHUNK; x++)
      for (let z = 0; z < CHUNK; z++)
        for (let y = 0; y < HEIGHT; y++) {
          const i = bi(x, y, z);
          if ((light[i] >> 4) !== 15) continue;
          let edge = false;
          for (let d = 0; d < 6 && !edge; d++) {
            if (d === 2) continue;
            const nx = x + DIRS[d][0],
              ny = y + DIRS[d][1],
              nz = z + DIRS[d][2];
            if (ny < 0) continue;
            if (nx < 0 || nx >= CHUNK || nz < 0 || nz >= CHUNK) {
              const nb = this.getBlock(ox + nx, ny, oz + nz);
              if (this.hasChunk((ox + nx) >> 4, (oz + nz) >> 4) && !BLOCKS[nb].opaque && this.getSky(ox + nx, ny, oz + nz) < 14) edge = true;
            } else {
              const ni = bi(nx, ny, nz);
              if (!BLOCKS[blocks[ni]].opaque && (light[ni] >> 4) < 14) edge = true;
            }
          }
          if (edge) q.push(ox + x, y, oz + z);
        }
    // pull light in from neighbouring chunks' borders
    const pullFrom = (wx: number, wz: number) => {
      if (!this.hasChunk(wx >> 4, wz >> 4)) return;
      for (let y = 0; y < HEIGHT; y++) {
        const l = this.getLight(wx, y, wz);
        if (l >> 4 > 1) q.push(wx, y, wz);
        if ((l & 15) > 1) bq.push(wx, y, wz);
      }
    };
    for (let i = 0; i < CHUNK; i++) {
      pullFrom(ox - 1, oz + i);
      pullFrom(ox + CHUNK, oz + i);
      pullFrom(ox + i, oz - 1);
      pullFrom(ox + i, oz + CHUNK);
    }
    this.propagate(q, true);
    this.propagate(bq, false);
    c.dirty = true;
    this.dirty.add(chunkKey(c.cx, c.cz));
  }

  private propagate(q: number[], sky: boolean) {
    let head = 0;
    while (head < q.length) {
      const x = q[head++],
        y = q[head++],
        z = q[head++];
      const c = this.getChunk(x >> 4, z >> 4);
      if (!c) continue;
      const cur = c.light[bi(x & 15, y, z & 15)];
      const L = sky ? cur >> 4 : cur & 15;
      if (L <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const nx = x + DIRS[d][0],
          ny = y + DIRS[d][1],
          nz = z + DIRS[d][2];
        if (ny < 0 || ny >= HEIGHT) continue;
        const nc = this.getChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = bi(nx & 15, ny, nz & 15);
        const nid = nc.blocks[ni];
        if (BLOCKS[nid].opaque) continue;
        let nl = L - 1;
        if (sky && d === 3 && L === 15) nl = 15;
        if (ATTEN[nid]) nl = Math.min(nl, L - 2);
        const nv = nc.light[ni];
        const ncur = sky ? nv >> 4 : nv & 15;
        if (ncur < nl) {
          this.setChannel(nc, nx & 15, ny, nz & 15, sky, nl);
          q.push(nx, ny, nz);
        }
      }
    }
    q.length = 0;
  }

  private removeLight(x: number, y: number, z: number, sky: boolean) {
    const c = this.getChunk(x >> 4, z >> 4);
    if (!c) return;
    const v = c.light[bi(x & 15, y, z & 15)];
    const old = sky ? v >> 4 : v & 15;
    if (old === 0) return;
    this.setChannel(c, x & 15, y, z & 15, sky, 0);
    const rq: number[] = [x, y, z, old];
    const pq: number[] = [];
    let head = 0;
    while (head < rq.length) {
      const cx = rq[head++],
        cy = rq[head++],
        cz = rq[head++],
        L = rq[head++];
      for (let d = 0; d < 6; d++) {
        const nx = cx + DIRS[d][0],
          ny = cy + DIRS[d][1],
          nz = cz + DIRS[d][2];
        if (ny < 0 || ny >= HEIGHT) continue;
        const nc = this.getChunk(nx >> 4, nz >> 4);
        if (!nc) continue;
        const ni = bi(nx & 15, ny, nz & 15);
        const nv = nc.light[ni];
        const nl = sky ? nv >> 4 : nv & 15;
        if (nl === 0) continue;
        if (nl < L || (sky && d === 3 && L === 15 && nl === 15)) {
          this.setChannel(nc, nx & 15, ny, nz & 15, sky, 0);
          rq.push(nx, ny, nz, nl);
        } else if (nl >= L) {
          pq.push(nx, ny, nz);
        }
      }
    }
    this.propagate(pq, sky);
  }

  // ---------------- editing ----------------

  setBlock(x: number, y: number, z: number, id: number, record = true): boolean {
    if (y < 0 || y >= HEIGHT) return false;
    const cx = x >> 4,
      cz = z >> 4;
    const c = this.getChunk(cx, cz);
    if (!c) return false;
    const lx = x & 15,
      lz = z & 15;
    const i = bi(lx, y, lz);
    const oldId = c.blocks[i];
    if (oldId === id) return false;
    c.blocks[i] = id;
    if (record) {
      const key = chunkKey(cx, cz);
      let m = this.edits.get(key);
      if (!m) {
        m = new Map();
        this.edits.set(key, m);
      }
      m.set(i, id);
    }
    this.markDirty(c, lx, lz);

    const oldDef = BLOCKS[oldId],
      newDef = BLOCKS[id];
    if (oldDef.light > 0) this.removeLight(x, y, z, false);
    const moreBlocking = (newDef.opaque && !oldDef.opaque) || (!newDef.opaque && !oldDef.opaque && ATTEN[id] && !ATTEN[oldId]);
    const lessBlocking = (oldDef.opaque && !newDef.opaque) || (!oldDef.opaque && !newDef.opaque && ATTEN[oldId] && !ATTEN[id]);
    if (moreBlocking) {
      this.removeLight(x, y, z, true);
      this.removeLight(x, y, z, false);
    } else if (lessBlocking) {
      const q: number[] = [];
      for (const d of DIRS) q.push(x + d[0], y + d[1], z + d[2]);
      this.propagate(q.slice(), true);
      this.propagate(q, false);
    }
    if (newDef.light > 0) {
      this.setChannel(c, lx, y, lz, false, newDef.light);
      this.propagate([x, y, z], false);
    }
    return true;
  }

  // ---------------- queries ----------------

  highestSolid(x: number, z: number): number {
    for (let y = HEIGHT - 1; y >= 0; y--) {
      const b = this.getBlock(x, y, z);
      if (BLOCKS[b].solid) return y;
    }
    return 0;
  }

  /** Find a pleasant land spawn near the origin (deterministic per seed). */
  findSpawn(): [number, number] {
    for (let r = 0; r < 64; r++) {
      for (let a = 0; a < Math.max(1, r * 8); a++) {
        const ang = (a / Math.max(1, r * 8)) * Math.PI * 2;
        const x = Math.round(Math.cos(ang) * r * 8),
          z = Math.round(Math.sin(ang) * r * 8);
        const col = this.gen.column(x, z);
        if (col.h > SEA + 1 && col.biome !== Biome.OCEAN && col.biome !== Biome.MOUNTAINS && col.h < 90) return [x, z];
      }
    }
    return [0, 0];
  }

  // ---------------- persistence ----------------

  serializeEdits(): Record<string, number[]> {
    const out: Record<string, number[]> = {};
    for (const [key, m] of this.edits) {
      const arr: number[] = [];
      for (const [i, id] of m) arr.push(i, id);
      out[key] = arr;
    }
    return out;
  }
  loadEdits(data: Record<string, number[]>) {
    this.edits.clear();
    for (const k of Object.keys(data)) {
      const m = new Map<number, number>();
      const arr = data[k];
      if (!Array.isArray(arr)) continue;
      for (let i = 0; i + 1 < arr.length; i += 2) {
        const idx = arr[i], id = arr[i + 1];
        if (idx >= 0 && idx < CHUNK_VOLUME && BLOCKS[id]) m.set(idx, id);
      }
      if (m.size > 0) this.edits.set(Number(k), m);
    }
  }
}
