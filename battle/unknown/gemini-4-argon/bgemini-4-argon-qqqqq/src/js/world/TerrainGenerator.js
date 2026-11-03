import { CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT } from '../constants.js';
import { BLOCK } from '../data/blocks.js';
import { ITEM } from '../data/items.js';
import { coordHash, mulberry32, SeededNoise, stringToSeed } from '../utils/Noise.js';
import { BIOME_IDS, BiomeManager } from './BiomeManager.js';

export class TerrainGenerator {
  constructor(seedInput) {
    this.seed = stringToSeed(seedInput);
    this.biomeManager = new BiomeManager(this.seed);
    this.caveNoiseA = new SeededNoise(this.seed ^ 0x77112233);
    this.caveNoiseB = new SeededNoise(this.seed ^ 0x4488ccaa);
    this.patchNoise = new SeededNoise(this.seed ^ 0x55aa9911);

    // Cache column samples so cross-chunk tree checks stay blazing fast
    this._colCache = new Map();
  }

  sampleColumnCached(wx, wz) {
    const key = `${wx},${wz}`;
    let val = this._colCache.get(key);
    if (!val) {
      if (this._colCache.size > 24000) {
        this._colCache.clear();
      }
      val = this.biomeManager.sampleColumn(wx, wz);
      this._colCache.set(key, val);
    }
    return val;
  }

  // Find a pleasant land spawn point near (0, 0)
  findSpawnPoint() {
    for (let radius = 0; radius <= 160; radius += 4) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
        const wx = Math.round(Math.cos(angle) * radius);
        const wz = Math.round(Math.sin(angle) * radius);
        const col = this.sampleColumnCached(wx, wz);
        if (col.height >= SEA_LEVEL + 2 && col.height <= 56 && col.biome.id !== BIOME_IDS.OCEAN) {
          return { x: wx + 0.5, y: col.height + 2.05, z: wz + 0.5 };
        }
      }
    }
    const fallback = this.sampleColumnCached(0, 0);
    return { x: 0.5, y: Math.max(SEA_LEVEL + 2, fallback.height + 2.05), z: 0.5 };
  }

  generateChunk(chunk, onStructureChest = null) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    // 1. Base terrain strata, caves & water/ice
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const col = this.sampleColumnCached(wx, wz);
        const surfY = col.height;
        const biome = col.biome;

        chunk.setColumnBiome(lx, lz, biome);
        chunk.heightMap[(lz << 4) | lx] = surfY;

        const patchVal = this.patchNoise.noise2D(wx * 0.08, wz * 0.08);
        const isUnderwater = surfY < SEA_LEVEL;

        for (let y = 0; y < WORLD_HEIGHT; y++) {
          if (y === 0) {
            chunk.set(lx, y, lz, BLOCK.BEDROCK);
            continue;
          }
          if (y === 1 && coordHash(wx, y, wz, this.seed) < 0.5) {
            chunk.set(lx, y, lz, BLOCK.BEDROCK);
            continue;
          }

          if (y > surfY) {
            if (y <= SEA_LEVEL) {
              if (y === SEA_LEVEL && biome.snowy) {
                chunk.set(lx, y, lz, BLOCK.ICE);
              } else {
                chunk.set(lx, y, lz, BLOCK.WATER);
              }
            }
            continue;
          }

          // Determine solid strata block
          let blockId = BLOCK.STONE;
          const depth = surfY - y;

          if (biome.id === BIOME_IDS.DESERT) {
            if (depth <= 3) blockId = BLOCK.SAND;
            else if (depth <= 7) blockId = BLOCK.SANDSTONE;
          } else if (biome.id === BIOME_IDS.BEACH || isUnderwater) {
            if (depth <= 3) {
              if (isUnderwater && surfY >= SEA_LEVEL - 5 && patchVal > 0.36) {
                blockId = BLOCK.CLAY;
              } else if (patchVal < -0.28) {
                blockId = BLOCK.GRAVEL;
              } else {
                blockId = BLOCK.SAND;
              }
            } else if (depth <= 5) {
              blockId = BLOCK.SANDSTONE;
            }
          } else if (biome.id === BIOME_IDS.MOUNTAINS) {
            if (surfY >= 66) {
              if (depth === 0) blockId = BLOCK.SNOW_BLOCK;
              else if (depth <= 2) blockId = BLOCK.SNOW_BLOCK;
            } else if (surfY >= 57 || col.mountainFactor > 0.42) {
              if (depth === 0 && patchVal > 0.25) blockId = BLOCK.GRAVEL;
              else blockId = BLOCK.STONE;
            } else {
              if (depth === 0) blockId = BLOCK.GRASS;
              else if (depth <= 3) blockId = BLOCK.DIRT;
            }
          } else if (biome.id === BIOME_IDS.SNOWY_TAIGA) {
            if (depth === 0) blockId = BLOCK.SNOW_GRASS;
            else if (depth <= 3) blockId = BLOCK.DIRT;
          } else {
            // Plains & Forest
            if (depth === 0) blockId = BLOCK.GRASS;
            else if (depth <= 3) blockId = BLOCK.DIRT;
          }

          // Carve 3D spaghetti caves safely (don't breach underwater ocean floor)
          const caveCeiling = isUnderwater ? surfY - 5 : surfY + 1;
          if (y >= 4 && y <= caveCeiling) {
            const nA = this.caveNoiseA.noise3D(wx * 0.036, y * 0.048, wz * 0.036);
            const nB = this.caveNoiseB.noise3D(wx * 0.036 + 43.1, y * 0.048, wz * 0.036 - 19.7);
            if (nA * nA + nB * nB < 0.0115) {
              continue; // Carved cave air!
            }
          }

          chunk.set(lx, y, lz, blockId);
        }
      }
    }

    // 2. Ore veins & underground pockets
    this._generateOres(chunk);

    // 3. Seamless cross-chunk trees & cacti
    this._generateTrees(chunk, baseX, baseZ);

    // 4. Surface wildflowers, tall grass, mushrooms, dead bushes
    this._generateFlora(chunk, baseX, baseZ);

    // 5. Rare Explorer Outpost / Ruined Shrine with Loot Chest
    this._generateLandmark(chunk, baseX, baseZ, onStructureChest);
  }

  _generateOres(chunk) {
    const chunkSeed = (this.seed ^ Math.imul(chunk.cx, 73856093) ^ Math.imul(chunk.cz, 19349663)) >>> 0;
    const rand = mulberry32(chunkSeed);

    const placeVein = (oreId, attempts, veinSize, minY, maxY) => {
      for (let a = 0; a < attempts; a++) {
        let vx = rand() * CHUNK_SIZE;
        let vy = minY + rand() * (maxY - minY);
        let vz = rand() * CHUNK_SIZE;
        for (let s = 0; s < veinSize; s++) {
          const ix = Math.floor(vx);
          const iy = Math.floor(vy);
          const iz = Math.floor(vz);
          if (ix >= 0 && ix < CHUNK_SIZE && iy >= 2 && iy < WORLD_HEIGHT - 1 && iz >= 0 && iz < CHUNK_SIZE) {
            if (chunk.get(ix, iy, iz) === BLOCK.STONE) {
              chunk.set(ix, iy, iz, oreId);
            }
          }
          vx += (rand() - 0.5) * 1.7;
          vy += (rand() - 0.5) * 1.4;
          vz += (rand() - 0.5) * 1.7;
        }
      }
    };

    placeVein(BLOCK.COAL_ORE, 16, 8, 6, 72);
    placeVein(BLOCK.IRON_ORE, 13, 6, 5, 54);
    placeVein(BLOCK.GOLD_ORE, 5, 5, 4, 28);
    placeVein(BLOCK.DIAMOND_ORE, 3, 4, 2, 16);
    placeVein(BLOCK.GRAVEL, 5, 10, 8, 48);
  }

  _treeSpecAt(wx, wz) {
    // Grid-jittered candidate positions every 4x4 world cells so trees never crowd into each other
    const cellX = Math.floor(wx / 4);
    const cellZ = Math.floor(wz / 4);
    const jx = cellX * 4 + Math.floor(coordHash(cellX, 11, cellZ, this.seed) * 4);
    const jz = cellZ * 4 + Math.floor(coordHash(cellX, 23, cellZ, this.seed) * 4);
    if (wx !== jx || wz !== jz) return null;

    const col = this.sampleColumnCached(wx, wz);
    if (col.height <= SEA_LEVEL + 1 || col.height >= 62) return null;

    const r = coordHash(wx, 37, wz, this.seed);
    const biomeId = col.biome.id;

    if (biomeId === BIOME_IDS.FOREST) {
      if (r > 0.42) return null;
      const type = coordHash(wx, 51, wz, this.seed) < 0.28 ? 'birch' : 'oak';
      return { type, y: col.height + 1, h: 4 + Math.floor(coordHash(wx, 61, wz, this.seed) * 3) };
    }
    if (biomeId === BIOME_IDS.PLAINS) {
      if (r > 0.045) return null;
      const type = coordHash(wx, 51, wz, this.seed) < 0.22 ? 'birch' : 'oak';
      return { type, y: col.height + 1, h: 4 + Math.floor(coordHash(wx, 61, wz, this.seed) * 2) };
    }
    if (biomeId === BIOME_IDS.SNOWY_TAIGA) {
      if (r > 0.26) return null;
      return { type: 'spruce', y: col.height + 1, h: 6 + Math.floor(coordHash(wx, 61, wz, this.seed) * 3) };
    }
    if (biomeId === BIOME_IDS.DESERT) {
      if (r > 0.065) return null;
      return { type: 'cactus', y: col.height + 1, h: 2 + Math.floor(coordHash(wx, 61, wz, this.seed) * 3) };
    }
    if (biomeId === BIOME_IDS.MOUNTAINS && col.height < 56) {
      if (r > 0.06) return null;
      return { type: 'spruce', y: col.height + 1, h: 5 + Math.floor(coordHash(wx, 61, wz, this.seed) * 2) };
    }
    return null;
  }

  _generateTrees(chunk, baseX, baseZ) {
    const margin = 3;
    const setIfInChunk = (wx, wy, wz, id, onlyReplaceAir = false) => {
      const lx = wx - baseX;
      const lz = wz - baseZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || wy < 1 || wy >= WORLD_HEIGHT - 1) return;
      if (onlyReplaceAir && chunk.get(lx, wy, lz) !== BLOCK.AIR) return;
      chunk.set(lx, wy, lz, id);
    };

    for (let wz = baseZ - margin; wz < baseZ + CHUNK_SIZE + margin; wz++) {
      for (let wx = baseX - margin; wx < baseX + CHUNK_SIZE + margin; wx++) {
        const spec = this._treeSpecAt(wx, wz);
        if (!spec) continue;

        // If trunk is inside this chunk, ensure ground below wasn't carved by a cave mouth
        const tlx = wx - baseX;
        const tlz = wz - baseZ;
        if (tlx >= 0 && tlx < CHUNK_SIZE && tlz >= 0 && tlz < CHUNK_SIZE) {
          const ground = chunk.get(tlx, spec.y - 1, tlz);
          if (ground === BLOCK.AIR || ground === BLOCK.WATER) continue;
        }

        if (spec.type === 'cactus') {
          for (let dy = 0; dy < spec.h; dy++) {
            setIfInChunk(wx, spec.y + dy, wz, BLOCK.CACTUS, false);
          }
          continue;
        }

        if (spec.type === 'spruce') {
          const logId = BLOCK.SPRUCE_LOG;
          const leafId = BLOCK.SPRUCE_LEAVES;
          for (let dy = 0; dy < spec.h; dy++) {
            setIfInChunk(wx, spec.y + dy, wz, logId, false);
          }
          // Conical pine needles
          for (let dy = 2; dy <= spec.h + 1; dy++) {
            const radius = dy >= spec.h ? 0 : (dy % 2 === 0 ? 2 : 1);
            for (let dz = -radius; dz <= radius; dz++) {
              for (let dx = -radius; dx <= radius; dx++) {
                if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
                if (dx === 0 && dz === 0 && dy < spec.h) continue;
                setIfInChunk(wx + dx, spec.y + dy, wz + dz, leafId, true);
              }
            }
          }
          setIfInChunk(wx, spec.y + spec.h, wz, leafId, true);
          continue;
        }

        // Oak or Birch canopy
        const logId = spec.type === 'birch' ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
        const leafId = spec.type === 'birch' ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;

        for (let dy = 0; dy < spec.h; dy++) {
          setIfInChunk(wx, spec.y + dy, wz, logId, false);
        }

        const canopyStart = spec.y + spec.h - 2;
        const canopyEnd = spec.y + spec.h + 1;
        for (let wy = canopyStart; wy <= canopyEnd; wy++) {
          const topLayer = wy >= spec.y + spec.h;
          const rad = topLayer ? 1 : 2;
          for (let dz = -rad; dz <= rad; dz++) {
            for (let dx = -rad; dx <= rad; dx++) {
              if (Math.abs(dx) === rad && Math.abs(dz) === rad) {
                if (topLayer && wy === canopyEnd) continue;
                if (coordHash(wx + dx, wy, wz + dz, this.seed) < 0.45) continue;
              }
              if (dx === 0 && dz === 0 && wy < spec.y + spec.h) continue;
              setIfInChunk(wx + dx, wy, wz + dz, leafId, true);
            }
          }
        }
      }
    }
  }

  _generateFlora(chunk, baseX, baseZ) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const y = chunk.heightMap[(lz << 4) | lx];
        if (y <= SEA_LEVEL || y >= WORLD_HEIGHT - 2) continue;
        if (chunk.get(lx, y + 1, lz) !== BLOCK.AIR) continue;

        const ground = chunk.get(lx, y, lz);
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const r = coordHash(wx, 99, wz, this.seed);
        const biomeId = chunk.biomeGrid[(lz << 4) | lx];

        if (ground === BLOCK.GRASS) {
          if (biomeId === BIOME_IDS.PLAINS) {
            if (r < 0.14) chunk.set(lx, y + 1, lz, BLOCK.TALL_GRASS);
            else if (r < 0.165) chunk.set(lx, y + 1, lz, BLOCK.RED_FLOWER);
            else if (r < 0.19) chunk.set(lx, y + 1, lz, BLOCK.YELLOW_FLOWER);
          } else if (biomeId === BIOME_IDS.FOREST) {
            if (r < 0.12) chunk.set(lx, y + 1, lz, BLOCK.TALL_GRASS);
            else if (r < 0.14) chunk.set(lx, y + 1, lz, BLOCK.MUSHROOM);
            else if (r < 0.155) chunk.set(lx, y + 1, lz, BLOCK.RED_FLOWER);
          }
        } else if (ground === BLOCK.SAND && biomeId === BIOME_IDS.DESERT) {
          if (r < 0.022) chunk.set(lx, y + 1, lz, BLOCK.DEAD_BUSH);
        }
      }
    }
  }

  _generateLandmark(chunk, baseX, baseZ, onStructureChest) {
    // Rare ruined explorer outpost (~1 in 30 land chunks, away from immediate origin)
    if (Math.abs(chunk.cx) <= 1 && Math.abs(chunk.cz) <= 1) return;
    const h = coordHash(chunk.cx, 777, chunk.cz, this.seed);
    if (h > 0.034) return;

    const lx = 6;
    const lz = 6;
    const biomeId = chunk.biomeGrid[(lz << 4) | lx];
    if (biomeId === BIOME_IDS.OCEAN || biomeId === BIOME_IDS.BEACH) return;

    const y0 = chunk.heightMap[(lz << 4) | lx];
    if (y0 <= SEA_LEVEL + 1 || y0 >= 64) return;

    // Check flatness across 5x5 footprint
    for (let dz = 0; dz < 5; dz++) {
      for (let dx = 0; dx < 5; dx++) {
        const hy = chunk.heightMap[((lz + dz) << 4) | (lx + dx)];
        if (Math.abs(hy - y0) > 2) return;
      }
    }

    const wallBlock = biomeId === BIOME_IDS.DESERT ? BLOCK.SANDSTONE : BLOCK.STONE_BRICKS;
    const floorBlock = biomeId === BIOME_IDS.DESERT ? BLOCK.SANDSTONE : BLOCK.COBBLESTONE;

    // Build foundation down & clear interior air
    for (let dz = 0; dz < 5; dz++) {
      for (let dx = 0; dx < 5; dx++) {
        for (let y = y0 - 3; y <= y0; y++) {
          chunk.set(lx + dx, y, lz + dz, floorBlock);
        }
        for (let y = y0 + 1; y <= y0 + 4; y++) {
          chunk.set(lx + dx, y, lz + dz, BLOCK.AIR);
        }
      }
    }

    // Weathered corner pillars & partial walls
    for (let dy = 1; dy <= 3; dy++) {
      chunk.set(lx, y0 + dy, lz, wallBlock);
      chunk.set(lx + 4, y0 + dy, lz, wallBlock);
      chunk.set(lx, y0 + dy, lz + 4, wallBlock);
      if (dy <= 2) chunk.set(lx + 4, y0 + dy, lz + 4, wallBlock);
    }
    chunk.set(lx + 1, y0 + 1, lz, wallBlock);
    chunk.set(lx + 3, y0 + 1, lz, wallBlock);
    chunk.set(lx, y0 + 1, lz + 1, wallBlock);
    chunk.set(lx, y0 + 1, lz + 3, wallBlock);

    // Place warm Torch & Explorer Loot Chest
    chunk.set(lx + 1, y0 + 1, lz + 1, BLOCK.TORCH);
    chunk.set(lx + 3, y0 + 1, lz + 3, BLOCK.CHEST);

    if (onStructureChest) {
      const rand = mulberry32((this.seed ^ (chunk.cx * 92821) ^ (chunk.cz * 68917)) >>> 0);
      const slots = new Array(27).fill(null);
      slots[0] = { id: BLOCK.TORCH, count: 6 + Math.floor(rand() * 8) };
      slots[2] = { id: ITEM.APPLE, count: 2 + Math.floor(rand() * 4) };
      slots[4] = { id: ITEM.IRON_INGOT, count: 2 + Math.floor(rand() * 4) };
      slots[10] = { id: ITEM.COAL, count: 4 + Math.floor(rand() * 8) };
      slots[13] = rand() < 0.38
        ? { id: ITEM.DIAMOND, count: 1 + Math.floor(rand() * 2) }
        : { id: ITEM.GOLD_INGOT, count: 2 + Math.floor(rand() * 3) };
      slots[16] = { id: ITEM.COOKED_PORK, count: 2 + Math.floor(rand() * 3) };
      slots[22] = { id: BLOCK.TNT, count: 2 };
      onStructureChest(baseX + lx + 3, y0 + 1, baseZ + lz + 3, slots);
    }
  }
}
