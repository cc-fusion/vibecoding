import { audio } from "../lib/audio";
import { addShake, canExamine, examineObject, G, hintTarget, hurtSanity, notify, P, toast, tutEvent, useHint } from "../lib/store";
import type { Run } from "../lib/store";

export const W = 960;
export const H = 600;
const X0 = 45, X1 = 915, Y0 = 78, Y1 = 560;
const EXIT = { x: 480, y: 574 };

type EType = "wisp" | "hound" | "echo" | "eye" | "boss";
interface Enemy {
  type: EType; x: number; y: number; vx: number; vy: number; r: number;
  t: number; stun: number; state: number; a: number; cd: number; seen: number; hitCD: number; spin: number;
}
interface Bullet { x: number; y: number; vx: number; vy: number; life: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; max: number }
interface Fog { x: number; y: number; r: number; life: number }

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

export class Palace {
  canvas: HTMLCanvasElement | null = null;
  ctx: CanvasRenderingContext2D | null = null;
  cw = W; ch = H; dpr = 1; sc = 1; ox = 0; oy = 0;
  runRef: Run | null = null;
  keys = new Set<string>();
  edge: string[] = [];
  touchE = false;
  px = 480; py = 300; vx = 0; vy = 0; fx = 0; fy = 1;
  dashT = 0; dashCD = 0; inv = 0; pulseCD = 0; moved = 0;
  trail: { t: number; x: number; y: number }[] = [];
  trailT = 0;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  floats: Floater[] = [];
  fog: Fog[] = [];
  rings: { x: number; y: number; r: number; max: number; life: number; color: string }[] = [];
  t = 0;
  room = -1;
  fade = { v: 0, dir: 0, to: -2, tick: 0 };
  chan = { id: "", p: 0, tick: 0 };
  target: { x: number; y: number } | null = null;
  autoObj = "";
  spawnT = 3;
  bossCD = 2;
  msgCD = 0;
  nearId = "";
  nearName = "";
  nearBlocked = false;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
  }
  detach() {
    this.canvas = null;
    this.ctx = null;
    this.keys.clear();
    this.edge = [];
  }

  resize(w: number, h: number) {
    if (!this.canvas) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(100, w);
    this.ch = Math.max(100, h);
    this.canvas.width = Math.floor(this.cw * this.dpr);
    this.canvas.height = Math.floor(this.ch * this.dpr);
    this.sc = Math.min(this.cw / W, this.ch / H);
    this.ox = (this.cw - W * this.sc) / 2;
    this.oy = (this.ch - H * this.sc) / 2;
  }

  keyDown(code: string, repeat: boolean) {
    this.keys.add(code);
    if (!repeat) this.edge.push(code);
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  clearInput() {
    this.keys.clear();
    this.edge = [];
    this.touchE = false;
  }

  pointer(cx: number, cy: number) {
    const run = G.run;
    if (!run || this.fade.dir !== 0) return;
    const x = (cx - this.ox) / this.sc;
    const y = (cy - this.oy) / this.sc;
    if (x < 0 || y < 0 || x > W || y > H) return;
    this.target = { x: Math.max(X0, Math.min(X1, x)), y: Math.max(Y0, Math.min(Y1, y)) };
    this.autoObj = "";
    if (this.room >= 0) {
      const o = run.def.rooms[this.room].objects.find((q) => Math.hypot(q.x - x, q.y - y) < 42 && !run.searched[q.id]);
      if (o) {
        this.autoObj = o.id;
        this.target = { x: o.x, y: o.y + 28 };
      }
    }
  }

  hubDoors(run: Run) {
    const n = run.def.rooms.length;
    return run.def.rooms.map((_, i) => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return { x: 480 + Math.cos(a) * 345, y: 315 + Math.sin(a) * 195, room: i };
    });
  }

  reset(run: Run) {
    this.runRef = run;
    this.room = -1;
    run.room = -1;
    this.px = 480; this.py = 315; this.vx = 0; this.vy = 0;
    this.enemies = []; this.bullets = []; this.particles = []; this.floats = []; this.fog = []; this.rings = [];
    this.trail = [];
    this.chan = { id: "", p: 0, tick: 0 };
    this.target = null;
    this.autoObj = "";
    this.fade = { v: 1, dir: -1, to: -2, tick: 0 };
    this.moved = 0;
    this.dashT = 0; this.dashCD = 0; this.inv = 1; this.pulseCD = 0;
  }

  travel(room: number) {
    const run = G.run;
    if (!run || this.fade.dir !== 0) return;
    if (room === this.room) return;
    if (run.focus < 3) { toast("Too drained to fast-travel (3 Focus).", "bad"); return; }
    run.focus -= 3;
    this.fade = { v: 0, dir: 1, to: room, tick: 0 };
    audio.play("door");
  }

  private avail(run: Run): EType[] {
    const i = run.def.idx;
    const a: EType[] = ["wisp"];
    if (i >= 1) a.push("hound", "wisp");
    if (i >= 3) a.push("echo");
    if (i >= 4) a.push("eye");
    return a;
  }

  private target_count(run: Run) {
    if (run.mode === "tutorial" || this.room < 0) return 0;
    const base = 1 + run.def.idx * 0.4;
    const clar = run.clarity[this.room] ?? 100;
    const mult = 0.5 + ((100 - clar) / 100) * 1.1 + ((100 - run.sanity) / 160);
    let n = Math.round(base * mult * P().enemy);
    if (run.def.boss && this.room === run.def.bossRoom && !run.bossDown) n = Math.min(n, 2);
    return Math.max(0, Math.min(9, n));
  }

  private mk(type: EType, x: number, y: number): Enemy {
    const r = type === "boss" ? 38 : type === "eye" ? 18 : type === "hound" ? 16 : 14;
    return { type, x, y, vx: 0, vy: 0, r, t: Math.random() * 10, stun: 0, state: 0, a: Math.random() * 6.28, cd: 2, seen: 0, hitCD: 0, spin: 0 };
  }

  private spawnPos() {
    for (let i = 0; i < 30; i++) {
      const x = rnd(X0 + 40, X1 - 40);
      const y = rnd(Y0 + 40, Y1 - 60);
      if (Math.hypot(x - this.px, y - this.py) > 280 && !this.hitFurn(x, y, 20)) return { x, y };
    }
    return { x: 200, y: 200 };
  }

  private populate(run: Run) {
    this.enemies = [];
    this.bullets = [];
    this.fog = [];
    if (this.room < 0 || run.mode === "tutorial") return;
    const av = this.avail(run);
    const n = this.target_count(run);
    for (let i = 0; i < n; i++) {
      const p = this.spawnPos();
      this.enemies.push(this.mk(av[Math.floor(Math.random() * av.length)], p.x, p.y));
    }
    if (run.def.idx >= 2) {
      const f = 1 + (Math.random() < 0.5 ? 1 : 0) + (run.clarity[this.room] < 40 ? 1 : 0);
      for (let i = 0; i < f; i++) {
        const p = this.spawnPos();
        this.fog.push({ x: p.x, y: p.y, r: rnd(60, 85), life: 1 });
      }
    }
    if (run.def.boss && this.room === run.def.bossRoom && !run.bossDown) {
      const b = this.mk("boss", 480, 190);
      b.cd = 2.5;
      this.enemies.push(b);
      audio.play("boss");
      toast("The Architect's Phantom guards this room! Use Pulse (Q) when close.", "bad");
    }
  }

  private hitFurn(x: number, y: number, r: number) {
    const run = G.run;
    if (!run || this.room < 0) return false;
    return run.def.rooms[this.room].furn.some((f) => x > f.x - r && x < f.x + f.w + r && y > f.y - r && y < f.y + f.h + r);
  }

  private moveP(dx: number, dy: number) {
    const run = G.run;
    const R = 12;
    let nx = this.px + dx;
    let ny = this.py + dy;
    nx = Math.max(X0 + R, Math.min(X1 - R, nx));
    ny = Math.max(Y0 + R, Math.min(Y1 - R, ny));
    if (run && this.room >= 0) {
      for (const f of run.def.rooms[this.room].furn) {
        const cx = Math.max(f.x, Math.min(nx, f.x + f.w));
        const cy = Math.max(f.y, Math.min(ny, f.y + f.h));
        const d = Math.hypot(nx - cx, ny - cy);
        if (d < R) {
          if (d > 0.001) {
            nx = cx + ((nx - cx) / d) * R;
            ny = cy + ((ny - cy) / d) * R;
          } else {
            ny = f.y - R;
          }
        }
      }
    }
    this.px = nx;
    this.py = ny;
  }

  burst(x: number, y: number, color: string, n: number, speed = 120, size = 3) {
    for (let i = 0; i < n && this.particles.length < 600; i++) {
      const a = Math.random() * 6.283;
      const s = rnd(speed * 0.3, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.4, 0.9), max: 0.9, color, size: rnd(size * 0.5, size) });
    }
  }
  float(x: number, y: number, text: string, color = "#fff") {
    if (this.floats.length > 30) this.floats.shift();
    this.floats.push({ x, y, text, color, life: 1.4, max: 1.4 });
  }

  private pulse(run: Run) {
    const p = P();
    if (this.pulseCD > 0) return;
    if (run.focus < p.pulseCost) { this.float(this.px, this.py - 30, "Not enough Focus", "#fca5a5"); return; }
    run.focus -= p.pulseCost;
    this.pulseCD = 2.2;
    run.stats.pulses++;
    const R = p.pulseR;
    this.rings.push({ x: this.px, y: this.py, r: 10, max: R, life: 0.55, color: "#7dd3fc" });
    audio.play("pulse");
    addShake(3);
    this.burst(this.px, this.py, "#7dd3fc", 24, 220, 3);
    let refund = 0;
    this.bullets = this.bullets.filter((b) => {
      if (Math.hypot(b.x - this.px, b.y - this.py) < R) {
        refund += 1.2;
        this.burst(b.x, b.y, "#fde68a", 3, 60, 2);
        return false;
      }
      return true;
    });
    if (refund > 0) {
      const g = Math.min(8, refund);
      run.focus = Math.min(run.maxFocus, run.focus + g);
      this.float(this.px, this.py - 34, `+${g.toFixed(0)} Focus`, "#fde68a");
    }
    this.fog = this.fog.filter((f) => {
      if (Math.hypot(f.x - this.px, f.y - this.py) < R + f.r * 0.6) {
        this.burst(f.x, f.y, "#cbd5e1", 14, 90, 4);
        this.float(f.x, f.y, "Fog cleared", "#e2e8f0");
        return false;
      }
      return true;
    });
    if (this.room >= 0) run.clarity[this.room] = Math.min(100, run.clarity[this.room] + 8);
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < R + e.r) {
        e.stun = e.type === "boss" ? 1.6 : 3.2;
        const a = Math.atan2(e.y - this.py, e.x - this.px);
        e.vx = Math.cos(a) * 240;
        e.vy = Math.sin(a) * 240;
        if (e.type === "boss") {
          run.bossHp -= 1;
          run.focus = Math.min(run.maxFocus, run.focus + 8);
          this.float(e.x, e.y - 50, `Hit! ${Math.max(0, run.bossHp)} left`, "#fde68a");
          this.burst(e.x, e.y, "#fde68a", 18, 200, 4);
          addShake(7);
          if (run.bossHp <= 0) this.bossDown(run, e);
        }
      }
    }
    if (run.mode === "tutorial") tutEvent("pulse");
  }

  private bossDown(run: Run, e: Enemy) {
    run.bossDown = true;
    this.enemies = this.enemies.filter((x) => x !== e);
    this.bullets = [];
    this.burst(e.x, e.y, "#fbbf24", 90, 380, 6);
    this.burst(e.x, e.y, "#a78bfa", 60, 300, 5);
    addShake(18);
    audio.play("bossdown");
    toast("The Architect is banished! The sealed evidence is now reachable.", "good");
    notify();
  }

  private hurtP(dmg: number, srcX: number, srcY: number, knock = 260) {
    const run = G.run;
    if (!run || this.inv > 0) return;
    hurtSanity(dmg);
    this.inv = 0.9;
    this.chan.p = 0;
    const a = Math.atan2(this.py - srcY, this.px - srcX);
    this.vx = Math.cos(a) * knock;
    this.vy = Math.sin(a) * knock;
    this.burst(this.px, this.py, "#f87171", 12, 160, 3);
    this.float(this.px, this.py - 24, `-${(dmg * P().dmg).toFixed(0)} Sanity`, "#fca5a5");
  }

  private trailAt(t: number) {
    for (let i = this.trail.length - 1; i >= 0; i--) if (this.trail[i].t <= t) return this.trail[i];
    return null;
  }

  update(rawDt: number) {
    const run = G.run;
    if (!run || run.over) return;
    if (this.runRef !== run) this.reset(run);
    const dt = Math.min(rawDt, 0.05);
    this.t += dt;
    const p = P();

    // fade transitions
    if (this.fade.dir !== 0) {
      this.fade.v += this.fade.dir * dt * 5;
      if (this.fade.dir > 0 && this.fade.v >= 1) {
        this.fade.v = 1;
        const to = this.fade.to;
        const from = this.room;
        this.room = to;
        run.room = to;
        if (to === -1) {
          const d = this.hubDoors(run).find((q) => q.room === from);
          if (d) {
            const a = Math.atan2(315 - d.y, 480 - d.x);
            this.px = d.x + Math.cos(a) * 85;
            this.py = d.y + Math.sin(a) * 85;
          } else { this.px = 480; this.py = 315; }
        } else { this.px = 480; this.py = 500; }
        this.vx = 0; this.vy = 0;
        this.target = null; this.autoObj = "";
        this.populate(run);
        this.trail = [];
        this.fade.dir = -1;
        notify();
      } else if (this.fade.dir < 0 && this.fade.v <= 0) {
        this.fade.v = 0;
        this.fade.dir = 0;
      }
    }

    // edge-triggered keys
    const edges = this.edge;
    this.edge = [];
    let wantDash = false;
    for (const k of edges) {
      if (k === "Space") wantDash = true;
      else if (k === "KeyQ") this.pulse(run);
      else if (k === "KeyH") useHint();
    }
    let padX = 0, padY = 0, padE = false;
    try {
      const gp = navigator.getGamepads ? Array.from(navigator.getGamepads()).find((g) => g) : null;
      if (gp) {
        if (Math.abs(gp.axes[0]) > 0.2) padX = gp.axes[0];
        if (Math.abs(gp.axes[1]) > 0.2) padY = gp.axes[1];
        padE = !!gp.buttons[0]?.pressed;
        const b1 = !!gp.buttons[1]?.pressed, b2 = !!gp.buttons[2]?.pressed;
        if (b1 && !this.padB1) wantDash = true;
        if (b2 && !this.padB2) this.pulse(run);
        this.padB1 = b1; this.padB2 = b2;
      }
    } catch { /* gamepad unavailable */ }

    this.dashCD -= dt; this.pulseCD -= dt; this.inv -= dt; this.msgCD -= dt;

    // input vector
    let ix = padX, iy = padY;
    const k = this.keys;
    if (k.has("KeyA") || k.has("ArrowLeft")) ix -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) ix += 1;
    if (k.has("KeyW") || k.has("ArrowUp")) iy -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) iy += 1;
    let mag = Math.hypot(ix, iy);
    if (mag > 0.01) {
      this.target = null;
      this.autoObj = "";
      ix /= Math.max(1, mag);
      iy /= Math.max(1, mag);
      this.fx = ix / (mag || 1); this.fy = iy / (mag || 1);
    } else if (this.target) {
      const dx = this.target.x - this.px, dy = this.target.y - this.py;
      const d = Math.hypot(dx, dy);
      if (d < 10 || (this.autoObj && d < 26)) {
        this.target = null;
        ix = 0; iy = 0;
      } else { ix = dx / d; iy = dy / d; }
    }
    mag = Math.hypot(ix, iy);

    const inFog = this.fog.some((f) => Math.hypot(f.x - this.px, f.y - this.py) < f.r);
    if (wantDash && this.dashCD <= 0 && run.focus >= 3 && this.fade.dir === 0) {
      run.focus -= 3;
      this.dashT = 0.17;
      this.dashCD = 1.1;
      this.inv = Math.max(this.inv, 0.32);
      const dxn = mag > 0.1 ? ix / mag : this.fx, dyn = mag > 0.1 ? iy / mag : this.fy;
      this.vx = dxn * 560; this.vy = dyn * 560;
      run.stats.dashes++;
      audio.play("dash");
      this.burst(this.px, this.py, "#c4b5fd", 10, 90, 3);
    }
    const sp = 195 * p.speed * (inFog ? 0.5 : 1) * (run.sanity < 25 ? 0.9 : 1);
    if (this.dashT > 0) {
      this.dashT -= dt;
    } else {
      this.vx += (ix * sp - this.vx) * Math.min(1, dt * 12);
      this.vy += (iy * sp - this.vy) * Math.min(1, dt * 12);
    }
    if (this.fade.dir === 0) {
      const ox = this.px, oy = this.py;
      this.moveP(this.vx * dt, this.vy * dt);
      const d = Math.hypot(this.px - ox, this.py - oy);
      this.moved += d;
      if (this.moved > 140) tutEvent("move");
    }
    const speedNow = Math.hypot(this.vx, this.vy);

    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.05;
      this.trail.push({ t: this.t, x: this.px, y: this.py });
      if (this.trail.length > 90) this.trail.shift();
    }

    // doors
    if (this.fade.dir === 0) {
      if (this.room === -1) {
        for (const d of this.hubDoors(run)) {
          if (Math.hypot(d.x - this.px, d.y - this.py) < 40) {
            this.fade = { v: 0, dir: 1, to: d.room, tick: 0 };
            audio.play("door");
            break;
          }
        }
      } else if (Math.hypot(EXIT.x - this.px, EXIT.y - this.py) < 44) {
        this.fade = { v: 0, dir: 1, to: -1, tick: 0 };
        audio.play("door");
      }
    }

    // nearest object + examine
    this.nearId = ""; this.nearName = ""; this.nearBlocked = false;
    if (this.room >= 0 && this.fade.dir === 0) {
      const room = run.def.rooms[this.room];
      let best = 70;
      for (const o of room.objects) {
        if (run.searched[o.id]) continue;
        const d = Math.hypot(o.x - this.px, o.y - this.py);
        if (d < best) { best = d; this.nearId = o.id; this.nearName = o.name; }
      }
      if (this.nearId) {
        const o = room.objects.find((q) => q.id === this.nearId)!;
        this.nearBlocked = this.fog.some((f) => Math.hypot(f.x - o.x, f.y - o.y) < f.r);
        const want = k.has("KeyE") || k.has("Enter") || this.touchE || padE || this.autoObj === o.id;
        if (want && speedNow < 45 && !this.nearBlocked) {
          if (this.chan.id !== o.id) this.chan = { id: o.id, p: 0, tick: 0 };
          if (!canExamine()) {
            if (this.msgCD <= 0) { this.float(o.x, o.y - 34, "Exhausted. Wait for Focus.", "#fca5a5"); this.msgCD = 1.4; }
          } else {
            const clar = run.clarity[this.room];
            const need = 0.85 * (clar < 40 ? 1.5 : 1) * (run.sanity < 35 ? 1.2 : 1);
            this.chan.p += dt / need;
            this.chan.tick -= dt;
            if (this.chan.tick <= 0) { this.chan.tick = 0.14; audio.play("tick"); this.burst(o.x, o.y, "#fde68a", 2, 50, 2); }
            if (this.chan.p >= 1) {
              const res = examineObject(this.room, o.id);
              this.chan = { id: "", p: 0, tick: 0 };
              this.autoObj = "";
              if (res.kind === "clue") {
                this.float(o.x, o.y - 36, "CLUE FOUND!", "#fde047");
                this.burst(o.x, o.y, "#fde047", 28, 200, 4);
                this.rings.push({ x: o.x, y: o.y, r: 6, max: 70, life: 0.5, color: "#fde047" });
                addShake(2);
                toast(`Clue: ${res.clue.text}`, "good");
              } else if (res.kind === "empty") {
                this.float(o.x, o.y - 30, "Nothing of note", "#94a3b8");
                this.burst(o.x, o.y, "#64748b", 8, 60, 2);
              } else if (res.kind === "sealed") {
                this.float(o.x, o.y - 30, "Sealed by the Architect", "#c4b5fd");
                toast("This memory is sealed. Banish the Architect first.", "bad");
                audio.play("wrong");
              }
            }
          }
        } else if (this.chan.id === o.id) {
          this.chan.p = Math.max(0, this.chan.p - dt * 1.5);
          if (this.nearBlocked && want && this.msgCD <= 0) { this.float(o.x, o.y - 34, "Fog! Pulse (Q) to clear", "#cbd5e1"); this.msgCD = 1.4; }
        } else if (this.nearBlocked && want && this.msgCD <= 0) {
          this.float(o.x, o.y - 34, "Fog! Pulse (Q) to clear", "#cbd5e1");
          this.msgCD = 1.4;
        }
      } else this.chan = { id: "", p: 0, tick: 0 };
    }

    // enemy spawning
    if (this.room >= 0 && run.mode !== "tutorial" && this.fade.dir === 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = 4.5;
        const tgt = this.target_count(run);
        const cnt = this.enemies.filter((e) => e.type !== "boss").length;
        if (cnt < tgt) {
          const av = this.avail(run);
          const sp = this.spawnPos();
          const e = this.mk(av[Math.floor(Math.random() * av.length)], sp.x, sp.y);
          this.enemies.push(e);
          this.burst(sp.x, sp.y, "#a78bfa", 10, 80, 3);
        }
        if (run.clarity[this.room] < 30 && this.fog.length < 3 && run.def.idx >= 2) {
          const sp = this.spawnPos();
          this.fog.push({ x: sp.x, y: sp.y, r: rnd(60, 80), life: 1 });
        }
      }
    }

    // enemies
    const examining = this.chan.p > 0.02;
    const diffSp = 0.85 + run.def.idx * 0.04;
    for (const e of this.enemies) {
      e.t += dt;
      e.hitCD -= dt;
      const dx = this.px - e.x, dy = this.py - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.stun > 0) {
        e.stun -= dt;
        e.x += e.vx * dt; e.y += e.vy * dt;
        e.vx *= 0.9; e.vy *= 0.9;
      } else if (e.type === "wisp") {
        e.a += (Math.random() - 0.5) * dt * 4;
        let sx = Math.cos(e.a) * 50, sy = Math.sin(e.a) * 50;
        if (d < 230) { sx = (dx / d) * 78 * diffSp; sy = (dy / d) * 78 * diffSp; }
        e.vx += (sx - e.vx) * dt * 3; e.vy += (sy - e.vy) * dt * 3;
        e.x += e.vx * dt; e.y += e.vy * dt;
      } else if (e.type === "hound") {
        if (e.state === 0) {
          e.a += (Math.random() - 0.5) * dt * 3;
          e.x += Math.cos(e.a) * 28 * dt; e.y += Math.sin(e.a) * 28 * dt;
          if (d < 120 || (d < 300 && (examining || speedNow < 20))) { e.state = 1; e.cd = 5; }
        } else if (e.state === 1) {
          const s = (150 + (run.sanity < 40 ? 25 : 0)) * diffSp;
          e.x += (dx / d) * s * dt; e.y += (dy / d) * s * dt;
          e.cd -= dt;
          if (e.cd <= 0 && d > 330) e.state = 0;
        } else {
          e.x -= (dx / d) * 120 * dt; e.y -= (dy / d) * 120 * dt;
          e.cd -= dt;
          if (e.cd <= 0) e.state = 0;
        }
      } else if (e.type === "echo") {
        const tp = this.trailAt(this.t - 1.7);
        if (tp) {
          const ex = tp.x - e.x, ey = tp.y - e.y;
          const ed = Math.hypot(ex, ey);
          if (ed > 4) { const s = Math.min(ed * 4, 230); e.x += (ex / ed) * s * dt; e.y += (ey / ed) * s * dt; }
        }
      } else if (e.type === "eye") {
        e.a = Math.atan2(this.py - e.y, this.px - e.x) * 0 + Math.sin(e.t * 0.7) * 1.3 + (e.state ? 3.14 : 0);
        const ang = Math.atan2(dy, dx);
        let diff = Math.abs(ang - e.a);
        if (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
        if (d < 290 && diff < 0.45 && this.fade.dir === 0) {
          e.seen += dt;
          if (e.seen > 0.4) {
            run.sanity = Math.max(0, run.sanity - 4 * dt * p.dmg);
            G.flash = Math.max(G.flash, 0.25);
          }
          e.cd -= dt;
          if (e.cd <= 0) {
            e.cd = 3;
            this.enemies.push(this.mk("wisp", e.x, e.y));
            this.float(e.x, e.y - 30, "It sees you!", "#fca5a5");
          }
        } else e.seen = Math.max(0, e.seen - dt * 2);
      } else if (e.type === "boss") {
        const phase = run.bossHp > 5 ? 1 : run.bossHp > 2 ? 2 : 3;
        e.x = 480 + Math.cos(e.t * 0.5) * 270;
        e.y = 195 + Math.sin(e.t * 0.9) * 70;
        e.cd -= dt;
        if (e.cd <= 0) {
          if (phase === 1) {
            e.cd = 2.6;
            for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283 + e.t; this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 130, vy: Math.sin(a) * 130, life: 6 }); }
          } else if (phase === 2) {
            e.cd = 2.1;
            const base = Math.atan2(dy, dx);
            for (let i = -1; i <= 1; i++) { const a = base + i * 0.28; this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 5 }); }
            for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283; this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, life: 6 }); }
            if (this.enemies.length < 4) this.enemies.push(this.mk("hound", e.x, e.y));
          } else {
            e.cd = 0.32;
            e.spin += 0.5;
            for (let i = 0; i < 4; i++) { const a = e.spin + (i * 6.283) / 4; this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, life: 5 }); }
          }
          if (this.bullets.length > 260) this.bullets.splice(0, 40);
        }
      }
      e.x = Math.max(X0 + 10, Math.min(X1 - 10, e.x));
      e.y = Math.max(Y0 + 10, Math.min(Y1 - 10, e.y));
      // contact
      if (e.stun <= 0 && e.type !== "eye" && e.hitCD <= 0 && Math.hypot(e.x - this.px, e.y - this.py) < e.r + 11) {
        const dmg = e.type === "hound" ? 10 : e.type === "boss" ? 12 : e.type === "echo" ? 8 : 6;
        if (this.inv <= 0) {
          this.hurtP(dmg, e.x, e.y);
          e.hitCD = 1;
          if (e.type === "hound") { e.state = 2; e.cd = 2; }
        }
      }
    }

    // bullets
    this.bullets = this.bullets.filter((b) => {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < X0 - 20 || b.x > X1 + 20 || b.y < Y0 - 20 || b.y > Y1 + 20) return false;
      if (this.inv <= 0 && Math.hypot(b.x - this.px, b.y - this.py) < 12) {
        this.hurtP(7, b.x, b.y, 160);
        return false;
      }
      return true;
    });

    // particles / floats / rings
    this.particles = this.particles.filter((q) => {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.96; q.vy *= 0.96;
      return q.life > 0;
    });
    this.floats = this.floats.filter((f) => { f.life -= dt; f.y -= 22 * dt; return f.life > 0; });
    this.rings = this.rings.filter((r) => { r.life -= dt; r.r += (r.max / 0.55) * dt; return r.life > 0; });
    G.shake = Math.max(0, G.shake - dt * 22);
    G.flash = Math.max(0, G.flash - dt * 2.2);
  }
  padB1 = false;
  padB2 = false;

  threat(): number {
    const run = G.run;
    if (!run) return 0;
    let t = (100 - run.sanity) / 140;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < 260) t += e.type === "boss" ? 0.5 : 0.2;
    }
    if (run.dawn < 90 && run.mode !== "tutorial") t += 0.25;
    return Math.min(1, t);
  }

  // ------------------------------------------------------------ render
  private emoji(txt: string, x: number, y: number, size: number, alpha = 1) {
    const c = this.ctx!;
    c.globalAlpha = alpha;
    c.font = `${size}px ${EMOJI_FONT}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(txt, x, y);
    c.globalAlpha = 1;
  }

  render() {
    const c = this.ctx;
    const run = G.run;
    if (!c || !run || !this.canvas) return;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = "#05040a";
    c.fillRect(0, 0, this.cw, this.ch);
    c.save();
    c.translate(this.ox, this.oy);
    c.scale(this.sc, this.sc);
    c.beginPath();
    c.rect(0, 0, W, H);
    c.clip();
    const sh = G.shake;
    if (sh > 0.1) c.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);

    const room = this.room >= 0 ? run.def.rooms[this.room] : null;
    const hue = room ? room.hue : 265;
    const clar = room ? run.clarity[this.room] : 100;
    // floor
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `hsl(${hue},32%,13%)`);
    g.addColorStop(1, `hsl(${hue},28%,8%)`);
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = `hsla(${hue},40%,60%,0.07)`;
    c.lineWidth = 1;
    for (let x = X0; x <= X1; x += 58) { c.beginPath(); c.moveTo(x, Y0); c.lineTo(x, Y1); c.stroke(); }
    for (let y = Y0; y <= Y1; y += 58) { c.beginPath(); c.moveTo(X0, y); c.lineTo(X1, y); c.stroke(); }
    // walls
    c.fillStyle = `hsl(${hue},30%,6%)`;
    c.fillRect(0, 0, W, Y0);
    c.fillRect(0, 0, X0, H);
    c.fillRect(X1, 0, W - X1, H);
    c.fillRect(0, Y1, W, H - Y1);
    c.strokeStyle = `hsla(${hue},60%,65%,0.35)`;
    c.lineWidth = 2;
    c.strokeRect(X0, Y0, X1 - X0, Y1 - Y0);
    c.fillStyle = "#e9e3ff";
    c.font = "600 22px Georgia, serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(room ? room.name : "The Atrium", W / 2, 38);
    c.font = "12px sans-serif";
    c.fillStyle = "rgba(220,210,255,0.55)";
    c.fillText(room ? `Memory clarity ${Math.round(clar)}%` : "Safe haven. Focus and sanity recover faster here.", W / 2, 60);

    // hub decor + doors
    if (!room) {
      c.strokeStyle = "rgba(167,139,250,0.25)";
      for (let i = 1; i <= 3; i++) { c.beginPath(); c.arc(480, 315, i * 55, 0, 6.283); c.stroke(); }
      c.beginPath(); c.moveTo(480, 150); c.lineTo(480, 480); c.moveTo(315, 315); c.lineTo(645, 315); c.stroke();
      for (const d of this.hubDoors(run)) {
        const rm = run.def.rooms[d.room];
        const cl = run.clarity[d.room];
        const col = `hsl(${Math.round(cl * 1.2)},80%,60%)`;
        c.fillStyle = `hsl(${rm.hue},40%,18%)`;
        c.beginPath(); c.arc(d.x, d.y, 30, 0, 6.283); c.fill();
        c.strokeStyle = col; c.lineWidth = 4;
        c.beginPath(); c.arc(d.x, d.y, 34, -Math.PI / 2, -Math.PI / 2 + (cl / 100) * 6.283); c.stroke();
        this.emoji("🚪", d.x, d.y, 28);
        c.fillStyle = "#ece8ff"; c.font = "600 13px sans-serif"; c.textAlign = "center";
        c.fillText(rm.name, d.x, d.y + 50);
        const left = rm.objects.filter((o) => o.clueId && !run.searched[o.id]).length;
        c.fillStyle = "rgba(200,190,240,0.6)"; c.font = "11px sans-serif";
        c.fillText(`${rm.objects.filter((o) => !run.searched[o.id]).length} unsearched${left < 0 ? "" : ""}`, d.x, d.y + 65);
      }
    } else {
      c.fillStyle = `hsl(${hue},40%,16%)`;
      c.beginPath(); c.arc(EXIT.x, EXIT.y - 6, 34, Math.PI, 0); c.fill();
      c.strokeStyle = "rgba(255,255,255,0.4)"; c.lineWidth = 2;
      c.beginPath(); c.arc(EXIT.x, EXIT.y - 6, 34, Math.PI, 0); c.stroke();
      c.fillStyle = "rgba(255,255,255,0.7)"; c.font = "11px sans-serif"; c.textAlign = "center";
      c.fillText("Atrium", EXIT.x, EXIT.y - 40);
      for (const f of room.furn) {
        c.fillStyle = `hsl(${hue},25%,19%)`;
        c.beginPath(); c.roundRect(f.x, f.y, f.w, f.h, 8); c.fill();
        c.fillStyle = `hsla(${hue},40%,70%,0.12)`;
        c.beginPath(); c.roundRect(f.x + 3, f.y + 3, f.w - 6, 8, 4); c.fill();
        c.strokeStyle = `hsla(${hue},40%,70%,0.25)`; c.lineWidth = 1;
        c.beginPath(); c.roundRect(f.x, f.y, f.w, f.h, 8); c.stroke();
      }
      const hint = run.clock < run.hintUntil ? hintTarget(run) : null;
      for (const o of room.objects) {
        const hidden = this.fog.some((f) => Math.hypot(f.x - o.x, f.y - o.y) < f.r * 0.8);
        const done = run.searched[o.id];
        const flick = clar < 40 ? (Math.sin(this.t * 17 + o.x) > 0.3 ? 1 : 0.35) : 1;
        if (!done) {
          const pr = 0.5 + 0.5 * Math.sin(this.t * 3 + o.x);
          const grd = c.createRadialGradient(o.x, o.y, 4, o.x, o.y, 38);
          grd.addColorStop(0, `rgba(253,224,71,${(0.35 + pr * 0.25) * (hidden ? 0.1 : 1)})`);
          grd.addColorStop(1, "rgba(253,224,71,0)");
          c.fillStyle = grd;
          c.beginPath(); c.arc(o.x, o.y, 38, 0, 6.283); c.fill();
        }
        const jx = clar < 25 ? (Math.random() - 0.5) * 3 : 0;
        this.emoji(o.emoji, o.x + jx, o.y, 28, hidden ? 0.1 : done ? 0.3 : flick);
        if (done && o.clueId) { c.fillStyle = "#86efac"; c.font = "bold 13px sans-serif"; c.fillText("✓", o.x + 16, o.y - 14); }
        if (hint && hint.objId === o.id) {
          c.strokeStyle = "#34d399"; c.lineWidth = 3;
          c.beginPath(); c.arc(o.x, o.y, 30 + Math.sin(this.t * 6) * 6, 0, 6.283); c.stroke();
        }
        if (this.nearId === o.id) {
          c.fillStyle = "rgba(10,8,20,0.8)";
          const label = this.nearBlocked ? `${o.name} (fogged)` : `${o.name}  [hold E]`;
          c.font = "600 12px sans-serif";
          const tw = c.measureText(label).width + 14;
          c.beginPath(); c.roundRect(o.x - tw / 2, o.y - 56, tw, 22, 6); c.fill();
          c.fillStyle = "#fde68a"; c.textAlign = "center"; c.fillText(label, o.x, o.y - 45);
          if (this.chan.id === o.id && this.chan.p > 0) {
            c.strokeStyle = "#fde047"; c.lineWidth = 4;
            c.beginPath(); c.arc(o.x, o.y, 26, -Math.PI / 2, -Math.PI / 2 + Math.min(1, this.chan.p) * 6.283); c.stroke();
          }
        }
      }
      if (hint && hint.room !== this.room) {
        c.strokeStyle = "#34d399"; c.lineWidth = 3;
        c.beginPath(); c.arc(EXIT.x, EXIT.y - 6, 40 + Math.sin(this.t * 6) * 5, 0, 6.283); c.stroke();
      }
    }
    if (!room) {
      const hint = run.clock < run.hintUntil ? hintTarget(run) : null;
      if (hint) {
        const d = this.hubDoors(run).find((q) => q.room === hint.room);
        if (d) { c.strokeStyle = "#34d399"; c.lineWidth = 3; c.beginPath(); c.arc(d.x, d.y, 44 + Math.sin(this.t * 6) * 6, 0, 6.283); c.stroke(); }
      }
    }

    // player trail afterimages
    if (this.dashT > 0) {
      for (let i = 1; i <= 3; i++) this.emoji("🕵️", this.px - this.vx * 0.012 * i, this.py - this.vy * 0.012 * i, 28, 0.25 / i);
    }
    // enemies (under player)
    for (const e of this.enemies) this.drawEnemy(c, e);
    // player
    c.fillStyle = "rgba(0,0,0,0.4)";
    c.beginPath(); c.ellipse(this.px, this.py + 13, 12, 5, 0, 0, 6.283); c.fill();
    const blink = this.inv > 0 && Math.floor(this.t * 20) % 2 === 0;
    this.emoji("🕵️", this.px, this.py - 2, 30, blink ? 0.4 : 1);

    // bullets
    for (const b of this.bullets) {
      const gr = c.createRadialGradient(b.x, b.y, 1, b.x, b.y, 10);
      gr.addColorStop(0, "#fff"); gr.addColorStop(0.4, "#f0abfc"); gr.addColorStop(1, "rgba(192,38,211,0)");
      c.fillStyle = gr;
      c.beginPath(); c.arc(b.x, b.y, 10, 0, 6.283); c.fill();
    }
    // fog
    for (const f of this.fog) {
      const gr = c.createRadialGradient(f.x, f.y, 5, f.x, f.y, f.r);
      gr.addColorStop(0, "rgba(203,213,225,0.75)"); gr.addColorStop(0.7, "rgba(148,163,184,0.45)"); gr.addColorStop(1, "rgba(148,163,184,0)");
      c.fillStyle = gr;
      c.beginPath(); c.arc(f.x + Math.sin(this.t + f.x) * 4, f.y, f.r, 0, 6.283); c.fill();
    }
    // rings
    for (const r of this.rings) {
      c.strokeStyle = r.color; c.globalAlpha = Math.max(0, r.life / 0.55); c.lineWidth = 4;
      c.beginPath(); c.arc(r.x, r.y, Math.min(r.r, r.max), 0, 6.283); c.stroke();
      c.globalAlpha = 1;
    }
    for (const q of this.particles) {
      c.globalAlpha = Math.max(0, q.life / q.max);
      c.fillStyle = q.color;
      c.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
    }
    c.globalAlpha = 1;
    for (const f of this.floats) {
      c.globalAlpha = Math.min(1, f.life / (f.max * 0.5));
      c.font = "bold 15px sans-serif"; c.textAlign = "center";
      c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.7)"; c.strokeText(f.text, f.x, f.y);
      c.fillStyle = f.color; c.fillText(f.text, f.x, f.y);
    }
    c.globalAlpha = 1;

    // low clarity static
    if (clar < 50) {
      const n = Math.floor((50 - clar) / 4);
      c.fillStyle = "rgba(200,200,255,0.07)";
      for (let i = 0; i < n; i++) c.fillRect(0, Math.random() * H, W, 1 + Math.random() * 2);
      c.fillStyle = `rgba(30,30,40,${(50 - clar) / 220})`;
      c.fillRect(0, 0, W, H);
    }
    // sanity vignette
    const vs = (100 - run.sanity) / 100;
    const vg = c.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 640);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, `rgba(${Math.round(60 + vs * 120)},0,${Math.round(20 + vs * 10)},${0.55 + vs * 0.4})`);
    c.fillStyle = vg;
    c.fillRect(0, 0, W, H);
    if (G.flash > 0.01) { c.fillStyle = `rgba(220,38,38,${G.flash * 0.35})`; c.fillRect(0, 0, W, H); }
    if (this.fade.v > 0) { c.fillStyle = `rgba(5,4,10,${Math.min(1, this.fade.v)})`; c.fillRect(0, 0, W, H); }
    c.restore();
  }

  private drawEnemy(c: CanvasRenderingContext2D, e: Enemy) {
    const run = G.run!;
    const st = e.stun > 0;
    c.globalAlpha = st ? 0.55 : 1;
    if (e.type === "wisp") {
      const gr = c.createRadialGradient(e.x, e.y, 2, e.x, e.y, 30);
      gr.addColorStop(0, "rgba(196,181,253,0.95)"); gr.addColorStop(0.5, "rgba(124,58,237,0.5)"); gr.addColorStop(1, "rgba(124,58,237,0)");
      c.fillStyle = gr;
      c.beginPath(); c.arc(e.x, e.y + Math.sin(e.t * 5) * 2, 30, 0, 6.283); c.fill();
      c.fillStyle = "#1e1b4b";
      c.fillRect(e.x - 6, e.y - 3, 3, 5); c.fillRect(e.x + 3, e.y - 3, 3, 5);
    } else if (e.type === "hound") {
      c.fillStyle = e.state === 1 ? "#450a0a" : "#1c1917";
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.283 + e.t * 0.5;
        const r = e.r * (i % 2 ? 0.8 : 1.35);
        c.lineTo(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
      }
      c.closePath(); c.fill();
      c.strokeStyle = e.state === 1 ? "#ef4444" : "#57534e"; c.lineWidth = 2; c.stroke();
      c.fillStyle = e.state === 1 ? "#fecaca" : "#a8a29e";
      c.fillRect(e.x - 7, e.y - 4, 4, 4); c.fillRect(e.x + 3, e.y - 4, 4, 4);
    } else if (e.type === "echo") {
      const gr = c.createRadialGradient(e.x, e.y, 2, e.x, e.y, 28);
      gr.addColorStop(0, "rgba(103,232,249,0.5)"); gr.addColorStop(1, "rgba(103,232,249,0)");
      c.fillStyle = gr; c.beginPath(); c.arc(e.x, e.y, 28, 0, 6.283); c.fill();
      this.emoji("🕵️", e.x, e.y, 28, st ? 0.25 : 0.5);
    } else if (e.type === "eye") {
      const hot = e.seen > 0.4;
      const gr = c.createRadialGradient(e.x, e.y, 10, e.x, e.y, 290);
      gr.addColorStop(0, hot ? "rgba(248,113,113,0.4)" : "rgba(250,204,21,0.22)"); gr.addColorStop(1, "rgba(250,204,21,0)");
      if (!st) {
        c.fillStyle = gr;
        c.beginPath(); c.moveTo(e.x, e.y); c.arc(e.x, e.y, 290, e.a - 0.45, e.a + 0.45); c.closePath(); c.fill();
      }
      this.emoji("👁️", e.x, e.y, 34);
    } else if (e.type === "boss") {
      const gr = c.createRadialGradient(e.x, e.y, 10, e.x, e.y, 90);
      gr.addColorStop(0, "rgba(251,191,36,0.55)"); gr.addColorStop(1, "rgba(124,58,237,0)");
      c.fillStyle = gr; c.beginPath(); c.arc(e.x, e.y, 90, 0, 6.283); c.fill();
      c.fillStyle = "#0f0a1e"; c.strokeStyle = "#fbbf24"; c.lineWidth = 3;
      c.beginPath(); c.arc(e.x, e.y, e.r, 0, 6.283); c.fill(); c.stroke();
      this.emoji("🎭", e.x, e.y, 58);
      c.globalAlpha = 1;
      c.fillStyle = "rgba(0,0,0,0.6)"; c.fillRect(e.x - 50, e.y - 62, 100, 8);
      c.fillStyle = "#fbbf24"; c.fillRect(e.x - 50, e.y - 62, Math.max(0, run.bossHp / 8) * 100, 8);
    }
    c.globalAlpha = 1;
    if (st && e.type !== "boss") this.emoji("💫", e.x, e.y - e.r - 12, 16);
  }
}

export const palace = new Palace();
