import { BlockId } from "./blocks";

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 48;
export const SEA_LEVEL = 15;

export type BiomeId = "woodland" | "meadow" | "dunes" | "highlands" | "coast";

export interface TerrainColumn {
  height: number;
  biome: BiomeId;
}

function smooth(value: number): number {
  return value * value * (3 - 2 * value);
}

function hash2(x: number, z: number, seed: number): number {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(z | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

function hash3(x: number, y: number, z: number, seed: number): number {
  let value = Math.imul(x | 0, 0x1f123bb5) ^ Math.imul(y | 0, 0x2c1b3c6d) ^ Math.imul(z | 0, 0x5f356495) ^ seed;
  value = Math.imul(value ^ (value >>> 15), 0x2c1b3c6d);
  value = Math.imul(value ^ (value >>> 12), 0x297a2d39);
  value ^= value >>> 15;
  return (value >>> 0) / 0xffffffff;
}

function valueNoise2(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  const ab = a + (b - a) * tx;
  const cd = c + (d - c) * tx;
  return ab + (cd - ab) * tz;
}

function fractal2(x: number, z: number, seed: number, octaves: number): number {
  let amplitude = 0.55;
  let frequency = 1;
  let total = 0;
  let weights = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    total += valueNoise2(x * frequency, z * frequency, seed + octave * 997) * amplitude;
    weights += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return total / weights;
}

function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const tx = smooth(x - x0);
  const ty = smooth(y - y0);
  const tz = smooth(z - z0);
  const c000 = hash3(x0, y0, z0, seed);
  const c100 = hash3(x0 + 1, y0, z0, seed);
  const c010 = hash3(x0, y0 + 1, z0, seed);
  const c110 = hash3(x0 + 1, y0 + 1, z0, seed);
  const c001 = hash3(x0, y0, z0 + 1, seed);
  const c101 = hash3(x0 + 1, y0, z0 + 1, seed);
  const c011 = hash3(x0, y0 + 1, z0 + 1, seed);
  const c111 = hash3(x0 + 1, y0 + 1, z0 + 1, seed);
  const x00 = c000 + (c100 - c000) * tx;
  const x10 = c010 + (c110 - c010) * tx;
  const x01 = c001 + (c101 - c001) * tx;
  const x11 = c011 + (c111 - c011) * tx;
  const y0Value = x00 + (x10 - x00) * ty;
  const y1Value = x01 + (x11 - x01) * ty;
  return y0Value + (y1Value - y0Value) * tz;
}

function numericSeed(seed: string): number {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value | 0;
}

export class TerrainGenerator {
  private readonly seedNumber: number;
  private readonly columns = new Map<string, TerrainColumn>();

  constructor(readonly seed: string) {
    this.seedNumber = numericSeed(seed);
  }

  column(x: number, z: number): TerrainColumn {
    const key = `${x},${z}`;
    const cached = this.columns.get(key);
    if (cached) return cached;

    const continental = fractal2(x / 118, z / 118, this.seedNumber + 17, 4);
    const detail = fractal2(x / 29, z / 29, this.seedNumber + 83, 3);
    const height = Math.max(4, Math.min(38, Math.round(18 + (continental - 0.5) * 48 + (detail - 0.5) * 12)));
    const heat = fractal2((x + 320) / 170, (z - 190) / 170, this.seedNumber + 201, 2);
    const moisture = fractal2((x - 80) / 135, (z + 410) / 135, this.seedNumber + 811, 2);

    let biome: BiomeId = "meadow";
    if (height <= SEA_LEVEL + 1) biome = "coast";
    else if (height >= 30 || (height >= 26 && heat < 0.31)) biome = "highlands";
    else if (heat > 0.65 && moisture < 0.44) biome = "dunes";
    else if (moisture > 0.57) biome = "woodland";

    const sample = { height, biome };
    this.columns.set(key, sample);
    if (this.columns.size > 100_000) this.columns.clear();
    return sample;
  }

  blockAt(x: number, y: number, z: number): BlockId {
    if (y < 0) return BlockId.Bedrock;
    if (y >= WORLD_HEIGHT) return BlockId.Air;

    const column = this.column(x, z);
    let block = BlockId.Air;
    if (y === 0) {
      block = BlockId.Bedrock;
    } else if (y <= column.height) {
      if (y === column.height) {
        block = this.surfaceBlock(column.biome);
      } else if (y >= column.height - 3 && column.biome !== "highlands") {
        block = column.biome === "dunes" || column.biome === "coast" ? BlockId.Sand : BlockId.Dirt;
      } else if (y >= column.height - 2 && column.biome === "highlands") {
        block = BlockId.Stone;
      } else if (y > 3 && y < column.height - 4 && this.isCave(x, y, z)) {
        block = BlockId.Air;
      } else {
        block = BlockId.Stone;
        if (y < 18 && hash3(x, y, z, this.seedNumber + 1409) > 0.994) {
          block = BlockId.IronOre;
        } else if (y < 27 && hash3(x, y, z, this.seedNumber + 241) > 0.989) {
          block = BlockId.CoalOre;
        }
      }
    } else if (y <= SEA_LEVEL) {
      block = BlockId.Water;
    }

    if (block === BlockId.Air) {
      return this.treeBlockAt(x, y, z) ?? block;
    }
    return block;
  }

  surfaceBlock(biome: BiomeId): BlockId {
    if (biome === "coast" || biome === "dunes") return BlockId.Sand;
    if (biome === "highlands") return BlockId.Snow;
    return BlockId.Grass;
  }

  treeFor(x: number, z: number): { height: number; trunk: number } | null {
    const column = this.column(x, z);
    if (column.height <= SEA_LEVEL + 2) return null;
    const chance = column.biome === "woodland" ? 0.13 : column.biome === "meadow" ? 0.035 : column.biome === "highlands" ? 0.055 : 0;
    if (hash2(x, z, this.seedNumber + 1703) > chance) return null;
    return { height: column.height, trunk: 4 + Math.floor(hash2(x, z, this.seedNumber + 2501) * 2) };
  }

  treeBlockAt(x: number, y: number, z: number): BlockId | null {
    for (let tx = x - 2; tx <= x + 2; tx += 1) {
      for (let tz = z - 2; tz <= z + 2; tz += 1) {
        const tree = this.treeFor(tx, tz);
        if (!tree) continue;
        if (x === tx && z === tz && y > tree.height && y <= tree.height + tree.trunk) {
          return BlockId.Log;
        }
        const centerY = tree.height + tree.trunk - 1;
        const layer = y - centerY;
        if (layer < -2 || layer > 2) continue;
        const radius = Math.abs(layer) === 2 ? 1 : 2;
        const dx = x - tx;
        const dz = z - tz;
        if (dx * dx + dz * dz <= radius * radius + 0.4 && !(dx === 0 && dz === 0 && y <= tree.height + tree.trunk)) {
          return BlockId.Leaves;
        }
      }
    }
    return null;
  }

  isCave(x: number, y: number, z: number): boolean {
    const broad = valueNoise3(x / 19, y / 11, z / 19, this.seedNumber + 389);
    const detail = valueNoise3(x / 9, y / 6, z / 9, this.seedNumber + 1217);
    return broad > 0.72 && detail > 0.4;
  }

  findSpawn(): { x: number; y: number; z: number } {
    let best = { x: 0, z: 0, score: Number.POSITIVE_INFINITY };
    for (let radius = 0; radius <= 48; radius += 4) {
      for (let x = -radius; x <= radius; x += 4) {
        for (let z = -radius; z <= radius; z += 4) {
          if (Math.max(Math.abs(x), Math.abs(z)) !== radius && radius !== 0) continue;
          const column = this.column(x, z);
          if (column.height < SEA_LEVEL + 2) continue;
          if (this.treeBlockAt(x, column.height + 1, z) || this.treeBlockAt(x, column.height + 2, z)) continue;
          const biomePenalty = column.biome === "dunes" ? 4 : column.biome === "highlands" ? 3 : 0;
          const score = x * x + z * z + biomePenalty * 12;
          if (score < best.score) best = { x, z, score };
        }
      }
      if (best.score < Number.POSITIVE_INFINITY && radius > 8) break;
    }
    const column = this.column(best.x, best.z);
    return { x: best.x + 0.5, y: column.height + 1, z: best.z + 0.5 };
  }

  randomAt(x: number, y: number, z: number, salt = 0): number {
    return hash3(x, y, z, this.seedNumber + salt);
  }
}