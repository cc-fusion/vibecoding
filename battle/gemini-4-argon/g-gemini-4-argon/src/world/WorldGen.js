import { BLOCK } from '../constants/Blocks.js';
import { SeededNoise } from '../engine/Noise.js';

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const SEA_LEVEL = 32;

export const BIOME = {
  OCEAN: 'Azure Ocean',
  BEACH: 'Golden Beach',
  PLAINS: 'Emerald Plains',
  FOREST: 'Whispering Forest',
  DESERT: 'Sunbaked Dunes',
  SNOW_TAIGA: 'Frostpine Taiga',
  ALPINE: 'Alpine Crags',
};

// Biome grass/foliage RGB multipliers
export const BIOME_TINTS = {
  [BIOME.OCEAN]: [0.78, 1.02, 0.78],
  [BIOME.BEACH]: [0.88, 1.04, 0.74],
  [BIOME.PLAINS]: [0.84, 1.08, 0.72],
  [BIOME.FOREST]: [0.72, 1.04, 0.68],
  [BIOME.DESERT]: [1.04, 0.98, 0.66],
  [BIOME.SNOW_TAIGA]: [0.72, 0.94, 0.82],
  [BIOME.ALPINE]: [0.76, 0.96, 0.80],
};

export class WorldGenerator {
  constructor(seed = 'TerraCraft') {
    this.seed = seed;
    this.noise = new SeededNoise(seed);
  }

  // Sample climate & height smoothly at world (wx, wz)
  sampleColumn(wx, wz) {
    const n = this.noise;

    // Warp coordinates slightly for organic coastlines and biome shapes
    const warpX = wx + n.noise2D(wx * 0.008, wz * 0.008) * 18;
    const warpZ = wz + n.noise2D(wx * 0.008 + 97, wz * 0.008 - 53) * 18;

    const continental = n.fbm2D(warpX * 0.0042, warpZ * 0.0042, 4);
    const detail = n.fbm2D(wx * 0.018, wz * 0.018, 3);
    const ridges = n.ridged2D(warpX * 0.0055 + 31, warpZ * 0.0055 - 19, 3);
    const temp = n.fbm2D(warpX * 0.0032 + 210, warpZ * 0.0032 + 110, 3);
    const moisture = n.fbm2D(warpX * 0.0036 - 140, warpZ * 0.0036 + 320, 3);

    // Smooth elevation synthesis
    let baseHeight = SEA_LEVEL + 5 + continental * 18 + detail * 5.5;

    // Mountain uplift where continental > 0.08 and ridges are strong
    const mountainMask = Math.max(0, (continental - 0.05) * 1.45) * Math.max(0, ridges - 0.42) * 2.2;
    baseHeight += mountainMask * 34;

    // Gently flatten beaches around sea level
    if (baseHeight > SEA_LEVEL - 2 && baseHeight < SEA_LEVEL + 3.5) {
      baseHeight = SEA_LEVEL + (baseHeight - SEA_LEVEL) * 0.68;
    }

    const height = Math.max(6, Math.min(WORLD_HEIGHT - 8, Math.floor(baseHeight)));

    // Classify biome
    let biome = BIOME.PLAINS;
    if (height < SEA_LEVEL - 1) {
      biome = BIOME.OCEAN;
    } else if (mountainMask > 0.42 || height >= 57) {
      biome = BIOME.ALPINE;
    } else if (height <= SEA_LEVEL + 1 && temp >= -0.22) {
      biome = BIOME.BEACH;
    } else if (temp < -0.24) {
      biome = BIOME.SNOW_TAIGA;
    } else if (temp > 0.26 && moisture < -0.04) {
      biome = BIOME.DESERT;
    } else if (moisture > 0.08) {
      biome = BIOME.FOREST;
    } else {
      biome = BIOME.PLAINS;
    }

    return { height, biome, temp, moisture, mountainMask };
  }

  getBiomeAt(wx, wz) {
    return this.sampleColumn(wx, wz).biome;
  }

  findSpawnPoint() {
    // Search outward spiral from (0, 0) for scenic dry land (Plains or Forest near y = 34..48)
    let best = { x: 0.5, y: 45, z: 0.5, score: -999 };
    for (let r = 0; r <= 12; r++) {
      const steps = Math.max(1, r * 8);
      for (let s = 0; s < steps; s++) {
        const angle = (s / steps) * Math.PI * 2;
        const wx = Math.round(Math.cos(angle) * r * 12);
        const wz = Math.round(Math.sin(angle) * r * 12);
        const col = this.sampleColumn(wx, wz);
        if (col.height <= SEA_LEVEL + 1 || col.height > 56) continue;
        let score = 50 - r * 2;
        if (col.biome === BIOME.PLAINS) score += 30;
        if (col.biome === BIOME.FOREST) score += 25;
        if (score > best.score) {
          best = { x: wx + 0.5, y: col.height + 2.05, z: wz + 0.5, score };
          if (score >= 70) return best;
        }
      }
    }
    if (best.score < -100) {
      const col = this.sampleColumn(0, 0);
      return { x: 0.5, y: Math.max(col.height, SEA_LEVEL) + 3, z: 0.5 };
    }
    return best;
  }

  generateChunk(cx, cz) {
    const blocks = new Uint8Array(CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE);
    const biomes = new Array(CHUNK_SIZE * CHUNK_SIZE);
    const heights = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
    const n = this.noise;

    const idx = (lx, y, lz) => (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;

    // 1. Base strata, caves & water fill
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      const wz = cz * CHUNK_SIZE + lz;
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const col = this.sampleColumn(wx, wz);
        const h = col.height;
        const biome = col.biome;
        const cIdx = lz * CHUNK_SIZE + lx;
        biomes[cIdx] = biome;
        heights[cIdx] = h;

        for (let y = 0; y <= Math.max(h, SEA_LEVEL); y++) {
          if (y === 0) {
            blocks[idx(lx, y, lz)] = BLOCK.BEDROCK;
            continue;
          }

          if (y > h) {
            // Underwater / frozen surface
            if (y === SEA_LEVEL && biome === BIOME.SNOW_TAIGA) {
              blocks[idx(lx, y, lz)] = BLOCK.ICE;
            } else {
              blocks[idx(lx, y, lz)] = BLOCK.WATER;
            }
            continue;
          }

          // Cave carving: keep seabed sealed so oceans don't flood every cavern
          const canCarveSurface = h > SEA_LEVEL + 3 && biome !== BIOME.OCEAN && biome !== BIOME.BEACH;
          const maxCaveY = canCarveSurface ? h : Math.min(h - 3, SEA_LEVEL - 4);
          if (y >= 4 && y <= maxCaveY) {
            const c1 = n.noise3D(wx * 0.045, y * 0.065, wz * 0.045);
            const c2 = n.noise3D(wx * 0.045 + 77, y * 0.065 + 33, wz * 0.045 - 51);
            // Tunnel intersection + larger deep caverns
            const worm = c1 * c1 + c2 * c2;
            const cavern = n.noise3D(wx * 0.028 - 40, y * 0.042, wz * 0.028 + 90);
            if (worm < 0.032 || (y < 26 && cavern > 0.62)) {
              blocks[idx(lx, y, lz)] = BLOCK.AIR;
              continue;
            }
          }

          // Surface & subsurface block choice
          let blockId = BLOCK.STONE;
          if (y === h) {
            if (h < SEA_LEVEL) {
              blockId = n.hash2(wx, wz, 7) < 0.35 ? BLOCK.GRAVEL : BLOCK.SAND;
            } else if (biome === BIOME.DESERT || biome === BIOME.BEACH) {
              blockId = BLOCK.SAND;
            } else if (biome === BIOME.SNOW_TAIGA) {
              blockId = BLOCK.SNOWY_GRASS;
            } else if (biome === BIOME.ALPINE) {
              if (h >= 66) blockId = BLOCK.SNOW;
              else if (h >= 55) blockId = BLOCK.STONE;
              else blockId = BLOCK.SNOWY_GRASS;
            } else {
              blockId = BLOCK.GRASS;
            }
          } else if (y >= h - 3) {
            if (biome === BIOME.DESERT || biome === BIOME.BEACH || h < SEA_LEVEL) {
              blockId = biome === BIOME.DESERT && y === h - 3 ? BLOCK.SANDSTONE : BLOCK.SAND;
            } else if (biome === BIOME.ALPINE && h >= 56) {
              blockId = h >= 68 ? BLOCK.SNOW : BLOCK.STONE;
            } else {
              blockId = BLOCK.DIRT;
            }
          } else if (biome === BIOME.DESERT && y >= h - 6) {
            blockId = BLOCK.SANDSTONE;
          }

          blocks[idx(lx, y, lz)] = blockId;
        }
      }
    }

    // 2. Ore veins & underground bioluminescence
    this.populateOresAndCaves(cx, cz, blocks, idx);

    // 3. Trees, Cacti, Wildflowers & Rare Landmarks
    this.populateSurfaceFeatures(cx, cz, blocks, heights, biomes, idx);

    return { blocks, biomes, heights };
  }

  populateOresAndCaves(cx, cz, blocks, idx) {
    const n = this.noise;
    const placeVein = (salt, count, minY, maxY, blockId, veinSize) => {
      for (let v = 0; v < count; v++) {
        const r1 = n.hash3(cx, cz, v, salt);
        const r2 = n.hash3(cx, cz, v, salt + 101);
        const r3 = n.hash3(cx, cz, v, salt + 202);
        const ox = 1 + Math.floor(r1 * (CHUNK_SIZE - 2));
        const oy = minY + Math.floor(r2 * (maxY - minY + 1));
        const oz = 1 + Math.floor(r3 * (CHUNK_SIZE - 2));

        for (let b = 0; b < veinSize; b++) {
          const dx = Math.floor(n.hash3(ox + b, oy, cx, salt + 303) * 3) - 1;
          const dy = Math.floor(n.hash3(ox, oy + b, cz, salt + 404) * 3) - 1;
          const dz = Math.floor(n.hash3(oz + b, oy, cx + cz, salt + 505) * 3) - 1;
          const tx = ox + dx;
          const ty = oy + dy;
          const tz = oz + dz;
          if (tx >= 0 && tx < CHUNK_SIZE && tz >= 0 && tz < CHUNK_SIZE && ty >= 1 && ty < WORLD_HEIGHT - 1) {
            if (blocks[idx(tx, ty, tz)] === BLOCK.STONE) {
              blocks[idx(tx, ty, tz)] = blockId;
            }
          }
        }
      }
    };

    placeVein(1000, 14, 6, 68, BLOCK.COAL_ORE, 5);
    placeVein(2000, 10, 5, 50, BLOCK.IRON_ORE, 4);
    placeVein(3000, 4, 4, 28, BLOCK.GOLD_ORE, 3);
    placeVein(4000, 2, 3, 16, BLOCK.DIAMOND_ORE, 3);
    placeVein(5000, 4, 5, 32, BLOCK.GLOW_CRYSTAL, 2);
    placeVein(6000, 5, 8, 45, BLOCK.GRAVEL, 6);

    // Bioluminescent cave mushrooms on cavern floors
    for (let lz = 1; lz < CHUNK_SIZE - 1; lz++) {
      for (let lx = 1; lx < CHUNK_SIZE - 1; lx++) {
        if (n.hash2(cx * 16 + lx, cz * 16 + lz, 717) > 0.045) continue;
        for (let y = 5; y < 28; y++) {
          if (blocks[idx(lx, y, lz)] === BLOCK.STONE && blocks[idx(lx, y + 1, lz)] === BLOCK.AIR) {
            blocks[idx(lx, y + 1, lz)] = BLOCK.GLOW_MUSHROOM;
            break;
          }
        }
      }
    }
  }

  populateSurfaceFeatures(cx, cz, blocks, heights, biomes, idx) {
    const n = this.noise;

    // Rare atmospheric ruin/waypoint (approx 1 in 45 land chunks, away from immediate 0,0 spawn block)
    if ((Math.abs(cx) > 1 || Math.abs(cz) > 1) && n.hash2(cx, cz, 9991) < 0.024) {
      const lx = 7;
      const lz = 7;
      const cIdx = lz * CHUNK_SIZE + lx;
      const h = heights[cIdx];
      const biome = biomes[cIdx];
      if (h > SEA_LEVEL + 1 && h < 54 && blocks[idx(lx, h, lz)] !== BLOCK.AIR) {
        if (biome === BIOME.DESERT) {
          this.buildDesertWell(blocks, lx, h, lz, idx);
        } else if (biome === BIOME.PLAINS || biome === BIOME.FOREST) {
          this.buildWayfarerCamp(blocks, lx, h, lz, idx);
        }
      }
    }

    // Trees & Cacti (kept inside lx,lz in [2..13] so 5x5 canopies never clip at chunk borders)
    for (let lz = 2; lz <= 13; lz++) {
      for (let lx = 2; lx <= 13; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        const cIdx = lz * CHUNK_SIZE + lx;
        const h = heights[cIdx];
        const biome = biomes[cIdx];
        if (h <= SEA_LEVEL || h >= WORLD_HEIGHT - 12) continue;

        const ground = blocks[idx(lx, h, lz)];
        const above = blocks[idx(lx, h + 1, lz)];
        if (above !== BLOCK.AIR) continue;

        const r = n.hash2(wx, wz, 331);

        if (biome === BIOME.DESERT && ground === BLOCK.SAND) {
          if (r < 0.014) {
            const ch = 2 + Math.floor(n.hash2(wx, wz, 332) * 2.4);
            // Ensure cactus has clear neighbors
            if (
              blocks[idx(lx - 1, h + 1, lz)] === BLOCK.AIR &&
              blocks[idx(lx + 1, h + 1, lz)] === BLOCK.AIR &&
              blocks[idx(lx, h + 1, lz - 1)] === BLOCK.AIR &&
              blocks[idx(lx, h + 1, lz + 1)] === BLOCK.AIR
            ) {
              for (let dy = 1; dy <= ch; dy++) blocks[idx(lx, h + dy, lz)] = BLOCK.CACTUS;
            }
          } else if (r > 0.982) {
            blocks[idx(lx, h + 1, lz)] = BLOCK.DEAD_BUSH;
          }
          continue;
        }

        const treeChance =
          biome === BIOME.FOREST ? 0.048 :
          biome === BIOME.SNOW_TAIGA ? 0.036 :
          biome === BIOME.PLAINS ? 0.006 :
          biome === BIOME.ALPINE && h < 54 ? 0.008 : 0;

        if (
          treeChance > 0 &&
          r < treeChance &&
          (ground === BLOCK.GRASS || ground === BLOCK.SNOWY_GRASS || ground === BLOCK.DIRT)
        ) {
          // Avoid overlapping trunks too closely
          let clear = true;
          for (let dz = -2; dz <= 2 && clear; dz++) {
            for (let dx = -2; dx <= 2; dx++) {
              const b = blocks[idx(lx + dx, h + 2, lz + dz)];
              if (b === BLOCK.OAK_LOG || b === BLOCK.BIRCH_LOG || b === BLOCK.SPRUCE_LOG) {
                clear = false;
                break;
              }
            }
          }
          if (clear) {
            blocks[idx(lx, h, lz)] = BLOCK.DIRT;
            if (biome === BIOME.SNOW_TAIGA || biome === BIOME.ALPINE) {
              this.placeSpruceTree(blocks, lx, h + 1, lz, n.hash2(wx, wz, 401), idx);
            } else if (biome === BIOME.FOREST && n.hash2(wx, wz, 402) < 0.36) {
              this.placeCanopyTree(blocks, lx, h + 1, lz, BLOCK.BIRCH_LOG, BLOCK.BIRCH_LEAVES, n.hash2(wx, wz, 403), idx);
            } else {
              this.placeCanopyTree(blocks, lx, h + 1, lz, BLOCK.OAK_LOG, BLOCK.OAK_LEAVES, n.hash2(wx, wz, 404), idx);
            }
            continue;
          }
        }

        // Wildflowers & Tall Grass
        if (ground === BLOCK.GRASS || ground === BLOCK.SNOWY_GRASS) {
          const fr = n.hash2(wx, wz, 555);
          if (biome === BIOME.PLAINS || biome === BIOME.FOREST) {
            if (fr < 0.11) blocks[idx(lx, h + 1, lz)] = BLOCK.TALL_GRASS;
            else if (fr < 0.126) blocks[idx(lx, h + 1, lz)] = BLOCK.YELLOW_FLOWER;
            else if (fr < 0.140) blocks[idx(lx, h + 1, lz)] = BLOCK.RED_FLOWER;
          } else if (biome === BIOME.ALPINE || biome === BIOME.SNOW_TAIGA) {
            if (fr < 0.015) blocks[idx(lx, h + 1, lz)] = BLOCK.BLUE_FLOWER;
          }
        }
      }
    }
  }

  placeCanopyTree(blocks, lx, baseY, lz, logId, leafId, rand, idx) {
    const trunkH = 4 + Math.floor(rand * 2.4);
    for (let dy = 0; dy < trunkH; dy++) {
      blocks[idx(lx, baseY + dy, lz)] = logId;
    }
    const crownBase = baseY + trunkH - 2;
    for (let y = crownBase; y <= baseY + trunkH + 1; y++) {
      const layer = y - (baseY + trunkH);
      const radius = layer >= 1 ? 1 : 2;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && (layer >= 0 || ((dx + dz + y) & 1))) {
            continue;
          }
          const cur = blocks[idx(lx + dx, y, lz + dz)];
          if (cur === BLOCK.AIR || cur === BLOCK.TALL_GRASS) {
            blocks[idx(lx + dx, y, lz + dz)] = leafId;
          }
        }
      }
    }
  }

  placeSpruceTree(blocks, lx, baseY, lz, rand, idx) {
    const trunkH = 6 + Math.floor(rand * 2.5);
    for (let dy = 0; dy < trunkH; dy++) {
      blocks[idx(lx, baseY + dy, lz)] = BLOCK.SPRUCE_LOG;
    }
    for (let dy = 2; dy <= trunkH + 1; dy++) {
      const fromTop = trunkH + 1 - dy;
      const radius = fromTop === 0 ? 0 : fromTop === 1 ? 1 : dy % 2 === 0 ? 2 : 1;
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (radius === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
          const cur = blocks[idx(lx + dx, baseY + dy, lz + dz)];
          if (cur === BLOCK.AIR) {
            blocks[idx(lx + dx, baseY + dy, lz + dz)] = BLOCK.SPRUCE_LEAVES;
          }
        }
      }
    }
  }

  buildDesertWell(blocks, cx, y, cz, idx) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        blocks[idx(cx + dx, y, cz + dz)] = BLOCK.SANDSTONE;
        blocks[idx(cx + dx, y + 1, cz + dz)] = (dx === 0 && dz === 0) ? BLOCK.WATER : BLOCK.SANDSTONE;
      }
    }
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      blocks[idx(cx + px, y + 2, cz + pz)] = BLOCK.SANDSTONE;
      blocks[idx(cx + px, y + 3, cz + pz)] = BLOCK.SANDSTONE;
    }
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        blocks[idx(cx + dx, y + 4, cz + dz)] = BLOCK.SANDSTONE;
      }
    }
    blocks[idx(cx, y + 5, cz)] = BLOCK.TORCH;
  }

  buildWayfarerCamp(blocks, cx, y, cz, idx) {
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        blocks[idx(cx + dx, y, cz + dz)] = ((dx + dz) & 1) ? BLOCK.COBBLESTONE : BLOCK.MOSSY_COBBLESTONE;
        for (let dy = 1; dy <= 4; dy++) blocks[idx(cx + dx, y + dy, cz + dz)] = BLOCK.AIR;
      }
    }
    // Corner stone brick pillars + lantern + crafting table + chest
    blocks[idx(cx - 2, y + 1, cz - 2)] = BLOCK.STONE_BRICKS;
    blocks[idx(cx - 2, y + 2, cz - 2)] = BLOCK.STONE_BRICKS;
    blocks[idx(cx - 2, y + 3, cz - 2)] = BLOCK.LANTERN;
    blocks[idx(cx + 1, y + 1, cz - 1)] = BLOCK.CRAFTING_TABLE;
    blocks[idx(cx - 1, y + 1, cz + 1)] = BLOCK.CHEST;
    blocks[idx(cx + 1, y + 1, cz + 1)] = BLOCK.FURNACE;
  }
}
