// Chunk mesher: culled faces, per-vertex ambient occlusion + smooth light, custom shapes.
import { CS, CH } from './constants.js';
import {
  B, DEFS, OPAQUE, SHAPE, MAX_ID, S_CUBE, S_CUTOUT, S_WATER, S_LAVA, S_CROSS, S_TORCH, S_BOX,
} from './blocks.js';
import { grassColor, foliageColor } from './colors.js';
import { hash3 } from './noise.js';

export const FL_EMIT = 1, FL_SWAY = 2, FL_WAVE = 4, FL_MASK = 8;

// face order: +X, -X, +Y, -Y, +Z, -Z
const FN = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FU = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [1, 0, 0], [-1, 0, 0]];
const FV = [[0, 1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [0, 1, 0], [0, 1, 0]];
const FO = [[1, 0, 1], [0, 0, 0], [0, 1, 1], [0, 0, 0], [0, 0, 1], [1, 0, 0]];
const SHADE = [0.82, 0.82, 1.0, 0.5, 0.68, 0.68];
const AOF = [0.5, 0.68, 0.84, 1.0];
const KU = [0, 1, 1, 0], KV = [0, 0, 1, 1];
const FRONT_FACE = [5, 0, 4, 1];

const PW = 18, PY = PW * PW;
const pidx = (x, y, z) => (y + 1) * PY + (z + 1) * PW + (x + 1);
const off = (v) => v[0] + v[1] * PY + v[2] * PW;
const OFF_N = FN.map(off), OFF_U = FU.map(off), OFF_V = FV.map(off);

const pb = new Uint8Array(PW * PW * (CH + 2));
const pl = new Uint8Array(PW * PW * (CH + 2));

const IS_LEAVES = new Uint8Array(MAX_ID), IS_TRANS = new Uint8Array(MAX_ID);
for (const d of DEFS) {
  if (!d || d.kind !== 'block') continue;
  if (d.leaves) IS_LEAVES[d.id] = 1;
  if (d.shape === S_WATER || d.icy) IS_TRANS[d.id] = 1;
}

class Builder {
  constructor() {
    this.cap = 4096;
    this.pos = new Float32Array(this.cap * 3);
    this.uvw = new Float32Array(this.cap * 3);
    this.light = new Uint8Array(this.cap * 4);
    this.tint = new Uint8Array(this.cap * 4);
    this.idx = new Uint32Array(this.cap * 2);
    this.nv = 0; this.ni = 0;
  }
  reset() { this.nv = 0; this.ni = 0; }
  grow() {
    const n = this.cap * 2;
    const np = new Float32Array(n * 3); np.set(this.pos); this.pos = np;
    const nu = new Float32Array(n * 3); nu.set(this.uvw); this.uvw = nu;
    const nl = new Uint8Array(n * 4); nl.set(this.light); this.light = nl;
    const nt = new Uint8Array(n * 4); nt.set(this.tint); this.tint = nt;
    const ni = new Uint32Array(n * 2); ni.set(this.idx); this.idx = ni;
    this.cap = n;
  }
  vert(x, y, z, u, v, layer, sky, blk, shade, flags, tr, tg, tb) {
    if (this.nv >= this.cap) this.grow();
    const i = this.nv++;
    const p = i * 3;
    this.pos[p] = x; this.pos[p + 1] = y; this.pos[p + 2] = z;
    this.uvw[p] = u; this.uvw[p + 1] = v; this.uvw[p + 2] = layer;
    const l = i * 4;
    this.light[l] = sky * 255 + 0.5; this.light[l + 1] = blk * 255 + 0.5; this.light[l + 2] = shade * 255 + 0.5; this.light[l + 3] = flags;
    this.tint[l] = tr; this.tint[l + 1] = tg; this.tint[l + 2] = tb; this.tint[l + 3] = 255;
  }
  tri(a, b, c) { this.idx[this.ni++] = a; this.idx[this.ni++] = b; this.idx[this.ni++] = c; }
  finish() {
    if (this.nv === 0) return null;
    return {
      pos: this.pos.slice(0, this.nv * 3), uvw: this.uvw.slice(0, this.nv * 3), light: this.light.slice(0, this.nv * 4),
      tint: this.tint.slice(0, this.nv * 4), idx: this.idx.slice(0, this.ni), count: this.nv,
    };
  }
}
const solidB = new Builder(), transB = new Builder();

const gcol = new Uint8Array(256 * 3), fcol = new Uint8Array(256 * 3);
const AOV = new Float32Array(4), SKV = new Float32Array(4), BLV = new Float32Array(4);

function fillPadded(world, chunk) {
  pb.fill(0);
  pl.fill(0xf0);
  // bottom padding row: solid bedrock so faces at y=0 are culled
  for (let i = 0; i < PY; i++) { pb[i] = B.BEDROCK; pl[i] = 0; }
  let top = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nc = world.getChunk(chunk.cx + dx, chunk.cz + dz);
    if (nc && nc.maxY > top) top = nc.maxY;
  }
  top = Math.min(CH - 1, top + 1);
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const nc = world.getChunk(chunk.cx + dx, chunk.cz + dz);
    if (!nc || nc.state < 2) {
      // missing: treat as dark solid-ish air
      continue;
    }
    const x0 = dx < 0 ? 15 : 0, x1 = dx > 0 ? 0 : 15;
    const z0 = dz < 0 ? 15 : 0, z1 = dz > 0 ? 0 : 15;
    for (let y = 0; y <= top; y++) {
      for (let z = z0; z <= z1; z++) {
        const src = (y << 8) | (z << 4);
        const px = dx === -1 ? -1 : dx === 1 ? 16 : 0;
        const pz = dz === -1 ? -1 : dz === 1 ? 16 : 0;
        if (dx === 0) {
          const d = pidx(0, y, pz === 0 ? z : pz);
          pb.set(nc.blocks.subarray(src, src + 16), d);
          pl.set(nc.light.subarray(src, src + 16), d);
        } else {
          const d = pidx(px, y, pz === 0 ? z : pz);
          const s = src + x0;
          pb[d] = nc.blocks[s]; pl[d] = nc.light[s];
        }
      }
    }
    void x1;
  }
}

function cubeFace(bld, bx, by, bz, f, i, layer, tr, tg, tb, flags, shadeMul) {
  const c = i + OFF_N[f], uo = OFF_U[f], vo = OFF_V[f];
  const un = FU[f], vn = FV[f], on = FO[f];
  for (let k = 0; k < 4; k++) {
    const su = (k === 1 || k === 2) ? uo : -uo, sv = k >= 2 ? vo : -vo;
    const s1 = c + su, s2 = c + sv, cr = c + su + sv;
    const o1 = OPAQUE[pb[s1]], o2 = OPAQUE[pb[s2]], oc = OPAQUE[pb[cr]];
    AOV[k] = (o1 && o2) ? 0 : 3 - (o1 + o2 + oc);
    const lc = pl[c];
    let sk = lc >> 4, bl = lc & 15, n = 1;
    if (!o1) { const l = pl[s1]; sk += l >> 4; bl += l & 15; n++; }
    if (!o2) { const l = pl[s2]; sk += l >> 4; bl += l & 15; n++; }
    if (!(o1 && o2) && !oc) { const l = pl[cr]; sk += l >> 4; bl += l & 15; n++; }
    SKV[k] = sk / (n * 15); BLV[k] = bl / (n * 15);
  }
  const base = bld.nv;
  const sh = SHADE[f] * shadeMul;
  for (let k = 0; k < 4; k++) {
    const ku = KU[k], kv = KV[k];
    const px = bx + on[0] + ku * un[0] + kv * vn[0];
    const py = by + on[1] + ku * un[1] + kv * vn[1];
    const pz = bz + on[2] + ku * un[2] + kv * vn[2];
    bld.vert(px, py, pz, ku, 1 - kv, layer, SKV[k], BLV[k], sh * AOF[AOV[k]], flags, tr, tg, tb);
  }
  if (AOV[0] + AOV[2] > AOV[1] + AOV[3]) { bld.tri(base, base + 1, base + 2); bld.tri(base, base + 2, base + 3); }
  else { bld.tri(base + 1, base + 2, base + 3); bld.tri(base + 1, base + 3, base); }
}

// axis-aligned partial box face with uniform light (chests, cactus, water, lava, bed)
function boxFace(bld, bx, by, bz, f, x0, y0, z0, x1, y1, z1, layer, sky, blk, shade, flags, flagTop, tr, tg, tb) {
  const un = FU[f], vn = FV[f];
  const mn = [x0, y0, z0], mx = [x1, y1, z1];
  const plane = [0, 0, 0];
  for (let a = 0; a < 3; a++) if (FN[f][a] !== 0) plane[a] = FN[f][a] > 0 ? mx[a] : mn[a];
  const base = bld.nv;
  for (let k = 0; k < 4; k++) {
    const ku = KU[k], kv = KV[k];
    const p = [0, 0, 0];
    let uc = 0, vc = 0;
    for (let a = 0; a < 3; a++) {
      if (FN[f][a] !== 0) p[a] = plane[a];
      else if (un[a] !== 0) {
        p[a] = un[a] > 0 ? mn[a] + (mx[a] - mn[a]) * ku : mx[a] - (mx[a] - mn[a]) * ku;
        uc = un[a] > 0 ? p[a] : 1 - p[a];
      } else {
        p[a] = vn[a] > 0 ? mn[a] + (mx[a] - mn[a]) * kv : mx[a] - (mx[a] - mn[a]) * kv;
        vc = vn[a] > 0 ? p[a] : 1 - p[a];
      }
    }
    const fl = flags | (p[1] > (y0 + y1) * 0.5 ? flagTop : 0);
    bld.vert(bx + p[0], by + p[1], bz + p[2], uc, 1 - vc, layer, sky, blk, shade, fl, tr, tg, tb);
  }
  bld.tri(base, base + 1, base + 2); bld.tri(base, base + 2, base + 3);
}

function torchMesh(bld, bx, by, bz, meta, layer, sky, blk) {
  // shear a 2x10x2 px box; wall torches lean away from the wall
  let cbx = 0.5, cbz = 0.5, ctx = 0.5, ctz = 0.5, y0 = 0, y1 = 10 / 16;
  if (meta >= 1 && meta <= 4) {
    const dirs = [null, [-1, 0], [1, 0], [0, -1], [0, 1]];
    const [wx, wz] = dirs[meta];
    cbx = 0.5 + wx * 0.34; cbz = 0.5 + wz * 0.34;
    ctx = 0.5 + wx * 0.14; ctz = 0.5 + wz * 0.14;
    y0 = 3.5 / 16; y1 = 13.5 / 16;
  }
  const h = 1 / 16;
  const bot = [[cbx - h, cbz - h], [cbx + h, cbz - h], [cbx + h, cbz + h], [cbx - h, cbz + h]];
  const top = [[ctx - h, ctz - h], [ctx + h, ctz - h], [ctx + h, ctz + h], [ctx - h, ctz + h]];
  const u0 = 7 / 16, u1 = 9 / 16, vb = 1, vt = 6 / 16;
  // four sides
  for (let s = 0; s < 4; s++) {
    const a = s, b = (s + 1) % 4;
    const base = bld.nv;
    bld.vert(bx + bot[a][0], by + y0, bz + bot[a][1], u0, vb, layer, sky, blk, 1, FL_EMIT, 255, 255, 255);
    bld.vert(bx + bot[b][0], by + y0, bz + bot[b][1], u1, vb, layer, sky, blk, 1, FL_EMIT, 255, 255, 255);
    bld.vert(bx + top[b][0], by + y1, bz + top[b][1], u1, vt, layer, sky, blk, 1, FL_EMIT, 255, 255, 255);
    bld.vert(bx + top[a][0], by + y1, bz + top[a][1], u0, vt, layer, sky, blk, 1, FL_EMIT, 255, 255, 255);
    bld.tri(base, base + 1, base + 2); bld.tri(base, base + 2, base + 3);
  }
  const base = bld.nv;
  const tv0 = 6 / 16, tv1 = 8 / 16;
  const uvs = [[u0, tv0], [u1, tv0], [u1, tv1], [u0, tv1]];
  for (let k = 3; k >= 0; k--) bld.vert(bx + top[k][0], by + y1, bz + top[k][1], uvs[k][0], uvs[k][1], layer, sky, blk, 1, FL_EMIT, 255, 255, 255);
  bld.tri(base, base + 1, base + 2); bld.tri(base, base + 2, base + 3);
}

function crossMesh(bld, bx, by, bz, wx, wz, layer, sky, blk, tr, tg, tb, sway) {
  const ox = (hash3(wx, by, wz, 5) - 0.5) * 0.3, oz = (hash3(wx, by, wz, 6) - 0.5) * 0.3;
  const a = 0.1, b = 0.9;
  const fl = sway ? FL_SWAY : 0;
  const quad = (x0, z0, x1, z1) => {
    const base = bld.nv;
    bld.vert(bx + x0 + ox, by, bz + z0 + oz, 0, 1, layer, sky, blk, 0.95, 0, tr, tg, tb);
    bld.vert(bx + x1 + ox, by, bz + z1 + oz, 1, 1, layer, sky, blk, 0.95, 0, tr, tg, tb);
    bld.vert(bx + x1 + ox, by + 1, bz + z1 + oz, 1, 0, layer, sky, blk, 1, fl, tr, tg, tb);
    bld.vert(bx + x0 + ox, by + 1, bz + z0 + oz, 0, 0, layer, sky, blk, 1, fl, tr, tg, tb);
    bld.tri(base, base + 1, base + 2); bld.tri(base, base + 2, base + 3);
  };
  quad(a, a, b, b);
  quad(b, a, a, b);
}

export function meshChunk(world, chunk) {
  fillPadded(world, chunk);
  solidB.reset(); transB.reset();
  const ox = chunk.cx * CS, oz = chunk.cz * CS;
  const blocks = chunk.blocks;
  for (let i = 0; i < 256; i++) {
    const g = grassColor((chunk.climate[i * 2] / 255) * 2 - 1, (chunk.climate[i * 2 + 1] / 255) * 2 - 1);
    const f = foliageColor((chunk.climate[i * 2] / 255) * 2 - 1, (chunk.climate[i * 2 + 1] / 255) * 2 - 1);
    gcol[i * 3] = g[0]; gcol[i * 3 + 1] = g[1]; gcol[i * 3 + 2] = g[2];
    fcol[i * 3] = f[0]; fcol[i * 3 + 1] = f[1]; fcol[i * 3 + 2] = f[2];
  }
  const maxY = Math.min(CH - 1, chunk.maxY);
  for (let y = 0; y <= maxY; y++) {
    for (let z = 0; z < CS; z++) {
      for (let x = 0; x < CS; x++) {
        const b = blocks[(y << 8) | (z << 4) | x];
        if (b === 0) continue;
        const i = pidx(x, y, z);
        const shape = SHAPE[b];
        const d = DEFS[b];
        const c2 = z * CS + x;
        if (shape === S_CUBE || shape === S_CUTOUT) {
          const bld = IS_TRANS[b] ? transB : solidB;
          for (let f = 0; f < 6; f++) {
            const n = pb[i + OFF_N[f]];
            if (OPAQUE[n]) continue;
            if (shape === S_CUTOUT && (n === b || (IS_LEAVES[b] && IS_LEAVES[n]))) continue;
            let layer = d.layers[f];
            if (d.facing && d.frontLayer >= 0) {
              const meta = chunk.meta.get((y << 8) | (z << 4) | x) || 0;
              if (FRONT_FACE[meta & 3] === f) layer = d.frontLayer;
            }
            let tr = 255, tg = 255, tb = 255, flags = 0;
            if (d.tint === 1) {
              if (f === 2) { tr = gcol[c2 * 3]; tg = gcol[c2 * 3 + 1]; tb = gcol[c2 * 3 + 2]; }
              else if (f !== 3) { tr = gcol[c2 * 3]; tg = gcol[c2 * 3 + 1]; tb = gcol[c2 * 3 + 2]; flags = FL_MASK; }
            } else if (d.tint === 2) { tr = fcol[c2 * 3]; tg = fcol[c2 * 3 + 1]; tb = fcol[c2 * 3 + 2]; }
            if (d.emit && b === B.FURNACE_LIT && layer === d.frontLayer) flags |= FL_EMIT;
            cubeFace(bld, x, y, z, f, i, layer, tr, tg, tb, flags, 1);
          }
        } else if (shape === S_WATER || shape === S_LAVA) {
          const lava = shape === S_LAVA;
          const bld = lava ? solidB : transB;
          const above = pb[i + PY];
          const hTop = above === b ? 1 : 14 / 16;
          const l = pl[i];
          let sky = (l >> 4) / 15, blk = (l & 15) / 15;
          for (let f = 0; f < 6; f++) {
            const n = pb[i + OFF_N[f]];
            if (n === b || OPAQUE[n]) continue;
            let ssky = sky, sblk = blk;
            if (f === 2) { const nl = pl[i + OFF_N[f]]; ssky = Math.max(sky, (nl >> 4) / 15); sblk = Math.max(blk, (nl & 15) / 15); }
            else { const nl = pl[i + OFF_N[f]]; ssky = Math.max(sky, (nl >> 4) / 15); sblk = Math.max(blk, (nl & 15) / 15); }
            boxFace(bld, x, y, z, f, 0, 0, 0, 1, hTop, 1, d.layers[f], lava ? 1 : ssky, lava ? 1 : sblk, lava ? 1 : SHADE[f] * 0.95 + 0.05, lava ? FL_EMIT : 0, lava || above === b ? 0 : FL_WAVE, 255, 255, 255);
          }
        } else if (shape === S_CROSS) {
          const l = pl[i];
          let tr = 255, tg = 255, tb = 255;
          if (d.tint === 1) { tr = gcol[c2 * 3]; tg = gcol[c2 * 3 + 1]; tb = gcol[c2 * 3 + 2]; }
          crossMesh(solidB, x, y, z, ox + x, oz + z, d.layers[0], (l >> 4) / 15, (l & 15) / 15, tr, tg, tb, true);
        } else if (shape === S_TORCH) {
          const meta = chunk.meta.get((y << 8) | (z << 4) | x) || 0;
          const l = pl[i];
          torchMesh(solidB, x, y, z, meta, d.layers[0], (l >> 4) / 15, 1);
        } else if (shape === S_BOX) {
          const bx = d.box;
          const x0 = bx[0] / 16, y0 = bx[1] / 16, z0 = bx[2] / 16, x1 = bx[3] / 16, y1 = bx[4] / 16, z1 = bx[5] / 16;
          const l = pl[i];
          const sky = (l >> 4) / 15, blk = (l & 15) / 15;
          for (let f = 0; f < 6; f++) {
            const n = pb[i + OFF_N[f]];
            const onBoundary = (f === 0 && x1 >= 1) || (f === 1 && x0 <= 0) || (f === 2 && y1 >= 1) || (f === 3 && y0 <= 0) || (f === 4 && z1 >= 1) || (f === 5 && z0 <= 0);
            if (onBoundary && OPAQUE[n]) continue;
            let layer = d.layers[f];
            if (d.facing && d.frontLayer >= 0) {
              const meta = chunk.meta.get((y << 8) | (z << 4) | x) || 0;
              if (FRONT_FACE[meta & 3] === f) layer = d.frontLayer;
            }
            let fs = sky, fb = blk;
            if (onBoundary) { const nl = pl[i + OFF_N[f]]; fs = Math.max(sky, (nl >> 4) / 15); fb = Math.max(blk, (nl & 15) / 15); }
            boxFace(solidB, x, y, z, f, x0, y0, z0, x1, y1, z1, layer, fs, fb, SHADE[f], 0, 0, 255, 255, 255);
          }
        }
      }
    }
  }
  return { solid: solidB.finish(), trans: transB.finish() };
}

// Build a standalone cube geometry description for a block id (items, hand, falling blocks, TNT)
export function blockCubeData(id, size = 1, light = 1) {
  const d = DEFS[id];
  const b = new Builder();
  const shape = d.shape;
  if (shape === S_CROSS || shape === S_TORCH) return null;
  const mn = [0, 0, 0], mx = [1, 1, 1];
  if (d.box) { for (let a = 0; a < 3; a++) { mn[a] = d.box[a] / 16; mx[a] = d.box[a + 3] / 16; } }
  for (let f = 0; f < 6; f++) {
    let layer = d.layers[f];
    if (d.frontLayer >= 0 && f === 4) layer = d.frontLayer;
    let tr = 255, tg = 255, tb = 255, fl = 0;
    if (d.tint === 1) { const g = grassColor(0.1, 0.05); if (f !== 3) { tr = g[0]; tg = g[1]; tb = g[2]; if (f !== 2) fl = FL_MASK; } }
    else if (d.tint === 2) { const g = foliageColor(0.1, 0.05); tr = g[0]; tg = g[1]; tb = g[2]; }
    const base = b.nv;
    const un = FU[f], vn = FV[f];
    const plane = [0, 0, 0];
    for (let a = 0; a < 3; a++) if (FN[f][a] !== 0) plane[a] = FN[f][a] > 0 ? mx[a] : mn[a];
    // item cubes are emissive (lit by a per-mesh tint); bake face shading into the vertex tint
    const sh = 0.55 + SHADE[f] * 0.45;
    for (let k = 0; k < 4; k++) {
      const ku = KU[k], kv = KV[k];
      const p = [0, 0, 0];
      let uc = 0, vc = 0;
      for (let a = 0; a < 3; a++) {
        if (FN[f][a] !== 0) p[a] = plane[a];
        else if (un[a] !== 0) { p[a] = un[a] > 0 ? mn[a] + (mx[a] - mn[a]) * ku : mx[a] - (mx[a] - mn[a]) * ku; uc = un[a] > 0 ? p[a] : 1 - p[a]; }
        else { p[a] = vn[a] > 0 ? mn[a] + (mx[a] - mn[a]) * kv : mx[a] - (mx[a] - mn[a]) * kv; vc = vn[a] > 0 ? p[a] : 1 - p[a]; }
      }
      b.vert((p[0] - 0.5) * size, (p[1] - 0.5) * size, (p[2] - 0.5) * size, uc, 1 - vc, layer, light, 0, 1, fl | FL_EMIT, tr * sh, tg * sh, tb * sh);
    }
    b.tri(base, base + 1, base + 2); b.tri(base, base + 2, base + 3);
  }
  return b.finish();
}
