// Hex grid math: pointy-top, "odd-r" offset layout (odd rows shoved right).
export interface Hex {
  c: number;
  r: number;
}

const DIRS_EVEN = [
  [1, 0],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
];
const DIRS_ODD = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [0, 1],
  [1, 1],
];

export const SQRT3 = Math.sqrt(3);

export function neighborAt(c: number, r: number, d: number): Hex {
  const t = (r & 1) === 1 ? DIRS_ODD : DIRS_EVEN;
  const dd = t[((d % 6) + 6) % 6];
  return { c: c + dd[0], r: r + dd[1] };
}

export function neighbors(c: number, r: number): Hex[] {
  const out: Hex[] = [];
  for (let d = 0; d < 6; d++) out.push(neighborAt(c, r, d));
  return out;
}

export function dirBetween(a: Hex, b: Hex): number {
  for (let d = 0; d < 6; d++) {
    const n = neighborAt(a.c, a.r, d);
    if (n.c === b.c && n.r === b.r) return d;
  }
  return -1;
}

function toCube(c: number, r: number) {
  const x = c - (r - (r & 1)) / 2;
  const z = r;
  return { x, y: -x - z, z };
}

export function dist(a: Hex, b: Hex): number {
  const A = toCube(a.c, a.r);
  const B = toCube(b.c, b.r);
  return Math.max(Math.abs(A.x - B.x), Math.abs(A.y - B.y), Math.abs(A.z - B.z));
}

export function key(c: number, r: number): number {
  return r * 64 + c;
}

export function toPixel(c: number, r: number, size: number) {
  return { x: size * SQRT3 * (c + 0.5 * (r & 1)), y: size * 1.5 * r };
}

// Seeded RNG (mulberry32)
export function makeRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n: number) => Math.floor(next() * n),
    range: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(arr: T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  };
}
export type Rng = ReturnType<typeof makeRng>;

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
