import * as THREE from 'three';
import { CX, CY, CZ, idx } from './worldgen.js';
import { BLOCKS, B } from './blocks.js';
import { blockTiles, ATLAS_COLS } from './textures.js';

let ATLAS_ROWS = 8;
export function setAtlasRows(r) { ATLAS_ROWS = r; }

// ---- static block tables ----
const OPAQUE = new Uint8Array(256), SHAPE = new Uint8Array(256), LIQUID = new Uint8Array(256), TRANSP = new Uint8Array(256);
const TINT = new Float32Array(256 * 3).fill(1);
for (const id in BLOCKS) { const d = BLOCKS[id]; OPAQUE[id] = d.opaque ? 1 : 0; SHAPE[id] = d.shape === 'cross' ? 1 : d.shape === 'none' ? 2 : 0; LIQUID[id] = d.liquid ? 1 : 0; TRANSP[id] = d.transparent ? 1 : 0; if (d.tint) { TINT[id * 3] = d.tint[0]; TINT[id * 3 + 1] = d.tint[1]; TINT[id * 3 + 2] = d.tint[2]; } }
let TILES = null; // Int16Array 256*3
function ensureTiles() { if (TILES) return; TILES = new Int16Array(256 * 3); for (const id in BLOCKS) { const t = blockTiles(+id); TILES[id * 3] = t[0]; TILES[id * 3 + 1] = t[1]; TILES[id * 3 + 2] = t[2]; } }

// ---- padded snapshot ----
const PX = CX + 2, PZ = CZ + 2, PY = CY + 2;
const SX = PZ * PY, SZ = PY, SY = 1;
const P = (x, y, z) => ((x + 1) * PZ + (z + 1)) * PY + (y + 1);
const pBlocks = new Uint8Array(PX * PZ * PY), pSky = new Uint8Array(PX * PZ * PY), pLight = new Uint8Array(PX * PZ * PY);

function snapshot(world, c) {
  const ox = c.cx * CX, oz = c.cz * CZ;
  // interior copy (column-wise)
  for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
    const src = idx(x, 0, z), dst = P(x, 0, z);
    pBlocks.set(c.blocks.subarray(src, src + CY), dst); pSky.set(c.sky.subarray(src, src + CY), dst); pLight.set(c.light.subarray(src, src + CY), dst);
  }
  // border columns from neighbor chunks
  const borderCol = (x, z) => {
    const dst = P(x, 0, z);
    const cx = Math.floor((ox + x) / CX), cz = Math.floor((oz + z) / CZ);
    const n = world.getChunk(cx, cz);
    if (n) { const src = idx(ox + x - cx * CX, 0, oz + z - cz * CZ); pBlocks.set(n.blocks.subarray(src, src + CY), dst); pSky.set(n.sky.subarray(src, src + CY), dst); pLight.set(n.light.subarray(src, src + CY), dst); }
    else { pBlocks.fill(0, dst, dst + CY); pSky.fill(15, dst, dst + CY); pLight.fill(0, dst, dst + CY); }
  };
  for (let x = -1; x <= CX; x++) { borderCol(x, -1); borderCol(x, CZ); }
  for (let z = 0; z < CZ; z++) { borderCol(-1, z); borderCol(CX, z); }
  // y padding: below = bedrock, above = air/sky
  for (let x = -1; x <= CX; x++) for (let z = -1; z <= CZ; z++) {
    const b = P(x, -1, z), t = P(x, CY, z);
    pBlocks[b] = B.BEDROCK; pSky[b] = 0; pLight[b] = 0; pBlocks[t] = 0; pSky[t] = 15; pLight[t] = 0;
  }
}

// ---- faces ----
// n: normal, u/v tangents (u x v = n), shade, tex slot, uvFromV
const FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1], shade: 0.8, slot: 1, uvFromV: true },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], shade: 0.8, slot: 1, uvFromV: false },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0], shade: 1.0, slot: 0, uvFromV: false },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], shade: 0.5, slot: 2, uvFromV: false },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], shade: 0.65, slot: 1, uvFromV: false },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0], shade: 0.65, slot: 1, uvFromV: true },
].map(f => {
  const off = (v) => v[0] * SX + v[1] * SY + v[2] * SZ;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([su, sv]) => ({
    px: 0.5 + f.n[0] * 0.5 + (f.u[0] * su + f.v[0] * sv) * 0.5, py: 0.5 + f.n[1] * 0.5 + (f.u[1] * su + f.v[1] * sv) * 0.5, pz: 0.5 + f.n[2] * 0.5 + (f.u[2] * su + f.v[2] * sv) * 0.5,
    s: f.uvFromV ? (sv + 1) / 2 : (su + 1) / 2, t: f.uvFromV ? (su + 1) / 2 : (sv + 1) / 2,
    o1: off(f.u) * su, o2: off(f.v) * sv,
  }));
  return { ...f, dn: off(f.n), corners };
});
const AO_CURVE = [0.45, 0.65, 0.82, 1.0];

// ---- growable typed buffers ----
class Builder {
  constructor(cap) { this.cap = cap; this.alloc(cap); this.n = 0; this.ni = 0; }
  alloc(cap) { this.pos = new Float32Array(cap * 3); this.uv = new Float32Array(cap * 2); this.light = new Float32Array(cap * 2); this.shade = new Float32Array(cap); this.tint = new Float32Array(cap * 3); this.idx = new Uint32Array(cap * 1.5 | 0); this.cap = cap; }
  reset() { this.n = 0; this.ni = 0; }
  ensure() {
    if (this.n + 4 <= this.cap) return;
    const o = { pos: this.pos, uv: this.uv, light: this.light, shade: this.shade, tint: this.tint, idx: this.idx };
    this.alloc(this.cap * 2);
    this.pos.set(o.pos); this.uv.set(o.uv); this.light.set(o.light); this.shade.set(o.shade); this.tint.set(o.tint); this.idx.set(o.idx);
  }
  vert(x, y, z, u, v, sk, bl, sh, tr, tg, tb) {
    const n = this.n; this.pos[n * 3] = x; this.pos[n * 3 + 1] = y; this.pos[n * 3 + 2] = z; this.uv[n * 2] = u; this.uv[n * 2 + 1] = v;
    this.light[n * 2] = sk; this.light[n * 2 + 1] = bl; this.shade[n] = sh; this.tint[n * 3] = tr; this.tint[n * 3 + 1] = tg; this.tint[n * 3 + 2] = tb; this.n++;
  }
  quadIdx(flip) {
    const b = this.n - 4, i = this.idx, k = this.ni;
    if (flip) { i[k] = b + 1; i[k + 1] = b + 2; i[k + 2] = b + 3; i[k + 3] = b + 1; i[k + 4] = b + 3; i[k + 5] = b; }
    else { i[k] = b; i[k + 1] = b + 1; i[k + 2] = b + 2; i[k + 3] = b; i[k + 4] = b + 2; i[k + 5] = b + 3; }
    this.ni += 6;
  }
  build() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.slice(0, this.n * 2), 2));
    g.setAttribute('light', new THREE.BufferAttribute(this.light.slice(0, this.n * 2), 2));
    g.setAttribute('shade', new THREE.BufferAttribute(this.shade.slice(0, this.n), 1));
    g.setAttribute('tint', new THREE.BufferAttribute(this.tint.slice(0, this.n * 3), 3));
    g.setIndex(new THREE.BufferAttribute(this.idx.slice(0, this.ni), 1));
    g.computeBoundingSphere();
    return g;
  }
}
const solidB = new Builder(16384), waterB = new Builder(2048);
const TW = 1 / ATLAS_COLS;

export function meshChunk(world, c) {
  ensureTiles();
  snapshot(world, c);
  solidB.reset(); waterB.reset();
  const TH = 1 / ATLAS_ROWS;
  // find highest non-air block to bound the y loop
  let maxY = 0;
  for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) { const base = idx(x, 0, z); for (let y = CY - 1; y > maxY; y--) if (c.blocks[base + y]) { maxY = y; break; } }

  for (let x = 0; x < CX; x++) for (let z = 0; z < CZ; z++) {
    const colP = P(x, 0, z);
    for (let y = 0; y <= maxY; y++) {
      const pi = colP + y;
      const id = pBlocks[pi];
      if (id === 0) continue;
      const shape = SHAPE[id];
      if (shape === 1) { emitCross(x, y, z, id, pi); continue; }
      if (LIQUID[id]) { emitLiquid(x, y, z, id, pi); continue; }
      const tr = TINT[id * 3], tg = TINT[id * 3 + 1], tb = TINT[id * 3 + 2];
      const transp = TRANSP[id];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f];
        const ni = pi + F.dn;
        const nb = pBlocks[ni];
        if (OPAQUE[nb]) continue;
        if (transp && nb === id) continue;
        const t = TILES[id * 3 + F.slot];
        const tcol = (t % ATLAS_COLS) * TW, trow = 1 - (Math.floor(t / ATLAS_COLS) + 1) * TH;
        solidB.ensure();
        let ao0 = 0, ao1 = 0, ao2 = 0, ao3 = 0;
        for (let ci = 0; ci < 4; ci++) {
          const C = F.corners[ci];
          const s1 = ni + C.o1, s2 = ni + C.o2, cc = ni + C.o1 + C.o2;
          const o1 = OPAQUE[pBlocks[s1]], o2 = OPAQUE[pBlocks[s2]];
          const oc = (o1 && o2) ? 1 : OPAQUE[pBlocks[cc]];
          const ao = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
          let sk = pSky[ni], bl = pLight[ni], cnt = 1;
          if (!o1) { sk += pSky[s1]; bl += pLight[s1]; cnt++; }
          if (!o2) { sk += pSky[s2]; bl += pLight[s2]; cnt++; }
          if (!oc) { sk += pSky[cc]; bl += pLight[cc]; cnt++; }
          const inv = 1 / (cnt * 15);
          solidB.vert(x + C.px, y + C.py, z + C.pz, tcol + C.s * TW, trow + C.t * TH, sk * inv, bl * inv, F.shade * AO_CURVE[ao], tr, tg, tb);
          if (ci === 0) ao0 = ao; else if (ci === 1) ao1 = ao; else if (ci === 2) ao2 = ao; else ao3 = ao;
        }
        solidB.quadIdx(ao0 + ao2 < ao1 + ao3);
      }
    }
  }
  return { solid: solidB.build(), water: waterB.build() };
}

function emitCross(x, y, z, id, pi) {
  const TH = 1 / ATLAS_ROWS;
  const t = TILES[id * 3 + 1];
  const u0 = (t % ATLAS_COLS) * TW, v0 = 1 - (Math.floor(t / ATLAS_COLS) + 1) * TH, u1 = u0 + TW, v1 = v0 + TH;
  const sk = pSky[pi] / 15, bl = pLight[pi] / 15;
  const tr = TINT[id * 3], tg = TINT[id * 3 + 1], tb = TINT[id * 3 + 2];
  const q = [
    [[x + 0.15, y, z + 0.15], [x + 0.85, y, z + 0.85], [x + 0.85, y + 1, z + 0.85], [x + 0.15, y + 1, z + 0.15]],
    [[x + 0.85, y, z + 0.15], [x + 0.15, y, z + 0.85], [x + 0.15, y + 1, z + 0.85], [x + 0.85, y + 1, z + 0.15]],
  ];
  const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  for (const quad of q) {
    solidB.ensure();
    for (let i = 0; i < 4; i++) solidB.vert(quad[i][0], quad[i][1], quad[i][2], uv[i][0], uv[i][1], sk, bl, 1, tr, tg, tb);
    solidB.quadIdx(false);
    solidB.ensure();
    for (let i = 3; i >= 0; i--) solidB.vert(quad[i][0], quad[i][1], quad[i][2], uv[i][0], uv[i][1], sk, bl, 1, tr, tg, tb);
    solidB.quadIdx(false);
  }
}

const LSIDES = [
  { d: SX, q: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], sh: 0.8 },
  { d: -SX, q: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], sh: 0.8 },
  { d: SZ, q: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], sh: 0.65 },
  { d: -SZ, q: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], sh: 0.65 },
];
function emitLiquid(x, y, z, id, pi) {
  const TH = 1 / ATLAS_ROWS;
  const t = TILES[id * 3];
  const u0 = (t % ATLAS_COLS) * TW, v0 = 1 - (Math.floor(t / ATLAS_COLS) + 1) * TH, u1 = u0 + TW, v1 = v0 + TH;
  const above = pBlocks[pi + 1];
  const top = above === id ? 1 : 0.875;
  const uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  if (above !== id) {
    const sk = pSky[pi + 1] / 15, bl = pLight[pi + 1] / 15;
    const q = [[x, y + top, z], [x, y + top, z + 1], [x + 1, y + top, z + 1], [x + 1, y + top, z]];
    waterB.ensure(); for (let i = 0; i < 4; i++) waterB.vert(q[i][0], q[i][1], q[i][2], uv[i][0], uv[i][1], sk, bl, 1, 1, 1, 1); waterB.quadIdx(false);
    waterB.ensure(); for (let i = 3; i >= 0; i--) waterB.vert(q[i][0], q[i][1], q[i][2], uv[i][0], uv[i][1], sk, bl, 1, 1, 1, 1); waterB.quadIdx(false);
  }
  for (const s of LSIDES) {
    const nb = pBlocks[pi + s.d];
    if (nb === id || OPAQUE[nb]) continue;
    const sk = pSky[pi + s.d] / 15, bl = pLight[pi + s.d] / 15;
    waterB.ensure();
    for (let i = 0; i < 4; i++) { const v = s.q[i]; waterB.vert(x + v[0], y + v[1] * top, z + v[2], uv[i][0], uv[i][1], sk, bl, s.sh, 1, 1, 1); }
    waterB.quadIdx(false);
  }
  const below = pBlocks[pi - 1];
  if (below !== id && !OPAQUE[below]) {
    const sk = pSky[pi - 1] / 15, bl = pLight[pi - 1] / 15;
    const q = [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]];
    waterB.ensure(); for (let i = 0; i < 4; i++) waterB.vert(q[i][0], q[i][1], q[i][2], uv[i][0], uv[i][1], sk, bl, 0.5, 1, 1, 1); waterB.quadIdx(false);
  }
}
