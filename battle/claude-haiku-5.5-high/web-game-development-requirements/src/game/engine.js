// Civilization Micro — core rules engine (state, map, movement, combat, cities, economy, victory)
import {
  TERRAIN, RESOURCES, IMPROVEMENTS, BUILDINGS, WONDERS, UNITS, TECHS, CIVS,
  DIFFICULTY, MAP_SIZES, MAX_TURN, DEFAULT_SETTINGS,
} from './data.js';

export const SQ3 = Math.sqrt(3);
export const TECH = Object.fromEntries(TECHS.map((t) => [t.id, t]));

// Simple event bus: engine emits, render/audio/ui listen.
export const bus = {
  h: {},
  on(e, f) { (this.h[e] = this.h[e] || []).push(f); },
  emit(e, d) { (this.h[e] || []).forEach((f) => f(d)); },
};

// Selection / highlight state shared by UI and renderer (not serialized)
export const SEL = { kind: null, id: null, i: -1, moves: new Set(), attacks: new Map() };

// The whole game state. Plain JSON-able data only.
export const G = {};

/* ---------------- utilities ---------------- */

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function hash2(x, y, s) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
function fbm(x, y, s) {
  let v = 0, a = 0.5, f = 1, n = 0;
  for (let o = 0; o < 4; o++) { v += a * vnoise(x * f, y * f, s + o * 7); n += a; a *= 0.5; f *= 2; }
  return v / n;
}

/* ---------------- storage ---------------- */

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* unavailable */ } },
};
const META_KEY = 'civmicro.meta';
const SET_KEY = 'civmicro.settings';
const SAVE_KEY = 'civmicro.save';

export function defaultMeta() {
  return { lp: 0, wins: 0, games: 0, best: 0, perks: {}, lifetime: { kills: 0, cities: 0, wonders: 0, techs: 0, turns: 0 } };
}
export function loadMeta() {
  try { return { ...defaultMeta(), ...JSON.parse(LS.get(META_KEY) || '{}') }; } catch (e) { return defaultMeta(); }
}
export function saveMeta(m) { LS.set(META_KEY, JSON.stringify(m)); }
export function resetMeta() { LS.del(META_KEY); }
export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(LS.get(SET_KEY) || '{}') }; } catch (e) { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { LS.set(SET_KEY, JSON.stringify(s)); }
export function hasSave() { return !!LS.get(SAVE_KEY); }
export function writeSave() { try { LS.set(SAVE_KEY, JSON.stringify(G)); return true; } catch (e) { return false; } }
export function clearSave() { LS.del(SAVE_KEY); }
export function loadSaveData() {
  const s = LS.get(SAVE_KEY);
  if (!s) return false;
  try {
    const o = JSON.parse(s);
    if (!o || !o.tiles || !o.civs) return false;
    for (const k of Object.keys(G)) delete G[k];
    Object.assign(G, o);
    G.exp = G.exp || new Array(G.W * G.H).fill(0);
    SEL.kind = null; SEL.id = null; SEL.i = -1; SEL.moves = new Set(); SEL.attacks = new Map();
    updateVision();
    return true;
  } catch (e) { return false; }
}

/* ---------------- hex grid (odd-q, flat-top) ---------------- */

const NB_EVEN = [[1, 0], [0, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const NB_ODD = [[1, 1], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, 0]];

export function inB(x, y) { return x >= 0 && y >= 0 && x < G.W && y < G.H; }
export function xOf(i) { return i % G.W; }
export function yOf(i) { return (i / G.W) | 0; }

export function nbrsW(i, W, H) {
  const x = i % W, y = (i / W) | 0;
  const d = x & 1 ? NB_ODD : NB_EVEN;
  const out = [];
  for (const [dx, dy] of d) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
  }
  return out;
}

export function nbrs(i) { return nbrsW(i, G.W, G.H); }

export function distW(a, b, W) {
  const ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
  const az = ay - ((ax - (ax & 1)) >> 1), bz = by - ((bx - (bx & 1)) >> 1);
  const ad = -ax - az, bd = -bx - bz;
  return Math.max(Math.abs(ax - bx), Math.abs(ad - bd), Math.abs(az - bz));
}

export function dist(a, b) { return distW(a, b, G.W); }

export function ringTiles(i, r) {
  const out = [];
  const seen = new Set([i]);
  let frontier = [i];
  for (let k = 0; k < r; k++) {
    const next = [];
    for (const f of frontier) {
      for (const n of nbrs(f)) {
        if (!seen.has(n)) { seen.add(n); next.push(n); out.push(n); }
      }
    }
    frontier = next;
  }
  return out;
}

/* ---------------- map generation ---------------- */

export function generateMap(sizeKey, seed) {
  const sz = MAP_SIZES[sizeKey] || MAP_SIZES.standard;
  const W = sz.w, H = sz.h;
  const rnd = mulberry(seed);
  const ns = Math.floor(rnd() * 9999);
  const tiles = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = (x - W / 2) / (W / 2), cy = (y - H / 2) / (H / 2);
      const edge = Math.min(1, (cx * cx + cy * cy) * 0.55);
      const h = fbm(x * 0.16, y * 0.16, ns) - edge * 0.45;
      const m = fbm(x * 0.2 + 50, y * 0.2 + 50, ns + 101);
      const lat = Math.abs(y / H - 0.5) * 2;
      let t;
      if (h < 0.44) t = 'ocean';
      else if (h > 0.8) t = 'mountain';
      else if (h > 0.72) t = 'hills';
      else if (lat > 0.82) t = 'tundra';
      else if (m < 0.38) t = 'desert';
      else if (m > 0.6) t = 'forest';
      else t = m > 0.49 ? 'grass' : 'plains';
      tiles.push({ i: y * W + x, x, y, t, r: null, imp: null, own: -1 });
    }
  }
  // Resources
  for (const tl of tiles) {
    if (rnd() > 0.1) continue;
    if (tl.t === 'mountain') continue;
    const opts = Object.keys(RESOURCES).filter((k) => RESOURCES[k].on.includes(tl.t));
    if (tl.t === 'ocean') {
      const coastal = nbrsW(tl.i, W, H).some((j) => TERRAIN[tiles[j].t].pass);
      if (coastal && rnd() < 0.5) tl.r = 'fish';
      continue;
    }
    if (opts.length) tl.r = opts[Math.floor(rnd() * opts.length)];
  }
  // Starting positions
  const n = 4;
  const cand = tiles.filter((t) => TERRAIN[t.t].pass && t.t !== 'tundra' && t.t !== 'desert' && t.t !== 'hills'
    && t.x > 2 && t.y > 1 && t.x < W - 3 && t.y < H - 2);
  shuffle(cand, rnd);
  let starts = [];
  let sep = Math.floor(Math.min(W, H) * 0.55);
  while (starts.length < n && sep >= 2) {
    starts = [];
    for (const c of cand) {
      if (starts.every((s) => distW(s, c.i, W) >= sep)) {
        starts.push(c.i);
        if (starts.length === n) break;
      }
    }
    if (starts.length < n) sep--;
  }
  while (starts.length < n && cand.length) starts.push(cand[starts.length % cand.length].i);
  return { W, H, tiles, starts };
}

/* ---------------- lookups & diplomacy ---------------- */

export const cityAt = (i) => G.cities.find((c) => c.i === i) || null;
export const unitsAt = (i) => G.units.filter((u) => u.i === i);
export const campAt = (i) => G.camps.find((c) => c.i === i) || null;
export function atWar(a, b) {
  if (a === b) return false;
  if (a < 0 || b < 0) return true;
  return G.rel[a][b] === 'war';
}
export const isMil = (u) => !UNITS[u.type].civil;
export const canCapture = (u) => u.o >= 0 && isMil(u) && !UNITS[u.type].siege;
export function isCoastal(i) { return nbrs(i).some((j) => G.tiles[j].t === 'ocean'); }
export function hasTech(civ, id) { return !id || civ.researched.includes(id); }
export function researchable(civ) {
  return TECHS.filter((t) => !civ.researched.includes(t.id) && t.pre.every((p) => civ.researched.includes(p)));
}
export function setResearch(civ, id) {
  const t = TECH[id];
  if (!t) return 'Unknown technology.';
  if (civ.researched.includes(id)) return 'Already learned.';
  if (!t.pre.every((p) => civ.researched.includes(p))) return 'Missing prerequisites.';
  civ.researching = id;
  return null;
}
export function techCost(id) { return Math.round((TECH[id] ? TECH[id].cost : 100) * 0.6); }
export function civResources(ci) {
  const s = new Set();
  for (const t of G.tiles) if (t.own === ci && t.r) s.add(t.r);
  return s;
}
export function civWonders(ci) {
  const s = new Set();
  for (const c of G.cities) if (c.o === ci) for (const w of c.w) s.add(w);
  return s;
}
export const growNeed = (size) => 12 + size * 6;

/* ---------------- yields ---------------- */

function addY(y, d) { if (!d) return; for (const k in d) y[k] = (y[k] || 0) + d[k]; }

export function tileYields(j, y) {
  const t = G.tiles[j];
  const T = TERRAIN[t.t];
  const o = y || { f: 0, p: 0, g: 0, s: 0, cu: 0 };
  o.f += T.f; o.p += T.p; o.g += T.g;
  if (t.r) {
    const R = RESOURCES[t.r];
    o.f += R.f || 0; o.p += R.p || 0; o.g += R.g || 0; o.s += R.s || 0; o.cu += R.cu || 0;
  }
  if (t.imp) addY(o, IMPROVEMENTS[t.imp].y);
  return o;
}

export function cityYields(c) {
  const civ = G.civs[c.o];
  const y = { f: 0, p: 0, g: 0, s: 0, cu: 0 };
  const CT = TERRAIN[G.tiles[c.i].t];
  y.f += Math.max(2, CT.f + 1);
  y.p += Math.max(1, CT.p);
  y.g += CT.g;
  y.cu += 1;
  for (const j of c.worked) tileYields(j, y);
  y.s += 1 + c.size;
  let content = 4, cap = 8;
  for (const b of c.b) {
    const d = BUILDINGS[b];
    addY(y, d.y);
    if (d.happy) content += d.happy;
    if (d.cap) cap = Math.max(cap, d.cap);
    if (b === 'library' && civ.id === 'china') y.s += 1;
  }
  for (const w of c.w) {
    if (w === 'greatLibrary') { y.s += 3; y.cu += 1; }
    if (w === 'colossus') y.g += 4;
    if (w === 'stonehenge') y.cu += 4;
    if (w === 'eiffel') y.cu += 6;
  }
  const emp = civWonders(c.o);
  if (emp.has('hanging')) y.f += 1;
  if (emp.has('eiffel')) content += 2;
  if (civ.id === 'egypt') y.f += 1;
  const unhappy = Math.max(0, c.size - content);
  y.p = Math.max(0, y.p - unhappy);
  if (c.w.includes('pyramids')) y.p = Math.round(y.p * 1.25);
  y.need = growNeed(c.size);
  y.cap = cap;
  y.content = content;
  y.unhappy = unhappy;
  y.eat = c.size * 2;
  y.surplus = y.f - y.eat;
  return y;
}

/* ---------------- units & movement ---------------- */

export function makeUnit(type, o, i) {
  const d = UNITS[type];
  const u = { id: G.nid++, type, o, i, hp: 100, mp: d.mv, mv: d.mv, fort: false, busy: false, job: null, goal: null, home: -1 };
  G.units.push(u);
  return u;
}

export function removeUnit(v) { G.units = G.units.filter((x) => x.id !== v.id); }
function removeCamp(cp) { G.camps = G.camps.filter((x) => x.id !== cp.id); }

export function reach(u) {
  const out = new Map();
  if (!u || u.mp <= 0) return out;
  const occ = new Map();
  for (const v of G.units) {
    const a = occ.get(v.i);
    if (a) a.push(v); else occ.set(v.i, [v]);
  }
  const mil = isMil(u);
  const best = new Map([[u.i, 0]]);
  const open = [[0, u.i]];
  while (open.length) {
    let mi = 0;
    for (let k = 1; k < open.length; k++) if (open[k][0] < open[mi][0]) mi = k;
    const [c, i] = open.splice(mi, 1)[0];
    if (c > best.get(i)) continue;
    for (const j of nbrs(i)) {
      const tj = G.tiles[j];
      const T = TERRAIN[tj.t];
      if (!T.pass) continue;
      const nc = c + T.mv;
      if (nc > u.mp) continue;
      if (best.has(j) && best.get(j) <= nc) continue;
      if (mil && u.o >= 0 && tj.own >= 0 && tj.own !== u.o && !atWar(u.o, tj.own)) continue;
      const city = cityAt(j);
      const here = occ.get(j) || [];
      if (city && atWar(u.o, city.o)) {
        if (here.length === 0 && canCapture(u)) best.set(j, nc);
        continue;
      }
      if (here.some((v) => atWar(u.o, v.o))) continue;
      best.set(j, nc);
      open.push([nc, j]);
    }
  }
  for (const [j, c] of best) {
    if (j === u.i || c > u.mp) continue;
    const here = occ.get(j) || [];
    if (here.some((v) => v.o === u.o || atWar(u.o, v.o))) continue;
    out.set(j, c);
  }
  return out;
}

// Targets attackable from tile `from` (must be within range).
export function targetsFrom(u, from) {
  const t = UNITS[u.type];
  if (t.civil) return [];
  const rng = t.rng || 1;
  const out = [];
  for (const j of ringTiles(from, rng)) {
    const d = dist(from, j);
    if (d < 1 || d > rng) continue;
    const city = cityAt(j);
    const here = unitsAt(j);
    const enemies = here.filter((v) => atWar(u.o, v.o));
    if (enemies.length) {
      const def = enemies.slice().sort((a, b) => UNITS[b.type].def - UNITS[a.type].def)[0];
      out.push({ j, kind: 'unit', ref: def, city: !!city });
    } else if (u.o >= 0) {
      const cp = campAt(j);
      if (cp) out.push({ j, kind: 'camp', ref: cp, city: false });
    }
  }
  return out;
}

export function combatStats(u, tg, from) {
  const ut = UNITS[u.type];
  let A = ut.atk;
  const civ = u.o >= 0 ? G.civs[u.o] : null;
  if (civ && civ.id === 'mongols' && ut.mounted) A *= 1.25;
  const ranged = (ut.rng || 1) > 1 && dist(from, tg.j) > 1;
  const tile = G.tiles[tg.j];
  let D, mult = 1 + TERRAIN[tile.t].def;
  if (tg.kind === 'camp') {
    D = 6;
  } else {
    D = UNITS[tg.ref.type].def;
    if (tg.ref.fort) mult += 0.25;
    if (tg.city) {
      mult += 0.3;
      const city = cityAt(tg.j);
      if (city && city.b.includes('walls')) mult += 1;
      if (ut.siege) A *= 2;
    }
    if (ut.mounted && UNITS[tg.ref.type].anticav) mult += 1;
  }
  D = Math.max(1, D * mult);
  return { A, D, ranged, p: A / (A + D) };
}

export function resolveFight(A, D, ranged, hpA, hpD) {
  const p = A / (A + D);
  let a = hpA, d = hpD;
  if (ranged) {
    for (let r = 0; r < 4 && d > 0; r++) if (Math.random() < p) d -= 22 + Math.random() * 12;
  } else {
    let n = 0;
    while (a > 0 && d > 0 && n < 30) {
      n++;
      if (Math.random() < p) d -= 20 + Math.random() * 10;
      else a -= 20 + Math.random() * 10;
    }
  }
  return { hpA: Math.max(0, Math.round(a)), hpD: Math.max(0, Math.round(d)) };
}

export function attack(u, j) {
  if (!u || u.mp <= 0) return null;
  const tg = targetsFrom(u, u.i).find((t) => t.j === j);
  if (!tg) return null;
  const st = combatStats(u, tg, u.i);
  const def = tg.ref;
  const hpD0 = def.hp;
  const r = resolveFight(st.A, st.D, st.ranged, u.hp, def.hp);
  const dealt = hpD0 - r.hpD;
  const taken = u.hp - r.hpA;
  u.hp = r.hpA; def.hp = r.hpD;
  u.mp = 0; u.busy = true; u.fort = false;
  const defDead = def.hp <= 0;
  const atkDead = u.hp <= 0;
  const playerInvolved = u.o === 0 || def.o === 0;
  if (playerInvolved) {
    bus.emit('fx', { type: 'hit', i: j, text: `-${dealt}`, col: def.o === 0 ? '#ff6b6b' : '#ffd166', big: defDead });
    if (taken > 0 && u.o === 0) bus.emit('fx', { type: 'hit', i: u.i, text: `-${taken}`, col: '#ff6b6b' });
    bus.emit('shake', { m: defDead ? 7 : 4, t: 0.35 });
  }
  if (defDead) {
    if (tg.kind === 'camp') {
      removeCamp(def);
      rewardCamp(u.o, j);
    } else {
      removeUnit(def);
      if (u.o === 0) G.stats.kills++;
      if (def.o === 0) G.stats.lost++;
    }
  }
  if (atkDead) {
    removeUnit(u);
    if (u.o === 0) G.stats.lost++;
  }
  if (defDead || atkDead) bus.emit('fx', { type: 'burst', i: defDead ? j : u.i, col: defDead ? '#ff9f43' : '#ff6b6b', n: 26 });
  if (playerInvolved) bus.emit('sfx', defDead ? 'kill' : 'hit');
  if (u.o === 0 || def.o === 0) {
    const who = (x) => (x.o >= 0 ? G.civs[x.o].name : 'Barbarian');
    if (tg.kind === 'camp') log(defDead ? `Barbarian camp destroyed by ${who(u)}!` : `Your attack damaged a barbarian camp.`, defDead && u.o === 0 ? 'good' : '');
    else if (defDead) log(`${who(u)} destroyed ${UNITS[def.type].name} of ${who(def)}.`, u.o === 0 ? 'good' : 'bad');
    else log(`${who(u)} attacked ${who(def)}'s ${UNITS[def.type].name} (${dealt} dmg).`, '');
  }
  return { won: defDead, lost: atkDead, dealt, taken, kind: tg.kind };
}

function rewardCamp(o, j) {
  if (o < 0) return;
  const civ = G.civs[o];
  civ.gold += 40;
  civ.bulbs += 25;
  if (o === 0) {
    G.stats.camps++;
    bus.emit('sfx', 'coin');
    bus.emit('fx', { type: 'burst', i: j, col: '#ffd166', n: 40 });
    bus.emit('fx', { type: 'text', i: j, text: '+40 💰 +25 🔬', col: '#ffd166' });
  }
  log(`${civ.name} cleared a barbarian camp: +40 gold, +25 science.`, o === 0 ? 'good' : '');
}

export function moveTo(u, j) {
  const r = reach(u);
  const cost = r.get(j);
  if (cost === undefined) return false;
  const from = u.i;
  const city = cityAt(j);
  const empty = unitsAt(j).length === 0;
  u.i = j;
  u.mp = Math.max(0, u.mp - cost);
  u.busy = true;
  u.fort = false;
  if (city && atWar(u.o, city.o) && empty) captureCity(city, u);
  bus.emit('moved', { u, from, to: j });
  updateVision();
  return true;
}

export function captureCity(c, u) {
  const old = c.o;
  c.o = u.o;
  c.prod = null;
  c.lastPick = -9;
  c.b = c.b.filter((b) => b !== 'walls');
  c.food = 0;
  c.worked = [];
  if (c.size > 1) c.size--;
  for (const j of [c.i, ...ringTiles(c.i, 1)]) G.tiles[j].own = u.o;
  if (u.o === 0) {
    G.stats.captured++;
    bus.emit('sfx', 'war');
    bus.emit('fx', { type: 'burst', i: c.i, col: '#ffd166', n: 50 });
    bus.emit('fx', { type: 'text', i: c.i, text: `${c.name} captured!`, col: '#ffd166' });
    log(`You captured ${c.name}!`, 'good');
  } else if (old === 0) {
    G.stats.cityLost++;
    log(`${c.name} was captured by ${G.civs[u.o] ? G.civs[u.o].name : 'barbarians'}!`, 'bad');
  }
  checkElim(old);
}

/* ---------------- settlers & cities ---------------- */

export function canFound(u) {
  const t = G.tiles[u.i];
  if (!TERRAIN[t.t].pass) return 'Settlers must stand on land.';
  if (G.cities.some((c) => dist(c.i, u.i) < 4)) return 'Too close to another city (min. 4 tiles).';
  if (t.own >= 0 && t.own !== u.o) return 'Cannot found inside foreign borders.';
  return null;
}

export function makeCity(o, i, name, cap) {
  return {
    id: G.nid++, o, i, name, size: 1, food: 0, stock: 0, prod: { k: 'u', id: 'warrior' },
    b: [], w: [], worked: [], cs: 0, claimed: 0, cap: !!cap, lastPick: -9,
  };
}

export function foundCity(u) {
  const err = canFound(u);
  if (err) return err;
  const civ = G.civs[u.o];
  const n = G.cities.filter((c) => c.o === u.o).length;
  const names = civ.cityNames || CIVS[0].cityNames;
  const name = n < names.length ? names[n] : `${names[n % names.length]} ${Math.floor(n / names.length) + 1}`;
  G.cities.push(makeCity(u.o, u.i, name, n === 0));
  for (const j of [u.i, ...ringTiles(u.i, 1)]) if (G.tiles[j].own === -1) G.tiles[j].own = u.o;
  G.units = G.units.filter((v) => v.id !== u.id);
  if (u.o === 0) G.stats.founded++;
  bus.emit('fx', { type: 'burst', i: u.i, col: '#f6e05e', n: 34 });
  bus.emit('fx', { type: 'text', i: u.i, text: `${name} founded!`, col: '#f6e05e' });
  if (u.o === 0) bus.emit('sfx', 'found');
  log(`${civ.name} founded ${name}.`, u.o === 0 ? 'good' : '');
  updateVision();
  return null;
}

export function itemCost(c, p) {
  const civ = G.civs[c.o];
  if (p.k === 'u') {
    let v = UNITS[p.id].cost;
    if (civ.id === 'rome') v *= 0.85;
    return Math.max(1, Math.round(v));
  }
  if (p.k === 'b') return BUILDINGS[p.id].cost;
  let v = WONDERS[p.id].cost;
  if (p.id === 'pyramids' && civ.id === 'egypt') v *= 0.7;
  return Math.round(v);
}

export function itemName(p) {
  if (p.k === 'u') return UNITS[p.id].name;
  if (p.k === 'b') return BUILDINGS[p.id].name;
  return WONDERS[p.id].name;
}

export function availableItems(c) {
  const civ = G.civs[c.o];
  const res = civResources(c.o);
  const u = Object.keys(UNITS).filter((id) => {
    const d = UNITS[id];
    if (d.barb) return false;
    if (d.unique && d.unique !== civ.id) return false;
    if (!hasTech(civ, d.req)) return false;
    if (d.res && !res.has(d.res)) return false;
    return true;
  });
  const b = Object.keys(BUILDINGS).filter((id) => {
    const d = BUILDINGS[id];
    if (c.b.includes(id)) return false;
    if (!hasTech(civ, d.req)) return false;
    if (d.coastal && !isCoastal(c.i)) return false;
    return true;
  });
  const w = Object.keys(WONDERS).filter((id) => !G.wonders[id] && hasTech(civ, WONDERS[id].req));
  return { u, b, w };
}

export function setProduction(c, k, id) {
  const av = availableItems(c);
  const list = k === 'u' ? av.u : k === 'b' ? av.b : av.w;
  if (!list.includes(id)) return 'Not available.';
  c.prod = { k, id };
  c.lastPick = G.turn;
  return null;
}

function spawnSpot(c) {
  for (const j of nbrs(c.i)) {
    if (TERRAIN[G.tiles[j].t].pass && unitsAt(j).length === 0) return j;
  }
  if (!G.units.some((u) => u.i === c.i && atWar(c.o, u.o))) return c.i;
  return -1;
}

export function checkProduction(c) {
  if (!c.prod) c.prod = { k: 'u', id: 'warrior' };
  for (let g = 0; g < 3; g++) {
    const p = c.prod;
    if (p.k === 'w' && G.wonders[p.id]) { c.prod = { k: 'u', id: 'warrior' }; continue; }
    if (p.k === 'b' && c.b.includes(p.id)) { c.prod = { k: 'u', id: 'warrior' }; continue; }
    const cost = itemCost(c, p);
    if (c.stock < cost) break;
    if (p.k === 'u' && p.id === 'settler' && c.size < 2) break;
    if (p.k === 'u' && spawnSpot(c) < 0) break;
    c.stock -= cost;
    completeItem(c, p);
    if (p.k !== 'u') c.prod = { k: 'u', id: 'warrior' };
  }
}

function completeItem(c, p) {
  const civ = G.civs[c.o];
  const isP = c.o === 0;
  if (p.k === 'u') {
    const spot = spawnSpot(c);
    if (p.id === 'settler') c.size--;
    makeUnit(p.id, c.o, spot);
    if (isP) {
      bus.emit('sfx', 'build');
      bus.emit('fx', { type: 'text', i: c.i, text: `+1 ${UNITS[p.id].name}`, col: '#9ae6b4' });
    }
    if (isP && p.id !== 'warrior' && p.id !== 'worker') log(`${c.name} trained a ${UNITS[p.id].name}.`, 'good');
  } else if (p.k === 'b') {
    c.b.push(p.id);
    if (isP) {
      bus.emit('sfx', 'build');
      bus.emit('fx', { type: 'burst', i: c.i, col: '#90cdf4', n: 24 });
      bus.emit('fx', { type: 'text', i: c.i, text: `${BUILDINGS[p.id].name} built`, col: '#90cdf4' });
    }
    log(`${civ.name} completed ${BUILDINGS[p.id].name} in ${c.name}.`, isP ? 'good' : '');
  } else {
    G.wonders[p.id] = true;
    c.w.push(p.id);
    if (isP) {
      G.stats.wonders++;
      bus.emit('sfx', 'wonder');
      bus.emit('fx', { type: 'burst', i: c.i, col: '#ffd166', n: 90 });
      bus.emit('shake', { m: 6, t: 0.5 });
      bus.emit('fx', { type: 'text', i: c.i, text: `${WONDERS[p.id].name}!`, col: '#ffd166', big: true });
    }
    log(`${civ.name} completed the ${WONDERS[p.id].name} in ${c.name}!`, isP ? 'good' : '');
  }
}

export function buyCost(c) {
  if (!c.prod || c.prod.k === 'w') return null;
  const rem = Math.max(0, itemCost(c, c.prod) - c.stock);
  let g = Math.ceil(rem * 2 + (rem * rem) / 40);
  if (c.prod.k === 'u') g = Math.ceil(g * 1.3);
  return g;
}

export function buyItem(c) {
  const cost = buyCost(c);
  const civ = G.civs[c.o];
  if (cost === null) return 'Wonders cannot be bought.';
  if (civ.gold < cost) return `Need ${cost} gold.`;
  civ.gold -= cost;
  c.stock = Math.max(c.stock, itemCost(c, c.prod));
  checkProduction(c);
  if (c.o === 0) bus.emit('sfx', 'coin');
  return null;
}

function claimTerritory(c) {
  const thr = 12 + 4 * c.claimed;
  if (c.cs < thr) return;
  let best = -1, bd = 99;
  for (const j of ringTiles(c.i, 3)) {
    const t = G.tiles[j];
    if (t.own !== -1) continue;
    if (G.units.some((u) => u.i === j && atWar(c.o, u.o))) continue;
    const d = dist(c.i, j);
    if (d < bd) { bd = d; best = j; }
  }
  if (best < 0) { c.cs = Math.min(c.cs, thr); return; }
  G.tiles[best].own = c.o;
  c.cs -= thr;
  c.claimed++;
  if (c.o === 0) { bus.emit('fx', { type: 'claim', i: best }); bus.emit('sfx', 'claim'); }
}

export function assignWorkers(ci) {
  const cities = G.cities.filter((c) => c.o === ci);
  const used = new Set(G.cities.map((c) => c.i));
  for (const c of cities) c.worked = [];
  for (const c of cities) {
    const coastal = isCoastal(c.i);
    const cand = [];
    for (const j of ringTiles(c.i, 2)) {
      if (used.has(j)) continue;
      const t = G.tiles[j];
      if (t.own !== ci && t.own !== -1) continue;
      if (!TERRAIN[t.t].pass && !(t.t === 'ocean' && coastal)) continue;
      if (G.units.some((u) => u.i === j && atWar(ci, u.o))) continue;
      const y = tileYields(j);
      const sc = y.f * 1.6 + y.p * 1.2 + y.g * 1.0 + y.s * 0.8 + y.cu * 0.6;
      if (sc > 0) cand.push({ j, sc });
    }
    cand.sort((a, b) => b.sc - a.sc);
    for (const k of cand) {
      if (c.worked.length >= c.size) break;
      c.worked.push(k.j);
      used.add(k.j);
    }
  }
}

function processCity(c) {
  const civ = G.civs[c.o];
  const y = cityYields(c);
  const debt = civ.gold < 0 ? 0.75 : 1;
  c.stock += Math.round(y.p * civ.mult.p * debt);
  c.food += y.surplus;
  if (c.food >= y.need) {
    if (c.size < y.cap) {
      c.size++;
      c.food = 0;
      if (c.o === 0) { bus.emit('sfx', 'growth'); bus.emit('fx', { type: 'text', i: c.i, text: 'Growth!', col: '#9ae6b4' }); }
    } else c.food = y.need;
  }
  if (c.food < 0) {
    if (c.size > 1) {
      c.size--;
      c.food = 0;
      if (c.o === 0) log(`Famine in ${c.name}: population dropped.`, 'bad');
    } else c.food = 0;
  }
  c.cs += y.cu * civ.mult.cu;
  claimTerritory(c);
  checkProduction(c);
  return y;
}

/* ---------------- civ economy & turn processing ---------------- */

function learn(civ, id) {
  civ.researched.push(id);
  civ.researching = null;
  const t = TECH[id];
  if (civ.i === 0) {
    G.stats.techs++;
    bus.emit('sfx', 'tech');
    const c0 = G.cities.find((c) => c.o === 0);
    if (c0) bus.emit('fx', { type: 'text', i: c0.i, text: `${t.name} learned!`, col: '#90cdf4' });
  }
  log(`${civ.name} discovered ${t.name}.`, civ.i === 0 ? 'good' : '');
  bus.emit('tech', { civ: civ.i, id });
}

export function processCivEconomy(ci) {
  const civ = G.civs[ci];
  if (!civ || !civ.alive) return;
  assignWorkers(ci);
  let gold = 0, sci = 0, cul = 0;
  const cities = G.cities.filter((c) => c.o === ci);
  for (const c of cities) {
    const y = processCity(c);
    gold += y.g;
    sci += y.s;
    cul += y.cu;
  }
  let upB = 0;
  for (const c of cities) for (const b of c.b) upB += BUILDINGS[b].up || 0;
  const units = G.units.filter((u) => u.o === ci).length;
  const upU = Math.max(0, units - (cities.length * 2 + 2));
  const deals = G.deals.filter((d) => d.a === ci || d.b === ci).length * 3;
  const allies = G.civs.filter((o) => o.i !== ci && o.alive && G.rel[ci][o.i] === 'ally').length * 2;
  const net = gold * civ.mult.g + deals + allies - upB - upU;
  civ.gold = Math.round((civ.gold + net) * 10) / 10;
  civ.perTurn = { gold: Math.round(net * 10) / 10, sci: Math.round(sci * civ.mult.s), cul: Math.round(cul * civ.mult.cu * 10) / 10 };
  civ.bulbs += sci * civ.mult.s;
  civ.culture += cul * civ.mult.cu;
  if (ci === 0) G.stats.goldEarned += Math.max(0, Math.round(gold));
  for (const u of G.units) {
    if (u.o === ci && u.type === 'worker' && u.job && u.job.i === u.i) {
      u.job.p++;
      if (u.job.p >= IMPROVEMENTS[u.job.t].turns) {
        G.tiles[u.i].imp = u.job.t;
        u.job = null;
        if (ci === 0) {
          bus.emit('sfx', 'build');
          bus.emit('fx', { type: 'text', i: u.i, text: `${IMPROVEMENTS[G.tiles[u.i].imp].name} done`, col: '#9ae6b4' });
          log(`Worker finished a ${IMPROVEMENTS[G.tiles[u.i].imp].name}.`, 'good');
        }
      }
    }
  }
  if (civ.researching) {
    const cost = techCost(civ.researching);
    if (civ.bulbs >= cost) {
      civ.bulbs -= cost;
      learn(civ, civ.researching);
    }
  }
  if (ci === 0) {
    const pop = cities.reduce((a, c) => a + c.size, 0);
    if (pop > G.stats.peakPop) G.stats.peakPop = pop;
  }
  checkElim(ci);
}

export function startBuild(u, imp) {
  const I = IMPROVEMENTS[imp];
  if (!I) return 'Unknown improvement.';
  const t = G.tiles[u.i];
  if (cityAt(u.i)) return 'Cannot improve a city center.';
  if (t.own !== u.o) return 'Tile must be inside your borders.';
  if (!I.on.includes(t.t)) return `${I.name} cannot be built on ${TERRAIN[t.t].name}.`;
  if (t.imp) return 'Tile already improved.';
  if (I.req && !G.civs[u.o].researched.includes(I.req)) return `Requires ${TECH[I.req].name}.`;
  u.job = { t: imp, i: u.i, p: 0 };
  u.busy = true;
  return null;
}

export function checkElim(ci) {
  const civ = G.civs[ci];
  if (!civ || !civ.alive) return;
  const has = G.cities.some((c) => c.o === ci) || G.units.some((u) => u.o === ci && u.type === 'settler');
  if (!has) {
    civ.alive = false;
    G.units = G.units.filter((u) => u.o !== ci);
    log(`${civ.name} has been destroyed!`, ci === 0 ? 'bad' : 'good');
  }
}

export function beginTurnUnits() {
  for (const u of G.units) {
    const d = UNITS[u.type];
    u.mp = d.mv;
    if (!u.busy) {
      const c = cityAt(u.i);
      const inC = !!c && c.o === u.o;
      u.hp = Math.min(100, u.hp + (inC ? 30 : 10));
    }
    u.busy = false;
  }
}

export function updateVision() {
  if (!G.tiles || !G.tiles.length) return;
  const n = G.W * G.H;
  const vis = new Array(n).fill(0);
  if (!G.opts.fog) vis.fill(1);
  else {
    for (const u of G.units) if (u.o === 0) reveal(vis, u.i, 2);
    for (const c of G.cities) if (c.o === 0) reveal(vis, c.i, 3);
  }
  G.vis = vis;
  if (!G.exp || G.exp.length !== n) G.exp = new Array(n).fill(0);
  for (let k = 0; k < n; k++) if (vis[k]) G.exp[k] = 1;
}
function reveal(vis, i, r) {
  vis[i] = 1;
  for (const j of ringTiles(i, r)) vis[j] = 1;
}

export function civScore(ci) {
  const civ = G.civs[ci];
  const cs = G.cities.filter((c) => c.o === ci);
  const pop = cs.reduce((a, c) => a + c.size, 0);
  const w = cs.reduce((a, c) => a + c.w.length, 0);
  const units = G.units.filter((u) => u.o === ci).length;
  return Math.round(cs.length * 10 + pop * 2 + civ.researched.length * 4 + w * 15 + civ.culture / 4 + units * 0.5);
}

export function log(text, type = '') {
  G.log.push({ t: G.turn, text, type });
  if (G.log.length > 150) G.log.shift();
  bus.emit('log', { text, type });
}

function finish(win, type, text, winner) {
  G.over = true;
  G.result = { win, type, text, winner, turn: G.turn };
  return G.result;
}

export function checkVictory() {
  if (G.over) return null;
  const P = G.civs[0];
  if (!P.alive) return finish(false, 'defeat', 'Your civilization has fallen. Every city is lost.', -1);
  for (const c of G.civs) {
    if (c.alive && c.researched.includes('space') && G.opts.sci) {
      return finish(c.i === 0, 'science', c.i === 0 ? 'Your Space Flight launched the first starship to orbit Mars.' : `${c.name} reached Space Flight first and won the Space Race.`, c.i);
    }
  }
  if (G.continued) return null;
  if (G.opts.cul) {
    for (const c of G.civs) {
      if (c.alive && c.culture >= G.cultureGoal) {
        return finish(c.i === 0, 'culture', c.i === 0 ? `Your culture reached ${Math.round(G.cultureGoal)} points. Your legend endures.` : `${c.name} achieved cultural dominance.`, c.i);
      }
    }
  }
  const rivals = G.civs.filter((c) => c.i > 0 && c.alive);
  if (!rivals.length) return finish(true, 'domination', 'All rival civilizations have been conquered.', 0);
  if (G.turn >= MAX_TURN) {
    const alive = G.civs.filter((c) => c.alive);
    const top = alive.slice().sort((a, b) => civScore(b.i) - civScore(a.i))[0];
    return finish(top.i === 0, 'time', top.i === 0 ? 'Time is up — your civilization leads in score.' : `Time is up. ${top.name} leads in score.`, top.i);
  }
  return null;
}

/* ---------------- map generation & game setup ---------------- */

function makeCiv(d, i, diff, perks) {
  const P = i === 0;
  const mult = { f: 1, p: P ? diff.player.p : diff.ai.p, g: P ? 1 : diff.ai.g, s: P ? diff.player.s : diff.ai.s, cu: 1 };
  if (P && perks.scholars) mult.s *= 1.15;
  if (P && perks.heritage) mult.cu *= 1.15;
  if (d.id === 'china') mult.s *= 1.25;
  return {
    i, id: d.id, name: d.name, leader: d.leader, col: d.col, icon: d.icon, unique: d.unique,
    cityNames: d.cityNames, ai: !P, alive: true,
    gold: P ? 20 + (perks.treasury ? 30 : 0) : 20, bulbs: 0, researching: null,
    researched: P && perks.quick ? ['pottery', 'bronze'] : [], culture: 0, mult,
    op: 30, perTurn: { gold: 0, sci: 0, cul: 0 },
  };
}

export function newGame(o) {
  for (const k of Object.keys(G)) delete G[k];
  const size = MAP_SIZES[o.size] || MAP_SIZES.standard;
  const diff = DIFFICULTY[o.diff] || DIFFICULTY.monarch;
  const seed = (o.seed === undefined || o.seed === null || o.seed === '' ? Math.floor(Math.random() * 1e9) : o.seed) >>> 0;
  const map = generateMap(o.size, seed);
  const rnd = mulberry(seed ^ 0x9e3779b9);
  const pIdx = Math.max(0, CIVS.findIndex((c) => c.id === o.civ));
  const others = shuffle(CIVS.filter((c, i) => i !== pIdx), rnd);
  const defs = [CIVS[pIdx], ...others.slice(0, 3)];
  const perks = o.perks || {};
  Object.assign(G, {
    seed, size: o.size, diff: o.diff, W: map.W, H: map.H, tiles: map.tiles, starts: map.starts,
    civs: [], cities: [], units: [], camps: [], wonders: {}, rel: [], deals: [],
    turn: 1, nid: 1, log: [], vis: [], exp: new Array(map.W * map.H).fill(0),
    stats: { founded: 0, captured: 0, cityLost: 0, kills: 0, lost: 0, camps: 0, wonders: 0, techs: 0, goldEarned: 0, peakPop: 1 },
    over: false, result: null, continued: false, cultureGoal: diff.cul,
    opts: { fog: !!o.fog, barb: !!o.barb, sci: !!o.sci, cul: !!o.cul, tutorial: !!o.tutorial },
    perks, tutStep: 0,
  });
  G.civs = defs.map((d, i) => makeCiv(d, i, diff, perks));
  G.rel = defs.map(() => defs.map(() => 'peace'));
  G.civs.forEach((civ, i) => {
    const s = map.starts[i];
    const near = () => nbrs(s).find((j) => TERRAIN[G.tiles[j].t].pass && unitsAt(j).length === 0) ?? s;
    if (i === 0) {
      makeUnit('settler', 0, s);
      makeUnit('warrior', 0, near());
      makeUnit('worker', 0, near());
      if (perks.militia) makeUnit('warrior', 0, near());
      if (perks.surveyors) makeUnit('worker', 0, near());
    } else {
      makeUnit('settler', i, s);
      const st = G.units[G.units.length - 1];
      foundCity(st);
      makeUnit('warrior', i, near());
      makeUnit('worker', i, near());
    }
  });
  if (G.opts.barb) {
    const cands = G.tiles.filter((t) => TERRAIN[t.t].pass && map.starts.every((s) => dist(s, t.i) >= 5));
    shuffle(cands, rnd);
    for (const t of cands) {
      if (G.camps.length >= size.camps) break;
      if (G.camps.every((cp) => dist(cp.i, t.i) >= 5)) {
        G.camps.push({ id: G.nid++, i: t.i, hp: 90, o: -1, cd: 2 });
      }
    }
  }
  updateVision();
  log(`A new age begins. You lead ${G.civs[0].name} on a ${size.name.toLowerCase()} world.`, 'good');
  return G;
}

export function setRel(a, b, status) {
  G.rel[a][b] = status;
  G.rel[b][a] = status;
}

export function applyDefaults(o) {
  return { civ: 0, size: 'standard', diff: 'monarch', fog: true, barb: true, sci: true, cul: true, tutorial: true, perks: {}, ...o };
}
