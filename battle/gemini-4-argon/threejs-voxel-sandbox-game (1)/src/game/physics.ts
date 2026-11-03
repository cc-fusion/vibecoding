import { isSolidBlock } from './blocks';
import {
  FLY_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_SNEAK_EYE_HEIGHT,
  PLAYER_WIDTH,
  SNEAK_SPEED,
  SPRINT_SPEED,
  WALK_SPEED,
  WATER_SWIM_SPEED,
  WORLD_HEIGHT,
} from './constants';
import { WorldBlockGetter } from './raycast';
import { BlockId } from './types';

export interface PlayerBodyState {
  x: number;
  y: number; // feet Y
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  onGround: boolean;
  inWater: boolean;
  headUnderwater: boolean;
  flying: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  highestAirY: number;
  stepAccumulator: number;
}

export interface PlayerInputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  jump: boolean;
  sneak: boolean;
  sprint: boolean;
}

export interface PhysicsStepOutcome {
  landedDistance: number;
  steppedFootstep: boolean;
  enteredWater: boolean;
  hitCactus: boolean;
}

const EPS = 0.0005;

export function aabbIntersectsSolid(
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  getBlock: WorldBlockGetter
): boolean {
  const x0 = Math.floor(minX);
  const x1 = Math.floor(maxX - EPS);
  const y0 = Math.floor(minY);
  const y1 = Math.floor(maxY - EPS);
  const z0 = Math.floor(minZ);
  const z1 = Math.floor(maxZ - EPS);

  for (let y = y0; y <= y1; y++) {
    if (y < 0) return true;
    if (y >= WORLD_HEIGHT) continue;
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        if (isSolidBlock(getBlock(x, y, z))) {
          return true;
        }
      }
    }
  }
  return false;
}

export function wouldBlockOverlapPlayer(
  bx: number,
  by: number,
  bz: number,
  player: PlayerBodyState
): boolean {
  const hw = PLAYER_WIDTH * 0.5;
  const pMinX = player.x - hw + 0.02;
  const pMaxX = player.x + hw - 0.02;
  const pMinY = player.y + 0.02;
  const pMaxY = player.y + PLAYER_HEIGHT - 0.02;
  const pMinZ = player.z - hw + 0.02;
  const pMaxZ = player.z + hw - 0.02;

  return (
    bx + 1 > pMinX &&
    bx < pMaxX &&
    by + 1 > pMinY &&
    by < pMaxY &&
    bz + 1 > pMinZ &&
    bz < pMaxZ
  );
}

export function stepPlayerPhysics(
  state: PlayerBodyState,
  input: PlayerInputState,
  dt: number,
  getBlock: WorldBlockGetter,
  autoStep = false
): PhysicsStepOutcome {
  const hw = PLAYER_WIDTH * 0.5;
  const wasInWater = state.inWater;
  const wasOnGround = state.onGround;

  // Detect water submersion at waist/feet & eyes
  const feetBlock = getBlock(Math.floor(state.x), Math.floor(state.y + 0.35), Math.floor(state.z));
  const waistBlock = getBlock(Math.floor(state.x), Math.floor(state.y + 0.95), Math.floor(state.z));
  const eyeY = state.y + (input.sneak ? PLAYER_SNEAK_EYE_HEIGHT : PLAYER_EYE_HEIGHT);
  const eyeBlock = getBlock(Math.floor(state.x), Math.floor(eyeY), Math.floor(state.z));

  state.inWater = feetBlock === BlockId.Water || waistBlock === BlockId.Water;
  state.headUnderwater = eyeBlock === BlockId.Water;

  if (state.inWater) {
    state.highestAirY = state.y;
  }

  // Forward / right horizontal basis in Three.js camera convention:
  // yaw=0 looks toward -Z, +yaw rotates left (or standard yaw where forward = (-sin(yaw), -cos(yaw)))
  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);
  const fwdX = -sinYaw;
  const fwdZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = -sinYaw;

  let wishX = fwdX * input.forward + rightX * input.strafe;
  let wishZ = fwdZ * input.forward + rightZ * input.strafe;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-5) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  let targetSpeed = WALK_SPEED;
  if (state.flying) {
    targetSpeed = input.sprint ? FLY_SPEED * 1.55 : FLY_SPEED;
  } else if (state.inWater) {
    targetSpeed = WATER_SWIM_SPEED;
  } else if (input.sneak) {
    targetSpeed = SNEAK_SPEED;
  } else if (input.sprint && input.forward > 0) {
    targetSpeed = SPRINT_SPEED;
  }

  const accel = state.flying ? 18 : state.onGround ? 24 : 9.5;
  const blend = Math.min(1, accel * dt);
  state.vx += (wishX * targetSpeed - state.vx) * blend;
  state.vz += (wishZ * targetSpeed - state.vz) * blend;

  // Vertical dynamics
  if (state.flying) {
    let targetVy = 0;
    if (input.jump) targetVy += FLY_SPEED * 0.8;
    if (input.sneak) targetVy -= FLY_SPEED * 0.8;
    state.vy += (targetVy - state.vy) * Math.min(1, 16 * dt);
    state.highestAirY = state.y;
  } else if (state.inWater) {
    if (input.jump) {
      state.vy = Math.min(4.4, state.vy + 18 * dt);
    } else if (input.sneak) {
      state.vy = Math.max(-4.5, state.vy - 16 * dt);
    } else {
      state.vy -= GRAVITY * 0.22 * dt;
      state.vy *= Math.pow(0.18, dt);
    }
  } else {
    if (state.onGround) {
      state.coyoteTimer = 0.11;
    } else {
      state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
      state.highestAirY = Math.max(state.highestAirY, state.y);
    }

    if (input.jump) {
      state.jumpBufferTimer = 0.11;
    } else {
      state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
    }

    if (state.coyoteTimer > 0 && state.jumpBufferTimer > 0) {
      state.vy = JUMP_VELOCITY;
      state.onGround = false;
      state.coyoteTimer = 0;
      state.jumpBufferTimer = 0;
      state.highestAirY = state.y;
    }

    state.vy = Math.max(-46, state.vy - GRAVITY * dt);
  }

  // Sneak edge guard: prevent walking off ledges when holding Shift on solid ground!
  let dx = state.vx * dt;
  let dy = state.vy * dt;
  let dz = state.vz * dt;

  if (!state.flying && state.onGround && input.sneak) {
    if (
      dx !== 0 &&
      !aabbIntersectsSolid(
        state.x + dx - hw,
        state.y - 0.6,
        state.z - hw,
        state.x + dx + hw,
        state.y - 0.05,
        state.z + hw,
        getBlock
      )
    ) {
      dx = 0;
      state.vx = 0;
    }
    if (
      dz !== 0 &&
      !aabbIntersectsSolid(
        state.x - hw,
        state.y - 0.6,
        state.z + dz - hw,
        state.x + hw,
        state.y - 0.05,
        state.z + dz + hw,
        getBlock
      )
    ) {
      dz = 0;
      state.vz = 0;
    }
  }

  // Axis-separated collision resolution: Y -> X -> Z
  state.onGround = false;
  let landedDistance = 0;

  // Y sweep
  if (dy !== 0) {
    if (
      !aabbIntersectsSolid(
        state.x - hw,
        state.y + dy,
        state.z - hw,
        state.x + hw,
        state.y + dy + PLAYER_HEIGHT,
        state.z + hw,
        getBlock
      )
    ) {
      state.y += dy;
    } else {
      if (dy < 0) {
        state.y = Math.floor(state.y + dy) + 1.0 + EPS;
        state.onGround = true;
        if (!wasOnGround && !state.inWater && !state.flying) {
          landedDistance = Math.max(0, state.highestAirY - state.y);
        }
        state.highestAirY = state.y;
      } else {
        state.y = Math.floor(state.y + dy + PLAYER_HEIGHT) - PLAYER_HEIGHT - EPS;
      }
      state.vy = 0;
    }
  } else {
    state.onGround = aabbIntersectsSolid(
      state.x - hw,
      state.y - 0.05,
      state.z - hw,
      state.x + hw,
      state.y,
      state.z + hw,
      getBlock
    );
  }

  // X sweep (with optional auto-step over 1-block ledges when enabled)
  let hitCactus = false;
  if (dx !== 0) {
    if (
      !aabbIntersectsSolid(
        state.x + dx - hw,
        state.y,
        state.z - hw,
        state.x + dx + hw,
        state.y + PLAYER_HEIGHT,
        state.z + hw,
        getBlock
      )
    ) {
      state.x += dx;
    } else if (
      autoStep &&
      state.onGround &&
      !input.sneak &&
      !aabbIntersectsSolid(
        state.x + dx - hw,
        state.y + 1.02,
        state.z - hw,
        state.x + dx + hw,
        state.y + 1.02 + PLAYER_HEIGHT,
        state.z + hw,
        getBlock
      )
    ) {
      state.y += 1.02;
      state.x += dx;
    } else {
      const probeX = dx > 0 ? Math.floor(state.x + dx + hw) : Math.floor(state.x + dx - hw);
      if (getBlock(probeX, Math.floor(state.y + 0.5), Math.floor(state.z)) === BlockId.Cactus) {
        hitCactus = true;
      }
      state.vx = 0;
    }
  }

  // Z sweep
  if (dz !== 0) {
    if (
      !aabbIntersectsSolid(
        state.x - hw,
        state.y,
        state.z + dz - hw,
        state.x + hw,
        state.y + PLAYER_HEIGHT,
        state.z + dz + hw,
        getBlock
      )
    ) {
      state.z += dz;
    } else if (
      autoStep &&
      state.onGround &&
      !input.sneak &&
      !aabbIntersectsSolid(
        state.x - hw,
        state.y + 1.02,
        state.z + dz - hw,
        state.x + hw,
        state.y + 1.02 + PLAYER_HEIGHT,
        state.z + dz + hw,
        getBlock
      )
    ) {
      state.y += 1.02;
      state.z += dz;
    } else {
      const probeZ = dz > 0 ? Math.floor(state.z + dz + hw) : Math.floor(state.z + dz - hw);
      if (getBlock(Math.floor(state.x), Math.floor(state.y + 0.5), probeZ) === BlockId.Cactus) {
        hitCactus = true;
      }
      state.vz = 0;
    }
  }

  // Track footstep cadence
  let steppedFootstep = false;
  const horizSpeed = Math.hypot(state.vx, state.vz);
  if (state.onGround && !state.flying && horizSpeed > 0.4) {
    state.stepAccumulator += horizSpeed * dt;
    if (state.stepAccumulator >= 2.05) {
      state.stepAccumulator = 0;
      steppedFootstep = true;
    }
  }

  return {
    landedDistance,
    steppedFootstep,
    enteredWater: !wasInWater && state.inWater,
    hitCactus,
  };
}
