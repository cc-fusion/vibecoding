import { SEA_LEVEL } from '../constants.js';
import { BLOCK } from '../blocks.js';

export const BIOMES = {
  SHORE: {
    id: 'shore',
    name: 'Sandy Shore',
    weather: 'rain',
    topBlock: BLOCK.SAND,
    subBlock: BLOCK.SAND,
    treeRate: 0.0,
    grassRate: 0.02,
  },
  MEADOW: {
    id: 'meadow',
    name: 'Emerald Plains',
    weather: 'rain',
    topBlock: BLOCK.GRASS,
    subBlock: BLOCK.DIRT,
    treeRate: 0.008,
    grassRate: 0.18,
  },
  FOREST: {
    id: 'forest',
    name: 'Whispering Woods',
    weather: 'rain',
    topBlock: BLOCK.GRASS,
    subBlock: BLOCK.DIRT,
    treeRate: 0.042,
    grassRate: 0.14,
  },
  DESERT: {
    id: 'desert',
    name: 'Golden Dunes',
    weather: 'clear',
    topBlock: BLOCK.SAND,
    subBlock: BLOCK.SANDSTONE,
    treeRate: 0.009, // cacti
    grassRate: 0.018, // dead shrub
  },
  TAIGA: {
    id: 'taiga',
    name: 'Frostpine Taiga',
    weather: 'snow',
    topBlock: BLOCK.SNOW_GRASS,
    subBlock: BLOCK.DIRT,
    treeRate: 0.034,
    grassRate: 0.06,
  },
  ALPINE: {
    id: 'alpine',
    name: 'Alpine Crags',
    weather: 'snow',
    topBlock: BLOCK.SNOW,
    subBlock: BLOCK.STONE,
    treeRate: 0.006,
    grassRate: 0.01,
  },
};

export function sampleColumnClimate(noise, wx, wz) {
  // Subtle domain warp for organic biome & coast curves
  const warpX = noise.noise2D(wx * 0.004, wz * 0.004) * 18.0;
  const warpZ = noise.noise2D(wx * 0.004 + 41.2, wz * 0.004 - 29.7) * 18.0;
  const sx = wx + warpX;
  const sz = wz + warpZ;

  const temperature = noise.fbm2D(sx * 0.0022 + 100, sz * 0.0022 - 100, 3); // [-1, 1]
  const moisture = noise.fbm2D(sx * 0.0025 - 220, sz * 0.0025 + 310, 3); // [-1, 1]
  const continental = noise.fbm2D(sx * 0.0032, sz * 0.0032, 4); // [-1, 1]
  const hills = noise.fbm2D(wx * 0.011, wz * 0.011, 3);
  const detail = noise.noise2D(wx * 0.042, wz * 0.042);

  // Mountain spine mask so peaks rise smoothly without sharp borders
  const ridgeRaw = noise.ridged2D(sx * 0.0045 + 55, sz * 0.0045 - 77, 4);
  const mountainMask = Math.max(0, (continental + 0.18) * 0.85);
  const mountainHeight = Math.pow(Math.max(0, ridgeRaw), 1.65) * 38.0 * mountainMask;

  // River/lake valleys where continentalness dips
  let baseHeight = SEA_LEVEL + 5.5 + continental * 13.5 + hills * 6.5 + detail * 1.6 + mountainHeight;

  // Flatten beaches gently near sea level
  if (baseHeight > SEA_LEVEL - 2 && baseHeight < SEA_LEVEL + 2.5) {
    baseHeight = SEA_LEVEL + (baseHeight - SEA_LEVEL) * 0.65;
  }

  const height = Math.max(6, Math.min(86, Math.floor(baseHeight)));

  let biome = BIOMES.MEADOW;
  if (height <= SEA_LEVEL + 1 && temperature > -0.28) {
    biome = BIOMES.SHORE;
  } else if (height >= 56 || mountainHeight > 17) {
    biome = BIOMES.ALPINE;
  } else if (temperature < -0.24) {
    biome = BIOMES.TAIGA;
  } else if (temperature > 0.30 && moisture < 0.08) {
    biome = BIOMES.DESERT;
  } else if (moisture > 0.08) {
    biome = BIOMES.FOREST;
  } else {
    biome = BIOMES.MEADOW;
  }

  return {
    height,
    temperature,
    moisture,
    continental,
    mountainHeight,
    biome,
  };
}
