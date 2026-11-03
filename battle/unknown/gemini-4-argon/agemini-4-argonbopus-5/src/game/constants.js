export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const SEA_LEVEL = 42;

export const PLAYER_RADIUS = 0.3;
export const PLAYER_HEIGHT = 1.78;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_CROUCH_EYE_HEIGHT = 1.38;

export const GRAVITY = 28.0;
export const JUMP_VELOCITY = 9.15;
export const WALK_SPEED = 4.65;
export const SPRINT_SPEED = 7.0;
export const CROUCH_SPEED = 2.15;
export const SWIM_SPEED = 3.8;
export const FLY_SPEED = 12.5;
export const REACH_DISTANCE = 5.6;

export const DAY_LENGTH_SECONDS = 600; // 10 minutes per full day-night cycle

export const GAME_MODES = {
  SURVIVAL: 'survival',
  CREATIVE: 'creative',
};

export const WEATHER_TYPES = {
  CLEAR: 'clear',
  RAIN: 'rain',
  SNOW: 'snow',
};

export const BIOMES = {
  OCEAN: {
    id: 'ocean',
    name: 'Azure Coast',
    grassTint: [0.46, 0.78, 0.42],
    leafTint: [0.38, 0.72, 0.34],
    precipitation: WEATHER_TYPES.RAIN,
  },
  PLAINS: {
    id: 'plains',
    name: 'Emerald Plains',
    grassTint: [0.52, 0.82, 0.38],
    leafTint: [0.42, 0.75, 0.32],
    precipitation: WEATHER_TYPES.RAIN,
  },
  FOREST: {
    id: 'forest',
    name: 'Whispering Forest',
    grassTint: [0.41, 0.74, 0.34],
    leafTint: [0.33, 0.67, 0.28],
    precipitation: WEATHER_TYPES.RAIN,
  },
  BIRCH: {
    id: 'birch',
    name: 'Sunlit Birch Grove',
    grassTint: [0.55, 0.80, 0.42],
    leafTint: [0.58, 0.78, 0.36],
    precipitation: WEATHER_TYPES.RAIN,
  },
  DESERT: {
    id: 'desert',
    name: 'Golden Canyon',
    grassTint: [0.76, 0.73, 0.38],
    leafTint: [0.68, 0.68, 0.32],
    precipitation: WEATHER_TYPES.CLEAR,
  },
  TAIGA: {
    id: 'taiga',
    name: 'Boreal Taiga',
    grassTint: [0.38, 0.62, 0.44],
    leafTint: [0.28, 0.50, 0.36],
    precipitation: WEATHER_TYPES.SNOW,
  },
  ALPINE: {
    id: 'alpine',
    name: 'Snowy Peaks',
    grassTint: [0.48, 0.66, 0.52],
    leafTint: [0.36, 0.56, 0.44],
    precipitation: WEATHER_TYPES.SNOW,
  },
};

export const PRESET_SEEDS = [
  { label: 'Emerald Valley', seed: 'emerald-valley-7' },
  { label: 'Alpine Frontier', seed: 'frostpeak-citadel' },
  { label: 'Canyon Oasis', seed: 'sunbaked-mesa-42' },
  { label: 'Archipelago Cove', seed: 'azure-archipelago' },
];
