import {
  ABILITIES, BDEFS, BType, buildWave, clamp, Cost, Diff, EDEF, ENGDEFS, EType, H, hasCharter, LAGOON_MAX_Y,
  LAGOON_MIN_Y, MEAN_SEA, PLOT_BY_ID, PLOTS, ResKey, rnd, Save, seabedY, Spawn, TIDE_T, TUT, W, WALL_TOP0, WALL_X0,
  WALL_X1, WAVE_COUNT, writeSave,
} from './data';
import { audio } from './audio';

export type Sel = { k: 'plot'; id: string } | { k: 'gate'; i: number } | { k: 'wall' } | { k: 'keep' } | null;
export interface Building {
  id: number; type: BType; plot: string; level: number; hp: number; maxHp: number; crew: number; burning: number;
  flooded: boolean; charge: number; aim: number; recoil: number; born: number; status: string; eff: number;
  depth: number; flash: number; band: number; wasFlooded: boolean; noAmmoT: number;
}
export interface Enemy {
  id: number; type: EType; x: number; y: number; vx: number; hp: number; maxHp: number; draft: number; size: number;
  aground: boolean; wasAg: boolean; cd: number; tgt: Building | null; tcd: number; hit: number; slow: number;
  phase: number; sumT: number; castT: number; bob: number; dead: boolean;
}
export interface Proj { x: number; y: number; vx: number; vy: number; g: number; k: 'bolt' | 'ball' | 'boulder' | 'eball' | 'eshell' | 'efire'; own: 0 | 1; dmg: number; aoe: number; life: number; ty: number; mul: number; dry: boolean }
export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; col: string; g: number; k: 0 | 1 | 2; drag: number }
export interface FText { x: number; y: number; txt: string; col: string; life: number; size: number }
export interface Crate { id: number; x: number; y: number; kind: ResKey | 'rations'; amt: number; life: number; gold: boolean }
export interface Beam { x1: number; y1: number; x2: number; y2: number; life: number; max: number; k: 'jet' | 'arc' }
export interface Gate { name: string; sill: number; mode: 0 | 1 | 2; open: number; lvl: number; flow: number }
export interface GEvent { type: 'surge' | 'rogue' | 'fog' | 'redtide' | 'market'; t: number; dur: number; amp: number }
export interface Stats {
  kills: number; killsBy: Record<string, number>; bosses: number; dmgDealt: number; goldEarned: number; stoneMined: number;
  ironForged: number; powerGen: number; grounded: number; lost: number; shots: number; waves: number; flotsam: number;
  floods: number; breaches: number; peakFlood: number; desertions: number;
}
export interface Opts { diff: Diff; mods: string[]; save: Save; tutorial: boolean; demo?: boolean; onEnd?: (r: 'victory' | 'defeat') => void }
export interface Result { gain: number; score: number; won: boolean }

export type Pick = { k: 'crate'; c: Crate } | { k: 'enemy'; e: Enemy } | { k: 'plot'; id: string } | { k: 'gate'; i: number } | { k: 'wall' } | { k: 'keep' } | null;

export class Game {
  opts: Opts; diff: Diff; mods: Set<string>; save: Save; demo: boolean;
  t = 0; S = MEAN_SEA; L = 548; boost = 0; storm = 0.1; waveAmp = 3; tideRate = 0; lastS = MEAN_SEA;
  res = { stone: 0, iron: 0, gold: 0 };
  rations = 90; power = 20; powerCap = 100; powerGen = 0; powerUse = 0; housing = 8; obsRange = 0; messEff = 0;
  crew = 8; morale = 62; moraleBuff = 0; policy: 0 | 1 | 2 = 1; mutinyT = 0; marketMul = 1;
  buildings: Building[] = []; enemies: Enemy[] = []; projs: Proj[] = []; parts: Part[] = []; texts: FText[] = [];
  crates: Crate[] = []; beams: Beam[] = []; events: GEvent[] = []; casts: { t: number; dur: number; amp: number }[] = [];
  gates: Gate[] = [
    { name: 'Upper Sluice', sill: 450, mode: 0, open: 0, lvl: 1, flow: 0 },
    { name: 'Deep Sluice', sill: 560, mode: 0, open: 0, lvl: 1, flow: 0 },
  ];
  keep!: Building; wall!: Building;
  nextId = 10; wave = 0; waveClock = 0; queue: Spawn[] = []; waveTotal = 0; countdown = 55; waveActive = false;
  nextEventT = 80; crateT = 12; cd: Record<string, number> = {};
  sel: Sel = null; focus = 0; shake = 0; flashT = 0;
  banner: { text: string; sub: string; t: number; col: string } | null = null;
  log: { t: number; msg: string; col: string }[] = [];
  state: 'play' | 'victory' | 'defeat' = 'play';
  stats: Stats = { kills: 0, killsBy: {}, bosses: 0, dmgDealt: 0, goldEarned: 0, stoneMined: 0, ironForged: 0, powerGen: 0, grounded: 0, lost: 0, shots: 0, waves: 0, flotsam: 0, floods: 0, breaches: 0, peakFlood: 0, desertions: 0 };
  tutActive = false; tutStep = 0; tutGate = false; tutWave = false; tutBuilt = new Set<string>();
  endless = false; won = false; ended = false; bossDown = false; wasBreached = false; result: Result | null = null;
  carpEff = 0; rainSeed = Math.random() * 100; overtopT = 0;

  constructor(o: Opts) {
    this.opts = o; this.diff = o.diff; this.mods = new Set(o.mods); this.save = o.save; this.demo = !!o.demo;
    const c = (id: string) => this.save.charter[id] || 0;
    this.res = { stone: 130 + 25 * c('found'), iron: 45, gold: 50 + 25 * c('merchant') };
    if (this.diff.res > 1) { this.res.stone = Math.round(this.res.stone * 1.15); }
    this.crew = 8 + 2 * c('guild');
    this.countdown = o.tutorial ? Infinity : this.diff.grace;
    this.tutActive = o.tutorial;
    const gm = 1 + 0.2 * c('granite');
    this.keep = this.mk('keep', 'KEEP', BDEFS.keep.hp * gm);
    this.wall = this.mk('wall', 'WALL', BDEFS.wall.hp * gm);
    this.S = this.tideAt(0); this.lastS = this.S;
    this.L = Math.max(this.S, 548);
    if (!this.demo) this.msg('The citadel awaits your orders, Harbormaster.', '#9fe3ef');
  }

  c(id: string) { return this.save.charter[id] || 0; }
  private mk(type: BType, plot: string, hp: number): Building {
    const b: Building = { id: this.nextId++, type, plot, level: 1, hp, maxHp: hp, crew: 0, burning: 0, flooded: false, charge: 0, aim: 0, recoil: 0, born: 0, status: '', eff: 1, depth: -999, flash: 0, band: 0, wasFlooded: false, noAmmoT: 0 };
    this.buildings.push(b);
    return b;
  }

  // ---------- tide ----------
  ampAt(t: number) { return (88 + 27 * Math.sin((2 * Math.PI * t) / (TIDE_T * 8) + 0.6)) * (this.mods.has('spring') ? 1.3 : 1); }
  tideAt(t: number) { return MEAN_SEA + this.ampAt(t) * Math.cos((2 * Math.PI * t) / TIDE_T); }
  get wallTop() { return WALL_TOP0 - 30 * (this.wall.level - 1); }
  get breached() { return this.wall.hp <= 0; }
  surf(x: number) {
    const a = this.waveAmp;
    return this.S + Math.sin(x * 0.018 + this.t * 1.6) * a + Math.sin(x * 0.047 - this.t * 2.3) * a * 0.4;
  }
  evEnv(e: { t: number; dur: number }) { return Math.pow(Math.sin(Math.PI * clamp(e.t / e.dur, 0, 1)), 0.5); }
  hasEvent(type: GEvent['type']) { return this.events.some((e) => e.type === type); }

  // ---------- utility ----------
  msg(m: string, col = '#e8efe8') { this.log.push({ t: this.t, msg: m, col }); if (this.log.length > 8) this.log.shift(); }
  ftext(x: number, y: number, txt: string, col = '#fff', size = 14) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x, y, txt, col, life: 1.2, size });
  }
  addShake(a: number) { if (this.save.settings.shake) this.shake = Math.min(18, Math.max(this.shake, a)); }
  burst(x: number, y: number, n: number, col: string, spd: number, life: number, size: number, g = 300, k: 0 | 1 | 2 = 0) {
    if (!this.save.settings.particles) n = Math.ceil(n / 2.5);
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 1100) return;
      const a = Math.random() * Math.PI * 2; const s = Math.random() * spd;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.3, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), col, g, k, drag: 0.5 });
    }
  }
  ring(x: number, y: number, size: number, col: string) { this.parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size, col, g: 0, k: 2, drag: 0 }); }
  splash(x: number, big = 1, snd = true) {
    const y = this.surf(x);
    for (let i = 0; i < 6 * big; i++) this.parts.push({ x: x + rnd(-6, 6), y, vx: rnd(-40, 40), vy: rnd(-160, -60) * big, life: 0.7, max: 0.7, size: rnd(1.5, 3.5), col: '#bfeaf2', g: 420, k: 0, drag: 0.2 });
    if (snd) audio.sfx('splash');
  }
  bpos(b: Building): { x: number; y: number } {
    if (b.type === 'keep') return { x: 75, y: 205 };
    if (b.type === 'wall') return { x: WALL_X1, y: 430 };
    const p = PLOT_BY_ID[b.plot];
    return { x: p.x, y: p.y - (p.kind === 'mount' ? 20 : 28) };
  }
  rectOf(b: Building): [number, number, number, number] {
    if (b.type === 'keep') return [20, 150, 130, 262];
    if (b.type === 'wall') return [WALL_X0, this.wallTop, WALL_X1, 570];
    const p = PLOT_BY_ID[b.plot];
    return p.kind === 'mount' ? [p.x - 22, p.y - 44, p.x + 22, p.y + 4] : [p.x - 26, p.y - 56, p.x + 26, p.y];
  }
  distRect(b: Building, x: number, y: number) {
    const r = this.rectOf(b);
    const dx = Math.max(r[0] - x, 0, x - r[2]); const dy = Math.max(r[1] - y, 0, y - r[3]);
    return Math.hypot(dx, dy);
  }
  freeCrew() { return this.crew - this.buildings.reduce((a, b) => a + b.crew, 0); }
  canAfford(c: Cost) { return (c.stone || 0) <= this.res.stone && (c.iron || 0) <= this.res.iron && (c.gold || 0) <= this.res.gold; }
  pay(c: Cost) { if (!this.canAfford(c)) return false; this.res.stone -= c.stone || 0; this.res.iron -= c.iron || 0; this.res.gold -= c.gold || 0; return true; }
  addRes(k: ResKey, a: number) {
    if (k === 'gold') { a *= 1 + 0.12 * this.c('merchant'); this.stats.goldEarned += a; }
    if (k === 'stone') this.stats.stoneMined += a;
    if (k === 'iron') this.stats.ironForged += a;
    this.res[k] += a;
  }
  buildingAt(plot: string) { return this.buildings.find((b) => b.plot === plot) || null; }
  selB(): Building | null {
    if (!this.sel) return null;
    if (this.sel.k === 'plot') return this.buildingAt(this.sel.id);
    if (this.sel.k === 'keep') return this.keep;
    if (this.sel.k === 'wall') return this.wall;
    return null;
  }
  upCost(b: Building): Cost {
    const base = b.type === 'wall' ? { stone: 90 * b.level, iron: 30 * b.level } : b.type === 'keep' ? {} : BDEFS[b.type].cost;
    const m = b.type === 'wall' ? 1 : 0.9 * b.level + 0.4;
    const out: Cost = {};
    (Object.keys(base) as ResKey[]).forEach((k) => { out[k] = Math.ceil((base[k] || 0) * m); });
    return out;
  }
  gateUpCost(g: Gate): Cost { return { stone: 60 * g.lvl, iron: 25 * g.lvl }; }

  // ---------- player actions ----------
  setSel(s: Sel) {
    this.sel = s;
    if (s) audio.sfx('ui');
  }
  pick(x: number, y: number): Pick {
    for (const c of this.crates) if (Math.hypot(c.x - x, c.y - 4 - y) < 24) return { k: 'crate', c };
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (Math.abs(x - e.x) < e.size * 0.55 && y > e.y - e.size * 0.6 && y < e.y + e.size * 0.25) return { k: 'enemy', e };
    }
    for (let i = 0; i < this.gates.length; i++) if (x > WALL_X0 - 4 && x < WALL_X1 + 4 && y > this.gates[i].sill - 42 && y < this.gates[i].sill + 2) return { k: 'gate', i };
    for (const p of PLOTS) {
      const r = p.kind === 'mount' ? [p.x - 24, p.y - 48, p.x + 24, p.y + 8] : [p.x - 29, p.y - 62, p.x + 29, p.y + 4];
      if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return { k: 'plot', id: p.id };
    }
    if (x > 20 && x < 130 && y > 150 && y < 262) return { k: 'keep' };
    if (x > WALL_X0 && x < WALL_X1 && y > this.wallTop && y < 570) return { k: 'wall' };
    return null;
  }
  click(x: number, y: number) {
    if (this.state !== 'play') return;
    const p = this.pick(x, y);
    if (!p) { this.sel = null; return; }
    if (p.k === 'crate') this.collect(p.c);
    else if (p.k === 'enemy') { this.focus = this.focus === p.e.id ? 0 : p.e.id; audio.sfx('tick'); this.ftext(p.e.x, p.e.y - p.e.size * 0.7, this.focus ? 'FOCUS' : 'free fire', '#ffd166', 12); }
    else if (p.k === 'plot') this.setSel({ k: 'plot', id: p.id });
    else if (p.k === 'gate') { this.toggleGate(p.i); this.sel = { k: 'gate', i: p.i }; }
    else if (p.k === 'keep') this.setSel({ k: 'keep' });
    else if (p.k === 'wall') this.setSel({ k: 'wall' });
  }
  collect(c: Crate) {
    this.crates = this.crates.filter((q) => q !== c);
    if (c.kind === 'rations') this.rations = Math.min(400, this.rations + c.amt); else this.addRes(c.kind, c.amt);
    this.stats.flotsam++;
    this.ftext(c.x, c.y - 20, `+${c.amt} ${c.kind}`, c.gold ? '#ffd166' : '#b8f0c8', 16);
    this.burst(c.x, c.y, 10, c.gold ? '#ffd166' : '#b8f0c8', 120, 0.6, 3, 200);
    audio.sfx('pickup');
  }
  build(plotId: string, type: BType): boolean {
    const plot = PLOT_BY_ID[plotId]; const def = BDEFS[type];
    if (!plot || !def || this.buildingAt(plotId) || !def.kinds.includes(plot.kind)) return false;
    if (def.wallOnly && !plot.wallMount) return false;
    if ((def.unlock && !hasCharter(this.save, def.unlock)) || (plot.req && !hasCharter(this.save, plot.req))) return false;
    if (!this.pay(def.cost)) { audio.sfx('err'); this.ftext(plot.x, plot.y - 60, 'Cannot afford', '#ff8a70'); return false; }
    const b = this.mk(type, plotId, def.hp);
    b.crew = Math.min(def.crew, Math.max(0, this.freeCrew()));
    b.charge = 0;
    this.tutBuilt.add(type);
    audio.sfx('build');
    this.burst(plot.x, plot.y, 18, '#d9c9a0', 140, 0.7, 3, 400, 1);
    this.ftext(plot.x, plot.y - 64, `${def.name} raised`, '#9fe3ef');
    if (b.crew < def.crew) this.msg(`${def.name} needs ${def.crew - b.crew} more crew.`, '#ffd166');
    return true;
  }
  upgrade(b: Building): boolean {
    if (b.level >= 3) return false;
    const cost = this.upCost(b);
    if (!this.pay(cost)) { audio.sfx('err'); return false; }
    b.level++;
    if (b.type === 'wall') {
      const add = 1000 * (1 + 0.2 * this.c('granite')) * 0.35;
      b.maxHp += add; b.hp += add;
      this.msg(`Seawall raised to level ${b.level}: taller and stronger.`, '#9fe3ef');
    } else { const add = BDEFS[b.type].hp * 0.25; b.maxHp += add; b.hp += add; }
    audio.sfx('upgrade');
    const p = this.bpos(b);
    this.burst(p.x, p.y, 20, '#ffe08a', 160, 0.8, 3, 100);
    this.ftext(p.x, p.y - 40, `Level ${b.level}!`, '#ffe08a', 16);
    return true;
  }
  upgradeGate(i: number) {
    const g = this.gates[i]; if (!g || g.lvl >= 3) return;
    if (!this.pay(this.gateUpCost(g))) { audio.sfx('err'); return; }
    g.lvl++; audio.sfx('upgrade');
    this.ftext(WALL_X0 + 20, g.sill - 50, `${g.name} Lv${g.lvl}`, '#ffe08a', 15);
  }
  repair(b: Building) {
    const missing = b.maxHp - b.hp; if (missing < 1) return;
    const ratio = b.type === 'wall' ? 0.05 : 0.08;
    const pay = Math.min(this.res.stone, missing * ratio);
    const heal = pay / ratio;
    if (heal < 1) { audio.sfx('err'); return; }
    this.res.stone -= pay; b.hp = Math.min(b.maxHp, b.hp + heal); b.burning = 0;
    audio.sfx('repair');
    const p = this.bpos(b);
    this.ftext(p.x, p.y - 30, `+${Math.round(heal)} HP`, '#b8f0c8');
  }
  demolish(b: Building) {
    if (b.type === 'keep' || b.type === 'wall') return;
    const c = BDEFS[b.type].cost;
    this.res.stone += Math.floor((c.stone || 0) * 0.5);
    this.buildings = this.buildings.filter((x) => x !== b);
    if (this.sel && this.sel.k === 'plot' && this.sel.id === b.plot) this.sel = null;
    audio.sfx('back');
  }
  setCrew(b: Building, d: number) {
    const def = BDEFS[b.type]; const nv = clamp(b.crew + d, 0, def.crew);
    if (d > 0 && this.freeCrew() < d) { audio.sfx('err'); return; }
    b.crew = nv; audio.sfx('tick');
  }
  recruitCost() { return 18 + 4 * Math.max(0, this.crew - 8); }
  recruit() {
    if (this.crew >= this.housing) { audio.sfx('err'); this.ftext(75, 130, 'No housing! Build Barracks', '#ff8a70'); return; }
    const c = this.recruitCost();
    if (this.res.gold < c) { audio.sfx('err'); return; }
    this.res.gold -= c; this.crew++; this.moraleBuff += 1.5; audio.sfx('coin');
    this.ftext(75, 140, '+1 sailor', '#b8f0c8');
  }
  toggleGate(i: number) {
    const g = this.gates[i]; if (!g) return;
    g.mode = ((g.mode + 1) % 3) as 0 | 1 | 2;
    this.tutGate = this.tutGate || g.mode !== 0;
    audio.sfx('gate');
    this.ftext(WALL_X0 + 20, g.sill - 50, g.mode === 0 ? 'CLOSED' : g.mode === 1 ? 'OPEN' : 'AUTO', '#9fe3ef', 13);
  }
  callWave() {
    if (this.demo || this.state !== 'play') return;
    const canCall = Number.isFinite(this.countdown) && this.countdown > 4 && (this.wave < WAVE_COUNT || this.endless);
    const tutCall = this.tutActive && !this.tutWave && this.wave === 0;
    if (canCall || tutCall) {
      if (canCall && this.wave > 0) { const b = Math.floor(this.countdown * 0.4); if (b > 0) { this.addRes('gold', b); this.ftext(640, 120, `Early call bonus +${b}g`, '#ffd166', 16); } }
      this.countdown = 0.05; this.tutWave = true;
    }
  }
  trade(kind: 'sellStone' | 'buyIron' | 'sellIron' | 'buyStone') {
    const m = this.marketMul;
    if (kind === 'sellStone' && this.res.stone >= 40) { this.res.stone -= 40; this.addRes('gold', Math.round(18 * m)); }
    else if (kind === 'buyIron' && this.res.gold >= Math.round(30 / m)) { this.res.gold -= Math.round(30 / m); this.res.iron += 20; }
    else if (kind === 'sellIron' && this.res.iron >= 20) { this.res.iron -= 20; this.addRes('gold', Math.round(24 * m)); }
    else if (kind === 'buyStone' && this.res.gold >= Math.round(24 / m)) { this.res.gold -= Math.round(24 / m); this.res.stone += 40; }
    else { audio.sfx('err'); return; }
    audio.sfx('coin');
  }
  abilityReady(id: string) { return (this.cd[id] || 0) <= 0; }
  useAbility(id: string) {
    if (this.state !== 'play' || this.demo) return;
    const def = ABILITIES.find((a) => a.id === id); if (!def || !this.abilityReady(id)) return;
    if (id === 'rally') {
      if (this.rations < 15) { audio.sfx('err'); this.ftext(640, 400, 'Not enough rations', '#ff8a70'); return; }
      this.rations -= 15; this.moraleBuff += 25; this.morale = Math.min(100, this.morale + 25); audio.sfx('rally');
      this.ftext(75, 130, 'RALLY!', '#ffd166', 22); this.burst(75, 200, 30, '#ffd166', 200, 1, 3, -50);
    } else if (id === 'arc') {
      if (this.power < 60) { audio.sfx('err'); this.ftext(640, 400, 'Not enough power', '#ff8a70'); return; }
      this.power -= 60; audio.sfx('discharge'); this.addShake(8); this.flashT = 0.25;
      for (const e of this.enemies) {
        const sh = clamp((e.y + e.draft - 440) / 140, 0, 1);
        this.beams.push({ x1: 90 + rnd(-10, 10), y1: 40, x2: e.x, y2: e.y - e.size * 0.2, life: 0.45, max: 0.45, k: 'arc' });
        this.hurtE(e, 38 * (1 + sh * 0.4) * (1 + 0.08 * this.c('ordnance')), 'arc', 1);
      }
    } else if (id === 'shore') {
      if (this.res.stone < 25) { audio.sfx('err'); this.ftext(640, 400, 'Not enough stone', '#ff8a70'); return; }
      this.res.stone -= 25; audio.sfx('repair');
      for (const b of this.buildings) if (b.hp > 0 || b.type !== 'wall') { b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.2); const p = this.bpos(b); this.ftext(p.x, p.y - 30, '+20%', '#b8f0c8', 12); }
    } else if (id === 'brigade') {
      let any = false;
      for (const b of this.buildings) if (b.burning > 0) { b.burning = 0; any = true; }
      this.L = Math.min(LAGOON_MAX_Y, this.L + 25);
      audio.sfx('jet'); this.ftext(600, 300, any ? 'Fires doused!' : 'Brigade stands down', '#9fe3ef', 16);
      for (let i = 0; i < 40; i++) this.splash(460 + Math.random() * 240, 0.3);
    }
    this.cd[id] = def.cd;
  }

  // ---------- main update ----------
  update(dtReal: number) {
    let rem = dtReal;
    while (rem > 1e-6) { const d = Math.min(rem, 0.05); this.step(d); rem -= d; }
  }
  private step(dt: number) {
    this.t += dt;
    for (const k of Object.keys(this.cd)) if (this.cd[k] > 0) this.cd[k] -= dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.updateTide(dt); this.updateEvents(dt); this.updateGates(dt); this.updateBuildings(dt);
    if (!this.demo && this.state === 'play') { this.updateWaves(dt); this.updateEnemies(dt); this.updateCrates(dt); this.updateCrew(dt); this.checkEnd(); this.tutCheck(); }
    else if (this.demo) { this.updateCrates(dt); }
    this.updateProjs(dt); this.updateFx(dt);
    this.audT -= dt;
    if (this.audT <= 0) {
      this.audT = 0.2;
      audio.setState(clamp(this.enemies.length / 8, 0, 1), this.enemies.some((e) => EDEF[e.type].boss), clamp((MEAN_SEA + 130 - this.S) / 260, 0, 1), this.tideRate);
    }
  }
  audT = 0; paid = 0; counted = false;

  private updateTide(dt: number) {
    let boost = 0;
    for (const e of this.events) if (e.type === 'surge' || e.type === 'rogue') boost += e.amp * this.evEnv(e);
    for (const c of this.casts) boost += c.amp * this.evEnv(c);
    this.boost = boost;
    this.S = clamp(this.tideAt(this.t) - boost, 250, 600);
    const r = (this.S - this.lastS) / Math.max(dt, 1e-4);
    this.tideRate += (r - this.tideRate) * 0.1; this.lastS = this.S;
    const target = this.hasEvent('surge') ? 1 : this.hasEvent('rogue') ? 0.7 : this.casts.length ? 0.45 : 0.1;
    this.storm += (target - this.storm) * Math.min(1, dt * 0.6);
    this.waveAmp = 3 + 9 * this.storm;
  }

  private updateEvents(dt: number) {
    for (const e of this.events) e.t += dt;
    this.events = this.events.filter((e) => e.t < e.dur);
    for (const c of this.casts) c.t += dt;
    this.casts = this.casts.filter((c) => c.t < c.dur);
    this.marketMul = this.hasEvent('market') ? 1.4 : 1;
    if (this.demo || this.tutActive || this.wave < 1) return;
    this.nextEventT -= dt;
    if (this.nextEventT <= 0) {
      this.nextEventT = rnd(50, 95) / this.diff.evt;
      const pool: GEvent['type'][] = ['surge', 'surge', 'surge', 'rogue', 'rogue', 'fog', 'fog', 'redtide', 'redtide', 'market', 'market'];
      this.startEvent(pool[Math.floor(Math.random() * pool.length)]);
    }
  }
  startEvent(type: GEvent['type']) {
    const amp = type === 'surge' ? 38 + this.wave * 1.5 : type === 'rogue' ? 62 : 0;
    const dur = type === 'surge' ? 24 : type === 'rogue' ? 9 : type === 'fog' ? 26 : type === 'redtide' ? 32 : 40;
    this.events.push({ type, t: 0, dur, amp });
    const m: Record<string, [string, string, string]> = {
      surge: ['STORM SURGE', 'The sea swells. Check your floodgates and low terraces!', '#ff8a70'],
      rogue: ['ROGUE WAVE', 'A wall of water is coming. Brace!', '#ff8a70'],
      fog: ['SEA FOG', 'Engine range reduced. Ships emerge late.', '#cfd8dc'],
      redtide: ['RED TIDE', 'Fisheries poisoned and crew uneasy.', '#ff6b81'],
      market: ['MERCHANT CONVOY', 'Trade prices are favorable for a while.', '#ffd166'],
    };
    this.banner = { text: m[type][0], sub: m[type][1], t: 3.4, col: m[type][2] };
    this.msg(`${m[type][0]}: ${m[type][1]}`, m[type][2]);
    audio.sfx(type === 'market' ? 'coin' : 'alarm');
    if (type === 'rogue') this.addShake(6);
  }

  private updateGates(dt: number) {
    const flowMul = (1 + 0.2 * this.c('winches')) * (this.mods.has('rusty') ? 0.55 : 1);
    const head = this.S - this.L; const ah = Math.abs(head); const br = this.breached;
    let total = 0; let pw = 0;
    const raw: number[] = [];
    for (const g of this.gates) {
      const want = br || g.mode === 1 || (g.mode === 2 && (ah > 55 || (g.open > 0.5 && ah > 14))) ? 1 : 0;
      g.open += clamp(want - g.open, -dt * 1.4, dt * 1.4);
      const passable = Math.min(this.L, this.S) < g.sill + 1 || br;
      let f = 0;
      if (g.open > 0.05 && passable && ah > 0.3) f = g.open * 2.3 * Math.sqrt(ah) * (0.8 + 0.2 * g.lvl) * flowMul * (br ? 1.8 : 1);
      g.flow = f; raw.push(f); total += f;
    }
    if (total * dt > ah) total = ah / dt;
    const sc = raw.reduce((a, b) => a + b, 0) > 0 ? total / raw.reduce((a, b) => a + b, 0) : 0;
    this.gates.forEach((g, i) => {
      g.flow = raw[i] * sc;
      if (!br) pw += g.flow * ah * 0.0045 * (0.5 + 0.5 * g.lvl);
    });
    this.L = clamp(this.L + Math.sign(head) * total * dt, LAGOON_MIN_Y, LAGOON_MAX_Y);
    // overtopping
    if (this.S < this.wallTop && this.L > this.S) {
      const over = this.wallTop - this.S;
      this.L = Math.max(this.S, this.L - (14 + over * 1.8) * dt);
      this.overtopT += dt;
      if (this.overtopT > 4) { this.overtopT = 0; if (!this.demo) { this.ftext(725, this.wallTop - 14, 'OVERTOPPING!', '#ff8a70', 15); audio.sfx('flood'); } }
    }
    this.powerGen = pw + 0.8;
    this.stats.powerGen += pw * dt;
    if (total > 6 && Math.random() < dt * 14) {
      for (const g of this.gates) if (g.flow > 4) this.parts.push({ x: WALL_X0 - 4 + rnd(0, 6), y: g.sill - rnd(6, 30), vx: -Math.sign(head) * -rnd(20, 60), vy: rnd(-30, 10), life: 0.6, max: 0.6, size: rnd(1.5, 3), col: '#cdeff5', g: 120, k: 0, drag: 0.5 });
    }
  }

  private updateBuildings(dt: number) {
    const moraleF = 0.6 + 0.6 * (this.morale / 100);
    const artisan = (1 + 0.12 * this.c('artisan')) * this.diff.res;
    let use = 0; let housing = 8; let cap = 150; let obs = 0; let mess = 0; let carp = 0; let fl = 0; let burn = 0; let barr = 0;
    for (const b of this.buildings.slice()) {
      b.flash = Math.max(0, b.flash - dt); b.born += dt; b.recoil = Math.max(0, b.recoil - dt * 3.5);
      if (b.type === 'keep' || b.type === 'wall') continue;
      const def = BDEFS[b.type]; const plot = PLOT_BY_ID[b.plot];
      b.depth = plot.kind === 'terrace' ? plot.y - this.L : plot.kind === 'high' ? -999 : plot.y - this.S;
      b.flooded = !def.waterproof && plot.kind !== 'mount' && plot.kind !== 'high' && b.depth > 14;
      this.stats.peakFlood = Math.max(this.stats.peakFlood, b.depth);
      if (b.flooded) {
        if (!b.wasFlooded && !this.demo) { this.stats.floods++; this.ftext(plot.x, plot.y - 70, 'FLOODED!', '#6ec6ff', 14); this.msg(`${def.name} flooded!`, '#6ec6ff'); audio.sfx('flood'); }
        b.hp -= 2.4 * dt; b.burning = 0; if (b.crew > 0) fl++;
      }
      b.wasFlooded = b.flooded;
      if (b.burning > 0) {
        b.hp -= 4.5 * dt; b.burning -= dt; burn++;
        if (this.carpEff > 0) b.burning -= dt * 2.5;
        if (Math.random() < dt * 14) this.parts.push({ x: plot.x + rnd(-14, 14), y: plot.y - rnd(20, 50), vx: rnd(-10, 10), vy: rnd(-50, -20), life: 0.7, max: 0.7, size: rnd(2, 5), col: Math.random() < 0.5 ? '#ff9f43' : '#ff5e3a', g: -40, k: 0, drag: 0.3 });
      }
      if (b.hp <= 0 && !this.demo) { this.destroy(b); continue; }
      const crewF = def.crew > 0 ? b.crew / def.crew : 1;
      const powF = def.power ? (this.power > 0.5 ? 1 : 0.55) : 1;
      b.eff = b.flooded ? 0 : crewF * moraleF * powF;
      if (def.power && crewF > 0 && !b.flooded) use += def.power * crewF * (1 + 0.25 * (b.level - 1));
      const lv = 1 + 0.35 * (b.level - 1);
      b.status = b.flooded ? 'Flooded' : crewF === 0 && def.crew > 0 ? 'Needs crew' : crewF < 1 ? 'Understaffed' : 'Working';
      switch (b.type) {
        case 'quarry': this.addRes('stone', 0.85 * b.eff * lv * artisan * dt); break;
        case 'ironworks':
          if (this.res.stone > 1) { const s = 0.45 * b.eff * dt; this.res.stone -= s; this.addRes('iron', 0.32 * b.eff * lv * artisan * dt * (0.45 / 0.45)); } else if (b.eff > 0) b.status = 'No stone';
          break;
        case 'saltworks': {
          const f = Math.max(0.2, 1 - Math.max(0, Math.abs(this.L - (plot.y + 10)) - 40) / 80);
          this.addRes('gold', 0.5 * b.eff * f * lv * artisan * dt);
          if (b.eff > 0) b.status = f > 0.9 ? 'Prime brine' : 'Pans off-level';
          break;
        }
        case 'fishery': {
          const f = this.S >= plot.y - 2 ? 1 : this.S >= plot.y - 25 ? 0.3 : 0;
          this.rations = Math.min(400, this.rations + 1.0 * b.eff * f * lv * artisan * (this.hasEvent('redtide') ? 0.3 : 1) * dt);
          if (b.eff > 0) b.status = f === 1 ? 'Pools exposed' : f > 0 ? 'Wading' : 'Under water';
          break;
        }
        case 'mess': mess += crewF * (b.flooded ? 0 : 1); break;
        case 'barracks': housing += 6 * b.level; barr++; b.status = 'Housing +' + 6 * b.level; break;
        case 'carpenter': if (b.eff > 0) carp += b.eff * b.level; break;
        case 'battery': cap += 120 * b.level; b.status = 'Storing power'; break;
        case 'observatory': if (crewF > 0) obs += b.level; break;
        default: if (def.engine) this.updateEngine(b, dt, moraleF);
      }
    }
    this.housing = housing; this.powerCap = cap; this.obsRange = obs * 0.06; this.messEff = mess; this.carpEff = carp;
    this.floodedStaffed = fl; this.burning = burn; this.barracks = barr;
    this.power = clamp(this.power + (this.powerGen - use) * dt, 0, this.powerCap); this.powerUse = use;
    if (this.power >= this.powerCap - 0.1 && this.powerGen > use + 1 && Math.random() < dt * 0.4 && !this.demo) this.ftext(75, 120, 'Batteries full', '#ffd166', 11);
    // carpenters repair
    if (carp > 0 && this.res.stone > 1) {
      let worst: Building | null = null; let ratio = 1;
      for (const b of this.buildings) { const r = b.hp / b.maxHp; if (r < ratio && b.hp > 0 && (b.type !== 'wall' || true)) { ratio = r; worst = b; } }
      if (worst && ratio < 0.999) { const heal = Math.min(carp * 3 * dt, worst.maxHp - worst.hp); const cost = heal * 0.06; if (this.res.stone >= cost) { this.res.stone -= cost; worst.hp += heal; } }
    }
  }
  floodedStaffed = 0; burning = 0; barracks = 0;

  engRange(b: Building) {
    const ed = ENGDEFS[b.type];
    return ed.range * (1 + 0.08 * (b.level - 1)) * (1 + this.obsRange) * (this.hasEvent('fog') ? 0.75 : 1);
  }
  engDmg(b: Building) {
    const ed = ENGDEFS[b.type];
    return ed.dmg * Math.pow(1.35, b.level - 1) * (1 + 0.08 * this.c('ordnance'));
  }
  engPeriod(b: Building) { return ENGDEFS[b.type].period * Math.pow(0.88, b.level - 1); }
  engRate(b: Building, moraleF: number) {
    const plot = PLOT_BY_ID[b.plot];
    if (b.type === 'hydro') { const head = this.S - this.L; return (0.1 + clamp(head / 70, 0, 1.3)) * moraleF; }
    const band = clamp(1 - Math.abs(this.S - (plot.floatY || 450)) / 65, 0, 1);
    b.band = band;
    return (0.15 + 0.85 * band) * (1 + 0.05 * this.waveAmp) * moraleF;
  }
  private updateEngine(b: Building, dt: number, moraleF: number) {
    const def = BDEFS[b.type];
    b.noAmmoT -= dt;
    if (b.crew < def.crew) { b.status = 'Needs crew'; return; }
    if (b.depth > 100) { b.status = 'Submerged'; return; }
    const rate = this.engRate(b, moraleF);
    b.charge = Math.min(1, b.charge + (dt / this.engPeriod(b)) * rate);
    b.status = b.charge >= 1 ? 'Ready' : `Charging ${Math.round(b.charge * 100)}%`;
    if (this.demo) return;
    if (b.charge >= 1) this.tryFire(b);
  }
  private tryFire(b: Building) {
    const ed = ENGDEFS[b.type]; const plot = PLOT_BY_ID[b.plot];
    const px = plot.x + 6; const py = plot.y - 26; const range = this.engRange(b);
    let best: Enemy | null = null; let bs = 1e9;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - px, e.y - e.size * 0.15 - py);
      if (d > range) continue;
      let s = d;
      if (e.id === this.focus) s -= 10000;
      if (b.type === 'catapult' && e.aground) s -= 160;
      if (b.type === 'ballista' && EDEF[e.type].armor >= 8) s += 220;
      if (b.type === 'hydro') s -= EDEF[e.type].boss ? 80 : 0;
      if (s < bs) { bs = s; best = e; }
    }
    if (!best) { b.status = 'Ready: no targets'; return; }
    if (this.res.iron < ed.ammo) { b.status = 'No iron ammo'; if (b.noAmmoT <= 0) { b.noAmmoT = 4; this.ftext(plot.x, plot.y - 56, 'No iron!', '#ff8a70', 13); audio.sfx('err'); } return; }
    this.res.iron -= ed.ammo; b.charge = 0; b.recoil = 1; this.stats.shots++;
    const tx0 = best.x; const ty = best.y - best.size * 0.15;
    b.aim = Math.atan2(ty - py, tx0 - px);
    const dmg = this.engDmg(b);
    if (ed.kind === 'jet') {
      const head = clamp(this.S - this.L, 0, 130);
      const d2 = (ed.dmg + head * 0.5) * Math.pow(1.35, b.level - 1) * (1 + 0.08 * this.c('ordnance'));
      const ang = b.aim; const len = range;
      const x2 = px + Math.cos(ang) * len; const y2 = py + Math.sin(ang) * len;
      this.beams.push({ x1: px, y1: py, x2, y2, life: 0.3, max: 0.3, k: 'jet' });
      for (const e of this.enemies) {
        const ex = e.x - px; const ey = e.y - e.size * 0.15 - py;
        const proj = clamp((ex * Math.cos(ang) + ey * Math.sin(ang)), 0, len);
        const dist = Math.hypot(ex - Math.cos(ang) * proj, ey - Math.sin(ang) * proj);
        if (dist < e.size * 0.35 + 12) this.hurtE(e, d2, 'water', 1);
      }
      this.L = Math.min(LAGOON_MAX_Y, this.L + 4);
      audio.sfx('jet');
      this.burst(px + 10, py, 8, '#cdeff5', 120, 0.4, 2.5, 100);
      return;
    }
    const dist = Math.hypot(tx0 - px, ty - py);
    const ft = Math.max(0.25, dist / ed.speed);
    const tx = tx0 + best.vx * ft;
    const vx = (tx - px) / ft; const vy = (ty - py - 0.5 * ed.g * ft * ft) / ft;
    this.projs.push({ x: px, y: py, vx, vy, g: ed.g, k: ed.kind as 'bolt' | 'ball' | 'boulder', own: 1, dmg, aoe: ed.aoe, life: ft + 1.5, ty: 0, mul: b.type === 'catapult' ? 1.8 : 1, dry: py < this.surf(px) });
    audio.sfx(b.type);
    this.burst(px + Math.cos(b.aim) * 14, py + Math.sin(b.aim) * 14, b.type === 'cannon' ? 10 : 4, b.type === 'ballista' ? '#d9c9a0' : '#ffb347', 120, 0.4, 3, 0);
    if (b.type === 'cannon') this.addShake(2.5); else if (b.type === 'catapult') this.addShake(2);
  }

  private destroy(b: Building) {
    const p = this.bpos(b); const def = BDEFS[b.type];
    this.buildings = this.buildings.filter((x) => x !== b);
    this.stats.lost++; this.moraleBuff -= 6; this.morale = Math.max(0, this.morale - 4);
    this.boom(p.x, p.y, 60, 1);
    this.msg(`${def.name} destroyed!`, '#ff8a70');
    this.ftext(p.x, p.y - 40, `${def.name} lost!`, '#ff8a70', 16);
    if (this.sel && this.sel.k === 'plot' && this.sel.id === b.plot) this.sel = null;
    this.trimCrew();
  }
  boom(x: number, y: number, r: number, power: number) {
    this.burst(x, y, 24 * power, '#ffb347', 260, 0.8, 4, 200);
    this.burst(x, y, 16 * power, '#5b5148', 160, 1.1, 6, -20);
    this.burst(x, y, 12 * power, '#ffe9a8', 300, 0.4, 2.5, 100);
    this.ring(x, y, r, '#ffd9a0');
    this.addShake(4 + r * 0.08);
    audio.sfx(r > 70 ? 'bigboom' : 'boom');
  }
  private trimCrew() {
    let guard = 0;
    while (this.freeCrew() < 0 && guard++ < 200) {
      let w: Building | null = null;
      for (const b of this.buildings) if (b.crew > 0 && (!w || b.crew >= w.crew)) w = b;
      if (!w) break; w.crew--;
    }
  }

  hurtB(b: Building, dmg: number, x: number, y: number) {
    if (this.demo || b.hp <= 0 && b.type === 'wall') return;
    dmg *= this.diff.dmg;
    b.hp -= dmg; b.flash = 0.15;
    this.ftext(x + rnd(-8, 8), y - 12, `-${Math.round(dmg)}`, '#ff8a70', 13);
    audio.sfx('hit');
    this.burst(x, y, 5, '#ffd9a0', 120, 0.4, 2.5, 300);
    this.addShake(Math.min(5, dmg * 0.08));
    this.moraleBuff -= b.type === 'keep' ? 0.8 : 0.15;
    if (b.hp <= 0) {
      if (b.type === 'wall') { b.hp = 0; }
      else if (b.type === 'keep') b.hp = 0;
      else this.destroy(b);
    }
  }
  blastBuildings(x: number, y: number, r: number, dmg: number, ignite: number) {
    for (const b of this.buildings.slice()) {
      const d = this.distRect(b, x, y);
      if (d < r) {
        this.hurtB(b, dmg * (1 - 0.5 * (d / r)), clamp(x, this.rectOf(b)[0], this.rectOf(b)[2]), clamp(y, this.rectOf(b)[1], this.rectOf(b)[3]));
        if (ignite > 0 && Math.random() < ignite && b.type !== 'wall' && !b.flooded && b.hp > 0) { b.burning = 8; audio.sfx('ignite'); }
      }
    }
  }

  hurtE(e: Enemy, dmg: number, type: 'pierce' | 'blast' | 'water' | 'arc', mul: number) {
    if (e.dead) return;
    const def = EDEF[e.type];
    let d = dmg * mul;
    if (type === 'pierce') d = Math.max(d * 0.25, d - def.armor);
    if (e.aground) d *= 1.3;
    e.hp -= d; e.hit = 0.12; this.stats.dmgDealt += d;
    if (d >= 6 || Math.random() < 0.3) this.ftext(e.x + rnd(-12, 12), e.y - e.size * 0.6, `${Math.round(d)}`, e.aground ? '#ffe08a' : '#fff', d > 40 ? 17 : 13);
    audio.sfx('hit');
    if (e.hp <= 0) this.killEnemy(e, true);
  }
  killEnemy(e: Enemy, byPlayer: boolean) {
    if (e.dead) return;
    e.dead = true;
    const def = EDEF[e.type];
    this.boom(e.x, e.y - e.size * 0.2, def.boss ? 120 : 30 + e.size * 0.3, def.boss ? 2.5 : 0.8);
    this.splash(e.x, 1.4);
    if (byPlayer) {
      this.stats.kills++; this.stats.killsBy[e.type] = (this.stats.killsBy[e.type] || 0) + 1;
      const g = Math.round(def.bounty * this.diff.res);
      this.addRes('gold', g); this.moraleBuff += def.boss ? 15 : 0.8; this.morale = Math.min(100, this.morale + (def.boss ? 12 : 0.4));
      this.ftext(e.x, e.y - e.size * 0.8, `+${g}g`, '#ffd166', 15);
      if (!def.boss && Math.random() < 0.2) this.dropCrate(e.x);
      if (def.boss) { this.stats.bosses++; if (e.type === 'leviathan') this.bossDown = true; this.banner = { text: 'FLAGSHIP SUNK', sub: def.name + ' goes down!', t: 4, col: '#ffd166' }; audio.sfx('victory'); this.dropCrate(e.x - 30); this.dropCrate(e.x + 30); this.dropCrate(e.x); }
    }
    audio.sfx('shipdie');
    if (this.focus === e.id) this.focus = 0;
  }
  dropCrate(x: number) {
    const gold = Math.random() < 0.18;
    const kinds: Crate['kind'][] = ['stone', 'iron', 'gold', 'rations'];
    const kind = gold ? 'gold' : kinds[Math.floor(Math.random() * 4)];
    const amt = gold ? Math.round(rnd(30, 55)) : kind === 'iron' ? Math.round(rnd(12, 24)) : kind === 'gold' ? Math.round(rnd(12, 22)) : Math.round(rnd(20, 40));
    this.crates.push({ id: this.nextId++, x, y: this.surf(x), kind, amt, life: 30, gold });
  }
  private updateCrates(dt: number) {
    this.crateT -= dt;
    if (this.crateT <= 0 && this.crates.length < 5) {
      this.crateT = rnd(13, 22) * (this.S > 480 ? 0.7 : 1);
      this.dropCrate(rnd(880, 1220));
    }
    for (const c of this.crates) {
      c.life -= dt;
      c.x -= (c.x > 800 ? 7 : 0) * dt;
      c.y = Math.min(this.surf(c.x), seabedY(c.x) - 6);
    }
    this.crates = this.crates.filter((c) => c.life > 0);
  }

  // ---------- waves ----------
  private updateWaves(dt: number) {
    this.countdown -= dt;
    if (this.countdown <= 0) this.startWave(this.wave + 1);
    if (this.queue.length) {
      this.waveClock += dt;
      while (this.queue.length && this.queue[0].t <= this.waveClock) this.spawn(this.queue.shift()!.type);
    } else this.waveClock = 0;
    if (this.waveActive && !this.queue.length && !this.enemies.some((e) => !e.dead)) {
      this.waveActive = false; this.stats.waves++;
      const bonus = Math.round((15 + this.wave * 4) * this.diff.res);
      this.addRes('gold', bonus); this.moraleBuff += 8; this.morale = Math.min(100, this.morale + 6);
      this.banner = { text: `WAVE ${this.wave} REPELLED`, sub: `Salvage bonus +${bonus} gold`, t: 3, col: '#b8f0c8' };
      this.msg(`Wave ${this.wave} repelled. +${bonus} gold.`, '#b8f0c8');
      audio.sfx('rally');
      if (this.wave >= WAVE_COUNT && !this.endless) this.countdown = Infinity;
    }
  }
  startWave(n: number) {
    this.wave = n; this.waveActive = true;
    const sp = buildWave(n, this.diff, this.mods.has('ironfleet'));
    this.queue = this.queue.concat(sp.map((s) => ({ t: s.t + this.waveClock, type: s.type }))).sort((a, b) => a.t - b.t);
    this.waveTotal = sp.length;
    const boss = sp.some((s) => EDEF[s.type].boss);
    this.countdown = n >= WAVE_COUNT && !this.endless ? Infinity : 78;
    this.banner = { text: boss ? `WAVE ${n}: FLAGSHIP` : `WAVE ${n}`, sub: boss ? 'A legendary vessel approaches!' : `${sp.length} ships sighted on the horizon`, t: 3.4, col: boss ? '#ff6b81' : '#ffd166' };
    this.msg(`Wave ${n}: ${sp.length} ships approaching${boss ? ' (BOSS)' : ''}.`, boss ? '#ff6b81' : '#ffd166');
    audio.sfx(boss ? 'boss' : 'wave');
    this.addShake(boss ? 7 : 3);
  }
  spawn(type: EType, x?: number) {
    const d = EDEF[type];
    const hpMul = this.diff.hp * (this.mods.has('ironfleet') ? 1.25 : 1) * (d.boss && this.wave > 12 ? 1 + 0.25 * ((this.wave - 12) / 6) : 1);
    const sx = x ?? W + 50 + rnd(0, 70);
    const e: Enemy = { id: this.nextId++, type, x: sx, y: this.S, vx: 0, hp: d.hp * hpMul, maxHp: d.hp * hpMul, draft: d.draft, size: d.size, aground: false, wasAg: false, cd: rnd(0.5, Math.min(d.rate, 3)), tgt: null, tcd: 0, hit: 0, slow: 0, phase: 0, sumT: 8, castT: 5, bob: rnd(0, 6), dead: false };
    this.enemies.push(e);
    return e;
  }
  peekWave(): Record<string, number> {
    const out: Record<string, number> = {};
    if (this.wave >= WAVE_COUNT && !this.endless) return out;
    for (const s of buildWave(this.wave + 1, this.diff, this.mods.has('ironfleet'))) out[s.type] = (out[s.type] || 0) + 1;
    return out;
  }

  private pickTarget(e: Enemy): Building | null {
    let best: Building | null = null; let bd = 1e9;
    const fx = e.x - e.size * 0.35; const fy = e.y - e.size * 0.2;
    for (const b of this.buildings) {
      if (b.hp <= 0 && b.type === 'wall') continue;
      const d = this.distRect(b, fx, fy) - (b.type === 'wall' ? 10 : 0);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  private updateEnemies(dt: number) {
    const en = this.enemies;
    for (const e of en) {
      if (e.dead) continue;
      const d = EDEF[e.type];
      e.bob += dt; e.hit = Math.max(0, e.hit - dt); e.slow = Math.max(0, e.slow - dt);
      const sea = this.surf(e.x); const bed = seabedY(e.x);
      const ag = sea > bed - e.draft + 1;
      if (ag && !e.wasAg) { e.wasAg = true; this.stats.grounded++; this.ftext(e.x, e.y - e.size * 0.8, 'AGROUND!', '#ffe08a', 14); }
      if (!ag) e.wasAg = false;
      e.aground = ag;
      e.y = Math.min(sea, bed - e.draft);
      e.tcd -= dt;
      if (e.tcd <= 0 || !e.tgt || (e.tgt.hp <= 0 && e.tgt.type === 'wall') || !this.buildings.includes(e.tgt)) { e.tcd = 0.7; e.tgt = d.range > 0 || e.type === 'fireship' ? this.pickTarget(e) : null; }
      const fx = e.x - e.size * 0.35; const fy = e.y - e.size * 0.2;
      const dist = e.tgt ? this.distRect(e.tgt, fx, fy) : 9999;
      let move = false;
      if (e.type === 'tidecaller') move = e.x > 1010;
      else if (e.tgt) move = dist > d.range * 0.88;
      else move = true;
      const boost = d.boss ? 1 + 0.25 * e.phase : 1;
      const sp = d.speed * boost * (e.slow > 0 ? 0.5 : 1);
      let moved = false;
      if (move && !ag) {
        const nx = e.x - sp * dt;
        let blocked = seabedY(nx - e.size * 0.35) - this.S < e.draft;
        if (!blocked) for (const o of en) if (o !== e && !o.dead && o.x < e.x && e.x - o.x < (e.size + o.size) * 0.42 && Math.abs(o.y - e.y) < 60) { blocked = true; break; }
        if (nx < WALL_X1 + e.size * 0.35) blocked = true;
        if (!blocked) { e.vx = -sp; e.x = nx; moved = true; }
      }
      if (!moved) e.vx *= 0.8;
      // behaviours
      e.cd -= dt;
      if (e.type === 'tidecaller') {
        if (e.x < 1260) { e.castT -= dt; }
        if (e.castT <= 0 && this.casts.length < 3) {
          e.castT = d.rate; this.casts.push({ t: 0, dur: 11, amp: 24 });
          this.burst(e.x, e.y - 30, 24, '#6ee7ff', 160, 0.9, 3, -60); this.ring(e.x, e.y - 20, 70, '#6ee7ff');
          this.msg('A Tidecaller raises the sea!', '#6ee7ff'); audio.sfx('alarm');
          this.ftext(e.x, e.y - e.size, 'SURGE!', '#6ee7ff', 16);
        } else if (e.castT <= 0) e.castT = 3;
        continue;
      }
      if (d.boss) this.bossLogic(e, d, dt);
      if (!e.tgt || dist > d.range + 4 || e.cd > 0) continue;
      const tp = this.bpos(e.tgt);
      const hx = clamp(fx, this.rectOf(e.tgt)[0], this.rectOf(e.tgt)[2]); const hy = clamp(fy, this.rectOf(e.tgt)[1], this.rectOf(e.tgt)[3]);
      if (e.type === 'skiff') { e.cd = d.rate; this.hurtB(e.tgt, d.dmg, hx, hy); this.moraleBuff -= 0.1; }
      else if (e.type === 'galley') { e.cd = d.rate; this.hurtB(e.tgt, d.dmg * (e.tgt.type === 'wall' ? 1.5 : 1), hx, hy); e.x += 7; this.addShake(3); this.splash(e.x - 30, 0.8); }
      else if (e.type === 'fireship') {
        e.hp = 0; this.killEnemy(e, false);
        this.boom(hx, hy, 80, 1.6); this.blastBuildings(hx, hy, 80, d.dmg, 0.8);
      } else if (e.type === 'bombard') { e.cd = d.rate; this.enemyShoot(e, 'eshell', d.dmg, 44, 0.3, e.tgt, tp); }
      else if (e.type === 'ironclad') { e.cd = d.rate; this.enemyShoot(e, 'eball', d.dmg, 30, 0, e.tgt, tp); }
    }
    this.enemies = en.filter((e) => !e.dead);
  }
  private inRangeTargets(e: Enemy, range: number) {
    return this.buildings.filter((b) => (b.type !== 'wall' || b.hp > 0) && this.distRect(b, e.x - e.size * 0.3, e.y - e.size * 0.3) <= range);
  }
  private bossLogic(e: Enemy, d: typeof EDEF.skiff, dt: number) {
    const ph = e.hp / e.maxHp > 0.66 ? 0 : e.hp / e.maxHp > 0.33 ? 1 : 2;
    if (ph > e.phase) {
      e.phase = ph; this.addShake(10); audio.sfx('boss');
      const lev = e.type === 'leviathan';
      this.banner = { text: lev ? (ph === 1 ? 'THE SEA RISES' : 'THE DROWNED FLEET') : (ph === 1 ? 'ALL HANDS BOARD!' : 'BURN IT ALL!'), sub: `${d.name} enters phase ${ph + 1}`, t: 3, col: '#ff6b81' };
      if (lev && ph === 1) { this.events.push({ type: 'surge', t: 0, dur: 26, amp: 46 }); this.spawn('galley'); this.spawn('galley'); }
      else if (lev) { this.spawn('tidecaller'); this.spawn('tidecaller'); this.spawn('fireship'); this.spawn('fireship'); }
      else if (ph === 1) { for (let i = 0; i < 4; i++) this.spawn('skiff', e.x + i * 24); }
      else { this.spawn('fireship'); this.spawn('fireship'); this.spawn('fireship'); }
    }
    e.sumT -= dt;
    if (e.phase >= 1 && e.sumT <= 0) {
      e.sumT = 13 - e.phase * 2;
      if (e.type === 'leviathan') this.spawn(e.phase === 2 ? 'ironclad' : 'galley', e.x + 40);
      else { this.spawn('skiff', e.x + 20); this.spawn('skiff', e.x + 50); }
    }
    if (e.cd <= 0) {
      const targets = this.inRangeTargets(e, d.range);
      if (targets.length) {
        e.cd = d.rate * (1 - 0.15 * e.phase);
        const n = (e.type === 'leviathan' ? 3 : 2) + e.phase;
        for (let i = 0; i < n; i++) {
          const t = targets[Math.floor(Math.random() * targets.length)];
          const kind = e.type === 'leviathan' ? 'eshell' : e.phase >= 2 ? 'efire' : 'eball';
          this.enemyShoot(e, kind, d.dmg, e.type === 'leviathan' ? 52 : 36, kind === 'efire' ? 0.6 : 0.15, t, this.bpos(t), i * 0.12);
        }
      }
    }
  }
  private enemyShoot(e: Enemy, kind: 'eball' | 'eshell' | 'efire', dmg: number, aoe: number, ign: number, tgt: Building, tp: { x: number; y: number }, delay = 0) {
    const mx = e.x - e.size * 0.3; const my = e.y - e.size * 0.4;
    const tx = tp.x + rnd(-14, 14); const ty = tp.y + rnd(-14, 14);
    const dist = Math.hypot(tx - mx, ty - my);
    const ft = clamp(dist / 380, 0.55, 2) + delay;
    const g = 420;
    this.projs.push({ x: mx, y: my, vx: (tx - mx) / ft, vy: (ty - my - 0.5 * g * ft * ft) / ft, g, k: kind, own: 0, dmg, aoe: aoe + (tgt.type === 'wall' ? 10 : 0), life: ft, ty, mul: ign, dry: true });
    this.burst(mx, my, 6, '#ffb347', 90, 0.35, 3, 0);
    audio.sfx(kind === 'eshell' ? 'catapult' : 'cannon');
  }

  private updateProjs(dt: number) {
    for (const p of this.projs) {
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (Math.random() < 0.6) this.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: p.k === 'bolt' ? 1.5 : 3, col: p.own ? (p.k === 'bolt' ? '#f1e6c8' : '#ffd9a0') : p.k === 'efire' ? '#ff6a3a' : '#c8a98a', g: 0, k: 0, drag: 2 });
      if (p.own === 1) {
        let hit: Enemy | null = null;
        for (const e of this.enemies) if (!e.dead && Math.abs(p.x - e.x) < e.size * 0.5 && p.y > e.y - e.size * 0.55 && p.y < e.y + e.size * 0.12) { hit = e; break; }
        const sf = this.surf(p.x);
        if (p.y < sf) p.dry = true;
        const water = p.dry && p.x > WALL_X1 && p.y > sf && p.vy > 0;
        if (hit) {
          if (p.k === 'bolt') { this.hurtE(hit, p.dmg, 'pierce', p.mul); this.burst(p.x, p.y, 4, '#f1e6c8', 80, 0.3, 2, 200); }
          else this.explodeP(p);
          p.life = -1;
        } else if (water || p.life <= 0) {
          if (p.k === 'bolt') { if (water) this.splash(p.x, 0.5); } else this.explodeP(p);
          p.life = -1;
        }
      } else if (p.life <= 0) {
        if (p.x > WALL_X1 && p.y > this.surf(p.x)) this.splash(p.x, 1.2);
        this.boom(p.x, p.y, p.aoe, p.aoe / 40);
        this.blastBuildings(p.x, p.y, p.aoe, p.dmg, p.mul);
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0 && p.x > -50 && p.x < W + 200 && p.y < H + 60);
  }
  private explodeP(p: Proj) {
    const inWater = p.x > WALL_X1 && p.y >= this.surf(p.x) - 4;
    if (inWater) this.splash(p.x, p.aoe > 50 ? 2.2 : 1.5); else this.burst(p.x, p.y, 10, '#ffb347', 180, 0.5, 3, 200);
    this.ring(p.x, p.y, p.aoe, '#ffffff'); this.addShake(1 + p.aoe * 0.03);
    audio.sfx('boom');
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - p.x, e.y - e.size * 0.2 - p.y) - e.size * 0.3;
      if (d < p.aoe) this.hurtE(e, p.dmg * (1 - 0.5 * clamp(d / p.aoe, 0, 1)), 'blast', p.mul);
    }
  }

  private updateCrew(dt: number) {
    const polMul = [0.6, 1, 1.5][this.policy];
    const cons = this.crew * 0.032 * polMul + this.messEff * 0.1;
    this.rations = Math.max(0, Math.min(400, this.rations - cons * dt));
    const rest = this.mods.has('restless');
    const eq = 52 + 16 * Math.min(this.messEff, 2) + 3 * Math.min(this.barracks, 3) + [-10, 0, 10][this.policy]
      - Math.min(20, 5 * this.floodedStaffed) - Math.min(12, 3 * this.burning) + (this.rations <= 0 ? -40 : 0)
      + (this.hasEvent('redtide') ? -8 : 0) - (rest ? 8 : 0) + clamp(this.moraleBuff, -25, 25);
    this.moraleBuff *= Math.exp(-dt * 0.12);
    const k = eq > this.morale ? 0.06 : 0.06 * this.diff.drain * (rest ? 1.5 : 1);
    this.morale = clamp(this.morale + (eq - this.morale) * k * dt, 0, 100);
    if (this.morale < 12) {
      this.mutinyT += dt;
      if (this.mutinyT > 6 && this.crew > 0) {
        this.mutinyT = 0; this.crew--; this.stats.desertions++; this.trimCrew();
        this.ftext(75, 130, 'A sailor deserts!', '#ff8a70', 15); this.msg('Mutiny! Sailors are deserting.', '#ff8a70'); audio.sfx('alarm');
      }
    } else this.mutinyT = Math.max(0, this.mutinyT - dt);
    if (this.rations <= 0 && Math.random() < dt * 0.15) this.msg('Rations exhausted! Morale collapsing.', '#ff8a70');
  }

  private updateFx(dt: number) {
    for (const p of this.parts) {
      p.life -= dt; if (p.k === 2) continue;
      p.vy += p.g * dt; const dr = Math.max(0, 1 - p.drag * dt); p.vx *= dr; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 26 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    this.shake = Math.max(0, this.shake - dt * 14);
    this.flashT = Math.max(0, this.flashT - dt);
    if (Math.random() < dt * 1.2) {
      const x = rnd(440, 705);
      this.parts.push({ x, y: this.L, vx: 0, vy: -10, life: 1.2, max: 1.2, size: 1.5, col: '#cdeff5', g: 0, k: 0, drag: 1 });
    }
    // splash on wall at heavy swell
    if (Math.random() < dt * (0.5 + this.storm * 6)) this.splash(WALL_X1 + rnd(0, 60), 0.6 + this.storm, this.storm > 0.4);
  }

  // ---------- tutorial ----------
  tutNext() { if (this.tutActive && TUT[this.tutStep].cond === 'next') this.tutAdvance(); }
  tutAdvance() { this.tutStep++; audio.sfx('upgrade'); if (this.tutStep >= TUT.length) { this.tutActive = false; this.save.seenTutorial = true; writeSave(this.save); } }
  tutSkip() { this.tutActive = false; this.save.seenTutorial = true; writeSave(this.save); if (this.wave === 0 && !Number.isFinite(this.countdown)) this.countdown = 40; }
  private tutCheck() {
    if (!this.tutActive) return;
    const s = TUT[this.tutStep]; if (!s) return;
    let ok = false;
    switch (s.cond) {
      case 'quarry': ok = this.tutBuilt.has('quarry'); break;
      case 'engine': ok = this.buildings.some((b) => BDEFS[b.type].engine); break;
      case 'gate': ok = this.tutGate; break;
      case 'select': { const b = this.selB(); ok = !!b && !!BDEFS[b.type].engine; break; }
      case 'wave': ok = this.wave >= 1; break;
      default: break;
    }
    if (ok) this.tutAdvance();
  }

  // ---------- end ----------
  score() {
    return Math.round((this.stats.kills * 10 + this.stats.waves * 100 + this.stats.bosses * 500 + this.stats.goldEarned * 0.5 + (this.won ? 2000 : 0)) * (1 + (this.diff.renown - 0.7) * 0.5));
  }
  renownGain() {
    const modBonus = 1 + [...this.mods].reduce((a, m) => a + ({ spring: 0.15, rusty: 0.15, restless: 0.2, ironfleet: 0.25 } as Record<string, number>)[m], 0);
    return Math.max(1, Math.round((this.wave * 3 + this.stats.bosses * 25 + this.stats.kills * 0.12 + (this.won ? 60 : 0)) * this.diff.renown * modBonus));
  }
  private checkEnd() {
    if (this.ended) return;
    if (this.keep.hp <= 0) { this.finish('defeat'); return; }
    if (this.crew <= 0 && this.stats.desertions > 0) { this.finish('defeat'); return; }
    if (!this.won && this.wave >= WAVE_COUNT && this.bossDown && !this.queue.length && !this.enemies.some((e) => !e.dead)) { this.won = true; this.finish('victory'); }
  }
  private finish(r: 'victory' | 'defeat') {
    this.state = r; this.ended = true;
    const total = this.renownGain(); const gain = Math.max(0, total - this.paid); this.paid = total;
    const score = this.score();
    this.result = { gain, score, won: r === 'victory' };
    const s = this.save;
    s.renown += gain; s.bestWave = Math.max(s.bestWave, this.wave); s.bestScore = Math.max(s.bestScore, score);
    if (!this.counted) { s.runs++; s.kills += this.stats.kills; this.counted = true; }
    if (r === 'victory') s.wins++;
    writeSave(s);
    audio.sfx(r === 'victory' ? 'victory' : 'defeat');
    if (r === 'defeat') { const p = this.bpos(this.keep); this.boom(p.x, p.y, 120, 3); }
    this.opts.onEnd?.(r);
  }
  continueEndless() {
    this.endless = true; this.state = 'play'; this.ended = false; this.countdown = 30; this.bossDown = false;
    this.msg('The war continues. Endless waves approach...', '#ffd166');
  }
}
