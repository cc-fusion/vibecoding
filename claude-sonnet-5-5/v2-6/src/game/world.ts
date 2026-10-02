// World generation: seeded noise, heightfield, tectonic plates (x wraps like a planet)

export const W = 112;
export const H = 70;
export const N = W * H;

export const mod = (a: number, n: number) => ((a % n) + n) % n;
export function wrapDX(a: number, b: number) {
  let d = a - b;
  if (d > W / 2) d -= W; else if (d < -W / 2) d += W;
  return d;
}
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(ix: number, iy: number, seed: number) {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const sm = (t: number) => t * t * (3 - 2 * t);
// tileable in x: lattice has `px` cells around the world
export function noise2(x: number, y: number, px: number, seed: number) {
  const u = (x / W) * px, v = (y / W) * px;
  const ix = Math.floor(u), iy = Math.floor(v);
  const fx = sm(u - ix), fy = sm(v - iy);
  const a = hash(mod(ix, px), iy, seed), b = hash(mod(ix + 1, px), iy, seed);
  const c = hash(mod(ix, px), iy + 1, seed), d = hash(mod(ix + 1, px), iy + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm(x: number, y: number, seed: number, oct = 4, base = 4) {
  let amp = 0.5, sum = 0, norm = 0, px = base;
  for (let o = 0; o < oct; o++) {
    sum += noise2(x, y, px, seed + o * 17) * amp; norm += amp; amp *= 0.5; px *= 2;
  }
  return sum / norm;
}

export interface Plate {
  id: number; name: string; hue: number; sx: number; sy: number;
  ox: number; oy: number; // continuous offset
  minOy: number; maxOy: number;
  lx: Int16Array; ly: Int16Array; h: Float32Array; n: number;
  dx: number; dy: number; // mantle drift cells/sec
  continental: boolean;
}

export const PLATE_NAMES = ['Aegir', 'Borea', 'Cinder', 'Dusk', 'Ember', 'Fjord', 'Gale', 'Halcyon'];

export interface GenResult { plates: Plate[]; hbase: Float32Array; moist: Float32Array; }

export function generateWorld(seed: number): GenResult {
  const rnd = mulberry32(seed);
  const s1 = Math.floor(rnd() * 100000);
  const nv = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // latitudinal bias: poles lean toward ocean a little
    const lat = Math.abs(y / (H - 1) - 0.5) * 2;
    nv[y * W + x] = fbm(x, y, s1, 5, 3) - lat * lat * 0.12;
  }
  const sorted = Array.from(nv).sort((a, b) => a - b);
  const t = sorted[Math.floor(N * 0.62)];
  const tmin = sorted[0], tmax = sorted[N - 1];
  const hbase = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, n = nv[i];
    if (n >= t) {
      const k = (n - t) / Math.max(0.0001, tmax - t);
      const ridge = 1 - Math.abs(noise2(x, y, 14, s1 + 91) * 2 - 1);
      hbase[i] = 0.04 + Math.pow(k, 0.85) * 0.5 + ridge * 0.3 * Math.pow(k, 0.7);
    } else {
      const k = (t - n) / Math.max(0.0001, t - tmin);
      hbase[i] = -(0.07 + Math.pow(k, 0.8) * 0.85);
    }
  }
  const moist = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) moist[y * W + x] = fbm(x, y, s1 + 555, 3, 5);

  // plates: 4 columns x 2 rows, jittered seeds, noise-warped voronoi
  const seeds: { x: number; y: number }[] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    seeds.push({
      x: Math.round(((c + 0.5) * W) / 4 + (rnd() - 0.5) * 8),
      y: Math.round(((r + 0.5) * H) / 2 + (rnd() - 0.5) * 8),
    });
  }
  const owner = new Int8Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = 1e9, bi = 0;
    const w1 = (noise2(x, y, 9, s1 + 31) - 0.5) * 12;
    const w2 = (noise2(x, y, 9, s1 + 77) - 0.5) * 12;
    for (let p = 0; p < seeds.length; p++) {
      const dx = wrapDX(x + w1, seeds[p].x), dy = y + w2 - seeds[p].y;
      const d = dx * dx + dy * dy * 1.15;
      if (d < best) { best = d; bi = p; }
    }
    owner[y * W + x] = bi;
  }
  const plates: Plate[] = [];
  for (let p = 0; p < seeds.length; p++) {
    const xs: number[] = [], ys: number[] = [], hs: number[] = [];
    let land = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (owner[i] !== p) continue;
      xs.push(wrapDX(x, seeds[p].x)); ys.push(y - seeds[p].y); hs.push(hbase[i]);
      if (hbase[i] > 0) land++;
    }
    let minLy = 1e9, maxLy = -1e9;
    for (const v of ys) { if (v < minLy) minLy = v; if (v > maxLy) maxLy = v; }
    if (xs.length === 0) { minLy = 0; maxLy = 0; }
    const ang = rnd() * Math.PI * 2, sp = 0.035 + rnd() * 0.05;
    plates.push({
      id: p, name: PLATE_NAMES[p], hue: Math.round((p * 47 + 20) % 360), sx: seeds[p].x, sy: seeds[p].y, ox: 0, oy: 0,
      minOy: -(seeds[p].y + minLy), maxOy: H - 1 - (seeds[p].y + maxLy),
      lx: Int16Array.from(xs), ly: Int16Array.from(ys), h: Float32Array.from(hs), n: xs.length,
      dx: Math.cos(ang) * sp, dy: Math.sin(ang) * sp * 0.6, continental: land > xs.length * 0.3,
    });
  }
  return { plates, hbase, moist };
}

const SYL_A = ['Ka', 'Mo', 'Ri', 'Te', 'Su', 'Lo', 'Va', 'Ni', 'Or', 'Da', 'Be', 'Ha', 'Ul', 'Ze', 'Pa', 'Fe'];
const SYL_B = ['ra', 'no', 'lu', 'shi', 'th', 'ven', 'dor', 'mi', 'ga', 'sel', 'ko', 'rin'];
const SYL_C = ['hold', 'haven', 'ford', 'rest', 'mere', 'stead', 'wick', 'fall', 'reach', 'watch'];
export function settlementName(rnd: () => number) {
  const a = SYL_A[Math.floor(rnd() * SYL_A.length)];
  const b = SYL_B[Math.floor(rnd() * SYL_B.length)];
  return rnd() < 0.5 ? a + b : a + b + SYL_C[Math.floor(rnd() * SYL_C.length)];
}
