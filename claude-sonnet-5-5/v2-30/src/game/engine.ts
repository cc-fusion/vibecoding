import {
  bfs, DIFFICULTIES, FIRST_NAMES, LAST_NAMES, MODS, RECT, ROLE_ORDER, ROLES, ROOMS, ROOM_MAP, SCENARIOS, SECRETS, TRAIT_LIST, TRAITS,
  type DifficultyDef, type EventId, type Role, type RoomId, type ScenarioDef, type Trait,
} from "./data";
import { sfx, setIntensity, setMusicMode } from "./audio";

export type ActionId = "investigate" | "recruit" | "bribe" | "blackmail" | "doubt" | "scandal" | "frame" | "assassinate" | "free" | "reward";
export type NpcStatus = "free" | "conspirator" | "arrested" | "dead";
export type LogKind = "info" | "good" | "bad" | "event" | "rumor" | "coup";

export interface Relation { id: number; kind: "ally" | "rival" | "lover" }

export interface Npc {
  id: number;
  name: string;
  role: Role;
  trait: Trait;
  secret: number;
  secretKnown: boolean;
  known: boolean;
  crown: number;
  affinity: number;
  ambition: number;
  noise: number;
  suspicion: number;
  exposure: number;
  disgrace: number;
  heat: number;
  status: NpcStatus;
  coerced: boolean;
  confidant: boolean;
  wasConspirator: boolean;
  room: RoomId;
  path: RoomId[];
  prog: number;
  moving: boolean;
  post: RoomId | null;
  sched: RoomId[];
  relations: Relation[];
  abilityCd: number;
  spd: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
}

export interface Rumor { id: number; kind: "doubt" | "scandal" | "frame"; target: number | null; strength: number; known: number[]; age: number }
export interface LogEntry { id: number; t: number; text: string; kind: LogKind }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; t: number; size: number; color: string; grav: number; kind: "spark" | "dust" | "coin" | "smoke" }
export interface Floater { x: number; y: number; text: string; color: string; size: number; t: number; life: number }
export interface Ring { x: number; y: number; t: number; life: number; color: string; r: number }

export interface Squad {
  id: number; side: "rebel" | "loyal"; count: number; room: RoomId; path: RoomId[]; prog: number; goal: RoomId | null;
  leader: number | null; name: string; x: number; y: number; flash: number;
}

export interface Coup {
  t: number;
  limit: number;
  squads: Squad[];
  garrison: Record<RoomId, number>;
  garrisonMax: Record<RoomId, number>;
  owner: Record<RoomId, "crown" | "rebel">;
  champHp: number;
  champMax: number;
  champPower: number;
  champPhase: number;
  fury: boolean;
  monarchRoom: RoomId;
  monarchPath: RoomId[];
  monarchProg: number;
  mx: number;
  my: number;
  capture: number;
  reserve: number;
  spawnT: number;
  aiT: number;
  mercT: number;
  mercLeft: number;
  gateBonus: boolean;
  sel: number[];
  acc: Record<RoomId, number>;
  sfxT: number;
  prisoners: number[];
  startRebels: number;
}

export interface ModalState {
  title: string;
  icon: string;
  text: string;
  choices: { label: string; hint: string }[];
}

export interface ActionInfo {
  id: ActionId; label: string; icon: string; desc: string; gold: number; infl: number; forge: number;
  ok: boolean; reason?: string; chance: number | null; remote: boolean; agent: string | null;
}

export interface Summary {
  won: boolean; title: string; reason: string; score: number; seals: number; mult: number;
  daysSurvived: number; recruited: number; roomsCaptured: number; arrests: number; kills: number; lostAgents: number;
  rumors: number; goldSpent: number; investigations: number; peakEvidence: number; coupTime: number; breakdown: [string, number][];
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
function mkRec<T>(f: (id: RoomId) => T): Record<RoomId, T> {
  const r = {} as Record<RoomId, T>;
  ROOMS.forEach((rm) => (r[rm.id] = f(rm.id)));
  return r;
}

export const ACTION_BASE: Record<ActionId, { label: string; icon: string; desc: string; gold: number; infl: number; forge: number }> = {
  investigate: { label: "Eavesdrop", icon: "👂", desc: "Learn their true stats, trait and perhaps a secret.", gold: 0, infl: 6, forge: 0 },
  recruit: { label: "Recruit", icon: "🤝", desc: "Offer a place in the conspiracy.", gold: 15, infl: 14, forge: 0 },
  bribe: { label: "Bribe", icon: "💰", desc: "Raise their favor, erode loyalty to the Crown.", gold: 35, infl: 0, forge: 0 },
  blackmail: { label: "Blackmail", icon: "🩸", desc: "Use their secret to force service. Coerced agents may defect.", gold: 0, infl: 12, forge: 0 },
  doubt: { label: "Sow Doubt", icon: "🌫️", desc: "Start a rumor against the Crown; spreads by gossip.", gold: 0, infl: 10, forge: 0 },
  scandal: { label: "Spread Scandal", icon: "📰", desc: "Rumor about another courtier; if the Monarch hears, they fall.", gold: 0, infl: 14, forge: 0 },
  frame: { label: "Frame", icon: "📝", desc: "Forged rumor: if the Spymaster hears, he hunts the target.", gold: 30, infl: 0, forge: 1 },
  assassinate: { label: "Silence", icon: "🗡️", desc: "Your Shadow Blade strikes. Loud, lethal, risky.", gold: 60, infl: 10, forge: 0 },
  free: { label: "Break Out", icon: "🔓", desc: "Bribe the jailer: freed prisoners swear loyalty.", gold: 70, infl: 0, forge: 0 },
  reward: { label: "Reward", icon: "🎁", desc: "Gift gold to boost an agent's devotion.", gold: 25, infl: 0, forge: 0 },
};

type EventChoice = { label: string; hint: string; run: (g: Game) => string };
interface EventDef { title: string; icon: string; text: string; choices?: EventChoice[]; run?: (g: Game) => void }

export interface GameOpts { scenarioId: string; difficultyId: string; mods: string[]; perks: Record<string, number>; tutorial: boolean }

export class Game {
  scn: ScenarioDef;
  diff: DifficultyDef;
  mods: string[];
  perks: Record<string, number>;
  tutorial: boolean;
  dayLen = 48;
  totalDays: number;
  t = 0;
  realT = 0;
  lastDay = 1;
  npcs: Npc[] = [];
  rumors: Rumor[] = [];
  gold: number;
  infl = 45;
  evidence = 0;
  unrest: number;
  paranoia: number;
  legit: number;
  vigor = 100;
  forgeries = 0;
  garrisonCut = 0;
  muster = 0;
  guardBonus = 0;
  speed: 1 | 2 | 3 = 1;
  paused = false;
  selected: number | null = null;
  targeting: { kind: "scandal" | "frame"; spreader: number } | null = null;
  log: LogEntry[] = [];
  phase: "plan" | "coup" | "won" | "lost" = "plan";
  summary: Summary | null = null;
  modal: ModalState | null = null;
  banner: { text: string; sub: string; id: number; color: string } | null = null;
  flags: Record<string, boolean> = {};
  coup: Coup | null = null;
  override: { room: RoomId; until: number } | null = null;
  alertUntil = 0;
  crackdownUntil = 0;
  lastSkim = -999;
  lastEvidenceT = 0;
  stats = { recruited: 0, rooms: 0, arrests: 0, kills: 0, lostAgents: 0, rumors: 0, goldSpent: 0, investigations: 0, peakEvidence: 0 };
  fx = { particles: [] as Particle[], floaters: [] as Floater[], rings: [] as Ring[], shake: 0, flash: 0, flashColor: "#ffffff" };
  endDelay = 0;
  private uid = 1;
  private spyT = 22;
  private gossipT = 0;
  private secT = 0;
  private nextEventT: number;
  private purgeDay = 0;
  private warned50 = false;
  private warned75 = false;
  private modalHandlers: ((g: Game) => string)[] = [];
  private lastEventId: EventId | null = null;
  private spyFocus: number | null = null;

  constructor(o: GameOpts) {
    this.scn = SCENARIOS.find((s) => s.id === o.scenarioId) ?? SCENARIOS[0];
    this.diff = DIFFICULTIES.find((d) => d.id === o.difficultyId) ?? DIFFICULTIES[1];
    this.mods = o.mods;
    this.perks = o.perks;
    this.tutorial = o.tutorial && this.scn.tutorial;
    this.totalDays = Math.max(4, this.scn.days - (this.has("fuse") ? 2 : 0));
    this.gold = this.has("purse") ? 0 : Math.round(this.scn.startGold * this.diff.gold) + (o.perks.pockets ?? 0) * 45;
    this.unrest = this.scn.unrest;
    this.paranoia = this.scn.paranoia + (this.has("paranoid") ? 20 : 0);
    this.legit = this.scn.legit;
    this.nextEventT = 45 / this.scn.eventRate;
    this.buildCourt();
    this.addLog(`${this.scn.court}: ${this.scn.monarchName} must fall before Day ${this.totalDays} ends.`, "event");
    this.setBanner(this.scn.name, this.scn.objective, this.scn.accent);
    this.snapPositions();
  }

  minMult = 99;
  setDifficulty(id: string) {
    const d = DIFFICULTIES.find((x) => x.id === id);
    if (!d || d.id === this.diff.id) return;
    this.diff = d;
    this.minMult = Math.min(this.minMult, d.mult);
    this.addLog(`Difficulty changed to ${d.name}.`, "info");
  }

  has(m: string) { return this.mods.includes(m); }
  perk(id: string) { return this.perks[id] ?? 0; }
  npc(id: number | null): Npc | null { return id === null ? null : this.npcs.find((n) => n.id === id) ?? null; }
  byRole(r: Role) { return this.npcs.find((n) => n.role === r) ?? null; }
  agents() { return this.npcs.filter((n) => n.status === "conspirator"); }

  /* ---------------- time ---------------- */
  day() { return Math.floor(this.t / this.dayLen) + 1; }
  hour() { return (6 + ((this.t % this.dayLen) / this.dayLen) * 24) % 24; }
  block() { const h = this.hour(); return h >= 6 && h < 10 ? 0 : h < 14 && h >= 10 ? 1 : h >= 14 && h < 18 ? 2 : h >= 18 && h < 22 ? 3 : 4; }
  timeLeft() { return Math.max(0, this.totalDays * this.dayLen - this.t); }
  nightness() { const h = this.hour(); if (h >= 21 || h < 5) return 1; if (h >= 19) return (h - 19) / 2; if (h < 7) return (7 - h) / 2; return 0; }

  /* ---------------- setup ---------------- */
  private buildCourt() {
    const used = new Set<string>();
    const mkName = () => { for (let i = 0; i < 80; i++) { const nm = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`; if (!used.has(nm)) { used.add(nm); return nm; } } return `Noble ${this.uid}`; };
    let firstCourtier = true;
    ROLE_ORDER.forEach((role) => {
      const def = ROLES[role];
      let crown = clamp(this.scn.baseCrown + rand(-18, 18), 15, 95);
      if (role === "monarch") crown = 100;
      if (role === "champion") crown = clamp(crown + 18, 60, 98);
      if (role === "spymaster") crown = clamp(crown + 12, 50, 98);
      if (role === "captain") crown = clamp(crown + 6, 30, 96);
      if (role === "servant" || role === "courtier") crown = clamp(crown - 8, 12, 90);
      let sched = def.sched.slice();
      if (role === "courtier") sched = [pick(["ballroom", "throne", "courtyard", "chapel"] as RoomId[]), pick(["throne", "courtyard", "library", "ballroom"] as RoomId[]), pick(["courtyard", "ballroom", "chapel", "kitchen"] as RoomId[]), "ballroom", pick(["ballroom", "chapel", "library"] as RoomId[])];
      if (role === "servant") sched = Array.from({ length: 5 }, (_, i) => (i === 3 ? "ballroom" : pick(["kitchen", "chamber", "courtyard", "treasury", "throne", "apothecary", "library"] as RoomId[])));
      const n: Npc = {
        id: this.uid++, name: mkName(), role, trait: pick(TRAIT_LIST), secret: Math.floor(Math.random() * SECRETS.length), secretKnown: false, known: false,
        crown, affinity: rand(5, 30), ambition: rand(10, 90), noise: rand(-24, 24), suspicion: 0, exposure: 0, disgrace: 0, heat: 0,
        status: "free", coerced: false, confidant: false, wasConspirator: false, room: sched[0], path: [], prog: 0, moving: false, post: null, sched,
        relations: [], abilityCd: 0, spd: rand(0.9, 1.12), x: 0, y: 0, tx: 0, ty: 0,
      };
      if (role === "monarch") { n.known = true; n.trait = "ruthless"; }
      if (role === "courtier" && firstCourtier) {
        firstCourtier = false;
        Object.assign(n, { status: "conspirator", affinity: 96, crown: 22, known: true, secretKnown: true, confidant: true, wasConspirator: true, trait: "ambitious" as Trait });
      }
      this.npcs.push(n);
    });
    // relations
    const pool = this.npcs.filter((n) => n.role !== "monarch");
    pool.forEach((n) => {
      for (let k = 0; k < 2; k++) {
        const o = pick(pool);
        if (o.id === n.id || n.relations.some((r) => r.id === o.id)) continue;
        const kind = pick(["ally", "ally", "rival", "lover"] as Relation["kind"][]);
        n.relations.push({ id: o.id, kind });
        o.relations.push({ id: n.id, kind });
      }
    });
    // perks: retainers and keen eyes
    const retainerRoles: Role[] = ["scribe", "chef", "physician", "servant", "courtier"];
    for (let i = 0; i < this.perk("retainer"); i++) {
      const c = this.npcs.find((n) => retainerRoles.includes(n.role) && n.status === "free");
      if (c) Object.assign(c, { status: "conspirator", affinity: 78, crown: Math.min(c.crown, 35), known: true, wasConspirator: true });
    }
    const unknown = this.npcs.filter((n) => !n.known);
    for (let i = 0; i < this.perk("eyes") * 3 && unknown.length; i++) {
      const k = unknown.splice(Math.floor(Math.random() * unknown.length), 1)[0];
      k.known = true;
    }
    if (this.tutorial) {
      // give the tutorial a friendly start: reveal the Archivist and Chef
      [this.byRole("scribe"), this.byRole("chef")].forEach((n) => { if (n && n.status === "free") { n.known = true; n.crown = Math.min(n.crown, 40); } });
    }
  }

  private snapPositions() {
    this.computeTargets();
    this.npcs.forEach((n) => { n.x = n.tx; n.y = n.ty; });
  }

  /* ---------------- effects helpers ---------------- */
  setBanner(text: string, sub: string, color = "#e3b95a") { this.banner = { text, sub, id: this.uid++, color }; }
  addLog(text: string, kind: LogKind = "info") {
    this.log.unshift({ id: this.uid++, t: this.t, text, kind });
    if (this.log.length > 90) this.log.pop();
  }
  float(x: number, y: number, text: string, color = "#fff", size = 14) { this.fx.floaters.push({ x, y, text, color, size, t: 0, life: 1.6 }); if (this.fx.floaters.length > 80) this.fx.floaters.shift(); }
  say(n: Npc, text: string, color = "#fff") { this.float(n.x, n.y - 22, text, color, 14); }
  burst(x: number, y: number, color: string, count = 14, speed = 90, kind: Particle["kind"] = "spark") {
    for (let i = 0; i < count && this.fx.particles.length < 700; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(speed * 0.3, speed);
      this.fx.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - (kind === "coin" ? 60 : 0), life: rand(0.5, 1.1), t: 0, size: rand(1.5, 3.5), color, grav: kind === "coin" ? 220 : kind === "smoke" ? -20 : 40, kind });
    }
  }
  ring(x: number, y: number, color: string, r = 46) { this.fx.rings.push({ x, y, t: 0, life: 0.7, color, r }); }
  shake(a: number) { this.fx.shake = Math.min(18, Math.max(this.fx.shake, a)); }
  flash(color: string, a = 0.4) { this.fx.flash = a; this.fx.flashColor = color; }
  roomPos(r: RoomId) { return RECT[r]; }

  /* ---------------- evidence ---------------- */
  addEvidence(base: number, why?: string) {
    let m = this.diff.ev * this.scn.evMul * (1 + this.paranoia / 200) * (1 - 0.12 * this.perk("velvet"));
    if (this.t < this.alertUntil) m *= 1.5;
    if (this.has("loose")) m *= 1.15;
    const spy = this.byRole("spymaster");
    if (spy && spy.status === "conspirator") m *= 0.5;
    if (spy && (spy.status === "arrested" || spy.status === "dead")) m *= 0.65;
    const v = base * m;
    if (v <= 0) return;
    this.evidence = Math.min(100, this.evidence + v);
    this.stats.peakEvidence = Math.max(this.stats.peakEvidence, this.evidence);
    this.lastEvidenceT = this.t;
    if (why) this.addLog(`${why} (+${v.toFixed(0)} evidence)`, "bad");
    this.shake(2 + Math.min(4, v / 3));
  }

  private leak(room: RoomId | null, loud: number, exclude: number[] = []) {
    if (loud <= 0) return;
    if (room === null) {
      if (Math.random() < 0.2) this.addEvidence(loud * 0.6, "A courier was intercepted");
      return;
    }
    let reports = 0;
    for (const n of this.npcs) {
      if (n.status !== "free" || n.moving || n.room !== room || exclude.includes(n.id)) continue;
      let p = (n.crown / 100) * 0.5 * (1 - n.affinity / 220);
      if (n.role === "spymaster") p *= 1.8;
      if (n.trait === "ruthless") p *= 1.5;
      if (this.has("loose")) p *= 1.3;
      if (this.t < this.alertUntil) p *= 1.25;
      if (Math.random() < p && reports < 2) {
        reports++;
        this.say(n, "👁 Witness!", "#ff7a7a");
        this.addEvidence(loud, `${n.name} saw something suspicious`);
      }
    }
  }

  /* ---------------- update ---------------- */
  update(dt: number) {
    this.realT += dt;
    this.updateFx(dt);
    this.computeTargets();
    const k = 1 - Math.exp(-dt * 7);
    for (const n of this.npcs) { n.x += (n.tx - n.x) * k; n.y += (n.ty - n.y) * k; }
    if (this.phase === "won" || this.phase === "lost") { this.endDelay += dt; return; }
    if (this.paused || this.modal) return;
    let rem = dt * this.speed;
    while (rem > 0 && (this.phase === "plan" || this.phase === "coup")) {
      const s = Math.min(rem, 0.08);
      if (this.phase === "plan") this.stepPlan(s); else this.stepCoup(s);
      rem -= s;
    }
    if (this.phase === "coup" && this.coup) setIntensity(0.6 + 0.4 * Math.min(1, this.coup.t / this.coup.limit));
    else setIntensity(Math.min(1, this.evidence / 100 * 0.85 + (this.t / (this.totalDays * this.dayLen)) * 0.25));
  }

  private updateFx(dt: number) {
    const f = this.fx;
    for (const p of f.particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 1 - dt * 0.8; }
    f.particles = f.particles.filter((p) => p.t < p.life);
    for (const fl of f.floaters) fl.t += dt;
    f.floaters = f.floaters.filter((fl) => fl.t < fl.life);
    for (const r of f.rings) r.t += dt;
    f.rings = f.rings.filter((r) => r.t < r.life);
    f.shake *= Math.exp(-dt * 7);
    if (f.shake < 0.05) f.shake = 0;
    f.flash = Math.max(0, f.flash - dt * 1.6);
    if (f.particles.length < 90 && Math.random() < dt * 6) {
      f.particles.push({ x: Math.random() * 1000, y: 690, vx: rand(-6, 6), vy: rand(-22, -8), life: rand(4, 8), t: 0, size: rand(1, 2.2), color: "#ffd89a", grav: 0, kind: "dust" });
    }
  }

  private stepPlan(s: number) {
    this.t += s;
    const day = this.day();
    if (day !== this.lastDay) { this.lastDay = day; this.onNewDay(); if (this.phase !== "plan") return; }
    const nAg = this.agents().length;
    // economy
    this.infl = Math.min(100, this.infl + s * (0.55 * (1 + 0.18 * this.perk("gossip")) + nAg * 0.03));
    this.gold += s * (this.has("purse") ? 0.35 : 0.6) * this.diff.gold;
    // passive evidence
    this.evidence = clamp(this.evidence + s * nAg * 0.012 * (1 + this.paranoia / 100) * this.scn.evMul * this.diff.ev * (1 - 0.12 * this.perk("velvet")), 0, 100);
    if (this.t - this.lastEvidenceT > 12) {
      const spy = this.byRole("spymaster");
      this.evidence = Math.max(0, this.evidence - s * (spy && spy.status === "conspirator" ? 0.25 : 0.1));
    }
    // paranoia drift
    const target = this.scn.paranoia + (this.has("paranoid") ? 20 : 0) + this.evidence * 0.35 + this.unrest * 0.2;
    this.paranoia = clamp(this.paranoia + (target - this.paranoia) * s * 0.015, 0, 100);
    this.unrest = clamp(this.unrest + (this.scn.unrest - this.unrest) * s * 0.003, 0, 100);
    this.legit = clamp(this.legit - s * 0.02, 0, 100);
    if (this.evidence >= 100) { this.finish(false, "Exposed!", "The Master of Whispers lays your letters before the throne. The headsman is already sharpening his axe."); return; }
    if (this.evidence >= 50 && !this.warned50) { this.warned50 = true; this.setBanner("Suspicion Rising", "The Spymaster quickens his hunt.", "#e08a3c"); sfx("alarm"); this.flash("#e08a3c", 0.25); }
    if (this.evidence >= 75 && !this.warned75) { this.warned75 = true; this.setBanner("The Net Closes", "One more slip and you are finished.", "#b3263e"); sfx("alarm"); this.flash("#b3263e", 0.35); this.shake(8); }
    if (this.evidence < 40) { this.warned50 = false; this.warned75 = false; }
    // movement
    this.moveNpcs(s);
    // per-second systems
    this.secT += s;
    while (this.secT >= 1) { this.secT -= 1; this.perSecond(); if (this.phase !== "plan") return; }
    this.gossipT += s;
    if (this.gossipT >= 1) { this.gossipT = 0; this.gossip(); }
    // spymaster
    this.spyT -= s;
    if (this.spyT <= 0) { this.spymasterTick(); if (this.phase !== "plan") return; }
    // events
    this.nextEventT -= s;
    if (this.nextEventT <= 0 && !this.modal) this.fireEvent();
    this.maybePurge();
    for (const n of this.npcs) if (n.abilityCd > 0) n.abilityCd = Math.max(0, n.abilityCd - s);
    if (this.t >= this.totalDays * this.dayLen) {
      this.finish(false, "The Heir is Crowned", `${this.scn.monarchName} lives on, and the succession is sealed. Your window has closed.`);
    }
  }

  private onNewDay() {
    const d = this.day();
    if (d > this.totalDays) return;
    const ag = this.agents();
    const cost = ag.length * 4;
    if (cost > 0) {
      if (this.gold >= cost) { this.gold -= cost; this.stats.goldSpent += cost; this.addLog(`Day ${d}: paid ${cost} gold in conspirator stipends.`, "info"); }
      else {
        this.gold = 0;
        ag.forEach((n) => { n.affinity -= 9; });
        this.addLog(`Day ${d}: unpaid stipends! Your agents grumble.`, "bad");
        this.setBanner("Unpaid Stipends", "Your agents' devotion falters.", "#b3263e");
      }
    }
    const left = this.totalDays - d + 1;
    this.setBanner(`Day ${d}`, left === 1 ? "The succession is TODAY. Strike now!" : `${left} days until the succession.`, left <= 2 ? "#b3263e" : "#e3b95a");
    sfx("bell");
  }

  private perSecond() {
    for (const n of this.npcs) {
      if (n.status === "dead") continue;
      if (n.status === "free" && n.role !== "monarch") {
        if (this.unrest > 35) n.crown = Math.max(0, n.crown - 0.02 * (this.unrest - 35) / 10);
        n.suspicion = Math.max(0, n.suspicion - 0.5);
        if (n.suspicion >= 60) { n.suspicion = 20; this.addEvidence(9, `${n.name} grew wary and reported you`); this.say(n, "Reported you!", "#ff7a7a"); }
        n.heat = Math.max(0, n.heat - 0.2);
        n.disgrace = Math.max(0, n.disgrace - 0.05);
      }
      if (n.status === "conspirator") {
        n.affinity -= n.coerced ? 0.05 : 0.012;
        const spy = this.byRole("spymaster");
        if (spy && spy.status === "free" && !spy.moving && !n.moving && spy.room === n.room) {
          n.exposure += 5 * this.scn.spySkill * this.diff.ev;
          if (Math.random() < 0.3) this.say(n, "Spymaster nearby!", "#ffa07a");
        } else n.exposure = Math.max(0, n.exposure - 0.3);
        if (n.exposure >= 100) { this.say(n, "ARRESTED", "#ff4d4d"); this.arrest(n, `${n.name} was caught under the Spymaster's nose.`); continue; }
        if (n.affinity < 15 && !n.confidant) { this.addEvidence(20); this.arrest(n, `${n.name}, spurned and disillusioned, betrayed the conspiracy!`); }
      }
    }
  }

  private moveNpcs(s: number) {
    for (const n of this.npcs) {
      if (n.status === "dead") continue;
      const dest = this.targetRoom(n);
      if (n.status === "arrested") { if (n.room !== "dungeon") { n.room = "dungeon"; n.moving = false; n.path = []; } continue; }
      if (!n.moving) {
        if (n.room !== dest) { n.path = bfs(n.room, dest); n.moving = n.path.length > 0; n.prog = 0; }
      } else {
        const sp = (1 / 2.6) * n.spd * (n.status === "conspirator" ? 1 + 0.25 * this.perk("passages") : 1);
        n.prog += s * sp;
        if (n.prog >= 1) {
          n.room = n.path.shift() ?? n.room;
          n.prog = 0;
          if (n.path.length === 0) n.moving = false;
          else if (n.path[n.path.length - 1] !== dest) { n.path = bfs(n.room, dest); n.moving = n.path.length > 0; }
        }
      }
    }
  }

  private targetRoom(n: Npc): RoomId {
    if (n.status === "arrested") return "dungeon";
    if (n.status === "conspirator" && n.post) return n.post;
    if (this.override && this.t < this.override.until) return this.override.room;
    return n.sched[this.block()];
  }

  private computeTargets() {
    const groups = new Map<RoomId, Npc[]>();
    const coup = this.coup;
    const leaderPos = new Map<number, { x: number; y: number }>();
    if (coup) coup.squads.forEach((sq) => { if (sq.leader !== null) leaderPos.set(sq.leader, { x: sq.x, y: sq.y - 16 }); });
    for (const n of this.npcs) {
      if (n.status === "dead") continue;
      if (coup && leaderPos.has(n.id)) { const p = leaderPos.get(n.id)!; n.tx = p.x; n.ty = p.y; continue; }
      if (coup && (n.role === "monarch" || (n.role === "champion" && n.status === "free"))) {
        n.tx = coup.mx + (n.role === "champion" ? 20 : 0); n.ty = coup.my + 4;
        if (n.role === "champion" && coup.champHp <= 0) { n.tx = coup.mx - 26; }
        continue;
      }
      if (n.moving && n.path.length) {
        const a = RECT[n.room], b = RECT[n.path[0]];
        const e = n.prog < 0.5 ? 2 * n.prog * n.prog : 1 - Math.pow(-2 * n.prog + 2, 2) / 2;
        n.tx = a.cx + (b.cx - a.cx) * e; n.ty = a.cy + (b.cy - a.cy) * e;
        continue;
      }
      const arr = groups.get(n.room) ?? [];
      arr.push(n);
      groups.set(n.room, arr);
    }
    groups.forEach((list, room) => {
      const r = RECT[room];
      const cols = Math.max(1, Math.min(list.length, Math.floor((r.w - 26) / 30)));
      const rows = Math.ceil(list.length / cols);
      list.forEach((n, i) => {
        const c = i % cols, rw = Math.floor(i / cols);
        const inRow = rw === rows - 1 ? list.length - rw * cols : cols;
        n.tx = r.cx + (c - (inRow - 1) / 2) * 30;
        n.ty = r.cy + (coup ? -2 : 8) + (rw - (rows - 1) / 2) * 28;
      });
    });
    if (coup) this.updateSquadPositions(coup);
  }

  /* ---------------- gossip & rumors ---------------- */
  private gossip() {
    const groups = new Map<RoomId, Npc[]>();
    for (const n of this.npcs) {
      if ((n.status === "free" || n.status === "conspirator") && !n.moving) {
        const a = groups.get(n.room) ?? [];
        a.push(n);
        groups.set(n.room, a);
      }
    }
    const feast = this.override && this.t < this.override.until ? 1.8 : 1;
    for (const r of this.rumors) {
      r.age++;
      r.strength *= 0.994;
      groups.forEach((list) => {
        if (!list.some((n) => r.known.includes(n.id))) return;
        for (const n of list) {
          if (r.known.includes(n.id)) continue;
          const gm = (n.trait === "vain" ? 1.8 : 1) * (n.role === "courtier" || n.role === "servant" ? 1.4 : 1);
          if (Math.random() < 0.26 * gm * feast) this.hear(n, r);
        }
      });
      for (const id of r.known.slice()) {
        const kn = this.npc(id);
        if (!kn || kn.status === "dead" || kn.status === "arrested") continue;
        for (const rel of kn.relations) {
          if (rel.kind === "rival") continue;
          const o = this.npc(rel.id);
          if (o && !r.known.includes(o.id) && o.status !== "dead" && o.status !== "arrested" && Math.random() < 0.012) this.hear(o, r);
        }
      }
    }
    this.rumors = this.rumors.filter((r) => r.strength > 0.2 && r.age < 160);
  }

  private hear(n: Npc, r: Rumor) {
    if (r.known.includes(n.id)) return;
    r.known.push(n.id);
    const tgt = this.npc(r.target);
    this.burst(n.x, n.y - 14, "#c9a6ff", 4, 30, "smoke");
    if (r.kind === "doubt") {
      if (n.status !== "conspirator") n.crown = Math.max(0, n.crown - 7 * r.strength);
      this.unrest = clamp(this.unrest + 1.6 * r.strength, 0, 100);
      if (n.role === "monarch") { this.paranoia = clamp(this.paranoia + 4, 0, 100); this.say(n, "Hmm...", "#c9a6ff"); }
    } else if (r.kind === "scandal" && tgt) {
      if (n.role === "monarch") {
        tgt.disgrace += 50 * r.strength;
        this.say(n, `Hears of ${tgt.name.split(" ")[0]}`, "#c9a6ff");
        this.addLog(`The Monarch hears scandal about ${tgt.name}.`, "rumor");
        if (tgt.disgrace >= 100 && (tgt.status === "free" || tgt.status === "conspirator") && tgt.role !== "monarch") {
          this.addLog(`${tgt.name} is disgraced and thrown in the dungeon!`, "good");
          this.arrest(tgt, "", true);
        }
      }
    } else if (r.kind === "frame" && tgt) {
      if (n.role === "spymaster" && n.status === "free") {
        tgt.heat += 60 * r.strength;
        this.evidence = Math.max(0, this.evidence - 12 * r.strength);
        this.say(n, `Suspects ${tgt.name.split(" ")[0]}!`, "#c9a6ff");
        this.addLog(`The Spymaster now suspects ${tgt.name}.`, "rumor");
        if (tgt.heat >= 100 && tgt.role !== "monarch" && (tgt.status === "free" || tgt.status === "conspirator")) {
          this.addLog(`${tgt.name} is arrested on forged evidence!`, "good");
          this.arrest(tgt, "", true);
        }
      } else if (n.role === "monarch") tgt.disgrace += 25 * r.strength;
    }
  }

  startRumor(kind: Rumor["kind"], spreader: Npc, target: Npc | null, strength: number) {
    const r: Rumor = { id: this.uid++, kind, target: target ? target.id : null, strength, known: [], age: 0 };
    this.rumors.push(r);
    this.stats.rumors++;
    this.hear(spreader, r);
    this.flags.rumor = true;
    sfx("rumor");
    this.addLog(kind === "doubt" ? `A whisper of doubt about the Crown begins with ${spreader.name}.` : `A ${kind === "scandal" ? "scandal" : "forged accusation"} about ${target?.name ?? "someone"} begins with ${spreader.name}.`, "rumor");
  }

  /* ---------------- spymaster ---------------- */
  private spymasterTick() {
    const spy = this.byRole("spymaster");
    const interval = Math.max(8, 30 - this.evidence * 0.15 - (this.t < this.crackdownUntil ? 10 : 0)) / this.scn.spySkill;
    this.spyT = interval;
    if (!spy || spy.status !== "free") return;
    const ag = this.agents().filter((a) => a.status === "conspirator");
    if (ag.length) {
      let a = this.npc(this.spyFocus);
      if (!a || a.status !== "conspirator" || Math.random() < 0.25) {
        const w = ag.map((x) => 1 + x.exposure / 30 + (x.coerced ? 0.3 : 0));
        let r = Math.random() * w.reduce((x, y) => x + y, 0), idx = 0;
        for (; idx < w.length - 1; idx++) { r -= w[idx]; if (r <= 0) break; }
        a = ag[idx];
      }
      this.spyFocus = a.id;
      a.exposure += (26 + this.evidence * 0.2) * this.scn.spySkill * this.diff.ev;
      this.say(spy, "Investigating...", "#c9a6ff");
      if (a.exposure >= 100) this.arrest(a, `The Spymaster uncovers ${a.name}'s treachery!`);
      else if (a.exposure >= 60) this.addLog(`The Spymaster is closing in on ${a.name}.`, "bad");
    }
    // framed targets
    this.npcs.forEach((n) => {
      if (n.heat >= 100 && (n.status === "free" || n.status === "conspirator") && n.role !== "monarch") this.arrest(n, `${n.name} is arrested on the Spymaster's orders.`);
    });
  }

  arrest(n: Npc, msg: string, silent = false) {
    if (n.status === "dead" || n.status === "arrested") return;
    const wasAgent = n.status === "conspirator";
    n.wasConspirator = n.wasConspirator || wasAgent;
    n.status = "arrested";
    n.moving = false; n.path = []; n.post = null; n.room = "dungeon"; n.exposure = 0; n.heat = 0; n.disgrace = 0;
    this.stats.arrests++;
    if (wasAgent) {
      this.stats.lostAgents++;
      if (!silent) this.addEvidence(8);
      this.setBanner("Agent Arrested", n.name, "#b3263e");
    }
    if (msg) this.addLog(msg, wasAgent ? "bad" : "good");
    this.burst(n.x, n.y, "#999", 10, 70, "smoke");
    this.shake(5);
    sfx("arrest");
    if (this.selected === n.id) this.targeting = null;
  }

  private maybePurge() {
    if (this.hour() < 20 || this.purgeDay === this.day() || this.paranoia < 65) return;
    this.purgeDay = this.day();
    const cands = this.npcs.filter((n) => (n.status === "free" || n.status === "conspirator") && n.role !== "monarch" && n.role !== "champion" && n.role !== "spymaster");
    cands.sort((a, b) => (b.suspicion + b.disgrace + b.heat + b.exposure * 1.2 + (b.status === "conspirator" ? 15 : 0)) - (a.suspicion + a.disgrace + a.heat + a.exposure * 1.2 + (a.status === "conspirator" ? 15 : 0)));
    const count = this.paranoia > 85 ? 2 : 1;
    this.setBanner("THE PURGE", "The paranoid Monarch demands blood.", "#b3263e");
    sfx("gong");
    this.shake(10);
    this.flash("#b3263e", 0.35);
    for (let i = 0; i < count && i < cands.length; i++) this.arrest(cands[i], `PURGE: ${cands[i].name} is dragged to the dungeon.`);
    this.paranoia = Math.max(30, this.paranoia - 20);
  }

  /* ---------------- events ---------------- */
  private fireEvent() {
    this.nextEventT = rand(34, 58) / this.scn.eventRate;
    const w = this.scn.eventWeights;
    const ids = (Object.keys(w) as EventId[]).filter((id) => id !== this.lastEventId);
    const total = ids.reduce((a, id) => a + (w[id] ?? 0), 0);
    if (total <= 0) return;
    let r = Math.random() * total, pickId = ids[0];
    for (const id of ids) { r -= w[id] ?? 0; if (r <= 0) { pickId = id; break; } }
    this.lastEventId = pickId;
    const ev = EVENTS[pickId];
    sfx("event");
    if (ev.choices) {
      this.modal = { title: ev.title, icon: ev.icon, text: ev.text, choices: ev.choices.map((c) => ({ label: c.label, hint: c.hint })) };
      this.modalHandlers = ev.choices.map((c) => c.run);
    } else {
      this.setBanner(`${ev.icon} ${ev.title}`, ev.text, "#e3b95a");
      this.addLog(`${ev.title}: ${ev.text}`, "event");
      ev.run?.(this);
    }
  }

  chooseModal(i: number) {
    const h = this.modalHandlers[i];
    if (!h || !this.modal) return;
    const res = h(this);
    this.addLog(res, "event");
    this.modal = null;
    this.modalHandlers = [];
    sfx("click");
  }

  startFeast(hours = 8) {
    this.override = { room: "ballroom", until: this.t + (hours / 24) * this.dayLen };
  }

  /* ---------------- actions ---------------- */
  agentFor(target: Npc): Npc | null {
    return this.npcs.find((a) => a.status === "conspirator" && !a.moving && a.id !== target.id && a.room === target.room) ?? null;
  }

  recruitChance(n: Npc): number {
    let p = 0.2 + (100 - n.crown) * 0.004 + n.affinity * 0.003 + n.ambition * 0.002 + this.legit * 0.002 + this.perk("silver") * 0.06 + this.diff.recruit;
    if (n.trait === "ambitious") p += 0.12;
    if (n.trait === "honorable") p -= 0.2;
    if (n.trait === "pious") p += this.legit / 400;
    if (n.trait === "greedy") p += 0.04;
    if (n.role === "champion") p -= 0.1;
    if (n.role === "captain" || n.role === "spymaster") p -= 0.05;
    p -= n.suspicion * 0.002;
    return clamp(p, 0.05, 0.95);
  }
  blackmailChance(n: Npc): number {
    return clamp(0.78 + (n.trait === "coward" ? 0.15 : 0) - (n.trait === "honorable" ? 0.1 : 0) + this.perk("silver") * 0.06 + this.diff.recruit, 0.1, 0.96);
  }
  killChance(n: Npc): number {
    return n.role === "champion" ? 0.45 : n.role === "captain" ? 0.65 : n.role === "spymaster" ? 0.7 : 0.88;
  }

  actionInfo(targetId: number, id: ActionId): ActionInfo {
    const n = this.npc(targetId);
    const b = ACTION_BASE[id];
    const info: ActionInfo = { id, label: b.label, icon: b.icon, desc: b.desc, gold: b.gold, infl: b.infl, forge: b.forge, ok: false, chance: null, remote: false, agent: null };
    if (!n || n.status === "dead") { info.reason = "Gone"; return info; }
    if (this.phase !== "plan") { info.reason = "Coup underway"; return info; }
    const agent = this.agentFor(n);
    info.agent = agent ? agent.name : null;
    const needsReach = id === "investigate" || id === "recruit" || id === "bribe" || id === "blackmail" || id === "doubt" || id === "scandal" || id === "frame";
    if (needsReach && n.status !== "arrested" && !agent && !(n.status === "conspirator")) {
      info.remote = true;
      info.gold *= 2; info.infl *= 2;
    }
    const monarch = n.role === "monarch";
    switch (id) {
      case "investigate": if (n.status === "arrested") info.reason = "Imprisoned"; else if (n.known && n.secretKnown) info.reason = "Fully investigated"; break;
      case "recruit": if (n.status !== "free") info.reason = n.status === "conspirator" ? "Already sworn" : "Unreachable"; else if (monarch) info.reason = "Cannot recruit the Monarch"; else if (n.known) info.chance = this.recruitChance(n); break;
      case "bribe": if (n.status !== "free") info.reason = "Not available"; else if (monarch) info.reason = "Cannot bribe the Monarch"; break;
      case "blackmail": if (n.status !== "free") info.reason = "Not available"; else if (monarch) info.reason = "The Monarch fears nothing"; else if (!n.secretKnown) info.reason = "No known secret — Eavesdrop first"; else info.chance = this.blackmailChance(n); break;
      case "doubt": if (n.status === "arrested") info.reason = "Imprisoned"; break;
      case "scandal": case "frame": if (n.status === "arrested") info.reason = "Imprisoned"; break;
      case "assassinate": {
        if (monarch) info.reason = "Only the coup can topple the Monarch";
        else if (n.status !== "free") info.reason = "Not a valid target";
        else {
          const killer = this.npcs.find((a) => a.role === "assassin" && a.status === "conspirator" && !a.moving && a.room === n.room && a.id !== n.id);
          if (!killer) info.reason = "Needs your Shadow Blade in the same room"; else { info.chance = this.killChance(n); info.agent = killer.name; }
        }
        break;
      }
      case "free": if (n.status !== "arrested") info.reason = "Not imprisoned"; break;
      case "reward": if (n.status !== "conspirator") info.reason = "Agents only"; else if (n.affinity >= 98) info.reason = "Utterly devoted"; break;
    }
    if (!info.reason) {
      if (this.gold < info.gold) info.reason = `Needs ${info.gold} gold`;
      else if (this.infl < info.infl) info.reason = `Needs ${info.infl} influence`;
      else if (this.forgeries < info.forge) info.reason = "Needs a Forgery (Archivist)";
    }
    info.ok = !info.reason;
    return info;
  }

  private spend(info: ActionInfo) {
    this.gold -= info.gold; this.infl -= info.infl; this.forgeries -= info.forge;
    this.stats.goldSpent += info.gold;
    if (info.gold > 0) sfx("coin");
  }

  perform(targetId: number, id: ActionId) {
    const n = this.npc(targetId);
    if (!n || this.modal) return;
    const info = this.actionInfo(targetId, id);
    if (!info.ok) { sfx("fail"); return; }
    const room = info.remote ? null : n.room;
    const agent = this.agentFor(n);
    switch (id) {
      case "investigate": {
        this.spend(info);
        n.known = true;
        this.stats.investigations++;
        this.flags.investigated = true;
        const found = !n.secretKnown && Math.random() < (info.remote ? 0.45 : 0.8);
        if (found) { n.secretKnown = true; this.say(n, "Secret found!", "#c9a6ff"); this.addLog(`${n.name} secretly harbors: ${SECRETS[n.secret].name}.`, "good"); }
        else this.say(n, "Intel gained", "#9fd8ff");
        this.burst(n.x, n.y, "#9fd8ff", 10, 60);
        this.ring(n.x, n.y, "#9fd8ff", 36);
        sfx("whisper");
        this.leak(room, 3, [n.id]);
        break;
      }
      case "recruit": {
        this.spend(info);
        if (Math.random() < this.recruitChance(n)) {
          Object.assign(n, { status: "conspirator", affinity: Math.max(n.affinity, 60), known: true, wasConspirator: true, coerced: false });
          n.exposure = 0;
          this.stats.recruited++; this.flags.recruited = true;
          this.say(n, "Recruited!", "#7cff9f");
          this.addLog(`${n.name} (${ROLES[n.role].title}) joins your conspiracy.`, "good");
          this.burst(n.x, n.y, "#e3b95a", 24, 120);
          this.ring(n.x, n.y, "#e3b95a", 50);
          sfx("success");
          this.leak(room, 5, [n.id]);
        } else {
          n.suspicion += 28; n.affinity = Math.max(0, n.affinity - 5);
          this.say(n, "Refused!", "#ff7a7a");
          this.addLog(`${n.name} rejected your overture.`, "bad");
          this.burst(n.x, n.y, "#b3263e", 10, 80);
          sfx("fail");
          if (Math.random() < (n.crown / 100) * 0.7) this.addEvidence(8, `${n.name} reported your approach`);
          this.leak(room, 6, [n.id]);
        }
        break;
      }
      case "bribe": {
        this.spend(info);
        if (n.trait === "honorable" && Math.random() < 0.4) {
          n.suspicion += 25; this.say(n, "Insulted!", "#ff7a7a"); this.addLog(`${n.name} was insulted by your bribe.`, "bad"); sfx("fail");
        } else {
          n.affinity = Math.min(100, n.affinity + (n.trait === "greedy" ? 34 : 20));
          n.crown = Math.max(0, n.crown - 8);
          this.say(n, "Favor +", "#e3b95a");
          this.burst(n.x, n.y, "#e3b95a", 14, 90, "coin");
        }
        this.leak(room, 4, [n.id]);
        break;
      }
      case "blackmail": {
        this.spend(info);
        if (Math.random() < this.blackmailChance(n)) {
          Object.assign(n, { status: "conspirator", affinity: 35, known: true, wasConspirator: true, coerced: true, exposure: 0 });
          this.stats.recruited++; this.flags.recruited = true;
          this.say(n, "Coerced!", "#ff9fd0");
          this.addLog(`${n.name} bends to blackmail. They may not stay loyal when the coup begins.`, "good");
          this.burst(n.x, n.y, "#b3263e", 20, 110);
          sfx("success");
        } else {
          n.suspicion += 40; this.say(n, "Defiant!", "#ff7a7a"); this.addEvidence(10, `${n.name} defied your blackmail and ran to the Spymaster`); sfx("fail");
        }
        this.leak(room, 8, [n.id]);
        break;
      }
      case "doubt": {
        this.spend(info);
        this.startRumor("doubt", n, null, 1);
        this.leak(room, 4, [n.id]);
        break;
      }
      case "scandal": case "frame": {
        this.targeting = { kind: id, spreader: n.id };
        this.setBanner("Choose a Target", id === "scandal" ? "Click the courtier the rumor is about. Esc to cancel." : "Click the courtier to frame. Esc to cancel.", "#c9a6ff");
        sfx("select");
        break;
      }
      case "assassinate": {
        const killer = this.npcs.find((a) => a.role === "assassin" && a.status === "conspirator" && !a.moving && a.room === n.room && a.id !== n.id)!;
        this.spend(info);
        this.leak(room, 14, [n.id, killer.id]);
        if (Math.random() < this.killChance(n)) {
          n.status = "dead"; n.moving = false; n.path = [];
          this.stats.kills++;
          this.addLog(`${n.name} (${ROLES[n.role].title}) was found dead.`, "good");
          this.say(n, "SILENCED", "#ff4d4d", );
          this.burst(n.x, n.y, "#b3263e", 30, 150);
          this.shake(8); this.flash("#b3263e", 0.2);
          sfx("stab");
          this.addEvidence(10, "A body was discovered");
          this.paranoia = clamp(this.paranoia + 8, 0, 100);
          this.unrest = clamp(this.unrest + 3, 0, 100);
          if (this.selected === n.id) this.selected = null;
        } else {
          this.addLog(`The attempt on ${n.name} failed! ${killer.name} was caught.`, "bad");
          sfx("fail");
          this.addEvidence(18);
          this.arrest(killer, "");
        }
        break;
      }
      case "free": {
        this.spend(info);
        if (Math.random() < 0.65) {
          Object.assign(n, { status: "conspirator", affinity: 80, crown: Math.max(0, n.crown - 20), known: true, wasConspirator: true, coerced: false, exposure: 0, room: "dungeon" });
          this.say(n, "Freed!", "#7cff9f");
          this.addLog(`${n.name} is smuggled out of the dungeon and swears loyalty to you.`, "good");
          this.burst(n.x, n.y, "#7cff9f", 18, 100);
          sfx("success");
        } else { this.addEvidence(8, "The jailer talked"); sfx("fail"); }
        break;
      }
      case "reward": {
        this.spend(info);
        n.affinity = Math.min(100, n.affinity + 20);
        n.coerced = n.coerced && n.affinity < 60;
        this.say(n, "Devotion +", "#e3b95a");
        this.burst(n.x, n.y, "#e3b95a", 12, 80, "coin");
        break;
      }
    }
    void agent;
  }

  finishTargeting(targetId: number) {
    const t = this.targeting;
    if (!t) return;
    const spreader = this.npc(t.spreader);
    const target = this.npc(targetId);
    if (!spreader || !target || target.id === spreader.id || target.status === "dead" || target.status === "arrested" || target.role === "monarch") { sfx("fail"); return; }
    const info = this.actionInfo(spreader.id, t.kind);
    if (!info.ok) { this.targeting = null; sfx("fail"); return; }
    this.spend(info);
    const strength = t.kind === "frame" ? 0.9 : target.secretKnown ? 1 : 0.55;
    this.targeting = null;
    this.startRumor(t.kind, spreader, target, strength);
    this.leak(info.remote ? null : spreader.room, 4, [spreader.id]);
  }

  cancelTargeting() { if (this.targeting) { this.targeting = null; sfx("click"); } }

  post(id: number, room: RoomId) {
    const n = this.npc(id);
    if (!n || n.status !== "conspirator" || this.phase !== "plan") return;
    n.post = room;
    this.flags.posted = true;
    const r = RECT[room];
    this.ring(r.cx, r.cy, "#e3b95a", 40);
    this.float(r.cx, r.cy - 20, `📍 ${n.name.split(" ")[0]}`, "#e3b95a", 14);
    sfx("post");
  }
  recall(id: number) { const n = this.npc(id); if (n) { n.post = null; sfx("click"); } }

  abilityInfo(n: Npc): { ok: boolean; reason?: string } {
    const a = ROLES[n.role].ability;
    if (!a) return { ok: false, reason: "No special power" };
    if (n.status !== "conspirator") return { ok: false, reason: "Not your agent" };
    if (this.phase !== "plan") return { ok: false, reason: "Coup underway" };
    if (n.moving) return { ok: false, reason: "In transit" };
    if (a.room !== "any" && n.room !== a.room) return { ok: false, reason: `Must be in ${ROOM_MAP[a.room].name}` };
    if (n.abilityCd > 0) return { ok: false, reason: `Cooldown ${Math.ceil(n.abilityCd)}s` };
    if (this.gold < a.gold) return { ok: false, reason: `Needs ${a.gold} gold` };
    if (this.infl < a.infl) return { ok: false, reason: `Needs ${a.infl} influence` };
    switch (n.role) {
      case "captain": if (this.garrisonCut >= 3) return { ok: false, reason: "Watch already thinned" }; break;
      case "general": if (this.muster >= 24) return { ok: false, reason: "Army fully mustered" }; break;
      case "priest": if (this.legit >= 100) return { ok: false, reason: "Mandate complete" }; break;
      case "spymaster": if (this.evidence <= 0.5) return { ok: false, reason: "No evidence to bury" }; break;
      case "physician": if (this.vigor <= 15) return { ok: false, reason: "Monarch already frail" }; break;
      case "scribe": if (this.forgeries >= 3) return { ok: false, reason: "Forgeries full" }; break;
      case "servant": if (!this.npcs.some((x) => x.role !== "monarch" && (!x.known || !x.secretKnown) && x.status !== "dead" && x.status !== "conspirator")) return { ok: false, reason: "Nothing left to learn" }; break;
      default: break;
    }
    return { ok: true };
  }

  useAbility(id: number) {
    const n = this.npc(id);
    if (!n || this.modal) return;
    const info = this.abilityInfo(n);
    const a = ROLES[n.role].ability;
    if (!a || !info.ok) { sfx("fail"); return; }
    this.gold -= a.gold; this.infl -= a.infl; this.stats.goldSpent += a.gold;
    n.abilityCd = a.cd;
    this.flags.ability = true;
    switch (n.role) {
      case "captain": this.garrisonCut++; this.say(n, "Watch thinned", "#ffb07a"); break;
      case "general": this.muster = Math.min(24, this.muster + 6); this.say(n, `Muster +6`, "#ffb07a"); break;
      case "treasurer": this.gold += 70; this.lastSkim = this.t; this.say(n, "+70 gold", "#e3b95a"); this.burst(n.x, n.y, "#e3b95a", 22, 130, "coin"); break;
      case "priest": this.legit = Math.min(100, this.legit + 12); this.say(n, "Legitimacy +12", "#e8e8ff"); this.burst(n.x, n.y, "#e8e8ff", 16, 70); break;
      case "spymaster":
        this.evidence = Math.max(0, this.evidence - 22);
        this.agents().forEach((x) => { x.exposure = Math.max(0, x.exposure - 20); });
        this.say(n, "Evidence -22", "#7cff9f");
        break;
      case "physician": this.vigor = Math.max(15, this.vigor - 15); this.say(n, "Monarch weakened", "#9fffd0"); break;
      case "scribe": this.forgeries = Math.min(3, this.forgeries + 1); this.say(n, "Forgery +1", "#e9dcc0"); break;
      case "chef": this.startFeast(8); this.setBanner("Royal Feast!", "The court converges on the Ballroom.", "#e3b95a"); this.addLog("A Royal Feast gathers the whole court in the Ballroom.", "event"); break;
      case "courtier": {
        this.infl = Math.min(100, this.infl + 22);
        this.npcs.forEach((x) => { if (x.status === "free" && !x.moving && x.room === n.room) { x.affinity = Math.min(100, x.affinity + 3); x.crown = Math.max(0, x.crown - 2); } });
        this.say(n, "+22 influence", "#9fd8ff");
        break;
      }
      case "servant": {
        const c = this.npcs.filter((x) => x.role !== "monarch" && (!x.known || !x.secretKnown) && x.status !== "dead" && x.status !== "conspirator");
        const t = pick(c);
        t.known = true; t.secretKnown = true;
        this.say(n, `Learned about ${t.name.split(" ")[0]}`, "#c9a6ff");
        this.addLog(`Gossip: ${t.name} — ${SECRETS[t.secret].name}.`, "good");
        break;
      }
      default: break;
    }
    sfx("success");
    this.burst(n.x, n.y, "#ffd27a", 12, 80);
    this.ring(n.x, n.y, "#ffd27a", 40);
    if (a.loud > 0) this.leak(n.room, a.loud, [n.id]);
  }

  select(id: number | null) {
    this.selected = id;
    if (id !== null) { this.flags.selected = true; sfx("select"); }
  }

  /* ---------------- coup ---------------- */
  private recruitFollowers(n: Npc): number {
    let c = ROLES[n.role].followers + this.perk("cadre") * 2 + (n.role === "general" ? this.muster : 0);
    if (n.trait === "coward") c *= 0.75;
    if (n.affinity < 40) c *= 0.85;
    return Math.max(1, Math.round(c));
  }

  computeGarrison() {
    const iron = this.has("iron") ? 1.3 : 1;
    const garrison = mkRec((id) => {
      let g = ROOM_MAP[id].garrison * this.scn.garrisonMul * this.diff.garrison * iron;
      g *= (1 - this.unrest / 300) * (1 - this.legit / 400) * (1 + this.evidence / 300);
      if (id === "barracks" || id === "gate" || id === "throne") g = Math.max(g * 0.4, g - this.garrisonCut * 1.5);
      if (id === "throne" || id === "chamber") g += this.guardBonus + this.paranoia / 14;
      return g;
    });
    this.npcs.forEach((n) => {
      if (n.status !== "free") return;
      if (n.role === "captain") garrison.throne += 5;
      if (n.role === "general") garrison.barracks += 7;
      if (n.role === "spymaster") garrison.tower += 3;
      if (n.role === "assassin") garrison.gate += 2;
    });
    ROOMS.forEach((r) => (garrison[r.id] = Math.round(garrison[r.id] * 10) / 10));
    return garrison;
  }

  champion() {
    const c = this.byRole("champion");
    return c && c.status === "free" ? c : null;
  }

  champStats() {
    if (!this.champion()) return { hp: 0, power: 0 };
    const v = 0.5 + this.vigor / 200;
    return { hp: this.scn.champHp * this.diff.loyal * v, power: this.scn.champPower * this.diff.loyal * (0.7 + this.vigor / 330) };
  }

  forecast() {
    const garrison = this.computeGarrison();
    let reb = 0;
    this.agents().forEach((n) => { reb += this.recruitFollowers(n) * (n.coerced && !n.confidant ? 0.65 : 1); });
    const rm = this.rebelMult(null);
    const cs = this.champStats();
    const routeA = garrison.tower + garrison.chamber, routeB = garrison.ballroom + garrison.chamber;
    const reserve = this.scn.reserve * this.diff.garrison;
    const loyal = (Math.min(routeA, routeB) + cs.power * 1.4 + reserve * 0.55) * this.diff.loyal;
    const rebEff = reb * rm * 0.85;
    const r = loyal > 0 ? rebEff / loyal : 3;
    const odds = Math.round((r * r / (1 + r * r)) * 100);
    const label = odds < 15 ? "Hopeless" : odds < 35 ? "Reckless" : odds < 55 ? "Even Odds" : odds < 78 ? "Favorable" : "Overwhelming";
    return { rebels: Math.round(reb), loyal: Math.round(loyal), odds, label, garrison, champ: cs, reserve: Math.round(reserve), mult: rm };
  }

  rebelMult(c: Coup | null) {
    return 1 + this.legit / 250 + this.perk("rally") * 0.08 + (c && c.owner.armory === "rebel" ? 0.15 : 0) + (c && c.owner.chapel === "rebel" ? 0.1 : 0);
  }
  loyalMult(c: Coup) { return this.diff.loyal * (c.owner.throne === "rebel" ? 0.9 : 1); }

  canLaunch() { return this.phase === "plan" && !this.modal && this.agents().length > 0; }

  launchCoup() {
    if (!this.canLaunch()) return false;
    const garrison = this.computeGarrison();
    const cs = this.champStats();
    const monarch = this.byRole("monarch")!;
    this.npcs.forEach((n) => { if (n.moving) { n.room = n.path[0] ?? n.room; n.moving = false; n.path = []; n.prog = 0; } n.post = null; });
    const squads: Squad[] = [];
    const prisoners: number[] = [];
    this.agents().forEach((n) => {
      const count = this.recruitFollowers(n);
      const defect = n.coerced && !n.confidant && Math.random() < 0.35;
      squads.push({ id: this.uid++, side: defect ? "loyal" : "rebel", count, room: n.room, path: [], prog: 0, goal: null, leader: defect ? null : n.id, name: `${n.name.split(" ")[0]}'s ${ROLES[n.role].title === "Courtier" ? "retinue" : "troops"}`, x: 0, y: 0, flash: 0 });
      if (defect) { this.addLog(`${n.name}, coerced, defects to the Crown at the crucial hour!`, "bad"); n.status = "free"; n.coerced = false; }
    });
    this.npcs.forEach((n) => { if (n.status === "arrested" && n.wasConspirator) prisoners.push(n.id); });
    const mPath = bfs(monarch.room, "chamber");
    const limit = 150 + 20 * this.perk("night");
    const c: Coup = {
      t: 0, limit, squads, garrison, garrisonMax: { ...garrison }, owner: mkRec(() => "crown" as const),
      champHp: cs.hp, champMax: cs.hp, champPower: cs.power, champPhase: 0, fury: false,
      monarchRoom: monarch.room, monarchPath: mPath, monarchProg: 0, mx: 0, my: 0, capture: 0,
      reserve: this.scn.reserve * this.diff.garrison, spawnT: 7, aiT: 2, mercT: 6, mercLeft: 4, gateBonus: false, sel: [],
      acc: mkRec(() => 0), sfxT: 0, prisoners, startRebels: 0,
    };
    c.mx = RECT[monarch.room].cx; c.my = RECT[monarch.room].cy;
    const rebels = squads.filter((s) => s.side === "rebel");
    c.startRebels = rebels.reduce((a, s) => a + s.count, 0);
    this.coup = c;
    this.updateSquadPositions(c);
    this.phase = "coup";
    this.selected = null; this.targeting = null;
    // rebels already holding a room with no defenders
    squads.forEach((s) => { s.x = RECT[s.room].cx; s.y = RECT[s.room].cy; });
    setMusicMode("coup");
    sfx("horn");
    setTimeout(() => sfx("drum"), 350);
    this.shake(12); this.flash("#e3b95a", 0.45);
    this.setBanner("THE COUP BEGINS", "Order your squads. Seize the Monarch before the relief army arrives!", "#e3b95a");
    this.addLog("THE COUP HAS BEGUN! Seize the Monarch before the relief army arrives.", "coup");
    if (rebels.length) c.sel = rebels.map((s) => s.id);
    return true;
  }

  private updateSquadPositions(c: Coup) {
    const slot = new Map<string, number>();
    for (const s of c.squads) {
      if (s.path.length > 0) {
        const a = RECT[s.room], b = RECT[s.path[0]];
        const e = s.prog;
        const off = s.side === "rebel" ? -14 : 14;
        s.x = a.cx + (b.cx - a.cx) * e; s.y = a.cy + (b.cy - a.cy) * e + 30 + off * 0.2;
      } else {
        const key = `${s.room}-${s.side}`;
        const i = slot.get(key) ?? 0;
        slot.set(key, i + 1);
        const r = RECT[s.room];
        s.x = s.side === "rebel" ? r.x + 30 + i * 36 : r.x + r.w - 30 - i * 36;
        s.y = r.y + r.h - 20;
      }
    }
    // monarch position
    if (c.monarchPath.length > 0) {
      const a = RECT[c.monarchRoom], b = RECT[c.monarchPath[0]];
      c.mx = a.cx + (b.cx - a.cx) * c.monarchProg; c.my = a.cy + (b.cy - a.cy) * c.monarchProg;
    } else { c.mx = RECT[c.monarchRoom].cx; c.my = RECT[c.monarchRoom].cy - 4; }
  }

  rebelsIn(c: Coup, room: RoomId) { return c.squads.filter((s) => s.side === "rebel" && s.path.length === 0 && s.room === room && s.count > 0.05); }
  loyalsIn(c: Coup, room: RoomId) { return c.squads.filter((s) => s.side === "loyal" && s.path.length === 0 && s.room === room && s.count > 0.05); }
  champHere(c: Coup, room: RoomId) { return c.champHp > 0 && c.monarchPath.length === 0 && c.monarchRoom === room; }
  loyalPower(c: Coup, room: RoomId) {
    const ls = this.loyalsIn(c, room).reduce((a, s) => a + s.count, 0);
    const champ = this.champHere(c, room) ? c.champPower * (0.5 + 0.5 * c.champHp / Math.max(1, c.champMax)) * (c.fury ? 1.35 : 1) : 0;
    return c.garrison[room] + ls + champ;
  }

  orderSquads(ids: number[], room: RoomId) {
    const c = this.coup;
    if (!c || this.phase !== "coup") return;
    let any = false;
    for (const id of ids) {
      const s = c.squads.find((q) => q.id === id && q.side === "rebel");
      if (!s || s.count <= 0.05) continue;
      s.goal = room;
      if (s.path.length > 0) {
        const next = s.path[0];
        s.path = next === room ? [next] : [next, ...bfs(next, room)];
      } else s.path = bfs(s.room, room);
      s.prog = s.path.length ? s.prog : 0;
      any = true;
    }
    if (any) { const r = RECT[room]; this.ring(r.cx, r.cy, "#e3b95a", 44); sfx("post"); }
  }

  private spawnSquad(side: "rebel" | "loyal", count: number, room: RoomId, name: string, goal: RoomId | null = null) {
    const c = this.coup!;
    const sq: Squad = { id: this.uid++, side, count, room, path: [], prog: 0, goal, leader: null, name, x: RECT[room].cx, y: RECT[room].cy, flash: 0 };
    if (goal && goal !== room) sq.path = bfs(room, goal);
    c.squads.push(sq);
    return sq;
  }

  private stepCoup(s: number) {
    const c = this.coup;
    if (!c) return;
    c.t += s;
    c.sfxT -= s;
    const EDGE = 2.4;
    // move squads
    for (const sq of c.squads) {
      sq.flash = Math.max(0, sq.flash - s * 3);
      if (sq.count <= 0.05) continue;
      if (sq.path.length > 0) {
        sq.prog += s / EDGE;
        if (sq.prog >= 1) {
          sq.room = sq.path.shift()!;
          sq.prog = 0;
          const enemyHere = sq.side === "rebel" ? (c.owner[sq.room] === "crown" && this.loyalPower(c, sq.room) > 0.3) : this.rebelsIn(c, sq.room).length > 0;
          if (enemyHere) sq.path = [];
          else if (sq.side === "rebel" && c.owner[sq.room] === "crown" && sq.path.length === 0) { /* arrived at empty crown room */ }
        }
      } else if (sq.side === "rebel" && sq.goal && sq.room !== sq.goal) {
        if (!(c.owner[sq.room] === "crown" && this.loyalPower(c, sq.room) > 0.3)) sq.path = bfs(sq.room, sq.goal);
      }
    }
    // monarch flight
    if (c.monarchPath.length > 0) {
      c.monarchProg += s / (EDGE * 1.2);
      if (c.monarchProg >= 1) { c.monarchRoom = c.monarchPath.shift()!; c.monarchProg = 0; }
    }
    // combat
    const rm = this.rebelMult(c), lm = this.loyalMult(c);
    const K = 0.16;
    let anyFight = false;
    for (const room of ROOMS) {
      const id = room.id;
      const rebs = this.rebelsIn(c, id);
      const R = rebs.reduce((a, q) => a + q.count, 0);
      const Lp = this.loyalPower(c, id);
      if (R > 0.05 && Lp > 0.05) {
        anyFight = true;
        const dR = Lp * K * lm * s;
        let dL = R * K * rm * s;
        const loyals = this.loyalsIn(c, id);
        const soft = c.garrison[id] + loyals.reduce((a, q) => a + q.count, 0);
        if (soft > 0) {
          const take = Math.min(dL, soft);
          const gShare = c.garrison[id] / soft;
          c.garrison[id] = Math.max(0, c.garrison[id] - take * gShare);
          loyals.forEach((q) => { q.count = Math.max(0, q.count - take * (q.count / soft)); q.flash = 1; });
          dL -= take;
          c.acc[id] += take;
        }
        if (dL > 0 && this.champHere(c, id)) {
          const prev = c.champHp / c.champMax;
          c.champHp = Math.max(0, c.champHp - dL * 0.8);
          this.champPhases(c, prev);
        }
        rebs.forEach((q) => { q.count = Math.max(0, q.count - dR * (q.count / R)); q.flash = 1; });
        c.acc[id] += 0;
        const r = RECT[id];
        if (Math.random() < s * 14) this.burst(r.cx + rand(-r.w / 3, r.w / 3), r.cy + rand(-r.h / 4, r.h / 4), Math.random() < 0.5 ? "#ffd27a" : "#ff6a5a", 3, 100);
        if (c.sfxT <= 0) { c.sfxT = 0.35; sfx(Math.random() < 0.5 ? "clash" : "hit"); this.shake(1.6); }
        if (c.acc[id] >= 1.5) { c.acc[id] = 0; this.float(r.cx + rand(-30, 30), r.cy - 10, "⚔️", "#ff8a7a", 16); }
      }
    }
    // remove dead squads, handle leaders
    for (const sq of c.squads) {
      if (sq.count <= 0.05 && sq.count !== -1) {
        if (sq.leader !== null) {
          const n = this.npc(sq.leader);
          if (n) {
            if (Math.random() < 0.5) { n.status = "dead"; n.moving = false; this.stats.lostAgents++; this.addLog(`${n.name} fell in the fighting.`, "bad"); } else { this.arrest(n, `${n.name} was captured when their troops broke.`, true); }
          }
          sq.leader = null;
        }
        sq.count = -1;
      }
    }
    c.squads = c.squads.filter((q) => q.count !== -1);
    // ownership
    for (const room of ROOMS) {
      const id = room.id;
      const R = this.rebelsIn(c, id).reduce((a, q) => a + q.count, 0);
      const Lp = this.loyalPower(c, id);
      if (c.owner[id] === "crown" && R > 0.5 && Lp <= 0.3) this.captureRoom(c, id);
      else if (c.owner[id] === "rebel" && R <= 0.05 && this.loyalsIn(c, id).length > 0) { c.owner[id] = "crown"; this.float(RECT[id].cx, RECT[id].cy, "Retaken by the Crown", "#ff6a5a", 14); this.addLog(`${room.name} retaken by loyalists.`, "bad"); }
    }
    // loyalist AI
    c.spawnT -= s;
    if (c.spawnT <= 0) {
      c.spawnT = 9 / this.diff.loyal;
      if (c.owner.barracks === "crown" && c.reserve > 0.5) {
        const size = Math.min(c.reserve, 4 + this.scn.index);
        c.reserve -= size;
        const rebRooms = ROOMS.map((r) => r.id).filter((id) => this.rebelsIn(c, id).length > 0);
        let target: RoomId = c.monarchRoom;
        let best = 99;
        rebRooms.forEach((id) => { const d = bfs(id, c.monarchRoom).length; if (d < best) { best = d; target = id; } });
        this.spawnSquad("loyal", size, "barracks", "Royal Guard", target);
        this.float(RECT.barracks.cx, RECT.barracks.cy - 24, "Reinforcements!", "#ff6a5a", 14);
        sfx("horn");
      }
    }
    c.aiT -= s;
    if (c.aiT <= 0) {
      c.aiT = 2.5;
      for (const sq of c.squads) {
        if (sq.side !== "loyal" || sq.path.length > 0 || sq.count <= 0.05) continue;
        if (this.rebelsIn(c, sq.room).length > 0) continue;
        let best = 99, tgt: RoomId | null = null;
        for (const r of ROOMS) {
          if (this.rebelsIn(c, r.id).length === 0 || r.id === sq.room) continue;
          const d = bfs(sq.room, r.id).length;
          if (d < best) { best = d; tgt = r.id; }
        }
        if (tgt) { sq.goal = tgt; sq.path = bfs(sq.room, tgt); }
      }
    }
    // mercenaries
    if (c.owner.treasury === "rebel" && c.mercLeft > 0) {
      c.mercT -= s;
      if (c.mercT <= 0) { c.mercT = 16; c.mercLeft--; this.spawnSquad("rebel", 4, "treasury", "Mercenaries"); this.float(RECT.treasury.cx, RECT.treasury.cy - 24, "Mercenaries hired!", "#e3b95a", 14); sfx("coin"); }
    }
    // capture check
    if (c.monarchPath.length === 0) {
      const R = this.rebelsIn(c, c.monarchRoom).reduce((a, q) => a + q.count, 0);
      const Lp = this.loyalPower(c, c.monarchRoom);
      if (R > 0.5 && Lp <= 0.3) {
        c.capture += s;
        if (Math.random() < s * 8) this.burst(c.mx, c.my, "#ffd27a", 2, 60);
        if (c.capture >= 4) { this.finish(true, "The Crown is Yours!", `${this.scn.monarchName} is seized in the ${ROOM_MAP[c.monarchRoom].name}.`); return; }
      } else c.capture = Math.max(0, c.capture - s * 1.5);
    }
    // lose checks
    const rebTotal = c.squads.filter((q) => q.side === "rebel").reduce((a, q) => a + q.count, 0);
    if (rebTotal < 0.4) { this.finish(false, "The Coup is Crushed", "Your last soldier has fallen. The loyalists hunt down every conspirator."); return; }
    if (c.owner.gate === "rebel" && !c.gateBonus) { c.gateBonus = true; c.limit += 45; this.addLog("Gatehouse seized: the relief army is delayed by 45s.", "coup"); }
    if (c.t >= c.limit) { this.finish(false, "The Relief Army Arrives", "Loyalist reinforcements pour through the gates before you could seize the Monarch."); return; }
    void anyFight;
  }

  private champPhases(c: Coup, prevFrac: number) {
    const frac = c.champHp / Math.max(1, c.champMax);
    const marks = this.scn.boss ? [0.66, 0.33] : [0.5];
    while (c.champPhase < marks.length && frac <= marks[c.champPhase] && prevFrac > marks[c.champPhase] - 0.0001) {
      c.champPhase++;
      const room = c.monarchRoom;
      const r = RECT[room];
      if (this.scn.boss && c.champPhase === 2) {
        c.fury = true;
        this.setBanner("THE HOLLOW KNIGHT RAGES", "Fury doubles his blows!", "#b3263e");
        this.float(r.cx, r.cy - 40, "FURY!", "#ff4d4d", 26);
      } else {
        this.setBanner(this.scn.boss ? "ROYAL EDICT" : "THE CHAMPION CALLS FOR AID", "A fresh guard squad answers the call!", "#ff6a5a");
        this.float(r.cx, r.cy - 40, "ROYAL EDICT!", "#ff6a5a", 24);
      }
      const sq = this.spawnSquad("loyal", 5 + this.scn.index * 1.5, room, "Royal Bodyguard");
      sq.flash = 1;
      sfx("gong"); this.shake(12); this.flash("#b3263e", 0.3);
      this.addLog("The Royal Champion rallies the guard!", "coup");
    }
  }

  private captureRoom(c: Coup, id: RoomId) {
    c.owner[id] = "rebel";
    this.stats.rooms++;
    const r = RECT[id];
    this.float(r.cx, r.cy - 20, `${ROOM_MAP[id].name} SEIZED`, "#ffe08a", 18);
    this.ring(r.cx, r.cy, "#e3b95a", 80);
    this.burst(r.cx, r.cy, "#e3b95a", 30, 140);
    this.shake(5);
    sfx("capture");
    this.addLog(`${ROOM_MAP[id].name} has fallen to the rebels.`, "coup");
    if (id === "dungeon") {
      c.prisoners.forEach((pid) => {
        const n = this.npc(pid);
        if (n && n.status === "arrested") {
          n.status = "conspirator"; n.affinity = 90; n.room = "dungeon";
          const sq = this.spawnSquad("rebel", 3 + this.perk("cadre"), "dungeon", `${n.name.split(" ")[0]}'s freed men`);
          sq.leader = n.id;
          this.addLog(`${n.name} is freed from the dungeon and joins the fight!`, "good");
        }
      });
    }
    if (id === "barracks") this.addLog("Barracks taken: loyalist reinforcements are cut off!", "coup");
    if (id === "treasury") this.addLog("Treasury taken: mercenaries will march for your cause.", "coup");
  }

  /* ---------------- end ---------------- */
  finish(won: boolean, title: string, reason: string) {
    if (this.phase === "won" || this.phase === "lost") return;
    this.phase = won ? "won" : "lost";
    this.paused = false;
    this.modal = null;
    this.endDelay = 0;
    const daysSurvived = Math.min(this.totalDays, this.day() - (won ? 0 : 1));
    const daysLeft = Math.max(0, this.totalDays - this.day());
    const modMult = this.mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus ?? 0), 1);
    const mult = Math.round(Math.min(this.minMult, this.diff.mult) * modMult * 100) / 100;
    const coupTime = this.coup ? this.coup.t : 0;
    const breakdown: [string, number][] = [
      ["Days survived", daysSurvived * 40],
      ["Conspirators recruited", this.stats.recruited * 60],
      ["Rooms seized", this.stats.rooms * 80],
      ["Enemies removed", (this.stats.kills + this.stats.arrests - this.stats.lostAgents) * 20],
    ];
    if (won) {
      breakdown.push(["Throne seized", 1500]);
      breakdown.push(["Days to spare", daysLeft * 120]);
      if (this.coup) breakdown.push(["Swift victory", Math.round(Math.max(0, this.coup.limit - coupTime) * 4)]);
    }
    const base = Math.max(0, breakdown.reduce((a, [, v]) => a + v, 0));
    const score = Math.round(base * mult);
    const seals = Math.max(1, Math.floor(score / 140) + (won ? 4 + this.scn.index * 2 : 0));
    this.summary = {
      won, title, reason, score, seals, mult, daysSurvived, recruited: this.stats.recruited, roomsCaptured: this.stats.rooms, arrests: this.stats.arrests,
      kills: this.stats.kills, lostAgents: this.stats.lostAgents, rumors: this.stats.rumors, goldSpent: Math.round(this.stats.goldSpent),
      investigations: this.stats.investigations, peakEvidence: Math.round(this.stats.peakEvidence), coupTime: Math.round(coupTime), breakdown,
    };
    this.setBanner(title, reason, won ? "#e3b95a" : "#b3263e");
    this.shake(won ? 6 : 14);
    this.flash(won ? "#ffe08a" : "#b3263e", 0.6);
    sfx(won ? "win" : "lose");
    setMusicMode("play");
    setIntensity(won ? 0.2 : 0.8);
  }
}

/* ---------------- event table ---------------- */
const EVENTS: Record<EventId, EventDef> = {
  feast: { title: "Royal Feast", icon: "🍷", text: "The court gathers in the Ballroom. Gossip flows with the wine.", run: (g) => g.startFeast(8) },
  inspection: { title: "Royal Inspection", icon: "🔍", text: "Inspectors scour the palace. Evidence gains rise for half a day.", run: (g) => { g.alertUntil = g.t + g.dayLen * 0.5; } },
  riot: { title: "Bread Riot", icon: "🔥", text: "Hungry crowds storm the gates. Unrest swells.", run: (g) => { g.unrest = Math.min(100, g.unrest + 16); g.shake(5); } },
  plague: { title: "Plague Scare", icon: "☣️", text: "Rumors of sickness spread. Unrest rises and the treasury pays for tonics.", run: (g) => { g.unrest = Math.min(100, g.unrest + 10); g.gold = Math.max(0, g.gold - 20); } },
  audit: { title: "Treasury Audit", icon: "📒", text: "Auditors count the coins...", run: (g) => { if (g.t - g.lastSkim < g.dayLen * 2) g.addEvidence(15, "The audit found missing coin"); else { g.gold += 30; g.addLog("The audit finds nothing amiss and the Crown rewards diligence (+30 gold).", "good"); } } },
  attempt: { title: "Attempt on the Crown", icon: "🗡️", text: "A rival's assassin struck at the Monarch and failed! Paranoia flares; the guard doubles.", run: (g) => { g.paranoia = Math.min(100, g.paranoia + 22); g.guardBonus += 2; g.addEvidence(4); g.shake(8); } },
  crackdown: { title: "Rival Duke Exposed", icon: "⛓️", text: "The Spymaster celebrates a catch and redoubles his efforts for a day.", run: (g) => { g.crackdownUntil = g.t + g.dayLen * 0.7; g.paranoia = Math.min(100, g.paranoia + 12); } },
  envoy: {
    title: "A Foreign Envoy", icon: "🌍", text: "An envoy from a rival crown offers gold in exchange for favors. Foreign coin may taint your cause.",
    choices: [
      { label: "Accept the gold", hint: "+90 gold, +6 evidence, -4 legitimacy", run: (g) => { g.gold += 90; g.addEvidence(6); g.legit = Math.max(0, g.legit - 4); return "You took the foreign coin (+90 gold)."; } },
      { label: "Refuse politely", hint: "+12 influence, +3 legitimacy", run: (g) => { g.infl = Math.min(100, g.infl + 12); g.legit = Math.min(100, g.legit + 3); return "You refused the envoy and earned quiet respect."; } },
    ],
  },
  informant: {
    title: "A Footman's Offer", icon: "🕯️", text: "A nervous footman offers to sell court secrets.",
    choices: [
      { label: "Pay 30 gold", hint: "Reveal two courtiers' stats & secrets", run: (g) => { if (g.gold < 30) return "You couldn't afford the footman's price."; g.gold -= 30; g.stats.goldSpent += 30; const c = g.npcs.filter((n) => n.role !== "monarch" && n.status === "free" && (!n.known || !n.secretKnown)); for (let i = 0; i < 2 && c.length; i++) { const t = c.splice(Math.floor(Math.random() * c.length), 1)[0]; t.known = true; t.secretKnown = true; g.addLog(`Footman's tip: ${t.name} — ${SECRETS[t.secret].name}.`, "good"); } return "The footman's whispers were worth every coin."; } },
      { label: "Threaten him", hint: "Reveal one secret free, +5 evidence", run: (g) => { const c = g.npcs.filter((n) => n.role !== "monarch" && n.status === "free" && !n.secretKnown); if (c.length) { const t = pick(c); t.known = true; t.secretKnown = true; g.addLog(`Footman confesses: ${t.name} — ${SECRETS[t.secret].name}.`, "good"); } g.addEvidence(5); return "The footman squealed — and may squeal again."; } },
      { label: "Send him away", hint: "Nothing happens", run: () => "You sent the footman away." },
    ],
  },
  tea: {
    title: "Tea with the Spymaster", icon: "🫖", text: "The Master of Whispers invites you for tea. A friendly chat, or an interrogation?",
    choices: [
      { label: "Attend and charm him", hint: "50%: -14 evidence. Otherwise +14", run: (g) => { if (Math.random() < 0.5 + g.perk("silver") * 0.05) { g.evidence = Math.max(0, g.evidence - 14); return "Your charm disarmed the Spymaster (-14 evidence)."; } g.addEvidence(14); return "The Spymaster saw through your act (+14 evidence)."; } },
      { label: "Decline with an excuse", hint: "Nothing happens", run: () => "You begged off with a headache." },
    ],
  },
  letter: {
    title: "An Intercepted Letter", icon: "✉️", text: "One of your agents intercepted a sealed letter from the Spymaster's office.",
    choices: [
      { label: "Read and learn", hint: "Investigate the Spymaster; -10 evidence", run: (g) => { const s = g.byRole("spymaster"); if (s) { s.known = true; s.secretKnown = true; } g.evidence = Math.max(0, g.evidence - 10); return "The letter revealed the Spymaster's weakness (-10 evidence)."; } },
      { label: "Reuse the seal for forgery", hint: "+1 Forgery", run: (g) => { g.forgeries = Math.min(3, g.forgeries + 1); return "You kept the seal for a rainy day (+1 Forgery)."; } },
    ],
  },
};

export function describeLoyalty(n: Npc, exact: boolean) {
  const v = exact ? n.crown : clamp(n.crown + n.noise, 0, 100);
  const label = v > 80 ? "Devoted" : v > 60 ? "Loyal" : v > 40 ? "Wavering" : v > 20 ? "Resentful" : "Disloyal";
  return { v, label };
}
export { TRAITS };
