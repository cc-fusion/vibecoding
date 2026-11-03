import { BLOCK } from './blocks';
import { BiomeId, CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from './constants';
import { hashCoords2D, hashCoords3D, SeededNoise } from './noise';

export const BIOME_NAMES: Record<BiomeId, string> = {
  plains: 'Emerald Plains',
  forest: 'Whispering Woods',
  desert: 'Sunbaked Dunes',
  taiga: 'Frostpeak Taiga',
  mountains: 'Shattered Crags',
  ocean: 'Azure Shallows',
};

export interface ColumnSample {
  height: number;
  biome: BiomeId;
  temp: number;
  moisture: number;
}

export class WorldGenerator {
  readonly seed: number;
  private continental: SeededNoise;
  private detail: SeededNoise;
  private mountain: SeededNoise;
  private temperature: SeededNoise;
  private moisture: SeededNoise;
  private caveA: SeededNoise;
  private caveB: SeededNoise;
  private oreNoise: SeededNoise;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.continental = new SeededNoise(this.seed ^ 0x9e3779b9);
    this.detail = new SeededNoise(this.seed ^ 0x51f7a221);
    this.mountain = new SeededNoise(this.seed ^ 0x2f81c33d);
    this.temperature = new SeededNoise(this.seed ^ 0x77b11093);
    this.moisture = new SeededNoise(this.seed ^ 0x18d4e2a5);
    this.caveA = new SeededNoise(this.seed ^ 0x44a9c001);
    this.caveB = new SeededNoise(this.seed ^ 0x6b22f981);
    this.oreNoise = new SeededNoise(this.seed ^ 0x8d31b715);
  }

  sampleColumn(wx: number, wz: number): ColumnSample {
    // Domain warp for natural organic coastlines and biome borders
    const warpX = this.detail.noise2D(wx * 0.008, wz * 0.008) * 18;
    const warpZ = this.detail.noise2D(wx * 0.008 + 41.3, wz * 0.008 - 19.7) * 18;
    const sx = wx + warpX;
    const sz = wz + warpZ;

    const cont = this.continental.fbm2D(sx * 0.0055, sz * 0.0055, 4); // ~[-0.7, 0.7]
    const hills = this.detail.fbm2D(wx * 0.021, wz * 0.021, 3);
    const micro = this.detail.noise2D(wx * 0.075, wz * 0.075);
    const ridge = this.mountain.ridged2D(sx * 0.009, sz * 0.009, 4); // [0..1]

    const temp = this.temperature.fbm2D(sx * 0.0042 + 100, sz * 0.0042 - 50, 3); // [-0.7..0.7]
    const moisture = this.moisture.fbm2D(sx * 0.0046 - 80, sz * 0.0046 + 120, 3);

    // Base land elevation around SEA_LEVEL (34)
    let h = SEA_LEVEL + 5.5 + cont * 21.0 + hills * 7.5 + micro * 1.6;

    // Dramatic alpine ridges when mountain mask is positive
    const mountainFactor = Math.max(0, (ridge - 0.52) * 2.15);
    if (cont > -0.12) {
      h += mountainFactor * mountainFactor * 34.0 * Math.min(1, (cont + 0.2) * 2.4);
    }

    let biome: BiomeId = 'plains';
    if (h < SEA_LEVEL - 1.2) {
      biome = 'ocean';
    } else if (mountainFactor > 0.46 || h >= 58) {
      biome = 'mountains';
    } else if (temp < -0.17) {
      biome = 'taiga';
    } else if (temp > 0.19 && moisture < 0.03) {
      biome = 'desert';
      // Smooth desert dunes
      h += Math.abs(this.detail.noise2D(wx * 0.035, wz * 0.035)) * 4.2;
    } else if (moisture > 0.06) {
      biome = 'forest';
    } else {
      biome = 'plains';
    }

    const clamped = Math.max(5, Math.min(WORLD_HEIGHT - 8, Math.floor(h)));
    return { height: clamped, biome, temp, moisture };
  }

  getBiomeAt(wx: number, wz: number): BiomeId {
    return this.sampleColumn(wx, wz).biome;
  }

  getSurfaceHeight(wx: number, wz: number): number {
    return this.sampleColumn(wx, wz).height;
  }

  generateChunkBlocks(cx: number, cz: number, out: Uint8Array): void {
    out.fill(BLOCK.AIR);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomes: BiomeId[] = new Array(CHUNK_SIZE * CHUNK_SIZE);

    const setLocal = (lx: number, y: number, lz: number, id: number) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT) return;
      out[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] = id;
    };
    const getLocal = (lx: number, y: number, lz: number): number => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= WORLD_HEIGHT)
        return BLOCK.AIR;
      return out[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
    };

    // Pass 1: Base Strata, Water/Ice, Caves, and Ores
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const col = this.sampleColumn(wx, wz);
        const h = col.height;
        const biome = col.biome;
        const colIdx = lz * CHUNK_SIZE + lx;
        heights[colIdx] = h;
        biomes[colIdx] = biome;

        for (let y = 0; y <= Math.max(h, SEA_LEVEL); y++) {
          if (y === 0) {
            setLocal(lx, y, lz, BLOCK.BEDROCK);
            continue;
          }
          if (y <= h) {
            let blockId: number = BLOCK.STONE;

            if (y === h) {
              if (h <= SEA_LEVEL + 1 && biome !== 'taiga') {
                blockId = hashCoords2D(wx, wz, this.seed + 5) < 0.14 ? BLOCK.CLAY : BLOCK.SAND;
              } else if (biome === 'desert') {
                blockId = BLOCK.SAND;
              } else if (biome === 'taiga') {
                blockId = BLOCK.SNOW_GRASS;
              } else if (biome === 'mountains') {
                blockId = y >= 61 ? BLOCK.SNOW : y >= 54 ? BLOCK.STONE : BLOCK.GRASS;
              } else {
                blockId = BLOCK.GRASS;
              }
            } else if (y >= h - 3) {
              if (biome === 'desert' || h <= SEA_LEVEL + 1) {
                blockId = y === h - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
              } else if (biome === 'mountains' && y >= 52) {
                blockId = hashCoords3D(wx, y, wz, this.seed + 9) < 0.25 ? BLOCK.GRAVEL : BLOCK.STONE;
              } else {
                blockId = BLOCK.DIRT;
              }
            } else if (biome === 'desert' && y >= h - 6) {
              blockId = BLOCK.SANDSTONE;
            }

            // 3D Spaghetti Caves + Caverns (allow natural hillside cave mouths above sea level!)
            const allowCave = y > 2 && (y < h - 3 || (h > SEA_LEVEL + 4 && y <= h));
            if (allowCave) {
              const ca = this.caveA.noise3D(wx * 0.048, y * 0.062, wz * 0.048);
              const cb = this.caveB.noise3D(wx * 0.048 + 31.7, y * 0.062 - 12.4, wz * 0.048 + 9.2);
              const tunnel = ca * ca + cb * cb;
              const cavern = this.caveA.fbm3D(wx * 0.03, y * 0.042, wz * 0.03, 2);
              if (tunnel < 0.0175 || (y < 26 && cavern > 0.44)) {
                blockId = y <= 8 ? BLOCK.LAVA : BLOCK.AIR;
              }
            }

            // Mineral Veins inside Stone
            if (blockId === BLOCK.STONE) {
              const oreVal = this.oreNoise.noise3D(wx * 0.16, y * 0.16, wz * 0.16);
              const oreVal2 = this.oreNoise.noise3D(wx * 0.19 + 77, y * 0.19 - 33, wz * 0.19 + 15);
              if (y <= 18 && oreVal > 0.66) {
                blockId = BLOCK.DIAMOND_ORE;
              } else if (y <= 30 && oreVal2 > 0.65) {
                blockId = BLOCK.GOLD_ORE;
              } else if (biome === 'mountains' && y >= 40 && oreVal2 < -0.66) {
                blockId = BLOCK.EMERALD_ORE;
              } else if (y <= 56 && oreVal < -0.58) {
                blockId = BLOCK.IRON_ORE;
              } else if (oreVal > 0.55) {
                blockId = BLOCK.COAL_ORE;
              }
            }

            setLocal(lx, y, lz, blockId);
          } else if (y <= SEA_LEVEL) {
            if (y === SEA_LEVEL && biome === 'taiga') {
              setLocal(lx, y, lz, BLOCK.ICE);
            } else {
              setLocal(lx, y, lz, BLOCK.WATER);
            }
          }
        }
      }
    }

    // Pass 2: Cave glowing mushrooms
    for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
      for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        for (let y = 9; y < 38; y++) {
          if (getLocal(lx, y, lz) === BLOCK.AIR && getLocal(lx, y - 1, lz) === BLOCK.STONE) {
            if (hashCoords3D(wx, y, wz, this.seed + 303) < 0.018) {
              setLocal(lx, y, lz, BLOCK.GLOW_SHROOM);
            }
          }
        }
      }
    }

    // Pass 3: Trees, Cacti, Meadow Flowers & Grass (padded 2 blocks inward so canopies fit cleanly in chunk)
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const colIdx = lz * CHUNK_SIZE + lx;
        const h = heights[colIdx];
        const biome = biomes[colIdx];
        if (h <= SEA_LEVEL + 1 || h >= WORLD_HEIGHT - 12) continue;

        const ground = getLocal(lx, h, lz);
        const r = hashCoords2D(wx, wz, this.seed + 701);

        if (ground === BLOCK.GRASS) {
          const treeChance = biome === 'forest' ? 0.048 : biome === 'plains' ? 0.006 : 0.003;
          if (r < treeChance) {
            const isBirch = biome === 'forest' && hashCoords2D(wx, wz, this.seed + 811) < 0.36;
            const logBlock = isBirch ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
            const leafBlock = isBirch ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;
            const trunkH = 4 + Math.floor(hashCoords2D(wx, wz, this.seed + 907) * 3);

            setLocal(lx, h, lz, BLOCK.DIRT);
            for (let dy = -2; dy <= 1; dy++) {
              const radius = dy >= 0 ? 1 : 2;
              for (let dz = -radius; dz <= radius; dz++) {
                for (let dx = -radius; dx <= radius; dx++) {
                  if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && dy === -1) continue;
                  const ty = h + trunkH + dy;
                  if (getLocal(lx + dx, ty, lz + dz) === BLOCK.AIR) {
                    setLocal(lx + dx, ty, lz + dz, leafBlock);
                  }
                }
              }
            }
            for (let t = 1; t <= trunkH; t++) {
              setLocal(lx, h + t, lz, logBlock);
            }
          } else if (r > 0.84) {
            const fr = hashCoords2D(wx, wz, this.seed + 1201);
            const flora =
              fr < 0.14 ? BLOCK.FLOWER_RED : fr < 0.28 ? BLOCK.FLOWER_YELLOW : BLOCK.TALL_GRASS;
            if (getLocal(lx, h + 1, lz) === BLOCK.AIR) {
              setLocal(lx, h + 1, lz, flora);
            }
          }
        } else if (ground === BLOCK.SNOW_GRASS && r < 0.032) {
          // Tall conical Spruce tree
          const trunkH = 6 + Math.floor(hashCoords2D(wx, wz, this.seed + 953) * 3);
          setLocal(lx, h, lz, BLOCK.DIRT);
          for (let layer = 2; layer <= trunkH + 1; layer++) {
            const radius = layer === trunkH + 1 ? 0 : layer % 2 === 0 ? 2 : 1;
            for (let dz = -radius; dz <= radius; dz++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                if (getLocal(lx + dx, h + layer, lz + dz) === BLOCK.AIR) {
                  setLocal(lx + dx, h + layer, lz + dz, BLOCK.PINE_LEAVES);
                }
              }
            }
          }
          for (let t = 1; t <= trunkH; t++) {
            setLocal(lx, h + t, lz, BLOCK.PINE_LOG);
          }
        } else if (ground === BLOCK.SAND && biome === 'desert' && r < 0.014) {
          const ch = 2 + Math.floor(hashCoords2D(wx, wz, this.seed + 1409) * 3);
          for (let t = 1; t <= ch; t++) {
            setLocal(lx, h + t, lz, BLOCK.CACTUS);
          }
        }
      }
    }

    // Pass 4: Rare Ancient Wayfarer Shrine / Ruin (1 in ~26 land chunks for exciting discovery!)
    const shrineRoll = hashCoords2D(cx, cz, this.seed + 4242);
    if (shrineRoll < 0.038) {
      const lx = 8;
      const lz = 8;
      const h = heights[lz * CHUNK_SIZE + lx];
      const biome = biomes[lz * CHUNK_SIZE + lx];
      if (h > SEA_LEVEL + 2 && h < WORLD_HEIGHT - 12 && biome !== 'ocean') {
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            for (let y = h - 3; y <= h; y++) {
              setLocal(lx + dx, y, lz + dz, BLOCK.STONE_BRICKS);
            }
            for (let y = h + 1; y <= h + 4; y++) {
              setLocal(lx + dx, y, lz + dz, BLOCK.AIR);
            }
          }
        }
        // Corner pillars + warm torches
        for (const [px, pz] of [
          [-2, -2],
          [2, -2],
          [-2, 2],
          [2, 2],
        ]) {
          const pillarH = 3 + ((Math.abs(px + pz + cx) % 2) + 1);
          for (let dy = 1; dy <= pillarH; dy++) {
            setLocal(lx + px, h + dy, lz + pz, BLOCK.STONE_BRICKS);
          }
          setLocal(lx + px, h + pillarH + 1, lz + pz, BLOCK.TORCH);
        }
        // Center relic blocks (Crafting Table, Bookshelf, hidden Emerald/Gold cache beneath!)
        setLocal(lx, h, lz, BLOCK.GLOWSTONE);
        setLocal(lx - 1, h + 1, lz, BLOCK.CRAFTING_TABLE);
        setLocal(lx + 1, h + 1, lz, BLOCK.FURNACE);
        setLocal(lx, h - 1, lz, BLOCK.GOLD_ORE);
      }
    }
  }
}
