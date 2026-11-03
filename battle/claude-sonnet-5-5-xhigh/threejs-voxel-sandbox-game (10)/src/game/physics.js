// Axis-separated AABB vs voxel collision shared by the player, mobs and item entities.
const EPS = 1e-4;

// e: {x,y,z (feet centre), hw (half width), h (height)} ; writes e.hitX/hitY/hitZ/onGround
export function moveBox(world, e, dx, dy, dz) {
  e.hitX = e.hitY = e.hitZ = false;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
  const sx = dx / steps, sy = dy / steps, sz = dz / steps;
  if (dy !== 0) e.onGround = false;
  for (let s = 0; s < steps; s++) {
    if (sy !== 0) stepY(world, e, sy);
    if (sx !== 0) stepX(world, e, sx);
    if (sz !== 0) stepZ(world, e, sz);
  }
}

function stepX(world, e, d) {
  e.x += d;
  const minX = e.x - e.hw, maxX = e.x + e.hw;
  const y0 = Math.floor(e.y + EPS), y1 = Math.floor(e.y + e.h - EPS);
  const z0 = Math.floor(e.z - e.hw + EPS), z1 = Math.floor(e.z + e.hw - EPS);
  const x0 = Math.floor(minX), x1 = Math.floor(maxX);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (world.isSolid(x, y, z)) {
      if (d > 0) e.x = Math.min(e.x, x - e.hw - EPS); else e.x = Math.max(e.x, x + 1 + e.hw + EPS);
      e.hitX = true;
    }
  }
}
function stepZ(world, e, d) {
  e.z += d;
  const minZ = e.z - e.hw, maxZ = e.z + e.hw;
  const y0 = Math.floor(e.y + EPS), y1 = Math.floor(e.y + e.h - EPS);
  const x0 = Math.floor(e.x - e.hw + EPS), x1 = Math.floor(e.x + e.hw - EPS);
  const z0 = Math.floor(minZ), z1 = Math.floor(maxZ);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (world.isSolid(x, y, z)) {
      if (d > 0) e.z = Math.min(e.z, z - e.hw - EPS); else e.z = Math.max(e.z, z + 1 + e.hw + EPS);
      e.hitZ = true;
    }
  }
}
function stepY(world, e, d) {
  e.y += d;
  const x0 = Math.floor(e.x - e.hw + EPS), x1 = Math.floor(e.x + e.hw - EPS);
  const z0 = Math.floor(e.z - e.hw + EPS), z1 = Math.floor(e.z + e.hw - EPS);
  const y0 = Math.floor(e.y), y1 = Math.floor(e.y + e.h);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    if (world.isSolid(x, y, z)) {
      if (d < 0) { e.y = Math.max(e.y, y + 1); e.onGround = true; }
      else e.y = Math.min(e.y, y - e.h - EPS);
      e.hitY = true;
    }
  }
  if (e.hitY && d > 0 && !e.onGround) { /* head bump */ }
}

// is the AABB overlapping any solid block?
export function boxCollides(world, e) {
  const x0 = Math.floor(e.x - e.hw + EPS), x1 = Math.floor(e.x + e.hw - EPS);
  const y0 = Math.floor(e.y + EPS), y1 = Math.floor(e.y + e.h - EPS);
  const z0 = Math.floor(e.z - e.hw + EPS), z1 = Math.floor(e.z + e.hw - EPS);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (world.isSolid(x, y, z)) return true;
  return false;
}

// ray vs AABB (slab), returns distance or -1
export function rayAABB(ox, oy, oz, dx, dy, dz, minx, miny, minz, maxx, maxy, maxz, maxDist) {
  let tmin = 0, tmax = maxDist;
  const o = [ox, oy, oz], d = [dx, dy, dz], mn = [minx, miny, minz], mx = [maxx, maxy, maxz];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return -1; continue; }
    let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmin;
}
