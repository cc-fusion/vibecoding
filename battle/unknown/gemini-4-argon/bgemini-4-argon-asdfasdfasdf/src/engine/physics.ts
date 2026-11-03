import * as THREE from 'three';
import { BLOCK, ITEMS } from './blocks';
import {
  CROUCH_SPEED,
  FLY_SPEED,
  GRAVITY,
  JUMP_VELOCITY,
  PLAYER_CROUCH_EYE_HEIGHT,
  PLAYER_CROUCH_HEIGHT,
  PLAYER_EYE_HEIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SPRINT_SPEED,
  SWIM_SPEED,
  WALK_SPEED,
  WORLD_HEIGHT,
} from './constants';
import { VoxelWorld } from './world';

export interface MovementInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
  crouch: boolean;
}

export interface StepEvents {
  landedHardDamage: number;
  footstepBlock: number | null;
  enteredWater: boolean;
}

export class PlayerPhysics {
  position = new THREE.Vector3(0.5, 48, 0.5);
  velocity = new THREE.Vector3(0, 0, 0);
  yaw = 0;
  pitch = -0.15;

  onGround = false;
  flying = false;
  inWater = false;
  headUnderwater = false;
  inLava = false;

  eyeHeight = PLAYER_EYE_HEIGHT;
  walkBobPhase = 0;
  walkDistanceAccum = 0;

  private coyoteTimer = 0;
  private jumpCooldown = 0;
  private peakFallY = 48;

  private collidesSolid(world: VoxelWorld, px: number, py: number, pz: number, height: number): boolean {
    const hw = PLAYER_WIDTH * 0.5;
    const minX = Math.floor(px - hw + 1e-4);
    const maxX = Math.floor(px + hw - 1e-4);
    const minY = Math.floor(py + 1e-4);
    const maxY = Math.floor(py + height - 1e-4);
    const minZ = Math.floor(pz - hw + 1e-4);
    const maxZ = Math.floor(pz + hw - 1e-4);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          const id = world.getBlock(x, y, z);
          if (ITEMS[id]?.solid) return true;
        }
      }
    }
    return false;
  }

  hasGroundSupport(world: VoxelWorld, px: number, py: number, pz: number): boolean {
    const hw = PLAYER_WIDTH * 0.5;
    const minX = Math.floor(px - hw + 0.02);
    const maxX = Math.floor(px + hw - 0.02);
    const checkY = Math.floor(py - 0.08);
    const minZ = Math.floor(pz - hw + 0.02);
    const maxZ = Math.floor(pz + hw - 0.02);

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        if (ITEMS[world.getBlock(x, checkY, z)]?.solid) return true;
      }
    }
    return false;
  }

  intersectsBlock(bx: number, by: number, bz: number): boolean {
    const hw = PLAYER_WIDTH * 0.5;
    const pMinX = this.position.x - hw;
    const pMaxX = this.position.x + hw;
    const pMinY = this.position.y;
    const pMaxY = this.position.y + PLAYER_HEIGHT;
    const pMinZ = this.position.z - hw;
    const pMaxZ = this.position.z + hw;

    return (
      pMaxX > bx + 0.01 &&
      pMinX < bx + 0.99 &&
      pMaxY > by + 0.01 &&
      pMinY < by + 0.99 &&
      pMaxZ > bz + 0.01 &&
      pMinZ < bz + 0.99
    );
  }

  update(world: VoxelWorld, dt: number, input: MovementInput, survivalDamageEnabled: boolean): StepEvents {
    const events: StepEvents = {
      landedHardDamage: 0,
      footstepBlock: null,
      enteredWater: false,
    };

    // Freeze vertical fall if standing over an unloaded chunk
    if (!world.isChunkLoadedAt(this.position.x, this.position.z)) {
      return events;
    }

    const steps = Math.max(1, Math.ceil(dt / 0.02));
    const subDt = Math.min(0.025, dt / steps);

    for (let s = 0; s < steps; s++) {
      this.stepOnce(world, subDt, input, survivalDamageEnabled, events);
    }

    const targetEye = input.crouch && !this.flying ? PLAYER_CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
    this.eyeHeight += (targetEye - this.eyeHeight) * Math.min(1, dt * 14);

    return events;
  }

  private stepOnce(
    world: VoxelWorld,
    dt: number,
    input: MovementInput,
    survivalDamageEnabled: boolean,
    events: StepEvents
  ): void {
    const crouchActive = input.crouch && !this.flying;
    const currentHeight = crouchActive ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    // Three.js camera looks along (-sin(yaw), 0, -cos(yaw)) when camera.rotation.y === yaw
    let wishX = 0;
    let wishZ = 0;
    if (input.forward) {
      wishX -= sinYaw;
      wishZ -= cosYaw;
    }
    if (input.backward) {
      wishX += sinYaw;
      wishZ += cosYaw;
    }
    if (input.left) {
      wishX -= cosYaw;
      wishZ += sinYaw;
    }
    if (input.right) {
      wishX += cosYaw;
      wishZ -= sinYaw;
    }

    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 1e-5) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const bodyBlock = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.55),
      Math.floor(this.position.z)
    );
    const feetBlock = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + 0.1),
      Math.floor(this.position.z)
    );
    const eyeBlock = world.getBlock(
      Math.floor(this.position.x),
      Math.floor(this.position.y + this.eyeHeight),
      Math.floor(this.position.z)
    );

    const wasInWater = this.inWater;
    this.inWater = bodyBlock === BLOCK.WATER || feetBlock === BLOCK.WATER;
    this.headUnderwater = eyeBlock === BLOCK.WATER;
    this.inLava = bodyBlock === BLOCK.LAVA || feetBlock === BLOCK.LAVA;

    if (this.inWater && !wasInWater && this.velocity.y < -3) {
      events.enteredWater = true;
    }
    if (this.inWater || this.flying) {
      this.peakFallY = this.position.y;
    }

    if (this.flying) {
      const speed = input.sprint ? FLY_SPEED * 1.65 : FLY_SPEED;
      const targetVx = wishX * speed;
      const targetVz = wishZ * speed;
      let targetVy = 0;
      if (input.jump) targetVy += speed * 0.8;
      if (input.crouch) targetVy -= speed * 0.8;

      this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, dt * 12);
      this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, dt * 12);
      this.velocity.y += (targetVy - this.velocity.y) * Math.min(1, dt * 12);
    } else if (this.inWater || this.inLava) {
      const targetVx = wishX * SWIM_SPEED;
      const targetVz = wishZ * SWIM_SPEED;
      this.velocity.x += (targetVx - this.velocity.x) * Math.min(1, dt * 8);
      this.velocity.z += (targetVz - this.velocity.z) * Math.min(1, dt * 8);

      if (input.jump) {
        this.velocity.y = Math.min(4.4, this.velocity.y + 22 * dt);
      } else if (input.crouch) {
        this.velocity.y = Math.max(-4.2, this.velocity.y - 16 * dt);
      } else {
        this.velocity.y -= GRAVITY * 0.22 * dt;
        this.velocity.y *= 1 - Math.min(0.9, 3.2 * dt);
      }
    } else {
      const moveSpeed = crouchActive
        ? CROUCH_SPEED
        : input.sprint && input.forward
        ? SPRINT_SPEED
        : WALK_SPEED;
      const accel = this.onGround ? 18 : 6.5;

      this.velocity.x += (wishX * moveSpeed - this.velocity.x) * Math.min(1, dt * accel);
      this.velocity.z += (wishZ * moveSpeed - this.velocity.z) * Math.min(1, dt * accel);
      this.velocity.y -= GRAVITY * dt;
      if (this.velocity.y < -48) this.velocity.y = -48;

      if (this.onGround) {
        this.coyoteTimer = 0.11;
      } else {
        this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
      }
      this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

      if (input.jump && this.coyoteTimer > 0 && this.jumpCooldown <= 0) {
        this.velocity.y = JUMP_VELOCITY;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpCooldown = 0.18;
        this.peakFallY = this.position.y;
      }
    }

    // --- Axis-Separated Swept Collision Resolution ---
    const oldX = this.position.x;
    const oldZ = this.position.z;

    let blockedHoriz = false;

    // 1. X Axis + Crouch Edge Guard
    const nextX = this.position.x + this.velocity.x * dt;
    if (!this.collidesSolid(world, nextX, this.position.y, this.position.z, currentHeight)) {
      if (crouchActive && this.onGround && !this.hasGroundSupport(world, nextX, this.position.y, this.position.z)) {
        this.velocity.x = 0;
      } else {
        this.position.x = nextX;
      }
    } else {
      blockedHoriz = true;
      this.velocity.x = 0;
    }

    // 2. Z Axis + Crouch Edge Guard
    const nextZ = this.position.z + this.velocity.z * dt;
    if (!this.collidesSolid(world, this.position.x, this.position.y, nextZ, currentHeight)) {
      if (crouchActive && this.onGround && !this.hasGroundSupport(world, this.position.x, this.position.y, nextZ)) {
        this.velocity.z = 0;
      } else {
        this.position.z = nextZ;
      }
    } else {
      blockedHoriz = true;
      this.velocity.z = 0;
    }

    // Smooth shoreline climb boost when swimming up onto beach ledges
    if (this.inWater && blockedHoriz && (input.jump || wishLen > 0.1)) {
      this.velocity.y = Math.max(this.velocity.y, 7.2);
    }

    // 3. Y Axis + Ground Detection + Fall Damage
    const nextY = this.position.y + this.velocity.y * dt;
    if (!this.collidesSolid(world, this.position.x, nextY, this.position.z, currentHeight)) {
      this.position.y = nextY;
      this.onGround = false;
      if (this.position.y > this.peakFallY) {
        this.peakFallY = this.position.y;
      }
    } else {
      if (this.velocity.y < 0) {
        const fallDist = this.peakFallY - this.position.y;
        if (survivalDamageEnabled && !this.flying && !this.inWater && fallDist > 3.7) {
          events.landedHardDamage = Math.max(events.landedHardDamage, Math.floor((fallDist - 3.5) * 1.15));
        }
        // Snap cleanly to top of block underneath
        this.position.y = Math.floor(nextY) + 1.0001;
        this.onGround = true;
        this.peakFallY = this.position.y;
        // Landing creative double-ground auto-exit optional feel kept predictable
      } else {
        this.position.y = Math.floor(nextY + currentHeight) - currentHeight - 0.0002;
      }
      this.velocity.y = 0;
    }

    if (this.position.y < 1.01) {
      this.position.y = 1.01;
      this.velocity.y = 0;
      this.onGround = true;
    }
    if (this.position.y > WORLD_HEIGHT + 18) {
      this.position.y = WORLD_HEIGHT + 18;
      this.velocity.y = Math.min(0, this.velocity.y);
    }

    // Track walk bobbing & footsteps
    const movedHoriz = Math.hypot(this.position.x - oldX, this.position.z - oldZ);
    if (this.onGround && !this.flying && movedHoriz > 1e-4) {
      this.walkBobPhase += movedHoriz * 3.1;
      this.walkDistanceAccum += movedHoriz;
      if (this.walkDistanceAccum >= 1.95) {
        this.walkDistanceAccum = 0;
        const under = world.getBlock(
          Math.floor(this.position.x),
          Math.floor(this.position.y - 0.15),
          Math.floor(this.position.z)
        );
        if (under !== BLOCK.AIR) events.footstepBlock = under;
      }
    }
  }
}
