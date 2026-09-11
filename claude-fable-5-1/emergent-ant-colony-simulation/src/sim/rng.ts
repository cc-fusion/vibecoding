/**
 * Small seeded PRNG (mulberry32). Every random decision in the simulation is
 * drawn from the world's RNG so a fixed seed + unchanged setup is reproducible.
 */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(min: number, maxInclusive: number): number {
    return min + Math.floor(this.next() * (maxInclusive - min + 1));
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
  /** Approximate gaussian (sum of 3 uniforms, variance-normalised). */
  gauss(): number {
    return (this.next() + this.next() + this.next() - 1.5) * 2;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
