import {
  MODS, ENEMIES, DIFFS, MOD_INFO, composeWave, ModId, HullDef, EType, SortieDef, DmgType, Layout, Resist, ModsState, DiffKey, ShipProfile,
} from "./data";
import { analyze, Analysis } from "./ship";
import { drawModule, shade } from "./render";
import { audio } from "./audio";

export const CS = 14;
const ARENA = 1700; // arena radius in world units
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

const segD2 = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((cx - ax) * dx + (cy - ay) * dy) / l2, 0, 1) : 0;
  const px = ax + dx * t - cx, py = ay + dy * t - cy;
  return px * px + py * py;
};

export interface LaunchOpts {
  id: number; sortie: SortieDef; hull: HullDef; layout: Layout; tech: Record<string, number>;
  diff: DiffKey; mods: ModsState; adapt: Resist; replay: boolean; tutorial: boolean; shake: number; touch: boolean;
}
export interface Input { mx: number; my: number; ax: number; ay: number; fire: boolean; missile: boolean; vent: boolean; autoAim: boolean }
export interface RunResult {
  win: boolean; retreat: boolean; sortie: number; kills: number; byType: Record<string, number>;
  dmgDealt: Resist; dmgTaken: number; shieldAbsorbed: number; shots: number; hits: number; time: number;
  scrap: number; bonus: number; repairBill: number; data: number; cellsLost: number; maxHeat: number; overheats: number; vents: number;
  hullPct: number; score: number; rank: string; wave: number; totalWaves: number; boss: boolean;
}
export interface HudData {
  hullPct: number; shield: number; shieldMax: number; heat: number; heatMax: number; overheated: boolean; ventCd: number; ventLock: number;
  gen: number; demand: number; eff: number; battery: number; batteryMax: number; crewUsed: number; crewNeed: number;
  wave: number; totalWaves: number; enemies: number; boss: { name: string; pct: number; phase: number } | null;
  credits: number; kills: number; time: number; banner: { text: string; sub: string; key: number } | null; hint: string | null;
  flare: number; oob: boolean; ended: boolean; missileReady: number; sortieName: string; paused?: boolean;
}

interface Cell { i: number; gx: number; gy: number; id: ModId; hp: number; max: number; lx: number; ly: number; wx: number; wy: number; cd: number; aim: number; manned: boolean; flash: number; tgt: { x: number; y: number } | null }
interface Ship {
  x: number; y: number; vx: number; vy: number; angle: number; cells: Cell[]; grid: (Cell | null)[]; an: Analysis;
  shield: number; shieldDelay: number; heat: number; battery: number; overheated: boolean; ventCd: number; ventLock: number;
  eff: number; demand: number; gen: number; r: number; dead: boolean; weapons: Cell[]; engines: Cell[]; maxHp: number; throttle: number; burn: number;
  orig: { gx: number; gy: number; id: ModId }[]; ripple: { a: number; t: number }[];
}
interface Enemy {
  id: number; type: EType; x: number; y: number; vx: number; vy: number; angle: number; hp: number; max: number; r: number; t: number;
  cd: number; cd2: number; aux: number; flash: number; warp: number; phase: number; sgn: number; spin: number; armed: number; tm: number[]; dead: boolean;
}
interface Proj {
  x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; kind: string; type: DmgType; pierce: boolean; hit: number[];
  target: Enemy | null; blast: number; hp: number; color: string; ion: boolean;
}
interface Beam { src: Enemy | null; x: number; y: number; ang: number; len: number; warn: number; fire: number; dmg: number; offset: number; endX: number; endY: number; shot: boolean }
interface Ring { x: number; y: number; r: number; kind: "heat" | "emp"; hit: boolean }
interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; k: number; rot: number; vr: number }
interface FText { x: number; y: number; text: string; life: number; max: number; color: string; size: number }
interface Pick { x: number; y: number; vx: number; vy: number; kind: "scrap" | "repair" | "cell" | "coolant"; v: number; life: number }
interface Rock { x: number; y: number; r: number; pts: number[]; cd: number }

export class Sim {
  opts: LaunchOpts; hull: HullDef; sortie: SortieDef; si: number; diffKey: DiffKey;
  ship: Ship; enemies: Enemy[] = []; pb: Proj[] = []; eb: Proj[] = []; beams: Beam[] = []; rings: Ring[] = [];
  parts: Part[] = []; texts: FText[] = []; picks: Pick[] = []; rocks: Rock[] = [];
  t = 0; timeScale = 1; shake = 0; cam = { x: 0, y: 0 }; W = 800; H = 600; zoom = 1; touch: boolean;
  eid = 1; wave = 0; totalWaves: number; state: "intro" | "fight" | "rest" | "done" | "over" = "intro"; stateT = 3;
  banner: { text: string; sub: string; key: number } | null = null; bannerT = 0; bannerKey = 0;
  flare = { next: 15, warn: 0, active: 0 };
  magnet = 0; profile: ShipProfile; aim = { x: 0, y: 0 }; lastAng = 0;
  ended: RunResult | null = null; tutStep = 0; tutT = 0; oob = false; flicker = 0; lostValue = 0;
  stars: { x: number; y: number; z: number; s: number; c: string }[] = [];
  fog: { x: number; y: number; r: number; c: string }[] = [];
  stats = {
    kills: 0, byType: {} as Record<string, number>, dmgDealt: { energy: 0, kinetic: 0, explosive: 0 } as Resist, dmgTaken: 0, shieldAbsorbed: 0,
    shots: 0, hits: 0, scrap: 0, cellsLost: 0, maxHeat: 0, overheats: 0, vents: 0, dist: 0, turned: 0, pickups: 0, scoreKills: 0,
  };

  constructor(opts: LaunchOpts) {
    this.opts = opts; this.hull = opts.hull; this.sortie = opts.sortie; this.si = opts.sortie.n; this.diffKey = opts.diff; this.touch = opts.touch;
    this.totalWaves = opts.sortie.waves;
    const { w, h } = opts.hull;
    const cx = (w - 1) / 2, cy = (h - 1) / 2;
    const alloy = 1 + 0.15 * (opts.tech.p_alloy || 0);
    const glass = opts.mods.glass ? 0.6 : 1;
    const an = analyze(opts.layout, opts.hull, opts.tech);
    const cells: Cell[] = [];
    const grid: (Cell | null)[] = new Array(w * h).fill(null);
    const orig: { gx: number; gy: number; id: ModId }[] = [];
    opts.layout.forEach((id, i) => {
      if (!id) return;
      const gx = i % w, gy = (i / w) | 0;
      const mhp = MODS[id].hp * alloy * glass;
      const c: Cell = { i, gx, gy, id, hp: mhp, max: mhp, lx: (gx - cx) * CS, ly: (gy - cy) * CS, wx: 0, wy: 0, cd: Math.random() * 0.5, aim: 0, manned: an.manned[i], flash: 0, tgt: null };
      cells.push(c); grid[i] = c; orig.push({ gx, gy, id });
    });
    this.ship = {
      x: 0, y: 0, vx: 0, vy: 0, angle: -Math.PI / 2, cells, grid, an, shield: an.shieldCap, shieldDelay: 0, heat: 0, battery: an.battery,
      overheated: false, ventCd: 0, ventLock: 0, eff: 1, demand: 0, gen: an.gen, r: 40, dead: false, weapons: [], engines: [],
      maxHp: cells.reduce((a, c) => a + c.max, 0), throttle: 0, burn: 0, orig, ripple: [],
    };
    this.profile = { shield: an.shieldCap, armor: an.armorCells, speed: an.accel, turrets: an.turrets };
    this.refreshLists();
    this.updateCellWorld();
    this.flare.next = opts.mods.blackout ? 6 : 15;
    for (let i = 0; i < 160; i++) this.stars.push({ x: Math.random() * 2000, y: Math.random() * 2000, z: rand(0.08, 0.6), s: rand(0.8, 2.2), c: Math.random() < 0.15 ? "#93c5fd" : Math.random() < 0.1 ? "#fcd34d" : "#e2e8f0" });
    if (opts.sortie.env === "asteroids") {
      for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2, d = rand(380, ARENA - 150), r = rand(26, 84);
        const pts: number[] = [];
        const n = 9 + ((Math.random() * 4) | 0);
        for (let k = 0; k < n; k++) pts.push(rand(0.75, 1.1));
        this.rocks.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r, pts, cd: 0 });
      }
    }
    if (opts.sortie.env === "nebula") {
      for (let i = 0; i < 14; i++) this.fog.push({ x: rand(-1800, 1800), y: rand(-1800, 1800), r: rand(300, 700), c: Math.random() < 0.5 ? "120,80,200" : "60,140,200" });
    }
    this.stateT = opts.tutorial ? 8 : 3;
    this.say(`SORTIE ${this.si}`, opts.sortie.name.toUpperCase(), 3);
    this.lastAng = this.ship.angle;
  }

  get diff() { return DIFFS[this.diffKey]; }
  get em() { return (1 + 0.06 * (this.si - 1)) * this.diff.dmg; }
  get credMult() {
    const m = this.opts.mods;
    let c = this.diff.cred * (1 + 0.15 * (this.opts.tech.p_salvage || 0)) * (1 + this.ship.an.credBonus) * (1 + 0.08 * (this.si - 1));
    (Object.keys(m) as (keyof ModsState)[]).forEach((k) => { if (m[k]) c += MOD_INFO[k].cred * 0.5; });
    return c * (this.opts.replay ? 0.5 : 1);
  }
  setDiff(k: DiffKey) { this.diffKey = k; }
  resize(w: number, h: number) { this.W = w; this.H = h; this.zoom = clamp(Math.min(w, h) / 760, 0.62, 1.25); }
  say(text: string, sub: string, dur = 2.5) { this.banner = { text, sub, key: ++this.bannerKey }; this.bannerT = dur; }
  shieldUp() { const s = this.ship; return s.shield > 0 && !s.overheated && s.ventLock <= 0; }

  /* ------------------------- helpers ------------------------- */
  updateCellWorld() {
    const s = this.ship;
    const th = s.angle + Math.PI / 2;
    const c = Math.cos(th), sn = Math.sin(th);
    for (const k of s.cells) { k.wx = s.x + k.lx * c - k.ly * sn; k.wy = s.y + k.lx * sn + k.ly * c; }
  }
  cellAt(wx: number, wy: number): Cell | null {
    const s = this.ship;
    const th = s.angle + Math.PI / 2;
    const dx = wx - s.x, dy = wy - s.y;
    const c = Math.cos(th), sn = Math.sin(th);
    const lx = dx * c + dy * sn, ly = -dx * sn + dy * c;
    const { w, h } = this.hull;
    const gx = Math.round(lx / CS + (w - 1) / 2), gy = Math.round(ly / CS + (h - 1) / 2);
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
    return s.grid[gy * w + gx];
  }
  nearestCell(wx: number, wy: number): Cell | null {
    let best: Cell | null = null, bd = 1e9;
    for (const c of this.ship.cells) { const d = (c.wx - wx) ** 2 + (c.wy - wy) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  }
  spark(x: number, y: number, n: number, color: string, sp: number, life: number, size = 2, k = 0) {
    if (this.parts.length > 1400) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = rand(sp * 0.2, sp);
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(life * 0.5, life), max: life, size: rand(size * 0.6, size * 1.3), color, k, rot: Math.random() * 6, vr: rand(-8, 8) });
    }
  }
  boom(x: number, y: number, size: number, color = "#fb923c") {
    this.spark(x, y, Math.min(40, 6 + size * 0.6), color, 120 + size * 3, 0.7, 3 + size * 0.05);
    this.spark(x, y, 4 + size * 0.2, "#fff7ed", 80 + size, 0.35, 3);
    this.parts.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, size: size, color, k: 1, rot: 0, vr: 0 });
    this.spark(x, y, 3 + size * 0.1, "#475569", 100, 1.1, 3, 3);
  }
  ftext(x: number, y: number, text: string, color: string, size = 14) {
    if (this.texts.length > 70) return;
    this.texts.push({ x: x + rand(-8, 8), y, text, life: 0.9, max: 0.9, color, size });
  }
  addShake(a: number) { this.shake = Math.min(1.6, this.shake + a); }

  refreshLists() {
    const s = this.ship;
    s.weapons = s.cells.filter((c) => c.manned && MODS[c.id].weapon);
    s.engines = s.cells.filter((c) => c.manned && MODS[c.id].thrust > 0);
    let r = 20;
    for (const c of s.cells) r = Math.max(r, Math.hypot(c.lx, c.ly) + CS * 0.7);
    s.r = r;
  }
  rebuild() {
    const s = this.ship;
    const { w, h } = this.hull;
    const build = () => {
      const l: Layout = new Array(w * h).fill(null);
      for (const c of s.cells) l[c.i] = c.id;
      return analyze(l, this.hull, this.opts.tech);
    };
    let an = build();
    if (an.disconnected.length) {
      for (const i of an.disconnected) {
        const c = s.grid[i];
        if (!c) continue;
        s.grid[i] = null;
        s.cells = s.cells.filter((k) => k !== c);
        this.stats.cellsLost++;
        this.lostValue += MODS[c.id].cost;
        this.boom(c.wx, c.wy, 8, "#94a3b8");
      }
      this.ftext(s.x, s.y - 30, "SECTION SEVERED", "#fb7185", 16);
      an = build();
    }
    const before = s.cells.filter((c) => c.manned).length;
    s.an = an;
    for (const c of s.cells) c.manned = an.manned[c.i];
    const after = s.cells.filter((c) => c.manned).length;
    if (after < before) this.ftext(s.x, s.y - 44, "CREW LOST – MODULES OFFLINE", "#fbbf24", 13);
    this.refreshLists();
  }

  /* ------------------------- damage to player ------------------------- */
  hitShield(x: number, y: number, dmg: number): number {
    const s = this.ship;
    s.ripple.push({ a: Math.atan2(y - s.y, x - s.x), t: 0.45 });
    s.shieldDelay = 2.5;
    audio.sfx("shield");
    if (s.shield >= dmg) {
      s.shield -= dmg; this.stats.shieldAbsorbed += dmg; this.addShake(0.05);
      return 0;
    }
    const left = dmg - s.shield;
    this.stats.shieldAbsorbed += s.shield;
    s.shield = 0;
    this.ftext(s.x, s.y - 40, "SHIELD DOWN", "#22d3ee", 15);
    this.addShake(0.2);
    return left;
  }
  dealCell(c: Cell, dmg: number) {
    if (this.ship.dead || dmg <= 0) return;
    c.hp -= dmg; c.flash = 0.18;
    this.stats.dmgTaken += dmg;
    this.addShake(0.08 + Math.min(0.3, dmg * 0.01));
    this.spark(c.wx, c.wy, 5, "#fcd34d", 160, 0.4, 2);
    audio.sfx("hit");
    this.ftext(c.wx, c.wy - 8, `-${Math.round(dmg)}`, "#fb7185", 12);
    if (c.hp <= 0) this.destroyCell(c);
  }
  destroyCell(c: Cell) {
    const s = this.ship;
    if (!s.grid[c.i]) return;
    s.grid[c.i] = null;
    s.cells = s.cells.filter((k) => k !== c);
    this.stats.cellsLost++;
    this.lostValue += MODS[c.id].cost;
    this.boom(c.wx, c.wy, c.id === "reactor" ? 40 : 16);
    for (let i = 0; i < 4; i++) this.parts.push({ x: c.wx, y: c.wy, vx: rand(-90, 90), vy: rand(-90, 90), life: 1.4, max: 1.4, size: 4, color: MODS[c.id].color, k: 3, rot: Math.random() * 6, vr: rand(-6, 6) });
    this.ftext(c.wx, c.wy - 14, `${MODS[c.id].name} LOST`, "#f43f5e", 12);
    audio.sfx(c.id === "reactor" ? "bigboom" : "boom", 0.6);
    this.addShake(0.35);
    if (c.id === "bridge") {
      s.dead = true;
      this.boom(s.x, s.y, 90, "#f87171");
      for (const k of s.cells) this.boom(k.wx, k.wy, 14);
      audio.sfx("bigboom");
      this.state = "over"; this.stateT = 1.0; this.timeScale = 0.35;
      this.say("BRIDGE DESTROYED", "Ship lost", 3);
      return;
    }
    if (c.id === "reactor") {
      for (const k of s.cells.slice()) {
        const d = Math.hypot(k.wx - c.wx, k.wy - c.wy);
        if (d < CS * 2.3) this.dealCell(k, 38 * (1 - d / (CS * 3)));
      }
      if (s.dead) return;
    }
    this.rebuild();
  }
  /** A projectile or blast reaching the ship at world point; applies shield first. */
  hurtShipAt(x: number, y: number, dmg: number, cell: Cell | null) {
    if (this.ship.dead) return;
    let d = dmg;
    if (this.shieldUp() && Math.hypot(x - this.ship.x, y - this.ship.y) < this.ship.r + 10) {
      d = this.hitShield(x, y, d);
      if (d <= 0) return;
    }
    const c = cell || this.nearestCell(x, y);
    if (c) this.dealCell(c, d);
  }
  enemyBlast(x: number, y: number, radius: number, dmg: number) {
    const s = this.ship;
    this.boom(x, y, radius * 0.6, "#facc15");
    audio.sfx("boom", 0.8);
    this.addShake(0.2);
    if (s.dead) return;
    if (this.shieldUp() && Math.hypot(x - s.x, y - s.y) < s.r + 10 + radius * 0.3) {
      const left = this.hitShield(x, y, dmg);
      if (left <= 0) return;
      const c = this.nearestCell(x, y);
      if (c) this.dealCell(c, left);
      return;
    }
    for (const c of s.cells.slice()) {
      const d = Math.hypot(c.wx - x, c.wy - y);
      if (d < radius) this.dealCell(c, dmg * (1 - 0.6 * (d / radius)));
    }
  }

  /* ------------------------- enemies ------------------------- */
  spawnEnemy(type: EType, x: number, y: number, warp = 1) {
    const def = ENEMIES[type];
    const boss = type === "boss1" || type === "boss2";
    const scale = boss ? 1 + 0.12 * Math.max(0, this.si - 8) : 1 + 0.14 * (this.si - 1);
    const e: Enemy = {
      id: this.eid++, type, x, y, vx: 0, vy: 0, angle: Math.random() * 6.28, hp: def.hp * scale, max: def.hp * scale, r: def.r, t: 0,
      cd: rand(0.5, 2), cd2: 0, aux: 0, flash: 0, warp, phase: 1, sgn: Math.random() < 0.5 ? 1 : -1, spin: 0, armed: 0,
      tm: [2, 4, 5, 3, 2], dead: false,
    };
    this.enemies.push(e);
    this.spark(x, y, 12, def.color, 140, 0.6, 2);
    return e;
  }
  spawnWave() {
    const s = this.ship;
    const last = this.wave === this.totalWaves;
    const isBoss = last && !!this.sortie.boss;
    const types = isBoss ? composeWave(this.sortie, this.wave, this.profile, false).slice(0, 3 + Math.floor(this.si / 3)) : composeWave(this.sortie, this.wave - 1, this.profile, this.opts.mods.swarm);
    const at = (d: number) => {
      const a = Math.random() * Math.PI * 2;
      let x = s.x + Math.cos(a) * d, y = s.y + Math.sin(a) * d;
      const m = Math.hypot(x, y);
      if (m > ARENA - 150) { x *= (ARENA - 150) / m; y *= (ARENA - 150) / m; }
      return { x, y };
    };
    if (isBoss) {
      const p = at(760);
      this.spawnEnemy(this.sortie.boss!, p.x, p.y, 2);
      this.say("WARNING", ENEMIES[this.sortie.boss!].name.toUpperCase(), 3.5);
      audio.sfx("warn");
    } else {
      this.say(`WAVE ${this.wave} / ${this.totalWaves}`, `${types.length} hostiles inbound`, 2.2);
    }
    for (const t of types) { const p = at(rand(620, 900)); this.spawnEnemy(t, p.x, p.y, rand(0.8, 1.6)); }
    audio.sfx("wave");
  }
  aimAngle(e: Enemy, speed: number, lead = 0.6) {
    const s = this.ship;
    const d = Math.hypot(s.x - e.x, s.y - e.y);
    const t = d / speed * lead;
    return Math.atan2(s.y + s.vy * t - e.y, s.x + s.vx * t - e.x);
  }
  ebullet(x: number, y: number, ang: number, speed: number, dmg: number, kind: "bolt" | "orb" | "ion" | "missile", life = 4) {
    const color = kind === "ion" ? "#67e8f9" : kind === "orb" ? "#c7d2fe" : kind === "missile" ? "#fb7185" : "#fdba74";
    this.eb.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, r: kind === "missile" ? 6 : kind === "bolt" ? 4 : 5, dmg, life, kind, type: "energy", pierce: false, hit: [], target: null, blast: kind === "missile" ? 38 : 0, hp: 6, color, ion: kind === "ion" });
  }
  addBeam(e: Enemy, warn: number, dmg: number, offset = 0) {
    const s = this.ship;
    this.beams.push({ src: e, x: e.x, y: e.y, ang: Math.atan2(s.y - e.y, s.x - e.x) + offset, len: 1300, warn, fire: 0, dmg, offset, endX: 0, endY: 0, shot: false });
    audio.sfx("charge");
  }
  fireBeam(b: Beam) {
    b.shot = true; b.fire = 0.3;
    audio.sfx("beam"); this.addShake(0.3);
    const cos = Math.cos(b.ang), sin = Math.sin(b.ang);
    let d = 0;
    b.endX = b.x + cos * b.len; b.endY = b.y + sin * b.len;
    const s = this.ship;
    for (; d < b.len; d += 8) {
      const x = b.x + cos * d, y = b.y + sin * d;
      if (this.rocks.some((r) => Math.hypot(r.x - x, r.y - y) < r.r * 0.9)) { b.endX = x; b.endY = y; this.spark(x, y, 8, "#fde047", 200, 0.4); return; }
      if (s.dead) continue;
      if (this.shieldUp() && Math.hypot(x - s.x, y - s.y) < s.r + 10) {
        b.endX = x; b.endY = y;
        const left = this.hitShield(x, y, b.dmg);
        if (left > 0) { const c = this.nearestCell(x, y); if (c) this.dealCell(c, left); }
        return;
      }
      const c = this.cellAt(x, y);
      if (c) { b.endX = x; b.endY = y; this.dealCell(c, b.dmg); return; }
    }
  }
  countType(t: EType) { let n = 0; for (const e of this.enemies) if (e.type === t && !e.dead) n++; return n; }

  hurtEnemy(e: Enemy, dmg: number, type: DmgType, x: number, y: number): boolean {
    if (e.warp > 0 || e.dead) return false;
    const boss = e.type === "boss1" || e.type === "boss2";
    const res = this.opts.adapt[type] * (boss ? 0.5 : 1);
    const d = dmg * (1 - res);
    e.hp -= d / this.diff.hp;
    e.flash = 0.1;
    this.stats.dmgDealt[type] += d;
    this.stats.hits++;
    this.spark(x, y, 3, "#fff", 140, 0.25, 2);
    if (d >= 6 || Math.random() < 0.25) this.ftext(x, y - 10, `${Math.round(d)}`, res > 0.12 ? "#94a3b8" : "#fde68a", d >= 20 ? 15 : 11);
    audio.sfx("enemyHit");
    if (e.hp <= 0) this.killEnemy(e, true);
    return true;
  }
  killEnemy(e: Enemy, reward: boolean) {
    if (e.dead) return;
    e.dead = true;
    const def = ENEMIES[e.type];
    const big = e.r > 24;
    this.boom(e.x, e.y, e.r * 1.6, def.color);
    audio.sfx(big ? "bigboom" : "boom", big ? 1 : 0.6);
    this.addShake(big ? 0.9 : 0.15);
    if (e.type === "carrier" || big) for (let i = 0; i < 6; i++) this.boom(e.x + rand(-e.r, e.r), e.y + rand(-e.r, e.r), 14, def.color);
    if (!reward || e.type === "mine") return;
    this.stats.kills++;
    this.stats.byType[e.type] = (this.stats.byType[e.type] || 0) + 1;
    this.stats.scoreKills += def.value;
    const total = Math.round(def.value * this.credMult);
    const chunks = e.type === "boss1" || e.type === "boss2" ? 14 : e.type === "carrier" ? 5 : 1 + ((Math.random() * 2) | 0);
    for (let i = 0; i < chunks; i++) {
      const a = Math.random() * 6.28;
      this.picks.push({ x: e.x, y: e.y, vx: Math.cos(a) * rand(30, 120), vy: Math.sin(a) * rand(30, 120), kind: "scrap", v: Math.max(1, Math.round(total / chunks)), life: 14 });
    }
    if (Math.random() < 0.2 || big) {
      const hullLow = this.hullPct() < 0.7, heatHigh = this.ship.heat > this.ship.an.heatCap * 0.6;
      const r = Math.random();
      const kind: Pick["kind"] = hullLow && r < 0.5 ? "repair" : heatHigh && r < 0.8 ? "coolant" : r < 0.5 ? "cell" : r < 0.8 ? "coolant" : "repair";
      this.picks.push({ x: e.x, y: e.y, vx: rand(-40, 40), vy: rand(-40, 40), kind, v: 0, life: 16 });
    }
    if (e.type === "boss1" || e.type === "boss2") {
      this.timeScale = 0.3;
      this.say("TARGET DESTROYED", ENEMIES[e.type].name, 3);
      for (const o of this.enemies) if (o !== e && !o.dead) this.killEnemy(o, false);
      this.eb.length = 0;
      this.beams.length = 0;
    }
  }
  hullPct() {
    const s = this.ship;
    return s.maxHp > 0 ? clamp(s.cells.reduce((a, c) => a + c.hp, 0) / s.maxHp, 0, 1) : 0;
  }

  /* ------------------------- main update ------------------------- */
  update(rawDt: number, inp: Input) {
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    this.t += dt;
    if (this.timeScale < 1 && this.state !== "over") this.timeScale = Math.min(1, this.timeScale + rawDt * 0.5);
    this.shake = Math.max(0, this.shake - rawDt * 2.2);
    if (this.bannerT > 0) { this.bannerT -= rawDt; if (this.bannerT <= 0) this.banner = null; }
    this.flicker += dt;
    this.updateEnv(dt);
    if (!this.ship.dead) this.updateShip(dt, inp);
    this.updateCellWorld();
    this.updateFlow(dt);
    this.updateEnemies(dt);
    this.updateBeams(dt);
    this.updateProjectiles(dt);
    this.updatePicks(dt);
    this.updateFx(dt);
    if (!this.ship.dead) this.updateTutorial(dt, inp);
    const s = this.ship;
    const lx = Math.cos(s.angle) * 60, ly = Math.sin(s.angle) * 60;
    this.cam.x += (s.x + lx - this.cam.x) * Math.min(1, rawDt * 5);
    this.cam.y += (s.y + ly - this.cam.y) * Math.min(1, rawDt * 5);
    // music intensity
    const live = this.enemies.filter((e) => !e.dead && e.type !== "mine").length;
    const boss = this.enemies.some((e) => !e.dead && (e.type === "boss1" || e.type === "boss2"));
    audio.setIntensity(clamp(0.25 + live * 0.06 + (boss ? 0.35 : 0) + (1 - this.hullPct()) * 0.2 + (this.state === "fight" ? 0 : -0.15), 0, 1), boss);
  }

  updateEnv(dt: number) {
    const f = this.flare;
    const flares = this.sortie.env === "flare" || this.opts.mods.blackout;
    if (!flares || this.state === "over") return;
    if (f.warn > 0) {
      f.warn -= dt;
      if (f.warn <= 0) { f.active = this.opts.mods.blackout ? 6 : 5; audio.sfx("emp", 0.7); this.say("SOLAR FLARE", "Power output collapsing", 2); }
    } else if (f.active > 0) {
      f.active -= dt;
      if (f.active <= 0) f.next = this.opts.mods.blackout ? rand(5, 8) : rand(14, 20);
    } else {
      f.next -= dt;
      if (f.next <= 0) { f.warn = 3; audio.sfx("warn"); this.say("FLARE WARNING", "Charge your capacitors!", 2.2); }
    }
  }

  updateShip(dt: number, inp: Input) {
    const s = this.ship, an = s.an;
    // aim
    this.aim.x = this.cam.x + (inp.ax - this.W / 2) / this.zoom;
    this.aim.y = this.cam.y + (inp.ay - this.H / 2) / this.zoom;
    let aimA = Math.atan2(this.aim.y - s.y, this.aim.x - s.x);
    let mx = inp.mx, my = inp.my;
    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }
    const throttle = Math.min(1, mag);
    s.throttle = throttle;
    if (inp.autoAim) {
      let best: Enemy | null = null, bd = 1e9;
      for (const e of this.enemies) { if (e.dead || e.warp > 0) continue; const d = Math.hypot(e.x - s.x, e.y - s.y); if (d < bd) { bd = d; best = e; } }
      if (best) aimA = Math.atan2(best.y - s.y, best.x - s.x);
      else if (throttle > 0.1) aimA = Math.atan2(my, mx);
      else aimA = s.angle;
    }
    // vent
    if (inp.vent) {
      inp.vent = false;
      if (s.ventCd <= 0) {
        s.heat = Math.min(s.heat, an.heatCap * 0.3);
        s.ventCd = 14; s.ventLock = 2.2; s.overheated = false; this.stats.vents++;
        audio.sfx("vent");
        for (let i = 0; i < 40; i++) this.spark(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r), 1, "#e0f2fe", 200, 0.9, 3);
        this.ftext(s.x, s.y - 40, "EMERGENCY VENT", "#7dd3fc", 16);
      } else audio.sfx("error");
    }
    s.ventLock = Math.max(0, s.ventLock - dt);
    s.ventCd = Math.max(0, s.ventCd - dt);
    const locked = s.overheated || s.ventLock > 0;
    const fireC = inp.fire && !locked, fireM = inp.missile && !locked;
    // turret targets
    for (const c of s.weapons) {
      const wp = MODS[c.id].weapon!;
      if (wp.group !== "turret") continue;
      const rng = wp.range * (1 + Math.min(0.4, 0.08 * (an.count.targeting || 0)) * 0.5);
      let tg: { x: number; y: number } | null = null, bd = rng * rng;
      for (const p of this.eb) {
        if (p.kind !== "missile") continue;
        const d = (p.x - c.wx) ** 2 + (p.y - c.wy) ** 2;
        if (d < Math.min(bd, 300 * 300)) { bd = d; tg = p; }
      }
      if (!tg) {
        bd = rng * rng;
        for (const e of this.enemies) {
          if (e.dead || e.warp > 0) continue;
          const d = (e.x - c.wx) ** 2 + (e.y - c.wy) ** 2;
          if (d < bd) { bd = d; tg = e; }
        }
      }
      c.tgt = tg;
    }
    // power
    let demand = an.idleDraw + an.engineDraw * throttle + an.gyroDraw * (Math.abs(angDiff(aimA, s.angle)) > 0.05 ? 1 : 0);
    for (const c of s.weapons) {
      const d = MODS[c.id], wp = d.weapon!;
      const on = wp.group === "cannon" ? fireC : wp.group === "missile" ? fireM : !!c.tgt && !locked;
      if (on) demand += -d.active;
    }
    const fm = this.flare.active > 0 ? 0.35 : 1;
    const gen = an.gen * fm;
    let eff = 1;
    if (demand <= gen + 1e-6) s.battery = Math.min(an.battery, s.battery + (gen - demand) * dt * 0.8);
    else if (s.battery > 0) s.battery = Math.max(0, s.battery - (demand - gen) * dt);
    else eff = gen / demand;
    s.battery = Math.min(s.battery, an.battery);
    eff = clamp(eff, 0.15, 1);
    s.eff = eff; s.demand = demand; s.gen = gen;
    // heat
    const cap = Math.max(30, an.heatCap);
    const envMult = this.sortie.env === "nebula" ? 0.65 : 1;
    const ratio = s.heat / cap;
    const dis = an.dissip * envMult * (0.4 + 1.2 * Math.min(1.5, ratio));
    s.heat = Math.max(0, s.heat + (an.idleHeat + an.engineHeat * throttle - dis) * dt);
    if (!s.overheated && s.heat >= cap) {
      s.overheated = true; this.stats.overheats++;
      audio.sfx("overheat"); this.say("OVERHEAT", "Weapons and shields offline", 2); this.addShake(0.4);
    }
    if (s.overheated) {
      if (s.heat < cap * 0.55) s.overheated = false;
      else {
        s.burn += dt;
        if (s.burn > 0.6 && s.cells.length) { s.burn = 0; const c = s.cells[(Math.random() * s.cells.length) | 0]; this.dealCell(c, 4); this.spark(c.wx, c.wy, 4, "#f97316", 80, 0.5, 2); }
      }
    }
    this.stats.maxHeat = Math.max(this.stats.maxHeat, s.heat / cap);
    const rm = 1 - Math.max(0, s.heat / cap - 0.85) * 2;
    // shields
    s.shieldDelay -= dt;
    if (s.shield > an.shieldCap) s.shield = an.shieldCap;
    if (!locked && s.shieldDelay <= 0 && s.shield < an.shieldCap) s.shield = Math.min(an.shieldCap, s.shield + an.shieldRegen * eff * dt);
    if (locked && s.shield > 0) s.shield = Math.max(0, s.shield - an.shieldCap * 0.4 * dt);
    for (const r of s.ripple) r.t -= dt;
    s.ripple = s.ripple.filter((r) => r.t > 0);
    // repair
    for (const rb of s.cells) {
      if (!rb.manned || MODS[rb.id].repair <= 0) continue;
      let tgt: Cell | null = null, br = 0.999;
      for (const c of s.cells) {
        if (Math.hypot(c.gx - rb.gx, c.gy - rb.gy) > 3.6) continue;
        const r = c.hp / c.max;
        if (r < br) { br = r; tgt = c; }
      }
      if (tgt) { tgt.hp = Math.min(tgt.max, tgt.hp + MODS[rb.id].repair * eff * dt); if (Math.random() < dt * 4) this.spark(tgt.wx, tgt.wy, 1, "#86efac", 40, 0.5, 2); }
    }
    // movement
    const accel = ((an.thrust * eff) + 2.5) / Math.max(10, an.mass) * 520;
    s.vx += mx * accel * dt; s.vy += my * accel * dt;
    const k = Math.exp(-1.1 * dt);
    s.vx *= k; s.vy *= k;
    const sp = Math.hypot(s.vx, s.vy);
    if (sp > 520) { s.vx *= 520 / sp; s.vy *= 520 / sp; }
    s.x += s.vx * dt; s.y += s.vy * dt;
    this.stats.dist += sp * dt;
    const turnRate = clamp((1.6 + an.torque * 0.9 * eff) * Math.sqrt(60 / Math.max(15, an.mass)), 0.8, 7);
    const dA = angDiff(aimA, s.angle);
    const step = clamp(dA, -turnRate * dt, turnRate * dt);
    s.angle += step;
    this.stats.turned += Math.abs(angDiff(aimA, this.lastAng)); this.lastAng = aimA;
    // arena bounds
    const dc = Math.hypot(s.x, s.y);
    this.oob = dc > ARENA - 100;
    if (dc > ARENA) { const nx = s.x / dc, ny = s.y / dc; s.x = nx * ARENA; s.y = ny * ARENA; const vo = s.vx * nx + s.vy * ny; if (vo > 0) { s.vx -= nx * vo * 1.5; s.vy -= ny * vo * 1.5; } }
    // rocks
    for (const r of this.rocks) {
      r.cd -= dt;
      const d0 = Math.hypot(r.x - s.x, r.y - s.y);
      if (d0 > r.r + s.r + 20) continue;
      for (const c of s.cells) {
        const dx = c.wx - r.x, dy = c.wy - r.y, d = Math.hypot(dx, dy);
        if (d < r.r * 0.85 + 6) {
          const nx = dx / (d || 1), ny = dy / (d || 1);
          s.x += nx * (r.r * 0.85 + 6 - d); s.y += ny * (r.r * 0.85 + 6 - d);
          const vn = s.vx * nx + s.vy * ny;
          if (vn < 0) { s.vx -= nx * vn * 1.6; s.vy -= ny * vn * 1.6; }
          if (r.cd <= 0) { r.cd = 0.5; this.dealCell(c, 3 + Math.abs(vn) * 0.06); this.spark(c.wx, c.wy, 8, "#a8a29e", 160, 0.5, 2); }
          break;
        }
      }
    }
    // engine exhaust
    if (throttle > 0.1) {
      const th = s.angle + Math.PI / 2;
      for (const c of s.engines) {
        if (Math.random() > 0.8) continue;
        const ex = s.x + c.lx * Math.cos(th) - (c.ly + CS * 0.6) * Math.sin(th), ey = s.y + c.lx * Math.sin(th) + (c.ly + CS * 0.6) * Math.cos(th);
        const ba = s.angle + Math.PI + rand(-0.15, 0.15);
        this.parts.push({ x: ex, y: ey, vx: Math.cos(ba) * rand(90, 180) + s.vx * 0.5, vy: Math.sin(ba) * rand(90, 180) + s.vy * 0.5, life: 0.35, max: 0.35, size: 3.2, color: "#fb923c", k: 0, rot: 0, vr: 0 });
      }
    }
    // weapons
    this.updateCellWorld();
    const dm = an.dmgMult;
    const fwd = { x: Math.cos(s.angle), y: Math.sin(s.angle) };
    for (const c of s.weapons) {
      const d = MODS[c.id], wp = d.weapon!;
      c.cd = Math.max(0, c.cd - dt * eff * Math.max(0.3, rm));
      c.flash = Math.max(0, c.flash - dt);
      if (wp.group === "turret") {
        if (c.tgt) { const want = Math.atan2(c.tgt.y - c.wy, c.tgt.x - c.wx); c.aim += clamp(angDiff(want, c.aim), -9 * dt, 9 * dt); }
        else c.aim += clamp(angDiff(s.angle, c.aim), -4 * dt, 4 * dt);
      }
      const on = wp.group === "cannon" ? fireC : wp.group === "missile" ? fireM : !!c.tgt && !locked && Math.abs(angDiff(Math.atan2(c.tgt!.y - c.wy, c.tgt!.x - c.wx), c.aim)) < 0.2;
      if (!on || c.cd > 0) continue;
      c.cd = 1 / wp.rate;
      s.heat += wp.heatShot;
      this.stats.shots++;
      const dmg = wp.dmg * dm;
      switch (wp.kind) {
        case "pulse": {
          const a = s.angle + rand(-0.018, 0.018);
          this.pb.push({ x: c.wx + fwd.x * 8, y: c.wy + fwd.y * 8, vx: Math.cos(a) * wp.speed + s.vx * 0.3, vy: Math.sin(a) * wp.speed + s.vy * 0.3, r: 4, dmg, life: wp.range / wp.speed, kind: "pulse", type: "energy", pierce: false, hit: [], target: null, blast: 0, hp: 1, color: "#f9a8d4", ion: false });
          audio.sfx("pulse"); c.flash = 0.06; break;
        }
        case "rail": {
          this.pb.push({ x: c.wx + fwd.x * 8, y: c.wy + fwd.y * 8, vx: fwd.x * wp.speed, vy: fwd.y * wp.speed, r: 5, dmg, life: wp.range / wp.speed, kind: "slug", type: "kinetic", pierce: true, hit: [], target: null, blast: 0, hp: 1, color: "#e9d5ff", ion: false });
          s.vx -= fwd.x * 40 / Math.max(1, an.mass / 30); s.vy -= fwd.y * 40 / Math.max(1, an.mass / 30);
          this.addShake(0.25); audio.sfx("rail"); this.spark(c.wx + fwd.x * 12, c.wy + fwd.y * 12, 8, "#d8b4fe", 260, 0.3, 2); c.flash = 0.1; break;
        }
        case "missile": {
          const side = Math.random() < 0.5 ? -1 : 1;
          const a = s.angle + side * 0.6;
          let target: Enemy | null = null, bd = 1e9;
          for (const e of this.enemies) {
            if (e.dead || e.warp > 0) continue;
            const ea = Math.atan2(e.y - s.y, e.x - s.x);
            const dd = Math.hypot(e.x - s.x, e.y - s.y);
            if (Math.abs(angDiff(ea, s.angle)) < 1.0 && dd < bd) { bd = dd; target = e; }
          }
          this.pb.push({ x: c.wx, y: c.wy, vx: Math.cos(a) * 120 + s.vx, vy: Math.sin(a) * 120 + s.vy, r: 5, dmg, life: 4.5, kind: "missile", type: "explosive", pierce: false, hit: [], target, blast: 62, hp: 1, color: "#fca5a5", ion: false });
          audio.sfx("missile"); break;
        }
        case "turret": {
          const a = c.aim + rand(-0.05, 0.05);
          this.pb.push({ x: c.wx + Math.cos(c.aim) * 7, y: c.wy + Math.sin(c.aim) * 7, vx: Math.cos(a) * wp.speed + s.vx * 0.3, vy: Math.sin(a) * wp.speed + s.vy * 0.3, r: 3, dmg, life: wp.range / wp.speed + 0.1, kind: "bullet", type: "kinetic", pierce: false, hit: [], target: null, blast: 0, hp: 1, color: "#fecdd3", ion: false });
          audio.sfx("turret", 0.8); break;
        }
      }
    }
    for (const c of s.cells) c.flash = Math.max(0, c.flash - dt);
  }

  updateFlow(dt: number) {
    if (this.state === "over") { this.stateT -= dt; if (this.stateT <= 0 && !this.ended) this.finish(false, false); return; }
    const live = this.enemies.filter((e) => !e.dead && e.type !== "mine").length;
    this.stateT -= dt;
    if (this.state === "intro" || this.state === "rest") {
      if (this.stateT <= 0) { this.wave++; this.spawnWave(); this.state = "fight"; }
    } else if (this.state === "fight") {
      if (live === 0) {
        if (this.wave >= this.totalWaves) {
          this.state = "done"; this.stateT = 3.2; this.magnet = 4;
          this.say("SORTIE COMPLETE", "Collecting salvage…", 3);
          audio.sfx("victory");
          for (const e of this.enemies) if (!e.dead) this.killEnemy(e, false);
        } else {
          this.state = "rest"; this.stateT = 3.4; this.magnet = 3;
          this.say("WAVE CLEARED", "Salvage magnet engaged", 2);
        }
      }
    } else if (this.state === "done") {
      if (this.stateT <= 0 && !this.ended) this.finish(true, false);
    }
    if (this.magnet > 0) this.magnet -= dt;
  }

  updateEnemies(dt: number) {
    const s = this.ship;
    for (const e of this.enemies) if (!e.dead) this.updateEnemy(e, dt);
    // separation
    const L = this.enemies;
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      if (a.dead || a.type === "mine") continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j];
        if (b.dead || b.type === "mine") continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
        if (d < m && d > 0.01) { const p = (m - d) * 0.5; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
      }
      const dc = Math.hypot(a.x, a.y);
      if (dc > ARENA - 40) { a.x *= (ARENA - 40) / dc; a.y *= (ARENA - 40) / dc; }
    }
    this.enemies = L.filter((e) => !e.dead);
    void s;
  }

  steer(e: Enemy, tx: number, ty: number, k: number, dt: number) {
    e.vx += (tx - e.vx) * Math.min(1, k * dt);
    e.vy += (ty - e.vy) * Math.min(1, k * dt);
    e.x += e.vx * dt; e.y += e.vy * dt;
  }
  orbit(e: Enemy, want: number, tang: number, dt: number, k = 2.5) {
    const s = this.ship;
    const dx = s.x - e.x, dy = s.y - e.y, d = Math.hypot(dx, dy) || 1;
    const rad = clamp((d - want) * 0.9, -160, 200);
    const nx = dx / d, ny = dy / d;
    this.steer(e, nx * rad - ny * tang * e.sgn, ny * rad + nx * tang * e.sgn, k, dt);
    e.angle = Math.atan2(dy, dx);
  }

  updateEnemy(e: Enemy, dt: number) {
    const s = this.ship;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt);
    if (e.warp > 0) { e.warp -= dt; if (e.warp <= 0) audio.sfx("spawn", 0.5); return; }
    if (s.dead) { this.steer(e, 0, 0, 1, dt); return; }
    const dx = s.x - e.x, dy = s.y - e.y, dist = Math.hypot(dx, dy) || 1, ang = Math.atan2(dy, dx);
    const em = this.em;
    switch (e.type) {
      case "drone": {
        const sp = 200 + this.si * 5;
        const a = ang + Math.sin(e.t * 4 + e.id) * 0.5;
        this.steer(e, Math.cos(a) * sp, Math.sin(a) * sp, 3, dt);
        e.angle = Math.atan2(e.vy, e.vx);
        if (dist < s.r + e.r + 14) {
          if (this.shieldUp() && dist < s.r + 10 + e.r) {
            const left = this.hitShield(e.x, e.y, 14 * em);
            if (left > 0) { const c = this.nearestCell(e.x, e.y); if (c) this.dealCell(c, left); }
            this.killEnemy(e, false);
          } else {
            const c = this.cell_near(e.x, e.y, e.r + 5);
            if (c) { this.dealCell(c, 14 * em); this.killEnemy(e, false); }
          }
        }
        break;
      }
      case "fighter": {
        this.orbit(e, 320, 170, dt);
        e.cd -= dt;
        if (e.cd <= 0 && dist < 750) { e.aux = 3; e.cd = 1.9; }
        if (e.aux > 0) {
          e.cd2 -= dt;
          if (e.cd2 <= 0) { this.ebullet(e.x, e.y, this.aimAngle(e, 430), 430, 6 * em, "bolt"); e.aux--; e.cd2 = 0.13; }
        }
        break;
      }
      case "bomber": {
        this.orbit(e, 520, 70, dt, 2);
        e.cd -= dt;
        if (e.cd <= 0 && dist < 900) { this.ebullet(e.x, e.y, ang + rand(-0.3, 0.3), 200, 20 * em, "missile", 7); e.cd = 3.3; }
        break;
      }
      case "ion": {
        this.orbit(e, 380, 120, dt);
        e.cd -= dt;
        if (e.cd <= 0 && dist < 800) { this.ebullet(e.x, e.y, this.aimAngle(e, 370), 370, 3.5 * em, "ion"); e.cd = 2.2; }
        break;
      }
      case "lancer": {
        this.orbit(e, 560, 50, dt, 1.5);
        e.cd -= dt;
        if (e.cd <= 0 && dist < 1000) { this.addBeam(e, 1.2, 36 * em); e.cd = 5.2; }
        break;
      }
      case "minelayer": {
        this.orbit(e, 450, 110, dt, 1.5);
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 2.4;
          if (this.countType("mine") < 10) { const m = this.spawnEnemy("mine", e.x, e.y, 0); m.vx = -Math.cos(ang) * 40; m.vy = -Math.sin(ang) * 40; }
        }
        break;
      }
      case "mine": {
        e.armed += dt;
        if (e.armed > 1.2) this.steer(e, Math.cos(ang) * 45, Math.sin(ang) * 45, 1, dt); else this.steer(e, e.vx * 0.97, e.vy * 0.97, 1, dt);
        if (e.armed > 1.2 && (dist < s.r + 40)) {
          const c = this.cell_near(e.x, e.y, 34);
          if (c || (this.shieldUp() && dist < s.r + 16)) { this.killEnemy(e, false); this.enemyBlast(e.x, e.y, 70, 32 * em); }
        }
        if (e.t > 32) this.killEnemy(e, false);
        break;
      }
      case "carrier": {
        this.orbit(e, 620, 40, dt, 1);
        e.cd -= dt; e.cd2 -= dt;
        if (e.cd <= 0) { e.cd = 5.5; if (this.countType("drone") < 9) { for (let i = 0; i < 2; i++) this.spawnEnemy("drone", e.x + rand(-20, 20), e.y + rand(-20, 20), 0.2); this.ftext(e.x, e.y - 30, "LAUNCH", "#c4b5fd", 12); } }
        if (e.cd2 <= 0 && dist < 800) { this.ebullet(e.x, e.y, this.aimAngle(e, 400), 400, 5 * em, "bolt"); e.cd2 = 1.4; }
        break;
      }
      case "boss1": this.bossMatriarch(e, dt, dist, ang, em); break;
      case "boss2": this.bossSovereign(e, dt, dist, ang, em); break;
    }
  }
  cell_near(x: number, y: number, r: number): Cell | null {
    for (const c of this.ship.cells) if ((c.wx - x) ** 2 + (c.wy - y) ** 2 < (r + 6) ** 2) return c;
    return null;
  }
  setPhase(e: Enemy, ph: number) {
    e.phase = ph;
    this.say(`PHASE ${ph}`, ENEMIES[e.type].name, 2);
    audio.sfx("bigboom", 0.7); this.addShake(0.8);
    this.boom(e.x, e.y, e.r * 1.4, ENEMIES[e.type].color);
  }
  bossMatriarch(e: Enemy, dt: number, _dist: number, ang: number, em: number) {
    const ratio = e.hp / e.max;
    const ph = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
    if (ph !== e.phase) { this.setPhase(e, ph); for (let i = 0; i < 2; i++) this.spawnEnemy("fighter", e.x + rand(-60, 60), e.y + rand(-60, 60), 0.8); }
    this.orbit(e, 520, 70, dt, 1.4);
    e.tm[0] -= dt; e.tm[1] -= dt; e.tm[2] -= dt; e.tm[3] -= dt;
    if (e.tm[0] <= 0) {
      const n = 3 + 2 * ph;
      for (let i = 0; i < n; i++) this.ebullet(e.x, e.y, ang + (i - (n - 1) / 2) * 0.16, 320, 6 * em, "bolt", 4);
      e.tm[0] = 2.9 - 0.5 * ph; audio.sfx("hit", 0.3);
    }
    if (e.tm[1] <= 0) {
      if (this.countType("drone") < 10) { for (let i = 0; i < 2 + ph; i++) this.spawnEnemy("drone", e.x + rand(-50, 50), e.y + rand(-50, 50), 0.3); this.ftext(e.x, e.y - 50, "SWARM", "#f0abfc", 14); }
      e.tm[1] = 9 - ph;
    }
    if (ph >= 2 && e.tm[2] <= 0) { this.addBeam(e, 1.3, 30 * em); e.tm[2] = 8 - ph; }
    if (ph >= 3 && e.tm[3] <= 0) { for (let i = 0; i < 2; i++) this.ebullet(e.x, e.y, ang + (i ? 0.6 : -0.6), 210, 20 * em, "missile", 7); e.tm[3] = 4.5; }
  }
  bossSovereign(e: Enemy, dt: number, _dist: number, ang: number, em: number) {
    const ratio = e.hp / e.max;
    const ph = ratio > 0.75 ? 1 : ratio > 0.5 ? 2 : ratio > 0.25 ? 3 : 4;
    if (ph !== e.phase) {
      this.setPhase(e, ph);
      const add: EType = ph === 2 ? "lancer" : ph === 3 ? "minelayer" : "fighter";
      for (let i = 0; i < 2; i++) this.spawnEnemy(add, e.x + rand(-80, 80), e.y + rand(-80, 80), 0.8);
    }
    this.orbit(e, 580, 60, dt, 1.2);
    for (let i = 0; i < 4; i++) e.tm[i] -= dt;
    const enr = ph === 4 ? 0.7 : 1;
    if (e.tm[0] <= 0) {
      e.spin += ph === 3 ? -0.33 : 0.33;
      const arms = ph;
      for (let a = 0; a < arms; a++) this.ebullet(e.x, e.y, e.spin + a * Math.PI * 2 / arms, 250, 5 * em, "orb", 6);
      e.tm[0] = 0.16 * enr + 0.04;
    }
    if (e.tm[1] <= 0) {
      const gap = ang + rand(-0.5, 0.5);
      for (let i = 0; i < 30; i++) { const a = e.spin + i * Math.PI * 2 / 30; if (Math.abs(angDiff(a, gap)) < 0.22) continue; this.ebullet(e.x, e.y, a, 230, 7 * em, "orb", 7); }
      e.tm[1] = 5.5 * enr; audio.sfx("warn", 0.5);
    }
    if (ph >= 2 && e.tm[2] <= 0) {
      this.addBeam(e, 1.4, 32 * em);
      if (ph === 4) { this.addBeam(e, 1.4, 32 * em, 0.22); this.addBeam(e, 1.4, 32 * em, -0.22); }
      e.tm[2] = 8.5;
    }
    if (ph >= 2 && e.tm[3] <= 0) {
      e.aux++;
      const kind = e.aux % 2 === 1 ? "heat" : "emp";
      this.rings.push({ x: e.x, y: e.y, r: 10, kind, hit: false });
      this.say(kind === "heat" ? "THERMAL SURGE" : "EMP STORM", kind === "heat" ? "Vent heat before impact!" : "Capacitors will be drained!", 2);
      audio.sfx("warn");
      e.tm[3] = 13;
    }
  }

  updateBeams(dt: number) {
    const s = this.ship;
    for (const b of this.beams) {
      if (b.src && !b.src.dead) { b.x = b.src.x; b.y = b.src.y; }
      if (!b.shot) {
        b.warn -= dt;
        if (b.warn > 0.35 && !s.dead) {
          const want = Math.atan2(s.y - b.y, s.x - b.x) + b.offset;
          b.ang += clamp(angDiff(want, b.ang), -1.5 * dt, 1.5 * dt);
        }
        if (b.warn <= 0) this.fireBeam(b);
      } else b.fire -= dt;
    }
    this.beams = this.beams.filter((b) => !b.shot || b.fire > 0).filter((b) => !(b.src && b.src.dead && !b.shot));
    for (const r of this.rings) {
      r.r += 380 * dt;
      const d = Math.hypot(s.x - r.x, s.y - r.y);
      if (!r.hit && r.r >= d && !s.dead) {
        r.hit = true;
        if (r.kind === "heat") { s.heat += s.an.heatCap * 0.35; this.ftext(s.x, s.y - 40, "THERMAL SURGE!", "#fb923c", 16); audio.sfx("overheat", 0.7); }
        else { s.battery = 0; s.shield = 0; s.shieldDelay = 4; this.ftext(s.x, s.y - 40, "EMP!", "#67e8f9", 16); audio.sfx("emp"); }
        this.addShake(0.5);
      }
    }
    this.rings = this.rings.filter((r) => r.r < 1100);
  }

  updateProjectiles(dt: number) {
    const s = this.ship;
    // player projectiles
    for (const p of this.pb) {
      if (p.kind === "missile") {
        if (!p.target || p.target.dead) {
          p.target = null; let bd = 600 * 600;
          for (const e of this.enemies) { if (e.dead || e.warp > 0) continue; const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2; if (d < bd) { bd = d; p.target = e; } }
        }
        let a = Math.atan2(p.vy, p.vx);
        if (p.target) a += clamp(angDiff(Math.atan2(p.target.y - p.y, p.target.x - p.x), a), -3.4 * dt, 3.4 * dt);
        const sp = Math.min(380, Math.hypot(p.vx, p.vy) + 260 * dt);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        if (Math.random() < 0.7) this.parts.push({ x: p.x, y: p.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.4, max: 0.4, size: 2.4, color: "#fdba74", k: 0, rot: 0, vr: 0 });
      }
      const ox = p.x, oy = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { if (p.kind === "missile") this.playerBlast(p); p.hp = 0; continue; }
      if (this.rocks.some((r) => (r.x - p.x) ** 2 + (r.y - p.y) ** 2 < (r.r * 0.85) ** 2)) { this.spark(p.x, p.y, 4, "#a8a29e", 120, 0.3); if (p.kind === "missile") this.playerBlast(p); p.hp = 0; continue; }
      // enemy missiles
      for (const m of this.eb) {
        if (m.kind !== "missile" || m.hp <= 0) continue;
        if ((m.x - p.x) ** 2 + (m.y - p.y) ** 2 < (m.r + p.r + 4) ** 2) {
          m.hp -= p.dmg;
          if (m.hp <= 0) { this.boom(m.x, m.y, 10, "#fb7185"); audio.sfx("boom", 0.4); this.ftext(m.x, m.y - 8, "INTERCEPT", "#a7f3d0", 11); }
          if (!p.pierce) p.hp = 0;
          break;
        }
      }
      if (p.hp <= 0) continue;
      for (const e of this.enemies) {
        if (e.dead || e.warp > 0) continue;
        if (p.pierce && p.hit.includes(e.id)) continue;
        if (segD2(ox, oy, p.x, p.y, e.x, e.y) < (e.r + p.r) ** 2) {
          if (p.kind === "missile") { this.playerBlast(p, e); p.hp = 0; break; }
          this.hurtEnemy(e, p.dmg, p.type, p.x, p.y);
          if (p.pierce) p.hit.push(e.id); else { p.hp = 0; break; }
        }
      }
    }
    this.pb = this.pb.filter((p) => p.hp > 0);
    // enemy projectiles
    for (const p of this.eb) {
      if (p.kind === "missile") {
        let a = Math.atan2(p.vy, p.vx);
        if (!s.dead) a += clamp(angDiff(Math.atan2(s.y - p.y, s.x - p.x), a), -1.5 * dt, 1.5 * dt);
        const sp = Math.min(240, Math.hypot(p.vx, p.vy) + 80 * dt);
        p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        if (Math.random() < 0.6) this.parts.push({ x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.5, max: 0.5, size: 2.4, color: "#fb7185", k: 0, rot: 0, vr: 0 });
      }
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if (p.life <= 0) { if (p.kind === "missile") this.boom(p.x, p.y, 8, "#fb7185"); p.hp = -1; continue; }
      if (this.rocks.some((r) => (r.x - p.x) ** 2 + (r.y - p.y) ** 2 < (r.r * 0.85) ** 2)) { this.spark(p.x, p.y, 3, "#a8a29e", 100, 0.3); p.hp = -1; continue; }
      if (s.dead || p.hp <= 0) { if (p.hp <= 0) p.hp = -1; continue; }
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      let hit = false;
      if (d < s.r + 14) {
        if (this.shieldUp() && d < s.r + 10) {
          hit = true;
          if (p.ion) this.ionEffect(0.4);
          const left = this.hitShield(p.x, p.y, p.dmg);
          if (p.kind === "missile") this.spark(p.x, p.y, 10, "#fb7185", 160, 0.5);
          if (left > 0) { const c = this.nearestCell(p.x, p.y); if (c) this.dealCell(c, left); }
        } else {
          const c = this.cellAt(p.x, p.y);
          if (c) {
            hit = true;
            if (p.ion) this.ionEffect(1);
            if (p.kind === "missile") this.enemyBlast(p.x, p.y, p.blast + 6, p.dmg);
            else this.dealCell(c, p.dmg);
          }
        }
      }
      if (hit) p.hp = -1;
    }
    this.eb = this.eb.filter((p) => p.hp > 0);
  }
  ionEffect(k: number) {
    const s = this.ship;
    s.battery = Math.max(0, s.battery - 18 * k);
    s.heat += 7 * k;
    this.ftext(s.x, s.y - 30, "ION BLEED", "#67e8f9", 12);
  }
  playerBlast(p: Proj, direct?: Enemy) {
    this.boom(p.x, p.y, p.blast * 0.7, "#fb923c");
    audio.sfx("boom", 0.6); this.addShake(0.2);
    for (const e of this.enemies) {
      if (e.dead || e.warp > 0) continue;
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < p.blast + e.r) this.hurtEnemy(e, p.dmg * (e === direct ? 1 : 0.55 * (1 - d / (p.blast + e.r) * 0.5) + 0.1), "explosive", e.x, e.y);
    }
  }

  updatePicks(dt: number) {
    const s = this.ship;
    const mag = 100 + (s.an.count.cargo || 0) * 25;
    for (const p of this.picks) {
      p.life -= dt;
      const d = Math.hypot(s.x - p.x, s.y - p.y) || 1;
      const pull = this.magnet > 0 || d < mag;
      if (pull && !s.dead) { const sp = 320 + (this.magnet > 0 ? 400 : 0); p.vx += ((s.x - p.x) / d * sp - p.vx) * Math.min(1, 5 * dt); p.vy += ((s.y - p.y) / d * sp - p.vy) * Math.min(1, 5 * dt); }
      else { p.vx *= Math.exp(-1.5 * dt); p.vy *= Math.exp(-1.5 * dt); }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (!s.dead && d < s.r * 0.6 + 12) {
        p.life = 0;
        this.stats.pickups++;
        audio.sfx("pickup", 0.7);
        if (p.kind === "scrap") { this.stats.scrap += p.v; this.ftext(p.x, p.y - 10, `+${p.v}¢`, "#fde047", 13); }
        else if (p.kind === "repair") { for (const c of s.cells) c.hp = Math.min(c.max, c.hp + c.max * 0.3); this.ftext(p.x, p.y - 10, "HULL REPAIRED", "#86efac", 14); }
        else if (p.kind === "cell") { s.battery = s.an.battery; s.shield = s.an.shieldCap; this.ftext(p.x, p.y - 10, "POWER CELL", "#a3e635", 14); }
        else { s.heat = Math.max(0, s.heat - s.an.heatCap * 0.45); this.ftext(p.x, p.y - 10, "COOLANT", "#7dd3fc", 14); }
      }
    }
    this.picks = this.picks.filter((p) => p.life > 0);
  }

  updateFx(dt: number) {
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.k !== 1) { p.vx *= Math.exp(-1.2 * dt); p.vy *= Math.exp(-1.2 * dt); } }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 34 * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  updateTutorial(dt: number, inp: Input) {
    if (!this.opts.tutorial || this.tutStep >= 5) return;
    this.tutT += dt;
    const st = this.stats;
    const next = () => { this.tutStep++; this.tutT = 0; audio.sfx("ui"); };
    if (this.tutStep === 0 && (st.dist > 300 || Math.hypot(inp.mx, inp.my) > 0.3 && this.tutT > 4)) next();
    else if (this.tutStep === 1 && (st.turned > 3 || this.tutT > 8)) next();
    else if (this.tutStep === 2 && (st.shots >= 4 || this.tutT > 12)) next();
    else if (this.tutStep === 3 && (st.vents > 0 || this.tutT > 9)) next();
    else if (this.tutStep === 4 && (st.pickups > 0 || this.tutT > 9)) next();
  }
  tutHint(): string | null {
    if (!this.opts.tutorial) return null;
    return [
      "Fly with W A S D (or arrow keys).",
      "Move the MOUSE to aim – your ship turns to face the cursor. Heavier ships turn slower.",
      "Hold LEFT MOUSE (or J) to fire your cannons. Turrets aim themselves.",
      "Firing builds HEAT. When the heat bar nears full, press SPACE to emergency-vent.",
      "Fly over scrap to bank credits. Clear every wave to win the sortie.",
    ][this.tutStep] || null;
  }

  /* ------------------------- end of run ------------------------- */
  finish(win: boolean, retreat: boolean) {
    if (this.ended) return;
    const st = this.stats;
    const boss = !!this.sortie.boss;
    const si = this.si;
    const bonus = win ? Math.round((120 + 50 * si) * this.credMult) : 0;
    const data = win && !this.opts.replay ? (si > 8 ? 2 + (boss ? 2 : 0) : 3 + (boss ? 3 : 0)) : 0;
    const keep = win ? 1 : retreat ? 0.5 : 0.25;
    const scrap = Math.round(st.scrap * keep);
    const repairBill = win || retreat ? Math.round(this.lostValue * 0.3) : 0;
    const hullPct = this.ship.dead ? 0 : Math.round(this.hullPct() * 100);
    const score = Math.round(st.scoreKills + hullPct * 5 + (win ? 500 + si * 100 : 0));
    const rank = !win ? "D" : hullPct >= 80 ? "S" : hullPct >= 55 ? "A" : hullPct >= 30 ? "B" : "C";
    this.ended = {
      win, retreat, sortie: si, kills: st.kills, byType: st.byType, dmgDealt: st.dmgDealt, dmgTaken: Math.round(st.dmgTaken), shieldAbsorbed: Math.round(st.shieldAbsorbed),
      shots: st.shots, hits: st.hits, time: this.t, scrap, bonus, repairBill, data, cellsLost: st.cellsLost, maxHeat: st.maxHeat, overheats: st.overheats, vents: st.vents,
      hullPct, score, rank, wave: this.wave, totalWaves: this.totalWaves, boss,
    };
    if (!win && !retreat) audio.sfx("defeat");
  }

  hud(): HudData {
    const s = this.ship;
    const live = this.enemies.filter((e) => !e.dead && e.type !== "mine");
    const b = live.find((e) => e.type === "boss1" || e.type === "boss2");
    let ready = 0;
    for (const c of s.weapons) if (MODS[c.id].weapon!.group === "missile" && c.cd <= 0) ready++;
    return {
      hullPct: this.hullPct(), shield: s.shield, shieldMax: s.an.shieldCap, heat: s.heat, heatMax: Math.max(30, s.an.heatCap), overheated: s.overheated,
      ventCd: s.ventCd, ventLock: s.ventLock, gen: s.gen, demand: s.demand, eff: s.eff, battery: s.battery, batteryMax: s.an.battery,
      crewUsed: s.an.crewUsed, crewNeed: s.an.crewNeed, wave: Math.min(this.wave, this.totalWaves), totalWaves: this.totalWaves, enemies: live.length,
      boss: b ? { name: ENEMIES[b.type].name, pct: clamp(b.hp / b.max, 0, 1), phase: b.phase } : null,
      credits: this.stats.scrap, kills: this.stats.kills, time: this.t, banner: this.banner, hint: this.tutHint(),
      flare: this.flare.warn > 0 ? 1 : this.flare.active > 0 ? 2 : 0, oob: this.oob, ended: !!this.ended, missileReady: ready, sortieName: this.sortie.name,
    };
  }

  /* ------------------------- drawing ------------------------- */
  draw(ctx: CanvasRenderingContext2D) {
    const { W, H, zoom } = this;
    const s = this.ship;
    ctx.fillStyle = "#050813";
    ctx.fillRect(0, 0, W, H);
    // stars
    for (const st of this.stars) {
      const sx = (((st.x - this.cam.x * st.z * zoom) % W) + W) % W;
      const sy = (((st.y - this.cam.y * st.z * zoom) % H) + H) % H;
      ctx.globalAlpha = 0.35 + st.z;
      ctx.fillStyle = st.c;
      ctx.fillRect(sx, sy, st.s, st.s);
    }
    ctx.globalAlpha = 1;
    const shx = (Math.random() - 0.5) * this.shake * 14 * this.opts.shake, shy = (Math.random() - 0.5) * this.shake * 14 * this.opts.shake;
    ctx.save();
    ctx.translate(W / 2 + shx, H / 2 + shy);
    ctx.scale(zoom, zoom);
    ctx.translate(-this.cam.x, -this.cam.y);
    // fog
    for (const f of this.fog) {
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, `rgba(${f.c},0.16)`); g.addColorStop(1, `rgba(${f.c},0)`);
      ctx.fillStyle = g; ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    // arena ring
    ctx.strokeStyle = "rgba(244,63,94,0.35)"; ctx.lineWidth = 4; ctx.setLineDash([30, 24]);
    ctx.beginPath(); ctx.arc(0, 0, ARENA + 20, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    // rocks
    for (const r of this.rocks) {
      ctx.beginPath();
      r.pts.forEach((p, i) => { const a = i / r.pts.length * Math.PI * 2; const x = r.x + Math.cos(a) * r.r * p, y = r.y + Math.sin(a) * r.r * p; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fillStyle = "#292524"; ctx.fill(); ctx.strokeStyle = "#78716c"; ctx.lineWidth = 3; ctx.stroke();
    }
    // pickups
    for (const p of this.picks) {
      if (p.life < 3 && Math.floor(p.life * 6) % 2 === 0) continue;
      const col = p.kind === "scrap" ? "#fde047" : p.kind === "repair" ? "#4ade80" : p.kind === "cell" ? "#a3e635" : "#7dd3fc";
      ctx.fillStyle = col; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(this.t * 2);
      if (p.kind === "scrap") ctx.fillRect(-4, -4, 8, 8);
      else { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.stroke(); ctx.fillRect(-2, -2, 4, 4); }
      ctx.restore();
    }
    // beams (telegraph)
    for (const b of this.beams) {
      if (!b.shot) {
        const a = clamp(1 - b.warn / 1.3, 0, 1);
        ctx.strokeStyle = `rgba(253,224,71,${0.15 + a * 0.5})`; ctx.lineWidth = 1 + a * 3; ctx.setLineDash([12, 10]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + Math.cos(b.ang) * b.len, b.y + Math.sin(b.ang) * b.len); ctx.stroke(); ctx.setLineDash([]);
      } else {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(253,224,71,${b.fire / 0.3})`; ctx.lineWidth = 14 * (b.fire / 0.3) + 2;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.endX, b.endY); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${b.fire / 0.3})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.endX, b.endY); ctx.stroke();
        ctx.globalCompositeOperation = "source-over";
      }
    }
    // rings
    for (const r of this.rings) {
      ctx.strokeStyle = r.kind === "heat" ? "rgba(251,146,60,0.8)" : "rgba(103,232,249,0.8)"; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2); ctx.stroke();
    }
    // enemies
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    // ship
    if (!s.dead) this.drawShip(ctx);
    // projectiles
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.pb) {
      ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
      if (p.kind === "slug") { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); }
      else if (p.kind === "pulse") { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === "missile" ? 4 : 2.5, 0, 7); ctx.fill(); }
    }
    for (const p of this.eb) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    // particles
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.k === 1) {
        ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a) * 1.8 + 2, 0, 7); ctx.stroke();
      } else if (p.k === 3) {
        ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = a;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.restore();
        ctx.globalCompositeOperation = "lighter";
      } else {
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.6), 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    // floating text
    ctx.textAlign = "center";
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / t.max * 1.5, 0, 1);
      ctx.font = `bold ${t.size}px Rajdhani, system-ui, sans-serif`;
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.7)"; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    // aim reticle
    if (!s.dead && !this.touch) {
      ctx.strokeStyle = "rgba(125,211,252,0.7)"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(this.aim.x, this.aim.y, 10, 0, 7); ctx.moveTo(this.aim.x - 16, this.aim.y); ctx.lineTo(this.aim.x - 6, this.aim.y); ctx.moveTo(this.aim.x + 16, this.aim.y); ctx.lineTo(this.aim.x + 6, this.aim.y); ctx.moveTo(this.aim.x, this.aim.y - 16); ctx.lineTo(this.aim.x, this.aim.y - 6); ctx.moveTo(this.aim.x, this.aim.y + 16); ctx.lineTo(this.aim.x, this.aim.y + 6); ctx.stroke();
    }
    ctx.restore();
    this.drawOverlay(ctx);
  }

  drawShip(ctx: CanvasRenderingContext2D) {
    const s = this.ship;
    ctx.save();
    ctx.translate(s.x, s.y);
    if (s.overheated || s.heat > s.an.heatCap * 0.85) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.t * 14);
      ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(0, 0, s.r + 6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.rotate(s.angle + Math.PI / 2);
    const firing = s.throttle > 0.1;
    for (const c of s.cells) {
      const d = MODS[c.id];
      drawModule(ctx, c.id, c.lx, c.ly, CS, {
        t: this.t, hpRatio: c.hp / c.max, flash: c.flash, unmanned: !c.manned, aim: d.weapon?.group === "turret" ? c.aim - s.angle : 0,
        active: c.id === "engine" ? firing : c.flash > 0,
      });
    }
    ctx.restore();
    // shield bubble
    if (this.shieldUp()) {
      const R = s.r + 10, r = clamp(s.shield / Math.max(1, s.an.shieldCap), 0, 1);
      const g = ctx.createRadialGradient(s.x, s.y, R * 0.7, s.x, s.y, R);
      g.addColorStop(0, "rgba(34,211,238,0)"); g.addColorStop(1, `rgba(34,211,238,${0.1 + r * 0.25})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, 7); ctx.fill();
      ctx.strokeStyle = `rgba(103,232,249,${0.2 + r * 0.4})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, 7); ctx.stroke();
      for (const rp of s.ripple) {
        ctx.strokeStyle = `rgba(255,255,255,${rp.t / 0.45})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(s.x, s.y, R, rp.a - 0.45, rp.a + 0.45); ctx.stroke();
      }
    }
  }

  drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    const def = ENEMIES[e.type];
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.warp > 0) {
      ctx.strokeStyle = def.color; ctx.globalAlpha = 0.6; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, e.r * (1 + e.warp * 1.5), 0, 7); ctx.stroke();
      ctx.restore();
      return;
    }
    const r = e.r;
    ctx.globalAlpha = 0.18; ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    ctx.rotate(e.angle);
    const body = e.flash > 0 ? "#ffffff" : shade(def.color, -0.72);
    ctx.fillStyle = body; ctx.strokeStyle = def.color; ctx.lineWidth = 2;
    const poly = (pts: number[][]) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * r, y * r) : ctx.moveTo(x * r, y * r))); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    switch (e.type) {
      case "drone": poly([[1, 0], [-0.8, 0.7], [-0.4, 0], [-0.8, -0.7]]); break;
      case "fighter": poly([[1.1, 0], [-0.7, 0.95], [-0.3, 0], [-0.7, -0.95]]); break;
      case "bomber": poly([[1, 0], [0.4, 0.8], [-0.8, 0.8], [-1, 0], [-0.8, -0.8], [0.4, -0.8]]); ctx.fillStyle = def.color; ctx.fillRect(-r * 0.2, -r * 0.55, r * 0.5, r * 0.18); ctx.fillRect(-r * 0.2, r * 0.37, r * 0.5, r * 0.18); break;
      case "ion": poly([[1, 0], [0, 0.85], [-1, 0], [0, -0.85]]); ctx.beginPath(); ctx.arc(0, 0, r * 0.35 + Math.sin(this.t * 8) * 1.5, 0, 7); ctx.stroke(); break;
      case "lancer": poly([[1.4, 0], [0.2, 0.5], [-1, 0.85], [-0.7, 0], [-1, -0.85], [0.2, -0.5]]); ctx.fillStyle = def.color; ctx.fillRect(0, -2, r * 1.3, 4); break;
      case "minelayer": poly([[1, 0.4], [0.4, 1], [-0.4, 1], [-1, 0.4], [-1, -0.4], [-0.4, -1], [0.4, -1], [1, -0.4]]); break;
      case "carrier": poly([[1, 0.3], [0.7, 0.9], [-0.9, 0.9], [-1, 0.4], [-1, -0.4], [-0.9, -0.9], [0.7, -0.9], [1, -0.3]]); ctx.strokeRect(-r * 0.5, -r * 0.4, r * 0.9, r * 0.8); break;
      case "mine": {
        const armed = e.armed > 1.2;
        ctx.fillStyle = armed ? (Math.floor(this.t * 6) % 2 ? "#7f1d1d" : "#450a0a") : "#1a2e05"; ctx.strokeStyle = armed ? "#f87171" : def.color;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * r * 1.5, Math.sin(a) * r * 1.5); ctx.stroke(); }
        break;
      }
      case "boss1": {
        const pts: number[][] = [];
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; const k = i % 2 ? 0.7 : 1.1; pts.push([Math.cos(a) * k, Math.sin(a) * k * 0.9]); }
        poly(pts);
        ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(0, 0, r * (0.25 + 0.05 * Math.sin(this.t * 5)), 0, 7); ctx.fill();
        ctx.strokeRect(-r * 0.5, -r * 0.3, r, r * 0.6);
        break;
      }
      case "boss2": {
        for (let k = 0; k < 3; k++) {
          ctx.save(); ctx.rotate(this.t * (k % 2 ? -0.5 : 0.7) * (1 + k * 0.3));
          const n = 5 + k; const pts: number[][] = [];
          for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rr = 1 - k * 0.25; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
          ctx.globalAlpha = 0.9; poly(pts); ctx.restore();
        }
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, 0, r * (0.2 + 0.05 * Math.sin(this.t * 7)), 0, 7); ctx.fill();
        break;
      }
    }
    ctx.restore();
    if (e.hp < e.max && e.type !== "mine" && e.r < 30) {
      ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2, 4);
      ctx.fillStyle = "#f87171"; ctx.fillRect(e.x - e.r, e.y - e.r - 10, e.r * 2 * clamp(e.hp / e.max, 0, 1), 4);
    }
  }

  drawOverlay(ctx: CanvasRenderingContext2D) {
    const { W, H, zoom } = this;
    const s = this.ship;
    // flare vignette
    if (this.flare.warn > 0 || this.flare.active > 0) {
      const a = this.flare.active > 0 ? 0.28 : 0.1 + 0.08 * Math.sin(this.t * 10);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(251,146,60,0)"); g.addColorStop(1, `rgba(251,146,60,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (s.overheated) { ctx.fillStyle = `rgba(239,68,68,${0.08 + 0.05 * Math.sin(this.t * 12)})`; ctx.fillRect(0, 0, W, H); }
    if (this.hullPct() < 0.3 && !s.dead) { ctx.fillStyle = `rgba(239,68,68,${0.05 + 0.05 * Math.sin(this.t * 6)})`; ctx.fillRect(0, 0, W, H); }
    // offscreen indicators
    let n = 0;
    for (const e of this.enemies) {
      if (e.warp > 0 || e.type === "mine") continue;
      const sx = (e.x - this.cam.x) * zoom + W / 2, sy = (e.y - this.cam.y) * zoom + H / 2;
      if (sx > 20 && sx < W - 20 && sy > 20 && sy < H - 20) continue;
      if (n++ > 10) break;
      const a = Math.atan2(sy - H / 2, sx - W / 2);
      const k = Math.min((W / 2 - 24) / Math.abs(Math.cos(a) || 1e-6), (H / 2 - 24) / Math.abs(Math.sin(a) || 1e-6));
      const px = W / 2 + Math.cos(a) * k, py = H / 2 + Math.sin(a) * k;
      ctx.save(); ctx.translate(px, py); ctx.rotate(a);
      ctx.fillStyle = e.r > 24 ? "#f0abfc" : "#f87171"; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, 7); ctx.lineTo(-6, -7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // radar
    const rr = 62, rx = W - rr - 16, ry = this.touch ? H - rr - 210 : H - rr - 16;
    ctx.fillStyle = "rgba(5,10,25,0.7)"; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 7); ctx.fill();
    ctx.strokeStyle = "rgba(56,189,248,0.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(rx, ry, rr / 2, 0, 7); ctx.stroke();
    const sc = rr / 1100;
    ctx.save(); ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 7); ctx.clip();
    ctx.strokeStyle = "rgba(244,63,94,0.5)"; ctx.beginPath(); ctx.arc(rx - s.x * sc, ry - s.y * sc, ARENA * sc, 0, 7); ctx.stroke();
    for (const e of this.enemies) { ctx.fillStyle = e.r > 24 ? "#f0abfc" : e.type === "mine" ? "#bef264" : "#f87171"; ctx.beginPath(); ctx.arc(rx + (e.x - s.x) * sc, ry + (e.y - s.y) * sc, e.r > 24 ? 4 : 2, 0, 7); ctx.fill(); }
    for (const p of this.picks) { ctx.fillStyle = "#fde047"; ctx.fillRect(rx + (p.x - s.x) * sc - 1, ry + (p.y - s.y) * sc - 1, 2, 2); }
    ctx.restore();
    ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.arc(rx, ry, 3, 0, 7); ctx.fill();
    ctx.strokeStyle = "#38bdf8"; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + Math.cos(s.angle) * 12, ry + Math.sin(s.angle) * 12); ctx.stroke();
    // damage schematic
    const cs = 6, gw = this.hull.w * cs, gh = this.hull.h * cs;
    const ox = 14, oy = H - gh - 14;
    ctx.fillStyle = "rgba(5,10,25,0.6)"; ctx.fillRect(ox - 6, oy - 6, gw + 12, gh + 12);
    for (const o of s.orig) {
      const x = ox + o.gx * cs, y = oy + o.gy * cs;
      const c = s.grid[o.gy * this.hull.w + o.gx];
      if (!c) { ctx.strokeStyle = "rgba(100,116,139,0.5)"; ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1); continue; }
      const r = c.hp / c.max;
      ctx.fillStyle = c.flash > 0 ? "#fff" : `hsl(${r * 120},75%,${c.manned ? 50 : 28}%)`;
      ctx.fillRect(x, y, cs - 1, cs - 1);
    }
    ctx.fillStyle = "rgba(148,163,184,0.8)"; ctx.font = "10px Rajdhani, sans-serif"; ctx.textAlign = "left";
    ctx.fillText("HULL", ox, oy - 9);
    ctx.textAlign = "start";
  }
}
