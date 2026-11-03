// Core world & gameplay constants for Voxterra

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const SEA_LEVEL = 34;
export const CHUNK_VOLUME = CHUNK_SIZE * WORLD_HEIGHT * CHUNK_SIZE;

// Default streaming settings
export const DEFAULT_RENDER_DISTANCE = 6; // radius in chunks (13x13 = 169 chunks)
export const MIN_RENDER_DISTANCE = 3;
export const MAX_RENDER_DISTANCE = 9;

// Physics & player dimensions
export const GRAVITY = 28.0;
export const WATER_GRAVITY = 6.5;
export const JUMP_VELOCITY = 9.15;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_SNEAK_EYE_HEIGHT = 1.46;

export const WALK_SPEED = 4.6;
export const SPRINT_SPEED = 6.6;
export const SNEAK_SPEED = 2.1;
export const SWIM_SPEED = 3.5;
export const FLY_SPEED = 11.5;
export const FLY_SPRINT_SPEED = 19.0;

export const REACH_DISTANCE = 5.5;
export const MAX_LIGHT_LEVEL = 15;

// Day/Night cycle (1 full day = 720 seconds = 12 minutes; starts at bright morning 0.23)
export const DAY_LENGTH_SECONDS = 720;

export const GAME_MODES = {
  SURVIVAL: 'survival',
  CREATIVE: 'creative',
};

export const TOOL_TYPES = {
  NONE: 'none',
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  SWORD: 'sword',
  SHEARS: 'shears',
};

export const TOOL_TIERS = {
  NONE: 0,
  WOOD: 1,
  STONE: 2,
  IRON: 3,
  GOLD: 3,
  DIAMOND: 4,
};

export const BLOCK_SHAPES = {
  CUBE: 'cube',
  CROSS: 'cross',     // Flowers, tall grass, mushrooms, dead bushes
  TORCH: 'torch',     // Thin glowing post + flame tip
  LIQUID: 'liquid',   // Slightly recessed top surface when exposed to air
  CACTUS: 'cactus',   // Slightly inset cube or full cube with prickle damage
  SLAB_BED: 'bed',    // Half-height cozy bed block
};

export const SOUND_GROUPS = {
  GRASS: 'grass',
  STONE: 'stone',
  WOOD: 'wood',
  SAND: 'sand',
  SNOW: 'snow',
  GLASS: 'glass',
  WATER: 'water',
  CLOTH: 'cloth',
};

export const WEATHER_TYPES = {
  CLEAR: 'clear',
  RAIN: 'rain',
  SNOW: 'snow',
};
