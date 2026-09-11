import { PHEROMONE, SIM } from './config';
import { PHEROMONE_TYPES, type PheromoneType } from './types';

/**
 * A colony-owned set of pheromone channels stored on a coarse grid.
 * Each channel is a Float32Array of cols*rows concentrations.
 *
 * Decay + diffusion run in a single pass every SIM.diffuseInterval ticks
 * (the decay factor is raised to that power so timing stays consistent).
 */
export class PheromoneField {
  readonly cols: number;
  readonly rows: number;
  readonly channels: Record<PheromoneType, Float32Array>;
  private scratch: Float32Array;

  constructor(cols: number, rows: number) {
    this.cols = cols;
    this.rows = rows;
    const n = cols * rows;
    this.channels = {
      food: new Float32Array(n),
      home: new Float32Array(n),
      alarm: new Float32Array(n),
      explore: new Float32Array(n),
    };
    this.scratch = new Float32Array(n);
  }

  clear(type?: PheromoneType) {
    if (type) this.channels[type].fill(0);
    else for (const t of PHEROMONE_TYPES) this.channels[t].fill(0);
  }

  deposit(type: PheromoneType, idx: number, amount: number) {
    const ch = this.channels[type];
    const max = PHEROMONE[type].max;
    const v = ch[idx] + amount;
    ch[idx] = v > max ? max : v;
  }

  get(type: PheromoneType, idx: number): number {
    return this.channels[type][idx];
  }

  /**
   * Evaporation + local spreading. `decayMod` is the colony's decay modifier:
   * >1 makes trails fade faster, <1 makes them linger.
   * `walls` cells absorb pheromone (no signal inside solid rock).
   */
  update(decayMod: number, walls: Uint8Array) {
    const { cols, rows } = this;
    const interval = SIM.diffuseInterval;
    for (const type of PHEROMONE_TYPES) {
      const p = PHEROMONE[type];
      const keep = Math.pow(p.decay, interval * decayMod);
      const d = p.diffusion;
      const src = this.channels[type];
      const dst = this.scratch;
      for (let y = 0; y < rows; y++) {
        const yUp = y > 0 ? y - 1 : y;
        const yDn = y < rows - 1 ? y + 1 : y;
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          if (walls[i]) {
            dst[i] = 0;
            continue;
          }
          const c = src[i];
          const xl = x > 0 ? x - 1 : x;
          const xr = x < cols - 1 ? x + 1 : x;
          const avg = (src[yUp * cols + x] + src[yDn * cols + x] + src[y * cols + xl] + src[y * cols + xr]) * 0.25;
          let v = (c + (avg - c) * d) * keep;
          if (v < 0.0005) v = 0; // snap tiny values to zero so fields stay sparse
          dst[i] = v;
        }
      }
      // swap buffers
      this.channels[type] = dst;
      this.scratch = src;
    }
  }
}
