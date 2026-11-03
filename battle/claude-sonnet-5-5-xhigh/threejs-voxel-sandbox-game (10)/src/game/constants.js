// Core world constants shared by every system.
export const CS = 16;              // chunk width/depth in blocks
export const CH = 128;             // world height in blocks
export const SEA = 36;             // sea level (top water block y)
export const CHUNK_AREA = CS * CS;
export const CHUNK_VOL = CS * CS * CH;

export const DAY_LENGTH = 960;     // seconds for a full day/night cycle
export const REACH = 5.2;
export const GRAVITY = 32;

export const SAVE_VERSION = 1;

// index helper: y-major so horizontal layers are contiguous
export const idx = (x, y, z) => (y << 8) | (z << 4) | x;
export const chunkKey = (cx, cz) => ((cx & 0xffff) << 16) | (cz & 0xffff);
