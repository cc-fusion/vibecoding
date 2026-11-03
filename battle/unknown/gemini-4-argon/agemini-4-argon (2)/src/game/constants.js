export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 96;
export const SEA_LEVEL = 30;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HALF_WIDTH = PLAYER_WIDTH / 2;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_CROUCH_HEIGHT = 1.45;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_CROUCH_EYE_HEIGHT = 1.28;

export const GRAVITY = 28.0;
export const WATER_GRAVITY = 7.5;
export const TERMINAL_VELOCITY = 48.0;
export const JUMP_VELOCITY = 9.15;

export const WALK_SPEED = 4.65;
export const SPRINT_SPEED = 6.75;
export const CROUCH_SPEED = 2.25;
export const SWIM_SPEED = 3.85;
export const FLY_SPEED = 12.0;

export const REACH_DISTANCE = 5.5;
export const DAY_LENGTH_SECONDS = 600; // 10 minutes per full day-night cycle

export const GAME_MODES = {
  SURVIVAL: 'survival',
  CREATIVE: 'creative',
};

export const RENDER_DISTANCES = {
  NEAR: 3,
  BALANCED: 5,
  FAR: 7,
};

export const DEFAULT_SETTINGS = {
  renderDistance: RENDER_DISTANCES.BALANCED,
  fov: 75,
  sensitivity: 1.0,
  soundVolume: 0.75,
  musicVolume: 0.35,
  peacefulMobs: false,
  showDiagnostics: false,
  showGoals: true,
};
