import { CX, CY, CZ, idx } from './worldgen.js';
import { BLOCKS } from './blocks.js';

// Per-block light attenuation (0 = transparent, 255 = opaque)
const OPACITY = new Uint8Array(256);
const EMIT = new Uint8Array(256);
for (const id in BLOCKS) {
  const d = BLOCKS[id];
  OPACITY[id] = d.opaque ? 255 : (d.liquid || d.transparent) ? 2 : 0;
  if (d.transparent && !d.liquid && id != 8 && id != 28 && id != 34) OPACITY[id] = 0; // glass, ice -> clear
  EMIT[id] = d.light;
}
const queue = new Int32Array(CX * CY * CZ * 8);

// Compute sky + block light for a chunk. Seeds from neighbor chunk borders.
// Returns the set of neighbor chunks whose border light should be refreshed.
export function computeLight(world, c) {
  const { blocks, sky, light } = c;
  sky.fill(0); light.fill(0);
  const notify = new Set();
  const nbr = {
    xm: world.getChunk(c.cx - 1, c.cz), xp: world.getChunk(c.cx + 1, c.cz),
    zm: world.getChunk(c.cx, c.cz - 1), zp: world.getChunk(c.cx, c.cz + 1),
  };

  // ---- sky light: columns ----
  let qh = 0, qt = 0;
  for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
    const base = idx(x, 0, z);
    let l = 15;
    for (let y = CY - 1; y >= 0; y--) {
      const op = OPACITY[blocks[base + y]];
      if (op === 255) { l = 0; }
      else if (op) l = Math.max(0, l - op);
      if (l === 0) break;
      sky[base + y] = l;
    }
  }
  // seed queue: cells with light that border a darker non-opaque cell
  for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
    const base = idx(x, 0, z);
    for (let y = 0; y < CY; y++) {
      const i = base + y, l = sky[i];
      if (l <= 1) continue;
      // check 4 horizontal neighbors (vertical already handled by column fill except overhangs)
      if ((x > 0 && sky[i - CY * CZ] < l - 1 && OPACITY[blocks[i - CY * CZ]] !== 255) ||
          (x < CX - 1 && sky[i + CY * CZ] < l - 1 && OPACITY[blocks[i + CY * CZ]] !== 255) ||
          (z > 0 && sky[i - CY] < l - 1 && OPACITY[blocks[i - CY]] !== 255) ||
          (z < CZ - 1 && sky[i + CY] < l - 1 && OPACITY[blocks[i + CY]] !== 255) ||
          (y > 0 && sky[i - 1] < l - 1 && OPACITY[blocks[i - 1]] !== 255)) { queue[qt++] = i; }
    }
  }
  seedBorders(c, nbr, 'sky', sky, blocks, () => { }, (i) => { queue[qt++] = i; });
  qt = propagate(blocks, sky, qh, qt);

  // ---- block light ----
  qh = 0; qt = 0;
  for (let i = 0; i < blocks.length; i++) { const e = EMIT[blocks[i]]; if (e) { light[i] = e; queue[qt++] = i; } }
  seedBorders(c, nbr, 'light', light, blocks, () => { }, (i) => { queue[qt++] = i; });
  propagate(blocks, light, qh, qt);

  // ---- determine neighbors needing refresh: our border light exceeds theirs ----
  const check = (n, lx, nx, lz, nz, mode) => {
    if (!n || !n.lit) return;
    for (let a = 0; a < (mode === 'x' ? CZ : CX); a++) {
      for (let y = 0; y < CY; y++) {
        const i = mode === 'x' ? idx(lx, y, a) : idx(a, y, lz);
        const j = mode === 'x' ? idx(nx, y, a) : idx(a, y, nz);
        const op = OPACITY[n.blocks[j]]; if (op === 255) continue;
        if (sky[i] - 1 - op > n.sky[j] || light[i] - 1 - op > n.light[j]) { notify.add(n); return; }
      }
    }
  };
  check(nbr.xm, 0, CX - 1, 0, 0, 'x'); check(nbr.xp, CX - 1, 0, 0, 0, 'x');
  check(nbr.zm, 0, 0, 0, CZ - 1, 'z'); check(nbr.zp, 0, 0, CZ - 1, 0, 'z');
  return notify;
}

function seedBorders(c, nbr, field, arr, blocks, _unused, push) {
  const take = (n, lx, nx, lz, nz, mode) => {
    if (!n || !n.lit) return;
    const src = n[field];
    for (let a = 0; a < (mode === 'x' ? CZ : CX); a++) {
      for (let y = 0; y < CY; y++) {
        const i = mode === 'x' ? idx(lx, y, a) : idx(a, y, lz);
        const op = OPACITY[blocks[i]]; if (op === 255) continue;
        const j = mode === 'x' ? idx(nx, y, a) : idx(a, y, nz);
        const v = src[j] - 1 - op;
        if (v > arr[i]) { arr[i] = v; push(i); }
      }
    }
  };
  take(nbr.xm, 0, CX - 1, 0, 0, 'x'); take(nbr.xp, CX - 1, 0, 0, 0, 'x');
  take(nbr.zm, 0, 0, 0, CZ - 1, 'z'); take(nbr.zp, 0, 0, CZ - 1, 0, 'z');
}

function propagate(blocks, arr, qh, qt) {
  const SX = CY * CZ, SZ = CY;
  let l = 0;
  const spread = (j) => {
    const op = OPACITY[blocks[j]]; if (op === 255) return;
    const v = l - 1 - op;
    if (v > arr[j]) { arr[j] = v; if (qt < queue.length) queue[qt++] = j; }
  };
  while (qh < qt) {
    const i = queue[qh++];
    l = arr[i];
    if (l <= 1) continue;
    const y = i % CY, z = ((i / CY) | 0) % CZ, x = (i / (CY * CZ)) | 0;
    if (x > 0) spread(i - SX); if (x < CX - 1) spread(i + SX);
    if (z > 0) spread(i - SZ); if (z < CZ - 1) spread(i + SZ);
    if (y > 0) spread(i - 1); if (y < CY - 1) spread(i + 1);
  }
  return qt;
}
