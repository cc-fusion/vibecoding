export function seedFromString(value) {
  const text = String(value || 'sanctuary');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + (b - a) * t;

export class Noise {
  constructor(seed = 1) {
    this.seed = typeof seed === 'number' ? seed | 0 : seedFromString(seed);
  }

  hash2(x, z, salt = 0) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263);
    h = (h + Math.imul((this.seed + salt) | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  hash3(x, y, z, salt = 0) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 1103515245) + Math.imul(z | 0, 668265263);
    h = (h + Math.imul((this.seed + salt) | 0, 1597334677)) | 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519);
    return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
  }

  noise2(x, z, salt = 0) {
    const xi = Math.floor(x);
    const zi = Math.floor(z);
    const tx = fade(x - xi);
    const tz = fade(z - zi);
    const a = this.hash2(xi, zi, salt) * 2 - 1;
    const b = this.hash2(xi + 1, zi, salt) * 2 - 1;
    const c = this.hash2(xi, zi + 1, salt) * 2 - 1;
    const d = this.hash2(xi + 1, zi + 1, salt) * 2 - 1;
    return lerp(lerp(a, b, tx), lerp(c, d, tx), tz);
  }

  noise3(x, y, z, salt = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const tx = fade(x - xi);
    const ty = fade(y - yi);
    const tz = fade(z - zi);
    const v = (dx, dy, dz) => this.hash3(xi + dx, yi + dy, zi + dz, salt) * 2 - 1;
    const x00 = lerp(v(0, 0, 0), v(1, 0, 0), tx);
    const x10 = lerp(v(0, 1, 0), v(1, 1, 0), tx);
    const x01 = lerp(v(0, 0, 1), v(1, 0, 1), tx);
    const x11 = lerp(v(0, 1, 1), v(1, 1, 1), tx);
    return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
  }

  fbm2(x, z, octaves = 4, salt = 0) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise2(x * frequency, z * frequency, salt + i * 31) * amplitude;
      total += amplitude;
      frequency *= 2.03;
      amplitude *= 0.5;
    }
    return value / total;
  }

  fbm3(x, y, z, octaves = 3, salt = 0) {
    let value = 0;
    let amplitude = 0.5;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      value += this.noise3(x * frequency, y * frequency, z * frequency, salt + i * 43) * amplitude;
      total += amplitude;
      frequency *= 2.02;
      amplitude *= 0.5;
    }
    return value / total;
  }

  ridge2(x, z, octaves = 4, salt = 0) {
    let value = 0;
    let amplitude = 0.55;
    let frequency = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise2(x * frequency, z * frequency, salt + i * 47));
      value += n * n * amplitude;
      total += amplitude;
      amplitude *= 0.5;
      frequency *= 2.08;
    }
    return value / total;
  }
}
