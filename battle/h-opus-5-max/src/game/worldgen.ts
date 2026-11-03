// ───────────────────────────────────────────────────────────────────────────
//  Procedural terrain: climate driven biomes, caves, ores, decorations
// ───────────────────────────────────────────────────────────────────────────
import { B } from "./blocks";
import { CHUNK_X, CHUNK_Z, SEA_LEVEL, WORLD_HEIGHT, idx, clamp } from "./constants";
import { Fbm, Simplex, hash2, hash3, makeRng } from "./noise";

export const enum Biome {
  OCEAN = 0,
  BEACH,
  PLAINS,
  FOREST,
  BIRCH_FOREST,
  TAIGA,
  SNOWY_PLAINS,
  DESERT,
  SAVANNA,
  MOUNTAINS,
  SWAMP,
  JUNGLE,
  COUNT,
}

export const BIOME_NAMES = [
  "Ocean",
  "Beach",
  "Plains",
  "Forest",
  "Birch Forest",
  "Taiga",
  "Snowy Plains",
  "Desert",
  "Savanna",
  "Mountains",
  "Swamp",
  "Jungle",
];

/** grass + foliage tint per biome (multiplied in shader) */
export const BIOME_TINT: number[][] = [
  [0.55, 0.78, 0.55],
  [0.8, 0.85, 0.6],
  [0.78, 1.0, 0.52],
  [0.62, 0.95, 0.46],
  [0.76, 1.0, 0.58],
  [0.52, 0.82, 0.6],
  [0.68, 0.86, 0.78],
  [0.86, 0.82, 0.38],
  [0.9, 0.88, 0.4],
  [0.66, 0.88, 0.6],
  [0.42, 0.72, 0.4],
  [0.42, 1.0, 0.36],
];

export interface PlaceFn {
  (x: number, y: number, z: number, id: number, replace?: boolean): void;
}

export class WorldGen {
  private cont: Fbm;
  private hills: Fbm;
  private ridge: Simplex;
  private temp: Fbm;
  private humid: Fbm;
  private mtn: Fbm;
  private cave1: Simplex;
  private cave2: Simplex;
  private cave3: Simplex;
  private oreN: Simplex[];
  private beachN: Simplex;

  constructor(public seed: number) {
    this.cont = new Fbm(seed + 1, 4, 2, 0.5);
    this.hills = new Fbm(seed + 2, 4, 2, 0.5);
    this.ridge = new Simplex(seed + 3);
    this.temp = new Fbm(seed + 4, 3, 2, 0.5);
    this.humid = new Fbm(seed + 5, 3, 2, 0.5);
    this.mtn = new Fbm(seed + 6, 3, 2, 0.5);
    this.cave1 = new Simplex(seed + 7);
    this.cave2 = new Simplex(seed + 8);
    this.cave3 = new Simplex(seed + 9);
    this.beachN = new Simplex(seed + 11);
    this.oreN = [];
    for (let i = 0; i < 8; i++) this.oreN.push(new Simplex(seed + 100 + i * 13));
  }

  // ── climate ──────────────────────────────────────────────────────────────
  temperatureAt(x: number, z: number) {
    return this.temp.get2(x, z, 0.0011);
  }
  humidityAt(x: number, z: number) {
    return this.humid.get2(x + 4000, z - 2300, 0.0013);
  }

  heightAt(x: number, z: number): number {
    const c = this.cont.get2(x, z, 0.0012);
    let h = SEA_LEVEL + 3 + c * 30;
    const hillAmp = clamp((c + 0.25) * 2.2, 0, 1);
    h += this.hills.get2(x, z, 0.0062) * 9 * hillAmp;
    // ridged mountains
    const m = this.mtn.get2(x + 1000, z + 1000, 0.0016);
    const mask = clamp((m - 0.18) * 3.1, 0, 1) * clamp((c - 0.02) * 3, 0, 1);
    if (mask > 0) {
      const r = 1 - Math.abs(this.ridge.noise2D(x * 0.0035, z * 0.0035));
      h += r * r * 56 * mask;
      h += (1 - Math.abs(this.ridge.noise2D(x * 0.011, z * 0.011))) * 7 * mask;
    }
    // flatten shallow sea floor a bit
    if (h < SEA_LEVEL) h = SEA_LEVEL - (SEA_LEVEL - h) * 0.82;
    return h;
  }

  biomeAt(x: number, z: number, height: number): Biome {
    const t = this.temperatureAt(x, z);
    const hm = this.humidityAt(x, z);
    if (height < SEA_LEVEL - 2) return Biome.OCEAN;
    if (height <= SEA_LEVEL + 1.6) {
      return t < -0.45 ? Biome.SNOWY_PLAINS : Biome.BEACH;
    }
    if (height > SEA_LEVEL + 44) return Biome.MOUNTAINS;
    if (t < -0.38) return hm > 0.05 ? Biome.TAIGA : Biome.SNOWY_PLAINS;
    if (t > 0.36) {
      if (hm < -0.22) return Biome.DESERT;
      if (hm < 0.18) return Biome.SAVANNA;
      return Biome.JUNGLE;
    }
    if (hm > 0.34 && height < SEA_LEVEL + 5) return Biome.SWAMP;
    if (hm > 0.26) return Biome.FOREST;
    if (hm > 0.1) return Biome.BIRCH_FOREST;
    return Biome.PLAINS;
  }

  private caveAt(x: number, y: number, z: number): boolean {
    if (y < 2 || y > WORLD_HEIGHT - 12) return false;
    const sx = x * 0.0125,
      sy = y * 0.021,
      sz = z * 0.0125;
    const a = this.cave1.noise3D(sx, sy, sz);
    const b = this.cave2.noise3D(sx + 51.3, sy + 17.1, sz - 29.7);
    if (a * a + b * b < 0.0055) return true;
    if (y < 36) {
      const c = this.cave3.noise3D(x * 0.0235, y * 0.033, z * 0.0235);
      if (c > 0.565 - ((36 - y) / 36) * 0.09) return true;
    }
    return false;
  }

  private static ORE_TYPES = [
    { id: B.COAL_ORE, tries: 26, size: 11, minY: 6, maxY: 94 },
    { id: B.IRON_ORE, tries: 20, size: 8, minY: 2, maxY: 64 },
    { id: B.GRAVEL, tries: 7, size: 16, minY: 4, maxY: 72 },
    { id: B.LAPIS_ORE, tries: 4, size: 6, minY: 2, maxY: 36 },
    { id: B.GOLD_ORE, tries: 4, size: 6, minY: 2, maxY: 33 },
    { id: B.REDSTONE_ORE, tries: 7, size: 8, minY: 2, maxY: 19 },
    { id: B.DIAMOND_ORE, tries: 3, size: 5, minY: 2, maxY: 16 },
    { id: B.EMERALD_ORE, tries: 3, size: 2, minY: 4, maxY: 32 },
  ];

  /** scatter ore blobs through the stone of a chunk (cheap, MC-like veins) */
  private placeOres(cx: number, cz: number, blocks: Uint8Array) {
    const rng = makeRng(((cx * 341873) ^ (cz * 132897) ^ (this.seed + 7717)) >>> 0);
    for (const t of WorldGen.ORE_TYPES) {
      for (let i = 0; i < t.tries; i++) {
        if (rng() > 0.78) continue;
        let x = rng() * 16;
        let z = rng() * 16;
        let y = t.minY + rng() * (t.maxY - t.minY);
        const n = 2 + ((rng() * t.size) | 0);
        for (let k = 0; k < n; k++) {
          const bx = x | 0,
            by = y | 0,
            bz = z | 0;
          if (bx >= 0 && bx < 16 && bz >= 0 && bz < 16 && by > 1 && by < WORLD_HEIGHT) {
            const j = idx(bx, by, bz);
            if (blocks[j] === B.STONE) blocks[j] = t.id;
          }
          x += rng() * 2.2 - 1.1;
          y += rng() * 1.5 - 0.75;
          z += rng() * 2.2 - 1.1;
        }
      }
    }
  }

  /** fill raw terrain for a chunk */
  generateChunk(cx: number, cz: number, blocks: Uint8Array, biomes: Uint8Array, heightmap: Int16Array) {
    this.generateColumns(cx, cz, blocks, biomes, heightmap);
    this.placeOres(cx, cz, blocks);
  }

  private generateColumns(
    cx: number,
    cz: number,
    blocks: Uint8Array,
    biomes: Uint8Array,
    heightmap: Int16Array,
  ) {
    const ox = cx * CHUNK_X;
    const oz = cz * CHUNK_Z;
    for (let lz = 0; lz < CHUNK_Z; lz++) {
      for (let lx = 0; lx < CHUNK_X; lx++) {
        const wx = ox + lx;
        const wz = oz + lz;
        const hf = this.heightAt(wx, wz);
        const h = Math.floor(hf);
        const biome = this.biomeAt(wx, wz, hf);
        biomes[lz * CHUNK_X + lx] = biome;
        heightmap[lz * CHUNK_X + lx] = h;

        const beachNoise = this.beachN.noise2D(wx * 0.05, wz * 0.05) * 1.6;
        const nearSea = h <= SEA_LEVEL + 2 + beachNoise && h >= SEA_LEVEL - 4;

        let topBlock = B.GRASS;
        let fillBlock = B.DIRT;
        let fillDepth = 3 + ((hash2(wx, wz, 5) * 2) | 0);
        switch (biome) {
          case Biome.DESERT:
            topBlock = B.SAND;
            fillBlock = B.SAND;
            fillDepth = 4;
            break;
          case Biome.BEACH:
          case Biome.OCEAN:
            topBlock = B.SAND;
            fillBlock = B.SAND;
            break;
          case Biome.SNOWY_PLAINS:
            topBlock = B.SNOW;
            break;
          case Biome.TAIGA:
            topBlock = h > SEA_LEVEL + 20 ? B.SNOW : B.GRASS;
            break;
          case Biome.MOUNTAINS:
            topBlock = h > SEA_LEVEL + 56 ? B.SNOW : h > SEA_LEVEL + 40 ? B.STONE : B.GRASS;
            fillBlock = h > SEA_LEVEL + 40 ? B.STONE : B.DIRT;
            break;
          case Biome.SWAMP:
            topBlock = B.GRASS;
            fillBlock = B.DIRT;
            break;
        }
        if (nearSea && biome !== Biome.DESERT && biome !== Biome.SNOWY_PLAINS && biome !== Biome.MOUNTAINS) {
          topBlock = B.SAND;
          fillBlock = B.SAND;
        }

        for (let y = 0; y <= Math.max(h, SEA_LEVEL); y++) {
          const i = idx(lx, y, lz);
          let id: number = B.AIR;
          if (y <= 1 || (y <= 3 && hash3(wx, y, wz, 7) < 0.55)) {
            id = B.BEDROCK;
          } else if (y <= h) {
            if (y === h) id = topBlock;
            else if (y > h - fillDepth) id = fillBlock;
            else id = B.STONE;
            if (id !== B.BEDROCK && this.caveAt(wx, y, wz)) {
              id = y < 11 ? B.LAVA : B.AIR;
            }
          }
          if (id === B.AIR && y <= SEA_LEVEL) id = B.WATER;
          if (id !== B.AIR) blocks[i] = id;
        }
        // clean up: grass under water becomes dirt/sand
        if (h < SEA_LEVEL) {
          const i = idx(lx, h, lz);
          if (blocks[i] === B.GRASS) blocks[i] = h < SEA_LEVEL - 4 ? B.GRAVEL : B.SAND;
        }
        // frozen ocean surface
        if (biome === Biome.OCEAN && this.temperatureAt(wx, wz) < -0.5) {
          const i = idx(lx, SEA_LEVEL, lz);
          if (blocks[i] === B.WATER) blocks[i] = B.ICE;
        }
      }
    }
  }

  /** scatter plants / trees; may write outside the chunk via `place` */
  decorateChunk(
    cx: number,
    cz: number,
    place: PlaceFn,
    getHeight: (x: number, z: number) => number,
    biomes: Uint8Array,
  ) {
    const ox = cx * CHUNK_X;
    const oz = cz * CHUNK_Z;
    const rng = makeRng(((cx * 73856093) ^ (cz * 19349663) ^ this.seed) >>> 0);

    for (let lz = 0; lz < CHUNK_Z; lz++) {
      for (let lx = 0; lx < CHUNK_X; lx++) {
        const wx = ox + lx;
        const wz = oz + lz;
        const h = getHeight(wx, wz);
        if (h < SEA_LEVEL) continue;
        const biome = biomes[lz * CHUNK_X + lx] as Biome;
        const r = rng();
        const surfaceY = h + 1;

        let treeChance = 0;
        let kind: "oak" | "birch" | "spruce" | "jungle" | "cactus" | "none" = "none";
        switch (biome) {
          case Biome.FOREST: treeChance = 0.055; kind = "oak"; break;
          case Biome.BIRCH_FOREST: treeChance = 0.04; kind = "birch"; break;
          case Biome.TAIGA: treeChance = 0.055; kind = "spruce"; break;
          case Biome.JUNGLE: treeChance = 0.085; kind = "jungle"; break;
          case Biome.PLAINS: treeChance = 0.004; kind = "oak"; break;
          case Biome.SAVANNA: treeChance = 0.006; kind = "oak"; break;
          case Biome.SWAMP: treeChance = 0.02; kind = "oak"; break;
          case Biome.DESERT: treeChance = 0.012; kind = "cactus"; break;
          case Biome.SNOWY_PLAINS: treeChance = 0.008; kind = "spruce"; break;
          case Biome.MOUNTAINS: treeChance = h < SEA_LEVEL + 34 ? 0.012 : 0; kind = "spruce"; break;
        }

        if (r < treeChance && kind !== "none") {
          if (kind === "cactus") this.cactus(wx, surfaceY, wz, place, rng);
          else this.tree(kind, wx, surfaceY, wz, place, rng);
          continue;
        }

        // ground cover
        const g = rng();
        switch (biome) {
          case Biome.PLAINS:
            if (g < 0.22) place(wx, surfaceY, wz, B.TALL_GRASS);
            else if (g < 0.245) place(wx, surfaceY, wz, g < 0.235 ? B.FLOWER_YELLOW : B.FLOWER_RED);
            break;
          case Biome.FOREST:
            if (g < 0.2) place(wx, surfaceY, wz, B.TALL_GRASS);
            else if (g < 0.215) place(wx, surfaceY, wz, B.FLOWER_RED);
            else if (g < 0.222) place(wx, surfaceY, wz, B.MUSHROOM_RED);
            break;
          case Biome.BIRCH_FOREST:
            if (g < 0.18) place(wx, surfaceY, wz, B.TALL_GRASS);
            else if (g < 0.192) place(wx, surfaceY, wz, B.FLOWER_BLUE);
            break;
          case Biome.JUNGLE:
            if (g < 0.4) place(wx, surfaceY, wz, B.FERN);
            break;
          case Biome.TAIGA:
            if (g < 0.16) place(wx, surfaceY, wz, B.FERN);
            break;
          case Biome.SAVANNA:
            if (g < 0.3) place(wx, surfaceY, wz, B.TALL_GRASS);
            break;
          case Biome.SWAMP:
            if (g < 0.26) place(wx, surfaceY, wz, B.TALL_GRASS);
            else if (g < 0.28) place(wx, surfaceY, wz, B.MUSHROOM_RED);
            break;
          case Biome.DESERT:
            if (g < 0.012) place(wx, surfaceY, wz, B.DEAD_BUSH);
            break;
          case Biome.BEACH:
            if (g < 0.004) place(wx, surfaceY, wz, B.DEAD_BUSH);
            break;
        }
      }
    }
  }

  tree(
    kind: "oak" | "birch" | "spruce" | "jungle",
    x: number,
    y: number,
    z: number,
    place: PlaceFn,
    rng: () => number,
  ) {
    if (kind === "spruce") {
      const h = 7 + ((rng() * 5) | 0);
      for (let i = 0; i < h; i++) place(x, y + i, z, B.SPRUCE_LOG);
      let radius = 0;
      for (let i = h - 1; i >= 2; i--) {
        const layer = h - 1 - i;
        radius = layer % 3 === 0 ? 0 : layer % 3 === 1 ? 1 : 2;
        if (layer > 6) radius = (layer % 2) + 1;
        for (let dx = -radius; dx <= radius; dx++)
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.abs(dx) + Math.abs(dz) > radius + 1) continue;
            if (dx === 0 && dz === 0 && i < h) continue;
            place(x + dx, y + i, z + dz, B.SPRUCE_LEAVES, false);
          }
      }
      place(x, y + h, z, B.SPRUCE_LEAVES, false);
      place(x, y + h - 1, z, B.SPRUCE_LEAVES, false);
      return;
    }
    const log = kind === "birch" ? B.BIRCH_LOG : kind === "jungle" ? B.OAK_LOG : B.OAK_LOG;
    const leaf =
      kind === "birch" ? B.BIRCH_LEAVES : kind === "jungle" ? B.JUNGLE_LEAVES : B.OAK_LEAVES;
    const h = kind === "jungle" ? 8 + ((rng() * 7) | 0) : kind === "birch" ? 6 + ((rng() * 3) | 0) : 4 + ((rng() * 3) | 0);
    for (let i = 0; i < h; i++) place(x, y + i, z, log);
    const top = y + h;
    const rad = kind === "jungle" ? 3 : 2;
    for (let dy = -2; dy <= 1; dy++) {
      const ry = dy <= -1 ? rad : rad - 1;
      for (let dx = -ry; dx <= ry; dx++)
        for (let dz = -ry; dz <= ry; dz++) {
          const d = Math.hypot(dx, dz, dy * 1.2);
          if (d > ry + 0.6) continue;
          if (d > ry - 0.2 && rng() < 0.45) continue;
          if (dx === 0 && dz === 0 && dy < 0) continue;
          place(x + dx, top + dy, z + dz, leaf, false);
        }
    }
    place(x, top + 1, z, leaf, false);
  }

  cactus(x: number, y: number, z: number, place: PlaceFn, rng: () => number) {
    const h = 2 + ((rng() * 3) | 0);
    for (let i = 0; i < h; i++) place(x, y + i, z, B.CACTUS);
  }
}
