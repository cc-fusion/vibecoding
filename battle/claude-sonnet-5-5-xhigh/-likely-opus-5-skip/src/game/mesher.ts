// Voxel mesher: face culling, ambient occlusion, smooth skylight/blocklight. Pure (worker-safe).
import { B, CH, K, T_KIND, T_OPAQUE, T_FACE, TINT_TILE, T_TRANS } from './blocks';

export const PW = 18;
const DX = 1, DZ = PW, DY = PW * PW;
const FACE_D = [DX, -DX, DY, -DY, DZ, -DZ];
const FACE_V = [
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
];
const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const SHADE = [0.6, 0.6, 1.0, 0.5, 0.8, 0.8];
const AOF = [0.5, 0.68, 0.84, 1.0];
const FU = [0, 1, 1, 0], FV = [0, 0, 1, 1];
const PAD = 0.03;
const STR = [1, DY, DZ];
const AOFF = new Int32Array(6 * 4 * 4);
for (let f = 0; f < 6; f++) {
  const n = FACE_N[f];
  const a = n[0] ? 0 : n[1] ? 1 : 2;
  const [b, c] = [0, 1, 2].filter((k) => k !== a);
  for (let v = 0; v < 4; v++) {
    const cv = FACE_V[f][v];
    const sb = cv[b] * 2 - 1, sc = cv[c] * 2 - 1;
    const layer = n[a] * STR[a];
    const o = (f * 4 + v) * 4;
    AOFF[o] = layer;
    AOFF[o + 1] = layer + sb * STR[b];
    AOFF[o + 2] = layer + sc * STR[c];
    AOFF[o + 3] = layer + sb * STR[b] + sc * STR[c];
  }
}

export interface GeoData {
  pos: Float32Array; uv: Float32Array; col: Uint8Array; lit: Uint8Array; idx: Uint32Array; minY: number; maxY: number;
}
export interface MeshInput { blocks: Uint8Array; light: Uint8Array; climate: Uint8Array; maxY: number }

class Geo {
  pos = new Float32Array(3 * 4096); uv = new Float32Array(2 * 4096);
  col = new Uint8Array(4 * 4096); lit = new Uint8Array(4 * 4096); idx = new Uint32Array(6 * 2048);
  nv = 0; ni = 0; minY = 1e9; maxY = -1e9;
  ensure() {
    if ((this.nv + 4) * 3 > this.pos.length) {
      const g = <T extends Float32Array | Uint8Array>(a: T): T => { const n = new (a.constructor as any)(a.length * 2); n.set(a); return n; };
      this.pos = g(this.pos); this.uv = g(this.uv); this.col = g(this.col); this.lit = g(this.lit);
    }
    if (this.ni + 6 > this.idx.length) { const n = new Uint32Array(this.idx.length * 2); n.set(this.idx); this.idx = n; }
  }
  v(x: number, y: number, z: number, u: number, v: number, r: number, g: number, b: number, sky: number, blk: number, sw: number, fl: number) {
    const i = this.nv++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    const c = i * 4;
    this.col[c] = r; this.col[c + 1] = g; this.col[c + 2] = b; this.col[c + 3] = 255;
    this.lit[c] = sky; this.lit[c + 1] = blk; this.lit[c + 2] = sw; this.lit[c + 3] = fl;
    if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
  }
  quad(flip: boolean) {
    const b = this.nv - 4, i = this.ni;
    if (!flip) { this.idx[i] = b; this.idx[i + 1] = b + 1; this.idx[i + 2] = b + 2; this.idx[i + 3] = b; this.idx[i + 4] = b + 2; this.idx[i + 5] = b + 3; }
    else { this.idx[i] = b + 1; this.idx[i + 1] = b + 2; this.idx[i + 2] = b + 3; this.idx[i + 3] = b + 1; this.idx[i + 4] = b + 3; this.idx[i + 5] = b; }
    this.ni += 6;
  }
  finish(): GeoData | null {
    if (!this.nv) return null;
    return {
      pos: this.pos.slice(0, this.nv * 3), uv: this.uv.slice(0, this.nv * 2), col: this.col.slice(0, this.nv * 4),
      lit: this.lit.slice(0, this.nv * 4), idx: this.idx.slice(0, this.ni), minY: this.minY, maxY: this.maxY,
    };
  }
}

let BL: Uint8Array, LT: Uint8Array;
const GT = new Float32Array(256 * 3), FT = new Float32Array(256 * 3);
const AO4 = new Float32Array(4), SK4 = new Float32Array(4), BK4 = new Float32Array(4);
const uu = (tile: number, f: number) => ((tile & 15) + PAD + f * (1 - 2 * PAD)) / 16;
const vv = (tile: number, f: number) => (15 - (tile >> 4) + PAD + f * (1 - 2 * PAD)) / 16;
const c255 = (x: number) => (x > 1 ? 255 : (x * 255) | 0);

function tintTables(climate: Uint8Array) {
  for (let i = 0; i < 256; i++) {
    const t = climate[i * 2] / 255 * 2 - 1, h = climate[i * 2 + 1] / 255 * 2 - 1;
    const cold = Math.min(1, Math.max(0, (-0.05 - t) * 2.6));
    const dry = Math.min(1, Math.max(0, (t - 0.12) * 2.6)) * Math.min(1, Math.max(0, (0.1 - h) * 3));
    const gr = 0.42 + cold * 0.1 + dry * 0.34, gg = 0.76 - cold * 0.05 - dry * 0.02, gb = 0.27 + cold * 0.26 + dry * 0.08;
    GT[i * 3] = gr; GT[i * 3 + 1] = gg; GT[i * 3 + 2] = gb;
    FT[i * 3] = 0.36 + cold * 0.08 + dry * 0.25; FT[i * 3 + 1] = 0.66 - cold * 0.04 - dry * 0.04; FT[i * 3 + 2] = 0.2 + cold * 0.18 + dry * 0.04;
  }
}

function tintOf(tile: number, ci: number, out: Float32Array) {
  const t = TINT_TILE[tile];
  if (t === 1) { out[0] = GT[ci * 3]; out[1] = GT[ci * 3 + 1]; out[2] = GT[ci * 3 + 2]; }
  else if (t === 2) { out[0] = FT[ci * 3]; out[1] = FT[ci * 3 + 1]; out[2] = FT[ci * 3 + 2]; }
  else { out[0] = 1; out[1] = 1; out[2] = 1; }
}
const TN = new Float32Array(3);

function cube(g: Geo, id: number, x: number, y: number, z: number, base: number, ci: number, lava: boolean, topH: number) {
  const opq = T_OPAQUE[id];
  for (let f = 0; f < 6; f++) {
    if (y === 0 && f === 3) continue;
    const ni = base + FACE_D[f];
    const nb = BL[ni] | 0;
    if (opq) { if (T_OPAQUE[nb]) continue; } else if (nb === id || T_OPAQUE[nb]) continue;
    if (lava && nb === B.LAVA) continue;
    const tile = T_FACE[id * 6 + f];
    tintOf(tile, ci, TN);
    for (let v = 0; v < 4; v++) {
      const o = (f * 4 + v) * 4;
      const i1 = base + AOFF[o + 1], i2 = base + AOFF[o + 2], i3 = base + AOFF[o + 3];
      const o1 = T_OPAQUE[BL[i1] | 0], o2 = T_OPAQUE[BL[i2] | 0], oc = T_OPAQUE[BL[i3] | 0];
      AO4[v] = o1 && o2 ? 0 : 3 - (o1 + o2 + oc);
      const l0 = LT[base + AOFF[o]] | 0;
      let sky = l0 & 15, blk = l0 >> 4, n = 1;
      if (!o1) { const l = LT[i1] | 0; sky += l & 15; blk += l >> 4; n++; }
      if (!o2) { const l = LT[i2] | 0; sky += l & 15; blk += l >> 4; n++; }
      if (!oc && !(o1 && o2)) { const l = LT[i3] | 0; sky += l & 15; blk += l >> 4; n++; }
      SK4[v] = sky / n; BK4[v] = blk / n;
    }
    if (lava) { const ol = LT[base] | 0; for (let v = 0; v < 4; v++) { SK4[v] = Math.max(SK4[v], ol & 15); BK4[v] = 15; } }
    g.ensure();
    for (let v = 0; v < 4; v++) {
      const c = FACE_V[f][v];
      const s = SHADE[f] * AOF[AO4[v]];
      const py = c[1] === 1 ? y + topH : y;
      g.v(x + c[0], py, z + c[2], uu(tile, FU[v]), vv(tile, FV[v]), c255(TN[0] * s), c255(TN[1] * s), c255(TN[2] * s), SK4[v] * 17, BK4[v] * 17, 0, lava ? 128 : 0);
    }
    g.quad(AO4[0] + AO4[2] < AO4[1] + AO4[3]);
  }
}

function water(g: Geo, x: number, y: number, z: number, base: number) {
  const above = BL[base + DY] | 0;
  const topH = above === B.WATER ? 1 : 0.88;
  for (let f = 0; f < 6; f++) {
    if (y === 0 && f === 3) continue;
    const ni = base + FACE_D[f];
    const nb = BL[ni] | 0;
    if (nb === B.WATER || T_OPAQUE[nb] || nb === B.ICE) continue;
    const l = f === 2 ? (LT[base] | 0) | (LT[ni] | 0) : LT[ni] | 0;
    const sky = (l & 15) * 17, blk = (l >> 4) * 17;
    const s = c255(SHADE[f]);
    g.ensure();
    for (let v = 0; v < 4; v++) {
      const c = FACE_V[f][v];
      const top = c[1] === 1;
      g.v(x + c[0], top ? y + topH : y, z + c[2], 0, 0, s, s, s, sky, blk, 0, top && topH < 1 ? 255 : 0);
    }
    g.quad(false);
  }
}

function cross(g: Geo, id: number, x: number, y: number, z: number, base: number, ci: number) {
  const tile = T_FACE[id * 6 + 2];
  tintOf(tile, ci, TN);
  const l = LT[base] | 0;
  const sky = (l & 15) * 17, blk = (l >> 4) * 17;
  const r = c255(TN[0] * 0.95), gg = c255(TN[1] * 0.95), b = c255(TN[2] * 0.95);
  const a = 0.08, e = 0.92;
  const planes = [[a, a, e, e], [e, a, a, e]];
  for (const p of planes) {
    for (let side = 0; side < 2; side++) {
      g.ensure();
      const x0 = p[0], z0 = p[1], x1 = p[2], z1 = p[3];
      const vs = side === 0 ? [[x0, 0, z0], [x1, 0, z1], [x1, 1, z1], [x0, 1, z0]] : [[x1, 0, z1], [x0, 0, z0], [x0, 1, z0], [x1, 1, z1]];
      for (let v = 0; v < 4; v++) {
        g.v(x + vs[v][0], y + vs[v][1], z + vs[v][2], uu(tile, FU[v]), vv(tile, FV[v]), r, gg, b, sky, blk, vs[v][1] > 0.5 ? 255 : 0, 0);
      }
      g.quad(false);
    }
  }
}

function box(g: Geo, id: number, x: number, y: number, z: number, base: number, ci: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
  const own = LT[base] | 0;
  const bnd = [x1 >= 1, x0 <= 0, y1 >= 1, y0 <= 0, z1 >= 1, z0 <= 0];
  for (let f = 0; f < 6; f++) {
    const ni = base + FACE_D[f];
    const nb = BL[ni] | 0;
    if (bnd[f] && (T_OPAQUE[nb] || nb === id)) continue;
    if (y === 0 && f === 3) continue;
    let l = own;
    if (bnd[f]) { const n = LT[ni] | 0; l = Math.max(own & 15, n & 15) | (Math.max(own >> 4, n >> 4) << 4); }
    const sky = (l & 15) * 17, blk = (l >> 4) * 17;
    const tile = T_FACE[id * 6 + f];
    tintOf(tile, ci, TN);
    const s = SHADE[f];
    g.ensure();
    for (let v = 0; v < 4; v++) {
      const c = FACE_V[f][v];
      const px = c[0] ? x1 : x0, py = c[1] ? y1 : y0, pz = c[2] ? z1 : z0;
      let u: number, w: number;
      switch (f) {
        case 0: u = 1 - pz; w = py; break;
        case 1: u = pz; w = py; break;
        case 2: u = px; w = 1 - pz; break;
        case 3: u = px; w = pz; break;
        case 4: u = px; w = py; break;
        default: u = 1 - px; w = py;
      }
      if (id === B.TORCH && f === 2) { u = px; w = 10 / 16 + (pz - 7 / 16); }
      g.v(x + px, y + py, z + pz, uu(tile, u), vv(tile, w), c255(TN[0] * s), c255(TN[1] * s), c255(TN[2] * s), sky, blk, 0, 0);
    }
    g.quad(false);
  }
}

export function meshChunk(inp: MeshInput) {
  BL = inp.blocks; LT = inp.light;
  tintTables(inp.climate);
  const og = new Geo(), wg = new Geo();
  const maxY = Math.min(CH - 2, inp.maxY);
  for (let y = 0; y <= maxY; y++) {
    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const base = (y * PW + z + 1) * PW + x + 1;
        const id = BL[base];
        if (!id) continue;
        const ci = z * 16 + x;
        switch (T_KIND[id]) {
          case K.CUBE: cube(T_TRANS[id] ? wg : og, id, x, y, z, base, ci, false, 1); break;
          case K.WATER: water(wg, x, y, z, base); break;
          case K.LAVA: cube(og, id, x, y, z, base, ci, true, (BL[base + DY] | 0) === B.LAVA ? 1 : 0.88); break;
          case K.CROSS: cross(og, id, x, y, z, base, ci); break;
          case K.TORCH: box(og, id, x, y, z, base, ci, 7 / 16, 0, 7 / 16, 9 / 16, 0.75, 9 / 16); break;
          case K.CACTUS: box(og, id, x, y, z, base, ci, 1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16); break;
          case K.FARM: box(og, id, x, y, z, base, ci, 0, 0, 0, 1, 15 / 16, 1); break;
        }
      }
    }
  }
  return { opaque: og.finish(), water: wg.finish() };
}
