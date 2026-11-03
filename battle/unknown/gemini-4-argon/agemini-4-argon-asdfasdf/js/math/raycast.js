// Exact 3D DDA Voxel Raycast (Amanatides & Woo)

export function raycastVoxel(getBlock, origin, direction, maxDistance, isTargetable) {
  const dx = direction.x;
  const dy = direction.y;
  const dz = direction.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-8) return null;

  const rx = dx / len;
  const ry = dy / len;
  const rz = dz / len;

  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = rx > 0 ? 1 : rx < 0 ? -1 : 0;
  const stepY = ry > 0 ? 1 : ry < 0 ? -1 : 0;
  const stepZ = rz > 0 ? 1 : rz < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? Math.abs(1 / rx) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / ry) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / rz) : Infinity;

  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;

  let nx = 0;
  let ny = 0;
  let nz = 0;
  let dist = 0;

  const maxSteps = Math.ceil(maxDistance * 3) + 4;
  for (let i = 0; i < maxSteps; i++) {
    const blockId = getBlock(x, y, z);
    if (isTargetable(blockId)) {
      return {
        x,
        y,
        z,
        blockId,
        distance: dist,
        normal: { x: nx, y: ny, z: nz },
        placePos: { x: x + nx, y: y + ny, z: z + nz },
        hitPoint: {
          x: origin.x + rx * dist,
          y: origin.y + ry * dist,
          z: origin.z + rz * dist,
        },
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
    } else if (tMaxY < tMaxZ) {
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

  return null;
}
