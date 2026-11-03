// Biome-dependent colour ramps used for vertex tinting of grass and foliage.
import { clamp } from './noise.js';

// returns [r,g,b] in 0..255 multiplier space
export function grassColor(t, h) {
  const hot = clamp(t, 0, 1), cold = clamp(-t, 0, 1), dry = clamp(-h, 0, 1), wet = clamp(h, 0, 1);
  const r = 0.50 + 0.42 * hot * (0.35 + 0.65 * dry) + 0.04 * cold - 0.05 * wet;
  const g = 0.84 - 0.10 * hot * dry - 0.05 * cold + 0.04 * wet;
  const b = 0.30 + 0.30 * cold + 0.05 * hot * dry - 0.04 * wet;
  return [clamp(r, 0, 1) * 255, clamp(g, 0, 1) * 255, clamp(b, 0, 1) * 255];
}

export function foliageColor(t, h) {
  const g = grassColor(t, h);
  return [g[0] * 0.86, g[1] * 0.88, g[2] * 0.82];
}

export const DEFAULT_GRASS = grassColor(0.1, 0.05);
export const DEFAULT_FOLIAGE = foliageColor(0.1, 0.05);
