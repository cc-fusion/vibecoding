import {
  W, H, TILE, MONTH_LEN, START_YEAR, CATCH, BASE_TRACK, T_WATER, T_MOUNT, T_HILL,
  TERRAIN_COST, TERRAIN_SPEED, CARGOS, CARGO_INFO, LOCOS, TECHS, DIFFS, MODS, RIVALS, COMPANY_COLORS, SABOTAGE, SEASONS,
  type Cargo, type LocoDef, type DiffDef, type RivalDef,
} from './data';
import { DX, DY, BIT, OPP, emptyStore, generateWorld, type Town, type Industry, type Packet, type CargoStore } from './world';
import { audio } from './audio';
import { loadMeta, saveMeta } from './store';
import { aiThink } from './ai';

export const STATION_COST = 800;
export const DEPOT_COST = 1800;
export const PLATFORM_COST = 1500;
export const DIV_POLICY = [0, 0.25, 0.5, 0.75];
const TRAIN_NAMES = ['Prairie Belle', 'Iron Mary', 'Thunderhead', 'Golden Gate', 'Old Faithful', 'Lone Star', 'Black Hawk', 'Silver Streak', 'Westward Ho', 'Dust Devil', 'Copper Queen', 'Bison', 'Calamity', 'Sidewinder', 'Rattler', 'Manifest Destiny'];

export interface Stop { st: number; order: 'any' | 'full' | 'drop'; dwell: number }
export type TrainState = 'idle' | 'moving' | 'queue' | 'loading' | 'broken' | 'stuck';
export interface Train {
  id: number; owner: number; loco: string; name: string; sched: Stop[]; si: number; path: number[]; pi: number; f: number;
  state: TrainState; timer: number; cargo: CargoStore; load: number; wear: number; earned: number; trips: number;
  retry: number; ang: number; held: number; haltUntil: number; wanted: Cargo[]; lastPay: number; bornT: number; slow: boolean;
}
export interface Station {
  id: number; owner: number; name: string; x: number; y: number; tile: number; cargo: CargoStore; platforms: number; occ: number;
  depot: boolean; closedUntil: number; lastPickup: number; lastSpeed: number; waiting: number;
}
export interface Company {
  id: number; name: string; color: string; isPlayer: boolean; alive: boolean; cash: number; loan: number; price: number; shares: number;
  sent: number; monthRev: number; monthExp: number; profitEma: number; totalRev: number; div: number; security: number; nextThink: number;
  routes: { a: number; b: number }[]; failed: Set<string>; nwHist: number[]; priceHist: number[]; spikeDone: boolean; grudge: number;
  lastIssue: number; nw: number; tiles: number; def?: RivalDef; trainsN: number; stationsN: number; netProfit: number; revHist: number[];
}
export interface NewsItem { t: number; text: string; kind: 'good' | 'bad' | 'info' | 'warn'; date: string }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'smoke' | 'spark' | 'snow' | 'coin' | 'ring' }
export interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; big: boolean }
export interface Zone { kind: 'blizzard' | 'flood' | 'fire' | 'boom'; x: number; y: number; r: number; until: number; start: number }
export interface Ruin { i: number; mask: number; owner: number; t: number }
export interface Contract {
  id: number; cargo: Cargo; qty: number; got: number; sinkKind: 'town' | 'ind'; sinkId: number; sinkName: string; reward: number; penalty: number;
  deadline: number; offerUntil: number; active: boolean;
}
export interface Stats {
  delivered: number; revenue: number; tracks: number; contracts: number; contractsFailed: number; sabotageDone: number; sabotageHit: number;
  absorbed: number; peakWorth: number; trainsBought: number; caught: number; events: number; stockProfit: number;
}
export interface OverState { result: 'win' | 'lose'; title: string; text: string; lp: number; score: number; rank: number; stats: Stats; years: number; worth: number; spike: boolean }

export interface TutStep { text: string; hint: string }
export const TUT_STEPS: TutStep[] = [
  { hint: 'Look around', text: 'Welcome, Baron! Drag the map with the mouse (or WASD / arrow keys) and scroll to zoom. Your rivals are asleep for now. Move the camera to continue.' },
  { hint: 'Build a station', text: 'Pick the Station tool (B) in the Build tab, then click next to a glowing town. Stations collect cargo from everything within 3 tiles.' },
  { hint: 'Second station', text: 'Build a second station beside the other glowing town. Distance pays: revenue scales with how far cargo travels.' },
  { hint: 'Lay track', text: 'Choose the Track tool (T). Click one station, move the mouse to preview the path & cost, then click the other station. Click once more to confirm. Mountains and rivers cost a fortune!' },
  { hint: 'Buy a train', text: 'Open the Trains tab, pick a locomotive and your two stations, then buy it. The schedule is created for you and you can edit it later.' },
  { hint: 'First delivery', text: 'Watch the train run. Use Space to pause and 1-3 to change speed. Wait for your first delivery payout.' },
  { hint: 'Visit the Market', text: 'Open the Market tab. Here you borrow cash, issue shares, collect dividends, buy rival stock and can even take rivals over by owning more than half.' },
  { hint: 'Know your rivals', text: 'Open the Rivals tab. Sabotage is cheap but risky: get caught and your notoriety soars. Security guards protect you from their tricks.' },
  { hint: 'The goal', text: 'Link Pacific Landing to Atlantic Harbor before Vandermoor drives the Golden Spike, and finish 1880 as the richest baron. Contracts, Research and the Ledger will help. Rivals awaken now. Good luck!' },
];

export interface GameOpts { seed: number; diffId: string; mods: string[]; name: string; tutorial: boolean }

export class Game {
  seed: number;
  diff: DiffDef;
  mods: Set<string>;
  endYear: number;
  terr: Uint8Array;
  trk = new Uint8Array(W * H);
  own = new Int8Array(W * H).fill(-1);
  stAt = new Int16Array(W * H).fill(-1);
  towns: Town[];
  inds: Industry[];
  stations: Station[] = [];
  stMap = new Map<number, Station>();
  trains: Train[] = [];
  companies: Company[] = [];
  hold: Record<number, Record<number, number>> = {};
  news: NewsItem[] = [];
  contracts: Contract[] = [];
  zones: Zone[] = [];
  ruins: Ruin[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  techs = new Set<string>();
  research: { id: string; left: number; total: number } | null = null;
  perks: Record<string, number>;
  t = 0;
  monthCount = 0;
  monthAcc = 0;
  marketAcc = 0;
  histAcc = 0;
  spikeAcc = 0;
  tutAcc = 0;
  nextEvent = 45;
  nextContract = 8;
  notoriety = 0;
  rep = 40;
  negMonths = 0;
  shake = 0;
  over: OverState | null = null;
  spike: { by: number; t: number } | null = null;
  tut: { on: boolean; step: number; done: boolean };
  flags: Record<string, boolean> = {};
  tutPair: number[] = [];
  stats: Stats = { delivered: 0, revenue: 0, tracks: 0, contracts: 0, contractsFailed: 0, sabotageDone: 0, sabotageHit: 0, absorbed: 0, peakWorth: 0, trainsBought: 0, caught: 0, events: 0, stockProfit: 0 };
  idc = 1;
  private bfsPrev = new Int32Array(W * H);
  panicUntil = 0;
  grantUntil = 0;
  freeplay = false;
  rewarded = false;
  intensity = 0.2;

  constructor(o: GameOpts) {
    this.seed = o.seed;
    this.diff = DIFFS.find((d) => d.id === o.diffId) || DIFFS[1];
    this.mods = new Set(o.mods);
    this.endYear = START_YEAR + (this.mods.has('short') ? 10 : 15);
    const w = generateWorld(o.seed);
    this.terr = w.terr; this.towns = w.towns; this.inds = w.inds;
    this.perks = loadMeta().perks;
    const pk = (id: string) => this.perks[id] || 0;
    // companies
    let cash = this.diff.cash * (1 + 0.08 * pk('grant'));
    if (this.mods.has('shoestring')) cash *= 0.6;
    const mk = (id: number, name: string, c: number, def?: RivalDef): Company => ({
      id, name, color: COMPANY_COLORS[id], isPlayer: id === 0, alive: true, cash: c, loan: 0, price: 20, shares: 1000, sent: 1, monthRev: 0, monthExp: 0, profitEma: 0, totalRev: 0,
      div: id === 0 ? 0 : 1, security: id === 0 ? pk('guards') : (def?.boss ? 2 : id === 2 ? 1 : 0), nextThink: 25 + id * 7, routes: [], failed: new Set(), nwHist: [], priceHist: [], spikeDone: false, grudge: 0, lastIssue: -99, nw: c, tiles: 0, def, trainsN: 0, stationsN: 0, netProfit: 0, revHist: [],
    });
    this.companies.push(mk(0, o.name || 'Frontier & Western', cash));
    RIVALS.forEach((d, i) => this.companies.push(mk(i + 1, d.name, this.diff.aiCash * (d.boss ? 1.2 : 1), d)));
    this.hold[0] = { 0: 700, [-1]: 300 };
    for (let i = 1; i < 4; i++) this.hold[i] = { [i]: 400, [-1]: 600 };
    this.companies[0].sent = 1 + 0.04 * pk('broker');
    this.rep = 40 + 10 * pk('rep');
    if (pk('surveyors') >= 1) this.techs.add('survey');
    if (pk('surveyors') >= 2) this.techs.add('tunnel');
    this.companies.forEach((c) => { c.price = this.targetPrice(c); c.priceHist.push(c.price); });
    this.tut = { on: o.tutorial, step: 0, done: !o.tutorial };
    if (o.tutorial) {
      this.companies[0].cash = Math.max(cash, 60000);
      const sorted = [...this.towns].sort((a, b) => a.x - b.x);
      const t0 = sorted[0];
      const near = sorted.slice(1, 5).sort((a, b) => Math.abs(a.x - t0.x) + Math.abs(a.y - t0.y) - (Math.abs(b.x - t0.x) + Math.abs(b.y - t0.y)))[0];
      this.tutPair = [t0.id, near.id];
      this.companies.forEach((c, i) => { if (i > 0) c.nextThink = 1e9; });
      this.nextEvent = 1e9;
    }
    this.addNews(`${START_YEAR}: The frontier opens. ${this.pl.name} breaks ground!`, 'info');
  }

  get pl() { return this.companies[0]; }
  get year() { return START_YEAR + Math.floor(this.monthCount / 12); }
  get month() { return this.monthCount % 12; }
  get season() { return SEASONS[this.month]; }
  dateStr() { return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][this.month]} ${this.year}`; }
  idx(x: number, y: number) { return y * W + x; }
  inb(x: number, y: number) { return x >= 0 && y >= 0 && x < W && y < H; }
  st(id: number) { return this.stMap.get(id); }
  comp(id: number) { return this.companies[id]; }
  loco(id: string): LocoDef { return LOCOS.find((l) => l.id === id) || LOCOS[0]; }
  has(tech: string) { return this.techs.has(tech); }
  addNews(text: string, kind: NewsItem['kind'] = 'info') {
    this.news.unshift({ t: this.t, text, kind, date: this.dateStr() });
    if (this.news.length > 80) this.news.pop();
  }
  sfx(n: string) { audio.sfx(n); }

  // ---------------- FX ----------------
  floater(x: number, y: number, text: string, color = '#ffe08a', big = false) {
    if (this.floaters.length > 60) this.floaters.shift();
    this.floaters.push({ x, y, text, color, life: big ? 2.2 : 1.5, max: big ? 2.2 : 1.5, big });
  }
  burst(x: number, y: number, color: string, n = 14, kind: Particle['kind'] = 'spark', spd = 60) {
    for (let i = 0; i < n && this.particles.length < 700; i++) {
      const a = Math.random() * 6.283, s = (0.3 + Math.random()) * spd;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === 'spark' ? 20 : 0), life: 0.5 + Math.random() * 0.7, max: 1.2, size: 1.5 + Math.random() * 2.5, color, kind });
    }
  }
  addShake(v: number) { this.shake = Math.min(14, this.shake + v); }
  updateFx(dt: number) {
    for (const p of this.particles) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'spark') p.vy += 90 * dt;
      else if (p.kind === 'smoke') { p.vy -= 6 * dt; p.size += dt * 5; }
      else if (p.kind === 'coin') p.vy -= 20 * dt;
      else if (p.kind === 'ring') p.size += dt * 40;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y -= (f.big ? 16 : 22) * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 22);
    for (const tr of this.trains) {
      if (tr.state === 'moving' && Math.random() < dt * 4 && this.particles.length < 600) {
        const p = this.trainXY(tr, 0);
        this.particles.push({ x: p.x, y: p.y - 4, vx: (Math.random() - 0.5) * 6, vy: -8 - Math.random() * 6, life: 1.1, max: 1.1, size: 2, color: tr.owner === 0 ? '#ddd' : '#bbb', kind: 'smoke' });
      }
    }
    // snow in blizzard zones
    for (const z of this.zones) {
      if (z.kind === 'blizzard' && this.particles.length < 650) {
        for (let k = 0; k < 2; k++) {
          const a = Math.random() * 6.283, d = Math.random() * z.r * TILE;
          this.particles.push({ x: z.x * TILE + Math.cos(a) * d, y: z.y * TILE + Math.sin(a) * d, vx: -40, vy: 20 + Math.random() * 20, life: 1, max: 1, size: 1.6, color: '#fff', kind: 'snow' });
        }
      }
    }
  }

  trainXY(tr: Train, back: number) {
    const p = tr.path;
    if (!p.length) return { x: 0, y: 0, a: 0 };
    const fi = Math.max(0, Math.min(p.length - 1, tr.pi + tr.f - back));
    const i0 = Math.floor(fi), i1 = Math.min(p.length - 1, i0 + 1), fr = fi - i0;
    const ax = (p[i0] % W) + 0.5, ay = Math.floor(p[i0] / W) + 0.5;
    const bx = (p[i1] % W) + 0.5, by = Math.floor(p[i1] / W) + 0.5;
    let a = tr.ang;
    if (i1 !== i0) a = Math.atan2(by - ay, bx - ax);
    else if (i0 > 0) a = Math.atan2(ay - (Math.floor(p[i0 - 1] / W) + 0.5), ax - ((p[i0 - 1] % W) + 0.5));
    return { x: (ax + (bx - ax) * fr) * TILE, y: (ay + (by - ay) * fr) * TILE, a };
  }

  // ---------------- tiles & track ----------------
  trackMul(owner: number, terrain: number) {
    let m = 1;
    if (owner === 0) {
      if (this.has('survey')) m *= 0.85;
      if (terrain === T_MOUNT && this.has('tunnel')) m *= 0.6;
      if (terrain === T_WATER && this.has('steelbridge')) m *= 0.65;
      m *= 1 - 0.05 * (this.perks.rails || 0);
      m *= 1.1 - this.rep / 500;
    }
    if (this.grantUntil > this.t) m *= 0.7;
    return m;
  }
  tileCost(i: number, owner: number) { const t = this.terr[i]; return BASE_TRACK * TERRAIN_COST[t] * this.trackMul(owner, t); }
  edge(a: number, b: number) {
    const dx = (b % W) - (a % W), dy = Math.floor(b / W) - Math.floor(a / W);
    let d = -1;
    if (dx === 0 && dy === -1) d = 0; else if (dx === 1 && dy === 0) d = 1; else if (dx === 0 && dy === 1) d = 2; else if (dx === -1 && dy === 0) d = 3;
    if (d < 0) return false;
    return (this.trk[a] & BIT[d]) !== 0 && (this.trk[b] & BIT[OPP[d]]) !== 0;
  }
  stepCost(ni: number, owner: number) {
    if (this.trk[ni] !== 0 && this.own[ni] !== owner) return -1;
    const sid = this.stAt[ni];
    if (sid >= 0) { const s = this.st(sid); if (s && s.owner !== owner) return -1; }
    if (this.trk[ni] !== 0) return 6;
    return this.tileCost(ni, owner);
  }
  findPath(a: number, b: number, owner: number): number[] | null {
    const N = W * H;
    const g = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const hn: number[] = [], hf: number[] = [];
    const bx = b % W, by = Math.floor(b / W);
    const hh = (i: number) => (Math.abs((i % W) - bx) + Math.abs(Math.floor(i / W) - by)) * 6;
    const push = (n: number, f: number) => {
      let i = hn.length; hn.push(n); hf.push(f);
      while (i > 0) { const p = (i - 1) >> 1; if (hf[p] <= hf[i]) break; [hn[p], hn[i]] = [hn[i], hn[p]]; [hf[p], hf[i]] = [hf[i], hf[p]]; i = p; }
    };
    const pop = () => {
      const top = hn[0]; const ln = hn.pop() as number, lf = hf.pop() as number;
      if (hn.length) {
        hn[0] = ln; hf[0] = lf; let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1; let m = i;
          if (l < hn.length && hf[l] < hf[m]) m = l;
          if (r < hn.length && hf[r] < hf[m]) m = r;
          if (m === i) break;
          [hn[m], hn[i]] = [hn[i], hn[m]]; [hf[m], hf[i]] = [hf[i], hf[m]]; i = m;
        }
      }
      return top;
    };
    g[a] = 0; push(a, hh(a));
    while (hn.length) {
      const cur = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === b) break;
      const cx = cur % W, cy = Math.floor(cur / W);
      for (let d = 0; d < 4; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const c = ni === b || ni === a ? Math.max(0, this.stepCost(ni, owner)) : this.stepCost(ni, owner);
        if (c < 0) continue;
        const ng = g[cur] + c;
        if (ng < g[ni]) { g[ni] = ng; prev[ni] = cur; push(ni, ng + hh(ni)); }
      }
    }
    if (g[b] === Infinity) return null;
    const path: number[] = [];
    for (let c = b; c !== -1; c = prev[c]) path.push(c);
    return path.reverse();
  }
  pathCost(path: number[], owner: number) {
    let cost = 0;
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      if (this.trk[i] === 0) cost += this.tileCost(i, owner);
      if (k > 0 && !this.edge(path[k - 1], i)) cost += 6;
    }
    return Math.round(cost);
  }
  layTrack(path: number[], owner: number) {
    let n = 0;
    for (let k = 0; k < path.length; k++) {
      const i = path[k];
      if (this.trk[i] === 0) n++;
      if (k > 0) {
        const a = path[k - 1];
        const dx = (i % W) - (a % W), dy = Math.floor(i / W) - Math.floor(a / W);
        const d = dy === -1 ? 0 : dx === 1 ? 1 : dy === 1 ? 2 : 3;
        this.trk[a] |= BIT[d]; this.trk[i] |= BIT[OPP[d]];
        this.own[a] = owner; this.own[i] = owner;
      }
    }
    if (path.length === 1) { /* nothing */ }
    if (owner === 0) this.stats.tracks += n;
    return n;
  }
  clearTile(i: number) {
    const mask = this.trk[i];
    for (let d = 0; d < 4; d++) {
      if (mask & BIT[d]) {
        const nx = (i % W) + DX[d], ny = Math.floor(i / W) + DY[d];
        if (this.inb(nx, ny)) {
          const ni = ny * W + nx;
          this.trk[ni] &= ~BIT[OPP[d]];
          if (this.trk[ni] === 0) this.own[ni] = -1;
        }
      }
    }
    this.trk[i] = 0; this.own[i] = -1;
    return mask;
  }
  restoreList(list: Ruin[]) {
    for (const r of list) { if (this.trk[r.i] === 0 && (this.own[r.i] === -1 || this.own[r.i] === r.owner)) { this.trk[r.i] = r.mask; this.own[r.i] = r.owner; } }
    for (const r of list) {
      for (let d = 0; d < 4; d++) {
        if (this.trk[r.i] & BIT[d]) {
          const nx = (r.i % W) + DX[d], ny = Math.floor(r.i / W) + DY[d];
          if (!this.inb(nx, ny)) continue;
          const ni = ny * W + nx;
          if (this.own[ni] === r.owner) this.trk[ni] |= BIT[OPP[d]];
        }
      }
    }
  }
  ruinCost(r: Ruin) { return this.tileCost(r.i, r.owner) * 0.6; }
  repairRuins(owner: number) {
    const list = this.ruins.filter((r) => r.owner === owner);
    if (!list.length) return { ok: false, msg: 'Nothing to repair.' };
    const cost = Math.round(list.reduce((s, r) => s + this.ruinCost(r), 0));
    const c = this.comp(owner);
    if (c.cash < cost) return { ok: false, msg: `Repairs cost $${cost.toLocaleString()}.` };
    c.cash -= cost; c.monthExp += 0;
    this.restoreList(list);
    this.ruins = this.ruins.filter((r) => r.owner !== owner);
    if (owner === 0) { this.sfx('build'); this.addNews(`Repair crews restore ${list.length} track tiles ($${cost.toLocaleString()}).`, 'good'); }
    return { ok: true, msg: `Repaired ${list.length} tiles.` };
  }

  nearestNode(x: number, y: number) {
    let best: Town | Industry | null = null, bd = 1e9;
    for (const n of [...this.towns, ...this.inds]) { const d = Math.abs(n.x - x) + Math.abs(n.y - y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  canStation(x: number, y: number, owner: number) {
    if (!this.inb(x, y)) return 'Out of bounds';
    const i = this.idx(x, y);
    if (this.terr[i] === T_WATER) return 'Cannot build on water';
    if (this.stAt[i] >= 0) return 'A station is already here';
    if (this.trk[i] !== 0 && this.own[i] !== owner) return 'Rival track occupies this tile';
    return '';
  }
  addStation(owner: number, x: number, y: number): Station | null {
    if (this.canStation(x, y, owner)) return null;
    const nn = this.nearestNode(x, y);
    const base = nn ? nn.name.replace(/ (Mine|Farm|Camp|Works|Foundry|Colliery|Ranch|Grange|Sawmill|Pit|Gap)$/, '') : 'Lonely';
    const sufs = ['Station', 'Junction', 'Depot', 'Yard', 'Halt'];
    let name = '';
    for (const sfx of sufs) { name = `${base} ${sfx}`; if (!this.stations.some((s) => s.name === name)) break; name = ''; }
    if (!name) name = `${base} #${this.idc}`;
    const s: Station = {
      id: this.idc++, owner, name, x, y, tile: this.idx(x, y), cargo: emptyStore(), platforms: 2 + (owner === 0 && this.has('yards') ? 1 : 0),
      occ: 0, depot: false, closedUntil: 0, lastPickup: -999, lastSpeed: 2, waiting: 0,
    };
    this.stations.push(s); this.stMap.set(s.id, s); this.stAt[s.tile] = s.id;
    return s;
  }
  removeStation(s: Station) {
    this.stations = this.stations.filter((x) => x !== s); this.stMap.delete(s.id); this.stAt[s.tile] = -1;
    for (const tr of this.trains) {
      tr.sched = tr.sched.filter((p) => p.st !== s.id);
      if (tr.si >= tr.sched.length) tr.si = 0;
      if (tr.held === s.id) { tr.held = -1; tr.state = 'moving'; }
      tr.path = [tr.path[tr.pi] ?? tr.path[0]]; tr.pi = 0; tr.f = 0;
    }
    this.companies.forEach((c) => { c.routes = c.routes.filter((r) => r.a !== s.id && r.b !== s.id); });
  }
  stationsNear(x: number, y: number, r = CATCH) {
    return this.stations.filter((s) => Math.abs(s.x - x) <= r && Math.abs(s.y - y) <= r);
  }
  nodesNear(s: Station) {
    return {
      towns: this.towns.filter((t) => Math.abs(t.x - s.x) <= CATCH && Math.abs(t.y - s.y) <= CATCH),
      inds: this.inds.filter((t) => Math.abs(t.x - s.x) <= CATCH && Math.abs(t.y - s.y) <= CATCH),
    };
  }
  accepts(s: Station, c: Cargo) {
    const n = this.nodesNear(s);
    if (c === 'pass' || c === 'mail') return n.towns.some((t) => t.pop >= 60);
    if (c === 'coal' || c === 'timber') return n.towns.length > 0 || n.inds.some((i) => i.ik === 'factory');
    return n.towns.length > 0;
  }
  stationRating(s: Station) {
    if (s.closedUntil > this.t) return 5;
    const dt = this.t - s.lastPickup;
    const fresh = dt < 8 ? 35 : dt < 20 ? 24 : dt < 40 ? 12 : 0;
    let r = 25 + fresh + Math.min(20, s.lastSpeed * 5) + s.platforms * 2;
    if (s.owner === 0 && this.has('telegraph')) r += 8;
    if (s.depot) r += 3;
    return Math.max(0, Math.min(100, r));
  }
  connected(owner: number, a: number, b: number) {
    return this.bfs(a, b) !== null && (this.own[a] === owner || a === b);
  }
  bfs(a: number, b: number): number[] | null {
    if (a === b) return [a];
    const prev = this.bfsPrev; prev.fill(-2);
    const q = [a]; prev[a] = -1;
    let h = 0, found = false;
    while (h < q.length) {
      const cur = q[h++];
      if (cur === b) { found = true; break; }
      const cx = cur % W, cy = Math.floor(cur / W);
      for (let d = 0; d < 4; d++) {
        if (!(this.trk[cur] & BIT[d])) continue;
        const ni = (cy + DY[d]) * W + cx + DX[d];
        if (prev[ni] === -2 && (this.trk[ni] & BIT[OPP[d]])) { prev[ni] = cur; q.push(ni); }
      }
    }
    if (!found) return null;
    const path: number[] = [];
    for (let c = b; c !== -1; c = prev[c]) path.push(c);
    return path.reverse();
  }
  townsConnected(owner: number, ta: Town, tb: Town) {
    const sa = this.stations.filter((s) => s.owner === owner && Math.abs(s.x - ta.x) <= CATCH && Math.abs(s.y - ta.y) <= CATCH);
    const sb = this.stations.filter((s) => s.owner === owner && Math.abs(s.x - tb.x) <= CATCH && Math.abs(s.y - tb.y) <= CATCH);
    for (const a of sa) for (const b of sb) if (this.trk[a.tile] && this.trk[b.tile] && this.bfs(a.tile, b.tile)) return true;
    return false;
  }

  // ---------------- player actions ----------------
  spend(c: Company, amt: number) { if (c.cash < amt) return false; c.cash -= amt; return true; }
  actBuildStation(x: number, y: number) {
    const err = this.canStation(x, y, 0);
    if (err) return { ok: false, msg: err };
    if (!this.spend(this.pl, STATION_COST)) return { ok: false, msg: `Need $${STATION_COST} for a station.` };
    const s = this.addStation(0, x, y) as Station;
    this.sfx('station'); this.burst(x * TILE + 12, y * TILE + 12, '#ffd36a', 12);
    this.floater(x * TILE + 12, y * TILE, s.name, '#fff2c0');
    return { ok: true, msg: `${s.name} opened.` };
  }
  actBuildTrack(path: number[]) {
    if (path.length < 2) return { ok: false, msg: 'Path too short.' };
    for (const i of path) if (this.stepCost(i, 0) < 0) return { ok: false, msg: 'Blocked by rival property.' };
    const cost = this.pathCost(path, 0);
    if (cost === 0) return { ok: false, msg: 'Track already exists there.' };
    if (!this.spend(this.pl, cost)) return { ok: false, msg: `Need $${cost.toLocaleString()}.` };
    const n = this.layTrack(path, 0);
    this.sfx('build'); this.addShake(1.5);
    const e = path[path.length - 1];
    this.burst((e % W) * TILE + 12, Math.floor(e / W) * TILE + 12, '#c9a46a', 10);
    this.floater((e % W) * TILE + 12, Math.floor(e / W) * TILE, `-$${cost.toLocaleString()}`, '#ff9a8a');
    return { ok: true, msg: `Laid ${n} tiles for $${cost.toLocaleString()}.` };
  }
  actDemolish(x: number, y: number) {
    if (!this.inb(x, y)) return { ok: false, msg: '' };
    const i = this.idx(x, y);
    const sid = this.stAt[i];
    if (sid >= 0) {
      const s = this.st(sid) as Station;
      if (s.owner !== 0) return { ok: false, msg: 'Not your station.' };
      this.removeStation(s); this.pl.cash += 300; this.sfx('explode'); this.burst(x * TILE + 12, y * TILE + 12, '#aaa', 14); this.addShake(3);
      return { ok: true, msg: `${s.name} demolished (+$300).` };
    }
    if (this.trk[i] && this.own[i] === 0) {
      this.clearTile(i); this.pl.cash += 20; this.sfx('build'); this.burst(x * TILE + 12, y * TILE + 12, '#8a6a4a', 6);
      return { ok: true, msg: 'Track removed.' };
    }
    return { ok: false, msg: 'Nothing of yours to demolish.' };
  }
  availableLocos() { return LOCOS.filter((l) => !l.tech || this.techs.has(l.tech)); }
  buyTrain(owner: number, locoId: string, a: number, b: number) {
    const lc = this.loco(locoId);
    const c = this.comp(owner);
    const sa = this.st(a), sb = this.st(b);
    if (!sa || !sb || a === b) return { ok: false, msg: 'Pick two different stations.' };
    if (owner === 0 && lc.tech && !this.techs.has(lc.tech)) return { ok: false, msg: 'Locomotive not researched.' };
    if (c.cash < lc.cost) return { ok: false, msg: `Need $${lc.cost.toLocaleString()}.` };
    c.cash -= lc.cost;
    const tr: Train = {
      id: this.idc++, owner, loco: lc.id, name: `${TRAIN_NAMES[Math.floor(Math.random() * TRAIN_NAMES.length)]} #${this.trains.length + 1}`,
      sched: [{ st: a, order: 'any', dwell: 3 }, { st: b, order: 'any', dwell: 3 }], si: 0, path: [sa.tile], pi: 0, f: 0, state: 'moving', timer: 0,
      cargo: emptyStore(), load: 0, wear: 0, earned: 0, trips: 0, retry: 0, ang: 0, held: -1, haltUntil: 0, wanted: [], lastPay: 0, bornT: this.t, slow: false,
    };
    this.trains.push(tr);
    if (owner === 0) { this.stats.trainsBought++; this.sfx('whistle'); this.burst(sa.x * TILE + 12, sa.y * TILE + 12, '#fff', 10, 'smoke', 20); }
    return { ok: true, msg: `${tr.name} joins the fleet.`, id: tr.id };
  }
  fixSchedule(tr: Train) {
    if (tr.held >= 0) { const s = this.st(tr.held); if (s) s.occ = Math.max(0, s.occ - 1); tr.held = -1; }
    if (tr.si >= tr.sched.length) tr.si = 0;
    tr.path = [tr.path[Math.min(tr.pi, tr.path.length - 1)] ?? tr.path[0]]; tr.pi = 0; tr.f = 0;
    tr.state = tr.sched.length >= 2 ? 'moving' : 'idle';
  }
  sellTrain(id: number) {
    const tr = this.trains.find((t) => t.id === id);
    if (!tr || tr.owner !== 0) return { ok: false, msg: '' };
    if (tr.held >= 0) { const s = this.st(tr.held); if (s) s.occ = Math.max(0, s.occ - 1); }
    this.trains = this.trains.filter((t) => t !== tr);
    const v = Math.round(this.loco(tr.loco).cost * 0.55 * (1 - tr.wear / 250));
    this.pl.cash += v; this.sfx('coin');
    return { ok: true, msg: `Sold ${tr.name} for $${v.toLocaleString()}.` };
  }
  serviceTrain(id: number) {
    const tr = this.trains.find((t) => t.id === id);
    if (!tr || tr.owner !== 0) return { ok: false, msg: '' };
    const cost = 300;
    if (tr.wear < 5) return { ok: false, msg: 'Already in good shape.' };
    if (!this.spend(this.pl, cost)) return { ok: false, msg: 'Need $300.' };
    tr.wear = 0; tr.haltUntil = Math.max(tr.haltUntil, this.t + 3); this.sfx('build');
    return { ok: true, msg: `${tr.name} serviced.` };
  }
  upgradePlatform(sid: number) {
    const s = this.st(sid);
    if (!s || s.owner !== 0) return { ok: false, msg: '' };
    if (s.platforms >= 4) return { ok: false, msg: 'Maximum platforms.' };
    if (!this.spend(this.pl, PLATFORM_COST)) return { ok: false, msg: `Need $${PLATFORM_COST}.` };
    s.platforms++; this.sfx('build');
    return { ok: true, msg: 'Platform added.' };
  }
  buildDepot(sid: number) {
    const s = this.st(sid);
    if (!s || s.owner !== 0 || s.depot) return { ok: false, msg: '' };
    if (!this.spend(this.pl, DEPOT_COST)) return { ok: false, msg: `Need $${DEPOT_COST}.` };
    s.depot = true; this.sfx('station');
    return { ok: true, msg: 'Depot built: trains are serviced automatically here.' };
  }

  // ---------------- cargo & trains ----------------
  srcNode(src: number): Town | Industry | undefined { return src < 100 ? this.towns[src] : this.inds[src - 100]; }
  distribute(c: Cargo, x: number, y: number, amount: number, src: number) {
    if (amount <= 0.01) return;
    const near = this.stationsNear(x, y).filter((s) => s.closedUntil <= this.t);
    if (!near.length) return;
    const ratings = near.map((s) => this.stationRating(s));
    const sum = ratings.reduce((a, r) => a + r * r, 0) || 1;
    const maxR = Math.max(...ratings);
    const node = this.srcNode(src);
    near.forEach((s, k) => {
      const share = amount * (ratings[k] * ratings[k] / sum) * (0.45 + 0.55 * maxR / 100);
      if (share < 0.05) return;
      const arr = s.cargo[c];
      arr.push({ n: share, ox: x, oy: y, t: this.t, src });
      let tot = arr.reduce((a, p) => a + p.n, 0);
      while (tot > 400 && arr.length > 1) { tot -= arr[0].n; arr.shift(); }
      if (node) node.prodM += share;
    });
  }
  unload(tr: Train, s: Station) {
    const owner = this.comp(tr.owner);
    let total = 0;
    for (const c of CARGOS) {
      const arr = tr.cargo[c];
      if (!arr.length || !this.accepts(s, c)) continue;
      const nodes = this.nodesNear(s);
      let units = 0, pay = 0;
      for (const p of arr) {
        const dist = Math.max(2, Math.abs(s.x - p.ox) + Math.abs(s.y - p.oy));
        const info = CARGO_INFO[c];
        const decay = Math.max(0.35, 1 - (this.t - p.t) / info.decay);
        let m = 1.3 * (tr.owner === 0 ? this.diff.payMul : 1);
        if (tr.owner === 0 && this.has('pullman') && (c === 'pass' || c === 'mail')) m *= 1.25;
        if (nodes.towns.some((t) => t.boomUntil > this.t)) m *= 1.25;
        if ((c === 'coal' || c === 'timber') && !nodes.inds.some((i) => i.ik === 'factory')) m *= 0.65;
        pay += p.n * dist * info.rate * decay * m;
        units += p.n;
      }
      tr.cargo[c] = []; tr.load = Math.max(0, tr.load - units);
      total += pay;
      // consumption effects
      const fac = nodes.inds.find((i) => i.ik === 'factory');
      if (fac && (c === 'coal' || c === 'timber')) { fac.stock[c] += units; fac.recvM += units; }
      else if (c === 'grain' || c === 'goods') { for (const t of nodes.towns) t.supply += units / nodes.towns.length; }
      if (tr.owner === 0) { this.stats.delivered += units; this.progressContracts(c, units, nodes); }
    }
    if (total > 0.5) {
      owner.cash += total; owner.monthRev += total; owner.totalRev += total; tr.earned += total; tr.lastPay = total;
      if (tr.owner === 0) {
        this.stats.revenue += total;
        this.floater(s.x * TILE + 12, s.y * TILE - 2, `+$${Math.round(total).toLocaleString()}`, total > 800 ? '#8dff9a' : '#ffe08a', total > 800);
        this.burst(s.x * TILE + 12, s.y * TILE + 8, '#ffd24a', total > 800 ? 12 : 5, 'coin', 40);
        this.sfx('coin');
        if (!this.flags.delivered) this.flags.delivered = true;
      }
    }
  }
  loadTrain(tr: Train, s: Station, dt: number) {
    const lc = this.loco(tr.loco);
    const rate = 28 * (tr.owner === 0 && this.has('yards') ? 1.5 : 1);
    let budget = Math.min(lc.cap - tr.load, rate * dt);
    if (budget <= 0.001) return;
    for (const c of tr.wanted) {
      const arr = s.cargo[c];
      while (arr.length && budget > 0.001) {
        const p = arr[0];
        const take = Math.min(p.n, budget);
        p.n -= take; budget -= take; tr.load += take;
        const last = tr.cargo[c][tr.cargo[c].length - 1];
        if (last && last.src === p.src && Math.abs(last.t - p.t) < 0.01) last.n += take;
        else tr.cargo[c].push({ n: take, ox: p.ox, oy: p.oy, t: p.t, src: p.src });
        const nd = this.srcNode(p.src); if (nd) nd.pickedM += take;
        s.lastPickup = this.t; s.lastSpeed = lc.speed;
        if (p.n <= 0.001) arr.shift();
      }
    }
  }
  progressContracts(c: Cargo, units: number, nodes: { towns: Town[]; inds: Industry[] }) {
    for (const k of this.contracts) {
      if (!k.active || k.cargo !== c) continue;
      const hit = k.sinkKind === 'town' ? nodes.towns.some((t) => t.id === k.sinkId) : nodes.inds.some((i) => i.id === k.sinkId);
      if (!hit) continue;
      k.got += units;
      if (k.got >= k.qty) {
        k.active = false; k.qty = -1;
        this.pl.cash += k.reward; this.pl.monthRev += k.reward; this.rep = Math.min(100, this.rep + 5); this.stats.contracts++;
        this.addNews(`Contract complete: ${CARGO_INFO[k.cargo].name} to ${k.sinkName}. +$${k.reward.toLocaleString()}!`, 'good');
        this.sfx('cash');
        const sn = k.sinkKind === 'town' ? this.towns[k.sinkId] : this.inds[k.sinkId - 100];
        if (sn) { this.floater(sn.x * TILE, sn.y * TILE - 10, `CONTRACT +$${k.reward.toLocaleString()}`, '#8dff9a', true); this.burst(sn.x * TILE, sn.y * TILE, '#8dff9a', 20, 'coin', 70); }
      }
    }
    this.contracts = this.contracts.filter((k) => k.qty !== -1);
  }
  zoneMul(i: number) {
    let m = 1;
    const x = i % W, y = Math.floor(i / W);
    for (const z of this.zones) if (z.kind === 'blizzard' && (x - z.x) ** 2 + (y - z.y) ** 2 <= z.r * z.r) m *= 0.45;
    return m;
  }
  updateTrain(tr: Train, dt: number) {
    if (tr.haltUntil > this.t) return;
    const lc = this.loco(tr.loco);
    const co = this.comp(tr.owner);
    if (!co.alive) return;
    switch (tr.state) {
      case 'idle': if (tr.sched.length >= 2) tr.state = 'moving'; break;
      case 'broken': tr.timer -= dt; if (tr.timer <= 0) tr.state = 'moving'; break;
      case 'stuck': tr.retry -= dt; if (tr.retry <= 0) tr.state = 'moving'; break;
      case 'queue': {
        const s = this.st(tr.sched[tr.si]?.st ?? -1);
        if (!s) { tr.state = 'moving'; break; }
        if (s.occ < s.platforms) this.arrive(tr, s);
        break;
      }
      case 'loading': {
        const s = this.st(tr.held);
        if (!s) { tr.state = 'moving'; tr.held = -1; break; }
        const stop = tr.sched[tr.si] || { st: s.id, order: 'any' as const, dwell: 2 };
        tr.timer += dt;
        if (stop.order !== 'drop') this.loadTrain(tr, s, dt);
        const dwell = stop.dwell * (tr.owner === 0 && this.has('yards') ? 0.7 : 1);
        const full = tr.load >= lc.cap - 0.5;
        const ready = tr.timer >= dwell && (stop.order !== 'full' || full || tr.timer >= dwell + 25);
        if (ready) {
          s.occ = Math.max(0, s.occ - 1); tr.held = -1;
          tr.si = (tr.si + 1) % tr.sched.length; if (tr.si === 0) tr.trips++;
          tr.path = [s.tile]; tr.pi = 0; tr.f = 0; tr.state = 'moving';
        }
        break;
      }
      case 'moving': {
        if (tr.sched.length < 2) { tr.state = 'idle'; break; }
        if (tr.si >= tr.sched.length) tr.si = 0;
        const s = this.st(tr.sched[tr.si].st);
        if (!s) { tr.sched.splice(tr.si, 1); tr.si = 0; break; }
        const last = tr.path.length - 1;
        if (tr.pi >= last) {
          const cur = tr.path[last];
          if (cur === s.tile) { this.arrive(tr, s); break; }
          const p = this.bfs(cur, s.tile);
          if (!p) { tr.state = 'stuck'; tr.retry = 3; break; }
          tr.path = p; tr.pi = 0; tr.f = 0;
        }
        if (tr.pi < tr.path.length - 1 && !this.edge(tr.path[tr.pi], tr.path[tr.pi + 1])) { tr.path = [tr.path[tr.pi]]; tr.pi = 0; tr.f = 0; tr.state = 'stuck'; tr.retry = 2; break; }
        const tile = tr.path[Math.min(tr.pi, tr.path.length - 1)];
        const tt = this.terr[tile];
        let tm = TERRAIN_SPEED[tt];
        if (tt === T_HILL || tt === T_MOUNT) tm = tm + lc.hill * (1 - tm) * 0.8;
        const sea = this.season === 'Winter' ? (this.mods.has('winters') ? 0.8 : 0.93) : 1;
        const zm = this.zoneMul(tile);
        tr.slow = zm < 1;
        let sp = lc.speed * tm * sea * zm * (1 - tr.wear / 350);
        if (tr.owner === 0 && this.has('steelrails')) sp *= 1.1;
        tr.f += sp * dt;
        while (tr.f >= 1 && tr.pi < tr.path.length - 1) {
          tr.f -= 1; tr.pi++; tr.wear = Math.min(100, tr.wear + 0.15);
          if (tr.pi < tr.path.length - 1 && !this.edge(tr.path[tr.pi], tr.path[tr.pi + 1])) { tr.path = [tr.path[tr.pi]]; tr.pi = 0; tr.f = 0; break; }
        }
        if (tr.pi >= tr.path.length - 1) tr.f = 0;
        // breakdowns
        if (tr.wear > 35) {
          const p = ((tr.wear - 35) / 65) * 0.009 / lc.rel * (tr.owner === 0 && this.has('signals') ? 0.5 : 1) * dt;
          if (Math.random() < p) {
            tr.state = 'broken'; tr.timer = 8 + Math.random() * 7;
            const pos = this.trainXY(tr, 0);
            this.burst(pos.x, pos.y, '#999', 10, 'smoke', 25);
            if (tr.owner === 0) { this.addNews(`${tr.name} has broken down! Service it before it fails again.`, 'warn'); this.floater(pos.x, pos.y - 8, 'BREAKDOWN', '#ff9a5a'); this.sfx('error'); }
          }
        }
        break;
      }
    }
    if (tr.state === 'moving' && tr.owner === 0) { if (Math.random() < dt * 0.4) this.sfx('chug'); }
  }
  arrive(tr: Train, s: Station) {
    if (s.closedUntil > this.t) { tr.si = (tr.si + 1) % tr.sched.length; tr.path = [s.tile]; tr.pi = 0; tr.f = 0; return; }
    if (s.occ >= s.platforms) { tr.state = 'queue'; return; }
    s.occ++; tr.held = s.id; tr.state = 'loading'; tr.timer = 0;
    const others = tr.sched.filter((p) => p.st !== s.id).map((p) => this.st(p.st)).filter((x): x is Station => !!x);
    tr.wanted = CARGOS.filter((c) => others.some((o) => this.accepts(o, c)));
    this.unload(tr, s);
    if (s.depot && tr.wear > 30) {
      const cost = 150;
      const co = this.comp(tr.owner);
      if (co.cash >= cost) { co.cash -= cost; co.monthExp += cost; tr.wear = 0; if (tr.owner === 0) this.floater(s.x * TILE + 12, s.y * TILE - 12, 'serviced', '#9fd3ff'); }
    }
    if (tr.owner === 0 && Math.random() < 0.35) this.sfx('whistle');
  }

  // ---------------- monthly simulation ----------------
  monthTick() {
    this.monthCount++;
    // town growth (uses last month's service)
    for (const t of this.towns) {
      const service = t.prodM > 0.5 ? Math.min(1, t.pickedM / (t.prodM * 0.5)) : 0;
      const need = t.pop / 60;
      const supply = Math.min(1, t.supply / Math.max(1, need));
      let g = 0.0012 + 0.011 * service + 0.009 * supply;
      if (t.boomUntil > this.t) g += 0.012;
      t.pop = Math.min(6500, t.pop * (1 + g));
      t.supply *= 0.65; t.prodM = 0; t.pickedM = 0;
      const tier = t.pop < 300 ? 0 : t.pop < 1000 ? 1 : t.pop < 2500 ? 2 : 3;
      if (tier > t.lastTier) { this.addNews(`${t.name} has grown into a ${['hamlet', 'village', 'town', 'city'][tier]}! (pop ${Math.round(t.pop).toLocaleString()})`, 'good'); this.burst(t.x * TILE, t.y * TILE, '#ffe08a', 16); }
      t.lastTier = tier;
    }
    for (const i of this.inds) {
      const ratio = i.prodM > 0.5 ? i.pickedM / i.prodM : 0;
      if (ratio > 0.5 || i.recvM > 25) i.prog++; else if (ratio < 0.1) i.prog = Math.max(0, i.prog - 0.3);
      if (i.prog >= 5 && i.level < 4) { i.level++; i.prog = 0; this.addNews(`${i.name} expands (level ${i.level}).`, 'good'); this.burst(i.x * TILE, i.y * TILE, '#9fd3ff', 12); }
      i.prodM = 0; i.pickedM = 0; i.recvM = 0;
    }
    // production
    for (const t of this.towns) {
      const boom = t.boomUntil > this.t ? 2 : 1;
      this.distribute('pass', t.x, t.y, (t.pop / 9) * boom, t.id);
      this.distribute('mail', t.x, t.y, t.pop / 28, t.id);
    }
    for (const i of this.inds) {
      if (i.downUntil > this.t) continue;
      if (i.ik === 'mine') this.distribute('coal', i.x, i.y, 24 * i.level, i.id);
      else if (i.ik === 'farm') this.distribute('grain', i.x, i.y, 22 * i.level, i.id);
      else if (i.ik === 'lumber') this.distribute('timber', i.x, i.y, 20 * i.level, i.id);
      else {
        const m = Math.min(i.stock.coal, i.stock.timber, 30 * i.level);
        i.stock.coal -= m; i.stock.timber -= m;
        this.distribute('goods', i.x, i.y, m, i.id);
      }
    }
    // station housekeeping
    this.recount();
    for (const c of this.companies) {
      if (!c.alive) continue;
      let upkeep = c.tiles * 0.35 * (c.isPlayer && this.has('steelrails') ? 0.7 : 1);
      const sts = this.stations.filter((s) => s.owner === c.id);
      upkeep += sts.length * 25 + sts.filter((s) => s.depot).length * 20;
      for (const tr of this.trains) if (tr.owner === c.id) upkeep += this.loco(tr.loco).upkeep;
      if (c.isPlayer) upkeep += c.security * 140 * (this.has('pinkerton') ? 0.6 : 1);
      const interest = c.loan * (this.panicUntil > this.t ? 0.11 : 0.075) / 12;
      const exp = upkeep + interest;
      c.cash -= exp; c.monthExp += exp;
      const profit = c.monthRev - c.monthExp;
      c.netProfit = profit;
      c.profitEma = c.profitEma * 0.75 + profit * 12 * 0.25;
      c.revHist.push(Math.round(c.monthRev)); if (c.revHist.length > 48) c.revHist.shift();
      c.monthRev = 0; c.monthExp = 0;
      c.nwHist.push(Math.round(this.worth(c))); if (c.nwHist.length > 200) c.nwHist.shift();
      if (!c.isPlayer && c.cash < 0) { const b = Math.min(8000, this.creditLimit(c) - c.loan); if (b > 0) { c.loan += b; c.cash += b; } c.cash = Math.max(c.cash, -2000); }
      c.grudge = Math.max(0, c.grudge - 0.15);
    }
    this.notoriety = Math.max(0, this.notoriety - 1.2);
    // bankruptcy
    if (this.pl.cash < 0) {
      this.negMonths++;
      this.addNews(`Your accounts are overdrawn! ${3 - this.negMonths} month(s) until creditors seize the line.`, 'bad'); this.sfx('warn');
      if (this.negMonths >= 3) { this.finish('lose', 'bankrupt'); return; }
    } else this.negMonths = 0;
    // AI sabotage
    if (!this.tut.on) this.aiSabotageRoll();
    // contracts
    for (const k of this.contracts) {
      if (k.active && this.t > k.deadline) {
        k.qty = -1; this.pl.cash -= k.penalty; this.rep = Math.max(0, this.rep - 6); this.stats.contractsFailed++;
        this.addNews(`Contract failed: ${CARGO_INFO[k.cargo].name} to ${k.sinkName}. Penalty $${k.penalty.toLocaleString()}.`, 'bad');
      }
    }
    this.contracts = this.contracts.filter((k) => k.qty !== -1 && (k.active || this.t < k.offerUntil));
    // year end
    if (this.month === 0) this.yearEnd();
    const w = this.worth(this.pl);
    this.stats.peakWorth = Math.max(this.stats.peakWorth, w);
    this.checkVictory();
  }
  recount() {
    for (const c of this.companies) { c.tiles = 0; c.trainsN = 0; c.stationsN = 0; }
    for (let i = 0; i < W * H; i++) if (this.trk[i] && this.own[i] >= 0) this.companies[this.own[i]].tiles++;
    for (const s of this.stations) this.companies[s.owner].stationsN++;
    for (const t of this.trains) this.companies[t.owner].trainsN++;
  }
  yearEnd() {
    // dividends for the closing year
    for (const c of this.companies) {
      if (!c.alive || c.div === 0 || c.profitEma <= 0) continue;
      const dps = (c.profitEma * DIV_POLICY[c.div]) / c.shares;
      let paidOut = 0;
      const h = this.hold[c.id];
      for (const k of Object.keys(h)) {
        const holder = Number(k);
        if (holder === c.id) continue;
        const amt = dps * h[holder];
        paidOut += amt;
        if (holder >= 0 && this.companies[holder].alive) {
          this.companies[holder].cash += amt;
          if (holder === 0 && amt > 100) { this.stats.stockProfit += amt; this.addNews(`${c.name} pays you a dividend of $${Math.round(amt).toLocaleString()}.`, 'good'); this.sfx('cash'); }
        }
      }
      c.cash -= paidOut;
      c.sent += 0.03 * c.div;
      if (c.isPlayer && paidOut > 100) this.addNews(`${c.name} pays $${Math.round(paidOut).toLocaleString()} in dividends.`, 'info');
    }
    this.addNews(`Happy ${this.year}! Net worth: $${Math.round(this.worth(this.pl)).toLocaleString()}.`, 'info');
    if (this.mods.has('market') && this.year === START_YEAR + 4) this.triggerEvent('panic');
  }
  creditLimit(c: Company) {
    const base = c.isPlayer ? this.diff.loan * (this.mods.has('shoestring') ? 0.6 : 1) : 30000;
    return base + Math.max(0, this.book(c) - c.cash + c.loan) * 0.25;
  }

  // ---------------- market ----------------
  book(c: Company) {
    let v = c.cash - c.loan + c.tiles * 35;
    for (const s of this.stations) if (s.owner === c.id) v += 400 + (s.depot ? 250 : 0) + (s.platforms - 2) * 600;
    for (const t of this.trains) if (t.owner === c.id) v += this.loco(t.loco).cost * 0.65 * (1 - t.wear / 400);
    return v;
  }
  worth(c: Company) {
    let v = this.book(c);
    for (const o of this.companies) { if (o === c || !o.alive) continue; v += (this.hold[o.id]?.[c.id] || 0) * o.price; }
    return v;
  }
  targetPrice(c: Company) {
    const prem = 1 + 0.06 * DIV_POLICY[c.div] * 4;
    return Math.max(1, ((Math.max(this.book(c), 3000) * 0.7 + Math.max(0, c.profitEma) * 4) / c.shares) * c.sent * prem);
  }
  marketTick() {
    this.recount();
    const vol = this.mods.has('market') ? 0.03 : 0.012;
    for (const c of this.companies) {
      if (!c.alive) continue;
      const tp = this.targetPrice(c);
      c.price += (tp - c.price) * 0.12;
      c.price *= 1 + (Math.random() - 0.5) * vol;
      c.price = Math.max(0.5, c.price);
      c.sent += (1 + (c.isPlayer ? 0.04 * (this.perks.broker || 0) + (this.has('broker') ? 0.05 : 0) : 0) - c.sent) * 0.02;
      if (this.panicUntil > this.t) c.sent -= 0.006;
      c.nw = this.worth(c);
    }
  }
  fee() { return this.has('broker') ? 0.005 : 0.02; }
  buyShares(buyerId: number, targetId: number, n: number) {
    const b = this.comp(buyerId), tg = this.comp(targetId);
    if (!tg.alive || !b.alive) return { ok: false, msg: 'Company defunct.' };
    const pub = this.hold[targetId][-1] || 0;
    n = Math.min(n, pub);
    if (n <= 0) return { ok: false, msg: 'No public shares available.' };
    const cost = n * tg.price * (1 + this.fee());
    if (b.cash < cost) return { ok: false, msg: `Need $${Math.round(cost).toLocaleString()}.` };
    b.cash -= cost;
    this.hold[targetId][-1] = pub - n;
    this.hold[targetId][buyerId] = (this.hold[targetId][buyerId] || 0) + n;
    tg.sent += (n / tg.shares) * 0.9;
    if (buyerId === 0) this.sfx('stock');
    if (targetId === 0 && buyerId !== 0 && this.hold[0][buyerId] * 2 > this.pl.shares) { this.finish('lose', 'takeover'); }
    return { ok: true, msg: `Bought ${n} ${tg.name} shares for $${Math.round(cost).toLocaleString()}.` };
  }
  sellShares(sellerId: number, targetId: number, n: number) {
    const tg = this.comp(targetId);
    const have = this.hold[targetId]?.[sellerId] || 0;
    n = Math.min(n, have);
    if (n <= 0) return { ok: false, msg: 'You hold none.' };
    if (sellerId === 0 && targetId === 0 && (have - n) * 2 <= tg.shares && false) return { ok: false, msg: '' };
    const gain = n * tg.price * (1 - this.fee());
    this.comp(sellerId).cash += gain;
    this.hold[targetId][sellerId] = have - n;
    this.hold[targetId][-1] = (this.hold[targetId][-1] || 0) + n;
    tg.sent -= (n / tg.shares) * 0.9;
    if (sellerId === 0) this.sfx('stock');
    return { ok: true, msg: `Sold ${n} ${tg.name} shares for $${Math.round(gain).toLocaleString()}.` };
  }
  issueShares(cid: number, n: number) {
    const c = this.comp(cid);
    if (this.t - c.lastIssue < MONTH_LEN * 3) return { ok: false, msg: 'Investors need 3 months between issues.' };
    const proceeds = n * c.price * 0.95;
    c.shares += n; this.hold[cid][-1] = (this.hold[cid][-1] || 0) + n; c.cash += proceeds; c.lastIssue = this.t;
    c.sent -= (n / c.shares) * 0.8;
    this.sfx('cash');
    return { ok: true, msg: `Issued ${n} new shares, raising $${Math.round(proceeds).toLocaleString()}. Your stake is diluted.` };
  }
  buyback(cid: number, n: number) {
    const c = this.comp(cid);
    const pub = this.hold[cid][-1] || 0;
    n = Math.min(n, pub);
    if (n <= 0) return { ok: false, msg: 'No public shares to buy back.' };
    const cost = n * c.price * 1.03;
    if (c.cash < cost) return { ok: false, msg: `Need $${Math.round(cost).toLocaleString()}.` };
    c.cash -= cost; c.shares -= n; this.hold[cid][-1] = pub - n;
    this.sfx('stock');
    return { ok: true, msg: `Retired ${n} shares for $${Math.round(cost).toLocaleString()}.` };
  }
  borrow(amt: number) {
    const c = this.pl;
    const room = this.creditLimit(c) - c.loan;
    if (room < 1) return { ok: false, msg: 'Credit limit reached.' };
    amt = Math.min(amt, Math.floor(room));
    c.loan += amt; c.cash += amt; this.sfx('cash');
    return { ok: true, msg: `Borrowed $${amt.toLocaleString()}.` };
  }
  repay(amt: number) {
    const c = this.pl;
    amt = Math.min(amt, c.loan, Math.floor(c.cash));
    if (amt <= 0) return { ok: false, msg: c.loan <= 0 ? 'No debt.' : 'Not enough cash.' };
    c.loan -= amt; c.cash -= amt; this.sfx('coin');
    return { ok: true, msg: `Repaid $${amt.toLocaleString()}.` };
  }
  canAbsorb(buyerId: number, targetId: number) {
    const tg = this.comp(targetId);
    return tg.alive && buyerId !== targetId && (this.hold[targetId][buyerId] || 0) * 2 > tg.shares;
  }
  absorb(buyerId: number, targetId: number) {
    if (!this.canAbsorb(buyerId, targetId)) return { ok: false, msg: 'You need more than 50% of the shares.' };
    const b = this.comp(buyerId), tg = this.comp(targetId);
    for (let i = 0; i < W * H; i++) if (this.own[i] === targetId) this.own[i] = buyerId;
    for (const s of this.stations) if (s.owner === targetId) s.owner = buyerId;
    for (const t of this.trains) if (t.owner === targetId) t.owner = buyerId;
    for (const r of this.ruins) if (r.owner === targetId) r.owner = buyerId;
    b.cash += tg.cash; b.loan += tg.loan; b.routes.push(...tg.routes);
    tg.alive = false; tg.cash = 0; tg.loan = 0; tg.routes = [];
    delete this.hold[targetId];
    for (const k of Object.keys(this.hold)) delete this.hold[Number(k)][targetId];
    if (buyerId === 0) {
      this.stats.absorbed++; this.addShake(8); this.sfx('absorb');
      this.addNews(`HOSTILE TAKEOVER! ${tg.name} is absorbed into ${b.name}!`, 'good');
      this.burst(W * TILE / 2, H * TILE / 2, '#ffd24a', 40, 'coin', 160);
      if (tg.def?.boss) this.addNews('Vandermoor\'s empire crumbles. The Iron Tyrant is finished.', 'good');
    }
    this.checkVictory();
    return { ok: true, msg: `${tg.name} absorbed!` };
  }

  // ---------------- sabotage ----------------
  guardChance(targetId: number) {
    const tg = this.comp(targetId);
    let p = 0.82 - tg.security * 0.15;
    if (targetId === 0) { if (this.has('telegraph')) p -= 0.1; if (this.has('pinkerton')) p -= 0.06; }
    return Math.max(0.12, p);
  }
  sabotage(fromId: number, targetId: number, kind: string, free = false) {
    const from = this.comp(fromId), tg = this.comp(targetId);
    const def = SABOTAGE.find((s) => s.id === kind);
    if (!def || !tg.alive || !from.alive) return { ok: false, msg: 'Invalid target.' };
    const mine = this.trains.filter((t) => t.owner === targetId);
    const sts = this.stations.filter((s) => s.owner === targetId);
    if (kind === 'derail' && !mine.length) return { ok: false, msg: `${tg.name} has no trains to derail.` };
    if (kind === 'fire' && !sts.length) return { ok: false, msg: `${tg.name} has no stations.` };
    if (kind === 'cut' && tg.tiles < 6) return { ok: false, msg: `${tg.name} has little track to cut.` };
    if (!free && fromId === 0) { if (!this.spend(from, def.cost)) return { ok: false, msg: `Need $${def.cost.toLocaleString()}.` }; }
    const success = Math.random() < this.guardChance(targetId);
    const playerHit = targetId === 0;
    let msg = '';
    if (success) {
      if (kind === 'derail') {
        const tr = mine[Math.floor(Math.random() * mine.length)];
        const p = this.trainXY(tr, 0);
        if (tr.held >= 0) { const s = this.st(tr.held); if (s) s.occ = Math.max(0, s.occ - 1); tr.held = -1; }
        tr.cargo = emptyStore(); tr.load = 0; tr.state = 'broken'; tr.timer = 22; tr.wear = Math.min(100, tr.wear + 25);
        this.burst(p.x, p.y, '#ff8a3a', 30, 'spark', 120); this.burst(p.x, p.y, '#555', 12, 'smoke', 30); this.addShake(8);
        this.floater(p.x, p.y - 10, 'DERAILED!', '#ff5a3a', true);
        msg = `${tr.name} was derailed`;
      } else if (kind === 'fire') {
        const s = sts[Math.floor(Math.random() * sts.length)];
        s.cargo = emptyStore(); s.closedUntil = this.t + 25; s.lastPickup = -999;
        this.burst(s.x * TILE + 12, s.y * TILE + 12, '#ff8a3a', 34, 'spark', 90); this.addShake(6);
        this.floater(s.x * TILE + 12, s.y * TILE - 8, 'FIRE!', '#ff5a3a', true);
        msg = `${s.name} was set ablaze`;
      } else if (kind === 'cut') {
        const tiles: number[] = [];
        for (let i = 0; i < W * H; i++) if (this.own[i] === targetId && this.trk[i] && this.stAt[i] < 0) tiles.push(i);
        if (!tiles.length) return { ok: false, msg: 'No cuttable track.' };
        let cur = tiles[Math.floor(Math.random() * tiles.length)];
        for (let k = 0; k < 3; k++) {
          if (this.trk[cur] === 0 || this.stAt[cur] >= 0) break;
          const mk = this.clearTile(cur);
          this.ruins.push({ i: cur, mask: mk, owner: targetId, t: this.t });
          this.burst((cur % W) * TILE + 12, Math.floor(cur / W) * TILE + 12, '#ff8a3a', 10, 'spark', 70);
          const d = [0, 1, 2, 3].find((dd) => mk & BIT[dd]);
          if (d === undefined) break;
          const nx = (cur % W) + DX[d], ny = Math.floor(cur / W) + DY[d];
          if (!this.inb(nx, ny)) break;
          cur = ny * W + nx;
        }
        this.addShake(4);
        msg = 'Track was sabotaged';
      } else if (kind === 'strike') {
        for (const t of mine) t.haltUntil = Math.max(t.haltUntil, this.t + 20);
        msg = 'A strike halted the fleet';
        this.addShake(2);
      } else if (kind === 'rumor') {
        tg.sent = Math.max(0.5, tg.sent - 0.2);
        msg = 'Rumors sank the stock';
      }
      this.sfx(playerHit ? 'explode' : 'sabotage');
    }
    if (fromId === 0) {
      this.stats.sabotageDone++;
      const caught = Math.random() < 0.3 + 0.1 * tg.security + this.notoriety / 250;
      if (success) this.addNews(`${msg} at ${tg.name}.${caught ? '' : ' Nobody suspects you.'}`, 'good');
      else this.addNews(`The attempt against ${tg.name} failed - their guards were alert.`, 'warn');
      if (caught) {
        this.notoriety = Math.min(100, this.notoriety + 14); this.rep = Math.max(0, this.rep - 4); this.stats.caught++;
        const fine = 1000; this.pl.cash -= fine; this.pl.sent -= 0.04; tg.grudge += 1.5;
        this.addNews(`Your agents were caught! Fined $${fine.toLocaleString()}. Notoriety rising.`, 'bad'); this.sfx('caught');
      }
      if (this.notoriety >= 100) this.wanted();
      return { ok: true, msg: success ? `Success: ${msg}.` : 'Failed: guards were alert.' };
    } else if (playerHit) {
      this.stats.sabotageHit++;
      const known = Math.random() < (0.35 + (this.has('telegraph') ? 0.3 : 0));
      if (success) this.addNews(`SABOTAGE! ${msg}. ${known ? `Evidence points to ${from.name}!` : 'Culprits unknown.'}`, 'bad');
      else this.addNews(`Your guards foiled a sabotage attempt${known ? ` by ${from.name}` : ''}!`, 'good');
      return { ok: true, msg };
    }
    return { ok: true, msg };
  }
  wanted() {
    this.notoriety = 55;
    this.pl.cash -= 5000; this.rep = Math.max(0, this.rep - 10);
    for (const t of this.trains) if (t.owner === 0) t.haltUntil = this.t + 12;
    this.addNews('FEDERAL INJUNCTION! Marshals halt your trains and levy a $5,000 fine for your crimes.', 'bad');
    this.sfx('warn'); this.addShake(6);
  }
  aiSabotageRoll() {
    const years = this.monthCount / 12;
    if (years < 1) return;
    for (const c of this.companies) {
      if (c.isPlayer || !c.alive || !c.def) continue;
      const base = c.def.aggr * this.diff.aggr * (0.03 + (this.notoriety / 100) * 0.07 + c.grudge * 0.05) * (c.def.boss ? 1 + years / 5 : 1);
      if (Math.random() < base) {
        const kinds = ['derail', 'derail', 'fire', 'cut', 'strike', 'rumor'];
        const kind = kinds[Math.floor(Math.random() * kinds.length)];
        const rivals = this.companies.filter((o) => o.alive && o.id !== c.id && !o.isPlayer);
        const tgt = Math.random() < 0.82 || !rivals.length ? 0 : rivals[Math.floor(Math.random() * rivals.length)].id;
        this.sabotage(c.id, tgt, kind, true);
      }
    }
  }

  // ---------------- events ----------------
  triggerEvent(kind?: string) {
    const pool = ['blizzard', 'flood', 'boom', 'drought', 'bandits', 'strike', 'wildfire', 'panic', 'grant', 'inspection'];
    const w = this.mods.has('winters') ? ['blizzard', 'flood', 'blizzard'] : [];
    const k = kind || [...pool, ...w][Math.floor(Math.random() * (pool.length + w.length))];
    this.stats.events++;
    const rnd = (n: number) => Math.floor(Math.random() * n);
    switch (k) {
      case 'blizzard': {
        const hills: number[] = [];
        for (let i = 0; i < W * H; i++) if (this.terr[i] === T_HILL || this.terr[i] === T_MOUNT) hills.push(i);
        const c = hills.length ? hills[rnd(hills.length)] : rnd(W * H);
        this.zones.push({ kind: 'blizzard', x: c % W, y: Math.floor(c / W), r: 8, start: this.t, until: this.t + 28 });
        this.addNews('BLIZZARD! Trains crawl through the storm near the high country.', 'warn'); this.sfx('wind'); break;
      }
      case 'flood': {
        const ws: number[] = [];
        for (let i = 0; i < W * H; i++) { const x = i % W, y = Math.floor(i / W); if (this.terr[i] === T_WATER && x > 3 && x < W - 4 && y > 2 && y < H - 3) ws.push(i); }
        if (!ws.length) return;
        const c = ws[rnd(ws.length)];
        const cx = c % W, cy = Math.floor(c / W);
        let n = 0;
        for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 5; x <= cx + 5; x++) {
          if (!this.inb(x, y) || (x - cx) ** 2 + (y - cy) ** 2 > 25) continue;
          const i = y * W + x;
          if (!this.trk[i] || this.stAt[i] >= 0) continue;
          const chance = this.terr[i] === T_WATER ? (this.has('steelbridge') ? 0.3 : 0.65) : 0.1;
          if (Math.random() < chance) { const o = this.own[i]; const mk = this.clearTile(i); if (o >= 0) this.ruins.push({ i, mask: mk, owner: o, t: this.t }); n++; }
        }
        this.zones.push({ kind: 'flood', x: cx, y: cy, r: 5, start: this.t, until: this.t + 20 });
        this.addNews(n ? `FLOOD! Rivers burst their banks and wash out ${n} track tiles. Use Repair in the Build tab.` : 'FLOOD! The river swells, but no rails are lost.', n ? 'bad' : 'info');
        this.sfx('flood'); this.addShake(5); break;
      }
      case 'boom': {
        const t = this.towns[rnd(this.towns.length)];
        t.boomUntil = this.t + 60; t.pop *= 1.12;
        this.zones.push({ kind: 'boom', x: t.x, y: t.y, r: 3, start: this.t, until: this.t + 20 });
        this.addNews(`GOLD RUSH in ${t.name}! Population surges and fares are high for a year.`, 'good'); this.sfx('event');
        this.burst(t.x * TILE, t.y * TILE, '#ffd24a', 30, 'coin', 90); break;
      }
      case 'drought': {
        const farms = this.inds.filter((i) => i.ik === 'farm');
        farms.forEach((f) => { f.downUntil = this.t + 20; });
        this.addNews('DROUGHT! The farms shrivel; no grain for a few months.', 'warn'); this.sfx('event'); break;
      }
      case 'wildfire': {
        const lum = this.inds.filter((i) => i.ik === 'lumber');
        lum.forEach((f) => { f.downUntil = this.t + 22; this.burst(f.x * TILE + 12, f.y * TILE + 12, '#ff8a3a', 20, 'spark', 70); });
        this.addNews('WILDFIRE! The lumber camps burn; timber supply halts.', 'warn'); this.sfx('explode'); this.addShake(3); break;
      }
      case 'bandits': {
        if (!this.trains.length) return;
        const tr = this.trains[rnd(this.trains.length)];
        const guard = this.comp(tr.owner).security;
        if (Math.random() < guard * 0.28) { if (tr.owner === 0) this.addNews('Bandits tried to rob a train but your guards drove them off!', 'good'); break; }
        const p = this.trainXY(tr, 0);
        const loss = Math.round(tr.load);
        tr.cargo = emptyStore(); tr.load = 0;
        if (tr.owner === 0) { this.pl.cash -= 800; this.addNews(`BANDITS held up ${tr.name}! ${loss} units stolen and $800 taken.`, 'bad'); this.floater(p.x, p.y - 8, 'HELD UP!', '#ff7a5a', true); this.sfx('caught'); this.addShake(3); }
        else this.addNews(`Bandits held up a ${this.comp(tr.owner).name} train.`, 'info');
        break;
      }
      case 'strike': {
        const c = this.companies.filter((x) => x.alive)[rnd(this.companies.filter((x) => x.alive).length)];
        this.trains.filter((t) => t.owner === c.id).forEach((t) => { t.haltUntil = Math.max(t.haltUntil, this.t + 15); });
        this.addNews(`LABOR STRIKE at ${c.name}! Their trains sit idle.`, c.isPlayer ? 'bad' : 'info'); this.sfx('event'); break;
      }
      case 'panic': {
        this.companies.forEach((c) => { c.sent -= 0.28; });
        this.panicUntil = this.t + 40;
        this.addNews('PANIC ON WALL STREET! Stocks plunge and interest rates spike.', 'bad'); this.sfx('warn'); this.addShake(4); break;
      }
      case 'grant': {
        this.grantUntil = this.t + 60;
        this.addNews('LAND GRANT! Congress slashes right-of-way costs by 30% for a year.', 'good'); this.sfx('event'); break;
      }
      case 'inspection': {
        if (this.notoriety > 25) { const f = Math.round(1000 + this.notoriety * 40); this.pl.cash -= f; this.rep = Math.max(0, this.rep - 3); this.addNews(`Railroad Commissioner audits you: fined $${f.toLocaleString()} for suspicious activity.`, 'bad'); this.sfx('caught'); }
        else { this.rep = Math.min(100, this.rep + 3); this.addNews('The Railroad Commissioner praises your clean operation. Reputation up.', 'good'); this.sfx('event'); }
        break;
      }
    }
  }
  updateZones() {
    const n = this.zones.length;
    this.zones = this.zones.filter((z) => z.until > this.t);
    return n !== this.zones.length;
  }

  // ---------------- contracts & research ----------------
  makeContract() {
    if (this.contracts.filter((k) => !k.active).length >= 3) return;
    const towns = this.towns.filter((t) => t.pop >= 150);
    const facs = this.inds.filter((i) => i.ik === 'factory');
    const hasFactoryChain = facs.length > 0 && this.inds.some((i) => i.ik === 'mine') && this.inds.some((i) => i.ik === 'lumber');
    const opts: { cargo: Cargo; kind: 'town' | 'ind'; id: number; name: string }[] = [];
    for (const t of towns) {
      (['pass', 'mail', 'grain', 'coal'] as Cargo[]).forEach((c) => opts.push({ cargo: c, kind: 'town', id: t.id, name: t.name }));
      if (hasFactoryChain) opts.push({ cargo: 'goods', kind: 'town', id: t.id, name: t.name });
    }
    for (const f of facs) (['coal', 'timber'] as Cargo[]).forEach((c) => opts.push({ cargo: c, kind: 'ind', id: f.id, name: f.name }));
    if (!opts.length) return;
    const o = opts[Math.floor(Math.random() * opts.length)];
    const qty = { pass: 120, mail: 80, coal: 150, grain: 140, timber: 120, goods: 70 }[o.cargo] * (0.8 + Math.random() * 0.6);
    const q = Math.round(qty / 10) * 10;
    const reward = Math.round((q * CARGO_INFO[o.cargo].rate * 14 * 1.9) / 50) * 50;
    this.contracts.push({
      id: this.idc++, cargo: o.cargo, qty: q, got: 0, sinkKind: o.kind, sinkId: o.id, sinkName: o.name, reward, penalty: Math.round(reward * 0.3 / 50) * 50,
      deadline: 0, offerUntil: this.t + MONTH_LEN * 7, active: false,
    });
  }
  acceptContract(id: number) {
    const k = this.contracts.find((c) => c.id === id);
    if (!k) return { ok: false, msg: '' };
    if (this.contracts.filter((c) => c.active).length >= 3) return { ok: false, msg: 'Max 3 active contracts.' };
    k.active = true; k.deadline = this.t + MONTH_LEN * (8 + Math.floor(Math.random() * 4));
    this.sfx('click');
    return { ok: true, msg: 'Contract accepted.' };
  }
  declineContract(id: number) { this.contracts = this.contracts.filter((c) => c.id !== id || c.active); this.sfx('click'); }
  startResearch(id: string) {
    const t = TECHS.find((x) => x.id === id);
    if (!t || this.techs.has(id)) return { ok: false, msg: '' };
    if (this.research) return { ok: false, msg: 'The Engineering Office is busy.' };
    if (t.req && !this.techs.has(t.req)) return { ok: false, msg: 'Requires earlier research.' };
    if (!this.spend(this.pl, t.cost)) return { ok: false, msg: `Need $${t.cost.toLocaleString()}.` };
    this.research = { id, left: t.time, total: t.time };
    this.sfx('click');
    return { ok: true, msg: `Researching ${t.name}.` };
  }
  setSecurity(lv: number) {
    this.pl.security = Math.max(0, Math.min(3, lv)); this.sfx('click');
  }

  // ---------------- main update ----------------
  update(dt: number) {
    if (this.over) return;
    dt = Math.min(dt, 0.2);
    this.t += dt;
    this.monthAcc += dt;
    while (this.monthAcc >= MONTH_LEN && !this.over) { this.monthAcc -= MONTH_LEN; this.monthTick(); }
    if (this.over) return;
    for (const tr of this.trains) this.updateTrain(tr, dt);
    this.marketAcc += dt;
    if (this.marketAcc >= 1) { this.marketAcc -= 1; this.marketTick(); this.histAcc++; if (this.histAcc % 2 === 0) for (const c of this.companies) { if (c.alive) { c.priceHist.push(c.price); if (c.priceHist.length > 90) c.priceHist.shift(); } } }
    if (this.updateZones()) { /* zones expire */ }
    if (this.research) {
      this.research.left -= dt;
      if (this.research.left <= 0) {
        const t = TECHS.find((x) => x.id === (this.research as { id: string }).id);
        this.techs.add((this.research as { id: string }).id); this.research = null;
        this.addNews(`Research complete: ${t?.name}!`, 'good'); this.sfx('research');
        this.burst(W * TILE / 2, H * TILE / 2, '#9fd3ff', 20, 'ring', 30);
      }
    }
    // AI
    if (!this.tut.on) {
      for (const c of this.companies) if (!c.isPlayer && c.alive && this.t >= c.nextThink) aiThink(this, c);
      this.nextEvent -= dt;
      if (this.nextEvent <= 0) { this.triggerEvent(); this.nextEvent = (26 + Math.random() * 30) / this.diff.ev / (this.mods.has('winters') ? 1.3 : 1); }
    }
    this.nextContract -= dt;
    if (this.nextContract <= 0 && !this.tut.on) { this.makeContract(); this.nextContract = MONTH_LEN * 2.5; }
    this.spikeAcc += dt;
    if (this.spikeAcc > 2) { this.spikeAcc = 0; this.checkSpike(); }
    this.tutAcc += dt;
    if (this.tutAcc > 0.4) { this.tutAcc = 0; this.checkTutorial(); this.updateIntensity(); }
  }
  updateIntensity() {
    const ok = this.trains.filter((t) => t.owner === 0 && t.state === 'moving').length;
    const ev = this.zones.length * 0.12;
    const yearsLeft = (this.endYear - this.year) / 15;
    this.intensity = Math.min(1, 0.15 + Math.min(0.3, ok * 0.05) + ev + this.notoriety / 250 + (1 - yearsLeft) * 0.3 + (this.pl.cash < 0 ? 0.25 : 0));
  }
  checkSpike() {
    const west = this.towns[0], east = this.towns[this.towns.length - 1];
    for (const c of this.companies) {
      if (!c.alive || c.spikeDone) continue;
      if (this.townsConnected(c.id, west, east)) {
        c.spikeDone = true;
        if (!this.spike) {
          this.spike = { by: c.id, t: this.t };
          c.sent += 0.25;
          if (c.isPlayer) {
            c.cash += 35000; this.rep = Math.min(100, this.rep + 15);
            this.addNews('THE GOLDEN SPIKE! You link the Pacific to the Atlantic first! +$35,000 and national fame!', 'good');
            this.sfx('spike'); this.addShake(8);
            this.burst(west.x * TILE, west.y * TILE, '#ffd24a', 40, 'coin', 120); this.burst(east.x * TILE, east.y * TILE, '#ffd24a', 40, 'coin', 120);
            const m = loadMeta(); m.spikes++; saveMeta(m);
          } else {
            c.cash += 30000;
            this.addNews(`${c.name} drives the Golden Spike first! The transcontinental glory is lost to you.`, 'bad');
            this.sfx('warn'); this.addShake(6);
          }
        } else if (c.isPlayer) {
          this.addNews('Your coast-to-coast line is complete, but the Golden Spike was already driven.', 'info');
        }
      }
    }
  }
  checkTutorial() {
    if (!this.tut.on) return;
    const s = this.tut.step;
    const mine = this.stations.filter((x) => x.owner === 0);
    let done = false;
    switch (s) {
      case 0: done = !!this.flags.panned; break;
      case 1: done = mine.length >= 1; break;
      case 2: done = mine.length >= 2; break;
      case 3: done = mine.length >= 2 && mine.some((a) => mine.some((b) => a !== b && this.trk[a.tile] && this.trk[b.tile] && !!this.bfs(a.tile, b.tile))); break;
      case 4: done = this.trains.some((t) => t.owner === 0); break;
      case 5: done = !!this.flags.delivered; break;
      case 6: done = !!this.flags.market; break;
      case 7: done = !!this.flags.rivals; break;
      case 8: done = !!this.flags.finish; break;
    }
    if (done) {
      this.tut.step++; this.sfx('research');
      if (this.tut.step >= TUT_STEPS.length) this.endTutorial();
    }
  }
  endTutorial() {
    this.tut.on = false; this.tut.done = true;
    this.companies.forEach((c, i) => { if (i > 0) c.nextThink = this.t + 15 + i * 8; });
    this.nextEvent = this.t + 50;
    const m = loadMeta(); m.tutorialDone = true; saveMeta(m);
    this.addNews('The tutorial is over. Rivals awaken and the frontier turns hostile!', 'warn');
  }

  // ---------------- victory / defeat ----------------
  rankings() {
    return this.companies.filter((c) => c.alive).map((c) => ({ c, w: this.worth(c) })).sort((a, b) => b.w - a.w);
  }
  checkVictory() {
    if (this.over || this.tut.on || this.freeplay) return;
    const w = this.worth(this.pl);
    if (this.spike?.by === 0 && w >= this.diff.target) { this.finish('win', 'empire'); return; }
    if (this.companies.slice(1).every((c) => !c.alive)) { this.finish('win', 'monopoly'); return; }
    if (this.year >= this.endYear) {
      const r = this.rankings();
      if (r[0].c.isPlayer) this.finish('win', 'tycoon'); else this.finish('lose', 'outcompeted');
    }
  }
  finish(result: 'win' | 'lose', reason: string) {
    if (this.over) return;
    const w = Math.round(this.worth(this.pl));
    const r = this.rankings();
    const rank = Math.max(1, r.findIndex((x) => x.c.isPlayer) + 1);
    const mulD = this.diff.lpMul * [...this.mods].reduce((a, id) => a * (MODS.find((m) => m.id === id)?.lpMul || 1), 1);
    const years = Math.max(0, this.monthCount / 12);
    let lp = Math.floor((Math.max(0, w) / 5000 + this.stats.contracts * 2 + this.stats.absorbed * 12 + (this.spike?.by === 0 ? 14 : 0) + years) * mulD);
    if (result === 'win') lp += Math.round(25 * mulD);
    const T: Record<string, [string, string]> = {
      empire: ['EMPIRE OF STEEL', 'You drove the Golden Spike first and amassed a fortune beyond reckoning. The frontier is yours.'],
      monopoly: ['THE LAST BARON STANDING', 'Every rival has been swallowed. One railroad now spans the continent: yours.'],
      tycoon: ['BARON OF THE FRONTIER', `${this.endYear} dawns and no one on the frontier is richer than you. The history books will remember your name.`],
      bankrupt: ['BANKRUPT', 'Creditors seize your locomotives and auction the rails. The prairie reclaims your dreams.'],
      takeover: ['HOSTILE TAKEOVER', 'A rival now owns the majority of your shares. The board has voted you out of your own company.'],
      outcompeted: ['OUTMANEUVERED', `The clock strikes ${this.endYear}. Another baron stands richer than you, and your name fades.`],
    };
    if (this.rewarded) lp = 0;
    else {
      const m = loadMeta();
      m.lp += lp; m.runs++; if (result === 'win') m.wins++;
      m.best.push({ name: this.pl.name, score: w, year: this.year, result: T[reason]?.[0] || reason, diff: this.diff.name });
      m.best.sort((a, b) => b.score - a.score); m.best = m.best.slice(0, 5);
      saveMeta(m);
      this.rewarded = true;
    }
    this.over = { result, title: T[reason]?.[0] || reason, text: T[reason]?.[1] || '', lp, score: w, rank, stats: this.stats, years, worth: w, spike: this.spike?.by === 0 };
    this.sfx(result === 'win' ? 'win' : 'lose');
  }
}
export type { Packet };
