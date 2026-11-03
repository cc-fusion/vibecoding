// Multi-Biome Procedural World Generation, 3D Caves, Ore Strata, Cross-Chunk Trees & Landmarks

import { BIOMES, CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from '../constants.js';
import { BLOCK } from '../game/blocks.js';
import { SeededNoise } from '../math/noise.js';

export function chunkIndex(lx, y, lz) {
  return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
}

export class WorldGenerator {
  constructor(seed = 'TerraCraft') {
    this.seed = seed;
    this.noise = new SeededNoise(seed);
    this.tempNoise = new SeededNoise(`${seed}_temp`);
    this.humidNoise = new SeededNoise(`${seed}_humid`);
    this.caveNoise = new SeededNoise(`${seed}_caves`);
    this.oreNoise = new SeededNoise(`${seed}_ores`);
    this.columnCache = new Map();
  }

  // Sample continuous climate, biome, and terrain height at world (wx, wz)
  sampleColumn(wx, wz) {
    const key = `${wx},${wz}`;
    let cached = this.columnCache.get(key);
    if (cached) return cached;

    // Limit cache size so long journeys never leak memory
    if (this.columnCache.size > 45000) {
      this.columnCache.clear();
    }

    const continental = this.noise.fbm2D(wx * 0.0042, wz * 0.0042, 4, 2.0, 0.5);
    const detail = this.noise.fbm2D(wx * 0.019, wz * 0.019, 3, 2.1, 0.5);
    const hills = this.noise.fbm2D(wx * 0.0095 + 31.7, wz * 0.0095 - 18.4, 4, 2.0, 0.52);
    const ridges = this.noise.ridged2D(wx * 0.0068 - 54.2, wz * 0.0068 + 12.9, 4, 2.05, 0.52);

    const temperature = this.tempNoise.fbm2D(wx * 0.0034 + 105.0, wz * 0.0034 - 62.0, 3);
    const humidity = this.humidNoise.fbm2D(wx * 0.0039 - 41.0, wz * 0.0039 + 88.0, 3);

    // Sculpt elevation from ocean trenches -> beaches -> lush rolling valleys -> dramatic alpine peaks
    let height = SEA_LEVEL + 6.5 + continental * 21.0 + hills * 9.5 + detail * 3.4;

    const mountainMask = Math.max(0, (ridges - 0.52) / 0.48);
    if (mountainMask > 0 && continental > -0.18) {
      height += Math.pow(mountainMask, 1.45) * 34.0;
    }

    // Smooth river channels winding across lowlands
    const riverVal = Math.abs(this.noise.fbm2D(wx * 0.0052 + 210, wz * 0.0052 - 140, 2));
    if (riverVal < 0.055 && height < SEA_LEVEL + 16 && temperature > -0.3) {
      const t = 1.0 - riverVal / 0.055;
      height = height * (1 - t * 0.72) + (SEA_LEVEL - 3.2) * (t * 0.72);
    }

    const h = Math.max(4, Math.min(WORLD_HEIGHT - 8, Math.floor(height)));

    let biome = BIOMES.PLAINS;
    if (h < SEA_LEVEL - 2) {
      biome = BIOMES.OCEAN;
    } else if (h <= SEA_LEVEL + 2 && temperature > -0.22) {
      biome = BIOMES.BEACH;
    } else if (h >= 66 || (temperature < -0.25 && h >= 54)) {
      biome = BIOMES.PEAKS;
    } else if (temperature < -0.22) {
      biome = BIOMES.TAIGA;
    } else if (temperature > 0.24 && humidity < -0.05) {
      biome = BIOMES.DESERT;
    } else if (humidity > 0.22) {
      biome = temperature > 0.02 ? BIOMES.FOREST : BIOMES.BIRCH_GROVE;
    } else if (humidity > 0.02) {
      biome = BIOMES.MEADOW;
    } else {
      biome = BIOMES.PLAINS;
    }

    cached = { height: h, biome, temperature, humidity };
    this.columnCache.set(key, cached);
    return cached;
  }

  sampleCaveScalar(wx, y, wz) {
    const wormA = this.caveNoise.noise3D(wx * 0.042, y * 0.055, wz * 0.042);
    const wormB = this.caveNoise.noise3D(wx * 0.042 + 73.1, y * 0.055 - 29.4, wz * 0.042 + 17.8);
    let caveScore = 0.0165 - (wormA * wormA + wormB * wormB);
    if (y < 40) {
      const cavern = this.caveNoise.noise3D(wx * 0.03 - 19.2, y * 0.038, wz * 0.03 + 44.5);
      caveScore = Math.max(caveScore, cavern - 0.56);
    }
    return caveScore;
  }

  isCave(wx, y, wz, surfaceHeight) {
    if (y <= 2 || y > surfaceHeight + 1) return false;
    if (y >= surfaceHeight - 4 && surfaceHeight <= SEA_LEVEL + 3) return false;
    return this.sampleCaveScalar(wx, y, wz) > 0;
  }

  stampOreVeins(blocks, cx, cz) {
    // Rich, authentic multi-block mineral veins seeded deterministically per chunk
    const veinSpecs = [
      { block: BLOCK.COAL_ORE, count: 16, minY: 6, maxY: 74, size: 7, salt: 101 },
      { block: BLOCK.IRON_ORE, count: 11, minY: 5, maxY: 56, size: 5, salt: 202 },
      { block: BLOCK.GOLD_ORE, count: 5, minY: 4, maxY: 30, size: 4, salt: 303 },
      { block: BLOCK.DIAMOND_ORE, count: 3, minY: 2, maxY: 16, size: 4, salt: 404 },
      { block: BLOCK.GRAVEL, count: 5, minY: 8, maxY: 58, size: 9, salt: 505 },
    ];

    for (const spec of veinSpecs) {
      for (let v = 0; v < spec.count; v++) {
        const s = spec.salt + v * 17;
        let vx = Math.floor(this.noise.hash2D(cx, cz, s) * CHUNK_SIZE);
        let vy = spec.minY + Math.floor(this.noise.hash2D(cx, cz, s + 1) * (spec.maxY - spec.minY));
        let vz = Math.floor(this.noise.hash2D(cx, cz, s + 2) * CHUNK_SIZE);

        for (let b = 0; b < spec.size; b++) {
          if (vx >= 0 && vx < CHUNK_SIZE && vz >= 0 && vz < CHUNK_SIZE && vy >= 2 && vy < WORLD_HEIGHT - 2) {
            const idx = chunkIndex(vx, vy, vz);
            if (blocks[idx] === BLOCK.STONE) {
              blocks[idx] = spec.block;
            }
          }
          const dirPick = (this.noise.hash3D(vx + cx * 16, vy, vz + cz * 16, s + b) * 6) | 0;
          if (dirPick === 0) vx++;
          else if (dirPick === 1) vx--;
          else if (dirPick === 2) vy++;
          else if (dirPick === 3) vy--;
          else if (dirPick === 4) vz++;
          else vz--;
        }
      }
    }
  }

  generateChunk(cx, cz) {
    const blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const surfaceMap = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
    const biomeMap = new Array(CHUNK_SIZE * CHUNK_SIZE);

    // Pre-sample 3D cave density on a coarse 5 x 25 x 5 grid (4x4x4 trilinear cells = 20x faster!)
    const GX = 5;
    const GY = 25;
    const GZ = 5;
    const caveGrid = new Float32Array(GX * GY * GZ);
    for (let gy = 0; gy < GY; gy++) {
      const wy = gy * 4;
      for (let gz = 0; gz < GZ; gz++) {
        const wz = baseZ + gz * 4;
        for (let gx = 0; gx < GX; gx++) {
          const wx = baseX + gx * 4;
          caveGrid[(gy * GZ + gz) * GX + gx] = this.sampleCaveScalar(wx, wy, wz);
        }
      }
    }

    // Pass 1: Terrain strata, trilinearly interpolated 3D caves, and water
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      const gz0 = lz >> 2;
      const fz = (lz & 3) * 0.25;

      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const gx0 = lx >> 2;
        const fx = (lx & 3) * 0.25;

        const col = this.sampleColumn(wx, wz);
        const h = col.height;
        const biome = col.biome;
        surfaceMap[lz * CHUNK_SIZE + lx] = h;
        biomeMap[lz * CHUNK_SIZE + lx] = biome;

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          const idx = chunkIndex(lx, y, lz);

          if (y === 0) {
            blocks[idx] = BLOCK.BEDROCK;
            continue;
          }
          if (y === 1 && this.noise.hash2D(wx, wz, 55) < 0.6) {
            blocks[idx] = BLOCK.BEDROCK;
            continue;
          }

          if (y > h) {
            if (y <= SEA_LEVEL) {
              if (y === SEA_LEVEL && (biome === BIOMES.TAIGA || col.temperature < -0.28)) {
                blocks[idx] = BLOCK.ICE;
              } else {
                blocks[idx] = BLOCK.WATER;
              }
            }
            continue;
          }

          // Trilinear 3D cave lookup
          if (y > 2 && !(y >= h - 4 && h <= SEA_LEVEL + 3)) {
            const gy0 = y >> 2;
            const fy = (y & 3) * 0.25;
            const c000 = caveGrid[(gy0 * GZ + gz0) * GX + gx0];
            const c100 = caveGrid[(gy0 * GZ + gz0) * GX + (gx0 + 1)];
            const c010 = caveGrid[(gy0 * GZ + (gz0 + 1)) * GX + gx0];
            const c110 = caveGrid[(gy0 * GZ + (gz0 + 1)) * GX + (gx0 + 1)];
            const c001 = caveGrid[((gy0 + 1) * GZ + gz0) * GX + gx0];
            const c101 = caveGrid[((gy0 + 1) * GZ + gz0) * GX + (gx0 + 1)];
            const c011 = caveGrid[((gy0 + 1) * GZ + (gz0 + 1)) * GX + gx0];
            const c111 = caveGrid[((gy0 + 1) * GZ + (gz0 + 1)) * GX + (gx0 + 1)];

            const x00 = c000 + (c100 - c000) * fx;
            const x10 = c010 + (c110 - c010) * fx;
            const x01 = c001 + (c101 - c001) * fx;
            const x11 = c011 + (c111 - c011) * fx;
            const z0 = x00 + (x10 - x00) * fz;
            const z1 = x01 + (x11 - x01) * fz;
            const caveVal = z0 + (z1 - z0) * fy;

            const threshold = y >= h - 4 ? 0.004 : 0.0;
            if (caveVal > threshold) {
              if (y < h - 5 && this.noise.hash3D(wx, y, wz, 913) < 0.0085) {
                blocks[idx] = BLOCK.GLOW_CRYSTAL;
              }
              continue;
            }
          }

          // Surface & subsurface block assignment per biome
          if (y === h) {
            if (h < SEA_LEVEL - 1) {
              const r = this.noise.hash2D(wx, wz, 12);
              blocks[idx] = r < 0.24 ? BLOCK.CLAY : r < 0.55 ? BLOCK.SAND : BLOCK.GRAVEL;
            } else if (biome === BIOMES.DESERT || biome === BIOMES.BEACH) {
              blocks[idx] = BLOCK.SAND;
            } else if (biome === BIOMES.PEAKS) {
              blocks[idx] = h > 72 || col.temperature < -0.18 ? BLOCK.SNOW_BLOCK : BLOCK.STONE;
            } else if (biome === BIOMES.TAIGA) {
              blocks[idx] = BLOCK.SNOW_GRASS;
            } else {
              blocks[idx] = BLOCK.GRASS;
            }
          } else if (y >= h - 3) {
            if (biome === BIOMES.DESERT || biome === BIOMES.BEACH) {
              blocks[idx] = y === h - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
            } else if (biome === BIOMES.PEAKS && h > 70) {
              blocks[idx] = y >= h - 1 ? BLOCK.SNOW_BLOCK : BLOCK.STONE;
            } else {
              blocks[idx] = BLOCK.DIRT;
            }
          } else if (y >= h - 6 && biome === BIOMES.DESERT) {
            blocks[idx] = BLOCK.SANDSTONE;
          } else {
            blocks[idx] = BLOCK.STONE;
          }
        }
      }
    }

    // Pass 1.5: Stamp rich multi-block Coal, Iron, Gold, Diamond & Gravel veins
    this.stampOreVeins(blocks, cx, cz);

    // Pass 2: Cross-chunk deterministic trees & cacti (inspects a 3px border halo around chunk so canopies never clip!)
    const margin = 3;
    for (let wz = baseZ - margin; wz < baseZ + CHUNK_SIZE + margin; wz++) {
      for (let wx = baseX - margin; wx < baseX + CHUNK_SIZE + margin; wx++) {
        const treeSpec = this.getTreeAt(wx, wz);
        if (!treeSpec) continue;
        this.stampTree(blocks, baseX, baseZ, wx, treeSpec.y, wz, treeSpec);
      }
    }

    // Pass 3: Ground flora, wildflowers, sugar cane, mushrooms, pumpkins & occasional ruins
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const h = surfaceMap[lz * CHUNK_SIZE + lx];
        const biome = biomeMap[lz * CHUNK_SIZE + lx];
        if (h <= SEA_LEVEL || h >= WORLD_HEIGHT - 6) continue;

        const ground = blocks[chunkIndex(lx, h, lz)];
        const aboveIdx = chunkIndex(lx, h + 1, lz);
        if (blocks[aboveIdx] !== BLOCK.AIR) continue;

        const r = this.noise.hash2D(wx, wz, 404);

        // Sugar reeds beside water on sand/grass shorelines
        if (
          h === SEA_LEVEL || h === SEA_LEVEL + 1
        ) {
          if (
            (ground === BLOCK.SAND || ground === BLOCK.GRASS) &&
            r < 0.055 &&
            this.hasWaterNeighbor(wx, wz)
          ) {
            const reedH = 2 + ((this.noise.hash2D(wx, wz, 405) * 2) | 0);
            for (let ry = 1; ry <= reedH && h + ry < WORLD_HEIGHT - 1; ry++) {
              const rIdx = chunkIndex(lx, h + ry, lz);
              if (blocks[rIdx] === BLOCK.AIR) blocks[rIdx] = BLOCK.SUGAR_CANE;
            }
            continue;
          }
        }

        if (ground === BLOCK.GRASS) {
          if (biome === BIOMES.MEADOW) {
            if (r < 0.045) blocks[aboveIdx] = BLOCK.POPPY;
            else if (r < 0.095) blocks[aboveIdx] = BLOCK.DANDELION;
            else if (r < 0.135) blocks[aboveIdx] = BLOCK.BLUE_ORCHID;
            else if (r < 0.30) blocks[aboveIdx] = BLOCK.TALL_GRASS;
            else if (r > 0.9975) blocks[aboveIdx] = BLOCK.PUMPKIN;
          } else if (biome === BIOMES.PLAINS) {
            if (r < 0.18) blocks[aboveIdx] = BLOCK.TALL_GRASS;
            else if (r < 0.205) blocks[aboveIdx] = BLOCK.DANDELION;
            else if (r < 0.222) blocks[aboveIdx] = BLOCK.POPPY;
            else if (r > 0.9985) blocks[aboveIdx] = BLOCK.PUMPKIN;
          } else if (biome === BIOMES.FOREST || biome === BIOMES.BIRCH_GROVE) {
            if (r < 0.14) blocks[aboveIdx] = BLOCK.TALL_GRASS;
            else if (r < 0.165) blocks[aboveIdx] = BLOCK.RED_MUSHROOM;
            else if (r < 0.18) blocks[aboveIdx] = BLOCK.POPPY;
          }
        } else if (ground === BLOCK.SNOW_GRASS && r < 0.02) {
          blocks[aboveIdx] = BLOCK.RED_MUSHROOM;
        }
      }
    }

    // Pass 4: Rare ancient ruin / outpost chest landmark once every ~9 chunks on dry flat land
    this.maybeStampLandmark(blocks, cx, cz, surfaceMap, biomeMap);

    return blocks;
  }

  hasWaterNeighbor(wx, wz) {
    return (
      this.sampleColumn(wx + 1, wz).height < SEA_LEVEL ||
      this.sampleColumn(wx - 1, wz).height < SEA_LEVEL ||
      this.sampleColumn(wx, wz + 1).height < SEA_LEVEL ||
      this.sampleColumn(wx, wz - 1).height < SEA_LEVEL
    );
  }

  getTreeAt(wx, wz) {
    // Space candidate cells cleanly on a jittered 4x4 grid so trunks never fuse awkwardly
    const cellX = Math.floor(wx / 4);
    const cellZ = Math.floor(wz / 4);
    const jx = cellX * 4 + ((this.noise.hash2D(cellX, cellZ, 71) * 4) | 0);
    const jz = cellZ * 4 + ((this.noise.hash2D(cellX, cellZ, 72) * 4) | 0);
    if (wx !== jx || wz !== jz) return null;

    const col = this.sampleColumn(wx, wz);
    const h = col.height;
    if (h <= SEA_LEVEL + 1 || h >= WORLD_HEIGHT - 14) return null;
    if (this.isCave(wx, h, wz, h)) return null;

    const chance = this.noise.hash2D(wx, wz, 73);
    const variant = this.noise.hash2D(wx, wz, 74);

    switch (col.biome) {
      case BIOMES.FOREST:
        if (chance > 0.56) return null;
        return {
          type: variant < 0.25 ? 'birch' : 'oak',
          y: h + 1,
          height: 5 + ((variant * 3) | 0),
        };
      case BIOMES.BIRCH_GROVE:
        if (chance > 0.50) return null;
        return {
          type: variant < 0.8 ? 'birch' : 'oak',
          y: h + 1,
          height: 5 + ((variant * 3) | 0),
        };
      case BIOMES.TAIGA:
        if (chance > 0.48) return null;
        return {
          type: 'spruce',
          y: h + 1,
          height: 6 + ((variant * 4) | 0),
        };
      case BIOMES.PLAINS:
      case BIOMES.MEADOW:
        if (chance > 0.075) return null;
        return {
          type: variant < 0.3 ? 'birch' : 'oak',
          y: h + 1,
          height: 5 + ((variant * 2) | 0),
        };
      case BIOMES.DESERT:
        if (chance > 0.09) return null;
        return {
          type: 'cactus',
          y: h + 1,
          height: 2 + ((variant * 3) | 0),
        };
      default:
        return null;
    }
  }

  stampTree(blocks, baseX, baseZ, tx, ty, tz, spec) {
    const setLocal = (wx, wy, wz, blockId, overwriteAirOnly = true) => {
      const lx = wx - baseX;
      const lz = wz - baseZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      if (wy < 1 || wy >= WORLD_HEIGHT) return;
      const idx = chunkIndex(lx, wy, lz);
      if (!overwriteAirOnly || blocks[idx] === BLOCK.AIR) {
        blocks[idx] = blockId;
      }
    };

    if (spec.type === 'cactus') {
      for (let i = 0; i < spec.height; i++) {
        setLocal(tx, ty + i, tz, BLOCK.CACTUS, false);
      }
      return;
    }

    if (spec.type === 'spruce') {
      const top = ty + spec.height;
      for (let y = ty + 2; y <= top + 1; y++) {
        const distFromTop = top + 1 - y;
        const radius = distFromTop <= 1 ? (distFromTop === 0 ? 0 : 1) : (distFromTop % 2 === 0 ? 2 : 1);
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            setLocal(tx + dx, y, tz + dz, BLOCK.SPRUCE_LEAVES, true);
          }
        }
      }
      for (let i = 0; i < spec.height; i++) {
        setLocal(tx, ty + i, tz, BLOCK.SPRUCE_LOG, false);
      }
      return;
    }

    // Oak or Birch rounded canopy
    const logBlock = spec.type === 'birch' ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
    const leafBlock = spec.type === 'birch' ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;
    const canopyBase = ty + spec.height - 2;
    const canopyTop = ty + spec.height + 1;

    for (let y = canopyBase; y <= canopyTop; y++) {
      const radius = y >= canopyTop - 1 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
            if (y === canopyTop || this.noise.hash3D(tx + dx, y, tz + dz, 88) < 0.45) continue;
          }
          setLocal(tx + dx, y, tz + dz, leafBlock, true);
        }
      }
    }

    for (let i = 0; i < spec.height; i++) {
      setLocal(tx, ty + i, tz, logBlock, false);
    }
  }

  maybeStampLandmark(blocks, cx, cz, surfaceMap, biomeMap) {
    const roll = this.noise.hash2D(cx, cz, 1999);
    if (roll > 0.11) return;

    const lx = 7;
    const lz = 7;
    const h = surfaceMap[lz * CHUNK_SIZE + lx];
    const biome = biomeMap[lz * CHUNK_SIZE + lx];
    if (h <= SEA_LEVEL + 2 || h >= WORLD_HEIGHT - 10) return;
    if (biome === BIOMES.OCEAN || biome === BIOMES.BEACH) return;

    const pillarBlock = biome === BIOMES.DESERT ? BLOCK.SANDSTONE : BLOCK.STONE_BRICKS;
    const floorBlock = biome === BIOMES.DESERT ? BLOCK.SANDSTONE : BLOCK.COBBLESTONE;

    // 3x3 stone/sandstone shrine plinth + lantern + treasure chest!
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (let y = h - 2; y <= h; y++) {
          blocks[chunkIndex(lx + dx, y, lz + dz)] = floorBlock;
        }
        for (let y = h + 1; y <= h + 4; y++) {
          blocks[chunkIndex(lx + dx, y, lz + dz)] = BLOCK.AIR;
        }
      }
    }
    blocks[chunkIndex(lx - 1, h + 1, lz - 1)] = pillarBlock;
    blocks[chunkIndex(lx - 1, h + 2, lz - 1)] = pillarBlock;
    blocks[chunkIndex(lx - 1, h + 3, lz - 1)] = BLOCK.TORCH;
    blocks[chunkIndex(lx + 1, h + 1, lz + 1)] = pillarBlock;
    blocks[chunkIndex(lx, h + 1, lz)] = BLOCK.CHEST;
  }

  // Locate a scenic, safe, dry spawn point near trees and varied terrain
  findScenicSpawn() {
    let best = { x: 8.5, y: SEA_LEVEL + 10, z: 8.5, score: -Infinity };
    for (let radius = 0; radius <= 128; radius += 8) {
      const steps = radius === 0 ? 1 : 16;
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const wx = Math.round(Math.cos(angle) * radius);
        const wz = Math.round(Math.sin(angle) * radius);
        const col = this.sampleColumn(wx, wz);
        if (col.height <= SEA_LEVEL + 2 || col.height > 62) continue;

        let score = 40 - radius * 0.08;
        if (
          col.biome === BIOMES.MEADOW ||
          col.biome === BIOMES.PLAINS ||
          col.biome === BIOMES.FOREST
        ) {
          score += 35;
        }
        // Prefer overlooks near water and hills for a gorgeous initial vista!
        const n1 = this.sampleColumn(wx + 24, wz).height;
        const n2 = this.sampleColumn(wx - 24, wz).height;
        const n3 = this.sampleColumn(wx, wz + 24).height;
        const relief = Math.max(n1, n2, n3) - Math.min(n1, n2, n3);
        score += Math.min(25, relief);

        if (score > best.score) {
          best = { x: wx + 0.5, y: col.height + 2.05, z: wz + 0.5, score };
        }
      }
    }
    return { x: best.x, y: best.y, z: best.z };
  }
}
