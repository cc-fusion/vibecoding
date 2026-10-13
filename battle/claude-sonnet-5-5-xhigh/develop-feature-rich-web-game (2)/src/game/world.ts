import { T, B, WL, TILES } from './data';

export type Stack = { id: string; n: number } | null;
export const WW = 500, WH = 280, HELL_TOP = WH - 50, SURF_BASE = 88;

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x: number, y: number, s: number) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
export class Noise {
  s: number;
  constructor(seed: number) { this.s = seed | 0; }
  n(x: number, y: number) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2(xi, yi, this.s), b = hash2(xi + 1, yi, this.s), c = hash2(xi, yi + 1, this.s), d = hash2(xi + 1, yi + 1, this.s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  fbm(x: number, y: number, o = 3) {
    let f = 1, a = 1, s = 0, t = 0;
    for (let i = 0; i < o; i++) { s += this.n(x * f, y * f) * a; t += a; f *= 2; a *= 0.5; }
    return s / t;
  }
}

export function plan(seed: number, W = WW) {
  const rng = mulberry(seed ^ 0x9e3779b9);
  const mirror = rng() < 0.5;
  const nz = new Noise(seed + 11);
  const biomes = new Uint8Array(W);
  const ampA = new Float32Array(W), offA = new Float32Array(W);
  const AMP = [20, 9, 18, 14, 24], OFF = [0, 2, -2, 4, -2];
  for (let x = 0; x < W; x++) {
    const xx = x + (nz.n(x * 0.04, 7.7) - 0.5) * 16;
    const f = (mirror ? W - 1 - xx : xx) / W;
    const b = f < 0.17 ? B.TUNDRA : f < 0.30 ? B.FOREST : f < 0.41 ? B.BLIGHT : f < 0.60 ? B.FOREST : f < 0.76 ? B.DESERT : f < 0.82 ? B.FOREST : B.JUNGLE;
    biomes[x] = b; ampA[x] = AMP[b]; offA[x] = OFF[b];
  }
  const blur = (a: Float32Array) => {
    const o = new Float32Array(W);
    for (let x = 0; x < W; x++) { let s = 0, c = 0; for (let k = -10; k <= 10; k++) { const xx = x + k; if (xx >= 0 && xx < W) { s += a[xx]; c++; } } o[x] = s / c; }
    return o;
  };
  const am = blur(ampA), of = blur(offA);
  const surf = new Int16Array(W);
  const cx = W >> 1;
  const hOf = (x: number) => SURF_BASE + of[x] + (nz.fbm(x * 0.018, 3.3, 3) - 0.5) * 3 * am[x];
  const hc = hOf(cx);
  for (let x = 0; x < W; x++) {
    let h = hOf(x); const d = Math.abs(x - cx);
    if (d < 32) { const w = 1 - d / 32, ww = w * w * (3 - 2 * w); h = h * (1 - ww) + hc * ww; }
    surf[x] = Math.round(Math.max(62, Math.min(118, h)));
  }
  return { biomes, surf };
}

export class World {
  W: number; H: number; seed: number; tiles: Uint8Array; walls: Uint8Array; surf: Int16Array; biomes: Uint8Array;
  chests = new Map<number, Stack[]>(); hardmode = false; spawn = { x: WW >> 1, y: 80 }; onSet?: (x: number, y: number) => void; liqTick = 0;
  constructor(W: number, H: number, seed: number) {
    this.W = W; this.H = H; this.seed = seed;
    this.tiles = new Uint8Array(W * H); this.walls = new Uint8Array(W * H);
    const p = plan(seed, W); this.surf = p.surf; this.biomes = p.biomes;
  }
  get(x: number, y: number): number { if (x < 0 || x >= this.W || y >= this.H) return T.STONE; if (y < 0) return T.AIR; return this.tiles[y * this.W + x]; }
  set(x: number, y: number, t: number) { if (x < 0 || x >= this.W || y < 0 || y >= this.H) return; this.tiles[y * this.W + x] = t; if (this.onSet) this.onSet(x, y); }
  wall(x: number, y: number): number { if (x < 0 || x >= this.W || y < 0 || y >= this.H) return 0; return this.walls[y * this.W + x]; }
  setWall(x: number, y: number, w: number) { if (x < 0 || x >= this.W || y < 0 || y >= this.H) return; this.walls[y * this.W + x] = w; if (this.onSet) this.onSet(x, y); }
  solid(x: number, y: number) { return TILES[this.get(x, y)].solid; }
  biomeAt(x: number, y: number) { if (y >= HELL_TOP) return B.HELL; return this.biomes[Math.max(0, Math.min(this.W - 1, Math.floor(x)))]; }
  layer(x: number, y: number) {
    if (y >= HELL_TOP) return 4;
    const s = this.surf[Math.max(0, Math.min(this.W - 1, Math.floor(x)))];
    return y < s - 35 ? 0 : y < s + 12 ? 1 : y < s + 70 ? 2 : 3;
  }
  stepLiquids(x0: number, y0: number, x1: number, y1: number): number {
    const W = this.W, tl = this.tiles; let moved = 0;
    x0 = Math.max(1, x0); x1 = Math.min(W - 2, x1); y0 = Math.max(1, y0); y1 = Math.min(this.H - 3, y1);
    const flip = (this.liqTick++ & 1) === 1;
    const pass = (t: number) => t === T.AIR || t === T.TALLGRASS;
    for (let y = y1; y >= y0; y--) {
      for (let k = x0; k <= x1; k++) {
        const x = flip ? x1 - (k - x0) : k; const i = y * W + x; const t = tl[i];
        if (t !== T.WATER && t !== T.LAVA) continue;
        const opp = t === T.WATER ? T.LAVA : T.WATER; let conv = false;
        for (const n of [i - 1, i + 1, i + W, i - W]) {
          if (tl[n] === opp) { if (t === T.WATER) { tl[n] = T.OBSIDIAN; if (this.onSet) this.onSet(n % W, (n / W) | 0); } else conv = true; }
        }
        if (conv) { tl[i] = T.OBSIDIAN; if (this.onSet) this.onSet(x, y); moved++; continue; }
        const b = tl[i + W];
        if (pass(b)) { tl[i] = T.AIR; tl[i + W] = t; moved++; if (this.onSet) { this.onSet(x, y); this.onSet(x, y + 1); } continue; }
        const dir = Math.random() < 0.5 ? -1 : 1; const above = tl[i - W];
        for (const d of [dir, -dir]) {
          const n = i + d;
          if (pass(tl[n]) && (pass(tl[n + W]) || above === T.WATER || above === T.LAVA)) {
            tl[i] = T.AIR; tl[n] = t; moved++; if (this.onSet) { this.onSet(x, y); this.onSet(x + d, y); } break;
          }
        }
      }
    }
    return moved;
  }
}

// ---------- RLE persistence ----------
function b64(u: Uint8Array) { let s = ''; for (let i = 0; i < u.length; i += 0x6000) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x6000))); return btoa(s); }
function unb64(s: string) { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
export function rleEncode(a: Uint8Array): string {
  const out: number[] = []; let i = 0; const n = a.length;
  while (i < n) { const v = a[i]; let j = i + 1; while (j < n && a[j] === v && j - i < 65535) j++; const len = j - i; out.push(v, len & 255, len >> 8); i = j; }
  return b64(Uint8Array.from(out));
}
export function rleDecode(s: string, n: number): Uint8Array {
  const b = unb64(s); const a = new Uint8Array(n); let p = 0;
  for (let i = 0; i + 2 < b.length; i += 3) { const len = b[i + 1] | (b[i + 2] << 8); a.fill(b[i], p, p + len); p += len; }
  return a;
}

// ---------- chest loot ----------
export function chestLoot(rng: () => number, kind: string, y: number, biome: number, luck: number): Stack[] {
  const items: { id: string; n: number }[] = [];
  const add = (id: string, a: number, b = a) => items.push({ id, n: a + Math.floor(rng() * (b - a + 1)) });
  const pick = <X,>(arr: X[]): X => arr[Math.floor(rng() * arr.length)];
  if (kind === 'sky') {
    add('starfury', 1); add('fallen_star', 3, 6); add('torch', 10, 20); add('gold_bar', 3, 6);
    if (rng() < 0.6) add(pick(['cloud_bottle', 'horseshoe', 'hermes']), 1);
  } else if (kind === 'hell') {
    add(pick(['flower_fire', 'molten_fury', 'flower_fire', 'molten_fury', 'horseshoe']), 1); add('obsidian_potion', 2, 4); add('hell_bar', 4, 8);
    add('heal', 2, 4); add('torch', 10, 18); if (rng() < 0.5) add('fireblossom', 2, 4);
  } else {
    const prim: Record<number, string[]> = {
      [B.TUNDRA]: ['ice_blade', 'hermes', 'regen_band'], [B.JUNGLE]: ['boomstick', 'claws', 'regen_band'],
      [B.DESERT]: ['cloud_bottle', 'wand_sparks', 'horseshoe'], [B.FOREST]: ['hermes', 'cloud_bottle', 'horseshoe', 'regen_band', 'magic_mirror'], [B.BLIGHT]: ['hermes', 'claws', 'magic_mirror'],
    };
    if (rng() < 0.7) add(pick(prim[biome] || prim[B.FOREST]), 1);
    add('torch', 6, 14); add('lesser_heal', 1, 3);
    if (y < 130) add('copper_bar', 6, 12); else if (y < 180) add('iron_bar', 5, 10); else add('gold_bar', 4, 8);
    if (rng() < 0.6) add('wooden_arrow', 20, 40); if (rng() < 0.4) add('bomb', 3, 6);
    if (rng() < 0.5) add(pick(['ironskin', 'regen_potion', 'swift_potion', 'mining_potion', 'owl_potion']), 1, 3);
    if (rng() < luck) add(pick(['life_crystal', 'lens', 'fallen_star']), 1, 2);
  }
  const slots: Stack[] = Array(20).fill(null);
  for (const s of items) { for (let tries = 0; tries < 30; tries++) { const i = Math.floor(rng() * 20); if (!slots[i]) { slots[i] = s; break; } } }
  return slots;
}

// ---------- generation ----------
export function generate(seed: number, opts: { scarce?: boolean; luck?: number } = {}): World {
  const W = WW, H = WH, w = new World(W, H, seed);
  const { biomes, surf } = w;
  const rng = mulberry(seed ^ 0xabcdef);
  const nz = new Noise(seed + 101), nz2 = new Noise(seed + 202), nz3 = new Noise(seed + 303), nzH = new Noise(seed + 404);
  const ri = (a: number, b: number) => a + Math.floor(rng() * (b - a + 1));
  const tiles = w.tiles, walls = w.walls, cx = W >> 1, sc = opts.scarce ? 0.6 : 1;
  const inb = (x: number, y: number) => x > 0 && x < W - 1 && y > 0 && y < H - 2;
  const luck = opts.luck ?? 0.15;

  // 1. base fill
  for (let x = 0; x < W; x++) {
    const s = surf[x], b = biomes[x];
    for (let y = s; y < H; y++) {
      const d = y - s; let t: number, wl = 0;
      if (y >= HELL_TOP) { t = T.ASH; wl = WL.HELL; }
      else {
        const pn = nz2.fbm(x * 0.05, y * 0.06);
        switch (b) {
          case B.DESERT: t = d < 18 ? T.SAND : d < 46 ? T.SANDSTONE : (pn > 0.66 ? T.SAND : T.STONE); wl = WL.SAND; break;
          case B.TUNDRA: t = d < 4 ? T.SNOW : (pn > 0.56 || nz3.fbm(x * 0.07, y * 0.07) > 0.6) ? T.ICE : (pn < 0.36 && d < 70 ? T.SNOW : T.STONE); wl = WL.ICE; break;
          case B.JUNGLE: t = d < 1 ? T.JGRASS : d < 20 ? T.MUD : (pn > 0.58 && d < 150 ? T.MUD : T.STONE); wl = WL.MUD; break;
          case B.BLIGHT: t = d < 1 ? T.BGRASS : d < 4 ? T.DIRT : T.EBON; wl = WL.EBON; break;
          default: t = d < 1 ? T.GRASS : d < 5 + Math.floor(nz.n(x * 0.2, 1) * 4) ? T.DIRT : (pn > 0.64 && d < 120 ? T.DIRT : T.STONE); wl = d < 24 ? WL.DIRT : WL.STONE;
        }
        if (b === B.FOREST && d >= 24) wl = WL.STONE;
        if (d < 3) wl = 0;
      }
      tiles[y * W + x] = t; walls[y * W + x] = wl;
    }
  }
  const carve = (cx0: number, cy0: number, r: number) => {
    const r2 = r * r;
    for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) {
      if (dx * dx + dy * dy > r2) continue; const x = cx0 + dx, y = cy0 + dy;
      if (inb(x, y) && y < HELL_TOP - 3) { const i = y * W + x; if (tiles[i] !== T.WATER && tiles[i] !== T.LAVA) tiles[i] = T.AIR; }
    }
  };
  // 2. caves
  for (let x = 1; x < W - 1; x++) {
    const s = surf[x];
    for (let y = s + 9; y < HELL_TOP - 3; y++) {
      const i = y * W + x; if (!tiles[i]) continue;
      const dT = Math.min(1, (y - s) / 160);
      const n1 = nz.fbm(x * 0.05, y * 0.065, 3), n2 = nz2.fbm(x * 0.022 + 50, y * 0.034, 3);
      if (Math.abs(n1 - 0.5) < 0.021 + dT * 0.012 || n2 > 0.69 - dT * 0.04) tiles[i] = T.AIR;
    }
  }
  // 3. tunnels from the surface
  for (let k = 0; k < 18; k++) {
    let px = ri(20, W - 20); if (Math.abs(px - cx) < 14) continue;
    let py = surf[px], ang = Math.PI / 2 + (rng() - 0.5) * 1.0; const r = 1.6 + rng() * 1.2, len = ri(50, 140);
    for (let s = 0; s < len; s++) {
      carve(Math.round(px), Math.round(py), r); px += Math.cos(ang) * 1.2; py += Math.sin(ang) * 1.2;
      ang += (rng() - 0.5) * 0.55; ang = ang * 0.96 + (Math.PI / 2) * 0.04; px = Math.max(8, Math.min(W - 8, px)); if (py > HELL_TOP - 14) break;
    }
  }
  // 4. blight chasms
  const bl: number[] = []; for (let x = 0; x < W; x++) if (biomes[x] === B.BLIGHT) bl.push(x);
  if (bl.length > 12) for (let k = 0; k < 4; k++) {
    let x = bl[ri(4, bl.length - 5)]; const wd = ri(2, 3), depth = ri(90, 130), s0 = surf[x];
    for (let y = s0 - 2; y < s0 + depth; y++) { x += (rng() - 0.5) * 0.9; for (let dx = -wd; dx <= wd; dx++) { const xx = Math.round(x) + dx; if (inb(xx, y)) tiles[y * W + xx] = T.AIR; } }
  }
  // 5. underworld
  for (let y = HELL_TOP + 4; y < H - 3; y++) for (let x = 1; x < W - 1; x++) {
    const band = Math.max(0, 1 - Math.abs(y - (H - 24)) / 22) * 0.12;
    if (nzH.fbm(x * 0.03, y * 0.07, 3) > 0.56 - band) tiles[y * W + x] = T.AIR;
  }
  const carveH = (cx0: number, cy0: number, r: number) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (dx * dx + dy * dy > r * r) continue; const x = cx0 + dx, y = cy0 + dy; if (inb(x, y) && y > HELL_TOP + 3 && y < H - 3) tiles[y * W + x] = T.AIR; }
  };
  for (let x = 1; x < W - 1; x++) carveH(x, Math.round(H - 26 + Math.sin(x * 0.03) * 4 + (nzH.n(x * 0.05, 9) - 0.5) * 8), 5);
  for (let y = H - 14; y < H - 2; y++) for (let x = 1; x < W - 1; x++) if (tiles[y * W + x] === T.AIR) tiles[y * W + x] = T.LAVA;
  for (let x = 0; x < W; x++) { tiles[(H - 1) * W + x] = T.ASH; tiles[(H - 2) * W + x] = T.ASH; }

  // 6. ores
  const REP = new Set<number>([T.STONE, T.EBON, T.DIRT, T.MUD, T.ICE, T.SANDSTONE, T.SNOW]);
  const blob = (bx: number, by: number, r: number, tile: number, rep: Set<number>) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r * (0.6 + rng() * 0.5)) { const x = bx + dx, y = by + dy; if (inb(x, y) && rep.has(tiles[y * W + x])) tiles[y * W + x] = tile; }
    }
  };
  for (let k = 0; k < 340 * sc; k++) blob(ri(5, W - 5), ri(98, 215), ri(2, 4), T.COPPER, REP);
  for (let k = 0; k < 220 * sc; k++) blob(ri(5, W - 5), ri(110, 225), ri(2, 4), T.IRON, REP);
  for (let k = 0; k < 120 * sc; k++) blob(ri(5, W - 5), ri(150, 226), ri(2, 3), T.GOLD, REP);
  if (bl.length) for (let k = 0; k < 80 * sc; k++) { const x = bl[ri(0, bl.length - 1)]; blob(x, ri(surf[x] + 25, surf[x] + 135), ri(2, 3), T.SHADOW, new Set([T.EBON])); }
  for (let k = 0; k < 170 * sc; k++) blob(ri(5, W - 5), ri(HELL_TOP + 3, H - 6), ri(2, 4), T.HELLSTONE, new Set([T.ASH]));

  // 7. lakes & puddles
  for (let k = 0; k < 9; k++) {
    const x = ri(25, W - 25); if (Math.abs(x - cx) < 30) continue;
    const wd = ri(14, 28), dp = ri(4, 8), x0 = x - (wd >> 1);
    let L = 999; for (let xx = x0 - 3; xx <= x0 + wd + 3; xx++) L = Math.min(L, surf[Math.max(0, Math.min(W - 1, xx))]);
    for (let dx = 0; dx < wd; dx++) {
      const xx = x0 + dx, t = (dx - wd / 2) / (wd / 2), depth = Math.floor(dp * Math.sqrt(Math.max(0, 1 - t * t)));
      for (let y = L - 2; y < L + depth; y++) { if (!inb(xx, y)) continue; tiles[y * W + xx] = y >= L ? T.WATER : T.AIR; }
    }
  }
  const sol = (t: number) => TILES[t].solid;
  const puddle = (tile: number, ymin: number, ymax: number) => {
    for (let tries = 0; tries < 400; tries++) {
      const x = ri(10, W - 10), y = ri(ymin, ymax); const i = y * W + x;
      if (tiles[i] !== T.AIR || !sol(tiles[i + W])) continue;
      for (let row = 0; row < 2; row++) {
        let l = x, r = x; while (l > x - 10 && tiles[(y - row) * W + l - 1] === T.AIR && (row > 0 || sol(tiles[(y - row + 1) * W + l - 1]))) l--;
        while (r < x + 10 && tiles[(y - row) * W + r + 1] === T.AIR && (row > 0 || sol(tiles[(y - row + 1) * W + r + 1]))) r++;
        for (let xx = l; xx <= r; xx++) if (tiles[(y - row) * W + xx] === T.AIR) tiles[(y - row) * W + xx] = tile;
      }
      return;
    }
  };
  for (let k = 0; k < 45; k++) puddle(T.WATER, 105, 200);
  for (let k = 0; k < 16; k++) puddle(T.LAVA, 190, HELL_TOP - 8);

  // 8. surface decoration
  let lastTree = -10;
  const tree = (x: number, s: number, b: number) => {
    const hh = b === B.JUNGLE ? ri(9, 17) : b === B.TUNDRA ? ri(7, 12) : b === B.BLIGHT ? ri(4, 8) : ri(5, 10);
    for (let i = 1; i <= hh; i++) tiles[(s - i) * W + x] = T.TRUNK;
    const top = s - hh, leaf = b === B.TUNDRA ? T.LEAVES_SNOW : b === B.BLIGHT ? T.LEAVES_BLIGHT : T.LEAVES;
    const put = (xx: number, yy: number) => { if (inb(xx, yy) && tiles[yy * W + xx] === T.AIR) tiles[yy * W + xx] = leaf; };
    if (b === B.TUNDRA) { for (let r = 0; r < 7; r++) { const half = Math.min(3, Math.floor(r / 2) + (r > 0 ? 1 : 0)); for (let dx = -half; dx <= half; dx++) put(x + dx, top - 1 + r); } put(x, top - 2); }
    else { const rx = b === B.JUNGLE ? 4 : b === B.BLIGHT ? 2 : 3, ry = b === B.BLIGHT ? 2 : 3; for (let dy = -ry; dy <= ry; dy++) for (let dx = -rx; dx <= rx; dx++) if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.1) put(x + dx, top - 1 + dy); }
  };
  for (let x = 4; x < W - 4; x++) {
    const s = surf[x], t = tiles[s * W + x], b = biomes[x]; if (tiles[(s - 1) * W + x] !== T.AIR) continue; const near = Math.abs(x - cx) < 6;
    if ((t === T.GRASS || t === T.JGRASS || t === T.BGRASS || t === T.SNOW) && !near && x - lastTree > 3 && rng() < (b === B.JUNGLE ? 0.13 : 0.07)) { tree(x, s, b); lastTree = x; continue; }
    if (t === T.GRASS) { const r = rng(); if (r < 0.04) tiles[(s - 1) * W + x] = T.DAYBLOOM; else if (r < 0.42) tiles[(s - 1) * W + x] = T.TALLGRASS; }
    else if (t === T.JGRASS && rng() < 0.35) tiles[(s - 1) * W + x] = T.TALLGRASS;
    else if (t === T.SNOW && rng() < 0.035) tiles[(s - 1) * W + x] = T.SHIVER;
    else if (t === T.SAND && !near && rng() < 0.035) { const hh = ri(2, 5); for (let i = 1; i <= hh; i++) if (tiles[(s - i) * W + x] === T.AIR) tiles[(s - i) * W + x] = T.CACTUS; }
  }
  for (let y = 120; y < H - 4; y++) for (let x = 2; x < W - 2; x++) {
    const i = y * W + x; if (tiles[i] !== T.AIR || !sol(tiles[i + W])) continue;
    if (y >= HELL_TOP) { if (tiles[i + W] === T.ASH && rng() < 0.02) tiles[i] = T.FIRE; }
    else if (y > surf[x] + 25 && rng() < 0.012) tiles[i] = T.GLOWSHROOM;
  }
  // 9. crystals
  const crystals: number[] = []; const cn = Math.round(16 * sc + (opts.scarce ? 0 : 0));
  for (let tries = 0; tries < 9000 && crystals.length < cn; tries++) {
    const x = ri(15, W - 15), y = ri(surf[Math.min(W - 1, x)] + 40, HELL_TOP - 12); const i = y * W + x;
    if (tiles[i] === T.AIR && sol(tiles[i + W]) && !crystals.some(c => Math.abs(c % W - x) < 20 && Math.abs(((c / W) | 0) - y) < 20)) { tiles[i] = T.CRYSTAL; crystals.push(i); }
  }
  // 10. cabins & chests
  const room = (x0: number, y0: number, rw: number, rh: number, border: number, wl: number) => {
    for (let y = y0 - 1; y <= y0 + rh; y++) for (let x = x0 - 1; x <= x0 + rw; x++) {
      if (!inb(x, y)) continue; const edge = y < y0 || y >= y0 + rh || x < x0 || x >= x0 + rw;
      tiles[y * W + x] = edge ? border : T.AIR; if (!edge) walls[y * W + x] = wl; else if (!walls[y * W + x]) walls[y * W + x] = wl;
    }
  };
  const lootRng = mulberry(seed ^ 0x51ed);
  const placeChest = (x: number, y: number, kind: string) => { tiles[y * W + x] = T.CHEST; w.chests.set(y * W + x, chestLoot(lootRng, kind, y, biomes[Math.max(0, Math.min(W - 1, x))], luck)); };
  const nCab = Math.round(16 * sc);
  for (let k = 0; k < nCab; k++) {
    const rw = ri(9, 13), rh = 5, x0 = ri(12, W - 30), y0 = ri(surf[Math.min(W - 1, x0)] + 28, HELL_TOP - 16);
    room(x0, y0, rw, rh, T.WOOD, WL.WOOD);
    placeChest(x0 + ri(1, rw - 2), y0 + rh - 1, 'cabin');
    tiles[(y0 + 1) * W + x0 + 1] = T.TORCH; tiles[(y0 + 1) * W + x0 + rw - 2] = T.TORCH;
    if (rw > 10) { tiles[(y0 + rh - 1) * W + x0 + rw - 4] = T.TABLE; tiles[(y0 + rh - 1) * W + x0 + rw - 6] = T.CHAIR; }
  }
  for (let k = 0; k < Math.round(7 * sc) + 1; k++) {
    const rw = 9, rh = 5, x0 = ri(12, W - 30), y0 = ri(HELL_TOP + 8, H - 24);
    room(x0, y0, rw, rh, T.OBSIDIAN, WL.HELL); placeChest(x0 + ri(1, rw - 2), y0 + rh - 1, 'hell'); tiles[(y0 + 1) * W + x0 + 1] = T.TORCH;
  }
  // 11. sky islands
  for (let k = 0; k < 4; k++) {
    const ix = Math.round(W * (0.14 + k * 0.24)) + ri(-15, 15), iy = ri(26, 42), rx = ri(9, 14), ry = ri(3, 4);
    for (let dx = -rx; dx <= rx; dx++) {
      const hg = Math.floor(ry * Math.sqrt(1 - (dx / rx) * (dx / rx)));
      for (let dy = 0; dy <= hg; dy++) { const x = ix + dx, y = iy + dy; if (inb(x, y)) { tiles[y * W + x] = dy === 0 ? T.GRASS : T.DIRT; if (dy > 0) walls[y * W + x] = WL.DIRT; } }
    }
    placeChest(ix + ri(-2, 2), iy - 1, 'sky');
    for (const tx of [ix - rx + 3, ix + rx - 3]) { for (let i = 1; i <= 5; i++) tiles[(iy - i) * W + tx] = T.TRUNK; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (dx * dx + dy * dy <= 5 && tiles[(iy - 6 + dy) * W + tx + dx] === T.AIR) tiles[(iy - 6 + dy) * W + tx + dx] = T.LEAVES; }
  }
  // 12. spawn
  const sy = surf[cx];
  for (let y = sy - 12; y < sy; y++) for (let x = cx - 5; x <= cx + 5; x++) tiles[y * W + x] = T.AIR;
  for (let x = cx - 5; x <= cx + 5; x++) if (tiles[sy * W + x] === T.AIR || TILES[tiles[sy * W + x]].liquid) tiles[sy * W + x] = T.GRASS;
  w.spawn = { x: cx, y: sy };
  return w;
}
