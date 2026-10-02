import { audio } from "./audio";
import { MECH_INFO } from "./data";
import { Fx } from "./fx";
import { CX, H, Inp, Mech, MechEnv, W } from "./mech/base";
import { createMech } from "./mech";
import type { ConsumableId, HudState, JobResult, JobSpec, Outcome } from "./types";
import { clamp, easeInOut, easeOutBack, lerp, mulberry32, TAU } from "./util";

export interface EngineCallbacks {
  onHud(h: HudState): void;
  onEnd(r: JobResult): void;
  onPauseRequest(): void;
}

const THEME: Record<string, string> = {
  merchants: "#e0b450",
  nobles: "#d0608c",
  underworld: "#46cfa0",
  scholars: "#6aa8ff",
  odd: "#b0a898",
  boss: "#ff5a3a",
};

type State = "intro" | "play" | "clear" | "opening" | "ended";

const GAME_KEYS = new Set([
  "Space",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Tab",
  "Backspace",
  "Enter",
]);

export class Engine {
  private g: CanvasRenderingContext2D;
  private fx = new Fx();
  private raf = 0;
  private last = 0;
  private paused = false;
  private destroyed = false;
  private ro: ResizeObserver | null = null;
  private cw = 960;
  private ch = 560;
  private dpr = 1;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private t = 0;
  private hudAcc = 0;
  private musicAcc = 0;

  // input
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private px = 0;
  private py = 0;
  private pdown = false;
  private pdownEdge = false;
  private pupEdge = false;
  private wheel = 0;
  private moved = false;
  private hideKey = false;
  private hideUi = false;

  // job state
  private state: State = "intro";
  private stateT = 1.1;
  private stageIdx = 0;
  private mech: Mech | null = null;
  private noise = 0;
  private peak = 0;
  private time: number;
  private timeMax: number;
  private elapsed = 0;
  private picksLeft: number;
  private dur: number;
  private durMax: number;
  private faults = 0;
  private picksBroken = 0;
  private stagesDone = 0;
  private items: Record<ConsumableId, number>;
  private used: Record<ConsumableId, number> = { oil: 0, smoke: 0, sand: 0, skeleton: 0 };
  private oilT = 0;
  private skeletonUsed = false;
  private hidden = false;
  private patrol: "none" | "warn" | "pass" = "none";
  private patrolT = 0;
  private patrolMax = 1;
  private nextPatrol: number;
  private exposed = 0;
  private stepT = 0;
  private dodged = 0;
  private caught = 0;
  private practiceDone = false;
  private pending: JobResult | null = null;
  private pendingT = 0;
  private lowTimeSec = 99;
  private redFlash = 0;
  private theme: string;
  private boundHandlers: Array<() => void> = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private spec: JobSpec,
    private cb: EngineCallbacks,
  ) {
    this.g = canvas.getContext("2d")!;
    this.fx.enableShake = spec.shake;
    this.fx.density = spec.particles ? 1 : 0.35;
    this.time = spec.timeLimit;
    this.timeMax = spec.timeLimit;
    this.picksLeft = spec.picks;
    this.durMax = spec.pickDur;
    this.dur = spec.pickDur;
    this.items = { ...spec.items };
    this.nextPatrol = spec.patrolInterval * 0.75;
    this.theme = THEME[spec.theme] || "#d6a84c";
    this.bind();
    this.resize();
    this.initStage(0);
    this.raf = requestAnimationFrame(this.loop);
  }

  /* ------------------------------ lifecycle ------------------------------ */

  private on(t: EventTarget, ev: string, fn: (e: never) => void, opts?: AddEventListenerOptions): void {
    t.addEventListener(ev, fn as EventListener, opts);
    this.boundHandlers.push(() => t.removeEventListener(ev, fn as EventListener, opts));
  }

  private bind() {
    const c = this.canvas;
    this.on(window, "keydown", (e: KeyboardEvent) => this.onKeyDown(e));
    this.on(window, "keyup", (e: KeyboardEvent) => this.onKeyUp(e));
    this.on(window, "blur", () => {
      this.keys.clear();
      this.hideKey = false;
      this.pdown = false;
      if (!this.paused && this.state !== "ended") this.cb.onPauseRequest();
    });
    this.on(document, "visibilitychange", () => {
      if (document.hidden && !this.paused && this.state !== "ended") this.cb.onPauseRequest();
    });
    this.on(c, "pointerdown", (e: PointerEvent) => {
      audio.init();
      this.updatePointer(e);
      this.pdown = true;
      this.pdownEdge = true;
      try {
        c.setPointerCapture(e.pointerId);
      } catch {
        /* pointer capture unsupported */
      }
    });
    this.on(c, "pointermove", (e: PointerEvent) => {
      this.updatePointer(e);
      this.moved = true;
    });
    const up = (e: PointerEvent) => {
      this.updatePointer(e);
      if (this.pdown) this.pupEdge = true;
      this.pdown = false;
    };
    this.on(c, "pointerup", up);
    this.on(c, "pointercancel", up);
    this.on(
      c,
      "wheel",
      (e: WheelEvent) => {
        e.preventDefault();
        this.wheel += Math.sign(e.deltaY);
      },
      { passive: false },
    );
    this.on(c, "contextmenu", (e: Event) => e.preventDefault());
    const parent = c.parentElement;
    if (parent && typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(parent);
    }
    this.on(window, "resize", () => this.resize());
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.boundHandlers.forEach((f) => f());
    this.boundHandlers = [];
    this.ro?.disconnect();
    this.keys.clear();
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.keys.clear();
    this.pressed.clear();
    this.hideKey = false;
    this.pdown = false;
    this.last = 0;
  }

  setHideUi(v: boolean) {
    this.hideUi = v;
  }

  abandon() {
    this.endJob("abandon", 0);
  }

  /* ------------------------------ input ------------------------------ */

  private updatePointer(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.px = (e.clientX - r.left - this.ox) / this.scale;
    this.py = (e.clientY - r.top - this.oy) / this.scale;
  }

  private onKeyDown(e: KeyboardEvent) {
    if (this.paused || this.destroyed) return;
    audio.init();
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!e.repeat) this.cb.onPauseRequest();
      e.preventDefault();
      return;
    }
    if (GAME_KEYS.has(e.code)) {
      e.preventDefault();
      // stop a focused HUD button from re-triggering on Space/Enter
      const ae = document.activeElement as HTMLElement | null;
      if (ae && ae.tagName === "BUTTON") ae.blur();
    }
    if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyH") {
      this.hideKey = true;
      return;
    }
    if (e.repeat) return;
    this.keys.add(e.code);
    this.pressed.add(e.code);
    if (e.code === "KeyQ") this.useItem("oil");
    if (e.code === "KeyE") this.useItem("smoke");
    if (e.code === "KeyR") this.useItem("sand");
    if (e.code === "KeyF") this.useItem("skeleton");
  }

  private onKeyUp(e: KeyboardEvent) {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight" || e.code === "KeyH") this.hideKey = false;
    this.keys.delete(e.code);
  }

  private resize() {
    const p = this.canvas.parentElement;
    const rect = p ? p.getBoundingClientRect() : this.canvas.getBoundingClientRect();
    this.cw = Math.max(200, Math.floor(rect.width));
    this.ch = Math.max(150, Math.floor(rect.height));
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.width = `${this.cw}px`;
    this.canvas.style.height = `${this.ch}px`;
    this.canvas.width = Math.floor(this.cw * this.dpr);
    this.canvas.height = Math.floor(this.ch * this.dpr);
    this.scale = Math.min(this.cw / W, this.ch / H);
    this.ox = (this.cw - W * this.scale) / 2;
    this.oy = (this.ch - H * this.scale) / 2;
  }

  /* ------------------------------ stage flow ------------------------------ */

  private initStage(i: number) {
    this.stageIdx = i;
    const st = this.spec.stages[i];
    const rng = mulberry32(st.seed ^ this.spec.seed);
    const env: MechEnv = {
      tolMul: this.spec.tolMul * (st.affix === "rusted" ? 0.8 : 1),
      hint: this.spec.hint,
      trapped: st.affix === "trapped",
      practice: this.spec.mode === "practice",
      fx: this.fx,
      fault: (n, w, x, y, text) => this.fault(n, w, x, y, text),
      noise: (n) => this.addNoise(n),
      solved: () => this.onSolved(),
    };
    this.mech = createMech(st.type, env, st.level, rng);
    this.state = "intro";
    this.stateT = 1.0;
    this.emitHud();
  }

  private onSolved() {
    if (this.state !== "play") return;
    this.stagesDone++;
    const st = this.spec.stages[this.stageIdx];
    const last = this.stageIdx >= this.spec.stages.length - 1;
    this.fx.burst(CX, 290, 40, "#ffe08a", 320, 0.9, 320);
    this.fx.sparks(CX, 290, 20);
    this.fx.doFlash("#ffe9a8", 0.45);
    this.fx.addShake(5);
    if (this.spec.mode === "practice") {
      audio.stageClear();
      this.practiceDone = true;
      this.state = "ended";
      this.fx.text(CX, 90, "LOCK OPENED!", "#9dffba", 32);
      this.emitHud();
      return;
    }
    if (st.affix === "alarmed" && this.spec.patrolEnabled && this.patrol === "none") {
      this.nextPatrol = Math.min(this.nextPatrol, 1.2);
      this.fx.text(CX, 120, "ALARM TRIPPED — guard incoming!", "#ff9a7a", 18);
    }
    if (last) {
      this.state = "opening";
      this.stateT = 2.2;
      audio.vaultOpen();
      this.fx.addShake(10);
    } else {
      this.state = "clear";
      this.stateT = 1.0;
      audio.stageClear();
      this.fx.text(CX, 120, `LOCK ${this.stageIdx + 1} OPEN`, "#9dffba", 26);
    }
    this.emitHud();
  }

  /* ------------------------------ systems ------------------------------ */

  private addNoise(n: number) {
    if (n <= 0) return;
    const practice = this.spec.mode === "practice";
    const v = n * this.spec.noiseMul * (this.oilT > 0 ? 0.6 : 1) * (practice ? 0.3 : 1);
    this.noise = Math.min(practice ? 80 : 100, this.noise + v);
    this.peak = Math.max(this.peak, this.noise);
  }

  private fault(n: number, wear: number, x: number, y: number, text?: string) {
    const trapped = this.spec.stages[this.stageIdx]?.affix === "trapped";
    this.addNoise(n * (trapped ? 2 : 1));
    this.faults++;
    this.fx.text(x, y, text || "FAULT", "#ff8a7a", 20);
    this.fx.sparks(x, y + 14, 8, "#ff9a7a");
    this.fx.addShake(5);
    this.fx.doFlash("#ff3a3a", 0.18);
    this.redFlash = 1;
    audio.fault();
    if (this.spec.mode === "job" && wear > 0) this.wearPick(wear * this.spec.wearMul * (trapped ? 1.5 : 1), x, y);
  }

  private wearPick(w: number, x: number, y: number) {
    this.dur -= w;
    if (this.dur <= 0) {
      this.picksBroken++;
      this.picksLeft--;
      audio.snap();
      this.fx.text(x, y - 34, "PICK SNAPPED!", "#ff6a5a", 24);
      this.fx.burst(x, y, 18, "#cfd6e4", 220, 0.7, 500, true);
      this.fx.addShake(9);
      if (this.picksLeft <= 0) {
        this.endJob("nopicks", 1.0);
      } else {
        this.dur = this.durMax;
      }
    }
  }

  useItem(id: ConsumableId) {
    if (this.spec.mode !== "job" || this.state !== "play" || this.paused) return;
    if (this.items[id] <= 0) {
      this.fx.text(CX, 150, "None left!", "#ffb08a", 16);
      return;
    }
    this.items[id]--;
    this.used[id]++;
    audio.item();
    if (id === "oil") {
      this.noise = Math.max(0, this.noise - 35);
      this.oilT = 20;
      this.fx.text(CX, 150, "Oiled — quieter!", "#9ad0ff", 20);
    } else if (id === "smoke") {
      if (this.patrol !== "none") {
        this.patrol = "none";
        this.dodged++;
      }
      this.nextPatrol = Math.max(this.nextPatrol, 0) + 30;
      this.fx.text(CX, 150, "Smoke! Patrol delayed", "#cfd6e4", 20);
      this.fx.burst(CX, 290, 30, "#9aa3b4", 120, 1.2, -40);
    } else if (id === "sand") {
      this.time += 25;
      this.timeMax = Math.max(this.timeMax, this.time);
      this.fx.text(CX, 150, "+25s", "#ffe08a", 22);
    } else if (id === "skeleton") {
      this.skeletonUsed = true;
      this.fx.text(CX, 150, "Skeleton Key!", "#ffe08a", 22);
      this.mech?.skip();
    }
    this.emitHud();
  }

  private endJob(outcome: Outcome, delay: number) {
    if (this.pending) return;
    const used = { ...this.used };
    this.pending = {
      outcome,
      stagesDone: this.stagesDone,
      stageTotal: this.spec.stages.length,
      faults: this.faults,
      peakNoise: Math.round(this.peak),
      picksBroken: this.picksBroken,
      picksLeft: Math.max(0, this.picksLeft),
      timeLeft: Math.max(0, this.time),
      timeLimit: this.spec.timeLimit,
      timeUsed: this.elapsed,
      itemsUsed: used,
      skeletonUsed: this.skeletonUsed,
      patrolsDodged: this.dodged,
      patrolsCaught: this.caught,
    };
    this.pendingT = delay;
    this.state = "ended";
    if (outcome === "alarm") {
      audio.alarm();
      this.fx.addShake(14);
      this.fx.doFlash("#ff2a2a", 0.7);
      this.fx.text(CX, 200, "ALARM!", "#ff5a4a", 54);
    } else if (outcome === "timeout") {
      audio.lose();
      this.fx.text(CX, 200, "DAWN BREAKS", "#ffb06a", 44);
    } else if (outcome === "nopicks") {
      this.fx.text(CX, 200, "OUT OF PICKS", "#ff8a6a", 40);
    }
    this.emitHud();
  }

  /* ------------------------------ loop ------------------------------ */

  private loop = (ts: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.last) this.last = ts;
    const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    if (!this.paused) this.update(dt);
    this.draw();
    this.hudAcc += dt;
    if (this.hudAcc > 0.09) {
      this.hudAcc = 0;
      this.emitHud();
    }
  };

  private update(dt: number) {
    this.t += dt;
    this.fx.update(dt);
    this.redFlash = Math.max(0, this.redFlash - dt * 2);
    const job = this.spec.mode === "job";

    if (this.pending) {
      this.pendingT -= dt;
      if (this.pendingT <= 0) {
        const r = this.pending;
        this.pending = null;
        this.pendingT = 9999;
        // freeze: keep drawing final frame; engine remains alive until destroyed
        this.cb.onEnd(r);
      }
    }

    const inp: Inp = {
      keys: this.keys,
      pressed: this.pressed,
      px: this.px,
      py: this.py,
      down: this.pdown,
      pdown: this.pdownEdge,
      pup: this.pupEdge,
      wheel: this.wheel,
      moved: this.moved,
    };

    const wantHide = job && (this.hideKey || this.hideUi) && (this.state === "play" || this.state === "intro");
    if (wantHide !== this.hidden) {
      this.hidden = wantHide;
      audio.hide(wantHide);
    }

    if (this.state === "intro") {
      this.stateT -= dt;
      if (this.stateT <= 0) this.state = "play";
    } else if (this.state === "play") {
      this.elapsed += dt;
      this.mech?.update(dt, inp, !this.hidden);
      if (this.state === "play") {
        if (job) {
          this.updateJob(dt);
        } else {
          this.noise = Math.max(0, this.noise - this.spec.noiseDecay * dt);
        }
      }
    } else if (this.state === "clear") {
      this.stateT -= dt;
      this.noise = Math.max(0, this.noise - this.spec.noiseDecay * dt);
      if (this.stateT <= 0) this.initStage(this.stageIdx + 1);
    } else if (this.state === "opening") {
      this.stateT -= dt;
      if (this.stateT <= 0) this.endJob("success", 0.1);
    }

    // reset edge-triggered input
    this.pressed.clear();
    this.pdownEdge = false;
    this.pupEdge = false;
    this.wheel = 0;
    this.moved = false;

    this.musicAcc += dt;
    if (this.musicAcc > 0.25) {
      this.musicAcc = 0;
      const timeFrac = job ? 1 - this.time / Math.max(1, this.timeMax) : 0;
      audio.setIntensity(this.noise / 100 * 0.75 + (this.patrol !== "none" ? 0.25 : 0) + (timeFrac > 0.8 ? 0.2 : 0));
    }
  }

  private updateJob(dt: number) {
    // time
    this.time -= dt;
    const sec = Math.ceil(this.time);
    if (sec <= 10 && sec < this.lowTimeSec && sec > 0) {
      audio.pulse(0.14);
      this.lowTimeSec = sec;
    }
    if (this.time <= 0) {
      this.time = 0;
      this.endJob("timeout", 1.0);
      return;
    }
    // noise decay
    if (this.oilT > 0) this.oilT -= dt;
    this.noise = Math.max(0, this.noise - this.spec.noiseDecay * dt * (this.hidden ? 2 : 1));
    if (this.noise >= 100) {
      this.endJob("alarm", 1.5);
      return;
    }
    // patrols
    if (!this.spec.patrolEnabled) return;
    const timeFrac = 1 - this.time / Math.max(1, this.timeMax);
    if (this.patrol === "none") {
      this.nextPatrol -= dt;
      if (this.nextPatrol <= 0) {
        this.patrol = "warn";
        this.patrolMax = this.patrolT = this.spec.patrolWarn;
        this.stepT = 0;
        audio.patrolWarn();
        this.fx.text(CX, 100, "GUARD APPROACHING — HOLD SHIFT TO HIDE", "#ffcf6a", 18);
      }
    } else if (this.patrol === "warn") {
      this.patrolT -= dt;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        audio.footstep(0.05 + 0.1 * (1 - this.patrolT / this.patrolMax));
        this.stepT = 0.55;
      }
      if (this.patrolT <= 0) {
        this.patrol = "pass";
        this.patrolMax = this.patrolT = 3.2;
        this.exposed = 0;
      }
    } else {
      this.patrolT -= dt;
      this.stepT -= dt;
      if (this.stepT <= 0) {
        audio.footstep(0.18);
        this.stepT = 0.4;
      }
      if (!this.hidden) {
        this.exposed += dt;
        this.noise = Math.min(100, this.noise + 22 * (1 - this.spec.patrolReduce) * dt);
        this.peak = Math.max(this.peak, this.noise);
        if (Math.random() < dt * 4) this.fx.text(CX + (Math.random() - 0.5) * 300, 140, "SPOTTED!", "#ff7a6a", 16);
      }
      if (this.patrolT <= 0) {
        this.patrol = "none";
        if (this.exposed > 0.35) {
          this.caught++;
          this.fx.text(CX, 120, "The guard noticed something…", "#ff9a7a", 18);
        } else {
          this.dodged++;
          this.fx.text(CX, 120, "Guard passed. Safe.", "#9dffba", 18);
        }
        this.nextPatrol = this.spec.patrolInterval * (0.85 + Math.random() * 0.3) * (1 - 0.35 * timeFrac);
      }
    }
  }

  /* ------------------------------ HUD ------------------------------ */

  private emitHud() {
    const st = this.spec.stages[Math.min(this.stageIdx, this.spec.stages.length - 1)];
    this.cb.onHud({
      noise: this.noise,
      time: Math.max(0, this.time),
      timeLimit: this.timeMax,
      stageIdx: this.stageIdx,
      stageCount: this.spec.stages.length,
      stages: this.spec.stages,
      picksLeft: this.picksLeft,
      durability: Math.max(0, this.dur),
      durMax: this.durMax,
      patrol: this.patrol,
      patrolT: this.patrolT,
      patrolMax: this.patrolMax,
      hidden: this.hidden,
      items: { ...this.items },
      oilActive: this.oilT > 0,
      help: this.mech?.help || "",
      mechName: MECH_INFO[st.type].name,
      practiceDone: this.practiceDone,
      nextPatrol: this.nextPatrol,
    });
  }

  /* ------------------------------ rendering ------------------------------ */

  private draw() {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = "#0a090e";
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const sh = this.fx.shake;
    const sx = sh > 0 ? (Math.random() - 0.5) * sh : 0;
    const sy = sh > 0 ? (Math.random() - 0.5) * sh : 0;
    const k = this.dpr * this.scale;
    g.setTransform(k, 0, 0, k, this.dpr * (this.ox + sx), this.dpr * (this.oy + sy));
    this.drawScene(g);
    if (this.mech && this.state !== "opening") {
      g.save();
      g.globalAlpha = this.state === "intro" ? easeInOut(1 - this.stateT / 1.0) : 1;
      this.mech.draw(g, this.t);
      g.restore();
    }
    this.fx.draw(g);
    this.drawOverlays(g);
    if (this.fx.flash > 0) {
      g.fillStyle = this.fx.flashColor;
      g.globalAlpha = this.fx.flash;
      g.fillRect(-1000, -1000, W + 2000, H + 2000);
      g.globalAlpha = 1;
    }
  }

  private drawScene(g: CanvasRenderingContext2D) {
    // wall
    const wg = g.createLinearGradient(0, -500, 0, H + 500);
    wg.addColorStop(0, "#181420");
    wg.addColorStop(0.5, "#100d16");
    wg.addColorStop(1, "#08070b");
    g.fillStyle = wg;
    g.fillRect(-1000, -1000, W + 2000, H + 2000);
    // brick seams
    g.strokeStyle = "rgba(255,255,255,0.03)";
    g.lineWidth = 1;
    for (let r = -8; r < 12; r++) {
      const y = r * 70;
      g.beginPath();
      g.moveTo(-1000, y);
      g.lineTo(W + 1000, y);
      g.stroke();
      for (let c = -10; c < 20; c++) {
        const x = c * 140 + (r % 2 ? 70 : 0);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y + 70);
        g.stroke();
      }
    }
    // door rings (vault feel)
    g.save();
    g.translate(CX, 290);
    g.rotate(this.t * 0.02);
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = `rgba(214,168,76,${0.05 + i * 0.015})`;
      g.lineWidth = 2 + i;
      g.setLineDash([30 + i * 18, 22]);
      g.beginPath();
      g.arc(0, 0, 330 + i * 46, 0, TAU);
      g.stroke();
    }
    g.setLineDash([]);
    g.restore();
    // accent glow
    const ag = g.createRadialGradient(CX, 290, 80, CX, 290, 520);
    ag.addColorStop(0, this.theme + "22");
    ag.addColorStop(1, "transparent");
    g.fillStyle = ag;
    g.fillRect(-1000, -1000, W + 2000, H + 2000);
    // corner bolts
    g.fillStyle = "rgba(214,168,76,0.25)";
    [[24, 24], [W - 24, 24], [24, H - 24], [W - 24, H - 24]].forEach(([x, y]) => {
      g.beginPath();
      g.arc(x, y, 7, 0, TAU);
      g.fill();
    });
    // dawn window
    if (this.spec.mode === "job") {
      const f = clamp(1 - this.time / Math.max(1, this.timeMax), 0, 1);
      const wx = W - 56;
      const wy = 54;
      const sky = g.createLinearGradient(0, wy - 30, 0, wy + 30);
      const c1 = mixColor([10, 14, 42], [255, 150, 90], f);
      const c2 = mixColor([24, 22, 70], [255, 220, 150], f);
      sky.addColorStop(0, c1);
      sky.addColorStop(1, c2);
      g.fillStyle = sky;
      g.beginPath();
      g.arc(wx, wy, 30, 0, TAU);
      g.fill();
      g.strokeStyle = "#6a5222";
      g.lineWidth = 4;
      g.stroke();
      g.save();
      g.beginPath();
      g.arc(wx, wy, 28, 0, TAU);
      g.clip();
      g.fillStyle = f < 0.7 ? "#f4f1e8" : "#fff2b0";
      g.beginPath();
      g.arc(wx - 18 + f * 36, wy + 14 - Math.sin(f * Math.PI) * 24 + f * 12, 6 + f * 4, 0, TAU);
      g.fill();
      g.restore();
      g.fillStyle = "rgba(233,226,208,0.55)";
      g.font = "600 11px Inter, sans-serif";
      g.textAlign = "center";
      g.fillText("DAWN", wx, wy + 46);
    }
  }

  private drawOverlays(g: CanvasRenderingContext2D) {
    // patrol light
    if (this.patrol === "warn") {
      const p = 1 - this.patrolT / this.patrolMax;
      g.fillStyle = `rgba(255,190,90,${0.05 + p * 0.1})`;
      g.fillRect(-1000, -1000, W + 2000, H + 2000);
      const gl = g.createLinearGradient(-20, 0, 120, 0);
      gl.addColorStop(0, `rgba(255,210,120,${0.15 + p * 0.3})`);
      gl.addColorStop(1, "transparent");
      g.fillStyle = gl;
      g.fillRect(-1000, 0, 1120, H);
    } else if (this.patrol === "pass") {
      const p = 1 - this.patrolT / this.patrolMax;
      const x = lerp(-250, W + 250, p);
      g.save();
      g.setTransform(
        this.dpr * this.scale, 0, -0.35 * this.dpr * this.scale, this.dpr * this.scale,
        this.dpr * this.ox, this.dpr * this.oy,
      );
      const bg = g.createLinearGradient(x - 160, 0, x + 160, 0);
      bg.addColorStop(0, "transparent");
      bg.addColorStop(0.5, this.hidden ? "rgba(255,220,140,0.12)" : "rgba(255,230,150,0.38)");
      bg.addColorStop(1, "transparent");
      g.fillStyle = bg;
      g.fillRect(x - 160, -100, 320, H + 200);
      g.restore();
    }
    // noise vignette
    const nz = this.noise / 100;
    if (nz > 0.25 || this.redFlash > 0) {
      const a = (nz > 0.25 ? (nz - 0.25) * (nz > 0.7 ? 0.9 + 0.3 * Math.sin(this.t * 10) : 0.7) : 0) + this.redFlash * 0.2;
      const vg = g.createRadialGradient(CX, 290, 250, CX, 290, 640);
      vg.addColorStop(0, "transparent");
      vg.addColorStop(1, `rgba(200,20,20,${clamp(a, 0, 0.75)})`);
      g.fillStyle = vg;
      g.fillRect(-1000, -1000, W + 2000, H + 2000);
    }
    // hiding
    if (this.hidden) {
      g.fillStyle = "rgba(4,3,8,0.78)";
      g.fillRect(-1000, -1000, W + 2000, H + 2000);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#cfd6e4";
      g.font = "700 30px Cinzel, serif";
      g.fillText("HIDING…", CX, 270);
      g.font = "500 15px Inter, sans-serif";
      g.fillStyle = "rgba(233,226,208,0.7)";
      g.fillText("Noise fades twice as fast. The clock keeps ticking.", CX, 306);
      // eyes
      const e = Math.sin(this.t * 2) * 6;
      g.fillStyle = "#ffd98a";
      g.beginPath();
      g.ellipse(CX - 40 + e, 360, 10, 6, 0, 0, TAU);
      g.ellipse(CX + 40 + e, 360, 10, 6, 0, 0, TAU);
      g.fill();
    }
    // stage banner
    if (this.state === "intro" && this.spec.stages.length > 0) {
      const st = this.spec.stages[this.stageIdx];
      const p = 1 - this.stateT / 1.0;
      const a = p < 0.15 ? p / 0.15 : p > 0.8 ? (1 - p) / 0.2 : 1;
      const dy = (1 - easeOutBack(Math.min(1, p * 3))) * 30;
      g.globalAlpha = clamp(a, 0, 1);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "rgba(10,8,14,0.75)";
      g.fillRect(-1000, 232 + dy, W + 2000, 74);
      g.fillStyle = "#f3d88d";
      g.font = "700 28px Cinzel, serif";
      const label = this.spec.mode === "practice" ? "LESSON" : `LOCK ${this.stageIdx + 1} OF ${this.spec.stages.length}`;
      g.fillText(`${MECH_INFO[st.type].icon}  ${MECH_INFO[st.type].name}`, CX, 258 + dy);
      g.font = "600 13px Inter, sans-serif";
      g.fillStyle = "rgba(233,226,208,0.75)";
      const aff = st.affix === "trapped" ? " · TRAPPED (mistakes ×2)" : st.affix === "rusted" ? " · RUSTED (tight tolerances)" : st.affix === "alarmed" ? " · ALARMED (guard follows)" : "";
      g.fillText(`${label}${aff}`, CX, 288 + dy);
      g.globalAlpha = 1;
    }
    // opening doors
    if (this.state === "opening") {
      const p = 1 - this.stateT / 2.2;
      const open = easeInOut(clamp((p - 0.15) / 0.7, 0, 1));
      const lg = g.createRadialGradient(CX, 290, 10, CX, 290, 520);
      lg.addColorStop(0, "#fff6c8");
      lg.addColorStop(0.5, "#ffd05a");
      lg.addColorStop(1, "#8a5a10");
      g.fillStyle = lg;
      g.fillRect(-1000, -1000, W + 2000, H + 2000);
      const half = W / 2;
      const dx = open * (half + 40);
      const door = (x0: number, dir: number) => {
        const dg = g.createLinearGradient(x0, 0, x0 + dir * half, 0);
        dg.addColorStop(0, "#3a3640");
        dg.addColorStop(1, "#1a1820");
        g.fillStyle = dg;
        const x = x0 + dir * dx;
        g.fillRect(dir > 0 ? x : x - half, -1000, half, H + 2000);
        g.fillStyle = "rgba(214,168,76,0.5)";
        for (let i = 0; i < 6; i++) {
          g.beginPath();
          g.arc(dir > 0 ? x + 24 : x - 24, 60 + i * 90, 8, 0, TAU);
          g.fill();
        }
      };
      door(CX, 1);
      door(CX, -1);
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = `rgba(40,25,5,${clamp((p - 0.5) * 3, 0, 1)})`;
      g.font = "900 54px Cinzel, serif";
      g.fillText("VAULT OPEN", CX, 290);
    }
  }
}

function mixColor(a: number[], b: number[], t: number): string {
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}
