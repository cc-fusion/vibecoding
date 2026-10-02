import { audio } from "./audio";
import {
  CLASSES, DAY_LEN, DIFFICULTY, ENEMIES, FACTIONS, LM, LORE, MAP_R, MODIFIERS, RELICS, TERRAIN, WHISPERS,
} from "./data";
import { DIRS, HEX, clamp, fbm, hash2, hexDist, hexesInRange, mulberry32, toPixel, key } from "./hex";
import type { Axial } from "./hex";
import { EVENTS, landmarkActions } from "./content";
import type { EventDef } from "./content";
import { loadSave, writeSave } from "./save";
import type {
  Combat, EnemyId, FactionId, Intent, RelicId, ResKind, Rumor, RunConfig, SaveData, Stats, TerrainId, Tile,
} from "./types";

export type Modal =
  | { type: "event"; ev: EventDef; result: string | null }
  | { type: "combat"; c: Combat }
  | { type: "landmark"; tile: Tile; log: string | null }
  | { type: "info"; title: string; body: string; emoji: string }
  | { type: "journal" };

export interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string;
  kind: "dot" | "ink" | "spark" | "wisp"; g: number;
}
export interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
export interface Ring { x: number; y: number; r: number; max: number; life: number; color: string }

export class Fx {
  parts: Particle[] = [];
  floats: Floater[] = [];
  rings: Ring[] = [];
  shake = 0;
  flash = 0;
  flashColor = "#fff";
  t = 0;
  lastText = -10;
  stack = 0;

  burst(x: number, y: number, n: number, color: string, o: { speed?: number; life?: number; size?: number; kind?: Particle["kind"]; g?: number } = {}) {
    for (let i = 0; i < n; i++) {
      if (this.parts.length > 520) this.parts.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed ?? 80) * (0.3 + Math.random() * 0.9);
      const life = (o.life ?? 0.8) * (0.6 + Math.random() * 0.7);
      this.parts.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life,
        size: (o.size ?? 3) * (0.6 + Math.random() * 0.8), color, kind: o.kind ?? "dot", g: o.g ?? 0,
      });
    }
  }
  text(x: number, y: number, text: string, color: string, size = 17) {
    if (this.t - this.lastText < 0.4) this.stack += 20;
    else this.stack = 0;
    this.lastText = this.t;
    if (this.floats.length > 40) this.floats.shift();
    this.floats.push({ x: x + (Math.random() - 0.5) * 18, y: y - 30 - this.stack, text, color, life: 1.7, max: 1.7, size });
  }
  ring(x: number, y: number, max: number, color: string) {
    this.rings.push({ x, y, r: 4, max, life: 0.7, color });
  }
  addShake(m: number) {
    this.shake = Math.min(26, this.shake + m);
  }
  update(dt: number) {
    this.t += dt;
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.g * dt;
      p.vx *= Math.pow(0.25, dt);
      if (p.kind !== "wisp") p.vy *= Math.pow(0.4, dt * (p.g ? 0 : 1));
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 22 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const r of this.rings) {
      r.life -= dt;
      r.r += (r.max - r.r) * Math.min(1, dt * 6);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    this.shake *= Math.pow(0.02, dt);
    if (this.shake < 0.15) this.shake = 0;
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }
}

const SHIFT: Record<TerrainId, TerrainId[]> = {
  meadow: ["forest", "hills", "marsh"],
  forest: ["meadow", "marsh", "hills"],
  hills: ["meadow", "mountain", "forest"],
  mountain: ["hills"],
  marsh: ["forest", "meadow"],
  ash: ["hills", "ruins"],
  ruins: ["ash"],
  lake: [],
};

const RES_ICON: Record<ResKind, string> = { supplies: "🍖", ink: "🖋️", sanity: "🧠", vigor: "❤️", gold: "🪙", tonics: "🧪", laud: "💊" };

export const TUT_STEPS = [
  { ev: "move", text: "Move to a neighbouring tile: click it, or press Q E A D Z C." },
  { ev: "chart", text: "Press 2 (Quill), then drag across pale glimpsed tiles to chart them. Chart 3 tiles. Each costs ink." },
  { ev: "pin", text: "Right-click a tile (or use the Pin tool, key 3) to leave a note. Notes stay true even when you hallucinate." },
  { ev: "stepCharted", text: "Walk onto a charted tile. Mapped ground costs less, drains less sanity and hides fewer ambushes." },
  { ev: "camp", text: "Press R to make camp. Rest restores vigor and sanity, but time passes and the Unwriting spreads." },
  { ev: "landmark", text: "Find a landmark by charting toward it. When you stand on one, press F to interact." },
  { ev: "final", text: "Claim all 3 Sigils 🔱 and reach the Spire 🌀 before the Unwriting devours the map. Press J for your Journal." },
];

export interface OverState {
  kind: string; win: boolean; gain: number; score: number; mult: number; days: number; pct: number; sigils: number;
  stats: Stats; relics: RelicId[]; difficulty: string; cls: string; newLore: string[]; charted: number;
}

export class Game {
  cfg: RunConfig;
  save: SaveData;
  diff: (typeof DIFFICULTY)[keyof typeof DIFFICULTY];
  rng: () => number;
  seed: number;
  fx = new Fx();
  rt = 0;
  tiles: Tile[] = [];
  map = new Map<string, Tile>();
  start: Axial = { q: -MAP_R, r: MAP_R };
  spire: Axial = { q: MAP_R, r: -MAP_R };
  p: Axial = { q: -MAP_R, r: MAP_R };
  prev: Axial | null = null;
  vx = 0;
  vy = 0;
  // resources
  supplies = 0; maxSupplies = 0;
  ink = 0; maxInk = 0;
  sanity = 100; maxSanity = 100;
  vigor = 30; maxVigor = 30;
  gold = 0; tonics = 0; laud = 0;
  rep: Record<FactionId, number> = { wardens: 0, hollow: 0, concord: 0, choir: 0 };
  relics: RelicId[] = [];
  sigils = 0;
  bonusDmg = 0;
  boons = { dmg: 0, sanMult: 1 };
  rumors: Rumor[] = [];
  loreFound: number[] = [];
  seenEvents = new Set<string>();
  time = 0;
  front = -2;
  charted = 0;
  chartCounter = 0;
  freeCharts = 0;
  stepsSinceFight = 0;
  stats: Stats = {
    tilesCharted: 0, tilesWalked: 0, landmarks: 0, kills: 0, damageDealt: 0, damageTaken: 0, sanityLost: 0,
    goldEarned: 0, relics: 0, camps: 0, pins: 0, corrected: 0, shifts: 0, flares: 0,
  };
  // ui state
  tool: "walk" | "quill" | "pin" = "walk";
  modal: Modal | null = null;
  paused = false;
  path: Tile[] = [];
  stepTimer = 0;
  hover: Axial | null = null;
  hoverPath: Tile[] | null = null;
  hoverCost = 0;
  cam = { x: 0, y: 0, zoom: 1, manual: false };
  toasts: { id: number; text: string; kind: string; t: number }[] = [];
  banner: { id: number; text: string; sub: string; t: number } | null = null;
  whisper: { id: number; text: string; t: number } | null = null;
  whisperTimer = 8;
  tut = { on: false, step: 0, count: 0 };
  dying: { kind: string; t: number } | null = null;
  over: OverState | null = null;
  onChange: (() => void) | null = null;
  uid = 1;
  lastScribble = 0;
  moodT = 0;
  tip = "";
  unwroteOnce = false;
  trail: { x: number; y: number; t: number }[] = [];
  starving = false;
  ended = false;
  free = false;

  constructor(cfg: RunConfig, seed?: number) {
    this.cfg = cfg;
    this.save = loadSave();
    this.diff = DIFFICULTY[cfg.difficulty];
    this.seed = seed ?? ((Math.random() * 4294967295) >>> 0);
    this.rng = mulberry32(this.seed);
    this.generate();
    const U = (id: string) => this.save.upgrades[id] || 0;
    const mods = new Set(cfg.mods);
    const cls = cfg.classId;
    this.maxSupplies = Math.round((30 + 5 * U("pack") + (cls === "pathfinder" ? 8 : 0)) * this.diff.supply * (mods.has("scarce") ? 0.7 : 1));
    this.maxInk = 13 + 3 * U("well") + (cls === "surveyor" ? 3 : 0);
    this.maxSanity = 100 + 10 * U("mind") + (cls === "mystic" ? 15 : 0);
    this.maxVigor = 30 + 5 * U("hard") - (cls === "mystic" ? 5 : 0);
    this.supplies = this.maxSupplies;
    this.ink = this.maxInk;
    this.sanity = this.maxSanity - (mods.has("fog") ? 15 : 0);
    this.vigor = this.maxVigor;
    this.gold = 18;
    this.tonics = U("kit");
    this.laud = U("kit");
    (Object.keys(this.rep) as FactionId[]).forEach((f) => (this.rep[f] = 8 * U("dipl")));
    for (let i = 0; i < U("luck"); i++) this.giveRelic(undefined, true);
    this.freeCharts = this.freeChartsPerDay();
    this.tut = { on: cfg.tutorial, step: 0, count: 0 };
    const st = this.tileAt(this.start.q, this.start.r)!;
    st.visited = true;
    st.ls.disc = 1;
    st.ls.arrived = 1;
    this.setCharted(st, true);
    this.updateVision();
    const pp = toPixel(this.p.q, this.p.r);
    this.vx = pp.x;
    this.vy = pp.y;
    this.cam.x = pp.x;
    this.cam.y = pp.y;
    this.stats.tilesCharted = 0;
    this.charted = 1;
    this.tip = "Charted tiles are cheaper, safer and kinder to your sanity.";
    this.banner = { id: this.uid++, text: "Day 1", sub: "Find three Sigils. Reach the Spire.", t: 3 };
  }

  // ---------------- map generation ----------------
  generate() {
    const R = MAP_R;
    const rng = this.rng;
    const s1 = Math.floor(rng() * 100000);
    const s2 = Math.floor(rng() * 100000);
    for (let q = -R; q <= R; q++) {
      for (let r = Math.max(-R, -q - R); r <= Math.min(R, -q + R); r++) {
        const d = hexDist({ q, r }, this.start);
        const tier = d < 7 ? 0 : d < 13 ? 1 : 2;
        const x = q + r / 2;
        const y = r * 0.866;
        const elev = fbm(x * 0.2, y * 0.2, s1);
        const moist = fbm(x * 0.23 + 40, y * 0.23 + 40, s2);
        let t: TerrainId;
        if (elev > 0.66) t = "mountain";
        else if (elev > 0.55) t = "hills";
        else if (moist > 0.7 && elev < 0.5 && d > 3) t = "lake";
        else if (moist > 0.58) t = "marsh";
        else if (tier >= 1 && moist < 0.4) t = "ash";
        else if (moist > 0.44) t = "forest";
        else t = "meadow";
        if (d <= 1) t = "meadow";
        else if (d <= 2 && (t === "mountain" || t === "lake" || t === "marsh")) t = "forest";
        if (hexDist({ q, r }, this.spire) <= 2) t = "ruins";
        const tile: Tile = {
          q, r, terrain: t, seen: t, state: 0, visited: false, feature: null, done: false, pin: 0,
          seed: rng(), hallu: rng(), erased: false, chartT: -10, glimT: -10, shiftT: -10, ls: {}, dist: d, tier,
        };
        this.tiles.push(tile);
        this.map.set(key(q, r), tile);
      }
    }
    const startT = this.tileAt(this.start.q, this.start.r)!;
    const spireT = this.tileAt(this.spire.q, this.spire.r)!;
    startT.feature = { kind: "landmark", id: "outpost" };
    spireT.feature = { kind: "landmark", id: "spire" };
    spireT.terrain = "ruins";
    spireT.seen = "ruins";
    const lms: Tile[] = [startT, spireT];
    const free = () => this.tiles.filter((t) => !t.feature && t.terrain !== "lake" && t.dist >= 2 && hexDist(t, this.spire) >= 3);
    const pick = <T,>(a: T[]): T | null => (a.length ? a[Math.floor(rng() * a.length)] : null);
    const sigils: Tile[] = [];
    [[6, 10], [10, 14], [13, 18]].forEach(([a, b], i) => {
      let c = free().filter((t) => t.dist >= a && t.dist <= b && sigils.every((s) => hexDist(s, t) >= 7) && lms.every((l) => hexDist(l, t) >= 3));
      if (!c.length) c = free().filter((t) => t.dist >= a - 2 && t.dist <= b + 2 && sigils.every((s) => hexDist(s, t) >= 4));
      const t = pick(c) ?? pick(free())!;
      t.feature = { kind: "landmark", id: "sigil" };
      t.ls.idx = i;
      sigils.push(t);
      lms.push(t);
    });
    const place = (id: "village" | "market" | "shrine" | "tower" | "library" | "spring" | "obelisk" | "cave", a: number, b: number) => {
      let c = free().filter((t) => t.dist >= a && t.dist <= b && lms.every((l) => hexDist(l, t) >= 3));
      if (!c.length) c = free().filter((t) => lms.every((l) => hexDist(l, t) >= 2));
      const t = pick(c);
      if (!t) return;
      t.feature = { kind: "landmark", id };
      lms.push(t);
      if (id === "market") t.ls.offer = Math.floor(rng() * Object.keys(RELICS).length);
    };
    for (let i = 0; i < 2; i++) place("village", 3, 13);
    for (let i = 0; i < 2; i++) place("market", 4, 16);
    for (let i = 0; i < 2; i++) place("shrine", 5, 16);
    for (let i = 0; i < 2; i++) place("tower", 5, 15);
    for (let i = 0; i < 2; i++) place("library", 8, 17);
    for (let i = 0; i < 2; i++) place("spring", 3, 16);
    for (let i = 0; i < 2; i++) place("obelisk", 6, 16);
    for (let i = 0; i < 3; i++) place("cave", 4, 17);
    // lairs, hazards, events, caches
    for (let i = 0; i < 15; i++) {
      const t = pick(free().filter((x) => x.dist >= 3));
      if (!t) break;
      t.feature = { kind: "lair", enemy: this.pickEnemy(t, false) };
    }
    for (let i = 0; i < 14; i++) {
      const t = pick(free().filter((x) => x.dist >= 3));
      if (!t) break;
      const id = t.terrain === "marsh" ? "quicksand" : t.terrain === "hills" || t.terrain === "mountain" ? "rockfall" : t.terrain === "ash" ? "storm" : "whisperfog";
      t.feature = { kind: "hazard", id };
    }
    for (let i = 0; i < 20; i++) {
      const t = pick(free());
      if (t) t.feature = { kind: "event" };
    }
    for (let i = 0; i < 12; i++) {
      const t = pick(free());
      if (t) t.feature = { kind: "cache" };
    }
    // connectivity guarantee
    const reach = new Set<Tile>([startT]);
    const queue = [startT];
    while (queue.length) {
      const c = queue.pop()!;
      for (const d of DIRS) {
        const n = this.tileAt(c.q + d.q, c.r + d.r);
        if (n && n.terrain !== "lake" && !reach.has(n)) {
          reach.add(n);
          queue.push(n);
        }
      }
    }
    if (![spireT, ...sigils].every((t) => reach.has(t))) {
      for (const t of this.tiles) if (t.terrain === "lake") {
        t.terrain = "marsh";
        t.seen = "marsh";
      }
    }
  }

  pickEnemy(t: Tile, ambush: boolean): EnemyId {
    const ids: EnemyId[] = ["wolf", "bandit", "hag", "acolyte", "golem", "wraith"];
    const w: { id: EnemyId; w: number }[] = [];
    const night = ambush && this.isNight();
    for (const id of ids) {
      const e = ENEMIES[id];
      if (!e.tiers.includes(t.tier)) continue;
      let wt = e.prefer.includes(t.terrain) ? 3 : 0.5;
      if (id === "wraith" && night) wt *= 2;
      if (ambush) {
        if (id === "acolyte" && this.rep.choir > 40) wt = 0;
        if (id === "wraith" && this.rep.choir > 40) wt *= 0.5;
        if (id === "bandit" && this.rep.concord > 40) wt = 0;
        if (id === "wolf" && this.has("drum") && (t.terrain === "forest" || t.terrain === "meadow")) wt *= 0.5;
      }
      w.push({ id, w: wt });
    }
    if (ambush) {
      const hostile: [FactionId, EnemyId][] = [["wardens", "patrol"], ["hollow", "raider"], ["concord", "bandit"], ["choir", "acolyte"]];
      for (const [f, e] of hostile) {
        if (this.rep[f] < -25 && !(e === "patrol" && this.has("seal"))) w.push({ id: e, w: 4 });
      }
    }
    const total = w.reduce((a, b) => a + b.w, 0);
    if (total <= 0) return "wolf";
    let r = this.rng() * total;
    for (const x of w) {
      r -= x.w;
      if (r <= 0) return x.id;
    }
    return w[w.length - 1].id;
  }

  // ---------------- helpers ----------------
  emit() {
    this.onChange?.();
  }
  tileAt(q: number, r: number): Tile | undefined {
    return this.map.get(key(q, r));
  }
  curTile(): Tile {
    return this.tileAt(this.p.q, this.p.r)!;
  }
  has(r: RelicId) {
    return this.relics.includes(r);
  }
  U(id: string) {
    return this.save.upgrades[id] || 0;
  }
  get day() {
    return Math.floor(this.time / DAY_LEN) + 1;
  }
  nightLen() {
    return Math.max(2, (this.cfg.mods.includes("longnight") ? 6 : 4) - (this.has("chrono") ? 2 : 0));
  }
  isNight() {
    return this.time % DAY_LEN >= DAY_LEN - this.nightLen();
  }
  vision() {
    let v = 2 + this.U("eyes") + (this.has("lantern") ? 1 : 0);
    if (this.isNight() && !this.has("lantern")) v -= 1;
    return Math.max(1, v);
  }
  maxPins() {
    return 10 + this.U("pins") * 4 + (this.has("gloves") ? 8 : 0);
  }
  pinCount() {
    return this.tiles.filter((t) => t.pin > 0).length;
  }
  pct() {
    return (this.charted / Math.max(1, this.tiles.length)) * 100;
  }
  freeChartsPerDay() {
    return (this.cfg.classId === "surveyor" ? 1 : 0) + this.U("nib");
  }
  tradeBlocked() {
    return this.rep.concord < -40;
  }
  priceMult() {
    let m = 1 - this.U("hag") * 0.06;
    if (this.has("scale")) m -= 0.2;
    if (this.cfg.mods.includes("scarce")) m += 0.25;
    m += this.rep.concord > 0 ? -this.rep.concord / 400 : -this.rep.concord / 300;
    return Math.max(0.5, m);
  }
  price(base: number) {
    return Math.max(1, Math.ceil(base * this.priceMult()));
  }
  sellValue() {
    return Math.floor(this.charted * 0.6 * (this.has("scale") ? 1.5 : 1));
  }
  maxOf(k: ResKind) {
    switch (k) {
      case "supplies": return this.maxSupplies;
      case "ink": return this.maxInk;
      case "sanity": return this.maxSanity;
      case "vigor": return this.maxVigor;
      default: return 999;
    }
  }
  locked() {
    return !!this.modal || !!this.dying || !!this.over || this.paused;
  }
  pos(t: Axial) {
    return toPixel(t.q, t.r, HEX);
  }
  playerPx() {
    return toPixel(this.p.q, this.p.r, HEX);
  }
  halluP() {
    let p = clamp((65 - this.sanity) / 65, 0, 1) * 0.6 * this.diff.hallu;
    if (this.cfg.mods.includes("fog")) p *= 2;
    if (this.cfg.classId === "mystic") p *= 0.5;
    return clamp(p, 0, 0.9);
  }
  isHallu(t: Tile) {
    if (t.state < 1 || t.pin > 0) return false;
    return (t.hallu + Math.floor(this.time / 4) * 0.618) % 1 < this.halluP();
  }
  toast(text: string, kind = "info") {
    this.toasts.push({ id: this.uid++, text, kind, t: 4.2 });
    if (this.toasts.length > 5) this.toasts.shift();
    this.emit();
  }
  floatAtPlayer(text: string, color: string, size = 17) {
    this.fx.text(this.vx, this.vy, text, color, size);
  }

  gain(kind: ResKind, n: number, silent = false): number {
    if (n === 0) return 0;
    const before = this[kind];
    const floor = this.free && (kind === "vigor" || kind === "sanity") ? 1 : 0;
    const after = Math.max(floor, clamp(before + n, 0, this.maxOf(kind)));
    const delta = after - before;
    this[kind] = after;
    if (delta === 0) return 0;
    if (kind === "gold" && delta > 0) this.stats.goldEarned += delta;
    if (kind === "gold") audio.sfx("coin");
    if (kind === "sanity" && delta < 0) {
      this.stats.sanityLost += -delta;
      this.fx.flash = Math.min(0.6, 0.15 + -delta * 0.04);
      this.fx.flashColor = "#6a2a8a";
      if (delta <= -5) this.fx.addShake(3);
      if ((this.has("fork") && this.rng() < 0.25) || (this.cfg.classId === "mystic" && this.rng() < 0.2)) this.gain("ink", 1);
    }
    if (kind === "vigor" && delta < 0) {
      this.stats.damageTaken += -delta;
      this.fx.flash = 0.45;
      this.fx.flashColor = "#9a1a10";
      this.fx.addShake(4 + -delta * 0.6);
    }
    if (!silent) {
      const col = delta > 0 ? "#bfe28a" : "#f08a7a";
      this.floatAtPlayer(`${delta > 0 ? "+" : ""}${delta} ${RES_ICON[kind]}`, col);
    }
    if (kind === "vigor" || kind === "sanity") this.checkDeath();
    return delta;
  }

  addRep(f: FactionId, n: number, quiet = false) {
    let v = n;
    if (f === "wardens" && n > 0 && this.has("seal")) v = Math.round(n * 1.5);
    const apply = (ff: FactionId, x: number) => {
      this.rep[ff] = clamp(this.rep[ff] + x, -100, 100);
    };
    apply(f, v);
    if (v > 0) {
      if (f === "wardens") apply("choir", -Math.round(v * 0.4));
      if (f === "choir") apply("wardens", -Math.round(v * 0.4));
      if (f === "concord") apply("hollow", -Math.round(v * 0.25));
      if (f === "hollow") apply("concord", -Math.round(v * 0.25));
    }
    if (!quiet && v !== 0) {
      this.floatAtPlayer(`${FACTIONS[f].emoji} ${v > 0 ? "+" : ""}${v}`, FACTIONS[f].color, 15);
    }
  }
  repLabel(v: number) {
    return v <= -60 ? "Hated" : v < -25 ? "Hostile" : v < 10 ? "Neutral" : v < 40 ? "Friendly" : v < 70 ? "Trusted" : "Allied";
  }

  giveRelic(id?: RelicId, silent = false) {
    const all = Object.keys(RELICS) as RelicId[];
    const avail = all.filter((r) => !this.has(r));
    if (!avail.length) {
      this.gain("gold", 25);
      return null;
    }
    const rid = id && !this.has(id) ? id : avail[Math.floor(this.rng() * avail.length)];
    this.relics.push(rid);
    this.stats.relics++;
    if (rid === "lantern") this.updateVision();
    if (!silent) {
      audio.sfx("relic");
      this.toast(`Relic: ${RELICS[rid].emoji} ${RELICS[rid].name}`, "relic");
      this.fx.burst(this.vx, this.vy, 26, "#ffd36a", { speed: 140, kind: "spark", life: 1.1 });
      this.fx.ring(this.vx, this.vy, 90, "#ffd36a");
    }
    return RELICS[rid];
  }

  giveLore(): string {
    const loreIdx = LORE.map((_, i) => i).filter((i) => i < 8 && !this.loreFound.includes(i));
    const fresh = loreIdx.filter((i) => !this.save.lore.includes(i));
    const pool = fresh.length ? fresh : loreIdx;
    if (!pool.length) return "You have read every page you can find.";
    const i = pool[Math.floor(this.rng() * pool.length)];
    this.loreFound.push(i);
    if (!this.save.lore.includes(i)) {
      this.save.lore.push(i);
      writeSave(this.save);
    }
    audio.sfx("page");
    return `📜 ${LORE[i].title}: “${LORE[i].text}”`;
  }

  giveRumor(): string {
    const sig = this.tiles.filter((t) => t.feature?.kind === "landmark" && t.feature.id === "sigil" && !t.ls.claimed && !t.ls.disc && !this.rumors.some((r) => r.sigil === t.ls.idx));
    if (!sig.length) return "The rumor-keepers have nothing new to tell you.";
    const s = sig[Math.floor(this.rng() * sig.length)];
    const near = hexesInRange(s, 1).filter((h) => this.tileAt(h.q, h.r));
    const c = near[Math.floor(this.rng() * near.length)];
    this.rumors.push({ q: c.q, r: c.r, radius: 2, label: `Sigil ${s.ls.idx + 1}`, sigil: s.ls.idx });
    this.fx.ring(this.vx, this.vy, 120, "#ffd36a");
    return `🔱 A rumor marks the region of Sigil ${s.ls.idx + 1} on your map (dashed circle).`;
  }

  corruptSeen(n: number): number {
    const c = this.tiles.filter((t) => t.state === 1 && t.terrain !== "lake" && !t.feature);
    let k = 0;
    for (let i = 0; i < n && c.length; i++) {
      const t = c.splice(Math.floor(this.rng() * c.length), 1)[0];
      const opts = (Object.keys(TERRAIN) as TerrainId[]).filter((x) => x !== "lake" && x !== t.terrain);
      t.seen = opts[Math.floor(this.rng() * opts.length)];
      k++;
    }
    return k;
  }

  // ---------------- charting ----------------
  setCharted(t: Tile, silent = false) {
    if (t.state === 2) return;
    t.state = 2;
    t.seen = t.terrain;
    t.chartT = this.rt;
    this.charted++;
    this.stats.tilesCharted++;
    const f = t.feature;
    if (f && f.kind === "landmark" && !t.ls.disc) {
      t.ls.disc = 1;
      if (!silent) {
        this.stats.landmarks++;
        const lm = LM[f.id];
        const px = this.pos(t);
        audio.sfx("discover");
        this.fx.burst(px.x, px.y, 28, "#ffd36a", { speed: 130, kind: "spark", life: 1.2 });
        this.fx.ring(px.x, px.y, 80, "#ffd36a");
        this.fx.text(px.x, px.y, `${lm.emoji} ${lm.name}`, "#ffe39a", 16);
        this.toast(`Discovered: ${lm.emoji} ${lm.name}`, "discover");
        if (f.id === "spire") this.gain("sanity", -4);
        else this.gain("sanity", 3);
        if (f.id === "sigil") this.rumors = this.rumors.filter((r) => r.sigil !== t.ls.idx);
        if (f.id !== "outpost") this.tutEvent("landmark");
      }
    }
  }

  chartRange(t: Tile) {
    if (t.state === 2) return "charted";
    if (t.state === 0) return "unseen";
    if (hexDist(this.p, t) > this.vision()) return "range";
    return null;
  }

  chartTile(t: Tile, quiet = false): boolean {
    if (this.locked()) return false;
    const why = this.chartRange(t);
    if (why) return false;
    const free = this.freeCharts > 0 || (this.has("sextant") && (this.chartCounter + 1) % 3 === 0);
    const cost = free ? 0 : TERRAIN[t.seen].ink;
    if (this.ink < cost) {
      if (!quiet) {
        this.floatAtPlayer("Out of ink!", "#f08a7a");
        audio.sfx("error");
      }
      return false;
    }
    if (free && this.freeCharts > 0) this.freeCharts--;
    this.ink -= cost;
    this.chartCounter++;
    const wrong = t.seen !== t.terrain;
    this.setCharted(t);
    const px = this.pos(t);
    this.fx.burst(px.x, px.y, 9, "#2a1d12", { speed: 70, kind: "ink", life: 0.6, size: 3 });
    if (wrong) {
      this.stats.corrected++;
      this.fx.text(px.x, px.y, "Corrected!", "#ffd36a", 14);
    }
    if (this.has("quill")) this.gain("sanity", 1, true);
    this.trail.push({ x: px.x, y: px.y, t: this.rt });
    if (this.trail.length > 30) this.trail.shift();
    if (this.rt - this.lastScribble > 0.07) {
      audio.sfx("scribble");
      this.lastScribble = this.rt;
    }
    if (this.tut.on && this.tut.step === 1) {
      this.tut.count++;
      if (this.tut.count >= 3) this.tutEvent("chart");
    }
    this.emit();
    return true;
  }

  chartArea(center: Axial, radius: number): number {
    let n = 0;
    for (const h of hexesInRange(center, radius)) {
      const t = this.tileAt(h.q, h.r);
      if (t && t.state < 2) {
        this.setCharted(t);
        n++;
        const px = this.pos(t);
        this.fx.burst(px.x, px.y, 3, "#ffd36a", { speed: 40, kind: "spark", life: 0.9 });
      }
    }
    audio.sfx("scribble");
    this.updateVision();
    return n;
  }

  quickSurvey() {
    if (this.locked()) return;
    let n = 0;
    const cand = hexesInRange(this.p, Math.min(2, this.vision()))
      .map((h) => this.tileAt(h.q, h.r))
      .filter((t): t is Tile => !!t && t.state === 1);
    cand.sort((a, b) => hexDist(this.p, a) - hexDist(this.p, b));
    for (const t of cand) if (this.chartTile(t, true)) n++;
    if (!n) {
      this.floatAtPlayer(this.ink <= 0 ? "Out of ink!" : "Nothing to chart", "#f0d9a0", 14);
      audio.sfx("error");
    }
    this.emit();
  }

  togglePin(t: Tile) {
    if (this.locked() || t.state < 1) return;
    if (t.pin === 0 && this.pinCount() >= this.maxPins()) {
      this.floatAtPlayer("Pin limit reached", "#f08a7a", 14);
      audio.sfx("error");
      return;
    }
    t.pin = (t.pin + 1) % 5;
    const px = this.pos(t);
    if (t.pin) {
      this.stats.pins++;
      audio.sfx("pin");
      this.fx.burst(px.x, px.y, 8, "#c8962e", { speed: 60, kind: "spark", life: 0.6 });
      this.tutEvent("pin");
    } else audio.sfx("unpin");
    this.emit();
  }

  updateVision() {
    const v = this.vision();
    for (const h of hexesInRange(this.p, v)) {
      const t = this.tileAt(h.q, h.r);
      if (t && t.state === 0) {
        t.state = 1;
        t.seen = t.terrain;
        t.glimT = this.rt;
      }
    }
  }

  // ---------------- movement & pathing ----------------
  adjCost(c: number, id: TerrainId, charted: boolean) {
    if (this.has("boots") && (id === "hills" || id === "mountain")) c -= 1;
    if (this.cfg.classId === "pathfinder" && (id === "forest" || id === "marsh")) c -= 1;
    if (charted && c > 1) c -= 1;
    return Math.max(1, c);
  }
  moveCost(t: Tile) {
    if (t.terrain === "lake") return 2;
    return this.adjCost(TERRAIN[t.terrain].cost, t.terrain, t.state === 2);
  }
  pathCost(t: Tile) {
    const id = t.state < 2 ? t.seen : t.terrain;
    if (id === "lake") return this.has("skiff") ? 2 : Infinity;
    return this.adjCost(TERRAIN[id].cost, id, t.state === 2) + (t.erased ? 2 : 0);
  }

  findPath(target: Tile): { path: Tile[]; cost: number } | null {
    const start = this.curTile();
    if (target === start) return { path: [], cost: 0 };
    if (target.state === 0 || !isFinite(this.pathCost(target))) return null;
    const dist = new Map<Tile, number>([[start, 0]]);
    const prev = new Map<Tile, Tile>();
    const closed = new Set<Tile>();
    const open: Tile[] = [start];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i])! < dist.get(open[bi])!) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (closed.has(cur)) continue;
      closed.add(cur);
      if (cur === target) break;
      for (const d of DIRS) {
        const n = this.tileAt(cur.q + d.q, cur.r + d.r);
        if (!n || n.state === 0 || closed.has(n)) continue;
        const c = this.pathCost(n);
        if (!isFinite(c)) continue;
        const nd = dist.get(cur)! + c;
        if (nd < (dist.get(n) ?? Infinity)) {
          dist.set(n, nd);
          prev.set(n, cur);
          open.push(n);
        }
      }
    }
    if (!dist.has(target)) return null;
    const path: Tile[] = [];
    let c: Tile | undefined = target;
    while (c && c !== start) {
      path.unshift(c);
      c = prev.get(c);
    }
    return { path, cost: dist.get(target)! };
  }

  setHover(a: Axial | null) {
    if (!a) {
      this.hover = null;
      this.hoverPath = null;
      return;
    }
    if (this.hover && this.hover.q === a.q && this.hover.r === a.r) return;
    this.hover = a;
    this.hoverPath = null;
    const t = this.tileAt(a.q, a.r);
    if (t && this.tool === "walk" && t.state > 0) {
      const f = this.findPath(t);
      if (f) {
        this.hoverPath = f.path;
        this.hoverCost = f.cost;
      }
    }
  }

  clickTile(t: Tile) {
    if (this.locked()) return;
    if (this.tool === "quill") {
      this.chartTile(t);
      return;
    }
    if (this.tool === "pin") {
      this.togglePin(t);
      return;
    }
    if (t.q === this.p.q && t.r === this.p.r) {
      this.interact();
      return;
    }
    const f = this.findPath(t);
    if (!f || !f.path.length) {
      this.floatAtPlayer(t.state === 0 ? "Unexplored" : "No path", "#f0d9a0", 14);
      audio.sfx("error");
      return;
    }
    this.path = f.path;
    this.stepTimer = 0;
  }

  keyMove(i: number) {
    if (this.locked()) return;
    const d = DIRS[i];
    const t = this.tileAt(this.p.q + d.q, this.p.r + d.r);
    this.path = [];
    if (t) this.step(t);
    else {
      this.floatAtPlayer("The edge of the world", "#f0d9a0", 14);
      audio.sfx("error");
    }
  }

  step(t: Tile): boolean {
    if (this.locked() || hexDist(this.p, t) !== 1) return false;
    if (t.terrain === "lake" && !this.has("skiff")) {
      this.floatAtPlayer("Water bars the way", "#9cc4de", 14);
      audio.sfx("error");
      this.path = [];
      return false;
    }
    const wasCharted = t.state === 2;
    const stale = t.state === 1 && t.seen !== t.terrain;
    const cost = this.moveCost(t);
    this.prev = { q: this.p.q, r: this.p.r };
    this.starving = false;
    if (this.supplies >= cost) this.supplies -= cost;
    else {
      const short = cost - this.supplies;
      this.supplies = 0;
      this.starving = true;
      this.floatAtPlayer("Starving!", "#f08a7a");
      this.gain("vigor", -(1 + short), true);
      this.gain("sanity", -2, true);
    }
    this.p = { q: t.q, r: t.r };
    t.visited = true;
    this.stats.tilesWalked++;
    if (t.state < 2) this.setCharted(t);
    const px = this.pos(t);
    this.fx.burst(px.x, px.y + 6, 5, "#6b5438", { speed: 40, kind: "dot", life: 0.5, size: 2.5 });
    audio.sfx("step");
    if (stale) {
      this.stats.corrected++;
      this.gain("sanity", -2);
      this.floatAtPlayer("Not as drawn!", "#ffd36a", 15);
      this.toast(`The land was ${TERRAIN[t.terrain].name}, not as you drew it. Unmapped land shifts at dawn.`, "warn");
    }
    let san = (wasCharted ? 0 : 1 + TERRAIN[t.terrain].sanity) + (this.isNight() ? 1 : 0) + (this.rep.choir < -40 ? 1 : 0);
    if (t.erased) {
      san += 8;
      this.gain("vigor", -2, true);
    }
    if (san > 0) this.gain("sanity", -san, san < 2);
    if (t.pin > 0 && this.has("gloves")) this.gain("sanity", 1, true);
    this.updateVision();
    this.advance(cost);
    if (this.dying) return true;
    this.tutEvent("move");
    if (wasCharted) this.tutEvent("stepCharted");
    this.resolveTile(t, wasCharted);
    this.refreshHover();
    this.emit();
    return true;
  }

  refreshHover() {
    const h = this.hover;
    this.hover = null;
    if (h) this.setHover(h);
  }

  resolveTile(t: Tile, wasCharted: boolean) {
    const f = t.feature;
    if (f && (!t.done || f.kind === "landmark")) {
      switch (f.kind) {
        case "landmark":
          if (!t.ls.arrived || f.id === "spire") {
            this.openLandmark(t);
          } else if (!t.ls.hinted) {
            t.ls.hinted = 1;
            this.floatAtPlayer("Press F to interact", "#f0d9a0", 13);
          }
          return;
        case "lair":
          this.startCombat(f.enemy, {
            tile: t, firstStrike: wasCharted,
            intro: wasCharted ? "Your map warned you of this place. You strike first!" : "Something stirs in the dark!",
          });
          t.done = false;
          return;
        case "hazard":
          this.springHazard(t, wasCharted);
          t.done = true;
          return;
        case "event":
          t.done = true;
          this.openEvent(t);
          return;
        case "cache": {
          t.done = true;
          const s = 3 + Math.floor(this.rng() * 4);
          this.gain("supplies", s);
          if (this.rng() < 0.6) this.gain("gold", 3 + Math.floor(this.rng() * 8));
          if (this.rng() < 0.18) this.gain("tonics", 1);
          if (this.rng() < 0.12) this.gain("ink", 2);
          this.toast("You found a hidden cache.", "good");
          audio.sfx("discover");
          return;
        }
      }
    }
    this.rollAmbush(t, wasCharted, false);
  }

  springHazard(t: Tile, wasCharted: boolean) {
    const f = t.feature;
    if (!f || f.kind !== "hazard") return;
    const k = wasCharted ? 0.3 : 1;
    const R = (n: number) => Math.round(n * k);
    this.fx.addShake(wasCharted ? 3 : 9);
    audio.sfx("hit");
    switch (f.id) {
      case "quicksand":
        this.gain("vigor", -R(4)); this.gain("supplies", -R(3));
        this.toast(wasCharted ? "Quicksand! Your map let you skirt most of it." : "Quicksand swallows your pack and bruises you!", "warn");
        break;
      case "rockfall":
        this.gain("vigor", -R(6));
        this.toast(wasCharted ? "Rockfall! You knew where to duck." : "Rockfall crashes down on the path!", "warn");
        break;
      case "whisperfog":
        this.gain("sanity", -R(10));
        audio.sfx("whisper");
        this.toast(wasCharted ? "Whisper-fog drifts by. You kept your eyes on your notes." : "Whisper-fog fills your skull with voices!", "warn");
        break;
      case "storm":
        this.gain("supplies", -R(4)); this.gain("ink", -R(2));
        this.toast(wasCharted ? "An ash storm! You braced in time." : "An ash storm smears your ink and scatters your rations!", "warn");
        break;
    }
  }

  rollAmbush(t: Tile, wasCharted: boolean, camping: boolean) {
    if (this.tut.on && this.tut.step < 4) return false;
    this.stepsSinceFight++;
    if (this.stepsSinceFight < 3 || this.locked()) return false;
    let p = TERRAIN[t.terrain].danger * (wasCharted ? 0.35 : 1) * (this.isNight() ? 1.6 : 1) * (1 + (this.day - 1) * 0.04 + t.tier * 0.2) * this.diff.enc;
    if (t.terrain === "forest" && this.has("drum")) p *= 0.6;
    (Object.keys(this.rep) as FactionId[]).forEach((f) => {
      if (this.rep[f] < -25) p += 0.03;
    });
    p *= 0.85;
    if (camping) p *= 0.8;
    if (this.rng() < p) {
      const id = this.pickEnemy(t, true);
      if (id === "patrol" && this.has("seal")) return false;
      this.startCombat(id, { tile: t, intro: "You are ambushed!" });
      return true;
    }
    return false;
  }

  // ---------------- time ----------------
  advance(units: number) {
    for (let i = 0; i < units; i++) {
      this.time++;
      const ph = this.time % DAY_LEN;
      if (ph === 0) this.dawn();
      else if (ph === DAY_LEN - this.nightLen()) this.dusk();
      this.updateUnwriting();
      const cur = this.curTile();
      if (cur.erased && !this.free) {
        this.gain("sanity", -2, true);
        this.gain("vigor", -1, true);
        if (this.rt - this.lastScribble > 0.5) this.floatAtPlayer("The Unwriting consumes you", "#c07bd8", 14);
        this.fx.burst(this.vx, this.vy, 8, "#150e08", { speed: 60, kind: "ink", life: 0.8 });
      }
      if (this.dying) break;
    }
    this.updateVision();
  }

  frontAt(t: number) {
    return -1 + Math.max(0, t - 24) * (this.diff.unwrite / DAY_LEN);
  }

  updateUnwriting() {
    if (this.free) return;
    this.front = this.frontAt(this.time);
    let n = 0;
    for (const t of this.tiles) {
      if (!t.erased && t.dist <= this.front) {
        t.erased = true;
        n++;
        if (n < 8) {
          const px = this.pos(t);
          this.fx.burst(px.x, px.y, 6, "#150e08", { speed: 50, kind: "ink", life: 0.9, size: 4 });
        }
      }
    }
    if (n) {
      if (!this.unwroteOnce) {
        this.unwroteOnce = true;
        this.banner = { id: this.uid++, text: "The Unwriting", sub: "The map behind you is being erased. Do not turn back.", t: 4 };
      }
      audio.sfx("blot");
      this.fx.addShake(3);
    }
  }

  dawn() {
    this.banner = { id: this.uid++, text: `Day ${this.day}`, sub: "The unmapped land shifts in the dawn light.", t: 3 };
    audio.sfx("dawn");
    if (!this.cfg.mods.includes("iron")) this.gain("ink", 2, true);
    this.freeCharts = this.freeChartsPerDay();
    this.tip = ["Unmapped land shifts at dawn.", "Ink regenerates each dawn.", "Pinned notes survive hallucinations.", "Camp on a 🏕️ pin for bonus sanity."][this.day % 4];
    this.shiftLand();
  }

  dusk() {
    this.banner = { id: this.uid++, text: "Night Falls", sub: "Sight narrows. Ambushes grow bolder.", t: 2.6 };
    audio.sfx("night");
  }

  shiftLand() {
    let n = 0;
    const rate = 0.1 * this.diff.enc;
    for (const t of this.tiles) {
      if (t.state === 2 || t.visited || t.terrain === "lake" || (t.feature?.kind === "landmark")) continue;
      if (this.rng() < rate) {
        const opts = SHIFT[t.terrain].filter((x) => x !== "lake");
        if (!opts.length) continue;
        t.terrain = opts[Math.floor(this.rng() * opts.length)];
        if (t.state === 0) t.seen = t.terrain;
        else t.shiftT = this.rt;
        n++;
      }
    }
    this.stats.shifts += n;
    if (n) this.toast(`${n} unmapped tiles shifted in the night. Glimpsed tiles shimmer.`, "warn");
  }

  camp() {
    if (this.locked()) return;
    const t = this.curTile();
    const ok = this.supplies >= 2;
    if (ok) this.supplies -= 2;
    this.gain("vigor", ok ? 6 : 1);
    let san = ok ? 10 : 2;
    if (t.pin === 3) san += 5;
    this.gain("sanity", san);
    if (ok && (t.terrain === "forest" || t.terrain === "meadow") && this.rng() < 0.6) this.gain("supplies", 1 + (this.rng() < 0.4 ? 1 : 0));
    if (this.has("quill")) this.gain("sanity", -3);
    this.stats.camps++;
    audio.sfx("camp");
    this.fx.burst(this.vx, this.vy, 16, "#ffb050", { speed: 40, kind: "spark", life: 1.2, g: -30 });
    if (!ok) this.toast("No rations to share with the fire. Rest was thin.", "warn");
    this.advance(3);
    if (this.dying) return;
    if (this.isNight() && this.rng() < 0.3 * (t.pin === 3 ? 0.2 : 1)) {
      this.gain("sanity", -6);
      audio.sfx("whisper");
      this.toast("Nightmares of a blank page stalk your sleep.", "warn");
    }
    this.tutEvent("camp");
    this.rollAmbush(t, true, true);
    this.emit();
  }

  // ---------------- interaction ----------------
  interact() {
    const t = this.curTile();
    if (t.feature?.kind === "landmark") this.openLandmark(t);
    else {
      this.floatAtPlayer("Nothing to interact with", "#f0d9a0", 13);
    }
  }

  openLandmark(t: Tile) {
    this.path = [];
    t.ls.arrived = 1;
    audio.sfx("page");
    this.modal = { type: "landmark", tile: t, log: null };
    this.emit();
  }

  landmarkAct(i: number) {
    const m = this.modal;
    if (!m || m.type !== "landmark") return;
    const acts = landmarkActions(this, m.tile);
    const a = acts[i];
    if (!a || a.disabled) return;
    audio.sfx("click");
    const r = a.run();
    if (this.modal === m) m.log = r || null;
    this.emit();
  }

  closeModal() {
    const m = this.modal;
    this.modal = null;
    if (m && m.type === "event") this.updateVision();
    this.emit();
  }

  openJournal() {
    if (this.modal || this.dying || this.over) return;
    this.path = [];
    this.modal = { type: "journal" };
    audio.sfx("page");
    this.emit();
  }

  info(title: string, body: string, emoji: string) {
    this.modal = { type: "info", title, body, emoji };
    this.emit();
  }

  openEvent(t: Tile) {
    this.path = [];
    let pool = EVENTS.filter((e) => (e.minTier ?? 0) <= t.tier && !this.seenEvents.has(e.id));
    if (!pool.length) {
      this.seenEvents.clear();
      pool = EVENTS;
    }
    const ev = pool[Math.floor(this.rng() * pool.length)];
    this.seenEvents.add(ev.id);
    this.modal = { type: "event", ev, result: null };
    audio.sfx("page");
    this.emit();
  }

  eventChoose(i: number) {
    const m = this.modal;
    if (!m || m.type !== "event" || m.result !== null) return;
    const ch = m.ev.choices[i];
    if (!ch || (ch.disabled && ch.disabled(this))) return;
    audio.sfx("click");
    const r = ch.run(this);
    if (this.modal === m) m.result = r || "…";
    this.emit();
  }

  startBoss() {
    const t = this.tileAt(this.spire.q, this.spire.r)!;
    this.boons = { dmg: 0, sanMult: 1 };
    const notes: string[] = [];
    if (this.rep.wardens >= 40) { this.boons.dmg = 3; notes.push("Warden marksmen: +3 strike damage."); }
    if (this.rep.hollow >= 40) { this.gain("vigor", 10); notes.push("Hollow healers: +10 vigor."); }
    if (this.rep.concord >= 40) notes.push("Concord's gilded charges: 2 bursts of 10 damage.");
    if (this.rep.choir >= 40) { this.boons.sanMult = 0.5; notes.push("The Choir sings softly: sanity damage halved."); }
    this.startCombat("unwritten", {
      tile: t, boss: true, noFlee: true, gilded: this.rep.concord >= 40 ? 2 : 0,
      intro: notes.length ? notes.join(" ") : "No faction stands beside you. Only the map.",
      onWin: () => "The Unwritten unravels into ink, and the ink becomes a coastline.",
    });
    audio.sfx("boss");
  }

  // ---------------- combat ----------------
  startCombat(id: EnemyId, o: { tile?: Tile | null; onWin?: ((g: Game) => string) | null; boss?: boolean; firstStrike?: boolean; noFlee?: boolean; gilded?: number; intro?: string } = {}) {
    const e = ENEMIES[id];
    const tier = o.tile?.tier ?? 1;
    const boss = !!o.boss;
    const dmgScale = this.diff.dmg * (boss ? 1 : 1 + tier * 0.12 + (this.day - 1) * 0.025);
    const hpScale = this.diff.hp * (boss ? 1 : 1 + tier * 0.08 + (this.day - 1) * 0.02);
    const maxHp = Math.round(e.hp * hpScale);
    const c: Combat = {
      enemy: e, hp: maxHp, maxHp, guard: 0, idx: 0,
      intent: { kind: "attack", label: "", dmg: 0, san: 0, icon: "" },
      stunned: !!o.firstStrike, brace: false,
      log: [], over: null, reward: "", boss, phase: 0, redacted: null, nextRedact: null,
      gilded: o.gilded ?? 0, dmgScale, turn: 0, tile: o.tile ?? null, prev: this.prev ? { ...this.prev } : null,
      onWin: (o.onWin as ((g: unknown) => string) | undefined) ?? null,
      anim: { id: 0, enemy: "", player: "", ne: "", np: "", npKind: "dmg" }, noFlee: !!o.noFlee,
    };
    c.log.push({ t: o.intro ?? `A ${e.name} bars the way.`, c: "s" });
    this.path = [];
    this.stepsSinceFight = 0;
    this.modal = { type: "combat", c };
    c.intent = this.makeIntent(c);
    if (this.has("compass")) this.gain("sanity", -2, true);
    this.fx.addShake(6);
    audio.sfx("strike");
    this.emit();
  }

  makeIntent(c: Combat): Intent {
    const e = c.enemy;
    let pat = e.pattern;
    if (c.boss) {
      pat = c.phase === 0 ? ["attack", "drain", "attack", "heavy"] : c.phase === 1 ? ["redact", "heavy", "drain", "guard"] : ["wail", "heavy", "redact", "attack", "wail"];
    }
    const kind = pat[c.idx % pat.length];
    const base = e.atk * c.dmgScale * 0.75;
    let sanBase = Math.max(1, Math.round(e.san * Math.sqrt(c.dmgScale)));
    if (this.has("salt") && (e.id === "wraith" || e.id === "hag" || e.id === "acolyte")) sanBase = Math.ceil(sanBase * 0.6);
    sanBase = Math.max(1, Math.round(sanBase * this.boons.sanMult * (c.boss ? 1 : 1)));
    switch (kind) {
      case "heavy": return { kind, label: "Heavy blow", dmg: Math.round(base * 1.8), san: 0, icon: "💥" };
      case "drain": return { kind, label: "Draining whisper", dmg: Math.round(base * 0.4), san: sanBase, icon: "🌀" };
      case "guard": return { kind, label: "Raises its guard", dmg: 0, san: 0, icon: "🛡️" };
      case "wail": return { kind, label: "Wail of unmaking", dmg: 0, san: Math.round(sanBase * 1.6), icon: "😱" };
      case "redact": {
        const opts = ["strike", "flare", "brace"];
        c.nextRedact = opts[Math.floor(this.rng() * opts.length)];
        return { kind, label: `Redacts your ${c.nextRedact}`, dmg: Math.round(base * 0.5), san: 0, icon: "▮", note: c.nextRedact };
      }
      default: return { kind: "attack", label: "Strikes", dmg: Math.round(base), san: 0, icon: "⚔️" };
    }
  }

  clog(c: Combat, t: string, col: string) {
    c.log.push({ t, c: col });
    if (c.log.length > 7) c.log.shift();
  }
  canom(c: Combat, o: Partial<Combat["anim"]>) {
    c.anim = { ...c.anim, ...o, id: this.uid++ };
  }

  flareDamage() {
    return 4 + Math.floor(this.pct() / 8) + (this.has("vial") ? 2 : 0);
  }
  flareCost() {
    return this.has("vial") ? 2 : 3;
  }
  strikeBase() {
    return 5 + this.U("blade") + this.bonusDmg + this.boons.dmg + (this.has("compass") ? 2 : 0);
  }
  parleyChance(c: Combat) {
    const e = c.enemy;
    if (e.parley <= 0 || c.boss) return 0;
    let p = e.parley + (e.faction ? this.rep[e.faction] / 250 : 0);
    if (e.id === "wolf" && this.has("drum")) p += 0.35;
    if (e.id === "bandit" && this.gold >= 8) p += 0.15;
    return clamp(p, 0.05, 0.9);
  }
  fleeChance(c: Combat) {
    return clamp(0.45 + (c.tile && c.tile.state === 2 ? 0.2 : 0), 0, 0.9);
  }

  combatAct(a: string) {
    const m = this.modal;
    if (!m || m.type !== "combat" || this.dying) return;
    const c = m.c;
    if (c.over) return;
    if (c.redacted === a) {
      this.floatAtPlayer("Redacted!", "#c07bd8");
      audio.sfx("error");
      return;
    }
    c.anim = { ...c.anim, enemy: "", player: "", ne: "", np: "" };
    const e = c.enemy;
    let acts = true;
    let dealt = 0;
    switch (a) {
      case "strike": {
        const raw = this.strikeBase() + Math.floor(this.rng() * 3);
        dealt = Math.max(1, raw - (e.armor + c.guard));
        this.clog(c, `You strike for ${dealt}${e.armor + c.guard > 0 ? ` (armor ${e.armor + c.guard})` : ""}.`, "p");
        audio.sfx("strike");
        break;
      }
      case "flare": {
        const cost = this.flareCost();
        if (this.ink < cost) {
          this.floatAtPlayer("Not enough ink!", "#f08a7a");
          audio.sfx("error");
          return;
        }
        this.ink -= cost;
        this.stats.flares++;
        dealt = this.flareDamage() * (e.weak === "flare" ? 2 : 1);
        if (c.boss) c.guard = 0;
        else c.stunned = true;
        this.clog(c, `Ink Flare! ${dealt} damage${e.weak === "flare" ? " (it burns!)" : ""}${c.boss ? "" : " and it is stunned"}. Map ${Math.round(this.pct())}% charted.`, "p");
        audio.sfx("flare");
        this.fx.burst(this.vx, this.vy, 20, "#ffd36a", { speed: 120, kind: "spark" });
        break;
      }
      case "brace":
        c.brace = true;
        this.gain("sanity", 3, true);
        this.clog(c, "You brace behind your satchel, steadying your mind (+3 sanity).", "p");
        audio.sfx("click");
        break;
      case "tonic":
        if (this.tonics <= 0) return;
        this.tonics--;
        this.gain("vigor", 12, true);
        this.clog(c, "You drink a tonic (+12 vigor).", "p");
        audio.sfx("heal");
        this.canom(c, { np: "+12", npKind: "heal" });
        break;
      case "laud":
        if (this.laud <= 0) return;
        this.laud--;
        this.gain("sanity", 20, true);
        this.clog(c, "Laudanum dulls the whispers (+20 sanity).", "p");
        audio.sfx("heal");
        this.canom(c, { np: "+20", npKind: "sheal" });
        break;
      case "gilded":
        if (c.gilded <= 0) return;
        c.gilded--;
        dealt = 10;
        this.clog(c, "A Gilded Charge detonates for 10 damage.", "p");
        audio.sfx("hit");
        break;
      case "parley": {
        const ch = this.parleyChance(c);
        if (ch <= 0) return;
        if (this.rng() < ch) {
          let cost = 0;
          if (e.id === "bandit") {
            cost = Math.min(this.gold, 8);
            if (cost) this.gain("gold", -cost);
          }
          c.over = "parley";
          c.reward = `Words, not blades, settle it.${cost ? ` You pay ${cost} gold.` : ""}`;
          if (e.faction) this.addRep(e.faction, 2);
          if (c.tile?.feature?.kind === "lair") c.tile.done = true;
          audio.sfx("parley");
          this.clog(c, "They lower their weapons.", "p");
          this.emit();
          return;
        }
        this.clog(c, "Your words fall on deaf ears.", "p");
        audio.sfx("error");
        break;
      }
      case "flee": {
        if (c.noFlee) return;
        if (this.rng() < this.fleeChance(c)) {
          c.over = "fled";
          c.reward = "You slip away into the unmapped dark.";
          this.supplies = Math.max(0, this.supplies - 1);
          if (c.prev) {
            this.p = { q: c.prev.q, r: c.prev.r };
            this.updateVision();
          }
          audio.sfx("flee");
          this.emit();
          return;
        }
        this.clog(c, "You stumble. There is no escape!", "p");
        audio.sfx("error");
        break;
      }
      default:
        return;
    }
    c.turn++;
    if (dealt > 0) {
      c.hp = Math.max(0, c.hp - dealt);
      this.stats.damageDealt += dealt;
      this.canom(c, { enemy: "anim-shake", player: "anim-lunge", ne: `-${dealt}` });
      this.fx.addShake(3);
      this.checkPhase(c);
    }
    if (c.hp <= 0) {
      this.winCombat(c);
      this.emit();
      return;
    }
    if (acts) this.enemyAct(c);
    this.emit();
  }

  checkPhase(c: Combat) {
    if (!c.boss) return;
    const f = c.hp / c.maxHp;
    const np = f < 0.34 ? 2 : f < 0.67 ? 1 : 0;
    if (np > c.phase) {
      c.phase = np;
      c.idx = 0;
      c.stunned = true;
      this.clog(c, np === 1 ? "PHASE II — REDACTION: it convulses, then begins to censor your actions!" : "PHASE III — THE FINAL CHAPTER: it convulses; the page begins to unwrite you!", "s");
      audio.sfx("phase");
      this.fx.addShake(14);
      this.fx.flash = 0.7;
      this.fx.flashColor = "#ffffff";
      c.intent = this.makeIntent(c);
    }
  }

  enemyAct(c: Combat) {
    c.redacted = null;
    const e = c.enemy;
    c.guard = 0;
    if (c.stunned) {
      c.stunned = false;
      this.clog(c, `${e.name} is stunned and loses its turn.`, "s");
    } else {
      const it = c.intent;
      let dmg = it.dmg;
      let san = it.san;
      if (c.brace) {
        dmg = Math.ceil(dmg * 0.35);
        san = Math.ceil(san * 0.6);
      }
      if (it.kind === "guard") {
        c.guard = 2;
        this.clog(c, `${e.name} raises its guard (+2 armor next turn).`, "e");
      } else {
        const parts: string[] = [];
        if (dmg > 0) {
          this.gain("vigor", -dmg, true);
          parts.push(`${dmg} vigor`);
        }
        if (san > 0) {
          this.gain("sanity", -san, true);
          parts.push(`${san} sanity`);
        }
        this.clog(c, `${e.name}: ${it.label}${parts.length ? ` — you lose ${parts.join(" & ")}` : ""}${c.brace ? " (braced)" : ""}.`, "e");
        if (dmg > 0 || san > 0) {
          this.canom(c, { enemy: "anim-lunge", player: "anim-shake", np: `-${dmg > 0 ? dmg : san}`, npKind: dmg > 0 ? "dmg" : "san" });
          audio.sfx(dmg > 0 ? "hurt" : "whisper");
          this.fx.addShake(5);
        }
        if (it.kind === "redact" && c.nextRedact) {
          c.redacted = c.nextRedact;
          this.clog(c, `Your ${c.nextRedact} has been REDACTED for this turn.`, "s");
        }
      }
      if (c.boss && c.phase === 2) {
        const t = Math.max(0, 4 - Math.floor(this.pct() / 10));
        if (t > 0) {
          this.gain("sanity", -t, true);
          this.clog(c, `The page unwrites you: −${t} sanity (your map anchors you: ${Math.round(this.pct())}%).`, "e");
        } else this.clog(c, "Your fully drawn map anchors you against the unwriting.", "s");
      }
    }
    c.brace = false;
    c.idx++;
    c.intent = this.makeIntent(c);
    this.checkDeath();
  }

  winCombat(c: Combat) {
    const e = c.enemy;
    c.over = "win";
    this.stats.kills++;
    audio.sfx("hit");
    this.fx.addShake(8);
    const parts: string[] = [];
    const g = e.gold[0] + Math.floor(this.rng() * (e.gold[1] - e.gold[0] + 1));
    if (g > 0) {
      this.gain("gold", g, true);
      parts.push(`${g} gold`);
    }
    if (e.rep) (Object.keys(e.rep) as FactionId[]).forEach((f) => this.addRep(f, e.rep![f] ?? 0, true));
    if (!c.boss) {
      if (this.rng() < 0.28) {
        this.gain("supplies", 2, true);
        parts.push("2 supplies");
      }
      if (this.rng() < 0.12) {
        const r = this.giveRelic();
        if (r) parts.push(`relic: ${r.name}`);
      }
      if (this.has("bell")) {
        this.gain("sanity", 5, true);
        parts.push("5 sanity (Bell)");
      }
    }
    let extra = "";
    if (c.onWin) extra = c.onWin(this);
    c.reward = `${e.name} defeated.${parts.length ? ` Loot: ${parts.join(", ")}.` : ""} ${extra}`.trim();
    this.clog(c, `${e.name} falls.`, "s");
    if (c.tile && c.tile.feature?.kind === "lair") c.tile.done = true;
  }

  closeCombat() {
    const m = this.modal;
    if (!m || m.type !== "combat") return;
    const c = m.c;
    if (!c.over) return;
    this.modal = null;
    if (c.over === "win" && c.boss) {
      this.end("victory");
    } else if (c.over === "win" && c.tile?.feature?.kind === "landmark" && c.tile.feature.id === "sigil") {
      this.openLandmark(c.tile);
      return;
    }
    this.updateVision();
    this.emit();
  }

  useItem(kind: "tonic" | "laud") {
    if (this.locked() && !(this.modal && this.modal.type === "journal")) return;
    if (kind === "tonic" && this.tonics > 0 && this.vigor < this.maxVigor) {
      this.tonics--;
      this.gain("vigor", 12);
      audio.sfx("heal");
    } else if (kind === "laud" && this.laud > 0 && this.sanity < this.maxSanity) {
      this.laud--;
      this.gain("sanity", 20);
      audio.sfx("heal");
    } else audio.sfx("error");
    this.emit();
  }

  // ---------------- tutorial ----------------
  tutEvent(ev: string) {
    if (!this.tut.on) return;
    const s = TUT_STEPS[this.tut.step];
    if (s && s.ev === ev) {
      this.tut.step++;
      this.tut.count = 0;
      audio.sfx("discover");
      this.emit();
    }
  }
  tutSkip() {
    this.tut.on = false;
    this.emit();
  }

  // ---------------- end of run ----------------
  checkDeath() {
    if (this.dying || this.over) return;
    if (this.vigor <= 0) this.end("fallen");
    else if (this.sanity <= 0) this.end("mad");
  }

  end(kind: string) {
    if (this.dying || this.over || this.ended) return;
    this.ended = true;
    this.dying = { kind, t: kind === "victory" ? 0.8 : kind === "abandon" ? 0.01 : 1.4 };
    this.path = [];
    audio.sfx(kind === "victory" ? "win" : kind === "abandon" ? "click" : "lose");
    if (kind !== "victory" && kind !== "abandon") {
      this.fx.addShake(16);
      this.fx.flash = 0.8;
      this.fx.flashColor = kind === "mad" ? "#6a2a8a" : "#9a1a10";
    }
    this.emit();
  }

  finalize(kind: string) {
    const win = kind === "victory";
    const s = this.stats;
    const score = Math.floor(this.charted * 0.5 + s.landmarks * 3 + this.sigils * 12 + s.kills * 2 + this.day + (win ? 100 : 0));
    let mult = this.diff.renown;
    this.cfg.mods.forEach((m) => (mult += MODIFIERS[m]?.renown ?? 0));
    let gain = Math.round(score * mult);
    if (kind === "abandon") gain = Math.round(gain * 0.5);
    const sv = this.save;
    sv.renown += gain;
    sv.lifetime += gain;
    sv.runs++;
    if (win) sv.wins++;
    sv.totals.charted += this.stats.tilesCharted;
    sv.totals.kills += s.kills;
    sv.totals.landmarks += s.landmarks;
    const before = new Set(sv.lore);
    if (win) {
      [7, 8].forEach((i) => {
        if (!sv.lore.includes(i)) sv.lore.push(i);
      });
    }
    const newLore = sv.lore.filter((i) => !before.has(i)).map((i) => LORE[i].title);
    if (win || (this.tut.on && this.tut.step >= 6) || (!this.tut.on && this.cfg.tutorial)) sv.tutorialDone = true;
    sv.best.push({ score: gain, diff: this.cfg.difficulty, win, days: this.day, charted: Math.round(this.pct()), cls: this.cfg.classId });
    sv.best.sort((a, b) => b.score - a.score);
    sv.best = sv.best.slice(0, 5);
    writeSave(sv);
    this.over = {
      kind, win, gain, score, mult, days: this.day, pct: this.pct(), sigils: this.sigils, stats: { ...s },
      relics: [...this.relics], difficulty: DIFFICULTY[this.cfg.difficulty].name, cls: CLASSES[this.cfg.classId]?.name ?? "Surveyor",
      newLore, charted: this.charted,
    };
    this.modal = null;
    this.emit();
  }

  // ---------------- per-frame ----------------
  update(dt: number) {
    dt = Math.min(dt, 0.1);
    this.rt += dt;
    this.fx.update(dt);
    const pp = this.playerPx();
    const k = 1 - Math.exp(-13 * dt);
    this.vx += (pp.x - this.vx) * k;
    this.vy += (pp.y - this.vy) * k;
    let changed = false;
    for (const t of this.toasts) t.t -= dt;
    if (this.toasts.some((t) => t.t <= 0)) {
      this.toasts = this.toasts.filter((t) => t.t > 0);
      changed = true;
    }
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) {
        this.banner = null;
        changed = true;
      }
    }
    if (this.whisper) {
      this.whisper.t -= dt;
      if (this.whisper.t <= 0) {
        this.whisper = null;
        changed = true;
      }
    }
    this.trail = this.trail.filter((p) => this.rt - p.t < 1.2);
    if (this.paused) {
      if (changed) this.emit();
      return;
    }
    if (this.dying) {
      this.dying.t -= dt;
      if (this.dying.t <= 0) {
        const k2 = this.dying.kind;
        this.dying = null;
        this.finalize(k2);
      }
      return;
    }
    if (this.over) return;
    // auto-travel
    if (this.path.length && !this.modal) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        const nxt = this.path[0];
        this.stepTimer = 0.14;
        if (hexDist(this.p, nxt) === 1) {
          this.path.shift();
          this.step(nxt);
        } else this.path = [];
      }
    } else if (this.modal) this.path = [];
    // ambient wisps at low sanity
    if (this.sanity < 45 && Math.random() < dt * (1 - this.sanity / 45) * 6) {
      this.fx.burst(this.vx + (Math.random() - 0.5) * 300, this.vy + (Math.random() - 0.5) * 220, 1, "#a070d0", { speed: 14, kind: "wisp", life: 2.5, size: 5 });
    }
    // whispers
    if (this.sanity < 40) {
      this.whisperTimer -= dt;
      if (this.whisperTimer <= 0) {
        this.whisperTimer = 7 + Math.random() * 8;
        this.whisper = { id: this.uid++, text: WHISPERS[Math.floor(Math.random() * WHISPERS.length)], t: 3.2 };
        audio.sfx("whisper");
        changed = true;
      }
    }
    // audio mood
    this.moodT -= dt;
    if (this.moodT <= 0) {
      this.moodT = 0.5;
      const d = hexDist(this.start, this.p) - this.front;
      audio.setMood({
        sanity: this.sanity, night: this.isNight(), combat: this.modal?.type === "combat",
        boss: this.modal?.type === "combat" && this.modal.c.boss, unwrite: clamp(1 - d / 6, 0, 1),
      });
    }
    if (changed) this.emit();
  }

  // deterministic per-tile hash helper (used for stable visual variation)
  seedHash(t: Tile, n: number) {
    return hash2(t.q, t.r, n + this.seed);
  }
}
