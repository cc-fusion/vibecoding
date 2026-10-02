import { audio } from './audio';
import { genLevel, mulberry, TILE, SURF, type Level, type Pt } from './level';
import { computeStats, MODS, TUTORIAL_STEPS, type Diff, type SiteDef, type Stats } from './data';
import type { Settings } from './save';

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rr = (a: number, b: number) => a + Math.random() * (b - a);
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const WATER = SURF * TILE;

export interface PuzzleReq { kind: 'echo' | 'rings' | 'grid'; level: number; node: number }

export interface DiveResult {
  outcome: 'success' | 'retreat' | 'death' | 'abandon' | 'training';
  cause: string;
  siteId: number;
  time: number;
  cargoValue: number;
  kept: number;
  reward: number;
  payout: number;
  creatures: number;
  nodes: number;
  nodesTotal: number;
  relics: number;
  tablets: number[];
  maxDepth: number;
  damage: number;
  shots: number;
  hits: number;
  flares: number;
  bossDown: boolean;
  coreTaken: boolean;
  threatPeak: number;
  firstClear: boolean;
}

export interface EngineOpts {
  site: SiteDef;
  save: { upgrades: Record<string, number>; codex: number[]; clears: number[] };
  diff: Diff;
  mods: string[];
  settings: Settings;
  tutorial: boolean;
  cb: { onEnd: (r: DiveResult) => void; onPuzzle: (p: PuzzleReq) => void; onPause: (p: boolean) => void; onMute?: () => void };
}

type Kind = 'fish' | 'jelly' | 'eel' | 'angler' | 'sentinel' | 'drone' | 'boss';
interface Ent {
  id: number; k: Kind; x: number; y: number; vx: number; vy: number; r: number; hp: number; max: number;
  ang: number; st: string; t: number; cd: number; stun: number; rev: number; flash: number;
  hx: number; hy: number; tx: number; ty: number; g: number; a: number; ph: number; trail: Pt[]; spawned: boolean; dead: boolean;
}
type ItemKind = 'scrap' | 'gear' | 'relic' | 'tablet' | 'core' | 'crate' | 'vent' | 'sample';
interface Item { k: ItemKind; x: number; y: number; v: number; w: number; ph: number; tab: number; rev: number; taken: boolean; hp: number }
interface Proj { x: number; y: number; vx: number; vy: number; life: number; dmg: number; own: 'p' | 'e'; r: number; col: string }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; col: string; kind: number; grav: number }
interface FText { x: number; y: number; life: number; text: string; col: string; size: number }
interface Ring { x: number; y: number; r: number; max: number; kind: 'sonar' | 'emp' | 'node'; seen: Set<object> }
interface Flare { x: number; y: number; vy: number; life: number }
interface Node { x: number; y: number; kind: 'echo' | 'rings' | 'grid'; done: boolean; cd: number; seen: boolean; lvl: number }
interface Glow { x: number; y: number; r: number; col: string; a: number }

const KIND_STATS: Record<Kind, { r: number; hp: number }> = {
  fish: { r: 6, hp: 3 }, jelly: { r: 14, hp: 20 }, eel: { r: 13, hp: 32 }, angler: { r: 24, hp: 70 },
  sentinel: { r: 18, hp: 60 }, drone: { r: 10, hp: 10 }, boss: { r: 64, hp: 520 },
};

function waterCol(d: number): [number, number, number] {
  const stops: [number, number, number, number][] = [[0, 70, 170, 190], [60, 20, 100, 130], [160, 8, 44, 76], [320, 4, 18, 40], [700, 2, 7, 18]];
  for (let i = 1; i < stops.length; i++) {
    if (d <= stops[i][0]) {
      const a = stops[i - 1];
      const b = stops[i];
      const f = clamp((d - a[0]) / (b[0] - a[0]), 0, 1);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    }
  }
  return [2, 7, 18];
}

export class Engine {
  cv: HTMLCanvasElement;
  c: CanvasRenderingContext2D;
  dark: HTMLCanvasElement;
  d: CanvasRenderingContext2D;
  mini: HTMLCanvasElement;
  mc: CanvasRenderingContext2D;
  W = 800; H = 600; dpr = 1; zoom = 1;
  o: EngineOpts;
  st: Stats;
  diff: Diff;
  mods: string[];
  settings: Settings;
  cfg: SiteDef;
  lv: Level;
  explored: Uint8Array;
  rnd: () => number;
  raf = 0; last = 0; dead = false; paused = false; ended = false; puzzleOpen = false; activePuzzle = -1;
  t = 0; time = 0; slow = 0; hitstop = 0; shake = 0; shx = 0; shy = 0; dmgFlash = 0; healFlash = 0;
  cam = { x: 0, y: 0 };
  keys = new Set<string>();
  mouse = { x: 0, y: 0 };
  mouseDown = false; useMouse = false;
  input = { mx: 0, my: 0, fire: false, boost: false, touch: false };
  pad = { ax: 0, ay: 0, fire: false, boost: false };
  padPrev: boolean[] = [];
  p!: { x: number; y: number; vx: number; vy: number; r: number; hull: number; air: number; power: number; aim: number; face: number; inv: number; flash: number; lantern: boolean; flares: number; cd: number; sonarCd: number; flareCd: number; empCd: number; reserveUsed: boolean; cargoW: number; cargoV: number; lastBubble: number };
  ents: Ent[] = []; items: Item[] = []; projs: Proj[] = []; parts: Part[] = []; texts: FText[] = []; rings: Ring[] = []; flares: Flare[] = []; nodes: Node[] = [];
  glows: Glow[] = []; warns: { x1: number; y1: number; x2: number; y2: number }[] = [];
  toasts: { text: string; col: string; t: number }[] = [];
  banner: { text: string; sub: string; t: number } | null = null;
  eid = 1;
  threat = 0; boosting = false; spawnT = 12; evT = 50; surge = { x: 0, y: 0, t: 0 }; silt = 0; bossDark = 1;
  coreAvailable = false; coreTaken = false; bossAlive = false; bossSpawned = false; bossDown = false; boss: Ent | null = null;
  retreatArm = 0; fullMsg = 0; alarmT = 0; audioT = 0; creakT = 0; tutStep = 0; tutMoved = 0; tutBoost = 0; tutScrap = 0; tutToggle = 0;
  stats = { creatures: 0, nodes: 0, relics: 0, tablets: [] as number[], maxDepth: 0, damage: 0, shots: 0, hits: 0, flares: 0, threatPeak: 0 };
  snow: { x: number; y: number; s: number }[] = [];
  bound: { target: EventTarget; type: string; fn: EventListener }[] = [];
  firstClear: boolean;

  constructor(cv: HTMLCanvasElement, o: EngineOpts) {
    this.cv = cv;
    this.c = cv.getContext('2d') as CanvasRenderingContext2D;
    this.dark = document.createElement('canvas');
    this.d = this.dark.getContext('2d') as CanvasRenderingContext2D;
    this.o = o;
    this.diff = o.diff;
    this.mods = o.mods;
    this.settings = o.settings;
    this.st = computeStats({ upgrades: o.save.upgrades, codex: o.save.codex }, o.mods);
    this.cfg = o.tutorial ? { ...o.site, jellies: 1 } : o.site;
    this.firstClear = !o.tutorial && (o.save.clears[o.site.id] || 0) === 0;
    this.rnd = mulberry((Date.now() ^ (o.site.id * 7919)) >>> 0);
    this.lv = genLevel(this.cfg, this.rnd);
    this.explored = new Uint8Array(this.lv.cols * this.lv.rows);
    this.mini = document.createElement('canvas');
    this.mini.width = this.lv.cols;
    this.mini.height = this.lv.rows;
    this.mc = this.mini.getContext('2d') as CanvasRenderingContext2D;
    this.mc.fillStyle = '#000';
    this.mc.fillRect(0, 0, this.lv.cols, this.lv.rows);
    for (let i = 0; i < 70; i++) this.snow.push({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random() * 0.9 });
    const sp = this.lv.spawn;
    this.p = {
      x: sp.x, y: sp.y, vx: 0, vy: 0, r: 15, hull: this.st.maxHull, air: this.st.maxAir, power: this.st.maxPower, aim: 0, face: 1, inv: 0, flash: 0,
      lantern: true, flares: this.st.flares, cd: 0, sonarCd: 0, flareCd: 0, empCd: 0, reserveUsed: false, cargoW: 0, cargoV: 0, lastBubble: 0,
    };
    this.nodes = this.lv.nodePos.map((n, i) => ({
      x: n.x, y: n.y, kind: this.cfg.puzzles[i % this.cfg.puzzles.length], done: false, cd: 0, seen: false, lvl: Math.max(0, this.cfg.id) + (i >= 2 ? 1 : 0),
    }));
    this.populate();
    this.resize();
    this.cam.x = clamp(this.p.x - this.W / this.zoom / 2, 0, Math.max(0, this.W2 - this.W / this.zoom));
    this.cam.y = this.p.y - this.H / this.zoom / 2;
    this.bind();
    this.toast(o.tutorial ? 'Welcome to the Training Pool.' : `Descending into ${this.cfg.name}…`, '#9fe8ff', 4);
    audio.init();
    audio.startMusic();
    audio.setMuffle(false);
    audio.apply(o.settings);
  }

  /* ------------------------------------------------------------ setup */
  private bind() {
    const add = (target: EventTarget, type: string, fn: (e: never) => void) => {
      target.addEventListener(type, fn as EventListener);
      this.bound.push({ target, type, fn: fn as EventListener });
    };
    add(window, 'resize', () => this.resize());
    add(window, 'keydown', (e: KeyboardEvent) => this.onKey(e, true));
    add(window, 'keyup', (e: KeyboardEvent) => this.onKey(e, false));
    add(window, 'blur', () => { this.keys.clear(); this.mouseDown = false; if (!this.paused && !this.ended && !this.puzzleOpen) this.setPaused(true); });
    add(document, 'visibilitychange', () => { if (document.hidden && !this.paused && !this.ended && !this.puzzleOpen) this.setPaused(true); });
    add(this.cv, 'pointermove', (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = this.cv.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
      this.useMouse = true; this.padAim = false; this.input.touch = false;
    });
    add(this.cv, 'pointerdown', (e: PointerEvent) => { if (e.pointerType === 'mouse' && e.button === 0) { this.mouseDown = true; audio.init(); } });
    add(window, 'pointerup', () => { this.mouseDown = false; });
    add(this.cv, 'contextmenu', (e: Event) => e.preventDefault());
  }

  start() {
    this.last = performance.now();
    const loop = (ts: number) => {
      if (this.dead) return;
      this.raf = requestAnimationFrame(loop);
      let dt = Math.min(0.05, (ts - this.last) / 1000 || 0);
      this.last = ts;
      if (this.slow > 0) { this.slow -= dt; dt *= 0.35; }
      if (!this.paused) { if (!this.ended) this.update(dt); else this.updateFx(dt); }
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.bound.forEach((b) => b.target.removeEventListener(b.type, b.fn));
    this.bound = [];
    audio.setMuffle(false);
    audio.setState(0, 0, 0);
  }

  resize() {
    const r = this.cv.getBoundingClientRect();
    this.W = Math.max(320, r.width || window.innerWidth);
    this.H = Math.max(240, r.height || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.cv.width = Math.floor(this.W * this.dpr);
    this.cv.height = Math.floor(this.H * this.dpr);
    this.dark.width = this.cv.width;
    this.dark.height = this.cv.height;
    this.zoom = clamp(Math.min(this.W / 1100, this.H / 680), 0.55, 1.25);
  }

  setPaused(p: boolean) {
    if (this.ended || this.paused === p) return;
    this.paused = p;
    audio.setMuffle(p);
    this.o.cb.onPause(p);
    if (p) { this.keys.clear(); this.mouseDown = false; }
  }
  setDiff(d: Diff) { this.diff = d; }
  setSettings(s: Settings) { this.settings = s; }
  setMods(m: string[]) {
    this.mods = m;
    this.st = computeStats({ upgrades: this.o.save.upgrades, codex: this.o.save.codex }, m);
    this.p.air = Math.min(this.p.air, this.st.maxAir);
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    if (this.puzzleOpen || this.ended) return;
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) e.preventDefault();
    if (!down) { this.keys.delete(c); return; }
    audio.init();
    if (e.repeat) return;
    if (c === 'Escape' || c === 'KeyP') { this.setPaused(!this.paused); return; }
    if (this.paused) return;
    this.keys.add(c);
    if (c === 'KeyL') this.press('lantern');
    else if (c === 'KeyQ') this.press('sonar');
    else if (c === 'KeyF') this.press('flare');
    else if (c === 'KeyR') this.press('emp');
    else if (c === 'KeyE') this.press('use');
    else if (c === 'KeyM') this.o.cb.onMute?.();
  }

  press(a: string) {
    if (this.paused || this.ended || this.puzzleOpen) return;
    const p = this.p;
    if (a === 'pause') this.setPaused(true);
    else if (a === 'lantern') {
      if (!p.lantern && p.power < 3) { this.toast('No power for the lantern', '#ff9d6b'); audio.play('deny'); return; }
      p.lantern = !p.lantern;
      this.tutToggle++;
      audio.play('click');
    } else if (a === 'sonar') this.sonar();
    else if (a === 'flare') this.flare();
    else if (a === 'emp') this.emp();
    else if (a === 'use') this.interact();
  }

  /* ------------------------------------------------------------ world helpers */
  get W2() { return this.lv.cols * TILE; }
  get H2() { return this.lv.rows * TILE; }
  depthM(y: number) { return Math.max(0, (y - WATER) / 10); }
  solidAt(cx: number, cy: number) {
    if (cx < 0 || cx >= this.lv.cols || cy >= this.lv.rows) return true;
    if (cy < 0) return false;
    return this.lv.solid[cy * this.lv.cols + cx] === 1;
  }
  pointSolid(x: number, y: number) { return this.solidAt(Math.floor(x / TILE), Math.floor(y / TILE)); }

  collide(o: { x: number; y: number; vx: number; vy: number }, r: number, bounce = 0.35): number {
    let impact = 0;
    const x0 = Math.floor((o.x - r) / TILE), x1 = Math.floor((o.x + r) / TILE);
    const y0 = Math.floor((o.y - r) / TILE), y1 = Math.floor((o.y + r) / TILE);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        if (!this.solidAt(cx, cy)) continue;
        const rx = cx * TILE, ry = cy * TILE;
        const nx = clamp(o.x, rx, rx + TILE), ny = clamp(o.y, ry, ry + TILE);
        let dx = o.x - nx, dy = o.y - ny;
        const d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        let pen: number;
        if (d2 < 0.0001) {
          dx = o.x - (rx + TILE / 2); dy = o.y - (ry + TILE / 2);
          const l = Math.hypot(dx, dy) || 1;
          dx /= l; dy /= l; if (!dx && !dy) dy = -1;
          pen = r + TILE / 2;
        } else {
          const d = Math.sqrt(d2);
          dx /= d; dy /= d; pen = r - d;
        }
        o.x += dx * pen; o.y += dy * pen;
        const vn = o.vx * dx + o.vy * dy;
        if (vn < 0) { o.vx -= (1 + bounce) * vn * dx; o.vy -= (1 + bounce) * vn * dy; impact = Math.max(impact, -vn); }
      }
    }
    if (o.x < r) { o.x = r; if (o.vx < 0) { impact = Math.max(impact, -o.vx); o.vx *= -bounce; } }
    if (o.x > this.W2 - r) { o.x = this.W2 - r; if (o.vx > 0) { impact = Math.max(impact, o.vx); o.vx *= -bounce; } }
    return impact;
  }

  private pushOut(o: { x: number; y: number; vx: number; vy: number }, cx: number, cy: number, R: number) {
    const dx = o.x - cx, dy = o.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    if (d < R) { o.x = cx + (dx / d) * R; o.y = cy + (dy / d) * R; const vn = o.vx * dx / d + o.vy * dy / d; if (vn < 0) { o.vx -= 1.3 * vn * dx / d; o.vy -= 1.3 * vn * dy / d; } }
  }

  current(x: number, y: number) {
    const c = this.cfg.current;
    let cx = Math.sin(y * 0.0045 + this.t * 0.25) * c;
    let cy = Math.cos(x * 0.004 + this.t * 0.2) * c * 0.4;
    if (this.surge.t > 0) { cx += this.surge.x * 150; cy += this.surge.y * 150; }
    return { x: cx, y: cy };
  }

  private cellPos(k: number): Pt { return { x: (k % this.lv.cols) * TILE + TILE / 2, y: Math.floor(k / this.lv.cols) * TILE + TILE / 2 }; }

  pickCell(o: { minY?: number; maxY?: number; near?: Pt; rMin?: number; rMax?: number; nook?: boolean; far?: number; from?: Pt } = {}): Pt {
    const open = this.lv.open;
    if (!open.length) return { x: this.lv.spawn.x, y: this.lv.spawn.y + 200 };
    const from = o.from || this.lv.spawn;
    let fb: Pt = this.cellPos(open[0]);
    for (let i = 0; i < 90; i++) {
      const k = open[Math.floor(Math.random() * open.length)];
      const p = this.cellPos(k);
      fb = p;
      if (o.minY !== undefined && p.y < o.minY) continue;
      if (o.maxY !== undefined && p.y > o.maxY) continue;
      if (dist(p.x, p.y, from.x, from.y) < (o.far ?? 350)) continue;
      if (o.near) { const d = dist(p.x, p.y, o.near.x, o.near.y); if (d < (o.rMin ?? 0) || d > (o.rMax ?? 9999)) continue; }
      if (o.nook) {
        const cx = k % this.lv.cols, cy = Math.floor(k / this.lv.cols);
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (this.solidAt(cx + dx, cy + dy)) n++;
        if (n < 3) continue;
      }
      return p;
    }
    return fb;
  }

  mkEnt(k: Kind, x: number, y: number): Ent {
    const s = KIND_STATS[k];
    const hp = k === 'boss' ? s.hp * this.diff.boss : s.hp;
    return { id: this.eid++, k, x, y, vx: 0, vy: 0, r: s.r, hp, max: hp, ang: rr(0, TAU), st: k === 'boss' ? 'enter' : 'lurk', t: 0, cd: rr(0.5, 2), stun: 0, rev: 0, flash: 0, hx: x, hy: y, tx: x, ty: y, g: 0, a: 0, ph: rr(0, TAU), trail: [], spawned: false, dead: false };
  }

  private addItem(k: ItemKind, p: Pt, v: number, w: number, tab = -1) {
    this.items.push({ k, x: p.x, y: p.y, v: Math.round(v), w, ph: rr(0, TAU), tab, rev: 0, taken: false, hp: 1 });
  }

  private depthMul(y: number) { return 1 + this.depthM(y) / 400; }

  private populate() {
    const s = this.cfg;
    const tut = this.o.tutorial;
    const em = tut ? 1 : this.diff.enemy * (this.mods.includes('hungry') ? 1.5 : 1);
    const n = (v: number) => (v > 0 ? Math.max(1, Math.round(v * em)) : 0);
    const deepY = WATER + (this.H2 - WATER) * 0.3;
    for (let i = 0; i < s.shoals; i++) {
      const c = this.pickCell({ minY: WATER + 200, far: 250 });
      for (let j = 0; j < 7; j++) { const f = this.mkEnt('fish', c.x + rr(-40, 40), c.y + rr(-40, 40)); f.g = i + 1; this.ents.push(f); }
    }
    for (let i = 0; i < n(s.jellies); i++) {
      const c = tut ? this.pickCell({ near: this.lv.spawn, rMin: 250, rMax: 650, far: 200, minY: WATER + 150 }) : this.pickCell({ minY: WATER + 220 });
      this.ents.push(this.mkEnt('jelly', c.x, c.y));
    }
    for (let i = 0; i < n(s.eels); i++) { const c = this.pickCell({ minY: WATER + 400 }); this.ents.push(this.mkEnt('eel', c.x, c.y)); }
    for (let i = 0; i < n(s.anglers); i++) { const c = this.pickCell({ minY: deepY }); this.ents.push(this.mkEnt('angler', c.x, c.y)); }
    for (let i = 0; i < n(s.sentinels); i++) {
      const nd = this.lv.nodePos[i % Math.max(1, this.lv.nodePos.length)];
      const c = nd ? this.pickCell({ near: nd, rMin: 40, rMax: 340, far: 200 }) : this.pickCell({ minY: deepY });
      this.ents.push(this.mkEnt('sentinel', c.x, c.y));
    }
    for (let i = 0; i < s.scrap; i++) { const c = this.pickCell({ minY: WATER + (tut ? 120 : 160), far: tut ? 150 : 250 }); this.addItem('scrap', c, 10 * this.depthMul(c.y), 1); }
    for (let i = 0; i < s.gears; i++) { const c = this.pickCell({ minY: WATER + 400 }); this.addItem('gear', c, 26 * this.depthMul(c.y), 1); }
    for (let i = 0; i < s.relics; i++) { const c = this.pickCell({ minY: WATER + 500, nook: true }); this.addItem('relic', c, rr(85, 130) * this.depthMul(c.y), 3); }
    for (let i = 0; i < s.crates; i++) { const c = this.pickCell({ minY: WATER + 250 }); this.addItem('crate', c, 0, 0); }
    const vents = this.mods.includes('thinair') ? Math.ceil(s.vents / 2) : s.vents;
    for (let i = 0; i < vents; i++) { const c = this.pickCell({ minY: WATER + 300 }); this.addItem('vent', c, 0, 0); }
    // lore tablets (only fragments not yet recovered)
    const first = [0, 2, 4, 7, 10][Math.max(0, s.id)] ?? 0;
    for (let i = 0; i < s.tablets; i++) {
      const id = first + i;
      const c = this.pickCell({ minY: WATER + 700, nook: true });
      if (this.o.save.codex.includes(id)) this.addItem('relic', c, rr(85, 130) * this.depthMul(c.y), 3);
      else this.addItem('tablet', c, 40 * this.depthMul(c.y), 0, id);
    }
    if (!tut) this.addItem('core', this.lv.corePos, 0, s.boss ? 4 : 3);
    else this.coreAvailable = true;
  }

  /* ------------------------------------------------------------ feedback helpers */
  toast(text: string, col = '#ffffff', t = 3) {
    this.toasts.push({ text, col, t });
    if (this.toasts.length > 4) this.toasts.shift();
  }
  announce(text: string, sub = '') { this.banner = { text, sub, t: 3.2 }; }
  ft(x: number, y: number, text: string, col = '#fff', size = 14) { this.texts.push({ x, y, life: 1.1, text, col, size }); if (this.texts.length > 60) this.texts.shift(); }
  addShake(v: number) { if (this.settings.shake) this.shake = Math.min(26, this.shake + v); }
  burst(x: number, y: number, n: number, col: string, speed = 100, life = 0.6, size = 3, kind = 0, grav = 0) {
    const f = [0.35, 0.7, 1][this.settings.particles] ?? 1;
    const cap = [150, 350, 700][this.settings.particles] ?? 700;
    const cnt = Math.max(1, Math.round(n * f));
    for (let i = 0; i < cnt && this.parts.length < cap; i++) {
      const a = rr(0, TAU), s = rr(0.2, 1) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rr(0.5, 1) * life, max: life, size: rr(0.6, 1.2) * size, col, kind, grav });
    }
  }
  addThreat(v: number) { if (this.o.tutorial) return; this.threat = clamp(this.threat + v, 0, 100); }
  threatLevel() { return Math.floor(this.threat / 20); }
  alertEels(x: number, y: number, r: number) {
    for (const e of this.ents) if (e.k === 'eel' && !e.dead && dist(e.x, e.y, x, y) < r && e.stun <= 0) { e.st = 'hunt'; e.t = 6; }
  }

  hurt(amount: number, cause: string, sx?: number, sy?: number) {
    const p = this.p;
    if (this.ended || p.inv > 0) return;
    const d = amount * this.diff.dmg * (this.mods.includes('glass') ? 1.5 : 1);
    p.hull -= d;
    p.inv = 0.6; p.flash = 0.15;
    this.stats.damage += d;
    this.dmgFlash = 0.6;
    this.addShake(6 + d * 0.4);
    this.ft(p.x, p.y - 24, '-' + Math.round(d), '#ff6b6b', 16);
    this.burst(p.x, p.y, 10, '#ff8a6b', 140, 0.5, 3);
    if (sx !== undefined && sy !== undefined) { const a = Math.atan2(p.y - sy, p.x - sx); p.vx += Math.cos(a) * 240; p.vy += Math.sin(a) * 240; }
    audio.play('hurt');
    if (this.o.tutorial) p.hull = Math.max(30, p.hull);
    if (p.hull <= 0) this.end('death', cause);
  }

  private dot(amount: number, cause: string) {
    const p = this.p;
    if (this.ended) return;
    const d = amount * this.diff.dmg * (this.mods.includes('glass') ? 1.5 : 1);
    p.hull -= d;
    this.stats.damage += d;
    this.dmgFlash = Math.max(this.dmgFlash, 0.25);
    if (this.o.tutorial) p.hull = Math.max(30, p.hull);
    if (p.hull <= 0) this.end('death', cause);
  }

  /* ------------------------------------------------------------ actions */
  fire() {
    const p = this.p;
    p.cd = this.st.cd;
    const a = p.aim;
    this.projs.push({ x: p.x + Math.cos(a) * 24, y: p.y + Math.sin(a) * 24, vx: Math.cos(a) * 760 + p.vx * 0.3, vy: Math.sin(a) * 760 + p.vy * 0.3, life: 0.55, dmg: this.st.dmg, own: 'p', r: 4, col: '#e8f6ff' });
    p.vx -= Math.cos(a) * 45; p.vy -= Math.sin(a) * 45;
    this.stats.shots++;
    this.addThreat(1.2);
    this.burst(p.x + Math.cos(a) * 26, p.y + Math.sin(a) * 26, 4, '#bfefff', 60, 0.4, 2, 1);
    audio.play('harpoon');
  }

  sonar() {
    const p = this.p;
    if (p.sonarCd > 0) return;
    if (p.power < this.st.sonarCost) { this.toast('Not enough power for sonar', '#ff9d6b'); audio.play('deny'); return; }
    p.power -= this.st.sonarCost;
    p.sonarCd = 3;
    this.rings.push({ x: p.x, y: p.y, r: 10, max: this.st.sonarR, kind: 'sonar', seen: new Set() });
    this.addThreat(4);
    this.alertEels(p.x, p.y, 420);
    // map terrain in range
    const R = Math.floor(this.st.sonarR / TILE);
    const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
    for (let y = pr - R; y <= pr + R; y++) for (let x = pc - R; x <= pc + R; x++) if ((x - pc) ** 2 + (y - pr) ** 2 <= R * R) this.markExplored(x, y);
    this.sonarUsed = true;
    audio.play('sonar');
  }
  sonarUsed = false; flareUsed = false;

  flare() {
    const p = this.p;
    if (p.flares <= 0 || p.flareCd > 0) { if (p.flares <= 0) { this.toast('Out of flares', '#ff9d6b'); audio.play('deny'); } return; }
    p.flares--; p.flareCd = 0.6;
    this.flares.push({ x: p.x, y: p.y, vy: 30, life: 22 });
    this.stats.flares++;
    this.flareUsed = true;
    this.burst(p.x, p.y, 14, '#ffd27a', 120, 0.6, 3, 1);
    audio.play('flare');
  }

  emp() {
    const p = this.p;
    if (this.st.emp <= 0) { this.toast('EMP Coil not installed — buy it in the Workshop', '#ff9d6b'); audio.play('deny'); return; }
    if (p.empCd > 0) return;
    if (p.power < 35) { this.toast('EMP needs 35 power', '#ff9d6b'); audio.play('deny'); return; }
    p.power -= 35; p.empCd = 12;
    const R = 220 + this.st.emp * 50, stun = 2.5 + this.st.emp * 1.2;
    this.rings.push({ x: p.x, y: p.y, r: 10, max: R, kind: 'emp', seen: new Set() });
    for (const e of this.ents) {
      if (e.dead || dist(e.x, e.y, p.x, p.y) > R + e.r) continue;
      if (e.k === 'boss') { if (e.st !== 'recover') { e.st = 'recover'; e.t = 2.2; this.ft(e.x, e.y - 80, 'STUNNED!', '#9fe8ff', 20); } continue; }
      e.stun = stun; e.flash = 0.2;
      if (e.k === 'drone') { e.hp = 0; }
      this.burst(e.x, e.y, 8, '#9fe8ff', 120, 0.5, 2, 1);
    }
    this.projs = this.projs.filter((q) => q.own === 'p' || dist(q.x, q.y, p.x, p.y) > R);
    this.addThreat(5);
    this.addShake(8);
    audio.play('emp');
  }

  interact() {
    const p = this.p;
    const dockNear = p.y < WATER + 70 && Math.abs(p.x - this.W2 / 2) < 280;
    if (dockNear) {
      const done = this.o.tutorial ? this.tutStep >= 8 : this.coreTaken;
      if (this.o.tutorial && !done) { this.toast('Finish the training steps first, then dock.', '#ff9d6b'); return; }
      if (!done && this.t - this.retreatArm > 3) {
        this.retreatArm = this.t;
        this.toast('Objective incomplete — press E again to retreat and bank your cargo', '#ffd27a', 3.5);
        audio.play('warn');
        return;
      }
      audio.play('dock');
      this.end(this.o.tutorial ? 'training' : done ? 'success' : 'retreat', '');
      return;
    }
    let best: Node | null = null, bd = 95;
    for (const n of this.nodes) { const d = dist(n.x, n.y, p.x, p.y); if (d < bd) { bd = d; best = n; } }
    if (best) {
      if (best.done) { this.toast('This terminal is already active.', '#9fe8ff'); return; }
      if (best.cd > 0) { this.toast(`Terminal recharging (${Math.ceil(best.cd)}s)`, '#ff9d6b'); audio.play('deny'); return; }
      this.puzzleOpen = true;
      this.keys.clear();
      this.mouseDown = false;
      this.activePuzzle = this.nodes.indexOf(best);
      audio.play('click');
      this.o.cb.onPuzzle({ kind: best.kind, level: best.lvl, node: this.activePuzzle });
      return;
    }
    this.toast('Nothing to interact with here.', '#8aa');
  }

  finishPuzzle(success: boolean | null) {
    const n = this.nodes[this.activePuzzle];
    this.puzzleOpen = false;
    this.activePuzzle = -1;
    this.keys.clear();
    if (!n || this.ended) return;
    if (success === null) { n.cd = 1; return; }
    if (success) {
      n.done = true;
      this.stats.nodes++;
      this.rings.push({ x: n.x, y: n.y, r: 10, max: 420, kind: 'node', seen: new Set() });
      this.burst(n.x, n.y, 40, '#9fffe0', 220, 1, 3, 1);
      this.ft(n.x, n.y - 40, 'TERMINAL ONLINE', '#9fffe0', 18);
      this.addShake(8);
      audio.play('node');
      const left = this.nodes.filter((q) => !q.done).length;
      if (this.o.tutorial) return;
      if (left === 0) this.allNodes();
      else this.toast(`Terminal activated — ${left} remaining`, '#9fffe0');
    } else {
      n.cd = 8;
      this.addThreat(12);
      this.p.power = Math.max(0, this.p.power - 12);
      this.alertEels(n.x, n.y, 600);
      this.ft(n.x, n.y - 40, 'FEEDBACK SURGE', '#ff6b6b', 16);
      audio.play('bad');
      this.hurt(6, 'Terminal feedback surge', n.x, n.y);
    }
  }

  private allNodes() {
    if (this.cfg.boss) {
      this.bossSpawned = true; this.bossAlive = true;
      const a = this.lv.arena || this.lv.corePos;
      const b = this.mkEnt('boss', a.x, a.y);
      this.ents.push(b);
      this.boss = b;
      this.announce('THE WARDEN AWAKENS', 'Armoured while it strides. Open when it stumbles.');
      audio.play('roar');
      this.addShake(20);
      this.addThreat(30);
    } else {
      this.coreAvailable = true;
      this.announce('VAULT UNSEALED', 'Claim the Archive Core at the bottom of the shaft.');
      audio.play('good');
    }
  }

  /* ------------------------------------------------------------ main update */
  update(dt: number) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.warns = [];
    this.t += dt;
    this.time += dt;
    this.pollPad();
    this.updatePlayer(dt);
    this.updateEnts(dt);
    this.updateProj(dt);
    this.updateItems(dt);
    this.updateRings(dt);
    this.updateDirector(dt);
    this.updateFx(dt);
    if (this.o.tutorial) this.updateTutorial();
    // camera
    const vw = this.W / this.zoom, vh = this.H / this.zoom;
    const tx = this.p.x - vw / 2 + this.p.vx * 0.15, ty = this.p.y - vh / 2 + this.p.vy * 0.15;
    const k = 1 - Math.exp(-6 * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.x = this.W2 > vw ? clamp(this.cam.x, 0, this.W2 - vw) : (this.W2 - vw) / 2;
    this.cam.y = clamp(this.cam.y, -260, Math.max(-260, this.H2 - vh));
    this.shake *= Math.exp(-7 * dt);
    this.shx = (Math.random() - 0.5) * this.shake;
    this.shy = (Math.random() - 0.5) * this.shake;
    this.dmgFlash = Math.max(0, this.dmgFlash - dt);
    this.healFlash = Math.max(0, this.healFlash - dt);
    this.audioT -= dt;
    if (this.audioT <= 0) {
      this.audioT = 0.4;
      const depth01 = clamp(this.depthM(this.p.y) / 400, 0, 1);
      const danger = this.p.air < this.st.maxAir * 0.2 || this.p.hull < this.st.maxHull * 0.25 ? 1 : 0;
      audio.setState(depth01, this.threat / 100, danger);
    }
  }

  private pollPad() {
    const g = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    const pd = this.pad;
    if (!g) { pd.ax = 0; pd.ay = 0; pd.fire = false; pd.boost = false; return; }
    const dz = (v: number) => (Math.abs(v) < 0.2 ? 0 : v);
    pd.ax = dz(g.axes[0] || 0); pd.ay = dz(g.axes[1] || 0);
    const rx = dz(g.axes[2] || 0), ry = dz(g.axes[3] || 0);
    if (rx || ry) { this.p.aim = Math.atan2(ry, rx); this.useMouse = false; this.padAim = true; }
    pd.fire = !!g.buttons[7]?.pressed || !!g.buttons[5]?.pressed;
    pd.boost = !!g.buttons[6]?.pressed;
    const map: [number, string][] = [[2, 'lantern'], [3, 'sonar'], [1, 'flare'], [4, 'emp'], [0, 'use'], [9, 'pause']];
    for (const [b, act] of map) {
      const down = !!g.buttons[b]?.pressed;
      if (down && !this.padPrev[b]) this.press(act);
      this.padPrev[b] = down;
    }
  }
  padAim = false;

  private updatePlayer(dt: number) {
    const p = this.p, st = this.st;
    const tut = this.o.tutorial;
    p.inv -= dt; p.cd -= dt; p.sonarCd -= dt; p.flareCd -= dt; p.empCd -= dt; p.flash -= dt;
    let ix = 0, iy = 0;
    if (!this.puzzleOpen) {
      const k = this.keys;
      if (k.has('KeyA') || k.has('ArrowLeft')) ix -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) ix += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) iy -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) iy += 1;
      ix += this.input.mx + this.pad.ax; iy += this.input.my + this.pad.ay;
    }
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    const moving = len > 0.15;
    const wantBoost = !this.puzzleOpen && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.input.boost || this.pad.boost) && moving;
    this.boosting = wantBoost && p.power > 2;
    if (this.boosting) { this.tutBoost += dt; if (Math.random() < dt * 8) audio.play('boost'); }
    const mass = 1 / (1 + p.cargoW * 0.02);
    const acc = 640 * st.speed * mass * (this.boosting ? 1.7 : 1);
    p.vx += ix * acc * dt; p.vy += iy * acc * dt;
    const cu = this.current(p.x, p.y);
    p.vx += cu.x * dt * 2; p.vy += cu.y * dt * 2;
    const drag = Math.exp(-2.3 * dt);
    p.vx *= drag; p.vy *= drag;
    const sx = p.x, sy = p.y;
    p.x += p.vx * dt; p.y += p.vy * dt;
    this.tutMoved += dist(sx, sy, p.x, p.y);
    const imp = this.collide(p, p.r, 0.3);
    if (imp > 190) { this.hurt((imp - 150) * 0.045, 'Crushed against the rocks'); this.addShake(5); audio.play('bump'); this.burst(p.x, p.y, 6, '#c9d6df', 90, 0.4, 2); }
    else if (imp > 90) { audio.play('bump'); }
    if (!this.coreAvailable && !this.coreTaken) this.pushOut(p, this.lv.corePos.x, this.lv.corePos.y, 78 + p.r);
    if (p.y < WATER - 8) { p.y = WATER - 8; if (p.vy < 0) p.vy = 0; }
    // aim
    if (this.padAim && !this.useMouse) { /* aim set by stick */ }
    else if (this.useMouse && !this.input.touch) {
      const mx = this.cam.x + this.mouse.x / this.zoom, my = this.cam.y + this.mouse.y / this.zoom;
      p.aim = Math.atan2(my - p.y, mx - p.x);
    } else {
      let near: Ent | null = null, nd = 520;
      for (const e of this.ents) { if (e.dead || e.k === 'fish') continue; const d = dist(e.x, e.y, p.x, p.y); if (d < nd) { nd = d; near = e; } }
      if (near) p.aim = Math.atan2(near.y - p.y, near.x - p.x);
      else if (moving) p.aim = Math.atan2(iy, ix);
    }
    const nf = Math.cos(p.aim) >= 0 ? 1 : -1;
    if (nf !== p.face && Math.abs(Math.cos(p.aim)) > 0.15) p.face = nf;
    // resources
    const depth = this.depthM(p.y);
    this.stats.maxDepth = Math.max(this.stats.maxDepth, depth);
    const surfaced = p.y < WATER + 40;
    const dockNear = surfaced && Math.abs(p.x - this.W2 / 2) < 280;
    if (surfaced) { p.air += 40 * dt; p.power += 25 * dt; }
    else p.air -= 0.7 * st.airDrain * this.diff.drain * (1 + depth / 400) * (this.boosting ? 1.35 : 1) * (tut ? 0.25 : 1) * dt;
    if (dockNear && p.hull < st.maxHull) { p.hull = Math.min(st.maxHull, p.hull + 6 * dt); }
    p.air = Math.min(p.air, st.maxAir);
    if (p.air <= 0) {
      if (st.reserve && !p.reserveUsed) { p.reserveUsed = true; p.air = st.maxAir * 0.4; this.announce('RESERVE CYLINDER ENGAGED', '40% air restored'); audio.play('good'); }
      else { p.air = 0; this.dot(7 * dt, 'Ran out of air'); }
    }
    let pw = this.boosting ? 0 : 0.9;
    if (p.lantern && p.power > 0) pw -= 1.7 * st.ledMul;
    if (this.boosting) pw -= 14;
    if (moving && !this.boosting) pw += st.dynamo;
    p.power = clamp(p.power + pw * dt, 0, st.maxPower);
    if (p.power <= 0 && p.lantern) { p.lantern = false; this.toast('Power depleted — lantern offline!', '#ff9d6b'); audio.play('warn'); }
    const over = depth - st.rating;
    if (!tut && over > 0) {
      this.dot((1.2 + over * 0.06) * dt, 'Crushed by deep-sea pressure');
      this.creakT -= dt;
      if (this.creakT <= 0) { this.creakT = 1.8; audio.play('creak'); this.addShake(4); this.toast(`HULL OVER RATED DEPTH by ${Math.round(over)} m!`, '#ff6b6b', 1.8); }
    }
    if (st.repair > 0 && Math.hypot(p.vx, p.vy) < 60 && p.power > 20 && p.hull < st.maxHull) { p.hull = Math.min(st.maxHull, p.hull + st.repair * dt); p.power -= 0.5 * dt; }
    // alarms
    this.alarmT -= dt;
    if (this.alarmT <= 0 && (p.air < st.maxAir * 0.2 || p.hull < st.maxHull * 0.25)) { this.alarmT = 1.4; audio.play('alarm'); }
    // fire
    if ((this.mouseDown || this.keys.has('Space') || this.input.fire || this.pad.fire) && !this.puzzleOpen && p.cd <= 0) this.fire();
    // bubbles
    p.lastBubble -= dt;
    if (p.lastBubble <= 0 && !surfaced) { p.lastBubble = this.boosting ? 0.04 : 0.35; this.parts.push({ x: p.x - p.face * 24, y: p.y - 4, vx: rr(-10, 10), vy: -rr(20, 50), life: 1.4, max: 1.4, size: rr(1.5, 3), col: '#cfeeff', kind: 2, grav: -30 }); }
    // explore
    const R = Math.ceil((p.lantern ? st.lensR : 90) / TILE);
    const pc = Math.floor(p.x / TILE), pr = Math.floor(p.y / TILE);
    for (let y = pr - R; y <= pr + R; y++) for (let x = pc - R; x <= pc + R; x++) if ((x - pc) ** 2 + (y - pr) ** 2 <= R * R) this.markExplored(x, y);
    for (const n of this.nodes) if (!n.seen && dist(n.x, n.y, p.x, p.y) < 380) n.seen = true;
    // threat dynamics
    if (!tut) {
      const still = Math.hypot(p.vx, p.vy) < 60 && !this.boosting;
      let dth = 0.35 * this.diff.threat * (1 + this.cfg.id * 0.12);
      if (this.boosting) dth += 3;
      if (still) dth -= p.lantern ? 0.6 : 1.4;
      if (surfaced) dth -= 4;
      if (this.bossAlive) dth = Math.max(dth, 0.2);
      this.threat = clamp(this.threat + dth * dt, 0, 100);
      this.stats.threatPeak = Math.max(this.stats.threatPeak, this.threat);
    }
    if (this.surge.t > 0) this.surge.t -= dt;
    if (this.silt > 0) this.silt -= dt;
  }

  private markExplored(x: number, y: number) {
    const lv = this.lv;
    if (x < 0 || y < 0 || x >= lv.cols || y >= lv.rows) return;
    const k = y * lv.cols + x;
    if (this.explored[k]) return;
    this.explored[k] = 1;
    this.mc.fillStyle = lv.solid[k] ? '#5a6a78' : y < SURF ? '#2a4a60' : '#123a52';
    this.mc.fillRect(x, y, 1, 1);
  }

  /* ------------------------------------------------------------ entities */
  private updateEnts(dt: number) {
    const p = this.p;
    const cent = new Map<number, { x: number; y: number; n: number }>();
    for (const e of this.ents) {
      if (e.k === 'fish' && !e.dead) { const c = cent.get(e.g) || { x: 0, y: 0, n: 0 }; c.x += e.x; c.y += e.y; c.n++; cent.set(e.g, c); }
    }
    const nd = 150 + this.threat * 2.5 + (this.boosting ? 120 : 0) + (p.lantern ? 60 : 0);
    const lvl = this.threatLevel();
    const steer = (e: Ent, tx: number, ty: number, sp: number, k = 4) => {
      const a = Math.atan2(ty - e.y, tx - e.x);
      e.vx += (Math.cos(a) * sp - e.vx) * Math.min(1, dt * k);
      e.vy += (Math.sin(a) * sp - e.vy) * Math.min(1, dt * k);
      e.ang = Math.atan2(e.vy, e.vx);
    };
    for (const e of this.ents) {
      if (e.dead) continue;
      e.rev -= dt; e.flash -= dt; e.cd -= dt;
      const d = dist(e.x, e.y, p.x, p.y);
      if (e.stun > 0) {
        e.stun -= dt; e.vx *= Math.exp(-3 * dt); e.vy *= Math.exp(-3 * dt);
        if (Math.random() < dt * 10) this.burst(e.x, e.y, 2, '#9fe8ff', 60, 0.3, 2, 1);
      } else {
        switch (e.k) {
          case 'fish': {
            const c = cent.get(e.g);
            let tx = c ? c.x / c.n : e.x, ty = c ? c.y / c.n : e.y;
            tx += Math.cos(this.t * 0.6 + e.ph) * 60; ty += Math.sin(this.t * 0.5 + e.ph * 2) * 40;
            let sp = 70;
            let fl = false;
            for (const q of this.ents) {
              if (q.dead || (q.k !== 'eel' && q.k !== 'angler' && q.k !== 'boss')) continue;
              if (dist(q.x, q.y, e.x, e.y) < 190) { tx = e.x + (e.x - q.x) * 3; ty = e.y + (e.y - q.y) * 3; sp = 170; fl = true; break; }
            }
            if (!fl && d < 160 && (this.boosting || Math.hypot(p.vx, p.vy) > 250)) { tx = e.x + (e.x - p.x) * 3; ty = e.y + (e.y - p.y) * 3; sp = 150; }
            steer(e, tx, ty, sp, 3);
            if (e.y < WATER + 30) e.vy += 100 * dt;
            break;
          }
          case 'jelly': {
            let tgt: Pt | null = null;
            if (p.lantern && p.power > 0 && d < this.st.lensR * 1.3 && p.y > WATER + 40) tgt = p;
            else { for (const f of this.flares) if (dist(f.x, f.y, e.x, e.y) < 450) { tgt = f; break; } }
            if (tgt) steer(e, tgt.x, tgt.y, 48, 1.5);
            else { e.vx += Math.cos(this.t * 0.3 + e.ph) * 10 * dt; e.vy += Math.sin(this.t * 0.7 + e.ph) * 14 * dt; e.vx *= Math.exp(-0.5 * dt); e.vy *= Math.exp(-0.5 * dt); }
            if (d < e.r + p.r + 2 && e.cd <= 0) { e.cd = 1.4; this.hurt(6, 'Stung by a jellyfish', e.x, e.y); p.power = Math.max(0, p.power - 10); audio.play('sting'); this.ft(p.x, p.y - 40, '-10 power', '#ffe36b', 12); }
            break;
          }
          case 'eel': {
            e.t -= dt;
            const sp = (210 + this.cfg.id * 8) * (1 + lvl * 0.04);
            if (e.st === 'lurk') {
              if (dist(e.x, e.y, e.tx, e.ty) < 30 || Math.random() < dt * 0.1) { const a = rr(0, TAU), r = rr(60, 220); e.tx = e.hx + Math.cos(a) * r; e.ty = e.hy + Math.sin(a) * r; }
              steer(e, e.tx, e.ty, 55, 2);
              if (d < nd && p.y > WATER + 60) { e.st = 'hunt'; e.t = 6; audio.play('creak'); }
              else {
                const fl = this.flares.find((f) => dist(f.x, f.y, e.x, e.y) < 380);
                if (fl) { e.st = 'flare'; e.tx = fl.x; e.ty = fl.y; }
                else if (e.cd <= 0) {
                  let nf: Ent | null = null, bd = 280;
                  for (const f of this.ents) if (f.k === 'fish' && !f.dead) { const dd = dist(f.x, f.y, e.x, e.y); if (dd < bd) { bd = dd; nf = f; } }
                  if (nf) { e.st = 'prey'; e.a = nf.id; }
                }
              }
            } else if (e.st === 'hunt') {
              steer(e, p.x, p.y, sp, 3.5);
              if (d < nd) e.t = Math.max(e.t, 3);
              if (e.t <= 0 && d > nd * 1.8) e.st = 'lurk';
              if (d < e.r + p.r + 3 && e.cd <= 0) { e.cd = 1.4; this.hurt(14, 'Torn apart by a moray eel', e.x, e.y); audio.play('bite'); e.st = 'retreat'; e.t = 0.9; }
            } else if (e.st === 'retreat') {
              steer(e, e.x + (e.x - p.x), e.y + (e.y - p.y), 170, 4);
              if (e.t <= 0) { e.st = 'hunt'; e.t = 4; }
            } else if (e.st === 'flare') {
              const fl = this.flares.find((f) => dist(f.x, f.y, e.x, e.y) < 520);
              if (!fl) { e.st = 'lurk'; e.cd = 2; }
              else {
                const a = this.t * 1.6 + e.ph;
                steer(e, fl.x + Math.cos(a) * 90, fl.y + Math.sin(a) * 90, 130, 3);
                if (d < nd * 0.6) { e.st = 'hunt'; e.t = 5; }
              }
            } else if (e.st === 'prey') {
              const f = this.ents.find((q) => q.id === e.a && !q.dead);
              if (!f) { e.st = 'lurk'; e.cd = 3; }
              else {
                steer(e, f.x, f.y, 200, 3.5);
                if (dist(e.x, e.y, f.x, f.y) < e.r + 8) { f.dead = true; this.burst(f.x, f.y, 8, '#ff7a7a', 70, 0.6, 2); e.st = 'lurk'; e.cd = 5; }
                if (d < nd * 0.7) { e.st = 'hunt'; e.t = 5; }
              }
            }
            break;
          }
          case 'angler': {
            e.t -= dt;
            if (e.st === 'lurk') {
              if (dist(e.x, e.y, e.tx, e.ty) < 30 || Math.random() < dt * 0.1) { const a = rr(0, TAU), r = rr(40, 160); e.tx = e.hx + Math.cos(a) * r; e.ty = e.hy + Math.sin(a) * r; }
              steer(e, e.tx, e.ty, 30, 2);
              if (d < 360 && p.lantern) steer(e, p.x, p.y, 60, 1.5);
              if (d < 95 || (e.t > 0)) { if (d < 95) { e.st = 'lunge'; e.t = 0.6; e.tx = p.x; e.ty = p.y; audio.play('roar'); } }
            } else if (e.st === 'lunge') {
              steer(e, e.tx, e.ty, 380, 8);
              if (d < e.r + p.r + 3 && e.cd <= 0) { e.cd = 1.5; this.hurt(26, 'Swallowed by an anglerfish', e.x, e.y); audio.play('bite'); e.st = 'recover'; e.t = 1.6; }
              else if (e.t <= 0) { e.st = 'recover'; e.t = 1.4; }
            } else if (e.st === 'recover') {
              e.vx *= Math.exp(-3 * dt); e.vy *= Math.exp(-3 * dt);
              if (e.t <= 0) { e.st = 'lurk'; e.t = 0; }
            }
            break;
          }
          case 'sentinel': {
            const engaged = d < 290 && (p.lantern || d < 150) && p.y > WATER + 40;
            if (!engaged) {
              e.a += dt * 0.5;
              steer(e, e.hx + Math.cos(e.a) * 140, e.hy + Math.sin(e.a) * 70, 55, 2);
              e.cd = Math.max(e.cd, 0.8);
            } else {
              e.ang = Math.atan2(p.y - e.y, p.x - e.x);
              if (d > 250) steer(e, p.x, p.y, 70, 2);
              else if (d < 140) steer(e, e.x - (p.x - e.x), e.y - (p.y - e.y), 70, 2);
              else { e.vx *= Math.exp(-2 * dt); e.vy *= Math.exp(-2 * dt); }
              if (e.cd <= 0) {
                e.cd = 2.0 - Math.min(0.6, this.cfg.id * 0.15);
                this.projs.push({ x: e.x, y: e.y, vx: Math.cos(e.ang) * 250, vy: Math.sin(e.ang) * 250, life: 3, dmg: 9, own: 'e', r: 6, col: '#7ad0ff' });
                audio.play('bolt');
              }
            }
            break;
          }
          case 'drone': {
            steer(e, p.x, p.y, 150, 3);
            if (d < e.r + p.r) { e.hp = 0; e.dead = true; this.hurt(5, 'Guardian drone detonation', e.x, e.y); this.burst(e.x, e.y, 16, '#ff7a7a', 160, 0.5, 3); }
            break;
          }
          case 'boss': this.updateBoss(e, dt, d); break;
        }
      }
      // integrate
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.k !== 'boss' || e.st !== 'dash') {
        const imp = this.collide(e, e.r, 0.2);
        if (e.k === 'boss' && imp > 0) { /* sliding along walls */ }
      }
      if (e.y < WATER + e.r) { e.y = WATER + e.r; if (e.vy < 0) e.vy = 0; }
      if (e.k === 'eel') { const l = e.trail[0]; if (!l || dist(l.x, l.y, e.x, e.y) > 7) { e.trail.unshift({ x: e.x, y: e.y }); if (e.trail.length > 9) e.trail.pop(); } }
      if (e.hp <= 0 && !e.dead) this.kill(e);
    }
    if (this.ents.some((e) => e.dead)) this.ents = this.ents.filter((e) => !e.dead);
    this.boss = this.ents.find((e) => e.k === 'boss') || null;
    this.bossAlive = !!this.boss;
  }

  private updateBoss(e: Ent, dt: number, d: number) {
    const p = this.p;
    const frac = e.hp / e.max;
    const phase = frac > 0.66 ? 1 : frac > 0.33 ? 2 : 3;
    e.t -= dt;
    if (phase > e.a && e.a !== 0) {
      e.a = phase; e.st = 'roar'; e.t = 1.3; e.g = 0; e.tx = 0;
      this.announce(phase === 2 ? 'PHASE II — GUARDIANS RISE' : 'PHASE III — THE LIGHTS FAIL', phase === 2 ? 'Drones pour from its armour' : 'It strikes faster in the dark');
      audio.play('roar'); this.addShake(18);
      if (phase === 2) for (let i = 0; i < 3; i++) this.ents.push(this.mkEnt('drone', e.x + rr(-80, 80), e.y + rr(-80, 80)));
    }
    if (e.a === 0) e.a = 1;
    this.bossDark = phase === 3 ? (Math.sin(this.t * 0.6) > 0.2 ? 0.45 : 1) : 1;
    const dir = Math.atan2(p.y - e.y, p.x - e.x);
    const sp = 1 + (phase - 1) * 0.18;
    if (e.st === 'enter') { e.vx *= 0.95; e.vy *= 0.95; if (e.t <= 0) { e.st = 'approach'; e.t = 1.7; } if (e.t < -5) e.t = 0; }
    else if (e.st === 'approach') {
      const tx = p.x - Math.cos(dir) * 240, ty = p.y - Math.sin(dir) * 240;
      const a = Math.atan2(ty - e.y, tx - e.x);
      e.vx += (Math.cos(a) * 130 * sp - e.vx) * Math.min(1, dt * 2); e.vy += (Math.sin(a) * 130 * sp - e.vy) * Math.min(1, dt * 2);
      e.ang = dir;
      if (e.t <= 0) {
        e.g++;
        if (e.g % 2 === 0) { e.st = 'roar'; e.t = 1.0; e.tx = 0; }
        else { e.st = 'telegraph'; e.t = phase === 3 ? 0.7 : 1.0; e.vx *= 0.2; e.vy *= 0.2; audio.play('charge'); }
      }
    } else if (e.st === 'roar') {
      e.vx *= Math.exp(-3 * dt); e.vy *= Math.exp(-3 * dt);
      if (e.tx === 0) {
        e.tx = 1;
        const n = 12 + phase * 3, gap = rr(0, TAU);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          let diff = Math.abs(((a - gap + Math.PI * 3) % TAU) - Math.PI);
          diff = Math.abs(diff);
          if (diff < 0.32) continue;
          this.projs.push({ x: e.x + Math.cos(a) * 70, y: e.y + Math.sin(a) * 70, vx: Math.cos(a) * (170 + phase * 22), vy: Math.sin(a) * (170 + phase * 22), life: 4, dmg: 8, own: 'e', r: 7, col: '#ff7ad0' });
        }
        audio.play('roar'); this.addShake(10);
        this.rings.push({ x: e.x, y: e.y, r: 20, max: 380, kind: 'node', seen: new Set() });
        if (phase >= 2 && this.ents.filter((q) => q.k === 'drone').length < 3) for (let i = 0; i < 2; i++) this.ents.push(this.mkEnt('drone', e.x + rr(-90, 90), e.y + rr(-90, 90)));
      }
      if (e.t <= 0) { e.st = 'approach'; e.t = 1.5; }
    } else if (e.st === 'telegraph') {
      e.vx *= Math.exp(-4 * dt); e.vy *= Math.exp(-4 * dt);
      if (e.t > 0.25) e.ang = dir;
      this.warns.push({ x1: e.x, y1: e.y, x2: e.x + Math.cos(e.ang) * 900, y2: e.y + Math.sin(e.ang) * 900 });
      if (e.t <= 0) { e.st = 'dash'; e.t = phase === 3 ? 0.85 : 0.7; e.vx = Math.cos(e.ang) * 640 * sp; e.vy = Math.sin(e.ang) * 640 * sp; this.addShake(5); }
    } else if (e.st === 'dash') {
      e.x += e.vx * dt * 0; // movement integrated by caller
      const imp = this.collide(e, e.r * 0.92, 0);
      if (imp > 0) {
        e.st = 'recover'; e.t = 3.6; e.vx *= -0.1; e.vy *= -0.1;
        this.addShake(24); this.hitstop = 0.12; audio.play('slam');
        this.burst(e.x + Math.cos(e.ang) * e.r, e.y + Math.sin(e.ang) * e.r, 40, '#c9b9a0', 260, 0.9, 5);
        this.ft(e.x, e.y - 90, 'WALL SLAM — OPEN!', '#ffd27a', 22);
      } else if (e.t <= 0) { e.st = 'recover'; e.t = 1.7; }
    } else if (e.st === 'recover') {
      e.vx *= Math.exp(-3 * dt); e.vy *= Math.exp(-3 * dt);
      if (e.t <= 0) { e.st = 'approach'; e.t = 1.4; }
    }
    if (d < e.r + p.r) {
      const dmg = e.st === 'dash' ? 26 : 10;
      if (p.inv <= 0) this.hurt(dmg, 'Crushed by the Warden', e.x, e.y);
    }
  }

  damageEnt(e: Ent, dmg: number, sx: number, sy: number) {
    let d = dmg;
    if (e.k === 'boss') {
      const open = e.st === 'recover';
      d = open ? dmg * 1.4 : dmg * 0.28;
      this.ft(e.x + rr(-30, 30), e.y - e.r - 10, open ? Math.round(d) + '!' : 'Armoured', open ? '#ffd27a' : '#9aa', open ? 20 : 12);
    } else this.ft(e.x, e.y - e.r - 6, String(Math.round(d)), '#fff', 13);
    e.hp -= d; e.flash = 0.12;
    this.stats.hits++;
    const a = Math.atan2(e.y - sy, e.x - sx);
    if (e.k !== 'boss') { e.vx += Math.cos(a) * 120; e.vy += Math.sin(a) * 120; }
    this.burst(e.x, e.y, 6, e.k === 'fish' || e.k === 'eel' ? '#ff6b6b' : '#bfefff', 120, 0.4, 2);
    this.addShake(2);
    audio.play('hit');
    if (e.k === 'eel') { e.st = 'hunt'; e.t = 6; }
    if (e.k === 'angler' && e.st === 'lurk') { e.st = 'lunge'; e.t = 0.6; e.tx = this.p.x; e.ty = this.p.y; }
    if (e.k !== 'fish') this.addThreat(1);
  }

  kill(e: Ent) {
    e.dead = true;
    const big = e.k === 'boss';
    this.burst(e.x, e.y, big ? 120 : 20, e.k === 'sentinel' || e.k === 'drone' ? '#9fd8ff' : '#ff9ab0', big ? 380 : 180, big ? 1.4 : 0.7, big ? 6 : 3);
    this.hitstop = big ? 0.25 : 0.04;
    audio.play(e.k === 'fish' ? 'hit' : 'kill');
    if (e.k === 'fish') {
      this.addThreat(3);
      this.alertEels(e.x, e.y, 450);
      return;
    }
    if (e.k === 'drone') return;
    this.stats.creatures++;
    this.addShake(big ? 28 : 6);
    const dm = this.depthMul(e.y);
    const pos = { x: e.x, y: e.y };
    const drops: Record<string, [number, number]> = { jelly: [18, 1], eel: [34, 1], angler: [75, 2], sentinel: [48, 2] };
    if (big) {
      this.slow = 1.6; this.bossDown = true;
      this.ents.forEach((q) => { if (q.k === 'drone') q.dead = true; });
      this.projs = this.projs.filter((q) => q.own === 'p');
      this.coreAvailable = true;
      this.announce('THE WARDEN FALLS', 'The Heart of the Archive is unsealed.');
      audio.play('win');
      for (let i = 0; i < 4; i++) this.addItem('relic', { x: e.x + rr(-90, 90), y: e.y + rr(-60, 60) }, 150 * dm, 3);
      this.ft(e.x, e.y, 'WARDEN DEFEATED', '#ffd27a', 26);
      return;
    }
    const dr = drops[e.k];
    if (dr && (e.k !== 'jelly' || Math.random() < 0.6)) this.addItem('sample', pos, dr[0] * dm, dr[1]);
    if (e.k === 'sentinel') { this.addItem('gear', { x: e.x - 20, y: e.y }, 30 * dm, 1); this.addItem('gear', { x: e.x + 20, y: e.y }, 30 * dm, 1); }
    if (this.o.tutorial && e.k === 'jelly') this.tutKilled = true;
  }
  tutKilled = false;

  private updateProj(dt: number) {
    const p = this.p;
    for (const q of this.projs) {
      const steps = 2;
      for (let s = 0; s < steps && q.life > 0; s++) {
        q.x += (q.vx * dt) / steps; q.y += (q.vy * dt) / steps;
        if (this.pointSolid(q.x, q.y)) { q.life = 0; this.burst(q.x, q.y, 4, q.own === 'p' ? '#dfe8ee' : q.col, 80, 0.3, 2, 1); break; }
        if (q.own === 'p') {
          for (const e of this.ents) {
            if (e.dead) continue;
            if (dist(q.x, q.y, e.x, e.y) < e.r + q.r) { this.damageEnt(e, q.dmg, q.x - q.vx * 0.01, q.y - q.vy * 0.01); q.life = 0; break; }
          }
          if (q.life > 0) for (const it of this.items) {
            if (it.k === 'crate' && !it.taken && dist(q.x, q.y, it.x, it.y) < 22) { this.openCrate(it); q.life = 0; break; }
          }
        } else if (dist(q.x, q.y, p.x, p.y) < p.r + q.r) { this.hurt(q.dmg, q.col === '#ff7ad0' ? 'Hit by a Warden sonic bolt' : 'Shot by an Archive sentinel', q.x - q.vx, q.y - q.vy); q.life = 0; }
      }
      q.life -= dt;
      if (Math.random() < dt * 30) this.parts.push({ x: q.x, y: q.y, vx: 0, vy: 0, life: 0.3, max: 0.3, size: q.own === 'p' ? 1.5 : 3, col: q.col, kind: 1, grav: 0 });
    }
    this.projs = this.projs.filter((q) => q.life > 0);
  }

  private openCrate(it: Item) {
    it.taken = true;
    const p = this.p, r = Math.random();
    this.burst(it.x, it.y, 18, '#c9a468', 160, 0.6, 3);
    audio.play('pickup');
    if (r < 0.34) { p.air = Math.min(this.st.maxAir, p.air + 35); this.ft(it.x, it.y, '+35 AIR', '#7fe9ff', 15); }
    else if (r < 0.68) { p.power = Math.min(this.st.maxPower, p.power + 45); this.ft(it.x, it.y, '+45 POWER', '#ffe36b', 15); }
    else if (r < 0.9) { p.hull = Math.min(this.st.maxHull, p.hull + 30); this.healFlash = 0.4; this.ft(it.x, it.y, '+30 HULL', '#7dff9f', 15); }
    else { p.flares++; this.ft(it.x, it.y, '+1 FLARE', '#ffd27a', 15); }
  }

  private updateItems(dt: number) {
    const p = this.p;
    for (const it of this.items) {
      if (it.taken) continue;
      it.rev -= dt;
      const d = dist(it.x, it.y, p.x, p.y);
      if (it.k === 'vent') {
        if (Math.random() < dt * 6 && Math.abs(it.x - this.p.x) < 700 && Math.abs(it.y - this.p.y) < 500) this.parts.push({ x: it.x + rr(-8, 8), y: it.y, vx: rr(-8, 8), vy: -rr(60, 110), life: 1.6, max: 1.6, size: rr(1.5, 3.5), col: '#cfeeff', kind: 2, grav: -10 });
        if (d < 60) { p.air = Math.min(this.st.maxAir, p.air + 22 * dt); if (Math.random() < dt * 3) { this.ft(p.x, p.y - 30, '+air', '#7fe9ff', 11); audio.play('vent'); } }
        continue;
      }
      if (it.k === 'crate') continue;
      if (it.k === 'core' && !this.coreAvailable) continue;
      const mag = this.st.magnet + (it.k === 'core' ? 20 : 0);
      if (d < mag && (it.w === 0 || it.k === 'core' || p.cargoW + it.w <= this.st.cargoCap)) {
        const a = Math.atan2(p.y - it.y, p.x - it.x);
        const s = 160 * (1 - d / (mag + 1)) + 40;
        it.x += Math.cos(a) * s * dt; it.y += Math.sin(a) * s * dt;
      }
      if (d < p.r + 14) this.pickup(it);
    }
    if (this.items.some((i) => i.taken)) this.items = this.items.filter((i) => !i.taken);
  }

  private pickup(it: Item) {
    const p = this.p;
    if (it.w > 0 && it.k !== 'core' && p.cargoW + it.w > this.st.cargoCap) {
      if (this.t - this.fullMsg > 1.5) { this.fullMsg = this.t; this.toast(`Cargo full (${p.cargoW}/${this.st.cargoCap}) — upgrade racks or dock`, '#ff9d6b'); audio.play('deny'); }
      return;
    }
    it.taken = true;
    p.cargoW += it.w; p.cargoV += it.v;
    if (it.k === 'tablet') {
      this.stats.tablets.push(it.tab);
      this.announce('ARCHIVE FRAGMENT RECOVERED', 'Added to your Codex');
      audio.play('tablet');
    } else if (it.k === 'relic') {
      this.stats.relics++;
      this.addThreat(6);
      this.alertEels(it.x, it.y, 350);
      this.ft(p.x, p.y - 30, 'RELIC +' + it.v, '#ffd27a', 18);
      audio.play('relic');
      this.burst(it.x, it.y, 20, '#ffd27a', 140, 0.7, 3, 1);
    } else if (it.k === 'core') {
      this.coreTaken = true;
      this.addThreat(25);
      this.alertEels(p.x, p.y, 900);
      this.announce(this.cfg.boss ? 'HEART OF THE ARCHIVE SECURED' : 'ARCHIVE CORE SECURED', 'Return to the surface dock — the deep is awake.');
      audio.play('good');
      this.addShake(10);
      this.burst(it.x, it.y, 50, '#9fffe0', 240, 1, 4, 1);
    } else {
      this.ft(p.x, p.y - 28, '+' + it.v, '#fff1a8', 13);
      audio.play('pickup');
      if (it.k === 'scrap') this.tutScrap++;
    }
  }

  private updateRings(dt: number) {
    for (const r of this.rings) {
      r.r += (r.kind === 'sonar' ? 520 : 700) * dt;
      if (r.kind === 'sonar') {
        for (const e of this.ents) if (!e.dead && !r.seen.has(e) && dist(e.x, e.y, r.x, r.y) <= r.r) { r.seen.add(e); e.rev = 5; }
        for (const it of this.items) if (!it.taken && !r.seen.has(it) && dist(it.x, it.y, r.x, r.y) <= r.r) {
          r.seen.add(it);
          if (it.k !== 'tablet' || this.o.save.codex.length >= 8) it.rev = 6;
        }
        for (const n of this.nodes) if (dist(n.x, n.y, r.x, r.y) <= r.r) n.seen = true;
      }
    }
    this.rings = this.rings.filter((r) => r.r < r.max);
    for (const f of this.flares) {
      f.life -= dt;
      f.vy *= Math.exp(-1 * dt);
      const q = { x: f.x, y: f.y + f.vy * dt, vx: 0, vy: 0 };
      this.collide(q, 6, 0);
      f.x = q.x; f.y = q.y;
      if (Math.random() < dt * 25) this.parts.push({ x: f.x, y: f.y, vx: rr(-15, 15), vy: rr(-30, -5), life: 0.6, max: 0.6, size: 2, col: '#ffcf70', kind: 1, grav: 0 });
    }
    this.flares = this.flares.filter((f) => f.life > 0);
    for (const n of this.nodes) n.cd = Math.max(0, n.cd - dt);
  }

  private updateDirector(dt: number) {
    if (this.o.tutorial) return;
    const hungry = this.mods.includes('hungry') ? 1.5 : 1;
    const lvl = this.threatLevel();
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(4, 16 - lvl * 2.2) / (this.diff.enemy * hungry);
      const cap = Math.floor((2 + lvl * 1.4) * this.diff.enemy * hungry);
      const live = this.ents.filter((e) => e.spawned && !e.dead).length;
      if (live < cap && this.depthM(this.p.y) > 4) {
        const pos = this.pickCell({ near: this.p, rMin: 480, rMax: 900, minY: WATER + 250, far: 480, from: this.p });
        const opts: Kind[] = ['eel'];
        if (lvl >= 1) opts.push('jelly');
        if (this.cfg.id >= 2 && lvl >= 2) opts.push('angler');
        if (this.cfg.id >= 2 && lvl >= 3) opts.push('sentinel');
        const k = opts[Math.floor(Math.random() * opts.length)];
        const e = this.mkEnt(k, pos.x, pos.y);
        e.spawned = true;
        if (k === 'eel') { e.st = 'hunt'; e.t = 6; }
        this.ents.push(e);
        if (k === 'eel' && lvl >= 2) this.toast('Something is hunting you…', '#ff9d6b');
      }
    }
    this.evT -= dt;
    if (this.evT <= 0 && !this.bossAlive) {
      this.evT = rr(55, 90) / Math.sqrt(this.diff.threat);
      const r = Math.floor(Math.random() * 4);
      const p = this.p;
      if (r === 0) { const a = rr(0, TAU); this.surge = { x: Math.cos(a), y: Math.sin(a) * 0.5, t: 8 }; this.announce('TIDAL SURGE', 'The current drags you off course'); audio.play('creak'); }
      else if (r === 1) { for (let i = 0; i < 6; i++) { const c = this.pickCell({ near: p, rMin: 350, rMax: 650, from: p, far: 300, minY: WATER + 200 }); const j = this.mkEnt('jelly', c.x, c.y); j.spawned = true; this.ents.push(j); } this.announce('BIOLUMINESCENT BLOOM', 'Jellies are drawn to light'); }
      else if (r === 2) { this.silt = 14; this.announce('SILT STORM', 'Visibility collapses'); }
      else { for (let i = 0; i < 3; i++) { const c = this.pickCell({ near: p, rMin: 450, rMax: 750, from: p, far: 350, minY: WATER + 250 }); const e = this.mkEnt('eel', c.x, c.y); e.spawned = true; e.st = 'hunt'; e.t = 6; this.ents.push(e); } this.announce('FEEDING FRENZY', 'Eels converge on you'); audio.play('alarm'); }
    }
  }

  private updateFx(dt: number) {
    for (const q of this.parts) {
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vy += q.grav * dt;
      const dr = Math.exp(-(q.kind === 2 ? 0.5 : 2.5) * dt);
      q.vx *= dr; q.vy *= dr;
    }
    this.parts = this.parts.filter((q) => q.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 28 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
  }

  private updateTutorial() {
    const s = this.tutStep;
    let ok = false;
    if (s === 0) ok = this.tutMoved > 260;
    else if (s === 1) ok = this.tutBoost > 0.6;
    else if (s === 2) ok = this.tutToggle >= 1;
    else if (s === 3) ok = this.tutScrap >= 3;
    else if (s === 4) ok = this.tutKilled;
    else if (s === 5) ok = this.sonarUsed;
    else if (s === 6) ok = this.flareUsed;
    else if (s === 7) ok = this.nodes.every((n) => n.done);
    if (ok && s < 8) {
      this.tutStep++;
      audio.play('good');
      this.toast('✔ ' + (s < 7 ? 'Step complete!' : 'Terminal online! Now head for the dock.'), '#9fffe0');
      if (this.tutStep === 4) this.p.lantern = this.p.lantern || this.p.power > 3;
    }
  }

  /* ------------------------------------------------------------ end */
  objective(): string {
    if (this.o.tutorial) return `Training ${Math.min(this.tutStep + 1, 9)}/9: ${TUTORIAL_STEPS[Math.min(this.tutStep, 8)]}`;
    const left = this.nodes.filter((n) => !n.done).length;
    if (left > 0) return `Activate ancient terminals (${this.nodes.length - left}/${this.nodes.length})`;
    if (this.cfg.boss && this.bossAlive) return 'Defeat the Warden — strike when it stumbles';
    if (!this.coreTaken) return this.cfg.boss ? 'Claim the Heart of the Archive' : 'Claim the Archive Core in the vault';
    return 'Return to the surface dock (E)';
  }

  objTarget(): Pt | null {
    if (this.o.tutorial) {
      if (this.tutStep === 7) { const n = this.nodes.find((q) => !q.done); return n ? { x: n.x, y: n.y } : null; }
      if (this.tutStep >= 8) return { x: this.W2 / 2, y: WATER };
      return null;
    }
    let best: Pt | null = null, bd = 1e9;
    const left = this.nodes.filter((n) => !n.done);
    if (left.length) { for (const n of left) { const d = dist(n.x, n.y, this.p.x, this.p.y); if (d < bd) { bd = d; best = n; } } return best; }
    if (this.bossAlive && this.boss) return this.boss;
    if (!this.coreTaken) return this.lv.corePos;
    return { x: this.W2 / 2, y: WATER };
  }

  end(outcome: DiveResult['outcome'], cause: string) {
    if (this.ended) return;
    this.ended = true;
    this.puzzleOpen = false;
    const modBonus = this.mods.reduce((a, id) => a + (MODS.find((m) => m.id === id)?.marks || 0), 0);
    const mult = this.diff.marks * (1 + modBonus) * this.st.marksMul;
    const cv = this.p.cargoV;
    const kept = outcome === 'death' ? cv * this.st.insurance : outcome === 'abandon' || outcome === 'training' ? 0 : cv;
    const reward = outcome === 'success' ? this.cfg.reward * (this.firstClear ? 1.5 : 1) : 0;
    const res: DiveResult = {
      outcome, cause, siteId: this.cfg.id, time: this.time, cargoValue: Math.round(cv), kept: Math.round(kept), reward: Math.round(reward * mult),
      payout: Math.round((kept + reward) * mult), creatures: this.stats.creatures, nodes: this.stats.nodes, nodesTotal: this.nodes.length, relics: this.stats.relics,
      tablets: this.stats.tablets, maxDepth: this.stats.maxDepth, damage: this.stats.damage, shots: this.stats.shots, hits: this.stats.hits, flares: this.stats.flares,
      bossDown: this.bossDown, coreTaken: this.coreTaken, threatPeak: this.stats.threatPeak, firstClear: this.firstClear,
    };
    if (outcome === 'death') { audio.play('bad'); this.addShake(20); this.burst(this.p.x, this.p.y, 60, '#ff9a6b', 260, 1.2, 4); }
    setTimeout(() => { if (!this.dead) this.o.cb.onEnd(res); }, outcome === 'death' ? 1300 : 250);
  }

  /* ------------------------------------------------------------ rendering */
  private toScreenX(x: number) { return (x - this.cam.x + this.shx) * this.zoom * this.dpr; }
  private toScreenY(y: number) { return (y - this.cam.y + this.shy) * this.zoom * this.dpr; }

  render() {
    const c = this.c, dpr = this.dpr, z = this.zoom;
    const W = this.W, H = this.H;
    const vw = W / z, vh = H / z;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
    // water backdrop
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const d0 = this.depthM(this.cam.y), d1 = this.depthM(this.cam.y + vh);
    const c0 = waterCol(d0), c1 = waterCol(d1);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgb(${c0[0] | 0},${c0[1] | 0},${c0[2] | 0})`);
    g.addColorStop(1, `rgb(${c1[0] | 0},${c1[1] | 0},${c1[2] | 0})`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // light shafts
    if (d0 < 140) {
      const a = (1 - d0 / 140) * 0.12;
      c.fillStyle = `rgba(255,255,220,${a})`;
      for (let i = 0; i < 6; i++) {
        const x = ((i * 337 + this.t * 8) % (W + 300)) - 150 - this.cam.x * 0.1;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 60, 0); c.lineTo(x - 90 + 40, H); c.lineTo(x - 190, H); c.fill();
      }
    }
    // marine snow
    c.fillStyle = 'rgba(200,230,255,0.25)';
    for (const s of this.snow) {
      const px = (((s.x * W - this.cam.x * z * 0.3 * s.s) % W) + W) % W, py = (((s.y * H - this.cam.y * z * 0.3 * s.s + this.t * 6 * s.s) % H) + H) % H;
      c.fillRect(px, py, 1.5 * s.s, 1.5 * s.s);
    }
    // world
    c.setTransform(dpr * z, 0, 0, dpr * z, (-this.cam.x + this.shx) * dpr * z, (-this.cam.y + this.shy) * dpr * z);
    this.glows = [];
    this.drawSky(c, vw);
    this.drawTiles(c, vw, vh);
    this.drawWorld(c, vw, vh);
    // darkness
    this.drawDarkness();
    // glow + overlays (additive)
    c.setTransform(dpr * z, 0, 0, dpr * z, (-this.cam.x + this.shx) * dpr * z, (-this.cam.y + this.shy) * dpr * z);
    this.drawGlows(c);
    this.drawOverlay(c);
    // HUD
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.globalCompositeOperation = 'source-over';
    this.drawHUD(c);
  }

  private drawSky(c: CanvasRenderingContext2D, vw: number) {
    if (this.cam.y > WATER + 20) return;
    const x0 = this.cam.x - 20, w = vw + 40;
    const g = c.createLinearGradient(0, -400, 0, WATER);
    g.addColorStop(0, '#ff9f6b'); g.addColorStop(0.6, '#ffd9a0'); g.addColorStop(1, '#a8e0f0');
    c.fillStyle = g;
    c.fillRect(x0, -400, w, 400 + WATER);
    // sun
    c.fillStyle = 'rgba(255,245,200,0.9)';
    c.beginPath(); c.arc(this.W2 * 0.2, -120, 46, 0, TAU); c.fill();
    // dock + tender
    const dx = this.W2 / 2;
    c.fillStyle = '#5a3d2b';
    c.fillRect(dx - 150, WATER - 14, 300, 10);
    for (let i = -3; i <= 3; i++) c.fillRect(dx + i * 44 - 3, WATER - 14, 6, 40);
    c.fillStyle = '#c8553d';
    c.beginPath(); c.moveTo(dx - 90, WATER - 14); c.lineTo(dx + 90, WATER - 14); c.lineTo(dx + 70, WATER + 4); c.lineTo(dx - 70, WATER + 4); c.fill();
    c.fillStyle = '#f2e6d0'; c.fillRect(dx - 30, WATER - 60, 60, 46);
    c.fillStyle = '#c8553d'; c.fillRect(dx - 36, WATER - 66, 72, 8);
    c.fillStyle = '#6ad0ff'; c.fillRect(dx - 20, WATER - 48, 14, 14); c.fillRect(dx + 6, WATER - 48, 14, 14);
    c.fillStyle = '#5a3d2b'; c.fillRect(dx + 50, WATER - 110, 4, 96);
    c.fillStyle = '#ffd27a'; c.beginPath(); c.moveTo(dx + 54, WATER - 110); c.lineTo(dx + 90, WATER - 98); c.lineTo(dx + 54, WATER - 86); c.fill();
    // waterline
    c.fillStyle = 'rgba(160,230,245,0.55)';
    c.beginPath(); c.moveTo(x0, WATER + 10);
    for (let x = x0; x <= x0 + w; x += 20) c.lineTo(x, WATER + Math.sin(x * 0.03 + this.t * 2) * 3);
    c.lineTo(x0 + w, WATER + 12); c.closePath(); c.fill();
  }

  private drawTiles(c: CanvasRenderingContext2D, vw: number, vh: number) {
    const lv = this.lv;
    const x0 = Math.max(0, Math.floor(this.cam.x / TILE)), x1 = Math.min(lv.cols - 1, Math.floor((this.cam.x + vw) / TILE));
    const y0 = Math.max(0, Math.floor(this.cam.y / TILE)), y1 = Math.min(lv.rows - 1, Math.floor((this.cam.y + vh) / TILE));
    const col = this.cfg.color;
    for (let y = y0; y <= y1; y++) {
      const f = 1 - Math.min(0.55, this.depthM(y * TILE) / 900);
      for (let x = x0; x <= x1; x++) {
        if (!lv.solid[y * lv.cols + x]) continue;
        const h = ((x * 73856093) ^ (y * 19349663)) & 15;
        const v = (h - 8) * 1.6;
        c.fillStyle = `rgb(${(col[0] * f + v) | 0},${(col[1] * f + v) | 0},${(col[2] * f + v) | 0})`;
        c.fillRect(x * TILE, y * TILE, TILE + 0.5, TILE + 0.5);
        if (y > 0 && !lv.solid[(y - 1) * lv.cols + x]) { c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(x * TILE, y * TILE, TILE, 4); }
        if (y + 1 < lv.rows && !lv.solid[(y + 1) * lv.cols + x]) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(x * TILE, y * TILE + TILE - 4, TILE, 4); }
        if (x > 0 && !lv.solid[y * lv.cols + x - 1]) { c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(x * TILE, y * TILE, 3, TILE); }
        if (x + 1 < lv.cols && !lv.solid[y * lv.cols + x + 1]) { c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x * TILE + TILE - 3, y * TILE, 3, TILE); }
      }
    }
  }

  private visible(x: number, y: number, m: number, vw: number, vh: number) {
    return x > this.cam.x - m && x < this.cam.x + vw + m && y > this.cam.y - m && y < this.cam.y + vh + m;
  }

  private pushGlow(x: number, y: number, r: number, col: string, a: number) { this.glows.push({ x, y, r, col, a }); }

  private drawWorld(c: CanvasRenderingContext2D, vw: number, vh: number) {
    const t = this.t;
    // vault barrier
    const cp = this.lv.corePos;
    if (!this.coreAvailable && !this.coreTaken && this.visible(cp.x, cp.y, 120, vw, vh)) {
      c.strokeStyle = 'rgba(120,255,230,0.7)'; c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i <= 6; i++) { const a = (i / 6) * TAU + t * 0.4; const px = cp.x + Math.cos(a) * 78, py = cp.y + Math.sin(a) * 78; if (i) c.lineTo(px, py); else c.moveTo(px, py); }
      c.stroke();
      c.fillStyle = 'rgba(80,200,200,0.12)'; c.fill();
      this.pushGlow(cp.x, cp.y, 110, '90,255,230', 0.35);
    }
    // nodes
    for (const n of this.nodes) {
      if (!this.visible(n.x, n.y, 100, vw, vh)) continue;
      c.save(); c.translate(n.x, n.y);
      c.fillStyle = '#3c4a57'; c.fillRect(-16, -34, 32, 60);
      c.fillStyle = '#566676'; c.fillRect(-20, 20, 40, 8);
      c.fillStyle = n.done ? '#6dffb0' : n.cd > 0 ? '#ff7a6b' : '#6adfff';
      c.globalAlpha = 0.7 + Math.sin(t * 3) * 0.2;
      c.beginPath(); c.arc(0, -12, 9, 0, TAU); c.fill();
      c.fillRect(-9, 6, 18, 3);
      c.globalAlpha = 1;
      c.strokeStyle = c.fillStyle; c.lineWidth = 2;
      c.beginPath(); c.arc(0, -12, 14 + Math.sin(t * 2) * 2, 0, TAU); c.stroke();
      c.restore();
      this.pushGlow(n.x, n.y - 12, n.done ? 90 : 130, n.done ? '109,255,176' : n.cd > 0 ? '255,122,107' : '106,223,255', 0.5);
      if (!n.done && dist(n.x, n.y, this.p.x, this.p.y) < 95) this.promptAt = { x: n.x, y: n.y - 56, text: n.cd > 0 ? 'Recharging…' : 'Press E — decode terminal' };
    }
    // items
    for (const it of this.items) {
      if (it.taken || !this.visible(it.x, it.y, 40, vw, vh)) continue;
      const bob = Math.sin(t * 2 + it.ph) * 3;
      c.save(); c.translate(it.x, it.y + bob);
      switch (it.k) {
        case 'scrap': c.fillStyle = '#9a8f80'; c.rotate(it.ph); c.fillRect(-6, -4, 12, 8); c.fillStyle = '#c4b8a0'; c.fillRect(-6, -4, 12, 2); break;
        case 'gear': c.fillStyle = '#d6a63c'; c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + t * 0.5, rad = i % 2 ? 7 : 10; c.lineTo(Math.cos(a) * rad, Math.sin(a) * rad); } c.fill(); c.fillStyle = '#3a2d12'; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill(); this.pushGlow(it.x, it.y, 26, '255,200,80', 0.25); break;
        case 'relic': c.fillStyle = '#ffd27a'; c.beginPath(); c.moveTo(0, -14); c.lineTo(10, -3); c.lineTo(7, 12); c.lineTo(-7, 12); c.lineTo(-10, -3); c.fill(); c.fillStyle = '#b3721f'; c.fillRect(-7, 2, 14, 3); this.pushGlow(it.x, it.y, 60, '255,210,110', 0.55); break;
        case 'tablet': c.fillStyle = '#7fe9ff'; c.fillRect(-8, -11, 16, 22); c.fillStyle = '#0e3550'; c.fillRect(-5, -7, 10, 2); c.fillRect(-5, -2, 7, 2); c.fillRect(-5, 3, 9, 2); this.pushGlow(it.x, it.y, 70, '110,230,255', 0.6); break;
        case 'sample': c.fillStyle = '#c0ff9a'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.fillStyle = '#4a8a2a'; c.fillRect(-3, -11, 6, 5); this.pushGlow(it.x, it.y, 34, '190,255,150', 0.4); break;
        case 'core': c.fillStyle = '#9fffe0'; c.rotate(t); c.fillRect(-14, -14, 28, 28); c.rotate(-t * 2); c.fillStyle = '#e8fff8'; c.fillRect(-8, -8, 16, 16); this.pushGlow(it.x, it.y, 150, '110,255,220', 0.8); break;
        case 'crate': c.fillStyle = '#8a6a3a'; c.fillRect(-11, -11, 22, 22); c.strokeStyle = '#4a3418'; c.lineWidth = 2; c.strokeRect(-11, -11, 22, 22); c.beginPath(); c.moveTo(-11, -11); c.lineTo(11, 11); c.moveTo(11, -11); c.lineTo(-11, 11); c.stroke(); this.pushGlow(it.x, it.y, 30, '255,220,150', 0.25); break;
        case 'vent': c.fillStyle = '#2a3036'; c.beginPath(); c.moveTo(-14, 14); c.lineTo(-6, 0); c.lineTo(6, 0); c.lineTo(14, 14); c.fill(); this.pushGlow(it.x, it.y - 10, 60, '120,230,255', 0.3); break;
      }
      c.restore();
    }
    // flares
    for (const f of this.flares) this.pushGlow(f.x, f.y, 210 + Math.sin(t * 20) * 8, '255,200,110', clamp(f.life / 3, 0, 1));
    // entities
    for (const e of this.ents) { if (this.visible(e.x, e.y, 120, vw, vh)) this.drawEnt(c, e); }
    // projectiles
    for (const q of this.projs) {
      if (q.own === 'p') { c.strokeStyle = '#e8f6ff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); c.stroke(); }
      else { c.fillStyle = q.col; c.beginPath(); c.arc(q.x, q.y, q.r, 0, TAU); c.fill(); this.pushGlow(q.x, q.y, 34, q.col === '#ff7ad0' ? '255,122,208' : '122,208,255', 0.8); }
    }
    // player
    this.drawSub(c);
    // particles
    for (const q of this.parts) {
      const a = clamp(q.life / q.max, 0, 1);
      c.globalAlpha = a * (q.kind === 2 ? 0.7 : 1);
      c.fillStyle = q.col;
      if (q.kind === 2) { c.strokeStyle = q.col; c.lineWidth = 1; c.beginPath(); c.arc(q.x, q.y, q.size, 0, TAU); c.stroke(); }
      else c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    c.globalAlpha = 1;
  }
  promptAt: { x: number; y: number; text: string } | null = null;

  private drawSub(c: CanvasRenderingContext2D) {
    const p = this.p;
    if (this.ended && p.hull <= 0) return;
    if (p.inv > 0 && Math.floor(this.t * 20) % 2 === 0) c.globalAlpha = 0.55;
    c.save(); c.translate(p.x, p.y);
    c.save();
    c.rotate(clamp(p.vy / 500, -0.35, 0.35) * p.face);
    c.scale(p.face, 1);
    const sp = Math.hypot(p.vx, p.vy);
    // prop
    c.fillStyle = '#7a5a1f'; c.fillRect(-31, -4, 7, 8);
    c.strokeStyle = '#d0d8de'; c.lineWidth = 2;
    const a = this.t * (12 + sp * 0.1);
    c.beginPath(); c.moveTo(-34, Math.sin(a) * 9); c.lineTo(-34, -Math.sin(a) * 9); c.stroke();
    // body
    const flash = p.flash > 0;
    c.fillStyle = flash ? '#fff' : '#f5c030';
    c.beginPath(); c.ellipse(0, 0, 27, 15, 0, 0, TAU); c.fill();
    c.fillStyle = flash ? '#fff' : '#d38a10';
    c.beginPath(); c.ellipse(0, 5, 26, 9, 0, 0, Math.PI); c.fill();
    c.fillRect(-7, -20, 11, 7);
    c.fillStyle = '#1a3f58'; c.beginPath(); c.arc(9, -3, 9, 0, TAU); c.fill();
    c.fillStyle = 'rgba(160,230,255,0.6)'; c.beginPath(); c.arc(7, -6, 4, 0, TAU); c.fill();
    c.fillStyle = p.lantern ? '#fffbd0' : '#555'; c.fillRect(25, -3, 5, 7);
    c.restore();
    // harpoon gun
    c.rotate(p.aim);
    c.fillStyle = '#39454f'; c.fillRect(8, -2.5, 20, 5); c.fillStyle = '#9fb0bc'; c.fillRect(24, -1.5, 6, 3);
    c.restore();
    c.globalAlpha = 1;
    if (p.lantern && p.power > 0) this.pushGlow(p.x, p.y, 40, '255,250,200', 0.25);
  }

  private drawEnt(c: CanvasRenderingContext2D, e: Ent) {
    const t = this.t;
    c.save(); c.translate(e.x, e.y);
    switch (e.k) {
      case 'fish': {
        c.rotate(Math.atan2(e.vy, e.vx)); c.fillStyle = e.flash > 0 ? '#fff' : '#cfe3f5';
        c.beginPath(); c.ellipse(0, 0, 8, 3.5, 0, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(-6, 0); c.lineTo(-12, -4 + Math.sin(t * 15 + e.ph) * 2); c.lineTo(-12, 4 + Math.sin(t * 15 + e.ph) * 2); c.fill();
        this.pushGlow(e.x, e.y, 14, '200,230,255', 0.18);
        break;
      }
      case 'jelly': {
        const pul = Math.sin(t * 3 + e.ph);
        c.fillStyle = e.flash > 0 ? '#fff' : 'rgba(255,130,225,0.65)';
        c.beginPath(); c.ellipse(0, 0, 14 + pul * 1.5, 11 - pul, 0, Math.PI, TAU); c.fill();
        c.strokeStyle = 'rgba(255,170,240,0.7)'; c.lineWidth = 2;
        for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 5, 0); for (let k = 1; k <= 4; k++) c.lineTo(i * 5 + Math.sin(t * 4 + k + i) * 3, k * 6); c.stroke(); }
        this.pushGlow(e.x, e.y, 62, '255,110,230', 0.55);
        break;
      }
      case 'eel': {
        c.restore();
        const pts = [{ x: e.x, y: e.y }, ...e.trail];
        for (let i = pts.length - 1; i >= 0; i--) {
          c.fillStyle = e.flash > 0 ? '#fff' : i % 2 ? '#3f7d5a' : '#2f6648';
          c.beginPath(); c.arc(pts[i].x, pts[i].y, e.r * (1 - i * 0.07), 0, TAU); c.fill();
        }
        const ex = e.x + Math.cos(e.ang) * 6, ey = e.y + Math.sin(e.ang) * 6;
        this.pushGlow(ex, ey, e.st === 'hunt' ? 26 : 16, '255,60,60', 0.9);
        c.fillStyle = '#ff3b3b'; c.beginPath(); c.arc(ex, ey - 3, 2.5, 0, TAU); c.fill();
        c.save(); c.translate(e.x, e.y);
        break;
      }
      case 'angler': {
        c.rotate(e.ang); if (Math.cos(e.ang) < 0) c.scale(1, -1);
        c.fillStyle = e.flash > 0 ? '#fff' : '#2c3150';
        c.beginPath(); c.ellipse(0, 0, 28, 22, 0, 0, TAU); c.fill();
        c.fillStyle = '#1b1f35'; c.beginPath(); c.moveTo(-24, 0); c.lineTo(-42, -14); c.lineTo(-42, 14); c.fill();
        c.fillStyle = '#e8e8d0';
        for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(14 + i * 2, -10 + i * 4); c.lineTo(24 + i, -6 + i * 4); c.lineTo(14 + i * 2, -6 + i * 4); c.fill(); }
        c.strokeStyle = '#4a4f78'; c.lineWidth = 2; c.beginPath(); c.moveTo(10, -18); c.quadraticCurveTo(30, -50, 52, -32); c.stroke();
        c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(52, -32, 6, 0, TAU); c.fill();
        c.fillStyle = '#ff4040'; c.beginPath(); c.arc(14, -6, 3, 0, TAU); c.fill();
        c.restore();
        const lure = this.localPt(e, 52, -32);
        const eye = this.localPt(e, 14, -6);
        this.pushGlow(lure.x, lure.y, 75, '255,200,90', 0.9 + Math.sin(t * 5) * 0.1);
        this.pushGlow(eye.x, eye.y, 20, '255,50,50', 0.8);
        c.save(); c.translate(e.x, e.y);
        break;
      }
      case 'sentinel': {
        c.fillStyle = e.flash > 0 ? '#fff' : '#7a8ba0';
        c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + e.ph; c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); } c.fill();
        c.strokeStyle = '#3c4a58'; c.lineWidth = 3; c.stroke();
        c.strokeStyle = '#a9b8c8'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, 27, t * 2, t * 2 + 3.5); c.stroke();
        const charging = e.cd < 0.5 && e.stun <= 0 && e.cd > 0;
        c.fillStyle = e.stun > 0 ? '#444' : charging ? '#ff4040' : '#6ad8ff';
        c.beginPath(); c.arc(Math.cos(e.ang) * 6, Math.sin(e.ang) * 6, 6, 0, TAU); c.fill();
        this.pushGlow(e.x + Math.cos(e.ang) * 6, e.y + Math.sin(e.ang) * 6, charging ? 60 : 36, charging ? '255,60,60' : '106,216,255', e.stun > 0 ? 0.1 : 0.9);
        break;
      }
      case 'drone': {
        c.rotate(t * 5); c.fillStyle = '#c44'; c.fillRect(-7, -7, 14, 14); c.rotate(Math.PI / 4); c.fillRect(-7, -7, 14, 14);
        this.pushGlow(e.x, e.y, 36, '255,80,80', 0.9);
        break;
      }
      case 'boss': {
        const open = e.st === 'recover';
        c.rotate(e.ang); if (Math.cos(e.ang) < 0) c.scale(1, -1);
        c.fillStyle = e.flash > 0 ? '#fff' : '#2a2038';
        c.beginPath(); c.ellipse(0, 0, 92, 62, 0, 0, TAU); c.fill();
        c.fillStyle = '#1a1226'; c.beginPath(); c.moveTo(-80, 0); c.lineTo(-140, -44); c.lineTo(-130, 0); c.lineTo(-140, 44); c.fill();
        // plates
        c.fillStyle = e.flash > 0 ? '#fff' : '#5a4a78';
        const spread = open ? 14 : 0;
        for (let i = -2; i <= 2; i++) { c.save(); c.translate(-10 + i * 6, i * 22 + Math.sign(i) * spread); c.rotate(i * 0.2); c.fillRect(-30, -9, 62, 18); c.restore(); }
        // eye
        c.fillStyle = open ? '#ffe28a' : '#ff4a8a'; c.beginPath(); c.arc(54, -14, open ? 15 : 9, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(56, -16, 4, 0, TAU); c.fill();
        // jaw
        c.fillStyle = '#e8e0d0';
        for (let i = 0; i < 7; i++) { c.beginPath(); c.moveTo(60 + i * 4, 12 + i * 3); c.lineTo(78 + i * 3, 16 + i * 3); c.lineTo(64 + i * 4, 22 + i * 3); c.fill(); }
        c.restore();
        const eye = this.localPt(e, 54, -14);
        this.pushGlow(eye.x, eye.y, open ? 160 : 100, open ? '255,226,138' : '255,74,138', 1);
        if (e.st === 'telegraph') this.pushGlow(e.x, e.y, 220, '255,60,60', 0.35);
        c.save(); c.translate(e.x, e.y);
        break;
      }
    }
    if (e.stun > 0) {
      c.strokeStyle = '#9fe8ff'; c.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { c.beginPath(); const a = rr(0, TAU); c.moveTo(Math.cos(a) * e.r, Math.sin(a) * e.r); c.lineTo(Math.cos(a + 0.3) * e.r * 1.5, Math.sin(a + 0.3) * e.r * 1.5); c.stroke(); }
    }
    if (e.flash > 0 && e.k !== 'boss') { c.fillStyle = `rgba(255,255,255,${e.flash * 3})`; c.beginPath(); c.arc(0, 0, e.r, 0, TAU); c.fill(); }
    c.restore();
  }

  private localPt(e: Ent, lx: number, ly0: number): Pt {
    const ly = ly0 * (Math.cos(e.ang) < 0 ? -1 : 1);
    const ca = Math.cos(e.ang), sa = Math.sin(e.ang);
    return { x: e.x + lx * ca - ly * sa, y: e.y + lx * sa + ly * ca };
  }

  private drawDarkness() {
    const p = this.p, d = this.d;
    const depth = this.depthM(p.y);
    let amb = clamp((depth - 6) / 230, 0, 1) * 0.93;
    if (this.silt > 0) amb = Math.min(0.97, amb + 0.1);
    const lensMul = (this.silt > 0 ? 0.55 : 1) * this.bossDark;
    const w = this.dark.width, h = this.dark.height;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, w, h);
    if (amb < 0.02) return;
    d.fillStyle = `rgba(1,4,12,${amb})`;
    d.fillRect(0, 0, w, h);
    d.globalCompositeOperation = 'destination-out';
    const k = this.zoom * this.dpr;
    const hole = (x: number, y: number, r: number, a: number) => {
      const sx = this.toScreenX(x), sy = this.toScreenY(y), rad = r * k;
      if (sx < -rad || sy < -rad || sx > w + rad || sy > h + rad) return;
      const g = d.createRadialGradient(sx, sy, 0, sx, sy, rad);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.7})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g; d.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
    };
    hole(p.x, p.y, 85, 0.85);
    if (p.lantern && p.power > 0) hole(p.x + Math.cos(p.aim) * 30, p.y + Math.sin(p.aim) * 30, this.st.lensR * lensMul * (1 + Math.sin(this.t * 17) * 0.01), 1);
    for (const f of this.flares) hole(f.x, f.y, 190 + Math.sin(this.t * 20) * 6, clamp(f.life / 3, 0, 1));
    for (const n of this.nodes) hole(n.x, n.y - 12, 100, 0.6);
    for (const r of this.rings) if (r.kind !== 'sonar') hole(r.x, r.y, r.r, 0.15);
    for (const g of this.glows) { if (g.r > 20) hole(g.x, g.y, g.r * 0.6, g.a * 0.25); }
    this.c.setTransform(1, 0, 0, 1, 0, 0);
    this.c.globalCompositeOperation = 'source-over';
    this.c.drawImage(this.dark, 0, 0);
  }

  private drawGlows(c: CanvasRenderingContext2D) {
    c.globalCompositeOperation = 'lighter';
    for (const g of this.glows) {
      const gr = c.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
      gr.addColorStop(0, `rgba(${g.col},${clamp(g.a, 0, 1)})`);
      gr.addColorStop(1, `rgba(${g.col},0)`);
      c.fillStyle = gr;
      c.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }

  private drawOverlay(c: CanvasRenderingContext2D) {
    const t = this.t;
    // boss telegraph lines
    for (const w of this.warns) {
      c.strokeStyle = `rgba(255,60,60,${0.4 + Math.sin(t * 30) * 0.2})`; c.lineWidth = 36;
      c.beginPath(); c.moveTo(w.x1, w.y1); c.lineTo(w.x2, w.y2); c.stroke();
    }
    // rings
    for (const r of this.rings) {
      const a = 1 - r.r / r.max;
      c.lineWidth = r.kind === 'emp' ? 6 : 3;
      c.strokeStyle = r.kind === 'sonar' ? `rgba(120,255,240,${a * 0.8})` : r.kind === 'emp' ? `rgba(180,230,255,${a})` : `rgba(255,220,150,${a * 0.8})`;
      c.beginPath(); c.arc(r.x, r.y, r.r, 0, TAU); c.stroke();
    }
    // revealed blips
    for (const e of this.ents) {
      if (e.dead || e.rev <= 0) continue;
      const a = Math.min(1, e.rev / 2);
      c.strokeStyle = e.k === 'fish' ? `rgba(160,220,255,${a * 0.6})` : `rgba(255,120,120,${a})`;
      c.lineWidth = 2;
      c.beginPath(); c.arc(e.x, e.y, e.r + 8 + Math.sin(t * 6) * 2, 0, TAU); c.stroke();
    }
    for (const it of this.items) {
      if (it.taken || it.rev <= 0 || it.k === 'vent') continue;
      const a = Math.min(1, it.rev / 2);
      c.strokeStyle = it.k === 'relic' || it.k === 'tablet' || it.k === 'core' ? `rgba(255,220,120,${a})` : `rgba(160,255,200,${a * 0.8})`;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(it.x, it.y - 12); c.lineTo(it.x + 10, it.y); c.lineTo(it.x, it.y + 12); c.lineTo(it.x - 10, it.y); c.closePath(); c.stroke();
    }
    // texts
    for (const tx of this.texts) {
      c.globalAlpha = clamp(tx.life * 2, 0, 1);
      c.font = `700 ${tx.size}px system-ui, sans-serif`;
      c.textAlign = 'center';
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.strokeText(tx.text, tx.x, tx.y);
      c.fillStyle = tx.col; c.fillText(tx.text, tx.x, tx.y);
    }
    c.globalAlpha = 1;
    // prompts
    const p = this.p;
    const dockNear = p.y < WATER + 70 && Math.abs(p.x - this.W2 / 2) < 280;
    let prompt = this.promptAt;
    this.promptAt = null;
    if (dockNear) {
      const ready = this.o.tutorial ? this.tutStep >= 8 : this.coreTaken;
      prompt = { x: this.W2 / 2, y: WATER - 130, text: ready ? 'Press E — dock and bank cargo' : this.o.tutorial ? 'Finish training before docking' : 'Press E — retreat to dock (objective incomplete)' };
    }
    if (prompt) {
      c.font = '700 14px system-ui, sans-serif'; c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.8)'; c.strokeText(prompt.text, prompt.x, prompt.y);
      c.fillStyle = '#fff6c0'; c.fillText(prompt.text, prompt.x, prompt.y);
    }
    // aim line
    if (!this.paused && !this.puzzleOpen) {
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1; c.setLineDash([4, 6]);
      c.beginPath(); c.moveTo(p.x + Math.cos(p.aim) * 30, p.y + Math.sin(p.aim) * 30); c.lineTo(p.x + Math.cos(p.aim) * 150, p.y + Math.sin(p.aim) * 150); c.stroke(); c.setLineDash([]);
    }
  }

  private bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, f: number, col: string, label: string, val: string, flash = false) {
    c.fillStyle = 'rgba(4,14,24,0.7)'; c.fillRect(x, y, w, h);
    c.fillStyle = flash && Math.floor(this.t * 5) % 2 === 0 ? '#ff4040' : col;
    c.fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamp(f, 0, 1)), h - 2);
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.strokeRect(x + 0.5, y + 0.5, w, h);
    c.font = '700 10px system-ui, sans-serif'; c.textAlign = 'left'; c.fillStyle = '#fff';
    c.fillText(label, x + 5, y + h - 4);
    c.textAlign = 'right'; c.fillText(val, x + w - 5, y + h - 4);
  }

  private drawHUD(c: CanvasRenderingContext2D) {
    const p = this.p, st = this.st;
    const hs = clamp(this.W / 900, 0.72, 1.05);
    const W = this.W / hs, H = this.H / hs;
    c.save(); c.scale(hs, hs);
    const touch = this.input.touch;
    // damage vignette
    if (this.dmgFlash > 0 || p.hull < st.maxHull * 0.25 || p.air < st.maxAir * 0.15) {
      const a = Math.max(this.dmgFlash * 0.6, (p.hull < st.maxHull * 0.25 || p.air < st.maxAir * 0.15) ? 0.2 + Math.sin(this.t * 5) * 0.08 : 0);
      const g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,20,20,${a})`);
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    if (this.healFlash > 0) { c.fillStyle = `rgba(120,255,160,${this.healFlash * 0.2})`; c.fillRect(0, 0, W, H); }
    // bars
    const depth = this.depthM(p.y);
    const over = depth > st.rating && !this.o.tutorial;
    this.bar(c, 12, 12, 210, 16, p.hull / st.maxHull, '#5fd36f', 'HULL', `${Math.ceil(p.hull)}/${st.maxHull}`, p.hull < st.maxHull * 0.25);
    this.bar(c, 12, 32, 210, 16, p.air / st.maxAir, '#4fc8f0', 'AIR', `${Math.ceil(p.air)}/${Math.round(st.maxAir)}`, p.air < st.maxAir * 0.2);
    this.bar(c, 12, 52, 210, 16, p.power / st.maxPower, '#f2cf4a', 'POWER', `${Math.ceil(p.power)}/${st.maxPower}`, p.power < 10);
    this.bar(c, 12, 72, 210, 16, p.cargoW / st.cargoCap, '#e0914a', 'CARGO', `${p.cargoW}/${st.cargoCap}  ·  ${Math.round(p.cargoV)}◈`);
    c.font = '700 13px system-ui, sans-serif'; c.textAlign = 'left';
    c.fillStyle = over ? (Math.floor(this.t * 4) % 2 ? '#ff5050' : '#ffb0b0') : '#cfeaff';
    c.fillText(`DEPTH ${Math.round(depth)} m${this.o.tutorial ? '' : ` / rated ${st.rating} m`}`, 14, 106);
    c.font = '600 11px system-ui, sans-serif'; c.fillStyle = '#a8c8de';
    c.fillText(`${this.cfg.name}${this.o.tutorial ? '' : ' · ' + this.diff.name}`, 14, 122);
    c.fillText(`${Math.floor(this.time / 60)}:${String(Math.floor(this.time % 60)).padStart(2, '0')}`, 14, 136);
    // objective + threat
    const cx = W / 2;
    c.textAlign = 'center';
    c.font = '700 14px system-ui, sans-serif';
    const obj = this.objective();
    const tw = Math.min(W - 460, Math.max(260, c.measureText(obj).width + 30));
    c.fillStyle = 'rgba(4,14,24,0.65)'; c.fillRect(cx - tw / 2, 10, tw, 26);
    c.fillStyle = '#ffe9a8';
    c.fillText(obj.length > 90 ? obj.slice(0, 88) + '…' : obj, cx, 28, tw - 10);
    if (!this.o.tutorial) {
      const lvl = this.threatLevel();
      const bw = 220;
      c.fillStyle = 'rgba(4,14,24,0.65)'; c.fillRect(cx - bw / 2, 40, bw, 14);
      const tc = lvl >= 4 ? '#ff4a4a' : lvl >= 2 ? '#ff9d4a' : '#6ad0ff';
      c.fillStyle = tc; c.fillRect(cx - bw / 2 + 1, 41, (bw - 2) * (this.threat / 100), 12);
      c.font = '700 10px system-ui, sans-serif'; c.fillStyle = '#fff';
      c.fillText(`ECOSYSTEM THREAT  LV ${lvl}`, cx, 51);
      for (let i = 1; i < 5; i++) { c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(cx - bw / 2 + (bw * i) / 5, 41, 1, 12); }
    }
    if (this.boss) {
      const b = this.boss, bw = Math.min(420, W - 300);
      c.fillStyle = 'rgba(4,14,24,0.7)'; c.fillRect(cx - bw / 2, 62, bw, 16);
      c.fillStyle = b.st === 'recover' ? '#ffd27a' : '#c04a9a'; c.fillRect(cx - bw / 2 + 1, 63, (bw - 2) * clamp(b.hp / b.max, 0, 1), 14);
      c.font = '700 10px system-ui, sans-serif'; c.fillStyle = '#fff';
      c.fillText(`THE WARDEN — ${b.st === 'recover' ? 'VULNERABLE!' : 'ARMOURED'}`, cx, 74);
    }
    // abilities (non-touch)
    if (!touch) {
      const items: [string, string, number, string][] = [
        ['LMB', '🔱', p.cd / Math.max(0.1, st.cd), ''],
        ['Q', '📡', p.sonarCd / 3, ''],
        ['F', '🎇', p.flareCd / 0.6, String(p.flares)],
        ['R', '⚡', st.emp > 0 ? p.empCd / 12 : 1, st.emp > 0 ? '' : '🔒'],
        ['L', '💡', 0, p.lantern ? 'ON' : 'OFF'],
        ['⇧', '🌀', 0, this.boosting ? '!' : ''],
      ];
      items.forEach((it, i) => {
        const x = 12 + i * 52, y = H - 58;
        c.fillStyle = 'rgba(4,14,24,0.7)'; c.fillRect(x, y, 46, 46);
        c.strokeStyle = 'rgba(255,255,255,0.3)'; c.strokeRect(x + 0.5, y + 0.5, 46, 46);
        c.font = '20px system-ui'; c.textAlign = 'center'; c.fillStyle = '#fff'; c.fillText(it[1], x + 23, y + 28);
        if (it[2] > 0) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x, y + 46 * (1 - clamp(it[2], 0, 1)), 46, 46 * clamp(it[2], 0, 1)); }
        c.font = '700 10px system-ui'; c.fillStyle = '#ffe9a8'; c.fillText(it[0], x + 14, y + 10);
        if (it[3]) { c.fillStyle = '#fff'; c.textAlign = 'right'; c.fillText(it[3], x + 42, y + 42); }
      });
    }
    // minimap
    const ms = 150, mx = W - ms - 12, my = 12;
    c.fillStyle = 'rgba(4,14,24,0.75)'; c.fillRect(mx, my, ms, ms);
    c.save(); c.beginPath(); c.rect(mx, my, ms, ms); c.clip();
    const cellPx = 2, span = ms / cellPx;
    const pc = p.x / TILE, pr = p.y / TILE;
    c.imageSmoothingEnabled = false;
    c.drawImage(this.mini, pc - span / 2, pr - span / 2, span, span, mx, my, ms, ms);
    const toM = (x: number, y: number) => ({ x: mx + ms / 2 + (x / TILE - pc) * cellPx, y: my + ms / 2 + (y / TILE - pr) * cellPx });
    for (const n of this.nodes) { if (!n.seen) continue; const m = toM(n.x, n.y); c.fillStyle = n.done ? '#6dffb0' : '#6adfff'; c.fillRect(m.x - 3, m.y - 3, 6, 6); }
    for (const e of this.ents) { if (e.dead || e.rev <= 0 || e.k === 'fish') continue; const m = toM(e.x, e.y); c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(m.x, m.y, 2.5, 0, TAU); c.fill(); }
    for (const it of this.items) { if (it.taken || it.rev <= 0 || it.k === 'vent' || it.k === 'crate') continue; const m = toM(it.x, it.y); c.fillStyle = '#ffd27a'; c.fillRect(m.x - 1.5, m.y - 1.5, 3, 3); }
    const dm = toM(this.W2 / 2, WATER); c.fillStyle = '#ff9f6b'; c.fillRect(dm.x - 4, dm.y - 2, 8, 3);
    const pm = toM(p.x, p.y); c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(pm.x, pm.y, 3, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(160,220,255,0.5)'; c.strokeRect(mx + 0.5, my + 0.5, ms, ms);
    // cargo value + compass
    c.font = '700 12px system-ui'; c.textAlign = 'right'; c.fillStyle = '#ffe9a8';
    c.fillText(`Haul ${Math.round(p.cargoV)}◈   Threat ${this.o.tutorial ? '—' : this.threatLevel()}`, W - 14, my + ms + 18);
    const tgt = this.objTarget();
    if (tgt) {
      const a = Math.atan2(tgt.y - p.y, tgt.x - p.x), dd = dist(tgt.x, tgt.y, p.x, p.y);
      if (dd > 130) {
        const sx = (p.x - this.cam.x) * this.zoom / hs, sy = (p.y - this.cam.y) * this.zoom / hs;
        c.save(); c.translate(sx + Math.cos(a) * 52, sy + Math.sin(a) * 52); c.rotate(a);
        c.fillStyle = 'rgba(255,233,168,0.9)'; c.beginPath(); c.moveTo(9, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.fill();
        c.restore();
        c.font = '600 10px system-ui'; c.textAlign = 'center'; c.fillStyle = '#ffe9a8';
        c.fillText(`${Math.round(dd / 10)} m`, sx + Math.cos(a) * 72, sy + Math.sin(a) * 72 + 3);
      }
    }
    // banner
    if (this.banner) {
      const b = this.banner, a = clamp(Math.min(b.t, 3.2 - b.t) * 3, 0, 1);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.font = '800 30px Georgia, serif'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,0.75)';
      c.strokeText(b.text, cx, H * 0.28); c.fillStyle = '#ffe9a8'; c.fillText(b.text, cx, H * 0.28);
      c.font = '600 14px system-ui'; c.fillStyle = '#d6ecff'; c.strokeText(b.sub, cx, H * 0.28 + 24); c.fillText(b.sub, cx, H * 0.28 + 24);
      c.globalAlpha = 1;
    }
    // toasts
    c.textAlign = 'center'; c.font = '600 13px system-ui';
    this.toasts.forEach((t, i) => {
      const y = H - (touch ? 190 : 80) - (this.toasts.length - 1 - i) * 24;
      c.globalAlpha = clamp(t.t * 2, 0, 1);
      const w = c.measureText(t.text).width + 24;
      c.fillStyle = 'rgba(4,14,24,0.75)'; c.fillRect(cx - w / 2, y - 16, w, 22);
      c.fillStyle = t.col; c.fillText(t.text, cx, y);
    });
    c.globalAlpha = 1;
    if (this.paused) { c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, W, H); }
    c.restore();
  }
}
