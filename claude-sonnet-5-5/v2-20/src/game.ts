import { audio } from "./audio";
import { drawGame } from "./render";
import {
  ROOMS, HALL, DOOR_W, roomById, doorX, gapY, zoneAt, buildPath, NPCS, npcDef, buildCase, DIFFS, MODS,
  type CaseDef, type Obj, type Opt, type Zone, type P, type DiffId,
} from "./data";

export interface Settings { master: number; music: number; sfx: number; muted: boolean; shake: boolean; tutorial: boolean }
export interface Save {
  insight: number; ups: Record<string, number>;
  solved: Record<string, { rank: string; loops: number }>; seen: Record<string, string[]>; set: Settings;
}
const KEY = "loop-station-zero-v1";
export const defaultSave = (): Save => ({
  insight: 0, ups: {}, solved: {}, seen: {},
  set: { master: 0.7, music: 0.5, sfx: 0.8, muted: false, shake: true, tutorial: true },
});
export function loadSave(): Save {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Save>;
      return { ...d, ...p, set: { ...d.set, ...(p.set || {}) }, ups: p.ups || {}, solved: p.solved || {}, seen: p.seen || {} };
    }
  } catch { /* storage unavailable */ }
  return d;
}
export function persist(s: Save) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export interface WObj extends Omit<Obj, "room"> { room: Zone; x: number; y: number }
export interface NpcState {
  id: string; x: number; y: number; path: P[]; zone: Zone | null; dead: boolean; trust: number;
  chase: boolean; bubble: string; bubT: number; key: string; repath: number; walk: number;
}
export type MiniKind = "keypad" | "hack" | "breaker" | "safe";
export type Modal =
  | { k: "menu"; obj: WObj }
  | { k: "talk"; npc: string; log: { who: string; text: string }[]; confirm: boolean }
  | { k: "mini"; kind: MiniKind; p: Record<string, unknown>; id: number }
  | { k: "interro" };
export type Overlay = null | "journal" | "pause" | "help" | "settings";
export interface Interro {
  i: number; hp: number; maxHp: number; resolve: number; line: string; ok: boolean | null;
  timer: number; done: null | "win" | "lose"; shake: number;
}
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number }
export interface Floater { x: number; y: number; text: string; color: string; life: number }
export interface Toast { id: number; text: string; color: string; t: number }

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const SMALL = [
  "Long shift, isn't it? Feels like the same day over and over.",
  "Station coffee is the only thing keeping me upright.",
  "Strange vibes tonight. Déjà vu, almost.",
  "Thanks for asking. Not many people do.",
];

export class Game {
  cd: CaseDef;
  spm: number; pool: number; loopsLeft: number; loopNo = 1;
  t = 0; phase: "play" | "crime" | "rewind" | "won" | "lost" = "play"; phaseT = 0; endReason = ""; endsRun = false;
  player = { x: 750, y: 450, path: [] as P[], face: 0, walk: 0, pending: "" };
  trail: P[] = []; trailT = 0;
  npcs: NpcState[] = []; items: string[] = []; pocket: string | null = null;
  known = new Set<string>(); sight: Record<string, Record<number, string>> = {};
  flags: Record<string, boolean> = {}; sus = 0; boUntil = -1;
  modal: Modal | null = null; overlay: Overlay = null; interro: Interro | null = null;
  evDone = new Set<string>(); ovDone = new Set<string>(); smalled = new Set<string>();
  frozen = ""; pulseT = 0; pulseCd = 0; overheard: { lines: [string, string][]; t: number } | null = null;
  reveal: { id: string; t: number } | null = null; toasts: Toast[] = []; tid = 0; mid = 0;
  particles: Particle[] = []; floaters: Floater[] = []; shake = 0; flash = 0; flashColor = "255,255,255";
  pendingCost = 0; miniWin: (() => void) | null = null; chaseOn = false; noticed = false;
  keys = new Set<string>(); stick = { x: 0, y: 0 }; ffHeld = false; sprintHeld = false;
  objs: WObj[] = []; prompt = ""; hintsUsed = 0; runInsight = 0; tension = 0; tensionT = 0;
  stats = { interactions: 0, moved: 0, journal: false, detained: 0, falseAcc: 0, wrong: 0, facts: 0, playTime: 0, crimes: 0, interro: false };
  view = { sc: 1, ox: 0, oy: 0 };
  canvas: HTMLCanvasElement | null = null;
  raf = 0; last = 0; cleanup: (() => void) | null = null; padPrev: boolean[] = [];
  insMult: number;

  constructor(public save: Save, caseId: string, public diffId: DiffId, public mods: string[], public onChange: () => void) {
    this.cd = buildCase(caseId, Math.floor(Math.random() * 1e6));
    const d = DIFFS[diffId];
    this.spm = d.spm * (mods.includes("short") ? 0.75 : 1);
    this.pool = Math.max(3, Math.round(this.cd.pool * d.pool) + (save.ups.stab || 0) * 2 - (mods.includes("fragile") ? 3 : 0));
    this.loopsLeft = this.pool;
    this.insMult = d.ins * (1 + 0.25 * mods.length);
    this.objs = this.cd.objs.map((o) => {
      const r = roomById(o.room);
      return { ...o, x: r.x + o.fx * r.w, y: r.y + o.fy * r.h };
    });
    this.beginLoop();
  }

  // ---------- helpers exposed to case scripts ----------
  get blackout() { return this.t < this.boUntil; }
  has(i: string) { return this.items.includes(i); }
  give(i: string) { if (!this.has(i)) this.items.push(i); audio.sfx("learn"); this.floater(this.player.x, this.player.y - 24, "+" + i, "#7dd3fc"); this.notify(); }
  take(i: string) { this.items = this.items.filter((x) => x !== i); }
  know(id: string) { return this.known.has(id); }
  flag(n: string) { return !!this.flags[n]; }
  setFlag(n: string, v = true) { this.flags[n] = v; }
  npc(id: string) { return this.npcs.find((n) => n.id === id)!; }
  npcZone(id: string) { return this.npc(id)?.zone ?? null; }
  msg(text: string, color = "#e6f1ff") {
    this.toasts.push({ id: ++this.tid, text, color, t: 5 });
    if (this.toasts.length > 5) this.toasts.shift();
    this.notify();
  }
  notify() { this.onChange(); }
  pz(): Zone | null { return zoneAt(this.player.x, this.player.y); }

  learn(id: string) {
    if (this.known.has(id)) return;
    const f = this.cd.facts[id];
    if (!f) return;
    this.known.add(id);
    this.stats.facts++;
    const seen = (this.save.seen[this.cd.id] ||= []);
    if (!seen.includes(id)) {
      seen.push(id);
      const pts = Math.round((f.kind === "evidence" ? 12 : 4) * this.insMult);
      this.save.insight += pts;
      this.runInsight += pts;
      persist(this.save);
      this.floater(this.player.x, this.player.y - 40, `+${pts} Insight`, "#ffd166");
    }
    this.reveal = { id, t: 4.8 };
    audio.sfx(f.kind === "evidence" ? "evidence" : "learn");
    this.burst(this.player.x, this.player.y, f.kind === "evidence" ? "#ffd166" : "#5cc8ff", 26, 150);
    this.notify();
  }

  mini(kind: MiniKind, p: Record<string, unknown>, onWin: () => void) {
    this.miniWin = onWin;
    this.modal = { k: "mini", kind, p, id: ++this.mid };
    audio.sfx("open");
    this.notify();
  }
  miniFail(sus: number) {
    audio.sfx("zap");
    this.addSus(sus);
    this.shakeIt(6);
    this.stats.wrong++;
    this.notify();
  }
  miniDone(ok: boolean) {
    if (this.modal?.k !== "mini") return;
    const w = this.miniWin;
    const c = this.pendingCost;
    this.modal = null;
    this.miniWin = null;
    this.pendingCost = 0;
    if (ok) {
      audio.sfx("right");
      if (w) w();
      this.advance(c);
    }
    this.notify();
  }
  closeModal() {
    if (!this.modal) return;
    if (this.modal.k === "interro") return;
    this.modal = null;
    this.pendingCost = 0;
    this.frozen = "";
    audio.sfx("close");
    this.notify();
  }
  startBlackout(dur: number) {
    this.boUntil = this.t + dur;
    audio.sfx("blackout");
    this.shakeIt(10);
    this.flashIt("0,0,0", 0.6);
    this.msg("⚡ POWER FAILURE — cameras offline, locks released.", "#ffd166");
    if (this.cd.facts.n_blackout) this.learn("n_blackout");
  }

  // ---------- loop flow ----------
  spot(id: string, zone: Zone, xo?: number): P {
    const h = hash(id);
    if (zone === "hall") return { x: xo ?? 700, y: 450 + ((h % 3) - 1) * 18 };
    const r = roomById(zone);
    return { x: r.x + r.w / 2 + ((h % 5) - 2) * 38, y: r.y + r.h / 2 + (((h >> 3) % 3) - 1) * 36 + 20 };
  }
  targetOf(id: string): { zone: Zone; x?: number } {
    if (this.blackout && this.cd.react[id]) return { zone: this.cd.react[id] };
    const s = this.cd.sched[id];
    let cur = s[0];
    for (const e of s) if (e[0] <= this.t) cur = e;
    return { zone: cur[1], x: cur[2] };
  }
  beginLoop() {
    this.t = 0; this.flags = {}; this.sus = 0; this.boUntil = -1; this.wasBO = false;
    this.evDone = new Set(); this.ovDone = new Set(); this.smalled = new Set();
    this.items = this.pocket ? [this.pocket] : [];
    this.modal = null; this.interro = null; this.chaseOn = false; this.frozen = "";
    this.pulseT = 0; this.pulseCd = 0; this.overheard = null; this.noticed = false; this.phase = "play"; this.phaseT = 0;
    this.player.x = 750; this.player.y = 450; this.player.path = []; this.player.pending = ""; this.trail = [];
    const base = this.save.ups.rapport ? 1 : 0;
    this.npcs = NPCS.map((d) => {
      const s = this.cd.sched[d.id][0];
      const p = this.spot(d.id, s[1], s[2]);
      return { id: d.id, x: p.x, y: p.y, path: [], zone: zoneAt(p.x, p.y), dead: false, trust: base, chase: false, bubble: "", bubT: 0, key: s[1] + ":" + (s[2] ?? ""), repath: 0, walk: 0 };
    });
    this.flash = 1; this.flashColor = "92,200,255";
    this.notify();
  }
  startRewind(reason: string) {
    if (this.phase === "rewind" || this.phase === "won" || this.phase === "lost") return;
    this.phase = "rewind"; this.phaseT = 0; this.endReason = reason; this.modal = null; this.overlay = null;
    this.endsRun = this.loopsLeft <= 1;
    audio.sfx("rewind");
    this.notify();
  }
  afterRewind() {
    if (this.endsRun) { this.lose(); return; }
    this.loopsLeft--; this.loopNo++;
    this.beginLoop();
  }
  commitCrime() {
    if (this.phase !== "play") return;
    this.phase = "crime"; this.phaseT = 0; this.stats.crimes++;
    this.modal = null;
    const v = this.npc(this.cd.victim);
    v.dead = true; v.path = [];
    this.shakeIt(26); this.flashIt("255,40,60", 1);
    audio.sfx("crime");
    this.notify();
  }
  detain(reason: string) {
    if (this.phase !== "play") return;
    this.stats.detained++;
    audio.sfx("detain");
    this.shakeIt(18); this.flashIt("255,60,80", 0.8);
    if (this.cd.adaptive) this.learn("n_caught");
    this.startRewind(reason);
  }
  win() {
    const d = DIFFS[this.diffId];
    const ratio = this.loopNo / this.pool;
    const rank = ratio <= 0.4 ? "S" : ratio <= 0.6 ? "A" : ratio <= 0.85 ? "B" : "C";
    const bonus = Math.round(this.cd.num * 40 * d.ins * (1 + 0.25 * this.mods.length) * (rank === "S" ? 1.5 : rank === "A" ? 1.25 : 1));
    this.save.insight += bonus;
    this.runInsight += bonus;
    const prev = this.save.solved[this.cd.id];
    const order = "SABC";
    if (!prev || order.indexOf(rank) < order.indexOf(prev.rank)) this.save.solved[this.cd.id] = { rank, loops: this.loopNo };
    persist(this.save);
    this.phase = "won"; this.modal = null; this.endReason = rank;
    audio.sfx("win");
    this.notify();
  }
  lose() {
    this.phase = "lost"; this.modal = null;
    audio.sfx("lose");
    this.notify();
  }
  get bonusFor() { return this.runInsight; }
  rank() { return this.endReason; }

  // ---------- simulation ----------
  advance(min: number) {
    if (min > 0) this.simulate(min * this.spm, true);
  }
  simulate(sec: number, noInput: boolean) {
    let rem = sec;
    while (rem > 0 && this.phase === "play") {
      const h = Math.min(0.05, rem);
      this.stepWorld(h, noInput);
      rem -= h;
    }
  }
  walkable(x: number, y: number) {
    const r = 9;
    return this.okPt(x - r, y - r) && this.okPt(x + r, y - r) && this.okPt(x - r, y + r) && this.okPt(x + r, y + r);
  }
  doorLocked(room: string) {
    return !!this.cd.locks[room as keyof typeof this.cd.locks] && !this.flags["open_" + room] && !this.blackout;
  }
  okPt(px: number, py: number) {
    if (px >= HALL.x && px <= HALL.x + HALL.w && py >= HALL.y && py <= HALL.y + HALL.h) return true;
    for (const r of ROOMS) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return true;
      const gy = gapY(r);
      const gTop = r.top ? gy : gy;
      if (Math.abs(px - doorX(r)) <= DOOR_W / 2 && py >= gTop && py <= gTop + 20 && !this.doorLocked(r.id)) return true;
    }
    return false;
  }
  watchers(zone: Zone | null) {
    if (!zone) return [];
    return this.npcs.filter((n) => !n.dead && n.zone === zone);
  }
  camOn(zone: Zone | null) {
    return !!zone && zone !== "hall" && !this.blackout && !this.flags.camsOff && this.cd.cameras.includes(zone);
  }
  addSus(n: number, by?: NpcState) {
    let m = DIFFS[this.diffId].sus;
    if (this.mods.includes("paranoid")) m *= 1.4;
    m *= 1 - 0.25 * (this.save.ups.feet || 0);
    const kill = by ? by.id === this.cd.killer : this.watchers(this.pz()).some((w) => w.id === this.cd.killer);
    if (this.cd.adaptive && kill) m *= 1 + 0.12 * (this.loopNo - 1);
    this.sus = clamp(this.sus + n * m, 0, 100);
    if (this.sus >= 35 && !this.noticed) {
      this.noticed = true;
      audio.sfx("notice");
      const w = by || this.watchers(this.pz())[0];
      if (w) { w.bubble = "Hey — you shouldn't be here."; w.bubT = 2.6; }
      this.floater(this.player.x, this.player.y - 30, "Noticed!", "#ff9f43");
    }
    if (this.sus >= 100) this.detain(this.sus >= 100 && this.flags.falseAcc ? "accused" : "detained");
  }
  illicit(zone: Zone, amt: number) {
    const w = this.watchers(zone);
    if (w.length || this.camOn(zone)) {
      const pw = w[0];
      this.addSus(amt, pw);
      this.floater(this.player.x, this.player.y - 26, w.length ? `Seen by ${npcDef(w[0].id).name.split(" ").slice(-1)[0]}!` : "Camera!", "#ff6b6b");
      if (pw) { pw.bubble = "What are you doing?!"; pw.bubT = 2.2; }
      audio.sfx("notice");
    } else {
      this.floater(this.player.x, this.player.y - 26, "Unseen", "#5cc8ff");
    }
  }

  stepWorld(h: number, noInput: boolean) {
    this.t += h / this.spm;
    this.stats.playTime += h;
    this.pulseCd = Math.max(0, this.pulseCd - h);
    if (this.pulseT > 0) this.pulseT -= h;
    // scheduled events
    for (const ev of this.cd.events) {
      if (!this.evDone.has(ev.id) && this.t >= ev.min) {
        this.evDone.add(ev.id);
        this.boUntil = ev.min + ev.dur;
        audio.sfx("blackout"); this.shakeIt(14); this.flashIt("0,0,0", 0.7);
        this.msg("⚡ POWER SURGE — cameras offline, locks released.", "#ffd166");
        this.learn(ev.fact);
      }
    }
    // doors never trap the player when power returns
    const boNow = this.blackout;
    if (this.wasBO && !boNow) {
      for (const r of ROOMS) {
        if (!this.cd.locks[r.id]) continue;
        const inGap = Math.abs(this.player.x - doorX(r)) <= DOOR_W / 2 + 12 && this.player.y >= gapY(r) - 14 && this.player.y <= gapY(r) + 34;
        if (this.pz() === r.id || inGap) this.flags["open_" + r.id] = true;
      }
    }
    this.wasBO = boNow;
    // player
    if (!noInput) this.movePlayer(h);
    // npcs
    for (const n of this.npcs) this.stepNpc(n, h);
    const pz = this.pz();
    // sightings
    const bucket = Math.floor(this.t / 5);
    for (const n of this.npcs) {
      if (!n.dead && n.zone && n.zone === pz) (this.sight[n.id] ||= {})[bucket] = n.zone;
    }
    // overhears
    for (const ov of this.cd.overhears) {
      if (this.ovDone.has(ov.id) || pz !== ov.room || this.t < ov.from || this.t > ov.to) continue;
      if (ov.who.every((w) => { const n = this.npc(w); return !n.dead && n.zone === ov.room; })) {
        this.ovDone.add(ov.id);
        this.overheard = { lines: ov.lines, t: 9 };
        const sp = this.npc(ov.lines[0][0]);
        sp.bubble = "…"; sp.bubT = 2;
        this.learn(ov.fact);
      }
    }
    // suspicion
    const restricted = !!pz && pz !== "hall" && this.cd.restricted.includes(pz);
    const w = this.watchers(pz);
    const cam = this.camOn(pz);
    const quill = this.npc("quill");
    let rate = 0;
    if (restricted && (w.length || cam)) rate += (w.length ? 7 : 0) + (cam ? 3 : 0);
    if (this.sprintHeld && w.length && !noInput && this.isMoving()) rate += 3;
    if (rate > 0) this.addSus(rate * h, w[0]);
    else if (this.chaseOn && quill.zone === pz) this.addSus(6 * h, quill);
    else { this.sus = Math.max(0, this.sus - (this.chaseOn ? 5 : 2.5) * h); if (this.sus < 8) this.noticed = false; }
    if (this.phase !== "play") return;
    if (!this.chaseOn && this.sus >= 70 && !quill.dead) {
      this.chaseOn = true; quill.chase = true; quill.repath = 0;
      audio.sfx("alert"); this.msg("🚨 SECURITY ALERT — Sgt. Quill is coming for you!", "#ff6b6b");
    } else if (this.chaseOn && this.sus < 30) {
      this.chaseOn = false; quill.chase = false; quill.key = "";
      this.msg("You slipped away. Quill returns to her rounds.", "#7dd3fc");
    }
    if (this.chaseOn && Math.hypot(quill.x - this.player.x, quill.y - this.player.y) < 24) this.detain("detained");
    if (this.phase === "play" && this.t >= this.cd.crime) this.commitCrime();
  }

  isMoving() {
    const k = this.keys;
    return ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].some((x) => k.has(x)) || this.stick.x !== 0 || this.stick.y !== 0;
  }

  movePlayer(h: number) {
    const p = this.player;
    let vx = 0, vy = 0;
    const k = this.keys;
    if (k.has("a") || k.has("arrowleft")) vx -= 1;
    if (k.has("d") || k.has("arrowright")) vx += 1;
    if (k.has("w") || k.has("arrowup")) vy -= 1;
    if (k.has("s") || k.has("arrowdown")) vy += 1;
    vx += this.stick.x; vy += this.stick.y;
    let manual = false;
    if (vx || vy) {
      manual = true; p.path = []; p.pending = "";
      const l = Math.hypot(vx, vy); if (l > 1) { vx /= l; vy /= l; }
    } else if (p.path.length) {
      const t = p.path[0];
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy);
      if (d < 5) { p.path.shift(); if (!p.path.length && p.pending) { const id = p.pending; p.pending = ""; this.interactWith(id); } }
      else { vx = dx / d; vy = dy / d; }
    }
    if (!vx && !vy) return;
    const sp = 150 * (1 + 0.12 * (this.save.ups.legs || 0)) * (this.sprintHeld ? 1.4 : 1);
    const nx = p.x + vx * sp * h, ny = p.y + vy * sp * h;
    let moved = false;
    if (this.walkable(nx, p.y)) { p.x = nx; moved = true; }
    if (this.walkable(p.x, ny)) { p.y = ny; moved = true; }
    if (!moved && !manual) { p.path = []; p.pending = ""; }
    if (moved) {
      p.face = Math.atan2(vy, vx); p.walk += h; this.stats.moved += sp * h;
      this.trailT += h;
      if (this.trailT > 0.06) { this.trailT = 0; this.trail.push({ x: p.x, y: p.y }); if (this.trail.length > 10) this.trail.shift(); }
      if (Math.floor(p.walk * 3.4) !== Math.floor((p.walk - h) * 3.4)) audio.sfx("step");
    }
  }

  stepNpc(n: NpcState, h: number) {
    if (n.bubT > 0) n.bubT -= h;
    if (n.dead) return;
    if (this.frozen === n.id) { n.zone = zoneAt(n.x, n.y); return; }
    if (n.chase) {
      n.repath -= h;
      if (n.repath <= 0) { n.path = buildPath(n.x, n.y, this.player.x, this.player.y); n.repath = 0.3; }
    } else {
      const tg = this.targetOf(n.id);
      const key = tg.zone + ":" + (tg.x ?? "");
      if (key !== n.key) {
        n.key = key;
        const s = this.spot(n.id, tg.zone, tg.x);
        n.path = buildPath(n.x, n.y, s.x, s.y);
      }
    }
    if (n.path.length) {
      const p = n.path[0];
      const dx = p.x - n.x, dy = p.y - n.y, d = Math.hypot(dx, dy);
      const step = (n.chase ? 128 : 85) * h;
      if (d <= step) { n.x = p.x; n.y = p.y; n.path.shift(); }
      else { n.x += (dx / d) * step; n.y += (dy / d) * step; }
      n.walk += h;
    }
    n.zone = zoneAt(n.x, n.y);
  }

  // ---------- UI-facing actions ----------
  doorObjs(): WObj[] {
    const out: WObj[] = [];
    for (const r of ROOMS) {
      const lk = this.cd.locks[r.id];
      if (!lk || !this.doorLocked(r.id)) continue;
      const open = (g: Game) => { g.setFlag("open_" + r.id); audio.sfx("open"); g.msg(`The ${r.name} door unlocks.`, "#4dffb0"); };
      const opt: Opt = lk.kind === "card"
        ? { label: `Swipe a Level ${lk.lvl} keycard`, illicit: 15, lock: (g) => (g.has("card" + lk.lvl) ? null : `Requires a Level ${lk.lvl} keycard.`), run: open }
        : { label: "Enter the keypad code", illicit: 15, run: (g) => g.mini("keypad", { code: lk.code }, () => open(g)) };
      out.push({ id: "door_" + r.id, room: "hall", x: doorX(r), y: r.top ? 432 : 468, icon: "🔒", name: `${r.name} door`, opts: [opt], fx: 0, fy: 0 });
    }
    return out;
  }
  allObjs() { return [...this.objs, ...this.doorObjs()]; }
  nearest(): { obj?: WObj; npc?: NpcState } | null {
    const pz = this.pz();
    let best: { obj?: WObj; npc?: NpcState } | null = null, bd = 1e9;
    for (const o of this.allObjs()) {
      if (o.room !== pz) continue;
      const d = Math.hypot(o.x - this.player.x, o.y - this.player.y);
      if (d < 62 && d < bd) { bd = d; best = { obj: o }; }
    }
    for (const n of this.npcs) {
      if (n.dead || n.zone !== pz) continue;
      const d = Math.hypot(n.x - this.player.x, n.y - this.player.y);
      if (d < 56 && d < bd) { bd = d; best = { npc: n }; }
    }
    return best;
  }
  canAct() { return this.phase === "play" && !this.modal && !this.overlay; }
  interact() {
    if (!this.canAct()) return;
    const n = this.nearest();
    if (!n) return;
    this.interactWith(n.obj ? n.obj.id : "npc:" + n.npc!.id);
  }
  interactWith(id: string) {
    if (!this.canAct()) return;
    this.stats.interactions++;
    audio.sfx("open");
    if (id.startsWith("npc:")) {
      this.modal = { k: "talk", npc: id.slice(4), log: [], confirm: false };
    } else {
      const o = this.allObjs().find((x) => x.id === id);
      if (o) this.modal = { k: "menu", obj: o };
    }
    this.player.path = [];
    this.notify();
  }
  runOpt(obj: WObj, opt: Opt) {
    const why = opt.lock ? opt.lock(this) : null;
    if (why) { this.msg(why, "#ff9f43"); audio.sfx("bad"); return; }
    this.modal = null;
    this.pendingCost = opt.cost || 0;
    if (opt.illicit) this.illicit(obj.room, opt.illicit);
    if (this.phase !== "play") return;
    opt.run(this);
    if (!this.modal && this.pendingCost) { const c = this.pendingCost; this.pendingCost = 0; this.advance(c); }
    this.notify();
  }
  talkOptions(id: string) {
    const n = this.npc(id);
    const out: { key: string; label: string; reason: string | null }[] = [];
    out.push({ key: "small", label: "Make small talk (+1 trust)", reason: this.smalled.has(id) ? "You already chatted this loop." : null });
    if (this.has("coffee")) out.push({ key: "coffee", label: "☕ Offer your coffee (+2 trust)", reason: null });
    for (const t of this.cd.topics[id] || []) {
      let reason: string | null = null;
      if (t.trust && n.trust < t.trust) reason = `Needs trust ${t.trust} (currently ${n.trust})`;
      else if (t.need) reason = t.need(this);
      out.push({ key: t.id, label: t.label + (t.gives && this.known.has(t.gives) ? " ✓" : ""), reason });
    }
    return out;
  }
  pickTopic(id: string, key: string) {
    const m = this.modal;
    if (!m || m.k !== "talk" || this.phase !== "play") return;
    const n = this.npc(id);
    const name = npcDef(id).name;
    let reply = "", cost = 2;
    if (key === "small") {
      if (this.smalled.has(id)) return;
      this.smalled.add(id); n.trust++; cost = 1;
      reply = SMALL[hash(id + this.loopNo) % SMALL.length];
      this.floater(n.x, n.y - 24, "Trust +1", "#4dffb0");
    } else if (key === "coffee") {
      this.take("coffee"); n.trust += 2; cost = 1;
      reply = id === "nyx" ? "Hm. Fine. Thank you." : "Oh — bless you. I needed that.";
      this.floater(n.x, n.y - 24, "Trust +2", "#4dffb0");
    } else {
      const t = (this.cd.topics[id] || []).find((x) => x.id === key);
      if (!t) return;
      if ((t.trust && n.trust < t.trust) || (t.need && t.need(this))) return;
      reply = t.reply; cost = t.cost ?? 2;
      if (t.gives) this.learn(t.gives);
    }
    m.log.push({ who: "You", text: key === "small" ? "Mind if we talk a moment?" : key === "coffee" ? "Here — brought you a coffee." : (this.cd.topics[id] || []).find((x) => x.id === key)?.label || "" });
    m.log.push({ who: name, text: reply });
    n.bubble = reply.length < 46 ? reply : "…"; n.bubT = 3;
    audio.sfx("click");
    this.frozen = id;
    this.advance(cost);
    this.frozen = "";
    this.notify();
  }
  confirmAccuse(v: boolean) {
    if (this.modal?.k === "talk") { this.modal.confirm = v; this.notify(); }
  }
  evidenceKnown() { return this.cd.evidence.filter((e) => this.known.has(e)); }
  accuse(id: string) {
    if (this.phase !== "play") return;
    if (id !== this.cd.killer) {
      this.stats.falseAcc++; this.flags.falseAcc = true;
      this.modal = null;
      this.msg(`${npcDef(id).name} is innocent. Your accusation causes a scene!`, "#ff6b6b");
      this.sus = 100;
      this.detain("accused");
      return;
    }
    const d = DIFFS[this.diffId];
    this.interro = { i: 0, hp: d.hp + (this.save.ups.nerve || 0), maxHp: d.hp + (this.save.ups.nerve || 0), resolve: 100, line: this.cd.statements[0].text, ok: null, timer: this.cd.bossTimer || 0, done: null, shake: 0 };
    this.modal = { k: "interro" };
    this.stats.interro = true;
    audio.sfx("alert");
    this.notify();
  }
  present(choice: string) {
    const q = this.interro;
    if (!q || q.done) return;
    const st = this.cd.statements[q.i];
    const lies = this.cd.statements.filter((s) => !s.truth).length;
    const ok = st.truth ? choice === "slide" : choice === st.counter;
    if (ok) {
      q.ok = true;
      if (!st.truth) q.resolve = Math.max(0, q.resolve - 100 / lies);
      audio.sfx("right");
      q.i++;
      if (q.i >= this.cd.statements.length) {
        q.done = "win"; q.line = st.react; q.timer = 0;
        this.flashIt("255,255,255", 0.9); this.shakeIt(14);
      } else {
        q.line = st.react;
        q.timer = this.cd.bossTimer || 0;
      }
    } else {
      q.ok = false; q.hp--; q.shake = 0.5; this.stats.wrong++;
      audio.sfx("bad"); this.shakeIt(8);
      q.line = choice === "timeout" ? "You hesitate. The moment passes." : st.truth ? "That's unrelated. You're badgering me." : "That doesn't contradict a thing I said.";
      q.timer = this.cd.bossTimer || 0;
      if (q.hp <= 0) { q.done = "lose"; q.line = "Enough! I'm done with this farce. Guards!"; q.timer = 0; }
    }
    this.notify();
  }
  finishInterro() {
    const q = this.interro;
    if (!q || !q.done) return;
    this.interro = null;
    if (q.done === "win") this.win();
    else { this.modal = null; this.startRewind("failed"); }
    this.notify();
  }
  pin(item: string) {
    if (!this.save.ups.pocket) return;
    this.pocket = this.pocket === item ? null : item;
    audio.sfx("click"); this.notify();
  }
  usePulse() {
    if (!this.save.ups.pulse || this.pulseCd > 0 || !this.canAct()) return;
    this.pulseT = 5; this.pulseCd = 25;
    audio.sfx("pulse");
    this.burst(this.player.x, this.player.y, "#5cc8ff", 40, 260);
    this.notify();
  }
  hint() {
    const miss = this.cd.evidence.find((e) => !this.known.has(e));
    if (!miss) return "You have everything you need. Find the killer and confront them!";
    if (this.save.insight >= 5) { this.save.insight -= 5; persist(this.save); }
    this.hintsUsed++;
    this.notify();
    return this.cd.hints[miss];
  }
  tutorial(): string | null {
    if (!this.save.set.tutorial || this.cd.num !== 1) return null;
    const s = this.stats;
    if (s.moved < 200) return "Move with WASD / arrow keys, or click anywhere to walk. Hold Shift to sprint.";
    if (s.interactions < 1) return "Walk next to a glowing object or person and press E (or click them) to interact.";
    if (!s.journal) return "Press J to open your Journal. Everything you learn is kept — even after the loop rewinds.";
    if (this.loopNo < 2) return "Watch the clock! The Commander dies at 20:15. NPCs keep fixed schedules — learn them, then exploit them. Hold F to fast-forward.";
    if (!s.interro) return "Gather MEANS, MOTIVE and OPPORTUNITY evidence, then press E on the killer and choose Confront. Ask for a hint in the Journal if stuck.";
    return null;
  }

  // ---------- fx ----------
  shakeIt(n: number) { if (this.save.set.shake) this.shake = Math.max(this.shake, n); }
  flashIt(c: string, a: number) { this.flashColor = c; this.flash = a; }
  floater(x: number, y: number, text: string, color: string) { this.floaters.push({ x, y, text, color, life: 1.6 }); if (this.floaters.length > 40) this.floaters.shift(); }
  burst(x: number, y: number, color: string, n: number, sp: number) {
    for (let i = 0; i < n && this.particles.length < 500; i++) {
      const a = Math.random() * Math.PI * 2, s = sp * (0.3 + Math.random() * 0.7);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.6, max: 1.1, color, size: 1.5 + Math.random() * 2.5 });
    }
  }

  // ---------- frame update ----------
  update(dt: number) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.y -= 28 * dt; f.life -= dt; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const t of this.toasts) t.t -= dt;
    if (this.toasts.length && this.toasts[0].t <= 0) { this.toasts = this.toasts.filter((t) => t.t > 0); this.notify(); }
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.reveal) { this.reveal.t -= dt; if (this.reveal.t <= 0) { this.reveal = null; this.notify(); } }
    if (this.overheard) { this.overheard.t -= dt; if (this.overheard.t <= 0) { this.overheard = null; this.notify(); } }
    this.pollPad();
    if (this.phase === "crime") { this.phaseT += dt; if (this.phaseT > 3.4) this.startRewind("crime"); }
    else if (this.phase === "rewind") { this.phaseT += dt; if (this.phaseT > 2.6) this.afterRewind(); }
    if (this.interro && !this.interro.done) {
      this.interro.shake = Math.max(0, this.interro.shake - dt);
      if (this.interro.timer > 0 && !this.overlay) { this.interro.timer -= dt; if (this.interro.timer <= 0) this.present("timeout"); }
    }
    if (this.phase === "play" && !this.overlay && !this.modal) {
      const ff = this.ffHeld || this.keys.has("f");
      const moving = this.isMoving();
      const mult = ff && !moving && !this.player.path.length ? 4 : 1;
      this.simulate(dt * mult, false);
      if (mult === 4 && Math.random() < 0.3) audio.sfx("tick");
      const n = this.nearest();
      const np = n ? (n.obj ? `${n.obj.icon} ${n.obj.name}` : `💬 ${npcDef(n.npc!.id).name}`) : "";
      if (np !== this.prompt) { this.prompt = np; this.notify(); }
    }
    this.tensionT += dt;
    if (this.tensionT > 0.25) {
      this.tensionT = 0;
      const ti = clamp(this.t / this.cd.crime, 0, 1);
      const x = ti * ti * 0.6 + this.sus / 100 * 0.35 + (this.interro ? 0.4 : 0) + (this.phase === "crime" ? 0.3 : 0);
      this.tension = clamp(x, 0, 1);
      audio.setTension(this.tension);
      audio.setDuck(!!this.overlay);
    }
  }
  pollPad() {
    const gp = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!gp) { if (this.stick.x || this.stick.y) { /* keep touch stick */ } return; }
    const ax = Math.abs(gp.axes[0]) > 0.2 ? gp.axes[0] : 0, ay = Math.abs(gp.axes[1]) > 0.2 ? gp.axes[1] : 0;
    if (ax || ay) { this.stick.x = ax; this.stick.y = ay; this.padStick = true; }
    else if (this.padStick) { this.stick.x = 0; this.stick.y = 0; this.padStick = false; }
    const b = gp.buttons.map((x) => x.pressed);
    const edge = (i: number) => b[i] && !this.padPrev[i];
    if (edge(0)) this.interact();
    if (edge(3)) this.toggleOverlay("journal");
    if (edge(9)) this.onEscape();
    if (edge(2)) this.usePulse();
    this.sprintHeld = !!b[1] || this.keys.has("shift");
    this.padPrev = b;
  }
  padStick = false;
  wasBO = false;

  toggleOverlay(o: Overlay) {
    if (this.phase !== "play" && this.phase !== "crime") return;
    if (this.modal && this.modal.k !== "menu" && this.modal.k !== "talk") return;
    this.overlay = this.overlay === o ? null : o;
    if (o === "journal" && this.overlay) this.stats.journal = true;
    audio.sfx(this.overlay ? "open" : "close");
    this.notify();
  }
  onEscape() {
    if (this.phase === "won" || this.phase === "lost") return;
    if (this.overlay) { this.overlay = this.overlay === "settings" || this.overlay === "help" ? "pause" : null; audio.sfx("close"); }
    else if (this.modal && this.modal.k !== "interro") { this.closeModal(); return; }
    else if (this.phase === "play") { this.overlay = "pause"; audio.sfx("open"); }
    this.notify();
  }
  applySettings() {
    audio.setVolumes(this.save.set, this.save.set.muted);
    persist(this.save);
    this.notify();
  }

  // ---------- canvas wiring ----------
  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    audio.setVolumes(this.save.set, this.save.set.muted);
    audio.startMusic(this.cd.rootMidi);
    const ctx = canvas.getContext("2d");
    const resize = () => {
      const par = canvas.parentElement; if (!par) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.floor(par.clientWidth * dpr));
      canvas.height = Math.max(2, Math.floor(par.clientHeight * dpr));
      canvas.style.width = par.clientWidth + "px"; canvas.style.height = par.clientHeight + "px";
    };
    resize();
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "tab"].includes(k)) e.preventDefault();
      audio.resume();
      if (e.repeat && k !== "arrowup" && k !== "arrowdown") { /* allow held movement */ }
      if (k === "escape") { this.onEscape(); return; }
      if (k === "m") { this.save.set.muted = !this.save.set.muted; this.applySettings(); return; }
      if (k === "shift") this.sprintHeld = true;
      if (this.modal && this.modal.k === "mini") return;
      if (k === "j" || k === "tab") { if (!e.repeat) this.toggleOverlay("journal"); return; }
      if (k === "h") { if (!e.repeat) this.toggleOverlay("help"); return; }
      if (!this.canAct()) return;
      if ((k === "e" || k === "enter") && !e.repeat) { this.interact(); return; }
      if (k === "q" && !e.repeat) { this.usePulse(); return; }
      this.keys.add(k);
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
      if (k === "shift") this.sprintHeld = false;
    };
    const blur = () => { this.keys.clear(); this.sprintHeld = false; if (this.phase === "play" && !this.overlay) { this.overlay = "pause"; this.notify(); } };
    const vis = () => { if (document.hidden) blur(); };
    const click = (e: PointerEvent) => {
      audio.resume();
      if (!this.canAct()) return;
      const r = canvas.getBoundingClientRect();
      const kx = canvas.width / Math.max(1, r.width), ky = canvas.height / Math.max(1, r.height);
      const wx = ((e.clientX - r.left) * kx - this.view.ox) / this.view.sc;
      const wy = ((e.clientY - r.top) * ky - this.view.oy) / this.view.sc;
      const pz = this.pz();
      for (const o of this.allObjs()) {
        if (o.room === pz && Math.hypot(o.x - wx, o.y - wy) < 30) { this.walkTo(o.x, o.y, o.id); return; }
      }
      for (const n of this.npcs) {
        if (!n.dead && n.zone === pz && Math.hypot(n.x - wx, n.y - wy) < 30) { this.walkTo(n.x, n.y, "npc:" + n.id); return; }
      }
      if (zoneAt(wx, wy)) this.walkTo(wx, wy, "");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    canvas.addEventListener("pointerdown", click);
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    this.last = performance.now();
    const loop = (ts: number) => {
      const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
      this.last = ts;
      this.update(dt);
      if (ctx) drawGame(ctx, this, canvas.width, canvas.height, ts / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.cleanup = () => {
      cancelAnimationFrame(this.raf);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
      canvas.removeEventListener("pointerdown", click);
      ro.disconnect();
    };
  }
  walkTo(x: number, y: number, pending: string) {
    const p = this.player;
    if (pending) {
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < 50 && this.pz() === zoneAt(x, y)) { this.interactWith(pending); return; }
    }
    p.path = buildPath(p.x, p.y, x, y);
    p.pending = pending;
    if (pending) p.path[p.path.length - 1] = { x: x + (p.x < x ? -34 : 34), y };
  }
  destroy() {
    if (this.cleanup) this.cleanup();
    this.cleanup = null;
    audio.stopMusic();
  }
  modLabel() { return this.mods.map((m) => MODS.find((x) => x.id === m)?.name).filter(Boolean).join(", "); }
}
