import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, BIOMES } from '../constants.js';
import { BLOCK_IDS, ITEM_IDS } from '../data/blocks.js';
import { SeededNoise, hashStringToSeed, coordHash2D, coordHash3D } from '../math/noise.js';

export class TerrainGenerator {
  constructor(seedInput = 'voxelwild') {
    this.seedString = String(seedInput);
    this.seed = hashStringToSeed(this.seedString);

    this.continentNoise = new SeededNoise(this.seed ^ 0x1a2b3c4d);
    this.detailNoise = new SeededNoise(this.seed ^ 0x5f6e7d8c);
    this.tempNoise = new SeededNoise(this.seed ^ 0x2468ace1);
    this.humidNoise = new SeededNoise(this.seed ^ 0x97531fdb);
    this.caveNoiseA = new SeededNoise(this.seed ^ 0x31415926);
    this.caveNoiseB = new SeededNoise(this.seed ^ 0x27182818);
    this.oreNoise = new SeededNoise(this.seed ^ 0xdeadbeef);
  }

  getClimate(wx, wz) {
    // Smooth macro biome fields
    const temp = 0.5 + 0.5 * this.tempNoise.fbm2D(wx * 0.0018, wz * 0.0018, 3, 2.0, 0.5);
    const humidity = 0.5 + 0.5 * this.humidNoise.fbm2D(wx * 0.0021 + 31.7, wz * 0.0021 - 19.3, 3, 2.0, 0.5);
    return { temp, humidity };
  }

  getSurfaceInfo(wx, wz) {
    const { temp, humidity } = this.getClimate(wx, wz);

    // Continentalness [-1, 1] with gentle bias toward playable land near origin
    const distFromOrigin = Math.hypot(wx, wz);
    const spawnLandBoost = distFromOrigin < 72 ? (1.0 - distFromOrigin / 72) * 0.32 : 0;

    const continent = this.continentNoise.fbm2D(wx * 0.0032, wz * 0.0032, 4, 2.0, 0.5) + spawnLandBoost;
    const hills = this.detailNoise.fbm2D(wx * 0.011, wz * 0.011, 4, 2.05, 0.48);
    const micro = this.detailNoise.noise2D(wx * 0.045, wz * 0.045);
    const ridge = this.continentNoise.ridged2D(wx * 0.0048 + 100, wz * 0.0048 - 100, 4);

    let heightFloat = SEA_LEVEL + 6;

    if (continent < -0.18) {
      // Ocean basin
      const depthFactor = Math.min(1.0, (-0.18 - continent) / 0.55);
      heightFloat = SEA_LEVEL - 2 - depthFactor * 20 + hills * 3.5;
    } else if (continent < 0.28) {
      // Coastal to rolling plains/forests/deserts
      const landT = (continent + 0.18) / 0.46; // 0..1
      heightFloat = (SEA_LEVEL - 1) + landT * 17 + hills * 7.5 + micro * 1.4;
    } else {
      // Highland & Alpine Mountains
      const mountT = Math.min(1.0, (continent - 0.28) / 0.45);
      const peakBoost = Math.pow(ridge, 1.7) * 38 * mountT;
      heightFloat = SEA_LEVEL + 16 + mountT * 16 + peakBoost + hills * 8.5 + micro * 2.0;
    }

    const height = Math.max(6, Math.min(WORLD_HEIGHT - 12, Math.floor(heightFloat)));

    // Classify Biome
    let biome = BIOMES.PLAINS;
    if (height < SEA_LEVEL - 1) {
      biome = BIOMES.OCEAN;
    } else if (height <= SEA_LEVEL + 2 && temp >= 0.32 && continent < 0.12) {
      biome = BIOMES.BEACH;
    } else if (height >= 76 || (continent > 0.36 && ridge > 0.66)) {
      biome = BIOMES.PEAKS;
    } else if (temp < 0.33) {
      biome = BIOMES.TAIGA;
    } else if (temp > 0.67 && humidity < 0.40) {
      biome = BIOMES.DESERT;
    } else if (humidity > 0.52) {
      biome = BIOMES.FOREST;
    } else {
      biome = BIOMES.PLAINS;
    }

    return { height, biome, temp, humidity, continent };
  }

  getBiomeAt(wx, wz) {
    return this.getSurfaceInfo(wx, wz).biome;
  }

  isCave(wx, y, wz, surfaceHeight) {
    if (y <= 2 || y > surfaceHeight) return false;
    // Protect ocean floors from draining water into caves
    if (surfaceHeight <= SEA_LEVEL + 2 && y > surfaceHeight - 6) return false;

    // 3D spaghetti tunnels
    const scale = 0.036;
    const n1 = this.caveNoiseA.noise3D(wx * scale, y * scale * 1.35, wz * scale);
    const n2 = this.caveNoiseB.noise3D(wx * scale + 47.2, y * scale * 1.35, wz * scale - 29.8);
    const tunnel = (n1 * n1 + n2 * n2) < 0.0155;

    // Deeper atmospheric caverns
    let cavern = false;
    if (y < 42) {
      const c = this.caveNoiseA.fbm3D(wx * 0.024, y * 0.032, wz * 0.024, 2);
      cavern = c > 0.56;
    }

    // Near surface, narrow entrance threshold slightly so hillsides get natural cave mouths without swiss-cheesing meadows
    if (y > surfaceHeight - 5) {
      return (n1 * n1 + n2 * n2) < 0.0095 && surfaceHeight > SEA_LEVEL + 7;
    }

    return tunnel || cavern;
  }

  pickStoneOrOre(wx, y, wz) {
    // Stratified ore veins via 3D noise + hash clustering
    if (y <= 17) {
      const d = this.oreNoise.noise3D(wx * 0.14 + 210, y * 0.14, wz * 0.14 - 90);
      if (d > 0.755) return BLOCK_IDS.DIAMOND_ORE;
    }
    if (y <= 32) {
      const g = this.oreNoise.noise3D(wx * 0.12 - 80, y * 0.12 + 40, wz * 0.12 + 120);
      if (g > 0.735) return BLOCK_IDS.GOLD_ORE;
    }
    if (y <= 66) {
      const ir = this.oreNoise.noise3D(wx * 0.105 + 15, y * 0.105 - 50, wz * 0.105 + 33);
      if (ir > 0.685) return BLOCK_IDS.IRON_ORE;
    }
    if (y <= 92) {
      const co = this.oreNoise.noise3D(wx * 0.09 - 140, y * 0.09 + 11, wz * 0.09 - 65);
      if (co > 0.65) return BLOCK_IDS.COAL_ORE;
    }
    if (y <= 54) {
      const gr = this.oreNoise.noise3D(wx * 0.07 + 300, y * 0.07, wz * 0.07 + 300);
      if (gr > 0.72) return BLOCK_IDS.GRAVEL;
    }
    return BLOCK_IDS.STONE;
  }

  generateChunk(chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    const surfaceHeights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const surfaceBiomes = new Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const info = this.getSurfaceInfo(wx, wz);
        const colIdx = (lz << 4) | lx;
        surfaceHeights[colIdx] = info.height;
        surfaceBiomes[colIdx] = info.biome;

        const h = info.height;
        const biome = info.biome;

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          if (y === 0) {
            chunk.setBlockGenerated(lx, y, lz, BLOCK_IDS.BEDROCK);
            continue;
          }
          if (y === 1 && coordHash3D(wx, y, wz, this.seed) < 0.65) {
            chunk.setBlockGenerated(lx, y, lz, BLOCK_IDS.BEDROCK);
            continue;
          }

          if (y <= h) {
            if (this.isCave(wx, y, wz, h)) {
              if (y <= 10) {
                chunk.setBlockGenerated(lx, y, lz, BLOCK_IDS.LAVA);
              } else if (y <= 22 && coordHash3D(wx, y, wz, this.seed ^ 0x777) < 0.0025) {
                chunk.setBlockGenerated(lx, y, lz, BLOCK_IDS.GLOWSTONE);
              }
              continue;
            }

            let blockId = BLOCK_IDS.STONE;
            if (y === h) {
              if (h < SEA_LEVEL - 1) {
                const patch = coordHash2D(wx >> 2, wz >> 2, this.seed ^ 0x55);
                blockId = patch < 0.22 ? BLOCK_IDS.CLAY : patch < 0.52 ? BLOCK_IDS.GRAVEL : BLOCK_IDS.SAND;
              } else if (biome === BIOMES.BEACH || biome === BIOMES.DESERT) {
                blockId = BLOCK_IDS.SAND;
              } else if (biome === BIOMES.TAIGA) {
                blockId = BLOCK_IDS.SNOW_GRASS;
              } else if (biome === BIOMES.PEAKS) {
                blockId = h >= 86 ? BLOCK_IDS.SNOW : h >= 78 ? BLOCK_IDS.STONE : BLOCK_IDS.GRASS;
              } else {
                blockId = BLOCK_IDS.GRASS;
              }
            } else if (y >= h - 3) {
              if (biome === BIOMES.DESERT || biome === BIOMES.BEACH) {
                blockId = y === h - 3 ? BLOCK_IDS.SANDSTONE : BLOCK_IDS.SAND;
              } else if (biome === BIOMES.PEAKS && h >= 80) {
                blockId = h >= 90 ? BLOCK_IDS.SNOW : BLOCK_IDS.STONE;
              } else {
                blockId = BLOCK_IDS.DIRT;
              }
            } else if (biome === BIOMES.DESERT && y >= h - 6) {
              blockId = BLOCK_IDS.SANDSTONE;
            } else {
              blockId = this.pickStoneOrOre(wx, y, wz);
            }

            chunk.setBlockGenerated(lx, y, lz, blockId);
          } else if (y <= SEA_LEVEL) {
            if (y === SEA_LEVEL && biome === BIOMES.TAIGA) {
              chunk.setBlockGenerated(lx, y, lz, BLOCK_IDS.ICE);
            } else {
              chunk.setBlockGenerated(lx, y, lz, BLOCK_IDS.WATER);
            }
          }
        }
      }
    }

    // Pass 2: Seamless Cross-Chunk Trees & Cacti
    this.populateTrees(chunk, baseX, baseZ);

    // Pass 3: Surface Flora (Grass, Flowers, Berry Bushes, Reeds, Mushrooms)
    this.populateFlora(chunk, baseX, baseZ, surfaceHeights, surfaceBiomes);

    // Pass 4: Rare Explorer Ruin with Loot Chest
    this.populateRuinIfPresent(chunk, baseX, baseZ, surfaceHeights, surfaceBiomes);

    chunk.generated = true;
    chunk.dirtyLight = true;
    chunk.dirtyMesh = true;
  }

  setIfInChunk(chunk, baseX, baseZ, wx, y, wz, blockId, onlyReplaceAirOrLeaves = false, meta = 0) {
    const lx = wx - baseX;
    const lz = wz - baseZ;
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT - 1) {
      return;
    }
    if (onlyReplaceAirOrLeaves) {
      const existing = chunk.getBlock(lx, y, lz);
      if (
        existing !== BLOCK_IDS.AIR &&
        existing !== BLOCK_IDS.OAK_LEAVES &&
        existing !== BLOCK_IDS.BIRCH_LEAVES &&
        existing !== BLOCK_IDS.SPRUCE_LEAVES &&
        existing !== BLOCK_IDS.TALL_GRASS
      ) {
        return;
      }
    }
    chunk.setBlockGenerated(lx, y, lz, blockId, meta);
  }

  populateTrees(chunk, baseX, baseZ) {
    // Deterministic 5x5 world grid cells with 3-block margin around chunk
    const cellSize = 5;
    const minCellX = Math.floor((baseX - 3) / cellSize);
    const maxCellX = Math.floor((baseX + CHUNK_SIZE + 3) / cellSize);
    const minCellZ = Math.floor((baseZ - 3) / cellSize);
    const maxCellZ = Math.floor((baseZ + CHUNK_SIZE + 3) / cellSize);

    for (let cz = minCellZ; cz <= maxCellZ; cz++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        const r1 = coordHash2D(cx, cz, this.seed ^ 0x1111);
        const r2 = coordHash2D(cx, cz, this.seed ^ 0x2222);
        const r3 = coordHash2D(cx, cz, this.seed ^ 0x3333);

        const wx = cx * cellSize + Math.floor(r1 * cellSize);
        const wz = cz * cellSize + Math.floor(r2 * cellSize);
        const info = this.getSurfaceInfo(wx, wz);
        const h = info.height;

        if (h <= SEA_LEVEL + 1 || h >= WORLD_HEIGHT - 14) continue;
        if (this.isCave(wx, h, wz, h)) continue;

        const biome = info.biome;
        let density = 0;
        if (biome === BIOMES.FOREST) density = 0.44;
        else if (biome === BIOMES.TAIGA) density = 0.34;
        else if (biome === BIOMES.PLAINS) density = 0.055;
        else if (biome === BIOMES.DESERT) density = 0.07;
        else if (biome === BIOMES.PEAKS && h < 82) density = 0.05;

        if (r3 >= density) continue;

        // Check slope isn't an extreme cliff
        const hEast = this.getSurfaceInfo(wx + 1, wz).height;
        const hNorth = this.getSurfaceInfo(wx, wz + 1).height;
        if (Math.abs(h - hEast) > 2 || Math.abs(h - hNorth) > 2) continue;

        if (biome === BIOMES.DESERT) {
          // Cactus column (height 2..3) when clear horizontally
          const cHeight = 2 + Math.floor(r1 * 2.5);
          for (let dy = 1; dy <= cHeight; dy++) {
            this.setIfInChunk(chunk, baseX, baseZ, wx, h + dy, wz, BLOCK_IDS.CACTUS, true);
          }
          continue;
        }

        if (biome === BIOMES.TAIGA || biome === BIOMES.PEAKS) {
          // Conical Spruce Pine
          const trunkH = 6 + Math.floor(r1 * 3);
          for (let dy = 2; dy <= trunkH + 1; dy++) {
            const layerFromTop = trunkH + 1 - dy;
            const radius = layerFromTop <= 1 ? 1 : (dy % 2 === 0 ? 2 : 1);
            for (let dz = -radius; dz <= radius; dz++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius > 1) continue;
                this.setIfInChunk(chunk, baseX, baseZ, wx + dx, h + dy, wz + dz, BLOCK_IDS.SPRUCE_LEAVES, true);
              }
            }
          }
          this.setIfInChunk(chunk, baseX, baseZ, wx, h + trunkH + 2, wz, BLOCK_IDS.SPRUCE_LEAVES, true);
          for (let dy = 1; dy <= trunkH; dy++) {
            this.setIfInChunk(chunk, baseX, baseZ, wx, h + dy, wz, BLOCK_IDS.SPRUCE_LOG, false);
          }
        } else {
          // Oak or Birch Tree
          const isBirch = biome === BIOMES.FOREST && r2 > 0.62;
          const logId = isBirch ? BLOCK_IDS.BIRCH_LOG : BLOCK_IDS.OAK_LOG;
          const leafId = isBirch ? BLOCK_IDS.BIRCH_LEAVES : BLOCK_IDS.OAK_LEAVES;
          const trunkH = 4 + Math.floor(r1 * 2.6);

          for (let dy = trunkH - 1; dy <= trunkH + 2; dy++) {
            const radius = dy >= trunkH + 1 ? 1 : 2;
            for (let dz = -radius; dz <= radius; dz++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
                  if (dy >= trunkH + 1 || coordHash3D(wx + dx, h + dy, wz + dz, this.seed) < 0.45) {
                    continue;
                  }
                }
                this.setIfInChunk(chunk, baseX, baseZ, wx + dx, h + dy, wz + dz, leafId, true);
              }
            }
          }
          for (let dy = 1; dy <= trunkH; dy++) {
            this.setIfInChunk(chunk, baseX, baseZ, wx, h + dy, wz, logId, false);
          }
        }
      }
    }
  }

  populateFlora(chunk, baseX, baseZ, surfaceHeights, surfaceBiomes) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const colIdx = (lz << 4) | lx;
        const h = surfaceHeights[colIdx];
        const biome = surfaceBiomes[colIdx];

        if (h < SEA_LEVEL || h >= WORLD_HEIGHT - 3) continue;
        const ground = chunk.getBlock(lx, h, lz);
        const above = chunk.getBlock(lx, h + 1, lz);
        if (above !== BLOCK_IDS.AIR) continue;

        const r = coordHash2D(wx, wz, this.seed ^ 0x89ab);

        // Shore reeds next to water!
        if (
          (ground === BLOCK_IDS.SAND || ground === BLOCK_IDS.GRASS || ground === BLOCK_IDS.DIRT) &&
          h === SEA_LEVEL &&
          r < 0.085
        ) {
          const nearWater =
            (lx > 0 && chunk.getBlock(lx - 1, SEA_LEVEL, lz) === BLOCK_IDS.WATER) ||
            (lx < 15 && chunk.getBlock(lx + 1, SEA_LEVEL, lz) === BLOCK_IDS.WATER) ||
            (lz > 0 && chunk.getBlock(lx, SEA_LEVEL, lz - 1) === BLOCK_IDS.WATER) ||
            (lz < 15 && chunk.getBlock(lx, SEA_LEVEL, lz + 1) === BLOCK_IDS.WATER);
          if (nearWater) {
            const reedH = 2 + (r < 0.04 ? 1 : 0);
            for (let dy = 1; dy <= reedH; dy++) {
              if (chunk.getBlock(lx, h + dy, lz) === BLOCK_IDS.AIR) {
                chunk.setBlockGenerated(lx, h + dy, lz, BLOCK_IDS.REEDS);
              }
            }
            continue;
          }
        }

        if (ground === BLOCK_IDS.GRASS) {
          if (biome === BIOMES.PLAINS) {
            if (r < 0.14) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.TALL_GRASS);
            else if (r < 0.158) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.YELLOW_FLOWER);
            else if (r < 0.172) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.RED_FLOWER);
            else if (r < 0.178) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.BERRY_BUSH);
          } else if (biome === BIOMES.FOREST) {
            if (r < 0.11) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.TALL_GRASS);
            else if (r < 0.125) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.RED_FLOWER);
            else if (r < 0.136) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.MUSHROOM);
            else if (r < 0.146) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.BERRY_BUSH);
          }
        } else if (ground === BLOCK_IDS.SNOW_GRASS) {
          if (r < 0.025) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.BERRY_BUSH);
          else if (r < 0.04) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.MUSHROOM);
        } else if (ground === BLOCK_IDS.SAND && biome === BIOMES.DESERT) {
          if (r < 0.018) chunk.setBlockGenerated(lx, h + 1, lz, BLOCK_IDS.DEAD_BUSH);
        }
      }
    }
  }

  populateRuinIfPresent(chunk, baseX, baseZ, surfaceHeights, surfaceBiomes) {
    // Roughly 1 in 28 chunks on flat land has an ancient Explorer Shrine with a Chest & Torch
    const chance = coordHash2D(chunk.cx, chunk.cz, this.seed ^ 0x424242);
    if (chance > 0.036) return;

    const lx = 6;
    const lz = 6;
    const h = surfaceHeights[(lz << 4) | lx];
    const biome = surfaceBiomes[(lz << 4) | lx];
    if (h <= SEA_LEVEL + 2 || h > 76 || biome === BIOMES.OCEAN) return;

    // Verify relatively level 5x5 footprint
    const hCorner = surfaceHeights[((lz + 4) << 4) | (lx + 4)];
    if (Math.abs(h - hCorner) > 2) return;

    const isDesert = biome === BIOMES.DESERT;
    const floorBlock = isDesert ? BLOCK_IDS.SANDSTONE : BLOCK_IDS.STONE_BRICKS;
    const accentBlock = isDesert ? BLOCK_IDS.SANDSTONE : BLOCK_IDS.MOSSY_COBBLE;

    for (let dz = 0; dz < 5; dz++) {
      for (let dx = 0; dx < 5; dx++) {
        // Foundation down 3 blocks so it never floats
        for (let fy = h - 2; fy <= h; fy++) {
          chunk.setBlockGenerated(
            lx + dx,
            fy,
            lz + dz,
            (dx + dz) % 3 === 0 ? accentBlock : floorBlock
          );
        }
        // Clear interior air
        for (let ay = h + 1; ay <= h + 4; ay++) {
          chunk.setBlockGenerated(lx + dx, ay, lz + dz, BLOCK_IDS.AIR);
        }
      }
    }

    // Corner weathered pillars
    const corners = [[0, 0, 3], [4, 0, 2], [0, 4, 2], [4, 4, 3]];
    for (const [dx, dz, ph] of corners) {
      for (let py = 1; py <= ph; py++) {
        chunk.setBlockGenerated(lx + dx, h + py, lz + dz, py === ph ? accentBlock : floorBlock);
      }
    }

    // Guiding Torch + Explorer Loot Chest in the center!
    chunk.setBlockGenerated(lx + 4, h + 3, lz, BLOCK_IDS.TORCH);
    chunk.setBlockGenerated(lx + 2, h + 1, lz + 2, BLOCK_IDS.CHEST, 2);
  }

  generateRuinLoot(wx, y, wz) {
    const slots = new Array(18).fill(null);
    const r = coordHash3D(wx, y, wz, this.seed ^ 0x9999);
    slots[0] = { id: ITEM_IDS.BREAD, count: 2 + Math.floor(r * 3) };
    slots[2] = { id: BLOCK_IDS.TORCH, count: 6 };
    slots[4] = { id: ITEM_IDS.IRON_INGOT, count: 1 + Math.floor((r * 7) % 3) };
    slots[7] = { id: ITEM_IDS.APPLE, count: 2 };
    slots[10] = { id: ITEM_IDS.COAL, count: 4 + Math.floor((r * 13) % 5) };
    if (r > 0.62) {
      slots[13] = { id: ITEM_IDS.GOLD_INGOT, count: 2 };
    }
    if (r > 0.85) {
      slots[8] = { id: ITEM_IDS.DIAMOND, count: 1 };
    }
    return slots;
  }

  findSafeSpawn() {
    // Spiral search from (0,0) for dry scenic land above sea level
    for (let radius = 0; radius <= 160; radius += 4) {
      const steps = radius === 0 ? 1 : Math.max(8, radius * 2);
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const wx = Math.round(Math.cos(angle) * radius);
        const wz = Math.round(Math.sin(angle) * radius);
        const info = this.getSurfaceInfo(wx, wz);
        if (
          info.height > SEA_LEVEL + 1 &&
          info.height < 76 &&
          info.biome !== BIOMES.OCEAN &&
          !this.isCave(wx, info.height, wz, info.height)
        ) {
          return { x: wx + 0.5, y: info.height + 2.05, z: wz + 0.5 };
        }
      }
    }
    const fallback = this.getSurfaceInfo(0, 0);
    return { x: 0.5, y: Math.max(SEA_LEVEL + 2, fallback.height + 2.05), z: 0.5 };
  }
}
