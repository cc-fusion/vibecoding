// ───────────────────────────────────────────────────────────────────────────
//  Global world constants
// ───────────────────────────────────────────────────────────────────────────

export const CHUNK_X = 16;
export const CHUNK_Z = 16;
export const WORLD_HEIGHT = 128;
export const SECTION_H = 16;
export const SECTIONS = WORLD_HEIGHT / SECTION_H;

export const CHUNK_AREA = CHUNK_X * CHUNK_Z;
export const CHUNK_VOLUME = CHUNK_X * CHUNK_Z * WORLD_HEIGHT;

export const SEA_LEVEL = 46;
export const MAX_LIGHT = 15;

/** index inside a chunk's flat block array */
export function idx(x: number, y: number, z: number): number {
  return (y * CHUNK_Z + z) * CHUNK_X + x;
}

export function chunkKey(cx: number, cz: number): string {
  return cx + "," + cz;
}

export const FACE_DIRS: ReadonlyArray<[number, number, number]> = [
  [0, 1, 0], // 0 +Y  top
  [0, -1, 0], // 1 -Y  bottom
  [1, 0, 0], // 2 +X
  [-1, 0, 0], // 3 -X
  [0, 0, 1], // 4 +Z
  [0, 0, -1], // 5 -Z
];

export const GRAVITY = 28;
export const TERMINAL_VELOCITY = 58;

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;
export const PLAYER_EYE = 1.62;
export const PLAYER_CROUCH_HEIGHT = 1.45;
export const PLAYER_CROUCH_EYE = 1.3;

export const REACH = 5.2;

export const DAY_LENGTH = 600; // seconds for a full day cycle

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
