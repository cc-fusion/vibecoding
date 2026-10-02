import type { Campaign, Crew, Door, GadgetId, GType, HeistDef, HeistResult, Laser, LootItem, Mods, Mode, P, Plan, Skill, Step, Thing, World } from './types';
import { findPath } from './mapgen';
import { heatTier } from './data';

export type GState = 'patrol' | 'suspicious' | 'investigate' | 'alert' | 'hunt' | 'down' | 'chat';
export interface GuardS {
  id: number; type: GType; x: number; y: number; ang: number; baseAng: number; hp: number; maxHp: number; route: P[]; ri: number; state: GState;
  path: P[] | null; goal: number; tx: number; ty: number; sus: number; susT: number; pause: number; radio: number; chase: string | null; last: P | null;
  lostT: number; stun: number; hidden: boolean; found: boolean; chatT: number; chatWith: string | null; atkT: number; repath: number; witnessed: boolean; inv: number; huntT: number; cd: number;
}
export interface Work { oid: number; t: number; total: number; noise: number; label: string; loud: boolean; auto: boolean; key: boolean; nt: number }
export interface CrewS {
  id: string; ref: Crew; x: number; y: number; ang: number; hp: number; maxHp: number; state: 'idle' | 'move' | 'work' | 'wait' | 'ambush' | 'out' | 'down';
  steps: Step[]; si: number; path: P[] | null; pathKey: string; mode: Mode; work: Work | null; carry: LootItem[]; stun: number; grab: boolean; noiseT: number;
  vanish: number; hurt: number; used: boolean; idleT: number; label: string; xp: number; eg: number | null; takedowns: number; trail: P[]; trailT: number;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
export interface Floater { x: number; y: number; text: string; color: string; t: number; life: number; big: boolean }
export interface SimCfg { detect: number; eta: number; improvMax: number; diff: 0 | 1 | 2; mods: Mods; heat: number; garage: number }
export interface Wave { x: number; y: number; dist: Int16Array; r: number; max: number; done: Set<number> }

export interface Sim {
  w: World; cfg: SimCfg; t: number; status: 'plan' | 'run' | 'done'; crew: CrewS[]; guards: GuardS[];
  byId: Map<number, Thing>; doorIdx: (Door | null)[]; laserAt: (Laser | null)[];
  alarm: number; alarmT: number; full: boolean; eta: number; police: boolean; vanGone: boolean; jam: number; signals: Set<number>;
  smoke: { x: number; y: number; r: number; t: number }[]; decoys: { x: number; y: number; t: number; n: number }[];
  waves: Wave[]; ripples: { x: number; y: number; r: number; t: number; color: string }[]; particles: Particle[]; floaters: Floater[];
  shake: number; flash: number; gadgets: Record<GadgetId, number>; used: Record<GadgetId, number>; improv: number; improvT: number;
  stats: { alarms: number; spotted: number; bodies: number; downed: number; arrests: number; captainDown: boolean };
  sfx: string[]; log: { t: number; msg: string; color: string }[]; primaryTaken: boolean; extracted: LootItem[]; extractedIds: string[]; endT: number;
  result: HeistResult | null; nid: number; totalLoot: number; abortFlag: boolean;
}

const GT: Record<GType, { spd: number; aspd: number; range: number; fov: number; hp: number }> = {
  guard: { spd: 2.0, aspd: 4.0, range: 7, fov: 1.45, hp: 60 },
  sentinel: { spd: 2.0, aspd: 3.6, range: 8, fov: 1.3, hp: 70 },
  k9: { spd: 2.8, aspd: 5.0, range: 6, fov: 1.6, hp: 40 },
  drone: { spd: 2.3, aspd: 3.2, range: 6.5, fov: 2.0, hp: 999 },
  captain: { spd: 2.4, aspd: 4.5, range: 9, fov: 1.9, hp: 260 },
  cop: { spd: 3.2, aspd: 4.6, range: 9, fov: 1.8, hp: 70 },
};
export const GUARD_LABEL: Record<GType, string> = { guard: 'Guard', sentinel: 'Sentinel', k9: 'K9 Unit', drone: 'Drone', captain: 'Captain Voss', cop: 'Police' };

const angDiff = (a: number, b: number) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const turn = (a: number, b: number, k: number) => a + angDiff(a, b) * Math.min(1, k);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function makeCfg(c: Campaign, def: HeistDef): SimCfg {
  let eta = def.eta * [1.3, 1, 0.8][c.diff] + (c.upg.garage || 0) * 12 - c.heat * 0.3;
  if (c.mods.fuse) eta *= 0.65;
  return { detect: [0.8, 1, 1.2][c.diff], eta: Math.max(25, eta), improvMax: Math.max(1, 3 + (c.upg.comms || 0) + [1, 0, -1][c.diff]), diff: c.diff, mods: c.mods, heat: c.heat, garage: c.upg.garage || 0 };
}
export const extraGuards = (c: Campaign) => heatTier(c.heat) + [-1, 0, 1][c.diff];

export const thingDone = (t: Thing) => t.kind === 'door' ? !t.locked : t.kind === 'camera' ? t.off > 0 : t.kind === 'terminal' ? t.done : t.kind === 'safe' ? t.opened : t.taken;
export const thingCenter = (t: { x: number; y: number }): P => ({ x: t.x + 0.5, y: t.y + 0.5 });
export const camPos = (c: { x: number; y: number; base: number }): P => ({ x: c.x + 0.5 + Math.cos(c.base) * 0.6, y: c.y + 0.5 + Math.sin(c.base) * 0.6 });
export const laserOn = (s: Sim, l: Laser) => l.off <= 0 && (s.t + l.phase) % l.period < l.onT;
export const carryCap = (c: CrewS) => (c.ref.role === 'muscle' ? 4 : 2);
export const carryW = (c: CrewS) => c.carry.reduce((a, b) => a + b.weight, 0);

export function createSim(world: World, crew: Crew[], plan: Plan, loadout: Record<GadgetId, number>, cfg: SimCfg): Sim {
  const w: World = structuredClone(world);
  const byId = new Map<number, Thing>();
  const doorIdx: (Door | null)[] = new Array(w.w * w.h).fill(null);
  const laserAt: (Laser | null)[] = new Array(w.w * w.h).fill(null);
  let total = 0;
  w.things.forEach(t => {
    byId.set(t.id, t);
    if (t.kind === 'door') doorIdx[t.y * w.w + t.x] = t;
    if (t.kind === 'loot') total += t.item.value;
    if (t.kind === 'safe') t.contents.forEach(i => { total += i.value; });
  });
  w.lasers.forEach(l => l.tiles.forEach(p => { laserAt[p.y * w.w + p.x] = l; }));
  const crewS: CrewS[] = crew.map((ref, i) => {
    const sp = w.spawns[i % w.spawns.length];
    const hp = 100 + (ref.trait === 'brawler' ? 25 : 0);
    return { id: ref.id, ref, x: sp.x, y: sp.y, ang: 0, hp, maxHp: hp, state: 'idle', steps: structuredClone(plan[ref.id] || []), si: 0, path: null, pathKey: '', mode: 'walk', work: null, carry: [], stun: 0, grab: false, noiseT: 0, vanish: 0, hurt: 0, used: false, idleT: 0, label: 'Ready', xp: 0, eg: null, takedowns: 0, trail: [], trailT: 0 };
  });
  const guards: GuardS[] = w.guards.map(g => ({
    id: g.id, type: g.type, x: g.x, y: g.y, ang: Math.random() * 6.28, baseAng: Math.random() * 6.28, hp: GT[g.type].hp, maxHp: GT[g.type].hp, route: g.route, ri: g.route.length > 1 ? 1 : 0, state: 'patrol',
    path: null, goal: -1, tx: 0, ty: 0, sus: 0, susT: 0, pause: 0.5 + Math.random() * 2, radio: 0, chase: null, last: null, lostT: 0, stun: 0, hidden: false, found: false, chatT: 0, chatWith: null, atkT: 0, repath: 0, witnessed: false, inv: 0, huntT: 0, cd: 3,
  }));
  return {
    w, cfg, t: 0, status: 'plan', crew: crewS, guards, byId, doorIdx, laserAt, alarm: 0, alarmT: 0, full: false, eta: cfg.eta, police: false, vanGone: false, jam: 0, signals: new Set(),
    smoke: [], decoys: [], waves: [], ripples: [], particles: [], floaters: [], shake: 0, flash: 0, gadgets: { ...loadout }, used: { smoke: 0, emp: 0, decoy: 0, dart: 0, key: 0 },
    improv: cfg.improvMax, improvT: 0, stats: { alarms: 0, spotted: 0, bodies: 0, downed: 0, arrests: 0, captainDown: false }, sfx: [], log: [], primaryTaken: false, extracted: [], extractedIds: [],
    endT: 0, result: null, nid: 100000, totalLoot: total, abortFlag: false,
  };
}

/* ---------- helpers ---------- */
const tileIdx = (s: Sim, x: number, y: number) => Math.floor(y) * s.w.w + Math.floor(x);
export function fl(s: Sim, x: number, y: number, text: string, color = '#fff', big = false) { s.floaters.push({ x, y, text, color, t: 0, life: big ? 1.8 : 1.3, big }); if (s.floaters.length > 60) s.floaters.shift(); }
export function burst(s: Sim, x: number, y: number, color: string, n: number, sp = 3) {
  for (let i = 0; i < n && s.particles.length < 500; i++) {
    const a = Math.random() * 6.283, v = (0.3 + Math.random()) * sp;
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.6, max: 1.1, color, size: 0.06 + Math.random() * 0.08 });
  }
}
const say = (s: Sim, msg: string, color = '#cbd5e1') => { s.log.push({ t: s.t, msg, color }); if (s.log.length > 40) s.log.shift(); };
const snd = (s: Sim, n: string) => { if (s.sfx.length < 20) s.sfx.push(n); };

export function los(s: Sim, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy), n = Math.ceil(d / 0.3);
  for (let k = 1; k < n; k++) {
    const t = k / n, x = x0 + dx * t, y = y0 + dy * t, i = Math.floor(y) * s.w.w + Math.floor(x);
    if (!s.w.tiles[i]) return false;
    const dr = s.doorIdx[i];
    if (dr && (dr.locked || dr.open < 0.55)) return false;
    for (const sm of s.smoke) if ((x - sm.x) ** 2 + (y - sm.y) ** 2 < sm.r * sm.r) return false;
  }
  return true;
}
const inCone = (ang: number, dx: number, dy: number, fov: number) => Math.abs(angDiff(ang, Math.atan2(dy, dx))) <= fov / 2;
const roomDark = (s: Sim, x: number, y: number) => { const r = s.w.roomId[tileIdx(s, x, y)]; return r > 0 && s.w.rooms[r - 1].dark; };
const activeCrew = (c: CrewS) => c.state !== 'out' && c.state !== 'down';

function guardCost(s: Sim, drone: boolean) { return (i: number) => (drone ? (s.w.tiles[i] !== 0 ? 1 : -1) : s.w.tiles[i] === 1 ? 1 : -1); }
function crewCost(s: Sim) { return (i: number) => { if (s.w.tiles[i] !== 1) return -1; const d = s.doorIdx[i]; return d && d.locked ? 6 : 1; }; }

/* ---------- alarm ---------- */
function startWave(s: Sim, x: number, y: number) {
  const { w, h } = s.w;
  const dist = new Int16Array(w * h).fill(-1);
  const st = tileIdx(s, x, y);
  if (!s.w.tiles[st]) return;
  const q = [st];
  dist[st] = 0;
  let max = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], cx = i % w, cy = (i - cx) / w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!s.w.tiles[ni] || dist[ni] >= 0) continue;
      dist[ni] = dist[i] + 1; max = Math.max(max, dist[ni]); q.push(ni);
    }
  }
  s.waves.push({ x, y, dist, r: 0, max, done: new Set() });
  if (s.waves.length > 4) s.waves.shift();
}

function raise(s: Sim, amount: number, x: number, y: number, reason: string, wave = true) {
  if (s.jam > 0) { fl(s, x, y - 0.7, 'JAMMED', '#38bdf8'); return; }
  const mult = s.cfg.mods.fuse ? 1.35 : 1;
  s.alarm = Math.min(100, s.alarm + amount * mult);
  s.alarmT = 0;
  s.stats.alarms++;
  say(s, reason, '#fca5a5');
  snd(s, 'alert');
  if (wave) startWave(s, x, y);
  s.shake = Math.max(s.shake, 0.25);
  if (s.alarm >= 100 && !s.full) triggerFull(s, x, y);
}

function triggerFull(s: Sim, x: number, y: number) {
  s.full = true;
  s.eta = s.cfg.eta;
  say(s, `FULL ALARM! Police ETA ${Math.round(s.eta)}s`, '#ef4444');
  fl(s, x, y - 1, 'ALARM!', '#ef4444', true);
  snd(s, 'siren');
  s.flash = 1;
  s.shake = 0.8;
  startWave(s, x, y);
  s.guards.forEach(g => { if (g.state !== 'down' && g.state !== 'alert') { g.state = 'hunt'; g.huntT = 0; g.path = null; } });
}

function noise(s: Sim, x: number, y: number, r: number, force = false) {
  if (r <= 0) return;
  if (r >= 3) s.ripples.push({ x, y, r, t: 0, color: '#fde68a' });
  for (const g of s.guards) {
    if (g.state === 'down' || g.state === 'alert' || g.state === 'hunt' || g.stun > 0) continue;
    const d = Math.hypot(g.x - x, g.y - y);
    const eff = r * (force || los(s, g.x, g.y, x, y) ? 1 : 0.6) * (g.type === 'k9' ? 1.4 : 1);
    if (d <= eff) { if (g.state !== 'chat' || force) investigate(g, x, y, 5); g.sus = Math.max(g.sus, 0.2); }
  }
}

function investigate(g: GuardS, x: number, y: number, t = 6) {
  if (g.state === 'alert' || g.state === 'down') return;
  g.state = 'investigate'; g.tx = x; g.ty = y; g.inv = t; g.path = null; g.goal = -1;
}

function becomeAlert(s: Sim, g: GuardS, c: CrewS | null) {
  if (g.state === 'down') return;
  g.state = 'alert'; g.chase = c ? c.id : g.chase; g.radio = g.type === 'drone' ? 1.2 : 2.2; g.lostT = 0; g.sus = 1; g.path = null; g.goal = -1;
  if (!g.witnessed) { g.witnessed = true; s.stats.spotted++; }
  fl(s, g.x, g.y - 0.8, '!', '#ef4444', true);
  snd(s, 'spot');
  say(s, `${GUARD_LABEL[g.type]} spotted ${c ? c.ref.name : 'someone'}!`, '#fca5a5');
  for (const o of s.guards) {
    if (o !== g && (o.state === 'patrol' || o.state === 'chat') && Math.hypot(o.x - g.x, o.y - g.y) < 6) investigate(o, g.x, g.y, 6);
  }
}

function downGuard(s: Sim, g: GuardS, c: CrewS | null, silent: boolean, hide: boolean) {
  g.state = 'down'; g.hp = 0; g.hidden = hide; g.radio = 0; g.path = null;
  s.stats.downed++;
  if (g.type === 'captain') { s.stats.captainDown = true; say(s, 'Captain Voss is down!', '#4ade80'); fl(s, g.x, g.y - 1, 'BOSS DOWN', '#facc15', true); s.shake = 0.8; }
  else fl(s, g.x, g.y - 0.8, silent ? 'Silent takedown' : 'Takedown!', '#4ade80');
  burst(s, g.x, g.y, '#fff', 12, 2.5);
  snd(s, silent ? 'whisper' : 'punch');
  if (c) { c.xp += 12; c.takedowns++; }
}

/* ---------- interaction ---------- */
const skillMult = (l: number) => (l >= 1 ? 1.55 - 0.22 * l : 2.8);
export function useInfo(c: CrewS | null, th: Thing, key: boolean, hasKey = false) {
  const L = (k: Skill) => (c ? c.ref.skills[k] : 1);
  if (key && hasKey && th.kind !== 'loot') return { time: 0.8, noise: 0, label: 'Master key', loud: false };
  switch (th.kind) {
    case 'door': {
      if (th.lock === 'pick') { const l = L('pick'); return { time: 5 * skillMult(l), noise: l >= 3 ? 0.8 : l >= 1 ? 2 : 9, label: 'Picking lock', loud: l < 1 }; }
      if (th.lock === 'hack') { const l = L('hack'); return { time: 5 * skillMult(l), noise: l >= 1 ? 0 : 6, label: 'Hacking door', loud: l < 1 }; }
      const l = Math.max(L('force'), L('crack'));
      return { time: 7 * skillMult(l), noise: l >= 1 ? 7 : 10, label: 'Breaching door', loud: l < 1 };
    }
    case 'camera': { const l = L('hack'); return { time: 3 * skillMult(l), noise: 0, label: 'Disabling camera', loud: false }; }
    case 'terminal': { const l = L('hack'); return { time: 4 * skillMult(l), noise: 0, label: 'Hacking terminal', loud: l < 1 }; }
    case 'safe': { const l = L('crack'); return { time: (4 + th.tier * 3.2) * skillMult(l), noise: l >= 3 ? 0 : l >= 1 ? 2.5 : 6, label: `Cracking safe${th.stages > 1 ? ` ${th.stage + 1}/${th.stages}` : ''}`, loud: l < 1 }; }
    default: return { time: 1.1, noise: 0, label: 'Grabbing loot', loud: false };
  }
}

function approach(s: Sim, th: Thing): number[] {
  const out: number[] = [];
  const { w, h } = s.w;
  if (th.kind !== 'door' && th.kind !== 'camera' && s.w.tiles[th.y * w + th.x] === 1) out.push(th.y * w + th.x);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = th.x + dx, ny = th.y + dy;
    if (nx >= 0 && ny >= 0 && nx < w && ny < h && s.w.tiles[ny * w + nx] === 1) out.push(ny * w + nx);
  }
  return out;
}

function giveLoot(s: Sim, c: CrewS, item: LootItem): boolean {
  if (carryW(c) + item.weight > carryCap(c)) return false;
  c.carry.push(item);
  if (item.primary && !s.primaryTaken) { s.primaryTaken = true; fl(s, c.x, c.y - 1, 'PRIZE SECURED!', '#facc15', true); say(s, `${c.ref.name} has the ${item.name}!`, '#facc15'); snd(s, 'prize'); s.flash = 0.5; }
  else { fl(s, c.x, c.y - 0.8, `${item.icon} ${item.name}`, '#fde68a'); snd(s, 'coin'); }
  return true;
}
function dropLoot(s: Sim, x: number, y: number, item: LootItem) {
  s.byId.set(s.nid, { kind: 'loot', id: s.nid, x: Math.floor(x), y: Math.floor(y), item, taken: false });
  s.w.things.push(s.byId.get(s.nid)!);
  s.nid++;
}

function openSafe(s: Sim, c: CrewS | null, th: Extract<Thing, { kind: 'safe' }>) {
  th.opened = true;
  const px = th.x + 0.5, py = th.y + 0.5;
  burst(s, px, py, '#facc15', 16, 3);
  th.contents.forEach(it => { if (!c || !giveLoot(s, c, it)) { dropLoot(s, px, py, it); fl(s, px, py - 0.6, 'Loot spilled - too heavy', '#fbbf24'); } });
}

function applyUse(s: Sim, c: CrewS, th: Thing, key: boolean, loud: boolean) {
  const px = th.x + 0.5, py = th.y + 0.5;
  if (key && th.kind !== 'loot' && s.gadgets.key > 0) { s.gadgets.key--; s.used.key++; }
  else key = false;
  if (!key && loud && th.kind !== 'loot' && c.ref.trait !== 'lucky' && Math.random() < 0.35) raise(s, 20, px, py, `${c.ref.name}'s clumsy work tripped a tamper alarm`);
  c.xp += 6;
  switch (th.kind) {
    case 'door': th.locked = false; th.tampered = th.lock !== 'none'; fl(s, px, py - 0.6, 'Unlocked', '#86efac'); snd(s, 'unlock'); burst(s, px, py, '#86efac', 8, 2); break;
    case 'camera': th.off = 9999; fl(s, px, py - 0.6, 'Camera disabled', '#7dd3fc'); snd(s, 'unlock'); break;
    case 'terminal': {
      th.done = true; snd(s, 'unlock');
      if (th.effect === 'cam') { s.w.things.forEach(t => { if (t.kind === 'camera' && t.off < 9000) t.off = Math.max(t.off, 35); }); fl(s, px, py - 0.6, 'Cameras offline 35s', '#7dd3fc'); }
      else if (th.effect === 'laser') { s.w.lasers.forEach(l => { l.off = Math.max(l.off, 40); }); fl(s, px, py - 0.6, 'Lasers offline 40s', '#7dd3fc'); }
      else { s.w.things.forEach(t => { if (t.kind === 'door' && t.lock === 'hack' && t.locked) { t.locked = false; } }); fl(s, px, py - 0.6, 'Electronic locks open', '#7dd3fc'); }
      say(s, `${c.ref.name} hacked the ${th.effect} terminal`, '#7dd3fc');
      break;
    }
    case 'safe': {
      th.stage++;
      snd(s, 'unlock');
      if (th.stage >= th.stages) { openSafe(s, c, th); say(s, `${c.ref.name} cracked the ${th.vault ? 'vault' : 'safe'}`, '#facc15'); }
      else { fl(s, px, py - 0.6, `Stage ${th.stage}/${th.stages}`, '#facc15'); }
      if (th.vault && th.stages > 1) raise(s, 34, px, py, 'Vault protocol triggered an alarm pulse!');
      break;
    }
    case 'loot': if (giveLoot(s, c, th.item)) th.taken = true; else { fl(s, c.x, c.y - 0.8, 'Too heavy!', '#f87171'); th.taken = false; (c as CrewS).label = 'Too heavy'; } break;
  }
}

function startWork(s: Sim, c: CrewS, th: Thing, key: boolean, auto: boolean) {
  const info = useInfo(c, th, key, s.gadgets.key > 0);
  c.work = { oid: th.id, t: 0, total: info.time, noise: info.noise, label: info.label, loud: info.loud, auto, key, nt: 0 };
  c.state = 'work';
  c.path = null;
  c.ang = Math.atan2(th.y + 0.5 - c.y, th.x + 0.5 - c.x);
}

function laserSafe(s: Sim, l: Laser, need: number) {
  if (l.off > 0) return true;
  const ph = (s.t + l.phase) % l.period;
  if (ph < l.onT) return false;
  return l.period - ph > Math.min(need, (l.period - l.onT) * 0.8);
}

const speedOf = (c: CrewS, mode: Mode) => {
  const base = mode === 'sneak' ? 1.8 : mode === 'run' ? 4.6 : 3.0;
  const heavy = c.ref.role === 'muscle' ? 0.05 : 0.11;
  return base * (c.ref.trait === 'quick' ? 1.12 : 1) * (1 - Math.min(0.5, carryW(c) * heavy)) * (c.grab ? 0.4 : 1);
};

type Mv = 'arrived' | 'moving' | 'blocked' | 'work';
function moveCrew(s: Sim, c: CrewS, goals: number[], dt: number, mode: Mode): Mv {
  const here = tileIdx(s, c.x, c.y);
  if (goals.includes(here)) return 'arrived';
  const key = goals.join(',');
  if (!c.path || c.pathKey !== key) {
    c.path = findPath(s.w.w, s.w.h, here % s.w.w, Math.floor(here / s.w.w), goals, crewCost(s));
    c.pathKey = key;
    if (!c.path) return 'blocked';
  }
  c.state = 'move';
  c.mode = mode;
  let rem = speedOf(c, mode) * dt;
  while (rem > 0 && c.path && c.path.length) {
    const n = c.path[0], ni = tileIdx(s, n.x, n.y), cur = tileIdx(s, c.x, c.y);
    if (ni !== cur) {
      const door = s.doorIdx[ni];
      if (door && door.locked) { startWork(s, c, door, false, true); return 'work'; }
      const l = s.laserAt[ni];
      if (l && s.laserAt[cur] !== l && mode !== 'run') {
        let k = 0;
        while (k < c.path.length && s.laserAt[tileIdx(s, c.path[k].x, c.path[k].y)] === l) k++;
        if (!laserSafe(s, l, (k + 0.6) / speedOf(c, mode))) { c.label = 'Waiting for laser gap'; c.state = 'wait'; return 'moving'; }
      }
    }
    const dx = n.x - c.x, dy = n.y - c.y, d = Math.hypot(dx, dy);
    c.ang = Math.atan2(dy, dx);
    if (d <= rem) { c.x = n.x; c.y = n.y; rem -= d; c.path.shift(); }
    else { c.x += (dx / d) * rem; c.y += (dy / d) * rem; rem = 0; }
  }
  if (!c.path.length) { c.path = null; return goals.includes(tileIdx(s, c.x, c.y)) ? 'arrived' : 'moving'; }
  return 'moving';
}

const nextStep = (c: CrewS) => { c.si++; c.path = null; c.pathKey = ''; c.eg = null; };
const tileGoal = (s: Sim, x: number, y: number) => [tileIdx(s, x, y)];

function arrest(s: Sim, c: CrewS, why: string) {
  c.state = 'down';
  c.work = null;
  s.stats.arrests++;
  fl(s, c.x, c.y - 1, 'ARRESTED', '#ef4444', true);
  say(s, `${c.ref.name} was arrested${why ? ` (${why})` : ''}`, '#f87171');
  c.carry.forEach(it => dropLoot(s, c.x, c.y, it));
  c.carry = [];
  s.shake = 0.7;
  snd(s, 'arrest');
  burst(s, c.x, c.y, '#ef4444', 14, 3);
}

function extractCrew(s: Sim, c: CrewS) {
  c.state = 'out';
  const v = c.carry.reduce((a, b) => a + b.value, 0);
  s.extracted.push(...c.carry);
  s.extractedIds.push(c.id);
  fl(s, s.w.van.x, s.w.van.y - 0.8, v ? `${c.ref.name} +$${v.toLocaleString()}` : `${c.ref.name} is out`, v ? '#facc15' : '#a7f3d0', !!v);
  say(s, `${c.ref.name} reached the van${v ? ` with $${v.toLocaleString()}` : ''}`, '#a7f3d0');
  c.carry = [];
  snd(s, v ? 'cash' : 'unlock');
}

function throwGadget(s: Sim, c: CrewS, g: GadgetId, x: number, y: number): boolean {
  if (g === 'dart') {
    let best: GuardS | null = null, bd = 7.5;
    for (const o of s.guards) {
      if (o.state === 'down' || o.type === 'drone') continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (d < bd && los(s, c.x, c.y, o.x, o.y)) { bd = d; best = o; }
    }
    if (!best) return false;
    s.gadgets.dart--; s.used.dart++;
    burst(s, best.x, best.y, '#a78bfa', 8, 2);
    if (best.type === 'captain') { best.hp -= 60; fl(s, best.x, best.y - 0.8, 'Dart -60', '#a78bfa'); if (best.hp <= 0) downGuard(s, best, c, true, false); else becomeAlert(s, best, c); }
    else downGuard(s, best, c, true, false);
    return true;
  }
  s.gadgets[g]--; s.used[g]++;
  if (g === 'smoke') { s.smoke.push({ x, y, r: 2.7, t: 9 }); burst(s, x, y, '#94a3b8', 20, 1.5); snd(s, 'smoke'); }
  if (g === 'decoy') { s.decoys.push({ x, y, t: 8, n: 0 }); fl(s, x, y - 0.6, '📻 Decoy', '#fde68a'); }
  if (g === 'emp') {
    s.w.things.forEach(t => { if (t.kind === 'camera' && t.off < 9000 && Math.hypot(t.x + 0.5 - x, t.y + 0.5 - y) < 7) t.off = Math.max(t.off, 14); });
    s.w.lasers.forEach(l => { if (l.tiles.some(p => Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y) < 7)) l.off = Math.max(l.off, 14); });
    s.guards.forEach(o => { if (o.type === 'drone' && Math.hypot(o.x - x, o.y - y) < 7) { o.stun = 12; fl(s, o.x, o.y - 0.7, 'FRIED', '#7dd3fc'); } });
    s.ripples.push({ x, y, r: 7, t: 0, color: '#7dd3fc' });
    burst(s, x, y, '#7dd3fc', 24, 4); s.flash = 0.4; snd(s, 'emp');
  }
  say(s, `${c.ref.name} used ${g}`, '#cbd5e1');
  return true;
}

function stepCrew(s: Sim, c: CrewS, dt: number) {
  if (!activeCrew(c)) return;
  c.hurt = Math.max(0, c.hurt - dt);
  c.vanish = Math.max(0, c.vanish - dt);
  if (c.stun > 0) { c.stun -= dt; c.label = 'Stunned'; return; }
  c.trailT += dt;
  if (c.trailT > 0.15) { c.trailT = 0; c.trail.push({ x: c.x, y: c.y }); if (c.trail.length > 10) c.trail.shift(); }
  c.grab = s.guards.some(g => (g.state === 'alert' || g.state === 'hunt') && g.type !== 'drone' && Math.hypot(g.x - c.x, g.y - c.y) < 1.0);

  // footstep noise
  c.noiseT -= dt;
  if (c.state === 'move' && c.noiseT <= 0) {
    c.noiseT = 0.45;
    const r = (c.mode === 'run' ? 5.5 : c.mode === 'walk' ? 2.2 : 0.6) * (c.ref.trait === 'quiet' ? 0.6 : 1) * (c.ref.role === 'shadow' ? 0.6 : 1);
    noise(s, c.x, c.y, r);
  }

  // work in progress
  if (c.work) {
    const th = s.byId.get(c.work.oid);
    if (!th || (thingDone(th) && th.kind !== 'safe')) { c.work = null; return; }
    if (c.grab) { c.label = 'Under attack!'; return; }
    c.state = 'work';
    const wk = c.work;
    wk.t += dt;
    c.label = wk.label;
    wk.nt -= dt;
    if (wk.nt <= 0) { wk.nt = 0.9; noise(s, c.x, c.y, wk.noise); snd(s, 'tick'); burst(s, th.x + 0.5, th.y + 0.5, '#fde68a', 1, 1); }
    if (wk.t >= wk.total) {
      c.work = null;
      const cur = c.steps[c.si];
      applyUse(s, c, th, wk.key, wk.loud);
      if (!wk.auto && cur && cur.k === 'use' && cur.oid === th.id) { if (th.kind === 'safe' && !th.opened) { /* next stage continues */ } else nextStep(c); }
    }
    return;
  }

  const cur = c.steps[c.si];
  if (!cur) {
    c.state = 'idle'; c.label = 'Plan complete'; c.idleT += dt;
    if (c.idleT > 2.5) { c.steps.push({ k: 'extract' }); fl(s, c.x, c.y - 0.8, 'Improvising exit', '#fde68a'); }
    return;
  }
  c.idleT = 0;
  switch (cur.k) {
    case 'move': {
      c.label = 'Moving';
      const r = moveCrew(s, c, tileGoal(s, cur.x, cur.y), dt, cur.mode);
      if (r === 'arrived' || r === 'blocked') { if (r === 'blocked') fl(s, c.x, c.y - 0.8, 'No route', '#f87171'); nextStep(c); c.state = 'idle'; }
      break;
    }
    case 'use': {
      const th = s.byId.get(cur.oid);
      if (!th || (thingDone(th) && th.kind !== 'safe') || (th.kind === 'safe' && th.opened)) { nextStep(c); break; }
      c.label = 'Heading to target';
      const r = moveCrew(s, c, approach(s, th), dt, c.mode === 'run' ? 'run' : 'walk');
      if (r === 'arrived') startWork(s, c, th, !!cur.key, false);
      else if (r === 'blocked') { fl(s, c.x, c.y - 0.8, 'No route', '#f87171'); nextStep(c); }
      break;
    }
    case 'wait': cur.t = (cur.t ?? 0) + dt; c.state = 'wait'; c.label = `Waiting ${Math.max(0, Math.ceil(cur.sec - cur.t))}s`; if (cur.t >= cur.sec) nextStep(c); break;
    case 'signal': s.signals.add(cur.n); fl(s, c.x, c.y - 0.8, `Signal ${'ABC'[cur.n - 1] ?? cur.n}`, '#c4b5fd'); snd(s, 'ping'); nextStep(c); break;
    case 'await': cur.t = (cur.t ?? 0) + dt; c.state = 'wait'; c.label = `Awaiting signal ${'ABC'[cur.n - 1] ?? cur.n}`; if (s.signals.has(cur.n)) nextStep(c); else if (cur.t > 45) { fl(s, c.x, c.y - 0.8, 'Signal timed out', '#fbbf24'); nextStep(c); } break;
    case 'ambush': case 'distract': {
      const goal = tileGoal(s, cur.x, cur.y);
      if (tileIdx(s, c.x, c.y) !== goal[0] && c.state !== 'ambush') {
        c.label = 'Moving to position';
        const r = moveCrew(s, c, goal, dt, 'sneak');
        if (r === 'blocked') nextStep(c);
        if (r !== 'arrived') break;
      }
      c.state = 'ambush';
      cur.t = (cur.t ?? 0) + dt;
      if (cur.k === 'ambush') {
        c.label = 'Lying in ambush';
        for (const g of s.guards) {
          if (g.state === 'down' || g.state === 'alert' || g.state === 'hunt' || g.type === 'drone' || g.type === 'k9' || g.stun > 0) continue;
          if (Math.hypot(g.x - c.x, g.y - c.y) < 2.0) {
            noise(s, c.x, c.y, c.ref.role === 'shadow' ? 1 : 4.5);
            if (g.type === 'captain') { g.hp -= 120; fl(s, g.x, g.y - 0.8, '-120', '#fbbf24'); if (g.hp <= 0) downGuard(s, g, c, false, false); else becomeAlert(s, g, c); }
            else downGuard(s, g, c, c.ref.role === 'shadow', c.ref.role === 'shadow');
            nextStep(c); c.state = 'idle';
            break;
          }
        }
        if (c.si < c.steps.length && c.steps[c.si] === cur && cur.t > 25) { fl(s, c.x, c.y - 0.8, 'No target came', '#fbbf24'); nextStep(c); c.state = 'idle'; }
      } else {
        c.label = 'Waiting to distract';
        if (c.eg == null) {
          for (const g of s.guards) {
            if (g.state !== 'patrol' || g.type === 'drone' || g.type === 'k9') continue;
            if (Math.hypot(g.x - c.x, g.y - c.y) < 5.5 && los(s, g.x, g.y, c.x, c.y)) { g.state = 'chat'; g.chatT = 9; g.chatWith = c.id; g.path = null; c.eg = g.id; fl(s, g.x, g.y - 0.8, '💬', '#86efac'); break; }
          }
          if (cur.t > 25) { fl(s, c.x, c.y - 0.8, 'No target came', '#fbbf24'); nextStep(c); c.state = 'idle'; }
        } else {
          c.label = 'Chatting up a guard';
          const g = s.guards.find(o => o.id === c.eg);
          if (!g || g.state !== 'chat') { nextStep(c); c.state = 'idle'; }
        }
      }
      break;
    }
    case 'jam': {
      cur.t = (cur.t ?? 0) + dt; c.state = 'work'; c.label = 'Jamming comms';
      if (cur.t > 1.2) {
        if (c.ref.role !== 'hacker' || c.used) fl(s, c.x, c.y - 0.8, 'Jammer spent', '#f87171');
        else { c.used = true; s.jam = 14; if (s.full && !s.police) s.eta += 15; fl(s, c.x, c.y - 1, 'COMMS JAMMED', '#38bdf8', true); say(s, 'Comms jammed for 14s', '#7dd3fc'); snd(s, 'emp'); s.ripples.push({ x: c.x, y: c.y, r: 6, t: 0, color: '#38bdf8' }); }
        nextStep(c);
      }
      break;
    }
    case 'blast': {
      cur.t = (cur.t ?? 0) + dt; c.state = 'work'; c.label = 'Planting charge';
      if (cur.t > 1.5) {
        let best: Thing | null = null, bd = 3.2;
        s.w.things.forEach(t => { if ((t.kind === 'door' && t.locked) || (t.kind === 'safe' && !t.opened)) { const d = Math.hypot(t.x + 0.5 - c.x, t.y + 0.5 - c.y); if (d < bd) { bd = d; best = t; } } });
        if (c.ref.role !== 'cracker' || c.used || !best) fl(s, c.x, c.y - 0.8, c.used ? 'Charge spent' : 'Nothing to blast', '#f87171');
        else {
          const t = best as Thing;
          c.used = true;
          if (t.kind === 'door') { t.locked = false; t.tampered = true; } else if (t.kind === 'safe') { t.stage = t.stages; openSafe(s, c, t); }
          fl(s, t.x + 0.5, t.y, 'BOOM', '#fb923c', true); burst(s, t.x + 0.5, t.y + 0.5, '#fb923c', 30, 5); s.shake = 0.9; snd(s, 'boom');
          noise(s, t.x + 0.5, t.y + 0.5, 14, true);
          raise(s, 15, t.x + 0.5, t.y + 0.5, `${c.ref.name}'s charge woke the building`);
        }
        nextStep(c);
      }
      break;
    }
    case 'gadget': {
      cur.t = (cur.t ?? 0) + dt;
      if (s.gadgets[cur.g] <= 0) { fl(s, c.x, c.y - 0.8, `Out of ${cur.g}`, '#f87171'); nextStep(c); break; }
      if (cur.g === 'dart') {
        c.state = 'ambush'; c.label = 'Aiming dart';
        if (throwGadget(s, c, 'dart', cur.x, cur.y)) nextStep(c);
        else if (cur.t > 12) { fl(s, c.x, c.y - 0.8, 'No target', '#fbbf24'); nextStep(c); }
        break;
      }
      if (Math.hypot(cur.x - c.x, cur.y - c.y) > 6.5) { c.label = 'Moving into range'; const r = moveCrew(s, c, tileGoal(s, cur.x, cur.y), dt, 'walk'); if (r === 'blocked') nextStep(c); break; }
      c.state = 'work'; c.label = 'Throwing';
      throwGadget(s, c, cur.g, cur.x, cur.y); nextStep(c);
      break;
    }
    case 'extract': {
      if (s.vanGone) { arrest(s, c, 'van left'); break; }
      c.label = 'Running to van';
      const d = Math.hypot(c.x - s.w.van.x, c.y - s.w.van.y);
      if (d < 1.7) { extractCrew(s, c); break; }
      const vi = tileIdx(s, s.w.van.x, s.w.van.y);
      const goals = [vi, vi + 1, vi - 1, vi + s.w.w, vi - s.w.w].filter(i => s.w.tiles[i] === 1);
      const r = moveCrew(s, c, goals, dt, c.mode);
      if (r === 'arrived') extractCrew(s, c);
      break;
    }
  }
}

/* ---------- guards ---------- */
function visRate(s: Sim, c: CrewS, d: number, range: number, g: GuardS): number {
  let stance = c.state === 'ambush' ? 0.18 : c.state === 'move' ? (c.mode === 'sneak' ? 0.55 : c.mode === 'run' ? 1.9 : 1) : 0.65;
  const sf = 1 - c.ref.skills.stealth * 0.07 - c.ref.skills.charm * 0.025;
  stance *= sf * (c.ref.trait === 'steady' ? 0.85 : 1) * (roomDark(s, c.x, c.y) ? 0.6 : 1) * (c.vanish > 0 ? 0.1 : 1) * (g.state === 'chat' ? 0.35 : 1);
  const distF = clamp(1.25 - d / range, 0.2, 1.25);
  let rate = 1.1 * distF * stance * s.cfg.detect * (s.alarm >= 50 ? 1.15 : 1) * (g.type === 'cop' ? 1.5 : 1);
  if (d < 1.4 && c.state !== 'ambush') rate *= 3;
  if (g.state === 'hunt') rate *= 2;
  return rate;
}

function goTo(s: Sim, g: GuardS, tx: number, ty: number, spd: number, dt: number, force = false): boolean {
  const gi = tileIdx(s, tx, ty), here = tileIdx(s, g.x, g.y);
  if (here === gi || Math.hypot(tx - g.x, ty - g.y) < 0.35) return true;
  g.repath -= dt;
  if (!g.path || g.goal !== gi || (force && g.repath <= 0)) {
    g.repath = 0.45; g.goal = gi;
    g.path = findPath(s.w.w, s.w.h, here % s.w.w, Math.floor(here / s.w.w), [gi], guardCost(s, g.type === 'drone'));
    if (!g.path) { g.path = []; return true; }
  }
  let rem = spd * dt;
  while (rem > 0 && g.path.length) {
    const n = g.path[0], dx = n.x - g.x, dy = n.y - g.y, d = Math.hypot(dx, dy);
    g.ang = turn(g.ang, Math.atan2(dy, dx), dt * 10);
    if (d <= rem) { g.x = n.x; g.y = n.y; rem -= d; g.path.shift(); } else { g.x += (dx / d) * rem; g.y += (dy / d) * rem; rem = 0; }
  }
  return !g.path.length;
}

function updGuard(s: Sim, g: GuardS, dt: number) {
  if (g.state === 'down') return;
  const T = GT[g.type];
  if (g.stun > 0) { g.stun -= dt; return; }
  const boost = s.alarm >= 50 ? 1.2 : 1;

  // detection
  let range = T.range * (s.alarm >= 50 ? 1.15 : 1) * (s.full ? 1.2 : 1);
  if (g.state === 'chat') range *= 0.5;
  let best = 0, seen: CrewS | null = null;
  for (const c of s.crew) {
    if (!activeCrew(c)) continue;
    const dx = c.x - g.x, dy = c.y - g.y, d = Math.hypot(dx, dy);
    let rate = 0;
    if (g.type === 'k9' && d < 3.4 && (c.mode !== 'sneak' || d < 1.8 || c.state !== 'move')) rate = 1.6;
    const r = range * (roomDark(s, c.x, c.y) ? 0.7 : 1);
    if (d <= r && (d < 1.2 || inCone(g.ang, dx, dy, T.fov)) && los(s, g.x, g.y, c.x, c.y)) rate = Math.max(rate, visRate(s, c, d, range, g));
    if (rate > best) { best = rate; seen = c; }
  }
  if (seen) { g.last = { x: seen.x, y: seen.y }; g.sus += best * dt; if (g.state === 'alert') { g.lostT = 0; g.chase = seen.id; } }
  else if (g.state !== 'alert') g.sus = Math.max(0, g.sus - 0.28 * dt);
  if (g.sus >= 1 && g.state !== 'alert') becomeAlert(s, g, seen);
  else if (g.sus > 0.3 && g.state === 'patrol') { g.state = 'suspicious'; g.susT = 0; g.path = null; }

  // bodies & tampered doors
  if (g.state !== 'alert') {
    for (const o of s.guards) {
      if (o.state !== 'down' || o.hidden || o.found) continue;
      const d = Math.hypot(o.x - g.x, o.y - g.y);
      if (d < range && inCone(g.ang, o.x - g.x, o.y - g.y, T.fov) && los(s, g.x, g.y, o.x, o.y)) {
        o.found = true; s.stats.bodies++;
        raise(s, 35, o.x, o.y, `${GUARD_LABEL[g.type]} found a body!`);
        investigate(g, o.x, o.y, 8);
      }
    }
    for (const t of s.w.things) {
      if (t.kind !== 'door' || !t.tampered) continue;
      const d = Math.hypot(t.x + 0.5 - g.x, t.y + 0.5 - g.y);
      if (d < range * 0.8 && inCone(g.ang, t.x + 0.5 - g.x, t.y + 0.5 - g.y, T.fov) && los(s, g.x, g.y, t.x + 0.5, t.y + 0.5)) {
        t.tampered = false; fl(s, t.x + 0.5, t.y, 'Tampered lock!', '#fbbf24'); raise(s, 8, t.x + 0.5, t.y + 0.5, 'A guard noticed a tampered door', false);
        investigate(g, t.x + 0.5, t.y + 0.5, 6);
      }
    }
  }

  switch (g.state) {
    case 'patrol': {
      if (g.type === 'sentinel' || g.pause > 0) {
        g.pause -= dt;
        g.ang = g.baseAng + Math.sin(s.t * 0.9 + g.id) * (g.type === 'sentinel' ? 1.1 : 0.8);
        if (g.type === 'sentinel' && g.route[0] && Math.hypot(g.route[0].x - g.x, g.route[0].y - g.y) > 0.5) goTo(s, g, g.route[0].x, g.route[0].y, T.spd * boost, dt);
        break;
      }
      const wp = g.route[g.ri];
      if (!wp || goTo(s, g, wp.x, wp.y, T.spd * boost, dt)) { g.pause = 1.2 + Math.random() * 1.8; g.baseAng = g.ang; g.ri = (g.ri + 1) % Math.max(1, g.route.length); g.path = null; }
      break;
    }
    case 'suspicious': {
      g.susT += dt;
      if (g.last) g.ang = turn(g.ang, Math.atan2(g.last.y - g.y, g.last.x - g.x), dt * 6);
      if (g.sus < 0.05) { g.state = 'patrol'; g.pause = 0.5; g.baseAng = g.ang; }
      else if (g.susT > 1.5 && g.last) investigate(g, g.last.x, g.last.y, 6);
      break;
    }
    case 'investigate': {
      if (goTo(s, g, g.tx, g.ty, T.spd * 1.25 * boost, dt)) {
        g.inv -= dt; g.ang = g.ang + dt * 1.6;
        if (g.inv <= 0) { g.state = s.full ? 'hunt' : 'patrol'; g.pause = 0.5; g.baseAng = g.ang; g.path = null; g.sus = Math.min(g.sus, 0.2); }
      }
      break;
    }
    case 'chat': {
      g.chatT -= dt;
      const c = s.crew.find(o => o.id === g.chatWith);
      if (c) g.ang = turn(g.ang, Math.atan2(c.y - g.y, c.x - g.x), dt * 6);
      if (g.chatT <= 0 || !c || !activeCrew(c)) { g.state = 'patrol'; g.pause = 0.5; g.baseAng = g.ang; g.path = null; }
      break;
    }
    case 'hunt': {
      g.huntT -= dt;
      const act = s.crew.filter(activeCrew);
      if (!act.length) break;
      if (g.huntT <= 0 || !g.last) {
        const t = act[Math.floor(Math.random() * act.length)];
        g.last = { x: clamp(t.x + (Math.random() - 0.5) * 6, 1, s.w.w - 2), y: clamp(t.y + (Math.random() - 0.5) * 6, 1, s.w.h - 2) };
        g.huntT = 4; g.path = null;
      }
      if (goTo(s, g, g.last.x, g.last.y, T.aspd * 0.85, dt, true)) g.huntT = 0;
      break;
    }
    case 'alert': {
      // radio report
      if (g.radio > 0) { g.radio -= dt; if (g.radio <= 0) raise(s, 40, g.x, g.y, `${GUARD_LABEL[g.type]} radioed it in!`); }
      const tgt = s.crew.find(c => c.id === g.chase && activeCrew(c));
      if (!tgt) { const n = s.crew.filter(activeCrew); if (!n.length) break; g.chase = n[0].id; break; }
      if (!seen) g.lostT += dt;
      const aim = seen ? { x: tgt.x, y: tgt.y } : g.last || { x: tgt.x, y: tgt.y };
      goTo(s, g, aim.x, aim.y, T.aspd * boost, dt, true);
      if (g.type === 'captain') {
        g.cd -= dt;
        if (g.cd <= 0 && seen && Math.hypot(tgt.x - g.x, tgt.y - g.y) < 4.5) { g.cd = 7; tgt.stun = 1.6; fl(s, tgt.x, tgt.y - 0.8, 'FLASHBANG!', '#fde047', true); s.flash = 0.8; snd(s, 'boom'); }
      }
      if (g.lostT > 5) { g.state = s.full ? 'hunt' : 'investigate'; g.tx = aim.x; g.ty = aim.y; g.inv = 6; g.sus = 0.3; g.lostT = 0; g.path = null; g.huntT = 0; }
      // melee
      if (g.type !== 'drone') {
        const vic = s.crew.find(c => activeCrew(c) && Math.hypot(c.x - g.x, c.y - g.y) < 0.95);
        if (vic) {
          g.atkT -= dt;
          if (g.atkT <= 0) {
            g.atkT = 0.8;
            const dmg = g.type === 'captain' ? 22 : g.type === 'k9' ? 10 : 14;
            vic.hp -= dmg; vic.hurt = 0.3; s.shake = Math.max(s.shake, 0.3); snd(s, 'hit'); burst(s, vic.x, vic.y, '#ef4444', 5, 2);
            fl(s, vic.x, vic.y - 0.6, `-${dmg}`, '#f87171');
            if (vic.hp <= 0) arrest(s, vic, GUARD_LABEL[g.type]);
          }
          const f = vic.ref.skills.force;
          g.hp -= (2 + f * 2.5) * (vic.ref.trait === 'brawler' ? 1.5 : 1) * (vic.ref.role === 'muscle' ? 1.6 : 1) * dt;
          if (g.hp <= 0) downGuard(s, g, vic, false, false);
        }
      }
      break;
    }
  }
}

/* ---------- main update ---------- */
export function update(s: Sim, dt: number) {
  s.t += dt;
  // cosmetic effects always update
  for (const p of s.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy *= 0.94; p.life -= dt; }
  s.particles = s.particles.filter(p => p.life > 0);
  for (const f of s.floaters) { f.t += dt; f.y -= dt * 0.5; }
  s.floaters = s.floaters.filter(f => f.t < f.life);
  for (const r of s.ripples) r.t += dt;
  s.ripples = s.ripples.filter(r => r.t < 0.9);
  s.shake = Math.max(0, s.shake - dt * 1.6);
  s.flash = Math.max(0, s.flash - dt * 1.8);
  s.smoke.forEach(m => { m.t -= dt; });
  s.smoke = s.smoke.filter(m => m.t > 0);
  const camList = s.w.things.filter(t => t.kind === 'camera') as Extract<Thing, { kind: 'camera' }>[];
  camList.forEach(c => { c.ang = c.base + Math.sin(s.t * c.speed + c.phase) * c.sweep; });
  s.w.things.forEach(t => {
    if (t.kind !== 'door') return;
    let occ = false;
    if (!t.locked) {
      const cx = t.x + 0.5, cy = t.y + 0.5;
      for (const c of s.crew) if (activeCrew(c) && Math.hypot(c.x - cx, c.y - cy) < 1.15) { occ = true; break; }
      if (!occ) for (const g of s.guards) if (g.state !== 'down' && Math.hypot(g.x - cx, g.y - cy) < 1.15) { occ = true; break; }
    }
    t.open += ((occ ? 1 : 0) - t.open) * Math.min(1, dt * 8);
  });
  if (s.status !== 'run') return;

  s.jam = Math.max(0, s.jam - dt);
  s.alarmT += dt;
  if (!s.full && s.alarm > 0 && s.alarmT > 4) s.alarm = Math.max(0, s.alarm - 1.2 * dt);
  s.improvT += dt;
  if (s.improvT > 25) { s.improvT = 0; if (s.improv < s.cfg.improvMax) s.improv++; }
  s.w.things.forEach(t => { if (t.kind === 'camera' && t.off > 0 && t.off < 9000) t.off = Math.max(0, t.off - dt); });
  s.w.lasers.forEach(l => { if (l.off > 0) l.off = Math.max(0, l.off - dt); if (l.cool) l.cool -= dt; });

  // waves
  for (const wv of s.waves) {
    wv.r += 9 * dt;
    for (const g of s.guards) {
      if (g.state === 'down' || wv.done.has(g.id)) continue;
      const d = wv.dist[tileIdx(s, g.x, g.y)];
      if (d >= 0 && d <= wv.r) { wv.done.add(g.id); if (g.state === 'patrol' || g.state === 'suspicious' || g.state === 'chat' || g.state === 'investigate') investigate(g, wv.x, wv.y, 8); }
    }
  }
  s.waves = s.waves.filter(wv => wv.r < wv.max + 8);
  for (const d of s.decoys) {
    d.t -= dt; d.n -= dt;
    if (d.n <= 0) { d.n = 1; noise(s, d.x, d.y, 11, true); snd(s, 'ping'); }
  }
  s.decoys = s.decoys.filter(d => d.t > 0);

  // cameras
  for (const cam of camList) {
    cam.cool -= dt;
    if (cam.off > 0) { cam.sus = 0; continue; }
    const o = camPos(cam);
    let best = 0, who: CrewS | null = null;
    for (const c of s.crew) {
      if (!activeCrew(c)) continue;
      const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy);
      if (d < cam.range && inCone(cam.ang, dx, dy, cam.fov) && los(s, o.x, o.y, c.x, c.y)) {
        const r = visRate(s, c, d, cam.range, { state: 'patrol', type: 'guard' } as GuardS) * 0.9;
        if (r > best) { best = r; who = c; }
      }
    }
    if (who) cam.sus += best * dt; else cam.sus = Math.max(0, cam.sus - 0.4 * dt);
    if (cam.sus >= 1 && cam.cool <= 0 && who) {
      cam.cool = 8; cam.sus = 0; s.stats.spotted++;
      fl(s, cam.x + 0.5, cam.y, '📷 SPOTTED', '#ef4444', true);
      raise(s, 30, who.x, who.y, `Camera spotted ${who.ref.name}`, false);
      let nearest: GuardS | null = null, nd = 1e9;
      s.guards.forEach(g => { if (g.state === 'patrol' || g.state === 'suspicious') { const d = Math.hypot(g.x - who!.x, g.y - who!.y); if (d < nd) { nd = d; nearest = g; } } });
      if (nearest) investigate(nearest, who.x, who.y, 7);
    }
  }
  // lasers
  for (const l of s.w.lasers) {
    if (!laserOn(s, l) || (l.cool ?? 0) > 0) continue;
    for (const c of s.crew) {
      if (!activeCrew(c) || c.vanish > 0.5) continue;
      if (l.tiles.some(p => p.x === Math.floor(c.x) && p.y === Math.floor(c.y))) {
        l.cool = 3; fl(s, c.x, c.y - 0.8, 'LASER TRIPPED', '#ef4444', true);
        raise(s, 40, c.x, c.y, `${c.ref.name} tripped a laser grid`);
        break;
      }
    }
  }

  for (const c of s.crew) stepCrew(s, c, dt);
  for (const g of s.guards) updGuard(s, g, dt);

  // police
  if (s.full) {
    s.eta -= dt;
    if (s.eta <= 0 && !s.police) {
      s.police = true;
      const n = 3 + heatTier(s.cfg.heat) + (s.cfg.diff === 2 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const sp = s.w.spawns[i % s.w.spawns.length];
        s.guards.push({ id: s.nid++, type: 'cop', x: sp.x, y: sp.y, ang: 0, baseAng: 0, hp: GT.cop.hp, maxHp: GT.cop.hp, route: [sp], ri: 0, state: 'hunt', path: null, goal: -1, tx: 0, ty: 0, sus: 0, susT: 0, pause: 0, radio: 0, chase: null, last: null, lostT: 0, stun: 0, hidden: false, found: false, chatT: 0, chatWith: null, atkT: 0, repath: 0, witnessed: true, inv: 0, huntT: 0, cd: 0 });
      }
      say(s, 'POLICE HAVE ARRIVED! The van leaves in 25s!', '#60a5fa');
      fl(s, s.w.van.x, s.w.van.y - 1, 'POLICE!', '#60a5fa', true);
      snd(s, 'police'); s.shake = 0.8; s.flash = 1;
    }
    if (s.police && s.eta < -(25 + s.cfg.garage * 5) && !s.vanGone) { s.vanGone = true; say(s, 'The getaway van fled!', '#f87171'); fl(s, s.w.van.x, s.w.van.y - 1, 'VAN GONE', '#f87171', true); }
    if (s.vanGone) s.crew.forEach(c => { if (activeCrew(c)) arrest(s, c, 'stranded'); });
  }

  if (s.crew.every(c => !activeCrew(c))) { s.endT += dt; if (s.endT > 1.4) finishSim(s, false); }
  else if (s.t > 720) finishSim(s, false);
}

export function startRun(s: Sim) { s.status = 'run'; say(s, 'The crew moves in...', '#cbd5e1'); }

/* ---------- player orders ---------- */
export function giveOrder(s: Sim, id: string, step: Step, cost: number): string | null {
  const c = s.crew.find(x => x.id === id);
  if (!c || !activeCrew(c)) return 'Crew member unavailable';
  if (cost > 0 && s.improv < cost) return 'No Improvise orders left';
  s.improv -= cost;
  c.steps.splice(c.si, 0, step);
  c.work = null; c.path = null; c.pathKey = ''; c.eg = null; c.idleT = 0;
  if (step.k === 'move') c.mode = step.mode;
  fl(s, c.x, c.y - 0.9, cost ? 'Improvising!' : 'Gadget out', '#fde68a');
  return null;
}
export function abortAll(s: Sim) {
  if (s.abortFlag) return;
  s.abortFlag = true;
  s.crew.forEach(c => { if (activeCrew(c)) { c.steps = c.steps.slice(0, c.si).concat([{ k: 'extract' }]); c.work = null; c.path = null; c.pathKey = ''; c.mode = 'run'; c.eg = null; } });
  say(s, 'ABORT! Everyone to the van!', '#fbbf24');
}

export function pickThing(w: World, x: number, y: number, known: (t: Thing) => boolean): Thing | null {
  let best: Thing | null = null, bd = 0.85;
  for (const t of w.things) {
    if (!known(t)) continue;
    const d = Math.hypot(t.x + 0.5 - x, t.y + 0.5 - y);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/* ---------- results ---------- */
function finishSim(s: Sim, aborted: boolean) {
  if (s.status === 'done') return;
  s.status = 'done';
  const def = s.w.def;
  const iron = s.cfg.mods.iron ? 1.2 : 1;
  const loot = s.extracted.map(i => ({ ...i, value: Math.round(i.value * iron) }));
  const lootValue = loot.reduce((a, b) => a + b.value, 0);
  const primary = s.extracted.some(i => i.primary);
  const arrested = s.crew.filter(c => c.state === 'down').map(c => c.id);
  const ghost = primary && !s.full && s.stats.alarms === 0 && s.stats.spotted === 0;
  const bonuses: { name: string; amount: number }[] = [];
  const feeMult = [1, 1, 1.3][s.cfg.diff] * (s.cfg.mods.hot ? 1.4 : 1);
  const fee = primary ? Math.round(def.fee * feeMult) : 0;
  let score = primary ? 50 : 10;
  if (primary) {
    if (ghost) { bonuses.push({ name: 'Ghost: never detected', amount: Math.round(fee * 0.25) }); score += 25; }
    if (!arrested.length) { bonuses.push({ name: 'Flawless: whole crew escaped', amount: Math.round(fee * 0.1) }); score += 10; }
    if (s.t < def.par) { bonuses.push({ name: `Swift: under ${def.par}s`, amount: Math.round(fee * 0.1) }); score += 8; }
    if (s.totalLoot > 0 && lootValue >= s.totalLoot * 0.85) { bonuses.push({ name: 'Full House: 85%+ of the loot', amount: Math.round(fee * 0.15) }); score += 7; }
    if (s.stats.captainDown) { bonuses.push({ name: 'Captain Voss defeated', amount: 3000 }); score += 5; }
  }
  const rating = !primary ? (loot.length ? 'D' : 'F') : score >= 88 ? 'S' : score >= 72 ? 'A' : score >= 60 ? 'B' : 'C';
  let heat = 4 + (s.full ? 14 : 0) + (s.police ? 10 : 0) + s.stats.bodies * 3 + Math.min(8, s.stats.spotted * 2) + arrested.length * 6 + Math.min(10, s.stats.alarms);
  if (ghost) heat = Math.max(0, heat - 4);
  heat = Math.round(heat * (s.cfg.mods.hot ? 1.5 : 1) * [0.8, 1, 1.25][s.cfg.diff]);
  const xp: Record<string, number> = {};
  s.crew.forEach(c => { xp[c.id] = Math.round(25 + c.xp + (s.extractedIds.includes(c.id) ? 20 : 0) + (primary ? 40 : 0)); });
  s.result = {
    heistId: def.id, success: primary, primary, aborted, loot, lootValue, time: Math.round(s.t), ghost, alarms: s.stats.alarms, fullAlarm: s.full, police: s.police,
    arrested, extracted: s.extractedIds.slice(), guardsDowned: s.stats.downed, bodiesFound: s.stats.bodies, spotted: s.stats.spotted, captainDown: s.stats.captainDown, xp, bonuses,
    fee, rating, heatGain: heat, gadgetsUsed: { ...s.used }, salary: s.crew.reduce((a, c) => a + Math.round(c.ref.salary * (c.ref.trait === 'loyal' ? 0.7 : 1)), 0),
  };
}
export function forceFinish(s: Sim) { finishSim(s, true); }
export function stepLabel(st: Step, s: Sim): string {
  switch (st.k) {
    case 'move': return `${st.mode === 'sneak' ? 'Sneak' : st.mode === 'run' ? 'Run' : 'Walk'} to (${Math.floor(st.x)},${Math.floor(st.y)})`;
    case 'use': { const t = s.byId.get(st.oid); const n = !t ? '?' : t.kind === 'door' ? `${t.lock} door` : t.kind === 'loot' ? t.item.name : t.kind === 'terminal' ? `${t.effect} terminal` : t.kind; return `${st.key ? '🗝️ Key: ' : 'Use '}${n}`; }
    case 'wait': return `Wait ${st.sec}s`;
    case 'signal': return `Send signal ${'ABC'[st.n - 1]}`;
    case 'await': return `Await signal ${'ABC'[st.n - 1]}`;
    case 'ambush': return 'Ambush here';
    case 'distract': return 'Distract here';
    case 'jam': return 'Jam comms';
    case 'blast': return 'Shaped charge';
    case 'gadget': return `Throw ${st.g}`;
    case 'extract': return 'Extract at van';
  }
}
