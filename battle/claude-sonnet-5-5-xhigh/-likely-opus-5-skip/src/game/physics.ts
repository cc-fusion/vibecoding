// AABB collision against the voxel world + voxel raycasting.
import type { World } from './world';
import { T_KIND, K } from './blocks';

export interface Body {
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  w: number; h: number; onGround: boolean; hitX: boolean; hitZ: boolean; hitHead: boolean;
}
export const newBody = (w: number, h: number, x = 0, y = 0, z = 0): Body => ({ x, y, z, vx: 0, vy: 0, vz: 0, w, h, onGround: false, hitX: false, hitZ: false, hitHead: false });

const E = 1e-3;
export function collides(world: World, b: Body) {
  const hw = b.w / 2;
  const x0 = Math.floor(b.x - hw + E), x1 = Math.floor(b.x + hw - E);
  const y0 = Math.floor(b.y + E), y1 = Math.floor(b.y + b.h - E);
  const z0 = Math.floor(b.z - hw + E), z1 = Math.floor(b.z + hw - E);
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (world.solidAt(x, y, z)) return true;
  return false;
}
function hasSupport(world: World, b: Body) {
  const hw = b.w / 2, y = Math.floor(b.y - 0.2);
  for (let z = Math.floor(b.z - hw); z <= Math.floor(b.z + hw); z++) for (let x = Math.floor(b.x - hw); x <= Math.floor(b.x + hw); x++) if (world.solidAt(x, y, z)) return true;
  return false;
}

function moveAxis(world: World, b: Body, axis: 0 | 1 | 2, d: number, sneak: boolean): boolean {
  if (d === 0) return false;
  const sign = d > 0 ? 1 : -1, hw = b.w / 2;
  let remaining = Math.abs(d), hit = false;
  while (remaining > 1e-7) {
    const step = Math.min(0.25, remaining);
    remaining -= step;
    const prev = axis === 0 ? b.x : axis === 1 ? b.y : b.z;
    if (axis === 0) b.x += step * sign; else if (axis === 1) b.y += step * sign; else b.z += step * sign;
    if (collides(world, b)) {
      if (axis === 0) { const edge = sign > 0 ? b.x + hw : b.x - hw; const cell = Math.floor(edge); b.x = sign > 0 ? cell - hw - 1e-4 : cell + 1 + hw + 1e-4; }
      else if (axis === 2) { const edge = sign > 0 ? b.z + hw : b.z - hw; const cell = Math.floor(edge); b.z = sign > 0 ? cell - hw - 1e-4 : cell + 1 + hw + 1e-4; }
      else { const edge = sign > 0 ? b.y + b.h : b.y; const cell = Math.floor(edge); b.y = sign > 0 ? cell - b.h - 1e-4 : cell + 1 + 1e-4; }
      hit = true;
      break;
    }
    if (sneak && axis !== 1 && !hasSupport(world, b)) {
      if (axis === 0) b.x = prev; else b.z = prev;
      hit = true;
      break;
    }
  }
  return hit;
}

export function moveBody(world: World, b: Body, dt: number, sneakEdge = false) {
  // unstick if embedded in terrain
  if (collides(world, b)) {
    for (let i = 0; i < 40 && collides(world, b); i++) b.y += 0.1;
  }
  const wasGround = b.onGround;
  b.hitX = b.hitZ = b.hitHead = false;
  const sn = sneakEdge && wasGround;
  if (moveAxis(world, b, 0, b.vx * dt, sn)) { b.hitX = true; b.vx = 0; }
  if (moveAxis(world, b, 2, b.vz * dt, sn)) { b.hitZ = true; b.vz = 0; }
  const dy = b.vy * dt;
  b.onGround = false;
  if (moveAxis(world, b, 1, dy, false)) {
    if (dy < 0) b.onGround = true; else b.hitHead = true;
    b.vy = 0;
  }
}

export interface Hit { x: number; y: number; z: number; nx: number; ny: number; nz: number; id: number; dist: number }
export function raycast(world: World, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number, accept?: (id: number) => boolean): Hit | null {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tmx = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tdx) : Infinity;
  let tmy = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tdy) : Infinity;
  let tmz = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tdz) : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < 200; i++) {
    const id = world.getBlock(x, y, z);
    if (id !== 0 && (accept ? accept(id) : T_KIND[id] !== K.WATER && T_KIND[id] !== K.LAVA)) return { x, y, z, nx, ny, nz, id, dist: t };
    if (tmx < tmy && tmx < tmz) { t = tmx; if (t > maxDist) return null; x += sx; tmx += tdx; nx = -sx; ny = 0; nz = 0; }
    else if (tmy < tmz) { t = tmy; if (t > maxDist) return null; y += sy; tmy += tdy; nx = 0; ny = -sy; nz = 0; }
    else { t = tmz; if (t > maxDist) return null; z += sz; tmz += tdz; nx = 0; ny = 0; nz = -sz; }
  }
  return null;
}
