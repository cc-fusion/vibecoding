import { audio } from "./audio";
import { DIFFS, GOODS, GOOD_IDS, LEGS, TUTORIAL_STEPS, VTYPES, WEATHER, type WeatherDef, type WeatherType } from "./data";
import { EVENTS, type EventBuilt, type EventCtx } from "./events";
import { render } from "./render";
import {
  addBond, clampResources, derive, getBond, goodsTotal, hullMax, mulberry32, refreshMarket, roleFactor,
  type Crew, type Derived, type Run, type Vehicle,
} from "./run";
import type {
  Aval, Bullet, Crate, Crev, Flake, Floater, GameCallbacks, Hud, HudLog, Part, Raider, Serac, Thin, TrailPt,
} from "./types";

export const SP = 56; // spacing between vehicles
const CH = 420; // generation chunk height
export const WALL = 640;
export const TUT_LEN = 3600;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

export interface GameOpts { tutorial: boolean; shake: boolean; }

export class Game implements EventCtx {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  light: HTMLCanvasElement;
  W = 800; H = 600; dpr = 1; sc = 1;
  run: Run; cb: GameCallbacks; tutorial: boolean; shakeOn: boolean;
  leg = 0; def = LEGS[0]; rng: () => number = Math.random; final = false; length = 7000;
  d!: Derived;
  keys = new Set<string>(); holds = new Set<string>(); actions: string[] = [];
  paused = false; modal = false; ended = false; arrived = false; raf = 0; last = 0; real = 0; destroyed = false;
  lead!: Vehicle;
  speed = 0; heading = 0; slipX = 0; leadS = 0; airT = -1; airDur = 0.7; jumpCd = 0;
  trail: TrailPt[] = []; prevAir = new Map<number, number>();
  camX = 0; camY = 0; shake = 0;
  crevs: Crev[] = []; seracs: Serac[] = []; thins: Thin[] = []; crates: Crate[] = []; avals: Aval[] = [];
  raiders: Raider[] = []; bullets: Bullet[] = []; parts: Part[] = []; floats: Floater[] = []; flakes: Flake[] = [];
  genY = 0; nextCrev = 1;
  pattern: CanvasPattern | null = null;
  wc = 0; wType: WeatherType = "clear"; wNext: WeatherType = "clear"; wTimer = 30; windDir = 1;
  cur: WeatherDef = { ...WEATHER.clear };
  quakeIn = 50; quakeWarn = 0; quakeT = 0; qk = 0;
  raidIn = 60; eventIn = 40; camping = false; campT = 0; outOfFuelT = 0;
  mawY = -9999; mawPulse = 0; arriveDelay = 0;
  tutStep = 0; tutRaider = false;
  temp = -5; teff = -5; dark = 0; drift = 0; throttleIn = 0; bondAcc = 0; hudAcc = 0; audAcc = 0; jetCd = 0;
  logs: HudLog[] = []; logId = 1;
  pending: EventBuilt | null = null;
  stuckNow = false; attached = 0; onThin = false; gp = { left: false, right: false, up: false, down: false };
  gpPrev: boolean[] = [];

  constructor(canvas: HTMLCanvasElement, run: Run, opts: GameOpts, cb: GameCallbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.light = document.createElement("canvas");
    this.run = run; this.cb = cb; this.tutorial = opts.tutorial; this.shakeOn = opts.shake;
    this.d = derive(run);
    for (let i = 0; i < 170; i++) this.flakes.push({ x: Math.random(), y: Math.random(), z: Math.random() });
    this.resize();
    this.startLeg(opts.tutorial ? 0 : run.station);
  }

  /* ------------------------------------------------------------ lifecycle */
  start() {
    this.last = performance.now();
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.raf = requestAnimationFrame(this.loop);
  }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    audio.silenceLoops();
  }
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(200, r.width); this.H = Math.max(200, r.height);
    this.canvas.width = Math.floor(this.W * this.dpr); this.canvas.height = Math.floor(this.H * this.dpr);
    this.light.width = this.canvas.width; this.light.height = this.canvas.height;
    this.sc = clamp(Math.min(this.H / 780, this.W / 900), 0.45, 1.4);
  }
  setPaused(p: boolean) { this.paused = p; if (p) audio.silenceLoops(); }
  setShake(s: boolean) { this.shakeOn = s; }
  onBlur = () => { this.keys.clear(); this.holds.clear(); };
  onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "tab"].includes(k)) e.preventDefault();
    if (e.repeat) return;
    if (k === "escape" || k === "p") { this.cb.onPauseKey(); return; }
    if (k === "tab" || k === "g") { this.cb.onCrewKey(); return; }
    if (k === "m") { return; }
    this.keys.add(k);
    if (this.paused || this.modal || this.ended) return;
    if (k === " ") this.actions.push("jump");
    else if (k === "e") this.actions.push("bridge");
    else if (k === "c") this.actions.push("camp");
    else if (k === "r" || k === "f") this.actions.push("flare");
    else if (k === "j") this.actions.push("jettison");
  };
  onKeyUp = (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); };
  hold(a: string, down: boolean) { if (down) this.holds.add(a); else this.holds.delete(a); }
  press(a: string) { if (!this.paused && !this.modal && !this.ended) this.actions.push(a); }

  loop = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.05, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused && !this.modal && !this.ended) this.update(dt);
    else this.updateIdle(dt);
    render(this);
    this.raf = requestAnimationFrame(this.loop);
  };
  updateIdle(dt: number) {
    // keep the world visually alive while a menu is open
    this.shake *= 0.9;
    for (const f of this.flakes) { f.y += dt * 0.02 * (0.5 + f.z); if (f.y > 1) f.y -= 1; }
    if (this.paused || this.modal) return;
  }

  /* ------------------------------------------------------------ leg setup */
  startLeg(leg: number) {
    const run = this.run;
    this.leg = leg;
    this.def = LEGS[Math.min(leg, LEGS.length - 1)];
    this.final = !this.tutorial && leg === LEGS.length - 1;
    this.length = this.tutorial ? TUT_LEN : this.def.length;
    this.rng = mulberry32(run.seed * 131 + leg * 7919 + 17);
    this.crevs = []; this.seracs = []; this.thins = []; this.crates = []; this.avals = [];
    this.raiders = []; this.bullets = []; this.parts = []; this.floats = [];
    this.genY = 0; this.arrived = false; this.arriveDelay = 0; this.camping = false; this.campT = 0;
    this.lead = run.vehicles[0];
    this.speed = 0; this.heading = 0; this.slipX = 0; this.leadS = 0; this.airT = -1; this.jumpCd = 0;
    this.prevAir.clear();
    run.vehicles.forEach((v, i) => {
      v.x = 0; v.y = -i * SP; v.ang = 0; v.air = -1; v.stuck = 0; v.immune = 0; v.bridgeId = -1; v.thin = 0; v.flash = 0; v.gunCd = 0;
    });
    this.trail = [];
    for (let k = 40; k >= 0; k--) this.trail.push({ x: 0, y: -k * 8, air: -1, s: -k * 8 });
    this.camX = 0; this.camY = 0; this.shake = 0;
    this.wc = 0; this.wType = "clear"; this.wTimer = 18 + Math.random() * 10; this.wNext = this.pickWeather();
    this.cur = { ...WEATHER.clear }; this.windDir = Math.random() < 0.5 ? -1 : 1;
    this.quakeWarn = 0; this.quakeT = 0; this.qk = 0;
    this.quakeIn = this.tutorial ? 1e9 : this.nextQuakeIn();
    this.raidIn = this.tutorial ? 1e9 : this.nextRaidIn();
    this.eventIn = this.tutorial ? 1e9 : 30 + Math.random() * 20;
    this.mawY = this.final ? -800 : -9999; this.mawPulse = 0;
    this.outOfFuelT = 0; this.tutStep = 0; this.tutRaider = false; this.modal = false; this.ended = false;
    this.pattern = this.makePattern(this.def.ground);
    if (this.tutorial) this.genTutorial();
    else {
      this.generate(1800);
      if (this.final) this.genFinal();
    }
    this.d = derive(run);
    this.say(this.tutorial ? "Tutorial: follow the prompts at the top." : `Leg ${leg + 1}: ${this.def.name}`, "#9fd8ff");
  }

  makePattern(cols: [string, string]) {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d");
    if (!g) return null;
    const grad = g.createLinearGradient(0, 0, 512, 512); grad.addColorStop(0, cols[0]); grad.addColorStop(1, cols[1]);
    g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    const rg = mulberry32(this.run.seed + this.leg * 13);
    for (let i = 0; i < 26; i++) {
      const x = rg() * 512, y = rg() * 512, r = 30 + rg() * 90;
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        gr.addColorStop(0, rg() < 0.5 ? "rgba(255,255,255,0.28)" : "rgba(90,150,210,0.16)"); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
    g.lineCap = "round";
    for (let i = 0; i < 42; i++) {
      const x = rg() * 512, y = rg() * 512, a = rg() * Math.PI, l = 20 + rg() * 70;
      g.strokeStyle = rg() < 0.6 ? "rgba(255,255,255,0.35)" : "rgba(80,140,200,0.2)"; g.lineWidth = 0.6 + rg() * 1.4;
      for (const ox of [-512, 0, 512]) for (const oy of [-512, 0, 512]) {
        g.beginPath(); g.moveTo(x + ox, y + oy); g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l); g.stroke();
      }
    }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,255,255,${0.15 + rg() * 0.35})`; g.fillRect(rg() * 512, rg() * 512, 1.5, 1.5); }
    return this.ctx.createPattern(c, "repeat");
  }

  mkCrev(x: number, y: number, ang: number, L: number, w0: number, hidden: boolean, chasm = false): Crev {
    const jag: number[] = [];
    for (let i = 0; i < 26; i++) jag.push(Math.random());
    return {
      id: this.nextCrev++, x, y, ang, ca: Math.cos(ang), sa: Math.sin(ang), L, w0, w: w0, grow: 1, fracture: 0,
      phase: Math.random() * 6.28, period: 5 + Math.random() * 6, amp: hidden ? 0.04 : chasm ? 0.03 : 0.1 + Math.random() * 0.22,
      hidden, revealed: false, jag, bridges: [], chasm,
    };
  }

  generate(upTo: number) {
    const def = this.def, diff = DIFFS[this.run.diffIdx] ?? DIFFS[1], rng = this.rng, leg = this.leg;
    const thinMod = this.run.mods.includes("thin");
    const dens = def.density * diff.crev * (thinMod ? 1.3 : 1);
    const last = def.length - 650;
    while (this.genY < upTo && this.genY < def.length) {
      const y0 = this.genY; this.genY += CH;
      if (y0 < 500 || y0 > last) continue;
      if (rng() < Math.min(0.5, (0.2 + 0.04 * leg) * diff.crev * (thinMod ? 1.2 : 1))) {
        const jumpable = rng() < 0.5;
        const hid = leg >= 1 && jumpable && rng() < def.hidden;
        const w = jumpable ? 34 + rng() * 28 : 78 + rng() * 50;
        this.crevs.push(this.mkCrev((rng() - 0.5) * 100, y0 + rng() * CH, (rng() - 0.5) * 0.3, 2300, hid ? 38 : w + leg * 3, hid));
      }
      const n = Math.floor(rng() * (dens * 2.2 + 1));
      for (let i = 0; i < n; i++) {
        const hid = rng() < def.hidden;
        const med = rng() < 0.22;
        const w = (hid ? 28 + rng() * 18 : med ? 72 + rng() * 38 : 22 + rng() * 38) * (1 + leg * 0.06);
        this.crevs.push(this.mkCrev((rng() - 0.5) * 1100, y0 + rng() * CH, (rng() - 0.5) * 1.7, 170 + rng() * 260, w, hid));
      }
      if (rng() < def.serac * 0.4) {
        const cx = (rng() - 0.5) * 1000, cy = y0 + rng() * CH, k = 2 + Math.floor(rng() * 3);
        for (let i = 0; i < k; i++) this.seracs.push({ x: cx + (rng() - 0.5) * 220, y: cy + (rng() - 0.5) * 160, r: 16 + rng() * 17, cd: 0, seed: rng() });
      }
      if (rng() < def.thin * (thinMod ? 2 : 1) * 0.5)
        this.thins.push({ x: (rng() - 0.5) * 1000, y: y0 + rng() * CH, rx: 120 + rng() * 110, ry: 80 + rng() * 60, warn: 0 });
      if (rng() < 0.5) this.crates.push(this.mkCrate((rng() - 0.5) * 1100, y0 + rng() * CH));
      if (leg >= 1 && rng() < 0.07 + 0.015 * leg)
        this.avals.push({ y: y0 + rng() * CH, h: 150, dir: rng() < 0.5 ? 1 : -1, t: 0, armed: false, hit: [], done: false });
    }
  }
  mkCrate(x: number, y: number): Crate {
    const r = this.rng();
    const kind = r < 0.28 ? "fuel" : r < 0.53 ? "food" : r < 0.73 ? "planks" : r < 0.9 ? "goods" : "scrip";
    return { x, y, kind, taken: false, bob: Math.random() * 6 };
  }
  genFinal() {
    const L = this.def.length;
    this.crevs.push(this.mkCrev(0, L - 450, 0, 2600, 230, false, true));
    for (let i = 0; i < 4; i++) this.crates.push({ x: (i - 1.5) * 150 + (Math.random() - 0.5) * 60, y: L - 1500 + i * 180, kind: "planks", taken: false, bob: i });
    for (let i = 0; i < 3; i++) this.crates.push({ x: (i - 1) * 260, y: L - 2600 + i * 200, kind: "fuel", taken: false, bob: i });
  }
  genTutorial() {
    for (const [x, y] of [[-140, 520], [-60, 580], [20, 540], [100, 600], [180, 520], [-210, 610]]) this.seracs.push({ x, y, r: 26, cd: 0, seed: Math.random() });
    this.crevs.push(this.mkCrev(0, 1050, 0, 2300, 46, false));
    this.crevs.push(this.mkCrev(0, 1700, 0, 2300, 120, false));
    const h = this.mkCrev(0, 2350, 0, 2300, 40, true); this.crevs.push(h);
    this.crates.push({ x: -80, y: 1450, kind: "planks", taken: false, bob: 0 }, { x: 90, y: 1480, kind: "fuel", taken: false, bob: 2 });
    this.thins.push({ x: 0, y: 2850, rx: 200, ry: 100, warn: 0 });
  }

  pickWeather(): WeatherType {
    if (this.tutorial) return "clear";
    const storm = this.def.storm * (this.run.mods.includes("night") ? 1.5 : 1);
    const r = Math.random();
    if (r < storm) return this.leg >= 3 && Math.random() < 0.4 ? "whiteout" : "blizzard";
    if (r < storm + 0.28) return "snow";
    if (this.dark > 0.3 && Math.random() < 0.55) return "aurora";
    return "clear";
  }
  nextQuakeIn() {
    const diff = DIFFS[this.run.diffIdx] ?? DIFFS[1];
    return (48 + Math.random() * 30) / (diff.quake * (1 + Math.max(0, -this.temp - 8) * 0.035));
  }
  nextRaidIn() {
    const diff = DIFFS[this.run.diffIdx] ?? DIFFS[1];
    const mod = this.run.mods.includes("raiders");
    let rate = this.def.raid * diff.raid * (mod ? 2 : 1);
    if (mod && this.def.raid === 0) rate = 0.8 * diff.raid;
    if (rate <= 0) return 1e9;
    return (50 / rate) * (0.7 + Math.random() * 0.6);
  }

  /* ------------------------------------------------------------ helpers (EventCtx) */
  alive(): Crew[] { return this.run.crew.filter((c) => c.alive); }
  pick(excl?: number): Crew | null {
    const a = this.alive().filter((c) => c.id !== excl);
    return a.length ? a[Math.floor(Math.random() * a.length)] : null;
  }
  mood(c: Crew, d: number) { c.morale = clamp(c.morale + d, 0, 100); }
  moodAll(d: number) { for (const c of this.alive()) this.mood(c, d); }
  say(text: string, color = "#e6f4ff") {
    this.logs.push({ id: this.logId++, text, color, age: this.real });
    if (this.logs.length > 8) this.logs.shift();
  }
  float(text: string, color: string, x?: number, y?: number) {
    this.floats.push({ x: x ?? this.lead.x, y: y ?? this.lead.y + 40, text, color, life: 1.6, max: 1.6, size: 16 });
  }
  puff(x: number, y: number, n: number, color: string, sp: number, size: number, kind = 0, life = 0.8) {
    for (let i = 0; i < n && this.parts.length < 800; i++) {
      const a = Math.random() * 6.283, s = sp * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.6 + Math.random() * 0.8), color, kind });
    }
  }
  addShake(v: number) { if (this.shakeOn) this.shake = Math.min(26, this.shake + v); }
  triggerQuake() { if (this.quakeT <= 0 && this.quakeWarn <= 0) this.quakeWarn = 1.8; audio.sfx("quake"); }
  darkness() {
    const tod = ((this.run.clock + 40) / 160) % 1;
    const n = 0.5 + 0.5 * Math.cos(6.283 * (tod - 0.75));
    return Math.pow(n, 1.6) * (0.55 + (this.run.mods.includes("night") ? 0.18 : 0));
  }
  vehWeight() { return this.d.weight / Math.max(1, this.run.vehicles.length); }

  /* ------------------------------------------------------------ main update */
  update(dt: number) {
    const run = this.run, diff = DIFFS[run.diffIdx] ?? DIFFS[1];
    this.real += dt;
    const d = (this.d = derive(run));
    const lead = this.lead;
    this.pollGamepad();
    // ----- actions
    const acts = this.actions; this.actions = [];
    for (const a of acts) this.doAction(a);
    this.jumpCd = Math.max(0, this.jumpCd - dt); this.jetCd = Math.max(0, this.jetCd - dt);
    // ----- input
    const k = this.keys, h = this.holds;
    const left = k.has("a") || k.has("arrowleft") || h.has("left") || this.gp.left;
    const right = k.has("d") || k.has("arrowright") || h.has("right") || this.gp.right;
    const up = k.has("w") || k.has("arrowup") || h.has("up") || this.gp.up;
    const down = k.has("s") || k.has("arrowdown") || h.has("down") || this.gp.down;
    if (up && this.camping) this.endCamp();
    const dtW = this.camping ? dt * 2.5 : dt;
    run.clock += dtW; run.stats.time += dt; this.wc += dtW;
    if (this.camping) this.campT += dt;
    this.dark = this.darkness();

    // ----- weather
    this.wTimer -= dtW;
    if (this.wTimer <= 0 && !this.tutorial) {
      this.wType = this.wNext; this.wNext = this.pickWeather(); this.wTimer = 22 + Math.random() * 22;
      this.windDir = Math.random() < 0.5 ? -1 : 1;
      const wd = WEATHER[this.wType];
      if (this.wType === "blizzard" || this.wType === "whiteout") { this.say(`${wd.icon} A ${wd.label.toLowerCase()} is upon you!`, "#ffd9a0"); audio.sfx("storm"); }
      else if (this.wType === "aurora") { this.say("🌌 The aurora ignites the sky. Spirits lift.", "#a0ffd0"); audio.sfx("chime"); }
      else this.say(`${wd.icon} Weather: ${wd.label}`, "#cfe8ff");
    }
    const tw = WEATHER[this.wType], cur = this.cur, ez = Math.min(1, dt * 0.5);
    cur.wind += (tw.wind - cur.wind) * ez; cur.vis += (tw.vis - cur.vis) * ez; cur.tempOff += (tw.tempOff - cur.tempOff) * ez;
    cur.snow += (tw.snow - cur.snow) * ez; cur.fuel += (tw.fuel - cur.fuel) * ez;
    const night = this.dark / 0.55;
    this.temp = this.tutorial ? -6 : this.def.temp * diff.cold + cur.tempOff * Math.max(0.6, diff.cold) - 6 * night - (run.mods.includes("night") ? 4 : 0);
    this.teff = this.temp + d.heat + (this.camping ? 12 : 0);

    // ----- quake
    this.quakeIn -= dtW;
    if (this.quakeIn <= 0) { this.quakeIn = this.nextQuakeIn(); this.triggerQuake(); }
    if (this.quakeWarn > 0) {
      this.quakeWarn -= dt; this.addShake(0.4);
      if (this.quakeWarn <= 0) this.beginQuake();
    }
    if (this.quakeT > 0) { this.quakeT -= dt; this.addShake(0.5); }
    this.qk += ((this.quakeT > 0 ? 1 : 0) - this.qk) * Math.min(1, dt * 2);

    // ----- lead vehicle motion
    this.stuckNow = run.vehicles.some((v) => v.stuck > 0);
    this.attached = this.raiders.filter((r) => r.att >= 0 && r.flee <= 0).length;
    let top = d.top * (1 - 0.1 * Math.min(4, this.attached));
    if (this.onThin) top *= 0.8;
    const fuelOk = run.fuel > 0 || this.tutorial;
    if (!fuelOk) { this.outOfFuelT += dt; } else this.outOfFuelT = 0;
    const moving = !this.camping && !this.stuckNow && !this.arrived;
    this.throttleIn = up && moving && fuelOk ? 1 : 0;
    if (moving) {
      if (up && fuelOk) {
        if (this.speed < top) this.speed = Math.min(top, this.speed + 78 * dt);
        else this.speed = Math.max(top, this.speed - 50 * dt);
      } else this.speed = Math.max(0, this.speed - (down ? 190 : 38) * dt);
      if (down && up) this.speed = Math.max(0, this.speed - 120 * dt);
    } else this.speed = Math.max(0, this.speed - 240 * dt);
    if (this.stuckNow) this.speed = 0;

    const gripBase = d.grip * (this.onThin ? 0.38 : 1) * (1 - 0.1 * Math.min(1, cur.wind));
    const steer = (right ? 1 : 0) - (left ? 1 : 0);
    const turnF = Math.min(1, this.speed / 28);
    this.heading += (steer * 0.62 - this.heading) * Math.min(1, dt * 3.2 * gripBase) * (steer !== 0 ? turnF : 1);
    if (steer === 0) this.heading *= Math.max(0, 1 - dt * 3 * Math.min(1, turnF + 0.2));
    // drift field & wind: the ice sheet shears sideways
    const shear = Math.sin(lead.x / 260 + lead.y / 1400 + this.wc * 0.08) * (22 + this.leg * 4);
    const windPush = cur.wind * this.windDir * 30;
    const slipFactor = clamp(1.3 - gripBase * 0.6, 0.12, 1.4) * (this.onThin ? 2 : 1);
    const slipTarget = (shear + windPush) * slipFactor * (this.camping || this.arrived ? 0 : Math.min(1, this.speed / 30 + 0.25));
    this.slipX += (slipTarget - this.slipX) * Math.min(1, dt * 2);
    this.drift = shear + windPush;
    let vx = Math.sin(this.heading) * this.speed + this.slipX, vy = Math.cos(this.heading) * this.speed;
    if (this.stuckNow) { vx = 0; vy = 0; }
    lead.x += vx * dt; lead.y += vy * dt;
    if (Math.abs(lead.x) > WALL) {
      lead.x = clamp(lead.x, -WALL, WALL);
      if (this.speed > 35) { this.damage(lead, 3 + this.speed * 0.04, "wall"); this.speed *= 0.6; this.addShake(5); this.puff(lead.x, lead.y, 8, "#e8f6ff", 80, 4, 1); audio.sfx("hit", 0.6); }
      this.heading *= 0.4;
    }
    lead.ang = this.heading + clamp(this.slipX / Math.max(60, this.speed) * 0.5, -0.3, 0.3);
    const lastT = this.trail[this.trail.length - 1];
    const dd = Math.hypot(lead.x - lastT.x, lead.y - lastT.y);
    if (dd >= 3) {
      this.leadS += dd;
      this.trail.push({ x: lead.x, y: lead.y, air: lead.air, s: this.leadS });
      const minS = this.leadS - SP * (run.vehicles.length + 1) - 40;
      while (this.trail.length > 4 && this.trail[1].s < minS) this.trail.shift();
    } else lastT.air = lead.air;
    run.stats.distance += Math.max(0, vy * dt);
    // jump air
    if (this.airT >= 0) {
      this.airT += dt; lead.air = this.airT / this.airDur;
      if (this.airT >= this.airDur) { this.airT = -1; lead.air = -1; }
    }
    this.placeFollowers();
    for (const v of run.vehicles) {
      const pa = this.prevAir.get(v.id) ?? -1;
      if (pa >= 0 && v.air < 0) { this.puff(v.x, v.y, 10, "#f2fbff", 90, 5, 0, 0.7); if (v === lead) { this.addShake(6); audio.sfx("land", 0.9); } }
      this.prevAir.set(v.id, v.air);
      v.flash = Math.max(0, v.flash - dt * 3);
    }

    // ----- world interactions
    this.updateCrevs(dt);
    this.updateHazards(dt, d);
    this.updateRaiders(dt, dtW);
    this.updateAvals(dt);
    this.updateCrates();
    this.updateFx(dt);
    if (this.mawY > -9000) this.updateMaw(dt);

    // ----- generation & culling
    if (!this.tutorial) this.generate(lead.y + 1900);
    const cut = lead.y - 1400;
    if (this.crevs.length > 60) this.crevs = this.crevs.filter((c) => c.y > cut || c.chasm);
    if (this.seracs.length > 60) this.seracs = this.seracs.filter((s) => s.y > cut);
    if (this.thins.length > 30) this.thins = this.thins.filter((t) => t.y > cut);
    if (this.crates.length > 40) this.crates = this.crates.filter((c) => c.y > cut && !c.taken);

    // ----- resources & crew
    this.updateResources(dt, dtW, d, diff.fuel);
    this.updateCrew(dtW, d);
    this.eventIn -= dtW;
    if (this.eventIn <= 0) this.tryEvent();
    this.raidIn -= dtW;
    if (this.raidIn <= 0) { this.raidIn = this.nextRaidIn(); if (!this.camping || Math.random() < 0.5) this.spawnRaiders(); }
    if (this.tutorial) this.updateTutorial(dt);

    // ----- camera
    const targetX = lead.x * 0.75, tcy = lead.y + this.speed * 0.2;
    this.camX += (targetX - this.camX) * Math.min(1, dt * 3);
    this.camY += (tcy - this.camY) * Math.min(1, dt * 4);
    this.shake *= Math.max(0, 1 - dt * 4);

    // ----- end conditions
    if (!this.ended && !this.arrived && lead.y >= this.length) this.arrive();
    if (this.arrived) {
      this.arriveDelay += dt;
      if (this.arriveDelay > 1.4 && !this.ended && !this.modal) this.finishArrival();
    }
    if (!this.tutorial && !this.ended) {
      if (this.alive().length === 0) this.end(false, "The last member of the crew has perished on the ice.");
      else if (run.fuel <= 0.01 && goodsTotal(run) === 0 && this.speed < 2 && this.outOfFuelT > 10 && run.planks === 0)
        this.end(false, "Out of fuel with nothing left to burn. The caravan is stranded, and the cold is patient.");
    }

    // ----- audio & HUD
    this.audAcc += dt;
    if (this.audAcc > 0.15) {
      this.audAcc = 0;
      let tension = 0;
      if (this.raiders.length) tension += 0.5;
      if (this.quakeT > 0 || this.quakeWarn > 0) tension += 0.4;
      if (this.stuckNow) tension += 0.3;
      if (this.mawY > -9000) tension += clamp(1 - (lead.y - this.mawY) / 900, 0.15, 0.8);
      if (this.nearCrev(lead, 260)) tension += 0.3;
      audio.setEnvironment(cur.wind, this.speed / Math.max(1, d.top), !this.camping && fuelOk && !this.arrived, Math.min(1, tension), night, this.wType === "aurora");
    }
    this.hudAcc += dt;
    if (this.hudAcc > 0.12) { this.hudAcc = 0; this.cb.onHud(this.buildHud()); }
  }

  nearCrev(v: Vehicle, r: number) {
    for (const c of this.crevs) {
      if (c.fracture > 0 || (c.hidden && !c.revealed)) continue;
      const dx = v.x - c.x, dy = v.y - c.y;
      if (Math.hypot(dx, dy) > c.L / 2 + r + 100) continue;
      const u = dx * c.ca + dy * c.sa, vv = -dx * c.sa + dy * c.ca;
      if (Math.abs(u) < c.L / 2 && Math.abs(vv) < r + c.w / 2 && c.y > v.y - 80) return true;
    }
    return false;
  }

  sample(s: number) {
    const t = this.trail;
    let i = t.length - 1;
    while (i > 0 && t[i].s > s) i--;
    const a = t[i], b = t[Math.min(t.length - 1, i + 1)];
    const span = b.s - a.s;
    const f = span > 0.0001 ? clamp((s - a.s) / span, 0, 1) : 0;
    const air = a.air >= 0 ? a.air : b.air >= 0 && f > 0.5 ? b.air : -1;
    const dx = b.x - a.x, dy = b.y - a.y;
    return { x: a.x + dx * f, y: a.y + dy * f, air, ang: dx * dx + dy * dy > 0.0001 ? Math.atan2(dx, dy) : 0 };
  }
  placeFollowers() {
    const vs = this.run.vehicles;
    for (let i = 1; i < vs.length; i++) {
      const p = this.sample(this.leadS - SP * i), v = vs[i];
      v.x = p.x; v.y = p.y; v.air = p.air;
      let da = p.ang - v.ang; while (da > Math.PI) da -= 6.283; while (da < -Math.PI) da += 6.283;
      v.ang += da * 0.5;
    }
  }

  /* ------------------------------------------------------------ actions */
  doAction(a: string) {
    const run = this.run, d = this.d;
    if (a === "jump") {
      if (this.arrived || this.camping || this.stuckNow || this.airT >= 0) return;
      if (this.jumpCd > 0) { audio.sfx("deny"); return; }
      if (this.speed < 28) { this.float("Need speed!", "#ffd166"); audio.sfx("deny"); return; }
      this.airDur = 0.8 / (1 + Math.max(0, d.weight - 60) / 300);
      this.airT = 0; this.lead.air = 0; this.jumpCd = 1.7;
      if (!this.tutorial) run.fuel = Math.max(0, run.fuel - 1.5);
      run.stats.jumps++;
      this.puff(this.lead.x, this.lead.y, 12, "#f2fbff", 100, 5, 0, 0.7);
      audio.sfx("jump"); this.addShake(3);
    } else if (a === "bridge") this.tryBridge();
    else if (a === "camp") {
      if (this.camping) { this.endCamp(); return; }
      if (this.arrived) return;
      if (this.final) { this.say("Too dangerous to camp — the Maw is behind you!", "#ff8d8d"); audio.sfx("deny"); return; }
      if (this.speed > 10) { this.float("Brake to a stop first", "#ffd166"); audio.sfx("deny"); return; }
      if (this.stuckNow) return;
      if (this.attached > 0) { this.say("Can't camp with raiders on the caravan!", "#ff8d8d"); audio.sfx("deny"); return; }
      this.camping = true; this.campT = 0; run.stats.camps++;
      this.say("⛺ Camp pitched. Time passes faster; crew rest and repair.", "#ffd9a0"); audio.sfx("camp");
    } else if (a === "flare") {
      const near = this.raiders.filter((r) => Math.hypot(r.x - this.lead.x, r.y - this.lead.y) < 560 && r.flee < 100);
      if (run.flares <= 0) { this.float("No flares!", "#ff8d8d"); audio.sfx("deny"); return; }
      if (!near.length) { this.float("No raiders nearby", "#ffd166"); audio.sfx("deny"); return; }
      run.flares--; run.stats.flares++;
      for (const r of near) { r.flee = 5; r.att = -1; }
      for (let i = 0; i < 30; i++) this.puff(this.lead.x, this.lead.y + 30, 1, i % 2 ? "#ffb347" : "#fff6c0", 220, 4, 2, 0.9);
      this.float("FLARE!", "#ffb347"); audio.sfx("flare"); this.addShake(3);
    } else if (a === "jettison") {
      if (this.jetCd > 0 || this.arrived) return;
      const order = [...GOOD_IDS].sort((x, y) => GOODS[x].base - GOODS[y].base);
      const g = order.find((x) => run.goods[x] > 0);
      if (g) {
        const avg = run.goodsCost[g] / run.goods[g];
        run.goods[g]--; run.goodsCost[g] = Math.max(0, run.goodsCost[g] - avg);
        run.fuel = Math.min(d.fuelCap, run.fuel + 3);
        this.float(`${GOODS[g].icon} burned → +3 ⛽`, "#ffb347"); this.jetCd = 0.25; audio.sfx("pickup");
        this.puff(this.lead.x, this.lead.y - 20, 6, "#ffb347", 60, 4, 2, 0.6);
      } else if (run.planks > 0 && run.fuel < d.fuelCap) {
        run.planks--; run.fuel = Math.min(d.fuelCap, run.fuel + 2); this.float("🪵 burned → +2 ⛽", "#ffb347"); this.jetCd = 0.25; audio.sfx("pickup");
      } else { this.float("Nothing to burn", "#ffd166"); audio.sfx("deny"); }
    }
  }
  endCamp() { this.camping = false; this.say("Camp broken. Back on the move.", "#cfe8ff"); }

  tryBridge() {
    const run = this.run, lead = this.lead, d = this.d;
    if (this.arrived || this.camping || this.stuckNow) return;
    let best: Crev | null = null, bestU = 0, bestScore = 1e9;
    const hx = Math.sin(this.heading), hy = Math.cos(this.heading);
    for (const c of this.crevs) {
      if (c.fracture > 0 || c.grow < 0.6) continue;
      const dx = lead.x - c.x, dy = lead.y - c.y;
      const u0 = dx * c.ca + dy * c.sa, v0 = -dx * c.sa + dy * c.ca;
      const ud = hx * c.ca + hy * c.sa, vd = -hx * c.sa + hy * c.ca;
      if (Math.abs(u0) > c.L / 2 + 30) continue;
      const gap = Math.abs(v0) - c.w / 2;
      if (gap > 240) continue;
      let u = u0;
      if (Math.abs(vd) > 0.05) {
        const t = -v0 / vd;
        if (t > 0 && t < 320) u = u0 + t * ud;
      }
      u = clamp(u, -c.L / 2 + 40, c.L / 2 - 40);
      const sc = Math.max(0, gap) + (v0 > 0 !== (vd < 0) ? 120 : 0);
      if (sc < bestScore) { bestScore = sc; best = c; bestU = u; }
    }
    if (!best) { this.float("No crevasse in range", "#ffd166"); audio.sfx("deny"); return; }
    const c = best;
    if (c.bridges.some((b) => b.hp > 0 && !b.rubble && Math.abs(b.u - bestU) < b.half * 0.7)) { this.float("Already bridged", "#ffd166"); audio.sfx("deny"); return; }
    const cost = Math.max(1, Math.ceil(Math.max(c.w, c.w0) / 46));
    if (run.planks < cost) { this.float(`Need ${cost} planks`, "#ff8d8d"); this.say(`Bridge needs ${cost} 🪵 planks — you have ${run.planks}.`, "#ff8d8d"); audio.sfx("deny"); return; }
    run.planks -= cost; run.stats.bridges++;
    const mech = roleFactor(run, "mechanic");
    const hp = (85 + 40 * Math.min(2, d.bridgeMods)) * (1 + 0.25 * mech) * (c.chasm ? 1.4 : 1);
    c.bridges.push({ u: bestU, half: c.chasm ? 130 : 66, hp, maxhp: hp, built: 0, rubble: false });
    c.revealed = true;
    const px = c.x + c.ca * bestU, py = c.y + c.sa * bestU;
    this.puff(px, py, 14, "#d9b88a", 90, 5, 1, 0.8);
    this.float(`🌉 −${cost} 🪵`, "#d9b88a", px, py + 30); audio.sfx("bridge");
    if (this.tutorial && this.tutStep === 3) this.say("Bridge laid! Drive straight across.", "#a0ffd0");
  }

  /* ------------------------------------------------------------ crevasses & hazards */
  crevHit(c: Crev, px: number, py: number) {
    const dx = px - c.x, dy = py - c.y;
    const u = dx * c.ca + dy * c.sa;
    if (u < -c.L / 2 || u > c.L / 2) return null;
    const v = -dx * c.sa + dy * c.ca;
    const prof = (c.w / 2) * Math.pow(Math.max(0, Math.sin((Math.PI * (u + c.L / 2)) / c.L)), 0.6);
    if (Math.abs(v) >= prof - 3 || c.w < 8) return null;
    let br = null as null | Crev["bridges"][number];
    for (const b of c.bridges) if (b.built > 0.8 && b.hp > 0 && Math.abs(u - b.u) < b.half) br = b;
    return { bridge: br, u };
  }
  updateCrevs(dt: number) {
    const lead = this.lead, run = this.run;
    for (const c of this.crevs) {
      if (c.fracture > 0) {
        c.fracture -= dt;
        if (c.fracture <= 0) { c.grow = 0.01; audio.sfx("crack"); this.addShake(5); this.puff(c.x, c.y, 18, "#eaf7ff", 120, 5, 1, 0.9); }
        continue;
      }
      if (c.grow < 1) c.grow = Math.min(1, c.grow + dt / 1.2);
      const breath = 1 + c.amp * Math.sin((this.wc * 6.283) / c.period + c.phase);
      c.w = c.w0 * breath * (1 + 0.22 * this.qk) * c.grow;
      for (const b of c.bridges) {
        if (b.built < 1) b.built = Math.min(1, b.built + dt / 0.9);
        if (this.qk > 0.5 && b.hp > 0 && !b.rubble) b.hp = Math.max(0, b.hp - 6 * dt);
      }
      if (c.hidden && !c.revealed) {
        const dx = lead.x - c.x, dy = lead.y - c.y;
        const u = dx * c.ca + dy * c.sa, v = -dx * c.sa + dy * c.ca;
        const du = Math.max(0, Math.abs(u) - c.L / 2);
        if (Math.hypot(du, v) < this.d.reveal) {
          c.revealed = true; audio.sfx("ping"); this.float("📡 Hidden crevasse!", "#ffb347", lead.x, lead.y + 80);
          this.say("Hidden crevasse detected ahead!", "#ffb347");
        }
      }
    }
    // vehicle vs crevasse
    for (const v of run.vehicles) {
      if (v.immune > 0) v.immune -= dt;
      if (v.stuck > 0) {
        v.stuck -= dt;
        if (v.stuck <= 0) this.recover(v);
        continue;
      }
      if (v.air >= 0 || v.immune > 0) { v.bridgeId = -1; continue; }
      let onB = -1;
      for (const c of this.crevs) {
        if (c.fracture > 0) continue;
        if (Math.hypot(v.x - c.x, v.y - c.y) > c.L / 2 + c.w + 40) continue;
        const h = this.crevHit(c, v.x, v.y);
        if (!h) continue;
        if (h.bridge) {
          onB = c.id;
          h.bridge.hp -= this.vehWeight() * 0.45 * dt * (h.bridge.rubble ? 1.2 : 1);
          if (Math.random() < dt * 8) this.puff(v.x, v.y, 1, "#d9b88a", 40, 3, 1, 0.5);
          if (h.bridge.hp <= 0) { h.bridge.hp = 0; this.say("The bridge gives way!", "#ff8d8d"); audio.sfx("crack"); this.puff(v.x, v.y, 14, "#d9b88a", 120, 5, 1, 0.9); }
        } else {
          this.fall(v, c, h.u);
          break;
        }
      }
      v.bridgeId = onB;
    }
    if (this.crevs.length > 200) this.crevs.length = 200;
  }

  fall(v: Vehicle, c: Crev, u: number) {
    const run = this.run, d = this.d;
    const spdF = clamp(this.speed / Math.max(1, d.top), 0, 1);
    const dmg = (18 + Math.min(60, c.w * 0.45)) * (0.5 + 0.7 * spdF);
    const mech = roleFactor(run, "mechanic");
    const t = Math.max(2, 5.2 * (d.winch > 0 ? 0.5 : 1) * (1 - 0.3 * Math.min(1, mech)));
    v.stuck = v.stuckMax = t; run.stats.falls++;
    const wasHidden = c.hidden && !c.revealed;
    c.revealed = true;
    c.bridges.push({ u, half: 46, hp: 30, maxhp: 30, built: 1, rubble: true });
    const gt = goodsTotal(run);
    let lost = 0;
    if (gt > 0) {
      lost = Math.min(gt, Math.max(1, Math.ceil(gt * 0.18)));
      for (let i = 0; i < lost; i++) {
        const have = GOOD_IDS.filter((g) => run.goods[g] > 0);
        if (!have.length) break;
        const g = have[Math.floor(Math.random() * have.length)];
        const avg = run.goodsCost[g] / run.goods[g]; run.goods[g]--; run.goodsCost[g] = Math.max(0, run.goodsCost[g] - avg);
      }
    }
    run.fuel = Math.max(0, run.fuel - 3);
    for (const cr of this.alive()) this.mood(cr, cr.trait === "brave" ? -1 : -5);
    this.addShake(18); audio.sfx("fall");
    this.puff(v.x, v.y, 26, "#eaf7ff", 160, 6, 1, 1);
    this.float(wasHidden ? "SNOW BRIDGE COLLAPSED!" : "FELL IN!", "#ff6b6b", v.x, v.y + 50);
    if (lost) this.float(`−${lost} cargo`, "#ff8d8d", v.x, v.y + 20);
    this.say(`${VTYPES[v.type].name} dropped into a crevasse! Winching out…`, "#ff8d8d");
    this.damage(v, dmg, "fall");
  }
  recover(v: Vehicle) {
    v.immune = 2.6; v.stuck = 0;
    this.say(`${VTYPES[v.type].name} hauled free.`, "#a0ffd0");
    this.float("Hauled out ✔", "#a0ffd0", v.x, v.y + 40);
    audio.sfx("bridge");
    const al = this.alive();
    for (let i = 0; i < al.length; i++) for (let j = i + 1; j < al.length; j++) addBond(this.run, al[i].id, al[j].id, 1.2);
  }

  damage(v: Vehicle, amt: number, why: string) {
    if (this.ended) return;
    if (this.tutorial) amt *= 0.3;
    v.hull -= amt; v.flash = 1;
    this.run.stats.crashes += why === "wall" || why === "serac" ? 1 : 0;
    if (v.hull <= 0) { v.hull = 0; this.destroyVehicle(v, why); }
  }
  destroyVehicle(v: Vehicle, why: string) {
    const run = this.run;
    if (v === this.lead) {
      this.puff(v.x, v.y, 40, "#ffb347", 220, 7, 2, 1.2);
      this.end(false, why === "maw" ? "The Maw swallowed the tractor. The Great Rift closes behind you." : "The tractor's hull gave out. Without it, the caravan is dead in the ice.");
      return;
    }
    const idx = run.vehicles.indexOf(v);
    if (idx < 0) return;
    run.vehicles.splice(idx, 1); run.stats.vehiclesLost++;
    this.puff(v.x, v.y, 30, "#ffb347", 200, 6, 2, 1); this.addShake(14); audio.sfx("hit");
    this.say(`${VTYPES[v.type].name} was destroyed!${why === "maw" ? " Swallowed by the Rift." : ""}`, "#ff6b6b");
    this.float(`${VTYPES[v.type].name} lost!`, "#ff6b6b", v.x, v.y + 50);
    // cargo beyond new capacity is lost
    const d = derive(run);
    let over = goodsTotal(run) - d.cargoCap;
    while (over > 0) {
      const have = GOOD_IDS.filter((g) => run.goods[g] > 0); if (!have.length) break;
      const g = have[0]; run.goods[g]--; over--;
    }
    clampResources(run);
    // crew housed in a destroyed cabin are lost
    const cap = d.crewCap; const al = this.alive();
    for (let i = al.length - 1; i >= cap; i--) this.kill(al[i], "was lost with the cabin");
  }

  updateHazards(dt: number, d: Derived) {
    const run = this.run, lead = this.lead;
    // thin ice
    this.onThin = false;
    for (const t of this.thins) {
      t.warn = Math.max(0, t.warn - dt);
      for (const v of run.vehicles) {
        const nx = (v.x - t.x) / t.rx, ny = (v.y - t.y) / t.ry;
        if (nx * nx + ny * ny < 1) {
          if (v === lead) this.onThin = true;
          if (v.air >= 0) continue;
          v.thin += (0.6 + d.weight / 120) * dt;
          if (t.warn <= 0 && v.thin > 1.2) { t.warn = 1.2; audio.sfx("thin"); }
          if (v.thin > 4.6 && v.stuck <= 0 && v.immune <= 0) {
            v.thin = 0;
            const c = this.mkCrev(t.x, t.y, 0.5, 180, 50, false);
            this.crevs.push(c);
            this.thins = this.thins.filter((x) => x !== t);
            this.fall(v, c, 0);
            return;
          }
        } else v.thin = Math.max(0, v.thin - dt * 1.2);
      }
    }
    // seracs
    for (const s of this.seracs) {
      s.cd = Math.max(0, s.cd - dt);
      if (s.cd > 0) continue;
      for (const v of run.vehicles) {
        if (v.air >= 0 || v.stuck > 0) continue;
        const rad = s.r + (v === lead ? 18 : 11);
        const dx = v.x - s.x, dy = v.y - s.y, dist = Math.hypot(dx, dy);
        if (dist < rad) {
          s.cd = 0.8;
          const spdF = clamp(this.speed / Math.max(1, d.top), 0, 1);
          const dmg = 4 + 16 * spdF;
          this.damage(v, dmg, "serac");
          if (v === lead) {
            this.heading += (dx >= 0 ? 0.35 : -0.35);
            this.slipX += dx >= 0 ? 60 : -60;
            if (spdF > 0.8) { s.cd = 99; s.r = 0; this.seracs = this.seracs.filter((q) => q !== s); this.puff(s.x, s.y, 20, "#eaf7ff", 160, 5, 1, 0.9); this.float("SHATTERED", "#cfe8ff", s.x, s.y + 20); }
            this.speed *= 0.45;
          }
          this.addShake(8); audio.sfx("hit", spdF + 0.3); this.puff(s.x, s.y, 8, "#eaf7ff", 100, 4, 1, 0.7);
          this.float(`−${Math.round(dmg)}`, "#ff8d8d", v.x, v.y + 30);
          for (const cr of this.alive()) if (cr.trait !== "brave") this.mood(cr, -1);
          break;
        }
      }
    }
  }

  updateAvals(dt: number) {
    const lead = this.lead;
    for (const av of this.avals) {
      if (av.done) continue;
      if (!av.armed && lead.y > av.y - 560 && lead.y < av.y + 100) {
        av.armed = true; av.t = 0; this.say("⚠ AVALANCHE! Cross the zone fast — or jump the wave!", "#ffb347"); audio.sfx("warn");
      }
      if (!av.armed) continue;
      av.t += dt;
      const warn = 2.2, dur = 2.2;
      if (av.t > warn && av.t - dt <= warn) { audio.sfx("avalanche"); this.addShake(8); }
      if (av.t > warn) {
        const p = clamp((av.t - warn) / dur, 0, 1);
        const fx = av.dir > 0 ? -WALL - 100 + (WALL * 2 + 200) * p : WALL + 100 - (WALL * 2 + 200) * p;
        for (const v of this.run.vehicles) {
          if (v.air >= 0 || av.hit.includes(v.id)) continue;
          if (Math.abs(v.y - av.y) < av.h / 2 && Math.abs(v.x - fx) < 95) {
            av.hit.push(v.id); this.damage(v, 24, "avalanche"); this.addShake(12); audio.sfx("hit");
            this.float("−24 AVALANCHE", "#ff8d8d", v.x, v.y + 30); this.puff(v.x, v.y, 14, "#ffffff", 140, 6, 0, 0.9);
            this.speed *= 0.6; this.slipX += av.dir * 80;
          }
        }
        if (Math.random() < 0.8) this.puff(fx, av.y + (Math.random() - 0.5) * av.h, 2, "#ffffff", 80, 9, 0, 1.0);
        if (p >= 1) av.done = true;
      }
    }
    if (this.avals.length > 20) this.avals = this.avals.filter((a) => !a.done || a.y > lead.y - 600);
  }

  updateCrates() {
    const lead = this.lead, run = this.run, d = this.d;
    for (const c of this.crates) {
      if (c.taken) continue;
      if (Math.abs(c.y - lead.y) > 60) continue;
      if (Math.hypot(c.x - lead.x, c.y - lead.y) < 38) {
        c.taken = true; run.stats.pickups++;
        let txt = "";
        if (c.kind === "fuel") { run.fuel = Math.min(d.fuelCap, run.fuel + 14); txt = "+14 ⛽"; }
        else if (c.kind === "food") { run.food += 8; txt = "+8 🍖"; }
        else if (c.kind === "planks") { run.planks = Math.min(d.plankCap, run.planks + 3); txt = "+3 🪵"; }
        else if (c.kind === "goods") {
          if (d.goodsTotal < d.cargoCap) { const g = GOOD_IDS[Math.floor(Math.random() * GOOD_IDS.length)]; run.goods[g]++; run.goodsCost[g] += 10; txt = `+1 ${GOODS[g].icon}`; }
          else { run.credits += 30; txt = "+30 💰"; }
        } else { run.credits += 45; txt = "+45 💰"; }
        this.float(txt, "#a0ffd0", c.x, c.y + 30); audio.sfx("pickup"); this.puff(c.x, c.y, 10, "#a0ffd0", 70, 3, 2, 0.6);
      }
    }
  }

  beginQuake() {
    this.quakeT = 5.5; this.run.stats.quakes++;
    this.say("🌋 ICE QUAKE! Crevasses are widening and new fractures are forming!", "#ff9d6b");
    this.addShake(14);
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const c = this.mkCrev(this.lead.x + (Math.random() - 0.5) * 500, this.lead.y + 420 + Math.random() * 520, (Math.random() - 0.5) * 1.2, 300 + Math.random() * 200, 40 + Math.random() * 45, false);
      c.fracture = 1.2 + Math.random() * 0.8; c.grow = 0;
      this.crevs.push(c);
    }
  }

  /* ------------------------------------------------------------ raiders */
  spawnRaiders() {
    if (this.arrived) return;
    const n = 1 + Math.floor(this.leg * 0.45 + Math.random() * 1.6);
    const side = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < n; i++) {
      const hp = 30 + this.leg * 6;
      this.raiders.push({ x: clamp(this.lead.x + side * (520 + Math.random() * 200), -900, 900), y: this.lead.y + 60 + Math.random() * 300, hp, maxhp: hp, att: -1, steal: 1.2, flee: 0, taken: 0, ang: 0, tutor: false });
    }
    this.run.stats.raids++;
    this.say(`🏴‍☠️ ${n} raider sled${n > 1 ? "s" : ""} closing in! Fire flares (R) or shoot them down!`, "#ff8d8d"); audio.sfx("warn");
  }
  killRaider(r: Raider) {
    this.raiders = this.raiders.filter((x) => x !== r);
    const loot = 20 + this.leg * 6; this.run.credits += loot; this.run.stats.raiders++;
    this.puff(r.x, r.y, 16, "#ffb347", 150, 5, 2, 0.8); this.float(`Raider down +${loot}💰`, "#ffd166", r.x, r.y + 30); audio.sfx("kill");
  }
  updateRaiders(dt: number, dtW: number) {
    const run = this.run, lead = this.lead;
    void dtW;
    for (let i = this.raiders.length - 1; i >= 0; i--) {
      const r = this.raiders[i];
      if (r.hp <= 0) { this.killRaider(r); continue; }
      if (r.flee > 0) {
        r.flee -= dt;
        const dir = r.x >= lead.x ? 1 : -1;
        r.x += dir * 170 * dt; r.y += 40 * dt; r.ang = dir > 0 ? 1.57 : -1.57;
        if (Math.abs(r.x - lead.x) > 1000 || r.y < lead.y - 1200) { this.raiders.splice(i, 1); continue; }
        if (r.flee <= 0) r.flee = 0;
        continue;
      }
      let target: Vehicle | undefined = r.att >= 0 ? run.vehicles.find((v) => v.id === r.att) : undefined;
      if (!target) {
        r.att = -1; let bd = 1e9;
        for (const v of run.vehicles) { const dd = Math.hypot(v.x - r.x, v.y - r.y); if (dd < bd) { bd = dd; target = v; } }
      }
      if (!target) continue;
      const dx = target.x - r.x, dy = target.y - r.y, dist = Math.hypot(dx, dy) || 1;
      if (r.att < 0) {
        const sp = 128 + this.leg * 6;
        r.x += (dx / dist) * sp * dt; r.y += (dy / dist) * sp * dt; r.ang = Math.atan2(dx, dy);
        if (dist < 30) { r.att = target.id; this.addShake(4); audio.sfx("hit", 0.5); this.float("RAIDER ON BOARD!", "#ff6b6b", target.x, target.y + 40); }
        if (dist < 26 && target === lead && this.speed > 35) { r.hp = 0; this.damage(lead, 3, "ram"); this.addShake(5); }
      } else {
        const side = r.x >= target.x ? 1 : -1;
        r.x = target.x + side * 22 * Math.cos(target.ang); r.y = target.y - side * 22 * Math.sin(target.ang); r.ang = target.ang;
        const armor = target.modules.includes("armor") ? 0.5 : 1;
        this.damage(target, 3.2 * dt * armor * (this.tutorial ? 0.1 : 1), "raider");
        r.steal -= dt;
        if (r.steal <= 0 && !this.tutorial) {
          r.steal = 1.6; r.taken++;
          const have = GOOD_IDS.filter((g) => run.goods[g] > 0);
          if (have.length) { const g = have[Math.floor(Math.random() * have.length)]; run.goods[g]--; this.float(`stolen ${GOODS[g].icon}`, "#ff6b6b", target.x, target.y + 40); }
          else if (run.fuel > 3) { run.fuel -= 4; this.float("stolen ⛽", "#ff6b6b", target.x, target.y + 40); }
          else { run.food = Math.max(0, run.food - 3); this.float("stolen 🍖", "#ff6b6b", target.x, target.y + 40); }
          audio.sfx("hit", 0.5);
          for (const cr of this.alive()) if (cr.trait !== "brave") this.mood(cr, -1.5);
          if (r.taken >= 4) { r.flee = 999; r.att = -1; }
        }
      }
    }
    // turrets
    for (const v of run.vehicles) {
      const n = v.modules.filter((m) => m === "turret").length;
      if (!n) continue;
      v.gunCd -= dt;
      if (v.gunCd > 0) continue;
      let tgt: Raider | null = null, bd = 330;
      for (const r of this.raiders) { const dd = Math.hypot(r.x - v.x, r.y - v.y); if (dd < bd) { bd = dd; tgt = r; } }
      if (tgt) {
        v.gunCd = 0.3; tgt.hp -= 7 * n;
        this.bullets.push({ x1: v.x, y1: v.y, x2: tgt.x, y2: tgt.y, life: 0.08 });
        this.puff(tgt.x, tgt.y, 2, "#ffe6a0", 60, 2, 2, 0.3); audio.sfx("shot");
      }
    }
    for (const b of this.bullets) b.life -= dt;
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  /* ------------------------------------------------------------ maw boss */
  updateMaw(dt: number) {
    const lead = this.lead, run = this.run;
    const diff = DIFFS[run.diffIdx] ?? DIFFS[1];
    const prog = clamp(lead.y / this.length, 0, 1);
    const sp = (55 + 38 * prog) * (diff.id === "explorer" ? 0.88 : diff.id === "polar" ? 1.1 : 1);
    this.mawY += sp * dt;
    const gap = lead.y - this.mawY;
    this.mawPulse += dt;
    if (gap < 450) this.addShake(0.5 + (450 - gap) / 200);
    if (this.mawPulse > 9) { this.mawPulse = 0; audio.sfx("maw"); this.addShake(10); if (this.quakeT <= 0 && this.quakeWarn <= 0) this.quakeWarn = 0.8; }
    for (const v of [...run.vehicles].reverse()) if (v.y < this.mawY + 24) this.destroyVehicle(v, "maw");
    if (Math.random() < dt * 20) this.puff(WALL * (Math.random() * 2 - 1), this.mawY + 5, 1, "#8fd0ff", 60, 6, 2, 0.8);
  }

  /* ------------------------------------------------------------ resources / crew */
  updateResources(dt: number, dtW: number, d: Derived, dFuel: number) {
    const run = this.run;
    if (this.tutorial) {
      run.fuel = d.fuelCap; run.planks = Math.max(run.planks, 8); run.food = 99; run.flares = Math.max(run.flares, 2);
      for (const v of run.vehicles) if (v.hull < 40) v.hull = hullMax(v);
      return;
    }
    const eff = 1 - 0.06 * (run.levels.efficiency || 0);
    const spdF = clamp(this.speed / Math.max(1, d.top), 0, 1.1);
    const drive = this.arrived || this.camping ? 0 : 0.1 + 0.5 * spdF * (this.throttleIn ? 1 : 0.5);
    const use = drive * d.loadFactor * (1 + 0.1 * d.turbo) * this.cur.fuel * dFuel * eff;
    run.fuel = Math.max(0, run.fuel - use * dt - d.heaters * 0.025 * dtW * dFuel - (this.camping ? 0.12 * dtW : 0));
    const cook = roleFactor(run, "cook");
    let eat = 0;
    for (const c of this.alive()) eat += 0.045 * (c.trait === "frugal" ? 0.7 : 1);
    run.food = Math.max(0, run.food - eat * (1 - 0.2 * Math.min(1, cook)) * dtW);
    // camp repairs
    if (this.camping) {
      const mech = roleFactor(run, "mechanic");
      for (const v of run.vehicles) if (v.hull < hullMax(v)) v.hull = Math.min(hullMax(v), v.hull + (0.4 + 2.5 * mech) * dtW);
      if (Math.random() < dt * 4) this.puff(this.lead.x + 30, this.lead.y + 10, 1, "#ffb347", 30, 3, 2, 0.6);
    }
    clampResources(run);
  }

  kill(c: Crew, cause: string) {
    if (!c.alive) return;
    c.alive = false; this.run.stats.crewLost++;
    this.say(`💀 ${c.name} ${cause}.`, "#ff6b6b"); audio.sfx("die");
    this.float(`${c.name} ${cause}`, "#ff6b6b", this.lead.x, this.lead.y + 70);
    for (const o of this.alive()) { this.mood(o, -12); }
  }
  updateCrew(dtW: number, d: Derived) {
    const run = this.run, diff = DIFFS[run.diffIdx] ?? DIFFS[1];
    const medic = Math.min(1, roleFactor(run, "medic")), cook = Math.min(1, roleFactor(run, "cook"));
    const al = this.alive();
    const stormy = this.wType === "blizzard" || this.wType === "whiteout";
    for (const c of al) {
      const te = this.teff;
      const loss = te < -8 ? (-8 - te) * 0.035 * (1 - 0.3 * medic) * (c.trait === "hardy" ? 0.65 : 1) : 0;
      if (loss > 0) c.warmth -= loss * dtW; else c.warmth += (te > -2 ? 1.6 : 0.6) * dtW;
      if (this.camping) c.warmth += 1.2 * dtW;
      c.warmth = clamp(c.warmth, 0, 100);
      if (c.warmth <= 0) c.health -= 0.7 * dtW;
      if (run.food <= 0) c.health -= 0.9 * dtW;
      if (c.warmth > 55 && run.food > 0) c.health += (0.04 + (0.25 + (this.camping ? 0.5 : 0)) * medic) * dtW;
      c.health = Math.min(100, c.health);
      if (this.tutorial) c.health = Math.max(50, c.health);
      // morale
      let decay = 0.1 * diff.drain * (1 - 0.1 * (run.levels.morale || 0));
      decay *= c.trait === "optimist" ? 0.65 : c.trait === "gloomy" ? 1.5 : 1;
      if (c.warmth < 30) decay += 0.35;
      if (run.food <= 0) decay += 0.6;
      if (stormy) decay += 0.08;
      let gain = 0;
      if (this.camping) gain += 1.0 + 0.9 * cook;
      if (this.wType === "aurora") gain += 0.6;
      gain += d.cabins * 0.08;
      let avg = 0, n = 0;
      for (const o of al) if (o !== c) { avg += getBond(run, c.id, o.id); n++; }
      if (n) gain += (avg / n / 100) * 0.16;
      c.morale = clamp(c.morale + (gain - decay) * dtW * (this.tutorial ? 0.1 : 1), 0, 100);
      if (c.morale < 8) c.lowT += dtW; else c.lowT = Math.max(0, c.lowT - dtW * 0.5);
      if (c.health <= 0 && !this.tutorial) this.kill(c, c.warmth <= 0 ? "froze to death" : run.food <= 0 ? "starved" : "succumbed to their injuries");
      else if (c.lowT > 14 && !this.tutorial && al.length > 1) {
        c.alive = false; c.lowT = 0; run.stats.crewLost++;
        run.food = Math.max(0, run.food * 0.85);
        this.say(`🚪 ${c.name}, broken in spirit, deserted the caravan with a share of food.`, "#ff8d8d");
        audio.sfx("die"); for (const o of this.alive()) this.mood(o, -8);
      }
    }
    // bonds
    this.bondAcc += dtW;
    if (this.bondAcc >= 1) {
      this.bondAcc = 0;
      const live = this.alive();
      for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
        const a = live[i], b = live[j];
        let base = this.camping ? 0.7 : 0.04;
        if (a.trait === "hothead" || b.trait === "hothead") base -= 0.25;
        if ((a.trait === "gloomy" || b.trait === "gloomy") && base > 0) base *= 0.5;
        if (a.morale < 25 || b.morale < 25) base -= 0.2;
        addBond(run, a.id, b.id, base + (Math.random() - 0.5) * 0.3);
      }
    }
  }

  tryEvent() {
    if (this.modal || this.arrived || this.ended) return;
    if (this.raiders.length || this.stuckNow || this.quakeT > 0 || this.quakeWarn > 0 || this.lead.y < 300 || this.airT >= 0) { this.eventIn = 4; return; }
    const pool = EVENTS.filter((e) => e.cond(this));
    if (!pool.length) { this.eventIn = 30; return; }
    const total = pool.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * total, ev = pool[0];
    for (const e of pool) { r -= e.weight; if (r <= 0) { ev = e; break; } }
    const built = ev.build(this);
    this.pending = built; this.modal = true; this.keys.clear(); this.holds.clear();
    audio.sfx("event");
    this.cb.onEvent({ icon: built.icon, title: built.title, text: built.text, options: built.opts.map((o) => ({ label: o.label, hint: o.hint })) });
  }
  resolveEvent(i: number) {
    const p = this.pending;
    if (!p) { this.modal = false; return; }
    const opt = p.opts[i] ?? p.opts[p.opts.length - 1];
    const msg = opt.run(this);
    this.say(msg, "#ffe6b0"); this.float(msg.length > 38 ? msg.slice(0, 36) + "…" : msg, "#ffe6b0");
    clampResources(this.run);
    this.pending = null; this.modal = false; this.eventIn = 45 + Math.random() * 35;
    audio.sfx("click");
  }

  /* ------------------------------------------------------------ fx */
  updateFx(dt: number) {
    for (const p of this.parts) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 1 - dt * 1.8; p.vy *= 1 - dt * 1.8;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y += 28 * dt; }
    this.floats = this.floats.filter((f) => f.life > 0);
    // exhaust
    if (!this.camping && this.speed > 5 && Math.random() < dt * 14) {
      const v = this.lead;
      this.puff(v.x - Math.sin(v.ang) * 24, v.y - Math.cos(v.ang) * 24, 1, "#ffffff", 14, 4, 0, 0.7);
    }
    // wheel spray
    if (this.speed > 40 && Math.random() < dt * 20) {
      for (const v of this.run.vehicles) if (v.air < 0 && v.stuck <= 0) this.puff(v.x - Math.sin(v.ang) * 20 + 10, v.y - Math.cos(v.ang) * 20, 1, "#e3f3ff", 22, 2.5, 1, 0.5);
    }
    const sp = (0.04 + this.cur.snow * 0.06) * 0.5;
    for (const f of this.flakes) {
      f.y += dt * (0.1 + f.z * 0.25 + sp); f.x += dt * this.windDir * (0.02 + this.cur.wind * 0.22) * (0.4 + f.z);
      if (f.y > 1) { f.y -= 1; f.x = Math.random(); }
      if (f.x > 1) f.x -= 1; else if (f.x < 0) f.x += 1;
    }
  }

  /* ------------------------------------------------------------ progress */
  arrive() {
    this.arrived = true; this.arriveDelay = 0;
    this.camping = false;
  }
  finishArrival() {
    const run = this.run;
    if (this.tutorial) { this.ended = true; audio.sfx("win"); this.cb.onTutorialDone(); return; }
    run.station = this.leg + 1; run.stats.legs++;
    if (this.leg >= LEGS.length - 1) { this.end(true, "You reached Polaris Station."); return; }
    refreshMarket(run, run.station);
    for (const c of this.alive()) { c.warmth = Math.max(c.warmth, 80); this.mood(c, 6); }
    if (run.contract && run.contract.dest < run.station) { this.say("Your contract expired — the destination is behind you.", "#ff8d8d"); run.contract = null; }
    this.modal = true;
    audio.sfx("chime"); audio.setEnvironment(0, 0, false, 0, 0, false);
    this.cb.onArrive(run.station);
  }
  depart() {
    this.modal = false;
    this.startLeg(this.run.station);
    audio.sfx("click");
  }
  end(win: boolean, reason: string) {
    if (this.ended) return;
    this.ended = true; audio.silenceLoops(); audio.sfx(win ? "win" : "lose");
    this.cb.onEnd(win, reason);
  }

  updateTutorial(dt: number) {
    const y = this.lead.y;
    const s = this.tutStep;
    if (s === 0 && y > 250) this.tutStep = 1;
    else if (s === 1 && y > 760) this.tutStep = 2;
    else if (s === 2 && y > 1200) this.tutStep = 3;
    else if (s === 3 && y > 1800) this.tutStep = 4;
    else if (s === 4 && y > 2480) this.tutStep = 5;
    else if (s === 5 && (this.campT >= 3 || y > 2800)) {
      if (this.camping) this.endCamp();
      this.tutStep = 6;
    }
    if (this.tutStep === 6 && !this.tutRaider && !this.camping) {
      this.tutRaider = true;
      this.raiders.push({ x: this.lead.x + 520, y: this.lead.y + 160, hp: 18, maxhp: 18, att: -1, steal: 1, flee: 0, taken: 0, ang: 0, tutor: true });
      this.say("Raider incoming! Press R to fire a flare.", "#ff8d8d"); audio.sfx("warn");
    }
    if (s !== this.tutStep) { audio.sfx("chime"); this.say("✔ Step complete!", "#a0ffd0"); }
    void dt;
  }

  /* ------------------------------------------------------------ gamepad */
  pollGamepad() {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : [];
    const p = pads && pads[0];
    if (!p) { this.gp.left = this.gp.right = this.gp.up = this.gp.down = false; return; }
    const ax = p.axes[0] || 0;
    this.gp.left = ax < -0.3 || !!p.buttons[14]?.pressed; this.gp.right = ax > 0.3 || !!p.buttons[15]?.pressed;
    this.gp.up = !!p.buttons[7]?.pressed || !!p.buttons[12]?.pressed; this.gp.down = !!p.buttons[6]?.pressed || !!p.buttons[13]?.pressed;
    const map: [number, string][] = [[0, "jump"], [2, "bridge"], [3, "camp"], [1, "flare"], [4, "jettison"]];
    for (const [b, a] of map) {
      const now = !!p.buttons[b]?.pressed;
      if (now && !this.gpPrev[b]) this.actions.push(a);
      this.gpPrev[b] = now;
    }
    const st = !!p.buttons[9]?.pressed;
    if (st && !this.gpPrev[9]) this.cb.onPauseKey();
    this.gpPrev[9] = st;
  }

  /* ------------------------------------------------------------ HUD */
  buildHud(): Hud {
    const run = this.run, d = this.d, lead = this.lead;
    const scout = roleFactor(run, "scout");
    const alerts: string[] = [];
    if (run.fuel <= 0 && !this.tutorial) alerts.push("OUT OF FUEL — press J to burn cargo");
    else if (run.fuel < 12 && !this.tutorial) alerts.push("LOW FUEL");
    if (run.food <= 0 && !this.tutorial) alerts.push("STARVING");
    if (this.alive().some((c) => c.warmth < 25)) alerts.push("CREW FREEZING");
    if (this.raiders.length) alerts.push("RAIDERS");
    if (this.quakeWarn > 0 || this.quakeT > 0) alerts.push("ICE QUAKE");
    if (this.stuckNow) alerts.push("VEHICLE STUCK — WINCHING");
    if (this.onThin) alerts.push("THIN ICE — keep moving");
    const wd = this.wType;
    const useFull = (0.6) * d.loadFactor * (1 + 0.1 * d.turbo) * this.cur.fuel * (DIFFS[run.diffIdx]?.fuel ?? 1) * (1 - 0.06 * (run.levels.efficiency || 0));
    const eat = this.alive().length * 0.045 * 0.9;
    return {
      speed: this.speed, top: d.top, fuel: run.fuel, fuelCap: d.fuelCap, food: run.food, planks: run.planks, plankCap: d.plankCap,
      flares: run.flares, cargo: d.goodsTotal, cargoCap: d.cargoCap, credits: run.credits, temp: this.temp, teff: this.teff, weather: wd,
      forecast: scout > 0.3 && this.wNext !== wd && !this.tutorial ? { type: this.wNext, inS: Math.max(0, this.wTimer) } : null,
      progress: clamp(lead.y / this.length, 0, 1), legName: this.tutorial ? "Training Ground" : this.def.name, leg: this.leg,
      day: Math.floor(run.clock / 160) + 1, night: this.dark / 0.55, drift: this.drift, wind: this.cur.wind * this.windDir,
      crew: run.crew.map((c) => ({ id: c.id, name: c.name, icon: c.icon, role: c.role, morale: c.morale, warmth: c.warmth, health: c.health, alive: c.alive })),
      vehicles: run.vehicles.map((v) => ({ id: v.id, type: v.type, hull: v.hull, max: hullMax(v), stuck: v.stuck, mods: v.modules })),
      camping: this.camping, quake: this.quakeT > 0 ? 2 : this.quakeWarn > 0 ? 1 : 0,
      raiders: this.raiders.filter((r) => r.flee < 100).length, mawGap: this.mawY > -9000 ? lead.y - this.mawY : null,
      jumpCd: this.jumpCd, tutorial: this.tutorial ? TUTORIAL_STEPS[Math.min(this.tutStep, TUTORIAL_STEPS.length - 1)] : null,
      tutorialStep: this.tutStep,
      log: this.logs.filter((l) => this.real - l.age < 9).map((l) => ({ ...l, age: this.real - l.age })),
      alerts, weight: d.weight,
      contract: run.contract ? `${run.contract.qty}× ${GOODS[run.contract.good].icon} → station ${run.contract.dest}` : null,
      foodDays: eat > 0 ? run.food / eat : 999,
      fuelRange: useFull > 0 ? (run.fuel / useFull) * d.top * 0.85 : 99999,
    };
  }
}

