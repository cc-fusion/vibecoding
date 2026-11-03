// Shared voxel engine constants and coordinate helpers

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 96;
export const SEA_LEVEL = 28;
export const LAVA_LEVEL = 7;
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

export const RENDER_TYPE = {
  NONE: 0,
  SOLID: 1,
  CUTOUT: 2,   // Leaves, glass (alpha cutout, faces culled carefully)
  CROSS: 3,    // Tall grass, flowers, mushrooms, saplings
  TORCH: 4,    // Standing/tilted glowing voxel torch stick
  FLUID: 5,    // Translucent animated water / glowing lava
};

export const TOOL_TYPE = {
  NONE: 'none',
  PICKAXE: 'pickaxe',
  AXE: 'axe',
  SHOVEL: 'shovel',
  SWORD: 'sword',
};

export const SOUND_GROUP = {
  GRASS: 'grass',
  STONE: 'stone',
  WOOD: 'wood',
  SAND: 'sand',
  GLASS: 'glass',
  WATER: 'water',
  SNOW: 'snow',
};

export function voxelIndex(lx, y, lz) {
  return (lx * CHUNK_SIZE + lz) * CHUNK_HEIGHT + y;
}

export function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

export function worldToChunkCoord(w) {
  return Math.floor(w / CHUNK_SIZE);
}

export function worldToLocalCoord(w) {
  return ((Math.floor(w) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
}
