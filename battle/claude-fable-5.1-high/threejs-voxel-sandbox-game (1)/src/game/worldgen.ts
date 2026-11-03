// Procedural terrain: biomes, rivers, caves, ores, trees and flora.
import { SimplexNoise, hash2, hash3, smoothstep, lerp, clamp } from "./noise";
import { B } from "./blocks";

export const CHUNK = 16;
export const HEIGHT = 128;
export const SEA = 44;

export const enum Biome {
  OCEAN = 0,
  BEACH = 1,
  PLAINS = 2,
  FOREST = 3,
  BIRCH_FOREST = 4,
  DESERT = 5,
  TAIGA = 6,
  MOUNTAINS = 7,
  RIVER = 8,
  SNOWY_PEAKS = 9,
}
export const BIOME_NAMES = ["Ocean", "Beach", "Plains", "Forest", "Birch Forest", "Desert", "Taiga", "Mountains", "River", "Snowy Peaks"];

/** Grass/foliage tint multipliers per biome (r,g,b) */
export const BIOME_GRASS: [number, number, number][] = [
  [0.85, 1.0, 0.75], // ocean
  [0.95, 1.0, 0.7], // beach
  [1.0, 1.0, 1.0], // plains
  [0.85, 1.0, 0.8], // forest
  [0.9, 1.05, 0.75], // birch
  [1.2, 1.05, 0.55], // desert
  [0.8, 0.95, 0.95], // taiga
  [0.9, 0.95, 0.9], // mountains
  [0.9, 1.0, 0.85], // river
  [0.85, 0.95, 1.0], // snowy
];

export interface ColumnInfo {
  height: number;
  biome: Biome;
  temp: number;
  humid: number;
  river: number;
  mountain: number;
}

export class WorldGen {
  seed: number;
  private n: SimplexNoise;
  private cave1: SimplexNoise;
  private cave2: SimplexNoise;
  private cave3: SimplexNoise;
  private colCache = new Map<number, ColumnInfo>();

  constructor(seed: number) {
    this.seed = seed;
    this.n = new SimplexNoise(seed);
    this.cave1 = new SimplexNoise(seed ^ 0x51a3);
    this.cave2 = new SimplexNoise(seed ^ 0x9e37);
    this.cave3 = new SimplexNoise(seed ^ 0x2c1b);
  }

  column(x: number, z: number): ColumnInfo {
    const key = ((x + 1048576) << 21) ^ (z + 1048576);
    const cached = this.colCache.get(key);
    if (cached) return cached;
    if (this.colCache.size > 60000) this.colCache.clear();

    const n = this.n;
    const cont = n.fbm2(x * 0.0011, z * 0.0011, 4);
    const erosion = n.fbm2(x * 0.0035 + 500, z * 0.0035 + 500, 3);
    const flat = smoothstep(-0.3, 0.6, erosion);
    const detail = n.fbm2(x * 0.011 + 1000, z * 0.011 + 1000, 4) * 9 * (1 - flat * 0.75);
    const mMask = n.fbm2(x * 0.0022 + 2000, z * 0.0022 + 2000, 2);
    const mountain = smoothstep(0.2, 0.7, mMask) * smoothstep(-0.25, 0.1, cont);
    const peaks = n.ridged2(x * 0.007 + 3000, z * 0.007 + 3000, 3);

    let height = SEA + 4 + cont * 18 + detail;
    height += mountain * (peaks * 58 + 8);

    const rn = n.fbm2(x * 0.0028 + 4000, z * 0.0028 + 4000, 2);
    let river = 1 - smoothstep(0.0, 0.05, Math.abs(rn));
    river *= 1 - mountain;
    if (river > 0 && cont > -0.25) {
      const bed = SEA - 3 + (1 - river) * 2;
      height = Math.min(height, lerp(height, bed, Math.pow(river, 0.6)));
    }
    height = clamp(height, 6, HEIGHT - 6);

    let temp = n.fbm2(x * 0.0014 + 5000, z * 0.0014 + 5000, 2) - Math.max(0, height - 75) * 0.012;
    const humid = n.fbm2(x * 0.0017 + 6000, z * 0.0017 + 6000, 2);

    let biome: Biome;
    const ih = Math.floor(height);
    if (ih < SEA - 1) biome = river > 0.4 && cont > -0.25 ? Biome.RIVER : Biome.OCEAN;
    else if (ih <= SEA + 1) biome = temp > 0.3 && humid < 0 ? Biome.DESERT : Biome.BEACH;
    else if (mountain > 0.45 && ih > 82) biome = ih > 100 || temp < -0.2 ? Biome.SNOWY_PEAKS : Biome.MOUNTAINS;
    else if (temp > 0.3 && humid < -0.05) biome = Biome.DESERT;
    else if (temp < -0.32) biome = Biome.TAIGA;
    else if (humid > 0.22) biome = n.noise2D(x * 0.006 + 7000, z * 0.006 + 7000) > 0.35 ? Biome.BIRCH_FOREST : Biome.FOREST;
    else biome = Biome.PLAINS;

    const info: ColumnInfo = { height: ih, biome, temp, humid, river, mountain };
    this.colCache.set(key, info);
    return info;
  }

  /** Fills a chunk's block array. Index: (x*16 + z)*128 + y */
  generateChunk(cx: number, cz: number, blocks: Uint8Array, biomes: Uint8Array): void {
    const seed = this.seed;
    const bx = cx * CHUNK,
      bz = cz * CHUNK;
    for (let lx = 0; lx < CHUNK; lx++) {
      for (let lz = 0; lz < CHUNK; lz++) {
        const wx = bx + lx,
          wz = bz + lz;
        const col = this.column(wx, wz);
        biomes[lx * CHUNK + lz] = col.biome;
        const h = col.height;
        const base = (lx * CHUNK + lz) * HEIGHT;
        const biome = col.biome;

        // surface materials
        let top: number, filler: number, fillerDepth = 3;
        switch (biome) {
          case Biome.DESERT:
            top = B.SAND; filler = B.SAND; fillerDepth = 4; break;
          case Biome.BEACH:
            top = col.temp < -0.3 ? B.GRAVEL : B.SAND; filler = B.SAND; break;
          case Biome.TAIGA:
            top = B.SNOW_GRASS; filler = B.DIRT; break;
          case Biome.MOUNTAINS:
            top = h < 90 && col.mountain < 0.7 ? B.GRASS : B.STONE; filler = h < 90 ? B.DIRT : B.STONE; break;
          case Biome.SNOWY_PEAKS:
            top = B.SNOW; filler = B.STONE; fillerDepth = 1; break;
          case Biome.OCEAN:
          case Biome.RIVER: {
            const depth = SEA - h;
            top = depth > 7 ? (hash2(wx, wz, seed) < 0.3 ? B.CLAY : B.GRAVEL) : B.SAND;
            filler = depth > 7 ? B.GRAVEL : B.SAND;
            break;
          }
          default:
            top = B.GRASS; filler = B.DIRT;
        }

        const underwater = h < SEA;
        for (let y = 0; y <= Math.max(h, SEA); y++) {
          let id: number;
          if (y === 0 || (y === 1 && hash3(wx, y, wz, seed) < 0.5)) id = B.BEDROCK;
          else if (y > h) id = B.WATER;
          else if (y === h) id = top;
          else if (y > h - fillerDepth) id = filler;
          else {
            id = B.STONE;
            // ores & pockets (2x2x2 clusters)
            const cxo = wx >> 1, cyo = y >> 1, czo = wz >> 1;
            const r = hash3(cxo, cyo, czo, seed + 11);
            const shape = hash3(wx, y, wz, seed + 12) < 0.72;
            if (shape) {
              if (r < 0.014 && y < 110) id = B.COAL_ORE;
              else if (r < 0.023 && y < 62) id = B.IRON_ORE;
              else if (r < 0.0265 && y < 30) id = B.GOLD_ORE;
              else if (r < 0.0285 && y < 16) id = B.DIAMOND_ORE;
            }
            if (id === B.STONE) {
              const pr = hash3(wx >> 2, y >> 2, wz >> 2, seed + 13);
              if (pr < 0.02) id = B.DIRT;
              else if (pr < 0.035) id = B.GRAVEL;
              else if (pr < 0.04 && y < 40) id = B.SANDSTONE;
            }
          }
          // Desert sandstone layer under sand
          if (biome === Biome.DESERT && id === B.STONE && y > h - 8) id = B.SANDSTONE;

          // Caves
          if (id !== B.BEDROCK && id !== B.WATER && y > 2 && y < (underwater ? h - 5 : h + 1)) {
            const c1 = this.cave1.noise3D(wx * 0.021, y * 0.034, wz * 0.021);
            const c2 = this.cave2.noise3D(wx * 0.021, y * 0.034, wz * 0.021);
            const tunnel = c1 * c1 + c2 * c2 < 0.011 + Math.max(0, 25 - y) * 0.0003;
            let carve = tunnel;
            if (!carve && y < 52) {
              const c3 = this.cave3.noise3D(wx * 0.013, y * 0.019, wz * 0.013);
              carve = c3 > 0.56 + y * 0.002;
            }
            if (carve) id = y <= 9 ? B.LAVA : B.AIR;
          }
          blocks[base + y] = id;
        }
        // Frozen water surface
        if (underwater && col.temp < -0.4) blocks[base + SEA] = B.ICE;
      }
    }
    this.decorate(cx, cz, blocks);
  }

  private decorate(cx: number, cz: number, blocks: Uint8Array): void {
    const seed = this.seed;
    const bx = cx * CHUNK,
      bz = cz * CHUNK;
    const setLocal = (wx: number, y: number, wz: number, id: number, overwrite = false) => {
      const lx = wx - bx,
        lz = wz - bz;
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= HEIGHT) return;
      const i = (lx * CHUNK + lz) * HEIGHT + y;
      if (overwrite || blocks[i] === B.AIR) blocks[i] = id;
    };
    const getLocal = (wx: number, y: number, wz: number): number => {
      const lx = wx - bx,
        lz = wz - bz;
      if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || y < 0 || y >= HEIGHT) return -1;
      return blocks[(lx * CHUNK + lz) * HEIGHT + y];
    };

    for (let wx = bx - 3; wx < bx + CHUNK + 3; wx++) {
      for (let wz = bz - 3; wz < bz + CHUNK + 3; wz++) {
        const col = this.column(wx, wz);
        const h = col.height;
        if (h < SEA) continue;
        const inChunk = wx >= bx && wx < bx + CHUNK && wz >= bz && wz < bz + CHUNK;
        // Make sure the surface wasn't carved by a cave (only checkable inside chunk)
        if (inChunk) {
          const surf = getLocal(wx, h, wz);
          if (surf === B.AIR || surf === B.WATER || surf === B.LAVA) continue;
        }
        const r = hash2(wx, wz, seed + 77);
        const r2 = hash2(wx, wz, seed + 78);
        const biome = col.biome;
        let treeDensity = 0;
        let tree: "oak" | "birch" | "spruce" | null = null;
        switch (biome) {
          case Biome.FOREST: treeDensity = 0.055; tree = r2 < 0.12 ? "birch" : "oak"; break;
          case Biome.BIRCH_FOREST: treeDensity = 0.055; tree = r2 < 0.2 ? "oak" : "birch"; break;
          case Biome.PLAINS: treeDensity = 0.0035; tree = "oak"; break;
          case Biome.TAIGA: treeDensity = 0.045; tree = "spruce"; break;
          case Biome.MOUNTAINS: treeDensity = h < 90 ? 0.01 : 0; tree = "spruce"; break;
        }
        if (tree && r < treeDensity) {
          this.placeTree(tree, wx, h + 1, wz, hash2(wx, wz, seed + 79), setLocal);
          continue;
        }
        if (!inChunk) continue;
        // Flora (only in-chunk, single block)
        const y = h + 1;
        if (biome === Biome.DESERT) {
          if (r < 0.006) {
            const ch = 1 + Math.floor(r2 * 3);
            for (let i = 0; i < ch; i++) setLocal(wx, y + i, wz, B.CACTUS);
          } else if (r < 0.02) setLocal(wx, y, wz, B.DEAD_BUSH);
        } else if (biome === Biome.PLAINS || biome === Biome.FOREST || biome === Biome.BIRCH_FOREST) {
          if (r < 0.1 + (biome === Biome.PLAINS ? 0.08 : 0)) setLocal(wx, y, wz, B.TALL_GRASS);
          else if (r < 0.2 + 0.015) setLocal(wx, y, wz, r2 < 0.5 ? B.FLOWER_RED : B.FLOWER_YELLOW);
          else if (r < 0.219 && biome !== Biome.PLAINS) setLocal(wx, y, wz, B.MUSHROOM);
          else if (r < 0.2198 && biome === Biome.PLAINS) setLocal(wx, y, wz, B.PUMPKIN);
        } else if (biome === Biome.TAIGA) {
          if (r < 0.01) setLocal(wx, y, wz, B.MUSHROOM);
          else if (r < 0.04) setLocal(wx, y, wz, B.TALL_GRASS);
        }
      }
    }
  }

  private placeTree(
    kind: "oak" | "birch" | "spruce",
    x: number,
    y: number,
    z: number,
    r: number,
    set: (x: number, y: number, z: number, id: number, overwrite?: boolean) => void,
  ) {
    if (kind === "oak") {
      const h = 4 + Math.floor(r * 3);
      for (let i = 0; i < h; i++) set(x, y + i, z, B.LOG, true);
      for (let dy = h - 3; dy <= h; dy++) {
        const rad = dy >= h - 1 ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++)
          for (let dz = -rad; dz <= rad; dz++) {
            if (dx === 0 && dz === 0 && dy < h) continue;
            if (Math.abs(dx) === rad && Math.abs(dz) === rad && (rad === 1 || hash3(x + dx, y + dy, z + dz, 5) < 0.5)) continue;
            set(x + dx, y + dy, z + dz, B.LEAVES);
          }
      }
      set(x, y + h, z, B.LEAVES);
      set(x, y + h + 1, z, B.LEAVES);
      set(x + 1, y + h + 1, z, B.LEAVES);
      set(x - 1, y + h + 1, z, B.LEAVES);
      set(x, y + h + 1, z + 1, B.LEAVES);
      set(x, y + h + 1, z - 1, B.LEAVES);
    } else if (kind === "birch") {
      const h = 5 + Math.floor(r * 3);
      for (let i = 0; i < h; i++) set(x, y + i, z, B.BIRCH_LOG, true);
      for (let dy = h - 2; dy <= h + 1; dy++) {
        const rad = dy >= h ? 1 : 2;
        for (let dx = -rad; dx <= rad; dx++)
          for (let dz = -rad; dz <= rad; dz++) {
            if (dx === 0 && dz === 0 && dy < h) continue;
            if (Math.abs(dx) === rad && Math.abs(dz) === rad && (dy === h + 1 || hash3(x + dx, y + dy, z + dz, 6) < 0.6)) continue;
            set(x + dx, y + dy, z + dz, B.BIRCH_LEAVES);
          }
      }
    } else {
      const h = 7 + Math.floor(r * 4);
      for (let i = 0; i < h; i++) set(x, y + i, z, B.SPRUCE_LOG, true);
      let rad = 2;
      for (let dy = 2; dy <= h; dy++) {
        const layerRad = dy === h ? 0 : dy >= h - 2 ? 1 : rad;
        for (let dx = -layerRad; dx <= layerRad; dx++)
          for (let dz = -layerRad; dz <= layerRad; dz++) {
            if (dx === 0 && dz === 0 && dy < h) continue;
            if (Math.abs(dx) === layerRad && Math.abs(dz) === layerRad && layerRad > 1) continue;
            set(x + dx, y + dy, z + dz, B.SPRUCE_LEAVES);
          }
        rad = rad === 2 ? 1 : 2;
      }
      set(x, y + h, z, B.SPRUCE_LEAVES);
      set(x, y + h + 1, z, B.SPRUCE_LEAVES);
    }
  }

  /** Finds a reasonable spawn point near origin. */
  findSpawn(): { x: number; y: number; z: number } {
    for (let r = 0; r < 400; r += 8) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        const x = Math.round(Math.cos(a) * r),
          z = Math.round(Math.sin(a) * r);
        const c = this.column(x, z);
        if (c.height > SEA + 1 && c.biome !== Biome.MOUNTAINS && c.biome !== Biome.SNOWY_PEAKS && c.biome !== Biome.DESERT) {
          return { x: x + 0.5, y: c.height + 2, z: z + 0.5 };
        }
      }
    }
    return { x: 0.5, y: 80, z: 0.5 };
  }
}
