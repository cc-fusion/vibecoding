import {
  CUTPURSES, DIFFICULTIES, EVENTS, FACTIONS, FACTION_IDS, FAVOR_MAX, FAVOR_PER_POINT, FINALE_NIGHT, GOODS, GOOD_IDS,
  INFORMANTS, KIT, LEGACY, LOC, MAGPIE, MODIFIERS, NOBLES, NODES, OBSTACLES, PATRONS, PATRON_SPOTS, PERKS, VENDORS, WARDENS,
  H, W, marketText, nearestNode, nodePath, quotaFor, scandalText, STALL_LOCS, TUTORIAL,
  type EventDef, type FactionId, type GoodId, type NpcDef,
} from './data';
import { audio } from './audio';

export type Phase = 'title' | 'dusk' | 'night' | 'dawn' | 'over' | 'victory';

export interface Stats {
  earned: number; spent: number; tradeProfit: number; trades: number; rumorsBought: number; rumorsSold: number; rumorsPlanted: number;
  rumorsForged: number; eavesdrops: number; debunks: number; proven: number; busted: number; arrests: number; robbed: number;
  caught: number; commissions: number; peakWorth: number; nightsSurvived: number; traced: number; exposed: number;
}
const newStats = (): Stats => ({
  earned: 0, spent: 0, tradeProfit: 0, trades: 0, rumorsBought: 0, rumorsSold: 0, rumorsPlanted: 0, rumorsForged: 0, eavesdrops: 0,
  debunks: 0, proven: 0, busted: 0, arrests: 0, robbed: 0, caught: 0, commissions: 0, peakWorth: 0, nightsSurvived: 0, traced: 0, exposed: 0,
});

export interface Run {
  night: number; coins: number; cred: number; strikes: number; favor: Record<FactionId, number>; perks: string[];
  kit: Record<string, number>; cargo: Record<GoodId, { qty: number; cost: number }>; diff: string; mods: string[];
  endless: boolean; stats: Stats;
}
export interface Meta {
  marks: number; up: Record<string, number>; best: { nights: number; worth: number; wins: number; runs: number };
  tutDone: boolean; vol: { master: number; music: number; sfx: number; muted: boolean };
  opts: { shake: boolean; names: boolean; particles: boolean };
}

export interface Rumor {
  id: number; kind: 'market' | 'scandal'; good?: GoodId; dir: 1 | -1; mag: number; faction?: FactionId; truth: boolean; text: string;
  born: number; resolveAt: number; origin: 'event' | 'noise' | 'magpie' | 'player' | 'scandal'; state: 'pending' | 'true' | 'false';
  traced?: boolean;
}
export interface LedgerEntry { rid: number; from: string; how: 'overheard' | 'bought' | 'forged' | 'gift'; t: number; sold: number; planted: number; used?: boolean }

export interface Npc {
  def: NpcDef; id: string; x: number; y: number; path: { x: number; y: number }[]; dest: string; sched: { t: number; loc: string }[];
  ox: number; oy: number; sx: number; sy: number; speed: number; beliefs: Record<number, number>; pressure: Record<string, number>;
  state: 'idle' | 'stalk' | 'flee' | 'gone'; open: boolean; hash: number; bubble: string; bubbleT: number; stealT: number; loot: number;
  fleeT: number; goneUntil: number; cool: number; met: boolean; schedKnown: boolean; chase: boolean; chaseCd: number; chaseT: number;
  face: number; walk: number; visible: boolean; moving: boolean;
}

export interface ActiveEvent { def: EventDef; startT: number; endT: number; started: boolean; ended: boolean }
export interface Commission {
  id: number; type: 'sell' | 'profit' | 'spread' | 'listen' | 'pump'; title: string; desc: string; target: number; progress: number;
  faction: FactionId; coins: number; favor: number; good?: GoodId; dir?: 1 | -1; done: boolean;
}
export interface Report {
  night: number; quota: number; coinsStart: number; coinsEnd: number; liquidated: number; tradeProfit: number; rumorIncome: number;
  resolved: { text: string; state: 'true' | 'false'; mine: boolean; note: string }[]; credDelta: number; commissions: number;
  ok: boolean; boss: boolean; arrests: number; robbed: number;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'coin' | 'dust'; g: number }
export interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
export interface Thread { a: { x: number; y: number }; b: { x: number; y: number }; life: number; color: string }
export interface Toast { id: number; msg: string; kind: string; life: number }

const META_KEY = 'bow_meta_v1';
const RUN_KEY = 'bow_run_v1';
const lsGet = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } };

const rr = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const shuffle = <T,>(arr: T[]): T[] => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const zeroGoods = (): Record<GoodId, number> => ({ spice: 0, silk: 0, oil: 0, relic: 0, tonic: 0, smoke: 0 });
const hashStr = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export function clockText(frac: number): string {
  const mins = Math.floor(20 * 60 + clamp(frac, 0, 1) * 9 * 60);
  let h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m < 10 ? '0' : ''}${m} ${ap}`;
}

export class Game {
  phase: Phase = 'title';
  paused = false;
  meta: Meta;
  run: Run;
  listeners = new Set<() => void>();

  t = 0; T = 185; frac = 0;
  rumors = new Map<number, Rumor>(); rid = 1;
  events: ActiveEvent[] = [];
  pendingEvents: ActiveEvent[] = [];
  npcs: Npc[] = [];
  ledger: LedgerEntry[] = [];
  planted: { rid: number; npcId: string }[] = [];
  sold: { rid: number; faction: FactionId; npcId: string }[] = [];
  debunked = new Set<number>();
  commissions: Commission[] = [];
  pendingComm: Commission[] = [];
  G = { spice: 1, silk: 1, oil: 1, relic: 1, tonic: 1, smoke: 1 } as Record<GoodId, number>;
  Nz = zeroGoods();
  hist = { spice: [], silk: [], oil: [], relic: [], tonic: [], smoke: [] } as unknown as Record<GoodId, number[]>;
  seen: Record<string, { ask: number; bid: number; t: number }> = {};
  infl = { guild: 50, court: 50, syndicate: 50, wardens: 50 } as Record<FactionId, number>;
  player = { x: 640, y: 400, face: 1, dashT: 0, dashCd: 0, stun: 0, target: null as null | { x: number; y: number; npcId?: string }, moved: 0, poise: 100, heat: 0, dx: 0, dy: 1 };
  keys = { up: false, down: false, left: false, right: false };
  pad = { x: 0, y: 0 };
  near: Npc | null = null;
  talk: Npc | null = null;
  listen: null | { npc: Npc; p: number; dur: number } = null;
  grip = 0; bossNight = false; magpieOn = false; magT = 20; magpie: Npc | null = null;
  toasts: Toast[] = []; toastId = 1;
  particles: Particle[] = []; floaters: Floater[] = []; threads: Thread[] = [];
  shake = 0; banner: null | { title: string; sub: string; icon: string; life: number } = null;
  report: Report | null = null;
  over: null | { reason: string; title: string; text: string } = null;
  marksGained = 0;
  tut = { on: false, step: 0 };
  flags = { talked: false, planted: false, bought: false, sold: false };
  hover: { x: number; y: number } | null = null;
  resolvedLog: Report['resolved'] = [];
  snap = { coins: 0, tradeProfit: 0, rumorIncome: 0, cred: 0, comm: 0, arrests: 0, robbed: 0 };
  nightLog = { tradeProfit: 0, rumorIncome: 0 };
  private accSpread = 0; private accMarket = 0; private accHist = 0; private accMood = 0; private commId = 1; private inspectCd = 0;
  private lastHint = 0;
  private stuckT = 0;

  constructor() {
    this.meta = this.loadMeta();
    this.run = this.freshRun('broker', []);
    audio.vol = { ...this.meta.vol };
    this.t = 0;
  }

  // ---------- subscription ----------
  subscribe(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  changed() { this.listeners.forEach(f => f()); }

  // ---------- persistence ----------
  private loadMeta(): Meta {
    const def: Meta = {
      marks: 0, up: {}, best: { nights: 0, worth: 0, wins: 0, runs: 0 }, tutDone: false,
      vol: { master: 0.7, music: 0.5, sfx: 0.8, muted: false }, opts: { shake: true, names: true, particles: true },
    };
    try {
      const raw = lsGet(META_KEY);
      if (raw) { const m = JSON.parse(raw); return { ...def, ...m, vol: { ...def.vol, ...(m.vol || {}) }, opts: { ...def.opts, ...(m.opts || {}) }, best: { ...def.best, ...(m.best || {}) }, up: m.up || {} }; }
    } catch { /* ignore corrupt */ }
    return def;
  }
  saveMeta() { this.meta.vol = { ...audio.vol }; lsSet(META_KEY, JSON.stringify(this.meta)); }
  saveRun() { lsSet(RUN_KEY, JSON.stringify(this.run)); }
  hasSave(): boolean { return !!lsGet(RUN_KEY); }
  setVol(v: Partial<Meta['vol']>) { audio.setVol(v); this.saveMeta(); this.changed(); }
  setOpt(k: keyof Meta['opts'], v: boolean) { this.meta.opts[k] = v; this.saveMeta(); this.changed(); }

  private freshRun(diffId: string, mods: string[]): Run {
    const d = DIFFICULTIES.find(x => x.id === diffId) || DIFFICULTIES[1];
    const L = this.meta.up;
    const cargo = {} as Run['cargo'];
    GOOD_IDS.forEach(g => { cargo[g] = { qty: 0, cost: 0 }; });
    return {
      night: 1, coins: d.coins + 60 * (L.purse || 0), cred: 55 + 8 * (L.name || 0), strikes: 0,
      favor: { guild: 0, court: 0, syndicate: 0, wardens: 0 }, perks: [], kit: {}, cargo, diff: d.id, mods: mods.slice(), endless: false, stats: newStats(),
    };
  }

  // ---------- derived ----------
  get diff() { return DIFFICULTIES.find(d => d.id === this.run.diff) || DIFFICULTIES[1]; }
  hasMod(id: string) { return this.run.mods.includes(id); }
  hasPerk(id: string) { return this.run.perks.includes(id); }
  kit(id: string) { return this.run.kit[id] || 0; }
  leg(id: string) { return this.meta.up[id] || 0; }
  get quota() { return Math.round(quotaFor(this.run.night) * this.diff.quota / 5) * 5; }
  get cap() { return 10 + 4 * this.kit('satchel') + 2 * this.leg('satchel') + (this.hasPerk('g_yoke') ? 5 : 0); }
  get cargoCount() { return GOOD_IDS.reduce((s, g) => s + this.run.cargo[g].qty, 0); }
  get maxPoise() { return 100 + 10 * this.leg('lungs'); }
  get credMult() { return 0.6 + this.run.cred / 125; }
  get speedMult() { return 1 + 0.04 * this.leg('legs') + (this.hasPerk('d_feet') ? 0.15 : 0); }
  get fineMult() { return (this.hasPerk('w_warrant') ? 0.5 : 1) * (this.hasPerk('d_bottom') ? 0.5 : 1); }
  get worth() { return Math.round(this.run.coins + GOOD_IDS.reduce((s, g) => s + this.run.cargo[g].qty * GOODS[g].base * this.G[g], 0)); }
  get eventsList() { return this.phase === 'dusk' ? this.pendingEvents : this.events; }
  points(f: FactionId) {
    const earned = Math.floor(Math.max(0, this.run.favor[f]) / FAVOR_PER_POINT);
    const spent = PERKS.filter(p => p.faction === f && this.hasPerk(p.id)).reduce((s, p) => s + p.cost, 0);
    return earned - spent;
  }
  evActive(flag: 'storm' | 'festival' | 'crackdown') { return this.events.some(e => e.started && !e.ended && e.def[flag]); }
  nextEvent() { const e = this.events.find(x => !x.started); return e ? { name: e.def.name, icon: e.def.icon, in: Math.max(0, e.startT - this.t) } : null; }
  pendingRumors() { return this.ledger.filter(l => this.rumors.get(l.rid)?.state === 'pending'); }
  believers(r: Rumor, th = 0.4) { let n = 0; for (const p of this.npcs) if ((p.beliefs[r.id] || 0) >= th) n++; return n; }
  get vendors() { return this.npcs.filter(n => n.def.role === 'vendor'); }

  // ---------- toast / fx ----------
  toast(msg: string, kind = 'info') {
    this.toasts.push({ id: this.toastId++, msg, kind, life: 5.5 });
    if (this.toasts.length > 5) this.toasts.shift();
    if (kind === 'bad') audio.play('deny'); else if (kind !== 'info') audio.play('toast');
    this.changed();
  }
  float(x: number, y: number, text: string, color = '#ffe9a8', size = 14) { this.floaters.push({ x, y, text, color, life: 1.6, max: 1.6, size }); if (this.floaters.length > 60) this.floaters.shift(); }
  burst(x: number, y: number, color: string, n = 10, kind: Particle['kind'] = 'spark', speed = 90) {
    if (!this.meta.opts.particles) n = Math.ceil(n / 4);
    for (let i = 0; i < n && this.particles.length < 420; i++) {
      const a = Math.random() * Math.PI * 2, s = rr(0.3, 1) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'coin' ? 60 : 0), life: rr(0.5, 1.1), max: 1.1, size: kind === 'coin' ? 3.4 : rr(1.5, 3), color, kind, g: kind === 'coin' ? 260 : kind === 'dust' ? 20 : 0 });
    }
  }
  addShake(m: number) { if (this.meta.opts.shake) this.shake = Math.min(14, this.shake + m); }
  thread(a: { x: number; y: number }, b: { x: number; y: number }, color: string) { this.threads.push({ a, b, life: 1.2, color }); if (this.threads.length > 40) this.threads.shift(); }

  // ---------- run lifecycle ----------
  newRun(diffId: string, mods: string[]) {
    this.run = this.freshRun(diffId, mods);
    this.over = null; this.report = null;
    this.tut = { on: !this.meta.tutDone, step: 0 };
    this.flags = { talked: false, planted: false, bought: false, sold: false };
    this.player.heat = 0;
    this.meta.best.runs++;
    this.saveMeta();
    this.enterDusk();
  }
  continueRun(): boolean {
    try {
      const raw = lsGet(RUN_KEY); if (!raw) return false;
      const r = JSON.parse(raw) as Run;
      const fresh = this.freshRun(r.diff, r.mods || []);
      this.run = { ...fresh, ...r, stats: { ...fresh.stats, ...r.stats }, favor: { ...fresh.favor, ...r.favor }, cargo: { ...fresh.cargo, ...r.cargo } };
      this.over = null; this.report = null;
      this.tut = { on: false, step: 0 };
      this.enterDusk();
      return true;
    } catch { return false; }
  }
  toTitle() { this.stopNightAudio(); this.phase = 'title'; this.talk = null; this.listen = null; this.paused = false; this.changed(); }
  private stopNightAudio() { audio.setMood({ night: false, heat: 0, boss: false }); }

  enterDusk() {
    this.phase = 'dusk'; this.paused = false; this.talk = null; this.listen = null;
    this.G = { spice: 1, silk: 1, oil: 1, relic: 1, tonic: 1, smoke: 1 };
    this.prepareNight();
    this.stopNightAudio();
    audio.startMusic();
    this.saveRun();
    this.changed();
  }

  private genEvents(night: number): ActiveEvent[] {
    const boss = night === FINALE_NIGHT && !this.run.endless;
    const count = boss ? 4 : night <= 1 ? 2 : night <= 4 ? (Math.random() < 0.5 ? 2 : 3) : night <= 8 ? 3 : 4;
    let pool = EVENTS.slice();
    if (night <= 1) pool = pool.filter(e => ['galleon', 'blight', 'plague', 'find', 'moon', 'festival'].includes(e.id));
    const chosen: EventDef[] = [];
    const used = new Set<string>();
    if (boss) { chosen.push(EVENTS.find(e => e.id === 'gala')!); used.add('relic'); }
    for (const e of shuffle(pool)) {
      if (chosen.length >= count) break;
      if (chosen.includes(e) || used.has(e.main)) continue;
      chosen.push(e); used.add(e.main);
    }
    const out: ActiveEvent[] = [];
    const width = 0.62 / chosen.length;
    shuffle(chosen).forEach((def, i) => {
      const s = 0.16 + i * width + rr(0, width * 0.35);
      const e = Math.min(0.97, s + rr(0.17, 0.28));
      out.push({ def, startT: s, endT: e, started: false, ended: false });
    });
    return out;
  }
  private genCommissions(night: number): Commission[] {
    const types = shuffle(['sell', 'profit', 'spread', 'listen', 'pump'] as Commission['type'][]).slice(0, 3);
    const base = 40 + night * 9;
    return types.map(type => {
      const id = this.commId++;
      const g = pick(GOOD_IDS);
      const gf = GOODS[g].faction;
      if (type === 'sell') {
        const f = pick(FACTION_IDS);
        const n = night > 5 ? 3 : 2;
        return { id, type, title: `${FACTIONS[f].icon} Fresh Whispers`, desc: `Sell ${n} rumors to ${FACTIONS[f].name} folk.`, target: n, progress: 0, faction: f, coins: base, favor: 14, done: false };
      }
      if (type === 'profit') {
        const tg = 25 + night * 9;
        return { id, type, title: `${GOODS[g].icon} Honest Profit`, desc: `Earn ${tg}c profit selling ${GOODS[g].name}.`, target: tg, progress: 0, faction: gf, coins: Math.round(base * 0.8), favor: 16, good: g, done: false };
      }
      if (type === 'spread') {
        const n = 5 + Math.floor(night / 3);
        return { id, type, title: '🕸️ Make It Viral', desc: `Get ${n} people to believe a rumor you planted or forged.`, target: n, progress: 0, faction: 'court', coins: Math.round(base * 1.2), favor: 18, done: false };
      }
      if (type === 'listen') {
        const n = 3 + (night > 6 ? 1 : 0);
        return { id, type, title: '👂 Keep Your Ears Open', desc: `Eavesdrop successfully ${n} times.`, target: n, progress: 0, faction: 'syndicate', coins: Math.round(base * 0.7), favor: 12, done: false };
      }
      const dir: 1 | -1 = Math.random() < 0.6 ? 1 : -1;
      return { id, type: 'pump', title: `${GOODS[g].icon} Move the Market`, desc: `Push the ${GOODS[g].name} price ${dir > 0 ? 'up' : 'down'} by 15%.`, target: 15, progress: 0, faction: gf, coins: Math.round(base * 1.1), favor: 16, good: g, dir, done: false };
    });
  }
  prepareNight() {
    this.pendingEvents = this.genEvents(this.run.night);
    this.pendingComm = this.genCommissions(this.run.night);
  }
  forecast() {
    const n = this.leg('omens');
    return [...this.pendingEvents].sort((a, b) => a.startT - b.startT).slice(0, n);
  }

  // ---------- night setup ----------
  beginNight() {
    const night = this.run.night;
    const d = this.diff;
    this.bossNight = night === FINALE_NIGHT && !this.run.endless;
    this.T = d.night * (this.bossNight ? 1.15 : 1);
    this.t = 0; this.frac = 0;
    this.rumors = new Map(); this.rid = 1;
    this.events = this.pendingEvents.length ? this.pendingEvents : this.genEvents(night);
    this.pendingEvents = [];
    this.commissions = this.pendingComm.length ? this.pendingComm : this.genCommissions(night);
    this.pendingComm = [];
    this.ledger = []; this.planted = []; this.sold = []; this.debunked = new Set();
    this.threads = []; this.floaters = []; this.particles = []; this.toasts = [];
    this.G = { spice: 1, silk: 1, oil: 1, relic: 1, tonic: 1, smoke: 1 };
    this.Nz = zeroGoods();
    GOOD_IDS.forEach(g => { this.hist[g] = [1]; });
    this.seen = {};
    this.infl = { guild: 50, court: 50, syndicate: 50, wardens: 50 };
    this.player = { x: 640, y: 410, face: 1, dashT: 0, dashCd: 0, stun: 0, target: null, moved: 0, poise: this.maxPoise, heat: Math.min(this.player.heat, 25), dx: 0, dy: 1 };
    this.near = null; this.talk = null; this.listen = null; this.paused = false;
    this.grip = this.bossNight ? 15 : 0;
    this.magpieOn = night >= 3 || this.bossNight || this.run.endless;
    this.magT = this.bossNight ? 8 : rr(14, 22) * d.magpie;
    this.resolvedLog = []; this.nightLog = { tradeProfit: 0, rumorIncome: 0 };
    this.accSpread = 0; this.accMarket = 0; this.accHist = 0; this.inspectCd = 12;
    this.report = null; this.banner = null;
    this.snap = { coins: this.run.coins, tradeProfit: this.run.stats.tradeProfit, rumorIncome: 0, cred: this.run.cred, comm: this.run.stats.commissions, arrests: this.run.stats.arrests, robbed: this.run.stats.robbed };

    this.buildNpcs();
    this.seedRumors();
    this.applyStartPerks();
    this.phase = 'night';
    audio.init(); audio.startMusic();
    audio.setMood({ night: true, heat: 0, crowd: 0.6, boss: this.bossNight });
    audio.play('bell');
    this.banner = { title: this.bossNight ? 'The Masquerade' : `Night ${night}`, sub: this.bossNight ? 'The Magpie means to corner the market. Hold the line until dawn.' : `The tithe is ${this.quota}c. Make the whispers pay.`, icon: this.bossNight ? '🐦' : '🌙', life: 4.5 };
    this.changed();
  }

  private makeNpc(def: NpcDef): Npc {
    const hash = hashStr(def.id);
    const sched = this.makeSchedule(def);
    const loc = LOC[sched[0].loc];
    const sx = rr(-1, 1), sy = rr(-1, 1);
    const baseSpeed = def.role === 'warden' ? 62 : def.role === 'cutpurse' ? 72 : def.role === 'rival' ? 82 : def.role === 'noble' ? 48 : 52 + (hash % 20);
    const n: Npc = {
      def, id: def.id, x: loc.x + (def.role === 'vendor' ? 0 : sx * 24), y: loc.y + (def.role === 'vendor' ? 0 : sy * 24), path: [], dest: sched[0].loc, sched,
      ox: rr(-14, 14), oy: rr(-14, 14), sx, sy, speed: baseSpeed, beliefs: {}, pressure: {}, state: 'idle', open: true, hash,
      bubble: '', bubbleT: 0, stealT: 0, loot: 0, fleeT: 0, goneUntil: 0, cool: rr(2, 8), met: false, schedKnown: false, chase: false, chaseCd: rr(8, 20), chaseT: 0,
      face: 1, walk: 0, visible: true, moving: false,
    };
    if (def.role === 'cutpurse') { const dk = LOC.docks; n.x = dk.x + sx * 30; n.y = dk.y + sy * 20; }
    return n;
  }
  private makeSchedule(def: NpcDef): { t: number; loc: string }[] {
    const out: { t: number; loc: string }[] = [];
    const stalls = STALL_LOCS.map(l => l.id);
    switch (def.role) {
      case 'vendor': { const b = rr(0.25, 0.68); out.push({ t: 0, loc: def.home! }, { t: b, loc: 'tavern' }, { t: b + rr(0.06, 0.09), loc: def.home! }); break; }
      case 'informant': case 'noble': {
        const r = def.route!; const off = Math.floor(Math.random() * r.length);
        for (let i = 0; i < r.length; i++) out.push({ t: i === 0 ? 0 : clamp(i / r.length + rr(-0.04, 0.04), 0.02, 0.98), loc: r[(i + off) % r.length] });
        const loop = r.slice(); out.push({ t: 0.82, loc: loop[off % loop.length] });
        break;
      }
      case 'patron': {
        const stops = 6 + Math.floor(Math.random() * 3); let last = '';
        for (let i = 0; i < stops; i++) { let l = pick(PATRON_SPOTS); if (l === last) l = pick(PATRON_SPOTS); last = l; out.push({ t: i === 0 ? 0 : clamp(i / stops + rr(-0.03, 0.03), 0.02, 0.98), loc: l }); }
        break;
      }
      case 'warden': {
        const route = shuffle(['wardpost', 'fountain', 'docks', 'smoke', 'tonic', 'spice', 'tavern', 'relic', 'oil', 'silk']);
        route.slice(0, 8).forEach((l, i) => out.push({ t: i / 8, loc: l }));
        break;
      }
      case 'cutpurse': { for (let i = 0; i < 10; i++) out.push({ t: i / 10, loc: pick([...stalls, 'fountain', 'fountain', 'tavern']) }); break; }
      case 'rival': { for (let i = 0; i < 9; i++) out.push({ t: i / 9, loc: pick([...stalls, 'fountain', 'pavilion', 'tavern']) }); break; }
    }
    out.sort((a, b) => a.t - b.t); out[0].t = 0;
    return out;
  }
  private buildNpcs() {
    const d = this.diff;
    const list: NpcDef[] = [...VENDORS, ...INFORMANTS, ...NOBLES, ...WARDENS.slice(0, this.hasMod('iron') ? 3 : 2), ...PATRONS];
    const thieves = Math.min(CUTPURSES.length, d.thieves + (this.hasMod('season') ? 3 : 0) + (this.run.night > 8 ? 1 : 0));
    list.push(...CUTPURSES.slice(0, thieves));
    this.magpie = null;
    if (this.magpieOn) list.push(MAGPIE);
    this.npcs = list.map(def => this.makeNpc(def));
    this.magpie = this.npcs.find(n => n.def.role === 'rival') || null;
    this.npcs.forEach(n => { if (n.def.role === 'vendor') GOOD_IDS.forEach(g => { n.pressure[g] = 0; }); });
  }

  private addRumor(r: Omit<Rumor, 'id' | 'state'>): Rumor {
    const rumor: Rumor = { ...r, id: this.rid++, state: 'pending' };
    this.rumors.set(rumor.id, rumor);
    return rumor;
  }
  private giveBelief(npc: Npc, r: Rumor, b: number) { npc.beliefs[r.id] = Math.max(npc.beliefs[r.id] || 0, clamp(b, 0, 0.97)); }
  private seedRumors() {
    const informants = this.npcs.filter(n => n.def.role === 'informant');
    const talkers = this.npcs.filter(n => ['patron', 'noble', 'vendor'].includes(n.def.role));
    const evs = this.events;
    evs.forEach((e, i) => {
      const main = e.def.main; const fx = e.def.fx[main] || 0;
      const r = this.addRumor({ kind: 'market', good: main, dir: fx >= 0 ? 1 : -1, mag: Math.abs(fx), truth: true, text: e.def.hint, born: 0, resolveAt: e.startT * this.T + 3, origin: 'event' });
      this.giveBelief(informants[i % informants.length], r, 0.95);
      if (Math.random() < 0.45) this.giveBelief(pick(talkers), r, 0.8);
    });
    const noise = 3 + Math.floor(this.run.night / 4) + (this.hasMod('lies') ? 3 : 0);
    for (let i = 0; i < noise; i++) {
      let g = pick(GOOD_IDS); let dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1; let tries = 0;
      while (tries++ < 12 && evs.some(e => (e.def.fx[g] || 0) * dir > 0.12)) { g = pick(GOOD_IDS); dir = Math.random() < 0.5 ? 1 : -1; }
      const r = this.addRumor({ kind: 'market', good: g, dir, mag: rr(0.2, 0.35), truth: false, text: marketText(g, dir, Math.floor(Math.random() * 4)), born: 0, resolveAt: rr(0.35, 0.85) * this.T, origin: 'noise' });
      this.giveBelief(i < informants.length ? informants[(i + 1) % informants.length] : pick(talkers), r, rr(0.8, 0.95));
      if (Math.random() < 0.5) this.giveBelief(pick(talkers), r, 0.7);
    }
    const sc = 1 + (Math.random() < 0.5 ? 1 : 0);
    for (let i = 0; i < sc; i++) {
      const f = pick(FACTION_IDS);
      const r = this.addRumor({ kind: 'scandal', dir: -1, mag: 0.3, faction: f, truth: Math.random() < 0.5, text: scandalText(f, Math.floor(Math.random() * 4)), born: 0, resolveAt: rr(0.45, 0.85) * this.T, origin: 'scandal' });
      const holders = this.npcs.filter(n => n.def.role === 'noble' || n.def.role === 'informant');
      this.giveBelief(pick(holders), r, 0.9);
    }
  }
  private applyStartPerks() {
    if (this.hasPerk('d_tide')) {
      const r = [...this.rumors.values()].find(x => x.origin === 'event');
      if (r) this.addLedger(r.id, 'Tide Tipoff', 'gift');
    }
    if (this.hasPerk('d_ghost')) {
      let best: GoodId = pick(GOOD_IDS), bv = 0;
      this.events.forEach(e => GOOD_IDS.forEach(g => { const v = e.def.fx[g] || 0; if (v > bv) { bv = v; best = g; } }));
      const room = Math.max(0, this.cap - this.cargoCount);
      const q = Math.min(5, room);
      if (q > 0) { const c = this.run.cargo[best]; c.cost = (c.cost * c.qty) / Math.max(1, c.qty + q); c.qty += q; this.toast(`Ghost Cargo delivers ${q}x ${GOODS[best].name}.`, 'good'); }
    }
  }
  private addLedger(rid: number, from: string, how: LedgerEntry['how']) {
    if (this.ledger.some(l => l.rid === rid)) return false;
    this.ledger.push({ rid, from, how, t: this.t, sold: 0, planted: 0 });
    return true;
  }

  // ---------- rumor economics ----------
  rumorValue(r: Rumor): number {
    const ageF = clamp(this.t / this.T, 0, 1);
    const base = r.kind === 'market' ? 22 + r.mag * 120 + GOODS[r.good!].base * 0.4 : 55 + this.run.night * 4;
    const scarcity = 1 / (1 + this.believers(r) / 5);
    return Math.max(4, base * scarcity * (1 - 0.4 * ageF) * (1 + this.run.night * 0.06));
  }
  private interest(npc: Npc, r: Rumor): number {
    let m = 1;
    if (r.kind === 'market') { if (npc.def.good === r.good) m *= 1.5; if (npc.def.faction === 'guild') m *= 1.2; if (npc.def.role === 'noble') m *= 1.2; }
    else {
      const f = r.faction!;
      if (FACTIONS[f].rival === npc.def.faction) m *= 1.7; else if (npc.def.faction === f) m *= 0.45; else if (npc.def.role === 'warden') m *= 1.2;
    }
    if (npc.def.role === 'patron') m *= 0.8;
    return m;
  }
  sellPrice(npc: Npc, r: Rumor): number {
    const fav = this.run.favor[npc.def.faction];
    return Math.max(1, Math.round(this.rumorValue(r) * this.interest(npc, r) * this.credMult * (this.hasPerk('c_tongue') ? 1.2 : 1) * (1 + clamp(fav / 400, -0.1, 0.3))));
  }
  buyPrice(npc: Npc, r: Rumor): number {
    const fav = this.run.favor[npc.def.faction];
    const roleM = npc.def.role === 'informant' ? 0.7 : npc.def.role === 'patron' ? 0.9 : 1.1;
    return Math.max(3, Math.round(this.rumorValue(r) * roleM * (1.35 - this.run.cred / 200) * (1 - clamp(fav / 500, -0.1, 0.2))));
  }
  offers(npc: Npc): Rumor[] {
    if (['warden', 'cutpurse', 'rival'].includes(npc.def.role)) return [];
    const out: Rumor[] = [];
    for (const k of Object.keys(npc.beliefs)) {
      const r = this.rumors.get(+k);
      if (r && r.state === 'pending' && npc.beliefs[r.id] >= 0.4 && !this.ledger.some(l => l.rid === r.id)) out.push(r);
    }
    return out;
  }
  hint(r: Rumor): { guess: boolean; acc: number } | null {
    const lvl = this.kit('lens');
    if (lvl <= 0) return null;
    const acc = [0.5, 0.7, 0.85, 0.95][lvl];
    const h = ((r.id * 2654435761) >>> 0) / 4294967296;
    return { guess: h < acc ? r.truth : !r.truth, acc };
  }
  private credDelta(n: number) { this.run.cred = clamp(this.run.cred + n, 0, 100); }
  addFavor(f: FactionId, n: number) {
    const before = this.run.favor[f];
    this.run.favor[f] = clamp(before + n, -50, FAVOR_MAX);
    if (n > 0 && Math.floor(this.run.favor[f] / FAVOR_PER_POINT) > Math.floor(Math.max(0, before) / FAVOR_PER_POINT)) {
      this.toast(`${FACTIONS[f].icon} ${FACTIONS[f].name}: a Favor point is ready to spend!`, 'good');
    }
  }
  gain(n: number) { this.run.coins += n; this.run.stats.earned += n; const w = this.worth; if (w > this.run.stats.peakWorth) this.run.stats.peakWorth = w; }
  spend(n: number) { this.run.coins -= n; this.run.stats.spent += n; }
  addHeat(x: number) {
    const m = this.diff.heat * (1 - 0.2 * this.kit('mask')) * (this.evActive('crackdown') ? 1.8 : 1) * (this.hasMod('iron') ? 1.5 : 1);
    this.player.heat = clamp(this.player.heat + x * m, 0, 100);
    if (this.player.heat >= 100) this.arrest();
  }

  // ---------- player actions ----------
  private canAct(npc: Npc) { return this.phase === 'night' && npc.visible && Math.hypot(npc.x - this.player.x, npc.y - this.player.y) < 150; }
  openTalk(npc: Npc) {
    if (this.phase !== 'night' || this.paused || this.player.stun > 0) return;
    if (npc.def.role === 'cutpurse') { if (!this.tryCatch()) this.float(npc.x, npc.y - 24, 'Hands off!', '#ff9a8a'); return; }
    this.talk = npc; npc.met = true; npc.schedKnown = true; this.flags.talked = true;
    this.player.target = null; audio.play('click'); this.changed();
  }
  closeTalk() { if (!this.talk) return; this.talk = null; this.listen = null; audio.play('click'); this.changed(); }
  interact() {
    if (this.phase !== 'night' || this.paused || this.talk) return;
    if (this.tryCatch()) return;
    if (this.near) this.openTalk(this.near);
  }
  clickWorld(x: number, y: number) {
    if (this.phase !== 'night' || this.paused || this.talk || this.player.stun > 0) return;
    let best: Npc | null = null, bd = 30;
    for (const n of this.npcs) { if (!n.visible) continue; const d = Math.hypot(n.x - x, n.y - y); if (d < bd) { bd = d; best = n; } }
    if (best) {
      const d = Math.hypot(best.x - this.player.x, best.y - this.player.y);
      if (d <= 85) { if (best.def.role === 'cutpurse') this.tryCatch(); else this.openTalk(best); }
      else this.player.target = { x: best.x, y: best.y, npcId: best.id };
    } else this.player.target = { x: clamp(x, 24, W - 24), y: clamp(y, 24, H - 24) };
  }
  setKey(code: string, down: boolean): boolean {
    switch (code) {
      case 'KeyW': case 'ArrowUp': this.keys.up = down; return true;
      case 'KeyS': case 'ArrowDown': this.keys.down = down; return true;
      case 'KeyA': case 'ArrowLeft': this.keys.left = down; return true;
      case 'KeyD': case 'ArrowRight': this.keys.right = down; return true;
    }
    return false;
  }
  dash() {
    const p = this.player;
    if (this.phase !== 'night' || this.paused || this.talk || p.dashCd > 0 || p.stun > 0) return;
    const cost = this.hasPerk('d_feet') ? 4 : 8;
    if (p.poise < cost) { audio.play('deny'); return; }
    p.poise -= cost; p.dashT = this.kit('wary') ? 0.26 : 0.18; p.dashCd = 0.9;
    audio.play('dash'); this.burst(p.x, p.y, '#b9a4ff', 8, 'dust', 60);
  }
  private tryCatch(): boolean {
    for (const n of this.npcs) {
      if (n.def.role === 'cutpurse' && n.state === 'flee' && Math.hypot(n.x - this.player.x, n.y - this.player.y) < 62) { this.catchThief(n); return true; }
    }
    return false;
  }
  private catchThief(n: Npc) {
    const bounty = this.hasPerk('w_deputy') ? 15 : 0;
    const back = n.loot + bounty;
    this.gain(back); this.run.stats.caught++;
    this.float(n.x, n.y - 24, `Caught! +${back}c`, '#9affc0', 16); this.burst(n.x, n.y, '#ffd86b', 14, 'coin');
    this.addFavor('wardens', this.hasPerk('w_deputy') ? 3 : 1);
    n.loot = 0; n.state = 'gone'; n.goneUntil = this.t + 40; n.visible = false;
    audio.play('catch'); this.addShake(3); this.toast(`You caught ${n.def.name} and recovered ${back}c!`, 'good');
  }

  eavesdrop(npc: Npc): boolean {
    if (!this.canAct(npc) || this.listen) return false;
    const cost = this.hasPerk('c_quiet') ? 4 : 8;
    if (this.player.poise < cost) { this.toast('Not enough Poise.', 'bad'); return false; }
    const range = 110 * (1 + 0.25 * this.kit('trumpet'));
    if (Math.hypot(npc.x - this.player.x, npc.y - this.player.y) > range) { this.toast('Too far to hear. Step closer.', 'bad'); return false; }
    this.player.poise -= cost;
    this.listen = { npc, p: 0, dur: 1.5 };
    audio.play('listen'); this.changed();
    return true;
  }
  private finishListen(npc: Npc) {
    const roleP: Record<string, number> = { patron: 0.12, vendor: 0.12, informant: 0.3, noble: 0.35, warden: 0.55, rival: 0.5, cutpurse: 0.3 };
    const noticeP = (roleP[npc.def.role] || 0.2) * (1 - 0.2 * this.kit('trumpet')) * (this.hasPerk('c_quiet') ? 0.4 : 1);
    const cand: Rumor[] = [];
    for (const k of Object.keys(npc.beliefs)) { const r = this.rumors.get(+k); if (r && r.state === 'pending' && npc.beliefs[r.id] >= 0.3) cand.push(r); }
    const fresh = cand.filter(r => !this.ledger.some(l => l.rid === r.id));
    if (Math.random() < noticeP) {
      npc.bubble = '!'; npc.bubbleT = 2;
      if (npc.def.role === 'warden' || npc.def.role === 'noble') { this.addHeat(9); this.toast(`${npc.def.name} caught you eavesdropping!`, 'bad'); }
      else { this.addFavor(npc.def.faction, -2); this.toast(`${npc.def.name} noticed you listening. (-2 favor)`, 'bad'); }
      this.addShake(2);
      if (Math.random() < 0.5) { this.changed(); return; }
    }
    if (!fresh.length) {
      this.player.poise = Math.min(this.maxPoise, this.player.poise + 4);
      this.toast(cand.length ? 'You already know everything they whispered.' : 'Only idle chatter...', 'info');
      this.changed(); return;
    }
    const r = pick(fresh);
    this.addLedger(r.id, npc.def.name, 'overheard');
    this.run.stats.eavesdrops++;
    this.commissions.forEach(c => { if (c.type === 'listen' && !c.done) { c.progress++; this.checkComm(c); } });
    this.float(this.player.x, this.player.y - 30, 'Overheard!', '#d6c2ff', 15);
    this.burst(this.player.x, this.player.y - 10, '#c9b0ff', 10, 'spark', 70);
    audio.play('whisper');
    this.toast(`Overheard: "${r.text}"`, 'good');
    this.changed();
  }
  buyRumor(npc: Npc, rid: number) {
    const r = this.rumors.get(rid); if (!r || !this.canAct(npc) || r.state !== 'pending') return;
    const price = this.buyPrice(npc, r);
    if (this.run.coins < price) { this.toast('Not enough coin.', 'bad'); return; }
    this.spend(price); this.addLedger(rid, npc.def.name, 'bought'); this.run.stats.rumorsBought++;
    audio.play('buy'); this.float(this.player.x, this.player.y - 28, `-${price}c`, '#ff9a8a'); this.changed();
  }
  sellRumor(npc: Npc, rid: number) {
    const r = this.rumors.get(rid); const le = this.ledger.find(l => l.rid === rid);
    if (!r || !le || !this.canAct(npc)) return;
    if (r.state !== 'pending') { this.toast('That is old news now.', 'bad'); return; }
    if ((npc.beliefs[rid] || 0) >= 0.5) { this.toast(`${npc.def.name} has already heard it.`, 'bad'); return; }
    if (['cutpurse', 'rival'].includes(npc.def.role)) { audio.play('deny'); return; }
    const price = this.sellPrice(npc, r);
    this.gain(price); this.nightLog.rumorIncome += price;
    this.giveBelief(npc, r, 0.5 + 0.35 * npc.def.trust);
    le.sold++; this.sold.push({ rid, faction: npc.def.faction, npcId: npc.id });
    this.run.stats.rumorsSold++; this.flags.sold = true;
    if (r.kind === 'scandal') {
      if (npc.def.faction === r.faction) this.addFavor(npc.def.faction, -3);
      else if (FACTIONS[r.faction!].rival === npc.def.faction) this.addFavor(npc.def.faction, 3);
    }
    this.addFavor(npc.def.faction, 1);
    this.commissions.forEach(c => { if (c.type === 'sell' && !c.done && c.faction === npc.def.faction) { c.progress++; this.checkComm(c); } });
    this.float(npc.x, npc.y - 28, `+${price}c`, '#ffe08a', 16); this.burst(npc.x, npc.y - 10, '#ffd86b', 10, 'coin');
    audio.play('sell'); this.changed();
  }
  plantCost() { return 18; }
  plant(npc: Npc, rid: number) {
    const r = this.rumors.get(rid); const le = this.ledger.find(l => l.rid === rid);
    if (!r || !le || !this.canAct(npc)) return;
    if (r.state !== 'pending') { this.toast('That rumor has already played out.', 'bad'); return; }
    if (['warden', 'cutpurse', 'rival'].includes(npc.def.role)) { this.toast(`${npc.def.name} will not carry gossip.`, 'bad'); return; }
    if (this.player.poise < this.plantCost()) { this.toast('Not enough Poise.', 'bad'); return; }
    const target = clamp(0.45 + this.run.cred / 250 + (this.hasPerk('c_net') ? 0.2 : 0) + npc.def.trust * 0.2 - r.mag * 0.2, 0.3, 0.95);
    if ((npc.beliefs[rid] || 0) >= target - 0.05) { this.toast(`${npc.def.name} already believes it.`, 'info'); return; }
    this.player.poise -= this.plantCost();
    this.giveBelief(npc, r, target);
    le.planted++; this.planted.push({ rid, npcId: npc.id });
    this.run.stats.rumorsPlanted++; this.flags.planted = true;
    this.thread(this.player, npc, '#e8c0ff');
    this.float(npc.x, npc.y - 28, 'planted ✦', '#e8c0ff', 14); this.burst(npc.x, npc.y - 12, '#d6a8ff', 12, 'spark', 60);
    const warden = this.npcs.find(n => n.def.role === 'warden' && Math.hypot(n.x - this.player.x, n.y - this.player.y) < 170);
    if (warden && !(this.hasPerk('w_badge') && this.player.heat < 60)) { this.addHeat(6); this.toast('A Warden saw you whispering!', 'bad'); }
    if (this.hasPerk('c_web')) {
      const others = this.npcs.filter(n => n !== npc && !['warden', 'cutpurse', 'rival'].includes(n.def.role) && n.visible)
        .sort((a, b) => Math.hypot(a.x - npc.x, a.y - npc.y) - Math.hypot(b.x - npc.x, b.y - npc.y)).slice(0, 2);
      others.forEach(o => { this.giveBelief(o, r, target * 0.7); this.thread(npc, o, '#c7f0ff'); });
    }
    audio.play('plant'); this.changed();
  }
  debunk(npc: Npc, rid: number) {
    const r = this.rumors.get(rid); if (!r || !this.canAct(npc) || r.state !== 'pending') return;
    const cost = 10 + this.run.night * 2;
    if (this.player.poise < 15) { this.toast('Not enough Poise.', 'bad'); return; }
    if (this.run.coins < cost) { this.toast('Not enough coin to grease the argument.', 'bad'); return; }
    if ((npc.beliefs[rid] || 0) < 0.2) return;
    this.player.poise -= 15; this.spend(cost);
    if (Math.random() < 0.55 + this.run.cred / 250) {
      delete npc.beliefs[rid]; this.debunked.add(rid); this.run.stats.debunks++;
      this.float(npc.x, npc.y - 28, 'Doubt sown', '#9fd8ff', 14); this.burst(npc.x, npc.y - 12, '#9fd8ff', 10); audio.play('debunk');
    } else { this.float(npc.x, npc.y - 28, 'They scoff', '#ff9a8a', 14); audio.play('deny'); }
    this.changed();
  }
  gift(npc: Npc) {
    const cost = 15 + this.run.night * 2;
    if (this.run.coins < cost) { this.toast('Not enough coin.', 'bad'); return; }
    this.spend(cost); this.addFavor(npc.def.faction, 3);
    npc.beliefs = { ...npc.beliefs };
    this.float(npc.x, npc.y - 28, `${FACTIONS[npc.def.faction].icon} +3`, FACTIONS[npc.def.faction].color, 15); audio.play('coin'); this.changed();
  }
  bribeCost() { return 40 + this.run.night * 12; }
  bribe(npc: Npc) {
    if (npc.def.role !== 'warden') return;
    const cost = this.bribeCost();
    if (this.run.coins < cost) { this.toast('Not enough coin.', 'bad'); return; }
    this.spend(cost); this.player.heat = Math.max(0, this.player.heat - 35); this.addFavor('wardens', 2);
    this.float(npc.x, npc.y - 28, 'Heat -35', '#9ad7ff', 15); audio.play('coin'); this.changed();
  }
  evidence() { return this.ledger.filter(l => { const r = this.rumors.get(l.rid); return r && r.origin === 'magpie' && r.state === 'false' && !l.used; }); }
  expose(npc: Npc) {
    if (npc.def.role !== 'rival' || !this.canAct(npc)) return;
    const ev = this.evidence();
    if (ev.length < 2) { this.toast('You need two debunked Magpie rumors as proof.', 'bad'); return; }
    ev[0].used = true; ev[1].used = true; this.run.stats.exposed++;
    if (this.bossNight) { this.grip = Math.max(0, this.grip - 32); this.toast('You expose the Magpie before the crowd! Her grip falters.', 'good'); }
    else { const r = 50 + this.run.night * 10; this.gain(r); this.toast(`The Magpie flees, humiliated. You collect ${r}c in bounties.`, 'good'); }
    npc.state = 'gone'; npc.goneUntil = this.t + (this.bossNight ? 22 : 45); npc.visible = false;
    this.talk = null; this.addShake(5); audio.play('success'); this.burst(npc.x, npc.y, '#ffffff', 24); this.changed();
  }
  forge(spec: { kind: 'market' | 'scandal'; good?: GoodId; dir?: 1 | -1; mag?: number; faction?: FactionId }) {
    const mag = clamp(spec.mag ?? 1, 0, 2);
    const cost = this.forgeCost(mag);
    if (this.run.coins < cost) { this.toast('Not enough coin for ink and bribes.', 'bad'); return; }
    if (this.player.poise < 14) { this.toast('Not enough Poise.', 'bad'); return; }
    this.spend(cost); this.player.poise -= 14;
    const magV = [0.15, 0.25, 0.4][mag];
    let r: Rumor;
    const resolveAt = this.t + 80;
    if (spec.kind === 'market' && spec.good) {
      const dir = spec.dir ?? 1;
      const truth = this.events.some(e => (e.def.fx[spec.good!] || 0) * dir > 0.14 && e.startT * this.T <= resolveAt + 8 && e.endT * this.T >= this.t);
      r = this.addRumor({ kind: 'market', good: spec.good, dir, mag: magV, truth, text: marketText(spec.good, dir, Math.floor(Math.random() * 4)), born: this.t, resolveAt, origin: 'player' });
    } else {
      const f = spec.faction || 'guild';
      r = this.addRumor({ kind: 'scandal', dir: -1, mag: 0.3, faction: f, truth: Math.random() < 0.25, text: scandalText(f, Math.floor(Math.random() * 4)), born: this.t, resolveAt, origin: 'player' });
    }
    this.addLedger(r.id, 'Your quill', 'forged');
    this.run.stats.rumorsForged++;
    this.float(this.player.x, this.player.y - 30, 'Forged!', '#ffd6a8', 15); audio.play('forge'); this.changed();
  }
  forgeCost(mag: number) { return Math.round((14 + mag * 10 + this.run.night * 2) * (this.hasPerk('c_quill') ? 0.6 : 1)); }

  // ---------- trading ----------
  localBelief(v: Npc, g: GoodId): number {
    let s = 0;
    for (const k of Object.keys(v.beliefs)) {
      const r = this.rumors.get(+k);
      if (r && r.state === 'pending' && r.kind === 'market' && r.good === g) s += v.beliefs[r.id] * r.dir * r.mag;
    }
    return clamp(s * 0.6, -0.5, 0.5);
  }
  quote(v: Npc, g: GoodId) {
    const spec = v.def.good === g;
    let mid = GOODS[g].base * this.G[g] * (1 + this.localBelief(v, g)) * (1 + (v.pressure[g] || 0));
    if (spec) mid *= 0.87;
    const fav = this.run.favor[v.def.faction];
    const spread = 0.05 - (this.hasPerk('g_scales') ? 0.02 : 0) + (fav < -20 ? 0.03 : 0) - (fav > 40 ? 0.01 : 0);
    let ask = mid * (1 + spread), bid = mid * (1 - spread);
    if (g === 'smoke' && this.hasPerk('d_alley')) bid *= 1.12;
    if (this.hasPerk('g_charter')) bid *= 1.04;
    return { ask: Math.max(1, Math.round(ask)), bid: Math.max(1, Math.round(bid)), mid };
  }
  private impact() { return 0.03 * (this.hasPerk('g_charter') ? 0.5 : 1); }
  buyTotal(v: Npc, g: GoodId, qty: number) {
    const q = this.quote(v, g); let tot = 0; const imp = this.impact();
    for (let i = 0; i < qty; i++) tot += Math.round(q.ask * (1 + imp * i));
    if (this.hasPerk('g_bulk') && qty >= 5) tot = Math.round(tot * 0.94);
    return tot;
  }
  sellTotal(v: Npc, g: GoodId, qty: number) {
    const q = this.quote(v, g); let tot = 0; const imp = this.impact();
    for (let i = 0; i < qty; i++) tot += Math.round(q.bid * Math.max(0.4, 1 - imp * i));
    return tot;
  }
  buyGood(v: Npc, g: GoodId, qty: number) {
    if (!this.canAct(v) || v.def.role !== 'vendor' || !v.open) { this.toast('The stall is unattended.', 'bad'); return; }
    qty = Math.min(qty, this.cap - this.cargoCount);
    if (qty <= 0) { this.toast('Your satchel is full.', 'bad'); return; }
    while (qty > 0 && this.buyTotal(v, g, qty) > this.run.coins) qty--;
    if (qty <= 0) { this.toast('Not enough coin.', 'bad'); return; }
    const tot = this.buyTotal(v, g, qty);
    this.spend(tot);
    const c = this.run.cargo[g]; c.cost = (c.cost * c.qty + tot) / (c.qty + qty); c.qty += qty;
    v.pressure[g] = clamp((v.pressure[g] || 0) + this.impact() * qty, -0.5, 0.7);
    this.run.stats.trades++; this.flags.bought = true;
    if (g === 'smoke') this.addHeat(0.6 * qty);
    this.float(this.player.x, this.player.y - 28, `-${tot}c`, '#ff9a8a'); audio.play('buy'); this.changed();
  }
  sellGood(v: Npc, g: GoodId, qty: number) {
    if (!this.canAct(v) || v.def.role !== 'vendor' || !v.open) { this.toast('The stall is unattended.', 'bad'); return; }
    const c = this.run.cargo[g]; qty = Math.min(qty, c.qty);
    if (qty <= 0) { this.toast(`You carry no ${GOODS[g].name}.`, 'bad'); return; }
    const tot = this.sellTotal(v, g, qty);
    const profit = tot - Math.round(c.cost * qty);
    this.gain(tot); c.qty -= qty; if (c.qty <= 0) { c.qty = 0; c.cost = 0; }
    v.pressure[g] = clamp((v.pressure[g] || 0) - this.impact() * qty, -0.5, 0.7);
    this.run.stats.trades++; this.run.stats.tradeProfit += profit; this.nightLog.tradeProfit += profit; this.flags.sold = true;
    if (g === 'smoke') { const warden = this.npcs.some(n => n.def.role === 'warden' && Math.hypot(n.x - this.player.x, n.y - this.player.y) < 260); this.addHeat((warden ? 1.8 : 0.4) * qty); }
    this.commissions.forEach(cm => { if (cm.type === 'profit' && !cm.done && cm.good === g && profit > 0) { cm.progress += profit; this.checkComm(cm); } });
    this.float(this.player.x, this.player.y - 28, `+${tot}c`, profit >= 0 ? '#ffe08a' : '#ffb59a', 16);
    if (profit > 0) { this.float(this.player.x, this.player.y - 46, `profit ${profit}`, '#9affc0', 12); this.burst(this.player.x, this.player.y - 10, '#ffd86b', 8 + Math.min(14, profit / 8), 'coin'); }
    audio.play(profit > 0 ? 'sell' : 'coin'); this.changed();
  }

  // ---------- progression ----------
  buyPerk(id: string) {
    const p = PERKS.find(x => x.id === id); if (!p || this.hasPerk(id)) return;
    if (!p.req.every(r => this.hasPerk(r))) { this.toast('Unlock the connected perks first.', 'bad'); return; }
    if (this.points(p.faction) < p.cost) { this.toast('Not enough Favor points with this faction.', 'bad'); return; }
    this.run.perks.push(id); audio.play('perk'); this.toast(`Unlocked ${p.name}!`, 'good'); this.saveRun(); this.changed();
  }
  kitCost(id: string) { const k = KIT.find(x => x.id === id)!; const l = this.kit(id); return l >= k.max ? Infinity : k.cost[l]; }
  buyKit(id: string) {
    const k = KIT.find(x => x.id === id); if (!k) return;
    const cost = this.kitCost(id);
    if (!isFinite(cost)) return;
    if (this.run.coins < cost) { this.toast('Not enough coin.', 'bad'); return; }
    this.spend(cost); this.run.kit[id] = this.kit(id) + 1; audio.play('perk'); this.saveRun(); this.changed();
  }
  payOffCost() { return 100 + this.run.night * 20; }
  payOffWatch() {
    const c = this.payOffCost();
    if (this.run.strikes <= 0 || this.run.coins < c) { audio.play('deny'); return; }
    this.spend(c); this.run.strikes--; audio.play('coin'); this.saveRun(); this.changed();
  }
  legacyCost(id: string) { const l = LEGACY.find(x => x.id === id)!; const lv = this.leg(id); return lv >= l.max ? Infinity : l.cost[lv]; }
  buyLegacy(id: string) {
    const c = this.legacyCost(id);
    if (!isFinite(c) || this.meta.marks < c) { audio.play('deny'); return; }
    this.meta.marks -= c; this.meta.up[id] = this.leg(id) + 1; this.saveMeta(); audio.play('perk'); this.changed();
  }
  setDiff(id: string) { this.run.diff = id; this.saveRun(); this.changed(); }
  toggleMod(id: string) { this.run.mods = this.hasMod(id) ? this.run.mods.filter(m => m !== id) : [...this.run.mods, id]; this.saveRun(); this.changed(); }

  private checkComm(c: Commission) {
    if (c.done || c.progress < c.target) return;
    c.done = true; this.gain(c.coins); this.addFavor(c.faction, c.favor); this.run.stats.commissions++;
    this.toast(`Commission complete: ${c.title}  +${c.coins}c, ${FACTIONS[c.faction].icon} +${c.favor}`, 'good');
    this.float(this.player.x, this.player.y - 40, `+${c.coins}c`, '#9affc0', 18); this.burst(this.player.x, this.player.y, '#9affc0', 16, 'coin');
    audio.play('success');
  }

  // ---------- update loop ----------
  update(dtRaw: number) {
    const real = Math.min(dtRaw, 0.1);
    for (const t of this.toasts) t.life -= real;
    this.toasts = this.toasts.filter(t => t.life > 0);
    if (this.banner) { this.banner.life -= real; if (this.banner.life <= 0) this.banner = null; }
    if (this.phase !== 'night' || this.paused) { return; }
    const dt = Math.min(real, 0.05);
    const d = dt * (this.talk ? 0.35 : 1);
    this.t += d; this.frac = Math.min(1, this.t / this.T);
    this.updatePlayer(dt);
    this.updateEvents();
    this.updateNpcs(d);
    this.accSpread += d; while (this.accSpread >= 0.4) { this.accSpread -= 0.4; this.spreadStep(); }
    this.accMarket += d; while (this.accMarket >= 0.25) { this.accMarket -= 0.25; this.marketTick(0.25); }
    this.updateListen(dt);
    this.updateMagpie(d);
    this.updateNear();
    this.updateTutorial();
    this.updateFx(dt);
    const p = this.player;
    const regen = 2.6 * (1 + 0.25 * this.kit('charm'));
    p.poise = Math.min(this.maxPoise, p.poise + regen * d);
    const decay = 1.0 * (this.hasPerk('w_nod') ? 2 : 1) * (1 + Math.max(0, this.run.favor.wardens) / 100);
    p.heat = Math.max(0, p.heat - decay * d);
    p.dashCd = Math.max(0, p.dashCd - dt); p.stun = Math.max(0, p.stun - dt);
    this.accMood += dt;
    if (this.accMood > 0.5) { this.accMood = 0; audio.setMood({ heat: p.heat, crowd: Math.min(1, this.npcs.filter(n => Math.hypot(n.x - p.x, n.y - p.y) < 200).length / 8), boss: this.bossNight, night: true }); this.changed(); }
    if (this.phase === 'night' && this.t >= this.T) this.endNight();
  }

  private updatePlayer(dt: number) {
    const p = this.player;
    let mx = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0) + this.pad.x;
    let my = (this.keys.down ? 1 : 0) - (this.keys.up ? 1 : 0) + this.pad.y;
    if (this.talk || p.stun > 0) { mx = 0; my = 0; }
    else if (Math.hypot(mx, my) > 0.12) p.target = null;
    else if (p.target) {
      if (p.target.npcId) { const n = this.npcs.find(q => q.id === p.target!.npcId); if (n && n.visible) { p.target.x = n.x; p.target.y = n.y; } else p.target = null; }
      if (p.target) {
        const dx = p.target.x - p.x, dy = p.target.y - p.y, dd = Math.hypot(dx, dy);
        if (p.target.npcId && dd < 70) { const n = this.npcs.find(q => q.id === p.target!.npcId); p.target = null; if (n) { n.def.role === 'cutpurse' ? this.tryCatch() : this.openTalk(n); } }
        else if (dd < 6) p.target = null;
        else { mx = dx / dd; my = dy / dd; }
      }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    if (len > 0.1) { p.dx = mx / Math.max(len, 1); p.dy = my / Math.max(len, 1); if (Math.abs(mx) > 0.1) p.face = mx > 0 ? 1 : -1; }
    const dashing = p.dashT > 0;
    if (dashing) { p.dashT -= dt; if (len < 0.1) { mx = p.dx; my = p.dy; } }
    const sp = 150 * this.speedMult * (dashing ? 3.6 : 1);
    const ox = p.x, oy = p.y;
    p.x += mx * sp * dt; p.y += my * sp * dt;
    p.x = clamp(p.x, 24, W - 24); p.y = clamp(p.y, 24, H - 24);
    for (const r of OBSTACLES) {
      const pad = 12;
      const x0 = r.x - pad, x1 = r.x + r.w + pad, y0 = r.y - pad, y1 = r.y + r.h + pad;
      if (p.x > x0 && p.x < x1 && p.y > y0 && p.y < y1) {
        const pl = p.x - x0, pr = x1 - p.x, pt = p.y - y0, pb = y1 - p.y;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) p.x = x0; else if (m === pr) p.x = x1; else if (m === pt) p.y = y0; else p.y = y1;
      }
    }
    const mv = Math.hypot(p.x - ox, p.y - oy);
    p.moved += mv;
    if (p.target && len > 0.1 && !dashing) {
      if (mv < sp * dt * 0.25) { this.stuckT += dt; if (this.stuckT > 0.45) { p.target = null; this.stuckT = 0; } } else this.stuckT = 0;
    } else this.stuckT = 0;
    if (dashing) {
      if (Math.random() < 0.8) this.burst(p.x, p.y + 6, '#9d8cff', 1, 'dust', 20);
      for (const n of this.npcs) if (n.def.role === 'cutpurse' && n.state === 'flee' && Math.hypot(n.x - p.x, n.y - p.y) < 40) { this.catchThief(n); break; }
    } else if (mv > 0.5 && Math.random() < 0.08) this.burst(p.x, p.y + 8, '#6b5b8a', 1, 'dust', 15);
  }

  private updateNear() {
    let best: Npc | null = null, bd = 80;
    for (const n of this.npcs) {
      if (!n.visible) continue;
      if (n.def.role === 'cutpurse' && n.state !== 'flee') continue;
      const d = Math.hypot(n.x - this.player.x, n.y - this.player.y);
      if (d < bd) { bd = d; best = n; }
    }
    this.near = best;
    if (this.talk && (!this.talk.visible || Math.hypot(this.talk.x - this.player.x, this.talk.y - this.player.y) > 150)) { this.toast(`${this.talk.def.name} walked off.`, 'info'); this.talk = null; this.listen = null; }
    for (const v of this.vendors) {
      if (!v.visible) continue;
      const near = Math.hypot(v.x - this.player.x, v.y - this.player.y) < 190;
      if (near || (this.hasPerk('g_board') && v.open)) for (const g of GOOD_IDS) { const q = this.quote(v, g); this.seen[v.id + ':' + g] = { ask: q.ask, bid: q.bid, t: this.t }; }
    }
  }

  private updateEvents() {
    for (const e of this.events) {
      if (!e.started && this.t >= e.startT * this.T) {
        e.started = true;
        this.banner = { title: e.def.name, sub: e.def.desc, icon: e.def.icon, life: 4.5 };
        this.toast(`${e.def.icon} ${e.def.name}: ${e.def.desc}`, 'event'); audio.play('event'); this.addShake(3);
      }
      if (e.started && !e.ended && this.t >= e.endT * this.T) { e.ended = true; this.toast(`${e.def.icon} ${e.def.name} has passed.`, 'info'); }
    }
  }

  private targetLoc(n: Npc): string {
    if (n.def.role === 'patron') {
      if (this.evActive('storm')) return 'tavern';
      if (this.evActive('festival') && n.hash % 2 === 0) return 'fountain';
    }
    let loc = n.sched[0].loc;
    for (const s of n.sched) if (s.t <= this.frac) loc = s.loc;
    return loc;
  }
  private buildPath(n: Npc, locId: string) {
    const loc = LOC[locId];
    const a = nearestNode(n.x, n.y), b = loc.node;
    const pts = nodePath(a, b).map(i => ({ x: NODES[i].x + n.ox, y: NODES[i].y + n.oy }));
    const jit = n.def.role === 'vendor' ? 0 : loc.kind === 'stall' ? 14 : 24;
    pts.push({ x: loc.x + n.sx * jit, y: loc.y + n.sy * jit });
    return pts;
  }
  private moveToward(n: Npc, tx: number, ty: number, sp: number, dt: number): number {
    const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
    if (d < 1e-3) return 0;
    const step = Math.min(d, sp * dt);
    n.x += (dx / d) * step; n.y += (dy / d) * step;
    if (Math.abs(dx) > 0.2) n.face = dx >= 0 ? 1 : -1;
    n.walk += step * 0.09; n.moving = true;
    return d - step;
  }
  private updateNpcs(d: number) {
    const p = this.player;
    for (const n of this.npcs) {
      n.moving = false; n.cool -= d; if (n.bubbleT > 0) { n.bubbleT -= d; if (n.bubbleT <= 0) n.bubble = ''; }
      if (n.state === 'gone') {
        n.visible = false;
        if (this.t >= n.goneUntil) { const dk = LOC.docks; n.x = dk.x + n.sx * 30; n.y = dk.y; n.state = 'idle'; n.visible = true; n.cool = 8; n.path = []; n.dest = ''; }
        continue;
      }
      n.visible = true;
      if (this.talk === n) continue;
      const role = n.def.role;
      const dp = Math.hypot(n.x - p.x, n.y - p.y);
      if (role === 'cutpurse') {
        if (n.state === 'flee') {
          n.fleeT += d;
          const ex = 1270, ey = 690;
          this.moveToward(n, ex, ey, 175, d);
          if (n.fleeT > 11 || Math.hypot(n.x - ex, n.y - ey) < 20) { n.state = 'gone'; n.goneUntil = this.t + 28; n.loot = 0; n.visible = false; this.toast(`${n.def.name} slipped away with your coin.`, 'info'); }
          continue;
        }
        if (n.state === 'stalk') {
          if (dp > 230 || this.hasPerk('d_crew') || p.stun > 0) { n.state = 'idle'; n.cool = 6; n.dest = ''; continue; }
          this.moveToward(n, p.x, p.y, 98, d);
          if (dp < 24) {
            n.stealT += d;
            if (n.stealT > 0.35 && p.dashT <= 0) this.steal(n);
          } else n.stealT = Math.max(0, n.stealT - d);
          continue;
        }
        if (dp < 170 && n.cool <= 0 && !this.hasPerk('d_crew') && p.stun <= 0 && this.run.coins >= 5) { n.state = 'stalk'; n.bubble = '…'; n.bubbleT = 1.5; n.stealT = 0; continue; }
      }
      if (role === 'warden') {
        if (dp < 125 && this.cargoSmoke() > 0 && !(this.hasPerk('w_badge') && p.heat < 60)) this.addHeat(5 * d * (this.hasPerk('d_alley') ? 0.5 : 1));
        if (this.evActive('crackdown') && !n.chase) { n.chaseCd -= d; if (n.chaseCd <= 0 && this.inspectCd <= 0) { n.chase = true; n.chaseT = 0; this.inspectCd = 14; n.bubble = '!'; n.bubbleT = 1.5; } }
        this.inspectCd -= d / Math.max(1, this.npcs.filter(q => q.def.role === 'warden').length);
        if (n.chase) {
          n.chaseT += d;
          this.moveToward(n, p.x, p.y, 118, d);
          if (dp < 42) { this.inspect(n); n.chase = false; n.chaseCd = 24 + rr(0, 10); }
          else if (n.chaseT > 12) { n.chase = false; n.chaseCd = 20; }
          continue;
        }
      }
      const tl = this.targetLoc(n);
      if (tl !== n.dest) { n.dest = tl; n.path = this.buildPath(n, tl); }
      if (n.path.length) { const pt = n.path[0]; const rem = this.moveToward(n, pt.x, pt.y, n.speed * (this.evActive('storm') ? 1.35 : 1), d); if (rem < 2) n.path.shift(); }
      n.open = role !== 'vendor' || (n.dest === n.def.home && n.path.length === 0);
    }
  }
  private cargoSmoke() { return this.run.cargo.smoke.qty; }
  private steal(n: Npc) {
    const amt = Math.min(Math.floor(this.run.coins * 0.12), 20 + this.run.night * 8);
    if (amt <= 0) { n.state = 'idle'; n.cool = 8; return; }
    this.spend(amt); this.run.stats.robbed++; n.loot = amt; n.state = 'flee'; n.fleeT = 0;
    this.float(this.player.x, this.player.y - 30, `-${amt}c stolen!`, '#ff7a7a', 16); this.addShake(5); audio.play('steal');
    this.toast(`${n.def.name} picked your pocket for ${amt}c! Chase and press E, or dash into them!`, 'bad');
  }
  private inspect(w: Npc) {
    const p = this.player;
    if (this.hasPerk('w_badge') && p.heat < 60) { this.toast(`${w.def.name} waves you through.`, 'good'); return; }
    audio.play('alarm'); this.addShake(4);
    const smoke = this.run.cargo.smoke.qty;
    if (smoke > 0 && !(this.hasPerk('d_bottom') && Math.random() < 0.5)) {
      const fine = Math.round(Math.min(this.run.coins, this.run.coins * 0.12 * this.fineMult + 8));
      this.spend(fine); this.run.cargo.smoke = { qty: 0, cost: 0 }; this.run.stats.busted++;
      this.addHeat(15); this.toast(`Inspection! ${w.def.name} seized your Dream-Smoke and fined you ${fine}c.`, 'bad');
    } else { this.credDelta(1); this.toast(`${w.def.name} inspects your satchel and finds nothing. (+1 cred)`, 'good'); }
  }
  private arrest() {
    const p = this.player;
    this.run.strikes++; this.run.stats.arrests++;
    const fine = Math.round(Math.min(this.run.coins, (this.run.coins * 0.25 + 20) * this.fineMult));
    this.spend(fine);
    if (this.run.cargo.smoke.qty > 0 && !(this.hasPerk('d_bottom') && Math.random() < 0.5)) this.run.cargo.smoke = { qty: 0, cost: 0 };
    p.heat = 35; const wp = LOC.wardpost; p.x = wp.x; p.y = wp.y + 40; p.stun = 2.4; p.target = null;
    this.talk = null; this.listen = null; this.addShake(10); audio.play('bust');
    this.banner = { title: 'Arrested!', sub: `Strike ${this.run.strikes}/3. Fined ${fine}c.`, icon: '⛓️', life: 3.5 };
    this.toast(`The Wardens drag you in. Fined ${fine}c. Strike ${this.run.strikes}/3.`, 'bad');
    if (this.run.strikes >= 3) this.gameOver('prison', 'Locked Away', 'Three arrests were three too many. The Wardens bury your name in the cells beneath the Post.');
  }

  // ---------- gossip & market ----------
  private spreadStep() {
    const mult = (this.evActive('festival') ? 1.7 : 1) * (this.hasMod('loose') ? 2 : 1);
    const list = this.npcs.filter(n => n.visible);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (dx * dx + dy * dy > 78 * 78) continue;
      this.gossip(a, b, mult); this.gossip(b, a, mult);
    }
  }
  private gossip(s: Npc, l: Npc, mult: number) {
    const sr = s.def.role, lr = l.def.role;
    if (sr === 'warden' || sr === 'cutpurse' || lr === 'warden' || lr === 'cutpurse') return;
    if (Math.random() > 0.2 * s.def.gossip * mult) return;
    const cands: number[] = [];
    for (const k of Object.keys(s.beliefs)) {
      const id = +k; const r = this.rumors.get(id);
      if (r && r.state === 'pending' && s.beliefs[id] >= 0.35 && (l.beliefs[id] || 0) < 0.25) cands.push(id);
    }
    if (!cands.length) return;
    const id = pick(cands);
    l.beliefs[id] = Math.min(0.95, s.beliefs[id] * (0.55 + 0.4 * l.def.trust));
    this.thread(s, l, this.rumors.get(id)?.kind === 'scandal' ? '#e56ad8' : (this.rumors.get(id)?.dir || 1) > 0 ? '#ffb347' : '#6ec6ff');
    l.bubble = '✦'; l.bubbleT = 1.2;
    if (Math.hypot(l.x - this.player.x, l.y - this.player.y) < 300) audio.play('whisper');
  }

  private marketTick(dtm: number) {
    const vol = this.hasMod('volatile') ? 1.8 : 1;
    const sum = zeroGoods(); let n = 0; let magFrac = 0;
    const pend: Rumor[] = [];
    this.rumors.forEach(r => { if (r.state === 'pending') pend.push(r); });
    for (const npc of this.npcs) {
      if (npc.def.role === 'warden' || npc.def.role === 'cutpurse') continue;
      n++;
      for (const r of pend) {
        const b = npc.beliefs[r.id]; if (!b) continue;
        if (r.kind === 'market') sum[r.good!] += r.dir * r.mag * b;
      }
    }
    const nn = Math.max(1, n);
    const E = { spice: 1, silk: 1, oil: 1, relic: 1, tonic: 1, smoke: 1 } as Record<GoodId, number>;
    for (const e of this.events) {
      if (!e.started) continue;
      const s = e.startT * this.T, en = e.endT * this.T;
      const ramp = !e.ended ? Math.min(1, (this.t - s) / 8) : Math.max(0, 1 - (this.t - en) / 12);
      if (ramp <= 0) continue;
      GOOD_IDS.forEach(g => { E[g] *= 1 + (e.def.fx[g] || 0) * ramp; });
    }
    for (const g of GOOD_IDS) {
      this.Nz[g] += -0.15 * this.Nz[g] * dtm + (Math.random() - 0.5) * 0.026 * vol;
      this.Nz[g] = clamp(this.Nz[g], -0.3, 0.3);
      const F = 1 + ((this.infl[GOODS[g].faction] - 50) / 50) * 0.2;
      const target = clamp(E[g] * (1 + (sum[g] / nn) * 1.2) * Math.exp(this.Nz[g]) * F, 0.4, 2.8);
      this.G[g] += (target - this.G[g]) * Math.min(1, dtm * 1.6);
    }
    // scandals sway faction influence; magpie rumors feed her grip
    let swing: Record<string, number> = { guild: 0, court: 0, syndicate: 0, wardens: 0 };
    for (const r of pend) {
      let cnt = 0; for (const npc of this.npcs) if ((npc.beliefs[r.id] || 0) >= 0.4) cnt++;
      const frac = cnt / nn;
      if (r.kind === 'scandal') swing[r.faction!] -= frac * 3;
      if (r.origin === 'magpie') magFrac += frac * r.mag;
    }
    FACTION_IDS.forEach(f => { this.infl[f] = clamp(this.infl[f] + ((50 - this.infl[f]) * 0.04 + swing[f]) * dtm, 15, 85); });
    swing = {};
    if (this.bossNight) {
      this.grip = clamp(this.grip + (magFrac * 4 - 1.3) * dtm, 0, 100);
      if (this.grip >= 100) this.gameOver('cornered', 'Cornered', 'The Magpie\'s lies have swallowed the market whole. Every stall now dances to her tune, and you are left without a buyer.');
    }
    this.rumors.forEach(r => { if (r.state === 'pending' && this.t >= r.resolveAt) this.resolve(r); });
    for (const v of this.vendors) for (const g of GOOD_IDS) v.pressure[g] = (v.pressure[g] || 0) * Math.exp(-dtm / 25);
    this.commissions.forEach(c => {
      if (c.done) return;
      if (c.type === 'pump' && c.good) { const v = c.dir! > 0 ? (this.G[c.good] - 1) * 100 : (1 - this.G[c.good]) * 100; if (v > c.progress) c.progress = v; this.checkComm(c); }
      if (c.type === 'spread') {
        let best = 0;
        this.rumors.forEach(r => { if (r.state === 'pending' && (r.origin === 'player' || this.planted.some(pl => pl.rid === r.id))) best = Math.max(best, this.believers(r)); });
        if (best > c.progress) c.progress = best; this.checkComm(c);
      }
    });
    this.accHist += dtm;
    if (this.accHist >= 3) { this.accHist = 0; GOOD_IDS.forEach(g => { const h = this.hist[g]; h.push(this.G[g]); if (h.length > 80) h.shift(); }); }
    const w = this.worth; if (w > this.run.stats.peakWorth) this.run.stats.peakWorth = w;
  }

  private resolve(r: Rumor) {
    if (r.state !== 'pending') return;
    r.state = r.truth ? 'true' : 'false';
    const le = this.ledger.find(l => l.rid === r.id);
    const soldTo = this.sold.filter(s => s.rid === r.id);
    const pl = this.planted.filter(p => p.rid === r.id);
    let note = '';
    if (!r.truth) {
      this.npcs.forEach(n => { delete n.beliefs[r.id]; });
      if (le && soldTo.length) {
        const pen = Math.min(9, 3 * soldTo.length); this.credDelta(-pen);
        soldTo.forEach(s => this.addFavor(s.faction, -3));
        note = `Buyers were burned: -${pen} credibility.`;
      }
      if (this.debunked.has(r.id)) { this.credDelta(2); note += ' Your debunk was right (+2).'; }
      if (le && pl.length && r.origin !== 'magpie' && !r.traced) {
        const p = (0.3 + this.player.heat * 0.003) * (this.hasPerk('c_masks') ? 0.3 : 1) * (r.origin === 'player' ? 1 : 0.5);
        if (Math.random() < p) {
          r.traced = true; this.credDelta(-5); this.addHeat(8); this.run.stats.traced++;
          const npc = this.npcs.find(n => n.id === pl[0].npcId);
          if (npc) this.addFavor(npc.def.faction, -4);
          note += ' Traced back to YOU: -5 cred, +heat.'; this.toast('A lie was traced back to you!', 'bad');
        }
      }
    } else {
      if (le) { this.credDelta(2 + (this.hasPerk('w_name') ? 1 : 0)); this.run.stats.proven++; note = 'Proven true: +credibility.'; }
      soldTo.forEach(s => this.addFavor(s.faction, 2));
      if (this.debunked.has(r.id)) { this.credDelta(-3); note += ' You wrongly debunked it (-3).'; }
      if (r.kind === 'scandal' && r.faction) { this.infl[r.faction] = clamp(this.infl[r.faction] - 14, 15, 85); this.toast(`Scandal breaks: ${FACTIONS[r.faction].name}!`, 'event'); }
      if (this.bossNight && pl.length) this.grip = Math.max(0, this.grip - 4);
    }
    if (le || r.origin === 'player') {
      this.resolvedLog.push({ text: r.text, state: r.truth ? 'true' : 'false', mine: !!le, note: note.trim() });
      if (le) this.toast(`${r.truth ? '✅ Proven' : '❌ Debunked'}: "${r.text}"`, r.truth ? 'good' : 'info');
    }
  }

  private updateListen(dt: number) {
    const l = this.listen; if (!l) return;
    const range = 130 * (1 + 0.25 * this.kit('trumpet'));
    if (!l.npc.visible || Math.hypot(l.npc.x - this.player.x, l.npc.y - this.player.y) > range) { this.listen = null; this.toast('You lost the thread of the conversation.', 'info'); return; }
    l.p += dt;
    if (l.p >= l.dur) { const n = l.npc; this.listen = null; this.finishListen(n); }
  }

  private updateMagpie(d: number) {
    if (!this.magpieOn || !this.magpie || !this.magpie.visible) { if (this.magpieOn) this.magT -= d * 0.5; return; }
    this.magT -= d;
    if (this.magT > 0) return;
    const boss = this.bossNight;
    this.magT = (boss ? 10.5 : 26 * this.diff.magpie) * rr(0.8, 1.25);
    const m = this.magpie;
    const near = this.npcs.filter(n => n !== m && !['warden', 'cutpurse', 'rival'].includes(n.def.role) && n.visible)
      .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y));
    if (!near.length) return;
    let g = pick(GOOD_IDS); let dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1; let tries = 0;
    while (tries++ < 12 && this.events.some(e => (e.def.fx[g] || 0) * dir > 0.12)) { g = pick(GOOD_IDS); dir = Math.random() < 0.5 ? 1 : -1; }
    const mag = boss ? rr(0.35, 0.5) : rr(0.25, 0.4);
    const r = this.addRumor({ kind: 'market', good: g, dir, mag, truth: false, text: marketText(g, dir, Math.floor(Math.random() * 4)), born: this.t, resolveAt: this.t + 70, origin: 'magpie' });
    near.slice(0, 3).forEach((n, i) => { this.giveBelief(n, r, 0.9 - i * 0.05); this.thread(m, n, '#f0f0ff'); });
    m.bubble = '🐦'; m.bubbleT = 2;
    if (Math.hypot(m.x - this.player.x, m.y - this.player.y) < 260) this.toast(`You glimpse the Magpie whispering to ${near[0].def.name}...`, 'info');
  }

  private updateTutorial() {
    if (!this.tut.on) return;
    const s = this.tut.step;
    const ok = [this.player.moved > 140, this.flags.talked, this.ledger.length > 0, this.flags.planted, this.flags.bought, this.flags.sold][s];
    if (ok) {
      this.tut.step++; audio.play('toast');
      if (this.tut.step >= TUTORIAL.length) { this.tut.on = false; this.meta.tutDone = true; this.saveMeta(); this.toast('Tutorial complete. The night market is yours.', 'good'); }
      this.changed();
    }
  }
  skipTutorial() { this.tut.on = false; this.meta.tutDone = true; this.saveMeta(); this.changed(); }

  private updateFx(dt: number) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.life -= dt; if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985;
    }
    const fs = this.floaters;
    for (let i = fs.length - 1; i >= 0; i--) { const f = fs[i]; f.life -= dt; f.y -= 26 * dt; if (f.life <= 0) fs.splice(i, 1); }
    const th = this.threads;
    for (let i = th.length - 1; i >= 0; i--) { th[i].life -= dt; if (th[i].life <= 0) th.splice(i, 1); }
    this.shake = Math.max(0, this.shake - dt * 22);
  }
  tickFx(dt: number) { this.updateFx(Math.min(dt, 0.05)); }

  // ---------- night end ----------
  private endNight() {
    this.talk = null; this.listen = null;
    this.rumors.forEach(r => this.resolve(r));
    const quota = this.quota;
    let liquidated = 0;
    if (this.run.coins < quota) {
      let val = 0; GOOD_IDS.forEach(g => { val += this.run.cargo[g].qty * GOODS[g].base * this.G[g] * 0.6; });
      if (this.run.coins + val >= quota) {
        liquidated = Math.round(val); this.gain(liquidated);
        GOOD_IDS.forEach(g => { this.run.cargo[g] = { qty: 0, cost: 0 }; });
      }
    }
    const ok = this.run.coins >= quota;
    if (this.hasPerk('w_name')) this.credDelta(4);
    const st = this.run.stats;
    const rep: Report = {
      night: this.run.night, quota, coinsStart: this.snap.coins, coinsEnd: this.run.coins - (ok ? quota : 0), liquidated,
      tradeProfit: st.tradeProfit - this.snap.tradeProfit, rumorIncome: this.nightLog.rumorIncome, resolved: this.resolvedLog.slice(),
      credDelta: this.run.cred - this.snap.cred, commissions: st.commissions - this.snap.comm, ok, boss: this.bossNight,
      arrests: st.arrests - this.snap.arrests, robbed: st.robbed - this.snap.robbed,
    };
    this.report = rep;
    audio.setMood({ night: false, heat: 0, boss: false });
    if (!ok) { this.gameOver('debt', 'The Debt Collectors Call', `You owed ${quota}c to Madame Vesper at dawn and could not pay. Her collectors close the shutters on your stall for good.`); return; }
    this.spend(quota);
    st.nightsSurvived = this.run.night;
    if (this.run.night > this.meta.best.nights) this.meta.best.nights = this.run.night;
    if (this.worth > this.meta.best.worth) this.meta.best.worth = this.worth;
    if (this.bossNight) { this.winGame(); return; }
    this.phase = 'dawn'; audio.play('dawn'); this.saveMeta(); this.saveRun();
    this.changed();
  }
  nextNight() {
    this.run.night++;
    this.report = null;
    this.enterDusk();
  }
  private computeMarks(win: boolean) {
    const d = this.diff;
    const modBonus = this.run.mods.reduce((s, id) => s + (MODIFIERS.find(m => m.id === id)?.marks || 0), 0);
    return Math.max(1, Math.round((this.run.stats.nightsSurvived * 2 + (win ? 20 : 0) + Math.floor(this.run.stats.earned / 400)) * d.marks * (1 + modBonus) / 1.5));
  }
  private gameOver(reason: string, title: string, text: string) {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.over = { reason, title, text };
    this.marksGained = this.computeMarks(false);
    this.meta.marks += this.marksGained;
    this.saveMeta(); lsDel(RUN_KEY);
    this.talk = null; this.listen = null; this.paused = false;
    audio.play('fail'); audio.setMood({ night: false, heat: 0, boss: false }); this.changed();
  }
  private winGame() {
    this.phase = 'victory';
    this.marksGained = this.computeMarks(true);
    this.meta.marks += this.marksGained; this.meta.best.wins++;
    this.saveMeta(); lsDel(RUN_KEY);
    audio.play('success'); audio.setMood({ night: false, heat: 0, boss: false }); this.changed();
  }
  continueEndless() {
    this.run.endless = true; this.run.night++; this.report = null; this.over = null;
    this.enterDusk();
  }
  forfeit() { if (this.phase === 'night' || this.phase === 'dusk' || this.phase === 'dawn') this.gameOver('forfeit', 'Retired', 'You hang up your mask and leave the bazaar to its whispers.'); }

  setPaused(p: boolean) { if (this.phase !== 'night') return; this.paused = p; if (p) { this.keys = { up: false, down: false, left: false, right: false }; } this.changed(); }
  lastHintT() { return this.lastHint; }

  // ---------- schedule display ----------
  schedText(n: Npc): { t: string; loc: string }[] | null {
    if (!n.schedKnown) return null;
    if (n.def.role === 'cutpurse') return null;
    const out: { t: string; loc: string }[] = [];
    for (const s of n.sched) if (s.t > this.frac && out.length < 3) out.push({ t: clockText(s.t), loc: LOC[s.loc].short });
    return out;
  }
  locName(n: Npc) { return LOC[n.dest]?.short || '...'; }
}
