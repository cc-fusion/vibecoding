export function stringToSeed(str) {
  const s = String(str ?? 'VoxelWilds').trim() || 'VoxelWilds';
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashCoords2D(x, z, seed) {
  let h = (Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function hashCoords3D(x, y, z, seed) {
  let h =
    (Math.imul(x, 374761393) ^
      Math.imul(y, 1103515245) ^
      Math.imul(z, 668265263) ^
      Math.imul(seed, 1442695041)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a, b, t) {
  return a + t * (b - a);
}

export class SeededNoise {
  constructor(seedInput) {
    this.seed = typeof seedInput === 'number' ? seedInput >>> 0 : stringToSeed(seedInput);
    const rng = mulberry32(this.seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
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
    const pm = this.permMod12;

    const aa = pm[X + perm[Y]];
    const ab = pm[X + perm[Y + 1]];
    const ba = pm[X + 1 + perm[Y]];
    const bb = pm[X + 1 + perm[Y + 1]];

    const gAA = GRAD3[aa][0] * xf + GRAD3[aa][1] * yf;
    const gBA = GRAD3[ba][0] * (xf - 1) + GRAD3[ba][1] * yf;
    const gAB = GRAD3[ab][0] * xf + GRAD3[ab][1] * (yf - 1);
    const gBB = GRAD3[bb][0] * (xf - 1) + GRAD3[bb][1] * (yf - 1);

    return lerp(lerp(gAA, gBA, u), lerp(gAB, gBB, u), v);
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
    const pm = this.permMod12;

    const A = perm[X] + Y;
    const AA = perm[A] + Z;
    const AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y;
    const BA = perm[B] + Z;
    const BB = perm[B + 1] + Z;

    const g000 = GRAD3[pm[AA]];
    const g100 = GRAD3[pm[BA]];
    const g010 = GRAD3[pm[AB]];
    const g110 = GRAD3[pm[BB]];
    const g001 = GRAD3[pm[AA + 1]];
    const g101 = GRAD3[pm[BA + 1]];
    const g011 = GRAD3[pm[AB + 1]];
    const g111 = GRAD3[pm[BB + 1]];

    const n000 = g000[0] * xf + g000[1] * yf + g000[2] * zf;
    const n100 = g100[0] * (xf - 1) + g100[1] * yf + g100[2] * zf;
    const n010 = g010[0] * xf + g010[1] * (yf - 1) + g010[2] * zf;
    const n110 = g110[0] * (xf - 1) + g110[1] * (yf - 1) + g110[2] * zf;
    const n001 = g001[0] * xf + g001[1] * yf + g001[2] * (zf - 1);
    const n101 = g101[0] * (xf - 1) + g101[1] * yf + g101[2] * (zf - 1);
    const n011 = g011[0] * xf + g011[1] * (yf - 1) + g011[2] * (zf - 1);
    const n111 = g111[0] * (xf - 1) + g111[1] * (yf - 1) + g111[2] * (zf - 1);

    return lerp(
      lerp(lerp(n000, n100, u), lerp(n010, n110, u), v),
      lerp(lerp(n001, n101, u), lerp(n011, n111, u), v),
      w
    );
  }

  fbm2D(x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * freq, y * freq) * amp;
      maxAmp += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return total / maxAmp;
  }

  ridged2D(x, y, octaves = 3) {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise2D(x * freq, y * freq));
      total += n * n * amp;
      maxAmp += amp;
      amp *= 0.5;
      freq *= 2.05;
    }
    return total / maxAmp;
  }

  fbm3D(x, y, z, octaves = 3) {
    let total = 0;
    let freq = 1;
    let amp = 1;
    let maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise3D(x * freq, y * freq, z * freq) * amp;
      maxAmp += amp;
      amp *= 0.5;
      freq *= 2.0;
    }
    return total / maxAmp;
  }
}
