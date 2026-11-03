import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, LAVA_LEVEL, voxelIndex } from './constants.js';
import { SimplexNoise, hashSeed, coordHash2D, coordHash3D } from '../utils/noise.js';
import { BLOCK } from './blocks.js';
import { BIOME, BIOME_INFO, classifyBiome } from './biomes.js';

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export class WorldGenerator {
  constructor(seedInput = 'TerraCraft') {
    this.seedString = String(seedInput);
    this.seed = hashSeed(this.seedString);
    this.continentNoise = new SimplexNoise(this.seed ^ 0x1a2b3c4d);
    this.detailNoise = new SimplexNoise(this.seed ^ 0x5f6e7d8c);
    this.ridgeNoise = new SimplexNoise(this.seed ^ 0x2c3b4a59);
    this.tempNoise = new SimplexNoise(this.seed ^ 0x91827364);
    this.humidNoise = new SimplexNoise(this.seed ^ 0x456789ab);
    this.caveNoiseA = new SimplexNoise(this.seed ^ 0xdeadbeef);
    this.caveNoiseB = new SimplexNoise(this.seed ^ 0x13579bdf);
    this.oreNoise = new SimplexNoise(this.seed ^ 0x2468ace0);
  }

  // Pure deterministic column query used by terrain, cross-chunk trees, and spawn finder
  sampleColumn(wx, wz) {
    const warpX = this.detailNoise.noise2D(wx * 0.008, wz * 0.008) * 14;
    const warpZ = this.detailNoise.noise2D(wx * 0.008 + 97.3, wz * 0.008 - 51.7) * 14;
    const sx = wx + warpX;
    const sz = wz + warpZ;

    const cont = this.continentNoise.fbm2D(sx * 0.0038, sz * 0.0038, 4, 2.0, 0.5); // [-1,1]
    const hills = this.detailNoise.fbm2D(wx * 0.014, wz * 0.014, 3, 2.05, 0.5);
    const micro = this.detailNoise.noise2D(wx * 0.055, wz * 0.055);
    const ridge = this.ridgeNoise.ridged2D(sx * 0.0052, sz * 0.0052, 4, 2.1, 0.52);

    const temp = this.tempNoise.fbm2D(sx * 0.0024 + 31.1, sz * 0.0024 - 19.4, 3, 2.0, 0.5);
    const humidity = this.humidNoise.fbm2D(sx * 0.0028 - 73.2, sz * 0.0028 + 41.8, 3, 2.0, 0.5);

    const mountainMask = smoothstep(0.18, 0.65, cont) * smoothstep(0.45, 0.85, ridge);

    // Smooth elevation synthesis
    let baseH = SEA_LEVEL + 4 + cont * 12 + hills * 5.5 + micro * 1.4;
    // Carve gentle river/lake basins when cont is low
    if (cont < -0.15) {
      baseH -= smoothstep(-0.15, -0.65, cont) * 9.0;
    }
    // Add dramatic alpine peaks smoothly
    baseH += mountainMask * (18 + ridge * 18);

    // Desert sand dune ripples
    if (temp > 0.3 && humidity < -0.05 && baseH > SEA_LEVEL) {
      const duneMask = smoothstep(0.3, 0.5, temp) * smoothstep(-0.05, -0.25, humidity);
      const dune = Math.abs(Math.sin(wx * 0.06 + hills * 2.2 + wz * 0.035)) * 3.5;
      baseH += dune * duneMask;
    }

    const height = Math.max(4, Math.min(CHUNK_HEIGHT - 12, Math.floor(baseH)));
    const biome = classifyBiome(height, SEA_LEVEL, temp, humidity, mountainMask);

    return { height, biome, temp, humidity, mountainMask };
  }

  getBiomeInfoAt(wx, wz) {
    const col = this.sampleColumn(Math.floor(wx), Math.floor(wz));
    return BIOME_INFO[col.biome] || BIOME_INFO[BIOME.MEADOWS];
  }

  isCave(wx, y, wz, surfaceY) {
    if (y <= 1 || y > surfaceY + 1) return false;

    // 3D Spaghetti tunnels (intersection of two low-threshold ridged fields)
    const a = this.caveNoiseA.noise3D(wx * 0.038, y * 0.052, wz * 0.038);
    const b = this.caveNoiseB.noise3D(wx * 0.038 + 43.7, y * 0.052 + 19.3, wz * 0.038 - 27.1);
    const tunnel = (a * a + b * b) < 0.019;

    // Deeper vaulted caverns below y = 26
    let cavern = false;
    if (y < 26 && y < surfaceY - 5) {
      const c = this.caveNoiseA.fbm3D(wx * 0.025, y * 0.035, wz * 0.025, 2);
      cavern = c > 0.56;
    }

    // Protect shallow ocean/lake beds from draining water everywhere
    if (surfaceY <= SEA_LEVEL + 1 && y >= surfaceY - 4) {
      return false;
    }

    // Near surface, only allow occasional hillside entrances
    if (y >= surfaceY - 3) {
      const entrance = this.caveNoiseB.noise2D(wx * 0.02, wz * 0.02) > 0.42;
      return tunnel && entrance && surfaceY > SEA_LEVEL + 3;
    }

    return tunnel || cavern;
  }

  generateChunk(chunk) {
    const { cx, cz, voxels } = chunk;
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const cols = new Array(CHUNK_SIZE * CHUNK_SIZE);

    // Pass 1: Terrain strata, caves, ores, and water/lava levels
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx;
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz;
        const col = this.sampleColumn(wx, wz);
        cols[lx * CHUNK_SIZE + lz] = col;
        const { height, biome } = col;

        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const idx = voxelIndex(lx, y, lz);

          if (y === 0) {
            voxels[idx] = BLOCK.BEDROCK;
            continue;
          }
          if (y === 1 && coordHash2D(wx, wz, this.seed) < 0.55) {
            voxels[idx] = BLOCK.BEDROCK;
            continue;
          }

          if (y > height) {
            if (y <= SEA_LEVEL) {
              if (y === SEA_LEVEL && biome === BIOME.ALPINE) {
                voxels[idx] = BLOCK.ICE;
              } else {
                voxels[idx] = BLOCK.WATER;
              }
            } else {
              voxels[idx] = BLOCK.AIR;
            }
            continue;
          }

          // Cave carving
          if (this.isCave(wx, y, wz, height)) {
            voxels[idx] = y <= LAVA_LEVEL ? BLOCK.LAVA : BLOCK.AIR;
            continue;
          }

          // Surface & Subsurface block selection
          let block = BLOCK.STONE;
          if (y === height) {
            if (height < SEA_LEVEL - 1) {
              const r = this.oreNoise.noise2D(wx * 0.09, wz * 0.09);
              block = r > 0.45 ? BLOCK.CLAY : r < -0.35 ? BLOCK.GRAVEL : BLOCK.SAND;
            } else if (biome === BIOME.BEACH) {
              block = coordHash2D(wx, wz, this.seed + 5) < 0.08 ? BLOCK.GRAVEL : BLOCK.SAND;
            } else if (biome === BIOME.DESERT) {
              block = BLOCK.SAND;
            } else if (biome === BIOME.ALPINE) {
              if (height > 64) block = BLOCK.SNOW_BLOCK;
              else if (height > 54 && coordHash2D(wx, wz, this.seed + 9) < 0.35) block = BLOCK.STONE;
              else block = BLOCK.SNOW_GRASS;
            } else if (biome === BIOME.TAIGA) {
              block = this.oreNoise.noise2D(wx * 0.08, wz * 0.08) > 0.25 ? BLOCK.PODZOL : BLOCK.GRASS;
            } else {
              block = height <= SEA_LEVEL ? BLOCK.SAND : BLOCK.GRASS;
            }
          } else if (y >= height - 3) {
            if (biome === BIOME.DESERT || biome === BIOME.BEACH || height <= SEA_LEVEL) {
              block = y === height - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
            } else if (biome === BIOME.ALPINE && height > 62) {
              block = BLOCK.STONE;
            } else {
              block = BLOCK.DIRT;
            }
          } else {
            // Deep rock + Ore veins
            const deepBlend = y < 14 && (y < 10 || coordHash3D(wx, y, wz, this.seed + 3) < 0.5);
            block = deepBlend ? BLOCK.DEEPSLATE : BLOCK.STONE;

            const oreVal = this.oreNoise.noise3D(wx * 0.14, y * 0.14, wz * 0.14);
            const oreVal2 = this.oreNoise.noise3D(wx * 0.16 + 71.4, y * 0.16 - 33.8, wz * 0.16 + 12.9);

            if (y <= 16 && oreVal > 0.77) {
              block = BLOCK.CRYSTAL_ORE;
            } else if (y <= 26 && oreVal2 > 0.75) {
              block = BLOCK.GOLD_ORE;
            } else if (y <= 50 && oreVal < -0.70) {
              block = BLOCK.IRON_ORE;
            } else if (y >= 6 && y <= 66 && oreVal2 < -0.66) {
              block = BLOCK.COAL_ORE;
            }
          }

          voxels[idx] = block;
        }
      }
    }

    // Pass 2: Underground bioluminescent glowshrooms & mossy boulders
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const wx = baseX + lx;
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const wz = baseZ + lz;
        const { height, biome } = cols[lx * CHUNK_SIZE + lz];

        // Cave floor glowshrooms
        for (let y = LAVA_LEVEL + 2; y < Math.min(32, height - 4); y++) {
          const idx = voxelIndex(lx, y, lz);
          if (voxels[idx] === BLOCK.AIR) {
            const below = voxels[voxelIndex(lx, y - 1, lz)];
            if ((below === BLOCK.STONE || below === BLOCK.DEEPSLATE) &&
                coordHash3D(wx, y, wz, this.seed + 77) < 0.028) {
              voxels[idx] = BLOCK.GLOWSHROOM;
            }
          }
        }

        // Surface flora & small boulders
        if (height > SEA_LEVEL && height < CHUNK_HEIGHT - 4) {
          const topIdx = voxelIndex(lx, height, lz);
          const aboveIdx = voxelIndex(lx, height + 1, lz);
          const ground = voxels[topIdx];

          if (voxels[aboveIdx] === BLOCK.AIR) {
            const r = coordHash2D(wx, wz, this.seed + 303);

            if (ground === BLOCK.GRASS || ground === BLOCK.PODZOL) {
              if (biome === BIOME.MEADOWS) {
                if (r < 0.16) voxels[aboveIdx] = BLOCK.TALL_GRASS;
                else if (r < 0.185) voxels[aboveIdx] = BLOCK.FLOWER_RED;
                else if (r < 0.208) voxels[aboveIdx] = BLOCK.FLOWER_GOLD;
                else if (r < 0.225) voxels[aboveIdx] = BLOCK.FLOWER_BLUE;
                else if (r < 0.233) voxels[aboveIdx] = BLOCK.BERRY_BUSH;
              } else if (biome === BIOME.FOREST) {
                if (r < 0.14) voxels[aboveIdx] = BLOCK.TALL_GRASS;
                else if (r < 0.156) voxels[aboveIdx] = BLOCK.MUSHROOM_RED;
                else if (r < 0.172) voxels[aboveIdx] = BLOCK.FLOWER_BLUE;
                else if (r < 0.185) voxels[aboveIdx] = BLOCK.BERRY_BUSH;
              } else if (biome === BIOME.TAIGA) {
                if (r < 0.09) voxels[aboveIdx] = BLOCK.TALL_GRASS;
                else if (r < 0.112) voxels[aboveIdx] = BLOCK.MUSHROOM_RED;
                else if (r < 0.132) voxels[aboveIdx] = BLOCK.BERRY_BUSH;
                else if (r > 0.994) voxels[aboveIdx] = BLOCK.MOSSY_COBBLE;
              }
            } else if (ground === BLOCK.SAND && biome === BIOME.DESERT) {
              if (r < 0.016 && lx > 0 && lx < 15 && lz > 0 && lz < 15) {
                const cHeight = 2 + Math.floor(coordHash2D(wx, wz, this.seed + 404) * 2);
                for (let cy = 1; cy <= cHeight && height + cy < CHUNK_HEIGHT - 2; cy++) {
                  voxels[voxelIndex(lx, height + cy, lz)] = BLOCK.CACTUS;
                }
              } else if (r > 0.975) {
                voxels[aboveIdx] = BLOCK.DEAD_BUSH;
              }
            }
          }
        }
      }
    }

    // Pass 3: Cross-chunk deterministic Trees (checks margin of 3 blocks around chunk)
    const margin = 3;
    for (let tx = baseX - margin; tx < baseX + CHUNK_SIZE + margin; tx++) {
      for (let tz = baseZ - margin; tz < baseZ + CHUNK_SIZE + margin; tz++) {
        // Space trees onto deterministic jittered 4x4 cells so canopies don't overlap messily
        const cellX = Math.floor(tx / 4);
        const cellZ = Math.floor(tz / 4);
        const jx = cellX * 4 + Math.floor(coordHash2D(cellX, cellZ, this.seed + 501) * 4);
        const jz = cellZ * 4 + Math.floor(coordHash2D(cellX, cellZ, this.seed + 502) * 4);
        if (tx !== jx || tz !== jz) continue;

        const col = this.sampleColumn(tx, tz);
        if (col.height <= SEA_LEVEL + 1 || col.height > CHUNK_HEIGHT - 14) continue;
        if (this.isCave(tx, col.height, tz, col.height)) continue;

        const chance = coordHash2D(tx, tz, this.seed + 509);
        let treeType = null;
        if (col.biome === BIOME.FOREST && chance < 0.52) {
          treeType = chance < 0.36 ? 'oak' : 'birch';
        } else if (col.biome === BIOME.MEADOWS && chance < 0.085) {
          treeType = chance < 0.06 ? 'oak' : 'birch';
        } else if (col.biome === BIOME.TAIGA && chance < 0.45) {
          treeType = 'pine';
        } else if (col.biome === BIOME.ALPINE && col.height < 58 && chance < 0.16) {
          treeType = 'pine';
        }

        if (treeType) {
          this.stampTreeInChunk(chunk, baseX, baseZ, tx, col.height + 1, tz, treeType);
        }
      }
    }

    chunk.generated = true;
  }

  stampTreeInChunk(chunk, baseX, baseZ, wx, wy, wz, type) {
    const voxels = chunk.voxels;
    const setLocal = (bx, by, bz, blockId, onlyAir = false) => {
      const lx = bx - baseX;
      const lz = bz - baseZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      if (by < 1 || by >= CHUNK_HEIGHT - 1) return;
      const idx = voxelIndex(lx, by, lz);
      const cur = voxels[idx];
      if (onlyAir && cur !== BLOCK.AIR && cur !== BLOCK.TALL_GRASS && cur !== BLOCK.SNOW_BLOCK) {
        return;
      }
      voxels[idx] = blockId;
    };

    const hVar = coordHash2D(wx, wz, this.seed + 610);

    if (type === 'pine') {
      const trunkH = 6 + Math.floor(hVar * 3);
      for (let i = 0; i < trunkH; i++) {
        setLocal(wx, wy + i, wz, BLOCK.PINE_LOG, false);
      }
      // Tiered conical spruce needles
      for (let layer = 2; layer <= trunkH + 1; layer++) {
        const radius = layer === trunkH + 1 ? 0 : layer >= trunkH - 1 ? 1 : (layer % 2 === 0 ? 2 : 1);
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            if (dx === 0 && dz === 0 && layer < trunkH) continue;
            setLocal(wx + dx, wy + layer, wz + dz, BLOCK.PINE_LEAVES, true);
          }
        }
      }
      setLocal(wx, wy + trunkH, wz, BLOCK.PINE_LEAVES, true);
    } else {
      const logBlock = type === 'birch' ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
      const leafBlock = type === 'birch' ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;
      const trunkH = 4 + Math.floor(hVar * 3);

      for (let i = 0; i < trunkH; i++) {
        setLocal(wx, wy + i, wz, logBlock, false);
      }

      for (let ly = trunkH - 2; ly <= trunkH + 1; ly++) {
        const radius = ly >= trunkH ? 1 : 2;
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
              if (ly === trunkH + 1 || coordHash3D(wx + dx, wy + ly, wz + dz, this.seed) > 0.45) {
                continue;
              }
            }
            if (dx === 0 && dz === 0 && ly < trunkH) continue;
            setLocal(wx + dx, wy + ly, wz + dz, leafBlock, true);
          }
        }
      }
    }
  }

  findSpawnPoint() {
    // Search outward in spiral around (0, 0) for pleasant dry meadow/forest ground above sea level
    for (let r = 0; r <= 96; r += 4) {
      const steps = Math.max(1, r * 2);
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const wx = Math.round(Math.cos(angle) * r);
        const wz = Math.round(Math.sin(angle) * r);
        const col = this.sampleColumn(wx, wz);
        if (
          col.height > SEA_LEVEL + 1 &&
          col.height < 48 &&
          (col.biome === BIOME.MEADOWS || col.biome === BIOME.FOREST || col.biome === BIOME.BEACH)
        ) {
          return { x: wx + 0.5, y: col.height + 2.2, z: wz + 0.5 };
        }
      }
    }
    const fallback = this.sampleColumn(0, 0);
    return { x: 0.5, y: Math.max(SEA_LEVEL + 2, fallback.height + 2.2), z: 0.5 };
  }
}
