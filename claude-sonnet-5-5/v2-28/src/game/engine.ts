import {
  COLS, ROWS, CELL, W, H, WIN_WAVE, SPELLS, STRUCTS, PESTS, CROP_TYPES, TUTORIAL, DIFFICULTIES, MODIFIERS, computePerks,
} from "./data";
import type {
  SpellId, StructId, ToolId, PestKind, Pest, Crop, Struct, Cloud, Gust, Zone, Particle, FText, Arc, Perks, DifficultyDef,
} from "./data";
import { audio } from "./audio";
import { getSave, updateSave } from "./save";
import { render } from "./render";

export interface RunStats {
  time: number;
  waves: number;
  kills: number;
  harvested: number;
  gold: number;
  cropsLost: number;
  reactions: number;
  maxCombo: number;
  score: number;
  seeds: number;
  bossKills: number;
  tally: Record<string, number>;
  won: boolean;
}

export interface HudState {
  gold: number;
  mana: number;
  maxMana: number;
  wave: number;
  winWave: number;
  waveState: "prep" | "active";
  prepT: number;
  remaining: number;
  alive: number;
  total: number;
  combo: number;
  comboFrac: number;
  forecast: string;
  eventName: string | null;
  wind: { x: number; y: number };
  tool: ToolId | null;
  cds: Record<string, number>;
  spells: SpellId[];
  structs: StructId[];
  sel: { id: StructId; name: string; lvl: number; upCost: number; sell: number; canRotate: boolean } | null;
  paused: boolean;
  over: null | "victory" | "gameover";
  summary: RunStats | null;
  boss: { name: string; frac: number } | null;
  score: number;
  tutStep: number;
  tutText: string;
  speed: number;
  preview: { kind: PestKind; count: number }[];
  previewTotal: number;
  previewBoss: boolean;
  difficulty: string;
  toast: string;
  endless: boolean;
  night: number;
}

export interface GameOpts {
  difficulty: string;
  mods: string[];
  tutorial: boolean;
  onHud: (h: HudState) => void;
}

interface QItem {
  t: number;
  kind: PestKind;
}

const DIRS = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  onHud: (h: HudState) => void;
  perks: Perks;
  diff: DifficultyDef;
  mods: string[];
  view = { scale: 1, ox: 0, oy: 0, dpr: 1 };

  // grid state
  N = COLS * ROWS;
  wet = new Float32Array(COLS * ROWS);
  temp = new Float32Array(COLS * ROWS);
  ice = new Float32Array(COLS * ROWS);
  fire = new Float32Array(COLS * ROWS);
  fuel = new Float32Array(COLS * ROWS);
  steam = new Float32Array(COLS * ROWS);
  charge = new Float32Array(COLS * ROWS);
  wx = new Float32Array(COLS * ROWS);
  wy = new Float32Array(COLS * ROWS);
  buf = new Float32Array(COLS * ROWS);
  cropAt = new Int16Array(COLS * ROWS).fill(-1);
  structAt: (Struct | null)[] = new Array(COLS * ROWS).fill(null);

  // entities
  pests: Pest[] = [];
  crops: Crop[] = [];
  structs: Struct[] = [];
  clouds: Cloud[] = [];
  gusts: Gust[] = [];
  zones: Zone[] = [];
  parts: Particle[] = [];
  texts: FText[] = [];
  arcs: Arc[] = [];

  // state
  time = 0;
  dayT = 0.2;
  gold: number;
  mana: number;
  wave = 0;
  waveState: "prep" | "active" = "prep";
  prepT = 28;
  queue: QItem[] = [];
  nextQueue: QItem[] = [];
  waveT = 0;
  lostThisWave = 0;
  combo = 0;
  comboT = 0;
  score = 0;
  cd: Record<SpellId, number> = { rain: 0, wind: 0, bolt: 0, heat: 0, frost: 0 };
  tool: ToolId | null = null;
  selStruct: Struct | null = null;
  mouse = { x: W / 2, y: H / 2 };
  mouseIn = false;
  drag: { x: number; y: number } | null = null;
  paused = false;
  over: null | "victory" | "gameover" = null;
  speed = 1;
  shake = 0;
  flash = 0;
  endless = false;
  seedsEarned = 0;
  banked = 0;
  runCounted = false;
  bossKills = 0;
  toastMsg = "";
  toastT = 0;
  summary: RunStats | null = null;
  stats = { kills: 0, harvested: 0, gold: 0, cropsLost: 0, reactions: 0, maxCombo: 0, tally: {} as Record<string, number> };
  reactCd: Record<string, number> = {};
  nextId = 1;
  loseAt: number;

  // weather
  gw = { x: 0, y: 0 };
  gwTarget = { x: 0, y: 0 };
  breezeT = 5;
  tempOff = 0;
  event: { kind: string; t: number; dur: number } | null = null;
  nextEvent = { kind: "drizzle", t: 40 };

  // tutorial
  tutorial: boolean;
  tutStep = 0;

  // misc
  raf = 0;
  lastT = 0;
  hudT = 0;
  dead = false;
  padPrev: boolean[] = [];
  padDir = { x: -1, y: 0 };
  padActive = false;
  wvx = 0;
  wvy = 0;
  rodSeen = 0;

  constructor(canvas: HTMLCanvasElement, opts: GameOpts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.onHud = opts.onHud;
    const sv = getSave();
    this.perks = computePerks(sv.owned);
    this.diff = DIFFICULTIES.find((d) => d.id === opts.difficulty) || DIFFICULTIES[1];
    this.mods = opts.mods.slice();
    this.tutorial = opts.tutorial;
    this.gold = this.perks.startGold;
    this.mana = this.perks.maxMana;
    for (let i = 0; i < this.N; i++) {
      this.temp[i] = 0.5;
      this.fuel[i] = 1;
      this.wet[i] = 0.12;
    }
    this.buildCrops();
    this.nextEvent = { kind: this.pickEvent(), t: this.diff.evt * 0.9 };
    this.nextQueue = this.buildWave(1);
    if (this.tutorial) this.prepT = 9999;
    this.loseAt = Math.floor(this.crops.length * 0.2);
    this.attach();
    this.resize();
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.emitHud();
  }

  // ---------- setup ----------
  buildCrops() {
    const cols = [14, 15, 17, 18];
    const rows = [2, 3, 5, 6, 8, 9];
    for (const r of rows)
      for (const c of cols) {
        const i = r * COLS + c;
        const crop: Crop = {
          i, c, r, x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, type: (c + r * 2) % 3,
          growth: Math.random() * 0.3, hp: 60 * this.perks.cropHp, maxhp: 60 * this.perks.cropHp, alive: true, thirst: 0, flash: 0,
        };
        this.cropAt[i] = this.crops.length;
        this.crops.push(crop);
      }
  }

  modOn(id: string) {
    return this.mods.includes(id);
  }

  // ---------- listeners ----------
  attach() {
    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointerleave", this.onLeave);
    this.canvas.addEventListener("contextmenu", this.onCtx);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("resize", this.resize);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
  }

  destroy() {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointerleave", this.onLeave);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    audio.setAmbient(0, 0);
    audio.intensity = 0.15;
  }

  onBlur = () => {
    if (!this.over && !this.paused && (document.hidden || document.visibilityState === "hidden" || !document.hasFocus())) this.setPaused(true);
  };

  onCtx = (e: Event) => e.preventDefault();

  resize = () => {
    const p = this.canvas.parentElement;
    if (!p) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(100, p.clientWidth);
    const h = Math.max(100, p.clientHeight);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.canvas.style.width = w + "px";
    this.canvas.style.height = h + "px";
    const scale = Math.min(this.canvas.width / W, this.canvas.height / H);
    this.view = { scale, ox: (this.canvas.width - W * scale) / 2, oy: (this.canvas.height - H * scale) / 2, dpr };
  };

  toWorld(e: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * this.view.dpr;
    const py = (e.clientY - r.top) * this.view.dpr;
    return { x: clamp((px - this.view.ox) / this.view.scale, 0, W - 1), y: clamp((py - this.view.oy) / this.view.scale, 0, H - 1) };
  }

  onDown = (e: PointerEvent) => {
    audio.init();
    audio.startMusic();
    if (this.paused || this.over) return;
    const p = this.toWorld(e);
    this.mouse = p;
    this.mouseIn = true;
    this.padActive = false;
    if (e.button === 2) {
      this.setTool(null);
      return;
    }
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    this.press(p.x, p.y);
  };

  onMove = (e: PointerEvent) => {
    this.mouse = this.toWorld(e);
    this.mouseIn = true;
    this.padActive = false;
  };

  onUp = (e: PointerEvent) => {
    if (this.drag) {
      const p = this.toWorld(e);
      const d = this.drag;
      this.drag = null;
      let dx = p.x - d.x;
      let dy = p.y - d.y;
      const len = Math.hypot(dx, dy);
      if (len < 24) {
        dx = -1;
        dy = 0;
      } else {
        dx /= len;
        dy /= len;
      }
      this.cast("wind", d.x, d.y, dx, dy);
    }
  };

  onLeave = () => {
    this.mouseIn = false;
  };

  onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
    if (e.repeat && e.key !== "ArrowUp") return;
    const k = e.key.toLowerCase();
    audio.init();
    audio.startMusic();
    if (k === "escape" || k === "p") {
      if (!this.over) this.setPaused(!this.paused);
      e.preventDefault();
      return;
    }
    if (this.paused || this.over) return;
    const sp = SPELLS.find((s) => s.key === k);
    if (sp) return this.setTool(this.tool === sp.id ? null : sp.id);
    const st = STRUCTS.find((s) => s.key === k);
    if (st) return this.setTool(this.tool === st.id ? null : st.id);
    if (k === " ") {
      e.preventDefault();
      this.callWave();
    } else if (k === "r") this.rotate();
    else if (k === "u") this.upgrade();
    else if (k === "x" || k === "delete") this.sell();
    else if (k === "q") this.setTool(null);
    else if (k === "f") this.toggleSpeed();
    else if (k === "m") {
      const s = updateSave((d) => {
        d.settings.muted = !d.settings.muted;
      });
      audio.setVolumes(s.settings);
      this.toast(s.settings.muted ? "Sound muted" : "Sound on");
    }
  };

  // ---------- control api ----------
  setPaused(v: boolean) {
    if (this.over) return;
    this.paused = v;
    this.drag = null;
    if (v) audio.setAmbient(0, 0);
    this.emitHud();
  }

  toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    this.toast(this.speed === 2 ? "Fast forward x2" : "Normal speed");
  }

  setDifficulty(id: string) {
    const d = DIFFICULTIES.find((x) => x.id === id);
    if (d) {
      this.diff = d;
      this.toast("Difficulty: " + d.name);
      this.emitHud();
    }
  }

  spellUnlocked(id: SpellId) {
    const d = SPELLS.find((s) => s.id === id)!;
    return !d.unlock || this.perks.has(d.unlock);
  }

  structUnlocked(id: StructId) {
    const d = STRUCTS.find((s) => s.id === id)!;
    return !d.unlock || this.perks.has(d.unlock);
  }

  setTool(t: ToolId | null) {
    if (t) {
      const isSpell = SPELLS.some((s) => s.id === t);
      const ok = isSpell ? this.spellUnlocked(t as SpellId) : this.structUnlocked(t as StructId);
      if (!ok) {
        this.toast("Locked: unlock it in the Research tree");
        audio.deny();
        return;
      }
      this.selStruct = null;
    }
    this.tool = t;
    this.drag = null;
    audio.click();
    this.emitHud();
  }

  cycleTool(dir: number) {
    const list: ToolId[] = [...SPELLS.filter((s) => this.spellUnlocked(s.id)).map((s) => s.id), ...STRUCTS.filter((s) => this.structUnlocked(s.id)).map((s) => s.id)];
    if (!list.length) return;
    const i = this.tool ? list.indexOf(this.tool) : -1;
    this.setTool(list[(i + dir + list.length * 2) % list.length]);
  }

  toast(m: string) {
    this.toastMsg = m;
    this.toastT = 2.4;
    this.emitHud();
  }

  press(x: number, y: number) {
    const t = this.tool;
    if (t && SPELLS.some((s) => s.id === t)) {
      if (t === "wind") {
        if (!this.spellUnlocked("wind")) return;
        this.drag = { x, y };
      } else this.cast(t as SpellId, x, y);
      return;
    }
    if (t) {
      this.place(t as StructId, x, y);
      return;
    }
    // no tool: select structures / replant
    const c = clamp(Math.floor(x / CELL), 0, COLS - 1);
    const r = clamp(Math.floor(y / CELL), 0, ROWS - 1);
    const i = r * COLS + c;
    const s = this.structAt[i];
    if (s) {
      this.selStruct = s;
      audio.click();
    } else if (this.cropAt[i] >= 0) {
      const cr = this.crops[this.cropAt[i]];
      if (!cr.alive) {
        if (this.gold >= 25) {
          this.gold -= 25;
          cr.alive = true;
          cr.hp = cr.maxhp * 0.6;
          cr.growth = 0;
          this.fuel[i] = Math.max(this.fuel[i], 0.6);
          this.burst(cr.x, cr.y, 10, "#8fd65a", 60, 0.6, 3);
          this.text(cr.x, cr.y - 14, "Replanted", "#8fd65a", 13);
          audio.build();
        } else {
          this.toast("Need 25 gold to replant");
          audio.deny();
        }
      }
      this.selStruct = null;
    } else this.selStruct = null;
    this.emitHud();
  }

  rotate() {
    const s = this.selStruct;
    if (s && s.id === "fan") {
      s.dir = (s.dir + 1) % 4;
      audio.click();
    } else if (this.tool === "fan") {
      this.ghostDir = (this.ghostDir + 1) % 4;
      audio.click();
    }
    this.emitHud();
  }
  ghostDir = 2;

  upgradeCost(s: Struct) {
    const d = STRUCTS.find((x) => x.id === s.id)!;
    return s.lvl >= 3 ? 0 : Math.round(d.cost * (s.lvl === 1 ? 0.7 : 1.1));
  }

  upgrade() {
    const s = this.selStruct;
    if (!s) return;
    if (s.lvl >= 3) {
      this.toast("Already max level");
      return;
    }
    const c = this.upgradeCost(s);
    if (this.gold < c) {
      this.toast("Need " + c + " gold");
      audio.deny();
      return;
    }
    this.gold -= c;
    s.spent += c;
    s.lvl++;
    audio.build();
    this.burst(s.x, s.y, 14, "#ffe45e", 90, 0.7, 3);
    this.text(s.x, s.y - 20, "Level " + s.lvl, "#ffe45e", 14);
    this.emitHud();
  }

  sell() {
    const s = this.selStruct;
    if (!s) return;
    this.gold += Math.floor(s.spent * 0.6);
    this.structs = this.structs.filter((x) => x !== s);
    this.structAt[s.r * COLS + s.c] = null;
    this.text(s.x, s.y - 16, "+" + Math.floor(s.spent * 0.6), "#ffd75e", 14);
    this.selStruct = null;
    audio.sell();
    this.emitHud();
  }

  canPlace(c: number, r: number) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false;
    const i = r * COLS + c;
    return this.cropAt[i] < 0 && !this.structAt[i];
  }

  place(id: StructId, x: number, y: number) {
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    const d = STRUCTS.find((s) => s.id === id)!;
    if (!this.canPlace(c, r)) {
      this.toast("Can't build there");
      audio.deny();
      return;
    }
    if (this.gold < d.cost) {
      this.toast("Need " + d.cost + " gold");
      audio.deny();
      return;
    }
    this.gold -= d.cost;
    const s: Struct = { id, c, r, x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, lvl: 1, cd: 1.5, dir: id === "fan" ? this.ghostDir : 0, charge: 0, spent: d.cost, spin: 0 };
    this.structs.push(s);
    this.structAt[r * COLS + c] = s;
    audio.build();
    this.burst(s.x, s.y, 16, d.color, 100, 0.7, 3);
    this.ring(s.x, s.y, d.color, 40);
    if (this.tutorial && this.tutStep === 3 && id === "rod") this.advanceTut(3);
    this.emitHud();
  }

  // ---------- helpers ----------
  cellIdx(x: number, y: number) {
    return clamp(Math.floor(y / CELL), 0, ROWS - 1) * COLS + clamp(Math.floor(x / CELL), 0, COLS - 1);
  }

  burst(x: number, y: number, n: number, color: string, spd: number, life: number, size: number, grav = 0) {
    for (let i = 0; i < n && this.parts.length < 1600; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random() * 0.6), color, grav, kind: 0 });
    }
  }

  ring(x: number, y: number, color: string, size: number) {
    if (this.parts.length < 1600) this.parts.push({ x, y, vx: 0, vy: 0, life: 0.5, max: 0.5, size, color, grav: 0, kind: 2 });
  }

  streak(x: number, y: number, vx: number, vy: number, color: string, life: number, size = 1.5) {
    if (this.parts.length < 1600) this.parts.push({ x, y, vx, vy, life, max: life, size, color, grav: 0, kind: 1 });
  }

  text(x: number, y: number, text: string, color: string, size = 14) {
    if (this.texts.length > 80) this.texts.shift();
    this.texts.push({ x: x + rnd(-6, 6), y, text, life: 1.3, max: 1.3, color, size });
  }

  addShake(v: number) {
    if (getSave().settings.shake) this.shake = Math.min(18, this.shake + v);
  }

  addGold(n: number, x?: number, y?: number) {
    const g = Math.round(n);
    this.gold += g;
    this.stats.gold += g;
    if (x !== undefined && y !== undefined) this.text(x, y, "+" + g + "g", "#ffd75e", 13);
  }

  grounded(x: number, y: number) {
    for (const s of this.structs) if (s.id === "rod" && Math.hypot(s.x - x, s.y - y) < CELL * 2.3) return true;
    return false;
  }

  sampleWind(x: number, y: number) {
    const i = this.cellIdx(x, y);
    this.wvx = this.gw.x + this.wx[i];
    this.wvy = this.gw.y + this.wy[i];
  }

  react(name: string, pts: number, x: number, y: number, color = "#ffe45e") {
    const now = this.time;
    if ((this.reactCd[name] || 0) > now) return;
    this.reactCd[name] = now + 0.8;
    this.combo++;
    this.comboT = this.perks.comboWindow;
    this.stats.reactions++;
    this.stats.tally[name] = (this.stats.tally[name] || 0) + 1;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;
    this.score += Math.round(pts * (1 + this.combo * 0.1));
    this.mana = Math.min(this.perks.maxMana, this.mana + 3);
    this.text(x, y - 24, name + (this.combo > 1 ? " x" + this.combo : "!"), color, 16 + Math.min(8, this.combo));
    this.ring(x, y, color, 70);
    audio.combo(this.combo);
  }

  // ---------- spells ----------
  cast(id: SpellId, x: number, y: number, dx = -1, dy = 0) {
    const def = SPELLS.find((s) => s.id === id)!;
    if (!this.spellUnlocked(id)) return;
    if (this.cd[id] > 0) {
      audio.deny();
      return;
    }
    if (this.mana < def.cost) {
      this.toast("Not enough Aether");
      audio.deny();
      return;
    }
    this.mana -= def.cost;
    this.cd[id] = def.cd * (id === "bolt" ? this.perks.boltCd : 1);
    this.score += 1;
    switch (id) {
      case "rain": {
        const r = CELL * 2.2 * this.perks.cloudMul;
        const life = 8 * (this.perks.cloudMul > 1 ? 1.25 : 1);
        this.clouds.push({ x, y, r, life, max: life, kind: "rain", vx: 0, vy: 0, t: 1, seed: Math.random() * 100, flash: 0, nat: false });
        audio.rain();
        this.ring(x, y, "#5aa9ff", r * 0.8);
        if (this.tutorial && this.tutStep === 0) this.advanceTut(0);
        break;
      }
      case "wind": {
        this.gusts.push({ x, y, dx, dy, life: 1.05, r: CELL * 1.5, fired: false });
        audio.gust();
        this.addShake(1.5);
        if (this.tutorial && this.tutStep === 1) this.advanceTut(1);
        break;
      }
      case "bolt": {
        this.strike(x, y, "player", 55 * this.perks.boltMul);
        if (this.tutorial && this.tutStep === 2) this.advanceTut(2);
        break;
      }
      case "heat": {
        const r = CELL * 2.3;
        this.zones.push({ x, y, r, target: 1, str: 1.5, life: 5, max: 5, kind: "heat" });
        audio.heat();
        this.ring(x, y, "#ff8a3d", r);
        this.addShake(2);
        let wetN = 0;
        this.eachCell(x, y, r, (j, w) => {
          if (this.wet[j] > 0.2) {
            wetN++;
            this.steam[j] = Math.min(1.2, this.steam[j] + this.wet[j] * 0.8 * w);
            this.wet[j] *= 0.45;
          }
          this.temp[j] = Math.min(1, this.temp[j] + 0.35 * w);
          this.ice[j] *= 0.3;
        });
        for (const c of this.clouds) if (Math.hypot(c.x - x, c.y - y) < r) {
          c.life -= 2.5;
          this.steam[this.cellIdx(c.x, c.y)] += 0.6;
        }
        for (const p of this.pests) if (!p.dead && Math.hypot(p.x - x, p.y - y) < r) this.hurt(p, 8, "burn");
        if (wetN >= 3) {
          this.react("STEAM BURST", 25, x, y, "#ffd0a0");
          audio.steam();
        }
        break;
      }
      case "frost": {
        const r = CELL * 2.3;
        this.zones.push({ x, y, r, target: 0, str: 1.6, life: 5, max: 5, kind: "frost" });
        audio.frost();
        this.ring(x, y, "#9fe3ff", r);
        this.addShake(1);
        let wetN = 0;
        this.eachCell(x, y, r, (j, w) => {
          if (this.wet[j] > 0.2) {
            wetN++;
            this.ice[j] = Math.min(1.2, this.ice[j] + this.wet[j] * 1.2 * w);
            this.wet[j] *= 0.2;
          }
          this.temp[j] = Math.max(0, this.temp[j] - 0.4 * w);
          this.fire[j] = 0;
        });
        for (const c of this.clouds) if (Math.hypot(c.x - x, c.y - y) < r && c.kind !== "hail") {
          c.kind = "hail";
          c.life = Math.max(c.life, 5);
          c.max = Math.max(c.max, c.life);
          this.react("HAILSTORM", 30, c.x, c.y, "#bfeaff");
        }
        let chilled = 0;
        for (const p of this.pests) if (!p.dead && Math.hypot(p.x - x, p.y - y) < r) {
          p.chill += 0.55;
          chilled++;
        }
        if (wetN >= 2 && chilled > 0) this.react("FLASH FREEZE", 25, x, y, "#9fe3ff");
        break;
      }
    }
    this.emitHud();
  }

  eachCell(x: number, y: number, r: number, fn: (j: number, w: number) => void) {
    const c0 = clamp(Math.floor((x - r) / CELL), 0, COLS - 1);
    const c1 = clamp(Math.floor((x + r) / CELL), 0, COLS - 1);
    const r0 = clamp(Math.floor((y - r) / CELL), 0, ROWS - 1);
    const r1 = clamp(Math.floor((y + r) / CELL), 0, ROWS - 1);
    for (let rr = r0; rr <= r1; rr++)
      for (let cc = c0; cc <= c1; cc++) {
        const d = Math.hypot(cc * CELL + CELL / 2 - x, rr * CELL + CELL / 2 - y);
        if (d < r) fn(rr * COLS + cc, 1 - d / r * 0.7);
      }
  }

  strike(x: number, y: number, src: "player" | "rod" | "storm" | "cloud", dmg: number) {
    let tx = clamp(x, 4, W - 4);
    let ty = clamp(y, 4, H - 4);
    let redirected = false;
    if (src === "storm") {
      let best: Struct | null = null;
      let bd = CELL * 6;
      for (const s of this.structs) if (s.id === "rod") {
        const d = Math.hypot(s.x - tx, s.y - ty);
        if (d < bd) {
          bd = d;
          best = s;
        }
      }
      if (best) {
        tx = best.x;
        ty = best.y - 6;
        best.charge = Math.min(3, best.charge + 1);
        redirected = true;
        this.text(best.x, best.y - 26, "Rod charged!", "#ffe45e", 12);
      }
    }
    const big = src === "player" || src === "storm";
    this.addBolt(tx, ty, big ? "#fff7b0" : "#d8f0ff");
    this.addShake(big ? 6 : 2);
    this.flash = Math.max(this.flash, big ? 0.45 : 0.15);
    audio.bolt(big);
    this.burst(tx, ty, big ? 18 : 8, "#fff3a0", 160, 0.5, 2.5);
    if (redirected) return;
    const ci = this.cellIdx(tx, ty);
    // direct hits
    for (const p of this.pests) if (!p.dead && Math.hypot(p.x - tx, p.y - ty) < CELL * 0.8) this.hurt(p, dmg, "shock");
    // stormcell
    if (src === "player") {
      for (const c of this.clouds) if (c.kind !== "storm" && Math.hypot(c.x - tx, c.y - ty) < c.r) {
        c.kind = "storm";
        c.life = Math.max(c.life, c.max * 0.7) + 3;
        c.max = Math.max(c.max, c.life);
        c.flash = 1;
        c.t = 0.3;
        this.react("STORMCELL", 40, c.x, c.y, "#c9a8ff");
      }
    }
    // shatter
    let shat = false;
    if (this.ice[ci] > 0.25) {
      const q = [ci];
      const seen = new Set<number>([ci]);
      while (q.length && seen.size < 14) {
        const j = q.shift()!;
        const jc = j % COLS;
        const jr = Math.floor(j / COLS);
        this.ice[j] = 0;
        this.wet[j] = Math.min(1, this.wet[j] + 0.25);
        this.burst(jc * CELL + CELL / 2, jr * CELL + CELL / 2, 8, "#dff6ff", 130, 0.6, 2.5, 120);
        for (const p of this.pests) if (!p.dead && Math.hypot(p.x - (jc * CELL + CELL / 2), p.y - (jr * CELL + CELL / 2)) < CELL * 0.9) this.hurt(p, 38 * this.perks.boltMul, "shatter");
        for (const [dc, dr] of DIRS) {
          const nc = jc + dc;
          const nr = jr + dr;
          if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
          const n = nr * COLS + nc;
          if (!seen.has(n) && this.ice[n] > 0.25) {
            seen.add(n);
            q.push(n);
          }
        }
      }
      shat = true;
    }
    for (const p of this.pests) if (!p.dead && p.frozen > 0 && Math.hypot(p.x - tx, p.y - ty) < CELL * 2.2) {
      this.hurt(p, 38 * this.perks.boltMul, "shatter");
      p.frozen = 0;
      p.immune = 2;
      this.burst(p.x, p.y, 12, "#dff6ff", 140, 0.6, 2.5, 120);
      shat = true;
    }
    if (shat) {
      audio.shatter();
      this.react("SHATTER", 45, tx, ty, "#bfeaff");
    }
    // ignite
    if (src !== "rod" && this.fuel[ci] > 0.3 && this.wet[ci] < 0.2 && this.ice[ci] < 0.1 && !this.grounded(tx, ty)) {
      this.fire[ci] = Math.max(this.fire[ci], 0.5);
      audio.fire();
      this.text(tx, ty - 10, "Ignited!", "#ff9a4d", 12);
    }
    // chain
    const maxD = (src === "player" ? 4 + this.perks.chain : src === "rod" ? 3 + Math.floor(this.perks.chain / 2) : 2);
    const seen = new Map<number, number>([[ci, 0]]);
    const q: number[] = [ci];
    let reached = 0;
    while (q.length) {
      const j = q.shift()!;
      const d = seen.get(j)!;
      const jc = j % COLS;
      const jr = Math.floor(j / COLS);
      const cx = jc * CELL + CELL / 2;
      const cy = jr * CELL + CELL / 2;
      if (j !== ci) {
        reached++;
        this.charge[j] = 1;
        const cd = dmg * 0.7 * Math.pow(0.9, d) * Math.min(1, this.wet[j] + 0.3);
        for (const p of this.pests) {
          if (p.dead) continue;
          if (this.cellIdx(p.x, p.y) !== j) continue;
          const def = PESTS[p.kind];
          if (def.fly && p.soak <= 0) continue;
          this.hurt(p, cd, "shock");
        }
        const ci2 = this.cropAt[j];
        if (ci2 >= 0 && this.crops[ci2].alive && !this.grounded(cx, cy)) {
          const cr = this.crops[ci2];
          cr.hp -= 5;
          cr.flash = 0.3;
          this.checkCrop(cr);
        }
      }
      if (d >= maxD) continue;
      for (const [dc, dr] of DIRS) {
        const nc = jc + dc;
        const nr = jr + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const n = nr * COLS + nc;
        if (seen.has(n)) continue;
        if (this.wet[n] > 0.3 || this.ice[n] > 0.4) {
          seen.set(n, d + 1);
          q.push(n);
          this.arcs.push({ pts: this.jag(cx, cy, nc * CELL + CELL / 2, nr * CELL + CELL / 2, 3), life: 0.25, max: 0.25, color: "#fff7b0", w: 2 });
        }
      }
    }
    if (reached >= 3 && src !== "cloud") {
      this.react("CHAIN SHOCK", 20 + reached * 4, tx, ty, "#ffe45e");
    }
  }

  jag(x1: number, y1: number, x2: number, y2: number, n: number) {
    const pts = [[x1, y1]];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push([x1 + (x2 - x1) * t + rnd(-7, 7), y1 + (y2 - y1) * t + rnd(-7, 7)]);
    }
    pts.push([x2, y2]);
    return pts;
  }

  addBolt(x: number, y: number, color: string) {
    this.arcs.push({ pts: this.jag(x + rnd(-30, 30), -20, x, y, 8), life: 0.3, max: 0.3, color, w: 3.5 });
  }

  // ---------- damage ----------
  hurt(p: Pest, amt: number, type: "shock" | "burn" | "hail" | "scald" | "shatter" | "rod") {
    if (p.dead || amt <= 0) return;
    const d = PESTS[p.kind];
    if (d.burrow && !p.exposed) return;
    let m = 1;
    if (type === "shock" || type === "rod") m = d.shock * (p.frozen > 0 ? 1.5 : 1) * (!d.fly && this.wet[this.cellIdx(p.x, p.y)] > 0.5 ? 1.15 : 1);
    else if (type === "burn") m = d.burn;
    else if (type === "hail") m = d.hail;
    else if (type === "scald") m = d.scald;
    else if (type === "shatter") m = p.frozen > 0 ? d.shatter * 1.5 : d.shatter * 0.7;
    const dmg = amt * m;
    p.hp -= dmg;
    p.hit = 1;
    p.dmgAcc += dmg;
    const instant = type === "shock" || type === "shatter" || type === "rod";
    if (instant || p.dmgAcc > 12) {
      if (p.dmgAcc >= 3) this.text(p.x, p.y - PESTS[p.kind].r - 8, String(Math.round(p.dmgAcc)), type === "shatter" ? "#bfeaff" : type === "burn" ? "#ff9a4d" : type === "shock" ? "#fff3a0" : "#ffffff", instant ? 13 : 11);
      p.dmgAcc = 0;
    }
    if (instant) audio.hit();
    if (p.hp <= 0) this.killPest(p);
  }

  killPest(p: Pest) {
    if (p.dead) return;
    p.dead = true;
    const d = PESTS[p.kind];
    this.stats.kills++;
    const bounty = d.bounty * this.diff.gold * (this.modOn("iron") ? 1.3 : 1) * (1 + Math.min(this.combo, 25) * 0.015);
    this.addGold(bounty, p.x, p.y - 8);
    this.score += Math.round(d.bounty * 4);
    this.burst(p.x, p.y, d.boss ? 50 : 8, d.boss ? "#ffcf6a" : "#9ad06a", d.boss ? 280 : 90, d.boss ? 1.2 : 0.5, d.boss ? 5 : 2.5, 60);
    audio.kill(!!d.boss);
    if (d.boss) {
      this.bossKills++;
      this.addShake(16);
      this.flash = 0.7;
      this.text(p.x, p.y - 40, d.name + " defeated!", "#ffd75e", 24);
      this.ring(p.x, p.y, "#ffd75e", 180);
    }
  }

  checkCrop(cr: Crop) {
    if (cr.alive && cr.hp <= 0) {
      cr.alive = false;
      cr.hp = 0;
      this.stats.cropsLost++;
      this.lostThisWave++;
      this.text(cr.x, cr.y - 12, "Crop lost!", "#ff6a5a", 15);
      this.burst(cr.x, cr.y, 12, "#7a5a3a", 90, 0.7, 3, 80);
      this.addShake(3);
      audio.alarm();
    }
  }

  aliveCrops() {
    let n = 0;
    for (const c of this.crops) if (c.alive) n++;
    return n;
  }

  // ---------- waves ----------
  pickEvent() {
    const k = ["drizzle", "heatwave", "coldsnap", "thunder", "gale"];
    return k[Math.floor(Math.random() * k.length)];
  }

  buildWave(n: number): QItem[] {
    const list: QItem[] = [];
    const kinds = (Object.keys(PESTS) as PestKind[]).filter((k) => !PESTS[k].boss && PESTS[k].unlockWave <= n);
    const weights = kinds.map((k) => (k === "aphid" ? 4 : 3) * (PESTS[k].unlockWave >= n - 1 && n > 1 ? 2 : 1));
    const boss = n % 6 === 0;
    let budget = (6 + n * 5) * this.diff.count * (this.modOn("swarm") ? 1.4 : 1) * (boss ? 0.7 : 1);
    const D = 16 + n * 0.9;
    if (boss) {
      const isTitan = (n / 6) % 2 === 1;
      list.push({ t: 2, kind: isTitan ? "titan" : "queen" });
    }
    let guard = 0;
    while (budget > 0 && guard++ < 400) {
      let tot = 0;
      for (const w of weights) tot += w;
      let rr = Math.random() * tot;
      let ki = 0;
      for (let i = 0; i < kinds.length; i++) {
        rr -= weights[i];
        if (rr <= 0) {
          ki = i;
          break;
        }
      }
      let k = kinds[ki];
      if (PESTS[k].cost > budget + 2) k = "aphid";
      const base = rnd(0, D);
      const pack = k === "aphid" ? 4 : k === "locust" ? 3 : 1;
      for (let i = 0; i < pack; i++) list.push({ t: base + i * 0.25, kind: k });
      budget -= PESTS[k].cost;
    }
    list.sort((a, b) => a.t - b.t);
    return list;
  }

  callWave() {
    if (this.waveState !== "prep") {
      this.toast("A wave is already underway");
      return;
    }
    if (this.tutorial && this.tutStep < TUTORIAL.length - 1) {
      this.toast("Finish the tutorial steps, or press Skip");
      audio.deny();
      return;
    }
    if (this.prepT > 5 && this.prepT < 9000) {
      const bonus = Math.floor(this.prepT * 1.2);
      this.addGold(bonus, W / 2, 90);
      this.text(W / 2, 120, "Early call bonus!", "#ffd75e", 16);
    }
    this.startWave();
  }

  startWave() {
    this.wave++;
    this.waveState = "active";
    this.waveT = 0;
    this.lostThisWave = 0;
    this.queue = this.nextQueue.length ? this.nextQueue : this.buildWave(this.wave);
    this.nextQueue = [];
    audio.horn();
    this.addShake(4);
    const boss = this.queue.some((q) => PESTS[q.kind].boss);
    this.banner = boss ? "BOSS WAVE " + this.wave : "WAVE " + this.wave;
    this.bannerT = 2.6;
    if (boss) audio.boss();
    if (this.tutorial) this.finishTutorial();
  }
  banner = "";
  bannerT = 0;

  spawnPest(kind: PestKind, x?: number, y?: number) {
    const d = PESTS[kind];
    let px = x ?? -14;
    let py = y ?? rnd(24, H - 24);
    if (x === undefined && d.fly && Math.random() < 0.4) {
      px = rnd(0, W * 0.6);
      py = -14;
    }
    let hpMul = this.diff.hp * (1 + 0.08 * (Math.max(1, this.wave) - 1)) * (this.modOn("iron") ? 1.5 : 1) * (this.modOn("swarm") ? 0.8 : 1);
    if (d.boss) hpMul = this.diff.hp * (this.modOn("iron") ? 1.5 : 1) * (1 + 0.04 * Math.max(0, this.wave - 6));
    if (this.tutorial && this.wave === 0) hpMul = 0.7;
    const hp = d.hp * hpMul;
    const p: Pest = {
      id: this.nextId++, kind, x: px, y: py, hp, maxhp: hp, chill: 0, frozen: 0, immune: 0, burn: 0, soak: 0, hit: 0, age: 0,
      target: -1, retarget: 0, eat: 0, summon: 4, stomp: 5, phase: 1, exposed: !d.burrow, dead: false, dmgAcc: 0, bob: Math.random() * 6, hpMul,
    };
    this.pickTarget(p, true);
    this.pests.push(p);
    return p;
  }

  pickTarget(p: Pest, randomize = false) {
    const list: { i: number; d: number }[] = [];
    for (let i = 0; i < this.crops.length; i++) {
      const c = this.crops[i];
      if (c.alive) list.push({ i, d: Math.hypot(c.x - p.x, c.y - p.y) });
    }
    if (!list.length) {
      p.target = -1;
      return;
    }
    list.sort((a, b) => a.d - b.d);
    p.target = list[randomize ? Math.floor(Math.random() * Math.min(4, list.length)) : 0].i;
  }

  waveClear() {
    this.waveState = "prep";
    const boss = this.wave % 6 === 0;
    const reward = 30 + 6 * this.wave;
    this.addGold(reward * this.diff.gold, W / 2, 100);
    this.mana = Math.min(this.perks.maxMana, this.mana + 35);
    let seeds = 1 + (boss ? 3 : 0);
    if (this.lostThisWave === 0) {
      seeds += 0;
      this.text(W / 2, 140, "Flawless defense! +bonus gold", "#8fd65a", 16);
      this.addGold(15 + this.wave * 3);
    }
    this.seedsEarned += seeds;
    this.score += 100 * this.wave;
    this.banner = "WAVE " + this.wave + " CLEARED";
    this.bannerT = 2.4;
    this.prepT = 20;
    this.nextQueue = this.buildWave(this.wave + 1);
    this.addShake(2);
    audio.win();
    if (this.wave >= WIN_WAVE && !this.endless && !this.over) {
      this.endGame("victory");
    }
  }

  continueEndless() {
    if (this.over !== "victory") return;
    this.over = null;
    this.endless = true;
    this.summary = null;
    this.toast("Endless season: how long can you hold?");
    this.emitHud();
  }

  calcSeeds() {
    const modBonus = this.mods.reduce((a, id) => a + (MODIFIERS.find((m) => m.id === id)?.seed || 0), 0);
    const s = (this.seedsEarned + (this.stats.reactions >= 12 ? Math.floor(this.stats.reactions / 12) : 0) + (this.over === "victory" || this.endless ? 6 : 0)) * this.diff.seed * (1 + modBonus);
    return Math.floor(s);
  }

  endGame(kind: "victory" | "gameover") {
    this.over = kind;
    this.drag = null;
    const total = this.calcSeeds();
    const gain = Math.max(0, total - this.banked);
    this.banked = total;
    const firstRun = !this.runCounted;
    this.runCounted = true;
    const wavesDone = kind === "victory" ? this.wave : Math.max(0, this.wave - (this.waveState === "active" ? 1 : 0));
    const dk = this.stats.kills - this.bankedKills;
    const dr = this.stats.reactions - this.bankedReact;
    this.bankedKills = this.stats.kills;
    this.bankedReact = this.stats.reactions;
    updateSave((s) => {
      s.seeds += gain;
      s.bestWave = Math.max(s.bestWave, wavesDone);
      s.bestScore = Math.max(s.bestScore, Math.round(this.score));
      if (firstRun) s.runs++;
      if (kind === "victory") s.wins++;
      s.kills += dk;
      s.reactions += dr;
      s.tutorialDone = true;
    });
    const ss = this.stats;
    this.summary = {
      time: this.time, waves: wavesDone, kills: ss.kills, harvested: ss.harvested, gold: ss.gold, cropsLost: ss.cropsLost,
      reactions: ss.reactions, maxCombo: ss.maxCombo, score: Math.round(this.score), seeds: gain, bossKills: this.bossKills, tally: { ...ss.tally }, won: kind === "victory",
    };
    audio.setAmbient(0, 0);
    if (kind === "victory") audio.win();
    else audio.lose();
    this.emitHud();
  }
  bankedKills = 0;
  bankedReact = 0;

  // ---------- tutorial ----------
  advanceTut(from: number) {
    if (!this.tutorial || this.tutStep !== from) return;
    this.tutStep++;
    audio.combo(this.tutStep * 2);
    if (this.tutStep === 1 || this.tutStep === 2) this.trainingPests();
    if (this.tutStep === 3) this.gold = Math.max(this.gold, 100);
    this.emitHud();
  }

  trainingPests() {
    if (this.pests.length > 0) return;
    for (let i = 0; i < 4; i++) this.spawnPest("aphid", 10 + i * 18, 150 + i * 70);
  }

  skipTutorial() {
    this.finishTutorial();
    this.prepT = Math.min(this.prepT, 12);
    this.emitHud();
  }

  finishTutorial() {
    if (!this.tutorial) return;
    this.tutorial = false;
    if (this.prepT > 9000) this.prepT = 12;
    updateSave((s) => {
      s.tutorialDone = true;
    });
  }

  // ---------- main loop ----------
  loop = (now: number) => {
    if (this.dead) return;
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!isFinite(dt) || dt < 0) dt = 0;
    dt = Math.min(dt, 0.05);
    this.pollPad(dt);
    if (!this.paused && !this.over) {
      for (let k = 0; k < this.speed; k++) this.update(dt);
    } else if (this.over) {
      this.updateFx(dt);
    }
    try {
      render(this);
    } catch {
      /* never kill the loop on a draw error */
    }
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.1;
      this.emitHud();
    }
  };

  update(dt: number) {
    this.time += dt;
    this.dayT = (this.dayT + dt / 140) % 1;
    for (const k of Object.keys(this.cd) as SpellId[]) this.cd[k] = Math.max(0, this.cd[k] - dt);
    if (this.toastT > 0) this.toastT -= dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    for (const k of Object.keys(this.reactCd)) if (this.reactCd[k] < this.time - 5) delete this.reactCd[k];
    this.updateWeather(dt);
    this.updateWindField(dt);
    this.updateStructs(dt);
    this.updateZones(dt);
    this.updateClouds(dt);
    this.stepCells(dt);
    this.updatePests(dt);
    this.updateCrops(dt);
    this.updateWave(dt);
    // combo + mana
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    const vit = this.crops.length ? this.aliveCrops() / this.crops.length : 0;
    this.mana = Math.min(this.perks.maxMana, this.mana + this.perks.regen * this.diff.regen * (0.6 + 0.4 * vit) * (1 + Math.min(this.combo, 25) * 0.03) * dt);
    this.updateFx(dt);
    // audio reactive
    let rain = 0;
    for (const c of this.clouds) rain += (c.r / 120) * 0.35;
    for (const s of this.structs) if (s.id === "sprinkler") rain += 0.08;
    const wind = Math.min(1, Math.hypot(this.gw.x, this.gw.y) / 120 + this.gusts.length * 0.35);
    audio.setAmbient(Math.min(1, rain), wind);
    const base = this.waveState === "active" ? 0.4 + Math.min(0.35, this.pests.length / 45) : 0.12;
    const bossAlive = this.pests.some((p) => PESTS[p.kind].boss && !p.dead);
    audio.setIntensity(base + (bossAlive ? 0.25 : 0) + Math.min(0.15, this.combo * 0.02));
    // lose check
    if (!this.over && this.aliveCrops() <= this.loseAt) {
      this.endGame("gameover");
    }
  }

  updateFx(dt: number) {
    this.shake = Math.max(0, this.shake - dt * 28);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.parts[i] = this.parts[this.parts.length - 1];
        this.parts.pop();
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 0) {
        p.vx *= 1 - dt * 1.2;
        p.vy *= 1 - dt * 1.2;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 26 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.arcs.length - 1; i >= 0; i--) {
      this.arcs[i].life -= dt;
      if (this.arcs[i].life <= 0) this.arcs.splice(i, 1);
    }
  }

  // ---------- weather ----------
  ambient() {
    const day = 0.5 + 0.5 * Math.sin(this.dayT * Math.PI * 2 + 0.2);
    return 0.5 + this.tempOff + (day - 0.5) * 0.1;
  }

  day() {
    return 0.5 + 0.5 * Math.sin(this.dayT * Math.PI * 2 + 0.2);
  }

  eventName(k: string) {
    return ({ drizzle: "Passing Drizzle", heatwave: "Heat Wave", coldsnap: "Cold Snap", thunder: "Thunderstorm", gale: "Gale Winds" } as Record<string, string>)[k] || k;
  }

  updateWeather(dt: number) {
    if (!this.tutorial && this.wave >= 1 || (!this.tutorial && this.time > 45)) {
      if (!this.event) {
        this.nextEvent.t -= dt;
        if (this.nextEvent.t <= 0) this.startEvent(this.nextEvent.kind);
      }
    }
    let target = 0;
    this.gwTarget.x = 0;
    this.gwTarget.y = 0;
    this.breezeT -= dt;
    if (this.breezeT <= 0) {
      this.breezeT = rnd(10, 22);
      const a = rnd(0, Math.PI * 2);
      this.breezeV = { x: Math.cos(a) * rnd(0, 22), y: Math.sin(a) * rnd(0, 14) };
    }
    this.gwTarget.x = this.breezeV.x;
    this.gwTarget.y = this.breezeV.y;
    if (this.event) {
      const e = this.event;
      e.t += dt;
      if (e.kind === "heatwave") target = 0.3;
      if (e.kind === "coldsnap") target = -0.36;
      if (e.kind === "gale") {
        this.gwTarget.x = this.galeV.x;
        this.gwTarget.y = this.galeV.y;
      }
      if (e.t >= e.dur) {
        this.event = null;
        this.text(W / 2, 80, "The weather settles.", "#cfe8ff", 15);
      }
    }
    this.tempOff += (target - this.tempOff) * Math.min(1, dt * 0.9);
    this.gw.x += (this.gwTarget.x - this.gw.x) * Math.min(1, dt * 1.2);
    this.gw.y += (this.gwTarget.y - this.gw.y) * Math.min(1, dt * 1.2);
  }
  breezeV = { x: 0, y: 0 };
  galeV = { x: -70, y: 0 };

  startEvent(kind: string) {
    const dur = kind === "drizzle" ? 3 : kind === "thunder" ? 3 : kind === "gale" ? 12 : kind === "heatwave" ? 15 : 13;
    this.event = { kind, t: 0, dur };
    this.nextEvent = { kind: this.pickEvent(), t: this.diff.evt * rnd(0.8, 1.25) };
    audio.event();
    this.banner = this.eventName(kind).toUpperCase();
    this.bannerT = 2.2;
    this.addShake(2);
    if (kind === "drizzle") {
      this.clouds.push({ x: -120, y: rnd(120, H - 120), r: 120, life: 18, max: 18, kind: "rain", vx: 26, vy: rnd(-4, 4), t: 1, seed: Math.random() * 100, flash: 0, nat: true });
    } else if (kind === "thunder") {
      this.clouds.push({ x: -140, y: rnd(150, H - 150), r: 135, life: 17, max: 17, kind: "storm", vx: 24, vy: rnd(-4, 4), t: 1.5, seed: Math.random() * 100, flash: 0, nat: true });
    } else if (kind === "gale") {
      const a = Math.random() < 0.6 ? Math.PI + rnd(-0.5, 0.5) : rnd(0, Math.PI * 2);
      this.galeV = { x: Math.cos(a) * 85, y: Math.sin(a) * 60 };
    }
  }

  updateWindField(dt: number) {
    const k = Math.exp(-2.4 * dt);
    for (let i = 0; i < this.N; i++) {
      this.wx[i] *= k;
      this.wy[i] *= k;
    }
    for (const s of this.structs) {
      if (s.id !== "fan") continue;
      s.spin += dt * (8 + s.lvl * 3);
      const [dx, dy] = DIRS[s.dir];
      const len = 3 + s.lvl;
      const sp = 120 + 40 * s.lvl;
      for (let t = 1; t <= len; t++)
        for (let o = -1; o <= 1; o++) {
          const c = s.c + dx * t + (dy !== 0 ? o : 0);
          const r = s.r + dy * t + (dx !== 0 ? o : 0);
          if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
          const i = r * COLS + c;
          const f = o === 0 ? 1 : 0.6;
          this.wx[i] = dx * sp * f;
          this.wy[i] = dy * sp * f;
        }
      if (Math.random() < dt * 8) this.streak(s.x + dx * 20, s.y + dy * 20, dx * 220, dy * 220, "rgba(220,255,240,0.6)", 0.4);
    }
    for (let gi = this.gusts.length - 1; gi >= 0; gi--) {
      const g = this.gusts[gi];
      g.life -= dt;
      g.x += g.dx * 380 * dt;
      g.y += g.dy * 380 * dt;
      if (g.life <= 0 || g.x < -100 || g.x > W + 100 || g.y < -100 || g.y > H + 100) {
        this.gusts.splice(gi, 1);
        continue;
      }
      let fires = 0;
      let cold = 0;
      this.eachCell(g.x, g.y, g.r, (j) => {
        this.wx[j] += (g.dx * 340 - this.wx[j]) * Math.min(1, dt * 14);
        this.wy[j] += (g.dy * 340 - this.wy[j]) * Math.min(1, dt * 14);
        if (this.fire[j] > 0.15) fires++;
        if (this.temp[j] < 0.25) cold++;
      });
      for (let i = 0; i < 3; i++) {
        const o = rnd(-g.r, g.r);
        this.streak(g.x - g.dy * o, g.y + g.dx * o, g.dx * 420, g.dy * 420, "rgba(220,255,240,0.7)", 0.35, 1.6);
      }
      if (!g.fired && fires >= 2) {
        g.fired = true;
        for (let k = 1; k <= 4; k++) {
          const gx = g.x + g.dx * CELL * k * 0.9;
          const gy = g.y + g.dy * CELL * k * 0.9;
          if (gx < 0 || gy < 0 || gx >= W || gy >= H) continue;
          const j = this.cellIdx(gx, gy);
          if (this.fuel[j] > 0.3 && this.wet[j] < 0.25 && this.ice[j] < 0.1 && Math.random() < 0.7) this.fire[j] = Math.max(this.fire[j], 0.35);
        }
        this.react("FIRESTORM", 35, g.x, g.y, "#ff9a4d");
      }
      if (!g.fired && cold >= 3) {
        g.fired = true;
        for (const p of this.pests) if (!p.dead && Math.hypot(p.x - g.x, p.y - g.y) < g.r * 1.8) p.chill += 0.8;
        this.react("BLIZZARD", 30, g.x, g.y, "#bfeaff");
      }
    }
  }

  // ---------- structures / zones / clouds ----------
  updateStructs(dt: number) {
    for (const s of this.structs) {
      if (s.id === "sprinkler") {
        const r = CELL * (1.5 + 0.3 * s.lvl);
        const rate = 0.28 + 0.1 * s.lvl;
        this.eachCell(s.x, s.y, r, (j, w) => {
          this.wet[j] = Math.min(1, this.wet[j] + rate * w * dt);
        });
        if (Math.random() < dt * 14) this.streak(s.x + rnd(-r * 0.6, r * 0.6), s.y - 20 + rnd(-10, 10), 0, 150, "rgba(120,190,255,0.8)", 0.35);
      } else if (s.id === "lamp") {
        this.zoneTemp(s.x, s.y, CELL * (1.6 + 0.3 * s.lvl), 0.8 + 0.04 * s.lvl, 1.4, dt);
      } else if (s.id === "spire") {
        this.zoneTemp(s.x, s.y, CELL * (1.8 + 0.3 * s.lvl), 0.0, 1.5, dt);
        if (Math.random() < dt * 6) this.streak(s.x + rnd(-30, 30), s.y + rnd(-30, 30), rnd(-10, 10), 20, "rgba(200,240,255,0.8)", 0.6, 2);
      } else if (s.id === "rod") {
        let wetAvg = 0;
        this.eachCell(s.x, s.y, CELL * 1.6, (j) => {
          wetAvg += this.wet[j];
        });
        wetAvg = Math.min(1.5, wetAvg / 5);
        s.cd -= dt * (1 + wetAvg) * this.perks.rodMul * (1 + 0.3 * (s.lvl - 1));
        if (s.cd <= 0) {
          const range = CELL * (3.6 + 0.5 * s.lvl) * (this.perks.rodMul > 1 ? 1.2 : 1);
          let best: Pest | null = null;
          let bd = range;
          for (const p of this.pests) {
            if (p.dead || (PESTS[p.kind].burrow && !p.exposed)) continue;
            const d = Math.hypot(p.x - s.x, p.y - s.y);
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
          if (best) {
            const mult = s.charge > 0 ? 2.2 : 1;
            if (s.charge > 0) s.charge--;
            this.arcs.push({ pts: this.jag(s.x, s.y - 14, best.x, best.y, 5), life: 0.2, max: 0.2, color: "#fff7b0", w: 2.5 });
            this.strike(best.x, best.y, "rod", (36 + 14 * s.lvl) * this.perks.boltMul * mult);
            s.cd = 3.4;
          } else s.cd = 0.4;
        }
      }
    }
  }

  zoneTemp(x: number, y: number, r: number, target: number, str: number, dt: number) {
    this.eachCell(x, y, r, (j, w) => {
      this.temp[j] += (target - this.temp[j]) * Math.min(1, str * w * dt);
    });
  }

  updateZones(dt: number) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.life -= dt;
      if (z.life <= 0) {
        this.zones.splice(i, 1);
        continue;
      }
      this.zoneTemp(z.x, z.y, z.r, z.target, z.str, dt);
      if (Math.random() < dt * 18) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.random() * z.r;
        const px = z.x + Math.cos(a) * d;
        const py = z.y + Math.sin(a) * d;
        if (z.kind === "heat") this.parts.push({ x: px, y: py, vx: rnd(-8, 8), vy: -50, life: 0.8, max: 0.8, size: 3, color: "rgba(255,150,60,0.7)", grav: 0, kind: 0 });
        else this.parts.push({ x: px, y: py - 10, vx: rnd(-10, 10), vy: 28, life: 0.9, max: 0.9, size: 2.5, color: "rgba(210,245,255,0.85)", grav: 0, kind: 0 });
      }
    }
  }

  updateClouds(dt: number) {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.life -= dt;
      c.flash = Math.max(0, c.flash - dt * 3);
      this.sampleWind(c.x, c.y);
      c.x += (c.vx + this.wvx * 0.55) * dt;
      c.y += (c.vy + this.wvy * 0.55) * dt;
      if (c.life <= 0 || c.x > W + c.r + 80 || c.x < -c.r - 300 || c.y < -c.r - 80 || c.y > H + c.r + 80) {
        this.clouds.splice(i, 1);
        continue;
      }
      const fade = Math.min(1, c.life / 1.2, (c.max - c.life) / 0.6 + 0.2);
      const rate = (c.kind === "rain" ? 0.55 : c.kind === "storm" ? 0.65 : 0.22) * fade;
      this.eachCell(c.x, c.y, c.r, (j, w) => {
        this.wet[j] = Math.min(1, this.wet[j] + rate * w * dt);
        if (c.kind === "hail") this.temp[j] = Math.max(0, this.temp[j] - 0.3 * w * dt);
      });
      if (c.kind === "hail") {
        for (const p of this.pests) if (!p.dead && Math.hypot(p.x - c.x, p.y - c.y) < c.r) {
          this.hurt(p, 15 * dt, "hail");
          p.chill += 0.35 * dt;
        }
      }
      if (c.kind === "storm") {
        c.t -= dt;
        if (c.t <= 0) {
          c.t = rnd(0.9, 1.6);
          const inside = this.pests.filter((p) => !p.dead && (!PESTS[p.kind].burrow || p.exposed) && Math.hypot(p.x - c.x, p.y - c.y) < c.r);
          c.flash = 1;
          if (inside.length) {
            const p = inside[Math.floor(Math.random() * inside.length)];
            this.strike(p.x, p.y, "cloud", 40 * this.perks.boltMul);
          } else if (c.nat) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * c.r * 0.9;
            this.strike(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, "storm", 40);
          }
        }
      }
      // heat evaporates cloud
      const ci = this.cellIdx(c.x, c.y);
      if (this.temp[ci] > 0.85) c.life -= dt * 2;
      if (Math.random() < dt * 40 * (c.r / 100)) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * c.r;
        const col = c.kind === "hail" ? "rgba(235,250,255,0.9)" : "rgba(130,190,255,0.8)";
        this.streak(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d - 14, c.kind === "hail" ? 0 : -10, c.kind === "hail" ? 170 : 220, col, 0.3, c.kind === "hail" ? 2.5 : 1.3);
      }
    }
  }

  // ---------- cell simulation ----------
  diffuse(a: Float32Array, k: number, dt: number) {
    const b = this.buf;
    const f = Math.min(0.24, k * dt);
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const v = a[i];
        const l = c > 0 ? a[i - 1] : v;
        const rt = c < COLS - 1 ? a[i + 1] : v;
        const u = r > 0 ? a[i - COLS] : v;
        const d = r < ROWS - 1 ? a[i + COLS] : v;
        b[i] = v + (l + rt + u + d - 4 * v) * f;
      }
    a.set(b);
  }

  stepCells(dt: number) {
    const amb = this.ambient();
    this.diffuse(this.wet, 0.25, dt);
    this.diffuse(this.temp, 0.5, dt);
    this.diffuse(this.steam, 0.5, dt);
    const drought = this.modOn("drought") ? 2 : 1;
    const tinder = this.modOn("tinder") ? 2 : 1;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        let w = this.wet[i];
        let t = this.temp[i];
        t += (amb - t) * 0.22 * dt;
        const hot = Math.max(0, t - 0.55) * 2.2;
        const wind = Math.hypot(this.wx[i] + this.gw.x, this.wy[i] + this.gw.y);
        let evap = (0.03 + 0.09 * hot + wind * 0.00025) * drought;
        if (this.fire[i] > 0) evap += 0.25;
        const e = Math.min(w, evap * dt);
        w -= e;
        if (t > 0.78 && e > 0) this.steam[i] += e * 1.6;
        // freeze / thaw
        let ic = this.ice[i];
        if (t < 0.22 && w > 0.02) {
          const f = Math.min(w, (0.22 - t) * 1.8 * dt + 0.01 * dt);
          w -= f;
          ic += f * 1.4;
        }
        if (t > 0.36 && ic > 0) {
          const m = Math.min(ic, ((t - 0.36) * 1.2 + 0.01) * dt);
          ic -= m;
          w += m * 0.8;
        }
        // steam
        let s = this.steam[i];
        s *= 1 - 0.2 * dt;
        if (t < 0.4 && s > 0.02) {
          const cd = Math.min(s, s * 0.4 * dt);
          s -= cd;
          w += cd * 0.5;
        }
        // fire
        let f = this.fire[i];
        let fu = this.fuel[i];
        if (f > 0) {
          f = Math.min(1, f + dt * 0.6);
          fu -= dt * 0.16 / tinder * 1.0;
          const crop = this.cropAt[i] >= 0 ? this.crops[this.cropAt[i]] : null;
          if (crop && crop.alive) {
            crop.hp -= 16 * dt;
            crop.flash = 0.2;
            this.checkCrop(crop);
          }
          if (w > 0.33 || ic > 0.1 || t < 0.25) {
            f = 0;
            s += 0.5;
            this.burst(c * CELL + CELL / 2, r * CELL + CELL / 2, 6, "rgba(230,240,255,0.7)", 40, 0.9, 5);
            audio.steam();
            if (this.pests.some((p) => !p.dead && Math.hypot(p.x - (c * CELL + CELL / 2), p.y - (r * CELL + CELL / 2)) < CELL * 1.5)) this.react("STEAM BURST", 25, c * CELL + CELL / 2, r * CELL + CELL / 2, "#ffd0a0");
          } else if (fu <= 0) {
            f = 0;
            fu = 0;
          } else {
            const vx = this.wx[i] + this.gw.x;
            const vy = this.wy[i] + this.gw.y;
            for (let d = 0; d < 4; d++) {
              const nc = c + DIRS[d][0];
              const nr = r + DIRS[d][1];
              if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
              const j = nr * COLS + nc;
              if (this.fire[j] > 0 || this.fuel[j] < 0.25 || this.wet[j] > 0.25 || this.ice[j] > 0.1) continue;
              const along = (vx * DIRS[d][0] + vy * DIRS[d][1]) / 100;
              const chance = 0.32 * tinder * (1 - this.wet[j] * 2) * Math.max(0.25, 1 + along * 1.6) * (this.cropAt[j] >= 0 ? 1.2 : 1);
              if (Math.random() < chance * dt) {
                this.fire[j] = 0.25;
                audio.fire();
              }
            }
          }
          if (Math.random() < dt * 5) this.parts.push({ x: c * CELL + rnd(8, 40), y: r * CELL + rnd(10, 36), vx: rnd(-8, 8) + this.gw.x * 0.2, vy: -40, life: 0.7, max: 0.7, size: 2.5, color: "rgba(255,170,60,0.9)", grav: 0, kind: 0 });
        } else if (t > 0.94 && w < 0.08 && fu > 0.4 && Math.random() < 0.25 * tinder * dt) {
          f = 0.3;
        }
        if (f === 0 && fu < 1) fu = Math.min(1, fu + dt * 0.025 * (0.3 + w));
        this.wet[i] = clamp(w, 0, 1);
        this.temp[i] = clamp(t, 0, 1);
        this.ice[i] = clamp(ic, 0, 1.2);
        this.steam[i] = clamp(s, 0, 1.5);
        this.fire[i] = f;
        this.fuel[i] = fu;
        this.charge[i] = Math.max(0, this.charge[i] - dt * 3);
        if (s > 0.2 && Math.random() < dt * 2) this.parts.push({ x: c * CELL + rnd(0, CELL), y: r * CELL + rnd(0, CELL), vx: this.gw.x * 0.3 + this.wx[i] * 0.2, vy: -22, life: 0.9, max: 0.9, size: 5, color: "rgba(235,242,255,0.35)", grav: 0, kind: 0 });
      }
    // steam advection
    for (let i = 0; i < this.N; i++) {
      const s = this.steam[i];
      if (s < 0.03) continue;
      const vx = this.gw.x + this.wx[i];
      const vy = this.gw.y + this.wy[i];
      const sp = Math.hypot(vx, vy);
      if (sp < 8) continue;
      const c = i % COLS;
      const r = Math.floor(i / COLS);
      const nc = c + (Math.abs(vx) > Math.abs(vy) ? Math.sign(vx) : 0);
      const nr = r + (Math.abs(vx) > Math.abs(vy) ? 0 : Math.sign(vy));
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const m = s * Math.min(0.5, sp * dt * 0.012);
      this.steam[i] -= m;
      this.steam[nr * COLS + nc] += m;
    }
  }

  // ---------- crops ----------
  updateCrops(dt: number) {
    const dayMul = 0.75 + 0.25 * this.day();
    for (const cr of this.crops) {
      cr.flash = Math.max(0, cr.flash - dt);
      if (!cr.alive) continue;
      const i = cr.i;
      const w = this.wet[i];
      const t = this.temp[i];
      const wf = w < 0.08 ? 0.1 : w < 0.25 ? 0.55 : 1;
      const tf = t < 0.25 ? 0 : t < 0.4 ? 0.6 : t <= 0.78 ? 1 : t < 0.9 ? 0.45 : 0;
      if (w < 0.06) cr.thirst += dt;
      else cr.thirst = Math.max(0, cr.thirst - dt * 2);
      if (cr.thirst > 12) {
        cr.hp -= 1.5 * dt;
        this.checkCrop(cr);
      }
      if (t < 0.17 || this.ice[i] > 0.6) {
        cr.hp -= 4.5 * dt;
        cr.flash = 0.1;
        if (Math.random() < dt * 3) this.text(cr.x, cr.y - 10, "Frostbite", "#9fe3ff", 11);
        this.checkCrop(cr);
      }
      if (t > 0.92) {
        cr.hp -= 3.5 * dt;
        this.checkCrop(cr);
      }
      if (!cr.alive) continue;
      cr.growth += (dt / CROP_TYPES[cr.type].time) * wf * tf * dayMul;
      if (cr.growth >= 1) {
        cr.growth = 0.1;
        const gold = CROP_TYPES[cr.type].value * this.perks.gold * this.diff.gold * (1 + Math.min(this.combo, 25) * 0.02);
        this.addGold(gold, cr.x, cr.y - 14);
        this.stats.harvested++;
        this.score += 3;
        cr.hp = Math.min(cr.maxhp, cr.hp + 8);
        this.burst(cr.x, cr.y, 6, CROP_TYPES[cr.type].color, 70, 0.6, 2.5, 80);
        audio.harvest();
      }
    }
  }

  // ---------- pests ----------
  updatePests(dt: number) {
    for (const p of this.pests) {
      if (p.dead) continue;
      const d = PESTS[p.kind];
      p.age += dt;
      p.hit = Math.max(0, p.hit - dt * 5);
      p.bob += dt * 8;
      const i = this.cellIdx(p.x, p.y);
      const w = this.wet[i];
      const t = this.temp[i];
      const ic = this.ice[i];
      p.frozen = Math.max(0, p.frozen - dt);
      p.immune = Math.max(0, p.immune - dt);
      // chill
      if (t < 0.3 || ic > 0.3) {
        if (p.frozen <= 0 && p.immune <= 0) p.chill += Math.max(0.1, 0.3 - t) * 2.2 * dt / d.chillRes;
      } else p.chill = Math.max(0, p.chill - 0.3 * dt);
      if (p.chill >= 1 && p.frozen <= 0 && p.immune <= 0) {
        p.chill = 0;
        p.frozen = d.boss ? 2.2 : 3;
        p.immune = p.frozen + 3;
        this.text(p.x, p.y - d.r - 14, "FROZEN", "#9fe3ff", 12);
        this.burst(p.x, p.y, 10, "#cfeeff", 90, 0.6, 2.5);
      } else if (p.chill > 1) p.chill = 1;
      p.chill = Math.min(1, p.chill);
      if (p.frozen > 0) p.chill = 0;
      // burn
      if (this.fire[i] > 0.15) p.burn = Math.max(p.burn, 3);
      if (w > 0.35 || ic > 0.2) p.burn = 0;
      if (p.burn > 0) {
        p.burn -= dt;
        this.hurt(p, 13 * dt, "burn");
        if (Math.random() < dt * 14) this.parts.push({ x: p.x + rnd(-6, 6), y: p.y - 4, vx: rnd(-8, 8), vy: -40, life: 0.5, max: 0.5, size: 2.5, color: "rgba(255,150,50,0.9)", grav: 0, kind: 0 });
        if (p.dead) continue;
      }
      // steam scald
      if (this.steam[i] > 0.25) {
        this.hurt(p, 15 * this.steam[i] * dt, "scald");
        if (p.dead) continue;
      }
      // flyer soak
      if (d.fly) {
        if (w > 0.45) p.soak = 2.5;
        else p.soak = Math.max(0, p.soak - dt);
      }
      const grounded = !d.fly || p.soak > 0;
      if (d.burrow) p.exposed = w > 0.45 || ic > 0.3 || this.fire[i] > 0.1 || p.frozen > 0 || t > 0.88;
      if (p.kind === "slug") {
        if (w > 0.4 && p.hp < p.maxhp) p.hp = Math.min(p.maxhp, p.hp + 4 * dt);
        if (t > 0.78 || (w < 0.08 && t > 0.6)) this.hurt(p, 7 * dt, "scald");
        if (p.dead) continue;
      }
      // movement multiplier
      let mult = 1;
      if (p.frozen > 0) mult = 0;
      else {
        mult *= 1 - 0.55 * p.chill;
        if (grounded && w > 0.55 && ic < 0.3) mult *= p.kind === "slug" ? 1.45 : 0.65;
        if (d.fly && p.soak > 0) mult *= 0.5;
        if (p.burn > 0 && !d.boss) mult *= 1.2;
      }
      // boss behaviours
      if (p.kind === "titan") {
        if (p.hp < p.maxhp * 0.5 && p.phase === 1) {
          p.phase = 2;
          this.text(p.x, p.y - 50, "ENRAGED!", "#ff6a5a", 22);
          this.addShake(8);
          audio.boss();
        }
        if (p.phase === 2) mult *= 1.45;
        p.stomp -= dt;
        if (p.stomp <= 0 && p.frozen <= 0) {
          p.stomp = p.phase === 2 ? 3.5 : 5.5;
          this.addShake(9);
          audio.stomp();
          this.ring(p.x, p.y, "#c9a37a", 120);
          this.burst(p.x, p.y, 20, "#8a6a44", 160, 0.8, 4, 80);
          for (const cr of this.crops) if (cr.alive && Math.hypot(cr.x - p.x, cr.y - p.y) < 90) {
            cr.hp -= 14;
            cr.flash = 0.3;
            this.checkCrop(cr);
          }
        }
      } else if (p.kind === "queen") {
        if (p.hp < p.maxhp * 0.5 && p.phase === 1) {
          p.phase = 2;
          this.text(p.x, p.y - 50, "SWARM FRENZY!", "#ff6a5a", 22);
          this.addShake(8);
          audio.boss();
        }
        if (p.phase === 2) mult *= 1.3;
        p.summon -= dt;
        if (p.summon <= 0 && p.frozen <= 0) {
          p.summon = p.phase === 2 ? 4.5 : 7;
          const n = p.phase === 2 ? 5 : 3;
          for (let k = 0; k < n; k++) {
            const l = this.spawnPest("locust", p.x + rnd(-24, 24), p.y + rnd(-24, 24));
            l.hp = l.maxhp = PESTS.locust.hp * this.diff.hp;
          }
          this.text(p.x, p.y - 44, "Swarm called!", "#ffb06a", 14);
          this.ring(p.x, p.y, "#ffb06a", 90);
        }
      }
      // targeting
      p.retarget -= dt;
      if (p.target < 0 || !this.crops[p.target].alive || p.retarget <= 0) {
        if (p.target < 0 || !this.crops[p.target].alive) this.pickTarget(p, true);
        p.retarget = 4;
      }
      const spd = d.spd * this.diff.spd * mult;
      if (p.target >= 0) {
        const cr = this.crops[p.target];
        const dx = cr.x - p.x;
        const dy = cr.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        const reach = d.r + 14;
        if (dist > reach) {
          const wob = d.fly ? Math.sin(p.bob * 0.6) * 0.5 : 0;
          const ux = dx / dist - (dy / dist) * wob;
          const uy = dy / dist + (dx / dist) * wob;
          p.x += ux * spd * dt;
          p.y += uy * spd * dt;
        } else if (p.frozen <= 0) {
          cr.hp -= d.dmg * dt * (this.diff.id === "gentle" ? 0.85 : 1);
          cr.flash = 0.15;
          p.eat -= dt;
          if (p.eat <= 0) {
            p.eat = 0.45;
            this.burst(cr.x, cr.y, 2, "#5a8a3a", 40, 0.4, 2);
          }
          this.checkCrop(cr);
        }
      } else {
        p.x += spd * dt * 0.2;
      }
      // wind push
      this.sampleWind(p.x, p.y);
      const mass = d.wind * (d.fly && p.soak > 0 ? 0.6 : 1);
      p.x += this.wvx * mass * dt;
      p.y += this.wvy * mass * dt;
      p.x = clamp(p.x, -40, W - 4);
      p.y = clamp(p.y, -30, H - 6);
    }
    this.pests = this.pests.filter((p) => !p.dead);
  }

  updateWave(dt: number) {
    if (this.waveState === "prep") {
      if (this.tutorial) return;
      this.prepT -= dt;
      if (this.prepT <= 0) this.startWave();
      return;
    }
    this.waveT += dt;
    while (this.queue.length && this.queue[0].t <= this.waveT) {
      const q = this.queue.shift()!;
      this.spawnPest(q.kind);
      if (PESTS[q.kind].boss) {
        this.text(W / 2, 110, PESTS[q.kind].name + " approaches!", "#ff8a6a", 24);
        this.addShake(10);
      }
    }
    if (!this.queue.length && this.pests.length === 0) this.waveClear();
  }

  // ---------- gamepad ----------
  pollPad(dt: number) {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const g = pads && pads[0];
    if (!g) return;
    const ax = Math.abs(g.axes[0]) > 0.2 ? g.axes[0] : 0;
    const ay = Math.abs(g.axes[1]) > 0.2 ? g.axes[1] : 0;
    if (ax || ay) {
      this.padActive = true;
      this.mouseIn = true;
      this.mouse.x = clamp(this.mouse.x + ax * 420 * dt, 0, W - 1);
      this.mouse.y = clamp(this.mouse.y + ay * 420 * dt, 0, H - 1);
      const l = Math.hypot(ax, ay);
      this.padDir = { x: ax / l, y: ay / l };
    }
    const b = g.buttons.map((x) => x.pressed);
    const edge = (n: number) => b[n] && !this.padPrev[n];
    if (edge(9)) this.setPaused(!this.paused);
    if (!this.paused && !this.over) {
      if (edge(0)) {
        if (this.tool === "wind") this.cast("wind", this.mouse.x, this.mouse.y, this.padDir.x, this.padDir.y);
        else this.press(this.mouse.x, this.mouse.y);
      }
      if (edge(1)) this.setTool(null);
      if (edge(2)) this.upgrade();
      if (edge(3)) this.callWave();
      if (edge(4)) this.cycleTool(-1);
      if (edge(5)) this.cycleTool(1);
    }
    this.padPrev = b;
  }

  // ---------- hud ----------
  emitHud(force = false) {
    if (this.dead && !force) return;
    const boss = this.pests.find((p) => PESTS[p.kind].boss && !p.dead);
    const sel = this.selStruct;
    const total = this.crops.length;
    const prevCounts: Record<string, number> = {};
    for (const q of this.nextQueue) prevCounts[q.kind] = (prevCounts[q.kind] || 0) + 1;
    const h: HudState = {
      gold: Math.floor(this.gold),
      mana: this.mana,
      maxMana: this.perks.maxMana,
      wave: this.wave,
      winWave: WIN_WAVE,
      waveState: this.waveState,
      prepT: this.prepT,
      remaining: this.queue.length + this.pests.length,
      alive: this.aliveCrops(),
      total,
      combo: this.combo,
      comboFrac: this.perks.comboWindow ? Math.max(0, this.comboT / this.perks.comboWindow) : 0,
      forecast: this.event ? this.eventName(this.event.kind) + " (" + Math.max(0, Math.ceil(this.event.dur - this.event.t)) + "s)" : this.nextEvent.t < 18 && !this.tutorial ? this.eventName(this.nextEvent.kind) + " in " + Math.ceil(this.nextEvent.t) + "s" : "Calm skies",
      eventName: this.event ? this.event.kind : null,
      wind: { x: this.gw.x, y: this.gw.y },
      tool: this.tool,
      cds: Object.fromEntries(SPELLS.map((s) => [s.id, this.cd[s.id] > 0 ? this.cd[s.id] / (s.cd * (s.id === "bolt" ? this.perks.boltCd : 1)) : 0])),
      spells: SPELLS.filter((s) => this.spellUnlocked(s.id)).map((s) => s.id),
      structs: STRUCTS.filter((s) => this.structUnlocked(s.id)).map((s) => s.id),
      sel: sel && this.structs.includes(sel) ? { id: sel.id, name: STRUCTS.find((x) => x.id === sel.id)!.name, lvl: sel.lvl, upCost: this.upgradeCost(sel), sell: Math.floor(sel.spent * 0.6), canRotate: sel.id === "fan" } : null,
      paused: this.paused,
      over: this.over,
      summary: this.summary,
      boss: boss ? { name: PESTS[boss.kind].name, frac: Math.max(0, boss.hp / boss.maxhp) } : null,
      score: Math.round(this.score),
      tutStep: this.tutorial ? this.tutStep : -1,
      tutText: this.tutorial ? TUTORIAL[Math.min(this.tutStep, TUTORIAL.length - 1)] : "",
      speed: this.speed,
      preview: (Object.keys(prevCounts) as PestKind[]).map((k) => ({ kind: k, count: prevCounts[k] })),
      previewTotal: this.nextQueue.length,
      previewBoss: this.nextQueue.some((q) => PESTS[q.kind].boss),
      difficulty: this.diff.id,
      toast: this.toastT > 0 ? this.toastMsg : "",
      endless: this.endless,
      night: 1 - this.day(),
    };
    this.onHud(h);
  }
}
