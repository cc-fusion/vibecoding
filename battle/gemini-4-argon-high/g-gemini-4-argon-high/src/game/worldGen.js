import { BLOCK, BIOMES, CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL } from './constants.js';
import { SeededNoise } from './noise.js';

export class WorldGenerator {
  constructor(seed = 'VOXEL_REALMS_2026') {
    this.seed = seed;
    this.noise = new SeededNoise(seed);
    this.tempNoise = new SeededNoise(`${seed}_temp`);
    this.moistureNoise = new SeededNoise(`${seed}_moist`);
    this.caveNoise = new SeededNoise(`${seed}_cave`);
  }

  // Returns climate values and primary biome at world (wx, wz)
  getBiomeAt(wx, wz) {
    // Low-frequency temperature & moisture
    const temp = this.tempNoise.fbm2D(wx * 0.0045, wz * 0.0045, 3);
    const moist = this.moistureNoise.fbm2D(wx * 0.0045 + 91.7, wz * 0.0045 - 43.2, 3);
    const rugged = this.noise.fbm2D(wx * 0.006 - 120, wz * 0.006 + 80, 2);

    if (temp < -0.16) {
      return BIOMES.TAIGA;
    }
    if (temp > 0.18 && moist < 0.04) {
      return BIOMES.DESERT;
    }
    if (rugged > 0.22) {
      return BIOMES.HIGHLANDS;
    }
    if (moist > 0.05) {
      return BIOMES.FOREST;
    }
    return BIOMES.PLAINS;
  }

  // Smoothly blended height at (wx, wz)
  getSurfaceHeight(wx, wz) {
    const continental = this.noise.fbm2D(wx * 0.007, wz * 0.007, 4, 2.0, 0.5);
    const detail = this.noise.fbm2D(wx * 0.025, wz * 0.025, 3, 2.1, 0.48);
    const ridgeRaw = 1.0 - Math.abs(this.noise.noise2D(wx * 0.012, wz * 0.012));
    const ridge = ridgeRaw * ridgeRaw;

    const temp = this.tempNoise.fbm2D(wx * 0.0045, wz * 0.0045, 3);
    const rugged = this.noise.fbm2D(wx * 0.006 - 120, wz * 0.006 + 80, 2);

    // Mountain factor increases smoothly in cold/taiga or rugged highlands
    const mountainFactor = Math.max(0, Math.min(1, (-temp - 0.05) * 2.2, (rugged + 0.3) * 1.8));
    const highlandBoost = Math.max(0, (rugged - 0.1) * 18);

    const baseElevation = 23 + continental * 12 + detail * 5 + highlandBoost + mountainFactor * ridge * 14;
    return Math.max(6, Math.min(CHUNK_HEIGHT - 10, Math.floor(baseElevation)));
  }

  generateChunkVoxels(cx, cz) {
    const data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const index = (lx, y, lz) => y * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;

    const worldStartX = cx * CHUNK_SIZE;
    const worldStartZ = cz * CHUNK_SIZE;

    // 1. Base terrain, caves, ores, and water/ice
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = worldStartX + lx;
        const wz = worldStartZ + lz;

        const biome = this.getBiomeAt(wx, wz);
        const surfaceY = this.getSurfaceHeight(wx, wz);

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (y === 0) {
            data[index(lx, y, lz)] = BLOCK.BEDROCK;
            continue;
          }

          if (y > surfaceY) {
            if (y <= WATER_LEVEL) {
              if (y === WATER_LEVEL && biome === BIOMES.TAIGA) {
                data[index(lx, y, lz)] = BLOCK.ICE;
              } else {
                data[index(lx, y, lz)] = BLOCK.WATER;
              }
            } else {
              data[index(lx, y, lz)] = BLOCK.AIR;
            }
            continue;
          }

          // Surface & Subsurface layers
          let blockId = BLOCK.STONE;
          if (y === surfaceY) {
            if (surfaceY <= WATER_LEVEL + 1 && biome !== BIOMES.TAIGA) {
              blockId = BLOCK.SAND; // Sandy shoreline
            } else if (surfaceY > 40) {
              blockId = BLOCK.SNOW; // High alpine snowcap
            } else {
              blockId = biome.surfaceBlock;
            }
          } else if (y >= surfaceY - 3) {
            blockId = surfaceY <= WATER_LEVEL + 1 ? BLOCK.SAND : biome.subBlock;
          } else {
            // Underground stone & caves & ores
            const caveVal1 = this.caveNoise.noise3D(wx * 0.055, y * 0.075, wz * 0.055);
            const caveVal2 = this.caveNoise.noise3D(wx * 0.055 + 37, y * 0.075 + 19, wz * 0.055 - 23);
            const isCave = y > 3 && y < surfaceY - 3 && Math.abs(caveVal1) < 0.11 && Math.abs(caveVal2) < 0.11;

            if (isCave) {
              blockId = BLOCK.AIR;
            } else {
              // Deterministic Ore Veins
              const oreRoll = this.noise.hash2D(wx + y * 31, wz - y * 17, y);
              if (y < 10 && oreRoll < 0.0085) {
                blockId = BLOCK.DIAMOND_ORE;
              } else if (y < 18 && oreRoll < 0.015) {
                blockId = BLOCK.GOLD_ORE;
              } else if (y < 32 && oreRoll < 0.032) {
                blockId = BLOCK.IRON_ORE;
              } else if (oreRoll < 0.052) {
                blockId = BLOCK.COAL_ORE;
              } else if (y < 14 && oreRoll > 0.9965) {
                blockId = BLOCK.GLOWSTONE;
              } else {
                blockId = BLOCK.STONE;
              }
            }
          }

          data[index(lx, y, lz)] = blockId;
        }
      }
    }

    // 2. Trees and Cacti (keep away from chunk borders [2..13] so canopies stay clean inside chunk)
    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
        const wx = worldStartX + lx;
        const wz = worldStartZ + lz;
        // Keep a small clear landing meadow right at world origin (0,0)
        if (Math.abs(wx) < 5 && Math.abs(wz) < 5) continue;

        const biome = this.getBiomeAt(wx, wz);
        const surfaceY = this.getSurfaceHeight(wx, wz);
        if (surfaceY <= WATER_LEVEL + 1 || surfaceY >= CHUNK_HEIGHT - 11) continue;

        const groundBlock = data[index(lx, surfaceY, lz)];
        const treeRoll = this.noise.hash2D(wx, wz, 777);

        if (biome === BIOMES.DESERT && groundBlock === BLOCK.SAND) {
          if (treeRoll < biome.treeChance) {
            const cactusHeight = 2 + Math.floor(this.noise.hash2D(wx, wz, 778) * 3);
            for (let dy = 1; dy <= cactusHeight; dy++) {
              if (surfaceY + dy < CHUNK_HEIGHT) {
                data[index(lx, surfaceY + dy, lz)] = BLOCK.CACTUS;
              }
            }
          }
        } else if (
          (groundBlock === BLOCK.GRASS || groundBlock === BLOCK.SNOW_GRASS) &&
          treeRoll < biome.treeChance
        ) {
          const styleRoll = this.noise.hash2D(wx, wz, 888);
          if (biome === BIOMES.TAIGA) {
            this._placeSpruceTree(data, index, lx, surfaceY + 1, lz, wx, wz);
          } else if (styleRoll < 0.3) {
            this._placeOakOrBirchTree(data, index, lx, surfaceY + 1, lz, wx, wz, BLOCK.BIRCH_LOG);
          } else {
            this._placeOakOrBirchTree(data, index, lx, surfaceY + 1, lz, wx, wz, BLOCK.OAK_LOG);
          }
        }
      }
    }

    // 3. Place a scenic Timber & Stone Waystation in chunk (0, -1) right in front of spawn
    if (cx === 0 && cz === -1) {
      this._buildSpawnWaystation(data, index, worldStartX, worldStartZ);
    }

    return data;
  }

  // Scans outward from (startX, startZ) to find coordinates of a desired biome
  findBiomeCoordinates(targetBiomeId, startX = 0, startZ = 0) {
    if (this.getBiomeAt(startX, startZ).id === targetBiomeId) {
      return { x: startX, z: startZ };
    }
    for (let radius = 32; radius <= 1600; radius += 32) {
      for (let angleStep = 0; angleStep < 16; angleStep++) {
        const theta = (angleStep / 16) * Math.PI * 2;
        const wx = Math.round(startX + Math.cos(theta) * radius);
        const wz = Math.round(startZ + Math.sin(theta) * radius);
        if (this.getBiomeAt(wx, wz).id === targetBiomeId) {
          return { x: wx, z: wz };
        }
      }
    }
    return { x: startX + 120, z: startZ + 120 };
  }

  _buildSpawnWaystation(data, index, worldStartX, worldStartZ) {
    // Build a 7x7 cottage/watchtower at local coords lx: 4..10, lz: 4..10 (world z: -12..-6)
    const centerLx = 7;
    const centerLz = 7;
    const baseY = Math.max(WATER_LEVEL + 1, this.getSurfaceHeight(worldStartX + centerLx, worldStartZ + centerLz));
    if (baseY + 8 >= CHUNK_HEIGHT) return;

    // Foundation & Cobblestone patio
    for (let lz = 3; lz <= 11; lz++) {
      for (let lx = 3; lx <= 11; lx++) {
        for (let y = baseY - 3; y <= baseY; y++) {
          data[index(lx, y, lz)] = y === baseY && lx >= 4 && lx <= 10 && lz >= 4 && lz <= 10 ? BLOCK.PLANKS : BLOCK.COBBLESTONE;
        }
        // Clear interior & yard air above foundation
        for (let y = baseY + 1; y <= baseY + 7; y++) {
          data[index(lx, y, lz)] = BLOCK.AIR;
        }
      }
    }

    // Walls & Corner Oak Log Pillars (lx: 4..10, lz: 4..10)
    for (let y = baseY + 1; y <= baseY + 4; y++) {
      for (let lz = 4; lz <= 10; lz++) {
        for (let lx = 4; lx <= 10; lx++) {
          const isEdgeX = lx === 4 || lx === 10;
          const isEdgeZ = lz === 4 || lz === 10;
          if (!isEdgeX && !isEdgeZ) continue;

          // Front doorway facing spawn (+Z side is lz === 10)
          if (lz === 10 && lx === 7 && y <= baseY + 2) {
            data[index(lx, y, lz)] = BLOCK.AIR;
            continue;
          }

          if (isEdgeX && isEdgeZ) {
            data[index(lx, y, lz)] = BLOCK.OAK_LOG;
          } else if (y === baseY + 2 && (lx === 7 || lz === 7)) {
            data[index(lx, y, lz)] = BLOCK.GLASS;
          } else if (y === baseY + 1) {
            data[index(lx, y, lz)] = BLOCK.COBBLESTONE;
          } else {
            data[index(lx, y, lz)] = BLOCK.PLANKS;
          }
        }
      }
    }

    // Stepped Wood & Brick Roof
    for (let lz = 3; lz <= 11; lz++) {
      for (let lx = 3; lx <= 11; lx++) {
        data[index(lx, baseY + 5, lz)] = BLOCK.PLANKS;
      }
    }
    for (let lz = 5; lz <= 9; lz++) {
      for (let lx = 5; lx <= 9; lx++) {
        data[index(lx, baseY + 6, lz)] = BLOCK.BRICKS;
      }
    }

    // Interior furnishings & warm lighting
    data[index(5, baseY + 1, 5)] = BLOCK.CRAFTING_TABLE;
    data[index(6, baseY + 1, 5)] = BLOCK.FURNACE;
    data[index(9, baseY + 1, 5)] = BLOCK.BOOKSHELF;
    data[index(9, baseY + 2, 5)] = BLOCK.BOOKSHELF;
    data[index(7, baseY + 4, 7)] = BLOCK.GLOWSTONE; // Ceiling lantern

    // Exterior welcome torches flanking the front entrance
    data[index(5, baseY + 1, 11)] = BLOCK.TORCH;
    data[index(9, baseY + 1, 11)] = BLOCK.TORCH;
  }

  _placeOakOrBirchTree(data, index, lx, baseY, lz, wx, wz, logBlock) {
    const trunkHeight = 4 + Math.floor(this.noise.hash2D(wx, wz, 901) * 2);
    // Check space
    for (let y = baseY; y <= baseY + trunkHeight + 1; y++) {
      if (y >= CHUNK_HEIGHT || data[index(lx, y, lz)] !== BLOCK.AIR) return;
    }

    // Canopy
    for (let dy = trunkHeight - 2; dy <= trunkHeight + 1; dy++) {
      const radius = dy >= trunkHeight ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && this.noise.hash2D(wx + dx, wz + dz, dy) < 0.45) {
            continue;
          }
          const nx = lx + dx;
          const ny = baseY + dy;
          const nz = lz + dz;
          if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny < CHUNK_HEIGHT) {
            if (data[index(nx, ny, nz)] === BLOCK.AIR) {
              data[index(nx, ny, nz)] = BLOCK.OAK_LEAVES;
            }
          }
        }
      }
    }

    // Trunk
    for (let dy = 0; dy < trunkHeight; dy++) {
      data[index(lx, baseY + dy, lz)] = logBlock;
    }
  }

  _placeSpruceTree(data, index, lx, baseY, lz, wx, wz) {
    const trunkHeight = 6 + Math.floor(this.noise.hash2D(wx, wz, 902) * 2);
    if (baseY + trunkHeight + 2 >= CHUNK_HEIGHT) return;

    // Conical pine needles
    for (let dy = 2; dy <= trunkHeight + 1; dy++) {
      const radius = dy === trunkHeight + 1 ? 0 : dy % 2 === 0 ? 2 : 1;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const nx = lx + dx;
          const ny = baseY + dy;
          const nz = lz + dz;
          if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny < CHUNK_HEIGHT) {
            if (data[index(nx, ny, nz)] === BLOCK.AIR) {
              data[index(nx, ny, nz)] = BLOCK.SPRUCE_LEAVES;
            }
          }
        }
      }
    }

    for (let dy = 0; dy < trunkHeight; dy++) {
      data[index(lx, baseY + dy, lz)] = BLOCK.SPRUCE_LOG;
    }
  }
}
