import { CELL, MW, MH } from './data';
import type { LevelDef } from './data';

export const T_SOIL = 0;
export const T_TUNNEL = 1;
export const T_ROCK = 2;
export const T_MEADOW = 3;
export const INF = 32000;

export const DX = [1, -1, 0, 0, 1, 1, -1, -1];
export const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export class RNG {
  s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, s: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s);
  const b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s);
  const d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function isPass(t: number): boolean {
  return t === T_TUNNEL || t === T_MEADOW;
}

export interface Food {
  id: number;
  x: number;
  y: number;
  amt: number;
  max: number;
  kind: 'crumb' | 'berry' | 'carcass' | 'cache';
  marked: boolean;
}

export interface Meadow {
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface GenResult {
  cells: Uint8Array;
  food: Food[];
  nest: { x: number; y: number };
  rivalNests: { x: number; y: number }[];
  antlions: { x: number; y: number }[];
  meadows: Meadow[];
}

function carveDisc(cells: Uint8Array, cx: number, cy: number, r: number) {
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (dx * dx + dy * dy > r * r + 0.5) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 1 || y < 1 || x > MW - 2 || y > MH - 2) continue;
      const i = y * MW + x;
      if (cells[i] !== T_MEADOW) cells[i] = T_TUNNEL;
    }
  }
}

function carveLine(cells: Uint8Array, x0: number, y0: number, x1: number, y1: number, rng: RNG, fat: number) {
  let x = x0;
  let y = y0;
  let guard = 0;
  while ((x !== x1 || y !== y1) && guard++ < 4000) {
    const dx = x1 - x;
    const dy = y1 - y;
    if (rng.next() < 0.14) {
      if (Math.abs(dx) > Math.abs(dy)) y += rng.next() < 0.5 ? -1 : 1;
      else x += rng.next() < 0.5 ? -1 : 1;
    } else if (Math.abs(dx) * rng.next() > Math.abs(dy) * rng.next()) {
      x += Math.sign(dx);
    } else {
      y += Math.sign(dy);
    }
    x = Math.max(2, Math.min(MW - 3, x));
    y = Math.max(2, Math.min(MH - 3, y));
    carveDisc(cells, x, y, rng.next() < fat ? 1 : 0);
  }
}

export function generateWorld(L: LevelDef, famine: boolean): GenResult {
  const rng = new RNG(L.seed * 7919);
  const cells = new Uint8Array(MW * MH);
  const nest = L.nest;
  const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

  // rocks
  for (let k = 0; k < L.rocks; k++) {
    const cx = rng.int(4, MW - 5);
    const cy = rng.int(4, MH - 5);
    if (dist(cx, cy, nest.x, nest.y) < 11) continue;
    const r = rng.range(1.5, 4.5);
    const R = Math.ceil(r);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x > MW - 2 || y > MH - 2) continue;
        cells[y * MW + x] = T_ROCK;
      }
    }
  }

  // meadows
  const meadows: Meadow[] = [];
  let tries = 0;
  const avoid = [nest, ...L.rivals.map((r) => ({ x: r.x, y: r.y }))];
  while (meadows.length < L.meadows && tries++ < 400) {
    const cx = rng.range(18, MW - 14);
    const cy = rng.range(12, MH - 12);
    const rx = rng.range(7, 14);
    const ry = rng.range(6, 11);
    if (avoid.some((a) => dist(cx, cy, a.x, a.y) < 20 + (a === nest ? 4 : 0))) continue;
    if (meadows.some((m) => dist(cx, cy, m.x, m.y) < (rx + m.rx) * 0.85)) continue;
    meadows.push({ x: cx, y: cy, rx, ry });
  }
  if (meadows.length < 2) {
    meadows.push({ x: MW / 2, y: MH / 2, rx: 10, ry: 8 });
    meadows.push({ x: MW / 2 + 22, y: MH / 2 - 14, rx: 8, ry: 7 });
  }
  for (const m of meadows) {
    const x0 = Math.max(1, Math.floor(m.x - m.rx - 3));
    const x1 = Math.min(MW - 2, Math.ceil(m.x + m.rx + 3));
    const y0 = Math.max(1, Math.floor(m.y - m.ry - 3));
    const y1 = Math.min(MH - 2, Math.ceil(m.y + m.ry + 3));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = ((x - m.x) / m.rx) ** 2 + ((y - m.y) / m.ry) ** 2 + (vnoise(x * 0.22, y * 0.22, L.seed) - 0.5) * 0.9;
        if (d < 1) cells[y * MW + x] = T_MEADOW;
      }
    }
  }
  const byDist = [...meadows].sort((a, b) => dist(a.x, a.y, nest.x, nest.y) - dist(b.x, b.y, nest.x, nest.y));
  const near = byDist[0];

  // nest
  carveDisc(cells, nest.x, nest.y, 3.2);
  carveDisc(cells, nest.x + 6, nest.y - 3, 2);
  carveLine(cells, nest.x + 6, nest.y - 3, nest.x, nest.y, rng, 0.4);
  carveLine(cells, nest.x, nest.y, Math.round(near.x), Math.round(near.y), rng, 0.55);

  // rivals
  const rivalNests: { x: number; y: number }[] = [];
  for (const r of L.rivals) {
    carveDisc(cells, r.x, r.y, 3.4);
    carveDisc(cells, r.x - 6, r.y + 3, 2);
    carveDisc(cells, r.x + 2, r.y - 6, 2);
    carveLine(cells, r.x, r.y, r.x - 6, r.y + 3, rng, 0.3);
    carveLine(cells, r.x, r.y, r.x + 2, r.y - 6, rng, 0.3);
    const nm = [...meadows].sort((a, b) => dist(a.x, a.y, r.x, r.y) - dist(b.x, b.y, r.x, r.y))[0];
    carveLine(cells, r.x, r.y, Math.round(nm.x), Math.round(nm.y), rng, 0.5);
    rivalNests.push({ x: r.x, y: r.y });
  }

  // connect meadows into one network
  const sorted = [...meadows].sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    carveLine(cells, Math.round(sorted[i - 1].x), Math.round(sorted[i - 1].y), Math.round(sorted[i].x), Math.round(sorted[i].y), rng, 0.5);
  }
  // an extra shortcut for loops
  if (sorted.length > 3) {
    carveLine(cells, Math.round(sorted[0].x), Math.round(sorted[0].y), Math.round(sorted[sorted.length - 1].x), Math.round(sorted[sorted.length - 1].y), rng, 0.3);
  }

  // border
  for (let x = 0; x < MW; x++) {
    cells[x] = T_ROCK;
    cells[(MH - 1) * MW + x] = T_ROCK;
  }
  for (let y = 0; y < MH; y++) {
    cells[y * MW] = T_ROCK;
    cells[y * MW + MW - 1] = T_ROCK;
  }

  // food
  const food: Food[] = [];
  let fid = 1;
  const mul = famine ? 0.6 : 1;
  const addFood = (kind: Food['kind'], x: number, y: number, amt: number) => {
    food.push({ id: fid++, x, y, amt: Math.round(amt * mul), max: Math.round(amt * mul), kind, marked: false });
  };
  for (let p = 0; p < L.foodPatches; p++) {
    const m = p === 0 ? near : rng.pick(meadows);
    let cx = 0;
    let cy = 0;
    let ok = false;
    for (let t = 0; t < 30 && !ok; t++) {
      cx = m.x + rng.range(-0.6, 0.6) * m.rx;
      cy = m.y + rng.range(-0.6, 0.6) * m.ry;
      const ix = Math.floor(cx);
      const iy = Math.floor(cy);
      ok = ix > 1 && iy > 1 && ix < MW - 2 && iy < MH - 2 && cells[iy * MW + ix] === T_MEADOW;
    }
    if (!ok) continue;
    const n = rng.int(4, 8);
    for (let k = 0; k < n; k++) {
      const x = cx + rng.range(-3, 3);
      const y = cy + rng.range(-3, 3);
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      if (cells[iy * MW + ix] !== T_MEADOW) continue;
      const r = rng.next();
      if (r < 0.6) addFood('crumb', x * CELL, y * CELL, 8);
      else if (r < 0.9) addFood('berry', x * CELL, y * CELL, 16);
      else addFood('carcass', x * CELL, y * CELL, 36);
    }
  }
  // buried caches
  let placed = 0;
  let guard = 0;
  while (placed < L.caches && guard++ < 600) {
    const x = rng.int(4, MW - 5);
    const y = rng.int(4, MH - 5);
    const d = dist(x, y, nest.x, nest.y);
    if (d < 14 || d > 70) continue;
    if (cells[y * MW + x] !== T_SOIL) continue;
    let adj = false;
    for (let k = 0; k < 8; k++) if (isPass(cells[(y + DY[k]) * MW + x + DX[k]])) adj = true;
    if (adj) continue;
    addFood('cache', (x + 0.5) * CELL, (y + 0.5) * CELL, 90);
    placed++;
  }

  // antlions
  const antlions: { x: number; y: number }[] = [];
  guard = 0;
  while (antlions.length < L.antlions && guard++ < 600) {
    const m = rng.pick(meadows);
    const x = m.x + rng.range(-0.7, 0.7) * m.rx;
    const y = m.y + rng.range(-0.7, 0.7) * m.ry;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 2 || iy < 2 || ix > MW - 3 || iy > MH - 3 || cells[iy * MW + ix] !== T_MEADOW) continue;
    if (dist(x, y, nest.x, nest.y) < 24) continue;
    antlions.push({ x: x * CELL, y: y * CELL });
  }

  return { cells, food, nest, rivalNests, antlions, meadows };
}

/* ---------- flow fields ---------- */

export function bfs(cells: Uint8Array, sources: number[], out: Int16Array, queue: Int32Array, maxD = INF - 1): void {
  out.fill(INF);
  let head = 0;
  let tail = 0;
  for (let s = 0; s < sources.length; s++) {
    const i = sources[s];
    if (i >= 0 && i < out.length && out[i] === INF && isPass(cells[i])) {
      out[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = out[i] + 1;
    if (d > maxD) continue;
    const x = i % MW;
    const y = (i / MW) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const j = ny * MW + nx;
      if (out[j] !== INF || !isPass(cells[j])) continue;
      if (k >= 4 && (!isPass(cells[y * MW + nx]) || !isPass(cells[ny * MW + x]))) continue;
      out[j] = d;
      queue[tail++] = j;
    }
  }
}

export function descend(field: Int16Array, cells: Uint8Array, cx: number, cy: number): number {
  if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return -1;
  const i = cy * MW + cx;
  let best = field[i];
  let bi = -1;
  for (let k = 0; k < 8; k++) {
    const nx = cx + DX[k];
    const ny = cy + DY[k];
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
    const j = ny * MW + nx;
    const v = field[j];
    if (v < best) {
      if (k >= 4 && (!isPass(cells[cy * MW + nx]) || !isPass(cells[ny * MW + cx]))) continue;
      best = v;
      bi = j;
    }
  }
  return bi;
}

const lsDist = new Int16Array(MW * MH);
const lsStamp = new Int32Array(MW * MH);
const lsQ = new Int32Array(MW * MH);
let lsGen = 0;

/** Local BFS from target to source; returns the next cell index for the source to step to, or -1. */
export function localStep(cells: Uint8Array, sx: number, sy: number, tx: number, ty: number, maxD: number): number {
  if (sx < 0 || sy < 0 || sx >= MW || sy >= MH || tx < 0 || ty < 0 || tx >= MW || ty >= MH) return -1;
  const s = sy * MW + sx;
  const t = ty * MW + tx;
  if (s === t || !isPass(cells[t])) return -1;
  lsGen++;
  let head = 0;
  let tail = 0;
  lsStamp[t] = lsGen;
  lsDist[t] = 0;
  lsQ[tail++] = t;
  while (head < tail) {
    const i = lsQ[head++];
    if (i === s) break;
    const d = lsDist[i] + 1;
    if (d > maxD) continue;
    const x = i % MW;
    const y = (i / MW) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const j = ny * MW + nx;
      if (lsStamp[j] === lsGen || !isPass(cells[j])) continue;
      if (k >= 4 && (!isPass(cells[y * MW + nx]) || !isPass(cells[ny * MW + x]))) continue;
      lsStamp[j] = lsGen;
      lsDist[j] = d;
      lsQ[tail++] = j;
    }
  }
  if (lsStamp[s] !== lsGen) return -1;
  let best = lsDist[s];
  let bi = -1;
  for (let k = 0; k < 8; k++) {
    const nx = sx + DX[k];
    const ny = sy + DY[k];
    if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
    const j = ny * MW + nx;
    if (lsStamp[j] !== lsGen || lsDist[j] >= best) continue;
    if (k >= 4 && (!isPass(cells[sy * MW + nx]) || !isPass(cells[ny * MW + sx]))) continue;
    best = lsDist[j];
    bi = j;
  }
  return bi;
}
