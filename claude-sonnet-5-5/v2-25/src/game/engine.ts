import {
  TILE, COLS, ROWS, WW, WH, DAY_LEN, BUILDINGS, SPECIES, ENEMIES, SPELLS, TUTORIAL, MAX_PARTICLES,
  RES_KEYS, RES_META, emptyRes,
} from './data';
import type { Res, ResKey, Shift, SpeciesId, SpeciesDef, BuildingDef, EnemyDef, DifficultyDef } from './data';
import { audio } from './audio';

export type Phase = 'dawn' | 'day' | 'dusk' | 'night';
type TK = 'w' | 'b' | 'm' | 's';

export interface Worker {
  id: number; name: string; species: SpeciesId; x: number; y: number; hx: number; hy: number;
  shift: Shift; pin: number | null; job: number | null; integrity: number; maxInt: number; morale: number;
  state: string; inside: number | null; repairing: boolean; strike: boolean; atkT: number; flash: number; bob: number;
  dead: boolean; mult: number; kills: number; face: number;
}
export interface Building {
  id: number; def: BuildingDef; col: number; row: number; x: number; y: number; w: number; hp: number; maxHp: number;
  crew: number[]; progress: number; active: boolean; stalled: string; haunt: number; queue: SpeciesId[]; inside: number[];
  fire: number; cdT: number; ammo: number; soulT: number; pulseT: number; flash: number; pop: number; effAcc: number; eff: number;
  hauntT: number; working: boolean; radius: number; warn: string;
}
export interface Enemy {
  id: number; def: EnemyDef; x: number; y: number; hp: number; maxHp: number; atkT: number;
  tk: TK | null; tgt: Worker | Building | Militia | Site | null; retargetT: number; flash: number; slow: number;
  spawnT: number; t1: number; t2: number; t3: number; phase2: boolean; stolen: Partial<Res>; stealT: number; dead: boolean;
  face: number; healT: number; wobble: number; blocker: Building | null;
}
export interface Militia { id: number; x: number; y: number; hp: number; life: number; atkT: number; flash: number; dead: boolean; face: number }
export interface Site { x: number; y: number; r: number; state: 'haunted' | 'consecrated'; prog: number; pulse: number }
export interface Proj {
  x: number; y: number; vx: number; vy: number; dmg: number; foe: boolean; pierce: boolean; life: number; kind: string;
  tk: TK | null; tgt: Worker | Building | Militia | Enemy | null; speed: number; dead: boolean; color: string;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: string; rot: number; vr: number; g: number; ref?: Enemy | null }
export interface FText { x: number; y: number; life: number; max: number; str: string; color: string; size: number }
export interface Hazard { x: number; y: number; r: number; t: number; max: number; dmg: number; kind: string }
export interface Zone { x: number; y: number; r: number; t: number; max: number; tick: number }
export interface Raid { team: 'zealot' | 'rival'; units: string[]; warnAt: number; spawnAt: number; sides: { x: number; y: number; dir: string }[]; warned: boolean; spawned: boolean; boss?: string; label: string }
interface SpawnItem { t: number; id: string; x: number; y: number; boss: boolean }
export interface LogItem { id: number; msg: string; color: string; t: number }

export interface GameOpts { diff: DifficultyDef; mods: string[]; upgrades: Record<string, number>; tutorial: boolean }

export interface RunResult {
  won: boolean; days: number; shards: number; time: number; kills: number; zealots: number; rivals: number; raised: number; lost: number;
  coin: number; built: number; peakInfamy: number; spells: number; bosses: number; corpses: number; collapsed: number; sites: number;
}

const NAMES = ['Grimble', 'Skrit', 'Moldra', 'Bonifer', 'Cadavus', 'Thistle', 'Wormwood', 'Hollis', 'Marrow', 'Gristle', 'Ossian', 'Dusk', 'Ratchet', 'Mortimer', 'Vesper', 'Cryptid', 'Fennick', 'Tallow', 'Nettle', 'Sexton', 'Rue', 'Barrow', 'Lazar', 'Morwen'];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
  diff: DifficultyDef;
  mods: Set<string>;
  up: Record<string, number>;
  tutorial: boolean;
  goal: number;
  time = 0;
  dayNo = 1;
  speed = 1;
  paused = false;
  status: 'playing' | 'won' | 'lost' = 'playing';
  endless = false;
  res: Res = emptyRes();
  infamy = 0;
  workers: Worker[] = [];
  buildings: Building[] = [];
  enemies: Enemy[] = [];
  projs: Proj[] = [];
  parts: Particle[] = [];
  texts: FText[] = [];
  hazards: Hazard[] = [];
  zones: Zone[] = [];
  militia: Militia[] = [];
  spawnQ: SpawnItem[] = [];
  raids: Raid[] = [];
  sites: Site[] = [];
  grid = new Int32Array(COLS * ROWS);
  nid = 1;
  sel: { kind: 'worker' | 'building' | 'site' | null; id: number } = { kind: null, id: 0 };
  tool: string | null = null;
  targeting: string | null = null;
  mouse = { x: WW / 2, y: WH / 2, inside: false };
  shake = 0;
  screenFlash = 0;
  flashColor = '#fff';
  spellCd: Record<string, number> = {};
  bribeCd = 0;
  sunFx = { eclipse: 0, radiance: 0 };
  sunVis = 0;
  defaultShift: Shift = 'round';
  phase: Phase = 'dawn';
  log: LogItem[] = [];
  tutStep = 0;
  intensity = 0;
  assignT = 0;
  decorSeed = Math.floor(Math.random() * 1e9);
  placeError = '';
  bossSpawned = { inquisitor: false, archlich: false };
  bossDead = { inquisitor: false, archlich: false };
  bossRef: Enemy | null = null;
  shardsPaid = 0;
  onEnd: (() => void) | null = null;
  ended = false;
  stats = {
    kills: 0, zealots: 0, rivals: 0, raised: 0, lost: 0, coin: 0, built: 0, peakInfamy: 0, spells: 0, bosses: 0,
    corpses: 0, collapsed: 0, shiftChanges: 0, pins: 0, sites: 0, produced: 0,
  };
  private lastWorkSfx = 0;

  constructor(opts: GameOpts) {
    this.diff = opts.diff;
    this.mods = new Set(opts.mods);
    this.up = opts.upgrades;
    this.tutorial = opts.tutorial;
    this.goal = opts.diff.goal;
    const wealth = (1 + 0.25 * this.lv('wealth')) * opts.diff.start * (this.mods.has('pauper') ? 0.5 : 1) * (opts.tutorial ? 1.6 : 1);
    this.res = {
      corpses: Math.round(6 * wealth), bones: Math.round(60 * wealth), souls: Math.round(3 * wealth),
      ecto: 0, coin: Math.round(90 * wealth),
    };
    // mausoleum
    this.addBuilding('mausoleum', 12, 7, true);
    this.genSites();
    const start: SpeciesId[] = this.mods.has('pauper') ? ['skeleton', 'skeleton', 'skeleton'] : ['skeleton', 'skeleton', 'zombie', 'zombie'];
    start.forEach((s) => this.addWorker(s, 'round'));
    this.phase = 'dawn';
    for (const s of SPELLS) this.spellCd[s.id] = 0;
    if (!this.tutorial) this.planDay();
    this.say(this.tutorial ? 'Welcome, Necromancer. Follow the Tutorial panel.' : 'Dawn. The Necropolis awakens. Raiders approach by midday.', '#b78cff');
  }

  lv(id: string) { return this.up[id] || 0; }
  unlocked(id?: string) { return !id || this.lv(id) > 0; }

  // ---------- time / day cycle ----------
  get bounds(): [number, number, number] { return this.mods.has('sun') ? [0.07, 0.66, 0.72] : [0.1, 0.5, 0.6]; }
  get cycle() { return (this.time % DAY_LEN) / DAY_LEN; }
  get effSun() { return this.sunVis; }
  get tutHold() { return this.tutorial && this.tutStep < TUTORIAL.findIndex((t) => t.id === 'raid'); }

  phaseOf(c: number): Phase {
    const [b0, b1, b2] = this.bounds;
    return c < b0 ? 'dawn' : c < b1 ? 'day' : c < b2 ? 'dusk' : 'night';
  }
  sunBase(c: number) {
    const [b0, b1, b2] = this.bounds;
    if (c < b0) return c / b0;
    if (c < b1) return 1;
    if (c < b2) return 1 - (c - b1) / (b2 - b1);
    return 0;
  }
  onShift(w: Worker) {
    if (w.shift === 'round') return true;
    const day = this.phase === 'dawn' || this.phase === 'day';
    return w.shift === 'day' ? day : !day;
  }
  speciesMult(sp: SpeciesDef) {
    const s = this.effSun;
    const dayEff = sp.day < 1 ? sp.day + (1 - sp.day) * 0.15 * this.lv('shrouds') : sp.day;
    return lerp(sp.night, dayEff, s);
  }
  moraleLossMul() {
    return this.diff.morale * (this.mods.has('restless') ? 1.6 : 1) * (1 - 0.1 * this.lv('dirges'));
  }
  prodMul() { return (1 + 0.07 * this.lv('rites')) * this.diff.eco; }
  housingOf(b: Building) { return (b.def.housing || 0) + (b.def.housing ? this.lv('crypts') : 0); }
  get popCap() { return 4 + this.buildings.reduce((a, b) => a + this.housingOf(b), 0); }
  get pop() { return this.workers.length; }
  get mausoleum() { return this.buildings.find((b) => b.def.kind === 'core') as Building; }

  // ---------- helpers ----------
  say(msg: string, color = '#e8e2cf') {
    this.log.push({ id: this.nid++, msg, color, t: performance.now() });
    if (this.log.length > 8) this.log.shift();
  }
  text(x: number, y: number, str: string, color = '#fff', size = 14, life = 1.1) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x, y, life, max: life, str, color, size });
  }
  burst(x: number, y: number, n: number, color: string, speed = 90, kind = 'spark', size = 3, life = 0.6, g = 0) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length >= MAX_PARTICLES) return;
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rnd(0.6, 1.2), max: life, size: size * rnd(0.6, 1.2), color, kind, rot: Math.random() * 6, vr: rnd(-8, 8), g });
    }
  }
  shakeOn = true;
  addShake(v: number) { if (this.shakeOn) this.shake = Math.min(18, this.shake + v); }
  canAfford(c: Partial<Res>) { return RES_KEYS.every((k) => this.res[k] >= (c[k] || 0)); }
  spend(c: Partial<Res>) { RES_KEYS.forEach((k) => { this.res[k] -= c[k] || 0; }); }
  gain(c: Partial<Res>) { RES_KEYS.forEach((k) => { this.res[k] += c[k] || 0; }); }
  bById(id: number | null) { return id == null ? undefined : this.buildings.find((b) => b.id === id); }
  wById(id: number | null) { return id == null ? undefined : this.workers.find((w) => w.id === id); }
  count(id: string) { return this.buildings.filter((b) => b.def.id === id).length; }
  addInfamy(v: number) {
    this.infamy = clamp(this.infamy + v, 0, 100);
    this.stats.peakInfamy = Math.max(this.stats.peakInfamy, Math.round(this.infamy));
  }
  rectDist(px: number, py: number, b: Building) {
    const dx = Math.max(Math.abs(px - b.x) - b.w / 2, 0);
    const dy = Math.max(Math.abs(py - b.y) - b.w / 2, 0);
    return Math.hypot(dx, dy);
  }
  nearestEnemy(x: number, y: number, r: number, filter?: (e: Enemy) => boolean) {
    let best: Enemy | null = null;
    let bd = r;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT < 0.6) continue;
      if (filter && !filter(e)) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.def.r;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  // ---------- layout ----------
  private genSites() {
    const spots: [number, number][] = [];
    let tries = 0;
    while (spots.length < 4 && tries++ < 200) {
      const x = rnd(110, WW - 110);
      const y = rnd(110, WH - 110);
      const m = this.mausoleum;
      if (Math.hypot(x - m.x, y - m.y) < 170) continue;
      if (spots.some((s) => Math.hypot(s[0] - x, s[1] - y) < 240)) continue;
      spots.push([x, y]);
    }
    this.sites = spots.map(([x, y]) => ({ x, y, r: 62, state: 'haunted', prog: 0, pulse: Math.random() * 6 }));
  }

  // ---------- workers ----------
  addWorker(species: SpeciesId, shift: Shift, x?: number, y?: number) {
    const sp = SPECIES[species];
    const m = this.mausoleum;
    const a = Math.random() * Math.PI * 2;
    const used = new Set(this.workers.map((w) => w.name));
    let name = NAMES[Math.floor(Math.random() * NAMES.length)];
    let n = 2;
    const base = name;
    while (used.has(name)) name = `${base} ${n++}`;
    const maxInt = Math.round(sp.maxInt * (1 + 0.1 * this.lv('sinew')));
    const ang = Math.random() * Math.PI * 2;
    const w: Worker = {
      id: this.nid++, name, species, x: x ?? m.x + Math.cos(a) * 80, y: y ?? m.y + Math.sin(a) * 80,
      hx: m.x + Math.cos(ang) * rnd(90, 120), hy: m.y + Math.sin(ang) * rnd(90, 120),
      shift, pin: null, job: null, integrity: maxInt, maxInt, morale: 70, state: 'idle', inside: null, repairing: false,
      strike: false, atkT: 0, flash: 0, bob: Math.random() * 6, dead: false, mult: 1, kills: 0, face: 1,
    };
    this.workers.push(w);
    return w;
  }
  setShift(w: Worker, s: Shift) {
    if (w.shift === s) return;
    w.shift = s;
    this.stats.shiftChanges++;
    audio.sfx('click');
  }
  setAllShift(s: Shift) {
    this.workers.forEach((w) => { w.shift = s; });
    this.defaultShift = s;
    this.stats.shiftChanges++;
    audio.sfx('select');
  }
  smartSchedule() {
    const ws = [...this.workers].sort((a, b) => {
      const sa = SPECIES[a.species], sb = SPECIES[b.species];
      return (sb.night - sb.day) - (sa.night - sa.day);
    });
    const nightCount = Math.ceil(ws.length / 2);
    ws.forEach((w, i) => { w.shift = i < nightCount ? 'night' : 'day'; });
    ws.filter((w) => w.species === 'wraith').forEach((w) => { w.shift = 'night'; });
    this.stats.shiftChanges++;
    audio.sfx('select');
    this.say('Shifts rebalanced by species affinity.', '#7fe3d4');
  }
  assignPin(w: Worker, b: Building) {
    if (b.def.slots <= 0) return false;
    w.pin = b.id;
    this.stats.pins++;
    this.text(b.x, b.y - b.w / 2 - 8, `${w.name} pinned`, '#7fe3d4', 12);
    audio.sfx('select');
    this.assignT = 0;
    return true;
  }
  unpin(w: Worker) { w.pin = null; w.job = null; this.assignT = 0; audio.sfx('click'); }

  // ---------- buildings ----------
  addBuilding(id: string, col: number, row: number, free = false) {
    const def = BUILDINGS[id];
    const size = def.size;
    const b: Building = {
      id: this.nid++, def, col, row, x: (col + size / 2) * TILE, y: (row + size / 2) * TILE, w: size * TILE,
      hp: id === 'mausoleum' ? def.hp * (1 + 0.25 * this.lv('bulwark')) : def.hp, maxHp: 0, crew: [], progress: 0, active: false, stalled: '',
      haunt: 1, queue: [], inside: [], fire: 0, cdT: 0, ammo: 0, soulT: 0, pulseT: 0, flash: 0, pop: free ? 1 : 0, effAcc: 0, eff: 0,
      hauntT: 0, working: false, radius: 0, warn: '',
    };
    b.maxHp = b.hp;
    for (let c = col; c < col + size; c++) for (let r = row; r < row + size; r++) this.grid[r * COLS + c] = b.id;
    this.buildings.push(b);
    this.updateHaunt(b);
    return b;
  }
  tileFor(defId: string, x: number, y: number) {
    const size = BUILDINGS[defId].size;
    return { col: Math.round(x / TILE - size / 2), row: Math.round(y / TILE - size / 2) };
  }
  canPlace(defId: string, col: number, row: number): string {
    const def = BUILDINGS[defId];
    if (!this.unlocked(def.unlock)) return 'Locked — research it in Dark Arts';
    if (col < 0 || row < 0 || col + def.size > COLS || row + def.size > ROWS) return 'Out of bounds';
    for (let c = col; c < col + def.size; c++) for (let r = row; r < row + def.size; r++) if (this.grid[r * COLS + c]) return 'Tile occupied';
    if (!this.canAfford(def.cost)) return 'Not enough resources';
    return '';
  }
  place(defId: string, col: number, row: number) {
    const err = this.canPlace(defId, col, row);
    if (err) {
      this.placeError = err;
      audio.sfx('error');
      const px = (col + 0.5) * TILE, py = (row + 0.5) * TILE;
      this.text(px, py, err, '#ff7a7a', 13, 1.2);
      return false;
    }
    const def = BUILDINGS[defId];
    this.spend(def.cost);
    const b = this.addBuilding(defId, col, row);
    this.stats.built++;
    audio.sfx('place');
    this.burst(b.x, b.y, 14, '#c9b98a', 110, 'smoke', 6, 0.7);
    this.addShake(2);
    this.assignT = 0;
    return true;
  }
  demolish(b: Building) {
    if (b.def.kind === 'core') { this.text(b.x, b.y, 'Cannot raze the Mausoleum', '#ff7a7a'); audio.sfx('error'); return; }
    const refund: Partial<Res> = {};
    RES_KEYS.forEach((k) => { refund[k] = Math.floor((b.def.cost[k] || 0) * 0.5); });
    b.queue.forEach((s) => this.gain(SPECIES[s].cost));
    this.gain(refund);
    this.removeBuilding(b, false);
    this.text(b.x, b.y, 'Razed (50% refund)', '#f2c14e', 12);
    audio.sfx('place');
  }
  private removeBuilding(b: Building, destroyed: boolean) {
    for (let c = b.col; c < b.col + b.def.size; c++) for (let r = b.row; r < b.row + b.def.size; r++) if (this.grid[r * COLS + c] === b.id) this.grid[r * COLS + c] = 0;
    this.buildings = this.buildings.filter((x) => x !== b);
    for (const w of this.workers) {
      if (w.pin === b.id) w.pin = null;
      if (w.job === b.id) w.job = null;
      if (w.inside === b.id) { w.inside = null; w.x = b.x; w.y = b.y + b.w / 2 + 10; }
    }
    for (const e of this.enemies) if (e.tgt === b) e.tgt = null;
    if (this.sel.kind === 'building' && this.sel.id === b.id) this.sel = { kind: null, id: 0 };
    if (destroyed) {
      this.burst(b.x, b.y, 28, '#8a7f66', 170, 'bone', 5, 0.9, 200);
      this.burst(b.x, b.y, 12, '#555', 60, 'smoke', 9, 1.0);
      audio.sfx('boom');
      this.addShake(b.def.kind === 'core' ? 16 : 6);
    }
    this.assignT = 0;
  }
  repair(b: Building) {
    const need = Math.ceil((b.maxHp - b.hp) / 8);
    if (need <= 0) return;
    if (this.res.bones < need) { this.text(b.x, b.y, `Need ${need} 🦴`, '#ff7a7a'); audio.sfx('error'); return; }
    this.res.bones -= need;
    b.hp = b.maxHp;
    b.fire = 0;
    this.text(b.x, b.y - 10, 'Repaired', '#7fe3d4');
    audio.sfx('place');
  }
  updateHaunt(b: Building) {
    let m = 1;
    for (const s of this.sites) if (s.state === 'haunted' && Math.hypot(s.x - b.x, s.y - b.y) < s.r + b.w / 2) m = 1.4;
    b.haunt = m;
  }
  rehaunt(s: Site) {
    const cost = 5;
    if (s.state !== 'consecrated') return;
    if (this.res.souls < cost) { this.text(s.x, s.y, 'Need 5 👻', '#ff7a7a'); audio.sfx('error'); return; }
    this.res.souls -= cost;
    s.state = 'haunted';
    s.prog = 0;
    this.burst(s.x, s.y, 30, '#7fe3d4', 120, 'soul', 4, 1.2);
    this.text(s.x, s.y - 20, 'Re-haunted!', '#7fe3d4', 16);
    audio.sfx('raise');
  }
  queuePit(b: Building, sp: SpeciesId) {
    const def = SPECIES[sp];
    if (!this.unlocked(def.unlock)) { audio.sfx('error'); return; }
    if (b.queue.length >= 4) { this.text(b.x, b.y - 30, 'Queue full', '#ff7a7a'); audio.sfx('error'); return; }
    if (this.workers.length + this.pitQueued() >= this.popCap) { this.text(b.x, b.y - 30, 'Population cap! Build Crypts', '#ff7a7a'); audio.sfx('error'); return; }
    if (!this.canAfford(def.cost)) { this.text(b.x, b.y - 30, 'Not enough resources', '#ff7a7a'); audio.sfx('error'); return; }
    this.spend(def.cost);
    b.queue.push(sp);
    audio.sfx('select');
  }
  pitQueued() { return this.buildings.reduce((a, b) => a + b.queue.length, 0); }
  cancelPit(b: Building, i: number) {
    const s = b.queue[i];
    if (!s) return;
    this.gain(SPECIES[s].cost);
    b.queue.splice(i, 1);
    if (i === 0) b.progress = 0;
    audio.sfx('click');
  }

  // ---------- spells ----------
  spellCost(id: string): Partial<Res> {
    const s = SPELLS.find((x) => x.id === id);
    const out: Partial<Res> = {};
    if (!s) return out;
    RES_KEYS.forEach((k) => { if (s.cost[k]) out[k] = Math.max(1, Math.ceil((s.cost[k] as number) * (1 - 0.1 * this.lv('mastery')))); });
    return out;
  }
  spellReady(id: string) {
    const s = SPELLS.find((x) => x.id === id);
    return !!s && this.unlocked(s.unlock) && this.spellCd[id] <= 0 && this.canAfford(this.spellCost(id));
  }
  beginSpell(id: string) {
    const s = SPELLS.find((x) => x.id === id);
    if (!s) return;
    if (!this.unlocked(s.unlock)) { this.say('Spell locked — research it in Dark Arts.', '#ff7a7a'); audio.sfx('error'); return; }
    if (this.spellCd[id] > 0) { audio.sfx('error'); return; }
    if (!this.canAfford(this.spellCost(id))) { this.say(`Not enough resources for ${s.name}.`, '#ff7a7a'); audio.sfx('error'); return; }
    if (s.target) {
      if (this.targeting === id && this.mouse.inside) { this.cast(id, this.mouse.x, this.mouse.y); this.targeting = null; return; }
      this.targeting = id;
      this.tool = null;
      audio.sfx('select');
    } else this.cast(id, 0, 0);
  }
  cast(id: string, x: number, y: number) {
    const s = SPELLS.find((q) => q.id === id);
    if (!s || !this.spellReady(id)) return false;
    this.spend(this.spellCost(id));
    this.spellCd[id] = s.cd * (1 - 0.08 * this.lv('mastery'));
    this.stats.spells++;
    this.screenFlash = 0.35;
    if (id === 'storm') {
      this.zones.push({ x, y, r: s.radius, t: 0, max: 3.2, tick: 0 });
      audio.sfx('storm');
      this.addShake(5);
    } else if (id === 'dirge') {
      this.workers.forEach((w) => { w.morale = Math.min(100, w.morale + 30); w.integrity = Math.min(w.maxInt, w.integrity + 25); this.burst(w.x, w.y, 6, '#ffd36b', 60, 'soul', 3, 0.9); });
      this.flashColor = '#ffd36b';
      this.text(this.mausoleum.x, this.mausoleum.y - 70, 'Rally Dirge!', '#ffd36b', 22, 1.6);
      audio.sfx('rally');
    } else if (id === 'militia') {
      for (let i = 0; i < 3; i++) this.militia.push({ id: this.nid++, x: x + rnd(-24, 24), y: y + rnd(-24, 24), hp: 60, life: 25, atkT: 0, flash: 0, dead: false, face: 1 });
      this.burst(x, y, 24, '#e8e2cf', 130, 'bone', 4, 0.8, 120);
      audio.sfx('militia');
    } else if (id === 'eclipse') {
      this.sunFx.eclipse = 18;
      this.sunFx.radiance = 0;
      this.flashColor = '#220033';
      this.screenFlash = 0.7;
      this.text(this.mausoleum.x, this.mausoleum.y - 80, 'ECLIPSE', '#b78cff', 30, 2);
      audio.sfx('eclipse');
      this.addShake(6);
    }
    return true;
  }
  bribe() {
    if (this.bribeCd > 0) { audio.sfx('error'); return; }
    if (this.res.coin < 80) { this.say('Bribing the bishop costs 80 🪙.', '#ff7a7a'); audio.sfx('error'); return; }
    this.res.coin -= 80;
    this.addInfamy(-30);
    this.bribeCd = 25;
    this.text(this.mausoleum.x, this.mausoleum.y - 60, 'Infamy −30', '#f2c14e', 18, 1.4);
    audio.sfx('coin');
  }

  // ---------- input ----------
  pointerMove(x: number, y: number, inside: boolean) {
    this.mouse.x = x; this.mouse.y = y; this.mouse.inside = inside;
  }
  buildingAt(x: number, y: number) {
    const c = Math.floor(x / TILE), r = Math.floor(y / TILE);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return undefined;
    const id = this.grid[r * COLS + c];
    return id ? this.bById(id) : undefined;
  }
  pointerDown(x: number, y: number, button: number) {
    if (this.status !== 'playing' || this.paused) return;
    if (button === 2) { this.cancelAll(); return; }
    if (this.targeting) {
      if (this.cast(this.targeting, x, y)) this.targeting = null;
      return;
    }
    if (this.tool === 'demolish') {
      const b = this.buildingAt(x, y);
      if (b) this.demolish(b);
      return;
    }
    if (this.tool) {
      const { col, row } = this.tileFor(this.tool, x, y);
      this.place(this.tool, col, row);
      return;
    }
    let best: Worker | null = null;
    let bd = 18;
    for (const w of this.workers) {
      if (w.inside !== null) continue;
      const d = Math.hypot(w.x - x, w.y - y);
      if (d < bd) { bd = d; best = w; }
    }
    if (best) { this.sel = { kind: 'worker', id: best.id }; audio.sfx('select'); return; }
    const b = this.buildingAt(x, y);
    if (b) {
      const sw = this.sel.kind === 'worker' ? this.wById(this.sel.id) : undefined;
      if (sw && b.def.slots > 0) { this.assignPin(sw, b); return; }
      this.sel = { kind: 'building', id: b.id };
      audio.sfx('select');
      return;
    }
    const si = this.sites.findIndex((s) => Math.hypot(s.x - x, s.y - y) < s.r);
    if (si >= 0) { this.sel = { kind: 'site', id: si }; audio.sfx('select'); return; }
    this.sel = { kind: null, id: 0 };
  }
  cancelAll() {
    const had = this.tool || this.targeting || this.sel.kind;
    this.tool = null; this.targeting = null; this.sel = { kind: null, id: 0 };
    return !!had;
  }
  selectTool(id: string | null) {
    this.tool = this.tool === id ? null : id;
    this.targeting = null;
    if (this.tool) { this.sel = { kind: null, id: 0 }; audio.sfx('click'); }
  }

  // ---------- raids ----------
  private edgePoint(team: 'zealot' | 'rival') {
    const dirs = team === 'zealot' ? ['W', 'N'] : ['E', 'S'];
    const dir = dirs[Math.floor(Math.random() * 2)];
    if (dir === 'W') return { x: -26, y: rnd(70, WH - 70), dir };
    if (dir === 'E') return { x: WW + 26, y: rnd(70, WH - 70), dir };
    if (dir === 'N') return { x: rnd(70, WW - 70), y: -26, dir };
    return { x: rnd(70, WW - 70), y: WH + 26, dir };
  }
  private compose(team: 'zealot' | 'rival', budget: number, day: number) {
    const weights: Record<string, number> = { pilgrim: 5, torch: 3, acolyte: 2.5, priest: 1.5, paladin: 1.2, thrall: 6, ghast: 3, rivalnec: 1.2 };
    const pool = Object.values(ENEMIES).filter((e) => e.team === team && !e.boss && e.minDay <= day);
    const out: string[] = [];
    let left = budget;
    let guard = 0;
    while (left >= 1 && guard++ < 90) {
      const c = pool.filter((e) => e.cost <= left);
      if (!c.length) break;
      const total = c.reduce((a, e) => a + (weights[e.id] || 1), 0);
      let r = Math.random() * total;
      let pick = c[0];
      for (const e of c) { r -= weights[e.id] || 1; if (r <= 0) { pick = e; break; } }
      out.push(pick.id);
      left -= pick.cost;
    }
    if (!out.length) out.push(pool[0].id);
    if (team === 'zealot' && this.infamy >= 75 && day >= 3) out.push('paladin');
    return out;
  }
  private makeRaid(team: 'zealot' | 'rival', units: string[], spawnAt: number, boss?: string) {
    const budgetSize = units.length;
    const sides = [this.edgePoint(team)];
    if (budgetSize > 10 || boss) {
      let s2 = this.edgePoint(team);
      let n = 0;
      while (s2.dir === sides[0].dir && n++ < 6) s2 = this.edgePoint(team);
      sides.push(s2);
    }
    const label = team === 'zealot' ? (boss ? 'The Sun Crusade' : 'Zealot Raid') : (boss ? 'The Archlich Rises' : 'Rival Necromancers');
    this.raids.push({ team, units, warnAt: spawnAt - 9, spawnAt, sides, warned: false, spawned: false, boss, label });
  }
  planDay() {
    if (this.tutHold) return;
    const d = this.dayNo;
    const start = this.time - (this.time % DAY_LEN);
    const [b0, , b2] = this.bounds;
    const infMul = 1 + (this.infamy / 100) * 0.7;
    const crus = this.mods.has('crusade') ? 1.35 : 1;
    const finalDay = !this.endless && d === this.goal;
    const bz = (2 + d * 3.2) * this.diff.raid * crus * infMul;
    const zUnits = this.compose('zealot', bz, d);
    const zAt = Math.max(this.time + 10, start + (d === 1 && this.time < 1 ? 0.4 : b0 + 0.02) * DAY_LEN);
    this.makeRaid('zealot', zUnits, zAt, finalDay ? 'inquisitor' : undefined);
    const rivalsOn = d >= 2 || this.mods.has('rivals');
    if (rivalsOn || finalDay) {
      const br = (1 + d * 2.4) * this.diff.raid * (this.mods.has('rivals') ? 1.4 : 1) + Math.min(8, Math.floor(this.res.souls / 10));
      const rUnits = this.compose('rival', br, d);
      this.makeRaid('rival', rUnits, Math.max(this.time + 10, start + (b2 + 0.02) * DAY_LEN), finalDay ? 'archlich' : undefined);
    }
  }
  private spawnTutorialRaid() {
    this.makeRaid('zealot', ['pilgrim', 'pilgrim', 'pilgrim', 'pilgrim'], this.time + 8);
    this.say('A zealot raid approaches from the edge!', '#ff9a3c');
  }
  nextRaid(): Raid | null {
    let best: Raid | null = null;
    for (const r of this.raids) if (!r.spawned && (!best || r.spawnAt < best.spawnAt)) best = r;
    return best;
  }
  private updateRaids(dt: number) {
    for (const r of this.raids) {
      if (!r.warned && this.time >= r.warnAt) {
        r.warned = true;
        audio.sfx('horn');
        this.say(`⚠ ${r.label} incoming from the ${r.sides.map((s) => ({ W: 'west', E: 'east', N: 'north', S: 'south' } as Record<string, string>)[s.dir]).join(' & ')}!`, r.team === 'zealot' ? '#ffd36b' : '#7bff9e');
        this.screenFlash = 0.2;
        this.flashColor = r.team === 'zealot' ? '#ffd36b' : '#7bff9e';
      }
      if (!r.spawned && this.time >= r.spawnAt) {
        r.spawned = true;
        r.units.forEach((id, i) => {
          const s = r.sides[i % r.sides.length];
          this.spawnQ.push({ t: this.time + i * 0.45 + rnd(0, 0.4), id, x: s.x + rnd(-34, 34), y: s.y + rnd(-34, 34), boss: false });
        });
        if (r.boss) {
          const s = r.sides[0];
          this.spawnQ.push({ t: this.time + 5, id: r.boss, x: s.x, y: s.y, boss: true });
          audio.sfx('boss');
          this.say(`${ENEMIES[r.boss].name} approaches!`, '#ff6b81');
        }
      }
    }
    this.raids = this.raids.filter((r) => !r.spawned || this.spawnQ.length > 0 || this.time < r.spawnAt + 2);
    if (this.spawnQ.length) {
      const rest: SpawnItem[] = [];
      for (const s of this.spawnQ) {
        if (this.time >= s.t) this.spawnEnemy(s.id, s.x, s.y, s.boss);
        else rest.push(s);
      }
      this.spawnQ = rest;
    }
    void dt;
  }
  spawnEnemy(id: string, x: number, y: number, boss = false) {
    const def = ENEMIES[id];
    const hpMul = this.diff.hp * (1 + (this.dayNo - 1) * 0.06);
    const e: Enemy = {
      id: this.nid++, def, x, y, hp: def.hp * hpMul, maxHp: def.hp * hpMul, atkT: rnd(0, 0.5), tk: null, tgt: null, retargetT: 0, flash: 0, slow: 1,
      spawnT: 0, t1: rnd(4, 8), t2: rnd(6, 10), t3: 6, phase2: false, stolen: {}, stealT: 0, dead: false, face: 1, healT: 0, wobble: Math.random() * 6, blocker: null,
    };
    if (boss) {
      e.t1 = 6; e.t2 = 9; e.t3 = 8;
      this.bossRef = e;
      if (id === 'inquisitor') this.bossSpawned.inquisitor = true;
      else this.bossSpawned.archlich = true;
    }
    this.enemies.push(e);
    if (this.enemies.length > 120) {
      const i = this.enemies.findIndex((q) => !q.def.boss && q !== e);
      if (i >= 0) this.enemies.splice(i, 1);
    }
    return e;
  }

  // ---------- damage ----------
  damageWorker(w: Worker, dmg: number) {
    if (w.dead || w.inside !== null) return;
    w.integrity -= dmg;
    w.flash = 1;
    this.burst(w.x, w.y, 3, SPECIES[w.species].color, 70, 'bone', 3, 0.5, 150);
    audio.sfx('hit');
    if (w.integrity <= 0) {
      w.dead = true;
      this.stats.lost++;
      this.burst(w.x, w.y, 18, SPECIES[w.species].color, 130, 'bone', 4, 0.9, 200);
      this.burst(w.x, w.y, 6, '#7fe3d4', 40, 'soul', 4, 1.4);
      this.text(w.x, w.y - 14, `${w.name} destroyed`, '#ff7a7a', 14, 1.6);
      this.say(`${w.name} the ${SPECIES[w.species].name} was destroyed. Morale suffers.`, '#ff7a7a');
      audio.sfx('collapse');
      this.addShake(3);
      this.workers.forEach((o) => { if (!o.dead) o.morale = Math.max(0, o.morale - 6); });
      this.assignT = 0;
    }
  }
  damageBuilding(b: Building, dmg: number) {
    if (!this.buildings.includes(b)) return;
    b.hp -= dmg;
    b.flash = 1;
    this.burst(b.x + rnd(-b.w / 3, b.w / 3), b.y + rnd(-b.w / 3, b.w / 3), 2, '#b9a37a', 70, 'spark', 2.5, 0.4, 100);
    if (b.def.kind === 'core') this.addShake(1.2);
    if (b.hp <= 0) {
      if (b.def.kind === 'core') {
        this.removeBuilding(b, true);
        this.lose();
        return;
      }
      this.text(b.x, b.y, `${b.def.name} destroyed!`, '#ff7a7a', 15, 1.6);
      this.say(`${b.def.name} was destroyed!`, '#ff7a7a');
      this.removeBuilding(b, true);
    }
  }
  damageEnemy(e: Enemy, dmg: number, pierce = false) {
    if (e.dead) return;
    const d = pierce ? dmg : dmg * (1 - e.def.armor);
    e.hp -= d;
    e.flash = 1;
    if (this.texts.length < 40) this.text(e.x + rnd(-6, 6), e.y - e.def.r - 4, `${Math.round(d)}`, pierce ? '#7fe3d4' : e.def.armor > 0 && !pierce ? '#bbb' : '#fff', 11, 0.7);
    this.burst(e.x, e.y, 2, e.def.team === 'zealot' ? '#e8d9a0' : '#9bff9b', 70, 'spark', 2.5, 0.4);
    audio.sfx('hit');
    if (e.hp <= 0) this.killEnemy(e);
  }
  private killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    const d = e.def;
    this.stats.kills++;
    if (d.team === 'zealot') this.stats.zealots++; else this.stats.rivals++;
    const big = d.boss ? 3 : 1;
    this.burst(e.x, e.y, 14 * big, d.color, 140 * big, 'spark', 3.5, 0.8);
    this.burst(e.x, e.y, 6 * big, '#ddd', 70, 'smoke', 8, 0.9);
    this.addShake(d.boss ? 14 : 1.5);
    audio.sfx('kill');
    // loot feeds the economy
    const loot: Partial<Res> = {};
    if (d.team === 'zealot') {
      loot.coin = Math.round(d.cost * rnd(2, 4));
      if (Math.random() < 0.65) loot.corpses = 1 + (d.cost > 3 ? 1 : 0);
    } else {
      loot.bones = d.cost * 2;
      if (Math.random() < 0.3 + d.cost * 0.05) loot.souls = 1;
      RES_KEYS.forEach((k) => { if (e.stolen[k]) loot[k] = (loot[k] || 0) + (e.stolen[k] as number); });
    }
    if (d.boss) {
      loot.coin = 200; loot.souls = 10; loot.bones = 80; loot.corpses = 6;
      this.stats.bosses++;
      this.say(`${d.name} has fallen!`, '#ffd36b');
      this.text(e.x, e.y - 30, `${d.name} DEFEATED`, '#ffd36b', 22, 2.5);
      this.flashColor = '#fff'; this.screenFlash = 0.6;
      if (d.id === 'inquisitor') { this.bossDead.inquisitor = true; this.sunFx.radiance = 0; } else this.bossDead.archlich = true;
      audio.sfx('boom');
    }
    this.gain(loot);
    const parts = RES_KEYS.filter((k) => loot[k]).map((k) => `+${loot[k]}${RES_META[k].icon}`).join(' ');
    if (parts) this.text(e.x, e.y - 10, parts, '#f2c14e', 12, 1.2);
    // refund tracking for stolen
    if (this.tutorial && d.id === 'pilgrim') { /* counted via stats */ }
  }
  private damageMilitia(m: Militia, dmg: number) {
    m.hp -= dmg; m.flash = 1;
    if (m.hp <= 0) { m.dead = true; this.burst(m.x, m.y, 8, '#e8e2cf', 80, 'bone', 3, 0.6, 150); }
  }

  // ---------- main update ----------
  update(rawDt: number) {
    if (this.paused || this.status !== 'playing') return;
    let left = rawDt * this.speed;
    while (left > 0) {
      const dt = Math.min(0.05, left);
      left -= dt;
      this.step(dt);
      if (this.status !== 'playing') break;
    }
    this.updateVisual(rawDt);
  }

  private step(dt: number) {
    // time & phases
    const prevDay = Math.floor(this.time / DAY_LEN);
    this.time += dt;
    const nd = Math.floor(this.time / DAY_LEN);
    if (nd > prevDay) {
      if (this.tutHold) this.time -= DAY_LEN;
      else {
        this.dayNo++;
        this.onNewDay();
      }
    }
    const c = this.cycle;
    const ph = this.phaseOf(c);
    if (ph !== this.phase) {
      this.phase = ph;
      if (ph === 'day') { audio.sfx('day'); this.say('The sun climbs. Zombies, ghouls and wraiths weaken.', '#ffd36b'); }
      if (ph === 'night') { audio.sfx('night'); this.say('Night falls. The dead are strong — and rivals stir.', '#8fb8ff'); }
      if (ph === 'dusk') this.say('Dusk. Dayside shift ends — Nightside rises.', '#ff9a6b');
      if (ph === 'dawn') this.say('Dawn. Nightside shift retires.', '#ffd36b');
      this.assignT = 0;
    }
    this.sunFx.eclipse = Math.max(0, this.sunFx.eclipse - dt);
    this.sunFx.radiance = Math.max(0, this.sunFx.radiance - dt);
    const sunTarget = this.sunFx.radiance > 0 ? 1 : this.sunFx.eclipse > 0 ? 0 : this.sunBase(c);
    this.sunVis += clamp(sunTarget - this.sunVis, -dt * 1.2, dt * 1.2);
    // economy ticks
    this.infamy = Math.max(0, this.infamy - 0.12 * dt);
    this.bribeCd = Math.max(0, this.bribeCd - dt);
    for (const k in this.spellCd) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt);
    if (this.tutorial) this.updateTutorial();
    this.updateRaids(dt);
    this.assignT -= dt;
    if (this.assignT <= 0) { this.assignJobs(); this.assignT = 0.4; }
    for (const b of this.buildings) { b.effAcc = 0; b.working = false; }
    for (const e of this.enemies) e.slow = 1;
    for (const w of this.workers) this.updateWorker(w, dt);
    this.updateSites(dt);
    for (const b of [...this.buildings]) this.updateBuilding(b, dt);
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.separateEnemies();
    for (const m of this.militia) this.updateMilitia(m, dt);
    this.updateZones(dt);
    this.updateHazards(dt);
    this.updateProjs(dt);
    // cleanup
    if (this.workers.some((w) => w.dead)) {
      this.workers = this.workers.filter((w) => !w.dead);
      if (this.sel.kind === 'worker' && !this.wById(this.sel.id)) this.sel = { kind: null, id: 0 };
    }
    if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
    if (this.militia.some((m) => m.dead)) this.militia = this.militia.filter((m) => !m.dead);
    if (this.bossRef && this.bossRef.dead) this.bossRef = null;
    this.checkEnd();
  }

  private onNewDay() {
    this.say(`Day ${this.dayNo}${!this.endless && this.dayNo === this.goal ? ' — FINAL DAY: the bosses come!' : ''}`, '#ffd36b');
    this.text(this.mausoleum.x, this.mausoleum.y - 90, `DAY ${this.dayNo}`, '#ffd36b', 30, 2.2);
    this.planDay();
  }

  private checkEnd() {
    if (this.status !== 'playing') return;
    const m = this.mausoleum;
    if (!m || m.hp <= 0) { this.lose(); return; }
    if (!this.endless && this.bossDead.inquisitor && this.bossDead.archlich) this.win();
  }
  private win() {
    if (this.status !== 'playing') return;
    this.status = 'won';
    audio.sfx('victory');
    this.ended = true;
    this.onEnd?.();
  }
  private lose() {
    if (this.status !== 'playing') return;
    this.status = 'lost';
    audio.sfx('defeat');
    this.ended = true;
    this.onEnd?.();
  }
  continueEndless() {
    this.endless = true;
    this.status = 'playing';
    this.ended = false;
    this.say('Endless mode: the crusades never end.', '#b78cff');
  }
  result(): RunResult {
    const won = this.status === 'won' || (this.endless && this.stats.bosses >= 2);
    const modMul = 1 + [...this.mods].reduce((a, id) => a + ({ crusade: 0.35, restless: 0.3, pauper: 0.3, sun: 0.4, rivals: 0.35 } as Record<string, number>)[id], 0);
    const base = (this.dayNo - 1) * 3 + this.stats.kills * 0.15 + this.stats.bosses * 12 + (won ? 20 : 0);
    const total = Math.round(base * this.diff.shards * modMul);
    const shards = this.tutorial ? Math.min(total, 6) : Math.max(0, total - this.shardsPaid);
    return {
      won, days: this.dayNo, shards, time: this.time, kills: this.stats.kills, zealots: this.stats.zealots, rivals: this.stats.rivals,
      raised: this.stats.raised, lost: this.stats.lost, coin: this.stats.coin, built: this.stats.built, peakInfamy: this.stats.peakInfamy,
      spells: this.stats.spells, bosses: this.stats.bosses, corpses: this.stats.corpses, collapsed: this.stats.collapsed, sites: this.stats.sites,
    };
  }

  // ---------- tutorial ----------
  private updateTutorial() {
    const step = TUTORIAL[this.tutStep];
    if (!step) return;
    let done = false;
    switch (step.id) {
      case 'plot': done = this.count('plot') > 0; break;
      case 'mill': done = this.count('mill') > 0; break;
      case 'crypt': done = this.count('crypt') > 0; break;
      case 'shift': done = this.stats.shiftChanges > 0; break;
      case 'turret': done = this.count('turret') > 0 && this.stats.pins > 0; break;
      case 'pit': done = this.stats.raised > 0; break;
      case 'raid': done = this.stats.zealots >= 3; break;
      case 'spell': done = this.stats.spells > 0; break;
      default: break;
    }
    if (done) {
      this.tutStep++;
      audio.sfx('upgrade');
      this.text(this.mausoleum.x, this.mausoleum.y - 70, 'Step complete!', '#7fe3d4', 20, 1.4);
      const nxt = TUTORIAL[this.tutStep];
      if (nxt && nxt.id === 'raid') this.spawnTutorialRaid();
      if (!nxt) {
        this.say('Tutorial complete! Normal raids begin tomorrow. Survive to the final day.', '#7fe3d4');
        this.planDay();
      }
    }
  }
  get tutDone() { return this.tutStep >= TUTORIAL.length; }
  skipTutorial() {
    if (!this.tutorial || this.tutDone) return;
    this.tutStep = TUTORIAL.length;
    this.say('Tutorial skipped. Normal raids begin shortly.', '#7fe3d4');
    this.planDay();
  }

  // ---------- job assignment ----------
  private assignJobs() {
    for (const b of this.buildings) b.crew = [];
    const elig = this.workers.filter((w) => !w.dead && this.onShift(w) && !w.repairing && !w.strike);
    const raidOn = this.enemies.length > 0 || this.raids.some((r) => r.warned && !r.spawned);
    for (const w of this.workers) if (!elig.includes(w)) w.job = null;
    const free: Worker[] = [];
    for (const w of elig) {
      if (w.pin != null) {
        const b = this.bById(w.pin);
        if (!b || b.def.slots <= 0) { w.pin = null; free.push(w); continue; }
        if (b.crew.length < b.def.slots) { b.crew.push(w.id); w.job = b.id; continue; }
        w.job = null;
        free.push(w);
      } else free.push(w);
    }
    const pairs: { w: Worker; b: Building; s: number }[] = [];
    for (const w of free) {
      const sp = SPECIES[w.species];
      for (const b of this.buildings) {
        if (b.def.slots <= 0) continue;
        const kind = b.def.kind;
        let prio = kind === 'prod' ? 5 : kind === 'pit' ? 4 : kind === 'aura' ? 3.5 : kind === 'turret' ? 3 : kind === 'ward' ? 3 : 2;
        if (raidOn && (kind === 'turret' || kind === 'guard' || kind === 'ward')) prio += 9;
        if (b.stalled) prio -= 40;
        const skill = sp.skills[b.def.skill] * Math.max(0.1, this.speciesMult(sp));
        const dist = Math.hypot(w.x - b.x, w.y - b.y);
        const s = skill * 4 + prio - dist / 160 + (w.job === b.id ? 3 : 0);
        pairs.push({ w, b, s });
      }
    }
    pairs.sort((a, b) => b.s - a.s);
    const done = new Set<number>();
    for (const p of pairs) {
      if (done.has(p.w.id) || p.b.crew.length >= p.b.def.slots) continue;
      if (p.b.stalled && p.s < -20) continue;
      p.b.crew.push(p.w.id);
      p.w.job = p.b.id;
      done.add(p.w.id);
    }
    for (const w of free) if (!done.has(w.id)) w.job = null;
  }

  private findHousing(w: Worker) {
    let best: Building | null = null;
    let bd = 1e9;
    for (const b of this.buildings) {
      const cap = this.housingOf(b);
      if (!cap || b.inside.length >= cap) continue;
      const d = Math.hypot(w.x - b.x, w.y - b.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  private moveTo(o: { x: number; y: number; face?: number }, tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - o.x, dy = ty - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return 0;
    const s = Math.min(d, speed * dt);
    o.x += (dx / d) * s;
    o.y += (dy / d) * s;
    if (Math.abs(dx) > 1 && o.face !== undefined) o.face = dx > 0 ? 1 : -1;
    return d - s;
  }
  workEff(w: Worker, b: Building) {
    const sp = SPECIES[w.species];
    const moraleF = w.morale <= 8 ? 0 : 0.6 + 0.6 * (w.morale / 100);
    const intF = Math.min(1, 0.5 + w.integrity / 50);
    return sp.skills[b.def.skill] * w.mult * moraleF * intF * b.haunt * this.prodMul();
  }

  private updateWorker(w: Worker, dt: number) {
    if (w.dead) return;
    const sp = SPECIES[w.species];
    w.flash = Math.max(0, w.flash - dt * 4);
    w.atkT -= dt;
    w.mult = this.speciesMult(sp);
    const onShift = this.onShift(w);
    if (w.integrity < 20) { if (!w.repairing) { this.stats.collapsed++; this.text(w.x, w.y - 16, 'Needs repair', '#ff9a3c', 11); } w.repairing = true; }
    else if (w.integrity >= 70) w.repairing = false;
    if (w.morale <= 8) { if (!w.strike) this.text(w.x, w.y - 16, 'On strike!', '#ff6b81', 12); w.strike = true; }
    else if (w.morale >= 25) w.strike = false;
    const dirgeBonus = 1 + 0.2 * this.lv('dirges');
    // inside housing
    if (w.inside !== null) {
      const hb = this.bById(w.inside);
      if (!hb) w.inside = null;
      else {
        w.integrity = Math.min(w.maxInt, w.integrity + 4 * dt);
        w.morale = Math.min(100, w.morale + 1.6 * dt * dirgeBonus);
        w.x = hb.x; w.y = hb.y;
        w.state = 'resting';
        const out = onShift && !w.repairing && !w.strike && !this.nearestEnemy(hb.x, hb.y, 110);
        if (out) {
          w.inside = null;
          hb.inside = hb.inside.filter((i) => i !== w.id);
          w.y = hb.y + hb.w / 2 + 10;
        } else return;
      }
    }
    // sites ambient morale
    for (const s of this.sites) {
      if (Math.hypot(s.x - w.x, s.y - w.y) < s.r + 20) w.morale = clamp(w.morale + (s.state === 'haunted' ? 0.35 : -0.35) * dt, 0, 100);
    }
    const job = w.job != null ? this.bById(w.job) : undefined;
    const guard = !!job && job.def.kind === 'guard';
    const threat = !guard && w.species !== 'golem' ? this.nearestEnemy(w.x, w.y, 95) : null;
    const spd = sp.speed * (0.65 + 0.35 * Math.min(1, w.mult));
    let goal = 'idle';
    if (threat) goal = 'flee';
    else if (w.repairing || !onShift) goal = 'rest';
    else if (w.strike) goal = 'idle';
    else if (job) goal = 'work';

    if (goal === 'flee' || goal === 'rest') {
      const h = this.findHousing(w);
      if (h) {
        const rem = this.moveTo(w, h.x, h.y, spd * (goal === 'flee' ? 1.3 : 1), dt);
        w.state = goal === 'flee' ? 'fleeing' : 'moving';
        if (rem < 14 && h.inside.length < this.housingOf(h)) {
          w.inside = h.id;
          h.inside.push(w.id);
          w.job = null;
        }
      } else {
        const m = this.mausoleum;
        const tx = goal === 'flee' ? m.x : w.hx, ty = goal === 'flee' ? m.y + 70 : w.hy;
        const rem = this.moveTo(w, tx, ty, spd, dt);
        w.state = rem > 3 ? 'moving' : 'resting';
        if (rem <= 3) {
          w.integrity = Math.min(w.maxInt, w.integrity + 1.2 * dt);
          w.morale = Math.min(100, w.morale + 0.2 * dt);
        }
      }
      return;
    }
    if (goal === 'idle') {
      const rem = this.moveTo(w, w.hx, w.hy, spd, dt);
      w.state = rem > 3 ? 'moving' : w.strike ? 'strike' : 'idle';
      w.integrity = Math.min(w.maxInt, w.integrity + 0.5 * dt);
      w.morale = Math.min(100, w.morale + (w.strike ? 0.5 : 0.1) * dt);
      return;
    }
    // work
    const b = job as Building;
    const k = Math.max(0, b.crew.indexOf(w.id));
    const n = Math.max(1, b.def.slots);
    const spotX = b.x + (k - (n - 1) / 2) * 20;
    const spotY = b.y + b.w / 2 + 12;
    const roundF = w.shift === 'round' ? 1 : 0;
    const wearMul = (1 + Math.max(0, 1 - w.mult) * 0.8) * (1 - 0.08 * this.lv('sinew'));
    const drainMorale = 0.12 * (roundF ? 2.5 : 1) * this.moraleLossMul();
    if (guard) {
      const foe = this.nearestEnemy(b.x, b.y, 210);
      if (foe) {
        const range = sp.range;
        const d = Math.hypot(foe.x - w.x, foe.y - w.y) - foe.def.r;
        if (d > range) { this.moveTo(w, foe.x, foe.y, spd * 1.1, dt); w.state = 'moving'; }
        else {
          w.state = 'fighting';
          w.face = foe.x > w.x ? 1 : -1;
          if (w.atkT <= 0) {
            w.atkT = sp.cd;
            const dmg = sp.atk * this.guardMul(w) * (1 + 0.12 * this.lv('ballistics')) * Math.max(0.3, w.mult);
            if (range > 40) this.fireProj(w.x, w.y, foe, dmg, false, true, 'wisp', '#8fb8ff', 300);
            else { this.damageEnemy(foe, dmg, false); this.burst(foe.x, foe.y, 3, '#fff', 60, 'spark', 2.5, 0.3); }
            w.integrity -= 0.25;
          }
        }
        w.morale = Math.max(0, w.morale - drainMorale * 0.5 * dt);
        return;
      }
    }
    const rem = this.moveTo(w, spotX, spotY, spd, dt);
    if (rem > 4) { w.state = 'moving'; return; }
    w.state = 'working';
    b.working = true;
    const eff = this.workEff(w, b);
    b.effAcc += eff;
    w.integrity = Math.max(0, w.integrity - 0.7 * dt * (roundF ? 1.35 : 1) * wearMul * (guard ? 0.3 : 1));
    w.morale = Math.max(0, w.morale - drainMorale * dt);
    if (Math.random() < dt * 1.2 && !guard) this.burst(w.x, w.y - 6, 1, '#b9a37a', 30, 'smoke', 3, 0.5);
    if (this.time - this.lastWorkSfx > 0.35 && Math.random() < 0.3) { this.lastWorkSfx = this.time; audio.sfx('work'); }
  }
  private guardMul(w: Worker) {
    const sp = SPECIES[w.species];
    return sp.skills.guard;
  }

  private updateSites(dt: number) {
    for (const s of this.sites) {
      s.pulse += dt;
      if (s.state !== 'haunted') continue;
      const priest = this.enemies.some((e) => !e.dead && e.def.id === 'priest' && Math.hypot(e.x - s.x, e.y - s.y) < s.r + 20);
      const warded = this.buildings.some((b) => b.def.kind === 'ward' && b.active && Math.hypot(b.x - s.x, b.y - s.y) < b.radius);
      if (priest && !warded) {
        s.prog += dt / 7;
        if (Math.random() < dt * 6) this.burst(s.x + rnd(-30, 30), s.y + rnd(-20, 20), 1, '#fff3b0', 40, 'soul', 3, 1);
        if (s.prog >= 1) {
          s.state = 'consecrated';
          s.prog = 1;
          this.stats.sites++;
          this.say('A haunted site was CONSECRATED! Its bonuses are lost. Click it to re-haunt (5 souls).', '#fff3b0');
          this.text(s.x, s.y - 20, 'Consecrated!', '#fff3b0', 18, 1.6);
          audio.sfx('consecrate');
          this.buildings.forEach((b) => this.updateHaunt(b));
        }
      } else s.prog = Math.max(0, s.prog - dt * (warded ? 0.5 : 0.12));
    }
    void RES_META;
  }

  private updateBuilding(b: Building, dt: number) {
    b.pop = Math.min(1, b.pop + dt * 4);
    b.flash = Math.max(0, b.flash - dt * 4);
    b.hauntT -= dt;
    if (b.hauntT <= 0) { this.updateHaunt(b); b.hauntT = 1; }
    if (b.fire > 0) {
      const warded = this.buildings.some((o) => o.def.kind === 'ward' && o.active && Math.hypot(o.x - b.x, o.y - b.y) < o.radius);
      b.fire -= dt * (warded ? 3 : 1);
      this.damageBuilding(b, 5 * dt);
      if (Math.random() < dt * 10) this.burst(b.x + rnd(-b.w / 3, b.w / 3), b.y + rnd(-b.w / 3, 0), 1, '#ff9a3c', 40, 'spark', 3, 0.5, -60);
      if (Math.random() < dt * 4) audio.sfx('burn');
    }
    const eff = b.effAcc;
    b.eff = eff;
    const def = b.def;
    switch (def.kind) {
      case 'prod': {
        const have = this.canAfford(def.inputs);
        if (!b.active) {
          if (!have) {
            const miss = RES_KEYS.find((k) => this.res[k] < (def.inputs[k] || 0));
            b.stalled = miss ? `needs ${RES_META[miss].icon}` : '';
          } else {
            b.stalled = '';
            if (eff > 0) { this.spend(def.inputs); b.active = true; b.progress = 0; }
          }
        } else b.stalled = '';
        if (b.active) {
          b.progress += dt * eff;
          if (b.progress >= def.cycle) {
            b.progress = 0;
            b.active = false;
            this.gain(def.outputs);
            this.stats.produced++;
            const parts = RES_KEYS.filter((k) => def.outputs[k]).map((k) => `+${def.outputs[k]}${RES_META[k].icon}`).join(' ');
            this.text(b.x, b.y - b.w / 2 - 4, parts, '#e8e2cf', 13, 1.0);
            if (def.outputs.coin) { this.stats.coin += def.outputs.coin; audio.sfx('coin'); }
            if (def.outputs.corpses) this.stats.corpses += def.outputs.corpses;
            this.burst(b.x, b.y - b.w / 3, 5, def.outputs.souls ? '#7fe3d4' : '#e8e2cf', 60, def.outputs.souls ? 'soul' : 'bone', 3, 0.8, def.outputs.souls ? -40 : 120);
            if (def.infamy) this.addInfamy(def.infamy);
          }
        }
        break;
      }
      case 'pit': {
        b.stalled = b.queue.length ? '' : 'idle';
        if (b.queue.length && eff > 0) {
          const sp = SPECIES[b.queue[0]];
          if (this.workers.length >= this.popCap) b.stalled = 'pop cap';
          else {
            b.progress += dt * eff;
            if (Math.random() < dt * 8) this.burst(b.x + rnd(-20, 20), b.y, 1, '#b78cff', 40, 'soul', 3, 0.9, -50);
            if (b.progress >= sp.raise) {
              b.progress = 0;
              const id = b.queue.shift() as SpeciesId;
              const w = this.addWorker(id, this.defaultShift, b.x, b.y + b.w / 2);
              this.stats.raised++;
              this.addInfamy(id === 'golem' ? 5 : 3);
              this.burst(b.x, b.y, 24, '#b78cff', 120, 'soul', 4, 1.1, -30);
              this.text(b.x, b.y - b.w / 2 - 6, `${w.name} rises!`, '#b78cff', 15, 1.5);
              this.say(`${w.name} the ${SPECIES[id].name} rises from the pit.`, '#b78cff');
              audio.sfx('raise');
              this.addShake(2);
              this.assignT = 0;
            }
          }
        } else if (!b.queue.length) b.progress = 0;
        break;
      }
      case 'aura': {
        b.active = eff > 0;
        if (b.active) {
          for (const w of this.workers) {
            if (w.inside === null && Math.hypot(w.x - b.x, w.y - b.y) < 220) w.morale = Math.min(100, w.morale + 1.8 * Math.min(2, eff) * dt * (1 + 0.2 * this.lv('dirges')));
          }
          if (Math.random() < dt * 3) this.burst(b.x + rnd(-20, 20), b.y - 10, 1, '#ffd36b', 30, 'note', 6, 1.2, -40);
        }
        break;
      }
      case 'turret': {
        b.cdT -= dt;
        b.radius = 250;
        b.active = eff > 0;
        if (eff > 0) {
          b.warn = b.ammo <= 0 && this.res.bones < 1 ? 'no bones' : '';
          const foe = this.nearestEnemy(b.x, b.y, 250);
          if (foe && b.cdT <= 0 && !b.warn) {
            if (b.ammo <= 0) { this.res.bones -= 1; b.ammo = 3; }
            b.ammo--;
            b.cdT = 1.1 / clamp(eff, 0.4, 2.2);
            this.fireProj(b.x, b.y - 6, foe, 18 * (1 + 0.12 * this.lv('ballistics')), false, false, 'arrow', '#e8e2cf', 460);
            audio.sfx('shoot');
          }
        } else b.warn = 'unmanned';
        break;
      }
      case 'ward': {
        b.radius = 150 * (b.haunt > 1 ? 1.25 : 1);
        if (eff > 0) {
          if (b.warn === 'unmanned') b.warn = '';
          b.soulT -= dt;
          if (b.soulT <= 0) {
            if (this.res.souls >= 1) { this.res.souls -= 1; b.soulT = 12; b.warn = ''; }
            else { b.warn = 'no souls'; b.soulT = 0; }
          }
          b.active = !b.warn;
        } else { b.active = false; b.warn = 'unmanned'; }
        if (b.active) {
          b.pulseT -= dt;
          const hit = b.pulseT <= 0;
          if (hit) b.pulseT = 1.5;
          let n = 0;
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (Math.hypot(e.x - b.x, e.y - b.y) < b.radius) {
              e.slow = Math.min(e.slow, 0.55);
              if (hit && n++ < 5) { this.damageEnemy(e, 9 * clamp(eff, 0.4, 2.2), true); this.burst(e.x, e.y, 3, '#8fb8ff', 50, 'soul', 3, 0.6); }
            }
          }
          if (hit) b.flash = Math.max(b.flash, 0.4);
        }
        break;
      }
      case 'core': {
        b.cdT -= dt;
        b.radius = 175;
        if (b.cdT <= 0) {
          const foe = this.nearestEnemy(b.x, b.y, 175);
          if (foe) {
            b.cdT = 1.3;
            this.fireProj(b.x, b.y, foe, 12 + this.lv('bulwark') * 3, false, true, 'wisp', '#b78cff', 320);
            audio.sfx('bolt');
          }
        }
        break;
      }
      default: break;
    }
  }

  private fireProj(x: number, y: number, tgt: Enemy | Worker | Building | Militia, dmg: number, foe: boolean, pierce: boolean, kind: string, color: string, speed: number, tk: TK | null = null) {
    this.projs.push({ x, y, vx: 0, vy: 0, dmg, foe, pierce, life: 3, kind, tk, tgt, speed, dead: false, color });
  }

  private updateEnemy(e: Enemy, dt: number) {
    if (e.dead) return;
    const d = e.def;
    e.spawnT = Math.min(1, e.spawnT + dt * 1.5);
    e.flash = Math.max(0, e.flash - dt * 5);
    e.atkT -= dt;
    e.wobble += dt * 8;
    const zeal = d.team === 'zealot';
    const sun = this.effSun;
    const spdMul = e.slow * (zeal ? 1 + 0.2 * sun : 1);
    const dmgMul = zeal ? 1 + 0.25 * sun : 1;
    if (e.spawnT < 0.6) return;

    // boss logic
    if (d.boss) this.bossLogic(e, dt);
    // priest heal
    if (d.id === 'priest') {
      e.healT -= dt;
      if (e.healT <= 0) {
        e.healT = 2;
        for (const o of this.enemies) if (!o.dead && o.def.team === 'zealot' && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 100 && o.hp < o.maxHp) {
          o.hp = Math.min(o.maxHp, o.hp + 14);
          this.burst(o.x, o.y, 3, '#fff3b0', 30, 'soul', 3, 0.7, -50);
        }
      }
    }
    // rival necromancer: siphon, curse, summon
    if (d.id === 'rivalnec') {
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.t1 = 10;
        for (let i = 0; i < 2; i++) this.spawnEnemy('thrall', e.x + rnd(-20, 20), e.y + rnd(-20, 20));
        this.burst(e.x, e.y, 12, '#6bff9e', 90, 'soul', 4, 0.9);
      }
      this.siphon(e, dt, 230, 1.5);
      for (const w of this.workers) if (w.inside === null && Math.hypot(w.x - e.x, w.y - e.y) < 130) w.morale = Math.max(0, w.morale - 2 * dt);
    }
    if (d.id === 'archlich') this.siphon(e, dt, 260, e.phase2 ? 0.8 : 1.3);

    // targeting
    e.retargetT -= dt;
    const tgtAlive = this.targetAlive(e);
    if (e.retargetT <= 0 || !tgtAlive) {
      e.retargetT = 0.7;
      const t = this.pickTarget(e);
      e.tk = t ? t.k : null;
      e.tgt = t ? t.o : null;
    }
    if (!e.tgt) {
      const m = this.mausoleum;
      if (m) this.moveTo(e, m.x, m.y, d.speed * spdMul, dt);
      return;
    }
    const pos = this.targetPos(e);
    const dx = pos.x - e.x, dy = pos.y - e.y;
    const dist = Math.hypot(dx, dy) - pos.r;
    const wantRange = d.id === 'rivalnec' ? 190 : d.range;
    e.blocker = null;
    if (dist <= wantRange) {
      if (Math.abs(dx) > 1) e.face = dx > 0 ? 1 : -1;
      if (d.id === 'priest' && e.tk === 's') return;
      if (e.atkT <= 0) {
        e.atkT = d.cd * rnd(0.9, 1.1);
        this.enemyAttack(e, dmgMul);
      }
      return;
    }
    // melee blockers (walls & buildings in the way)
    if (d.range < 40) {
      const len = Math.hypot(dx, dy) || 1;
      let blk: Building | null = null;
      for (const b of this.buildings) {
        if (b === e.tgt) continue;
        const rd = this.rectDist(e.x, e.y, b);
        const wall = b.def.kind === 'wall';
        if (rd < (wall ? 26 : 5)) {
          const dot = ((b.x - e.x) * dx + (b.y - e.y) * dy) / (len * (Math.hypot(b.x - e.x, b.y - e.y) || 1));
          if (dot > (wall ? 0.2 : 0.5)) { blk = b; break; }
        }
      }
      if (blk) {
        e.blocker = blk;
        if (e.atkT <= 0) { e.atkT = d.cd; this.meleeBuilding(e, blk, dmgMul); }
        return;
      }
    }
    this.moveTo(e, pos.x, pos.y, d.speed * spdMul, dt);
    if (Math.abs(dx) > 1) e.face = dx > 0 ? 1 : -1;
  }

  private siphon(e: Enemy, dt: number, range: number, every: number) {
    let near: Building | null = null;
    let bd = range;
    for (const b of this.buildings) { const dd = Math.hypot(b.x - e.x, b.y - e.y); if (dd < bd) { bd = dd; near = b; } }
    if (!near) return;
    e.stealT -= dt;
    if (e.stealT <= 0) {
      e.stealT = every;
      const pick: ResKey | undefined = (['souls', 'corpses', 'ecto'] as ResKey[]).find((k) => this.res[k] >= 1);
      if (pick) {
        this.res[pick] -= 1;
        e.stolen[pick] = (e.stolen[pick] || 0) + 1;
        if (this.parts.length < MAX_PARTICLES) this.parts.push({ x: near.x, y: near.y, vx: 0, vy: 0, life: 1.4, max: 1.4, size: 4, color: RES_META[pick].color, kind: 'wisp', rot: 0, vr: 0, g: 0, ref: e });
        this.text(near.x, near.y - 20, `−1${RES_META[pick].icon} siphoned`, '#6bff9e', 12);
        audio.sfx('siphon');
      }
    }
  }

  private bossLogic(e: Enemy, dt: number) {
    const d = e.def;
    e.t1 -= dt; e.t2 -= dt; e.t3 -= dt;
    if (!e.phase2 && e.hp < e.maxHp * 0.5) {
      e.phase2 = true;
      this.addShake(12);
      audio.sfx('boss');
      this.text(e.x, e.y - 40, d.id === 'inquisitor' ? 'RADIANCE!' : 'UNBOUND!', d.color, 26, 2);
      this.say(d.id === 'inquisitor' ? 'The Inquisitor calls down false dawn! Undead weaken!' : 'Vorgrath sheds his restraints!', '#ff6b81');
      if (d.id === 'inquisitor') {
        this.sunFx.radiance = 16;
        for (let i = 0; i < 4; i++) this.spawnEnemy('pilgrim', e.x + rnd(-40, 40), e.y + rnd(-40, 40));
      }
    }
    if (d.id === 'inquisitor') {
      if (e.t1 <= 0) {
        e.t1 = e.phase2 ? 8 : 12;
        const targets = [...this.buildings].filter((b) => b.def.kind !== 'wall').sort(() => Math.random() - 0.5).slice(0, 3);
        for (const b of targets) this.hazards.push({ x: b.x, y: b.y, r: 60, t: 0, max: 1.6, dmg: 85, kind: 'smite' });
        audio.sfx('smite');
        this.say('Holy Smite! Buildings are marked!', '#ffd36b');
      }
      if (e.phase2 && e.t2 <= 0) {
        e.t2 = 28;
        this.sunFx.radiance = Math.max(this.sunFx.radiance, 12);
        for (let i = 0; i < 3; i++) this.spawnEnemy('pilgrim', e.x + rnd(-40, 40), e.y + rnd(-40, 40));
        this.screenFlash = 0.5; this.flashColor = '#fff3b0';
      }
    } else {
      if (e.t1 <= 0) {
        e.t1 = e.phase2 ? 6 : 8;
        for (let i = 0; i < 3; i++) this.spawnEnemy('thrall', e.x + rnd(-30, 30), e.y + rnd(-30, 30));
        this.burst(e.x, e.y, 20, '#b36bff', 120, 'soul', 4, 1);
        audio.sfx('raise');
      }
      if (e.t2 <= 0) {
        e.t2 = 11;
        this.hazards.push({ x: e.x, y: e.y, r: 140, t: 0, max: 1.8, dmg: 45, kind: 'rend' });
        this.say('Soul Rend! Get clear of Vorgrath!', '#b36bff');
        audio.sfx('smite');
      }
      if (e.phase2 && e.t3 <= 0) {
        e.t3 = 7;
        const n = 14;
        const off = Math.random() * 6;
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          this.projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 170, vy: Math.sin(a) * 170, dmg: 14, foe: true, pierce: true, life: 4, kind: 'nova', tk: null, tgt: null, speed: 170, dead: false, color: '#b36bff' });
        }
        audio.sfx('bolt');
        this.addShake(4);
      }
    }
  }

  private targetAlive(e: Enemy) {
    if (!e.tgt) return false;
    if (e.tk === 'w') { const w = e.tgt as Worker; return !w.dead && w.inside === null; }
    if (e.tk === 'b') return this.buildings.includes(e.tgt as Building);
    if (e.tk === 'm') return !(e.tgt as Militia).dead;
    if (e.tk === 's') return (e.tgt as Site).state === 'haunted';
    return false;
  }
  private targetPos(e: Enemy) {
    const t = e.tgt as { x: number; y: number };
    if (e.tk === 'b') return { x: t.x, y: t.y, r: (e.tgt as Building).w / 2 };
    if (e.tk === 's') return { x: t.x, y: t.y, r: 10 };
    return { x: t.x, y: t.y, r: 8 };
  }
  private pickTarget(e: Enemy): { k: TK; o: Worker | Building | Militia | Site } | null {
    const id = e.def.id;
    const outside = this.workers.filter((w) => !w.dead && w.inside === null);
    const near = <T extends { x: number; y: number }>(arr: T[], max = 1e9) => {
      let best: T | null = null; let bd = max;
      for (const o of arr) { const dd = Math.hypot(o.x - e.x, o.y - e.y); if (dd < bd) { bd = dd; best = o; } }
      return best;
    };
    const bs = this.buildings;
    const nonWall = bs.filter((b) => b.def.kind !== 'wall');
    const mil = near(this.militia.filter((m) => !m.dead), 70);
    if (mil && !e.def.boss) return { k: 'm', o: mil };
    switch (id) {
      case 'priest': {
        const s = near(this.sites.filter((q) => q.state === 'haunted'));
        if (s) return { k: 's', o: s };
        break;
      }
      case 'paladin': case 'inquisitor': case 'archlich': return { k: 'b', o: this.mausoleum };
      case 'acolyte': {
        const w = near(outside, 260);
        if (w) return { k: 'w', o: w };
        const b = near(nonWall);
        if (b) return { k: 'b', o: b };
        break;
      }
      case 'ghast': {
        const w = near(outside);
        if (w) return { k: 'w', o: w };
        const b = near(nonWall);
        if (b) return { k: 'b', o: b };
        break;
      }
      case 'thrall': {
        const w = near(outside, 150);
        if (w) return { k: 'w', o: w };
        const m = near(this.militia.filter((q) => !q.dead), 150);
        if (m) return { k: 'm', o: m };
        break;
      }
      case 'torch': case 'rivalnec': {
        const b = near(bs.filter((q) => q.def.kind === 'prod' || q.def.kind === 'pit' || q.def.kind === 'aura'));
        if (b) return { k: 'b', o: b };
        const o = near(nonWall);
        if (o) return { k: 'b', o };
        break;
      }
      default: break;
    }
    const b = near(bs);
    return b ? { k: 'b', o: b } : null;
  }

  private enemyAttack(e: Enemy, dmgMul: number) {
    const d = e.def;
    const dmg = d.dmg * dmgMul;
    const t = e.tgt;
    if (!t) return;
    if (e.tk === 's') return;
    if (d.range > 40) {
      const kind = d.team === 'zealot' ? 'bolt' : 'wisp';
      this.fireProj(e.x, e.y, t as Worker, dmg, true, false, kind, d.color, d.id === 'archlich' ? 260 : 300, e.tk);
      audio.sfx('bolt');
      return;
    }
    if (e.tk === 'w') this.damageWorker(t as Worker, dmg);
    else if (e.tk === 'm') this.damageMilitia(t as Militia, dmg);
    else if (e.tk === 'b') this.meleeBuilding(e, t as Building, dmgMul);
    this.burst(e.x + e.face * 8, e.y, 2, '#fff', 60, 'spark', 2, 0.25);
  }
  private meleeBuilding(e: Enemy, b: Building, dmgMul: number) {
    const dm = e.def.id === 'torch' ? e.def.dmg : e.def.dmg * dmgMul;
    this.damageBuilding(b, dm * (b.def.kind === 'wall' ? 1 : 1));
    if (e.def.id === 'torch' && this.buildings.includes(b) && b.def.kind !== 'wall') {
      const warded = this.buildings.some((o) => o.def.kind === 'ward' && o.active && Math.hypot(o.x - b.x, o.y - b.y) < o.radius);
      if (!warded && b.fire <= 0) { b.fire = 7; this.text(b.x, b.y - 24, '🔥 Burning!', '#ff9a3c', 13); }
    }
  }
  private separateEnemies() {
    const es = this.enemies;
    if (es.length > 90) return;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.dead) continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = (a.def.r + b.def.r) * 0.8;
        const d2 = dx * dx + dy * dy;
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (min - d) * 0.15;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  private updateMilitia(m: Militia, dt: number) {
    m.life -= dt;
    m.flash = Math.max(0, m.flash - dt * 4);
    m.atkT -= dt;
    if (m.life <= 0) { m.dead = true; this.burst(m.x, m.y, 8, '#e8e2cf', 60, 'bone', 3, 0.6, 100); return; }
    const foe = this.nearestEnemy(m.x, m.y, 240);
    if (foe) {
      const d = Math.hypot(foe.x - m.x, foe.y - m.y) - foe.def.r;
      if (d > 20) { this.moveTo(m, foe.x, foe.y, 80, dt); m.face = foe.x > m.x ? 1 : -1; }
      else if (m.atkT <= 0) { m.atkT = 0.8; this.damageEnemy(foe, 9 * (1 + 0.12 * this.lv('ballistics'))); }
    }
  }

  private updateZones(dt: number) {
    for (const z of this.zones) {
      z.t += dt;
      z.tick -= dt;
      if (Math.random() < dt * 40) {
        const a = Math.random() * 6.28, r = Math.random() * z.r;
        this.parts.length < MAX_PARTICLES && this.parts.push({ x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r, vx: -Math.sin(a) * 160, vy: Math.cos(a) * 160, life: 0.6, max: 0.6, size: 4, color: '#e8e2cf', kind: 'bone', rot: 0, vr: 14, g: 0 });
      }
      if (z.tick <= 0) {
        z.tick = 0.25;
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.def.r) this.damageEnemy(e, 14, true);
        this.addShake(0.8);
      }
    }
    this.zones = this.zones.filter((z) => z.t < z.max);
  }

  private updateHazards(dt: number) {
    for (const h of this.hazards) {
      h.t += dt;
      if (h.t >= h.max) {
        this.burst(h.x, h.y, 30, h.kind === 'smite' ? '#ffe08a' : '#b36bff', 200, 'spark', 4, 0.8);
        this.addShake(7);
        audio.sfx('boom');
        for (const b of [...this.buildings]) if (Math.hypot(b.x - h.x, b.y - h.y) < h.r + b.w / 2) this.damageBuilding(b, h.dmg);
        for (const w of this.workers) if (!w.dead && w.inside === null && Math.hypot(w.x - h.x, w.y - h.y) < h.r) this.damageWorker(w, h.dmg * 0.6);
        for (const m of this.militia) if (!m.dead && Math.hypot(m.x - h.x, m.y - h.y) < h.r) this.damageMilitia(m, h.dmg);
      }
    }
    this.hazards = this.hazards.filter((h) => h.t < h.max);
  }

  private updateProjs(dt: number) {
    for (const p of this.projs) {
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      if (p.kind === 'nova') {
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.x < -40 || p.y < -40 || p.x > WW + 40 || p.y > WH + 40) p.dead = true;
        for (const w of this.workers) if (!w.dead && w.inside === null && Math.hypot(w.x - p.x, w.y - p.y) < 12) { this.damageWorker(w, p.dmg); p.dead = true; break; }
        if (!p.dead) { const b = this.buildingAt(p.x, p.y); if (b) { this.damageBuilding(b, p.dmg); p.dead = true; } }
        continue;
      }
      const t = p.tgt as { x: number; y: number; dead?: boolean } | null;
      let alive = false;
      if (t) alive = p.foe && p.tk === 'b' ? this.buildings.includes(t as Building) : !t.dead;
      if (!t || !alive) { p.dead = true; continue; }
      const dx = t.x - p.x, dy = t.y - p.y;
      const d = Math.hypot(dx, dy);
      const s = p.speed * dt;
      if (d <= s + 8) {
        p.dead = true;
        const tt = p.tgt;
        if (!p.foe) this.damageEnemy(tt as Enemy, p.dmg, p.pierce);
        else if (p.tk === 'w') this.damageWorker(tt as Worker, p.dmg);
        else if (p.tk === 'm') this.damageMilitia(tt as Militia, p.dmg);
        else if (p.tk === 'b') this.damageBuilding(tt as Building, p.dmg);
        this.burst(t.x, t.y, 3, p.color, 60, 'spark', 2.5, 0.3);
      } else {
        p.vx = (dx / d) * p.speed; p.vy = (dy / d) * p.speed;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      if (this.parts.length < MAX_PARTICLES && Math.random() < 0.6) this.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 2.5, color: p.color, kind: 'spark', rot: 0, vr: 0, g: 0 });
    }
    if (this.projs.some((p) => p.dead)) this.projs = this.projs.filter((p) => !p.dead);
  }

  // visual-only update (runs at real-time rate)
  private updateVisual(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 22);
    this.screenFlash = Math.max(0, this.screenFlash - dt * 1.8);
    const sd = Math.min(dt, 0.05) * Math.max(1, this.speed * 0.7);
    for (const p of this.parts) {
      p.life -= sd;
      if (p.kind === 'wisp' && p.ref) {
        const r = p.ref;
        const dx = r.x - p.x, dy = r.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.x += (dx / d) * 220 * sd; p.y += (dy / d) * 220 * sd;
        if (d < 12 || r.dead) p.life = 0;
        continue;
      }
      p.vy += p.g * sd;
      p.x += p.vx * sd; p.y += p.vy * sd;
      p.vx *= 1 - Math.min(1, 1.5 * sd);
      p.rot += p.vr * sd;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= sd; t.y -= 26 * sd; }
    this.texts = this.texts.filter((t) => t.life > 0);
    // music mood
    const foes = this.enemies.filter((e) => !e.dead).length;
    const target = Math.min(1, foes / 14);
    this.intensity += (target - this.intensity) * Math.min(1, dt * 0.8);
    audio.setMood(this.effSun, this.intensity, !!this.bossRef);
  }

  // convenience for UI
  get bossAlive() { return this.bossRef && !this.bossRef.dead ? this.bossRef : null; }
}
