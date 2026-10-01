import { COLS, ROWS, TS, LEVELS, type LevelDef } from './levels';
import { sfx } from './audio';

export const W = COLS * TS; // 800
export const MAP_H = ROWS * TS; // 520
export const HUD = 64;
export const H = MAP_H + HUD;

export type Upgrades = Record<string, number>;

export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  max: number;
  icon: string;
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'hp', name: 'Vital Heart', desc: '+1 max health every run.', max: 3, icon: '❤️' },
  { id: 'speed', name: 'Quicksilver Boots', desc: '+8% movement speed.', max: 3, icon: '👢' },
  { id: 'dmg', name: 'Keen Edge', desc: '+0.5 blade damage and a little more reach.', max: 3, icon: '⚔️' },
  { id: 'ghost', name: 'Echo Amplifier', desc: 'Echoes deal +50% damage.', max: 3, icon: '👻' },
  { id: 'slots', name: 'Extra Echo Slot', desc: '+1 echo slot in every room.', max: 2, icon: '🌀' },
  { id: 'time', name: 'Time Dilation', desc: '+6 seconds on every timeline.', max: 3, icon: '⏳' },
  { id: 'dash', name: 'Phase Dash', desc: 'Dash recharges 25% faster.', max: 2, icon: '💨' },
  { id: 'atk', name: 'Swift Blade', desc: 'Slash 15% faster.', max: 2, icon: '🗡️' },
];

export interface Stats {
  maxHp: number;
  speed: number;
  dmg: number;
  range: number;
  ghostMul: number;
  slots: number;
  timeSec: number;
  dashCd: number;
  atkCd: number;
}

export function computeStats(u: Upgrades, lv: LevelDef): Stats {
  const g = (k: string) => u[k] || 0;
  return {
    maxHp: 3 + g('hp'),
    speed: 2.7 * (1 + 0.08 * g('speed')),
    dmg: 1 + 0.5 * g('dmg'),
    range: 4 * g('dmg'),
    ghostMul: 1 + 0.5 * g('ghost'),
    slots: lv.maxGhosts + g('slots'),
    timeSec: lv.time + 6 * g('time'),
    dashCd: Math.round(55 * Math.pow(0.75, g('dash'))),
    atkCd: Math.round(20 * Math.pow(0.85, g('atk'))),
  };
}

export interface ClearInfo {
  ghosts: number;
  attempts: number;
  seconds: number;
}

export interface Callbacks {
  onClear: (info: ClearInfo) => void;
  onPause: (paused: boolean) => void;
}

interface Frame {
  x: number;
  y: number;
  fx: number;
  fy: number;
  a: number;
  d: number;
}
interface Ghost {
  frames: Frame[];
  hue: number;
  cur: Frame;
}
interface Plate {
  tx: number;
  ty: number;
  ch: number;
  timed: boolean;
  timer: number;
  active: boolean;
}
interface Door {
  tx: number;
  ty: number;
  ch: number;
  kill: boolean;
  open: boolean;
}
interface Spike {
  tx: number;
  ty: number;
  phase: number;
}
interface Turret {
  tx: number;
  ty: number;
  dx: number;
  dy: number;
  phase: number;
}
interface Enemy {
  x: number;
  y: number;
  axis: 'x' | 'y';
  dir: number;
  hp: number;
  alive: boolean;
  flash: number;
}
interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  boss: boolean;
}
interface Boss {
  x: number;
  y: number;
  hp: number;
  max: number;
  alive: boolean;
  flash: number;
  vuln: boolean;
}
interface Slash {
  x: number;
  y: number;
  ang: number;
  life: number;
  ghost: boolean;
  color: string;
  r: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
}
interface Toast {
  text: string;
  life: number;
}

const CH_COLORS = ['#fff', '#38bdf8', '#f472b6', '#facc15', '#4ade80'];
const GHOST_HUES = [185, 275, 320, 45, 140, 15, 215];
const PR = 11; // player radius
const TIMED_PLATE = 150;
const BOSS_HP = 40;

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);

export class Engine {
  private ctx: CanvasRenderingContext2D;
  private level: LevelDef;
  private stats: Stats;
  private maxT: number;
  private solid: boolean[][] = [];
  private doorAt: (Door | null)[][] = [];
  private plates: Plate[] = [];
  private doors: Door[] = [];
  private spikes: Spike[] = [];
  private turrets: Turret[] = [];
  private spawns: { x: number; y: number; axis: 'x' | 'y' }[] = [];
  private start = { x: 0, y: 0 };
  private exit = { x: 0, y: 0 };
  private hasBoss: boolean;
  private baseCanvas: HTMLCanvasElement;

  private phase: 'play' | 'rewind' | 'clear' = 'play';
  private paused = false;
  private t = 0;
  private attempt = 1;
  private totalTicks = 0;
  private frames: Frame[] = [];
  private ghosts: Ghost[] = [];
  private player = { x: 0, y: 0, fx: 1, fy: 0, hp: 3, inv: 0, atkCd: 0, dashT: 0, dashCd: 0, dashDx: 1, dashDy: 0 };
  private enemies: Enemy[] = [];
  private projs: Proj[] = [];
  private boss: Boss | null = null;
  private slashes: Slash[] = [];
  private particles: Particle[] = [];
  private toasts: Toast[] = [];
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private shake = 0;
  private anim = 0;
  private flashColor = '';
  private flashT = 0;
  private hintT = 60 * 10;
  private rw = { idx: 0, step: 4, record: false };
  private sndLast: Record<string, number> = {};
  private killNoticed = false;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private destroyed = false;

  constructor(
    canvas: HTMLCanvasElement,
    private levelIndex: number,
    upgrades: Upgrades,
    private cb: Callbacks,
  ) {
    canvas.width = W;
    canvas.height = H;
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.level = LEVELS[levelIndex];
    this.stats = computeStats(upgrades, this.level);
    this.maxT = this.stats.timeSec * 60;
    this.hasBoss = !!this.level.boss;
    this.parse();
    this.baseCanvas = this.buildBase();
    this.resetRun();
    this.toast(this.hasBoss ? 'Defeat the Warden to escape the dungeon.' : 'Reach the exit portal.');
    sfx.startDrone();
  }

  // ---------------------------------------------------------------- setup
  private parse() {
    const rows = this.level.rows;
    let turretIdx = 0;
    for (let y = 0; y < ROWS; y++) {
      this.solid[y] = [];
      this.doorAt[y] = [];
      for (let x = 0; x < COLS; x++) {
        const c = rows[y][x] || '#';
        this.solid[y][x] = c === '#';
        this.doorAt[y][x] = null;
        if (c === 'P') this.start = { x: x * TS + TS / 2, y: y * TS + TS / 2 };
        else if (c === 'E') this.exit = { x: x * TS + TS / 2, y: y * TS + TS / 2 };
        else if (c >= '1' && c <= '4') this.plates.push({ tx: x, ty: y, ch: +c, timed: false, timer: 0, active: false });
        else if (c >= 'a' && c <= 'd')
          this.plates.push({ tx: x, ty: y, ch: c.charCodeAt(0) - 96, timed: true, timer: 0, active: false });
        else if (c >= 'A' && c <= 'D') {
          const d = { tx: x, ty: y, ch: c.charCodeAt(0) - 64, kill: false, open: false };
          this.doors.push(d);
          this.doorAt[y][x] = d;
        } else if (c === 'K') {
          const d = { tx: x, ty: y, ch: 0, kill: true, open: false };
          this.doors.push(d);
          this.doorAt[y][x] = d;
        } else if (c === 'S') this.spikes.push({ tx: x, ty: y, phase: 0 });
        else if (c === 's') this.spikes.push({ tx: x, ty: y, phase: 60 });
        else if (c === '>' || c === '<' || c === '^' || c === 'v') {
          this.solid[y][x] = true;
          const dx = c === '>' ? 1 : c === '<' ? -1 : 0;
          const dy = c === 'v' ? 1 : c === '^' ? -1 : 0;
          this.turrets.push({ tx: x, ty: y, dx, dy, phase: (turretIdx++ * 29) % 100 });
        } else if (c === 'm' || c === 'n')
          this.spawns.push({ x: x * TS + TS / 2, y: y * TS + TS / 2, axis: c === 'm' ? 'x' : 'y' });
      }
    }
  }

  private buildBase(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = MAP_H;
    const g = cv.getContext('2d') as CanvasRenderingContext2D;
    let seed = 1337 + this.levelIndex * 71;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const px = x * TS;
        const py = y * TS;
        const wall = this.level.rows[y][x] === '#';
        if (!wall) {
          g.fillStyle = (x + y) % 2 === 0 ? '#12152a' : '#151930';
          g.fillRect(px, py, TS, TS);
          g.strokeStyle = 'rgba(120,140,255,0.05)';
          g.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
          if (rnd() < 0.25) {
            g.strokeStyle = 'rgba(0,0,0,0.35)';
            g.beginPath();
            const sx = px + 6 + rnd() * 26;
            const sy = py + 6 + rnd() * 26;
            g.moveTo(sx, sy);
            g.lineTo(sx + (rnd() - 0.5) * 14, sy + (rnd() - 0.5) * 14);
            g.lineTo(sx + (rnd() - 0.5) * 20, sy + (rnd() - 0.5) * 20);
            g.stroke();
          }
        } else {
          g.fillStyle = '#242a45';
          g.fillRect(px, py, TS, TS);
          g.fillStyle = '#2f3658';
          g.fillRect(px, py, TS, 5);
          g.fillStyle = '#1a1e33';
          g.fillRect(px, py + TS - 4, TS, 4);
          g.strokeStyle = 'rgba(0,0,0,0.4)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(px, py + 20.5);
          g.lineTo(px + TS, py + 20.5);
          const off = (y % 2) * 20;
          g.moveTo(px + 10 + off, py);
          g.lineTo(px + 10 + off, py + 20);
          g.moveTo(px + 30 - off, py + 20);
          g.lineTo(px + 30 - off, py + TS);
          g.stroke();
        }
      }
    }
    return cv;
  }

  private resetRun() {
    const s = this.stats;
    this.t = 0;
    this.frames = [];
    const p = this.player;
    p.x = this.start.x;
    p.y = this.start.y;
    p.fx = 1;
    p.fy = 0;
    p.hp = s.maxHp;
    p.inv = 0;
    p.atkCd = 0;
    p.dashT = 0;
    p.dashCd = 0;
    this.enemies = this.spawns.map((sp) => ({
      x: sp.x,
      y: sp.y,
      axis: sp.axis,
      dir: 1,
      hp: 2,
      alive: true,
      flash: 0,
    }));
    this.projs = [];
    this.slashes = [];
    this.killNoticed = false;
    this.plates.forEach((pl) => {
      pl.timer = 0;
      pl.active = false;
    });
    this.doors.forEach((d) => (d.open = false));
    this.boss = this.hasBoss ? { x: W / 2, y: MAP_H / 2, hp: BOSS_HP, max: BOSS_HP, alive: true, flash: 0, vuln: false } : null;
    this.ghosts.forEach((g) => (g.cur = g.frames[0]));
    this.pressed.clear();
  }

  // ---------------------------------------------------------------- public API
  run() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(64, now - this.last);
      this.last = now;
      if (!this.paused) {
        this.acc += dt;
        while (this.acc >= 1000 / 60) {
          this.step();
          this.acc -= 1000 / 60;
        }
      }
      this.anim += 1;
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    sfx.stopDrone();
  }

  setPaused(v: boolean) {
    if (this.phase === 'clear') return;
    this.paused = v;
    this.keys.clear();
    this.last = performance.now();
    this.cb.onPause(v);
  }

  onBlur() {
    this.keys.clear();
    if (!this.paused) this.setPaused(true);
  }

  keyDown(e: KeyboardEvent): boolean {
    const c = e.code;
    const handled = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'Space',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyR',
      'KeyX',
      'KeyT',
      'KeyJ',
      'KeyK',
      'ShiftLeft',
      'ShiftRight',
      'Escape',
      'KeyP',
      'KeyM',
    ].includes(c);
    if (!handled) return false;
    if (e.repeat) return true;
    sfx.init();
    if (c === 'Escape' || c === 'KeyP') {
      this.setPaused(!this.paused);
      return true;
    }
    if (c === 'KeyM') {
      sfx.setMuted(!sfx.muted);
      this.toast(sfx.muted ? 'Sound off' : 'Sound on');
      return true;
    }
    if (this.paused) return true;
    this.keys.add(c);
    if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyK') this.pressed.add('dash');
    if (c === 'KeyR') this.requestRewind();
    if (c === 'KeyX') this.requestDiscard();
    if (c === 'KeyT') this.wipe();
    return true;
  }

  keyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }

  getLevelIndex() {
    return this.levelIndex;
  }

  // ---------------------------------------------------------------- actions
  private toast(text: string) {
    this.toasts.push({ text, life: 200 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  private once(key: string, fn: () => void, gap = 5) {
    if (this.anim - (this.sndLast[key] ?? -99) >= gap) {
      this.sndLast[key] = this.anim;
      fn();
    }
  }

  private requestRewind() {
    if (this.phase !== 'play') return;
    if (this.frames.length < 20) {
      this.toast('Do something first — an echo needs a story to tell.');
      sfx.deny();
      return;
    }
    if (this.ghosts.length >= this.stats.slots) {
      this.toast('No echo slots left! Press T to wipe all echoes, or X to retry without recording.');
      sfx.deny();
      return;
    }
    this.startRewind(true);
  }

  private requestDiscard() {
    if (this.phase !== 'play') return;
    if (this.frames.length < 2) return;
    this.startRewind(false);
  }

  private wipe() {
    if (this.phase !== 'play') return;
    if (this.ghosts.length === 0) {
      this.requestDiscard();
      return;
    }
    this.ghosts = [];
    this.attempt++;
    this.resetRun();
    this.toast('All echoes dispersed. A clean timeline.');
    sfx.rewind();
    this.flash('#38bdf8', 20);
  }

  private flash(color: string, t: number) {
    this.flashColor = color;
    this.flashT = t;
  }

  private startRewind(record: boolean) {
    if (this.phase !== 'play') return;
    this.phase = 'rewind';
    const len = this.frames.length;
    this.rw = { idx: len - 1, step: Math.max(3, Math.ceil(len / 45)), record };
    sfx.rewind();
  }

  private finishRewind() {
    if (this.rw.record) {
      const frames = this.frames;
      this.ghosts.push({ frames, hue: GHOST_HUES[this.ghosts.length % GHOST_HUES.length], cur: frames[0] });
      sfx.echo();
      this.toast(`Echo #${this.ghosts.length} bound to the timeline.`);
      this.flash('#a5f3fc', 18);
    } else {
      this.flash('#94a3b8', 12);
    }
    this.attempt++;
    this.resetRun();
    this.phase = 'play';
  }

  private burst(x: number, y: number, color: string, n: number, speed = 2.5, life = 30, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: life * (0.5 + Math.random() * 0.5),
        max: life,
        color,
        size: size * (0.5 + Math.random()),
      });
    }
  }

  private hurt() {
    const p = this.player;
    if (p.inv > 0 || p.dashT > 0 || this.phase !== 'play') return false;
    p.hp--;
    p.inv = 70;
    this.shake = 9;
    sfx.hurt();
    this.burst(p.x, p.y, '#f87171', 14, 3.5, 30);
    this.flash('#ef4444', 10);
    if (p.hp <= 0) {
      this.toast('You fell. Time folds back…');
      this.burst(p.x, p.y, '#fde68a', 30, 4, 40);
      this.startRewind(false);
    }
    return true;
  }

  // ---------------------------------------------------------------- collision
  private solidAt(tx: number, ty: number) {
    return tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS || this.solid[ty][tx];
  }

  private boxHits(x: number, y: number, r: number, withDoors: boolean) {
    const x1 = Math.floor((x - r) / TS);
    const x2 = Math.floor((x + r) / TS);
    const y1 = Math.floor((y - r) / TS);
    const y2 = Math.floor((y + r) / TS);
    for (let ty = y1; ty <= y2; ty++) {
      for (let tx = x1; tx <= x2; tx++) {
        if (this.solidAt(tx, ty)) return true;
        if (withDoors) {
          const d = this.doorAt[ty][tx];
          if (d && !d.open) return true;
        }
      }
    }
    return false;
  }

  private pressedBy(pl: Plate, pts: { x: number; y: number }[]) {
    const cx = pl.tx * TS + TS / 2;
    const cy = pl.ty * TS + TS / 2;
    return pts.some((q) => Math.abs(q.x - cx) < 17 && Math.abs(q.y - cy) < 17);
  }

  private chanOpen(active: boolean[]) {
    const res = [false, false, false, false, false];
    for (let ch = 1; ch <= 4; ch++) {
      let count = 0;
      let ok = true;
      this.plates.forEach((pl, i) => {
        if (pl.ch === ch) {
          count++;
          if (!active[i]) ok = false;
        }
      });
      res[ch] = count > 0 && ok;
    }
    return res;
  }

  // ---------------------------------------------------------------- combat
  private swing(x: number, y: number, fx: number, fy: number, dmg: number, ghost: boolean, color: string) {
    const r = 30 + this.stats.range;
    const cx = x + fx * 26;
    const cy = y + fy * 26;
    this.slashes.push({ x, y, ang: Math.atan2(fy, fx), life: 10, ghost, color, r });
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist(cx, cy, e.x, e.y) < r + 12) {
        e.hp -= dmg;
        e.flash = 8;
        this.burst(e.x, e.y, '#86efac', 8, 3, 22);
        if (e.hp <= 0) {
          e.alive = false;
          this.burst(e.x, e.y, '#4ade80', 22, 4, 36, 4);
          this.once('kill', () => sfx.kill(), 4);
          this.shake = Math.max(this.shake, 4);
        } else this.once('hit', () => sfx.hit(), 4);
      }
    }
    const b = this.boss;
    if (b && b.alive && dist(cx, cy, b.x, b.y) < r + 28) {
      if (b.vuln) {
        b.hp -= dmg;
        b.flash = 8;
        this.burst(b.x, b.y, '#fbbf24', 10, 4, 26);
        this.once('bhit', () => sfx.bossHit(), 4);
        this.shake = Math.max(this.shake, 3);
        if (b.hp <= 0) this.killBoss();
      } else {
        this.burst(cx, cy, '#67e8f9', 6, 3, 18, 2);
        this.once('shield', () => sfx.shield(), 6);
      }
    }
    this.projs = this.projs.filter((pr) => {
      if (dist(cx, cy, pr.x, pr.y) < r) {
        this.burst(pr.x, pr.y, pr.boss ? '#f0abfc' : '#fdba74', 4, 2, 14, 2);
        return false;
      }
      return true;
    });
  }

  private killBoss() {
    const b = this.boss;
    if (!b) return;
    b.alive = false;
    this.projs = [];
    this.burst(b.x, b.y, '#fbbf24', 80, 7, 70, 5);
    this.burst(b.x, b.y, '#c084fc', 60, 5, 60, 4);
    this.shake = 22;
    this.flash('#fde68a', 30);
    sfx.bossDie();
    this.toast('The Warden shatters! The exit portal opens.');
  }

  private fire(x: number, y: number, ang: number, speed: number, boss: boolean, r = 5) {
    this.projs.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r, boss });
  }

  // ---------------------------------------------------------------- simulation
  private step() {
    // shared effects
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 0.6);
    if (this.flashT > 0) this.flashT--;
    this.toasts.forEach((t) => t.life--);
    this.toasts = this.toasts.filter((t) => t.life > 0);
    this.slashes.forEach((s) => s.life--);
    this.slashes = this.slashes.filter((s) => s.life > 0);
    this.particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life--;
    });
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.phase === 'rewind') {
      this.rw.idx -= this.rw.step;
      if (this.rw.idx <= 0) this.finishRewind();
      return;
    }
    if (this.phase !== 'play') {
      this.pressed.clear();
      return;
    }
    this.simPlay();
  }

  private simPlay() {
    const s = this.stats;
    const p = this.player;
    const t = this.t;
    if (this.hintT > 0) this.hintT--;

    // ---- player input
    const k = this.keys;
    let mx = 0;
    let my = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    const moving = mx !== 0 || my !== 0;
    if (moving) {
      const l = Math.hypot(mx, my);
      mx /= l;
      my /= l;
      p.fx = mx;
      p.fy = my;
    }
    if (this.pressed.has('dash') && p.dashCd <= 0 && p.dashT <= 0) {
      p.dashT = 8;
      p.dashDx = moving ? mx : p.fx;
      p.dashDy = moving ? my : p.fy;
      p.dashCd = s.dashCd;
      sfx.dash();
    }
    this.pressed.clear();
    let vx = mx * s.speed;
    let vy = my * s.speed;
    if (p.dashT > 0) {
      vx = p.dashDx * 7.5;
      vy = p.dashDy * 7.5;
      p.dashT--;
      this.burst(p.x, p.y, '#fde68a', 1, 0.5, 14, 4);
    }
    const stuck = this.boxHits(p.x, p.y, PR, true);
    const nx = p.x + vx;
    if (!this.boxHits(nx, p.y, PR, !stuck)) p.x = nx;
    const ny = p.y + vy;
    if (!this.boxHits(p.x, ny, PR, !stuck)) p.y = ny;
    if (p.dashCd > 0) p.dashCd--;
    if (p.inv > 0) p.inv--;
    if (p.atkCd > 0) p.atkCd--;

    let atk = 0;
    if ((k.has('Space') || k.has('KeyJ')) && p.atkCd <= 0 && p.dashT <= 0) {
      atk = 1;
      p.atkCd = s.atkCd;
      this.swing(p.x, p.y, p.fx, p.fy, s.dmg, false, '#fff7d6');
      sfx.attack();
    }
    this.frames.push({ x: p.x, y: p.y, fx: p.fx, fy: p.fy, a: atk, d: p.dashT > 0 ? 1 : 0 });

    // ---- ghosts replay
    this.ghosts.forEach((g) => {
      const idx = Math.min(t, g.frames.length - 1);
      const f = g.frames[idx];
      g.cur = f;
      if (t < g.frames.length && f.a) {
        this.swing(f.x, f.y, f.fx, f.fy, s.dmg * s.ghostMul, true, `hsl(${g.hue},90%,75%)`);
        this.once('gatk', () => sfx.ghostAttack(), 6);
      }
    });

    // ---- plates & doors
    const pts: { x: number; y: number }[] = [p, ...this.ghosts.map((g) => g.cur)];
    this.plates.forEach((pl) => {
      const pr = this.pressedBy(pl, pts);
      const was = pl.active;
      if (pl.timed) {
        if (pr) pl.timer = TIMED_PLATE;
        else if (pl.timer > 0) pl.timer--;
        pl.active = pr || pl.timer > 0;
      } else pl.active = pr;
      if (pl.active !== was && t > 1) {
        this.once('plate', () => sfx.plate(pl.active), 4);
        this.burst(pl.tx * TS + TS / 2, pl.ty * TS + TS / 2, CH_COLORS[pl.ch], 8, 2, 20);
      }
    });
    const ch = this.chanOpen(this.plates.map((pl) => pl.active));
    const allDead = this.enemies.length > 0 && this.enemies.every((e) => !e.alive);
    this.doors.forEach((d) => {
      const was = d.open;
      d.open = d.kill ? allDead : ch[d.ch];
      if (d.open !== was && t > 1) {
        this.once('door', () => sfx.door(d.open), 8);
        this.burst(d.tx * TS + TS / 2, d.ty * TS + TS / 2, d.kill ? '#ef4444' : CH_COLORS[d.ch], 16, 3, 28);
        this.shake = Math.max(this.shake, 3);
      }
    });
    if (allDead && !this.killNoticed) {
      this.killNoticed = true;
      this.toast('Every slime is slain.');
    }

    // ---- spikes
    for (const sp of this.spikes) {
      if ((t + sp.phase) % 120 >= 70) {
        const cx = sp.tx * TS + TS / 2;
        const cy = sp.ty * TS + TS / 2;
        if (Math.abs(p.x - cx) < 17 && Math.abs(p.y - cy) < 17) this.hurt();
      }
      if ((t + sp.phase) % 120 === 50) {
        /* warning phase begins – visual only */
      }
    }

    // ---- enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.flash > 0) e.flash--;
      const nxx = e.x + (e.axis === 'x' ? e.dir * 0.9 : 0);
      const nyy = e.y + (e.axis === 'y' ? e.dir * 0.9 : 0);
      if (this.boxHits(nxx, nyy, 12, false)) e.dir *= -1;
      else {
        e.x = nxx;
        e.y = nyy;
      }
      if (dist(e.x, e.y, p.x, p.y) < 23) this.hurt();
    }

    // ---- turrets
    for (const tr of this.turrets) {
      if ((t + tr.phase) % 100 === 50) {
        const cx = tr.tx * TS + TS / 2;
        const cy = tr.ty * TS + TS / 2;
        this.fire(cx + tr.dx * 24, cy + tr.dy * 24, Math.atan2(tr.dy, tr.dx), 3, false, 5);
      }
    }

    // ---- boss
    const b = this.boss;
    if (b && b.alive) {
      b.x = W / 2 + Math.sin(t * 0.013) * 230;
      b.y = MAP_H / 2 + Math.sin(t * 0.026 + 1) * 110;
      if (b.flash > 0) b.flash--;
      const wasV = b.vuln;
      b.vuln = ch[1];
      if (b.vuln !== wasV && t > 1) {
        this.once('bv', () => (b.vuln ? sfx.warn() : sfx.shield()), 10);
      }
      const ph2 = b.hp <= b.max * 0.5;
      if (t >= 90) {
        const ringEvery = ph2 ? 80 : 110;
        if ((t - 90) % ringEvery === 0) {
          const n = ph2 ? 14 : 12;
          const off = t * 0.05;
          for (let i = 0; i < n; i++) this.fire(b.x, b.y, off + (i * Math.PI * 2) / n, ph2 ? 2.1 : 1.9, true, 6);
          this.once('bring', () => sfx.shoot(), 10);
        }
        const aimEvery = ph2 ? 55 : 80;
        if ((t - 60) % aimEvery === 0) {
          const base = Math.atan2(p.y - b.y, p.x - b.x);
          const cnt = ph2 ? 5 : 3;
          for (let i = 0; i < cnt; i++) this.fire(b.x, b.y, base + (i - (cnt - 1) / 2) * 0.22, 2.7, true, 5);
          this.once('bring', () => sfx.shoot(), 10);
        }
        if (ph2 && t % 12 === 0) this.fire(b.x, b.y, t * 0.21, 1.7, true, 5);
      }
      if (dist(b.x, b.y, p.x, p.y) < 26 + PR) this.hurt();
    }

    // ---- projectiles
    const keep: Proj[] = [];
    for (const pr of this.projs) {
      pr.x += pr.vx;
      pr.y += pr.vy;
      if (this.boxHits(pr.x, pr.y, 2, true)) {
        this.burst(pr.x, pr.y, pr.boss ? '#f0abfc' : '#fdba74', 3, 1.5, 12, 2);
        continue;
      }
      if (dist(pr.x, pr.y, p.x, p.y) < pr.r + 9) {
        if (this.hurt()) continue;
      }
      keep.push(pr);
    }
    this.projs = keep;

    if (this.phase !== 'play') return;

    // ---- exit
    const exitActive = !this.boss || !this.boss.alive;
    if (exitActive && dist(p.x, p.y, this.exit.x, this.exit.y) < 18) {
      this.phase = 'clear';
      sfx.clear();
      this.burst(this.exit.x, this.exit.y, '#c4b5fd', 50, 5, 50, 4);
      this.flash('#c4b5fd', 24);
      this.cb.onClear({
        ghosts: this.ghosts.length,
        attempts: this.attempt,
        seconds: Math.round((this.totalTicks + this.t) / 60),
      });
      return;
    }

    this.t++;
    this.totalTicks++;
    if (this.t >= this.maxT) {
      if (this.ghosts.length < this.stats.slots) {
        this.toast("Time's up — your run is bound as an echo.");
        this.startRewind(true);
      } else {
        this.toast("Time's up — no echo slots left, run discarded.");
        this.startRewind(false);
      }
    }
  }

  // ---------------------------------------------------------------- rendering
  private rr(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private glow(x: number, y: number, r: number, color: string, alpha: number) {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = alpha;
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    c.restore();
  }

  private drawActor(x: number, y: number, fx: number, fy: number, color: string, alpha: number, label?: string, dark = '#1f1b12') {
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = 'rgba(0,0,0,0.35)';
    c.beginPath();
    c.ellipse(x, y + 10, 11, 5, 0, 0, Math.PI * 2);
    c.fill();
    const bob = Math.sin(this.anim * 0.15 + x * 0.05) * 1.2;
    // cloak
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x - 11, y + 9 + bob);
    c.quadraticCurveTo(x - 12, y - 10 + bob, x, y - 13 + bob);
    c.quadraticCurveTo(x + 12, y - 10 + bob, x + 11, y + 9 + bob);
    c.closePath();
    c.fill();
    // face
    c.fillStyle = dark;
    c.beginPath();
    c.arc(x + fx * 3, y - 3 + fy * 2 + bob, 6.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = color;
    c.fillRect(x + fx * 4 - 4, y - 4 + fy * 2 + bob, 2.5, 3);
    c.fillRect(x + fx * 4 + 1.5, y - 4 + fy * 2 + bob, 2.5, 3);
    // blade
    c.strokeStyle = '#e2e8f0';
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(x + fx * 11, y + fy * 11 + bob);
    c.lineTo(x + fx * 21, y + fy * 21 + bob);
    c.stroke();
    if (label) {
      c.fillStyle = '#fff';
      c.font = '700 10px ui-monospace, monospace';
      c.textAlign = 'center';
      c.fillText(label, x, y - 18);
    }
    c.restore();
  }

  private render() {
    const c = this.ctx;
    const rew = this.phase === 'rewind';
    const t = rew ? this.rw.idx : this.t;
    const p = this.player;
    c.save();
    c.fillStyle = '#05060c';
    c.fillRect(0, 0, W, H);
    c.beginPath();
    c.rect(0, HUD, W, MAP_H);
    c.clip();
    const sx = (Math.random() - 0.5) * this.shake * 2;
    const sy = (Math.random() - 0.5) * this.shake * 2;
    c.translate(sx, HUD + sy);
    c.drawImage(this.baseCanvas, 0, 0);

    // world state for this render (live or rewound)
    let pp: { x: number; y: number; fx: number; fy: number };
    let ghostPos: { f: Frame; hue: number; i: number }[];
    if (rew) {
      const fr = this.frames[Math.max(0, Math.min(this.frames.length - 1, this.rw.idx))];
      pp = fr;
      ghostPos = this.ghosts.map((g, i) => ({ f: g.frames[Math.min(t, g.frames.length - 1)], hue: g.hue, i }));
    } else {
      pp = p;
      ghostPos = this.ghosts.map((g, i) => ({ f: g.cur, hue: g.hue, i }));
    }
    const pts = [pp, ...ghostPos.map((g) => g.f)];
    const plateActive = this.plates.map((pl) => (rew ? this.pressedBy(pl, pts) : pl.active));
    const chs = this.chanOpen(plateActive);
    const doorOpen = this.doors.map((d) => (rew ? (d.kill ? false : chs[d.ch]) : d.open));

    // plates
    this.plates.forEach((pl, i) => {
      const x = pl.tx * TS;
      const y = pl.ty * TS;
      const col = CH_COLORS[pl.ch];
      const on = plateActive[i];
      c.fillStyle = '#0a0c16';
      this.rr(x + 4, y + 4, TS - 8, TS - 8, 6);
      c.fill();
      c.strokeStyle = col;
      c.globalAlpha = on ? 1 : 0.6;
      c.lineWidth = 2;
      this.rr(x + 6, y + 6, TS - 12, TS - 12, 4);
      c.stroke();
      c.fillStyle = col;
      c.globalAlpha = on ? 0.85 : 0.15;
      this.rr(x + 10, y + 10, TS - 20, TS - 20, 3);
      c.fill();
      c.globalAlpha = 1;
      if (pl.timed) {
        c.strokeStyle = col;
        c.lineWidth = 2;
        c.beginPath();
        const frac = rew ? 0 : pl.timer / TIMED_PLATE;
        if (frac > 0) c.arc(x + TS / 2, y + TS / 2, 15, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        c.stroke();
        c.fillStyle = on ? '#0b1020' : col;
        c.globalAlpha = 0.9;
        c.fillRect(x + TS / 2 - 1, y + TS / 2 - 6, 2, 7);
        c.fillRect(x + TS / 2 - 1, y + TS / 2 - 1, 5, 2);
        c.globalAlpha = 1;
      }
      if (on) this.glow(x + TS / 2, y + TS / 2, 46, col, 0.5);
    });

    // spikes
    for (const sp of this.spikes) {
      const x = sp.tx * TS;
      const y = sp.ty * TS;
      const cyc = (t + sp.phase) % 120;
      c.fillStyle = '#0d0f1a';
      c.fillRect(x + 3, y + 3, TS - 6, TS - 6);
      c.fillStyle = '#2a2f45';
      for (let i = 0; i < 4; i++) c.fillRect(x + 9 + (i % 2) * 18, y + 9 + Math.floor(i / 2) * 18, 4, 4);
      if (cyc >= 70) {
        c.fillStyle = '#e2e8f0';
        for (let i = 0; i < 4; i++) {
          const bx = x + 11 + (i % 2) * 18;
          const by = y + 11 + Math.floor(i / 2) * 18;
          c.beginPath();
          c.moveTo(bx - 6, by + 6);
          c.lineTo(bx, by - 8);
          c.lineTo(bx + 6, by + 6);
          c.closePath();
          c.fill();
          c.fillStyle = '#ef4444';
          c.fillRect(bx - 1, by - 8, 2, 4);
          c.fillStyle = '#e2e8f0';
        }
      } else if (cyc >= 50) {
        const a = 0.3 + 0.3 * Math.sin(this.anim * 0.6);
        c.fillStyle = `rgba(239,68,68,${a})`;
        c.fillRect(x + 4, y + 4, TS - 8, TS - 8);
      }
    }

    // exit
    {
      const active = !this.boss || !this.boss.alive;
      const ex = this.exit.x;
      const ey = this.exit.y;
      if (active) {
        this.glow(ex, ey, 60, '#8b5cf6', 0.9);
        for (let i = 0; i < 4; i++) {
          c.strokeStyle = i % 2 ? '#67e8f9' : '#c4b5fd';
          c.lineWidth = 2;
          c.beginPath();
          c.arc(ex, ey, 16 - i * 3.5, this.anim * 0.05 * (i % 2 ? 1 : -1) + i, this.anim * 0.05 * (i % 2 ? 1 : -1) + i + Math.PI * 1.4);
          c.stroke();
        }
      } else {
        c.strokeStyle = '#3b3f58';
        c.lineWidth = 2;
        c.beginPath();
        c.arc(ex, ey, 15, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = '#3b3f58';
        c.fillRect(ex - 5, ey - 2, 10, 8);
        c.beginPath();
        c.arc(ex, ey - 3, 4, Math.PI, 0);
        c.stroke();
      }
    }

    // doors
    this.doors.forEach((d, i) => {
      const x = d.tx * TS;
      const y = d.ty * TS;
      const col = d.kill ? '#ef4444' : CH_COLORS[d.ch];
      const open = doorOpen[i];
      if (open) {
        c.fillStyle = col;
        c.globalAlpha = 0.5;
        c.fillRect(x + 2, y + 2, 4, TS - 4);
        c.fillRect(x + TS - 6, y + 2, 4, TS - 4);
        c.globalAlpha = 0.12;
        c.fillRect(x, y, TS, TS);
        c.globalAlpha = 1;
      } else {
        c.fillStyle = '#10121f';
        c.fillRect(x, y, TS, TS);
        c.fillStyle = col;
        for (let b = 0; b < 4; b++) c.fillRect(x + 4 + b * 9, y + 2, 5, TS - 4);
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(x, y + 17, TS, 6);
        c.strokeStyle = col;
        c.lineWidth = 2;
        c.strokeRect(x + 1, y + 1, TS - 2, TS - 2);
        if (d.kill) {
          c.strokeStyle = '#fee2e2';
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(x + 10, y + 10);
          c.lineTo(x + 30, y + 30);
          c.moveTo(x + 30, y + 10);
          c.lineTo(x + 10, y + 30);
          c.stroke();
        }
        this.glow(x + TS / 2, y + TS / 2, 34, col, 0.35);
      }
    });

    // turrets
    for (const tr of this.turrets) {
      const x = tr.tx * TS;
      const y = tr.ty * TS;
      c.fillStyle = '#3a2233';
      c.fillRect(x, y, TS, TS);
      c.fillStyle = '#4c2c44';
      c.fillRect(x + 2, y + 2, TS - 4, TS - 4);
      const cyc = (t + tr.phase) % 100;
      const charge = cyc > 25 && cyc <= 50 ? (cyc - 25) / 25 : cyc > 50 ? 0 : 0;
      c.fillStyle = '#1a0f18';
      c.save();
      c.translate(x + TS / 2, y + TS / 2);
      c.rotate(Math.atan2(tr.dy, tr.dx));
      c.fillRect(2, -6, 20, 12);
      c.restore();
      c.fillStyle = `rgba(251,146,60,${0.35 + charge * 0.65})`;
      c.beginPath();
      c.arc(x + TS / 2 + tr.dx * 8, y + TS / 2 + tr.dy * 8, 5 + charge * 3, 0, Math.PI * 2);
      c.fill();
      if (charge > 0.6) this.glow(x + TS / 2 + tr.dx * 10, y + TS / 2 + tr.dy * 10, 30, '#fb923c', 0.6);
    }

    // enemies
    if (!rew) {
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const sq = 1 + Math.sin(this.anim * 0.2 + e.x) * 0.08;
        c.fillStyle = 'rgba(0,0,0,0.35)';
        c.beginPath();
        c.ellipse(e.x, e.y + 11, 13, 5, 0, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = e.flash > 0 ? '#ffffff' : '#22c55e';
        c.beginPath();
        c.ellipse(e.x, e.y + 2, 14 / sq, 12 * sq, 0, Math.PI, 0);
        c.lineTo(e.x + 14 / sq, e.y + 8);
        c.quadraticCurveTo(e.x, e.y + 14, e.x - 14 / sq, e.y + 8);
        c.closePath();
        c.fill();
        c.fillStyle = '#bbf7d0';
        c.beginPath();
        c.ellipse(e.x - 5, e.y - 4, 3, 2, -0.5, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#052e16';
        c.beginPath();
        c.arc(e.x - 4, e.y + 1, 2.4, 0, Math.PI * 2);
        c.arc(e.x + 5, e.y + 1, 2.4, 0, Math.PI * 2);
        c.fill();
        if (e.hp < 2) {
          c.fillStyle = '#ef4444';
          c.fillRect(e.x - 8, e.y - 18, 16 * Math.max(0, e.hp / 2), 3);
        }
      }
    }

    // ghost trails & ghosts
    ghostPos.forEach(({ f, hue, i }) => {
      const col = `hsl(${hue},90%,70%)`;
      const gIdx = Math.min(t, this.ghosts[i].frames.length - 1);
      const ended = t >= this.ghosts[i].frames.length - 1;
      for (let k = 6; k >= 1; k--) {
        const tf = this.ghosts[i].frames[Math.max(0, gIdx - k * 3)];
        c.globalAlpha = 0.05 + (6 - k) * 0.01;
        c.fillStyle = col;
        c.beginPath();
        c.arc(tf.x, tf.y, 9, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      this.glow(f.x, f.y, 44, `hsl(${hue},100%,60%)`, ended ? 0.25 : 0.45);
      const flick = ended ? 0.5 : 0.7 + 0.15 * Math.sin(this.anim * 0.3 + i);
      this.drawActor(f.x, f.y, f.fx, f.fy, col, flick, `${i + 1}`, '#0a1322');
      if (f.d) {
        c.strokeStyle = col;
        c.globalAlpha = 0.5;
        c.beginPath();
        c.arc(f.x, f.y, 14, 0, Math.PI * 2);
        c.stroke();
        c.globalAlpha = 1;
      }
    });

    // boss
    const b = this.boss;
    if (b && b.alive && !rew) this.drawBoss(b, plateActive);

    // player
    {
      const blink = p.inv > 0 && Math.floor(this.anim / 3) % 2 === 0 && !rew;
      if (!blink) {
        this.glow(pp.x, pp.y, 50, '#fde68a', 0.35);
        this.drawActor(pp.x, pp.y, pp.fx, pp.fy, p.dashT > 0 && !rew ? '#fffbeb' : '#fcd34d', rew ? 0.6 : 1);
      }
    }

    // projectiles
    if (!rew) {
      for (const pr of this.projs) {
        const col = pr.boss ? '#e879f9' : '#fb923c';
        this.glow(pr.x, pr.y, 16, col, 0.8);
        c.fillStyle = '#fff';
        c.beginPath();
        c.arc(pr.x, pr.y, pr.r - 2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = col;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
        c.stroke();
      }
    }

    // slashes
    for (const s of this.slashes) {
      const a = s.life / 10;
      c.save();
      c.globalAlpha = a * (s.ghost ? 0.7 : 1);
      c.strokeStyle = s.color;
      c.lineWidth = 6 * a + 1;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(s.x, s.y, s.r - 6, s.ang - 1.0 + (1 - a) * 0.6, s.ang + 1.0 - (1 - a) * 0.3);
      c.stroke();
      c.restore();
    }

    // particles
    for (const pt of this.particles) {
      c.globalAlpha = Math.max(0, pt.life / pt.max);
      c.fillStyle = pt.color;
      c.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    c.globalAlpha = 1;

    // lighting
    {
      const g = c.createRadialGradient(pp.x, pp.y, 60, pp.x, pp.y, 360);
      g.addColorStop(0, 'rgba(3,4,12,0)');
      g.addColorStop(1, 'rgba(3,4,12,0.62)');
      c.fillStyle = g;
      c.fillRect(0, 0, W, MAP_H);
    }

    // flash
    if (this.flashT > 0) {
      c.globalAlpha = Math.min(0.35, this.flashT / 60);
      c.fillStyle = this.flashColor;
      c.fillRect(0, 0, W, MAP_H);
      c.globalAlpha = 1;
    }

    // rewind overlay
    if (rew) {
      c.fillStyle = this.rw.record ? 'rgba(34,211,238,0.14)' : 'rgba(148,163,184,0.12)';
      c.fillRect(0, 0, W, MAP_H);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      const off = (this.anim * 9) % 10;
      for (let y = off; y < MAP_H; y += 10) c.fillRect(0, y, W, 2);
      c.textAlign = 'center';
      c.fillStyle = '#e0f2fe';
      c.font = '800 40px ui-monospace, monospace';
      c.fillText('◀◀ REWIND', W / 2, MAP_H / 2 - 4);
      c.font = '600 15px ui-monospace, monospace';
      c.fillStyle = '#7dd3fc';
      c.fillText(`${(this.rw.idx / 60).toFixed(1)}s  ·  ${this.rw.record ? 'an echo is being born' : 'timeline discarded'}`, W / 2, MAP_H / 2 + 24);
    }

    // boss bar
    if (b && b.alive) this.drawBossBar(b);

    // hint + toasts
    if (this.hintT > 0 && !rew) this.drawHint();
    this.drawToasts();
    c.restore();

    this.drawHud(t);
  }

  private drawBoss(b: Boss, plateActive: boolean[]) {
    const c = this.ctx;
    const t = this.t;
    // tethers to plates
    this.plates.forEach((pl, i) => {
      const col = CH_COLORS[pl.ch];
      c.strokeStyle = col;
      c.globalAlpha = plateActive[i] ? 0.15 : 0.55;
      c.lineWidth = plateActive[i] ? 1 : 2;
      c.setLineDash([6, 8]);
      c.lineDashOffset = -this.anim;
      c.beginPath();
      c.moveTo(b.x, b.y);
      c.lineTo(pl.tx * TS + TS / 2, pl.ty * TS + TS / 2);
      c.stroke();
      c.setLineDash([]);
      c.globalAlpha = 1;
    });
    this.glow(b.x, b.y, 90, b.vuln ? '#f59e0b' : '#7c3aed', 0.7);
    // shadow
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath();
    c.ellipse(b.x, b.y + 34, 28, 8, 0, 0, Math.PI * 2);
    c.fill();
    // gear teeth
    c.save();
    c.translate(b.x, b.y);
    c.rotate(this.anim * 0.01);
    c.fillStyle = b.flash > 0 ? '#fff' : '#4c1d95';
    for (let i = 0; i < 12; i++) {
      c.rotate((Math.PI * 2) / 12);
      c.fillRect(-4, -34, 8, 10);
    }
    c.restore();
    c.fillStyle = b.flash > 0 ? '#fff' : '#2e1065';
    c.beginPath();
    c.arc(b.x, b.y, 27, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = b.vuln ? '#fbbf24' : '#a78bfa';
    c.lineWidth = 3;
    c.stroke();
    // clock face
    c.fillStyle = '#ede9fe';
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12;
      c.fillRect(b.x + Math.cos(a) * 20 - 1, b.y + Math.sin(a) * 20 - 1, 2, 2);
    }
    c.strokeStyle = '#ede9fe';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.lineTo(b.x + Math.cos(t * 0.05) * 18, b.y + Math.sin(t * 0.05) * 18);
    c.stroke();
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.lineTo(b.x + Math.cos(t * 0.006) * 11, b.y + Math.sin(t * 0.006) * 11);
    c.stroke();
    // eye
    c.fillStyle = b.vuln ? '#fbbf24' : '#67e8f9';
    c.beginPath();
    c.arc(b.x, b.y, 4, 0, Math.PI * 2);
    c.fill();
    // shield
    if (!b.vuln) {
      c.save();
      c.translate(b.x, b.y);
      c.rotate(-this.anim * 0.02);
      c.strokeStyle = 'rgba(103,232,249,0.85)';
      c.fillStyle = 'rgba(103,232,249,0.08)';
      c.lineWidth = 3;
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI * 2) / 6;
        c.lineTo(Math.cos(a) * 42, Math.sin(a) * 42);
      }
      c.closePath();
      c.fill();
      c.stroke();
      c.restore();
    }
  }

  private drawBossBar(b: Boss) {
    const c = this.ctx;
    const w = 420;
    const x = (W - w) / 2;
    const y = MAP_H - 26;
    c.fillStyle = 'rgba(0,0,0,0.6)';
    this.rr(x - 6, y - 16, w + 12, 32, 6);
    c.fill();
    c.fillStyle = '#1e1b2e';
    c.fillRect(x, y, w, 8);
    c.fillStyle = b.vuln ? '#fbbf24' : '#8b5cf6';
    c.fillRect(x, y, (w * Math.max(0, b.hp)) / b.max, 8);
    c.strokeStyle = '#a78bfa';
    c.strokeRect(x + 0.5, y + 0.5, w - 1, 7);
    c.textAlign = 'center';
    c.font = '700 11px ui-monospace, monospace';
    c.fillStyle = b.vuln ? '#fde68a' : '#c4b5fd';
    c.fillText(b.vuln ? 'CHRONOS WARDEN — SHIELD DOWN, STRIKE!' : 'CHRONOS WARDEN — SHIELDED (light both runes)', W / 2, y - 4);
  }

  private wrap(text: string, maxW: number) {
    const c = this.ctx;
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (c.measureText(test).width > maxW && cur) {
        lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  private drawHint() {
    const c = this.ctx;
    c.font = '600 13px ui-monospace, monospace';
    const lines = this.wrap(this.level.hint, 640);
    const h = lines.length * 18 + 14;
    const a = Math.min(1, this.hintT / 40);
    c.globalAlpha = a * 0.92;
    c.fillStyle = 'rgba(5,7,18,0.85)';
    this.rr(W / 2 - 340, 10, 680, h, 8);
    c.fill();
    c.strokeStyle = 'rgba(103,232,249,0.4)';
    c.lineWidth = 1;
    c.stroke();
    c.fillStyle = '#e0f2fe';
    c.textAlign = 'center';
    lines.forEach((l, i) => c.fillText(l, W / 2, 30 + i * 18));
    c.globalAlpha = 1;
  }

  private drawToasts() {
    const c = this.ctx;
    c.font = '700 13px ui-monospace, monospace';
    c.textAlign = 'center';
    const list = this.toasts.slice(-2);
    list.forEach((t, i) => {
      const a = Math.min(1, t.life / 40);
      const y = MAP_H - (this.boss && this.boss.alive ? 70 : 34) - (list.length - 1 - i) * 26;
      const w = c.measureText(t.text).width + 28;
      c.globalAlpha = a * 0.9;
      c.fillStyle = 'rgba(5,7,18,0.85)';
      this.rr(W / 2 - w / 2, y - 16, w, 24, 6);
      c.fill();
      c.fillStyle = '#fef9c3';
      c.fillText(t.text, W / 2, y);
      c.globalAlpha = 1;
    });
  }

  private drawHud(t: number) {
    const c = this.ctx;
    const s = this.stats;
    c.fillStyle = '#0a0c18';
    c.fillRect(0, 0, W, HUD);
    c.fillStyle = '#1c2140';
    c.fillRect(0, HUD - 2, W, 2);
    c.textAlign = 'left';
    c.fillStyle = '#64748b';
    c.font = '700 10px ui-monospace, monospace';
    c.fillText(`ROOM ${this.levelIndex + 1} / ${LEVELS.length}   ·   RUN ${this.attempt}`, 16, 20);
    c.fillStyle = '#f1f5f9';
    c.font = '800 17px ui-monospace, monospace';
    c.fillText(this.level.name, 16, 44);

    // timeline
    const x0 = 290;
    const tw = 250;
    const remain = Math.max(0, (this.maxT - t) / 60);
    c.textAlign = 'center';
    c.font = '700 11px ui-monospace, monospace';
    c.fillStyle = remain < 5 ? '#f87171' : '#7dd3fc';
    c.fillText(`TIMELINE  ${remain.toFixed(1)}s`, x0 + tw / 2, 16);
    c.fillStyle = '#151a33';
    this.rr(x0, 22, tw, 10, 5);
    c.fill();
    const frac = Math.min(1, t / this.maxT);
    const grad = c.createLinearGradient(x0, 0, x0 + tw, 0);
    grad.addColorStop(0, '#0ea5e9');
    grad.addColorStop(1, remain < 5 ? '#ef4444' : '#a78bfa');
    c.fillStyle = grad;
    this.rr(x0, 22, Math.max(6, tw * frac), 10, 5);
    c.fill();
    this.ghosts.forEach((g) => {
      const gx = x0 + tw * Math.min(1, g.frames.length / this.maxT);
      c.fillStyle = `hsl(${g.hue},90%,70%)`;
      c.beginPath();
      c.moveTo(gx, 34);
      c.lineTo(gx - 4, 41);
      c.lineTo(gx + 4, 41);
      c.closePath();
      c.fill();
    });
    // echo slots
    c.textAlign = 'left';
    c.fillStyle = '#64748b';
    c.font = '700 10px ui-monospace, monospace';
    c.fillText('ECHOES', x0 - 2, 57);
    for (let i = 0; i < s.slots; i++) {
      const cx = x0 + 56 + i * 17;
      const g = this.ghosts[i];
      c.beginPath();
      c.arc(cx, 54, 5.5, 0, Math.PI * 2);
      if (g) {
        c.fillStyle = `hsl(${g.hue},90%,65%)`;
        c.fill();
      } else {
        c.strokeStyle = '#475569';
        c.lineWidth = 1.5;
        c.stroke();
      }
    }

    // hearts
    c.textAlign = 'left';
    c.font = '20px ui-sans-serif, system-ui';
    const hp = this.player.hp;
    const hx = W - 16 - s.maxHp * 22;
    for (let i = 0; i < s.maxHp; i++) {
      c.fillStyle = i < hp ? '#ef4444' : '#2a2f45';
      c.fillText('♥', hx + i * 22, 30);
    }
    // dash meter
    c.fillStyle = '#64748b';
    c.font = '700 10px ui-monospace, monospace';
    c.fillText('DASH', hx, 52);
    c.fillStyle = '#151a33';
    c.fillRect(hx + 34, 45, 70, 6);
    const df = this.player.dashCd <= 0 ? 1 : 1 - this.player.dashCd / s.dashCd;
    c.fillStyle = df >= 1 ? '#fde68a' : '#94a3b8';
    c.fillRect(hx + 34, 45, 70 * df, 6);

    if (this.flashT > 0) {
      c.globalAlpha = Math.min(0.15, this.flashT / 100);
      c.fillStyle = this.flashColor;
      c.fillRect(0, 0, W, HUD);
      c.globalAlpha = 1;
    }
  }
}
