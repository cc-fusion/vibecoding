// Core world & gameplay constants for VoxelRealms

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 96;
export const SEA_LEVEL = 34;
export const CLOUD_HEIGHT = 102;

export const DEFAULT_RENDER_DISTANCE = 5;
export const MIN_RENDER_DISTANCE = 3;
export const MAX_RENDER_DISTANCE = 8;

// Player dimensions & physics
export const PLAYER_RADIUS = 0.3; // 0.6 wide x 0.6 deep
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_SNEAK_HEIGHT = 1.48;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_SNEAK_EYE_HEIGHT = 1.32;

export const GRAVITY = 28.0;
export const WATER_GRAVITY = 6.5;
export const JUMP_VELOCITY = 9.15;
export const TERMINAL_VELOCITY = 50.0;

export const WALK_SPEED = 4.5;
export const SPRINT_SPEED = 6.6;
export const SNEAK_SPEED = 2.1;
export const SWIM_SPEED = 3.6;
export const FLY_SPEED = 10.5;
export const FLY_SPRINT_SPEED = 18.0;

export const REACH_DISTANCE = 6.0;
export const MAX_HEALTH = 20; // 10 hearts
export const MAX_AIR = 10;    // 10 air bubbles

// Day-night cycle (in seconds for full 24h cycle; 0.25 = noon, 0.75 = midnight)
export const DAY_DURATION = 600;

export const GAME_MODES = {
  SURVIVAL: 'survival',
  PEACEFUL: 'peaceful',
  CREATIVE: 'creative',
};

export const BIOMES = {
  PLAINS: {
    id: 'plains',
    name: 'Emerald Plains',
    weather: 'rain',
    fogTint: [0.72, 0.86, 0.98],
  },
  FOREST: {
    id: 'forest',
    name: 'Whispering Woods',
    weather: 'rain',
    fogTint: [0.68, 0.84, 0.95],
  },
  DESERT: {
    id: 'desert',
    name: 'Golden Dunes',
    weather: 'clear',
    fogTint: [0.92, 0.86, 0.74],
  },
  TAIGA: {
    id: 'taiga',
    name: 'Snowy Taiga',
    weather: 'snow',
    fogTint: [0.78, 0.86, 0.96],
  },
  MOUNTAINS: {
    id: 'mountains',
    name: 'Alpine Peaks',
    weather: 'snow',
    fogTint: [0.74, 0.84, 0.97],
  },
  SHORE: {
    id: 'shore',
    name: 'Sunlit Shore',
    weather: 'rain',
    fogTint: [0.74, 0.88, 0.99],
  },
};

// Atlas layout constants (padded cells eliminate UV seam bleeding completely)
export const TILE_PIXELS = 16;
export const TILE_PAD = 8;
export const CELL_PIXELS = TILE_PIXELS + TILE_PAD * 2; // 32px per cell
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 8;
export const ATLAS_SIZE = ATLAS_COLS * CELL_PIXELS; // 256x256
