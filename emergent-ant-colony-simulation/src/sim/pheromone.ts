/**
 * Per-colony pheromone field: PH_COUNT channels on a coarse grid (CELL units).
 * Values are clamped to [0,1]. Decay + diffusion run in a single pass every
 * DIFFUSE_INTERVAL ticks using a scratch buffer (ping-pong).
 */
import { CELL, GRID_H, GRID_W, PH_COUNT, PHEROMONE_DEFS } from './constants';

export class PheromoneField {
  channels: Float32Array[] = [];
  private scratch: Float32Array = new Float32Array(GRID_W * GRID_H);

  constructor() {
    for (let c = 0; c < PH_COUNT; c++) this.channels.push(new Float32Array(GRID_W * GRID_H));
  }

  clear(): void {
    for (const ch of this.channels) ch.fill(0);
  }

  /** Sample the cell containing world point (x,y). Out-of-bounds returns 0. */
  sample(channel: number, x: number, y: number): number {
    const gx = (x / CELL) | 0, gy = (y / CELL) | 0;
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return 0;
    return this.channels[channel][gy * GRID_W + gx];
  }

  deposit(channel: number, x: number, y: number, amount: number): void {
    const gx = (x / CELL) | 0, gy = (y / CELL) | 0;
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return;
    const arr = this.channels[channel];
    const i = gy * GRID_W + gx;
    const v = arr[i] + amount;
    arr[i] = v > 1 ? 1 : v;
  }

  /**
   * Decay and diffuse all channels.
   * @param seconds elapsed simulated seconds since last pass
   * @param decayMod colony decay modifier (>1 = fades faster)
   * @param evapMul world-level evaporation multiplier
   * @param diffMul world-level diffusion multiplier
   */
  update(seconds: number, decayMod: number, evapMul: number, diffMul: number): void {
    for (let c = 0; c < PH_COUNT; c++) {
      const def = PHEROMONE_DEFS[c];
      const keep = Math.pow(1 - Math.min(0.95, def.evaporation * decayMod * evapMul), seconds);
      const k = def.diffusion * diffMul;
      const src = this.channels[c];
      if (k <= 0) {
        for (let i = 0; i < src.length; i++) {
          const v = src[i] * keep;
          src[i] = v < 0.0005 ? 0 : v;
        }
        continue;
      }
      const dst = this.scratch;
      const centerKeep = 1 - 4 * k;
      for (let y = 0; y < GRID_H; y++) {
        const row = y * GRID_W;
        const up = y > 0 ? row - GRID_W : row;
        const down = y < GRID_H - 1 ? row + GRID_W : row;
        for (let x = 0; x < GRID_W; x++) {
          const i = row + x;
          const l = x > 0 ? src[i - 1] : src[i];
          const r = x < GRID_W - 1 ? src[i + 1] : src[i];
          const v = (src[i] * centerKeep + k * (l + r + src[up + x] + src[down + x])) * keep;
          dst[i] = v < 0.0005 ? 0 : v;
        }
      }
      // swap buffers
      this.channels[c] = dst;
      this.scratch = src;
    }
  }

  /** Count cells above threshold (used for territory metric). */
  countAbove(channel: number, threshold: number): number {
    const arr = this.channels[channel];
    let n = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > threshold) n++;
    return n;
  }
}
