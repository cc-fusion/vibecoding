// Chunked voxel world: procedural generation, biomes, block access, modifications.
import { Simplex, hash2, hash3, smoothstep, clamp } from './noise.js';
import { B, BLOCKS } from './blocks.js';

export const CHUNK = 16;
export const HEIGHT = 96;
export const SEA = 42;

export const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, DESERT: 4, SNOWY: 5, MOUNTAIN: 6 };
export const BIOME_NAMES = ['Ocean', 'Beach', 'Plains', 'Forest', 'Desert', 'Snowy Tundra', 'Mountains'];

export const chunkKey = (cx, cz) => cx + ',' + cz;
export const blockIndex = (x, y, z) => (y * CHUNK + z) * CHUNK + x;

export class World {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.noise = new Simplex(this.seed);
    this.noiseB = new Simplex(this.seed ^ 0x9e3779b9);
    this.chunks = new Map();      // key -> { data, biomes, dirty, mesh, water, lights }
    this.mods = new Map();        // key -> Map(index -> id)   player edits, persisted
    this.listeners = new Set();   // block change listeners
  }

  // ---- terrain shape -------------------------------------------------
  heightAt(x, z) {
    const n = this.noise, nb = this.noiseB;
    const e = n.fbm2(x * 0.0045, z * 0.0045, 4);
    const m = nb.fbm2(x * 0.0013 + 53.7, z * 0.0013 + 53.7, 3);
    const ocean = smoothstep(-0.12, -0.55, m);
    let h = 46 + e * 9 + smoothstep(0.12, 0.7, m) * 40 * (0.55 + 0.45 * e) - ocean * 18;
    return clamp(Math.floor(h), 6, HEIGHT - 12);
  }

  climateAt(x, z) {
    const t = this.noiseB.fbm2(x * 0.0011 + 911, z * 0.0011 + 911, 2);
    const w = this.noise.fbm2(x * 0.0016 + 777, z * 0.0016 + 777, 2);
    return [t, w];
  }

  biomeAt(x, z, h = undefined) {
    if (h === undefined) h = this.heightAt(x, z);
    if (h < SEA - 1) return BIOME.OCEAN;
    if (h <= SEA + 1) return BIOME.BEACH;
    if (h > 74) return BIOME.MOUNTAIN;
    const [t, w] = this.climateAt(x, z);
    if (t < -0.32) return BIOME.SNOWY;
    if (t > 0.3 && w < 0.05) return BIOME.DESERT;
    if (w > 0.12) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  // ---- chunk generation ----------------------------------------------
  getChunk(cx, cz, generate = true) {
    const key = chunkKey(cx, cz);
    let c = this.chunks.get(key);
    if (!c && generate) {
      c = this.generateChunk(cx, cz);
      this.chunks.set(key, c);
    }
    return c;
  }

  generateChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    const biomes = new Uint8Array(CHUNK * CHUNK);
    const heights = new Int16Array(CHUNK * CHUNK);
    const x0 = cx * CHUNK, z0 = cz * CHUNK;
    const seed = this.seed;
    const n3 = this.noiseB;

    for (let z = 0; z < CHUNK; z++) {
      for (let x = 0; x < CHUNK; x++) {
        const wx = x0 + x, wz = z0 + z;
        const h = this.heightAt(wx, wz);
        const biome = this.biomeAt(wx, wz, h);
        heights[z * CHUNK + x] = h;
        biomes[z * CHUNK + x] = biome;

        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id = B.AIR;
          if (y === 0) id = B.BEDROCK;
          else if (y <= h) {
            const depth = h - y;
            if (biome === BIOME.OCEAN || biome === BIOME.BEACH) {
              id = depth < 3 ? B.SAND : B.STONE;
              if (biome === BIOME.OCEAN && depth === 0 && hash2(wx, wz, seed) < 0.25) id = B.GRAVEL;
            } else if (biome === BIOME.DESERT) {
              id = depth < 4 ? B.SAND : B.STONE;
            } else if (biome === BIOME.MOUNTAIN) {
              id = h > 80 && depth === 0 ? B.SNOW : (depth < 2 && h < 80 ? B.STONE : B.STONE);
            } else {
              if (depth === 0) id = biome === BIOME.SNOWY ? B.SNOW_GRASS : B.GRASS;
              else if (depth < 4) id = B.DIRT;
              else id = B.STONE;
            }
            // caves (skip near surface of ocean floor to avoid weird holes)
            if (id !== B.BEDROCK && y > 3 && depth >= 4) {
              const c1 = n3.noise3(wx * 0.062, y * 0.082, wz * 0.062);
              const c2 = n3.noise3(wx * 0.035 + 300, y * 0.05 + 300, wz * 0.035 + 300);
              if (c1 > 0.58 || (c1 > 0.32 && c2 > 0.45)) id = B.AIR;
            }
            // ores in stone
            if (id === B.STONE) {
              const r = hash3(wx, y, wz, seed);
              if (y < 14 && r < 0.0028) id = B.DIAMOND_ORE;
              else if (y < 26 && r < 0.0062) id = B.GOLD_ORE;
              else if (y < 46 && r < 0.014) id = B.IRON_ORE;
              else if (y < 64 && r < 0.026) id = B.COAL_ORE;
              else if (r > 0.988 && y < h - 6) id = B.GRAVEL;
            }
          } else if (y <= SEA && y > h) {
            id = B.WATER;
          }
          if (id !== B.AIR) data[blockIndex(x, y, z)] = id;
        }
      }
    }

    // Decoration: trees & cacti, with a margin so canopies cross chunk borders.
    const PAD = 3;
    for (let z = -PAD; z < CHUNK + PAD; z++) {
      for (let x = -PAD; x < CHUNK + PAD; x++) {
        const wx = x0 + x, wz = z0 + z;
        const inBounds = x >= 0 && x < CHUNK && z >= 0 && z < CHUNK;
        const h = inBounds ? heights[z * CHUNK + x] : this.heightAt(wx, wz);
        if (h <= SEA + 1) continue;
        const biome = inBounds ? biomes[z * CHUNK + x] : this.biomeAt(wx, wz, h);
        const r = hash2(wx, wz, seed ^ 0x51ab);
        if (biome === BIOME.DESERT) {
          if (r < 0.006) this.placeCactus(data, x, h + 1, z, 2 + Math.floor(hash2(wx, wz, seed ^ 7) * 2));
          continue;
        }
        if (biome === BIOME.MOUNTAIN || biome === BIOME.OCEAN || biome === BIOME.BEACH) continue;
        const density = biome === BIOME.FOREST ? 0.028 : biome === BIOME.SNOWY ? 0.012 : 0.0045;
        if (r < density) {
          const th = 4 + Math.floor(hash2(wx, wz, seed ^ 0x77) * 3);
          this.placeTree(data, x, h + 1, z, th, biome === BIOME.SNOWY);
        }
      }
    }

    // apply persisted modifications
    const mods = this.mods.get(chunkKey(cx, cz));
    if (mods) for (const [idx, id] of mods) data[idx] = id;

    return { cx, cz, data, biomes, heights, dirty: true, mesh: null, water: null, lights: [] };
  }

  placeTree(data, x, y, z, trunkH, snowy) {
    const set = (lx, ly, lz, id, overwrite = false) => {
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || ly < 1 || ly >= HEIGHT) return;
      const idx = blockIndex(lx, ly, lz);
      if (overwrite || data[idx] === B.AIR) data[idx] = id;
    };
    // canopy
    for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
      const rad = dy >= trunkH ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy >= trunkH || hash3(x + dx, dy, z + dz, this.seed) < 0.5)) continue;
          set(x + dx, y + dy, z + dz, B.LEAVES);
        }
      }
    }
    set(x, y + trunkH + 1, z, B.LEAVES);
    // trunk
    for (let dy = 0; dy < trunkH; dy++) set(x, y + dy, z, B.LOG, true);
    if (snowy) set(x, y + trunkH + 2, z, B.SNOW);
  }

  placeCactus(data, x, y, z, h) {
    if (x < 0 || x >= CHUNK || z < 0 || z >= CHUNK) return;
    for (let i = 0; i < h && y + i < HEIGHT; i++) data[blockIndex(x, y + i, z)] = B.CACTUS;
  }

  // ---- block access ----------------------------------------------------
  getBlock(wx, wy, wz) {
    if (wy < 0 || wy >= HEIGHT) return B.AIR;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const c = this.getChunk(cx, cz, false);
    if (!c) return B.AIR;
    return c.data[blockIndex(wx - cx * CHUNK, wy, wz - cz * CHUNK)];
  }

  getBlockLoaded(wx, wy, wz) { return this.getBlock(wx, wy, wz); }

  setBlock(wx, wy, wz, id, record = true) {
    if (wy < 1 || wy >= HEIGHT) return false;
    const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
    const c = this.getChunk(cx, cz, true);
    const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
    const idx = blockIndex(lx, wy, lz);
    if (c.data[idx] === id) return false;
    c.data[idx] = id;
    c.dirty = true;
    if (record) {
      const key = chunkKey(cx, cz);
      let m = this.mods.get(key);
      if (!m) { m = new Map(); this.mods.set(key, m); }
      m.set(idx, id);
    }
    // neighboring chunks need remesh when editing borders
    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === CHUNK - 1) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === CHUNK - 1) this.markDirty(cx, cz + 1);
    for (const fn of this.listeners) fn(wx, wy, wz, id);
    return true;
  }

  markDirty(cx, cz) {
    const c = this.chunks.get(chunkKey(cx, cz));
    if (c) c.dirty = true;
  }

  // Highest non-air, non-water block at column (for spawning)
  surfaceY(wx, wz) {
    for (let y = HEIGHT - 1; y > 0; y--) {
      const id = this.getBlock(wx, y, wz);
      if (id !== B.AIR && id !== B.WATER && id !== B.LEAVES) return y;
    }
    return SEA;
  }

  findSpawn() {
    for (let r = 0; r < 40; r++) {
      for (let a = 0; a < 8; a++) {
        const x = Math.round(Math.cos(a * Math.PI / 4) * r * 8);
        const z = Math.round(Math.sin(a * Math.PI / 4) * r * 8);
        const h = this.heightAt(x, z);
        const biome = this.biomeAt(x, z, h);
        if (h <= SEA + 1 || biome === BIOME.OCEAN || biome === BIOME.MOUNTAIN) continue;
        // verify a clear standing spot (avoid tree canopies & cacti)
        this.getChunk(Math.floor(x / CHUNK), Math.floor(z / CHUNK), true);
        const ground = this.getBlock(x, h, z);
        if (ground !== B.GRASS && ground !== B.SNOW_GRASS && ground !== B.SAND) continue;
        let clear = true;
        for (let dy = 1; dy <= 3 && clear; dy++) {
          if (this.getBlock(x, h + dy, z) !== B.AIR) clear = false;
        }
        // also keep immediate neighbors walkable
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (clear && this.getBlock(x + dx, h + 1, z + dz) !== B.AIR) clear = false;
        }
        if (clear) return { x: x + 0.5, y: h + 1.05, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: HEIGHT - 20, z: 0.5 };
  }

  serializeMods() {
    const out = {};
    for (const [key, m] of this.mods) {
      const arr = [];
      for (const [idx, id] of m) arr.push(idx, id);
      out[key] = arr;
    }
    return out;
  }

  loadMods(obj) {
    this.mods.clear();
    if (!obj) return;
    for (const key of Object.keys(obj)) {
      const arr = obj[key];
      const m = new Map();
      for (let i = 0; i < arr.length; i += 2) m.set(arr[i], arr[i + 1]);
      this.mods.set(key, m);
    }
  }
}