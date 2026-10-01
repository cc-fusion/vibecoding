export const SIZE = 34;
export const R = 6;

export interface Hex {
  q: number;
  r: number;
}

// Order (counter-clockwise from upper-right): NE, N, NW, SW, S, SE
export const DIRS: Hex[] = [
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
  { q: 1, r: 0 },
];
export const DIR_ANGLES = [-30, -90, -150, 150, 90, 30];
export const DIR_NAMES = ["NE", "N", "NW", "SW", "S", "SE"];

export const key = (q: number, r: number) => `${q},${r}`;

export const dist = (a: Hex, b: Hex) =>
  (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(a.q + a.r - b.q - b.r)) / 2;

export const toPixel = (q: number, r: number) => ({
  x: SIZE * 1.5 * q,
  y: SIZE * Math.sqrt(3) * (r + q / 2),
});

export const inBounds = (q: number, r: number) =>
  Math.abs(q) <= R && Math.abs(r) <= R && Math.abs(q + r) <= R;

export const neighbors = (q: number, r: number): Hex[] =>
  DIRS.map((d) => ({ q: q + d.q, r: r + d.r })).filter((h) => inBounds(h.q, h.r));

export function hexPoints(size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * 60 * i;
    pts.push(`${(size * Math.cos(a)).toFixed(2)},${(size * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

export function allHexes(): Hex[] {
  const out: Hex[] = [];
  for (let q = -R; q <= R; q++) {
    for (let r = -R; r <= R; r++) {
      if (inBounds(q, r)) out.push({ q, r });
    }
  }
  return out;
}

export const rand = (n: number) => Math.floor(Math.random() * n);
export const randInt = (a: number, b: number) => a + rand(b - a + 1);
export const pick = <T,>(arr: T[]): T => arr[rand(arr.length)];
export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
