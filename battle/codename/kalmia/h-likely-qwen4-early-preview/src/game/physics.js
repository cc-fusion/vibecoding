// Shared AABB voxel physics for player, mobs and item entities.
import { isSolid, B } from './blocks.js';
import { HEIGHT } from './world.js';

// entity: { pos: {x,y,z} (feet center), vel: {x,y,z}, w (width), h (height) }
// Moves entity by vel*dt with per-axis collision resolution.
// Returns { onGround, hitX, hitZ, hitY }
export function moveEntity(world, e, dt) {
  const res = { onGround: false, hitX: false, hitZ: false, hitY: false };
  const half = e.w / 2;
  let dx = e.vel.x * dt, dy = e.vel.y * dt, dz = e.vel.z * dt;

  // clamp big steps (tunneling guard)
  const maxStep = 0.45;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / maxStep));
  dx /= steps; dy /= steps; dz /= steps;

  for (let s = 0; s < steps; s++) {
    // Y axis
    e.pos.y += dy;
    if (collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h)) {
      if (dy < 0) {
        e.pos.y = Math.floor(e.pos.y) + 1 + 1e-4;
        // may need to walk up to the actual block top if deep
        while (collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h) && e.pos.y < HEIGHT) e.pos.y += 1;
        res.onGround = true;
        res.hitY = true;
      } else if (dy > 0) {
        e.pos.y = Math.ceil(e.pos.y + e.h) - e.h - 1e-4;
        while (collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h)) e.pos.y -= 0.05;
        res.hitY = true;
      }
      e.vel.y = 0;
      dy = 0;
    }
    // X axis
    e.pos.x += dx;
    if (collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h)) {
      e.pos.x = dx > 0 ? Math.ceil(e.pos.x + half) - half - 1e-4 : Math.floor(e.pos.x - half) + 1 + half + 1e-4;
      while (collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h)) e.pos.x -= Math.sign(dx) * 0.02;
      e.vel.x = 0;
      res.hitX = true;
      dx = 0;
    }
    // Z axis
    e.pos.z += dz;
    if (collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h)) {
      e.pos.z = dz > 0 ? Math.ceil(e.pos.z + half) - half - 1e-4 : Math.floor(e.pos.z - half) + 1 + half + 1e-4;
      while (collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h)) e.pos.z -= Math.sign(dz) * 0.02;
      e.vel.z = 0;
      res.hitZ = true;
      dz = 0;
    }
  }

  // ground check (slightly below feet)
  if (!res.onGround && e.vel.y <= 0) {
    res.onGround = collides(world, e.pos.x, e.pos.y - 0.02, e.pos.z, half, e.h) &&
      !collides(world, e.pos.x, e.pos.y, e.pos.z, half, e.h);
  }
  return res;
}

export function collides(world, px, py, pz, half, h) {
  const x0 = Math.floor(px - half), x1 = Math.floor(px + half);
  const y0 = Math.floor(py), y1 = Math.floor(py + h);
  const z0 = Math.floor(pz - half), z1 = Math.floor(pz + half);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (isSolid(world.getBlock(x, y, z))) return true;
  return false;
}

export function boxIntersectsBlock(e, bx, by, bz) {
  const half = e.w / 2;
  return e.pos.x + half > bx && e.pos.x - half < bx + 1 &&
    e.pos.y + e.h > by && e.pos.y < by + 1 &&
    e.pos.z + half > bz && e.pos.z - half < bz + 1;
}

export function inWater(world, e, atHead = false) {
  const y = atHead ? e.pos.y + e.h - 0.15 : e.pos.y + 0.3;
  return world.getBlock(Math.floor(e.pos.x), Math.floor(y), Math.floor(e.pos.z)) === B.WATER;
}

// Amanatides & Woo voxel raycast. Returns { x,y,z, face:[nx,ny,nz], dist } or null.
export function raycastBlocks(world, origin, dir, maxDist, hitFluids = false) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = Math.sign(dir.x), stepY = Math.sign(dir.y), stepZ = Math.sign(dir.z);
  const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;
  let tMaxX = stepX > 0 ? (x + 1 - origin.x) * tDeltaX : stepX < 0 ? (origin.x - x) * tDeltaX : Infinity;
  let tMaxY = stepY > 0 ? (y + 1 - origin.y) * tDeltaY : stepY < 0 ? (origin.y - y) * tDeltaY : Infinity;
  let tMaxZ = stepZ > 0 ? (z + 1 - origin.z) * tDeltaZ : stepZ < 0 ? (origin.z - z) * tDeltaZ : Infinity;
  let face = [0, 0, 0];
  let t = 0;

  while (t <= maxDist) {
    const id = world.getBlock(x, y, z);
    if (id !== B.AIR && (hitFluids || id !== B.WATER)) {
      return { x, y, z, id, face, dist: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; face = [-stepX, 0, 0];
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; face = [0, -stepY, 0];
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; face = [0, 0, -stepZ];
    }
  }
  return null;
}

// Ray vs entity AABB, returns distance or null
export function rayEntity(origin, dir, e, maxDist) {
  const half = e.w / 2;
  const min = [e.pos.x - half, e.pos.y, e.pos.z - half];
  const max = [e.pos.x + half, e.pos.y + e.h, e.pos.z + half];
  const o = [origin.x, origin.y, origin.z], d = [dir.x, dir.y, dir.z];
  let tmin = 0, tmax = maxDist;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < min[i] || o[i] > max[i]) return null;
    } else {
      let t1 = (min[i] - o[i]) / d[i], t2 = (max[i] - o[i]) / d[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}