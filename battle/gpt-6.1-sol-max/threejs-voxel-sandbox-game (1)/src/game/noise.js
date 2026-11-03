export function seedNumber(text) {
  let h = 2166136261;
  for (let i = 0; i < String(text).length; i++) h = Math.imul(h ^ String(text).charCodeAt(i), 16777619);
  return h >>> 0;
}

export function hash(x, y = 0, z = 0, seed = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

export function noise2(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = smooth(x - ix), fz = smooth(z - iz);
  return lerp(lerp(hash(ix, 0, iz, seed), hash(ix + 1, 0, iz, seed), fx),
    lerp(hash(ix, 0, iz + 1, seed), hash(ix + 1, 0, iz + 1, seed), fx), fz) * 2 - 1;
}

export function fbm(x, z, seed, octaves = 4) {
  let value = 0, amplitude = 0.55, frequency = 1;
  for (let i = 0; i < octaves; i++) {
    value += noise2(x * frequency, z * frequency, seed + i * 719) * amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return value;
}

export function noise3(x, y, z, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const at = yy => lerp(lerp(hash(ix, yy, iz, seed), hash(ix + 1, yy, iz, seed), fx),
    lerp(hash(ix, yy, iz + 1, seed), hash(ix + 1, yy, iz + 1, seed), fx), fz);
  return lerp(at(iy), at(iy + 1), fy);
}