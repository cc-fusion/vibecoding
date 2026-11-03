import { BlockId } from './types';

export interface RaycastHit {
  wx: number;
  wy: number;
  wz: number;
  nx: number;
  ny: number;
  nz: number;
  distance: number;
  blockId: BlockId;
}

export type WorldBlockGetter = (wx: number, wy: number, wz: number) => BlockId;

export function raycastVoxel(
  originX: number,
  originY: number,
  originZ: number,
  dirX: number,
  dirY: number,
  dirZ: number,
  maxDistance: number,
  getBlock: WorldBlockGetter
): RaycastHit | null {
  const len = Math.hypot(dirX, dirY, dirZ);
  if (len < 1e-6) return null;
  const dx = dirX / len;
  const dy = dirY / len;
  const dz = dirZ / len;

  let x = Math.floor(originX);
  let y = Math.floor(originY);
  let z = Math.floor(originZ);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

  let tMaxX =
    stepX > 0
      ? (x + 1 - originX) * tDeltaX
      : stepX < 0
      ? (originX - x) * tDeltaX
      : Infinity;
  let tMaxY =
    stepY > 0
      ? (y + 1 - originY) * tDeltaY
      : stepY < 0
      ? (originY - y) * tDeltaY
      : Infinity;
  let tMaxZ =
    stepZ > 0
      ? (z + 1 - originZ) * tDeltaZ
      : stepZ < 0
      ? (originZ - z) * tDeltaZ
      : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;

  for (let iter = 0; iter < 128; iter++) {
    const id = getBlock(x, y, z);
    if (id !== BlockId.Air && id !== BlockId.Water) {
      return {
        wx: x,
        wy: y,
        wz: z,
        nx,
        ny,
        nz,
        distance: dist,
        blockId: id,
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        dist = tMaxX;
        if (dist > maxDistance) break;
        x += stepX;
        tMaxX += tDeltaX;
        nx = -stepX;
        ny = 0;
        nz = 0;
      } else {
        dist = tMaxZ;
        if (dist > maxDistance) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        dist = tMaxY;
        if (dist > maxDistance) break;
        y += stepY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        dist = tMaxZ;
        if (dist > maxDistance) break;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
  }

  return null;
}
