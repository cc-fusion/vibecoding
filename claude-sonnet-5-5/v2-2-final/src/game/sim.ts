// ---------- Real-time heist simulation ----------
import { CREW, DIFFS, mulberry32, clamp } from './data';
import type { CrewKind, DiffId, GadgetId, Loot, Rng, Skill } from './data';
import { findPath, lineClear, angDiff, T_FLOOR, T_STREET, T_COVER, T_WALL } from './level';
import type { Level, Door, Item, Pt, Goal, GuardType } from './level';

export type OrderType = 'move' | 'sprint' | 'unlock' | 'interact' | 'wait' | 'signal' | 'await' | 'ambush' | 'disguise' | 'spoof' | 'exit';
export interface Order { type: OrderType; x: number; y: number; id?: string; secs?: number; flag?: string }

export interface SimCrewInfo { id: string; kind: CrewKind; name: string; level: number }
export interface SimConfig {
  level: Level; crew: SimCrewInfo[]; plans: Record<string, Order[]>; recon: number; diff: DiffId; eagle: boolean; heat: number;
  garage: number; seed: number; tutorial: boolean; gadgets: Record<GadgetId, number>;
}

export interface Work { t: number; total: number; kind: 'item' | 'door' | 'disguise' | 'spoof' | 'takedown'; id?: string; noise: number; noiseT: number; label: string }
export interface CrewUnit {
  id: string; kind: CrewKind; name: string; level: number; color: string; x: number; y: number; angle: number; hp: number; maxHp: number;
  orders: Order[]; oi: number; path: Pt[] | null; pi: number; pathFor: number; status: 'ready' | 'moving' | 'working' | 'waiting' | 'ambush' | 'escaped' | 'captured';
  label: string; work: Work | null; bag: Loot[]; disguise: number; sprint: boolean; stuck: number; retry: number; timer: number; egress: boolean;
  cuff: number; noiseT: number; aborted: boolean; hurt: number;
}
export type GState = 'patrol' | 'wait' | 'alert' | 'investigate' | 'chase' | 'search' | 'look' | 'down';
export interface Guard {
  id: string; num: number; type: GuardType; x: number; y: number; angle: number; route: { x: number; y: number; wait: number }[]; ri: number; state: GState;
  path: Pt[] | null; pi: number; pathKey: string; goal: Pt | null; timer: number; aware: number; seenId: string | null; last: Pt | null; lostT: number;
  downT: number; found: boolean; reported: boolean; missT: number; grapple: number; repath: number; lookBase: number; huntN: number; stun: number;
  run: boolean; phase: number; pingT: number; sentry: boolean; loop: Pt[]; speed: number; chaseSpeed: number; range: number; fov: number; seenNow: boolean;
}
export interface CamState { id: string; x: number; y: number; angle: number; range: number; fov: number; base: number; sweep: number; speed: number; phase: number; aware: number; cool: number; off: number }
export interface LaserState { id: string; x: number; y1: number; y2: number; mode: 'solid' | 'pulse'; period: number; onFrac: number; phase: number; cool: number; offUntil: number }
export interface Ping { x: number; y: number; r: number; max: number; kind: 'noise' | 'radio'; hit: Set<string>; speed: number }
export interface Smoke { x: number; y: number; r: number; until: number }
export interface Decoy { x: number; y: number; until: number; next: number }
export interface Float { x: number; y: number; text: string; color: string; age: number; life: number }
export interface Part { x: number; y: number; vx: number; vy: number; age: number; life: number; color: string; size: number }
export interface LogLine { t: number; msg: string; kind: 'info' | 'good' | 'bad' | 'warn' }

export interface Result {
  success: boolean; targetSecured: boolean; loot: Loot[]; lootValue: number; lootLost: number; alarmMax: number; captured: string[]; escaped: string[];
  time: number; guardsDowned: number; spotted: number; camTrips: number; laserTrips: number; bodies: number; gadgetsUsed: number; stars: number; policeArrived: boolean;
}

export interface Sim {
  cfg: SimConfig; level: Level; rng: Rng; t: number; over: boolean; overT: number; result: Result | null;
  doors: Door[]; items: Item[]; crew: CrewUnit[]; guards: Guard[]; cams: CamState[]; lasers: LaserState[];
  known: Set<string>; trackGuards: boolean; flags: Set<string>;
  alarm: { level: number; last: number; pos: Pt | null; max: number };
  police: { state: 'none' | 'pending' | 'enroute' | 'arrived'; t: number; eta: number; arrivedT: number; panelUntil: number };
  camOff: number; spoofUntil: number; pings: Ping[]; smokes: Smoke[]; decoys: Decoy[]; floats: Float[]; parts: Part[];
  shake: number; flash: number; log: LogLine[]; sfxQ: string[]; gadgets: Record<GadgetId, number>; gadgetsUsed: number;
  secured: Loot[]; targetSecured: boolean; lostValue: number; stats: { downed: number; spotted: number; camTrips: number; laserTrips: number; bodies: number; captured: string[]; escaped: string[] };
  visMul: number; detMul: number; discT: number; laserCol: Map<number, LaserState>; swatSpawned: boolean;
}

// ---------- helpers ----------
export const skillRateOf = (kind: CrewKind, lvl: number, skill: Skill) => CREW[kind].skills[skill] * (1 + 0.25 * (lvl - 1));
const sfx = (s: Sim, n: string) => { if (s.sfxQ.length < 40) s.sfxQ.push(n); };
export const say = (s: Sim, msg: string, kind: LogLine['kind'] = 'info') => { s.log.push({ t: s.t, msg, kind }); if (s.log.length > 90) s.log.shift(); };
const float = (s: Sim, x: number, y: number, text: string, color = '#fff') => { if (s.floats.length < 60) s.floats.push({ x, y, text, color, age: 0, life: 1.5 }); };
const burst = (s: Sim, x: number, y: number, n: number, color: string, sp = 2.2, life = 0.6) => {
  for (let i = 0; i < n && s.parts.length < 600; i++) {
    const a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.9);
    s.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: life * (0.6 + Math.random() * 0.7), color, size: 0.06 + Math.random() * 0.08 });
  }
};
const distSeg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy; let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
};
const gname = (g: Guard) => (g.type === 'dog' ? 'Guard dog' : g.type === 'heavy' ? 'Heavy guard' : g.type === 'swat' ? 'SWAT officer' : 'Guard #' + g.num);
const active = (c: CrewUnit) => c.status !== 'escaped' && c.status !== 'captured';

export function blocks(s: Sim, x: number, y: number): boolean {
  const L = s.level; if (x < 0 || y < 0 || x >= L.w || y >= L.h) return true;
  const i = y * L.w + x; const t = L.tiles[i]; if (t === T_WALL || t === T_COVER || t === 0) return true;
  const di = L.doorAt[i]; if (di >= 0 && s.doors[di].open < 0.35) return true; return false;
}
export function los(s: Sim, x0: number, y0: number, x1: number, y1: number): boolean {
  if (!lineClear((x, y) => blocks(s, x, y), x0, y0, x1, y1)) return false;
  for (const sm of s.smokes) if (sm.until > s.t && distSeg(sm.x, sm.y, x0, y0, x1, y1) < sm.r) return false;
  return true;
}
export const laserOn = (s: Sim, L: LaserState, t = s.t) => {
  if (L.offUntil > t) return false; if (L.mode === 'solid') return true;
  return ((t + L.phase) % L.period) / L.period < L.onFrac;
};
const laserSafe = (s: Sim, L: LaserState) => { for (const dt of [0, 0.25, 0.5, 0.8, 1.1]) if (laserOn(s, L, s.t + dt)) return false; return true; };

const crewPass = (s: Sim) => (x: number, y: number) => {
  const L = s.level; if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
  const i = y * L.w + x; const t = L.tiles[i]; if (t !== T_FLOOR && t !== T_STREET) return false;
  const di = L.doorAt[i]; if (di >= 0) { const d = s.doors[di]; if (!(d.kind === 'open' || d.unlocked)) return false; }
  const lz = s.laserCol.get(i); if (lz && lz.mode === 'solid' && s.known.has(lz.id) && laserOn(s, lz)) return false;
  return true;
};
const guardPass = (s: Sim) => (x: number, y: number) => {
  const L = s.level; if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false;
  const i = y * L.w + x; if (L.tiles[i] !== T_FLOOR) return false;
  const di = L.doorAt[i]; if (di >= 0) { const d = s.doors[di]; if (d.kind === 'vault' && !d.unlocked) return false; }
  return true;
};

// ---------- planning helpers (shared with UI) ----------
export interface DoorPlan { time: number; noise: number; label: string }
export function doorPlan(kind: CrewKind, lvl: number, d: Door | { kind: string }): DoorPlan | null {
  if (d.kind === 'locked') {
    const lr = skillRateOf(kind, lvl, 'lock'), fr = skillRateOf(kind, lvl, 'force');
    const a = lr > 0 ? { time: 4 / lr, noise: 2, label: 'Picking lock' } : null; const b = fr > 0 ? { time: 2.2 / fr, noise: 12, label: 'Breaching door' } : null;
    if (a && b) return a.time < b.time ? a : b; return a || b;
  }
  if (d.kind === 'keycard') { const tr = skillRateOf(kind, lvl, 'tech'); return tr > 0 ? { time: 5 / tr, noise: 0, label: 'Cloning keycard' } : null; }
  return null;
}
export function estimatePlan(level: Level, kind: CrewKind, lvl: number, orders: Order[]): number {
  let t = 0; let px = level.spawn[0].x, py = level.spawn[0].y; const sp = CREW[kind].speed * (1 + 0.04 * (lvl - 1));
  for (const o of orders) {
    if (o.type === 'wait') t += o.secs ?? 3;
    else if (o.type === 'disguise') t += 2; else if (o.type === 'spoof') t += 3;
    else if (o.type === 'signal' || o.type === 'await') t += 0;
    else {
      const tx = o.type === 'exit' ? level.exit.x : o.x, ty = o.type === 'exit' ? level.exit.y : o.y;
      t += (Math.abs(tx - px) + Math.abs(ty - py)) * 0.85 / (o.type === 'sprint' ? sp * 1.6 : sp); px = tx; py = ty;
      if (o.type === 'interact') { const it = level.items.find((i) => i.id === o.id); if (it) { const r = skillRateOf(kind, lvl, it.skill); if (r > 0) t += it.time / r; } }
      if (o.type === 'unlock') { const d = level.doors.find((q) => q.id === o.id); if (d) { const p = doorPlan(kind, lvl, d); if (p) t += p.time; } }
    }
  }
  return t;
}

// ---------- creation ----------
const GSPEED: Record<GuardType, [number, number, number, number]> = { guard: [1.7, 3.0, 7.5, 1.35], heavy: [1.55, 2.7, 8, 1.25], dog: [2.3, 4.0, 6, 2.3], swat: [2.4, 3.3, 10, 1.5] };

function mkGuard(id: string, num: number, type: GuardType, route: { x: number; y: number; wait: number }[], start: number, loop: Pt[], sentry: boolean, rng: Rng): Guard {
  const [sp, ch, rg, fv] = GSPEED[type]; const p = route[start] ?? route[0];
  const n = route[(start + 1) % route.length] ?? p;
  return {
    id, num, type, x: p.x + 0.5, y: p.y + 0.5, angle: Math.atan2(n.y - p.y, n.x - p.x), route, ri: start, state: type === 'swat' ? 'chase' : 'wait', path: null, pi: 0, pathKey: '', goal: null,
    timer: 1 + rng() * 2, aware: 0, seenId: null, last: null, lostT: 0, downT: 0, found: false, reported: false, missT: 0, grapple: 0, repath: 0, lookBase: Math.atan2(n.y - p.y, n.x - p.x), huntN: 0, stun: 0,
    run: false, phase: rng() * 6, pingT: 0, sentry, loop, speed: sp, chaseSpeed: ch, range: rg, fov: fv, seenNow: false,
  };
}

export function createSim(cfg: SimConfig): Sim {
  const L = cfg.level; const rng = mulberry32(cfg.seed >>> 0);
  const D = DIFFS[cfg.diff];
  const doors = L.doors.map((d) => ({ ...d, unlocked: false, open: 0, done: 0 }));
  const items = L.items.map((i) => ({ ...i, done: false }));
  const lasers: LaserState[] = L.lasers.map((l) => ({ ...l, cool: 0, offUntil: 0 }));
  const laserCol = new Map<number, LaserState>();
  for (const l of lasers) for (let y = l.y1; y <= l.y2; y++) laserCol.set(y * L.w + l.x, l);
  const known = new Set<string>();
  if (cfg.recon >= 1) { L.cams.forEach((c) => known.add(c.id)); L.lasers.forEach((l) => known.add(l.id)); L.items.forEach((i) => known.add(i.id)); L.doors.forEach((d) => known.add(d.id)); }
  else { L.items.filter((i) => i.primary).forEach((i) => known.add(i.id)); }
  const crew: CrewUnit[] = cfg.crew.map((c, i) => {
    const sp = L.spawn[i % L.spawn.length]; const def = CREW[c.kind];
    return {
      id: c.id, kind: c.kind, name: c.name, level: c.level, color: def.color, x: sp.x + 0.5, y: sp.y + 0.5, angle: 0, hp: def.hp + (c.level >= 3 ? 1 : 0), maxHp: def.hp + (c.level >= 3 ? 1 : 0),
      orders: (cfg.plans[c.id] ?? []).map((o) => ({ ...o })), oi: 0, path: null, pi: 0, pathFor: -1, status: 'ready', label: 'Standing by', work: null, bag: [], disguise: 0, sprint: false,
      stuck: 0, retry: 0, timer: 0, egress: false, cuff: 0, noiseT: 0, aborted: false, hurt: 0,
    };
  });
  let gn = 0; const gu: Guard[] = L.guards.map((g) => mkGuard(g.id, ++gn, g.type, g.route, g.start, g.loop, g.sentry, rng));
  const s: Sim = {
    cfg, level: L, rng, t: 0, over: false, overT: -1, result: null, doors, items, crew, guards: gu,
    cams: L.cams.map((c) => ({ id: c.id, x: c.x, y: c.y, angle: c.base, range: c.range, fov: c.fov, base: c.base, sweep: c.sweep, speed: c.speed, phase: c.phase, aware: 0, cool: 0, off: 0 })),
    lasers, known, trackGuards: cfg.recon >= 2, flags: new Set(), alarm: { level: 0, last: -99, pos: null, max: 0 },
    police: { state: 'none', t: 0, eta: 0, arrivedT: 0, panelUntil: 0 }, camOff: 0, spoofUntil: 0, pings: [], smokes: [], decoys: [], floats: [], parts: [], shake: 0, flash: 0,
    log: [], sfxQ: [], gadgets: { ...cfg.gadgets }, gadgetsUsed: 0, secured: [], targetSecured: false, lostValue: 0,
    stats: { downed: 0, spotted: 0, camTrips: 0, laserTrips: 0, bodies: 0, captured: [], escaped: [] },
    visMul: D.vis * (cfg.eagle ? 1.25 : 1), detMul: D.detect * (cfg.tutorial ? 0.6 : 1), discT: 0, laserCol, swatSpawned: false,
  };
  return s;
}

// ---------- alarm / noise ----------
function noise(s: Sim, x: number, y: number, max: number) {
  if (max < 0.8 || s.pings.length > 40) return;
  s.pings.push({ x, y, r: 0, max, kind: 'noise', hit: new Set(), speed: 14 });
}
function radio(s: Sim, x: number, y: number) { s.pings.push({ x, y, r: 0, max: 90, kind: 'radio', hit: new Set(), speed: 12 }); }

function raiseAlarm(s: Sim, lvl: number, x: number, y: number, why: string) {
  const A = s.alarm; const D = DIFFS[s.cfg.diff];
  if (s.cfg.tutorial) lvl = Math.min(lvl, 1);
  if (lvl < 2 && A.level >= 1 && A.level < 2 && s.t - A.last < (D.vis < 1 ? 10 : 18)) { lvl = 2; why += ' (escalation)'; }
  A.last = s.t; A.pos = { x, y };
  if (lvl > A.level) {
    A.level = lvl; A.max = Math.max(A.max, lvl); s.shake = Math.max(s.shake, lvl >= 2 ? 0.9 : 0.4);
    say(s, lvl >= 2 ? `ALARM! ${why}` : `Alert: ${why}`, lvl >= 2 ? 'bad' : 'warn'); sfx(s, lvl >= 2 ? 'siren' : 'alert');
    if (lvl >= 2) { s.flash = 0.6; }
  }
  if (A.level >= 2 && s.police.state === 'none' && s.t >= s.police.panelUntil && !s.cfg.tutorial) { s.police.state = 'pending'; s.police.t = 20; say(s, 'Silent alarm tripped. Police call in 20s - cut the alarm panel!', 'warn'); }
  radio(s, x, y);
}

// ---------- movement ----------
interface Mover { x: number; y: number; angle: number; path: Pt[] | null; pi: number }
function moveAlong(m: Mover, speed: number, dt: number, gate?: (p: Pt) => boolean): 0 | 1 | 2 {
  if (!m.path) return 1;
  let budget = speed * dt;
  while (budget > 1e-6 && m.pi < m.path.length) {
    const n = m.path[m.pi];
    if (gate && !gate(n)) return 2;
    const tx = n.x + 0.5, ty = n.y + 0.5; const dx = tx - m.x, dy = ty - m.y; const d = Math.hypot(dx, dy);
    if (d <= budget) { m.x = tx; m.y = ty; budget -= d; m.pi++; } else { m.x += (dx / d) * budget; m.y += (dy / d) * budget; budget = 0; }
    if (d > 0.001) m.angle = Math.atan2(dy, dx);
  }
  return m.pi >= m.path.length ? 1 : 0;
}
const turnTo = (a: number, b: number, rate: number) => { const d = angDiff(b, a); return Math.abs(d) < rate ? b : a + Math.sign(d) * rate; };

// ---------- crew ----------
const capOf = (c: CrewUnit) => CREW[c.kind].cap;
const bagWeight = (c: CrewUnit) => c.bag.reduce((a, l) => a + l.weight, 0);
const nextOrder = (c: CrewUnit) => { c.oi++; c.path = null; c.pathFor = -1; c.timer = 0; c.stuck = 0; c.retry = 0; c.work = null; };

function startWork(s: Sim, c: CrewUnit, w: Omit<Work, 't' | 'noiseT'>) {
  c.work = { ...w, t: 0, noiseT: 0 }; c.status = 'working'; c.label = w.label;
  if (w.noise > 0) noise(s, c.x, c.y, w.noise);
}

function escape(s: Sim, c: CrewUnit) {
  c.status = 'escaped'; c.label = 'Escaped';
  const val = c.bag.reduce((a, l) => a + l.value, 0);
  for (const l of c.bag) { s.secured.push(l); if (l.primary) { s.targetSecured = true; say(s, `TARGET SECURED: ${l.name}`, 'good'); } }
  if (c.bag.length) { float(s, c.x, c.y, '+$' + val.toLocaleString('en-US'), '#5cf0a8'); sfx(s, 'cash'); }
  c.bag = []; s.stats.escaped.push(c.id); say(s, `${c.name} made it to the van.`, 'good'); sfx(s, 'escape');
  burst(s, c.x, c.y, 14, '#5cf0a8');
}
function capture(s: Sim, c: CrewUnit) {
  c.status = 'captured'; c.label = 'Arrested'; c.work = null;
  s.lostValue += c.bag.reduce((a, l) => a + l.value, 0); c.bag = []; s.stats.captured.push(c.id);
  say(s, `${c.name} was ARRESTED!`, 'bad'); sfx(s, 'arrest'); s.shake = 1; float(s, c.x, c.y, 'ARRESTED', '#ff4d5e'); burst(s, c.x, c.y, 18, '#ff4d5e', 3);
}
function knockout(s: Sim, g: Guard, c: CrewUnit | null, quiet = false) {
  g.state = 'down'; g.downT = g.type === 'heavy' ? 40 : 55; g.missT = 0; g.found = false; g.reported = false; g.aware = 0; g.path = null; g.grapple = 0;
  s.stats.downed++; float(s, g.x, g.y, 'Zzz', '#a6b8ff'); burst(s, g.x, g.y, 8, '#a6b8ff');
  if (!quiet) { noise(s, g.x, g.y, 4); sfx(s, 'takedown'); }
  if (c) say(s, `${c.name} put ${gname(g)} to sleep.`, 'good');
}

const skillName: Record<Skill, string> = { lock: 'lockpicking', tech: 'tech', crack: 'safecracking', force: 'brute force', grab: 'grabbing' };

function finishWork(s: Sim, c: CrewUnit) {
  const w = c.work as Work; c.work = null;
  switch (w.kind) {
    case 'door': {
      const d = s.doors.find((q) => q.id === w.id); if (d) { d.unlocked = true; s.known.add(d.id); float(s, c.x, c.y, 'Unlocked', '#ffb347'); sfx(s, 'door'); say(s, `${c.name} opened a ${d.kind} door.`); }
      break;
    }
    case 'disguise': c.disguise = 30; float(s, c.x, c.y, 'Disguised', '#ff7ad1'); sfx(s, 'gadget'); say(s, `${c.name} slipped into a disguise (30s).`); break;
    case 'spoof': s.spoofUntil = s.t + 45; float(s, c.x, c.y, 'Radio spoofed', '#ff7ad1'); sfx(s, 'gadget'); say(s, `${c.name} is spoofing radio check-ins for 45s.`, 'good'); break;
    case 'takedown': {
      const g = s.guards.find((q) => q.id === w.id);
      if (g && g.state !== 'down' && g.state !== 'chase') knockout(s, g, c); else float(s, c.x, c.y, 'Takedown failed', '#ff4d5e');
      break;
    }
    case 'item': {
      const it = s.items.find((q) => q.id === w.id); if (!it) break;
      s.known.add(it.id);
      if (it.type === 'loot' || it.type === 'safe') {
        const l = it.loot as Loot;
        if (bagWeight(c) + l.weight > capOf(c)) { float(s, c.x, c.y, 'Bag full!', '#ff4d5e'); sfx(s, 'error'); say(s, `${c.name}'s bag is full - left ${l.name}.`, 'warn'); break; }
        it.done = true; c.bag.push(l); float(s, c.x, c.y, l.name + ' +$' + l.value.toLocaleString('en-US'), '#ffd35c'); sfx(s, 'grab'); burst(s, c.x, c.y, 8, '#ffd35c');
        say(s, `${c.name} took ${l.name} ($${l.value.toLocaleString('en-US')}).`, 'good');
      } else if (it.type === 'camTerm') { s.camOff = s.t + 45; float(s, c.x, c.y, 'Cameras looped 45s', '#5cf0a8'); sfx(s, 'hack'); say(s, `${c.name} looped the cameras for 45s.`, 'good'); }
      else if (it.type === 'laserBox') { for (const l of s.lasers) l.offUntil = Math.max(l.offUntil, s.t + 40); float(s, c.x, c.y, 'Lasers off 40s', '#5cf0a8'); sfx(s, 'hack'); say(s, `${c.name} cut laser power for 40s.`, 'good'); }
      else if (it.type === 'alarmPanel') {
        it.done = true; s.police.panelUntil = s.t + 90; sfx(s, 'hack');
        if (s.police.state === 'pending') { s.police.state = 'none'; say(s, `${c.name} cut the alarm line - dispatch cancelled!`, 'good'); }
        else if (s.police.state === 'enroute') { s.police.eta += 60; say(s, `${c.name} jammed dispatch: police delayed +60s.`, 'good'); }
        else say(s, `${c.name} cut the alarm line: police dispatch blocked for 90s.`, 'good');
        float(s, c.x, c.y, 'Alarm line cut', '#5cf0a8');
      } else if (it.type === 'vaultLock') {
        it.done = true; const vd = s.doors.find((d) => d.kind === 'vault');
        if (vd) { vd.done++; if (vd.done >= vd.locks) { vd.unlocked = true; s.shake = 0.8; sfx(s, 'vault'); say(s, 'THE VAULT DOOR SWINGS OPEN!', 'good'); float(s, vd.x + 0.5, vd.y + 0.5, 'VAULT OPEN', '#ffd35c'); } else { say(s, `Vault lock defeated (${vd.done}/${vd.locks}).`, 'good'); sfx(s, 'crack'); } }
      }
      break;
    }
  }
  nextOrder(c);
}

function orderGoal(s: Sim, o: Order): Goal {
  if (o.type === 'exit') return { x: s.level.exit.x, y: s.level.exit.y };
  if (o.type === 'unlock') return { x: o.x, y: o.y, adj: true };
  if (o.type === 'interact') { const it = s.items.find((i) => i.id === o.id); if (it) return { x: it.x, y: it.y }; }
  return { x: o.x, y: o.y };
}

function stepCrew(s: Sim, c: CrewUnit, dt: number) {
  if (!active(c)) return;
  if (c.disguise > 0) c.disguise = Math.max(0, c.disguise - dt);
  if (c.hurt > 0) c.hurt -= dt;
  if (c.cuff > 0) c.cuff = Math.max(0, c.cuff - dt * 0.5);
  if (c.work) {
    c.work.t += dt; c.work.noiseT += dt; c.sprint = false;
    if (c.work.noise > 0 && c.work.noiseT > 2) { c.work.noiseT = 0; noise(s, c.x, c.y, c.work.noise); }
    if (Math.random() < dt * 4) burst(s, c.x, c.y, 1, '#cfe6ff', 0.8, 0.3);
    if (c.work.t >= c.work.total) finishWork(s, c);
    return;
  }
  const o = c.orders[c.oi];
  const ex = s.level.exit;
  if (!o) {
    if (!c.egress) { c.egress = true; c.orders.push({ type: 'exit', x: ex.x, y: ex.y }); say(s, `${c.name} finished the plan and heads for the van.`); }
    c.status = 'waiting'; c.label = 'Idle'; return;
  }
  c.sprint = o.type === 'sprint' || c.aborted;
  switch (o.type) {
    case 'wait': c.status = 'waiting'; c.label = 'Waiting ' + Math.max(0, (o.secs ?? 3) - c.timer).toFixed(0) + 's'; c.timer += dt; if (c.timer >= (o.secs ?? 3)) nextOrder(c); return;
    case 'signal': s.flags.add(o.flag as string); say(s, `${c.name} sends signal ${o.flag}.`); sfx(s, 'ping'); float(s, c.x, c.y, 'Signal ' + o.flag, '#6ee7ff'); nextOrder(c); return;
    case 'await':
      if (s.flags.has(o.flag as string)) { nextOrder(c); return; }
      c.status = 'waiting'; c.label = 'Awaiting ' + o.flag; c.timer += dt;
      if (c.timer > 90) { float(s, c.x, c.y, 'Sync timeout', '#ff4d5e'); nextOrder(c); }
      return;
    case 'disguise': startWork(s, c, { kind: 'disguise', total: 2, noise: 0, label: 'Changing clothes' }); return;
    case 'spoof': startWork(s, c, { kind: 'spoof', total: 3, noise: 0, label: 'Spoofing radio' }); return;
    default: break;
  }
  // positional orders
  if (o.type === 'unlock') { const d = s.doors.find((q) => q.id === o.id); if (!d || d.kind === 'open' || d.unlocked || d.kind === 'vault') { nextOrder(c); return; } }
  if (o.type === 'interact') {
    const it = s.items.find((q) => q.id === o.id);
    if (!it || (it.done && it.type !== 'camTerm' && it.type !== 'laserBox')) { float(s, c.x, c.y, 'Nothing left', '#9aa'); nextOrder(c); return; }
  }
  const goal = orderGoal(s, o);
  const tx = Math.floor(c.x), ty = Math.floor(c.y);
  const at = goal.adj ? Math.abs(tx - goal.x) + Math.abs(ty - goal.y) === 1 : tx === goal.x && ty === goal.y;
  if (!at) {
    if (c.pathFor !== c.oi || !c.path) {
      if (c.retry > 0) { c.retry -= dt; c.status = 'waiting'; c.label = 'Blocked - rerouting'; c.stuck += dt; if (c.stuck > 22) { float(s, c.x, c.y, 'No route!', '#ff4d5e'); nextOrder(c); } return; }
      const pass = crewPass(s);
      c.path = findPath(s.level.w, s.level.h, tx, ty, goal, pass, (x, y) => (s.laserCol.has(y * s.level.w + x) ? 8 : 0));
      c.pathFor = c.oi; c.pi = 0;
      if (!c.path) { c.retry = 0.7; return; }
    }
    const def = CREW[c.kind];
    const carry = 1 - 0.35 * (bagWeight(c) / capOf(c));
    const spd = def.speed * (1 + 0.04 * (c.level - 1)) * (c.sprint ? 1.6 : 1) * carry;
    const gate = (p: Pt) => {
      const lz = s.laserCol.get(p.y * s.level.w + p.x);
      if (lz && s.known.has(lz.id) && !laserSafe(s, lz)) return false; return true;
    };
    const r = moveAlong(c as unknown as Mover, spd, dt, gate);
    c.status = 'moving'; c.label = o.type === 'sprint' ? 'Sprinting' : o.type === 'exit' ? 'Heading out' : o.type === 'ambush' ? 'Taking position' : 'Moving';
    if (r === 2) { c.status = 'waiting'; c.label = 'Waiting on laser'; c.stuck += dt; if (c.stuck > 30) { float(s, c.x, c.y, 'Gave up', '#ff4d5e'); nextOrder(c); } }
    else {
      c.stuck = Math.max(0, c.stuck - dt);
      if (c.sprint) { c.noiseT -= dt; if (c.noiseT <= 0) { c.noiseT = 0.7; noise(s, c.x, c.y, def.noise); } }
    }
    if (r === 1) { c.path = null; c.pathFor = -1; c.stuck += 0.05; }
    return;
  }
  // arrived
  switch (o.type) {
    case 'move': case 'sprint': nextOrder(c); return;
    case 'exit': escape(s, c); return;
    case 'unlock': {
      const d = s.doors.find((q) => q.id === o.id) as Door; const p = doorPlan(c.kind, c.level, d);
      if (!p) { float(s, c.x, c.y, "Can't do that", '#ff4d5e'); sfx(s, 'error'); nextOrder(c); return; }
      s.known.add(d.id); startWork(s, c, { kind: 'door', id: d.id, total: p.time, noise: p.noise, label: p.label }); return;
    }
    case 'interact': {
      const it = s.items.find((q) => q.id === o.id) as Item; const rate = skillRateOf(c.kind, c.level, it.skill);
      if (rate <= 0) { float(s, c.x, c.y, `No ${skillName[it.skill]} skill`, '#ff4d5e'); sfx(s, 'error'); nextOrder(c); return; }
      if ((it.type === 'loot' || it.type === 'safe') && it.loot && bagWeight(c) + it.loot.weight > capOf(c)) { float(s, c.x, c.y, 'Bag full!', '#ff4d5e'); sfx(s, 'error'); nextOrder(c); return; }
      startWork(s, c, { kind: 'item', id: it.id, total: it.time / rate, noise: it.noise, label: it.label }); return;
    }
    case 'ambush': {
      c.status = 'ambush'; c.label = 'Lying in wait'; c.timer += dt; c.sprint = false;
      if (c.timer > 35) { float(s, c.x, c.y, 'Ambush timed out', '#9aa'); nextOrder(c); return; }
      for (const g of s.guards) {
        if (g.type === 'dog' || g.type === 'swat' || g.state === 'down' || g.state === 'chase') continue;
        if (g.type === 'heavy' && c.kind !== 'muscle') continue;
        if (g.aware > 0.7) continue;
        if (Math.hypot(g.x - c.x, g.y - c.y) < 1.7 && los(s, c.x, c.y, g.x, g.y)) {
          startWork(s, c, { kind: 'takedown', id: g.id, total: g.type === 'heavy' ? 2.4 : 1.0, noise: 0, label: 'Takedown' }); return;
        }
      }
      return;
    }
    default: nextOrder(c);
  }
}

// ---------- guards ----------
function perceive(s: Sim, g: Guard, c: CrewUnit): number {
  const dx = c.x - g.x, dy = c.y - g.y; const d = Math.hypot(dx, dy);
  const R = g.range * (1 + 0.1 * s.alarm.level) * s.visMul * (g.type === 'swat' ? 1 : 1);
  if (d > R) return 0;
  if (d > 1.1 && Math.abs(angDiff(Math.atan2(dy, dx), g.angle)) > g.fov / 2) return 0;
  if (!los(s, g.x, g.y, c.x, c.y)) return 0;
  let m = 0.36 + 1.15 * (1 - d / R);
  if (c.sprint) m *= 1.5;
  if (c.disguise > 0 && g.type !== 'dog' && !c.sprint) m *= 0.2;
  if (c.status === 'ambush') m *= 0.5;
  if (g.type === 'heavy') m *= 1.25; if (g.type === 'dog') m *= 1.2; if (g.type === 'swat') m *= 3;
  return m * s.detMul * (s.alarm.level >= 1 ? 1.15 : 1);
}

function randTile(s: Sim, roomId: number): Pt | null {
  const rm = s.level.rooms[roomId]; const gp = guardPass(s);
  for (let k = 0; k < 12; k++) { const x = rm.x + Math.floor(s.rng() * rm.w), y = rm.y + Math.floor(s.rng() * rm.h); if (gp(x, y)) return { x, y }; }
  return null;
}
function pickSearchGoal(s: Sim, g: Guard): Pt {
  const anchor = s.alarm.level >= 2 && s.alarm.pos ? s.alarm.pos : g.last ?? { x: g.x, y: g.y };
  const rooms = s.level.rooms.filter((r) => r.kind !== 'vault');
  let best: Pt | null = null, bd = 1e9;
  for (let i = 0; i < 3; i++) {
    const r = rooms[Math.floor(s.rng() * rooms.length)]; const t = randTile(s, r.id); if (!t) continue;
    const d = Math.hypot(t.x - anchor.x, t.y - anchor.y); if (d < bd) { bd = d; best = t; }
  }
  return best ?? { x: Math.floor(g.x), y: Math.floor(g.y) };
}

function gotoGoal(s: Sim, g: Guard, goal: Pt, speed: number, dt: number): boolean {
  const key = goal.x + ',' + goal.y;
  g.repath -= dt;
  if (!g.path || g.pathKey !== key) {
    g.path = findPath(s.level.w, s.level.h, Math.floor(g.x), Math.floor(g.y), { x: goal.x, y: goal.y }, guardPass(s));
    g.pathKey = key; g.pi = 0;
    if (!g.path) { g.path = null; g.pathKey = ''; return true; }
  }
  const r = moveAlong(g as unknown as Mover, speed, dt);
  if (r === 1) { g.path = null; g.pathKey = ''; return true; }
  return false;
}

function attack(s: Sim, g: Guard, c: CrewUnit, dt: number) {
  if (c.kind === 'muscle' && (g.type === 'guard' || g.type === 'heavy') && c.hp > 1) {
    g.grapple += dt; c.label = 'Brawling!';
    if (g.grapple >= (g.type === 'heavy' ? 3 : 1.4)) { knockout(s, g, c); return; }
  }
  c.cuff += dt * 1.6;
  if (c.cuff >= 0.75) {
    c.cuff = 0; c.hp -= 1; c.hurt = 0.4; float(s, c.x, c.y, '-1 HP', '#ff4d5e'); sfx(s, 'hit'); s.shake = Math.max(s.shake, 0.5); burst(s, c.x, c.y, 6, '#ff4d5e');
    if (c.hp <= 0) capture(s, c);
  }
}

function stepGuard(s: Sim, g: Guard, dt: number) {
  const A = s.alarm;
  if (g.state === 'down') {
    g.downT -= dt;
    if (!g.found && !g.reported) {
      g.missT += dt;
      if (g.missT >= 24) {
        if (s.t < s.spoofUntil) { g.missT = 0; } else { g.reported = true; say(s, `${gname(g)} missed his radio check-in!`, 'warn'); raiseAlarm(s, 1, g.x, g.y, 'missed check-in'); }
      }
    }
    if (g.downT <= 0) { g.state = 'search'; g.huntN = 0; g.path = null; g.goal = null; g.aware = 0; say(s, `${gname(g)} woke up!`, 'warn'); raiseAlarm(s, 1, g.x, g.y, 'a guard woke up'); }
    return;
  }
  if (g.stun > 0) { g.stun -= dt; return; }
  const active_ = s.crew.filter(active);

  if (g.type === 'swat') {
    let tgt: CrewUnit | null = null, bd = 1e9;
    for (const c of active_) { const d = Math.hypot(c.x - g.x, c.y - g.y); if (d < bd) { bd = d; tgt = c; } }
    if (!tgt) return;
    g.repath -= dt;
    if (g.repath <= 0 || !g.path) {
      g.repath = 0.5; g.path = findPath(s.level.w, s.level.h, Math.floor(g.x), Math.floor(g.y), { x: Math.floor(tgt.x), y: Math.floor(tgt.y) }, (x, y) => {
        const L = s.level; if (x < 0 || y < 0 || x >= L.w || y >= L.h) return false; const t = L.tiles[y * L.w + x]; if (t !== T_FLOOR && t !== T_STREET) return false;
        const di = L.doorAt[y * L.w + x]; return !(di >= 0 && s.doors[di].kind === 'vault' && !s.doors[di].unlocked);
      }); g.pi = 0;
    }
    if (bd > 0.95) moveAlong(g as unknown as Mover, g.chaseSpeed, dt); else attack(s, g, tgt, dt);
    return;
  }

  // perception
  let best: CrewUnit | null = null, bestRate = 0;
  for (const c of active_) { const r = perceive(s, g, c); if (r > bestRate) { bestRate = r; best = c; } }
  g.seenNow = !!best;
  if (best) { g.aware = Math.min(1.2, g.aware + bestRate * dt); g.seenId = best.id; g.last = { x: Math.floor(best.x), y: Math.floor(best.y) }; g.lostT = 0; }
  else { g.aware = Math.max(0, g.aware - 0.3 * dt); g.lostT += dt; }

  // bodies
  for (const o of s.guards) {
    if (o.state !== 'down' || o.found) continue;
    const d = Math.hypot(o.x - g.x, o.y - g.y);
    if (d < g.range * s.visMul && Math.abs(angDiff(Math.atan2(o.y - g.y, o.x - g.x), g.angle)) < g.fov / 2 && los(s, g.x, g.y, o.x, o.y)) {
      o.found = true; s.stats.bodies++; say(s, `${gname(g)} found an unconscious guard!`, 'bad'); float(s, g.x, g.y, '!?', '#ffb347');
      raiseAlarm(s, 1, o.x, o.y, 'body discovered'); g.state = 'investigate'; g.goal = { x: Math.floor(o.x), y: Math.floor(o.y) }; g.pathKey = ''; g.huntN = 0;
    }
  }

  const spotNow = best && g.aware >= 1;
  if (spotNow && g.state !== 'chase') {
    s.stats.spotted++; say(s, `${gname(g)} spotted ${(best as CrewUnit).name}!`, 'bad'); float(s, g.x, g.y - 0.6, '!', '#ff4d5e'); sfx(s, 'alert');
    raiseAlarm(s, 2, (best as CrewUnit).x, (best as CrewUnit).y, `${gname(g)} spotted ${(best as CrewUnit).name}`);
    g.state = 'chase'; g.path = null; g.pathKey = '';
  } else if (!spotNow && best && g.aware > 0.3 && g.state !== 'chase') {
    if (g.state !== 'alert') { sfx(s, 'susp'); float(s, g.x, g.y - 0.6, '?', '#ffd35c'); }
    g.state = 'alert'; g.path = null; g.pathKey = '';
  }

  const aMul = 1 + 0.08 * A.level;
  switch (g.state) {
    case 'alert': {
      if (best) g.angle = turnTo(g.angle, Math.atan2(best.y - g.y, best.x - g.x), 5 * dt);
      else if (g.aware < 0.18) { g.state = 'investigate'; g.goal = g.last; g.pathKey = ''; g.run = false; g.huntN = 0; }
      break;
    }
    case 'chase': {
      const tgt = s.crew.find((c) => c.id === g.seenId);
      if (!tgt || !active(tgt) || g.lostT > 4) { g.state = 'search'; g.huntN = 0; g.path = null; g.pathKey = ''; g.goal = null; break; }
      g.pingT -= dt; if (g.pingT <= 0 && best) { g.pingT = 3; radio(s, tgt.x, tgt.y); A.pos = { x: tgt.x, y: tgt.y }; A.last = s.t; }
      g.repath -= dt;
      if (g.repath <= 0 || !g.path) {
        g.repath = 0.35; const tx = best ? Math.floor(tgt.x) : g.last ? g.last.x : Math.floor(tgt.x), ty = best ? Math.floor(tgt.y) : g.last ? g.last.y : Math.floor(tgt.y);
        g.path = findPath(s.level.w, s.level.h, Math.floor(g.x), Math.floor(g.y), { x: tx, y: ty }, guardPass(s)); g.pi = 0; g.pathKey = '';
      }
      const d = Math.hypot(tgt.x - g.x, tgt.y - g.y);
      if (d < 0.95) { g.angle = Math.atan2(tgt.y - g.y, tgt.x - g.x); attack(s, g, tgt, dt); }
      else moveAlong(g as unknown as Mover, g.chaseSpeed, dt);
      break;
    }
    case 'investigate': {
      if (!g.goal) { g.state = 'look'; g.timer = 1.5; g.lookBase = g.angle; break; }
      if (gotoGoal(s, g, g.goal, g.speed * (g.run ? 1.7 : 1.3) * aMul, dt)) { g.state = 'look'; g.timer = 2.4; g.lookBase = g.angle; g.goal = null; }
      break;
    }
    case 'look': {
      g.timer -= dt; g.angle = g.lookBase + Math.sin((s.t + g.phase) * 2.2) * 1.1;
      if (g.timer <= 0) {
        const lim = A.level >= 1 ? 3 : 1;
        if (A.level >= 2 || g.huntN < lim) { g.state = 'search'; g.goal = pickSearchGoal(s, g); g.pathKey = ''; g.huntN++; } else { g.state = 'patrol'; g.path = null; g.pathKey = ''; }
      }
      break;
    }
    case 'search': {
      if (!g.goal) g.goal = pickSearchGoal(s, g);
      if (gotoGoal(s, g, g.goal, g.speed * 1.25 * aMul, dt)) { g.state = 'look'; g.timer = 1.6; g.lookBase = g.angle; g.goal = null; }
      break;
    }
    case 'wait': {
      g.timer -= dt; g.angle = g.lookBase + Math.sin((s.t + g.phase) * 1.3) * 0.9;
      if (g.timer <= 0) { g.ri = (g.ri + 1) % g.route.length; g.state = 'patrol'; g.path = null; g.pathKey = ''; }
      break;
    }
    default: { // patrol
      const wp = g.route[g.ri];
      if (gotoGoal(s, g, wp, g.speed * aMul, dt)) { g.state = 'wait'; g.timer = wp.wait; g.lookBase = g.angle; }
    }
  }
}

function hear(s: Sim, g: Guard, p: Ping) {
  if (g.state === 'down' || g.state === 'chase' || g.type === 'swat' || g.stun > 0) return;
  if (p.kind === 'noise') {
    const d = Math.hypot(g.x - p.x, g.y - p.y); let eff = d * (los(s, g.x, g.y, p.x, p.y) ? 1 : 1.7);
    if (g.type === 'dog') eff *= 0.65; if (eff > p.max) return;
    g.aware = Math.max(g.aware, 0.15);
  }
  g.state = 'investigate'; g.goal = { x: Math.floor(p.x), y: Math.floor(p.y) }; g.pathKey = ''; g.run = p.kind === 'radio'; g.huntN = 0;
}

// ---------- gadgets / orders ----------
export function useGadget(s: Sim, id: GadgetId, x: number, y: number): string | null {
  if (s.over) return 'Heist is over';
  if ((s.gadgets[id] ?? 0) <= 0) return 'None left';
  if (!s.crew.some((c) => active(c) && Math.hypot(c.x - x, c.y - y) < 13)) return 'Out of range of your crew';
  const L = s.level; if (x < 0 || y < 0 || x >= L.w || y >= L.h) return 'Invalid target';
  switch (id) {
    case 'smoke': s.smokes.push({ x, y, r: 2.7, until: s.t + 9 }); burst(s, x, y, 24, '#9fb0c8', 2.4, 1.2); break;
    case 'emp': {
      for (const c of s.cams) if (Math.hypot(c.x - x, c.y - y) < 12) c.off = s.t + 18;
      for (const l of s.lasers) if (Math.hypot(l.x - x, (l.y1 + l.y2) / 2 - y) < 12) l.offUntil = Math.max(l.offUntil, s.t + 18);
      s.flash = 0.5; burst(s, x, y, 30, '#6ee7ff', 5, 0.7); break;
    }
    case 'decoy': s.decoys.push({ x, y, until: s.t + 6, next: s.t }); break;
    case 'tranq': {
      let best: Guard | null = null, bd = 3.2;
      for (const g of s.guards) { if (g.type === 'swat' || g.state === 'down') continue; const d = Math.hypot(g.x - x, g.y - y); if (d < bd) { bd = d; best = g; } }
      if (!best) return 'No guard near that spot';
      knockout(s, best, null, true); best.downT = 25; best.missT = -12; say(s, `Tranq dart hit ${gname(best)}.`, 'good'); break;
    }
  }
  s.gadgets[id]--; s.gadgetsUsed++; sfx(s, id === 'emp' ? 'emp' : 'gadget'); say(s, `Deployed ${id}.`);
  return null;
}
export function bailAll(s: Sim) {
  const ex = s.level.exit; let n = 0;
  for (const c of s.crew) if (active(c) && !c.aborted) { abortCrew(s, c, true); n++; }
  if (n) { say(s, 'BAIL! Everyone to the van!', 'warn'); sfx(s, 'alert'); }
  void ex;
}
export function abortCrew(s: Sim, c: CrewUnit, quiet = false) {
  if (!active(c)) return;
  const ex = s.level.exit; c.orders = [{ type: 'exit', x: ex.x, y: ex.y }]; c.oi = 0; c.path = null; c.pathFor = -1; c.work = null; c.egress = true; c.aborted = true; c.stuck = 0; c.retry = 0; c.timer = 0;
  if (!quiet) say(s, `${c.name} bails out.`, 'warn');
}

// ---------- main step ----------
export function stepSim(s: Sim, dt: number) {
  if (s.over) return;
  s.t += dt;
  const L = s.level; const A = s.alarm; const P = s.police; const D = DIFFS[s.cfg.diff];
  // doors
  for (const d of s.doors) {
    const cx = d.x + 0.5, cy = d.y + 0.5; let near = false;
    if (d.kind === 'open' || d.unlocked) for (const c of s.crew) if (active(c) && Math.abs(c.x - cx) < 1.1 && Math.abs(c.y - cy) < 1.1) { near = true; break; }
    if (!near && (d.kind !== 'vault' || d.unlocked)) for (const g of s.guards) if (g.state !== 'down' && Math.abs(g.x - cx) < 1.1 && Math.abs(g.y - cy) < 1.1) { near = true; break; }
    d.open = clamp(d.open + (near ? 6 : -6) * dt, 0, 1);
  }
  // fx
  for (const f of s.floats) f.age += dt; s.floats = s.floats.filter((f) => f.age < f.life);
  for (const p of s.parts) { p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; } s.parts = s.parts.filter((p) => p.age < p.life);
  s.shake = Math.max(0, s.shake - dt * 2.2); s.flash = Math.max(0, s.flash - dt * 2);
  s.smokes = s.smokes.filter((m) => m.until > s.t);
  for (const dc of s.decoys) if (s.t >= dc.next && dc.until > s.t) { dc.next = s.t + 1.5; noise(s, dc.x, dc.y, 16); sfx(s, 'ping'); }
  s.decoys = s.decoys.filter((d) => d.until > s.t);

  // crew
  for (const c of s.crew) stepCrew(s, c, dt);

  // cameras
  for (const cs of s.cams) {
    cs.angle = cs.base + Math.sin(s.t * cs.speed + cs.phase) * cs.sweep; cs.cool -= dt;
    if (cs.off > s.t || s.camOff > s.t) { cs.aware = 0; continue; }
    const cx = cs.x + 0.5, cy = cs.y + 0.5; let best = 0, who: CrewUnit | null = null;
    for (const c of s.crew) {
      if (!active(c)) continue; const dx = c.x - cx, dy = c.y - cy; const d = Math.hypot(dx, dy);
      if (d > cs.range || Math.abs(angDiff(Math.atan2(dy, dx), cs.angle)) > cs.fov / 2) continue;
      if (!los(s, cx, cy, c.x, c.y)) continue;
      let r = (0.5 + 1.0 * (1 - d / cs.range)) * s.detMul; if (c.disguise > 0 && !c.sprint) r *= 0.5; if (c.sprint) r *= 1.3;
      if (r > best) { best = r; who = c; }
    }
    if (best > 0) cs.aware = Math.min(1.1, cs.aware + best * dt); else cs.aware = Math.max(0, cs.aware - 0.4 * dt);
    if (cs.aware >= 1 && cs.cool <= 0 && who) {
      cs.aware = 0.35; cs.cool = 6; s.stats.camTrips++; s.known.add(cs.id); sfx(s, 'camera');
      say(s, `A camera caught ${who.name}!`, 'bad'); float(s, who.x, who.y, 'CAM!', '#ff4d5e'); raiseAlarm(s, 1, who.x, who.y, 'camera spotted ' + who.name);
    }
  }
  // lasers
  for (const l of s.lasers) {
    l.cool -= dt; if (l.cool > 0 || !laserOn(s, l)) continue;
    for (const c of s.crew) {
      if (!active(c)) continue;
      if (Math.abs(c.x - (l.x + 0.5)) < 0.28 && c.y >= l.y1 && c.y <= l.y2 + 1) {
        l.cool = 4; s.stats.laserTrips++; s.known.add(l.id); sfx(s, 'laser'); s.shake = Math.max(s.shake, 0.4);
        say(s, `${c.name} tripped a laser!`, 'bad'); float(s, c.x, c.y, 'LASER!', '#ff4d5e'); raiseAlarm(s, 1, c.x, c.y, c.name + ' tripped a laser'); break;
      }
    }
  }
  // guards
  for (const g of s.guards) stepGuard(s, g, dt);
  // pings
  for (const p of s.pings) {
    p.r += p.speed * dt;
    for (const g of s.guards) { if (p.hit.has(g.id)) continue; if (Math.hypot(g.x - p.x, g.y - p.y) <= p.r) { p.hit.add(g.id); hear(s, g, p); } }
  }
  s.pings = s.pings.filter((p) => p.r < p.max);

  // discovery
  s.discT -= dt;
  if (s.discT <= 0) {
    s.discT = 0.3;
    for (const c of s.crew) {
      if (!active(c)) continue;
      const chk = (id: string, x: number, y: number, r: number, txt: string) => { if (!s.known.has(id) && Math.hypot(c.x - x, c.y - y) < r && los(s, c.x, c.y, x, y)) { s.known.add(id); float(s, x, y, txt, '#6ee7ff'); } };
      for (const cm of s.cams) chk(cm.id, cm.x + 0.5, cm.y + 0.5, 8, 'Camera!');
      for (const l of s.lasers) chk(l.id, l.x + 0.5, (l.y1 + l.y2 + 1) / 2, 6, 'Laser grid!');
      for (const it of s.items) chk(it.id, it.x + 0.5, it.y + 0.5, 4.5, it.label);
      for (const d of s.doors) chk(d.id, d.x + 0.5, d.y + 0.5, 4.5, d.kind);
    }
  }

  // alarm decay
  if (A.level === 1 && s.t - A.last > 40) { A.level = 0; say(s, 'Guards stand down.'); }
  if (A.level === 2 && P.state === 'none' && s.t - A.last > 60) { A.level = 1; say(s, 'Alarm subsides to alert.'); }
  // police
  if (P.state === 'none' && s.t > L.timeLimit && !s.cfg.tutorial) { P.state = 'pending'; P.t = 0.1; say(s, 'Neighbors heard the commotion... time is up!', 'warn'); }
  if (P.state === 'pending') {
    P.t -= dt;
    if (P.t <= 0) {
      P.state = 'enroute'; A.level = 3; A.max = 3;
      const tier = Math.min(4, Math.floor(s.cfg.heat / 20));
      P.eta = Math.max(25, 80 - tier * 7 + s.cfg.garage * 12 + D.eta); say(s, `POLICE DISPATCHED! ETA ${Math.round(P.eta)}s. Get out!`, 'bad'); sfx(s, 'siren'); s.shake = 0.8;
    }
  } else if (P.state === 'enroute') {
    P.eta -= dt;
    if (P.eta <= 0) {
      P.state = 'arrived'; P.arrivedT = s.t; sfx(s, 'siren'); s.shake = 1; say(s, 'POLICE HAVE ARRIVED! SWAT is breaching the entrance!', 'bad');
      if (!s.swatSpawned) {
        s.swatSpawned = true; const n = 2 + Math.floor(L.tier / 2);
        for (let i = 0; i < n; i++) { const g = mkGuard('s' + i, 90 + i, 'swat', [{ x: 3, y: L.cy + (i % 3), wait: 0 }], 0, [], false, s.rng); g.x = 3.5; g.y = L.cy + 0.5 + (i % 3); s.guards.push(g); }
      }
    }
  } else if (P.state === 'arrived') {
    if (s.t - P.arrivedT > 30 + D.escWindow * 2) { for (const c of s.crew) if (active(c)) capture(s, c); }
  }

  // end
  if (s.overT < 0 && s.crew.every((c) => !active(c))) s.overT = 1.1;
  if (s.overT >= 0) { s.overT -= dt; if (s.overT <= 0) finishSim(s); }
}

export function finishSim(s: Sim) {
  if (s.over) return; s.over = true;
  const lootValue = s.secured.reduce((a, l) => a + l.value, 0);
  const cap = s.stats.captured.length;
  const stars = s.targetSecured ? 1 + (s.alarm.max === 0 ? 1 : 0) + (cap === 0 && s.police.state !== 'arrived' ? 1 : 0) : 0;
  s.result = {
    success: s.targetSecured, targetSecured: s.targetSecured, loot: s.secured.slice(), lootValue, lootLost: s.lostValue, alarmMax: s.alarm.max, captured: s.stats.captured.slice(), escaped: s.stats.escaped.slice(),
    time: s.t, guardsDowned: s.stats.downed, spotted: s.stats.spotted, camTrips: s.stats.camTrips, laserTrips: s.stats.laserTrips, bodies: s.stats.bodies, gadgetsUsed: s.gadgetsUsed, stars,
    policeArrived: s.police.state === 'arrived',
  };
}

export function guardVisible(s: Sim, g: Guard): boolean {
  if (s.trackGuards || g.state === 'chase' || g.type === 'swat') return true;
  for (const c of s.crew) if (active(c) && Math.hypot(c.x - g.x, c.y - g.y) < 11 && los(s, c.x, c.y, g.x, g.y)) return true;
  return false;
}
