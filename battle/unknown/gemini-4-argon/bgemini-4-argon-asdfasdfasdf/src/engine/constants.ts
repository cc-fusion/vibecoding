export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const SEA_LEVEL = 34;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.78;
export const PLAYER_CROUCH_HEIGHT = 1.42;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_CROUCH_EYE_HEIGHT = 1.28;

export const GRAVITY = 26.0;
export const JUMP_VELOCITY = 8.7;
export const WALK_SPEED = 4.6;
export const SPRINT_SPEED = 6.9;
export const CROUCH_SPEED = 2.1;
export const FLY_SPEED = 11.5;
export const SWIM_SPEED = 3.8;
export const REACH_DISTANCE = 6.0;

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36; // 0..8 hotbar, 9..35 backpack
export const MAX_STACK = 64;

export const DAY_DURATION_SECONDS = 480; // 8 real minutes per full day-night cycle

export type GameMode = 'survival' | 'creative';
export type WeatherType = 'clear' | 'rain' | 'snow';
export type BiomeId = 'plains' | 'forest' | 'desert' | 'taiga' | 'mountains' | 'ocean';

export interface InventorySlot {
  id: number;
  count: number;
  durability?: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface WorldSaveMeta {
  id: string;
  name: string;
  seed: number;
  seedText: string;
  gameMode: GameMode;
  createdAt: number;
  updatedAt: number;
  dayCount: number;
}

export interface TargetBlockInfo {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  blockId: number;
  name: string;
  breakProgress: number; // 0..1
}

export interface GameHUDState {
  ready: boolean;
  loadingProgress: number;
  loadingMessage: string;
  worldName: string;
  seed: number;
  gameMode: GameMode;
  flying: boolean;
  paused: boolean;
  inventoryOpen: boolean;
  pointerLocked: boolean;
  health: number;
  maxHealth: number;
  hunger: number;
  maxHunger: number;
  oxygen: number;
  maxOxygen: number;
  underwater: boolean;
  inLava: boolean;
  position: { x: number; y: number; z: number };
  yaw: number;
  fps: number;
  loadedChunks: number;
  entityCount: number;
  biome: BiomeId;
  biomeLabel: string;
  timeOfDay: number; // 0..1 (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight)
  dayCount: number;
  weather: WeatherType;
  selectedHotbar: number;
  inventory: (InventorySlot | null)[];
  targetBlock: TargetBlockInfo | null;
  achievements: Achievement[];
  toast: { id: number; title: string; subtitle?: string; type?: 'achievement' | 'info' | 'warning' } | null;
  isDead: boolean;
  renderDistance: number;
  fov: number;
  soundEnabled: boolean;
}
