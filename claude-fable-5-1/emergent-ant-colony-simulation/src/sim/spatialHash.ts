/**
 * Uniform-grid spatial index rebuilt every tick (counting sort into typed
 * arrays). Used for local neighbour queries so ants never scan the whole
 * population.
 */
import { WORLD_H, WORLD_W } from './constants';

export const HASH_CELL = 40;
const HW = Math.ceil(WORLD_W / HASH_CELL);
const HH = Math.ceil(WORLD_H / HASH_CELL);

export class SpatialHash {
  private cellStart = new Int32Array(HW * HH + 1);
  private cellCount = new Int32Array(HW * HH);
  private items = new Int32Array(1024);
  private cellOf = new Int32Array(1024);
  private n = 0;

  /** Rebuild from parallel position arrays (ant index = id into `xs`). */
  build(xs: ArrayLike<number>, ys: ArrayLike<number>, count: number): void {
    this.n = count;
    if (this.items.length < count) {
      this.items = new Int32Array(count * 2);
      this.cellOf = new Int32Array(count * 2);
    }
    this.cellCount.fill(0);
    for (let i = 0; i < count; i++) {
      const cx = Math.min(HW - 1, Math.max(0, (xs[i] / HASH_CELL) | 0));
      const cy = Math.min(HH - 1, Math.max(0, (ys[i] / HASH_CELL) | 0));
      const c = cy * HW + cx;
      this.cellOf[i] = c;
      this.cellCount[c]++;
    }
    let acc = 0;
    for (let c = 0; c < HW * HH; c++) {
      this.cellStart[c] = acc;
      acc += this.cellCount[c];
    }
    this.cellStart[HW * HH] = acc;
    // reuse cellCount as write cursor
    this.cellCount.fill(0);
    for (let i = 0; i < count; i++) {
      const c = this.cellOf[i];
      this.items[this.cellStart[c] + this.cellCount[c]++] = i;
    }
  }

  /**
   * Fill `out` with indices of items whose cell intersects the circle; returns
   * the count. Allocation-free hot path used by ant sensing.
   */
  queryInto(x: number, y: number, r: number, out: Int32Array): number {
    if (this.n === 0) return 0;
    const x0 = Math.max(0, ((x - r) / HASH_CELL) | 0);
    const x1 = Math.min(HW - 1, ((x + r) / HASH_CELL) | 0);
    const y0 = Math.max(0, ((y - r) / HASH_CELL) | 0);
    const y1 = Math.min(HH - 1, ((y + r) / HASH_CELL) | 0);
    let n = 0;
    const cap = out.length;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * HW + cx;
        const s = this.cellStart[c], e = this.cellStart[c + 1];
        for (let k = s; k < e && n < cap; k++) out[n++] = this.items[k];
      }
    }
    return n;
  }

  /** Invoke `fn(index)` for every item whose cell intersects the circle. */
  query(x: number, y: number, r: number, fn: (i: number) => void): void {
    if (this.n === 0) return;
    const x0 = Math.max(0, ((x - r) / HASH_CELL) | 0);
    const x1 = Math.min(HW - 1, ((x + r) / HASH_CELL) | 0);
    const y0 = Math.max(0, ((y - r) / HASH_CELL) | 0);
    const y1 = Math.min(HH - 1, ((y + r) / HASH_CELL) | 0);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const c = cy * HW + cx;
        const s = this.cellStart[c], e = this.cellStart[c + 1];
        for (let k = s; k < e; k++) fn(this.items[k]);
      }
    }
  }
}
