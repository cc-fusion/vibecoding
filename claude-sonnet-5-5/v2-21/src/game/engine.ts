// ===== NEON COURIER — run engine: simulation, input, systems =====
import { audio } from './audio';
import { DIFFS, DISTRICTS, PACKAGES, deriveStats, repTier, rng, clamp } from './data';
import type { Contract, Save, Settings, SegType, GadgetId } from './data';
import { BASE_Y, buildSegment, buildTutorial, makeCtx } from './level';
import type { Ent, Segment, Solid } from './level';
import { HackGame } from './hack';
import type { HackKind } from './hack';
import { renderGame, makeBackground } from './render';

export interface RouteLeg { type: SegType; seed: number; mul: number }
export interface RunConfig { contract: Contract; route: RouteLeg[]; save: Save; settings: Settings; tutorial: boolean }
export interface RunResult {
  outcome: 'delivered' | 'busted' | 'destroyed' | 'abandoned'; time: number; par: number; score: number; grade: string; integrity: number; chips: number; chipCash: number;
  heatPeak: number; hacksOk: number; hacksFail: number; stunts: number; topSpeed: number; distance: number; damage: number; falls: number; takedowns: number;
  used: Record<GadgetId, number>; tutorial: boolean; wardenDown: boolean; legMul: number; cause: string; bonusRep: number; bestCombo: number;
}
export interface Callbacks { onEnd: (r: RunResult) => void; onPause: () => void; onResume?: () => void }

export interface Part { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; g: number; glow: boolean }
export interface FText { x: number; y: number; text: string; color: string; life: number; max: number; size: number }
export interface Bolt { x: number; y: number; vx: number; vy: number; life: number; dmg: number }
export interface Mark { kind: 'missile' | 'wave'; x: number; y: number; t: number; max: number; vx: number; dead: boolean }
export interface Player {
  x: number; y: number; w: number; h: number; vx: number; vy: number; ground: Solid | null; sliding: boolean; slideT: number; wr: number; wrVy: number; wrAge: number; wrCool: number; wallTouch: boolean;
  dashT: number; dashCd: number; dashV: number; coyote: number; jbuf: number; rollBuf: number; stun: number; inv: number; vaultT: number; vaultS: Solid | null; airHop: number; jumpCut: boolean;
  zip: Ent | null; zipCd: number; zipV: number; mom: number; run: number; airT: number; bonkCd: number; top: number; face: number;
}
export interface Boss { hp: number; phase: number; atkT: number; waveT: number; flash: number; droneT: number }

const KEYMAP: Record<string, string> = {
  Space: 'jump', KeyW: 'jump', ArrowUp: 'jump', KeyS: 'slide', ArrowDown: 'slide', ControlLeft: 'slide', ShiftLeft: 'dash', ShiftRight: 'dash', KeyL: 'dash',
  KeyA: 'brake', ArrowLeft: 'brake', KeyD: 'accel', ArrowRight: 'accel', KeyE: 'hack', KeyF: 'hack', KeyQ: 'emp', KeyR: 'smoke',
};
const ACT_CODES: Record<string, string[]> = {};
for (const [k, v] of Object.entries(KEYMAP)) (ACT_CODES[v] ||= []).push(k);

const W_P = 22, H_STAND = 44, H_SLIDE = 22, GRAV = 2300, JUMP_V = 800, BASE_SPEED = 430;
type R = { x: number; y: number; w: number; h: number };
const ov = (a: R, b: R) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Game {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; cfg: RunConfig; cb: Callbacks;
  st: ReturnType<typeof deriveStats>; diff = DIFFS.runner; mods: Set<string>; pkgKind; tutorial: boolean;
  segs: Segment[] = []; solids: Solid[] = []; ents: Ent[] = []; movers: Solid[] = []; near: Solid[] = [];
  endX = 0; endY = BASE_Y; gate: Solid | null = null; par = 60;
  p: Player;
  cam = { x: 0, y: 0, fy: BASE_Y, zoom: 1 };
  cw = 1; ch = 1; scale = 1; vw = 1; vh = 1; dpr = 1;
  t = 0; realT = 0; timeScale = 1; paused = false; ended = false; endT = 0; reported = false; destroyed = false;
  outcome: RunResult['outcome'] = 'delivered'; cause = '';
  integrity = 100; heat = 0; heatPeak = 0; seenT = 0; lastStars = 0; pack = { active: false, x: -1000, pulse: 0 };
  boss: Boss | null = null;
  score = 0; combo = 0; comboT = 0; bestCombo = 0; chips = 0; chipCash = 0; chipChain = 0; chipT = 0; chipVal = 8;
  hacksOk = 0; hacksFail = 0; stunts = 0; topSpeed = 0; damageTaken = 0; falls = 0; takedowns = 0; bonusRep = 0;
  gadgets: Record<GadgetId, number> = { emp: 0, smoke: 0, key: 0 }; used: Record<GadgetId, number> = { emp: 0, smoke: 0, key: 0 };
  hack: HackGame | null = null; hackTerm: Ent | null = null; autoUsed = false; nearTerm: Ent | null = null;
  bolts: Bolt[] = []; marks: Mark[] = []; parts: Part[] = []; texts: FText[] = [];
  ghosts: { x: number; y: number; h: number; t: number }[] = []; ghostT = 0;
  shake = 0; flash = 0; flashCol = '#ff2255'; bn: { text: string; sub: string; color: string; t: number } | null = null;
  toasts: { text: string; color: string; t: number }[] = [];
  hintText = ''; hintT = 0; legIdx = 0; cp = { x: 80, y: BASE_Y }; core = 0; overheated = false; dirT = 2; lastBlock = -99; empFx = 0; empPos = { x: 0, y: 0 }; smokeFx = 0;
  down = new Set<string>(); virt = new Set<string>(); padHeld = new Set<string>(); padPrev: boolean[] = []; edge: string[] = [];
  raf = 0; last = 0;
  bgLayers: HTMLCanvasElement[] = []; winPat: CanvasPattern | null = null; vig: CanvasGradient | null = null;
  fps = 60; ro: ResizeObserver | null = null;

  constructor(canvas: HTMLCanvasElement, cfg: RunConfig, cb: Callbacks) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!; this.cfg = cfg; this.cb = cb;
    this.st = deriveStats(cfg.save);
    this.diff = DIFFS[cfg.settings.difficulty]; this.mods = new Set(cfg.settings.mods);
    this.pkgKind = cfg.contract.pkg; this.tutorial = cfg.tutorial;
    const c = cfg.contract;
    if (cfg.tutorial) { this.segs = [buildTutorial()]; }
    else {
      let x = 0, y = BASE_Y;
      cfg.route.forEach((leg, i) => {
        const seg = buildSegment(leg.type, leg.seed, x, y, i, makeCtx(c, i, cfg.save, cfg.settings));
        this.segs.push(seg); x = seg.x1; y = seg.y1;
      });
    }
    for (const s of this.segs) { this.solids.push(...s.solids); this.ents.push(...s.ents); }
    this.movers = this.solids.filter((s) => s.ax || s.ay);
    const last = this.segs[this.segs.length - 1];
    this.endX = last.x1 - 240; this.endY = last.y1;
    this.par = Math.max(20, this.endX / 560);
    this.chipVal = 8 + 3 * c.district;
    this.ents.push({ t: 'pad', x: this.endX, y: this.endY, w: 0, h: 0, seg: this.segs.length - 1 });
    if (c.boss) {
      this.boss = { hp: 100, phase: 1, atkT: 5, waveT: 8, flash: 0, droneT: 5 };
      this.ents.push({ t: 'term', x: this.endX - 200, y: this.endY, w: 0, h: 0, seg: this.segs.length - 1, kind: 'master', diff: 5 });
      this.gate = { x: this.endX + 80, y: this.endY - 1500, w: 50, h: 1500, kind: 'wall', ox: 0, oy: 0, ax: 0, ay: 0, per: 1, ph: 0, dx: 0, dy: 0, seg: 0, block: true };
      this.solids.push(this.gate);
    }
    const cap = this.st.cap;
    this.gadgets = { emp: Math.min(cfg.save.gadgets.emp, cap), smoke: Math.min(cfg.save.gadgets.smoke, cap), key: Math.min(cfg.save.gadgets.key, cap) };
    if (cfg.tutorial) this.gadgets = { emp: 1, smoke: 1, key: 1 };
    if (!cfg.tutorial) {
      let h = (this.mods.has('hot') ? 2 : 0) + (cfg.save.notoriety >= 50 ? 1 : 0) + Math.floor(cfg.save.heat[c.district] / 40);
      if (c.boss) h = Math.max(h, 2);
      this.heat = Math.min(3, h); this.heatPeak = this.heat; this.lastStars = Math.floor(this.heat);
    }
    this.integrity = 100;
    this.p = this.freshPlayer(80, BASE_Y - H_STAND);
    if (this.heat >= 1) { this.pack.active = true; this.pack.x = this.p.x - 1100; }
    this.cam.x = this.p.x - 300; this.cam.y = BASE_Y - 400; this.cam.fy = BASE_Y;
    makeBackground(this);
    this.attach();
    this.banner(cfg.tutorial ? 'TRAINING YARD' : c.boss ? 'THE SPIRE OVERRIDE' : c.title.toUpperCase(), cfg.tutorial ? 'Learn the moves' : `${PACKAGES[c.pkg].icon} ${PACKAGES[c.pkg].name} · ${DISTRICTS[c.district].name}`, DISTRICTS[c.district].pal.accent);
    audio.setMode(c.boss ? 'boss' : 'run');
  }

  freshPlayer(x: number, y: number): Player {
    return { x, y, w: W_P, h: H_STAND, vx: 260, vy: 0, ground: null, sliding: false, slideT: 0, wr: 0, wrVy: 0, wrAge: 0, wrCool: 0, wallTouch: false, dashT: 0, dashCd: 0, dashV: 0, coyote: 0, jbuf: 0, rollBuf: 0,
      stun: 0, inv: 1, vaultT: 0, vaultS: null, airHop: 1, jumpCut: false, zip: null, zipCd: 0, zipV: 0, mom: 20, run: 0, airT: 0, bonkCd: 0, top: 430, face: 1 };
  }

  // ===== lifecycle & input =====
  onKeyDown = (e: KeyboardEvent) => {
    if (this.destroyed) return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (this.hack && !this.paused) { if (e.code === 'Escape' && !e.repeat) this.hack.key('Escape'); return; }
      if (!e.repeat) this.togglePause();
      return;
    }
    if (this.paused) return;
    if (this.hack) { e.preventDefault(); if (!e.repeat) this.hack.key(e.code); return; }
    const a = KEYMAP[e.code];
    if (a) { e.preventDefault(); if (!e.repeat) { this.edge.push(a); } this.down.add(e.code); }
  };
  onKeyUp = (e: KeyboardEvent) => { this.down.delete(e.code); };
  onBlur = () => { this.down.clear(); this.virt.clear(); if (!this.paused && !this.ended && !this.destroyed) this.togglePause(); };
  onPointerDown = (e: PointerEvent) => {
    if (this.paused || this.destroyed) return;
    audio.init();
    const r = this.canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) * (this.canvas.width / r.width), py = (e.clientY - r.top) * (this.canvas.height / r.height);
    if (this.hack) { this.hack.click(px, py); return; }
    if (e.pointerType === 'touch') return;
    if (e.button === 0) { this.press('jump'); }
    else if (e.button === 2) { this.press('dash'); this.release('dash'); }
  };
  onPointerUp = (e: PointerEvent) => { if (e.button === 0 && e.pointerType !== 'touch') this.release('jump'); };
  onCtx = (e: Event) => e.preventDefault();
  onResize = () => this.resize();
  press(a: string) { if (this.hack) return; this.virt.add(a); this.edge.push(a); }
  release(a: string) { this.virt.delete(a); }
  hackAct(a: string) { this.hack?.act(a); }
  heldAct(a: string) { return this.virt.has(a) || this.padHeld.has(a) || (ACT_CODES[a] || []).some((c) => this.down.has(c)); }

  attach() {
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp); window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown); window.addEventListener('pointerup', this.onPointerUp); this.canvas.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('resize', this.onResize);
    if (typeof ResizeObserver !== 'undefined') { this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(this.canvas); }
    this.resize();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.floor(r.width * this.dpr)), h = Math.max(240, Math.floor(r.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.cw = w; this.ch = h;
    const g = this.ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,10,0.62)'); this.vig = g;
  }
  start() { this.last = performance.now(); this.raf = requestAnimationFrame(this.frame); }
  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown); window.removeEventListener('pointerup', this.onPointerUp); this.canvas.removeEventListener('contextmenu', this.onCtx);
    window.removeEventListener('resize', this.onResize); this.ro?.disconnect();
    audio.setMuffle(false);
  }
  togglePause() {
    if (this.ended || this.destroyed) return;
    this.paused = !this.paused;
    if (this.paused) { this.down.clear(); this.virt.clear(); audio.setMuffle(true); audio.sfx('pause'); this.cb.onPause(); }
    else { audio.setMuffle(!!this.hack); this.last = performance.now(); this.cb.onResume?.(); }
  }
  resume() { if (this.paused) this.togglePause(); }
  abandon() { this.paused = false; this.endRun('abandoned', 'You walked away from the job.'); this.finish(); }
  setSettings(s: Settings) { this.cfg.settings = s; this.diff = DIFFS[s.difficulty]; this.mods = new Set(s.mods); }

  pollPad() {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    this.padHeld.clear();
    if (!gp) return;
    const b = gp.buttons.map((x) => x.pressed);
    const edgeB = (i: number) => b[i] && !this.padPrev[i];
    const ax = gp.axes[0] || 0;
    if (this.hack) {
      if (edgeB(0)) this.hack.act('lock'); if (edgeB(1)) this.hack.act('abort'); if (edgeB(3)) this.hack.act('key');
      if (edgeB(12)) this.hack.act('up'); if (edgeB(13)) this.hack.act('down'); if (edgeB(14)) this.hack.act('left'); if (edgeB(15)) this.hack.act('right');
      if (edgeB(2)) this.hack.act('clear'); if (edgeB(4)) this.hack.act('s0'); if (edgeB(5)) this.hack.act('s1');
    } else if (!this.paused) {
      if (edgeB(0)) this.edge.push('jump'); if (edgeB(1)) this.edge.push('slide'); if (edgeB(2)) this.edge.push('dash'); if (edgeB(3)) this.edge.push('hack');
      if (edgeB(4)) this.edge.push('emp'); if (edgeB(5)) this.edge.push('smoke');
      if (b[0]) this.padHeld.add('jump'); if (b[1]) this.padHeld.add('slide');
      if (b[6] || ax < -0.5 || b[14]) this.padHeld.add('brake'); if (b[7] || ax > 0.5 || b[15]) this.padHeld.add('accel');
    }
    if (edgeB(9)) this.togglePause();
    this.padPrev = b;
  }

  frame = (now: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000; this.last = now;
    if (!(dt > 0)) dt = 0.001; if (dt > 0.1) dt = 0.1;
    this.fps += (1 / dt - this.fps) * 0.05;
    this.pollPad();
    if (!this.paused) this.step(dt);
    renderGame(this);
  };

  // ===== main step =====
  step(dt: number) {
    this.realT += dt;
    const target = this.hack ? 0.06 : this.ended ? 0.4 : 1;
    this.timeScale += (target - this.timeScale) * Math.min(1, dt * 10);
    const sdt = dt * this.timeScale;
    if (this.hack) {
      this.hack.update(dt);
      if (this.hack.done) this.finishHack();
    }
    if (!this.ended && !this.hack) this.handleActions(); else this.edge = [];
    if (!this.ended) {
      const n = Math.max(1, Math.ceil(sdt / (1 / 90))), h = sdt / n;
      const cx = this.p.x;
      this.near = this.solids.filter((s) => s.x < cx + 700 + s.ax && s.x + s.w > cx - 500 - s.ax);
      for (let i = 0; i < n; i++) this.sim(h);
    } else {
      this.endT += dt;
      this.near = this.solids.filter((s) => s.x < this.p.x + 700 && s.x + s.w > this.p.x - 500);
      this.sim(sdt);
      if (this.endT > (this.outcome === 'delivered' ? 2.2 : 1.8)) this.finish();
    }
    this.fx(sdt, dt);
    this.camUpdate(dt);
    const heatI = this.heat >= 2 ? 0.15 : 0;
    audio.setIntensity(this.hack ? 0.25 : 0.12 + (this.p.mom / 100) * 0.7 + heatI, this.heat);
    audio.setMuffle(!!this.hack);
  }

  handleActions() {
    const edges = this.edge; this.edge = [];
    const p = this.p;
    for (const a of edges) {
      switch (a) {
        case 'jump': p.jbuf = 0.13; break;
        case 'slide': p.rollBuf = 0.22; if (p.ground && !p.sliding && p.stun <= 0 && p.vx > 150) this.startSlide(0.75); break;
        case 'dash': this.tryDash(); break;
        case 'emp': this.useEmp(); break;
        case 'smoke': this.useSmoke(); break;
        case 'hack': this.tryHack(); break;
      }
    }
  }

  // ===== helpers =====
  floatText(text: string, x: number, y: number, color = '#fff', size = 16) { if (this.texts.length < 40) this.texts.push({ x, y, text, color, life: 1.1, max: 1.1, size }); }
  toast(text: string, color = '#fff') { this.toasts.push({ text, color, t: 3 }); if (this.toasts.length > 3) this.toasts.shift(); }
  banner(text: string, sub = '', color = '#fff') { this.bn = { text, sub, color, t: 2.4 }; }
  burst(x: number, y: number, n: number, color: string, spd = 200, life = 0.6, size = 3, g = 500, glow = true) {
    const k = this.cfg.settings.particles === 'low' ? 0.4 : 1;
    n = Math.ceil(n * k);
    for (let i = 0; i < n && this.parts.length < 700; i++) {
      const a = Math.random() * 6.283, s = spd * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.2, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, g, glow });
    }
  }
  addShake(v: number) { this.shake = Math.min(26, this.shake + v * this.cfg.settings.shake); }
  addHeat(v: number) {
    const owner = DISTRICTS[this.cfg.contract.district].owner;
    const perk = owner && repTier(this.cfg.save.rep[owner]) >= 2 ? 0.8 : 1;
    this.heat = clamp(this.heat + v * this.diff.heat * this.st.heatMul * perk, 0, 5);
    this.heatPeak = Math.max(this.heatPeak, this.heat);
    const stars = Math.floor(this.heat);
    if (stars > this.lastStars) {
      this.lastStars = stars; this.banner(`HEAT ${stars}★`, stars >= 4 ? 'LOCKDOWN — they are everywhere' : stars >= 2 ? 'Drones deployed' : 'Pursuit begins', '#ff3355'); audio.sfx('alarm'); this.addShake(6);
    }
  }
  comboMult() { return 1 + Math.min(7, Math.floor(this.combo / 3)); }
  stunt(name: string, add: number, pts: number, mom = 3) {
    const p = this.p;
    this.combo += add; this.comboT = 3.2; this.bestCombo = Math.max(this.bestCombo, this.combo); this.stunts++;
    p.mom = clamp(p.mom + mom, 0, 100);
    const m = this.comboMult();
    this.score += pts * m;
    this.floatText(`${name}${m > 1 ? ' ×' + m : ''}`, p.x + 10, p.y - 20, '#ffe04a', 15);
    audio.sfx('stunt', Math.min(6, this.combo / 2));
  }
  hurt(amount: number, why: string, stun = 0, ignoreInv = false) {
    const p = this.p;
    if (this.ended) return false;
    if (!ignoreInv && (p.inv > 0 || p.dashT > 0)) return false;
    const d = amount * this.diff.dmg * (this.mods.has('glass') ? 2 : 1) * this.st.dmgMul * PACKAGES[this.pkgKind].frag * (this.tutorial ? 0.3 : 1);
    this.integrity -= d; this.damageTaken += d;
    if (!ignoreInv) p.inv = 0.5;
    this.floatText(`-${Math.round(d)}`, p.x + 10, p.y - 10, '#ff4466', 20);
    this.addShake(4 + d * 0.5); this.flash = 0.35; this.flashCol = '#ff2255';
    this.burst(p.x + 11, p.y + 20, 10, PACKAGES[this.pkgKind].color, 260, 0.5, 3);
    audio.sfx('hit'); this.combo = 0;
    if (stun > 0) { p.stun = Math.max(p.stun, stun); p.mom *= 0.6; p.vx *= 0.4; }
    if (this.integrity <= 0) { this.integrity = 0; this.endRun('destroyed', `${why} destroyed the package.`); }
    return true;
  }
  dot(a: number) {
    if (this.ended) return;
    this.integrity -= a * this.diff.dmg * (this.mods.has('glass') ? 2 : 1) * (this.tutorial ? 0.2 : 1); this.damageTaken += a;
    if (this.integrity <= 0) { this.integrity = 0; this.endRun('destroyed', 'The cargo failed in transit.'); }
  }
  groundAt(x: number): Solid | null {
    let best: Solid | null = null;
    for (const s of this.solids) if (s.kind === 'plat' && x >= s.x && x <= s.x + s.w && (!best || s.y < best.y)) best = s;
    return best;
  }
  free(x: number, y: number, w: number, h: number) {
    const r = { x, y: y + 0.3, w, h: h - 0.7 };
    for (const s of this.near) if (!(s === this.p.vaultS && this.p.vaultT > 0) && ov(r, s)) return false;
    return true;
  }

  // ===== player actions =====
  startSlide(t: number) {
    const p = this.p;
    if (p.sliding) return;
    p.sliding = true; p.slideT = t; p.y += H_STAND - H_SLIDE; p.h = H_SLIDE; audio.sfx('slide');
    this.burst(p.x + 11, p.y + p.h, 5, '#aab', 120, 0.3, 2, 300, false);
  }
  endSlide() {
    const p = this.p;
    if (!p.sliding) return true;
    if (this.free(p.x, p.y - (H_STAND - H_SLIDE), p.w, H_STAND)) { p.y -= H_STAND - H_SLIDE; p.h = H_STAND; p.sliding = false; return true; }
    p.slideT = Math.max(p.slideT, 0.08); return false;
  }
  tryDash() {
    const p = this.p;
    if (p.dashCd > 0 || p.stun > 0 || p.zip) return;
    if (p.sliding && !this.endSlide()) return;
    p.dashT = 0.2; p.dashCd = this.st.dashCd; p.dashV = Math.max(p.vx, p.top) + this.st.dashPow; p.vy = 0; p.inv = Math.max(p.inv, 0.28); p.wr = 0;
    audio.sfx('dash'); this.addShake(3);
    this.burst(p.x, p.y + 20, 14, '#28e0ff', 300, 0.4, 3, 0, true);
  }
  useEmp() {
    if (this.gadgets.emp - this.used.emp <= 0) { audio.sfx('deny'); this.toast('No EMP charges', '#ff6677'); return; }
    this.used.emp++; const p = this.p; let n = 0;
    for (const e of this.ents) {
      if (e.dead || Math.abs(e.x - p.x) > 560) continue;
      if (e.t === 'drone') { e.dead = true; n++; this.burst(e.x, e.y, 18, '#ff7a3a', 260, 0.7, 3); }
      else if (e.t === 'turret') { e.off = 7; n++; } else if (e.t === 'laser') { e.off = 5; n++; } else if (e.t === 'trip') { e.dead = true; n++; }
      else if (e.t === 'walker' && e.kind !== 'ped') { e.state = 2; e.tm = 2.5; n++; }
    }
    this.bolts.length = 0; this.empFx = 0.6; this.empPos = { x: p.x, y: p.y + 20 };
    this.addShake(8); audio.sfx('emp'); this.flash = 0.25; this.flashCol = '#28e0ff';
    this.floatText(n ? `EMP ×${n}` : 'EMP', p.x, p.y - 30, '#28e0ff', 20);
    if (n) { this.stunt('SYSTEM CRASH', 1, 60, 0); this.takedowns += n; }
  }
  useSmoke() {
    if (this.gadgets.smoke - this.used.smoke <= 0) { audio.sfx('deny'); this.toast('No smoke bombs', '#ff6677'); return; }
    this.used.smoke++; const p = this.p;
    this.heat = Math.max(this.boss ? 3 : 0, this.heat - 1); this.lastStars = Math.min(this.lastStars, Math.floor(this.heat));
    if (this.pack.active) this.pack.x -= 380;
    this.seenT = 0; this.smokeFx = 1.5; audio.sfx('smoke');
    for (const e of this.ents) if (e.t === 'drone' && !e.dead && Math.abs(e.x - p.x) < 700) e.off = 4;
    this.burst(p.x, p.y + 30, 40, '#9aa', 220, 1.2, 8, -40, false);
    this.floatText('SMOKE OUT', p.x, p.y - 30, '#cfd8ff', 18);
  }
  tryHack() {
    const t = this.nearTerm;
    if (!t || t.used || (t.lock ?? 0) > 0) { return; }
    this.openHack(t);
  }
  openHack(t: Ent) {
    const c = this.cfg.contract, d = DISTRICTS[c.district];
    const kinds: HackKind[] = ['seq', 'timing', 'code'];
    const kind = kinds[Math.floor(rng(Math.floor(t.x) + 17)() * 3)];
    const owner = d.owner;
    const bonus = this.st.hackBonus + (owner && repTier(this.cfg.save.rep[owner]) >= 1 ? 1.75 : 0);
    const diff = t.kind === 'master' ? 5 : (t.diff ?? 0);
    let rounds = 1 + (diff >= 3 ? 1 : 0) + (diff >= 6 ? 1 : 0);
    if (t.kind === 'master') rounds = this.boss && this.boss.hp > 0 ? Math.min(5, 1 + Math.ceil(this.boss.hp / 25)) : 1;
    if (t.kind === 'relay') rounds = 2;
    if (this.tutorial) rounds = 1;
    const titles: Record<string, string> = { grid: 'SECURITY GRID', cache: 'DATA CACHE', calm: 'ALARM SUPPRESSOR', rep: 'FACTION RELAY', relay: 'WARDEN RELAY', master: 'MASTER OVERRIDE' };
    this.hackTerm = t;
    if (this.st.autoHack && !this.autoUsed) {
      this.autoUsed = true; this.floatText('QUANTUM AUTO-CRACK', this.p.x, this.p.y - 40, '#9ad7ff', 18); audio.sfx('hackOk'); this.applyHack(t); this.hackTerm = null; return;
    }
    this.hack = new HackGame(kind, this.tutorial ? 0 : diff, rounds, bonus, this.st.hackPenalty, this.gadgets.key - this.used.key, titles[t.kind || 'grid'], d.pal.accent);
    audio.sfx('hackOpen');
  }
  finishHack() {
    const h = this.hack!, t = this.hackTerm!;
    this.hack = null; this.hackTerm = null; this.last = performance.now();
    if (h.aborted) { t.lock = 1.5; return; }
    if (h.keyUsed) this.used.key++;
    if (h.success) { this.applyHack(t); }
    else {
      this.hacksFail++; t.lock = 3; this.floatText('HACK FAILED', this.p.x, this.p.y - 30, '#ff3355', 20);
      this.hurt(6 * this.st.hackPenalty, 'Shock feedback', 0, true); this.addHeat(0.5); this.seenT = 2.5;
    }
  }
  applyHack(t: Ent) {
    const p = this.p; this.hacksOk++; t.used = true;
    this.score += 250 * this.comboMult(); audio.sfx('hackOk');
    this.burst(t.x, t.y - 30, 24, '#42ffa8', 260, 0.8, 3);
    const c = this.cfg.contract;
    switch (t.kind) {
      case 'grid':
        for (const e of this.ents) if (!e.dead && e.x > t.x - 300 && e.x < t.x + 2600 && (e.t === 'laser' || e.t === 'trip' || e.t === 'turret' || e.t === 'drone')) e.dis = true;
        this.toast('GRID DOWN — hazards disabled ahead', '#42ffa8'); this.floatText('GRID DOWN', t.x, t.y - 80, '#42ffa8', 20); break;
      case 'cache': { const v = Math.round((60 + c.district * 40) * (0.8 + Math.random() * 0.5)); this.chipCash += v; this.floatText(`+¤${v}`, t.x, t.y - 80, '#ffe04a', 22); this.toast(`Cache cracked: +¤${v}`, '#ffe04a'); break; }
      case 'calm': this.heat = Math.max(this.boss ? 3 : 0, this.heat - 1.5); this.lastStars = Math.min(this.lastStars, Math.floor(this.heat)); if (this.pack.active) this.pack.x -= 300; this.seenT = 0; this.toast('Alarms suppressed: heat down', '#42ffa8'); break;
      case 'rep': { const o = DISTRICTS[c.district].owner; if (o) { this.bonusRep += 5; this.toast(`Relay boosted ${o.toUpperCase()} rep +5`, '#42ffa8'); } else { this.chipCash += 80; this.toast('Relay sold: +¤80', '#ffe04a'); } break; }
      case 'relay': this.damageBoss(20); break;
      case 'master': if (this.boss) { this.boss.hp = 0; } if (this.gate) { this.gate.x = -99999; } this.deliver(); break;
      default: break;
    }
    if (this.pkgKind === 'data' && this.integrity < 100) { this.integrity = Math.min(100, this.integrity + 10); this.floatText('+10 REPAIRED', p.x, p.y - 50, '#42ffa8', 16); audio.sfx('heal'); }
  }
  damageBoss(v: number) {
    const b = this.boss; if (!b) return;
    b.hp = Math.max(0, b.hp - v); b.flash = 1; this.addShake(14); audio.sfx('boom');
    this.flash = 0.4; this.flashCol = '#ffffff';
    if (b.hp <= 0) {
      this.pack.active = false; this.heat = Math.min(this.heat, 1); this.marks.length = 0;
      if (this.gate) this.gate.x = -99999;
      this.banner('WARDEN OFFLINE', 'Reach the drop pad', '#42ffa8'); this.toast('The Warden collapses. Deliver the package!', '#42ffa8');
    } else this.toast(`Warden armor −${v}%  (${b.hp}% left)`, '#ffb02e');
  }

  // ===== end states =====
  deliver() {
    if (this.ended) return;
    this.outcome = 'delivered'; this.ended = true; this.endT = 0; this.cause = '';
    audio.sfx('deliver'); this.banner('DELIVERED', this.tutorial ? 'Training complete' : `Integrity ${Math.round(this.integrity)}%`, '#42ffa8');
    for (let i = 0; i < 6; i++) this.burst(this.p.x + (Math.random() - 0.5) * 200, this.p.y - 80 * Math.random(), 18, ['#28e0ff', '#ff2fd6', '#ffe04a', '#7dff6b'][i % 4], 380, 1.2, 4, 400);
  }
  endRun(o: RunResult['outcome'], cause: string) {
    if (this.ended) return;
    this.outcome = o; this.cause = cause; this.ended = true; this.endT = 0;
    if (o === 'busted') { audio.sfx('busted'); this.banner('BUSTED', 'The pack caught you', '#ff3355'); this.flash = 0.6; this.flashCol = '#3355ff'; }
    else if (o === 'destroyed') { audio.sfx('boom'); this.banner('PACKAGE DESTROYED', cause, '#ff3355'); this.burst(this.p.x, this.p.y, 50, PACKAGES[this.pkgKind].color, 420, 1, 4); }
    this.addShake(14);
  }
  makeResult(): RunResult {
    const c = this.cfg.contract;
    const time = this.realT;
    const delivered = this.outcome === 'delivered';
    let score = this.score;
    if (delivered) score += Math.round(this.integrity * 15 + Math.max(0, this.par - time) * 8);
    const style = clamp(score / (c.legs * 1800), 0, 1);
    const pts = this.integrity * 0.4 + Math.min(1.2, this.par / Math.max(1, time)) * 30 + style * 30;
    const grade = !delivered ? '-' : pts >= 88 ? 'S' : pts >= 74 ? 'A' : pts >= 58 ? 'B' : pts >= 42 ? 'C' : 'D';
    const lm = this.cfg.route.length ? this.cfg.route.reduce((a, l) => a + l.mul, 0) / this.cfg.route.length : 1;
    return {
      outcome: this.outcome, time, par: this.par, score, grade, integrity: this.integrity, chips: this.chips, chipCash: this.chipCash, heatPeak: this.heatPeak, hacksOk: this.hacksOk, hacksFail: this.hacksFail,
      stunts: this.stunts, topSpeed: this.topSpeed, distance: Math.max(0, this.p.x), damage: this.damageTaken, falls: this.falls, takedowns: this.takedowns, used: { ...this.used },
      tutorial: this.tutorial, wardenDown: !!this.boss && this.boss.hp <= 0, legMul: lm, cause: this.cause, bonusRep: this.bonusRep, bestCombo: this.bestCombo,
    };
  }
  finish() {
    if (this.reported) return;
    this.reported = true; this.cb.onEnd(this.makeResult());
  }

  // ===== simulation =====
  sim(dt: number) {
    const p = this.p;
    this.t += dt;
    p.coyote -= dt; p.jbuf -= dt; p.rollBuf -= dt; p.stun -= dt; p.inv -= dt; p.dashCd -= dt; p.vaultT -= dt; p.slideT -= dt; p.wrCool -= dt; p.zipCd -= dt; p.bonkCd -= dt;
    this.comboT -= dt; if (this.comboT <= 0 && this.combo > 0) this.combo = 0;
    this.chipT -= dt; if (this.chipT <= 0) this.chipChain = 0;
    for (const s of this.movers) {
      const nx = s.ox + Math.sin(this.t * 6.2832 / s.per + s.ph) * s.ax, ny = s.oy + Math.sin(this.t * 6.2832 / s.per + s.ph) * s.ay;
      s.dx = nx - s.x; s.dy = ny - s.y; s.x = nx; s.y = ny;
    }
    if (p.zip) this.rideZip(dt); else this.movePlayer(dt);
    this.updateEnts(dt);
    this.updateBolts(dt);
    this.updatePursuit(dt); this.updateBoss(dt); this.updateDirector(dt); this.updatePackage(dt);
    this.topSpeed = Math.max(this.topSpeed, p.vx);
    if (!this.ended) {
      if (this.p.x > this.endX && !this.boss) this.deliver();
      else if (this.boss && this.boss.hp <= 0 && this.p.x > this.endX) this.deliver();
      const g = p.ground;
      if (g && g.kind === 'plat' && p.stun <= 0 && p.x > g.x + 30 && p.x < g.x + g.w - 140 && p.x > this.cp.x - 20) this.cp = { x: p.x, y: g.y };
      if (p.y > 950) this.fall();
    }
  }
  fall() {
    const p = this.p;
    this.falls++; this.p = Object.assign(this.freshPlayer(this.cp.x, this.cp.y - H_STAND), { mom: p.mom * 0.5, inv: 1.6, airHop: 1 });
    const gap = this.pack.active ? Math.max(150, p.x - this.pack.x - 250) : 0;
    if (this.pack.active) this.pack.x = this.p.x - gap;
    this.floatText('SAFETY NET', this.p.x, this.p.y - 30, '#9ad7ff', 18); this.toast('Drone net caught you: −12 integrity, heat up', '#9ad7ff');
    this.hurt(12, 'The fall', 0, true); this.addHeat(0.4); this.combo = 0; this.p.inv = 1.6; audio.sfx('warn');
    this.cam.fy = this.p.y;
  }

  rideZip(dt: number) {
    const p = this.p, z = p.zip!;
    const x1 = z.x, y1 = z.y, x2 = z.x2!, y2 = z.y2!;
    p.zipV = Math.max(p.zipV, 560); p.x += p.zipV * dt;
    const t = clamp((p.x + 11 - x1) / (x2 - x1), 0, 1);
    p.y = y1 + (y2 - y1) * t + 2; p.vx = p.zipV; p.vy = 0; p.ground = null; p.run += dt * 8;
    if (Math.random() < 0.6) this.burst(p.x + 11, p.y, 1, '#ffd23f', 120, 0.3, 2, 100);
    if (p.jbuf > 0 || p.x + 11 >= x2) {
      p.zip = null; p.zipCd = 0.5; p.vy = -460; p.jbuf = 0; p.airHop = 1; p.jumpCut = true; this.stunt('ZIPLINE', 2, 90, 6); audio.sfx('hop');
    }
  }

  movePlayer(dt: number) {
    const p = this.p, st = this.st;
    const heavy = this.pkgKind === 'heavy';
    const jumpHeld = this.heldAct('jump'), slideHeld = this.heldAct('slide');
    const nobrake = this.mods.has('nobrake');
    const brake = this.heldAct('brake') && !nobrake;
    if (p.ground && (p.ground.dx || p.ground.dy)) { p.x += p.ground.dx; p.y += p.ground.dy; }
    // momentum & target speed
    const top = BASE_SPEED * (1 + 0.5 * p.mom / 100) * st.speedMul * st.topMul * (heavy ? 0.9 : 1);
    p.top = top;
    let target = top;
    if (this.ended) target = 0; else if (p.stun > 0) target = 70; else if (brake) target = top * 0.42;
    if (!this.ended && !p.stun && p.ground && p.vx > top * 0.9 && !p.sliding) p.mom += 7 * dt;
    if (brake) p.mom -= 30 * dt;
    if (p.vx < top * 0.6 && !this.ended) p.mom -= 9 * dt * st.momDecay;
    p.mom = clamp(p.mom, 0, 100);
    // slide state
    if (p.sliding) {
      if (!p.ground || p.slideT <= 0 || (!slideHeld && p.slideT < 0.55)) this.endSlide();
      else { p.vx = Math.max(220, p.vx - 80 * dt); if (Math.random() < 0.5) this.burst(p.x, p.y + p.h, 1, '#ffb', 90, 0.25, 2, 200, false); }
    }
    // dash
    if (p.dashT > 0) {
      p.dashT -= dt; p.vy = 0; p.vx = p.dashV; p.vy = 0;
      if (Math.random() < 0.9) this.burst(p.x, p.y + p.h / 2, 1, '#28e0ff', 60, 0.3, 4, 0, true);
      if (p.dashT <= 0) p.vx = Math.max(top * 1.05, p.dashV * 0.65);
    } else if (p.wr > 0) {
      p.wr -= dt; p.wrAge += dt; p.vy = -p.wrVy; p.vx = 90;
      if (Math.random() < 0.7) this.burst(p.x + 22, p.y + p.h, 1, '#ffd', 100, 0.25, 2, 200, false);
      if (!jumpHeld || p.wr <= 0) { p.wr = 0; p.vx = -130; p.vy = -380; p.wrCool = 0.35; this.floatText('KICK', p.x, p.y, '#fff', 12); }
    } else if (!p.sliding) {
      const acc = p.ground ? 1100 : 450;
      if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt);
      else p.vx = Math.max(target, p.vx - (p.ground ? 1500 : 260) * dt);
    }
    // jumping
    if (p.ground) { p.coyote = 0.1; p.airT = 0; } else p.airT += dt;
    if (p.jbuf > 0 && !this.ended) {
      if (p.coyote > 0 && p.stun < 0.2) {
        if (!p.sliding || this.endSlide()) {
          p.vy = -JUMP_V * st.jumpMul * (heavy ? 0.88 : 1); p.ground = null; p.coyote = 0; p.jbuf = 0; p.jumpCut = false;
          audio.sfx('jump'); this.burst(p.x + 11, p.y + p.h, 6, '#bbc', 120, 0.3, 2, 300, false);
        }
      } else if (p.airHop > 0 && st.airHop && !p.ground && p.wr <= 0 && p.dashT <= 0) {
        p.vy = -JUMP_V * 0.85 * st.jumpMul; p.airHop--; p.jbuf = 0; p.jumpCut = false; audio.sfx('hop');
        this.burst(p.x + 11, p.y + p.h, 12, '#9ad7ff', 160, 0.4, 3, 100, true); this.floatText('HOP', p.x, p.y, '#9ad7ff', 12);
      }
    }
    if (!jumpHeld && p.vy < -330 && !p.jumpCut && p.wr <= 0) { p.vy *= 0.5; p.jumpCut = true; }
    if (p.dashT <= 0 && p.wr <= 0) { p.vy += GRAV * dt; if (slideHeld && !p.ground && !p.sliding) p.vy += 2200 * dt; }
    p.vy = Math.min(p.vy, 1600);
    // zipline attach
    if (p.zipCd <= 0 && !p.ground && jumpHeld) {
      for (const e of this.ents) {
        if (e.t !== 'zip' || e.dead || Math.abs(e.x - p.x) > 700) continue;
        const hx = p.x + 11; if (hx < e.x || hx > e.x2!) continue;
        const ly = e.y + (e.y2! - e.y) * ((hx - e.x) / (e.x2! - e.x));
        if (Math.abs(p.y + 4 - ly) < 30) { p.zip = e; p.jbuf = 0; p.zipV = Math.max(p.vx, 560); p.wr = 0; p.dashT = 0; this.floatText('ZIP!', p.x, p.y - 10, '#ffd23f', 14); audio.sfx('wall'); return; }
      }
    }
    // ---- X move ----
    p.wallTouch = false;
    p.x += p.vx * dt;
    for (const s of this.near) {
      if (!ov(p, s) || (p.vaultS === s && p.vaultT > 0)) continue;
      if (p.y + p.h <= s.y + 0.6 || p.y >= s.y + s.h - 0.6) continue;
      if (s.kind === 'train' || s.kind === 'crane') { const rise = p.y + p.h - s.y; if (rise > 0 && rise <= 14) { p.y = s.y - p.h; continue; } }
      if (p.vx >= 0) {
        const rise = p.y + p.h - s.y;
        if (s.kind === 'plat' && rise > 0 && rise <= 36 && p.vy >= -50) { p.y = s.y - p.h; if (p.vy > 0) p.vy = 0; continue; }
        const v = p.vx; p.x = s.x - p.w; this.onWall(s, v, jumpHeld);
      } else { p.x = s.x + s.w; p.vx = 0; }
    }
    if (p.wr > 0 && !p.wallTouch && p.wrAge > 0.08) {
      p.wr = 0; p.vx = Math.max(p.top * 0.9, 320); p.vy = -330; p.wrCool = 0.25; this.floatText('MANTLE', p.x, p.y - 10, '#fff', 13);
    }
    // ---- Y move ----
    const prevBottom = p.y + p.h, prevTop = p.y;
    p.y += p.vy * dt;
    const wasGround = p.ground; p.ground = null;
    for (const s of this.near) {
      if (!ov(p, s)) continue;
      const tol = 8 + Math.abs(s.dy) + Math.abs(p.vy * dt);
      if (p.vy >= 0 && prevBottom <= s.y + tol) {
        const impact = p.vy; p.y = s.y - p.h; p.ground = s; p.vy = 0;
        if (!wasGround) this.onLand(impact);
      } else if (p.vy < 0 && prevTop >= s.y + s.h - 8) { p.y = s.y + s.h; p.vy = 0; if (p.wr <= 0) p.jumpCut = true; }
    }
    if (p.ground) { p.run += p.vx * dt * 0.02; p.airHop = 1; } else p.run += p.vx * dt * 0.006;
    // trail
    this.ghostT -= dt;
    if (this.ghostT <= 0 && (p.mom > 60 || p.dashT > 0)) { this.ghostT = 0.035; this.ghosts.push({ x: p.x, y: p.y, h: p.h, t: 0.3 }); if (this.ghosts.length > 10) this.ghosts.shift(); }
    if (p.ground && p.vx > 500 && Math.random() < 0.4) this.burst(p.x + 4, p.y + p.h, 1, '#99a', 60, 0.3, 2, 100, false);
  }

  onWall(s: Solid, v: number, jumpHeld: boolean) {
    const p = this.p;
    if (p.wr > 0) { p.wallTouch = true; return; }
    if (s.kind === 'crate' && p.ground && v > 280 && p.stun <= 0) {
      p.vaultS = s; p.vaultT = 0.3; p.vy = -540; p.ground = null; p.coyote = 0; p.jumpCut = true; this.stunt('VAULT', 1, 40, 3); audio.sfx('vault'); this.burst(p.x + 20, p.y + p.h, 6, '#cbd', 140, 0.3, 2); return;
    }
    if (s.kind !== 'crate' && s.kind !== 'ceil' && jumpHeld && p.stun <= 0 && p.wrCool <= 0 && !this.ended) {
      if (p.sliding && !this.endSlide()) return;
      p.wr = this.st.wallTime; p.wrAge = 0; p.wrVy = Math.min(640, 320 + Math.max(v, 300) * 0.5); p.vx = 90; p.wallTouch = true; p.jbuf = 0; p.airHop = 1;
      this.stunt('WALL RUN', 2, 70, 4); audio.sfx('wall'); this.addShake(2); return;
    }
    if (p.bonkCd <= 0) {
      const dmg = clamp((v - 260) * 0.035, 2, 18);
      p.bonkCd = 0.6; this.hurt(dmg, 'A crash', 0.35); this.addShake(6);
      this.burst(p.x + 22, p.y + 20, 10, '#fff', 200, 0.4, 3);
      this.floatText('CRASH', p.x, p.y - 8, '#ff8899', 14);
    }
    p.vx = -70; p.mom = Math.max(0, p.mom * 0.5);
  }

  onLand(impact: number) {
    const p = this.p;
    if (impact > 480) { audio.sfx('land', impact / 900); this.burst(p.x + 11, p.y + p.h, Math.min(14, impact / 120), '#aab', 160, 0.4, 2.5, 300, false); }
    const rolled = p.rollBuf > 0 || this.heldAct('slide');
    if (impact > 740) {
      if (rolled) { this.stunt('ROLL', 1, 60, 5); audio.sfx('roll'); if (p.vx > 150) this.startSlide(0.45); }
      else {
        const dmg = (impact - 740) * (this.pkgKind === 'fragile' ? 0.04 : 0.02);
        if (dmg > 1) { this.hurt(dmg, 'A hard landing', 0, true); p.vx *= 0.85; }
        this.addShake(Math.min(10, impact / 200));
      }
    }
    p.airHop = 1; p.jumpCut = false;
    if (p.airT > 1.05) this.stunt('AIR TIME', 1, 50, 2);
    p.airT = 0;
  }

  // ===== entities =====
  updateEnts(dt: number) {
    const p = this.p;
    this.nearTerm = null; let nd = 1e9;
    const pr: R = p;
    for (const e of this.ents) {
      if (e.dead) continue;
      if (e.t !== 'zip' && Math.abs(e.x - p.x) > 1900) continue;
      if (e.off && e.off > 0) e.off -= dt;
      if (e.hit && e.hit > 0) e.hit -= dt;
      const off = !!e.dis || (e.off ?? 0) > 0;
      switch (e.t) {
        case 'hint': if (!e.used && p.x > e.x) { e.used = true; this.hintText = e.text || ''; this.hintT = 11; audio.sfx('ui'); if (e.act === 'heat') this.addHeat(1.3); } break;
        case 'gate': if (!e.used && p.x > e.x) { e.used = true; this.legIdx = e.seg; if (!this.tutorial) { this.banner(`LEG ${e.seg + 1} / ${this.cfg.contract.legs}`, e.text || '', DISTRICTS[this.cfg.contract.district].pal.accent); audio.sfx('gate'); } } break;
        case 'chip': {
          const dx = p.x + 11 - e.x, dy = p.y + p.h / 2 - e.y;
          if (dx * dx + dy * dy < 1200) {
            e.dead = true; this.chips++; this.chipCash += this.chipVal; this.chipChain++; this.chipT = 0.8; this.score += 10 * this.comboMult();
            audio.sfx('chip', this.chipChain); this.burst(e.x, e.y, 4, '#ffe04a', 120, 0.4, 2, 0);
            if (this.chipChain % 5 === 0) this.floatText(`+¤${this.chipVal * 5}`, e.x, e.y - 14, '#ffe04a', 13);
          }
          break;
        }
        case 'vent':
          if (e.cd! > 0) e.cd! -= dt;
          if (e.cd! <= 0 && p.x + 11 > e.x - 27 && p.x + 11 < e.x + 27 && p.y + p.h >= e.y - 6 && p.y + p.h <= e.y + 40 && !p.zip) {
            p.vy = -1100; p.ground = null; p.jumpCut = true; p.airHop = 1; e.cd = 0.5; this.stunt('VENT', 1, 40, 3); audio.sfx('vent'); this.burst(e.x, e.y, 16, '#dff', 240, 0.6, 4, -200, false);
            if (p.sliding) this.endSlide();
          }
          break;
        case 'trip':
          if (!off && ov(pr, { x: e.x - 4, y: e.y - 42, w: 8, h: 16 }) && p.dashT <= 0) {
            e.dead = true; this.addHeat(0.6); this.seenT = 2.5; this.hurt(4, 'A tripwire', 0, true); this.floatText('ALARM!', e.x, e.y - 50, '#ff3355', 16); audio.sfx('alarm');
            this.burst(e.x, e.y - 34, 10, '#ff3355', 200, 0.5, 3);
          }
          break;
        case 'laser': {
          const per = e.per!, ph = (this.t + e.ph!) % per, offD = per * (1 - e.on!);
          const on = ph >= offD; e.state = on ? 1 : ph > offD - 0.35 ? 2 : 0;
          if (on && !off && ov(pr, { x: e.x - 5, y: e.y - e.h, w: 10, h: e.h }) && p.dashT <= 0 && (e.hit ?? 0) <= 0) {
            e.hit = 0.8; this.hurt(10, 'A laser gate', 0.45); this.addHeat(0.5); this.seenT = 2.5; audio.sfx('laser'); this.burst(e.x, p.y + 20, 14, '#ff3355', 280, 0.5, 3);
          }
          break;
        }
        case 'turret': {
          const dx = e.x - p.x; e.state = 0;
          if (!off && dx < 850 && dx > -80) {
            e.cd! -= dt; if (e.cd! < 0.5) e.state = 1;
            if (e.cd! <= 0.5 && e.cd! + dt > 0.5) audio.sfx('telegraph');
            if (e.cd! <= 0) { e.cd = 2.1; this.fireBolt(e.x, e.y - 6, 560, 8); }
          }
          break;
        }
        case 'drone': this.updateDrone(e, dt, off); break;
        case 'walker': this.updateWalker(e, dt, off); break;
        case 'term': {
          const d = Math.abs(p.x + 11 - e.x);
          const inRange = e.kind === 'master' ? p.x > e.x - 900 : d < 130;
          if (!e.used && inRange && d < nd) { nd = d; this.nearTerm = e; }
          if (e.lock && e.lock > 0) e.lock -= dt;
          break;
        }
        default: break;
      }
    }
  }
  fireBolt(x: number, y: number, speed: number, dmg: number) {
    const p = this.p;
    const tx = p.x + 11 + p.vx * 0.38, ty = p.y + p.h / 2;
    const dx = tx - x, dy = ty - y, l = Math.hypot(dx, dy) || 1;
    this.bolts.push({ x, y, vx: dx / l * speed, vy: dy / l * speed, life: 3, dmg }); audio.sfx('bolt');
  }
  updateDrone(e: Ent, dt: number, off: boolean) {
    const p = this.p;
    if (off) { e.y += 40 * dt; return; }
    if (e.chase) {
      const tx = p.x + 240 + Math.sin(this.t * 1.3 + e.ph!) * 80, ty = p.y - 170 + Math.sin(this.t * 2 + e.ph!) * 25;
      e.x += (tx - e.x) * Math.min(1, dt * 3); e.y += (ty - e.y) * Math.min(1, dt * 3);
    } else { e.x = e.hx! + Math.sin(this.t * 0.8 + e.ph!) * 140; e.y = e.hy! + Math.sin(this.t * 1.7 + e.ph!) * 16; }
    const dy = p.y - e.y, dxp = p.x + 11 - e.x;
    if (dy > 0 && dy < 340 && Math.abs(dxp) < 40 + dy * 0.28 && !this.ended) {
      e.scan = (e.scan ?? 0) + dt; this.seenT = 2.5; this.addHeat(0.3 * dt);
      if (this.pkgKind === 'data') this.dot(5 * dt);
      if (e.scan > 0.5 && !e.used) { e.used = true; this.floatText('SCANNED', e.x, e.y + 30, '#ff3355', 15); audio.sfx('alarm'); this.addHeat(0.25); }
    } else e.scan = Math.max(0, (e.scan ?? 0) - dt * 2);
    if ((this.heat >= 2 || e.chase) && Math.abs(e.x - p.x) < 800) {
      e.cd! -= dt;
      if (e.cd! <= 0) { e.cd = 2.4; this.fireBolt(e.x, e.y + 8, 480, 7); }
    }
    if (ov(p, { x: e.x - 16, y: e.y - 8, w: 32, h: 16 })) {
      if (p.dashT > 0 || (p.vy > 200 && p.y + p.h < e.y + 10)) {
        e.dead = true; this.takedowns++; if (p.vy > 200) { p.vy = -560; p.airHop = 1; }
        this.stunt('DRONE DOWN', 2, 120, 5); this.burst(e.x, e.y, 20, '#ff7a3a', 280, 0.7, 3); audio.sfx('boom'); this.addShake(4);
      } else this.hurt(6, 'A drone', 0.2);
    }
  }
  updateWalker(e: Ent, dt: number, off: boolean) {
    const p = this.p;
    const ped = e.kind === 'ped', hunter = e.kind === 'hunter';
    const sp = ped ? 55 : hunter ? 400 : 250;
    if (e.state === 0) {
      if (ped) { e.x += e.dir! * 45 * dt; if (e.x <= e.min!) e.dir = 1; if (e.x >= e.max!) e.dir = -1; }
      else if (!off && e.x - p.x < 640 && e.x - p.x > -120) { e.state = 1; this.seenT = 2.5; this.addHeat(hunter ? 0.5 : 0.3); this.floatText('!', e.x, e.y - 60, '#ff3355', 22); audio.sfx('warn'); }
    } else if (e.state === 1) {
      if (!off) { const d = Math.sign(p.x - e.x) || -1; e.dir = d; e.x = clamp(e.x + d * sp * dt, e.min!, e.max!); this.seenT = Math.max(this.seenT, 1); }
    } else if (e.state === 2) {
      e.tm = (e.tm ?? 0) - dt; if (e.tm <= 0) { e.dead = true; return; }
    }
    if (e.state! >= 2) return;
    const box = { x: e.x - 11, y: e.y - 46, w: 22, h: 46 };
    if (!ov(p, box)) return;
    if (ped) {
      if (p.sliding || p.dashT > 0) { e.state = 2; e.tm = 1.2; this.stunt('CROWD CONTROL', 1, 30, 2); audio.sfx('tackle'); }
      else if (!(p.vy > 150 && p.y + p.h < e.y - 30)) { e.state = 2; e.tm = 1.2; p.vx *= 0.72; p.mom = Math.max(0, p.mom - 8); this.addHeat(0.12); this.floatText('BUMP', e.x, e.y - 50, '#fff', 12); audio.sfx('tackle'); }
      return;
    }
    if (p.vy > 150 && p.y + p.h <= box.y + 22 && !p.sliding) {
      p.vy = -640; p.airHop = 1; e.state = 2; e.tm = 2; this.takedowns++; this.stunt('STOMP', 2, 100, 8); audio.sfx('stomp'); this.burst(e.x, e.y - 40, 10, '#4aa3ff', 220, 0.5, 3);
    } else if (p.sliding || p.dashT > 0) {
      e.state = 2; e.tm = 2; this.takedowns++; this.stunt('TACKLE', 1, 70, 4); audio.sfx('tackle'); this.addShake(3); this.burst(e.x, e.y - 20, 10, '#fff', 260, 0.4, 3);
    } else if (p.inv <= 0) {
      if (this.hurt(hunter ? 12 : 9, hunter ? 'A faction hunter' : 'A Sentinel', 0.5)) { e.state = 2; e.tm = 1; this.addHeat(0.2); this.seenT = 2.5; }
    }
  }
  updateBolts(dt: number) {
    const p = this.p;
    for (const b of this.bolts) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life > 0 && Math.abs(b.x - (p.x + 11)) < 14 && Math.abs(b.y - (p.y + p.h / 2)) < p.h / 2 + 4 && p.dashT <= 0 && p.inv <= 0) {
        b.life = 0; this.hurt(b.dmg, 'A bolt', 0.25); this.addHeat(0.12); this.burst(b.x, b.y, 8, '#ff7a3a', 200, 0.4, 3);
      }
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }

  // ===== pursuit, heat, director =====
  updatePursuit(dt: number) {
    const p = this.p;
    if (this.seenT > 0) this.seenT -= dt;
    else if (!(this.pack.active && p.x - this.pack.x < 450)) this.heat = Math.max(this.boss && this.boss.hp > 0 ? 3 : 0, this.heat - 0.06 * this.st.coolMul * dt);
    const stars = Math.floor(this.heat);
    if (stars < this.lastStars) this.lastStars = stars;
    if (!this.pack.active && this.heat >= 1 && !this.ended && !(this.boss && this.boss.hp <= 0)) {
      this.pack.active = true; this.pack.x = p.x - 1000; this.toast('Sentinel pack in pursuit! Keep moving.', '#ff3355');
    }
    if (!this.pack.active) return;
    this.pack.pulse += dt;
    const notoF = this.cfg.save.notoriety >= 70 ? 1.08 : 1;
    const sp = this.boss ? 340 + this.boss.phase * 30 : 210 + Math.min(5, stars) * 90 + this.cfg.contract.district * 12;
    this.pack.x += sp * this.diff.pack * notoF * dt;
    const gap = p.x - this.pack.x;
    if (gap < 30 && !this.ended) this.endRun('busted', this.boss ? 'The Warden crushed you.' : 'Caught by the Sentinel pack.');
    if (this.heat < 0.35 && !this.boss && gap > 1100) { this.pack.active = false; this.toast('You lost them.', '#42ffa8'); }
    if (gap < 380 && Math.random() < dt * 1.5) audio.sfx('warn');
  }
  spawnDrone() {
    const p = this.p;
    this.ents.push({ t: 'drone', x: p.x + 700, y: p.y - 250, w: 0, h: 0, seg: 0, chase: true, ph: Math.random() * 6, cd: 1.5, hp: 1, hx: 0, hy: 0 });
  }
  updateDirector(dt: number) {
    if (this.tutorial || this.ended) return;
    this.dirT -= dt; if (this.dirT > 0) return;
    this.dirT = 2.2;
    const p = this.p, stars = Math.floor(this.heat);
    const chasers = this.ents.filter((e) => e.t === 'drone' && e.chase && !e.dead).length;
    if (stars >= 2 && chasers < Math.min(3, stars - 1)) this.spawnDrone();
    if (stars >= 3 && Math.random() < 0.5) {
      const x = p.x + 1300, g = this.groundAt(x);
      if (g && g.w > 300 && g.x + g.w - x > 160) this.ents.push({ t: 'walker', x, y: g.y, w: 0, h: 0, seg: 0, kind: 'cop', min: Math.max(g.x + 20, x - 300), max: g.x + g.w - 40, state: 0, dir: -1 });
    }
    if (stars >= 4 && this.t - this.lastBlock > 8) {
      const x = p.x + 1500, g = this.groundAt(x);
      if (g && g.x + g.w - x > 260 && x - g.x > 200) {
        this.lastBlock = this.t;
        const s: Solid = { x, y: g.y - 150, w: 40, h: 150, kind: 'wall', ox: x, oy: g.y - 150, ax: 0, ay: 0, per: 1, ph: 0, dx: 0, dy: 0, seg: 0, block: true };
        this.solids.push(s); this.toast('ROADBLOCK ahead — wall-run it!', '#ff3355');
      }
    }
  }
  updateBoss(dt: number) {
    const b = this.boss; if (!b) return;
    b.flash = Math.max(0, b.flash - dt * 2);
    for (const m of this.marks) {
      if (m.dead) continue;
      m.t += dt;
      if (m.kind === 'missile' && m.t >= m.max) {
        m.dead = true; const p = this.p;
        if (Math.abs(p.x + 11 - m.x) < 85 && p.y + p.h > m.y - 150) this.hurt(14, 'A Warden missile', 0.4);
        this.burst(m.x, m.y - 20, 26, '#ff7a3a', 380, 0.8, 4); audio.sfx('boom'); this.addShake(8);
      } else if (m.kind === 'wave') {
        m.x += m.vx * dt; const g = this.groundAt(m.x), p = this.p;
        if (g && Math.abs(p.x + 11 - m.x) < 26 && p.y + p.h > g.y - 36) { m.dead = true; this.hurt(12, 'A shockwave', 0.4); }
        if (m.x > p.x + 500) m.dead = true;
      }
    }
    this.marks = this.marks.filter((m) => !m.dead);
    if (b.hp <= 0 || this.ended) return;
    const phase = b.hp > 66 ? 1 : b.hp > 33 ? 2 : 3;
    if (phase !== b.phase) { b.phase = phase; this.banner(`WARDEN — PHASE ${phase}`, phase === 2 ? 'Shockwaves incoming' : 'Drone swarm and barrage', '#ff3355'); audio.sfx('phase'); this.addShake(16); }
    b.atkT -= dt;
    if (b.atkT <= 0) {
      b.atkT = phase === 1 ? 4.5 : phase === 2 ? 3.6 : 2.9; const n = phase === 3 ? 4 : 3, p = this.p;
      for (let i = 0; i < n; i++) {
        const x = p.x + p.vx * 1.25 + i * 150 + 100, g = this.groundAt(x);
        if (g) this.marks.push({ kind: 'missile', x, y: g.y, t: 0, max: 1.15, vx: 0, dead: false });
      }
      audio.sfx('warn');
    }
    b.waveT -= dt;
    if (phase >= 2 && b.waveT <= 0) {
      b.waveT = phase === 2 ? 6.5 : 5;
      this.marks.push({ kind: 'wave', x: this.pack.x + 120, y: 0, t: 0, max: 0, vx: this.p.vx + 320, dead: false });
      this.toast('SHOCKWAVE from behind — JUMP when it reaches you!', '#ff3355'); audio.sfx('warn');
    }
    b.droneT -= dt;
    if (phase >= 3 && b.droneT <= 0) { b.droneT = 6; if (this.ents.filter((e) => e.t === 'drone' && e.chase && !e.dead).length < 3) this.spawnDrone(); }
  }
  updatePackage(dt: number) {
    const p = this.p, c = this.cfg.contract;
    if (this.ended) return;
    if (this.pkgKind === 'live') this.dot((0.55 + c.district * 0.07) * dt);
    if (this.pkgKind === 'volatile') {
      this.core += (p.vx > 650 ? 22 : -16) * dt - (p.sliding ? 25 * dt : 0);
      this.core = clamp(this.core, 0, 100);
      if (!this.overheated && this.core >= 100) { this.overheated = true; this.banner('CORE OVERHEAT', 'Slow down or slide to vent!', '#ffb02e'); audio.sfx('alarm'); }
      if (this.overheated) { this.dot(7 * dt); if (this.core < 55) this.overheated = false; }
    }
    if (this.st.regen > 0 && this.integrity < 100) this.integrity = Math.min(100, this.integrity + this.st.regen * dt);
  }

  // ===== fx / camera =====
  fx(sdt: number, dt: number) {
    for (const q of this.parts) { q.vy += q.g * sdt; q.x += q.vx * sdt; q.y += q.vy * sdt; q.life -= sdt; }
    this.parts = this.parts.filter((q) => q.life > 0);
    for (const t of this.texts) { t.y -= 40 * dt; t.life -= dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const g of this.ghosts) g.t -= dt;
    this.ghosts = this.ghosts.filter((g) => g.t > 0);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    this.shake *= Math.pow(0.02, dt); this.flash = Math.max(0, this.flash - dt * 1.5);
    this.empFx = Math.max(0, this.empFx - dt); this.smokeFx = Math.max(0, this.smokeFx - dt);
    if (this.bn) { this.bn.t -= dt; if (this.bn.t <= 0) this.bn = null; }
    if (this.hintT > 0) this.hintT -= dt;
    const rainN = this.cfg.settings.particles === 'low' ? 1 : 3;
    for (let i = 0; i < rainN && this.parts.length < 600; i++) {
      this.parts.push({ x: this.cam.x + Math.random() * (this.vw + 200), y: this.cam.y - 20 + Math.random() * 80, vx: -80, vy: 900 + Math.random() * 300, life: 0.9, max: 0.9, size: 1.2, color: '#9ab', g: 0, glow: false });
    }
  }
  camUpdate(dt: number) {
    const p = this.p, c = this.cam;
    const sr = clamp(p.vx / 800, 0, 1.2);
    const tz = (this.hack ? 1.12 : 1) * (1 - 0.14 * sr);
    c.zoom += (tz - c.zoom) * Math.min(1, dt * 2.5);
    this.scale = (this.ch / 720) * c.zoom;
    this.vw = this.cw / this.scale; this.vh = this.ch / this.scale;
    const tx = p.x - this.vw * 0.3 + p.vx * 0.12;
    c.x += (tx - c.x) * Math.min(1, dt * 7);
    c.fy += (p.y - c.fy) * Math.min(1, dt * 2.4);
    c.y += (c.fy - this.vh * 0.6 - c.y) * Math.min(1, dt * 6);
  }
}
