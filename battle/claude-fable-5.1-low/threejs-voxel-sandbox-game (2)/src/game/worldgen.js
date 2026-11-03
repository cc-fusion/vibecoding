import { SimplexNoise, hash2, hash3 } from './noise.js';
import { B } from './blocks.js';

export const CX = 16, CY = 128, CZ = 16;
export const SEA = 42;
export const idx = (x, y, z) => (x * CZ + z) * CY + y;

export const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, BIRCH: 4, DESERT: 5, TUNDRA: 6, MOUNTAINS: 7, TAIGA: 8, SAVANNA: 9 };
export const BIOME_NAMES = ['Ocean', 'Beach', 'Plains', 'Forest', 'Birch Forest', 'Desert', 'Snowy Tundra', 'Mountains', 'Taiga', 'Savanna'];

function spline(v, pts) {
  if (v <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) { const [a, ya] = pts[i - 1], [b, yb] = pts[i]; const t = (v - a) / (b - a); return ya + (yb - ya) * (t * t * (3 - 2 * t)); }
  }
  return pts[pts.length - 1][1];
}

export class WorldGen {
  constructor(seed) {
    this.seed = seed;
    this.cont = new SimplexNoise(seed + 1);
    this.detail = new SimplexNoise(seed + 2);
    this.temp = new SimplexNoise(seed + 3);
    this.humid = new SimplexNoise(seed + 4);
    this.cave1 = new SimplexNoise(seed + 5);
    this.cave2 = new SimplexNoise(seed + 6);
    this.cheese = new SimplexNoise(seed + 7);
    this.ridge = new SimplexNoise(seed + 8);
    this.colCache = new Map();
  }

  // Column info: height, biome, temperature, humidity
  column(x, z) {
    const key = x * 100003 + z;
    let c = this.colCache.get(key);
    if (c) return c;
    x += 1000.5; z += 777.25; // avoid the all-zero noise singularity at the origin
    const cont = this.cont.fbm2(x / 700, z / 700, 4);
    const ero = this.detail.fbm2(x / 160 + 100, z / 160, 3);
    const det = this.detail.fbm2(x / 45, z / 45, 4);
    const ridge = this.ridge.ridged2(x / 220, z / 220, 3);
    let h = spline(cont, [[-1, 18], [-0.45, 28], [-0.2, 38], [-0.08, 43], [0.1, 50], [0.4, 62], [0.7, 85], [1, 105]]);
    const flat = spline(ero, [[-1, 0.35], [0, 1], [1, 1.5]]);
    h += det * 9 * flat;
    if (cont > 0.3) h += (cont - 0.3) * 60 * Math.pow(ridge, 2) * flat; // ridged mountains
    const t = this.temp.fbm2(x / 500 + 31, z / 500 - 17, 2) * 0.5 + 0.5 - (Math.max(0, h - 70) / 120);
    const hu = this.humid.fbm2(x / 420 - 55, z / 420 + 9, 2) * 0.5 + 0.5;
    const height = Math.max(4, Math.min(CY - 2, Math.floor(h)));
    let biome;
    if (height < SEA - 1) biome = BIOME.OCEAN;
    else if (height <= SEA + 1) biome = t < 0.3 ? BIOME.TUNDRA : BIOME.BEACH;
    else if (height > 82) biome = BIOME.MOUNTAINS;
    else if (t < 0.3) biome = hu > 0.5 ? BIOME.TAIGA : BIOME.TUNDRA;
    else if (t > 0.68 && hu < 0.42) biome = BIOME.DESERT;
    else if (t > 0.62 && hu < 0.55) biome = BIOME.SAVANNA;
    else if (hu > 0.62) biome = t > 0.5 ? BIOME.FOREST : BIOME.BIRCH;
    else if (hu > 0.5 && t > 0.4) biome = BIOME.FOREST;
    else biome = BIOME.PLAINS;
    c = { height, biome, t, hu };
    if (this.colCache.size > 60000) this.colCache.clear();
    this.colCache.set(key, c);
    return c;
  }

  biomeName(x, z) { return BIOME_NAMES[this.column(Math.floor(x), Math.floor(z)).biome]; }

  caveNoise(x, y, z) {
    return [
      this.cave1.noise3D(x / 38 + 13.7, y / 22 + 5.3, z / 38 - 7.1),
      this.cave2.noise3D(x / 38 - 21.3, y / 22 + 2.9, z / 38 + 11.7),
      this.cheese.noise3D(x / 28 + 3.3, y / 18 + 1.1, z / 28 + 9.9),
    ];
  }
  // Exact (slow) cave test used outside chunk generation
  isCave(x, y, z, height) {
    if (y < 3) return false;
    if (y > height - 4 && height <= SEA + 2) return false;
    const [a, b, c] = this.caveNoise(x, y, z);
    return this.caveTest(a, b, c, y, height);
  }
  caveTest(a, b, c, y, height) {
    if (a * a + b * b < 0.012 + (y < 30 ? 0.006 : 0)) return true;
    if (y < height - 10 && c > 0.62) return true;
    return false;
  }
  // Coarse lattice (4x4x4) of cave noise for a chunk, trilinearly interpolated
  buildCaveField(ox, oz) {
    const S = 4, NX = CX / S + 1, NY = CY / S + 1;
    const field = new Float32Array(NX * NX * NY * 3);
    for (let i = 0; i < NX; i++) for (let k = 0; k < NX; k++) for (let j = 0; j < NY; j++) {
      const [a, b, c] = this.caveNoise(ox + i * S, j * S, oz + k * S);
      const o = ((i * NX + k) * NY + j) * 3; field[o] = a; field[o + 1] = b; field[o + 2] = c;
    }
    const out = [0, 0, 0];
    return (lx, y, lz) => {
      const fx = lx / S, fy = y / S, fz = lz / S;
      const i = fx | 0, j = fy | 0, k = fz | 0;
      const tx = fx - i, ty = fy - j, tz = fz - k;
      const base = (i * NX + k) * NY + j;
      const c000 = base * 3, c100 = (base + NX * NY) * 3, c010 = (base + 1) * 3, c001 = (base + NY) * 3;
      const c110 = (base + NX * NY + 1) * 3, c101 = (base + NX * NY + NY) * 3, c011 = (base + NY + 1) * 3, c111 = (base + NX * NY + NY + 1) * 3;
      for (let n = 0; n < 3; n++) {
        const x00 = field[c000 + n] + (field[c100 + n] - field[c000 + n]) * tx;
        const x10 = field[c010 + n] + (field[c110 + n] - field[c010 + n]) * tx;
        const x01 = field[c001 + n] + (field[c101 + n] - field[c001 + n]) * tx;
        const x11 = field[c011 + n] + (field[c111 + n] - field[c011 + n]) * tx;
        const y0 = x00 + (x10 - x00) * ty, y1 = x01 + (x11 - x01) * ty;
        out[n] = y0 + (y1 - y0) * tz;
      }
      return out;
    };
  }

  oreAt(x, y, z) {
    const h = hash3(x, y, z, this.seed);
    const v = hash3(x >> 1, y >> 1, z >> 1, this.seed + 99); // vein clustering
    if (y < 18 && v < 0.012 && h < 0.45) return B.DIAMOND_ORE;
    if (y < 34 && v < 0.02 && h < 0.5) return B.GOLD_ORE;
    if (y < 68 && v < 0.05 && h < 0.5) return B.IRON_ORE;
    if (y < 110 && v < 0.07 && h < 0.55) return B.COAL_ORE;
    if (y < 60 && v < 0.09 && h < 0.4) return B.GRAVEL;
    return B.STONE;
  }

  generateChunk(cx, cz) {
    const blocks = new Uint8Array(CX * CY * CZ);
    const ox = cx * CX, oz = cz * CZ;
    const cols = new Array(CX * CZ);
    const cave = this.buildCaveField(ox, oz);
    for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
      const wx = ox + x, wz = oz + z;
      const col = this.column(wx, wz); cols[x * CZ + z] = col;
      const { height, biome } = col;
      const base = idx(x, 0, z);
      let top, filler;
      switch (biome) {
        case BIOME.DESERT: top = B.SAND; filler = B.SAND; break;
        case BIOME.BEACH: top = B.SAND; filler = B.SAND; break;
        case BIOME.OCEAN: top = height < SEA - 6 ? (hash2(wx, wz, this.seed) < 0.3 ? B.GRAVEL : B.SAND) : B.SAND; filler = B.SAND; break;
        case BIOME.TUNDRA: top = height <= SEA + 1 ? B.SAND : B.SNOW_GRASS; filler = B.DIRT; break;
        case BIOME.TAIGA: top = B.SNOW_GRASS; filler = B.DIRT; break;
        case BIOME.MOUNTAINS: top = height > 95 ? B.SNOW : (height > 88 ? B.STONE : B.GRASS); filler = height > 88 ? B.STONE : B.DIRT; break;
        default: top = B.GRASS; filler = B.DIRT;
      }
      const dirtDepth = 3 + Math.floor(hash2(wx, wz, this.seed + 5) * 2);
      for (let y = 0; y <= Math.max(height, SEA); y++) {
        let b;
        if (y === 0 || (y < 3 && hash3(wx, y, wz, this.seed) < 0.4)) b = B.BEDROCK;
        else if (y > height) b = (y <= SEA) ? (biome === BIOME.TUNDRA && y === SEA ? B.ICE : B.WATER) : B.AIR;
        else if (y === height) b = top;
        else if (y > height - dirtDepth) b = filler === B.SAND && y < height - 2 ? B.SANDSTONE : filler;
        else b = this.oreAt(wx, y, wz);
        if (b !== B.AIR && b !== B.WATER && b !== B.ICE && b !== B.BEDROCK && y >= 3 && !(y > height - 4 && height <= SEA + 2)) {
          const n = cave(x, y, z);
          if (this.caveTest(n[0], n[1], n[2], y, height)) b = y < 11 ? B.LAVA : B.AIR;
        }
        blocks[base + y] = b;
      }
      // clay patches near water
      if (biome === BIOME.OCEAN && height > SEA - 5 && hash2(wx >> 2, wz >> 2, this.seed + 7) < 0.2) blocks[base + height] = B.CLAY;
    }
    // decorations (inside chunk only)
    for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
      const col = cols[x * CZ + z]; const { height, biome } = col; const wx = ox + x, wz = oz + z;
      if (height <= SEA || height >= CY - 2) continue;
      const base = idx(x, 0, z);
      if (blocks[base + height] === B.AIR || blocks[base + height + 1] !== B.AIR) continue;
      const r = hash2(wx, wz, this.seed + 11);
      const above = base + height + 1;
      if (biome === BIOME.PLAINS || biome === BIOME.FOREST || biome === BIOME.BIRCH || biome === BIOME.SAVANNA) {
        if (r < (biome === BIOME.PLAINS ? 0.18 : 0.1)) blocks[above] = B.TALL_GRASS;
        else if (r < 0.2) blocks[above] = hash2(wx, wz, 3) < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW;
        else if (r > 0.998 && biome === BIOME.PLAINS) blocks[above] = B.PUMPKIN;
      } else if (biome === BIOME.DESERT) {
        if (r < 0.012) { const h = 1 + Math.floor(hash2(wx, wz, 4) * 3); for (let i = 0; i < h && height + 1 + i < CY; i++) blocks[above + i] = B.CACTUS; }
        else if (r < 0.03) blocks[above] = B.DEAD_BUSH;
      } else if (biome === BIOME.TAIGA || biome === BIOME.TUNDRA) {
        if (r < 0.02) blocks[above] = B.MUSHROOM;
      }
    }
    // trees (may span chunk borders)
    for (let x = -3; x < CX + 3; x++) for (let z = -3; z < CZ + 3; z++) {
      const wx = ox + x, wz = oz + z;
      const col = this.column(wx, wz); const { height, biome } = col;
      if (height <= SEA + 1 || height > CY - 12) continue;
      const r = hash2(wx, wz, this.seed + 21);
      let density = 0, type = 'oak';
      switch (biome) {
        case BIOME.FOREST: density = 0.045; type = hash2(wx, wz, 9) < 0.15 ? 'birch' : 'oak'; break;
        case BIOME.BIRCH: density = 0.04; type = 'birch'; break;
        case BIOME.PLAINS: density = 0.003; type = 'oak'; break;
        case BIOME.SAVANNA: density = 0.006; type = 'acacia'; break;
        case BIOME.TAIGA: density = 0.04; type = 'spruce'; break;
        case BIOME.TUNDRA: density = 0.004; type = 'spruce'; break;
        case BIOME.MOUNTAINS: density = height < 88 ? 0.01 : 0; type = 'spruce'; break;
      }
      if (r >= density) continue;
      // avoid trees on cave openings / in water: check the surface block is a grass type (compute cheaply)
      if (this.isCave(wx, height, wz, height)) continue;
      this.placeTree(blocks, x, height + 1, z, type, hash2(wx, wz, this.seed + 33));
    }
    return blocks;
  }

  placeTree(blocks, x, y, z, type, r) {
    const set = (lx, ly, lz, b, force = false) => {
      if (lx < 0 || lx >= CX || lz < 0 || lz >= CZ || ly < 0 || ly >= CY) return;
      const i = idx(lx, ly, lz);
      if (force || blocks[i] === B.AIR || blocks[i] === B.TALL_GRASS || blocks[i] === B.FLOWER_RED || blocks[i] === B.FLOWER_YELLOW) blocks[i] = b;
    };
    if (type === 'oak' || type === 'birch' || type === 'acacia') {
      const h = (type === 'birch' ? 5 : 4) + Math.floor(r * 3);
      const log = type === 'birch' ? B.BIRCH_LOG : B.LOG, leaf = type === 'birch' ? B.BIRCH_LEAVES : B.LEAVES;
      for (let i = 0; i < h; i++) set(x, y + i, z, log, true);
      const top = y + h - 1;
      for (let dy = -2; dy <= 1; dy++) {
        const rad = dy <= -1 ? 2 : 1;
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === 1 || hash3(x + dx, top + dy, z + dz, 5) < 0.5)) continue;
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          set(x + dx, top + dy, z + dz, leaf);
        }
      }
      set(x, top + 1, z, leaf); set(x, top + 2, z, leaf);
    } else if (type === 'spruce') {
      const h = 7 + Math.floor(r * 4);
      for (let i = 0; i < h; i++) set(x, y + i, z, B.SPRUCE_LOG, true);
      for (let i = 2; i <= h; i++) {
        const layer = h - i; const rad = layer === 0 ? 0 : (layer % 2 === 0 ? 1 : Math.min(3, 1 + Math.floor(layer / 2)));
        for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
          if (Math.abs(dx) + Math.abs(dz) > rad + 1) continue;
          if (dx === 0 && dz === 0 && layer !== 0) continue;
          set(x + dx, y + i, z + dz, B.SPRUCE_LEAVES);
        }
      }
      set(x, y + h, z, B.SPRUCE_LEAVES);
    }
  }

  // Find a decent spawn location near origin
  findSpawn() {
    for (let r = 0; r < 400; r += 8) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const x = Math.floor(Math.cos(a) * r), z = Math.floor(Math.sin(a) * r);
        const c = this.column(x, z);
        if (c.height > SEA + 2 && c.biome !== BIOME.MOUNTAINS && c.biome !== BIOME.OCEAN) return { x: x + 0.5, y: c.height + 2, z: z + 0.5 };
      }
    }
    return { x: 0.5, y: 80, z: 0.5 };
  }
}
