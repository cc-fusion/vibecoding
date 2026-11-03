// Seeded RNG + value noise + fBm
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash2(x: number, y: number, seed: number) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (((h ^ (h >> 16)) >>> 0) % 100000) / 100000;
}
export function hash3(x: number, y: number, z: number, seed: number) {
  let h = seed + x * 374761393 + y * 2246822519 + z * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (((h ^ (h >> 16)) >>> 0) % 100000) / 100000;
}
function smooth(t: number) { return t * t * (3 - 2 * t); }
export class Noise2D {
  constructor(public seed: number) {}
  get(x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = hash2(xi, yi, this.seed);
    const b = hash2(xi + 1, yi, this.seed);
    const c = hash2(xi, yi + 1, this.seed);
    const d = hash2(xi + 1, yi + 1, this.seed);
    const u = smooth(xf), v = smooth(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  fbm(x: number, y: number, oct = 4, lac = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += amp * this.get(x * freq, y * freq);
      norm += amp; amp *= gain; freq *= lac;
    }
    return sum / norm;
  }
}
export class Noise3D {
  constructor(public seed: number) {}
  get(x: number, y: number, z: number) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = smooth(xf), v = smooth(yf), w = smooth(zf);
    const c000 = hash3(xi, yi, zi, this.seed), c100 = hash3(xi + 1, yi, zi, this.seed);
    const c010 = hash3(xi, yi + 1, zi, this.seed), c110 = hash3(xi + 1, yi + 1, zi, this.seed);
    const c001 = hash3(xi, yi, zi + 1, this.seed), c101 = hash3(xi + 1, yi, zi + 1, this.seed);
    const c011 = hash3(xi, yi + 1, zi + 1, this.seed), c111 = hash3(xi + 1, yi + 1, zi + 1, this.seed);
    const x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
    const x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }
  fbm(x: number, y: number, z: number, oct = 3) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < oct; i++) { sum += amp * this.get(x * freq, y * freq, z * freq); norm += amp; amp *= 0.5; freq *= 2; }
    return sum / norm;
  }
}
export function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
export function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
