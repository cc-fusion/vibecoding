/**
 * Wall/obstacle grid (same resolution as the pheromone grid). Everything
 * outside the world is treated as solid so ants naturally stay in bounds.
 */
import { CELL, GRID_H, GRID_W } from './constants';

export class WallGrid {
  cells = new Uint8Array(GRID_W * GRID_H);
  /** Incremented whenever walls change so the renderer can re-cache. */
  version = 0;

  isSolidWorld(x: number, y: number): boolean {
    const gx = (x / CELL) | 0, gy = (y / CELL) | 0;
    if (x < 0 || y < 0 || gx >= GRID_W || gy >= GRID_H) return true;
    return this.cells[gy * GRID_W + gx] === 1;
  }

  isSolidCell(gx: number, gy: number): boolean {
    if (gx < 0 || gy < 0 || gx >= GRID_W || gy >= GRID_H) return true;
    return this.cells[gy * GRID_W + gx] === 1;
  }

  /** Paint / erase a disc of cells. */
  paint(x: number, y: number, radius: number, solid: boolean): void {
    const r = Math.max(1, Math.round(radius / CELL));
    const cx = Math.round(x / CELL), cy = Math.round(y / CELL);
    const v = solid ? 1 : 0;
    let changed = false;
    for (let gy = cy - r; gy <= cy + r; gy++) {
      if (gy < 0 || gy >= GRID_H) continue;
      for (let gx = cx - r; gx <= cx + r; gx++) {
        if (gx < 0 || gx >= GRID_W) continue;
        const dx = gx + 0.5 - x / CELL, dy = gy + 0.5 - y / CELL;
        if (dx * dx + dy * dy <= r * r) {
          const i = gy * GRID_W + gx;
          if (this.cells[i] !== v) {
            this.cells[i] = v;
            changed = true;
          }
        }
      }
    }
    if (changed) this.version++;
  }

  /** Paint along a segment so fast drags produce continuous walls. */
  paintLine(x0: number, y0: number, x1: number, y1: number, radius: number, solid: boolean): void {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      this.paint(x0 + dx * t, y0 + dy * t, radius, solid);
    }
  }

  fillRect(x0: number, y0: number, x1: number, y1: number, solid = true): void {
    const gx0 = Math.max(0, Math.floor(x0 / CELL)), gx1 = Math.min(GRID_W - 1, Math.floor(x1 / CELL));
    const gy0 = Math.max(0, Math.floor(y0 / CELL)), gy1 = Math.min(GRID_H - 1, Math.floor(y1 / CELL));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) this.cells[gy * GRID_W + gx] = solid ? 1 : 0;
    this.version++;
  }

  /**
   * Nearest free cell centre to (x,y) within `maxRings` cells, or null.
   * Used to push out ants that get buried when a wall is drawn over them.
   */
  nearestFree(x: number, y: number, maxRings = 6): { x: number; y: number } | null {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    for (let r = 1; r <= maxRings; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!this.isSolidCell(cx + dx, cy + dy)) return { x: (cx + dx + 0.5) * CELL, y: (cy + dy + 0.5) * CELL };
        }
      }
    }
    return null;
  }

  clearDisc(x: number, y: number, radius: number): void {
    this.paint(x, y, radius, false);
  }

  clear(): void {
    this.cells.fill(0);
    this.version++;
  }

  /** Run-length encode for persistence. */
  encode(): number[] {
    const out: number[] = [];
    let cur = this.cells[0], run = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] === cur) run++;
      else {
        out.push(run);
        cur = this.cells[i];
        run = 1;
      }
    }
    out.push(run);
    return out; // alternating runs starting with value 0
  }

  decode(runs: number[]): void {
    this.cells.fill(0);
    let i = 0, v = 0;
    for (const run of runs) {
      if (v === 1) this.cells.fill(1, i, Math.min(this.cells.length, i + run));
      i += run;
      v ^= 1;
    }
    this.version++;
  }
}
