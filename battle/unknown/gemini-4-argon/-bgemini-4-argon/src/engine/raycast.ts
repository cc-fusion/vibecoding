import { BLOCK, ITEMS } from './blocks';
import { VoxelWorld } from './world';

export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  distance: number;
  blockId: number;
}

export function raycastVoxel(
  world: VoxelWorld,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number
): RaycastHit | null {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return null;
  dx /= len;
  dy /= len;
  dz /= len;

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : 1e9;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : 1e9;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : 1e9;

  let tMaxX = dx > 0 ? (x + 1 - ox) * tDeltaX : (ox - x) * tDeltaX;
  let tMaxY = dy > 0 ? (y + 1 - oy) * tDeltaY : (oy - y) * tDeltaY;
  let tMaxZ = dz > 0 ? (z + 1 - oz) * tDeltaZ : (oz - z) * tDeltaZ;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;

  for (let i = 0; i < 64 && dist <= maxDist; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA) {
      const def = ITEMS[id];
      if (def) {
        return { x, y, z, nx, ny, nz, distance: dist, blockId: id };
      }
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        tMaxX += tDeltaX;
        x += stepX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else {
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        dist = tMaxY;
        tMaxY += tDeltaY;
        y += stepY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        z += stepZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
  }

  return null;
}
