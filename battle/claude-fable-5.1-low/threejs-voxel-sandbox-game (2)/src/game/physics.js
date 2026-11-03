import { BLOCKS, B } from './blocks.js';

export const GRAVITY = 28;

// Entity: { pos: {x,y,z} (feet center), vel: {x,y,z}, w (half width), h (height), onGround, inWater }
export function collides(world, px, py, pz, w, h) {
  const x0 = Math.floor(px - w), x1 = Math.floor(px + w - 1e-6);
  const y0 = Math.floor(py), y1 = Math.floor(py + h - 1e-6);
  const z0 = Math.floor(pz - w), z1 = Math.floor(pz + w - 1e-6);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const d = BLOCKS[world.getBlock(x, y, z)];
    if (d && d.solid) {
      if (d.shape === 'cross') { // fences: narrow post
        const cx = x + 0.5, cz = z + 0.5;
        if (Math.abs(px - cx) < w + 0.2 && Math.abs(pz - cz) < w + 0.2) return true;
        continue;
      }
      return true;
    }
  }
  return false;
}

// Move entity with axis-separated sweeps. Returns flags.
export function moveEntity(world, e, dt) {
  const { pos, vel } = e;
  const w = e.w, h = e.h;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(vel.x), Math.abs(vel.y), Math.abs(vel.z)) * dt / 0.25));
  const sdt = dt / steps;
  e.onGround = false; e.hitWall = false; e.hitCeiling = false;
  for (let s = 0; s < steps; s++) {
    // Y
    let ny = pos.y + vel.y * sdt;
    if (collides(world, pos.x, ny, pos.z, w, h)) {
      if (vel.y < 0) { ny = Math.floor(pos.y - 1e-6) + 1e-6; // snap up to top of block below
        // find exact top
        ny = Math.floor(ny); while (collides(world, pos.x, ny, pos.z, w, h)) ny += 1; ny += 1e-5;
        e.onGround = true;
      } else { e.hitCeiling = true; ny = pos.y; }
      e.landVel = vel.y; vel.y = 0;
    }
    pos.y = ny;
    // X
    let nx = pos.x + vel.x * sdt;
    if (collides(world, nx, pos.y, pos.z, w, h)) {
      if (e.canStep && e.onGround && !collides(world, nx, pos.y + 0.6, pos.z, w, h) && !collides(world, nx, pos.y + 1.0, pos.z, w, h)) {
        // auto step up for mobs
        pos.y = Math.floor(pos.y) + 1 + 1e-5;
      } else { nx = pos.x; vel.x = 0; e.hitWall = true; }
    }
    pos.x = nx;
    // Z
    let nz = pos.z + vel.z * sdt;
    if (collides(world, pos.x, pos.y, nz, w, h)) {
      if (e.canStep && e.onGround && !collides(world, pos.x, pos.y + 0.6, nz, w, h) && !collides(world, pos.x, pos.y + 1.0, nz, w, h)) {
        pos.y = Math.floor(pos.y) + 1 + 1e-5;
      } else { nz = pos.z; vel.z = 0; e.hitWall = true; }
    }
    pos.z = nz;
  }
  // ground check (standing exactly on surface)
  if (!e.onGround && vel.y <= 0 && collides(world, pos.x, pos.y - 0.02, pos.z, w, h)) e.onGround = true;
  // fluid checks
  const feet = world.getBlock(Math.floor(pos.x), Math.floor(pos.y + 0.2), Math.floor(pos.z));
  const mid = world.getBlock(Math.floor(pos.x), Math.floor(pos.y + h * 0.6), Math.floor(pos.z));
  e.inWater = feet === B.WATER || mid === B.WATER;
  e.inLava = feet === B.LAVA || mid === B.LAVA;
  e.onLadder = feet === B.LADDER || mid === B.LADDER;
}

export function applyGravity(e, dt, scale = 1) {
  if (e.inWater) { e.vel.y -= GRAVITY * 0.25 * dt * scale; e.vel.y = Math.max(e.vel.y, -3); }
  else if (e.inLava) { e.vel.y -= GRAVITY * 0.2 * dt * scale; e.vel.y = Math.max(e.vel.y, -2); }
  else if (e.onLadder) { e.vel.y = Math.max(e.vel.y - GRAVITY * dt * scale, -2.5); }
  else e.vel.y = Math.max(e.vel.y - GRAVITY * dt * scale, -60);
}
