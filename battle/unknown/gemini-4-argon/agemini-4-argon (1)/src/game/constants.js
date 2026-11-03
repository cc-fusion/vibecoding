export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const SEA_LEVEL = 44;

export const GRAVITY = 28.0;
export const JUMP_VELOCITY = 9.1;
export const TERMINAL_VELOCITY = 46.0;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HALF_WIDTH = PLAYER_WIDTH / 2;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_CROUCH_EYE_HEIGHT = 1.34;

export const WALK_SPEED = 4.7;
export const SPRINT_SPEED = 6.8;
export const CROUCH_SPEED = 2.15;
export const SWIM_SPEED = 3.9;
export const FLY_SPEED = 12.0;

export const REACH_DISTANCE = 5.6;
export const DAY_LENGTH_SECONDS = 600; // 10 minutes per full 24h cycle

export const GAME_MODES = {
  SURVIVAL: 'survival',
  CREATIVE: 'creative',
};

export const WEATHER_TYPES = {
  CLEAR: 'clear',
  RAIN: 'rain',
  SNOW: 'snow',
};

export const RENDER_PASS = {
  OPAQUE: 0,
  CUTOUT: 1,
  TRANSLUCENT: 2,
};

export const MESH_SHAPE = {
  CUBE: 'cube',
  CROSS: 'cross',
  TORCH: 'torch',
  LIQUID: 'liquid',
  BED: 'bed',
  CACTUS: 'cactus',
  LADDER: 'ladder',
};

export const TOOL_TYPES = {
  NONE: 'none',
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  SWORD: 'sword',
};

export const SOUND_MATERIAL = {
  GRASS: 'grass',
  DIRT: 'dirt',
  STONE: 'stone',
  WOOD: 'wood',
  SAND: 'sand',
  GLASS: 'glass',
  WATER: 'water',
  WOOL: 'wool',
  METAL: 'metal',
};

export const BIOMES = {
  OCEAN: { id: 'ocean', name: 'Deep Ocean', temp: 0.5, humidity: 0.8 },
  BEACH: { id: 'beach', name: 'Golden Shore', temp: 0.65, humidity: 0.6 },
  PLAINS: { id: 'plains', name: 'Emerald Plains', temp: 0.58, humidity: 0.48 },
  FOREST: { id: 'forest', name: 'Birch & Oak Woods', temp: 0.54, humidity: 0.72 },
  DESERT: { id: 'desert', name: 'Sunscorched Dunes', temp: 0.92, humidity: 0.12 },
  TAIGA: { id: 'taiga', name: 'Snowy Taiga', temp: 0.16, humidity: 0.55 },
  PEAKS: { id: 'peaks', name: 'Alpine Crags', temp: 0.22, humidity: 0.35 },
};
