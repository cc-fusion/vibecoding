import {
  BOSS_WAVES,
  BUFFS,
  CORES,
  ENEMIES,
  FINAL_WAVE,
  MODS,
  MOD_IDS,
  CORE_IDS,
  UPGRADES,
  WAVE_MODS,
  computeWeapon,
} from "./data";
import type {
  BuffKind,
  CoreId,
  EnemyDef,
  EnemyKind,
  ModId,
  ModInst,
  UpgradeId,
  WaveModDef,
  WeaponStats,
} from "./data";
import { audio } from "./audio";

export const W = 1280;
export const H = 720;
const M = 20; // arena margin
const TAU = Math.PI * 2;
const FONT = '"Orbitron", "Rajdhani", ui-monospace, Menlo, Consolas, monospace';

export type Mode = "menu" | "playing" | "paused" | "shop" | "over" | "victory";

export interface Offer {
  kind: "core" | "mod";
  id: string;
  sold: boolean;
}

export interface RunState {
  scrap: number;
  score: number;
  kills: number;
  wave: number;
  time: number;
  reflects: number;
  maxCombo: number;
  core: CoreId;
  ownedCores: CoreId[];
  owned: Partial<Record<ModId, number>>;
  equipped: ModId[];
  lv: Record<UpgradeId, number>;
  free: Offer[];
  freePicked: boolean;
  market: Offer[];
  rerolls: number;
  won: boolean;
  newBest: boolean;
}

export interface Callbacks {
  onMode: (m: Mode) => void;
  onChange: () => void;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  r: number;
  age: number;
  spawnT: number;
  flash: number;
  slow: number;
  slowAmt: number;
  burn: number;
  burnDps: number;
  st: number;
  stT: number;
  a: number;
  dir: number;
  cd: number;
  cd2: number;
  cd3: number;
  cd4: number;
  dead: boolean;
  boss: boolean;
  phase: number;
  speedMul: number;
  dashId: number;
  tx: number;
  ty: number;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  friendly: boolean;
  color: string;
  pierce: number;
  bounce: number;
  homing: number;
  explode: number;
  chain: number;
  slow: number;
  burn: number;
  hit: Enemy[];
  refl: boolean;
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

interface Ring {
  x: number;
  y: number;
  r: number;
  max: number;
  str: number;
  speed: number;
  color: string;
  vis: boolean;
}

interface Arc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: "scrap" | "hp" | "orb";
  val: number;
  orb?: BuffKind;
  life: number;
  r: number;
}

interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  angle: number;
  iframes: number;
  dashT: number;
  dashDx: number;
  dashDy: number;
  dashId: number;
  reflectT: number;
  charges: number;
  chargeTimer: number;
  fireCd: number;
  burstLeft: number;
  burstCd: number;
  dead: boolean;
  trail: { x: number; y: number; a: number }[];
}

interface WaveState {
  n: number;
  queue: EnemyKind[];
  spawnT: number;
  bossKind: EnemyKind | null;
  bossSpawned: boolean;
  bossT: number;
  mod: WaveModDef | null;
  hpMul: number;
  bossMul: number;
  fireMul: number;
  speedMul: number;
  scrapMul: number;
  bounce: boolean;
  bannerT: number;
  clearT: number;
  cleared: boolean;
  cap: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

type BuffKey = "overdrive" | "quad" | "slowmo" | "phase" | "aegis" | "mutation";

const BEST_KEY = "neon-grid-gladiator-best";

function freshRun(): RunState {
  return {
    scrap: 60,
    score: 0,
    kills: 0,
    wave: 0,
    time: 0,
    reflects: 0,
    maxCombo: 0,
    core: "pulse",
    ownedCores: ["pulse"],
    owned: {},
    equipped: [],
    lv: { hull: 0, dash: 0, engine: 0, magnet: 0, slot: 0, charge: 0 },
    free: [],
    freePicked: false,
    market: [],
    rerolls: 0,
    won: false,
    newBest: false,
  };
}

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private cb: Callbacks;
  mode: Mode = "menu";
  run: RunState = freshRun();
  best = 0;
  weapon: WeaponStats = computeWeapon("pulse", []);

  private p: Player = this.newPlayer();
  private enemies: Enemy[] = [];
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private arcs: Arc[] = [];
  private texts: FloatText[] = [];
  private pickups: Pickup[] = [];
  private wave: WaveState = this.newWave(1);

  private buffs = { overdrive: 0, quad: 0, slowmo: 0, phase: 0, aegis: 0, mutation: 0 };
  private mutId: ModId | null = null;
  private shield = 0;
  private magnetT = 0;
  private combo = 0;
  private comboT = 0;
  private shake = 0;
  private hurtFlash = 0;
  private whiteFlash = 0;
  private hitStop = 0;
  private slowT = 0;
  private deathT = 0;
  private time = 0;
  private lastT = 0;
  private raf = 0;
  private ambientT = 0;
  private uid = 1;
  private scrapAcc = 0;
  private reflectTextCd = 0;

  private keys: Record<string, boolean> = {};
  private fire = false;
  private dashPressed = false;
  private aimX = W / 2;
  private aimY = H / 2;
  private padActive = false;
  private padPrevDash = false;
  private muted = false;

  private bg: HTMLCanvasElement;
  private glowCache = new Map<string, HTMLCanvasElement>();

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.cb = cb;
    try {
      this.best = parseInt(localStorage.getItem(BEST_KEY) || "0", 10) || 0;
    } catch {
      this.best = 0;
    }
    this.bg = document.createElement("canvas");
    this.bg.width = W;
    this.bg.height = H;
    const g = this.bg.getContext("2d")!;
    const grad = g.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 820);
    grad.addColorStop(0, "#120a2e");
    grad.addColorStop(0.6, "#07041a");
    grad.addColorStop(1, "#020108");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("contextmenu", this.onCtx);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("contextmenu", this.onCtx);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  // ---------------------------------------------------------------- derived
  maxHp() {
    return 100 + 25 * this.run.lv.hull;
  }
  slots() {
    return 2 + this.run.lv.slot;
  }
  maxCharges() {
    return 2 + this.run.lv.charge;
  }
  dashCd() {
    return 1.7 * Math.pow(0.88, this.run.lv.dash);
  }
  moveSpeed() {
    return 300 * (1 + 0.07 * this.run.lv.engine);
  }
  magnetR() {
    return 120 * (1 + 0.35 * this.run.lv.magnet);
  }
  isMuted() {
    return this.muted;
  }
  toggleMute() {
    this.muted = !this.muted;
    audio.setMuted(this.muted);
    return this.muted;
  }
  playerHp() {
    return this.p.hp;
  }

  private newPlayer(): Player {
    return {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0,
      r: 11,
      hp: 100,
      angle: 0,
      iframes: 0,
      dashT: 0,
      dashDx: 1,
      dashDy: 0,
      dashId: 0,
      reflectT: 0,
      charges: 2,
      chargeTimer: 0,
      fireCd: 0,
      burstLeft: 0,
      burstCd: 0,
      dead: false,
      trail: [],
    };
  }

  private newWave(n: number): WaveState {
    return {
      n,
      queue: [],
      spawnT: 2,
      bossKind: null,
      bossSpawned: false,
      bossT: 0,
      mod: null,
      hpMul: 1,
      bossMul: 1,
      fireMul: 1,
      speedMul: 1,
      scrapMul: 1,
      bounce: false,
      bannerT: 3,
      clearT: 0,
      cleared: false,
      cap: 8,
    };
  }

  // ---------------------------------------------------------------- flow
  private setMode(m: Mode) {
    this.mode = m;
    this.cb.onMode(m);
    this.cb.onChange();
  }

  startRun() {
    audio.init();
    audio.play("ui");
    this.run = freshRun();
    this.p = this.newPlayer();
    this.p.hp = this.maxHp();
    this.p.charges = this.maxCharges();
    this.resetWorld();
    this.buffs = { overdrive: 0, quad: 0, slowmo: 0, phase: 0, aegis: 0, mutation: 0 };
    this.mutId = null;
    this.shield = 0;
    this.combo = 0;
    this.refreshWeapon();
    this.beginWave(1);
    this.setMode("playing");
  }

  toMenu() {
    audio.play("ui");
    audio.resume();
    audio.intensity = 0;
    this.resetWorld();
    this.setMode("menu");
  }

  continueEndless() {
    audio.play("ui");
    this.run.won = true;
    this.enterShop();
  }

  startNextWave() {
    audio.play("ui");
    this.resetWorld();
    const p = this.p;
    p.x = W / 2;
    p.y = H / 2;
    p.vx = p.vy = 0;
    p.iframes = 1.5;
    p.charges = this.maxCharges();
    this.beginWave(this.run.wave + 1);
    this.setMode("playing");
  }

  togglePause() {
    if (this.mode === "playing") {
      this.fire = false;
      this.setMode("paused");
      audio.suspend();
    } else if (this.mode === "paused") {
      audio.resume();
      this.lastT = performance.now();
      this.setMode("playing");
    }
  }

  private resetWorld() {
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.arcs = [];
    this.texts = [];
    this.rings = [];
    this.magnetT = 0;
    this.slowT = 0;
    this.deathT = 0;
  }

  private bossFor(n: number): EnemyKind | null {
    if (BOSS_WAVES[n]) return BOSS_WAVES[n];
    if (n > FINAL_WAVE && n % 5 === 0) {
      const list: EnemyKind[] = ["warden", "hydra", "overmind"];
      return list[(n / 5 - 1) % 3];
    }
    return null;
  }

  private beginWave(n: number) {
    this.run.wave = n;
    const w = this.newWave(n);
    w.bossKind = this.bossFor(n);
    let budget = 4 + n * 3.3;
    let mod: WaveModDef | null = null;
    if (!w.bossKind && n >= 2 && Math.random() < 0.55) {
      mod = WAVE_MODS[Math.floor(Math.random() * WAVE_MODS.length)];
    }
    w.mod = mod;
    w.hpMul = 1 + 0.045 * (n - 1);
    w.bossMul = n > FINAL_WAVE ? 1 + (n - FINAL_WAVE) * 0.12 : 1;
    w.speedMul = 1 + 0.008 * n;
    w.cap = 6 + Math.min(10, n);
    if (mod) {
      switch (mod.id) {
        case "frenzy":
          w.speedMul *= 1.25;
          break;
        case "armored":
          w.hpMul *= 1.4;
          w.scrapMul = 1.5;
          break;
        case "hell":
          w.fireMul = 0.65;
          break;
        case "bounce":
          w.bounce = true;
          break;
        case "gold":
          w.scrapMul = 2;
          budget *= 1.2;
          break;
        case "swarm":
          budget *= 1.25;
          w.hpMul *= 0.7;
          w.cap += 4;
          break;
      }
    }
    if (w.bossKind) {
      budget *= 0.4;
      w.cap = 4;
      w.bossT = 2.2;
      w.spawnT = 6;
    }
    // build queue
    const kinds = (Object.keys(ENEMIES) as EnemyKind[]).filter((k) => ENEMIES[k].cost > 0 && ENEMIES[k].minWave <= n);
    let guard = 200;
    while (budget > 0 && guard-- > 0) {
      let cands = kinds.filter((k) => ENEMIES[k].cost <= budget);
      if (mod && mod.id === "swarm") cands = cands.filter((k) => ENEMIES[k].cost <= 2);
      if (!cands.length) break;
      const tot = cands.reduce((s, k) => s + ENEMIES[k].weight, 0);
      let r = Math.random() * tot;
      let pick = cands[0];
      for (const k of cands) {
        r -= ENEMIES[k].weight;
        if (r <= 0) {
          pick = k;
          break;
        }
      }
      w.queue.push(pick);
      budget -= ENEMIES[pick].cost;
    }
    this.wave = w;
    audio.intensity = w.bossKind ? 3 : n >= 4 ? 2 : 1;
    audio.play("wave");
  }

  private refreshWeapon() {
    const mods: ModInst[] = this.run.equipped.map((id) => ({ id, lvl: this.run.owned[id] || 1 }));
    if (this.mutId && this.buffs.mutation > 0) mods.push({ id: this.mutId, lvl: 2 });
    this.weapon = computeWeapon(this.run.core, mods);
  }

  private enterShop() {
    this.resetWorld();
    this.generateOffers(true);
    this.run.freePicked = false;
    this.run.rerolls = 0;
    audio.intensity = 0;
    this.setMode("shop");
  }

  private finishRun(victory: boolean) {
    this.run.newBest = false;
    if (this.run.score > this.best) {
      this.best = this.run.score;
      this.run.newBest = true;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {
        /* ignore */
      }
    }
    audio.intensity = 0;
    audio.play(victory ? "win" : "lose");
    this.setMode(victory ? "victory" : "over");
  }

  // ---------------------------------------------------------------- shop API
  priceOf(o: Offer): number {
    if (o.kind === "core") return CORES[o.id as CoreId].cost;
    const d = MODS[o.id as ModId];
    const lvl = this.run.owned[o.id as ModId] || 0;
    return Math.round((d.cost + this.run.wave * 5) * (1 + 0.5 * lvl));
  }

  upgradePrice(id: UpgradeId): number {
    const u = UPGRADES.find((x) => x.id === id)!;
    return u.base + u.step * this.run.lv[id];
  }

  canAcquire(kind: "core" | "mod", id: string): boolean {
    if (kind === "core") return !this.run.ownedCores.includes(id as CoreId);
    return (this.run.owned[id as ModId] || 0) < 3;
  }

  private acquire(kind: "core" | "mod", id: string) {
    if (kind === "core") {
      this.run.ownedCores.push(id as CoreId);
      this.run.core = id as CoreId;
    } else {
      const m = id as ModId;
      const lvl = (this.run.owned[m] || 0) + 1;
      this.run.owned[m] = lvl;
      if (lvl === 1 && this.run.equipped.length < this.slots()) this.run.equipped.push(m);
    }
    this.refreshWeapon();
  }

  private pickOffers(n: number, exclude: string[]): Offer[] {
    const pool: { kind: "core" | "mod"; id: string; w: number }[] = [];
    for (const id of MOD_IDS) {
      if (this.canAcquire("mod", id) && !exclude.includes(id)) pool.push({ kind: "mod", id, w: MODS[id].weight });
    }
    for (const id of CORE_IDS) {
      if (this.canAcquire("core", id) && !exclude.includes(id)) pool.push({ kind: "core", id, w: 5 });
    }
    const out: Offer[] = [];
    while (out.length < n && pool.length) {
      const tot = pool.reduce((s, x) => s + x.w, 0);
      let r = Math.random() * tot;
      let idx = 0;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].w;
        if (r <= 0) {
          idx = i;
          break;
        }
      }
      const [it] = pool.splice(idx, 1);
      out.push({ kind: it.kind, id: it.id, sold: false });
    }
    return out;
  }

  private generateOffers(all: boolean) {
    if (all) this.run.free = this.pickOffers(3, []);
    const ex = this.run.free.map((o) => o.id);
    this.run.market = this.pickOffers(4, ex);
  }

  pickFree(i: number) {
    const o = this.run.free[i];
    if (!o || this.run.freePicked || !this.canAcquire(o.kind, o.id)) return;
    this.acquire(o.kind, o.id);
    o.sold = true;
    this.run.freePicked = true;
    audio.play("buy");
    this.cb.onChange();
  }

  buyMarket(i: number) {
    const o = this.run.market[i];
    if (!o || o.sold || !this.canAcquire(o.kind, o.id)) return;
    const price = this.priceOf(o);
    if (this.run.scrap < price) return;
    this.run.scrap -= price;
    this.acquire(o.kind, o.id);
    o.sold = true;
    audio.play("buy");
    this.cb.onChange();
  }

  rerollCost() {
    return 40 + 30 * this.run.rerolls;
  }

  reroll() {
    const c = this.rerollCost();
    if (this.run.scrap < c) return;
    this.run.scrap -= c;
    this.run.rerolls++;
    this.generateOffers(false);
    audio.play("ui");
    this.cb.onChange();
  }

  buyUpgrade(id: UpgradeId) {
    const u = UPGRADES.find((x) => x.id === id)!;
    if (this.run.lv[id] >= u.max) return;
    const price = this.upgradePrice(id);
    if (this.run.scrap < price) return;
    this.run.scrap -= price;
    this.run.lv[id]++;
    if (id === "hull") this.p.hp = Math.min(this.maxHp(), this.p.hp + 25);
    audio.play("buy");
    this.cb.onChange();
  }

  repairCost() {
    return 60;
  }

  repair() {
    if (this.run.scrap < this.repairCost() || this.p.hp >= this.maxHp()) return;
    this.run.scrap -= this.repairCost();
    this.p.hp = Math.min(this.maxHp(), this.p.hp + this.maxHp() * 0.5);
    audio.play("buy");
    this.cb.onChange();
  }

  toggleEquip(id: ModId) {
    if (!this.run.owned[id]) return;
    const eq = this.run.equipped;
    const i = eq.indexOf(id);
    if (i >= 0) eq.splice(i, 1);
    else {
      if (eq.length >= this.slots()) eq.shift();
      eq.push(id);
    }
    this.refreshWeapon();
    audio.play("ui");
    this.cb.onChange();
  }

  setCore(id: CoreId) {
    if (!this.run.ownedCores.includes(id)) return;
    this.run.core = id;
    this.refreshWeapon();
    audio.play("ui");
    this.cb.onChange();
  }

  // ---------------------------------------------------------------- input
  private onCtx = (e: Event) => e.preventDefault();

  private toLogical(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.aimX = ((e.clientX - r.left) * W) / r.width;
    this.aimY = ((e.clientY - r.top) * H) / r.height;
  }

  private onMouseMove = (e: MouseEvent) => {
    this.toLogical(e);
    this.padActive = false;
  };

  private onMouseDown = (e: MouseEvent) => {
    this.toLogical(e);
    this.padActive = false;
    if (this.mode !== "playing") return;
    if (e.button === 0) this.fire = true;
    if (e.button === 2) this.dashPressed = true;
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.fire = false;
  };

  private onBlur = () => {
    this.keys = {};
    this.fire = false;
    if (this.mode === "playing") this.togglePause();
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (this.mode === "playing" && [" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "tab"].includes(k)) e.preventDefault();
    if (e.repeat) return;
    this.keys[k] = true;
    if ((k === " " || k === "shift") && this.mode === "playing") this.dashPressed = true;
    if (k === "p" || k === "escape") this.togglePause();
    if (k === "m") {
      this.toggleMute();
      this.cb.onChange();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  // ---------------------------------------------------------------- main loop
  private frame = (now: number) => {
    let dt = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    if (this.mode !== "paused") {
      this.time += dt;
      if (this.mode === "playing") this.updatePlaying(dt);
      else this.updateAmbient(dt);
    }
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };

  private updateAmbient(dt: number) {
    this.ambientT -= dt;
    if (this.ambientT <= 0) {
      this.ambientT = rand(0.6, 1.6);
      const x = rand(M, W - M);
      const y = rand(M, H - M);
      this.rings.push({ x, y, r: 0, max: 380, str: 22, speed: 260, color: "#22e8ff", vis: false });
      for (let i = 0; i < 6; i++) {
        this.particles.push({ x, y, vx: rand(-60, 60), vy: rand(-60, 60), life: 1.4, max: 1.4, size: 3, color: Math.random() < 0.5 ? "#22e8ff" : "#ff2bd6", drag: 1 });
      }
    }
    if (audio.lastKick > 0 && this.mode === "menu" && Math.random() < 0.02) {
      this.rings.push({ x: W / 2, y: H / 2, r: 0, max: 500, str: 14, speed: 420, color: "#ff2bd6", vis: false });
    }
    this.updateFx(dt);
  }

  private updateFx(dt: number) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      const d = Math.pow(pt.drag, dt * 60);
      pt.vx *= d;
      pt.vy *= d;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 1800) this.particles.splice(0, this.particles.length - 1800);
    for (const r of this.rings) {
      r.r += r.speed * dt;
    }
    this.rings = this.rings.filter((r) => r.r < r.max);
    if (this.rings.length > 14) this.rings.splice(0, this.rings.length - 14);
    for (const a of this.arcs) a.life -= dt;
    this.arcs = this.arcs.filter((a) => a.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 30 * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.shake *= Math.pow(0.0008, dt);
    if (this.shake < 0.2) this.shake = 0;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 1.8);
    this.whiteFlash = Math.max(0, this.whiteFlash - dt * 2.5);
  }

  // ---------------------------------------------------------------- fx helpers
  private burst(x: number, y: number, color: string, n: number, speed: number, life = 0.6, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = rand(speed * 0.2, speed);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), max: life, size: rand(size * 0.6, size * 1.4), color, drag: 0.94 });
    }
  }

  private addRing(x: number, y: number, max: number, str: number, color: string, vis = true, speed = 520) {
    this.rings.push({ x, y, r: 0, max, str, speed, color, vis });
  }

  private addShake(v: number) {
    this.shake = Math.min(26, this.shake + v);
  }

  private pop(x: number, y: number, text: string, color: string, size = 14, life = 0.9) {
    this.texts.push({ x, y, text, color, life, max: life, size });
    if (this.texts.length > 40) this.texts.shift();
  }

  private comboMult() {
    return Math.min(8, Math.round((1 + this.combo * 0.1) * 10) / 10);
  }

  // ---------------------------------------------------------------- playing update
  private updatePlaying(dtRaw: number) {
    let dt = dtRaw;
    if (this.hitStop > 0) {
      this.hitStop -= dt;
      dt *= 0.08;
    }
    const p = this.p;
    if (!p.dead) this.run.time += dt;

    let ts = 1;
    if (this.slowT > 0) {
      this.slowT -= dt;
      ts = 0.35;
    }
    if (this.buffs.slowmo > 0) ts = Math.min(ts, 0.55);
    if (p.dead) {
      ts = 0.3;
      this.deathT -= dtRaw;
      if (this.deathT <= 0) {
        this.finishRun(false);
        return;
      }
    }
    const edt = dt * ts;

    // buffs
    const b = this.buffs;
    b.overdrive = Math.max(0, b.overdrive - dt);
    b.quad = Math.max(0, b.quad - dt);
    b.slowmo = Math.max(0, b.slowmo - dt);
    b.phase = Math.max(0, b.phase - dt);
    if (b.aegis > 0) {
      b.aegis -= dt;
      if (b.aegis <= 0) this.shield = 0;
    }
    if (b.mutation > 0) {
      b.mutation -= dt;
      if (b.mutation <= 0) {
        this.mutId = null;
        this.refreshWeapon();
      }
    }
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.reflectTextCd -= dt;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    if (!p.dead) this.updatePlayer(dt);
    this.updateWave(dt);
    this.updateEnemies(dt, edt);
    this.updateBullets(dt, edt);
    this.updatePickups(dt);
    this.updateFx(dt);
    this.checkWaveDone(dt);
  }

  // ---------------------------------------------------------------- player
  private pollPad() {
    const out = { mx: 0, my: 0, ax: 0, ay: 0, fire: false, dash: false, has: false };
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      out.has = true;
      const dz = (v: number) => (Math.abs(v) < 0.2 ? 0 : v);
      out.mx = dz(gp.axes[0] || 0);
      out.my = dz(gp.axes[1] || 0);
      out.ax = gp.axes[2] || 0;
      out.ay = gp.axes[3] || 0;
      out.fire = !!(gp.buttons[7]?.pressed || gp.buttons[5]?.pressed);
      out.dash = !!(gp.buttons[0]?.pressed || gp.buttons[4]?.pressed || gp.buttons[6]?.pressed);
      break;
    }
    return out;
  }

  private updatePlayer(dt: number) {
    const p = this.p;
    const k = this.keys;
    let ix = (k["d"] || k["arrowright"] ? 1 : 0) - (k["a"] || k["arrowleft"] ? 1 : 0);
    let iy = (k["s"] || k["arrowdown"] ? 1 : 0) - (k["w"] || k["arrowup"] ? 1 : 0);
    const pad = this.pollPad();
    let wantFire = this.fire;
    if (pad.has) {
      if (pad.mx || pad.my) {
        ix += pad.mx;
        iy += pad.my;
      }
      if (Math.hypot(pad.ax, pad.ay) > 0.35) {
        this.padActive = true;
        const a = Math.atan2(pad.ay, pad.ax);
        this.aimX = clamp(p.x + Math.cos(a) * 220, 0, W);
        this.aimY = clamp(p.y + Math.sin(a) * 220, 0, H);
        wantFire = true;
      } else if (this.padActive && pad.fire) wantFire = true;
      if (pad.fire && !this.padActive) wantFire = true;
      if (pad.dash && !this.padPrevDash) this.dashPressed = true;
      this.padPrevDash = pad.dash;
    }
    const il = Math.hypot(ix, iy);
    if (il > 1) {
      ix /= il;
      iy /= il;
    }
    p.angle = Math.atan2(this.aimY - p.y, this.aimX - p.x);

    p.iframes -= dt;
    p.reflectT -= dt;

    if (this.dashPressed) {
      this.dashPressed = false;
      this.tryDash(ix, iy);
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDx * 1150;
      p.vy = p.dashDy * 1150;
      p.trail.push({ x: p.x, y: p.y, a: 1 });
      // dash ram
      const w = this.weapon;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0 || e.dashId === p.dashId) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + p.r + 16) {
          e.dashId = p.dashId;
          this.knock(e, Math.atan2(e.y - p.y, e.x - p.x), 520);
          this.hurtEnemy(e, 18 * w.reflectMult, false);
          this.burst(e.x, e.y, "#ffffff", 8, 260, 0.4);
          audio.play("hit");
          this.addShake(3);
        }
      }
    } else {
      const sp = this.moveSpeed();
      const f = Math.min(1, dt * 13);
      p.vx += (ix * sp - p.vx) * f;
      p.vy += (iy * sp - p.vy) * f;
      if ((ix || iy) && Math.random() < 0.5) {
        this.particles.push({ x: p.x - Math.cos(p.angle) * 10, y: p.y - Math.sin(p.angle) * 10, vx: -p.vx * 0.1 + rand(-20, 20), vy: -p.vy * 0.1 + rand(-20, 20), life: 0.3, max: 0.3, size: 2.5, color: "#22e8ff", drag: 0.92 });
      }
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = clamp(p.x, M + p.r, W - M - p.r);
    p.y = clamp(p.y, M + p.r, H - M - p.r);
    for (const t of p.trail) t.a -= dt * 5;
    p.trail = p.trail.filter((t) => t.a > 0);

    // dash recharge
    if (p.charges < this.maxCharges()) {
      p.chargeTimer -= dt;
      if (p.chargeTimer <= 0) {
        p.charges++;
        p.chargeTimer = this.dashCd();
        if (p.charges >= this.maxCharges()) p.chargeTimer = 0;
        this.burst(p.x, p.y, "#22e8ff", 6, 120, 0.4, 2);
      }
    }

    // reflect bubble
    if (p.reflectT > 0) this.doReflect();

    // firing
    this.playerFire(dt, wantFire);
  }

  private tryDash(ix: number, iy: number) {
    const p = this.p;
    if (p.dashT > 0) return;
    if (p.charges < 1 && this.buffs.phase <= 0) return;
    let dx = ix;
    let dy = iy;
    if (!dx && !dy) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    } else {
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
    }
    if (this.buffs.phase <= 0) {
      const wasFull = p.charges >= this.maxCharges();
      p.charges--;
      if (wasFull) p.chargeTimer = this.dashCd();
    }
    p.dashDx = dx;
    p.dashDy = dy;
    p.dashT = 0.17;
    p.dashId++;
    p.reflectT = 0.17 + 0.26;
    p.iframes = Math.max(p.iframes, 0.3);
    this.addRing(p.x, p.y, 220, 16, "#22e8ff", true, 700);
    this.burst(p.x, p.y, "#22e8ff", 14, 300, 0.4, 3);
    audio.play("dash");
  }

  private doReflect() {
    const p = this.p;
    const w = this.weapon;
    const rad = w.reflectRadius;
    let count = 0;
    for (const b of this.bullets) {
      if (b.friendly || b.life <= 0) continue;
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      if (dx * dx + dy * dy > (rad + b.r) * (rad + b.r)) continue;
      // target nearest enemy
      let best: Enemy | null = null;
      let bd = 1e9;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < bd) {
          bd = d;
          best = e;
        }
      }
      const sp = Math.max(780, Math.hypot(b.vx, b.vy) * 1.6);
      let ang: number;
      if (best) ang = Math.atan2(best.y - b.y, best.x - b.x);
      else ang = Math.atan2(-b.vy, -b.vx);
      b.vx = Math.cos(ang) * sp;
      b.vy = Math.sin(ang) * sp;
      b.friendly = true;
      b.refl = true;
      b.dmg = (30 + this.run.wave * 1.5) * w.reflectMult;
      b.pierce = 2;
      b.r = Math.max(b.r, 6.5);
      b.life = 2.2;
      b.color = "#ffffff";
      b.hit = [];
      b.bounce = 0;
      b.homing = 2.5;
      b.explode = 0;
      b.chain = 0;
      b.slow = 0;
      b.burn = 0;
      count++;
      this.run.reflects++;
      p.chargeTimer -= 0.25 + 0.15 * (w.reflectMult - 1);
      this.combo++;
      this.comboT = 3.5;
      this.run.score += Math.round(5 * this.comboMult());
      this.burst(b.x, b.y, "#ffffff", 5, 220, 0.35, 2.5);
    }
    if (count > 0) {
      this.hitStop = Math.max(this.hitStop, 0.035);
      this.addShake(2 + Math.min(4, count));
      audio.play("reflect", 1 + Math.min(0.5, this.combo * 0.02));
      this.addRing(p.x, p.y, 160, 10, "#ffffff", true, 600);
      if (this.reflectTextCd <= 0) {
        this.reflectTextCd = 0.45;
        this.pop(p.x, p.y - 26, count > 2 ? `REFLECT ×${count}!` : "REFLECT!", "#ffffff", 16);
      }
    }
  }

  private playerFire(dt: number, want: boolean) {
    const p = this.p;
    const w = this.weapon;
    const rateMul = this.buffs.overdrive > 0 ? 1.6 : 1;
    p.fireCd -= dt;
    if (p.burstLeft > 0) {
      p.burstCd -= dt;
      if (p.burstCd <= 0) {
        this.emitShot();
        p.burstLeft--;
        p.burstCd = 0.055;
        if (p.burstLeft === 0) p.fireCd = 1 / (w.rate * rateMul);
      }
      return;
    }
    if (want && p.fireCd <= 0) {
      this.emitShot();
      if (w.burst > 1) {
        p.burstLeft = w.burst - 1;
        p.burstCd = 0.055;
      } else p.fireCd = 1 / (w.rate * rateMul);
    }
  }

  private emitShot() {
    if (this.bullets.length > 1400) return;
    const p = this.p;
    const w = this.weapon;
    const dmgMul = this.buffs.quad > 0 ? 2 : 1;
    const n = w.count;
    for (let i = 0; i < n; i++) {
      let a: number;
      if (w.ring) a = p.angle + (i / n) * TAU;
      else a = p.angle + (n > 1 ? -w.spread / 2 + (w.spread * i) / (n - 1) : 0);
      a += rand(-w.inaccuracy, w.inaccuracy);
      const sp = w.speed * rand(0.96, 1.04);
      this.bullets.push({
        x: p.x + Math.cos(a) * 16,
        y: p.y + Math.sin(a) * 16,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: w.size,
        dmg: w.damage * dmgMul,
        life: w.life * (w.ring ? 1 : rand(0.9, 1.05)),
        friendly: true,
        color: this.buffs.quad > 0 ? "#ffb347" : w.color,
        pierce: w.pierce,
        bounce: w.bounce,
        homing: w.homing,
        explode: w.explode,
        chain: w.chain,
        slow: w.slow,
        burn: w.burn,
        hit: [],
        refl: false,
      });
    }
    const rec = w.ring ? 0 : 35;
    p.vx -= Math.cos(p.angle) * rec;
    p.vy -= Math.sin(p.angle) * rec;
    this.particles.push({ x: p.x + Math.cos(p.angle) * 18, y: p.y + Math.sin(p.angle) * 18, vx: Math.cos(p.angle) * 80, vy: Math.sin(p.angle) * 80, life: 0.12, max: 0.12, size: 5, color: w.color, drag: 0.9 });
    audio.play("shoot", w.ring ? 0.6 : w.damage > 40 ? 0.45 : 1);
    if (w.damage > 40 || w.ring) this.addShake(1.5);
  }

  private hurtPlayer(dmg: number) {
    const p = this.p;
    if (p.dead || p.iframes > 0 || p.dashT > 0) return;
    if (this.shield > 0) {
      this.shield -= dmg;
      p.iframes = 0.5;
      this.addShake(3);
      this.burst(p.x, p.y, "#7af0ff", 10, 240, 0.4);
      audio.play("hit");
      if (this.shield <= 0) {
        this.shield = 0;
        this.buffs.aegis = 0;
        this.addRing(p.x, p.y, 240, 18, "#7af0ff");
        audio.play("shock");
      }
      return;
    }
    p.hp -= dmg;
    p.iframes = 1.0;
    this.addShake(11);
    this.hurtFlash = 0.6;
    this.combo = 0;
    this.comboT = 0;
    this.hitStop = 0.06;
    this.burst(p.x, p.y, "#ff3355", 18, 340, 0.6, 3);
    this.addRing(p.x, p.y, 260, 20, "#ff3355");
    audio.play("hurt");
    if (p.hp <= 0) {
      p.hp = 0;
      p.dead = true;
      this.deathT = 1.8;
      this.fire = false;
      this.burst(p.x, p.y, "#22e8ff", 70, 600, 1.4, 4);
      this.burst(p.x, p.y, "#ffffff", 30, 400, 1, 3);
      this.addRing(p.x, p.y, 700, 34, "#22e8ff");
      this.addShake(24);
      this.whiteFlash = 0.8;
      audio.play("big");
    }
  }

  // ---------------------------------------------------------------- waves
  private aliveCount() {
    let n = 0;
    for (const e of this.enemies) if (!e.dead && !e.boss) n++;
    return n;
  }

  private spawnPos(): { x: number; y: number } {
    const p = this.p;
    for (let i = 0; i < 20; i++) {
      const x = rand(M + 40, W - M - 40);
      const y = rand(M + 40, H - M - 40);
      if (Math.hypot(x - p.x, y - p.y) > 320) return { x, y };
    }
    return { x: p.x < W / 2 ? W - 80 : 80, y: p.y < H / 2 ? H - 80 : 80 };
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, spawnT = 0.8): Enemy {
    const def = ENEMIES[kind];
    const boss = kind === "warden" || kind === "hydra" || kind === "overmind";
    let hp = def.hp * (boss ? this.wave.bossMul : this.wave.hpMul);
    if (kind === "mini") hp = def.hp;
    const e: Enemy = {
      id: this.uid++,
      kind,
      def,
      x,
      y,
      vx: 0,
      vy: 0,
      kx: 0,
      ky: 0,
      hp,
      maxHp: hp,
      r: def.r,
      age: 0,
      spawnT: boss ? 1.8 : spawnT,
      flash: 0,
      slow: 0,
      slowAmt: 0,
      burn: 0,
      burnDps: 0,
      st: 0,
      stT: 0,
      a: 0,
      dir: Math.random() < 0.5 ? 1 : -1,
      cd: rand(0.6, 1.6),
      cd2: rand(1, 2.5),
      cd3: rand(2, 4),
      cd4: 4,
      dead: false,
      boss,
      phase: 0,
      speedMul: this.wave.speedMul,
      dashId: -1,
      tx: x,
      ty: y,
    };
    if (kind === "lancer") e.cd = rand(1.2, 2.2);
    if (kind === "sniper") e.cd = rand(1.5, 3);
    if (boss) {
      e.cd = 2.5;
      e.cd2 = 3;
      e.cd3 = 5;
      e.cd4 = 7;
      audio.play("boss");
      this.addShake(14);
    } else audio.play("spawn");
    this.enemies.push(e);
    return e;
  }

  private updateWave(dt: number) {
    const w = this.wave;
    if (w.bannerT > 0) w.bannerT -= dt;
    if (w.cleared || this.p.dead) return;
    if (w.bossKind && !w.bossSpawned) {
      w.bossT -= dt;
      if (w.bossT <= 0) {
        w.bossSpawned = true;
        this.spawnEnemy(w.bossKind, W / 2, 150, 1.8);
      }
      return;
    }
    if (w.queue.length === 0) return;
    w.spawnT -= dt;
    const alive = this.aliveCount();
    if (!w.bossKind && alive === 0 && w.spawnT > 0.4) w.spawnT = 0.4;
    if (w.spawnT <= 0 && alive < w.cap) {
      const kind = w.queue.shift()!;
      const pos = this.spawnPos();
      this.spawnEnemy(kind, pos.x, pos.y);
      w.spawnT = w.bossKind ? rand(3.5, 5.5) : Math.max(0.4, 1.4 - w.n * 0.05) * rand(0.7, 1.2);
    }
  }

  private checkWaveDone(dt: number) {
    const w = this.wave;
    if (this.p.dead) return;
    if (!w.cleared) {
      const bossOk = !w.bossKind || w.bossSpawned;
      if (bossOk && w.queue.length === 0 && this.enemies.length === 0) {
        w.cleared = true;
        w.clearT = 2.6;
        const bonus = 40 + 10 * w.n;
        this.run.scrap += bonus;
        this.run.score += 100 * w.n;
        this.p.hp = Math.min(this.maxHp(), this.p.hp + this.maxHp() * 0.2);
        this.clearBullets(true);
        this.magnetT = 99;
        this.pop(W / 2, H / 2 + 60, `+${bonus} SCRAP BONUS`, "#ffe14f", 20, 2);
        audio.play("win");
        audio.intensity = 0;
      }
    } else {
      w.clearT -= dt;
      if (w.clearT <= 0) {
        if (w.n >= FINAL_WAVE && !this.run.won) this.finishRun(true);
        else this.enterShop();
      }
    }
  }

  private clearBullets(score: boolean) {
    for (const b of this.bullets) {
      if (b.friendly) continue;
      b.life = 0;
      this.burst(b.x, b.y, b.color, 2, 120, 0.5, 2);
      if (score) this.run.score += 1;
    }
  }

  // ---------------------------------------------------------------- enemies
  private knock(e: Enemy, ang: number, force: number) {
    const k = e.boss ? 0.04 : Math.min(1, 14 / e.r);
    e.kx += Math.cos(ang) * force * k;
    e.ky += Math.sin(ang) * force * k;
  }

  private eBullet(x: number, y: number, ang: number, speed: number, dmg: number, color: string, r = 5, noBounce = false) {
    if (this.bullets.length > 1400) return;
    this.bullets.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r,
      dmg,
      life: 9,
      friendly: false,
      color,
      pierce: 0,
      bounce: this.wave.bounce && !noBounce ? 2 : 0,
      homing: 0,
      explode: 0,
      chain: 0,
      slow: 0,
      burn: 0,
      hit: [],
      refl: false,
    });
  }

  private fan(e: Enemy, ang: number, n: number, spread: number, speed: number, dmg: number, r = 5) {
    for (let i = 0; i < n; i++) {
      const a = n > 1 ? ang - spread / 2 + (spread * i) / (n - 1) : ang;
      this.eBullet(e.x, e.y, a, speed, dmg, e.def.color, r);
    }
  }

  private ring(e: Enemy, n: number, speed: number, dmg: number, offset: number, gapAng?: number, gapW = 0.5) {
    for (let i = 0; i < n; i++) {
      const a = offset + (i / n) * TAU;
      if (gapAng !== undefined) {
        const d = Math.abs(Math.atan2(Math.sin(a - gapAng), Math.cos(a - gapAng)));
        if (d < gapW) continue;
      }
      this.eBullet(e.x, e.y, a, speed, dmg, e.def.color, 5);
    }
  }

  private wall(color: string, speed: number) {
    const side = Math.floor(Math.random() * 4);
    const step = 46;
    if (side < 2) {
      const gap = rand(M + 140, W - M - 140);
      const y = side === 0 ? M + 8 : H - M - 8;
      const ang = side === 0 ? Math.PI / 2 : -Math.PI / 2;
      for (let x = M + 20; x < W - M; x += step) if (Math.abs(x - gap) > 80) this.eBullet(x, y, ang, speed, 10, color, 6, true);
    } else {
      const gap = rand(M + 110, H - M - 110);
      const x = side === 2 ? M + 8 : W - M - 8;
      const ang = side === 2 ? 0 : Math.PI;
      for (let y = M + 20; y < H - M; y += step) if (Math.abs(y - gap) > 80) this.eBullet(x, y, ang, speed, 10, color, 6, true);
    }
    this.addShake(4);
  }

  private summon(e: Enemy, kind: EnemyKind, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const x = clamp(e.x + Math.cos(a) * 110, M + 30, W - M - 30);
      const y = clamp(e.y + Math.sin(a) * 110, M + 30, H - M - 30);
      this.spawnEnemy(kind, x, y, 0.7);
    }
  }

  private steer(e: Enemy, tvx: number, tvy: number, accel: number, et: number) {
    const f = Math.min(1, accel * et);
    e.vx += (tvx - e.vx) * f;
    e.vy += (tvy - e.vy) * f;
  }

  private moveTo(e: Enemy, tx: number, ty: number, speed: number, et: number) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      this.steer(e, 0, 0, 4, et);
      return;
    }
    const s = Math.min(speed, d * 2);
    this.steer(e, (dx / d) * s, (dy / d) * s, 3, et);
  }

  private updateEnemies(dt: number, edt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      if (e.spawnT > 0) {
        e.spawnT -= edt;
        if (e.spawnT <= 0) {
          this.burst(e.x, e.y, e.def.color, e.boss ? 40 : 10, e.boss ? 500 : 200, 0.5);
          this.addRing(e.x, e.y, e.boss ? 500 : 140, e.boss ? 30 : 10, e.def.color);
        }
        continue;
      }
      const slowF = e.slow > 0 ? 1 - e.slowAmt : 1;
      const et = edt * slowF;
      e.age += et;
      if (e.slow > 0) e.slow -= dt;
      if (e.burn > 0) {
        e.burn -= dt;
        this.hurtEnemy(e, e.burnDps * dt, false);
        if (e.dead) continue;
        if (Math.random() < 0.3) this.particles.push({ x: e.x + rand(-e.r, e.r) * 0.6, y: e.y + rand(-e.r, e.r) * 0.6, vx: rand(-15, 15), vy: rand(-60, -20), life: 0.4, max: 0.4, size: 3, color: "#ff8a2e", drag: 0.95 });
      }
      this.updateEnemyAI(e, et);
      if (e.dead) continue;
      e.kx *= Math.exp(-6 * edt);
      e.ky *= Math.exp(-6 * edt);
      e.x += (e.vx + e.kx) * et + e.kx * (edt - et);
      e.y += (e.vy + e.ky) * et + e.ky * (edt - et);
      e.x = clamp(e.x, M + e.r, W - M - e.r);
      e.y = clamp(e.y, M + e.r, H - M - e.r);

      // contact damage
      if (!p.dead && p.dashT <= 0 && p.iframes <= 0) {
        const d = Math.hypot(p.x - e.x, p.y - e.y);
        if (d < e.r + p.r - 2) {
          let dmg = e.def.contact;
          if (e.kind === "lancer" && e.st === 2) dmg = 24;
          this.hurtPlayer(dmg);
          this.knock(e, Math.atan2(e.y - p.y, e.x - p.x), 600);
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          p.vx += Math.cos(a) * 350;
          p.vy += Math.sin(a) * 350;
        }
      }
    }
    // splitter spawned children appended within loop - fine
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private updateEnemyAI(e: Enemy, et: number) {
    const p = this.p;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const ang = Math.atan2(dy, dx);
    const sp = e.def.speed * e.speedMul;
    const fm = this.wave.fireMul;
    const pDead = p.dead;

    switch (e.kind) {
      case "drone":
      case "mini":
      case "splitter": {
        const wob = Math.sin(e.age * 3 + e.id) * 0.5;
        const a = ang + wob * (e.kind === "mini" ? 0.3 : 0.6);
        this.steer(e, Math.cos(a) * sp, Math.sin(a) * sp, 4, et);
        if (pDead) this.steer(e, 0, 0, 2, et);
        break;
      }
      case "shooter": {
        const want = d > 380 ? 1 : d < 250 ? -1 : 0;
        const tang = Math.sin(e.age * 0.7 + e.id) > 0 ? 1 : -1;
        const tvx = Math.cos(ang) * want * sp - Math.sin(ang) * tang * sp * 0.6;
        const tvy = Math.sin(ang) * want * sp + Math.cos(ang) * tang * sp * 0.6;
        this.steer(e, tvx, tvy, 3, et);
        e.cd -= et;
        if (e.cd <= 0 && !pDead) {
          e.cd = rand(1.6, 2.4) * fm;
          this.eBullet(e.x, e.y, ang + rand(-0.05, 0.05), 270, 10, e.def.color, 5);
          this.burst(e.x, e.y, e.def.color, 3, 100, 0.25, 2);
        }
        break;
      }
      case "lancer": {
        if (e.st === 0) {
          const a = ang + Math.sin(e.age * 2) * 0.6;
          this.steer(e, Math.cos(a) * sp, Math.sin(a) * sp, 3, et);
          e.cd -= et;
          if (e.cd <= 0 && !pDead) {
            e.st = 1;
            e.stT = 0.75;
            e.a = ang;
          }
        } else if (e.st === 1) {
          this.steer(e, 0, 0, 8, et);
          e.stT -= et;
          if (e.stT > 0.25) e.a = ang;
          if (e.stT <= 0) {
            e.st = 2;
            e.stT = 0.55;
          }
        } else if (e.st === 2) {
          this.steer(e, Math.cos(e.a) * 720, Math.sin(e.a) * 720, 12, et);
          e.stT -= et;
          if (Math.random() < 0.7) this.particles.push({ x: e.x, y: e.y, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.3, max: 0.3, size: 3, color: e.def.color, drag: 0.9 });
          if (e.stT <= 0) {
            e.st = 3;
            e.stT = 0.7;
          }
        } else {
          this.steer(e, 0, 0, 6, et);
          e.stT -= et;
          if (e.stT <= 0) {
            e.st = 0;
            e.cd = rand(1.2, 2) * fm;
          }
        }
        break;
      }
      case "spinner": {
        if (d > 330) this.steer(e, Math.cos(ang) * sp, Math.sin(ang) * sp, 2, et);
        else this.steer(e, -Math.sin(ang) * sp * 0.7 * e.dir, Math.cos(ang) * sp * 0.7 * e.dir, 2, et);
        e.cd -= et;
        if (e.cd <= 0 && !pDead) {
          e.cd = 0.22 * fm;
          e.a += 0.4 * e.dir;
          for (let k = 0; k < 3; k++) this.eBullet(e.x, e.y, e.a + (k * TAU) / 3, 200, 8, e.def.color, 4.5);
        }
        if (Math.floor(e.age / 4) % 2 === 0) e.dir = 1;
        else e.dir = -1;
        break;
      }
      case "sniper": {
        if (e.st === 0) {
          const want = d > 500 ? 1 : d < 400 ? -1 : 0;
          this.steer(e, Math.cos(ang) * want * sp, Math.sin(ang) * want * sp, 3, et);
          e.cd -= et;
          if (e.cd <= 0 && !pDead) {
            e.st = 1;
            e.stT = 1.0;
          }
        } else {
          this.steer(e, 0, 0, 6, et);
          e.stT -= et;
          if (e.stT > 0.3) e.a = ang;
          if (e.stT <= 0) {
            this.eBullet(e.x, e.y, e.a, 760, 22, "#ff5050", 5.5);
            this.burst(e.x, e.y, "#ff5050", 8, 240, 0.3, 2.5);
            this.addShake(1.5);
            e.st = 0;
            e.cd = rand(2.4, 3.4) * fm;
          }
        }
        break;
      }
      case "tank": {
        this.steer(e, Math.cos(ang) * sp, Math.sin(ang) * sp, 2, et);
        e.cd -= et;
        if (e.cd <= 0 && !pDead) {
          e.cd = 2.3 * fm;
          this.fan(e, ang, 5, 0.7, 240, 10, 5.5);
          this.addShake(2);
        }
        break;
      }
      case "warden":
        this.bossWarden(e, et, ang, fm);
        break;
      case "hydra":
        this.bossHydra(e, et, ang, d, fm);
        break;
      case "overmind":
        this.bossOvermind(e, et, ang, d, fm);
        break;
    }
  }

  private bossPhase(e: Enemy, thresholds: number[]): number {
    const f = e.hp / e.maxHp;
    let ph = 0;
    for (const t of thresholds) if (f <= t) ph++;
    if (ph !== e.phase) {
      e.phase = ph;
      this.clearBullets(true);
      this.addRing(e.x, e.y, 900, 34, e.def.color);
      this.addShake(16);
      this.whiteFlash = 0.35;
      this.pop(e.x, e.y - e.r - 20, `PHASE ${ph + 1}`, e.def.color, 24, 1.6);
      audio.play("boss");
      e.cd = Math.max(e.cd, 1.2);
      e.cd2 = Math.max(e.cd2, 2);
      e.st = 0;
    }
    return ph;
  }

  private bossWarden(e: Enemy, et: number, ang: number, fm: number) {
    const ph = this.bossPhase(e, [0.66, 0.33]);
    if (this.p.dead) return;
    this.moveTo(e, W / 2 + Math.cos(e.age * 0.35) * 260, H / 2 - 70 + Math.sin(e.age * 0.7) * 110, e.def.speed, et);
    e.dir = Math.floor(e.age / 5) % 2 === 0 ? 1 : -1;
    e.cd -= et;
    if (e.cd <= 0) {
      e.cd = (ph === 2 ? 0.075 : 0.1) * fm;
      e.a += 0.23 * e.dir;
      const arms = ph === 2 ? 3 : 2;
      for (let k = 0; k < arms; k++) this.eBullet(e.x, e.y, e.a + (k * TAU) / arms, 210, 9, e.def.color, 5);
    }
    e.cd2 -= et;
    if (e.cd2 <= 0) {
      e.cd2 = (ph === 0 ? 3.4 : 2.6) * fm;
      this.ring(e, 22, 175, 10, rand(0, TAU));
      this.addShake(4);
    }
    e.cd3 -= et;
    if (ph >= 1 && e.cd3 <= 0) {
      e.cd3 = 1.7 * fm;
      this.fan(e, ang, 3, 0.35, 310, 11, 5.5);
    }
    e.cd4 -= et;
    if (ph >= 2 && e.cd4 <= 0) {
      e.cd4 = 5.5;
      this.summon(e, "drone", 3);
    }
  }

  private bossHydra(e: Enemy, et: number, ang: number, d: number, fm: number) {
    const ph = this.bossPhase(e, [0.66, 0.33]);
    if (this.p.dead) return;
    if (e.st === 0) {
      this.moveTo(e, W / 2 + Math.cos(e.age * 0.5) * 400, 170 + Math.sin(e.age * 0.9) * 70, e.def.speed, et);
      e.cd -= et;
      if (e.cd <= 0) {
        e.cd = (ph === 0 ? 1.4 : 1.05) * fm;
        e.dir = -e.dir;
        if (ph >= 1 && e.dir > 0) this.fan(e, ang, 7, 1.3, 290, 10, 5);
        else this.fan(e, ang, 5, 0.8, 300, 10, 5.5);
      }
      e.cd2 -= et;
      if (ph >= 1 && e.cd2 <= 0) {
        e.cd2 = 7.5 * fm;
        this.wall(e.def.color, 165);
      }
      e.cd3 -= et;
      if (ph >= 1 && e.cd3 <= 0 && d > 150) {
        e.cd3 = ph === 2 ? 4.5 : 6.2;
        e.st = 1;
        e.stT = 0.85;
        e.a = ang;
      }
      e.cd4 -= et;
      if (ph >= 2 && e.cd4 <= 0) {
        e.cd4 = 8;
        this.summon(e, "shooter", 2);
      }
    } else if (e.st === 1) {
      this.steer(e, 0, 0, 8, et);
      e.stT -= et;
      if (e.stT > 0.25) e.a = ang;
      if (e.stT <= 0) {
        e.st = 2;
        e.stT = 0.7;
        this.addShake(6);
      }
    } else {
      this.steer(e, Math.cos(e.a) * 820, Math.sin(e.a) * 820, 14, et);
      e.stT -= et;
      e.cd -= et;
      if (e.cd <= 0) {
        e.cd = 0.06;
        this.eBullet(e.x, e.y, e.a + Math.PI / 2, 140, 9, e.def.color, 4.5);
        this.eBullet(e.x, e.y, e.a - Math.PI / 2, 140, 9, e.def.color, 4.5);
      }
      if (e.stT <= 0) {
        e.st = 0;
        e.cd = 1;
      }
    }
  }

  private bossOvermind(e: Enemy, et: number, ang: number, d: number, fm: number) {
    const ph = this.bossPhase(e, [0.6, 0.25]);
    if (this.p.dead) return;
    if (e.st === 0) {
      this.moveTo(e, W / 2 + Math.cos(e.age * 0.3) * 220, H / 2 + Math.sin(e.age * 0.45) * 140, e.def.speed, et);
      e.cd -= et;
      if (e.cd <= 0) {
        e.cd = (ph === 2 ? 0.08 : 0.115) * fm;
        e.a += 0.19;
        this.eBullet(e.x, e.y, e.a, 215, 9, "#d400ff", 5);
        this.eBullet(e.x, e.y, e.a + Math.PI, 215, 9, "#d400ff", 5);
        if (ph >= 1) {
          this.eBullet(e.x, e.y, -e.a * 1.3, 190, 9, "#ff55dd", 4.5);
          this.eBullet(e.x, e.y, -e.a * 1.3 + Math.PI, 190, 9, "#ff55dd", 4.5);
        }
      }
      e.cd2 -= et;
      if (e.cd2 <= 0) {
        e.cd2 = (ph === 2 ? 2.4 : 3.2) * fm;
        this.ring(e, 34, 190, 10, rand(0, TAU), ang, 0.32);
        this.addShake(4);
      }
      e.cd3 -= et;
      if (ph >= 1 && e.cd3 <= 0) {
        e.cd3 = 8.5 * fm;
        this.wall("#ff55dd", 175);
      }
      e.cd4 -= et;
      if (ph >= 1 && e.cd4 <= 0) {
        e.cd4 = ph === 2 ? 6.5 : 9;
        this.summon(e, ph === 2 ? "spinner" : "shooter", 2);
      }
      if (ph === 2) {
        e.stT -= et;
        if (e.stT <= 0 && d > 160) {
          e.st = 1;
          e.stT = 0.8;
          e.a = ang;
        }
      }
    } else if (e.st === 1) {
      this.steer(e, 0, 0, 8, et);
      e.stT -= et;
      if (e.stT > 0.25) e.a = ang;
      if (e.stT <= 0) {
        e.st = 2;
        e.stT = 0.65;
        this.fan(e, ang, 9, 1.6, 260, 10, 5);
        this.addShake(7);
      }
    } else {
      this.steer(e, Math.cos(e.a) * 800, Math.sin(e.a) * 800, 14, et);
      e.stT -= et;
      if (e.stT <= 0) {
        e.st = 0;
        e.stT = 4.5;
        e.cd = 0.8;
      }
    }
  }

  private hurtEnemy(e: Enemy, dmg: number, flash = true): boolean {
    if (e.dead || e.spawnT > 0) return false;
    e.hp -= dmg;
    if (flash) e.flash = 0.07;
    if (dmg >= 25 && flash) this.pop(e.x + rand(-8, 8), e.y - e.r, String(Math.round(dmg)), "#ffffff", 12, 0.6);
    if (e.hp <= 0) {
      e.hp = 0;
      this.killEnemy(e);
      return true;
    }
    return false;
  }

  private applySlow(e: Enemy, amt: number) {
    const a = e.boss ? amt * 0.5 : amt;
    e.slow = 2;
    e.slowAmt = Math.max(e.slowAmt, a);
    if (e.burn > 0) this.thermalShock(e);
  }

  private applyBurn(e: Enemy, dps: number) {
    e.burn = 3;
    e.burnDps = Math.max(e.burnDps, dps);
    if (e.slow > 0) this.thermalShock(e);
  }

  private thermalShock(e: Enemy) {
    e.slow = 0;
    e.burn = 0;
    e.slowAmt = 0;
    e.burnDps = 0;
    this.pop(e.x, e.y - e.r - 8, "THERMAL SHOCK", "#ffb347", 14, 1);
    this.addRing(e.x, e.y, 120, 14, "#ffb347");
    this.burst(e.x, e.y, "#ffb347", 14, 300, 0.5);
    audio.play("shock");
    this.hurtEnemy(e, 30 + e.maxHp * 0.04);
  }

  private explode(x: number, y: number, radius: number, dmg: number, skip: Enemy | null) {
    this.addRing(x, y, radius * 1.8, 10, "#ff7a3a");
    this.burst(x, y, "#ff9d3d", 12, 260, 0.45, 3);
    for (const o of this.enemies) {
      if (o.dead || o === skip || o.spawnT > 0) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < radius + o.r) {
        this.hurtEnemy(o, dmg);
        this.knock(o, Math.atan2(o.y - y, o.x - x), 300);
      }
    }
    this.addShake(2);
    audio.play("hit");
  }

  private chainArc(src: Enemy, b: Bullet) {
    const cands = this.enemies
      .filter((o) => !o.dead && o !== src && o.spawnT <= 0 && Math.hypot(o.x - src.x, o.y - src.y) < 190)
      .sort((a, c) => Math.hypot(a.x - src.x, a.y - src.y) - Math.hypot(c.x - src.x, c.y - src.y))
      .slice(0, b.chain);
    let fx = src.x;
    let fy = src.y;
    for (const c of cands) {
      this.arcs.push({ x1: fx, y1: fy, x2: c.x, y2: c.y, life: 0.16 });
      fx = c.x;
      fy = c.y;
      this.hurtEnemy(c, b.dmg * 0.6);
      if (b.slow > 0) this.applySlow(c, b.slow);
      if (b.burn > 0) this.applyBurn(c, b.burn);
    }
  }

  private killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    const def = e.def;
    this.combo++;
    this.comboT = 3.5;
    this.run.maxCombo = Math.max(this.run.maxCombo, this.combo);
    const pts = Math.round(def.score * this.comboMult());
    this.run.score += pts;
    this.run.kills++;
    const big = e.boss || e.r > 20;
    this.burst(e.x, e.y, def.color, e.boss ? 90 : big ? 34 : 16, e.boss ? 700 : 340, e.boss ? 1.4 : 0.7, e.boss ? 4 : 3);
    this.burst(e.x, e.y, "#ffffff", e.boss ? 30 : 5, 260, 0.4, 2);
    this.addRing(e.x, e.y, e.boss ? 900 : big ? 300 : 180, e.boss ? 40 : big ? 22 : 13, def.color, true, e.boss ? 700 : 560);
    this.addShake(e.boss ? 24 : big ? 7 : 2.5);
    this.hitStop = Math.max(this.hitStop, e.boss ? 0.2 : big ? 0.05 : 0.015);
    audio.play(big ? "big" : "kill");
    if (big || this.combo % 5 === 0) this.pop(e.x, e.y - 10, `+${pts}`, def.color, big ? 20 : 13, 1);

    const vamp = this.weapon.vamp;
    if (vamp > 0 && !this.p.dead) this.p.hp = Math.min(this.maxHp(), this.p.hp + vamp);

    // scrap
    const total = Math.round(def.scrap * this.wave.scrapMul);
    const pieces = Math.min(10, Math.max(1, Math.ceil(total / 5)));
    for (let i = 0; i < pieces; i++) {
      const a = Math.random() * TAU;
      const s = rand(60, e.boss ? 400 : 240);
      this.pickups.push({ x: e.x, y: e.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, type: "scrap", val: Math.max(1, Math.round(total / pieces)), life: 14, r: 6 });
    }
    // modifier orbs + health
    if (e.boss) {
      for (let i = 0; i < 3; i++) this.dropOrb(e.x + rand(-40, 40), e.y + rand(-40, 40));
    } else if (e.kind !== "mini") {
      const chance = e.kind === "tank" ? 0.4 : def.cost >= 3 ? 0.14 : 0.06;
      if (Math.random() < chance) this.dropOrb(e.x, e.y);
      else if (this.p.hp < this.maxHp() && Math.random() < 0.05) {
        this.pickups.push({ x: e.x, y: e.y, vx: rand(-60, 60), vy: rand(-60, 60), type: "hp", val: 15, life: 12, r: 9 });
      }
    }
    if (e.kind === "splitter") {
      for (let i = 0; i < 2; i++) {
        const m = this.spawnEnemy("mini", e.x + (i ? 14 : -14), e.y, 0.15);
        m.kx = (i ? 1 : -1) * 200;
      }
    }
    if (e.boss) {
      this.slowT = 1.4;
      this.whiteFlash = 0.7;
      this.clearBullets(true);
      this.wave.queue = [];
      for (const o of this.enemies) {
        if (o !== e && !o.dead) {
          o.dead = true;
          this.burst(o.x, o.y, o.def.color, 14, 300, 0.6);
          this.run.score += o.def.score;
        }
      }
      this.pop(e.x, e.y - e.r - 20, `${def.name} DESTROYED`, def.color, 26, 2.5);
    }
  }

  private dropOrb(x: number, y: number) {
    const table: [BuffKind, number][] = [
      ["overdrive", 3],
      ["quad", 3],
      ["aegis", 2],
      ["slowmo", 2],
      ["phase", 2],
      ["mutation", 3],
      ["nova", 1.5],
      ["magnet", 2],
    ];
    const tot = table.reduce((s, t) => s + t[1], 0);
    let r = Math.random() * tot;
    let kind: BuffKind = "overdrive";
    for (const [k, w] of table) {
      r -= w;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    this.pickups.push({ x, y, vx: rand(-80, 80), vy: rand(-80, 80), type: "orb", val: 0, orb: kind, life: 14, r: 13 });
  }

  private applyOrb(kind: BuffKind) {
    const p = this.p;
    const def = BUFFS[kind];
    audio.play("orb");
    this.pop(p.x, p.y - 30, def.name, def.color, 18, 1.4);
    this.addRing(p.x, p.y, 260, 14, def.color);
    this.burst(p.x, p.y, def.color, 22, 320, 0.6);
    switch (kind) {
      case "overdrive":
        this.buffs.overdrive = def.dur;
        break;
      case "quad":
        this.buffs.quad = def.dur;
        break;
      case "slowmo":
        this.buffs.slowmo = def.dur;
        break;
      case "phase":
        this.buffs.phase = def.dur;
        break;
      case "aegis":
        this.buffs.aegis = def.dur;
        this.shield = 60;
        break;
      case "magnet":
        this.magnetT = 5;
        break;
      case "mutation": {
        const pool = MOD_IDS.filter((id) => !this.run.equipped.includes(id));
        const list = pool.length ? pool : MOD_IDS;
        this.mutId = list[Math.floor(Math.random() * list.length)];
        this.buffs.mutation = def.dur;
        this.pop(p.x, p.y - 52, MODS[this.mutId].name.toUpperCase(), MODS[this.mutId].color, 15, 1.6);
        this.refreshWeapon();
        break;
      }
      case "nova": {
        audio.play("nova");
        this.addRing(p.x, p.y, 1300, 40, "#ffe14f", true, 1100);
        this.whiteFlash = 0.6;
        this.addShake(16);
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          this.hurtEnemy(e, e.boss ? 160 : 90);
          this.knock(e, Math.atan2(e.y - p.y, e.x - p.x), 700);
        }
        for (const b of this.bullets) {
          if (!b.friendly) {
            b.life = 0;
            this.burst(b.x, b.y, b.color, 2, 160, 0.4, 2);
          }
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------- bullets
  private updateBullets(dt: number, edt: number) {
    const p = this.p;
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      const ts = b.friendly ? dt : edt;
      if (b.friendly && b.homing > 0) {
        let best: Enemy | null = null;
        let bd = 520;
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (best) {
          const cur = Math.atan2(b.vy, b.vx);
          const want = Math.atan2(best.y - b.y, best.x - b.x);
          let diff = want - cur;
          while (diff > Math.PI) diff -= TAU;
          while (diff < -Math.PI) diff += TAU;
          const turn = clamp(diff, -b.homing * ts, b.homing * ts);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(cur + turn) * sp;
          b.vy = Math.sin(cur + turn) * sp;
        }
      }
      b.x += b.vx * ts;
      b.y += b.vy * ts;
      b.life -= ts;
      // walls
      let hitWall = false;
      if (b.x < M) {
        b.x = M;
        b.vx = Math.abs(b.vx);
        hitWall = true;
      } else if (b.x > W - M) {
        b.x = W - M;
        b.vx = -Math.abs(b.vx);
        hitWall = true;
      }
      if (b.y < M) {
        b.y = M;
        b.vy = Math.abs(b.vy);
        hitWall = true;
      } else if (b.y > H - M) {
        b.y = H - M;
        b.vy = -Math.abs(b.vy);
        hitWall = true;
      }
      if (hitWall) {
        if (b.bounce > 0) {
          b.bounce--;
          this.burst(b.x, b.y, b.color, 3, 120, 0.25, 2);
        } else {
          b.life = 0;
          this.burst(b.x, b.y, b.color, 3, 100, 0.25, 2);
          continue;
        }
      }

      if (b.friendly) {
        for (const e of this.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (b.hit.includes(e)) continue;
          const rr = e.r + b.r;
          const ddx = e.x - b.x;
          const ddy = e.y - b.y;
          if (ddx * ddx + ddy * ddy > rr * rr) continue;
          // hit
          const dmg = b.dmg;
          this.hurtEnemy(e, dmg);
          this.knock(e, Math.atan2(b.vy, b.vx), b.refl ? 420 : 120);
          this.burst(b.x, b.y, b.color, 3, 160, 0.25, 2);
          if (!b.refl) audio.play("hit");
          else {
            audio.play("hit");
            this.addShake(3);
          }
          if (b.slow > 0 && !e.dead) this.applySlow(e, b.slow);
          if (b.burn > 0 && !e.dead) this.applyBurn(e, b.burn);
          if (b.explode > 0) this.explode(b.x, b.y, b.explode, b.dmg * 0.55, e);
          if (b.chain > 0) this.chainArc(e, b);
          if (b.pierce > 0) {
            b.pierce--;
            b.hit.push(e);
          } else {
            b.life = 0;
            break;
          }
        }
      } else if (!p.dead && p.dashT <= 0 && p.iframes <= 0) {
        const rr = p.r * 0.75 + b.r;
        const ddx = p.x - b.x;
        const ddy = p.y - b.y;
        if (ddx * ddx + ddy * ddy < rr * rr) {
          this.hurtPlayer(b.dmg);
          b.life = 0;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.life > 0);
  }

  // ---------------------------------------------------------------- pickups
  private updatePickups(dt: number) {
    const p = this.p;
    const magR = this.magnetR();
    for (const pk of this.pickups) {
      pk.life -= dt;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy) || 1;
      const damp = Math.exp(-3 * dt);
      pk.vx *= damp;
      pk.vy *= damp;
      let pull = false;
      if (!p.dead) {
        if (pk.type === "scrap") pull = this.magnetT > 0 || d < magR;
        else if (pk.type === "orb") pull = d < 90;
        else pull = d < 70;
      }
      if (pull) {
        const a = pk.type === "scrap" ? 2600 : 900;
        pk.vx += (dx / d) * a * dt;
        pk.vy += (dy / d) * a * dt;
        const s = Math.hypot(pk.vx, pk.vy);
        const mx = pk.type === "scrap" ? 1000 : 500;
        if (s > mx) {
          pk.vx = (pk.vx / s) * mx;
          pk.vy = (pk.vy / s) * mx;
        }
      }
      pk.x = clamp(pk.x + pk.vx * dt, M + 4, W - M - 4);
      pk.y = clamp(pk.y + pk.vy * dt, M + 4, H - M - 4);
      if (!p.dead && d < pk.r + p.r + 4) {
        pk.life = 0;
        if (pk.type === "scrap") {
          this.run.scrap += pk.val;
          this.run.score += pk.val;
          this.scrapAcc += pk.val;
          audio.play("pickup", 1 + Math.min(0.6, this.scrapAcc * 0.004));
          this.particles.push({ x: pk.x, y: pk.y, vx: 0, vy: -40, life: 0.3, max: 0.3, size: 4, color: "#ffe14f", drag: 0.9 });
        } else if (pk.type === "hp") {
          p.hp = Math.min(this.maxHp(), p.hp + pk.val);
          this.pop(p.x, p.y - 24, `+${pk.val} HULL`, "#ff6b8a", 14);
          audio.play("orb");
        } else if (pk.orb) this.applyOrb(pk.orb);
      }
    }
    this.scrapAcc *= Math.exp(-2 * dt);
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  // ---------------------------------------------------------------- rendering
  private glow(color: string): HTMLCanvasElement {
    let c = this.glowCache.get(color);
    if (c) return c;
    c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, hexA(color, 1));
    grad.addColorStop(0.25, hexA(color, 0.55));
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    this.glowCache.set(color, c);
    return c;
  }

  private drawGlow(x: number, y: number, size: number, color: string, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(this.glow(color), x - size, y - size, size * 2, size * 2);
    this.ctx.globalAlpha = 1;
  }

  private warp(x: number, y: number, out: { x: number; y: number }) {
    let ox = 0;
    let oy = 0;
    for (const s of this.rings) {
      const dx = x - s.x;
      const dy = y - s.y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const diff = d - s.r;
      if (diff > -80 && diff < 80) {
        const f = Math.cos((diff / 80) * (Math.PI / 2)) * s.str * (1 - s.r / s.max);
        ox += (dx / d) * f;
        oy += (dy / d) * f;
      }
    }
    out.x = x + ox;
    out.y = y + oy;
  }

  private drawGrid() {
    const ctx = this.ctx;
    const boss = this.mode === "playing" && this.wave.bossKind && !this.wave.cleared;
    const pulse = Math.exp(-Math.max(0, (audio.ctx ? audio.ctx.currentTime : 0) - audio.lastKick) * 7);
    const base = boss ? "#ff3355" : "#22e8ff";
    const major = boss ? "#ff7a3a" : "#ff2bd6";
    const pt = { x: 0, y: 0 };
    const cell = 40;
    const seg = 20;
    for (let pass = 0; pass < 2; pass++) {
      ctx.beginPath();
      for (let gx = 0; gx <= (W - 2 * M) / cell; gx++) {
        if ((gx % 4 === 0) !== (pass === 1)) continue;
        const x = M + gx * cell;
        for (let y = M; y <= H - M; y += seg) {
          this.warp(x, y, pt);
          if (y === M) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
      }
      for (let gy = 0; gy <= (H - 2 * M) / cell; gy++) {
        if ((gy % 4 === 0) !== (pass === 1)) continue;
        const y = M + gy * cell;
        for (let x = M; x <= W - M; x += seg) {
          this.warp(x, y, pt);
          if (x === M) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.strokeStyle = pass === 0 ? hexA(base, 0.1 + 0.09 * pulse) : hexA(major, 0.2 + 0.15 * pulse);
      ctx.lineWidth = pass === 0 ? 1 : 1.5;
      ctx.stroke();
    }
    // border
    const bc = boss ? "#ff3355" : "#ff2bd6";
    ctx.lineJoin = "round";
    ctx.strokeStyle = hexA(bc, 0.12 + 0.1 * pulse);
    ctx.lineWidth = 14;
    ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
    ctx.strokeStyle = hexA(bc, 0.35);
    ctx.lineWidth = 5;
    ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(M, M, W - 2 * M, H - 2 * M);
    ctx.globalAlpha = 1;
  }

  private polyPath(x: number, y: number, r: number, n: number, rot: number) {
    const ctx = this.ctx;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i * TAU) / n;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  private strokeNeon(color: string, lw: number, fillA = 0.14, flash = false) {
    const ctx = this.ctx;
    ctx.fillStyle = flash ? "rgba(255,255,255,0.9)" : hexA(color, fillA);
    ctx.fill();
    ctx.strokeStyle = hexA(color, 0.28);
    ctx.lineWidth = lw * 3;
    ctx.stroke();
    ctx.strokeStyle = flash ? "#ffffff" : color;
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  private drawEnemy(e: Enemy) {
    const ctx = this.ctx;
    const c = e.def.color;
    if (e.spawnT > 0) {
      const tot = e.boss ? 1.8 : 0.8;
      const f = clamp(e.spawnT / tot, 0, 1);
      ctx.strokeStyle = hexA(c, 0.9 - f * 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * (1 + f * 2.5), 0, TAU);
      ctx.stroke();
      this.polyPath(e.x, e.y, e.r * (0.4 + (1 - f) * 0.6), 4, e.spawnT * 6);
      ctx.strokeStyle = hexA(c, 0.8);
      ctx.stroke();
      this.drawGlow(e.x, e.y, e.r * 2.5, c, 0.4 * (1 - f));
      return;
    }
    const p = this.p;
    const toP = Math.atan2(p.y - e.y, p.x - e.x);
    const fl = e.flash > 0;
    this.drawGlow(e.x, e.y, e.r * 2.6, c, e.boss ? 0.5 : 0.32);
    ctx.lineJoin = "round";
    switch (e.kind) {
      case "drone":
        this.polyPath(e.x, e.y, e.r, 4, toP);
        this.strokeNeon(c, 2, 0.16, fl);
        break;
      case "mini":
        this.polyPath(e.x, e.y, e.r, 3, toP);
        this.strokeNeon(c, 1.6, 0.16, fl);
        break;
      case "shooter":
        this.polyPath(e.x, e.y, e.r, 6, e.age);
        this.strokeNeon(c, 2, 0.16, fl);
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(toP) * (e.r + 7), e.y + Math.sin(toP) * (e.r + 7));
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        break;
      case "lancer": {
        const a = e.st === 0 || e.st === 3 ? toP : e.a;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * e.r * 1.6, e.y + Math.sin(a) * e.r * 1.6);
        ctx.lineTo(e.x + Math.cos(a + 2.5) * e.r * 1.1, e.y + Math.sin(a + 2.5) * e.r * 1.1);
        ctx.lineTo(e.x + Math.cos(a + Math.PI) * e.r * 0.3, e.y + Math.sin(a + Math.PI) * e.r * 0.3);
        ctx.lineTo(e.x + Math.cos(a - 2.5) * e.r * 1.1, e.y + Math.sin(a - 2.5) * e.r * 1.1);
        ctx.closePath();
        this.strokeNeon(c, 2, e.st === 2 ? 0.6 : 0.16, fl);
        if (e.st === 1) {
          const blink = Math.floor(e.stT * 18) % 2 === 0;
          ctx.strokeStyle = hexA("#ffffff", blink ? 0.9 : 0.35);
          ctx.lineWidth = 2;
          ctx.setLineDash([10, 8]);
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(e.a) * 900, e.y + Math.sin(e.a) * 900);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "spinner": {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = e.age * 2 * (e.dir || 1) + (i * TAU) / 6;
          const r = i % 2 === 0 ? e.r * 1.25 : e.r * 0.55;
          const px = e.x + Math.cos(a) * r;
          const py = e.y + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        this.strokeNeon(c, 2, 0.2, fl);
        break;
      }
      case "splitter":
        this.polyPath(e.x, e.y, e.r * 1.1, 4, e.age * 0.8 + Math.PI / 4);
        this.strokeNeon(c, 2, 0.14, fl);
        this.polyPath(e.x, e.y, e.r * 0.7, 4, -e.age * 0.8);
        this.strokeNeon(c, 1.5, 0.3, fl);
        break;
      case "sniper": {
        this.polyPath(e.x, e.y, e.r, 4, Math.PI / 4);
        this.strokeNeon(c, 2, 0.18, fl);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.4, 0, TAU);
        ctx.fillStyle = "#fff";
        ctx.fill();
        if (e.st === 1) {
          const frozen = e.stT <= 0.3;
          ctx.strokeStyle = hexA(frozen ? "#ffffff" : "#ff3b3b", frozen ? 0.95 : 0.55);
          ctx.lineWidth = frozen ? 2.5 : 1.2;
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(e.a) * 1600, e.y + Math.sin(e.a) * 1600);
          ctx.stroke();
        }
        break;
      }
      case "tank":
        this.polyPath(e.x, e.y, e.r, 8, e.age * 0.3);
        this.strokeNeon(c, 3, 0.16, fl);
        this.polyPath(e.x, e.y, e.r * 0.6, 8, -e.age * 0.5);
        this.strokeNeon(c, 2, 0.35, fl);
        break;
      case "warden": {
        this.polyPath(e.x, e.y, e.r, 6, e.age * 0.4);
        this.strokeNeon(c, 4, 0.14, fl);
        this.polyPath(e.x, e.y, e.r * 0.62, 6, -e.age * 0.8);
        this.strokeNeon(c, 3, 0.3, fl);
        for (let i = 0; i < 6; i++) {
          const a = e.age * 1.2 + (i * TAU) / 6;
          this.drawGlow(e.x + Math.cos(a) * e.r * 1.35, e.y + Math.sin(a) * e.r * 1.35, 12, c, 0.9);
        }
        break;
      }
      case "hydra": {
        this.polyPath(e.x, e.y, e.r * 0.8, 5, e.age * 0.5);
        this.strokeNeon(c, 4, 0.2, fl);
        for (let i = 0; i < 3; i++) {
          const a = e.age * (e.st === 1 ? 0.5 : 1.3) + (i * TAU) / 3;
          const hx = e.x + Math.cos(a) * e.r * 0.95;
          const hy = e.y + Math.sin(a) * e.r * 0.95;
          ctx.beginPath();
          ctx.arc(hx, hy, e.r * 0.36, 0, TAU);
          this.strokeNeon(c, 3, 0.3, fl);
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(hx, hy);
          ctx.strokeStyle = hexA(c, 0.5);
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        if (e.st === 1) {
          const blink = Math.floor(e.stT * 18) % 2 === 0;
          ctx.strokeStyle = hexA("#ffffff", blink ? 0.9 : 0.3);
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 10]);
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(e.a) * 1600, e.y + Math.sin(e.a) * 1600);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
      case "overmind": {
        this.polyPath(e.x, e.y, e.r, 8, e.age * 0.25);
        this.strokeNeon(c, 4, 0.12, fl);
        this.polyPath(e.x, e.y, e.r * 0.7, 8, -e.age * 0.6);
        this.strokeNeon(c, 3, 0.25, fl);
        const pu = 0.7 + Math.sin(e.age * 4) * 0.3;
        this.drawGlow(e.x, e.y, e.r * 0.7 * pu, "#ffffff", 0.9);
        for (let i = 0; i < 4; i++) {
          const a = e.age * 0.9 + (i * TAU) / 4;
          this.polyPath(e.x + Math.cos(a) * e.r * 1.4, e.y + Math.sin(a) * e.r * 1.4, 10, 3, a * 2);
          this.strokeNeon("#ff55dd", 2, 0.4, false);
        }
        if (e.st === 1) {
          const blink = Math.floor(e.stT * 18) % 2 === 0;
          ctx.strokeStyle = hexA("#ffffff", blink ? 0.9 : 0.3);
          ctx.lineWidth = 3;
          ctx.setLineDash([14, 10]);
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x + Math.cos(e.a) * 1600, e.y + Math.sin(e.a) * 1600);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        break;
      }
    }
    if (e.slow > 0) {
      ctx.strokeStyle = "rgba(143,232,255,0.7)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r + 5, 0, TAU);
      ctx.stroke();
    }
    if (!e.boss && e.hp < e.maxHp) {
      const w = Math.max(24, e.r * 2);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(e.x - w / 2, e.y + e.r + 8, w, 3);
      ctx.fillStyle = c;
      ctx.fillRect(e.x - w / 2, e.y + e.r + 8, (w * e.hp) / e.maxHp, 3);
    }
  }

  private drawPlayer() {
    const ctx = this.ctx;
    const p = this.p;
    if (p.dead) return;
    const w = this.weapon;
    // dash trail
    for (const t of p.trail) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(Math.atan2(p.dashDy, p.dashDx));
      ctx.globalAlpha = t.a * 0.5;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-11, -10);
      ctx.lineTo(-5, 0);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fillStyle = "#22e8ff";
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // reflect field
    if (p.reflectT > 0) {
      const f = clamp(p.reflectT / 0.43, 0, 1);
      const r = w.reflectRadius;
      this.polyPath(p.x, p.y, r, 6, this.time * 4);
      ctx.strokeStyle = hexA("#ffffff", 0.25 + f * 0.6);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = hexA("#22e8ff", 0.06 + f * 0.1);
      ctx.fill();
    }
    if (this.shield > 0) {
      ctx.strokeStyle = hexA("#7af0ff", 0.4 + 0.3 * Math.sin(this.time * 8));
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = hexA("#7af0ff", 0.08);
      ctx.fill();
    }
    const blink = p.iframes > 0 && p.dashT <= 0 && Math.floor(this.time * 20) % 2 === 0;
    this.drawGlow(p.x, p.y, 34, "#22e8ff", blink ? 0.2 : 0.5);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.globalAlpha = blink ? 0.4 : 1;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(17, 0);
    ctx.lineTo(-11, -11);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-11, 11);
    ctx.closePath();
    this.strokeNeon("#22e8ff", 2.2, 0.25, false);
    ctx.beginPath();
    ctx.arc(14, 0, 2.6, 0, TAU);
    ctx.fillStyle = this.buffs.quad > 0 ? "#ffb347" : w.color;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private drawBullets() {
    const ctx = this.ctx;
    ctx.lineCap = "round";
    for (const b of this.bullets) {
      if (b.life <= 0) continue;
      if (b.friendly) {
        ctx.strokeStyle = hexA(b.color, 0.55);
        ctx.lineWidth = b.r * 1.5;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.028, b.y - b.vy * 0.028);
        ctx.stroke();
        this.drawGlow(b.x, b.y, b.r * 4, b.color, 0.75);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.65, 0, TAU);
        ctx.fill();
      } else {
        this.drawGlow(b.x, b.y, b.r * 3.8, b.color, 0.85);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU);
        ctx.fill();
      }
    }
    ctx.lineCap = "butt";
  }

  private drawPickups() {
    const ctx = this.ctx;
    for (const pk of this.pickups) {
      const blink = pk.life < 3 && Math.floor(this.time * 10) % 2 === 0;
      if (blink) continue;
      if (pk.type === "scrap") {
        this.drawGlow(pk.x, pk.y, 12, "#ffe14f", 0.6);
        this.polyPath(pk.x, pk.y, 5, 4, this.time * 3 + pk.x);
        ctx.fillStyle = "#ffe14f";
        ctx.fill();
      } else if (pk.type === "hp") {
        this.drawGlow(pk.x, pk.y, 22, "#ff3b6e", 0.7);
        ctx.fillStyle = "#fff";
        ctx.fillRect(pk.x - 6, pk.y - 2, 12, 4);
        ctx.fillRect(pk.x - 2, pk.y - 6, 4, 12);
      } else if (pk.orb) {
        const def = BUFFS[pk.orb];
        const pulse = 1 + Math.sin(this.time * 6) * 0.15;
        this.drawGlow(pk.x, pk.y, 38 * pulse, def.color, 0.75);
        ctx.beginPath();
        ctx.arc(pk.x, pk.y, 13, 0, TAU);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fill();
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        this.polyPath(pk.x, pk.y, 19, 6, this.time * 2);
        ctx.strokeStyle = hexA(def.color, 0.5);
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private txt(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left", alpha = 1) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.font = `700 ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(s, x, y);
    ctx.globalAlpha = 1;
  }

  private render() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.bg, 0, 0);
    ctx.save();
    if (this.shake > 0) ctx.translate(rand(-1, 1) * this.shake, rand(-1, 1) * this.shake);
    ctx.globalCompositeOperation = "lighter";
    this.drawGrid();

    const playing = this.mode === "playing" || this.mode === "paused";
    if (playing) {
      this.drawPickups();
      for (const e of this.enemies) if (!e.dead) this.drawEnemy(e);
      this.drawBullets();
      this.drawPlayer();
    }
    // particles
    for (const pt of this.particles) {
      const a = clamp(pt.life / pt.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      const s = pt.size * (0.4 + a * 0.6);
      ctx.fillRect(pt.x - s / 2, pt.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
    // rings
    for (const r of this.rings) {
      if (!r.vis) continue;
      const a = 1 - r.r / r.max;
      ctx.strokeStyle = hexA(r.color, 0.7 * a);
      ctx.lineWidth = 2 + 4 * a;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, TAU);
      ctx.stroke();
    }
    // arcs (lightning)
    for (const a of this.arcs) {
      ctx.strokeStyle = hexA("#b9a6ff", 0.9);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x1, a.y1);
      const segs = 6;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        ctx.lineTo(a.x1 + (a.x2 - a.x1) * t + rand(-8, 8), a.y1 + (a.y2 - a.y1) * t + rand(-8, 8));
      }
      ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    // floating texts
    for (const t of this.texts) this.txt(t.text, t.x, t.y, t.size, t.color, "center", clamp(t.life / (t.max * 0.5), 0, 1));
    ctx.restore();

    if (this.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,30,70,${this.hurtFlash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (this.whiteFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.whiteFlash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    if (playing) {
      const low = this.p.hp / this.maxHp() < 0.3 && !this.p.dead;
      if (low) {
        const a = 0.15 + 0.12 * Math.sin(this.time * 7);
        const g = ctx.createRadialGradient(W / 2, H / 2, 300, W / 2, H / 2, 800);
        g.addColorStop(0, "rgba(255,0,40,0)");
        g.addColorStop(1, `rgba(255,0,40,${a * 2})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      this.drawHud();
      this.drawCrosshair();
    }
    // scanline vignette
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  }

  private drawCrosshair() {
    if (this.p.dead) return;
    const ctx = this.ctx;
    const x = this.aimX;
    const y = this.aimY;
    const c = this.weapon.color;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    for (const [a, b] of [
      [-18, -7],
      [7, 18],
    ]) {
      ctx.moveTo(x + a, y);
      ctx.lineTo(x + b, y);
      ctx.moveTo(x, y + a);
      ctx.lineTo(x, y + b);
    }
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - 1, y - 1, 2, 2);
  }

  private drawHud() {
    const ctx = this.ctx;
    const p = this.p;
    const run = this.run;
    const w = this.wave;
    const maxHp = this.maxHp();

    // hull
    this.txt("HULL", 40, 40, 12, "#9fb4d6");
    const hx = 40;
    const hy = 52;
    const hw = 240;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(hx - 2, hy - 2, hw + 4, 18);
    const ratio = clamp(p.hp / maxHp, 0, 1);
    const hc = ratio > 0.5 ? "#22e8ff" : ratio > 0.25 ? "#ffd23d" : "#ff3355";
    ctx.fillStyle = hc;
    ctx.fillRect(hx, hy, hw * ratio, 14);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 1; i < maxHp / 25; i++) ctx.fillRect(hx + (hw * i * 25) / maxHp - 1, hy, 2, 14);
    if (this.shield > 0) {
      ctx.strokeStyle = "#7af0ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(hx - 2, hy - 2, hw + 4, 18);
      ctx.fillStyle = "rgba(122,240,255,0.6)";
      ctx.fillRect(hx, hy + 14, clamp(this.shield / 60, 0, 1) * hw, 3);
    }
    this.txt(`${Math.ceil(p.hp)}/${maxHp}`, hx + hw + 10, hy + 7, 12, "#cfe4ff");

    // dash pips
    this.txt("DASH", 40, 86, 12, "#9fb4d6");
    const mc = this.maxCharges();
    for (let i = 0; i < mc; i++) {
      const cx = 52 + i * 28;
      const cy = 106;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#22e8ff";
      ctx.beginPath();
      ctx.arc(cx, cy, 9, 0, TAU);
      ctx.stroke();
      if (i < p.charges || this.buffs.phase > 0) {
        ctx.fillStyle = this.buffs.phase > 0 ? "#fff" : "#22e8ff";
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, TAU);
        ctx.fill();
      } else if (i === p.charges) {
        const f = 1 - clamp(p.chargeTimer / this.dashCd(), 0, 1);
        ctx.fillStyle = "rgba(34,232,255,0.6)";
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 6, -Math.PI / 2, -Math.PI / 2 + f * TAU);
        ctx.closePath();
        ctx.fill();
      }
    }

    // buffs
    let by = 138;
    const entries: [string, number, number, string][] = [];
    (Object.keys(this.buffs) as BuffKey[]).forEach((k) => {
      const v = this.buffs[k];
      if (v > 0) entries.push([BUFFS[k].name, v, BUFFS[k].dur, BUFFS[k].color]);
    });
    if (this.mutId && this.buffs.mutation > 0) entries.push([`↳ ${MODS[this.mutId].name}`, -1, 1, MODS[this.mutId].color]);
    for (const [name, v, dur, col] of entries) {
      if (v >= 0) {
        this.txt(name, 40, by, 11, col);
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(40, by + 9, 130, 3);
        ctx.fillStyle = col;
        ctx.fillRect(40, by + 9, 130 * clamp(v / dur, 0, 1), 3);
        by += 26;
      } else {
        this.txt(name, 40, by, 10, col, "left", 0.8);
        by += 18;
      }
    }

    // wave title
    const isBoss = !!w.bossKind;
    this.txt(`WAVE ${w.n}`, W / 2, 44, 22, isBoss ? "#ff5577" : "#ffffff", "center");
    if (!isBoss || !w.bossSpawned) {
      const left = this.enemies.filter((e) => !e.dead && e.kind !== "mini").length + w.queue.length;
      this.txt(w.cleared ? "CLEARED" : `${left} HOSTILE${left === 1 ? "" : "S"}`, W / 2, 68, 12, "#9fb4d6", "center");
    }
    if (w.mod && !w.cleared) this.txt(`⚠ ${w.mod.name}`, W / 2, 88, 11, w.mod.color, "center");

    // boss bar
    const boss = this.enemies.find((e) => e.boss && !e.dead);
    if (boss) {
      const bw = 560;
      const bx = W / 2 - bw / 2;
      const byy = 106;
      this.txt(boss.def.name, W / 2, byy - 4, 13, boss.def.color, "center");
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx - 2, byy + 6, bw + 4, 14);
      const f = clamp(boss.hp / boss.maxHp, 0, 1);
      ctx.fillStyle = boss.spawnT > 0 ? "#555" : boss.def.color;
      ctx.fillRect(bx, byy + 8, bw * (boss.spawnT > 0 ? 1 : f), 10);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      for (const t of boss.kind === "hydra" || boss.kind === "warden" ? [0.66, 0.33] : [0.6, 0.25]) ctx.fillRect(bx + bw * t - 1, byy + 8, 2, 10);
    }

    // score / combo
    this.txt(String(run.score).padStart(7, "0"), W - 40, 42, 26, "#ffffff", "right");
    this.txt(`BEST ${Math.max(this.best, run.score)}`, W - 40, 66, 11, "#9fb4d6", "right");
    if (this.combo >= 2) {
      const cm = this.comboMult();
      this.txt(`×${cm.toFixed(1)}`, W - 40, 98, 26, cm >= 4 ? "#ff5cf0" : "#ffe14f", "right");
      this.txt(`${this.combo} CHAIN`, W - 40, 122, 11, "#9fb4d6", "right");
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.fillRect(W - 40 - 110, 132, 110, 3);
      ctx.fillStyle = "#ffe14f";
      ctx.fillRect(W - 40 - 110 * clamp(this.comboT / 3.5, 0, 1), 132, 110 * clamp(this.comboT / 3.5, 0, 1), 3);
    }

    // bottom-left: scrap + weapon
    this.txt(`◆ ${run.scrap}`, 40, H - 92, 18, "#ffe14f");
    this.txt(CORES[run.core].name.toUpperCase(), 40, H - 66, 13, this.weapon.color);
    const eq = run.equipped;
    const slotsN = this.slots();
    for (let i = 0; i < slotsN; i++) {
      const sx = 40 + i * 38;
      const sy = H - 54;
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(sx, sy, 32, 26);
      const id = eq[i];
      if (id) {
        ctx.fillStyle = hexA(MODS[id].color, 0.2);
        ctx.fillRect(sx, sy, 32, 26);
        this.txt(MODS[id].icon, sx + 16, sy + 14, 16, MODS[id].color, "center");
        this.txt(`L${run.owned[id] || 1}`, sx + 29, sy + 22, 8, "#fff", "right", 0.8);
      }
    }
    this.txt("DASH-REFLECT: bullets inside your dash field are turned against enemies", W / 2, H - 38, 10, "#7d8fb3", "center", w.n <= 2 ? 0.9 : 0);

    // banners
    if (w.bannerT > 0) {
      const t = w.bannerT;
      const a = clamp(Math.min(t, 3 - t + 0.2, 1), 0, 1);
      const sl = (1 - a) * 40;
      this.txt(isBoss ? `WAVE ${w.n}` : `WAVE ${w.n}`, W / 2 - sl, H / 2 - 70, 54, isBoss ? "#ff3355" : "#22e8ff", "center", a);
      if (isBoss) this.txt(`BOSS: ${ENEMIES[w.bossKind!].name}`, W / 2 + sl, H / 2 - 20, 26, "#ffffff", "center", a);
      else if (w.mod) {
        this.txt(w.mod.name, W / 2 + sl, H / 2 - 20, 28, w.mod.color, "center", a);
        this.txt(w.mod.desc, W / 2 + sl, H / 2 + 14, 14, "#cfe4ff", "center", a);
      } else this.txt("ENGAGE", W / 2 + sl, H / 2 - 20, 22, "#ffffff", "center", a);
    }
    if (w.cleared && !p.dead) {
      const a = clamp(w.clearT > 2 ? (2.6 - w.clearT) * 2 : Math.min(1, w.clearT), 0, 1);
      this.txt("WAVE CLEARED", W / 2, H / 2 - 40, 48, "#7dff4f", "center", a);
    }
    if (p.dead) this.txt("HULL BREACH", W / 2, H / 2, 54, "#ff3355", "center", clamp(1.8 - this.deathT, 0, 1));
  }
}
