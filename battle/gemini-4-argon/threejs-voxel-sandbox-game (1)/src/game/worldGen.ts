import {
  CHUNK_AREA,
  CHUNK_SIZE,
  CHUNK_VOLUME,
  SEA_LEVEL,
  WORLD_HEIGHT,
  voxelIndex,
} from './constants';
import { hash2D, hash3D, SeededNoise } from './math/noise';
import { BiomeId, BlockId } from './types';

export interface ColumnSample {
  biome: BiomeId;
  height: number;
  temperature: number;
  moisture: number;
  mountain: number;
}

export class ChunkData {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  readonly light: Uint8Array; // high nibble = sky (0..15), low nibble = block (0..15)
  readonly biomes: BiomeId[];
  maxY = 1;
  dirty = true;
  lightDirty = true;

  constructor(cx: number, cz: number) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_VOLUME);
    this.light = new Uint8Array(CHUNK_VOLUME);
    this.biomes = new Array<BiomeId>(CHUNK_AREA).fill('plains');
  }

  getBlock(lx: number, y: number, lz: number): BlockId {
    if (y < 0 || y >= WORLD_HEIGHT || lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      return BlockId.Air;
    }
    return this.blocks[voxelIndex(lx, y, lz)] as BlockId;
  }

  setBlock(lx: number, y: number, lz: number, id: BlockId): void {
    if (y < 0 || y >= WORLD_HEIGHT || lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) {
      return;
    }
    this.blocks[voxelIndex(lx, y, lz)] = id;
    if (id !== BlockId.Air && y > this.maxY) {
      this.maxY = y;
    }
    this.dirty = true;
    this.lightDirty = true;
  }

  recomputeMaxY(): void {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      const base = y * CHUNK_AREA;
      for (let i = 0; i < CHUNK_AREA; i++) {
        if (this.blocks[base + i] !== BlockId.Air) {
          this.maxY = y;
          return;
        }
      }
    }
    this.maxY = 1;
  }

  getSkyLight(lx: number, y: number, lz: number): number {
    if (y >= WORLD_HEIGHT) return 15;
    if (y < 0) return 0;
    return (this.light[voxelIndex(lx, y, lz)] >> 4) & 15;
  }

  getBlockLight(lx: number, y: number, lz: number): number {
    if (y < 0 || y >= WORLD_HEIGHT) return 0;
    return this.light[voxelIndex(lx, y, lz)] & 15;
  }
}

export class WorldGenerator {
  readonly seed: number;
  private continentNoise: SeededNoise;
  private detailNoise: SeededNoise;
  private ridgeNoise: SeededNoise;
  private tempNoise: SeededNoise;
  private moistNoise: SeededNoise;
  private riverNoise: SeededNoise;
  private caveNoiseA: SeededNoise;
  private caveNoiseB: SeededNoise;
  private oreNoise: SeededNoise;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.continentNoise = new SeededNoise(this.seed ^ 0x1a2b3c4d);
    this.detailNoise = new SeededNoise(this.seed ^ 0x55aa77cc);
    this.ridgeNoise = new SeededNoise(this.seed ^ 0x9911ee22);
    this.tempNoise = new SeededNoise(this.seed ^ 0x3377bbdd);
    this.moistNoise = new SeededNoise(this.seed ^ 0x8844ff11);
    this.riverNoise = new SeededNoise(this.seed ^ 0x77331199);
    this.caveNoiseA = new SeededNoise(this.seed ^ 0xaabb1122);
    this.caveNoiseB = new SeededNoise(this.seed ^ 0xccdd3344);
    this.oreNoise = new SeededNoise(this.seed ^ 0xeeff5566);
  }

  sampleColumn(wx: number, wz: number): ColumnSample {
    const temp = this.tempNoise.fbm2(wx * 0.0038, wz * 0.0038, 3);
    const moisture = this.moistNoise.fbm2(wx * 0.0044, wz * 0.0044, 3);
    const continent = this.continentNoise.fbm2(wx * 0.0052, wz * 0.0052, 4);
    const hills = this.detailNoise.fbm2(wx * 0.022, wz * 0.022, 4);
    const mountainRaw = this.ridgeNoise.ridged2(wx * 0.0068, wz * 0.0068, 4);
    const mountainMask = Math.max(0, (mountainRaw - 0.56) / 0.44);

    // Winding rivers carved cleanly into landscape
    const riverRaw = Math.abs(this.riverNoise.fbm2(wx * 0.0041, wz * 0.0041, 3));

    let baseHeight =
      SEA_LEVEL +
      6 +
      continent * 13 +
      hills * 5.5 +
      Math.pow(mountainMask, 1.45) * 38;

    // Dunes ripple in hot arid zones
    if (temp > 0.16 && moisture < -0.04) {
      const dune = Math.abs(Math.sin(wx * 0.055 + hills * 2.4)) * 3.5;
      baseHeight += dune;
    }

    // Carve smooth river channels where mountain elevation isn't extreme
    if (riverRaw < 0.085 && mountainMask < 0.45) {
      const t = 1.0 - riverRaw / 0.085;
      const targetRiverBed = SEA_LEVEL - 4.2;
      baseHeight = baseHeight * (1 - t * 0.88) + targetRiverBed * (t * 0.88);
    }

    const height = Math.max(8, Math.min(WORLD_HEIGHT - 8, Math.round(baseHeight)));

    let biome: BiomeId = 'plains';
    if (height < SEA_LEVEL - 1) {
      biome = 'river';
    } else if (height <= SEA_LEVEL + 1 && mountainMask < 0.32) {
      biome = 'beach';
    } else if (mountainMask > 0.34 || height >= 58) {
      biome = 'mountains';
    } else if (temp > 0.16 && moisture < -0.04) {
      biome = 'desert';
    } else if (moisture > 0.06) {
      biome = 'forest';
    } else {
      biome = 'plains';
    }

    return {
      biome,
      height,
      temperature: temp,
      moisture,
      mountain: mountainMask,
    };
  }

  private isCave(wx: number, y: number, wz: number, surfaceY: number): boolean {
    if (y <= 2 || y > surfaceY + 1) return false;
    // Spaghetti tunnels
    const a = this.caveNoiseA.fbm3(wx * 0.042, y * 0.052, wz * 0.042, 2);
    const b = this.caveNoiseB.fbm3(wx * 0.042 + 41.3, y * 0.052 - 19.7, wz * 0.042 + 13.1, 2);
    const tunnel = a * a + b * b;

    // Prevent flooding lakes directly through riverbeds unless deep underground
    if (surfaceY <= SEA_LEVEL + 1 && y >= SEA_LEVEL - 6) {
      return false;
    }

    if (tunnel < 0.0085) return true;

    // Deep caverns below Y=28
    if (y < 28) {
      const chamber = this.caveNoiseA.noise3D(wx * 0.026 + 90, y * 0.035, wz * 0.026 - 50);
      if (chamber > 0.56) return true;
    }
    return false;
  }

  private pickOre(wx: number, y: number, wz: number, biome: BiomeId): BlockId {
    const nCoal = this.oreNoise.noise3D(wx * 0.13, y * 0.13, wz * 0.13);
    if (y >= 6 && y <= 74 && nCoal > 0.62) return BlockId.CoalOre;

    const nIron = this.oreNoise.noise3D(wx * 0.14 + 31.7, y * 0.14 + 11.2, wz * 0.14);
    if (y >= 5 && y <= 58 && nIron > 0.66) return BlockId.IronOre;

    const nGold = this.oreNoise.noise3D(wx * 0.16 - 55.1, y * 0.16, wz * 0.16 + 22.4);
    if (y >= 4 && y <= 30 && nGold > 0.72) return BlockId.GoldOre;

    const nDiamond = this.oreNoise.noise3D(wx * 0.17 + 88.8, y * 0.17 - 44.2, wz * 0.17);
    if (y >= 3 && y <= 17 && nDiamond > 0.75) return BlockId.DiamondOre;

    if (biome === 'mountains' && y >= 8 && y <= 68) {
      const nEmerald = this.oreNoise.noise3D(wx * 0.18 - 12.4, y * 0.18 + 63.1, wz * 0.18);
      if (nEmerald > 0.76) return BlockId.EmeraldOre;
    }

    const nGravel = this.oreNoise.noise3D(wx * 0.08 + 140, y * 0.08, wz * 0.08);
    if (y >= 10 && y <= 50 && nGravel > 0.68) return BlockId.Gravel;

    return BlockId.Stone;
  }

  generateChunk(cx: number, cz: number): ChunkData {
    const chunk = new ChunkData(cx, cz);
    const blocks = chunk.blocks;
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const surfaceHeights = new Int16Array(CHUNK_AREA);

    // 1. Base terrain strata, caves, ores, and water bodies
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const colIdx = lz * CHUNK_SIZE + lx;
        const col = this.sampleColumn(wx, wz);
        chunk.biomes[colIdx] = col.biome;
        surfaceHeights[colIdx] = col.height;

        const maxY = Math.max(col.height, SEA_LEVEL);
        for (let y = 0; y <= maxY; y++) {
          const idx = voxelIndex(lx, y, lz);

          if (y === 0 || (y <= 2 && hash3D(this.seed, wx, y, wz) < 0.65 - y * 0.25)) {
            blocks[idx] = BlockId.Bedrock;
            continue;
          }

          if (y <= col.height) {
            if (this.isCave(wx, y, wz, col.height)) {
              blocks[idx] = BlockId.Air;
              // Rare glowing crystal cluster hanging in deep caves
              if (
                y < 24 &&
                y > 5 &&
                hash3D(this.seed ^ 0x5151, wx, y, wz) > 0.996
              ) {
                blocks[idx] = BlockId.Glowstone;
              }
              continue;
            }

            if (y === col.height) {
              if (col.height < SEA_LEVEL - 1) {
                const bedRand = hash2D(this.seed ^ 0x1111, wx, wz);
                blocks[idx] =
                  bedRand < 0.22
                    ? BlockId.Clay
                    : bedRand < 0.45
                    ? BlockId.Gravel
                    : BlockId.Sand;
              } else if (col.biome === 'desert' || col.biome === 'beach') {
                blocks[idx] = BlockId.Sand;
              } else if (col.biome === 'mountains') {
                if (col.height >= 64) {
                  blocks[idx] = BlockId.Snow;
                } else if (col.height >= 55) {
                  blocks[idx] = BlockId.SnowGrass;
                } else if (col.mountain > 0.52) {
                  blocks[idx] = BlockId.Stone;
                } else {
                  blocks[idx] = BlockId.Grass;
                }
              } else {
                blocks[idx] = BlockId.Grass;
              }
            } else if (y >= col.height - 3) {
              if (col.biome === 'desert' || col.biome === 'beach') {
                blocks[idx] = y === col.height - 3 ? BlockId.Sandstone : BlockId.Sand;
              } else if (col.biome === 'mountains' && col.height >= 66) {
                blocks[idx] = BlockId.Snow;
              } else if (col.biome === 'mountains' && col.mountain > 0.55) {
                blocks[idx] = BlockId.Stone;
              } else {
                blocks[idx] = BlockId.Dirt;
              }
            } else if (
              (col.biome === 'desert' || col.biome === 'beach') &&
              y >= col.height - 6
            ) {
              blocks[idx] = BlockId.Sandstone;
            } else {
              blocks[idx] = this.pickOre(wx, y, wz, col.biome);
            }
          } else if (y <= SEA_LEVEL) {
            if (y === SEA_LEVEL && col.temperature < -0.34 && col.biome === 'mountains') {
              blocks[idx] = BlockId.Ice;
            } else {
              blocks[idx] = BlockId.Water;
            }
          }
        }
      }
    }

    // 2. Deterministic cross-chunk trees, cacti & ancient stone ruins
    const margin = 3;
    for (let wz = baseZ - margin; wz < baseZ + CHUNK_SIZE + margin; wz++) {
      for (let wx = baseX - margin; wx < baseX + CHUNK_SIZE + margin; wx++) {
        const treeRoll = hash2D(this.seed ^ 0x77ee12, wx, wz);

        // Rare ancient mossy ruin shrine on flat dry land
        if (treeRoll > 0.99935) {
          const col = this.sampleColumn(wx, wz);
          if (col.height > SEA_LEVEL + 2 && col.height < 64) {
            this.stampRuin(chunk, baseX, baseZ, wx, col.height + 1, wz);
            continue;
          }
        }

        // Grid jitter spacing so trees never collide awkwardly
        if (((wx * 7 + wz * 13) & 3) !== 0) continue;

        const col = this.sampleColumn(wx, wz);
        if (col.height <= SEA_LEVEL + 1 || col.height >= WORLD_HEIGHT - 14) continue;

        // Skip if cave mouth carved away the surface block
        if (this.isCave(wx, col.height, wz, col.height)) continue;

        let density = 0.0;
        if (col.biome === 'forest') density = 0.16;
        else if (col.biome === 'plains') density = 0.022;
        else if (col.biome === 'mountains' && col.height < 63) density = 0.055;
        else if (col.biome === 'desert') density = 0.03;

        if (treeRoll < density) {
          const variant = hash2D(this.seed ^ 0x998877, wx, wz);
          if (col.biome === 'desert') {
            this.stampCactus(chunk, baseX, baseZ, wx, col.height + 1, wz, variant);
          } else if (col.biome === 'mountains') {
            this.stampSpruceTree(chunk, baseX, baseZ, wx, col.height + 1, wz, variant);
          } else if (variant > 0.72) {
            this.stampBirchTree(chunk, baseX, baseZ, wx, col.height + 1, wz, variant);
          } else {
            this.stampOakTree(chunk, baseX, baseZ, wx, col.height + 1, wz, variant);
          }
        }
      }
    }

    // 3. Surface groundcover (Tall Grass, Wildflowers, Desert Shrubs)
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const colIdx = lz * CHUNK_SIZE + lx;
        const topY = surfaceHeights[colIdx];
        if (topY <= SEA_LEVEL || topY >= WORLD_HEIGHT - 2) continue;

        const ground = blocks[voxelIndex(lx, topY, lz)];
        const aboveIdx = voxelIndex(lx, topY + 1, lz);
        if (blocks[aboveIdx] !== BlockId.Air) continue;

        const r = hash2D(this.seed ^ 0x4f109a, wx, wz);
        if (ground === BlockId.Grass) {
          if (r < 0.16) {
            blocks[aboveIdx] = BlockId.TallGrass;
          } else if (r < 0.182) {
            blocks[aboveIdx] = BlockId.YellowFlower;
          } else if (r < 0.2) {
            blocks[aboveIdx] = BlockId.RedFlower;
          } else if (r < 0.212) {
            blocks[aboveIdx] = BlockId.BlueFlower;
          }
        } else if (ground === BlockId.Sand && chunk.biomes[colIdx] === 'desert') {
          if (r < 0.022) {
            blocks[aboveIdx] = BlockId.DeadBush;
          }
        }
      }
    }

    chunk.recomputeMaxY();
    return chunk;
  }

  private setIfInChunk(
    chunk: ChunkData,
    baseX: number,
    baseZ: number,
    wx: number,
    y: number,
    wz: number,
    block: BlockId,
    onlyAir = false
  ) {
    const lx = wx - baseX;
    const lz = wz - baseZ;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT) {
      return;
    }
    const idx = voxelIndex(lx, y, lz);
    if (onlyAir && chunk.blocks[idx] !== BlockId.Air && chunk.blocks[idx] !== BlockId.TallGrass) {
      return;
    }
    chunk.blocks[idx] = block;
  }

  private stampOakTree(
    chunk: ChunkData,
    baseX: number,
    baseZ: number,
    wx: number,
    baseY: number,
    wz: number,
    variant: number
  ) {
    const trunkH = 4 + Math.floor(variant * 3);
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy >= 1 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r && dy !== 0) continue;
          this.setIfInChunk(
            chunk,
            baseX,
            baseZ,
            wx + dx,
            baseY + trunkH - 1 + dy,
            wz + dz,
            BlockId.OakLeaves,
            true
          );
        }
      }
    }
    this.setIfInChunk(chunk, baseX, baseZ, wx, baseY - 1, wz, BlockId.Dirt);
    for (let i = 0; i < trunkH; i++) {
      this.setIfInChunk(chunk, baseX, baseZ, wx, baseY + i, wz, BlockId.OakLog);
    }
  }

  private stampBirchTree(
    chunk: ChunkData,
    baseX: number,
    baseZ: number,
    wx: number,
    baseY: number,
    wz: number,
    variant: number
  ) {
    const trunkH = 5 + Math.floor(variant * 3);
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy >= 1 ? 1 : 2;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r && Math.abs(dz) === r) continue;
          this.setIfInChunk(
            chunk,
            baseX,
            baseZ,
            wx + dx,
            baseY + trunkH - 1 + dy,
            wz + dz,
            BlockId.BirchLeaves,
            true
          );
        }
      }
    }
    this.setIfInChunk(chunk, baseX, baseZ, wx, baseY - 1, wz, BlockId.Dirt);
    for (let i = 0; i < trunkH; i++) {
      this.setIfInChunk(chunk, baseX, baseZ, wx, baseY + i, wz, BlockId.BirchLog);
    }
  }

  private stampSpruceTree(
    chunk: ChunkData,
    baseX: number,
    baseZ: number,
    wx: number,
    baseY: number,
    wz: number,
    variant: number
  ) {
    const trunkH = 6 + Math.floor(variant * 4);
    for (let layer = 2; layer <= trunkH + 1; layer++) {
      const fromTop = trunkH + 1 - layer;
      const r = fromTop <= 1 ? (fromTop === 0 ? 0 : 1) : layer % 2 === 0 ? 2 : 1;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (r === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          this.setIfInChunk(
            chunk,
            baseX,
            baseZ,
            wx + dx,
            baseY + layer,
            wz + dz,
            BlockId.SpruceLeaves,
            true
          );
        }
      }
    }
    for (let i = 0; i < trunkH; i++) {
      this.setIfInChunk(chunk, baseX, baseZ, wx, baseY + i, wz, BlockId.SpruceLog);
    }
  }

  private stampCactus(
    chunk: ChunkData,
    baseX: number,
    baseZ: number,
    wx: number,
    baseY: number,
    wz: number,
    variant: number
  ) {
    const h = 2 + Math.floor(variant * 3);
    for (let i = 0; i < h; i++) {
      this.setIfInChunk(chunk, baseX, baseZ, wx, baseY + i, wz, BlockId.Cactus, true);
    }
  }

  private stampRuin(
    chunk: ChunkData,
    baseX: number,
    baseZ: number,
    wx: number,
    baseY: number,
    wz: number
  ) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const b = (dx + dz) % 2 === 0 ? BlockId.MossyCobble : BlockId.Cobblestone;
        this.setIfInChunk(chunk, baseX, baseZ, wx + dx, baseY - 1, wz + dz, b);
        const corner = Math.abs(dx) === 2 && Math.abs(dz) === 2;
        if (corner) {
          for (let h = 0; h < 3; h++) {
            this.setIfInChunk(chunk, baseX, baseZ, wx + dx, baseY + h, wz + dz, b);
          }
        }
      }
    }
    this.setIfInChunk(chunk, baseX, baseZ, wx, baseY, wz, BlockId.Glowstone);
    this.setIfInChunk(chunk, baseX, baseZ, wx + 1, baseY, wz, BlockId.CraftingTable);
  }

  findSpawnPosition(): { x: number; y: number; z: number } {
    // Search spirally from (0,0) for dry scenic land above sea level
    for (let radius = 0; radius <= 128; radius += 4) {
      const steps = Math.max(1, radius * 2);
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const wx = Math.round(Math.cos(angle) * radius);
        const wz = Math.round(Math.sin(angle) * radius);
        const col = this.sampleColumn(wx, wz);
        if (col.height > SEA_LEVEL + 2 && col.height < 60 && !this.isCave(wx, col.height, wz, col.height)) {
          return { x: wx + 0.5, y: col.height + 2.2, z: wz + 0.5 };
        }
      }
    }
    const fallback = this.sampleColumn(0, 0);
    return { x: 0.5, y: Math.max(SEA_LEVEL + 2, fallback.height + 2.2), z: 0.5 };
  }
}
