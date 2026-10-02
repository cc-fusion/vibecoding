import { BOSSES, ENEMIES, REALMS, WEAPONS, applyBoons, maxHpOf, type Mods, type WeaponId } from "./data";
import { audio } from "./audio";
import type { Settings } from "./save";

export const W = 1280;
export const H = 720;

export interface RunConfig {
  name: string;
  hue: number;
  gen: number;
  ancestors: number;
  mods: Mods;
  weapon: WeaponId;
  potions: number;
  diff: { hp: number; dmg: number; gold: number; spd: number };
  startBoons: Record<string, number>;
  hpFrac?: number;
  tutorial?: boolean;
}
export type RoomKind = "fight" | "gold" | "elite" | "boss" | "tutorial";
export interface HudState {
  hp: number; maxHp: number; special: number; dash: number; potions: number; gold: number;
  boons: Record<string, number>; realm: number; room: number; kind: RoomKind;
  boss: { name: string; title: string; hp: number; max: number; phase: number } | null;
  wave: string; tut: { step: number; total: number; text: string } | null;
  kills: number; time: number; enemies: number; ancestors: number; revive: boolean; name: string; color: string;
}
export type GameEvent =
  | { type: "roomCleared"; kind: RoomKind }
  | { type: "bossDown"; boss: number }
  | { type: "died" }
  | { type: "pause"; force?: boolean }
  | { type: "tutorialDone" };
export interface RunState {
  kills: number; gold: number; damage: number; taken: number; rooms: number; bosses: number; time: number;
  revivesUsed: number; potionsUsed: number; deflects: number; boons: Record<string, number>; specials: number; relics: string[];
}
interface Opts {
  getSettings: () => Settings;
  onHud: (h: HudState) => void;
  onEvent: (e: GameEvent) => void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface Enemy {
  id: number; type: string; x: number; y: number; kx: number; ky: number; z: number; r: number; hp: number; maxHp: number; spd: number; dmg: number;
  face: number; t: number; atkT: number; state: string; st: number; spawning: number; flash: number; burnT: number; burnDps: number; burnTick: number;
  slowT: number; stun: number; elite: boolean; boss: number; dead: boolean; color: string; ang: number; orbitHit: number; eliteT: number;
  inv: number; phase: number; pat: string | null; patT: number; cdT: number; pd: Record<string, any>; lastPat: string; summoned: boolean; hitDash: number; hurtAnim: number;
}
interface Bullet { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; color: string; friendly: boolean; pierce: number; hit: Set<number>; kind: string; kb: number }
interface Zone { kind: string; x: number; y: number; r: number; t: number; warn: number; life: number; dmg: number; tick: number; hit: boolean; period: number; offset: number }
interface Coin { x: number; y: number; vx: number; vy: number; v: number; heart: boolean; t: number }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; glow: boolean; drag: number; kind: number; a?: number }
interface FText { x: number; y: number; vy: number; life: number; max: number; text: string; color: string; size: number }
interface Slash { x: number; y: number; a: number; range: number; arc: number; t: number; life: number; color: string }
interface Bolt { x1: number; y1: number; x2: number; y2: number; t: number }
interface Obs { x: number; y: number; r: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const TUT_STEPS = [
  "Move with WASD or the arrow keys (left stick / touch pad also work).",
  "Aim with the mouse and hold Left Click (or J) to attack. Hit the dummy 5 times.",
  "Dash with SPACE or Right Click. You are invulnerable mid-dash. Dash 3 times.",
  "Slay the grubs! Every hit charges your Ancestral Roar.",
  "Your Roar is charged! Press Q (or L) to unleash your ancestors.",
  "You are wounded. Press E (or H) to drink a healing potion.",
  "Swing into enemy bullets to DEFLECT them. Defeat the spitter!",
];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  opts: Opts;
  raf = 0;
  last = 0;
  alive = true;
  paused = false;
  frozen = false;
  keys = new Set<string>();
  pressed = new Set<string>();
  mouse = { x: W / 2, y: H / 2, down: false, active: false };
  touch = { mx: 0, my: 0, atk: false };
  padPrev: boolean[] = [];
  padAim: { x: number; y: number } | null = null;
  usingKeyAttack = false;

  cfg!: RunConfig;
  mods!: Mods;
  maxHp = 100;
  run!: RunState;
  p = { x: W / 2, y: H - 140, vx: 0, vy: 0, r: 13, hp: 100, face: -Math.PI / 2, atkT: 0, atkAnim: 0, dashT: 0, dashCd: 0, dashDx: 0, dashDy: -1, dashId: 0, inv: 0, flash: 0, special: 0, potions: 0, dead: false, deadT: 0, combo: 0, specialReady: false, moveDx: 0, moveDy: 0 };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  zones: Zone[] = [];
  coins: Coin[] = [];
  parts: Part[] = [];
  texts: FText[] = [];
  slashes: Slash[] = [];
  bolts: Bolt[] = [];
  obstacles: Obs[] = [];
  floor: HTMLCanvasElement | null = null;
  vignette: HTMLCanvasElement | null = null;
  enemyId = 1;
  orbitA = 0;
  roomKind: RoomKind = "fight";
  realm = 0;
  roomIdx = 0;
  waves: string[][] = [];
  waveIdx = 0;
  waveDelay = 0;
  cleared = false;
  clearT = 0;
  roomT = 0;
  shakeT = 0;
  hitStop = 0;
  banner: { text: string; sub: string; t: number; color: string } | null = null;
  hudT = 0;
  tut = { step: 0, moved: 0, hits: 0, dashes: 0, usedSpecial: false, potion: false, deflected: 0, setup: -1, done: false };
  dummyRespawn = 0;
  time = 0;
  cleanup: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement, opts: Opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.opts = opts;
    this.bindInput();
    this.resize();
    this.makeVignette();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ---------------- lifecycle ----------------
  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }

  start(cfg: RunConfig) {
    this.cfg = cfg;
    this.run = { kills: 0, gold: 0, damage: 0, taken: 0, rooms: 0, bosses: 0, time: 0, revivesUsed: 0, potionsUsed: 0, deflects: 0, boons: { ...cfg.startBoons }, specials: 0, relics: [] };
    this.recomputeMods();
    this.p.hp = Math.max(1, Math.round(this.maxHp * (cfg.hpFrac ?? 1)));
    this.p.potions = cfg.potions;
    this.p.special = 0;
    this.p.dead = false;
    this.p.deadT = 0;
    this.p.combo = 0;
    this.tut = { step: 0, moved: 0, hits: 0, dashes: 0, usedSpecial: false, potion: false, deflected: 0, setup: -1, done: false };
    this.paused = false;
    this.frozen = false;
    this.time = 0;
  }

  recomputeMods() {
    const prevMax = this.maxHp;
    this.mods = applyBoons(this.cfg.mods, this.run.boons);
    this.maxHp = maxHpOf(this.mods);
    if (this.p && this.maxHp > prevMax && prevMax > 0 && !this.p.dead) this.p.hp += this.maxHp - prevMax;
    this.p.hp = Math.min(this.p.hp, this.maxHp);
  }

  addBoon(id: string) {
    this.run.boons[id] = (this.run.boons[id] || 0) + 1;
    this.recomputeMods();
    audio.sfx("boon");
    this.burst(this.p.x, this.p.y, "#ffe9a0", 24, 200, 0.7, 3);
    this.text(this.p.x, this.p.y - 30, "BOON!", "#ffe9a0", 22);
  }
  healFrac(f: number) {
    const amt = Math.round(this.maxHp * f);
    this.p.hp = Math.min(this.maxHp, this.p.hp + amt);
    this.text(this.p.x, this.p.y - 28, `+${amt}`, "#7dff9a", 20);
    this.burst(this.p.x, this.p.y, "#7dff9a", 14, 140, 0.6, 3);
    audio.sfx("heart");
  }
  setPaused(v: boolean) { this.paused = v; }
  setFrozen(v: boolean) { this.frozen = v; }
  killPlayer() { if (!this.p.dead) { this.p.hp = 0; this.p.dead = true; this.p.deadT = 0.2; } }
  touchAction(a: string) { this.pressed.add(a); }

  // ---------------- input ----------------
  bindInput() {
    const gameKeys = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", " ", "j", "k", "l", "q", "e", "h", "z"]);
    const kd = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (gameKeys.has(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k);
      if (k === " " || k === "k" || k === "shift") this.pressed.add("dash");
      if (k === "q" || k === "l") this.pressed.add("special");
      if (k === "e" || k === "h") this.pressed.add("potion");
      if (k === "j" || k === "z") this.usingKeyAttack = true;
      if (k === "escape" || k === "p") this.opts.onEvent({ type: "pause" });
    };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const mm = (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * W;
      this.mouse.y = ((e.clientY - r.top) / r.height) * H;
      this.mouse.active = true;
      this.usingKeyAttack = false;
      this.padAim = null;
    };
    const md = (e: MouseEvent) => {
      if (e.target !== this.canvas) return;
      mm(e);
      if (e.button === 0) this.mouse.down = true;
      if (e.button === 2) this.pressed.add("dash");
    };
    const mu = (e: MouseEvent) => { if (e.button === 0) this.mouse.down = false; };
    const cm = (e: Event) => e.preventDefault();
    const blur = () => { this.keys.clear(); this.mouse.down = false; this.opts.onEvent({ type: "pause", force: true }); };
    const rs = () => this.resize();
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("mousemove", mm);
    window.addEventListener("mousedown", md);
    window.addEventListener("mouseup", mu);
    this.canvas.addEventListener("contextmenu", cm);
    window.addEventListener("blur", blur);
    window.addEventListener("resize", rs);
    this.cleanup.push(() => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mousedown", md);
      window.removeEventListener("mouseup", mu);
      this.canvas.removeEventListener("contextmenu", cm);
      window.removeEventListener("blur", blur);
      window.removeEventListener("resize", rs);
    });
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, this.canvas.clientWidth);
    const h = Math.max(180, this.canvas.clientHeight);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
  }

  pollPad() {
    let pad: Gamepad | null = null;
    try { const pads = navigator.getGamepads ? navigator.getGamepads() : []; for (const g of pads) if (g) { pad = g; break; } } catch { pad = null; }
    if (!pad) return { mx: 0, my: 0, atk: false };
    const btn = (i: number) => !!pad!.buttons[i]?.pressed;
    const edge = (i: number, a: string) => { const now = btn(i); if (now && !this.padPrev[i]) this.pressed.add(a); this.padPrev[i] = now; };
    edge(0, "dash"); edge(1, "dash"); edge(6, "dash"); edge(3, "special"); edge(4, "potion");
    const st = btn(9);
    if (st && !this.padPrev[9]) this.opts.onEvent({ type: "pause" });
    this.padPrev[9] = st;
    const dz = (v: number) => (Math.abs(v) < 0.2 ? 0 : v);
    const ax = pad.axes[2] ?? 0, ay = pad.axes[3] ?? 0;
    if (Math.hypot(ax, ay) > 0.35) this.padAim = { x: ax, y: ay };
    return { mx: dz(pad.axes[0] ?? 0), my: dz(pad.axes[1] ?? 0), atk: btn(7) || btn(5) || btn(2) };
  }

  // ---------------- room setup ----------------
  startRoom(kind: RoomKind, realm: number, roomIdx: number) {
    this.roomKind = kind; this.realm = realm; this.roomIdx = roomIdx;
    this.enemies = []; this.bullets = []; this.zones = []; this.coins = []; this.slashes = []; this.bolts = [];
    this.cleared = false; this.clearT = 0; this.roomT = 0; this.waveIdx = 0; this.waveDelay = 0.9;
    this.frozen = false;
    this.p.x = W / 2; this.p.y = H - 150; this.p.vx = 0; this.p.vy = 0; this.p.inv = 1.0; this.p.dashT = 0;
    this.makeObstacles(kind);
    this.makeZones(kind);
    this.makeFloor();
    this.waves = kind === "boss" || kind === "tutorial" ? [] : this.buildWaves(kind);
    const R = REALMS[realm];
    audio.setMood(kind === "boss" ? "boss" : kind === "tutorial" ? "combat" : "combat", R.music);
    if (kind === "boss") {
      const def = BOSSES[R.boss];
      this.spawnBoss(R.boss);
      this.banner = { text: def.name, sub: def.title, t: 3, color: def.color };
      audio.sfx("bossroar");
      this.shake(10);
    } else if (kind === "tutorial") {
      this.banner = { text: "Training Grounds", sub: "Learn the family art", t: 2.5, color: "#ffe9a0" };
      this.spawnEnemy("dummy", W / 2, 260, false, true);
    } else {
      const label = kind === "elite" ? "Elite Guardian" : kind === "gold" ? "Treasure Hoard" : `${R.name}`;
      this.banner = { text: label, sub: kind === "fight" ? `Room ${roomIdx + 1}` : R.name, t: 2, color: R.accent };
      audio.sfx("door");
    }
  }

  buildWaves(kind: RoomKind): string[][] {
    const R = REALMS[this.realm];
    const budget = (7 + this.realm * 3.5 + this.roomIdx * 2.2) * (kind === "gold" ? 1.4 : 1);
    const nW = kind === "elite" ? 2 : this.roomIdx >= 2 ? 3 : 2;
    const out: string[][] = [];
    for (let w = 0; w < nW; w++) {
      let wb = kind === "elite" ? budget / 2 : budget / nW;
      const list: string[] = [];
      if (kind === "elite" && w === 0) {
        const choices = R.enemies.filter((t) => ENEMIES[t].cost >= 2 && t !== "bomber");
        list.push("elite:" + choices[Math.floor(Math.random() * choices.length)]);
        wb *= 0.5;
      }
      let guard = 0;
      while (wb > 0.5 && list.length < 14 && guard++ < 40) {
        const opts = R.enemies.filter((t) => ENEMIES[t].cost <= wb + 1);
        const t = opts[Math.floor(Math.random() * opts.length)] || "grub";
        list.push(t);
        wb -= ENEMIES[t].cost;
      }
      out.push(list);
    }
    return out;
  }

  makeObstacles(kind: RoomKind) {
    this.obstacles = [];
    if (kind === "boss") {
      for (const [x, y] of [[260, 220], [W - 260, 220], [260, H - 220], [W - 260, H - 220]]) this.obstacles.push({ x, y, r: 30 });
      return;
    }
    if (kind === "tutorial") return;
    const n = 3 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n * 5 && this.obstacles.length < n; i++) {
      const x = rnd(140, W - 140), y = rnd(170, H - 140), r = rnd(22, 38);
      if (dist(x, y, W / 2, H - 150) < 200) continue;
      if (this.obstacles.some((o) => dist(o.x, o.y, x, y) < o.r + r + 90)) continue;
      this.obstacles.push({ x, y, r });
    }
  }

  makeZones(kind: RoomKind) {
    this.zones = [];
    if (kind === "tutorial") return;
    const R = REALMS[this.realm];
    const n = kind === "boss" ? 1 : 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n * 6 && this.zones.filter((z) => z.period >= 0).length < n; i++) {
      const rad = R.hazard === "void" ? 120 : R.hazard === "spikes" ? 38 : rnd(70, 110);
      const x = rnd(160, W - 160), y = rnd(190, H - 150);
      if (dist(x, y, W / 2, H - 150) < 220) continue;
      if (this.zones.some((z) => dist(z.x, z.y, x, y) < z.r + rad + 40)) continue;
      if (this.obstacles.some((o) => dist(o.x, o.y, x, y) < o.r + rad)) continue;
      if (R.hazard === "spikes") {
        // cluster of spike traps
        for (let k = 0; k < 4; k++) this.zones.push({ kind: "spikes", x: x + (k % 2) * 70 - 35, y: y + Math.floor(k / 2) * 70 - 35, r: rad, t: 0, warn: 0, life: 0, dmg: 14, tick: 0, hit: false, period: 2.6, offset: k * 0.35 + Math.random() * 0.3 });
      } else {
        this.zones.push({ kind: R.hazard, x, y, r: rad, t: 0, warn: 0, life: 0, dmg: 13, tick: 0, hit: false, period: R.hazard === "lava" ? 3.6 : 0, offset: Math.random() * 3 });
      }
    }
    if (this.zones.length === 0) this.zones.push({ kind: R.hazard, x: 200, y: 260, r: 90, t: 0, warn: 0, life: 0, dmg: 13, tick: 0, hit: false, period: R.hazard === "lava" ? 3.6 : R.hazard === "spikes" ? 2.6 : 0, offset: 0 });
  }

  makeFloor() {
    const R = REALMS[this.realm];
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = R.floorA; g.fillRect(0, 0, W, H);
    const ts = 80;
    for (let y = 0; y < H / ts + 1; y++) for (let x = 0; x < W / ts + 1; x++) {
      g.fillStyle = (x + y) % 2 ? R.floorB : R.floorA;
      g.globalAlpha = 0.8; g.fillRect(x * ts, y * ts, ts, ts);
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 160; i++) {
      g.fillStyle = `rgba(255,255,255,${rnd(0.02, 0.06)})`;
      g.beginPath(); g.arc(rnd(0, W), rnd(0, H), rnd(1, 4), 0, 7); g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 1.5; g.beginPath();
      const x = rnd(0, W), y = rnd(0, H); g.moveTo(x, y); g.lineTo(x + rnd(-40, 40), y + rnd(-40, 40)); g.lineTo(x + rnd(-60, 60), y + rnd(-60, 60)); g.stroke();
    }
    g.strokeStyle = "rgba(0,0,0,0.18)"; g.lineWidth = 1;
    for (let x = 0; x < W; x += ts) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += ts) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    // walls
    g.fillStyle = "#0a0810"; g.fillRect(0, 0, W, 50); g.fillRect(0, H - 30, W, 30); g.fillRect(0, 0, 30, H); g.fillRect(W - 30, 0, 30, H);
    g.strokeStyle = R.accent; g.globalAlpha = 0.35; g.lineWidth = 3; g.strokeRect(30, 50, W - 60, H - 80); g.globalAlpha = 1;
    this.floor = c;
  }

  makeVignette() {
    const c = document.createElement("canvas");
    c.width = 640; c.height = 360;
    const g = c.getContext("2d")!;
    const gr = g.createRadialGradient(320, 180, 120, 320, 180, 400);
    gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,0.65)");
    g.fillStyle = gr; g.fillRect(0, 0, 640, 360);
    this.vignette = c;
  }

  // ---------------- spawning ----------------
  edmg(base: number) { return base * (1 + this.realm * 0.28) * this.cfg.diff.dmg; }

  spawnPoint(): [number, number] {
    for (let i = 0; i < 30; i++) {
      const x = rnd(90, W - 90), y = rnd(120, H - 90);
      if (dist(x, y, this.p.x, this.p.y) < 280) continue;
      if (this.obstacles.some((o) => dist(o.x, o.y, x, y) < o.r + 24)) continue;
      return [x, y];
    }
    return [rnd(100, W - 100), 140];
  }

  spawnEnemy(type: string, x?: number, y?: number, elite = false, dummy = false, summoned = false): Enemy {
    const def = ENEMIES[type];
    const [sx, sy] = x === undefined || y === undefined ? this.spawnPoint() : [x, y];
    const scale = (1 + this.realm * 0.55 + this.roomIdx * 0.08) * this.cfg.diff.hp;
    const hp = dummy ? def.hp : def.hp * scale * (elite ? 3.6 : 1);
    const e: Enemy = {
      id: this.enemyId++, type, x: sx, y: sy, kx: 0, ky: 0, z: 0, r: def.r * (elite ? 1.35 : 1), hp, maxHp: hp, spd: def.spd * this.cfg.diff.spd * (elite ? 1.05 : 1),
      dmg: this.edmg(def.dmg) * (elite ? 1.25 : 1), face: 0, t: Math.random() * 3, atkT: 0.6, state: "walk", st: rnd(0.8, 2), spawning: dummy ? 0 : 0.8, flash: 0, burnT: 0, burnDps: 0, burnTick: 0,
      slowT: 0, stun: 0, elite, boss: -1, dead: false, color: def.color, ang: 0, orbitHit: 0, eliteT: rnd(2, 4), inv: 0, phase: 0, pat: null, patT: 0, cdT: 0, pd: {}, lastPat: "", summoned, hitDash: 0, hurtAnim: 0,
    };
    if (dummy) e.spawning = 0;
    this.enemies.push(e);
    return e;
  }

  spawnBoss(i: number) {
    const def = BOSSES[i];
    const hp = def.hp * this.cfg.diff.hp;
    this.enemies.push({
      id: this.enemyId++, type: "boss", x: W / 2, y: 190, kx: 0, ky: 0, z: 0, r: def.r, hp, maxHp: hp, spd: 55, dmg: this.edmg(16), face: Math.PI / 2, t: 0, atkT: 1, state: "idle", st: 0,
      spawning: 1.4, flash: 0, burnT: 0, burnDps: 0, burnTick: 0, slowT: 0, stun: 0, elite: false, boss: i, dead: false, color: def.color, ang: 0, orbitHit: 0, eliteT: 0,
      inv: 0, phase: 0, pat: null, patT: 0, cdT: 1.6, pd: {}, lastPat: "", summoned: false, hitDash: 0, hurtAnim: 0,
    });
  }

  // ---------------- fx helpers ----------------
  shake(v: number) { const s = this.opts.getSettings(); if (s.shake) this.shakeT = Math.max(this.shakeT, v); }
  burst(x: number, y: number, color: string, n: number, speed: number, life: number, size: number, glow = true) {
    for (let i = 0; i < n && this.parts.length < 800; i++) {
      const a = Math.random() * 6.283, s = rnd(0.2, 1) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rnd(0.6, 1), max: life, size: size * rnd(0.6, 1.2), color, glow, drag: 3, kind: 0 });
    }
  }
  ring(x: number, y: number, color: string, r: number, life = 0.4) {
    this.parts.push({ x, y, vx: 0, vy: 0, life, max: life, size: r, color, glow: true, drag: 0, kind: 1 });
  }
  text(x: number, y: number, text: string, color: string, size = 16) {
    if (this.texts.length > 60) this.texts.shift();
    this.texts.push({ x: x + rnd(-8, 8), y, vy: -50, life: 0.9, max: 0.9, text, color, size });
  }
  dmgText(x: number, y: number, v: number, crit: boolean) {
    if (!this.opts.getSettings().numbers) return;
    this.text(x, y - 10, `${Math.round(v)}${crit ? "!" : ""}`, crit ? "#ffd84a" : "#ffffff", crit ? 24 : 15);
  }

  // ---------------- main loop ----------------
  loop = (t: number) => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (t - (this.last || t)) / 1000);
    this.last = t;
    if (!this.cfg) { this.render(); return; }
    if (!this.paused && !this.frozen) this.update(dt);
    else {
      this.pressed.clear();
      if (this.frozen && !this.paused) this.updateFx(dt * 0.5);
    }
    this.render();
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.opts.onHud(this.hud()); }
  };

  hud(): HudState {
    const boss = this.enemies.find((e) => e.boss >= 0 && !e.dead);
    const alive = this.enemies.filter((e) => !e.dead && e.type !== "dummy").length;
    return {
      hp: Math.max(0, Math.ceil(this.p.hp)), maxHp: this.maxHp, special: this.p.special, dash: this.p.dashCd <= 0 ? 1 : 1 - this.p.dashCd / this.dashCooldown(), potions: this.p.potions,
      gold: Math.floor(this.run.gold), boons: this.run.boons, realm: this.realm, room: this.roomIdx, kind: this.roomKind,
      boss: boss ? { name: BOSSES[boss.boss].name, title: BOSSES[boss.boss].title, hp: Math.max(0, boss.hp), max: boss.maxHp, phase: boss.phase } : null,
      wave: this.waves.length ? `Wave ${Math.min(this.waveIdx, this.waves.length)}/${this.waves.length}` : "",
      tut: this.cfg.tutorial ? { step: this.tut.step, total: TUT_STEPS.length, text: this.tut.step < TUT_STEPS.length ? TUT_STEPS[this.tut.step] : "Training complete!" } : null,
      kills: this.run.kills, time: this.run.time, enemies: alive, ancestors: this.cfg.ancestors, revive: this.mods.revive > this.run.revivesUsed, name: this.cfg.name, color: `hsl(${this.cfg.hue},60%,55%)`,
    };
  }

  dashCooldown() { return Math.max(0.35, 1.05 * this.mods.dashCd); }

  update(dt: number) {
    if (this.hitStop > 0) { this.hitStop -= dt; this.updateFx(dt * 0.3); return; }
    this.time += dt;
    this.roomT += dt;
    this.run.time += dt;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateZones(dt);
    this.updateCoins(dt);
    this.updateOrbit(dt);
    this.updateFx(dt);
    this.updateRoom(dt);
    if (this.cfg.tutorial) this.updateTutorial();
    this.pressed.clear();
    if (this.p.dead) {
      this.p.deadT -= dt;
      if (this.p.deadT <= 0 && !this.diedSent) { this.diedSent = true; this.opts.onEvent({ type: "died" }); }
    } else this.diedSent = false;
  }
  diedSent = false;

  updateFx(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const q = this.parts[i];
      q.life -= dt;
      if (q.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      const d = Math.exp(-q.drag * dt);
      q.vx *= d; q.vy *= d; q.x += q.vx * dt; q.y += q.vy * dt;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const q = this.texts[i];
      q.life -= dt; q.y += q.vy * dt; q.vy *= 0.96;
      if (q.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.slashes.length - 1; i >= 0; i--) { this.slashes[i].t += dt; if (this.slashes[i].t > this.slashes[i].life) this.slashes.splice(i, 1); }
    for (let i = this.bolts.length - 1; i >= 0; i--) { this.bolts[i].t += dt; if (this.bolts[i].t > 0.18) this.bolts.splice(i, 1); }
    this.shakeT = Math.max(0, this.shakeT - dt * 40);
    this.p.flash = Math.max(0, this.p.flash - dt * 2.5);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
  }

  // ---------------- player ----------------
  pushOut(x: number, y: number, r: number): [number, number] {
    for (const o of this.obstacles) {
      const d = dist(x, y, o.x, o.y), m = o.r + r;
      if (d < m && d > 0.001) { x = o.x + ((x - o.x) / d) * m; y = o.y + ((y - o.y) / d) * m; }
    }
    return [clamp(x, 34 + r, W - 34 - r), clamp(y, 54 + r, H - 34 - r)];
  }

  nearestEnemy(x: number, y: number, maxD = 9999): Enemy | null {
    let best: Enemy | null = null, bd = maxD;
    for (const e of this.enemies) { if (e.dead || e.spawning > 0) continue; const d = dist(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  zoneAt(x: number, y: number, kind: string) { return this.zones.some((z) => z.kind === kind && dist(x, y, z.x, z.y) < z.r); }

  updatePlayer(dt: number) {
    const p = this.p;
    const pad = this.pollPad();
    if (p.dead) { p.vx *= 0.9; p.vy *= 0.9; return; }
    let mx = (this.keys.has("d") || this.keys.has("arrowright") ? 1 : 0) - (this.keys.has("a") || this.keys.has("arrowleft") ? 1 : 0);
    let my = (this.keys.has("s") || this.keys.has("arrowdown") ? 1 : 0) - (this.keys.has("w") || this.keys.has("arrowup") ? 1 : 0);
    mx += pad.mx + this.touch.mx; my += pad.my + this.touch.my;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }
    p.moveDx = mx; p.moveDy = my;
    const slowMul = this.zoneAt(p.x, p.y, "bog") ? 0.55 : 1;
    const onIce = this.zoneAt(p.x, p.y, "ice");
    const speed = 235 * this.mods.move * slowMul;
    p.inv = Math.max(0, p.inv - dt);
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.atkT = Math.max(0, p.atkT - dt);
    p.atkAnim = Math.max(0, p.atkAnim - dt);

    // aim
    const wantsAttack = this.mouse.down || this.keys.has("j") || this.keys.has("z") || pad.atk || this.touch.atk;
    if (this.padAim && !this.mouse.active) p.face = Math.atan2(this.padAim.y, this.padAim.x);
    else if (this.usingKeyAttack || this.touch.atk) {
      const tgt = this.nearestEnemy(p.x, p.y, 520);
      if (tgt) p.face = Math.atan2(tgt.y - p.y, tgt.x - p.x);
      else if (ml > 0.1) p.face = Math.atan2(my, mx);
    } else if (this.padAim) p.face = Math.atan2(this.padAim.y, this.padAim.x);
    else p.face = Math.atan2(this.mouse.y - p.y, this.mouse.x - p.x);

    // dash
    if (this.pressed.has("dash") && p.dashCd <= 0 && p.dashT <= 0) {
      let dx = mx, dy = my;
      if (Math.hypot(dx, dy) < 0.1) { dx = Math.cos(p.face); dy = Math.sin(p.face); }
      const l = Math.hypot(dx, dy) || 1;
      p.dashDx = dx / l; p.dashDy = dy / l; p.dashT = 0.2; p.dashCd = this.dashCooldown(); p.inv = Math.max(p.inv, 0.28); p.dashId++;
      audio.sfx("dash"); this.tut.dashes++;
      this.burst(p.x, p.y, "#ffffff", 8, 120, 0.3, 3);
    }
    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDx * 800; p.vy = p.dashDy * 800;
      if (this.parts.length < 700) this.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: 12, color: `hsl(${this.cfg.hue},70%,70%)`, glow: true, drag: 0, kind: 2 });
      if (this.mods.dashStrike > 0) {
        for (const e of this.enemies) if (!e.dead && e.spawning <= 0 && e.hitDash !== p.dashId && dist(e.x, e.y, p.x, p.y) < e.r + p.r + 16) {
          e.hitDash = p.dashId;
          this.hitEnemy(e, (14 + 26 * this.mods.dashStrike) * this.mods.dmg, false, p.dashDx * 160, p.dashDy * 160, p.x, p.y, true);
        }
      }
    } else {
      const k = 1 - Math.exp(-(onIce ? 3 : 20) * dt);
      p.vx += (mx * speed - p.vx) * k; p.vy += (my * speed - p.vy) * k;
    }
    // void pull
    for (const z of this.zones) if (z.kind === "void") {
      const d = dist(p.x, p.y, z.x, z.y);
      if (d < z.r * 1.6 && d > 4) { const f = (1 - d / (z.r * 1.6)) * 150; p.vx += ((z.x - p.x) / d) * f * dt * 6; p.vy += ((z.y - p.y) / d) * f * dt * 6; }
    }
    const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
    const [px, py] = this.pushOut(nx, ny, p.r);
    this.tut.moved += Math.hypot(px - p.x, py - p.y);
    p.x = px; p.y = py;

    if (this.mods.regen > 0) p.hp = Math.min(this.maxHp, p.hp + this.mods.regen * dt);

    if (wantsAttack && p.atkT <= 0 && p.dashT <= 0) this.attack();
    if (this.pressed.has("potion")) this.usePotion();
    if (this.pressed.has("special") && p.special >= 100) this.roar();
    if (p.special >= 100 && !p.specialReady) { p.specialReady = true; audio.sfx("specialReady"); this.text(p.x, p.y - 40, "ROAR READY", "#ffcf5a", 18); }
    if (p.special < 100) p.specialReady = false;
  }

  usePotion() {
    const p = this.p;
    if (p.potions <= 0 || p.hp >= this.maxHp) { if (p.potions <= 0) audio.sfx("error"); return; }
    p.potions--; this.run.potionsUsed++; this.tut.potion = true;
    const amt = Math.round(this.maxHp * this.mods.potionHeal);
    p.hp = Math.min(this.maxHp, p.hp + amt);
    audio.sfx("potion");
    this.text(p.x, p.y - 30, `+${amt}`, "#7dff9a", 22);
    this.burst(p.x, p.y, "#7dff9a", 22, 160, 0.7, 3);
  }

  rollDamage(mult: number): { d: number; crit: boolean } {
    const p = this.p;
    const bers = 1 + this.mods.berserk * (1 - p.hp / this.maxHp);
    const crit = Math.random() < this.mods.crit;
    let d = 16 * this.mods.dmg * mult * bers * rnd(0.92, 1.08);
    if (crit) d *= this.mods.critDmg;
    return { d, crit };
  }

  attack() {
    const p = this.p;
    const w = WEAPONS[this.cfg.weapon];
    p.atkT = w.cd / this.mods.atkSpd;
    p.atkAnim = 0.18;
    p.combo++;
    const a = p.face;
    if (w.type === "ranged") {
      const { d, crit } = this.rollDamage(w.dmg);
      this.bullets.push({ x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, r: 6, dmg: d, life: 0.55 * this.mods.reach + 0.2, color: crit ? "#ffd84a" : "#fff2c0", friendly: true, pierce: 0, hit: new Set(), kind: crit ? "arrowc" : "arrow", kb: w.kb });
      audio.sfx("arrow");
      p.vx -= Math.cos(a) * 40; p.vy -= Math.sin(a) * 40;
    } else {
      const range = w.range * this.mods.reach, arc = w.arc;
      this.slashes.push({ x: p.x, y: p.y, a, range, arc, t: 0, life: 0.18, color: this.cfg.weapon === "hammer" ? "#ffb06a" : "#e8f4ff" });
      p.vx += Math.cos(a) * 90; p.vy += Math.sin(a) * 90;
      audio.sfx("swing", this.cfg.weapon === "hammer" ? 0.6 : 1);
      let hitAny = false;
      for (const e of this.enemies) {
        if (e.dead || e.spawning > 0) continue;
        const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
        if (d > range + e.r) continue;
        const slack = Math.atan2(e.r, Math.max(d, 1));
        if (Math.abs(angDiff(Math.atan2(dy, dx), a)) > arc / 2 + slack) continue;
        const r = this.rollDamage(w.dmg);
        const nxk = d > 0 ? dx / d : 1, nyk = d > 0 ? dy / d : 0;
        this.hitEnemy(e, r.d, r.crit, nxk * w.kb, nyk * w.kb, p.x, p.y);
        if (this.cfg.weapon === "hammer") e.stun = Math.max(e.stun, 0.6);
        hitAny = true;
      }
      if (hitAny) this.shake(this.cfg.weapon === "hammer" ? 9 : 3);
      // deflect bullets
      for (const b of this.bullets) {
        if (b.friendly) continue;
        const d = dist(b.x, b.y, p.x, p.y);
        if (d > range + b.r + 10) continue;
        if (Math.abs(angDiff(Math.atan2(b.y - p.y, b.x - p.x), a)) > arc / 2 + 0.35) continue;
        const sp = Math.hypot(b.vx, b.vy) * 1.3 + 100;
        b.vx = Math.cos(a) * sp; b.vy = Math.sin(a) * sp; b.friendly = true; b.dmg = (14 + b.dmg * 0.6) * this.mods.dmg; b.color = "#9fe8ff"; b.life = 2; b.kind = "deflect"; b.pierce = 1;
        this.run.deflects++; this.tut.deflected++;
        audio.sfx("deflect"); this.burst(b.x, b.y, "#9fe8ff", 8, 160, 0.3, 2); this.text(b.x, b.y - 10, "DEFLECT", "#9fe8ff", 14);
      }
    }
    if (this.mods.echo > 0 && p.combo % Math.max(2, 5 - this.mods.echo) === 0) {
      const { d } = this.rollDamage(0.9);
      this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, r: 26, dmg: d, life: 0.7, color: "#8fe0ff", friendly: true, pierce: 99, hit: new Set(), kind: "wave", kb: 120 });
      audio.sfx("special", 1.5);
    }
  }

  roar() {
    const p = this.p;
    p.special = 0; p.specialReady = false; p.inv = Math.max(p.inv, 0.9);
    this.run.specials++; this.tut.usedSpecial = true;
    const R = 300 + Math.min(this.cfg.ancestors, 10) * 14;
    const dmg = 70 * this.mods.dmg * (1 + 0.1 * Math.min(this.cfg.ancestors, 12));
    audio.sfx("special");
    this.shake(24);
    this.ring(p.x, p.y, "#ffcf5a", R, 0.7); this.ring(p.x, p.y, "#ffffff", R * 0.6, 0.5);
    this.burst(p.x, p.y, "#ffcf5a", 50, 420, 0.9, 4);
    const gh = Math.min(this.cfg.ancestors, 10);
    for (let i = 0; i < gh; i++) {
      const a = (i / gh) * Math.PI * 2;
      this.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, life: 0.8, max: 0.8, size: 16, color: "#cfe8ff", glow: true, drag: 2.5, kind: 3, a });
    }
    for (const e of this.enemies) {
      if (e.dead || e.spawning > 0) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      if (d > R + e.r) continue;
      const nx = d > 0 ? (e.x - p.x) / d : 1, ny = d > 0 ? (e.y - p.y) / d : 0;
      this.hitEnemy(e, dmg, true, nx * 520, ny * 520, p.x, p.y, true);
      e.stun = Math.max(e.stun, 1.2);
    }
    for (const b of this.bullets) if (!b.friendly && dist(b.x, b.y, p.x, p.y) < R) { b.life = 0; this.burst(b.x, b.y, "#ffcf5a", 3, 80, 0.3, 2); }
    this.hitStop = 0.1;
  }

  updateOrbit(dt: number) {
    const n = this.mods.orbit;
    if (n <= 0 || this.p.dead) return;
    this.orbitA += dt * 3.4;
    for (let i = 0; i < n; i++) {
      const a = this.orbitA + (i / n) * Math.PI * 2;
      const bx = this.p.x + Math.cos(a) * 58, by = this.p.y + Math.sin(a) * 58;
      for (const e of this.enemies) {
        if (e.dead || e.spawning > 0) continue;
        e.orbitHit -= dt;
        if (e.orbitHit <= 0 && dist(bx, by, e.x, e.y) < e.r + 14) {
          e.orbitHit = 0.4;
          this.hitEnemy(e, this.rollDamage(0.55).d, false, Math.cos(a) * 80, Math.sin(a) * 80, bx, by, true);
        }
      }
      for (const b of this.bullets) if (!b.friendly && dist(bx, by, b.x, b.y) < b.r + 14) { b.life = 0; this.burst(b.x, b.y, "#cfe8ff", 4, 100, 0.3, 2); audio.sfx("deflect"); }
    }
  }

  // ---------------- damage ----------------
  hitEnemy(e: Enemy, dmg: number, crit: boolean, kx: number, ky: number, sx: number, sy: number, noChain = false) {
    if (e.dead || e.spawning > 0) return;
    if (e.boss >= 0 && e.inv > 0) { this.text(e.x, e.y - e.r, "IMMUNE", "#aaaaaa", 14); return; }
    if (e.type === "knight" && e.stun <= 0 && Math.abs(angDiff(Math.atan2(sy - e.y, sx - e.x), e.face)) < 1.0) {
      dmg *= 0.15; kx *= 0.1; ky *= 0.1; crit = false;
      this.text(e.x, e.y - e.r - 6, "BLOCK", "#9ab0c8", 14);
      this.burst(e.x, e.y, "#cfe0f5", 6, 160, 0.25, 2); audio.sfx("deflect");
    }
    e.hp -= dmg; e.flash = 0.12; e.hurtAnim = 0.15;
    this.run.damage += dmg;
    const kbm = e.boss >= 0 ? 0.08 : e.elite ? 0.4 : 1;
    e.kx += kx * kbm; e.ky += ky * kbm;
    this.dmgText(e.x, e.y - e.r, dmg, crit);
    this.burst(e.x, e.y, crit ? "#ffd84a" : e.color, crit ? 10 : 5, crit ? 260 : 170, 0.35, 2.5);
    audio.sfx(crit ? "crit" : "hit", rnd(0.9, 1.15));
    this.hitStop = Math.max(this.hitStop, crit ? 0.06 : 0.025);
    if (e.type === "dummy") this.tut.hits++;
    this.p.special = Math.min(100, this.p.special + (crit ? 5 : 3) * this.mods.special);
    if (this.mods.lifesteal > 0 && this.p.hp < this.maxHp) { const h = dmg * this.mods.lifesteal; this.p.hp = Math.min(this.maxHp, this.p.hp + h); if (h >= 1) this.text(this.p.x, this.p.y - 24, `+${Math.round(h)}`, "#ff7a8a", 12); }
    if (this.mods.burn > 0) { e.burnT = 3; e.burnDps = this.mods.burn; }
    if (this.mods.slow > 0 && Math.random() < this.mods.slow) e.slowT = 2;
    if (!noChain && this.mods.chain > 0 && Math.random() < this.mods.chain) {
      let best: Enemy | null = null, bd = 230;
      for (const o of this.enemies) { if (o === e || o.dead || o.spawning > 0) continue; const d = dist(o.x, o.y, e.x, e.y); if (d < bd) { bd = d; best = o; } }
      if (best) {
        this.bolts.push({ x1: e.x, y1: e.y, x2: best.x, y2: best.y, t: 0 });
        this.hitEnemy(best, dmg * 0.55, false, 0, 0, e.x, e.y, true);
      }
    }
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.burst(e.x, e.y, e.color, e.boss >= 0 ? 80 : e.elite ? 30 : 14, e.boss >= 0 ? 420 : 250, 0.6, 3.5);
    this.ring(e.x, e.y, e.color, e.r * 2.5, 0.35);
    if (e.type === "dummy") { this.dummyRespawn = 1.2; audio.sfx("kill"); return; }
    audio.sfx("kill", e.boss >= 0 ? 0.5 : rnd(0.9, 1.2));
    this.shake(e.boss >= 0 ? 30 : e.elite ? 10 : 3);
    if (!e.summoned || Math.random() < 0.5) this.run.kills++;
    this.p.special = Math.min(100, this.p.special + 6 * this.mods.special);
    const def = e.boss >= 0 ? null : ENEMIES[e.type];
    const base = e.boss >= 0 ? 90 * (e.boss + 1) : def!.gold * (1 + this.realm * 0.4) * (e.elite ? 4 : 1) * (e.summoned ? 0.4 : 1);
    const gv = base * this.cfg.diff.gold * this.mods.gold;
    const n = e.boss >= 0 ? 30 : clamp(Math.round(gv / 2.5), 1, 8);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = rnd(60, 200);
      this.coins.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, v: gv / n, heart: false, t: 0 });
    }
    if (e.boss < 0 && !e.summoned && Math.random() < 0.06 + this.mods.crit * 0.2) this.coins.push({ x: e.x, y: e.y, vx: rnd(-60, 60), vy: rnd(-60, 60), v: 0, heart: true, t: 0 });
    if (e.boss >= 0) {
      this.run.bosses++;
      this.bullets = this.bullets.filter((b) => b.friendly);
      for (const o of this.enemies) if (o !== e && !o.dead && o.boss < 0) { o.hp = 0; o.dead = true; this.burst(o.x, o.y, o.color, 10, 200, 0.5, 3); }
      this.zones = this.zones.filter((z) => z.kind !== "fire" && z.kind !== "strike");
      this.hitStop = 0.25;
      this.banner = { text: "VICTORY", sub: BOSSES[e.boss].name + " falls", t: 3, color: "#ffe9a0" };
    }
  }

  hurtPlayer(dmg: number, sx: number, sy: number, kb = 220) {
    const p = this.p;
    if (p.inv > 0 || p.dead) return;
    dmg *= this.mods.taken;
    if (this.cfg.tutorial) dmg = Math.min(dmg, Math.max(0, p.hp - 1));
    p.hp -= dmg; p.inv = 0.7; p.flash = 1; this.run.taken += dmg;
    this.shake(14); this.hitStop = Math.max(this.hitStop, 0.06);
    const d = dist(p.x, p.y, sx, sy) || 1;
    p.vx += ((p.x - sx) / d) * kb; p.vy += ((p.y - sy) / d) * kb;
    this.text(p.x, p.y - 22, `-${Math.round(dmg)}`, "#ff5a5a", 20);
    this.burst(p.x, p.y, "#ff4a4a", 14, 220, 0.5, 3);
    audio.sfx("hurt");
    if (this.mods.thorns > 0) {
      this.ring(p.x, p.y, "#7dff9a", 140, 0.4);
      for (const e of this.enemies) if (!e.dead && e.spawning <= 0 && dist(e.x, e.y, p.x, p.y) < 140 + e.r) {
        const dd = dist(e.x, e.y, p.x, p.y) || 1;
        this.hitEnemy(e, this.mods.thorns * this.mods.dmg, false, ((e.x - p.x) / dd) * 260, ((e.y - p.y) / dd) * 260, p.x, p.y, true);
      }
    }
    if (p.hp <= 0) {
      if (this.mods.revive > this.run.revivesUsed) {
        this.run.revivesUsed++;
        p.hp = this.maxHp * 0.4; p.inv = 2;
        audio.sfx("revive"); this.shake(25);
        this.ring(p.x, p.y, "#ffffff", 360, 0.8);
        this.text(p.x, p.y - 50, "ANCESTOR'S MERCY", "#ffffff", 22);
        for (const b of this.bullets) if (!b.friendly) b.life = 0;
        for (const e of this.enemies) if (!e.dead) { e.stun = Math.max(e.stun, 1.5); const dd = dist(e.x, e.y, p.x, p.y) || 1; e.kx += ((e.x - p.x) / dd) * 500; e.ky += ((e.y - p.y) / dd) * 500; }
      } else {
        p.hp = 0; p.dead = true; p.deadT = 1.4;
        this.burst(p.x, p.y, `hsl(${this.cfg.hue},70%,60%)`, 50, 300, 1, 4);
        this.hitStop = 0.2; this.shake(30);
      }
    }
  }

  // ---------------- enemies ----------------
  fire(e: Enemy, a: number, speed: number, dmg: number, r = 6, color = "#ffe27a", kind = "orb") {
    this.bullets.push({ x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, dmg, life: 6, color, friendly: false, pierce: 0, hit: new Set(), kind, kb: 0 });
  }

  updateEnemies(dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.t += dt; e.flash = Math.max(0, e.flash - dt); e.hurtAnim = Math.max(0, e.hurtAnim - dt);
      if (e.spawning > 0) { e.spawning -= dt; continue; }
      // status
      if (e.burnT > 0) {
        e.burnT -= dt; e.hp -= e.burnDps * dt; e.burnTick -= dt;
        if (e.burnTick <= 0) { e.burnTick = 0.5; this.burst(e.x, e.y - e.r * 0.5, "#ff9a3a", 2, 60, 0.4, 2.5); if (this.opts.getSettings().numbers) this.text(e.x, e.y - e.r, `${Math.round(e.burnDps * 0.5)}`, "#ff9a3a", 12); }
        this.run.damage += e.burnDps * dt;
        if (e.hp <= 0) { this.killEnemy(e); continue; }
      }
      e.slowT = Math.max(0, e.slowT - dt);
      e.stun = Math.max(0, e.stun - dt);
      e.atkT = Math.max(0, e.atkT - dt);
      let slow = e.slowT > 0 ? 0.5 : 1;
      if (this.zoneAt(e.x, e.y, "bog")) slow *= 0.6;
      e.face = e.boss >= 0 && e.pat ? e.face : Math.atan2(p.y - e.y, p.x - e.x);
      let mvx = 0, mvy = 0;
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      if (e.boss >= 0) { this.bossUpdate(e, dt); }
      else if (e.stun > 0 || p.dead && e.type !== "dummy") { /* stunned */ }
      else switch (e.type) {
        case "grub": {
          mvx = ux * e.spd; mvy = uy * e.spd;
          mvx += Math.cos(e.t * 3 + e.id) * 25; mvy += Math.sin(e.t * 3 + e.id) * 25;
          if (d < e.r + p.r + 4 && e.atkT <= 0) { e.atkT = 0.9; this.hurtPlayer(e.dmg, e.x, e.y, 200); }
          break;
        }
        case "spitter": {
          const want = d < 200 ? -1 : d > 330 ? 1 : 0;
          mvx = ux * e.spd * want + -uy * e.spd * 0.5 * Math.sin(e.t * 0.7 + e.id); mvy = uy * e.spd * want + ux * e.spd * 0.5 * Math.sin(e.t * 0.7 + e.id);
          e.st -= dt;
          if (e.state === "walk" && e.st <= 0) { e.state = "wind"; e.st = 0.55; audio.sfx("telegraph"); }
          else if (e.state === "wind") { mvx *= 0.2; mvy *= 0.2; if (e.st <= 0) {
            const n = this.realm >= 2 ? 3 : 1; const a = Math.atan2(dy, dx);
            for (let i = 0; i < n; i++) this.fire(e, a + (i - (n - 1) / 2) * 0.22, 230, e.dmg, 6, "#d6e86a");
            audio.sfx("shoot"); e.state = "walk"; e.st = rnd(1.8, 2.6);
          } }
          break;
        }
        case "charger": {
          e.st -= dt;
          if (e.state === "walk") { mvx = ux * e.spd * 0.7; mvy = uy * e.spd * 0.7; if (e.st <= 0 && d < 520) { e.state = "wind"; e.st = 0.75; e.ang = Math.atan2(dy, dx); audio.sfx("telegraph"); } }
          else if (e.state === "wind") { if (e.st > 0.25) e.ang = Math.atan2(dy, dx); e.face = e.ang; if (e.st <= 0) { e.state = "dash"; e.st = 0.65; e.pd.hit = false; } }
          else if (e.state === "dash") {
            e.face = e.ang; mvx = Math.cos(e.ang) * 520; mvy = Math.sin(e.ang) * 520;
            if (this.parts.length < 700 && Math.random() < 0.6) this.burst(e.x, e.y, "#d39a7a", 1, 40, 0.3, 3, false);
            if (!e.pd.hit && d < e.r + p.r + 4) { e.pd.hit = true; this.hurtPlayer(e.dmg, e.x, e.y, 360); }
            const [nx, ny] = this.pushOut(e.x + mvx * dt, e.y + mvy * dt, e.r);
            if (Math.hypot(nx - (e.x + mvx * dt), ny - (e.y + mvy * dt)) > 1) { e.st = 0; this.shake(6); this.burst(e.x, e.y, "#ffffff", 8, 160, 0.3, 2); e.state = "stun"; e.st = 1.1; }
            if (e.st <= 0 && e.state === "dash") { e.state = "stun"; e.st = 0.9; }
          } else if (e.state === "stun") { if (e.st <= 0) { e.state = "walk"; e.st = rnd(1.4, 2.2); } }
          break;
        }
        case "bomber": {
          if (e.state === "walk") {
            mvx = ux * e.spd; mvy = uy * e.spd;
            if (d < 75) { e.state = "fuse"; e.st = 0.65; audio.sfx("telegraph"); }
          } else if (e.state === "fuse") {
            e.st -= dt;
            if (e.st <= 0) this.explode(e);
          }
          break;
        }
        case "shaman": {
          const want = d < 260 ? -1 : d > 380 ? 1 : 0;
          mvx = ux * e.spd * want; mvy = uy * e.spd * want;
          e.st -= dt;
          if (e.state === "walk" && e.st <= 0) { e.state = "wind"; e.st = 0.8; audio.sfx("telegraph"); }
          else if (e.state === "wind") { mvx = 0; mvy = 0; if (e.st <= 0) {
            const alive = this.enemies.filter((o) => !o.dead && o.boss < 0).length;
            if (alive < 14) for (let i = 0; i < 2; i++) { const a = Math.random() * 6.283; this.spawnEnemy("grub", clamp(e.x + Math.cos(a) * 50, 60, W - 60), clamp(e.y + Math.sin(a) * 50, 80, H - 60), false, false, true); }
            this.burst(e.x, e.y, "#b890e8", 16, 180, 0.5, 3); e.state = "walk"; e.st = rnd(4.5, 6);
          } }
          break;
        }
        case "knight": {
          if (e.state === "walk") {
            mvx = ux * e.spd; mvy = uy * e.spd;
            if (d < 62 && e.atkT <= 0) { e.state = "wind"; e.st = 0.55; audio.sfx("telegraph"); }
          } else if (e.state === "wind") {
            e.st -= dt;
            if (e.st <= 0) {
              if (d < 78) this.hurtPlayer(e.dmg, e.x, e.y, 300);
              this.slashes.push({ x: e.x, y: e.y, a: e.face, range: 70, arc: 1.6, t: 0, life: 0.18, color: "#ffb0b0" });
              e.state = "walk"; e.atkT = 1.3;
            }
          }
          break;
        }
        default: break;
      }
      if (e.elite && e.stun <= 0 && e.type !== "dummy") {
        e.eliteT -= dt;
        if (e.eliteT <= 0) { e.eliteT = 3.6; const n = 10; for (let i = 0; i < n; i++) this.fire(e, (i / n) * 6.283 + e.t, 160, e.dmg * 0.7, 5, "#ffd84a"); audio.sfx("shoot"); this.ring(e.x, e.y, "#ffd84a", e.r * 2.5, 0.3); }
      }
      // boss contact damage
      if (e.boss >= 0 && e.spawning <= 0 && d < e.r + p.r && e.atkT <= 0) { e.atkT = 0.8; this.hurtPlayer(e.dmg, e.x, e.y, 320); }
      // movement + knockback
      e.kx *= Math.exp(-7 * dt); e.ky *= Math.exp(-7 * dt);
      const sm = e.stun > 0 ? 0 : slow;
      const [nx, ny] = this.pushOut(e.x + (mvx * sm + e.kx) * dt, e.y + (mvy * sm + e.ky) * dt, e.r);
      e.x = nx; e.y = ny;
      // lava / spike hazards also harm enemies
      for (const z of this.zones) if (z.kind === "spikes" && this.spikeOn(z) && !e.pd.spk && dist(e.x, e.y, z.x, z.y) < 36 + e.r && e.boss < 0) { e.hp -= 25; e.pd.spk = 1; this.text(e.x, e.y - e.r, "25", "#ffaa66", 14); if (e.hp <= 0) this.killEnemy(e); }
      if (e.pd.spk) { e.pd.spk += dt; if (e.pd.spk > 2) e.pd.spk = 0; }
    }
    // separation
    const list = this.enemies.filter((e) => !e.dead && e.spawning <= 0 && e.boss < 0 && e.type !== "dummy");
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy), m = a.r + b.r;
      if (dd < m && dd > 0.01) { const push = (m - dd) * 0.5; a.x -= (dx / dd) * push * 0.5; a.y -= (dy / dd) * push * 0.5; b.x += (dx / dd) * push * 0.5; b.y += (dy / dd) * push * 0.5; }
    }
    if (this.dummyRespawn > 0) { this.dummyRespawn -= dt; if (this.dummyRespawn <= 0 && this.cfg.tutorial && this.tut.step <= 2) this.spawnEnemy("dummy", W / 2, 260, false, true); }
    this.enemies = this.enemies.filter((e) => !e.dead || false);
  }

  explode(e: Enemy) {
    e.dead = true;
    const R = 95;
    audio.sfx("explode"); this.shake(14);
    this.ring(e.x, e.y, "#ff8855", R, 0.4); this.burst(e.x, e.y, "#ffb060", 36, 360, 0.6, 4);
    if (dist(e.x, e.y, this.p.x, this.p.y) < R + this.p.r) this.hurtPlayer(e.dmg, e.x, e.y, 420);
    for (const o of this.enemies) if (!o.dead && o !== e && o.spawning <= 0 && o.boss < 0 && dist(o.x, o.y, e.x, e.y) < R + o.r) {
      const dd = dist(o.x, o.y, e.x, e.y) || 1;
      this.hitEnemy(o, 34 * (1 + this.realm * 0.4), false, ((o.x - e.x) / dd) * 400, ((o.y - e.y) / dd) * 400, e.x, e.y, true);
    }
    this.coins.push({ x: e.x, y: e.y, vx: rnd(-80, 80), vy: rnd(-80, 80), v: ENEMIES.bomber.gold * 0.5 * this.cfg.diff.gold, heart: false, t: 0 });
  }

  // ---------------- bosses ----------------
  bossUpdate(e: Enemy, dt: number) {
    const def = BOSSES[e.boss], p = this.p;
    const P = def.phases.length;
    const np = Math.min(P - 1, Math.floor((1 - e.hp / e.maxHp) * P));
    if (np > e.phase) {
      e.phase = np; e.inv = 1.5; e.pat = null; e.cdT = 1.2; e.z = 0;
      audio.sfx("phase"); this.shake(28);
      this.bullets = this.bullets.filter((b) => b.friendly);
      this.ring(e.x, e.y, def.color, 420, 0.9);
      this.burst(e.x, e.y, def.color, 60, 400, 0.9, 4);
      this.banner = { text: np === P - 1 ? "FINAL FORM" : "ENRAGED", sub: def.name, t: 2.2, color: def.color };
    }
    if (e.inv > 0) { e.inv -= dt; return; }
    if (p.dead) return;
    if (!e.pat) {
      e.cdT -= dt;
      const d = dist(e.x, e.y, p.x, p.y);
      const sp = (50 + e.phase * 15) * (e.slowT > 0 ? 0.5 : 1) * this.cfg.diff.spd;
      if (e.stun <= 0 && d > 160) { const [nx, ny] = this.pushOut(e.x + ((p.x - e.x) / d) * sp * dt, e.y + ((p.y - e.y) / d) * sp * dt, e.r); e.x = nx; e.y = ny; }
      if (e.cdT <= 0 && e.stun <= 0) {
        const list = def.phases[e.phase].filter((x) => x !== e.lastPat);
        e.pat = list[Math.floor(Math.random() * list.length)];
        e.lastPat = e.pat; e.patT = 0; e.pd = {};
        audio.sfx("telegraph");
      }
      return;
    }
    if (e.stun > 0) return;
    e.patT += dt;
    if (this.bossPattern(e, dt)) { e.pat = null; e.cdT = Math.max(0.45, rnd(0.9, 1.4) - e.phase * 0.22); e.z = 0; }
  }

  bossPattern(e: Enemy, dt: number): boolean {
    const def = BOSSES[e.boss], p = this.p, ph = e.phase, t = e.patT, pd = e.pd;
    const aimP = Math.atan2(p.y - e.y, p.x - e.x);
    const bd = 12 + e.boss * 1.5;
    switch (e.pat) {
      case "spread": {
        if (t < 0.7) { e.face = aimP; pd.a = aimP; }
        const n = 5 + ph * 2, shots = 3, k = pd.k || 0;
        if (k < shots && t >= 0.7 + k * 0.35) {
          pd.k = k + 1;
          const arc = 1.0 + ph * 0.15;
          for (let i = 0; i < n; i++) this.fire(e, pd.a + (i / (n - 1) - 0.5) * arc, 240 + ph * 20, this.edmg(bd * 0.8), 7, def.color, "orb");
          audio.sfx("shoot"); this.shake(3);
        }
        return t > 0.7 + shots * 0.35 + 0.25;
      }
      case "ring": {
        const n = 16 + ph * 4;
        if (!pd.r1 && t >= 0.6) { pd.r1 = true; for (let i = 0; i < n; i++) this.fire(e, (i / n) * 6.283, 190, this.edmg(bd * 0.8), 7, def.color); audio.sfx("shoot"); this.ring(e.x, e.y, def.color, 120, 0.3); this.shake(5); }
        if (!pd.r2 && t >= 1.1) { pd.r2 = true; for (let i = 0; i < n; i++) this.fire(e, ((i + 0.5) / n) * 6.283, 210, this.edmg(bd * 0.8), 7, def.color); audio.sfx("shoot"); this.ring(e.x, e.y, def.color, 140, 0.3); this.shake(5); }
        return t > 1.7;
      }
      case "spiral": {
        if (t >= 0.5 && t < 3.5) {
          pd.acc = (pd.acc || 0) + dt;
          while (pd.acc >= 0.075) {
            pd.acc -= 0.075; pd.a = (pd.a || 0) + 0.43;
            this.fire(e, pd.a, 200, this.edmg(bd * 0.7), 6, def.color);
            if (ph >= 1) this.fire(e, pd.a + Math.PI, 200, this.edmg(bd * 0.7), 6, def.color);
            if (ph >= 2) this.fire(e, pd.a + Math.PI / 2, 200, this.edmg(bd * 0.7), 6, def.color);
          }
          if (Math.random() < 0.1) audio.sfx("shoot");
        }
        return t > 3.8;
      }
      case "charge": {
        if (t < 0.55) { pd.a = aimP; e.face = aimP; }
        if (t >= 0.8 && !pd.done) {
          const sp = 620 + ph * 40;
          const nx = e.x + Math.cos(pd.a) * sp * dt, ny = e.y + Math.sin(pd.a) * sp * dt;
          const [cx, cy] = this.pushOut(nx, ny, e.r);
          const blocked = Math.hypot(cx - nx, cy - ny) > 1 || cx <= 34 + e.r + 100 && Math.cos(pd.a) < 0 && false;
          e.x = cx; e.y = cy;
          if (this.parts.length < 700) this.burst(e.x, e.y, def.color, 2, 80, 0.4, 5, false);
          if (!pd.hit && dist(e.x, e.y, p.x, p.y) < e.r + p.r) { pd.hit = true; this.hurtPlayer(e.dmg * 1.4, e.x, e.y, 420); }
          if (blocked || t > 1.7) { pd.done = true; pd.doneT = t; this.shake(18); audio.sfx("explode"); const n = 10 + ph * 2; for (let i = 0; i < n; i++) this.fire(e, (i / n) * 6.283, 180, this.edmg(bd * 0.7), 7, def.color); }
        }
        return !!pd.done && t > pd.doneT + 0.7;
      }
      case "slam": {
        if (!pd.init) { pd.init = true; pd.tx = p.x; pd.ty = p.y; pd.sx = e.x; pd.sy = e.y; this.zones.push({ kind: "strike", x: p.x, y: p.y, r: 120, t: 0, warn: 0.95, life: 0, dmg: this.edmg(bd * 1.6), tick: 0, hit: false, period: -1, offset: 0 }); }
        if (t < 0.95) {
          const k = ease(t / 0.95);
          e.x = lerp(pd.sx, pd.tx, k); e.y = lerp(pd.sy, pd.ty, k); e.z = Math.sin(k * Math.PI) * 70;
        } else if (!pd.land) {
          pd.land = true; e.z = 0; this.shake(26); audio.sfx("explode");
          const n = 8 + ph * 4; for (let i = 0; i < n; i++) this.fire(e, (i / n) * 6.283, 170, this.edmg(bd * 0.7), 8, def.color);
        }
        return t > 1.5;
      }
      case "summon": {
        if (t >= 0.8 && !pd.s) {
          pd.s = true;
          const alive = this.enemies.filter((o) => !o.dead && o.boss < 0).length;
          const n = Math.min(2 + ph + (e.boss >= 4 ? 1 : 0), Math.max(0, 9 - alive));
          for (let i = 0; i < n; i++) {
            const a = (i / Math.max(1, n)) * 6.283 + Math.random();
            this.spawnEnemy(def.adds[Math.floor(Math.random() * def.adds.length)], clamp(e.x + Math.cos(a) * 130, 70, W - 70), clamp(e.y + Math.sin(a) * 130, 90, H - 60), false, false, true);
          }
          this.ring(e.x, e.y, def.color, 160, 0.5); audio.sfx("bossroar"); this.shake(8);
        }
        return t > 1.6;
      }
      case "zones": {
        if (!pd.s) {
          pd.s = true;
          const n = 4 + ph * 2;
          for (let i = 0; i < n; i++) {
            const x = i === 0 ? p.x : clamp(p.x + rnd(-260, 260), 90, W - 90), y = i === 0 ? p.y : clamp(p.y + rnd(-200, 200), 120, H - 80);
            this.zones.push({ kind: "fire", x, y, r: 72, t: 0, warn: 1.0, life: 3.5, dmg: this.edmg(bd * 0.5), tick: 0, hit: false, period: -1, offset: 0 });
          }
        }
        return t > 1.4;
      }
      case "rain": {
        pd.k = pd.k || 0;
        while (pd.k < 12 && t >= pd.k * 0.17) {
          const near = pd.k % 2 === 0;
          const x = near ? clamp(p.x + rnd(-90, 90), 70, W - 70) : rnd(80, W - 80), y = near ? clamp(p.y + rnd(-90, 90), 100, H - 60) : rnd(110, H - 60);
          this.zones.push({ kind: "strike", x, y, r: 62, t: 0, warn: 0.8, life: 0, dmg: this.edmg(bd * 1.1), tick: 0, hit: false, period: -1, offset: 0 });
          pd.k++;
        }
        return t > 2.6;
      }
      default: return true;
    }
  }

  // ---------------- bullets / zones / coins ----------------
  updateBullets(dt: number) {
    const p = this.p;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      for (const z of this.zones) if (z.kind === "void" && !b.friendly) { const d = dist(b.x, b.y, z.x, z.y); if (d < z.r * 1.4 && d > 3) { b.vx += ((z.x - b.x) / d) * 90 * dt; b.vy += ((z.y - b.y) / d) * 90 * dt; } }
      b.x += b.vx * dt; b.y += b.vy * dt;
      let dead = b.life <= 0 || b.x < 20 || b.x > W - 20 || b.y < 40 || b.y > H - 20;
      if (!dead && b.kind !== "wave") for (const o of this.obstacles) if (dist(b.x, b.y, o.x, o.y) < o.r + b.r) { dead = true; this.burst(b.x, b.y, b.color, 4, 100, 0.3, 2); break; }
      if (!dead) {
        if (b.friendly) {
          for (const e of this.enemies) {
            if (e.dead || e.spawning > 0 || b.hit.has(e.id)) continue;
            if (dist(b.x, b.y, e.x, e.y) < e.r + b.r) {
              b.hit.add(e.id);
              const crit = b.kind === "arrowc";
              const sp = Math.hypot(b.vx, b.vy) || 1;
              this.hitEnemy(e, b.dmg, crit, (b.vx / sp) * b.kb, (b.vy / sp) * b.kb, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
              if (b.pierce <= 0) { dead = true; break; }
              b.pierce--;
              if (b.pierce <= 0 && b.kind !== "wave") { dead = true; break; }
            }
          }
        } else if (dist(b.x, b.y, p.x, p.y) < b.r + p.r - 2 && !p.dead) {
          if (p.inv <= 0) { this.hurtPlayer(b.dmg, b.x, b.y, 180); dead = true; }
        }
      }
      if (dead) { this.bullets[i] = this.bullets[this.bullets.length - 1]; this.bullets.pop(); }
    }
  }

  spikeOn(z: Zone) { const ph = (this.roomT + z.offset) % z.period; return ph > 1.7 && ph < 2.2; }

  updateZones(dt: number) {
    const p = this.p;
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.t += dt;
      const inside = dist(p.x, p.y, z.x, z.y) < z.r + (z.kind === "spikes" ? 0 : p.r * 0.3);
      if (z.kind === "lava") {
        const ph = (this.roomT + z.offset) % z.period;
        if (ph < 1.4 && inside) { z.tick -= dt; if (z.tick <= 0) { z.tick = 0.4; this.hurtPlayer(this.edmg(z.dmg), z.x, z.y, 100); } }
        if (ph < 1.4 && Math.random() < 0.3) this.burst(z.x + rnd(-z.r, z.r) * 0.8, z.y + rnd(-z.r, z.r) * 0.8, "#ff7a2a", 1, 70, 0.6, 3);
      } else if (z.kind === "spikes") {
        const on = this.spikeOn(z);
        if (on && !z.hit && dist(p.x, p.y, z.x, z.y) < 36 + p.r) { z.hit = true; this.hurtPlayer(this.edmg(z.dmg), z.x, z.y, 120); }
        if (!on) z.hit = false;
      } else if (z.kind === "void") {
        if (dist(p.x, p.y, z.x, z.y) < 26) { z.tick -= dt; if (z.tick <= 0) { z.tick = 0.5; this.hurtPlayer(this.edmg(8), z.x, z.y, 60); } }
      } else if (z.kind === "fire") {
        if (z.t > z.warn) {
          if (inside) { z.tick -= dt; if (z.tick <= 0) { z.tick = 0.35; this.hurtPlayer(z.dmg, z.x, z.y, 80); } }
          if (Math.random() < 0.4) this.burst(z.x + rnd(-z.r, z.r) * 0.7, z.y + rnd(-z.r, z.r) * 0.7, "#ff9a3a", 1, 60, 0.5, 3);
        }
        if (z.t > z.warn + z.life) this.zones.splice(i, 1);
      } else if (z.kind === "strike") {
        if (z.t > z.warn) {
          this.ring(z.x, z.y, "#ffcf6a", z.r, 0.3); this.burst(z.x, z.y, "#ffb060", 14, 260, 0.4, 3); this.shake(8); audio.sfx("explode", 1.4);
          if (dist(p.x, p.y, z.x, z.y) < z.r + p.r * 0.5) this.hurtPlayer(z.dmg, z.x, z.y, 300);
          this.zones.splice(i, 1);
        }
      }
    }
  }

  updateCoins(dt: number) {
    const p = this.p;
    const mag = 70 + this.mods.magnet + (this.cleared ? 2000 : 0);
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.t += dt;
      c.vx *= Math.exp(-4 * dt); c.vy *= Math.exp(-4 * dt);
      const d = dist(c.x, c.y, p.x, p.y);
      if (c.t > 0.35 && d < mag && !p.dead) { const sp = 380 + (mag > 1000 ? 400 : 0); c.vx += ((p.x - c.x) / (d || 1)) * sp * dt * 8; c.vy += ((p.y - c.y) / (d || 1)) * sp * dt * 8; }
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (d < 18 && !p.dead) {
        if (c.heart) { this.healFrac(0.1); } else { this.run.gold += c.v; audio.sfx("coin", rnd(0.9, 1.3)); if (Math.random() < 0.3) this.text(p.x, p.y - 26, `+${Math.max(1, Math.round(c.v))}`, "#ffd84a", 12); }
        this.coins[i] = this.coins[this.coins.length - 1]; this.coins.pop();
      }
    }
  }

  // ---------------- room flow ----------------
  updateRoom(dt: number) {
    if (this.cleared) {
      this.clearT -= dt;
      if (this.clearT <= 0 && this.clearT > -5) {
        this.clearT = -10;
        if (this.roomKind === "boss") this.opts.onEvent({ type: "bossDown", boss: REALMS[this.realm].boss });
        else this.opts.onEvent({ type: "roomCleared", kind: this.roomKind });
      }
      return;
    }
    if (this.roomKind === "tutorial" || this.p.dead) return;
    const alive = this.enemies.filter((e) => !e.dead).length;
    if (this.roomKind === "boss") {
      if (!this.enemies.some((e) => e.boss >= 0 && !e.dead) && this.roomT > 2) this.finishRoom(3);
      return;
    }
    if (alive === 0) {
      this.waveDelay -= dt;
      if (this.waveDelay <= 0) {
        if (this.waveIdx < this.waves.length) {
          const wave = this.waves[this.waveIdx++];
          for (const s of wave) {
            if (s.startsWith("elite:")) this.spawnEnemy(s.slice(6), undefined, undefined, true);
            else this.spawnEnemy(s);
          }
          audio.sfx("telegraph");
          this.waveDelay = 0.6;
        } else this.finishRoom(1.4);
      }
    }
  }

  finishRoom(delay: number) {
    this.cleared = true; this.clearT = delay;
    this.run.rooms++;
    const bonus = 10 * (this.realm + 1) * (this.roomKind === "gold" ? 3 : 1) * this.cfg.diff.gold * this.mods.gold;
    this.run.gold += bonus;
    this.text(this.p.x, this.p.y - 50, `+${Math.round(bonus)} gold`, "#ffd84a", 20);
    this.banner = this.banner && this.roomKind === "boss" ? this.banner : { text: "Room Cleared", sub: "", t: 1.6, color: "#ffe9a0" };
    audio.sfx("boon");
    audio.setMood("hub", REALMS[this.realm].music);
  }

  // ---------------- tutorial ----------------
  updateTutorial() {
    const t = this.tut, p = this.p;
    if (t.done) return;
    const advance = () => { t.step++; t.setup = -1; audio.sfx("select"); this.text(p.x, p.y - 40, "✓", "#7dff9a", 28); };
    if (t.setup !== t.step) {
      t.setup = t.step;
      if (t.step === 3) { for (const e of this.enemies) if (e.type === "dummy") e.dead = true; for (let i = 0; i < 3; i++) this.spawnEnemy("grub"); }
      if (t.step === 4) { p.special = 100; }
      if (t.step === 5) { p.hp = Math.max(1, this.maxHp * 0.35); p.potions = Math.max(1, p.potions); t.potion = false; }
      if (t.step === 6) { this.spawnEnemy("spitter"); }
      if (t.step === 7) { t.done = true; this.opts.onEvent({ type: "tutorialDone" }); }
    }
    switch (t.step) {
      case 0: if (t.moved > 200) advance(); break;
      case 1: if (t.hits >= 5) advance(); break;
      case 2: if (t.dashes >= 3) advance(); break;
      case 3: if (!this.enemies.some((e) => !e.dead && e.type === "grub")) advance(); break;
      case 4: if (t.usedSpecial) advance(); break;
      case 5: if (t.potion) advance(); break;
      case 6: if (!this.enemies.some((e) => !e.dead && e.type === "spitter")) advance(); break;
      default: break;
    }
  }

  // ---------------- render ----------------
  render() {
    const ctx = this.ctx, cv = this.canvas;
    const sc = cv.width / W;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#07050c"; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!this.cfg || !this.floor) return;
    const sh = this.shakeT;
    const ox = sh > 0 ? rnd(-sh, sh) * 0.5 : 0, oy = sh > 0 ? rnd(-sh, sh) * 0.5 : 0;
    ctx.setTransform(sc, 0, 0, sc, ox * sc, oy * sc);
    ctx.drawImage(this.floor, 0, 0);
    const R = REALMS[this.realm];
    this.drawZones(ctx, R.accent);
    // shadows
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (const e of this.enemies) { if (e.dead) continue; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.8, e.r * 0.9, e.r * 0.4, 0, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(this.p.x, this.p.y + 10, 12, 5, 0, 0, 7); ctx.fill();
    // obstacles
    for (const o of this.obstacles) {
      ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(o.x + 4, o.y + o.r * 0.7, o.r, o.r * 0.5, 0, 0, 7); ctx.fill();
      const g = ctx.createLinearGradient(o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r);
      g.addColorStop(0, "#58566a"); g.addColorStop(1, "#27253a");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, o.r - 4, 0, 7); ctx.stroke();
    }
    // coins
    for (const c of this.coins) {
      if (c.heart) { ctx.font = "18px serif"; ctx.textAlign = "center"; ctx.fillText("❤️", c.x, c.y + 6); continue; }
      ctx.fillStyle = "#ffd84a"; ctx.beginPath(); ctx.arc(c.x, c.y, 5 + Math.sin(c.t * 10) * 0.8, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff6b0"; ctx.beginPath(); ctx.arc(c.x - 1.5, c.y - 1.5, 2, 0, 7); ctx.fill();
    }
    // telegraphs for bosses
    for (const e of this.enemies) if (!e.dead && e.boss >= 0) this.drawBossTelegraph(ctx, e);
    const draws: { y: number; f: () => void }[] = [];
    for (const e of this.enemies) if (!e.dead) draws.push({ y: e.y, f: () => this.drawEnemy(ctx, e) });
    draws.push({ y: this.p.y, f: () => this.drawPlayer(ctx) });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.f();
    // orbit blades
    if (this.mods && this.mods.orbit > 0 && !this.p.dead) {
      for (let i = 0; i < this.mods.orbit; i++) {
        const a = this.orbitA + (i / this.mods.orbit) * Math.PI * 2;
        const bx = this.p.x + Math.cos(a) * 58, by = this.p.y + Math.sin(a) * 58;
        ctx.save(); ctx.translate(bx, by); ctx.rotate(a + Math.PI / 2); ctx.fillStyle = "rgba(200,230,255,0.9)"; ctx.shadowColor = "#9fd8ff"; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(5, 6); ctx.lineTo(0, 2); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
    // slashes
    for (const s of this.slashes) {
      const k = s.t / s.life;
      ctx.save(); ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = s.color; ctx.lineCap = "round"; ctx.shadowColor = s.color; ctx.shadowBlur = 12;
      ctx.lineWidth = 10 * (1 - k) + 2;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.range * (0.7 + k * 0.3), s.a - s.arc / 2, s.a + s.arc / 2); ctx.stroke();
      ctx.restore();
    }
    // bolts
    for (const b of this.bolts) {
      ctx.save(); ctx.strokeStyle = "#bfe8ff"; ctx.lineWidth = 3; ctx.shadowColor = "#6fc8ff"; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
      const n = 5; for (let i = 1; i < n; i++) { const t = i / n; ctx.lineTo(lerp(b.x1, b.x2, t) + rnd(-10, 10), lerp(b.y1, b.y2, t) + rnd(-10, 10)); }
      ctx.lineTo(b.x2, b.y2); ctx.stroke(); ctx.restore();
    }
    // bullets
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.bullets) {
      if (b.kind === "wave") {
        ctx.strokeStyle = "rgba(140,220,255,0.7)"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, Math.atan2(b.vy, b.vx) - 1.2, Math.atan2(b.vy, b.vx) + 1.2); ctx.stroke(); continue;
      }
      if (b.kind === "arrow" || b.kind === "arrowc") {
        ctx.strokeStyle = b.color; ctx.lineWidth = 3; const a = Math.atan2(b.vy, b.vx); ctx.beginPath(); ctx.moveTo(b.x - Math.cos(a) * 16, b.y - Math.sin(a) * 16); ctx.lineTo(b.x + Math.cos(a) * 6, b.y + Math.sin(a) * 6); ctx.stroke(); continue;
      }
      ctx.fillStyle = b.color; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, 7); ctx.fill();
    }
    // particles
    for (const q of this.parts) {
      const k = q.life / q.max;
      if (q.kind === 1) {
        ctx.globalAlpha = k * 0.8; ctx.strokeStyle = q.color; ctx.lineWidth = 4 * k + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * k), 0, 7); ctx.stroke();
      } else if (q.kind === 2) {
        ctx.globalAlpha = k * 0.35; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * k, 0, 7); ctx.fill();
      } else if (q.kind === 3) {
        ctx.globalAlpha = k * 0.8; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * 0.6, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(q.x, q.y - q.size * 0.9, q.size * 0.4, 0, 7); ctx.fill();
      } else {
        ctx.globalAlpha = k; ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (0.4 + k * 0.6), 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    // floating text
    ctx.textAlign = "center";
    for (const q of this.texts) {
      const k = q.life / q.max;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `800 ${q.size * (1 + (1 - k) * 0.15)}px system-ui, sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,0.8)"; ctx.strokeText(q.text, q.x, q.y);
      ctx.fillStyle = q.color; ctx.fillText(q.text, q.x, q.y);
    }
    ctx.globalAlpha = 1;
    // vignette + flash
    ctx.setTransform(sc, 0, 0, sc, 0, 0);
    if (this.vignette) ctx.drawImage(this.vignette, 0, 0, W, H);
    const lowHp = this.p.hp / Math.max(1, this.maxHp);
    if (this.p.flash > 0 || lowHp < 0.3) {
      const a = Math.max(this.p.flash * 0.35, lowHp < 0.3 ? (0.3 - lowHp) * 0.5 * (0.6 + 0.4 * Math.sin(this.time * 6)) : 0);
      const g = ctx.createRadialGradient(W / 2, H / 2, 260, W / 2, H / 2, 720);
      g.addColorStop(0, "rgba(255,0,0,0)"); g.addColorStop(1, `rgba(255,30,30,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (this.p.dead) { ctx.fillStyle = `rgba(0,0,0,${clamp(1 - this.p.deadT / 1.4, 0, 0.7)})`; ctx.fillRect(0, 0, W, H); }
    if (this.banner) {
      const b = this.banner, a = clamp(Math.min(b.t, 3 - b.t + 0.6, 1), 0, 1);
      ctx.globalAlpha = a; ctx.textAlign = "center";
      ctx.font = "900 54px Georgia, serif"; ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,0.85)"; ctx.strokeText(b.text, W / 2, 150); ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, 150);
      if (b.sub) { ctx.font = "italic 24px Georgia, serif"; ctx.strokeText(b.sub, W / 2, 186); ctx.fillStyle = "#ffffff"; ctx.fillText(b.sub, W / 2, 186); }
      ctx.globalAlpha = 1;
    }
  }

  drawZones(ctx: CanvasRenderingContext2D, accent: string) {
    for (const z of this.zones) {
      ctx.save();
      if (z.kind === "bog") {
        const g = ctx.createRadialGradient(z.x, z.y, 5, z.x, z.y, z.r); g.addColorStop(0, "rgba(40,90,40,0.8)"); g.addColorStop(1, "rgba(30,60,30,0.35)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(160,230,120,0.35)"; for (let i = 0; i < 4; i++) { const a = i * 1.7 + this.time * 0.4; ctx.beginPath(); ctx.arc(z.x + Math.cos(a) * z.r * 0.5, z.y + Math.sin(a * 1.3) * z.r * 0.5, 4 + Math.sin(this.time * 2 + i) * 2, 0, 7); ctx.fill(); }
      } else if (z.kind === "ice") {
        const g = ctx.createRadialGradient(z.x, z.y, 5, z.x, z.y, z.r); g.addColorStop(0, "rgba(190,240,255,0.55)"); g.addColorStop(1, "rgba(120,200,255,0.2)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(z.x - z.r * 0.6, z.y - 10); ctx.lineTo(z.x + z.r * 0.5, z.y + 14); ctx.stroke();
      } else if (z.kind === "lava") {
        const ph = (this.roomT + z.offset) % z.period, on = ph < 1.4, warn = ph >= z.period - 1.0;
        ctx.fillStyle = on ? `rgba(255,${100 + Math.sin(this.time * 14) * 40},30,0.85)` : warn ? `rgba(255,120,40,${0.2 + 0.25 * Math.sin(this.time * 18)})` : "rgba(60,20,10,0.6)";
        ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
        ctx.strokeStyle = on ? "#ffd070" : "rgba(255,120,40,0.6)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke();
      } else if (z.kind === "spikes") {
        const on = this.spikeOn(z), ph = (this.roomT + z.offset) % z.period, warn = ph >= 1.0 && ph <= 1.7;
        ctx.fillStyle = "#1d1b26"; ctx.beginPath(); ctx.arc(z.x, z.y, 24, 0, 7); ctx.fill();
        ctx.fillStyle = on ? "#e8e8f0" : warn ? "#ff6a6a" : "#6a6a7a";
        const h = on ? 20 : warn ? 8 : 3;
        for (let i = 0; i < 5; i++) { const a = (i / 5) * 6.283; ctx.beginPath(); ctx.moveTo(z.x + Math.cos(a) * 12 - 4, z.y + Math.sin(a) * 12); ctx.lineTo(z.x + Math.cos(a) * 12, z.y + Math.sin(a) * 12 - h); ctx.lineTo(z.x + Math.cos(a) * 12 + 4, z.y + Math.sin(a) * 12); ctx.fill(); }
        ctx.beginPath(); ctx.moveTo(z.x - 4, z.y); ctx.lineTo(z.x, z.y - h); ctx.lineTo(z.x + 4, z.y); ctx.fill();
      } else if (z.kind === "void") {
        for (let i = 0; i < 4; i++) { ctx.strokeStyle = `rgba(190,120,255,${0.15 + i * 0.06})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * (1 - ((this.time * 0.5 + i * 0.25) % 1)), 0, 7); ctx.stroke(); }
        ctx.fillStyle = "#0a0414"; ctx.beginPath(); ctx.arc(z.x, z.y, 26, 0, 7); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, 26, 0, 7); ctx.stroke();
      } else if (z.kind === "fire" || z.kind === "strike") {
        const warning = z.t < z.warn, k = clamp(z.t / z.warn, 0, 1);
        if (warning) {
          ctx.fillStyle = `rgba(255,70,50,${0.12 + 0.12 * k})`; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
          ctx.strokeStyle = `rgba(255,90,60,${0.5 + 0.4 * Math.sin(this.time * 20)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.stroke();
          ctx.strokeStyle = "rgba(255,200,120,0.7)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(z.x, z.y, z.r * k, 0, 7); ctx.stroke();
        } else {
          const g = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r); g.addColorStop(0, "rgba(255,220,120,0.9)"); g.addColorStop(1, "rgba(255,80,20,0.55)");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  drawBossTelegraph(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (!e.pat || e.spawning > 0) return;
    ctx.save();
    const pulse = 0.35 + 0.25 * Math.sin(this.time * 24);
    if (e.pat === "spread" && e.patT < 0.7) {
      const a = e.pd.a ?? e.face, arc = 1.0 + e.phase * 0.15;
      ctx.fillStyle = `rgba(255,80,80,${pulse * 0.5})`; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.arc(e.x, e.y, 520, a - arc / 2, a + arc / 2); ctx.closePath(); ctx.fill();
    } else if (e.pat === "charge" && e.patT < 0.8) {
      const a = e.pd.a ?? e.face;
      ctx.strokeStyle = `rgba(255,80,80,${pulse + 0.2})`; ctx.lineWidth = e.r * 2; ctx.globalAlpha = 0.25; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(a) * 700, e.y + Math.sin(a) * 700); ctx.stroke();
    } else if (e.pat === "ring" && e.patT < 0.6) {
      ctx.strokeStyle = `rgba(255,120,120,${pulse + 0.2})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 20 + e.patT * 40, 0, 7); ctx.stroke();
    } else if (e.pat === "summon" && e.patT < 0.8) {
      ctx.strokeStyle = `rgba(200,150,255,${pulse + 0.2})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, 130, 0, 7); ctx.stroke();
    }
    ctx.restore();
  }

  drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    ctx.save();
    if (e.spawning > 0) {
      const k = 1 - e.spawning / (e.boss >= 0 ? 1.4 : 0.8);
      ctx.strokeStyle = e.color; ctx.globalAlpha = 0.4 + k * 0.4; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (2 - k), 0, 7); ctx.stroke();
      ctx.globalAlpha = k * 0.6; ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * k, 0, 7); ctx.fill();
      ctx.restore(); return;
    }
    const x = e.x, y = e.y - e.z, r = e.r;
    const squash = 1 + Math.sin(e.t * 8 + e.id) * 0.05 + (e.hurtAnim > 0 ? 0.12 : 0);
    const flash = e.flash > 0;
    const body = flash ? "#ffffff" : e.stun > 0 ? "#d8d8a0" : e.color;
    ctx.translate(x, y);
    if (e.boss >= 0) {
      const def = BOSSES[e.boss];
      if (e.inv > 0) { ctx.globalAlpha = 0.6 + 0.4 * Math.sin(this.time * 30); ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, r + 10, 0, 7); ctx.stroke(); }
      ctx.shadowColor = def.color; ctx.shadowBlur = 24;
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 4, 0, 0, r); g.addColorStop(0, flash ? "#fff" : "#ffffff55"); g.addColorStop(0.3, body); g.addColorStop(1, "#150d1a");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * squash, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = "#0a0610"; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = def.color;
      for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.36 - 7, -r * 0.85); ctx.lineTo(i * r * 0.36, -r * (1.35 - Math.abs(i) * 0.1)); ctx.lineTo(i * r * 0.36 + 7, -r * 0.85); ctx.fill(); }
      const fx = Math.cos(e.face) * 6, fy = Math.sin(e.face) * 6;
      ctx.fillStyle = e.pat ? "#ff4040" : "#ffec9a";
      ctx.beginPath(); ctx.arc(-r * 0.3 + fx, -r * 0.1 + fy, 6, 0, 7); ctx.arc(r * 0.3 + fx, -r * 0.1 + fy, 6, 0, 7); ctx.fill();
      ctx.fillStyle = "#0a0610"; ctx.beginPath(); ctx.arc(0, r * 0.35, r * 0.28, 0, Math.PI); ctx.fill();
      ctx.restore(); return;
    }
    const sq = squash;
    ctx.scale(sq, 2 - sq);
    if (e.type === "dummy") {
      ctx.fillStyle = "#6a4a2a"; ctx.fillRect(-4, 0, 8, r + 8);
      ctx.fillStyle = flash ? "#fff" : "#d8b878"; ctx.beginPath(); ctx.arc(0, -4, r, 0, 7); ctx.fill(); ctx.strokeStyle = "#5a3a1a"; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#c33"; ctx.beginPath(); ctx.arc(0, -4, r * 0.55, 0, 7); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -4, r * 0.25, 0, 7); ctx.fill();
      ctx.restore();
      this.hpBar(ctx, e); return;
    }
    if (e.elite) { ctx.shadowColor = "#ffd84a"; ctx.shadowBlur = 18; }
    switch (e.type) {
      case "grub": {
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.85, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.beginPath(); ctx.arc(-r * 0.3, r * 0.2, r * 0.3, 0, 7); ctx.arc(r * 0.4, r * 0.3, r * 0.2, 0, 7); ctx.fill();
        this.eyes(ctx, e, r); break;
      }
      case "spitter": {
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r * 1.1, r * 0.8); ctx.lineTo(-r * 1.1, r * 0.8); ctx.closePath(); ctx.fill();
        if (e.state === "wind") { ctx.fillStyle = "#e8ff7a"; ctx.beginPath(); ctx.arc(Math.cos(e.face) * r, Math.sin(e.face) * r, 4 + (1 - e.st) * 5, 0, 7); ctx.fill(); }
        this.eyes(ctx, e, r * 0.8); break;
      }
      case "charger": {
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.save(); ctx.rotate(e.face); ctx.fillStyle = "#f2e8d0"; ctx.beginPath(); ctx.moveTo(r * 0.8, -r * 0.5); ctx.lineTo(r * 1.6, -r * 0.2); ctx.lineTo(r * 0.8, -r * 0.1); ctx.moveTo(r * 0.8, r * 0.5); ctx.lineTo(r * 1.6, r * 0.2); ctx.lineTo(r * 0.8, r * 0.1); ctx.fill();
        if (e.state === "wind") { ctx.fillStyle = "rgba(255,70,70,0.25)"; ctx.fillRect(r, -r * 0.7, 460, r * 1.4); }
        ctx.restore(); this.eyes(ctx, e, r); break;
      }
      case "bomber": {
        const f = e.state === "fuse" && Math.floor(e.t * 16) % 2 === 0;
        ctx.fillStyle = f ? "#ffffff" : body; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.strokeStyle = "#ffcc66"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(3, -r - 6); ctx.stroke();
        ctx.fillStyle = "#ff3"; ctx.beginPath(); ctx.arc(3 + Math.random() * 2, -r - 7, 3, 0, 7); ctx.fill();
        if (e.state === "fuse") { ctx.strokeStyle = "rgba(255,120,60,0.6)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 95, 0, 7); ctx.stroke(); }
        this.eyes(ctx, e, r); break;
      }
      case "shaman": {
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(0, -r * 1.2); ctx.lineTo(r, r); ctx.lineTo(-r, r); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2a1a40"; ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.5, 0, 7); ctx.fill();
        ctx.fillStyle = "#e0b0ff"; ctx.beginPath(); ctx.arc(Math.cos(e.t * 2) * r * 1.2, -r * 1.3 + Math.sin(e.t * 3) * 3, 4 + (e.state === "wind" ? 4 : 0), 0, 7); ctx.fill();
        break;
      }
      case "knight": {
        ctx.fillStyle = body; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
        ctx.fillStyle = "#42536a"; ctx.beginPath(); ctx.arc(0, -r * 0.2, r * 0.7, Math.PI, 0); ctx.fill();
        ctx.save(); ctx.rotate(e.face); ctx.strokeStyle = e.stun > 0 ? "#888" : "#dde8f5"; ctx.lineWidth = 7; ctx.lineCap = "round"; ctx.beginPath(); ctx.arc(0, 0, r + 5, -0.9, 0.9); ctx.stroke();
        if (e.state === "wind") { ctx.fillStyle = "rgba(255,80,80,0.25)"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 78, -0.8, 0.8); ctx.fill(); }
        ctx.restore(); break;
      }
      default: break;
    }
    ctx.restore();
    if (e.burnT > 0) { ctx.fillStyle = "rgba(255,140,50,0.8)"; ctx.beginPath(); ctx.arc(e.x + Math.sin(this.time * 14) * 3, e.y - e.r - 4, 4, 0, 7); ctx.fill(); }
    if (e.slowT > 0) { ctx.strokeStyle = "rgba(160,230,255,0.8)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, 7); ctx.stroke(); }
    if (e.stun > 0) { ctx.fillStyle = "#ffec6a"; ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.fillText("✦", e.x + Math.cos(this.time * 8) * 10, e.y - e.r - 8); }
    this.hpBar(ctx, e);
  }

  eyes(ctx: CanvasRenderingContext2D, e: Enemy, r: number) {
    const fx = Math.cos(e.face) * r * 0.2, fy = Math.sin(e.face) * r * 0.2;
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r * 0.35 + fx, -r * 0.15 + fy, r * 0.28, 0, 7); ctx.arc(r * 0.35 + fx, -r * 0.15 + fy, r * 0.28, 0, 7); ctx.fill();
    ctx.fillStyle = "#200"; ctx.beginPath(); ctx.arc(-r * 0.35 + fx * 1.8, -r * 0.15 + fy * 1.8, r * 0.13, 0, 7); ctx.arc(r * 0.35 + fx * 1.8, -r * 0.15 + fy * 1.8, r * 0.13, 0, 7); ctx.fill();
  }

  hpBar(ctx: CanvasRenderingContext2D, e: Enemy) {
    if (e.hp >= e.maxHp * 0.999 && !e.elite) return;
    const w = e.r * 2 + 6, x = e.x - w / 2, y = e.y - e.r - 14;
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = e.elite ? "#ffd84a" : "#ff5a5a"; ctx.fillRect(x, y, w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }

  drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.p;
    if (p.dead) return;
    const flick = p.inv > 0 && Math.floor(this.time * 20) % 2 === 0 && p.dashT <= 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = flick ? 0.4 : 1;
    const hue = this.cfg.hue;
    const lean = Math.hypot(p.vx, p.vy) / 300;
    // cloak
    ctx.fillStyle = `hsl(${hue},55%,38%)`;
    const back = Math.atan2(p.vy, p.vx) + Math.PI;
    ctx.beginPath(); ctx.moveTo(Math.cos(back + 1.2) * 13, Math.sin(back + 1.2) * 13); ctx.lineTo(Math.cos(back) * (16 + lean * 14), Math.sin(back) * (16 + lean * 14)); ctx.lineTo(Math.cos(back - 1.2) * 13, Math.sin(back - 1.2) * 13); ctx.closePath(); ctx.fill();
    // body
    const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, 15); g.addColorStop(0, `hsl(${hue},70%,72%)`); g.addColorStop(1, `hsl(${hue},55%,40%)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill();
    ctx.strokeStyle = "#0a0610"; ctx.lineWidth = 2.5; ctx.stroke();
    // head/hair + eyes
    const fx = Math.cos(p.face), fy = Math.sin(p.face);
    ctx.fillStyle = "#fbe7d0"; ctx.beginPath(); ctx.arc(fx * 3, fy * 3 - 2, 8, 0, 7); ctx.fill();
    ctx.fillStyle = `hsl(${(hue + 160) % 360},45%,30%)`; ctx.beginPath(); ctx.arc(fx * 2, fy * 2 - 4, 8, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(fx * 6 - 3, fy * 6 - 2, 1.6, 0, 7); ctx.arc(fx * 6 + 3, fy * 6 - 2, 1.6, 0, 7); ctx.fill();
    // weapon
    const w = WEAPONS[this.cfg.weapon];
    const sw = p.atkAnim > 0 ? 1 - p.atkAnim / 0.18 : 0;
    const wa = w.type === "melee" ? p.face + (p.atkAnim > 0 ? (sw - 0.5) * w.arc : -0.6) : p.face;
    ctx.rotate(wa);
    if (w.type === "ranged") {
      ctx.strokeStyle = "#caa46a"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(14, 0, 14, -1.1, 1.1); ctx.stroke();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(14 + Math.cos(-1.1) * 14, Math.sin(-1.1) * 14); ctx.lineTo(8, 0); ctx.lineTo(14 + Math.cos(1.1) * 14, Math.sin(1.1) * 14); ctx.stroke();
    } else {
      const len = (this.cfg.weapon === "spear" ? 62 : this.cfg.weapon === "hammer" ? 34 : 34) * Math.min(1.4, this.mods.reach);
      ctx.strokeStyle = this.cfg.weapon === "hammer" ? "#8a5a30" : "#dfe8f5"; ctx.lineWidth = this.cfg.weapon === "spear" ? 3 : 5; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(10 + len, 0); ctx.stroke();
      if (this.cfg.weapon === "hammer") { ctx.fillStyle = "#9a9aa8"; ctx.fillRect(10 + len - 6, -11, 16, 22); }
      if (this.cfg.weapon === "spear") { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(10 + len, -5); ctx.lineTo(10 + len + 14, 0); ctx.lineTo(10 + len, 5); ctx.fill(); }
      if (this.cfg.weapon === "blade") { ctx.strokeStyle = "#a07030"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(12, -6); ctx.lineTo(12, 6); ctx.stroke(); }
    }
    ctx.restore();
    // special ready glow
    if (p.special >= 100) { ctx.save(); ctx.strokeStyle = `rgba(255,207,90,${0.4 + 0.3 * Math.sin(this.time * 8)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 22 + Math.sin(this.time * 8) * 2, 0, 7); ctx.stroke(); ctx.restore(); }
  }
}
