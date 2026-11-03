// Procedural Biome, Terrain, Cave, Ore, Tree & Landmark Generator
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, BIOMES } from './constants.js';
import { BLOCK } from './items.js';

export class TerrainGenerator {
  constructor(noise) {
    this.noise = noise;
  }

  // Sample climate & biome + target surface height at world (wx, wz)
  sampleColumn(wx, wz) {
    const n = this.noise;

    // Domain warp for organic coastlines and biome transitions
    const warpX = n.noise2D(wx * 0.012, wz * 0.012) * 14.0;
    const warpZ = n.noise2D(wx * 0.012 + 47.3, wz * 0.012 - 31.7) * 14.0;
    const sx = wx + warpX;
    const sz = wz + warpZ;

    let cont = n.fbm2D(sx * 0.0042, sz * 0.0042, 4, 2.0, 0.5);
    // Gently ensure spawn area around (0,0) has welcoming land nearby
    const distOrigin = Math.hypot(wx, wz);
    if (distOrigin < 36) {
      const boost = (1.0 - distOrigin / 36) * 0.28;
      cont = Math.max(cont, -0.05) + boost;
    }

    const temp = n.fbm2D(sx * 0.0031 + 113.0, sz * 0.0031 - 79.0, 3, 2.0, 0.5);
    const humid = n.fbm2D(sx * 0.0041 - 211.0, sz * 0.0041 + 157.0, 3, 2.0, 0.5);
    const detail = n.fbm2D(wx * 0.024, wz * 0.024, 3, 2.0, 0.5);
    const ridge = n.ridged2D(sx * 0.0065 + 31.0, sz * 0.0065 - 19.0, 4, 2.1, 0.52);

    // Base elevation from continentalness
    let height = SEA_LEVEL + cont * 20.0 + detail * 4.5;

    // Mountain uplift when inland & high ridge
    const mountainFactor = Math.max(0, (cont - 0.12) * 1.65) * Math.max(0, ridge - 0.35);
    height += mountainFactor * 44.0;

    const surfaceY = Math.max(4, Math.min(CHUNK_HEIGHT - 12, Math.round(height)));

    // Classify biome
    let biome;
    if (surfaceY <= SEA_LEVEL + 2 && cont < 0.03 && temp > -0.24) {
      biome = BIOMES.SHORE;
    } else if (mountainFactor > 0.26 || surfaceY >= 58) {
      biome = BIOMES.MOUNTAINS;
    } else if (temp < -0.24) {
      biome = BIOMES.TAIGA;
    } else if (temp > 0.27 && humid < 0.12) {
      biome = BIOMES.DESERT;
    } else if (humid > 0.06) {
      biome = BIOMES.FOREST;
    } else {
      biome = BIOMES.PLAINS;
    }

    return { surfaceY, biome, temp, humid, cont, ridge };
  }

  getBiomeAt(wx, wz) {
    return this.sampleColumn(wx, wz).biome;
  }

  generateChunkData(cx, cz) {
    const blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;
    const n = this.noise;

    const idx = (lx, y, lz) => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

    const colInfo = new Array(CHUNK_SIZE * CHUNK_SIZE);

    // Pass 1: Base terrain strata, caves, water/ice, and ores
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const info = this.sampleColumn(wx, wz);
        colInfo[lz * CHUNK_SIZE + lx] = info;
        const { surfaceY, biome } = info;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (y === 0) {
            blocks[idx(lx, y, lz)] = BLOCK.BEDROCK;
            continue;
          }
          if (y === 1 && n.hash3(wx, y, wz, 7) < 0.55) {
            blocks[idx(lx, y, lz)] = BLOCK.BEDROCK;
            continue;
          }

          if (y > surfaceY) {
            if (y <= SEA_LEVEL) {
              if (y === SEA_LEVEL && biome === BIOMES.TAIGA) {
                blocks[idx(lx, y, lz)] = BLOCK.ICE;
              } else {
                blocks[idx(lx, y, lz)] = BLOCK.WATER;
              }
            }
            continue;
          }

          // Check 3D cave carving (spaghetti tunnels + deep chambers)
          let isCave = false;
          if (y > 2 && y <= surfaceY) {
            // Allow caves to occasionally breach hillside cliffs above sea level + 3
            const allowEntrance = y < surfaceY - 3 || (surfaceY > SEA_LEVEL + 5 && info.ridge > 0.68);
            if (allowEntrance) {
              const c1 = n.noise3D(wx * 0.042, y * 0.055, wz * 0.042);
              const c2 = n.noise3D(wx * 0.042 + 89.2, y * 0.055 - 41.7, wz * 0.042 + 23.5);
              if (c1 * c1 + c2 * c2 < 0.018) {
                isCave = true;
              } else if (y < 26) {
                const cavern = n.noise3D(wx * 0.028 - 55.0, y * 0.042, wz * 0.028 + 77.0);
                if (cavern > 0.72) isCave = true;
              }
            }
          }

          if (isCave) {
            if (y <= 6) {
              blocks[idx(lx, y, lz)] = BLOCK.LAVA;
            }
            continue;
          }

          // Determine block stratum
          let b = BLOCK.STONE;

          if (y === surfaceY) {
            if (surfaceY < SEA_LEVEL - 1) {
              b = n.hash2(wx, wz, 13) < 0.35 ? BLOCK.GRAVEL : BLOCK.SAND;
            } else if (biome === BIOMES.SHORE || biome === BIOMES.DESERT) {
              b = BLOCK.SAND;
            } else if (biome === BIOMES.TAIGA) {
              b = BLOCK.SNOW_GRASS;
            } else if (biome === BIOMES.MOUNTAINS) {
              if (y >= 64) b = BLOCK.SNOW;
              else if (y >= 54) b = n.hash2(wx, wz, 19) < 0.65 ? BLOCK.STONE : BLOCK.GRAVEL;
              else b = BLOCK.GRASS;
            } else {
              b = BLOCK.GRASS;
            }
          } else if (y >= surfaceY - 3) {
            if (biome === BIOMES.DESERT || biome === BIOMES.SHORE) {
              b = y === surfaceY - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
            } else if (biome === BIOMES.MOUNTAINS && surfaceY >= 56) {
              b = BLOCK.STONE;
            } else {
              b = BLOCK.DIRT;
            }
          } else if (biome === BIOMES.DESERT && y >= surfaceY - 6) {
            b = BLOCK.SANDSTONE;
          }

          // Stratified Ore Veins inside Stone
          if (b === BLOCK.STONE) {
            b = this.pickOre(wx, y, wz);
          }

          blocks[idx(lx, y, lz)] = b;
        }
      }
    }

    // Pass 2: Cave floor mushrooms, trees, cacti, wildflowers & rare ruins
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const { surfaceY, biome } = colInfo[lz * CHUNK_SIZE + lx];

        // Glow-cap mushrooms inside underground caves
        for (let y = 8; y < Math.min(surfaceY - 4, 40); y++) {
          if (
            blocks[idx(lx, y, lz)] === BLOCK.AIR &&
            blocks[idx(lx, y - 1, lz)] === BLOCK.STONE &&
            n.hash3(wx, y, wz, 503) < 0.014
          ) {
            blocks[idx(lx, y, lz)] = BLOCK.MUSHROOM;
          }
        }

        // Skip underwater columns for surface vegetation
        if (surfaceY <= SEA_LEVEL) continue;
        const ground = blocks[idx(lx, surfaceY, lz)];
        const aboveY = surfaceY + 1;
        if (aboveY >= CHUNK_HEIGHT - 8 || blocks[idx(lx, aboveY, lz)] !== BLOCK.AIR) continue;

        const r = n.hash2(wx, wz, 101);

        // Trees inside safe chunk bounds (2..13) so 5x5 canopies never clip at edges
        const canPlaceTree = lx >= 2 && lx <= CHUNK_SIZE - 3 && lz >= 2 && lz <= CHUNK_SIZE - 3;

        if (biome === BIOMES.FOREST && ground === BLOCK.GRASS) {
          if (canPlaceTree && r < 0.048) {
            const birch = n.hash2(wx, wz, 202) < 0.34;
            this.placeLeafyTree(blocks, idx, lx, aboveY, lz, wx, wz, birch);
            continue;
          }
          if (r > 0.72 && r < 0.87) blocks[idx(lx, aboveY, lz)] = BLOCK.TALL_GRASS;
          else if (r >= 0.87 && r < 0.895) blocks[idx(lx, aboveY, lz)] = BLOCK.RED_FLOWER;
          else if (r >= 0.895 && r < 0.915) blocks[idx(lx, aboveY, lz)] = BLOCK.MUSHROOM;
        } else if (biome === BIOMES.PLAINS && ground === BLOCK.GRASS) {
          if (canPlaceTree && r < 0.0065) {
            this.placeLeafyTree(blocks, idx, lx, aboveY, lz, wx, wz, false);
            continue;
          }
          if (r > 0.68 && r < 0.86) blocks[idx(lx, aboveY, lz)] = BLOCK.TALL_GRASS;
          else if (r >= 0.86 && r < 0.89) blocks[idx(lx, aboveY, lz)] = BLOCK.YELLOW_FLOWER;
          else if (r >= 0.89 && r < 0.915) blocks[idx(lx, aboveY, lz)] = BLOCK.RED_FLOWER;
        } else if (biome === BIOMES.TAIGA && ground === BLOCK.SNOW_GRASS) {
          if (canPlaceTree && r < 0.034) {
            this.placeSpruceTree(blocks, idx, lx, aboveY, lz, wx, wz);
            continue;
          }
        } else if (biome === BIOMES.MOUNTAINS && (ground === BLOCK.GRASS || ground === BLOCK.SNOW)) {
          if (canPlaceTree && surfaceY < 62 && r < 0.012) {
            this.placeSpruceTree(blocks, idx, lx, aboveY, lz, wx, wz);
            continue;
          }
        } else if (biome === BIOMES.DESERT && ground === BLOCK.SAND) {
          if (lx >= 1 && lx <= CHUNK_SIZE - 2 && lz >= 1 && lz <= CHUNK_SIZE - 2 && r < 0.014) {
            const ch = 2 + Math.floor(n.hash2(wx, wz, 303) * 2.5);
            // Ensure cactus has clear neighbors
            if (
              blocks[idx(lx - 1, aboveY, lz)] === BLOCK.AIR &&
              blocks[idx(lx + 1, aboveY, lz)] === BLOCK.AIR &&
              blocks[idx(lx, aboveY, lz - 1)] === BLOCK.AIR &&
              blocks[idx(lx, aboveY, lz + 1)] === BLOCK.AIR
            ) {
              for (let dy = 0; dy < ch; dy++) {
                blocks[idx(lx, aboveY + dy, lz)] = BLOCK.CACTUS;
              }
            }
          } else if (r > 0.972) {
            blocks[idx(lx, aboveY, lz)] = BLOCK.DEAD_BUSH;
          }
        }
      }
    }

    // Rare Waystone Shrine / Ruin Landmark (~1 in 32 chunks on dry land)
    if (n.hash2(cx, cz, 777) > 0.968) {
      this.tryPlaceWaystone(blocks, idx, colInfo);
    }

    return blocks;
  }

  pickOre(wx, y, wz) {
    const n = this.noise;
    // Coal (y: 5..70)
    if (y >= 5 && y <= 70) {
      const v = n.noise3D(wx * 0.15 + 11.0, y * 0.15, wz * 0.15 - 17.0);
      if (v > 0.84) return BLOCK.COAL_ORE;
    }
    // Iron (y: 4..54)
    if (y >= 4 && y <= 54) {
      const v = n.noise3D(wx * 0.16 - 43.0, y * 0.16 + 19.0, wz * 0.16 + 31.0);
      if (v > 0.88) return BLOCK.IRON_ORE;
    }
    // Glowing Luminite Crystal (y: 5..34)
    if (y >= 5 && y <= 34) {
      const v = n.noise3D(wx * 0.17 + 91.0, y * 0.17 - 27.0, wz * 0.17 - 63.0);
      if (v > 0.902) return BLOCK.CRYSTAL_ORE;
    }
    // Gold (y: 3..26)
    if (y >= 3 && y <= 26) {
      const v = n.noise3D(wx * 0.18 - 107.0, y * 0.18 + 53.0, wz * 0.18 + 83.0);
      if (v > 0.912) return BLOCK.GOLD_ORE;
    }
    // Diamond (y: 2..15)
    if (y >= 2 && y <= 15) {
      const v = n.noise3D(wx * 0.19 + 149.0, y * 0.19 - 89.0, wz * 0.19 + 127.0);
      if (v > 0.922) return BLOCK.DIAMOND_ORE;
    }
    return BLOCK.STONE;
  }

  placeLeafyTree(blocks, idx, lx, baseY, lz, wx, wz, isBirch) {
    const n = this.noise;
    const logId = isBirch ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
    const leafId = isBirch ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;
    const trunkH = 4 + Math.floor(n.hash2(wx, wz, 401) * 2.5);
    if (baseY + trunkH + 3 >= CHUNK_HEIGHT) return;

    // Set dirt under tree
    blocks[idx(lx, baseY - 1, lz)] = BLOCK.DIRT;

    for (let dy = -2; dy <= 1; dy++) {
      const y = baseY + trunkH + dy;
      const rad = dy >= 0 ? 1 : 2;
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad) {
            if (dy >= 0 || n.hash3(wx + dx, y, wz + dz, 409) < 0.45) continue;
          }
          const cur = blocks[idx(lx + dx, y, lz + dz)];
          if (cur === BLOCK.AIR || cur === BLOCK.TALL_GRASS) {
            blocks[idx(lx + dx, y, lz + dz)] = leafId;
          }
        }
      }
    }

    for (let dy = 0; dy < trunkH; dy++) {
      blocks[idx(lx, baseY + dy, lz)] = logId;
    }
  }

  placeSpruceTree(blocks, idx, lx, baseY, lz, wx, wz) {
    const n = this.noise;
    const trunkH = 6 + Math.floor(n.hash2(wx, wz, 509) * 3);
    if (baseY + trunkH + 3 >= CHUNK_HEIGHT) return;

    blocks[idx(lx, baseY - 1, lz)] = BLOCK.DIRT;

    // Conical evergreen tiers
    const topY = baseY + trunkH + 1;
    blocks[idx(lx, topY, lz)] = BLOCK.SPRUCE_LEAVES;

    for (let step = 1; step <= trunkH - 1; step++) {
      const y = topY - step;
      const rad = step === 1 ? 1 : step % 2 === 0 ? 2 : 1;
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          if (rad === 1 && Math.abs(dx) === 1 && Math.abs(dz) === 1 && step === 1) continue;
          const cur = blocks[idx(lx + dx, y, lz + dz)];
          if (cur === BLOCK.AIR) {
            blocks[idx(lx + dx, y, lz + dz)] = BLOCK.SPRUCE_LEAVES;
          }
        }
      }
    }

    for (let dy = 0; dy < trunkH; dy++) {
      blocks[idx(lx, baseY + dy, lz)] = BLOCK.SPRUCE_LOG;
    }
  }

  tryPlaceWaystone(blocks, idx, colInfo) {
    const cx = 8;
    const cz = 8;
    const center = colInfo[cz * CHUNK_SIZE + cx];
    if (center.surfaceY <= SEA_LEVEL + 2 || center.surfaceY >= CHUNK_HEIGHT - 12) return;

    // Check 3x3 flatness
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const inf = colInfo[(cz + dz) * CHUNK_SIZE + (cx + dx)];
        if (Math.abs(inf.surfaceY - center.surfaceY) > 1) return;
      }
    }

    const y0 = center.surfaceY;
    const isDesert = center.biome === BIOMES.DESERT;
    const baseBlock = isDesert ? BLOCK.SANDSTONE : BLOCK.MOSSY_COBBLESTONE;
    const pillarBlock = isDesert ? BLOCK.SANDSTONE : BLOCK.STONE_BRICKS;

    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        blocks[idx(cx + dx, y0, cz + dz)] = baseBlock;
        blocks[idx(cx + dx, y0 + 1, cz + dz)] = BLOCK.AIR;
      }
    }
    blocks[idx(cx, y0 + 1, cz)] = pillarBlock;
    blocks[idx(cx, y0 + 2, cz)] = pillarBlock;
    blocks[idx(cx, y0 + 3, cz)] = BLOCK.LANTERN;
  }
}
