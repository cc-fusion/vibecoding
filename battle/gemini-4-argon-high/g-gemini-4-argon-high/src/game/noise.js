// Fast, deterministic seeded 2D & 3D noise and FBM for procedural voxel terrain

export function stringToSeed(str) {
  const s = String(str || 'VOXEL_REALMS_2026').trim();
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class SeededNoise {
  constructor(seedInput = 'VOXEL_REALMS') {
    this.seed = typeof seedInput === 'number' ? seedInput >>> 0 : stringToSeed(seedInput);
    this.perm = new Uint8Array(512);
    this._initPermutation(this.seed);
  }

  _initPermutation(seed) {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed || 123456789;
    for (let i = 255; i > 0; i--) {
      s = (Math.imul(1664525, s) + 1013904223) >>> 0;
      const j = s % (i + 1);
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  _fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  _lerp(a, b, t) {
    return a + t * (b - a);
  }

  _grad2(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) !== 0 ? -u : u) + ((h & 2) !== 0 ? -2.0 * v : 2.0 * v);
  }

  _grad3(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  // Returns value in roughly [-1, 1]
  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this._fade(xf);
    const v = this._fade(yf);

    const p = this.perm;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];

    const x1 = this._lerp(this._grad2(aa, xf, yf), this._grad2(ba, xf - 1, yf), u);
    const x2 = this._lerp(this._grad2(ab, xf, yf - 1), this._grad2(bb, xf - 1, yf - 1), u);
    return this._lerp(x1, x2, v) * 0.5;
  }

  // Returns value in roughly [-1, 1]
  noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = this._fade(xf);
    const v = this._fade(yf);
    const w = this._fade(zf);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    const x1 = this._lerp(this._grad3(p[AA], xf, yf, zf), this._grad3(p[BA], xf - 1, yf, zf), u);
    const x2 = this._lerp(this._grad3(p[AB], xf, yf - 1, zf), this._grad3(p[BB], xf - 1, yf - 1, zf), u);
    const y1 = this._lerp(x1, x2, v);

    const x3 = this._lerp(this._grad3(p[AA + 1], xf, yf, zf - 1), this._grad3(p[BA + 1], xf - 1, yf, zf - 1), u);
    const x4 = this._lerp(
      this._grad3(p[AB + 1], xf, yf - 1, zf - 1),
      this._grad3(p[BB + 1], xf - 1, yf - 1, zf - 1),
      u
    );
    const y2 = this._lerp(x3, x4, v);

    return this._lerp(y1, y2, w);
  }

  fbm2D(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxVal = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxVal += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return total / maxVal;
  }

  // Deterministic 2D hash in [0, 1)
  hash2D(x, z, salt = 0) {
    let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(this.seed + salt, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
}
