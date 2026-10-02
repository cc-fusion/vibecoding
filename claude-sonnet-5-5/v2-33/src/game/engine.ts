import {
  WORLD_W, WORLD_H, clamp, dist, mulberry32, angLerp, SHIPS, FACTIONS, DIFFS, sectorDef, emptyBag, bagUnits, bagValue,
  emptyStats, idleOrder, RES_LIST, RES_INFO, WRECK_INFO,
} from './data';
import type {
  Ship, ShipKind, Wreck, Station, Proj, Part, FText, LogMsg, Ping, Storm, Meteor, Market, Contract, Auction, RivalState,
  Stats, Crew, Order, ResBag, SectorDef, DiffDef, RunResult,
} from './data';
import { audio } from './audio';
import type { Settings } from './save';
import * as Sys from './systems';
import { generateSector } from './worldgen';
import { drawGame, drawMini } from './render';

export interface GameCfg { diff: string; mods: string[]; meta: Record<string, number>; sector: number; settings: Settings }
export interface GameHooks { onOver: (k: RunResult['kind']) => void; onPause: () => void }

const FW = 72;
const FH = 48;
const CELL = 50;
const MAX_PARTS = 900;

export class Game {
  cfg: GameCfg;
  hooks: GameHooks;
  diff: DiffDef;
  mods: Set<string>;
  meta: Record<string, number>;
  rng: () => number;
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  miniCanvas: HTMLCanvasElement | null = null;
  vw = 800;
  vh = 600;
  dpr = 1;
  cam = { x: WORLD_W / 2, y: WORLD_H / 2 + 60, zoom: 0.5 };
  time = 0;
  sectorTime = 0;
  paused = false;
  speed = 1;
  over: '' | RunResult['kind'] = '';
  overReason = '';
  result: RunResult | null = null;
  sector: number;
  sd: SectorDef;
  timeLimit = 0;
  quota = 0;
  delivered = 0;
  nextId = 1;
  nextMsg = 1;
  ships: Ship[] = [];
  shipMap = new Map<number, Ship>();
  wrecks: Wreck[] = [];
  wreckMap = new Map<number, Wreck>();
  projs: Proj[] = [];
  parts: Part[] = [];
  texts: FText[] = [];
  log: LogMsg[] = [];
  pings: Ping[] = [];
  station: Station;
  credits = 0;
  stock: ResBag = emptyBag();
  fuel = 200;
  fuelBurned = 0;
  heat = 0;
  rel: number[] = [0, 0, 0, 0, 0];
  treaty: number[] = [0, 0, 0, 0, 0];
  provoked: number[] = [0, 0, 0, 0, 0];
  cool: number[] = [0, 0, 0, 0, 0];
  rivals: RivalState[] = [];
  lab: Record<string, number> = {};
  boon = { tow: 1, hull: 1, speed: 1, dmg: 1 };
  crew: Crew[] = [];
  pool: Crew[] = [];
  payIdx = 1;
  wageT = 45;
  wageDue = 0;
  moraleBoost = 0;
  fear = 0;
  poolT = 90;
  nextCrewId = 1;
  market!: Market;
  contracts: Contract[] = [];
  auctions: Auction[] = [];
  contractT = 15;
  auctionT = 20;
  storm: Storm | null = null;
  meteors: Meteor[] = [];
  eventT = 40;
  raidT = 100;
  raidWarned = false;
  raidAlive = 0;
  raidWas = false;
  raidDir = '';
  bossId = 0;
  bossPhase = 0;
  levDelivered = false;
  stats: Stats = emptyStats();
  sel: number[] = [];
  groups: Record<number, number[]> = {};
  keys = new Set<string>();
  mouse = { x: 0, y: 0, in: false };
  drag: { x0: number; y0: number; x1: number; y1: number } | null = null;
  pan: { x: number; y: number; cx: number; cy: number } | null = null;
  touch: { x0: number; y0: number; cx: number; cy: number; moved: boolean } | null = null;
  shake = 0;
  hoverWreck = 0;
  hoverShip = 0;
  renownEarned = 0;
  renownBanked = 0;
  explored = new Uint8Array(FW * FH);
  fogDirty = true;
  fogCanvas: HTMLCanvasElement;
  fogCtx: CanvasRenderingContext2D | null;
  visT = 0;
  tutStep = 0;
  tutOn = false;
  tabsSeen = new Set<string>();
  fleetPeakT = 0;
  dead = false;
  private raf = 0;
  private last = 0;
  private insolT = 0;
  private lastClick = { t: 0, id: 0 };
  private lastGroup = { t: 0, n: 0 };
  private lastProvoke = -9;
  private stars: { x: number; y: number; z: number; s: number }[] = [];

  constructor(cfg: GameCfg, hooks: GameHooks) {
    this.cfg = cfg;
    this.hooks = hooks;
    this.diff = DIFFS[cfg.diff] ?? DIFFS.operator;
    this.mods = new Set(cfg.mods);
    this.meta = cfg.meta;
    this.rng = mulberry32(((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0) || 1);
    this.sector = cfg.sector;
    this.sd = sectorDef(cfg.sector);
    this.tutOn = cfg.sector === 0;
    this.station = { x: FACTIONS[0].bx, y: FACTIONS[0].by, r: 66, hp: 1, maxHp: 1, cd: 0, flash: 0, rot: 0 };
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = FW;
    this.fogCanvas.height = FH;
    this.fogCtx = this.fogCanvas.getContext('2d');
    for (let i = 0; i < 240; i++) this.stars.push({ x: Math.random() * 2000, y: Math.random() * 1400, z: 0.1 + Math.random() * 0.9, s: Math.random() * 1.6 + 0.3 });
    this.credits = Math.round((600 + 150 * (this.meta.credits || 0)) * this.diff.credits * (this.mods.has('lean') ? 0.5 : 1));
    const base = 8 * (this.meta.diplomat || 0) + (this.mods.has('feud') ? -45 : 0);
    this.rel = [0, base, base, base, 0];
    this.rivals = [0, 1, 2, 3, 4].map(() => ({ credits: 700, spawnT: 30, raidT: 90, embargoT: 70, delivered: 0 }));
    Sys.initMarket(this);
    this.setupSector(true);
    Sys.initialCrewAndFleet(this);
    Sys.genPool(this);
    this.msg(`Sector ${this.sector}: ${this.sd.name}. ${this.sd.time > 0 ? 'Deliver the quota before the charter audit.' : 'Follow the training prompts.'}`, '#ffd36e');
  }

  /* ================= helpers ================= */
  m(id: string) { return this.meta[id] || 0; }
  l(id: string) { return this.lab[id] || 0; }
  rr(a: number, b: number) { return a + this.rng() * (b - a); }
  pick<T>(arr: T[]): T { return arr[Math.floor(this.rng() * arr.length) % arr.length]; }
  msg(text: string, color = '#cfe8ff') {
    this.log.push({ id: this.nextMsg++, text, color, t: this.time });
    if (this.log.length > 40) this.log.shift();
  }
  ftext(x: number, y: number, text: string, color = '#fff', size = 14) {
    if (this.texts.length > 80) this.texts.shift();
    this.texts.push({ x, y, text, color, life: 1.4, size });
  }
  addShake(a: number) { if (this.cfg.settings.shake) this.shake = Math.min(26, this.shake + a); }
  burst(x: number, y: number, n: number, color: string, speed = 120, life = 0.6, size = 2) {
    for (let i = 0; i < n && this.parts.length < MAX_PARTS; i++) {
      const a = this.rng() * Math.PI * 2;
      const v = speed * (0.25 + this.rng() * 0.75);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + this.rng() * 0.6), max: life, size: size * (0.6 + this.rng() * 0.8), color, kind: 'spark', grow: 0 });
    }
  }
  explosion(x: number, y: number, size: number, color = '#ffb050') {
    this.burst(x, y, Math.round(size * 0.9), color, size * 6, 0.8, 2.6);
    this.burst(x, y, Math.round(size * 0.4), '#ffffff', size * 3, 0.4, 1.8);
    for (let i = 0; i < Math.round(size / 5) && this.parts.length < MAX_PARTS; i++) {
      const a = this.rng() * Math.PI * 2;
      this.parts.push({ x, y, vx: Math.cos(a) * size, vy: Math.sin(a) * size, life: 1.1, max: 1.1, size: size * 0.5, color: '#556', kind: 'smoke', grow: size * 0.8 });
    }
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: size * 0.4, color, kind: 'ring', grow: size * 5 });
  }
  hostile(a: number, b: number): boolean {
    if (a === b) return false;
    if (a === 4 || b === 4) return true;
    if (a !== 0 && b !== 0) return false;
    const f = a === 0 ? b : a;
    if (f < 1 || f > 3) return false;
    if (this.provoked[f] > 0) return true;
    if (this.treaty[f] > 0) return false;
    return this.rel[f] <= -35;
  }
  provoke(f: number) {
    if (f < 1 || f > 3) return;
    if (this.time - this.lastProvoke < 1.5) return;
    this.lastProvoke = this.time;
    this.provoked[f] = 40;
    this.treaty[f] = 0;
    this.rel[f] = Math.max(-100, this.rel[f] - 20);
    this.msg(`You opened fire on the ${FACTIONS[f].name}! They will retaliate.`, '#ff6b57');
    audio.play('warn');
  }
  dockOf(f: number) {
    if (f === 0) return { x: this.station.x, y: this.station.y, r: this.station.r + 18 };
    const d = FACTIONS[f];
    return { x: d.bx, y: d.by, r: 70 };
  }
  fleet(): Ship[] { return this.ships.filter((s) => s.faction === 0 && !s.temp && !s.dead); }
  findCrew(id: number | null): Crew | undefined { return id == null ? undefined : this.crew.find((c) => c.id === id); }
  crewOf(s: Ship): Crew | undefined { return this.findCrew(s.crew); }
  crewMult(s: Ship, stat: 'speed' | 'work' | 'dmg'): number {
    if (s.faction !== 0) return 1;
    const c = this.crewOf(s);
    if (!c) return s.temp ? 1.1 : 0.65;
    const want = stat === 'speed' ? 'pilot' : stat === 'work' ? 'rigger' : 'gunner';
    let mm = 1 + c.skill * (c.spec === want ? 0.08 : 0.02);
    mm *= 0.75 + clamp(c.morale, 0, 100) / 200;
    if (stat === 'speed' && c.trait === 'reckless') mm *= 1.12;
    return mm;
  }
  inStorm(x: number, y: number) { return !!this.storm && dist(x, y, this.storm.x, this.storm.y) < this.storm.r; }
  speedOf(s: Ship): number {
    const d = SHIPS[s.kind];
    let v = d.speed;
    if (s.faction === 0) {
      v *= (1 + 0.09 * this.l('engine')) * this.crewMult(s, 'speed') * this.boon.speed;
      if (this.fuel <= 0) v *= 0.35;
    } else if (s.kind === 'boss') v *= this.bossPhase >= 3 ? 1.35 : 1;
    else v *= 1 + 0.015 * Math.max(0, this.sector - 1);
    if (this.inStorm(s.x, s.y)) v *= 0.55;
    if (s.disabled > 0) v *= 0.1;
    return v;
  }
  towCap(s: Ship): number {
    const d = SHIPS[s.kind];
    if (s.faction !== 0) return d.tow * (1 + 0.04 * Math.max(0, this.sector - 1));
    let c = d.tow * (1 + 0.22 * this.l('tow')) * (1 + 0.08 * this.m('tether')) * this.boon.tow * this.crewMult(s, 'work');
    if (this.fuel <= 0) c *= 0.6;
    return c;
  }
  beamRange(s: Ship): number { return SHIPS[s.kind].beam * (s.faction === 0 ? 1 + 0.12 * this.l('tow') : 1); }
  cargoCap(s: Ship): number { return SHIPS[s.kind].cargo * (1 + 0.2 * this.l('cut')) * (1 + 0.1 * this.m('holds')); }
  maxHpOf(s: Ship): number {
    const d = SHIPS[s.kind];
    return s.faction === 0 ? d.hp * (1 + 0.25 * this.l('hull')) * this.boon.hull : s.maxHp;
  }
  dmgMult(s: Ship): number {
    if (s.faction === 0) return (1 + 0.22 * this.l('guns')) * this.boon.dmg * this.crewMult(s, 'dmg');
    return this.diff.dmg * (1 + 0.04 * Math.max(0, this.sector - 1));
  }
  scanR(s: Ship): number { return SHIPS[s.kind].scan * (1 + 0.25 * this.l('scan')) * (1 + 0.1 * this.m('sensors')); }
  wreckValue(w: Wreck) { return bagValue(w.loot); }
  stockValue() { return RES_LIST.reduce((a, r) => a + this.stock[r] * RES_INFO[r].base, 0); }
  burnFuel(a: number) {
    const k = 1 - 0.08 * this.l('engine');
    this.fuel = Math.max(0, this.fuel - a * k);
    this.fuelBurned += a * k;
  }
  selectedShips(): Ship[] {
    const out: Ship[] = [];
    for (const id of this.sel) {
      const s = this.shipMap.get(id);
      if (s && !s.dead && s.faction === 0) out.push(s);
    }
    return out;
  }
  toWorld(sx: number, sy: number) { return { x: (sx - this.vw / 2) / this.cam.zoom + this.cam.x, y: (sy - this.vh / 2) / this.cam.zoom + this.cam.y }; }
  toScreen(wx: number, wy: number) { return { x: (wx - this.cam.x) * this.cam.zoom + this.vw / 2, y: (wy - this.cam.y) * this.cam.zoom + this.vh / 2 }; }

  /* ================= setup ================= */
  setupSector(first: boolean) {
    const sd = sectorDef(this.sector);
    this.sd = sd;
    this.ships = first ? [] : this.ships.filter((s) => s.faction === 0 && !s.temp && !s.dead);
    this.wrecks = [];
    this.projs = [];
    this.meteors = [];
    this.storm = null;
    this.auctions = [];
    this.contracts = [];
    this.treaty = [0, 0, 0, 0, 0];
    this.provoked = [0, 0, 0, 0, 0];
    this.sectorTime = 0;
    this.delivered = 0;
    this.levDelivered = false;
    this.bossId = 0;
    this.bossPhase = 0;
    this.quota = Math.round(sd.quota * this.diff.quota);
    this.timeLimit = sd.time * this.diff.time;
    this.raidT = sd.raid > 0 ? sd.raid * this.diff.raid + 25 : 1e9;
    this.raidWarned = false;
    this.raidAlive = 0;
    this.raidWas = false;
    this.eventT = 35;
    this.contractT = 12;
    this.auctionT = 22;
    this.explored.fill(0);
    this.fogDirty = true;
    const mx = (1 + 0.3 * this.l('station')) * (1 + 0.15 * this.m('plating'));
    const nm = Math.round(1200 * mx);
    this.station.maxHp = nm;
    this.station.hp = first ? nm : Math.min(nm, this.station.hp + nm * 0.5);
    this.rivals.forEach((r, i) => {
      r.credits = 600 + this.sector * 350 + i * 40;
      r.raidT = 70 * this.diff.raid + 30;
      r.spawnT = 25;
      r.embargoT = 80;
    });
    this.nextMsg = this.nextMsg || 1;
    this.sel = [];
    this.ships.forEach((s, i) => {
      this.detach(s);
      const a = (i / Math.max(1, this.ships.length)) * Math.PI * 2;
      s.x = this.station.x + Math.cos(a) * 110;
      s.y = this.station.y + Math.sin(a) * 110;
      s.vx = s.vy = 0;
      s.order = idleOrder();
      s.cargo = emptyBag();
      s.hp = this.maxHpOf(s);
    });
    generateSector(this);
    this.cam.x = this.station.x;
    this.cam.y = this.station.y;
  }

  spawn(kind: ShipKind, faction: number, x: number, y: number, ai = ''): Ship {
    const def = SHIPS[kind];
    let hp = def.hp;
    if (faction !== 0) hp *= this.diff.hp * (1 + 0.05 * Math.max(0, this.sector - 1));
    const s: Ship = {
      id: this.nextId++, faction, kind, x, y, vx: 0, vy: 0, ang: this.rng() * 6.28, hp, maxHp: hp, crew: null,
      order: idleOrder(), auto: true, manual: false, cargo: emptyBag(), cd: this.rng() * 0.5, flash: 0, attached: 0, ai,
      t: this.rng(), stall: 0, target: 0, disabled: 0, vis: faction === 0, temp: false, life: 0, resume: 0, moved: false,
      aux: [this.rng() < 0.5 ? 1 : -1, 0, 0, 0, 0, 0, 0, 0], blk: new Map(), dead: false, name: '',
    };
    this.ships.push(s);
    this.shipMap.set(s.id, s);
    return s;
  }

  /* ================= lifecycle ================= */
  start(canvas: HTMLCanvasElement, mini: HTMLCanvasElement | null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.miniCanvas = mini;
    this.resize();
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVis);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    audio.startMusic();
  }
  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    const c = this.canvas;
    if (c) {
      c.removeEventListener('pointerdown', this.onDown);
      c.removeEventListener('pointermove', this.onMove);
      c.removeEventListener('pointerup', this.onUp);
      c.removeEventListener('pointercancel', this.onUp);
      c.removeEventListener('pointerleave', this.onLeave);
      c.removeEventListener('wheel', this.onWheel);
      c.removeEventListener('contextmenu', this.onCtx);
    }
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('visibilitychange', this.onVis);
    audio.stopMusic();
    audio.setIntensity(0);
  }
  resize() {
    const c = this.canvas;
    if (!c) return;
    const w = Math.max(200, c.clientWidth);
    const h = Math.max(200, c.clientHeight);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.floor(w * this.dpr);
    c.height = Math.floor(h * this.dpr);
    this.vw = w;
    this.vh = h;
  }
  setPaused(p: boolean) { this.paused = p; if (p) this.keys.clear(); }
  cycleSpeed() { this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1; audio.play('click'); }

  private onBlur = () => { this.keys.clear(); };
  private onVis = () => { if (document.hidden && !this.over && !this.paused) this.hooks.onPause(); };
  private onCtx = (e: Event) => { e.preventDefault(); };

  frame = (now: number) => {
    if (this.dead) return;
    const dt = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused && !this.over) {
      let rem = dt * this.speed;
      while (rem > 1e-4 && !this.over) {
        const step = Math.min(0.033, rem);
        this.update(step);
        rem -= step;
      }
    } else if (this.over) {
      this.updateFx(dt);
      this.updateCamera(dt);
    }
    this.updateHover();
    if (this.fogDirty) this.refreshFog();
    if (this.ctx) drawGame(this, this.ctx, this.stars);
    if (this.miniCanvas) drawMini(this, this.miniCanvas);
    this.raf = requestAnimationFrame(this.frame);
  };

  /* ================= input ================= */
  private onDown = (e: PointerEvent) => {
    audio.init();
    try { this.canvas?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const x = e.offsetX, y = e.offsetY;
    this.mouse = { x, y, in: true };
    if (this.paused || this.over) return;
    if (e.pointerType === 'touch') {
      this.touch = { x0: x, y0: y, cx: this.cam.x, cy: this.cam.y, moved: false };
      return;
    }
    if (e.button === 0) this.drag = { x0: x, y0: y, x1: x, y1: y };
    else if (e.button === 2) {
      const w = this.toWorld(x, y);
      this.commandAt(w.x, w.y);
    } else if (e.button === 1) {
      this.pan = { x, y, cx: this.cam.x, cy: this.cam.y };
      e.preventDefault();
    }
  };
  private onMove = (e: PointerEvent) => {
    const x = e.offsetX, y = e.offsetY;
    this.mouse = { x, y, in: true };
    if (this.drag) { this.drag.x1 = x; this.drag.y1 = y; }
    if (this.pan) {
      this.cam.x = clamp(this.pan.cx - (x - this.pan.x) / this.cam.zoom, 0, WORLD_W);
      this.cam.y = clamp(this.pan.cy - (y - this.pan.y) / this.cam.zoom, 0, WORLD_H);
    }
    if (this.touch) {
      const dx = x - this.touch.x0, dy = y - this.touch.y0;
      if (Math.abs(dx) + Math.abs(dy) > 10) this.touch.moved = true;
      if (this.touch.moved) {
        this.cam.x = clamp(this.touch.cx - dx / this.cam.zoom, 0, WORLD_W);
        this.cam.y = clamp(this.touch.cy - dy / this.cam.zoom, 0, WORLD_H);
      }
    }
  };
  private onUp = (e: PointerEvent) => {
    const x = e.offsetX, y = e.offsetY;
    if (this.touch) {
      const t = this.touch;
      this.touch = null;
      if (!t.moved && !this.paused && !this.over) this.tap(x, y);
      return;
    }
    if (e.button === 0 && this.drag) {
      const d = this.drag;
      this.drag = null;
      if (Math.abs(d.x1 - d.x0) + Math.abs(d.y1 - d.y0) < 8) this.clickSelect(x, y, e.shiftKey);
      else this.boxSelect(d, e.shiftKey);
    }
    if (e.button === 1) this.pan = null;
  };
  private onLeave = () => { this.mouse.in = false; };
  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (this.paused) return;
    const before = this.toWorld(e.offsetX, e.offsetY);
    const z = clamp(this.cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.22, 1.7);
    this.cam.zoom = z;
    const after = this.toWorld(e.offsetX, e.offsetY);
    this.cam.x = clamp(this.cam.x + before.x - after.x, 0, WORLD_W);
    this.cam.y = clamp(this.cam.y + before.y - after.y, 0, WORLD_H);
  };
  zoomBy(f: number) { this.cam.zoom = clamp(this.cam.zoom * f, 0.22, 1.7); }

  private shipAt(sx: number, sy: number): Ship | null {
    let best: Ship | null = null;
    let bd = 1e9;
    for (const s of this.ships) {
      if (s.faction !== 0 || s.dead) continue;
      const p = this.toScreen(s.x, s.y);
      const d = Math.hypot(p.x - sx, p.y - sy);
      const lim = SHIPS[s.kind].radius * this.cam.zoom + 14;
      if (d < lim && d < bd) { bd = d; best = s; }
    }
    return best;
  }
  private clickSelect(sx: number, sy: number, add: boolean) {
    const s = this.shipAt(sx, sy);
    if (!s) { if (!add) this.sel = []; return; }
    const now = performance.now();
    if (this.lastClick.id === s.id && now - this.lastClick.t < 380) {
      this.selectIds(this.ships.filter((o) => o.faction === 0 && !o.dead && o.kind === s.kind).map((o) => o.id));
    } else if (add) {
      this.selectIds(this.sel.includes(s.id) ? this.sel.filter((i) => i !== s.id) : [...this.sel, s.id]);
    } else this.selectIds([s.id]);
    this.lastClick = { t: now, id: s.id };
  }
  private boxSelect(d: { x0: number; y0: number; x1: number; y1: number }, add: boolean) {
    const x0 = Math.min(d.x0, d.x1), x1 = Math.max(d.x0, d.x1), y0 = Math.min(d.y0, d.y1), y1 = Math.max(d.y0, d.y1);
    const ids: number[] = [];
    for (const s of this.ships) {
      if (s.faction !== 0 || s.dead) continue;
      const p = this.toScreen(s.x, s.y);
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) ids.push(s.id);
    }
    if (ids.length) this.selectIds(add ? [...new Set([...this.sel, ...ids])] : ids);
    else if (!add) this.sel = [];
  }
  private tap(sx: number, sy: number) {
    const s = this.shipAt(sx, sy);
    if (s) { this.selectIds([s.id]); return; }
    if (this.selectedShips().length) { const w = this.toWorld(sx, sy); this.commandAt(w.x, w.y); }
  }
  selectIds(ids: number[]) {
    this.sel = ids;
    this.stats.selects++;
    audio.play('select');
  }
  selectAll() { this.selectIds(this.fleet().map((s) => s.id)); }
  focusSel() {
    const s = this.selectedShips();
    if (s.length) {
      this.cam.x = s.reduce((a, b) => a + b.x, 0) / s.length;
      this.cam.y = s.reduce((a, b) => a + b.y, 0) / s.length;
    } else { this.cam.x = this.station.x; this.cam.y = this.station.y; }
  }
  focusAt(x: number, y: number) { this.cam.x = clamp(x, 0, WORLD_W); this.cam.y = clamp(y, 0, WORLD_H); }

  commandAt(wx: number, wy: number) {
    const sel = this.selectedShips();
    if (!sel.length) return;
    const zr = 16 / this.cam.zoom;
    let tgt: Ship | null = null;
    let bd = 1e9;
    for (const o of this.ships) {
      if (o.faction === 0 || o.dead || !o.vis) continue;
      const d = dist(wx, wy, o.x, o.y) - SHIPS[o.kind].radius;
      if (d < zr && d < bd) { bd = d; tgt = o; }
    }
    let wr: Wreck | null = null;
    bd = 1e9;
    for (const w of this.wrecks) {
      if (w.fade !== 0 || !w.revealed) continue;
      const d = dist(wx, wy, w.x, w.y) - w.r;
      if (d < zr * 0.7 && d < bd) { bd = d; wr = w; }
    }
    const st = this.station;
    const onStation = dist(wx, wy, st.x, st.y) < st.r + 14;
    this.pings.push({ x: wx, y: wy, t: 0.55, color: tgt ? '#ff6b57' : wr ? '#ffd36e' : '#4de1ff' });
    audio.play('order');
    let i = 0;
    const n = sel.length;
    for (const s of sel) {
      const def = SHIPS[s.kind];
      if (tgt && def.dps > 0) {
        if (!this.hostile(s.faction, tgt.faction)) this.provoke(tgt.faction);
        this.order(s, { t: 'attack', id: tgt.id });
        s.manual = true;
      } else if (wr && def.tow > 0) {
        this.order(s, { t: 'tow', id: wr.id });
        s.manual = true;
        this.stats.towOrders++;
      } else if (wr && def.cut > 0) {
        this.order(s, { t: 'cut', id: wr.id });
        s.manual = true;
        this.stats.cutOrders++;
      } else if (onStation) {
        this.order(s, { t: 'return' });
      } else {
        const ang = i * 2.4;
        const rad = n > 1 ? 20 + Math.sqrt(i) * 24 : 0;
        this.order(s, { t: 'move', x: clamp(wx + Math.cos(ang) * rad, 20, WORLD_W - 20), y: clamp(wy + Math.sin(ang) * rad, 20, WORLD_H - 20) });
        s.auto = false;
        s.manual = true;
      }
      i++;
    }
  }
  order(s: Ship, o: Partial<Order> & { t: Order['t'] }) {
    this.detach(s);
    s.order = { x: 0, y: 0, id: 0, ...o };
    s.target = 0;
    s.stall = 0;
    s.manual = false;
  }
  detach(s: Ship) {
    if (s.attached) {
      const w = this.wreckMap.get(s.attached);
      if (w) w.tugs = w.tugs.filter((i) => i !== s.id);
      s.attached = 0;
    }
  }
  toggleAuto() {
    const sel = this.selectedShips();
    if (!sel.length) return;
    const on = !sel.every((s) => s.auto);
    sel.forEach((s) => { s.auto = on; if (on && s.order.t === 'move') s.order = idleOrder(); });
    this.stats.autoToggles++;
    this.ftext(sel[0].x, sel[0].y - 24, on ? 'AUTO ON' : 'AUTO OFF', '#4de1ff', 13);
    audio.play('click');
  }
  stopSel() {
    for (const s of this.selectedShips()) { this.order(s, { t: 'idle' }); s.auto = false; }
    audio.play('click');
  }
  returnSel() {
    for (const s of this.selectedShips()) this.order(s, { t: 'return' });
    audio.play('order');
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const tg = e.target as HTMLElement | null;
    if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'SELECT' || tg.tagName === 'TEXTAREA')) return;
    const k = e.key.toLowerCase();
    if (!e.ctrlKey && !e.metaKey) this.keys.add(k);
    if (this.paused || this.over) return;
    if (k === ' ' || k === 'tab' || k.startsWith('arrow')) e.preventDefault();
    if (e.repeat) return;
    const dm = /^Digit([1-9])$/.exec(e.code);
    if (dm) {
      const n = Number(dm[1]);
      if (e.ctrlKey || e.shiftKey || e.metaKey) {
        e.preventDefault();
        this.groups[n] = [...this.sel];
        this.msg(`Group ${n} assigned (${this.sel.length} ships).`, '#9ad');
      } else if (this.groups[n]) {
        const ids = this.groups[n].filter((i) => { const s = this.shipMap.get(i); return s && !s.dead; });
        if (ids.length) {
          const now = performance.now();
          this.selectIds(ids);
          if (this.lastGroup.n === n && now - this.lastGroup.t < 400) this.focusSel();
          this.lastGroup = { t: now, n };
        }
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && k === 'a') { e.preventDefault(); this.selectAll(); return; }
    if (e.ctrlKey || e.metaKey) return;
    switch (k) {
      case 'q': this.toggleAuto(); break;
      case 'x': this.stopSel(); break;
      case 'r': this.returnSel(); break;
      case ' ': this.focusSel(); break;
      case 'v': this.cycleSpeed(); break;
      case '=': case '+': this.zoomBy(1.15); break;
      case '-': this.zoomBy(1 / 1.15); break;
      case 'tab': {
        const f = this.fleet();
        if (f.length) {
          const cur = f.findIndex((s) => s.id === this.sel[0]);
          this.selectIds([f[(cur + 1) % f.length].id]);
          this.focusSel();
        }
        break;
      }
    }
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };

  updateHover() {
    this.hoverWreck = 0;
    this.hoverShip = 0;
    if (!this.mouse.in || this.paused) return;
    const w = this.toWorld(this.mouse.x, this.mouse.y);
    let bd = 1e9;
    for (const o of this.wrecks) {
      if (o.fade !== 0 || !o.revealed) continue;
      const d = dist(w.x, w.y, o.x, o.y) - o.r;
      if (d < 10 / this.cam.zoom && d < bd) { bd = d; this.hoverWreck = o.id; }
    }
    bd = 1e9;
    for (const s of this.ships) {
      if (s.dead || !s.vis) continue;
      const d = dist(w.x, w.y, s.x, s.y) - SHIPS[s.kind].radius;
      if (d < 10 / this.cam.zoom && d < bd) { bd = d; this.hoverShip = s.id; }
    }
  }

  /* ================= update ================= */
  update(dt: number) {
    this.time += dt;
    this.sectorTime += dt;
    this.shipMap.clear();
    for (const s of this.ships) if (!s.dead) this.shipMap.set(s.id, s);
    this.wreckMap.clear();
    for (const w of this.wrecks) this.wreckMap.set(w.id, w);
    this.updateCamera(dt);
    Sys.updateMarket(this, dt);
    Sys.updateCrew(this, dt);
    Sys.updateContracts(this, dt);
    Sys.updateAuctions(this, dt);
    Sys.updateEvents(this, dt);
    Sys.updateRaids(this, dt);
    Sys.updateRivals(this, dt);
    Sys.updateDiplo(this, dt);
    this.heat = Math.max(0, this.heat - 0.35 * dt);
    this.fear = Math.max(0, this.fear - dt * 1.2);
    this.moraleBoost = Math.max(0, this.moraleBoost - dt * 0.5);
    this.updateVision(dt);
    for (const s of this.ships) if (!s.dead) this.updateShip(s, dt);
    this.updateWrecks(dt);
    this.updateProjectiles(dt);
    this.updateStation(dt);
    this.updateHazards(dt);
    this.updateFx(dt);
    this.cleanup();
    this.checkEnd(dt);
    const fl = this.fleet().length;
    if (fl > this.stats.peakFleet) this.stats.peakFleet = fl;
    // adaptive music
    let threat = 0;
    for (const s of this.ships) if (s.faction === 4 && !s.dead && s.kind !== 'mine' && s.kind !== 'sentry' && s.vis) threat++;
    audio.setIntensity(Math.min(1, threat / 7 + (this.bossId && this.shipMap.get(this.bossId) ? 0.4 : 0)));
    Sys.tutorialUpdate(this);
  }

  updateCamera(dt: number) {
    if (this.paused) return;
    const k = this.keys;
    let dx = 0, dy = 0;
    if (k.has('a') || k.has('arrowleft')) dx -= 1;
    if (k.has('d') || k.has('arrowright')) dx += 1;
    if (k.has('w') || k.has('arrowup')) dy -= 1;
    if (k.has('s') || k.has('arrowdown')) dy += 1;
    if (this.cfg.settings.edge && this.mouse.in && !this.drag && !this.pan && !this.touch) {
      const m = 8;
      if (this.mouse.x < m) dx -= 1;
      if (this.mouse.x > this.vw - m) dx += 1;
      if (this.mouse.y < m + 44 && this.mouse.y < 8) dy -= 1;
      if (this.mouse.y > this.vh - m) dy += 1;
    }
    if (dx || dy) {
      const sp = (950 / this.cam.zoom) * dt;
      this.cam.x = clamp(this.cam.x + dx * sp, 0, WORLD_W);
      this.cam.y = clamp(this.cam.y + dy * sp, 0, WORLD_H);
    }
  }

  markExplored(x: number, y: number, r: number) {
    const c0 = Math.max(0, Math.floor((x - r) / CELL)), c1 = Math.min(FW - 1, Math.floor((x + r) / CELL));
    const r0 = Math.max(0, Math.floor((y - r) / CELL)), r1 = Math.min(FH - 1, Math.floor((y + r) / CELL));
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const i = cy * FW + cx;
        if (this.explored[i]) continue;
        if (dist(cx * CELL + CELL / 2, cy * CELL + CELL / 2, x, y) <= r) { this.explored[i] = 1; this.fogDirty = true; }
      }
    }
  }
  refreshFog() {
    this.fogDirty = false;
    const c = this.fogCtx;
    if (!c) return;
    const img = c.createImageData(FW, FH);
    for (let i = 0; i < FW * FH; i++) {
      img.data[i * 4] = 2; img.data[i * 4 + 1] = 5; img.data[i * 4 + 2] = 12;
      img.data[i * 4 + 3] = this.explored[i] ? 0 : 205;
    }
    c.putImageData(img, 0, 0);
  }
  nearestUnexplored(s: Ship): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = 1e9;
    const haz = this.ships.filter((o) => !o.dead && (o.kind === 'sentry' || o.kind === 'boss'));
    for (let cy = 0; cy < FH; cy += 2) {
      for (let cx = 0; cx < FW; cx += 2) {
        if (this.explored[cy * FW + cx]) continue;
        const x = cx * CELL + CELL / 2, y = cy * CELL + CELL / 2;
        if (haz.some((o) => dist(o.x, o.y, x, y) < 340)) continue;
        if (x > WORLD_W - 800 && y > WORLD_H - 700) continue;
        if (this.sd.boss && dist(x, y, 2750, 1650) < 520) continue;
        const d = dist(x, y, s.x, s.y);
        if (d < bd) { bd = d; best = { x, y }; }
      }
    }
    return best;
  }

  updateVision(dt: number) {
    this.visT -= dt;
    if (this.visT > 0) return;
    this.visT = 0.2;
    const friends = this.ships.filter((s) => s.faction === 0 && !s.dead);
    const st = this.station;
    const sr = 560 * (1 + 0.25 * this.l('scan')) * (1 + 0.1 * this.m('sensors'));
    this.markExplored(st.x, st.y, sr);
    const radii = friends.map((s) => this.scanR(s));
    friends.forEach((s, i) => this.markExplored(s.x, s.y, radii[i]));
    for (const w of this.wrecks) {
      if (w.revealed || w.fade !== 0) continue;
      let seen = dist(w.x, w.y, st.x, st.y) < sr + w.r;
      for (let i = 0; i < friends.length && !seen; i++) seen = dist(w.x, w.y, friends[i].x, friends[i].y) < radii[i] + w.r;
      if (seen) {
        w.revealed = true;
        const v = this.wreckValue(w);
        if (v > 260 || w.special) {
          this.msg(`Sensors: ${w.name} detected (~${Math.round(v)}cr).`, '#9ad7ff');
          this.pings.push({ x: w.x, y: w.y, t: 1, color: '#9ad7ff' });
        }
      }
    }
    for (const s of this.ships) {
      if (s.faction === 0) { s.vis = true; continue; }
      let vis = dist(s.x, s.y, st.x, st.y) < sr;
      for (let i = 0; i < friends.length && !vis; i++) vis = dist(s.x, s.y, friends[i].x, friends[i].y) < radii[i] * 1.05;
      s.vis = vis;
    }
  }

  /* ================= ships ================= */
  moveToward(s: Ship, tx: number, ty: number, dt: number, stop = 3): number {
    const dx = tx - s.x, dy = ty - s.y;
    const d = Math.hypot(dx, dy);
    const sp = this.speedOf(s);
    let dvx = 0, dvy = 0;
    if (d > stop) {
      const v = Math.min(sp, (d - stop) * 2.5 + 8);
      dvx = (dx / d) * v;
      dvy = (dy / d) * v;
    }
    const k = Math.min(1, dt * 3.5);
    s.vx += (dvx - s.vx) * k;
    s.vy += (dvy - s.vy) * k;
    const mx = s.vx * dt, my = s.vy * dt;
    s.x = clamp(s.x + mx, 20, WORLD_W - 20);
    s.y = clamp(s.y + my, 20, WORLD_H - 20);
    if (Math.hypot(s.vx, s.vy) > 8) s.ang = angLerp(s.ang, Math.atan2(s.vy, s.vx), Math.min(1, dt * 8));
    if (s.faction === 0) this.burnFuel(Math.hypot(mx, my) * SHIPS[s.kind].fuel);
    s.moved = true;
    return d;
  }
  orbit(s: Ship, tx: number, ty: number, dt: number, pref: number) {
    const d = Math.hypot(s.x - tx, s.y - ty);
    if (d > pref * 1.15) { this.moveToward(s, tx, ty, dt, pref); return; }
    const a = Math.atan2(s.y - ty, s.x - tx) + s.aux[0] * dt * (90 / Math.max(60, pref));
    this.moveToward(s, tx + Math.cos(a) * pref, ty + Math.sin(a) * pref, dt, 2);
  }
  fire(s: Ship, tx: number, ty: number) {
    if (s.cd > 0 || s.disabled > 0) return;
    const def = SHIPS[s.kind];
    s.cd = def.rate;
    const dmg = def.dps * def.rate * this.dmgMult(s);
    const a = Math.atan2(ty - s.y, tx - s.x) + (this.rng() - 0.5) * 0.05;
    const r = def.radius;
    this.projs.push({
      x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, vx: Math.cos(a) * def.shot, vy: Math.sin(a) * def.shot, dmg,
      faction: s.faction, life: def.range / def.shot + 0.2, color: s.faction === 0 ? '#9dffd0' : s.faction === 4 ? '#ffb040' : FACTIONS[s.faction].color,
      r: s.kind === 'bomber' ? 4.5 : 2.4, src: s.id, big: s.kind === 'bomber',
    });
    if (s.vis) audio.play(s.faction === 0 ? 'laser' : 'shot');
  }
  targetOf(id: number): { x: number; y: number; r: number; ship?: Ship } | null {
    if (id === -1) return { x: this.station.x, y: this.station.y, r: this.station.r };
    if (!id) return null;
    const s = this.shipMap.get(id);
    if (!s || s.dead) return null;
    return { x: s.x, y: s.y, r: SHIPS[s.kind].radius, ship: s };
  }
  pickTarget(s: Ship): number {
    const def = SHIPS[s.kind];
    const acq = s.faction === 0 ? 650 : Math.max(def.range * 1.6, 520);
    if (s.kind === 'bomber' && dist(s.x, s.y, this.station.x, this.station.y) < 1500) return -1;
    let best = 0, bd = 1e9;
    for (const o of this.ships) {
      if (o === s || o.dead || !this.hostile(s.faction, o.faction)) continue;
      if (s.faction === 0 && !o.vis) continue;
      if (o.kind === 'mine' && s.faction !== 0) continue;
      const d = dist(s.x, s.y, o.x, o.y);
      const w = o.attached ? d * 0.6 : d;
      if (d < acq && w < bd) { bd = w; best = o.id; }
    }
    if (best) return best;
    if (s.faction !== 0 && this.hostile(s.faction, 0) && (s.ai === 'raid' || s.faction === 4)) return -1;
    return 0;
  }

  updateShip(s: Ship, dt: number) {
    if (s.flash > 0) s.flash -= dt;
    if (s.cd > 0) s.cd -= dt;
    if (s.aux[1] > 0) s.aux[1] -= dt;
    s.moved = false;
    if (s.disabled > 0) s.disabled -= dt;
    for (const [k, v] of s.blk) if (v < this.time) s.blk.delete(k);
    if (s.temp) {
      s.life -= dt;
      if (s.life <= 0) { this.detach(s); s.dead = true; this.burst(s.x, s.y, 14, '#9ad', 90); this.msg('Mercenary contract expired.', '#9ad'); return; }
    }
    if (s.faction === 0) {
      const mh = this.maxHpOf(s);
      if (Math.abs(mh - s.maxHp) > 0.01) { s.hp += mh - s.maxHp; s.maxHp = mh; }
      if (s.hp < s.maxHp && dist(s.x, s.y, this.station.x, this.station.y) < this.station.r + 70) s.hp = Math.min(s.maxHp, s.hp + 14 * dt);
    }
    switch (s.kind) {
      case 'tug': case 'hauler': this.updateTug(s, dt); break;
      case 'cutter': this.updateCutter(s, dt); break;
      case 'scout': this.updateScout(s, dt); break;
      case 'gunship': case 'frigate': this.updateGun(s, dt); break;
      case 'raider': case 'bomber': this.updatePirate(s, dt); break;
      case 'sentry': this.updateSentry(s, dt); break;
      case 'mine': this.updateMine(s); break;
      case 'boss': this.updateBoss(s, dt); break;
    }
    if (!s.moved && SHIPS[s.kind].speed > 0) {
      s.vx *= Math.max(0, 1 - dt * 3);
      s.vy *= Math.max(0, 1 - dt * 3);
      s.x = clamp(s.x + s.vx * dt, 20, WORLD_W - 20);
      s.y = clamp(s.y + s.vy * dt, 20, WORLD_H - 20);
    }
  }

  assignedCap(w: Wreck, f: number): number {
    let c = 0;
    for (const s of this.ships) {
      if (s.dead || s.faction !== f) continue;
      if (s.attached === w.id || (s.order.t === 'tow' && s.order.id === w.id)) c += this.towCap(s);
    }
    return c;
  }
  pickWreck(s: Ship, mode: 'tow' | 'cut'): Wreck | null {
    const f = s.faction;
    let best: Wreck | null = null;
    let bs = -1;
    const cap = mode === 'tow' ? this.towCap(s) : 0;
    const thief = s.ai === 'thief' && this.rel[3] < 25;
    let idleCap = 0;
    if (mode === 'tow') {
      for (const o of this.ships) {
        if (o.dead || o.faction !== f || (o.kind !== 'tug' && o.kind !== 'hauler')) continue;
        if (o.order.t === 'idle' && !o.attached && (f !== 0 || o.auto)) idleCap += this.towCap(o);
      }
    }
    for (const w of this.wrecks) {
      if (w.fade !== 0 || w.special === 'leviathan') continue;
      if (f === 0 && !w.revealed) continue;
      const bl = s.blk.get(w.id);
      if (bl !== undefined && bl > this.time) continue;
      if (w.owner !== -1 && w.owner !== f) {
        if (f === 0) continue;
        if (!thief && !(w.owner === 0 && this.rel[f] <= -20 && this.treaty[f] <= 0)) continue;
      }
      if (mode === 'cut' && w.kind === 'reactor') continue;
      if (f !== 0 && w.special === 'prize' && w.owner !== f) continue;
      let guarded = false;
      for (const o of this.ships) {
        if (!o.dead && o.faction === 4 && (o.kind === 'sentry' || o.kind === 'mine') && dist(o.x, o.y, w.x, w.y) < w.r + 130) { guarded = true; break; }
      }
      if (guarded) continue;
      let boost = 1;
      if (mode === 'tow') {
        const need = w.mass * 0.4;
        const cur = this.assignedCap(w, f);
        if (cur <= 0 && need > Math.max(cap, idleCap * 0.85)) continue;
        if (cur >= need * 1.35 && !thief) continue;
        if (cur > 0) boost = 1.6;
        if (thief && w.tugs.length) {
          const other = w.tugs.some((id) => { const o = this.shipMap.get(id); return !!o && o.faction !== f; });
          if (other) boost = 3;
        }
        if (f !== 0 && w.tugs.length && !thief) {
          const other = w.tugs.some((id) => { const o = this.shipMap.get(id); return !!o && o.faction !== f; });
          if (other) continue;
        }
      } else {
        if (w.tugs.length) continue;
      }
      const d = dist(s.x, s.y, w.x, w.y);
      const score = (this.wreckValue(w) / (d + 250)) * boost;
      if (score > bs) { bs = score; best = w; }
    }
    return best;
  }

  updateTug(s: Ship, dt: number) {
    const o = s.order;
    if (s.attached) {
      const w = this.wreckMap.get(s.attached);
      if (!w || o.t !== 'tow' || o.id !== w.id) this.detach(s);
      else { s.moved = true; return; }
    }
    const dock = this.dockOf(s.faction);
    if (o.t === 'tow') {
      const w = this.wreckMap.get(o.id);
      if (!w || w.fade !== 0) { s.order = idleOrder(); return; }
      const gap = Math.hypot(w.x - s.x, w.y - s.y) - w.r;
      if (gap <= this.beamRange(s)) this.attach(s, w);
      else this.moveToward(s, w.x, w.y, dt, w.r + this.beamRange(s) * 0.5);
      return;
    }
    if (o.t === 'move') { if (this.moveToward(s, o.x, o.y, dt, 6) < 8) s.order = idleOrder(); return; }
    if (o.t === 'return') { if (this.moveToward(s, dock.x, dock.y, dt, dock.r * 0.8) < dock.r + 10) s.order = idleOrder(); return; }
    if (s.faction === 0 && !s.auto) return;
    s.t -= dt;
    if (s.t > 0) { if (s.faction !== 0) this.moveToward(s, dock.x + Math.cos(s.id) * 120, dock.y + Math.sin(s.id) * 120, dt, 10); return; }
    s.t = 0.6 + this.rng() * 0.5;
    const w = this.pickWreck(s, 'tow');
    if (w) this.order(s, { t: 'tow', id: w.id });
  }
  attach(s: Ship, w: Wreck) {
    if (!w.tugs.includes(s.id)) w.tugs.push(s.id);
    s.attached = w.id;
    s.stall = 0;
    this.checkPoach(s, w);
    if (s.faction === 0) { audio.play('attach'); this.pings.push({ x: w.x, y: w.y, t: 0.5, color: '#4de1ff' }); }
  }
  checkPoach(s: Ship, w: Wreck) {
    if (w.owner < 0 || w.owner === s.faction || w.poached.includes(s.faction)) return;
    w.poached.push(s.faction);
    if (s.faction === 0) {
      this.rel[w.owner] = Math.max(-100, this.rel[w.owner] - 14);
      this.stats.poached++;
      this.msg(`You poached a ${FACTIONS[w.owner].tag} claim: relations -14.`, '#ff9a6b');
    } else if (w.owner === 0) {
      this.rel[s.faction] = Math.max(-100, this.rel[s.faction] - 10);
      this.msg(`${FACTIONS[s.faction].name} is poaching your claim on ${w.name}!`, '#ff6b57');
      this.pings.push({ x: w.x, y: w.y, t: 1.2, color: '#ff6b57' });
      audio.play('warn');
    }
  }
  unload(s: Ship) {
    const load = bagUnits(s.cargo);
    if (load < 0.5) return;
    const bag = emptyBag();
    const c = this.crewOf(s);
    const ym = 1 + 0.07 * this.l('yield') + (c && c.trait === 'scrapper' ? 0.12 : 0);
    for (const r of RES_LIST) bag[r] = s.cargo[r] * ym;
    s.cargo = emptyBag();
    this.deposit(bag, s.x, s.y);
    if (c) c.xp += bagValue(bag) / 5;
  }
  deposit(bag: ResBag, x: number, y: number) {
    let val = 0;
    for (const r of RES_LIST) { this.stock[r] += bag[r]; val += bag[r] * RES_INFO[r].base; }
    this.delivered += val;
    this.stats.delivered += val;
    this.heat = Math.min(100, this.heat + val / 12);
    this.moraleBoost = Math.min(25, this.moraleBoost + 4);
    this.ftext(x, y - 20, `+${Math.round(val)} value`, '#ffd36e', 16);
    this.burst(this.station.x, this.station.y, 18, '#ffd36e', 140, 0.8);
    audio.play('deliver');
  }

  updateCutter(s: Ship, dt: number) {
    const o = s.order;
    const cap = this.cargoCap(s);
    const load = bagUnits(s.cargo);
    const st = this.station;
    if (o.t === 'return') {
      const d = this.moveToward(s, st.x, st.y, dt, st.r * 0.7);
      if (d < st.r + 30) {
        this.unload(s);
        const w = this.wreckMap.get(s.resume);
        s.order = w && w.fade === 0 ? { t: 'cut', x: 0, y: 0, id: w.id } : idleOrder();
        s.resume = 0;
      }
      return;
    }
    if (o.t === 'move') { if (this.moveToward(s, o.x, o.y, dt, 6) < 8) s.order = idleOrder(); return; }
    if (o.t === 'cut') {
      const w = this.wreckMap.get(o.id);
      if (!w || w.fade !== 0) { s.order = load > 1 ? { t: 'return', x: 0, y: 0, id: 0 } : idleOrder(); return; }
      if (load >= cap - 0.01) { s.resume = w.id; s.order = { t: 'return', x: 0, y: 0, id: 0 }; return; }
      const gap = Math.hypot(w.x - s.x, w.y - s.y) - w.r;
      if (gap > 62) { this.moveToward(s, w.x, w.y, dt, w.r + 45); return; }
      s.moved = true;
      this.checkPoach(s, w);
      const tot = bagUnits(w.loot);
      const rate = SHIPS.cutter.cut * (1 + 0.28 * this.l('cut')) * this.crewMult(s, 'work');
      const take = Math.min(rate * dt, cap - load, tot);
      if (tot > 0.01 && take > 0) {
        for (const r of RES_LIST) {
          const a = (take * w.loot[r]) / tot;
          w.loot[r] -= a;
          s.cargo[r] += a * 0.85;
        }
      }
      s.aux[1] = 0.25;
      s.ang = angLerp(s.ang, Math.atan2(w.y - s.y, w.x - s.x), Math.min(1, dt * 8));
      if (this.rng() < dt * 6) this.burst(w.x + (s.x - w.x) * 0.5, w.y + (s.y - w.y) * 0.5, 2, '#ffa44d', 60, 0.4);
      if (w.kind === 'reactor') w.instab += (9 * dt) / (1 + 0.1 * (this.crewOf(s)?.skill ?? 0));
      if (bagUnits(w.loot) < 0.4) {
        this.stats.cut++;
        this.destroyWreck(w);
        this.ftext(w.x, w.y, 'Stripped', '#ffa44d', 13);
      }
      return;
    }
    if (!s.auto) return;
    if (load > cap * 0.5) { s.order = { t: 'return', x: 0, y: 0, id: 0 }; return; }
    s.t -= dt;
    if (s.t > 0) return;
    s.t = 0.7;
    const w = this.pickWreck(s, 'cut');
    if (w) this.order(s, { t: 'cut', id: w.id });
    else if (load > 1) s.order = { t: 'return', x: 0, y: 0, id: 0 };
  }

  updateScout(s: Ship, dt: number) {
    const o = s.order;
    if (o.t === 'move') { if (this.moveToward(s, o.x, o.y, dt, 8) < 10) s.order = idleOrder(); return; }
    if (o.t === 'return') { if (this.moveToward(s, this.station.x, this.station.y, dt, 60) < 90) s.order = idleOrder(); return; }
    if (!s.auto) return;
    s.t -= dt;
    if (s.t > 0) return;
    s.t = 1;
    const c = this.nearestUnexplored(s);
    if (c) s.order = { t: 'move', x: c.x, y: c.y, id: 0 };
    else s.order = { t: 'move', x: this.rr(200, WORLD_W - 700), y: this.rr(200, WORLD_H - 700), id: 0 };
  }

  updateGun(s: Ship, dt: number) {
    const def = SHIPS[s.kind];
    const o = s.order;
    const dock = this.dockOf(s.faction);
    s.t -= dt;
    if (s.t <= 0) {
      s.t = 0.35;
      s.target = o.t === 'attack' ? o.id : this.pickTarget(s);
    }
    const tgt = this.targetOf(s.target);
    const dd = tgt ? dist(s.x, s.y, tgt.x, tgt.y) : 1e9;
    if (o.t === 'attack') {
      const t = this.shipMap.get(o.id);
      if (!t || t.dead || (!this.hostile(s.faction, t.faction))) { s.order = idleOrder(); return; }
      this.orbit(s, t.x, t.y, dt, def.range * 0.7);
      if (dd <= def.range) this.fire(s, t.x, t.y);
      return;
    }
    if (o.t === 'move' || o.t === 'return') {
      const tx = o.t === 'move' ? o.x : dock.x, ty = o.t === 'move' ? o.y : dock.y;
      const d = this.moveToward(s, tx, ty, dt, o.t === 'move' ? 8 : dock.r * 0.9);
      if (tgt && dd <= def.range) this.fire(s, tgt.x, tgt.y);
      if (d < (o.t === 'move' ? 10 : dock.r + 30)) s.order = idleOrder();
      return;
    }
    const canChase = s.faction !== 0 || s.auto;
    if (tgt && (canChase || dd <= def.range)) {
      if (dd > def.range * 0.8 && canChase) this.moveToward(s, tgt.x, tgt.y, dt, def.range * 0.7);
      else if (canChase) this.orbit(s, tgt.x, tgt.y, dt, def.range * 0.7);
      if (dd <= def.range) this.fire(s, tgt.x, tgt.y);
      return;
    }
    if (s.faction === 0 && !s.auto) return;
    // guard: escort the most valuable tow, else patrol near dock
    let ax = dock.x, ay = dock.y, rad = 170;
    let bv = 0;
    for (const w of this.wrecks) {
      if (!w.tugs.length || w.fade !== 0) continue;
      const lead = this.shipMap.get(w.tugs[0]);
      if (!lead || lead.faction !== s.faction) continue;
      const v = this.wreckValue(w);
      if (v > bv) { bv = v; ax = w.x; ay = w.y; rad = w.r + 90; }
    }
    const a = s.id * 2.4 + this.time * 0.15;
    this.moveToward(s, ax + Math.cos(a) * rad, ay + Math.sin(a) * rad, dt, 20);
  }

  updatePirate(s: Ship, dt: number) {
    const def = SHIPS[s.kind];
    s.t -= dt;
    if (s.t <= 0) { s.t = 0.5; s.target = this.pickTarget(s) || -1; }
    let tgt = this.targetOf(s.target);
    if (!tgt) { s.target = -1; tgt = this.targetOf(-1); }
    if (!tgt) return;
    const d = dist(s.x, s.y, tgt.x, tgt.y) - tgt.r;
    this.orbit(s, tgt.x, tgt.y, dt, def.range * 0.7 + tgt.r);
    if (d <= def.range) this.fire(s, tgt.x, tgt.y);
  }

  updateSentry(s: Ship, dt: number) {
    const def = SHIPS.sentry;
    s.t -= dt;
    if (s.t <= 0) {
      s.t = 0.4;
      s.target = 0;
      let bd = def.range;
      for (const o of this.ships) {
        if (o.dead || o === s || !this.hostile(4, o.faction) || o.kind === 'mine' || o.kind === 'sentry' || o.faction === 4) continue;
        const d = dist(s.x, s.y, o.x, o.y);
        if (d < bd) { bd = d; s.target = o.id; }
      }
    }
    const t = this.targetOf(s.target);
    if (t) {
      s.ang = angLerp(s.ang, Math.atan2(t.y - s.y, t.x - s.x), Math.min(1, dt * 6));
      if (dist(s.x, s.y, t.x, t.y) <= def.range) this.fire(s, t.x, t.y);
    }
  }

  updateMine(s: Ship) {
    for (const o of this.ships) {
      if (o.dead || o.faction === 4 || o === s) continue;
      if (dist(o.x, o.y, s.x, s.y) < 56) {
        s.dead = true;
        this.explosion(s.x, s.y, 20, '#ff6040');
        audio.play('boom');
        this.addShake(5);
        const dm = 45 * this.diff.dmg;
        for (const q of this.ships) if (!q.dead && q.faction !== 4 && dist(q.x, q.y, s.x, s.y) < 80) this.damageShip(q, dm, 4, 0);
        return;
      }
    }
  }

  updateBoss(s: Ship, dt: number) {
    const frac = s.hp / s.maxHp;
    const ph = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    if (ph !== this.bossPhase) {
      if (this.bossPhase > 0) {
        this.msg(`⚠ MAW enters phase ${ph}!`, '#ff7a2f');
        this.addShake(18);
        audio.play('alarm');
      }
      this.bossPhase = ph;
      s.aux[3] = 2;
    }
    if (s.aux[3] > 0) s.aux[3] -= dt;
    if (ph >= 2) {
      s.aux[7] -= dt;
      if (s.aux[7] <= 0) { s.aux[3] = 3; s.aux[7] = 13; this.ftext(s.x, s.y - 60, 'SHIELDED', '#6fb1ff', 16); }
    }
    let near: Ship | null = null;
    let bd = 950;
    for (const o of this.ships) {
      if (o.faction !== 0 || o.dead) continue;
      const d = dist(s.x, s.y, o.x, o.y);
      if (d < bd) { bd = d; near = o; }
    }
    const lev = this.wrecks.find((w) => w.special === 'leviathan' && w.fade === 0);
    if (near) this.orbit(s, near.x, near.y, dt, 330);
    else if (lev && lev.tugs.length) this.moveToward(s, lev.x, lev.y, dt, 200);
    else if (lev) this.orbit(s, lev.x, lev.y, dt, 280);
    s.ang = angLerp(s.ang, near ? Math.atan2(near.y - s.y, near.x - s.x) : s.ang + 0.2, Math.min(1, dt * 3));
    s.aux[4] -= dt;
    if (near && bd < 520 && s.aux[4] <= 0) {
      s.aux[4] = ph === 1 ? 2.2 : ph === 2 ? 1.8 : 1.3;
      const n = ph === 3 ? 5 : 3;
      const base = Math.atan2(near.y - s.y, near.x - s.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.16;
        this.projs.push({ x: s.x + Math.cos(a) * 50, y: s.y + Math.sin(a) * 50, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, dmg: 16 * this.diff.dmg, faction: 4, life: 2, color: '#ff8a3a', r: 4, src: s.id, big: true });
      }
      audio.play('shot');
    }
    if (ph >= 3) {
      s.aux[5] -= dt;
      if (s.aux[5] <= 0) { s.aux[2] = 0.9; s.aux[5] = 4.4; }
    }
    if (s.aux[2] > 0) {
      s.aux[2] -= dt;
      if (s.aux[2] <= 0) {
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2 + this.time;
          this.projs.push({ x: s.x, y: s.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, dmg: 12 * this.diff.dmg, faction: 4, life: 3, color: '#ff4a4a', r: 3.5, src: s.id, big: true });
        }
        this.addShake(10);
        audio.play('boom');
        this.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: 30, color: '#ff4a4a', kind: 'ring', grow: 500 });
      }
    }
    if (ph >= 2) {
      s.aux[6] -= dt;
      if (s.aux[6] <= 0) {
        s.aux[6] = 11;
        for (let i = 0; i < 2; i++) this.spawn('raider', 4, s.x + this.rr(-40, 40), s.y + this.rr(-40, 40), 'raid');
        this.msg('MAW launches raiders!', '#ffc933');
      }
    }
  }

  /* ================= wrecks ================= */
  destroyWreck(w: Wreck) {
    if (w.fade !== 0) return;
    w.fade = 1;
    for (const id of w.tugs) {
      const s = this.shipMap.get(id);
      if (s) { s.attached = 0; if (s.order.t === 'tow') s.order = idleOrder(); }
    }
    w.tugs = [];
  }
  explodeWreck(w: Wreck) {
    this.explosion(w.x, w.y, 46, '#7affd8');
    this.addShake(14);
    audio.play('boom');
    this.msg(`${w.name} went critical!`, '#ff9a6b');
    for (const s of this.ships) {
      if (s.dead) continue;
      const d = dist(s.x, s.y, w.x, w.y);
      if (d < 190) this.damageShip(s, 70 * (1 - d / 260), 0, 0);
    }
    if (dist(this.station.x, this.station.y, w.x, w.y) < 230) this.damageStation(60);
    for (const o of this.wrecks) if (o !== w && o.kind === 'reactor' && dist(o.x, o.y, w.x, w.y) < 260) o.instab += 55;
    this.destroyWreck(w);
  }
  updateWrecks(dt: number) {
    const tick5 = Math.floor(this.time * 0.25) !== Math.floor((this.time - dt) * 0.25);
    for (const w of this.wrecks) {
      if (w.fade > 0) { w.fade -= dt * 2; if (w.fade <= 0) w.fade = -1; continue; }
      if (w.fade < 0) continue;
      w.rot += w.rv * dt;
      w.tugs = w.tugs.filter((id) => { const s = this.shipMap.get(id); return !!s && !s.dead && s.attached === w.id; });
      if (w.kind === 'reactor') {
        w.instab = Math.max(0, w.instab - (w.tugs.length ? 8 : 3) * dt);
        if (w.instab >= 100) { this.explodeWreck(w); continue; }
      }
      if (w.tugs.length) {
        const caps: Record<number, number> = {};
        const members: Record<number, Ship[]> = {};
        for (const id of w.tugs) {
          const s = this.shipMap.get(id);
          if (!s) continue;
          caps[s.faction] = (caps[s.faction] || 0) + this.towCap(s);
          (members[s.faction] = members[s.faction] || []).push(s);
        }
        let leader = -1, best = 0;
        for (const k of Object.keys(caps)) if (caps[Number(k)] > best) { best = caps[Number(k)]; leader = Number(k); }
        let others = 0;
        for (const k of Object.keys(caps)) if (Number(k) !== leader) others += caps[Number(k)];
        const factor = (best - others) / w.mass;
        w.leader = leader;
        const dock = this.dockOf(leader);
        const dx = dock.x - w.x, dy = dock.y - w.y;
        const dd = Math.hypot(dx, dy) || 1;
        let spd = 0;
        w.stalled = factor < 0.4;
        if (!w.stalled) {
          let minSp = 1e9;
          for (const s of members[leader] || []) minSp = Math.min(minSp, this.speedOf(s));
          spd = minSp * Math.min(1, factor) * 0.95;
        }
        const k = Math.min(1, dt * 2.2);
        w.vx += ((dx / dd) * spd - w.vx) * k;
        w.vy += ((dy / dd) * spd - w.vy) * k;
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        w.speed = Math.hypot(w.vx, w.vy);
        if (leader === 0) for (const s of members[0] || []) this.burnFuel(w.speed * dt * SHIPS[s.kind].fuel);
        // formation slots
        const base = Math.atan2(dy, dx);
        let gi = 0;
        for (const k2 of Object.keys(caps)) {
          const f = Number(k2);
          const arr = members[f] || [];
          const bAng = f === leader ? base : base + Math.PI + gi * 0.9;
          if (f !== leader) gi++;
          arr.forEach((s, i) => {
            const ang = bAng + (i - (arr.length - 1) / 2) * 0.6;
            const rad = w.r + 26;
            s.x += (w.x + Math.cos(ang) * rad - s.x) * Math.min(1, dt * 5);
            s.y += (w.y + Math.sin(ang) * rad - s.y) * Math.min(1, dt * 5);
            s.vx = w.vx; s.vy = w.vy;
            s.ang = angLerp(s.ang, Math.atan2(s.y - w.y, s.x - w.x), Math.min(1, dt * 6));
            if (w.stalled) s.stall += dt; else s.stall = 0;
            if (s.stall > 22 && !s.manual) { s.blk.set(w.id, this.time + 60); this.detach(s); s.order = idleOrder(); s.stall = 0; }
          });
        }
        if (w.stalled && tick5 && (members[0] || []).length) {
          this.ftext(w.x, w.y - w.r - 14, `Needs ${Math.ceil(w.mass * 0.4)} tow power`, '#ff9a6b', 13);
        }
        if (leader > 0 && (members[0] || []).length && !w.stalled && tick5) {
          this.msg(`${FACTIONS[leader].name} is hijacking ${w.name}!`, '#ff6b57');
          this.pings.push({ x: w.x, y: w.y, t: 1, color: '#ff6b57' });
          this.stats.stolen++;
        }
        if (dd < dock.r + w.r * 0.35 + 8) this.deliver(w, leader, members[leader] || []);
      } else {
        w.stalled = false;
        w.vx *= Math.max(0, 1 - dt * 0.8);
        w.vy *= Math.max(0, 1 - dt * 0.8);
        w.x += (w.vx + Math.cos(w.id * 1.7) * 0.5) * dt;
        w.y += (w.vy + Math.sin(w.id * 1.3) * 0.5) * dt;
        w.speed = 0;
      }
      w.x = clamp(w.x, 60, WORLD_W - 60);
      w.y = clamp(w.y, 60, WORLD_H - 60);
    }
  }
  deliver(w: Wreck, f: number, tugs: Ship[]) {
    const value = bagValue(w.loot);
    if (f === 0) {
      let ym = 1 + 0.07 * this.l('yield');
      if (tugs.some((s) => this.crewOf(s)?.trait === 'scrapper')) ym += 0.12;
      const bag = emptyBag();
      for (const r of RES_LIST) bag[r] = w.loot[r] * ym;
      this.deposit(bag, w.x, w.y);
      this.stats.towed++;
      for (const s of tugs) {
        const c = this.crewOf(s);
        if (c) c.xp += value / Math.max(1, tugs.length) / 4;
      }
      if (w.special === 'leviathan') { this.levDelivered = true; this.explosion(this.station.x, this.station.y, 60, '#ffd36e'); }
      if (w.special === 'prize') this.msg(`Prize salvage delivered: ${w.name}!`, '#ffd36e');
    } else if (f >= 1 && f <= 3) {
      const r = this.rivals[f];
      r.credits += value * 0.9;
      r.delivered += value;
      this.ftext(this.dockOf(f).x, this.dockOf(f).y - 40, `+${Math.round(value)}`, FACTIONS[f].color, 13);
    }
    for (const s of tugs) { s.order = idleOrder(); s.attached = 0; s.manual = false; }
    w.tugs = [];
    w.fade = 1;
  }

  /* ================= combat ================= */
  damageShip(t: Ship, dmg: number, srcF: number, srcId: number) {
    if (t.dead) return;
    if (t.kind === 'boss' && t.aux[3] > 0) dmg *= 0.15;
    if (t.faction === 0 && this.crewOf(t)?.trait === 'reckless') dmg *= 1.2;
    if (t.kind === 'boss') this.stats.bossDamage += dmg;
    t.hp -= dmg;
    t.flash = 0.12;
    if (dmg > 6 && this.rng() < 0.35 && t.vis) this.ftext(t.x + this.rr(-8, 8), t.y - 12, String(Math.round(dmg)), t.faction === 0 ? '#ff9a9a' : '#ffffff', 11);
    if (t.hp <= 0) this.killShip(t, srcF, srcId);
  }
  killShip(t: Ship, srcF: number, srcId: number) {
    if (t.dead) return;
    t.dead = true;
    this.detach(t);
    const def = SHIPS[t.kind];
    const big = def.radius > 12;
    if (t.kind !== 'mine') {
      this.explosion(t.x, t.y, big ? 30 : 16, t.faction === 0 ? '#4de1ff' : '#ffb050');
      if (t.vis) audio.play('boom');
      this.addShake(t.kind === 'boss' ? 26 : big ? 7 : 3);
    }
    const killer = this.shipMap.get(srcId);
    if (killer) { const kc = this.crewOf(killer); if (kc) { kc.kills++; kc.xp += 25; } }
    if (t.faction === 0) {
      if (t.temp) return;
      this.stats.lost++;
      this.fear = Math.min(40, this.fear + 14);
      this.msg(`We lost a ${def.name}${t.name ? ` (${t.name})` : ''}!`, '#ff6b57');
      const c = this.crewOf(t);
      if (c) {
        if (this.rng() < 0.5) {
          this.msg(`${c.name} did not make it.`, '#ff6b57');
          this.crew = this.crew.filter((q) => q !== c);
        } else { c.ship = null; c.morale = Math.max(0, c.morale - 15); this.msg(`${c.name} escaped in a pod.`, '#9ad7ff'); }
      }
      this.sel = this.sel.filter((i) => i !== t.id);
    } else {
      if (t.faction === 4 && srcF === 0) {
        const b = t.kind === 'boss' ? 1500 : t.kind === 'bomber' ? 55 : t.kind === 'sentry' ? 40 : 28;
        this.credits += b;
        this.stats.earned += b;
        this.ftext(t.x, t.y - 16, `+${b} bounty`, '#ffd36e', 14);
        this.stats.kills++;
        if (t.kind === 'boss') { this.stats.bossKilled = true; this.msg('DREADNOUGHT MAW DESTROYED! The Leviathan is unguarded.', '#ffd36e'); this.bossId = 0; }
        for (const f of [1, 2, 3]) this.rel[f] = Math.min(100, this.rel[f] + 0.8);
      } else if (t.faction >= 1 && t.faction <= 3 && srcF === 0) {
        this.rel[t.faction] = Math.max(-100, this.rel[t.faction] - 12);
        this.stats.kills++;
      } else if (t.faction === 4 && srcF !== 0 && srcF >= 1) {
        /* rival kill of pirate: nothing */
      }
      if (t.kind !== 'mine' && t.kind !== 'sentry' && (t.kind === 'boss' || this.rng() < 0.4)) {
        const w = Sys.spawnDebris(this, t.x, t.y, t.kind === 'boss');
        if (w) w.revealed = true;
      }
    }
  }
  damageStation(d: number) {
    if (this.over) return;
    this.station.hp -= d;
    this.station.flash = 0.15;
    this.addShake(2);
    if (this.station.hp <= 0) this.finish('lost', 'Your station was destroyed.');
  }
  updateStation(dt: number) {
    const st = this.station;
    st.rot += dt * 0.2;
    if (st.flash > 0) st.flash -= dt;
    st.cd -= dt;
    let tg: Ship | null = null;
    let bd = 400;
    let threat = false;
    for (const o of this.ships) {
      if (o.dead || !this.hostile(0, o.faction) || o.kind === 'mine') continue;
      const d = dist(o.x, o.y, st.x, st.y);
      if (d < 700 && o.kind !== 'sentry') threat = true;
      if (d < bd) { bd = d; tg = o; }
    }
    if (tg && st.cd <= 0) {
      st.cd = 0.4;
      const a = Math.atan2(tg.y - st.y, tg.x - st.x);
      this.projs.push({ x: st.x + Math.cos(a) * st.r, y: st.y + Math.sin(a) * st.r, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, dmg: 11 * (1 + 0.25 * this.l('station')), faction: 0, life: 0.8, color: '#9dffd0', r: 2.6, src: 0, big: false });
      audio.play('laser');
    }
    if (!threat && st.hp < st.maxHp) st.hp = Math.min(st.maxHp, st.hp + 1.5 * dt);
  }
  updateProjectiles(dt: number) {
    const ps = this.projs;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      let hit = false;
      if (p.life > 0 && p.x > -50 && p.x < WORLD_W + 50 && p.y > -50 && p.y < WORLD_H + 50) {
        for (const o of this.ships) {
          if (o.dead || !this.hostile(p.faction, o.faction)) continue;
          const rr = SHIPS[o.kind].radius + p.r;
          if (Math.abs(o.x - p.x) < rr && Math.abs(o.y - p.y) < rr && dist(o.x, o.y, p.x, p.y) < rr) {
            this.damageShip(o, p.dmg, p.faction, p.src);
            this.burst(p.x, p.y, 3, p.color, 70, 0.3);
            hit = true;
            break;
          }
        }
        if (!hit && this.hostile(p.faction, 0) && dist(this.station.x, this.station.y, p.x, p.y) < this.station.r + 4) {
          this.damageStation(p.dmg);
          this.burst(p.x, p.y, 4, p.color, 80, 0.3);
          hit = true;
        }
        if (!hit) {
          for (const wr of this.wrecks) {
            if (wr.kind === 'reactor' && wr.fade === 0 && p.faction !== 0 && dist(wr.x, wr.y, p.x, p.y) < wr.r) { wr.instab += p.dmg * 0.8; hit = true; this.burst(p.x, p.y, 3, '#7affd8', 60, 0.3); break; }
          }
        }
      } else hit = true;
      if (!hit) ps[w++] = p;
    }
    ps.length = w;
  }

  updateHazards(dt: number) {
    if (this.storm) {
      const s = this.storm;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (this.time > s.until || s.x < -600 || s.x > WORLD_W + 600 || s.y < -600 || s.y > WORLD_H + 600) {
        this.storm = null;
        this.msg('The ion storm has dispersed.', '#c9a6ff');
      } else {
        for (const o of this.ships) if (!o.dead && o.kind !== 'boss' && o.kind !== 'sentry' && o.kind !== 'mine' && dist(o.x, o.y, s.x, s.y) < s.r) this.damageShip(o, 1.6 * dt * 1, 4, 0);
        for (const w of this.wrecks) if (w.kind === 'reactor' && w.fade === 0 && dist(w.x, w.y, s.x, s.y) < s.r) w.instab += 6 * dt;
        if (this.rng() < dt * 1.2) {
          const a = this.rng() * 6.28, r = this.rng() * s.r;
          const x = s.x + Math.cos(a) * r, y = s.y + Math.sin(a) * r;
          this.burst(x, y, 10, '#d6b8ff', 160, 0.3, 1.8);
          if (this.rng() < 0.4) audio.play('thunder');
        }
      }
    }
    for (const m of this.meteors) {
      m.t -= dt;
      if (m.t <= 0) {
        this.explosion(m.x, m.y, 26, '#ff8a3a');
        this.addShake(4);
        audio.play('boom');
        for (const o of this.ships) if (!o.dead && dist(o.x, o.y, m.x, m.y) < m.r + SHIPS[o.kind].radius) this.damageShip(o, 38, 4, 0);
        for (const w of this.wrecks) if (w.kind === 'reactor' && w.fade === 0 && dist(w.x, w.y, m.x, m.y) < m.r + w.r) w.instab += 45;
        if (dist(m.x, m.y, this.station.x, this.station.y) < m.r + this.station.r) this.damageStation(25);
      }
    }
    this.meteors = this.meteors.filter((m) => m.t > 0);
  }

  updateFx(dt: number) {
    let w = 0;
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const dr = Math.max(0, 1 - dt * (p.kind === 'smoke' ? 2 : 1.5));
      p.vx *= dr; p.vy *= dr;
      if (p.grow) p.size += p.grow * dt * (p.kind === 'ring' ? 1 : 0.4);
      this.parts[w++] = p;
    }
    this.parts.length = w;
    this.texts = this.texts.filter((t) => { t.life -= dt; t.y -= 26 * dt; return t.life > 0; });
    this.pings = this.pings.filter((p) => { p.t -= dt; return p.t > 0; });
    this.shake *= Math.max(0, 1 - dt * 6);
    if (this.shake < 0.05) this.shake = 0;
    if (this.station.flash > 0 && this.over) this.station.flash -= dt;
  }

  cleanup() {
    this.ships = this.ships.filter((s) => !s.dead);
    this.wrecks = this.wrecks.filter((w) => w.fade !== -1);
    if (this.bossId && !this.ships.some((s) => s.id === this.bossId)) this.bossId = 0;
    let n = 0;
    for (const s of this.ships) if (s.faction === 4 && s.ai === 'raid') n++;
    this.raidAlive = n;
  }

  /* ================= end conditions ================= */
  checkEnd(dt: number) {
    if (this.over) return;
    if (this.station.hp <= 0) { this.finish('lost', 'Your station was destroyed.'); return; }
    if (this.levDelivered) { this.finish('won', 'The Leviathan is yours.'); return; }
    if (this.quota > 0 && this.delivered >= this.quota && !this.sd.boss) {
      this.finish(this.sector === 0 ? 'trained' : 'sector', this.sector === 0 ? 'Training complete.' : 'Quota met.');
      return;
    }
    if (this.timeLimit > 0 && this.sectorTime >= this.timeLimit) { this.finish('lost', 'The charter audit expired before the quota was met.'); return; }
    this.insolT += dt;
    if (this.insolT > 1) {
      this.insolT = 0;
      if (this.fleet().length === 0 && this.credits + this.stockValue() * 0.7 < 170) this.finish('lost', 'Insolvent: no ships and no means to buy another.');
    }
  }
  calcScore(): number {
    const st = this.stats;
    let sc = st.delivered + st.kills * 25 + st.sectors * 600 + (st.bossKilled ? 2500 : 0) + this.credits * 0.2 + this.stockValue() * 0.1;
    if (this.over === 'won') sc += 4000;
    return Math.round(sc * this.diff.renown * (1 + 0.15 * this.mods.size));
  }
  finish(kind: RunResult['kind'], reason: string) {
    if (this.over) return;
    this.over = kind;
    this.overReason = reason;
    const mult = this.diff.renown * (1 + 0.25 * this.mods.size);
    let ren = (this.delivered / 900) * mult;
    if (kind === 'sector') { this.stats.sectors++; ren += (4 + 2 * this.sector) * mult; }
    if (kind === 'won') { this.stats.sectors++; ren += 24 * mult; }
    if (kind === 'trained') ren = 2;
    this.renownEarned += Math.round(ren);
    this.result = { kind, reason, score: this.calcScore(), renown: Math.round(ren), sector: this.sector, time: this.time, stats: { ...this.stats }, diff: this.diff.id };
    audio.play(kind === 'lost' ? 'lose' : kind === 'won' ? 'win' : 'sector');
    audio.setIntensity(0);
    this.keys.clear();
    this.hooks.onOver(kind);
  }
  abandon() {
    if (this.over) return;
    this.finish('lost', 'You abandoned the run.');
  }
  nextSector(boonId: string) {
    if (this.over !== 'sector') return;
    Sys.applyBoon(this, boonId);
    this.sector++;
    this.over = '';
    this.result = null;
    this.setupSector(false);
    this.msg(`Sector ${this.sector}: ${this.sd.name}. ${this.sd.blurb}`, '#ffd36e');
    audio.play('sector');
  }
  continueEndless() {
    if (this.over !== 'won') return;
    this.sector = 6;
    this.over = '';
    this.result = null;
    this.setupSector(false);
    this.msg('Endless mode: Deepfield 1. Survive as long as you can.', '#ffd36e');
  }
  info(w: Wreck) { return WRECK_INFO[w.kind]; }
}
