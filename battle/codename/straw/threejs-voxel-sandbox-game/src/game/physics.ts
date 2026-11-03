// AABB-vs-voxel physics shared by player, mobs and dropped items; voxel raycast.
import * as THREE from 'three';
import { B, blockDef } from './blocks';
import { WORLD_H, type World } from './world';

export interface Body {
  pos: THREE.Vector3; // feet center
  vel: THREE.Vector3;
  halfW: number;
  height: number;
  onGround: boolean;
  hitWall: boolean;
  inWater: boolean;
  headInWater: boolean;
  inLava: boolean;
}

export function makeBody(pos: THREE.Vector3, halfW: number, height: number): Body {
  return { pos, vel: new THREE.Vector3(), halfW, height, onGround: false, hitWall: false, inWater: false, headInWater: false, inLava: false };
}

const EPS = 0.001;

function collideAxis(world: World, b: Body, axis: 'x' | 'y' | 'z', amount: number) {
  if (amount === 0) return;
  b.pos[axis] += amount;
  const minX = b.pos.x - b.halfW, maxX = b.pos.x + b.halfW;
  const minY = b.pos.y, maxY = b.pos.y + b.height;
  const minZ = b.pos.z - b.halfW, maxZ = b.pos.z + b.halfW;
  const x0 = Math.floor(minX), x1 = Math.floor(maxX - EPS);
  const y0 = Math.floor(minY), y1 = Math.floor(maxY - EPS);
  const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - EPS);
  let hit = false;
  let bound = amount > 0 ? Infinity : -Infinity;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    if (!world.isSolidPhys(x, y, z)) continue;
    hit = true;
    const c = axis === 'x' ? x : axis === 'y' ? y : z;
    bound = amount > 0 ? Math.min(bound, c) : Math.max(bound, c);
  }
  if (!hit) return;
  if (axis === 'x') {
    b.pos.x = amount > 0 ? bound - b.halfW - EPS : bound + 1 + b.halfW + EPS;
    b.vel.x = 0; b.hitWall = true;
  } else if (axis === 'z') {
    b.pos.z = amount > 0 ? bound - b.halfW - EPS : bound + 1 + b.halfW + EPS;
    b.vel.z = 0; b.hitWall = true;
  } else {
    if (amount < 0) { b.pos.y = bound + 1; b.onGround = true; }
    else b.pos.y = bound - b.height - EPS;
    b.vel.y = 0;
  }
}

export function moveBody(world: World, b: Body, dt: number) {
  b.hitWall = false;
  const wasGround = b.onGround;
  b.onGround = false;
  const maxStep = 0.35;
  const dist = Math.max(Math.abs(b.vel.x), Math.abs(b.vel.y), Math.abs(b.vel.z)) * dt;
  const steps = Math.max(1, Math.min(8, Math.ceil(dist / maxStep)));
  const sdt = dt / steps;
  for (let i = 0; i < steps; i++) {
    collideAxis(world, b, 'x', b.vel.x * sdt);
    collideAxis(world, b, 'z', b.vel.z * sdt);
    collideAxis(world, b, 'y', b.vel.y * sdt);
  }
  if (wasGround && !b.onGround && b.vel.y <= 0) {
    // ground probe: still standing if solid right below
    const below = Math.floor(b.pos.y - 0.05);
    outer: for (let x = Math.floor(b.pos.x - b.halfW); x <= Math.floor(b.pos.x + b.halfW - EPS); x++)
      for (let z = Math.floor(b.pos.z - b.halfW); z <= Math.floor(b.pos.z + b.halfW - EPS); z++)
        if (world.isSolidPhys(x, below, z)) { b.onGround = true; break outer; }
  }
  // fluid state
  const cx = Math.floor(b.pos.x), cz = Math.floor(b.pos.z);
  const mid = world.getBlock(cx, Math.floor(b.pos.y + 0.35), cz);
  const low = world.getBlock(cx, Math.floor(b.pos.y + 0.05), cz);
  const head = world.getBlock(cx, Math.floor(b.pos.y + b.height - 0.15), cz);
  b.inWater = mid === B.Water || low === B.Water;
  b.inLava = mid === B.Lava || low === B.Lava;
  b.headInWater = head === B.Water;
}

export function aabbHitsSolid(world: World, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): boolean {
  for (let y = Math.floor(minY); y <= Math.floor(maxY - EPS); y++)
    for (let x = Math.floor(minX); x <= Math.floor(maxX - EPS); x++)
      for (let z = Math.floor(minZ); z <= Math.floor(maxZ - EPS); z++)
        if (world.isSolidPhys(x, y, z)) return true;
  return false;
}

export interface RayHit { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number; dist: number }

/** Voxel DDA raycast. Liquids are passed through; plants/torches are hittable. */
export function raycastVoxel(world: World, origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): RayHit | null {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;
  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? x + 1 - origin.x : origin.x - x)) * tDeltaX : Infinity;
  let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? y + 1 - origin.y : origin.y - y)) * tDeltaY : Infinity;
  let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? z + 1 - origin.z : origin.z - z)) * tDeltaZ : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < 256; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== B.Air && id !== B.Water && id !== B.Lava) {
      return { x, y, z, nx, ny, nz, id, dist: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0; }
    else if (tMaxY < tMaxZ) { y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0; }
    else { z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ; }
    if (t > maxDist || y < -2 || y > WORLD_H + 2) return null;
  }
  return null;
}

/** y of the ground surface (top of first solid block at/below fromY), or -1 */
export function groundY(world: World, x: number, z: number, fromY: number): number {
  let y = Math.min(Math.floor(fromY), WORLD_H - 1);
  while (y >= 0) {
    if (blockDef(world.getBlock(x, y, z)).solid) return y + 1;
    y--;
  }
  return 0;
}
