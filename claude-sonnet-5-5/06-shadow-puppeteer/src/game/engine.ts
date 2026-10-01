import { AudioEngine } from "./audio";
import { COLS, LEVELS, ROWS, TILE, type LightDef } from "./levels";

export const W = 960;
export const H = 560;
const T = TILE;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Stats {
  time: number;
  deaths: number;
  shards: number;
  totalShards: number;
  stars: number;
}

export type GameEvent =
  | { type: "complete"; stats: Stats }
  | { type: "lose"; stats: Stats }
  | { type: "pause" };

export type KeyName = "left" | "right" | "jump" | "dash" | "use";

interface LightState {
  def: LightDef;
  id: string;
  x: number;
  y: number;
  r: number;
  color: [number, number, number];
  cone: boolean;
  angle: number;
  half: number;
  cur: number;
  disabledUntil: number;
  disabledFor: number;
  warn: boolean;
}

interface MoverState {
  def: { x: number; y: number; w: number; h: number; dx: number; dy: number; period: number; phase: number };
  rect: Rect;
  baseX: number;
  baseY: number;
}

interface Shard {
  x: number;
  y: number;
  got: boolean;
  ph: number;
}
interface Lever {
  x: number;
  y: number;
  target: string;
  duration: number;
}
interface Checkpoint {
  x: number;
  y: number;
  active: boolean;
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
  g: number;
  add: boolean;
}

type PState = "alive" | "dead" | "won" | "lost";

function segHitsRect(ax: number, ay: number, bx: number, by: number, r: Rect): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = bx - ax;
  const dy = by - ay;
  const minx = r.x + 0.5;
  const maxx = r.x + r.w - 0.5;
  const miny = r.y + 0.5;
  const maxy = r.y + r.h - 0.5;
  if (Math.abs(dx) < 1e-9) {
    if (ax < minx || ax > maxx) return false;
  } else {
    let ta = (minx - ax) / dx;
    let tb = (maxx - ax) / dx;
    if (ta > tb) {
      const s = ta;
      ta = tb;
      tb = s;
    }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dy) < 1e-9) {
    if (ay < miny || ay > maxy) return false;
  } else {
    let ta = (miny - ay) / dy;
    let tb = (maxy - ay) / dy;
    if (ta > tb) {
      const s = ta;
      ta = tb;
      tb = s;
    }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

function visPolygon(lx: number, ly: number, R: number, rects: Rect[]): number[] {
  const x0 = lx - R;
  const y0 = ly - R;
  const x1 = lx + R;
  const y1 = ly + R;
  const segs: number[] = [];
  const push = (ax: number, ay: number, bx: number, by: number) => {
    segs.push(ax, ay, bx, by);
  };
  push(x0, y0, x1, y0);
  push(x1, y0, x1, y1);
  push(x1, y1, x0, y1);
  push(x0, y1, x0, y0);
  push(0, 0, W, 0);
  push(W, 0, W, H);
  push(W, H, 0, H);
  push(0, H, 0, 0);
  for (const r of rects) {
    if (r.x < x1 && r.x + r.w > x0 && r.y < y1 && r.y + r.h > y0) {
      push(r.x, r.y, r.x + r.w, r.y);
      push(r.x + r.w, r.y, r.x + r.w, r.y + r.h);
      push(r.x + r.w, r.y + r.h, r.x, r.y + r.h);
      push(r.x, r.y + r.h, r.x, r.y);
    }
  }
  const angles: number[] = [];
  for (let i = 0; i < segs.length; i += 4) {
    const a = Math.atan2(segs[i + 1] - ly, segs[i] - lx);
    angles.push(a - 0.0002, a, a + 0.0002);
  }
  angles.sort((a, b) => a - b);
  const pts: number[] = [];
  for (const a of angles) {
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = Infinity;
    for (let i = 0; i < segs.length; i += 4) {
      const ax = segs[i];
      const ay = segs[i + 1];
      const sx = segs[i + 2] - ax;
      const sy = segs[i + 3] - ay;
      const den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-9) continue;
      const t = ((ax - lx) * sy - (ay - ly) * sx) / den;
      const u = ((ax - lx) * dy - (ay - ly) * dx) / den;
      if (t >= 0 && u >= -1e-6 && u <= 1 + 1e-6 && t < best) best = t;
    }
    if (best === Infinity) best = R;
    pts.push(lx + dx * best, ly + dy * best);
  }
  return pts;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Game {
  private ctx: CanvasRenderingContext2D;
  private S: number;
  private audio: AudioEngine;
  private onEvent: (e: GameEvent) => void;
  private levelIndex: number;
  private raf = 0;
  private lastT = 0;
  private paused = false;
  private destroyed = false;

  // world
  private blocks: Rect[] = [];
  private occ: Rect[] = [];
  private lights: LightState[] = [];
  private movers: MoverState[] = [];
  private shards: Shard[] = [];
  private levers: Lever[] = [];
  private checkpoints: Checkpoint[] = [];
  private exit = { x: 0, y: 0 };
  private spawn = { x: 0, y: 0 };

  // player
  private p = { x: 0, y: 0, w: 16, h: 28, vx: 0, vy: 0, onGround: false, face: 1 };
  private pstate: PState = "alive";
  private essence = 100;
  private threads = 4;
  private deaths = 0;
  private time = 0; // gameplay time
  private clock = 0; // wall time that advances while unpaused
  private stateT = 0;
  private coyote = 0;
  private jumpBuf = 0;
  private jumping = false;
  private dashT = 0;
  private dashCd = 0;
  private dashDir = 1;
  private invuln = 0;
  private expSmooth = 0;
  private anim = 0;
  private squash = 0;
  private stepT = 0;
  private shake = 0;
  private lowWarnT = 0;
  private eventSent = false;
  private usePrompt: string | null = null;

  private keys: Record<KeyName, boolean> = { left: false, right: false, jump: false, dash: false, use: false };
  private pressed = { jump: false, dash: false, use: false };

  private particles: Particle[] = [];
  private noisePattern: CanvasPattern | null = null;
  private bgGrad: CanvasGradient | null = null;

  private onKeyDown = (e: KeyboardEvent) => this.handleKey(e, true);
  private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);
  private onBlur = () => {
    this.keys = { left: false, right: false, jump: false, dash: false, use: false };
  };

  constructor(canvas: HTMLCanvasElement, levelIndex: number, audio: AudioEngine, onEvent: (e: GameEvent) => void) {
    this.audio = audio;
    this.onEvent = onEvent;
    this.levelIndex = levelIndex;
    const dpr = window.devicePixelRatio || 1;
    this.S = dpr >= 2 ? 2 : 1.5;
    canvas.width = Math.round(W * this.S);
    canvas.height = Math.round(H * this.S);
    const c = canvas.getContext("2d");
    if (!c) throw new Error("Canvas 2D not supported");
    this.ctx = c;
    this.makeNoise();
    this.load();
  }

  // ---------------------------------------------------------------- setup
  private makeNoise() {
    const n = document.createElement("canvas");
    n.width = 128;
    n.height = 128;
    const nc = n.getContext("2d");
    if (!nc) return;
    const img = nc.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 16;
    }
    nc.putImageData(img, 0, 0);
    this.noisePattern = this.ctx.createPattern(n, "repeat");
    const g = this.ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0a0716");
    g.addColorStop(1, "#150d26");
    this.bgGrad = g;
  }

  private load() {
    const def = LEVELS[this.levelIndex];
    this.blocks = [];
    this.shards = [];
    this.levers = [];
    this.checkpoints = [];
    this.particles = [];
    this.lights = [];
    this.movers = [];

    const rows = def.map;
    const solid = (c: number, r: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS && rows[r][c] === "#";
    let open = new Map<string, Rect>();
    for (let r = 0; r < ROWS; r++) {
      const cur = new Map<string, Rect>();
      let c = 0;
      while (c < COLS) {
        if (solid(c, r)) {
          let c2 = c;
          while (c2 + 1 < COLS && solid(c2 + 1, r)) c2++;
          const key = c + "-" + c2;
          const prev = open.get(key);
          if (prev) {
            prev.h += T;
            cur.set(key, prev);
          } else {
            const rc = { x: c * T, y: r * T, w: (c2 - c + 1) * T, h: T };
            this.blocks.push(rc);
            cur.set(key, rc);
          }
          c = c2 + 1;
        } else c++;
      }
      open = cur;
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = rows[r][c];
        const cx = c * T + T / 2;
        const fy = (r + 1) * T;
        if (ch === "P") this.spawn = { x: cx, y: fy };
        else if (ch === "X") this.exit = { x: cx, y: fy };
        else if (ch === "*") this.shards.push({ x: cx, y: r * T + T / 2, got: false, ph: Math.random() * 6 });
        else if (ch === "C") this.checkpoints.push({ x: cx, y: fy, active: false });
        else if (ch >= "1" && ch <= "9") {
          const lv = def.levers?.find((l) => l.ch === ch);
          if (lv) this.levers.push({ x: cx, y: fy, target: lv.target, duration: lv.duration });
        }
      }
    }

    for (const m of def.movers ?? []) {
      const rect = { x: m.x * T, y: m.y * T, w: m.w * T, h: m.h * T };
      this.movers.push({
        def: { ...m, phase: m.phase ?? 0 },
        rect,
        baseX: m.x * T,
        baseY: m.y * T,
      });
    }
    this.occ = [...this.blocks, ...this.movers.map((m) => m.rect)];

    for (const l of def.lights) {
      this.lights.push({
        def: l,
        id: l.id ?? "",
        x: l.x * T,
        y: l.y * T,
        r: l.r * T,
        color: l.color ?? [255, 208, 128],
        cone: !!l.cone,
        angle: l.cone?.dir ?? 0,
        half: (l.cone?.spread ?? Math.PI * 2) / 2,
        cur: 1,
        disabledUntil: 0,
        disabledFor: 1,
        warn: false,
      });
    }

    this.threads = def.threads;
    this.deaths = 0;
    this.time = 0;
    this.clock = 0;
    this.eventSent = false;
    this.pstate = "alive";
    this.stateT = 0;
    this.shake = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.usePrompt = null;
    this.updateWorld(0);
    for (const l of this.lights) l.cur = this.lightTarget(l);
    this.placePlayer();
  }

  private placePlayer() {
    this.p.x = this.spawn.x - this.p.w / 2;
    this.p.y = this.spawn.y - this.p.h;
    this.p.vx = 0;
    this.p.vy = 0;
    this.p.onGround = false;
    this.essence = 100;
    this.invuln = 1.6;
    this.jumpBuf = 0;
    this.coyote = 0;
    this.dashT = 0;
    this.expSmooth = 0;
  }

  // ---------------------------------------------------------------- public API
  start() {
    this.lastT = performance.now();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    const loop = (now: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, (now - this.lastT) / 1000);
      this.lastT = now;
      if (!this.paused) {
        const steps = Math.max(1, Math.ceil(dt / (1 / 90)));
        for (let i = 0; i < steps; i++) this.update(dt / steps);
      }
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.audio.setBurn(0);
  }

  setPaused(p: boolean) {
    this.paused = p;
    if (p) this.audio.setBurn(0);
    this.lastT = performance.now();
  }

  restart() {
    this.load();
    this.audio.sfx("respawn");
  }

  setKey(k: KeyName, down: boolean) {
    if (down && !this.keys[k]) {
      if (k === "jump") this.pressed.jump = true;
      if (k === "dash") this.pressed.dash = true;
      if (k === "use") this.pressed.use = true;
    }
    this.keys[k] = down;
  }

  private handleKey(e: KeyboardEvent, down: boolean) {
    let k: KeyName | null = null;
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        k = "left";
        break;
      case "ArrowRight":
      case "KeyD":
        k = "right";
        break;
      case "ArrowUp":
      case "KeyW":
      case "Space":
        k = "jump";
        break;
      case "ShiftLeft":
      case "ShiftRight":
      case "KeyK":
        k = "dash";
        break;
      case "KeyE":
      case "ArrowDown":
      case "KeyS":
      case "Enter":
        k = "use";
        break;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"].includes(e.code)) e.preventDefault();
    if (k) {
      if (!(down && e.repeat)) this.setKey(k, down);
      return;
    }
    if (!down) return;
    if (e.code === "KeyR" && !e.repeat && !this.paused) this.restart();
    else if ((e.code === "KeyP" || e.code === "Escape") && !e.repeat) this.onEvent({ type: "pause" });
    else if (e.code === "KeyM" && !e.repeat) this.audio.setMuted(!this.audio.muted);
  }

  // ---------------------------------------------------------------- world update
  private lightTarget(l: LightState): number {
    if (l.disabledUntil > this.time) return 0;
    const f = l.def.flicker;
    l.warn = false;
    if (f) {
      const period = f.on + f.off;
      const s = (((this.time + (f.phase ?? 0)) % period) + period) % period;
      if (s < f.on) return 1;
      if (period - s < 0.55) {
        l.warn = true;
        return 0.2 + 0.16 * Math.sin(this.time * 55);
      }
      return 0;
    }
    return 1;
  }

  private updateWorld(dt: number) {
    const t = this.time;
    for (const l of this.lights) {
      const m = l.def.motion;
      if (!m || m.t === "static") {
        l.x = l.def.x * T;
        l.y = l.def.y * T;
      } else if (m.t === "orbit") {
        const a = (t / m.period) * Math.PI * 2 + (m.phase ?? 0);
        l.x = (m.cx + m.rx * Math.cos(a)) * T;
        l.y = (m.cy + m.ry * Math.sin(a)) * T;
      } else if (m.t === "patrol") {
        const s = (1 - Math.cos((t / m.period) * Math.PI * 2 + (m.phase ?? 0))) / 2;
        l.x = lerp(m.x1, m.x2, s) * T;
        l.y = lerp(m.y1, m.y2, s) * T;
      } else if (m.t === "pendulum") {
        const th = m.amp * Math.sin((t / m.period) * Math.PI * 2 + (m.phase ?? 0));
        l.x = (m.px + m.len * Math.sin(th)) * T;
        l.y = (m.py + m.len * Math.cos(th)) * T;
      }
      const c = l.def.cone;
      if (c) {
        l.angle = c.dir + (c.sweep ?? 0) * Math.sin((t / (c.sweepPeriod ?? 5)) * Math.PI * 2 + (c.sweepPhase ?? 0));
      }
      const tgt = this.lightTarget(l);
      l.cur = dt > 0 ? lerp(l.cur, tgt, Math.min(1, dt * 18)) : tgt;
    }
    for (const m of this.movers) {
      const a = (t / m.def.period) * Math.PI * 2 + m.def.phase;
      m.rect.x = m.baseX + Math.sin(a) * m.def.dx * T;
      m.rect.y = m.baseY + Math.cos(a * 0.8) * m.def.dy * T;
    }
  }

  private computeExposure(): number {
    const p = this.p;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const samples: [number, number][] = [
      [cx, p.y + 3],
      [cx, cy],
      [cx, p.y + p.h - 3],
      [p.x + 2, cy],
      [p.x + p.w - 2, cy],
    ];
    let total = 0;
    for (const [sx, sy] of samples) {
      let best = 0;
      for (const l of this.lights) {
        if (l.cur < 0.5) continue;
        const dx = sx - l.x;
        const dy = sy - l.y;
        const d = Math.hypot(dx, dy);
        if (d > l.r) continue;
        let f = clamp((1 - d / l.r) / 0.35, 0, 1) * l.cur;
        if (l.cone) {
          let diff = Math.atan2(dy, dx) - l.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          f *= clamp((l.half - Math.abs(diff)) / (l.half * 0.3), 0, 1);
        }
        if (f <= best) continue;
        let blocked = false;
        for (const r of this.occ) {
          if (segHitsRect(l.x, l.y, sx, sy, r)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) best = f;
      }
      total += best;
    }
    return total / samples.length;
  }

  private emit(n: number, x: number, y: number, o: Partial<Particle> & { spread?: number; speed?: number; up?: number }) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 700) return;
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 80) * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x: x + (Math.random() - 0.5) * (o.spread ?? 0),
        y: y + (Math.random() - 0.5) * (o.spread ?? 0),
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - (o.up ?? 0),
        life: (o.life ?? 0.6) * (0.6 + Math.random() * 0.6),
        max: o.max ?? o.life ?? 0.6,
        size: (o.size ?? 2) * (0.6 + Math.random() * 0.8),
        color: o.color ?? "#9cf4ff",
        g: o.g ?? 0,
        add: o.add ?? true,
      });
    }
  }

  private die() {
    if (this.pstate !== "alive") return;
    this.pstate = "dead";
    this.stateT = 0;
    this.deaths++;
    this.threads--;
    const cx = this.p.x + this.p.w / 2;
    const cy = this.p.y + this.p.h / 2;
    this.emit(36, cx, cy, { speed: 260, life: 1, size: 3, color: "#9cf4ff", g: 300 });
    this.emit(30, cx, cy, { speed: 200, life: 0.9, size: 3, color: "#ffb36b", g: -60 });
    this.shake = 14;
    this.audio.sfx("die");
    this.audio.setBurn(0);
  }

  private stats(): Stats {
    const got = this.shards.filter((s) => s.got).length;
    const total = this.shards.length;
    let stars = 1;
    if (got === total) stars++;
    if (this.deaths === 0) stars++;
    return { time: this.time, deaths: this.deaths, shards: got, totalShards: total, stars };
  }

  private update(dt: number) {
    this.clock += dt;
    if (this.pstate === "alive") this.time += dt;
    this.updateWorld(dt);
    this.stateT += dt;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.squash *= Math.max(0, 1 - dt * 12);
    if (this.dashCd > 0) this.dashCd -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    const p = this.p;

    if (this.pstate === "alive") {
      this.updatePlayer(dt);
    } else if (this.pstate === "dead") {
      if (this.stateT > 1.15) {
        if (this.threads <= 0) {
          this.pstate = "lost";
          this.stateT = 0;
          this.audio.sfx("lose");
          if (!this.eventSent) {
            this.eventSent = true;
            this.onEvent({ type: "lose", stats: this.stats() });
          }
        } else {
          this.pstate = "alive";
          this.stateT = 0;
          this.placePlayer();
          this.audio.sfx("respawn");
          this.emit(24, p.x + p.w / 2, p.y + p.h / 2, { speed: 120, life: 0.8, size: 2.5, color: "#9cf4ff" });
        }
      }
    } else if (this.pstate === "won") {
      this.emit(1, this.exit.x, this.exit.y - 28, { speed: 90, life: 0.8, size: 2.5, color: "#bfffff", spread: 20 });
      if (this.stateT > 1.4 && !this.eventSent) {
        this.eventSent = true;
        this.onEvent({ type: "complete", stats: this.stats() });
      }
    }

    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      q.vy += q.g * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }

    this.pressed.jump = false;
    this.pressed.dash = false;
    this.pressed.use = false;

    this.audio.setBurn(this.pstate === "alive" ? this.expSmooth : 0);
  }

  private updatePlayer(dt: number) {
    const p = this.p;
    const k = this.keys;
    const dir = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    if (dir !== 0) p.face = dir;

    // dash
    if (this.pressed.dash && this.dashCd <= 0 && this.dashT <= 0) {
      this.dashT = 0.17;
      this.dashCd = 0.95;
      this.dashDir = dir !== 0 ? dir : p.face;
      this.audio.sfx("dash");
      this.shake = Math.max(this.shake, 3);
    }

    if (this.dashT > 0) {
      this.dashT -= dt;
      p.vx = this.dashDir * 580;
      p.vy = 0;
      if (Math.random() < 0.8) {
        this.emit(1, p.x + p.w / 2, p.y + p.h / 2 + (Math.random() - 0.5) * 16, {
          speed: 20,
          life: 0.35,
          size: 3,
          color: "#9cf4ff",
        });
      }
    } else {
      const target = dir * 225;
      const acc = dir === 0 ? 2800 : p.onGround ? 2600 : 1600;
      if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt);
      else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
      p.vy = Math.min(900, p.vy + 1900 * dt);
    }

    // jump
    if (p.onGround) this.coyote = 0.09;
    else this.coyote -= dt;
    if (this.pressed.jump) this.jumpBuf = 0.12;
    else this.jumpBuf -= dt;
    if (this.jumpBuf > 0 && this.coyote > 0) {
      p.vy = -640;
      this.jumpBuf = 0;
      this.coyote = 0;
      this.jumping = true;
      this.squash = -0.18;
      this.audio.sfx("jump");
      this.emit(5, p.x + p.w / 2, p.y + p.h, { speed: 50, life: 0.4, size: 2, color: "#6a5d9a", g: 40, add: false });
    }
    if (!k.jump && this.jumping && p.vy < -210) p.vy = -210;
    if (p.vy >= 0) this.jumping = false;

    // move + collide
    const wasGround = p.onGround;
    const preVy = p.vy;
    p.x += p.vx * dt;
    for (const r of this.blocks) {
      if (p.x < r.x + r.w && p.x + p.w > r.x && p.y < r.y + r.h && p.y + p.h > r.y) {
        if (p.vx > 0 || (p.vx === 0 && p.x + p.w / 2 < r.x + r.w / 2)) p.x = r.x - p.w;
        else p.x = r.x + r.w;
        if (this.dashT > 0) this.dashT = 0;
        p.vx = 0;
      }
    }
    p.y += p.vy * dt;
    p.onGround = false;
    for (const r of this.blocks) {
      if (p.x < r.x + r.w && p.x + p.w > r.x && p.y < r.y + r.h && p.y + p.h > r.y) {
        if (p.vy > 0 || (p.vy === 0 && p.y + p.h / 2 < r.y + r.h / 2)) {
          p.y = r.y - p.h;
          p.onGround = true;
        } else p.y = r.y + r.h;
        p.vy = 0;
      }
    }
    p.x = clamp(p.x, 0, W - p.w);
    if (p.y > H + 60) {
      this.die();
      return;
    }

    if (p.onGround && !wasGround && preVy > 280) {
      this.squash = clamp(preVy / 2400, 0.08, 0.3);
      this.audio.sfx("land");
      this.emit(6, p.x + p.w / 2, p.y + p.h, { speed: 70, life: 0.4, size: 2, color: "#6a5d9a", g: 30, add: false });
    }

    // animation + footsteps
    const sp = Math.abs(p.vx);
    if (p.onGround && sp > 30) {
      this.anim += dt * sp * 0.055;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = 0.27;
        this.audio.sfx("step");
        this.emit(1, p.x + p.w / 2, p.y + p.h, { speed: 25, life: 0.3, size: 1.6, color: "#5b4f88", g: 20, add: false });
      }
    }

    // light exposure
    const raw = this.computeExposure();
    let e = raw;
    if (this.dashT > 0) e *= 0.25;
    if (this.invuln > 0) e = 0;
    this.expSmooth = lerp(this.expSmooth, e, Math.min(1, dt * 12));
    if (e > 0.04) {
      this.essence -= e * 95 * dt;
      if (Math.random() < e * 0.9) {
        this.emit(1, p.x + p.w / 2, p.y + p.h * Math.random(), {
          speed: 40,
          up: 60,
          life: 0.5,
          size: 2,
          color: Math.random() < 0.5 ? "#ffb36b" : "#ffe9b0",
          spread: 10,
        });
      }
    } else {
      this.essence = Math.min(100, this.essence + 38 * dt);
    }
    if (this.essence < 35 && e > 0.04) {
      this.lowWarnT -= dt;
      if (this.lowWarnT <= 0) {
        this.lowWarnT = 0.28;
        this.audio.sfx("warn");
      }
    }
    if (this.essence <= 0) {
      this.essence = 0;
      this.die();
      return;
    }

    // shards
    for (const s of this.shards) {
      if (s.got) continue;
      const nx = clamp(s.x, p.x, p.x + p.w);
      const ny = clamp(s.y, p.y, p.y + p.h);
      if (Math.hypot(s.x - nx, s.y - ny) < 16) {
        s.got = true;
        this.audio.sfx("shard");
        this.emit(22, s.x, s.y, { speed: 160, life: 0.8, size: 2.5, color: "#e8d9ff" });
      }
    }

    // checkpoints
    for (const c of this.checkpoints) {
      if (Math.abs(p.x + p.w / 2 - c.x) < 22 && Math.abs(p.y + p.h - c.y) < 24) {
        if (!c.active) {
          for (const o of this.checkpoints) o.active = false;
          c.active = true;
          this.spawn = { x: c.x, y: c.y };
          this.audio.sfx("check");
          this.emit(18, c.x, c.y - 20, { speed: 90, life: 0.8, size: 2.5, color: "#9cf4ff", up: 40 });
        }
      }
    }

    // levers
    this.usePrompt = null;
    for (const lv of this.levers) {
      if (Math.abs(p.x + p.w / 2 - lv.x) < 30 && Math.abs(p.y + p.h - lv.y) < 22) {
        const tgt = this.lights.find((l) => l.id === lv.target);
        if (tgt && tgt.disabledUntil <= this.time) {
          this.usePrompt = "E";
          if (this.pressed.use) {
            tgt.disabledUntil = this.time + lv.duration;
            tgt.disabledFor = lv.duration;
            this.audio.sfx("lever");
            this.shake = Math.max(this.shake, 4);
            this.emit(14, lv.x, lv.y - 18, { speed: 100, life: 0.6, size: 2, color: "#ffd98a" });
          }
        }
      }
    }

    // exit
    if (Math.abs(p.x + p.w / 2 - this.exit.x) < 20 && Math.abs(p.y + p.h - this.exit.y) < 30) {
      this.pstate = "won";
      this.stateT = 0;
      this.audio.sfx("win");
      this.audio.setBurn(0);
      this.emit(50, this.exit.x, this.exit.y - 28, { speed: 220, life: 1.1, size: 3, color: "#bfffff" });
    }
  }

  // ---------------------------------------------------------------- render
  private render() {
    const ctx = this.ctx;
    const S = this.S;
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.bgGrad ?? "#0a0716";
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    if (this.shake > 0.1) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);

    this.drawStageDecor();
    for (const l of this.lights) if (l.cur > 0.02) this.drawLight(l);
    this.drawRails();
    this.drawBlocks();
    this.drawMovers();
    this.drawEntities();
    this.drawPlayer();
    this.drawLampBodies();
    this.drawParticles();
    ctx.restore();

    this.drawOverlays();
  }

  private drawStageDecor() {
    const ctx = this.ctx;
    // faint stage curtain folds in the dark
    ctx.save();
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = "#8b7bd8";
    for (let i = 0; i < 12; i++) {
      ctx.fillRect(i * 80 + 10, 0, 2, H);
    }
    ctx.restore();
  }

  private drawLight(l: LightState) {
    const ctx = this.ctx;
    const poly = visPolygon(l.x, l.y, l.r, this.occ);
    const [cr, cg, cb] = l.color;
    const passes = l.cone ? [1, 0.86, 0.72] : [1];
    for (const k of passes) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      if (l.cone) {
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.arc(l.x, l.y, l.r * 1.05, l.angle - l.half * k, l.angle + l.half * k);
        ctx.closePath();
        ctx.clip();
      }
      const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
      const a = l.cur * (l.cone ? 0.42 : 1);
      gr.addColorStop(0, `rgba(${cr},${cg},${cb},${0.95 * a})`);
      gr.addColorStop(0.3, `rgba(${cr},${cg},${cb},${0.72 * a})`);
      gr.addColorStop(0.65, `rgba(${cr},${cg},${cb},${0.34 * a})`);
      gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(poly[0], poly[1]);
      for (let i = 2; i < poly.length; i += 2) ctx.lineTo(poly[i], poly[i + 1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private drawRails() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = "rgba(200,190,255,0.14)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 7]);
    for (const l of this.lights) {
      const m = l.def.motion;
      if (!m) continue;
      ctx.beginPath();
      if (m.t === "orbit") ctx.ellipse(m.cx * T, m.cy * T, m.rx * T, m.ry * T, 0, 0, Math.PI * 2);
      else if (m.t === "patrol") {
        ctx.moveTo(m.x1 * T, m.y1 * T);
        ctx.lineTo(m.x2 * T, m.y2 * T);
      } else if (m.t === "pendulum") {
        ctx.setLineDash([]);
        ctx.strokeStyle = "rgba(200,190,255,0.3)";
        ctx.moveTo(m.px * T, m.py * T);
        ctx.lineTo(l.x, l.y);
        ctx.stroke();
        ctx.setLineDash([4, 7]);
        ctx.strokeStyle = "rgba(200,190,255,0.1)";
        ctx.beginPath();
        ctx.arc(m.px * T, m.py * T, m.len * T, Math.PI / 2 - m.amp, Math.PI / 2 + m.amp);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawBlocks() {
    const ctx = this.ctx;
    for (const r of this.blocks) {
      ctx.fillStyle = "#130f26";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(160,140,255,0.25)";
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      // top edge highlight — a standable surface
      ctx.fillStyle = "rgba(190,175,255,0.35)";
      ctx.fillRect(r.x, r.y, r.w, 2);
      // paper-cut hatch
      ctx.save();
      ctx.beginPath();
      ctx.rect(r.x, r.y, r.w, r.h);
      ctx.clip();
      ctx.strokeStyle = "rgba(120,100,200,0.09)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -r.h; i < r.w; i += 10) {
        ctx.moveTo(r.x + i, r.y + r.h);
        ctx.lineTo(r.x + i + r.h, r.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawMovers() {
    const ctx = this.ctx;
    for (const m of this.movers) {
      const r = m.rect;
      ctx.save();
      // strings
      ctx.strokeStyle = "rgba(220,210,255,0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x + 8, r.y);
      ctx.lineTo(r.x + 8, 0);
      ctx.moveTo(r.x + r.w - 8, r.y);
      ctx.lineTo(r.x + r.w - 8, 0);
      ctx.stroke();
      ctx.fillStyle = "rgba(20,14,40,0.92)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "rgba(150,240,255,0.7)";
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.restore();
    }
  }

  private drawEntities() {
    const ctx = this.ctx;
    const now = this.clock;

    // checkpoints
    for (const c of this.checkpoints) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = "#0e0a1e";
      ctx.strokeStyle = c.active ? "rgba(150,240,255,0.9)" : "rgba(160,140,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-7, 0);
      ctx.lineTo(-5, -16);
      ctx.lineTo(5, -16);
      ctx.lineTo(7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      const fl = c.active ? 1 : 0.25;
      const gr = ctx.createRadialGradient(0, -22, 0, 0, -22, 22);
      gr.addColorStop(0, `rgba(160,245,255,${0.7 * fl})`);
      gr.addColorStop(1, "rgba(160,245,255,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = gr;
      ctx.fillRect(-24, -46, 48, 48);
      ctx.fillStyle = `rgba(200,250,255,${0.9 * fl})`;
      ctx.beginPath();
      ctx.ellipse(0, -21, 2.5, 4.5 + Math.sin(now * 9 + c.x) * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // levers
    for (const lv of this.levers) {
      const tgt = this.lights.find((l) => l.id === lv.target);
      const active = !!tgt && tgt.disabledUntil > this.time;
      ctx.save();
      ctx.translate(lv.x, lv.y);
      ctx.fillStyle = "#0e0a1e";
      ctx.strokeStyle = "rgba(255,217,138,0.75)";
      ctx.lineWidth = 1.5;
      ctx.fillRect(-9, -8, 18, 8);
      ctx.strokeRect(-9, -8, 18, 8);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(active ? 10 : -10, -22);
      ctx.stroke();
      ctx.fillStyle = "#ffd98a";
      ctx.beginPath();
      ctx.arc(active ? 10 : -10, -22, 3.5, 0, Math.PI * 2);
      ctx.fill();
      if (active && tgt) {
        const frac = (tgt.disabledUntil - this.time) / tgt.disabledFor;
        ctx.strokeStyle = "rgba(255,217,138,0.9)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -34, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp(frac, 0, 1));
        ctx.stroke();
      }
      ctx.restore();
    }

    // shards
    for (const s of this.shards) {
      if (s.got) continue;
      const bob = Math.sin(now * 2.4 + s.ph) * 3;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      ctx.globalCompositeOperation = "lighter";
      const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 24);
      gr.addColorStop(0, "rgba(220,200,255,0.65)");
      gr.addColorStop(1, "rgba(220,200,255,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(-24, -24, 48, 48);
      ctx.globalCompositeOperation = "source-over";
      ctx.rotate(now * 1.4 + s.ph);
      ctx.fillStyle = "#f3ebff";
      ctx.strokeStyle = "#8f7bff";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(6, 0);
      ctx.lineTo(0, 9);
      ctx.lineTo(-6, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // exit door
    {
      const e = this.exit;
      ctx.save();
      ctx.translate(e.x, e.y);
      const pulse = 0.75 + Math.sin(now * 3) * 0.15;
      ctx.globalCompositeOperation = "lighter";
      const gr = ctx.createRadialGradient(0, -28, 0, 0, -28, 50);
      gr.addColorStop(0, `rgba(120,230,255,${0.55 * pulse})`);
      gr.addColorStop(1, "rgba(120,230,255,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(-55, -80, 110, 110);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#02010a";
      ctx.strokeStyle = `rgba(150,245,255,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-15, 0);
      ctx.lineTo(-15, -42);
      ctx.arc(0, -42, 15, Math.PI, 0);
      ctx.lineTo(15, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // swirl
      ctx.strokeStyle = `rgba(190,250,255,${0.5 * pulse})`;
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const a0 = now * 2 + i * 2.1;
        ctx.ellipse(0, -28, 5 + i * 2.5, 10 + i * 4, 0, a0, a0 + 2.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // prompt
    if (this.usePrompt && this.pstate === "alive") {
      const p = this.p;
      ctx.save();
      ctx.font = "700 12px Cinzel, Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffe9b0";
      ctx.strokeStyle = "rgba(255,217,138,0.8)";
      const x = p.x + p.w / 2;
      const y = p.y - 16;
      ctx.beginPath();
      ctx.roundRect(x - 34, y - 14, 68, 20, 5);
      ctx.fillStyle = "rgba(10,7,22,0.9)";
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#ffe9b0";
      ctx.fillText("[E] blind", x, y);
      ctx.restore();
    }
  }

  private drawPlayer() {
    const p = this.p;
    const ctx = this.ctx;
    if (this.pstate === "dead" || this.pstate === "lost") return;
    const cx = p.x + p.w / 2;
    const by = p.y + p.h;
    const now = this.clock;
    const burning = this.expSmooth > 0.08;
    let alpha = 0.5 + 0.5 * (this.essence / 100);
    if (this.invuln > 0) alpha *= 0.55 + 0.45 * Math.sin(now * 30);
    if (this.pstate === "won") alpha *= clamp(1 - this.stateT / 1.0, 0, 1);

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);

    // marionette strings
    const sway = Math.sin(now * 1.7) * 5;
    ctx.strokeStyle = "rgba(200,240,255,0.22)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, by - 29);
    ctx.lineTo(cx + sway, 0);
    ctx.moveTo(cx - 7, by - 14);
    ctx.lineTo(cx - 14 + sway, 0);
    ctx.moveTo(cx + 7, by - 14);
    ctx.lineTo(cx + 14 + sway, 0);
    ctx.stroke();

    const speed = Math.abs(p.vx);
    const sw = p.onGround ? (speed > 25 ? Math.sin(this.anim) * 5.5 : 0) : 4;
    const arm = p.onGround ? (speed > 25 ? Math.sin(this.anim + Math.PI) * 4 : 0) : -4;
    const dashStretch = this.dashT > 0 ? 0.25 : 0;

    ctx.translate(cx, by);
    ctx.scale(p.face * (1 + this.squash + dashStretch), 1 - this.squash - dashStretch * 0.4);
    const col = burning ? "#ffb070" : "#9cf4ff";
    ctx.fillStyle = burning && Math.sin(now * 60) > 0 ? "#3a1c10" : "#0b0917";
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 1.7;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    // legs
    ctx.beginPath();
    ctx.moveTo(-3, -9);
    ctx.lineTo(-3 + sw, 0);
    ctx.moveTo(3, -9);
    ctx.lineTo(3 - sw, 0);
    ctx.stroke();
    // torso
    ctx.beginPath();
    ctx.moveTo(-6, -20);
    ctx.lineTo(6, -20);
    ctx.lineTo(4.5, -8);
    ctx.lineTo(-4.5, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // arms
    ctx.beginPath();
    ctx.moveTo(-6, -18);
    ctx.lineTo(-10 - arm * 0.3, -11 + arm);
    ctx.moveTo(6, -18);
    ctx.lineTo(10 + arm * 0.3, -11 - arm);
    ctx.stroke();
    // head
    ctx.beginPath();
    ctx.arc(0, -24, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // eyes
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0.8, -24.5, 1.2, 0, Math.PI * 2);
    ctx.arc(3.3, -24.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawLampBodies() {
    const ctx = this.ctx;
    for (const l of this.lights) {
      ctx.save();
      const [cr, cg, cb] = l.color;
      // cord to ceiling for static / orbit lamps hanging from the top
      if (!l.def.motion || l.def.motion.t !== "pendulum") {
        if (!l.cone && (!l.def.motion || l.def.motion.t === "static") && l.y > 0) {
          ctx.strokeStyle = "rgba(200,190,255,0.3)";
          ctx.beginPath();
          ctx.moveTo(l.x, 0);
          ctx.lineTo(l.x, l.y);
          ctx.stroke();
        }
      }
      if (l.cone) {
        ctx.translate(l.x, l.y);
        ctx.rotate(l.angle);
        ctx.fillStyle = "#1b1533";
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.8)`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-10, -6);
        ctx.lineTo(10, -10);
        ctx.lineTo(10, 10);
        ctx.lineTo(-10, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.rotate(-l.angle);
        ctx.translate(-l.x, -l.y);
      }
      const on = l.cur;
      ctx.globalCompositeOperation = "lighter";
      const gr = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 34);
      gr.addColorStop(0, `rgba(255,255,255,${0.95 * on})`);
      gr.addColorStop(0.25, `rgba(${cr},${cg},${cb},${0.7 * on})`);
      gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = gr;
      ctx.fillRect(l.x - 34, l.y - 34, 68, 68);
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${0.4 + 0.6 * on})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(l.x, l.y, l.cone ? 4 : 7, 0, Math.PI * 2);
      ctx.stroke();
      if (l.warn) {
        ctx.fillStyle = "rgba(255,200,140,0.6)";
        ctx.beginPath();
        ctx.arc(l.x, l.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawParticles() {
    const ctx = this.ctx;
    for (const q of this.particles) {
      const a = clamp(q.life / q.max, 0, 1);
      ctx.save();
      ctx.globalCompositeOperation = q.add ? "lighter" : "source-over";
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.size * (0.4 + 0.6 * a), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  private drawOverlays() {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    // danger vignette
    const danger = clamp(1 - this.essence / 100, 0, 1) * (this.pstate === "alive" ? 1 : 0);
    const burn = this.expSmooth;
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(${burn > 0.05 ? "120,30,0" : "0,0,0"},${0.55 + danger * 0.3})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    if (burn > 0.05) {
      ctx.fillStyle = `rgba(255,120,40,${0.08 * burn + 0.06 * burn * Math.sin(this.clock * 40)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // paper grain
    if (this.noisePattern) {
      ctx.fillStyle = this.noisePattern;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    const font = "Cinzel, Georgia, serif";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.font = `700 11px ${font}`;
    ctx.fillStyle = "rgba(220,210,255,0.75)";
    ctx.fillText("ESSENCE", 18, 22);
    ctx.fillStyle = "rgba(10,7,22,0.8)";
    ctx.fillRect(18, 28, 170, 10);
    const ef = clamp(this.essence / 100, 0, 1);
    const eg = ctx.createLinearGradient(18, 0, 188, 0);
    eg.addColorStop(0, ef < 0.35 ? "#ff7a4a" : "#6fe6ff");
    eg.addColorStop(1, ef < 0.35 ? "#ffb36b" : "#c9b8ff");
    ctx.fillStyle = eg;
    ctx.fillRect(18, 28, 170 * ef, 10);
    ctx.strokeStyle = "rgba(200,190,255,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(18.5, 28.5, 169, 9);

    // threads
    ctx.fillStyle = "rgba(220,210,255,0.75)";
    ctx.fillText("THREADS", 18, 58);
    const total = LEVELS[this.levelIndex].threads;
    for (let i = 0; i < total; i++) {
      const on = i < this.threads;
      ctx.beginPath();
      ctx.arc(24 + i * 18, 70, 5, 0, Math.PI * 2);
      ctx.fillStyle = on ? "#9cf4ff" : "rgba(120,110,170,0.25)";
      ctx.fill();
      ctx.strokeStyle = on ? "#ffffff" : "rgba(160,150,210,0.4)";
      ctx.stroke();
    }

    // dash
    ctx.fillStyle = "rgba(220,210,255,0.75)";
    ctx.fillText("DASH", 18, 94);
    ctx.fillStyle = "rgba(10,7,22,0.8)";
    ctx.fillRect(18, 99, 80, 5);
    ctx.fillStyle = this.dashCd <= 0 ? "#c9b8ff" : "#5b4f88";
    ctx.fillRect(18, 99, 80 * (1 - clamp(this.dashCd / 0.95, 0, 1)), 5);

    // right side
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(220,210,255,0.85)";
    ctx.font = `700 14px ${font}`;
    const got = this.shards.filter((s) => s.got).length;
    ctx.fillText(`◆ ${got} / ${this.shards.length}`, W - 18, 26);
    const m = Math.floor(this.time / 60);
    const s = Math.floor(this.time % 60);
    ctx.font = `600 12px ${font}`;
    ctx.fillStyle = "rgba(220,210,255,0.6)";
    ctx.fillText(`${m}:${s.toString().padStart(2, "0")}`, W - 18, 46);
    ctx.fillText(`${this.levelIndex + 1} / ${LEVELS.length}`, W - 18, 64);

    // title card
    const def = LEVELS[this.levelIndex];
    if (this.clock < 3) {
      const a = clamp(Math.min(this.clock / 0.6, (3 - this.clock) / 0.8), 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.fillStyle = "#f0e8ff";
      ctx.font = `900 34px ${font}`;
      ctx.shadowColor = "#8f7bff";
      ctx.shadowBlur = 18;
      ctx.fillText(def.name, W / 2, H * 0.36);
      ctx.shadowBlur = 0;
      ctx.font = `italic 500 15px ${font}`;
      ctx.fillStyle = "#bfb3e8";
      ctx.fillText(def.subtitle, W / 2, H * 0.36 + 28);
      ctx.globalAlpha = 1;
    }

    // hints
    const hs = 3.2;
    const dur = 4.6;
    const idx = Math.floor((this.clock - hs) / dur);
    if (idx >= 0 && idx < def.hints.length) {
      const lt = (this.clock - hs) - idx * dur;
      const a = clamp(Math.min(lt / 0.5, (dur - lt) / 0.6), 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = "center";
      ctx.font = `600 15px ${font}`;
      const tw = ctx.measureText(def.hints[idx]).width;
      ctx.fillStyle = "rgba(10,7,22,0.75)";
      ctx.beginPath();
      ctx.roundRect(W / 2 - tw / 2 - 16, H - 66, tw + 32, 34, 8);
      ctx.fill();
      ctx.fillStyle = "#e8defc";
      ctx.fillText(def.hints[idx], W / 2, H - 44);
      ctx.globalAlpha = 1;
    }

    // death flash / fade
    if (this.pstate === "dead" || this.pstate === "lost") {
      const a = clamp(this.stateT / 0.9, 0, 0.55);
      ctx.fillStyle = `rgba(20,4,0,${a})`;
      ctx.fillRect(0, 0, W, H);
      if (this.pstate === "dead") {
        ctx.textAlign = "center";
        ctx.fillStyle = `rgba(255,190,140,${clamp(this.stateT * 2, 0, 1)})`;
        ctx.font = `700 22px ${font}`;
        ctx.fillText(this.threads > 0 ? "The light found you…" : "The last thread snaps…", W / 2, H / 2);
      }
    }
    if (this.pstate === "won") {
      ctx.fillStyle = `rgba(180,250,255,${clamp(this.stateT / 1.4, 0, 1) * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }
}
