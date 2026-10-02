import {
  CARD_MAP, DIFF_MAP, ORDER_MAP, TYPE_META, cardBaseCost, cardParams, shuffle,
  type CardInst, type CardType, type RunState,
} from "./data";
import type { Settings } from "./save";
import { audio } from "./audio";
import { BCOL, SPRITE_SCALE, glowSprite, makeBg, needleSprite, orbSprite, shardSprite } from "./sprites";
import { H, W, drawEnemy, spawnEnemy, updateEnemy, type Enemy } from "./enemies";
import { BOSSES } from "./bosses";

export { W, H };
const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export interface BulOpts { r?: number; c?: number; shape?: number; ds?: number; da?: number; smax?: number; smin?: number; sp?: number; st?: number; sn?: number }
interface Bullet { x: number; y: number; a: number; s: number; ds: number; da: number; smax: number; smin: number; r: number; c: number; shape: number; t: number; grazed: boolean; sp: number; st: number; sn: number; dead: boolean }
interface PBullet { x: number; y: number; x0: number; vx: number; vy: number; dmg: number; r: number; pierce: number; homing: number; bounce: number; split: number; burn: number; life: number; shape: number; hits: number[]; age: number; wave: number; ph: number; dead: boolean; noSplit: boolean; tithe: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; drag: number }
interface FText { x: number; y: number; text: string; color: string; size: number; life: number; max: number; vy: number }
interface Beam { x: number; y: number; a: number; w: number; warn: number; dur: number; t: number; angVel: number; follow?: Enemy; gcd: number; fired: boolean; dead: boolean }
interface Mote { x: number; y: number; vx: number; vy: number; v: number; t: number }
interface Fx { kind: "ring" | "col" | "flash"; x: number; y: number; r: number; w: number; t: number; dur: number; color: string; dmg: number; clear: boolean; hit: number[] }
interface Pattern { id: string; t: number; max: number; acc: number; a: number; side: number; p: Record<string, number>; ang: number }
interface Gloss { id: string; t: number; max: number; p: Record<string, number> }
interface Mods { pierce: number; homing: number; bounce: number; split: number; burn: number; heavy: number; echo: boolean; tithe: number }

export interface Callbacks {
  onSnap: (s: Snapshot) => void;
  onClear: () => void;
  onDeath: () => void;
  onPause: (toggle: boolean) => void;
}
export interface Snapshot {
  hp: number; maxHp: number; shield: number; faith: number; maxFaith: number; score: number; fervor: number;
  hand: { inst: CardInst; cost: number; ok: boolean }[];
  drawN: number; discardN: number; exhaustN: number; drawProg: number; cycleProg: number;
  effects: { name: string; icon: string; t: number; max: number; color: string }[];
  label: string; tut: { text: string; step: number; total: number } | null; denyUid: number; time: number; handSize: number;
}

interface TutStep { text: string; enter?: (g: Engine) => void; tick?: (g: Engine) => void; done: (g: Engine) => boolean }
const TUT: TutStep[] = [
  { text: "MOVE your ship: WASD / Arrow keys, move the mouse over the field, or drag with a finger.", done: (g) => g.moved > 320 },
  { text: "Your ship fires automatically. Hold SHIFT (or right mouse) to FOCUS: slower, precise, and your tiny hitbox is revealed.", done: (g) => g.focusTime > 1.4 },
  { text: "Cards are your liturgy. Press 1 (or click the card) to play ASPERSION and rewrite your firing pattern.", enter: (g) => { g.giveHand(["aspersion"]); g.faith = g.maxFaith; g.tutBase = g.run.stats.cardsPlayed; }, done: (g) => g.run.stats.cardsPlayed > g.tutBase },
  {
    text: "Destroy the three Cherubs!",
    enter: (g) => { g.tutBase = g.run.stats.kills; g.tutSpawnCherubs(); },
    tick: (g) => { if (g.enemies.length === 0 && g.laterN() === 0 && g.run.stats.kills - g.tutBase < 3) g.tutSpawnCherubs(); },
    done: (g) => g.run.stats.kills - g.tutBase >= 3,
  },
  {
    text: "GRAZE: skim close to bullets without touching them to earn Faith and Fervor. Graze 10 times!",
    enter: (g) => { g.tutBase = g.run.stats.grazes; g.bullets.length = 0; spawnEnemy(g, "thurifer", 300, -30); },
    tick: (g) => { if (g.enemies.length === 0) spawnEnemy(g, "thurifer", 300, -30); },
    done: (g) => g.run.stats.grazes - g.tutBase >= 10,
  },
  {
    text: "Wards protect you. Press 1 to raise a BARRIER: it absorbs a hit and purges nearby bullets. (Faith bar = your mana.)",
    enter: (g) => { g.clearField(); g.giveHand(["barrier", "purge"]); g.faith = g.maxFaith; g.playedTypes.clear(); spawnEnemy(g, "cherub", 200, -20); spawnEnemy(g, "cherub", 400, -20); },
    tick: (g) => { if (g.enemies.length === 0) { spawnEnemy(g, "cherub", 200, -20); spawnEnemy(g, "cherub", 400, -20); } },
    done: (g) => g.playedTypes.has("ward"),
  },
  {
    text: "Wrath erases the field. When the Sentinel's rings bloom, play PURGE (press 1): bullets become Faith.",
    enter: (g) => { g.clearField(); g.giveHand(["purge", "needle"]); g.faith = g.maxFaith; g.playedTypes.clear(); spawnEnemy(g, "sentinel", 300, -30); },
    tick: (g) => { if (g.enemies.length === 0) spawnEnemy(g, "sentinel", 300, -30); },
    done: (g) => g.playedTypes.has("wrath"),
  },
  {
    text: "Stuck with a bad hand? Press R to RECITE: costs 1 Faith, discards your hand and draws anew.",
    enter: (g) => { g.clearField(); g.giveHand(["litany", "fasting", "hush"]); g.faith = g.maxFaith; g.cycleCd = 0; g.drawPile = shuffle([...g.run.deck.map((d) => ({ ...d }))]); },
    done: (g) => g.cycles >= 1,
  },
  { text: "Synergy: Hymn + Gloss + Ward in quick succession triggers a TRINITY bonus. Fervor boosts damage; getting hit shatters it. You are ready!", enter: (g) => { g.tutT = 0; }, done: (g) => g.tutT > 6 },
];

export class Engine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  run: RunState;
  kind: "wave" | "boss" | "tutorial";
  settings: Settings;
  meta: Record<string, number>;
  cb: Callbacks;
  raf = 0;
  last = 0;
  sc = 1;
  paused = false;
  stopped = false;

  // derived stats
  maxFaith = 10; regen = 0.55; drawIv = 3; handSize = 4; dmgBase = 1; grazeFaith = 0.2; grazeR = 16;
  hymnMul = 1; glossMul = 1; hpScale = 1; bspd = 1; density = 1; act = 1; slotMax = 1;
  has: (id: string) => boolean;

  // player
  px = W / 2; py = H - 110; hpHit = 3.2;
  faith = 4; fervor = 0; idleT = 0; invuln = 0; shield = 0; aegisT = 0; veilT = 0; penT = 0; hushT = 0; zealT = 0; raptureT = 0; trinityT = 0;
  focus = false; moved = 0; focusTime = 0; grazeStreak = 0; grazeStreakT = 0;
  dead = false; deadT = 0;

  // cards
  drawPile: CardInst[] = [];
  hand: CardInst[] = [];
  discard: CardInst[] = [];
  exhausted: CardInst[] = [];
  drawT = 0; cycleCd = 0; cycles = 0; denyUid = -1; denyT = 0;
  chain: { type: CardType; t: number }[] = [];
  playedTypes = new Set<string>();
  patterns: Pattern[] = [];
  glosses: Gloss[] = [];
  mods: Mods = { pierce: 0, homing: 0, bounce: 0, split: 0, burn: 0, heavy: 1, echo: false, tithe: 0 };

  // world
  bullets: Bullet[] = [];
  pbullets: PBullet[] = [];
  enemies: Enemy[] = [];
  beams: Beam[] = [];
  motes: Mote[] = [];
  parts: Particle[] = [];
  texts: FText[] = [];
  fxs: Fx[] = [];
  orbs: { x: number; y: number }[] = [];
  drones: { x: number; y: number }[] = [];
  delayed: { t: number; fn: () => void }[] = [];
  ts = 1; slowT = 0; shake = 0; flashA = 0; flashC = "#fff"; bgY = 0; bg: HTMLCanvasElement; vignette: HTMLCanvasElement;
  banner: { text: string; sub: string; t: number; max: number; color: string } | null = null;
  time = 0; wave = { t: 0, D: 40, spawnT: 1.2, mini: false };
  boss: Enemy | null = null; bossSpawnT = 0.8;
  cleared = false; clearT = 0; notified = false; deathNotified = false;
  tut: { step: number; entered: boolean } | null = null; tutBase = 0; tutT = 0;
  snapT = 0; musT = 0; sfxShootT = 0; frame = 0;

  // input
  keys = new Set<string>();
  target: { x: number; y: number } | null = null;
  touch: { sx: number; sy: number; px: number; py: number; id: number } | null = null;
  rmb = false; padPrev: boolean[] = [];
  cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, run: RunState, kind: "wave" | "boss" | "tutorial", settings: Settings, meta: Record<string, number>, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.run = run;
    this.kind = kind;
    this.settings = settings;
    this.meta = meta;
    this.cb = cb;
    this.has = (id) => run.relics.includes(id);
    this.act = run.act;
    const order = ORDER_MAP[run.order];
    this.maxFaith = order.faith + (meta.faith || 0) + (this.has("candle") ? 2 : 0);
    this.regen = 0.55 * order.regen * (1 + 0.08 * (meta.regen || 0)) * (run.vows.includes("fasting") ? 0.6 : 1);
    this.drawIv = 3 * (1 - 0.08 * (meta.hands || 0)) * (this.has("rosary") ? 0.75 : 1);
    this.handSize = 4 + (this.has("reliquary") ? 1 : 0) - (run.vows.includes("idle") ? 1 : 0);
    this.dmgBase = order.dmg * (1 + 0.04 * (meta.fervor || 0) + (this.has("shard") ? 0.15 : 0));
    this.grazeFaith = 0.2 * (1 + 0.1 * (meta.graze || 0)) * (this.has("hairshirt") ? 1.6 : 1);
    this.grazeR = this.has("lantern") ? 24 : 16;
    this.hymnMul = this.has("thurible") ? 1.3 : 1;
    this.glossMul = this.has("ink") ? 1.5 : 1;
    this.slotMax = this.has("twin") ? 2 : 1;
    this.recomputeDiff();
    this.faith = kind === "tutorial" ? this.maxFaith : Math.min(this.maxFaith, 4);
    this.shield = this.has("nail") ? 1 : 0;
    this.drawPile = shuffle(run.deck.map((d) => ({ ...d })));
    this.bg = makeBg(run.act);
    this.vignette = this.makeVignette();
    if (kind === "tutorial") {
      this.tut = { step: 0, entered: false };
      this.hand = [];
    } else {
      for (let i = 0; i < this.handSize; i++) this.later(0.25 + i * 0.22, () => this.drawCard(false));
    }
    this.wave.D = 34 + 6 * Math.min(this.act, 3);
    this.invuln = 1.5;
    this.attachInput();
    this.fit(canvas.clientWidth || W, canvas.clientHeight || H);
    audio.setIntensity(kind === "boss" ? 0.55 : 0.3, kind === "boss" ? 1 : 0);
  }

  recomputeDiff() {
    const d = DIFF_MAP[this.run.diff] || DIFF_MAP.zealot;
    this.bspd = d.speed * (this.run.vows.includes("wrath") ? 1.15 : 1) * (1 + 0.04 * Math.max(0, this.act - 1));
    this.density = d.density * (this.run.vows.includes("plague") ? 1.4 : 1);
    this.hpScale = d.hp * (1 + 0.3 * (this.act - 1));
  }

  makeVignette() {
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d")!;
    const g = x.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.78);
    g.addColorStop(0, "rgba(4,2,10,0.42)");
    g.addColorStop(1, "rgba(2,0,6,0.92)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    return c;
  }

  fit(cssW: number, cssH: number) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(2, Math.round(cssW * dpr));
    this.canvas.height = Math.max(2, Math.round((cssW * H / W) * dpr));
    this.canvas.style.width = cssW + "px";
    this.canvas.style.height = (cssW * H / W) + "px";
    this.sc = this.canvas.width / W;
    void cssH;
  }

  // ---------- helpers for enemies / bosses ----------
  iv(x: number) { return x / Math.sqrt(this.density); }
  dn(n: number) { return Math.max(3, Math.round(n * (0.75 + 0.25 * this.density))); }
  aim(x: number, y: number) { return Math.atan2(this.py - y, this.px - x); }
  later(t: number, fn: () => void) { this.delayed.push({ t, fn }); }
  laterN() { return this.delayed.length; }
  sfx(n: string, p = 0) { audio.sfx(n, p); }

  bul(x: number, y: number, a: number, s: number, o: BulOpts = {}) {
    if (this.bullets.length > 2200) return;
    const k = this.bspd;
    this.bullets.push({
      x, y, a, s: s * k, ds: (o.ds || 0) * k, da: o.da || 0, smax: (o.smax ?? 9999) * k, smin: (o.smin ?? 0) * k,
      r: o.r ?? 5, c: o.c ?? 0, shape: o.shape ?? 0, t: 0, grazed: false, sp: o.sp || 0, st: o.st || 0, sn: o.sn || 0, dead: false,
    });
  }
  ringFrom(x: number, y: number, n: number, s: number, o: BulOpts, off = 0, gaps: number[] = [], gw = 0) {
    n = this.dn(n);
    for (let i = 0; i < n; i++) {
      const a = off + (i * TAU) / n;
      let skip = false;
      for (const ga of gaps) {
        let d = (a - ga) % TAU;
        if (d > Math.PI) d -= TAU;
        if (d < -Math.PI) d += TAU;
        if (Math.abs(d) < gw) { skip = true; break; }
      }
      if (!skip) this.bul(x, y, a, s, o);
    }
  }
  beam(o: { x?: number; y?: number; a: number; w: number; warn: number; dur: number; angVel?: number; follow?: Enemy }) {
    this.beams.push({ x: o.follow ? o.follow.x : o.x ?? 0, y: o.follow ? o.follow.y : o.y ?? 0, a: o.a, w: o.w, warn: o.warn, dur: o.dur, t: 0, angVel: o.angVel || 0, follow: o.follow, gcd: 0, fired: false, dead: false });
  }

  ftext(x: number, y: number, text: string, color = "#fff", size = 14) {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ x, y, text, color, size, life: 0.9, max: 0.9, vy: -42 });
  }
  burst(x: number, y: number, color: string, n: number, speed: number, life = 0.5, size = 3) {
    n = Math.round(n * this.settings.particles);
    const cap = 1500 * this.settings.particles;
    for (let i = 0; i < n && this.parts.length < cap; i++) {
      const a = Math.random() * TAU, s = speed * (0.25 + Math.random() * 0.75);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, drag: 2.2 });
    }
  }
  doShake(v: number) { this.shake = Math.max(this.shake, v); }
  flash(c: string, a: number) { this.flashC = c; this.flashA = Math.max(this.flashA, a); }
  clearField() { for (const b of this.bullets) b.dead = true; this.bullets.length = 0; this.enemies.forEach((e) => { if (!e.boss) e.dead = true; }); this.enemies = this.enemies.filter((e) => !e.dead); this.beams.length = 0; this.delayed.length = 0; }
  tutSpawnCherubs() { [150, 300, 450].forEach((x, i) => this.later(i * 0.7, () => spawnEnemy(this, "cherub", x, -20, i))); }

  addScore(v: number) { this.run.stats.score += Math.round(v * (1 + this.fervor / 25)); }
  gainFervor(v: number) {
    this.fervor = Math.min(100, this.fervor + v);
    this.idleT = 0;
    if (this.fervor > this.run.stats.maxFervor) this.run.stats.maxFervor = this.fervor;
  }
  gainFaith(v: number) { this.faith = Math.min(this.maxFaith, this.faith + v); }
  dmgMult() {
    return this.dmgBase * (1 + this.fervor * 0.002) * (this.zealT > 0 ? 1.3 : 1) * (this.trinityT > 0 ? 1.25 : 1);
  }

  // ---------- input ----------
  attachInput() {
    const kd = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "Escape" || e.code === "KeyP") { if (!e.repeat) this.cb.onPause(true); return; }
      this.keys.add(e.code);
      if (e.repeat) return;
      const m = /^(?:Digit|Numpad)([1-7])$/.exec(e.code);
      if (m) this.playCard(parseInt(m[1], 10) - 1);
      if (e.code === "KeyR") this.cycle();
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.code);
    const blur = () => { this.keys.clear(); this.rmb = false; if (this.settings.autoPause) this.cb.onPause(false); };
    const vis = () => { if (document.hidden && this.settings.autoPause) this.cb.onPause(false); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    const cv = this.canvas;
    const toLogical = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const pd = (e: PointerEvent) => {
      if (e.button === 2) { this.rmb = true; return; }
      const p = toLogical(e);
      if (e.pointerType !== "mouse") {
        this.touch = { sx: p.x, sy: p.y, px: this.px, py: this.py, id: e.pointerId };
        try { cv.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      } else this.target = p;
    };
    const pm = (e: PointerEvent) => {
      const p = toLogical(e);
      if (e.pointerType === "mouse") { this.target = p; this.keys.delete("__kb"); }
      else if (this.touch && this.touch.id === e.pointerId) this.target = { x: this.touch.px + (p.x - this.touch.sx) * 1.15, y: this.touch.py + (p.y - this.touch.sy) * 1.15 };
    };
    const pu = (e: PointerEvent) => {
      if (e.button === 2) this.rmb = false;
      if (this.touch && this.touch.id === e.pointerId) { this.touch = null; this.target = null; }
    };
    const cm = (e: Event) => e.preventDefault();
    cv.addEventListener("pointerdown", pd);
    cv.addEventListener("pointermove", pm);
    cv.addEventListener("pointerup", pu);
    cv.addEventListener("pointercancel", pu);
    cv.addEventListener("contextmenu", cm);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
      cv.removeEventListener("pointerdown", pd);
      cv.removeEventListener("pointermove", pm);
      cv.removeEventListener("pointerup", pu);
      cv.removeEventListener("pointercancel", pu);
      cv.removeEventListener("contextmenu", cm);
    });
  }

  pollPad(): { x: number; y: number; focus: boolean } | null {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) if (p && p.connected) { pad = p; break; }
    if (!pad) return null;
    const btn = (i: number) => !!pad!.buttons[i]?.pressed;
    const edge = (i: number) => { const v = btn(i); const r = v && !this.padPrev[i]; this.padPrev[i] = v; return r; };
    if (edge(0)) this.playCard(0);
    if (edge(1)) this.playCard(1);
    if (edge(2)) this.playCard(2);
    if (edge(3)) this.playCard(3);
    if (edge(5)) this.playCard(4);
    if (edge(4)) this.cycle();
    if (edge(9)) this.cb.onPause(true);
    let x = pad.axes[0] || 0, y = pad.axes[1] || 0;
    if (btn(14)) x = -1; if (btn(15)) x = 1; if (btn(12)) y = -1; if (btn(13)) y = 1;
    if (Math.hypot(x, y) < 0.2) { x = 0; y = 0; }
    return { x, y, focus: btn(6) || btn(7) };
  }

  // ---------- lifecycle ----------
  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.stopped) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (!(dt > 0)) dt = 0.016;
      if (dt > 0.05) dt = 0.05;
      if (!this.paused) this.update(dt);
      this.render();
      this.snapT -= dt;
      if (this.snapT <= 0) { this.snapT = 0.05; this.cb.onSnap(this.snapshot()); }
    };
    this.raf = requestAnimationFrame(loop);
    this.cb.onSnap(this.snapshot());
  }
  destroy() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }
  setPaused(p: boolean) {
    this.paused = p;
    if (p) { this.keys.clear(); this.rmb = false; this.touch = null; }
    else this.last = performance.now();
  }

  // ---------- cards ----------
  giveHand(ids: string[]) {
    this.discard.push(...this.hand);
    this.hand = ids.map((id, i) => ({ uid: -(i + 1) - Math.floor(Math.random() * 1e6), id, up: false }));
  }
  drawCard(force: boolean) {
    const cap = force ? 7 : this.handSize;
    if (this.hand.length >= cap) return false;
    if (!this.drawPile.length) {
      if (!this.discard.length) return false;
      this.drawPile = shuffle(this.discard);
      this.discard = [];
      this.ftext(this.px, this.py - 50, "Reshuffle", "#b78bff", 12);
      audio.sfx("shuffle");
    }
    this.hand.push(this.drawPile.pop()!);
    audio.sfx("draw");
    return true;
  }
  effCost(inst: CardInst) {
    const def = CARD_MAP[inst.id];
    let c = cardBaseCost(inst);
    if (def.type === "wrath" && this.has("knucklebone")) c = Math.max(1, c - 1);
    return c;
  }
  canPlay(inst: CardInst) {
    const def = CARD_MAP[inst.id];
    if (this.faith + 1e-6 < this.effCost(inst)) return false;
    if (def.id === "tithe" && this.run.hp <= 1) return false;
    if (def.id === "mend" && this.run.hp >= this.run.maxHp) return false;
    if (def.id === "barrier" && this.shield >= 3) return false;
    return true;
  }
  deny(inst: CardInst) {
    this.denyUid = inst.uid; this.denyT = 0.4;
    audio.sfx("deny");
  }
  canAct() { return !this.paused && !this.dead && !this.cleared; }

  cycle() {
    if (!this.canAct() || this.cycleCd > 0 || this.hand.length === 0) return;
    if (this.faith < 1) { audio.sfx("deny"); return; }
    this.faith -= 1;
    this.cycleCd = 6;
    this.cycles++;
    const old = this.hand.splice(0);
    for (let i = 0; i < old.length; i++) this.drawCard(true);
    this.discard.push(...old);
    this.drawT = 0;
    this.ftext(this.px, this.py - 40, "RECITE", "#b78bff", 14);
    audio.sfx("shuffle");
  }

  playCard(i: number) {
    if (!this.canAct()) return;
    const inst = this.hand[i];
    if (!inst) return;
    if (!this.canPlay(inst)) { this.deny(inst); return; }
    const def = CARD_MAP[inst.id];
    const p = cardParams(inst);
    this.faith -= this.effCost(inst);
    this.hand.splice(i, 1);
    if (def.exhaust) this.exhausted.push(inst); else this.discard.push(inst);
    this.run.stats.cardsPlayed++;
    this.playedTypes.add(def.type);
    const col = TYPE_META[def.type].color;
    this.ftext(this.px, this.py - 34, def.name.toUpperCase(), col, 13);
    this.burst(this.px, this.py, col, 18, 220, 0.5, 3);
    audio.sfx("card_" + def.type);
    this.applyCard(def.id, p);
    // chain / trinity
    this.chain = this.chain.filter((c) => this.time - c.t < 4.5);
    this.chain.push({ type: def.type, t: this.time });
    if (this.chain.length >= 3) {
      const l = this.chain.slice(-3).map((c) => c.type);
      if (new Set(l).size === 3) {
        this.chain = [];
        this.gainFaith(2);
        this.trinityT = 6;
        this.ftext(this.px, this.py - 62, "✠ TRINITY ✠", "#ffe9a8", 18);
        this.flash("#ffe9a8", 0.25);
        this.doShake(5);
        audio.sfx("trinity");
      }
    }
  }

  applyCard(id: string, p: Record<string, number>) {
    const def = CARD_MAP[id];
    const wd = this.has("wick") ? 1.5 : 1;
    switch (def.type) {
      case "hymn": {
        const pat: Pattern = { id, t: p.dur * this.hymnMul, max: p.dur * this.hymnMul, acc: 0.5, a: 0, side: 0, p, ang: 0 };
        const ex = this.patterns.findIndex((q) => q.id === id);
        if (ex >= 0) this.patterns[ex] = pat;
        else { if (this.patterns.length >= this.slotMax) this.patterns.shift(); this.patterns.push(pat); }
        break;
      }
      case "gloss": {
        const gl: Gloss = { id, t: p.dur * this.glossMul, max: p.dur * this.glossMul, p };
        const ex = this.glosses.findIndex((q) => q.id === id);
        if (ex >= 0) this.glosses[ex] = gl; else this.glosses.push(gl);
        break;
      }
      case "ward":
        if (id === "barrier") this.shield = Math.min(3, this.shield + p.n);
        else if (id === "aegis") this.aegisT = p.dur;
        else if (id === "veil") this.veilT = p.dur;
        else if (id === "penumbra") this.penT = p.dur;
        else if (id === "sanctuary") { this.heal(1); this.shield = Math.min(3, this.shield + 1); this.invuln = Math.max(this.invuln, 2); }
        break;
      case "wrath": {
        if (id === "purge") {
          let n = 0;
          for (const b of this.bullets) { n++; if (n < 90) this.burst(b.x, b.y, BCOL[b.c % 6], 2, 80, 0.5, 2.5); b.dead = true; }
          this.bullets.length = 0;
          this.beams.length = 0;
          this.run.stats.purged += n;
          const gain = Math.min(p.cap, n * 0.06);
          this.gainFaith(gain);
          if (gain > 0.2) this.ftext(this.px, this.py - 70, "+" + gain.toFixed(1) + " Faith", "#7da2ff", 14);
          this.hurtAll(p.dmg * wd);
          this.fxs.push({ kind: "ring", x: this.px, y: this.py, r: 0, w: 900, t: 0, dur: 0.6, color: "#ffffff", dmg: 0, clear: false, hit: [] });
          this.flash("#ffffff", 0.45); this.doShake(12);
        } else if (id === "smite") {
          const hw = p.w / 2;
          for (const e of this.enemies) if (!e.dead && Math.abs(e.x - this.px) < hw + e.r && e.y < this.py) this.damageEnemy(e, p.dmg * this.dmgMult() * wd * 0.9);
          for (const b of this.bullets) if (Math.abs(b.x - this.px) < hw && b.y < this.py) { b.dead = true; this.burst(b.x, b.y, "#fff3b0", 1, 60, 0.4, 2.5); }
          this.fxs.push({ kind: "col", x: this.px, y: this.py, r: 0, w: p.w, t: 0, dur: 0.45, color: "#fff3b0", dmg: 0, clear: false, hit: [] });
          this.flash("#fff3b0", 0.3); this.doShake(10);
        } else if (id === "absolution") {
          this.invuln = Math.max(this.invuln, 2);
          this.fxs.push({ kind: "ring", x: this.px, y: this.py, r: 0, w: 1100, t: 0, dur: 0.9, color: "#ffd0dd", dmg: p.dmg * wd, clear: true, hit: [] });
          this.flash("#ffd0dd", 0.4); this.doShake(10);
        } else if (id === "cinder_rain") {
          for (let i = 0; i < p.n; i++) {
            this.later(0.12 + i * 0.09, () => {
              const x = rnd(40, W - 40), y = rnd(60, H * 0.62);
              this.fxs.push({ kind: "ring", x, y, r: 0, w: 70, t: 0, dur: 0.35, color: "#ff8a3d", dmg: 0, clear: false, hit: [] });
              this.burst(x, y, "#ff9a4d", 14, 200, 0.5, 3);
              for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) < 74 + e.r) { this.damageEnemy(e, p.dmg * this.dmgMult() * wd); e.burn = 3; e.burnDps = 6; }
              audio.sfx("kill");
              this.doShake(3);
            });
          }
        }
        if (this.has("wick")) this.gainFaith(1);
        audio.sfx("boom");
        break;
      }
      case "vow":
        if (id === "litany") for (let i = 0; i < p.n; i++) this.later(0.05 + i * 0.12, () => this.drawCard(true));
        else if (id === "fasting") this.gainFaith(p.n);
        else if (id === "tithe") {
          this.run.hp = Math.max(1, this.run.hp - 1); this.gainFaith(5); this.run.stats.tithes++;
          for (let i = 0; i < p.n; i++) this.later(0.05 + i * 0.12, () => this.drawCard(true));
          this.flash("#ff1133", 0.3); this.doShake(6);
        } else if (id === "mend") this.heal(1);
        else if (id === "hush") this.hushT = p.dur;
        else if (id === "zeal") { this.gainFervor(p.fervor); this.zealT = p.dur; }
        else if (id === "rapture") this.raptureT = p.dur;
        break;
    }
  }

  heal(n: number) {
    this.run.hp = Math.min(this.run.maxHp, this.run.hp + n);
    this.ftext(this.px, this.py - 40, "+" + n + " HP", "#ff9ab0", 15);
    this.burst(this.px, this.py, "#ff9ab0", 14, 120, 0.7, 3);
  }
  hurtAll(d: number) { for (const e of this.enemies) if (!e.dead && e.y > -5) this.damageEnemy(e, d); }

  // ---------- combat ----------
  damageEnemy(e: Enemy, dmg: number) {
    if (e.dead) return;
    const B = e.boss;
    if (B && (B.inv > 0 || B.introT > 0)) { this.burst(e.x + rnd(-20, 20), e.y + rnd(-20, 20), "#aaa", 1, 40, 0.2, 2); return; }
    e.hp -= dmg;
    e.flash = 0.06;
    this.run.stats.damage += dmg;
    if (dmg >= 12) this.ftext(e.x + rnd(-14, 14), e.y - e.r, String(Math.round(dmg)), "#fff", dmg >= 40 ? 18 : 13);
    if (B) {
      const next = B.def.phases[B.phase + 1];
      if (next && e.hp <= e.maxHp * next.at) this.nextPhase(e);
      else if (e.hp <= 0) this.kill(e);
    } else if (e.hp <= 0) this.kill(e);
  }

  nextPhase(b: Enemy) {
    const B = b.boss!;
    B.phase++;
    B.inv = 1.8; B.tms = []; B.pt = 0;
    const ph = B.def.phases[B.phase];
    b.hp = Math.max(1, Math.round(b.maxHp * ph.at) - 1);
    this.convertBullets(0.05);
    this.beams.length = 0;
    this.delayed = this.delayed.filter(() => false);
    this.doShake(18); this.flash("#ffffff", 0.5);
    this.slowT = 0.35;
    audio.sfx("boss_phase");
    this.banner = { text: ph.name, sub: "Phase " + (B.phase + 1) + " / " + B.def.phases.length, t: 2.6, max: 2.6, color: B.def.accent };
    this.burst(b.x, b.y, B.def.color, 60, 420, 0.9, 4);
    if (this.has("chalice")) this.heal(1);
    ph.enter?.(this, b);
  }

  convertBullets(v: number) {
    let n = 0;
    for (const b of this.bullets) {
      if (n++ < 60) this.motes.push({ x: b.x, y: b.y, vx: rnd(-30, 30), vy: rnd(-60, 0), v, t: 0 });
      b.dead = true;
    }
    this.bullets.length = 0;
  }

  kill(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    const s = this.run.stats;
    s.kills++;
    this.addScore(e.score);
    this.gainFervor(e.elite ? 6 : 1.5);
    if (this.mods.tithe > 0) this.gainFaith(this.mods.tithe);
    const col = e.type === "cherub" ? "#ffd9e8" : e.type === "sentinel" ? "#7da2ff" : "#ffb3c0";
    this.burst(e.x, e.y, col, e.elite ? 40 : 16, e.elite ? 320 : 220, 0.6, 3.5);
    this.burst(e.x, e.y, "#fff", 6, 150, 0.3, 2);
    this.doShake(e.elite ? 7 : 2);
    audio.sfx(e.boss ? "bigkill" : "kill");
    this.ftext(e.x, e.y, "+" + Math.round(e.score * (1 + this.fervor / 25)), "#f6d37a", e.elite ? 16 : 12);
    const drops = e.elite ? 7 : Math.random() < 0.55 ? 1 + (Math.random() < 0.25 ? 1 : 0) : 0;
    for (let i = 0; i < drops; i++) this.motes.push({ x: e.x, y: e.y, vx: rnd(-90, 90), vy: rnd(-120, 20), v: 0.28, t: 0 });
    if (e.type === "zealot") this.ringFrom(e.x, e.y, 6, 170, { c: 0, r: 4.5 }, this.aim(e.x, e.y), [], 0);
    if (e.boss) this.bossDown(e);
  }

  bossDown(b: Enemy) {
    this.run.stats.bosses++;
    this.convertBullets(0.1);
    this.beams.length = 0;
    this.delayed.length = 0;
    this.enemies.forEach((e) => { if (e !== b && !e.dead) { e.dead = true; this.burst(e.x, e.y, "#fff", 10, 200, 0.4, 3); } });
    for (let i = 0; i < 14; i++) this.later(i * 0.12, () => { this.burst(b.x + rnd(-50, 50), b.y + rnd(-50, 50), b.boss!.def.color, 24, 380, 0.8, 4); this.doShake(8); audio.sfx(i % 3 === 0 ? "bigkill" : "kill"); });
    this.later(1.7, () => { this.flash("#ffffff", 0.9); audio.sfx("boom"); this.burst(b.x, b.y, "#ffffff", 120, 600, 1.2, 5); });
    this.slowT = 1.0;
    this.banner = { text: "BOSS FELLED", sub: b.boss!.def.name, t: 3.5, max: 3.5, color: "#f6d37a" };
    this.beginClear(3.8);
  }

  beginClear(t: number) {
    this.cleared = true;
    this.clearT = t;
    this.invuln = 99;
    this.convertBullets(0.05);
    this.beams.length = 0;
    audio.sfx("victory");
  }

  hitPlayer() {
    if (this.invuln > 0 || this.aegisT > 0 || this.dead || this.cleared) return;
    if (this.tut) {
      this.invuln = 1.2;
      this.ftext(this.px, this.py - 30, "HIT! (-1 HP in a real run)", "#ff6a80", 13);
      this.flash("#ff1133", 0.25); this.doShake(6); audio.sfx("hurt");
      this.bullets.forEach((b) => { if (Math.hypot(b.x - this.px, b.y - this.py) < 100) b.dead = true; });
      return;
    }
    if (this.shield > 0) {
      this.shield--;
      this.invuln = 0.9;
      this.fxs.push({ kind: "ring", x: this.px, y: this.py, r: 0, w: 180, t: 0, dur: 0.4, color: "#f6d37a", dmg: 0, clear: true, hit: [] });
      this.burst(this.px, this.py, "#f6d37a", 30, 300, 0.6, 3);
      this.ftext(this.px, this.py - 30, "WARDED", "#f6d37a", 16);
      this.doShake(6); audio.sfx("pop");
      return;
    }
    this.run.hp--;
    this.run.stats.hits++;
    this.fervor *= 0.4;
    this.invuln = 2 + (this.has("veil") ? 1 : 0);
    if (this.has("veil")) this.gainFaith(3);
    this.doShake(16);
    this.flash("#ff1133", 0.55);
    this.slowT = 0.3;
    audio.sfx("hurt");
    this.burst(this.px, this.py, "#ff5d7a", 40, 380, 0.7, 4);
    this.fxs.push({ kind: "ring", x: this.px, y: this.py, r: 0, w: 220, t: 0, dur: 0.45, color: "#ff5d7a", dmg: 0, clear: true, hit: [] });
    if (this.run.hp <= 0) {
      this.run.hp = 0;
      this.dead = true;
      this.deadT = 0;
      this.slowT = 1.2;
      this.burst(this.px, this.py, "#ffffff", 80, 500, 1.2, 4);
      this.burst(this.px, this.py, "#52e5ff", 60, 300, 1.4, 3);
      audio.sfx("bigkill");
    }
  }

  // ---------- update ----------
  update(dt: number) {
    this.frame++;
    if (this.slowT > 0) this.slowT -= dt;
    const gdt = dt * (this.slowT > 0 ? 0.3 : 1);
    this.time += gdt;
    this.run.stats.time += gdt;
    const hushTarget = this.hushT > 0 ? 0.4 : 1;
    this.ts += (hushTarget - this.ts) * Math.min(1, gdt * 8);
    const edt = gdt * this.ts;

    // delayed callbacks
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const d = this.delayed[i];
      d.t -= gdt;
      if (d.t <= 0) { this.delayed.splice(i, 1); d.fn(); }
    }

    this.updatePlayer(gdt);
    this.updateCards(gdt);
    this.updatePatterns(gdt);
    this.updatePBullets(gdt);
    this.updateEnemies(edt, gdt);
    this.updateBullets(edt);
    this.updateBeams(edt);
    this.updateMotes(gdt);
    this.updateFx(gdt);
    if (this.tut) this.updateTutorial(gdt);
    else this.updateDirector(gdt);

    // cleanup arrays
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.bgY += (28 + this.bossFactor() * 40) * gdt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 40);
    if (this.flashA > 0) this.flashA = Math.max(0, this.flashA - dt * 1.8);
    if (this.denyT > 0) { this.denyT -= dt; if (this.denyT <= 0) this.denyUid = -1; }

    // music reactivity
    this.musT -= dt;
    if (this.musT <= 0) {
      this.musT = 0.4;
      const base = this.kind === "boss" ? 0.5 : this.tut ? 0.2 : 0.28;
      audio.setIntensity(base + Math.min(0.3, this.bullets.length / 450) + (this.run.hp <= 1 ? 0.1 : 0) + this.fervor / 600, this.kind === "boss" ? 1 : 0);
    }

    if (this.cleared) {
      this.clearT -= dt;
      if (this.clearT <= 0 && !this.notified) { this.notified = true; this.cb.onClear(); }
    }
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 1.9 && !this.deathNotified) { this.deathNotified = true; this.cb.onDeath(); }
    }
  }

  bossFactor() { return this.boss && !this.boss.dead ? 1 : 0; }

  updatePlayer(dt: number) {
    if (this.dead) return;
    const pad = this.pollPad();
    let dx = 0, dy = 0;
    const k = this.keys;
    if (k.has("KeyA") || k.has("ArrowLeft")) dx -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) dx += 1;
    if (k.has("KeyW") || k.has("ArrowUp")) dy -= 1;
    if (k.has("KeyS") || k.has("ArrowDown")) dy += 1;
    if (pad) { dx += pad.x; dy += pad.y; }
    this.focus = k.has("ShiftLeft") || k.has("ShiftRight") || this.rmb || !!pad?.focus;
    const sp = this.focus ? 150 : 340;
    const ox = this.px, oy = this.py;
    if (dx || dy) {
      this.target = null;
      const l = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, l);
      this.px += (dx / l) * sp * m * dt;
      this.py += (dy / l) * sp * m * dt;
    } else if (this.target) {
      const tx = this.target.x, ty = this.target.y;
      const d = Math.hypot(tx - this.px, ty - this.py);
      if (d > 0.5) {
        const step = Math.min(d, (this.focus ? 230 : 560) * dt);
        this.px += ((tx - this.px) / d) * step;
        this.py += ((ty - this.py) / d) * step;
      }
    }
    this.px = clamp(this.px, 14, W - 14);
    this.py = clamp(this.py, 50, H - 14);
    this.moved += Math.hypot(this.px - ox, this.py - oy);
    if (this.focus) this.focusTime += dt;
    if (this.invuln > 0) this.invuln -= dt;
    for (const key of ["aegisT", "veilT", "penT", "hushT", "zealT", "raptureT", "trinityT"] as const) if (this[key] > 0) this[key] = Math.max(0, this[key] - dt);
    if (this.cycleCd > 0) this.cycleCd -= dt;
    this.gainFaith(this.regen * dt * (this.raptureT > 0 ? 2.5 : 1));
    this.idleT += dt;
    if (this.idleT > 2.5 && this.fervor > 0) this.fervor = Math.max(0, this.fervor - 5 * (this.has("wax") ? 0.5 : 1) * dt);
    if (this.grazeStreakT > 0) { this.grazeStreakT -= dt; if (this.grazeStreakT <= 0) this.grazeStreak = 0; }
    // engine trail
    if (this.frame % 3 === 0 && this.parts.length < 900) this.parts.push({ x: this.px + rnd(-3, 3), y: this.py + 12, vx: rnd(-10, 10), vy: rnd(60, 120), life: 0.3, max: 0.3, size: 2.5, color: "#52e5ff", drag: 1 });
  }

  updateCards(dt: number) {
    for (const g of this.glosses) g.t -= dt;
    this.glosses = this.glosses.filter((g) => g.t > 0);
    const m: Mods = { pierce: 0, homing: 0, bounce: 0, split: 0, burn: 0, heavy: 1, echo: false, tithe: 0 };
    for (const g of this.glosses) {
      switch (g.id) {
        case "pierce": m.pierce += g.p.n; break;
        case "guide": m.homing = 1; break;
        case "cloister": m.bounce = g.p.n; break;
        case "fission": m.split = g.p.n; break;
        case "cinders": m.burn = g.p.dps; break;
        case "heavy": m.heavy = g.p.mult; break;
        case "echo": m.echo = true; break;
        case "tithe_rounds": m.tithe = g.p.faith; break;
      }
    }
    this.mods = m;
    if (this.tut && this.tut.step < 8) { this.drawT = 0; return; }
    if (this.hand.length >= this.handSize) this.drawT = 0;
    else {
      this.drawT += dt;
      if (this.drawT >= this.drawIv) { this.drawCard(false); this.drawT = 0; }
    }
  }

  shoot(x: number, y: number, ang: number, spd: number, dmg: number, o: { shape?: number; r?: number; homing?: number; wave?: number; ph?: number; pierce?: number; noMods?: boolean } = {}) {
    if (this.pbullets.length > 600) return;
    const m = this.mods;
    const d = dmg * this.dmgMult() * (o.noMods ? 1 : m.heavy);
    const pb: PBullet = {
      x, y, x0: x, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, dmg: d, r: o.r ?? 4,
      pierce: (o.pierce ?? 0) + (o.noMods ? 0 : m.pierce), homing: Math.max(o.homing ?? 0, o.noMods ? 0 : m.homing),
      bounce: o.noMods ? 0 : m.bounce, split: o.noMods ? 0 : m.split, burn: o.noMods ? 0 : m.burn, life: 1.8, shape: o.shape ?? 0, hits: [], age: 0,
      wave: o.wave ?? 0, ph: o.ph ?? 0, dead: false, noSplit: !!o.noMods, tithe: 0,
    };
    this.pbullets.push(pb);
    if (m.echo && !o.noMods) this.pbullets.push({ ...pb, x: x - Math.cos(ang) * 30, y: y - Math.sin(ang) * 30, x0: x, dmg: d * 0.6, hits: [] });
  }

  updatePatterns(dt: number) {
    const foc = this.focus;
    const rateMul = this.mods.heavy > 1 ? 0.75 : 1;
    const px = this.px, py = this.py;
    let fires = false;
    this.orbs.length = 0;
    this.drones.length = 0;
    for (const p of this.patterns) {
      p.t -= dt;
      if (p.id !== "halo") fires = true;
      const rate = (p.p.rate || 0) * rateMul;
      if (p.id === "halo") {
        p.ang += 3.2 * dt;
        const n = p.p.n, R = foc ? 34 : 54;
        for (let i = 0; i < n; i++) { const a = p.ang + (i * TAU) / n; this.orbs.push({ x: px + Math.cos(a) * R, y: py + Math.sin(a) * R }); }
        continue;
      }
      if (p.id === "choir") {
        const off = foc ? 22 : 48;
        this.drones.push({ x: px - off, y: py + 8 }, { x: px + off, y: py + 8 });
      }
      p.acc += dt * rate;
      let guard = 0;
      while (p.acc >= 1 && guard++ < 4) {
        p.acc -= 1;
        this.firePattern(p, foc);
      }
    }
    this.patterns = this.patterns.filter((p) => p.t > 0);
    if (!fires && !this.dead) {
      this.sfxShootT -= dt;
      this.baseAcc += dt * 8.5 * rateMul;
      while (this.baseAcc >= 1) {
        this.baseAcc -= 1;
        this.shoot(px - 7, py - 10, -Math.PI / 2, 900, 1.5, { shape: 1, r: 3 });
        this.shoot(px + 7, py - 10, -Math.PI / 2, 900, 1.5, { shape: 1, r: 3 });
      }
    }
    if (fires || this.baseAcc > 0) { /* sound handled in firePattern */ }
    if (!this.dead && this.frame % 6 === 0) audio.sfx("shoot");
  }
  baseAcc = 0;

  firePattern(p: Pattern, foc: boolean) {
    const px = this.px, py = this.py - 10, q = p.p, up = -Math.PI / 2;
    switch (p.id) {
      case "aspersion": {
        const n = q.n, spread = foc ? 0.2 : 0.62;
        for (let i = 0; i < n; i++) this.shoot(px, py, up + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread), 820, q.dmg, { r: 4 });
        break;
      }
      case "needle":
        for (let k = -1; k <= 1; k++) this.shoot(px + k * (foc ? 4 : 9), py, up + (Math.random() - 0.5) * (foc ? 0.01 : 0.07), 1100, q.dmg, { shape: 1, r: 3 });
        break;
      case "seraph":
        p.side ^= 1;
        this.shoot(px + (p.side ? 14 : -14), py + 4, up + (p.side ? 0.9 : -0.9), 560, q.dmg, { shape: 3, r: 4, homing: 1 });
        break;
      case "lance":
        this.shoot(px, py - 6, up, 1350, q.dmg * (foc ? 1.35 : 1), { shape: 2, r: 9, pierce: 99 });
        break;
      case "rotary": {
        p.a += 0.28;
        const n = q.n;
        for (let k = 0; k < n; k++) this.shoot(px, py + 8, p.a + (k * TAU) / n, 650, q.dmg, { r: 3.5 });
        break;
      }
      case "wave": {
        const amp = foc ? 12 : 30;
        this.shoot(px, py, up, 780, q.dmg, { wave: amp, ph: 0, r: 4 });
        this.shoot(px, py, up, 780, q.dmg, { wave: amp, ph: Math.PI, r: 4 });
        break;
      }
      case "choir": {
        const off = foc ? 22 : 48;
        this.shoot(px - off, py + 8, up, 900, q.dmg, { r: 3.5, shape: 1 });
        this.shoot(px + off, py + 8, up, 900, q.dmg, { r: 3.5, shape: 1 });
        break;
      }
    }
  }

  updatePBullets(dt: number) {
    const en = this.enemies;
    for (const p of this.pbullets) {
      p.age += dt;
      p.life -= dt;
      if (p.homing > 0) {
        let best: Enemy | null = null, bd = 1e9;
        for (const e of en) { if (e.dead || e.y < 0) continue; const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d < bd) { bd = d; best = e; } }
        if (best) {
          const sp = Math.hypot(p.vx, p.vy);
          const cur = Math.atan2(p.vy, p.vx);
          const want = Math.atan2(best.y - p.y, best.x - p.x);
          let df = want - cur;
          while (df > Math.PI) df -= TAU;
          while (df < -Math.PI) df += TAU;
          const na = cur + clamp(df, -6 * dt * p.homing, 6 * dt * p.homing);
          p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
        }
      }
      if (p.wave) { p.y += p.vy * dt; p.x = p.x0 + Math.sin(p.age * 9 + p.ph) * p.wave; }
      else { p.x += p.vx * dt; p.y += p.vy * dt; }
      if (p.bounce > 0 && (p.x < 8 || p.x > W - 8)) { p.vx = -p.vx; p.x = clamp(p.x, 8, W - 8); p.bounce--; }
      if (p.y < -30 || p.y > H + 30 || p.x < -30 || p.x > W + 30 || p.life <= 0) { p.dead = true; continue; }
      for (const e of en) {
        if (e.dead || e.y < -2) continue;
        const rr = e.r + p.r;
        if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > rr * rr) continue;
        if (p.hits.includes(e.id)) continue;
        p.hits.push(e.id);
        this.damageEnemy(e, p.dmg);
        if (p.burn > 0) { e.burn = 3; e.burnDps = p.burn; }
        if (this.frame % 2 === 0) this.burst(p.x, p.y, "#bff4ff", 2, 140, 0.25, 2);
        audio.sfx("hit");
        if (p.split > 0 && !p.noSplit) {
          for (let i = 0; i < p.split; i++) {
            const a = -Math.PI / 2 + (i - (p.split - 1) / 2) * 0.9 + rnd(-0.2, 0.2);
            this.shoot(p.x, p.y, a, 620, p.dmg * 0.45 / Math.max(1, this.mods.heavy), { shape: 3, r: 3, pierce: 1, noMods: true });
          }
        }
        if (p.pierce <= 0) { p.dead = true; break; }
        p.pierce--;
      }
    }
    this.pbullets = this.pbullets.filter((p) => !p.dead);
    // halo orbs
    if (this.orbs.length) {
      const hp = this.patterns.find((p) => p.id === "halo");
      const dmg = (hp?.p.dmg || 6) * this.dmgMult();
      for (const o of this.orbs) {
        for (const e of en) {
          if (e.dead || e.y < 0 || e.haloCd > 0) continue;
          if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (e.r + 12) ** 2) { e.haloCd = 0.12; this.damageEnemy(e, dmg); }
        }
        for (const b of this.bullets) {
          if (b.dead || b.r > 8) continue;
          if ((b.x - o.x) ** 2 + (b.y - o.y) ** 2 < (b.r + 13) ** 2) {
            b.dead = true; this.gainFaith(0.04); this.burst(b.x, b.y, "#bff4ff", 2, 90, 0.25, 2);
          }
        }
      }
    }
  }

  updateEnemies(edt: number, gdt: number) {
    if (this.bossSpawnT > 0 && this.kind === "boss" && !this.boss) {
      this.bossSpawnT -= gdt;
      if (this.bossSpawnT <= 0) this.spawnBoss();
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.boss) this.updateBoss(e, edt); else updateEnemy(this, e, edt);
      if (e.dead) continue;
      if (e.flash > 0) e.flash -= gdt;
      if (e.haloCd > 0) e.haloCd -= gdt;
      if (e.ramCd > 0) e.ramCd -= gdt;
      if (e.burn > 0) { e.burn -= gdt; this.damageEnemy(e, e.burnDps * gdt); }
      if (e.dead) continue;
      if (e.y > 0) {
        const d = Math.hypot(e.x - this.px, e.y - this.py);
        if (d < e.r * 0.8 + this.hpHit) this.hitPlayer();
        if (this.aegisT > 0 && d < e.r + 30 && e.ramCd <= 0) { e.ramCd = 0.2; this.damageEnemy(e, 30 * this.dmgMult()); this.burst(e.x, e.y, "#f6d37a", 4, 200, 0.3, 3); }
      }
    }
  }

  spawnBoss() {
    const idx = (this.act - 1) % BOSSES.length;
    const def = BOSSES[idx];
    const cyc = Math.floor((this.act - 1) / BOSSES.length);
    const hp = Math.round(def.hp * DIFF_MAP[this.run.diff].hp * (this.run.vows.includes("idols") ? 1.3 : 1) * (1 + 0.45 * cyc));
    const e = spawnEnemy(this, "sentinel", W / 2, -90);
    e.type = "boss"; e.r = 46; e.hp = hp; e.maxHp = hp; e.elite = true; e.score = 5000 + this.act * 1000;
    e.boss = { def, phase: 0, inv: 2.6, pt: 0, tms: [], introT: 2.6, spin: 0 };
    this.boss = e;
    this.banner = { text: def.name, sub: def.title, t: 3, max: 3, color: def.accent };
    audio.sfx("boss_phase");
    def.phases[0].enter?.(this, e);
  }

  updateBoss(b: Enemy, dt: number) {
    const B = b.boss!;
    B.spin += dt;
    if (B.introT > 0) {
      B.introT -= dt;
      b.y += (140 - b.y) * Math.min(1, dt * 1.6);
      if (B.introT <= 0) { B.inv = 0; this.ftext(b.x, b.y + 70, "BEGIN", "#fff", 18); }
      return;
    }
    if (B.inv > 0) { B.inv -= dt; return; }
    B.pt += dt;
    B.def.phases[B.phase].run(this, b, dt);
  }

  updateBullets(dt: number) {
    const px = this.px, py = this.py;
    const slowR = this.penT > 0 ? 100 : 0;
    const veilR = this.veilT > 0 ? 70 : 0;
    const gr = this.grazeR;
    const live = !this.dead && !this.cleared;
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (b.dead) continue;
      b.t += dt;
      if (b.sp === 1 && b.t >= b.st) {
        b.dead = true;
        const n = this.dn(b.sn);
        const off = Math.random() * TAU;
        for (let k = 0; k < n; k++) this.bul(b.x, b.y, off + (k * TAU) / n, 130 / this.bspd, { c: b.c, r: 4 });
        this.burst(b.x, b.y, BCOL[b.c % 6], 8, 120, 0.4, 3);
        continue;
      }
      if (b.sp === 2 && b.t >= b.st) { b.a = Math.atan2(py - b.y, px - b.x); b.s = b.sn * this.bspd; b.sp = 0; }
      if (b.sp === 3 && b.t >= b.st) { b.da = 0; b.sp = 0; }
      if (b.da) b.a += b.da * dt;
      if (b.ds) { b.s += b.ds * dt; if (b.s > b.smax) b.s = b.smax; if (b.s < b.smin) b.s = b.smin; }
      let step = b.s * dt;
      const dx0 = b.x - px, dy0 = b.y - py;
      const d2 = dx0 * dx0 + dy0 * dy0;
      if (slowR && d2 < slowR * slowR) step *= 0.35;
      b.x += Math.cos(b.a) * step;
      b.y += Math.sin(b.a) * step;
      if (b.x < -50 || b.x > W + 50 || b.y < -50 || b.y > H + 50 || b.t > 16) { b.dead = true; continue; }
      if (!live) continue;
      const dx = b.x - px, dy = b.y - py;
      const dd = dx * dx + dy * dy;
      if (veilR && dd < veilR * veilR) {
        b.dead = true;
        let best: Enemy | null = null, bd = 1e9;
        for (const e of this.enemies) { if (e.dead || e.y < 0) continue; const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2; if (d < bd) { bd = d; best = e; } }
        const ang = best ? Math.atan2(best.y - b.y, best.x - b.x) : -Math.PI / 2;
        this.shoot(b.x, b.y, ang, 700, 3.2, { shape: 4, r: 5, noMods: true });
        continue;
      }
      const hr = b.r * 0.7 + this.hpHit;
      if (dd < hr * hr) { b.dead = true; this.hitPlayer(); continue; }
      if (!b.grazed) {
        const gg = b.r + gr;
        if (dd < gg * gg) {
          b.grazed = true;
          this.graze(b.x, b.y);
        }
      }
    }
    // compact
    let w = 0;
    for (let i = 0; i < this.bullets.length; i++) if (!this.bullets[i].dead) this.bullets[w++] = this.bullets[i];
    this.bullets.length = w;
  }

  graze(x: number, y: number) {
    const s = this.run.stats;
    s.grazes++;
    this.grazeStreak++;
    this.grazeStreakT = 0.8;
    this.gainFaith(this.grazeFaith);
    this.gainFervor(1.6);
    this.addScore(30);
    if (this.frame % 2 === 0) this.burst((x + this.px) / 2, (y + this.py) / 2, "#fff6c8", 2, 90, 0.25, 2);
    audio.sfx("graze", Math.min(12, this.grazeStreak));
    if (this.grazeStreak > 0 && this.grazeStreak % 12 === 0) this.ftext(this.px, this.py - 28, "GRAZE x" + this.grazeStreak, "#fff6c8", 13);
  }

  updateBeams(dt: number) {
    for (const bm of this.beams) {
      bm.t += dt;
      if (bm.follow) { if (bm.follow.dead) { bm.dead = true; continue; } bm.x = bm.follow.x; bm.y = bm.follow.y; }
      bm.a += bm.angVel * dt;
      if (bm.gcd > 0) bm.gcd -= dt;
      if (bm.t >= bm.warn && !bm.fired) { bm.fired = true; audio.sfx("beam"); this.doShake(4); }
      if (bm.t >= bm.warn + bm.dur) { bm.dead = true; continue; }
      if (bm.t < bm.warn || this.dead || this.cleared) continue;
      const dx = Math.cos(bm.a), dy = Math.sin(bm.a);
      const vx = this.px - bm.x, vy = this.py - bm.y;
      const proj = clamp(vx * dx + vy * dy, 0, 1400);
      const cx = bm.x + dx * proj, cy = bm.y + dy * proj;
      const d = Math.hypot(this.px - cx, this.py - cy);
      if (d < bm.w / 2 * 0.85 + this.hpHit) this.hitPlayer();
      else if (d < bm.w / 2 + this.grazeR + 6 && bm.gcd <= 0) { bm.gcd = 0.2; this.graze(cx, cy); }
    }
    this.beams = this.beams.filter((b) => !b.dead);
  }

  updateMotes(dt: number) {
    for (const m of this.motes) {
      m.t += dt;
      const dx = this.px - m.x, dy = this.py - m.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 110 || m.t > 1.2 || this.cleared) {
        const sp = 300 + m.t * 300;
        m.vx += (dx / d * sp - m.vx) * Math.min(1, dt * 8);
        m.vy += (dy / d * sp - m.vy) * Math.min(1, dt * 8);
      } else m.vy += 120 * dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (d < 16 && !this.dead) {
        this.gainFaith(m.v);
        this.addScore(10);
        audio.sfx("mote");
        m.t = 999;
      }
    }
    this.motes = this.motes.filter((m) => m.y < H + 40 && m.t < 12);
  }

  updateFx(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.94; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const f of this.fxs) {
      f.t += dt;
      if (f.kind === "ring") {
        const k = f.t / f.dur;
        f.r = f.w * (1 - (1 - k) * (1 - k));
        if (f.clear) {
          for (const b of this.bullets) if (!b.dead && Math.hypot(b.x - f.x, b.y - f.y) < f.r) { b.dead = true; this.burst(b.x, b.y, "#ffffff", 1, 60, 0.3, 2); }
        }
        if (f.dmg > 0) for (const e of this.enemies) if (!e.dead && e.y > -5 && !f.hit.includes(e.id) && Math.hypot(e.x - f.x, e.y - f.y) < f.r + e.r) { f.hit.push(e.id); this.damageEnemy(e, f.dmg); }
      }
    }
    this.fxs = this.fxs.filter((f) => f.t < f.dur);
  }

  // ---------- director ----------
  updateDirector(dt: number) {
    if (this.kind === "boss" || this.cleared || this.dead) return;
    const w = this.wave;
    w.t += dt;
    const D = w.D;
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (w.t < D) {
      w.spawnT -= dt;
      if (w.spawnT <= 0) {
        const prog = w.t / D;
        const base = (3.3 - 1.6 * prog) * (1 - 0.05 * Math.min(8, this.act - 1));
        w.spawnT = base / Math.sqrt(this.density);
        if (alive < 9) this.spawnGroup();
      }
      if (!w.mini && w.t > D * 0.6) {
        w.mini = true;
        const x = rnd(180, 420);
        if (this.act === 1) { spawnEnemy(this, "sentinel", x, -30); }
        else { spawnEnemy(this, "bellringer", x, -40); if (this.act >= 3) spawnEnemy(this, "sentinel", W - x, -30); }
        this.banner = { text: "ELITE", sub: this.act === 1 ? "A Sentinel descends" : "A Bellringer tolls", t: 1.6, max: 1.6, color: "#ff9ab0" };
        audio.sfx("warn");
      }
    } else if (this.delayed.length === 0 && alive === 0) {
      this.banner = { text: "VERSE COMPLETE", sub: "The choir falls silent", t: 3, max: 3, color: "#f6d37a" };
      this.beginClear(3.2);
    } else if (w.t > D + 16) {
      for (const e of this.enemies) if (!e.dead) { e.dead = true; this.burst(e.x, e.y, "#fff", 8, 150, 0.4, 3); }
    }
  }

  spawnGroup() {
    const t = this.wave.t, act = this.act;
    const pool: [string, number][] = [["cherub", 5], ["chorister", 4]];
    if (t > 8) pool.push(["zealot", 3]);
    if (t > 12) pool.push(["thurifer", 2]);
    if (act >= 2) pool.push(["weaver", 3]);
    if (act >= 2 && t > 16) pool.push(["sentinel", 0.8]);
    const tot = pool.reduce((a, b) => a + b[1], 0);
    let r = Math.random() * tot, kind = "cherub";
    for (const [k, w] of pool) { if ((r -= w) <= 0) { kind = k; break; } }
    const dens = Math.sqrt(this.density);
    switch (kind) {
      case "cherub": {
        const n = Math.max(2, Math.round((2 + Math.floor(Math.random() * (2 + act))) * dens));
        const bx = rnd(100, 500);
        for (let i = 0; i < n; i++) this.later(i * 0.4, () => spawnEnemy(this, "cherub", clamp(bx + (i - n / 2) * 55, 40, 560), -20, i));
        break;
      }
      case "chorister": {
        const left = Math.random() < 0.5, x0 = left ? 120 : 480;
        const n = Math.round(5 * dens);
        for (let i = 0; i < n; i++) this.later(i * 0.32, () => spawnEnemy(this, "chorister", x0, -20, i * 0.6));
        break;
      }
      case "zealot": {
        const n = Math.round(rnd(2, 4) * dens);
        for (let i = 0; i < n; i++) this.later(i * 0.5, () => spawnEnemy(this, "zealot", rnd(60, 540), -20, i));
        break;
      }
      case "thurifer": {
        spawnEnemy(this, "thurifer", rnd(140, 460), -30);
        break;
      }
      case "sentinel": {
        if (!this.enemies.some((e) => e.type === "sentinel" || e.type === "bellringer")) spawnEnemy(this, "sentinel", rnd(160, 440), -30);
        break;
      }
      case "weaver": {
        const left = Math.random() < 0.5;
        const n = Math.random() < 0.4 ? 2 : 1;
        for (let i = 0; i < n; i++) this.later(i * 1.1, () => spawnEnemy(this, "weaver", left ? -15 : W + 15, 100));
        break;
      }
    }
  }

  updateTutorial(dt: number) {
    const tut = this.tut!;
    this.tutT += dt;
    const step = TUT[tut.step];
    if (!step) return;
    if (!tut.entered) { tut.entered = true; this.tutT = 0; step.enter?.(this); }
    step.tick?.(this);
    if (step.done(this)) {
      if (tut.step === TUT.length - 1) {
        if (!this.cleared) { this.banner = { text: "LITURGY LEARNED", sub: "Go forth and sing", t: 3, max: 3, color: "#f6d37a" }; this.beginClear(3); this.clearField(); }
        return;
      }
      tut.step++;
      tut.entered = false;
      audio.sfx("trinity");
      this.ftext(this.px, this.py - 50, "✓", "#7dffb0", 22);
      if (tut.step === 5 || tut.step === 4) { /* fields reset by next enter */ }
      if (tut.step === 5 || tut.step === 7) this.clearField();
    }
    if (this.kind === "tutorial" && this.hand.length === 0 && tut.step === 7 && this.drawPile.length === 0) this.drawPile = shuffle(this.run.deck.map((d) => ({ ...d })));
  }

  // ---------- rendering ----------
  sprite(img: HTMLCanvasElement, x: number, y: number) {
    const w = img.width * SPRITE_SCALE, h = img.height * SPRITE_SCALE;
    this.ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
  }
  spriteRot(img: HTMLCanvasElement, x: number, y: number, a: number, tx: number, ty: number) {
    const c = Math.cos(a) * this.sc, s = Math.sin(a) * this.sc;
    const ctx = this.ctx;
    ctx.setTransform(c, s, -s, c, (x + tx) * this.sc, (y + ty) * this.sc);
    const w = img.width * SPRITE_SCALE, h = img.height * SPRITE_SCALE;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  }

  render() {
    const ctx = this.ctx;
    const sc = this.sc;
    let tx = 0, ty = 0;
    if (this.shake > 0) {
      const m = this.shake * this.settings.shake;
      tx = (Math.random() - 0.5) * m; ty = (Math.random() - 0.5) * m;
    }
    const base = () => ctx.setTransform(sc, 0, 0, sc, tx * sc, ty * sc);
    base();
    // background
    ctx.fillStyle = "#050208";
    ctx.fillRect(-20, -20, W + 40, H + 40);
    const by = this.bgY % 400;
    for (let y = by - 400; y < H; y += 400) ctx.drawImage(this.bg, 0, y);
    ctx.drawImage(this.vignette, 0, 0);
    // side pillars
    ctx.fillStyle = "rgba(6,2,12,0.85)";
    ctx.fillRect(0, 0, 8, H); ctx.fillRect(W - 8, 0, 8, H);
    ctx.fillStyle = "rgba(246,211,122,0.35)";
    ctx.fillRect(8, 0, 1.5, H); ctx.fillRect(W - 9.5, 0, 1.5, H);

    // penumbra / veil fields
    if (this.penT > 0) { ctx.fillStyle = "rgba(120,60,200,0.16)"; ctx.beginPath(); ctx.arc(this.px, this.py, 100, 0, 7); ctx.fill(); ctx.strokeStyle = "rgba(183,139,255,0.5)"; ctx.lineWidth = 2; ctx.stroke(); }
    // beams
    for (const bm of this.beams) this.drawBeam(bm);
    // fx under
    for (const f of this.fxs) {
      const k = f.t / f.dur;
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (f.kind === "ring") {
        ctx.strokeStyle = f.color; ctx.lineWidth = 6 * (1 - k) + 2;
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.stroke();
        ctx.fillStyle = f.color; ctx.globalAlpha = Math.max(0, 0.18 * (1 - k));
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      } else if (f.kind === "col") {
        const g = ctx.createLinearGradient(f.x - f.w / 2, 0, f.x + f.w / 2, 0);
        g.addColorStop(0, "rgba(255,243,176,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(255,243,176,0)");
        ctx.fillStyle = g;
        const w = f.w * (1 - k * 0.5);
        ctx.fillRect(f.x - w / 2, 0, w, f.y);
      }
      ctx.globalAlpha = 1;
    }
    // motes
    for (const m of this.motes) this.sprite(glowSprite("#7da2ff", 7), m.x, m.y);
    // enemies
    for (const e of this.enemies) { if (e.boss) this.drawBoss(e); else drawEnemy(ctx, e); }
    // player bullets
    ctx.globalAlpha = 0.9;
    for (const p of this.pbullets) {
      switch (p.shape) {
        case 1: this.spriteRot(needleSprite(2, 2.2), p.x, p.y, Math.atan2(p.vy, p.vx), tx, ty); base(); break;
        case 2: this.spriteRot(needleSprite(1, 5), p.x, p.y, Math.atan2(p.vy, p.vx), tx, ty); base(); break;
        case 3: this.spriteRot(shardSprite(4, 3), p.x, p.y, Math.atan2(p.vy, p.vx), tx, ty); base(); break;
        case 4: this.sprite(orbSprite(3, 4), p.x, p.y); break;
        default: this.sprite(orbSprite(2, 3.5), p.x, p.y);
      }
    }
    ctx.globalAlpha = 1;
    // player
    if (!this.dead) this.drawPlayer();
    // orbs & drones
    for (const o of this.orbs) {
      this.sprite(glowSprite("#bff4ff", 20), o.x, o.y);
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(o.x, o.y, 5.5, 0, 7); ctx.fill();
      ctx.strokeStyle = "#52e5ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, 9, 0, 7); ctx.stroke();
    }
    for (const d of this.drones) {
      ctx.fillStyle = "#e9f9ff"; ctx.strokeStyle = "#52e5ff"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(d.x, d.y - 9); ctx.lineTo(d.x + 6, d.y); ctx.lineTo(d.x, d.y + 9); ctx.lineTo(d.x - 6, d.y); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // enemy bullets
    for (const b of this.bullets) {
      if (b.shape === 1) { this.spriteRot(needleSprite(b.c, b.r), b.x, b.y, b.a, tx, ty); base(); }
      else if (b.shape === 3) { this.spriteRot(shardSprite(b.c, b.r), b.x, b.y, b.a + b.t * 3, tx, ty); base(); }
      else this.sprite(orbSprite(b.c, b.r), b.x, b.y);
    }
    // particles
    for (const p of this.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    // texts
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 1.6);
      ctx.font = `700 ${t.size}px Cinzel, Georgia, serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // overlay (no shake)
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    if (this.flashA > 0) { ctx.globalAlpha = Math.min(0.9, this.flashA); ctx.fillStyle = this.flashC; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (this.run.hp <= 1 && !this.dead && !this.tut) {
      const a = 0.18 + Math.sin(this.time * 6) * 0.08;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, "rgba(255,0,40,0)"); g.addColorStop(1, `rgba(255,0,40,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (this.boss && !this.boss.dead) this.drawBossBar(this.boss);
    if (this.kind === "wave" && !this.cleared && !this.tut) this.drawWaveBar();
    if (this.banner) {
      const b = this.banner, k = 1 - b.t / b.max;
      const a = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.globalAlpha = Math.max(0, a);
      ctx.textAlign = "center";
      ctx.font = "800 34px Cinzel, Georgia, serif";
      ctx.lineWidth = 6; ctx.strokeStyle = "rgba(0,0,0,0.85)";
      const sy = H * 0.34 + (1 - Math.min(1, k * 6)) * 14;
      ctx.strokeText(b.text, W / 2, sy); ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, sy);
      ctx.font = "600 15px Cinzel, Georgia, serif";
      ctx.lineWidth = 4;
      ctx.strokeText(b.sub, W / 2, sy + 28); ctx.fillStyle = "#eadfff"; ctx.fillText(b.sub, W / 2, sy + 28);
      ctx.globalAlpha = 1;
    }
    if (this.dead) { ctx.fillStyle = `rgba(0,0,0,${Math.min(0.7, this.deadT * 0.5)})`; ctx.fillRect(0, 0, W, H); }
  }

  drawWaveBar() {
    const ctx = this.ctx;
    const k = Math.min(1, this.wave.t / this.wave.D);
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(40, 8, W - 80, 4);
    ctx.fillStyle = "#f6d37a"; ctx.fillRect(40, 8, (W - 80) * k, 4);
    ctx.fillStyle = "rgba(246,211,122,0.7)"; ctx.fillRect(40 + (W - 80) * 0.6 - 1, 5, 2, 10);
  }

  drawBossBar(b: Enemy) {
    const ctx = this.ctx, B = b.boss!;
    const x = 40, w = W - 80, y = 14;
    ctx.fillStyle = "rgba(0,0,0,0.65)"; ctx.fillRect(x - 2, y - 2, w + 4, 14);
    const f = Math.max(0, b.hp / b.maxHp);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, B.def.color); g.addColorStop(1, B.def.accent);
    ctx.fillStyle = B.inv > 0 ? "#888" : g; ctx.fillRect(x, y, w * f, 10);
    for (let i = 1; i < B.def.phases.length; i++) { ctx.fillStyle = "#fff"; ctx.fillRect(x + w * B.def.phases[i].at - 1, y - 3, 2, 16); }
    ctx.strokeStyle = "rgba(246,211,122,0.6)"; ctx.lineWidth = 1; ctx.strokeRect(x - 2, y - 2, w + 4, 14);
    ctx.textAlign = "left"; ctx.font = "700 13px Cinzel, Georgia, serif";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.strokeText(B.def.name, x, y + 28); ctx.fillStyle = "#f6e7b8"; ctx.fillText(B.def.name, x, y + 28);
    ctx.textAlign = "right"; ctx.font = "600 12px Cinzel, Georgia, serif";
    const nm = B.def.phases[B.phase].name;
    ctx.strokeText(nm, x + w, y + 28); ctx.fillStyle = B.def.accent; ctx.fillText(nm, x + w, y + 28);
  }

  drawBoss(b: Enemy) {
    const ctx = this.ctx, B = b.boss!, d = B.def;
    ctx.save();
    ctx.translate(b.x, b.y);
    const flashing = b.flash > 0;
    this.sprite(glowSprite(d.color + "cc", 120), 0, 0);
    ctx.rotate(B.spin * 0.25);
    ctx.lineWidth = 3;
    const n = d.petals;
    for (let ring = 0; ring < 3; ring++) {
      const R = 46 - ring * 10;
      ctx.save();
      ctx.rotate((ring % 2 ? -1 : 1) * B.spin * (0.3 + ring * 0.2));
      ctx.fillStyle = flashing ? "#fff" : d.color + (ring === 0 ? "99" : "cc");
      ctx.strokeStyle = d.accent;
      for (let i = 0; i < n; i++) {
        ctx.save();
        ctx.rotate((i * TAU) / n);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.quadraticCurveTo(R * 0.55, -R * 0.38, R, 0); ctx.quadraticCurveTo(R * 0.55, R * 0.38, 0, 0);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = "#08040f"; ctx.beginPath(); ctx.arc(b.x, b.y, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = d.accent; ctx.lineWidth = 2; ctx.stroke();
    const ex = clamp((this.px - b.x) / 40, -5, 5), ey = clamp((this.py - b.y) / 40, -5, 5);
    ctx.fillStyle = B.inv > 0 ? "#fff" : "#ff3b5c"; ctx.beginPath(); ctx.arc(b.x + ex, b.y + ey, 6, 0, 7); ctx.fill();
    if (B.inv > 0 && B.introT <= 0) {
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(b.x, b.y, 56 + Math.sin(this.time * 14) * 3, 0, 7); ctx.stroke();
    }
  }

  drawBeam(bm: Beam) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(bm.x, bm.y);
    ctx.rotate(bm.a);
    if (bm.t < bm.warn) {
      const k = bm.t / bm.warn;
      ctx.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(bm.t * 18));
      ctx.fillStyle = "#ff3b5c";
      ctx.fillRect(0, -1.5 - k * 2, 1400, 3 + k * 4);
      ctx.globalAlpha = 0.07 + k * 0.1;
      ctx.fillRect(0, -bm.w / 2, 1400, bm.w);
    } else {
      const k = (bm.t - bm.warn) / bm.dur;
      const w = bm.w * (k > 0.85 ? (1 - k) / 0.15 : Math.min(1, (bm.t - bm.warn) / 0.08));
      const g = ctx.createLinearGradient(0, -w / 2, 0, w / 2);
      g.addColorStop(0, "rgba(255,59,92,0)"); g.addColorStop(0.3, "rgba(255,120,150,0.9)"); g.addColorStop(0.5, "rgba(255,255,255,1)"); g.addColorStop(0.7, "rgba(255,120,150,0.9)"); g.addColorStop(1, "rgba(255,59,92,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, -w / 2, 1400, w);
    }
    ctx.restore();
  }

  drawPlayer() {
    const ctx = this.ctx, x = this.px, y = this.py;
    const blink = this.invuln > 0 && this.invuln < 50 && Math.floor(this.time * 18) % 2 === 0;
    // fields
    if (this.veilT > 0) {
      ctx.fillStyle = "rgba(180,240,255,0.12)"; ctx.strokeStyle = "rgba(200,245,255,0.7)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 70, 0, 7); ctx.fill(); ctx.stroke();
    }
    if (this.aegisT > 0) {
      this.sprite(glowSprite("#f6d37aaa", 46), x, y);
      ctx.strokeStyle = "#fff0b8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 30, 0, 7); ctx.stroke();
    }
    for (let i = 0; i < this.shield; i++) {
      ctx.strokeStyle = "rgba(246,211,122," + (0.9 - i * 0.2) + ")"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y, 22 + i * 5, this.time * (1 + i), this.time * (1 + i) + 4.6); ctx.stroke();
    }
    if (!blink) {
      ctx.save();
      ctx.translate(x, y);
      this.sprite(glowSprite("#52e5ff88", 30), 0, 0);
      const g = ctx.createLinearGradient(0, -18, 0, 12);
      g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#7fe9ff");
      ctx.fillStyle = g; ctx.strokeStyle = "#f6d37a"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(13, 11); ctx.lineTo(5, 6); ctx.lineTo(0, 12); ctx.lineTo(-5, 6); ctx.lineTo(-13, 11); ctx.closePath();
      ctx.fill(); ctx.stroke();
      // halo
      ctx.strokeStyle = "rgba(246,211,122,0.85)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, -22, 8, 3, 0, 0, 7); ctx.stroke();
      ctx.restore();
    }
    if (this.focus || this.settings.hitbox) {
      ctx.strokeStyle = "rgba(255,255,255,0.22)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, this.grazeR, 0, 7); ctx.stroke();
    }
    // hitbox core
    ctx.fillStyle = "#ff3b5c"; ctx.beginPath(); ctx.arc(x, y, this.focus ? 4.5 : 3.6, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, this.focus ? 2.8 : 2.1, 0, 7); ctx.fill();
  }

  // ---------- snapshot ----------
  snapshot(): Snapshot {
    const effects: Snapshot["effects"] = [];
    for (const p of this.patterns) effects.push({ name: CARD_MAP[p.id].name, icon: CARD_MAP[p.id].icon, t: p.t, max: p.max, color: TYPE_META.hymn.color });
    for (const g of this.glosses) effects.push({ name: CARD_MAP[g.id].name, icon: CARD_MAP[g.id].icon, t: g.t, max: g.max, color: TYPE_META.gloss.color });
    const tm = (name: string, icon: string, t: number, max: number, color: string) => { if (t > 0) effects.push({ name, icon, t, max, color }); };
    tm("Aegis", "◈", this.aegisT, 4.5, TYPE_META.ward.color);
    tm("Mirror Veil", "◐", this.veilT, 8, TYPE_META.ward.color);
    tm("Penumbra", "◍", this.penT, 10, TYPE_META.ward.color);
    tm("Hush", "⏳", this.hushT, 6, TYPE_META.vow.color);
    tm("Zeal", "🔥", this.zealT, 12, "#ff9a4d");
    tm("Rapture", "☀", this.raptureT, 12, "#ffe9a8");
    tm("Trinity", "✠", this.trinityT, 6, "#ffe9a8");
    return {
      hp: this.run.hp, maxHp: this.run.maxHp, shield: this.shield, faith: this.faith, maxFaith: this.maxFaith,
      score: this.run.stats.score, fervor: this.fervor,
      hand: this.hand.map((inst) => ({ inst, cost: this.effCost(inst), ok: this.canPlay(inst) })),
      drawN: this.drawPile.length, discardN: this.discard.length, exhaustN: this.exhausted.length,
      drawProg: this.hand.length >= this.handSize ? 0 : clamp(this.drawT / this.drawIv, 0, 1),
      cycleProg: this.cycleCd > 0 ? 1 - this.cycleCd / 6 : 1,
      effects,
      label: this.tut ? "Tutorial" : this.kind === "boss" ? "Act " + this.act + " — Boss" : "Act " + this.act + " — Hymn",
      tut: this.tut ? { text: TUT[Math.min(this.tut.step, TUT.length - 1)].text, step: Math.min(this.tut.step, TUT.length - 1), total: TUT.length } : null,
      denyUid: this.denyUid, time: this.run.stats.time, handSize: this.handSize,
    };
  }
}
