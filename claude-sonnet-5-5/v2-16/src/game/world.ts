import { W, H, T_PLAIN, T_FOREST, T_HILL, T_MOUNT, T_WATER, T_DESERT, TOWN_NAMES, type Cargo } from './data';

export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const BIT = [1, 2, 4, 8];
export const OPP = [2, 3, 0, 1];

export function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Packet { n: number; ox: number; oy: number; t: number; src: number }
export type CargoStore = Record<Cargo, Packet[]>;
export const emptyStore = (): CargoStore => ({ pass: [], mail: [], coal: [], grain: [], timber: [], goods: [] });

export interface Town {
  id: number; name: string; x: number; y: number; pop: number; boomUntil: number; supply: number;
  prodM: number; pickedM: number; terminus: 0 | 1 | 2; bldg: [number, number, number][]; lastTier: number; kind: 'town';
}
export type IndKind = 'mine' | 'farm' | 'lumber' | 'factory';
export interface Industry {
  id: number; name: string; x: number; y: number; ik: IndKind; level: number; prog: number;
  stock: { coal: number; timber: number }; downUntil: number; prodM: number; pickedM: number; recvM: number; kind: 'ind';
}

export interface WorldGen { terr: Uint8Array; towns: Town[]; inds: Industry[] }

function makeNoise(r: () => number, cell: number) {
  const gw = Math.ceil(W / cell) + 3, gh = Math.ceil(H / cell) + 3;
  const g: number[] = [];
  for (let i = 0; i < gw * gh; i++) g.push(r());
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = x / cell, fy = y / cell;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

const IND_NAMES: Record<IndKind, string[]> = {
  mine: ['Black Seam Mine', 'Dead Mule Colliery', 'Deep Vein Pit', 'Anthracite Gap'],
  farm: ['Golden Acre Farm', 'Hollis Wheat Ranch', 'Big Sky Grange', 'Meadowlark Farm'],
  lumber: ['Widow Pine Camp', 'Redcedar Sawmill', 'Timberline Camp'],
  factory: ['Cartwright Works', 'Ironside Foundry'],
};

export function generateWorld(seed: number): WorldGen {
  const r = mulberry32(seed);
  const nA = makeNoise(r, 9), nB = makeNoise(r, 5), nC = makeNoise(r, 3), nD = makeNoise(r, 6), nM = makeNoise(r, 8), nM2 = makeNoise(r, 4);
  const terr = new Uint8Array(W * H);
  const ridgeShift = r() * 6 - 3;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let e = 0.5 * nA(x, y) + 0.3 * nB(x, y) + 0.2 * nC(x, y);
      const ridge = Math.exp(-Math.pow((x - W * 0.5 - ridgeShift - 3 * Math.sin(y * 0.28)) / (W * 0.085), 2));
      e += ridge * 0.34 * (0.55 + 0.45 * nD(x, y));
      const m = 0.6 * nM(x, y) + 0.4 * nM2(x, y);
      let t = T_PLAIN;
      if (e > 0.8) t = T_MOUNT;
      else if (e > 0.66) t = T_HILL;
      else if (e < 0.24) t = T_WATER;
      else if (m > 0.56) t = T_FOREST;
      else if (m < 0.34 && e < 0.55) t = T_DESERT;
      if (x <= 1 || x >= W - 2 || y === 0 || y === H - 1) t = T_WATER;
      terr[y * W + x] = t;
    }
  }
  // river
  let rx = Math.floor(W * (0.22 + r() * 0.56));
  for (let y = 1; y < H - 1; y++) {
    terr[y * W + rx] = T_WATER;
    if (r() < 0.35 && rx + 1 < W - 2) terr[y * W + rx + 1] = T_WATER;
    const s = r();
    rx += s < 0.3 ? -1 : s < 0.6 ? 1 : 0;
    rx = Math.max(4, Math.min(W - 5, rx));
    terr[y * W + rx] = T_WATER;
  }
  const towns: Town[] = [];
  const inds: Industry[] = [];
  const pts: { x: number; y: number }[] = [];
  const flatten = (cx: number, cy: number, rad: number) => {
    for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
      if (x > 1 && x < W - 2 && y > 0 && y < H - 1) terr[y * W + x] = T_PLAIN;
    }
  };
  const mkTown = (name: string, x: number, y: number, pop: number, terminus: 0 | 1 | 2) => {
    flatten(x, y, 1);
    const bldg: [number, number, number][] = [];
    for (let i = 0; i < 26; i++) bldg.push([(r() - 0.5) * 2.6, (r() - 0.5) * 2.6, r()]);
    towns.push({ id: towns.length, name, x, y, pop, boomUntil: 0, supply: 0, prodM: 0, pickedM: 0, terminus, bldg, lastTier: 0, kind: 'town' });
    pts.push({ x, y });
  };
  mkTown('Pacific Landing', 4, 6 + Math.floor(r() * (H - 12)), 520, 1);
  const names = [...TOWN_NAMES].sort(() => r() - 0.5);
  let tries = 0;
  while (towns.length < 9 && tries++ < 3000) {
    const x = 9 + Math.floor(r() * (W - 18)), y = 3 + Math.floor(r() * (H - 6));
    const t = terr[y * W + x];
    if (t === T_WATER || t === T_MOUNT) continue;
    if (pts.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 9)) continue;
    mkTown(names.pop() || 'Newtown', x, y, 160 + Math.floor(r() * 340), 0);
  }
  mkTown('Atlantic Harbor', W - 5, 6 + Math.floor(r() * (H - 12)), 560, 2);
  // sort towns by x so ids are west->east
  towns.sort((a, b) => a.x - b.x);
  towns.forEach((t, i) => { t.id = i; });

  const place = (ik: IndKind, ok: (t: number, x: number, y: number) => boolean, count: number, force?: number) => {
    let placed = 0, at = 0;
    while (placed < count && at++ < 4000) {
      const x = 5 + Math.floor(r() * (W - 10)), y = 2 + Math.floor(r() * (H - 4));
      const t = terr[y * W + x];
      if (t === T_WATER) continue;
      if (at < 3000 && !ok(t, x, y)) continue;
      if (pts.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 4)) continue;
      if (force !== undefined) terr[y * W + x] = force;
      const nm = IND_NAMES[ik][placed % IND_NAMES[ik].length];
      inds.push({ id: 100 + inds.length, name: nm, x, y, ik, level: 1, prog: 0, stock: { coal: 0, timber: 0 }, downUntil: 0, prodM: 0, pickedM: 0, recvM: 0, kind: 'ind' });
      pts.push({ x, y });
      placed++;
    }
  };
  place('mine', (t) => t === T_HILL || t === T_MOUNT, 4, T_HILL);
  place('farm', (t) => t === T_PLAIN, 4);
  place('lumber', (t) => t === T_FOREST, 3, T_FOREST);
  place('factory', (t, x, y) => t === T_PLAIN && towns.some((tw) => { const d = Math.abs(tw.x - x) + Math.abs(tw.y - y); return d >= 5 && d <= 9; }), 2);
  inds.forEach((n, i) => { n.id = 100 + i; });
  return { terr, towns, inds };
}
