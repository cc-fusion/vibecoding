import {
  W, H, N, DT_Y, SOIL_CAP, BUILD_MAP, TIERS, TIER_TECH, TECH_MAP, WORLD_MAP, DIFF_MAP, MILESTONES, STAGES,
  EVENT_INFO, clamp,
} from './data';
import type { BuildDef, BuildId, DiffDef, EventKind, GasKey, ToolId, WorldDef } from './data';
import { cylNoise, hashStr, mulberry32 } from './noise';

export interface RunConfig { world: string; diff: string; mods: string[]; seed: string; perks: Record<string, number> }

export type Fx =
  | { t: 'text'; x: number; y: number; s: string; c: string }
  | { t: 'burst'; x: number; y: number; kind: 'impact' | 'fire' | 'sparkle' | 'smoke' | 'build' | 'lance' | 'water'; n: number }
  | { t: 'shake'; a: number }
  | { t: 'sfx'; n: string }
  | { t: 'toast'; s: string; kind: 'good' | 'bad' | 'info' | 'warn' }
  | { t: 'flash'; c: string };

export interface Building { id: number; kind: BuildId; x: number; y: number; hp: number; pop: number; eff: number; food: number; out: number }
export interface Incoming { id: number; x: number; y: number; eta: number; total: number; size: number; src: 'meteor' | 'boss' | 'player' }
export interface GameEvent { id: number; kind: EventKind; phase: 'warn' | 'active'; t: number; dur: number; x: number; y: number; r: number; variant: number; alive: boolean }
export interface LogEntry { y: number; s: string; k: 'good' | 'bad' | 'info' | 'warn' }
export interface Sample { y: number; T: number; P: number; co2: number; o2: number; n2: number; pfc: number; H: number; pop: number }
export interface Boss { state: 'idle' | 'warn' | 'p1' | 'p2' | 'p3' | 'done'; t: number; dur: number; spawnLeft: number; spawnTimer: number; total: number }
export interface Stats {
  peakH: number; peakPop: number; built: number; comets: number; stopped: number; hit: number; events: number; lost: number; techs: number; maxTemp: number;
}
export interface EndInfo { win: boolean; reason: string }

export const sat = (T: number) => 0.0004 * Math.exp(0.075 * Math.min(T, 70));
const KC = 0.035;

export class World {
  cfg: RunConfig;
  wd: WorldDef;
  diff: DiffDef;
  mods: Set<string>;
  emit: (e: Fx) => void = () => {};

  hgt = new Float32Array(N);
  wat = new Float32Array(N);
  ice = new Float32Array(N);
  vap = new Float32Array(N);
  soil = new Float32Array(N);
  veg = new Float32Array(N);
  tmp = new Float32Array(N);
  cld = new Float32Array(N);
  rain = new Float32Array(N);
  heat = new Float32Array(N);
  soot = new Float32Array(N);
  hab = new Float32Array(N);
  vtier = new Uint8Array(N);
  fire = new Uint8Array(N);
  vent = new Uint8Array(N);
  seedT = new Uint8Array(N);
  biome = new Uint8Array(N);
  bmap = new Int16Array(N).fill(-1);
  scratchA = new Float32Array(N);
  scratchB = new Float32Array(N);
  scratchC = new Float32Array(N);

  bld: Building[] = [];
  incoming: Incoming[] = [];
  events: GameEvent[] = [];
  log: LogEntry[] = [];
  history: Sample[] = [];
  nextId = 1;

  gas: Record<GasKey, number>;
  acc: Record<string, number> = {};
  flows: Record<string, number> = {};
  aquifer: number;
  energy: number;
  mats: number;
  research: number;
  energyCap = 600;
  netEnergy = 0;
  prodEnergy = 0;
  consEnergy = 0;
  effPower = 1;

  techs = new Set<string>();
  mirror = 0;
  time = 0;
  tick = 0;

  // climate globals
  P = 0; pfG = 1; windScale = 1; greenhouse = 0; humidity = 0; avgT = -50; solarMul = 1;
  G = 0; H = 0; stage = 0; avgRaw = 0;
  fP = 0; fO = 0; fC = 1;
  season = 0;
  qRow = new Float32Array(H);
  cosw = new Float32Array(H);
  windU = new Float32Array(H);
  windV = new Float32Array(H);
  dust = 0; tOff = 0; tOffTarget = 0; evapMul = 1; rainMul = 1; flareMul = 1;

  // counts
  cnt = { veg: 0, rain: 0, water: 0, forest: 0, land: 1, fire: 0, ice: 0, hab: 0, biomes: 0, ocean: 0 };
  biomeCount = new Array(14).fill(0) as number[];
  inv = { ocean: 0, ice: 0, vap: 0, soil: 0 };
  pop = 0; popCap = 0; immigration = 0;

  nextEventIn = 9;
  boss: Boss = { state: 'idle', t: 0, dur: 0, spawnLeft: 0, spawnTimer: 0, total: 0 };
  cometCd = 0;
  holdT = 0;
  holdYears = 8;
  reckoningDone = false;
  milestones = new Set<string>();
  ended: EndInfo | null = null;
  won = false;
  continued = false;
  stats: Stats = { peakH: 0, peakPop: 0, built: 0, comets: 0, stopped: 0, hit: 0, events: 0, lost: 0, techs: 0, maxTemp: -999 };
  ventList: number[] = [];
  startX = 0;
  startY = 0;
  charter: number;

  constructor(cfg: RunConfig) {
    this.cfg = cfg;
    this.wd = WORLD_MAP[cfg.world] ?? WORLD_MAP.rusthaven;
    this.diff = DIFF_MAP[cfg.diff] ?? DIFF_MAP.engineer;
    this.mods = new Set(cfg.mods);
    const thin = this.mods.has('thin');
    const p = cfg.perks;
    this.gas = { n2: this.wd.n2, co2: this.wd.co2, o2: this.wd.o2, pfc: this.wd.pfc };
    this.aquifer = this.wd.aquifer;
    this.mats = Math.round(220 * this.diff.start * (thin ? 0.5 : 1) + 60 * (p.stores ?? 0));
    this.energy = Math.round(150 * this.diff.start * (thin ? 0.5 : 1) + 80 * (p.cells ?? 0));
    this.research = 60;
    this.charter = this.calcCharter();
    if ((p.vault ?? 0) > 0) this.techs.add('bio1');
    this.generate();
    this.computeGlobals();
    this.statsStep();
    this.note(`Charter signed for ${this.wd.name}. ${this.charter} years to make it habitable.`, 'info');
  }

  calcCharter(): number {
    let c = this.diff.charter + 10 * (this.cfg.perks.charter ?? 0);
    if (this.mods.has('short')) c = Math.round(c * 0.7);
    return c;
  }
  setDiff(id: string) {
    this.diff = DIFF_MAP[id] ?? this.diff;
    this.charter = this.calcCharter();
  }

  has(t: string | undefined): boolean { return !t || this.techs.has(t); }
  maxTier(): number {
    let m = 0;
    for (let t = 1; t < TIER_TECH.length; t++) if (this.techs.has(TIER_TECH[t])) m = t;
    return m;
  }
  costOf(def: BuildDef): number {
    return Math.ceil(def.cost * this.diff.cost * (this.mods.has('thin') ? 1.3 : 1) * (1 - 0.05 * (this.cfg.perks.rigs ?? 0)));
  }
  cometCost(): { m: number; e: number } {
    return { m: Math.ceil(120 * this.diff.cost * (1 - 0.15 * (this.cfg.perks.contracts ?? 0))), e: 70 };
  }
  warnTime(): number {
    return 3 + (this.has('warn') ? 3 : 0) + 2 * (this.cfg.perks.foresight ?? 0);
  }

  note(s: string, k: LogEntry['k'] = 'info', toast = true) {
    this.log.unshift({ y: this.time, s, k });
    if (this.log.length > 80) this.log.pop();
    if (toast) this.emit({ t: 'toast', s, kind: k });
  }

  // ---------- generation ----------
  generate() {
    const wd = this.wd;
    const seed = hashStr(this.cfg.seed + wd.id);
    const rng = mulberry32(seed);
    const raw = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = cylNoise(x, y, W, 0.045, seed, 3);
        const b = cylNoise(x, y, W, 0.13, seed + 7, 4);
        raw[y * W + x] = a * 0.6 + b * 0.4;
      }
    }
    const order = Array.from({ length: N }, (_, i) => i).sort((p, q) => raw[p] - raw[q]);
    order.forEach((idx, r) => { this.hgt[idx] = Math.pow(r / (N - 1), 1.08); });

    // volcanic vents on high ground
    const highs = order.slice(Math.floor(N * 0.72));
    let guard = 0;
    while (this.ventList.length < wd.vents && guard++ < 500) {
      const c = highs[Math.floor(rng() * highs.length)];
      const y = Math.floor(c / W);
      if (y < 3 || y > H - 4) continue;
      if (this.ventList.some((v) => this.dist(v % W, Math.floor(v / W), c % W, y) < 5)) continue;
      this.ventList.push(c);
      this.vent[c] = 1;
    }

    const sea = wd.ocean > 0 ? this.hgt[order[Math.floor(N * wd.ocean)]] : 0;
    for (let y = 0; y < H; y++) {
      const phi = (0.5 - (y + 0.5) / H) * Math.PI;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        this.tmp[i] = wd.startT + 20 * (Math.cos(phi) - 0.64) - 10 * this.hgt[i];
        const polar = clamp((Math.abs(phi) - 0.85) / 0.4, 0, 1);
        this.ice[i] += wd.capIce * polar;
        if (wd.id === 'glacia') {
          if (this.hgt[i] > sea) {
            if (this.hgt[i] > 0.82 || polar > 0.2) this.ice[i] += 0.08;
            this.soil[i] = SOIL_CAP * 0.25;
          } else {
            this.ice[i] += sea - this.hgt[i] + 0.02; // frozen sea
            this.soil[i] = SOIL_CAP;
          }
        } else {
          this.soil[i] = wd.id === 'rusthaven' ? 0.0015 : 0;
        }
        this.vap[i] = sat(this.tmp[i]) * 0.25;
      }
    }
    this.placeStart();
  }

  dist(ax: number, ay: number, bx: number, by: number): number {
    let dx = Math.abs(ax - bx);
    if (dx > W / 2) dx = W - dx;
    return Math.hypot(dx, ay - by);
  }

  findNear(cx: number, cy: number, rmax: number, pred: (i: number, x: number, y: number) => boolean): number {
    for (let r = 0; r <= rmax; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const y = cy + dy;
          if (y < 0 || y >= H) continue;
          const x = (cx + dx + W) % W;
          const i = y * W + x;
          if (pred(i, x, y)) return i;
        }
      }
    }
    return -1;
  }

  placeStart() {
    const cy = Math.floor(H / 2);
    const cx = Math.floor(W / 2);
    const land = (i: number) => this.bmap[i] < 0 && this.ice[i] < 0.06 && this.hgt[i] > (this.wd.ocean > 0 ? 0.48 : 0.12);
    let d = this.findNear(cx, cy, 14, (i) => land(i) && this.hgt[i] > 0.3 && this.hgt[i] < 0.62 && this.vent[i] === 0);
    if (d < 0) d = this.findNear(cx, cy, 20, (i) => land(i));
    if (d < 0) d = cy * W + cx;
    const dx = d % W, dy = Math.floor(d / W);
    this.startX = dx; this.startY = dy;
    const dome = this.addBuilding('dome', dx, dy);
    dome.pop = 12;
    for (let k = 0; k < 2; k++) {
      const s = this.findNear(dx, dy, 4, (i) => land(i) && this.vent[i] === 0);
      if (s >= 0) this.addBuilding('solar', s % W, Math.floor(s / W));
    }
    const l = this.findNear(dx, dy, 4, (i) => land(i) && this.vent[i] === 0);
    if (l >= 0) this.addBuilding('lab', l % W, Math.floor(l / W));
    const m = this.findNear(dx, dy, 12, (i) => land(i) && this.hgt[i] >= 0.35);
    if (m >= 0) this.addBuilding('mine', m % W, Math.floor(m / W));
    this.stats.built = 0;
  }

  addBuilding(kind: BuildId, x: number, y: number): Building {
    const b: Building = { id: this.nextId++, kind, x, y, hp: 100, pop: 0, eff: 1, food: 1, out: 0 };
    this.bld.push(b);
    this.bmap[y * W + x] = this.bld.length - 1;
    return b;
  }

  reindex() {
    this.bmap.fill(-1);
    this.bld.forEach((b, k) => { this.bmap[b.y * W + b.x] = k; });
  }

  removeBuilding(b: Building) {
    this.bld = this.bld.filter((q) => q !== b);
    this.reindex();
  }

  // ---------- player tools ----------
  tierSuit(t: number, i: number): number {
    const d = TIERS[t];
    if (!d || this.wat[i] > 0.02) return 0;
    const T = this.tmp[i];
    const tf = clamp((T - d.tmin) / 8, 0, 1) * clamp((d.tmax - T) / 8, 0, 1);
    const sf = clamp(this.soil[i] / SOIL_CAP / d.soil, 0, 1);
    const pf = this.P >= d.minP ? 1 : Math.pow(clamp(this.P / d.minP, 0, 1), 2);
    const cf = clamp(this.gas.co2 / 0.1, 0, 1);
    return Math.min(tf, sf, pf, cf);
  }
  bestTier(i: number): number {
    for (let t = this.maxTier(); t >= 1; t--) if (this.tierSuit(t, i) > 0.2) return t;
    return 0;
  }

  canUse(tool: ToolId, x: number, y: number): string | null {
    const i = y * W + x;
    if (tool === 'inspect') return null;
    if (tool === 'demolish') return this.bmap[i] >= 0 ? null : 'Nothing to demolish here';
    if (tool === 'comet') {
      if (!this.has('comet')) return 'Research Cometary Capture';
      const c = this.cometCost();
      if (this.cometCd > 0) return `Comet launcher recharging (${Math.ceil(this.cometCd * DT_Y * 8)}s)`;
      if (this.mats < c.m) return `Need ${c.m} materials`;
      if (this.energy < c.e) return `Need ${c.e} energy`;
      return null;
    }
    if (tool === 'cloud') {
      if (!this.has('cloud')) return 'Research Cloud Seeding';
      return this.energy >= 25 ? null : 'Need 25 energy';
    }
    if (tool === 'raise' || tool === 'lower') {
      if (!this.has('terra')) return 'Research Terrain Engineering';
      return this.mats >= 8 ? null : 'Need 8 materials';
    }
    if (tool === 'seed') {
      if (!this.has('bio1')) return 'Research Extremophile Genetics';
      if (this.mats < 8) return 'Need 8 materials';
      if (this.vtier[i] > 0) return 'Already populated';
      if (this.wat[i] > 0.02) return 'Underwater';
      if (this.bestTier(i) === 0) return 'Too harsh for any unlocked species (check temp, soil moisture, pressure, CO₂)';
      return null;
    }
    const def = BUILD_MAP[tool];
    if (!def) return 'Unknown tool';
    if (!this.has(def.tech)) return `Locked: research ${TECH_MAP[def.tech ?? '']?.name ?? def.tech}`;
    if (this.bmap[i] >= 0) return 'Tile occupied';
    if (this.wat[i] > 0.03) return 'Cannot build on open water';
    if (this.fire[i] > 0) return 'Tile is on fire';
    if (def.id === 'mine' && this.hgt[i] < 0.35) return 'Mines need highlands (elevation ≥ 35%)';
    if (def.id === 'geo' && !this.vent[i]) return 'Geothermal Taps need a volcanic vent (♨)';
    const c = this.costOf(def);
    if (this.mats < c) return `Need ${c} materials`;
    return null;
  }

  useTool(tool: ToolId, x: number, y: number): { ok: boolean; msg: string } {
    const err = this.canUse(tool, x, y);
    if (err) {
      this.emit({ t: 'sfx', n: 'error' });
      return { ok: false, msg: err };
    }
    const i = y * W + x;
    if (tool === 'inspect') return { ok: true, msg: '' };
    if (tool === 'demolish') {
      const b = this.bld[this.bmap[i]];
      const refund = Math.floor(this.costOf(BUILD_MAP[b.kind]) * 0.5);
      this.mats += refund;
      this.removeBuilding(b);
      this.emit({ t: 'text', x, y, s: `+${refund}⛏`, c: '#d9b38c' });
      this.emit({ t: 'burst', x, y, kind: 'smoke', n: 14 });
      this.emit({ t: 'sfx', n: 'demolish' });
      return { ok: true, msg: 'Demolished' };
    }
    if (tool === 'comet') {
      const c = this.cometCost();
      this.mats -= c.m; this.energy -= c.e; this.cometCd = 120;
      this.incoming.push({ id: this.nextId++, x, y, eta: 0.16, total: 0.16, size: 3, src: 'player' });
      this.emit({ t: 'sfx', n: 'comet' });
      this.emit({ t: 'toast', s: 'Comet inbound — clear the impact zone!', kind: 'warn' });
      return { ok: true, msg: 'Comet launched' };
    }
    if (tool === 'cloud') {
      this.energy -= 25;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H || Math.hypot(dx, dy) > 3.2) continue;
        this.seedT[yy * W + ((x + dx + W) % W)] = 90;
      }
      this.emit({ t: 'text', x, y, s: '-25⚡', c: '#ffd45e' });
      this.emit({ t: 'burst', x, y, kind: 'water', n: 16 });
      this.emit({ t: 'sfx', n: 'cloud' });
      return { ok: true, msg: 'Seeding clouds' };
    }
    if (tool === 'raise' || tool === 'lower') {
      this.mats -= 8;
      const sgn = tool === 'raise' ? 1 : -1;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        const j = yy * W + ((x + dx + W) % W);
        const w = dx === 0 && dy === 0 ? 1 : dx === 0 || dy === 0 ? 0.6 : 0.35;
        this.hgt[j] = clamp(this.hgt[j] + sgn * 0.06 * w, 0, 1.2);
      }
      this.emit({ t: 'burst', x, y, kind: 'smoke', n: 10 });
      this.emit({ t: 'sfx', n: 'build' });
      return { ok: true, msg: sgn > 0 ? 'Terrain raised' : 'Basin dug' };
    }
    if (tool === 'seed') {
      this.mats -= 8;
      this.seedLife(i, true);
      this.emit({ t: 'text', x, y, s: '🌱', c: '#7bff8a' });
      this.emit({ t: 'burst', x, y, kind: 'sparkle', n: 12 });
      this.emit({ t: 'sfx', n: 'seed' });
      return { ok: true, msg: 'Seeded' };
    }
    const def = BUILD_MAP[tool];
    const c = this.costOf(def);
    this.mats -= c;
    const b = this.addBuilding(def.id, x, y);
    this.stats.built++;
    if (def.id === 'geo') this.heat[i] = Math.max(this.heat[i], 14);
    if (def.id === 'dome') b.pop = Math.min(6, 6);
    if (def.id === 'settle') b.pop = 8;
    this.emit({ t: 'text', x, y, s: `-${c}⛏`, c: '#e7c9a0' });
    this.emit({ t: 'burst', x, y, kind: 'build', n: 14 });
    this.emit({ t: 'sfx', n: 'build' });
    return { ok: true, msg: `${def.name} built` };
  }

  seedLife(i: number, force = false) {
    const t = this.bestTier(i);
    if (t > 0 && this.vtier[i] === 0 && (force || this.wat[i] < 0.02)) {
      this.vtier[i] = t;
      this.veg[i] = 0.15;
    }
  }

  researchTech(id: string): { ok: boolean; msg: string } {
    const t = TECH_MAP[id];
    if (!t) return { ok: false, msg: 'Unknown tech' };
    if (this.techs.has(id)) return { ok: false, msg: 'Already researched' };
    if (!t.req.every((r) => this.techs.has(r))) return { ok: false, msg: 'Requires: ' + t.req.map((r) => TECH_MAP[r].name).join(', ') };
    if (this.research < t.cost) {
      this.emit({ t: 'sfx', n: 'error' });
      return { ok: false, msg: `Need ${t.cost} research` };
    }
    this.research -= t.cost;
    this.techs.add(id);
    this.stats.techs++;
    this.emit({ t: 'sfx', n: 'research' });
    this.emit({ t: 'burst', x: this.startX, y: this.startY, kind: 'sparkle', n: 18 });
    this.note(`Researched ${t.name}: ${t.desc}`, 'good');
    return { ok: true, msg: 'Researched' };
  }

  setMirror(v: number) {
    if (!this.has('mirror')) return;
    this.mirror = clamp(Math.round(v * 20) / 20, -0.5, 0.4);
  }

  canIntercept(): boolean { return this.has('lance') || (this.boss.state !== 'idle' && this.boss.state !== 'done' && this.boss.state !== 'warn'); }

  intercept(id: number): { ok: boolean; msg: string } {
    const inc = this.incoming.find((q) => q.id === id);
    if (!inc || inc.src === 'player') return { ok: false, msg: '' };
    if (!this.canIntercept()) return { ok: false, msg: 'Research Orbital Lance to intercept' };
    if (this.energy < 18) {
      this.emit({ t: 'sfx', n: 'error' });
      return { ok: false, msg: 'Need 18 energy' };
    }
    this.energy -= 18;
    this.incoming = this.incoming.filter((q) => q !== inc);
    this.stats.stopped++;
    this.emit({ t: 'burst', x: inc.x, y: inc.y, kind: 'lance', n: 22 });
    this.emit({ t: 'text', x: inc.x, y: inc.y, s: 'Intercepted!', c: '#8ff3ff' });
    this.emit({ t: 'sfx', n: 'lance' });
    this.emit({ t: 'shake', a: 0.15 });
    return { ok: true, msg: 'Intercepted' };
  }

  // ---------- core tick ----------
  addGas(g: GasKey, amt: number, label: string) {
    this.gas[g] = Math.max(0, this.gas[g] + amt);
    const k = g + '|' + label;
    this.acc[k] = (this.acc[k] ?? 0) + amt;
  }

  step() {
    if (this.ended) return;
    this.tick++;
    this.time += DT_Y;
    this.season = this.time % 1;
    this.eventMods();
    this.computeGlobals();
    this.thermal();
    this.hydro();
    this.life();
    this.fireStep();
    this.structures();
    this.colonies();
    this.eventsStep();
    this.bossStep();
    this.incomingStep();
    if (this.cometCd > 0) this.cometCd--;
    if (this.tick % 5 === 0) this.statsStep();
    if (this.tick % 40 === 0) this.sample();
    this.checkEnd();
  }

  computeGlobals() {
    const g = this.gas;
    this.P = g.n2 + g.co2 + g.o2 + g.pfc;
    this.pfG = clamp(0.35 + this.P / 90, 0.35, 1.4);
    this.windScale = clamp(0.25 + this.P / 80, 0.25, 1.2);
    this.greenhouse = this.pfG * (18 * Math.log(1 + g.co2 / 2) + 40 * Math.log(1 + 2 * g.pfc) + 16 * Math.min(1, this.humidity));
    const pF = clamp((this.P - 15) / 30, 0, 1);
    const o = g.o2;
    const oF = o < 10 ? 0 : o < 16 ? (o - 10) / 6 : o <= 30 ? 1 : clamp((50 - o) / 20, 0, 1);
    const cF = g.co2 <= 0.6 ? 1 : clamp((3.5 - g.co2) / 2.9, 0, 1);
    this.G = pF * oF * cF;
    this.fP = pF; this.fO = oF; this.fC = cF;
    this.solarMul = (1 + this.mirror) * (1 - 0.45 * this.dust);
    const dec = 0.4 * Math.sin(Math.PI * 2 * this.season);
    for (let y = 0; y < H; y++) {
      const phi = (0.5 - (y + 0.5) / H) * Math.PI;
      this.qRow[y] = Math.max(0.08, Math.cos(phi - dec));
      this.cosw[y] = Math.max(0.05, Math.cos(phi));
      this.windU[y] = -Math.cos(3 * phi);
      this.windV[y] = 0.3 * Math.sin(Math.PI * 2 * this.season) * Math.cos(phi);
    }
    g.pfc *= 1 - 0.012 * DT_Y;
  }

  albedo(i: number): number {
    const iceF = Math.min(1, this.ice[i] / 0.015);
    const watF = Math.min(1, this.wat[i] / 0.02);
    const vegF = Math.min(1, this.veg[i] * 1.2);
    let a = this.wd.rockAlb - this.soot[i] * 0.12;
    a = a * (1 - vegF) + 0.14 * vegF;
    a = a * (1 - watF) + 0.07 * watF;
    const ia = Math.max(0.18, 0.62 - 0.32 * this.soot[i] - 0.3 * this.dust);
    return a * (1 - iceF) + ia * iceF;
  }

  thermal() {
    const raw = this.scratchA;
    let sum = 0, ws = 0;
    for (let y = 0; y < H; y++) {
      const q = this.qRow[y] * this.wd.s0 * this.solarMul;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const absorb = Math.max(1e-4, q * (1 - this.albedo(i)) * (1 - 0.35 * Math.min(1, this.cld[i])));
        const r = 295.6 * Math.pow(absorb, 0.25) - 273.15;
        raw[i] = r;
        sum += r * this.cosw[y];
        ws += this.cosw[y];
      }
    }
    const mean = sum / ws;
    this.avgRaw = mean;
    const tr = clamp(0.12 + this.P / 100, 0.12, 0.8);
    const gh = this.greenhouse;
    for (let i = 0; i < N; i++) {
      let teq = raw[i] * (1 - tr) + mean * tr + gh - 14 * this.hgt[i] + this.heat[i] + this.tOff;
      teq = clamp(teq, -140, 220);
      const rate = this.wat[i] > 0.02 ? 0.012 : this.ice[i] > 0.02 ? 0.02 : 0.03;
      this.tmp[i] += (teq - this.tmp[i]) * rate;
      this.heat[i] *= 0.975;
      if (this.heat[i] < 0.05) this.heat[i] = 0;
    }
    // lateral diffusion
    const t2 = this.scratchB;
    const kd = 0.16 * clamp(this.P / 60, 0.15, 1);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const l = this.tmp[y * W + ((x + W - 1) % W)];
        const r = this.tmp[y * W + ((x + 1) % W)];
        const u = y > 0 ? this.tmp[i - W] : this.tmp[i];
        const d = y < H - 1 ? this.tmp[i + W] : this.tmp[i];
        t2[i] = this.tmp[i] + kd * ((l + r + u + d) / 4 - this.tmp[i]);
      }
    }
    this.tmp.set(t2);
    // vents keep local heat
    for (const v of this.ventList) this.heat[v] = Math.max(this.heat[v], this.bmap[v] >= 0 && this.bld[this.bmap[v]].kind === 'geo' ? 14 : 5);
  }

  hydro() {
    const evapMul = this.evapMul, rainMul = this.rainMul;
    for (let i = 0; i < N; i++) {
      const T = this.tmp[i];
      if (T < -80) continue;
      const d = sat(T) - this.vap[i];
      if (d <= 0) continue;
      if (this.wat[i] > 0.003 && this.ice[i] < 0.01 && T > -20) {
        const e = Math.min(this.wat[i] * 0.5, d * 0.06 * evapMul);
        this.wat[i] -= e; this.vap[i] += e;
      } else if (this.soil[i] > 0.001 && T > -15 && this.wat[i] < 0.003) {
        const e = Math.min(this.soil[i], d * 0.02 * evapMul * (1 + this.veg[i] * 1.5));
        this.soil[i] -= e; this.vap[i] += e;
      } else if (this.ice[i] > 0.0005 && T > -70) {
        const e = Math.min(this.ice[i], d * 0.005 * evapMul);
        this.ice[i] -= e; this.vap[i] += e;
      }
    }
    // advection (semi-Lagrangian, mass rescaled)
    const v2 = this.scratchC;
    const adv = 0.55 * this.windScale;
    let before = 0;
    for (let i = 0; i < N; i++) before += this.vap[i];
    for (let y = 0; y < H; y++) {
      const u = this.windU[y] * adv, v = this.windV[y] * adv;
      for (let x = 0; x < W; x++) {
        const sx = x - u, sy = clamp(y - v, 0, H - 1);
        const x0 = Math.floor(sx), fx = sx - x0, y0 = Math.floor(sy), fy = sy - y0;
        const xa = ((x0 % W) + W) % W, xb = (xa + 1) % W, y1 = Math.min(H - 1, y0 + 1);
        const a = this.vap[y0 * W + xa] * (1 - fx) + this.vap[y0 * W + xb] * fx;
        const b = this.vap[y1 * W + xa] * (1 - fx) + this.vap[y1 * W + xb] * fx;
        v2[y * W + x] = a * (1 - fy) + b * fy;
      }
    }
    let after = 0;
    for (let i = 0; i < N; i++) after += v2[i];
    const sc = after > 1e-9 ? before / after : 1;
    for (let i = 0; i < N; i++) this.vap[i] = v2[i] * sc;

    // precipitation
    for (let i = 0; i < N; i++) {
      const T = this.tmp[i];
      const x = i % W, y = (i / W) | 0;
      let s = sat(T);
      const u = this.windU[y];
      const ux = (x - (u > 0.05 ? 1 : u < -0.05 ? -1 : 0) + W) % W;
      const lift = Math.max(0, this.hgt[i] - this.hgt[y * W + ux]);
      s *= 1 - Math.min(0.5, lift * 6);
      if (this.seedT[i] > 0) { s *= 0.3; this.seedT[i]--; }
      const v = this.vap[i];
      if (v > s) {
        const p = (v - s) * 0.35 * rainMul;
        this.vap[i] -= p;
        this.rain[i] = this.rain[i] * 0.8 + p * 0.2;
        if (T > 0.2) {
          if (this.wat[i] > 0.003 || this.soil[i] >= SOIL_CAP - 1e-5) this.wat[i] += p;
          else {
            const f = Math.min(p, SOIL_CAP - this.soil[i]);
            this.soil[i] += f;
            this.wat[i] += p - f;
          }
          if (this.cld[i] > 1 && this.vtier[i] > 0 && this.gas.o2 > 14 && Math.random() < 0.00025) this.ignite(i);
        } else {
          this.ice[i] += p;
          this.soot[i] *= 0.996;
        }
      } else this.rain[i] *= 0.85;
      const target = Math.min(1.3, v / (s + 1e-6)) * clamp(v / 0.0004, 0, 1);
      this.cld[i] += (target - this.cld[i]) * 0.12;
    }

    // freeze / melt / infiltrate
    for (let i = 0; i < N; i++) {
      const T = this.tmp[i];
      if (T < -1 && this.wat[i] > 0) {
        const f = Math.min(this.wat[i], 0.00008 * Math.min(30, -T));
        this.wat[i] -= f; this.ice[i] += f; this.tmp[i] += f * 50;
      } else if (T > 0.5 && this.ice[i] > 0) {
        const m = Math.min(this.ice[i], 0.00012 * Math.min(T, 40) * (1 + this.soot[i]));
        this.ice[i] -= m; this.wat[i] += m; this.tmp[i] -= m * 40;
      }
      if (this.wat[i] > 0 && this.wat[i] < 0.05 && this.soil[i] < SOIL_CAP && T > 0) {
        const f = Math.min(this.wat[i], SOIL_CAP - this.soil[i], 0.0015);
        this.wat[i] -= f; this.soil[i] += f;
      }
      if (this.wat[i] < 0) this.wat[i] = 0;
    }
    this.flow();
    this.flow();
  }

  flow() {
    const d = this.scratchA;
    d.fill(0);
    const nb = [0, 0, 0, 0];
    const nf = [0, 0, 0, 0];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const w = this.wat[i];
        if (w < 0.0002) continue;
        const S = this.hgt[i] + w;
        nb[0] = y * W + ((x + W - 1) % W);
        nb[1] = y * W + ((x + 1) % W);
        nb[2] = y > 0 ? i - W : -1;
        nb[3] = y < H - 1 ? i + W : -1;
        let total = 0;
        for (let k = 0; k < 4; k++) {
          const n = nb[k];
          nf[k] = 0;
          if (n < 0) continue;
          const df = S - (this.hgt[n] + this.wat[n]);
          if (df > 0.0001) { nf[k] = df; total += df; }
        }
        if (total <= 0) continue;
        const move = Math.min(w * 0.5, total * 0.25);
        for (let k = 0; k < 4; k++) {
          if (nf[k] <= 0) continue;
          const sh = (move * nf[k]) / total;
          d[i] -= sh;
          d[nb[k]] += sh;
        }
      }
    }
    for (let i = 0; i < N; i++) this.wat[i] = Math.max(0, this.wat[i] + d[i]);
  }

  life() {
    let dco2 = 0, dO2 = 0;
    const maxT = this.maxTier();
    for (let i = 0; i < N; i++) {
      const t = this.vtier[i];
      if (t === 0) continue;
      const s = this.tierSuit(t, i);
      let dv = 0;
      if (this.wat[i] > 0.04) dv = -2 * DT_Y;
      else if (s > 0.12) dv = 0.35 * DT_Y * s * (1 - this.veg[i]);
      else dv = -0.5 * DT_Y * (1 - s / 0.12);
      const before = this.veg[i];
      this.veg[i] = clamp(before + dv, 0, 1);
      const real = this.veg[i] - before;
      if (real > 0) { dco2 -= real * KC; dO2 += real * KC * 0.9; }
      else { dco2 -= real * KC * 0.6; dO2 += real * KC * 0.5; }
      if (this.veg[i] < 0.01 && dv < 0) { this.vtier[i] = 0; this.veg[i] = 0; continue; }
      if (this.veg[i] > 0.7 && t < maxT && this.tierSuit(t + 1, i) > 0.55) { this.vtier[i] = t + 1; this.veg[i] = 0.3; continue; }
      if (s < 0.1 && this.veg[i] < 0.35 && t > 1 && this.tierSuit(t - 1, i) > 0.3) this.vtier[i] = t - 1;
      if (this.veg[i] > 0.4 && Math.random() < 0.012) {
        const x = i % W, y = (i / W) | 0;
        const nx = (x + Math.floor(Math.random() * 3) - 1 + W) % W;
        const ny = y + Math.floor(Math.random() * 3) - 1;
        if (ny >= 0 && ny < H) {
          const n = ny * W + nx;
          if (this.vtier[n] === 0 && this.wat[n] < 0.02) {
            for (let tt = t; tt >= 1; tt--) {
              if (this.tierSuit(tt, n) > 0.3) { this.vtier[n] = tt; this.veg[n] = 0.05; break; }
            }
          }
        }
      }
    }
    // net: plants consume CO2 and release O2; decay does the reverse (already signed above)
    if (dco2 !== 0) this.addGas('co2', dco2, 'Plants & decay');
    if (dO2 !== 0) this.addGas('o2', dO2, 'Plants & decay');
  }

  ignite(i: number) {
    if (this.fire[i] > 0 || this.vtier[i] === 0) return;
    this.fire[i] = this.has('fire') ? 14 : 24;
    this.emit({ t: 'burst', x: i % W, y: (i / W) | 0, kind: 'fire', n: 6 });
  }

  fireStep() {
    const fs = this.has('fire') ? 0.4 : 1;
    const o2f = clamp((this.gas.o2 - 12) / 10, 0, 1.5);
    let burned = 0;
    this.cnt.fire = 0;
    for (let i = 0; i < N; i++) {
      if (this.fire[i] === 0) continue;
      if (this.rain[i] > 0.00004 || this.wat[i] > 0.01) { this.fire[i] = 0; continue; }
      this.cnt.fire++;
      this.fire[i]--;
      const dv = Math.min(this.veg[i], 0.05);
      this.veg[i] -= dv;
      burned += dv * KC * 1.2;
      this.heat[i] = Math.min(40, this.heat[i] + 4);
      if (this.veg[i] <= 0.02) { this.veg[i] = 0; this.vtier[i] = 0; this.fire[i] = 0; continue; }
      const x = i % W, y = (i / W) | 0;
      const ns = [y * W + ((x + 1) % W), y * W + ((x + W - 1) % W), y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const n of ns) {
        if (n < 0 || this.fire[n] > 0 || this.vtier[n] === 0 || this.veg[n] < 0.1) continue;
        if (Math.random() < 0.05 * fs * o2f * (1 - (this.soil[n] / SOIL_CAP) * 0.7)) this.ignite(n);
      }
    }
    if (burned > 0) {
      this.addGas('co2', burned, 'Wildfires');
      this.addGas('o2', -burned * 0.8, 'Wildfires');
    }
  }

  structures() {
    const fusion = this.has('fusion') ? 1.5 : 1;
    let prod = 0, cons = 0, gens = 0;
    for (const b of this.bld) {
      const i = b.y * W + b.x;
      b.out = 0;
      if (b.kind === 'solar') {
        b.out = 10 * this.wd.s0 * this.solarMul * this.qRow[b.y] * (1 - 0.6 * Math.min(1, this.cld[i]));
        prod += b.out; gens++;
      } else if (b.kind === 'wind') {
        const spd = Math.abs(this.windU[b.y]) + 0.5 * Math.abs(this.windV[b.y]) + 0.15;
        b.out = 11 * spd * clamp(this.P / 55, 0.04, 1.5) * (0.7 + 0.6 * this.hgt[i]);
        prod += b.out; gens++;
      } else if (b.kind === 'geo') {
        b.out = 11; prod += 11; gens++;
        this.heat[i] = Math.max(this.heat[i], 14);
      }
      const def = BUILD_MAP[b.kind];
      if (def.energy > 0) cons += def.energy;
      if (b.kind === 'settle') cons += b.pop * 0.01;
    }
    cons += 60 * Math.abs(this.mirror);
    prod *= fusion * this.flareMul;
    this.prodEnergy = prod;
    this.consEnergy = cons;
    this.energyCap = 500 + 40 * gens;
    this.energy += (prod - cons) * DT_Y;
    let eff = 1;
    if (this.energy < 0) { this.energy = 0; eff = cons > 0 ? Math.min(1, prod / cons) : 1; }
    this.energy = Math.min(this.energy, this.energyCap);
    this.effPower = eff;
    this.netEnergy += (prod - cons - this.netEnergy) * 0.05;

    const rm = (1 + (this.has('adv') ? 0.3 : 0) + 0.1 * (this.cfg.perks.library ?? 0));
    const doomed: Building[] = [];
    let pfc = 0, scrub = 0, oxyC = 0, oxyR = 0, n2 = 0;
    for (const b of this.bld) {
      const i = b.y * W + b.x;
      const e = eff * DT_Y;
      switch (b.kind) {
        case 'mine': b.out = 4.5 * (0.5 + this.hgt[i]) * eff; this.mats += b.out * DT_Y; break;
        case 'lab': b.out = 4 * rm * eff; this.research += b.out * DT_Y; break;
        case 'pfc': pfc += 0.02 * e; b.out = 0.02 * eff; break;
        case 'scrub': {
          const x = Math.min(this.gas.co2 - scrub, 0.12 * e);
          if (x > 0) scrub += x;
          b.out = 0.12 * eff;
          break;
        }
        case 'oxy':
          if (this.gas.co2 - oxyC > 0.2) { const x = Math.min(this.gas.co2 - oxyC - 0.1, 0.1 * e); if (x > 0) oxyC += x; }
          else oxyR += 0.05 * e;
          b.out = 0.1 * eff;
          break;
        case 'n2x': n2 += 0.08 * e; b.out = 0.08 * eff; break;
        case 'pump': {
          const w = Math.min(this.aquifer, 0.6 * e);
          if (w > 0) { this.aquifer -= w; this.wat[i] += w; }
          b.out = 0.6 * eff;
          break;
        }
        case 'seeder':
          if (Math.random() < 0.05 * eff) {
            const a = Math.random() * 6.283, r = 1 + Math.random() * 2.2;
            const sx = (b.x + Math.round(Math.cos(a) * r) + W) % W, sy = b.y + Math.round(Math.sin(a) * r);
            if (sy >= 0 && sy < H) {
              const j = sy * W + sx;
              if (this.bmap[j] < 0 && this.vtier[j] === 0) {
                const t0 = this.vtier[j];
                this.seedLife(j);
                if (this.vtier[j] !== t0) this.emit({ t: 'burst', x: sx, y: sy, kind: 'sparkle', n: 3 });
              }
            }
          }
          break;
        case 'soot':
          for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
            const yy = b.y + dy;
            if (yy < 0 || yy >= H || Math.hypot(dx, dy) > 3.3) continue;
            const j = yy * W + ((b.x + dx + W) % W);
            this.soot[j] = Math.min(1, this.soot[j] + 0.004);
          }
          break;
        default: break;
      }
      // damage
      let dmg = 0;
      if (this.wat[i] > 0.06) dmg += 3;
      if (this.fire[i] > 0) dmg += 2;
      if (this.heat[i] > 45 && b.kind !== 'geo') dmg += 1.5;
      if (dmg > 0) {
        b.hp -= dmg;
        if (b.hp <= 0) doomed.push(b);
      } else if (b.hp < 100 && eff > 0.9) b.hp = Math.min(100, b.hp + 0.1);
    }
    if (pfc) this.addGas('pfc', pfc, 'Gas Works');
    if (scrub) this.addGas('co2', -scrub, 'Scrubbers');
    if (oxyC) { this.addGas('co2', -oxyC, 'Oxygenators'); this.addGas('o2', oxyC, 'Oxygenators'); }
    if (oxyR) this.addGas('o2', oxyR, 'Oxygenators');
    if (n2) this.addGas('n2', n2, 'N₂ Extractors');
    for (const b of doomed) this.destroy(b, this.wat[b.y * W + b.x] > 0.06 ? 'flooded' : 'burned');
    if (eff < 0.8 && this.tick % 120 === 0) this.note('Brownout! Structures are running below full power.', 'warn');
  }

  destroy(b: Building, why: string) {
    if (!this.bld.includes(b)) return;
    this.stats.lost++;
    const name = BUILD_MAP[b.kind].name;
    this.emit({ t: 'burst', x: b.x, y: b.y, kind: 'impact', n: 16 });
    this.emit({ t: 'text', x: b.x, y: b.y, s: `${name} ${why}`, c: '#ff7b6b' });
    this.emit({ t: 'sfx', n: 'demolish' });
    this.removeBuilding(b);
    this.note(`${name} at (${b.x},${b.y}) ${why}.`, 'bad');
  }

  localHab(i: number): number {
    if (this.wat[i] > 0.02) return 0;
    const t = this.tmp[i];
    const ts = t < 8 ? clamp((t + 10) / 18, 0, 1) : t > 26 ? clamp((46 - t) / 20, 0, 1) : 1;
    const ms = clamp((this.soil[i] / SOIL_CAP) * 1.2 + (this.wat[i] > 0.002 ? 0.4 : 0), 0, 1);
    return ts * (0.3 + 0.7 * ms) * (this.hgt[i] > 0.85 ? 0.6 : 1);
  }

  colonies() {
    const G = this.G;
    const frag = this.mods.has('fragile') ? 2 : 1;
    let pop = 0, cap = 0;
    const flare = this.flareMul < 0.9;
    const rad = this.boss.state === 'p3' || flare ? (1 - clamp(this.gas.o2 / 18, 0, 1) * 0.6) * (this.has('ward') ? 0.5 : 1) : 0;
    let best: Building | null = null, bestFree = 0;
    let resR = 0, resM = 0;
    const doomed: Building[] = [];
    for (const b of this.bld) {
      if (b.kind !== 'dome' && b.kind !== 'settle') continue;
      const i = b.y * W + b.x;
      const local = this.localHab(i);
      let eff: number, capB: number;
      if (b.kind === 'dome') {
        eff = Math.max(local * G, 0.65 * this.effPower);
        capB = 30;
        b.food = 1;
      } else {
        eff = local * G;
        let supply = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const yy = b.y + dy;
          if (yy < 0 || yy >= H || Math.hypot(dx, dy) > 3.3) continue;
          const j = yy * W + ((b.x + dx + W) % W);
          supply += TIERS[this.vtier[j]].food * this.veg[j];
        }
        b.food = clamp(supply / (b.pop / 18 + 0.5), 0, 1.5);
        capB = 300 * clamp(eff, 0, 1);
      }
      b.eff = eff;
      let dp = 0;
      if (eff >= 0.45) dp += b.pop * 0.35 * eff * (1 - b.pop / Math.max(capB, 1)) * DT_Y;
      if (eff < 0.3) dp -= b.pop * (0.3 - eff) * 2.5 * frag * DT_Y;
      if (b.kind === 'settle' && b.food < 0.7) dp -= b.pop * (0.7 - Math.min(b.food, 0.7)) * 1.2 * frag * DT_Y;
      if (b.pop > capB) dp -= (b.pop - capB) * 0.5 * DT_Y;
      if (rad > 0 && b.kind === 'settle') dp -= b.pop * rad * 0.35 * DT_Y;
      b.pop = Math.max(0, b.pop + dp);
      if (b.pop < 0.01) b.pop = 0;
      pop += b.pop;
      cap += capB;
      resR += b.pop * 0.02 + (b.kind === 'dome' ? 0.6 : 0);
      resM += b.pop * 0.015 + (b.kind === 'dome' ? 1.5 : 0);
      if (b.pop < capB * 0.95 && eff >= 0.5 && capB - b.pop > bestFree) { best = b; bestFree = capB - b.pop; }
      if (b.kind === 'settle' && b.pop <= 0 && eff < 0.2 && b.hp > 0 && this.tick % 200 === 0) { b.hp -= 30; if (b.hp <= 0) doomed.push(b); }
    }
    this.immigration = (0.6 + 10 * this.H) * (pop > 0 ? 1 : 0.3);
    if (best) best.pop += this.immigration * DT_Y;
    const rm = 1 + (this.has('adv') ? 0.3 : 0) + 0.1 * (this.cfg.perks.library ?? 0);
    this.research += resR * rm * DT_Y;
    this.mats += resM * DT_Y;
    this.pop = pop;
    this.popCap = cap;
    this.stats.peakPop = Math.max(this.stats.peakPop, pop);
    for (const b of doomed) this.destroy(b, 'abandoned');
  }

  // ---------- statistics ----------
  classify(i: number): number {
    const w = this.wat[i];
    if (this.ice[i] > 0.02) return 2;
    if (w > 0.03) return w > 0.12 ? 0 : 1;
    const t = this.vtier[i], v = this.veg[i];
    if (this.tmp[i] > 75 && v < 0.1) return 13;
    if (t > 0 && v > 0.12) {
      if (w > 0.004) return 12;
      return 5 + t;
    }
    if (this.hgt[i] > 0.8) return 3;
    const sf = this.soil[i] / SOIL_CAP;
    if (this.tmp[i] < -5) return 4;
    if (sf < 0.12 && this.tmp[i] > 8) return 5;
    return 3;
  }

  statsStep() {
    let tsum = 0, ws = 0, sv = 0, ss = 0;
    const c = this.cnt;
    c.veg = 0; c.rain = 0; c.water = 0; c.forest = 0; c.land = 0; c.ice = 0; c.hab = 0; c.ocean = 0;
    this.biomeCount.fill(0);
    this.inv = { ocean: 0, ice: 0, vap: 0, soil: 0 };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        tsum += this.tmp[i] * this.cosw[y];
        ws += this.cosw[y];
        sv += this.vap[i];
        ss += sat(this.tmp[i]);
        const b = this.classify(i);
        this.biome[i] = b;
        this.biomeCount[b]++;
        if (b === 0 || b === 1) c.ocean++;
        if (this.wat[i] > 0.01) c.water++;
        if (this.rain[i] > 0.00004) c.rain++;
        if (this.vtier[i] > 0 && this.veg[i] > 0.15) c.veg++;
        if (this.vtier[i] >= 5 && this.veg[i] > 0.3) c.forest++;
        if (this.ice[i] > 0.02) c.ice++;
        this.inv.ocean += this.wat[i]; this.inv.ice += this.ice[i]; this.inv.vap += this.vap[i]; this.inv.soil += this.soil[i];
        const isLand = this.wat[i] <= 0.02;
        const lh = this.localHab(i);
        this.hab[i] = lh * this.G;
        if (isLand) {
          c.land++;
          if (lh >= 0.45) c.hab++;
        }
      }
    }
    this.avgT = tsum / ws;
    this.humidity = ss > 0 ? sv / ss : 0;
    c.biomes = this.biomeCount.filter((n, k) => n >= 10 && k !== 0).length;
    const hf = c.land > 0 ? c.hab / c.land : 0;
    this.H = this.G * Math.min(1, hf / 0.5);
    this.stats.peakH = Math.max(this.stats.peakH, this.H);
    this.stats.maxTemp = Math.max(this.stats.maxTemp, this.avgT);
    let st = 0;
    STAGES.forEach((s, k) => { if (this.H >= s.min) st = k; });
    if (st > this.stage) {
      this.emit({ t: 'sfx', n: 'stage' });
      this.note(`Stage ${st}: ${STAGES[st].name}! Habitability ${(this.H * 100).toFixed(0)}%.`, 'good');
      this.emit({ t: 'flash', c: STAGES[st].color });
    }
    this.stage = st;
    this.checkMilestones();
  }

  relevant(id: string): boolean {
    if (id === 'veil') return this.wd.n2 + this.wd.co2 < 15;
    if (id === 'thaw') return this.wd.startT < -30;
    if (id === 'frost') return this.wd.startT < 0;
    return true;
  }

  award(id: string) {
    if (this.milestones.has(id)) return;
    this.milestones.add(id);
    const m = MILESTONES.find((q) => q.id === id);
    if (!m) return;
    this.research += m.rewardR;
    this.mats += m.rewardM;
    const rw = [m.rewardR ? `+${m.rewardR}🔬` : '', m.rewardM ? `+${m.rewardM}⛏` : ''].filter(Boolean).join(' ');
    this.emit({ t: 'sfx', n: 'milestone' });
    this.emit({ t: 'text', x: this.startX, y: this.startY - 1, s: `★ ${m.name}`, c: '#ffe27a' });
    this.note(`Milestone: ${m.name}${rw ? ' (' + rw + ')' : ''}`, 'good');
  }

  checkMilestones() {
    const c = this.cnt;
    const startP = this.wd.n2 + this.wd.co2;
    if (this.P >= 15 && startP < 15) this.award('veil');
    if (this.avgT >= -30 && this.wd.startT < -30) this.award('thaw');
    if (c.rain >= 15) this.award('rain');
    if (c.water >= 40) this.award('water');
    if (c.veg >= 40) this.award('green');
    if (this.avgT >= 0 && this.wd.startT < 0) this.award('frost');
    if (this.gas.o2 >= 12) this.award('air');
    if (c.biomes >= 6) this.award('bio');
    if (this.pop >= 100) this.award('settlers');
    if (c.forest >= 30) this.award('canopy');
    if (this.pop >= 300) this.award('hearths');
    if (this.H >= 0.6) this.award('garden');
    if (this.reckoningDone) this.award('reckoning');
  }

  sample() {
    // rolling flow ledger
    for (const k of Object.keys(this.acc)) {
      this.flows[k] = this.acc[k] / 0.5;
      this.acc[k] = 0;
    }
    this.history.push({
      y: this.time, T: this.avgT, P: this.P, co2: this.gas.co2, o2: this.gas.o2, n2: this.gas.n2, pfc: this.gas.pfc, H: this.H, pop: this.pop,
    });
    if (this.history.length > 260) this.history.shift();
  }

  // ---------- events ----------
  eventMods() {
    this.evapMul = 1; this.rainMul = 1; this.flareMul = 1;
    let target = 0;
    for (const ev of this.events) {
      if (ev.phase !== 'active') continue;
      switch (ev.kind) {
        case 'dust': this.dust += (1 - this.dust) * 0.012; break;
        case 'drought': this.evapMul = 1.8; this.rainMul = 0.35; break;
        case 'thermal': target += ev.variant === 0 ? 14 : -15; break;
        case 'flare': this.flareMul = this.has('ward') ? 0.5 : 0.2; break;
        case 'deluge':
          for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
            const yy = ev.y + dy;
            if (yy < 0 || yy >= H) continue;
            const dd = Math.hypot(dx, dy);
            if (dd > 6) continue;
            const j = yy * W + ((ev.x + dx + W) % W);
            if (this.tmp[j] > -10) this.vap[j] += 0.00025 * (1 - dd / 7);
          }
          break;
        default: break;
      }
    }
    if (this.boss.state === 'p2') { target += -18; this.dust += (0.85 - this.dust) * 0.01; }
    if (this.boss.state === 'p3') this.flareMul = Math.min(this.flareMul, this.has('ward') ? 0.35 : 0.15);
    this.tOffTarget = target;
    this.tOff += (this.tOffTarget - this.tOff) * 0.03;
    this.dust *= 0.9985;
    if (this.dust < 0.002) this.dust = 0;
    // radiation stress on plants
    if (this.flareMul < 0.9) {
      const stress = (1 - clamp(this.gas.o2 / 18, 0, 1) * 0.6) * (this.has('ward') ? 0.5 : 1);
      for (let i = 0; i < N; i++) if (this.vtier[i] > 0) this.veg[i] *= 1 - 0.002 * stress;
    }
  }

  pickTarget(): { x: number; y: number } {
    if (this.bld.length > 0 && Math.random() < 0.55) {
      const b = this.bld[Math.floor(Math.random() * this.bld.length)];
      return { x: b.x, y: b.y };
    }
    return { x: Math.floor(Math.random() * W), y: 2 + Math.floor(Math.random() * (H - 4)) };
  }

  spawnEvent() {
    const veg = this.cnt.veg;
    const opts: [EventKind, number][] = [
      ['dust', 2], ['volcano', 1.5], ['thermal', 2], ['meteor', 1.5], ['flare', 1],
    ];
    if (this.time > 12) opts.push(['deluge', 1.2]);
    if (veg >= 10 && this.gas.o2 > 10) opts.push(['wildfire', 2]);
    if (this.time > 15) opts.push(['drought', 1]);
    const filtered = opts.filter(([k]) => !this.events.some((e) => e.kind === k && e.alive));
    const pool = filtered.length ? filtered : opts;
    let tot = 0;
    pool.forEach(([, w]) => { tot += w; });
    let r = Math.random() * tot, kind: EventKind = pool[0][0];
    for (const [k, w] of pool) { r -= w; if (r <= 0) { kind = k; break; } }
    let x = Math.floor(Math.random() * W), y = 3 + Math.floor(Math.random() * (H - 6));
    if (kind === 'volcano') {
      const v = this.ventList[Math.floor(Math.random() * this.ventList.length)];
      if (v !== undefined) { x = v % W; y = Math.floor(v / W); }
    }
    if (kind === 'wildfire' && veg > 0) {
      for (let k = 0; k < 200; k++) {
        const i = Math.floor(Math.random() * N);
        if (this.vtier[i] > 0) { x = i % W; y = (i / W) | 0; break; }
      }
    }
    const info = EVENT_INFO[kind];
    const ev: GameEvent = {
      id: this.nextId++, kind, phase: 'warn', t: this.warnTime(), dur: info.dur, x, y,
      r: kind === 'deluge' ? 6 : kind === 'volcano' ? 3 : 0, variant: Math.random() < 0.5 ? 0 : 1, alive: true,
    };
    this.events.push(ev);
    this.emit({ t: 'sfx', n: 'warn' });
    this.note(`Forecast: ${this.eventName(ev)} in ~${Math.ceil(ev.t)} years.`, 'warn');
  }

  eventName(ev: GameEvent): string {
    if (ev.kind === 'thermal') return ev.variant === 0 ? 'Heat Wave' : 'Cold Snap';
    return EVENT_INFO[ev.kind].name;
  }

  activate(ev: GameEvent) {
    ev.phase = 'active';
    ev.t = ev.dur;
    this.stats.events++;
    this.note(`${this.eventName(ev)} has begun!`, 'bad');
    switch (ev.kind) {
      case 'volcano': {
        this.addGas('co2', 1.5 + Math.random() * 2.5, 'Volcanoes');
        this.dust = Math.min(1, this.dust + 0.4);
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const yy = ev.y + dy;
          if (yy < 0 || yy >= H) continue;
          const dd = Math.hypot(dx, dy);
          if (dd > 3.2) continue;
          const j = yy * W + ((ev.x + dx + W) % W);
          this.heat[j] += 45 * (1 - dd / 4);
          if (dd <= 2 && this.bmap[j] >= 0) this.destroy(this.bld[this.bmap[j]], 'buried in lava');
          if (this.vtier[j] > 0) { if (dd <= 1.5) { this.vtier[j] = 0; this.veg[j] = 0; } else if (Math.random() < 0.5) this.ignite(j); }
        }
        this.emit({ t: 'burst', x: ev.x, y: ev.y, kind: 'impact', n: 40 });
        this.emit({ t: 'burst', x: ev.x, y: ev.y, kind: 'smoke', n: 30 });
        this.emit({ t: 'shake', a: 0.9 });
        this.emit({ t: 'sfx', n: 'rumble' });
        this.emit({ t: 'flash', c: '#ff6a2a' });
        break;
      }
      case 'wildfire': {
        let n = 0;
        const around = this.findNear(ev.x, ev.y, 6, (i) => this.vtier[i] > 0 && this.veg[i] > 0.1);
        if (around >= 0) {
          const ax = around % W, ay = (around / W) | 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const yy = ay + dy;
            if (yy < 0 || yy >= H) continue;
            const j = yy * W + ((ax + dx + W) % W);
            if (this.vtier[j] > 0 && n < 5 && Math.random() < 0.6) { this.ignite(j); n++; }
          }
        }
        if (n === 0) this.note('The fire fizzled: nothing to burn.', 'info');
        ev.t = 0.05;
        this.emit({ t: 'sfx', n: 'fire' });
        break;
      }
      case 'meteor': {
        const n = 3 + Math.floor(Math.random() * 3) + (this.time > 40 ? 1 : 0);
        for (let k = 0; k < n; k++) {
          const t = this.pickTarget();
          const eta = 1.4 + Math.random() * 2.4;
          this.incoming.push({ id: this.nextId++, x: t.x, y: t.y, eta, total: eta, size: 1, src: 'meteor' });
        }
        ev.t = 0.05;
        this.emit({ t: 'sfx', n: 'alarm' });
        break;
      }
      case 'flare':
        this.emit({ t: 'flash', c: '#fff2a0' });
        this.emit({ t: 'sfx', n: 'alarm' });
        break;
      case 'deluge': case 'dust': case 'drought': case 'thermal':
        this.emit({ t: 'sfx', n: 'rumble' });
        break;
      default: break;
    }
  }

  eventsStep() {
    this.nextEventIn -= DT_Y;
    if (this.nextEventIn <= 0 && this.time > 5) {
      const rate = this.diff.events * (this.mods.has('volatile') ? 1.8 : 1) * (1 + this.time / 150);
      this.spawnEvent();
      this.nextEventIn = (13 / rate) * (0.7 + Math.random() * 0.6);
    }
    for (const ev of this.events) {
      ev.t -= DT_Y;
      if (ev.t <= 0) {
        if (ev.phase === 'warn') this.activate(ev);
        else {
          ev.alive = false;
          if (ev.dur > 0.5) this.note(`${this.eventName(ev)} has ended.`, 'info', false);
        }
      }
    }
    this.events = this.events.filter((e) => e.alive);
  }

  // ---------- the Reckoning (boss) ----------
  bossStep() {
    const b = this.boss;
    if (this.continued && b.state === 'idle') return;
    if (b.state === 'idle') {
      if (this.time >= 12 && (this.H >= 0.45 || this.time >= this.charter * 0.45)) {
        b.state = 'warn'; b.t = 6; b.dur = 6;
        this.emit({ t: 'sfx', n: 'alarm' });
        this.emit({ t: 'flash', c: '#ff3b3b' });
        this.note('THE RECKONING approaches: a rogue comet swarm, an impact winter and a superflare. Prepare!', 'bad');
      }
      return;
    }
    b.t -= DT_Y;
    if (b.state === 'warn' && b.t <= 0) {
      b.state = 'p1'; b.t = 7; b.dur = 7;
      b.total = this.diff.fragments;
      b.spawnLeft = b.total;
      b.spawnTimer = 0;
      this.note('Phase 1 — Fragment Storm! Click the red reticles to intercept with the Orbital Lance (18⚡).', 'bad');
      this.emit({ t: 'sfx', n: 'alarm' });
    } else if (b.state === 'p1') {
      b.spawnTimer -= DT_Y;
      if (b.spawnLeft > 0 && b.spawnTimer <= 0) {
        const t = this.pickTarget();
        this.incoming.push({ id: this.nextId++, x: t.x, y: t.y, eta: 2.6, total: 2.6, size: 2, src: 'boss' });
        b.spawnLeft--;
        b.spawnTimer = b.dur / (b.total + 1);
        this.emit({ t: 'sfx', n: 'warn' });
      }
      if (b.t <= 0 && b.spawnLeft <= 0 && !this.incoming.some((q) => q.src === 'boss')) {
        b.state = 'p2'; b.t = 6; b.dur = 6;
        this.note('Phase 2 — Impact Winter. Dust chokes the sky; keep your colonies warm and powered.', 'bad');
        this.emit({ t: 'flash', c: '#7a8aa8' });
        this.emit({ t: 'sfx', n: 'rumble' });
      }
    } else if (b.state === 'p2' && b.t <= 0) {
      b.state = 'p3'; b.t = 3; b.dur = 3;
      this.note('Phase 3 — Superflare! Power collapses and radiation stalks the open air.', 'bad');
      this.emit({ t: 'flash', c: '#fff2a0' });
      this.emit({ t: 'sfx', n: 'alarm' });
    } else if (b.state === 'p3' && b.t <= 0) {
      b.state = 'done';
      this.reckoningDone = true;
      this.note('The Reckoning has been survived! The world endures.', 'good');
      this.emit({ t: 'sfx', n: 'stage' });
      this.emit({ t: 'flash', c: '#7cf3ff' });
      this.award('reckoning');
    }
  }

  incomingStep() {
    if (this.incoming.length === 0) return;
    const keep: Incoming[] = [];
    for (const inc of this.incoming) {
      inc.eta -= DT_Y;
      if (inc.eta <= 0) this.impact(inc);
      else keep.push(inc);
    }
    this.incoming = this.incoming.filter((q) => keep.includes(q));
  }

  impact(inc: Incoming) {
    const { x, y } = inc;
    const player = inc.src === 'player';
    const r = player ? 2.2 : inc.size === 2 ? 2.2 : 1.2;
    if (!player) this.stats.hit++;
    else this.stats.comets++;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const yy = y + dy;
      if (yy < 0 || yy >= H) continue;
      const dd = Math.hypot(dx, dy);
      if (dd > r + 1.5) continue;
      const j = yy * W + ((x + dx + W) % W);
      if (dd <= r && this.bmap[j] >= 0) this.destroy(this.bld[this.bmap[j]], 'was vaporized');
      if (dd <= r + 1) { this.heat[j] += (player ? 60 : 35) * (1 - dd / (r + 2)); if (dd <= r) { this.vtier[j] = 0; this.veg[j] = 0; this.fire[j] = 0; } }
      if (dd <= 1.6) this.hgt[j] = Math.max(0, this.hgt[j] - 0.06 * (1 - dd / 2));
    }
    if (player) {
      this.addGas('n2', 6, 'Comets');
      this.addGas('co2', 0.8, 'Comets');
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        this.wat[yy * W + ((x + dx + W) % W)] += 8 / 9;
        c++;
      }
      void c;
      this.emit({ t: 'text', x, y, s: '+6 kPa N₂  +8 💧', c: '#9fe8ff' });
    } else {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const yy = y + dy;
        if (yy < 0 || yy >= H) continue;
        this.wat[yy * W + ((x + dx + W) % W)] += 0.12 * inc.size;
      }
      this.dust = Math.min(1, this.dust + 0.08 * inc.size);
      this.note(`Impact at (${x},${y})!`, 'bad', false);
    }
    this.emit({ t: 'burst', x, y, kind: 'impact', n: player ? 60 : 30 });
    this.emit({ t: 'burst', x, y, kind: 'smoke', n: 20 });
    this.emit({ t: 'shake', a: player ? 1 : 0.55 });
    this.emit({ t: 'flash', c: player ? '#bfe9ff' : '#ff8a4a' });
    this.emit({ t: 'sfx', n: 'impact' });
  }

  // ---------- victory / defeat ----------
  checkEnd() {
    if (this.ended) return;
    const totalPop = this.pop;
    if (this.tick > 50 && totalPop < 0.5) {
      this.ended = { win: false, reason: 'The last colonist is gone. The world remains silent.' };
      return;
    }
    if (this.time >= this.charter) {
      this.ended = { win: false, reason: `The ${this.charter}-year charter has expired before the world was certified habitable.` };
      return;
    }
    if (!this.won && !this.continued) {
      if (this.reckoningDone && this.H >= this.diff.winH && this.pop >= this.diff.popGoal) {
        this.holdT += DT_Y;
        if (this.holdT >= this.holdYears) {
          this.won = true;
          this.award('cert');
          this.ended = { win: true, reason: 'The world has been certified habitable. A new home blooms under a living sky.' };
        }
      } else this.holdT = Math.max(0, this.holdT - DT_Y * 2);
    }
  }

  computeScore(): number {
    return Math.floor(this.stats.peakH * 1000 + this.stats.peakPop * 2 + this.milestones.size * 150 + (this.won ? 2000 + Math.max(0, this.charter - this.time) * 20 : 0));
  }

  lpEarned(): number {
    let mult = this.diff.lp;
    for (const m of this.mods) mult *= m === 'volatile' ? 1.3 : m === 'thin' ? 1.25 : m === 'short' ? 1.3 : 1.25;
    const base = this.milestones.size * 1.2 + this.stats.peakH * 18 + this.stats.peakPop / 60 + (this.won ? 30 : 0) + this.stage * 2;
    return Math.max(1, Math.floor(base * mult));
  }

  continueAfterWin() {
    this.ended = null;
    this.continued = true;
    this.charter = Math.max(this.charter, this.time + 60);
  }

  atmoLabel(): string {
    return `${this.P.toFixed(1)} kPa`;
  }
}
