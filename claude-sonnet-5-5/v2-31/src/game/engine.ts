import {
  COLS, ROWS, T, W, H, MAX_WAVES, SPELLS, ENEMIES, BOSS_CYCLE, WARD_WEAK, WARD_LIST, DIFFICULTIES, MUTATORS,
  RELICS, ELEMENT_COLOR, buildMods,
  type EnemyDef, type Element, type Mods, type SpellId,
} from "./data";
import type { AudioEngine } from "./audio";
import type { Settings } from "./save";
import { renderGame, makeTerrain } from "./render";

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export type Phase = "prep" | "wave" | "relic" | "gameover" | "victory";

export interface Enemy {
  id: number; type: string; def: EnemyDef; x: number; y: number; hp: number; maxHp: number;
  kx: number; ky: number; kgale: boolean;
  wet: number; chill: number; frozen: number; burn: number; burnDps: number; shock: number; stun: number; rime: number;
  atk: number; flash: number; anim: number; speedMul: number; aura: boolean; face: number;
  t1: number; ward: string; phase: number; enraged: boolean; reactCd: number; fireT: number;
  ox: number; oy: number; boss: boolean; flying: boolean; dead: boolean; hpMul: number; sfxT: number;
}
export interface Zone { kind: "rain" | "blizzard" | "fire"; x: number; y: number; r: number; t: number; dur: number; tick: number; strike: number; mult: number }
export interface Pending { x: number; y: number; r: number; t: number; delay: number; mult: number }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; kind: number }
export interface FloatText { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
export interface Bolt { pts: number[][]; life: number; max: number; color: string; width: number }
export interface Proj { x: number; y: number; sx: number; sy: number; tx: number; ty: number; t: number; dur: number; idx: number; dmg: number }

export interface Stats {
  kills: number; damage: number; wavesCleared: number; wallsBuilt: number; wallsLost: number; spells: number;
  breaches: number; bossKills: number; reactions: Record<string, number>; peakHarmony: number; tempests: number; time: number;
}

export interface ResultInfo {
  kind: "gameover" | "victory"; aether: number; stats: Stats; wave: number; difficulty: string; mutators: string[];
  relics: string[]; newBest: boolean; score: number;
}

export interface EndReport { kind: string; aetherDelta: number; wave: number; killsDelta: number; bossDelta: number; won: boolean; difficulty: string }

export interface Snap {
  phase: Phase; paused: boolean; wave: number; maxWave: number; endless: boolean; weather: string; nextWeather: string;
  gate: number; gateMax: number; mana: number; manaMax: number; stone: number; stoneCap: number; tempest: number; tempestT: number;
  tool: string; cd: Record<string, number>; unlocked: string[]; cost: Record<string, number>; harmony: number; harmonyCap: number;
  score: number; kills: number; prepT: number; left: number; speed: number; relics: string[]; draft: string[];
  boss: null | { name: string; hp: number; ward: string; icon: string; weak: string };
  forecast: Record<string, number>; nextBoss: string; tutorial: boolean; tutStep: number; tutTitle: string; tutText: string; tutDone: boolean;
  tutTotal: number; result: ResultInfo | null; wallCost: number; canCallEarly: boolean;
}

export interface GameOpts {
  difficulty: string; mutators: string[]; research: Record<string, number>; tutorial: boolean;
}
export interface Callbacks {
  ui: (s: Snap) => void;
  onEnd: (r: EndReport) => void;
}

interface WavePlan { n: number; weather: string; entries: { t: number; type: string }[]; counts: Record<string, number>; boss: string }

const TUT = [
  { title: "Shape the Pass", text: "Press Q (or tap 🧱), then click or drag across the road to raise stone walls. Enemies path around walls, or hack through them if the detour is too long. Raise 3 walls." },
  { title: "Soak Them", text: "Footmen are marching in! Choose Rainstorm (key 2) and click on them. Wet enemies are slowed and vulnerable to the elements." },
  { title: "Conduct!", text: "Now choose Chain Lightning (key 1) and strike a SOAKED enemy. Wet targets Conduct: more damage, a longer chain, and a stun." },
  { title: "Flash Freeze", text: "Cast Rainstorm (2) again, then Blizzard (3) on the wet enemies. Chilling something wet flash-freezes it solid." },
  { title: "Shatter", text: "Frozen enemies are brittle. Cast Rockfall (6) on a frozen enemy to Shatter it. Rockfall lands after a short delay, so aim ahead of slowed targets." },
  { title: "Tempest Call", text: "Reactions fill your Tempest meter. It's full now! Press R to unleash a storm that soaks, freezes and strikes everything." },
  { title: "Training Complete", text: "You've mastered the basics. Also try Firestorm (4) and Gale Burst (5) here, then take on the real pass. Right-click removes walls, Space calls waves early." },
];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  audio: AudioEngine;
  opts: GameOpts;
  getSettings: () => Settings;
  cb: Callbacks;
  mods: Mods;
  diff = DIFFICULTIES[1];
  mutSet: Set<string>;

  terrain = new Uint8Array(COLS * ROWS);
  wallHp = new Float32Array(COLS * ROWS);
  wallMax = new Float32Array(COLS * ROWS);
  wallFlash = new Float32Array(COLS * ROWS);
  field = new Float32Array(COLS * ROWS);
  inq = new Uint8Array(COLS * ROWS);
  fieldDirty = true;
  terrainCanvas: HTMLCanvasElement | null = null;
  gateTop = 0; gateBot = ROWS - 1; gateY = H / 2;
  spawnRows: number[] = [];

  enemies: Enemy[] = [];
  zones: Zone[] = [];
  pend: Pending[] = [];
  parts: Particle[] = [];
  texts: FloatText[] = [];
  bolts: Bolt[] = [];
  projs: Proj[] = [];
  later: { t: number; fn: () => void }[] = [];
  cells: Enemy[][] = [];
  cw = Math.ceil(W / 32);
  ch = Math.ceil(H / 32);

  phase: Phase = "prep";
  wave = 0;
  endless = false;
  won = false;
  weather = "clear";
  plan: WavePlan;
  queue: { t: number; type: string }[] = [];
  waveT = 0;
  prepT = 30;
  eid = 1;

  mana = 100; stone = 30; gateHp = 30; gateMax = 30;
  tempest = 0; tempestT = 0; tempestTick = 0; tempestFreeze = 0;
  relics: string[] = [];
  draft: string[] = [];
  relicFrom = "wave";
  harmony = 0; harmonyT = 0; lastEl = "";
  cd: Record<string, number> = {};
  tool = "wall";
  score = 0;
  speed = 1;
  paused = false;
  stats: Stats = { kills: 0, damage: 0, wavesCleared: 0, wallsBuilt: 0, wallsLost: 0, spells: 0, breaches: 0, bossKills: 0, reactions: {}, peakHarmony: 0, tempests: 0, time: 0 };
  result: ResultInfo | null = null;
  awarded = 0;
  reportedKills = 0;
  reportedBoss = 0;
  ended = false;

  mx = 0; my = 0; mouseIn = false; painting = "";
  shakeAmt = 0; flash = 0; gateShake = 0; time = 0;
  banner: { text: string; sub: string; t: number; color: string } | null = null;
  wp: { x: number; y: number; s: number; v: number }[] = [];
  weatherTick = 0; wallTick = 0; wallTick2 = 0;
  view = { scale: 1, ox: 0, oy: 0, dpr: 1, w: 800, h: 450 };
  lastT = 0; lastUi = 0; raf = 0; destroyed = false;
  errT = 0; stoneFrac = 0;

  tut: { step: number; walls: number; flags: Record<string, boolean>; done: boolean; spawnT: number; reported: boolean };

  constructor(canvas: HTMLCanvasElement, audio: AudioEngine, opts: GameOpts, getSettings: () => Settings, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.audio = audio;
    this.opts = opts;
    this.getSettings = getSettings;
    this.cb = cb;
    this.diff = DIFFICULTIES.find((d) => d.id === opts.difficulty) || DIFFICULTIES[1];
    this.mutSet = new Set(opts.mutators);
    this.mods = buildMods(opts.research, [], opts.tutorial);
    if (opts.tutorial) this.mods.frozenDur += 2.2;
    this.tut = { step: 0, walls: 0, flags: {}, done: false, spawnT: 0, reported: false };
    this.cells = Array.from({ length: this.cw * this.ch }, () => []);
    this.genMap();
    this.terrainCanvas = makeTerrain(this);
    this.gateMax = opts.tutorial ? 99 : this.diff.gate + this.mods.gateHp;
    this.gateHp = this.gateMax;
    this.mana = this.mods.maxMana;
    this.stone = Math.min(this.mods.stoneCap, 36);
    this.prepT = 30;
    this.weather = "clear";
    this.plan = this.buildWave(1);
    if (opts.tutorial) {
      this.phase = "wave";
      this.plan = { n: 1, weather: "clear", entries: [], counts: {}, boss: "" };
      this.banner = { text: "Training Grounds", sub: "Follow the prompts", t: 3, color: "#9fd0ff" };
    } else if (this.mods.startRelic) {
      this.openDraft("start");
    } else {
      this.banner = { text: "Prepare the Pass", sub: "Raise walls, then call the first wave", t: 3.5, color: "#9fd0ff" };
    }
    this.computeField();
    for (let i = 0; i < 150; i++) this.wp.push({ x: Math.random() * W, y: Math.random() * H, s: Math.random(), v: Math.random() });
    this.audio.setMode(opts.tutorial ? "prep" : "prep");
  }

  start() {
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.audio.setMode("off");
  }

  /* ============ map generation ============ */
  private hash(i: number) {
    const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  private genMap() {
    const p1 = Math.random() * 6.28, p2 = Math.random() * 6.28, p3 = Math.random() * 6.28;
    for (let c = 0; c < COLS; c++) {
      const edge = Math.min(c, COLS - 1 - c);
      const ease = Math.min(1, edge / 6);
      const center = ROWS / 2 + ease * (Math.sin(c * 0.19 + p1) * 3.2 + Math.sin(c * 0.071 + p2) * 2.2);
      const half = 4.7 + ease * Math.sin(c * 0.23 + p3) * 1.0;
      for (let r = 0; r < ROWS; r++) {
        const d = Math.abs(r + 0.5 - center);
        const jag = this.hash(c * 31 + r * 17) * 0.8;
        this.terrain[r * COLS + c] = d > half - jag * 0.6 ? 1 : 0;
      }
    }
    for (let k = 0; k < 9; k++) {
      const c = 7 + Math.floor(Math.random() * (COLS - 15));
      const r = 3 + Math.floor(Math.random() * (ROWS - 6));
      const cells = [[c, r]];
      if (Math.random() < 0.55) cells.push([c + 1, r]);
      if (Math.random() < 0.3) cells.push([c, r + 1]);
      const prev = cells.map(([cc, rr]) => this.terrain[rr * COLS + cc]);
      cells.forEach(([cc, rr]) => (this.terrain[rr * COLS + cc] = 1));
      if (!this.connected()) cells.forEach(([cc, rr], i) => (this.terrain[rr * COLS + cc] = prev[i]));
    }
    // guarantee open gate and spawn
    this.spawnRows = [];
    let top = ROWS, bot = 0;
    for (let r = 0; r < ROWS; r++) {
      if (!this.terrain[r * COLS]) this.spawnRows.push(r);
      if (!this.terrain[r * COLS + COLS - 1]) {
        top = Math.min(top, r);
        bot = Math.max(bot, r);
      }
    }
    if (!this.spawnRows.length) {
      for (let r = 8; r < 14; r++) for (let c = 0; c < 4; c++) this.terrain[r * COLS + c] = 0;
      this.spawnRows = [8, 9, 10, 11, 12, 13];
    }
    if (top > bot) {
      for (let r = 8; r < 14; r++) for (let c = COLS - 4; c < COLS; c++) this.terrain[r * COLS + c] = 0;
      top = 8; bot = 13;
    }
    this.gateTop = top;
    this.gateBot = bot;
    this.gateY = ((top + bot + 1) / 2) * T;
    if (!this.connected()) {
      for (let r = 9; r < 13; r++) for (let c = 0; c < COLS; c++) this.terrain[r * COLS + c] = 0;
    }
  }

  private connected() {
    const seen = new Uint8Array(COLS * ROWS);
    const q: number[] = [];
    for (let r = 0; r < ROWS; r++) if (!this.terrain[r * COLS]) { q.push(r * COLS); seen[r * COLS] = 1; }
    let h = 0;
    while (h < q.length) {
      const u = q[h++];
      const c = u % COLS, r = (u / COLS) | 0;
      if (c === COLS - 1) return true;
      for (let k = 0; k < 4; k++) {
        const nc = c + DIRS[k][0], nr = r + DIRS[k][1];
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const i = nr * COLS + nc;
        if (seen[i] || this.terrain[i]) continue;
        seen[i] = 1;
        q.push(i);
      }
    }
    return false;
  }

  /* ============ flow field ============ */
  private tileCost(i: number) {
    return 1 + (this.wallHp[i] > 0 ? 7 + this.wallHp[i] / 22 : 0);
  }
  private blockedTile(c: number, r: number) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
    const i = r * COLS + c;
    return this.terrain[i] === 1 || this.wallHp[i] > 0;
  }
  private computeField() {
    this.fieldDirty = false;
    const f = this.field;
    f.fill(Infinity);
    this.inq.fill(0);
    const q: number[] = [];
    for (let r = 0; r < ROWS; r++) {
      const i = r * COLS + COLS - 1;
      if (!this.terrain[i]) { f[i] = 0; q.push(i); this.inq[i] = 1; }
    }
    let h = 0;
    while (h < q.length) {
      const u = q[h++];
      this.inq[u] = 0;
      const uc = u % COLS, ur = (u / COLS) | 0;
      const cu = this.tileCost(u);
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1];
        const vc = uc + dx, vr = ur + dy;
        if (vc < 0 || vr < 0 || vc >= COLS || vr >= ROWS) continue;
        const v = vr * COLS + vc;
        if (this.terrain[v]) continue;
        if (dx && dy && (this.blockedTile(uc, vr) || this.blockedTile(vc, ur))) continue;
        const nd = f[u] + cu * (dx && dy ? 1.41 : 1);
        if (nd < f[v] - 1e-4) {
          f[v] = nd;
          if (!this.inq[v]) { this.inq[v] = 1; q.push(v); }
        }
      }
      if (q.length > 40000) break;
    }
  }
  nextTile(c: number, r: number): number {
    const f = this.field;
    let best = -1, bv = Infinity;
    for (let k = 0; k < 8; k++) {
      const dx = DIRS[k][0], dy = DIRS[k][1];
      const nc = c + dx, nr = r + dy;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const i = nr * COLS + nc;
      if (this.terrain[i]) continue;
      if (dx && dy && (this.blockedTile(c + dx, r) || this.blockedTile(c, r + dy))) continue;
      const v = f[i] + this.tileCost(i) * (dx && dy ? 1.41 : 1);
      if (v < bv) { bv = v; best = i; }
    }
    return best;
  }
  private firstWall(c: number, r: number, steps: number): number {
    let cc = c, rr = r;
    for (let s = 0; s < steps; s++) {
      const n = this.nextTile(cc, rr);
      if (n < 0) return -1;
      if (this.wallHp[n] > 0) return n;
      cc = n % COLS;
      rr = (n / COLS) | 0;
    }
    return -1;
  }

  /* ============ helpers ============ */
  canStand(x: number, y: number, flying: boolean) {
    if (y < 1 || y >= H - 1) return false;
    if (flying) return true;
    if (x < -90) return false;
    if (x < 0) return true;
    if (x >= W) return false;
    const i = ((y / T) | 0) * COLS + ((x / T) | 0);
    return this.terrain[i] === 0 && this.wallHp[i] <= 0;
  }
  buildable(c: number, r: number) {
    if (c < 2 || c >= COLS - 2 || r < 0 || r >= ROWS) return false;
    return this.terrain[r * COLS + c] === 0;
  }
  wallCost() {
    return this.weather === "snow" ? Math.max(1, this.mods.wallCost - 1) : this.mods.wallCost;
  }
  wmul(el: string) {
    const w = this.weather;
    if (w === "rain") return el === "storm" ? 1.25 : el === "fire" ? 0.7 : 1;
    if (w === "snow") return el === "frost" ? 1.25 : el === "fire" ? 0.9 : 1;
    if (w === "ember") return el === "fire" ? 1.3 : 1;
    if (w === "gale") return el === "wind" ? 1.5 : 1;
    return 1;
  }
  shake(a: number) { this.shakeAmt = Math.min(24, Math.max(this.shakeAmt, a)); }
  burst(x: number, y: number, n: number, color: string, speed: number, life: number, size: number, grav = 0) {
    for (let i = 0; i < n && this.parts.length < 1400; i++) {
      const a = Math.random() * 6.283, s = rnd(0.2, 1) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.6, 1) * life, max: life, size: rnd(0.6, 1) * size, color, grav, kind: 0 });
    }
  }
  ring(x: number, y: number, r: number, color: string, life = 0.5) {
    if (this.parts.length < 1400) this.parts.push({ x, y, vx: 0, vy: 0, life, max: life, size: r, color, grav: 0, kind: 1 });
  }
  floater(x: number, y: number, text: string, color: string, size = 13, life = 0.9) {
    if (this.texts.length > 90) this.texts.shift();
    this.texts.push({ x: x + rnd(-6, 6), y, text, color, life, max: life, size });
  }
  bolt(x1: number, y1: number, x2: number, y2: number, color = "#fff6a8", width = 3) {
    const pts: number[][] = [[x1, y1]];
    const n = Math.max(3, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 22));
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push([x1 + (x2 - x1) * t + rnd(-12, 12), y1 + (y2 - y1) * t + rnd(-12, 12)]);
    }
    pts.push([x2, y2]);
    this.bolts.push({ pts, life: 0.22, max: 0.22, color, width });
    if (this.bolts.length > 60) this.bolts.shift();
  }

  /* ============ waves ============ */
  private pickWeather(n: number) {
    if (n === 1) return "clear";
    const keys = Object.keys({ clear: 1, rain: 1, snow: 1, ember: 1, gale: 1 });
    const pool = keys.filter((k) => k !== this.plan?.weather && k !== this.weather);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  buildWave(n: number): WavePlan {
    const horde = this.mutSet.has("horde") ? 1.5 : 1;
    let budget = (60 + 20 * n + n * n) * this.diff.count * horde;
    const isBoss = n % 5 === 0;
    const boss = isBoss ? BOSS_CYCLE[(n / 5 - 1) % 3] : "";
    if (isBoss) budget *= 0.5;
    const weights: Record<string, number> = {
      footman: Math.max(1, 3 - n * 0.12), scout: 2, sapper: 1.4, ironclad: 1.3, wyvern: 1.2, pyromancer: 1, warcaller: 0.5, ogre: 0.8,
    };
    const pool = Object.keys(weights).filter((k) => ENEMIES[k].minWave <= n);
    const types: string[] = [];
    const counts: Record<string, number> = {};
    let guard = 0;
    while (budget >= 8 && types.length < 240 && guard++ < 600) {
      const avail = pool.filter((k) => ENEMIES[k].cost <= budget && (k !== "warcaller" || (counts[k] || 0) < 1 + Math.floor(n / 4)));
      if (!avail.length) break;
      let tot = 0;
      avail.forEach((k) => (tot += weights[k]));
      let rr = Math.random() * tot, pick = avail[0];
      for (const k of avail) { rr -= weights[k]; if (rr <= 0) { pick = k; break; } }
      types.push(pick);
      counts[pick] = (counts[pick] || 0) + 1;
      budget -= ENEMIES[pick].cost;
    }
    const duration = 24 + Math.min(n, 15) * 1.6;
    const entries: { t: number; type: string }[] = [];
    types.forEach((type, i) => entries.push({ t: (i / Math.max(1, types.length)) * duration + rnd(0, 1.2), type }));
    if (boss) {
      entries.push({ t: 4, type: boss });
      counts[boss] = 1;
    }
    entries.sort((a, b) => a.t - b.t);
    return { n, weather: this.pickWeather(n), entries, counts, boss };
  }

  callWave() {
    if (this.phase !== "prep" || this.paused) return;
    if (this.prepT > 4) {
      const bonus = Math.floor(this.prepT * 3);
      this.score += bonus;
      this.mana = Math.min(this.mods.maxMana, this.mana + 20);
      this.floater(W / 2, 90, `Early call +${bonus}`, "#ffe29a", 16, 1.4);
    }
    this.startWave();
  }

  private startWave() {
    this.wave = this.plan.n;
    this.weather = this.plan.weather;
    this.queue = this.plan.entries.map((e) => ({ ...e }));
    this.waveT = 0;
    this.phase = "wave";
    const boss = this.plan.boss;
    this.banner = boss
      ? { text: ENEMIES[boss].name, sub: `Wave ${this.wave} — BOSS`, t: 3.2, color: "#ff8a8a" }
      : { text: `Wave ${this.wave}`, sub: `${this.weatherName(this.weather)}`, t: 2.6, color: "#bcd8ff" };
    this.audio.sfx(boss ? "boss" : "horn");
    this.audio.setMode(boss ? "boss" : "battle");
    this.shake(boss ? 7 : 3);
    this.plan = this.buildWave(this.wave + 1);
  }

  private weatherName(w: string) {
    const names: Record<string, string> = { clear: "Clear Night", rain: "Thunderstorm", snow: "Snowfall", ember: "Ashfall", gale: "Howling Gale" };
    return names[w] || w;
  }

  private spawnEnemy(type: string, x?: number, y?: number, opts?: { hpMul?: number; spd?: number }) {
    const def = ENEMIES[type];
    if (!def) return null;
    const wave = this.wave;
    let hpScale = this.diff.hp * (this.mutSet.has("ironhide") ? 1.4 : 1);
    hpScale *= def.boss ? 1 + 0.14 * Math.max(0, wave - 15) : 1 + 0.06 * Math.max(0, wave - 1);
    hpScale *= opts?.hpMul || 1;
    const row = this.spawnRows[Math.floor(Math.random() * this.spawnRows.length)] ?? 10;
    const e: Enemy = {
      id: this.eid++, type, def,
      x: x ?? -T * 0.6 - rnd(0, T * 1.2), y: y ?? (row + 0.5) * T + rnd(-6, 6),
      hp: def.hp * hpScale, maxHp: def.hp * hpScale, kx: 0, ky: 0, kgale: false,
      wet: 0, chill: 0, frozen: 0, burn: 0, burnDps: 0, shock: 0, stun: 0, rime: 0,
      atk: 0, flash: 0, anim: Math.random() * 6, speedMul: (this.mutSet.has("frenzy") ? 1.25 : 1) * (1 + 0.004 * wave) * (opts?.spd || 1), aura: false, face: 0,
      t1: def.boss ? 4 : 0, ward: WARD_LIST[Math.floor(Math.random() * 4)], phase: 0, enraged: false, reactCd: 0, fireT: 0,
      ox: def.boss ? 0 : rnd(-0.28, 0.28) * T, oy: def.boss ? 0 : rnd(-0.28, 0.28) * T,
      boss: !!def.boss, flying: !!def.flying, dead: false, hpMul: 1, sfxT: 0,
    };
    if (e.flying && this.weather === "gale") e.speedMul *= 1.25;
    if (e.flying && x === undefined) e.y = rnd(40, H - 40);
    this.enemies.push(e);
    return e;
  }

  /* ============ walls ============ */
  wallMaxHp() {
    return 120 * this.mods.wallHp * (this.mutSet.has("brittle") ? 0.6 : 1);
  }

  buildAt(wx: number, wy: number) {
    const c = Math.floor(wx / T), r = Math.floor(wy / T);
    if (!this.buildable(c, r)) return;
    const i = r * COLS + c;
    const maxHp = this.wallMaxHp();
    if (this.wallHp[i] > 0) {
      // reinforce
      if (this.wallHp[i] < maxHp * 0.98 && this.stone >= 1) {
        this.stone -= 1;
        this.wallHp[i] = Math.min(maxHp, this.wallHp[i] + maxHp * 0.6);
        this.wallMax[i] = maxHp;
        this.wallFlash[i] = 0.5;
        this.burst((c + 0.5) * T, (r + 0.5) * T, 5, "#cfd6e6", 40, 0.4, 2);
        this.audio.sfx("wall", 1.4);
      }
      return;
    }
    const cost = this.wallCost();
    if (this.stone < cost) {
      if (this.errT <= 0) { this.errT = 0.5; this.floater(wx, wy - 10, "Need stone!", "#ff9a8a", 12); this.audio.sfx("error"); }
      return;
    }
    const px = (c + 0.5) * T, py = (r + 0.5) * T;
    for (const e of this.enemies) {
      if (!e.flying && !e.dead && Math.abs(e.x - px) < T * 0.75 && Math.abs(e.y - py) < T * 0.75) {
        if (this.errT <= 0) { this.errT = 0.5; this.floater(px, py - 10, "Blocked!", "#ff9a8a", 12); this.audio.sfx("error"); }
        return;
      }
    }
    this.stone -= cost;
    this.wallHp[i] = maxHp;
    this.wallMax[i] = maxHp;
    this.wallFlash[i] = 0.6;
    this.fieldDirty = true;
    this.stats.wallsBuilt++;
    this.tut.walls++;
    this.burst(px, py, 8, "#cfd6e6", 55, 0.45, 2.4, 60);
    this.audio.sfx("wall");
  }

  digAt(wx: number, wy: number) {
    const c = Math.floor(wx / T), r = Math.floor(wy / T);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
    const i = r * COLS + c;
    if (this.wallHp[i] <= 0) return;
    const frac = this.wallHp[i] / Math.max(1, this.wallMax[i]);
    const refund = Math.ceil(this.wallCost() * 0.5 * frac);
    this.stone = Math.min(this.mods.stoneCap, this.stone + refund);
    this.wallHp[i] = 0;
    this.fieldDirty = true;
    this.burst((c + 0.5) * T, (r + 0.5) * T, 7, "#b9a98a", 50, 0.4, 2.2, 60);
    this.audio.sfx("dig");
  }

  private hitWall(i: number, dmg: number) {
    if (this.wallHp[i] <= 0) return;
    this.wallHp[i] -= dmg;
    this.wallFlash[i] = 0.25;
    if (this.wallHp[i] <= 0) this.destroyWall(i);
  }
  private destroyWall(i: number) {
    this.wallHp[i] = 0;
    this.fieldDirty = true;
    this.stats.wallsLost++;
    const c = i % COLS, r = (i / COLS) | 0;
    this.burst((c + 0.5) * T, (r + 0.5) * T, 14, "#a8a090", 90, 0.7, 3, 120);
    this.audio.sfx("wallbreak");
    this.shake(2.5);
  }

  /* ============ statuses & reactions ============ */
  react(name: string, e: Enemy, gain: number, color: string, sfx = "reaction") {
    this.stats.reactions[name] = (this.stats.reactions[name] || 0) + 1;
    if (this.tempestT <= 0) this.tempest = Math.min(100, this.tempest + gain * this.mods.tempestGain);
    if (e.reactCd <= 0) {
      e.reactCd = 0.55;
      this.floater(e.x, e.y - e.def.r - 12, name + "!", color, 14, 1.1);
      this.audio.sfx(sfx);
    }
    if (name === "Conduct") this.tut.flags.conduct = true;
    if (name === "Flash Freeze") this.tut.flags.freeze = true;
    if (name === "Shatter") this.tut.flags.shatter = true;
  }

  applyWet(e: Enemy, t: number) {
    if (e.dead) return;
    if (e.burn > 0) {
      e.burn = 0;
      this.react("Steam", e, 2, "#d8e8f0", "steam");
      this.damage(e, 14, "water", false);
      this.burst(e.x, e.y, 6, "#e8f2f8", 40, 0.7, 3.5, -30);
    }
    e.wet = Math.max(e.wet, t);
  }
  applyChill(e: Enemy, t: number) {
    if (e.dead || e.def.immune?.includes("chill")) return;
    if (e.wet > 0) {
      const dur = this.mods.frozenDur * e.def.frz;
      e.frozen = Math.max(e.frozen, dur);
      e.wet = 0;
      e.chill = 0;
      this.react("Flash Freeze", e, 4, "#bff4ff", "freeze");
      this.burst(e.x, e.y, 12, "#d8fbff", 80, 0.6, 3);
      this.ring(e.x, e.y, 24, "#bff4ff", 0.4);
      return;
    }
    e.chill = Math.max(e.chill, t);
  }
  applyBurn(e: Enemy, t: number, dps: number) {
    if (e.dead || e.def.immune?.includes("burn")) return;
    if (e.wet > 0) {
      e.wet = 0;
      this.react("Steam", e, 2, "#d8e8f0", "steam");
      this.damage(e, 14, "water", false);
      this.burst(e.x, e.y, 6, "#e8f2f8", 40, 0.7, 3.5, -30);
      return;
    }
    if (e.frozen > 0) {
      e.frozen = 0;
      this.react("Meltdown", e, 5, "#ffb070", "reaction");
      this.damage(e, 38 * this.mods.burnMult, "fire", true);
      this.burst(e.x, e.y, 14, "#ffb070", 90, 0.6, 3);
    }
    if (this.weather === "rain") t *= 0.5;
    e.burn = Math.max(e.burn, t);
    e.burnDps = Math.max(e.burnDps, dps);
  }

  damage(e: Enemy, amt: number, el: Element, show = true) {
    if (e.dead || amt <= 0) return 0;
    let m = e.def.res[el] ?? 1;
    if (e.boss) {
      if (e.type === "colossus" && e.frozen <= 0 && el !== "phys") m *= 0.5;
      if (e.type === "tyrant") {
        if (e.ward === el) m *= 0.25;
        else if (WARD_WEAK[e.ward] === el) m *= 1.7;
      }
    }
    if (e.wet > 0 && el !== "water") m *= this.mods.wetVuln;
    const dmg = amt * m;
    e.hp -= dmg;
    e.flash = 1;
    this.stats.damage += dmg;
    if (show && this.getSettings().dmgNumbers) {
      const crit = m >= 1.4;
      this.floater(e.x, e.y - e.def.r - 4, String(Math.round(dmg)), crit ? "#ffd36b" : ELEMENT_COLOR[el] || "#fff", crit ? 15 : 12, 0.8);
    }
    if (e.sfxT <= 0) { e.sfxT = 0.12; this.audio.sfx("hit", 1 + (e.boss ? -0.4 : rnd(-0.1, 0.2))); }
    if (e.hp <= 0) this.kill(e);
    return dmg;
  }

  private kill(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.stats.kills++;
    this.score += Math.round(e.def.cost * 5 + (e.boss ? 1500 : 0));
    this.stoneFrac += this.mods.stoneKill * (e.boss ? 12 : 1);
    if (this.stoneFrac >= 1) {
      const add = Math.floor(this.stoneFrac);
      this.stoneFrac -= add;
      this.stone = Math.min(this.mods.stoneCap, this.stone + add);
    }
    this.mana = Math.min(this.mods.maxMana, this.mana + (e.boss ? 40 : 1.4));
    if (this.tempestT <= 0) this.tempest = Math.min(100, this.tempest + (e.boss ? 25 : 0.7) * this.mods.tempestGain);
    this.burst(e.x, e.y, e.boss ? 60 : 12, e.def.color, e.boss ? 220 : 90, e.boss ? 1.2 : 0.6, e.boss ? 5 : 3, 60);
    this.audio.sfx("kill", e.boss ? 0.5 : rnd(0.8, 1.3));
    if (e.type === "sapper" && e.burn > 0) {
      this.ring(e.x, e.y, T * 1.8, "#ff9a4a", 0.4);
      this.audio.sfx("boom");
      this.floater(e.x, e.y - 16, "Boom!", "#ffb070", 14, 1);
      for (const o of this.enemies) {
        if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < T * 1.8) this.damage(o, 45, "fire", true);
      }
    }
    if (e.burn > 0 && this.mods.wildfire) {
      for (const o of this.enemies) {
        if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.y - e.y) < T * 2.2) this.applyBurn(o, 3, Math.max(8, e.burnDps));
      }
      this.ring(e.x, e.y, T * 2.2, "#ff7a2e", 0.4);
    }
    if (e.boss) {
      this.stats.bossKills++;
      this.shake(18);
      this.flash = 0.8;
      this.audio.sfx("boom");
      this.banner = { text: `${e.def.name} falls!`, sub: "The pass trembles", t: 3, color: "#ffe29a" };
    }
  }

  /* ============ spells ============ */
  spellRadius(id: string) {
    const m = this.mods;
    switch (id) {
      case "lightning": return T * 1.5;
      case "rain": return T * 3.5;
      case "blizzard": return T * 3.1 * m.blizzardR;
      case "firestorm": return T * 3;
      case "gale": return T * 4;
      case "rockfall": return T * 2.1 * m.rockR;
      default: return 0;
    }
  }
  spellCost(id: string) {
    const d = SPELLS.find((s) => s.id === id);
    if (!d) return 0;
    return this.opts.tutorial ? 0 : Math.round(d.cost * this.mods.costMult);
  }

  selectTool(t: string) {
    if (SPELLS.some((s) => s.id === t) && !this.mods.unlocked.includes(t)) {
      this.floater(W / 2, H - 60, "Locked — research it in the Sanctum", "#ffb0b0", 14, 1.4);
      this.audio.sfx("error");
      return;
    }
    this.tool = t;
    this.audio.sfx("click");
  }

  cast(id: SpellId, x: number, y: number) {
    const def = SPELLS.find((s) => s.id === id);
    if (!def || !this.mods.unlocked.includes(id)) return;
    if ((this.cd[id] || 0) > 0) return;
    const cost = this.spellCost(id);
    if (this.mana < cost) {
      if (this.errT <= 0) { this.errT = 0.5; this.floater(x, y - 14, "Not enough mana", "#9ab8ff", 13); this.audio.sfx("error"); }
      return;
    }
    this.mana -= cost;
    this.cd[id] = def.cd * this.mods.cdMult;
    this.stats.spells++;
    // harmony
    if (this.lastEl && this.lastEl !== def.element) {
      this.harmony = Math.min(this.mods.harmonyCap, this.harmony + 1);
      this.stats.peakHarmony = Math.max(this.stats.peakHarmony, this.harmony);
      if (this.harmony >= 2) this.floater(x, y - 30, `Harmony x${this.harmony}`, "#d9b8ff", 12, 0.9);
    } else if (this.lastEl === def.element) {
      this.harmony = 0;
    }
    this.lastEl = def.element;
    this.harmonyT = 7;
    const mult = 1 + this.harmony * this.mods.harmonyBonus;
    if (this.tempestT <= 0) this.tempest = Math.min(100, this.tempest + 1.2 * this.mods.tempestGain);
    switch (id) {
      case "lightning": this.castLightning(x, y, mult, false); break;
      case "rain":
        this.zones.push({ kind: "rain", x, y, r: this.spellRadius("rain"), t: 0, dur: this.mods.rainDur, tick: 0, strike: 1, mult });
        this.audio.sfx("rain");
        this.tut.flags.rain = true;
        break;
      case "blizzard":
        this.zones.push({ kind: "blizzard", x, y, r: this.spellRadius("blizzard"), t: 0, dur: 5, tick: 0, strike: 0, mult });
        this.audio.sfx("blizzard");
        break;
      case "firestorm":
        this.zones.push({ kind: "fire", x, y, r: this.spellRadius("firestorm"), t: 0, dur: 5, tick: 0, strike: 0, mult });
        this.audio.sfx("fire");
        break;
      case "gale": this.castGale(x, y, mult); break;
      case "rockfall":
        this.pend.push({ x, y, r: this.spellRadius("rockfall"), t: 0, delay: 0.85, mult });
        this.audio.sfx("rockwarn");
        break;
    }
    this.ring(x, y, 30, def.color, 0.35);
  }

  private nearestEnemy(x: number, y: number, range: number, exclude: Set<Enemy>) {
    let best: Enemy | null = null, bd = range * range;
    for (const e of this.enemies) {
      if (e.dead || exclude.has(e)) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private strikeOne(e: Enemy, dmg: number) {
    if (e.dead) return;
    if (e.wet > 0) {
      dmg *= this.mods.wetBonus;
      this.react("Conduct", e, 1, "#fff08a", "conduct");
    }
    if (!e.boss) e.stun = Math.max(e.stun, e.wet > 0 ? 0.55 : 0.3);
    e.shock = 0.35;
    this.damage(e, dmg, "storm", true);
    this.burst(e.x, e.y, 5, "#fff6a8", 90, 0.35, 2.2);
  }

  private castLightning(x: number, y: number, mult: number, echo: boolean) {
    const m = this.mods;
    const base = 52 * m.lightningMult * mult * this.wmul("storm");
    this.bolt(x + rnd(-40, 40), -10, x, y, "#fff6a8", 4);
    this.shake(echo ? 2 : 4);
    this.flash = Math.max(this.flash, 0.22);
    this.audio.sfx("lightning", echo ? 1.3 : 1);
    this.ring(x, y, T * 1.3, "#fff08a", 0.35);
    const exclude = new Set<Enemy>();
    const r2 = (T * 1.5) ** 2;
    const hits = this.enemies.filter((e) => !e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 < r2).sort((a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2));
    if (!hits.length) {
      this.burst(x, y, 8, "#fff6a8", 70, 0.3, 2);
      return;
    }
    hits.forEach((h, i) => { exclude.add(h); this.strikeOne(h, i === 0 ? base : base * 0.7); });
    let cur = hits[0];
    let n = m.chain;
    let dmg = base * 0.8;
    while (n-- > 0 && cur) {
      const range = (cur.wet > 0 ? 6.5 : 3.4) * T;
      const next = this.nearestEnemy(cur.x, cur.y, range, exclude);
      if (!next) break;
      this.bolt(cur.x, cur.y, next.x, next.y, next.wet > 0 ? "#fff6a8" : "#cfe0ff", 2.5);
      this.audio.sfx("zap", rnd(0.9, 1.4));
      exclude.add(next);
      this.strikeOne(next, dmg);
      cur = next;
      dmg *= 0.92;
    }
    if (!echo && Math.random() < m.echo) {
      this.later.push({ t: 0.3, fn: () => this.castLightning(x, y, mult, true) });
    }
  }

  miniStrike(e: Enemy, dmg: number) {
    if (e.dead) return;
    this.bolt(e.x + rnd(-20, 20), e.y - 160, e.x, e.y, "#fff6a8", 2.5);
    this.strikeOne(e, dmg * this.mods.lightningMult);
    this.audio.sfx("zap", rnd(0.8, 1.2));
  }

  private castGale(x: number, y: number, mult: number) {
    const m = this.mods;
    const R = this.spellRadius("gale");
    this.audio.sfx("gale");
    this.shake(3);
    for (let i = 0; i < 40; i++) {
      this.parts.push({ x: x + rnd(-R, R) * 0.6 + R * 0.4, y: y + rnd(-R, R) * 0.8, vx: -rnd(250, 520), vy: rnd(-30, 30), life: 0.5, max: 0.5, size: rnd(1.5, 3), color: "#d9ffe6", grav: 0, kind: 2 });
    }
    const burners: Enemy[] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d > R) continue;
      const force = 360 * m.galeForce * this.wmul("wind") * e.def.kb * (1 - (d / R) * 0.35);
      e.kx = -force;
      e.ky = ((e.y - y) / R) * force * 0.25;
      e.kgale = true;
      this.damage(e, 8 * mult, "wind", false);
      if (e.wet > 0) {
        e.wet = 0;
        e.chill = Math.max(e.chill, 2.8);
        this.react("Wind Chill", e, 2, "#bfeaff", "reaction");
      }
      if (e.burn > 0) burners.push(e);
    }
    for (const b of burners) {
      for (const o of this.enemies) {
        if (o !== b && !o.dead && o.burn <= 0 && Math.hypot(o.x - b.x, o.y - b.y) < T * 2.4) {
          this.applyBurn(o, 3.5, Math.max(10, b.burnDps));
          if (o.burn > 0) this.react("Wildfire Gust", o, 3, "#ff9a4a", "fire");
        }
      }
    }
    for (const z of this.zones) {
      if (z.kind === "fire" && Math.hypot(z.x - x, z.y - y) < R) {
        z.r = Math.min(T * 5, z.r * 1.25);
        z.dur += 2;
        this.floater(z.x, z.y - 20, "Fanned Flames!", "#ffb070", 14, 1.1);
        this.stats.reactions["Fanned Flames"] = (this.stats.reactions["Fanned Flames"] || 0) + 1;
      }
    }
  }

  private rockImpact(p: Pending) {
    const m = this.mods;
    this.shake(12);
    this.flash = Math.max(this.flash, 0.15);
    this.audio.sfx("rockfall");
    this.ring(p.x, p.y, p.r, "#e0c090", 0.5);
    this.ring(p.x, p.y, p.r * 0.6, "#fff0c8", 0.35);
    this.burst(p.x, p.y, 36, "#b89a6a", 220, 0.8, 4, 200);
    const base = 108 * m.rockMult * p.mult * this.wmul("earth");
    for (const e of this.enemies) {
      if (e.dead || e.flying) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > p.r + e.def.r) continue;
      let dmg = base;
      if (e.frozen > 0) {
        dmg *= m.shatter;
        e.frozen = 0;
        this.react("Shatter", e, 6, "#e8fbff", "shatter");
        this.burst(e.x, e.y, 18, "#d8fbff", 140, 0.7, 3);
      }
      if (!e.boss) e.stun = Math.max(e.stun, 1.1);
      this.damage(e, dmg, "earth", true);
    }
    // rubble
    const cc = Math.floor(p.x / T), rr = Math.floor(p.y / T);
    const cand: [number, number, number][] = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) cand.push([cc + dx, rr + dy, dx * dx + dy * dy]);
    cand.sort((a, b) => a[2] - b[2]);
    let placed = 0;
    for (const [c, r] of cand) {
      if (placed >= m.rubble) break;
      if (!this.buildable(c, r)) continue;
      const i = r * COLS + c;
      if (this.wallHp[i] > 0) continue;
      const px = (c + 0.5) * T, py = (r + 0.5) * T;
      if (this.enemies.some((e) => !e.dead && !e.flying && Math.abs(e.x - px) < T * 0.7 && Math.abs(e.y - py) < T * 0.7)) continue;
      this.wallMax[i] = this.wallMaxHp();
      this.wallHp[i] = this.wallMax[i] * 0.6;
      this.wallFlash[i] = 0.7;
      this.fieldDirty = true;
      placed++;
    }
  }

  castTempest() {
    if (this.paused || (this.phase !== "wave" && this.phase !== "prep")) return;
    if (this.tempest < 100 || this.tempestT > 0) {
      if (this.errT <= 0) { this.errT = 0.5; this.floater(W / 2, H - 80, this.tempestT > 0 ? "Tempest already raging" : "Tempest meter not full", "#ffe29a", 14); this.audio.sfx("error"); }
      return;
    }
    this.tempest = 0;
    this.tempestT = this.mods.tempestDur;
    this.tempestTick = 0;
    this.tempestFreeze = 0;
    this.stats.tempests++;
    this.tut.flags.tempest = true;
    this.flash = 1;
    this.shake(14);
    this.audio.sfx("tempest");
    this.banner = { text: "TEMPEST CALL", sub: "The mountain answers", t: 2.2, color: "#fff08a" };
  }

  /* ============ input ============ */
  toWorld(clientX: number, clientY: number) {
    const r = this.canvas.getBoundingClientRect();
    const v = this.view;
    return { x: (clientX - r.left - v.ox) / v.scale, y: (clientY - r.top - v.oy) / v.scale };
  }
  pointerMove(wx: number, wy: number) {
    this.mx = wx; this.my = wy; this.mouseIn = true;
    if (!this.canAct()) return;
    if (this.painting === "wall") this.buildAt(wx, wy);
    else if (this.painting === "dig") this.digAt(wx, wy);
  }
  pointerLeave() { this.mouseIn = false; this.painting = ""; }
  pointerUp() { this.painting = ""; }
  private canAct() {
    return !this.paused && (this.phase === "prep" || this.phase === "wave");
  }
  pointerDown(wx: number, wy: number, button: number) {
    this.mx = wx; this.my = wy; this.mouseIn = true;
    if (!this.canAct()) return;
    if (button === 2) { this.painting = "dig"; this.digAt(wx, wy); return; }
    if (this.tool === "wall") { this.painting = "wall"; this.buildAt(wx, wy); }
    else if (this.tool === "dig") { this.painting = "dig"; this.digAt(wx, wy); }
    else this.cast(this.tool as SpellId, wx, wy);
  }

  onKey(e: KeyboardEvent) {
    if (e.repeat && e.code !== "Space") return;
    const code = e.code;
    if (code === "Escape" || code === "KeyP") { this.setPaused(!this.paused); return; }
    if (this.paused) return;
    if (this.phase === "relic" || this.phase === "gameover" || this.phase === "victory") return;
    const idx = ["Digit1", "Digit2", "Digit3", "Digit4", "Digit5", "Digit6"].indexOf(code);
    if (idx >= 0) { this.selectTool(SPELLS[idx].id); return; }
    if (code === "KeyQ") this.selectTool("wall");
    else if (code === "KeyE") this.selectTool("dig");
    else if (code === "KeyR") this.castTempest();
    else if (code === "Space") { e.preventDefault(); this.callWave(); }
    else if (code === "KeyF") this.toggleSpeed();
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    this.audio.sfx("click");
  }

  setPaused(p: boolean) {
    if (this.phase === "gameover" || this.phase === "victory" || this.phase === "relic") return;
    if (this.paused === p) return;
    this.paused = p;
    this.painting = "";
    this.audio.sfx(p ? "back" : "click");
    this.cb.ui(this.snapshot());
  }

  /* ============ relics ============ */
  private openDraft(from: string) {
    const owned = new Set(this.relics);
    const pool = RELICS.filter((r) => !owned.has(r.id));
    const picks: string[] = [];
    const w = (r: (typeof RELICS)[number]) => (r.rarity === "common" ? 5 : r.rarity === "rare" ? 3 : 1.6);
    const bag = pool.slice();
    while (picks.length < 3 && bag.length) {
      let tot = 0;
      bag.forEach((r) => (tot += w(r)));
      let rr = Math.random() * tot, k = 0;
      for (let i = 0; i < bag.length; i++) { rr -= w(bag[i]); if (rr <= 0) { k = i; break; } }
      picks.push(bag[k].id);
      bag.splice(k, 1);
    }
    this.draft = picks;
    this.relicFrom = from;
    this.phase = "relic";
    this.audio.sfx("relic");
    this.audio.setMode("prep");
    this.cb.ui(this.snapshot());
  }

  chooseRelic(id: string) {
    if (this.phase !== "relic") return;
    const oldMax = this.gateMax;
    if (id === "provisions") {
      this.gateHp = Math.min(this.gateMax, this.gateHp + 5);
      this.stone = Math.min(this.mods.stoneCap, this.stone + 30);
      this.mana = this.mods.maxMana;
    } else if (RELICS.some((r) => r.id === id) && !this.relics.includes(id)) {
      this.relics.push(id);
      this.mods = buildMods(this.opts.research, this.relics, this.opts.tutorial);
      this.gateMax = this.diff.gate + this.mods.gateHp;
      this.gateHp += this.gateMax - oldMax;
      this.mana = Math.min(this.mana, this.mods.maxMana);
    }
    this.audio.sfx("buy");
    this.phase = "prep";
    this.prepT = this.relicFrom === "start" ? 30 : 22;
    this.draft = [];
    this.banner = { text: "Prepare the Pass", sub: "Raise walls and plan your storms", t: 2.5, color: "#9fd0ff" };
    this.cb.ui(this.snapshot());
  }

  continueEndless() {
    if (this.phase !== "victory") return;
    this.endless = true;
    this.result = null;
    this.ended = false;
    this.openDraft("wave");
  }

  /* ============ end of run ============ */
  aetherEarned() {
    const mutBonus = this.opts.mutators.reduce((s, id) => s + (MUTATORS.find((m) => m.id === id)?.aether || 0), 0);
    const raw = this.stats.wavesCleared * 3 + this.stats.bossKills * 12 + Math.floor(this.stats.kills / 18) + (this.won ? 30 : 0);
    return Math.round(raw * this.diff.aether * (1 + mutBonus));
  }

  private report(kind: string) {
    if (this.opts.tutorial) return;
    const total = this.aetherEarned();
    const delta = Math.max(0, total - this.awarded);
    this.awarded = total;
    const kd = this.stats.kills - this.reportedKills;
    const bd = this.stats.bossKills - this.reportedBoss;
    this.reportedKills = this.stats.kills;
    this.reportedBoss = this.stats.bossKills;
    this.cb.onEnd({ kind, aetherDelta: delta, wave: this.wave, killsDelta: kd, bossDelta: bd, won: this.won, difficulty: this.diff.id });
  }

  abandon() {
    if (this.ended) return;
    this.ended = true;
    this.report("abandon");
  }

  private endRun(kind: "gameover" | "victory") {
    if (this.ended) return;
    this.ended = true;
    this.phase = kind;
    if (kind === "victory") this.won = true;
    this.paused = false;
    this.report(kind);
    this.result = {
      kind, aether: this.aetherEarned(), stats: { ...this.stats, reactions: { ...this.stats.reactions } }, wave: this.wave,
      difficulty: this.diff.id, mutators: this.opts.mutators, relics: this.relics.slice(), newBest: false, score: this.score,
    };
    this.audio.sfx(kind === "victory" ? "victory" : "defeat");
    this.audio.setMode("prep");
    this.shake(kind === "victory" ? 6 : 16);
    this.cb.ui(this.snapshot());
  }

  private gateHit(e: Enemy) {
    e.dead = true;
    this.stats.breaches++;
    const dmg = e.def.gate;
    this.gateShake = 1;
    this.shake(7 + Math.min(12, dmg));
    this.flash = Math.max(this.flash, 0.25);
    this.floater(W - 60, this.gateY - 30, `-${dmg}`, "#ff6a6a", 22, 1.2);
    this.burst(W - 10, e.y, 14, "#ff6a6a", 120, 0.6, 3);
    this.audio.sfx("gate");
    if (this.opts.tutorial) { this.gateHp = this.gateMax; return; }
    this.gateHp -= dmg;
    if (this.gateHp <= 0) { this.gateHp = 0; this.endRun("gameover"); }
  }

  private waveCleared() {
    this.stats.wavesCleared++;
    this.score += this.wave * 100;
    this.gateHp = Math.min(this.gateMax, this.gateHp + this.mods.gateHeal);
    this.mana = Math.min(this.mods.maxMana, this.mana + 40);
    this.stone = Math.min(this.mods.stoneCap, this.stone + 12);
    this.zones = [];
    this.pend = [];
    this.audio.sfx("wave");
    this.banner = { text: "Wave Cleared", sub: `Wave ${this.wave} repelled`, t: 2, color: "#9fffb0" };
    if (!this.endless && this.wave >= MAX_WAVES) {
      this.endRun("victory");
      return;
    }
    this.openDraft("wave");
  }

  /* ============ tutorial ============ */
  private updateTutorial(dt: number) {
    const t = this.tut;
    this.mana = Math.min(this.mods.maxMana, this.mana + 30 * dt);
    this.stone = Math.min(this.mods.stoneCap, this.stone + 4 * dt);
    this.gateHp = this.gateMax;
    if (t.step >= 1 && t.step <= 4) {
      t.spawnT -= dt;
      const alive = this.enemies.filter((e) => !e.dead).length;
      if (alive < 3 && t.spawnT <= 0) {
        t.spawnT = 1.4;
        this.spawnEnemy("footman", undefined, undefined, { hpMul: 3, spd: 0.5 });
      }
    }
    const f = t.flags;
    const adv = () => { t.step++; t.flags = {}; this.audio.sfx("reaction"); };
    if (t.step === 0 && t.walls >= 3) { adv(); }
    else if (t.step === 1 && f.rain) { adv(); }
    else if (t.step === 2 && f.conduct) { adv(); }
    else if (t.step === 3 && f.freeze) { adv(); }
    else if (t.step === 4 && f.shatter) { adv(); this.tempest = 100; }
    else if (t.step === 5 && f.tempest) { adv(); t.done = true; this.audio.sfx("victory"); }
    if (t.done && !t.reported) { t.reported = true; this.cb.onEnd({ kind: "tutorial", aetherDelta: 0, wave: 0, killsDelta: 0, bossDelta: 0, won: false, difficulty: "" }); }
  }

  /* ============ simulation ============ */
  private bossLogic(e: Enemy, dt: number) {
    if (e.type === "warlord") {
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.t1 = e.enraged ? 4.2 : 7;
        this.spawnEnemy("footman", e.x - 20, e.y - 20);
        this.spawnEnemy("footman", e.x - 20, e.y + 20);
        if (e.enraged) this.spawnEnemy("scout", e.x - 10, e.y);
        this.floater(e.x, e.y - 40, "Reinforcements!", "#ff9a8a", 15, 1.2);
        this.audio.sfx("horn");
      }
      if (!e.enraged && e.hp < e.maxHp * 0.5) {
        e.enraged = true;
        e.speedMul *= 1.35;
        this.shake(10);
        this.floater(e.x, e.y - 50, "ENRAGED!", "#ff4a4a", 22, 1.6);
        this.audio.sfx("boss");
      }
    } else if (e.type === "colossus") {
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.t1 = 1.3;
        let hit = false;
        const R = T * 2.5;
        const c0 = Math.floor(e.x / T), r0 = Math.floor(e.y / T);
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const c = c0 + dx, r = r0 + dy;
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
          const i = r * COLS + c;
          if (this.wallHp[i] > 0 && Math.hypot((c + 0.5) * T - e.x, (r + 0.5) * T - e.y) < R) { this.hitWall(i, 260); hit = true; }
        }
        if (hit) { this.ring(e.x, e.y, R, "#a8a090", 0.5); this.shake(7); this.audio.sfx("boom"); }
      }
    } else if (e.type === "tyrant") {
      e.t1 -= dt;
      if (e.t1 <= 0) {
        e.t1 = 8;
        const pool = WARD_LIST.filter((w) => w !== e.ward);
        e.ward = pool[Math.floor(Math.random() * pool.length)];
        this.floater(e.x, e.y - 50, `Ward: ${e.ward.toUpperCase()}`, ELEMENT_COLOR[e.ward === "storm" ? "storm" : e.ward] || "#fff", 16, 1.4);
        this.ring(e.x, e.y, 60, ELEMENT_COLOR[e.ward] || "#fff", 0.6);
      }
      const th = [0.75, 0.45, 0.2];
      if (e.phase < 3 && e.hp < e.maxHp * th[e.phase]) {
        const n = 2 + e.phase;
        for (let i = 0; i < n; i++) this.spawnEnemy("wyvern", e.x, e.y + (i - n / 2) * 24);
        e.phase++;
        this.floater(e.x, e.y - 60, "Summons wyverns!", "#d9a8ff", 16, 1.4);
        this.audio.sfx("boss");
        this.shake(9);
      }
    }
  }

  private updateEnemy(e: Enemy, dt: number) {
    const d = e.def;
    e.anim += dt;
    e.flash = Math.max(0, e.flash - dt * 6);
    e.reactCd -= dt;
    e.sfxT -= dt;
    if (e.wet > 0) e.wet -= dt;
    if (e.chill > 0) e.chill -= dt;
    if (e.frozen > 0) e.frozen -= dt;
    if (e.shock > 0) e.shock -= dt;
    if (e.stun > 0) e.stun -= dt;
    if (e.rime > 0) e.rime -= dt;
    if (e.burn > 0) {
      e.burn -= dt;
      this.damage(e, e.burnDps * dt, "fire", false);
      e.fireT -= dt;
      if (e.fireT <= 0 && !e.dead) {
        e.fireT = 0.1;
        this.parts.push({ x: e.x + rnd(-d.r, d.r) * 0.6, y: e.y + rnd(-2, 2), vx: rnd(-8, 8), vy: -rnd(30, 60), life: 0.45, max: 0.45, size: rnd(2, 4), color: Math.random() < 0.5 ? "#ff8a2e" : "#ffd35a", grav: -20, kind: 0 });
      }
      if (e.burn <= 0) e.burnDps = 0;
      if (e.dead) return;
    }
    if (e.boss) { this.bossLogic(e, dt); if (e.dead) return; }
    // knockback
    if (Math.abs(e.kx) + Math.abs(e.ky) > 4) {
      const nx = e.x + e.kx * dt, ny = e.y + e.ky * dt;
      if (this.canStand(nx, ny, e.flying)) { e.x = nx; e.y = ny; }
      else {
        const sp = Math.hypot(e.kx, e.ky);
        if (e.kgale && sp > 70) {
          const dmg = this.mods.galeImpact * (e.boss ? 0.3 : 1);
          this.damage(e, dmg, "wind", true);
          e.stun = Math.max(e.stun, 0.5);
          this.burst(e.x, e.y, 6, "#e0e0e0", 70, 0.4, 2.5);
          this.audio.sfx("hit", 0.7);
          const wi = ((ny / T) | 0) * COLS + ((nx / T) | 0);
          if (wi >= 0 && wi < COLS * ROWS && this.wallHp[wi] > 0) this.hitWall(wi, 25);
        }
        e.kx = 0; e.ky = 0;
      }
      const f = Math.exp(-4.5 * dt);
      e.kx *= f; e.ky *= f;
    } else { e.kx = 0; e.ky = 0; e.kgale = false; }

    if (e.frozen > 0 || e.stun > 0) return;
    const knocked = Math.abs(e.kx) > 60;
    let slow = 1;
    if (e.chill > 0) slow *= 0.55;
    if (e.wet > 0) slow *= 0.9;
    if (e.rime > 0) slow *= 0.72;
    const speed = d.speed * e.speedMul * (e.aura ? 1.3 : 1) * slow;
    if (knocked) return;

    if (e.flying) {
      const tx = W + 20, ty = this.gateY;
      const dx = tx - e.x, dy = ty - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      e.x += (dx / dist) * speed * dt;
      e.y += (dy / dist) * speed * dt * 0.6 + Math.sin(e.anim * 2.4) * 22 * dt;
      e.y = clamp(e.y, 6, H - 6);
      e.face = Math.atan2(dy, dx);
      if (e.x >= W - 8) this.gateHit(e);
      return;
    }

    if (e.x >= W - T * 0.55) { this.gateHit(e); return; }
    if (e.x < T * 0.25) { e.x += speed * dt * 1.2; e.face = 0; return; }
    const c = clamp(Math.floor(e.x / T), 0, COLS - 1), r = clamp(Math.floor(e.y / T), 0, ROWS - 1);
    const steps = d.range > 0 ? Math.ceil(d.range / T) + 1 : 1;
    const wi = this.firstWall(c, r, steps);
    if (wi >= 0) {
      const wx = ((wi % COLS) + 0.5) * T, wy = (((wi / COLS) | 0) + 0.5) * T;
      const dist = Math.hypot(wx - e.x, wy - e.y);
      const reach = d.range > 0 ? d.range : T * 1.05;
      if (dist <= reach) {
        e.face = Math.atan2(wy - e.y, wx - e.x);
        const mul = e.aura ? 1.3 : 1;
        if (e.type === "sapper") {
          if (dist < T * 1.15) {
            e.dead = true;
            this.ring(wx, wy, T * 1.8, "#ffb060", 0.45);
            this.burst(wx, wy, 26, "#ff9a4a", 160, 0.6, 3.5, 60);
            this.shake(7);
            this.audio.sfx("boom");
            const wc = Math.floor(wx / T), wr = Math.floor(wy / T);
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
              const cc = wc + dx, rr = wr + dy;
              if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
              if (Math.hypot(dx, dy) <= 1.8) this.hitWall(rr * COLS + cc, 150);
            }
            return;
          }
        } else if (d.range > 0) {
          e.atk -= dt;
          if (e.atk <= 0) {
            e.atk = 1.3;
            this.projs.push({ x: e.x, y: e.y, sx: e.x, sy: e.y, tx: wx, ty: wy, t: 0, dur: 0.5, idx: wi, dmg: d.wallDps * 1.3 * mul });
            this.audio.sfx("fire", 1.4);
          }
        } else if (d.wallDps > 0) {
          this.hitWall(wi, d.wallDps * mul * dt);
          if (Math.random() < dt * 4) this.burst(wx, wy, 2, "#c8c0b0", 50, 0.3, 2, 80);
          e.sfxT -= 0;
        }
        return;
      }
    }
    const n = this.nextTile(c, r);
    let tx: number, ty: number;
    if (n < 0) { tx = e.x + 50; ty = e.y; }
    else {
      tx = ((n % COLS) + 0.5) * T + e.ox;
      ty = (((n / COLS) | 0) + 0.5) * T + e.oy;
      if (this.wallHp[n] > 0) { tx = ((n % COLS) + 0.5) * T; ty = (((n / COLS) | 0) + 0.5) * T; }
    }
    const dx = tx - e.x, dy = ty - e.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0.01) {
      const stp = Math.min(dist, speed * dt);
      const nx = e.x + (dx / dist) * stp, ny = e.y + (dy / dist) * stp;
      if (this.canStand(nx, ny, false)) { e.x = nx; e.y = ny; }
      else if (this.canStand(nx, e.y, false)) e.x = nx;
      else if (this.canStand(e.x, ny, false)) e.y = ny;
      e.face = Math.atan2(dy, dx);
    }
  }

  private separate() {
    for (const cell of this.cells) cell.length = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const cx = clamp(Math.floor((e.x + 40) / 32), 0, this.cw - 1), cy = clamp(Math.floor(e.y / 32), 0, this.ch - 1);
      this.cells[cy * this.cw + cx].push(e);
    }
    for (const e of this.enemies) {
      if (e.dead || e.frozen > 0) continue;
      const cx = clamp(Math.floor((e.x + 40) / 32), 0, this.cw - 1), cy = clamp(Math.floor(e.y / 32), 0, this.ch - 1);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= this.cw || y >= this.ch) continue;
        for (const o of this.cells[y * this.cw + x]) {
          if (o.id <= e.id || o.flying !== e.flying) continue;
          const ddx = o.x - e.x, ddy = o.y - e.y;
          const min = (e.def.r + o.def.r) * 0.85;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 >= min * min || d2 < 0.0001) continue;
          const dist = Math.sqrt(d2);
          const push = (min - dist) * 0.35;
          const ux = ddx / dist, uy = ddy / dist;
          const we = e.boss ? 0.05 : o.def.r / (e.def.r + o.def.r);
          const wo = o.boss ? 0.05 : e.def.r / (e.def.r + o.def.r);
          if (this.canStand(e.x - ux * push * we, e.y - uy * push * we, e.flying)) { e.x -= ux * push * we; e.y -= uy * push * we; }
          if (this.canStand(o.x + ux * push * wo, o.y + uy * push * wo, o.flying)) { o.x += ux * push * wo; o.y += uy * push * wo; }
        }
      }
    }
  }

  private simulate(dt: number) {
    this.stats.time += dt;
    this.errT -= dt;
    for (const k in this.cd) if (this.cd[k] > 0) this.cd[k] -= dt;
    const tut = this.opts.tutorial;
    // mana & stone
    let regen = this.mods.manaRegen * this.diff.regen;
    if (this.mutSet.has("drought")) regen *= 0.65;
    if (this.weather === "clear") regen *= 1.1;
    if (this.weather === "ember") regen *= 0.85;
    this.mana = Math.min(this.mods.maxMana, this.mana + regen * dt);
    this.stone = Math.min(this.mods.stoneCap, this.stone + this.mods.stoneRegen * dt);
    if (this.harmony > 0) {
      this.harmonyT -= dt;
      if (this.harmonyT <= 0) this.harmony = 0;
    }
    if (this.fieldDirty) this.computeField();
    for (let i = this.later.length - 1; i >= 0; i--) {
      this.later[i].t -= dt;
      if (this.later[i].t <= 0) { const fn = this.later[i].fn; this.later.splice(i, 1); fn(); }
    }
    for (let i = 0; i < this.wallFlash.length; i++) if (this.wallFlash[i] > 0) this.wallFlash[i] -= dt * 2;

    if (tut) this.updateTutorial(dt);
    else if (this.phase === "prep") {
      this.prepT -= dt;
      if (this.prepT <= 0) this.startWave();
    } else if (this.phase === "wave") {
      this.waveT += dt;
      while (this.queue.length && this.queue[0].t <= this.waveT) {
        const q = this.queue.shift()!;
        const en = this.spawnEnemy(q.type);
        if (en && en.boss) this.floater(80, en.y - 30, en.def.name + " approaches!", "#ff9a8a", 18, 2);
      }
      if (!this.queue.length && !this.enemies.some((e) => !e.dead) && this.phase === "wave") {
        this.waveCleared();
        return;
      }
    }

    // weather ticks
    this.weatherTick -= dt;
    if (this.weatherTick <= 0) {
      this.weatherTick = 1;
      if (this.weather === "rain") for (const e of this.enemies) this.applyWet(e, 2.5);
      else if (this.weather === "snow") for (const e of this.enemies) if (!e.def.immune?.includes("chill")) e.chill = Math.max(e.chill, 1.4);
    }

    // tempest
    if (this.tempestT > 0) {
      this.tempestT -= dt;
      this.tempestTick -= dt;
      this.tempestFreeze -= dt;
      if (this.tempestFreeze <= 0) {
        this.tempestFreeze = 1.8;
        for (const e of this.enemies) { if (!e.dead) { this.applyWet(e, 2.5); this.applyChill(e, 2); } }
        this.audio.sfx("blizzard");
      }
      if (this.tempestTick <= 0) {
        this.tempestTick = 0.22;
        const live = this.enemies.filter((e) => !e.dead);
        if (live.length) {
          this.miniStrike(live[Math.floor(Math.random() * live.length)], 48);
          this.shake(2);
        }
      }
      if (Math.random() < dt * 4) this.flash = Math.max(this.flash, 0.18);
    }

    // zones
    for (const z of this.zones) {
      z.t += dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.kind === "rain" ? 0.4 : 0.4;
        const r2 = z.r * z.r;
        for (const e of this.enemies) {
          if (e.dead || (e.x - z.x) ** 2 + (e.y - z.y) ** 2 > r2) continue;
          if (z.kind === "rain") this.applyWet(e, 3.2);
          else if (z.kind === "blizzard") {
            this.damage(e, 6 * z.mult * this.mods.frostMult * this.wmul("frost"), "frost", false);
            this.applyChill(e, 2.2);
          } else {
            this.damage(e, 8 * z.mult * this.wmul("fire"), "fire", false);
            this.applyBurn(e, 3, 13 * this.mods.burnMult * z.mult);
          }
        }
      }
      if (z.kind === "rain" && this.mods.rainStrike) {
        z.strike -= dt;
        if (z.strike <= 0) {
          z.strike = 1.3;
          const r2 = z.r * z.r;
          const wets = this.enemies.filter((e) => !e.dead && e.wet > 0 && (e.x - z.x) ** 2 + (e.y - z.y) ** 2 < r2);
          if (wets.length) this.miniStrike(wets[Math.floor(Math.random() * wets.length)], 34);
        }
      }
      // ambient particles
      if (this.parts.length < 1200 && Math.random() < dt * 40) {
        const a = Math.random() * 6.283, rr = Math.sqrt(Math.random()) * z.r;
        const px = z.x + Math.cos(a) * rr, py = z.y + Math.sin(a) * rr;
        if (z.kind === "rain") this.parts.push({ x: px, y: py - 30, vx: -20, vy: 320, life: 0.18, max: 0.18, size: 8, color: "#7cc8ff", grav: 0, kind: 2 });
        else if (z.kind === "blizzard") this.parts.push({ x: px, y: py, vx: rnd(-80, -20), vy: rnd(-20, 40), life: 0.7, max: 0.7, size: rnd(1.5, 3), color: "#e8fcff", grav: 0, kind: 0 });
        else this.parts.push({ x: px, y: py, vx: rnd(-10, 10), vy: -rnd(40, 90), life: 0.6, max: 0.6, size: rnd(2, 5), color: Math.random() < 0.5 ? "#ff7a2e" : "#ffd35a", grav: -30, kind: 0 });
      }
    }
    this.zones = this.zones.filter((z) => z.t < z.dur);

    // rockfall pending
    for (const p of this.pend) {
      p.t += dt;
      if (p.t >= p.delay) { this.rockImpact(p); p.t = 9999; }
    }
    this.pend = this.pend.filter((p) => p.t < 9000);

    // warcaller aura
    const callers = this.enemies.filter((e) => !e.dead && e.type === "warcaller" && e.frozen <= 0);
    for (const e of this.enemies) {
      e.aura = false;
      if (callers.length) for (const c of callers) if (c !== e && (c.x - e.x) ** 2 + (c.y - e.y) ** 2 < (T * 5) ** 2) { e.aura = true; break; }
    }

    // wall effects
    this.wallTick -= dt;
    if (this.wallTick <= 0) {
      this.wallTick = 0.5;
      this.wallTick2++;
      const m = this.mods;
      if (m.rime || m.ember || m.pylon) {
        for (const e of this.enemies) {
          if (e.dead || e.flying || e.x < 0) continue;
          const c = Math.floor(e.x / T), r = Math.floor(e.y / T);
          let adj = false;
          for (let k = 0; k < 8 && !adj; k++) {
            const nc = c + DIRS[k][0], nr = r + DIRS[k][1];
            if (nc >= 0 && nr >= 0 && nc < COLS && nr < ROWS && this.wallHp[nr * COLS + nc] > 0) adj = true;
          }
          if (!adj) continue;
          if (m.rime) { e.rime = 1; if (Math.random() < 0.3) this.burst(e.x, e.y, 1, "#cfefff", 20, 0.4, 2); }
          if (m.ember) { this.damage(e, 5 * m.burnMult, "fire", false); this.applyBurn(e, 1.6, 8 * m.burnMult); }
          if (m.pylon && e.wet > 0 && this.wallTick2 % 2 === 0) this.miniStrike(e, 26);
        }
      }
    }

    this.separate();
    for (const e of this.enemies) if (!e.dead) this.updateEnemy(e, dt);

    // projectiles
    for (const p of this.projs) {
      p.t += dt;
      const k = Math.min(1, p.t / p.dur);
      p.x = p.sx + (p.tx - p.sx) * k;
      p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 18;
      if (this.parts.length < 1300) this.parts.push({ x: p.x, y: p.y, vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.25, max: 0.25, size: 3, color: "#ff8a3a", grav: 0, kind: 0 });
      if (k >= 1) {
        this.hitWall(p.idx, p.dmg);
        this.burst(p.tx, p.ty, 10, "#ff9a4a", 90, 0.4, 3);
        this.ring(p.tx, p.ty, 18, "#ff9a4a", 0.25);
        p.t = 999;
      }
    }
    this.projs = this.projs.filter((p) => p.t < 900);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // music
    const inten = this.phase === "wave" ? Math.min(1, this.enemies.length / 28 + (this.tempestT > 0 ? 0.3 : 0)) : 0;
    this.audio.setIntensity(inten);
    if (this.phase === "prep" && this.audio.mode === "battle") this.audio.setMode("prep");
  }

  private updateFx(dt: number) {
    this.time += dt;
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.gateShake = Math.max(0, this.gateShake - dt * 2.5);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 26 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const b of this.bolts) b.life -= dt;
    this.bolts = this.bolts.filter((b) => b.life > 0);
    // weather particles
    const w = this.weather;
    for (const p of this.wp) {
      if (w === "rain") { p.x -= 90 * dt; p.y += (520 + p.v * 200) * dt; }
      else if (w === "snow") { p.x += Math.sin(this.time * 1.5 + p.s * 9) * 18 * dt - 12 * dt; p.y += (40 + p.v * 50) * dt; }
      else if (w === "ember") { p.x += Math.sin(this.time + p.s * 9) * 14 * dt; p.y -= (25 + p.v * 40) * dt; }
      else if (w === "gale") { p.x -= (420 + p.v * 300) * dt; p.y += Math.sin(this.time * 2 + p.s * 9) * 8 * dt; }
      else { p.y += 3 * dt; }
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
      if (p.x < -20) { p.x = W + 10; p.y = Math.random() * H; }
      if (p.x > W + 20) p.x = -10;
    }
  }

  private frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!(dt > 0)) dt = 0;
    dt = Math.min(dt, 0.05);
    if (!this.paused) {
      const live = this.phase === "prep" || this.phase === "wave";
      const steps = live ? this.speed : 1;
      for (let i = 0; i < steps; i++) {
        if (live) this.simulate(dt);
        this.updateFx(dt);
        if (this.phase !== "prep" && this.phase !== "wave") break;
      }
    }
    try {
      renderGame(this);
    } catch {
      /* render errors must never kill the loop */
    }
    if (now - this.lastUi > 90) {
      this.lastUi = now;
      this.cb.ui(this.snapshot());
    }
  };

  resize(w: number, h: number, dpr: number) {
    this.canvas.width = Math.max(2, Math.floor(w * dpr));
    this.canvas.height = Math.max(2, Math.floor(h * dpr));
    const scale = Math.min(w / W, h / H);
    this.view = { scale, ox: (w - W * scale) / 2, oy: (h - H * scale) / 2, dpr, w, h };
  }

  /* ============ snapshot ============ */
  snapshot(): Snap {
    const cd: Record<string, number> = {};
    const cost: Record<string, number> = {};
    for (const s of SPELLS) {
      cd[s.id] = Math.max(0, (this.cd[s.id] || 0) / Math.max(0.01, s.cd * this.mods.cdMult));
      cost[s.id] = this.spellCost(s.id);
    }
    let boss: Snap["boss"] = null;
    for (const e of this.enemies) {
      if (e.boss && !e.dead) {
        boss = { name: e.def.name, hp: Math.max(0, e.hp / e.maxHp), ward: e.type === "tyrant" ? e.ward : "", icon: e.def.icon, weak: e.type === "tyrant" ? WARD_WEAK[e.ward] || "" : e.type === "colossus" ? "frozen" : "" };
        break;
      }
    }
    const step = TUT[Math.min(this.tut.step, TUT.length - 1)];
    return {
      phase: this.phase, paused: this.paused, wave: this.wave, maxWave: MAX_WAVES, endless: this.endless, weather: this.weather, nextWeather: this.plan.weather,
      gate: this.gateHp, gateMax: this.gateMax, mana: this.mana, manaMax: this.mods.maxMana, stone: this.stone, stoneCap: this.mods.stoneCap,
      tempest: this.tempest, tempestT: this.tempestT, tool: this.tool, cd, unlocked: this.mods.unlocked, cost, harmony: this.harmony, harmonyCap: this.mods.harmonyCap,
      score: this.score, kills: this.stats.kills, prepT: this.prepT, left: this.enemies.length + this.queue.length, speed: this.speed,
      relics: this.relics, draft: this.draft, boss, forecast: this.plan.counts, nextBoss: this.plan.boss,
      tutorial: this.opts.tutorial, tutStep: this.tut.step, tutTitle: step.title, tutText: step.text, tutDone: this.tut.done, tutTotal: TUT.length,
      result: this.result, wallCost: this.wallCost(), canCallEarly: this.phase === "prep",
    };
  }
}
