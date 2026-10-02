import {
  CELL, MW, MH, CASTES, CASTE_INFO, CHAMBER_INFO, CHAMBER_TYPES, WEATHER_INFO, DIFFS,
  getSave, techLevel,
} from './data';
import type {
  CasteId, ChamberType, WeatherId, LevelDef, DifficultyDef, RivalDef, WildKind,
} from './data';
import {
  T_SOIL, T_TUNNEL, T_ROCK, T_MEADOW, INF, DX, DY, RNG, generateWorld, isPass, bfs, descend, localStep,
} from './world';
import type { Food } from './world';
import { audio } from './audio';
import { renderGame, renderMinimap, paintCell, buildTerrain } from './render';

export type EntType = 'queen' | CasteId | WildKind;
export type Tool = 'forage' | 'war' | 'dig' | 'erase' | 'build' | 'pan';

export interface Ent {
  id: number; team: number; type: EntType;
  x: number; y: number; a: number;
  hp: number; maxHp: number; spd: number; atk: number; range: number; cd: number; cdT: number; armor: number; r: number;
  carry: number; role: number; tgt: Ent | null; tTimer: number; tfood: Food | null;
  wander: number; idle: number; flying: boolean; digger: boolean; poison: number; flash: number; anim: number; dead: boolean;
  cell: number; prev1: number; prev2: number; pathT: number; pdx: number; pdy: number; pvalid: boolean;
  task: number; timer: number; timer2: number; side: number; scale: number; life: number; digging: number; raid: number; boss: boolean;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; kind: 0 | 1 | 2; }
export interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number; }
export interface Proj { x: number; y: number; vx: number; vy: number; life: number; dmg: number; team: number; color: string; }
export interface Telegraph { x: number; y: number; r: number; t: number; max: number; dmg: number; team: number; }
export interface Chamber { id: number; type: ChamberType; cx: number; cy: number; active: boolean; built: boolean; prog: number; cd: number; }
export interface Brood { caste: CasteId; t: number; need: number; }
export interface Rival {
  def: RivalDef; team: number; queen: Ent | null; food: number; alive: boolean; spawnT: number; raidT: number;
  homeF: Int16Array; alert: number; announced: boolean;
}
export interface Stats {
  born: number; lost: number; kills: number; gathered: number; dug: number; peakPop: number; chambers: number;
  rivalsKilled: number; spent: number; lightning: number; raidsRepelled: number;
}
export interface LogMsg { id: number; text: string; kind: 'info' | 'bad' | 'good' | 'warn'; t: number; }

export interface GameResult {
  won: boolean; reason: string; stars: number; jelly: number; time: number; levelId: number; diffId: string;
  stats: Stats; endless: boolean; mods: string[];
}

export interface HudSnap {
  food: number; foodCap: number; foodRate: number; pop: number; popCap: number; brood: number; broodCap: number;
  counts: Record<CasteId, number>; queenHp: number; queenMax: number; energy: number; energyMax: number;
  weather: WeatherId; nextWeather: WeatherId; weatherT: number; time: number; speed: number; paused: boolean;
  tool: Tool; brush: number; chamberSel: ChamberType; mix: Record<CasteId, number>; objective: string; objProgress: number;
  log: LogMsg[]; boss: { hp: number; max: number; name: string } | null;
  tutorial: { step: number; total: number; text: string; last: boolean } | null;
  rivals: { name: string; color: string; alive: boolean; hp: number; max: number }[];
  chamberCount: Record<ChamberType, number>; chamberCost: Record<ChamberType, number>;
  ended: boolean; threat: number; levelName: string; unlockedCastes: CasteId[]; zoom: number;
}

interface BaseStat { hp: number; spd: number; atk: number; range: number; cd: number; armor: number; r: number; }
const BASE: Record<EntType, BaseStat> = {
  queen: { hp: 300, spd: 0, atk: 8, range: 24, cd: 0.9, armor: 1, r: 12 },
  worker: { hp: 14, spd: 52, atk: 2, range: 11, cd: 0.9, armor: 0, r: 5 },
  soldier: { hp: 38, spd: 56, atk: 7, range: 13, cd: 0.7, armor: 1, r: 6 },
  nurse: { hp: 16, spd: 38, atk: 1, range: 10, cd: 1, armor: 0, r: 5 },
  scout: { hp: 10, spd: 95, atk: 1, range: 10, cd: 1, armor: 0, r: 4 },
  spitter: { hp: 16, spd: 48, atk: 6, range: 115, cd: 1.2, armor: 0, r: 5 },
  beetle: { hp: 90, spd: 30, atk: 8, range: 17, cd: 1.1, armor: 3, r: 11 },
  spider: { hp: 70, spd: 72, atk: 9, range: 15, cd: 0.8, armor: 0, r: 9 },
  wasp: { hp: 30, spd: 115, atk: 10, range: 13, cd: 1, armor: 0, r: 7 },
  centipede: { hp: 220, spd: 46, atk: 12, range: 20, cd: 0.9, armor: 2, r: 10 },
  antlion: { hp: 80, spd: 0, atk: 14, range: 18, cd: 1, armor: 1, r: 12 },
  anteater: { hp: 1100, spd: 26, atk: 24, range: 46, cd: 1.6, armor: 3, r: 34 },
};

const BROOD_TIME: Record<CasteId, number> = { worker: 12, soldier: 17, nurse: 13, scout: 11, spitter: 19 };
const CARCASS_DROP: Partial<Record<EntType, number>> = { beetle: 30, spider: 20, wasp: 10, centipede: 55, anteater: 160 };
const DIG_TIME = 2.4;

const TUT: { text: string; check: (g: Game) => boolean }[] = [
  { text: 'Welcome, Regent! Look around: WASD / arrow keys, or drag with the right mouse button. Press H to centre on your Queen.', check: (g) => g.flags.moved > 260 },
  { text: 'Select the 🟢 Forage trail (key 1) and paint a line from your tunnel exit to the sparkling crumbs. Workers follow trails OUTWARD from the nest.', check: (g) => g.flags.paintForage >= 25 },
  { text: 'Watch the workers march out and haul food home. Deliver 6 food to your Queen. Returning workers reinforce busy trails automatically.', check: (g) => g.stats.gathered >= 6 },
  { text: 'Select ⛏ Dig (key 3) and drag over brown soil to mark new tunnels. Workers will excavate them. Dig 8 cells.', check: (g) => g.stats.dug >= 8 },
  { text: 'Select 🏗 Build (key 5), pick a Nursery and click soil near your Queen. Chambers cost food and are dug out by workers.', check: (g) => g.flags.built >= 1 },
  { text: 'Use the Caste Mix sliders (right panel) to ask the Queen for more Soldiers. Try the War preset!', check: (g) => g.flags.mix },
  { text: 'Soldiers answer 🔴 War trails (key 2). Paint one outward toward a threat or enemy nest — soldiers also rush to any ant under attack.', check: (g) => g.flags.paintWar >= 15 },
  { text: 'Mind the weather forecast: rain washes trails, heat dehydrates, storms strike. Reach 30 ants and 200 food to win. Good luck!', check: (g) => g.tutTime > 12 },
];

function lerpAngle(a: number, b: number, t: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export interface GameOptions {
  level: LevelDef;
  diff: DifficultyDef;
  mods: string[];
  tutorial: boolean;
}

export class Game {
  canvas: HTMLCanvasElement;
  mini: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D;
  W = 800; H = 600; dpr = 1;
  level: LevelDef; diff: DifficultyDef; mods: Set<string>;
  rng = new RNG((Date.now() ^ 0x5bd1e995) >>> 0);
  save = getSave();

  cells: Uint8Array;
  dig = new Uint8Array(MW * MH);
  digProg = new Float32Array(MW * MH);
  food: Food[] = [];
  phF = new Float32Array(MW * MH);
  phW = new Float32Array(MW * MH);
  explored = new Uint8Array(MW * MH);
  visible = new Uint8Array(MW * MH);
  homeP = new Int16Array(MW * MH).fill(INF);
  reachP = new Int16Array(MW * MH).fill(INF);
  forF = new Int16Array(MW * MH).fill(INF);
  warF = new Int16Array(MW * MH).fill(INF);
  digF = new Int16Array(MW * MH).fill(INF);
  foodF = new Int16Array(MW * MH).fill(INF);
  frontF = new Int16Array(MW * MH).fill(INF);
  queue = new Int32Array(MW * MH);
  digCount = 0;
  terrain: HTMLCanvasElement;
  fogCanvas: HTMLCanvasElement;
  phCanvas: HTMLCanvasElement;
  fogDirty = true;
  phDirty = true;

  ents: Ent[] = [];
  head = new Int32Array(MW * MH).fill(-1);
  nxt = new Int32Array(1024);
  particles: Particle[] = [];
  floaters: Floater[] = [];
  projs: Proj[] = [];
  telegraphs: Telegraph[] = [];
  chambers: Chamber[] = [];
  brood: Brood[] = [];
  rivals: Rival[] = [];
  antlionPos: { x: number; y: number }[] = [];
  queen!: Ent;
  boss: Ent | null = null;
  bossSpawned = false;
  bossWarned = false;
  nextId = 1;
  nextChamber = 1;

  foodStock = 0; foodCap = 200; popCap = 30; foodRate = 0; foodAcc = 0; foodAccT = 0;
  energy = 100;
  layT = 2; freeT = 20;
  counts: Record<string, number> = {};
  mix: Record<CasteId, number> = { worker: 5, soldier: 2, nurse: 2, scout: 1, spitter: 0 };
  weather: WeatherId = 'clear'; nextWeather: WeatherId = 'clear'; wTimer = 40; ltT = 6; windA = 0;
  evT = 60; threat = 0; threatT = 0;
  time = 0;
  stats: Stats = { born: 0, lost: 0, kills: 0, gathered: 0, dug: 0, peakPop: 0, chambers: 0, rivalsKilled: 0, spent: 0, lightning: 0, raidsRepelled: 0 };
  log: LogMsg[] = [];
  logId = 0;

  cam = { x: 0, y: 0, z: 1 };
  shake = 0; flash = 0;
  keys = new Set<string>();
  mouse = { x: -1, y: -1, in: false };
  tool: Tool = 'forage';
  prevTool: Tool = 'forage';
  brush = 2;
  chamberSel: ChamberType = 'nursery';
  paused = false; speed = 1; timeScale = 1;
  ended: GameResult | null = null;
  endDelay = 0; endNotified = false;
  mouseDown = false; panning = false; strokeLast: { x: number; y: number } | null = null; strokeSound = 0;
  pointers = new Map<number, { x: number; y: number }>();
  pinch = 0;
  flags = { moved: 0, paintForage: 0, paintWar: 0, mix: false, built: 0 };
  tut: { step: number } | null = null;
  tutTime = 0;

  onHud: ((s: HudSnap) => void) | null = null;
  onEnd: ((r: GameResult) => void) | null = null;

  raf = 0; lastT = 0; hudT = 0; miniT = 0; fieldT = 0; field2T = 0; fogT = 0; decayT = 0; phFrame = 0; fps = 60; fpsAcc = 0; fpsN = 0;
  unbinders: (() => void)[] = [];
  destroyed = false;
  tutorialOn: boolean;

  constructor(canvas: HTMLCanvasElement, mini: HTMLCanvasElement | null, opts: GameOptions) {
    this.canvas = canvas;
    this.mini = mini;
    const c = canvas.getContext('2d');
    if (!c) throw new Error('Canvas 2D unavailable');
    this.ctx = c;
    this.level = opts.level;
    this.diff = opts.diff;
    this.minJelly = opts.diff.jelly;
    this.mods = new Set(opts.mods);
    this.tutorialOn = opts.tutorial && opts.level.id === 1;
    const gen = generateWorld(this.level, this.mods.has('famine'));
    this.cells = gen.cells;
    this.food = gen.food;
    this.antlionPos = gen.antlions;
    this.terrain = document.createElement('canvas');
    this.terrain.width = MW * CELL;
    this.terrain.height = MH * CELL;
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = MW;
    this.fogCanvas.height = MH;
    this.phCanvas = document.createElement('canvas');
    this.phCanvas.width = MW;
    this.phCanvas.height = MH;
    buildTerrain(this);

    for (const k of CASTES) this.counts[k] = 0;
    // queen
    const nx = (this.level.nest.x + 0.5) * CELL;
    const ny = (this.level.nest.y + 0.5) * CELL;
    this.queen = this.spawnQueen(0, nx, ny);
    this.cam.x = nx;
    this.cam.y = ny;
    this.cam.z = 1;
    // rivals
    this.level.rivals.forEach((def, i) => {
      const q = this.spawnQueen(i + 1, (gen.rivalNests[i].x + 0.5) * CELL, (gen.rivalNests[i].y + 0.5) * CELL);
      this.rivals.push({
        def, team: i + 1, queen: q, food: 70, alive: true, spawnT: 3 + i, raidT: def.raidEvery * (0.9 + this.rng.next() * 0.3) / this.diff.rivalRate,
        homeF: new Int16Array(MW * MH).fill(INF), alert: 0, announced: false,
      });
    });
    // antlions
    for (const p of this.antlionPos) this.spawnWild('antlion', p.x, p.y, 0);
    // start food
    this.foodStock = Math.max(40, this.level.startFood + this.diff.foodBonus + 40 * techLevel('reserves'));
    this.foodCap = 200;
    this.energy = this.energyMax();
    // starting ants
    const n = this.level.startAnts;
    const comp: CasteId[] = [];
    for (let i = 0; i < n; i++) comp.push(i < Math.ceil(n * 0.55) ? 'worker' : i < Math.ceil(n * 0.75) ? 'soldier' : i < Math.ceil(n * 0.9) ? 'nurse' : 'scout');
    comp.forEach((cst) => {
      const a = this.rng.next() * Math.PI * 2;
      const r = 10 + this.rng.next() * 40;
      const e = this.spawnAnt(cst, nx + Math.cos(a) * r, ny + Math.sin(a) * r);
      if (!isPass(this.cells[this.cellOf(e.x, e.y)])) { e.x = nx; e.y = ny; }
    });
    this.stats.born = 0;
    this.evT = this.level.firstThreat;
    this.wTimer = 45;
    this.nextWeather = this.rollWeather('clear');
    this.windA = this.rng.next() * 6.28;
    if (this.food.length) {
      const f = this.food[0];
      this.revealCircle(f.x, f.y, 8 * CELL);
      // the Queen remembers the way to the nearest meadow
      const dxm = f.x - nx;
      const dym = f.y - ny;
      const steps = Math.max(1, Math.ceil(Math.hypot(dxm, dym) / (2.5 * CELL)));
      for (let k = 0; k <= steps; k++) this.revealCircle(nx + (dxm * k) / steps, ny + (dym * k) / steps, 5 * CELL);
    }
    this.recomputeFields(true);
    this.updateFog();
    if (this.tutorialOn) this.tut = { step: 0 };
    this.say(this.tutorialOn ? 'Tutorial active — follow the prompts at the top.' : `Welcome to ${this.level.name}.`, 'info');
    this.bind();
    this.resize();
  }

  /* ------------------------------------------------------------ helpers */
  tech(id: string): number { return techLevel(id); }
  energyMax(): number { return 100 + 25 * this.tech('mastery'); }
  cellOf(x: number, y: number): number {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return 0;
    return cy * MW + cx;
  }
  pass(x: number, y: number): boolean {
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= MW || cy >= MH) return false;
    return isPass(this.cells[cy * MW + cx]);
  }
  say(text: string, kind: LogMsg['kind'] = 'info') {
    this.log.push({ id: ++this.logId, text, kind, t: this.time });
    if (this.log.length > 7) this.log.shift();
  }
  float(x: number, y: number, text: string, color = '#fff', size = 11) {
    if (this.floaters.length > 90) this.floaters.shift();
    this.floaters.push({ x, y, text, color, life: 1.1, max: 1.1, size });
  }
  burst(x: number, y: number, n: number, color: string, speed = 60, life = 0.5, size = 2, grav = 0) {
    const mult = this.save.settings.particles;
    const cnt = Math.round(n * mult);
    for (let i = 0; i < cnt; i++) {
      if (this.particles.length > 700) break;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, grav, kind: 0 });
    }
  }
  ring(x: number, y: number, r: number, color: string, life = 0.5) {
    if (this.particles.length > 700) return;
    this.particles.push({ x, y, vx: 0, vy: 0, life, max: life, size: r, color, grav: 0, kind: 1 });
  }
  addShake(v: number) { this.shake = Math.min(16, this.shake + v * this.save.settings.shake); }

  /* ------------------------------------------------------------ spawning */
  mkEnt(type: EntType, team: number, x: number, y: number): Ent {
    const b = BASE[type];
    return {
      id: this.nextId++, team, type, x, y, a: Math.random() * 6.28,
      hp: b.hp, maxHp: b.hp, spd: b.spd, atk: b.atk, range: b.range, cd: b.cd, cdT: Math.random() * b.cd, armor: b.armor, r: b.r,
      carry: 0, role: 0, tgt: null, tTimer: Math.random() * 0.3, tfood: null,
      wander: 0, idle: 0, flying: false, digger: false, poison: 0, flash: 0, anim: Math.random() * 10, dead: false,
      cell: -1, prev1: -1, prev2: -1, pathT: 0, pdx: 0, pdy: 0, pvalid: false,
      task: 0, timer: Math.random() * 3, timer2: 0, side: 1, scale: 1, life: 0, digging: 0, raid: 0, boss: false,
    };
  }
  spawnQueen(team: number, x: number, y: number): Ent {
    const e = this.mkEnt('queen', team, x, y);
    if (team === 0) {
      e.maxHp = e.hp = Math.round(BASE.queen.hp * (1 + 0.15 * this.tech('fertile')));
    } else {
      const R = this.level.rivals[team - 1];
      e.maxHp = e.hp = Math.round(230 * R.power * this.diff.enemyHp);
    }
    this.ents.push(e);
    return e;
  }
  spawnAnt(caste: CasteId, x: number, y: number): Ent {
    const e = this.mkEnt(caste, 0, x, y);
    const hpMul = (1 + 0.12 * this.tech('chitin')) * (this.mods.has('fragile') ? 0.75 : 1);
    e.maxHp = e.hp = Math.round(e.hp * hpMul);
    e.role = (e.id * 0.618) % 1 < 0.34 ? 1 : 0;
    this.ents.push(e);
    this.stats.born++;
    return e;
  }
  spawnRivalAnt(R: Rival, type: 'worker' | 'soldier'): Ent {
    const q = R.queen!;
    const e = this.mkEnt(type, R.team, q.x + (Math.random() - 0.5) * 30, q.y + (Math.random() - 0.5) * 30);
    const m = R.def.power * this.diff.enemyHp;
    e.maxHp = e.hp = Math.round(e.hp * m);
    if (!isPass(this.cells[this.cellOf(e.x, e.y)])) { e.x = q.x; e.y = q.y; }
    this.ents.push(e);
    return e;
  }
  spawnWild(kind: WildKind, x: number, y: number, mode: number): Ent {
    const e = this.mkEnt(kind, 9, x, y);
    const wave = Math.floor(this.time / 70);
    const m = this.diff.enemyHp * (1 + 0.05 * wave);
    e.maxHp = e.hp = Math.round(e.hp * m);
    e.task = mode;
    e.flying = kind === 'wasp';
    e.digger = kind === 'centipede' || kind === 'anteater';
    if (kind === 'antlion') { e.a = 0; }
    if (kind === 'anteater') { e.boss = true; e.scale = 2.2; }
    if (kind === 'wasp') e.life = 45;
    this.ents.push(e);
    return e;
  }

  /* ------------------------------------------------------------ queries */
  rebuildGrid() {
    this.head.fill(-1);
    if (this.nxt.length < this.ents.length) this.nxt = new Int32Array(this.ents.length * 2);
    for (let i = 0; i < this.ents.length; i++) {
      const e = this.ents[i];
      if (e.dead) continue;
      const c = this.cellOf(e.x, e.y);
      this.nxt[i] = this.head[c];
      this.head[c] = i;
    }
  }
  forEachNear(x: number, y: number, rad: number, fn: (o: Ent) => void) {
    const rc = Math.ceil(rad / CELL);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const r2 = rad * rad;
    for (let yy = Math.max(0, cy - rc); yy <= Math.min(MH - 1, cy + rc); yy++) {
      for (let xx = Math.max(0, cx - rc); xx <= Math.min(MW - 1, cx + rc); xx++) {
        for (let k = this.head[yy * MW + xx]; k !== -1; k = this.nxt[k]) {
          const o = this.ents[k];
          if (!o || o.dead) continue;
          const dx = o.x - x;
          const dy = o.y - y;
          if (dx * dx + dy * dy <= r2) fn(o);
        }
      }
    }
  }
  nearestHostile(e: Ent, rad: number, filter?: (o: Ent) => boolean): Ent | null {
    let best: Ent | null = null;
    let bd = rad * rad;
    this.forEachNear(e.x, e.y, rad, (o) => {
      if (o.team === e.team) return;
      if (e.team === 9 && o.team === 9) return;
      if (filter && !filter(o)) return;
      const dx = o.x - e.x;
      const dy = o.y - e.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }
  lineClear(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.min(40, Math.ceil(d / 9));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (!this.pass(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ movement */
  step(e: Ent, dx: number, dy: number): boolean {
    if (e.flying) {
      e.x = Math.max(4, Math.min(MW * CELL - 4, e.x + dx));
      e.y = Math.max(4, Math.min(MH * CELL - 4, e.y + dy));
      return true;
    }
    const nx = e.x + dx;
    const ny = e.y + dy;
    if (this.pass(nx, ny)) { e.x = nx; e.y = ny; return true; }
    if (this.pass(nx, e.y)) { e.x = nx; return true; }
    if (this.pass(e.x, ny)) { e.y = ny; return true; }
    return false;
  }
  moveDir(e: Ent, ang: number, spd: number, dt: number) {
    e.a = lerpAngle(e.a, ang, Math.min(1, dt * 9));
    const moved = this.step(e, Math.cos(e.a) * spd * dt, Math.sin(e.a) * spd * dt);
    e.anim += spd * dt;
    if (!moved) e.a += (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random());
  }
  aimXY(e: Ent, tx: number, ty: number, spd: number, dt: number) {
    this.moveDir(e, Math.atan2(ty - e.y, tx - e.x), spd, dt);
  }
  aimCell(e: Ent, idx: number, spd: number, dt: number) {
    const tx = ((idx % MW) + 0.5) * CELL;
    const ty = (Math.floor(idx / MW) + 0.5) * CELL;
    this.aimXY(e, tx, ty, spd, dt);
  }
  wanderMove(e: Ent, spd: number, dt: number) {
    e.a += (Math.random() - 0.5) * 5 * dt;
    const lx = e.x + Math.cos(e.a) * 12;
    const ly = e.y + Math.sin(e.a) * 12;
    if (!e.flying && !this.pass(lx, ly)) e.a += (Math.random() < 0.5 ? 1 : -1) * (1.2 + Math.random());
    this.step(e, Math.cos(e.a) * spd * dt, Math.sin(e.a) * spd * dt);
    e.anim += spd * dt;
  }
  navTo(e: Ent, tx: number, ty: number, spd: number, dt: number) {
    if (e.flying || this.lineClear(e.x, e.y, tx, ty)) { this.aimXY(e, tx, ty, spd, dt); return; }
    e.pathT -= dt;
    if (e.pathT <= 0) {
      e.pathT = 0.3 + Math.random() * 0.2;
      const c = this.cellOf(e.x, e.y);
      const t = this.cellOf(tx, ty);
      const n = localStep(this.cells, c % MW, Math.floor(c / MW), t % MW, Math.floor(t / MW), 45);
      if (n >= 0) { e.pdx = ((n % MW) + 0.5) * CELL; e.pdy = (Math.floor(n / MW) + 0.5) * CELL; e.pvalid = true; } else e.pvalid = false;
    }
    if (e.pvalid) this.aimXY(e, e.pdx, e.pdy, spd, dt);
    else this.wanderMove(e, spd * 0.6, dt);
  }
  diggerMove(e: Ent, tx: number, ty: number, spd: number, dt: number, cr: number) {
    let ang = Math.atan2(ty - e.y, tx - e.x);
    if (e.timer2 > 0) { e.timer2 -= dt; ang += e.side * 1.3; }
    e.a = lerpAngle(e.a, ang, Math.min(1, dt * 5));
    const nx = e.x + Math.cos(e.a) * spd * dt;
    const ny = e.y + Math.sin(e.a) * spd * dt;
    const cx = Math.floor(nx / CELL);
    const cy = Math.floor(ny / CELL);
    if (cx < 1 || cy < 1 || cx >= MW - 1 || cy >= MH - 1 || this.cells[cy * MW + cx] === T_ROCK) {
      e.timer2 = 0.9;
      e.side = Math.random() < 0.5 ? -1 : 1;
      return;
    }
    e.x = nx;
    e.y = ny;
    e.anim += spd * dt;
    this.carve(cx, cy, cr);
  }
  carve(cx: number, cy: number, r: number) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + 0.5) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
        const j = y * MW + x;
        if (this.cells[j] === T_SOIL) this.openCell(j, true);
      }
    }
  }
  openCell(j: number, silent: boolean) {
    this.cells[j] = T_TUNNEL;
    if (this.dig[j]) { this.dig[j] = 0; this.digCount = Math.max(0, this.digCount - 1); }
    this.digProg[j] = 0;
    const x = j % MW;
    const y = Math.floor(j / MW);
    paintCell(this, x, y);
    this.fieldT = 9;
    const px = (x + 0.5) * CELL;
    const py = (y + 0.5) * CELL;
    this.burst(px, py, silent ? 3 : 7, '#8a5e3c', 45, 0.5, 2, 60);
    if (!silent) {
      this.stats.dug++;
      audio.play('dig');
      for (const f of this.food) {
        if (f.kind === 'cache' && f.amt > 0 && this.cellOf(f.x, f.y) === j) {
          this.say('🌰 Workers uncovered a buried seed cache!', 'good');
          this.float(px, py - 10, 'Cache!', '#ffe08a', 14);
          this.ring(px, py, 40, '#ffe08a', 0.7);
        }
      }
    }
  }

  /* ------------------------------------------------------------ pheromone + brush */
  stamp(px: number, py: number) {
    const rad = [0.6, 1.4, 2.4][this.brush - 1] || 1.4;
    const cx = Math.floor(px / CELL);
    const cy = Math.floor(py / CELL);
    const R = Math.ceil(rad);
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dy * dy > rad * rad) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
        const i = y * MW + x;
        if (this.tool === 'forage' || this.tool === 'war') {
          if (!isPass(this.cells[i])) continue;
          const arr = this.tool === 'forage' ? this.phF : this.phW;
          const old = arr[i];
          if (old >= 0.95) continue;
          const nv = Math.min(1, old + 0.55);
          const cost = (nv - old) * 0.6;
          if (this.energy < cost) {
            if (this.strokeSound <= 0) { audio.play('error'); this.strokeSound = 0.4; this.float(px, py - 16, 'Glands exhausted', '#ff9d7a', 12); }
            continue;
          }
          this.energy -= cost;
          arr[i] = nv;
          this.phDirty = true;
          if (this.tool === 'forage') this.flags.paintForage++; else this.flags.paintWar++;
        } else if (this.tool === 'dig') {
          if (this.cells[i] === T_SOIL && !this.dig[i]) { this.dig[i] = 1; this.digCount++; }
        } else if (this.tool === 'erase') {
          if (this.phF[i] > 0 || this.phW[i] > 0) { this.phF[i] = 0; this.phW[i] = 0; this.phDirty = true; }
          if (this.dig[i]) { this.dig[i] = 0; this.digProg[i] = 0; this.digCount = Math.max(0, this.digCount - 1); }
        }
      }
    }
  }
  strokeTo(wx: number, wy: number) {
    if (!this.strokeLast) { this.stamp(wx, wy); this.strokeLast = { x: wx, y: wy }; return; }
    const dx = wx - this.strokeLast.x;
    const dy = wy - this.strokeLast.y;
    const d = Math.hypot(dx, dy);
    const n = Math.max(1, Math.ceil(d / 8));
    for (let i = 1; i <= n; i++) this.stamp(this.strokeLast.x + (dx * i) / n, this.strokeLast.y + (dy * i) / n);
    this.strokeLast = { x: wx, y: wy };
    if (this.strokeSound <= 0 && d > 3) { audio.play('paint'); this.strokeSound = 0.07; }
  }
  depositWar(x: number, y: number, v: number) {
    const i = this.cellOf(x, y);
    if (isPass(this.cells[i])) { this.phW[i] = Math.min(1, Math.max(this.phW[i], v)); this.phDirty = true; }
  }

  /* ------------------------------------------------------------ chambers */
  chamberCost(t: ChamberType): number {
    const n = this.chambers.filter((c) => c.type === t).length;
    return Math.round(CHAMBER_INFO[t].cost * (1 + 0.25 * n));
  }
  tryBuild(wx: number, wy: number) {
    const cx = Math.floor(wx / CELL);
    const cy = Math.floor(wy / CELL);
    const type = this.chamberSel;
    const info = CHAMBER_INFO[type];
    const fail = (msg: string) => { audio.play('error'); this.float(wx, wy - 14, msg, '#ff9d7a', 12); };
    if (info.tech && this.tech(info.tech) < 1) return fail('Locked — evolve it first');
    if (cx < 4 || cy < 4 || cx > MW - 5 || cy > MH - 5) return fail('Out of bounds');
    const i = cy * MW + cx;
    if (this.cells[i] === T_ROCK || this.cells[i] === T_MEADOW) return fail('Build in soil or tunnels');
    if (!this.explored[i]) return fail('Explore this area first');
    const q = this.queen;
    if (Math.hypot(wx - q.x, wy - q.y) > 28 * CELL) return fail('Too far from the Queen');
    if (this.chambers.some((c) => Math.hypot(c.cx - cx, c.cy - cy) < 5)) return fail('Too close to another chamber');
    let total = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 5) continue;
      if (this.cells[(cy + dy) * MW + cx + dx] !== T_ROCK) total++;
    }
    if (total < 14) return fail('Too much rock here');
    const cost = this.chamberCost(type);
    if (this.foodStock < cost) return fail(`Need ${cost} food`);
    this.foodStock -= cost;
    this.stats.spent += cost;
    this.chambers.push({ id: this.nextChamber++, type, cx, cy, active: false, built: false, prog: 0, cd: 0 });
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 5) continue;
      const j = (cy + dy) * MW + cx + dx;
      if (this.cells[j] === T_SOIL && !this.dig[j]) { this.dig[j] = 1; this.digCount++; }
    }
    this.autoTunnel(cx, cy);
    this.flags.built++;
    audio.play('build');
    this.float(wx, wy - 14, `${info.icon} ${info.name} queued`, '#ffe9a8', 13);
    this.ring((cx + 0.5) * CELL, (cy + 0.5) * CELL, 50, info.color, 0.6);
  }
  /** Marks a straight corridor from the nearest reachable open cell to a new chamber so workers can reach it. */
  autoTunnel(cx: number, cy: number) {
    let best = -1;
    let bd = 1e9;
    for (let dy = -16; dy <= 16; dy++) {
      for (let dx = -16; dx <= 16; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 1 || y < 1 || x >= MW - 1 || y >= MH - 1) continue;
        const j = y * MW + x;
        if (!isPass(this.cells[j]) || this.reachP[j] >= INF) continue;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = j; }
      }
    }
    if (best < 0 || bd <= 5) return;
    const bx = best % MW;
    const by = Math.floor(best / MW);
    const n = Math.max(Math.abs(bx - cx), Math.abs(by - cy)) * 2;
    const mark = (x: number, y: number) => {
      const j = y * MW + x;
      if (this.cells[j] === T_SOIL && !this.dig[j]) { this.dig[j] = 1; this.digCount++; }
    };
    let px = cx;
    let py = cy;
    for (let i = 0; i <= n; i++) {
      const x = Math.round(cx + ((bx - cx) * i) / n);
      const y = Math.round(cy + ((by - cy) * i) / n);
      if (x !== px && y !== py) mark(x, py);
      mark(x, y);
      px = x;
      py = y;
    }
  }
  chamberCells(c: Chamber, fn: (j: number) => void) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dy * dy > 5) continue;
      const j = (c.cy + dy) * MW + c.cx + dx;
      if (this.cells[j] !== T_ROCK) fn(j);
    }
  }

  /* ------------------------------------------------------------ weather & events */
  rollWeather(prev: WeatherId): WeatherId {
    const w = { ...this.level.weather } as Record<string, number>;
    if (this.mods.has('gale')) {
      w.storm = (w.storm || 1) * 4;
      w.rain = (w.rain || 1) * 2.5;
      w.clear = (w.clear || 1) * 0.25;
    }
    if (w[prev]) w[prev] *= 0.3;
    const keys = Object.keys(w);
    let sum = 0;
    for (const k of keys) sum += w[k];
    let r = this.rng.next() * sum;
    for (const k of keys) {
      r -= w[k];
      if (r <= 0) return k as WeatherId;
    }
    return 'clear';
  }
  wp(): number { return Math.max(0, 1 - 0.35 * this.tech('weather')); }
  weatherTick(dt: number) {
    this.wTimer -= dt;
    if (this.wTimer <= 0) {
      this.weather = this.nextWeather;
      this.nextWeather = this.rollWeather(this.weather);
      this.wTimer = 38 + this.rng.next() * 30;
      const wi = WEATHER_INFO[this.weather];
      this.say(`${wi.icon} ${wi.name}: ${wi.desc}`, this.weather === 'clear' ? 'info' : 'warn');
      audio.setWeather(this.weather);
      audio.play('warn');
    }
    if (this.weather === 'storm') {
      this.windA += dt * 0.15;
      this.ltT -= dt;
      if (this.ltT <= 0) {
        this.ltT = 4 + this.rng.next() * 5;
        this.lightning();
      }
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.2);
  }
  lightning() {
    // strike a random meadow cell
    let x = 0, y = 0, ok = false;
    for (let t = 0; t < 40 && !ok; t++) {
      const cx = this.rng.int(2, MW - 3);
      const cy = this.rng.int(2, MH - 3);
      if (this.cells[cy * MW + cx] === T_MEADOW) { x = (cx + 0.5) * CELL; y = (cy + 0.5) * CELL; ok = true; }
    }
    if (!ok) return;
    this.flash = 0.9;
    this.stats.lightning++;
    audio.play('lightning');
    this.burst(x, y, 24, '#fff6b0', 150, 0.5, 2.5);
    this.ring(x, y, 60, '#fff6b0', 0.5);
    for (const f of this.food) if (Math.hypot(f.x - x, f.y - y) < 45 && f.amt > 2) f.amt = Math.max(1, Math.floor(f.amt * 0.6));
    const lr = 55;
    this.forEachNear(x, y, lr, (o) => { if (o.type !== 'antlion') this.hurt(o, o.boss ? 40 : 45, null, true); });
    if (this.visible[this.cellOf(x, y)]) this.addShake(5);
  }
  nextEventGap(): number {
    const base = Math.max(16, 40 - this.time / 30);
    const rate = this.diff.spawn * this.level.spawnRate * (this.mods.has('surge') ? 1.5 : 1);
    return (base / rate) * (0.8 + this.rng.next() * 0.4);
  }
  pickSpawn(kind: 'meadow' | 'soil' | 'edge'): { x: number; y: number } {
    const q = this.queen;
    for (let t = 0; t < 60; t++) {
      let cx: number, cy: number;
      if (kind === 'edge') {
        const side = this.rng.int(0, 3);
        cx = side === 0 ? 3 : side === 1 ? MW - 4 : this.rng.int(3, MW - 4);
        cy = side === 2 ? 3 : side === 3 ? MH - 4 : this.rng.int(3, MH - 4);
      } else {
        cx = this.rng.int(3, MW - 4);
        cy = this.rng.int(3, MH - 4);
      }
      const t0 = this.cells[cy * MW + cx];
      if (kind === 'meadow' && t0 !== T_MEADOW) continue;
      if (kind === 'soil' && t0 !== T_SOIL) continue;
      const x = (cx + 0.5) * CELL;
      const y = (cy + 0.5) * CELL;
      if (Math.hypot(x - q.x, y - q.y) < (kind === 'soil' ? 45 : 30) * CELL) continue;
      if (kind === 'meadow' && this.homeP[cy * MW + cx] >= INF) continue;
      return { x, y };
    }
    return { x: (MW - 6) * CELL, y: (MH - 6) * CELL };
  }
  fireEvent() {
    const wave = Math.floor(this.time / 70);
    const L = this.level;
    const pool: string[] = [...L.enemies.filter((k) => k !== 'antlion' && k !== 'anteater')];
    if (this.weather === 'rain' || this.weather === 'storm') {
      const i = pool.indexOf('wasp');
      if (i >= 0) pool.splice(i, 1);
    }
    pool.push('picnic');
    if (this.foodStock < 60) pool.push('picnic');
    const kind = this.rng.pick(pool);
    const hs = Math.max(0, wave);
    if (kind === 'picnic') {
      const p = this.pickSpawn('meadow');
      const n = 6 + this.rng.int(0, 3);
      for (let k = 0; k < n; k++) {
        const x = p.x + (this.rng.next() - 0.5) * 90;
        const y = p.y + (this.rng.next() - 0.5) * 70;
        if (!this.pass(x, y)) continue;
        const big = this.rng.next() < 0.3;
        const amt = Math.round((big ? 36 : 16) * (this.mods.has('famine') ? 0.6 : 1));
        this.food.push({ id: 10000 + this.nextId++, x, y, amt, max: amt, kind: big ? 'carcass' : 'berry', marked: false });
      }
      this.revealCircle(p.x, p.y, 6 * CELL);
      this.say('🧺 A picnic spilled in the meadow — free food! Check the minimap.', 'good');
      audio.play('fanfare');
      this.ring(p.x, p.y, 70, '#ffe08a', 0.9);
      return;
    }
    if (kind === 'beetle') {
      const n = 1 + Math.floor(hs * 0.7) + (this.rng.next() < 0.3 ? 1 : 0);
      const p = this.pickSpawn('meadow');
      for (let k = 0; k < n; k++) this.spawnWild('beetle', p.x + k * 14, p.y + k * 8, 1);
      this.say(`🪲 ${n} armored beetle${n > 1 ? 's' : ''} march on the colony! Use acid or many soldiers.`, 'bad');
    } else if (kind === 'spider') {
      const n = 1 + Math.floor(hs * 0.45);
      const p = this.pickSpawn('meadow');
      for (let k = 0; k < n; k++) this.spawnWild('spider', p.x + k * 12, p.y + k * 8, this.rng.next() < 0.5 ? 1 : 0);
      this.say(`🕷️ ${n > 1 ? n + ' spiders prowl' : 'A spider prowls'} the meadow — protect your foragers.`, 'bad');
    } else if (kind === 'wasp') {
      const n = 2 + Math.floor(hs * 0.8);
      const p = this.pickSpawn('edge');
      for (let k = 0; k < n; k++) this.spawnWild('wasp', p.x + k * 16, p.y + k * 10, 1);
      this.say(`🐝 A swarm of ${n} wasps hunts exposed ants. Retreat underground!`, 'bad');
    } else if (kind === 'centipede') {
      const n = 1 + Math.floor(hs / 3);
      const p = this.pickSpawn('soil');
      for (let k = 0; k < n; k++) this.spawnWild('centipede', p.x + k * 20, p.y, 1);
      this.say(`🐛 ${n > 1 ? 'Centipedes burrow' : 'A centipede burrows'} toward your Queen!`, 'bad');
    }
    audio.play('alarm');
  }

  /* ------------------------------------------------------------ combat */
  atkMul(e: Ent): number {
    if (e.team === 0) {
      let m = 1 + 0.12 * this.tech('mandibles');
      if (e.type === 'soldier') {
        for (const c of this.chambers) {
          if (c.type === 'sentry' && c.active && Math.hypot((c.cx + 0.5) * CELL - e.x, (c.cy + 0.5) * CELL - e.y) < 6 * CELL) { m *= 1.25; break; }
        }
      }
      return m;
    }
    if (e.team >= 1 && e.team <= 3) return this.diff.enemyDmg * this.rivals[e.team - 1].def.power;
    return this.diff.enemyDmg * (1 + 0.03 * Math.floor(this.time / 70));
  }
  hurt(t: Ent, amt: number, src: Ent | null, pierce: boolean, quiet = false) {
    if (t.dead || this.ended) return;
    let d = pierce ? amt : Math.max(1, amt - t.armor);
    if (t.boss) d *= 0.85;
    t.hp -= d;
    if (!quiet) {
      t.flash = 0.12;
      const vis = this.visible[this.cellOf(t.x, t.y)] || t.team === 0;
      if (vis) {
        this.burst(t.x, t.y, 3, t.team === 0 ? '#f0d98a' : t.team === 9 ? '#9ee86a' : '#ff7a6a', 50, 0.3, 1.8);
        if (t.type === 'queen' || t.boss || d >= 9 || Math.random() < 0.18) this.float(t.x, t.y - 8, String(Math.round(d)), t.team === 0 ? '#ff9a8a' : '#ffffff', t.boss || t.type === 'queen' ? 14 : 10);
        audio.play('hit');
      }
      if (t.team === 0) {
        this.depositWar(t.x, t.y, 0.7);
        if (t.type === 'queen') {
          audio.play('queenhit');
          this.addShake(4);
          if (this.time - this.lastQueenWarn > 6) { this.say('👑 The Queen is under attack!', 'bad'); this.lastQueenWarn = this.time; }
        }
      }
      if (t.team >= 1 && t.team <= 3) this.rivals[t.team - 1].alert = 12;
    }
    if (src && src.type === 'spider' && !pierce) t.poison = Math.max(t.poison, 3.5);
    if (t.hp <= 0) this.kill(t, src);
  }
  lastQueenWarn = -99;
  minJelly = 99;
  kill(e: Ent, src: Ent | null) {
    if (e.dead) return;
    e.dead = true;
    const vis = this.visible[this.cellOf(e.x, e.y)] || e.team === 0;
    if (vis) {
      this.burst(e.x, e.y, e.boss ? 60 : e.type === 'queen' ? 40 : 10, e.team === 0 ? '#e8c26a' : e.team === 9 ? '#8fd45a' : '#d06050', e.boss ? 160 : 70, e.boss ? 1.2 : 0.55, e.boss ? 4 : 2.2);
      audio.play('kill');
    }
    if (e.team === 0) {
      if (e.type === 'queen') { this.finish(false, 'The Queen has fallen. The colony scatters.'); return; }
      this.stats.lost++;
    } else {
      this.stats.kills++;
      if (src && src.team === 0) this.float(e.x, e.y - 10, '+kill', '#ffe08a', 10);
      const drop = CARCASS_DROP[e.type];
      if (drop && this.pass(e.x, e.y) && this.food.length < 220) {
        const amt = Math.round(drop);
        this.food.push({ id: 20000 + this.nextId++, x: e.x, y: e.y, amt, max: amt, kind: 'carcass', marked: false });
      }
      if (e.team >= 1 && e.team <= 3 && e.type === 'queen') this.rivalFalls(this.rivals[e.team - 1]);
      if (e.boss) {
        this.addShake(14);
        this.say('🏆 The Anteater is slain!', 'good');
        if (this.level.objective.type === 'boss') this.finish(true, 'The Anteater has fallen. The colony is safe!');
        else { this.boss = null; }
      }
    }
  }
  rivalFalls(R: Rival) {
    R.alive = false;
    this.stats.rivalsKilled++;
    this.say(`👑 The ${R.def.name} queen is dead! Their colony collapses.`, 'good');
    audio.play('fanfare');
    this.addShake(8);
    this.ring(R.queen!.x, R.queen!.y, 120, '#ffe08a', 1);
  }
  tryAttack(e: Ent, t: Ent): boolean {
    if (e.cdT > 0) return false;
    e.cdT = e.cd * (0.9 + Math.random() * 0.2);
    const dmg = e.atk * this.atkMul(e);
    if (e.type === 'spitter') {
      const a = Math.atan2(t.y - e.y, t.x - e.x);
      this.projs.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, life: 0.9, dmg, team: e.team, color: '#a6f04a' });
      audio.play('spit');
      return true;
    }
    e.a = Math.atan2(t.y - e.y, t.x - e.x);
    this.hurt(t, dmg, e, false);
    return true;
  }

  /* ------------------------------------------------------------ fields / fog */
  recomputeFields(all: boolean) {
    const c = this.cells;
    const q = this.cellOf(this.queen.x, this.queen.y);
    // reachability from queen -> chamber activity
    bfs(c, [q], this.reachP, this.queue);
    for (const ch of this.chambers) {
      let tot = 0, open = 0;
      this.chamberCells(ch, (j) => { tot++; if (c[j] !== T_SOIL) open++; });
      ch.prog = tot ? open / tot : 0;
      const wasBuilt = ch.built;
      ch.built = ch.prog >= 0.7;
      ch.active = ch.built && this.reachP[ch.cy * MW + ch.cx] < INF;
      if (ch.built && !wasBuilt) {
        this.stats.chambers++;
        const info = CHAMBER_INFO[ch.type];
        this.say(`${info.icon} ${info.name} complete!`, 'good');
        audio.play('build');
        this.ring((ch.cx + 0.5) * CELL, (ch.cy + 0.5) * CELL, 60, info.color, 0.8);
      }
    }
    const src: number[] = [q];
    for (const ch of this.chambers) if (ch.type === 'granary' && ch.active) src.push(ch.cy * MW + ch.cx);
    bfs(c, src, this.homeP, this.queue);
    // caps
    let g = 0, b = 0;
    for (const ch of this.chambers) if (ch.active) { if (ch.type === 'granary') g++; else if (ch.type === 'barracks') b++; }
    this.foodCap = 200 + 250 * g;
    this.popCap = 30 + 16 * b;
    // trail attractors
    const fs: number[] = [];
    const ws: number[] = [];
    const ds: number[] = [];
    for (let i = 0; i < c.length; i++) {
      if (this.phF[i] > 0.14) fs.push(i);
      if (this.phW[i] > 0.14) ws.push(i);
      if (this.dig[i] && c[i] === T_SOIL) {
        const x = i % MW;
        const y = Math.floor(i / MW);
        for (let k = 0; k < 4; k++) {
          const nx = x + DX[k];
          const ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
          const j = ny * MW + nx;
          if (isPass(c[j]) && this.homeP[j] < INF) ds.push(j);
        }
      }
    }
    bfs(c, fs, this.forF, this.queue, 45);
    bfs(c, ws, this.warF, this.queue, 45);
    bfs(c, ds, this.digF, this.queue);
    if (all) {
      const fsrc: number[] = [];
      for (const f of this.food) if (f.amt > 0 && isPass(c[this.cellOf(f.x, f.y)])) fsrc.push(this.cellOf(f.x, f.y));
      bfs(c, fsrc, this.foodF, this.queue);
      for (const R of this.rivals) if (R.queen) bfs(c, [this.cellOf(R.queen.x, R.queen.y)], R.homeF, this.queue);
      // exploration frontier
      const fr: number[] = [];
      for (let i = 0; i < c.length; i++) {
        if (!this.explored[i] || !isPass(c[i]) || this.homeP[i] >= INF) continue;
        const x = i % MW;
        const y = Math.floor(i / MW);
        for (let k = 0; k < 4; k++) {
          const nx = x + DX[k];
          const ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
          const j = ny * MW + nx;
          if (!this.explored[j] && isPass(c[j])) { fr.push(i); break; }
        }
      }
      bfs(c, fr, this.frontF, this.queue);
    }
  }
  revealCircle(x: number, y: number, rad: number) {
    const rc = Math.ceil(rad / CELL);
    const cx = Math.floor(x / CELL);
    const cy = Math.floor(y / CELL);
    const r2 = (rad / CELL) * (rad / CELL);
    for (let dy = -rc; dy <= rc; dy++) {
      for (let dx = -rc; dx <= rc; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
        this.explored[yy * MW + xx] = 1;
      }
    }
    this.fogDirty = true;
  }
  visionOf(e: Ent): number {
    const m = this.mods.has('blind') ? 0.6 : 1;
    switch (e.type) {
      case 'scout': return 8.5 * CELL * m * (1 + 0.25 * this.tech('sonar'));
      case 'queen': return 7 * CELL * m;
      case 'soldier': case 'spitter': return 5 * CELL * m;
      default: return 4.5 * CELL * m;
    }
  }
  updateFog() {
    this.visible.fill(0);
    const mark = (x: number, y: number, rad: number) => {
      const rc = Math.ceil(rad / CELL);
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const r2 = (rad / CELL) * (rad / CELL);
      for (let dy = -rc; dy <= rc; dy++) {
        const yy = cy + dy;
        if (yy < 0 || yy >= MH) continue;
        for (let dx = -rc; dx <= rc; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const xx = cx + dx;
          if (xx < 0 || xx >= MW) continue;
          const i = yy * MW + xx;
          this.visible[i] = 1;
          this.explored[i] = 1;
        }
      }
    };
    for (const e of this.ents) if (!e.dead && e.team === 0) mark(e.x, e.y, this.visionOf(e));
    for (const c of this.chambers) if (c.active) mark((c.cx + 0.5) * CELL, (c.cy + 0.5) * CELL, 6 * CELL);
    this.fogDirty = true;
  }

  /* ------------------------------------------------------------ AI */
  speedOf(e: Ent): number {
    let s = e.spd;
    if (e.team === 0) {
      s *= 1 + 0.06 * this.tech('legs');
      if (e.type === 'scout') s *= 1 + 0.15 * this.tech('sonar');
      if (this.cells[e.cell] === T_MEADOW) {
        const w = this.weather;
        const base = w === 'rain' ? 0.85 : w === 'storm' ? 0.7 : w === 'cold' ? 0.7 : 1;
        s *= 1 - (1 - base) * this.wp();
      }
      if (this.foodStock <= 0) s *= 0.8;
    } else if (e.team === 9 && e.type !== 'wasp' && this.weather === 'cold') s *= 0.85;
    return s;
  }
  followTrail(e: Ent, ph: Float32Array, field: Int16Array, thr: number, spd: number, dt: number): number {
    const i = e.cell;
    if (i < 0) return 0;
    if (ph[i] < thr) {
      if (field[i] >= INF || field[i] > 40) return 0;
      const n = descend(field, this.cells, i % MW, Math.floor(i / MW));
      if (n < 0) return 0;
      this.aimCell(e, n, spd, dt);
      return 1;
    }
    const h = this.homeP[i];
    let best = -1, bs = -1;
    const x = i % MW;
    const y = Math.floor(i / MW);
    for (let k = 0; k < 8; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= MW || ny >= MH) continue;
      const j = ny * MW + nx;
      if (ph[j] < thr || !isPass(this.cells[j])) continue;
      const hj = this.homeP[j];
      if (hj >= INF || hj < h) continue;
      if (j === e.prev1 || j === e.prev2) continue;
      if (k >= 4 && (!isPass(this.cells[y * MW + nx]) || !isPass(this.cells[ny * MW + x]))) continue;
      const s = ph[j] + (hj - h) * 0.08 + Math.random() * 0.02;
      if (s > bs) { bs = s; best = j; }
    }
    if (best < 0) return 2;
    this.aimCell(e, best, spd, dt);
    return 1;
  }
  findFood(x: number, y: number, rad: number): Food | null {
    let best: Food | null = null;
    let bd = rad * rad;
    for (const f of this.food) {
      if (f.amt <= 0) continue;
      const dx = f.x - x;
      const dy = f.y - y;
      const d = dx * dx + dy * dy;
      if (d >= bd) continue;
      if (!isPass(this.cells[this.cellOf(f.x, f.y)])) continue;
      if (!this.lineClear(x, y, f.x, f.y)) continue;
      bd = d;
      best = f;
    }
    return best;
  }
  pickup(e: Ent, f: Food) {
    const cap = 2 + this.tech('bearers');
    const take = Math.min(cap, f.amt);
    f.amt -= take;
    e.carry = take;
    e.tfood = null;
    e.a += Math.PI;
    audio.play('pickup');
    this.burst(f.x, f.y, 3, '#ffe08a', 30, 0.3, 1.6);
  }
  updateWorker(e: Ent, dt: number) {
    const spd = this.speedOf(e);
    const i = e.cell;
    e.tTimer -= dt;
    if (e.tTimer <= 0) { e.tTimer = 0.3 + Math.random() * 0.2; e.tgt = this.nearestHostile(e, 70); }
    const th = e.tgt && !e.tgt.dead ? e.tgt : null;
    if (th) {
      const d = Math.hypot(th.x - e.x, th.y - e.y);
      if (d < th.r + e.r + 6) this.tryAttack(e, th);
      const n = descend(this.homeP, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0 && th.type !== 'wasp') this.aimCell(e, n, spd * 1.15, dt);
      else this.aimXY(e, e.x - (th.x - e.x), e.y - (th.y - e.y), spd * 1.15, dt);
      return;
    }
    if (e.carry > 0) {
      if (this.homeP[i] <= 1) {
        this.foodStock = Math.min(this.foodCap, this.foodStock + e.carry);
        this.foodAcc += e.carry;
        this.stats.gathered += e.carry;
        this.float(e.x, e.y - 8, `+${e.carry}`, '#b8ff9a', 10);
        audio.play('deliver');
        e.carry = 0;
        e.a += Math.PI;
        return;
      }
      const n = descend(this.homeP, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0) {
        this.aimCell(e, n, spd, dt);
        if (this.cells[i] !== T_SOIL && this.homeP[i] > 2) {
          const boost = 0.9 * (1 + 0.25 * this.tech('mastery'));
          this.phF[i] = Math.min(1, this.phF[i] + boost * dt);
          this.phDirty = true;
        }
      } else this.wanderMove(e, spd * 0.6, dt);
      return;
    }
    const diggerShare = this.digF[i] < INF ? 0.34 + Math.min(0.4, this.digCount / 160) : 0;
    if (diggerShare > 0 && (e.id * 0.618) % 1 < diggerShare) {
      if (this.tryDig(e, dt, spd)) return;
    }
    e.digging = 0;
    e.timer -= dt;
    if (e.timer <= 0) { e.timer = 0.35 + Math.random() * 0.2; e.tfood = this.findFood(e.x, e.y, 105); }
    if (e.tfood && e.tfood.amt > 0) {
      const f = e.tfood;
      if (Math.hypot(f.x - e.x, f.y - e.y) < 9) this.pickup(e, f);
      else this.navTo(e, f.x, f.y, spd, dt);
      return;
    }
    if (e.wander > 0) { e.wander -= dt; this.wanderMove(e, spd * 0.8, dt); return; }
    const r = this.followTrail(e, this.phF, this.forF, 0.1, spd, dt);
    if (r === 1) return;
    if (r === 2) { e.wander = 2.5 + Math.random() * 2.5; return; }
    this.wanderMove(e, spd * 0.7, dt);
  }
  tryDig(e: Ent, dt: number, spd: number): boolean {
    const i = e.cell;
    const x = i % MW;
    const y = Math.floor(i / MW);
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (nx < 1 || ny < 1 || nx >= MW - 1 || ny >= MH - 1) continue;
      const j = ny * MW + nx;
      if (this.dig[j] && this.cells[j] === T_SOIL) {
        e.digging = 0.2;
        e.a = lerpAngle(e.a, Math.atan2(ny - y, nx - x), Math.min(1, dt * 12));
        e.anim += 30 * dt;
        const rate = 1 + 0.25 * this.tech('diggers');
        this.digProg[j] += dt * rate;
        e.timer2 -= dt;
        if (e.timer2 <= 0) { e.timer2 = 0.25; this.burst((nx + 0.5) * CELL, (ny + 0.5) * CELL, 1, '#a07048', 30, 0.4, 1.8, 40); }
        if (this.digProg[j] >= DIG_TIME) this.openCell(j, false);
        return true;
      }
    }
    if (this.digF[i] < INF) {
      const n = descend(this.digF, this.cells, x, y);
      if (n >= 0) { this.aimCell(e, n, spd, dt); return true; }
    }
    return false;
  }
  updateSoldier(e: Ent, dt: number) {
    const spd = this.speedOf(e);
    const spit = e.type === 'spitter';
    e.tTimer -= dt;
    if (e.tTimer <= 0) { e.tTimer = 0.25 + Math.random() * 0.15; e.tgt = this.nearestHostile(e, spit ? 150 : 100); }
    const t = e.tgt && !e.tgt.dead ? e.tgt : null;
    if (t) {
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      e.idle = 0;
      if (d <= e.range + t.r) {
        e.a = lerpAngle(e.a, Math.atan2(t.y - e.y, t.x - e.x), 0.4);
        if (spit && d < 40) this.aimXY(e, e.x - (t.x - e.x), e.y - (t.y - e.y), spd * 0.8, dt);
        this.tryAttack(e, t);
      } else if (spit && this.lineClear(e.x, e.y, t.x, t.y) && d <= e.range * 1.05) {
        e.a = lerpAngle(e.a, Math.atan2(t.y - e.y, t.x - e.x), 0.4);
        this.tryAttack(e, t);
      } else this.navTo(e, t.x, t.y, spd, dt);
      return;
    }
    const r = this.followTrail(e, this.phW, this.warF, 0.12, spd, dt);
    if (r === 1) { e.idle = 0; return; }
    if (r === 2) { e.idle = 0; this.wanderMove(e, spd * 0.35, dt); return; }
    e.idle += dt;
    const i = e.cell;
    if (e.idle > 6 && this.homeP[i] > 9 && this.homeP[i] < INF) {
      const n = descend(this.homeP, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0) { this.aimCell(e, n, spd * 0.8, dt); return; }
    }
    this.wanderMove(e, spd * 0.35, dt);
  }
  updateNurse(e: Ent, dt: number) {
    const spd = this.speedOf(e);
    e.tTimer -= dt;
    if (e.tTimer <= 0) { e.tTimer = 0.4; e.tgt = this.nearestHostile(e, 60); }
    if (e.tgt && !e.tgt.dead) {
      const n = descend(this.homeP, this.cells, e.cell % MW, Math.floor(e.cell / MW));
      if (n >= 0) this.aimCell(e, n, spd * 1.2, dt);
      return;
    }
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = 0.6;
      let healed = false;
      this.forEachNear(e.x, e.y, 38, (o) => {
        if (!healed && o.team === 0 && o.hp < o.maxHp && o !== e) { o.hp = Math.min(o.maxHp, o.hp + (o.type === 'queen' ? 4 : 2.2)); healed = true; this.burst(o.x, o.y, 1, '#ffb7d5', 20, 0.4, 1.6); }
      });
    }
    const i = e.cell;
    if (this.homeP[i] > 10 && this.homeP[i] < INF) {
      const n = descend(this.homeP, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0) { this.aimCell(e, n, spd, dt); return; }
    }
    this.wanderMove(e, spd * 0.5, dt);
  }
  updateScout(e: Ent, dt: number) {
    const spd = this.speedOf(e);
    const i = e.cell;
    e.tTimer -= dt;
    if (e.tTimer <= 0) { e.tTimer = 0.35; e.tgt = this.nearestHostile(e, 85); }
    if (e.tgt && !e.tgt.dead) {
      const n = descend(this.homeP, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0) this.aimCell(e, n, spd * 1.1, dt); else this.aimXY(e, e.x - (e.tgt.x - e.x), e.y - (e.tgt.y - e.y), spd, dt);
      return;
    }
    if (e.task === 1) {
      if (this.homeP[i] <= 2) { e.task = 0; return; }
      const n = descend(this.homeP, this.cells, i % MW, Math.floor(i / MW));
      if (n < 0) { e.task = 0; return; }
      this.aimCell(e, n, spd, dt);
      if (this.cells[i] !== T_SOIL) { this.phF[i] = Math.min(1, Math.max(this.phF[i], 0.55)); this.phDirty = true; }
      return;
    }
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = 0.5;
      const rad = this.visionOf(e) * 0.75;
      for (const f of this.food) {
        if (f.amt <= 0 || f.marked) continue;
        if (Math.hypot(f.x - e.x, f.y - e.y) < rad && isPass(this.cells[this.cellOf(f.x, f.y)])) {
          f.marked = true;
          e.task = 1;
          this.float(f.x, f.y - 10, '🔎 Food!', '#bff', 11);
          this.say('🔎 A scout found food and is marking a trail home.', 'info');
          break;
        }
      }
    }
    if (e.task === 1) return;
    if (this.frontF[i] < INF && this.frontF[i] > 0) {
      const n = descend(this.frontF, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0) { this.aimCell(e, n, spd * 0.95, dt); return; }
    }
    this.wanderMove(e, spd * 0.8, dt);
  }
  updateQueen(e: Ent, dt: number) {
    e.tTimer -= dt;
    if (e.tTimer <= 0) { e.tTimer = 0.3; e.tgt = this.nearestHostile(e, 45); }
    if (e.tgt && !e.tgt.dead && Math.hypot(e.tgt.x - e.x, e.tgt.y - e.y) < e.range + e.tgt.r) this.tryAttack(e, e.tgt);
    if (e.team === 0) {
      const regen = 0.3 + 0.15 * Math.min(8, this.counts.nurse);
      if (this.foodStock > 0 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + regen * dt);
    } else if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + 0.6 * dt);
  }

  updateRivalAnt(e: Ent, dt: number) {
    const R = this.rivals[e.team - 1];
    if (!R) return;
    const spd = this.speedOf(e);
    const i = e.cell;
    if (!R.alive) return;
    e.tTimer -= dt;
    if (e.raid > 0) e.raid -= dt;
    const worker = e.type === 'worker';
    if (e.tTimer <= 0) {
      e.tTimer = 0.3 + Math.random() * 0.2;
      e.tgt = this.nearestHostile(e, worker ? 55 : R.alert > 0 || e.raid > 0 ? 150 : 95);
    }
    const t = e.tgt && !e.tgt.dead ? e.tgt : null;
    if (t) {
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (worker && d > e.range + t.r + 4) {
        const n = descend(R.homeF, this.cells, i % MW, Math.floor(i / MW));
        if (n >= 0) { this.aimCell(e, n, spd * 1.1, dt); return; }
      }
      if (d <= e.range + t.r) { e.a = lerpAngle(e.a, Math.atan2(t.y - e.y, t.x - e.x), 0.4); this.tryAttack(e, t); } else this.navTo(e, t.x, t.y, spd, dt);
      return;
    }
    if (worker) {
      if (e.carry > 0) {
        if (R.homeF[i] <= 1) { R.food += e.carry; e.carry = 0; e.a += Math.PI; return; }
        const n = descend(R.homeF, this.cells, i % MW, Math.floor(i / MW));
        if (n >= 0) this.aimCell(e, n, spd, dt); else this.wanderMove(e, spd * 0.5, dt);
        return;
      }
      e.timer -= dt;
      if (e.timer <= 0) { e.timer = 0.5; e.tfood = this.findFood(e.x, e.y, 100); }
      if (e.tfood && e.tfood.amt > 0) {
        const f = e.tfood;
        if (Math.hypot(f.x - e.x, f.y - e.y) < 9) { const take = Math.min(2, f.amt); f.amt -= take; e.carry = take; e.tfood = null; e.a += Math.PI; } else this.navTo(e, f.x, f.y, spd, dt);
        return;
      }
      const n = this.foodF[i] < INF ? descend(this.foodF, this.cells, i % MW, Math.floor(i / MW)) : -1;
      if (n >= 0) this.aimCell(e, n, spd * 0.9, dt); else this.wanderMove(e, spd * 0.6, dt);
      return;
    }
    // soldier
    if (e.raid > 0) {
      const n = descend(this.homeP, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0) this.aimCell(e, n, spd, dt); else this.wanderMove(e, spd * 0.5, dt);
      return;
    }
    if (R.homeF[i] > 8 && R.homeF[i] < INF) {
      const n = descend(R.homeF, this.cells, i % MW, Math.floor(i / MW));
      if (n >= 0) { this.aimCell(e, n, spd * 0.8, dt); return; }
    }
    this.wanderMove(e, spd * 0.35, dt);
  }
  updateRivals(dt: number) {
    for (const R of this.rivals) {
      if (!R.alive) continue;
      R.food += 0.35 * dt;
      if (R.alert > 0) R.alert -= dt;
      const q = R.queen!;
      // proximity alert
      if (this.time % 1 < dt) {
        let near = false;
        this.forEachNear(q.x, q.y, 14 * CELL, (o) => { if (o.team === 0) near = true; });
        if (near) R.alert = 12;
      }
      R.spawnT -= dt * (R.alert > 0 ? 1.8 : 1);
      let w = 0, s = 0;
      for (const e of this.ents) if (!e.dead && e.team === R.team && e.type !== 'queen') { if (e.type === 'worker') w++; else s++; }
      if (R.spawnT <= 0) {
        R.spawnT = Math.max(1.6, 5.5 / (this.diff.rivalRate * (0.8 + this.time / 500)));
        const cap = R.def.cap + Math.floor(this.time / 60);
        if (w + s < cap) {
          const wantW = Math.min(14, 6 + Math.floor(this.time / 120) * 2);
          const type = w < wantW ? 'worker' : 'soldier';
          const cost = type === 'worker' ? 8 : 14;
          if (R.food >= cost) { R.food -= cost; this.spawnRivalAnt(R, type); }
        }
      }
      R.raidT -= dt;
      if (R.raidT <= 0) {
        R.raidT = Math.max(45, R.def.raidEvery / this.diff.rivalRate) * (0.85 + this.rng.next() * 0.3);
        if (s >= 4) {
          const k = Math.ceil(s * 0.75);
          let n = 0;
          for (const e of this.ents) {
            if (n >= k) break;
            if (!e.dead && e.team === R.team && e.type === 'soldier' && e.raid <= 0) { e.raid = 80; n++; }
          }
          this.say(`⚔️ The ${R.def.name} launch a raid with ${n} soldiers!`, 'bad');
          audio.play('alarm');
        }
      }
    }
  }

  updateWild(e: Ent, dt: number) {
    const spd = this.speedOf(e);
    if (e.type === 'antlion') { this.updateAntlion(e); return; }
    if (e.type === 'anteater') { this.updateBoss(e, dt); return; }
    e.tTimer -= dt;
    const aggro = e.type === 'spider' ? 150 : e.type === 'wasp' ? 280 : e.type === 'beetle' ? 110 : 130;
    if (e.tTimer <= 0) {
      e.tTimer = 0.3 + Math.random() * 0.2;
      if (e.type === 'wasp') e.tgt = this.nearestHostile(e, aggro, (o) => this.cells[o.cell] === T_MEADOW && o.type !== 'antlion');
      else e.tgt = this.nearestHostile(e, aggro, (o) => o.type !== 'antlion');
    }
    const t = e.tgt && !e.tgt.dead ? e.tgt : null;
    if (e.type === 'wasp') {
      e.life -= dt;
      if (!t && e.life <= 0) { e.dead = true; return; }
      e.anim += dt * 40;
    }
    if (t) {
      const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d <= e.range + t.r) {
        e.a = lerpAngle(e.a, Math.atan2(t.y - e.y, t.x - e.x), 0.5);
        this.tryAttack(e, t);
        if (e.type === 'wasp') this.aimXY(e, t.x + Math.sin(this.time * 6) * 20, t.y + Math.cos(this.time * 6) * 20, spd * 0.4, dt);
      } else if (e.digger) this.diggerMove(e, t.x, t.y, spd, dt, 1);
      else this.navTo(e, t.x, t.y, spd, dt);
      return;
    }
    if (e.digger) { this.diggerMove(e, this.queen.x, this.queen.y, spd, dt, 1); return; }
    if (e.type === 'wasp') {
      if (e.life > 0 && e.task === 1) {
        const q = this.queen;
        this.aimXY(e, q.x + Math.sin(this.time * 0.7 + e.id) * 260, q.y + Math.cos(this.time * 0.5 + e.id) * 200, spd * 0.6, dt);
      } else this.wanderMove(e, spd * 0.6, dt);
      return;
    }
    if (e.task === 1 && e.cell >= 0 && this.homeP[e.cell] < INF) {
      const n = descend(this.homeP, this.cells, e.cell % MW, Math.floor(e.cell / MW));
      if (n >= 0 && this.homeP[e.cell] > 4) { this.aimCell(e, n, spd * 0.85, dt); return; }
    }
    this.wanderMove(e, spd * 0.5, dt);
  }
  updateAntlion(e: Ent) {
    this.forEachNear(e.x, e.y, 62, (o) => {
      if (o.team === 9 || o.flying || o.type === 'queen') return;
      const dx = e.x - o.x;
      const dy = e.y - o.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 14) return;
      this.step(o, (dx / d) * 0.6, (dy / d) * 0.6);
    });
    const t = this.nearestHostile(e, e.range + 6, (o) => !o.flying);
    if (t) { e.tgt = t; this.tryAttack(e, t); }
  }
  updateBoss(e: Ent, dt: number) {
    const phase2 = e.hp < e.maxHp * 0.5;
    if (phase2 && !e.task) {
      e.task = 1;
      this.say('💢 The Anteater ROARS — it is enraged!', 'bad');
      audio.play('roar');
      this.addShake(12);
      this.flash = 0.4;
    }
    const spd = e.spd * (phase2 ? 1.6 : 1);
    e.tTimer -= dt;
    if (e.tTimer <= 0) { e.tTimer = 0.4; e.tgt = this.nearestHostile(e, 220, (o) => o.type !== 'antlion'); }
    const t = e.tgt && !e.tgt.dead ? e.tgt : this.queen;
    const d = Math.hypot(t.x - e.x, t.y - e.y);
    if (d > e.range * 0.8) this.diggerMove(e, t.x, t.y, spd, dt, 2);
    else e.a = lerpAngle(e.a, Math.atan2(t.y - e.y, t.x - e.x), 0.2);
    if (e.cdT <= 0 && d < e.range + t.r + 20) {
      e.cdT = phase2 ? 1.0 : 1.6;
      const dmg = e.atk * this.diff.enemyDmg;
      this.forEachNear(e.x, e.y, e.range + 14, (o) => { if (o.team !== 9) this.hurt(o, dmg, e, true); });
      this.addShake(3);
      this.burst(e.x + Math.cos(e.a) * 40, e.y + Math.sin(e.a) * 40, 12, '#c9a06a', 110, 0.5, 2.5);
    }
    e.timer -= dt;
    if (e.timer <= 0) {
      e.timer = phase2 ? 2.6 : 4.8;
      const n = phase2 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        let tx = t.x, ty = t.y;
        const cand: Ent[] = [];
        this.forEachNear(e.x, e.y, 340, (o) => { if (o.team !== 9) cand.push(o); });
        if (cand.length) { const c = cand[Math.floor(Math.random() * cand.length)]; tx = c.x; ty = c.y; }
        this.telegraphs.push({ x: tx, y: ty, r: 70, t: 1.2, max: 1.2, dmg: 45 * this.diff.enemyDmg, team: 9 });
      }
      audio.play('warn');
    }
  }
  updateTelegraphs(dt: number) {
    for (const g of this.telegraphs) {
      g.t -= dt;
      if (g.t <= 0) {
        this.forEachNear(g.x, g.y, g.r, (o) => { if (o.team !== g.team) this.hurt(o, g.dmg, null, true); });
        this.burst(g.x, g.y, 26, '#b58a5a', 150, 0.7, 3, 40);
        this.ring(g.x, g.y, g.r, '#ffd9a0', 0.4);
        this.addShake(7);
        audio.play('slam');
        const cx = Math.floor(g.x / CELL);
        const cy = Math.floor(g.y / CELL);
        this.carve(cx, cy, 2);
      }
    }
    this.telegraphs = this.telegraphs.filter((g) => g.t > 0);
  }
  updateProjs(dt: number) {
    for (const p of this.projs) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (!this.pass(p.x, p.y)) { p.life = 0; this.burst(p.x, p.y, 3, p.color, 30, 0.3, 1.5); continue; }
      let found: Ent | null = null;
      this.forEachNear(p.x, p.y, 12, (o) => { if (!found && o.team !== p.team) found = o; });
      const hit = found as Ent | null;
      if (hit) {
        p.life = 0;
        this.hurt(hit, p.dmg, null, true);
        this.burst(p.x, p.y, 5, p.color, 50, 0.35, 2);
      }
    }
    this.projs = this.projs.filter((p) => p.life > 0);
  }

  /* ------------------------------------------------------------ colony economy */
  pickCaste(): CasteId | null {
    const avail = CASTES.filter((c) => (c !== 'spitter' || this.tech('acid') > 0) && this.mix[c] > 0);
    if (!avail.length) return 'worker';
    let sum = 0;
    for (const c of avail) sum += this.mix[c];
    const inBrood: Record<string, number> = {};
    for (const b of this.brood) inBrood[b.caste] = (inBrood[b.caste] || 0) + 1;
    let total = this.brood.length;
    for (const c of CASTES) total += this.counts[c];
    total = Math.max(1, total);
    let best: CasteId | null = null;
    let bd = -9;
    for (const c of avail) {
      const want = this.mix[c] / sum;
      const have = (this.counts[c] + (inBrood[c] || 0)) / total;
      const def = want - have;
      if (def > bd) { bd = def; best = c; }
    }
    return best;
  }
  colonyTick(dt: number) {
    // counts
    for (const k of CASTES) this.counts[k] = 0;
    for (const e of this.ents) if (!e.dead && e.team === 0 && e.type !== 'queen') this.counts[e.type]++;
    const pop = CASTES.reduce((a, c) => a + this.counts[c], 0);
    this.stats.peakPop = Math.max(this.stats.peakPop, pop);
    let nursery = 0, fungus = 0;
    for (const c of this.chambers) if (c.active) { if (c.type === 'nursery') nursery++; else if (c.type === 'fungus') fungus++; }
    const broodCap = 6 + 6 * nursery;
    // upkeep
    const upkeep = (pop * 0.022 + 0.18) * this.diff.upkeep * (this.mods.has('famine') ? 1.3 : 1);
    this.foodStock -= upkeep * dt;
    // fungus
    if (fungus > 0) {
      const w = this.weather;
      const base = w === 'rain' ? 1.6 : w === 'storm' ? 1.4 : w === 'heat' ? 0.4 : 1;
      const mul = 1 + (base - 1) * this.wp() * (base < 1 ? 1 : 1);
      const tend = Math.min(1, 0.4 + 0.2 * this.counts.nurse);
      const gain = fungus * 0.45 * mul * tend * dt;
      this.foodStock += gain;
      this.foodAcc += gain;
    }
    if (this.foodStock > this.foodCap) this.foodStock = this.foodCap;
    if (this.foodStock < 0) this.foodStock = 0;
    // rate display
    this.foodAccT += dt;
    if (this.foodAccT >= 3) { this.foodRate = this.foodAcc / this.foodAccT - upkeep; this.foodAcc = 0; this.foodAccT = 0; }
    // starvation
    if (this.foodStock <= 0) {
      for (const e of this.ents) if (!e.dead && e.team === 0) this.hurt(e, (e.type === 'queen' ? 0.6 : 0.2) * dt, null, true, true);
    }
    // brood development
    let tempMul = 1;
    if (this.weather === 'cold') tempMul = 1 - 0.3 * this.wp() * (nursery > 0 ? 0.5 : 1);
    else if (this.weather === 'heat') tempMul = 1 - 0.1 * this.wp();
    const nurseF = 1 + 0.5 * Math.min(1, this.counts.nurse / Math.max(1, this.brood.length * 0.5));
    const speed = tempMul * nurseF * (1 + 0.2 * Math.min(3, nursery));
    for (const b of this.brood) b.t += dt * speed;
    const remaining: Brood[] = [];
    for (const b of this.brood) {
      if (b.t >= b.need) this.hatch(b.caste); else remaining.push(b);
    }
    this.brood = remaining;
    // laying
    const q = this.queen;
    this.layT -= dt * (1 + 0.12 * this.tech('fertile')) * (0.5 + 0.5 * (q.hp / q.maxHp));
    this.freeT -= dt;
    if (this.layT <= 0) {
      if (this.brood.length < broodCap && pop + this.brood.length < this.popCap) {
        const c = this.pickCaste();
        if (c && this.foodStock >= CASTE_INFO[c].cost) {
          this.foodStock -= CASTE_INFO[c].cost;
          this.stats.spent += CASTE_INFO[c].cost;
          this.brood.push({ caste: c, t: 0, need: BROOD_TIME[c] });
          this.layT = 3.2;
          this.burst(q.x, q.y, 3, '#fff7d6', 25, 0.4, 1.6);
        } else if (this.counts.worker < 3 && this.freeT <= 0 && this.brood.length === 0) {
          this.brood.push({ caste: 'worker', t: 0, need: BROOD_TIME.worker });
          this.freeT = 20;
          this.say('The Queen lays an emergency worker egg.', 'info');
          this.layT = 3.2;
        } else this.layT = 0.5;
      } else this.layT = 0.5;
    }
    // chambers: sentry fire, barracks heal
    for (const c of this.chambers) {
      if (!c.active) continue;
      const cx = (c.cx + 0.5) * CELL;
      const cy = (c.cy + 0.5) * CELL;
      if (c.type === 'sentry') {
        c.cd -= dt;
        if (c.cd <= 0 && this.foodStock > 1) {
          let best: Ent | null = null;
          let bd = 150 * 150;
          this.forEachNear(cx, cy, 150, (o) => {
            if (o.team === 0) return;
            const d = (o.x - cx) ** 2 + (o.y - cy) ** 2;
            if (d < bd) { bd = d; best = o; }
          });
          const t = best as Ent | null;
          if (t) {
            c.cd = 1.1;
            this.foodStock -= 0.3;
            const a = Math.atan2(t.y - cy, t.x - cx);
            this.projs.push({ x: cx, y: cy, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, life: 0.8, dmg: 6 * (1 + 0.12 * this.tech('mandibles')), team: 0, color: '#8fd8ff' });
            audio.play('spit');
          } else c.cd = 0.3;
        }
      } else if (c.type === 'barracks') {
        this.forEachNear(cx, cy, 2.5 * CELL, (o) => { if (o.team === 0 && o.type === 'soldier' && o.hp < o.maxHp) o.hp = Math.min(o.maxHp, o.hp + 2 * dt); });
      }
    }
    // energy
    const em = this.energyMax();
    this.energy = Math.min(em, this.energy + (12 + 2.5 * this.tech('mastery')) * dt);
  }
  hatch(c: CasteId) {
    const nur = this.chambers.filter((x) => x.active && x.type === 'nursery');
    let x = this.queen.x, y = this.queen.y;
    if (nur.length && Math.random() < 0.7) { const n = nur[Math.floor(Math.random() * nur.length)]; x = (n.cx + 0.5) * CELL; y = (n.cy + 0.5) * CELL; }
    const e = this.spawnAnt(c, x + (Math.random() - 0.5) * 24, y + (Math.random() - 0.5) * 24);
    if (!this.pass(e.x, e.y)) { e.x = this.queen.x; e.y = this.queen.y; }
    audio.play('hatch');
    this.burst(e.x, e.y, 5, '#fff3c4', 40, 0.4, 1.8);
    this.float(e.x, e.y - 8, CASTE_INFO[c].icon, '#fff', 12);
  }

  /* ------------------------------------------------------------ objectives */
  objectiveText(): { text: string; prog: number } {
    const o = this.level.objective;
    const pop = CASTES.reduce((a, c) => a + this.counts[c], 0);
    switch (o.type) {
      case 'grow': {
        const p = Math.min(1, pop / (o.pop || 1));
        const f = Math.min(1, this.foodStock / (o.food || 1));
        return { text: `Colony ${pop}/${o.pop} ants · Stockpile ${Math.floor(this.foodStock)}/${o.food} food`, prog: (p + f) / 2 };
      }
      case 'conquer': {
        const alive = this.rivals.filter((r) => r.alive).length;
        return { text: `Destroy ${alive} rival queen${alive === 1 ? '' : 's'} (${this.rivals.length - alive}/${this.rivals.length})`, prog: this.rivals.length ? (this.rivals.length - alive) / this.rivals.length : 1 };
      }
      case 'survive': {
        const left = Math.max(0, (o.time || 0) - this.time);
        return { text: `Survive the storms: ${Math.ceil(left)}s remaining`, prog: Math.min(1, this.time / (o.time || 1)) };
      }
      case 'boss':
        return { text: this.boss ? 'Slay the Anteater!' : this.bossSpawned ? 'Slay the Anteater!' : `Prepare — the Anteater approaches in ${Math.max(0, Math.ceil((this.level.bossAt || 0) - this.time))}s`, prog: this.boss ? 1 - this.boss.hp / this.boss.maxHp : 0 };
      default:
        return { text: `Endless siege — survive as long as you can (${Math.floor(this.time / 60)} min)`, prog: Math.min(1, this.time / 600) };
    }
  }
  checkEnd() {
    if (this.ended) return;
    const o = this.level.objective;
    const pop = CASTES.reduce((a, c) => a + this.counts[c], 0);
    if (o.type === 'grow' && pop >= (o.pop || 0) && this.foodStock >= (o.food || 0)) this.finish(true, 'Your colony thrives! The meadow is yours.');
    else if (o.type === 'conquer' && this.rivals.length && this.rivals.every((r) => !r.alive)) this.finish(true, 'Every rival queen has fallen. Total dominion!');
    else if (o.type === 'survive' && this.time >= (o.time || 0)) this.finish(true, 'The storms have passed and the colony endures!');
    if (!this.ended && pop === 0 && this.brood.length === 0 && this.foodStock < 8 && this.time > 20) this.finish(false, 'Every ant is gone and the larder is empty.');
  }
  finish(won: boolean, reason: string) {
    if (this.ended) return;
    const L = this.level;
    const endless = L.objective.type === 'endless';
    const dm = Math.min(this.minJelly, this.diff.jelly);
    let modSum = 0;
    this.mods.forEach((m) => { const d = ({ gale: 0.25, famine: 0.25, fragile: 0.2, surge: 0.3, blind: 0.15 } as Record<string, number>)[m]; modSum += d || 0; });
    const jBonus = 1 + 0.15 * this.tech('jelly');
    let stars = 0;
    let jelly = 0;
    if (won) {
      stars = 1 + (this.time <= L.parTime ? 1 : 0) + (this.stats.lost <= L.maxLost ? 1 : 0);
      jelly = Math.round(L.jelly * (1 + 0.5 * (stars - 1)) * dm * (1 + modSum) * jBonus);
    } else if (endless) {
      jelly = Math.round((this.time / 60) * 1.6 * dm * (1 + modSum) * jBonus);
    } else {
      jelly = Math.round(Math.min(L.jelly * 0.5, this.stats.kills / 25 + this.time / 150) * dm * jBonus);
    }
    this.ended = { won, reason, stars, jelly, time: this.time, levelId: L.id, diffId: this.diff.id, stats: { ...this.stats }, endless, mods: [...this.mods] };
    this.endDelay = won ? 1.6 : 1.9;
    this.timeScale = 0.3;
    this.mouseDown = false;
    audio.play(won ? 'win' : 'lose');
    this.addShake(won ? 3 : 10);
    if (!won) this.flash = 0.5;
  }

  /* ------------------------------------------------------------ main update */
  update(dt: number) {
    this.time += dt;
    if (this.strokeSound > 0) this.strokeSound -= dt;
    this.weatherTick(dt);
    // events
    if (!this.ended) {
      this.evT -= dt;
      if (this.evT <= 0) { this.evT = this.nextEventGap(); this.fireEvent(); }
      const L = this.level;
      if (L.bossAt) {
        if (!this.bossWarned && this.time >= L.bossAt - 30) {
          this.bossWarned = true;
          this.say('🌍 The ground trembles... something enormous approaches!', 'bad');
          audio.play('alarm');
          this.addShake(4);
        }
        if (!this.bossSpawned && this.time >= L.bossAt) {
          this.bossSpawned = true;
          const p = this.pickSpawn('edge');
          const b = this.spawnWild('anteater', p.x, p.y, 0);
          const hpm = L.objective.type === 'endless' ? 1.2 : 1;
          b.maxHp = b.hp = Math.round(BASE.anteater.hp * this.diff.enemyHp * hpm);
          this.boss = b;
          this.say('🦡 THE ANTEATER has emerged! Rally every soldier and spitter!', 'bad');
          audio.play('roar');
          this.addShake(12);
        }
      }
    }
    // fields
    this.fieldT += dt;
    this.field2T += dt;
    if (this.fieldT >= 0.4) { this.fieldT = 0; const all = this.field2T >= 1.3; if (all) this.field2T = 0; this.recomputeFields(all); }
    this.fogT += dt;
    if (this.fogT >= 0.25) { this.fogT = 0; this.updateFog(); }
    // pheromone decay
    this.decayT += dt;
    if (this.decayT >= 0.1) {
      const d = this.decayT;
      this.decayT = 0;
      const w = this.weather;
      const wm = w === 'rain' ? 4 : w === 'storm' ? 6 : w === 'heat' ? 2.2 : 1;
      const surfMul = 1 + (wm - 1) * this.wp();
      const heatAll = w === 'heat' ? 1 + 0.5 * this.wp() : 1;
      const k0 = 0.014 * (1 - 0.15 * this.tech('mastery'));
      const kT = Math.exp(-k0 * heatAll * d);
      const kM = Math.exp(-k0 * 1.5 * surfMul * heatAll * d);
      const c = this.cells;
      for (let i = 0; i < c.length; i++) {
        const f = this.phF[i];
        const w2 = this.phW[i];
        if (f === 0 && w2 === 0) continue;
        const k = c[i] === T_MEADOW ? kM : kT;
        let nf = f * k;
        let nw = w2 * k * 1.15;
        if (nf < 0.01) nf = 0;
        if (nw < 0.01) nw = 0;
        this.phF[i] = nf;
        this.phW[i] = nw;
      }
      this.phDirty = true;
    }
    this.rebuildGrid();
    this.colonyTick(dt);
    this.updateRivals(dt);
    // entities
    const wind = this.weather === 'storm' ? 16 * (1 - 0.35 * this.tech('weather')) : 0;
    const n = this.ents.length;
    for (let k = 0; k < n; k++) {
      const e = this.ents[k];
      if (e.dead) continue;
      e.cdT -= dt;
      if (e.flash > 0) e.flash -= dt;
      const ci = this.cellOf(e.x, e.y);
      if (ci !== e.cell) { e.prev2 = e.prev1; e.prev1 = e.cell; e.cell = ci; }
      if (e.poison > 0) { e.poison -= dt; this.hurt(e, 3 * dt, null, true, true); if (e.dead) continue; }
      if (e.team !== 9 && e.type !== 'queen' && this.cells[ci] === T_MEADOW) {
        if (this.weather === 'heat' && e.team === 0) { this.hurt(e, 0.35 * this.wp() * dt, null, true, true); if (e.dead) continue; }
        if (wind > 0) this.step(e, Math.cos(this.windA) * wind * dt, Math.sin(this.windA) * wind * dt);
      }
      if (e.team >= 1 && e.team <= 3 && e.type !== 'queen' && !this.rivals[e.team - 1].alive) { this.hurt(e, 6 * dt, null, true, true); continue; }
      if (e.digging > 0) e.digging -= dt;
      if (e.team === 0) {
        switch (e.type) {
          case 'worker': this.updateWorker(e, dt); break;
          case 'soldier': case 'spitter': this.updateSoldier(e, dt); break;
          case 'nurse': this.updateNurse(e, dt); break;
          case 'scout': this.updateScout(e, dt); break;
          case 'queen': this.updateQueen(e, dt); break;
          default: break;
        }
      } else if (e.team === 9) this.updateWild(e, dt);
      else if (e.type === 'queen') this.updateQueen(e, dt);
      else this.updateRivalAnt(e, dt);
    }
    this.updateTelegraphs(dt);
    this.updateProjs(dt);
    // cleanup
    let removed = false;
    for (const e of this.ents) if (e.dead) removed = true;
    if (removed) this.ents = this.ents.filter((e) => !e.dead);
    if (this.boss && this.boss.dead) this.boss = null;
    if (this.time % 1 < dt) this.food = this.food.filter((f) => f.amt > 0);
    // particles
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= 0.97;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y -= 16 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    // threat / music
    this.threatT += dt;
    if (this.threatT > 0.6) {
      this.threatT = 0;
      let n2 = 0;
      for (const e of this.ents) {
        if (e.dead || e.team === 0 || e.type === 'antlion') continue;
        if (e.cell >= 0 && (this.visible[e.cell] || this.reachP[e.cell] < 40)) n2 += e.boss ? 8 : e.type === 'queen' ? 0 : 1;
      }
      this.threat = Math.min(1, n2 / 10 + (this.queen.hp < this.queen.maxHp * 0.5 ? 0.2 : 0));
      audio.setIntensity(this.threat);
      audio.startMusic(this.boss ? 'boss' : 'game');
    }
    // tutorial
    if (this.tut) {
      this.tutTime += dt;
      if (TUT[this.tut.step].check(this)) this.advanceTutorial();
    }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 22);
    if (!this.ended) this.checkEnd();
  }
  advanceTutorial() {
    if (!this.tut) return;
    this.tutTime = 0;
    audio.play('upgrade');
    if (this.tut.step >= TUT.length - 1) {
      this.tut = null;
      this.save.tutorialDone = true;
      return;
    }
    this.tut.step++;
  }
  skipTutorial() {
    this.tut = null;
    this.save.tutorialDone = true;
  }

  /* ------------------------------------------------------------ UI control API */
  setTool(t: Tool) {
    if (this.tool !== t) audio.play('click');
    this.tool = t;
    this.strokeLast = null;
  }
  setBrush(b: number) { this.brush = Math.max(1, Math.min(3, b)); }
  setChamber(c: ChamberType) {
    const info = CHAMBER_INFO[c];
    if (info.tech && this.tech(info.tech) < 1) { audio.play('error'); return; }
    this.chamberSel = c;
    this.tool = 'build';
    audio.play('click');
  }
  setMix(c: CasteId, v: number) { this.mix[c] = Math.max(0, Math.min(10, v)); this.flags.mix = true; }
  setMixPreset(p: 'boom' | 'balanced' | 'war') {
    const sp = this.tech('acid') > 0;
    if (p === 'boom') this.mix = { worker: 8, soldier: 1, nurse: 2, scout: 1, spitter: 0 };
    else if (p === 'balanced') this.mix = { worker: 5, soldier: 3, nurse: 2, scout: 1, spitter: sp ? 1 : 0 };
    else this.mix = { worker: 3, soldier: 6, nurse: 1, scout: 0, spitter: sp ? 4 : 0 };
    this.flags.mix = true;
    audio.play('click');
  }
  setPaused(p: boolean) {
    if (this.ended) return;
    if (this.paused === p) return;
    this.paused = p;
    this.mouseDown = false;
    this.panning = false;
    audio.play('pause');
    this.pushHud();
  }
  setSpeed(s: number) { this.speed = s; audio.play('click'); }
  setDiff(id: string) {
    const d = DIFFS.find((x) => x.id === id);
    if (!d || d === this.diff) return;
    this.diff = d;
    this.minJelly = Math.min(this.minJelly, d.jelly);
    this.say(`Difficulty changed to ${d.name}.`, 'info');
  }
  centerOn(x: number, y: number) { this.cam.x = x; this.cam.y = y; this.clampCam(); }
  centerQueen() { this.centerOn(this.queen.x, this.queen.y); this.flags.moved += 300; }
  clampCam() {
    const z = this.cam.z;
    const hw = this.W / 2 / z;
    const hh = this.H / 2 / z;
    const ww = MW * CELL;
    const wh = MH * CELL;
    this.cam.x = hw * 2 >= ww ? ww / 2 : Math.max(hw, Math.min(ww - hw, this.cam.x));
    this.cam.y = hh * 2 >= wh ? wh / 2 : Math.max(hh, Math.min(wh - hh, this.cam.y));
  }
  zoomAt(factor: number, sx: number, sy: number) {
    const z0 = this.cam.z;
    const z1 = Math.max(0.4, Math.min(2.2, z0 * factor));
    const wx = (sx - this.W / 2) / z0 + this.cam.x;
    const wy = (sy - this.H / 2) / z0 + this.cam.y;
    this.cam.z = z1;
    this.cam.x = wx - (sx - this.W / 2) / z1;
    this.cam.y = wy - (sy - this.H / 2) / z1;
    this.clampCam();
  }
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.W / 2) / this.cam.z + this.cam.x, y: (sy - this.H / 2) / this.cam.z + this.cam.y };
  }

  /* ------------------------------------------------------------ input */
  bind() {
    const cv = this.canvas;
    const rect = () => cv.getBoundingClientRect();
    const pos = (ev: PointerEvent | WheelEvent | MouseEvent) => { const r = rect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; };
    const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void, opts?: AddEventListenerOptions) => {
      el.addEventListener(type, fn as EventListener, opts);
      this.unbinders.push(() => el.removeEventListener(type, fn as EventListener, opts));
    };
    on(cv, 'pointerdown', (ev) => {
      audio.ensure();
      try { cv.setPointerCapture(ev.pointerId); } catch { /* ignore */ }
      const p = pos(ev);
      this.pointers.set(ev.pointerId, p);
      this.mouse = { x: p.x, y: p.y, in: true };
      if (this.pointers.size >= 2) {
        this.mouseDown = false;
        this.panning = false;
        const [a, b] = [...this.pointers.values()];
        this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
        return;
      }
      if (ev.button === 2 || ev.button === 1 || this.tool === 'pan') { this.panning = true; return; }
      if (ev.button !== 0 || this.paused || this.ended) return;
      this.mouseDown = true;
      this.strokeLast = null;
      const w = this.screenToWorld(p.x, p.y);
      if (this.tool === 'build') this.tryBuild(w.x, w.y); else this.strokeTo(w.x, w.y);
    });
    on(cv, 'pointermove', (ev) => {
      const p = pos(ev);
      const prev = this.pointers.get(ev.pointerId);
      this.mouse = { x: p.x, y: p.y, in: true };
      if (prev) this.pointers.set(ev.pointerId, p);
      if (this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinch > 0 && d > 0) this.zoomAt(d / this.pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        this.pinch = d;
        return;
      }
      if (this.panning && prev) {
        const dx = (p.x - prev.x) / this.cam.z;
        const dy = (p.y - prev.y) / this.cam.z;
        this.cam.x -= dx;
        this.cam.y -= dy;
        this.flags.moved += Math.abs(dx) + Math.abs(dy);
        this.clampCam();
        return;
      }
      if (this.mouseDown && !this.paused && !this.ended && this.tool !== 'build' && this.tool !== 'pan') {
        const w = this.screenToWorld(p.x, p.y);
        this.strokeTo(w.x, w.y);
      }
    });
    const up = (ev: PointerEvent) => {
      this.pointers.delete(ev.pointerId);
      if (this.pointers.size < 2) this.pinch = 0;
      if (this.pointers.size === 0) { this.mouseDown = false; this.panning = false; this.strokeLast = null; }
    };
    on(cv, 'pointerup', up);
    on(cv, 'pointercancel', up);
    on(cv, 'pointerleave', () => { this.mouse.in = false; });
    on(cv, 'wheel', (ev) => {
      ev.preventDefault();
      const p = pos(ev);
      this.zoomAt(ev.deltaY < 0 ? 1.12 : 1 / 1.12, p.x, p.y);
    }, { passive: false });
    on(cv, 'contextmenu', (ev) => ev.preventDefault());

    const kd = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLInputElement) return;
      const k = ev.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) ev.preventDefault();
      this.keys.add(k);
      if (ev.repeat) return;
      if (k === ' ' || k === 'p') { this.setPaused(!this.paused); return; }
      if (k === 'escape') { this.setPaused(!this.paused); return; }
      if (this.paused || this.ended) return;
      const tools: Tool[] = ['forage', 'war', 'dig', 'erase', 'build', 'pan'];
      if (k >= '1' && k <= '6') this.setTool(tools[Number(k) - 1]);
      else if (k === '[') this.setBrush(this.brush - 1);
      else if (k === ']') this.setBrush(this.brush + 1);
      else if (k === 'h') this.centerQueen();
      else if (k === '=' || k === '+') this.zoomAt(1.2, this.W / 2, this.H / 2);
      else if (k === '-') this.zoomAt(1 / 1.2, this.W / 2, this.H / 2);
      else if (k === 't') this.setSpeed(this.speed >= 3 ? 1 : this.speed + 1);
    };
    const ku = (ev: KeyboardEvent) => { this.keys.delete(ev.key.toLowerCase()); };
    const blur = () => { this.keys.clear(); this.mouseDown = false; this.panning = false; if (!this.ended) this.setPaused(true); };
    const vis = () => { if (document.hidden) { blur(); audio.suspend(); } else audio.resume(); };
    const rs = () => this.resize();
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', blur);
    window.addEventListener('resize', rs);
    document.addEventListener('visibilitychange', vis);
    this.unbinders.push(() => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', blur);
      window.removeEventListener('resize', rs);
      document.removeEventListener('visibilitychange', vis);
    });
  }
  resize() {
    const p = this.canvas.parentElement;
    const w = Math.max(320, p ? p.clientWidth : window.innerWidth);
    const h = Math.max(240, p ? p.clientHeight : window.innerHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = w;
    this.H = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.clampCam();
  }

  /* ------------------------------------------------------------ loop */
  start() {
    this.lastT = performance.now();
    audio.startMusic('game');
    audio.setWeather(this.weather);
    const loop = (t: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (t - this.lastT) / 1000;
      this.lastT = t;
      if (!(dt > 0)) dt = 0.0001;
      dt = Math.min(dt, 0.1);
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }
  frame(dt: number) {
    this.fpsAcc += dt;
    this.fpsN++;
    if (this.fpsAcc > 0.5) { this.fps = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    // camera keys
    const sp = 700 / this.cam.z;
    let mx = 0, my = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) my -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) my += 1;
    if (mx || my) { this.cam.x += mx * sp * dt; this.cam.y += my * sp * dt; this.flags.moved += Math.abs(mx * sp * dt) + Math.abs(my * sp * dt); this.clampCam(); }
    // edge-scroll is intentionally omitted (touch/trackpad friendly)
    if (!this.paused) {
      const sim = dt * this.speed * this.timeScale;
      const steps = Math.max(1, Math.ceil(sim / 0.05));
      for (let i = 0; i < steps; i++) this.update(sim / steps);
      if (this.ended) {
        this.endDelay -= dt;
        if (this.endDelay <= 0 && !this.endNotified) {
          this.endNotified = true;
          this.paused = true;
          this.timeScale = 1;
          if (this.onEnd) this.onEnd(this.ended);
        }
      }
    }
    this.phFrame++;
    renderGame(this);
    this.miniT += dt;
    if (this.mini && this.miniT > 0.15) { this.miniT = 0; renderMinimap(this, this.mini); }
    this.hudT += dt;
    if (this.hudT > 0.18) { this.hudT = 0; this.pushHud(); }
  }
  pushHud() {
    if (this.onHud) this.onHud(this.snapshot());
  }
  snapshot(): HudSnap {
    const pop = CASTES.reduce((a, c) => a + this.counts[c], 0);
    const obj = this.objectiveText();
    const cc = {} as Record<ChamberType, number>;
    const cost = {} as Record<ChamberType, number>;
    for (const t of CHAMBER_TYPES) { cc[t] = this.chambers.filter((c) => c.type === t).length; cost[t] = this.chamberCost(t); }
    let nursery = 0;
    for (const c of this.chambers) if (c.active && c.type === 'nursery') nursery++;
    return {
      food: this.foodStock, foodCap: this.foodCap, foodRate: this.foodRate, pop, popCap: this.popCap, brood: this.brood.length, broodCap: 6 + 6 * nursery,
      counts: { ...this.counts } as Record<CasteId, number>, queenHp: this.queen.hp, queenMax: this.queen.maxHp, energy: this.energy, energyMax: this.energyMax(),
      weather: this.weather, nextWeather: this.nextWeather, weatherT: this.wTimer, time: this.time, speed: this.speed, paused: this.paused,
      tool: this.tool, brush: this.brush, chamberSel: this.chamberSel, mix: { ...this.mix }, objective: obj.text, objProgress: obj.prog,
      log: this.log.filter((l) => this.time - l.t < 11).slice(-5),
      boss: this.boss ? { hp: this.boss.hp, max: this.boss.maxHp, name: 'The Anteater' } : null,
      tutorial: this.tut ? { step: this.tut.step, total: TUT.length, text: TUT[this.tut.step].text, last: this.tut.step === TUT.length - 1 } : null,
      rivals: this.rivals.map((r) => ({ name: r.def.name, color: r.def.color, alive: r.alive, hp: r.queen ? r.queen.hp : 0, max: r.queen ? r.queen.maxHp : 1 })),
      chamberCount: cc, chamberCost: cost, ended: !!this.ended, threat: this.threat, levelName: this.level.name,
      unlockedCastes: CASTES.filter((c) => c !== 'spitter' || this.tech('acid') > 0), zoom: this.cam.z,
    };
  }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    for (const u of this.unbinders) u();
    this.unbinders = [];
    this.onHud = null;
    this.onEnd = null;
    audio.stopMusic();
  }
}

