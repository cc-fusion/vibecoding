export const BIOME = {
  SHALLOWS: 'shallows',
  BEACH: 'beach',
  MEADOWS: 'meadows',
  FOREST: 'forest',
  TAIGA: 'taiga',
  DESERT: 'desert',
  ALPINE: 'alpine',
};

export const BIOME_INFO = {
  [BIOME.SHALLOWS]: {
    id: BIOME.SHALLOWS,
    name: 'Azure Shallows',
    temp: 0.5,
    snows: false,
    rains: true,
    skyTint: '#7ec0ff',
  },
  [BIOME.BEACH]: {
    id: BIOME.BEACH,
    name: 'Sunlit Shore',
    temp: 0.65,
    snows: false,
    rains: true,
    skyTint: '#84c6ff',
  },
  [BIOME.MEADOWS]: {
    id: BIOME.MEADOWS,
    name: 'Emerald Meadows',
    temp: 0.55,
    snows: false,
    rains: true,
    skyTint: '#7abaff',
  },
  [BIOME.FOREST]: {
    id: BIOME.FOREST,
    name: 'Whispering Woods',
    temp: 0.5,
    snows: false,
    rains: true,
    skyTint: '#75b5fa',
  },
  [BIOME.TAIGA]: {
    id: BIOME.TAIGA,
    name: 'Boreal Pinewoods',
    temp: 0.25,
    snows: false,
    rains: true,
    skyTint: '#79b0eb',
  },
  [BIOME.DESERT]: {
    id: BIOME.DESERT,
    name: 'Golden Dunes',
    temp: 0.95,
    snows: false,
    rains: false,
    skyTint: '#8eccff',
  },
  [BIOME.ALPINE]: {
    id: BIOME.ALPINE,
    name: 'Frostpeak Highlands',
    temp: 0.05,
    snows: true,
    rains: false,
    skyTint: '#8ec4ff',
  },
};

export function classifyBiome(height, seaLevel, temp, humidity, mountainFactor) {
  if (height < seaLevel - 1) {
    return temp < -0.38 ? BIOME.ALPINE : BIOME.SHALLOWS;
  }
  if (height <= seaLevel + 1 && mountainFactor < 0.45 && temp > -0.25) {
    return BIOME.BEACH;
  }
  if (mountainFactor > 0.56 || height >= 53 || temp < -0.36) {
    return BIOME.ALPINE;
  }
  if (temp > 0.34 && humidity < -0.08) {
    return BIOME.DESERT;
  }
  if (temp < 0.02) {
    return BIOME.TAIGA;
  }
  if (humidity > 0.16) {
    return BIOME.FOREST;
  }
  return BIOME.MEADOWS;
}
