// ===== Map construction, collision helpers, pathfinding =====
import { rng } from './data.js';

export const GR = 0, DI = 1, SA = 2, WA = 3, CO = 4, WO = 5, ST = 6, WL = 7, TR = 8, HW = 9;
const SOLIDG = new Set([WA, WL, TR, HW]);

export const SPOTS = {
  plaza: { map: 'town', x: 12, y: 11 }, plaza2: { map: 'town', x: 34, y: 11 }, fountain: { map: 'town', x: 23, y: 14 }, bench: { map: 'town', x: 17, y: 12 },
  store_front: { map: 'town', x: 5, y: 9 }, saloon_front: { map: 'town', x: 13, y: 9 }, center_front: { map: 'town', x: 23, y: 9 },
  smith_front: { map: 'town', x: 33, y: 9 }, ranch_front: { map: 'town', x: 41, y: 9 }, lily_home: { map: 'town', x: 8, y: 19 }, rook_home: { map: 'town', x: 38, y: 19 },
  dock: { map: 'beach', x: 17, y: 9 }, beach_walk: { map: 'beach', x: 10, y: 9 }, hut_front: { map: 'beach', x: 6, y: 8 },
};

function mk(name, w, h, fill) {
  return { name, w, h, g: new Uint8Array(w * h).fill(fill), s: new Uint8Array(w * h), objs: [], grid: new Array(w * h).fill(null), soil: {}, warps: [], doors: [], blds: [], decos: [], fish: null, outdoor: false };
}
export const inb = (m, x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h;
export const objAt = (m, x, y) => (inb(m, x, y) ? m.grid[y * m.w + x] : null);
export function addObj(m, o) {
  const i = o.y * m.w + o.x;
  if (m.grid[i]) removeObj(m, m.grid[i]);
  m.objs.push(o); m.grid[i] = o; return o;
}
export function removeObj(m, o) {
  const k = m.objs.indexOf(o); if (k >= 0) m.objs.splice(k, 1);
  const i = o.y * m.w + o.x; if (m.grid[i] === o) m.grid[i] = null;
}
export function rebuildGrid(m) {
  m.grid = new Array(m.w * m.h).fill(null);
  m.objs.forEach(o => { m.grid[o.y * m.w + o.x] = o; });
}
export function solidAt(m, x, y) {
  if (!inb(m, x, y)) return true;
  const i = y * m.w + x;
  if (SOLIDG.has(m.g[i]) || m.s[i]) return true;
  const o = m.grid[i]; return !!(o && o.solid);
}
export function tileFree(m, x, y) { return inb(m, x, y) && !solidAt(m, x, y) && !m.grid[y * m.w + x]; }
const fillRect = (m, x, y, w, h, c) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (inb(m, i, j)) m.g[j * m.w + i] = c; };
function bld(m, x, y, w, h, style, name, doorX, door) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) m.s[j * m.w + i] = 1;
  const dy = y + h - 1;
  m.s[dy * m.w + doorX] = 0;
  m.blds.push(Object.assign({ x, y, w, h, name, dx: doorX, dy }, style));
  if (door) m.doors.push(Object.assign({ x: doorX, y: dy }, door));
}
function treeObj(m, x, y, r) { return addObj(m, { t: 'tree', x, y, hp: 5, mhp: 5, solid: true, v: Math.floor(r() * 3) }); }

// ---------- BFS helpers ----------
export function bfsPath(m, sx, sy, tx, ty, limit) {
  const w = m.w, h = m.h, prev = new Int32Array(w * h).fill(-2), q = [sy * w + sx];
  prev[sy * w + sx] = -1; let qi = 0; const tgt = ty * w + tx;
  while (qi < q.length) {
    const c = q[qi++]; if (c === tgt) break;
    const cx = c % w, cy = (c / w) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0), ni = ny * w + nx;
      if (!inb(m, nx, ny) || prev[ni] !== -2) continue;
      if (ni !== tgt && solidAt(m, nx, ny)) continue;
      prev[ni] = c; q.push(ni);
      if (limit && q.length > limit) break;
    }
  }
  if (prev[tgt] === -2) return null;
  const out = []; let c = tgt;
  while (c !== -1 && c !== sy * w + sx) { out.push({ x: c % w, y: (c / w) | 0 }); c = prev[c]; }
  return out.reverse();
}
export function bfsDist(m, sx, sy) {
  const w = m.w, d = new Int16Array(w * m.h).fill(-1), q = [sy * w + sx]; d[sy * w + sx] = 0; let qi = 0;
  while (qi < q.length) {
    const c = q[qi++], cx = c % w, cy = (c / w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), ny = cy + (k === 2 ? 1 : k === 3 ? -1 : 0);
      if (!inb(m, nx, ny)) continue;
      const ni = ny * w + nx; if (d[ni] !== -1 || SOLIDG.has(m.g[ni]) || m.s[ni]) continue;
      d[ni] = d[c] + 1; q.push(ni);
    }
  }
  return d;
}

// ---------- FARM ----------
function buildFarm(seed) {
  const r = rng(seed + 11), m = mk('farm', 48, 34, GR), w = m.w;
  m.fish = 'pond'; m.outdoor = true; m.farm = true;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= 46 || y >= 32) m.g[y * w + x] = TR;
  fillRect(m, 46, 15, 2, 4, GR);
  fillRect(m, 6, 7, 2, 10, DI); fillRect(m, 6, 16, 42, 2, DI); fillRect(m, 27, 6, 2, 10, DI);
  fillRect(m, 37, 14, 1, 2, DI); fillRect(m, 16, 6, 1, 1, DI);
  bld(m, 4, 3, 6, 4, { wall: '#d2a26d', roof: '#a63d2f', sign: '' }, 'Farmhouse', 6, { type: 'warp', to: 'house', tx: 5, ty: 7 });
  bld(m, 14, 2, 6, 4, { wall: '#bfe3ea', roof: '#6fa8b8', glass: 1, sign: '' }, 'Greenhouse', 16, { type: 'greenhouse' });
  bld(m, 25, 2, 6, 4, { wall: '#6e6a66', roof: '#4a4744', rock: 1, sign: 'MINE' }, 'Mine', 27, { type: 'mine' });
  bld(m, 34, 3, 5, 4, { wall: '#d4b27a', roof: '#b84a3a', sign: 'COOP' }, 'Coop', 36, { type: 'coop' });
  bld(m, 34, 10, 7, 4, { wall: '#b5503c', roof: '#6a3a2a', sign: 'BARN' }, 'Barn', 37, { type: 'barn' });
  addObj(m, { t: 'bin', x: 11, y: 7, solid: true });
  // pond
  for (let y = 18; y < 32; y++) for (let x = 30; x < 46; x++) { const dx = (x - 40.5) / 5.8, dy = (y - 25) / 4.2; if (dx * dx + dy * dy < 1) m.g[y * w + x] = WA; }
  m.warps.push({ x: 47, y: 15, w: 1, h: 4, to: 'town', dx: -46, dy: -5 });
  // debris
  const ex = (x, y) => (x >= 3 && x <= 10 && y >= 2 && y <= 8) || (x >= 13 && x <= 20 && y <= 7) || (x >= 24 && x <= 31 && y <= 7) || (x >= 33 && x <= 42 && y <= 15 && y >= 2) || (x >= 10 && x <= 17 && y >= 8 && y <= 14);
  for (let y = 3; y < 31; y++) for (let x = 3; x < 45; x++) {
    const i = y * w + x; if (m.g[i] !== GR || m.s[i] || ex(x, y) || m.grid[i]) continue;
    const q = r();
    if (q < 0.085) addObj(m, { t: 'weed', x, y, hp: 1, v: Math.floor(r() * 3) });
    else if (q < 0.125) addObj(m, { t: 'rock', k: 'stone', x, y, hp: 3, mhp: 3, solid: true });
    else if (q < 0.155) addObj(m, { t: 'twig', x, y, hp: 1, solid: false });
    else if (q < 0.17) treeObj(m, x, y, r);
  }
  // starter plot hints
  [[12, 10], [14, 11], [15, 9]].forEach(([x, y]) => addObj(m, { t: 'weed', x, y, hp: 1, v: 0 }));
  addObj(m, { t: 'rock', k: 'stone', x: 13, y: 12, hp: 3, mhp: 3, solid: true });
  addObj(m, { t: 'twig', x: 11, y: 13, hp: 1 });
  return m;
}

// ---------- TOWN ----------
function buildTown(seed) {
  const r = rng(seed + 29), m = mk('town', 48, 26, GR), w = m.w;
  m.outdoor = true; m.fish = 'river'; m.town = true;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < w; x++) if (x < 2 || y < 2 || x >= 46 || y >= 25) m.g[y * w + x] = TR;
  fillRect(m, 0, 10, 2, 4, GR); fillRect(m, 3, 9, 42, 5, CO); fillRect(m, 22, 14, 4, 6, CO);
  fillRect(m, 0, 20, w, 2, WA); fillRect(m, 22, 20, 4, 2, CO); fillRect(m, 22, 25, 4, 1, SA); fillRect(m, 22, 22, 4, 3, DI);
  fillRect(m, 0, 20, 2, 2, TR);
  bld(m, 2, 3, 7, 6, { wall: '#dcb67f', roof: '#3c7dd9', sign: 'GENERAL STORE' }, 'General Store', 5, { type: 'shop', shop: 'general' });
  bld(m, 10, 3, 7, 6, { wall: '#a86b3c', roof: '#8b2d2d', sign: 'SALOON' }, 'Saloon', 13, { type: 'shop', shop: 'saloon' });
  bld(m, 18, 2, 12, 7, { wall: '#cfc7b4', roof: '#3b8f5a', sign: 'COMMUNITY CENTER', center: 1 }, 'Community Center', 23, { type: 'center' });
  bld(m, 31, 3, 6, 6, { wall: '#7a7f8c', roof: '#4a4f5c', sign: 'SMITHY' }, 'Smithy', 33, { type: 'shop', shop: 'smith' });
  bld(m, 38, 3, 7, 6, { wall: '#c0553a', roof: '#7a4a2a', sign: 'RANCH' }, 'Ranch', 41, { type: 'shop', shop: 'ranch' });
  bld(m, 6, 15, 5, 4, { wall: '#e3cfa6', roof: '#7b57a8', sign: '' }, "Lily's House", 8, { type: 'locked', msg: "Lily's house. Nobody answers." });
  bld(m, 36, 15, 5, 4, { wall: '#8e8aa8', roof: '#3b3b55', sign: '' }, "Rook's House", 38, { type: 'locked', msg: "Rook's house. The curtains are closed." });
  m.decos.push({ t: 'fountain', x: 23, y: 11, w: 2, h: 2 }); for (let j = 11; j < 13; j++) for (let i = 23; i < 25; i++) m.s[j * w + i] = 1;
  m.decos.push({ t: 'bench', x: 17, y: 13, w: 1, h: 1 }); m.s[13 * w + 17] = 1;
  m.decos.push({ t: 'bench', x: 31, y: 13, w: 1, h: 1 }); m.s[13 * w + 31] = 1;
  [[4, 10], [20, 10], [28, 10], [43, 10], [15, 13], [26, 13]].forEach(([x, y]) => m.decos.push({ t: 'lamp', x, y, w: 1, h: 1 }));
  m.warps.push({ x: 0, y: 10, w: 1, h: 4, to: 'farm', dx: 46, dy: 5 });
  m.warps.push({ x: 22, y: 25, w: 4, h: 1, to: 'beach', dx: -8, dy: -24 });
  for (let y = 14; y < 24; y++) for (let x = 3; x < 45; x++) {
    const i = y * w + x; if (m.g[i] !== GR || m.s[i] || (x >= 20 && x <= 27) || (x >= 5 && x <= 11 && y < 20) || (x >= 35 && x <= 41 && y < 20) || y === 19 && (x === 8 || x === 38)) continue;
    const q = r(); if (q < 0.045) treeObj(m, x, y, r); else if (q < 0.06) addObj(m, { t: 'bush', x, y, solid: true });
  }
  [[3, 14], [44, 14], [3, 8 + 1 - 1 + 6], [44, 20 - 1]].forEach(([x, y]) => { if (tileFree(m, x, y) && m.g[y * w + x] === GR) treeObj(m, x, y, r); });
  return m;
}

// ---------- BEACH ----------
function buildBeach(seed) {
  const r = rng(seed + 47), m = mk('beach', 36, 22, SA), w = m.w;
  m.outdoor = true; m.fish = 'ocean'; m.beach = true;
  for (let y = 14; y < m.h; y++) for (let x = 0; x < w; x++) m.g[y * w + x] = WA;
  for (let y = 0; y < 13; y++) { m.g[y * w] = TR; m.g[y * w + w - 1] = TR; }
  for (let x = 0; x < w; x++) m.g[x] = TR;
  fillRect(m, 14, 0, 4, 1, SA);
  fillRect(m, 17, 11, 2, 7, WO);
  bld(m, 3, 3, 7, 5, { wall: '#9b7a52', roof: '#3a6f8a', sign: "SALTY'S TACKLE" }, "Salty's Tackle", 6, { type: 'shop', shop: 'tackle' });
  m.warps.push({ x: 14, y: 0, w: 4, h: 1, to: 'town', dx: 8, dy: 24 });
  for (let y = 2; y < 13; y++) for (let x = 2; x < 34; x++) {
    const i = y * w + x; if (m.g[i] !== SA || m.s[i] || (x >= 14 && x <= 19) || (y === 8 && x === 6)) continue;
    const q = r(); if (q < 0.03) addObj(m, { t: 'rock', k: 'stone', x, y, hp: 3, mhp: 3, solid: true }); else if (q < 0.045) addObj(m, { t: 'bush', x, y, solid: true });
  }
  return m;
}

// ---------- HOUSE ----------
function buildHouse() {
  const m = mk('house', 12, 9, WO), w = m.w;
  m.indoor = true; m.name = 'house';
  for (let x = 0; x < w; x++) { m.g[x] = HW; m.g[w + x] = HW; m.g[8 * w + x] = HW; }
  for (let y = 0; y < m.h; y++) { m.g[y * w] = HW; m.g[y * w + 11] = HW; }
  m.g[8 * w + 5] = WO;
  addObj(m, { t: 'bed', x: 9, y: 2, solid: true });
  addObj(m, { t: 'stove', x: 3, y: 2, solid: true });
  addObj(m, { t: 'tv', x: 6, y: 2, solid: true });
  m.warps.push({ x: 5, y: 8, w: 1, h: 1, to: 'farm', dx: 1, dy: -1 });
  return m;
}
function buildGreenhouse() {
  const m = mk('greenhouse', 12, 9, DI), w = m.w;
  m.indoor = true; m.glass = true; m.farm = true; m.greenhouse = true;
  for (let x = 0; x < w; x++) { m.g[x] = HW; m.g[8 * w + x] = HW; }
  for (let y = 0; y < m.h; y++) { m.g[y * w] = HW; m.g[y * w + 11] = HW; }
  m.g[8 * w + 5] = DI;
  for (let y = 2; y <= 5; y++) for (let x = 2; x <= 9; x++) m.soil[y * w + x] = { tilled: 1, wet: 1 };
  m.warps.push({ x: 5, y: 8, w: 1, h: 1, to: 'farm', dx: 11, dy: -2 });
  return m;
}

// ---------- MINE ----------
function genCave(r, w, h) {
  for (let attempt = 0; attempt < 10; attempt++) {
    let a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) ? 1 : (r() < 0.45 ? 1 : 0);
    for (let it = 0; it < 5; it++) {
      const b = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let n = 0;
        for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (!i && !j) continue; const xx = x + i, yy = y + j; n += (xx < 0 || yy < 0 || xx >= w || yy >= h) ? 1 : a[yy * w + xx]; }
        b[y * w + x] = (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) ? 1 : (n >= 5 ? 1 : (n <= 2 ? 0 : a[y * w + x]));
      }
      a = b;
    }
    const comp = new Int32Array(w * h).fill(-1); let best = -1, bestSize = 0, cid = 0;
    for (let s = 0; s < w * h; s++) {
      if (a[s] || comp[s] !== -1) continue;
      const st = [s]; comp[s] = cid; let n = 0;
      while (st.length) {
        const c = st.pop(); n++; const cx = c % w, cy = (c / w) | 0;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) return; const ni = ny * w + nx; if (!a[ni] && comp[ni] === -1) { comp[ni] = cid; st.push(ni); } });
      }
      if (n > bestSize) { bestSize = n; best = cid; } cid++;
    }
    if (bestSize >= 260) { for (let i = 0; i < w * h; i++) if (comp[i] !== best) a[i] = 1; return a; }
  }
  const a = new Uint8Array(w * h).fill(1);
  for (let y = 3; y < h - 3; y++) for (let x = 3; x < w - 3; x++) a[y * w + x] = 0;
  return a;
}
function buildMine(seed, floor) {
  const r = rng(seed * 977 + floor * 131 + 5), w = 40, h = 28, m = mk('mine', w, h, WL);
  m.mine = true; m.floor = floor; m.zone = floor <= 4 ? 0 : floor <= 9 ? 1 : 2; m.indoor = true;
  const boss = floor % 5 === 0;
  let a;
  if (boss) {
    a = new Uint8Array(w * h).fill(1);
    for (let y = 5; y < 23; y++) for (let x = 4; x < 36; x++) a[y * w + x] = 0;
    [[12, 9], [27, 9], [12, 18], [27, 18], [19, 6], [19, 21]].forEach(([x, y]) => { a[y * w + x] = 1; a[y * w + x + 1] = 1; });
    m.boss = true;
  } else a = genCave(r, w, h);
  for (let i = 0; i < w * h; i++) m.g[i] = a[i] ? WL : ST;
  // start
  let sx = -1, sy = -1;
  for (let x = 1; x < w && sx < 0; x++) for (let y = 1; y < h - 1; y++) if (!a[y * w + x] && !a[y * w + x + 1]) { sx = x; sy = y; break; }
  if (boss) { sx = 5; sy = 14; }
  addObj(m, { t: 'up', x: sx, y: sy });
  m.start = { x: sx + 1, y: sy };
  if (a[sy * w + sx + 1]) { m.g[sy * w + sx + 1] = ST; }
  const dist = bfsDist(m, m.start.x, m.start.y);
  let maxD = 1; for (let i = 0; i < dist.length; i++) if (dist[i] > maxD) maxD = dist[i];
  // rocks
  const rocks = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (dist[i] < 4 || m.grid[i]) continue;
    if (boss ? r() < 0.012 : r() < 0.075) {
      const q = r(), cu = floor <= 9 ? 0.2 : 0.05, ir = (floor >= 3 && floor <= 14) ? 0.17 : 0, au = floor >= 8 ? 0.15 : 0;
      let k = 'stone';
      if (q < 0.08) k = 'coal'; else if (q < 0.08 + cu) k = 'copper'; else if (q < 0.08 + cu + ir) k = 'iron'; else if (q < 0.08 + cu + ir + au) k = 'gold'; else if (q < 0.08 + cu + ir + au + 0.07) k = 'gem';
      const hp = { stone: 3, coal: 4, copper: 5, iron: 7, gold: 9, gem: 8 }[k];
      rocks.push(addObj(m, { t: 'rock', k, x, y, hp, mhp: hp, solid: true }));
    }
  }
  if (!boss) {
    const far = rocks.filter(o => dist[o.y * w + o.x] > maxD * 0.55);
    if (far.length) far[Math.floor(r() * far.length)].stairs = true;
    else {
      let bx = m.start.x, by = m.start.y, bd = 0;
      for (let i = 0; i < dist.length; i++) if (dist[i] > bd && !m.grid[i]) { bd = dist[i]; bx = i % w; by = (i / w) | 0; }
      addObj(m, { t: 'down', x: bx, y: by });
    }
  }
  m.dist = dist; m.maxD = maxD;
  return m;
}

export function buildMap(name, seed, floor) {
  switch (name) {
    case 'farm': return buildFarm(seed);
    case 'town': return buildTown(seed);
    case 'beach': return buildBeach(seed);
    case 'house': return buildHouse();
    case 'greenhouse': return buildGreenhouse();
    case 'mine': return buildMine(seed, floor || 1);
    default: return buildFarm(seed);
  }
}
