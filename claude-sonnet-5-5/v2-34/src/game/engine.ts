import {
  K,
  KP,
  Level,
  Pos,
  St,
  Tile,
  getWorld,
  inspPos,
  search,
  stepTarget,
  transition,
  visibleLinks,
} from "./core";
import { audio } from "./audio";
import { Rules } from "./meta";

export interface HudSnap {
  mode: "idle" | "demo" | "play";
  levelId: number;
  energy: number;
  maxEnergy: number;
  steps: number;
  par: number;
  docs: number;
  docsTotal: number;
  undo: number;
  hints: number;
  view: number;
  coach: string;
  hintText: string;
  waitCost: number;
  over: boolean;
  canRewind: boolean;
}
export interface Result {
  won: boolean;
  reason: "goal" | "energy" | "caught";
  levelId: number;
  steps: number;
  par: number;
  energyLeft: number;
  docs: number;
  docsTotal: number;
  coffee: number;
  stars: number;
  time: number;
  hops: number;
  rotations: number;
  undos: number;
  hintsUsed: number;
}
export interface Callbacks {
  onHud: (s: HudSnap) => void;
  onEnd: (r: Result) => void;
  onEsc: () => void;
}
export interface EngineSettings {
  linkHints: boolean;
  shake: boolean;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (c: RGB, k: number, a = 1) =>
  `rgba(${Math.min(255, (c[0] * k) | 0)},${Math.min(255, (c[1] * k) | 0)},${Math.min(255, (c[2] * k) | 0)},${a})`;

const PAL = [
  { bg: ["#f4be98", "#b9565a"], tiles: ["#fff1d8", "#ffe2bd", "#ffd3a6"], shape: "#ffffff" },
  { bg: ["#86cfc8", "#1b5876"], tiles: ["#e7f7f0", "#c9ebe2", "#add8d0"], shape: "#d6fff6" },
  { bg: ["#bd92de", "#43287c"], tiles: ["#f7ebff", "#e6d0f8", "#d4b7ef"], shape: "#f2dcff" },
  { bg: ["#62668f", "#12132a"], tiles: ["#e0e3f5", "#c3c7e3", "#a6abd0"], shape: "#aab0e8" },
].map((p) => ({ ...p, tilesRGB: p.tiles.map((t) => hex(t)) }));
const COLS = ["#ef6f5a", "#3fb8af", "#9d7bff"];
const COLS_RGB = COLS.map(hex);
const INK = "#1d1b2f";
const PI2 = Math.PI / 2;
const DIRN = ["down-right ↘", "down-left ↙", "up-left ↖", "up-right ↗"];

interface Item {
  d: number;
  fn: () => void;
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
}
interface FloatText {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
  size: number;
}
interface Snap {
  st: St;
  energy: number;
  steps: number;
  docs: number[];
  coffee: number[];
  rotU: number[];
  hops: number;
}
interface Vis {
  f: Pos;
  fo: number;
  to: Pos;
  too: number;
  via: Pos | null;
  t: number;
  dur: number;
  kind: string;
}

const surf = (t: { kind: string }) => (t.kind === "stair" ? 0.5 : 0);

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: Callbacks;
  private W = 800;
  private H = 600;
  private dpr = 1;
  private TW = 40;
  private ox = 400;
  private oy = 300;
  private raf = 0;
  private last = 0;
  private time = 0;
  private alive = true;

  mode: "idle" | "demo" | "play" = "idle";
  private level: Level | null = null;
  private st: St = { x: 0, y: 0, z: 0, mech: 0, t: 0 };
  private energy = 0;
  private steps = 0;
  private docsGot = new Set<number>();
  private coffeeGot = new Set<number>();
  private hist: Snap[] = [];
  private rules: Rules | null = null;
  private undoLeft = 0;
  private hintLeft = 0;
  private undosUsed = 0;
  private hintsUsed = 0;
  private hops = 0;
  private rotations = 0;
  private playTime = 0;
  private over = false;
  private endTimer = -1;
  private endResult: Result | null = null;
  paused = false;
  private settings: EngineSettings = { linkHints: true, shake: true };

  private camAngle = 0;
  private camTarget = 0;
  private dragging = false;
  private ptr: { sx: number; sy: number; t: number; moved: boolean; startAngle: number } | null = null;
  private hover: Tile | null = null;
  private vis: Vis | null = null;
  private inspFrom: Pos[] = [];
  private inspTo: Pos[] = [];
  private face = 1;
  private queue: { s: number; view: number }[] = [];
  private pending: number | null = null;

  private bridgeA: number[] = [];
  private rotAng: number[] = [];
  private rotTarget: number[] = [];
  private particles: Particle[] = [];
  private floats: FloatText[] = [];
  private shake = 0;
  private flash = 0;
  private flashColor = "255,80,60";
  private hintTarget: Pos | null = null;
  private hintText = "";
  private hintTimer = 0;
  private coachOn = false;
  private coachStage = 0;
  private linkCache: { key: number; pairs: [Tile, Tile][] } = { key: -1, pairs: [] };
  private musicTimer = 0;
  private shapes: { x: number; y: number; r: number; s: number; k: number; a: number }[] = [];
  private wheelCool = 0;

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = cb;
    for (let i = 0; i < 14; i++) this.shapes.push({ x: Math.random(), y: Math.random(), r: 20 + Math.random() * 60, s: 0.002 + Math.random() * 0.006, k: Math.floor(Math.random() * 3), a: Math.random() * 6 });
    canvas.addEventListener("pointerdown", this.onDown);
    canvas.addEventListener("pointermove", this.onMove);
    canvas.addEventListener("pointerup", this.onUp);
    canvas.addEventListener("pointercancel", this.onUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
  }

  setSettings(s: EngineSettings) {
    this.settings = s;
  }
  setPaused(p: boolean) {
    this.paused = p;
    if (p) {
      this.queue = [];
      this.pending = null;
    }
    audio.setPaused(p);
    this.emit();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(200, r.width);
    this.H = Math.max(200, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.layout();
  }
  private layout() {
    const L = this.level;
    if (!L) return;
    const c = L.cam;
    const portrait = this.H > this.W;
    const tw = Math.min((this.W * 0.94) / (2 * c.ax), (this.H * (portrait ? 0.6 : 0.7)) / Math.max(1, c.ymax - c.ymin));
    this.TW = Math.max(10, Math.min(72, tw));
    this.ox = this.W / 2;
    this.oy = this.H * 0.53 - ((c.ymax + c.ymin) / 2) * this.TW;
  }

  // ---------- level lifecycle ----------
  startDemo(L: Level) {
    this.setupLevel(L);
    this.mode = "demo";
    this.rules = null;
    this.emit();
  }
  loadLevel(L: Level, rules: Rules, coach: boolean) {
    this.setupLevel(L);
    // open on an angle where no joints are pre-aligned, so the player has to find the illusion
    for (let v = 0; v < 4; v++) {
      if (visibleLinks(L, 0, v).length === 0) {
        this.camAngle = this.camTarget = v * PI2;
        break;
      }
    }
    this.mode = "play";
    this.rules = rules;
    this.energy = rules.maxEnergy;
    this.undoLeft = rules.undo;
    this.hintLeft = rules.hints;
    this.coachOn = coach;
    this.coachStage = 0;
    this.paused = false;
    audio.setPaused(false);
    audio.startMusic(L.spec.wing);
    this.emit();
  }
  private setupLevel(L: Level) {
    this.level = L;
    this.st = { x: L.start.x, y: L.start.y, z: L.start.z, mech: 0, t: 0 };
    this.steps = 0;
    this.energy = 0;
    this.docsGot = new Set();
    this.coffeeGot = new Set();
    this.hist = [];
    this.undosUsed = 0;
    this.hintsUsed = 0;
    this.hops = 0;
    this.rotations = 0;
    this.playTime = 0;
    this.over = false;
    this.endTimer = -1;
    this.endResult = null;
    this.vis = null;
    this.queue = [];
    this.pending = null;
    this.camAngle = this.camTarget = 0;
    this.dragging = false;
    this.bridgeA = L.bridges.map(() => 0);
    this.rotAng = L.rotors.map(() => 0);
    this.rotTarget = L.rotors.map(() => 0);
    this.particles = [];
    this.floats = [];
    this.shake = 0;
    this.flash = 0;
    this.hintTarget = null;
    this.hintText = "";
    this.linkCache = { key: -1, pairs: [] };
    this.inspFrom = L.inspectors.map((_, i) => inspPos(L, i, 0));
    this.inspTo = this.inspFrom.slice();
    this.layout();
  }
  setRules(r: Rules) {
    if (!this.rules || this.mode !== "play") {
      this.rules = r;
      return;
    }
    const o = this.rules;
    this.energy = Math.max(this.energy <= 0 ? this.energy : 1, this.energy + (r.maxEnergy - o.maxEnergy));
    this.undoLeft = Math.max(0, this.undoLeft + (r.undo - o.undo));
    this.hintLeft = Math.max(0, this.hintLeft + (r.hints - o.hints));
    this.rules = r;
    this.emit();
  }

  private curView() {
    return ((Math.round(this.camTarget / PI2) % 4) + 4) % 4;
  }
  private settled() {
    return !this.dragging && Math.abs(this.camTarget - this.camAngle) < 0.16;
  }

  private snapState(): HudSnap {
    const L = this.level;
    return {
      mode: this.mode,
      levelId: L ? L.id : 0,
      energy: this.energy,
      maxEnergy: this.rules ? this.rules.maxEnergy : 0,
      steps: this.steps,
      par: L ? L.par : 0,
      docs: this.docsGot.size,
      docsTotal: L ? L.docs.length : 0,
      undo: this.undoLeft,
      hints: this.hintLeft,
      view: this.curView(),
      coach: this.coachOn ? this.coachText() : "",
      hintText: this.hintText,
      waitCost: this.rules ? this.rules.waitCost : 1,
      over: this.over,
      canRewind: this.undoLeft > 0 && this.hist.length > 0,
    };
  }
  private coachText() {
    return [
      "Tap a tile (or use the arrow keys) to walk. Try it!",
      "Now drag the building sideways - or press Q / E - to rotate your viewpoint.",
      "Line up the two gold-rimmed Joints so they touch on screen, then walk across.",
      "Reach the golden doorway to file your report!",
    ][Math.min(3, this.coachStage)];
  }
  private coachEvent(e: "step" | "rotate" | "hop") {
    if (!this.coachOn) return;
    if (e === "step" && this.coachStage === 0) this.coachStage = 1;
    else if (e === "rotate" && this.coachStage <= 1) this.coachStage = 2;
    else if (e === "hop") this.coachStage = 3;
  }
  emit() {
    this.cb.onHud(this.snapState());
  }

  // ---------- actions ----------
  rotate(dir: number) {
    if (this.mode !== "play" || this.over || this.paused) return;
    this.camTarget += dir * PI2;
    this.rotations++;
    this.queue = [];
    this.pending = null;
    this.hintTarget = null;
    this.hintText = "";
    audio.play("rotate");
    this.coachEvent("rotate");
    this.emit();
  }
  wait() {
    this.input(-1);
  }
  private input(s: number) {
    if (this.mode !== "play" || this.over || this.paused) return;
    if (this.vis || !this.settled()) {
      this.pending = s;
      return;
    }
    this.queue = [];
    this.act(s, this.curView());
  }

  private snapshot(): Snap {
    return {
      st: { ...this.st },
      energy: this.energy,
      steps: this.steps,
      docs: Array.from(this.docsGot),
      coffee: Array.from(this.coffeeGot),
      rotU: this.rotTarget.slice(),
      hops: this.hops,
    };
  }
  private restore(s: Snap) {
    const L = this.level!;
    this.st = { ...s.st };
    this.energy = s.energy;
    this.steps = s.steps;
    this.docsGot = new Set(s.docs);
    this.coffeeGot = new Set(s.coffee);
    this.rotTarget = s.rotU.slice();
    this.hops = s.hops;
    this.vis = null;
    this.queue = [];
    this.pending = null;
    this.inspFrom = L.inspectors.map((_, i) => inspPos(L, i, this.st.t));
    this.inspTo = this.inspFrom.slice();
  }
  undo(): boolean {
    if (this.mode !== "play" || this.paused || this.hist.length === 0) return false;
    if (this.undoLeft <= 0) {
      this.floatAt(this.st, "No rewinds left", "#ff9a8a");
      audio.play("bump");
      return false;
    }
    const s = this.hist.pop()!;
    this.restore(s);
    this.undoLeft--;
    this.undosUsed++;
    if (this.over) {
      this.over = false;
      this.endTimer = -1;
      this.endResult = null;
    }
    this.hintTarget = null;
    this.hintText = "";
    audio.play("undo");
    this.burstAt(this.st, "#9ad8ff", 16, 90);
    this.floatAt(this.st, "Rewound", "#9ad8ff");
    this.emit();
    return true;
  }
  hint() {
    const L = this.level;
    if (!L || this.mode !== "play" || this.over || this.paused) return;
    if (this.rules?.iron) return;
    if (this.hintLeft <= 0) {
      this.floatAt(this.st, "No hints left", "#ff9a8a");
      audio.play("bump");
      return;
    }
    const v = this.curView();
    const order = [v, (v + 1) & 3, (v + 3) & 3, (v + 2) & 3];
    const r = search(L, this.st, { views: order });
    this.hintLeft--;
    this.hintsUsed++;
    audio.play("hint");
    if (!r.found || r.acts.length === 0) {
      this.hintTarget = null;
      this.hintText = "No route from here. Rewind or restart the case.";
    } else {
      const a = r.acts[0];
      if (a.view < 0) {
        this.hintTarget = null;
        this.hintText = "Wait a beat (Space) and let the inspector pass.";
      } else {
        const tr = transition(L, this.st, a.view, a.s);
        this.hintTarget = tr ? { x: tr.x, y: tr.y, z: tr.z } : null;
        const delta = (a.view - v + 4) & 3;
        const rot = delta === 0 ? "" : delta === 1 ? "Rotate once with E, then " : delta === 3 ? "Rotate once with Q, then " : "Rotate twice (Q/E), then ";
        this.hintText = `${rot}step ${DIRN[a.s]}. ${r.acts.length} moves to the goal.`;
      }
    }
    this.hintTimer = 9;
    this.emit();
  }

  private act(s: number, view: number): boolean {
    const L = this.level;
    const rules = this.rules;
    if (!L || !rules || this.mode !== "play" || this.over || this.paused) return false;
    const tr = transition(L, this.st, view, s);
    if (!tr) {
      this.shake = Math.max(this.shake, 3);
      audio.play("bump");
      this.queue = [];
      return false;
    }
    this.hist.push(this.snapshot());
    if (this.hist.length > 300) this.hist.shift();
    const oldT = this.st.t;
    this.inspFrom = L.inspectors.map((_, i) => inspPos(L, i, oldT));
    this.inspTo = L.inspectors.map((_, i) => inspPos(L, i, tr.t));
    const fromTile = getWorld(L, this.st.mech).get(K(this.st.x, this.st.y, this.st.z));
    const toTile = getWorld(L, tr.mech).get(K(tr.x, tr.y, tr.z));
    const landed = tr.landed;
    const dur = tr.kind === "hop" ? 0.34 : tr.kind === "portal" ? 0.55 : tr.kind === "wait" ? 0.2 : this.queue.length > 1 ? 0.13 : 0.17;
    this.vis = {
      f: { x: tr.fx, y: tr.fy, z: tr.fz },
      fo: fromTile ? surf(fromTile) : 0,
      to: { x: tr.x, y: tr.y, z: tr.z },
      too: toTile ? surf(toTile) : 0,
      via: tr.kind === "portal" && landed ? { x: landed.x, y: landed.y, z: landed.z } : null,
      t: 0,
      dur,
      kind: tr.kind,
    };
    const dx = tr.x - tr.fx;
    const dz = tr.z - tr.fz;
    const c = Math.cos(this.camAngle);
    const si = Math.sin(this.camAngle);
    const rx = dx * c - dz * si;
    const rz = dx * si + dz * c;
    if (Math.abs(rx - rz) > 0.01) this.face = rx - rz > 0 ? 1 : -1;
    this.st = { x: tr.x, y: tr.y, z: tr.z, mech: tr.mech, t: tr.t };
    this.steps++;
    this.energy -= s < 0 ? rules.waitCost : 1;
    this.hintTarget = null;
    this.hintText = "";
    this.hintTimer = 0;
    // feedback
    switch (tr.kind) {
      case "walk":
        audio.play("step", this.steps % 4);
        break;
      case "climb":
        audio.play("climb");
        break;
      case "hop":
        audio.play("hop");
        audio.play("fuse");
        this.hops++;
        this.shake = Math.max(this.shake, 4);
        this.burstAt(tr.fx === tr.x ? this.st : { x: tr.fx, y: tr.fy, z: tr.fz }, "#ffd166", 14, 120);
        this.burstAt(this.st, "#ffd166", 18, 140);
        this.floatAt(this.st, "Fused!", "#ffd166");
        this.coachEvent("hop");
        break;
      case "portal":
        audio.play("portal");
        this.burstAt({ x: tr.fx, y: tr.fy, z: tr.fz }, "#9ad8ff", 14, 100);
        this.burstAt(this.st, "#9ad8ff", 22, 120);
        break;
      case "wait":
        audio.play("wait");
        this.floatAt(this.st, "...", "#ffffff");
        break;
    }
    if (tr.kind === "walk" || tr.kind === "climb") this.coachEvent("step");
    if (tr.toggled >= 0) {
      audio.play("switch");
      this.shake = Math.max(this.shake, 3);
      this.burstAt(this.st, COLS[tr.toggled % 3], 16, 100);
      const on = (tr.mech >> tr.toggled) & 1;
      this.floatAt(this.st, on ? "Bridge out" : "Bridge in", COLS[tr.toggled % 3]);
    }
    if (tr.cranked >= 0) {
      audio.play("rotor");
      this.rotTarget[tr.cranked]++;
      this.shake = Math.max(this.shake, 5);
      this.burstAt(this.st, COLS[tr.cranked % 3], 18, 110);
      this.floatAt(this.st, "Clunk!", COLS[tr.cranked % 3]);
    }
    const key = KP(this.st);
    L.docs.forEach((d, i) => {
      if (KP(d) === key && !this.docsGot.has(i)) {
        this.docsGot.add(i);
        audio.play("doc");
        this.burstAt(this.st, "#ffffff", 16, 110);
        this.floatAt(this.st, `Document ${this.docsGot.size}/${L.docs.length}`, "#fff4de");
      }
    });
    L.coffee.forEach((d, i) => {
      if (KP(d) === key && !this.coffeeGot.has(i)) {
        this.coffeeGot.add(i);
        this.energy += rules.coffeeGain;
        audio.play("coffee");
        this.burstAt(this.st, "#c98a52", 16, 100);
        this.floatAt(this.st, `+${rules.coffeeGain} energy`, "#ffc9a0");
      }
    });
    const tile = getWorld(L, this.st.mech).get(key);
    if (tr.caught) this.finish(false, "caught");
    else if (tile && tile.role === "goal") this.finish(true, "goal");
    else if (this.energy <= 0) this.finish(false, "energy");
    this.emit();
    return true;
  }

  private finish(won: boolean, reason: "goal" | "energy" | "caught") {
    const L = this.level!;
    this.over = true;
    this.queue = [];
    this.pending = null;
    const par = L.par;
    let stars = 0;
    if (won) {
      stars = 1;
      if (this.steps <= Math.ceil(par * 1.3) + 1) stars++;
      if (L.docs.length > 0 && this.docsGot.size === L.docs.length) stars++;
    }
    this.endResult = {
      won,
      reason,
      levelId: L.id,
      steps: this.steps,
      par,
      energyLeft: Math.max(0, this.energy),
      docs: this.docsGot.size,
      docsTotal: L.docs.length,
      coffee: this.coffeeGot.size,
      stars,
      time: this.playTime,
      hops: this.hops,
      rotations: this.rotations,
      undos: this.undosUsed,
      hintsUsed: this.hintsUsed,
    };
    this.endTimer = won ? 1.1 : 0.95;
    if (won) {
      audio.play("win");
      this.confetti();
      this.shake = Math.max(this.shake, 6);
    } else {
      audio.play(reason === "caught" ? "caught" : "lose");
      this.shake = Math.max(this.shake, reason === "caught" ? 16 : 7);
      this.flash = 0.7;
      this.flashColor = reason === "caught" ? "255,60,50" : "40,30,60";
      this.floatAt(this.st, reason === "caught" ? "CAUGHT!" : "OUT OF ENERGY", "#ff6b5a");
    }
  }

  // ---------- input ----------
  private onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement && e.key !== "Escape") return;
    const k = e.key.toLowerCase();
    if (k === "escape") {
      e.preventDefault();
      this.cb.onEsc();
      return;
    }
    if (this.mode !== "play" || this.paused || this.over) {
      if (k === "p" && this.mode === "play" && !this.over) this.cb.onEsc();
      return;
    }
    const map: Record<string, number> = { arrowup: 3, w: 3, arrowright: 0, d: 0, arrowdown: 1, s: 1, arrowleft: 2, a: 2, "9": 3, "3": 0, "1": 1, "7": 2 };
    if (k in map) {
      e.preventDefault();
      this.input(map[k]);
    } else if (k === "q") this.rotate(-1);
    else if (k === "e") this.rotate(1);
    else if (k === " ") {
      e.preventDefault();
      if (!e.repeat) this.wait();
    } else if (k === "z" || k === "backspace") {
      e.preventDefault();
      this.undo();
    } else if (k === "h") this.hint();
    else if (k === "p") this.cb.onEsc();
  };
  private onBlur = () => {
    if (document.hidden || !document.hasFocus()) {
      if (this.mode === "play" && !this.paused && !this.over) this.cb.onEsc();
    }
  };
  private localXY(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private onDown = (e: PointerEvent) => {
    if (this.mode !== "play") return;
    audio.ensure();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.ptr = { sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, startAngle: this.camTarget };
  };
  private onMove = (e: PointerEvent) => {
    if (this.mode !== "play") return;
    const p = this.ptr;
    if (p) {
      const dx = e.clientX - p.sx;
      const dy = e.clientY - p.sy;
      if (!p.moved && Math.hypot(dx, dy) > 10) {
        p.moved = true;
        if (!this.over && !this.paused) {
          this.dragging = true;
          this.queue = [];
          this.pending = null;
          this.hintTarget = null;
        }
      }
      if (this.dragging) {
        this.camTarget = p.startAngle + dx * 0.0085;
        this.camAngle = this.camTarget;
      }
    } else if (e.pointerType === "mouse") {
      const q = this.localXY(e);
      this.hover = this.pickTile(q.x, q.y);
    }
  };
  private onUp = (e: PointerEvent) => {
    const p = this.ptr;
    this.ptr = null;
    if (!p || this.mode !== "play") return;
    if (this.dragging) {
      const before = ((Math.round(p.startAngle / PI2) % 4) + 4) % 4;
      this.camTarget = Math.round(this.camTarget / PI2) * PI2;
      this.dragging = false;
      if (this.curView() !== before) {
        this.rotations++;
        audio.play("rotate");
        this.coachEvent("rotate");
        this.emit();
      }
    } else if (!p.moved && !this.over && !this.paused) {
      const q = this.localXY(e);
      this.tap(q.x, q.y);
    }
  };
  private onWheel = (e: WheelEvent) => {
    if (this.mode !== "play") return;
    e.preventDefault();
    if (this.wheelCool > 0) return;
    this.wheelCool = 0.3;
    this.rotate(e.deltaY > 0 ? 1 : -1);
  };
  private tap(x: number, y: number) {
    const L = this.level;
    if (!L || !this.settled()) return;
    audio.ensure();
    const t = this.pickTile(x, y);
    if (!t) return;
    if (t.x === this.st.x && t.y === this.st.y && t.z === this.st.z) return;
    const v = this.curView();
    if (this.vis) return;
    const r = search(L, this.st, { views: [v], target: { x: t.x, y: t.y, z: t.z } });
    if (!r.found || r.acts.length === 0) {
      this.floatAt({ x: t.x, y: t.y, z: t.z }, "No route from this angle", "#ffd0c8");
      audio.play("bump");
      return;
    }
    this.queue = r.acts.map((a) => ({ s: a.s, view: v }));
  }

  // ---------- projection ----------
  private proj(wx: number, wy: number, wz: number): [number, number, number] {
    const L = this.level!;
    const dx = wx - L.cam.cx;
    const dz = wz - L.cam.cz;
    const co = Math.cos(this.camAngle);
    const si = Math.sin(this.camAngle);
    const rx = dx * co - dz * si;
    const rz = dx * si + dz * co;
    return [this.ox + (rx - rz) * this.TW, this.oy + ((rx + rz) / 2 - (wy - L.cam.cy)) * this.TW, rx + rz + wy];
  }
  private pickTile(px: number, py: number): Tile | null {
    const L = this.level;
    if (!L) return null;
    const W = getWorld(L, this.st.mech);
    const co = Math.cos(this.camAngle);
    const si = Math.sin(this.camAngle);
    let best: Tile | null = null;
    let bd = -1e9;
    for (const t of W.values()) {
      const h = t.y + surf(t);
      const u = (px - this.ox) / this.TW;
      const v = (py - this.oy) / this.TW + (h - L.cam.cy);
      const rx = (2 * v + u) / 2;
      const rz = (2 * v - u) / 2;
      const dx = rx * co + rz * si + L.cam.cx;
      const dz = -rx * si + rz * co + L.cam.cz;
      if (Math.abs(dx - t.x) <= 0.5 && Math.abs(dz - t.z) <= 0.5) {
        const d = this.proj(t.x, h, t.z)[2];
        if (d > bd) {
          bd = d;
          best = t;
        }
      }
    }
    return best;
  }

  // ---------- particles ----------
  private burstAt(p: Pos, color: string, n: number, speed: number) {
    if (!this.level) return;
    const s = this.proj(p.x, p.y + 0.4, p.z);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({ x: s[0], y: s[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0.6 + Math.random() * 0.5, max: 1.1, size: 2 + Math.random() * 3.5, color, g: 220 });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }
  private floatAt(p: Pos, text: string, color: string) {
    if (!this.level) return;
    const s = this.proj(p.x, p.y + 1.3, p.z);
    this.floats.push({ x: s[0], y: s[1], text, life: 1.3, color, size: 15 });
    if (this.floats.length > 14) this.floats.shift();
  }
  private confetti() {
    const L = this.level!;
    const s = this.proj(L.goal.x, L.goal.y + 0.5, L.goal.z);
    const cols = ["#ffd166", "#ef6f5a", "#3fb8af", "#9d7bff", "#ffffff"];
    for (let i = 0; i < 120; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 120 + Math.random() * 360;
      this.particles.push({ x: s[0], y: s[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1.2 + Math.random(), max: 2.2, size: 3 + Math.random() * 4, color: cols[i % cols.length], g: 380 });
    }
  }

  // ---------- main loop ----------
  private frame = (now: number) => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    this.update(dt);
    this.render();
  };

  private update(dt: number) {
    this.time += dt;
    const L = this.level;
    if (!L) return;
    if (this.wheelCool > 0) this.wheelCool -= dt;
    if (this.mode === "demo") {
      this.camTarget += dt * 0.18;
      this.camAngle = this.camTarget;
    } else if (!this.dragging) {
      const d = this.camTarget - this.camAngle;
      if (Math.abs(d) < 0.002) this.camAngle = this.camTarget;
      else this.camAngle += d * (1 - Math.exp(-dt * 11));
    }
    if (this.paused) return;
    // bridges + rotors easing
    if (this.mode === "play" || this.mode === "demo") {
      L.bridges.forEach((b, i) => {
        const target = (this.st.mech >> b.sw) & 1;
        this.bridgeA[i] += (target - this.bridgeA[i]) * (1 - Math.exp(-dt * 8));
        if (Math.abs(target - this.bridgeA[i]) < 0.01) this.bridgeA[i] = target;
      });
      L.rotors.forEach((_, i) => {
        const d = this.rotTarget[i] - this.rotAng[i];
        this.rotAng[i] += d * (1 - Math.exp(-dt * 7));
        if (Math.abs(d) < 0.003) this.rotAng[i] = this.rotTarget[i];
      });
    }
    // particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= 38 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    this.shake *= Math.exp(-dt * 7);
    if (this.shake < 0.1) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.mode !== "play") return;
    if (!this.over) this.playTime += dt;
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) {
        this.hintTarget = null;
        this.hintText = "";
        this.emit();
      }
    }
    // movement animation
    if (this.vis) {
      this.vis.t += dt / this.vis.dur;
      if (this.vis.t >= 1) this.vis = null;
    }
    if (!this.vis && !this.over && this.settled()) {
      if (this.pending !== null) {
        const s = this.pending;
        this.pending = null;
        this.queue = [];
        this.act(s, this.curView());
      } else if (this.queue.length) {
        const q = this.queue.shift()!;
        this.act(q.s, q.view);
      }
    }
    // end timer
    if (this.over && this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && this.endResult) {
        const r = this.endResult;
        this.endResult = null;
        this.cb.onEnd(r);
      }
    }
    // reactive music
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 0.4;
      let inten = 0.12;
      if (this.rules && !this.over) {
        inten += Math.max(0, 1 - this.energy / Math.max(1, this.rules.maxEnergy)) * 0.55;
        for (let i = 0; i < L.inspectors.length; i++) {
          const p = inspPos(L, i, this.st.t);
          const d = Math.abs(p.x - this.st.x) + Math.abs(p.z - this.st.z) + Math.abs(p.y - this.st.y) * 2;
          if (d <= 4) inten += 0.25;
        }
      }
      audio.setIntensity(inten);
    }
  }

  // ---------- rendering ----------
  private box(cx: number, cz: number, y0: number, y1: number, hx: number, hz: number, yaw: number, col: RGB, alpha = 1) {
    const L = this.level!;
    const ctx = this.ctx;
    const th = this.camAngle;
    const co = Math.cos(th);
    const si = Math.sin(th);
    const dx = cx - L.cam.cx;
    const dz = cz - L.cam.cz;
    const crx = dx * co - dz * si;
    const crz = dx * si + dz * co;
    const a = th + yaw;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const lx = [-hx, hx, hx, -hx];
    const lz = [-hz, -hz, hz, hz];
    const vx: number[] = [];
    const vz: number[] = [];
    for (let i = 0; i < 4; i++) {
      vx.push(crx + lx[i] * ca - lz[i] * sa);
      vz.push(crz + lx[i] * sa + lz[i] * ca);
    }
    const TW = this.TW;
    const sx = (i: number) => this.ox + (vx[i] - vz[i]) * TW;
    const sy = (i: number, y: number) => this.oy + ((vx[i] + vz[i]) / 2 - (y - L.cam.cy)) * TW;
    const faces: [number, number, number, number][] = [
      [1, 2, 1, 0],
      [2, 3, 0, 1],
      [3, 0, -1, 0],
      [0, 1, 0, -1],
    ];
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    for (const [i, j, fnx, fnz] of faces) {
      const nx = fnx * ca - fnz * sa;
      const nz = fnx * sa + fnz * ca;
      if (nx + nz <= 0.001) continue;
      const shade = 0.8 + 0.3 * ((-nx + nz) / 1.4142);
      const s = rgba(col, shade, alpha);
      ctx.fillStyle = s;
      ctx.strokeStyle = s;
      ctx.beginPath();
      ctx.moveTo(sx(i), sy(i, y1));
      ctx.lineTo(sx(j), sy(j, y1));
      ctx.lineTo(sx(j), sy(j, y0));
      ctx.lineTo(sx(i), sy(i, y0));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    const s = rgba(col, 1.04, alpha);
    ctx.fillStyle = s;
    ctx.strokeStyle = s;
    ctx.beginPath();
    ctx.moveTo(sx(0), sy(0, y1));
    ctx.lineTo(sx(1), sy(1, y1));
    ctx.lineTo(sx(2), sy(2, y1));
    ctx.lineTo(sx(3), sy(3, y1));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  /** Path of a top-face quad (screen space). */
  private quadPath(cx: number, cz: number, y: number, hx: number, hz: number, yaw = 0) {
    const ctx = this.ctx;
    const pts: [number, number][] = [];
    const ca = Math.cos(yaw);
    const sa = Math.sin(yaw);
    for (const [ax, az] of [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ]) {
      const p = this.proj(cx + ax * ca - az * sa, y, cz + ax * sa + az * ca);
      pts.push([p[0], p[1]]);
    }
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }
  private ellipseAt(x: number, y: number, r: number) {
    // world-radius r circle on the iso plane
    const a = r * 1.4142 * this.TW;
    return { x, y, a, b: a / 2 };
  }

  private fogAlpha(wx: number, wy: number, wz: number) {
    if (!this.rules?.fog || this.mode !== "play") return 1;
    const dx = wx - this.st.x;
    const dz = wz - this.st.z;
    const dy = (wy - this.st.y) * 1.4;
    const d = Math.sqrt(dx * dx + dz * dz + dy * dy);
    return Math.max(0.07, Math.min(1, 1 - (d - 2.5) / 3));
  }

  private tileColor(t: Tile, pal: (typeof PAL)[number]): RGB {
    if (t.role === "bridge") return COLS_RGB[t.idx % 3];
    if (t.role === "arm") return COLS_RGB[t.idx % 3];
    return pal.tilesRGB[((t.y % 3) + 3) % 3];
  }

  private drawTileDecor(t: Tile, h: number, alpha: number) {
    const ctx = this.ctx;
    const L = this.level!;
    const time = this.time;
    const c = this.proj(t.x, h, t.z);
    const TW = this.TW;
    ctx.globalAlpha = alpha;
    if (t.joint) {
      this.quadPath(t.x, t.z, h, 0.4, 0.4);
      ctx.strokeStyle = `rgba(255,200,70,${0.75 + 0.25 * Math.sin(time * 4 + t.x)})`;
      ctx.lineWidth = Math.max(2, TW * 0.075);
      ctx.stroke();
      this.quadPath(t.x, t.z, h, 0.22, 0.22);
      ctx.fillStyle = "rgba(255,209,102,0.45)";
      ctx.fill();
    }
    if (t.role === "start") {
      const e = this.ellipseAt(c[0], c[1], 0.28);
      ctx.strokeStyle = "rgba(29,27,47,0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.a, e.b, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (t.role === "goal") {
      this.quadPath(t.x, t.z, h, 0.5, 0.5);
      ctx.fillStyle = `rgba(255,214,110,${0.5 + 0.2 * Math.sin(time * 3)})`;
      ctx.fill();
      const w = TW * 0.34;
      const hh = TW * 1.0;
      const g = ctx.createLinearGradient(0, c[1] - hh, 0, c[1]);
      g.addColorStop(0, "#fff7c8");
      g.addColorStop(1, "#ffb830");
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(c[0] - w - 3, c[1] + 2);
      ctx.lineTo(c[0] - w - 3, c[1] - hh * 0.7);
      ctx.arc(c[0], c[1] - hh * 0.7, w + 3, Math.PI, 0);
      ctx.lineTo(c[0] + w + 3, c[1] + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c[0] - w, c[1]);
      ctx.lineTo(c[0] - w, c[1] - hh * 0.7);
      ctx.arc(c[0], c[1] - hh * 0.7, w, Math.PI, 0);
      ctx.lineTo(c[0] + w, c[1]);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.beginPath();
      ctx.arc(c[0] + w * 0.45, c[1] - hh * 0.35, TW * 0.04, 0, 7);
      ctx.fill();
    } else if (t.role === "switch") {
      const col = COLS[t.idx % 3];
      const on = ((this.st.mech >> t.idx) & 1) === 1;
      const e = this.ellipseAt(c[0], c[1], 0.3);
      ctx.fillStyle = "rgba(29,27,47,0.55)";
      ctx.beginPath();
      ctx.ellipse(e.x, e.y + 3, e.a, e.b, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.globalAlpha = alpha * (on ? 1 : 0.55);
      ctx.beginPath();
      ctx.ellipse(e.x, e.y - (on ? 1 : 3), e.a * 0.85, e.b * 0.85, 0, 0, 7);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (t.role === "crank") {
      const col = COLS[t.idx % 3];
      const e = this.ellipseAt(c[0], c[1], 0.3);
      ctx.strokeStyle = col;
      ctx.fillStyle = "rgba(29,27,47,0.75)";
      ctx.lineWidth = Math.max(2, TW * 0.08);
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.a * 0.8, e.b * 0.8, 0, 0, 7);
      ctx.fill();
      ctx.stroke();
      const ang = this.rotAng[t.idx] * PI2 * 2;
      for (let k = 0; k < 8; k++) {
        const a = ang + (k * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * e.a * 0.8, e.y + Math.sin(a) * e.b * 0.8);
        ctx.lineTo(e.x + Math.cos(a) * e.a * 1.15, e.y + Math.sin(a) * e.b * 1.15);
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.a * 0.25, e.b * 0.25, 0, 0, 7);
      ctx.fill();
    } else if (t.role === "pivot") {
      const col = COLS[t.idx % 3];
      const e = this.ellipseAt(c[0], c[1], 0.22);
      ctx.fillStyle = col;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y - 3, e.a, e.b, 0, 0, 7);
      ctx.fill();
      ctx.stroke();
    } else if (t.role === "portal") {
      const e = this.ellipseAt(c[0], c[1], 0.36);
      const col = t.idx === 0 ? "#6ad6ff" : "#ff8ad8";
      for (let i = 0; i < 3; i++) {
        const k = 1 - i * 0.28;
        ctx.strokeStyle = col;
        ctx.globalAlpha = alpha * (0.9 - i * 0.2);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.a * k, e.b * k, 0, time * 2.5 * (i % 2 ? -1 : 1) + i, time * 2.5 * (i % 2 ? -1 : 1) + i + 4.4);
        ctx.stroke();
      }
      ctx.globalAlpha = alpha;
    }
    // inspector route markings
    if (t.kind === "floor" && L.inspectors.length && this.mode === "play") {
      for (const ins of L.inspectors) {
        if (ins.route.some((p) => p.x === t.x && p.y === t.y && p.z === t.z)) {
          ctx.fillStyle = "rgba(239,80,70,0.55)";
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            ctx.arc(c[0] + (k - 1) * TW * 0.16, c[1] + (k % 2) * TW * 0.04, TW * 0.04, 0, 7);
            ctx.fill();
          }
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawTile(t: Tile, pal: (typeof PAL)[number], alphaOverride?: number, rise = 0) {
    const col = this.tileColor(t, pal);
    const fog = this.fogAlpha(t.x, t.y, t.z);
    const alpha = (alphaOverride ?? 1) * fog;
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    const y = t.y - rise;
    if (t.kind === "stair") {
      const [dx, dz] = [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ][t.f];
      for (let i = 0; i < 4; i++) {
        const off = -0.375 + i * 0.25;
        this.box(t.x + dx * off, t.z + dz * off, y - 0.4, y + 0.2 + i * 0.25, dx !== 0 ? 0.125 : 0.49, dz !== 0 ? 0.125 : 0.49, 0, col, 1);
      }
    } else {
      this.box(t.x, t.z, y - 0.4, y, 0.49, 0.49, 0, col, 1);
    }
    ctx.globalAlpha = 1;
    if (rise === 0) this.drawTileDecor(t, t.y + surf(t), alpha);
  }

  private drawPlayer() {
    const L = this.level!;
    const ctx = this.ctx;
    let wx = this.st.x;
    let wy = this.st.y;
    let wz = this.st.z;
    let lift = 0;
    let scale = 1;
    const world = getWorld(L, this.st.mech);
    const cur = world.get(K(wx, wy, wz));
    let off = cur ? surf(cur) : 0;
    const v = this.vis;
    if (v) {
      const t = Math.min(1, v.t);
      const e = t * t * (3 - 2 * t);
      if (v.kind === "portal" && v.via) {
        if (t < 0.5) {
          const k = e * 2 > 1 ? 1 : (t * 2) * (t * 2) * (3 - 2 * t * 2);
          wx = v.f.x + (v.via.x - v.f.x) * k;
          wy = v.f.y + (v.via.y - v.f.y) * k;
          wz = v.f.z + (v.via.z - v.f.z) * k;
          scale = 1 - 0.85 * t * 2;
        } else {
          wx = v.to.x;
          wy = v.to.y;
          wz = v.to.z;
          scale = 0.15 + 0.85 * ((t - 0.5) * 2);
        }
        off = v.too;
      } else {
        wx = v.f.x + (v.to.x - v.f.x) * e;
        wy = v.f.y + (v.to.y - v.f.y) * e;
        wz = v.f.z + (v.to.z - v.f.z) * e;
        off = v.fo + (v.too - v.fo) * e;
        lift = Math.sin(Math.PI * t) * (v.kind === "hop" ? 0.7 : 0.18);
        if (v.kind === "hop") scale = 1 + 0.12 * Math.sin(Math.PI * t);
      }
    }
    const idle = !v && this.mode === "play" ? Math.sin(this.time * 3) * 0.015 : 0;
    const p = this.proj(wx, wy + off, wz);
    const TW = this.TW;
    const u = TW * 0.5 * scale;
    const x = p[0];
    const y = p[1] - lift * TW - idle * TW;
    const fog = 1;
    ctx.globalAlpha = fog;
    // shadow
    ctx.fillStyle = "rgba(29,27,47,0.28)";
    ctx.beginPath();
    ctx.ellipse(x, p[1] + 1, u * 0.55, u * 0.24, 0, 0, 7);
    ctx.fill();
    const f = this.face;
    // body
    ctx.fillStyle = "#fff4de";
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, TW * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - u * 0.5, y);
    ctx.lineTo(x - u * 0.36, y - u * 1.1);
    ctx.quadraticCurveTo(x, y - u * 1.55, x + u * 0.36, y - u * 1.1);
    ctx.lineTo(x + u * 0.5, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // tie
    ctx.fillStyle = "#ef6f5a";
    ctx.beginPath();
    ctx.moveTo(x + f * u * 0.05, y - u * 0.95);
    ctx.lineTo(x + f * u * 0.2, y - u * 0.5);
    ctx.lineTo(x - f * u * 0.05, y - u * 0.4);
    ctx.closePath();
    ctx.fill();
    // hat
    ctx.fillStyle = "#3fb8af";
    ctx.beginPath();
    ctx.ellipse(x, y - u * 1.38, u * 0.55, u * 0.17, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x - u * 0.33, y - u * 1.85, u * 0.66, u * 0.52, u * 0.18);
    ctx.fill();
    ctx.stroke();
    // eyes
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x + f * u * 0.08 - u * 0.15, y - u * 1.1, u * 0.065, 0, 7);
    ctx.arc(x + f * u * 0.08 + u * 0.15, y - u * 1.1, u * 0.065, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawInspector(i: number) {
    const L = this.level!;
    const ctx = this.ctx;
    const a = this.inspFrom[i] ?? inspPos(L, i, 0);
    const b = this.inspTo[i] ?? a;
    const t = this.vis ? Math.min(1, this.vis.t) : 1;
    const e = t * t * (3 - 2 * t);
    const wx = a.x + (b.x - a.x) * e;
    const wy = a.y + (b.y - a.y) * e;
    const wz = a.z + (b.z - a.z) * e;
    const p = this.proj(wx, wy, wz);
    const TW = this.TW;
    const u = TW * 0.5;
    const bob = Math.sin(this.time * 5 + i) * 0.02 * TW;
    const x = p[0];
    const y = p[1] - bob;
    ctx.fillStyle = "rgba(29,27,47,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, p[1] + 1, u * 0.6, u * 0.26, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#26233d";
    ctx.strokeStyle = "#0d0c19";
    ctx.lineWidth = Math.max(1.5, TW * 0.04);
    ctx.beginPath();
    ctx.moveTo(x - u * 0.55, y);
    ctx.lineTo(x - u * 0.4, y - u * 1.3);
    ctx.quadraticCurveTo(x, y - u * 1.8, x + u * 0.4, y - u * 1.3);
    ctx.lineTo(x + u * 0.55, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#26233d";
    ctx.beginPath();
    ctx.ellipse(x, y - u * 1.65, u * 0.62, u * 0.16, 0, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(x - u * 0.34, y - u * 2.1, u * 0.68, u * 0.55, u * 0.25);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ef4a3c";
    ctx.fillRect(x - u * 0.34, y - u * 1.72, u * 0.68, u * 0.1);
    ctx.shadowColor = "#ff3b2f";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(x - u * 0.15, y - u * 1.3, u * 0.07, 0, 7);
    ctx.arc(x + u * 0.15, y - u * 1.3, u * 0.07, 0, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    // lantern
    const lx = x + u * 0.8;
    const ly = y - u * 0.7 + Math.sin(this.time * 3 + i) * 2;
    const g = ctx.createRadialGradient(lx, ly, 1, lx, ly, u * 0.9);
    g.addColorStop(0, "rgba(255,200,90,0.85)");
    g.addColorStop(1, "rgba(255,200,90,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, u * 0.9, 0, 7);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(lx - u * 0.1, ly - u * 0.12, u * 0.2, u * 0.24);
  }

  private render() {
    const ctx = this.ctx;
    const L = this.level;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const wing = L ? L.spec.wing : 0;
    const pal = PAL[wing];
    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, pal.bg[0]);
    g.addColorStop(1, pal.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);
    // floating paper shapes
    ctx.fillStyle = pal.shape;
    for (const s of this.shapes) {
      s.a += s.s * 0.4;
      const x = (s.x + Math.sin(s.a) * 0.03) * this.W;
      const y = ((s.y + this.time * s.s * 0.5) % 1.2) * this.H - this.H * 0.1;
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      if (s.k === 0) ctx.arc(x, y, s.r, 0, 7);
      else if (s.k === 1) ctx.rect(x - s.r / 2, y - s.r / 2, s.r, s.r);
      else {
        ctx.moveTo(x, y - s.r);
        ctx.lineTo(x + s.r, y + s.r * 0.7);
        ctx.lineTo(x - s.r, y + s.r * 0.7);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!L) return;
    ctx.save();
    if (this.shake > 0 && this.settings.shake) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    const items: Item[] = [];
    for (const t of L.tiles) {
      const d = this.proj(t.x, t.y - 0.2, t.z)[2];
      items.push({ d, fn: () => this.drawTile(t, pal) });
    }
    L.bridges.forEach((b, i) => {
      const a = this.bridgeA[i];
      for (const p of b.tiles) {
        const tile: Tile = { x: p.x, y: p.y, z: p.z, kind: "floor", f: 0, joint: false, role: "bridge", idx: b.sw };
        const d = this.proj(p.x, p.y - 0.2, p.z)[2];
        if (a > 0.02) items.push({ d, fn: () => this.drawTile(tile, pal, Math.min(1, a * 1.2), (1 - a) * 0.8) });
        else
          items.push({
            d,
            fn: () => {
              const ctx2 = this.ctx;
              this.quadPath(p.x, p.z, p.y, 0.45, 0.45);
              ctx2.strokeStyle = COLS[b.sw % 3];
              ctx2.globalAlpha = 0.45 * this.fogAlpha(p.x, p.y, p.z);
              ctx2.lineWidth = 2;
              ctx2.setLineDash([5, 5]);
              ctx2.stroke();
              ctx2.setLineDash([]);
              ctx2.globalAlpha = 1;
            },
          });
      }
    });
    L.rotors.forEach((r, i) => {
      const phi = (r.d0 + this.rotAng[i]) * PI2;
      for (let j = 1; j <= r.len; j++) {
        const x = r.pivot.x + Math.cos(phi) * j;
        const z = r.pivot.z + Math.sin(phi) * j;
        const d = this.proj(x, r.pivot.y - 0.2, z)[2];
        items.push({
          d,
          fn: () => {
            this.ctx.globalAlpha = this.fogAlpha(x, r.pivot.y, z);
            this.box(x, z, r.pivot.y - 0.4, r.pivot.y, 0.49, 0.49, phi, COLS_RGB[i % 3]);
            this.ctx.globalAlpha = 1;
          },
        });
      }
    });
    // collectibles
    L.docs.forEach((p, i) => {
      if (this.docsGot.has(i)) return;
      const d = this.proj(p.x, p.y + 0.3, p.z)[2];
      items.push({
        d,
        fn: () => {
          const c = this.proj(p.x, p.y, p.z);
          const ctx2 = this.ctx;
          const bob = Math.sin(this.time * 3 + i * 2) * this.TW * 0.06;
          const w = this.TW * 0.2;
          ctx2.globalAlpha = this.fogAlpha(p.x, p.y, p.z);
          ctx2.save();
          ctx2.translate(c[0], c[1] - this.TW * 0.45 + bob);
          ctx2.rotate(Math.sin(this.time * 2 + i) * 0.15);
          ctx2.fillStyle = "#fffdf5";
          ctx2.strokeStyle = INK;
          ctx2.lineWidth = 1.5;
          ctx2.beginPath();
          ctx2.rect(-w, -w * 1.3, w * 2, w * 2.6);
          ctx2.fill();
          ctx2.stroke();
          ctx2.strokeStyle = "#ef6f5a";
          ctx2.beginPath();
          ctx2.moveTo(-w * 0.6, -w * 0.5);
          ctx2.lineTo(w * 0.6, -w * 0.5);
          ctx2.moveTo(-w * 0.6, 0);
          ctx2.lineTo(w * 0.6, 0);
          ctx2.moveTo(-w * 0.6, w * 0.5);
          ctx2.lineTo(w * 0.2, w * 0.5);
          ctx2.stroke();
          ctx2.restore();
          ctx2.globalAlpha = 1;
        },
      });
    });
    L.coffee.forEach((p, i) => {
      if (this.coffeeGot.has(i)) return;
      const d = this.proj(p.x, p.y + 0.3, p.z)[2];
      items.push({
        d,
        fn: () => {
          const c = this.proj(p.x, p.y, p.z);
          const ctx2 = this.ctx;
          const w = this.TW * 0.17;
          const bob = Math.sin(this.time * 2.5 + i) * this.TW * 0.04;
          const y = c[1] - this.TW * 0.3 + bob;
          ctx2.globalAlpha = this.fogAlpha(p.x, p.y, p.z);
          ctx2.fillStyle = "#fff";
          ctx2.strokeStyle = INK;
          ctx2.lineWidth = 1.5;
          ctx2.beginPath();
          ctx2.moveTo(c[0] - w, y - w);
          ctx2.lineTo(c[0] + w, y - w);
          ctx2.lineTo(c[0] + w * 0.75, y + w);
          ctx2.lineTo(c[0] - w * 0.75, y + w);
          ctx2.closePath();
          ctx2.fill();
          ctx2.stroke();
          ctx2.beginPath();
          ctx2.arc(c[0] + w * 1.05, y, w * 0.5, -1.2, 1.2);
          ctx2.stroke();
          ctx2.fillStyle = "#8a5430";
          ctx2.fillRect(c[0] - w * 0.9, y - w, w * 1.8, w * 0.35);
          ctx2.strokeStyle = "rgba(255,255,255,0.7)";
          ctx2.beginPath();
          for (let k = -1; k <= 1; k += 2) {
            ctx2.moveTo(c[0] + k * w * 0.4, y - w * 1.2);
            ctx2.quadraticCurveTo(c[0] + k * w * 0.9 + Math.sin(this.time * 3 + k) * 3, y - w * 2, c[0] + k * w * 0.3, y - w * 2.6);
          }
          ctx2.stroke();
          ctx2.globalAlpha = 1;
        },
      });
    });
    // actors
    if (this.mode === "play" || this.mode === "demo") {
      const pd = this.proj(this.vis && this.vis.t > 0.5 ? this.vis.to.x : this.vis ? this.vis.f.x : this.st.x, this.st.y + 0.35, this.vis && this.vis.t > 0.5 ? this.vis.to.z : this.vis ? this.vis.f.z : this.st.z)[2];
      items.push({ d: pd + 0.15, fn: () => this.drawPlayer() });
      for (let i = 0; i < L.inspectors.length; i++) {
        const a = this.inspFrom[i] ?? inspPos(L, i, 0);
        const b = this.inspTo[i] ?? a;
        const t = this.vis ? Math.min(1, this.vis.t) : 1;
        const d = this.proj(a.x + (b.x - a.x) * t, a.y + 0.35 + (b.y - a.y) * t, a.z + (b.z - a.z) * t)[2];
        items.push({ d: d + 0.12, fn: () => this.drawInspector(i) });
      }
    }
    items.sort((a, b) => a.d - b.d);
    for (const it of items) it.fn();

    // overlay: links, reachable dots, hover, hint, foresight
    const ctx2 = this.ctx;
    const view = this.curView();
    if (this.mode === "play" || this.mode === "demo") {
      const key = this.st.mech * 8 + view;
      if (this.linkCache.key !== key) this.linkCache = { key, pairs: visibleLinks(L, this.st.mech, view) };
      const settle = this.mode === "demo" ? 0 : Math.max(0, 1 - Math.abs(this.camTarget - this.camAngle) / 0.35);
      if (settle > 0.05 || this.mode === "demo") {
        for (const [a, b] of this.linkCache.pairs) {
          const onIt = (a.x === this.st.x && a.y === this.st.y && a.z === this.st.z) || (b.x === this.st.x && b.y === this.st.y && b.z === this.st.z);
          if (!this.settings.linkHints && !onIt && this.mode === "play") continue;
          const pa = this.proj(a.x, a.y, a.z);
          const pb = this.proj(b.x, b.y, b.z);
          const pulse = 0.55 + 0.35 * Math.sin(this.time * 5);
          ctx2.globalAlpha = (this.mode === "demo" ? 0.8 : settle) * pulse;
          ctx2.strokeStyle = "#fff0b0";
          ctx2.lineCap = "round";
          ctx2.lineWidth = this.TW * 0.16;
          ctx2.shadowColor = "#ffc247";
          ctx2.shadowBlur = 14;
          ctx2.beginPath();
          ctx2.moveTo(pa[0], pa[1]);
          ctx2.lineTo(pb[0], pb[1]);
          ctx2.stroke();
          ctx2.shadowBlur = 0;
          ctx2.globalAlpha = 1;
        }
      }
    }
    if (this.mode === "play" && !this.over && !this.paused) {
      const cur = getWorld(L, this.st.mech).get(K(this.st.x, this.st.y, this.st.z));
      if (cur && !this.vis && this.settled()) {
        const Wm = getWorld(L, this.st.mech);
        for (let s = 0; s < 4; s++) {
          const r = stepTarget(Wm, cur, view, s);
          if (!r) continue;
          const c = this.proj(r.tile.x, r.tile.y + surf(r.tile), r.tile.z);
          ctx2.fillStyle = r.hop ? "rgba(255,209,102,0.95)" : "rgba(255,255,255,0.8)";
          ctx2.globalAlpha = 0.55 + 0.4 * Math.sin(this.time * 5 + s);
          ctx2.beginPath();
          ctx2.ellipse(c[0], c[1], this.TW * (r.hop ? 0.2 : 0.13), this.TW * (r.hop ? 0.1 : 0.065), 0, 0, 7);
          ctx2.fill();
          ctx2.globalAlpha = 1;
        }
      }
      if (this.hover && this.settled()) {
        const h = this.hover;
        this.quadPath(h.x, h.z, h.y + surf(h), 0.5, 0.5);
        ctx2.fillStyle = "rgba(255,255,255,0.28)";
        ctx2.fill();
      }
      if (this.hintTarget) {
        const h = this.hintTarget;
        const c = this.proj(h.x, h.y, h.z);
        const pr = 0.5 + 0.5 * Math.sin(this.time * 6);
        ctx2.strokeStyle = `rgba(255,236,150,${0.6 + 0.4 * pr})`;
        ctx2.lineWidth = 3;
        ctx2.shadowColor = "#ffe08a";
        ctx2.shadowBlur = 14;
        ctx2.beginPath();
        ctx2.ellipse(c[0], c[1], this.TW * (0.5 + pr * 0.15), this.TW * (0.25 + pr * 0.07), 0, 0, 7);
        ctx2.stroke();
        ctx2.shadowBlur = 0;
      }
      const fs = this.rules?.foresight ?? 0;
      if (fs > 0 && !this.over) {
        for (let i = 0; i < L.inspectors.length; i++) {
          for (let k = 1; k <= fs; k++) {
            const p = inspPos(L, i, this.st.t + k);
            const c = this.proj(p.x, p.y, p.z);
            ctx2.strokeStyle = `rgba(255,90,80,${k === 1 ? 0.9 : 0.5})`;
            ctx2.lineWidth = 2.5;
            ctx2.setLineDash([4, 3]);
            ctx2.beginPath();
            ctx2.ellipse(c[0], c[1], this.TW * 0.32, this.TW * 0.16, 0, 0, 7);
            ctx2.stroke();
            ctx2.setLineDash([]);
            ctx2.fillStyle = ctx2.strokeStyle;
            ctx2.font = `700 ${Math.max(9, this.TW * 0.22)}px Inter, sans-serif`;
            ctx2.textAlign = "center";
            ctx2.fillText(String(k), c[0], c[1] + 3);
          }
        }
      }
    }
    // particles
    for (const p of this.particles) {
      ctx2.globalAlpha = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
      ctx2.fillStyle = p.color;
      ctx2.beginPath();
      ctx2.arc(p.x, p.y, p.size, 0, 7);
      ctx2.fill();
    }
    ctx2.globalAlpha = 1;
    ctx2.textAlign = "center";
    for (const f of this.floats) {
      const k = Math.min(1, f.life / 0.5);
      ctx2.globalAlpha = k;
      const pop = 1 + Math.max(0, f.life - 1.0) * 1.5;
      ctx2.font = `700 ${f.size * pop}px Inter, sans-serif`;
      ctx2.lineWidth = 4;
      ctx2.strokeStyle = "rgba(29,27,47,0.85)";
      ctx2.strokeText(f.text, f.x, f.y);
      ctx2.fillStyle = f.color;
      ctx2.fillText(f.text, f.x, f.y);
    }
    ctx2.globalAlpha = 1;
    ctx2.restore();
    // vignette + flash
    const vg = ctx2.createRadialGradient(this.W / 2, this.H / 2, Math.min(this.W, this.H) * 0.35, this.W / 2, this.H / 2, Math.max(this.W, this.H) * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(10,8,25,0.38)");
    ctx2.fillStyle = vg;
    ctx2.fillRect(0, 0, this.W, this.H);
    if (this.flash > 0) {
      ctx2.fillStyle = `rgba(${this.flashColor},${this.flash * 0.5})`;
      ctx2.fillRect(0, 0, this.W, this.H);
    }
  }
}
