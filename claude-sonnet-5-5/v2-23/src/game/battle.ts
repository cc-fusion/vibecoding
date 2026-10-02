import { PARTS, STAT_MULT, FX_MULT, RESONANCE, SYNERGIES, TAGS, ZERO_MODS, TAG_META, type Mods, type Tag, type BossDef } from "./data";
import { audio } from "./audio";
import { drawChimera, drawTierPips, shade, type DrawPart } from "./draw";
import type { Settings } from "./save";

export interface PartInst { id: string; tier: number; uid: number }
export interface Chimera { name: string; parts: (PartInst | null)[] }

export const W = 960;
export const H = 540;
const BASE_HP = 40, BASE_ATK = 4, INTERVAL = 1.6, SUDDEN = 40; // SUDDEN = seconds until Overload

export interface SynResult { counts: Record<Tag, number>; level: Record<Tag, number>; mods: Mods }
export function computeSynergy(team: Chimera[]): SynResult {
  const counts = { feral: 0, scale: 0, chitin: 0, plume: 0, void: 0 } as Record<Tag, number>;
  const level = { feral: -1, scale: -1, chitin: -1, plume: -1, void: -1 } as Record<Tag, number>;
  for (const ch of team) for (const p of ch.parts) if (p && PARTS[p.id]) counts[PARTS[p.id].tag]++;
  const mods: Mods = { ...ZERO_MODS };
  for (const tag of TAGS) {
    SYNERGIES[tag].forEach((s, i) => { if (counts[tag] >= s.n) level[tag] = i; });
    if (level[tag] >= 0) {
      const m = SYNERGIES[tag][level[tag]].mod;
      for (const k of Object.keys(m) as (keyof Mods)[]) mods[k] += m[k] ?? 0;
    }
  }
  return { counts, level, mods };
}

export function chimeraBond(ch: Chimera): "pure" | "mosaic" | null {
  if (ch.parts.some((p) => !p)) return null;
  const tags = ch.parts.map((p) => PARTS[p!.id].tag);
  const set = new Set(tags);
  if (set.size === 1) return "pure";
  if (set.size === 4) return "mosaic";
  return null;
}

export interface Derived {
  hp: number; atk: number; spd: number; def: number; crit: number; dodge: number; leech: number; reflect: number;
  venom: number; potent: number; shield: number; regen: number; toxic: number; pierce: number; slam: number; cleave: number;
  rampage: number; howl: number; ward: number; inspire: number; deathblast: number; weaken: number; breath: number;
  snipe: boolean; bloodlust: boolean; infest: boolean; reap: boolean; bond: "pure" | "mosaic" | null; resonant: number;
}
export interface DeriveOpts { hpMult: number; atkMult: number; glass: boolean; labHp: number; labAtk: number }

export function deriveStats(ch: Chimera, pos: number, syn: Mods, o: DeriveOpts): Derived {
  let hp = BASE_HP, atk = BASE_ATK, spd = 0, def = 0, resonant = 0;
  const fx: Record<string, number> = {};
  for (const p of ch.parts) {
    if (!p) continue;
    const d = PARTS[p.id];
    if (!d) continue;
    const boost = d.row === pos ? RESONANCE : 1;
    if (boost > 1) resonant++;
    const m = STAT_MULT[p.tier] * boost;
    hp += d.hp * m; atk += d.atk * m; spd += d.spd * m; def += d.def * m;
    fx[d.fx] = (fx[d.fx] ?? 0) + d.v * FX_MULT[p.tier] * boost;
  }
  const bond = chimeraBond(ch);
  const bm = bond === "pure" ? 1.2 : bond === "mosaic" ? 1.12 : 1;
  const g = (k: string) => fx[k] ?? 0;
  return {
    hp: Math.max(10, hp * (1 + syn.hpPct) * bm * o.hpMult * (o.glass ? 0.7 : 1) * (1 + o.labHp)),
    atk: Math.max(1, atk * (1 + syn.atkPct) * bm * o.atkMult * (o.glass ? 1.4 : 1) * (1 + o.labAtk)),
    spd: 1 + spd + syn.spdPct, def: def + syn.def,
    crit: Math.min(0.8, g("crit") + syn.crit), dodge: Math.min(0.6, g("dodge") + syn.dodge),
    leech: Math.min(0.8, g("leech") + syn.leech), reflect: Math.min(0.8, g("reflect") + syn.reflect),
    venom: g("venom") + syn.venom, potent: g("potent") + syn.potent, shield: g("barrier") + syn.shield,
    regen: g("regen"), toxic: g("toxic"), pierce: Math.min(0.9, g("pierce")), slam: Math.min(0.7, g("slam")),
    cleave: g("cleave"), rampage: g("rampage"), howl: g("howl"), ward: g("ward"), inspire: g("inspire"),
    deathblast: g("deathblast"), weaken: Math.min(0.7, g("weaken")), breath: g("breath"),
    snipe: g("snipe") > 0, bloodlust: syn.bloodlust > 0, infest: syn.infest > 0, reap: syn.reap > 0, bond, resonant,
  };
}

export function previewTeam(team: Chimera[], o: DeriveOpts) {
  const syn = computeSynergy(team);
  return { syn, stats: team.map((c, i) => deriveStats(c, i, syn.mods, o)) };
}

interface Unit {
  id: number; side: "p" | "e"; pos: number; name: string; parts: (DrawPart | null)[]; s: Derived; syn: Mods;
  hp: number; maxHp: number; shield: number; cd: number; alive: boolean;
  poison: number; poisonT: number; pPot: number; weakV: number; weakT: number; stun: number; ramp: number; attacks: number; wardT: number;
  boss?: BossDef; bossT: number; phase: number; enrage: number;
  x: number; y: number; scale: number; lunge: number; flash: number; deadT: number; phaseOff: number;
  dmg: number; taken: number; kills: number; healed: number; hurtShake: number;
}
export interface UnitReport { name: string; dmg: number; taken: number; kills: number; healed: number; alive: boolean; side: "p" | "e" }
export interface BattleResult { outcome: "win" | "lose" | "draw"; time: number; units: UnitReport[]; kills: number; dmg: number; survivors: number; bossDown: boolean }

interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number }
interface Floater { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
interface Beam { x1: number; y1: number; x2: number; y2: number; life: number; color: string }
interface Ring { x: number; y: number; r: number; max: number; life: number; color: string }
interface Tele { left: number; total: number; text: string; color: string; fn: () => void }

export interface BattleConfig {
  player: Chimera[]; enemy: Chimera[]; round: number; boss: BossDef | null; bossScale: number;
  pOpts: DeriveOpts; eOpts: DeriveOpts; settings: Settings; enemyTag: Tag | null; bossPoison: number;
}

const XS = [370, 250, 130];
const YS = [430, 390, 350];
const SZ = [1.5, 1.4, 1.3];
const ease = (p: number) => 1 - Math.pow(1 - p, 3);

export class BattleEngine {
  units: Unit[] = [];
  time = 0;
  state: "intro" | "fight" | "end" = "intro";
  introT = 1.6;
  endT = 0;
  done = false;
  outcome: "win" | "lose" | "draw" = "draw";
  particles: Particle[] = [];
  floaters: Floater[] = [];
  beams: Beam[] = [];
  rings: Ring[] = [];
  teles: Tele[] = [];
  shake = 0;
  slow = 0;
  banner: { text: string; sub: string; color: string; t: number } | null = null;
  redFlash = 0;
  synP: Mods; synE: Mods;
  result: BattleResult | null = null;
  bossDown = false;
  private uid = 1;
  private ember = 0;
  private cfg: BattleConfig;

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    const sp = computeSynergy(cfg.player), se = computeSynergy(cfg.enemy);
    this.synP = sp.mods; this.synE = se.mods;
    cfg.player.forEach((c, i) => this.units.push(this.mk(c, i, "p", deriveStats(c, i, sp.mods, cfg.pOpts))));
    cfg.enemy.forEach((c, i) => {
      let d = deriveStats(c, i, se.mods, cfg.eOpts);
      const isBoss = !!cfg.boss && i === cfg.boss.pos;
      if (isBoss && cfg.boss) d = { ...d, hp: d.hp * cfg.boss.hpMult * cfg.bossScale, atk: d.atk * cfg.boss.atkMult * (1 + (cfg.bossScale - 1) * 0.5) };
      const u = this.mk(c, i, "e", d);
      if (isBoss && cfg.boss) { u.boss = cfg.boss; u.scale = SZ[i] * 1.3; u.bossT = cfg.boss.id === "tyrant" ? 4 : cfg.boss.id === "prime" ? 6 : 5; }
      this.units.push(u);
    });
    // opening effects: barriers and wards
    for (const u of this.units) {
      u.shield += u.s.shield;
      u.wardT = 1.2;
    }
    this.banner = { text: `ROUND ${cfg.round}`, sub: cfg.boss ? `BOSS — ${cfg.boss.name}` : "", color: cfg.boss ? cfg.boss.color : "#ffb27a", t: 0 };
    if (cfg.boss) audio.sfx("boss");
  }

  private mk(c: Chimera, pos: number, side: "p" | "e", s: Derived): Unit {
    const parts = c.parts.map((p) => (p && PARTS[p.id] ? { tag: PARTS[p.id].tag, tier: p.tier } : null));
    const x = side === "p" ? XS[pos] : W - XS[pos];
    return {
      id: this.uid++, side, pos, name: c.name, parts, s, syn: side === "p" ? this.synP : this.synE,
      hp: s.hp, maxHp: s.hp, shield: 0, cd: INTERVAL * (0.55 + pos * 0.12 + Math.random() * 0.25) / Math.max(0.5, s.spd), alive: true,
      poison: 0, poisonT: 0, pPot: 0, weakV: 0, weakT: 0, stun: 0, ramp: 0, attacks: 0, wardT: 6,
      bossT: 5, phase: 0, enrage: 0,
      x, y: YS[pos], scale: SZ[pos], lunge: 0, flash: 0, deadT: 0, phaseOff: Math.random() * 6,
      dmg: 0, taken: 0, kills: 0, healed: 0, hurtShake: 0,
    };
  }

  // ---------- helpers ----------
  private q() { return this.cfg.settings.particles === "low" ? 0.35 : 1; }
  private burst(x: number, y: number, color: string, n: number, speed = 160, life = 0.6, size = 3, g = 260) {
    n = Math.ceil(n * this.q());
    for (let i = 0; i < n && this.particles.length < 700; i++) {
      const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.8);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.2, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random()), color, g });
    }
  }
  private float(x: number, y: number, text: string, color: string, size = 18) {
    if (!this.cfg.settings.floaters || this.floaters.length > 60) return;
    this.floaters.push({ x: x + (Math.random() - 0.5) * 24, y, text, color, life: 1, max: 1, size });
  }
  private alive(side: "p" | "e") { return this.units.filter((u) => u.side === side && u.alive); }
  private foes(u: Unit) { return this.alive(u.side === "p" ? "e" : "p"); }
  private allies(u: Unit) { return this.alive(u.side); }
  private center(u: Unit) { return { x: u.x, y: u.y - 45 * u.scale }; }

  hpFrac(side: "p" | "e") {
    let h = 0, m = 0;
    for (const u of this.units) if (u.side === side) { h += u.alive ? u.hp : 0; m += u.maxHp; }
    return m > 0 ? h / m : 0;
  }

  // ---------- combat ----------
  private heal(u: Unit, amt: number, show = true) {
    if (!u.alive || amt <= 0) return;
    const a = Math.min(u.maxHp - u.hp, amt);
    if (a <= 0) return;
    u.hp += a; u.healed += a;
    if (show && a >= 1) { const c = this.center(u); this.float(c.x, c.y - 20, `+${Math.round(a)}`, "#7cf3b0", 14); }
  }
  private addShield(u: Unit, amt: number) {
    if (!u.alive) return;
    u.shield += amt;
    const c = this.center(u);
    this.float(c.x, c.y - 30, `+${Math.round(amt)} 🛡`, "#7fd8ff", 14);
    this.burst(c.x, c.y, "#7fd8ff", 8, 80, 0.5, 2.5, -30);
    audio.sfx("shield");
  }
  private addPoison(t: Unit, amt: number, pot: number) {
    if (!t.alive || amt <= 0) return;
    t.poison += amt; t.pPot = Math.max(t.pPot, pot);
  }

  private damage(t: Unit, amt: number, src: Unit | null, kind: "attack" | "poison" | "blast" | "true", color = "#ffffff", crit = false) {
    if (!t.alive || amt <= 0) return 0;
    let a = amt;
    if (t.shield > 0) { const ab = Math.min(t.shield, a); t.shield -= ab; a -= ab; }
    const dealt = amt;
    t.hp -= a; t.taken += dealt; if (src) src.dmg += dealt;
    t.flash = 1; t.hurtShake = 1;
    const c = this.center(t);
    if (kind !== "poison") this.burst(c.x, c.y, color, crit ? 14 : 7, crit ? 260 : 170, 0.5, crit ? 3.6 : 2.6);
    this.float(c.x, c.y - 28, `${Math.round(dealt)}${crit ? "!" : ""}`, kind === "poison" ? "#b6f05a" : crit ? "#ffd166" : t.side === "p" ? "#ff7b7b" : "#ffffff", crit ? 26 : kind === "poison" ? 13 : 18);
    if (t.hp <= 0) this.kill(t, src);
    return dealt;
  }

  private kill(t: Unit, src: Unit | null) {
    t.alive = false; t.hp = 0; t.deadT = 0.001;
    const c = this.center(t);
    this.burst(c.x, c.y, TAG_META[t.parts.find((p) => p)?.tag ?? "feral"].color, 40, 300, 0.9, 4);
    this.rings.push({ x: c.x, y: c.y, r: 10, max: 120, life: 0.5, color: "#ffffff" });
    this.shake += t.boss ? 14 : 5; this.slow = t.boss ? 1.0 : this.slow;
    audio.sfx("death");
    if (src) {
      src.kills++;
      if (src.s.reap) this.heal(src, src.maxHp * 0.15);
    }
    if (t.boss) this.bossDown = true;
    const foeMods = t.side === "p" ? this.synE : this.synP;
    if (t.poison > 0.5 && foeMods.infest > 0) {
      const mates = this.allies(t);
      mates.forEach((m) => this.addPoison(m, t.poison * 0.8, t.pPot));
      if (mates.length) { this.float(c.x, c.y - 50, "INFEST", "#c8e64a", 16); audio.sfx("poison"); }
    }
    if (t.s.deathblast > 0) {
      const raw = t.s.atk * t.s.deathblast;
      this.rings.push({ x: c.x, y: c.y, r: 20, max: 380, life: 0.7, color: "#a65cff" });
      this.shake += 8; audio.sfx("blast");
      this.float(c.x, c.y - 60, "DEATH BLAST", "#d9a8ff", 18);
      for (const f of this.allies({ ...t, side: t.side === "p" ? "e" : "p" } as Unit)) this.damage(f, Math.max(raw * 0.5, raw - f.s.def), t, "blast", "#a65cff");
    }
  }

  private strike(u: Unit, t: Unit, raw: number, mult = 1, primary = true) {
    if (!t.alive) return;
    if (Math.random() < t.s.dodge) {
      const c = this.center(t); this.float(c.x, c.y - 28, "MISS", "#9ad", 14); audio.sfx("miss"); return;
    }
    const crit = primary && Math.random() < u.s.crit;
    let dmg = raw * mult * (crit ? 2 : 1) * (u.weakT > 0 ? 1 - u.weakV : 1);
    const armor = t.s.def * (1 - u.s.pierce);
    dmg = Math.max(dmg * 0.25, dmg - armor);
    const color = TAG_META[u.parts.find((p) => p)?.tag ?? "feral"].color;
    const dealt = this.damage(t, dmg, u, "attack", color, crit);
    this.shake += crit ? 4 : 1.2;
    audio.sfx(crit ? "crit" : "hit", t.side === "p" ? 0.8 : 1);
    const a = this.center(u), b = this.center(t);
    this.beams.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, life: 0.16, color });
    if (u.s.leech > 0) this.heal(u, dealt * u.s.leech);
    if (!primary) return;
    if (t.s.reflect > 0 && u.alive) this.damage(u, dealt * t.s.reflect, t, "true", "#34d399");
    if (t.s.toxic > 0 && u.alive) this.addPoison(u, t.s.toxic, 0);
    if (u.s.venom > 0) this.addPoison(t, u.s.venom, u.s.potent);
    else if (u.s.potent > 0) t.pPot = Math.max(t.pPot, u.s.potent);
    if (u.s.weaken > 0 && t.alive) { t.weakV = u.s.weaken; t.weakT = 3; }
    if (u.s.slam > 0 && t.alive && Math.random() < u.s.slam) { t.stun = Math.max(t.stun, 1); const c = this.center(t); this.float(c.x, c.y - 44, "STUN", "#ffd166", 14); audio.sfx("stun"); }
  }

  private pickTarget(u: Unit): Unit | null {
    const f = this.foes(u);
    if (!f.length) return null;
    if (u.s.snipe) return f.reduce((a, b) => (a.hp + a.shield <= b.hp + b.shield ? a : b));
    const w = [5, 3, 2];
    const tot = f.reduce((s, x) => s + w[x.pos], 0);
    let r = Math.random() * tot;
    for (const x of f) { r -= w[x.pos]; if (r <= 0) return x; }
    return f[0];
  }

  private attack(u: Unit) {
    const t = this.pickTarget(u);
    if (!t) return;
    u.lunge = 0.0001; u.attacks++;
    const howl = Math.min(0.6, this.allies(u).reduce((s, a) => s + a.s.howl, 0));
    const sudden = this.time > SUDDEN ? 1 + (this.time - SUDDEN) * 0.05 : 1;
    const raw = u.s.atk * (1 + howl) * sudden;
    this.strike(u, t, raw);
    if (u.s.rampage > 0) u.ramp = Math.min(10, u.ramp + 1);
    const foes = this.foes(u);
    if (u.s.breath > 0 && u.attacks % 3 === 0) {
      audio.sfx("breath"); this.shake += 4;
      const a = this.center(u);
      this.burst(a.x + (u.side === "p" ? 40 : -40), a.y, "#ff8a3d", 26, 260, 0.6, 3.5, -60);
      for (const f of foes) if (f !== t) this.strike(u, f, raw, u.s.breath, false);
    } else if (u.s.cleave > 0) {
      const nb = foes.filter((f) => Math.abs(f.pos - t.pos) === 1);
      if (nb.length) this.strike(u, nb[Math.floor(Math.random() * nb.length)], raw, u.s.cleave, false);
    }
  }

  private speedOf(u: Unit) {
    let s = u.s.spd + u.ramp * u.s.rampage + u.enrage;
    for (const a of this.allies(u)) if (a !== u && Math.abs(a.pos - u.pos) === 1) s += a.s.inspire;
    if (u.s.bloodlust && u.hp < u.maxHp * 0.5) s += 0.5;
    return Math.max(0.35, s);
  }

  private bossLogic(u: Unit, dt: number) {
    const b = u.boss;
    if (!b || !u.alive) return;
    u.bossT -= dt;
    const foes = () => this.foes(u);
    if (u.bossT <= 0) {
      if (b.id === "matriarch") { u.bossT = 6; this.addShield(u, u.maxHp * 0.25); this.banner = { text: "STONESKIN", sub: "", color: b.color, t: 0.4 }; }
      else if (b.id === "tyrant") {
        u.bossT = 5.5; audio.sfx("warn");
        this.teles.push({ left: 1, total: 1, text: "SPORE CLOUD", color: b.color, fn: () => { audio.sfx("poison"); this.shake += 5; for (const f of foes()) { this.addPoison(f, this.cfg.bossPoison, 0.1); const c = this.center(f); this.burst(c.x, c.y, "#c8e64a", 22, 120, 0.9, 3.5, -40); this.float(c.x, c.y - 40, "SPORES", "#c8e64a", 14); } } });
      } else if (b.id === "prime") {
        u.bossT = 7.5; audio.sfx("warn");
        this.teles.push({ left: 1.4, total: 1.4, text: "CATACLYSM", color: b.color, fn: () => { audio.sfx("blast"); this.shake += 12; this.redFlash = 1; for (const f of foes()) { const raw = u.s.atk * 1.7; this.rings.push({ x: f.x, y: f.y - 40, r: 10, max: 160, life: 0.6, color: "#a65cff" }); this.damage(f, Math.max(raw * 0.5, raw - f.s.def), u, "blast", "#a65cff"); } } });
      }
    }
    if (b.id === "prime") {
      const frac = u.hp / u.maxHp;
      const want = frac <= 0.33 ? 2 : frac <= 0.66 ? 1 : 0;
      if (want > u.phase) {
        u.phase = want; u.enrage += 0.25;
        this.heal(u, u.maxHp * 0.1);
        audio.sfx("boss"); this.shake += 14; this.redFlash = 1;
        this.banner = { text: want === 1 ? "PHASE II" : "FINAL PHASE", sub: "The Prime Chimera mutates!", color: b.color, t: 0 };
        for (const f of foes()) { const raw = u.s.atk * 1.1; this.damage(f, Math.max(raw * 0.5, raw - f.s.def), u, "blast", "#a65cff"); }
        const c = this.center(u); this.rings.push({ x: c.x, y: c.y, r: 20, max: 520, life: 0.9, color: "#ff4fd8" });
      }
    }
  }

  // ---------- update ----------
  update(rawDt: number) {
    let dt = Math.min(rawDt, 1);
    while (dt > 0) { const s = Math.min(dt, 1 / 30); this.step(s); dt -= s; }
  }

  private step(dt0: number) {
    let dt = dt0;
    if (this.slow > 0) { dt *= 0.3; this.slow -= dt0; }
    this.time += dt;
    this.shake *= Math.exp(-dt * 7);
    this.redFlash = Math.max(0, this.redFlash - dt * 1.5);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 1.8) this.banner = null; }
    // ambient embers
    this.ember += dt * 8 * this.q();
    while (this.ember > 1) { this.ember--; if (this.particles.length < 700) this.particles.push({ x: Math.random() * W, y: H + 5, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 50, life: 3 + Math.random() * 2, max: 5, size: 1 + Math.random() * 1.6, color: "#ff8a3d", g: -4 }); }
    // fx updates
    for (const p of this.particles) { p.life -= dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.life -= dt * 1.1; f.y -= 34 * dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const u of this.units) {
      u.flash = Math.max(0, u.flash - dt * 6); u.hurtShake = Math.max(0, u.hurtShake - dt * 5);
      if (u.lunge > 0) { u.lunge += dt * 3.2; if (u.lunge >= 1) u.lunge = 0; }
      if (!u.alive && u.deadT > 0) u.deadT += dt;
    }

    if (this.state === "intro") {
      this.introT -= dt;
      if (this.introT <= 0) { this.state = "fight"; audio.sfx("fight"); this.banner = { text: "FIGHT!", sub: "", color: "#ffb27a", t: 0.9 }; }
      return;
    }
    if (this.state === "end") {
      this.endT -= dt0;
      if (this.endT <= 0 && !this.done) { this.done = true; this.finish(); }
      return;
    }

    // telegraphs
    for (const t of this.teles) { t.left -= dt; if (t.left <= 0) t.fn(); }
    this.teles = this.teles.filter((t) => t.left > 0);

    for (const u of this.units) {
      if (!u.alive) continue;
      if (u.s.regen > 0) this.heal(u, u.s.regen * dt, false);
      if (u.poison > 0.4) {
        u.poisonT += dt;
        if (u.poisonT >= 1) { u.poisonT -= 1; this.damage(u, u.poison * (0.4 + u.pPot), null, "true", "#b6f05a"); if (u.alive) { audio.sfx("poison"); u.poison *= 0.8; } }
      }
      if (!u.alive) continue;
      if (u.weakT > 0) u.weakT -= dt;
      if (u.s.ward > 0) {
        u.wardT -= dt;
        if (u.wardT <= 0) {
          u.wardT = 6;
          const tgt = this.allies(u).find((a) => a.pos === u.pos + 1) ?? u;
          this.addShield(tgt, u.s.ward);
        }
      }
      this.bossLogic(u, dt);
      if (!u.alive) continue;
      if (u.stun > 0) { u.stun -= dt; continue; }
      u.cd -= dt * this.speedOf(u);
      if (u.cd <= 0) { u.cd += INTERVAL; this.attack(u); }
    }

    // sudden death: overload drains everyone
    if (this.time > SUDDEN) {
      const rate = 0.02 + (this.time - SUDDEN) * 0.004;
      for (const u of this.units) if (u.alive) { u.hp -= u.maxHp * rate * dt; if (u.hp <= 0) this.kill(u, null); }
      if (Math.floor(this.time) !== Math.floor(this.time - dt) && this.time < SUDDEN + 1.2) this.banner = { text: "OVERLOAD", sub: "Everything burns...", color: "#ff4d4d", t: 0.4 };
    }

    const pa = this.alive("p").length, ea = this.alive("e").length;
    if (pa === 0 || ea === 0) {
      this.state = "end"; this.endT = 1.5;
      this.outcome = pa === 0 && ea === 0 ? "draw" : ea === 0 ? "win" : "lose";
      this.teles = [];
      this.banner = { text: this.outcome === "win" ? "VICTORY" : this.outcome === "lose" ? "DEFEAT" : "DRAW", sub: "", color: this.outcome === "win" ? "#7cf3b0" : "#ff6b6b", t: 0 };
      audio.sfx(this.outcome === "win" ? "win" : "lose");
    }
  }

  private finish() {
    const units: UnitReport[] = this.units.map((u) => ({ name: u.name, dmg: Math.round(u.dmg), taken: Math.round(u.taken), kills: u.kills, healed: Math.round(u.healed), alive: u.alive, side: u.side }));
    const mine = this.units.filter((u) => u.side === "p");
    this.result = {
      outcome: this.outcome, time: this.time, units,
      kills: mine.reduce((s, u) => s + u.kills, 0), dmg: Math.round(mine.reduce((s, u) => s + u.dmg, 0)),
      survivors: mine.filter((u) => u.alive).length, bossDown: this.bossDown && this.outcome === "win",
    };
  }

  // ---------- render ----------
  draw(ctx: CanvasRenderingContext2D) {
    const t = this.time;
    const sh = this.shake * (this.cfg.settings.shake ?? 1);
    ctx.save();
    // background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#0b0710"); g.addColorStop(0.55, "#1d101a"); g.addColorStop(1, "#2a1713");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const accent = this.cfg.boss ? this.cfg.boss.color : this.cfg.enemyTag ? TAG_META[this.cfg.enemyTag].color : "#ff8a3d";
    ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    // pillars
    ctx.fillStyle = "rgba(255,255,255,0.025)";
    for (let i = 0; i < 7; i++) { const px = 40 + i * 150; ctx.fillRect(px, 0, 34, 300); ctx.beginPath(); ctx.arc(px + 17, 300, 17, 0, 7); ctx.fill(); }
    // glow
    const rg = ctx.createRadialGradient(W / 2, 400, 20, W / 2, 400, 460);
    rg.addColorStop(0, shade(accent, 0.6).replace("rgb", "rgba").replace(")", ",0.28)")); rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    // floor
    ctx.fillStyle = "#1a0f12"; ctx.beginPath(); ctx.moveTo(0, 330); ctx.lineTo(W, 330); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill();
    ctx.strokeStyle = "rgba(255,160,100,0.07)"; ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) { const y = 340 + i * i * 2.6; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    for (let i = -8; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + i * 25, 330); ctx.lineTo(W / 2 + i * 120, H); ctx.stroke(); }
    // sigil
    ctx.strokeStyle = shade(accent, 0.9).replace("rgb", "rgba").replace(")", ",0.35)"); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(W / 2, 445, 70 + Math.sin(t * 2) * 3, 16, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(W / 2, 445, 40, 9, 0, 0, 7); ctx.stroke();

    // telegraph overlay
    for (const tl of this.teles) {
      const p = 1 - tl.left / tl.total;
      ctx.fillStyle = `rgba(220,38,38,${0.08 + 0.12 * Math.abs(Math.sin(p * 18))})`; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = tl.color; ctx.font = "900 30px Cinzel, serif"; ctx.textAlign = "center";
      ctx.fillText(`⚠ ${tl.text} ⚠`, W / 2, 90);
      ctx.fillStyle = "rgba(255,255,255,0.8)"; ctx.fillRect(W / 2 - 100, 100, 200 * p, 5);
    }

    // units sorted back to front
    const sorted = [...this.units].sort((a, b) => a.y - b.y);
    for (const u of sorted) {
      // shadow
      if (u.alive || u.deadT < 1) {
        ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(u.x, u.y + 2, 52 * u.scale / 1.4, 10, 0, 0, 7); ctx.fill();
      }
      const dir = u.side === "p" ? 1 : -1;
      const lx = u.lunge > 0 ? Math.sin(Math.min(1, u.lunge) * Math.PI) * 55 * dir : 0;
      const hs = u.hurtShake > 0 ? Math.sin(t * 90) * 4 * u.hurtShake : 0;
      const dead = !u.alive;
      const dp = Math.min(1, u.deadT / 0.8);
      const stunned = u.stun > 0;
      drawChimera(ctx, u.parts, u.x + lx + hs, u.y - (dead ? 0 : 0), u.scale, {
        t: t + u.phaseOff, facing: u.side === "p" ? 1 : -1, flash: this.cfg.settings.flash ? u.flash * 0.8 : 0, swing: u.lunge > 0 ? Math.sin(u.lunge * Math.PI) : 0,
        alpha: dead ? Math.max(0, 1 - dp) : 1, rot: dead ? dir * -ease(dp) * 0.9 : 0, phase: u.phaseOff, still: stunned || dead,
      });
      if (!dead) {
        const bw = 78 * (u.boss ? 1.4 : 1), bx = u.x - bw / 2, by = u.y - 108 * u.scale - 12;
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(bx - 1, by - 1, bw + 2, 9);
        const f = Math.max(0, u.hp / u.maxHp);
        ctx.fillStyle = u.side === "p" ? (f > 0.35 ? "#4ade80" : "#facc15") : u.boss ? u.boss.color : "#f87171";
        ctx.fillRect(bx, by, bw * f, 7);
        if (u.shield > 0) { ctx.fillStyle = "#7fd8ff"; ctx.fillRect(bx, by - 3, Math.min(bw, bw * (u.shield / u.maxHp)), 3); }
        ctx.fillStyle = "#fff"; ctx.font = "600 11px 'Chakra Petch', sans-serif"; ctx.textAlign = "center";
        ctx.fillText(u.boss ? `👑 ${u.boss.name}` : u.name, u.x, by - 6);
        let ix = bx;
        ctx.font = "10px sans-serif"; ctx.textAlign = "left";
        if (u.poison > 0.4) { ctx.fillText(`☠${Math.round(u.poison)}`, ix, by + 19); ix += 28; }
        if (u.weakT > 0) { ctx.fillText("⬇", ix, by + 19); ix += 14; }
        if (u.stun > 0) { ctx.fillText("💫", ix, by + 19); ix += 16; }
        if (u.ramp > 0) ctx.fillText(`⚡${u.ramp}`, ix, by + 19);
        drawTierPips(ctx, u.x, by + 14, Math.max(...u.parts.map((p) => p?.tier ?? 1)), "#ffd166");
      }
    }

    // beams, rings, particles
    ctx.globalCompositeOperation = "lighter";
    for (const b of this.beams) { ctx.strokeStyle = b.color; ctx.globalAlpha = b.life / 0.16; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); }
    for (const r of this.rings) { const p = 1 - r.life / 0.7; ctx.globalAlpha = Math.max(0, r.life * 1.4); ctx.strokeStyle = r.color; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.x, r.y, r.r + (r.max - r.r) * ease(Math.min(1, p)), 0, 7); ctx.stroke(); }
    for (const p of this.particles) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.max)); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";

    // floaters
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.5));
      const pop = 1 + Math.max(0, f.life - 0.8) * 2.5;
      ctx.font = `700 ${f.size * pop}px 'Chakra Petch', sans-serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(0,0,0,.85)"; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    if (this.redFlash > 0) { ctx.fillStyle = `rgba(255,40,40,${this.redFlash * 0.25})`; ctx.fillRect(0, 0, W, H); }
    if (this.time > SUDDEN) { ctx.fillStyle = `rgba(255,60,0,${0.06 + 0.05 * Math.sin(t * 6)})`; ctx.fillRect(0, 0, W, H); }

    // banner
    if (this.banner) {
      const b = this.banner, p = Math.min(1, b.t / 0.35), out = b.t > 1.4 ? 1 - (b.t - 1.4) / 0.4 : 1;
      ctx.globalAlpha = Math.max(0, out);
      const sc = 0.6 + ease(p) * 0.4;
      ctx.save(); ctx.translate(W / 2, 200); ctx.scale(sc, sc);
      ctx.font = "900 64px Cinzel, serif"; ctx.textAlign = "center";
      ctx.lineWidth = 8; ctx.strokeStyle = "rgba(0,0,0,.8)"; ctx.strokeText(b.text, 0, 0);
      ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
      if (b.sub) { ctx.font = "600 20px 'Chakra Petch', sans-serif"; ctx.lineWidth = 4; ctx.strokeText(b.sub, 0, 36); ctx.fillStyle = "#fff"; ctx.fillText(b.sub, 0, 36); }
      ctx.restore(); ctx.globalAlpha = 1;
    }
    ctx.restore();
  }
}
