import { CREATURES, DIFFS, ESCORTS, FRONT_INFO, GOODS, GOOD_IDS, REGIONS, clamp, pick, rnd, rndi } from "./data";
import type { CreatureDef, CreatureId, EscortKind, FrontKind, GoodId } from "./data";
import { audio } from "./audio";
import { shipStats } from "./state";
import type { Campaign, Settings, SortieResult } from "./state";

const WW = 8000, WH = 1800, FLOOR = 1600, CEIL = 80;

export interface SortieParams {
  camp: Campaign; apex: boolean; ambush: boolean; tutorial: boolean; settings: Settings;
  onEnd: (r: SortieResult) => void; onPause: () => void; onMute: () => void; onTutorialDone: () => void;
}

interface Creature {
  id: number; def: CreatureDef; type: CreatureId; x: number; y: number; vx: number; vy: number;
  hp: number; maxHp: number; stam: number; maxStam: number; r: number; face: number; t: number;
  hooks: number; exhausted: number; tagged: number; state: "idle" | "wind" | "dash" | "recover"; st: number;
  dx: number; dy: number; cd: number; act: string; wanderA: number; wanderT: number; flash: number;
  dead: boolean; boss: boolean; minion: boolean; tame: boolean; strain: number; shootCd: number; side: number; hitCd: number;
}
interface Harpoon {
  id: number; state: "fly" | "hooked" | "back"; x: number; y: number; vx: number; vy: number; power: number;
  target: Creature | null; ox: number; oy: number; L: number; T: number; over: number; trail: { x: number; y: number }[];
}
interface Bullet { x: number; y: number; vx: number; vy: number; dmg: number; life: number; r: number; friendly: boolean; kind: "ball" | "orb" }
interface Pickup { x: number; y: number; vx: number; vy: number; good: GoodId | null; crowns: number; life: number; bob: number }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string; grav: number; kind: 0 | 1 | 2 }
interface Floater { x: number; y: number; vy: number; text: string; life: number; max: number; color: string; size: number }
interface Strike { x: number; y: number; t: number; delay: number; dmg: number; r: number }
interface Front { kind: FrontKind; x: number; w: number; vx: number; dir: number; str: number }
interface EscortE {
  id: number; kind: EscortKind; hp: number; maxHp: number; x: number; y: number; vx: number; vy: number; cd: number;
  target: Creature | null; slot: number; dead: boolean; phase: number;
}
interface Cloud { x: number; y: number; s: number; a: number }

const hyp = Math.hypot;
const smooth = (f: number) => f * f * (3 - 2 * f);

export class Sortie {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private p: SortieParams;
  private raf = 0;
  private last = 0;
  private destroyed = false;
  private ended = false;
  paused = false;

  private W = 800; private H = 600; private dpr = 1; private scale = 1;
  private cam = { x: 0, y: 700 };
  private shakeAmp = 0; private hitstop = 0; private flash = 0; private time = 0;

  private stats: ReturnType<typeof shipStats>;
  private diff = DIFFS[1];
  private region = REGIONS[0];
  private ship = { x: 1200, y: 760, vx: 0, vy: 0, hp: 100, maxHp: 100, fuel: 100, face: 1, iframes: 0, hurtT: 0, tilt: 0, prop: 0, aim: 0 };
  private cargo: Record<GoodId, number>;
  private gained: Record<GoodId, number>;
  private crowns = 0; private kills: Record<string, number> = {};
  private creatures: Creature[] = []; private harpoons: Harpoon[] = []; private bullets: Bullet[] = [];
  private pickups: Pickup[] = []; private parts: Particle[] = []; private floaters: Floater[] = []; private strikes: Strike[] = [];
  private fronts: Front[] = []; private escorts: EscortE[] = [];
  private clouds: Cloud[][] = [[], [], []]; private islands: { x: number; y: number; w: number; h: number }[] = [];
  private stars: { x: number; y: number; s: number }[] = [];
  private nid = 1;

  private wx = { storm: 0, fog: 0, gale: 0, aurora: 0, wind: 0 };
  private gust = { t: 0, dir: 1 };
  private stormT = 3; private spawnT = 6; private apexT = -1; private apexSlain: CreatureId | null = null; private endT = -1;
  private wrecked = false; private adriftT = -1; private returnT = 0; private lowFuelWarned = false;

  // input
  private keys: Record<string, boolean> = {};
  private mx = 0; private my = 0; private mouseDown = false; private rightDown = false;
  private charge = 0; private charging = false; private reload = 0;
  private padAim: { x: number; y: number } | null = null; private padFire = false; private padPrev = { start: false };
  private touchUI = false;
  private touches = new Map<number, string>();
  private joy = { ox: 0, oy: 0, x: 0, y: 0, active: false, id: -1 };
  private touchReel = false; private touchBoost = false; private touchReturn = false;

  // run stats
  private nHarpoons = 0; private nHits = 0; private nBull = 0; private nSnaps = 0; private damage = 0; private lost = 0; private pickedCount = 0; private hooksMade = 0; private moved = 0;
  private reelClickT = 0; private chargeTickT = 0; private lanceT = 0; private musicT = 0;
  private banners: { text: string; color: string; t: number; max: number }[] = [];
  private tut = 0; private tutT = 0; private tutDone = false;
  private hintT = 22;
  private cannonCd = 0;

  constructor(canvas: HTMLCanvasElement, params: SortieParams) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.p = params;
    const c = params.camp;
    this.stats = shipStats(c);
    this.diff = DIFFS[c.diff];
    this.region = REGIONS[c.loc];
    this.ship.hp = Math.min(c.hull, this.stats.maxHp); this.ship.maxHp = this.stats.maxHp; this.ship.fuel = Math.min(c.fuel, this.stats.maxFuel);
    this.cargo = { ...c.cargo };
    this.gained = { oil: 0, bone: 0, amber: 0, gel: 0, hide: 0, spice: 0, ore: 0, silk: 0 };
    this.touchUI = typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    this.buildWorld();
    this.populate();
    c.escorts.filter((e) => e.hp > 0).forEach((e, i) => {
      this.escorts.push({ id: e.id, kind: e.kind, hp: e.hp, maxHp: ESCORTS[e.kind].hp, x: this.ship.x - 100 * (i + 1), y: this.ship.y, vx: 0, vy: 0, cd: rnd(1, 3), target: null, slot: i, dead: false, phase: 0 });
    });
    this.resize();
    this.cam.x = clamp(this.ship.x - this.W / this.scale / 2, 0, WW);
    this.cam.y = clamp(this.ship.y - this.H / this.scale / 2, 0, WH);
    this.mx = this.W * 0.72; this.my = this.H * 0.4;
    this.bindEvents();
    audio.init(); audio.startFlight(); audio.setMode("sortie");
    this.banner(`${this.region.name}`, "#ffe9a8", 3);
    if (params.apex) this.banner("APEX HUNT", "#ff8a7a", 3);
  }

  // ---------------- setup ----------------
  private buildWorld() {
    const R = (a: number, b: number) => rnd(a, b);
    [0.3, 0.55, 0.85].forEach((d, i) => {
      const n = [26, 34, 30][i];
      for (let k = 0; k < n; k++) this.clouds[i].push({ x: R(-200, d * WW + 2600), y: R(-100, 900 + d * WH), s: R(60, 160) * (0.7 + d), a: R(0.12, 0.35) * (i === 2 ? 0.7 : 1) });
    });
    for (let k = 0; k < 14; k++) this.islands.push({ x: R(0, 0.2 * WW + 2400), y: R(300, 800 + 0.2 * WH), w: R(120, 420), h: R(60, 180) });
    for (let k = 0; k < 90; k++) this.stars.push({ x: Math.random(), y: Math.random(), s: R(0.6, 2) });
    const fc = this.p.camp.regions[this.p.camp.loc].forecast;
    fc.forEach((kind) => {
      const n = 1 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        let x = R(1500, WW - 800);
        if (Math.abs(x - this.ship.x) < 700) x += 1400;
        this.fronts.push({ kind, x: clamp(x, 800, WW - 400), w: R(1400, 2300), vx: R(-16, 16), dir: Math.random() < 0.5 ? -1 : 1, str: R(220, 330) });
      }
    });
  }

  private populate() {
    const c = this.p.camp;
    const reg = c.regions[c.loc];
    const n = this.p.apex ? 3 : 5 + Math.round((reg.pop / 100) * 8);
    for (let i = 0; i < n; i++) this.spawnAmbient(true);
    if (this.p.tutorial) {
      const d = this.spawn("drifter", this.ship.x + 560, this.ship.y - 30);
      d.tame = true;
    }
    if (this.p.apex) {
      this.spawnApex(clamp(this.ship.x + 1500, 400, WW - 400), 700);
    } else if (this.p.ambush) {
      this.apexT = 70;
    }
  }

  private spawnAmbient(initial = false) {
    const table = this.region.spawn;
    const tot = table.reduce((a, b) => a + b[1], 0);
    let r = Math.random() * tot; let type: CreatureId = table[0][0];
    for (const [t, w] of table) { r -= w; if (r <= 0) { type = t; break; } }
    const def = CREATURES[type];
    let x = 0;
    for (let tries = 0; tries < 12; tries++) {
      x = rnd(300, WW - 300);
      if (Math.abs(x - this.ship.x) > (initial ? 800 : 1100)) break;
    }
    const y = rnd(def.alt[0], def.alt[1]);
    return this.spawn(type, x, y);
  }

  private spawn(type: CreatureId, x: number, y: number): Creature {
    const def = CREATURES[type];
    const hpMul = this.diff.hp * (1 + 0.05 * this.p.camp.loc);
    const c: Creature = {
      id: this.nid++, def, type, x, y, vx: 0, vy: 0, hp: def.hp * hpMul, maxHp: def.hp * hpMul, stam: def.stam, maxStam: def.stam, r: def.r,
      face: Math.random() < 0.5 ? 1 : -1, t: Math.random() * 10, hooks: 0, exhausted: 0, tagged: 0, state: "idle", st: 0, dx: 1, dy: 0,
      cd: rnd(2, 4), act: "", wanderA: 0, wanderT: 0, flash: 0, dead: false, boss: false, minion: false, tame: false, strain: 0, shootCd: rnd(1, 3), side: 1, hitCd: 0,
    };
    this.creatures.push(c);
    return c;
  }

  private spawnApex(x: number, y: number) {
    const id = this.region.apex;
    const c = this.spawn(id, x, y);
    c.boss = true; c.cd = 3;
    this.banner(`⚠ APEX: ${c.def.name.toUpperCase()}`, "#ff6a5a", 4);
    audio.sfx("roar"); audio.setMode("boss"); this.shake(14);
  }

  // ---------------- lifecycle ----------------
  start() {
    this.last = performance.now();
    const loop = (ts: number) => {
      if (this.destroyed) return;
      const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000));
      this.last = ts;
      if (!this.paused) this.update(dt);
      this.render();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  pause() { if (this.paused || this.ended) return; this.paused = true; this.keys = {}; this.mouseDown = false; this.charging = false; this.charge = 0; audio.setFlight(0, 0); this.p.onPause(); }
  resume() { this.paused = false; this.last = performance.now(); }
  forceReturn() { this.end("return"); }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.unbindEvents();
    audio.stopFlight();
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(320, r.width); this.H = Math.max(240, r.height);
    this.canvas.width = Math.floor(this.W * this.dpr); this.canvas.height = Math.floor(this.H * this.dpr);
    this.scale = clamp(Math.min(this.W / 1100, this.H / 800), 0.45, 1.8);
  }

  // ---------------- input ----------------
  private onKeyDown = (e: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (e.code === "KeyP" || e.code === "Escape") { this.pause(); return; }
    if (e.code === "KeyM") { this.p.onMute(); return; }
    if (e.code === "KeyE") this.cutRopes();
    this.keys[e.code] = true;
  };
  private onKeyUp = (e: KeyboardEvent) => { this.keys[e.code] = false; };
  private onBlur = () => { this.pause(); };
  private onVis = () => { if (document.hidden) this.pause(); };
  private onResize = () => { this.resize(); };
  private ptrPos(e: PointerEvent) { const r = this.canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  private onPointerDown = (e: PointerEvent) => {
    audio.init();
    const { x, y } = this.ptrPos(e);
    if (hyp(x - (this.W - 42), y - 28) < 22) { this.pause(); return; }
    if (e.pointerType === "touch") {
      this.touchUI = true;
      const W = this.W, H = this.H;
      if (hyp(x - (W - 80), y - (H - 90)) < 46) { this.touchReel = true; this.touches.set(e.pointerId, "reel"); return; }
      if (hyp(x - (W - 175), y - (H - 55)) < 36) { this.touchBoost = true; this.touches.set(e.pointerId, "boost"); return; }
      if (hyp(x - (W - 60), y - 110) < 30) { this.touchReturn = true; this.touches.set(e.pointerId, "ret"); return; }
      if (x < W * 0.38 && y > H * 0.4) { this.joy = { ox: x, oy: y, x: 0, y: 0, active: true, id: e.pointerId }; this.touches.set(e.pointerId, "joy"); return; }
      this.touches.set(e.pointerId, "aim");
      this.mx = x; this.my = y; this.mouseDown = true;
      return;
    }
    this.mx = x; this.my = y;
    if (e.button === 2) this.rightDown = true; else if (e.button === 0) this.mouseDown = true;
  };
  private onPointerMove = (e: PointerEvent) => {
    const { x, y } = this.ptrPos(e);
    if (e.pointerType === "touch") {
      const kind = this.touches.get(e.pointerId);
      if (kind === "joy") { const dx = x - this.joy.ox, dy = y - this.joy.oy; const d = hyp(dx, dy) || 1; const m = Math.min(1, d / 50); this.joy.x = (dx / d) * m; this.joy.y = (dy / d) * m; }
      else if (kind === "aim") { this.mx = x; this.my = y; }
      return;
    }
    this.mx = x; this.my = y;
  };
  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType === "touch") {
      const kind = this.touches.get(e.pointerId);
      this.touches.delete(e.pointerId);
      if (kind === "joy") this.joy = { ...this.joy, active: false, x: 0, y: 0 };
      else if (kind === "reel") this.touchReel = false;
      else if (kind === "boost") this.touchBoost = false;
      else if (kind === "ret") this.touchReturn = false;
      else if (kind === "aim") this.mouseDown = false;
      return;
    }
    if (e.button === 2) this.rightDown = false; else if (e.button === 0) this.mouseDown = false;
  };
  private onContext = (e: Event) => e.preventDefault();

  private bindEvents() {
    window.addEventListener("keydown", this.onKeyDown); window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur); document.addEventListener("visibilitychange", this.onVis);
    window.addEventListener("resize", this.onResize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    window.addEventListener("pointermove", this.onPointerMove); window.addEventListener("pointerup", this.onPointerUp); window.addEventListener("pointercancel", this.onPointerUp);
    this.canvas.addEventListener("contextmenu", this.onContext);
  }
  private unbindEvents() {
    window.removeEventListener("keydown", this.onKeyDown); window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur); document.removeEventListener("visibilitychange", this.onVis);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    window.removeEventListener("pointermove", this.onPointerMove); window.removeEventListener("pointerup", this.onPointerUp); window.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("contextmenu", this.onContext);
  }

  private pollPad() {
    this.padAim = null; this.padFire = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = pads && pads[0];
    if (!g) return { x: 0, y: 0, reel: false, boost: false, ret: false };
    const dz = (v: number) => (Math.abs(v) < 0.2 ? 0 : v);
    const ax = dz(g.axes[0] || 0), ay = dz(g.axes[1] || 0);
    const rx = g.axes[2] || 0, ry = g.axes[3] || 0;
    if (hyp(rx, ry) > 0.3) this.padAim = { x: rx, y: ry };
    this.padFire = !!(g.buttons[7] && g.buttons[7].pressed);
    const start = !!(g.buttons[9] && g.buttons[9].pressed);
    if (start && !this.padPrev.start) this.pause();
    this.padPrev.start = start;
    if (g.buttons[2] && g.buttons[2].pressed) this.cutRopes();
    return { x: ax, y: ay, reel: !!(g.buttons[0] && g.buttons[0].pressed) || !!(g.buttons[6] && g.buttons[6].pressed), boost: !!(g.buttons[1] && g.buttons[1].pressed), ret: !!(g.buttons[3] && g.buttons[3].pressed) };
  }

  // ---------------- helpers ----------------
  private shake(a: number) { if (this.p.settings.shake) this.shakeAmp = Math.max(this.shakeAmp, a); }
  private banner(text: string, color: string, t = 2.5) { this.banners.push({ text, color, t, max: t }); if (this.banners.length > 3) this.banners.shift(); }
  private float(x: number, y: number, text: string, color = "#fff", size = 18, life = 1.1) {
    if (this.floaters.length > 80) this.floaters.shift();
    this.floaters.push({ x, y, vy: -50, text, life, max: life, color, size });
  }
  private burst(x: number, y: number, n: number, color: string, speed: number, life: number, size = 3, grav = 0) {
    for (let i = 0; i < n && this.parts.length < 1400; i++) {
      const a = Math.random() * Math.PI * 2; const s = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, grav, kind: 0 });
    }
  }
  private ring(x: number, y: number, color: string, size = 40, life = 0.5) {
    this.parts.push({ x, y, vx: 0, vy: 0, life, max: life, size, color, grav: 0, kind: 2 });
  }
  private cargoCount() { return GOOD_IDS.reduce((a, g) => a + this.cargo[g], 0); }
  private gun() { return { x: this.ship.x + this.ship.face * 26, y: this.ship.y + 34 }; }

  private frontF(kind: FrontKind, x: number) {
    let m = 0;
    for (const f of this.fronts) if (f.kind === kind) m = Math.max(m, smooth(clamp(1 - Math.abs(x - f.x) / (f.w / 2), 0, 1)));
    return m;
  }
  private windAt(x: number) {
    let w = Math.sin(this.time * 0.05) * 40;
    for (const f of this.fronts) if (f.kind === "gale") w += f.dir * f.str * smooth(clamp(1 - Math.abs(x - f.x) / (f.w / 2), 0, 1));
    if (this.gust.t > 0) w += this.gust.dir * 380;
    return w;
  }

  // ---------------- update ----------------
  private update(rawDt: number) {
    let dt = rawDt;
    if (this.hitstop > 0) { this.hitstop -= rawDt; dt *= 0.12; }
    this.time += dt;
    const pad = this.pollPad();
    const s = this.ship;

    // fronts + weather sampling
    for (const f of this.fronts) { f.x += f.vx * dt; }
    const sx = s.x;
    const prevStorm = this.wx.storm, prevFog = this.wx.fog;
    this.wx.storm = this.frontF("storm", sx); this.wx.fog = this.frontF("fog", sx);
    this.wx.gale = this.frontF("gale", sx); this.wx.aurora = Math.max(this.frontF("aurora", sx), this.p.camp.loc === 4 ? 0.3 : 0);
    this.wx.wind = this.windAt(sx);
    if (prevStorm < 0.2 && this.wx.storm >= 0.2) { this.banner("⛈ Entering Thunderhead!", "#b7a8ff"); audio.sfx("warn"); }
    if (prevFog < 0.25 && this.wx.fog >= 0.25) this.banner("🌫 Murk Bank — visibility falling", "#d0dae4");
    if (this.gust.t > 0) this.gust.t -= dt;

    // input vector
    let ix = 0, iy = 0;
    const k = this.keys;
    if (k.KeyA || k.ArrowLeft) ix -= 1; if (k.KeyD || k.ArrowRight) ix += 1;
    if (k.KeyW || k.ArrowUp) iy -= 1; if (k.KeyS || k.ArrowDown) iy += 1;
    ix += pad.x; iy += pad.y;
    if (this.joy.active) { ix += this.joy.x; iy += this.joy.y; }
    const im = hyp(ix, iy); if (im > 1) { ix /= im; iy /= im; }
    const boost = !!(k.ShiftLeft || k.ShiftRight) || pad.boost || this.touchBoost;
    const reeling = !!k.Space || this.rightDown || pad.reel || this.touchReel;
    const wantReturn = !!k.KeyR || pad.ret || this.touchReturn;

    // ship
    const dead = this.wrecked;
    const canThrust = s.fuel > 0 && !dead;
    const thrusting = canThrust && im > 0.05;
    const boosting = thrusting && boost;
    const acc = 560 * this.stats.thrust * (boosting ? 1.7 : 1);
    if (canThrust) { s.vx += ix * acc * dt; s.vy += iy * acc * dt; }
    s.vx += this.wx.wind * 0.35 * dt;
    const dmp = Math.exp(-1.5 * dt); s.vx *= dmp; s.vy *= dmp;
    const cs = hyp(s.vx, s.vy); const maxS = 420 * this.stats.thrust * (boosting ? 1.7 : 1);
    if (cs > maxS * 1.6) { s.vx *= (maxS * 1.6) / cs; s.vy *= (maxS * 1.6) / cs; }
    s.x += s.vx * dt; s.y += s.vy * dt; this.moved += cs * dt;
    if (s.x < 120) { s.x = 120; s.vx = Math.abs(s.vx) * 0.3; } if (s.x > WW - 120) { s.x = WW - 120; s.vx = -Math.abs(s.vx) * 0.3; }
    if (s.y < CEIL) { s.y = CEIL; s.vy = Math.abs(s.vy) * 0.3; } if (s.y > FLOOR - 70) { s.y = FLOOR - 70; s.vy = -Math.abs(s.vy) * 0.3; }
    if (!dead) {
      const burn = (0.25 + (thrusting ? 0.55 : 0) + (boosting ? 1.2 : 0)) * this.stats.burn;
      s.fuel = Math.max(0, s.fuel - burn * dt);
      if (s.fuel < 20 && !this.lowFuelWarned) { this.lowFuelWarned = true; this.banner("⛽ Fuel low! Hold R to head home", "#ffb347"); audio.sfx("warn"); }
      if (s.fuel > 30) this.lowFuelWarned = false;
      if (s.fuel <= 0 && this.adriftT < 0 && !this.ended) { this.adriftT = 14; this.banner("OUT OF FUEL — adrift!", "#ff6a5a", 4); audio.sfx("warn"); }
      if (this.adriftT >= 0) { this.adriftT -= dt; if (this.adriftT <= 0 && !this.ended) this.end("adrift"); }
    }
    s.iframes = Math.max(0, s.iframes - dt); s.hurtT = Math.max(0, s.hurtT - dt);
    if (this.stats.regen > 0 && s.hurtT <= 0 && s.hp > 0 && !dead) s.hp = Math.min(s.maxHp, s.hp + this.stats.regen * dt);
    s.tilt += (clamp(s.vx / 500, -0.3, 0.3) - s.tilt) * Math.min(1, dt * 5);
    s.prop += dt * (12 + hyp(ix, iy) * 30);

    // aim
    const S = this.scale;
    let mwx = this.mx / S + this.cam.x, mwy = this.my / S + this.cam.y;
    const g0 = this.gun();
    if (this.padAim) { mwx = g0.x + this.padAim.x * 400; mwy = g0.y + this.padAim.y * 400; this.mx = (mwx - this.cam.x) * S; this.my = (mwy - this.cam.y) * S; }
    s.aim = Math.atan2(mwy - g0.y, mwx - g0.x);
    if (Math.abs(mwx - s.x) > 12) s.face = mwx > s.x ? 1 : -1;

    // fire control
    this.reload = Math.max(0, this.reload - dt);
    const slotFree = this.harpoons.length < this.stats.slots;
    const fireHeld = (this.mouseDown || this.padFire) && !dead;
    if (fireHeld && slotFree && this.reload <= 0) {
      if (!this.charging) { this.charging = true; this.charge = 0.05; }
      this.charge = Math.min(1, this.charge + dt / 0.85);
      this.chargeTickT -= dt;
      if (this.chargeTickT <= 0) { audio.sfx("charge", this.charge); this.chargeTickT = 0.07; }
    } else if (this.charging) {
      if (slotFree && this.reload <= 0 && !dead) this.fire(Math.max(0.18, this.charge));
      this.charging = false; this.charge = 0;
    }
    if (!fireHeld && !this.charging) this.charge = 0;

    this.updateHarpoons(dt, reeling);
    this.updateCreatures(dt);
    this.updateEscorts(dt);
    this.updateCannon(dt);
    this.updateBullets(dt);
    this.updateStrikes(dt);
    this.updatePickups(dt);
    this.updateSpawns(dt);

    // reel audio
    const anyHooked = this.harpoons.some((h) => h.state === "hooked");
    if (anyHooked && reeling) { this.reelClickT -= dt; if (this.reelClickT <= 0) { audio.sfx("reel", Math.min(1, this.maxTensionRatio())); this.reelClickT = 0.09; } }

    // particles / floaters
    for (const p of this.parts) {
      p.life -= dt; p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 0) { p.vx *= 1 - dt * 0.8; }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.life -= dt; f.y += f.vy * dt; f.vy *= 1 - dt * 1.5; }
    this.floaters = this.floaters.filter((f) => f.life > 0);
    for (const b of this.banners) b.t -= dt;
    this.banners = this.banners.filter((b) => b.t > 0);
    this.shakeAmp *= Math.exp(-dt * 7); this.flash = Math.max(0, this.flash - dt * 3);
    this.hintT = Math.max(0, this.hintT - dt);

    // return / end conditions
    if (wantReturn && !dead && !this.ended) {
      this.returnT += dt;
      if (this.returnT >= 1.5) this.end("return");
    } else this.returnT = Math.max(0, this.returnT - dt * 2);
    if (this.endT >= 0) { this.endT -= dt; if (this.endT <= 0 && !this.ended) this.end(this.wrecked ? "wreck" : "apex"); }

    // tutorial
    this.updateTutorial(dt);

    // camera
    const vw = this.W / S, vh = this.H / S;
    const tx = clamp(s.x + s.face * 90 - vw / 2, 0, Math.max(0, WW - vw));
    const ty = clamp(s.y - vh / 2 + 40, 0, Math.max(0, WH - vh));
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 4); this.cam.y += (ty - this.cam.y) * Math.min(1, dt * 4);

    // audio
    audio.setFlight(thrusting ? (boosting ? 1 : 0.6) : 0.15, this.wx.wind);
    this.musicT -= dt;
    if (this.musicT <= 0) {
      this.musicT = 0.4;
      const boss = this.creatures.some((c) => c.boss && !c.dead);
      audio.setMode(boss ? "boss" : "sortie");
      const hostileNear = this.creatures.some((c) => !c.dead && c.def.hostile && hyp(c.x - s.x, c.y - s.y) < 700);
      audio.setIntensity((anyHooked ? 0.6 : 0.1) + (hostileNear ? 0.3 : 0) + this.wx.storm * 0.2);
    }
  }

  private maxTensionRatio() { let m = 0; for (const h of this.harpoons) if (h.state === "hooked") m = Math.max(m, h.T / this.stats.maxT); return m; }

  private fire(power: number) {
    const g = this.gun(); const s = this.ship;
    const sp = (520 + 820 * power) * this.stats.harpSpeed;
    const h: Harpoon = { id: this.nid++, state: "fly", x: g.x, y: g.y, vx: Math.cos(s.aim) * sp + s.vx * 0.5, vy: Math.sin(s.aim) * sp + s.vy * 0.5, power, target: null, ox: 0, oy: 0, L: 0, T: 0, over: 0, trail: [] };
    this.harpoons.push(h);
    this.nHarpoons++; this.reload = 0.3;
    s.vx -= Math.cos(s.aim) * 60 * power; s.vy -= Math.sin(s.aim) * 60 * power;
    this.burst(g.x, g.y, 8, "#fff3c2", 160, 0.3, 2.5);
    this.shake(2 + power * 3);
    audio.sfx("fire", power);
  }

  private cutRopes() {
    let cut = false;
    for (const h of this.harpoons) if (h.state === "hooked") { h.state = "back"; if (h.target) h.target.hooks = Math.max(0, h.target.hooks - 1); h.target = null; cut = true; }
    if (cut) { audio.sfx("snap"); this.float(this.ship.x, this.ship.y - 60, "ROPE CUT", "#ffd9a0", 16); }
  }

  private updateHarpoons(dt: number, reeling: boolean) {
    const s = this.ship; const g = this.gun();
    for (const c of this.creatures) c.strain = 0;
    const maxRope = 760;
    for (const h of this.harpoons) {
      if (h.state === "fly") {
        h.vy += 430 * dt; h.vx += this.windAt(h.x) * 0.9 * dt;
        const px = h.x, py = h.y;
        h.x += h.vx * dt; h.y += h.vy * dt;
        h.trail.push({ x: px, y: py }); if (h.trail.length > 10) h.trail.shift();
        // swept collision
        let best: Creature | null = null; let bd = 1e9;
        for (const c of this.creatures) {
          if (c.dead) continue;
          const hr = c.r * (c.def.shape === "eel" ? 1.25 : 0.95) + 8;
          const d = hyp(h.x - c.x, h.y - c.y);
          const dm = hyp((px + h.x) / 2 - c.x, (py + h.y) / 2 - c.y);
          if ((d < hr || dm < hr) && d < bd) { best = c; bd = d; }
        }
        if (best) this.harpoonHit(h, best, bd);
        else if (hyp(h.x - g.x, h.y - g.y) > maxRope || h.y > FLOOR + 40 || h.x < 0 || h.x > WW) h.state = "back";
      } else if (h.state === "hooked") {
        const c = h.target;
        if (!c || c.dead) { h.state = "back"; continue; }
        h.x = c.x + h.ox; h.y = c.y + h.oy;
        const dx = h.x - g.x, dy = h.y - g.y; const d = hyp(dx, dy) || 1; const ux = dx / d, uy = dy / d;
        if (reeling && h.T / this.stats.maxT < 0.9) h.L = Math.max(70, h.L - 95 * this.stats.reel * dt);
        const stretch = d - h.L;
        const relSep = (c.vx - s.vx) * ux + (c.vy - s.vy) * uy;
        h.T = stretch > 0 ? 2.2 * stretch + 0.2 * Math.max(0, relSep) : 0;
        const ratio = h.T / this.stats.maxT;
        // clutch slip
        const slipAt = reeling ? 0.85 : 0.7;
        if (ratio > slipAt) h.L += (ratio - slipAt) * 520 * dt;
        c.strain = Math.max(c.strain, ratio);
        if (stretch > 0) {
          const aShip = (h.T * 2.6) / (1 + this.cargoCount() * 0.02);
          const aC = h.T * 2.6 * (45 / c.r);
          s.vx += ux * aShip * dt; s.vy += uy * aShip * dt;
          c.vx -= ux * aC * dt; c.vy -= uy * aC * dt;
          if (relSep > 0) {
            const mC = c.r * 1.2, mS = 60 + this.cargoCount();
            const kk = relSep * Math.min(1, 5 * dt);
            s.vx += ux * kk * (mC / (mC + mS)); s.vy += uy * kk * (mC / (mC + mS));
            c.vx -= ux * kk * (mS / (mC + mS)); c.vy -= uy * kk * (mS / (mC + mS));
          }
        }
        if (ratio > 0.35 && c.exhausted <= 0) {
          c.stam -= ratio * ratio * 24 * dt;
          if (Math.random() < dt * 14 * ratio) this.burst(h.x, h.y, 1, "#ffd27a", 80, 0.35, 2);
        }
        if (ratio > 1) {
          h.over += dt;
          if (Math.random() < 0.3) this.burst(g.x + ux * 20, g.y + uy * 20, 1, "#ff6a5a", 100, 0.3, 2.5);
        } else h.over = Math.max(0, h.over - dt * 0.8);
        if (h.over > 0.3 * (this.diff.snap)) {
          h.state = "back"; c.hooks = Math.max(0, c.hooks - 1); h.target = null; this.nSnaps++;
          audio.sfx("snap"); this.shake(7); this.float(g.x, g.y - 40, "ROPE SNAPPED!", "#ff6a5a", 22, 1.4);
          this.burst(g.x, g.y, 14, "#ffe0b0", 220, 0.5, 2.5);
        }
      } else {
        const dx = g.x - h.x, dy = g.y - h.y; const d = hyp(dx, dy) || 1;
        const sp = 1500 * dt;
        h.x += (dx / d) * Math.min(sp, d); h.y += (dy / d) * Math.min(sp, d);
        if (d < 36) h.power = -1;
      }
    }
    this.harpoons = this.harpoons.filter((h) => h.power >= 0);
  }

  private harpoonHit(h: Harpoon, c: Creature, d: number) {
    const bull = d < c.r * 0.4;
    let dmg = 14 * (0.55 + 0.9 * h.power) * this.stats.harpDmg * (bull ? 2 : 1);
    if (c.boss) dmg *= 0.6;
    c.hp -= dmg; c.flash = 1; this.nHits++; this.hooksMade++;
    if (bull) { this.nBull++; this.float(h.x, h.y - 20, "BULLSEYE!", "#ffe566", 22, 1.2); audio.sfx("bullseye"); }
    h.state = "hooked"; h.target = c; h.ox = h.x - c.x; h.oy = h.y - c.y; h.L = Math.max(80, hyp(h.x - this.gun().x, h.y - this.gun().y)); h.T = 0; h.over = 0;
    c.hooks++;
    this.float(h.x, h.y, `${Math.round(dmg)}`, "#fff", 18);
    this.burst(h.x, h.y, 12, "#ffcf9a", 200, 0.5, 3);
    this.ring(h.x, h.y, "#ffffff", 36, 0.35);
    audio.sfx("hit"); audio.sfx("hook"); this.hitstop = 0.06; this.shake(5 + h.power * 3);
    if (c.hp <= 0) this.kill(c);
  }

  // ---------------- creatures ----------------
  private hurtShip(dmg: number, kind: "contact" | "lightning" | "bullet" | "burst" = "contact") {
    const s = this.ship;
    if (s.hp <= 0 || this.ended) return;
    let d = dmg * this.diff.dmg;
    if (kind === "lightning") d *= 1 - 0.15 * this.stats.rods;
    s.hp -= d; this.damage += d; s.hurtT = 3;
    this.flash = Math.max(this.flash, kind === "lightning" ? 0.9 : 0.35);
    this.shake(8 + Math.min(10, d * 0.3)); audio.sfx("hurt");
    this.float(s.x, s.y - 50, `-${Math.round(d)}`, "#ff6a5a", 24, 1.2);
    this.burst(s.x, s.y, 10, "#ff8a6a", 220, 0.5, 3);
    if (kind === "bullet" && Math.random() < 0.2) this.dropCargo();
    if (s.hp <= 0) {
      s.hp = 0; this.wrecked = true; this.endT = 2.2;
      this.burst(s.x, s.y, 80, "#ffb347", 420, 1.4, 5, 200); this.burst(s.x, s.y, 40, "#555", 260, 1.8, 6);
      audio.sfx("boom"); this.shake(26); this.banner("HULL BREACHED!", "#ff5a4a", 3);
    }
  }
  private dropCargo() {
    const have = GOOD_IDS.filter((g) => this.cargo[g] > 0);
    if (!have.length) return;
    const g = pick(have); this.cargo[g]--;
    this.pickups.push({ x: this.ship.x, y: this.ship.y, vx: rnd(-120, 120), vy: rnd(-160, -60), good: g, crowns: 0, life: 25, bob: Math.random() * 6 });
    this.float(this.ship.x, this.ship.y - 80, `${GOODS[g].icon} plundered!`, "#ffd27a", 16);
  }

  private updateCreatures(dt: number) {
    const s = this.ship;
    for (const c of this.creatures) {
      if (c.dead) continue;
      const def = c.def;
      c.t += dt; c.flash = Math.max(0, c.flash - dt * 4); c.tagged = Math.max(0, c.tagged - dt); c.hitCd = Math.max(0, c.hitCd - dt);
      const dx = s.x - c.x, dy = s.y - c.y; const d = hyp(dx, dy) || 1; const ux = dx / d, uy = dy / d;
      const hooked = c.hooks > 0;
      const stamF = c.stam / c.maxStam;
      let spd = def.speed * (c.tagged > 0 ? 0.6 : 1) * (hooked ? 0.45 + 0.55 * stamF : 1);
      if (c.boss) spd *= 0.85 + 0.15 * this.phaseOf(c);
      let tvx = 0, tvy = 0, steer = 2;
      if (c.tagged > 0 && c.exhausted <= 0) c.stam = Math.max(1, c.stam - 5 * dt);
      if (!hooked && c.exhausted > 0) c.exhausted = Math.min(c.exhausted, 4);
      if (c.exhausted > 0) {
        c.exhausted -= dt; steer = 2.5;
        if (c.exhausted <= 0) { c.stam = c.maxStam * 0.5; c.exhausted = 0; this.float(c.x, c.y - c.r - 20, "RECOVERED", "#ff8a7a", 16); }
      } else {
        if (c.strain < 0.2) c.stam = Math.min(c.maxStam, c.stam + 5 * dt);
        if (c.stam <= 0 && hooked) {
          c.exhausted = def.ai === "apex" ? 7.5 : 999; c.stam = 0; c.state = "idle"; c.act = "";
          this.float(c.x, c.y - c.r - 30, "EXHAUSTED!", "#ffe566", 24, 1.6); audio.sfx("bell");
          this.burst(c.x, c.y, 18, "#ffe566", 180, 0.8, 3); this.banner(`${def.name} is exhausted — close in and lance it!`, "#ffe9a8", 2.5);
        }
        const wander = () => {
          c.wanderT -= dt;
          if (c.wanderT <= 0) { c.wanderA = (Math.random() < 0.5 ? 0 : Math.PI) + rnd(-0.7, 0.7); c.wanderT = rnd(2, 5); }
          tvx = Math.cos(c.wanderA) * spd * 0.45; tvy = Math.sin(c.wanderA) * spd * 0.45;
          if (c.y < def.alt[0]) tvy = Math.abs(tvy) + 30; if (c.y > def.alt[1]) tvy = -Math.abs(tvy) - 30;
        };
        const fleeVec = (mul: number) => { tvx = -ux * spd * mul; tvy = -uy * spd * mul; };
        switch (def.ai) {
          case "flee":
            if (hooked) { fleeVec(1); if (def.shape === "manta") { tvx += -uy * Math.sin(c.t * 3) * spd * 0.6; tvy += ux * Math.sin(c.t * 3) * spd * 0.6; } steer = 2.5; }
            else if (d < 450 && !c.tame) { fleeVec(0.8); if (def.shape === "manta") { tvy += Math.sin(c.t * 4) * spd * 0.5; } }
            else wander();
            break;
          case "float":
            tvx = this.windAt(c.x) * 0.25; tvy = Math.sin(c.t * 1.3) * 25;
            if (hooked) { tvx += -ux * spd; tvy += -uy * spd; }
            if (c.y < def.alt[0]) tvy += 40; if (c.y > def.alt[1]) tvy -= 40;
            break;
          case "hunt": case "bull": case "ship": case "apex":
            this.hostileAI(c, dt, d, ux, uy, spd, wander, (a, b) => { tvx = a; tvy = b; }, (v) => { steer = v; });
            break;
        }
      }
      c.vx += (tvx - c.vx) * Math.min(1, steer * dt); c.vy += (tvy - c.vy) * Math.min(1, steer * dt);
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (Math.abs(c.vx) > 12) c.face += ((c.vx > 0 ? 1 : -1) - c.face) * Math.min(1, dt * 6);
      if (c.x < 80) { c.x = 80; c.vx = Math.abs(c.vx); } if (c.x > WW - 80) { c.x = WW - 80; c.vx = -Math.abs(c.vx); }
      if (c.y < CEIL + 40) { c.y = CEIL + 40; c.vy = Math.abs(c.vy); } if (c.y > FLOOR - 40) { c.y = FLOOR - 40; c.vy = -Math.abs(c.vy); }
      // lance
      if (c.exhausted > 0 && hooked && d < 340 + c.r) {
        c.hp -= this.stats.lance * dt; this.lanceT -= dt;
        if (this.lanceT <= 0) {
          this.lanceT = 0.22; audio.sfx("lance");
          this.burst(c.x + rnd(-c.r, c.r) * 0.6, c.y + rnd(-c.r, c.r) * 0.5, 4, "#ffd27a", 220, 0.4, 3);
          if (Math.random() < 0.4) this.float(c.x + rnd(-30, 30), c.y - c.r * 0.5, `${Math.round(this.stats.lance * 0.22)}`, "#ffe9a8", 14, 0.7);
        }
        c.flash = 0.6;
        if (c.hp <= 0) this.kill(c);
      }
      // contact damage
      if (def.contact > 0 && c.state === "dash" && c.hitCd <= 0 && !c.dead) {
        const hr = c.r * 0.85 + 34;
        if (hyp(s.x - c.x, s.y - c.y) < hr && s.iframes <= 0) {
          c.hitCd = 1; s.iframes = 0.9; this.hurtShip(def.contact, "contact");
          s.vx += ux * 520; s.vy += uy * 520;
        }
        for (const e of this.escorts) if (!e.dead && hyp(e.x - c.x, e.y - c.y) < c.r * 0.85 + 24) { c.hitCd = 1; this.hurtEscort(e, def.contact * this.diff.dmg); }
      }
    }
    this.creatures = this.creatures.filter((c) => !c.dead);
  }

  private phaseOf(c: Creature) { const f = c.hp / c.maxHp; return f > 0.66 ? 1 : f > 0.33 ? 2 : 3; }

  private hostileAI(
    c: Creature, dt: number, d: number, ux: number, uy: number, spd: number,
    wander: () => void, setV: (x: number, y: number) => void, setSteer: (v: number) => void,
  ) {
    const def = c.def; const s = this.ship;
    const hooked = c.hooks > 0;
    const ph = this.phaseOf(c);
    const dashSpeed = def.ai === "apex" ? 560 + 40 * ph : def.ai === "bull" ? 330 : 440;
    // shared state machine for dash/wind/recover
    if (c.state === "wind") {
      c.st -= dt; setV(0, 0); setSteer(3);
      if (Math.random() < dt * 20) this.burst(c.x + rnd(-c.r, c.r), c.y + rnd(-c.r, c.r) * 0.6, 1, c.def.col2, 60, 0.4, 2.5);
      if (c.st <= 0) this.finishWind(c);
      return;
    }
    if (c.state === "dash") {
      c.st -= dt; setV(c.dx * dashSpeed, c.dy * dashSpeed); setSteer(8);
      if (Math.random() < dt * 30) this.burst(c.x, c.y, 1, c.def.col2, 40, 0.4, 3);
      if (c.st <= 0) { c.state = "recover"; c.st = def.ai === "apex" ? 1.1 : 1.0; }
      return;
    }
    if (c.state === "recover") { c.st -= dt; setV(0, 0); setSteer(2); if (c.st <= 0) c.state = "idle"; return; }
    c.cd -= dt;
    switch (def.ai) {
      case "hunt": {
        if (hooked) { setV(-ux * spd * 0.5, -uy * spd * 0.5); }
        else if (d < 1100 || this.wx.storm > 0.3) {
          const want = 280;
          const mv = d > want ? 0.8 : -0.3;
          setV(ux * spd * mv + -uy * Math.sin(c.t * 4) * 60, uy * spd * mv + ux * Math.sin(c.t * 4) * 60);
        } else wander();
        if (c.cd <= 0 && d < 520 && !c.tame) this.startAttack(c, "charge", 0.55);
        break;
      }
      case "bull": {
        if (hooked) { setV(-ux * spd * 0.7, -uy * spd * 0.7); if (c.cd <= 0 && d < 700) this.startAttack(c, "charge", 0.7); }
        else { wander(); c.cd = Math.max(c.cd, 2); }
        break;
      }
      case "ship": {
        const want = 480; const mv = d > want + 80 ? 0.9 : d < want - 120 ? -0.8 : 0;
        const ty = s.y - 110 - c.y;
        setV(ux * spd * mv + (hooked ? -ux * spd * 0.4 : 0), clamp(ty, -80, 80) + (hooked ? -uy * spd * 0.4 : 0));
        c.shootCd -= dt;
        if (c.shootCd <= 0 && d < 950) {
          c.shootCd = rnd(1.8, 2.6);
          const lead = d / 520; const px = s.x + s.vx * lead * 0.6, py = s.y + s.vy * lead * 0.6;
          const a = Math.atan2(py - c.y, px - c.x);
          this.bullets.push({ x: c.x, y: c.y, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, dmg: 9, life: 3, r: 7, friendly: false, kind: "ball" });
          audio.sfx("cannon"); this.burst(c.x + Math.cos(a) * c.r, c.y + Math.sin(a) * c.r, 6, "#ffd27a", 120, 0.3, 3);
        }
        break;
      }
      case "apex": {
        const hoveringX = s.x + c.side * 560;
        const tx = hooked ? c.x - ux * 200 : hoveringX; const ty = hooked ? c.y - uy * 200 : s.y - 100 + Math.sin(c.t * 0.8) * 180;
        const ddx = tx - c.x, ddy = ty - c.y; const dd = hyp(ddx, ddy) || 1;
        const sp = spd * Math.min(1, dd / 200) * (hooked ? 0.8 : 0.9);
        setV((ddx / dd) * sp, (ddy / dd) * sp);
        if (c.cd <= 0) {
          const list = def.attacks || ["charge"];
          const a = pick(list);
          this.startAttack(c, a, 0.8);
        }
        break;
      }
    }
  }

  private startAttack(c: Creature, act: string, wind: number) {
    c.state = "wind"; c.act = act; c.st = act === "lightning" ? 0.9 : act === "charge" && c.def.ai === "apex" ? 1.0 : wind;
    c.dx = this.ship.x - c.x; c.dy = this.ship.y - c.y; const d = hyp(c.dx, c.dy) || 1; c.dx /= d; c.dy /= d;
    if (c.boss || c.def.ai === "apex") { audio.sfx("roar"); this.shake(5); }
    else if (act === "charge") audio.sfx("whale");
    this.ring(c.x, c.y, c.def.col2, c.r * 1.4, c.st);
  }

  private finishWind(c: Creature) {
    const s = this.ship; const ph = this.phaseOf(c);
    const act = c.act;
    c.cd = (c.def.ai === "apex" ? 3.6 - 0.55 * ph : c.def.ai === "bull" ? rnd(4, 6) : rnd(2.2, 3.4)) * rnd(0.85, 1.1);
    c.state = "recover"; c.st = 0.6;
    if (act === "charge") {
      c.dx = s.x - c.x; c.dy = s.y - c.y; const d = hyp(c.dx, c.dy) || 1; c.dx /= d; c.dy /= d;
      c.state = "dash"; c.st = c.def.ai === "apex" ? 0.85 : 0.6;
      if (c.def.ai === "apex" && Math.random() < 0.5) c.side = -c.side;
    } else if (act === "lightning") {
      const n = 2 + ph;
      for (let i = 0; i < n; i++) this.strikes.push({ x: s.x + (i === 0 ? s.vx * 0.5 : rnd(-380, 380)), y: s.y + (i === 0 ? s.vy * 0.5 : rnd(-260, 260)), t: 0, delay: 1.05 + i * 0.12, dmg: 22, r: 85 });
      audio.sfx("zap");
    } else if (act === "ring") {
      const n = 12 + 4 * ph; const off = Math.random() * 6;
      for (let i = 0; i < n; i++) { const a = off + (i / n) * Math.PI * 2; this.bullets.push({ x: c.x, y: c.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, dmg: 8, life: 5, r: 9, friendly: false, kind: "orb" }); }
      if (ph === 3) for (let i = 0; i < n; i++) { const a = off + ((i + 0.5) / n) * Math.PI * 2; this.bullets.push({ x: c.x, y: c.y, vx: Math.cos(a) * 140, vy: Math.sin(a) * 140, dmg: 8, life: 6, r: 9, friendly: false, kind: "orb" }); }
      audio.sfx("zap"); this.ring(c.x, c.y, c.def.col2, 160, 0.6);
    } else if (act === "volley") {
      const n = ph >= 2 ? 7 : 5; const base = Math.atan2(s.y - c.y, s.x - c.x);
      for (let i = 0; i < n; i++) { const a = base + (i - (n - 1) / 2) * 0.17; this.bullets.push({ x: c.x, y: c.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, dmg: 9, life: 3.5, r: 8, friendly: false, kind: "ball" }); }
      audio.sfx("cannon"); this.shake(4);
    } else if (act === "gust") {
      this.gust = { t: 3, dir: s.x > c.x ? 1 : -1 }; audio.sfx("gust"); this.banner("💨 Gale gust!", "#9be7ff", 1.5);
    } else if (act === "summon") {
      const type = c.def.minion || "eel";
      const live = this.creatures.filter((x) => x.minion && !x.dead).length;
      const n = Math.min(2 + (ph > 1 ? 1 : 0), 6 - live);
      for (let i = 0; i < n; i++) { const m = this.spawn(type, c.x + rnd(-120, 120), c.y + rnd(-80, 80)); m.minion = true; m.hp *= 0.7; m.maxHp = m.hp; if (m.def.ai === "flee") m.tame = false; }
      if (n > 0) { this.banner(`${c.def.name} summons ${CREATURES[type].name}s!`, "#ffb0a0", 2); audio.sfx("roar"); }
    }
  }

  private kill(c: Creature) {
    if (c.dead) return;
    c.dead = true;
    this.kills[c.type] = (this.kills[c.type] || 0) + 1;
    for (const h of this.harpoons) if (h.target === c) { h.state = "back"; h.target = null; }
    const def = c.def;
    this.burst(c.x, c.y, 40, def.col, 260, 0.9, 5, 60); this.burst(c.x, c.y, 24, def.col2, 320, 0.7, 3);
    this.ring(c.x, c.y, "#fff", c.r * 2, 0.6);
    this.float(c.x, c.y - c.r, c.boss ? `${def.name.toUpperCase()} SLAIN!` : "SLAIN", "#ffe9a8", c.boss ? 32 : 22, c.boss ? 2.5 : 1.3);
    audio.sfx("kill"); this.shake(c.boss ? 22 : 6 + c.r * 0.06); this.hitstop = c.boss ? 0.25 : 0.08;
    if (!c.minion) {
      const boost = this.wx.aurora > 0.3 ? 1.5 : 1;
      for (const [good, mn, mx, ch] of def.loot) {
        if (Math.random() > ch) continue;
        let n = rndi(mn, mx);
        if ((good === "gel" || good === "amber") && boost > 1) n = Math.ceil(n * boost);
        for (let i = 0; i < n; i++) this.pickups.push({ x: c.x + rnd(-c.r, c.r) * 0.6, y: c.y + rnd(-c.r, c.r) * 0.5, vx: rnd(-140, 140), vy: rnd(-200, -20), good, crowns: 0, life: 55, bob: Math.random() * 6 });
      }
      if (def.crowns[1] > 0) {
        const total = rndi(def.crowns[0], def.crowns[1]); const chunks = c.boss ? 8 : 3;
        for (let i = 0; i < chunks; i++) this.pickups.push({ x: c.x + rnd(-40, 40), y: c.y, vx: rnd(-160, 160), vy: rnd(-220, -40), good: null, crowns: Math.round(total / chunks), life: 55, bob: Math.random() * 6 });
      }
    }
    if (def.shape === "jelly" && !c.boss) {
      this.ring(c.x, c.y, "#8ff", 150, 0.5); this.burst(c.x, c.y, 30, "#8ff", 300, 0.7, 4);
      if (hyp(this.ship.x - c.x, this.ship.y - c.y) < 150) this.hurtShip(12, "burst");
      for (const o of this.creatures) if (!o.dead && o !== c && hyp(o.x - c.x, o.y - c.y) < 150) { o.hp -= 25; o.flash = 1; if (o.hp <= 0) this.kill(o); }
      audio.sfx("zap");
    }
    if (c.boss) {
      this.apexSlain = c.type; this.endT = 3.8; this.bullets = this.bullets.filter((b) => b.friendly);
      this.strikes = []; this.banner(`${def.name} has fallen!`, "#ffe9a8", 4);
      this.creatures.forEach((o) => { if (o.minion) { o.hp = 0; o.dead = true; this.burst(o.x, o.y, 14, o.def.col, 160, 0.6, 3); } });
      audio.sfx("win");
    }
  }

  // ---------------- escorts ----------------
  private hurtEscort(e: EscortE, dmg: number) {
    if (e.dead) return;
    e.hp -= dmg; this.burst(e.x, e.y, 8, "#ffb347", 160, 0.4, 3);
    this.float(e.x, e.y - 30, `-${Math.round(dmg)}`, "#ff9a7a", 14);
    if (e.hp <= 0) { e.hp = 0; e.dead = true; this.burst(e.x, e.y, 40, "#ffb347", 300, 1, 4, 150); audio.sfx("boom"); this.banner(`${ESCORTS[e.kind].name} destroyed!`, "#ff8a7a", 2.5); }
  }

  private updateEscorts(dt: number) {
    const s = this.ship; const offs = [[-150, -50], [-250, 60], [-110, 110]];
    for (const e of this.escorts) {
      if (e.dead) continue;
      e.phase += dt;
      const o = offs[e.slot % 3];
      let tx = s.x - s.face * Math.abs(o[0]); let ty = s.y + o[1];
      const lag = e.kind === "hauler" ? 1.6 : 2.6;
      if (e.kind === "chaser" && e.target && !e.target.dead && e.cd < 0) { tx = e.target.x; ty = e.target.y; }
      e.vx += (tx - e.x) * lag * dt; e.vy += (ty - e.y) * lag * dt;
      const dm = Math.exp(-2.2 * dt); e.vx *= dm; e.vy *= dm;
      e.x += e.vx * dt; e.y += e.vy * dt; e.cd -= dt;
      if (e.kind === "harrier" && e.cd <= 0) {
        let tgt: Creature | null = null; let bd = 560;
        for (const c of this.creatures) if (!c.dead && c.def.hostile) { const d = hyp(c.x - e.x, c.y - e.y); if (d < bd) { bd = d; tgt = c; } }
        if (tgt) {
          const a = Math.atan2(tgt.y - e.y, tgt.x - e.x);
          this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 650, vy: Math.sin(a) * 650, dmg: 6, life: 1.2, r: 5, friendly: true, kind: "ball" });
          audio.sfx("cannon"); e.cd = 1.1;
        } else e.cd = 0.3;
      } else if (e.kind === "chaser") {
        if (e.cd <= 0 && !e.target) {
          let tgt: Creature | null = null; let bd = 800;
          for (const c of this.creatures) if (!c.dead && !c.boss && c.tagged <= 0) { const d = hyp(c.x - s.x, c.y - s.y); if (d < bd) { bd = d; tgt = c; } }
          if (tgt) { e.target = tgt; e.cd = -0.01; } else e.cd = 1.5;
        }
        if (e.target) {
          const c = e.target;
          if (c.dead) { e.target = null; e.cd = 4; }
          else if (hyp(c.x - e.x, c.y - e.y) < c.r + 40) {
            c.tagged = 9; c.hp -= 8; c.flash = 1; this.float(c.x, c.y - c.r, "TAGGED", "#9be7ff", 16); audio.sfx("hook");
            this.burst(c.x, c.y, 10, "#9be7ff", 160, 0.4, 3); e.target = null; e.cd = 7;
            if (c.hp <= 0) this.kill(c);
          }
        }
      }
      // cheap lightning shock on escorts handled in strikes
    }
  }

  private updateCannon(dt: number) {
    if (this.wrecked) return;
    this.cannonCd -= dt;
    if (this.cannonCd > 0) return;
    const s = this.ship; let tgt: Creature | null = null; let bd = 560;
    for (const c of this.creatures) if (!c.dead && c.def.hostile) { const d = hyp(c.x - s.x, c.y - s.y) - c.r; if (d < bd) { bd = d; tgt = c; } }
    if (!tgt) { this.cannonCd = 0.25; return; }
    const lead = hyp(tgt.x - s.x, tgt.y - s.y) / 700;
    const px = tgt.x + tgt.vx * lead, py = tgt.y + tgt.vy * lead;
    const a = Math.atan2(py - s.y, px - s.x);
    this.bullets.push({ x: s.x, y: s.y + 20, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, dmg: this.stats.cannonDmg, life: 1.2, r: 5, friendly: true, kind: "ball" });
    audio.sfx("cannon"); this.cannonCd = this.stats.cannonCd;
    this.burst(s.x + Math.cos(a) * 30, s.y + 20 + Math.sin(a) * 30, 4, "#ffe0a0", 120, 0.25, 2.5);
  }

  private updateBullets(dt: number) {
    const s = this.ship;
    for (const b of this.bullets) {
      b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.friendly) {
        for (const c of this.creatures) {
          if (c.dead) continue;
          if (hyp(b.x - c.x, b.y - c.y) < c.r * (c.def.shape === "eel" ? 1.2 : 0.9) + b.r) {
            const dmg = b.dmg * (c.boss ? 0.7 : 1); c.hp -= dmg; c.flash = 1; b.life = 0;
            this.burst(b.x, b.y, 4, "#ffd27a", 120, 0.3, 2.5);
            if (Math.random() < 0.5) this.float(b.x, b.y - 10, `${Math.round(dmg)}`, "#ffe9a8", 12, 0.6);
            audio.sfx("hit"); if (c.hp <= 0) this.kill(c);
            break;
          }
        }
      } else {
        if (hyp(b.x - s.x, b.y - s.y) < 38 + b.r && s.hp > 0) { b.life = 0; this.hurtShip(b.dmg, "bullet"); continue; }
        for (const e of this.escorts) if (!e.dead && hyp(b.x - e.x, b.y - e.y) < 28 + b.r) { b.life = 0; this.hurtEscort(e, b.dmg * this.diff.dmg); break; }
      }
      if (Math.random() < dt * 25) this.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: b.r * 0.7, color: b.friendly ? "#ffe0a0" : b.kind === "orb" ? "#9ffff0" : "#ff9a6a", grav: 0, kind: 0 });
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  private updateStrikes(dt: number) {
    const s = this.ship;
    if (this.wx.storm > 0.15 && !this.wrecked) {
      this.stormT -= dt * (0.4 + this.wx.storm);
      if (this.stormT <= 0) {
        this.stormT = rnd(2.5, 5);
        this.strikes.push({ x: s.x + rnd(-420, 420), y: s.y + rnd(-280, 280), t: 0, delay: 1.1, dmg: 18, r: 80 });
      }
    }
    for (const st of this.strikes) {
      st.t += dt;
      if (st.t >= st.delay && st.dmg > 0) {
        this.flash = Math.max(this.flash, 0.7); audio.sfx("thunder"); this.shake(9);
        this.burst(st.x, st.y, 24, "#fff7a0", 380, 0.5, 4); this.ring(st.x, st.y, "#fff7a0", st.r * 1.3, 0.45);
        if (hyp(s.x - st.x, s.y - st.y) < st.r + 30) this.hurtShip(st.dmg, "lightning");
        for (const e of this.escorts) if (!e.dead && hyp(e.x - st.x, e.y - st.y) < st.r + 20) this.hurtEscort(e, st.dmg * 0.8);
        st.dmg = 0; st.delay = st.t + 0.25;
      }
    }
    this.strikes = this.strikes.filter((st) => st.t < st.delay || st.dmg > 0);
  }

  private updatePickups(dt: number) {
    const s = this.ship; const hauler = this.escorts.find((e) => e.kind === "hauler" && !e.dead);
    const cap = this.stats.hold;
    let fullWarn = false;
    for (const p of this.pickups) {
      p.life -= dt; p.bob += dt * 3;
      p.vx += (this.windAt(p.x) * 0.2 - p.vx) * dt * 0.6; p.vy += (28 * Math.sin(p.bob) - p.vy) * dt * 0.8;
      const near = Math.max(1, hyp(s.x - p.x, s.y - p.y));
      if (near < 150 && !this.wrecked && (p.good === null || this.cargoCount() < cap)) { p.vx += ((s.x - p.x) / near) * 700 * dt; p.vy += ((s.y - p.y) / near) * 700 * dt; }
      let collectBy = near < 64 && !this.wrecked;
      if (hauler) {
        const hd = Math.max(1, hyp(hauler.x - p.x, hauler.y - p.y));
        if (hd < 380 && (p.good === null || this.cargoCount() < cap)) { p.vx += ((hauler.x - p.x) / hd) * 520 * dt; p.vy += ((hauler.y - p.y) / hd) * 520 * dt; }
        if (hd < 56) collectBy = true;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.y = clamp(p.y, CEIL, FLOOR + 20);
      if (collectBy) {
        if (p.good === null) {
          this.crowns += p.crowns; p.life = 0; this.pickedCount++;
          this.float(s.x, s.y - 40, `+${p.crowns}¢`, "#ffe566", 18); audio.sfx("coin", 2);
        } else if (this.cargoCount() < cap) {
          this.cargo[p.good]++; this.gained[p.good]++; p.life = 0; this.pickedCount++;
          this.float(s.x, s.y - 40, `${GOODS[p.good].icon} +1`, GOODS[p.good].color, 16, 0.9); audio.sfx("pickup", Math.min(8, this.cargoCount() % 8));
        } else fullWarn = true;
      }
      if (p.life <= 0 && p.good !== null && this.cargoCount() >= cap) this.lost++;
    }
    if (fullWarn && Math.random() < dt * 1.2) this.float(s.x, s.y - 70, "HOLD FULL!", "#ff9a7a", 18);
    this.pickups = this.pickups.filter((p) => p.life > 0);
  }

  private updateSpawns(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0 && !this.p.apex) {
      this.spawnT = rnd(7, 11);
      const reg = this.p.camp.regions[this.p.camp.loc];
      const target = 5 + Math.round((reg.pop / 100) * 8);
      const count = this.creatures.filter((c) => !c.boss && !c.minion).length;
      if (count < target) this.spawnAmbient();
      if (this.wx.storm > 0.3 && this.creatures.filter((c) => c.type === "eel").length < 4) {
        const e = this.spawn("eel", clamp(this.ship.x + (Math.random() < 0.5 ? -1 : 1) * rnd(900, 1300), 200, WW - 200), rnd(300, 1300));
        e.cd = 1;
      }
    }
    if (this.apexT >= 0) {
      this.apexT -= dt;
      if (this.apexT < 6 && this.apexT + dt >= 6) { this.banner("The sky grows silent... something is coming.", "#ffb0a0", 3); audio.sfx("whale"); }
      if (this.apexT <= 0) { this.apexT = -1; this.spawnApex(clamp(this.ship.x + (this.ship.x < WW / 2 ? 1 : -1) * 1300, 300, WW - 300), this.ship.y); }
    }
  }

  private updateTutorial(dt: number) {
    if (!this.p.tutorial || this.tutDone || !this.p.settings.tips) return;
    this.tutT += dt;
    const done = [this.moved > 350, this.nHarpoons >= 1, this.hooksMade >= 1, Object.keys(this.kills).length >= 1, this.pickedCount >= 1, this.tutT > 9999][this.tut];
    if (done && this.tutT > 1.2) { this.tut++; this.tutT = 0; audio.sfx("bell"); if (this.tut >= 5) { this.p.onTutorialDone(); } }
    if (this.tut >= 5 && this.tutT > 14) this.tutDone = true;
  }

  private end(outcome: SortieResult["outcome"]) {
    if (this.ended) return;
    this.ended = true;
    const cargo = { ...this.cargo };
    let lost = this.lost;
    if (outcome === "adrift") for (const g of GOOD_IDS) { const l = Math.floor(cargo[g] * 0.3); cargo[g] -= l; lost += l; }
    const eh: Record<number, number> = {};
    this.escorts.forEach((e) => { eh[e.id] = e.dead ? 0 : e.hp; });
    audio.stopFlight();
    this.p.onEnd({
      outcome, cargo, crowns: this.crowns, kills: this.kills, hull: this.ship.hp, fuel: this.ship.fuel, escortHp: eh, apexSlain: this.apexSlain,
      harpoons: this.nHarpoons, hits: this.nHits, bullseyes: this.nBull, snaps: this.nSnaps, damage: this.damage, time: this.time, lost, gained: this.gained,
    });
  }

  // ---------------- rendering ----------------
  private skyColors(): [string, string, string] { return this.region.sky; }

  private render() {
    const ctx = this.ctx; const { W, H, dpr } = this;
    const S = this.scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vw = W / S, vh = H / S;
    // sky
    const [c0, c1, c2] = this.skyColors();
    const a0 = this.cam.y / WH, a1 = (this.cam.y + vh) / WH;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, mix(c0, c1, c2, a0)); grad.addColorStop(0.5, mix(c0, c1, c2, (a0 + a1) / 2)); grad.addColorStop(1, mix(c0, c1, c2, a1));
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    // stars
    const starA = clamp(1 - a1 * 1.8, 0, 1);
    if (starA > 0.02) {
      ctx.fillStyle = "#fff";
      for (const st of this.stars) { ctx.globalAlpha = starA * (0.4 + 0.6 * Math.abs(Math.sin(this.time * st.s + st.x * 9))); ctx.fillRect(st.x * W, st.y * H * 0.7, st.s, st.s); }
      ctx.globalAlpha = 1;
    }
    // aurora ribbons
    const au = this.wx.aurora;
    if (au > 0.03) {
      for (let r = 0; r < 3; r++) {
        const cols = ["#6dffb2", "#5ad1ff", "#c78bff"];
        const gy = ctx.createLinearGradient(0, 0, 0, H * 0.5);
        gy.addColorStop(0, "rgba(0,0,0,0)"); gy.addColorStop(0.4, cols[r]); gy.addColorStop(1, "rgba(0,0,0,0)");
        ctx.globalAlpha = au * 0.28; ctx.fillStyle = gy; ctx.beginPath(); ctx.moveTo(0, 0);
        for (let x = 0; x <= W; x += 40) ctx.lineTo(x, H * (0.12 + r * 0.07) + Math.sin(x * 0.006 + this.time * 0.4 + r * 2) * 40);
        ctx.lineTo(W, H * 0.55); ctx.lineTo(0, H * 0.55); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // shake
    const shx = (Math.random() - 0.5) * this.shakeAmp, shy = (Math.random() - 0.5) * this.shakeAmp;
    const cx = this.cam.x, cy = this.cam.y;
    ctx.setTransform(dpr * S, 0, 0, dpr * S, (-cx + shx) * dpr * S, (-cy + shy) * dpr * S);
    // islands + clouds parallax
    ctx.fillStyle = "rgba(20,30,60,0.35)";
    for (const il of this.islands) {
      const px = il.x + cx * 0.8, py = il.y + cy * 0.8;
      ctx.beginPath(); ctx.ellipse(px, py, il.w, il.h * 0.4, 0, Math.PI, 0); ctx.lineTo(px + il.w * 0.5, py + il.h); ctx.lineTo(px - il.w * 0.5, py + il.h * 0.9); ctx.closePath(); ctx.fill();
    }
    const depths = [0.3, 0.55, 0.85];
    for (let l = 0; l < 2; l++) {
      const d = depths[l]; ctx.fillStyle = "#fff";
      for (const cl of this.clouds[l]) {
        const px = cl.x + cx * (1 - d), py = cl.y + cy * (1 - d);
        if (px - cx < -300 || px - cx > vw + 300 || py - cy < -200 || py - cy > vh + 200) continue;
        ctx.globalAlpha = cl.a * (1 - this.wx.storm * 0.4);
        cloudPuff(ctx, px, py, cl.s);
      }
    }
    ctx.globalAlpha = 1;
    // cloud sea
    if (cy + vh > FLOOR - 120) {
      const g2 = ctx.createLinearGradient(0, FLOOR - 120, 0, FLOOR + 400);
      g2.addColorStop(0, "rgba(255,240,220,0)"); g2.addColorStop(0.3, "rgba(255,235,215,0.85)"); g2.addColorStop(1, "rgba(220,190,200,1)");
      ctx.fillStyle = g2; ctx.fillRect(cx - 50, FLOOR - 120, vw + 100, 600);
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      for (let x = Math.floor(cx / 140) * 140 - 140; x < cx + vw + 140; x += 140) { ctx.beginPath(); ctx.arc(x + 70, FLOOR + 10 + Math.sin(x * 0.01 + this.time * 0.5) * 12, 90, 0, Math.PI * 2); ctx.fill(); }
    }
    // storm markers
    for (const st of this.strikes) this.drawStrike(ctx, st);
    // pickups
    for (const p of this.pickups) this.drawPickup(ctx, p);
    // creatures
    for (const c of this.creatures) { if (!c.dead && c.x > cx - 400 && c.x < cx + vw + 400 && c.y > cy - 400 && c.y < cy + vh + 400) this.drawCreature(ctx, c); }
    // ropes
    this.drawRopes(ctx);
    // escorts, ship
    for (const e of this.escorts) if (!e.dead) this.drawEscort(ctx, e);
    this.drawChaserTags(ctx);
    if (!this.wrecked) this.drawShip(ctx);
    this.drawAimPreview(ctx);
    // bullets
    for (const b of this.bullets) {
      ctx.fillStyle = b.friendly ? "#fff2c0" : b.kind === "orb" ? "#8ffff0" : "#ff8a5a";
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    }
    // particles
    for (const p of this.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 2) { ctx.globalAlpha = a * 0.8; ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a * 0.9) + 4, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.globalAlpha = 1;
    // floaters
    ctx.textAlign = "center"; ctx.lineJoin = "round";
    for (const f of this.floaters) {
      const a = clamp(f.life / f.max * 2, 0, 1); const sc = 1 + Math.max(0, f.life / f.max - 0.8) * 2;
      ctx.globalAlpha = a; ctx.font = `700 ${f.size * sc}px Georgia, serif`;
      ctx.lineWidth = 4; ctx.strokeStyle = "rgba(10,10,30,0.8)"; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // screen overlays
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawWeatherOverlay(ctx);
    this.drawHUD(ctx);
  }

  private drawWeatherOverlay(ctx: CanvasRenderingContext2D) {
    const { W, H } = this; const t = this.time;
    const w = this.wx;
    if (w.storm > 0.02) {
      ctx.fillStyle = `rgba(8,6,30,${w.storm * 0.42})`; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(190,200,255,0.35)"; ctx.lineWidth = 1.2; ctx.beginPath();
      const n = Math.floor(w.storm * 130); const slant = clamp(w.wind / 300, -1, 1) * 30;
      for (let i = 0; i < n; i++) { const x = (i * 97 + t * 90 * Math.sign(w.wind || 1)) % (W + 100); const y = (i * 53 + t * 900) % (H + 40); ctx.moveTo(x, y); ctx.lineTo(x + slant * 0.5, y + 22); }
      ctx.stroke();
    }
    if (w.gale > 0.05) {
      ctx.strokeStyle = `rgba(230,250,255,${0.35 * w.gale})`; ctx.lineWidth = 1.5; ctx.beginPath();
      const n = Math.floor(w.gale * 36); const dir = Math.sign(w.wind || 1);
      for (let i = 0; i < n; i++) { const x = ((i * 131 + t * 600 * dir) % (W + 200) + W + 200) % (W + 200) - 100; const y = (i * 71) % H; ctx.moveTo(x, y); ctx.lineTo(x + dir * 70, y); }
      ctx.stroke();
    }
    if (w.fog > 0.02) {
      const sx = (this.ship.x - this.cam.x) * this.scale, sy = (this.ship.y - this.cam.y) * this.scale;
      const r0 = (380 + this.stats.nav * 50) * this.scale;
      const g = ctx.createRadialGradient(sx, sy, r0 * 0.6, sx, sy, r0 + 280 * this.scale);
      g.addColorStop(0, "rgba(190,200,212,0)"); g.addColorStop(1, `rgba(190,200,212,${0.96 * w.fog})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (this.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, this.flash * 0.5)})`; ctx.fillRect(0, 0, W, H); }
    const hpF = this.ship.hp / this.ship.maxHp;
    if (hpF < 0.3) { const a = (0.3 - hpF) * (0.7 + 0.3 * Math.sin(t * 6)); const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.8); g.addColorStop(0, "rgba(255,0,0,0)"); g.addColorStop(1, `rgba(255,30,30,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  }

  private drawStrike(ctx: CanvasRenderingContext2D, st: Strike) {
    if (st.dmg > 0) {
      const f = clamp(st.t / st.delay, 0, 1);
      ctx.strokeStyle = `rgba(255,240,120,${0.3 + 0.5 * f})`; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(st.x, st.y, st.r * (1.1 - f * 0.1), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = `rgba(255,240,120,${0.08 + 0.2 * f})`; ctx.beginPath(); ctx.arc(st.x, st.y, st.r * f, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = "#fffbd0"; ctx.lineWidth = 8; ctx.shadowColor = "#fff27a"; ctx.shadowBlur = 20; ctx.beginPath();
      let x = st.x + rnd(-10, 10), y = st.y - 1200; ctx.moveTo(x, y);
      while (y < st.y) { y += 70; x = st.x + rnd(-45, 45) * (y < st.y ? 1 : 0); ctx.lineTo(x, Math.min(y, st.y)); }
      ctx.stroke(); ctx.shadowBlur = 0;
    }
  }

  private drawPickup(ctx: CanvasRenderingContext2D, p: Pickup) {
    const by = Math.sin(p.bob) * 4; const a = p.life < 5 ? 0.4 + 0.6 * Math.abs(Math.sin(p.life * 6)) : 1;
    ctx.globalAlpha = a;
    if (p.good === null) {
      ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "#a8741a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y + by, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#a8741a"; ctx.font = "700 13px Georgia"; ctx.textAlign = "center"; ctx.fillText("¢", p.x, p.y + by + 5);
    } else {
      const col = GOODS[p.good].color;
      ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.fillStyle = "#4a3320"; ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.roundRect(p.x - 11, p.y + by - 11, 22, 22, 4); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.font = "14px serif"; ctx.textAlign = "center"; ctx.fillText(GOODS[p.good].icon, p.x, p.y + by + 5);
    }
    ctx.globalAlpha = 1;
  }

  private drawCreature(ctx: CanvasRenderingContext2D, c: Creature) {
    const def = c.def;
    ctx.save(); ctx.translate(c.x, c.y);
    if (c.boss || def.ai === "apex") { const g = ctx.createRadialGradient(0, 0, c.r * 0.5, 0, 0, c.r * 2.2); g.addColorStop(0, def.col2 + "55"); g.addColorStop(1, def.col2 + "00"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, c.r * 2.2, 0, Math.PI * 2); ctx.fill(); }
    const wind = c.state === "wind";
    if (wind) { ctx.translate(Math.sin(c.t * 60) * 3, 0); }
    ctx.scale(c.face >= 0 ? 1 : -1, 1);
    const tilt = clamp(c.vy / 250, -0.4, 0.4) * (c.exhausted > 0 ? 0.3 : 1);
    ctx.rotate(tilt + (c.exhausted > 0 ? Math.sin(c.t * 2) * 0.08 : 0));
    const flash = c.flash > 0.01;
    const body = flash ? "#ffffff" : def.col; const accent = def.col2;
    const r = c.r;
    switch (def.shape) {
      case "whale": {
        ctx.fillStyle = body; ctx.beginPath(); ctx.ellipse(0, 0, r * 1.3, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? "#fff" : accent; ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.2, r * 1.15, r * 0.45, 0, 0, Math.PI); ctx.fill();
        const fl = Math.sin(c.t * 3) * r * 0.35;
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(-r * 1.1, 0); ctx.quadraticCurveTo(-r * 1.8, fl - r * 0.5, -r * 1.9, fl - r * 0.7); ctx.quadraticCurveTo(-r * 1.6, fl, -r * 1.9, fl + r * 0.7); ctx.quadraticCurveTo(-r * 1.8, fl + r * 0.5, -r * 1.1, r * 0.1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.4); ctx.quadraticCurveTo(r * 0.3, r * 1.1 + Math.sin(c.t * 2) * 6, -r * 0.3, r * 1.0); ctx.quadraticCurveTo(-r * 0.1, r * 0.6, r * 0.1, r * 0.4); ctx.fill();
        ctx.fillStyle = "#101820"; ctx.beginPath(); ctx.arc(r * 0.8, -r * 0.18, Math.max(3, r * 0.07), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 1.2, r * 0.1); ctx.quadraticCurveTo(r * 0.8, r * 0.3, r * 0.5, r * 0.22); ctx.stroke();
        if (def.ai === "apex" || def.ai === "bull") { ctx.fillStyle = flash ? "#fff" : accent; for (let i = 0; i < 6; i++) { const x = -r * 0.9 + i * r * 0.35; ctx.beginPath(); ctx.moveTo(x, -r * 0.62); ctx.lineTo(x + r * 0.1, -r * (0.9 + (def.ai === "apex" ? 0.25 : 0.05))); ctx.lineTo(x + r * 0.2, -r * 0.6); ctx.fill(); } }
        break;
      }
      case "manta": {
        const fl = Math.sin(c.t * 3.2) * r * 0.5;
        ctx.fillStyle = body; ctx.beginPath(); ctx.moveTo(r * 0.9, 0); ctx.quadraticCurveTo(r * 0.2, -r * 0.5 + fl * 0.3, -r * 0.6, -r * 1.4 + fl); ctx.quadraticCurveTo(-r * 0.3, -r * 0.1, -r * 0.5, 0);
        ctx.quadraticCurveTo(-r * 0.3, r * 0.1, -r * 0.6, r * 1.4 - fl * 0.2); ctx.quadraticCurveTo(r * 0.2, r * 0.5, r * 0.9, 0); ctx.fill();
        ctx.fillStyle = flash ? "#fff" : accent; ctx.beginPath(); ctx.ellipse(r * 0.1, 0, r * 0.6, r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = body; ctx.lineWidth = Math.max(2, r * 0.06); ctx.beginPath(); ctx.moveTo(-r * 0.5, 0); ctx.quadraticCurveTo(-r * 1.2, Math.sin(c.t * 4) * r * 0.3, -r * 1.7, Math.sin(c.t * 4 + 1) * r * 0.4); ctx.stroke();
        ctx.fillStyle = "#101820"; ctx.beginPath(); ctx.arc(r * 0.6, -r * 0.08, Math.max(2.5, r * 0.06), 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "jelly": {
        const pul = 1 + Math.sin(c.t * 2.5) * 0.08;
        const gl = ctx.createRadialGradient(0, -r * 0.2, 2, 0, 0, r * 1.5); gl.addColorStop(0, flash ? "#fff" : accent); gl.addColorStop(0.5, body + "cc"); gl.addColorStop(1, body + "00");
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = flash ? "#fff" : body; ctx.beginPath(); ctx.ellipse(0, -r * 0.1, r * pul, r * 0.8 / pul, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = Math.max(1.5, r * 0.05); ctx.globalAlpha = 0.85;
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.28, -r * 0.1); for (let k = 1; k <= 5; k++) ctx.lineTo(i * r * 0.28 + Math.sin(c.t * 3 + k + i) * r * 0.12, -r * 0.1 + k * r * 0.28); ctx.stroke(); }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.35, r * 0.1, 0, Math.PI * 2); ctx.arc(r * 0.25, -r * 0.35, r * 0.1, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "eel": {
        const n = 16, sp = r * 0.55;
        for (let i = n - 1; i >= 0; i--) {
          const x = -i * sp, y = Math.sin(c.t * 5 - i * 0.55) * r * 0.45 * (i / n + 0.2);
          const rr = r * (1 - i / (n + 4)) * 0.9;
          ctx.fillStyle = i % 4 === 0 ? (flash ? "#fff" : accent) : body; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = flash ? "#fff" : body; ctx.beginPath(); ctx.ellipse(r * 0.2, 0, r * 1.1, r * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.2, Math.max(3, r * 0.14), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.shadowColor = accent; ctx.shadowBlur = 8; ctx.beginPath();
        for (let k = 0; k < 3; k++) { let x = -r * (0.5 + k * 0.9), y = -r * 0.7; ctx.moveTo(x, y); for (let j = 0; j < 4; j++) { x += rnd(-8, 8); y -= r * 0.18; ctx.lineTo(x, y); } }
        ctx.stroke(); ctx.shadowBlur = 0;
        break;
      }
      case "skiff": {
        ctx.fillStyle = flash ? "#fff" : accent; ctx.beginPath(); ctx.ellipse(0, -r * 0.95, r * 1.0, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = body; ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * r * 0.35, -r * 1.5); ctx.quadraticCurveTo(i * r * 0.5, -r * 0.95, i * r * 0.35, -r * 0.4); ctx.stroke(); }
        ctx.fillStyle = flash ? "#fff" : body; ctx.beginPath(); ctx.moveTo(-r * 1.05, -r * 0.1); ctx.lineTo(r * 1.15, -r * 0.1); ctx.lineTo(r * 0.7, r * 0.55); ctx.lineTo(-r * 0.8, r * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#2a1a14"; ctx.fillRect(r * 0.9, r * 0.05, r * 0.6, r * 0.14);
        ctx.fillStyle = "#e9e2cf"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * 0.5 + i * r * 0.45, r * 0.22, r * 0.09, 0, Math.PI * 2); ctx.fill(); }
        ctx.fillStyle = "#1a1a1a"; ctx.fillRect(-r * 0.05, -r * 1.7, 3, r * 0.7); ctx.fillStyle = "#222"; ctx.beginPath(); ctx.moveTo(0, -r * 1.7); ctx.lineTo(r * 0.45, -r * 1.55); ctx.lineTo(0, -r * 1.4); ctx.fill();
        if (def.ai === "apex") { ctx.fillStyle = body; ctx.fillRect(-r * 0.6, -r * 0.45, r * 1.2, r * 0.35); ctx.fillStyle = accent; for (let i = 0; i < 4; i++) ctx.fillRect(-r * 0.5 + i * r * 0.3, -r * 0.35, r * 0.12, r * 0.12); }
        break;
      }
    }
    ctx.restore();
    // bars
    const showBars = c.hooks > 0 || c.hp < c.maxHp * 0.98 || c.boss;
    if (showBars && !c.boss) {
      const w = Math.max(50, c.r * 1.6); const y = c.y - c.r * (def.shape === "skiff" ? 1.9 : 1.05) - 14;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(c.x - w / 2 - 1, y - 1, w + 2, c.hooks > 0 ? 12 : 7);
      ctx.fillStyle = "#e0544a"; ctx.fillRect(c.x - w / 2, y, w * clamp(c.hp / c.maxHp, 0, 1), 5);
      if (c.hooks > 0) { ctx.fillStyle = c.exhausted > 0 ? "#ffe566" : "#7ad0ff"; ctx.fillRect(c.x - w / 2, y + 6, w * clamp(c.stam / c.maxStam, 0, 1), 4); }
    }
    if (c.exhausted > 0) { ctx.font = "700 14px Georgia"; ctx.textAlign = "center"; ctx.fillStyle = "#ffe566"; ctx.fillText("★ ★ ★", c.x, c.y - c.r - 28 + Math.sin(c.t * 4) * 3); }
    if (c.state === "wind" && c.act === "charge") {
      ctx.strokeStyle = "rgba(255,90,70,0.55)"; ctx.lineWidth = 4; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.x + c.dx * 700, c.y + c.dy * 700); ctx.stroke(); ctx.setLineDash([]);
    }
    if (c.tagged > 0) { ctx.strokeStyle = "#9be7ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 8, 0, Math.PI * 2); ctx.stroke(); }
    if (c.tame && this.p.tutorial && this.tut <= 2) { ctx.fillStyle = "#ffe566"; ctx.font = "700 22px Georgia"; ctx.textAlign = "center"; ctx.fillText("▼", c.x, c.y - c.r - 36 + Math.sin(this.time * 5) * 6); }
  }

  private drawRopes(ctx: CanvasRenderingContext2D) {
    const g = this.gun();
    for (const h of this.harpoons) {
      const d = hyp(h.x - g.x, h.y - g.y);
      const ratio = h.state === "hooked" ? h.T / this.stats.maxT : 0;
      const col = ratio > 0.85 ? "#ff5a4a" : ratio > 0.4 ? "#ffc247" : "#f3ead2";
      const slack = h.state === "hooked" ? Math.max(0, h.L - d) : h.state === "fly" ? 30 : 0;
      const sag = Math.min(80, slack * 0.45);
      const shake = ratio > 0.85 ? rnd(-3, 3) : 0;
      ctx.strokeStyle = col; ctx.lineWidth = 2.5 + ratio * 2.5; ctx.beginPath(); ctx.moveTo(g.x, g.y);
      ctx.quadraticCurveTo((g.x + h.x) / 2 + shake, (g.y + h.y) / 2 + sag + shake, h.x, h.y); ctx.stroke();
      if (h.state === "fly") {
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 2; ctx.beginPath(); h.trail.forEach((t, i) => (i ? ctx.lineTo(t.x, t.y) : ctx.moveTo(t.x, t.y))); ctx.stroke();
      }
      const a = h.state === "hooked" && h.target ? Math.atan2(h.oy * -1, h.ox * -1) + Math.PI : Math.atan2(h.vy, h.vx);
      ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(a);
      ctx.fillStyle = "#d8dde6"; ctx.strokeStyle = "#444"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-4, -6); ctx.lineTo(-1, 0); ctx.lineTo(-4, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#6b4a2a"; ctx.fillRect(-18, -1.5, 15, 3);
      ctx.restore();
    }
  }

  private drawAimPreview(ctx: CanvasRenderingContext2D) {
    if (this.wrecked || this.harpoons.length >= this.stats.slots) return;
    const s = this.ship; const g = this.gun();
    const power = this.charging ? Math.max(0.18, this.charge) : 0.6;
    const sp = (520 + 820 * power) * this.stats.harpSpeed;
    let x = g.x, y = g.y, vx = Math.cos(s.aim) * sp + s.vx * 0.5, vy = Math.sin(s.aim) * sp + s.vy * 0.5;
    const steps = Math.floor(this.stats.preview * 16);
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < 3; k++) { vy += 430 * 0.02; vx += this.windAt(x) * 0.9 * 0.02; x += vx * 0.02; y += vy * 0.02; }
      ctx.globalAlpha = (1 - i / steps) * (this.charging ? 0.9 : 0.5); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(x, y, 3.2 - (i / steps) * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private drawChaserTags(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = "rgba(155,231,255,0.6)"; ctx.lineWidth = 2;
    for (const e of this.escorts) if (e.kind === "chaser" && !e.dead && e.target && !e.target.dead) { ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.target.x, e.target.y); ctx.stroke(); }
  }

  private drawShip(ctx: CanvasRenderingContext2D) {
    const s = this.ship;
    if (s.iframes > 0 && Math.floor(this.time * 20) % 2 === 0) ctx.globalAlpha = 0.5;
    ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.tilt); ctx.scale(s.face, 1);
    // balloon
    ctx.fillStyle = "#c8453a"; ctx.beginPath(); ctx.ellipse(0, -44, 70, 40, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -44, 70, 40, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#f2e4c4"; for (let i = -3; i <= 3; i += 2) ctx.fillRect(i * 18 - 9, -90, 18, 100);
    const sh = ctx.createLinearGradient(0, -84, 0, -4); sh.addColorStop(0, "rgba(255,255,255,0.28)"); sh.addColorStop(1, "rgba(0,0,40,0.3)"); ctx.fillStyle = sh; ctx.fillRect(-80, -90, 160, 100);
    ctx.restore();
    ctx.strokeStyle = "#5a3d24"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -44, 70, 40, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-40, -12); ctx.lineTo(-24, 14); ctx.moveTo(40, -12); ctx.lineTo(24, 14); ctx.moveTo(0, -4); ctx.lineTo(0, 14); ctx.stroke();
    // gondola
    ctx.fillStyle = "#7b5330"; ctx.beginPath(); ctx.moveTo(-34, 12); ctx.lineTo(36, 12); ctx.quadraticCurveTo(34, 42, 12, 44); ctx.lineTo(-22, 44); ctx.quadraticCurveTo(-36, 40, -34, 12); ctx.fill();
    ctx.strokeStyle = "#3a2615"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#ffd98a"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-16 + i * 16, 26, 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowColor = "#ffcf6a"; ctx.shadowBlur = 12; ctx.fillStyle = "#ffcf6a"; ctx.beginPath(); ctx.arc(0, 8, 3, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    // propeller
    ctx.save(); ctx.translate(-40, 26); ctx.fillStyle = "#4a3320"; ctx.fillRect(-6, -4, 8, 8);
    ctx.scale(1, Math.cos(s.prop)); ctx.fillStyle = "#cbd0d8"; ctx.fillRect(-3, -22, 4, 44); ctx.restore();
    // flag
    ctx.strokeStyle = "#3a2615"; ctx.beginPath(); ctx.moveTo(-8, -84); ctx.lineTo(-8, -104); ctx.stroke();
    ctx.fillStyle = "#ffd23f"; ctx.beginPath(); ctx.moveTo(-8, -104); ctx.lineTo(-30 + Math.sin(this.time * 6) * 4, -98); ctx.lineTo(-8, -92); ctx.fill();
    ctx.restore();
    // harpoon gun (not flipped scale: use aim angle)
    const g = this.gun();
    ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(s.aim);
    ctx.fillStyle = "#2d2d33"; ctx.fillRect(-4, -5, 34, 10); ctx.fillStyle = "#8a6a3a"; ctx.fillRect(-10, -6, 12, 12);
    if (this.harpoons.length < this.stats.slots) { ctx.fillStyle = "#d8dde6"; ctx.beginPath(); ctx.moveTo(40 - this.charge * 6, 0); ctx.lineTo(28, -4); ctx.lineTo(28, 4); ctx.fill(); }
    ctx.restore();
    ctx.globalAlpha = 1;
    // hull bar over ship when damaged
    if (s.hp < s.maxHp * 0.99) {
      const w = 90; ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(s.x - w / 2 - 1, s.y + 52, w + 2, 7);
      ctx.fillStyle = s.hp / s.maxHp > 0.3 ? "#6ee09a" : "#ff5a4a"; ctx.fillRect(s.x - w / 2, s.y + 53, w * s.hp / s.maxHp, 5);
    }
  }

  private drawEscort(ctx: CanvasRenderingContext2D, e: EscortE) {
    ctx.save(); ctx.translate(e.x, e.y + Math.sin(e.phase * 2 + e.id) * 4); const f = this.ship.face; ctx.scale(f, 1);
    const col = e.kind === "harrier" ? "#8a8fa8" : e.kind === "chaser" ? "#4a8fb0" : "#9a7a4a";
    const sc = e.kind === "hauler" ? 1.15 : 0.75;
    ctx.scale(sc, sc);
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -30, 50, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3a2615"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#6b4a2a"; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(28, 0); ctx.lineTo(18, 24); ctx.lineTo(-18, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    if (e.kind === "harrier") { ctx.fillStyle = "#222"; ctx.fillRect(18, 8, 22, 5); }
    if (e.kind === "hauler") { ctx.fillStyle = "#b08a50"; ctx.fillRect(-20, -4, 16, 12); ctx.fillRect(2, -4, 16, 12); const g = ctx.createLinearGradient(0, 24, 0, 120); g.addColorStop(0, "rgba(140,255,230,0.25)"); g.addColorStop(1, "rgba(140,255,230,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-14, 24); ctx.lineTo(14, 24); ctx.lineTo(40, 120); ctx.lineTo(-40, 120); ctx.fill(); }
    ctx.restore();
    const w = 44; ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(e.x - w / 2, e.y + 34, w, 5); ctx.fillStyle = "#6ee09a"; ctx.fillRect(e.x - w / 2, e.y + 34, w * clamp(e.hp / e.maxHp, 0, 1), 5);
  }

  // ---------------- HUD ----------------
  private txt(s: string, x: number, y: number, size: number, color = "#fff", align: CanvasTextAlign = "left", weight = 700) {
    const ctx = this.ctx; ctx.font = `${weight} ${size}px Georgia, serif`; ctx.textAlign = align; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(8,10,28,0.85)"; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  private bar(x: number, y: number, w: number, h: number, v: number, col: string, label: string) {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(10,12,30,0.65)"; ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, h + 4, 5); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w * clamp(v, 0, 1)), h, 4); ctx.fill();
    this.txt(label, x + 6, y + h - 4, h - 4, "#fff", "left", 700);
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    const { W, H } = this; const s = this.ship; const st = this.stats;
    const small = W < 700;
    const uw = small ? 150 : 230;
    this.bar(14, 14, uw, 20, s.hp / s.maxHp, s.hp / s.maxHp > 0.3 ? "#3fae6a" : "#d6453a", `HULL ${Math.ceil(s.hp)}/${s.maxHp}`);
    this.bar(14, 42, uw, 18, s.fuel / st.maxFuel, s.fuel / st.maxFuel > 0.2 ? "#d9a441" : "#d6453a", `FUEL ${Math.ceil(s.fuel)}`);
    const used = this.cargoCount();
    this.txt(`📦 ${used}/${st.hold}`, 14, 84, 16, used >= st.hold ? "#ff9a7a" : "#fff");
    this.txt(`¢ +${this.crowns}`, 100, 84, 16, "#ffe566");
    let gx = 14;
    GOOD_IDS.forEach((g) => { const n = this.gained[g]; if (n > 0) { this.txt(`${GOODS[g].icon}${n}`, gx, 106, 14, GOODS[g].color); gx += 46; } });
    // top right
    ctx.fillStyle = "rgba(10,12,30,0.55)"; ctx.beginPath(); ctx.roundRect(W - 62, 8, 40, 40, 20); ctx.fill();
    this.txt("❚❚", W - 28, 34, 14, "#fff", "center");
    const rx = W - 76;
    this.txt(this.region.name, rx, 28, 15, "#ffe9a8", "right");
    const wv = this.wx.wind;
    this.txt(`${wv >= 0 ? "→" : "←"} wind ${Math.abs(Math.round(wv / 10))}`, rx, 48, 13, Math.abs(wv) > 150 ? "#9be7ff" : "#cfd8e8", "right");
    let ix = rx; const icons: [FrontKind, number][] = [["gale", this.wx.gale], ["storm", this.wx.storm], ["fog", this.wx.fog], ["aurora", this.wx.aurora]];
    for (const [k, v] of icons) if (v > 0.1) { this.txt(FRONT_INFO[k].icon, ix, 70, 16, "#fff", "right"); ix -= 26; }
    if (this.p.camp.regions[this.p.camp.loc].threat >= 100 && this.apexT >= 0) this.txt(`⚠ APEX IN ${Math.ceil(this.apexT)}s`, rx, 92, 14, "#ff8a7a", "right");

    // boss bar
    const boss = this.creatures.find((c) => c.boss && !c.dead);
    if (boss) {
      const bw = Math.min(560, W - 120); const bx = W / 2 - bw / 2;
      this.txt(boss.def.name.toUpperCase(), W / 2, 30, 18, "#ffb0a0", "center");
      ctx.fillStyle = "rgba(10,12,30,0.7)"; ctx.fillRect(bx - 2, 36, bw + 4, 18);
      ctx.fillStyle = "#c93a3a"; ctx.fillRect(bx, 38, bw * clamp(boss.hp / boss.maxHp, 0, 1), 10);
      ctx.fillStyle = boss.exhausted > 0 ? "#ffe566" : "#6ec6ff"; ctx.fillRect(bx, 49, bw * clamp(boss.stam / boss.maxStam, 0, 1), 4);
      if (boss.exhausted > 0) this.txt("EXHAUSTED — LANCE IT!", W / 2, 72, 14, "#ffe566", "center");
      // offscreen arrow
      const bsx = (boss.x - this.cam.x) * this.scale, bsy = (boss.y - this.cam.y) * this.scale;
      if (bsx < 0 || bsx > W || bsy < 0 || bsy > H) { const a = Math.atan2(boss.y - s.y, boss.x - s.x); const ax = clamp(W / 2 + Math.cos(a) * W * 0.45, 30, W - 30), ay = clamp(H / 2 + Math.sin(a) * H * 0.45, 90, H - 30); ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = "#ff6a5a"; ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-10, 11); ctx.fill(); ctx.restore(); }
    }

    // radar
    const rw = Math.min(W - 28, small ? 260 : 340), rh = 54, rxx = 14, ryy = H - rh - 14;
    ctx.fillStyle = "rgba(10,14,34,0.65)"; ctx.beginPath(); ctx.roundRect(rxx - 4, ryy - 4, rw + 8, rh + 8, 8); ctx.fill();
    const mxs = rw / WW, mys = rh / WH;
    ctx.save(); ctx.beginPath(); ctx.rect(rxx, ryy, rw, rh); ctx.clip();
    for (const f of this.fronts) { ctx.fillStyle = FRONT_INFO[f.kind].color + "44"; ctx.fillRect(rxx + (f.x - f.w / 2) * mxs, ryy, f.w * mxs, rh); }
    const radar = st.radar;
    for (const c of this.creatures) {
      if (c.dead) continue; const d = hyp(c.x - s.x, c.y - s.y);
      if (d > radar && !c.boss) continue;
      ctx.fillStyle = c.boss ? "#ff4a3a" : c.def.hostile ? "#ff9a5a" : "#8fe3ff";
      ctx.beginPath(); ctx.arc(rxx + c.x * mxs, ryy + c.y * mys, c.boss ? 4 : 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#ffe566"; for (const p of this.pickups) ctx.fillRect(rxx + p.x * mxs, ryy + p.y * mys, 1.5, 1.5);
    const vw = W / this.scale, vh = H / this.scale;
    ctx.strokeStyle = "rgba(255,255,255,0.45)"; ctx.strokeRect(rxx + this.cam.x * mxs, ryy + this.cam.y * mys, vw * mxs, vh * mys);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(rxx + s.x * mxs, ryy + s.y * mys, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // tension gauge
    const hooked = this.harpoons.filter((h) => h.state === "hooked");
    if (hooked.length) {
      const gw = Math.min(360, W - 40), gxx = W / 2 - gw / 2, gyy = H - 52;
      ctx.fillStyle = "rgba(10,12,30,0.7)"; ctx.beginPath(); ctx.roundRect(gxx - 6, gyy - 24, gw + 12, 46, 8); ctx.fill();
      ctx.fillStyle = "#3a9a5a"; ctx.fillRect(gxx, gyy, gw * 0.4, 14);
      ctx.fillStyle = "#d9a441"; ctx.fillRect(gxx + gw * 0.4, gyy, gw * 0.45, 14);
      ctx.fillStyle = "#c9453a"; ctx.fillRect(gxx + gw * 0.85, gyy, gw * 0.15, 14);
      for (const h of hooked) {
        const r = clamp(h.T / st.maxT, 0, 1.05); const nx = gxx + gw * Math.min(1, r);
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(nx, gyy - 3); ctx.lineTo(nx - 6, gyy - 14); ctx.lineTo(nx + 6, gyy - 14); ctx.fill();
        if (h.over > 0) { this.txt("SNAPPING!", W / 2, gyy - 28, 16, "#ff6a5a", "center"); }
      }
      this.txt("ROPE TENSION", W / 2, gyy + 34 - 8 + 4, 11, "#cfd8e8", "center", 600);
      this.txt("hold SPACE / RMB to reel", W / 2, gyy - 28 + (hooked.some((h) => h.over > 0) ? -18 : 0), 12, "#cfd8e8", "center", 600);
    }
    // harpoon slots
    const sx0 = W - 30 - st.slots * 26;
    for (let i = 0; i < st.slots; i++) { const used = i < this.harpoons.length; ctx.fillStyle = used ? "rgba(255,255,255,0.2)" : "#f3ead2"; ctx.fillRect(sx0 + i * 26, H - 40, 8, 26); ctx.beginPath(); ctx.moveTo(sx0 + i * 26 - 4, H - 40); ctx.lineTo(sx0 + i * 26 + 4, H - 56); ctx.lineTo(sx0 + i * 26 + 12, H - 40); ctx.fill(); }
    // charge ring at cursor
    if (this.charging) {
      ctx.strokeStyle = "rgba(255,255,255,0.3)"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(this.mx, this.my, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = this.charge > 0.95 ? "#ffe566" : "#7ad0ff"; ctx.beginPath(); ctx.arc(this.mx, this.my, 22, -Math.PI / 2, -Math.PI / 2 + this.charge * Math.PI * 2); ctx.stroke();
    }
    // crosshair
    if (!this.touchUI || this.mouseDown) {
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(this.mx, this.my, 8, 0, Math.PI * 2); ctx.moveTo(this.mx - 14, this.my); ctx.lineTo(this.mx - 5, this.my); ctx.moveTo(this.mx + 5, this.my); ctx.lineTo(this.mx + 14, this.my); ctx.moveTo(this.mx, this.my - 14); ctx.lineTo(this.mx, this.my - 5); ctx.moveTo(this.mx, this.my + 5); ctx.lineTo(this.mx, this.my + 14); ctx.stroke();
    }
    // return ring
    if (this.returnT > 0.05) {
      this.txt("RETURNING TO PORT…", W / 2, H / 2 - 90, 20, "#ffe9a8", "center");
      ctx.strokeStyle = "#ffe9a8"; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(W / 2, H / 2 - 60, 18, -Math.PI / 2, -Math.PI / 2 + (this.returnT / 1.5) * Math.PI * 2); ctx.stroke();
    }
    if (this.adriftT >= 0) this.txt(`ADRIFT — towed in ${Math.ceil(this.adriftT)}s`, W / 2, H / 2 - 120, 22, "#ff8a7a", "center");
    // banners
    this.banners.forEach((b, i) => { const a = clamp(Math.min(b.t, b.max - b.t + 0.0) * 3, 0, 1); ctx.globalAlpha = a; this.txt(b.text, W / 2, H * 0.22 + i * 34, small ? 20 : 26, b.color, "center"); ctx.globalAlpha = 1; });
    // tutorial
    if (this.p.tutorial && !this.tutDone && this.p.settings.tips) {
      const msgs = [
        "Fly with W A S D / arrow keys. Approach the Cloud Drifter ahead (▼).",
        "Aim with the mouse. HOLD left-click to charge a harpoon, release to throw. Gravity and wind bend its arc!",
        "Hit it! Now HOLD SPACE (or right-click) to reel. Keep tension in the AMBER zone — red snaps the rope.",
        "Tension drains stamina. When it's EXHAUSTED, stay close — your crew lances it. Reel it in!",
        "Fly over the floating barrels to collect loot. Your hold has limited space.",
        "Hold R to sail home and sell your haul. Fuel is limited — and the Guild always wants its tribute.",
      ];
      const m = msgs[Math.min(this.tut, 5)];
      const tw = Math.min(W - 40, 640);
      ctx.fillStyle = "rgba(14,18,44,0.82)"; ctx.strokeStyle = "#e0b45a"; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(W / 2 - tw / 2, 108, tw, 58, 10); ctx.fill(); ctx.stroke();
      this.wrapText(m, W / 2, 132, tw - 28, 17, "#fff4d6");
      this.txt(`Tutorial ${Math.min(this.tut + 1, 6)}/6`, W / 2 - tw / 2 + 10, 104, 11, "#e0b45a");
    }
    if (this.hintT > 0 && !this.touchUI) { ctx.globalAlpha = Math.min(1, this.hintT / 3); this.txt("WASD fly · LMB charge+throw · SPACE/RMB reel · SHIFT boost · E cut rope · hold R return · P pause", W / 2, H - 76, 12, "#dfe7f5", "center", 600); ctx.globalAlpha = 1; }
    if (this.touchUI) this.drawTouch(ctx);
  }

  private wrapText(text: string, x: number, y: number, maxW: number, size: number, color: string) {
    const ctx = this.ctx; ctx.font = `600 ${size}px Georgia, serif`; ctx.textAlign = "center"; ctx.fillStyle = color;
    const words = text.split(" "); let line = ""; let yy = y;
    for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += size + 3; } else line = t; }
    ctx.fillText(line, x, yy);
  }

  private drawTouch(ctx: CanvasRenderingContext2D) {
    const { W, H } = this;
    const btn = (x: number, y: number, r: number, label: string, on: boolean) => { ctx.fillStyle = on ? "rgba(255,230,150,0.5)" : "rgba(255,255,255,0.18)"; ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); this.txt(label, x, y + 5, 13, "#fff", "center"); };
    btn(W - 80, H - 90, 44, "REEL", this.touchReel); btn(W - 175, H - 55, 36, "BOOST", this.touchBoost); btn(W - 60, 110, 30, "HOME", this.touchReturn);
    const jx = this.joy.active ? this.joy.ox : W * 0.14, jy = this.joy.active ? this.joy.oy : H - 110;
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.arc(jx, jy, 50, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(jx + this.joy.x * 40, jy + this.joy.y * 40, 22, 0, Math.PI * 2); ctx.fill();
  }
}

// ---- drawing utils ----
function hex(c: string): [number, number, number] { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(c0: string, c1: string, c2: string, t: number): string {
  t = clamp(t, 0, 1); const a = hex(c0), b = hex(c1), c = hex(c2);
  const [p, q, f] = t < 0.5 ? [a, b, t * 2] : [b, c, (t - 0.5) * 2];
  return `rgb(${Math.round(p[0] + (q[0] - p[0]) * f)},${Math.round(p[1] + (q[1] - p[1]) * f)},${Math.round(p[2] + (q[2] - p[2]) * f)})`;
}
function cloudPuff(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, Math.PI * 2); ctx.arc(x + s * 0.5, y + s * 0.08, s * 0.38, 0, Math.PI * 2); ctx.arc(x - s * 0.5, y + s * 0.1, s * 0.34, 0, Math.PI * 2); ctx.arc(x + s * 0.1, y - s * 0.25, s * 0.35, 0, Math.PI * 2); ctx.fill();
}
