export function hashSeedString(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return 20260707;
  if (/^-?\d+$/.test(trimmed)) {
    return (parseInt(trimmed, 10) >>> 0) || 1337;
  }
  let h = 2166136261;
  for (let i = 0; i < trimmed.length; i++) {
    h ^= trimmed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 42;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashCoords2D(x: number, z: number, seed: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hashCoords3D(x: number, y: number, z: number, seed: number): number {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 1103515245) ^
    Math.imul(z, 668265263) ^
    Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class SeededNoise {
  private perm = new Uint8Array(512);

  constructor(seed: number) {
    const rand = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad2(hash: number, x: number, y: number): number {
    switch (hash & 7) {
      case 0: return x + y;
      case 1: return x - y;
      case 2: return -x + y;
      case 3: return -x - y;
      case 4: return x;
      case 5: return -x;
      case 6: return y;
      default: return -y;
    }
  }

  private grad3(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const p = this.perm;
    const aa = p[p[X] + Y];
    const ab = p[p[X] + Y + 1];
    const ba = p[p[X + 1] + Y];
    const bb = p[p[X + 1] + Y + 1];

    const x1 = this.lerp(this.grad2(aa, xf, yf), this.grad2(ba, xf - 1, yf), u);
    const x2 = this.lerp(this.grad2(ab, xf, yf - 1), this.grad2(bb, xf - 1, yf - 1), u);
    return this.lerp(x1, x2, v); // ~[-1, 1]
  }

  noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const p = this.perm;
    const A = p[X] + Y;
    const AA = p[A] + Z;
    const AB = p[A + 1] + Z;
    const B = p[X + 1] + Y;
    const BA = p[B] + Z;
    const BB = p[B + 1] + Z;

    return this.lerp(
      this.lerp(
        this.lerp(this.grad3(p[AA], xf, yf, zf), this.grad3(p[BA], xf - 1, yf, zf), u),
        this.lerp(this.grad3(p[AB], xf, yf - 1, zf), this.grad3(p[BB], xf - 1, yf - 1, zf), u),
        v
      ),
      this.lerp(
        this.lerp(this.grad3(p[AA + 1], xf, yf, zf - 1), this.grad3(p[BA + 1], xf - 1, yf, zf - 1), u),
        this.lerp(
          this.grad3(p[AB + 1], xf, yf - 1, zf - 1),
          this.grad3(p[BB + 1], xf - 1, yf - 1, zf - 1),
          u
        ),
        v
      ),
      w
    );
  }

  fbm2D(x: number, y: number, octaves = 4, lacunarity = 2.0, gain = 0.5): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise2D(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  ridged2D(x: number, y: number, octaves = 4): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1.0 - Math.abs(this.noise2D(x * freq, y * freq));
      sum += amp * n * n;
      norm += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    return sum / norm; // [0..1]
  }

  fbm3D(x: number, y: number, z: number, octaves = 3): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise3D(x * freq, y * freq, z * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return sum / norm;
  }
}
