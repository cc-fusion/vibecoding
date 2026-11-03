import {
  PLAYER_RADIUS,
  PLAYER_HEIGHT,
  GRAVITY,
  JUMP_VELOCITY,
  WALK_SPEED,
  SPRINT_SPEED,
  CROUCH_SPEED,
  SWIM_SPEED,
  FLY_SPEED,
  REACH_DISTANCE,
} from './constants.js';
import { BLOCK, REGISTRY } from './blocks.js';

const EPS = 0.0002;

export function getBlockTopY(id, by) {
  if (id === BLOCK.BED) return by + 0.5625;
  return by + 1.0;
}

export function aabbIntersectsWorld(world, minX, minY, minZ, maxX, maxY, maxZ) {
  const x0 = Math.floor(minX);
  const x1 = Math.floor(maxX - EPS);
  const y0 = Math.floor(minY);
  const y1 = Math.floor(maxY - EPS);
  const z0 = Math.floor(minZ);
  const z1 = Math.floor(maxZ - EPS);

  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        const id = world.getBlock(x, y, z);
        const def = REGISTRY[id];
        if (def && def.solid) {
          const topY = getBlockTopY(id, y);
          if (minY < topY - EPS && maxY > y + EPS) {
            return { hit: true, x, y, z, id, topY };
          }
        }
      }
    }
  }
  return null;
}

function hasGroundSupport(world, px, py, pz, r) {
  return Boolean(
    aabbIntersectsWorld(world, px - r + 0.02, py - 0.14, pz - r + 0.02, px + r - 0.02, py - 0.01, pz + r - 0.02)
  );
}

export function canPlaceBlockAt(world, bx, by, bz, player, newBlockId) {
  const def = REGISTRY[newBlockId];
  if (!def || !def.solid) return true; // Torches/flowers don't block player AABB

  const r = PLAYER_RADIUS - 0.02;
  const h = player.crouching ? 1.52 : PLAYER_HEIGHT;
  const pMinX = player.pos.x - r;
  const pMaxX = player.pos.x + r;
  const pMinY = player.pos.y;
  const pMaxY = player.pos.y + h;
  const pMinZ = player.pos.z - r;
  const pMaxZ = player.pos.z + r;

  const bMaxY = getBlockTopY(newBlockId, by);
  const overlapX = pMinX < bx + 1 && pMaxX > bx;
  const overlapY = pMinY < bMaxY && pMaxY > by;
  const overlapZ = pMinZ < bz + 1 && pMaxZ > bz;

  return !(overlapX && overlapY && overlapZ);
}

export function stepPlayerPhysics(player, world, input, dt, callbacks = {}) {
  const subSteps = Math.max(1, Math.ceil(dt / 0.016));
  const stepDt = Math.min(0.02, dt / subSteps);

  for (let s = 0; s < subSteps; s++) {
    stepSingle(player, world, input, stepDt, callbacks);
  }
}

function stepSingle(player, world, input, dt, callbacks) {
  const r = PLAYER_RADIUS;
  const h = player.crouching && !player.flying ? 1.52 : PLAYER_HEIGHT;

  // Check fluid states
  const feetBlock = world.getBlock(player.pos.x, player.pos.y + 0.25, player.pos.z);
  const waistBlock = world.getBlock(player.pos.x, player.pos.y + 0.85, player.pos.z);
  const eyeY = player.pos.y + (player.crouching ? 1.38 : 1.62);
  const headBlock = world.getBlock(player.pos.x, eyeY, player.pos.z);

  const inWater = feetBlock === BLOCK.WATER || waistBlock === BLOCK.WATER;
  const inLava = feetBlock === BLOCK.LAVA || waistBlock === BLOCK.LAVA;
  const headUnderwater = headBlock === BLOCK.WATER;

  if (inWater && !player.inWater && player.vel.y < -3.5) {
    callbacks.onSplash?.(Math.min(1.0, Math.abs(player.vel.y) / 12));
  }
  player.inWater = inWater;
  player.inLava = inLava;
  player.headUnderwater = headUnderwater;

  if (inWater || player.flying) {
    player.fallPeakY = player.pos.y;
  }

  // Forward/Right horizontal movement vectors from yaw
  const sinYaw = Math.sin(player.yaw);
  const cosYaw = Math.cos(player.yaw);
  // Camera looks along (-sin(yaw), 0, -cos(yaw))
  const fwdX = -sinYaw;
  const fwdZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  let wishX = fwdX * input.moveForward + rightX * input.moveRight;
  let wishZ = fwdZ * input.moveForward + rightZ * input.moveRight;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-5) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  player.crouching = Boolean(input.crouch && !player.flying && !inWater);

  // Determine target horizontal speed
  let targetSpeed = WALK_SPEED;
  if (player.flying) {
    targetSpeed = input.sprint ? FLY_SPEED * 1.55 : FLY_SPEED;
  } else if (inWater || inLava) {
    targetSpeed = SWIM_SPEED;
  } else if (player.crouching) {
    targetSpeed = CROUCH_SPEED;
  } else if (input.sprint && input.moveForward > 0 && player.hunger > 3) {
    targetSpeed = SPRINT_SPEED;
  }

  // Check if standing on slippery ice
  const underBlock = world.getBlock(player.pos.x, player.pos.y - 0.1, player.pos.z);
  const onIce = player.onGround && underBlock === BLOCK.ICE;
  const accel = player.flying
    ? 14.0
    : onIce
      ? 3.2
      : player.onGround
        ? 18.0
        : 7.5;

  const targetVx = wishX * targetSpeed;
  const targetVz = wishZ * targetSpeed;
  const blend = Math.min(1.0, accel * dt);
  player.vel.x += (targetVx - player.vel.x) * blend;
  player.vel.z += (targetVz - player.vel.z) * blend;

  // Vertical motion
  if (player.flying) {
    let vy = 0;
    if (input.jump) vy += FLY_SPEED * 0.78;
    if (input.sprint) vy -= FLY_SPEED * 0.78; // Shift descends cleanly in Creative flight
    player.vel.y += (vy - player.vel.y) * Math.min(1.0, 14.0 * dt);
  } else if (inWater || inLava) {
    player.vel.y -= GRAVITY * 0.24 * dt;
    player.vel.y *= Math.pow(0.18, dt); // Fluid drag
    if (input.jump) {
      player.vel.y = 4.2;
      // Smoothly hop onto shoreline ledge when swimming at water surface
      const frontCheck = aabbIntersectsWorld(
        world,
        player.pos.x + wishX * 0.35 - r,
        player.pos.y + 0.1,
        player.pos.z + wishZ * 0.35 - r,
        player.pos.x + wishX * 0.35 + r,
        player.pos.y + 1.0,
        player.pos.z + wishZ * 0.35 + r
      );
      if (frontCheck && headBlock === BLOCK.AIR) {
        player.vel.y = 6.9;
      }
    } else if (input.crouch) {
      player.vel.y = -3.4;
    }
  } else {
    player.vel.y = Math.max(-46.0, player.vel.y - GRAVITY * dt);
    if (input.jump && player.onGround) {
      player.vel.y = JUMP_VELOCITY;
      player.onGround = false;
      callbacks.onJump?.();
    }
  }

  // --- Axis-separated AABB resolution ---
  // 1. Y Axis
  const dy = player.vel.y * dt;
  player.pos.y += dy;
  const hitY = aabbIntersectsWorld(
    world,
    player.pos.x - r,
    player.pos.y,
    player.pos.z - r,
    player.pos.x + r,
    player.pos.y + h,
    player.pos.z + r
  );

  if (hitY) {
    if (dy < 0) {
      player.pos.y = hitY.topY + EPS;
      if (!player.onGround && !player.flying) {
        const fallDist = player.fallPeakY - player.pos.y;
        if (fallDist > 3.6 && hitY.id !== BLOCK.BED) {
          callbacks.onFallImpact?.(fallDist, hitY.id);
        } else if (fallDist > 1.2) {
          callbacks.onStep?.(hitY.id);
        }
      }
      player.onGround = true;
      player.fallPeakY = player.pos.y;
      if (player.flying && input.sprint) {
        // Touching down while descending exits flight gently like Minecraft
        player.flying = false;
      }
    } else if (dy > 0) {
      player.pos.y = hitY.y - h - EPS;
    }
    player.vel.y = 0;
  } else {
    player.onGround = false;
    if (player.pos.y > player.fallPeakY) {
      player.fallPeakY = player.pos.y;
    }
  }

  // 2. X Axis (with crouch edge-guard!)
  let dx = player.vel.x * dt;
  if (player.crouching && player.onGround && Math.abs(dx) > 1e-6) {
    if (!hasGroundSupport(world, player.pos.x + dx, player.pos.y, player.pos.z, r)) {
      dx = 0;
      player.vel.x = 0;
    }
  }
  player.pos.x += dx;
  const hitX = aabbIntersectsWorld(
    world,
    player.pos.x - r,
    player.pos.y,
    player.pos.z - r,
    player.pos.x + r,
    player.pos.y + h,
    player.pos.z + r
  );
  if (hitX) {
    if (dx > 0) player.pos.x = hitX.x - r - EPS;
    else if (dx < 0) player.pos.x = hitX.x + 1 + r + EPS;
    player.vel.x = 0;
    if (hitX.id === BLOCK.CACTUS) callbacks.onHazard?.('cactus');
  }

  // 3. Z Axis (with crouch edge-guard!)
  let dz = player.vel.z * dt;
  if (player.crouching && player.onGround && Math.abs(dz) > 1e-6) {
    if (!hasGroundSupport(world, player.pos.x, player.pos.y, player.pos.z + dz, r)) {
      dz = 0;
      player.vel.z = 0;
    }
  }
  player.pos.z += dz;
  const hitZ = aabbIntersectsWorld(
    world,
    player.pos.x - r,
    player.pos.y,
    player.pos.z - r,
    player.pos.x + r,
    player.pos.y + h,
    player.pos.z + r
  );
  if (hitZ) {
    if (dz > 0) player.pos.z = hitZ.z - r - EPS;
    else if (dz < 0) player.pos.z = hitZ.z + 1 + r + EPS;
    player.vel.z = 0;
    if (hitZ.id === BLOCK.CACTUS) callbacks.onHazard?.('cactus');
  }

  if (inLava) {
    callbacks.onHazard?.('lava');
  }

  // Footstep cadence tracking
  const horizSpeed = Math.hypot(player.vel.x, player.vel.z);
  if (player.onGround && horizSpeed > 0.6 && !player.crouching) {
    player.stepDist = (player.stepDist || 0) + horizSpeed * dt;
    if (player.stepDist >= 2.05) {
      player.stepDist = 0;
      const groundId = world.getBlock(player.pos.x, player.pos.y - 0.2, player.pos.z);
      callbacks.onStep?.(groundId || BLOCK.GRASS);
    }
  }
}

/**
 * Exact 3D DDA voxel traversal (Amanatides & Woo)
 */
export function raycastVoxel(world, ox, oy, oz, dx, dy, dz, maxDist = REACH_DISTANCE) {
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-6) return null;
  dx /= len;
  dy /= len;
  dz /= len;

  let ix = Math.floor(ox);
  let iy = Math.floor(oy);
  let iz = Math.floor(oz);

  const stepX = dx > 0 ? 1 : -1;
  const stepY = dy > 0 ? 1 : -1;
  const stepZ = dz > 0 ? 1 : -1;

  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : 1e9;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : 1e9;
  const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : 1e9;

  let tMaxX = dx > 0 ? (ix + 1 - ox) * tDeltaX : (ox - ix) * tDeltaX;
  let tMaxY = dy > 0 ? (iy + 1 - oy) * tDeltaY : (oy - iy) * tDeltaY;
  let tMaxZ = dz > 0 ? (iz + 1 - oz) * tDeltaZ : (oz - iz) * tDeltaZ;

  let t = 0;
  let nx = 0, ny = 0, nz = 0;

  for (let steps = 0; steps < 64 && t <= maxDist; steps++) {
    const id = world.getBlock(ix, iy, iz);
    if (id !== BLOCK.AIR && id !== BLOCK.WATER && id !== BLOCK.LAVA) {
      return {
        bx: ix,
        by: iy,
        bz: iz,
        nx,
        ny,
        nz,
        blockId: id,
        distance: t,
      };
    }

    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        ix += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        nx = -stepX; ny = 0; nz = 0;
      } else {
        iz += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0; ny = 0; nz = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        iy += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        nx = 0; ny = -stepY; nz = 0;
      } else {
        iz += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        nx = 0; ny = 0; nz = -stepZ;
      }
    }
  }

  return null;
}
