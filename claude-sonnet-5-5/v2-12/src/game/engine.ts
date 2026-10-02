import { UNITS, UType, LevelDef, computeStats, Stats, DiffDef, DIFFS, MODS, TUT_STEPS, TEAM_COLOR } from './data';
import { RosterUnit, Settings } from './save';
import { audio } from './audio';

export type Dir = [number, number];
export const D8: Dir[] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
export const KN: Dir[] = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];

export interface Unit {
  id: number;
  rid?: string;
  team: 'p' | 'e';
  type: UType;
  name: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  hp: number;
  maxHp: number;
  stats: Stats;
  promo: string[];
  moved: boolean;
  acted: boolean;
  brace: boolean;
  prev: { x: number; y: number } | null;
  alive: boolean;
  xpGain: number;
  kills: number;
  flash: number;
  pop: number;
}
export interface Anom { x: number; y: number; m: number; kind: 'well' | 'rep' | 'hole' | 'pwell' | 'prep' | 'bwell'; ttl?: number }
export interface Reach { x: number; y: number; cost: number }
export interface AttackOpt { dir: Dir; path: [number, number][]; targets: Unit[]; hitDirs: Dir[]; lob: boolean }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
export interface Floater { x: number; y: number; text: string; color: string; life: number; size: number }
export interface Beam { path: [number, number][]; life: number; color: string }
export interface Ring { x: number; y: number; r: number; life: number; color: string; max: number }

export interface Game {
  W: number;
  H: number;
  lvl: LevelDef;
  terrain: string[][];
  anoms: Anom[];
  units: Unit[];
  nextId: number;
  round: number;
  phase: 'player' | 'enemy' | 'drift' | 'over';
  over: null | 'win' | 'lose';
  overT: number;
  resultReady: boolean;
  energy: number;
  maxEnergy: number;
  pulseDur: number;
  pulseStr: number;
  driftBonus: number;
  gs: number;
  diff: DiffDef;
  mods: string[];
  sel: Unit | null;
  moveMap: Map<string, Reach>;
  attacks: AttackOpt[];
  mode: 'idle' | 'pulse';
  pulseKind: 'well' | 'rep';
  hover: { x: number; y: number } | null;
  cursor: { x: number; y: number };
  showField: boolean;
  enemyQueue: Unit[];
  pending: { u: Unit; opt: AttackOpt; tgt: Unit } | null;
  timer: number;
  stage: 'begin' | 'units';
  driftDone: boolean;
  telegraph: { x: number; y: number } | null;
  particles: Particle[];
  floaters: Floater[];
  beams: Beam[];
  rings: Ring[];
  shake: number;
  time: number;
  banner: { text: string; sub: string; t: number } | null;
  stats: { kills: number; losses: number; dmgDealt: number; dmgTaken: number; hazardKills: number; pulses: number; collisions: number; maxHit: number };
  tut: number;
  tutOn: boolean;
  shakeOn: boolean;
  pf: number;
  intensity: number;
  intT: number;
  deployed: string[];
  notify: () => void;
}

export interface GameInit {
  lvl: LevelDef;
  roster: RosterUnit[];
  deployed: string[];
  settings: Settings;
  research: Record<string, number>;
  tutOn: boolean;
  notify: () => void;
}

const key = (x: number, y: number) => x + ',' + y;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const inb = (G: Game, x: number, y: number) => x >= 0 && y >= 0 && x < G.W && y < G.H;
export const terr = (G: Game, x: number, y: number) => (inb(G, x, y) ? G.terrain[y][x] : '#');
export const massOf = (u: Unit) => u.stats.mass + (u.brace ? 3 : 0);
export const unitAt = (G: Game, x: number, y: number) => G.units.find((u) => u.alive && u.x === x && u.y === y) || null;
const hasFlag = (u: Unit, f: string) => (u.stats.flags as string[]).includes(f);

export function snapDir(vx: number, vy: number): Dir {
  const idx = Math.round(Math.atan2(vy, vx) / (Math.PI / 4));
  return D8[((idx % 8) + 8) % 8];
}

export function fieldAt(G: Game, x: number, y: number, ex?: Unit | null): [number, number] {
  let fx = 0;
  let fy = 0;
  for (const a of G.anoms) {
    const dx = a.x - x;
    const dy = a.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 0.01) continue;
    const d = Math.sqrt(d2);
    const f = (a.m * G.gs) / d2;
    fx += (f * dx) / d;
    fy += (f * dy) / d;
  }
  for (const u of G.units) {
    if (!u.alive || u === ex) continue;
    const dx = u.x - x;
    const dy = u.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 < 0.01) continue;
    const d = Math.sqrt(d2);
    const f = (massOf(u) * G.gs) / d2;
    fx += (f * dx) / d;
    fy += (f * dy) / d;
  }
  return [fx, fy];
}

// ---------- FX helpers ----------
export function floater(G: Game, x: number, y: number, text: string, color = '#fff', size = 1) {
  G.floaters.push({ x, y, text, color, life: 1.2, size });
  if (G.floaters.length > 60) G.floaters.shift();
}
export function burst(G: Game, x: number, y: number, color: string, n: number, speed = 3) {
  const count = Math.ceil(n * G.pf);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random());
    const life = 0.4 + Math.random() * 0.6;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color, size: 0.04 + Math.random() * 0.06 });
  }
  if (G.particles.length > 700) G.particles.splice(0, G.particles.length - 700);
}
function ring(G: Game, x: number, y: number, color: string, max = 2) {
  G.rings.push({ x, y, r: 0, life: 0.6, color, max });
}
function shake(G: Game, v: number) {
  if (G.shakeOn) G.shake = Math.max(G.shake, v);
}
function banner(G: Game, text: string, sub = '') {
  G.banner = { text, sub, t: 1.6 };
}
function tutEvent(G: Game, name: string) {
  if (G.tutOn && TUT_STEPS[G.tut] === name) {
    G.tut++;
    G.notify();
  }
}

// ---------- creation ----------
function makeUnit(G: Game, team: 'p' | 'e', type: UType, x: number, y: number, ru?: RosterUnit, research?: Record<string, number>): Unit {
  const promo = ru ? ru.promo : [];
  const stats = computeStats(type, promo);
  if (team === 'p' && type === 'core') stats.hp += 3 * ((research && research.armor) || 0);
  if (team === 'e') {
    stats.hp = Math.max(1, Math.round(stats.hp * G.diff.hp * (1 + 0.03 * (G.lvl.id - 1))));
    stats.atk += G.diff.atk + (G.lvl.id >= 6 ? 1 : 0);
  }
  const u: Unit = {
    id: G.nextId++, rid: ru?.id, team, type, name: ru ? ru.name : UNITS[type].name, x, y, rx: x, ry: y,
    hp: stats.hp, maxHp: stats.hp, stats, promo: [...promo], moved: false, acted: false, brace: false, prev: null,
    alive: true, xpGain: 0, kills: 0, flash: 0, pop: team === 'e' ? 0 : 1,
  };
  G.units.push(u);
  return u;
}

const SPAWNS: [number, number][] = [[3, 7], [4, 7], [2, 7], [5, 7], [3, 6], [4, 6], [2, 6], [5, 6], [1, 7], [6, 7], [1, 6], [6, 6], [0, 7], [7, 7], [0, 6], [7, 6]];

export function createGame(init: GameInit): Game {
  const { lvl, roster, deployed, settings, research } = init;
  const diff = DIFFS.find((d) => d.id === settings.diff) || DIFFS[1];
  const H = lvl.map.length;
  const W = lvl.map[0].length;
  const terrain = lvl.map.map((row) => row.split(''));
  const anoms: Anom[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = terrain[y][x];
      if (c === 'W') anoms.push({ x, y, m: 6, kind: 'well' });
      else if (c === 'R') anoms.push({ x, y, m: -5, kind: 'rep' });
      else if (c === 'H') anoms.push({ x, y, m: 8, kind: 'hole' });
    }
  const rl = (id: string) => research[id] || 0;
  const maxEnergy = 4 + rl('flux');
  const G: Game = {
    W, H, lvl, terrain, anoms, units: [], nextId: 1, round: 1, phase: 'player', over: null, overT: 0, resultReady: false,
    energy: Math.min(maxEnergy, 2 + rl('flux') + diff.energy), maxEnergy, pulseDur: 3 + rl('dur'), pulseStr: 5 + 2 * rl('seed'),
    driftBonus: 0.3 * rl('orbit'), gs: settings.mods.includes('heavy') ? 1.5 : 1, diff, mods: settings.mods,
    sel: null, moveMap: new Map(), attacks: [], mode: 'idle', pulseKind: 'well', hover: null, cursor: { x: Math.floor(W / 2), y: H - 2 },
    showField: false, enemyQueue: [], pending: null, timer: 0, stage: 'begin', driftDone: false, telegraph: null,
    particles: [], floaters: [], beams: [], rings: [], shake: 0, time: 0, banner: null,
    stats: { kills: 0, losses: 0, dmgDealt: 0, dmgTaken: 0, hazardKills: 0, pulses: 0, collisions: 0, maxHit: 0 },
    tut: 0, tutOn: init.tutOn, shakeOn: settings.shake, pf: settings.particles === 0 ? 0.4 : 1, intensity: 0.2, intT: 0,
    deployed, notify: init.notify,
  };
  // player units
  const ids = new Set(deployed);
  const core = roster.find((r) => r.type === 'core');
  const list = roster.filter((r) => ids.has(r.id) && r.type !== 'core');
  const ordered = core ? [core, ...list] : list;
  let si = 0;
  for (const ru of ordered) {
    while (si < SPAWNS.length) {
      const [sx, sy] = SPAWNS[si++];
      if (sy < H && sx < W && (terrain[sy][sx] === '.' || terrain[sy][sx] === 'N')) {
        makeUnit(G, 'p', ru.type, sx, sy, ru, research);
        break;
      }
    }
  }
  for (const [t, x, y] of lvl.enemies) {
    if (inb(G, x, y) && !unitAt(G, x, y)) makeUnit(G, 'e', t, x, y);
  }
  const extras: [number, number][] = [[0, 1], [7, 1], [1, 2], [6, 2], [2, 2], [5, 2]];
  let ex = 0;
  for (const [x, y] of extras) {
    if (ex >= diff.extra) break;
    if (terr(G, x, y) === '.' && !unitAt(G, x, y)) {
      makeUnit(G, 'e', 'mote', x, y);
      ex++;
    }
  }
  G.units.forEach((u) => {
    if (u.team === 'e') u.pop = 0;
  });
  banner(G, 'ROUND 1', lvl.name);
  return G;
}

// ---------- movement ----------
function stepCost(G: Game, u: Unit, fx: number, fy: number, dx: number, dy: number, tx: number, ty: number): number {
  let c = 1;
  if (!hasFlag(u, 'ghost')) {
    const dot = (fx * dx + fy * dy) / Math.hypot(dx, dy);
    const inertia = 1 / (0.5 + 0.25 * massOf(u));
    c = clamp(1 - 0.18 * inertia * dot, 0.5, 2.5);
  }
  if (terr(G, tx, ty) === 'N') c += 0.8;
  return c;
}
const passable = (G: Game, x: number, y: number) => inb(G, x, y) && terr(G, x, y) !== '#' && terr(G, x, y) !== 'H';

export function reachList(G: Game, u: Unit): Reach[] {
  const best = new Map<string, Reach>();
  const lim = u.stats.move + 1e-6;
  const add = (x: number, y: number, c: number) => {
    const k = key(x, y);
    const o = best.get(k);
    if (!o || c < o.cost) best.set(k, { x, y, cost: c });
  };
  const pat = UNITS[u.type].mpat;
  if (pat === 'step') {
    const dist = new Map<string, number>([[key(u.x, u.y), 0]]);
    const q: Reach[] = [{ x: u.x, y: u.y, cost: 0 }];
    while (q.length) {
      q.sort((a, b) => a.cost - b.cost);
      const n = q.shift()!;
      if (n.cost > (dist.get(key(n.x, n.y)) ?? Infinity)) continue;
      const [fx, fy] = fieldAt(G, n.x, n.y, u);
      for (const [dx, dy] of D8) {
        const nx = n.x + dx;
        const ny = n.y + dy;
        if (!passable(G, nx, ny) || unitAt(G, nx, ny)) continue;
        const c = n.cost + stepCost(G, u, fx, fy, dx, dy, nx, ny);
        if (c > lim) continue;
        if (c < (dist.get(key(nx, ny)) ?? Infinity)) {
          dist.set(key(nx, ny), c);
          q.push({ x: nx, y: ny, cost: c });
          add(nx, ny, c);
        }
      }
    }
  } else if (pat === 'knight') {
    const [fx, fy] = fieldAt(G, u.x, u.y, u);
    for (const [dx, dy] of KN) {
      const nx = u.x + dx;
      const ny = u.y + dy;
      if (!passable(G, nx, ny) || unitAt(G, nx, ny)) continue;
      let c = 1.6;
      if (hasFlag(u, 'ghost')) c = 1.4;
      else {
        const inertia = 1 / (0.5 + 0.25 * massOf(u));
        c = clamp(1.6 - 0.25 * inertia * ((fx * dx + fy * dy) / Math.hypot(dx, dy)), 0.8, 3);
      }
      if (terr(G, nx, ny) === 'N') c += 0.8;
      if (c <= lim) add(nx, ny, c);
    }
  } else {
    const dirs = D8.filter((_, i) => (pat === 'orth' ? i % 2 === 0 : pat === 'diag' ? i % 2 === 1 : true));
    for (const [dx, dy] of dirs) {
      let x = u.x;
      let y = u.y;
      let c = 0;
      for (let i = 0; i < 16; i++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!passable(G, nx, ny) || unitAt(G, nx, ny)) break;
        const [fx, fy] = fieldAt(G, x, y, u);
        c += stepCost(G, u, fx, fy, dx, dy, nx, ny);
        if (c > lim) break;
        add(nx, ny, c);
        x = nx;
        y = ny;
      }
    }
  }
  return [...best.values()];
}
export function reachMap(G: Game, u: Unit): Map<string, Reach> {
  const m = new Map<string, Reach>();
  reachList(G, u).forEach((r) => m.set(key(r.x, r.y), r));
  return m;
}

// ---------- attacks ----------
export function traceBeam(G: Game, u: Unit, dir: Dir, range: number) {
  let x = u.x;
  let y = u.y;
  let d: Dir = dir;
  const path: [number, number][] = [[x, y]];
  const hits: Unit[] = [];
  const hitDirs: Dir[] = [];
  const lens = hasFlag(u, 'lens');
  const pierce = hasFlag(u, 'pierce');
  for (let i = 0; i < range; i++) {
    x += d[0];
    y += d[1];
    if (!inb(G, x, y) || terr(G, x, y) === '#') break;
    path.push([x, y]);
    const o = unitAt(G, x, y);
    if (o) {
      if (o === u || o.team === u.team) break;
      hits.push(o);
      hitDirs.push(d);
      if (!pierce || hits.length >= 2) break;
    }
    if (!lens) {
      const [fx, fy] = fieldAt(G, x, y, u);
      d = snapDir(d[0] + fx * 0.35, d[1] + fy * 0.35);
    }
  }
  return { path, hits, hitDirs };
}

export function attackOptions(G: Game, u: Unit): AttackOpt[] {
  const out: AttackOpt[] = [];
  const a = UNITS[u.type].adirs;
  if (a === 'knight') {
    for (const k of KN) {
      const t = unitAt(G, u.x + k[0], u.y + k[1]);
      if (t && t.team !== u.team) out.push({ dir: k, path: [[u.x, u.y], [t.x, t.y]], targets: [t], hitDirs: [snapDir(k[0], k[1])], lob: true });
    }
    return out;
  }
  const dirs = D8.filter((_, i) => (a === 'orth' ? i % 2 === 0 : a === 'diag' ? i % 2 === 1 : true));
  for (const d of dirs) {
    const tr = traceBeam(G, u, d, u.stats.range);
    if (tr.hits.length) out.push({ dir: d, path: tr.path, targets: tr.hits, hitDirs: tr.hitDirs, lob: false });
  }
  return out;
}

export function findOpt(opts: AttackOpt[], t: Unit): AttackOpt | null {
  return opts.find((o) => o.targets[0] === t) || opts.find((o) => o.targets.includes(t)) || null;
}

export function calcDamage(G: Game, att: Unit, tgt: Unit, opt: AttackOpt, idx: number): number {
  let d = att.stats.atk;
  if (!opt.lob) {
    const [fx, fy] = fieldAt(G, att.x, att.y, att);
    const dot = (fx * opt.dir[0] + fy * opt.dir[1]) / Math.hypot(opt.dir[0], opt.dir[1]);
    if (dot > 1.2) d += 1;
    else if (dot < -1.2) d -= 1;
  }
  if (terr(G, tgt.x, tgt.y) === 'N' && Math.max(Math.abs(att.x - tgt.x), Math.abs(att.y - tgt.y)) > 1) d -= 1;
  if (idx > 0) d = Math.ceil(d / 2);
  d -= tgt.stats.armor;
  return Math.max(1, d);
}

function impulseVec(att: Unit, tgt: Unit, opt: AttackOpt, idx: number): Dir | null {
  let imp = att.stats.impulse;
  if (hasFlag(att, 'push')) imp = 'push';
  else if (hasFlag(att, 'pull')) imp = 'pull';
  if (imp === 'none' || hasFlag(tgt, 'anchor')) return null;
  if (massOf(att) < massOf(tgt) - 1) return null;
  const d = opt.hitDirs[idx] || opt.dir;
  return imp === 'push' ? d : [-d[0], -d[1]];
}

function grantXp(src: Unit | null, n: number) {
  if (src && src.team === 'p') src.xpGain += n;
}

export function hurt(G: Game, t: Unit, dmg: number, src: Unit | null, cause = 'attack') {
  if (!t.alive) return;
  t.hp -= dmg;
  t.flash = 1;
  if (t.team === 'e') G.stats.dmgDealt += dmg;
  else G.stats.dmgTaken += dmg;
  G.stats.maxHit = Math.max(G.stats.maxHit, dmg);
  floater(G, t.x, t.y - 0.2, '-' + dmg, t.team === 'e' ? '#ffd24f' : '#ff6b6b', dmg >= 4 ? 1.4 : 1);
  burst(G, t.x, t.y, TEAM_COLOR[t.team], 8 + dmg * 2, 3);
  shake(G, 0.15 + dmg * 0.05);
  if (cause === 'attack') grantXp(src, 1);
  if (t.hp <= 0) kill(G, t, src, cause);
  else audio.sfx('hit');
}

export function kill(G: Game, t: Unit, src: Unit | null, cause: string) {
  if (!t.alive) return;
  t.alive = false;
  t.hp = 0;
  if (G.sel === t) clearSel(G);
  const big = UNITS[t.type].boss;
  burst(G, t.x, t.y, TEAM_COLOR[t.team], big ? 90 : 30, big ? 7 : 4.5);
  ring(G, t.x, t.y, TEAM_COLOR[t.team], big ? 5 : 2);
  shake(G, big ? 1.2 : 0.5);
  if (t.team === 'e') {
    G.stats.kills++;
    if (src) {
      src.kills++;
      grantXp(src, big ? 8 : 3);
      if (hasFlag(src, 'vamp') && src.alive) {
        src.hp = Math.min(src.maxHp, src.hp + 2);
        floater(G, src.x, src.y - 0.3, '+2', '#6bff9a');
      }
    }
    if (cause === 'hole') {
      G.stats.hazardKills++;
      floater(G, t.x, t.y - 0.5, 'SWALLOWED', '#c58bff', 1.2);
    }
  } else {
    G.stats.losses++;
    if (cause === 'hole') floater(G, t.x, t.y - 0.5, 'LOST TO THE VOID', '#ff6b6b', 1.2);
  }
  audio.sfx(cause === 'hole' ? 'hole' : big ? 'boom' : 'kill');
  checkEnd(G);
}

function displace(G: Game, t: Unit, dx: number, dy: number, src: Unit | null) {
  if (!t.alive) return;
  const nx = t.x + dx;
  const ny = t.y + dy;
  if (!inb(G, nx, ny)) {
    floater(G, t.x, t.y, 'SLAM', '#ffb04f');
    hurt(G, t, 1, src, 'slam');
    return;
  }
  if (terr(G, nx, ny) === '#') {
    floater(G, t.x, t.y, 'CRUSH', '#ffb04f');
    hurt(G, t, 2, src, 'slam');
    return;
  }
  const o = unitAt(G, nx, ny);
  if (o) {
    G.stats.collisions++;
    floater(G, (t.x + nx) / 2, (t.y + ny) / 2, 'COLLISION', '#ffb04f');
    hurt(G, t, 1, src, 'slam');
    hurt(G, o, 1, src, 'slam');
    return;
  }
  t.x = nx;
  t.y = ny;
  t.prev = null;
  if (terr(G, nx, ny) === 'H') kill(G, t, src, 'hole');
}

export function performAttack(G: Game, att: Unit, opt: AttackOpt) {
  att.acted = true;
  att.moved = true;
  att.prev = null;
  G.beams.push({ path: opt.path.map((p) => [p[0], p[1]] as [number, number]), life: 0.4, color: TEAM_COLOR[att.team] });
  audio.sfx(opt.lob ? 'lob' : 'beam');
  const targets = [...opt.targets];
  targets.forEach((t, i) => {
    if (!t.alive) return;
    const dmg = calcDamage(G, att, t, opt, i);
    const imp = impulseVec(att, t, opt, i);
    hurt(G, t, dmg, att);
    if (t.alive && imp) displace(G, t, imp[0], imp[1], att);
  });
  if (att.team === 'p') {
    tutEvent(G, 'act');
    clearSel(G);
  }
  checkEnd(G);
  G.notify();
}

// ---------- drift ----------
export interface DriftInfo { u: Unit; dx: number; dy: number; nx: number; ny: number; mag: number; fate: 'move' | 'hole' | 'collide' }
export const driftThreshold = (G: Game, u: Unit) => 0.45 * massOf(u) + 0.4 + G.driftBonus;

export function driftOf(G: Game, u: Unit): DriftInfo | null {
  if (!u.alive || hasFlag(u, 'anchor')) return null;
  const [fx, fy] = fieldAt(G, u.x, u.y, u);
  const mag = Math.hypot(fx, fy);
  if (mag < driftThreshold(G, u)) return null;
  const [dx, dy] = snapDir(fx, fy);
  const nx = u.x + dx;
  const ny = u.y + dy;
  if (!inb(G, nx, ny) || terr(G, nx, ny) === '#') return null;
  const o = unitAt(G, nx, ny);
  if (o && o !== u && o.team === u.team) return null; // allies simply press against each other
  const fate = o && o !== u ? 'collide' : terr(G, nx, ny) === 'H' ? 'hole' : 'move';
  return { u, dx, dy, nx, ny, mag, fate };
}
export function driftPlan(G: Game): DriftInfo[] {
  const out: DriftInfo[] = [];
  for (const u of G.units) {
    const d = driftOf(G, u);
    if (d) out.push(d);
  }
  return out;
}

function applyDrift(G: Game) {
  const plan = driftPlan(G).sort((a, b) => b.mag - a.mag);
  let any = false;
  for (const p of plan) {
    const u = p.u;
    if (!u.alive) continue;
    const nx = u.x + p.dx;
    const ny = u.y + p.dy;
    if (!inb(G, nx, ny) || terr(G, nx, ny) === '#') continue;
    const o = unitAt(G, nx, ny);
    if (o && o !== u) {
      if (o.team !== u.team) {
        G.stats.collisions++;
        floater(G, (u.x + nx) / 2, (u.y + ny) / 2, 'RAM', '#ffb04f');
        hurt(G, u, 1, o, 'slam');
        hurt(G, o, 1, u, 'slam');
      }
      continue;
    }
    u.x = nx;
    u.y = ny;
    any = true;
    floater(G, u.x, u.y - 0.4, '~', '#8fb4ff', 0.9);
    if (terr(G, nx, ny) === 'H') kill(G, u, null, 'hole');
  }
  if (any) audio.sfx('drift');
}

// ---------- selection & player actions ----------
export function clearSel(G: Game) {
  G.sel = null;
  G.moveMap = new Map();
  G.attacks = [];
}
export function selectUnit(G: Game, u: Unit) {
  G.sel = u;
  G.mode = 'idle';
  G.moveMap = u.moved ? new Map() : reachMap(G, u);
  G.attacks = attackOptions(G, u);
  G.cursor = { x: u.x, y: u.y };
  audio.sfx('select');
  tutEvent(G, 'select');
  G.notify();
}
function refreshSel(G: Game) {
  const u = G.sel;
  if (!u) return;
  G.moveMap = u.moved ? new Map() : reachMap(G, u);
  G.attacks = attackOptions(G, u);
}

export function moveUnit(G: Game, u: Unit, r: Reach) {
  u.prev = { x: u.x, y: u.y };
  burst(G, u.x, u.y, TEAM_COLOR[u.team], 6, 1.5);
  u.x = r.x;
  u.y = r.y;
  u.moved = true;
  audio.sfx('move');
  tutEvent(G, 'move');
  refreshSel(G);
  G.notify();
}

export function clickTile(G: Game, x: number, y: number) {
  if (G.phase !== 'player' || G.over || !inb(G, x, y)) return;
  G.cursor = { x, y };
  if (G.mode === 'pulse') {
    placePulse(G, x, y);
    return;
  }
  const u = unitAt(G, x, y);
  const s = G.sel;
  if (s) {
    if (u && u.team === 'e') {
      const opt = findOpt(G.attacks, u);
      if (opt) {
        performAttack(G, s, opt);
      } else {
        audio.sfx('error');
        floater(G, u.x, u.y, 'OUT OF REACH', '#ff9b9b', 0.9);
      }
      return;
    }
    if (u && u.team === 'p' && u !== s) {
      if (!u.acted) selectUnit(G, u);
      else audio.sfx('error');
      return;
    }
    if (u === s) {
      clearSel(G);
      audio.sfx('click');
      G.notify();
      return;
    }
    const mv = G.moveMap.get(key(x, y));
    if (mv && !s.moved) {
      moveUnit(G, s, mv);
      return;
    }
    clearSel(G);
    G.notify();
    return;
  }
  if (u && u.team === 'p') {
    if (!u.acted) selectUnit(G, u);
    else {
      audio.sfx('error');
      floater(G, u.x, u.y, 'DONE', '#aaa', 0.8);
    }
  } else if (u) {
    audio.sfx('click');
  }
}

export function doWait(G: Game) {
  const s = G.sel;
  if (!s || G.phase !== 'player') return;
  s.acted = true;
  s.moved = true;
  s.prev = null;
  audio.sfx('click');
  tutEvent(G, 'act');
  clearSel(G);
  G.notify();
}
export function doBrace(G: Game) {
  const s = G.sel;
  if (!s || G.phase !== 'player') return;
  s.acted = true;
  s.moved = true;
  s.brace = true;
  s.prev = null;
  ring(G, s.x, s.y, '#9bd8ff', 1.5);
  floater(G, s.x, s.y - 0.4, 'BRACE +3 MASS', '#9bd8ff', 0.9);
  audio.sfx('brace');
  tutEvent(G, 'act');
  clearSel(G);
  G.notify();
}
export function doUndo(G: Game) {
  const s = G.sel;
  if (!s || !s.prev || s.acted || G.phase !== 'player') return;
  s.x = s.prev.x;
  s.y = s.prev.y;
  s.prev = null;
  s.moved = false;
  audio.sfx('click');
  refreshSel(G);
  G.notify();
}
export function selectNext(G: Game) {
  if (G.phase !== 'player') return;
  const list = G.units.filter((u) => u.alive && u.team === 'p' && !u.acted);
  if (!list.length) return;
  const i = G.sel ? list.indexOf(G.sel) : -1;
  selectUnit(G, list[(i + 1) % list.length]);
}
export function toggleField(G: Game) {
  G.showField = !G.showField;
  audio.sfx('click');
  if (G.showField) tutEvent(G, 'field');
  G.notify();
}
export function togglePulse(G: Game) {
  if (G.phase !== 'player') return;
  if (G.mode === 'pulse') {
    G.mode = 'idle';
  } else if (G.energy >= 2) {
    clearSel(G);
    G.mode = 'pulse';
    audio.sfx('click');
  } else {
    audio.sfx('error');
    floater(G, G.cursor.x, G.cursor.y, 'NEED 2 ENERGY', '#ff9b9b', 0.9);
  }
  G.notify();
}
export function setPulseKind(G: Game, k: 'well' | 'rep') {
  G.pulseKind = k;
  audio.sfx('click');
  G.notify();
}
export function placePulse(G: Game, x: number, y: number) {
  if (G.energy < 2) {
    G.mode = 'idle';
    G.notify();
    return;
  }
  if (!passable(G, x, y) || G.anoms.some((a) => a.x === x && a.y === y)) {
    audio.sfx('error');
    floater(G, x, y, 'BLOCKED', '#ff9b9b', 0.9);
    return;
  }
  const well = G.pulseKind === 'well';
  G.anoms.push({ x, y, m: well ? G.pulseStr : -G.pulseStr, kind: well ? 'pwell' : 'prep', ttl: G.pulseDur });
  G.energy -= 2;
  G.stats.pulses++;
  ring(G, x, y, well ? '#6aa8ff' : '#ffa24f', 3);
  burst(G, x, y, well ? '#6aa8ff' : '#ffa24f', 24, 3);
  shake(G, 0.3);
  audio.sfx(well ? 'pulse' : 'repel');
  tutEvent(G, 'pulse');
  if (G.energy < 2) G.mode = 'idle';
  refreshSel(G);
  G.notify();
}

export function endTurn(G: Game) {
  if (G.phase !== 'player' || G.over) return;
  clearSel(G);
  G.mode = 'idle';
  tutEvent(G, 'endturn');
  G.phase = 'enemy';
  G.stage = 'begin';
  G.pending = null;
  G.timer = 0.6;
  G.enemyQueue = G.units.filter((u) => u.alive && u.team === 'e').sort((a, b) => b.y - a.y);
  banner(G, 'ENEMY PHASE', 'Hostiles advance');
  audio.sfx('turn');
  G.notify();
}

// ---------- end checks ----------
export function checkEnd(G: Game) {
  if (G.over) return;
  const pl = G.units.filter((u) => u.alive && u.team === 'p');
  const en = G.units.filter((u) => u.alive && u.team === 'e');
  if (!pl.some((u) => u.type === 'core') || pl.length === 0) return finish(G, 'lose');
  if (G.lvl.obj === 'king' && !en.some((u) => u.type === 'core' || u.type === 'warden' || u.type === 'horizon')) return finish(G, 'win');
  if (G.lvl.obj === 'annihilate' && en.length === 0) return finish(G, 'win');
}
function finish(G: Game, r: 'win' | 'lose') {
  G.over = r;
  G.phase = 'over';
  G.overT = 1.4;
  clearSel(G);
  G.mode = 'idle';
  banner(G, r === 'win' ? 'VICTORY' : 'DEFEAT', '');
  audio.sfx(r === 'win' ? 'win' : 'lose');
  G.notify();
}

// ---------- enemy AI ----------
function impulseBonus(G: Game, att: Unit, t: Unit, opt: AttackOpt, i: number): number {
  const v = impulseVec(att, t, opt, i);
  if (!v) return 0;
  const nx = t.x + v[0];
  const ny = t.y + v[1];
  if (!inb(G, nx, ny)) return 0.5;
  if (terr(G, nx, ny) === 'H') return t.team === 'p' ? 12 : -12;
  if (terr(G, nx, ny) === '#') return 1.5;
  return 0;
}

export function planEnemy(G: Game, u: Unit): { move: Reach | null; opt: AttackOpt | null; tgt: Unit | null } {
  const players = G.units.filter((p) => p.alive && p.team === 'p');
  if (!players.length) return { move: null, opt: null, tgt: null };
  const core = players.find((p) => p.type === 'core');
  const isCore = u.type === 'core';
  const D = G.diff;
  const options: Reach[] = [{ x: u.x, y: u.y, cost: 0 }, ...reachList(G, u)];
  const ox = u.x;
  const oy = u.y;
  let best: { move: Reach; opt: AttackOpt | null; tgt: Unit | null } | null = null;
  let bestScore = -1e9;
  for (const r of options) {
    u.x = r.x;
    u.y = r.y;
    let score = 0;
    const dr = driftOf(G, u);
    if (dr) {
      if (dr.fate === 'hole') score -= 600;
      else if (dr.fate === 'collide') score -= 1;
    }
    let bestOpt: AttackOpt | null = null;
    let tgtU: Unit | null = null;
    let aS = 0;
    for (const opt of attackOptions(G, u)) {
      let val = 0;
      opt.targets.forEach((t, i) => {
        const dmg = calcDamage(G, u, t, opt, i);
        val += dmg * 1.2 + (dmg >= t.hp ? 6 : 0) + (t.type === 'core' ? dmg * 3 + (dmg >= t.hp ? 200 : 0) : 0) + impulseBonus(G, u, t, opt, i);
      });
      if (val > aS) {
        aS = val;
        bestOpt = opt;
        tgtU = opt.targets[0];
      }
    }
    score += aS;
    let threat = 0;
    let nearest = 99;
    for (const p of players) {
      const d = Math.max(Math.abs(p.x - r.x), Math.abs(p.y - r.y));
      nearest = Math.min(nearest, d);
      const reach = (UNITS[p.type].adirs === 'knight' ? 2 : p.stats.range) + p.stats.move * 0.7;
      if (d <= reach) threat += p.stats.atk;
    }
    score -= threat * D.caution * (isCore ? 1.4 : 0.45);
    if (!bestOpt) {
      if (isCore) score += Math.min(nearest, 5) * 0.5;
      else {
        const dc = core ? Math.abs(core.x - r.x) + Math.abs(core.y - r.y) : nearest;
        score -= nearest * 0.5 + dc * 0.15;
      }
    }
    score -= r.cost * 0.05;
    score += Math.random() * D.noise;
    if (score > bestScore) {
      bestScore = score;
      best = { move: r, opt: bestOpt, tgt: tgtU };
    }
  }
  u.x = ox;
  u.y = oy;
  return best || { move: null, opt: null, tgt: null };
}

function freeTilesTop(G: Game, rows: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < Math.min(rows, G.H); y++)
    for (let x = 0; x < G.W; x++) if ((terr(G, x, y) === '.' || terr(G, x, y) === 'N') && !unitAt(G, x, y)) out.push([x, y]);
  return out.sort(() => Math.random() - 0.5);
}
function spawnEnemy(G: Game, t: UType, x: number, y: number) {
  const u = makeUnit(G, 'e', t, x, y);
  u.pop = 0;
  ring(G, x, y, TEAM_COLOR.e, 1.5);
  return u;
}
function spawnWave(G: Game, types: UType[]) {
  const tiles = freeTilesTop(G, 2);
  let n = 0;
  for (const t of types) {
    const p = tiles.shift();
    if (!p) break;
    spawnEnemy(G, t, p[0], p[1]);
    n++;
  }
  if (n) {
    banner(G, 'REINFORCEMENTS', n + ' hostile' + (n > 1 ? 's' : '') + ' inbound');
    audio.sfx('spawn');
  }
}

function bossStart(G: Game) {
  const bosses = G.units.filter((u) => u.alive && u.team === 'e' && (u.type === 'warden' || u.type === 'horizon'));
  for (const b of bosses) {
    if (b.type === 'warden' && G.round % 3 === 0) {
      floater(G, b.x, b.y - 0.6, 'SHOCKWAVE', '#ff9b4f', 1.5);
      ring(G, b.x, b.y, '#ff9b4f', 4);
      shake(G, 1);
      audio.sfx('shock');
      for (const u of G.units.filter((q) => q.alive && q !== b && !hasFlag(q, 'anchor'))) {
        if (Math.max(Math.abs(u.x - b.x), Math.abs(u.y - b.y)) <= 2) {
          const [dx, dy] = snapDir(u.x - b.x, u.y - b.y);
          displace(G, u, dx, dy, b);
        }
      }
    }
    if (b.type === 'horizon') {
      if (G.telegraph) {
        const t = G.telegraph;
        const cells: [number, number][] = [[t.x, t.y], [t.x + 1, t.y], [t.x - 1, t.y], [t.x, t.y + 1], [t.x, t.y - 1]];
        cells.forEach(([cx, cy]) => {
          if (!inb(G, cx, cy)) return;
          burst(G, cx, cy, '#c58bff', 16, 3.5);
          const v = unitAt(G, cx, cy);
          if (v && v !== b) hurt(G, v, 5, b, 'collapse');
        });
        if (passable(G, t.x, t.y) && !G.anoms.some((a) => a.x === t.x && a.y === t.y)) G.anoms.push({ x: t.x, y: t.y, m: 7, kind: 'bwell', ttl: 2 });
        ring(G, t.x, t.y, '#c58bff', 4);
        shake(G, 0.9);
        audio.sfx('boom');
        G.telegraph = null;
      }
      const pl = G.units.filter((u) => u.alive && u.team === 'p');
      if (pl.length && !G.over) {
        const t = pl[Math.floor(Math.random() * pl.length)];
        G.telegraph = { x: t.x, y: t.y };
        floater(G, t.x, t.y - 0.6, 'COLLAPSE MARKED', '#c58bff', 1.2);
        audio.sfx('warn');
      }
      if (G.round % 3 === 0) {
        const free = D8.map(([dx, dy]) => [b.x + dx, b.y + dy] as [number, number]).filter(([x, y]) => passable(G, x, y) && !unitAt(G, x, y));
        free.slice(0, 2).forEach(([x, y]) => spawnEnemy(G, 'mote', x, y));
        if (free.length) {
          floater(G, b.x, b.y - 0.6, 'HAWKING SPAWN', '#c58bff', 1.2);
          audio.sfx('spawn');
        }
      }
    }
  }
}

function stepEnemy(G: Game) {
  if (G.pending) {
    const { u, opt, tgt } = G.pending;
    G.pending = null;
    if (u.alive && tgt.alive) performAttack(G, u, opt);
    G.timer = 0.6;
    return;
  }
  if (G.stage === 'begin') {
    G.stage = 'units';
    bossStart(G);
    G.timer = 0.7;
    return;
  }
  while (G.enemyQueue.length) {
    const u = G.enemyQueue.shift()!;
    if (!u.alive) continue;
    const plan = planEnemy(G, u);
    if (plan.move && (plan.move.x !== u.x || plan.move.y !== u.y)) {
      burst(G, u.x, u.y, TEAM_COLOR.e, 5, 1.5);
      u.x = plan.move.x;
      u.y = plan.move.y;
      audio.sfx('move');
    }
    if (plan.opt && plan.tgt) {
      const opt = attackOptions(G, u).find((o) => o.targets[0] === plan.tgt && o.dir[0] === plan.opt!.dir[0] && o.dir[1] === plan.opt!.dir[1]) || plan.opt;
      G.pending = { u, opt, tgt: plan.tgt };
      G.timer = 0.45;
    } else G.timer = 0.3;
    return;
  }
  G.phase = 'drift';
  G.driftDone = false;
  G.timer = 0.6;
  G.notify();
}

function newRound(G: Game) {
  G.round++;
  G.anoms = G.anoms.filter((a) => {
    if (a.ttl === undefined) return true;
    a.ttl--;
    if (a.ttl <= 0) {
      ring(G, a.x, a.y, '#888', 2);
      return false;
    }
    return true;
  });
  if (G.lvl.obj === 'survive' && G.lvl.surviveRounds && G.round > G.lvl.surviveRounds) {
    finish(G, 'win');
    return;
  }
  const r = G.lvl.reinf;
  if (r && G.round > 1 && (G.round - 1) % r.every === 0) {
    const idx = (G.round - 1) / r.every - 1;
    const types: UType[] = [r.list[idx % r.list.length]];
    if (idx >= 2) types.push(r.list[(idx + 1) % r.list.length]);
    if (G.diff.id === 'admiral') types.push('mote');
    spawnWave(G, types);
  }
  if (G.mods.includes('reinf') && G.round > 1 && (G.round - 1) % 3 === 0) {
    const pool: UType[] = ['mote', 'sling', 'prism'];
    spawnWave(G, [pool[((G.round - 1) / 3) % pool.length | 0], 'mote']);
  }
  G.energy = Math.min(G.maxEnergy, G.energy + 1);
  for (const u of G.units) {
    if (u.team === 'p') {
      u.moved = false;
      u.acted = false;
      u.brace = false;
      u.prev = null;
    }
  }
  G.phase = 'player';
  G.mode = 'idle';
  banner(G, 'ROUND ' + G.round, G.lvl.obj === 'survive' && G.lvl.surviveRounds ? 'Survive until round ' + G.lvl.surviveRounds + ' ends' : '');
  audio.sfx('turn');
  checkEnd(G);
  G.notify();
}

// ---------- update ----------
export function updateGame(G: Game, dt: number) {
  G.time += dt;
  const k = 1 - Math.exp(-dt * 12);
  for (const u of G.units) {
    u.rx += (u.x - u.rx) * k;
    u.ry += (u.y - u.ry) * k;
    if (u.flash > 0) u.flash = Math.max(0, u.flash - dt * 4);
    if (u.pop < 1) u.pop = Math.min(1, u.pop + dt * 3);
  }
  for (const p of G.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.97;
    p.vy *= 0.97;
    p.life -= dt;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const f of G.floaters) {
    f.y -= dt * 0.7;
    f.life -= dt;
  }
  G.floaters = G.floaters.filter((f) => f.life > 0);
  for (const b of G.beams) b.life -= dt;
  G.beams = G.beams.filter((b) => b.life > 0);
  for (const r of G.rings) {
    r.life -= dt;
    r.r += dt * r.max * 1.6;
  }
  G.rings = G.rings.filter((r) => r.life > 0);
  G.shake = Math.max(0, G.shake - dt * 2.2);
  if (G.banner) {
    G.banner.t -= dt;
    if (G.banner.t <= 0) G.banner = null;
  }
  // music intensity
  G.intT -= dt;
  if (G.intT <= 0) {
    G.intT = 0.4;
    const en = G.units.filter((u) => u.alive && u.team === 'e').length;
    const core = G.units.find((u) => u.alive && u.team === 'p' && u.type === 'core');
    let I = 0.2 + Math.min(0.35, en * 0.04);
    if (G.phase === 'enemy') I += 0.2;
    if (core && core.hp / core.maxHp < 0.4) I += 0.2;
    if (G.lvl.boss) I += 0.15;
    G.intensity = clamp(I, 0, 1);
    audio.setIntensity(G.intensity);
  }
  if (G.over) {
    if (G.overT > 0) {
      G.overT -= dt;
      if (G.overT <= 0) {
        G.resultReady = true;
        G.notify();
      }
    }
    return;
  }
  if (G.phase === 'enemy') {
    G.timer -= dt;
    if (G.timer <= 0) stepEnemy(G);
  } else if (G.phase === 'drift') {
    G.timer -= dt;
    if (G.timer <= 0) {
      if (!G.driftDone) {
        G.driftDone = true;
        applyDrift(G);
        G.timer = 1.0;
        checkEnd(G);
        G.notify();
      } else newRound(G);
    }
  }
}

// ---------- results ----------
export interface Result {
  win: boolean;
  stardust: number;
  stars: number;
  xp: Record<string, { xp: number; kills: number }>;
  dead: string[];
  mult: number;
}
export function computeResult(G: Game, research: Record<string, number>): Result {
  const win = G.over === 'win';
  const mult = G.diff.reward * (1 + G.mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus || 0), 0));
  const base = 40 + 15 * G.lvl.id;
  const raw = win ? base + G.stats.kills * 4 : base * 0.25 + G.stats.kills * 4;
  const stardust = Math.round(raw * mult * (1 + 0.15 * (research.salvage || 0)));
  const core = G.units.find((u) => u.team === 'p' && u.type === 'core');
  let stars = 0;
  if (win) {
    stars = 1;
    if (G.stats.losses === 0) stars++;
    if (G.lvl.obj === 'survive' ? !!core && core.alive && core.hp >= core.maxHp / 2 : G.round <= G.lvl.par) stars++;
  }
  const xp: Result['xp'] = {};
  const am = 1 + 0.25 * (research.academy || 0);
  for (const u of G.units) {
    if (u.team === 'p' && u.rid) xp[u.rid] = { xp: Math.round((u.xpGain + (win && u.alive ? 2 : 0)) * am), kills: u.kills };
  }
  const dead = G.units.filter((u) => u.team === 'p' && !u.alive && u.rid && u.type !== 'core').map((u) => u.rid!);
  return { win, stardust, stars, xp, dead, mult };
}
