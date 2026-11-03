import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, BIOMES } from './constants.js';
import { BLOCK } from './blocks.js';
import { SeededNoise, hashCoords2D, hashCoords3D } from './noise.js';

export class TerrainGenerator {
  constructor(seedInput) {
    this.noise = new SeededNoise(seedInput);
    this.seed = this.noise.seed;
    this.tempNoise = new SeededNoise(this.seed ^ 0x9e3779b9);
    this.moistNoise = new SeededNoise(this.seed ^ 0x85ebca6b);
    this.caveNoiseA = new SeededNoise(this.seed ^ 0xc2b2ae35);
    this.caveNoiseB = new SeededNoise(this.seed ^ 0x27d4eb2f);
    this.oreNoise = new SeededNoise(this.seed ^ 0x165667b1);
  }

  sampleColumnInfo(wx, wz) {
    const cont = this.noise.fbm2D(wx * 0.0042, wz * 0.0042, 4, 2.0, 0.5);
    const detail = this.noise.fbm2D(wx * 0.018, wz * 0.018, 3, 2.0, 0.5);
    const ridges = this.noise.ridged2D(wx * 0.0065, wz * 0.0065, 3);

    const temp = this.tempNoise.fbm2D(wx * 0.0032, wz * 0.0032, 3, 2.0, 0.5);
    const moist = this.moistNoise.fbm2D(wx * 0.0036, wz * 0.0036, 3, 2.0, 0.5);

    // Base elevation centered comfortably above sea level on continents
    let elevation = SEA_LEVEL + 6 + cont * 22 + detail * 6.5;

    // Dramatic mountain ridges on high-continental areas
    if (cont > 0.08) {
      const mountainWeight = Math.min(1, (cont - 0.08) * 2.4);
      elevation += Math.pow(ridges, 1.8) * 26 * mountainWeight;
    }

    // Gentle spawn basin protection near origin so (0,0) isn't deep ocean
    const distOrigin = Math.hypot(wx, wz);
    if (distOrigin < 28) {
      const t = 1 - distOrigin / 28;
      elevation = elevation * (1 - t * 0.55) + (SEA_LEVEL + 7) * (t * 0.55);
    }

    const height = Math.max(4, Math.min(CHUNK_HEIGHT - 12, Math.floor(elevation)));

    let biome = BIOMES.PLAINS;
    if (height < SEA_LEVEL - 1) {
      biome = BIOMES.OCEAN;
    } else if (height <= SEA_LEVEL + 1 && temp > -0.26) {
      biome = BIOMES.BEACH;
    } else if (temp < -0.26) {
      biome = BIOMES.TAIGA;
    } else if (temp > 0.24 && moist < -0.04) {
      biome = BIOMES.DESERT;
    } else if (temp > 0.28 && moist >= -0.04) {
      biome = BIOMES.MESA;
    } else if (moist > 0.1) {
      biome = BIOMES.FOREST;
    } else {
      biome = BIOMES.PLAINS;
    }

    return { height, biome, temp, moist };
  }

  getBiomeAt(wx, wz) {
    return this.sampleColumnInfo(wx, wz).biome;
  }

  generateChunkData(cx, cz) {
    const voxels = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const idx = (lx, y, lz) => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

    const colHeights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const colBiomes = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const colTemps = new Float32Array(CHUNK_SIZE * CHUNK_SIZE);

    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    // Pass 1: Terrain strata, water, caves, and ores
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const cIdx = lz * CHUNK_SIZE + lx;
        const info = this.sampleColumnInfo(wx, wz);
        const h = info.height;
        const biome = info.biome;

        colHeights[cIdx] = h;
        colBiomes[cIdx] = biome;
        colTemps[cIdx] = info.temp;

        const maxY = Math.max(h, SEA_LEVEL);
        for (let y = 0; y <= maxY; y++) {
          if (y === 0) {
            voxels[idx(lx, y, lz)] = BLOCK.BEDROCK;
            continue;
          }
          if (y === 1 && hashCoords2D(wx, wz, this.seed) < 0.5) {
            voxels[idx(lx, y, lz)] = BLOCK.BEDROCK;
            continue;
          }

          if (y > h) {
            // Ocean / lake water fill
            if (y === SEA_LEVEL && info.temp < -0.32) {
              voxels[idx(lx, y, lz)] = BLOCK.ICE;
            } else {
              voxels[idx(lx, y, lz)] = BLOCK.WATER;
            }
            continue;
          }

          // Check 3D spaghetti + cavern caves
          const allowSurfaceOpening = h > SEA_LEVEL + 3;
          if (y > 3 && (y < h - 3 || (allowSurfaceOpening && y <= h))) {
            const c1 = this.caveNoiseA.noise3D(wx * 0.045, y * 0.055, wz * 0.045);
            const c2 = this.caveNoiseB.noise3D(wx * 0.045 + 31.7, y * 0.055 - 19.3, wz * 0.045 + 11.1);
            const tunnel = c1 * c1 + c2 * c2;
            if (tunnel < 0.016) {
              voxels[idx(lx, y, lz)] = BLOCK.AIR;
              continue;
            }
          }

          // Surface & subsurface block assignment
          let blockId = BLOCK.STONE;
          if (y === h) {
            if (h < SEA_LEVEL - 1) {
              const r = hashCoords2D(wx, wz, this.seed + 7);
              blockId = r < 0.25 ? BLOCK.CLAY : r < 0.55 ? BLOCK.SAND : BLOCK.GRAVEL;
            } else if (biome === BIOMES.BEACH || biome === BIOMES.DESERT) {
              blockId = BLOCK.SAND;
            } else if (biome === BIOMES.MESA) {
              blockId = y > SEA_LEVEL + 10 ? BLOCK.TERRACOTTA : BLOCK.RED_SAND;
            } else if (biome === BIOMES.TAIGA) {
              blockId = y > 56 ? BLOCK.SNOW_BLOCK : BLOCK.SNOW_GRASS;
            } else if (y > 62) {
              blockId = y > 68 ? BLOCK.SNOW_BLOCK : BLOCK.STONE;
            } else {
              blockId = BLOCK.GRASS;
            }
          } else if (y >= h - 3) {
            if (biome === BIOMES.DESERT || biome === BIOMES.BEACH) {
              blockId = y === h - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
            } else if (biome === BIOMES.MESA) {
              blockId = BLOCK.TERRACOTTA;
            } else if (y > 62) {
              blockId = BLOCK.STONE;
            } else {
              blockId = BLOCK.DIRT;
            }
          } else if (biome === BIOMES.DESERT && y >= h - 6) {
            blockId = BLOCK.SANDSTONE;
          } else if (biome === BIOMES.MESA && y >= h - 9) {
            blockId = BLOCK.TERRACOTTA;
          } else {
            // Underground Stone + Ore Veins
            blockId = this.pickUndergroundBlock(wx, y, wz, biome);
          }

          voxels[idx(lx, y, lz)] = blockId;
        }
      }
    }

    // Pass 2: Rare cave glowstone crystals on cave ceilings
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        if (hashCoords2D(baseX + lx, baseZ + lz, this.seed + 501) > 0.018) continue;
        for (let y = 10; y < 32; y++) {
          if (voxels[idx(lx, y, lz)] === BLOCK.AIR && voxels[idx(lx, y + 1, lz)] === BLOCK.STONE) {
            voxels[idx(lx, y, lz)] = BLOCK.GLOWSTONE;
            break;
          }
        }
      }
    }

    // Pass 3: Trees, Cacti, and Flora (kept safely inside chunk margins 2..13 for canopies)
    for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
      const wz = baseZ + lz;
      for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
        const wx = baseX + lx;
        const cIdx = lz * CHUNK_SIZE + lx;
        const h = colHeights[cIdx];
        if (h <= SEA_LEVEL) continue;

        const surfaceBlock = voxels[idx(lx, h, lz)];
        if (surfaceBlock === BLOCK.AIR || voxels[idx(lx, h + 1, lz)] !== BLOCK.AIR) continue;

        const biome = colBiomes[cIdx];
        const r = hashCoords2D(wx, wz, this.seed + 101);

        // Trees inside safe canopy margin
        const canPlaceTree = lx >= 2 && lx <= CHUNK_SIZE - 3 && lz >= 2 && lz <= CHUNK_SIZE - 3 && h < CHUNK_HEIGHT - 12;

        if (canPlaceTree && (surfaceBlock === BLOCK.GRASS || surfaceBlock === BLOCK.SNOW_GRASS)) {
          const treeChance =
            biome === BIOMES.FOREST ? 0.055 :
            biome === BIOMES.TAIGA ? 0.042 :
            biome === BIOMES.PLAINS ? 0.008 : 0;

          if (r < treeChance) {
            if (biome === BIOMES.TAIGA) {
              this.placeSpruceTree(voxels, idx, lx, h + 1, lz, wx, wz);
            } else if (biome === BIOMES.FOREST && hashCoords2D(wx, wz, this.seed + 202) < 0.36) {
              this.placeOakOrBirchTree(voxels, idx, lx, h + 1, lz, wx, wz, true);
            } else {
              this.placeOakOrBirchTree(voxels, idx, lx, h + 1, lz, wx, wz, false);
            }
            continue;
          }
        }

        // Desert / Mesa Cacti & Shrubs
        if (biome === BIOMES.DESERT || biome === BIOMES.MESA) {
          if ((surfaceBlock === BLOCK.SAND || surfaceBlock === BLOCK.RED_SAND) && r < 0.014) {
            // Ensure neighbor cells are empty so cacti stand cleanly
            if (
              voxels[idx(lx - 1, h + 1, lz)] === BLOCK.AIR &&
              voxels[idx(lx + 1, h + 1, lz)] === BLOCK.AIR &&
              voxels[idx(lx, h + 1, lz - 1)] === BLOCK.AIR &&
              voxels[idx(lx, h + 1, lz + 1)] === BLOCK.AIR
            ) {
              const cactusH = 2 + Math.floor(hashCoords2D(wx, wz, this.seed + 303) * 2);
              for (let cy = 1; cy <= cactusH; cy++) {
                if (h + cy < CHUNK_HEIGHT) voxels[idx(lx, h + cy, lz)] = BLOCK.CACTUS;
              }
              continue;
            }
          }
          if (r > 0.972) {
            voxels[idx(lx, h + 1, lz)] = BLOCK.DEAD_BUSH;
          }
          continue;
        }

        // Meadow & Forest wildflowers, tall grass, and mushrooms
        if (surfaceBlock === BLOCK.GRASS) {
          const fRoll = hashCoords2D(wx, wz, this.seed + 404);
          if (fRoll < 0.11) {
            voxels[idx(lx, h + 1, lz)] = BLOCK.TALL_GRASS;
          } else if (fRoll < 0.128) {
            voxels[idx(lx, h + 1, lz)] = BLOCK.DANDELION;
          } else if (fRoll < 0.143) {
            voxels[idx(lx, h + 1, lz)] = BLOCK.POPPY;
          } else if (biome === BIOMES.FOREST && fRoll > 0.992) {
            voxels[idx(lx, h + 1, lz)] = BLOCK.MUSHROOM_RED;
          }
        } else if (surfaceBlock === BLOCK.SNOW_GRASS && r > 0.985) {
          voxels[idx(lx, h + 1, lz)] = BLOCK.DEAD_BUSH;
        }
      }
    }

    // Pass 4: Rare Wayfarer Ruin Shrine (1 in ~30 land chunks)
    const ruinRoll = hashCoords2D(cx, cz, this.seed + 777);
    if (ruinRoll < 0.034 && Math.abs(cx) + Math.abs(cz) >= 1) {
      this.tryPlaceWayfarerRuin(voxels, idx, colHeights, colBiomes);
    }

    return voxels;
  }

  pickUndergroundBlock(wx, y, wz, biome) {
    const nCoal = this.oreNoise.noise3D(wx * 0.14, y * 0.14, wz * 0.14);
    if (y >= 6 && y <= 68 && nCoal > 0.64) return BLOCK.COAL_ORE;

    const nIron = this.oreNoise.noise3D(wx * 0.16 + 47.2, y * 0.16 + 13.8, wz * 0.16 - 29.1);
    if (y >= 5 && y <= 54 && nIron > 0.67) return BLOCK.IRON_ORE;

    const goldMaxY = biome === BIOMES.MESA ? 52 : 28;
    const nGold = this.oreNoise.noise3D(wx * 0.18 - 81.4, y * 0.18 + 61.2, wz * 0.18 + 19.7);
    if (y >= 4 && y <= goldMaxY && nGold > 0.72) return BLOCK.GOLD_ORE;

    if (y >= 3 && y <= 16) {
      const nDia = this.oreNoise.noise3D(wx * 0.2 + 112.5, y * 0.2 - 44.3, wz * 0.2 + 73.9);
      if (nDia > 0.75) return BLOCK.DIAMOND_ORE;
    }

    // Occasional underground gravel pockets
    if (hashCoords3D(wx >> 2, y >> 2, wz >> 2, this.seed + 99) < 0.03) {
      return BLOCK.GRAVEL;
    }

    return BLOCK.STONE;
  }

  placeOakOrBirchTree(voxels, idx, lx, baseY, lz, wx, wz, isBirch) {
    const logBlock = isBirch ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
    const leafBlock = isBirch ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;
    const trunkH = 4 + Math.floor(hashCoords2D(wx, wz, this.seed + 601) * 2.5);

    // Replace grass beneath trunk with dirt
    if (baseY > 1) voxels[idx(lx, baseY - 1, lz)] = BLOCK.DIRT;

    for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
      const y = baseY + dy;
      if (y <= 0 || y >= CHUNK_HEIGHT) continue;
      const radius = dy >= trunkH ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
            if (dy >= trunkH || hashCoords3D(wx + dx, y, wz + dz, this.seed) < 0.45) continue;
          }
          const tx = lx + dx;
          const tz = lz + dz;
          if (tx < 0 || tx >= CHUNK_SIZE || tz < 0 || tz >= CHUNK_SIZE) continue;
          if (voxels[idx(tx, y, tz)] === BLOCK.AIR) {
            voxels[idx(tx, y, tz)] = leafBlock;
          }
        }
      }
    }

    for (let dy = 0; dy < trunkH; dy++) {
      if (baseY + dy < CHUNK_HEIGHT) {
        voxels[idx(lx, baseY + dy, lz)] = logBlock;
      }
    }
  }

  placeSpruceTree(voxels, idx, lx, baseY, lz, wx, wz) {
    const trunkH = 6 + Math.floor(hashCoords2D(wx, wz, this.seed + 605) * 3);
    if (baseY > 1) voxels[idx(lx, baseY - 1, lz)] = BLOCK.DIRT;

    for (let dy = 2; dy <= trunkH + 1; dy++) {
      const y = baseY + dy;
      if (y >= CHUNK_HEIGHT) continue;
      const radius = dy === trunkH + 1 ? 0 : dy === trunkH ? 1 : dy % 2 === 0 ? 2 : 1;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const tx = lx + dx;
          const tz = lz + dz;
          if (tx < 0 || tx >= CHUNK_SIZE || tz < 0 || tz >= CHUNK_SIZE) continue;
          if (voxels[idx(tx, y, tz)] === BLOCK.AIR) {
            voxels[idx(tx, y, tz)] = BLOCK.SPRUCE_LEAVES;
          }
        }
      }
    }

    for (let dy = 0; dy < trunkH; dy++) {
      if (baseY + dy < CHUNK_HEIGHT) {
        voxels[idx(lx, baseY + dy, lz)] = BLOCK.SPRUCE_LOG;
      }
    }
  }

  tryPlaceWayfarerRuin(voxels, idx, colHeights, colBiomes) {
    const cx = 8;
    const cz = 8;
    const cIdx = cz * CHUNK_SIZE + cx;
    const h = colHeights[cIdx];
    const biome = colBiomes[cIdx];
    if (h <= SEA_LEVEL + 2 || h > 58 || biome === BIOMES.OCEAN) return;

    // Check flatness across 5x5 footprint
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nh = colHeights[(cz + dz) * CHUNK_SIZE + (cx + dx)];
        if (Math.abs(nh - h) > 1) return;
      }
    }

    // Lay mossy/stone brick floor
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        const b = (dx + dz) % 2 === 0 ? BLOCK.STONE_BRICKS : BLOCK.MOSSY_STONE_BRICKS;
        voxels[idx(cx + dx, h, cz + dz)] = b;
        // Clear flora above floor
        for (let y = h + 1; y <= h + 4; y++) {
          voxels[idx(cx + dx, y, cz + dz)] = BLOCK.AIR;
        }
      }
    }

    // Corner pillars of varying ruined heights
    const pillars = [
      [-2, -2, 3],
      [2, -2, 2],
      [-2, 2, 2],
      [2, 2, 4],
    ];
    for (const [dx, dz, ph] of pillars) {
      for (let dy = 1; dy <= ph; dy++) {
        voxels[idx(cx + dx, h + dy, cz + dz)] =
          dy === ph ? BLOCK.MOSSY_STONE_BRICKS : BLOCK.STONE_BRICKS;
      }
    }

    // Place a helpful Crafting Table and glowing Torch in the ruin!
    voxels[idx(cx - 1, h + 1, cz)] = BLOCK.CRAFTING_TABLE;
    voxels[idx(cx, h + 1, cz)] = BLOCK.TORCH;
  }
}
