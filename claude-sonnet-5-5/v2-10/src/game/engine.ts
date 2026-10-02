import {
  W, H, LAND_H, MAX_DAY, BT, DEFS, KAIJU, RESEARCH, PERKS, DIFFS, MODS, SCHEDULE, EVENTS, DISTRICTS, districtOf,
  mulberry, gauss, clamp, dist, segDist,
} from './data';
import type {
  BType, Cause, KKind, DType, Phase, TileKind, Vec, Difficulty, SchedEntry,
} from './data';
import { audio } from './audio';
import { loadMeta, saveMeta, loadSettings, saveSettings } from './save';
import type { Meta, Settings } from './save';
import { drawGame } from './render';

export interface Building {
  id: number; type: BType; x: number; y: number; hp: number; maxHp: number; value: number; pop: number; maxPop: number;
  district: number; evac: number; riders: { fire: boolean; flood: boolean; quake: boolean };
  dmg: Record<Cause, number>; hpLost: number; repair: boolean; seed: number; history: number;
}
export interface Defense {
  id: number; type: DType; x: number; y: number; hp: number; maxHp: number; cd: number; angle: number; temp: boolean; ttl: number; flash: number;
}
export interface Cast { type: string; t: number; dur: number; x: number; y: number; dx: number; dy: number; len: number; rad: number }
export interface Kaiju {
  id: number; kind: KKind; hp: number; maxHp: number; x: number; y: number; route: Vec[]; ri: number; face: number; dx: number; dy: number;
  stun: number; slow: number; delay: number; active: boolean; dead: boolean; gone: boolean; cast: Cast | null; cd: number; castN: number;
  under: boolean; phaseT: number; stepD: number; flash: number; walk: number; phase: number; deathT: number;
}
export interface Planned { kind: KKind; delay: number; route: Vec[]; hpMul: number; ghosts: Vec[][] }
export interface Claim {
  id: number; bx: number; by: number; bType: BType; district: number; cause: Cause; trueDmg: number; claimed: number; assessed: number;
  covered: boolean; kind: 'legit' | 'inflated' | 'phantom'; history: number; inPath: boolean; photo: 'rubble' | 'damaged' | 'intact';
  riders: { fire: boolean; flood: boolean; quake: boolean }; investigated: boolean; optimal: 'approve' | 'settle' | 'deny';
  decision?: 'approve' | 'settle' | 'deny'; result?: string; paid?: number;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; kind: 'dust' | 'fire' | 'spark' | 'water' | 'debris' }
export interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
export interface Tracer { x1: number; y1: number; x2: number; y2: number; life: number; max: number; color: string; w: number; zig: boolean }
export interface Ring { x: number; y: number; r0: number; r1: number; life: number; max: number; color: string }
export interface Report {
  day: number; premiums: number; maintenance: number; evacCost: number; payouts: number; bounty: number; spent: number;
  casualties: number; destroyed: number; kills: number; fraudCaught: number; saved: number; repaired: number; rebuilt: number;
  blight: number; trustDelta: number; cashDelta: number; event: string; eventText: string; claimsRight: number; claimsTotal: number; collateral: number;
}

export type AbilityId = 'flare' | 'strike' | 'siren';
export const ABIL: Record<AbilityId, { name: string; cost: number; cd: number; key: string; icon: string; desc: string }> = {
  flare: { name: 'Signal Flare', cost: 50, cd: 8, key: '1', icon: '🎇', desc: 'Drop a decoy anywhere. Lures kaiju for 14s.' },
  strike: { name: 'Air Strike', cost: 90, cd: 14, key: '2', icon: '✈️', desc: 'Bomb a target after 1.2s: 150 dmg to kaiju, collateral to buildings.' },
  siren: { name: 'Siren Blast', cost: 30, cd: 10, key: '3', icon: '🚨', desc: 'Click a district: emergency evacuation of 70% compliance.' },
};

const newInc = () => ({ casualties: 0, destroyed: 0, kills: 0, saved: 0, collateral: 0, dmgDealt: 0, defLost: 0 });
const newStats = () => ({
  kills: 0, casualties: 0, destroyed: 0, paid: 0, savedMoney: 0, caught: 0, wasted: 0, bestStreak: 0, collateral: 0,
  decided: 0, right: 0, lives: 0, incidents: 0, premiums: 0,
});
const newReport = (day: number): Report => ({
  day, premiums: 0, maintenance: 0, evacCost: 0, payouts: 0, bounty: 0, spent: 0, casualties: 0, destroyed: 0, kills: 0, fraudCaught: 0,
  saved: 0, repaired: 0, rebuilt: 0, blight: 0, trustDelta: 0, cashDelta: 0, event: '', eventText: '', claimsRight: 0, claimsTotal: 0, collateral: 0,
});
const WOB: Record<KKind, number> = { stomper: 0.6, pyro: 0.9, tide: 0.8, sky: 2.0, burrow: 1.3, boss: 0.5 };
const CAUSES: Cause[] = ['stomp', 'fire', 'flood', 'quake', 'collateral'];
const zeroDmg = (): Record<Cause, number> => ({ stomp: 0, fire: 0, flood: 0, quake: 0, collateral: 0 });

export class Game {
  meta: Meta = loadMeta();
  settings: Settings = loadSettings();
  canvas: HTMLCanvasElement | null = null;
  c2d: CanvasRenderingContext2D | null = null;
  cw = 0; ch = 0; dpr = 1;
  lay = { ts: 40, ox: 0, oy: 0 };
  raf = 0; last = 0; time = 0; notifyAcc = 0; demoT = 0;
  onChange: (() => void) | null = null;
  paused = false; speed = 1;
  status: 'title' | 'playing' | 'won' | 'lost' = 'title';
  endReason = ''; finalScore = 0; cpGain = 0; cpPrev = 0; finalized = false;
  diff: Difficulty = DIFFS[1]; mods: string[] = [];
  day = 1; phase: Phase = 'briefing'; cash = 0; trust = 60; rp = 0; researched = new Set<string>(); endless = false;
  // city
  kind: TileKind[] = []; bAt: (Building | null)[] = []; dAt: (Defense | null)[] = [];
  buildings: Building[] = []; defs: Defense[] = [];
  fireT = new Float32Array(W * H); floodT = new Float32Array(W * H); touched = new Uint8Array(W * H);
  nextId = 1; initialPop = 1;
  // plan
  plan: Planned[] = []; heat = new Float32Array(W * H); incSeed = 1; probes = 0;
  evacOrders: boolean[] = [false, false, false, false, false, false]; evacUsed: boolean[] = [false, false, false, false, false, false]; fatigue = 0;
  selDef: DType | null = null; sellMode = false; inspect: Defense | null = null; hover: Vec | null = null;
  // attack
  kaiju: Kaiju[] = []; atkT = 0; endT = 0; armed: AbilityId | null = null;
  abil: Record<AbilityId, number> = { flare: 0, strike: 0, siren: 0 };
  strikes: { x: number; y: number; t: number }[] = [];
  log: { text: string; color: string }[] = [];
  inc = newInc();
  // claims
  claims: Claim[] = []; ci = 0; tokens = 0; streak = 0; lastResult = ''; autoCount = 0; autoPaid = 0;
  // fx
  parts: Particle[] = []; floaters: Floater[] = []; tracers: Tracer[] = []; rings: Ring[] = [];
  shakeAmp = 0; flash = 0; flashColor = '#ffffff';
  cond = { heatwave: false, storm: false, fog: false, fraud: false }; condTitle = 'Quiet Skies'; condText = 'No special conditions.';
  stats = newStats(); score = 0; rep: Report = newReport(1); dayStart = { cash: 0, trust: 0 };
  dayDecided = 0; dayCorrect = 0;
  demoK: Kaiju;

  constructor() {
    this.buildCity(Math.floor(Math.random() * 1e9));
    this.demoK = this.makeKaiju('stomper', [{ x: -3, y: 5 }, { x: W + 3, y: 5 }], 0, 1);
    this.demoK.active = true;
    audio.setVolumes(this.settings.master, this.settings.music, this.settings.sfx, this.settings.muted);
  }

  // ---------------------------------------------------------------- lifecycle
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.c2d = canvas.getContext('2d');
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('contextmenu', this.onCtx);
    this.resize();
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }
  detach() {
    cancelAnimationFrame(this.raf);
    const c = this.canvas;
    if (c) {
      c.removeEventListener('pointermove', this.onMove);
      c.removeEventListener('pointerdown', this.onDown);
      c.removeEventListener('pointerleave', this.onLeave);
      c.removeEventListener('contextmenu', this.onCtx);
    }
    this.canvas = null;
    this.c2d = null;
  }
  resize() {
    const c = this.canvas;
    if (!c) return;
    const w = Math.max(10, c.clientWidth);
    const h = Math.max(10, c.clientHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.floor(w * this.dpr);
    c.height = Math.floor(h * this.dpr);
    this.cw = w;
    this.ch = h;
  }
  notify() {
    if (this.onChange) this.onChange();
  }
  say(text: string, color = '#e2e8f0') {
    this.log.unshift({ text, color });
    if (this.log.length > 7) this.log.pop();
  }

  frame = (now: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(dt);
    if (this.c2d) drawGame(this, this.c2d, this.cw, this.ch, this.dpr);
    this.notifyAcc += dt;
    if (this.notifyAcc > 0.12) {
      this.notifyAcc = 0;
      if (this.phase === 'attack' && this.status === 'playing' && !this.paused) this.notify();
    }
  };

  update(dt: number) {
    const fdt = this.paused ? 0 : dt;
    this.time += dt;
    this.updateFx(fdt);
    if (this.status === 'title') this.demoUpdate(dt);
    if (this.status === 'playing' && this.phase === 'attack' && !this.paused) {
      const sdt = dt * this.speed;
      const n = Math.max(1, Math.ceil(sdt / 0.034));
      for (let i = 0; i < n; i++) this.stepAttack(sdt / n);
    }
  }

  // ---------------------------------------------------------------- input
  private toWorld(e: PointerEvent): Vec {
    const c = this.canvas!;
    const r = c.getBoundingClientRect();
    const px = (e.clientX - r.left) * (this.cw / Math.max(1, r.width));
    const py = (e.clientY - r.top) * (this.ch / Math.max(1, r.height));
    return { x: (px - this.lay.ox) / this.lay.ts, y: (py - this.lay.oy) / this.lay.ts };
  }
  onMove = (e: PointerEvent) => {
    const p = this.toWorld(e);
    this.hover = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H ? p : null;
  };
  onLeave = () => {
    this.hover = null;
  };
  onCtx = (e: Event) => {
    e.preventDefault();
    this.cancelTool();
  };
  onDown = (e: PointerEvent) => {
    if (this.status !== 'playing' || this.paused) return;
    audio.init();
    const p = this.toWorld(e);
    this.hover = p.x >= 0 && p.y >= 0 && p.x < W && p.y < H ? p : null;
    if (e.button === 2) return;
    if (p.x < 0 || p.y < 0 || p.x >= W || p.y >= H) return;
    const tx = Math.floor(p.x), ty = Math.floor(p.y);
    if (this.phase === 'briefing') this.tileAction(tx, ty);
    else if (this.phase === 'attack' && this.armed) this.useAbility(p.x, p.y);
  };
  cancelTool() {
    this.selDef = null;
    this.sellMode = false;
    this.armed = null;
    this.inspect = null;
    this.notify();
  }

  // ---------------------------------------------------------------- perks / research helpers
  has(id: string) {
    return this.researched.has(id);
  }
  perk(id: string) {
    return this.meta.perks[id] || 0;
  }
  defCost(t: DType) {
    return Math.round(DEFS[t].cost * (1 - 0.08 * this.perk('ordnance')));
  }
  defUnlocked(t: DType) {
    const r = DEFS[t].req;
    return !r || this.has(r);
  }
  accuracy() {
    let a = 0.28 + 0.11 * ['seis1', 'seis2', 'seis3'].filter((i) => this.has(i)).length + 0.09 * this.probes + 0.04 * this.perk('fellow') + this.diff.acc;
    if (this.cond.fog) a -= 0.12;
    if (this.mods.includes('fog')) a -= 0.12;
    if (this.day === 1) a += 0.25;
    return clamp(a, 0.08, 0.96);
  }
  compliance() {
    return clamp(0.4 + 0.5 * (this.trust / 100) - this.fatigue + (this.has('pr') ? 0.1 : 0), 0.15, 0.97);
  }
  districtPop(d: number) {
    let p = 0;
    for (const b of this.buildings) if (b.district === d && b.hp > 0) p += b.pop;
    return p;
  }
  evacCost(d: number) {
    return Math.round(this.districtPop(d) * 0.35 + 10);
  }
  totalPop() {
    let p = 0;
    for (const b of this.buildings) p += b.maxPop;
    return p;
  }
  livePop() {
    let p = 0;
    for (const b of this.buildings) if (b.hp > 0) p += b.pop;
    return p;
  }
  cityValue() {
    let v = 0;
    for (const b of this.buildings) if (b.hp > 0) v += b.value;
    return v;
  }
  premiumIncome() {
    let v = 0;
    for (const b of this.buildings) if (b.hp > 0) v += b.value * (b.hp / b.maxHp > 0.5 ? 1 : 0.6);
    const share = 0.45 + 0.55 * (this.trust / 100);
    return v * 0.09 * share * this.diff.income * (this.has('actuary') ? 1.18 : 1);
  }
  maintenance() {
    let m = 0;
    for (const d of this.defs) if (!d.temp) m += DEFS[d.type].cost * 0.04;
    return m;
  }
  investCost() {
    return this.has('forensic') ? 5 : 10;
  }
  modMul() {
    return this.mods.reduce((m, id) => m * (MODS.find((x) => x.id === id)?.mul ?? 1), 1);
  }

  // ---------------------------------------------------------------- city generation
  buildCity(seed: number) {
    const r = mulberry(seed);
    this.kind = []; this.bAt = []; this.dAt = []; this.buildings = []; this.defs = [];
    this.fireT.fill(0); this.floodT.fill(0); this.touched.fill(0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let k: TileKind = 'lot';
        if (y === H - 1) k = 'water';
        else if (x % 4 === 3 || y === 4 || y === 9) k = 'road';
        else if (r() < 0.1) k = 'park';
        this.kind.push(k);
        this.bAt.push(null);
        this.dAt.push(null);
        if (k === 'lot') {
          const d = districtOf(x, y);
          const w = DISTRICTS[d].weights;
          let roll = r();
          let type: BType = 'house';
          let tot = 0;
          for (const key of Object.keys(w) as BType[]) tot += w[key] ?? 0;
          roll *= tot;
          for (const key of Object.keys(w) as BType[]) {
            roll -= w[key] ?? 0;
            if (roll <= 0) { type = key; break; }
          }
          const info = BT[type];
          const b: Building = {
            id: this.nextId++, type, x, y, hp: info.hp, maxHp: info.hp, value: info.value, pop: info.pop, maxPop: info.pop, district: d, evac: 0,
            riders: { fire: r() < 0.6, flood: r() < 0.55, quake: r() < 0.5 }, dmg: zeroDmg(), hpLost: 0, repair: false,
            seed: Math.floor(r() * 1e6), history: Math.floor(r() * 3),
          };
          this.bAt[y * W + x] = b;
          this.buildings.push(b);
        }
      }
    }
    // special buildings
    const pickIn = (ds: number[], t: BType) => {
      const c = this.buildings.filter((b) => ds.includes(b.district) && b.type !== 'landmark' && b.type !== 'hospital');
      if (!c.length) return;
      const b = c[Math.floor(r() * c.length)];
      this.setType(b, t);
    };
    pickIn([1], 'landmark'); pickIn([0, 5], 'landmark'); pickIn([4], 'hospital'); pickIn([3, 5], 'hospital');
    if (!this.buildings.some((b) => b.type === 'hospital')) pickIn([0, 1, 2, 3, 4, 5], 'hospital');
    this.initialPop = Math.max(1, this.totalPop());
  }
  private setType(b: Building, t: BType) {
    const info = BT[t];
    b.type = t; b.hp = b.maxHp = info.hp; b.value = info.value; b.pop = b.maxPop = info.pop;
  }

  // ---------------------------------------------------------------- run control
  newRun(diffId: string, mods: string[]) {
    audio.init();
    this.diff = DIFFS.find((d) => d.id === diffId) ?? DIFFS[1];
    this.mods = [...mods];
    this.buildCity(Math.floor(Math.random() * 1e9));
    this.day = 1; this.phase = 'briefing'; this.endless = false;
    this.cash = this.diff.cash + 150 * this.perk('fund');
    this.trust = 60 + 4 * this.perk('charm');
    this.rp = 2 + 2 * this.perk('grant');
    this.researched = new Set();
    this.fatigue = 0; this.score = 0; this.stats = newStats(); this.finalized = false; this.cpPrev = 0; this.cpGain = 0;
    this.endReason = ''; this.finalScore = 0;
    this.parts = []; this.floaters = []; this.tracers = []; this.rings = []; this.kaiju = []; this.strikes = [];
    this.log = []; this.claims = []; this.ci = 0; this.streak = 0;
    this.cond = { heatwave: false, storm: false, fog: false, fraud: false }; this.condTitle = 'Quiet Skies'; this.condText = 'No special conditions.';
    this.speed = 1; this.paused = false;
    this.status = 'playing';
    this.resetDay();
    this.planIncident();
    audio.setMode('briefing');
    audio.sfx('report');
    this.say('Welcome to Claimsworth & Doom Mutual.', '#fbbf24');
    this.notify();
  }
  private resetDay() {
    this.evacOrders = [false, false, false, false, false, false];
    this.probes = 0; this.selDef = null; this.sellMode = false; this.inspect = null; this.armed = null;
    this.rep = newReport(this.day);
    this.dayStart = { cash: this.cash, trust: this.trust };
    this.dayDecided = 0; this.dayCorrect = 0;
    this.inc = newInc();
  }
  quitToTitle() {
    if (this.status === 'playing' && (this.day > 1 || this.phase !== 'briefing')) this.finalizeRun(false, 'Resigned from the firm.', true);
    this.status = 'title';
    this.paused = false;
    this.kaiju = []; this.strikes = [];
    this.parts = []; this.floaters = []; this.tracers = []; this.rings = [];
    this.buildCity(Math.floor(Math.random() * 1e9));
    audio.setMode('title');
    this.notify();
  }
  setPaused(p: boolean) {
    this.paused = p;
  }
  setSpeed(s: number) {
    this.speed = s;
    this.notify();
  }
  setSetting(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
    audio.setVolumes(this.settings.master, this.settings.music, this.settings.sfx, this.settings.muted);
    this.notify();
  }

  // ---------------------------------------------------------------- planning
  schedule(): SchedEntry[] {
    if (this.day <= MAX_DAY) return SCHEDULE[this.day - 1];
    const kinds: KKind[] = ['stomper', 'pyro', 'tide', 'sky', 'burrow'];
    const n = Math.min(4, 2 + Math.floor((this.day - MAX_DAY) / 3));
    const list: SchedEntry[] = Array.from({ length: n }, (_, i) => ({ kind: kinds[Math.floor(Math.random() * kinds.length)], delay: 1.5 + i * 13 }));
    if ((this.day - MAX_DAY) % 4 === 0) list.push({ kind: 'boss', delay: 20 });
    return list;
  }
  hpMul(kind: KKind) {
    if (kind === 'boss') return this.diff.hp * (1 + Math.max(0, this.day - MAX_DAY) * 0.1);
    return this.diff.hp * (1 + 0.06 * (this.day - 1)) * (this.day === 1 ? 0.75 : 1);
  }
  planIncident() {
    const sched = this.schedule();
    this.incSeed = Math.floor(Math.random() * 1e9);
    const r = mulberry(this.incSeed);
    this.plan = sched.map((s) => ({ kind: s.kind, delay: s.delay, route: this.genRoute(s.kind, r), hpMul: this.hpMul(s.kind), ghosts: [] }));
    this.probes = 0;
    this.computeForecast();
  }
  private scoreTile(kind: KKind, x: number, y: number) {
    let s = 0;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= LAND_H) continue;
        const b = this.bAt[yy * W + xx];
        if (!b || b.hp <= 0) continue;
        let w = b.value;
        if (kind === 'pyro') w = b.value * BT[b.type].flam * (b.type === 'factory' ? 2 : 1);
        else if (kind === 'tide') w = b.value * (yy >= 5 ? 1.7 : 0.5);
        else if (kind === 'burrow') w = b.value * (b.type === 'hospital' ? 3 : 1);
        else if (kind === 'stomper') w = b.pop * 8 + b.value * 0.3;
        s += w / (1 + Math.hypot(dx, dy));
      }
    }
    return s;
  }
  private pickTargets(kind: KKind, r: () => number, n: number): Vec[] {
    const cand: { x: number; y: number; s: number }[] = [];
    for (let y = 0; y < LAND_H; y++) for (let x = 0; x < W; x++) cand.push({ x, y, s: this.scoreTile(kind, x, y) * (0.8 + r() * 0.4) });
    cand.sort((a, b) => b.s - a.s);
    const out: Vec[] = [];
    for (const c of cand) {
      if (out.every((o) => dist(o.x, o.y, c.x + 0.5, c.y + 0.5) >= 4)) out.push({ x: c.x + 0.5, y: c.y + 0.5 });
      if (out.length >= n) break;
    }
    return out;
  }
  private extend(a: Vec, b: Vec): Vec {
    let dx = b.x - a.x, dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    let x = b.x, y = b.y;
    for (let i = 0; i < 60; i++) {
      x += dx; y += dy;
      if (x < -2 || x > W + 2 || y < -2 || y > H + 2) break;
    }
    return { x, y };
  }
  private pathThrough(pts: Vec[], r: () => number, wob: number): Vec[] {
    const out: Vec[] = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      const n = Math.max(1, Math.round(l / 2.2));
      const px = -dy / l, py = dx / l;
      for (let j = 1; j <= n; j++) {
        const t = j / n;
        const off = j < n ? (r() * 2 - 1) * wob : 0;
        out.push({ x: a.x + dx * t + px * off, y: a.y + dy * t + py * off });
      }
    }
    return out;
  }
  private genRoute(kind: KKind, r: () => number): Vec[] {
    const side = Math.floor(r() * 3);
    let spawn: Vec;
    if (kind === 'tide') spawn = { x: 2 + r() * (W - 4), y: H + 1.4 };
    else if (kind === 'boss') spawn = { x: W / 2 + (r() - 0.5) * 4, y: H + 2 };
    else if (side === 0) spawn = { x: 1 + r() * (W - 2), y: -1.8 };
    else if (side === 1) spawn = { x: -1.8, y: 1 + r() * 7 };
    else spawn = { x: W + 1.8, y: 1 + r() * 7 };
    let pts: Vec[];
    if (kind === 'boss') {
      pts = [spawn, { x: 9, y: 7 }, { x: 4.5 + r() * 2, y: 3.5 }, { x: 12 + r() * 2, y: 4 }, { x: 9, y: 1 }];
      pts.push(this.extend(pts[3], pts[4]));
    } else if (kind === 'sky') {
      const tg = this.pickTargets(kind, r, 4);
      const a = tg[Math.floor(r() * tg.length)] || { x: 9, y: 5 };
      let b = tg[Math.floor(r() * tg.length)] || a;
      if (b === a) b = tg[(tg.indexOf(a) + 1) % Math.max(1, tg.length)] || { x: 5, y: 4 };
      pts = [spawn, a, b, this.extend(a, b)];
    } else {
      const tg = this.pickTargets(kind, r, 4);
      const t = tg[Math.floor(r() * Math.min(3, tg.length))] || { x: 9, y: 5 };
      pts = [spawn, t, this.extend(spawn, t)];
    }
    return this.pathThrough(pts, r, WOB[kind]);
  }
  computeForecast() {
    const u = 1 - this.accuracy();
    this.heat.fill(0);
    const K = 24;
    this.plan.forEach((p, pi) => {
      const rb = mulberry(this.incSeed + pi * 7919);
      const ang = rb() * Math.PI * 2;
      const mag = u * 2.4 * (0.6 + rb() * 0.6);
      const bx = Math.cos(ang) * mag, by = Math.sin(ang) * mag;
      const rg = mulberry(this.incSeed * 3 + pi * 131 + this.probes * 17 + 1);
      p.ghosts = [];
      const rad = KAIJU[p.kind].radius * 0.9;
      for (let g = 0; g < K; g++) {
        let wx = 0, wy = 0;
        const poly = p.route.map((pt, i) => {
          wx = wx * 0.72 + gauss(rg) * u * 1.7;
          wy = wy * 0.72 + gauss(rg) * u * 1.7;
          const wt = Math.min(1, i / 2);
          return { x: pt.x + (bx + wx) * wt, y: pt.y + (by + wy) * wt };
        });
        if (g < 5) p.ghosts.push(poly);
        const seen = new Set<number>();
        for (let i = 1; i < poly.length; i++) {
          const a = poly[i - 1], b = poly[i];
          const l = Math.hypot(b.x - a.x, b.y - a.y);
          const n = Math.max(1, Math.ceil(l / 0.4));
          for (let j = 0; j <= n; j++) {
            const x = a.x + ((b.x - a.x) * j) / n, y = a.y + ((b.y - a.y) * j) / n;
            for (let ty = Math.floor(y - rad - 1); ty <= Math.ceil(y + rad + 1); ty++) {
              for (let tx = Math.floor(x - rad - 1); tx <= Math.ceil(x + rad + 1); tx++) {
                if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
                if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= rad + 0.4) seen.add(ty * W + tx);
              }
            }
          }
        }
        seen.forEach((i) => { this.heat[i] += 1 / K; });
      }
    });
    for (let i = 0; i < this.heat.length; i++) this.heat[i] = Math.min(1, this.heat[i]);
  }

  // ---------------------------------------------------------------- briefing actions
  selectDef(t: DType | null) {
    if (t && !this.defUnlocked(t)) { audio.sfx('error'); return; }
    this.selDef = this.selDef === t ? null : t;
    this.sellMode = false; this.inspect = null;
    audio.sfx('click');
    this.notify();
  }
  tileAction(tx: number, ty: number) {
    const i = ty * W + tx;
    const d = this.dAt[i];
    if (this.sellMode) {
      if (d) this.sellDef(d);
      return;
    }
    if (this.selDef) { this.placeDefense(tx, ty, this.selDef); return; }
    this.inspect = d && d !== this.inspect ? d : null;
    if (d) audio.sfx('click');
    this.notify();
  }
  placeDefense(tx: number, ty: number, t: DType) {
    if (this.phase !== 'briefing') return;
    const i = ty * W + tx;
    const k = this.kind[i];
    if ((k !== 'road' && k !== 'park') || this.dAt[i]) { audio.sfx('error'); this.floatT(tx + 0.5, ty + 0.5, 'Needs a free road/park tile', '#fda4af', 0.8); return; }
    const cost = this.defCost(t);
    if (this.cash < cost) { audio.sfx('error'); this.floatT(tx + 0.5, ty + 0.5, 'Insufficient funds', '#fda4af', 0.8); return; }
    this.cash -= cost;
    this.rep.spent += cost;
    const d: Defense = { id: this.nextId++, type: t, x: tx, y: ty, hp: DEFS[t].hp, maxHp: DEFS[t].hp, cd: 1, angle: -Math.PI / 2, temp: false, ttl: 0, flash: 0 };
    this.defs.push(d);
    this.dAt[i] = d;
    audio.sfx('place');
    this.burst(tx + 0.5, ty + 0.6, 10, '#cbd5e1', 1.5, 0.5, 0.07, 0, 'dust');
    this.floatT(tx + 0.5, ty + 0.3, '−$' + cost + 'K', '#fbbf24', 0.9);
    this.notify();
  }
  sellDef(d: Defense) {
    if (this.phase !== 'briefing') return;
    const refund = Math.round(this.defCost(d.type) * 0.5);
    this.cash += refund;
    this.removeDef(d);
    this.inspect = null;
    audio.sfx('sell');
    this.floatT(d.x + 0.5, d.y + 0.3, '+$' + refund + 'K', '#86efac', 0.9);
    this.notify();
  }
  removeDef(d: Defense) {
    this.defs = this.defs.filter((x) => x !== d);
    if (!d.temp && this.dAt[d.y * W + d.x] === d) this.dAt[d.y * W + d.x] = null;
  }
  toggleEvac(d: number) {
    if (this.phase !== 'briefing') return;
    this.evacOrders[d] = !this.evacOrders[d];
    audio.sfx('click');
    this.notify();
  }
  deployProbe() {
    if (this.phase !== 'briefing') return;
    if (this.probes >= 3 || this.cash < 40) { audio.sfx('error'); return; }
    this.cash -= 40;
    this.rep.spent += 40;
    this.probes++;
    this.computeForecast();
    audio.sfx('probe');
    this.notify();
  }
  evacTotalCost() {
    let c = 0;
    for (let d = 0; d < 6; d++) if (this.evacOrders[d]) c += this.evacCost(d);
    return c;
  }

  // ---------------------------------------------------------------- kaiju creation / launch
  makeKaiju(kind: KKind, route: Vec[], delay: number, hpMul: number): Kaiju {
    const kd = KAIJU[kind];
    const hp = Math.round(kd.hp * hpMul);
    const a = route[1] ?? route[0];
    const dx = a.x - route[0].x, dy = a.y - route[0].y;
    const l = Math.hypot(dx, dy) || 1;
    return {
      id: this.nextId++, kind, hp, maxHp: hp, x: route[0].x, y: route[0].y, route, ri: 1, face: 0, dx: dx / l, dy: dy / l,
      stun: 0, slow: 0, delay, active: false, dead: false, gone: false, cast: null, cd: 3 + Math.random() * 2, castN: 0,
      under: kind === 'burrow', phaseT: 3 + Math.random() * 2, stepD: 0, flash: 0, walk: 0, phase: 1, deathT: 0,
    };
  }
  launch() {
    if (this.phase !== 'briefing' || this.status !== 'playing') return;
    const cost = this.evacTotalCost();
    this.cash -= cost;
    this.rep.evacCost = cost;
    const comp = this.compliance();
    for (const b of this.buildings) b.evac = this.evacOrders[b.district] ? comp : 0;
    this.evacUsed = [...this.evacOrders];
    this.kaiju = this.plan.map((p) => this.makeKaiju(p.kind, p.route, p.delay, p.hpMul));
    this.inc = newInc();
    this.fireT.fill(0); this.floodT.fill(0); this.touched.fill(0);
    this.strikes = []; this.abil = { flare: 0, strike: 0, siren: 0 };
    this.armed = null; this.selDef = null; this.sellMode = false; this.inspect = null;
    this.atkT = 0; this.endT = 0; this.log = [];
    for (const d of this.defs) { d.cd = 1; d.flash = 0; }
    this.phase = 'attack';
    this.speed = 1;
    audio.sfx('launch');
    audio.setMode('attack');
    audio.setIntensity(0.25);
    this.say('Incident underway. Hold the line!', '#fbbf24');
    this.notify();
  }

  // ---------------------------------------------------------------- fx helpers
  burst(x: number, y: number, n: number, color: string, speed = 2, life = 0.8, size = 0.08, grav = 0, kind: Particle['kind'] = 'dust') {
    n = Math.round(n * this.settings.particles);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (grav > 0 ? 1 : 0), life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, grav, kind });
    }
    if (this.parts.length > 1600) this.parts.splice(0, this.parts.length - 1600);
  }
  floatT(x: number, y: number, text: string, color = '#fff', size = 1) {
    this.floaters.push({ x, y, text, color, life: 1.4, max: 1.4, size });
    if (this.floaters.length > 60) this.floaters.shift();
  }
  tracer(x1: number, y1: number, x2: number, y2: number, color: string, life = 0.15, w = 2, zig = false) {
    this.tracers.push({ x1, y1, x2, y2, life, max: life, color, w, zig });
  }
  ring(x: number, y: number, r0: number, r1: number, color: string, life = 0.6) {
    this.rings.push({ x, y, r0, r1, life, max: life, color });
  }
  shake(a: number) {
    this.shakeAmp = Math.min(1.4, this.shakeAmp + a);
  }
  private updateFx(dt: number) {
    for (const p of this.parts) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - Math.min(1, dt * 1.5);
      p.life -= dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y -= dt * 0.45; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    this.shakeAmp = Math.max(0, this.shakeAmp - dt * 2.4);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  }
  private demoUpdate(dt: number) {
    const k = this.demoK;
    this.demoT += dt;
    k.x += dt * 0.55;
    if (k.x > W + 3) k.x = -3;
    k.y = 5.2 + Math.sin(this.demoT * 0.3) * 0.6;
    k.dx = 1; k.dy = 0;
    k.walk += dt * 0.55;
    k.stepD += dt * 0.55;
    if (k.stepD > 0.85) {
      k.stepD = 0;
      this.burst(k.x, k.y + 0.6, 8, '#a8a29e', 1.4, 0.8, 0.09, 0, 'dust');
      this.shake(0.05);
    }
    if (Math.random() < dt * 1.2) this.burst(Math.random() * W, Math.random() * LAND_H, 4, '#fb923c', 0.8, 1.0, 0.07, -0.8, 'fire');
  }

  // ---------------------------------------------------------------- attack simulation
  private anyBuildingNear(x: number, y: number, r: number) {
    for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(LAND_H - 1, Math.ceil(y + r)); ty++) {
      for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(W - 1, Math.ceil(x + r)); tx++) {
        const b = this.bAt[ty * W + tx];
        if (b && b.hp > 0 && dist(tx + 0.5, ty + 0.5, x, y) <= r) return true;
      }
    }
    return false;
  }
  private forTiles(x: number, y: number, r: number, cb: (i: number, tx: number, ty: number, d: number) => void) {
    for (let ty = Math.max(0, Math.floor(y - r - 1)); ty <= Math.min(H - 1, Math.ceil(y + r + 1)); ty++) {
      for (let tx = Math.max(0, Math.floor(x - r - 1)); tx <= Math.min(W - 1, Math.ceil(x + r + 1)); tx++) {
        const d = dist(tx + 0.5, ty + 0.5, x, y);
        if (d <= r) cb(ty * W + tx, tx, ty, d);
      }
    }
  }
  private defNear(type: DType, tx: number, ty: number, r: number) {
    for (const d of this.defs) if (d.type === type && d.hp > 0 && !d.temp && dist(d.x + 0.5, d.y + 0.5, tx + 0.5, ty + 0.5) <= r) return true;
    return false;
  }

  private stepAttack(dt: number) {
    if (this.phase !== 'attack' || this.status !== 'playing') return;
    this.atkT += dt;
    if (this.atkT > 220) {
      // safety valve: nothing may keep an incident alive forever
      for (const k of this.kaiju) if (!k.dead) k.gone = true;
    }
    for (const k of this.kaiju) {
      if (!k.active && !k.dead && !k.gone && this.atkT >= k.delay) {
        k.active = true;
        audio.sfx('roar');
        this.shake(0.5);
        const kd = KAIJU[k.kind];
        this.say(`${kd.name} — ${kd.title} — emerges!`, '#fb7185');
        this.floatT(clamp(k.x, 1, W - 1), clamp(k.y, 1, H - 1), kd.name.toUpperCase() + '!', '#fb7185', 1.5);
      }
    }
    for (const k of this.kaiju) if (k.active && !k.dead && !k.gone) this.updateKaiju(k, dt);
    for (const k of this.kaiju) if (k.dead) k.deathT += dt;
    this.updateDefenses(dt);
    this.updateFire(dt);
    this.updateFlood(dt);
    for (const s of this.strikes) {
      s.t -= dt;
      if (s.t <= 0) this.resolveStrike(s);
    }
    this.strikes = this.strikes.filter((s) => s.t > 0);
    (Object.keys(this.abil) as AbilityId[]).forEach((a) => { this.abil[a] = Math.max(0, this.abil[a] - dt); });
    // intensity for music
    let alive = 0, fires = 0;
    for (const k of this.kaiju) if (k.active && !k.dead && !k.gone) alive += k.kind === 'boss' ? 2 : 1;
    for (let i = 0; i < this.fireT.length; i++) if (this.fireT[i] > 0) fires++;
    audio.setIntensity(0.2 + alive * 0.2 + Math.min(0.3, fires / 30));
    // end check
    const pending = this.kaiju.some((k) => !k.dead && !k.gone);
    if (!pending) {
      this.endT += dt;
      let fire = false;
      for (let i = 0; i < this.fireT.length; i++) if (this.fireT[i] > 0) { fire = true; break; }
      if (this.endT > 2.5 && (!fire || this.endT > 14)) this.finishAttack();
    }
  }

  private findLure(k: Kaiju): Defense | null {
    const mul = k.kind === 'boss' ? 0.55 : 1;
    let best: Defense | null = null;
    let bd = 1e9;
    for (const d of this.defs) {
      if (d.type !== 'beacon' || d.hp <= 0) continue;
      const dd = dist(d.x + 0.5, d.y + 0.5, k.x, k.y);
      if (dd <= DEFS.beacon.range * mul && dd < bd) { best = d; bd = dd; }
    }
    return best;
  }

  private updateKaiju(k: Kaiju, dt: number) {
    const kd = KAIJU[k.kind];
    k.flash = Math.max(0, k.flash - dt);
    if (k.slow > 0) k.slow -= dt;
    if (k.stun > 0) { k.stun -= dt; return; }
    if (k.cast) {
      k.cast.t += dt;
      if (k.cast.t >= k.cast.dur) {
        const c = k.cast;
        k.cast = null;
        this.resolveCast(k, c);
      }
      return;
    }
    if (k.kind === 'burrow') {
      k.phaseT -= dt;
      if (k.phaseT <= 0) {
        if (k.under) {
          k.under = false; k.phaseT = 4.2;
          this.burst(k.x, k.y, 14, '#a16207', 2.5, 0.9, 0.1, 2, 'debris');
          this.startCast(k, 'shock');
          return;
        }
        k.under = true; k.phaseT = 4.6;
        this.burst(k.x, k.y, 10, '#a16207', 2, 0.8, 0.1, 2, 'debris');
      }
    }
    const wp = k.route[k.ri];
    if (!wp) { k.gone = true; this.say(`${kd.name} leaves the city.`, '#94a3b8'); return; }
    let tx = wp.x, ty = wp.y;
    const lure = this.findLure(k);
    if (lure) { tx = lure.x + 0.5; ty = lure.y + 0.5; }
    const dx = tx - k.x, dy = ty - k.y;
    const d = Math.hypot(dx, dy);
    const phaseBoost = k.kind === 'boss' ? (k.phase === 2 ? 1.2 : k.phase === 3 ? 1.45 : 1) : 1;
    const sp = kd.speed * (k.slow > 0 ? 0.55 : 1) * (k.under ? 1.25 : 1) * phaseBoost;
    const step = sp * dt;
    if (d <= Math.max(step, 0.12)) {
      if (lure) this.devour(k, lure);
      else k.ri++;
    } else {
      k.x += (dx / d) * step; k.y += (dy / d) * step;
      k.dx = dx / d; k.dy = dy / d;
      k.walk += step; k.stepD += step;
    }
    if (k.stepD >= 0.85) {
      k.stepD = 0;
      if (!k.under && !kd.flying) this.footstep(k);
      else if (k.under) { this.burst(k.x, k.y, 3, '#a16207', 1, 0.6, 0.08, 1, 'debris'); this.shake(0.04); }
    }
    this.kaijuDamage(k, dt);
    if (!k.under && k.kind !== 'burrow') {
      k.cd -= dt;
      if (k.cd <= 0 && this.anyBuildingNear(k.x, k.y, 5)) {
        let t = 'slam';
        if (k.kind === 'pyro') t = 'breath';
        else if (k.kind === 'tide') t = 'surge';
        else if (k.kind === 'sky') t = 'dive';
        else if (k.kind === 'boss') t = ['breath', 'surge', 'shock', 'slam'][k.castN % 4];
        k.castN++;
        this.startCast(k, t);
      }
    }
  }

  private footstep(k: Kaiju) {
    const big = k.kind === 'boss' ? 2 : 1;
    this.shake(0.05 * big + 0.03);
    audio.sfx('stomp');
    this.burst(k.x, k.y + 0.5, 6 * big, '#a8a29e', 1.3, 0.7, 0.09, 0, 'dust');
  }

  private devour(k: Kaiju, lure: Defense) {
    this.removeDef(lure);
    k.stun = k.kind === 'boss' ? 1.2 : 2.6;
    this.ring(lure.x + 0.5, lure.y + 0.5, 0.2, 1.6, '#fbbf24', 0.6);
    this.floatT(lure.x + 0.5, lure.y, 'DECOY DEVOURED', '#fbbf24', 1);
    audio.sfx('crumble');
    this.say('A decoy bought us a few seconds.', '#fbbf24');
  }

  private kaijuDamage(k: Kaiju, dt: number) {
    const kd = KAIJU[k.kind];
    const under = k.under;
    const r = under ? 0.8 : kd.radius;
    let dps = under ? 8 : kd.dps;
    if (k.kind === 'boss') dps *= k.phase === 2 ? 1.15 : k.phase === 3 ? 1.3 : 1;
    const cause: Cause = under ? 'quake' : 'stomp';
    this.forTiles(k.x, k.y, r + 0.6, (i, tx, ty, d) => {
      if (tx < 0 || ty < 0) return;
      this.touched[i] = 1;
      const f = 1 - d / (r + 0.7);
      if (f <= 0) return;
      const b = this.bAt[i];
      if (b && b.hp > 0) this.applyDamage(b, dps * f * dt, cause);
      const df = this.dAt[i];
      if (df && df.hp > 0 && !under) {
        df.hp -= dps * f * dt;
        df.flash = 0.15;
        if (df.hp <= 0) this.destroyDef(df);
      }
    });
  }

  private destroyDef(d: Defense) {
    this.removeDef(d);
    this.inc.defLost++;
    this.burst(d.x + 0.5, d.y + 0.5, 12, '#94a3b8', 2, 0.7, 0.08, 2, 'debris');
    this.floatT(d.x + 0.5, d.y, DEFS[d.type].name + ' lost', '#fda4af', 0.8);
    audio.sfx('crumble');
  }

  applyDamage(b: Building, amt: number, cause: Cause) {
    if (b.hp <= 0 || amt <= 0) return;
    const a = Math.min(amt, b.hp);
    b.hp -= a;
    b.hpLost += a;
    b.dmg[cause] += a;
    if (b.hp <= 0.001) {
      b.hp = 0;
      this.onDestroyed(b);
    }
  }

  private onDestroyed(b: Building) {
    const shelter = this.has('shelters') ? 0.65 : 1;
    const expected = b.pop * (1 - b.evac) * 0.45 * shelter;
    let dead = Math.floor(expected);
    if (Math.random() < expected - dead) dead++;
    this.inc.saved += b.pop * b.evac * 0.45;
    b.maxPop = Math.max(0, b.maxPop - dead);
    b.pop = 0;
    this.inc.casualties += dead;
    this.inc.destroyed++;
    this.fireT[b.y * W + b.x] = 0;
    this.burst(b.x + 0.5, b.y + 0.5, 14, '#a8a29e', 2.2, 0.9, 0.1, 2.5, 'debris');
    this.burst(b.x + 0.5, b.y + 0.5, 6, '#57534e', 1, 1.3, 0.16, 0, 'dust');
    audio.sfx('crumble');
    this.shake(0.12);
    if (dead > 0) this.floatT(b.x + 0.5, b.y, '☠ ' + dead, '#fda4af', 1);
    if (b.type === 'landmark') {
      this.trust = clamp(this.trust - 6, 0, 100);
      this.say('A CITY LANDMARK HAS FALLEN! (−6 trust)', '#fb7185');
      this.flash = 0.6; this.flashColor = '#ef4444';
    }
  }

  private ignite(i: number, force = false) {
    const b = this.bAt[i];
    if (!b || b.hp <= 0 || this.fireT[i] > 0) return;
    const tx = i % W, ty = Math.floor(i / W);
    if (!force && this.defNear('firestation', tx, ty, 3.2) && Math.random() < 0.7) {
      this.burst(tx + 0.5, ty + 0.5, 5, '#e2e8f0', 1, 0.6, 0.08, 0, 'water');
      return;
    }
    this.fireT[i] = 9 * (this.cond.heatwave ? 1.2 : 1);
  }

  private updateFire(dt: number) {
    const heat = this.cond.heatwave ? 1.6 : 1;
    for (let i = 0; i < this.fireT.length; i++) {
      if (this.fireT[i] <= 0) continue;
      const b = this.bAt[i];
      const tx = i % W, ty = Math.floor(i / W);
      if (b && b.hp > 0) {
        this.applyDamage(b, 7 * dt, 'fire');
        if (b.hp > 0) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (!dx && !dy) continue;
              const nx = tx + dx, ny = ty + dy;
              if (nx < 0 || ny < 0 || nx >= W || ny >= LAND_H) continue;
              const ni = ny * W + nx;
              const nb = this.bAt[ni];
              if (!nb || nb.hp <= 0 || this.fireT[ni] > 0) continue;
              const p = BT[nb.type].flam * 0.09 * heat * dt * (dx && dy ? 0.6 : 1);
              if (Math.random() < p) this.ignite(ni);
            }
          }
        }
        this.fireT[i] -= dt;
      } else this.fireT[i] -= dt * 3;
      if (this.fireT[i] <= 0) this.fireT[i] = 0;
      if (Math.random() < dt * 14 * this.settings.particles) {
        this.parts.push({ x: tx + 0.2 + Math.random() * 0.6, y: ty + 0.5, vx: (Math.random() - 0.5) * 0.3, vy: -0.8 - Math.random() * 0.8, life: 0.8, max: 0.8, size: 0.09 + Math.random() * 0.07, color: Math.random() < 0.5 ? '#fb923c' : '#fde047', grav: -0.5, kind: 'fire' });
      }
    }
  }

  private updateFlood(dt: number) {
    for (let i = 0; i < this.floodT.length; i++) {
      if (this.floodT[i] <= 0) continue;
      const b = this.bAt[i];
      if (b && b.hp > 0) this.applyDamage(b, 4 * dt, 'flood');
      this.floodT[i] -= dt;
      if (this.floodT[i] < 0) this.floodT[i] = 0;
    }
  }

  private updateDefenses(dt: number) {
    for (const d of [...this.defs]) {
      if (d.hp <= 0) continue;
      d.flash = Math.max(0, d.flash - dt);
      if (d.temp) {
        d.ttl -= dt;
        if (d.ttl <= 0) this.removeDef(d);
        continue;
      }
      d.cd -= dt;
      const info = DEFS[d.type];
      const cx = d.x + 0.5, cy = d.y + 0.5;
      if (d.type === 'firestation') {
        if (d.cd <= 0) {
          d.cd = 1.2;
          let n = 0;
          this.forTiles(cx, cy, info.range, (i, tx, ty) => {
            if (n < 2 && this.fireT[i] > 0) {
              this.fireT[i] = 0; n++;
              this.burst(tx + 0.5, ty + 0.5, 8, '#bae6fd', 1.5, 0.7, 0.08, 1, 'water');
              this.tracer(cx, cy, tx + 0.5, ty + 0.5, '#7dd3fc', 0.25, 3);
            }
          });
        }
        continue;
      }
      if (d.type !== 'artillery' && d.type !== 'flak' && d.type !== 'tesla') continue;
      let best: Kaiju | null = null;
      let bd = 1e9;
      for (const k of this.kaiju) {
        if (!k.active || k.dead || k.gone || k.under) continue;
        const dd = dist(cx, cy, k.x, k.y);
        if (dd <= info.range + KAIJU[k.kind].radius * 0.5 && dd < bd) { best = k; bd = dd; }
      }
      if (best) {
        d.angle = Math.atan2(best.y - cy, best.x - cx);
        if (d.cd <= 0) this.fireDef(d, best);
      }
    }
  }

  private fireDef(d: Defense, k: Kaiju) {
    const rl = this.has('autoload') ? 0.8 : 1;
    const cx = d.x + 0.5, cy = d.y + 0.5;
    const flying = KAIJU[k.kind].flying;
    if (d.type === 'artillery') {
      d.cd = 2.2 * rl;
      audio.sfx('shell');
      const miss = flying && Math.random() > 0.35;
      const ix = k.x + (miss ? (Math.random() - 0.5) * 3 : (Math.random() - 0.5) * 0.4);
      const iy = k.y + (miss ? (Math.random() - 0.5) * 3 : (Math.random() - 0.5) * 0.4);
      this.tracer(cx, cy, ix, iy, '#ffd27a', 0.2, 3);
      this.burst(cx, cy - 0.2, 4, '#fde68a', 1.5, 0.3, 0.07, 0, 'spark');
      if (miss) this.floatT(k.x, k.y - 1, 'MISS', '#94a3b8', 0.8);
      else { this.hitKaiju(k, 28); this.burst(ix, iy, 6, '#fb923c', 2, 0.4, 0.08, 0, 'spark'); }
      // collateral damage from friendly fire
      const near: Building[] = [];
      this.forTiles(ix, iy, 1.4, (i) => { const b = this.bAt[i]; if (b && b.hp > 0) near.push(b); });
      if (near.length && Math.random() < 0.8) {
        const b = near[Math.floor(Math.random() * near.length)];
        this.applyDamage(b, 4 + Math.random() * 6, 'collateral');
        this.inc.collateral++;
      }
    } else if (d.type === 'flak') {
      d.cd = 0.4 * rl;
      audio.sfx('flak');
      this.tracer(cx, cy, k.x + (Math.random() - 0.5) * 0.5, k.y + (Math.random() - 0.5) * 0.5, '#fef08a', 0.1, 2);
      this.hitKaiju(k, flying ? 15 : 2.5);
    } else if (d.type === 'tesla') {
      d.cd = 0.7 * rl;
      audio.sfx('zap');
      this.tracer(cx, cy - 0.3, k.x, k.y, '#a5f3fc', 0.18, 3, true);
      this.hitKaiju(k, 20);
      if (Math.random() < 0.25) this.stunK(k, 0.5);
      for (const o of this.kaiju) {
        if (o !== k && o.active && !o.dead && !o.gone && !o.under && dist(o.x, o.y, k.x, k.y) < 2.5) {
          this.tracer(k.x, k.y, o.x, o.y, '#a5f3fc', 0.18, 2, true);
          this.hitKaiju(o, 10);
          break;
        }
      }
    }
  }

  private stunK(k: Kaiju, t: number) {
    k.stun = Math.max(k.stun, k.kind === 'boss' ? t * 0.2 : t);
  }

  hitKaiju(k: Kaiju, raw: number) {
    if (k.dead || k.under) return;
    const dmg = raw * (this.has('ordnance') ? 1.25 : 1);
    k.hp -= dmg;
    k.flash = 0.1;
    this.inc.dmgDealt += dmg;
    if (Math.random() < 0.3) this.floatT(k.x + (Math.random() - 0.5), k.y - 1.1 * KAIJU[k.kind].size, '-' + Math.round(dmg), '#fde68a', 0.7);
    if (k.kind === 'boss') this.bossPhase(k);
    if (k.hp <= 0) this.killKaiju(k);
  }

  private bossPhase(k: Kaiju) {
    const ratio = k.hp / k.maxHp;
    const np = ratio < 0.33 ? 3 : ratio < 0.66 ? 2 : 1;
    if (np > k.phase && k.hp > 0) {
      k.phase = np;
      k.cast = null; k.cd = 1.5; k.stun = 0;
      this.say(`OMEGA ENRAGES — PHASE ${np}!`, '#f43f5e');
      audio.sfx('phase');
      this.shake(1); this.flash = 0.7; this.flashColor = '#be123c';
      this.ring(k.x, k.y, 0.5, 5, '#f43f5e', 0.9);
      this.floatT(k.x, k.y - 2, 'PHASE ' + np, '#f43f5e', 1.8);
      if (np === 3) {
        for (let n = 0; n < 6; n++) {
          const b = this.buildings[Math.floor(Math.random() * this.buildings.length)];
          if (b) this.ignite(b.y * W + b.x, true);
        }
      }
    }
  }

  private killKaiju(k: Kaiju) {
    k.dead = true;
    k.cast = null;
    const boss = k.kind === 'boss';
    this.burst(k.x, k.y - 0.5, 40, '#fb923c', 4, 1.2, 0.14, 1, 'spark');
    this.burst(k.x, k.y, 24, '#78716c', 2.5, 1.5, 0.2, 0, 'dust');
    this.ring(k.x, k.y, 0.5, 4, '#fde047', 0.9);
    const bounty = boss ? 500 : 120;
    this.cash += bounty;
    this.rep.bounty += bounty;
    this.trust = clamp(this.trust + (boss ? 8 : 3), 0, 100);
    this.rp += boss ? 3 : 1;
    this.stats.kills++;
    this.inc.kills++;
    this.score += boss ? 1500 : 200;
    this.shake(1);
    this.flash = 0.5; this.flashColor = '#fde68a';
    audio.sfx('kill');
    this.floatT(k.x, k.y - 1.5, `+$${bounty}K BOUNTY`, '#86efac', 1.3);
    this.say(`${KAIJU[k.kind].name} DOWN! Bounty +$${bounty}K, +${boss ? 3 : 1} RP`, '#86efac');
  }

  // ---------------------------------------------------------------- casts
  private startCast(k: Kaiju, type: string) {
    const boss = k.kind === 'boss';
    let dur = 0.9, len = 0, rad = 0;
    switch (type) {
      case 'slam': rad = boss ? 2.8 : 2.1; break;
      case 'breath': len = boss ? 6.5 : 4.5; dur = 1.0; rad = boss ? 1.1 : 0.8; break;
      case 'surge': rad = boss ? 3.6 : 2.8; dur = 1.0; break;
      case 'dive': len = 4.6; dur = 0.7; rad = 0.85; break;
      case 'shock': rad = boss ? 3.8 : 3.2; break;
      default: break;
    }
    k.cast = { type, t: 0, dur, x: k.x, y: k.y, dx: k.dx, dy: k.dy, len, rad };
    audio.sfx('warn');
  }

  private damperFactor(tx: number, ty: number) {
    return this.defNear('damper', tx, ty, 3.0) ? 0.3 : 1;
  }

  private resolveCast(k: Kaiju, c: Cast) {
    const boss = k.kind === 'boss';
    const ph = boss ? 1 + (k.phase - 1) * 0.15 : 1;
    switch (c.type) {
      case 'slam':
        this.forTiles(c.x, c.y, c.rad, (i, _tx, _ty, d) => {
          const b = this.bAt[i];
          const f = 1 - d / (c.rad + 0.5);
          if (b && b.hp > 0) this.applyDamage(b, 70 * f * (boss ? 1.5 : 1) * ph, 'stomp');
          const df = this.dAt[i];
          if (df && df.hp > 0) { df.hp -= 40 * f; df.flash = 0.2; if (df.hp <= 0) this.destroyDef(df); }
        });
        this.ring(c.x, c.y, 0.3, c.rad, '#fca5a5', 0.5);
        this.burst(c.x, c.y, 20, '#a8a29e', 3, 0.9, 0.12, 0, 'dust');
        this.shake(0.5);
        audio.sfx('boom');
        k.cd = boss ? 3.4 - (k.phase - 1) * 0.6 : 6.5;
        break;
      case 'breath': {
        const ex = c.x + c.dx * c.len, ey = c.y + c.dy * c.len;
        for (let t = 0; t <= c.len; t += 0.5) {
          const px = c.x + c.dx * t, py = c.y + c.dy * t;
          this.burst(px, py, 3, Math.random() < 0.5 ? '#fb923c' : '#fde047', 1.2, 0.8, 0.12, -0.5, 'fire');
        }
        for (let ty = 0; ty < LAND_H; ty++) {
          for (let tx = 0; tx < W; tx++) {
            const i = ty * W + tx;
            if (segDist(tx + 0.5, ty + 0.5, c.x, c.y, ex, ey) > c.rad + 0.35) continue;
            const b = this.bAt[i];
            if (b && b.hp > 0) { this.applyDamage(b, 18 * ph, 'fire'); this.ignite(i); }
            const df = this.dAt[i];
            if (df && df.hp > 0) { df.hp -= 30; df.flash = 0.2; if (df.hp <= 0) this.destroyDef(df); }
          }
        }
        this.shake(0.25);
        audio.sfx('ignite');
        k.cd = boss ? 3.4 - (k.phase - 1) * 0.6 : 5.5;
        break;
      }
      case 'surge': {
        const long = this.cond.storm ? 1.5 : 1;
        this.forTiles(c.x, c.y, c.rad, (i, tx, ty) => {
          if (this.kind[i] === 'water') return;
          if (this.defNear('seawall', tx, ty, 3.0)) {
            this.burst(tx + 0.5, ty + 0.5, 4, '#e0f2fe', 1.5, 0.6, 0.08, 1, 'water');
            return;
          }
          this.floodT[i] = Math.max(this.floodT[i], 8 * long);
          this.burst(tx + 0.5, ty + 0.5, 3, '#7dd3fc', 1.5, 0.7, 0.08, 2, 'water');
        });
        this.ring(c.x, c.y, 0.3, c.rad, '#7dd3fc', 0.7);
        this.shake(0.3);
        audio.sfx('splash');
        k.cd = boss ? 3.4 - (k.phase - 1) * 0.6 : 6;
        break;
      }
      case 'dive': {
        const ex = c.x + c.dx * c.len, ey = c.y + c.dy * c.len;
        for (let ty = 0; ty < LAND_H; ty++) {
          for (let tx = 0; tx < W; tx++) {
            const i = ty * W + tx;
            if (segDist(tx + 0.5, ty + 0.5, c.x, c.y, ex, ey) > c.rad + 0.3) continue;
            const b = this.bAt[i];
            if (b && b.hp > 0) this.applyDamage(b, 80, 'stomp');
            const df = this.dAt[i];
            if (df && df.hp > 0) { df.hp -= 35; df.flash = 0.2; if (df.hp <= 0) this.destroyDef(df); }
          }
        }
        for (let t = 0; t <= c.len; t += 0.6) this.burst(c.x + c.dx * t, c.y + c.dy * t, 3, '#c4b5fd', 1.5, 0.5, 0.1, 0, 'spark');
        this.shake(0.3);
        audio.sfx('boom');
        k.cd = 5.5;
        break;
      }
      case 'shock':
        this.forTiles(c.x, c.y, c.rad, (i, tx, ty, d) => {
          const f = 1 - d / (c.rad + 0.4);
          const damp = this.damperFactor(tx, ty);
          const b = this.bAt[i];
          if (b && b.hp > 0) this.applyDamage(b, 80 * f * damp * (boss ? 1.3 : 1) * ph, 'quake');
          const df = this.dAt[i];
          if (df && df.hp > 0 && df.type !== 'damper') { df.hp -= 30 * f * damp; df.flash = 0.2; if (df.hp <= 0) this.destroyDef(df); }
        });
        this.ring(c.x, c.y, 0.3, c.rad, '#d6a35c', 0.8);
        this.ring(c.x, c.y, 0.2, c.rad * 0.7, '#fbbf24', 0.6);
        this.burst(c.x, c.y, 28, '#a16207', 3, 1, 0.12, 2, 'debris');
        this.shake(0.9);
        audio.sfx('quake');
        k.cd = boss ? 3.4 - (k.phase - 1) * 0.6 : 5;
        break;
      default:
        break;
    }
  }

  // ---------------------------------------------------------------- player abilities
  armAbility(a: AbilityId | null) {
    if (this.phase !== 'attack') return;
    if (a && this.abil[a] > 0) { audio.sfx('error'); return; }
    this.armed = this.armed === a ? null : a;
    audio.sfx('click');
    this.notify();
  }
  useAbility(x: number, y: number) {
    const a = this.armed;
    if (!a || this.phase !== 'attack') return;
    const info = ABIL[a];
    if (this.abil[a] > 0) { audio.sfx('error'); return; }
    if (this.cash < info.cost) { audio.sfx('error'); this.floatT(x, y, 'Insufficient funds', '#fda4af', 0.9); return; }
    const tx = clamp(Math.floor(x), 0, W - 1), ty = clamp(Math.floor(y), 0, H - 1);
    if (a === 'flare') {
      this.defs.push({ id: this.nextId++, type: 'beacon', x: tx, y: ty, hp: 30, maxHp: 30, cd: 0, angle: 0, temp: true, ttl: 14, flash: 0 });
      audio.sfx('flare');
      this.ring(tx + 0.5, ty + 0.5, 0.2, 2, '#fbbf24', 0.6);
    } else if (a === 'strike') {
      this.strikes.push({ x: x, y: y, t: 1.2 });
      audio.sfx('strike');
    } else {
      if (ty >= LAND_H) { audio.sfx('error'); return; }
      const d = districtOf(tx, ty);
      const comp = this.compliance() * 0.7;
      for (const b of this.buildings) if (b.district === d) b.evac = Math.max(b.evac, comp);
      this.evacUsed[d] = true;
      audio.sfx('siren');
      this.floatT(tx + 0.5, ty + 0.5, DISTRICTS[d].name + ' sirens', '#7dd3fc', 1);
      this.say(`Sirens sound in ${DISTRICTS[d].name}.`, '#7dd3fc');
    }
    this.cash -= info.cost;
    this.rep.spent += info.cost;
    this.abil[a] = info.cd;
    this.floatT(x, y - 0.4, '−$' + info.cost + 'K', '#fbbf24', 0.9);
    this.armed = null;
    this.notify();
  }
  private resolveStrike(s: { x: number; y: number; t: number }) {
    s.t = -1;
    for (const k of this.kaiju) {
      if (k.active && !k.dead && !k.gone && !k.under && dist(k.x, k.y, s.x, s.y) < 1.9) {
        this.hitKaiju(k, 150);
        this.stunK(k, 0.6);
      }
    }
    this.forTiles(s.x, s.y, 1.7, (i, _tx, _ty, d) => {
      const b = this.bAt[i];
      if (b && b.hp > 0) { this.applyDamage(b, 35 * (1 - d / 2.2), 'collateral'); this.inc.collateral++; }
    });
    this.ring(s.x, s.y, 0.3, 1.9, '#fb923c', 0.6);
    this.burst(s.x, s.y, 26, '#fb923c', 3.5, 0.8, 0.12, 0, 'spark');
    this.shake(0.7);
    audio.sfx('boom');
  }

  // ---------------------------------------------------------------- aftermath & claims
  private finishAttack() {
    const dHit = [0, 0, 0, 0, 0, 0];
    for (const b of this.buildings) dHit[b.district] += b.hpLost;
    let needed = 0, wasted = 0;
    for (let d = 0; d < 6; d++) {
      if (!this.evacUsed[d]) continue;
      if (dHit[d] >= 40) needed++;
      else wasted++;
    }
    const gain = this.has('pr') ? 2.5 : 2;
    this.trust += needed * gain - wasted * 1.5;
    this.fatigue = clamp(this.fatigue + wasted * 0.07, 0, 0.35);
    this.trust -= Math.min(28, this.inc.casualties * 0.45);
    this.trust = clamp(this.trust, 0, 100);
    this.stats.casualties += this.inc.casualties;
    this.stats.destroyed += this.inc.destroyed;
    this.stats.collateral += this.inc.collateral;
    this.stats.lives += Math.round(this.inc.saved);
    this.score += Math.round(this.inc.saved * 3);
    this.rep.casualties = this.inc.casualties;
    this.rep.destroyed = this.inc.destroyed;
    this.rep.kills = this.inc.kills;
    this.rep.saved = Math.round(this.inc.saved);
    this.rep.collateral = this.inc.collateral;
    this.rep.eventText = needed + wasted > 0 ? `${needed} evacuation(s) justified, ${wasted} unnecessary.` : '';
    this.defs = this.defs.filter((d) => !d.temp);
    this.armed = null;
    this.kaiju = [];
    this.genClaims();
    this.streak = 0;
    this.lastResult = '';
    if (this.claims.length === 0) {
      this.say('No claims were filed. A rare quiet morning.', '#94a3b8');
      this.endDay();
      return;
    }
    this.phase = 'claims';
    audio.setMode('claims');
    audio.sfx('report');
    this.notify();
  }

  private causeOf(b: Building): Cause {
    let best: Cause = 'stomp';
    let bv = -1;
    for (const c of CAUSES) if (b.dmg[c] > bv) { bv = b.dmg[c]; best = c; }
    return best;
  }
  private isCovered(cause: Cause, riders: Building['riders']) {
    return cause === 'stomp' || cause === 'collateral' || riders[cause as 'fire' | 'flood' | 'quake'];
  }

  private genClaims() {
    const fraudRate = clamp((0.12 + 0.012 * this.day) * this.diff.fraud * (this.mods.includes('fraud') ? 1.9 : 1) * (this.cond.fraud ? 1.6 : 1), 0.05, 0.6);
    const noise = this.has('forensic') ? 0.07 : 0.18;
    const dmged = this.buildings.filter((b) => b.hpLost >= 3).sort((a, b) => (b.value * b.hpLost) / b.maxHp - (a.value * a.hpLost) / a.maxHp);
    const manual = dmged.slice(0, 12);
    const rest = dmged.slice(12);
    const pm = this.has('reins') ? 0.88 : 1;
    let cid = 1;
    const claims: Claim[] = manual.map((b) => {
      const cause = this.causeOf(b);
      const trueDmg = Math.max(1, Math.round((b.value * b.hpLost) / b.maxHp));
      const covered = this.isCovered(cause, b.riders);
      const inflated = Math.random() < fraudRate;
      const claimed = inflated ? Math.round(trueDmg * (1.7 + Math.random() * 1.5)) : Math.max(1, Math.round(trueDmg * (0.92 + Math.random() * 0.28)));
      const assessed = Math.max(1, Math.round(trueDmg * (1 + (Math.random() * 2 - 1) * noise)));
      const kind = inflated ? 'inflated' : 'legit';
      const optimal: Claim['optimal'] = !covered ? 'deny' : inflated ? 'settle' : 'approve';
      return {
        id: cid++, bx: b.x, by: b.y, bType: b.type, district: b.district, cause, trueDmg, claimed, assessed, covered, kind, riders: b.riders,
        history: inflated ? 2 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 3), inPath: true,
        photo: b.hp <= 0 ? 'rubble' : 'damaged', investigated: false, optimal,
      } as Claim;
    });
    // phantom claims on intact buildings
    const nPh = Math.round(claims.length * fraudRate * 0.5);
    const intact = this.buildings.filter((b) => b.hp > 0 && b.hpLost < 3);
    const far = intact.filter((b) => !this.touched[b.y * W + b.x]);
    const pool = (far.length > nPh ? far : intact).slice();
    for (let n = 0; n < nPh && pool.length; n++) {
      const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      claims.push({
        id: cid++, bx: b.x, by: b.y, bType: b.type, district: b.district, cause: 'stomp', trueDmg: 0,
        claimed: Math.max(2, Math.round(b.value * (0.5 + Math.random() * 0.4))), assessed: 0, covered: true, kind: 'phantom', riders: b.riders,
        history: 2 + Math.floor(Math.random() * 4), inPath: !!this.touched[b.y * W + b.x], photo: 'intact', investigated: false, optimal: 'deny',
      });
    }
    for (let i = claims.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [claims[i], claims[j]] = [claims[j], claims[i]];
    }
    // auto-adjudicate the small remainder
    this.autoCount = rest.length;
    this.autoPaid = 0;
    for (const b of rest) {
      const cause = this.causeOf(b);
      if (this.isCovered(cause, b.riders)) {
        const pay = Math.round(((b.value * b.hpLost) / b.maxHp) * pm);
        this.cash -= pay;
        this.autoPaid += pay;
        this.rep.payouts += pay;
        this.stats.paid += pay;
        b.repair = true;
      }
    }
    this.claims = claims;
    this.rep.claimsTotal = claims.length;
    this.ci = 0;
    this.tokens = Math.max(0, 2 + (this.has('invest') ? 2 : 0) + this.perk('eye') - (this.mods.includes('skeleton') ? 1 : 0));
  }

  investigate() {
    const c = this.claims[this.ci];
    if (!c || c.investigated || this.phase !== 'claims') return;
    const cost = this.investCost();
    if (this.tokens <= 0 || this.cash < cost) { audio.sfx('error'); return; }
    this.cash -= cost;
    this.rep.spent += cost;
    this.tokens--;
    c.investigated = true;
    audio.sfx('investigate');
    this.floatT(c.bx + 0.5, c.by + 0.3, '🔍', '#fff', 1.2);
    this.notify();
  }

  decide(action: 'approve' | 'settle' | 'deny') {
    const c = this.claims[this.ci];
    if (!c || c.decision || this.phase !== 'claims') return;
    const pm = this.has('reins') ? 0.88 : 1;
    let pay = 0, dT = 0, msg = '';
    let caught = false, saved = 0, wasted = 0;
    if (action === 'approve') {
      pay = Math.round(c.claimed * pm);
      if (c.kind === 'legit' && c.covered) { dT = 0.6; msg = 'Paid in full. A satisfied customer.'; }
      else if (c.kind === 'legit') { dT = 1.2; msg = 'Ex-gratia goodwill payment (not covered).'; wasted = pay; }
      else if (c.kind === 'inflated') { dT = 0.1; msg = 'You paid an INFLATED claim!'; wasted = c.covered ? Math.max(0, pay - Math.round(c.trueDmg * pm)) : pay; }
      else { msg = 'You paid a PHANTOM claim on an intact building!'; wasted = pay; }
    } else if (action === 'settle') {
      pay = Math.round(c.assessed * pm);
      if (c.kind === 'legit' && c.covered) { dT = -0.5; msg = 'Settled at assessed value. Customer grumbles.'; }
      else if (c.kind === 'legit') { dT = 0.5; msg = 'Partial goodwill payment (not covered).'; wasted = pay; }
      else if (c.kind === 'inflated' && c.covered) { dT = 0.2; msg = 'Inflation trimmed. Fraud blunted!'; caught = true; saved = c.claimed - pay; }
      else if (c.kind === 'inflated') { dT = 0.2; msg = 'Fraud trimmed, but the cause was not covered.'; caught = true; wasted = pay; }
      else { dT = -0.2; msg = 'Phantom claim — nothing to settle.'; caught = true; saved = c.claimed; pay = 0; }
    } else {
      if (c.kind === 'legit' && c.covered) {
        dT = -3; msg = 'Wrongly denied a valid claim!';
        if (Math.random() < 0.35) { pay = Math.round(c.claimed * 1.4); msg += ' Bad-faith lawsuit: pay 140%!'; }
      } else if (c.kind === 'legit') { dT = -0.8; msg = 'Denied: not covered by policy.'; saved = c.claimed; }
      else if (c.kind === 'inflated') { dT = c.covered ? -1.2 : -0.5; msg = 'Denied an inflated claim; honest damage unpaid.'; caught = true; saved = c.claimed; }
      else { dT = 0.4; msg = 'Phantom claim denied. Fraud caught!'; caught = true; saved = c.claimed; }
    }
    c.decision = action; c.result = msg; c.paid = pay;
    this.cash -= pay;
    this.rep.payouts += pay;
    this.stats.paid += pay;
    this.stats.wasted += wasted;
    this.stats.savedMoney += saved;
    this.trust = clamp(this.trust + dT, 0, 100);
    const b = this.bAt[c.by * W + c.bx];
    if (b && pay > 0) b.repair = true;
    if (caught) { this.stats.caught++; this.rep.fraudCaught++; this.score += 25; }
    const correct = action === c.optimal;
    this.stats.decided++; this.dayDecided++;
    if (correct) {
      this.stats.right++; this.dayCorrect++;
      this.streak++;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
      this.score += 10 + Math.min(this.streak, 10) * 2;
      if (this.streak >= 3) { this.floatT(c.bx + 0.5, c.by - 0.2, 'STREAK ×' + this.streak, '#fde047', 1.2); audio.sfx('streak'); }
    } else this.streak = 0;
    this.lastResult = (correct ? '✔ ' : '✘ ') + msg;
    this.floatT(c.bx + 0.5, c.by + 0.4, pay > 0 ? '−$' + pay + 'K' : action === 'deny' ? 'DENIED' : '$0', pay > 0 ? '#fbbf24' : '#94a3b8', 1);
    audio.sfx(action);
    if (pay > 0) audio.sfx('cash');
    this.ci++;
    if (this.ci >= this.claims.length) this.endDay();
    this.notify();
  }

  fastSettle() {
    let guard = 0;
    while (this.phase === 'claims' && guard++ < 50) {
      const c = this.claims[this.ci];
      if (!c) break;
      this.decide(c.covered ? 'settle' : 'deny');
    }
  }

  // ---------------------------------------------------------------- end of day
  private rollEvent() {
    const total = EVENTS.reduce((s, e) => s + e.weight, 0);
    let r = Math.random() * total;
    let ev = EVENTS[0];
    for (const e of EVENTS) { r -= e.weight; if (r <= 0) { ev = e; break; } }
    this.cond = { heatwave: ev.id === 'heatwave', storm: ev.id === 'storm', fog: ev.id === 'fog', fraud: ev.id === 'fraud' };
    this.condTitle = ev.title;
    this.condText = ev.text;
    if (ev.id === 'windfall') this.cash += 150;
    if (ev.id === 'subsidy') this.rp += 2;
    if (ev.id === 'scandal') this.trust = clamp(this.trust - 5, 0, 100);
    if (ev.id === 'audit') {
      const acc = this.stats.decided ? this.stats.right / this.stats.decided : 1;
      if (acc >= 0.65) { this.trust = clamp(this.trust + 4, 0, 100); this.condText = 'Clean audit! +4 trust.'; }
      else { this.cash -= 100; this.trust = clamp(this.trust - 3, 0, 100); this.condText = 'Failed audit: −$100K fine, −3 trust.'; }
    }
  }

  private endDay() {
    let repaired = 0, rebuilt = 0, blight = 0;
    for (const b of this.buildings) {
      if (b.repair) { b.hp = b.maxHp; b.pop = b.maxPop; repaired++; }
      else if (b.hp <= 0) {
        if (Math.random() < 0.2) { b.hp = Math.round(b.maxHp * 0.6); b.pop = Math.round(b.maxPop * 0.6); rebuilt++; }
        else blight++;
      } else if (b.hp < b.maxHp) b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.2);
      b.repair = false; b.hpLost = 0; b.dmg = zeroDmg();
      if (b.hp > 0 && b.pop === 0) b.pop = b.maxPop;
    }
    this.fireT.fill(0); this.floodT.fill(0);
    const prem = Math.round(this.premiumIncome());
    const maint = Math.round(this.maintenance());
    this.cash += prem - maint;
    this.stats.premiums += prem;
    this.rep.premiums = prem; this.rep.maintenance = maint; this.rep.repaired = repaired; this.rep.rebuilt = rebuilt; this.rep.blight = blight;
    this.rp += 2;
    if (this.has('pr')) this.trust += 1;
    this.trust -= Math.min(3, blight * 0.08);
    if (this.trust < 55) this.trust += 0.5;
    this.trust = clamp(this.trust, 0, 100);
    this.fatigue = Math.max(0, this.fatigue - 0.03);
    this.stats.incidents++;
    this.score += 80 + this.day * 20;
    this.rep.claimsRight = this.dayCorrect;
    this.rep.claimsTotal = this.dayDecided;
    this.rollEvent();
    this.rep.event = this.condTitle;
    this.rep.eventText = (this.rep.eventText ? this.rep.eventText + ' ' : '') + 'Tomorrow: ' + this.condText;
    this.rep.cashDelta = Math.round(this.cash - this.dayStart.cash);
    this.rep.trustDelta = Math.round((this.trust - this.dayStart.trust) * 10) / 10;
    this.phase = 'report';
    // lose / win checks
    if (this.trust <= 0) return this.finalizeRun(false, 'Public trust collapsed. Regulators revoked your license.');
    if (this.cash < -400) return this.finalizeRun(false, 'The firm is insolvent. Creditors seized the office.');
    if (this.totalPop() < this.initialPop * 0.35) return this.finalizeRun(false, 'The city has been abandoned. There is no one left to insure.');
    if (this.day >= MAX_DAY && !this.endless) return this.finalizeRun(true, 'You survived OMEGA and kept the firm solvent.');
    audio.setMode('report');
    audio.sfx('report');
    this.notify();
  }

  nextDay() {
    if (this.phase !== 'report' || this.status !== 'playing') return;
    this.day++;
    this.phase = 'briefing';
    this.resetDay();
    this.planIncident();
    audio.setMode('briefing');
    audio.sfx('click');
    this.notify();
  }

  finalizeRun(won: boolean, reason: string, quiet = false) {
    if (this.finalized) return;
    this.finalized = true;
    const bonus = Math.max(0, this.cash) / 4 + this.trust * 10 + (won ? 1500 : 0);
    this.finalScore = Math.round((this.score + bonus) * this.diff.mul * this.modMul());
    const cpTotal = Math.floor(this.finalScore / 500) + Math.max(0, this.day - 1) + (won ? 8 : 0);
    this.cpGain = Math.max(0, cpTotal - this.cpPrev);
    this.cpPrev = cpTotal;
    this.meta.cp += this.cpGain;
    this.meta.runs++;
    if (won) { this.meta.wins++; this.meta.unlockedCat = true; }
    this.meta.kills += this.stats.kills;
    this.meta.bestScore = Math.max(this.meta.bestScore, this.finalScore);
    this.meta.bestDay = Math.max(this.meta.bestDay, this.day);
    this.meta.bestByDiff[this.diff.id] = Math.max(this.meta.bestByDiff[this.diff.id] || 0, this.finalScore);
    saveMeta(this.meta);
    this.endReason = reason;
    this.status = won ? 'won' : 'lost';
    if (!quiet) {
      audio.setMode(won ? 'win' : 'lose');
      audio.sfx(won ? 'win' : 'lose');
    }
    this.notify();
  }

  continueEndless() {
    if (this.status !== 'won') return;
    this.endless = true;
    this.finalized = false;
    this.status = 'playing';
    this.nextDay();
  }

  markHelpSeen() {
    if (!this.meta.seenHelp) {
      this.meta.seenHelp = true;
      saveMeta(this.meta);
    }
  }

  // ---------------------------------------------------------------- meta progression
  buyResearch(id: string) {
    const n = RESEARCH.find((r) => r.id === id);
    if (!n || this.has(id) || this.rp < n.cost || (n.req && !this.has(n.req))) { audio.sfx('error'); return; }
    this.rp -= n.cost;
    this.researched.add(id);
    audio.sfx('research');
    if (this.phase === 'briefing') this.computeForecast();
    this.notify();
  }
  buyPerk(id: string) {
    const p = PERKS.find((x) => x.id === id);
    if (!p) return;
    const lvl = this.perk(id);
    const cost = p.cost * (lvl + 1);
    if (lvl >= p.max || this.meta.cp < cost) { audio.sfx('error'); return; }
    this.meta.cp -= cost;
    this.meta.perks = { ...this.meta.perks, [id]: lvl + 1 };
    saveMeta(this.meta);
    audio.sfx('research');
    this.notify();
  }
}
