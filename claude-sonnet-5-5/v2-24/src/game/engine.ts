import {
  W, H, N, TICK, SEASON_TICKS, YEAR_TICKS, SEASON_SPRING, SEASON_DEMAND, SEASON_EVAP, SEASON_GROW, SEASON_RAIN_W,
  TOOL_BY_ID, TECH_BY_ID, EVENT_INFO, DISTRICT_NAMES, SEASONS, DIFFS, MODS, SCENARIOS,
} from './data';
import type { Kind, ToolId, EventKind, Scenario, Difficulty } from './data';
import type { AudioEngine } from './audio';

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; s: number; g: number }
export interface Floater { x: number; y: number; text: string; c: string; life: number }
export interface ActiveEvent { id: number; kind: EventKind; power: number; end: number; boss: boolean }
export interface PendingEvent { id: number; kind: EventKind; power: number; at: number; dur: number; boss: boolean }
export interface LogEntry { id: number; msg: string; kind: 'info' | 'warn' | 'good' | 'bad'; at: number }
export interface Eval { ok: boolean; reason?: string; cost: number; kind?: Kind; bed?: number }
export interface Spring { i: number; x: number; y: number; rate: number; mult: number; failUntil: number }
export interface GameConfig { scenario: number; diff: number; mods: string[]; legacy: Record<string, number>; tutorial: boolean; seed?: number }
export type Overlay = 'none' | 'height' | 'health' | 'happy';

export interface GameStats {
  peakPop: number; deaths: number; homesLost: number; floods: number; delivered: number; wasted: number;
  earned: number; spent: number; harvests: number; built: number; events: number; discharged: number; treated: number; drained: number;
}
export interface Result {
  win: boolean; reason: string; score: number; stars: number; legacy: number; time: number; pop: number; happy: number;
  pollution: number; stats: GameStats; techs: number; scenario: number;
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function valueNoise(rng: () => number, gw: number, gh: number) {
  const lat: number[] = [];
  for (let i = 0; i < (gw + 1) * (gh + 1); i++) lat.push(rng());
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const fx = x * gw, fy = y * gh;
    const x0 = Math.min(gw - 1, Math.floor(fx)), y0 = Math.min(gh - 1, Math.floor(fy));
    const tx = sm(fx - x0), ty = sm(fy - y0);
    const a = lat[y0 * (gw + 1) + x0], b = lat[y0 * (gw + 1) + x0 + 1];
    const c = lat[(y0 + 1) * (gw + 1) + x0], d = lat[(y0 + 1) * (gw + 1) + x0 + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}

const UPKEEP: Partial<Record<Kind, number>> = {
  canal: 0.0015, bridge: 0.008, tunnel: 0.006, reservoir: 0.05, sluice: 0.003, spillway: 0.01, pump: 0.16,
  drain: 0.001, treatment: 0.15, fountain: 0.05, bath: 0.1, grand: 0.4, well: 0.01, mill: 0.02,
};

export const isWaterKind = (k: Kind) =>
  k === 'canal' || k === 'bridge' || k === 'tunnel' || k === 'reservoir' || k === 'sluice' || k === 'spillway';

export const KIND_NAME: Record<Kind, string> = {
  none: 'Open ground', canal: 'Canal', bridge: 'Aqueduct', tunnel: 'Tunnel', reservoir: 'Reservoir', sluice: 'Sluice gate',
  spillway: 'Spillway', pump: 'Screw pump', drain: 'Drain', house: 'Insula', farm: 'Farm', fountain: 'Fountain',
  bath: 'Bathhouse', mill: 'Water mill', treatment: 'Treatment plant', well: 'Well', grand: 'Imperial Fountain', rubble: 'Rubble',
};

export class Game {
  cfg: GameConfig;
  sc: Scenario;
  diff: Difficulty;
  mods: Set<string>;
  audio: AudioEngine;
  rng: () => number;

  h = new Uint8Array(N);
  kind: Kind[] = new Array(N).fill('none');
  bed = new Float32Array(N);
  w = new Float32Array(N);
  aux = new Float32Array(N);
  pop = new Float32Array(N);
  sat = new Float32Array(N);
  happy = new Float32Array(N);
  waste = new Float32Array(N);
  sick = new Float32Array(N);
  dmg = new Float32Array(N);
  crop = new Float32Array(N);
  paid = new Float32Array(N);
  flood = new Float32Array(N);
  dirty = new Uint8Array(N);
  cracked = new Uint8Array(N);
  coastal = new Uint8Array(N);
  springAt = new Int16Array(N).fill(-1);
  memKind: Kind[] = new Array(N).fill('none');
  memBed = new Float32Array(N);
  flowE = new Float32Array(N * 4);
  lvl = new Uint8Array(N);
  fountCov = new Float32Array(N);
  bathCov = new Float32Array(N);
  noiseCov = new Float32Array(N);
  fertCov = new Float32Array(N);
  plantLeft = new Float32Array(N);
  springs: Spring[] = [];
  grandOn = false;

  coins = 0; knowledge = 0; pollution = 0; unrest = 0; tick = 0; acc = 0; speed = 1;
  status: 'playing' | 'won' | 'lost' = 'playing';
  paused = false;
  techs = new Set<string>();
  events: ActiveEvent[] = [];
  pending: PendingEvent[] = [];
  directorAt = 260;
  bossStart = 0; bossEnd = 0; bossState: 'wait' | 'warned' | 'active' | 'done' = 'wait';
  evId = 1;
  winHold = 0; debtTicks = 0; endless = false;
  stats: GameStats = { peakPop: 0, deaths: 0, homesLost: 0, floods: 0, delivered: 0, wasted: 0, earned: 0, spent: 0, harvests: 0, built: 0, events: 0, discharged: 0, treated: 0, drained: 0 };
  result: Result | null = null;

  particles: Particle[] = [];
  floaters: Floater[] = [];
  shake = 0; flash = 0; flashColor = '#fff';
  anim = 0; clock = 0;
  logs: LogEntry[] = []; logId = 1;
  banner: { text: string; life: number; kind: string } | null = null;
  rainI = 0; droughtI = 0; surgeI = 0;
  rainDrops = new Float32Array(160 * 3);
  lastOverflowMsg = -99;
  lastSickMsg = -99;

  // player state
  tool: ToolId = 'canal';
  pumpDir = 0;
  overlay: Overlay = 'none';
  hover = -1;
  selected = -1;
  settingsShake = true;

  // derived
  totalPop = 0; avgHappy = 50; supply = 0; demand = 0; waterRatio = 1; incomeRate = 0;
  tIn = 0; tOut = 0; incomeEma = 0;
  districts: { name: string; pop: number; happy: number; sick: number }[] = [];
  tutStep = -1; tutTimer = 0; tutDone = false;
  seasonSpringMul = 1;
  costMult = 1;
  incomeMult = 1;
  fxSources: { x: number; y: number; k: string }[] = [];

  constructor(cfg: GameConfig, audio: AudioEngine) {
    this.cfg = cfg;
    this.audio = audio;
    this.sc = SCENARIOS[cfg.scenario] || SCENARIOS[0];
    this.diff = DIFFS[cfg.diff] || DIFFS[1];
    this.mods = new Set(cfg.mods);
    this.rng = mulberry32((cfg.seed ?? this.sc.seed) + 17);
    const L = cfg.legacy || {};
    this.costMult = this.diff.cost * (1 - 0.08 * (L.masons || 0));
    this.incomeMult = this.diff.income;
    this.coins = Math.round(this.sc.startCoins * (1 + 0.12 * (L.coffers || 0)) * (this.mods.has('frugal') ? 0.5 : 1));
    if (L.cistern) { this.techs.add('reservoirs'); this.techs.add('sluices'); }
    if (L.gift) this.techs.add('lined');
    this.generate();
    this.tool = 'canal';
    this.directorAt = cfg.tutorial ? 420 : 280;
    this.bossStart = (this.sc.years - 1) * YEAR_TICKS + 180;
    const last = this.sc.boss.reduce((m, p) => Math.max(m, p.at + p.dur), 0);
    this.bossEnd = this.bossStart + last;
    if (cfg.tutorial) this.tutStep = 0;
    this.addLog(`Year 1 begins in ${this.sc.name}. Springs lie in the highlands — find them.`, 'info');
    this.recomputeCover();
    this.computeStats();
  }

  /* ---------- terrain ---------- */
  private generate() {
    const sc = this.sc;
    const rng = mulberry32(this.cfg.seed ?? sc.seed);
    const n1 = valueNoise(rng, 5, 4), n2 = valueNoise(rng, 10, 7), n3 = valueNoise(rng, 20, 14);
    const hf = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / (W - 1), ny = y / (H - 1);
        const nz = n1(nx, ny) * 0.55 + n2(nx, ny) * 0.3 + n3(nx, ny) * 0.15;
        let v = 0.5;
        switch (sc.terrain) {
          case 'valley': {
            const tr = 1 - (nx * 0.5 + ny * 0.8) / 1.3;
            v = tr * 0.78 + (nz - 0.5) * 0.42 + 0.1;
            if (nx + ny > 1.58) v = 0;
            break;
          }
          case 'mesa': {
            const tr = 1 - (nx * 0.3 + ny * 0.9) / 1.2;
            v = tr * 0.82 + (nz - 0.5) * 0.35 + 0.1;
            v = Math.floor(v * 6.5) / 6.5 + 0.05;
            if (nx + ny > 1.62) v = 0;
            break;
          }
          case 'delta': {
            const tr = 1 - ny * 0.9 - nx * 0.1;
            v = 0.12 + tr * 0.46 + (nz - 0.5) * 0.24;
            if (ny > 0.87) v = 0;
            break;
          }
          case 'capital': {
            const dx = Math.abs(nx - 0.5) * 2;
            v = Math.pow(dx, 1.5) * 0.85 + (1 - ny) * 0.38 + (nz - 0.5) * 0.3 + 0.04;
            if (ny > 0.9) v = 0;
            break;
          }
        }
        hf[y * W + x] = v;
        this.h[y * W + x] = v < 0.12 ? 0 : Math.max(1, Math.min(9, Math.round(v * 9.4)));
      }
    }
    // springs on highest, spaced-out ground
    const cands: { i: number; s: number }[] = [];
    let maxH = 0;
    for (let i = 0; i < N; i++) maxH = Math.max(maxH, this.h[i]);
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      const i = y * W + x;
      if (this.h[i] >= Math.max(3, maxH - 2)) cands.push({ i, s: this.h[i] + rng() * 2.2 });
    }
    cands.sort((a, b) => b.s - a.s);
    for (const minD of [10, 7, 5, 3]) {
      for (const c of cands) {
        if (this.springs.length >= sc.springs) break;
        const x = c.i % W, y = (c.i / W) | 0;
        if (this.springs.some(s => Math.abs(s.x - x) + Math.abs(s.y - y) < minD)) continue;
        this.springs.push({ i: c.i, x, y, rate: 3.0 + rng() * 0.8, mult: 1, failUntil: 0 });
      }
    }
    for (let k = 0; k < this.springs.length; k++) {
      const s = this.springs[k];
      const hh = Math.max(2, this.h[s.i]);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = s.x + dx, ny = s.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        this.h[ny * W + nx] = hh;
      }
      this.springAt[s.i] = k;
    }
    // coastal lowlands (surge reach)
    const dist = new Int16Array(N).fill(99);
    const q: number[] = [];
    for (let i = 0; i < N; i++) if (this.h[i] === 0) { dist[i] = 0; q.push(i); }
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi];
      for (let d = 0; d < 4; d++) {
        const n = this.nb(i, d);
        if (n >= 0 && dist[n] > dist[i] + 1) { dist[n] = dist[i] + 1; q.push(n); }
      }
    }
    for (let i = 0; i < N; i++) this.coastal[i] = this.h[i] > 0 && this.h[i] <= 2 && dist[i] <= 5 ? 1 : 0;
    for (let i = 0; i < N; i++) this.bed[i] = this.h[i];
    void hf;
    for (let i = 0; i < this.rainDrops.length; i += 3) {
      this.rainDrops[i] = Math.random(); this.rainDrops[i + 1] = Math.random(); this.rainDrops[i + 2] = 0.6 + Math.random() * 0.8;
    }
  }

  nb(i: number, d: number) {
    const x = i % W, y = (i / W) | 0;
    const nx = x + DX[d], ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return -1;
    return ny * W + nx;
  }

  flowing(i: number) {
    const k = this.kind[i];
    return isWaterKind(k) && !(k === 'sluice' && this.aux[i] === 0);
  }
  cap(i: number) {
    const k = this.kind[i];
    if (k === 'reservoir') return 40;
    const base = k === 'bridge' || k === 'tunnel' ? 10 : 8;
    return base * (this.techs.has('lined') ? 1.25 : 1);
  }
  capDrain() { return 6; }
  lift() { return this.techs.has('pistons') ? 5 : 3; }
  countKind(k: Kind) { let c = 0; for (let i = 0; i < N; i++) if (this.kind[i] === k) c++; return c; }

  /* ---------- logging / fx ---------- */
  addLog(msg: string, kind: LogEntry['kind'] = 'info') {
    this.logs.push({ id: this.logId++, msg, kind, at: this.clock });
    if (this.logs.length > 40) this.logs.shift();
  }
  setBanner(text: string, kind = 'warn') { this.banner = { text, life: 4.5, kind }; }
  floatText(i: number, text: string, c = '#ffe9a8') {
    this.floaters.push({ x: (i % W) + 0.5, y: ((i / W) | 0) + 0.2, text, c, life: 1.3 });
    if (this.floaters.length > 60) this.floaters.shift();
  }
  burst(x: number, y: number, n: number, c: string, speed = 2, life = 0.6, g = 4, s = 0.07) {
    for (let k = 0; k < n && this.particles.length < 700; k++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random() * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.4, life: life * (0.6 + Math.random() * 0.6), max: life, c, s: s * (0.7 + Math.random() * 0.8), g });
    }
  }
  doShake(v: number) { if (this.settingsShake) this.shake = Math.min(1.4, Math.max(this.shake, v)); }

  private fx(dt: number) {
    for (let k = this.particles.length - 1; k >= 0; k--) {
      const p = this.particles[k];
      p.life -= dt;
      if (p.life <= 0) { this.particles[k] = this.particles[this.particles.length - 1]; this.particles.pop(); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt;
    }
    for (let k = this.floaters.length - 1; k >= 0; k--) {
      const f = this.floaters[k];
      f.life -= dt; f.y -= dt * 0.9;
      if (f.life <= 0) this.floaters.splice(k, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    if (this.banner) { this.banner.life -= dt; if (this.banner.life <= 0) this.banner = null; }
    const rainT = this.rainTarget(), droT = this.events.some(e => e.kind === 'drought') ? 1 : 0, surT = this.events.some(e => e.kind === 'surge') ? 1 : 0;
    this.rainI += (rainT - this.rainI) * Math.min(1, dt * 1.5);
    this.droughtI += (droT - this.droughtI) * Math.min(1, dt * 0.8);
    this.surgeI += (surT - this.surgeI) * Math.min(1, dt * 1.2);
    for (let i = 0; i < this.rainDrops.length; i += 3) {
      this.rainDrops[i + 1] += dt * 1.6 * this.rainDrops[i + 2];
      this.rainDrops[i] -= dt * 0.25 * this.rainDrops[i + 2];
      if (this.rainDrops[i + 1] > 1.05) { this.rainDrops[i + 1] = -0.05; this.rainDrops[i] = Math.random() * 1.2; }
    }
    if (this.status === 'playing' && !this.paused) {
      for (const s of this.fxSources) {
        if (Math.random() < dt * (s.k === 'fountain' ? 14 : 9)) {
          this.particles.push({ x: s.x + 0.5 + (Math.random() - 0.5) * 0.3, y: s.y + 0.45, vx: (Math.random() - 0.5) * 0.9, vy: -1.6 - Math.random() * 1.2, life: 0.55, max: 0.55, c: s.k === 'fountain' ? '#bfeaff' : '#e8f8ff', s: 0.05, g: 6 });
        }
      }
    }
  }
  private rainTarget() {
    let r = 0;
    for (const e of this.events) if (e.kind === 'storm') r = Math.max(r, Math.min(1, 0.5 + e.power * 0.3));
    return r;
  }

  /* ---------- time ---------- */
  update(dtRaw: number) {
    const dt = Math.min(dtRaw, 0.1);
    this.anim += dt; this.clock += dt;
    this.fx(dt);
    if (this.status !== 'playing' || this.paused) return;
    this.acc += dt * this.speed;
    let steps = 0;
    while (this.acc >= TICK && steps < 10) {
      this.acc -= TICK; this.step(); steps++;
      if (this.status !== 'playing') break;
    }
    if (steps >= 10) this.acc = 0;
  }

  get season() { return Math.floor(this.tick / SEASON_TICKS) % 4; }
  get year() { return Math.floor(this.tick / YEAR_TICKS) + 1; }

  private step() {
    this.tick++;
    const season = this.season;
    this.tIn = 0; this.tOut = 0;
    for (let j = 0; j < this.flowE.length; j++) this.flowE[j] *= 0.6;
    // active events
    let rain = 0, dro = 0, surge = 0;
    for (let k = this.events.length - 1; k >= 0; k--) {
      const e = this.events[k];
      if (this.tick >= e.end) {
        this.events.splice(k, 1);
        this.addLog(`${EVENT_INFO[e.kind].name} has passed.`, 'good');
        if (e.boss) this.knowledge += 6;
        continue;
      }
      if (e.kind === 'storm') rain += 0.13 * e.power;
      else if (e.kind === 'drought') dro = Math.max(dro, e.power);
      else if (e.kind === 'surge') surge += e.power;
    }
    this.directorTick();
    // springs & wells
    const L = this.cfg.legacy || {};
    const baseMul = SEASON_SPRING[season] * this.diff.spring * (1 + 0.08 * (L.hydro || 0)) * (this.mods.has('parched') ? 0.8 : 1) * (this.techs.has('dowsing') ? 1.2 : 1) * (dro ? Math.max(0.25, 1 - 0.55 * dro) : 1) * (rain > 0 ? 1.35 : 1);
    this.seasonSpringMul = baseMul;
    for (const s of this.springs) {
      if (s.failUntil && this.tick >= s.failUntil) { s.mult = 1; s.failUntil = 0; this.addLog('A failing spring recovers.', 'good'); }
      this.emit(s.i, s.rate * baseMul * s.mult);
    }
    for (let i = 0; i < N; i++) {
      if (this.kind[i] === 'well') this.emit(i, 0.45 * (dro ? 0.65 : 1) * (1 - this.pollution * 0.6));
    }
    // rain
    if (rain > 0) {
      for (let i = 0; i < N; i++) {
        const k = this.kind[i];
        if (this.flowing(i)) this.w[i] += rain * (k === 'reservoir' ? 3 : 1) * (k === 'tunnel' ? 0.2 : 1);
        else if (k === 'drain') this.w[i] += rain * 0.4;
      }
    }
    if (surge > 0) {
      for (let i = 0; i < N; i++) if (this.coastal[i] && !isWaterKind(this.kind[i]) && this.kind[i] !== 'drain') {
        this.flood[i] = Math.min(6, this.flood[i] + 0.1 * surge * (this.h[i] <= 1 ? 1 : 0.5));
        this.dirty[i] = 0;
      }
    }
    // flow
    this.flowNet(i => this.flowing(i), i => this.cap(i));
    this.pumpStep();
    this.flowNet(i => this.kind[i] === 'drain', () => this.capDrain());
    // sinks, evaporation, cracks
    const evap = 0.002 * SEASON_EVAP[season] * (this.techs.has('lined') ? 0.5 : 1) * (this.mods.has('parched') ? 2 : 1) * (dro ? 1 + dro * 1.2 : 1);
    for (let i = 0; i < N; i++) {
      const k = this.kind[i];
      if (k === 'spillway' && this.w[i] > 0) {
        const r = Math.min(this.w[i], 2.5);
        this.w[i] -= r; this.stats.wasted += r;
        if (r > 0.5 && this.rng() < 0.4) this.audio.sfx('drip');
      } else if (this.flowing(i)) {
        this.w[i] -= this.w[i] * evap;
        if (this.cracked[i]) {
          this.w[i] *= 0.6;
          if (this.rng() < 0.2) this.burst((i % W) + 0.5, ((i / W) | 0) + 0.8, 2, '#8fd6f2', 1, 0.5, 6, 0.05);
        }
      }
    }
    // overflow -> floods
    this.overflow();
    // consumers
    this.supply = 0; this.demand = 0;
    const dd = (SEASON_DEMAND[season]) * (dro ? 1.12 : 1);
    this.plantLeft.fill(0);
    for (let i = 0; i < N; i++) if (this.kind[i] === 'treatment') this.plantLeft[i] = 3;
    for (let i = 0; i < N; i++) {
      switch (this.kind[i]) {
        case 'house': this.updateHouse(i, dd, dro); break;
        case 'farm': this.updateFarm(i, dd, dro, season); break;
        case 'fountain': this.updateUtility(i, 0.25); break;
        case 'bath': this.updateUtility(i, 0.35); break;
        case 'mill': this.updateUtility(i, 0.7, true); break;
        case 'grand': this.updateUtility(i, 0.6); break;
        default: break;
      }
    }
    this.drainOutlets();
    this.floodStep();
    // pollution
    const plants = this.tick % 10 === 0 ? this.countKind('treatment') : 0;
    this.pollution = Math.max(0, Math.min(1, this.pollution - 0.00012 - plants * 0.0004));
    // upkeep
    let upkeep = 0;
    for (let i = 0; i < N; i++) { const u = UPKEEP[this.kind[i]]; if (u) upkeep += u; }
    this.coins -= upkeep; this.tOut += upkeep; this.stats.spent += 0; 
    // knowledge
    const kmul = (1 + 0.15 * (L.scholars || 0)) * (this.grandOn ? 1.25 : 1);
    const gain = (0.02 + this.totalPop * 0.0016) * kmul;
    this.knowledge += gain;
    // misc timers
    if (this.tick % 10 === 0) { this.recomputeCover(); this.computeStats(); this.moodUpdate(); }
    if (this.tick % 30 === 0 && this.techs.has('repair')) this.autoRepair();
    this.incomeEma += (((this.tIn - this.tOut) * 5) - this.incomeEma) * 0.05;
    this.incomeRate = this.incomeEma;
    this.stats.peakPop = Math.max(this.stats.peakPop, this.totalPop);
    this.checkBoss();
    this.checkTutorial();
    this.checkEnd();
  }

  private emit(i: number, amount: number) {
    if (amount <= 0) return;
    const targets: number[] = [];
    for (let d = 0; d < 4; d++) {
      const n = this.nb(i, d);
      if (n >= 0 && this.flowing(n) && this.kind[n] !== 'spillway' && this.bed[n] <= this.h[i] + 0.01 && this.w[n] < this.cap(n) - 0.01) targets.push(n);
    }
    if (!targets.length) return;
    const share = amount / targets.length;
    for (const n of targets) this.w[n] += Math.min(share, this.cap(n) - this.w[n]);
  }

  private flowNet(isNet: (i: number) => boolean, capOf: (i: number) => number) {
    const idxs: number[] = [];
    for (let i = 0; i < N; i++) if (isNet(i)) idxs.push(i);
    if (this.tick % 2) idxs.reverse();
    const downs: number[] = [], dd: number[] = [], levels: number[] = [], ld: number[] = [];
    for (const i of idxs) {
      const wi = this.w[i];
      if (wi < 0.01) continue;
      const b = this.bed[i];
      downs.length = 0; dd.length = 0; levels.length = 0; ld.length = 0;
      for (let d = 0; d < 4; d++) {
        const n = this.nb(i, d);
        if (n < 0 || !isNet(n)) continue;
        const bn = this.bed[n];
        if (bn < b - 0.01) { downs.push(n); dd.push(d); }
        else if (Math.abs(bn - b) < 0.01 && this.w[n] < wi - 0.05) { levels.push(n); ld.push(d); }
      }
      if (downs.length) {
        const share = Math.min(wi, 5) / downs.length;
        for (let k = 0; k < downs.length; k++) {
          const n = downs[k];
          const amt = Math.min(share, Math.max(0, capOf(n) - this.w[n]), this.w[i]);
          if (amt > 0) { this.w[n] += amt; this.w[i] -= amt; this.flowE[i * 4 + dd[k]] += amt; }
        }
      } else if (levels.length) {
        for (let k = 0; k < levels.length; k++) {
          const n = levels[k];
          const amt = Math.min((this.w[i] - this.w[n]) * 0.35, 2.5, Math.max(0, capOf(n) - this.w[n]));
          if (amt > 0.001) { this.w[n] += amt; this.w[i] -= amt; this.flowE[i * 4 + ld[k]] += amt; }
        }
      }
    }
  }

  private pumpStep() {
    if (this.coins <= 0) return;
    const lift = this.lift();
    for (let i = 0; i < N; i++) {
      if (this.kind[i] !== 'pump') continue;
      const d = this.aux[i] | 0;
      const front = this.nb(i, d), back = this.nb(i, (d + 2) % 4);
      if (front < 0 || back < 0 || !this.flowing(front) || !this.flowing(back)) continue;
      if (this.bed[front] - this.bed[back] > lift + 0.01) continue;
      const amt = Math.min(3, this.w[back], Math.max(0, this.cap(front) - this.w[front]));
      if (amt > 0.01) {
        this.w[back] -= amt; this.w[front] += amt;
        this.flowE[i * 4 + d] += amt;
        if (this.rng() < 0.12) this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 1, '#d8f2ff', 1, 0.4, 3, 0.05);
      }
    }
  }

  private overflow() {
    for (let i = 0; i < N; i++) {
      const k = this.kind[i];
      const isW = this.flowing(i), isD = k === 'drain';
      if (!isW && !isD) continue;
      const cap = isW ? this.cap(i) : this.capDrain();
      if (this.w[i] <= cap + 0.001) continue;
      const excess = this.w[i] - cap;
      this.w[i] = cap;
      // lowest adjacent land tile
      let best = -1, bh = 99;
      for (let d = 0; d < 4; d++) {
        const n = this.nb(i, d);
        if (n < 0) continue;
        const kn = this.kind[n];
        if (isWaterKind(kn) || kn === 'drain') continue;
        if (this.h[n] === 0) { best = -2; bh = -1; continue; }
        if (this.h[n] < bh) { bh = this.h[n]; best = n; }
      }
      if (best === -2 || best === -1) continue; // spills harmlessly into the sea / nowhere
      this.flood[best] = Math.min(6, this.flood[best] + excess * 0.5);
      this.dirty[best] = isD ? 1 : this.dirty[best];
      if (excess > 0.25) {
        this.stats.floods++;
        this.burst((best % W) + 0.5, ((best / W) | 0) + 0.5, 4, isD ? '#9a8a3a' : '#8fd6f2', 1.6, 0.6);
        if (this.clock - this.lastOverflowMsg > 12) {
          this.lastOverflowMsg = this.clock;
          this.addLog(isD ? 'A drain is overflowing — sewage floods the streets!' : 'A channel is overflowing and flooding the land!', 'bad');
          this.audio.sfx('splash');
          this.doShake(0.25);
        }
      }
    }
  }

  private drawWater(i: number, r: number, need: number) {
    const x = i % W, y = (i / W) | 0;
    let got = 0;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!this.flowing(j) || this.kind[j] === 'spillway') continue;
      const take = Math.min(this.w[j], need - got);
      if (take > 0.0001) { this.w[j] -= take; got += take; if (got >= need - 1e-6) return got; }
    }
    return got;
  }

  private updateUtility(i: number, need: number, mill = false) {
    const got = this.drawWater(i, 1, need);
    this.demand += need; this.supply += got; this.stats.delivered += got;
    this.sat[i] += (got / need - this.sat[i]) * 0.1;
    if (mill && this.sat[i] > 0.4) {
      const c = 0.09 * this.sat[i] * this.incomeMult * (this.grandOn ? 1.25 : 1);
      this.coins += c; this.tIn += c; this.stats.earned += c;
    }
  }

  private updateFarm(i: number, dd: number, dro: number, season: number) {
    const need = 0.5 * dd * (dro ? 1.2 : 1);
    const got = this.drawWater(i, 2, need);
    this.demand += need; this.supply += got; this.stats.delivered += got;
    this.sat[i] += (got / need - this.sat[i]) * 0.1;
    if (this.flood[i] > 0.4) { this.crop[i] = 0; return; }
    if (this.sat[i] > 0.3) {
      const g = 0.008 * this.sat[i] * SEASON_GROW[season] * (this.techs.has('rotation') ? 1.3 : 1) * (1 - 0.5 * this.pollution) * (this.fertCov[i] > 0 ? 1.25 : 1);
      this.crop[i] += g;
    }
    if (this.crop[i] >= 1) {
      this.crop[i] = 0;
      const v = 14 * this.incomeMult * (this.fertCov[i] > 0 ? 1.25 : 1) * (this.grandOn ? 1.25 : 1);
      this.coins += v; this.tIn += v; this.stats.earned += v; this.stats.harvests++;
      this.floatText(i, `+${Math.round(v)}`, '#ffe38a');
      this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 6, '#f0d060', 1.8, 0.7);
      this.audio.sfx('harvest');
    }
  }

  private updateHouse(i: number, dd: number, dro: number) {
    const season = this.season;
    void season;
    const pop = Math.max(this.pop[i], 0.5);
    const need = 0.035 * pop * dd * (dro ? 1.05 : 1);
    const got = this.drawWater(i, 1, need);
    this.demand += need; this.supply += got; this.stats.delivered += got;
    this.sat[i] += (got / need - this.sat[i]) * 0.1;
    const x = i % W, y = (i / W) | 0;
    // waste
    let deposited = 0;
    if (got > 0) {
      let left = got * 0.7;
      for (let dy = -1; dy <= 1 && left > 0.0001; dy++) for (let dx = -1; dx <= 1 && left > 0.0001; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (this.kind[j] !== 'drain') continue;
        const free = this.capDrain() - this.w[j];
        if (free > 0.05) { const a = Math.min(free, left); this.w[j] += a; left -= a; deposited += a; }
      }
      this.stats.drained += deposited;
      this.waste[i] += left * 0.15;
    }
    this.waste[i] = Math.max(0, this.waste[i] - 0.004 - (deposited > 0.01 ? 0.05 : 0));
    if (this.waste[i] > 6) { this.waste[i] = 6; this.flood[i] = Math.min(6, this.flood[i] + 0.03); this.dirty[i] = 1; }
    // sickness
    let ns = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (this.kind[j] === 'house' && this.pop[j] > 0.5) ns += this.sick[j];
    }
    let risk = 0;
    if (this.waste[i] > 3.5) risk += 0.006 * (this.waste[i] - 3.5);
    if (this.flood[i] > 0.1 && this.dirty[i]) risk += 0.03;
    if (this.pollution > 0.55) risk += 0.03 * (this.pollution - 0.55);
    risk += ns * 0.0025 * (this.mods.has('foul') ? 1.8 : 1) * (this.pop[i] > 0.5 ? 1 : 0.2);
    const rec = 0.0035 + (this.bathCov[i] > 0 ? 0.02 : 0) + (this.techs.has('baths') ? 0.003 : 0);
    this.sick[i] = Math.max(0, Math.min(1, this.sick[i] + risk - rec));
    if (this.sick[i] > 0.5 && this.rng() < 0.01) {
      this.floatText(i, '🤢', '#9be07a');
      if (this.clock - this.lastSickMsg > 10) { this.audio.sfx('cough'); this.lastSickMsg = this.clock; }
    }
    // happiness
    let T = 42 + 32 * this.sat[i] - 22 * Math.min(1, this.waste[i] / 5) - 32 * this.pollution - 35 * this.sick[i];
    if (this.fountCov[i] > 0) T += 12;
    if (this.bathCov[i] > 0) T += 10;
    if (this.noiseCov[i] > 0) T -= 7;
    if (this.grandOn) T += 15;
    if (this.flood[i] > 0.1) T -= 25;
    this.happy[i] += (Math.max(0, Math.min(100, T)) - this.happy[i]) * 0.05;
    // tier
    let cap = 4, lvl = 1;
    if (this.fountCov[i] > 0 && this.happy[i] > 55) { cap = 7; lvl = 2; }
    if (this.fountCov[i] > 0 && this.bathCov[i] > 0 && this.happy[i] > 70) { cap = 11; lvl = 3; }
    this.lvl[i] = lvl;
    // population
    if (this.pop[i] > cap) this.pop[i] -= 0.015;
    else if (this.sat[i] > 0.75 && this.happy[i] > 45 && this.sick[i] < 0.3 && this.pop[i] < cap) this.pop[i] += 0.02;
    if (this.sat[i] < 0.35) this.pop[i] -= 0.015 + (this.sat[i] < 0.1 ? 0.025 : 0);
    if (this.sick[i] > 0.5) {
      const d = 0.02 * this.sick[i];
      const real = Math.min(d, Math.max(0, this.pop[i] - 0.05));
      this.pop[i] -= d; this.stats.deaths += real;
    }
    if (this.pop[i] < 0.05) this.pop[i] = 0.05;
    // tax
    const tax = this.pop[i] * 0.012 * (0.4 + (this.happy[i] / 100) * 0.8) * this.incomeMult * (this.grandOn ? 1.25 : 1);
    this.coins += tax; this.tIn += tax; this.stats.earned += tax;
    // flood damage
    if (this.flood[i] > 0.1) {
      this.dmg[i] += this.flood[i] * 0.012;
      if (this.dmg[i] > 1) this.destroy(i, 'flood');
    } else this.dmg[i] = Math.max(0, this.dmg[i] - 0.002);
  }

  private destroy(i: number, why: string) {
    const lost = Math.round(this.pop[i]);
    this.makeRubble(i);
    this.stats.homesLost++;
    this.floatText(i, `Home lost`, '#ff8a70');
    this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 14, '#a39683', 2.5, 0.8);
    this.doShake(0.5);
    this.addLog(`A home was destroyed by ${why} (${lost} displaced).`, 'bad');
    this.audio.sfx('demolish');
  }

  private makeRubble(i: number) {
    const old = this.kind[i];
    if (isWaterKind(old) || old === 'pump') { this.memKind[i] = old; this.memBed[i] = this.bed[i]; } else this.memKind[i] = 'none';
    this.clearTile(i);
    this.kind[i] = 'rubble';
    this.coverDirty();
  }

  private clearTile(i: number) {
    this.kind[i] = 'none'; this.w[i] = 0; this.aux[i] = 0; this.pop[i] = 0; this.sat[i] = 0; this.happy[i] = 0;
    this.waste[i] = 0; this.sick[i] = 0; this.dmg[i] = 0; this.crop[i] = 0; this.cracked[i] = 0; this.paid[i] = 0; this.bed[i] = this.h[i];
  }

  private coverDirty() { this.recomputeCover(); }

  private drainOutlets() {
    for (let i = 0; i < N; i++) {
      if (this.kind[i] !== 'drain' || this.w[i] < 0.02) continue;
      for (let d = 0; d < 4 && this.w[i] > 0.02; d++) {
        const n = this.nb(i, d);
        if (n < 0) continue;
        if (this.kind[n] === 'treatment' && this.plantLeft[n] > 0) {
          const a = Math.min(this.w[i], this.plantLeft[n]);
          this.w[i] -= a; this.plantLeft[n] -= a; this.stats.treated += a;
          const c = a * 0.1 * this.incomeMult; this.coins += c; this.tIn += c; this.stats.earned += c;
        }
      }
      for (let d = 0; d < 4 && this.w[i] > 0.02; d++) {
        const n = this.nb(i, d);
        if (n >= 0 && this.h[n] === 0) {
          const a = Math.min(this.w[i], 2.5);
          this.w[i] -= a; this.stats.discharged += a;
          this.pollution = Math.min(1, this.pollution + a * 0.0006);
          if (this.rng() < 0.1) this.burst((n % W) + 0.5, ((n / W) | 0) + 0.5, 2, '#9a8a3a', 1, 0.6, 2, 0.06);
        }
      }
    }
  }

  private floodStep() {
    const wardens = this.techs.has('wardens') ? 2 : 1;
    const fwd = this.tick % 2 === 0;
    for (let c = 0; c < N; c++) {
      const i = fwd ? c : N - 1 - c;
      const f = this.flood[i];
      if (f <= 0) continue;
      if (f < 0.02 || isWaterKind(this.kind[i]) || this.kind[i] === 'drain') { this.flood[i] = 0; this.dirty[i] = 0; continue; }
      const out = f * 0.2;
      const list: number[] = [];
      let absorbed = false;
      for (let d = 0; d < 4; d++) {
        const n = this.nb(i, d);
        if (n < 0) continue;
        if (this.h[n] === 0) { absorbed = true; continue; }
        if (this.h[n] <= this.h[i] && this.flood[n] < f - 0.05 && !isWaterKind(this.kind[n]) && this.kind[n] !== 'drain') list.push(n);
      }
      if (list.length) {
        const share = out / list.length;
        for (const n of list) { this.flood[n] += share; if (this.dirty[i]) this.dirty[n] = 1; }
        this.flood[i] -= out;
      }
      this.flood[i] -= (0.012 + (absorbed ? 0.05 : 0)) * wardens;
      if (this.flood[i] < 0) this.flood[i] = 0;
      const k = this.kind[i];
      if (k === 'farm' && this.flood[i] > 0.4) this.crop[i] = 0;
      if (k !== 'house' && k !== 'none' && k !== 'rubble' && this.flood[i] > 3 && this.rng() < 0.002 && k !== 'farm' && k !== 'pump') {
        // very deep floods can wash out small structures
        this.makeRubble(i);
      }
    }
  }

  /* ---------- coverage & stats ---------- */
  recomputeCover() {
    this.fountCov.fill(0); this.bathCov.fill(0); this.noiseCov.fill(0); this.fertCov.fill(0);
    this.grandOn = false;
    this.fxSources = [];
    for (let i = 0; i < N; i++) {
      const k = this.kind[i];
      const x = i % W, y = (i / W) | 0;
      let arr: Float32Array | null = null, r = 0;
      if (k === 'fountain' && this.sat[i] > 0.4) { arr = this.fountCov; r = 5; this.fxSources.push({ x, y, k: 'fountain' }); }
      else if (k === 'bath' && this.sat[i] > 0.4) { arr = this.bathCov; r = 6; }
      else if (k === 'mill' && this.sat[i] > 0.4) { arr = this.noiseCov; r = 3; }
      else if (k === 'treatment') { arr = this.fertCov; r = 4; }
      else if (k === 'grand' && this.sat[i] > 0.4) { this.grandOn = true; this.fxSources.push({ x, y, k: 'fountain' }); }
      else if (k === 'spillway' && this.w[i] > 0.3) this.fxSources.push({ x, y, k: 'spill' });
      if (arr) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          arr[ny * W + nx] += 1;
        }
      }
    }
  }

  computeStats() {
    let pop = 0, hs = 0, houses = 0;
    const dCols = 4, dRows = 3;
    const dp = new Array(dCols * dRows).fill(0), dh = new Array(dCols * dRows).fill(0), ds = new Array(dCols * dRows).fill(0);
    for (let i = 0; i < N; i++) {
      if (this.kind[i] !== 'house') continue;
      houses++;
      const p = this.pop[i];
      pop += p; hs += this.happy[i] * p;
      const x = i % W, y = (i / W) | 0;
      const di = Math.min(dRows - 1, Math.floor(y / (H / dRows))) * dCols + Math.min(dCols - 1, Math.floor(x / (W / dCols)));
      dp[di] += p; dh[di] += this.happy[i] * p; ds[di] += this.sick[i] * p;
    }
    this.totalPop = pop;
    this.avgHappy = pop > 0.5 ? hs / pop : 50;
    void houses;
    this.waterRatio = this.demand > 0.001 ? Math.min(1.2, this.supply / this.demand) : 1;
    this.districts = dp.map((p, k) => ({ name: DISTRICT_NAMES[k], pop: p, happy: p > 0.3 ? dh[k] / p : 0, sick: p > 0.3 ? ds[k] / p : 0 })).filter(d => d.pop > 0.3);
  }

  private moodUpdate() {
    let d = Math.min(0.6, this.unrest / 150);
    for (const e of this.events) d = Math.max(d, 0.5 + 0.2 * Math.min(2, e.power) + (e.boss ? 0.2 : 0));
    if (this.pending.some(p => p.at - this.tick < 40)) d = Math.max(d, 0.4);
    this.audio.setMood(d, this.rainI);
  }

  /* ---------- events ---------- */
  private directorTick() {
    // schedule pending -> launch
    for (let k = this.pending.length - 1; k >= 0; k--) {
      const p = this.pending[k];
      if (this.tick >= p.at) { this.pending.splice(k, 1); this.launch(p.kind, p.power, p.dur, p.boss); }
    }
    if (this.tick < this.directorAt) return;
    const inBoss = this.tick > this.bossStart - 320 && this.tick < this.bossEnd + 40;
    const seers = (this.cfg.legacy?.seers || 0);
    const warn = 60 + seers * 50 + (this.diff.id === 'pilgrim' ? 30 : 0);
    if (inBoss || this.bossState === 'active') { this.directorAt = this.tick + 40; return; }
    const hz = this.sc.hazards.filter(k => {
      if (k === 'plague' && this.countKind('house') < 4) return false;
      if ((k === 'quake' || k === 'slide') && this.totalPop < 8) return false;
      return true;
    });
    if (!hz.length) { this.directorAt = this.tick + 100; return; }
    const season = this.season;
    let total = 0;
    const ws = hz.map(k => { const wv = SEASON_RAIN_W[k][season] * (k === 'storm' && this.mods.has('stormy') ? 1.6 : 1); total += wv; return wv; });
    let r = this.rng() * total, pick = hz[0];
    for (let k = 0; k < hz.length; k++) { r -= ws[k]; if (r <= 0) { pick = hz[k]; break; } }
    const prog = Math.min(1, this.tick / (this.sc.years * YEAR_TICKS));
    let power = (0.8 + this.rng() * 0.5 + prog * 0.7) * Math.sqrt(this.diff.hazard) * (this.mods.has('stormy') && pick === 'storm' ? 1.2 : 1);
    power = Math.min(2.2, power);
    const dur = pick === 'storm' ? 60 + power * 30 : pick === 'drought' ? 150 + power * 40 : pick === 'surge' ? 70 + power * 20 : pick === 'springfail' ? 250 : 1;
    this.addPending(pick, power, dur, warn, false);
    const interval = Math.max(110, (190 + this.rng() * 130) / (this.diff.hazard * (this.mods.has('stormy') ? 1.15 : 1)));
    this.directorAt = this.tick + warn + interval;
  }

  private addPending(kind: EventKind, power: number, dur: number, warn: number, boss: boolean, at?: number) {
    this.pending.push({ id: this.evId++, kind, power, dur, at: at ?? this.tick + warn, boss });
    this.audio.sfx('warn');
    this.addLog(`Omen: ${EVENT_INFO[kind].name} approaches.`, 'warn');
  }

  private checkBoss() {
    const warnAt = this.bossStart - 260;
    if (this.bossState === 'wait' && this.tick >= warnAt) {
      this.bossState = 'warned';
      this.setBanner(`⚠ BOSS OMEN — ${this.sc.bossName}`, 'boss');
      this.addLog(`${this.sc.bossName}: ${this.sc.bossDesc}`, 'bad');
      this.audio.sfx('alarm');
      for (const ph of this.sc.boss) {
        const pw = ph.power * (0.9 + this.diff.hazard * 0.1);
        this.pending.push({ id: this.evId++, kind: ph.kind, power: pw, dur: ph.dur, at: this.bossStart + ph.at, boss: true });
      }
    }
    if (this.bossState === 'warned' && this.tick >= this.bossStart) { this.bossState = 'active'; this.setBanner(`${this.sc.bossName} BEGINS`, 'boss'); this.doShake(0.8); }
    if (this.bossState === 'active' && this.tick >= this.bossEnd + 10 && !this.events.some(e => e.boss) && !this.pending.some(p => p.boss)) {
      this.bossState = 'done';
      this.setBanner(`${this.sc.bossName} SURVIVED!`, 'good');
      this.addLog(`You survived ${this.sc.bossName}! +20 Knowledge.`, 'good');
      this.knowledge += 20;
      this.audio.sfx('upgrade');
    }
  }

  private launch(kind: EventKind, power: number, dur: number, boss: boolean) {
    this.stats.events++;
    const info = EVENT_INFO[kind];
    this.addLog(`${info.icon} ${info.name}!`, 'bad');
    this.setBanner(`${info.icon} ${info.name.toUpperCase()}`, boss ? 'boss' : 'warn');
    switch (kind) {
      case 'quake': this.applyQuake(power); break;
      case 'slide': this.applySlide(power); break;
      case 'plague': this.applyPlague(power); break;
      case 'springfail': {
        if (this.techs.has('dowsing')) { this.addLog('Dowsing rods found a backup vein — the spring holds.', 'good'); break; }
        const sp = this.springs[Math.floor(this.rng() * this.springs.length)];
        if (sp) { sp.mult = 0.35; sp.failUntil = this.tick + dur; this.burst(sp.x + 0.5, sp.y + 0.5, 12, '#6a5a3a', 2, 0.8); }
        break;
      }
      case 'storm': this.events.push({ id: this.evId++, kind, power, end: this.tick + dur, boss }); this.audio.sfx('thunder'); this.flash = 0.7; this.flashColor = '#dfe9ff'; this.doShake(0.4); break;
      case 'drought': this.events.push({ id: this.evId++, kind, power, end: this.tick + dur, boss }); this.flash = 0.4; this.flashColor = '#ffb040'; break;
      case 'surge': this.events.push({ id: this.evId++, kind, power, end: this.tick + dur, boss }); this.audio.sfx('quake'); this.doShake(0.6); break;
    }
  }

  private applyQuake(power: number) {
    this.audio.sfx('quake'); this.doShake(1.2); this.flash = 0.5; this.flashColor = '#ffffff';
    const count = Math.max(1, Math.round(power * 1.5 * (this.mods.has('fragile') ? 2 : 1) * (this.techs.has('concrete') ? 0.5 : 1)));
    const br: number[] = [];
    for (let i = 0; i < N; i++) if (this.kind[i] === 'bridge' && !this.cracked[i]) br.push(i);
    let n = 0;
    while (n < count && br.length) {
      const k = Math.floor(this.rng() * br.length); const i = br.splice(k, 1)[0];
      this.cracked[i] = 1; n++;
      this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 12, '#cdbd96', 2.5, 0.9);
    }
    if (n < count) {
      const hi: number[] = [];
      for (let i = 0; i < N; i++) if ((this.kind[i] === 'canal' || this.kind[i] === 'tunnel') && this.h[i] >= 4) hi.push(i);
      let m = 0;
      while (m < count - n && hi.length) {
        const k = Math.floor(this.rng() * hi.length); const i = hi.splice(k, 1)[0];
        this.makeRubble(i); m++; n++;
        this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 12, '#a39683', 2.5, 0.9);
      }
    }
    this.addLog(n ? `Earthquake! ${n} structure(s) damaged — repair cracked aqueducts.` : 'Earthquake! Nothing vulnerable was damaged.', n ? 'bad' : 'good');
  }

  private applySlide(power: number) {
    const hi: number[] = [];
    for (let i = 0; i < N; i++) if (isWaterKind(this.kind[i]) && this.h[i] >= 4) hi.push(i);
    const all: number[] = [];
    for (let i = 0; i < N; i++) if (isWaterKind(this.kind[i])) all.push(i);
    const pool = hi.length ? hi : all;
    const cnt = power > 1.5 ? 2 : 1;
    this.doShake(0.9); this.audio.sfx('quake');
    for (let k = 0; k < cnt && pool.length; k++) {
      const i = pool.splice(Math.floor(this.rng() * pool.length), 1)[0];
      this.makeRubble(i);
      this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 16, '#8f836f', 3, 1);
      this.floatText(i, 'Buried!', '#ffb08a');
    }
    this.addLog('A landslide buried part of a channel under rubble!', 'bad');
  }

  private applyPlague(power: number) {
    const hs: number[] = [];
    for (let i = 0; i < N; i++) if (this.kind[i] === 'house' && this.pop[i] > 0.8) hs.push(i);
    hs.sort((a, b) => this.waste[b] - this.waste[a] + (this.rng() - 0.5) * 2);
    const cnt = Math.max(1, Math.ceil(power * 1.5));
    for (let k = 0; k < cnt && k < hs.length; k++) {
      this.sick[hs[k]] = Math.min(1, 0.65 + power * 0.15);
      this.floatText(hs[k], '☣', '#9be07a');
    }
    this.audio.sfx('cough');
    this.addLog('Plague has erupted! Build baths and drains to contain it (press C for the contact graph).', 'bad');
  }

  private autoRepair() {
    for (let i = 0; i < N; i++) {
      if (this.cracked[i] && this.coins > 8) { this.cracked[i] = 0; this.coins -= 8; this.tOut += 8; this.floatText(i, 'Repaired', '#9be07a'); return; }
      if (this.kind[i] === 'rubble' && this.memKind[i] !== 'none') {
        const def = TOOL_BY_ID[this.memKind[i] === 'bridge' || this.memKind[i] === 'tunnel' ? 'bridge' : this.memKind[i]];
        const c = (def?.cost || 5) * this.costMult * 0.5;
        if (this.coins > c) {
          this.coins -= c; this.tOut += c;
          const mk = this.memKind[i]; const mb = this.memBed[i];
          this.clearTile(i); this.kind[i] = mk; this.bed[i] = mb; this.paid[i] = c * 2; if (mk === 'sluice') this.aux[i] = 1;
          this.floatText(i, 'Rebuilt', '#9be07a'); this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 6, '#cdbd96', 1.5, 0.6);
          return;
        }
      } else if (this.kind[i] === 'rubble') { this.clearTile(i); return; }
    }
  }

  /* ---------- tutorial ---------- */
  private tutorialSteps: { text: string; ok: () => boolean }[] = [
    { text: 'Welcome, Architect! Water flows only downhill. Choose the Canal (1) and drag from beside a glowing blue spring down the slope. Press H to view heights.', ok: () => this.countKind('canal') >= 6 && this.springs.some(s => [0, 1, 2, 3].some(d => { const n = this.nb(s.i, d); return n >= 0 && this.flowing(n); })) },
    { text: 'Place two Houses (4) within 1 tile of your canal and watch the water reach them.', ok: () => { let c = 0; for (let i = 0; i < N; i++) if (this.kind[i] === 'house' && this.sat[i] > 0.4) c++; return c >= 2; } },
    { text: 'Houses make waste! Lay a Drain (3) beside them and run it downhill toward the sea (deep blue). Outfalls pollute — later, a Treatment Plant cleans it.', ok: () => this.stats.drained > 2 },
    { text: 'Farms (5) earn coin. Place one within 2 tiles of a canal and wait for the harvest.', ok: () => this.stats.harvests >= 1 || this.countKind('farm') >= 1 },
    { text: 'To cross a valley or pierce a ridge, use the Aqueduct/Tunnel tool (2) next to a channel. Hover to preview the bed height and cost.', ok: () => this.countKind('bridge') + this.countKind('tunnel') >= 1 },
    { text: 'Knowledge ★ grows with your citizens. Open the Tech tab (T) and research something.', ok: () => this.techs.size > (this.cfg.legacy?.cistern ? 2 : 0) + (this.cfg.legacy?.gift ? 1 : 0) },
    { text: 'Watch the Omen bar for storms, droughts and quakes. Reach the population goal and survive the final boss. Good luck!', ok: () => this.tutTimer > 90 },
  ];
  get tutorial() { return this.tutStep >= 0 && this.tutStep < this.tutorialSteps.length ? { i: this.tutStep, total: this.tutorialSteps.length, text: this.tutorialSteps[this.tutStep].text } : null; }
  private checkTutorial() {
    if (this.tutStep < 0 || this.tutStep >= this.tutorialSteps.length) return;
    if (this.tutStep === this.tutorialSteps.length - 1) this.tutTimer++;
    if (this.tutorialSteps[this.tutStep].ok()) { this.tutStep++; this.audio.sfx('upgrade'); }
  }
  skipTutorial() { this.tutStep = -1; }
  nextTutorial() { this.tutStep = Math.min(this.tutorialSteps.length, this.tutStep + 1); }

  /* ---------- end conditions ---------- */
  private checkEnd() {
    if (this.coins < 0) this.debtTicks++; else this.debtTicks = Math.max(0, this.debtTicks - 2);
    const L = this.avgHappy;
    if (this.totalPop > 0.5 && L < 30) this.unrest += (30 - L) * 0.004;
    else if (L > 45 || this.totalPop <= 0.5) this.unrest -= 0.05;
    this.unrest = Math.max(0, Math.min(100, this.unrest));
    if (this.unrest >= 100) return this.finish(false, 'Unrest boiled over — the people have risen against you.');
    if (this.debtTicks > 300) return this.finish(false, 'The treasury stayed in debt for a full minute. Creditors seized the works.');
    if (this.tick > 400 && this.stats.peakPop >= 15 && this.totalPop < 2) return this.finish(false, 'The city has been abandoned.');
    if (this.tick > 600 && this.coins < 10 && this.countKind('house') + this.countKind('farm') === 0 && this.tick % 10 === 0) return this.finish(false, 'Ruined: no coin and no city left to rebuild with.');
    if (!this.endless && this.bossState === 'done' && this.totalPop >= this.sc.goalPop && this.avgHappy >= this.sc.goalHappy) {
      this.winHold++;
      if (this.winHold >= 25) this.finish(true, 'Your waterworks have become the envy of the empire.');
    } else this.winHold = 0;
  }

  finish(win: boolean, reason: string) {
    if (this.status !== 'playing') return;
    this.status = win ? 'won' : 'lost';
    const s = this.stats;
    const score = Math.round(this.totalPop * 10 + this.avgHappy * 5 + Math.max(0, this.coins) / 10 - s.deaths * 4 - s.homesLost * 10 + (win ? 500 : 0));
    let stars = 0;
    if (win) { stars = 1; if (this.avgHappy >= 70) stars++; if (s.deaths < 8 && this.pollution < 0.35) stars++; }
    const dm = this.diff.legacy * (1 + [...this.mods].reduce((a, m) => a + (MODS.find(x => x.id === m)?.legacy || 0), 0));
    const frac = Math.min(1, this.stats.peakPop / this.sc.goalPop);
    const legacy = Math.max(1, Math.round((win ? this.sc.legacyReward * (1 + (stars - 1) * 0.25) : this.sc.legacyReward * 0.3 * frac) * dm));
    this.result = { win, reason, score: Math.max(0, score), stars, legacy, time: this.tick * TICK, pop: this.totalPop, happy: this.avgHappy, pollution: this.pollution, stats: { ...s }, techs: this.techs.size, scenario: this.cfg.scenario };
    this.audio.sfx(win ? 'win' : 'lose');
    this.audio.setMood(0, 0);
    this.flash = 1; this.flashColor = win ? '#ffe9a8' : '#401010';
  }

  /* ---------- player actions ---------- */
  private bedFromNeighbors(i: number): number | null {
    let best = -1;
    for (let d = 0; d < 4; d++) {
      const n = this.nb(i, d);
      if (n < 0) continue;
      const k = this.kind[n];
      if (isWaterKind(k)) best = Math.max(best, this.bed[n]);
      else if (this.springAt[n] >= 0) best = Math.max(best, this.h[n]);
      else if (k === 'pump') {
        const pd = this.aux[n] | 0;
        if (this.nb(n, pd) === i) {
          const back = this.nb(n, (pd + 2) % 4);
          const bb = back >= 0 && isWaterKind(this.kind[back]) ? this.bed[back] : this.h[n];
          best = Math.max(best, bb + this.lift());
        }
      }
    }
    return best < 0 ? null : best;
  }

  evalPlace(tool: ToolId, i: number): Eval {
    const bad = (reason: string): Eval => ({ ok: false, reason, cost: 0 });
    if (i < 0 || i >= N) return bad('');
    if (tool === 'select') return { ok: true, cost: 0 };
    const k = this.kind[i];
    if (tool === 'demolish') {
      if (this.springAt[i] >= 0) return bad('Springs cannot be removed');
      if (k === 'none') return bad('Nothing here');
      return { ok: true, cost: -this.paid[i] * 0.5 };
    }
    const def = TOOL_BY_ID[tool];
    if (def.tech && !this.techs.has(def.tech)) return bad(`Locked — research ${TECH_BY_ID[def.tech].name}`);
    if (this.h[i] === 0) return bad('Open water');
    if (this.springAt[i] >= 0) return bad('A spring — the water source');
    if (k !== 'none' && k !== 'rubble') return bad('Occupied');
    const cm = this.costMult;
    let cost = def.cost * cm;
    let kind: Kind = tool === 'bridge' ? 'canal' : (tool as Kind);
    let bed = this.h[i];
    const hh = this.h[i];
    switch (tool) {
      case 'bridge': {
        const B = this.bedFromNeighbors(i);
        if (B === null) return bad('Must adjoin a channel or spring');
        const cm2 = this.techs.has('concrete') ? 0.7 : 1;
        if (B === hh) { kind = 'canal'; cost = 3 * cm; }
        else if (B > hh) { if (B - hh > 4) return bad(`Too tall (${B - hh} > 4 levels)`); kind = 'bridge'; bed = B; cost = (14 + 5 * (B - hh)) * cm * cm2; }
        else { if (hh - B > 4) return bad(`Too deep (${hh - B} > 4 levels)`); kind = 'tunnel'; bed = B; cost = (12 + 4 * (hh - B)) * cm * cm2; }
        break;
      }
      case 'well': if (hh > 3) return bad('Wells need low ground (height ≤ 3)'); if (this.countKind('well') >= 6) return bad('Maximum of 6 wells'); break;
      case 'farm': if (hh > 6) return bad('Too high for farming'); break;
      case 'grand': if (this.countKind('grand') >= 1) return bad('Only one Imperial Fountain'); break;
      default: break;
    }
    return { ok: true, cost, kind, bed };
  }

  act(i: number, tool: ToolId, drag: boolean): boolean {
    if (this.status !== 'playing' || this.paused || i < 0) return false;
    if (tool === 'select') { if (!drag) this.interact(i); return true; }
    if (tool === 'demolish') return this.demolish(i, drag);
    const k = this.kind[i];
    if (!drag && ((tool === 'sluice' && k === 'sluice') || (tool === 'pump' && k === 'pump'))) { this.interact(i); return true; }
    const ev = this.evalPlace(tool, i);
    if (!ev.ok) { if (!drag && ev.reason) { this.floatText(i, ev.reason, '#ff9a80'); this.audio.sfx('error'); } return false; }
    if (ev.cost > this.coins) { if (!drag) { this.floatText(i, `Need ${Math.ceil(ev.cost)}🪙`, '#ff9a80'); this.audio.sfx('error'); } return false; }
    this.coins -= ev.cost; this.tOut += ev.cost; this.stats.spent += ev.cost; this.stats.built++;
    this.clearTile(i);
    this.memKind[i] = 'none';
    const kind = ev.kind as Kind;
    this.kind[i] = kind; this.bed[i] = ev.bed ?? this.h[i]; this.paid[i] = ev.cost;
    if (kind === 'house') { this.pop[i] = 1; this.sat[i] = 0.5; this.happy[i] = 50; }
    if (kind === 'farm') this.sat[i] = 0.5;
    if (kind === 'sluice') this.aux[i] = 1;
    if (kind === 'pump') this.aux[i] = this.pumpDir;
    if (kind === 'fountain' || kind === 'bath' || kind === 'mill' || kind === 'grand') this.sat[i] = 0.5;
    this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, kind === 'grand' ? 24 : 5, kind === 'bridge' ? '#e5d5ac' : '#cdbd96', 1.6, 0.5);
    this.audio.sfx('place');
    if (kind === 'grand') { this.doShake(0.6); this.setBanner('The Imperial Fountain rises!', 'good'); this.audio.sfx('upgrade'); }
    this.recomputeCover();
    return true;
  }

  demolish(i: number, drag: boolean) {
    const ev = this.evalPlace('demolish', i);
    if (!ev.ok) { if (!drag && ev.reason) { this.floatText(i, ev.reason, '#ff9a80'); this.audio.sfx('error'); } return false; }
    const refund = -ev.cost;
    if (refund > 0) { this.coins += refund; this.tIn += refund; this.floatText(i, `+${Math.round(refund)}`, '#ffe9a8'); }
    this.clearTile(i); this.memKind[i] = 'none';
    this.burst((i % W) + 0.5, ((i / W) | 0) + 0.5, 8, '#b5a888', 2, 0.6);
    this.audio.sfx('demolish');
    this.recomputeCover();
    return true;
  }

  interact(i: number) {
    const k = this.kind[i];
    this.selected = i;
    if (k === 'sluice') {
      this.aux[i] = this.aux[i] ? 0 : 1;
      this.floatText(i, this.aux[i] ? 'Open' : 'Closed', this.aux[i] ? '#9be07a' : '#ff9a80');
      this.audio.sfx('toggle');
    } else if (k === 'pump') {
      this.aux[i] = (this.aux[i] + 1) % 4;
      this.audio.sfx('toggle');
    } else if (this.cracked[i]) {
      const c = 10 * this.costMult;
      if (this.coins >= c) { this.coins -= c; this.tOut += c; this.cracked[i] = 0; this.floatText(i, 'Repaired', '#9be07a'); this.audio.sfx('place'); }
      else { this.floatText(i, `Need ${Math.ceil(c)}🪙`, '#ff9a80'); this.audio.sfx('error'); }
    } else if (k === 'rubble') {
      const mk = this.memKind[i];
      if (mk !== 'none') {
        const def = TOOL_BY_ID[mk === 'bridge' || mk === 'tunnel' ? 'bridge' : mk];
        const c = (def?.cost || 5) * this.costMult * 0.6;
        if (this.coins >= c) {
          this.coins -= c; this.tOut += c; const mb = this.memBed[i];
          this.clearTile(i); this.kind[i] = mk; this.bed[i] = mb; this.paid[i] = c * 1.6;
          if (mk === 'sluice') this.aux[i] = 1;
          this.floatText(i, 'Rebuilt', '#9be07a'); this.audio.sfx('place');
        } else { this.floatText(i, `Need ${Math.ceil(c)}🪙`, '#ff9a80'); this.audio.sfx('error'); }
      } else { this.clearTile(i); this.audio.sfx('demolish'); }
    } else this.audio.sfx('click');
  }

  research(id: string): boolean {
    const t = TECH_BY_ID[id];
    if (!t || this.techs.has(id)) return false;
    if (!t.req.every(r => this.techs.has(r))) { this.audio.sfx('error'); return false; }
    if (this.knowledge < t.cost) { this.audio.sfx('error'); return false; }
    this.knowledge -= t.cost;
    this.techs.add(id);
    this.addLog(`Researched ${t.name}: ${t.desc}`, 'good');
    this.setBanner(`${t.icon} ${t.name} researched`, 'good');
    this.audio.sfx('research');
    return true;
  }

  isUnlocked(tool: ToolId) { const d = TOOL_BY_ID[tool]; return !d.tech || this.techs.has(d.tech); }

  setSpeed(s: number) { this.speed = s; }

  setDifficulty(idx: number) {
    this.diff = DIFFS[idx] || this.diff;
    const L = this.cfg.legacy || {};
    this.costMult = this.diff.cost * (1 - 0.08 * (L.masons || 0));
    this.incomeMult = this.diff.income;
    this.cfg = { ...this.cfg, diff: idx };
    this.addLog(`Difficulty set to ${this.diff.name}.`, 'info');
  }

  continueAfterWin() {
    if (this.status !== 'won') return;
    this.status = 'playing'; this.endless = true; this.winHold = 0; this.result = null;
    this.addLog('You continue as sovereign architect. The waters still flow…', 'good');
  }

  /* ---------- info ---------- */
  tileInfo(i: number): string[] {
    if (i < 0) return [];
    const x = i % W, y = (i / W) | 0;
    const lines: string[] = [];
    const k = this.kind[i];
    lines.push(`(${x},${y}) · terrain height ${this.h[i]}${this.h[i] === 0 ? ' (water)' : ''}`);
    if (this.springAt[i] >= 0) {
      const s = this.springs[this.springAt[i]];
      lines.push(`Spring — output ${(s.rate * this.seasonSpringMul * s.mult).toFixed(1)}/tick${s.mult < 1 ? ' (FAILING)' : ''}`);
    }
    if (k !== 'none') lines.push(KIND_NAME[k]);
    if (isWaterKind(k)) {
      lines.push(`Bed height ${this.bed[i].toFixed(0)} · water ${this.w[i].toFixed(1)}/${this.cap(i).toFixed(0)}`);
      if (k === 'sluice') lines.push(this.aux[i] ? 'Gate OPEN (click to close)' : 'Gate CLOSED (click to open)');
      if (this.cracked[i]) lines.push('CRACKED — leaking! Click with Inspect to repair');
    }
    if (k === 'drain') lines.push(`Sewage ${this.w[i].toFixed(1)}/${this.capDrain()}`);
    if (k === 'pump') lines.push(`Faces ${['east', 'south', 'west', 'north'][this.aux[i] | 0]} · lift ${this.lift()} · ${this.coins > 0 ? 'running' : 'NO COIN'}`);
    if (k === 'house') {
      lines.push(`Residents ${this.pop[i].toFixed(1)} · tier ${this.lvl[i]} · water ${(this.sat[i] * 100).toFixed(0)}%`);
      lines.push(`Happiness ${this.happy[i].toFixed(0)} · septic ${this.waste[i].toFixed(1)} · illness ${(this.sick[i] * 100).toFixed(0)}%`);
      lines.push(`Fountain ${this.fountCov[i] > 0 ? '✔' : '✘'} · Bath ${this.bathCov[i] > 0 ? '✔' : '✘'} · Noise ${this.noiseCov[i] > 0 ? '⚠' : '—'}`);
    }
    if (k === 'farm') lines.push(`Crop ${(this.crop[i] * 100).toFixed(0)}% · water ${(this.sat[i] * 100).toFixed(0)}%${this.fertCov[i] > 0 ? ' · fertilized' : ''}`);
    if (k === 'fountain' || k === 'bath' || k === 'mill' || k === 'grand') lines.push(`Water supply ${(this.sat[i] * 100).toFixed(0)}%`);
    if (k === 'rubble') lines.push(this.memKind[i] !== 'none' ? `Click Inspect to rebuild ${KIND_NAME[this.memKind[i]]}` : 'Click Inspect to clear');
    if (this.flood[i] > 0.05) lines.push(`${this.dirty[i] ? 'SEWAGE ' : ''}Flood depth ${this.flood[i].toFixed(1)}`);
    return lines;
  }

  snapshot() {
    const counts: Record<string, number> = {};
    for (let i = 0; i < N; i++) { const k = this.kind[i]; if (k !== 'none') counts[k] = (counts[k] || 0) + 1; }
    const ti = this.tick;
    const bossProg = this.bossState === 'active' ? Math.min(1, (ti - this.bossStart) / Math.max(1, this.bossEnd - this.bossStart)) : this.bossState === 'done' ? 1 : 0;
    return {
      coins: this.coins, income: this.incomeRate, pop: this.totalPop, goalPop: this.sc.goalPop, happy: this.avgHappy, goalHappy: this.sc.goalHappy,
      unrest: this.unrest, pollution: this.pollution, supply: this.supply, demand: this.demand, ratio: this.waterRatio, knowledge: this.knowledge,
      year: this.year, years: this.sc.years, season: this.season, seasonName: SEASONS[this.season], seasonProg: (ti % SEASON_TICKS) / SEASON_TICKS,
      speed: this.speed, paused: this.paused, status: this.status, tool: this.tool, overlay: this.overlay, pumpDir: this.pumpDir,
      tut: this.tutorial, techs: [...this.techs], knowledgeInt: Math.floor(this.knowledge),
      pending: this.pending.map(p => ({ id: p.id, kind: p.kind, secs: Math.max(0, Math.ceil((p.at - ti) * TICK)), boss: p.boss })).sort((a, b) => a.secs - b.secs),
      active: this.events.map(e => ({ id: e.id, kind: e.kind, power: e.power, secs: Math.max(0, Math.ceil((e.end - ti) * TICK)), boss: e.boss })),
      boss: { name: this.sc.bossName, state: this.bossState, prog: bossProg, secsTo: Math.max(0, Math.ceil((this.bossStart - ti) * TICK)) },
      log: this.logs.slice(-7).map(l => ({ id: l.id, msg: l.msg, kind: l.kind, age: this.clock - l.at })),
      banner: this.banner ? { ...this.banner } : null,
      info: this.tileInfo(this.hover >= 0 ? this.hover : this.selected),
      districts: this.districts, counts, stats: { ...this.stats }, debt: this.coins < 0, winHold: this.winHold, bossDone: this.bossState === 'done',
      time: ti * TICK, scName: this.sc.name,
    };
  }
}

export type Snap = ReturnType<Game['snapshot']>;
