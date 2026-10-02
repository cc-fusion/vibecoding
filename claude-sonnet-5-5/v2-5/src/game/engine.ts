import {
  AUTO_RECIPE,
  BKind,
  BUILDINGS,
  BUILD_ORDER,
  Cat,
  CATS,
  DIFFS,
  DiffDef,
  DiffId,
  ENEMIES,
  EnemyType,
  ITEMS,
  ITEM_IDS,
  ItemId,
  MACHINE_RECIPES,
  MAP_H,
  MAP_W,
  RECIPES,
  TECHS,
  WIN_WAVE,
} from './defs';
import { audio } from './audio';
import type { Settings } from './save';

export const DX = [1, 0, -1, 0];
export const DY = [0, 1, 0, -1];
export const TILE = 36;
export const BELT_SPEED = 1.7;
export const RAIL_SPEED = 2.6;
export const SPACING = 0.32;
export const DRIFT_K = 0.05;
export const CURVE_K = 0.35;
export const SHIELD_R = 5.5;
export const SHIELD_MAX = 160;
export const STAB_R = 4.5;
export const BATT_CAP = 300;

export interface Item {
  t: ItemId;
  p: number;
  lat: number;
  d: number;
  pd: number;
}
export interface Port {
  x: number;
  y: number;
  d: number;
}
export interface Building {
  id: number;
  kind: BKind;
  x: number;
  y: number;
  w: number;
  h: number;
  dir: number;
  hp: number;
  maxHp: number;
  items: Item[];
  inv: Partial<Record<ItemId, number>>;
  outBuf: ItemId[];
  recipe: string | null;
  sel: number;
  prog: number;
  timer: number;
  rr: number;
  working: boolean;
  blocked: boolean;
  ammoP: number;
  ammoC: number;
  cd: number;
  aim: number;
  tgt: number;
  sh: number;
  shCd: number;
  fuel: number;
  burn: number;
  q: number[];
  hitT: number;
  spawnT: number;
  ports: Port[];
  res: number;
  beam: number;
  beamX: number;
  beamY: number;
  recoil: number;
}
export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ang: number;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  shT: number;
  cd: number;
  tgt: number;
  retarget: number;
  age: number;
  flash: number;
  carry: number;
  carryVal: number;
  steal: number;
  fleeing: boolean;
  dead: boolean;
  gone: boolean;
  phase: number;
  t2: number;
  t3: number;
  t4: number;
  charge: number;
  scale: number;
}
export interface Bullet {
  x: number;
  y: number;
  a: number;
  sp: number;
  w: number;
  dmg: number;
  life: number;
  pierce: number;
  hit: number[];
  col: string;
}
export interface EShot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  bid: number;
  dmg: number;
  sp: number;
  col: string;
  big: boolean;
}
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  glow: boolean;
  drag: number;
}
export interface FText {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
}
export interface Ring {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
  color: string;
}
export interface Meteor {
  x: number;
  y: number;
  t: number;
}
export interface Contract {
  id: number;
  item: ItemId;
  qty: number;
  have: number;
  t: number;
  dur: number;
  reward: number;
  rp: number;
}
export interface Plan {
  n: number;
  comp: Partial<Record<EnemyType, number>>;
  edges: number[];
  boss: boolean;
}
export interface Mods {
  storm: boolean;
  frenzy: boolean;
  brown: boolean;
}
export interface GameOpts {
  diff: DiffId;
  mods: Mods;
  tutorial: boolean;
  upgrades: Record<string, number>;
  settings: Settings;
  seed: number;
}
export interface Stats {
  time: number;
  earned: number;
  spent: number;
  sold: Record<ItemId, number>;
  produced: number;
  kills: number;
  killsBy: Record<string, number>;
  lost: number;
  stolen: number;
  damage: number;
  built: number;
  destroyed: number;
  waves: number;
  contracts: number;
  techs: number;
  rp: number;
  peakPower: number;
  flips: number;
  boss: boolean;
}
export interface SelInfo {
  id: number;
  kind: BKind;
  name: string;
  hp: number;
  maxHp: number;
  status: string;
  recipes: { id: string; name: string; active: boolean; text: string }[];
  lines: string[];
  repairCost: number;
  canDemolish: boolean;
}
export interface HudState {
  credits: number;
  rp: number;
  gen: number;
  dem: number;
  sat: number;
  batt: number;
  cap: number;
  emp: boolean;
  spin: number;
  spinSet: number;
  flipCd: number;
  dirV: number;
  safeRun: number;
  sun: number;
  wave: number;
  waveTimer: number;
  bossWave: boolean;
  waveActive: boolean;
  enemies: number;
  plan: Plan;
  endless: boolean;
  hubHp: number;
  hubMax: number;
  contracts: Contract[];
  market: { item: ItemId; m: number; target: number }[];
  speed: number;
  tool: string;
  rot: number;
  cat: Cat;
  overlay: boolean;
  toasts: { id: number; text: string; color: string }[];
  banner: { text: string; sub: string; color: string } | null;
  tut: { step: number; total: number; title: string; text: string } | null;
  techs: string[];
  sel: SelInfo | null;
  evt: { name: string; t: number } | null;
  score: number;
  time: number;
  repairCost: number;
  status: string;
  rep: number;
  drift: number;
  diff: DiffId;
  mods: Mods;
}
export interface Callbacks {
  onEnd: (kind: 'victory' | 'defeat') => void;
  onMenu: (m: 'pause' | 'tech' | 'help') => void;
  onMute: () => void;
}

const TUT: { title: string; text: string; check: (g: Game) => boolean }[] = [
  { title: 'Look around', text: 'Drag with the left mouse button (Select tool), use WASD / arrows, and scroll to zoom. Coloured patches are resource deposits: rust = iron, teal = copper, pale blue = comet ice.', check: (g) => g.camMoved },
  { title: 'Mine something', text: 'Open the Industry tab (Tab key), pick the Extractor and place it ON a rust-coloured iron deposit.', check: (g) => g.countKind('extractor') > 0 },
  { title: 'Belt it home', text: 'Pick the Conveyor (Logistics) and drag a line from beside your extractor to the Ring Core in the centre. The Core buys everything. Wait for your first sale!', check: (g) => g.totalSold() > 0 },
  { title: 'Keep the lights on', text: 'Machines need power; the Core only provides 6 kW. Build a Solar Array or Spin Dynamo from the Power tab.', check: (g) => g.countKind('solar') + g.countKind('dynamo') > 0 },
  { title: 'Add value: smelt', text: 'Place a Smelter in the line: Extractor → belt → Smelter → belt → Core. Machines output into any adjacent belt. Sell an iron plate to continue.', check: (g) => g.stats.sold.plate > 0 },
  { title: 'Feel the spin', text: 'The ring rotates, so Coriolis drift pushes items to the side of the belt and off empty edges! Hover a belt tool to see the curve preview, then change the Spin slider in Ring Control.', check: (g) => g.spinChanged },
  { title: 'Arm the ring', text: 'Build a Gun Turret (Defense) and feed it iron plates by belt, or place it next to a Smelter. Pirates are coming.', check: (g) => g.blds.some((b) => b.kind === 'turret' && b.ammoP + b.ammoC > 0) },
  { title: 'Research', text: 'Build a Research Lab and feed it plates or ingots. Spend research points in the Tech tree (T).', check: (g) => g.stats.rp > 0 },
  { title: 'Practice raid', text: 'A few skiffs are inbound. Keep them off your ring!', check: (g) => g.tutSpawned && g.enemies.length === 0 },
];

function isBelt(k: BKind) {
  return k === 'conveyor' || k === 'rail' || k === 'junction' || k === 'splitter';
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angDiff = (a: number, b: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export class Game {
  opts: GameOpts;
  diff: DiffDef;
  cb: Callbacks;
  drawFn: (g: Game, ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  vw = 800;
  vh = 600;
  dpr = 1;

  terrain = new Uint8Array(MAP_W * MAP_H);
  grid: (Building | null)[] = new Array(MAP_W * MAP_H).fill(null);
  blds: Building[] = [];
  bmap = new Map<number, Building>();
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  eshots: EShot[] = [];
  parts: Particle[] = [];
  texts: FText[] = [];
  rings: Ring[] = [];
  meteors: Meteor[] = [];
  spawnQ: { t: number; type: EnemyType; edge: number }[] = [];
  contracts: Contract[] = [];
  stab = new Float32Array(MAP_W * MAP_H).fill(1);
  mkt = {} as Record<ItemId, { m: number; target: number; tt: number }>;
  stats: Stats;
  techs = new Set<string>();
  hub!: Building;

  nid = 1;
  time = 0;
  credits = 0;
  rp = 0;
  rep = 0;
  status: 'playing' | 'victory' | 'defeat' = 'playing';
  paused = false;
  speed = 1;
  endless = false;
  victoryDone = false;

  spin = 1;
  spinSet = 1;
  spinDirSet = 1;
  spinDirV = 1;
  flipCd = 0;
  spinChanged = false;
  sunPhase = 1.2;
  sun = 1;
  gen = 0;
  dem = 0;
  sat = 1;
  batt = 150;
  cap = 0;
  emp = 0;
  evt: { type: string; t: number; dur: number; name: string; tick: number } | null = null;
  evtTimer = 80;
  contractTimer = 110;
  nextContractId = 1;

  wave = 0;
  waveTimer = 100;
  waveActive = false;
  bossWave = false;
  plan: Plan;

  tool: BKind | 'select' | 'erase' = 'select';
  cat: Cat = 'logistics';
  rot = 0;
  overlay = true;
  selected: Building | null = null;
  hoverTx = -1;
  hoverTy = -1;
  ghostErr: string | null = null;

  cam = { x: MAP_W / 2, y: MAP_H / 2, zoom: 1 };
  camMoved = false;
  shakeAmt = 0;
  shakeX = 0;
  shakeY = 0;
  tutStep = -1;
  tutSpawned = false;
  banner: { text: string; sub: string; color: string; t: number } | null = null;
  toasts: { id: number; text: string; color: string; t: number }[] = [];
  toastId = 1;
  errT = 0;
  lpAwarded = 0;
  finalLP = 0;

  private raf = 0;
  private lastTs = 0;
  private keys = new Set<string>();
  private panning = false;
  private panLast = { x: 0, y: 0 };
  private placing = false;
  private erasing = false;
  private strokeLast: { x: number; y: number } | null = null;
  private dragTile: { x: number; y: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  private spaceDown = false;
  private mouseX = 0;
  private mouseY = 0;
  private cleanup: (() => void)[] = [];

  constructor(opts: GameOpts, cb: Callbacks, drawFn: Game['drawFn']) {
    this.opts = opts;
    this.cb = cb;
    this.drawFn = drawFn;
    this.diff = DIFFS.find((d) => d.id === opts.diff) || DIFFS[1];
    this.stats = {
      time: 0, earned: 0, spent: 0, sold: {} as Record<ItemId, number>, produced: 0, kills: 0, killsBy: {}, lost: 0, stolen: 0,
      damage: 0, built: 0, destroyed: 0, waves: 0, contracts: 0, techs: 0, rp: 0, peakPower: 0, flips: 0, boss: false,
    };
    for (const id of ITEM_IDS) {
      this.stats.sold[id] = 0;
      this.mkt[id] = { m: 1, target: 1, tt: 0 };
    }
    this.credits = Math.round((opts.tutorial ? 650 : 400 * this.diff.credits) + 120 * this.lvl('capital'));
    if (this.lvl('head') >= 1) this.techs.add('rails');
    if (this.lvl('head') >= 2) this.techs.add('assembly');
    if (opts.mods.frenzy) this.waveTimer = 80;
    this.waveTimer *= this.diff.interval;
    this.genMap(opts.seed);
    this.plan = this.makePlan(1);
    if (opts.tutorial) {
      this.tutStep = 0;
      this.waveTimer = 9999;
    }
    this.fitCamera();
  }

  lvl(id: string) {
    return this.opts.upgrades[id] || 0;
  }

  /* ---------- map ---------- */
  private genMap(seed: number) {
    const rnd = mulberry32(seed);
    const hubX = Math.floor(MAP_W / 2) - 1;
    const hubY = Math.floor(MAP_H / 2) - 1;
    const centers: { x: number; y: number }[] = [];
    const place = (type: number, count: number, rmin: number, rmax: number) => {
      for (let n = 0; n < count; n++) {
        for (let tries = 0; tries < 80; tries++) {
          const ang = rnd() * Math.PI * 2;
          const r = rmin + rnd() * (rmax - rmin);
          const cx = Math.round(hubX + 1 + Math.cos(ang) * r * 1.5);
          const cy = Math.round(hubY + 1 + Math.sin(ang) * r);
          if (cx < 3 || cy < 3 || cx > MAP_W - 4 || cy > MAP_H - 4) continue;
          if (centers.some((c) => Math.hypot(c.x - cx, c.y - cy) < 7)) continue;
          centers.push({ x: cx, y: cy });
          const rad = 1.8 + rnd() * 1.1;
          for (let y = cy - 4; y <= cy + 4; y++)
            for (let x = cx - 4; x <= cx + 4; x++) {
              if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
              const d = Math.hypot(x - cx, y - cy) + (rnd() - 0.5) * 0.8;
              if (d <= rad) this.terrain[y * MAP_W + x] = type;
            }
          break;
        }
      }
    };
    place(1, 3, 6, 10);
    place(2, 3, 6, 11);
    place(3, 2, 7, 11);
    place(1, 1, 11, 14);
    place(2, 1, 11, 14);
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rnd() * MAP_W);
      const y = Math.floor(rnd() * MAP_H);
      if (x >= hubX - 2 && x <= hubX + 4 && y >= hubY - 2 && y <= hubY + 4) continue;
      if (this.terrain[y * MAP_W + x] === 0) this.terrain[y * MAP_W + x] = 4;
    }
    const hub = this.mk('hub', hubX, hubY, 0);
    this.hub = hub;
    this.occupy(hub);
    this.terrain.forEach((t, i) => {
      const x = i % MAP_W;
      const y = Math.floor(i / MAP_W);
      if (t === 4 && x >= hubX && x < hubX + 3 && y >= hubY && y < hubY + 3) this.terrain[i] = 0;
    });
  }

  private mk(kind: BKind, x: number, y: number, dir: number): Building {
    const d = BUILDINGS[kind];
    const maxHp = kind === 'hub' ? Math.round(d.hp * (1 + 0.2 * this.lvl('hull'))) : d.hp;
    const b: Building = {
      id: this.nid++, kind, x, y, w: d.w, h: d.h, dir, hp: maxHp, maxHp, items: [], inv: {}, outBuf: [], recipe: null, sel: 0, prog: 0,
      timer: 0, rr: 0, working: false, blocked: false, ammoP: 0, ammoC: 0, cd: 0, aim: -Math.PI / 2, tgt: -1, sh: kind === 'shield' ? SHIELD_MAX : 0,
      shCd: 0, fuel: 0, burn: 0, q: [], hitT: 0, spawnT: kind === 'hub' ? 0 : 0.3, ports: [], res: 0, beam: 0, beamX: 0, beamY: 0, recoil: 0,
    };
    if (!isBelt(kind)) {
      for (let j = 0; j < d.h; j++)
        for (let i = 0; i < d.w; i++)
          for (let k = 0; k < 4; k++) {
            const nx = x + i + DX[k];
            const ny = y + j + DY[k];
            if (nx >= x && nx < x + d.w && ny >= y && ny < y + d.h) continue;
            if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
            b.ports.push({ x: nx, y: ny, d: k });
          }
    }
    if (kind === 'extractor') b.res = this.terrain[y * MAP_W + x];
    return b;
  }

  private occupy(b: Building) {
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) this.grid[(b.y + j) * MAP_W + b.x + i] = b;
    this.blds.push(b);
    this.bmap.set(b.id, b);
  }

  fitCamera() {
    const fit = Math.min(this.vw / (MAP_W * TILE), this.vh / (MAP_H * TILE));
    this.cam.zoom = clamp(fit * 1.05, 0.7, 1.3);
    this.cam.x = MAP_W / 2;
    this.cam.y = MAP_H / 2;
  }

  /* ---------- helpers ---------- */
  get S() {
    return TILE * this.cam.zoom;
  }
  toWorld(sx: number, sy: number) {
    return { x: (sx - this.vw / 2) / this.S + this.cam.x, y: (sy - this.vh / 2) / this.S + this.cam.y };
  }
  toScreen(wx: number, wy: number) {
    return { x: (wx - this.cam.x) * this.S + this.vw / 2, y: (wy - this.cam.y) * this.S + this.vh / 2 };
  }
  at(x: number, y: number): Building | null {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
    return this.grid[y * MAP_W + x];
  }
  countKind(k: BKind) {
    let n = 0;
    for (const b of this.blds) if (b.kind === k) n++;
    return n;
  }
  totalSold() {
    let n = 0;
    for (const id of ITEM_IDS) n += this.stats.sold[id];
    return n;
  }
  unlocked(k: BKind) {
    const t = BUILDINGS[k].tech;
    return !t || this.techs.has(t);
  }
  get driftMul() {
    return (this.opts.mods.storm ? 1.6 : 1) * (1 - 0.08 * this.lvl('gyro')) * (this.evt?.type === 'instab' ? 2 : 1);
  }
  get driftRate() {
    return DRIFT_K * this.spin * this.spinDirV * this.driftMul;
  }
  get curveW() {
    return CURVE_K * this.spin * this.spinDirV;
  }
  get machineSpeed() {
    return this.techs.has('overclock') ? 1.25 : 1;
  }
  toast(text: string, color = '#e2e8f0') {
    this.toasts.push({ id: this.toastId++, text, color, t: 4.5 });
    if (this.toasts.length > 5) this.toasts.shift();
  }
  setBanner(text: string, sub: string, color: string) {
    this.banner = { text, sub, color, t: 3.4 };
  }
  shake(a: number) {
    if (!this.opts.settings.shake) return;
    this.shakeAmt = Math.min(24, this.shakeAmt + a);
  }
  private pn(n: number) {
    return this.opts.settings.quality === 'low' ? Math.max(1, Math.ceil(n * 0.4)) : n;
  }
  burst(x: number, y: number, n: number, color: string, speed = 3, life = 0.6, size = 3, glow = true) {
    const c = this.pn(n);
    for (let i = 0; i < c && this.parts.length < 800; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.9);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.7), max: life, size: size * (0.5 + Math.random()), color, glow, drag: 2 });
    }
  }
  ring(x: number, y: number, r: number, color: string, life = 0.5) {
    if (this.rings.length < 60) this.rings.push({ x, y, r, life, max: life, color });
  }
  ftext(x: number, y: number, text: string, color = '#fff', size = 13) {
    if (this.texts.length > 90) this.texts.shift();
    this.texts.push({ x, y, text, life: 1.1, max: 1.1, color, size });
  }

  /* ---------- building ---------- */
  canPlace(kind: BKind, x: number, y: number): string | null {
    const d = BUILDINGS[kind];
    if (kind === 'hub') return 'Cannot build';
    if (!this.unlocked(kind)) return 'Locked: research required';
    if (x < 0 || y < 0 || x + d.w > MAP_W || y + d.h > MAP_H) return 'Out of bounds';
    for (let j = 0; j < d.h; j++)
      for (let i = 0; i < d.w; i++) {
        if (this.terrain[(y + j) * MAP_W + x + i] === 4) return 'Blocked by debris';
        const o = this.grid[(y + j) * MAP_W + x + i];
        if (o && !(isBelt(kind) && isBelt(o.kind))) return 'Tile occupied';
      }
    if (kind === 'extractor') {
      const t = this.terrain[y * MAP_W + x];
      if (t < 1 || t > 3) return 'Extractor needs a deposit';
    }
    if (this.credits < d.cost) return 'Not enough credits';
    return null;
  }

  place(kind: BKind, x: number, y: number, dir: number): boolean {
    const ex = this.at(x, y);
    if (ex && ex.kind === kind && (kind === 'conveyor' || kind === 'rail')) {
      if (ex.dir !== dir) {
        ex.dir = dir;
        audio.sfx('ui', 1.4);
      }
      return true;
    }
    const err = this.canPlace(kind, x, y);
    if (err) {
      if (this.errT <= 0) {
        this.toast(err, '#fca5a5');
        audio.sfx('error');
        this.errT = 0.5;
      }
      return false;
    }
    if (ex) this.removeBuilding(ex, true);
    const b = this.mk(kind, x, y, dir);
    this.occupy(b);
    const cost = BUILDINGS[kind].cost;
    this.credits -= cost;
    this.stats.spent += cost;
    this.stats.built++;
    const c = this.toScreenless(b);
    this.burst(c.x, c.y, 6, BUILDINGS[kind].color, 2, 0.4, 2.5);
    this.ring(c.x, c.y, 0.9, BUILDINGS[kind].color, 0.35);
    audio.sfx('place', 0.9 + Math.random() * 0.3);
    return true;
  }

  private toScreenless(b: Building) {
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  }

  removeBuilding(b: Building, silent = false) {
    for (let j = 0; j < b.h; j++) for (let i = 0; i < b.w; i++) this.grid[(b.y + j) * MAP_W + b.x + i] = null;
    this.blds = this.blds.filter((o) => o !== b);
    this.bmap.delete(b.id);
    if (this.selected === b) this.selected = null;
    if (!silent) {
      const c = this.toScreenless(b);
      this.burst(c.x, c.y, 5, '#94a3b8', 1.5, 0.3, 2);
    }
  }

  demolish(b: Building) {
    if (b.kind === 'hub') return;
    const refund = Math.floor(BUILDINGS[b.kind].cost * 0.6 * (b.hp / b.maxHp));
    this.credits += refund;
    const c = this.toScreenless(b);
    if (refund > 0) this.ftext(c.x, c.y - 0.5, '+' + refund, '#fde68a', 12);
    this.removeBuilding(b);
    audio.sfx('remove');
  }

  repairCostOf(b: Building) {
    const miss = 1 - b.hp / b.maxHp;
    if (miss <= 0.001) return 0;
    if (b.kind === 'hub') return Math.ceil((b.maxHp - b.hp) * 0.35);
    return Math.max(1, Math.ceil(miss * BUILDINGS[b.kind].cost * 0.5));
  }

  repair(b: Building) {
    const c = this.repairCostOf(b);
    if (c <= 0) return;
    if (this.credits < c) {
      this.toast('Not enough credits to repair', '#fca5a5');
      audio.sfx('error');
      return;
    }
    this.credits -= c;
    this.stats.spent += c;
    b.hp = b.maxHp;
    const p = this.toScreenless(b);
    this.burst(p.x, p.y, 8, '#86efac', 2, 0.5, 2.5);
    this.ftext(p.x, p.y - 0.6, 'Repaired', '#86efac', 12);
    audio.sfx('repair');
  }

  repairAll() {
    let total = 0;
    for (const b of this.blds) total += this.repairCostOf(b);
    if (total <= 0) return;
    if (this.credits < total) {
      this.toast(`Repair all costs ${total}c`, '#fca5a5');
      audio.sfx('error');
      return;
    }
    for (const b of this.blds) this.repair(b);
  }

  setRecipe(b: Building, idx: number) {
    const list = MACHINE_RECIPES[b.kind];
    if (!list || idx < 0 || idx >= list.length) return;
    b.sel = idx;
    b.inv = {};
    b.recipe = null;
    b.prog = 0;
    audio.sfx('ui');
  }

  buyTech(id: string) {
    const t = TECHS.find((x) => x.id === id);
    if (!t || this.techs.has(id)) return;
    if (!t.req.every((r) => this.techs.has(r))) {
      audio.sfx('error');
      return;
    }
    if (this.rp < t.cost) {
      this.toast('Not enough research points', '#fca5a5');
      audio.sfx('error');
      return;
    }
    this.rp -= t.cost;
    this.techs.add(id);
    this.stats.techs++;
    this.toast(`Researched: ${t.name}`, '#c4b5fd');
    audio.sfx('research');
  }

  /* ---------- controls API ---------- */
  setTool(t: BKind | 'select' | 'erase') {
    if (t !== 'select' && t !== 'erase') {
      if (!this.unlocked(t)) {
        this.toast('Locked: research ' + (TECHS.find((x) => x.id === BUILDINGS[t].tech)?.name || 'required'), '#fca5a5');
        audio.sfx('error');
        return;
      }
      this.cat = BUILDINGS[t].cat;
    }
    this.tool = t;
    if (t !== 'select') this.selected = null;
    audio.sfx('ui', 1.2);
  }
  setCat(c: Cat) {
    this.cat = c;
    audio.sfx('ui');
  }
  setSpin(v: number) {
    this.spinSet = clamp(v, 0.4, 3);
    this.spinChanged = true;
  }
  flipSpin() {
    if (this.flipCd > 0) {
      this.toast(`Spin reversal recharging (${Math.ceil(this.flipCd)}s)`, '#fca5a5');
      audio.sfx('error');
      return;
    }
    this.spinDirSet = -this.spinDirSet;
    this.flipCd = 20;
    this.stats.flips++;
    this.spinChanged = true;
    this.shake(8);
    this.toast(this.spinDirSet > 0 ? 'Ring spin: CLOCKWISE — drift pushes right' : 'Ring spin: COUNTER-CLOCKWISE — drift pushes left', '#7dd3fc');
    audio.sfx('flip');
  }
  cycleSpeed() {
    this.speed = this.speed >= 3 ? 1 : this.speed + 1;
    audio.sfx('ui');
  }
  zoomBy(f: number) {
    this.cam.zoom = clamp(this.cam.zoom * f, 0.45, 2.6);
    this.camMoved = true;
  }
  callRaid() {
    if (this.tutStep >= 0) {
      this.toast('Finish the tutorial first', '#fca5a5');
      return;
    }
    if (this.bossWave || this.waveTimer < 4 || this.status !== 'playing') return;
    const bonus = Math.floor(this.waveTimer * 1.5);
    this.credits += bonus;
    this.ftext(this.hub.x + 1.5, this.hub.y - 1, `+${bonus} early bonus`, '#fde68a', 14);
    this.waveTimer = 0;
  }
  continueEndless() {
    this.status = 'playing';
    this.endless = true;
    this.plan = this.makePlan(this.wave + 1);
    this.waveTimer = this.interval(this.wave);
    this.toast('Endless mode: raids keep escalating. Bosses return every 5 waves.', '#fde68a');
  }
  setDiff(id: DiffId) {
    const d = DIFFS.find((x) => x.id === id);
    if (!d) return;
    this.diff = d;
    this.opts.diff = id;
    this.plan = this.makePlan(this.plan.n);
    this.toast(`Difficulty set to ${d.name}`, '#7dd3fc');
  }
  setMod(id: keyof Mods, v: boolean) {
    this.opts.mods = { ...this.opts.mods, [id]: v };
  }
  skipTutorial() {
    if (this.tutStep < 0) return;
    this.tutStep = -1;
    this.waveTimer = 70 * this.diff.interval;
    this.toast('Tutorial skipped. First raid approaching!', '#fde68a');
  }

  /* ---------- attach / input ---------- */
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const c = canvas;
    const onDown = (e: PointerEvent) => this.pDown(e);
    const onMove = (e: PointerEvent) => this.pMove(e);
    const onUp = (e: PointerEvent) => this.pUp(e);
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = c.getBoundingClientRect();
      const mx = e.clientX - r.left;
      const my = e.clientY - r.top;
      const before = this.toWorld(mx, my);
      this.cam.zoom = clamp(this.cam.zoom * Math.exp(-e.deltaY * 0.0012), 0.45, 2.6);
      const after = this.toWorld(mx, my);
      this.cam.x += before.x - after.x;
      this.cam.y += before.y - after.y;
      this.camMoved = true;
    };
    const onCtx = (e: Event) => e.preventDefault();
    const onKeyDown = (e: KeyboardEvent) => this.kDown(e);
    const onKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
      if (e.code === 'Space') this.spaceDown = false;
    };
    const onVis = () => {
      if (document.hidden && !this.paused && this.status === 'playing') this.cb.onMenu('pause');
    };
    const onBlur = () => this.keys.clear();
    c.addEventListener('pointerdown', onDown);
    c.addEventListener('pointermove', onMove);
    c.addEventListener('pointerup', onUp);
    c.addEventListener('pointercancel', onUp);
    c.addEventListener('wheel', onWheel, { passive: false });
    c.addEventListener('contextmenu', onCtx);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    this.cleanup.push(() => {
      c.removeEventListener('pointerdown', onDown);
      c.removeEventListener('pointermove', onMove);
      c.removeEventListener('pointerup', onUp);
      c.removeEventListener('pointercancel', onUp);
      c.removeEventListener('wheel', onWheel);
      c.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
    });
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  detach() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
    audio.intensity = 0;
    this.canvas = null;
    this.ctx = null;
  }

  resize(w: number, h: number, dpr: number) {
    const first = this.vw === 800 && this.vh === 600;
    this.vw = Math.max(200, w);
    this.vh = Math.max(200, h);
    this.dpr = dpr;
    if (this.canvas) {
      this.canvas.width = Math.floor(this.vw * dpr);
      this.canvas.height = Math.floor(this.vh * dpr);
    }
    if (first) this.fitCamera();
  }

  private local(e: PointerEvent) {
    const r = this.canvas!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private tileAt(sx: number, sy: number) {
    const w = this.toWorld(sx, sy);
    return { x: Math.floor(w.x), y: Math.floor(w.y) };
  }

  private pDown(e: PointerEvent) {
    if (!this.canvas) return;
    audio.ensure();
    audio.startMusic();
    const p = this.local(e);
    this.mouseX = p.x;
    this.mouseY = p.y;
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      this.placing = false;
      this.erasing = false;
      this.panning = false;
      const [a, b] = [...this.pointers.values()];
      this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
      return;
    }
    if (this.paused) return;
    const t = this.tileAt(p.x, p.y);
    if (e.button === 1 || (e.button === 0 && this.spaceDown)) {
      this.panning = true;
      this.panLast = p;
      return;
    }
    if (e.button === 2) {
      this.erasing = true;
      this.eraseAt(t.x, t.y);
      return;
    }
    if (e.button !== 0) return;
    if (this.tool === 'select') {
      const b = this.at(t.x, t.y);
      if (b) {
        this.selected = b;
        audio.sfx('ui', 1.3);
      } else {
        this.selected = null;
        this.panning = true;
        this.panLast = p;
      }
    } else if (this.tool === 'erase') {
      this.erasing = true;
      this.eraseAt(t.x, t.y);
    } else {
      this.placing = true;
      this.strokeLast = null;
      this.dragTile = t;
      this.placeAt(t.x, t.y, true);
    }
  }

  private pMove(e: PointerEvent) {
    if (!this.canvas) return;
    const p = this.local(e);
    this.mouseX = p.x;
    this.mouseY = p.y;
    const t = this.tileAt(p.x, p.y);
    this.hoverTx = t.x;
    this.hoverTy = t.y;
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch > 0 && d > 0) this.zoomBy(d / this.pinch);
      this.pinch = d;
      return;
    }
    if (this.panning) {
      this.cam.x -= (p.x - this.panLast.x) / this.S;
      this.cam.y -= (p.y - this.panLast.y) / this.S;
      this.panLast = p;
      this.camMoved = true;
      return;
    }
    if (this.paused) return;
    if (this.erasing) {
      this.eraseAt(t.x, t.y);
    } else if (this.placing && this.dragTile && (t.x !== this.dragTile.x || t.y !== this.dragTile.y)) {
      let cx = this.dragTile.x;
      let cy = this.dragTile.y;
      let guard = 0;
      while ((cx !== t.x || cy !== t.y) && guard++ < 80) {
        if (Math.abs(t.x - cx) >= Math.abs(t.y - cy)) cx += Math.sign(t.x - cx);
        else cy += Math.sign(t.y - cy);
        this.placeAt(cx, cy, false);
      }
      this.dragTile = { x: cx, y: cy };
    }
  }

  private pUp(e: PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
    this.panning = false;
    this.placing = false;
    this.erasing = false;
    this.strokeLast = null;
    this.dragTile = null;
  }

  private eraseAt(x: number, y: number) {
    const b = this.at(x, y);
    if (b && b.kind !== 'hub') this.demolish(b);
  }

  private placeAt(x: number, y: number, first: boolean) {
    const kind = this.tool as BKind;
    if (kind === 'conveyor' || kind === 'rail') {
      if (this.strokeLast && !first) {
        const dx = x - this.strokeLast.x;
        const dy = y - this.strokeLast.y;
        if (Math.abs(dx) + Math.abs(dy) === 1) {
          const d = dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
          this.rot = d;
          const lb = this.at(this.strokeLast.x, this.strokeLast.y);
          if (lb && (lb.kind === 'conveyor' || lb.kind === 'rail')) lb.dir = d;
        }
      }
      const ok = this.place(kind, x, y, this.rot);
      if (ok) this.strokeLast = { x, y };
    } else {
      this.place(kind, x, y, this.rot);
    }
  }

  private kDown(e: KeyboardEvent) {
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.tagName === 'SELECT')) return;
    if (tg && tg.tagName === 'BUTTON' && !this.paused && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      tg.blur();
    }
    if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
    this.keys.add(e.code);
    audio.ensure();
    if (e.code === 'Space') {
      this.spaceDown = true;
      e.preventDefault();
    }
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (e.code === 'Escape' && (this.tool !== 'select' || this.selected) && !this.paused) {
        this.tool = 'select';
        this.selected = null;
      } else this.cb.onMenu('pause');
      return;
    }
    if (this.paused) return;
    if (e.code === 'KeyT') this.cb.onMenu('tech');
    else if (e.code === 'KeyH' || e.code === 'F1') {
      e.preventDefault();
      this.cb.onMenu('help');
    } else if (e.code === 'KeyQ') this.setTool('select');
    else if (e.code === 'KeyX') this.setTool('erase');
    else if (e.code === 'KeyR') this.rot = (this.rot + (e.shiftKey ? 3 : 1)) & 3;
    else if (e.code === 'Tab') {
      e.preventDefault();
      const i = CATS.findIndex((c) => c.id === this.cat);
      this.setCat(CATS[(i + 1) % CATS.length].id);
    } else if (e.code === 'KeyV') this.overlay = !this.overlay;
    else if (e.code === 'KeyM') this.cb.onMute();
    else if (e.code === 'KeyF') this.flipSpin();
    else if (e.code === 'KeyN') this.callRaid();
    else if (e.code === 'KeyE') this.cycleSpeed();
    else if (e.code === 'BracketRight') this.setSpin(this.spinSet + 0.1);
    else if (e.code === 'BracketLeft') this.setSpin(this.spinSet - 0.1);
    else if (e.code === 'Equal' || e.code === 'NumpadAdd') this.zoomBy(1.15);
    else if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.zoomBy(1 / 1.15);
    else if ((e.code === 'Delete' || e.code === 'Backspace') && this.selected) this.demolish(this.selected);
    else if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10);
      const list = this.catList(this.cat);
      if (n >= 1 && n <= list.length) this.setTool(list[n - 1]);
    }
  }

  catList(c: Cat): BKind[] {
    return BUILD_ORDER.filter((k) => BUILDINGS[k].cat === c);
  }

  /* ---------- main loop ---------- */
  private loop = (ts: number) => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (ts - this.lastTs) / 1000) || 0);
    this.lastTs = ts;
    this.frame(dt);
    if (this.ctx) {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawFn(this, this.ctx, this.vw, this.vh);
    }
  };

  private frame(dt: number) {
    this.errT = Math.max(0, this.errT - dt);
    // camera pan
    const k = this.keys;
    let px = 0;
    let py = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) px -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) px += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) py -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) py += 1;
    if (px || py) {
      const sp = (16 / this.cam.zoom) * dt;
      this.cam.x = clamp(this.cam.x + px * sp, 0, MAP_W);
      this.cam.y = clamp(this.cam.y + py * sp, 0, MAP_H);
      this.camMoved = true;
    }
    this.cam.x = clamp(this.cam.x, -4, MAP_W + 4);
    this.cam.y = clamp(this.cam.y, -4, MAP_H + 4);
    // hover
    const t = this.tileAt(this.mouseX, this.mouseY);
    this.hoverTx = t.x;
    this.hoverTy = t.y;
    this.ghostErr = null;
    if (this.tool !== 'select' && this.tool !== 'erase') {
      const ex = this.at(t.x, t.y);
      if (!(ex && ex.kind === this.tool && (this.tool === 'conveyor' || this.tool === 'rail'))) this.ghostErr = this.canPlace(this.tool, t.x, t.y);
    }
    if (this.paused) return;
    // visual fx always (even on end screens)
    this.fxUpdate(dt);
    if (this.status === 'playing') {
      let rem = dt * this.speed;
      while (rem > 1e-6) {
        const s = Math.min(0.04, rem);
        this.step(s);
        rem -= s;
        if (this.status !== 'playing') break;
      }
    }
    audio.setIntensity(Math.min(1, this.enemies.length / 10 + (this.waveActive ? 0.25 : 0) + (this.emp > 0 ? 0.2 : 0)), this.spin);
  }

  private fxUpdate(dt: number) {
    this.shakeAmt *= Math.exp(-dt * 7);
    if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    this.shakeX = (Math.random() - 0.5) * this.shakeAmt;
    this.shakeY = (Math.random() - 0.5) * this.shakeAmt;
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.texts) {
      f.life -= dt;
      f.y -= dt * 0.9;
    }
    this.texts = this.texts.filter((f) => f.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
  }

  /* ---------- simulation ---------- */
  private step(dt: number) {
    this.time += dt;
    this.stats.time = this.time;
    // spin & sun
    this.spin += (this.spinSet - this.spin) * Math.min(1, dt * 1.5);
    const dd = this.spinDirSet - this.spinDirV;
    this.spinDirV += clamp(dd, -0.9 * dt, 0.9 * dt);
    this.flipCd = Math.max(0, this.flipCd - dt);
    this.sunPhase += dt * this.spin * 0.15;
    this.sun = clamp(Math.sin(this.sunPhase) * 1.6 + 0.3, 0, 1) * (this.evt?.type === 'flare' ? 0.1 : 1);
    this.emp = Math.max(0, this.emp - dt);
    this.updateStab();
    this.updatePower(dt);
    for (const b of this.blds) {
      b.hitT = Math.max(0, b.hitT - dt);
      b.spawnT = Math.max(0, b.spawnT - dt);
      this.updateBuilding(b, dt);
    }
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateWaves(dt);
    this.updateEvents(dt);
    this.updateContracts(dt);
    this.updateMarket(dt);
    this.updateRepairs(dt);
    this.updateTutorial();
    this.meteorsUpdate(dt);
    if (this.hub.hp <= 0 && this.status === 'playing') this.lose();
  }

  private updateStab() {
    this.stab.fill(1);
    for (const b of this.blds) {
      if (b.kind !== 'stabilizer') continue;
      const eff = this.emp > 0 ? 0 : 0.75 * clamp(this.sat * 1.2, 0, 1);
      const f = 1 - eff;
      const r = Math.ceil(STAB_R);
      for (let y = b.y - r; y <= b.y + r; y++)
        for (let x = b.x - r; x <= b.x + r; x++) {
          if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
          if (Math.hypot(x - b.x, y - b.y) <= STAB_R) {
            const i = y * MAP_W + x;
            if (f < this.stab[i]) this.stab[i] = f;
          }
        }
    }
  }

  private updatePower(dt: number) {
    let gen = 6;
    let dem = 0;
    let cap = 0;
    for (const b of this.blds) {
      switch (b.kind) {
        case 'solar':
          gen += 12 * this.sun;
          break;
        case 'dynamo':
          gen += 8 * this.spin;
          break;
        case 'reactor':
          if (b.fuel > 0) gen += 40;
          break;
        case 'battery':
          cap += BATT_CAP;
          break;
        default: {
          const p = BUILDINGS[b.kind].power;
          if (p > 0) dem += p * (b.working ? 1 : 0.15);
        }
      }
    }
    gen *= (this.opts.mods.brown ? 0.75 : 1) * (1 + 0.1 * this.lvl('dynamo'));
    this.gen = gen;
    this.dem = dem;
    this.cap = cap;
    this.batt = Math.min(this.batt, cap);
    this.stats.peakPower = Math.max(this.stats.peakPower, gen);
    let sat = 1;
    if (gen >= dem) {
      this.batt = Math.min(cap, this.batt + (gen - dem) * dt);
    } else if (dem > 0) {
      const deficit = dem - gen;
      const dis = Math.min(deficit, this.batt / Math.max(dt, 1e-4), 80);
      this.batt = Math.max(0, this.batt - dis * dt);
      sat = (gen + dis) / dem;
    }
    if (this.emp > 0) sat = 0;
    if (sat < 0.4 && this.sat >= 0.4 && dem > 0 && this.time > 5) {
      this.toast('Brownout! Machines are slowing down', '#fbbf24');
      audio.sfx('powerdown');
    }
    this.sat = clamp(sat, 0, 1);
  }

  private updateRepairs(dt: number) {
    const nano = this.techs.has('nanite');
    for (const b of this.blds) {
      if (b.hp >= b.maxHp) continue;
      const rate = b.kind === 'hub' ? (nano ? 4 : 0.6) : nano ? 1.2 : 0;
      b.hp = Math.min(b.maxHp, b.hp + rate * dt * (b.kind === 'hub' ? 1 : b.maxHp / 60));
    }
  }

  /* ---- items & transport ---- */
  accepts(b: Building, it: ItemId): boolean {
    switch (b.kind) {
      case 'hub':
      case 'dock':
        return true;
      case 'lab':
        return ITEMS[it].rp > 0 && b.q.length < 4;
      case 'turret':
        return (it === 'plate' || it === 'circuit') && b.ammoP + b.ammoC < 20;
      case 'reactor':
        return it === 'cell' && b.fuel < 6;
      case 'smelter':
      case 'centrifuge':
      case 'electrolyzer':
      case 'assembler':
      case 'fabricator': {
        const cands = this.candidates(b);
        let need = 0;
        for (const r of cands) need = Math.max(need, RECIPES[r].inputs[it] || 0);
        return need > 0 && (b.inv[it] || 0) < Math.max(need * 2, 3);
      }
      default:
        return false;
    }
  }

  private candidates(b: Building): string[] {
    const list = MACHINE_RECIPES[b.kind] || [];
    return AUTO_RECIPE.includes(b.kind) ? list : [list[b.sel] ?? list[0]].filter(Boolean);
  }

  private accept(b: Building, it: ItemId) {
    switch (b.kind) {
      case 'hub':
      case 'dock':
        this.sell(it, b);
        break;
      case 'lab':
        b.q.push(ITEMS[it].rp * (1 + 0.12 * this.lvl('study')));
        break;
      case 'turret':
        if (it === 'plate') b.ammoP += 8;
        else b.ammoC += 5;
        break;
      case 'reactor':
        b.fuel++;
        break;
      default:
        b.inv[it] = (b.inv[it] || 0) + 1;
    }
  }

  private sell(it: ItemId, b: Building) {
    const m = this.mkt[it];
    const price = ITEMS[it].value * m.m * (this.techs.has('trade') ? 1.15 : 1) * (1 + 0.01 * Math.min(15, this.rep));
    this.credits += price;
    this.stats.earned += price;
    this.stats.sold[it]++;
    m.m = Math.max(0.4, m.m - 0.012);
    const c = this.toScreenless(b);
    this.ftext(c.x + (Math.random() - 0.5) * 0.8, c.y - b.h / 2 - 0.2, '+' + Math.max(1, Math.round(price)), '#fde68a', 11);
    if (Math.random() < 0.3) this.burst(c.x, c.y, 2, ITEMS[it].color, 1.5, 0.3, 2);
    audio.sfx('sell', 0.9 + Math.random() * 0.4);
    for (const k of this.contracts) {
      if (k.item === it && k.have < k.qty) {
        k.have++;
        if (k.have >= k.qty) this.completeContract(k);
        break;
      }
    }
  }

  pushTo(tx: number, ty: number, it: { t: ItemId; lat: number }, heading: number, keepLat: boolean): boolean {
    const tb = this.at(tx, ty);
    if (!tb) return false;
    switch (tb.kind) {
      case 'conveyor':
      case 'rail': {
        if (tb.dir === ((heading + 2) & 3)) return false;
        for (const o of tb.items) if (o.p < SPACING) return false;
        tb.items.push({ t: it.t, p: 0, lat: keepLat ? it.lat : 0, d: tb.dir, pd: heading });
        return true;
      }
      case 'junction':
      case 'splitter': {
        if (tb.items.length >= 6) return false;
        for (const o of tb.items) if (o.pd === heading && o.p < SPACING) return false;
        tb.items.push({ t: it.t, p: 0, lat: keepLat ? it.lat : 0, d: heading, pd: heading });
        return true;
      }
      default:
        if (this.accepts(tb, it.t)) {
          this.accept(tb, it.t);
          return true;
        }
        return false;
    }
  }

  private lose_item(x: number, y: number, it: ItemId) {
    this.stats.lost++;
    this.burst(x, y, 4, ITEMS[it].color, 2, 0.5, 2);
    if (Math.random() < 0.5) this.ftext(x, y, 'lost', '#f87171', 10);
    audio.sfx('lost');
  }

  private updateBelt(b: Building, dt: number) {
    const its = b.items;
    if (!its.length) return;
    const rail = b.kind === 'rail';
    const sp = rail ? RAIL_SPEED : BELT_SPEED;
    const drift = this.driftRate * this.stab[b.y * MAP_W + b.x];
    let eject = -1;
    for (let i = 0; i < its.length; i++) {
      const it = its[i];
      const limit = i === 0 ? 1 : its[i - 1].p - SPACING;
      let np = it.p + sp * dt;
      if (np > limit) np = Math.max(it.p, limit);
      const mv = np - it.p;
      it.p = np;
      if (rail) {
        it.lat *= Math.max(0, 1 - 5 * dt);
      } else {
        it.lat += drift * mv;
        if (Math.abs(it.lat) >= 0.5 && eject < 0) eject = i;
        else it.lat = clamp(it.lat, -0.5, 0.5);
      }
    }
    if (eject >= 0) {
      const it = its[eject];
      const side = it.lat > 0 ? 1 : -1;
      const heading = (it.d + (side > 0 ? 1 : 3)) & 3;
      const tx = b.x + DX[heading];
      const ty = b.y + DY[heading];
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || !this.at(tx, ty)) {
        its.splice(eject, 1);
        this.lose_item(b.x + 0.5 + DX[heading] * 0.5, b.y + 0.5 + DY[heading] * 0.5, it.t);
      } else if (this.pushTo(tx, ty, it, heading, false)) {
        its.splice(eject, 1);
      } else {
        it.lat = side * 0.49;
      }
    }
    const f = its[0];
    if (f && f.p >= 0.999) {
      if (this.pushTo(b.x + DX[b.dir], b.y + DY[b.dir], f, b.dir, true)) its.shift();
    }
  }

  private updateJunction(b: Building, dt: number) {
    const its = b.items;
    if (!its.length) return;
    const sp = BELT_SPEED * 1.25;
    for (const it of its) {
      let limit = 1;
      for (const o of its) if (o !== it && o.pd === it.pd && o.p > it.p) limit = Math.min(limit, o.p - SPACING);
      it.p = Math.min(Math.max(it.p, limit), it.p + sp * dt);
    }
    for (let i = its.length - 1; i >= 0; i--) {
      const it = its[i];
      if (it.p < 0.999) continue;
      if (b.kind === 'junction') {
        if (this.pushTo(b.x + DX[it.pd], b.y + DY[it.pd], it, it.pd, true)) its.splice(i, 1);
      } else {
        const outs = [it.pd, (it.pd + 1) & 3, (it.pd + 3) & 3];
        for (let k = 0; k < 3; k++) {
          const h = outs[(b.rr + k) % 3];
          if (this.pushTo(b.x + DX[h], b.y + DY[h], it, h, true)) {
            its.splice(i, 1);
            b.rr = (b.rr + k + 1) % 3;
            break;
          }
        }
      }
    }
  }

  private tryOutput(b: Building) {
    if (!b.outBuf.length || !b.ports.length) return;
    const n = b.ports.length;
    for (let k = 0; k < n; k++) {
      const idx = (b.rr + k) % n;
      const p = b.ports[idx];
      if (this.pushTo(p.x, p.y, { t: b.outBuf[0], lat: 0 }, p.d, false)) {
        b.outBuf.shift();
        b.rr = (idx + 1) % n;
        b.blocked = false;
        return;
      }
    }
    b.blocked = b.outBuf.length >= 3;
  }

  private nearestEnemy(x: number, y: number, range: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = range;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  private updateBuilding(b: Building, dt: number) {
    const sat = this.sat;
    const ms = this.machineSpeed;
    switch (b.kind) {
      case 'conveyor':
      case 'rail':
        this.updateBelt(b, dt);
        return;
      case 'junction':
      case 'splitter':
        this.updateJunction(b, dt);
        return;
      case 'extractor': {
        if (b.outBuf.length < 3 && b.res > 0) {
          b.working = true;
          b.prog += dt * sat * ms * 0.55;
          if (b.prog >= 1) {
            b.prog = 0;
            b.outBuf.push(b.res === 1 ? 'ore_fe' : b.res === 2 ? 'ore_cu' : 'ice');
            this.stats.produced++;
            if (Math.random() < 0.4) this.burst(b.x + 0.5, b.y + 0.5, 2, ITEMS[b.outBuf[b.outBuf.length - 1]].color, 1.2, 0.3, 2);
          }
        } else b.working = false;
        this.tryOutput(b);
        return;
      }
      case 'smelter':
      case 'centrifuge':
      case 'electrolyzer':
      case 'assembler':
      case 'fabricator': {
        const spd = sat * ms * (b.kind === 'centrifuge' ? 1 + this.spin * 0.9 : 1);
        if (!b.recipe) {
          b.working = false;
          if (b.outBuf.length < 3) {
            for (const id of this.candidates(b)) {
              const r = RECIPES[id];
              let ok = true;
              for (const k of Object.keys(r.inputs) as ItemId[]) if ((b.inv[k] || 0) < (r.inputs[k] || 0)) ok = false;
              if (ok) {
                for (const k of Object.keys(r.inputs) as ItemId[]) b.inv[k] = (b.inv[k] || 0) - (r.inputs[k] || 0);
                b.recipe = id;
                b.prog = 0;
                break;
              }
            }
          }
        }
        if (b.recipe) {
          const r = RECIPES[b.recipe];
          b.working = true;
          b.prog += (dt * spd) / r.time;
          if (b.prog >= 1) {
            for (let i = 0; i < r.outQty; i++) b.outBuf.push(r.output);
            b.recipe = null;
            b.prog = 0;
            this.stats.produced++;
            if (Math.random() < 0.5) this.burst(b.x + 0.5, b.y + 0.5, 3, ITEMS[r.output].color, 1.5, 0.35, 2);
          }
        }
        this.tryOutput(b);
        return;
      }
      case 'lab': {
        if (b.q.length) {
          b.working = true;
          b.prog += (dt * sat * ms) / 1.5;
          if (b.prog >= 1) {
            b.prog = 0;
            const v = b.q.shift() || 0;
            this.rp += v;
            this.stats.rp += v;
            this.ftext(b.x + 0.5, b.y - 0.1, '+' + (v >= 10 ? v.toFixed(0) : v.toFixed(1)) + ' RP', '#c4b5fd', 11);
          }
        } else b.working = false;
        return;
      }
      case 'reactor':
        if (b.fuel > 0) {
          b.burn += dt;
          if (b.burn >= 6) {
            b.burn = 0;
            b.fuel--;
          }
        }
        return;
      case 'turret':
        this.updateTurret(b, dt);
        return;
      case 'laser':
        this.updateLaser(b, dt);
        return;
      case 'shield':
        b.working = true;
        b.shCd = Math.max(0, b.shCd - dt);
        if (b.shCd <= 0 && b.sh < SHIELD_MAX) b.sh = Math.min(SHIELD_MAX, b.sh + 14 * sat * dt);
        return;
      case 'stabilizer':
        b.working = true;
        return;
      default:
        return;
    }
  }

  private dmgMul() {
    return 1 + 0.12 * this.lvl('ordnance');
  }

  private updateTurret(b: Building, dt: number) {
    b.cd -= dt;
    b.recoil = Math.max(0, b.recoil - dt * 6);
    b.timer -= dt;
    const cx = b.x + 0.5;
    const cy = b.y + 0.5;
    const range = 6.5;
    if (b.timer <= 0) {
      b.timer = 0.15;
      const e = this.nearestEnemy(cx, cy, range);
      b.tgt = e ? e.id : -1;
    }
    const e = this.enemies.find((o) => o.id === b.tgt && !o.dead);
    if (!e) return;
    const dist = Math.hypot(e.x - cx, e.y - cy);
    if (dist > range + 1) {
      b.tgt = -1;
      return;
    }
    const sp = 16;
    let t = dist / sp;
    const px = e.x + e.vx * t;
    const py = e.y + e.vy * t;
    const d2 = Math.hypot(px - cx, py - cy);
    t = d2 / sp;
    const comp = this.techs.has('ballistics') ? 1 : 0.55;
    const ang = Math.atan2(py - cy, px - cx) - comp * this.curveW * t * 0.5;
    b.aim += angDiff(b.aim, ang) * Math.min(1, dt * 14);
    if (b.cd <= 0 && b.ammoP + b.ammoC > 0 && Math.abs(angDiff(b.aim, ang)) < 0.25) {
      const heavy = b.ammoC > 0;
      if (heavy) b.ammoC--;
      else b.ammoP--;
      b.cd = heavy ? 0.6 : 0.42;
      b.recoil = 1;
      this.bullets.push({
        x: cx + Math.cos(b.aim) * 0.5,
        y: cy + Math.sin(b.aim) * 0.5,
        a: b.aim,
        sp,
        w: this.curveW,
        dmg: (heavy ? 36 : 9) * this.dmgMul(),
        life: (range / sp) * 1.7,
        pierce: heavy ? 1 : 0,
        hit: [],
        col: heavy ? '#ffd84a' : '#e2e8f0',
      });
      this.burst(cx + Math.cos(b.aim) * 0.6, cy + Math.sin(b.aim) * 0.6, 2, heavy ? '#ffd84a' : '#fff', 3, 0.15, 2);
      audio.sfx('shoot', heavy ? 0.7 : 1);
    }
  }

  private updateLaser(b: Building, dt: number) {
    b.beam = Math.max(0, b.beam - dt);
    const cx = b.x + 0.5;
    const cy = b.y + 0.5;
    if (this.sat < 0.15) {
      b.working = false;
      return;
    }
    const e = this.nearestEnemy(cx, cy, 5.4);
    if (!e) {
      b.working = false;
      return;
    }
    b.working = true;
    b.beam = 0.12;
    b.beamX = e.x;
    b.beamY = e.y;
    b.aim = Math.atan2(e.y - cy, e.x - cx);
    this.hurtEnemy(e, 26 * this.dmgMul() * this.sat * dt, true);
    if (Math.random() < 0.3) this.burst(e.x, e.y, 1, '#fb7185', 2, 0.25, 2);
    audio.sfx('laser');
  }

  /* ---------- enemies ---------- */
  spawnEnemy(type: EnemyType, x: number, y: number, scale: number) {
    const def = ENEMIES[type];
    const hp = def.hp * scale;
    const e: Enemy = {
      id: this.nid++, type, x, y, vx: 0, vy: 0, ang: Math.PI / 2, hp, maxHp: hp, shield: def.shield * scale, maxShield: def.shield * scale, shT: 0,
      cd: 1 + Math.random(), tgt: -1, retarget: 0, age: 0, flash: 0, carry: 0, carryVal: 0, steal: 0.5, fleeing: false, dead: false, gone: false,
      phase: 1, t2: 8, t3: 14, t4: 6, charge: 0, scale,
    };
    this.enemies.push(e);
    return e;
  }

  private enemyScale() {
    const n = Math.max(1, this.wave);
    return this.diff.hp * (1 + 0.07 * (n - 1) + (n > WIN_WAVE ? 0.08 * (n - WIN_WAVE) : 0));
  }

  private pickTarget(e: Enemy): Building | null {
    let best: Building | null = null;
    let bs = Infinity;
    const type = e.type;
    for (const b of this.blds) {
      const cx = b.x + b.w / 2;
      const cy = b.y + b.h / 2;
      let d = Math.hypot(cx - e.x, cy - e.y);
      const belt = isBelt(b.kind);
      const def = b.kind === 'turret' || b.kind === 'laser' || b.kind === 'shield';
      const pow = b.kind === 'solar' || b.kind === 'dynamo' || b.kind === 'reactor' || b.kind === 'battery';
      switch (type) {
        case 'skiff':
          if (belt) d *= 2.5;
          break;
        case 'raider':
          d *= def ? 0.45 : belt ? 3 : 1;
          break;
        case 'bomber':
          d *= pow ? 0.35 : belt ? 4 : 1;
          break;
        case 'frigate':
          d *= def ? 0.4 : belt ? 5 : 1;
          break;
        case 'dread':
          d *= def ? 0.5 : b.kind === 'hub' ? 0.7 : belt ? 6 : 1;
          break;
        case 'looter': {
          const has = belt ? b.items.length > 0 : b.kind === 'dock' || (b.kind === 'hub' && this.credits > 10) || b.outBuf.length > 0;
          if (!has) continue;
          if (b.kind === 'dock' && this.credits < 10) continue;
          break;
        }
      }
      if (d < bs) {
        bs = d;
        best = b;
      }
    }
    return best;
  }

  hurtEnemy(e: Enemy, dmg: number, quiet = false) {
    if (e.dead) return;
    e.flash = 0.08;
    let d = dmg;
    if (e.shield > 0) {
      const a = Math.min(e.shield, d);
      e.shield -= a;
      d -= a;
      e.shT = 3;
      if (!quiet && Math.random() < 0.5) audio.sfx('shield');
    }
    if (d > 0) {
      e.hp -= d;
      if (!quiet) {
        audio.sfx('hit', 0.8 + Math.random() * 0.5);
        if (dmg >= 12 || Math.random() < 0.25) this.ftext(e.x, e.y - ENEMIES[e.type].r - 0.2, String(Math.round(dmg)), dmg >= 25 ? '#ffd84a' : '#fff', dmg >= 25 ? 14 : 11);
      }
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    const def = ENEMIES[e.type];
    const big = e.type === 'dread';
    this.burst(e.x, e.y, big ? 90 : 16, def.color, big ? 8 : 4, big ? 1.4 : 0.7, big ? 5 : 3);
    this.burst(e.x, e.y, big ? 40 : 6, '#fff', big ? 6 : 3, 0.4, 2);
    this.ring(e.x, e.y, big ? 5 : 1.3, def.color, big ? 1 : 0.4);
    this.shake(big ? 22 : e.type === 'frigate' ? 8 : 3);
    audio.sfx('explode', big ? 0.6 : 1.2);
    const bounty = Math.round(def.bounty * (0.9 + 0.1 * this.wave * 0.3));
    this.credits += bounty + e.carryVal;
    this.stats.earned += bounty;
    this.stats.kills++;
    this.stats.killsBy[e.type] = (this.stats.killsBy[e.type] || 0) + 1;
    this.ftext(e.x, e.y, '+' + bounty, '#fde68a', big ? 20 : 13);
    if (e.carryVal > 0) this.ftext(e.x, e.y + 0.6, `Recovered ${Math.round(e.carryVal)}c`, '#86efac', 12);
    if (big) {
      this.stats.boss = true;
      this.setBanner('DREADNOUGHT DESTROYED', 'The pirate fleet is broken!', '#fde68a');
    }
  }

  private explodeAt(x: number, y: number, r: number, dmg: number) {
    this.burst(x, y, 30, '#c084fc', 6, 0.7, 3.5);
    this.burst(x, y, 12, '#fff', 4, 0.3, 2);
    this.ring(x, y, r, '#c084fc', 0.5);
    this.shake(10);
    audio.sfx('explode');
    for (const b of [...this.blds]) {
      const d = Math.hypot(b.x + b.w / 2 - x, b.y + b.h / 2 - y);
      if (d <= r + b.w / 2) this.damageBuilding(b, dmg * (1 - d / (r + 2) * 0.4));
    }
  }

  private shootAt(e: Enemy, tb: Building, dmg: number, sp = 9, big = false) {
    const def = ENEMIES[e.type];
    this.eshots.push({
      x: e.x, y: e.y,
      tx: tb.x + tb.w / 2 + (Math.random() - 0.5) * 0.4,
      ty: tb.y + tb.h / 2 + (Math.random() - 0.5) * 0.4,
      bid: tb.id, dmg, sp, col: def.color, big,
    });
    audio.sfx('shoot', 0.5 + Math.random() * 0.2);
  }

  private updateEnemies(dt: number) {
    const dmgScale = 1 + 0.03 * Math.max(0, this.wave - 1);
    for (const e of this.enemies) {
      if (e.dead || e.gone) continue;
      const def = ENEMIES[e.type];
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.cd -= dt;
      if (e.maxShield > 0 && e.shield < e.maxShield) {
        e.shT -= dt;
        if (e.shT <= 0) e.shield = Math.min(e.maxShield, e.shield + (e.type === 'dread' ? 30 : 18) * dt);
      }
      const spd = def.speed * (this.opts.mods.frenzy ? 1.25 : 1);
      const ox = e.x;
      const oy = e.y;
      if (e.fleeing) {
        const ex = e.x < MAP_W / 2 ? -5 : MAP_W + 5;
        const ey = e.y < MAP_H / 2 ? -5 : MAP_H + 5;
        const toX = Math.abs(e.x - ex) < Math.abs(e.y - ey) * 1.6 ? ex : e.x;
        const toY = toX === ex ? e.y : ey;
        const dx = toX - e.x;
        const dy = toY - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * spd * 1.4 * dt;
        e.y += (dy / d) * spd * 1.4 * dt;
        e.ang = Math.atan2(dy, dx);
        e.vx = (e.x - ox) / dt;
        e.vy = (e.y - oy) / dt;
        if (e.x < -3 || e.y < -3 || e.x > MAP_W + 3 || e.y > MAP_H + 3) {
          e.gone = true;
          this.stats.stolen += e.carryVal;
          if (e.carryVal > 0) this.toast(`A looter escaped with ${Math.round(e.carryVal)}c of goods!`, '#fbbf24');
        }
        continue;
      }
      e.retarget -= dt;
      let tb = this.bmap.get(e.tgt) || null;
      if (!tb || e.retarget <= 0) {
        tb = this.pickTarget(e);
        e.tgt = tb ? tb.id : -1;
        e.retarget = 1.5 + Math.random();
        if (!tb && e.type === 'looter') e.fleeing = true;
      }
      if (e.type === 'dread') this.updateBoss(e, dt);
      if (!tb) continue;
      const tx = tb.x + tb.w / 2;
      const ty = tb.y + tb.h / 2;
      const dx = tx - e.x;
      const dy = ty - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const want = e.type === 'bomber' ? 0.4 : e.type === 'looter' ? 1.0 : def.range * 0.85;
      const target = Math.atan2(dy, dx);
      e.ang += angDiff(e.ang, target) * Math.min(1, dt * 4);
      if (dist > want) {
        const wob = Math.sin(e.age * 1.7 + e.id) * 0.25;
        e.x += ((dx + -dy * wob) / dist) * spd * dt;
        e.y += ((dy + dx * wob) / dist) * spd * dt;
      } else if (e.type !== 'bomber' && e.type !== 'looter') {
        e.x += (-dy / dist) * Math.sin(e.age * 0.8 + e.id) * spd * 0.3 * dt;
        e.y += (dx / dist) * Math.sin(e.age * 0.8 + e.id) * spd * 0.3 * dt;
      }
      e.vx = (e.x - ox) / dt;
      e.vy = (e.y - oy) / dt;
      if (Math.random() < dt * 8) this.parts.push({ x: e.x - Math.cos(e.ang) * def.r, y: e.y - Math.sin(e.ang) * def.r, vx: 0, vy: 0, life: 0.4, max: 0.4, size: 2, color: def.color, glow: true, drag: 2 });
      switch (e.type) {
        case 'skiff':
        case 'raider':
          if (dist <= def.range * 1.05 && e.cd <= 0) {
            e.cd = def.cd * (0.85 + Math.random() * 0.3);
            this.shootAt(e, tb, def.dmg * dmgScale);
          }
          break;
        case 'frigate':
          if (dist <= def.range * 1.05 && e.cd <= 0) {
            e.cd = def.cd;
            this.shootAt(e, tb, def.dmg * dmgScale, 8, true);
            this.shootAt(e, tb, def.dmg * dmgScale * 0.6, 8, true);
          }
          break;
        case 'dread':
          if (dist <= def.range * 1.05 && e.cd <= 0) {
            e.cd = def.cd * (e.phase >= 3 ? 0.7 : 1);
            this.shootAt(e, tb, def.dmg * dmgScale, 7, true);
            this.shootAt(e, tb, def.dmg * dmgScale, 7, true);
          }
          break;
        case 'bomber':
          if (dist < 0.9) {
            e.gone = true;
            this.explodeAt(e.x, e.y, 2.3, def.dmg * dmgScale);
          }
          break;
        case 'looter':
          if (dist < 1.4) {
            e.steal -= dt;
            if (e.steal <= 0) {
              e.steal = 0.35;
              this.steal(e, tb);
            }
          }
          break;
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead && !e.gone);
  }

  private steal(e: Enemy, tb: Building) {
    let got = false;
    if (isBelt(tb.kind) && tb.items.length) {
      const it = tb.items.pop()!;
      e.carryVal += ITEMS[it.t].value;
      got = true;
    } else if ((tb.kind === 'dock' || tb.kind === 'hub') && this.credits > 3) {
      const amt = Math.min(this.credits, 8 + this.wave);
      this.credits -= amt;
      e.carryVal += amt;
      got = true;
    } else if (tb.outBuf.length) {
      const it = tb.outBuf.pop()!;
      e.carryVal += ITEMS[it].value;
      got = true;
    }
    if (got) {
      e.carry++;
      this.ftext(e.x, e.y - 0.5, 'stolen!', '#facc15', 10);
      this.burst(e.x, e.y, 3, '#facc15', 2, 0.3, 2);
      audio.sfx('lost', 1.6);
      if (e.carry >= 10) e.fleeing = true;
    } else {
      e.retarget = 0;
      if (e.carry > 0) e.fleeing = true;
    }
  }

  private updateBoss(e: Enemy, dt: number) {
    const f = e.hp / e.maxHp;
    const ph = f < 0.33 ? 3 : f < 0.66 ? 2 : 1;
    if (ph > e.phase) {
      e.phase = ph;
      this.setBanner(ph === 2 ? 'PHASE II' : 'PHASE III', ph === 2 ? 'Reinforcements and EMP pulses!' : 'Radial barrage — brace the core!', '#f87171');
      audio.sfx('boss');
      this.shake(16);
      this.ring(e.x, e.y, 6, '#ef4444', 0.9);
    }
    if (e.phase >= 2) {
      e.t2 -= dt;
      if (e.t2 <= 0) {
        e.t2 = 13;
        for (let i = 0; i < 3; i++) this.spawnEnemy('skiff', e.x + (Math.random() - 0.5) * 3, e.y + (Math.random() - 0.5) * 3, this.enemyScale());
        this.toast('The Dreadnought launches skiffs!', '#fca5a5');
      }
      e.t3 -= dt;
      if (e.t3 <= 0 && e.charge <= 0) {
        e.t3 = 20;
        e.charge = 1.8;
        this.toast('EMP charging! Batteries will not save you...', '#fde047');
        audio.sfx('powerdown');
      }
    }
    if (e.charge > 0) {
      e.charge -= dt;
      if (e.charge <= 0) {
        this.emp = 4.5;
        audio.sfx('emp');
        this.shake(14);
        this.ring(e.x, e.y, 12, '#67e8f9', 0.8);
        this.toast('EMP! Power grid offline', '#67e8f9');
      }
    }
    if (e.phase >= 3) {
      e.t4 -= dt;
      if (e.t4 <= 0) {
        e.t4 = 4;
        const list = [...this.blds].sort(() => Math.random() - 0.5).slice(0, 8);
        for (const b of list) this.shootAt(e, b, 18 + this.wave, 10, true);
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (const b of this.bullets) {
      b.life -= dt;
      b.a += b.w * dt;
      b.x += Math.cos(b.a) * b.sp * dt;
      b.y += Math.sin(b.a) * b.sp * dt;
      for (const e of this.enemies) {
        if (e.dead || b.hit.includes(e.id)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < ENEMIES[e.type].r + 0.14) {
          b.hit.push(e.id);
          this.hurtEnemy(e, b.dmg);
          this.burst(b.x, b.y, 3, b.col, 2.5, 0.25, 2);
          if (b.pierce-- <= 0) b.life = 0;
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    for (const s of this.eshots) {
      const dx = s.tx - s.x;
      const dy = s.ty - s.y;
      const d = Math.hypot(dx, dy);
      const mv = s.sp * dt;
      if (d <= mv + 0.1) {
        const tb = this.bmap.get(s.bid);
        if (tb) this.damageBuilding(tb, s.dmg);
        this.burst(s.tx, s.ty, 5, s.col, 2.5, 0.3, 2.5);
        s.sp = 0;
        s.dmg = 0;
      } else {
        s.x += (dx / d) * mv;
        s.y += (dy / d) * mv;
      }
    }
    this.eshots = this.eshots.filter((s) => s.sp > 0);
  }

  damageBuilding(b: Building, dmg: number) {
    if (b.hp <= 0) return;
    const bx = b.x + b.w / 2;
    const by = b.y + b.h / 2;
    for (const s of this.blds) {
      if (s.kind !== 'shield' || s.sh <= 0 || this.sat < 0.2 || this.emp > 0) continue;
      if (Math.hypot(s.x + 0.5 - bx, s.y + 0.5 - by) <= SHIELD_R) {
        s.sh -= dmg;
        s.shCd = 3;
        this.ring(bx, by, 0.7, '#67e8f9', 0.25);
        audio.sfx('shield');
        if (s.sh <= 0) {
          s.sh = 0;
          s.shCd = 8;
          this.ftext(s.x + 0.5, s.y - 0.4, 'SHIELD DOWN', '#67e8f9', 13);
          audio.sfx('explode', 1.5);
        }
        return;
      }
    }
    b.hp -= dmg;
    b.hitT = 0.15;
    this.stats.damage += dmg;
    if (b.kind === 'hub') {
      this.shake(3 + dmg * 0.1);
      if (dmg > 5 && Math.random() < 0.3) this.ftext(bx, by - 1.6, '-' + Math.round(dmg), '#f87171', 14);
    }
    audio.sfx('hit', 0.6);
    if (b.hp <= 0) this.destroyBuilding(b);
  }

  private destroyBuilding(b: Building) {
    const c = this.toScreenless(b);
    const big = b.kind === 'hub';
    this.burst(c.x, c.y, big ? 80 : 14, '#fb923c', big ? 7 : 4, big ? 1.4 : 0.6, big ? 5 : 3);
    this.burst(c.x, c.y, big ? 30 : 5, '#fff', 3, 0.3, 2);
    this.ring(c.x, c.y, big ? 6 : 1.5, '#fb923c', big ? 1 : 0.4);
    this.shake(big ? 22 : 5);
    audio.sfx('explode', big ? 0.5 : 1);
    this.stats.destroyed++;
    if (!isBelt(b.kind) && !big) this.toast(`${BUILDINGS[b.kind].name} destroyed!`, '#fca5a5');
    this.removeBuilding(b, true);
  }

  /* ---------- waves ---------- */
  interval(n: number) {
    return Math.max(38, 78 - n * 2.2) * this.diff.interval * (this.opts.mods.frenzy ? 0.75 : 1);
  }

  private makePlan(n: number): Plan {
    const boss = n === WIN_WAVE || (n > WIN_WAVE && (n - WIN_WAVE) % 5 === 0);
    let budget = (3 + n * 2.7) * this.diff.count * (boss ? 0.5 : 1);
    const types = (Object.keys(ENEMIES) as EnemyType[]).filter((t) => t !== 'dread' && ENEMIES[t].from <= n);
    const comp: Partial<Record<EnemyType, number>> = {};
    for (const t of types) {
      if (ENEMIES[t].from === n) {
        comp[t] = 1;
        budget -= ENEMIES[t].cost;
      }
    }
    const weights: Record<string, number> = { skiff: 3, raider: 2.5, looter: 1.5, bomber: 1.4, frigate: 1 };
    let guard = 0;
    while (budget > 0 && guard++ < 80) {
      const opts = types.filter((t) => ENEMIES[t].cost <= budget);
      if (!opts.length) break;
      const tot = opts.reduce((a, t) => a + weights[t], 0);
      let r = Math.random() * tot;
      let pick = opts[0];
      for (const t of opts) {
        r -= weights[t];
        if (r <= 0) {
          pick = t;
          break;
        }
      }
      comp[pick] = (comp[pick] || 0) + 1;
      budget -= ENEMIES[pick].cost;
    }
    if (boss) comp.dread = 1;
    const edges: number[] = [];
    const ne = n >= 6 ? 2 : 1;
    while (edges.length < ne) {
      const e = Math.floor(Math.random() * 4);
      if (!edges.includes(e)) edges.push(e);
    }
    return { n, comp, edges, boss };
  }

  private edgePos(edge: number) {
    switch (edge) {
      case 0:
        return { x: 3 + Math.random() * (MAP_W - 6), y: -4 };
      case 1:
        return { x: MAP_W + 4, y: 3 + Math.random() * (MAP_H - 6) };
      case 2:
        return { x: 3 + Math.random() * (MAP_W - 6), y: MAP_H + 4 };
      default:
        return { x: -4, y: 3 + Math.random() * (MAP_H - 6) };
    }
  }

  private launchWave() {
    const plan = this.plan;
    this.wave = plan.n;
    const list: EnemyType[] = [];
    for (const t of Object.keys(plan.comp) as EnemyType[]) for (let i = 0; i < (plan.comp[t] || 0); i++) list.push(t);
    list.sort(() => Math.random() - 0.5);
    list.sort((a, b) => (a === 'dread' ? -1 : b === 'dread' ? 1 : 0));
    list.forEach((type, i) => {
      this.spawnQ.push({ t: i * 0.75 + Math.random() * 0.3, type, edge: plan.edges[Math.floor(Math.random() * plan.edges.length)] });
    });
    this.waveActive = true;
    const names = ['North', 'East', 'South', 'West'];
    this.setBanner(plan.boss ? 'BOSS RAID' : `RAID ${plan.n}`, 'Pirates inbound from the ' + plan.edges.map((e) => names[e]).join(' & '), '#f87171');
    audio.sfx(plan.boss ? 'boss' : 'alarm');
    this.shake(5);
    this.plan = this.makePlan(plan.n + 1);
    if (plan.boss) {
      this.bossWave = true;
      this.waveTimer = 9999;
    } else this.waveTimer = this.interval(plan.n);
  }

  private updateWaves(dt: number) {
    if (this.tutStep < 0 || this.tutSpawned) {
      if (this.tutStep < 0) {
        if (this.bossWave) {
          if (!this.enemies.some((e) => e.type === 'dread') && !this.spawnQ.some((s) => s.type === 'dread')) {
            this.bossWave = false;
            if (!this.victoryDone) this.win();
            else this.waveTimer = this.interval(this.wave);
          }
        } else {
          this.waveTimer -= dt;
          if (this.waveTimer <= 0) this.launchWave();
        }
      }
    }
    for (const s of this.spawnQ) s.t -= dt;
    const due = this.spawnQ.filter((s) => s.t <= 0);
    if (due.length) {
      this.spawnQ = this.spawnQ.filter((s) => s.t > 0);
      for (const s of due) {
        const p = this.edgePos(s.edge);
        const sc = s.type === 'dread' ? this.enemyScale() * (1 + 0.5 * Math.max(0, Math.floor((this.wave - WIN_WAVE) / 5))) : this.enemyScale();
        this.spawnEnemy(s.type, p.x, p.y, sc);
      }
    }
    if (this.waveActive && !this.spawnQ.length && !this.enemies.length) {
      this.waveActive = false;
      this.stats.waves++;
      const bonus = 40 + this.wave * 15;
      this.credits += bonus;
      this.stats.earned += bonus;
      this.ftext(this.hub.x + 1.5, this.hub.y - 1.2, `Raid repelled +${bonus}c`, '#86efac', 15);
      audio.sfx('clear');
    }
  }

  private win() {
    this.victoryDone = true;
    this.status = 'victory';
    this.stats.waves = Math.max(this.stats.waves, this.wave);
    audio.sfx('victory');
    this.shake(8);
    this.burst(this.hub.x + 1.5, this.hub.y + 1.5, 60, '#fde68a', 7, 1.4, 4);
    this.cb.onEnd('victory');
  }

  private lose() {
    this.status = 'defeat';
    audio.sfx('defeat');
    this.cb.onEnd('defeat');
  }

  /* ---------- events, contracts, market ---------- */
  private updateEvents(dt: number) {
    if (this.evt) {
      const ev = this.evt;
      ev.t -= dt;
      if (ev.type === 'meteors') {
        ev.tick -= dt;
        if (ev.tick <= 0) {
          ev.tick = 0.6;
          const b = this.blds[Math.floor(Math.random() * this.blds.length)];
          if (b) this.meteors.push({ x: b.x + 0.5 + (Math.random() - 0.5) * 2, y: b.y + 0.5 + (Math.random() - 0.5) * 2, t: 1.6 });
        }
      }
      if (ev.t <= 0) {
        this.toast(`${ev.name} has ended`, '#94a3b8');
        this.evt = null;
      }
      return;
    }
    if (this.tutStep >= 0 || this.wave < 2 || this.bossWave) return;
    this.evtTimer -= dt;
    if (this.evtTimer <= 0) {
      this.evtTimer = 50 + Math.random() * 40;
      const r = Math.random();
      if (r < 0.28) {
        this.evt = { type: 'flare', t: 22, dur: 22, name: 'Solar Flare', tick: 0 };
        this.toast('SOLAR FLARE: solar output collapses!', '#fde047');
      } else if (r < 0.55) {
        this.evt = { type: 'meteors', t: 10, dur: 10, name: 'Micrometeoroid Shower', tick: 0 };
        this.toast('METEOR SHOWER: take cover!', '#fdba74');
      } else if (r < 0.8) {
        this.evt = { type: 'instab', t: 25, dur: 25, name: 'Spin Instability', tick: 0 };
        this.toast('SPIN INSTABILITY: Coriolis drift doubled!', '#7dd3fc');
      } else {
        const it = (['plate', 'ingot', 'cell', 'frame', 'circuit'] as ItemId[])[Math.floor(Math.random() * 5)];
        const boom = Math.random() < 0.55;
        this.mkt[it].target = boom ? 1.9 : 0.55;
        this.mkt[it].tt = 45;
        this.toast(boom ? `MARKET BOOM: ${ITEMS[it].name} prices soar!` : `MARKET GLUT: ${ITEMS[it].name} prices crash`, boom ? '#86efac' : '#fca5a5');
        return;
      }
      audio.sfx('alarm');
    }
  }

  private meteorsUpdate(dt: number) {
    for (const m of this.meteors) {
      m.t -= dt;
      if (m.t <= 0) {
        this.burst(m.x, m.y, 18, '#fdba74', 5, 0.6, 3);
        this.ring(m.x, m.y, 1.5, '#fdba74', 0.4);
        this.shake(5);
        audio.sfx('explode', 1.3);
        for (const b of [...this.blds]) if (Math.hypot(b.x + b.w / 2 - m.x, b.y + b.h / 2 - m.y) < 1.4 + b.w / 2) this.damageBuilding(b, 38);
      }
    }
    this.meteors = this.meteors.filter((m) => m.t > 0);
  }

  private updateMarket(dt: number) {
    for (const id of ITEM_IDS) {
      const m = this.mkt[id];
      if (m.tt > 0) {
        m.tt -= dt;
        if (m.tt <= 0) m.target = 1;
      }
      m.m += (m.target - m.m) * 0.05 * dt;
    }
  }

  private updateContracts(dt: number) {
    for (const c of this.contracts) c.t -= dt;
    const expired = this.contracts.filter((c) => c.t <= 0);
    if (expired.length) {
      for (const c of expired) this.toast(`Contract failed: ${c.qty}× ${ITEMS[c.item].name}`, '#fca5a5');
      this.contracts = this.contracts.filter((c) => c.t > 0);
    }
    if (this.tutStep >= 0) return;
    this.contractTimer -= dt;
    if (this.contractTimer <= 0 && this.contracts.length < 2) {
      this.contractTimer = 85 + Math.random() * 30;
      const pool: ItemId[] = ['plate', 'ingot'];
      if (this.techs.has('cells')) pool.push('cell');
      if (this.techs.has('assembly')) pool.push('frame', 'circuit');
      if (this.techs.has('fab')) pool.push('drive', 'aegis');
      const item = pool[Math.floor(Math.random() * pool.length)];
      const w = Math.max(1, this.wave);
      const qty = item === 'drive' || item === 'aegis' ? 2 + Math.floor(w / 3) : item === 'plate' || item === 'ingot' ? 10 + w * 2 : 6 + w;
      const reward = Math.round(qty * ITEMS[item].value * 1.8 * (1 + 0.1 * this.lvl('broker')));
      const c: Contract = { id: this.nextContractId++, item, qty, have: 0, t: 160, dur: 160, reward, rp: Math.round(qty * ITEMS[item].value * 0.08) };
      this.contracts.push(c);
      this.toast(`New contract: ${qty}× ${ITEMS[item].name} for ${reward}c`, '#fde68a');
      audio.sfx('ui', 1.5);
    }
  }

  private completeContract(c: Contract) {
    this.credits += c.reward;
    this.stats.earned += c.reward;
    this.rp += c.rp;
    this.stats.rp += c.rp;
    this.rep++;
    this.stats.contracts++;
    this.contracts = this.contracts.filter((k) => k !== c);
    this.toast(`Contract complete! +${c.reward}c +${c.rp}RP`, '#86efac');
    this.ftext(this.hub.x + 1.5, this.hub.y - 0.5, `Contract +${c.reward}c`, '#86efac', 15);
    audio.sfx('clear');
  }

  /* ---------- tutorial ---------- */
  private updateTutorial() {
    if (this.tutStep < 0) return;
    const step = TUT[this.tutStep];
    if (this.tutStep === TUT.length - 1 && !this.tutSpawned) {
      this.tutSpawned = true;
      for (let i = 0; i < 3; i++) {
        const p = this.edgePos(i % 4);
        this.spawnEnemy('skiff', p.x, p.y, 0.8);
      }
      this.waveActive = false;
    }
    if (step && step.check(this)) {
      this.tutStep++;
      audio.sfx('step');
      if (this.tutStep >= TUT.length) {
        this.tutStep = -1;
        this.waveTimer = 60 * this.diff.interval;
        this.setBanner('TRAINING COMPLETE', 'Real raids begin soon. Good luck, Foreman!', '#86efac');
        this.tutDone = true;
      }
    }
  }
  tutDone = false;

  /* ---------- scoring ---------- */
  lpMult() {
    const m = this.opts.mods;
    return this.diff.lp * (1 + 0.2 * ((m.storm ? 1 : 0) + (m.frenzy ? 1 : 0) + (m.brown ? 1 : 0)));
  }
  score() {
    const raw = this.stats.earned * 0.5 + this.stats.kills * 12 + this.stats.waves * 150 + (this.stats.boss ? 1500 : 0) + this.stats.contracts * 100;
    return Math.floor(raw * this.lpMult());
  }
  legacyEarned() {
    if (this.opts.tutorial && this.stats.waves < 2) return 0;
    return Math.floor((this.stats.waves * 3 + this.score() / 500 + (this.victoryDone ? 25 : 0)) * this.lpMult());
  }

  /* ---------- HUD snapshot ---------- */
  safeRun() {
    const r = Math.abs(this.driftRate);
    if (r < 1e-4) return 99;
    return 0.5 / r;
  }

  hud(): HudState {
    const sel = this.selected && this.bmap.has(this.selected.id) ? this.selected : null;
    let repairCost = 0;
    for (const b of this.blds) repairCost += this.repairCostOf(b);
    const mk = ITEM_IDS.filter((i) => ITEMS[i].tier > 0).map((i) => ({ item: i, m: this.mkt[i].m, target: this.mkt[i].target }));
    const tut = this.tutStep >= 0 && TUT[this.tutStep] ? { step: this.tutStep, total: TUT.length, title: TUT[this.tutStep].title, text: TUT[this.tutStep].text } : null;
    return {
      credits: this.credits, rp: this.rp, gen: this.gen, dem: this.dem, sat: this.sat, batt: this.batt, cap: this.cap, emp: this.emp > 0,
      spin: this.spin, spinSet: this.spinSet, flipCd: this.flipCd, dirV: this.spinDirV, safeRun: this.safeRun(), sun: this.sun,
      wave: this.wave, waveTimer: this.waveTimer, bossWave: this.bossWave, waveActive: this.waveActive, enemies: this.enemies.length,
      plan: this.plan, endless: this.endless, hubHp: this.hub.hp, hubMax: this.hub.maxHp, contracts: this.contracts.map((c) => ({ ...c })),
      market: mk, speed: this.speed, tool: this.tool, rot: this.rot, cat: this.cat, overlay: this.overlay,
      toasts: this.toasts.map((t) => ({ id: t.id, text: t.text, color: t.color })),
      banner: this.banner ? { text: this.banner.text, sub: this.banner.sub, color: this.banner.color } : null,
      tut, techs: [...this.techs], sel: sel ? this.selInfo(sel) : null,
      evt: this.evt ? { name: this.evt.name, t: this.evt.t } : null, score: this.score(), time: this.time, repairCost, status: this.status, rep: this.rep,
      drift: this.driftRate, diff: this.opts.diff, mods: this.opts.mods,
    };
  }

  private selInfo(b: Building): SelInfo {
    const def = BUILDINGS[b.kind];
    const lines: string[] = [];
    let status = 'OK';
    const list = MACHINE_RECIPES[b.kind];
    const recipes = list && !AUTO_RECIPE.includes(b.kind)
      ? list.map((id, i) => {
          const r = RECIPES[id];
          const ins = (Object.keys(r.inputs) as ItemId[]).map((k) => `${r.inputs[k]}× ${ITEMS[k].name}`).join(' + ');
          return { id, name: r.name, active: i === b.sel, text: `${ins} → ${r.outQty}× ${ITEMS[r.output].name}` };
        })
      : [];
    if (isBelt(b.kind)) {
      status = `${b.items.length} item(s) on tile`;
      if (b.kind === 'conveyor') lines.push(`Drift here: ${(Math.abs(this.driftRate) * this.stab[b.y * MAP_W + b.x] * 100).toFixed(1)}% sideways per tile`);
    } else {
      if (b.working) status = this.sat < 0.5 ? 'Working (low power)' : 'Working';
      else if (b.blocked) status = 'Output blocked';
      else status = 'Idle';
      if (b.kind === 'turret') {
        lines.push(`Plate rounds: ${b.ammoP}  ·  Circuit rounds: ${b.ammoC}`);
        status = b.ammoP + b.ammoC > 0 ? 'Armed' : 'Out of ammo — feed plates!';
      } else if (b.kind === 'reactor') {
        lines.push(`Fuel cells: ${b.fuel}/6`);
        status = b.fuel > 0 ? 'Online (+40 kW)' : 'Offline — needs fuel cells';
      } else if (b.kind === 'shield') {
        lines.push(`Barrier: ${Math.round(b.sh)}/${SHIELD_MAX}`);
        status = b.sh > 0 ? 'Shield up' : 'Shield broken — recharging';
      } else if (b.kind === 'extractor') {
        lines.push(`Deposit: ${b.res === 1 ? 'Iron' : b.res === 2 ? 'Copper' : 'Comet Ice'}`);
      } else if (b.kind === 'centrifuge') {
        lines.push(`Spin boost: ×${(1 + this.spin * 0.9).toFixed(2)}`);
      } else if (b.kind === 'solar') {
        lines.push(`Output now: ${(12 * this.sun).toFixed(1)} kW`);
      } else if (b.kind === 'dynamo') {
        lines.push(`Output now: ${(8 * this.spin).toFixed(1)} kW`);
      } else if (b.kind === 'stabilizer') {
        lines.push('Drift multiplier in range: ×' + (1 - 0.75 * clamp(this.sat * 1.2, 0, 1)).toFixed(2));
      } else if (b.kind === 'lab') {
        lines.push(`Queue: ${b.q.length}/4`);
      }
      const inv = (Object.keys(b.inv) as ItemId[]).filter((k) => (b.inv[k] || 0) > 0).map((k) => `${b.inv[k]}× ${ITEMS[k].name}`);
      if (inv.length) lines.push('Buffer: ' + inv.join(', '));
      if (def.power > 0) lines.push(`Power: ${def.power} kW`);
    }
    return { id: b.id, kind: b.kind, name: def.name, hp: b.hp, maxHp: b.maxHp, status, recipes, lines, repairCost: this.repairCostOf(b), canDemolish: b.kind !== 'hub' };
  }

  selectedBuilding() {
    return this.selected;
  }
}

export { CATS, isBelt };
