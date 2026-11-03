export function hashSeed(input) {
  const str = String(input ?? 'terravox-seed');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createRng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

export class NoiseGenerator {
  constructor(seed) {
    this.seedNum = hashSeed(seed);
    const rng = createRng(this.seedNum);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);

    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const perm = this.perm;
    const pm12 = this.permMod12;

    const aa = pm12[X + perm[Y]];
    const ab = pm12[X + perm[Y + 1]];
    const ba = pm12[X + 1 + perm[Y]];
    const bb = pm12[X + 1 + perm[Y + 1]];

    const gAA = GRAD3[aa];
    const gBA = GRAD3[ba];
    const gAB = GRAD3[ab];
    const gBB = GRAD3[bb];

    const x1 = lerp(gAA[0] * xf + gAA[1] * yf, gBA[0] * (xf - 1) + gBA[1] * yf, u);
    const x2 = lerp(
      gAB[0] * xf + gAB[1] * (yf - 1),
      gBB[0] * (xf - 1) + gBB[1] * (yf - 1),
      u
    );
    return lerp(x1, x2, v);
  }

  noise3D(x, y, z) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);

    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);

    const perm = this.perm;
    const pm12 = this.permMod12;

    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;

    const g000 = GRAD3[pm12[AA]];
    const g100 = GRAD3[pm12[BA]];
    const g010 = GRAD3[pm12[AB]];
    const g110 = GRAD3[pm12[BB]];
    const g001 = GRAD3[pm12[AA + 1]];
    const g101 = GRAD3[pm12[BA + 1]];
    const g011 = GRAD3[pm12[AB + 1]];
    const g111 = GRAD3[pm12[BB + 1]];

    const n000 = g000[0] * xf + g000[1] * yf + g000[2] * zf;
    const n100 = g100[0] * (xf - 1) + g100[1] * yf + g100[2] * zf;
    const n010 = g010[0] * xf + g010[1] * (yf - 1) + g010[2] * zf;
    const n110 = g110[0] * (xf - 1) + g110[1] * (yf - 1) + g110[2] * zf;
    const n001 = g001[0] * xf + g001[1] * yf + g001[2] * (zf - 1);
    const n101 = g101[0] * (xf - 1) + g101[1] * yf + g101[2] * (zf - 1);
    const n011 = g011[0] * xf + g011[1] * (yf - 1) + g011[2] * (zf - 1);
    const n111 = g111[0] * (xf - 1) + g111[1] * (yf - 1) + g111[2] * (zf - 1);

    const nx00 = lerp(n000, n100, u);
    const nx10 = lerp(n010, n110, u);
    const nx01 = lerp(n001, n101, u);
    const nx11 = lerp(n011, n111, u);

    const nxy0 = lerp(nx00, nx10, v);
    const nxy1 = lerp(nx01, nx11, v);

    return lerp(nxy0, nxy1, w);
  }

  fbm2D(x, z, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let sum = 0;
    let amp = 1.0;
    let freq = 1.0;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.noise2D(x * freq + i * 31.7, z * freq - i * 19.3) * amp;
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }

  ridged2D(x, z, octaves = 4, lacunarity = 2.1, gain = 0.5) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1.0;
    let prev = 1.0;
    for (let i = 0; i < octaves; i++) {
      let n = 1.0 - Math.abs(this.noise2D(x * freq - i * 17.1, z * freq + i * 43.9));
      n = n * n;
      sum += n * amp * prev;
      prev = Math.max(0.15, n);
      freq *= lacunarity;
      amp *= gain;
    }
    return sum;
  }

  coordRand(x, y, z, salt = 0) {
    let h = this.seedNum ^ Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647) ^ Math.imul(salt, 1597334677);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
}
