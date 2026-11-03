import * as THREE from "three";
import { B, SOLID, block } from "./blocks";
import type { World } from "./world";
import { GRAVITY, TERMINAL_VELOCITY, WORLD_HEIGHT } from "./constants";

export interface Body {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  width: number;
  height: number;
  onGround: boolean;
  inWater: boolean;
  inLava: boolean;
  headInWater: boolean;
  onLadder: boolean;
  stepHeight: number;
  slip: number;
}

export function makeBody(x: number, y: number, z: number, w: number, h: number): Body {
  return {
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    width: w,
    height: h,
    onGround: false,
    inWater: false,
    inLava: false,
    headInWater: false,
    onLadder: false,
    stepHeight: 0.6,
    slip: 0.6,
  };
}

const EPS = 1e-4;

function collides(world: World, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number) {
  const x0 = Math.floor(minX + EPS);
  const x1 = Math.floor(maxX - EPS);
  const y0 = Math.floor(minY + EPS);
  const y1 = Math.floor(maxY - EPS);
  const z0 = Math.floor(minZ + EPS);
  const z1 = Math.floor(maxZ - EPS);
  for (let y = y0; y <= y1; y++) {
    if (y < 0 || y >= WORLD_HEIGHT) {
      if (y < 0) return true;
      continue;
    }
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        if (SOLID[world.getBlock(x, y, z)]) return true;
      }
  }
  return false;
}

/** axis separated AABB movement with automatic step-up */
export function moveBody(world: World, b: Body, dt: number, allowStep = true) {
  const hw = b.width / 2;
  const p = b.pos;

  // environment sampling
  const feet = world.getBlock(Math.floor(p.x), Math.floor(p.y + 0.1), Math.floor(p.z));
  const mid = world.getBlock(Math.floor(p.x), Math.floor(p.y + b.height * 0.5), Math.floor(p.z));
  const head = world.getBlock(Math.floor(p.x), Math.floor(p.y + b.height * 0.9), Math.floor(p.z));
  b.inWater = feet === B.WATER || mid === B.WATER;
  b.inLava = feet === B.LAVA || mid === B.LAVA;
  b.headInWater = head === B.WATER;
  b.onLadder = feet === B.LADDER || mid === B.LADDER;

  // gravity
  if (!b.onLadder) {
    const g = b.inWater ? GRAVITY * 0.28 : b.inLava ? GRAVITY * 0.22 : GRAVITY;
    b.vel.y -= g * dt;
  }
  const term = b.inWater ? 6 : b.inLava ? 3 : TERMINAL_VELOCITY;
  if (b.vel.y < -term) b.vel.y = -term;
  if (b.inWater) {
    b.vel.x *= Math.pow(0.52, dt * 20);
    b.vel.z *= Math.pow(0.52, dt * 20);
    b.vel.y *= Math.pow(0.72, dt * 20);
  }

  let dx = b.vel.x * dt;
  let dy = b.vel.y * dt;
  let dz = b.vel.z * dt;
  const maxStep = 0.45;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / maxStep));
  const sx = dx / steps,
    sy = dy / steps,
    sz = dz / steps;

  b.onGround = false;
  for (let s = 0; s < steps; s++) {
    // Y
    if (sy !== 0) {
      const ny = p.y + sy;
      if (collides(world, p.x - hw, ny, p.z - hw, p.x + hw, ny + b.height, p.z + hw)) {
        if (sy < 0) {
          p.y = Math.floor(ny) + 1;
          b.onGround = true;
        } else {
          p.y = Math.ceil(ny + b.height) - b.height - EPS * 2;
        }
        b.vel.y = 0;
      } else p.y = ny;
    }
    // X
    if (sx !== 0) {
      const nx = p.x + sx;
      if (collides(world, nx - hw, p.y, p.z - hw, nx + hw, p.y + b.height, p.z + hw)) {
        let stepped = false;
        if (allowStep && b.onGround) {
          const up = b.stepHeight;
          if (
            !collides(world, nx - hw, p.y + up, p.z - hw, nx + hw, p.y + up + b.height, p.z + hw) &&
            !collides(world, p.x - hw, p.y + up, p.z - hw, p.x + hw, p.y + up + b.height, p.z + hw)
          ) {
            p.y += up;
            p.x = nx;
            stepped = true;
          }
        }
        if (!stepped) b.vel.x = 0;
      } else p.x = nx;
    }
    // Z
    if (sz !== 0) {
      const nz = p.z + sz;
      if (collides(world, p.x - hw, p.y, nz - hw, p.x + hw, p.y + b.height, nz + hw)) {
        let stepped = false;
        if (allowStep && b.onGround) {
          const up = b.stepHeight;
          if (
            !collides(world, p.x - hw, p.y + up, nz - hw, p.x + hw, p.y + up + b.height, nz + hw) &&
            !collides(world, p.x - hw, p.y + up, p.z - hw, p.x + hw, p.y + up + b.height, p.z + hw)
          ) {
            p.y += up;
            p.z = nz;
            stepped = true;
          }
        }
        if (!stepped) b.vel.z = 0;
      } else p.z = nz;
    }
  }

  // ground friction
  if (b.onGround) {
    const below = world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.2), Math.floor(p.z));
    b.slip = block(below).slipperiness ?? 0.6;
  }
  if (p.y < -8) {
    p.y = WORLD_HEIGHT - 1;
    b.vel.set(0, 0, 0);
  }
}

export function blockUnder(world: World, b: Body): number {
  return world.getBlock(Math.floor(b.pos.x), Math.floor(b.pos.y - 0.2), Math.floor(b.pos.z));
}
