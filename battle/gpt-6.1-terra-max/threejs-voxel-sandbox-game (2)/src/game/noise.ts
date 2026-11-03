export const WATER_LEVEL = 12;
export const DEFAULT_SEED = 73829;

export function hash2(x: number, z: number, seed = DEFAULT_SEED): number {
  let n = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed | 0, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

export function noise2(x: number, z: number, seed = DEFAULT_SEED): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed) * 2 - 1;
  const b = hash2(ix + 1, iz, seed) * 2 - 1;
  const c = hash2(ix, iz + 1, seed) * 2 - 1;
  const d = hash2(ix + 1, iz + 1, seed) * 2 - 1;
  return (a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz;
}

export function riverDistance(x: number, z: number, seed = DEFAULT_SEED): number {
  const river = -21 + Math.sin(x * 0.032) * 7 + noise2(x * 0.018, 4, seed + 19) * 5;
  return Math.abs(z - river);
}

export function terrainHeight(x: number, z: number, seed = DEFAULT_SEED): number {
  const broad = noise2(x * 0.017, z * 0.017, seed) * 5.5;
  const detail = noise2(x * 0.052 + 11, z * 0.052 - 7, seed + 2) * 2.1;
  let height = 16 + broad + detail;
  const river = riverDistance(x, z, seed);
  if (river < 11) height = Math.min(height, 10.3 + river * 0.63);
  return Math.max(5, Math.min(27, Math.floor(height)));
}

export function biomeAt(x: number, z: number, seed = DEFAULT_SEED): 'Riverbank' | 'Pine woodland' | 'Wildflower meadow' {
  if (terrainHeight(x, z, seed) <= WATER_LEVEL + 1 || riverDistance(x, z, seed) < 8) return 'Riverbank';
  return noise2(x * 0.018 + 91, z * 0.018 - 31, seed + 71) > 0.05 ? 'Pine woodland' : 'Wildflower meadow';
}

export function hasTree(x: number, z: number, seed = DEFAULT_SEED): boolean {
  if ((x - 0.5) ** 2 + (z + 12.5) ** 2 < 50) return false;
  if (terrainHeight(x, z, seed) <= WATER_LEVEL + 1) return false;
  const biome = biomeAt(x, z, seed);
  const threshold = biome === 'Pine woodland' ? 0.975 : 0.989;
  return hash2(x, z, seed + 414) > threshold;
}