import { CHUNK_SIZE, WORLD_HEIGHT, SEA_LEVEL, BIOMES } from './constants.js';
import { BLOCK } from './blocks.js';
import { NoiseGenerator } from './noise.js';

export class TerrainGenerator {
  constructor(seed) {
    this.seed = seed;
    this.noise = new NoiseGenerator(seed);
  }

  sampleColumnInfo(wx, wz) {
    const n = this.noise;

    // Macro climate fields
    const temp = n.fbm2D(wx * 0.0048 + 120.5, wz * 0.0048 - 84.2, 3, 2.0, 0.5);
    const moisture = n.fbm2D(wx * 0.0052 - 210.3, wz * 0.0052 + 63.8, 3, 2.0, 0.5);

    // Continentalness & mountain ridges
    const continent = n.fbm2D(wx * 0.0042, wz * 0.0042, 4, 2.0, 0.5);
    const detail = n.fbm2D(wx * 0.018, wz * 0.018, 3, 2.1, 0.48);
    const ridge = n.ridged2D(wx * 0.0065 + 45.0, wz * 0.0065 - 32.0, 4, 2.1, 0.5);

    // Smooth elevation curve
    let heightFloat = SEA_LEVEL + 6 + continent * 22 + detail * 6.5;

    // Dramatic mountain amplification where continent & ridge align
    const mountainMask = Math.max(0, (continent + 0.12) * 1.15) * Math.max(0, ridge - 0.36);
    heightFloat += mountainMask * 68.0;

    // Gentle valley/river carving
    const riverNoise = Math.abs(n.noise2D(wx * 0.0058 + 310, wz * 0.0058 - 190));
    if (riverNoise < 0.055 && continent > -0.15 && mountainMask < 0.22) {
      const t = 1.0 - riverNoise / 0.055;
      heightFloat = heightFloat * (1 - t * 0.65) + (SEA_LEVEL - 2.5) * (t * 0.65);
    }

    const height = Math.max(4, Math.min(WORLD_HEIGHT - 12, Math.floor(heightFloat)));

    // Determine biome
    let biome = BIOMES.PLAINS;
    if (height <= SEA_LEVEL - 2) {
      biome = BIOMES.OCEAN;
    } else if (height >= 76 || temp < -0.28) {
      biome = height >= 70 || moisture < 0.05 ? BIOMES.ALPINE : BIOMES.TAIGA;
    } else if (temp < -0.08 && moisture > -0.1) {
      biome = BIOMES.TAIGA;
    } else if (temp > 0.24 && moisture < -0.06) {
      biome = BIOMES.DESERT;
    } else if (moisture > 0.16) {
      biome = temp > 0.08 ? BIOMES.BIRCH : BIOMES.FOREST;
    } else {
      biome = BIOMES.PLAINS;
    }

    return { height, biome, temp, moisture, ridge };
  }

  getBiomeAt(wx, wz) {
    return this.sampleColumnInfo(wx, wz).biome;
  }

  generateChunk(cx, cz) {
    const blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const biomeGrid = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const heightGrid = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);

    const idx = (lx, y, lz) => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
    const n = this.noise;
    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    // 1. Base terrain strata, 3D caves, water & deep lava
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const colInfo = this.sampleColumnInfo(wx, wz);
        const surfY = colInfo.height;
        const biome = colInfo.biome;

        biomeGrid[lz * CHUNK_SIZE + lx] = biome;
        heightGrid[lz * CHUNK_SIZE + lx] = surfY;

        blocks[idx(lx, 0, lz)] = BLOCK.BEDROCK;

        for (let y = 1; y <= Math.max(surfY, SEA_LEVEL); y++) {
          if (y > surfY) {
            if (y === SEA_LEVEL && (biome === BIOMES.ALPINE || (biome === BIOMES.TAIGA && colInfo.temp < -0.22))) {
              blocks[idx(lx, y, lz)] = BLOCK.ICE;
            } else {
              blocks[idx(lx, y, lz)] = BLOCK.WATER;
            }
            continue;
          }

          // 3D Cave carving (spaghetti tunnels + deep chambers)
          let carved = false;
          if (y > 2 && (y < surfY - 3 || (surfY > SEA_LEVEL + 5 && colInfo.ridge > 0.52))) {
            const c1 = n.noise3D(wx * 0.042, y * 0.055, wz * 0.042);
            const c2 = n.noise3D(wx * 0.042 + 73.1, y * 0.055 - 41.7, wz * 0.042 + 19.4);
            const tunnel = c1 * c1 + c2 * c2;
            const cavern = y < 34 ? n.noise3D(wx * 0.028 - 50, y * 0.038, wz * 0.028 + 50) : 0;
            if (tunnel < 0.0082 || cavern > 0.56) {
              // Avoid draining ocean directly into caves right beneath seabed
              if (!(surfY <= SEA_LEVEL + 1 && y >= surfY - 4)) {
                carved = true;
              }
            }
          }

          if (carved) {
            blocks[idx(lx, y, lz)] = y <= 8 ? BLOCK.LAVA : BLOCK.AIR;
            continue;
          }

          // Surface & Subsurface Composition
          let blockId = BLOCK.STONE;
          const isCoast = surfY >= SEA_LEVEL - 2 && surfY <= SEA_LEVEL + 2 && biome !== BIOMES.ALPINE && biome !== BIOMES.TAIGA;

          if (y === surfY) {
            if (surfY < SEA_LEVEL - 1) {
              const r = n.coordRand(wx, y, wz, 11);
              blockId = r < 0.22 ? BLOCK.CLAY : (r < 0.52 ? BLOCK.GRAVEL : BLOCK.SAND);
            } else if (biome === BIOMES.DESERT || isCoast) {
              blockId = BLOCK.SAND;
            } else if (biome === BIOMES.ALPINE) {
              blockId = surfY > 86 ? BLOCK.SNOW : (colInfo.ridge > 0.64 ? BLOCK.STONE : BLOCK.SNOW_GRASS);
            } else if (biome === BIOMES.TAIGA && colInfo.temp < -0.2) {
              blockId = BLOCK.SNOW_GRASS;
            } else {
              blockId = BLOCK.GRASS;
            }
          } else if (y >= surfY - 3) {
            if (biome === BIOMES.DESERT || isCoast) {
              blockId = y === surfY - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
            } else if (biome === BIOMES.ALPINE && surfY > 88) {
              blockId = BLOCK.STONE;
            } else {
              blockId = BLOCK.DIRT;
            }
          } else if (biome === BIOMES.DESERT && y >= surfY - 6) {
            blockId = BLOCK.SANDSTONE;
          }

          blocks[idx(lx, y, lz)] = blockId;
        }
      }
    }

    // 2. Stratified Ore Veins in Stone
    this.populateOres(blocks, idx, baseX, baseZ);

    // 3. Cave Glowshrooms on dark underground stone floors
    for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
      for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
        const surfY = heightGrid[lz * CHUNK_SIZE + lx];
        for (let y = 9; y < Math.min(44, surfY - 6); y++) {
          if (blocks[idx(lx, y, lz)] === BLOCK.AIR && blocks[idx(lx, y - 1, lz)] === BLOCK.STONE) {
            if (n.coordRand(baseX + lx, y, baseZ + lz, 701) < 0.018) {
              blocks[idx(lx, y, lz)] = BLOCK.GLOW_SHROOM;
            }
          }
        }
      }
    }

    // 4. Trees, Cacti, Wildflowers & Grass
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const surfY = heightGrid[lz * CHUNK_SIZE + lx];
        if (surfY <= SEA_LEVEL || surfY >= WORLD_HEIGHT - 14) continue;

        const ground = blocks[idx(lx, surfY, lz)];
        const above = blocks[idx(lx, surfY + 1, lz)];
        if (above !== BLOCK.AIR) continue;

        const biome = biomeGrid[lz * CHUNK_SIZE + lx];
        const r = n.coordRand(wx, surfY, wz, 303);

        // Trees strictly within lx=2..13, lz=2..13 so canopies never clip chunk boundaries
        const canPlaceTree = lx >= 2 && lx <= 13 && lz >= 2 && lz <= 13;

        if (ground === BLOCK.GRASS || ground === BLOCK.SNOW_GRASS) {
          let treeChance = 0.008;
          if (biome === BIOMES.FOREST) treeChance = 0.048;
          else if (biome === BIOMES.BIRCH) treeChance = 0.038;
          else if (biome === BIOMES.TAIGA) treeChance = 0.042;
          else if (biome === BIOMES.ALPINE) treeChance = surfY < 82 ? 0.012 : 0;

          if (canPlaceTree && r < treeChance) {
            let treeType = 'oak';
            if (biome === BIOMES.TAIGA || biome === BIOMES.ALPINE) treeType = 'spruce';
            else if (biome === BIOMES.BIRCH || (biome === BIOMES.FOREST && n.coordRand(wx, 1, wz, 404) < 0.26)) {
              treeType = 'birch';
            }
            this.placeTree(blocks, idx, lx, surfY + 1, lz, wx, wz, treeType);
            continue;
          }

          // Flora on Grass
          if (ground === BLOCK.GRASS) {
            const rf = n.coordRand(wx, surfY, wz, 505);
            if (rf < 0.11 && biome !== BIOMES.ALPINE) {
              blocks[idx(lx, surfY + 1, lz)] = BLOCK.TALL_GRASS;
            } else if (rf >= 0.11 && rf < 0.126) {
              blocks[idx(lx, surfY + 1, lz)] = BLOCK.RED_FLOWER;
            } else if (rf >= 0.126 && rf < 0.142) {
              blocks[idx(lx, surfY + 1, lz)] = BLOCK.YELLOW_FLOWER;
            }
          }
        } else if (ground === BLOCK.SAND && biome === BIOMES.DESERT && surfY > SEA_LEVEL + 2) {
          // Cacti (ensure no adjacent solid blocks horizontally)
          if (lx >= 1 && lx <= 14 && lz >= 1 && lz <= 14 && r < 0.014) {
            const h = 2 + Math.floor(n.coordRand(wx, 2, wz, 606) * 2.5);
            for (let dy = 1; dy <= h; dy++) {
              blocks[idx(lx, surfY + dy, lz)] = BLOCK.CACTUS;
            }
          }
        }
      }
    }

    // 5. Rare Wayfarer Ruin Outpost (glowing landmark on scenic hills!)
    if (n.coordRand(cx, 0, cz, 909) < 0.025) {
      const lx = 7;
      const lz = 7;
      const surfY = heightGrid[lz * CHUNK_SIZE + lx];
      const ground = blocks[idx(lx, surfY, lz)];
      if (surfY > SEA_LEVEL + 3 && surfY < 82 && (ground === BLOCK.GRASS || ground === BLOCK.SAND || ground === BLOCK.SNOW_GRASS)) {
        this.placeWayfarerShrine(blocks, idx, lx, surfY, lz);
      }
    }

    return { blocks, biomeGrid, heightGrid };
  }

  populateOres(blocks, idx, baseX, baseZ) {
    const n = this.noise;
    const oreSpecs = [
      { id: BLOCK.COAL_ORE, attempts: 18, minY: 10, maxY: 88, veinSize: 6, salt: 81 },
      { id: BLOCK.IRON_ORE, attempts: 13, minY: 6, maxY: 60, veinSize: 5, salt: 82 },
      { id: BLOCK.CRYSTAL_ORE, attempts: 5, minY: 8, maxY: 42, veinSize: 3, salt: 83 },
      { id: BLOCK.GOLD_ORE, attempts: 5, minY: 5, maxY: 30, veinSize: 4, salt: 84 },
      { id: BLOCK.DIAMOND_ORE, attempts: 3, minY: 3, maxY: 17, veinSize: 3, salt: 85 },
    ];

    for (const spec of oreSpecs) {
      for (let a = 0; a < spec.attempts; a++) {
        const r1 = n.coordRand(baseX + a, spec.salt, baseZ, 1);
        const r2 = n.coordRand(baseX, spec.salt + a, baseZ, 2);
        const r3 = n.coordRand(baseX, spec.salt, baseZ + a, 3);

        let vx = 1 + Math.floor(r1 * 14);
        let vy = spec.minY + Math.floor(r2 * (spec.maxY - spec.minY));
        let vz = 1 + Math.floor(r3 * 14);

        for (let v = 0; v < spec.veinSize; v++) {
          if (vx >= 0 && vx < CHUNK_SIZE && vz >= 0 && vz < CHUNK_SIZE && vy >= 1 && vy < WORLD_HEIGHT - 2) {
            if (blocks[idx(vx, vy, vz)] === BLOCK.STONE) {
              blocks[idx(vx, vy, vz)] = spec.id;
            }
          }
          const step = n.coordRand(baseX + vx, vy + v, baseZ + vz, spec.salt + 9);
          if (step < 0.33) vx += step < 0.16 ? -1 : 1;
          else if (step < 0.66) vy += step < 0.5 ? -1 : 1;
          else vz += step < 0.83 ? -1 : 1;
        }
      }
    }
  }

  placeTree(blocks, idx, lx, baseY, lz, wx, wz, type) {
    const n = this.noise;
    const setLeaf = (x, y, z, leafBlock) => {
      if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 1 || y >= WORLD_HEIGHT - 1) return;
      if (blocks[idx(x, y, z)] === BLOCK.AIR) {
        blocks[idx(x, y, z)] = leafBlock;
      }
    };

    if (type === 'spruce') {
      const trunkH = 6 + Math.floor(n.coordRand(wx, baseY, wz, 41) * 3);
      for (let dy = 0; dy < trunkH; dy++) {
        if (baseY + dy < WORLD_HEIGHT - 2) blocks[idx(lx, baseY + dy, lz)] = BLOCK.SPRUCE_LOG;
      }
      // Conical pine needle tiers
      for (let dy = 2; dy <= trunkH + 1; dy++) {
        const y = baseY + dy;
        const rad = dy === trunkH + 1 ? 0 : (dy >= trunkH - 1 ? 1 : (dy % 2 === 0 ? 2 : 1));
        for (let dz = -rad; dz <= rad; dz++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
            setLeaf(lx + dx, y, lz + dz, BLOCK.SPRUCE_LEAVES);
          }
        }
      }
      return;
    }

    const logBlock = type === 'birch' ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
    const leafBlock = type === 'birch' ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;
    const trunkH = (type === 'birch' ? 5 : 4) + Math.floor(n.coordRand(wx, baseY, wz, 42) * 2.4);

    for (let dy = 0; dy < trunkH; dy++) {
      if (baseY + dy < WORLD_HEIGHT - 2) blocks[idx(lx, baseY + dy, lz)] = logBlock;
    }

    const crownStart = baseY + trunkH - 2;
    const crownEnd = baseY + trunkH + 1;
    for (let y = crownStart; y <= crownEnd; y++) {
      const rad = y >= baseY + trunkH ? 1 : 2;
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.abs(dx) === rad && Math.abs(dz) === rad) {
            if (y === crownEnd || n.coordRand(wx + dx, y, wz + dz, 43) < 0.45) continue;
          }
          setLeaf(lx + dx, y, lz + dz, leafBlock);
        }
      }
    }
  }

  placeWayfarerShrine(blocks, idx, cx, surfY, cz) {
    // 3x3 stone brick base + weathered pillars + glowing lantern
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        blocks[idx(cx + dx, surfY, cz + dz)] = BLOCK.STONE_BRICKS;
        for (let dy = 1; dy <= 4; dy++) {
          blocks[idx(cx + dx, surfY + dy, cz + dz)] = BLOCK.AIR;
        }
      }
    }
    blocks[idx(cx - 1, surfY + 1, cz - 1)] = BLOCK.COBBLESTONE;
    blocks[idx(cx - 1, surfY + 2, cz - 1)] = BLOCK.STONE_BRICKS;
    blocks[idx(cx + 1, surfY + 1, cz + 1)] = BLOCK.COBBLESTONE;
    blocks[idx(cx, surfY + 1, cz)] = BLOCK.STONE_BRICKS;
    blocks[idx(cx, surfY + 2, cz)] = BLOCK.LANTERN;
  }

  findSafeSpawn() {
    // Spiral search outward from (8, 8) for a dry, scenic column above sea level
    let best = { x: 8.5, y: 70, z: 8.5 };
    let bestScore = -999;

    for (let r = 0; r <= 12; r++) {
      for (let a = 0; a < Math.max(1, r * 8); a++) {
        const angle = (a / Math.max(1, r * 8)) * Math.PI * 2;
        const wx = Math.round(8 + Math.cos(angle) * r * 12);
        const wz = Math.round(8 + Math.sin(angle) * r * 12);
        const info = this.sampleColumnInfo(wx, wz);
        if (info.height <= SEA_LEVEL + 2 || info.height > 82) continue;

        let score = 10;
        if (info.biome === BIOMES.PLAINS || info.biome === BIOMES.FOREST || info.biome === BIOMES.BIRCH) {
          score += 25;
        }
        score -= r * 1.2;

        if (score > bestScore) {
          bestScore = score;
          best = { x: wx + 0.5, y: info.height + 2.05, z: wz + 0.5 };
          if (score >= 30) return best;
        }
      }
    }
    return best;
  }
}
