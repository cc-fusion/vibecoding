import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from '../constants.js';
import { BLOCK } from '../blocks.js';
import { SeededNoise, coordRand2D, coordRand3D, hashSeed } from '../math/noise.js';
import { BIOMES, sampleColumnClimate } from './biomes.js';

export class WorldGenerator {
  constructor(seed = 'TerraVox') {
    this.seedString = String(seed);
    this.seedNum = hashSeed(this.seedString);
    this.noise = new SeededNoise(this.seedNum);
    this.caveNoise = new SeededNoise(this.seedNum ^ 0x9e3779b9);
    this.oreNoise = new SeededNoise(this.seedNum ^ 0x517cc1b7);
  }

  getBiomeAt(wx, wz) {
    return sampleColumnClimate(this.noise, wx, wz).biome;
  }

  getSurfaceHeight(wx, wz) {
    return sampleColumnClimate(this.noise, wx, wz).height;
  }

  _isCave(wx, y, wz, surfaceY) {
    if (y <= 2 || y > surfaceY) return false;
    // Prevent draining underwater lakes/seas
    if (surfaceY <= SEA_LEVEL + 1 && y >= surfaceY - 4) return false;

    // Allow occasional cliffside cave entrances above sea level
    const depth = surfaceY - y;
    const entranceBoost = (surfaceY > SEA_LEVEL + 4 && depth <= 4) ? -0.05 : 0.0;

    const n1 = this.caveNoise.noise3D(wx * 0.045, y * 0.065, wz * 0.045);
    const n2 = this.caveNoise.noise3D(wx * 0.045 + 83.1, y * 0.065 - 41.7, wz * 0.045 + 19.3);
    // Spaghetti / tunnel intersection + deeper cavern chambers
    const tunnel = (n1 * n1 + n2 * n2) < (0.022 + entranceBoost * 0.01);
    if (tunnel) return true;

    if (y < 28) {
      const chamber = this.caveNoise.noise3D(wx * 0.028, y * 0.038, wz * 0.028);
      if (chamber > 0.64) return true;
    }
    return false;
  }

  _pickOre(wx, y, wz, baseStone) {
    // Diamond deep underground
    if (y <= 16) {
      const d = this.oreNoise.noise3D(wx * 0.14 + 300, y * 0.14, wz * 0.14 - 300);
      if (d > 0.75) return BLOCK.DIAMOND_ORE;
    }
    // Gold mid-deep
    if (y <= 29) {
      const g = this.oreNoise.noise3D(wx * 0.12 - 140, y * 0.12 + 90, wz * 0.12 + 210);
      if (g > 0.72) return BLOCK.GOLD_ORE;
    }
    // Iron from caves up into lower cliffs
    if (y <= 52) {
      const ir = this.oreNoise.noise3D(wx * 0.11 + 50, y * 0.11 - 60, wz * 0.11 + 70);
      if (ir > 0.67) return BLOCK.IRON_ORE;
    }
    // Coal widely distributed including mountain cliffs
    if (y <= 70) {
      const c = this.oreNoise.noise3D(wx * 0.1 - 20, y * 0.1 + 15, wz * 0.1 - 45);
      if (c > 0.64) return BLOCK.COAL_ORE;
    }
    return baseStone;
  }

  generateChunkData(cx, cz) {
    const voxels = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    const setLocal = (lx, y, lz, id) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
      voxels[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx] = id;
    };
    const getLocal = (lx, y, lz) => {
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
      return voxels[(y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx];
    };

    const baseX = cx * CHUNK_SIZE;
    const baseZ = cz * CHUNK_SIZE;

    const colInfo = new Array(CHUNK_SIZE * CHUNK_SIZE);

    // Pass 1: Terrain strata, water, caves, and ores
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const info = sampleColumnClimate(this.noise, wx, wz);
        colInfo[lz * CHUNK_SIZE + lx] = info;
        const h = info.height;
        const biome = info.biome;

        setLocal(lx, 0, lz, BLOCK.BEDROCK);

        for (let y = 1; y <= Math.max(h, SEA_LEVEL); y++) {
          if (y > h) {
            // Water or surface ice in freezing biomes
            if (y === SEA_LEVEL && info.temperature < -0.34) {
              setLocal(lx, y, lz, BLOCK.ICE);
            } else {
              setLocal(lx, y, lz, BLOCK.WATER);
            }
            continue;
          }

          if (this._isCave(wx, y, wz, h)) {
            continue; // Leave air cave
          }

          if (y === h) {
            if (h < SEA_LEVEL - 1) {
              const r = coordRand2D(wx, wz, this.seedNum + 11);
              setLocal(lx, y, lz, r < 0.25 ? BLOCK.CLAY : r < 0.55 ? BLOCK.SAND : BLOCK.GRAVEL);
            } else if (biome === BIOMES.ALPINE) {
              if (h >= 62) setLocal(lx, y, lz, BLOCK.SNOW);
              else if (h >= 54) setLocal(lx, y, lz, coordRand2D(wx, wz, this.seedNum) > 0.45 ? BLOCK.STONE : BLOCK.SNOW_GRASS);
              else setLocal(lx, y, lz, BLOCK.STONE);
            } else if (biome === BIOMES.TAIGA && info.temperature > -0.32 && coordRand2D(wx, wz, this.seedNum + 5) > 0.55) {
              setLocal(lx, y, lz, BLOCK.GRASS);
            } else {
              setLocal(lx, y, lz, biome.topBlock);
            }
          } else if (y >= h - 3) {
            if (h < SEA_LEVEL) {
              setLocal(lx, y, lz, BLOCK.SAND);
            } else {
              setLocal(lx, y, lz, biome.subBlock);
            }
          } else {
            const deepBlend = y < 14 || (y < 18 && coordRand3D(wx, y, wz, this.seedNum) > 0.5);
            const stoneBase = deepBlend ? BLOCK.DEEPSLATE : BLOCK.STONE;
            setLocal(lx, y, lz, this._pickOre(wx, y, wz, stoneBase));
          }
        }
      }
    }

    // Pass 2: Seamless border-aware trees & cacti (checks margin [-3..CHUNK_SIZE+2])
    const margin = 3;
    for (let lz = -margin; lz < CHUNK_SIZE + margin; lz++) {
      const wz = baseZ + lz;
      for (let lx = -margin; lx < CHUNK_SIZE + margin; lx++) {
        const wx = baseX + lx;
        // Space trees out naturally using local grid jitter
        if (((wx & 3) !== ((wz * 3) & 3))) continue;

        const info = (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE)
          ? colInfo[lz * CHUNK_SIZE + lx]
          : sampleColumnClimate(this.noise, wx, wz);

        const h = info.height;
        if (h <= SEA_LEVEL + 1 || h >= CHUNK_HEIGHT - 12) continue;
        if (this._isCave(wx, h, wz, h)) continue;

        const r = coordRand2D(wx, wz, this.seedNum + 777);
        // Scale rate by x4 because of the spacing filter above
        if (r > info.biome.treeRate * 3.6) continue;

        if (info.biome === BIOMES.DESERT) {
          const cactusH = 2 + Math.floor(coordRand2D(wx, wz, this.seedNum + 888) * 3);
          for (let cy = 1; cy <= cactusH; cy++) {
            setLocal(lx, h + cy, lz, BLOCK.CACTUS);
          }
        } else if (info.biome === BIOMES.TAIGA || info.biome === BIOMES.ALPINE) {
          if (h > 64) continue;
          this._placeSpruceTree(setLocal, getLocal, lx, h + 1, lz, wx, wz);
        } else {
          const isBirch = coordRand2D(wx, wz, this.seedNum + 333) < (info.biome === BIOMES.FOREST ? 0.34 : 0.22);
          this._placeBroadleafTree(setLocal, getLocal, lx, h + 1, lz, wx, wz, isBirch);
        }
      }
    }

    // Pass 3: Surface flora (wildflowers, tall grass, dry brush) & rare mossy waystone ruins
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = baseZ + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const info = colInfo[lz * CHUNK_SIZE + lx];
        const h = info.height;
        if (h <= SEA_LEVEL || h >= CHUNK_HEIGHT - 3) continue;

        const ground = getLocal(lx, h, lz);
        const above = getLocal(lx, h + 1, lz);
        if (above !== BLOCK.AIR) continue;

        const fr = coordRand2D(wx, wz, this.seedNum + 1909);
        if (ground === BLOCK.GRASS) {
          if (fr < info.biome.grassRate * 0.78) {
            setLocal(lx, h + 1, lz, BLOCK.TALL_GRASS);
          } else if (fr < info.biome.grassRate) {
            const flowerPick = coordRand2D(wx, wz, this.seedNum + 2027);
            if (flowerPick < 0.36) setLocal(lx, h + 1, lz, BLOCK.DANDELION);
            else if (flowerPick < 0.72) setLocal(lx, h + 1, lz, BLOCK.POPPY);
            else setLocal(lx, h + 1, lz, BLOCK.CORNFLOWER);
          }
        } else if (ground === BLOCK.SAND && info.biome === BIOMES.DESERT) {
          if (fr < info.biome.grassRate) {
            setLocal(lx, h + 1, lz, BLOCK.DEAD_SHRUB);
          }
        }
      }
    }

    // Occasional Waystone Ruin in chunks (approx 1 in 28 meadow/forest chunks)
    const ruinChance = coordRand2D(cx, cz, this.seedNum + 4242);
    if (ruinChance < 0.036) {
      const lx = 7, lz = 7;
      const info = colInfo[lz * CHUNK_SIZE + lx];
      const h = info.height;
      if (h > SEA_LEVEL + 2 && h < 54 && (info.biome === BIOMES.MEADOW || info.biome === BIOMES.FOREST || info.biome === BIOMES.TAIGA)) {
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            setLocal(lx + dx, h, lz + dz, (dx === 0 || dz === 0) ? BLOCK.MOSSY_COBBLE : BLOCK.COBBLESTONE);
          }
        }
        setLocal(lx, h + 1, lz, BLOCK.MOSSY_COBBLE);
        setLocal(lx, h + 2, lz, BLOCK.COBBLESTONE);
        setLocal(lx, h + 3, lz, BLOCK.GLOWSTONE);
        setLocal(lx + 1, h + 1, lz, BLOCK.CRATE);
      }
    }

    return voxels;
  }

  _placeBroadleafTree(setLocal, getLocal, lx, baseY, lz, wx, wz, isBirch) {
    const logBlock = isBirch ? BLOCK.BIRCH_LOG : BLOCK.OAK_LOG;
    const leafBlock = isBirch ? BLOCK.BIRCH_LEAVES : BLOCK.OAK_LEAVES;
    const trunkH = 4 + Math.floor(coordRand2D(wx, wz, this.seedNum + 501) * 3);

    for (let dy = -1; dy <= 0; dy++) {
      if (dy === -1) setLocal(lx, baseY - 1, lz, BLOCK.DIRT);
    }

    for (let dy = -2; dy <= 1; dy++) {
      const ly = baseY + trunkH + dy;
      const radius = dy >= 0 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
            if (dy >= 0 || coordRand3D(wx + dx, ly, wz + dz, this.seedNum) > 0.45) continue;
          }
          const cur = getLocal(lx + dx, ly, lz + dz);
          if (cur === BLOCK.AIR || cur === BLOCK.TALL_GRASS) {
            setLocal(lx + dx, ly, lz + dz, leafBlock);
          }
        }
      }
    }

    for (let ty = 0; ty < trunkH; ty++) {
      setLocal(lx, baseY + ty, lz, logBlock);
    }
  }

  _placeSpruceTree(setLocal, getLocal, lx, baseY, lz, wx, wz) {
    const trunkH = 6 + Math.floor(coordRand2D(wx, wz, this.seedNum + 601) * 3);
    setLocal(lx, baseY - 1, lz, BLOCK.DIRT);

    for (let dy = 2; dy <= trunkH + 1; dy++) {
      const ly = baseY + dy;
      const fromTop = trunkH + 1 - dy;
      const radius = fromTop <= 1 ? (fromTop === 0 ? 0 : 1) : (fromTop % 2 === 0 ? 2 : 1);
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius > 0 && Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
          const cur = getLocal(lx + dx, ly, lz + dz);
          if (cur === BLOCK.AIR) {
            setLocal(lx + dx, ly, lz + dz, BLOCK.SPRUCE_LEAVES);
          }
        }
      }
    }

    for (let ty = 0; ty < trunkH; ty++) {
      setLocal(lx, baseY + ty, lz, BLOCK.SPRUCE_LOG);
    }
  }

  findSafeSpawn() {
    let best = { x: 0.5, y: 45, z: 0.5, score: -999 };
    for (let r = 0; r <= 96; r += 6) {
      const steps = r === 0 ? 1 : 12;
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const wx = Math.round(Math.cos(angle) * r);
        const wz = Math.round(Math.sin(angle) * r);
        const info = sampleColumnClimate(this.noise, wx, wz);
        if (info.height <= SEA_LEVEL + 1 || info.height > 54) continue;
        if (this._isCave(wx, info.height, wz, info.height)) continue;

        let score = 20 - r * 0.08;
        if (info.biome === BIOMES.MEADOW || info.biome === BIOMES.FOREST) score += 25;
        if (info.height >= SEA_LEVEL + 3 && info.height <= SEA_LEVEL + 14) score += 10;

        if (score > best.score) {
          best = { x: wx + 0.5, y: info.height + 2.05, z: wz + 0.5, score };
          if (score > 48) return best;
        }
      }
    }
    const fallbackH = Math.max(SEA_LEVEL + 2, this.getSurfaceHeight(0, 0) + 2);
    return best.score > -900 ? best : { x: 0.5, y: fallbackH, z: 0.5 };
  }
}
