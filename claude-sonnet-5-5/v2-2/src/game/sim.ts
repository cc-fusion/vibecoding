import { ArchId, GADGETS, GadgetId, LOOT, Skills, TraitId, ARCH } from './data';
import { World, Pt, Door, LootObj, findPath, roomAt, T_WALL } from './mapgen';
import { audio } from './audio';

export type StepT = 'move' | 'unlock' | 'breach' | 'hack' | 'crack' | 'grab' | 'takedown' | 'distract' | 'gadget' | 'wait' | 'sync' | 'exit';
export type Mode = 'sneak' | 'walk' | 'run';
export interface Step { t: StepT; x: number; y: number; id?: number; k?: string; mode?: Mode; secs?: number; tag?: number; g?: GadgetId; drill?: boolean }
export type Plan = Record<string, Step[]>;

export interface CrewIn { id: string; name: string; arch: ArchId; skills: Skills; trait: TraitId | null; lvl: number }
export interface SimCfg { crew: CrewIn[]; gadgets: Partial<Record<GadgetId, number>>; susp: number; police: number; paranoid: boolean; heat: number; scanner: number; mod: string; tutorial: boolean }

export interface CrewRun {
  id: string; name: string; arch: ArchId; color: string; icon: string; sk: Skills; trait: TraitId | null; lvl: number;
  x: number; y: number; face: number; state: 'idle' | 'move' | 'work' | 'wait' | 'hold' | 'escaped' | 'arrested';
  step: number; phase: 'approach' | 'work'; path: Pt[]; goalKey: string; repath: number; stepT: number;
  workKind: string; workDur: number; workT: number; workRef: any; drilling: boolean;
  auto: { door: Door; dur: number; t: number } | null;
  carry: LootObj[]; carryW: number; cap: number; hold: boolean; talkUsed: boolean; laserCd: number; laserWait: number; footT: number; label: string; noiseT: number;
}

type GState = 'patrol' | 'wait' | 'suspicious' | 'investigate' | 'alert' | 'search' | 'return' | 'down' | 'flee';
export interface GuardRun {
  id: number; spec: { type: 'guard' | 'heavy' | 'drone' | 'civilian' | 'warden'; route: Pt[]; post: boolean };
  type: 'guard' | 'heavy' | 'drone' | 'civilian' | 'warden';
  x: number; y: number; dir: number; want: number; state: GState; susp: number; stateT: number;
  path: Pt[]; pathSet: boolean; ri: number; tx: number; ty: number; last: Pt | null; lostT: number; hunting: boolean;
  wake: number; hidden: boolean; found: boolean; radioT: number; called: boolean; emp: number; flash: number; distract: number; distractor: CrewRun | null;
  stun: number; pause: number; repath: number; range: number; fov: number; walk: number; run: number; bodyTarget: GuardRun | null; saw: CrewRun | null; baseDir: number; panelId: number; hintT: number;
}

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; kind: 'spark' | 'smoke' | 'dust' }
export interface FText { x: number; y: number; text: string; color: string; t: number; life: number; size: number }
export interface Ring { x: number; y: number; max: number; t: number; life: number; color: string }
export interface Smoke { x: number; y: number; r: number; t: number; max: number }
export interface LogEntry { t: number; msg: string; kind: 'info' | 'warn' | 'bad' | 'good' }

export interface HeistResult {
  success: boolean; reason: string; time: number; loot: { kind: string; value: number }[]; lootValue: number;
  arrested: string[]; escaped: string[]; heatDelta: number; carriedCore: boolean;
  bonuses: { id: string; name: string; ok: boolean; pct: number }[]; bonusPct: number; gadgetsUsed: Record<string, number>;
  stats: { soft: number; hard: number; kos: number; hacks: number; doors: number; safes: number; spotted: number; gadgets: number };
  tutorial: boolean; crewIds: string[];
}

const STEP = 1 / 30;
const GSTAT = {
  guard: { range: 8, fov: 1.2, walk: 1.9, run: 3.1 },
  heavy: { range: 7, fov: 1.0, walk: 1.5, run: 2.5 },
  drone: { range: 5.5, fov: 1.6, walk: 2.4, run: 3.3 },
  civilian: { range: 5.5, fov: 1.7, walk: 1.5, run: 3.2 },
  warden: { range: 10, fov: 1.4, walk: 2.0, run: 3.6 },
};
const spdF = (s: number) => 0.55 + 0.25 * s;
const angDiff = (a: number, b: number) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };
const turn = (a: number, b: number, m: number) => { const d = angDiff(b, a); return Math.abs(d) <= m ? b : a + Math.sign(d) * m; };
const rr = (a: number, b: number) => a + Math.random() * (b - a);

export function stepLabel(s: Step, w: World): string {
  switch (s.t) {
    case 'move': return `Move (${s.mode ?? 'walk'})`;
    case 'unlock': return `Pick lock L${w.doors[s.id ?? 0]?.lock ?? '?'}`;
    case 'breach': return 'Breach door';
    case 'hack': return s.k === 'term' ? `Hack ${w.terms[s.id ?? 0]?.kind ?? ''} terminal` : s.k === 'cam' ? `Loop camera #${(s.id ?? 0) + 1}` : 'Disable alarm panel';
    case 'crack': return s.k === 'door' ? (s.drill ? 'Drill the vault' : 'Crack vault door') : (s.drill ? 'Drill safe' : 'Crack safe');
    case 'grab': return `Grab ${LOOT[w.loot[s.id ?? 0]?.kind]?.name ?? 'loot'}`;
    case 'takedown': return `Takedown guard #${(s.id ?? 0) + 1}`;
    case 'distract': return 'Distract nearby';
    case 'gadget': return `Use ${GADGETS[s.g!]?.name ?? 'gadget'}`;
    case 'wait': return `Wait ${s.secs ?? 3}s`;
    case 'sync': return `Sync point #${s.tag ?? 1}`;
    case 'exit': return 'Escape to van';
  }
}
export const stepIcon = (s: Step): string => ({ move: '➜', unlock: '🗝️', breach: '🔨', hack: '💻', crack: '🔐', grab: '💰', takedown: '🥊', distract: '🎭', gadget: GADGETS[s.g as GadgetId]?.icon ?? '🧰', wait: '⏳', sync: '🔗', exit: '🚐' }[s.t]);

export class HeistSim {
  world: World; cfg: SimCfg; plan: Plan = {};
  crew: CrewRun[] = []; guards: GuardRun[] = [];
  particles: Particle[] = []; texts: FText[] = []; rings: Ring[] = []; smokes: Smoke[] = []; log: LogEntry[] = [];
  gadgets: Record<string, number> = {}; gUsed: Record<string, number> = {};
  time = 0; acc = 0; running = false; over = false; overReason = ''; overT = 0;
  alarm = false; copT = 0; copMax = 0; eta = 100; reinfDone = false; cautionT = 0; softCd = 0; alertPos: Pt | null = null;
  jamT = 0; camOffT = 0; laserOffT = 0; laserEmp: number[] = []; vaultHacked = false;
  shake = 0; flash = 0; roomPulse: Record<number, number> = {}; waves: { t: number; room: number; x: number; y: number; hard: boolean }[] = [];
  stash: LootObj[] = []; heatDelta = 0; idleT = 0; tension = 0; used = new Set<string>();
  stats = { soft: 0, hard: 0, kos: 0, hacks: 0, doors: 0, safes: 0, spotted: 0, gadgets: 0 };
  suspMul = 1;

  constructor(world: World, cfg: SimCfg) {
    this.world = world; this.cfg = cfg;
    cfg.crew.forEach((c, i) => {
      const a = ARCH[c.arch];
      const cap = 2 + c.skills.muscle + (c.arch === 'muscle' ? 2 : 0) + (c.trait === 'strong' ? 1 : 0);
      this.crew.push({
        id: c.id, name: c.name, arch: c.arch, color: a.color, icon: a.icon, sk: c.skills, trait: c.trait, lvl: c.lvl,
        x: world.van.x + 0.5 + (i - (cfg.crew.length - 1) / 2) * 0.7, y: world.van.y + 0.5, face: -Math.PI / 2, state: 'idle',
        step: 0, phase: 'approach', path: [], goalKey: '', repath: 0, stepT: 0, workKind: '', workDur: 0, workT: 0, workRef: null, drilling: false, auto: null,
        carry: [], carryW: 0, cap, hold: false, talkUsed: false, laserCd: 0, laserWait: 0, footT: 0, label: 'Ready', noiseT: 0,
      });
    });
    Object.entries(cfg.gadgets).forEach(([k, v]) => { this.gadgets[k] = v ?? 0; });
    world.guards.forEach(s => {
      const st = GSTAT[s.type];
      const nightMul = cfg.mod === 'night' ? 0.8 : 1;
      this.guards.push({
        id: s.id, spec: s, type: s.type, x: s.x + 0.5, y: s.y + 0.5, dir: s.dir, want: s.dir, baseDir: s.dir, state: 'patrol', susp: 0, stateT: 0,
        path: [], pathSet: false, ri: 1, tx: 0, ty: 0, last: null, lostT: 0, hunting: false, wake: 0, hidden: false, found: false, radioT: 0, called: false,
        emp: 0, flash: 0, distract: 0, distractor: null, stun: 0, pause: 0, repath: 0, range: st.range * nightMul, fov: st.fov, walk: st.walk, run: st.run,
        bodyTarget: null, saw: null, panelId: -1, hintT: 0,
      });
    });
    this.laserEmp = world.lasers.map(() => 0);
    const hf = 1 - Math.min(100, cfg.heat) / 200;
    this.eta = Math.max(40, world.tpl.eta * cfg.police * hf * (cfg.mod === 'audit' ? 0.75 : 1) + cfg.scanner * 15);
    this.suspMul = cfg.susp * (cfg.paranoid ? 1.3 : 1) * (1 + cfg.heat / 250);
  }

  // ------------------------------------------------------------ utilities
  snd(n: string, v = 1) { if (this.running) audio.sfx(n, v); }
  addLog(msg: string, kind: LogEntry['kind'] = 'info') { this.log.push({ t: this.time, msg, kind }); if (this.log.length > 60) this.log.shift(); }
  ftext(x: number, y: number, text: string, color = '#e2e8f0', size = 1) { if (this.texts.length < 60) this.texts.push({ x, y, text, color, t: 0, life: 1.4, size }); }
  burst(x: number, y: number, n: number, color: string, sp = 2, life = 0.6, kind: Particle['kind'] = 'spark') {
    for (let i = 0; i < n && this.particles.length < 500; i++) {
      const a = Math.random() * 6.283, s = rr(0.3, 1) * sp;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * rr(0.6, 1), max: life, size: rr(0.05, 0.14), color, kind });
    }
  }
  doShake(a: number) { this.shake = Math.max(this.shake, a); }
  blocks(x: number, y: number): boolean {
    const w = this.world, ix = Math.floor(x), iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= w.w || iy >= w.h) return true;
    const t = w.tiles[iy * w.w + ix];
    if (t === T_WALL) return true;
    const di = w.doorAt[iy * w.w + ix];
    if (di >= 0) { const d = w.doors[di]; if (d.lock > 0 && !(d.open || d.openT > 0)) return true; }
    for (const s of this.smokes) if ((x - s.x) * (x - s.x) + (y - s.y) * (y - s.y) < s.r * s.r) return true;
    return false;
  }
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 0.25);
    for (let i = 1; i < n; i++) if (this.blocks(x0 + dx * i / n, y0 + dy * i / n)) return false;
    return true;
  }
  lightAt(x: number, y: number) { const r = this.world.rooms[roomAt(this.world, x, y)]; return r ? r.light : 0.7; }
  laserOn(i: number, t: number) {
    const L = this.world.lasers[i];
    if (this.laserOffT > 0 || this.laserEmp[i] > 0) return false;
    return L.solid || (((t + L.phase) % L.period) / L.period) < L.duty;
  }
  visFactor(c: CrewRun) {
    const moving = c.state === 'move';
    const mode = this.modeOf(c);
    let f = moving ? (mode === 'sneak' ? 0.5 : mode === 'run' ? 1.55 : 1) : 0.7;
    f *= 1.3 - 0.13 * c.sk.stealth;
    if (c.arch === 'grifter') f *= 0.4;
    f *= 0.45 + 0.55 * this.lightAt(c.x, c.y);
    if (c.trait === 'jumpy' && this.alarm) f *= 1.2;
    if (c.trait === 'sharp') f *= 0.9;
    return f;
  }
  modeOf(c: CrewRun): Mode { const s = (this.plan[c.id] || [])[c.step]; return c.carryW > 0 && !s ? 'walk' : (s?.mode ?? 'walk'); }
  alive(c: CrewRun) { return c.state !== 'escaped' && c.state !== 'arrested'; }

  // ------------------------------------------------------------ control API
  start(plan: Plan) {
    this.plan = JSON.parse(JSON.stringify(plan));
    this.running = true;
    this.addLog('The crew rolls out. Plan is in motion.', 'info');
    this.crew.forEach(c => {
      if ((this.plan[c.id] || []).length) { this.used.add(c.id); c.state = 'move'; }
      else { c.state = 'escaped'; c.label = 'Staying in the van'; }
    });
  }
  toggleHold(id: string) { const c = this.crew.find(x => x.id === id); if (c && this.alive(c)) { c.hold = !c.hold; if (!c.hold) c.state = 'move'; } }
  skipStep(id: string) { const c = this.crew.find(x => x.id === id); if (c && this.alive(c)) { c.auto = null; this.nextStep(c); this.ftext(c.x, c.y - 0.6, 'Skipped', '#94a3b8'); } }
  bail(id: string) {
    const c = this.crew.find(x => x.id === id); if (!c || !this.alive(c)) return;
    this.plan[c.id] = [{ t: 'exit', x: this.world.van.x, y: this.world.van.y, mode: 'run' }];
    c.step = 0; c.phase = 'approach'; c.path = []; c.goalKey = ''; c.auto = null; c.hold = false; c.state = 'move';
    this.ftext(c.x, c.y - 0.6, 'BAILING!', '#fbbf24');
  }
  bailAll() { this.crew.forEach(c => this.bail(c.id)); this.addLog('Bail out! Everyone to the van!', 'warn'); }
  forfeit() { this.crew.forEach(c => { if (this.alive(c)) this.arrest(c); }); this.finish('Heist abandoned'); }

  // ------------------------------------------------------------ main loop
  advance(realDt: number, speed: number) {
    this.fxTick(realDt);
    if (!this.running || this.over || speed <= 0) return;
    this.acc += Math.min(realDt, 0.1) * speed;
    let n = 0;
    while (this.acc >= STEP && n < 12) { this.tick(STEP); this.acc -= STEP; n++; if (this.over) break; }
    if (n >= 12) this.acc = 0;
  }

  private fxTick(dt: number) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; if (p.kind === 'smoke') { p.vx *= 0.97; p.vy *= 0.97; } else { p.vx *= 0.94; p.vy *= 0.94; } }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const t of this.texts) { t.t += dt; t.y -= dt * 0.55; }
    this.texts = this.texts.filter(t => t.t < t.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < r.life);
    this.shake = Math.max(0, this.shake - dt * 14);
    this.flash = Math.max(0, this.flash - dt * 2);
  }

  private tick(dt: number) {
    this.time += dt;
    this.jamT = Math.max(0, this.jamT - dt); this.camOffT = Math.max(0, this.camOffT - dt); this.laserOffT = Math.max(0, this.laserOffT - dt);
    this.cautionT = Math.max(0, this.cautionT - dt); this.softCd = Math.max(0, this.softCd - dt);
    this.laserEmp = this.laserEmp.map(v => Math.max(0, v - dt));
    for (const d of this.world.doors) if (d.openT > 0) d.openT -= dt;
    for (const s of this.smokes) s.t -= dt;
    this.smokes = this.smokes.filter(s => s.t > 0);

    for (const c of this.crew) this.crewTick(c, dt);
    for (const g of this.guards) this.guardTick(g, dt);
    for (const cam of this.world.cams) this.camTick(cam, dt);
    this.laserTrips();

    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      if (w.t <= this.time) { this.waves.splice(i, 1); this.applyWave(w); }
    }
    if (this.alarm && !this.over) {
      this.copT -= dt;
      if (!this.reinfDone && this.copT <= this.copMax * 0.5) this.reinforce();
      if (this.copT <= 0) this.policeArrive();
    }
    // tension for music
    let ms = 0; for (const g of this.guards) if (g.state !== 'down') ms = Math.max(ms, g.susp);
    const target = this.alarm ? 0.85 + 0.15 * (1 - Math.max(0, this.copT) / (this.copMax || 1)) : Math.max(this.cautionT > 0 ? 0.45 : 0, ms * 0.6);
    this.tension += (target - this.tension) * Math.min(1, dt * 1.5);

    // end checks
    const live = this.crew.filter(c => this.alive(c));
    if (!live.length) this.finish('All crew resolved');
    else if (live.every(c => c.state === 'idle' && !c.hold)) {
      this.idleT += dt;
      if (this.idleT > 14) { this.addLog('Plan finished - crew heads for the van.', 'warn'); this.bailAll(); this.idleT = 0; }
    } else this.idleT = 0;
  }

  private finish(reason: string) { if (this.over) return; this.over = true; this.overReason = reason; this.overT = this.time; this.running = true; }

  // ------------------------------------------------------------ alarms
  softAlarm(x: number, y: number, why: string) {
    if (this.softCd > 0) return;
    this.softCd = 2.5; this.stats.soft++; this.heatDelta += 1.5;
    if (this.cautionT <= 0) this.addLog(`Security alerted: ${why}`, 'warn');
    this.cautionT = 30;
    this.snd('soft');
    this.propagate(roomAt(this.world, x, y), x, y, false);
  }
  hardAlarm(x: number, y: number, why: string) {
    if (!this.alarm) {
      this.alarm = true; this.copT = this.eta; this.copMax = this.eta; this.stats.hard++; this.heatDelta += 10;
      this.addLog(`ALARM! ${why}. Police ETA ${Math.round(this.eta)}s.`, 'bad');
      this.snd('alarm'); this.doShake(10); this.flash = 0.6;
      for (const d of this.world.doors) if (d.vault && !d.open) { d.sealed = true; }
      if (this.world.vaultRoom >= 0) this.addLog('LOCKDOWN: vault shutters sealed.', 'bad');
      for (const g of this.guards) if (g.type === 'civilian' && g.state !== 'flee') { this.st(g, 'flee', 8); }
    }
    this.alertPos = { x, y };
    this.propagate(roomAt(this.world, x, y), x, y, true);
  }
  private propagate(room: number, x: number, y: number, hard: boolean) {
    if (room < 0) return;
    const w = this.world, hops = new Array(w.rooms.length).fill(-1);
    hops[room] = 0; const q = [room];
    while (q.length) { const r = q.shift()!; for (const n of w.adj[r]) if (hops[n] < 0) { hops[n] = hops[r] + 1; q.push(n); } }
    const jam = this.jamT > 0;
    const maxHop = jam ? 1 : hard ? 99 : 2;
    const delay = jam ? 3.5 : 1.0;
    hops.forEach((h, r) => { if (h >= 0 && h <= maxHop) this.waves.push({ t: this.time + h * delay, room: r, x, y, hard }); });
  }
  private applyWave(wv: { room: number; x: number; y: number; hard: boolean }) {
    this.roomPulse[wv.room] = this.time;
    for (const g of this.guards) {
      if (g.type === 'civilian' || g.state === 'down' || g.state === 'alert' || g.state === 'flee' || g.stun > 0 || g.flash > 0 || (g.type === 'drone' && g.emp > 0)) continue;
      if (roomAt(this.world, g.x, g.y) !== wv.room) continue;
      if (g.state === 'investigate' && !wv.hard) continue;
      g.tx = wv.x; g.ty = wv.y; g.hunting = wv.hard || g.hunting; g.susp = Math.max(g.susp, 0.3);
      this.st(g, 'investigate');
      this.ftext(g.x, g.y - 0.8, '?', '#fbbf24');
    }
  }
  private reinforce() {
    this.reinfDone = true;
    const f = this.world.front;
    for (let i = 0; i < 2; i++) {
      const st = GSTAT.heavy;
      const g: GuardRun = {
        id: this.guards.length, spec: { type: 'heavy', route: [], post: false }, type: 'heavy', x: f.x + 0.5 + (i - 0.5) * 0.8, y: f.y + 1.5, dir: -Math.PI / 2, want: -Math.PI / 2, baseDir: 0,
        state: 'investigate', susp: 0.6, stateT: 0, path: [], pathSet: false, ri: 0, tx: this.alertPos?.x ?? f.x, ty: this.alertPos?.y ?? f.y - 3, last: null, lostT: 0, hunting: true,
        wake: 0, hidden: false, found: false, radioT: 0, called: true, emp: 0, flash: 0, distract: 0, distractor: null, stun: 0, pause: 0, repath: 0,
        range: st.range, fov: st.fov, walk: st.walk, run: st.run, bodyTarget: null, saw: null, panelId: -1, hintT: 0,
      };
      this.guards.push(g);
    }
    this.addLog('Riot response team enters through the front door!', 'bad');
    this.snd('police'); this.doShake(4);
  }
  private policeArrive() {
    this.addLog('Police have arrived. Everyone inside is taken.', 'bad');
    this.snd('police');
    this.crew.forEach(c => { if (this.alive(c)) this.arrest(c); });
    this.finish('Police arrived');
  }

  noise(x: number, y: number, radius: number, loud: number, force = false) {
    if (loud >= 0.3 || force) this.rings.push({ x, y, max: radius, t: 0, life: 0.9, color: loud >= 0.6 ? '#fbbf24' : '#94a3b8' });
    for (const g of this.guards) {
      if (g.state === 'down' || g.state === 'alert' || g.state === 'flee' || g.stun > 0 || (g.type === 'drone' && g.emp > 0)) continue;
      const d = Math.hypot(g.x - x, g.y - y);
      const eff = radius * (this.los(x, y, g.x, g.y) ? 1 : 0.6);
      if (d > eff) continue;
      g.susp = Math.max(g.susp, 0.3); g.tx = x; g.ty = y;
      if (g.state === 'patrol' || g.state === 'wait' || g.state === 'return' || g.state === 'suspicious' || g.state === 'search' || (force && g.state === 'investigate')) {
        this.st(g, 'investigate'); this.ftext(g.x, g.y - 0.8, '?', '#fbbf24'); this.snd('sus', 0.5);
      }
    }
    if (loud >= 1) this.softAlarm(x, y, 'Loud noise');
  }

  // ------------------------------------------------------------ crew
  private nextStep(c: CrewRun) { c.step++; c.phase = 'approach'; c.path = []; c.goalKey = ''; c.stepT = 0; c.state = 'move'; c.auto = null; c.laserWait = 0; }

  private stepTarget(c: CrewRun, s: Step): { x: number; y: number; range: number; dyn?: boolean } | null {
    const w = this.world;
    switch (s.t) {
      case 'move': case 'distract': return { x: s.x + 0.5, y: s.y + 0.5, range: 0.18 };
      case 'unlock': case 'breach': { const d = w.doors[s.id ?? -1]; return d ? { x: d.x + 0.5, y: d.y + 0.5, range: 1.15 } : null; }
      case 'hack': {
        const o: Pt | undefined = s.k === 'term' ? w.terms[s.id ?? -1] : s.k === 'cam' ? w.cams[s.id ?? -1] : w.panels[s.id ?? -1];
        return o ? { x: o.x + 0.5, y: o.y + 0.5, range: c.arch === 'hacker' ? 6 : 1.4 } : null;
      }
      case 'crack': { const o: Pt | undefined = s.k === 'door' ? w.doors[s.id ?? -1] : w.safes[s.id ?? -1]; return o ? { x: o.x + 0.5, y: o.y + 0.5, range: 1.2 } : null; }
      case 'grab': { const l = w.loot[s.id ?? -1]; return l ? { x: l.x + 0.5, y: l.y + 0.5, range: 0.8 } : null; }
      case 'takedown': { const g = this.guards[s.id ?? -1]; return g ? { x: g.x, y: g.y, range: 1.0, dyn: true } : null; }
      case 'gadget': {
        if (s.g === 'dart') { const g = this.guards[s.id ?? -1]; return g ? { x: g.x, y: g.y, range: 5.5, dyn: true } : null; }
        return { x: s.x + 0.5, y: s.y + 0.5, range: 5.5 };
      }
      case 'exit': return { x: w.van.x + 0.5, y: w.van.y + 0.5, range: 0.9 };
      default: return { x: c.x, y: c.y, range: 99 };
    }
  }

  private crewTick(c: CrewRun, dt: number) {
    if (!this.alive(c)) return;
    c.laserCd = Math.max(0, c.laserCd - dt);
    if (c.hold) { c.state = 'hold'; c.label = 'On hold'; return; }
    if (c.auto) { this.autoTick(c, dt); return; }
    const s = (this.plan[c.id] || [])[c.step];
    if (!s) { c.state = 'idle'; c.label = 'Plan complete'; return; }
    c.stepT += dt;
    c.label = stepLabel(s, this.world);
    if (c.phase === 'work') { this.workTick(c, s, dt); return; }
    if (s.t === 'wait') { this.beginWork(c, s, 'wait', s.secs ?? 3, null); return; }
    if (s.t === 'sync') {
      c.state = 'wait';
      if (this.syncReady(c, s.tag ?? 1) || c.stepT > 90) { this.nextStep(c); } else c.label = `Waiting at sync #${s.tag ?? 1}`;
      return;
    }
    const tgt = this.stepTarget(c, s);
    if (!tgt) { this.ftext(c.x, c.y - 0.6, 'Invalid target', '#f87171'); this.nextStep(c); return; }
    const d = Math.hypot(tgt.x - c.x, tgt.y - c.y);
    if (d <= tgt.range) { this.startStep(c, s); return; }
    c.state = 'move';
    this.moveCrew(c, tgt, dt, s.mode ?? 'walk');
  }

  private syncReady(c: CrewRun, tag: number) {
    for (const o of this.crew) {
      if (o === c || !this.alive(o)) continue;
      const steps = this.plan[o.id] || [];
      const idx = steps.findIndex((s, i) => s.t === 'sync' && s.tag === tag && i >= o.step);
      if (idx < 0) continue;
      if (!(idx === o.step && o.stepT > 0.05)) return false;
    }
    return true;
  }

  private moveCrew(c: CrewRun, tgt: { x: number; y: number; range: number; dyn?: boolean }, dt: number, mode: Mode) {
    const key = `${Math.floor(tgt.x)},${Math.floor(tgt.y)}`;
    c.repath -= dt;
    if (c.goalKey !== key || (tgt.dyn && c.repath <= 0)) {
      const p = findPath(this.world, c.x, c.y, tgt.x, tgt.y, true);
      if (!p) { this.ftext(c.x, c.y - 0.6, 'No route!', '#f87171'); this.snd('error'); this.nextStep(c); return; }
      c.path = p; c.goalKey = key; c.repath = 0.5;
    }
    let sp = (mode === 'sneak' ? 1.7 : mode === 'run' ? 4.2 : 2.7) * Math.max(0.55, 1 - 0.06 * c.carryW);
    if (!c.path.length) { this.stepTo(c, tgt.x, tgt.y, sp, dt); return; }
    const p = c.path[0];
    const ix = Math.floor(p.x), iy = Math.floor(p.y), w = this.world;
    const di = w.doorAt[iy * w.w + ix];
    if (di >= 0) {
      const d = w.doors[di];
      if (!(d.open || d.openT > 0)) {
        if (d.sealed) { this.ftext(c.x, c.y - 0.6, 'Sealed!', '#f87171'); this.snd('error'); this.nextStep(c); return; }
        c.auto = { door: d, dur: d.vault ? this.crackTime(c, 'door', 4, false) : this.lockTime(c, d.lock), t: 0 };
        c.state = 'work'; c.label = d.vault ? 'Cracking vault door' : 'Picking lock';
        if (c.arch !== 'locksmith') this.noise(d.x + 0.5, d.y + 0.5, 1.8, 0);
        this.snd('unlock', 0.4);
        return;
      }
    }
    const li = w.laserAt[iy * w.w + ix];
    if (li >= 0 && c.arch !== 'ghost' && (this.laserOn(li, this.time) || this.laserOn(li, this.time + 0.5))) {
      c.laserWait += dt;
      if (c.laserWait < 14) { c.state = 'wait'; c.label = 'Timing the laser'; return; }
    } else c.laserWait = 0;
    c.state = 'move';
    if (this.stepTo(c, p.x, p.y, sp, dt)) c.path.shift();
    if (mode === 'run') {
      c.footT += dt;
      if (c.footT > 0.45) { c.footT = 0; this.noise(c.x, c.y, 4.5 * (c.trait === 'quiet' ? 0.7 : 1) * (c.arch === 'ghost' ? 0.6 : 1), 0.15); }
    }
  }
  private stepTo(c: CrewRun, x: number, y: number, sp: number, dt: number): boolean {
    const dx = x - c.x, dy = y - c.y, d = Math.hypot(dx, dy), m = sp * dt;
    if (d > 0.001) c.face = Math.atan2(dy, dx);
    if (d <= m) { c.x = x; c.y = y; return true; }
    c.x += dx / d * m; c.y += dy / d * m; return false;
  }

  private autoTick(c: CrewRun, dt: number) {
    const a = c.auto!;
    c.state = 'work'; a.t += dt;
    if (a.door.sealed) { c.auto = null; this.ftext(c.x, c.y - 0.6, 'Sealed!', '#f87171'); this.nextStep(c); return; }
    if (a.t >= a.dur) { this.openDoor(a.door, c, false); c.auto = null; c.state = 'move'; }
  }
  private openDoor(d: Door, c: CrewRun, loud: boolean) {
    d.open = true; this.stats.doors++;
    this.snd(loud ? 'breach' : 'unlock');
    this.burst(d.x + 0.5, d.y + 0.5, loud ? 14 : 6, loud ? '#fbbf24' : '#7dd3fc', loud ? 3 : 1.5);
    this.ftext(d.x + 0.5, d.y - 0.2, d.vault ? 'VAULT OPEN' : loud ? 'BREACHED' : 'Unlocked', loud ? '#fbbf24' : '#7dd3fc');
    if (d.vault) this.addLog(`${c.name} opened the vault!`, 'good');
    if (loud) { this.doShake(3); this.noise(d.x + 0.5, d.y + 0.5, 9, 1, true); }
  }

  lockTime(c: CrewRun, lock: number) {
    const base = [0, 3, 4.5, 6.5, 8][Math.min(4, lock)];
    let t = base / spdF(c.sk.lock);
    if (lock > c.sk.lock) t *= 1 + 0.6 * (lock - c.sk.lock);
    if (c.arch === 'locksmith') t *= 0.75;
    if (c.trait === 'steady') t *= 0.87;
    return t;
  }
  crackTime(c: CrewRun, kind: string, lock: number, drill: boolean) {
    let t = (kind === 'door' ? 26 * (this.vaultHacked ? 0.4 : 1) : 6 + 4 * lock) / spdF(c.sk.lock);
    if (lock > c.sk.lock + 1) t *= 1 + 0.3 * (lock - c.sk.lock - 1);
    if (c.arch === 'locksmith') t *= 0.75;
    if (c.trait === 'steady') t *= 0.87;
    if (drill) t *= 0.33;
    return t;
  }

  private beginWork(c: CrewRun, s: Step, kind: string, dur: number, ref: any) {
    c.phase = 'work'; c.state = 'work'; c.workKind = kind; c.workDur = Math.max(0.3, dur); c.workT = 0; c.workRef = ref; c.drilling = false; c.noiseT = 0;
    if (kind === 'crack' && s.drill) {
      if ((this.gadgets.drill || 0) > 0) { this.gadgets.drill--; this.gUsed.drill = (this.gUsed.drill || 0) + 1; this.stats.gadgets++; c.drilling = true; this.snd('drill'); this.ftext(c.x, c.y - 0.7, '🔥 DRILL', '#fb923c'); }
    }
  }

  private startStep(c: CrewRun, s: Step) {
    const w = this.world;
    switch (s.t) {
      case 'move': this.nextStep(c); break;
      case 'unlock': { const d = w.doors[s.id!]; if (d.open || d.openT > 0) { this.nextStep(c); break; } if (d.vault) { this.ftext(c.x, c.y - 0.6, 'Needs a crack!', '#f87171'); this.nextStep(c); break; } if (c.arch !== 'locksmith') this.noise(d.x + 0.5, d.y + 0.5, 1.8, 0); this.beginWork(c, s, 'unlock', this.lockTime(c, d.lock), d); this.snd('unlock', 0.5); break; }
      case 'breach': { const d = w.doors[s.id!]; if (d.open || d.openT > 0) { this.nextStep(c); break; } if (d.vault) { this.ftext(c.x, c.y - 0.6, 'Too strong!', '#f87171'); this.nextStep(c); break; } this.beginWork(c, s, 'breach', 1.6 / spdF(c.sk.muscle) * (c.arch === 'muscle' ? 0.8 : 1), d); break; }
      case 'hack': {
        const o: any = s.k === 'term' ? w.terms[s.id!] : s.k === 'cam' ? w.cams[s.id!] : w.panels[s.id!];
        if ((s.k === 'term' && o.hacked) || (s.k === 'panel' && o.disabled)) { this.nextStep(c); break; }
        const base = s.k === 'term' ? 6 : s.k === 'cam' ? 4 : 3;
        this.beginWork(c, s, 'hack', base / spdF(c.sk.hack) * (c.trait === 'steady' ? 0.87 : 1), o); this.snd('hack'); break;
      }
      case 'crack': {
        if (s.k === 'door') { const d = w.doors[s.id!]; if (d.open) { this.nextStep(c); break; } if (d.sealed) { this.ftext(c.x, c.y - 0.6, 'Sealed!', '#f87171'); this.snd('error'); this.nextStep(c); break; } this.beginWork(c, s, 'crack', this.crackTime(c, 'door', 4, false) * (s.drill && (this.gadgets.drill || 0) > 0 ? 0.33 : 1), d); }
        else { const sf = w.safes[s.id!]; if (sf.opened) { this.nextStep(c); break; } this.beginWork(c, s, 'crack', this.crackTime(c, 'safe', sf.lock, !!s.drill && (this.gadgets.drill || 0) > 0), sf); }
        break;
      }
      case 'grab': {
        const l = w.loot[s.id!];
        if (l.taken) { this.ftext(c.x, c.y - 0.6, 'Already gone', '#94a3b8'); this.nextStep(c); break; }
        if (l.hidden) { this.ftext(c.x, c.y - 0.6, 'Locked away', '#f87171'); this.snd('error'); this.nextStep(c); break; }
        this.beginWork(c, s, 'grab', 0.9, l); break;
      }
      case 'takedown': { const g = this.guards[s.id!]; if (!g || g.state === 'down') { this.nextStep(c); break; } this.beginWork(c, s, 'takedown', 0.9, g); break; }
      case 'distract': this.beginWork(c, s, 'distract', 6 + c.sk.charm * 1.3 * (c.arch === 'grifter' ? 1.3 : 1), null); this.ftext(c.x, c.y - 0.7, '🎭 Excuse me...', '#c084fc'); break;
      case 'gadget': {
        if (s.g === 'dart') { const g = this.guards[s.id!]; this.useGadget(c, 'dart', g?.x ?? c.x, g?.y ?? c.y, g?.id); } else this.useGadget(c, s.g!, s.x + 0.5, s.y + 0.5);
        this.nextStep(c); break;
      }
      case 'exit': this.escape(c); break;
      default: this.nextStep(c);
    }
  }

  private workTick(c: CrewRun, s: Step, dt: number) {
    c.state = 'work';
    c.workT += dt;
    const k = c.workKind;
    if (k === 'crack') {
      c.noiseT += dt;
      if (c.noiseT > 1.2) { c.noiseT = 0; this.snd(c.drilling ? 'drill' : 'crack', 0.5); if (c.drilling) this.noise(c.x, c.y, 9, 1, true); else if (c.arch !== 'locksmith') this.noise(c.x, c.y, 2.5, 0); this.burst(c.x, c.y, 2, c.drilling ? '#fb923c' : '#fde68a', 1.2, 0.4); }
      if (c.workRef?.sealed) { c.phase = 'approach'; this.ftext(c.x, c.y - 0.6, 'Sealed!', '#f87171'); this.nextStep(c); return; }
    }
    if (k === 'hack' && Math.random() < dt * 8) this.burst(c.workRef.x + 0.5, c.workRef.y + 0.5, 1, '#38bdf8', 0.8, 0.5);
    if (k === 'distract') {
      const rad = 4 + c.sk.charm * 0.4;
      for (const g of this.guards) {
        if (g.state === 'down' || g.type === 'drone' || g.state === 'alert' || g.stun > 0) continue;
        if (Math.hypot(g.x - c.x, g.y - c.y) < rad && this.los(c.x, c.y, g.x, g.y)) { g.distract = 0.5; g.distractor = c; g.want = Math.atan2(c.y - g.y, c.x - g.x); }
      }
    }
    if (k === 'takedown') {
      const g = c.workRef as GuardRun;
      if (Math.hypot(g.x - c.x, g.y - c.y) > 1.7) { c.phase = 'approach'; c.goalKey = ''; return; }
    }
    if (k === 'wait') { c.label = `Waiting ${Math.max(0, c.workDur - c.workT).toFixed(0)}s`; }
    if (c.workT < c.workDur) return;
    this.finishWork(c, s);
  }

  private finishWork(c: CrewRun, s: Step) {
    const w = this.world, k = c.workKind, ref = c.workRef;
    c.phase = 'approach';
    switch (k) {
      case 'unlock': this.openDoor(ref as Door, c, false); break;
      case 'breach': this.openDoor(ref as Door, c, true); break;
      case 'hack': {
        this.stats.hacks++; this.snd('hackdone');
        if (s.k === 'term') {
          ref.hacked = true;
          if (ref.kind === 'cams') { this.camOffT = 60; this.ftext(ref.x + 0.5, ref.y - 0.4, 'CAMERAS LOOPED 60s', '#38bdf8'); this.addLog(`${c.name} looped the cameras.`, 'good'); }
          else if (ref.kind === 'lasers') { this.laserOffT = 60; this.ftext(ref.x + 0.5, ref.y - 0.4, 'LASERS OFF 60s', '#38bdf8'); this.addLog(`${c.name} killed the lasers.`, 'good'); }
          else if (ref.kind === 'comms') { this.jamT = 45; w.panels.forEach(p => { p.disabled = true; }); this.ftext(ref.x + 0.5, ref.y - 0.4, 'COMMS CUT', '#38bdf8'); this.addLog(`${c.name} cut the comms and disabled alarm panels.`, 'good'); }
          else if (ref.kind === 'vault') { this.vaultHacked = true; this.ftext(ref.x + 0.5, ref.y - 0.4, 'TIMELOCK BYPASSED', '#38bdf8'); this.addLog(`${c.name} bypassed the vault timelock (-60% crack time).`, 'good'); }
        } else if (s.k === 'cam') { ref.off = 30; this.ftext(ref.x + 0.5, ref.y - 0.4, 'CAM LOOPED', '#38bdf8'); }
        else { ref.disabled = true; this.ftext(ref.x + 0.5, ref.y - 0.4, 'PANEL DEAD', '#38bdf8'); }
        break;
      }
      case 'crack': {
        this.snd('unlock');
        if (s.k === 'door') this.openDoor(ref as Door, c, false);
        else { ref.opened = true; this.stats.safes++; w.loot.forEach(l => { if (l.safe === ref.id) l.hidden = false; }); this.ftext(ref.x + 0.5, ref.y - 0.4, 'SAFE OPEN', '#fde047'); this.burst(ref.x + 0.5, ref.y + 0.5, 12, '#fde047', 2.5); }
        break;
      }
      case 'grab': {
        const l = ref as LootObj, wt = LOOT[l.kind].w;
        if (l.taken) break;
        if (c.carryW + wt > c.cap) { this.ftext(c.x, c.y - 0.7, 'Too heavy!', '#f87171'); this.snd('error'); break; }
        l.taken = true; c.carry.push(l); c.carryW += wt;
        this.snd('grab'); this.ftext(l.x + 0.5, l.y - 0.3, `+$${l.value.toLocaleString()}`, '#fde047', 1.2);
        this.burst(l.x + 0.5, l.y + 0.5, 10, '#fde047', 2);
        if (l.kind === 'core') { this.addLog('THE MERIDIAN CORE IS OURS! GET OUT!', 'good'); this.doShake(6); }
        break;
      }
      case 'takedown': this.doTakedown(c, ref as GuardRun); break;
      default: break;
    }
    this.nextStep(c);
  }

  private doTakedown(c: CrewRun, g: GuardRun) {
    if (g.state === 'down') return;
    if (Math.hypot(g.x - c.x, g.y - c.y) > 1.7) { this.ftext(c.x, c.y - 0.6, 'Missed!', '#94a3b8'); return; }
    if (g.type === 'drone') { this.ftext(c.x, c.y - 0.6, 'Drones need EMP', '#f87171'); return; }
    const aware = g.state === 'alert' || g.susp > 0.85;
    if (g.type === 'warden') {
      if (c.arch === 'muscle') { g.stun = 4; this.ftext(g.x, g.y - 0.8, 'STAGGERED!', '#fbbf24'); this.snd('ko'); this.doShake(5); }
      else { this.ftext(g.x, g.y - 0.8, 'Warden shrugs it off', '#f87171'); this.st(g, 'alert'); g.susp = 1; g.hunting = true; this.arrest(c); }
      return;
    }
    if (g.type === 'heavy' && c.sk.muscle < 3) { this.ftext(c.x, c.y - 0.7, 'Armour too tough!', '#f87171'); g.susp = 1; this.goAlert(g, c); return; }
    if (aware && !(c.arch === 'muscle' || c.sk.muscle >= 4)) { this.ftext(c.x, c.y - 0.7, 'Spotted mid-grab!', '#f87171'); this.arrest(c); return; }
    this.koGuard(g, 26 + c.sk.muscle * 3 + rr(0, 8), c.arch === 'muscle');
    this.ftext(g.x, g.y - 0.8, g.type === 'civilian' ? 'Napping peacefully' : 'Lights out', '#fbbf24'); this.heatDelta += g.type === 'civilian' ? 2 : 0;
  }

  koGuard(g: GuardRun, secs: number, hide: boolean) {
    this.st(g, 'down'); g.wake = secs; g.hidden = hide; g.found = false; g.susp = 0; g.saw = null; this.stats.kos++; this.heatDelta += 1.5;
    this.snd('ko'); this.burst(g.x, g.y, 10, '#e2e8f0', 2, 0.5, 'dust'); this.doShake(2);
    this.noise(g.x, g.y, 3, 0.3);
    if (this.cfg.tutorial) this.addLog('Guard down. Other guards will find bodies unless hidden!', 'info');
  }

  private escape(c: CrewRun) {
    c.state = 'escaped'; c.carry.forEach(l => this.stash.push(l));
    const v = c.carry.reduce((s, l) => s + l.value, 0);
    this.snd('escape'); this.ftext(c.x, c.y - 0.6, v ? `CLEAR +$${v.toLocaleString()}` : 'CLEAR', '#4ade80', 1.3);
    this.addLog(`${c.name} made it to the van${v ? ` with $${v.toLocaleString()}` : ''}.`, 'good');
    c.carry = []; c.carryW = 0;
  }

  arrest(c: CrewRun) {
    if (!this.alive(c)) return;
    c.carry.forEach(l => { l.taken = false; l.x = Math.floor(c.x); l.y = Math.floor(c.y); });
    c.carry = []; c.carryW = 0; c.state = 'arrested'; c.auto = null;
    this.snd('caught'); this.doShake(8); this.flash = 0.5;
    this.ftext(c.x, c.y - 0.7, 'BUSTED!', '#f87171', 1.5);
    this.burst(c.x, c.y, 16, '#f87171', 3);
    this.addLog(`${c.name} was arrested!`, 'bad');
    this.heatDelta += 6;
  }

  private laserTrips() {
    const w = this.world;
    for (const c of this.crew) {
      if (!this.alive(c) || c.arch === 'ghost' || c.laserCd > 0) continue;
      const li = w.laserAt[Math.floor(c.y) * w.w + Math.floor(c.x)];
      if (li >= 0 && this.laserOn(li, this.time)) {
        c.laserCd = 3; this.snd('laser'); this.doShake(4); this.ftext(c.x, c.y - 0.7, 'TRIPWIRE!', '#f87171', 1.2);
        this.burst(c.x, c.y, 10, '#f87171', 2.5);
        this.noise(c.x, c.y, 8, 0.6, true); this.softAlarm(c.x, c.y, `${c.name} tripped a laser`);
      }
    }
  }

  // ------------------------------------------------------------ gadgets
  useGadget(c: CrewRun, gid: GadgetId, x: number, y: number, guardId?: number): boolean {
    if ((this.gadgets[gid] || 0) <= 0) { this.ftext(c.x, c.y - 0.7, `No ${GADGETS[gid].name}!`, '#f87171'); this.snd('error'); return false; }
    if (Math.hypot(x - c.x, y - c.y) > 8) { this.ftext(c.x, c.y - 0.7, 'Out of range', '#f87171'); this.snd('error'); return false; }
    this.gadgets[gid]--; this.gUsed[gid] = (this.gUsed[gid] || 0) + 1; this.stats.gadgets++;
    this.ftext(x, y - 0.5, GADGETS[gid].icon + ' ' + GADGETS[gid].name, '#e2e8f0');
    switch (gid) {
      case 'smoke': this.smokes.push({ x, y, r: 3, t: 9, max: 9 }); this.snd('smoke'); this.burst(x, y, 20, '#cbd5e1', 1.5, 1.5, 'smoke'); break;
      case 'noise': this.snd('noisemaker'); this.noise(x, y, 10, 0.6, true); break;
      case 'emp':
        this.snd('emp'); this.doShake(4); this.flash = 0.3; this.rings.push({ x, y, max: 5, t: 0, life: 0.8, color: '#7dd3fc' });
        this.world.cams.forEach(cm => { if (Math.hypot(cm.x - x, cm.y - y) < 5) cm.emp = 14; });
        this.world.lasers.forEach(L => { if (L.cells.some(p => Math.hypot(p.x - x, p.y - y) < 5)) this.laserEmp[L.id] = 14; });
        this.guards.forEach(g => { if (g.type === 'drone' && Math.hypot(g.x - x, g.y - y) < 5) { g.emp = 14; this.ftext(g.x, g.y - 0.6, 'DRONE DOWN', '#7dd3fc'); } });
        this.burst(x, y, 24, '#7dd3fc', 4, 0.6);
        break;
      case 'dart': {
        this.snd('dart');
        let g = guardId !== undefined ? this.guards[guardId] : undefined;
        if (!g) { let bd = 2; this.guards.forEach(o => { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; g = o; } }); }
        if (!g || g.state === 'down') { this.ftext(x, y, 'Missed', '#94a3b8'); break; }
        if (g.type === 'drone') { this.ftext(g.x, g.y - 0.6, 'No effect on drones', '#f87171'); break; }
        if (g.type === 'warden') { g.stun = 8; this.ftext(g.x, g.y - 0.8, 'WARDEN STUNNED', '#fbbf24'); this.snd('ko'); break; }
        this.koGuard(g, 80, false); this.ftext(g.x, g.y - 0.8, 'Tranquilised', '#4ade80');
        break;
      }
      case 'jammer': this.jamT = 25; this.snd('jam'); this.ftext(c.x, c.y - 1, 'RADIOS JAMMED 25s', '#fbbf24'); this.addLog('Radio jammer active for 25s.', 'info'); break;
      case 'flash':
        this.snd('flash'); this.flash = 0.8; this.burst(x, y, 20, '#ffffff', 4, 0.5);
        this.guards.forEach(g => { if (g.state !== 'down' && g.type !== 'drone' && Math.hypot(g.x - x, g.y - y) < 4 && this.los(x, y, g.x, g.y)) { g.flash = 7; this.st(g, 'search', 7); g.state = 'search'; this.ftext(g.x, g.y - 0.8, 'BLINDED', '#fde047'); } });
        break;
      default: break;
    }
    return true;
  }

  // ------------------------------------------------------------ cameras
  private camTick(cam: import('./mapgen').Cam, dt: number) {
    if (cam.emp > 0) { cam.emp -= dt; return; }
    if (this.camOffT > 0 || cam.off > 0) { cam.off -= dt; cam.susp = Math.max(0, cam.susp - dt); return; }
    cam.ang = cam.a + Math.sin(this.time * cam.speed + cam.phase) * cam.sweep;
    cam.cool -= dt; cam.alertT -= dt;
    let seen: CrewRun | null = null, best = 0;
    for (const c of this.crew) {
      if (!this.alive(c)) continue;
      const dx = c.x + 0 - (cam.x + 0.5), dy = c.y - (cam.y + 0.5), d = Math.hypot(dx, dy);
      if (d > cam.range || Math.abs(angDiff(Math.atan2(dy, dx), cam.ang)) > cam.fov / 2) continue;
      if (!this.los(cam.x + 0.5, cam.y + 0.5, c.x, c.y)) continue;
      const gain = 0.9 * this.visFactor(c) * (1 - 0.5 * d / cam.range) * this.suspMul;
      if (gain > best) { best = gain; seen = c; }
    }
    cam.susp = seen ? Math.min(1.2, cam.susp + best * dt) : Math.max(0, cam.susp - 0.25 * dt);
    if (seen && cam.susp >= 1 && cam.cool <= 0) {
      cam.cool = 10; cam.alertT = 3; cam.susp = 0.3; this.stats.spotted++;
      this.ftext(cam.x + 0.5, cam.y - 0.3, '📹 SPOTTED', '#f87171');
      this.softAlarm(seen.x, seen.y, `Camera #${cam.id + 1} spotted ${seen.name}`);
    }
  }

  // ------------------------------------------------------------ guards
  private st(g: GuardRun, s: GState, T = 0) { g.state = s; g.stateT = T; g.path = []; g.pathSet = false; g.pause = 0; }
  private setPath(g: GuardRun, x: number, y: number) { g.path = findPath(this.world, g.x, g.y, x, y, false) ?? []; g.pathSet = true; }
  private walkG(g: GuardRun, sp: number, dt: number): boolean {
    if (!g.path.length) return true;
    const p = g.path[0], dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy), m = sp * dt;
    if (d > 0.001) g.want = Math.atan2(dy, dx);
    const w = this.world;
    if (d <= m) { g.x = p.x; g.y = p.y; g.path.shift(); } else { g.x += dx / d * m; g.y += dy / d * m; }
    const di = w.doorAt[Math.floor(g.y) * w.w + Math.floor(g.x)];
    if (di >= 0 && g.type !== 'drone') { const dr = w.doors[di]; if (dr.lock > 0 && !dr.open) dr.openT = 2.5; }
    return g.path.length === 0;
  }

  private perceive(g: GuardRun, dt: number) {
    g.saw = null;
    if (g.flash > 0) return;
    let best = 0, seen: CrewRun | null = null;
    for (const c of this.crew) {
      if (!this.alive(c)) continue;
      const dx = c.x - g.x, dy = c.y - g.y, d = Math.hypot(dx, dy);
      if (d > g.range) continue;
      if (d > 1.3 && Math.abs(angDiff(Math.atan2(dy, dx), g.dir)) > g.fov / 2) continue;
      if (!this.los(g.x, g.y, c.x, c.y)) continue;
      let gain = 0.9 * this.visFactor(c) * (1 - 0.6 * d / g.range) * this.suspMul * (d < 2.5 ? 1.5 : 1);
      if (g.type === 'heavy') gain *= 1.15;
      if (g.type === 'warden') gain *= 1.3;
      if (g.distract > 0) gain *= 0.3;
      if (gain > best) { best = gain; seen = c; }
    }
    if (seen) {
      g.saw = seen; g.last = { x: seen.x, y: seen.y }; g.lostT = 0;
      const was = g.susp;
      g.susp = Math.min(1.2, g.susp + best * dt);
      if (g.state === 'alert') { g.susp = 1.2; return; }
      if (g.susp >= 1) this.goAlert(g, seen);
      else if (g.susp >= 0.4 && was < 0.4 && (g.state === 'patrol' || g.state === 'wait' || g.state === 'return')) {
        this.st(g, 'suspicious', 1.1); g.tx = seen.x; g.ty = seen.y; this.ftext(g.x, g.y - 0.8, '?', '#fbbf24'); this.snd('sus');
      }
    } else g.susp = Math.max(0, g.susp - dt * (g.state === 'alert' ? 0.04 : 0.15));
  }

  goAlert(g: GuardRun, crew: CrewRun | null) {
    if (g.state === 'alert' || g.state === 'down') return;
    if (g.type === 'civilian') {
      if (g.state !== 'flee') { this.ftext(g.x, g.y - 0.8, 'AAAH!', '#f87171', 1.3); this.hardAlarm(g.x, g.y, 'A witness screamed'); this.heatDelta += 4; this.st(g, 'flee', 8); }
      return;
    }
    if (crew && crew.arch === 'grifter' && !crew.talkUsed && !this.alarm && g.type !== 'warden' && Math.hypot(g.x - crew.x, g.y - crew.y) < 7) {
      crew.talkUsed = true; g.susp = 0.1; g.distract = 4; g.distractor = crew; this.st(g, 'wait', 3);
      this.ftext(crew.x, crew.y - 0.8, '"Just maintenance!"', '#c084fc', 1.1); this.addLog(`${crew.name} talked their way out of trouble.`, 'info'); return;
    }
    this.st(g, 'alert'); g.hunting = true; g.radioT = 0; g.called = this.alarm; g.lostT = 0; g.panelId = -1;
    this.ftext(g.x, g.y - 0.8, '!', '#f87171', 1.5); this.snd('alert');
    if (this.cfg.tutorial && this.stats.spotted === 0) this.addLog('A guard spotted you! They will radio it in unless stopped.', 'warn');
  }

  private escalate(g: GuardRun, why: string) {
    if (this.jamT > 0 && !this.alarm) { this.ftext(g.x, g.y - 0.8, 'Radio jammed!', '#fbbf24'); g.hunting = true; this.st(g, 'search', 9); g.tx = g.x; g.ty = g.y; }
    else this.hardAlarm(g.x, g.y, why);
  }

  private guardTick(g: GuardRun, dt: number) {
    if (g.type === 'drone' && g.emp > 0) { g.emp -= dt; return; }
    if (g.state === 'down') {
      g.wake -= dt;
      if (g.wake <= 0) { this.st(g, 'search', 8); g.susp = 0.7; g.hunting = true; g.tx = g.x; g.ty = g.y; this.ftext(g.x, g.y - 0.8, '...?', '#fbbf24'); }
      return;
    }
    g.dir = turn(g.dir, g.want, 5 * dt);
    if (g.stun > 0) { g.stun -= dt; return; }
    if (g.flash > 0) {
      g.flash -= dt;
      if (!g.path.length) { this.setPath(g, g.x + rr(-2, 2), g.y + rr(-2, 2)); g.pathSet = false; }
      this.walkG(g, 0.8, dt); g.want += dt * 2; return;
    }
    if (g.distract > 0) { g.distract -= dt; this.perceive(g, dt); if (g.distract <= 0) g.distractor = null; return; }
    this.perceive(g, dt);
    if (g.state !== 'alert' && g.type !== 'civilian' && g.type !== 'drone') this.bodyCheck(g);
    const sp = g.state === 'alert' ? g.run : g.walk * (this.alarm && g.type !== 'civilian' ? 1.15 : 1);
    switch (g.state) {
      case 'patrol': {
        if (this.alarm && g.type !== 'civilian') { this.pickHuntTarget(g); break; }
        const rt = g.spec.route;
        if (g.spec.post || rt.length <= 1) {
          if (!g.pathSet) { const p = rt[0] ?? { x: g.x, y: g.y }; this.setPath(g, p.x + 0.5, p.y + 0.5); }
          if (g.path.length) this.walkG(g, sp, dt); else g.want = g.baseDir + Math.sin(this.time * 0.7 + g.id) * 0.9;
          break;
        }
        if (!g.pathSet) {
          const wp = rt[g.ri % rt.length];
          this.setPath(g, wp.x + 0.5, wp.y + 0.5);
          if (!g.path.length) { g.ri++; this.st(g, 'wait', rr(1, 2.5)); break; }
        }
        if (this.walkG(g, sp, dt)) { g.ri++; this.st(g, 'wait', rr(1.2, 3)); }
        break;
      }
      case 'wait': g.stateT -= dt; g.want += dt * 0.9 * (g.id % 2 ? 1 : -1); if (g.stateT <= 0) this.st(g, 'patrol'); break;
      case 'suspicious': g.stateT -= dt; g.want = Math.atan2(g.ty - g.y, g.tx - g.x); if (g.stateT <= 0) { this.st(g, 'investigate'); } break;
      case 'investigate': {
        if (!g.pathSet) this.setPath(g, g.tx, g.ty);
        if (g.bodyTarget) {
          const o = g.bodyTarget;
          if (o.state !== 'down') g.bodyTarget = null;
          else if (Math.hypot(o.x - g.x, o.y - g.y) < 1.5) { o.found = true; g.bodyTarget = null; this.ftext(g.x, g.y - 0.8, 'BODY!', '#f87171', 1.2); this.escalate(g, 'A body was discovered'); break; }
        }
        if (this.walkG(g, sp, dt)) { this.st(g, 'search', g.hunting ? 10 : 4); g.pause = 1; }
        break;
      }
      case 'search': {
        g.stateT -= dt;
        if (g.pause > 0) { g.pause -= dt; g.want += dt * 1.6; }
        else if (!g.path.length) {
          if (!g.pathSet || Math.random() < 0.02) { this.setPath(g, g.tx + rr(-4, 4), g.ty + rr(-4, 4)); g.pathSet = false; }
          if (!g.path.length) g.pause = 1.2;
        } else if (this.walkG(g, sp * 0.85, dt)) g.pause = rr(0.8, 1.6);
        if (g.stateT <= 0) { if (g.hunting && this.alarm) this.pickHuntTarget(g); else { g.hunting = false; this.st(g, 'return'); } }
        break;
      }
      case 'return': {
        if (!g.pathSet) {
          const rt = g.spec.route; let bi = 0, bd = 1e9;
          rt.forEach((p, i) => { const d = Math.hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; bi = i; } });
          g.ri = bi; const p = rt[bi] ?? { x: g.x, y: g.y }; this.setPath(g, p.x + 0.5, p.y + 0.5);
        }
        if (this.walkG(g, sp, dt)) this.st(g, 'patrol');
        break;
      }
      case 'flee': {
        g.stateT -= dt;
        if (!g.pathSet || (!g.path.length && g.stateT > 0)) {
          const far = this.world.rooms.slice().sort((a, b) => Math.hypot(b.x - g.x, b.y - g.y) - Math.hypot(a.x - g.x, a.y - g.y))[0];
          const cell = far.cells[Math.floor(Math.random() * far.cells.length)];
          this.setPath(g, cell.x + 0.5, cell.y + 0.5);
        }
        this.walkG(g, g.run, dt);
        if (g.stateT <= 0) { this.st(g, 'return'); g.susp = 0.2; }
        break;
      }
      case 'alert': this.alertTick(g, dt); break;
      default: break;
    }
  }

  private pickHuntTarget(g: GuardRun) {
    const rooms = this.world.rooms.filter(r => r.id !== this.world.vaultRoom);
    const r = rooms[Math.floor(Math.random() * rooms.length)] ?? this.world.rooms[0];
    const c = r.cells[Math.floor(Math.random() * r.cells.length)];
    g.tx = c.x + 0.5; g.ty = c.y + 0.5; g.hunting = true;
    this.st(g, 'investigate');
  }

  private bodyCheck(g: GuardRun) {
    if (g.state !== 'patrol' && g.state !== 'wait' && g.state !== 'return' && g.state !== 'search') return;
    for (const o of this.guards) {
      if (o.state !== 'down' || o.hidden || o.found) continue;
      const dx = o.x - g.x, dy = o.y - g.y, d = Math.hypot(dx, dy);
      if (d > 7 || Math.abs(angDiff(Math.atan2(dy, dx), g.dir)) > g.fov / 2) continue;
      if (!this.los(g.x, g.y, o.x, o.y)) continue;
      g.bodyTarget = o; g.tx = o.x; g.ty = o.y; this.st(g, 'investigate'); this.ftext(g.x, g.y - 0.8, '!?', '#fbbf24'); this.snd('sus');
      return;
    }
  }

  private alertTick(g: GuardRun, dt: number) {
    const vis = g.saw;
    if (vis) g.lostT = 0; else g.lostT += dt;
    // alarm call
    let panelRun = false;
    if (!this.alarm && !g.called && g.type !== 'civilian') {
      if (this.jamT <= 0) { g.radioT += dt; if (g.radioT >= 1.5) { g.called = true; this.hardAlarm(g.x, g.y, 'A guard radioed it in'); } }
      else if (g.type !== 'drone') {
        let bp: Pt | null = null, bd = 1e9;
        this.world.panels.forEach(p => { if (!p.disabled) { const d = Math.hypot(p.x - g.x, p.y - g.y); if (d < bd) { bd = d; bp = p; } } });
        if (bp && !(vis && Math.hypot(vis.x - g.x, vis.y - g.y) < 4)) {
          panelRun = true;
          const pp = bp as Pt;
          if (bd < 1.2) { g.called = true; this.hardAlarm(g.x, g.y, 'A guard hit the alarm panel'); }
          else if (!g.pathSet || g.repath <= 0) { this.setPath(g, pp.x + 0.5, pp.y + 0.5); g.repath = 1.2; }
        } else { g.hintT -= dt; if (g.hintT <= 0) { g.hintT = 4; this.ftext(g.x, g.y - 0.8, 'No signal!', '#fbbf24'); } }
      }
    }
    g.repath -= dt;
    if (panelRun) { this.walkG(g, g.run, dt); return; }
    const tgt = vis ? { x: vis.x, y: vis.y } : g.last;
    if (tgt && (g.repath <= 0 || !g.path.length)) { this.setPath(g, tgt.x, tgt.y); g.repath = 0.35; }
    this.walkG(g, g.run, dt);
    if (vis && g.type !== 'drone' && Math.hypot(vis.x - g.x, vis.y - g.y) < 1.0) this.catchCrew(g, vis);
    if (g.lostT > 5) { g.tx = g.last?.x ?? g.x; g.ty = g.last?.y ?? g.y; this.st(g, 'search', 9); g.susp = 0.5; }
  }

  private catchCrew(g: GuardRun, c: CrewRun) {
    if (g.type === 'civilian') return;
    if (c.arch === 'muscle' && (g.type === 'guard')) { this.koGuard(g, 30, true); this.ftext(g.x, g.y - 0.8, 'Slugged him!', '#f87171'); return; }
    this.arrest(c);
  }

  // ------------------------------------------------------------ results
  result(): HeistResult {
    const escapedCrew = this.crew.filter(c => c.state === 'escaped' && this.used.has(c.id));
    const loot = this.stash.map(l => ({ kind: l.kind, value: l.value }));
    const lootValue = loot.reduce((s, l) => s + l.value, 0);
    const arrested = this.crew.filter(c => c.state === 'arrested').map(c => c.id);
    const success = this.cfg.tutorial ? escapedCrew.length > 0 : lootValue > 0 && escapedCrew.length > 0;
    const par = this.world.par;
    const bonuses = [
      { id: 'ghost', name: 'Ghost: no alarms raised', ok: success && this.stats.soft === 0 && this.stats.hard === 0, pct: 25 },
      { id: 'gentle', name: 'Gentle: nobody knocked out', ok: success && this.stats.kos === 0, pct: 10 },
      { id: 'clean', name: 'Clean getaway: no arrests', ok: success && arrested.length === 0, pct: 10 },
      { id: 'swift', name: `Swift: under ${par}s`, ok: success && this.time < par, pct: 10 },
    ];
    const bonusPct = bonuses.filter(b => b.ok).reduce((s, b) => s + b.pct, 0);
    return {
      success, reason: this.overReason, time: this.time, loot, lootValue, arrested, escaped: escapedCrew.map(c => c.id),
      heatDelta: this.heatDelta + lootValue / 1500, carriedCore: this.stash.some(l => l.kind === 'core'), bonuses, bonusPct,
      gadgetsUsed: { ...this.gUsed }, stats: { ...this.stats }, tutorial: this.cfg.tutorial, crewIds: this.crew.filter(c => this.used.has(c.id)).map(c => c.id),
    };
  }
}
