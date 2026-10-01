import { Sfx } from "./audio";
import {
  AstType,
  DRILL_F,
  DroneType,
  ENG_F,
  MAX_PIPS,
  MAX_SECTOR,
  ORE,
  OreType,
  Screen,
  SECTORS,
  STATION,
  SYS,
  SYS_NAME,
  SysKey,
  UPGRADES,
  WEAP_F,
  WORLD_H,
  WORLD_W,
} from "./data";

const TAU = Math.PI * 2;
const N = 32;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

interface Asteroid {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  om: number;
  r: number[];
  type: AstType;
  cr: number;
  floor: number;
  maxR: number;
  mat: number;
  coreP: number;
  veins: { a: number; dist: number; s: number }[];
}

interface Chunk {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: OreType;
  value: number;
  life: number;
  rot: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  dmg: number;
}

interface EBullet extends Bullet {
  emp: boolean;
  r: number;
}

interface Drone {
  type: DroneType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  r: number;
  cd: number;
  cd2: number;
  cd3: number;
  t: number;
  ang: number;
  orbit: number;
  flash: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  drag: number;
}

interface Popup {
  x: number;
  y: number;
  text: string;
  color: string;
  t: number;
}

interface Msg {
  text: string;
  color: string;
  t: number;
}

interface Btn {
  x: number;
  y: number;
  w: number;
  h: number;
  sys: SysKey;
  delta: number;
}

const AST_COL: Record<AstType, { stroke: string; fill: string }> = {
  iron: { stroke: "#ff9a5c", fill: "#2a1a14" },
  ice: { stroke: "#7fe8ff", fill: "#10232b" },
  crystal: { stroke: "#ff6bf0", fill: "#2a1030" },
};

function rAtAngle(a: Asteroid, worldAng: number) {
  let ang = (worldAng - a.rot) % TAU;
  if (ang < 0) ang += TAU;
  const f = (ang / TAU) * N;
  const fl = Math.floor(f);
  const i = fl % N;
  const t = f - fl;
  return a.r[i] * (1 - t) + a.r[(i + 1) % N] * t;
}

function radAt(a: Asteroid, x: number, y: number) {
  const dx = x - a.x;
  const dy = y - a.y;
  const d = Math.hypot(dx, dy);
  return { d, r: rAtAngle(a, Math.atan2(dy, dx)) };
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  sfx = new Sfx();
  onScreen: (s: Screen) => void = () => {};
  state: Screen = "menu";

  W = 1000;
  H = 600;
  dpr = 1;
  private raf = 0;
  private lastT = 0;
  time = 0;

  // run state
  sector = 1;
  sectorSold = 0;
  sectorTime = 0;
  credits = 0;
  upg: Record<string, number> = {};
  stats = { earned: 0, kills: 0, cores: 0, time: 0, sectors: 0 };
  sectorComplete = false;
  lastSale: { items: Record<OreType, number>; value: number } = {
    items: { iron: 0, ice: 0, crystal: 0, core: 0, scrap: 0 },
    value: 0,
  };
  deathCause = "";

  ship = { x: STATION.x, y: STATION.y + 120, vx: 0, vy: 0, ang: -Math.PI / 2, hull: 100, heat: 0, inv: 0 };
  cargo: Record<OreType, number> = { iron: 0, ice: 0, crystal: 0, core: 0, scrap: 0 };
  cargoUsed = 0;
  cargoValue = 0;
  power: Record<SysKey, number> = { engines: 2, drill: 2, weapons: 1, cooling: 1 };
  jam: Record<SysKey, number> = { engines: 0, drill: 0, weapons: 0, cooling: 0 };
  lockout = false;
  dead = false;
  deadT = 0;
  dockCd = 0;
  bossSpawned = false;
  bossDefeated = false;

  asteroids: Asteroid[] = [];
  chunks: Chunk[] = [];
  bullets: Bullet[] = [];
  ebullets: EBullet[] = [];
  drones: Drone[] = [];
  particles: Particle[] = [];
  popups: Popup[] = [];
  msgs: Msg[] = [];
  stars: { x: number; y: number; z: number; s: number }[] = [];

  private keys = new Set<string>();
  private mouse = { x: 500, y: 300, d0: false, d2: false };
  private btns: Btn[] = [];
  private cam = { x: 0, y: 0 };
  private shake = 0;
  private flash = 0;
  private fireCd = 0;
  private spawnT = 8;
  private astT = 0;
  private fullMsgT = 0;
  private tip: { x: number; y: number; a: Asteroid; d: number; core: boolean } | null = null;
  private drillAnim = 0;
  private hintT = 0;
  private alarmT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.resetRun();
    this.buildField();
    this.resize();
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("contextmenu", this.onCtx);
  }

  start() {
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.sfx.setDrill(0, 0);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
  }

  // ---------- derived stats ----------
  get maxHull() {
    return 100 + 30 * (this.upg.hull || 0);
  }
  get cargoCap() {
    return 20 + 10 * (this.upg.cargo || 0);
  }
  get drillMul() {
    return 1 + 0.22 * (this.upg.drill || 0);
  }
  get drillRange() {
    return 90 + 14 * (this.upg.range || 0);
  }
  get coolMul() {
    return 1 + 0.2 * (this.upg.heat || 0);
  }
  get reactor() {
    return 6 + (this.upg.reactor || 0);
  }
  get cannonDmg() {
    return 10 + 5 * (this.upg.cannon || 0);
  }
  get thrustMul() {
    return 1 + 0.12 * (this.upg.thrust || 0);
  }
  get magnet() {
    return 80 + 30 * (this.upg.tractor || 0);
  }
  get cfg() {
    return SECTORS[this.sector - 1];
  }
  get poolFree() {
    return this.reactor - SYS.reduce((s, k) => s + this.power[k], 0);
  }
  lvl(k: SysKey) {
    if (this.jam[k] > 0) return 0;
    if (this.lockout && (k === "drill" || k === "weapons")) return 0;
    return this.power[k];
  }

  // ---------- input ----------
  private resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
    this.canvas.style.width = this.W + "px";
    this.canvas.style.height = this.H + "px";
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      this.stars.push({ x: Math.random() * this.W, y: Math.random() * this.H, z: [0.05, 0.12, 0.25][i % 3], s: rand(0.6, 1.8) });
    }
  };

  private onCtx = (e: Event) => e.preventDefault();

  private onBlur = () => {
    this.keys.clear();
    this.mouse.d0 = false;
    this.mouse.d2 = false;
    if (this.state === "playing" && !this.dead) this.pause();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
      if (this.state === "playing") e.preventDefault();
    }
    if (e.repeat) {
      this.keys.add(e.code);
      return;
    }
    this.keys.add(e.code);
    if (e.code === "KeyM") {
      this.sfx.init();
      this.sfx.toggleMute();
    }
    if (e.code === "Escape" || e.code === "KeyP") {
      if (this.state === "playing" && !this.dead) this.pause();
      else if (this.state === "paused") this.resume();
    }
    if (this.state === "playing" && !this.dead) {
      const idx = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(e.code);
      if (idx >= 0) {
        if (e.shiftKey) this.addPip(SYS[idx], -1);
        else this.addPip(SYS[idx], 1, true);
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - r.left;
    this.mouse.y = e.clientY - r.top;
  };

  private onMouseDown = (e: MouseEvent) => {
    this.sfx.init();
    this.onMouseMove(e);
    if (this.state !== "playing" || this.dead) return;
    if (e.button === 0) {
      for (const b of this.btns) {
        if (this.mouse.x >= b.x && this.mouse.x <= b.x + b.w && this.mouse.y >= b.y && this.mouse.y <= b.y + b.h) {
          this.addPip(b.sys, b.delta, true);
          return;
        }
      }
      this.mouse.d0 = true;
    } else if (e.button === 2) {
      this.mouse.d2 = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouse.d0 = false;
    if (e.button === 2) this.mouse.d2 = false;
  };

  addPip(sys: SysKey, delta: number, steal = false) {
    if (delta > 0) {
      if (this.power[sys] >= MAX_PIPS) {
        this.sfx.deny();
        return;
      }
      if (this.poolFree <= 0) {
        if (!steal) {
          this.sfx.deny();
          return;
        }
        // take a pip from the most-loaded other system
        let best: SysKey | null = null;
        for (const k of SYS) if (k !== sys && this.power[k] > 0 && (best === null || this.power[k] > this.power[best])) best = k;
        if (!best) {
          this.sfx.deny();
          return;
        }
        this.power[best]--;
      }
      this.power[sys]++;
      this.sfx.click();
    } else if (this.power[sys] > 0) {
      this.power[sys]--;
      this.sfx.click();
    }
  }

  // ---------- flow ----------
  private setState(s: Screen) {
    this.state = s;
    if (s !== "playing") {
      this.sfx.setDrill(0, 0);
      this.mouse.d0 = false;
      this.mouse.d2 = false;
    }
    this.onScreen(s);
  }

  pause() {
    if (this.state === "playing") this.setState("paused");
  }
  resume() {
    if (this.state === "paused") {
      this.lastT = performance.now();
      this.setState("playing");
    }
  }

  private resetRun() {
    this.credits = 0;
    this.upg = {};
    for (const u of UPGRADES) this.upg[u.id] = 0;
    this.power = { engines: 2, drill: 2, weapons: 1, cooling: 1 };
    this.stats = { earned: 0, kills: 0, cores: 0, time: 0, sectors: 0 };
    this.sector = 1;
    this.ship.hull = this.maxHull;
  }

  newGame() {
    this.sfx.init();
    this.resetRun();
    this.startSector(1);
  }

  retrySector() {
    this.sfx.init();
    this.credits = Math.floor(this.credits * 0.75);
    this.startSector(this.sector);
  }

  toMenu() {
    this.resetRun();
    this.buildField();
    this.particles = [];
    this.drones = [];
    this.setState("menu");
  }

  nextSector() {
    this.sfx.click();
    if (this.sector >= MAX_SECTOR) return;
    this.startSector(this.sector + 1);
  }

  private startSector(n: number) {
    this.sector = n;
    this.sectorSold = 0;
    this.sectorTime = 0;
    this.sectorComplete = false;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.dead = false;
    this.deadT = 0;
    this.lockout = false;
    this.spawnT = 10;
    this.fireCd = 0;
    this.hintT = 0;
    this.chunks = [];
    this.bullets = [];
    this.ebullets = [];
    this.drones = [];
    this.particles = [];
    this.popups = [];
    this.msgs = [];
    this.cargo = { iron: 0, ice: 0, crystal: 0, core: 0, scrap: 0 };
    this.cargoUsed = 0;
    this.cargoValue = 0;
    this.jam = { engines: 0, drill: 0, weapons: 0, cooling: 0 };
    this.ship = { x: STATION.x, y: STATION.y + 120, vx: 0, vy: 0, ang: Math.PI / 2, hull: this.maxHull, heat: 0, inv: 2.5 };
    this.dockCd = 2.5;
    this.buildField();
    this.cam.x = this.ship.x - this.W / 2;
    this.cam.y = this.ship.y - this.H / 2;
    this.msg(`SECTOR ${n} — ${this.cfg.name}`, "#6ef3ff", 4);
    this.msg(`QUOTA: ¤${this.cfg.quota}`, "#ffd84a", 4);
    this.setState("playing");
  }

  undock() {
    this.sfx.click();
    this.ship.x = STATION.x;
    this.ship.y = STATION.y + 120;
    this.ship.vx = 0;
    this.ship.vy = 60;
    this.ship.inv = 2;
    this.dockCd = 2.5;
    this.msg("UNDOCKED", "#6ef3ff", 2);
    this.setState("playing");
  }

  private dock() {
    const s = this.ship;
    const val = this.cargoValue;
    this.lastSale = { items: { ...this.cargo }, value: val };
    this.credits += val;
    this.stats.earned += val;
    this.sectorSold += val;
    this.cargo = { iron: 0, ice: 0, crystal: 0, core: 0, scrap: 0 };
    this.cargoUsed = 0;
    this.cargoValue = 0;
    s.vx = 0;
    s.vy = 0;
    s.x = STATION.x;
    s.y = STATION.y + 70;
    s.heat = 0;
    this.lockout = false;
    this.jam = { engines: 0, drill: 0, weapons: 0, cooling: 0 };
    this.sfx.dock();
    const bossOk = this.sector < MAX_SECTOR || this.bossDefeated;
    this.sectorComplete = this.sectorSold >= this.cfg.quota && bossOk;
    if (this.sectorComplete) {
      this.stats.sectors = this.sector;
      if (this.sector >= MAX_SECTOR) {
        this.sfx.win();
        this.setState("win");
        return;
      }
    }
    this.setState("shop");
  }

  buy(id: string) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    const lvl = this.upg[id] || 0;
    if (lvl >= def.max) return false;
    const cost = def.cost(lvl);
    if (this.credits < cost) {
      this.sfx.deny();
      return false;
    }
    this.credits -= cost;
    this.upg[id] = lvl + 1;
    if (id === "hull") this.ship.hull = Math.min(this.maxHull, this.ship.hull + 30);
    this.sfx.pickup(2);
    return true;
  }

  get repairCost() {
    return Math.ceil(this.maxHull - this.ship.hull);
  }

  repair() {
    const missing = this.maxHull - this.ship.hull;
    if (missing <= 0.5) return;
    const amt = Math.min(missing, this.credits);
    if (amt < 1) {
      this.sfx.deny();
      return;
    }
    this.credits -= Math.ceil(amt);
    this.ship.hull = Math.min(this.maxHull, this.ship.hull + amt);
    this.sfx.pickup(1);
  }

  msg(text: string, color = "#fff", t = 3) {
    this.msgs.push({ text, color, t });
    if (this.msgs.length > 4) this.msgs.shift();
  }

  // ---------- world generation ----------
  private makeAsteroid(x: number, y: number): Asteroid {
    const base = rand(38, 86);
    const p1 = rand(0, TAU);
    const p2 = rand(0, TAU);
    const r: number[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      r.push(base * (1 + 0.12 * Math.sin(a * 3 + p1) + 0.08 * Math.sin(a * 5 + p2) + rand(-0.04, 0.04)));
    }
    const roll = Math.random();
    const type: AstType = roll < this.cfg.crystal ? "crystal" : roll < this.cfg.crystal + (1 - this.cfg.crystal) / 2 ? "iron" : "ice";
    const cr = base * 0.27;
    const veins = [];
    for (let i = 0; i < 12; i++) veins.push({ a: rand(0, TAU), dist: rand(cr * 1.6, base * 0.95), s: rand(1.5, 3.5) });
    const sp = rand(6, 16);
    const va = rand(0, TAU);
    return {
      x,
      y,
      vx: Math.cos(va) * sp,
      vy: Math.sin(va) * sp,
      rot: rand(0, TAU),
      om: rand(-0.18, 0.18),
      r,
      type,
      cr,
      floor: cr * 0.75,
      maxR: Math.max(...r) + 4,
      mat: 0,
      coreP: 0,
      veins,
    };
  }

  private placeAsteroid(minShip: number): boolean {
    for (let t = 0; t < 40; t++) {
      const x = rand(160, WORLD_W - 160);
      const y = rand(160, WORLD_H - 160);
      if (Math.hypot(x - STATION.x, y - STATION.y) < 320) continue;
      if (minShip > 0 && Math.hypot(x - this.ship.x, y - this.ship.y) < minShip) continue;
      const a = this.makeAsteroid(x, y);
      if (this.asteroids.some((o) => Math.hypot(o.x - x, o.y - y) < o.maxR + a.maxR + 40)) continue;
      this.asteroids.push(a);
      return true;
    }
    return false;
  }

  private buildField() {
    this.asteroids = [];
    const n = this.cfg.asteroids;
    for (let i = 0; i < n; i++) this.placeAsteroid(0);
  }

  // ---------- main loop ----------
  private loop = (t: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (t - this.lastT) / 1000;
    this.lastT = t;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    if (this.state === "playing") this.update(dt);
    else if (this.state === "menu" || this.state === "over" || this.state === "win") {
      this.updateWorld(dt);
    }
    this.render(dt);
  };

  private burst(x: number, y: number, n: number, color: string, speed: number, life: number, size: number) {
    if (this.particles.length > 700) return;
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const v = rand(speed * 0.2, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * rand(0.6, 1), max: life, size: rand(size * 0.5, size), color, drag: 1.5 });
    }
  }

  private updateWorld(dt: number) {
    for (const a of this.asteroids) {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.om * dt;
      const m = a.maxR + 20;
      if (a.x < m) a.vx = Math.abs(a.vx);
      if (a.x > WORLD_W - m) a.vx = -Math.abs(a.vx);
      if (a.y < m) a.vy = Math.abs(a.vy);
      if (a.y > WORLD_H - m) a.vy = -Math.abs(a.vy);
      const dx = a.x - STATION.x;
      const dy = a.y - STATION.y;
      const d = Math.hypot(dx, dy);
      if (d < a.maxR + 160) {
        a.vx += (dx / d) * 40 * dt;
        a.vy += (dy / d) * 40 * dt;
      }
      const sp = Math.hypot(a.vx, a.vy);
      if (sp > 22) {
        a.vx *= 22 / sp;
        a.vy *= 22 / sp;
      }
    }
    for (const p of this.particles) {
      p.life -= dt;
      const dr = Math.exp(-p.drag * dt);
      p.vx *= dr;
      p.vy *= dr;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const p of this.popups) {
      p.t -= dt;
      p.y -= 28 * dt;
    }
    this.popups = this.popups.filter((p) => p.t > 0);
    this.shake *= Math.exp(-7 * dt);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    for (const m of this.msgs) m.t -= dt;
    this.msgs = this.msgs.filter((m) => m.t > 0);
  }

  hurt(dmg: number, cause: string) {
    const s = this.ship;
    if (s.inv > 0 || this.dead) return;
    s.hull -= dmg;
    this.shake = Math.min(18, this.shake + 4 + dmg * 0.4);
    this.flash = Math.min(1, this.flash + 0.3 + dmg * 0.02);
    this.sfx.hit();
    this.burst(s.x, s.y, 8, "#ff7a5c", 160, 0.5, 3);
    if (s.hull <= 0) this.die(cause);
  }

  private die(cause: string) {
    if (this.dead) return;
    const s = this.ship;
    s.hull = 0;
    this.dead = true;
    this.deadT = 0;
    this.deathCause = cause;
    this.sfx.setDrill(0, 0);
    this.sfx.boom(2);
    this.sfx.lose();
    this.shake = 22;
    this.burst(s.x, s.y, 70, "#ffb347", 420, 1.4, 5);
    this.burst(s.x, s.y, 40, "#ff4d5e", 300, 1.2, 4);
    this.burst(s.x, s.y, 30, "#ffffff", 500, 0.8, 3);
    this.mouse.d0 = false;
    this.mouse.d2 = false;
  }

  private spawnChunk(x: number, y: number, type: OreType, vx: number, vy: number) {
    const base = ORE[type].value;
    const mult = type === "core" ? 1 + 0.25 * (this.sector - 1) : 1;
    this.chunks.push({
      x,
      y,
      vx,
      vy,
      type,
      value: Math.round(base * mult),
      life: type === "core" ? 90 : 40,
      rot: rand(0, TAU),
    });
  }

  private spawnDrone(type: DroneType, x: number, y: number) {
    const sc = 1 + 0.08 * (this.sector - 1);
    const defs: Record<DroneType, { hp: number; r: number }> = {
      scout: { hp: 26, r: 13 },
      breacher: { hp: 20, r: 12 },
      jammer: { hp: 34, r: 15 },
      overseer: { hp: 900, r: 36 },
    };
    const d = defs[type];
    const hp = type === "overseer" ? d.hp : Math.round(d.hp * sc);
    this.drones.push({
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      r: d.r,
      cd: rand(1, 2.2),
      cd2: rand(3, 6),
      cd3: 6,
      t: rand(0, 10),
      ang: 0,
      orbit: Math.random() < 0.5 ? 1 : -1,
      flash: 0,
    });
  }

  private spawnAwayFromShip(type: DroneType, dist: number) {
    const s = this.ship;
    for (let i = 0; i < 10; i++) {
      const a = rand(0, TAU);
      const x = clamp(s.x + Math.cos(a) * dist, 40, WORLD_W - 40);
      const y = clamp(s.y + Math.sin(a) * dist, 40, WORLD_H - 40);
      if (Math.hypot(x - s.x, y - s.y) > Math.min(dist, 520) * 0.85) {
        this.spawnDrone(type, x, y);
        return true;
      }
    }
    return false;
  }

  private killDrone(d: Drone) {
    this.sfx.boom(d.type === "overseer" ? 2 : 0.7);
    const col = d.type === "scout" ? "#ff4d5e" : d.type === "breacher" ? "#ff9a3c" : d.type === "jammer" ? "#b07bff" : "#ff5ad0";
    const big = d.type === "overseer";
    this.burst(d.x, d.y, big ? 120 : 26, col, big ? 500 : 240, big ? 1.6 : 0.8, big ? 6 : 3.5);
    this.burst(d.x, d.y, big ? 50 : 10, "#ffffff", big ? 420 : 200, 0.5, 2.5);
    this.shake = Math.min(20, this.shake + (big ? 18 : 3));
    this.stats.kills++;
    const n = d.type === "overseer" ? 12 : d.type === "jammer" ? 2 : 1;
    for (let i = 0; i < n; i++) this.spawnChunk(d.x, d.y, "scrap", rand(-90, 90), rand(-90, 90));
    if (big) {
      this.bossDefeated = true;
      this.msg("OVERSEER DESTROYED — FINISH THE QUOTA", "#7dffb0", 5);
    }
  }

  private extractCore(a: Asteroid) {
    this.asteroids = this.asteroids.filter((o) => o !== a);
    const s = this.ship;
    const ang = Math.atan2(s.y - a.y, s.x - a.x);
    this.spawnChunk(a.x, a.y, "core", Math.cos(ang) * 90, Math.sin(ang) * 90);
    for (let i = 0; i < 6; i++) this.spawnChunk(a.x, a.y, a.type, rand(-130, 130), rand(-130, 130));
    this.burst(a.x, a.y, 70, "#ffd84a", 380, 1.2, 4.5);
    this.burst(a.x, a.y, 40, AST_COL[a.type].stroke, 300, 1.4, 4);
    this.shake = Math.min(20, this.shake + 12);
    this.stats.cores++;
    this.sfx.core();
    this.msg("★ CORE EXTRACTED ★", "#ffd84a", 3);
    this.popups.push({ x: a.x, y: a.y - 20, text: "CORE!", color: "#ffd84a", t: 1.6 });
    this.tip = null;
  }

  private collect(c: Chunk) {
    const w = ORE[c.type].weight;
    this.cargo[c.type]++;
    this.cargoUsed += w;
    this.cargoValue += c.value;
    this.sfx.pickup(c.type === "core" ? 3 : c.type === "crystal" ? 2 : 0);
    this.popups.push({ x: c.x, y: c.y, text: `+${c.value}`, color: ORE[c.type].color, t: 0.8 });
    if (c.type === "ice") {
      this.ship.heat = Math.max(0, this.ship.heat - 4);
      this.popups.push({ x: c.x + 12, y: c.y + 10, text: "❄ -HEAT", color: "#7fe8ff", t: 0.8 });
    }
  }

  private jamRandom() {
    const cands = SYS.filter((k) => this.jam[k] <= 0 && this.power[k] > 0);
    const list = cands.length ? cands : SYS;
    const k = list[Math.floor(Math.random() * list.length)];
    this.jam[k] = 5;
    this.msg(`EMP HIT — ${SYS_NAME[k]} OFFLINE`, "#c79bff", 3);
    this.sfx.jam();
    this.flash = Math.min(1, this.flash + 0.3);
  }

  // ---------- update ----------
  private update(dt: number) {
    const s = this.ship;
    this.time += dt;
    this.updateWorld(dt);
    if (!this.dead) {
      this.sectorTime += dt;
      this.stats.time += dt;
      this.hintT += dt;
    }
    s.inv = Math.max(0, s.inv - dt);
    this.dockCd = Math.max(0, this.dockCd - dt);
    this.fullMsgT = Math.max(0, this.fullMsgT - dt);
    this.alarmT = Math.max(0, this.alarmT - dt);
    for (const k of SYS) this.jam[k] = Math.max(0, this.jam[k] - dt);

    if (!this.lockout && s.heat >= 100 && !this.dead) {
      this.lockout = true;
      this.msg("OVERHEAT — DRILL & CANNON LOCKED", "#ff5a3c", 3.5);
      this.sfx.alarm();
    }
    if (this.lockout && s.heat < 60) {
      this.lockout = false;
      this.msg("SYSTEMS ONLINE", "#7dffb0", 2);
    }

    const eL = this.lvl("engines");
    const dL = this.lvl("drill");
    const wL = this.lvl("weapons");
    const cL = this.lvl("cooling");
    let heatRate = 0;
    this.tip = null;
    let drilling = false;

    if (!this.dead) {
      // aim
      const wmx = this.cam.x + this.mouse.x;
      const wmy = this.cam.y + this.mouse.y;
      s.ang = Math.atan2(wmy - s.y, wmx - s.x);

      // thrust
      let ax = 0;
      let ay = 0;
      if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) ay -= 1;
      if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) ay += 1;
      if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) ax -= 1;
      if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) ax += 1;
      const len = Math.hypot(ax, ay);
      if (len > 0) {
        ax /= len;
        ay /= len;
        const acc = 300 * ENG_F[eL] * this.thrustMul;
        s.vx += ax * acc * dt;
        s.vy += ay * acc * dt;
        if (Math.random() < 0.8) {
          this.particles.push({
            x: s.x - ax * 10,
            y: s.y - ay * 10,
            vx: -ax * rand(80, 160) + s.vx * 0.3,
            vy: -ay * rand(80, 160) + s.vy * 0.3,
            life: 0.35,
            max: 0.35,
            size: rand(1.5, 3),
            color: eL >= 3 ? "#9ff6ff" : "#6ef3ff",
            drag: 2,
          });
        }
      }
      const dr = Math.exp(-1.1 * dt);
      s.vx *= dr;
      s.vy *= dr;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.x < 20) {
        s.x = 20;
        s.vx = Math.abs(s.vx) * 0.5;
      }
      if (s.x > WORLD_W - 20) {
        s.x = WORLD_W - 20;
        s.vx = -Math.abs(s.vx) * 0.5;
      }
      if (s.y < 20) {
        s.y = 20;
        s.vy = Math.abs(s.vy) * 0.5;
      }
      if (s.y > WORLD_H - 20) {
        s.y = WORLD_H - 20;
        s.vy = -Math.abs(s.vy) * 0.5;
      }

      // ship <-> asteroid collision
      for (const a of this.asteroids) {
        const dx = s.x - a.x;
        const dy = s.y - a.y;
        if (Math.abs(dx) > a.maxR + 20 || Math.abs(dy) > a.maxR + 20) continue;
        const q = radAt(a, s.x, s.y);
        if (q.d < q.r + 12 && q.d > 0.001) {
          const nx = dx / q.d;
          const ny = dy / q.d;
          s.x = a.x + nx * (q.r + 12);
          s.y = a.y + ny * (q.r + 12);
          const vn = (s.vx - a.vx) * nx + (s.vy - a.vy) * ny;
          if (vn < 0) {
            s.vx -= 1.4 * vn * nx;
            s.vy -= 1.4 * vn * ny;
            const dmg = Math.max(0, -vn - 110) * 0.06;
            if (-vn > 40) this.sfx.thud();
            if (dmg > 0.5) this.hurt(dmg, "Crushed against an asteroid");
            this.burst(s.x - nx * 12, s.y - ny * 12, 4, "#ffffff", 100, 0.3, 2);
          }
        }
      }

      // drilling
      const wantDrill = this.mouse.d0;
      if (wantDrill && dL > 0) {
        drilling = true;
        heatRate += this.doDrill(dt, dL);
      } else {
        this.sfx.setDrill(0, 0);
      }

      // firing
      this.fireCd -= dt;
      const wantFire = this.mouse.d2 || this.keys.has("Space");
      if (wantFire && wL > 0 && this.fireCd <= 0) {
        this.fireCd = 0.34 / WEAP_F[wL];
        const nx = Math.cos(s.ang);
        const ny = Math.sin(s.ang);
        this.bullets.push({ x: s.x + nx * 18, y: s.y + ny * 18, vx: nx * 780 + s.vx * 0.3, vy: ny * 780 + s.vy * 0.3, life: 0.95, dmg: this.cannonDmg });
        s.vx -= nx * 5;
        s.vy -= ny * 5;
        s.heat += 2.4;
        this.sfx.laser();
        this.burst(s.x + nx * 20, s.y + ny * 20, 3, "#ffe680", 120, 0.2, 2);
      } else if (wantFire && (wL <= 0 || this.lockout) && this.fireCd <= 0) {
        this.fireCd = 0.4;
        this.sfx.deny();
      }
    }
    this.drillAnim += dt * (drilling ? 30 : 0);

    // heat
    const cool = (2 + 4.5 * cL) * this.coolMul;
    s.heat = clamp(s.heat + (heatRate - cool) * dt, 0, 100);
    if (s.heat > 75 && !this.dead && this.alarmT <= 0) {
      this.alarmT = s.heat > 90 ? 0.5 : 1.2;
      this.sfx.warn();
    }
    if (s.heat > 92 && !this.dead) {
      s.hull -= 2.5 * dt;
      this.flash = Math.min(0.4, this.flash + dt * 0.5);
      if (s.hull <= 0) this.die("Reactor meltdown");
    }

    // docking
    if (!this.dead && this.dockCd <= 0) {
      const dd = Math.hypot(s.x - STATION.x, s.y - STATION.y);
      if (dd < 78) {
        if (Math.hypot(s.vx, s.vy) < 190) {
          this.dock();
          return;
        } else if (this.fullMsgT <= 0) {
          this.fullMsgT = 2;
          this.msg("TOO FAST TO DOCK — BRAKE", "#ffb347", 1.8);
        }
      }
    }

    this.updateChunks(dt);
    this.updateBullets(dt);
    this.updateDrones(dt);
    this.spawnLogic(dt);

    // death timer
    if (this.dead) {
      this.deadT += dt;
      if (this.deadT > 2) this.setState("over");
    }
  }

  private doDrill(dt: number, dl: number): number {
    const s = this.ship;
    const range = this.drillRange;
    const dx = Math.cos(s.ang);
    const dy = Math.sin(s.ang);
    const sx = s.x + dx * 14;
    const sy = s.y + dy * 14;
    const near = this.asteroids.filter((a) => Math.hypot(a.x - sx, a.y - sy) < range + a.maxR + 10);
    let hitA: Asteroid | null = null;
    let hx = 0;
    let hy = 0;
    let hd = 0;
    for (let d = 0; d <= range; d += 3) {
      const px = sx + dx * d;
      const py = sy + dy * d;
      for (const a of near) {
        const q = radAt(a, px, py);
        if (q.d < q.r) {
          hitA = a;
          hd = q.d;
          break;
        }
      }
      if (hitA) {
        hx = px;
        hy = py;
        break;
      }
    }
    if (!hitA) {
      this.sfx.setDrill(0.25, DRILL_F[dl]);
      return 0;
    }
    const a = hitA;
    const f = DRILL_F[dl] * this.drillMul;
    const inCore = hd < a.cr * 1.25;
    this.tip = { x: hx, y: hy, a, d: hd, core: inCore };
    this.sfx.setDrill(1, DRILL_F[dl] + (inCore ? 0.5 : 0));
    let removed = 0;
    if (!inCore) {
      const spd = 46 * f;
      const rad = 26;
      for (let i = 0; i < N; i++) {
        const th = (i / N) * TAU + a.rot;
        const vx = a.x + Math.cos(th) * a.r[i];
        const vy = a.y + Math.sin(th) * a.r[i];
        const dd = Math.hypot(vx - hx, vy - hy);
        if (dd < rad) {
          const w = 1 - dd / rad;
          const cut = Math.min(spd * w * dt, a.r[i] - a.floor);
          if (cut > 0) {
            a.r[i] -= cut;
            removed += cut;
          }
        }
      }
      a.mat += removed * 0.035;
      while (a.mat >= 1) {
        a.mat -= 1;
        const ang = Math.atan2(s.y - hy, s.x - hx);
        const type: OreType = Math.random() < 0.06 ? "crystal" : a.type;
        this.spawnChunk(hx, hy, type, Math.cos(ang) * 60 + rand(-50, 50), Math.sin(ang) * 60 + rand(-50, 50));
      }
    } else {
      a.coreP += 26 * f * dt;
      if (this.popups.length < 30 && Math.random() < 0.03) {
        this.popups.push({ x: hx, y: hy - 10, text: "CORE BREACH", color: "#ffd84a", t: 0.6 });
      }
      if (a.coreP >= 100) {
        this.extractCore(a);
        return 0;
      }
    }
    // sparks
    const ca = Math.atan2(hy - a.y, hx - a.x);
    for (let i = 0; i < 2; i++) {
      const sa = ca + rand(-1.1, 1.1);
      const v = rand(60, 200);
      this.particles.push({
        x: hx,
        y: hy,
        vx: Math.cos(sa) * v,
        vy: Math.sin(sa) * v,
        life: rand(0.2, 0.5),
        max: 0.5,
        size: rand(1, 2.6),
        color: inCore ? "#ffe680" : i ? "#ffd2a0" : AST_COL[a.type].stroke,
        drag: 2.5,
      });
    }
    if (inCore) this.shake = Math.max(this.shake, 1.5);
    return 12 * DRILL_F[dl] * (inCore ? 1.5 : 1);
  }

  private updateChunks(dt: number) {
    const s = this.ship;
    const mag = this.magnet;
    const cap = this.cargoCap;
    for (const c of this.chunks) {
      c.life -= dt;
      c.rot += dt * 2;
      const dx = s.x - c.x;
      const dy = s.y - c.y;
      const d = Math.hypot(dx, dy);
      const w = ORE[c.type].weight;
      const fits = this.cargoUsed + w <= cap;
      if (!this.dead && fits && d < mag) {
        const pull = 520 * (1 - d / mag) + 120;
        c.vx += (dx / d) * pull * dt;
        c.vy += (dy / d) * pull * dt;
      }
      const dr = Math.exp(-(d < mag && fits ? 2.2 : 0.8) * dt);
      c.vx *= dr;
      c.vy *= dr;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (!this.dead && d < 17) {
        if (fits) {
          this.collect(c);
          c.life = -1;
        } else if (this.fullMsgT <= 0) {
          this.fullMsgT = 2.5;
          this.msg("CARGO HOLD FULL — RETURN TO STATION", "#ffb347", 2.5);
          this.sfx.deny();
        }
      }
    }
    this.chunks = this.chunks.filter((c) => c.life > 0);
  }

  private updateBullets(dt: number) {
    const s = this.ship;
    // player bullets
    for (const b of this.bullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      for (const a of this.asteroids) {
        if (Math.abs(b.x - a.x) > a.maxR || Math.abs(b.y - a.y) > a.maxR) continue;
        const q = radAt(a, b.x, b.y);
        if (q.d < q.r) {
          b.life = -1;
          this.burst(b.x, b.y, 4, AST_COL[a.type].stroke, 120, 0.3, 2);
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const d of this.drones) {
        if (Math.hypot(d.x - b.x, d.y - b.y) < d.r + 4) {
          d.hp -= b.dmg;
          d.flash = 0.12;
          b.life = -1;
          this.burst(b.x, b.y, 5, "#ffe680", 160, 0.3, 2);
          this.sfx.hit();
          if (d.hp <= 0) this.killDrone(d);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
    this.drones = this.drones.filter((d) => d.hp > 0);

    // enemy bullets
    for (const b of this.ebullets) {
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      for (const a of this.asteroids) {
        if (Math.abs(b.x - a.x) > a.maxR || Math.abs(b.y - a.y) > a.maxR) continue;
        const q = radAt(a, b.x, b.y);
        if (q.d < q.r) {
          b.life = -1;
          this.burst(b.x, b.y, 3, "#ff8080", 80, 0.3, 2);
          break;
        }
      }
      if (b.life > 0 && !this.dead && Math.hypot(b.x - s.x, b.y - s.y) < 13 + b.r) {
        if (s.inv <= 0) {
          this.hurt(b.dmg, b.emp ? "Fried by EMP" : "Shot down by a drone");
          if (b.emp) this.jamRandom();
        }
        b.life = -1;
      }
    }
    this.ebullets = this.ebullets.filter((b) => b.life > 0);
  }

  private shoot(d: Drone, speed: number, dmg: number, spread: number, emp = false, r = 3, life = 3) {
    const s = this.ship;
    const dist = Math.hypot(s.x - d.x, s.y - d.y);
    const lead = Math.min(0.6, dist / speed) * 0.5;
    const tx = s.x + s.vx * lead;
    const ty = s.y + s.vy * lead;
    const a = Math.atan2(ty - d.y, tx - d.x) + rand(-spread, spread);
    this.ebullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life, dmg, emp, r });
  }

  private updateDrones(dt: number) {
    const s = this.ship;
    const dif = 1 + 0.07 * (this.sector - 1);
    for (const d of this.drones) {
      d.t += dt;
      d.flash = Math.max(0, d.flash - dt);
      const dx = s.x - d.x;
      const dy = s.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      d.ang = Math.atan2(dy, dx);
      let ax = 0;
      let ay = 0;
      let maxV = 150;
      let want = 240;
      if (d.type === "scout") {
        want = 240;
        maxV = 150 * dif;
        const k = dist > want + 40 ? 1 : dist < want - 60 ? -1 : 0;
        ax = nx * 260 * k + -ny * d.orbit * 170;
        ay = ny * 260 * k + nx * d.orbit * 170;
        d.cd -= dt;
        if (d.cd <= 0 && dist < 560 && !this.dead) {
          d.cd = (1.7 + rand(0, 0.7)) / dif;
          this.shoot(d, 300, 7, 0.08);
          this.sfx.laser();
        }
      } else if (d.type === "breacher") {
        maxV = 255 * dif;
        ax = nx * 430;
        ay = ny * 430;
        if (dist < 26 + 12 && !this.dead) {
          this.burst(d.x, d.y, 26, "#ff9a3c", 260, 0.6, 4);
          this.sfx.boom(0.6);
          this.hurt(17, "Rammed by a breacher drone");
          d.hp = 0;
          this.stats.kills++;
        }
      } else if (d.type === "jammer") {
        want = 340;
        maxV = 130 * dif;
        const k = dist > want + 50 ? 1 : dist < want - 70 ? -1 : 0;
        ax = nx * 240 * k + -ny * d.orbit * 150;
        ay = ny * 240 * k + nx * d.orbit * 150;
        d.cd -= dt;
        if (d.cd <= 0 && dist < 620 && !this.dead) {
          d.cd = (4.6 + rand(0, 1.5)) / dif;
          this.shoot(d, 230, 3, 0.03, true, 5, 4);
          this.sfx.jam();
        }
      } else {
        // overseer
        want = 330;
        maxV = 95;
        const k = dist > want + 60 ? 1 : dist < want - 80 ? -1 : 0;
        ax = nx * 160 * k + -ny * d.orbit * 70;
        ay = ny * 160 * k + nx * d.orbit * 70;
        d.cd -= dt;
        d.cd2 -= dt;
        d.cd3 -= dt;
        if (!this.dead) {
          if (d.cd <= 0 && dist < 800) {
            d.cd = 1.9;
            for (let i = -1; i <= 1; i++) {
              const a = Math.atan2(dy, dx) + i * 0.16;
              this.ebullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, life: 3.2, dmg: 9, emp: false, r: 4 });
            }
            this.sfx.laser();
          }
          if (d.cd2 <= 0) {
            d.cd2 = 7;
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * TAU + d.t;
              this.ebullets.push({ x: d.x, y: d.y, vx: Math.cos(a) * 190, vy: Math.sin(a) * 190, life: 4, dmg: 7, emp: false, r: 4 });
            }
            this.sfx.boom(0.4);
          }
          if (d.cd3 <= 0) {
            d.cd3 = 10;
            if (this.drones.length < 12) {
              this.spawnDrone("breacher", d.x + 30, d.y);
              this.spawnDrone("jammer", d.x - 30, d.y);
            }
            this.msg("OVERSEER DEPLOYS DRONES", "#ff5ad0", 2);
          }
          if (Math.random() < 0.16 * dt) this.jamRandomBoss(d);
        }
      }
      d.vx += ax * dt;
      d.vy += ay * dt;
      const sp = Math.hypot(d.vx, d.vy);
      if (sp > maxV) {
        d.vx *= maxV / sp;
        d.vy *= maxV / sp;
      }
      d.vx *= Math.exp(-0.6 * dt);
      d.vy *= Math.exp(-0.6 * dt);
    }
    // separation + move
    for (let i = 0; i < this.drones.length; i++) {
      const a = this.drones[i];
      for (let j = i + 1; j < this.drones.length; j++) {
        const b = this.drones[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dd = Math.hypot(dx, dy);
        const min = a.r + b.r + 10;
        if (dd < min && dd > 0.01) {
          const push = ((min - dd) / min) * 200 * dt;
          a.vx -= (dx / dd) * push;
          a.vy -= (dy / dd) * push;
          b.vx += (dx / dd) * push;
          b.vy += (dy / dd) * push;
        }
      }
    }
    for (const d of this.drones) {
      d.x = clamp(d.x + d.vx * dt, 10, WORLD_W - 10);
      d.y = clamp(d.y + d.vy * dt, 10, WORLD_H - 10);
    }
    this.drones = this.drones.filter((d) => d.hp > 0);
  }

  private jamRandomBoss(d: Drone) {
    // the overseer occasionally sends a short EMP pulse
    if (Math.hypot(this.ship.x - d.x, this.ship.y - d.y) < 700) this.shoot(d, 210, 3, 0.02, true, 5, 4);
  }

  private spawnLogic(dt: number) {
    if (this.dead) return;
    const cfg = this.cfg;
    // asteroid respawn
    this.astT -= dt;
    if (this.astT <= 0) {
      this.astT = 5;
      if (this.asteroids.length < cfg.asteroids) this.placeAsteroid(750);
    }
    // boss
    if (this.sector === MAX_SECTOR && !this.bossSpawned && this.sectorSold >= cfg.quota * 0.35) {
      this.bossSpawned = true;
      this.spawnAwayFromShip("overseer", 800);
      this.msg("⚠ THE OVERSEER HAS ARRIVED ⚠", "#ff5ad0", 5);
      this.sfx.alarm();
    }
    // drones
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const interval = Math.max(4, cfg.base - this.sectorTime / 25);
      this.spawnT = interval * rand(0.8, 1.2);
      const normal = this.drones.filter((d) => d.type !== "overseer").length;
      const cap = cfg.cap + Math.floor(this.sectorTime / 120);
      if (normal < cap) {
        const r = Math.random();
        const w = cfg.w;
        const type: DroneType = r < w.scout ? "scout" : r < w.scout + w.breacher ? "breacher" : "jammer";
        this.spawnAwayFromShip(type, 720);
      }
    }
  }

  // ---------- rendering ----------
  private render(dt: number) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const s = this.ship;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = "#04060d";
    ctx.fillRect(0, 0, W, H);

    // camera
    let tx: number;
    let ty: number;
    if (this.state === "menu" || this.state === "win") {
      tx = STATION.x - W / 2 + Math.sin(this.time * 0.1) * 40;
      ty = STATION.y - H / 2;
      this.time += dt * 0.5;
    } else {
      tx = s.x - W / 2 + (this.mouse.x - W / 2) * 0.22;
      ty = s.y - H / 2 + (this.mouse.y - H / 2) * 0.22;
    }
    tx = WORLD_W + 160 <= W ? WORLD_W / 2 - W / 2 : clamp(tx, -80, WORLD_W + 80 - W);
    ty = WORLD_H + 160 <= H ? WORLD_H / 2 - H / 2 : clamp(ty, -80, WORLD_H + 80 - H);
    const k = 1 - Math.exp(-6 * dt);
    this.cam.x += (tx - this.cam.x) * k;
    this.cam.y += (ty - this.cam.y) * k;
    const cx = this.cam.x + (Math.random() - 0.5) * this.shake;
    const cy = this.cam.y + (Math.random() - 0.5) * this.shake;

    this.drawBackground(ctx, cx, cy);

    ctx.save();
    ctx.translate(-cx, -cy);
    this.drawWorld(ctx, cx, cy);
    ctx.restore();

    // screen-space effects and HUD
    if (this.state !== "menu") {
      this.drawVignette(ctx);
      if (this.state !== "win") this.drawHUD(ctx);
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const W = this.W;
    const H = this.H;
    // nebula
    const g1 = ctx.createRadialGradient(W * 0.25 - cx * 0.03, H * 0.3 - cy * 0.03, 10, W * 0.25 - cx * 0.03, H * 0.3 - cy * 0.03, W * 0.6);
    g1.addColorStop(0, "rgba(40,30,90,0.35)");
    g1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.8 - cx * 0.05, H * 0.75 - cy * 0.05, 10, W * 0.8 - cx * 0.05, H * 0.75 - cy * 0.05, W * 0.5);
    g2.addColorStop(0, "rgba(10,70,90,0.28)");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);
    for (const st of this.stars) {
      const x = (((st.x - cx * st.z) % W) + W) % W;
      const y = (((st.y - cy * st.z) % H) + H) % H;
      ctx.globalAlpha = 0.3 + st.z * 2;
      ctx.fillStyle = "#cfe8ff";
      ctx.fillRect(x, y, st.s, st.s);
    }
    ctx.globalAlpha = 1;
  }

  private visible(x: number, y: number, m: number, cx: number, cy: number) {
    return x > cx - m && x < cx + this.W + m && y > cy - m && y < cy + this.H + m;
  }

  private drawWorld(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    const s = this.ship;
    // world bounds
    ctx.strokeStyle = "rgba(255,80,80,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([14, 10]);
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.setLineDash([]);

    this.drawStation(ctx);

    for (const a of this.asteroids) if (this.visible(a.x, a.y, a.maxR + 40, cx, cy)) this.drawAsteroid(ctx, a);

    // chunks
    for (const c of this.chunks) {
      if (!this.visible(c.x, c.y, 20, cx, cy)) continue;
      if (c.life < 6 && Math.floor(c.life * 6) % 2 === 0) continue;
      const col = ORE[c.type].color;
      const sz = c.type === "core" ? 9 : 5;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.shadowColor = col;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = col;
      ctx.fillStyle = col + "55";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (c.type === "scrap") {
        ctx.rect(-sz * 0.7, -sz * 0.7, sz * 1.4, sz * 1.4);
      } else {
        ctx.moveTo(0, -sz);
        ctx.lineTo(sz * 0.8, 0);
        ctx.lineTo(0, sz);
        ctx.lineTo(-sz * 0.8, 0);
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // drones
    for (const d of this.drones) if (this.visible(d.x, d.y, 60, cx, cy)) this.drawDrone(ctx, d);

    // bullets
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const b of this.bullets) {
      ctx.strokeStyle = "#ffe680";
      ctx.shadowColor = "#ffb347";
      ctx.shadowBlur = 10;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
      ctx.stroke();
    }
    for (const b of this.ebullets) {
      const col = b.emp ? "#c79bff" : "#ff4d5e";
      ctx.fillStyle = col;
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + (b.emp ? Math.sin(this.time * 20) * 1.5 : 0), 0, TAU);
      ctx.fill();
      if (b.emp) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r + 6, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.restore();

    // ship + drill
    if (!this.dead && this.state !== "menu") this.drawShip(ctx, s);

    // particles
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.restore();

    // popups
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = "center";
    for (const p of this.popups) {
      ctx.globalAlpha = clamp(p.t / 0.5, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawStation(ctx: CanvasRenderingContext2D) {
    const t = this.time;
    ctx.save();
    ctx.translate(STATION.x, STATION.y);
    // docking ring
    ctx.strokeStyle = "rgba(125,255,176,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -t * 20;
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowColor = "#7dffb0";
    ctx.shadowBlur = 14;
    ctx.strokeStyle = "#7dffb0";
    ctx.fillStyle = "#0a1a14";
    ctx.lineWidth = 2;
    ctx.rotate(t * 0.15);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-t * 0.45);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 30, Math.sin(a) * 30);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, TAU);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#7dffb0";
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText("REFINERY STATION", STATION.x, STATION.y - 92);
  }

  private drawAsteroid(ctx: CanvasRenderingContext2D, a: Asteroid) {
    const c = AST_COL[a.type];
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const th = (i / N) * TAU + a.rot;
      const x = a.x + Math.cos(th) * a.r[i];
      const y = a.y + Math.sin(th) * a.r[i];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = c.fill;
    ctx.fill();
    ctx.shadowColor = c.stroke;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = c.stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // cracks
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < N; i += 7) {
      const th = (i / N) * TAU + a.rot;
      ctx.moveTo(a.x + Math.cos(th) * a.cr * 1.4, a.y + Math.sin(th) * a.cr * 1.4);
      ctx.lineTo(a.x + Math.cos(th) * a.r[i] * 0.92, a.y + Math.sin(th) * a.r[i] * 0.92);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // veins
    ctx.fillStyle = c.stroke;
    for (const v of a.veins) {
      const ang = a.rot + v.a;
      if (v.dist < rAtAngle(a, ang) - 5) {
        ctx.globalAlpha = 0.75;
        ctx.fillRect(a.x + Math.cos(ang) * v.dist - v.s / 2, a.y + Math.sin(ang) * v.dist - v.s / 2, v.s, v.s);
      }
    }
    ctx.globalAlpha = 1;
    // core
    const pulse = 0.55 + Math.sin(this.time * 3 + a.x) * 0.15 + (a.coreP > 0 ? 0.3 : 0);
    const g = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, a.cr * 1.4);
    g.addColorStop(0, `rgba(255,216,74,${pulse})`);
    g.addColorStop(0.6, `rgba(255,150,40,${pulse * 0.45})`);
    g.addColorStop(1, "rgba(255,150,40,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.cr * 1.4, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,216,74,0.7)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(a.x, a.y, a.cr, 0, TAU);
    ctx.stroke();
    if (a.coreP > 0) {
      ctx.strokeStyle = "#ffffff";
      ctx.shadowColor = "#ffd84a";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.cr + 8, -Math.PI / 2, -Math.PI / 2 + (a.coreP / 100) * TAU);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  private drawDrone(ctx: CanvasRenderingContext2D, d: Drone) {
    const col = d.type === "scout" ? "#ff4d5e" : d.type === "breacher" ? "#ff9a3c" : d.type === "jammer" ? "#b07bff" : "#ff5ad0";
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.shadowColor = col;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = d.flash > 0 ? "#ffffff" : col;
    ctx.fillStyle = d.flash > 0 ? "#ffffff66" : "#1a0a12";
    ctx.lineWidth = 2;
    if (d.type === "scout") {
      ctx.rotate(d.ang);
      ctx.beginPath();
      ctx.moveTo(15, 0);
      ctx.lineTo(0, -11);
      ctx.lineTo(-12, 0);
      ctx.lineTo(0, 11);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(3, 0, 3, 0, TAU);
      ctx.fill();
    } else if (d.type === "breacher") {
      ctx.rotate(d.ang);
      const p = 1 + Math.sin(this.time * 14 + d.t) * 0.12;
      ctx.scale(p, p);
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-8, -10);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-8, -10);
      ctx.lineTo(-14, -14);
      ctx.moveTo(-8, 10);
      ctx.lineTo(-14, 14);
      ctx.stroke();
    } else if (d.type === "jammer") {
      ctx.rotate(d.t * 0.8);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        ctx.lineTo(Math.cos(a) * 15, Math.sin(a) * 15);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-d.t * 2);
      ctx.beginPath();
      ctx.arc(0, 0, 8 + Math.sin(d.t * 6) * 1.5, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, TAU);
      ctx.fillStyle = col;
      ctx.fill();
    } else {
      ctx.rotate(d.t * 0.25);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.rotate(-d.t * 0.9);
      for (let j = 0; j < 2; j++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU;
          ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(0, 0, 7 + Math.sin(d.t * 4) * 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // hp bar for damaged non-boss
    if (d.type !== "overseer" && d.hp < d.maxHp) {
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(d.x - 14, d.y - d.r - 10, 28, 4);
      ctx.fillStyle = col;
      ctx.fillRect(d.x - 14, d.y - d.r - 10, 28 * (d.hp / d.maxHp), 4);
    }
  }

  private drawShip(ctx: CanvasRenderingContext2D, s: Game["ship"]) {
    const heatF = clamp(s.heat / 100, 0, 1);
    const r = Math.round(110 + 145 * heatF);
    const g = Math.round(243 - 160 * heatF);
    const b = Math.round(255 - 200 * heatF);
    const col = `rgb(${r},${g},${b})`;
    const flicker = s.inv > 0 && Math.floor(this.time * 14) % 2 === 0;

    // drill beam
    if (this.tip && this.mouse.d0) {
      const nx = Math.cos(s.ang);
      const ny = Math.sin(s.ang);
      const x0 = s.x + nx * 22;
      const y0 = s.y + ny * 22;
      const tip = this.tip;
      const dist = Math.hypot(tip.x - x0, tip.y - y0);
      const segs = Math.max(2, Math.floor(dist / 8));
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = tip.core ? "#ffe680" : "#ffb347";
      ctx.shadowColor = ctx.strokeStyle;
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const j = (Math.random() - 0.5) * 6;
        ctx.lineTo(x0 + (tip.x - x0) * t - ny * j, y0 + (tip.y - y0) * t + nx * j);
      }
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
      // drill bit
      ctx.translate(tip.x, tip.y);
      ctx.rotate(this.drillAnim);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (this.mouse.d0 && this.lvl("drill") > 0 && this.state === "playing") {
      const nx = Math.cos(s.ang);
      const ny = Math.sin(s.ang);
      ctx.strokeStyle = "rgba(255,179,71,0.25)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(s.x + nx * 22, s.y + ny * 22);
      ctx.lineTo(s.x + nx * this.drillRange, s.y + ny * this.drillRange);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // range ring
    ctx.strokeStyle = "rgba(110,243,255,0.07)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(s.x, s.y, this.drillRange + 14, 0, TAU);
    ctx.stroke();
    // magnet ring (faint)
    ctx.strokeStyle = "rgba(125,255,176,0.05)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, this.magnet, 0, TAU);
    ctx.stroke();

    if (flicker) return;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.ang);
    ctx.shadowColor = col;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = col;
    ctx.fillStyle = "#0a1a24";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, -11);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // drill arm
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(22, 0);
    ctx.stroke();
    // side pods
    ctx.beginPath();
    ctx.moveTo(-2, -8);
    ctx.lineTo(-2, -13);
    ctx.moveTo(-2, 8);
    ctx.lineTo(-2, 13);
    ctx.stroke();
    // heat core
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.5 + heatF * 0.5;
    ctx.beginPath();
    ctx.arc(-3, 0, 2.5, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  private drawVignette(ctx: CanvasRenderingContext2D) {
    const W = this.W;
    const H = this.H;
    const heat = this.ship.heat;
    if (heat > 60 && !this.dead) {
      const a = clamp((heat - 60) / 40, 0, 1) * (0.25 + Math.sin(this.time * 8) * 0.05);
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, "rgba(255,60,30,0)");
      g.addColorStop(1, `rgba(255,60,30,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,40,40,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    // scanlines
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  private text(t: string, x: number, y: number, color: string, size = 12, align: CanvasTextAlign = "left", bold = true) {
    const ctx = this.ctx;
    ctx.font = `${bold ? "bold " : ""}${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(t, x, y);
  }

  private bar(x: number, y: number, w: number, h: number, frac: number, color: string, label: string, val: string, flash = false) {
    const ctx = this.ctx;
    this.text(label, x, y + h - 1, "#8fb4c8", 11);
    const bx = x + 54;
    ctx.fillStyle = "rgba(10,20,30,0.75)";
    ctx.fillRect(bx, y, w, h);
    ctx.fillStyle = flash && Math.floor(this.time * 6) % 2 === 0 ? "#ffffff" : color;
    ctx.fillRect(bx, y, w * clamp(frac, 0, 1), h);
    ctx.strokeStyle = "rgba(143,180,200,0.5)";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, y + 0.5, w, h);
    this.text(val, bx + w + 8, y + h - 1, "#d8ecf7", 11);
  }

  private drawHUD(ctx: CanvasRenderingContext2D) {
    const W = this.W;
    const H = this.H;
    const s = this.ship;
    ctx.shadowBlur = 0;

    // top-left bars
    const hullC = s.hull / this.maxHull > 0.5 ? "#7dffb0" : s.hull / this.maxHull > 0.25 ? "#ffd84a" : "#ff4d5e";
    this.bar(16, 16, 170, 13, s.hull / this.maxHull, hullC, "HULL", `${Math.ceil(Math.max(0, s.hull))}/${this.maxHull}`);
    const heatC = s.heat < 55 ? "#6ef3ff" : s.heat < 80 ? "#ffb347" : "#ff4d5e";
    this.bar(16, 38, 170, 13, s.heat / 100, heatC, "HEAT", `${Math.round(s.heat)}%`, s.heat > 88);
    this.bar(16, 60, 170, 13, this.cargoUsed / this.cargoCap, "#ffd84a", "CARGO", `${this.cargoUsed}/${this.cargoCap}  ¤${this.cargoValue}`);
    if (this.lockout) {
      this.text("⚠ OVERHEAT LOCKOUT — COOL TO 60%", 16, 94, Math.floor(this.time * 5) % 2 ? "#ff4d5e" : "#ffb347", 12);
    }

    // top center: quota
    const cfg = this.cfg;
    const qw = 340;
    const qx = W / 2 - qw / 2;
    this.text(`SECTOR ${this.sector} · ${cfg.name}`, W / 2, 24, "#6ef3ff", 13, "center");
    ctx.fillStyle = "rgba(10,20,30,0.75)";
    ctx.fillRect(qx, 32, qw, 12);
    const frac = this.sectorSold / cfg.quota;
    ctx.fillStyle = frac >= 1 ? "#7dffb0" : "#ffd84a";
    ctx.fillRect(qx, 32, qw * clamp(frac, 0, 1), 12);
    ctx.strokeStyle = "rgba(143,180,200,0.5)";
    ctx.strokeRect(qx + 0.5, 32.5, qw, 12);
    this.text(`QUOTA  ¤${this.sectorSold} / ¤${cfg.quota}`, W / 2, 60, "#d8ecf7", 11, "center");
    const bossLeft = this.sector === MAX_SECTOR && !this.bossDefeated;
    if (frac >= 1 && !bossLeft) {
      if (Math.floor(this.time * 3) % 2 === 0) this.text("QUOTA MET — RETURN TO STATION TO FILE", W / 2, 76, "#7dffb0", 12, "center");
    } else if (frac >= 1 && bossLeft) {
      this.text("QUOTA MET — DESTROY THE OVERSEER", W / 2, 76, "#ff5ad0", 12, "center");
    } else if (this.cargoValue > 0 && this.cargoUsed >= this.cargoCap * 0.8) {
      this.text("HOLD NEARLY FULL — DOCK TO SELL", W / 2, 76, "#ffb347", 11, "center");
    }

    // messages
    let my = 100;
    for (const m of this.msgs) {
      ctx.globalAlpha = clamp(m.t / 0.6, 0, 1);
      this.text(m.text, W / 2, my, m.color, 14, "center");
      my += 20;
    }
    ctx.globalAlpha = 1;

    // top-right: credits + minimap
    this.text(`¤ ${this.credits}`, W - 16, 26, "#ffd84a", 20, "right");
    this.drawMinimap(ctx, W - 176, 40);
    this.text(`[M] SOUND ${this.sfx.muted ? "OFF" : "ON"}   [ESC] PAUSE`, W - 16, 40 + 120 + 18, "#5f7f93", 10, "right", false);

    // station arrow
    const dxs = STATION.x - s.x;
    const dys = STATION.y - s.y;
    const sx = STATION.x - this.cam.x;
    const sy = STATION.y - this.cam.y;
    if (sx < 30 || sx > W - 30 || sy < 30 || sy > H - 30) {
      const ang = Math.atan2(dys, dxs);
      const rad = Math.min(W, H) * 0.4;
      const px = W / 2 + Math.cos(ang) * rad * (W / H > 1 ? 1.4 : 1);
      const py = H / 2 + Math.sin(ang) * rad;
      const px2 = clamp(px, 40, W - 40);
      const py2 = clamp(py, 110, H - 40);
      const hot = this.cargoUsed > 0;
      ctx.save();
      ctx.translate(px2, py2);
      ctx.rotate(ang);
      ctx.globalAlpha = hot ? 0.95 : 0.45;
      ctx.fillStyle = "#7dffb0";
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-8, -8);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      this.text(`BASE ${Math.round(Math.hypot(dxs, dys) / 10)}m`, px2, py2 + 24, "#7dffb0", 10, "center");
      ctx.globalAlpha = 1;
    }

    // power panel
    this.drawPower(ctx, 16, H - 160);

    // boss bar
    const boss = this.drones.find((d) => d.type === "overseer");
    if (boss) {
      const bw = Math.min(520, W - 420);
      const bx = W / 2 - bw / 2 + 60;
      const by = H - 44;
      this.text("THE OVERSEER", bx + bw / 2, by - 6, "#ff5ad0", 11, "center");
      ctx.fillStyle = "rgba(10,20,30,0.8)";
      ctx.fillRect(bx, by, bw, 12);
      ctx.fillStyle = "#ff5ad0";
      ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), 12);
      ctx.strokeStyle = "rgba(255,90,208,0.6)";
      ctx.strokeRect(bx + 0.5, by + 0.5, bw, 12);
    }

    // hints
    if (this.hintT < 22 && !this.dead) {
      ctx.globalAlpha = clamp((22 - this.hintT) / 3, 0, 0.85);
      this.text("WASD thrust · MOUSE aim · HOLD LMB drill · RMB/SPACE cannon · 1-4 add power pip (SHIFT+n remove)", W / 2, H - 14, "#8fb4c8", 11, "center", false);
      if (this.sector === 1 && this.hintT < 14) this.text("Drill rock → collect ore → dock at the station. Dig to the golden CORE for a jackpot.", W / 2, H - 30, "#ffd84a", 11, "center", false);
      ctx.globalAlpha = 1;
    }

    // crosshair
    if (!this.dead) {
      const mx = this.mouse.x;
      const my2 = this.mouse.y;
      ctx.strokeStyle = this.mouse.d0 ? "#ffb347" : "rgba(110,243,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(mx, my2, 8, 0, TAU);
      ctx.moveTo(mx - 14, my2);
      ctx.lineTo(mx - 5, my2);
      ctx.moveTo(mx + 14, my2);
      ctx.lineTo(mx + 5, my2);
      ctx.moveTo(mx, my2 - 14);
      ctx.lineTo(mx, my2 - 5);
      ctx.moveTo(mx, my2 + 14);
      ctx.lineTo(mx, my2 + 5);
      ctx.stroke();
    }

    if (this.dead) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(this.deadT / 2, 0, 0.6)})`;
      ctx.fillRect(0, 0, W, H);
      this.text("RIG DESTROYED", W / 2, H / 2, "#ff4d5e", 34, "center");
      this.text(this.deathCause, W / 2, H / 2 + 26, "#d8ecf7", 14, "center", false);
    }
  }

  private drawPower(ctx: CanvasRenderingContext2D, x0: number, y0: number) {
    const w = 302;
    const h = 146;
    ctx.fillStyle = "rgba(6,14,22,0.8)";
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = "rgba(110,243,255,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w, h);
    const free = this.poolFree;
    this.text("REACTOR ROUTING", x0 + 10, y0 + 17, "#6ef3ff", 11);
    this.text(`FREE PIPS: ${free}/${this.reactor}`, x0 + w - 10, y0 + 17, free > 0 ? "#ffd84a" : "#5f7f93", 11, "right");
    this.btns = [];
    SYS.forEach((k, i) => {
      const y = y0 + 28 + i * 27;
      const jam = this.jam[k] > 0;
      const locked = this.lockout && (k === "drill" || k === "weapons");
      this.text(String(i + 1), x0 + 10, y + 16, "#ffd84a", 13);
      this.text(SYS_NAME[k], x0 + 26, y + 15, jam ? "#c79bff" : locked ? "#ff8a5c" : "#d8ecf7", 11);
      // minus
      const bxm = x0 + 100;
      const bxp = x0 + 226;
      for (const [bx, label, delta] of [
        [bxm, "−", -1],
        [bxp, "+", 1],
      ] as [number, string, number][]) {
        ctx.fillStyle = "rgba(110,243,255,0.12)";
        ctx.fillRect(bx, y, 22, 22);
        ctx.strokeStyle = "rgba(110,243,255,0.5)";
        ctx.strokeRect(bx + 0.5, y + 0.5, 22, 22);
        this.text(label, bx + 11, y + 16, "#6ef3ff", 15, "center");
        this.btns.push({ x: bx, y, w: 22, h: 22, sys: k, delta });
      }
      for (let p = 0; p < 5; p++) {
        const px = x0 + 128 + p * 19;
        const on = p < this.power[k];
        ctx.fillStyle = on ? (jam ? "#7a52c8" : locked ? "#ff8a5c" : "#6ef3ff") : "rgba(143,180,200,0.12)";
        ctx.fillRect(px, y + 3, 16, 16);
        if (on && !jam && !locked) {
          ctx.fillStyle = "rgba(255,255,255,0.35)";
          ctx.fillRect(px, y + 3, 16, 5);
        }
      }
      if (jam) this.text(`${this.jam[k].toFixed(0)}s`, x0 + w - 6, y + 15, "#c79bff", 10, "right");
      else if (locked) this.text("LOCK", x0 + w - 6, y + 15, "#ff8a5c", 9, "right");
      else {
        const L = this.power[k];
        let eff = "";
        if (k === "engines") eff = `${Math.round(ENG_F[L] * 100)}%`;
        if (k === "drill") eff = L ? `${Math.round(DRILL_F[L] * 100)}%` : "OFF";
        if (k === "weapons") eff = L ? `${Math.round(WEAP_F[L] * 100)}%` : "OFF";
        if (k === "cooling") eff = `${Math.round((2 + 4.5 * L) * this.coolMul)}/s`;
        this.text(eff, x0 + w - 6, y + 15, "#5f7f93", 9, "right");
      }
    });
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const w = 160;
    const h = Math.round((w * WORLD_H) / WORLD_W);
    const sx = w / WORLD_W;
    const sy = h / WORLD_H;
    ctx.fillStyle = "rgba(6,14,22,0.8)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(110,243,255,0.4)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w, h);
    for (const a of this.asteroids) {
      ctx.fillStyle = AST_COL[a.type].stroke;
      const r = Math.max(1.5, a.maxR * sx * 0.7);
      ctx.fillRect(x + a.x * sx - r / 2, y + a.y * sy - r / 2, r, r);
    }
    for (const d of this.drones) {
      ctx.fillStyle = d.type === "overseer" ? "#ff5ad0" : "#ff4d5e";
      const r = d.type === "overseer" ? 6 : 3;
      ctx.fillRect(x + d.x * sx - r / 2, y + d.y * sy - r / 2, r, r);
    }
    ctx.fillStyle = "#7dffb0";
    ctx.fillRect(x + STATION.x * sx - 3, y + STATION.y * sy - 3, 6, 6);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + this.ship.x * sx - 2, y + this.ship.y * sy - 2, 4, 4);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(x + this.cam.x * sx, y + this.cam.y * sy, this.W * sx, this.H * sy);
  }
}
