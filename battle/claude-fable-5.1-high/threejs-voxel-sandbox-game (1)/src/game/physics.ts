// Voxel AABB collision resolution and DDA raycasting.
import { BLOCKS, B } from "./blocks";
import type { World } from "./world";

export interface Body {
  x: number; // center x
  y: number; // feet y
  z: number;
  vx: number;
  vy: number;
  vz: number;
  w: number; // half width
  h: number; // height
  onGround: boolean;
  hitWall: boolean;
  inWater: boolean;
  inLava: boolean;
}

const isSolid = (world: World, x: number, y: number, z: number) => {
  const id = world.getBlock(x, y, z);
  return id !== B.AIR && !!BLOCKS[id]?.solid;
};

function collides(world: World, b: Body, x: number, y: number, z: number): boolean {
  const x0 = Math.floor(x - b.w), x1 = Math.floor(x + b.w - 1e-6);
  const y0 = Math.floor(y), y1 = Math.floor(y + b.h - 1e-6);
  const z0 = Math.floor(z - b.w), z1 = Math.floor(z + b.w - 1e-6);
  for (let ix = x0; ix <= x1; ix++)
    for (let iy = y0; iy <= y1; iy++)
      for (let iz = z0; iz <= z1; iz++) if (isSolid(world, ix, iy, iz)) return true;
  return false;
}

/** Moves a body by its velocity * dt with axis-separated collision. */
export function moveBody(world: World, b: Body, dt: number): void {
  b.onGround = false;
  b.hitWall = false;
  const steps = Math.max(1, Math.ceil((Math.max(Math.abs(b.vx), Math.abs(b.vy), Math.abs(b.vz)) * dt) / 0.4));
  const sdt = dt / steps;
  for (let s = 0; s < steps; s++) {
    // Y
    let ny = b.y + b.vy * sdt;
    if (collides(world, b, b.x, ny, b.z)) {
      if (b.vy < 0) {
        ny = Math.floor(ny) + 1; // snap to top of block below
        // ensure resolved
        let guard = 0;
        while (collides(world, b, b.x, ny, b.z) && guard++ < 4) ny += 1e-3;
        b.onGround = true;
      } else {
        ny = Math.floor(ny + b.h) - b.h - 1e-4;
      }
      b.vy = 0;
    }
    b.y = ny;
    // X
    let nx = b.x + b.vx * sdt;
    if (collides(world, b, nx, b.y, b.z)) {
      if (b.vx > 0) nx = Math.floor(nx + b.w) - b.w - 1e-4;
      else nx = Math.floor(nx - b.w) + 1 + b.w + 1e-4;
      b.vx = 0;
      b.hitWall = true;
    }
    b.x = nx;
    // Z
    let nz = b.z + b.vz * sdt;
    if (collides(world, b, b.x, b.y, nz)) {
      if (b.vz > 0) nz = Math.floor(nz + b.w) - b.w - 1e-4;
      else nz = Math.floor(nz - b.w) + 1 + b.w + 1e-4;
      b.vz = 0;
      b.hitWall = true;
    }
    b.z = nz;
  }
  // Ground check (slightly below feet)
  if (!b.onGround && b.vy <= 0 && collides(world, b, b.x, b.y - 0.02, b.z)) b.onGround = true;
  // fluid check
  const fx = Math.floor(b.x), fz = Math.floor(b.z);
  const feet = world.getBlock(fx, Math.floor(b.y + 0.2), fz);
  const mid = world.getBlock(fx, Math.floor(b.y + b.h * 0.5), fz);
  b.inWater = feet === B.WATER || mid === B.WATER;
  b.inLava = feet === B.LAVA || mid === B.LAVA;
}

/** Would placing a solid block at (x,y,z) intersect this body? */
export function bodyIntersectsBlock(b: Body, x: number, y: number, z: number): boolean {
  return b.x + b.w > x && b.x - b.w < x + 1 && b.y + b.h > y && b.y < y + 1 && b.z + b.w > z && b.z - b.w < z + 1;
}

export interface RayHit {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  id: number;
  dist: number;
  px: number;
  py: number;
  pz: number;
}

/** DDA voxel raycast; skips non-targetable fluids. */
export function raycast(world: World, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number, hitFluids = false): RayHit | null {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDeltaX = Math.abs(1 / dx), tDeltaY = Math.abs(1 / dy), tDeltaZ = Math.abs(1 / dz);
  let tMaxX = dx > 0 ? (x + 1 - ox) * tDeltaX : (ox - x) * tDeltaX;
  let tMaxY = dy > 0 ? (y + 1 - oy) * tDeltaY : (oy - y) * tDeltaY;
  let tMaxZ = dz > 0 ? (z + 1 - oz) * tDeltaZ : (oz - z) * tDeltaZ;
  let nx = 0, ny = 0, nz = 0;
  let t = 0;
  for (let i = 0; i < 256; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR) {
      const def = BLOCKS[id];
      if (def && (def.shape !== "liquid" || hitFluids)) {
        return { x, y, z, nx, ny, nz, id, dist: t, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t };
      }
    }
    if (tMaxX < tMaxY) {
      if (tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; nx = -stepX; ny = 0; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    } else {
      if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; nx = 0; ny = -stepY; nz = 0;
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; nx = 0; ny = 0; nz = -stepZ;
      }
    }
    if (t > maxDist) return null;
  }
  return null;
}

/** Ray vs AABB (slab method). Returns distance or -1. */
export function rayAABB(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): number {
  let tmin = -Infinity, tmax = Infinity;
  const axes = [
    [ox, dx, minX, maxX],
    [oy, dy, minY, maxY],
    [oz, dz, minZ, maxZ],
  ];
  for (const [o, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (o < mn || o > mx) return -1;
    } else {
      let t1 = (mn - o) / d, t2 = (mx - o) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return -1;
    }
  }
  return tmax < 0 ? -1 : Math.max(tmin, 0);
}
