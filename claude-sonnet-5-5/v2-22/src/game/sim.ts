import { COMPS, DIFFS, type CompId, type DiffDef, type DiffId, type EventDef, type ModId, type ShiftDef, type TripId } from "./data";

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const WEAR = 1.4;
export const SEC_PER_HOUR = 30;
// reactivity model constants
const RW = 0.25; // total rod worth
const RC = 0.65; // rod insertion at which rods contribute zero reactivity
const XE_W = 0.08; // xenon worth per unit
const A_TC = 0.0002; // coolant temperature coefficient (per °C)
const B_TF = 0.0001; // Doppler coefficient (per °C)

export interface Rod { pos: number; tgt: number; stuck: boolean }
export interface Pump { cmd: number; speed: number }
export interface Comp { health: number; tagged: boolean; failed: boolean; crew: number; progress: number; need: number; rate: number }
export interface Leak { id: number; kind: "pipe" | "tube"; rate: number; isolating: number; isolated: boolean }
export interface Alarm { id: string; text: string; level: 1 | 2; active: boolean; acked: boolean; count: number }
export interface LogEntry { t: number; text: string; level: 0 | 1 | 2 | 3 }
export interface SimEvent { kind: string; msg?: string; anchor?: string; color?: string; mag?: number }
export interface HistPt { t: number; dem: number; mwe: number; P: number; Tc: number; Pp: number; Xe: number }
export type DieselState = "off" | "starting" | "running" | "failed";

export interface SimConfig {
  shift: ShiftDef;
  getDiff: () => DiffId;
  mods: ModId[];
  upgrades: Record<string, number>;
  seed?: number;
}

export type Outcome = "complete" | "meltdown" | "breach" | "rupture" | "license" | "abort" | "tutorial";

export interface ShiftResult {
  outcome: Outcome;
  shiftId: number;
  time: number;
  hours: number;
  gridPct: number;
  quota: number;
  quotaMet: boolean;
  revenue: number;
  mwh: number;
  scrams: number;
  minCompliance: number;
  peakP: number;
  peakTf: number;
  peakPc: number;
  release: number;
  repairs: number;
  alarms: number;
  fuel: number;
  stars: number;
  credits: number;
  score: number;
  diff: DiffId;
  success: boolean;
}


const mulberry = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function interp(pts: [number, number][], x: number) {
  if (!pts.length) return 0;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const k = (x - x0) / Math.max(1e-6, x1 - x0);
      const e = k * k * (3 - 2 * k);
      return y0 + (y1 - y0) * e;
    }
  }
  return pts[pts.length - 1][1];
}

const xeEq = (P: number) => (0.03 * P) / (0.012 + 0.018 * P);

export class Sim {
  shift: ShiftDef;
  cfg: SimConfig;
  up: Record<string, number>;
  rng: () => number;
  warm = true;
  t = 0;
  over = false;
  outcome: Outcome = "complete";

  // reactor
  P = 0.5; D = 0.03; Xe = 0.8; I = 0.5; boron = 0; rho = 0;
  rods: Rod[] = [0, 1, 2, 3].map(() => ({ pos: 0.5, tgt: 0.5, stuck: false }));
  rodAuto = false;
  scrammed = false;
  tripReason = "";
  fuel = 1;
  Tf = 600; Tc = 290; Pp = 155; inv = 1; voidF = 0; dTc = 0; flow = 1;

  // secondary
  Ps = 60; sgL = 0.6;
  valve = 0.5; valveCmd = 0.5; govAuto = true;
  bypassAuto = true; bypassCmd = 0; bypass = 0;
  turbTripped = false; turbCooldown = 0; MWe = 0; coolEff = 0.7; towerCmd = 0.85; usedT = 0; usedB = 0;
  relief = 0; condPen = 0;

  pumps: { A: Pump; B: Pump } = { A: { cmd: 0.7, speed: 0.7 }, B: { cmd: 0.7, speed: 0.7 } };
  pressAuto = true; heat = 0.4; spray = 0; reliefOpen = false;

  afw = false; eccs = false; rhr = false; cspray = false; vent = false; tank = 1;
  offsite = true; diesel: DieselState = "off"; dieselT = 0; dieselFuel = 1; dieselJam = 0; restoreAt = -1;

  Pc = 0.05; releaseRate = 0; release = 0;
  leaks: Leak[] = []; leakId = 1; tubeIsolated = false;

  comps: Record<CompId, Comp>;
  crews: { target: CompId | null }[] = [];

  alarms: Alarm[] = [];
  alarmHorn = 0;
  log: LogEntry[] = [];
  events: SimEvent[] = [];

  demand = 0; freq = 50; surgeAmt = 0; surgeUntil = -1; ambient = 0.3; heatUntil = -1; baseAmbient = 0.3;
  islanded = false;
  compliance = 100;
  shake = 0;

  // stats
  gridOkT = 0; gridEligT = 0; revenue = 0; mwh = 0; scrams = 0; minCompliance = 100; peakP = 0; peakTf = 0; peakPc = 0;
  repairs = 0; alarmCount = 0;
  history: HistPt[] = [];
  private histAcc = 0;
  private evIdx = 0;
  private warned = new Set<number>();
  private events2: EventDef[];
  private rodTravel = 0;
  private prevValve = 0.5;
  private nextRand = 45;
  private autoDieselArmed = true;
  private autoWasOn = false;
  private trim = 0;
  rodWorthCache = 0;

  // display values (instrument lag/noise)
  disp = { P: 0, Tf: 0, Tc: 0, Pp: 0, Ps: 0, MWe: 0, sgL: 0, inv: 0, Pc: 0, Xe: 0 };
  speed = 1;
  tutorialFlags: Record<string, boolean> = {};
  tutorialCoolant = 0;

  constructor(cfg: SimConfig) {
    this.cfg = cfg;
    this.shift = cfg.shift;
    this.up = cfg.upgrades;
    this.rng = mulberry(cfg.seed ?? (Math.random() * 1e9) | 0);
    this.events2 = [...cfg.shift.events].sort((a, b) => a.t - b.t);
    this.comps = {} as Record<CompId, Comp>;
    for (const c of COMPS) {
      this.comps[c.id] = { health: cfg.shift.health[c.id] ?? 88, tagged: false, failed: false, crew: -1, progress: 0, need: 0, rate: 0 };
    }
    const nCrew = clamp(1 + (this.up.crew || 0) - (cfg.mods.includes("skeleton") ? 1 : 0), 1, 4);
    this.crews = Array.from({ length: nCrew }, () => ({ target: null }));
    this.tank = 1;
    this.baseAmbient = this.ambient = cfg.shift.ambient;
    this.initState();
  }

  get diffDef(): DiffDef { return DIFFS[this.cfg.getDiff()]; }
  get tutorial() { return !!this.shift.tutorial; }
  get effT() { return 1 + 0.05 * (this.up.turb || 0); }
  get powerAvail() { return this.offsite || this.diesel === "running"; }
  get hour() { return this.shift.startHour + this.t / SEC_PER_HOUR; }

  private initState() {
    const sp = this.shift.startPower;
    this.P = sp; this.D = 0.065 * sp; this.I = sp; this.Xe = xeEq(sp);
    this.Tc = 245 + 58 * sp; this.Tf = this.Tc + 500 * sp; this.Pp = 155; this.Ps = 60;
    const need = XE_W * this.Xe + A_TC * (this.Tc - 300) + B_TF * (this.Tf - 600);
    const pos = clamp(RC - need / RW, 0.05, 0.98);
    this.rods.forEach((r) => { r.pos = pos; r.tgt = pos; });
    this.valveCmd = this.valve = this.prevValve = clamp(sp / 1.0, 0, 1);
    this.rodAuto = true; this.govAuto = true; this.demand = this.demandAt(0);
    this.warm = true;
    for (let i = 0; i < 2600; i++) this.stepCore(0.1);
    this.I = this.P; this.Xe = xeEq(this.P); this.D = 0.065 * this.P;
    this.warm = false;
    this.t = 0;
    this.rodAuto = !this.tutorial;
    this.rods.forEach((r) => { r.tgt = r.pos; });
    this.valveCmd = this.valve;
    this.history = [];
    Object.assign(this.disp, { P: this.P, Tf: this.Tf, Tc: this.Tc, Pp: this.Pp, Ps: this.Ps, MWe: this.MWe, sgL: this.sgL, inv: this.inv, Pc: this.Pc, Xe: this.Xe });
    this.addLog(`Shift ${this.shift.id > 0 && !this.shift.endless ? this.shift.id + " — " : ""}${this.shift.name}. You have the conn.`, 0);
  }

  // ---------- helpers ----------
  demandAt(t: number) {
    const s = this.shift;
    const f = s.endless ? ((t % 480) / 480) : t / s.duration;
    const base = interp(s.demand, clamp(f, 0, 1));
    let n = 0;
    if (this.cfg.mods.includes("volatile")) n = 45 * Math.sin(t * 0.9) + 30 * Math.sin(t * 0.37 + 1.3);
    return Math.max(0, base + n);
  }

  addLog(text: string, level: 0 | 1 | 2 | 3 = 0) {
    this.log.unshift({ t: this.t, text, level });
    if (this.log.length > 60) this.log.pop();
  }
  emit(kind: string, extra: Partial<SimEvent> = {}) { this.events.push({ kind, ...extra }); }
  float(msg: string, anchor: string, color = "#fff") { this.emit("float", { msg, anchor, color }); }
  addShake(v: number) { this.shake = Math.min(1.5, this.shake + v); }

  degrade(id: CompId) { const h = this.comps[id].health; return h >= 40 ? 1 : 0.55 + h / 89; }
  offline(id: CompId) { const c = this.comps[id]; return c.failed || c.tagged; }
  perf(id: CompId) { return this.offline(id) ? 0 : this.degrade(id); }

  private penalize(v: number) {
    if (this.tutorial || this.warm) return;
    const tr = 1 - 0.15 * (this.up.training || 0);
    this.compliance = Math.max(0, this.compliance - v * this.diffDef.penalty * tr);
    this.minCompliance = Math.min(this.minCompliance, this.compliance);
  }

  // ---------- player actions ----------
  setRod(i: number, v: number) {
    const r = this.rods[i]; if (!r || r.stuck || this.over) return;
    r.tgt = clamp(v, 0, 1);
  }
  setAllRods(v: number) { this.rods.forEach((_, i) => this.setRod(i, v)); }
  nudgeRods(d: number) {
    if (this.scrammed || this.over) return;
    this.rodAuto = false;
    const free = this.rods.filter((r) => !r.stuck);
    if (!free.length) return;
    free.forEach((r) => { r.tgt = clamp(r.tgt + d, 0, 1); });
  }
  setRodAuto(b: boolean) {
    if (this.scrammed && b) { this.addLog("Reset the trip before enabling autopilot.", 1); this.emit("deny"); return; }
    this.rodAuto = b;
    if (!b) this.rods.forEach((r) => { r.tgt = r.pos; });
    this.addLog(`Rod autopilot ${b ? "ENGAGED" : "released"}.`, 0);
  }
  scram(manual = true) {
    if (this.scrammed || this.over) return;
    this.doTrip(manual ? "Manual SCRAM" : "SCRAM", !manual);
  }
  private doTrip(reason: string, auto: boolean) {
    this.scrammed = true; this.tripReason = reason; this.rodAuto = false;
    this.rods.forEach((r) => { if (!r.stuck) r.tgt = 1; });
    this.scrams++;
    if (!this.warm) {
      this.penalize(auto ? 3 : 1);
      this.addLog(`REACTOR TRIP — ${reason}`, 3);
      this.emit("scram", { msg: reason });
      this.float("SCRAM", "reactor", "#ff5050");
      this.addShake(0.7);
    }
  }
  resetTrip() {
    if (!this.scrammed || this.over) return;
    this.scrammed = false; this.tripReason = "";
    this.rods.forEach((r) => { r.tgt = r.pos; });
    this.addLog("Trip reset. Rods are inserted — withdraw to restart.", 1);
    this.emit("click");
  }
  setPump(k: "A" | "B", v: number) { this.pumps[k].cmd = clamp(v, 0, 1); }
  setTower(v: number) { this.towerCmd = clamp(v, 0, 1); }
  setValve(v: number) { this.govAuto = false; this.valveCmd = clamp(v, 0, 1); }
  setGov(auto: boolean) { this.govAuto = auto; if (auto) this.valveCmd = this.valve; }
  setBypass(v: number) { this.bypassAuto = false; this.bypassCmd = clamp(v, 0, 1); }
  setBypassAuto(b: boolean) { this.bypassAuto = b; if (!b) this.bypassCmd = this.bypass; }
  setPressAuto(b: boolean) { this.pressAuto = b; }
  setHeat(v: number) { this.pressAuto = false; this.heat = clamp(v, 0, 1); }
  setSpray(v: number) { this.pressAuto = false; this.spray = clamp(v, 0, 1); }
  toggle(k: "afw" | "eccs" | "rhr" | "cspray" | "vent") {
    if (this.over) return;
    this[k] = !this[k];
    this.addLog(`${{ afw: "Aux feedwater", eccs: "ECCS injection", rhr: "Residual heat removal", cspray: "Containment spray", vent: "Containment vent" }[k]} ${this[k] ? "ON" : "OFF"}.`, k === "vent" && this[k] ? 2 : 0);
    this.emit("click");
  }
  resetTurbine() {
    if (!this.turbTripped) return;
    if (!this.offsite) { this.addLog("Cannot reset turbine: no offsite grid.", 1); this.emit("deny"); return; }
    if (this.offline("turbine")) { this.addLog("Turbine is tagged out / failed.", 1); this.emit("deny"); return; }
    if (this.turbCooldown > 0) { this.addLog(`Turbine cooling down (${Math.ceil(this.turbCooldown)} s).`, 1); this.emit("deny"); return; }
    this.turbTripped = false; this.valveCmd = 0; this.valve = 0;
    this.addLog("Turbine reset. Re-synchronised to the grid.", 0);
    this.emit("click");
  }
  toggleDiesel() {
    if (this.diesel === "running" || this.diesel === "starting") {
      this.diesel = "off";
      this.addLog("Diesel generator stopped.", 0);
      return;
    }
    this.startDiesel();
  }
  startDiesel() {
    if (this.diesel === "starting" || this.diesel === "running") return;
    if (this.offline("diesel")) { this.addLog("Diesel unavailable (tagged out / failed).", 2); this.emit("deny"); return; }
    if (this.dieselFuel <= 0.02) { this.addLog("Diesel fuel exhausted.", 2); this.emit("deny"); return; }
    this.diesel = "starting"; this.dieselT = 10 - 3 * (this.up.diesel || 0);
    this.addLog("Diesel generator starting...", 1);
    this.emit("click");
  }
  isolateLeak(id: number) {
    const l = this.leaks.find((x) => x.id === id);
    if (!l || l.isolated || l.isolating > 0) return;
    l.isolating = 0.001;
    this.addLog(`Closing isolation valves on ${l.kind === "pipe" ? "primary pipe" : "SG tube"} leak...`, 1);
    this.emit("click");
  }
  ackAll() {
    let any = false;
    this.alarms.forEach((a) => { if (a.active && !a.acked) { a.acked = true; any = true; } });
    if (any) this.emit("ack");
  }
  tutorialInject() {
    this.comps.pumpA.health = Math.min(this.comps.pumpA.health, 28);
    this.addLog("Coolant Pump A vibration high — degraded.", 2);
    this.emit("warn");
  }
  crewsFree() { return this.crews.filter((c) => !c.target).length; }
  assignCrew(id: CompId) {
    const c = this.comps[id];
    if (this.over || c.crew >= 0) return;
    const ci = this.crews.findIndex((x) => !x.target);
    if (ci < 0) { this.addLog("All crews are busy.", 1); this.emit("deny"); return; }
    if (id === "diesel" && this.diesel === "running") { this.addLog("Stop the diesel before tagging it out.", 1); this.emit("deny"); return; }
    this.crews[ci].target = id;
    c.crew = ci; c.tagged = true; c.progress = 0;
    c.need = (8 + (100 - c.health) * 0.3) / (1 + 0.3 * (this.up.crew || 0)) * (this.tutorial ? 0.4 : 1);
    this.addLog(`Crew ${ci + 1} dispatched to ${COMPS.find((x) => x.id === id)!.name}. Tagged out.`, 1);
    this.emit("click");
  }
  cancelCrew(id: CompId) {
    const c = this.comps[id];
    if (c.crew < 0) return;
    this.crews[c.crew].target = null;
    c.crew = -1; c.tagged = false; c.progress = 0;
    this.addLog(`Repair on ${COMPS.find((x) => x.id === id)!.name} cancelled.`, 0);
    this.emit("click");
  }

  // ---------- main step ----------
  step(dt: number) {
    if (this.over) return;
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt * 1.8);
    this.runEvents();
    this.stepCore(dt);
    this.updateRepairs(dt);
    this.updateAlarms(dt);
    this.protection();
    this.updateScore(dt);
    this.sample(dt);
    this.updateDisplay(dt);
    this.sanitize();
    this.checkEnd();
  }

  finish(outcome: Outcome) {
    if (this.over) return;
    this.over = true; this.outcome = outcome;
  }

  private stepCore(dt: number) {
    this.updateGrid(dt);
    this.updatePowerSources(dt);
    this.updateRods(dt);
    this.updateReactor(dt);
    this.updateThermal(dt);
    this.updateSecondary(dt);
    this.updateSafety(dt);
    if (!this.warm) this.updateWear(dt);
  }

  private updateGrid(dt: number) {
    if (this.heatUntil > this.t) this.ambient += (0.9 - this.ambient) * Math.min(1, dt * 0.3);
    else this.ambient += (this.baseAmbient - this.ambient) * Math.min(1, dt * 0.1);
    let d = this.demandAt(this.t);
    if (this.surgeUntil > this.t) d += this.surgeAmt;
    this.demand = d;
    this.islanded = !this.offsite;
    const target = this.offsite ? 50 + clamp(((this.MWe - d) / Math.max(d, 300)) * 2.5, -3, 3) : 50;
    this.freq += (target - this.freq) * Math.min(1, dt * 0.8);
  }

  private updatePowerSources(dt: number) {
    if (this.restoreAt > 0 && this.t >= this.restoreAt && !this.offsite) {
      this.offsite = true; this.restoreAt = -1;
      this.addLog("Offsite power RESTORED.", 1);
      this.emit("good", { msg: "Offsite power restored" });
      this.float("GRID BACK", "grid", "#7dff9b");
      if (this.diesel === "running" || this.diesel === "starting") { this.diesel = "off"; this.addLog("Diesel unloaded and stopped.", 0); }
    }
    if (!this.offsite && this.diesel === "off" && this.diffDef.autoDiesel && this.autoDieselArmed && !this.warm) {
      this.autoDieselArmed = false; this.startDiesel();
    }
    if (this.offsite) this.autoDieselArmed = true;
    if (this.diesel === "starting") {
      this.dieselT -= dt;
      if (this.dieselT <= 0) {
        const c = this.comps.diesel;
        const pfail = (1 - c.health / 100) * 0.5 * (1 - 0.3 * (this.up.diesel || 0));
        if (this.dieselJam > 0 || this.rng() < pfail) {
          if (this.dieselJam > 0) this.dieselJam--;
          this.diesel = "off";
          this.addLog("DIESEL FAILED TO START — retry!", 3);
          this.emit("fail", { msg: "Diesel failed to start" });
          this.float("DIESEL FAIL", "diesel", "#ff7050");
          this.autoDieselArmed = false;
        } else {
          this.diesel = "running";
          this.addLog("Diesel generator online. Essential loads restored.", 1);
          this.emit("good", { msg: "Diesel online" });
          this.float("DIESEL ONLINE", "diesel", "#7dff9b");
        }
      }
    }
    if (this.diesel === "running") {
      this.dieselFuel -= dt / (200 + 90 * (this.up.diesel || 0));
      if (this.dieselFuel <= 0) {
        this.dieselFuel = 0; this.diesel = "off";
        this.addLog("DIESEL OUT OF FUEL!", 3);
        this.emit("fail", { msg: "Diesel out of fuel" });
      }
    }
  }

  private updateRods(dt: number) {
    const powered = this.powerAvail;
    const rate = powered ? 0.02 * (1 + 0.35 * (this.up.rods || 0)) * this.perf("rods") : 0;
    if (!this.rodAuto) this.autoWasOn = false;
    if (this.rodAuto && !this.scrammed && rate > 0) {
      // feed-forward reactivity balance (knows xenon, boron, load program) + slow Tavg trim
      const runback = this.turbTripped || !this.offsite;
      const load = runback ? 0.08 : clamp(this.demand / (1000 * this.effT), 0, 1.05);
      const tref = 245 + 58 * load;
      const tfref = tref + 500 * load;
      const ff = RC - (XE_W * this.Xe + 0.08 * this.boron + A_TC * (tref - 300) + B_TF * (tfref - 600)) / RW;
      const free = this.rods.filter((r) => !r.stuck);
      const stuckSum = this.rods.reduce((s, r) => s + (r.stuck ? r.pos : 0), 0);
      if (!this.autoWasOn) {
        const avgTgt = this.rods.reduce((s, r) => s + r.tgt, 0) / 4;
        this.trim = clamp(avgTgt - ff, -0.4, 0.4);
        this.autoWasOn = true;
      }
      this.trim = clamp(this.trim + 0.00008 * (this.Tc - tref) * dt, -0.4, 0.4);
      let base = ff + this.trim;
      base += clamp((this.P - 1.04) * 4, 0, 0.3);
      if (free.length) {
        const tg = clamp((4 * base - stuckSum) / free.length, 0, 1);
        free.forEach((r) => { r.tgt = tg; });
      }
    }
    for (const r of this.rods) {
      if (r.stuck) { r.tgt = r.pos; continue; }
      const target = this.scrammed ? 1 : r.tgt;
      const sp = this.scrammed ? 0.45 : rate;
      const d = clamp(target - r.pos, -sp * dt, sp * dt);
      r.pos = clamp(r.pos + d, 0, 1);
      if (!this.scrammed) this.rodTravel += Math.abs(d);
    }
  }

  private updateReactor(dt: number) {
    const avg = this.rods.reduce((s, r) => s + r.pos, 0) / 4;
    const rhoR = RW * (RC - avg);
    const rhoX = -XE_W * this.Xe;
    const rhoT = -(A_TC * (this.Tc - 300) + B_TF * (this.Tf - 600));
    const rhoV = -0.02 * this.voidF;
    const rhoB = -0.08 * this.boron;
    this.rho = rhoR + rhoX + rhoT + rhoV + rhoB;
    this.P = this.P * Math.exp(clamp(8 * this.rho * dt, -2, 0.4)) + 0.001 * dt;
    this.P = clamp(this.P, 0, 1.8);
    this.I += (0.025 * this.P - 0.025 * this.I) * dt;
    this.Xe += (0.025 * this.I + 0.005 * this.P - 0.012 * this.Xe - 0.018 * this.P * this.Xe) * dt;
    this.D += ((0.065 * this.P - this.D) / 90) * dt;
    this.boron = Math.max(0, this.boron - 0.003 * dt);
    this.rodWorthCache = rhoR;
  }

  private updateThermal(dt: number) {
    const Q = 0.935 * this.P + this.D;
    const tilt = this.tilt();
    const peak = 1 + 0.5 * tilt;
    this.voidF = clamp((this.Tc - (150 + 1.3 * this.Pp)) / 25, 0, 1);
    const deficit = Math.max(0, (0.7 - this.inv) / 0.7);
    const uncover = 3 * deficit + 120 * Math.pow(Math.max(0, 0.45 - this.inv), 2);
    const target = this.Tc + Q * peak * 500 * (1 + 2.5 * this.voidF + uncover);
    this.Tf += (target - this.Tf) * (1 - Math.exp(-dt / 5));

    // pumps
    for (const k of ["A", "B"] as const) {
      const p = this.pumps[k];
      const id: CompId = k === "A" ? "pumpA" : "pumpB";
      const off = this.offline(id) || !this.powerAvail;
      let tgt = off ? 0 : p.cmd;
      if (!this.offsite && this.diesel === "running") tgt = Math.min(tgt, 0.6);
      const down = off ? 0.06 : 0.2;
      p.speed += clamp(tgt - p.speed, -down * dt, 0.12 * dt);
    }
    const pfA = this.degrade("pumpA"), pfB = this.degrade("pumpB");
    this.flow = (0.03 + 0.7 * (this.pumps.A.speed * pfA + this.pumps.B.speed * pfB)) * clamp(this.inv / 0.6, 0, 1);

    const sgEff = this.perf("sg") * clamp(this.sgL / 0.25, 0.1, 1) * (this.tubeIsolated ? 0.6 : 1);
    const Ts = 120 + 2 * this.Ps;
    const R = (this.flow * sgEff * Math.max(0, this.Tc - Ts)) / 65;
    this.Rsg = R;
    let extra = 0;
    const eccsOn = this.eccs && this.powerAvail && this.tank > 0;
    if (eccsOn) extra += 0.05 * (1 + 0.5 * (this.up.eccs || 0)) * clamp((this.Tc - 60) / 200, 0, 1);
    if (this.rhr && this.powerAvail) extra += 0.05 * clamp((this.Tc - 60) / 250, 0, 1);
    const Rboil = this.voidF * 0.08;
    const prevTc = this.Tc;
    this.Tc += (Q - R - extra - Rboil) * 15 * dt;
    this.Tc = clamp(this.Tc, 25, 700);
    this.dTc += ((this.Tc - prevTc) / dt - this.dTc) * Math.min(1, dt * 0.5);
    this.boilLoss = this.voidF * Q * 0.04;
  }
  Rsg = 0;
  boilLoss = 0;

  tilt() {
    let mx = 0, mn = 1;
    for (const r of this.rods) { mx = Math.max(mx, r.pos); mn = Math.min(mn, r.pos); }
    return mx - mn;
  }

  private updateSecondary(dt: number) {
    const R = this.Rsg;
    // ambient / condenser
    const powerFactor = this.offsite ? 1 : this.diesel === "running" ? 0.4 : 0;
    this.coolEff = this.towerCmd * this.perf("tower") * (1 - 0.4 * this.ambient) * powerFactor;
    const cool = this.coolEff;

    // bypass
    this.bypass = this.bypassAuto ? clamp((this.Ps - 64) * 0.1, 0, 1) : this.bypassCmd;
    this.usedB = this.bypass * (this.Ps / 60) * 0.6 * (0.35 + 0.65 * cool);

    // turbine
    if (this.offline("turbine") && !this.turbTripped) this.tripTurbine("Turbine unavailable");
    if (!this.offsite && !this.turbTripped) this.tripTurbine("Generator breaker open");
    if (this.turbTripped) {
      this.valveCmd = 0;
      this.valve = Math.max(0, this.valve - 0.5 * dt);
      this.turbCooldown = Math.max(0, this.turbCooldown - dt);
    } else {
      if (this.govAuto) {
        const err = (this.demand - this.MWe) / 1000;
        this.valveCmd = clamp(this.valveCmd + 0.4 * err * dt, 0, 1);
        this.valveCmd = clamp(this.valveCmd, this.valve - 0.05, this.valve + 0.05);
      }
      this.valve += clamp(this.valveCmd - this.valve, -0.15 * dt, 0.15 * dt);
    }
    this.usedT = this.turbTripped ? 0 : this.valve * (this.Ps / 60) * this.degrade("turbine");
    const condLoad = this.usedT + this.usedB;
    this.condPen = clamp((condLoad - cool * 1.4) * 1.2, 0, 0.5);
    this.MWe = this.offsite && !this.turbTripped ? 1000 * this.effT * this.usedT * (0.72 + 0.28 * cool) * (1 - this.condPen) : 0;

    // steam pressure
    this.relief = this.Ps > 78 ? (this.Ps - 78) * 0.05 : 0;
    this.Ps += (R - this.usedT - this.usedB - this.relief) * 12 * dt;
    this.Ps = clamp(this.Ps, 1, 130);

    // feedwater
    const feedOk = this.perf("feed") > 0 && this.powerAvail;
    if (this.diffDef.autoAFW && !this.afw && !feedOk && this.sgL < 0.5 && !this.warm) {
      this.afw = true; this.addLog("AFW auto-started (feedwater unavailable).", 1);
    }
    const steamLoss = R * 0.012 + this.relief * 0.02 + this.usedB * (1 - cool) * 0.02;
    let feed = 0;
    if (feedOk) feed += ((0.6 - this.sgL) * 0.08 + R * 0.012) * this.degrade("feed");
    if (this.afw && this.Ps > 3) feed += 0.012;
    this.sgL = clamp(this.sgL + (feed - steamLoss) * dt, 0, 1);
  }

  private tripTurbine(reason: string) {
    if (this.turbTripped) return;
    this.turbTripped = true; this.turbCooldown = 8;
    if (!this.warm) {
      this.addLog(`TURBINE TRIP — ${reason}`, 2);
      this.emit("fail", { msg: "Turbine trip" });
      this.float("TURBINE TRIP", "turbine", "#ff9a50");
      this.addShake(0.4);
    }
  }

  private updateSafety(dt: number) {
    // pressurizer
    const pow = this.powerAvail;
    if (this.pressAuto) {
      const err = 155 - this.Pp;
      this.heat = clamp(0.4 + err * 0.08, 0, 1);
      this.spray = clamp(-err * 0.08 - 0.1, 0, 1);
    }
    const heat = pow ? this.heat : 0;
    const spray = pow ? this.spray : 0;
    let Pt = 145 + 25 * heat - 30 * spray + 0.3 * (this.Tc - 305) - 160 * Math.max(0, 0.92 - this.inv) + 40 * this.voidF;
    Pt = Math.max(1, Pt);
    this.Pp += (Pt - this.Pp) * 0.2 * dt;
    this.reliefOpen = false;
    let reliefDisch = 0;
    if (this.Pp > 168) {
      this.Pp -= (this.Pp - 168) * 0.3 * dt;
      this.reliefOpen = true;
      reliefDisch = 0.03;
      this.inv -= 0.0015 * dt;
    }
    this.Pp = clamp(this.Pp, 1, 260);

    // leaks
    let pipeRate = 0, tubeRate = 0;
    for (const l of this.leaks) {
      if (l.isolating > 0 && !l.isolated) {
        l.isolating += dt;
        if (l.isolating >= 6) {
          l.isolated = true;
          this.addLog(`${l.kind === "pipe" ? "Pipe" : "SG tube"} leak ISOLATED.`, 1);
          this.emit("good", { msg: "Leak isolated" });
          this.float("LEAK ISOLATED", "reactor", "#7dff9b");
          if (l.kind === "tube") this.tubeIsolated = true;
        }
      }
      if (!l.isolated) { if (l.kind === "pipe") pipeRate += l.rate; else tubeRate += l.rate; }
    }
    const leakLoss = (pipeRate + tubeRate) * (0.4 + 0.6 * (this.Pp / 155));
    // ECCS
    const eccsOn = this.eccs && this.powerAvail && this.tank > 0;
    let inj = 0;
    if (eccsOn) {
      inj = 0.012 * (1 + 0.8 * (this.up.eccs || 0));
      if (this.inv >= 0.98) inj = 0;
      else this.tank = Math.max(0, this.tank - (0.004 / (1 + 0.5 * (this.up.eccs || 0))) * dt);
      this.boron = Math.min(1.5, this.boron + 0.006 * dt);
    }
    this.inv = clamp(this.inv + (inj - leakLoss - this.boilLoss) * dt, 0, 1);
    if (this.diffDef.autoSI && !this.eccs && pow && !this.warm && (this.Pp < 110 || this.Pc > 1.6 || this.inv < 0.7)) {
      this.eccs = true; this.addLog("SAFETY INJECTION actuated automatically.", 2); this.emit("fail", { msg: "Safety injection" });
    }
    if (this.diffDef.autoSI && this.eccs && this.inv >= 0.98 && this.Pp > 140) {
      this.eccs = false; this.addLog("ECCS secured (inventory recovered).", 0);
    }

    // containment
    const flash = (pipeRate * 8 * (this.Tc / 300)) + reliefDisch + this.relief * 0.002;
    const sprayOn = this.cspray && pow;
    const coolRate = 0.02 + (sprayOn ? 0.08 : 0);
    this.Pc += (flash - this.Pc * coolRate) * dt;
    let ventRate = 0;
    if (this.vent && this.Pc > 0.15) { this.Pc -= 0.15 * dt; ventRate = this.Pc * 0.6 * ((this.up.vent || 0) > 0 ? 0.1 : 1); }
    this.Pc = clamp(this.Pc, 0, 9);
    const dmg = 1 - this.fuel;
    const atm = this.usedB * (1 - this.coolEff * 0.7) + this.relief * 0.5 + 0.1;
    this.releaseRate = tubeRate * 100 * (1 + 10 * dmg) * atm + ventRate * (1 + 10 * dmg) + Math.max(0, this.Pc - 3) * 3 * (1 + 10 * dmg);
    if (!this.warm) {
      this.release += this.releaseRate * dt;
      this.penalize(this.releaseRate * 0.5 * dt);
      if (this.fuel <= 0.02 && this.Pc > 0.1) this.release += 2 * dt;
    }

    // fuel damage
    if (!this.tutorial && !this.warm && this.Tf > 1150) {
      const before = this.fuel;
      this.fuel = Math.max(0, this.fuel - ((this.Tf - 1150) / 400) * 0.03 * dt);
      if (Math.floor(before * 20) !== Math.floor(this.fuel * 20)) { this.float("FUEL DAMAGE", "reactor", "#ff3030"); this.emit("hit"); this.addShake(0.3); }
    }
    if (!this.warm) {
      this.peakP = Math.max(this.peakP, this.P);
      this.peakTf = Math.max(this.peakTf, this.Tf);
      this.peakPc = Math.max(this.peakPc, this.Pc);
    }
  }

  private updateWear(dt: number) {
    if (this.tutorial) return;
    const wm = this.diffDef.wear * (this.cfg.mods.includes("aging") ? 1.5 : 1) * WEAR;
    const hot = this.Tc > 320 ? 1.5 : 1;
    const pu = 1 - 0.25 * (this.up.pumps || 0);
    this.wear("pumpA", 0.22 * this.pumps.A.speed ** 2 * hot * pu, wm, dt);
    this.wear("pumpB", 0.22 * this.pumps.B.speed ** 2 * hot * pu, wm, dt);
    const dv = Math.abs(this.valve - this.prevValve);
    this.prevValve = this.valve;
    this.wear("turbine", 0.12 * this.valve ** 2 + (6 * dv) / dt, wm, dt);
    this.wear("sg", 0.04 + Math.abs(this.dTc) * 0.12 + Math.max(0, this.Ps - 80) * 0.05 + (this.leaks.some((l) => l.kind === "tube" && !l.isolated) ? 0.1 : 0), wm, dt);
    this.wear("feed", this.perf("feed") > 0 ? 0.1 * this.Rsg : 0, wm, dt);
    const rw = (this.rodTravel * 12 * (1 - 0.2 * (this.up.rods || 0))) / dt;
    this.rodTravel = 0;
    this.wear("rods", rw, wm, dt);
    this.wear("tower", 0.12 * this.towerCmd ** 2 * (1 + this.ambient), wm, dt);
    this.wear("diesel", this.diesel === "running" ? 0.2 : 0, wm, dt);
    // random failures
    for (const c of COMPS) {
      const comp = this.comps[c.id];
      if (comp.failed || comp.tagged) continue;
      if (comp.health <= 0) { this.failComp(c.id); continue; }
      if (comp.health < 20) {
        const hz = ((20 - comp.health) / 20) * 0.008 * this.diffDef.events;
        if (this.rng() < hz * dt) this.failComp(c.id);
      }
    }
  }

  private wear(id: CompId, rate: number, wm: number, dt: number) {
    const c = this.comps[id];
    if (c.failed || c.tagged) { c.rate *= 0.98; return; }
    const prev = c.health;
    c.health = Math.max(0, c.health - rate * wm * dt);
    c.rate = c.rate * 0.98 + (rate * wm) * 0.02;
    if (prev >= 40 && c.health < 40) {
      this.addLog(`${COMPS.find((x) => x.id === id)!.name} DEGRADED (${Math.round(c.health)}%).`, 2);
      this.emit("warn");
      this.float("DEGRADED", id === "turbine" ? "turbine" : id === "tower" ? "tower" : "reactor", "#ffd060");
    }
  }

  failComp(id: CompId) {
    const c = this.comps[id];
    if (c.failed) return;
    c.failed = true; c.health = 0;
    const nm = COMPS.find((x) => x.id === id)!.name;
    this.addLog(`${nm.toUpperCase()} FAILED!`, 3);
    this.emit("fail", { msg: `${nm} failed` });
    this.float(`${nm} FAILED`, id === "turbine" ? "turbine" : id === "tower" ? "tower" : "reactor", "#ff5050");
    this.addShake(0.5);
    if (id === "sg") this.addLeak("tube", 0.004);
    if (id === "diesel" && (this.diesel === "running" || this.diesel === "starting")) this.diesel = "failed";
    if (id === "diesel" && this.diesel === "off") this.diesel = "failed";
  }

  private updateRepairs(dt: number) {
    for (const cd of COMPS) {
      const c = this.comps[cd.id];
      if (c.crew < 0) continue;
      c.progress += dt;
      if (c.progress >= c.need) {
        const cost = 4 + (100 - c.health) * 0.15;
        this.crews[c.crew].target = null;
        c.crew = -1; c.tagged = false; c.failed = false; c.health = 100; c.progress = 0; c.rate = 0;
        if (cd.id === "diesel" && this.diesel === "failed") this.diesel = "off";
        this.repairs++;
        if (!this.tutorial) this.revenue -= cost;
        this.addLog(`${cd.name} repaired (−$${cost.toFixed(0)}k).`, 1);
        this.emit("repair", { msg: cd.name });
        this.float("REPAIRED", cd.id === "turbine" ? "turbine" : cd.id === "tower" ? "tower" : "reactor", "#7dff9b");
        if (this.tutorial) this.tutorialFlags.repaired = true;
      }
    }
  }

  // ---------- events ----------
  private runEvents() {
    while (this.evIdx < this.events2.length && this.events2[this.evIdx].t <= this.t) {
      this.applyEvent(this.events2[this.evIdx]);
      this.evIdx++;
    }
    for (let i = this.evIdx; i < this.events2.length; i++) {
      const e = this.events2[i];
      if (e.t - 12 > this.t) break;
      if (e.warn && !this.warned.has(i)) {
        this.warned.add(i);
        this.addLog(`⚠ ADVISORY: ${e.warn}`, 1);
        this.emit("advisory", { msg: e.warn });
      }
    }
    if (this.shift.endless && this.t >= this.nextRand) {
      const mult = this.diffDef.events;
      this.nextRand = this.t + Math.max(14, 42 - this.t / 18) / mult;
      this.applyEvent(this.randomEvent());
    }
  }

  private randomEvent(): EventDef {
    const r = this.rng;
    const pool: [number, () => EventDef][] = [
      [3, () => ({ t: 0, type: "damage", comp: COMPS[Math.floor(r() * COMPS.length)].id, to: 12 + r() * 20 })],
      [1, () => ({ t: 0, type: "pumpSeize", comp: r() < 0.5 ? "pumpA" : "pumpB" })],
      [1, () => ({ t: 0, type: "leakPipe", rate: 0.003 + r() * 0.002 })],
      [1, () => ({ t: 0, type: "leakTube", rate: 0.003 + r() * 0.002 })],
      [0.7, () => ({ t: 0, type: "rodStick", idx: Math.floor(r() * 4) })],
      [1.2, () => ({ t: 0, type: "turbineTrip" })],
      [0.5, () => ({ t: 0, type: "loop", dur: 60 + r() * 40 })],
      [0.3, () => ({ t: 0, type: "quake", mag: 0.6 })],
      [1.5, () => ({ t: 0, type: "surge", amt: 80 + r() * 100, dur: 20 })],
      [0.5, () => ({ t: 0, type: "heatwave", dur: 80 })],
      [0.2, () => ({ t: 0, type: "flood" })],
    ];
    const total = pool.reduce((s, p) => s + p[0], 0);
    let x = r() * total;
    for (const [w, f] of pool) { x -= w; if (x <= 0) return f(); }
    return pool[0][1]();
  }

  private addLeak(kind: "pipe" | "tube", rate: number) {
    this.leaks.push({ id: this.leakId++, kind, rate, isolating: 0, isolated: false });
    if (kind === "tube") this.tubeIsolated = false;
    this.addLog(`${kind === "pipe" ? "PRIMARY PIPE LEAK" : "STEAM GENERATOR TUBE LEAK"} detected!`, 3);
    this.emit("fail", { msg: "Leak" });
    this.float("LEAK!", "reactor", "#ff5050");
    this.addShake(0.4);
  }

  private applyEvent(e: EventDef) {
    switch (e.type) {
      case "damage": {
        if (e.comp) {
          const c = this.comps[e.comp];
          c.health = Math.min(c.health, e.to ?? 20);
          if (c.health <= 0) this.failComp(e.comp);
          else { this.addLog(`${COMPS.find((x) => x.id === e.comp)!.name} suffering damage (${Math.round(c.health)}%).`, 2); this.emit("warn"); }
        }
        break;
      }
      case "pumpSeize": if (e.comp) { this.failComp(e.comp); } break;
      case "leakPipe": this.addLeak("pipe", e.rate ?? 0.004); break;
      case "leakTube": this.addLeak("tube", e.rate ?? 0.004); break;
      case "rodStick": {
        const r = this.rods[e.idx ?? 0];
        if (r && !r.stuck) {
          r.stuck = true; r.tgt = r.pos;
          this.addLog(`ROD BANK ${(e.idx ?? 0) + 1} STUCK at ${(r.pos * 100).toFixed(0)}%.`, 3);
          this.emit("fail", { msg: "Rod stuck" }); this.float("ROD STUCK", "reactor", "#ff9a50"); this.addShake(0.3);
        }
        break;
      }
      case "turbineTrip": this.tripTurbine("Grid protection relay"); break;
      case "loop": {
        this.offsite = false;
        this.restoreAt = this.t + (e.dur ?? 70);
        this.addLog("LOSS OF OFFSITE POWER! Switchyard dead.", 3);
        this.emit("loop", { msg: "Loss of offsite power" });
        this.float("BLACKOUT", "grid", "#ff5050");
        this.addShake(0.6);
        break;
      }
      case "quake": {
        const mag = e.mag ?? 1;
        this.addShake(1.4 * mag);
        this.emit("quake", { mag });
        this.addLog("EARTHQUAKE! Structural damage reported.", 3);
        this.float("EARTHQUAKE", "reactor", "#ffb050");
        const ids = COMPS.map((c) => c.id).filter((id) => id !== "diesel");
        const n = mag >= 1 ? 3 : 2;
        for (let i = 0; i < n; i++) {
          const id = ids.splice(Math.floor(this.rng() * ids.length), 1)[0];
          if (id) this.comps[id].health = Math.min(this.comps[id].health, 22 + this.rng() * 18);
        }
        if (mag >= 1) {
          const r = this.rods[Math.floor(this.rng() * 4)];
          if (!r.stuck) { r.stuck = true; r.tgt = r.pos; this.addLog("A rod bank jammed in the quake.", 3); }
        }
        if (!this.scrammed && mag >= 1) this.doTrip("Seismic trip", true);
        break;
      }
      case "heatwave": {
        this.heatUntil = this.t + (e.dur ?? 100);
        this.addLog("HEAT WAVE: condenser capacity falling.", 2);
        this.emit("warn");
        break;
      }
      case "surge": {
        this.surgeAmt = e.amt ?? 100; this.surgeUntil = this.t + (e.dur ?? 20);
        this.addLog(`Grid demand surge +${Math.round(this.surgeAmt)} MW.`, 1);
        this.emit("warn");
        break;
      }
      case "dieselJam": this.dieselJam = e.count ?? 1; break;
      case "flood": {
        this.addLog("TSUNAMI! Seawater floods the diesel building.", 3);
        this.emit("quake", { mag: 0.8 });
        this.float("FLOOD", "diesel", "#60b0ff");
        this.comps.tower.health = Math.min(this.comps.tower.health, 20);
        this.comps.diesel.health = Math.min(this.comps.diesel.health, 8);
        this.failComp("diesel");
        break;
      }
      case "banner": this.addLog(`━━ ${e.text} ━━`, 3); this.emit("banner", { msg: e.text }); break;
      default: break;
    }
  }

  // ---------- alarms ----------
  private alarmDefs: { id: string; text: string; level: 1 | 2; test: (s: Sim) => boolean }[] = [
    { id: "flux1", text: "FLUX HIGH", level: 1, test: (s) => s.P > 1.05 },
    { id: "flux2", text: "FLUX CRITICAL", level: 2, test: (s) => s.P > 1.12 },
    { id: "tf1", text: "FUEL TEMP HIGH", level: 1, test: (s) => s.Tf > 1000 },
    { id: "tf2", text: "FUEL DAMAGE", level: 2, test: (s) => s.Tf > 1150 },
    { id: "tc", text: "COOLANT HOT", level: 1, test: (s) => s.Tc > 330 },
    { id: "pph", text: "RCS PRESS HIGH", level: 1, test: (s) => s.Pp > 165 },
    { id: "ppl", text: "RCS PRESS LOW", level: 1, test: (s) => s.Pp < 135 && s.P > 0.05 },
    { id: "void", text: "CORE VOIDING", level: 2, test: (s) => s.voidF > 0.05 },
    { id: "inv1", text: "INVENTORY LOW", level: 1, test: (s) => s.inv < 0.85 },
    { id: "inv2", text: "CORE UNCOVERY", level: 2, test: (s) => s.inv < 0.55 },
    { id: "sg1", text: "SG LEVEL LOW", level: 1, test: (s) => s.sgL < 0.35 },
    { id: "sg2", text: "SG DRY-OUT", level: 2, test: (s) => s.sgL < 0.18 },
    { id: "ps", text: "STEAM PRESS HIGH", level: 1, test: (s) => s.Ps > 76 },
    { id: "pc1", text: "CONTAINMENT PRESS", level: 1, test: (s) => s.Pc > 1.5 },
    { id: "pc2", text: "CONTAINMENT CRIT", level: 2, test: (s) => s.Pc > 2.8 },
    { id: "loop", text: "LOSS OF OFFSITE", level: 2, test: (s) => !s.offsite },
    { id: "tt", text: "TURBINE TRIP", level: 1, test: (s) => s.turbTripped },
    { id: "trip", text: "REACTOR TRIP", level: 2, test: (s) => s.scrammed },
    { id: "rod", text: "ROD STUCK", level: 1, test: (s) => s.rods.some((r) => r.stuck) },
    { id: "tilt", text: "FLUX TILT", level: 1, test: (s) => s.tilt() > 0.25 && s.P > 0.3 },
    { id: "pmp", text: "PUMP FAULT", level: 1, test: (s) => s.comps.pumpA.failed || s.comps.pumpB.failed || s.comps.pumpA.health < 30 || s.comps.pumpB.health < 30 },
    { id: "deg", text: "COMPONENT DEGRADED", level: 1, test: (s) => COMPS.some((c) => !s.comps[c.id].tagged && !s.comps[c.id].failed && s.comps[c.id].health < 35) },
    { id: "leak", text: "COOLANT LEAK", level: 2, test: (s) => s.leaks.some((l) => !l.isolated) },
    { id: "rad", text: "RADIATION RELEASE", level: 2, test: (s) => s.releaseRate > 0.08 },
    { id: "xe", text: "XENON PIT", level: 1, test: (s) => s.Xe > 1.25 },
    { id: "freq", text: "GRID FREQUENCY", level: 1, test: (s) => s.offsite && Math.abs(s.freq - 50) > 0.8 },
    { id: "tank", text: "ECCS TANK LOW", level: 1, test: (s) => s.tank < 0.25 },
    { id: "cond", text: "CONDENSER OVERLOAD", level: 1, test: (s) => s.condPen > 0.05 },
    { id: "dsl", text: "DIESEL FAULT", level: 1, test: (s) => s.diesel === "failed" || (!s.offsite && s.diesel === "off") },
  ];

  private updateAlarms(dt: number) {
    if (!this.alarms.length) this.alarms = this.alarmDefs.map((d) => ({ id: d.id, text: d.text, level: d.level, active: false, acked: true, count: 0 }));
    let anyUnacked = false;
    this.alarmDefs.forEach((d, i) => {
      const a = this.alarms[i];
      const on = d.test(this);
      if (on && !a.active) {
        a.active = true; a.acked = false; a.count++; this.alarmCount++;
        this.emit(d.level === 2 ? "alarm2" : "alarm1", { msg: d.text });
      } else if (!on && a.active) { a.active = false; a.acked = true; }
      if (a.active && !a.acked) anyUnacked = true;
    });
    this.alarmHorn -= dt;
    if (anyUnacked && this.alarmHorn <= 0) {
      this.alarmHorn = 4;
      this.emit("horn");
    }
    // compliance penalties for limit violations
    if (!this.warm) {
      let v = 0;
      if (this.Tf > 1100) v += 0.5;
      if (this.Pp > 165 || (this.Pp < 130 && this.P > 0.1)) v += 0.15;
      if (this.P > 1.08) v += 0.3;
      if (this.Pc > 2) v += 0.3;
      if (this.tilt() > 0.3 && this.P > 0.3) v += 0.05;
      if (this.Ps > 85) v += 0.1;
      if (v > 0) this.penalize(v * dt);
      else if (!this.tutorial) this.compliance = Math.min(100, this.compliance + 0.03 * dt);
    }
  }

  private protection() {
    if (this.scrammed || this.warm) return;
    const set = new Set<TripId>(this.diffDef.trips);
    if (set.has("flux") && this.P > 1.18) this.doTrip("High neutron flux", true);
    else if (set.has("pressHigh") && this.Pp > 172) this.doTrip("High RCS pressure", true);
    else if (set.has("pressLow") && this.Pp < 122 && this.P > 0.05) this.doTrip("Low RCS pressure", true);
    else if (set.has("tempHigh") && this.Tc > 340) this.doTrip("High coolant temperature", true);
    else if (set.has("tf") && this.Tf > 1100) this.doTrip("High fuel temperature", true);
    else if (set.has("sgLow") && this.sgL < 0.15) this.doTrip("Low SG level", true);
    else if (set.has("steamHigh") && this.Ps > 92) this.doTrip("High steam pressure", true);
    else if (set.has("flow") && this.flow < 0.25 && this.P > 0.2) this.doTrip("Low coolant flow", true);
    else if (set.has("pc") && this.Pc > 2.2) this.doTrip("High containment pressure", true);
  }

  // ---------- scoring ----------
  private updateScore(dt: number) {
    if (this.tutorial) return;
    if (this.offsite) {
      this.gridEligT += dt;
      const d = this.demand;
      const diff = this.MWe - d;
      if (Math.abs(diff) <= 0.06 * Math.max(d, 100) + 10) this.gridOkT += dt;
      const delivered = Math.min(this.MWe, d);
      if (!this.shift.boss) {
        const price = 1 + 0.5 * Math.max(0, d - 800) / 300;
        this.revenue += (delivered * dt / SEC_PER_HOUR) * 0.05 * price;
        this.mwh += (this.MWe * dt) / SEC_PER_HOUR;
        if (diff < -0.1 * d) this.revenue -= (-diff - 0.1 * d) * (dt / SEC_PER_HOUR) * 0.06;
        else if (diff > 0.08 * d) this.revenue -= (diff - 0.08 * d) * (dt / SEC_PER_HOUR) * 0.03;
      }
    }
  }

  private sample(dt: number) {
    this.histAcc += dt;
    if (this.histAcc >= 1) {
      this.histAcc -= 1;
      this.history.push({ t: this.t, dem: this.offsite ? this.demand : 0, mwe: this.MWe, P: this.P, Tc: this.Tc, Pp: this.Pp, Xe: this.Xe });
      if (this.history.length > 300) this.history.shift();
    }
  }

  private updateDisplay(dt: number) {
    const blind = this.cfg.mods.includes("blind");
    const k = blind ? Math.min(1, dt * 0.6) : 1;
    const n = (v: number, m: number) => (blind ? (this.rng() - 0.5) * m : 0) * 1 + v;
    const d = this.disp;
    d.P += (n(this.P, 0.06) - d.P) * k;
    d.Tf += (n(this.Tf, 50) - d.Tf) * k;
    d.Tc += (n(this.Tc, 8) - d.Tc) * k;
    d.Pp += (n(this.Pp, 6) - d.Pp) * k;
    d.Ps += (n(this.Ps, 4) - d.Ps) * k;
    d.MWe += (n(this.MWe, 60) - d.MWe) * k;
    d.sgL += (n(this.sgL, 0.05) - d.sgL) * k;
    d.inv += (n(this.inv, 0.05) - d.inv) * k;
    d.Pc += (n(this.Pc, 0.15) - d.Pc) * k;
    d.Xe += (n(this.Xe, 0.1) - d.Xe) * k;
  }

  private sanitize() {
    const fix = (v: number, def: number) => (Number.isFinite(v) ? v : def);
    this.P = fix(this.P, 0.5); this.Tc = fix(this.Tc, 300); this.Tf = fix(this.Tf, 600); this.Pp = fix(this.Pp, 155);
    this.Ps = fix(this.Ps, 60); this.inv = fix(this.inv, 1); this.Xe = fix(this.Xe, 1); this.sgL = fix(this.sgL, 0.6);
    this.Pc = fix(this.Pc, 0.1); this.MWe = fix(this.MWe, 0); this.D = fix(this.D, 0.03); this.I = fix(this.I, 0.5);
  }

  private checkEnd() {
    if (this.over || this.warm) return;
    if (this.tutorial) return;
    if (this.fuel <= 0) { this.emit("boom"); this.finish("meltdown"); return; }
    if (this.Pc >= 4) { this.emit("boom"); this.finish("breach"); return; }
    if (this.Pp >= 200) { this.emit("boom"); this.finish("rupture"); return; }
    if (this.compliance <= 0) { this.finish("license"); return; }
    if (!this.shift.endless && this.t >= this.shift.duration) this.finish("complete");
  }

  forecastXe(sec: number) {
    let I = this.I, X = this.Xe;
    const P = this.P;
    for (let i = 0; i < sec; i++) {
      I += (0.025 * P - 0.025 * I);
      X += (0.025 * I + 0.005 * P - 0.012 * X - 0.018 * P * X);
    }
    return X;
  }

  // ---------- result ----------
  quotaTarget() { return Math.min(0.95, this.shift.quota * this.diffDef.quota); }
  gridPct() { return this.gridEligT > 1 ? this.gridOkT / this.gridEligT : 1; }

  result(): ShiftResult {
    const d = this.diffDef;
    const s = this.shift;
    const gp = this.gridPct();
    const quota = this.quotaTarget();
    const survived = this.outcome === "complete";
    const quotaMet = s.boss || gp >= quota;
    const success = survived && quotaMet;
    let stars = 0;
    if (success) {
      stars = 1;
      if (s.boss) {
        if (this.minCompliance >= 50) stars++;
        if (this.fuel >= 0.99 && this.peakPc < 3) stars++;
      } else {
        if (gp >= 0.85) stars++;
        if (this.scrams === 0 && this.minCompliance >= 75) stars++;
      }
    }
    const modBonus = this.cfg.mods.reduce((a) => a + 0.2, 0);
    let credits = Math.max(0, this.revenue * 0.6) + stars * 60 + (success && s.boss ? 200 : 0);
    if (!success) credits = Math.max(0, this.revenue) * 0.3;
    if (s.endless) credits = Math.max(0, this.revenue) * 0.4 + (this.t / SEC_PER_HOUR) * 6;
    credits = Math.round(credits * d.credit * (1 + modBonus));
    if (this.outcome === "tutorial") credits = 40;
    const hours = this.t / SEC_PER_HOUR;
    const score = Math.round(Math.max(0, this.revenue) * 5 + gp * 1000 + stars * 500 + this.minCompliance * 5 + (s.endless ? hours * 100 : 0));
    return {
      outcome: this.outcome, shiftId: s.id, time: this.t, hours, gridPct: gp, quota, quotaMet, revenue: this.revenue, mwh: this.mwh,
      scrams: this.scrams, minCompliance: this.minCompliance, peakP: this.peakP, peakTf: this.peakTf, peakPc: this.peakPc,
      release: this.release, repairs: this.repairs, alarms: this.alarmCount, fuel: this.fuel, stars, credits, score,
      diff: this.cfg.getDiff(), success: this.outcome === "tutorial" || success,
    };
  }
}
