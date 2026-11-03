// Seeded gradient noise + hashing utilities (pure, worker-safe).
export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(x: number, z: number, s: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hash3(x: number, y: number, z: number, s: number) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 1103515245) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}

const G3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1], [1, 1, 0], [-1, 1, 0], [0, -1, 1], [0, -1, -1],
];
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

export class Noise {
  p = new Uint8Array(512);
  constructor(seed: number) {
    const r = mulberry32(seed ^ 0x5bd1e995);
    const a = new Uint8Array(256);
    for (let i = 0; i < 256; i++) a[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (r() * (i + 1)) | 0;
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    for (let i = 0; i < 512; i++) this.p[i] = a[i & 255];
  }
  n2(x: number, y: number) {
    const p = this.p;
    const X = Math.floor(x), Y = Math.floor(y);
    x -= X; y -= Y;
    const xi = X & 255, yi = Y & 255;
    const u = fade(x), v = fade(y);
    const aa = p[p[xi] + yi], ab = p[p[xi] + yi + 1], ba = p[p[xi + 1] + yi], bb = p[p[xi + 1] + yi + 1];
    const g = (h: number, dx: number, dy: number) => { const q = G3[h & 15]; return q[0] * dx + q[1] * dy; };
    const l1 = g(aa, x, y) + u * (g(ba, x - 1, y) - g(aa, x, y));
    const l2 = g(ab, x, y - 1) + u * (g(bb, x - 1, y - 1) - g(ab, x, y - 1));
    return (l1 + v * (l2 - l1)) * 0.95;
  }
  n3(x: number, y: number, z: number) {
    const p = this.p;
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const a = p[xi] + yi, aa = p[a] + zi, ab = p[a + 1] + zi;
    const b = p[xi + 1] + yi, ba = p[b] + zi, bb = p[b + 1] + zi;
    const g = (h: number, dx: number, dy: number, dz: number) => { const q = G3[p[h] & 15]; return q[0] * dx + q[1] * dy + q[2] * dz; };
    const x1 = g(aa, x, y, z) + u * (g(ba, x - 1, y, z) - g(aa, x, y, z));
    const x2 = g(ab, x, y - 1, z) + u * (g(bb, x - 1, y - 1, z) - g(ab, x, y - 1, z));
    const x3 = g(aa + 1, x, y, z - 1) + u * (g(ba + 1, x - 1, y, z - 1) - g(aa + 1, x, y, z - 1));
    const x4 = g(ab + 1, x, y - 1, z - 1) + u * (g(bb + 1, x - 1, y - 1, z - 1) - g(ab + 1, x, y - 1, z - 1));
    const y1 = x1 + v * (x2 - x1), y2 = x3 + v * (x4 - x3);
    return y1 + w * (y2 - y1);
  }
  fbm2(x: number, y: number, oct: number) {
    let a = 1, f = 1, s = 0, n = 0;
    for (let i = 0; i < oct; i++) { s += this.n2(x * f, y * f) * a; n += a; a *= 0.5; f *= 2; }
    return s / n;
  }
}

export const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
