import { CARGO, SECTORS, derive, newStats, type SectorDef, type Stats, type Upgrades } from './data';
import { sfx } from './audio';

const SUN_GM = 1.8e6;
const SUN_R = 48;
const SHIP_R = 7;
const DT = 1 / 120;
const CATAPULT = 130;
const TURN = 3.4;
const TAU = Math.PI * 2;
const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

type Kind = 'rock' | 'ocean' | 'ice' | 'gas' | 'lava';

interface Planet {
  name: string;
  orbitR: number;
  phase: number;
  omega: number;
  r: number;
  gm: number;
  c1: string;
  c2: string;
  kind: Kind;
  ring: boolean;
  tilt: number;
  feat: { a: number; d: number; s: number }[];
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  rot: number;
  vr: number;
  shape: number[];
  kind: number;
  warn: boolean;
}

interface Flare {
  angle: number;
  half: number;
  warn: number;
  warnTotal: number;
  act: number;
  hit: boolean;
  pushed: boolean;
  beep: number;
  atDock: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
}

interface Popup { x: number; y: number; text: string; color: string; life: number }
interface Toast { text: string; color: string; life: number }
interface Offer { dest: number; cargoIdx: number; pay: number; limit: number; dist: number }
interface Contract extends Offer { timeLeft: number; integrity: number }
interface HitRegion { x: number; y: number; w: number; h: number; action: () => void }
interface Impact { kind: 'sun' | 'planet'; j: number; x: number; y: number; speed: number }
interface Closest { px: number; py: number; sx: number; sy: number; d: number }
interface Prediction { pts: number[]; ticks: number[]; impact: Impact | null; ca: Closest | null }

export interface GameConfig {
  sector: number;
  credits: number;
  upgrades: Upgrades;
}

export interface GameCallbacks {
  onClear: (r: { credits: number; stats: Stats }) => void;
  onOver: (r: { cause: string; stats: Stats }) => void;
  onPause: (p: boolean) => void;
}

const NAMES = ['Aurelia', 'Brackish', 'Cinder', 'Dorne', 'Elowen', 'Fennick', 'Gallow', 'Halcyon', 'Ione', 'Jarrah', 'Kestrel', 'Lumen'];
const PALETTE: { kind: Kind; c1: string; c2: string }[] = [
  { kind: 'rock', c1: '#e0a97a', c2: '#6b3f2a' },
  { kind: 'ocean', c1: '#6fc3ff', c2: '#134a8a' },
  { kind: 'ice', c1: '#e5f6ff', c2: '#5f88b0' },
  { kind: 'gas', c1: '#f3cf8f', c2: '#9b5a2e' },
  { kind: 'lava', c1: '#ff9a55', c2: '#5a1408' },
  { kind: 'gas', c1: '#b9a5ff', c2: '#3d2f8a' },
  { kind: 'rock', c1: '#9fe0a0', c2: '#24542f' },
];

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(a: T[], r: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const norm = (a: number) => {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const fmtTime = (t: number) => {
  const s = Math.abs(Math.ceil(t));
  return `${t < 0 ? '-' : ''}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cfg: GameConfig;
  cb: GameCallbacks;
  sec: SectorDef;
  d: ReturnType<typeof derive>;
  rng: () => number;
  w = 0;
  h = 0;
  dpr = 1;
  time = 0;
  raf = 0;
  last = 0;
  acc = 0;
  warp = 1;
  paused = false;
  destroyed = false;
  state: 'play' | 'clear' | 'dead' = 'play';
  stateT = 0;
  reported = false;
  keys: Record<string, boolean> = {};
  mouse = { x: -100, y: -100 };
  planets: Planet[] = [];
  debris: Debris[] = [];
  flares: Flare[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  toasts: Toast[] = [];
  hits: HitRegion[] = [];
  stars: { x: number; y: number; z: number; s: number; tw: number }[] = [];
  maxR = 800;
  credits: number;
  stats: Stats = newStats();
  delivered = 0;
  contract: Contract | null = null;
  offers: Offer[] = [];
  banner: { lines: string[]; life: number } | null = null;
  flareTimer = 12;
  shake = 0;
  dockCd = 0;
  dockCdPlanet = -1;
  needRelease = false;
  strandT = 30;
  lastHit = 'debris';
  hinted: Record<string, boolean> = {};
  overview = false;
  zoomSet = 0.85;
  cam = { x: 0, y: 0, zoom: 0.85 };
  pred: Prediction = { pts: [], ticks: [], impact: null, ca: null };
  trail: number[] = [];
  thrusting = false;
  accOut = { x: 0, y: 0 };
  ship = {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    hull: 100, fuel: 100, energy: 100, heat: 0,
    docked: -1, dox: 0, doy: 0, iframes: 0, overload: false, shield: false,
  };

  constructor(canvas: HTMLCanvasElement, cfg: GameConfig, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.cfg = cfg;
    this.cb = cb;
    this.sec = SECTORS[cfg.sector - 1];
    this.d = derive(cfg.upgrades);
    this.credits = cfg.credits;
    this.rng = mulberry32(cfg.sector * 7919 + 13);
    this.ship.hull = this.d.maxHull;
    this.ship.fuel = this.d.maxFuel;
    this.ship.energy = this.d.maxEnergy;
    this.buildSystem();
    for (let i = 0; i < 260; i++) {
      this.stars.push({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8, s: Math.random() * 1.4 + 0.3, tw: Math.random() * TAU });
    }
    this.flareTimer = 14 + Math.random() * 6;
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('wheel', this.onWheel, { passive: true });
    this.cam.x = this.ship.x;
    this.cam.y = this.ship.y;
    this.toast(`Sector ${cfg.sector}: ${this.sec.name} — deliver ${this.sec.quota} contracts.`, '#8fd8ff');
    this.toast('Pick a contract: press 1, 2 or 3 (or click a card).', '#ffd98a');
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('wheel', this.onWheel);
    sfx.setThrust(0);
  }

  setPaused(p: boolean, notify = false) {
    this.paused = p;
    this.keys = {};
    if (p) sfx.setThrust(0);
    if (notify) this.cb.onPause(p);
  }

  // ---------------------------------------------------------------- input
  resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth || window.innerWidth;
    this.h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  };

  onBlur = () => {
    if (!this.paused && this.state === 'play') this.setPaused(true, true);
    this.keys = {};
  };

  onKeyDown = (e: KeyboardEvent) => {
    const c = e.code;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(c)) e.preventDefault();
    if (c === 'Escape' || c === 'KeyP') {
      if (!e.repeat && this.state === 'play') this.setPaused(!this.paused, true);
      return;
    }
    if (this.paused) return;
    this.keys[c] = true;
    if (e.repeat) return;
    sfx.init();
    switch (c) {
      case 'Tab': this.overview = !this.overview; sfx.click(); break;
      case 'KeyM': sfx.toggleMute(); break;
      case 'KeyF': this.refuel(); break;
      case 'KeyR': this.repair(); break;
      case 'KeyX': this.abandon(); break;
      case 'Digit1': this.accept(0); break;
      case 'Digit2': this.accept(1); break;
      case 'Digit3': this.accept(2); break;
      case 'Equal': case 'NumpadAdd': this.zoomSet = clamp(this.zoomSet * 1.2, 0.3, 2.2); break;
      case 'Minus': case 'NumpadSubtract': this.zoomSet = clamp(this.zoomSet / 1.2, 0.3, 2.2); break;
      default: break;
    }
  };

  onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };

  onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
  };

  onMouseDown = (e: MouseEvent) => {
    sfx.init();
    if (this.paused) return;
    const r = this.canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    for (const h of this.hits) {
      if (mx >= h.x && mx <= h.x + h.w && my >= h.y && my <= h.y + h.h) {
        h.action();
        return;
      }
    }
  };

  onWheel = (e: WheelEvent) => {
    this.zoomSet = clamp(this.zoomSet * Math.exp(-e.deltaY * 0.001), 0.3, 2.2);
  };

  // ---------------------------------------------------------------- setup
  buildSystem() {
    const rng = this.rng;
    const n = this.sec.planets;
    const minR = 250;
    const maxPR = 720 + this.cfg.sector * 65;
    this.maxR = maxPR;
    const names = shuffle([...NAMES], rng);
    const pal = shuffle([...PALETTE], rng);
    for (let i = 0; i < n; i++) {
      const base = minR + ((maxPR - minR) * i) / Math.max(1, n - 1);
      const orbitR = base + (i > 0 && i < n - 1 ? (rng() - 0.5) * 30 : 0);
      const pa = pal[i % pal.length];
      const r = pa.kind === 'gas' ? 36 + rng() * 10 : 20 + rng() * 14;
      const g = 55 + rng() * 35;
      const feat = [];
      for (let k = 0; k < 8; k++) feat.push({ a: rng() * TAU, d: 0.15 + rng() * 0.65, s: 0.06 + rng() * 0.16 });
      this.planets.push({
        name: names[i % names.length],
        orbitR,
        phase: rng() * TAU,
        omega: Math.sqrt(SUN_GM / Math.pow(orbitR, 3)),
        r,
        gm: g * r * r,
        c1: pa.c1,
        c2: pa.c2,
        kind: pa.kind,
        ring: pa.kind === 'gas' && rng() < 0.6,
        tilt: (rng() - 0.5) * 0.8,
        feat,
        x: 0, y: 0, vx: 0, vy: 0,
      });
    }
    this.updatePlanets();
    const home = Math.min(1, n - 1);
    const p = this.planets[home];
    const a = Math.atan2(p.y, p.x);
    const dd = p.r + SHIP_R - 2;
    const s = this.ship;
    s.docked = home;
    s.dox = Math.cos(a) * dd;
    s.doy = Math.sin(a) * dd;
    s.x = p.x + s.dox;
    s.y = p.y + s.doy;
    s.vx = p.vx;
    s.vy = p.vy;
    s.angle = a;
    this.needRelease = true;
    this.makeOffers(home);
    for (let i = 0; i < this.sec.debris; i++) {
      const d = this.newDebris(true);
      this.debris.push(d);
    }
  }

  updatePlanets() {
    for (const p of this.planets) {
      const a = p.phase + p.omega * this.time;
      p.x = Math.cos(a) * p.orbitR;
      p.y = Math.sin(a) * p.orbitR;
      p.vx = -Math.sin(a) * p.orbitR * p.omega;
      p.vy = Math.cos(a) * p.orbitR * p.omega;
    }
  }

  newDebris(initial: boolean): Debris {
    const n = 6 + Math.floor(Math.random() * 4);
    const shape: number[] = [];
    for (let i = 0; i < n; i++) shape.push(0.65 + Math.random() * 0.5);
    const d: Debris = { x: 0, y: 0, vx: 0, vy: 0, r: 3 + Math.random() * 6, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 3, shape, kind: Math.floor(Math.random() * 3), warn: false };
    this.placeDebris(d, initial);
    return d;
  }

  placeDebris(d: Debris, initial: boolean) {
    const dir = Math.random() < 0.25 ? -1 : 1;
    for (let tries = 0; tries < 20; tries++) {
      const R = initial ? 260 + Math.random() * (this.maxR * 0.95) : this.maxR * 1.25 + Math.random() * 200;
      const a = Math.random() * TAU;
      d.x = Math.cos(a) * R;
      d.y = Math.sin(a) * R;
      const vc = Math.sqrt(SUN_GM / R);
      const f = initial ? 0.6 + Math.random() * 0.45 : 0.35 + Math.random() * 0.5;
      const tx = -Math.sin(a) * dir;
      const ty = Math.cos(a) * dir;
      d.vx = tx * vc * f;
      d.vy = ty * vc * f;
      if (!initial || Math.hypot(d.x - this.ship.x, d.y - this.ship.y) > 160) break;
    }
  }

  makeOffers(from: number) {
    const others = shuffle(this.planets.map((_, i) => i).filter((i) => i !== from), Math.random);
    const pool = shuffle(CARGO.map((_, i) => i), Math.random);
    this.offers = [];
    for (let k = 0; k < 3; k++) {
      const dest = others[k % others.length];
      const cargoIdx = pool[k];
      const a = this.planets[from];
      const b = this.planets[dest];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cg = CARGO[cargoIdx];
      const pay = Math.round(((60 + dist * 0.32) * cg.pay * (1 + 0.12 * (this.cfg.sector - 1))) / 5) * 5;
      const limit = Math.round((dist / 48 + 24) * cg.time);
      this.offers.push({ dest, cargoIdx, pay, limit, dist });
    }
  }

  // ---------------------------------------------------------------- helpers
  toast(text: string, color = '#bfe9ff') {
    if (this.toasts.some((t) => t.text === text)) return;
    this.toasts.push({ text, color, life: 5 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  hint(key: string, text: string) {
    if (this.cfg.sector !== 1 || this.hinted[key]) return;
    this.hinted[key] = true;
    this.toast(text, '#ffd98a');
  }

  popup(x: number, y: number, text: string, color: string) {
    this.popups.push({ x, y, text, color, life: 1.4 });
  }

  emit(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, drag = 0.5) {
    if (this.particles.length > 900) return;
    this.particles.push({ x, y, vx, vy, life, max: life, size, color, drag });
  }

  burst(x: number, y: number, n: number, speed: number, colors: string[], life = 0.8, size = 2.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.2 + Math.random() * 0.8);
      this.emit(x, y, Math.cos(a) * sp, Math.sin(a) * sp, life * (0.5 + Math.random() * 0.7), size * (0.5 + Math.random()), colors[Math.floor(Math.random() * colors.length)], 1.2);
    }
  }

  damage(amount: number, frag: number, source: string) {
    const s = this.ship;
    if (this.state !== 'play') return;
    s.hull -= amount;
    this.lastHit = source;
    const c = this.contract;
    if (c) {
      c.integrity -= amount * CARGO[c.cargoIdx].fragile * 0.55 * frag * this.d.cargoMul;
      if (c.integrity <= 0) {
        this.contract = null;
        this.toast('CARGO DESTROYED — contract void. Dock to take a new one.', '#ff7a7a');
        sfx.fail();
        if (s.docked >= 0 && this.delivered < this.sec.quota) this.makeOffers(s.docked);
      }
    }
    if (s.hull <= 0) this.explode();
  }

  explode() {
    const s = this.ship;
    s.hull = 0;
    this.state = 'dead';
    this.stateT = 2.4;
    this.shake = 28;
    sfx.explode();
    sfx.setThrust(0);
    this.burst(s.x, s.y, 140, 340, ['#fff2c0', '#ffb347', '#ff6a3a', '#ff3b2a', '#c9d3e6'], 1.6, 4);
  }

  causeText() {
    switch (this.lastHit) {
      case 'flare': return 'Fried by a solar flare.';
      case 'crash': return 'Smashed into a planet at lethal speed.';
      case 'heat': return 'Cooked by stellar radiation.';
      case 'sun': return 'Incinerated in the stellar corona.';
      case 'strand': return 'Life support failed — you drifted out of fuel.';
      default: return 'Shredded by orbital debris.';
    }
  }

  accept(k: number) {
    const s = this.ship;
    if (!(this.state === 'play' && s.docked >= 0 && !this.contract)) return;
    const o = this.offers[k];
    if (!o) return;
    this.contract = { ...o, timeLeft: o.limit, integrity: 100 };
    this.offers = [];
    sfx.accept();
    this.toast(`Cargo loaded: ${CARGO[o.cargoIdx].name} → ${this.planets[o.dest].name}.`, '#9dffc6');
    this.hint('launch', 'Aim with A/D, then tap W to catapult off. The dotted line predicts your orbit.');
  }

  abandon() {
    if (this.state === 'play' && this.contract && this.ship.docked >= 0) {
      this.contract = null;
      this.toast('Contract abandoned.', '#ffb08a');
      sfx.deny();
      this.makeOffers(this.ship.docked);
    }
  }

  refuel() {
    const s = this.ship;
    if (s.docked < 0 || this.state !== 'play') return;
    const need = Math.ceil(this.d.maxFuel - s.fuel);
    if (need <= 0) { this.toast('Tanks are already full.'); return; }
    const aff = Math.min(need, Math.floor(this.credits));
    if (aff <= 0) {
      if (s.fuel < 25) {
        s.fuel = 25;
        sfx.refuel();
        this.toast('Port charity: emergency fuel ration loaded.', '#9dffc6');
      } else {
        sfx.deny();
        this.toast('Not enough credits.', '#ff9a9a');
      }
      return;
    }
    this.credits -= aff;
    s.fuel = Math.min(this.d.maxFuel, s.fuel + aff);
    sfx.refuel();
    this.toast(`Refueled +${aff} for ₡${aff}.`, '#9dffc6');
  }

  repair() {
    const s = this.ship;
    if (s.docked < 0 || this.state !== 'play') return;
    const need = Math.ceil(this.d.maxHull - s.hull);
    if (need <= 0) { this.toast('Hull is already pristine.'); return; }
    const aff = Math.min(need, Math.floor(this.credits / 1.5));
    if (aff <= 0) { sfx.deny(); this.toast('Not enough credits.', '#ff9a9a'); return; }
    this.credits -= Math.ceil(aff * 1.5);
    s.hull = Math.min(this.d.maxHull, s.hull + aff);
    sfx.refuel();
    this.toast(`Hull repaired +${aff} for ₡${Math.ceil(aff * 1.5)}.`, '#9dffc6');
  }

  dockAt(pi: number, dmg: number) {
    const s = this.ship;
    const p = this.planets[pi];
    const a = Math.atan2(s.y - p.y, s.x - p.x);
    const dd = p.r + SHIP_R - 2;
    s.dox = Math.cos(a) * dd;
    s.doy = Math.sin(a) * dd;
    s.x = p.x + s.dox;
    s.y = p.y + s.doy;
    s.vx = p.vx;
    s.vy = p.vy;
    s.angle = a;
    s.docked = pi;
    this.needRelease = true;
    this.strandT = 30;
    sfx.dock();
    this.burst(s.x, s.y, 18, 60, ['#ffffff', '#9fe6ff'], 0.7, 2);
    if (dmg > 0) {
      this.stats.crashes++;
      this.damage(dmg, 0.6, 'crash');
      this.popup(s.x, s.y, `Hard landing -${Math.round(dmg)}`, '#ffb347');
      this.shake += 6;
      sfx.crash();
      if (this.state !== 'play') return;
    }
    if (this.contract) {
      if (this.contract.dest === pi) this.deliver(pi);
      else this.toast(`Docked at ${p.name}. Your cargo is bound for ${this.planets[this.contract.dest].name}.`);
    } else if (this.delivered < this.sec.quota) {
      this.makeOffers(pi);
      this.hint('board', 'Choose a new contract — 1, 2 or 3.');
    }
    if (s.fuel < this.d.maxFuel * 0.4 && this.credits > 0) this.hint('refuel', 'Low on fuel? Press F to refuel at any port.');
  }

  deliver(pi: number) {
    const c = this.contract;
    if (!c) return;
    const cg = CARGO[c.cargoIdx];
    const tm = c.timeLeft > 0 ? 1 + (0.5 * c.timeLeft) / c.limit : 0.6;
    const total = Math.round(c.pay * (c.integrity / 100) * tm);
    this.credits += total;
    this.stats.earned += total;
    this.stats.delivered++;
    this.delivered++;
    this.banner = {
      life: 5,
      lines: [
        `DELIVERED: ${cg.name}`,
        `Base ₡${c.pay}  ·  Integrity ${Math.round(c.integrity)}%  ·  ${tm > 1 ? `Speed bonus +${Math.round((tm - 1) * 100)}%` : 'Late −40%'}`,
        `+₡${total}`,
      ],
    };
    this.contract = null;
    sfx.cash();
    const s = this.ship;
    this.burst(s.x, s.y, 40, 140, ['#ffd24a', '#fff2a8', '#6dffb0'], 1.1, 3);
    if (this.delivered >= this.sec.quota) {
      this.state = 'clear';
      this.stateT = 3.4;
      sfx.clear();
    } else {
      this.makeOffers(pi);
    }
  }

  launch() {
    const s = this.ship;
    const pi = s.docked;
    const p = this.planets[pi];
    const nx = Math.cos(s.angle);
    const ny = Math.sin(s.angle);
    s.vx = p.vx + nx * CATAPULT;
    s.vy = p.vy + ny * CATAPULT;
    s.x += nx * 3;
    s.y += ny * 3;
    s.fuel = Math.max(0, s.fuel - 2);
    this.dockCd = 0.9;
    this.dockCdPlanet = pi;
    s.docked = -1;
    this.stats.fuelUsed += 2;
    sfx.launch();
    this.shake += 4;
    for (let i = 0; i < 26; i++) {
      const sp = 60 + Math.random() * 160;
      const a = s.angle + Math.PI + (Math.random() - 0.5) * 0.7;
      this.emit(s.x, s.y, p.vx + Math.cos(a) * sp, p.vy + Math.sin(a) * sp, 0.6, 3, '#ffb347', 1);
    }
  }

  // ---------------------------------------------------------------- simulation
  frame = (ts: number) => {
    if (this.destroyed) return;
    const rdt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000) || 0);
    this.last = ts;
    if (!this.paused) {
      this.warp = this.canWarp() ? 3 : 1;
      this.acc += rdt * this.warp;
      let n = 0;
      while (this.acc >= DT && n < 40) {
        this.step(DT);
        this.acc -= DT;
        n++;
      }
      if (n >= 40) this.acc = 0;
      if (this.state === 'play') this.predict();
      sfx.setThrust(this.thrusting && this.state === 'play' ? 1 : 0);
      if (this.state !== 'play') this.thrusting = false;
      const tt = Math.min(rdt, 0.05);
      for (const t of this.toasts) t.life -= tt;
      this.toasts = this.toasts.filter((t) => t.life > 0);
      if (this.banner) {
        this.banner.life -= tt;
        if (this.banner.life <= 0) this.banner = null;
      }
    }
    this.updateCamera(rdt);
    this.render(rdt);
    this.raf = requestAnimationFrame(this.frame);
  };

  canWarp() {
    if (this.state !== 'play') return false;
    if (!(this.keys.ShiftLeft || this.keys.ShiftRight)) return false;
    if (this.keys.KeyW || this.keys.ArrowUp || this.keys.Space) return false;
    if (this.flares.length > 0) return false;
    if (this.ship.heat > 80) return false;
    if (this.debris.some((d) => d.warn)) return false;
    return true;
  }

  step(dt: number) {
    this.time += dt;
    this.updatePlanets();
    const s = this.ship;
    if (this.state === 'play') {
      this.stats.time += dt;
      this.updateShip(dt);
    } else {
      this.thrusting = false;
      if (s.docked >= 0 && this.state === 'clear') {
        const p = this.planets[s.docked];
        s.x = p.x + s.dox;
        s.y = p.y + s.doy;
        if (Math.random() < 0.08) {
          this.burst(s.x + (Math.random() - 0.5) * 160, s.y + (Math.random() - 0.5) * 160, 26, 160, ['#ffd24a', '#6dffb0', '#7fd4ff', '#ff8ad8'], 1.2, 3);
        }
      }
    }
    this.updateFlares(dt);
    this.updateDebris(dt);
    if (this.dockCd > 0) this.dockCd -= dt;
    if (this.state === 'play' && this.contract) this.contract.timeLeft -= dt;
    // particles, popups
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy *= dr;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.life -= dt;
      p.y -= 18 * dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    if (s.iframes > 0) s.iframes -= dt;
    // state transitions
    if (this.state !== 'play') {
      this.stateT -= dt;
      if (this.stateT <= 0 && !this.reported) {
        this.reported = true;
        if (this.state === 'clear') this.cb.onClear({ credits: this.credits, stats: this.stats });
        else {
          sfx.fail();
          this.cb.onOver({ cause: this.causeText(), stats: this.stats });
        }
      }
    }
  }

  accel(x: number, y: number) {
    let r2 = x * x + y * y + 25;
    let inv = SUN_GM / (r2 * Math.sqrt(r2));
    let ax = -x * inv;
    let ay = -y * inv;
    for (const p of this.planets) {
      const dx = p.x - x;
      const dy = p.y - y;
      r2 = dx * dx + dy * dy + 16;
      inv = p.gm / (r2 * Math.sqrt(r2));
      ax += dx * inv;
      ay += dy * inv;
    }
    this.accOut.x = ax;
    this.accOut.y = ay;
  }

  updateShip(dt: number) {
    const k = this.keys;
    const s = this.ship;
    const left = k.KeyA || k.ArrowLeft;
    const right = k.KeyD || k.ArrowRight;
    const thrustKey = k.KeyW || k.ArrowUp;
    const retro = k.KeyS || k.ArrowDown;
    let rot = 0;
    if (left) rot -= 1;
    if (right) rot += 1;
    if (rot !== 0) s.angle += rot * TURN * dt;
    else if ((retro || k.KeyE) && s.docked < 0) {
      let ref = { vx: 0, vy: 0 };
      let bestD = 1e9;
      for (const p of this.planets) {
        const d = Math.hypot(s.x - p.x, s.y - p.y) - p.r;
        if (d < 300 && d < bestD) { bestD = d; ref = p; }
      }
      const rvx = s.vx - ref.vx;
      const rvy = s.vy - ref.vy;
      if (Math.hypot(rvx, rvy) > 2) {
        const target = Math.atan2(rvy, rvx) + (retro ? Math.PI : 0);
        const diff = norm(target - s.angle);
        s.angle += clamp(diff, -TURN * dt, TURN * dt);
      }
    }
    s.angle = norm(s.angle);

    // recharge/cool defaults
    let shield = false;
    if (s.overload && s.energy > 25) s.overload = false;
    if (k.Space && !s.overload && s.energy > 0 && s.docked < 0) shield = true;
    if (shield && !s.shield) sfx.shieldOn();
    s.shield = shield;
    if (shield) {
      s.energy -= 6 * dt;
      if (s.energy <= 0) { s.energy = 0; s.overload = true; this.toast('Deflector overloaded!', '#ff9a9a'); }
    } else {
      s.energy = Math.min(this.d.maxEnergy, s.energy + (s.docked >= 0 ? this.d.regen * 3 : this.d.regen) * dt);
    }

    if (s.docked >= 0) {
      const p = this.planets[s.docked];
      s.x = p.x + s.dox;
      s.y = p.y + s.doy;
      s.vx = p.vx;
      s.vy = p.vy;
      const n = Math.atan2(s.doy, s.dox);
      s.angle = n + clamp(norm(s.angle - n), -1.45, 1.45);
      this.thrusting = false;
      if (!thrustKey) this.needRelease = false;
      if (thrustKey && !this.needRelease) {
        if (s.fuel >= 2) this.launch();
        else {
          this.toast('Not enough fuel to launch — press F to refuel.', '#ff9a9a');
          this.needRelease = true;
        }
      }
      // heat dissipates while docked
      const rs = Math.hypot(s.x, s.y);
      const gain = 14 * Math.pow(250 / rs, 2) * this.d.heatMul;
      s.heat = clamp(s.heat + (gain - 25) * dt, 0, 100);
      return;
    }

    // thrust
    this.thrusting = false;
    if (thrustKey && s.fuel > 0) {
      this.thrusting = true;
      s.fuel = Math.max(0, s.fuel - 12 * dt);
      this.stats.fuelUsed += 12 * dt;
      const c = Math.cos(s.angle);
      const sn = Math.sin(s.angle);
      s.vx += c * this.d.thrust * dt;
      s.vy += sn * this.d.thrust * dt;
      if (Math.random() < 0.6) {
        const sp = 140 + Math.random() * 90;
        const a = s.angle + Math.PI + (Math.random() - 0.5) * 0.35;
        this.emit(s.x - c * 10, s.y - sn * 10, s.vx + Math.cos(a) * sp, s.vy + Math.sin(a) * sp, 0.3 + Math.random() * 0.3, 2 + Math.random() * 2.5, Math.random() < 0.5 ? '#ffb347' : '#ffe08a', 1.5);
      }
    }
    // gravity
    this.accel(s.x, s.y);
    s.vx += this.accOut.x * dt;
    s.vy += this.accOut.y * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (this.time % 0.05 < dt) {
      this.trail.push(s.x, s.y);
      if (this.trail.length > 240) this.trail.splice(0, 2);
    }

    // stranded
    if (s.fuel <= 0.01) {
      this.strandT -= dt;
      this.hint('strand', 'Out of fuel! Coast onto a planet to dock — you only have 30s of life support.');
      if (this.strandT <= 0) {
        this.lastHit = 'strand';
        this.explode();
        return;
      }
    } else this.strandT = Math.min(30, this.strandT + dt * 2);

    // heat
    const rs = Math.hypot(s.x, s.y);
    const gain = 14 * Math.pow(250 / rs, 2) * this.d.heatMul * (s.shield ? 0.5 : 1);
    s.heat = clamp(s.heat + (gain - 6) * dt, 0, 100);
    if (s.heat >= 100) {
      this.damage(7 * dt, 0.3, 'heat');
      sfx.alarm();
      if (this.state !== 'play') return;
    } else if (s.heat > 75) sfx.alarm();
    if (s.heat > 60) this.hint('heat', 'Overheating! Fly away from the star or hold SPACE to halve heat gain.');
    if (rs < SUN_R + SHIP_R + 2) {
      this.lastHit = 'sun';
      this.explode();
      return;
    }

    // planets
    for (let i = 0; i < this.planets.length; i++) {
      const p = this.planets[i];
      if (i === this.dockCdPlanet && this.dockCd > 0) continue;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < p.r + SHIP_R - 1) {
        const sp = Math.hypot(s.vx - p.vx, s.vy - p.vy);
        if (sp <= this.d.safe) this.dockAt(i, 0);
        else if (sp <= this.d.safe * 1.5) this.dockAt(i, (sp - this.d.safe) * 0.6);
        else {
          const nx = dx / d;
          const ny = dy / d;
          const dmg = 25 + (sp - this.d.safe * 1.5) * 0.4;
          const vn = (s.vx - p.vx) * nx + (s.vy - p.vy) * ny;
          if (vn < 0) {
            s.vx -= (1 + 0.35) * vn * nx;
            s.vy -= (1 + 0.35) * vn * ny;
          }
          s.x = p.x + nx * (p.r + SHIP_R + 1);
          s.y = p.y + ny * (p.r + SHIP_R + 1);
          this.stats.crashes++;
          this.shake += 14;
          sfx.crash();
          this.burst(s.x, s.y, 30, 200, ['#ffb347', '#ffffff', '#c9d3e6'], 0.9, 3);
          this.popup(s.x, s.y, `CRASH -${Math.round(dmg)}`, '#ff7a7a');
          this.damage(dmg, 1, 'crash');
          this.hint('crash', 'Too fast! Brake with S (auto-retrograde) + W before touchdown. Keep relative speed under the limit.');
        }
        return;
      }
    }
    // tutorials
    if (this.contract) {
      const dp = this.planets[this.contract.dest];
      if (Math.hypot(s.x - dp.x, s.y - dp.y) < 420) this.hint('approach', 'Approaching! Press S to face retrograde, burn W to match planet speed, then touch down gently.');
    }
  }

  spawnFlare(aimed: boolean, base?: number) {
    const s = this.ship;
    const sc = this.cfg.sector;
    const angle = base !== undefined ? base : aimed ? Math.atan2(s.y, s.x) + (Math.random() - 0.5) * 0.3 : Math.random() * TAU;
    const warn = this.sec.flareWarn;
    this.flares.push({
      angle,
      half: 0.09 + Math.random() * 0.07 + sc * 0.012,
      warn,
      warnTotal: warn,
      act: 0.9,
      hit: false,
      pushed: false,
      beep: 0,
      atDock: s.docked >= 0,
    });
  }

  flareHits(f: Flare, x: number, y: number) {
    const ang = Math.atan2(y, x);
    if (Math.abs(norm(ang - f.angle)) > f.half) return false;
    const dist = Math.hypot(x, y);
    for (const p of this.planets) {
      const pd = Math.hypot(p.x, p.y);
      if (pd >= dist) continue;
      const ux = p.x / pd;
      const uy = p.y / pd;
      const along = x * ux + y * uy;
      const perp = Math.abs(x * uy - y * ux);
      if (along > pd && perp < p.r + 3) return false;
    }
    return true;
  }

  updateFlares(dt: number) {
    const s = this.ship;
    const playing = this.state === 'play';
    if (playing) {
      this.flareTimer -= dt;
      if (this.flareTimer <= 0) {
        const aimed = Math.random() < 0.6;
        this.spawnFlare(aimed);
        if (Math.random() < this.sec.doubleFlare) this.spawnFlare(false, this.flares[this.flares.length - 1].angle + Math.PI * (0.5 + Math.random()));
        this.flareTimer = this.sec.flareMin + Math.random() * (this.sec.flareMax - this.sec.flareMin);
        this.hint('flare', 'SOLAR FLARE! Leave the red wedge, hide in a planet\'s shadow, or hold SPACE for the deflector.');
      }
    }
    for (const f of this.flares) {
      if (f.warn > 0) {
        f.warn -= dt;
        f.beep -= dt;
        if (f.beep <= 0) { sfx.warn(); f.beep = 0.45; }
        if (f.warn <= 0) { sfx.flare(); this.shake += 7; }
      } else {
        f.act -= dt;
        if (playing && s.docked < 0 && this.flareHits(f, s.x, s.y)) {
          f.hit = true;
          if (s.shield && s.energy > 0) {
            s.energy -= 38 * dt;
            if (s.energy <= 0) { s.energy = 0; s.overload = true; }
            if (Math.random() < 0.3) this.emit(s.x, s.y, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, 0.4, 2, '#9fe6ff', 1);
          } else {
            this.damage(38 * dt, 0.5, 'flare');
            s.heat = Math.min(100, s.heat + 40 * dt);
            if (!f.pushed) {
              f.pushed = true;
              const d = Math.hypot(s.x, s.y) || 1;
              s.vx += (s.x / d) * 90;
              s.vy += (s.y / d) * 90;
              this.shake += 14;
              this.stats.hits++;
              sfx.hit(1.2);
              this.popup(s.x, s.y, 'FLARE BURN!', '#ff8a3a');
            }
            if (Math.random() < 0.6) this.emit(s.x, s.y, (Math.random() - 0.5) * 240, (Math.random() - 0.5) * 240, 0.5, 3, '#ff9a3a', 1);
          }
        }
      }
    }
    this.flares = this.flares.filter((f) => {
      const done = f.warn <= 0 && f.act <= 0;
      if (done && !f.hit && !f.atDock && playing) this.stats.flares++;
      return !done;
    });
  }

  updateDebris(dt: number) {
    const s = this.ship;
    const playing = this.state === 'play' && s.docked < 0;
    const lim = Math.pow(this.maxR * 2.1, 2);
    for (const d of this.debris) {
      const r2 = d.x * d.x + d.y * d.y;
      if (r2 < (SUN_R + 4) * (SUN_R + 4) || r2 > lim) {
        this.placeDebris(d, false);
        continue;
      }
      const inv = SUN_GM / (r2 * Math.sqrt(r2));
      d.vx -= d.x * inv * dt;
      d.vy -= d.y * inv * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
      let gone = false;
      for (const p of this.planets) {
        const dx = d.x - p.x;
        const dy = d.y - p.y;
        if (dx * dx + dy * dy < (p.r + d.r) * (p.r + d.r)) {
          this.burst(d.x, d.y, 8, 80, ['#c9d3e6', '#ffb347'], 0.6, 2);
          this.placeDebris(d, false);
          gone = true;
          break;
        }
      }
      if (gone) continue;
      const rx = d.x - s.x;
      const ry = d.y - s.y;
      const dist = Math.hypot(rx, ry);
      // collision forecast
      const vx = d.vx - s.vx;
      const vy = d.vy - s.vy;
      const v2 = vx * vx + vy * vy;
      let warn = false;
      if (dist < 420 && v2 > 1 && s.docked < 0) {
        const t = clamp(-(rx * vx + ry * vy) / v2, 0, 3);
        const md = Math.hypot(rx + vx * t, ry + vy * t);
        warn = md < 38 + d.r && t > 0;
      }
      d.warn = warn;
      if (playing && dist < SHIP_R + d.r * 0.85) this.hitDebris(d, Math.sqrt(v2));
    }
  }

  hitDebris(d: Debris, rel: number) {
    const s = this.ship;
    if (s.shield && s.energy > 0) {
      s.energy -= 8 + d.r * 1.5;
      if (s.energy <= 0) { s.energy = 0; s.overload = true; }
      sfx.shieldHit();
      this.burst(s.x, s.y, 12, 160, ['#9fe6ff', '#ffffff'], 0.5, 2);
      this.popup(s.x, s.y, 'DEFLECTED', '#9fe6ff');
    } else if (s.iframes <= 0) {
      const dmg = clamp(d.r * rel * 0.03, 5, 42);
      this.damage(dmg, 1, 'debris');
      s.iframes = 0.5;
      this.stats.hits++;
      sfx.hit(clamp(d.r / 6, 0.6, 1.4));
      this.popup(s.x, s.y, `-${Math.round(dmg)}`, '#ff7a7a');
      this.shake += 8;
      this.hint('debris', 'Debris hit! Red rings warn of incoming collisions. Dodge them or use the deflector (SPACE).');
    }
    s.vx += (d.vx - s.vx) * 0.08 * (d.r / 6);
    s.vy += (d.vy - s.vy) * 0.08 * (d.r / 6);
    this.burst(d.x, d.y, 10, 120, ['#c9d3e6', '#8a8f9a', '#ffb347'], 0.7, 2);
    this.placeDebris(d, false);
  }

  predict() {
    const s = this.ship;
    const pts: number[] = [];
    const ticks: number[] = [];
    let x = s.x, y = s.y, vx = s.vx, vy = s.vy;
    let ignore = -1;
    if (s.docked >= 0) {
      const p = this.planets[s.docked];
      const nx = Math.cos(s.angle);
      const ny = Math.sin(s.angle);
      x += nx * 3;
      y += ny * 3;
      vx = p.vx + nx * CATAPULT;
      vy = p.vy + ny * CATAPULT;
      ignore = s.docked;
    }
    const h = 1 / 60;
    const steps = Math.floor(this.d.predict / h);
    const dest = this.contract ? this.contract.dest : -1;
    let best = 1e9;
    let ca: Closest | null = null;
    let impact: Impact | null = null;
    const n = this.planets.length;
    const px = new Array<number>(n);
    const py = new Array<number>(n);
    pts.push(x, y);
    for (let i = 1; i <= steps; i++) {
      const t = this.time + i * h;
      let r2 = x * x + y * y + 25;
      let inv = SUN_GM / (r2 * Math.sqrt(r2));
      let ax = -x * inv;
      let ay = -y * inv;
      for (let j = 0; j < n; j++) {
        const p = this.planets[j];
        const a = p.phase + p.omega * t;
        px[j] = Math.cos(a) * p.orbitR;
        py[j] = Math.sin(a) * p.orbitR;
        const dx = px[j] - x;
        const dy = py[j] - y;
        r2 = dx * dx + dy * dy + 16;
        inv = p.gm / (r2 * Math.sqrt(r2));
        ax += dx * inv;
        ay += dy * inv;
      }
      vx += ax * h;
      vy += ay * h;
      x += vx * h;
      y += vy * h;
      if (i % 4 === 0) pts.push(x, y);
      if (i % 120 === 0) ticks.push(x, y);
      if (x * x + y * y < (SUN_R + 2) * (SUN_R + 2)) {
        impact = { kind: 'sun', j: -1, x, y, speed: Math.hypot(vx, vy) };
        break;
      }
      let stop = false;
      for (let j = 0; j < n; j++) {
        const p = this.planets[j];
        const d = Math.hypot(x - px[j], y - py[j]);
        if (j === dest && d < best) {
          best = d;
          ca = { px: px[j], py: py[j], sx: x, sy: y, d };
        }
        if (d < p.r + SHIP_R - 1 && !(j === ignore && i < 70)) {
          const a = p.phase + p.omega * t;
          const pvx = -Math.sin(a) * p.orbitR * p.omega;
          const pvy = Math.cos(a) * p.orbitR * p.omega;
          impact = { kind: 'planet', j, x, y, speed: Math.hypot(vx - pvx, vy - pvy) };
          stop = true;
          break;
        }
      }
      if (stop) break;
    }
    this.pred = { pts, ticks, impact, ca };
  }

  // ---------------------------------------------------------------- camera
  updateCamera(rdt: number) {
    const s = this.ship;
    const fit = Math.min(this.w, this.h) / (2 * this.maxR * 1.12);
    let tx: number, ty: number, tz: number;
    if (this.overview) {
      tx = 0; ty = 0; tz = fit;
    } else {
      tx = s.x + clamp(s.vx, -150, 150) * 0.35;
      ty = s.y + clamp(s.vy, -150, 150) * 0.35;
      tz = this.zoomSet;
    }
    const k = 1 - Math.exp(-rdt * 4);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    this.cam.zoom += (tz - this.cam.zoom) * k;
  }

  w2s(x: number, y: number) {
    return { x: (x - this.cam.x) * this.cam.zoom + this.w / 2, y: (y - this.cam.y) * this.cam.zoom + this.h / 2 };
  }

  // ---------------------------------------------------------------- rendering
  render(rdt: number) {
    const ctx = this.ctx;
    const { w, h } = this;
    this.hits = [];
    this.drawBackground();
    this.shake *= Math.exp(-6 * rdt);
    const sx = (Math.random() - 0.5) * this.shake;
    const sy = (Math.random() - 0.5) * this.shake;
    const z = this.cam.zoom;
    ctx.save();
    ctx.translate(w / 2 + sx, h / 2 + sy);
    ctx.scale(z, z);
    ctx.translate(-this.cam.x, -this.cam.y);

    // orbit rings
    ctx.lineWidth = 1 / z;
    for (const p of this.planets) {
      ctx.strokeStyle = 'rgba(120,160,255,0.11)';
      ctx.beginPath();
      ctx.arc(0, 0, p.orbitR, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([6 / z, 10 / z]);
    ctx.strokeStyle = 'rgba(255,120,60,0.16)';
    ctx.beginPath();
    ctx.arc(0, 0, 380, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    this.drawSun();
    this.drawFlares();
    for (const p of this.planets) this.drawPlanet(p);
    this.drawDestMarker();
    if (this.state === 'play') this.drawPrediction();
    this.drawDebris();
    this.drawTrail();
    if (this.state !== 'dead') this.drawShip();
    this.drawParticles();
    ctx.restore();

    this.drawLabels();
    this.drawPopups();
    this.drawHud();
    if (this.state === 'play') {
      this.drawBoard();
      this.drawServices();
    }
    this.drawMinimap();
    this.drawToasts();
    if (this.state === 'clear') this.drawCenterText('SECTOR CLEARED', '#6dffb0');
    if (this.state === 'dead') this.drawCenterText('SHIP LOST', '#ff6a6a');
  }

  drawBackground() {
    const ctx = this.ctx;
    const { w, h } = this;
    const g = ctx.createRadialGradient(w * 0.35, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    g.addColorStop(0, '#0f1638');
    g.addColorStop(0.6, '#070a1c');
    g.addColorStop(1, '#02030a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const t = this.time;
    const cx = this.cam.x, cy = this.cam.y;
    const blobs: [number, number, number, string][] = [
      [0.2, 0.7, 0.45, 'rgba(90,50,160,0.16)'],
      [0.8, 0.25, 0.4, 'rgba(30,110,170,0.13)'],
    ];
    for (const [bx, by, br, col] of blobs) {
      const x = ((bx * w - cx * 0.03) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
      const y = ((by * h - cy * 0.03) % (h * 1.4) + h * 1.4) % (h * 1.4) - h * 0.2;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, Math.max(w, h) * br);
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    for (const st of this.stars) {
      const x = (((st.x * w - cx * st.z * 0.12) % w) + w) % w;
      const y = (((st.y * h - cy * st.z * 0.12) % h) + h) % h;
      ctx.globalAlpha = (0.35 + 0.65 * st.z) * (0.75 + 0.25 * Math.sin(t * 2 + st.tw));
      ctx.fillStyle = '#dfe9ff';
      ctx.fillRect(x, y, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }

  drawSun() {
    const ctx = this.ctx;
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, SUN_R * 0.7, 0, 0, SUN_R * 5.5);
    glow.addColorStop(0, 'rgba(255,190,80,0.55)');
    glow.addColorStop(0.4, 'rgba(255,120,30,0.14)');
    glow.addColorStop(1, 'rgba(255,100,20,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, SUN_R * 5.5, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + t * 0.06;
      const len = SUN_R * (1.6 + 0.45 * Math.sin(t * 1.4 + i * 2.1));
      const wd = 0.11;
      ctx.fillStyle = 'rgba(255,170,60,0.2)';
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - wd) * SUN_R * 0.9, Math.sin(a - wd) * SUN_R * 0.9);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.lineTo(Math.cos(a + wd) * SUN_R * 0.9, Math.sin(a + wd) * SUN_R * 0.9);
      ctx.fill();
    }
    ctx.restore();
    const core = ctx.createRadialGradient(-10, -10, 4, 0, 0, SUN_R);
    core.addColorStop(0, '#fffbe0');
    core.addColorStop(0.45, '#ffd04a');
    core.addColorStop(1, '#ff7a1a');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, SUN_R, 0, TAU);
    ctx.fill();
  }

  drawFlares() {
    const ctx = this.ctx;
    const L = this.maxR * 2.4;
    for (const f of this.flares) {
      const warning = f.warn > 0;
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 14);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, L, f.angle - f.half, f.angle + f.half);
      ctx.closePath();
      if (warning) {
        const prog = 1 - f.warn / f.warnTotal;
        ctx.fillStyle = `rgba(255,70,40,${0.06 + 0.12 * prog * (0.6 + 0.4 * pulse)})`;
        ctx.fill();
        ctx.setLineDash([14 / this.cam.zoom, 12 / this.cam.zoom]);
        ctx.strokeStyle = `rgba(255,90,60,${0.5 + 0.4 * pulse})`;
        ctx.lineWidth = 2 / this.cam.zoom;
        ctx.stroke();
      } else {
        const g = ctx.createRadialGradient(0, 0, SUN_R, 0, 0, L);
        const a = clamp(f.act / 0.3, 0, 1);
        g.addColorStop(0, `rgba(255,250,200,${0.95 * a})`);
        g.addColorStop(0.5, `rgba(255,150,40,${0.6 * a})`);
        g.addColorStop(1, `rgba(255,80,20,${0.15 * a})`);
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.restore();
      // planet shadows
      for (const p of this.planets) {
        const pd = Math.hypot(p.x, p.y);
        if (Math.abs(norm(Math.atan2(p.y, p.x) - f.angle)) > f.half + 0.2) continue;
        const ux = p.x / pd;
        const uy = p.y / pd;
        ctx.fillStyle = warning ? 'rgba(3,5,14,0.45)' : 'rgba(3,5,14,0.88)';
        ctx.beginPath();
        ctx.moveTo(p.x - uy * p.r, p.y + ux * p.r);
        ctx.lineTo(p.x + uy * p.r, p.y - ux * p.r);
        ctx.lineTo(p.x + uy * p.r + ux * L, p.y - ux * p.r + uy * L);
        ctx.lineTo(p.x - uy * p.r + ux * L, p.y + ux * p.r + uy * L);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  drawPlanet(p: Planet) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const t = this.time;
    const gl = ctx.createRadialGradient(p.x, p.y, p.r * 0.85, p.x, p.y, p.r * 1.8);
    gl.addColorStop(0, hexA(p.c1, 0.3));
    gl.addColorStop(1, hexA(p.c1, 0));
    ctx.fillStyle = gl;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 1.8, 0, TAU);
    ctx.fill();
    if (p.ring) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      ctx.strokeStyle = 'rgba(230,205,160,0.5)';
      ctx.lineWidth = p.r * 0.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.75, p.r * 0.5, 0, Math.PI, TAU);
      ctx.stroke();
      ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.clip();
    const la = Math.atan2(-p.y, -p.x);
    const hx = p.x + Math.cos(la) * p.r * 0.5;
    const hy = p.y + Math.sin(la) * p.r * 0.5;
    const g = ctx.createRadialGradient(hx, hy, p.r * 0.1, hx, hy, p.r * 1.7);
    g.addColorStop(0, p.c1);
    g.addColorStop(0.55, p.c2);
    g.addColorStop(1, '#04050a');
    ctx.fillStyle = g;
    ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    if (p.kind === 'gas') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      for (let k = 0; k < 6; k++) {
        const off = -p.r + ((k + 0.5) * 2 * p.r) / 6;
        ctx.fillStyle = k % 2 ? 'rgba(255,255,255,0.13)' : 'rgba(0,0,0,0.15)';
        ctx.fillRect(-p.r, off - p.r * 0.1, p.r * 2, p.r * 0.2);
      }
      ctx.restore();
    } else {
      for (const f of p.feat) {
        const a = f.a + t * 0.05;
        const fx = p.x + Math.cos(a) * f.d * p.r;
        const fy = p.y + Math.sin(a) * f.d * p.r;
        ctx.fillStyle = p.kind === 'lava' ? 'rgba(255,220,120,0.45)' : p.kind === 'ocean' ? 'rgba(255,255,255,0.22)' : p.kind === 'ice' ? 'rgba(60,100,150,0.2)' : 'rgba(0,0,0,0.17)';
        ctx.beginPath();
        ctx.arc(fx, fy, f.s * p.r, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.strokeStyle = hexA(p.c1, 0.55);
    ctx.lineWidth = 1.2 / z;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.stroke();
    if (p.ring) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      ctx.strokeStyle = 'rgba(230,205,160,0.5)';
      ctx.lineWidth = p.r * 0.2;
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r * 1.75, p.r * 0.5, 0, 0, Math.PI);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDestMarker() {
    if (!this.contract) return;
    const p = this.planets[this.contract.dest];
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const pulse = Math.sin(this.time * 4);
    ctx.save();
    ctx.setLineDash([8 / z, 8 / z]);
    ctx.strokeStyle = '#6dffb0';
    ctx.lineWidth = 2 / z;
    ctx.lineDashOffset = -this.time * 20;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 16 + pulse * 3, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawPrediction() {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const pr = this.pred;
    const pts = pr.pts;
    if (pts.length < 4) return;
    const docked = this.ship.docked >= 0;
    ctx.save();
    ctx.lineWidth = 2 / z;
    ctx.setLineDash([5 / z, 7 / z]);
    const chunk = 10;
    const total = Math.ceil(pts.length / 2 / chunk);
    for (let c = 0; c < total; c++) {
      const i0 = c * chunk;
      const i1 = Math.min(pts.length / 2 - 1, i0 + chunk);
      ctx.strokeStyle = docked ? `rgba(255,217,138,${0.9 - 0.75 * (c / total)})` : `rgba(120,230,255,${0.9 - 0.75 * (c / total)})`;
      ctx.beginPath();
      ctx.moveTo(pts[i0 * 2], pts[i0 * 2 + 1]);
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(180,240,255,0.85)';
    for (let i = 0; i < pr.ticks.length; i += 2) {
      ctx.beginPath();
      ctx.arc(pr.ticks[i], pr.ticks[i + 1], 3 / z, 0, TAU);
      ctx.fill();
    }
    if (pr.ca && this.contract) {
      const ca = pr.ca;
      ctx.strokeStyle = 'rgba(109,255,176,0.7)';
      ctx.lineWidth = 1.5 / z;
      ctx.setLineDash([3 / z, 4 / z]);
      const p = this.planets[this.contract.dest];
      ctx.beginPath();
      ctx.arc(ca.px, ca.py, p.r, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ca.px, ca.py);
      ctx.lineTo(ca.sx, ca.sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (pr.impact) {
      const im = pr.impact;
      ctx.lineWidth = 2.5 / z;
      const r = 9 / z;
      if (im.kind === 'sun') ctx.strokeStyle = '#ff5a3a';
      else {
        const sp = im.speed;
        ctx.strokeStyle = sp <= this.d.safe ? '#6dffb0' : sp <= this.d.safe * 1.5 ? '#ffc04a' : '#ff5a3a';
      }
      ctx.beginPath();
      ctx.arc(im.x, im.y, r, 0, TAU);
      ctx.moveTo(im.x - r, im.y - r);
      ctx.lineTo(im.x + r, im.y + r);
      ctx.moveTo(im.x + r, im.y - r);
      ctx.lineTo(im.x - r, im.y + r);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawDebris() {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const cols = ['#8d93a0', '#b7bccb', '#8a6a52'];
    for (const d of this.debris) {
      const vis = Math.max(d.r, 2.4 / z);
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = cols[d.kind];
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1 / z;
      ctx.beginPath();
      const n = d.shape.length;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const rr = vis * d.shape[i];
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (d.kind === 1) {
        ctx.fillStyle = '#3a5a8a';
        ctx.fillRect(-vis * 1.6, -vis * 0.25, vis * 0.9, vis * 0.5);
        ctx.fillRect(vis * 0.7, -vis * 0.25, vis * 0.9, vis * 0.5);
      }
      ctx.restore();
      if (d.warn) {
        ctx.strokeStyle = `rgba(255,80,60,${0.5 + 0.4 * Math.sin(this.time * 12)})`;
        ctx.lineWidth = 2 / z;
        ctx.beginPath();
        ctx.arc(d.x, d.y, vis + 9 / z + 3, 0, TAU);
        ctx.stroke();
      }
    }
  }

  drawTrail() {
    const ctx = this.ctx;
    const t = this.trail;
    if (t.length < 4 || this.state === 'dead') return;
    ctx.save();
    ctx.lineWidth = 1.6 / this.cam.zoom;
    const n = t.length / 2;
    for (let i = 1; i < n; i += 1) {
      ctx.strokeStyle = `rgba(150,210,255,${(i / n) * 0.3})`;
      ctx.beginPath();
      ctx.moveTo(t[(i - 1) * 2], t[(i - 1) * 2 + 1]);
      ctx.lineTo(t[i * 2], t[i * 2 + 1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawShip() {
    const ctx = this.ctx;
    const s = this.ship;
    const sc = clamp(0.75 / this.cam.zoom, 1, 3);
    if (s.iframes > 0 && Math.floor(this.time * 20) % 2 === 0) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.scale(sc, sc);
    if (this.thrusting) {
      const fl = 10 + Math.random() * 8;
      const g = ctx.createLinearGradient(-10, 0, -10 - fl, 0);
      g.addColorStop(0, 'rgba(255,240,180,0.95)');
      g.addColorStop(0.5, 'rgba(255,150,40,0.7)');
      g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, -3.5);
      ctx.lineTo(-10 - fl, 0);
      ctx.lineTo(-10, 3.5);
      ctx.fill();
    }
    // cargo containers
    const cc = this.contract ? CARGO[this.contract.cargoIdx].color : '#4a5468';
    ctx.fillStyle = cc;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-9 + i * 4.2, -9.5, 3.6, 3.8);
      ctx.fillRect(-9 + i * 4.2, 5.7, 3.6, 3.8);
      ctx.strokeRect(-9 + i * 4.2, -9.5, 3.6, 3.8);
      ctx.strokeRect(-9 + i * 4.2, 5.7, 3.6, 3.8);
    }
    ctx.fillStyle = '#d3dcec';
    ctx.strokeStyle = '#2b3550';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(13, 0);
    ctx.lineTo(5, -5.5);
    ctx.lineTo(-10, -5.5);
    ctx.lineTo(-10, 5.5);
    ctx.lineTo(5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ff9a3a';
    ctx.fillRect(-11.5, -4, 2, 8);
    ctx.fillStyle = '#62d6ff';
    ctx.beginPath();
    ctx.ellipse(6, 0, 3.2, 2, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (s.shield) {
      ctx.save();
      ctx.translate(s.x, s.y);
      const r = 17 * sc;
      const g = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r);
      g.addColorStop(0, 'rgba(120,220,255,0.02)');
      g.addColorStop(1, 'rgba(120,220,255,0.35)');
      ctx.fillStyle = g;
      ctx.strokeStyle = `rgba(160,240,255,${0.6 + 0.3 * Math.sin(this.time * 18)})`;
      ctx.lineWidth = 1.5 / this.cam.zoom;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawParticles() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      const sz = Math.max(p.size, 1.2 / this.cam.zoom);
      ctx.beginPath();
      ctx.arc(p.x, p.y, sz * (0.5 + 0.5 * (p.life / p.max)), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- HUD
  txt(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', bold = false) {
    const ctx = this.ctx;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  rr(x: number, y: number, w: number, h: number, r: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  panel(x: number, y: number, w: number, h: number, border = 'rgba(120,200,255,0.3)', fill = 'rgba(6,10,24,0.72)') {
    const ctx = this.ctx;
    this.rr(x, y, w, h, 8);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  bar(x: number, y: number, w: number, label: string, val: number, max: number, color: string, text: string) {
    const ctx = this.ctx;
    this.txt(label, x, y + 5, 10, '#8fa6c8', 'left', true);
    const bx = x + 46;
    const bw = w - 46;
    this.rr(bx, y, bw, 10, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fill();
    const f = clamp(val / max, 0, 1);
    if (f > 0) {
      this.rr(bx, y, Math.max(6, bw * f), 10, 4);
      ctx.fillStyle = color;
      ctx.fill();
    }
    this.txt(text, bx + bw - 4, y + 5.5, 9, '#ffffff', 'right', true);
  }

  drawHud() {
    const ctx = this.ctx;
    const { w, h } = this;
    const s = this.ship;
    const d = this.d;
    // vitals
    this.panel(12, 12, 212, 106);
    const hullCol = s.hull > d.maxHull * 0.35 ? '#5fe08f' : '#ff5a5a';
    this.bar(22, 22, 192, 'HULL', s.hull, d.maxHull, hullCol, `${Math.ceil(s.hull)}`);
    const fuelCol = s.fuel > d.maxFuel * 0.2 ? '#ffb347' : '#ff5a5a';
    this.bar(22, 42, 192, 'FUEL', s.fuel, d.maxFuel, fuelCol, `${Math.ceil(s.fuel)}`);
    this.bar(22, 62, 192, 'SHLD', s.energy, d.maxEnergy, s.overload ? '#ff5a5a' : '#62d6ff', s.overload ? 'OVERLOAD' : `${Math.ceil(s.energy)}`);
    this.bar(22, 82, 192, 'HEAT', s.heat, 100, s.heat > 75 ? '#ff4a3a' : '#ff8a3a', `${Math.round(s.heat)}%`);
    const sp = Math.hypot(s.vx, s.vy);
    this.txt(`VEL ${Math.round(sp)}`, 22, 107, 10, '#8fa6c8', 'left', true);
    if (this.warp > 1) this.txt('▶▶▶ WARP ×3', 214, 107, 10, '#ffd98a', 'right', true);
    else this.txt(s.docked >= 0 ? 'DOCKED' : 'FLYING', 214, 107, 10, s.docked >= 0 ? '#6dffb0' : '#8fa6c8', 'right', true);

    // right info
    const rw = 200;
    this.panel(w - rw - 12, 12, rw, 62);
    this.txt(`SECTOR ${this.cfg.sector} · ${this.sec.name}`, w - rw, 27, 10, '#8fd8ff', 'left', true);
    this.txt(`Deliveries ${this.delivered}/${this.sec.quota}`, w - rw, 44, 12, '#ffffff', 'left', true);
    this.txt(`₡ ${Math.floor(this.credits)}`, w - rw, 62, 14, '#ffd24a', 'left', true);
    const mute = sfx.muted ? '🔇' : '🔊';
    this.txt(mute, w - 26, 62, 13, '#ffffff', 'center');

    // contract panel
    const cw = Math.min(440, w - rw - 260);
    if (cw > 220) {
      const cx = w / 2 - cw / 2 + 20;
      this.panel(cx, 12, cw, 62, this.contract ? 'rgba(109,255,176,0.45)' : 'rgba(255,217,138,0.35)');
      if (this.contract) {
        const c = this.contract;
        const cg = CARGO[c.cargoIdx];
        const p = this.planets[c.dest];
        this.txt(`${cg.icon} ${cg.name}`, cx + 12, 28, 12, '#ffffff', 'left', true);
        this.txt(`→ ${p.name}`, cx + cw - 12, 28, 12, '#6dffb0', 'right', true);
        const late = c.timeLeft < 0;
        this.txt(`⏱ ${fmtTime(c.timeLeft)}${late ? ' LATE' : ''}`, cx + 12, 48, 12, late ? '#ff7a7a' : c.timeLeft < 12 ? '#ffb347' : '#cfe6ff', 'left', true);
        this.txt(`Cargo ${Math.round(c.integrity)}%`, cx + cw / 2, 48, 12, c.integrity < 50 ? '#ff7a7a' : '#cfe6ff', 'center', true);
        this.txt(`₡${c.pay}`, cx + cw - 12, 48, 12, '#ffd24a', 'right', true);
        const f = clamp(c.integrity / 100, 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(cx + 12, 62, cw - 24, 3);
        ctx.fillStyle = f > 0.5 ? '#6dffb0' : '#ff7a7a';
        ctx.fillRect(cx + 12, 62, (cw - 24) * f, 3);
      } else {
        this.txt('NO ACTIVE CONTRACT', cx + cw / 2, 30, 12, '#ffd98a', 'center', true);
        this.txt(s.docked >= 0 ? 'Choose a cargo contract below' : 'Land at any planet to pick up work', cx + cw / 2, 50, 11, '#9fb4d6', 'center');
      }
    }

    // flare warning banner
    const warnF = this.flares.find((f) => f.warn > 0);
    const actF = this.flares.find((f) => f.warn <= 0);
    if ((warnF || actF) && this.state === 'play') {
      const pulse = 0.6 + 0.4 * Math.sin(this.time * 14);
      const inPath = s.docked < 0 && this.flares.some((f) => this.flareHits(f, s.x, s.y));
      ctx.globalAlpha = pulse;
      this.txt(actF ? '☀ FLARE ACTIVE' : `⚠ SOLAR FLARE  T-${(warnF as Flare).warn.toFixed(1)}s`, w / 2, 104, 18, '#ff6a4a', 'center', true);
      ctx.globalAlpha = 1;
      if (inPath) this.txt('YOU ARE IN THE PATH — MOVE, HIDE BEHIND A PLANET, OR HOLD SPACE', w / 2, 126, 11, '#ffd0a0', 'center', true);
      else if (s.docked < 0) this.txt('You are clear of the wedge', w / 2, 126, 11, '#9dffc6', 'center');
    }
    if (this.strandT < 30 && s.fuel <= 0.01 && s.docked < 0) {
      this.txt(`OUT OF FUEL — LIFE SUPPORT ${Math.ceil(this.strandT)}s`, w / 2, 150, 14, '#ff5a5a', 'center', true);
    }
    if (s.heat > 80 && this.state === 'play') this.txt('🔥 OVERHEATING', w / 2, 172, 13, '#ff8a3a', 'center', true);

    // landing readout
    if (s.docked < 0 && this.state === 'play') {
      let bp = -1, bd = 1e9;
      for (let i = 0; i < this.planets.length; i++) {
        const p = this.planets[i];
        const dd = Math.hypot(s.x - p.x, s.y - p.y) - p.r;
        if (dd < bd) { bd = dd; bp = i; }
      }
      if (bp >= 0 && bd < 260) {
        const p = this.planets[bp];
        const rv = Math.hypot(s.vx - p.vx, s.vy - p.vy);
        const col = rv <= d.safe ? '#6dffb0' : rv <= d.safe * 1.5 ? '#ffc04a' : '#ff5a5a';
        const lab = rv <= d.safe ? 'SAFE TO DOCK' : rv <= d.safe * 1.5 ? 'HARD LANDING' : 'CRASH SPEED';
        this.panel(w / 2 - 115, h - 120, 230, 46, col + '99');
        this.txt(`${p.name.toUpperCase()}  ·  alt ${Math.max(0, Math.round(bd))}`, w / 2, h - 106, 10, '#9fb4d6', 'center', true);
        this.txt(`REL ${Math.round(rv)} m/s  ${lab}`, w / 2, h - 88, 12, col, 'center', true);
      }
    }

    // delivery banner
    if (this.banner) {
      const b = this.banner;
      const a = clamp(b.life / 0.6, 0, 1);
      ctx.globalAlpha = a;
      this.panel(w / 2 - 230, h * 0.3, 460, 92, 'rgba(255,210,74,0.6)', 'rgba(10,14,30,0.85)');
      this.txt(b.lines[0], w / 2, h * 0.3 + 20, 13, '#6dffb0', 'center', true);
      this.txt(b.lines[1], w / 2, h * 0.3 + 42, 10, '#9fb4d6', 'center');
      this.txt(b.lines[2], w / 2, h * 0.3 + 68, 24, '#ffd24a', 'center', true);
      ctx.globalAlpha = 1;
    }

    // controls hint
    this.txt('A/D rotate · W thrust · S retro-burn aim · E prograde aim · SPACE deflector · SHIFT warp · TAB system map · +/- zoom · ESC pause · M mute', 14, h - 12, 10, 'rgba(160,185,220,0.5)');

    // off-screen destination arrow
    if (this.contract && !this.overview) {
      const p = this.planets[this.contract.dest];
      const sp2 = this.w2s(p.x, p.y);
      const m = 34;
      if (sp2.x < m || sp2.x > w - m || sp2.y < m + 70 || sp2.y > h - m) {
        const cx = w / 2, cy = h / 2;
        const dx = sp2.x - cx;
        const dy = sp2.y - cy;
        const ang = Math.atan2(dy, dx);
        const kx = dx !== 0 ? ((dx > 0 ? w - m : m) - cx) / dx : Infinity;
        const ky = dy !== 0 ? ((dy > 0 ? h - m : m + 70) - cy) / dy : Infinity;
        const kk = Math.min(kx, ky);
        const bx = cx + dx * kk;
        const by = cy + dy * kk;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ang);
        ctx.fillStyle = '#6dffb0';
        ctx.beginPath();
        ctx.moveTo(14, 0);
        ctx.lineTo(-8, -9);
        ctx.lineTo(-8, 9);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        const dist = Math.hypot(p.x - s.x, p.y - s.y);
        this.txt(`${p.name} ${Math.round(dist)}`, clamp(bx - Math.cos(ang) * 50, 60, w - 60), clamp(by - Math.sin(ang) * 26, 90, h - 20), 10, '#6dffb0', 'center', true);
      }
    }
  }

  drawLabels() {
    if (this.overview || this.cam.zoom > 0.25) {
      for (const p of this.planets) {
        const sp = this.w2s(p.x, p.y);
        if (sp.x < -80 || sp.x > this.w + 80 || sp.y < -80 || sp.y > this.h + 80) continue;
        const isDest = this.contract && this.planets[this.contract.dest] === p;
        this.txt(p.name, sp.x, sp.y + p.r * this.cam.zoom + 18, 11, isDest ? '#6dffb0' : '#cfe0ff', 'center', true);
        if (isDest) this.txt('▼ DELIVER HERE', sp.x, sp.y - p.r * this.cam.zoom - 26, 10, '#6dffb0', 'center', true);
      }
    }
  }

  drawPopups() {
    for (const p of this.popups) {
      const sp = this.w2s(p.x, p.y);
      this.ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
      this.txt(p.text, sp.x, sp.y - 24, 13, p.color, 'center', true);
    }
    this.ctx.globalAlpha = 1;
  }

  drawToasts() {
    const { w } = this;
    let ty = 146;
    for (const t of this.toasts) {
      this.ctx.globalAlpha = clamp(t.life / 0.6, 0, 1);
      this.ctx.font = `11px ${FONT}`;
      const mw = Math.min(w - 24, this.ctx.measureText(t.text).width + 26);
      this.panel(12, ty - 13, mw, 24, 'rgba(120,200,255,0.25)', 'rgba(6,10,24,0.78)');
      this.txt(t.text, 24, ty - 1, 11, t.color, 'left', false);
      ty += 30;
    }
    this.ctx.globalAlpha = 1;
  }

  drawCenterText(text: string, color: string) {
    const ctx = this.ctx;
    ctx.globalAlpha = clamp(1 - this.stateT / 3.4 + 0.3, 0.3, 1);
    this.txt(text, this.w / 2, this.h * 0.42, 44, color, 'center', true);
    ctx.globalAlpha = 1;
  }

  button(x: number, y: number, w: number, h: number, label: string, enabled: boolean, action: () => void, accent = '#62d6ff') {
    const ctx = this.ctx;
    const hover = this.mouse.x >= x && this.mouse.x <= x + w && this.mouse.y >= y && this.mouse.y <= y + h;
    this.rr(x, y, w, h, 7);
    ctx.fillStyle = enabled ? (hover ? 'rgba(60,110,170,0.75)' : 'rgba(20,40,80,0.75)') : 'rgba(40,40,50,0.6)';
    ctx.fill();
    ctx.strokeStyle = enabled ? accent : 'rgba(120,120,130,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    this.txt(label, x + w / 2, y + h / 2 + 1, 11, enabled ? '#ffffff' : '#7a8296', 'center', true);
    if (enabled) this.hits.push({ x, y, w, h, action });
  }

  drawServices() {
    const s = this.ship;
    if (s.docked < 0) return;
    const { w, h } = this;
    const p = this.planets[s.docked];
    const bw = 158;
    const gap = 8;
    const items: { label: string; en: boolean; act: () => void; accent?: string }[] = [];
    const needF = Math.ceil(this.d.maxFuel - s.fuel);
    const needH = Math.ceil(this.d.maxHull - s.hull);
    items.push({ label: `[F] Refuel ${needF > 0 ? `+${Math.min(needF, Math.max(Math.floor(this.credits), s.fuel < 25 ? 25 : 0))} ₡${Math.min(needF, Math.floor(this.credits))}` : '(full)'}`, en: needF > 0, act: () => this.refuel() });
    items.push({ label: `[R] Repair ${needH > 0 ? `+${Math.min(needH, Math.floor(this.credits / 1.5))} ₡${Math.ceil(Math.min(needH, Math.floor(this.credits / 1.5)) * 1.5)}` : '(full)'}`, en: needH > 0, act: () => this.repair() });
    if (this.contract) items.push({ label: '[X] Abandon cargo', en: true, act: () => this.abandon(), accent: '#ff9a7a' });
    const tw = items.length * bw + (items.length - 1) * gap;
    const x0 = w / 2 - tw / 2;
    const y0 = h - 62;
    this.txt(`DOCKED AT ${p.name.toUpperCase()} — aim with A/D, tap W to launch`, w / 2, y0 - 12, 11, '#9dffc6', 'center', true);
    items.forEach((it, i) => this.button(x0 + i * (bw + gap), y0, bw, 30, it.label, it.en, it.act, it.accent));
  }

  drawBoard() {
    const s = this.ship;
    if (s.docked < 0 || this.contract || this.offers.length === 0 || this.state !== 'play') return;
    const { w, h } = this;
    const cw = clamp((w - 60) / 3, 150, 210);
    const ch = 176;
    const gap = 12;
    const tw = cw * 3 + gap * 2;
    const x0 = w / 2 - tw / 2;
    const y0 = clamp(h * 0.5 - ch / 2 + 30, 190, Math.max(190, h - ch - 110));
    const ctx = this.ctx;
    this.txt('CONTRACT BOARD', w / 2, y0 - 20, 13, '#ffd98a', 'center', true);
    this.offers.forEach((o, i) => {
      const x = x0 + i * (cw + gap);
      const hover = this.mouse.x >= x && this.mouse.x <= x + cw && this.mouse.y >= y0 && this.mouse.y <= y0 + ch;
      const cg = CARGO[o.cargoIdx];
      const p = this.planets[o.dest];
      this.panel(x, y0, cw, ch, hover ? '#ffd98a' : 'rgba(120,200,255,0.35)', hover ? 'rgba(24,34,66,0.94)' : 'rgba(8,12,28,0.88)');
      this.txt(`[${i + 1}]`, x + 10, y0 + 14, 11, '#8fd8ff', 'left', true);
      this.txt(cg.icon, x + cw - 22, y0 + 18, 22, '#ffffff', 'center');
      this.txt(cg.name, x + 10, y0 + 38, cw < 180 ? 11 : 12, '#ffffff', 'left', true);
      ctx.fillStyle = p.c1;
      ctx.beginPath();
      ctx.arc(x + 16, y0 + 62, 6, 0, TAU);
      ctx.fill();
      this.txt(p.name, x + 28, y0 + 62, 12, '#6dffb0', 'left', true);
      this.txt(`Distance  ${Math.round(o.dist)}`, x + 10, y0 + 86, 10, '#9fb4d6');
      this.txt(`Time limit  ${fmtTime(o.limit)}`, x + 10, y0 + 102, 10, '#9fb4d6');
      const fr = Math.min(4, Math.max(1, Math.round(cg.fragile * 2.4)));
      this.txt(`Fragility  ${'●'.repeat(fr)}${'○'.repeat(4 - fr)}`, x + 10, y0 + 118, 10, '#9fb4d6');
      this.txt(`₡ ${o.pay}`, x + cw / 2, y0 + 150, 22, '#ffd24a', 'center', true);
      this.hits.push({ x, y: y0, w: cw, h: ch, action: () => this.accept(i) });
    });
  }

  drawMinimap() {
    const ctx = this.ctx;
    const { w, h } = this;
    const size = Math.min(150, Math.min(w, h) * 0.26);
    const x0 = w - size - 14;
    const y0 = h - size - 14;
    const cx = x0 + size / 2;
    const cy = y0 + size / 2;
    const sc = size / 2 / (this.maxR * 1.15);
    this.panel(x0, y0, size, size, 'rgba(120,200,255,0.3)', 'rgba(4,8,20,0.7)');
    ctx.save();
    this.rr(x0, y0, size, size, 8);
    ctx.clip();
    ctx.strokeStyle = 'rgba(120,160,255,0.18)';
    ctx.lineWidth = 1;
    for (const p of this.planets) {
      ctx.beginPath();
      ctx.arc(cx, cy, p.orbitR * sc, 0, TAU);
      ctx.stroke();
    }
    for (const f of this.flares) {
      ctx.fillStyle = f.warn > 0 ? 'rgba(255,80,50,0.25)' : 'rgba(255,200,80,0.5)';
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, size, f.angle - f.half, f.angle + f.half);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffc04a';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,210,230,0.7)';
    for (const d of this.debris) ctx.fillRect(cx + d.x * sc - 0.5, cy + d.y * sc - 0.5, 1.5, 1.5);
    for (let i = 0; i < this.planets.length; i++) {
      const p = this.planets[i];
      const isDest = this.contract && this.contract.dest === i;
      ctx.fillStyle = p.c1;
      ctx.beginPath();
      ctx.arc(cx + p.x * sc, cy + p.y * sc, 2.5 + p.r / 18, 0, TAU);
      ctx.fill();
      if (isDest) {
        ctx.strokeStyle = '#6dffb0';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + p.x * sc, cy + p.y * sc, 6 + Math.sin(this.time * 5) * 1.5, 0, TAU);
        ctx.stroke();
      }
    }
    if (this.state !== 'dead') {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx + this.ship.x * sc, cy + this.ship.y * sc, 2.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}
