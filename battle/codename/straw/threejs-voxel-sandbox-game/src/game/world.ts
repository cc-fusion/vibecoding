// Voxel world: chunk storage, procedural generation (biomes, caves, ores,
// trees, ruins), baked lighting (sun + block light), water flow, gravity blocks.
import { B, blockDef, LIGHT_OPACITY, LIGHT_EMIT } from './blocks';
import { Noise2D, Noise3D, hash2, hash3, clamp, smoothstep } from './noise';
import type { Stack } from './items';

export const CHUNK = 16;
export const WORLD_H = 80;
export const SEA = 31;

export type Biome = 'ocean' | 'beach' | 'plains' | 'forest' | 'desert' | 'snow' | 'mountain';

export interface FurnaceTile { type: 'furnace'; input: Stack | null; fuel: Stack | null; output: Stack | null; burn: number; burnMax: number; cook: number }
export interface ChestTile { type: 'chest'; slots: (Stack | null)[] }
export type TileEnt = FurnaceTile | ChestTile;

export const idx = (lx: number, y: number, lz: number) => (y << 8) | (lz << 4) | lx;
export const chunkKey = (cx: number, cz: number) => ((cx + 2048) << 12) | (cz + 2048);
export const posKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export class Chunk {
  data = new Uint8Array(CHUNK * CHUNK * WORLD_H);
  meta = new Uint8Array(CHUNK * CHUNK * WORLD_H);
  light = new Uint8Array(CHUNK * CHUNK * WORLD_H); // packed: sun<<4 | block
  heightMap = new Int16Array(CHUNK * CHUNK); // topmost non-air y
  constructor(public cx: number, public cz: number) {}
}

export interface WorldHooks {
  onPopBlock?: (x: number, y: number, z: number, id: number) => void;
  onTileRemoved?: (x: number, y: number, z: number, tile: TileEnt) => void;
}

const DIRS6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const;

export class World {
  chunks = new Map<number, Chunk>();
  edits = new Map<number, Map<number, number>>(); // chunkKey -> localIdx -> blockId
  tiles = new Map<string, TileEnt>();
  dirtyChunks = new Set<number>(); // needs (re)mesh soon (geometry changed)
  lightDirtyChunks = new Set<number>(); // only lighting changed; remesh at low priority
  hooks: WorldHooks = {};

  private nContinent: Noise2D; private nHills: Noise2D; private nMount: Noise2D;
  private nTemp: Noise2D; private nHumid: Noise2D;
  private nCave: Noise3D; private nTunnel: Noise3D; private nPocket: Noise3D;
  private nOreA: Noise3D; private nOreB: Noise3D;

  private waterActive = new Set<string>();
  private falling = new Set<string>();
  private saplings = new Map<string, number>();
  private relightBox: [number, number, number, number, number, number] | null = null;
  private waterTimer = 0; private fallTimer = 0;

  constructor(public seed: number) {
    const s = seed;
    this.nContinent = new Noise2D(s ^ 0x1111);
    this.nHills = new Noise2D(s ^ 0x2222);
    this.nMount = new Noise2D(s ^ 0x3333);
    this.nTemp = new Noise2D(s ^ 0x4444);
    this.nHumid = new Noise2D(s ^ 0x5555);
    this.nCave = new Noise3D(s ^ 0x6666);
    this.nTunnel = new Noise3D(s ^ 0x7777);
    this.nPocket = new Noise3D(s ^ 0x8888);
    this.nOreA = new Noise3D(s ^ 0x9999);
    this.nOreB = new Noise3D(s ^ 0xaaaa);
  }

  // ---------------- pure terrain functions ----------------
  terrainHeight(x: number, z: number): number {
    const cont = this.nContinent.fbm(x * 0.0035, z * 0.0035, 3);
    const hills = this.nHills.fbm(x * 0.018, z * 0.018, 4);
    const mount = this.nMount.fbm(x * 0.006 + 500, z * 0.006 + 500, 3);
    const mAmt = Math.pow(smoothstep(0.18, 0.8, mount), 2) * 30 * (0.75 + 0.25 * hills);
    let h = 33 + cont * 10 + hills * 5 + mAmt;
    h -= smoothstep(0.25, 0.85, -cont) * 9; // ocean basins
    return clamp(Math.floor(h), 5, WORLD_H - 14);
  }

  biomeInfo(x: number, z: number): { h: number; temp: number; humid: number; biome: Biome } {
    const h = this.terrainHeight(x, z);
    let temp = this.nTemp.fbm(x * 0.0028 + 1000, z * 0.0028, 3) * 0.5 + 0.5;
    const humid = this.nHumid.fbm(x * 0.003 + 2000, z * 0.003, 3) * 0.5 + 0.5;
    temp -= Math.max(0, h - 48) * 0.014;
    temp = clamp(temp, 0, 1);
    let biome: Biome;
    if (h < SEA - 1) biome = 'ocean';
    else if (h <= SEA + 1) biome = temp < 0.32 ? 'snow' : 'beach';
    else if (temp < 0.3) biome = 'snow';
    else if (temp > 0.63 && humid < 0.5) biome = 'desert';
    else if (h > 54) biome = 'mountain';
    else if (humid > 0.54) biome = 'forest';
    else biome = 'plains';
    return { h, temp, humid, biome };
  }

  // ---------------- block access ----------------
  getChunk(cx: number, cz: number): Chunk | undefined { return this.chunks.get(chunkKey(cx, cz)); }
  hasChunk(cx: number, cz: number) { return this.chunks.has(chunkKey(cx, cz)); }

  getBlock(x: number, y: number, z: number): number {
    if (y < 0) return B.Bedrock;
    if (y >= WORLD_H) return B.Air;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    return c ? c.data[idx(x & 15, y, z & 15)] : B.Air;
  }
  getMeta(x: number, y: number, z: number): number {
    if (y < 0 || y >= WORLD_H) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    return c ? c.meta[idx(x & 15, y, z & 15)] : 0;
  }
  getLightPacked(x: number, y: number, z: number): number {
    if (y >= WORLD_H) return 15 << 4;
    if (y < 0) return 0;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    return c ? c.light[idx(x & 15, y, z & 15)] : (15 << 4);
  }
  /** height of topmost non-air block (from chunk if present, else terrain noise) */
  heightAt(x: number, z: number): number {
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (c) return c.heightMap[(z & 15) * 16 + (x & 15)];
    const h = this.terrainHeight(x, z);
    return h < SEA ? SEA : h;
  }
  /** solid test used by physics; unloaded chunks approximate from terrain height */
  isSolidPhys(x: number, y: number, z: number): boolean {
    if (y < 0) return true;
    if (y >= WORLD_H) return false;
    const c = this.chunks.get(chunkKey(x >> 4, z >> 4));
    if (!c) return y <= this.terrainHeight(x, z);
    return blockDef(c.data[idx(x & 15, y, z & 15)]).solid;
  }

  markDirty(x: number, z: number) {
    const cx = x >> 4, cz = z >> 4;
    this.dirtyChunks.add(chunkKey(cx, cz));
    const lx = x & 15, lz = z & 15;
    if (lx === 0) this.dirtyChunks.add(chunkKey(cx - 1, cz));
    if (lx === 15) this.dirtyChunks.add(chunkKey(cx + 1, cz));
    if (lz === 0) this.dirtyChunks.add(chunkKey(cx, cz - 1));
    if (lz === 15) this.dirtyChunks.add(chunkKey(cx, cz + 1));
  }

  private updateHeight(c: Chunk, lx: number, y: number, lz: number, id: number) {
    const hi = lz * 16 + lx;
    if (id !== B.Air) { if (y > c.heightMap[hi]) c.heightMap[hi] = y; }
    else if (y === c.heightMap[hi]) {
      let ny = y - 1;
      while (ny > 0 && c.data[idx(lx, ny, lz)] === B.Air) ny--;
      c.heightMap[hi] = ny;
    }
  }

  /** raw set: no light/support logic. Used by gen, water, falling (batched relight). */
  setBlockRaw(x: number, y: number, z: number, id: number, recordEdit = false, meta?: number) {
    if (y < 0 || y >= WORLD_H) return;
    const cx = x >> 4, cz = z >> 4;
    const c = this.chunks.get(chunkKey(cx, cz));
    if (!c) return;
    const li = idx(x & 15, y, z & 15);
    c.data[li] = id;
    c.meta[li] = meta ?? 0;
    this.updateHeight(c, x & 15, y, z & 15, id);
    this.markDirty(x, z);
    if (recordEdit) this.recordEdit(cx, cz, li, id);
    if (id === B.Sapling) this.saplings.set(posKey(x, y, z), 0);
    else this.saplings.delete(posKey(x, y, z));
  }

  private recordEdit(cx: number, cz: number, li: number, id: number) {
    const k = chunkKey(cx, cz);
    let m = this.edits.get(k);
    if (!m) { m = new Map(); this.edits.set(k, m); }
    m.set(li, id);
  }

  private supportsAt(x: number, y: number, z: number, kind: 'soil' | 'sand' | 'any'): boolean {
    const below = this.getBlock(x, y - 1, z);
    if (kind === 'any') return blockDef(below).solid;
    if (kind === 'soil') return below === B.Grass || below === B.Dirt || below === B.SnowyGrass;
    return below === B.Sand || below === B.Sandstone || below === B.Cactus;
  }

  /** gameplay set: lighting, support pops, gravity & water activation, persistence */
  setBlock(x: number, y: number, z: number, id: number, recordEdit = true) {
    if (y < 1 || y >= WORLD_H) return;
    const old = this.getBlock(x, y, z);
    if (old === id) return;
    // tile entity lifecycle
    const pk = posKey(x, y, z);
    if ((old === B.Chest || old === B.Furnace) && id !== old) {
      const t = this.tiles.get(pk);
      if (t) { this.hooks.onTileRemoved?.(x, y, z, t); this.tiles.delete(pk); }
    }
    this.setBlockRaw(x, y, z, id, recordEdit);
    if (id === B.Chest && !this.tiles.has(pk)) this.tiles.set(pk, { type: 'chest', slots: new Array(27).fill(null) });
    if (id === B.Furnace && !this.tiles.has(pk)) this.tiles.set(pk, { type: 'furnace', input: null, fuel: null, output: null, burn: 0, burnMax: 0, cook: 0 });

    // support pops above
    const above = this.getBlock(x, y + 1, z);
    const aDef = blockDef(above);
    if (aDef.support && !this.supportsAt(x, y + 1, z, aDef.support)) {
      this.hooks.onPopBlock?.(x, y + 1, z, above);
      this.setBlock(x, y + 1, z, B.Air, recordEdit);
    }
    // gravity scheduling
    if (blockDef(this.getBlock(x, y + 1, z)).gravity) this.falling.add(posKey(x, y + 1, z));
    if (blockDef(id).gravity) this.falling.add(pk);
    // water activation
    if (id === B.Water || old === B.Water) this.activateWaterAround(x, y, z);
    for (const [dx, dy, dz] of DIRS6) if (this.getBlock(x + dx, y + dy, z + dz) === B.Water) this.waterActive.add(posKey(x + dx, y + dy, z + dz));

    this.relightRegion(x - 15, y - 15, z - 15, x + 15, y + 15, z + 15, x, z);
  }

  private activateWaterAround(x: number, y: number, z: number) {
    this.waterActive.add(posKey(x, y, z));
    for (const [dx, dy, dz] of DIRS6) this.waterActive.add(posKey(x + dx, y + dy, z + dz));
  }

  queueRelight(x: number, y: number, z: number) {
    if (!this.relightBox) this.relightBox = [x, y, z, x, y, z];
    else {
      const b = this.relightBox;
      b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.min(b[2], z);
      b[3] = Math.max(b[3], x); b[4] = Math.max(b[4], y); b[5] = Math.max(b[5], z);
    }
  }

  // ---------------- lighting ----------------
  /**
   * Recompute sun + block light in a box: vertical sunlight pass (full height
   * for the footprint), then BFS flood fill inside the box seeded from border.
   */
  relightRegion(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, deepX = -100000, deepZ = -100000) {
    y0 = clamp(y0, 0, WORLD_H - 1); y1 = clamp(y1, 0, WORLD_H - 1);
    // fast local grid of chunk refs covering the box (+1 border for seeding)
    const gx0 = (x0 - 1) >> 4, gz0 = (z0 - 1) >> 4;
    const gw = ((x1 + 1) >> 4) - gx0 + 1, gh = ((z1 + 1) >> 4) - gz0 + 1;
    const grid: (Chunk | null)[] = new Array(gw * gh).fill(null);
    for (let gz = 0; gz < gh; gz++) for (let gx = 0; gx < gw; gx++)
      grid[gz * gw + gx] = this.chunks.get(chunkKey(gx0 + gx, gz0 + gz)) ?? null;
    const getC = (x: number, z: number): Chunk | null => grid[((z >> 4) - gz0) * gw + ((x >> 4) - gx0)] ?? null;
    const getB = (x: number, y: number, z: number) => {
      if (y < 0) return B.Bedrock; if (y >= WORLD_H) return B.Air;
      const c = getC(x, z); return c ? c.data[idx(x & 15, y, z & 15)] : B.Air;
    };
    const getL = (x: number, y: number, z: number) => {
      if (y >= WORLD_H) return 15 << 4; if (y < 0) return 0;
      const c = getC(x, z); return c ? c.light[idx(x & 15, y, z & 15)] : (15 << 4);
    };
    const setL = (x: number, y: number, z: number, v: number) => {
      if (y < 0 || y >= WORLD_H) return;
      const c = getC(x, z); if (c) c.light[idx(x & 15, y, z & 15)] = v;
    };

    // Vertical sunlight: the shaft value is computed exactly from the sky,
    // but light is only *written* inside the box Y range — plus a below-box
    // extension for live sun shafts and for the edited (deep) column so light
    // plunges/darkness falls correctly through newly opened/closed holes.
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const c = getC(x, z);
      if (!c) continue;
      const lx = x & 15, lz = z & 15;
      const isDeep = x === deepX && z === deepZ;
      let cur = 15, shaft = true;
      for (let y = WORLD_H - 1; y >= 0; y--) {
        const i = idx(lx, y, lz);
        const id = c.data[i];
        const op = LIGHT_OPACITY[id];
        let val: number;
        if (shaft && op === 0) val = 15;
        else { val = cur - Math.max(1, op); if (val < 0) val = 0; shaft = false; }
        cur = val;
        if (y > y1) continue; // above box: compute only
        if (y >= y0) {
          c.light[i] = (val << 4) | LIGHT_EMIT[id];
        } else if (shaft) {
          c.light[i] = (val << 4) | (c.light[i] & 15);
          if (op >= 15) break;
        } else if (isDeep) {
          c.light[i] = (val << 4) | (c.light[i] & 15);
          if (val === 0 && op >= 15) break;
        } else break;
      }
    }

    // Flood fill with a bucket priority queue (brightest cells first, like
    // Dijkstra): light settling through winding caves then relaxes each cell
    // roughly once instead of many times with a naive FIFO queue.
    // Seeding is gradient-based: only the bright endpoint of an edge whose
    // light differs by more than the attenuation can improve a neighbour.
    const buckets: Int32Array[] = [];
    const bHead = new Int32Array(16), bTail = new Int32Array(16);
    for (let i = 0; i < 16; i++) buckets.push(new Int32Array(2048));
    const push = (x: number, y: number, z: number, level: number) => {
      const lv = level < 0 ? 0 : level > 15 ? 15 : level;
      let b = buckets[lv];
      if (bTail[lv] + 3 > b.length) { const nb = new Int32Array(b.length * 2); nb.set(b); buckets[lv] = b = nb; }
      b[bTail[lv]++] = x; b[bTail[lv]++] = y; b[bTail[lv]++] = z;
    };
    // light from outside the box: ungenerated chunks contribute nothing
    // (treating them as sunlit would flood caves through chunk borders)
    const getLOut = (x: number, y: number, z: number) => {
      if (y >= WORLD_H) return 15 << 4; if (y < 0) return 0;
      const c = getC(x, z); return c ? c.light[idx(x & 15, y, z & 15)] : 0;
    };
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      if (!getC(x, z)) continue;
      const l = getL(x, y, z);
      let sun = l >> 4, blk = l & 15;
      const border = x === x0 || x === x1 || y === y0 || y === y1 || z === z0 || z === z1;
      if (border) {
        const att = Math.max(1, LIGHT_OPACITY[getB(x, y, z)]);
        for (const [dx, dy, dz] of DIRS6) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx >= x0 && nx <= x1 && ny >= y0 && ny <= y1 && nz >= z0 && nz <= z1) continue;
          const nl = getLOut(nx, ny, nz);
          const ns = (nl >> 4) - att, nb = (nl & 15) - att;
          if (ns > sun) sun = ns;
          if (nb > blk) blk = nb;
        }
        const nv = (sun << 4) | blk;
        if (nv !== l) setL(x, y, z, nv);
        if (sun > 1 || blk > 1) push(x, y, z, Math.max(sun, blk));
      } else {
        // interior: compare against 3 already-visited neighbours (every edge checked once)
        const myAtt = Math.max(1, LIGHT_OPACITY[getB(x, y, z)]);
        let seededMe = false;
        // -x, -y, -z neighbours
        for (let e = 0; e < 3; e++) {
          const nx = e === 0 ? x - 1 : x, ny = e === 1 ? y - 1 : y, nz = e === 2 ? z - 1 : z;
          const nl = getL(nx, ny, nz);
          const nSun = nl >> 4, nBlk = nl & 15;
          if (nSun === sun && nBlk === blk) continue;
          const nAtt = Math.max(1, LIGHT_OPACITY[getB(nx, ny, nz)]);
          if (!seededMe && (sun - nAtt > nSun || blk - nAtt > nBlk)) { push(x, y, z, Math.max(sun, blk)); seededMe = true; }
          if (nSun - myAtt > sun || nBlk - myAtt > blk) push(nx, ny, nz, Math.max(nSun, nBlk));
        }
      }
    }
    for (let level = 15; level >= 2; level--) {
      const b = buckets[level];
      while (bHead[level] < bTail[level]) {
        const x = b[bHead[level]++], y = b[bHead[level]++], z = b[bHead[level]++];
        const l = getL(x, y, z);
        const sun = l >> 4, blk = l & 15;
        const curMax = Math.max(sun, blk);
        if (curMax <= 1 || curMax > level) continue; // stale entry (a brighter copy exists)
        for (const [dx, dy, dz] of DIRS6) {
          const nx = x + dx, ny = y + dy, nz = z + dz;
          if (nx < x0 || nx > x1 || ny < y0 || ny > y1 || nz < z0 || nz > z1) continue;
          if (!getC(nx, nz)) continue;
          const att = Math.max(1, LIGHT_OPACITY[getB(nx, ny, nz)]);
          const nl = getL(nx, ny, nz);
          const ns = Math.max(nl >> 4, sun - att), nb = Math.max(nl & 15, blk - att);
          const nv = (ns << 4) | nb;
          if (nv !== nl) { setL(nx, ny, nz, nv); push(nx, ny, nz, Math.max(ns, nb)); }
        }
      }
    }
    // lighting changed in these chunks -> schedule low-priority remesh
    for (let cx = x0 >> 4; cx <= (x1 >> 4); cx++) for (let cz = z0 >> 4; cz <= (z1 >> 4); cz++) this.lightDirtyChunks.add(chunkKey(cx, cz));
  }

  // ---------------- generation ----------------
  generateChunk(cx: number, cz: number): Chunk {
    const existing = this.chunks.get(chunkKey(cx, cz));
    if (existing) return existing;
    const chunk = new Chunk(cx, cz);
    this.chunks.set(chunkKey(cx, cz), chunk);
    const { data, meta } = chunk;
    const baseX = cx * 16, baseZ = cz * 16;

    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = baseX + lx, z = baseZ + lz;
      const { h, temp, biome } = this.biomeInfo(x, z);
      const sandy = biome === 'desert' || biome === 'beach' || biome === 'ocean';
      const gravelFloor = this.nPocket.noise(x * 0.05, 0.5, z * 0.05) > 0.45;
      let top: number, sub: number;
      if (biome === 'ocean') { top = gravelFloor ? B.Gravel : B.Sand; sub = B.Sand; }
      else if (sandy) { top = B.Sand; sub = B.Sand; }
      else if (biome === 'snow') { top = B.SnowyGrass; sub = B.Dirt; }
      else if (biome === 'mountain') { top = h > 60 ? B.Snow : B.Stone; sub = B.Stone; }
      else { top = B.Grass; sub = B.Dirt; }

      for (let y = 0; y <= h; y++) {
        let id: number;
        if (y === 0 || (y === 1 && hash3(x, y, z, this.seed ^ 0xbed) < 0.6)) id = B.Bedrock;
        else if (y === h) id = top;
        else if (y > h - 4) id = sub;
        else if (biome === 'desert' && y > h - 7) id = B.Sandstone;
        else {
          id = B.Stone;
          const pk = this.nPocket.noise(x * 0.09, y * 0.09, z * 0.09);
          if (pk > 0.72) id = B.Gravel;
          else if (pk < -0.72) id = B.Dirt;
          else {
            // two noise fields, both lobes used -> four distinct ore types
            const oa = this.nOreA.noise(x * 0.14, y * 0.14, z * 0.14);
            if (y < 64 && oa > 0.78) id = B.CoalOre;
            else if (y < 42 && oa < -0.82) id = B.IronOre;
            else if (y < 22) {
              const ob = this.nOreB.noise(x * 0.17, y * 0.17, z * 0.17);
              if (ob > 0.84) id = B.GoldOre;
              else if (y < 15 && ob < -0.84) id = B.DiamondOre;
            }
          }
        }
        // caves
        if (y > 3 && y < h - 4 && id !== B.Bedrock) {
          const protectOcean = h < SEA && y > h - 7;
          if (!protectOcean) {
            const cv = this.nCave.fbm(x * 0.028, y * 0.05, z * 0.028, 2);
            const tn = 1 - Math.abs(this.nTunnel.noise(x * 0.016, y * 0.032, z * 0.016));
            if (cv > 0.47 || tn > 0.928) id = B.Air;
          }
        }
        data[idx(lx, y, lz)] = id;
      }
      // lava pools deep in caves
      for (let y = 2; y <= 9; y++) {
        const i = idx(lx, y, lz);
        if (data[i] === B.Air && data[idx(lx, y - 1, lz)] !== B.Air) {
          if (this.nCave.noise(x * 0.04, 3.3, z * 0.04) > 0.25) data[i] = B.Lava;
        }
      }
      // water
      if (h < SEA) {
        for (let y = h + 1; y <= SEA; y++) {
          if (data[idx(lx, y, lz)] === B.Air) {
            data[idx(lx, y, lz)] = (y === SEA && temp < 0.3) ? B.Ice : B.Water;
            meta[idx(lx, y, lz)] = 0;
          }
        }
      }
    }

    // decorations: writer stamps only cells inside this chunk
    const put = (x: number, y: number, z: number, id: number, onlyAir = false) => {
      if (y < 1 || y >= WORLD_H) return;
      const lx = x - baseX, lz = z - baseZ;
      if (lx < 0 || lx > 15 || lz < 0 || lz > 15) return;
      const i = idx(lx, y, lz);
      if (onlyAir && data[i] !== B.Air) return;
      data[i] = id;
    };
    const getLocal = (x: number, y: number, z: number) => this.getBlockWorldOrLocal(chunk, x, y, z);

    for (let oz = baseZ - 2; oz < baseZ + 18; oz++) for (let ox = baseX - 2; ox < baseX + 18; ox++) {
      const { h, biome } = this.biomeInfo(ox, oz);
      if (h <= SEA || h >= WORLD_H - 12) continue;
      const r = hash2(ox, oz, this.seed ^ 0x7ee5);
      const inChunk = ox >= baseX && ox < baseX + 16 && oz >= baseZ && oz < baseZ + 16;
      // trees
      let treeP = 0, treeKind: 'oak' | 'birch' | 'pine' = 'oak';
      if (biome === 'forest') { treeP = 0.011; treeKind = hash2(ox, oz, this.seed ^ 0xb1) < 0.3 ? 'birch' : 'oak'; }
      else if (biome === 'plains') { treeP = 0.0025; }
      else if (biome === 'snow') { treeP = 0.005; treeKind = 'pine'; }
      else if (biome === 'mountain') { treeP = 0.002; treeKind = 'pine'; }
      if (r < treeP) {
        if (getLocal(ox, h, oz) === B.Grass || getLocal(ox, h, oz) === B.SnowyGrass)
          this.stampTree(put, ox, h + 1, oz, treeKind, hash2(ox, oz, this.seed ^ 0x7a));
        continue;
      }
      if (!inChunk) continue;
      const topB = getLocal(ox, h, oz);
      if (biome === 'desert') {
        if (r < 0.006 && topB === B.Sand) { const n = 1 + ((hash2(ox, oz, this.seed ^ 0xca) * 3) | 0); for (let i = 1; i <= n; i++) put(ox, h + i, oz, B.Cactus, true); }
        else if (r < 0.014 && topB === B.Sand) put(ox, h + 1, oz, B.DeadBush, true);
      } else if (topB === B.Grass || topB === B.SnowyGrass) {
        if (r < 0.07) put(ox, h + 1, oz, B.TallGrass, true);
        else if (r < 0.082) put(ox, h + 1, oz, B.FlowerRed, true);
        else if (r < 0.094) put(ox, h + 1, oz, B.FlowerYellow, true);
        else if (r < 0.096 && biome === 'plains') put(ox, h + 1, oz, B.Pumpkin, true);
      }
    }
    this.stampRuins(chunk, put);

    // player edits override generation
    const editMap = this.edits.get(chunkKey(cx, cz));
    if (editMap) {
      for (const [li, id] of editMap) {
        data[li] = id; meta[li] = 0;
        if (id === B.Sapling) this.saplings.set(posKey(baseX + (li & 15), li >> 8, baseZ + ((li >> 4) & 15)), 0);
      }
    }
    // heightmap
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      let y = WORLD_H - 1;
      while (y > 0 && data[idx(lx, y, lz)] === B.Air) y--;
      chunk.heightMap[lz * 16 + lx] = y;
    }
    this.relightRegion(baseX, 0, baseZ, baseX + 15, WORLD_H - 1, baseZ + 15);
    this.dirtyChunks.add(chunkKey(cx, cz));
    return chunk;
  }

  private getBlockWorldOrLocal(chunk: Chunk, x: number, y: number, z: number): number {
    const lx = x - chunk.cx * 16, lz = z - chunk.cz * 16;
    if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && y >= 0 && y < WORLD_H) return chunk.data[idx(lx, y, lz)];
    return this.getBlock(x, y, z);
  }

  stampTree(put: (x: number, y: number, z: number, id: number, onlyAir?: boolean) => void, x: number, y: number, z: number, kind: 'oak' | 'birch' | 'pine', r: number) {
    if (kind === 'pine') {
      const trunkH = 6 + ((r * 3) | 0);
      for (let i = 0; i < trunkH; i++) put(x, y + i, z, B.PineLog);
      for (let i = 2; i < trunkH; i++) {
        const rad = i > trunkH - 3 ? 1 : 2;
        if ((i % 2) === 0 || i > trunkH - 3) {
          for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
            if (dx === 0 && dz === 0) continue;
            if (Math.abs(dx) === rad && Math.abs(dz) === rad) continue;
            put(x + dx, y + i, z + dz, B.PineLeaves, true);
          }
        }
      }
      put(x, y + trunkH, z, B.PineLeaves, true);
      return;
    }
    const logId = kind === 'birch' ? B.BirchLog : B.Log;
    const trunkH = kind === 'birch' ? 5 + ((r * 3) | 0) : 4 + ((r * 2) | 0);
    for (let i = 0; i < trunkH; i++) put(x, y + i, z, logId);
    const topY = y + trunkH - 1;
    for (let dy = -2; dy <= 1; dy++) {
      const rad = dy <= -1 ? 2 : 1;
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        if (dx === 0 && dz === 0 && dy <= 0) continue;
        if (Math.abs(dx) === rad && Math.abs(dz) === rad && hash3(x + dx, topY + dy, z + dz, this.seed) < 0.5) continue;
        put(x + dx, topY + dy, z + dz, B.Leaves, true);
      }
    }
    put(x, topY + 2, z, B.Leaves, true);
  }

  private stampRuins(chunk: Chunk, put: (x: number, y: number, z: number, id: number, onlyAir?: boolean) => void) {
    const CELL = 56;
    const baseX = chunk.cx * 16, baseZ = chunk.cz * 16;
    const c0x = Math.floor((baseX - 8) / CELL), c1x = Math.floor((baseX + 24) / CELL);
    const c0z = Math.floor((baseZ - 8) / CELL), c1z = Math.floor((baseZ + 24) / CELL);
    for (let ccx = c0x; ccx <= c1x; ccx++) for (let ccz = c0z; ccz <= c1z; ccz++) {
      if (hash2(ccx, ccz, this.seed ^ 0xfeed) > 0.16) continue;
      const ox = ccx * CELL + 8 + ((hash2(ccx, ccz, this.seed ^ 0xa) * 24) | 0);
      const oz = ccz * CELL + 8 + ((hash2(ccx, ccz, this.seed ^ 0xb) * 24) | 0);
      const { h, biome } = this.biomeInfo(ox, oz);
      if (h <= SEA + 1 || biome === 'ocean') continue;
      const wallMat = biome === 'desert' ? B.Sandstone : B.Cobble;
      const floorMat = biome === 'desert' ? B.Sandstone : B.StoneBricks;
      // floor follows terrain (use min height to avoid burial)
      let floorY = h;
      for (let dx = 0; dx < 6; dx++) for (let dz = 0; dz < 6; dz++) floorY = Math.min(floorY, this.terrainHeight(ox + dx, oz + dz));
      for (let dx = 0; dx < 6; dx++) for (let dz = 0; dz < 6; dz++) {
        put(ox + dx, floorY, oz + dz, hash3(ox + dx, floorY, oz + dz, this.seed) < 0.25 ? wallMat : floorMat);
        for (let y = floorY + 1; y <= floorY + 4; y++) put(ox + dx, y, oz + dz, B.Air);
        const perimeter = dx === 0 || dz === 0 || dx === 5 || dz === 5;
        if (perimeter && !(dx === 2 && dz === 0)) {
          const wh = 1 + ((hash3(ox + dx, 7, oz + dz, this.seed ^ 0x33) * 3) | 0);
          for (let i = 1; i <= wh; i++) put(ox + dx, floorY + i, oz + dz, wallMat);
        }
      }
      // chest with loot (only created by the chunk that contains it)
      const chestX = ox + 3, chestZ = oz + 3, chestY = floorY + 1;
      put(chestX, chestY, chestZ, B.Chest);
      if (chestX >= baseX && chestX < baseX + 16 && chestZ >= baseZ && chestZ < baseZ + 16) {
        const pk = posKey(chestX, chestY, chestZ);
        if (!this.tiles.has(pk) && !this.edits.get(chunkKey(chunk.cx, chunk.cz))?.has(idx(chestX & 15, chestY, chestZ & 15))) {
          const slots: (Stack | null)[] = new Array(27).fill(null);
          const lootR = hash2(ccx, ccz, this.seed ^ 0x1007);
          slots[4] = { id: 273, count: 1 + ((lootR * 3) | 0) };            // bread
          slots[12] = { id: 257, count: 2 + ((lootR * 5) | 0) };          // coal
          slots[13] = { id: B.Torch, count: 4 };
          if (lootR > 0.4) slots[14] = { id: 259, count: 1 + ((lootR * 3) | 0) }; // iron
          if (lootR > 0.75) slots[22] = { id: 260, count: 1 };            // gold
          if (lootR > 0.55) slots[5] = { id: 262, count: 2 };             // apples
          this.tiles.set(pk, { type: 'chest', slots });
        }
      }
    }
  }

  findSpawn(): { x: number; y: number; z: number } {
    // pass 1: friendly spawn — plains/forest with trees nearby
    // pass 2: any dry temperate spot
    for (let pass = 0; pass < 2; pass++) {
      for (let r = 0; r < 700; r += 6) {
        for (let a = 0; a < Math.max(1, r / 2); a++) {
          const ang = (a / Math.max(1, r / 2)) * Math.PI * 2;
          const x = Math.round(Math.cos(ang) * r), z = Math.round(Math.sin(ang) * r);
          const { h, biome } = this.biomeInfo(x, z);
          if (h <= SEA || h >= SEA + 14) continue;
          const okBiome = pass === 0
            ? (biome === 'plains' || biome === 'forest')
            : (biome !== 'desert' && biome !== 'ocean' && biome !== 'snow');
          if (okBiome) return { x: x + 0.5, y: h + 1.01, z: z + 0.5 };
        }
      }
    }
    const h = this.terrainHeight(8, 8);
    return { x: 8.5, y: Math.max(h, SEA) + 1.01, z: 8.5 };
  }

  // ---------------- tick: water, falling, saplings ----------------
  tick(dt: number) {
    this.waterTimer += dt;
    this.fallTimer += dt;
    if (this.waterTimer > 0.16) { this.waterTimer = 0; this.tickWater(); }
    if (this.fallTimer > 0.07) { this.fallTimer = 0; this.tickFalling(); }
    // saplings
    if (this.saplings.size) {
      const grown: string[] = [];
      for (const [k, t] of this.saplings) {
        const nt = t + dt;
        this.saplings.set(k, nt);
        const [x, y, z] = k.split(',').map(Number);
        if (this.getBlock(x, y, z) !== B.Sapling) { grown.push(k); continue; }
        if (nt > 25 + (hash2(x, z, this.seed) * 40)) {
          let clear = true;
          for (let i = 1; i < 6 && clear; i++) if (this.getBlock(x, y + i, z) !== B.Air) clear = false;
          if (clear) {
            this.setBlockRaw(x, y, z, B.Air, true);
            this.stampTree((px, py, pz, id, onlyAir) => {
              if (onlyAir && this.getBlock(px, py, pz) !== B.Air) return;
              this.setBlockRaw(px, py, pz, id, true);
            }, x, y, z, 'oak', hash2(x, z, this.seed ^ 0x9));
            this.queueRelight(x, y, z);
          }
          grown.push(k);
        }
      }
      for (const k of grown) this.saplings.delete(k);
    }
    if (this.relightBox) {
      const [x0, y0, z0, x1, y1, z1] = this.relightBox;
      this.relightBox = null;
      this.relightRegion(x0 - 15, y0 - 15, z0 - 15, x1 + 15, y1 + 15, z1 + 15);
    }
  }

  private tickWater() {
    if (!this.waterActive.size) return;
    const cells = [...this.waterActive];
    this.waterActive.clear();
    let budget = 1200;
    let changed = false;
    for (const k of cells) {
      if (budget-- <= 0) { this.waterActive.add(k); continue; }
      const [x, y, z] = k.split(',').map(Number);
      if (this.getBlock(x, y, z) !== B.Water) continue;
      const level = this.getMeta(x, y, z);
      // dry up thin water whose source vanished
      if (level > 0) {
        let supported = this.getBlock(x, y + 1, z) === B.Water;
        if (!supported) {
          for (const [dx, , dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
            if (this.getBlock(x + dx, y, z + dz) === B.Water && this.getMeta(x + dx, y, z + dz) < level) { supported = true; break; }
          }
        }
        if (!supported) {
          this.setBlockRaw(x, y, z, B.Air, false);
          this.activateWaterAround(x, y, z);
          this.queueRelight(x, y, z);
          changed = true;
          continue;
        }
      }
      const below = this.getBlock(x, y - 1, z);
      if (below === B.Air || below === B.TallGrass) {
        this.setBlockRaw(x, y - 1, z, B.Water, false, level);
        this.waterActive.add(posKey(x, y - 1, z));
        this.waterActive.add(k);
        this.queueRelight(x, y - 1, z);
        changed = true;
        continue;
      }
      if (level < 7 && (blockDef(below).solid || below === B.Water)) {
        for (const [dx, , dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]]) {
          const n = this.getBlock(x + dx, y, z + dz);
          if (n === B.Air || n === B.TallGrass) {
            this.setBlockRaw(x + dx, y, z + dz, B.Water, false, level + 1);
            this.waterActive.add(posKey(x + dx, y, z + dz));
            this.queueRelight(x + dx, y, z + dz);
            changed = true;
          } else if (n === B.Water && this.getMeta(x + dx, y, z + dz) > level + 1) {
            this.setBlockRaw(x + dx, y, z + dz, B.Water, false, level + 1);
            this.waterActive.add(posKey(x + dx, y, z + dz));
            changed = true;
          }
        }
      }
    }
    void changed;
  }

  private tickFalling() {
    if (!this.falling.size) return;
    const cells = [...this.falling].map(k => k.split(',').map(Number)).sort((a, b) => a[1] - b[1]);
    this.falling.clear();
    for (const [x, y, z] of cells) {
      const id = this.getBlock(x, y, z);
      if (!blockDef(id).gravity) continue;
      const below = this.getBlock(x, y - 1, z);
      const bDef = blockDef(below);
      if (below === B.Air || below === B.Water || below === B.Lava || !bDef.solid) {
        if (below !== B.Air && below !== B.Water && below !== B.Lava) {
          this.hooks.onPopBlock?.(x, y - 1, z, below); // crush plant/torch
        }
        this.setBlockRaw(x, y, z, B.Air, true);
        this.setBlockRaw(x, y - 1, z, id, true);
        this.falling.add(posKey(x, y - 1, z));
        if (blockDef(this.getBlock(x, y + 1, z)).gravity) this.falling.add(posKey(x, y + 1, z));
        this.queueRelight(x, y, z);
        this.activateWaterAround(x, y, z);
      }
    }
  }
}
