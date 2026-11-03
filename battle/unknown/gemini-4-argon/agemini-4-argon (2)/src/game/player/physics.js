import { BLOCK, isSolidBlock } from '../blocks.js';
import { CHUNK_HEIGHT } from '../constants.js';

const EPS = 0.0002;

export function aabbIntersectsSolid(world, minX, minY, minZ, maxX, maxY, maxZ) {
  const x0 = Math.floor(minX + EPS);
  const x1 = Math.floor(maxX - EPS);
  const y0 = Math.floor(minY + EPS);
  const y1 = Math.floor(maxY - EPS);
  const z0 = Math.floor(minZ + EPS);
  const z1 = Math.floor(maxZ - EPS);

  for (let y = y0; y <= y1; y++) {
    if (y < 0) return true;
    if (y >= CHUNK_HEIGHT) continue;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (isSolidBlock(world.getBlock(x, y, z))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function entityIntersectsBlock(pos, halfWidth, height, bx, by, bz) {
  const minX = pos.x - halfWidth + EPS;
  const maxX = pos.x + halfWidth - EPS;
  const minY = pos.y + EPS;
  const maxY = pos.y + height - EPS;
  const minZ = pos.z - halfWidth + EPS;
  const maxZ = pos.z + halfWidth - EPS;

  return (
    maxX > bx && minX < bx + 1 &&
    maxY > by && minY < by + 1 &&
    maxZ > bz && minZ < bz + 1
  );
}

export function isBoxInWater(world, pos, halfWidth, height) {
  const x0 = Math.floor(pos.x - halfWidth * 0.6);
  const x1 = Math.floor(pos.x + halfWidth * 0.6);
  const y0 = Math.floor(pos.y + 0.15);
  const y1 = Math.floor(pos.y + height * 0.72);
  const z0 = Math.floor(pos.z - halfWidth * 0.6);
  const z1 = Math.floor(pos.z + halfWidth * 0.6);

  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (world.getBlock(x, y, z) === BLOCK.WATER) {
          return true;
        }
      }
    }
  }
  return false;
}

export function moveEntityWithCollisions(world, entity, dt, crouchEdgeGuard = false) {
  const hw = entity.halfWidth;
  const h = entity.height;
  const totalDx = entity.vel.x * dt;
  const totalDy = entity.vel.y * dt;
  const totalDz = entity.vel.z * dt;

  const maxDisp = Math.max(Math.abs(totalDx), Math.abs(totalDy), Math.abs(totalDz));
  const steps = Math.max(1, Math.ceil(maxDisp / 0.32));

  const stepDx = totalDx / steps;
  const stepDy = totalDy / steps;
  const stepDz = totalDz / steps;

  let hitGround = false;
  let hitCeiling = false;
  let hitWallX = false;
  let hitWallZ = false;

  for (let s = 0; s < steps; s++) {
    // 1. Resolve Y
    if (stepDy !== 0) {
      const nextY = entity.pos.y + stepDy;
      if (!aabbIntersectsSolid(world, entity.pos.x - hw, nextY, entity.pos.z - hw, entity.pos.x + hw, nextY + h, entity.pos.z + hw)) {
        entity.pos.y = nextY;
      } else {
        if (stepDy < 0) {
          entity.pos.y = Math.floor(nextY + EPS) + 1.0;
          hitGround = true;
        } else {
          entity.pos.y = Math.floor(nextY + h - EPS) - h;
          hitCeiling = true;
        }
        entity.vel.y = 0;
      }
    }

    // Crouch edge-guard: prevent walking off ledges while sneaking on ground
    let allowDx = stepDx;
    let allowDz = stepDz;
    if (crouchEdgeGuard && (entity.onGround || hitGround)) {
      if (allowDx !== 0) {
        const testX = entity.pos.x + allowDx;
        const supportedX = aabbIntersectsSolid(
          world,
          testX - hw,
          entity.pos.y - 0.6,
          entity.pos.z - hw,
          testX + hw,
          entity.pos.y - 0.02,
          entity.pos.z + hw
        );
        if (!supportedX) {
          allowDx = 0;
          entity.vel.x = 0;
        }
      }
      if (allowDz !== 0) {
        const testZ = entity.pos.z + allowDz;
        const supportedZ = aabbIntersectsSolid(
          world,
          entity.pos.x - hw,
          entity.pos.y - 0.6,
          testZ - hw,
          entity.pos.x + hw,
          entity.pos.y - 0.02,
          testZ + hw
        );
        if (!supportedZ) {
          allowDz = 0;
          entity.vel.z = 0;
        }
      }
    }

    // 2. Resolve X
    if (allowDx !== 0) {
      const nextX = entity.pos.x + allowDx;
      if (!aabbIntersectsSolid(world, nextX - hw, entity.pos.y, entity.pos.z - hw, nextX + hw, entity.pos.y + h, entity.pos.z + hw)) {
        entity.pos.x = nextX;
      } else {
        if (allowDx > 0) {
          entity.pos.x = Math.floor(nextX + hw - EPS) - hw;
        } else {
          entity.pos.x = Math.floor(nextX - hw + EPS) + 1.0 + hw;
        }
        entity.vel.x = 0;
        hitWallX = true;
      }
    }

    // 3. Resolve Z
    if (allowDz !== 0) {
      const nextZ = entity.pos.z + allowDz;
      if (!aabbIntersectsSolid(world, entity.pos.x - hw, entity.pos.y, nextZ - hw, entity.pos.x + hw, entity.pos.y + h, nextZ + hw)) {
        entity.pos.z = nextZ;
      } else {
        if (allowDz > 0) {
          entity.pos.z = Math.floor(nextZ + hw - EPS) - hw;
        } else {
          entity.pos.z = Math.floor(nextZ - hw + EPS) + 1.0 + hw;
        }
        entity.vel.z = 0;
        hitWallZ = true;
      }
    }
  }

  // Final ground contact check
  const groundedNow = hitGround || aabbIntersectsSolid(
    world,
    entity.pos.x - hw,
    entity.pos.y - 0.04,
    entity.pos.z - hw,
    entity.pos.x + hw,
    entity.pos.y - 0.001,
    entity.pos.z + hw
  );

  entity.onGround = groundedNow;
  if (hitCeiling && entity.vel.y > 0) entity.vel.y = 0;

  return {
    hitGround: groundedNow,
    hitCeiling,
    hitWall: hitWallX || hitWallZ,
  };
}
