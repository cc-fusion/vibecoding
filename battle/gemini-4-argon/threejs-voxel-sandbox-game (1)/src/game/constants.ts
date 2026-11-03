export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE; // 256
export const CHUNK_VOLUME = CHUNK_AREA * WORLD_HEIGHT; // 24,576
export const SEA_LEVEL = 34;

export const MAX_LIGHT = 15;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE_HEIGHT = 1.62;
export const PLAYER_SNEAK_EYE_HEIGHT = 1.38;

export const GRAVITY = 28.0;
export const JUMP_VELOCITY = 9.05;
export const WALK_SPEED = 4.5;
export const SPRINT_SPEED = 6.6;
export const SNEAK_SPEED = 2.1;
export const FLY_SPEED = 11.5;
export const WATER_SWIM_SPEED = 3.6;

export const REACH_DISTANCE = 6.0;
export const DAY_DURATION_SECONDS = 600; // 10 real minutes per full 24h cycle

export const ATLAS_TILES_PER_ROW = 16;
export const TILE_PX = 16;
export const ATLAS_PX = ATLAS_TILES_PER_ROW * TILE_PX; // 256x256

export function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

export function voxelIndex(lx: number, y: number, lz: number): number {
  return (y * CHUNK_SIZE + lz) * CHUNK_SIZE + lx;
}

export function worldToChunkCoord(w: number): number {
  return Math.floor(w / CHUNK_SIZE);
}

export function worldToLocalCoord(w: number): number {
  const m = w % CHUNK_SIZE;
  return m < 0 ? m + CHUNK_SIZE : m;
}

export function hashSeedString(input: string): number {
  const trimmed = input.trim();
  if (/^-?\d+$/.test(trimmed)) {
    return (parseInt(trimmed, 10) | 0) >>> 0;
  }
  let h = 2166136261;
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
