// Core world, physics, and gameplay constants for TerraCraft

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE;
export const CHUNK_VOLUME = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE;
export const SEA_LEVEL = 34;

// Texture atlas layout (16x16 pixel-art tiles padded inside 32x32 slots to eliminate UV bleeding)
export const TILE_PX = 16;
export const SLOT_PAD = 8;
export const SLOT_PX = TILE_PX + SLOT_PAD * 2; // 32px per slot
export const ATLAS_COLS = 12;
export const ATLAS_ROWS = 8;
export const ATLAS_WIDTH = ATLAS_COLS * SLOT_PX;
export const ATLAS_HEIGHT = ATLAS_ROWS * SLOT_PX;

// Player physics & movement
export const GRAVITY = 26.0;
export const WATER_GRAVITY = 5.5;
export const JUMP_VELOCITY = 8.95;
export const WALK_SPEED = 4.55;
export const SPRINT_SPEED = 6.45;
export const SNEAK_SPEED = 2.15;
export const SWIM_SPEED = 3.6;
export const FLY_SPEED = 11.5;
export const FLY_SPRINT_SPEED = 21.0;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HALF_W = PLAYER_WIDTH * 0.5;
export const PLAYER_HEIGHT = 1.78;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_SNEAK_EYE_HEIGHT = 1.42;

export const REACH_SURVIVAL = 5.5;
export const REACH_CREATIVE = 7.5;

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
  OCEAN: 'Ocean',
  BEACH: 'Golden Beach',
  PLAINS: 'Emerald Plains',
  MEADOW: 'Wildflower Meadow',
  FOREST: 'Whispering Forest',
  BIRCH_GROVE: 'Silver Birch Grove',
  DESERT: 'Sunlit Dunes',
  TAIGA: 'Frostpine Taiga',
  PEAKS: 'Alpine Peaks',
};

export const DAY_LENGTH_SECONDS = 600; // 10 minutes per full day-night cycle
