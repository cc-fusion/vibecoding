import type { Fx } from "../fx";

export const W = 960;
export const H = 560;
export const CX = 480;
export const CY = 290;

export interface Inp {
  keys: Set<string>;
  pressed: Set<string>;
  px: number;
  py: number;
  down: boolean;
  pdown: boolean;
  pup: boolean;
  wheel: number;
  moved: boolean;
}

export interface MechEnv {
  tolMul: number;
  hint: number;
  trapped: boolean;
  practice: boolean;
  fx: Fx;
  /** register a mistake: noise, pick wear, position for floating text */
  fault(noise: number, wear: number, x: number, y: number, text?: string): void;
  /** continuous noise (no feedback text) */
  noise(n: number): void;
  solved(): void;
}

export const held = (inp: Inp, ...codes: string[]) => codes.some((c) => inp.keys.has(c));
export const pressedAny = (inp: Inp, ...codes: string[]) => codes.some((c) => inp.pressed.has(c));

export abstract class Mech {
  done = false;
  abstract readonly help: string;
  constructor(
    protected env: MechEnv,
    protected level: number,
    protected rng: () => number,
  ) {}
  abstract update(dt: number, inp: Inp, active: boolean): void;
  abstract draw(g: CanvasRenderingContext2D, t: number): void;
  /** Skeleton key / debug bypass */
  skip(): void {
    if (!this.done) {
      this.done = true;
      this.env.solved();
    }
  }
  protected finish() {
    if (this.done) return;
    this.done = true;
    this.env.solved();
  }
}

export function tableAt<T>(table: T[], level: number): T {
  return table[Math.max(1, Math.min(table.length - 1, level))];
}
