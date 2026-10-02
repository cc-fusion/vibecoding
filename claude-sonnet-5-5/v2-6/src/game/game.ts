import {
  TOOLS, TECHS, TECH_BY_ID, TRIBES, DIFFS, MODS, ERAS,
  type ToolId, type Settlement, type Tribe, type Volcano, type Tsunami, type Particle, type FloatText, type Prayer,
  type Sanct, type Ring, type Titan, type LogEntry, type Stats, type RunConfig, type EndResult, type SaveData, type PendingEvent,
} from './data';
import { AudioEngine } from './audio';
import { W, H, N, mod, wrapDX, mulberry32, generateWorld, settlementName, type Plate } from './world';
import { quake, spawnVolcano, updateVolcanoes, updateTsunamis, updateEvents, naturalHazards, updateTitan, spawnTitan } from './disasters';
import { renderGame } from './render';

export const BIOME = { DEEP: 0, OCEAN: 1, SHALLOW: 2, BEACH: 3, PLAINS: 4, FOREST: 5, DESERT: 6, HILLS: 7, MOUNTAIN: 8, SNOW: 9, TUNDRA: 10 };
export const BIOME_NAMES = ['Abyss', 'Ocean', 'Shallows', 'Beach', 'Plains', 'Forest', 'Desert', 'Hills', 'Mountains', 'Glacier', 'Tundra'];

export interface GLink { a: Settlement; b: Settlement; ta: number; tb: number; sea: boolean; d: number; crowd: number; }
export type Overlay = 0 | 1 | 2 | 3;
export const OVERLAY_NAMES = ['Terrain', 'Plates', 'Fault Stress', 'Fertility'];

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  audio = new AudioEngine();
  meta!: SaveData;
  onEnd: (r: EndResult) => void = () => {};
  onAutoPause: () => void = () => {};

  state: 'attract' | 'playing' | 'ended' = 'attract';
  paused = false;
  speed = 1;
  cfg: RunConfig = { diff: 'standard', mods: [], tutorial: false };
  diffId = 'standard';
  modSet = new Set<string>();
  endless = false;
  result: EndResult | null = null;

  // layout
  cw = 800; ch = 600; dpr = 1;
  insets = { top: 56, right: 0, bottom: 0, left: 64 };
  cs = 8; mx0 = 0; my0 = 0;

  // world arrays
  h = new Float32Array(N); cnt = new Uint8Array(N); top = new Int8Array(N); maxH = new Float32Array(N);
  stress = new Float32Array(N); oro = new Float32Array(N); extra = new Float32Array(N); ash = new Float32Array(N);
  bless = new Float32Array(N); lavaT = new Float32Array(N); flood = new Float32Array(N);
  biome = new Uint8Array(N); fert = new Float32Array(N); dw = new Float32Array(N); moist = new Float32Array(N);
  queue = new Int32Array(N);
  plates: Plate[] = [];
  sea = 0; seaTarget = 0; seaBase = 0; tempOff = 0; glacialT = 0; droughtT = 0;

  // entities
  settlements: Settlement[] = []; tribes: Tribe[] = []; volcanoes: Volcano[] = []; tsunamis: Tsunami[] = [];
  particles: Particle[] = []; floats: FloatText[] = []; prayers: Prayer[] = []; sanctuaries: Sanct[] = []; rings: Ring[] = [];
  pending: PendingEvent[] = []; links: GLink[] = []; titan: Titan | null = null;
  loads: { x: number; y: number; t: number }[] = [];
  log: LogEntry[] = [];
  nextId = 1;

  // player
  energy = 100; favor = 30;
  tool: ToolId = 'drag'; tideLower = false; overlay: Overlay = 0;
  cd: Record<string, number> = {};
  cdMax: Record<string, number> = {};
  drag: { p: Plate; px: number; py: number; ox: number; oy: number; tx: number; ty: number } | null = null;
  mouse: { px: number; py: number; mx: number; my: number; inside: boolean } = { px: 0, py: 0, mx: 0, my: 0, inside: false };
  hoverPlate = -1;
  impulse = 0; moveSpeed = 0;
  energyFlash = 0;

  // sim state
  t = 0; eraTime = 0; era = 0; eventT = 40; quakeCd = 0; ecoAcc = 0; dipAcc = 0; climAcc = 0;
  shake = 0; tension = 0; banner: { text: string; sub: string; t: number } | null = null;
  stats!: Stats;
  warnings: { text: string; t: number }[] = [];
  tut = { active: false, step: 0 };
  tutPanelOpen = false; tutFocusSet = false; tutTremor = false;
  tutShield = false;
  endTimer = 0;
  rnd: () => number = Math.random;
  nTrade: number[] = [0, 0, 0, 0, 0];
  growthAcc = 0;

  // internal
  private raf = 0; private last = 0; private ro: ResizeObserver | null = null; private destroyed = false;
  time = 0;
  terr: HTMLCanvasElement; terrCtx: CanvasRenderingContext2D; terrImg: ImageData; terrAcc = 99;
  stars: { x: number; y: number; s: number; a: number }[] = [];

  constructor(canvas: HTMLCanvasElement, meta: SaveData) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.meta = meta;
    this.terr = document.createElement('canvas');
    this.terr.width = W * 3; this.terr.height = H * 3;
    this.terrCtx = this.terr.getContext('2d')!;
    this.terrImg = this.terrCtx.createImageData(W * 3, H * 3);
    for (let i = 0; i < 140; i++) this.stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.5 + 0.4, a: Math.random() });
    this.resetStats();
    this.newWorld(Math.floor(Math.random() * 1e6), true);
    this.audio.vol = { master: meta.settings.master, music: meta.settings.music, sfx: meta.settings.sfx };
    this.audio.muted = meta.settings.muted;
    this.audio.sfxOff = true;

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('contextmenu', this.onCtx);
    document.addEventListener('visibilitychange', this.onVis);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('pointerleave', this.onLeave);
    c.removeEventListener('contextmenu', this.onCtx);
    document.removeEventListener('visibilitychange', this.onVis);
    this.audio.dispose();
  }

  get diff() { return DIFFS.find((d) => d.id === this.diffId) || DIFFS[1]; }
  upg(id: string) { return this.meta.upgrades[id] || 0; }
  hasMod(id: string) { return this.modSet.has(id); }
  maxEnergy() { return (100 + this.upg('sinews') * 15) * (this.hasMod('frugal') ? 0.7 : 1); }

  resetStats() {
    this.stats = { time: 0, peakPop: 0, deaths: 0, quakes: 0, maxMag: 0, eruptions: 0, tsunamis: 0, wars: 0, techs: 0, founded: 0, lost: 0, prayers: 0, dist: 0, titanDmg: 0, tribesAlive: 5 };
  }

  // ---------- helpers ----------
  idx(x: number, y: number) { return Math.max(0, Math.min(H - 1, Math.floor(y))) * W + mod(Math.floor(x), W); }
  dist(ax: number, ay: number, bx: number, by: number) { const dx = wrapDX(ax, bx), dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  addLog(text: string, kind: LogEntry['kind'] = 'info') {
    this.log.unshift({ t: this.t, text, kind }); if (this.log.length > 60) this.log.pop();
  }
  floatText(x: number, y: number, text: string, color = '#fff', size = 1) {
    if (this.floats.length > 80) this.floats.shift();
    this.floats.push({ x, y, text, color, life: 1.6, max: 1.6, size });
  }
  burst(x: number, y: number, n: number, color: string, speed = 3, life = 0.9, add = false, g = 0, size = 0.25) {
    for (let i = 0; i < n; i++) {
      if (this.particles.length > 1600) break;
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.9);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.7), max: life, size: size * (0.5 + Math.random()), color, g, add });
    }
  }
  ring(x: number, y: number, max: number, color: string, life = 1, w = 0.25) {
    this.rings.push({ x, y, r: 0.5, max, color, life, maxLife: life, w });
  }
  banner_(text: string, sub = '') { this.banner = { text, sub, t: 4.2 }; }
  warn(text: string, t = 6) { this.warnings.push({ text, t }); if (this.warnings.length > 4) this.warnings.shift(); this.audio.sfx('warn'); }
  shielded(x: number, y: number) { for (const s of this.sanctuaries) if (this.dist(x, y, s.x, s.y) < s.r) return true; return false; }
  nearestSettlement(x: number, y: number, maxD = 99) {
    let best: Settlement | null = null, bd = maxD;
    for (const s of this.settlements) { const d = this.dist(x, y, s.x, s.y); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  tribeHas(t: number, tech: string) { return !!this.tribes[t]?.techs[tech]; }

  // ---------- layout / input ----------
  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cw = Math.max(200, r.width); this.ch = Math.max(200, r.height);
    this.canvas.width = Math.floor(this.cw * this.dpr); this.canvas.height = Math.floor(this.ch * this.dpr);
    this.layout();
  }
  layout() {
    const i = this.insets;
    const aw = Math.max(100, this.cw - i.left - i.right), ah = Math.max(100, this.ch - i.top - i.bottom);
    this.cs = Math.min(aw / W, ah / H);
    this.mx0 = i.left + (aw - W * this.cs) / 2; this.my0 = i.top + (ah - H * this.cs) / 2;
  }
  setInsets(i: { top: number; right: number; bottom: number; left: number }) { this.insets = i; this.layout(); }
  private toMap(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const mx = (px - this.mx0) / this.cs, my = (py - this.my0) / this.cs;
    return { px, py, mx, my, inside: mx >= 0 && my >= 0 && mx < W && my < H };
  }
  private onCtx = (e: Event) => e.preventDefault();
  private onVis = () => {
    if (document.hidden) { this.audio.suspend(); if (this.state === 'playing' && !this.paused) { this.paused = true; this.onAutoPause(); } }
    else { this.audio.resume(); this.last = performance.now(); }
  };
  private onLeave = () => { this.mouse.inside = false; };
  private onDown = (e: PointerEvent) => {
    this.audio.init();
    const m = this.toMap(e); this.mouse = m;
    if (this.state !== 'playing' || this.paused) return;
    if (!m.inside) return;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const pr = this.prayerAt(m.mx, m.my);
    if (pr) { this.collectPrayer(pr); return; }
    const alt = e.button === 2;
    if (this.tool === 'drag') {
      if (alt) return;
      const i = this.idx(m.mx, m.my); const pid = this.top[i];
      if (pid < 0) { this.floatText(m.mx, m.my, 'Open rift', '#ffb070'); this.audio.sfx('error'); return; }
      const p = this.plates[pid];
      this.drag = { p, px: m.px, py: m.py, ox: p.ox, oy: p.oy, tx: p.ox, ty: p.oy };
      this.audio.sfx('click');
    } else this.useTool(this.tool, m.mx, m.my, alt);
  };
  private onMove = (e: PointerEvent) => {
    const m = this.toMap(e); this.mouse = m;
    if (this.drag) {
      this.drag.tx = this.drag.ox + (m.px - this.drag.px) / this.cs;
      this.drag.ty = this.drag.oy + (m.py - this.drag.py) / this.cs;
    }
  };
  private onUp = (e: PointerEvent) => {
    this.drag = null;
    try { this.canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  prayerAt(mx: number, my: number) {
    let best: Prayer | null = null, bd = 1.5;
    for (const p of this.prayers) {
      const s = this.settlements.find((q) => q.id === p.sid); if (!s) continue;
      const d = this.dist(mx, my, s.rx + 0.5, s.ry - 1.6);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  collectPrayer(p: Prayer) {
    const s = this.settlements.find((q) => q.id === p.sid);
    this.prayers = this.prayers.filter((q) => q !== p);
    if (!s) return;
    const lvl = s.pop < 15 ? 1 : s.pop < 40 ? 2 : s.pop < 80 ? 3 : 4;
    let gain = (3 + lvl) * (1 + this.upg('flock') * 0.2) * (this.hasMod('frugal') ? 0.6 : 1);
    gain = Math.round(gain);
    this.favor = Math.min(100, this.favor + gain);
    this.tribes[s.tribe].devotion = Math.min(100, this.tribes[s.tribe].devotion + 2);
    this.stats.prayers++;
    this.floatText(s.x, s.y - 2.4, `+${gain} favor`, '#ffe9a0', 1.1);
    this.burst(s.x, s.y - 1.8, 12, '#ffe9a0', 3, 0.8, true);
    this.audio.sfx('prayer');
  }

  // ---------- public controls ----------
  setTool(t: ToolId) {
    const def = TOOLS.find((d) => d.id === t)!;
    if (def.unlock > 0 && !this.meta.unlocked.includes(t)) { this.floatText(this.mouse.mx, this.mouse.my, 'Locked – unlock in the Sanctum', '#ff9a9a'); this.audio.sfx('error'); return; }
    if (t === 'tide' && this.tool === 'tide') this.tideLower = !this.tideLower;
    this.tool = t; this.drag = null; this.audio.sfx('click');
  }
  setOverlay(o: Overlay) { this.overlay = o; this.terrAcc = 99; this.audio.sfx('click'); }
  cycleOverlay() { this.setOverlay(((this.overlay + 1) % 4) as Overlay); }
  setPaused(p: boolean) { this.paused = p; this.drag = null; if (p) this.audio.setRumble(0); }
  setSpeed(s: number) { this.speed = s; }
  setMeta(m: SaveData) {
    this.meta = m;
    this.audio.vol = { master: m.settings.master, music: m.settings.music, sfx: m.settings.sfx };
    this.audio.muted = m.settings.muted; this.audio.apply();
  }
  setDifficulty(id: string, mods: string[]) { this.diffId = id; this.modSet = new Set(mods); }
  selectResearch(tribe: number, tech: string | null) {
    const t = this.tribes[tribe]; if (!t || !t.alive) return;
    t.focus = tech; if (tech) { this.tutFocusSet = true; this.audio.sfx('select'); }
    this.chooseTech(t);
  }
  finishTutorial() { this.tut = { active: false, step: 0 }; this.tutShield = false; this.eventT = Math.min(this.eventT, 35); }

  // ---------- world setup ----------
  newWorld(seed: number, attract: boolean) {
    const g = generateWorld(seed);
    this.plates = g.plates;
    this.moist.set(g.moist);
    this.stress.fill(0); this.oro.fill(0); this.extra.fill(0); this.ash.fill(0); this.bless.fill(0); this.lavaT.fill(0); this.flood.fill(0);
    this.sea = 0; this.seaTarget = 0; this.seaBase = 0; this.tempOff = 0; this.glacialT = 0; this.droughtT = 0;
    this.settlements = []; this.volcanoes = []; this.tsunamis = []; this.particles = []; this.floats = []; this.prayers = [];
    this.sanctuaries = []; this.rings = []; this.pending = []; this.links = []; this.titan = null; this.log = []; this.warnings = []; this.loads = [];
    this.compose(); this.climate();
    this.rnd = mulberry32(seed ^ 0x9e3779b9);
    this.tribes = TRIBES.map((d) => ({
      id: d.id, alive: true, knowledge: 0, techs: {}, focus: null, current: null, devotion: 60,
      rel: [0, 0, 0, 0, 0], war: [false, false, false, false, false], contact: [false, false, false, false, false], trade: [false, false, false, false, false],
      pop: 0, nset: 0, rate: 0, danger: { quake: 0, flood: 0, lava: 0, war: 0, dry: 0 }, lost: 0, peakPop: 0,
    }));
    for (const t of this.tribes) {
      for (const id of TRIBES[t.id].start) t.techs[id] = true;
      if (this.upg('seed') && !attract) t.techs['agri'] = true;
      for (let b = 0; b < 5; b++) if (b > t.id) {
        const r = 8 + Math.random() * 22 - (t.id === 3 || b === 3 ? 22 : 0);
        t.rel[b] = r; this.tribes[b].rel[t.id] = r;
      }
    }
    this.placeTribes();
    for (const t of this.tribes) this.chooseTech(t);
  }

  placeTribes() {
    const cands: number[] = [];
    for (let k = 0; k < 900; k++) {
      const i = Math.floor(Math.random() * N); const e = this.h[i] - this.sea;
      if (this.top[i] >= 0 && e > 0.05 && e < 0.4 && this.fert[i] >= 0.75 && this.dw[i] <= 8) cands.push(i);
    }
    if (cands.length < 5) for (let i = 0; i < N && cands.length < 60; i += 7) if (this.h[i] > this.sea + 0.05 && this.fert[i] > 0.2) cands.push(i);
    const chosen: number[] = [];
    for (let t = 0; t < 5; t++) {
      let best = -1, bs = -1;
      const tries = t === 0 ? 1 : 260;
      for (let k = 0; k < tries; k++) {
        const i = cands[Math.floor(Math.random() * cands.length)];
        const x = i % W, y = (i / W) | 0;
        let md = 999, samePlate = false;
        for (const c of chosen) { md = Math.min(md, this.dist(x, y, c % W, (c / W) | 0)); if (this.top[c] === this.top[i]) samePlate = true; }
        const sc = md + (samePlate ? 0 : 16) + Math.random() * 4;
        if (sc > bs) { bs = sc; best = i; }
      }
      chosen.push(best);
      this.foundAt(t, best % W, (best / W) | 0, 12);
    }
  }

  foundAt(tribe: number, x: number, y: number, pop: number): Settlement | null {
    const i = this.idx(x, y); const pid = this.top[i]; if (pid < 0) return null;
    const p = this.plates[pid];
    const s: Settlement = {
      id: this.nextId++, tribe, plate: pid,
      lx: wrapDX(Math.floor(x), p.sx + Math.round(p.ox)), ly: Math.floor(y) - (p.sy + Math.round(p.oy)),
      x: Math.floor(x), y: Math.floor(y), rx: Math.floor(x), ry: Math.floor(y), pop, K: 30, name: settlementName(this.rnd),
      expandCd: 10 + Math.random() * 8, hit: 0, prayCd: 6 + Math.random() * 14, bad: 0, born: this.t,
    };
    this.settlements.push(s); this.stats.founded++;
    return s;
  }

  start(cfg: RunConfig) {
    this.cfg = cfg; this.diffId = cfg.diff; this.modSet = new Set(cfg.mods);
    this.resetStats(); this.nextId = 1; this.endless = false; this.result = null;
    this.t = 0; this.eraTime = 0; this.era = 0; this.eventT = cfg.tutorial ? 9999 : 42; this.quakeCd = 8;
    this.ecoAcc = 0; this.dipAcc = 0; this.shake = 0; this.tension = 0; this.banner = null; this.endTimer = 0;
    this.energy = this.maxEnergy(); this.favor = 30; this.tool = 'drag'; this.overlay = 0; this.tideLower = false;
    this.cd = {}; this.cdMax = {}; this.drag = null; this.paused = false; this.speed = 1;
    this.tutPanelOpen = false; this.tutFocusSet = false; this.tutTremor = false;
    this.tut = { active: cfg.tutorial, step: 0 }; this.tutShield = cfg.tutorial;
    this.newWorld(cfg.seed ?? Math.floor(Math.random() * 1e6), false);
    for (const t of this.tribes) this.chooseTech(t);
    this.state = 'playing'; this.terrAcc = 99; this.audio.sfxOff = false;
    this.addLog('The crust stirs. Five tribes look to the Shepherd.', 'era');
    this.banner_(ERAS[0].name, ERAS[0].blurb);
    this.audio.sfx('era');
  }
  toAttract() {
    this.state = 'attract'; this.paused = false; this.drag = null; this.audio.setRumble(0); this.era = 0; this.tension = 0; this.audio.sfxOff = true;
    this.diffId = 'gentle'; this.modSet = new Set(); this.tut = { active: false, step: 0 }; this.tutShield = true;
    this.newWorld(Math.floor(Math.random() * 1e6), true);
  }
  continueEndless() {
    this.state = 'playing'; this.endless = true; this.result = null; this.paused = false; this.titan = null;
    this.eventT = 20; this.addLog('The Eternal Age begins. The world is yours.', 'era');
  }

  // ---------- plates / terrain ----------
  compose() {
    const { cnt, maxH, top, h, oro, extra, plates } = this;
    cnt.fill(0); maxH.fill(-9); top.fill(-1);
    for (const p of plates) {
      const bx = p.sx + Math.round(p.ox), by = p.sy + Math.round(p.oy);
      for (let k = 0; k < p.n; k++) {
        const y = by + p.ly[k]; if (y < 0 || y >= H) continue;
        const i = y * W + mod(bx + p.lx[k], W);
        cnt[i]++;
        if (p.h[k] > maxH[i]) { maxH[i] = p.h[k]; top[i] = p.id; }
      }
    }
    for (let i = 0; i < N; i++) h[i] = (cnt[i] ? maxH[i] : -0.85) + oro[i] + extra[i];
    for (const s of this.settlements) {
      const p = this.plates[s.plate];
      s.x = mod(p.sx + Math.round(p.ox) + s.lx, W); s.y = p.sy + Math.round(p.oy) + s.ly;
    }
  }

  movePlate(p: Plate, ddx: number, ddy: number) {
    const nx = p.ox + ddx;
    const ny = Math.max(p.minOy, Math.min(p.maxOy, p.oy + ddy));
    const d = Math.hypot(nx - p.ox, ny - p.oy);
    if (d < 1e-5) return 0;
    const cost = d * (0.25 + p.n / 1500) * (1 - this.upg('light') * 0.08);
    let f = 1;
    if (cost > this.energy) {
      f = Math.max(0, this.energy / cost);
      if (f < 0.02) { if (this.energyFlash < 0.2) this.audio.sfx('limit'); this.energyFlash = 1; return 0; }
    }
    p.ox += (nx - p.ox) * f; p.oy += (ny - p.oy) * f;
    this.energy -= cost * f;
    return d * f;
  }

  climate() {
    const { h, dw, biome, fert, sea, queue } = this;
    let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) { if (h[i] < sea) { dw[i] = 0; queue[qt++] = i; } else dw[i] = 99; }
    while (qh < qt) {
      const i = queue[qh++]; const d = dw[i] + 1; if (d > 24) continue;
      const x = i % W, y = (i / W) | 0;
      let j = y * W + mod(x + 1, W); if (dw[j] > d) { dw[j] = d; queue[qt++] = j; }
      j = y * W + mod(x - 1, W); if (dw[j] > d) { dw[j] = d; queue[qt++] = j; }
      if (y > 0) { j = i - W; if (dw[j] > d) { dw[j] = d; queue[qt++] = j; } }
      if (y < H - 1) { j = i + W; if (dw[j] > d) { dw[j] = d; queue[qt++] = j; } }
    }
    for (let y = 0; y < H; y++) {
      const lat = Math.abs(y / (H - 1) - 0.5) * 2;
      for (let x = 0; x < W; x++) {
        const i = y * W + x; const e = h[i] - sea;
        let b: number, f = 0;
        if (e < 0) b = e < -0.55 ? BIOME.DEEP : e < -0.2 ? BIOME.OCEAN : BIOME.SHALLOW;
        else {
          const T = 1 - lat * 0.85 - Math.max(0, e) * 0.55 + this.tempOff;
          let shadow = 0;
          for (let k = 1; k <= 6; k++) if (h[y * W + mod(x - k, W)] > sea + 0.5) { shadow = 1; break; }
          const m = Math.min(1, Math.max(0, 1 - dw[i] / 16)) * 0.75 + this.moist[i] * 0.35 - shadow * 0.3;
          if (e < 0.035) { b = BIOME.BEACH; f = 0.35; }
          else if (e > 0.72 || T < 0.1) { b = BIOME.SNOW; f = 0; }
          else if (e > 0.52) { b = T < 0.25 ? BIOME.SNOW : BIOME.MOUNTAIN; f = b === BIOME.SNOW ? 0 : 0.06; }
          else if (e > 0.36) { b = BIOME.HILLS; f = 0.45; }
          else if (T < 0.3) { b = BIOME.TUNDRA; f = 0.2; }
          else if (m < 0.3 && T > 0.45) { b = BIOME.DESERT; f = 0.1; }
          else if (m > 0.58) { b = BIOME.FOREST; f = 0.85; }
          else { b = BIOME.PLAINS; f = 0.6 + 0.4 * Math.min(1, m * 1.4); }
          f += this.ash[i] * 0.5 + this.bless[i] * 0.5;
          if (this.droughtT > 0 && dw[i] > 2) f *= 0.65;
          if (this.lavaT[i] > 0) f = 0;
        }
        biome[i] = b; fert[i] = f;
      }
    }
  }

  // ---------- tribes ----------
  crossMax(t: number) { return this.tribeHas(t, 'navigation') ? 14 : this.tribeHas(t, 'seafaring') ? 7 : 1; }
  waterCross(ax: number, ay: number, bx: number, by: number) {
    const dx = wrapDX(bx, ax), dy = by - ay; const n = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    let c = 0;
    for (let k = 1; k < n; k++) { const i = this.idx(ax + (dx * k) / n, ay + (dy * k) / n); if (this.h[i] < this.sea) c++; }
    return c;
  }
  capacity(s: Settlement) {
    const t = this.tribes[s.tribe];
    const irr = t.techs['irrigation'], mas = t.techs['masonry'], sea = t.techs['seafaring'], vol = t.techs['volcanology'];
    let sum = 0;
    const cx = Math.floor(s.x), cy = Math.floor(s.y);
    for (let dy = -3; dy <= 3; dy++) {
      const y = cy + dy; if (y < 0 || y >= H) continue;
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy > 10) continue;
        const i = y * W + mod(cx + dx, W); const b = this.biome[i];
        if (b <= BIOME.SHALLOW) { if (sea) sum += 0.25; continue; }
        let f = this.fert[i];
        if (irr && (b === BIOME.DESERT || b === BIOME.TUNDRA)) f += 0.4;
        if (mas && (b === BIOME.HILLS || b === BIOME.MOUNTAIN)) f += 0.12;
        if (vol) f += this.ash[i] * 0.5;
        sum += f;
      }
    }
    let mult = 1 + (t.techs['agri'] ? 0.25 : 0) + (t.techs['works'] ? 0.1 : 0) + Math.min(3, this.nTrade[s.tribe]) * 0.06 + (s.tribe === 0 ? 0.12 : 0);
    if (this.glacialT > 0) mult *= 0.9;
    let K = 5 + sum * 2.1 * mult;
    if (sea && this.dw[this.idx(s.x, s.y)] <= 1.5) K += 5;
    return K;
  }
  level(s: Settlement) { return s.pop < 15 ? 1 : s.pop < 40 ? 2 : s.pop < 80 ? 3 : 4; }

  hurt(s: Settlement, loss: number, cause: 'quake' | 'flood' | 'lava' | 'war' | 'dry') {
    if (loss <= 0 || s.pop <= 0) return;
    loss = Math.min(loss, s.pop);
    s.pop -= loss; s.hit = 1;
    const t = this.tribes[s.tribe];
    this.stats.deaths += loss; t.lost += loss; t.danger[cause] += loss;
    t.devotion = Math.max(0, t.devotion - loss * 0.05);
    if (loss >= 1) this.floatText(s.x, s.y - 1.2, `-${Math.round(loss)}`, '#ff6b6b');
    if (loss >= 3) this.audio.sfx('death');
    if (s.pop < 0.8) this.destroySettlement(s, cause);
  }
  destroySettlement(s: Settlement, cause: string) {
    s.pop = 0;
    this.settlements = this.settlements.filter((q) => q !== s);
    this.prayers = this.prayers.filter((p) => p.sid !== s.id);
    this.stats.lost++;
    const t = this.tribes[s.tribe];
    const verbs: Record<string, string> = { quake: 'crumbled in a quake', flood: 'was swallowed by the sea', lava: 'was buried in lava', war: 'fell to raiders', dry: 'was abandoned', buried: 'was crushed under the crust' };
    this.addLog(`${s.name} (${TRIBES[s.tribe].name}) ${verbs[cause] || 'was lost'}.`, 'bad');
    this.burst(s.x, s.y, 20, '#c9a37a', 4, 1);
    this.ring(s.x, s.y, 4, '#ff8a6a', 0.8);
    if (!this.settlements.some((q) => q.tribe === s.tribe) && t.alive) {
      t.alive = false;
      this.addLog(`The ${TRIBES[s.tribe].name} have perished.`, 'bad');
      this.banner_(`${TRIBES[s.tribe].name} are no more`, 'A people lost to the shifting earth');
      this.audio.sfx('defeat');
      for (const o of this.tribes) { o.war[s.tribe] = false; o.contact[s.tribe] = false; o.trade[s.tribe] = false; }
    }
  }

  chooseTech(t: Tribe) {
    if (!t.alive) return;
    const avail = TECHS.filter((d) => !t.techs[d.id] && d.req.every((r) => t.techs[r]));
    if (t.focus && t.techs[t.focus]) t.focus = null;
    if (t.focus && avail.some((d) => d.id === t.focus)) { t.current = t.focus; return; }
    if (!avail.length) { t.current = null; return; }
    const pref = TRIBES[t.id].pref;
    let best = avail[0], bw = -1;
    for (const d of avail) {
      let w = (pref[d.id] || 0) + Math.random() * 0.8 - d.tier * 0.2;
      const dg = t.danger;
      if (d.id === 'masonry' || d.id === 'seismo') w += Math.min(3, dg.quake / 25);
      if (d.id === 'levees') w += Math.min(3, dg.flood / 15);
      if (d.id === 'volcanology') w += Math.min(3, dg.lava / 15);
      if (d.id === 'bronze' || d.id === 'iron') w += Math.min(3, dg.war / 15);
      if (d.id === 'irrigation') w += Math.min(2, dg.dry / 10);
      if (w > bw) { bw = w; best = d; }
    }
    t.current = best.id;
  }

  // ---------- diplomacy ----------
  computeLinks() {
    const best = new Map<number, GLink>();
    const ss = this.settlements;
    for (const t of this.tribes) { t.contact.fill(false); }
    for (let i = 0; i < ss.length; i++) for (let j = i + 1; j < ss.length; j++) {
      const a = ss[i], b = ss[j]; if (a.tribe === b.tribe) continue;
      const d = this.dist(a.x, a.y, b.x, b.y);
      const range = 11 + Math.max(this.tribeHas(a.tribe, 'seafaring') ? 3 : 0, this.tribeHas(b.tribe, 'seafaring') ? 3 : 0)
        + Math.max(this.tribeHas(a.tribe, 'navigation') ? 5 : 0, this.tribeHas(b.tribe, 'navigation') ? 5 : 0);
      if (d > range) continue;
      const cross = this.waterCross(a.x, a.y, b.x, b.y);
      if (cross > Math.max(this.crossMax(a.tribe), this.crossMax(b.tribe))) continue;
      const lo = Math.min(a.tribe, b.tribe), hi = Math.max(a.tribe, b.tribe), key = lo * 5 + hi;
      const crowd = a.pop > a.K * 0.85 && b.pop > b.K * 0.85 && d < 9 ? 1 : 0;
      const cur = best.get(key);
      if (!cur || d < cur.d) best.set(key, { a, b, ta: a.tribe, tb: b.tribe, sea: cross > 0, d, crowd });
      else if (crowd) cur.crowd = 1;
    }
    this.links = Array.from(best.values());
    for (const l of this.links) { this.tribes[l.ta].contact[l.tb] = true; this.tribes[l.tb].contact[l.ta] = true; }
  }

  diplomacy() {
    this.computeLinks();
    const warlike = this.hasMod('warlike');
    this.nTrade = [0, 0, 0, 0, 0];
    for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) {
      const ta = this.tribes[a], tb = this.tribes[b];
      if (!ta.alive || !tb.alive) continue;
      const link = this.links.find((l) => Math.min(l.ta, l.tb) === a && Math.max(l.ta, l.tb) === b);
      if (!link) {
        ta.rel[b] -= ta.rel[b] * 0.05; tb.rel[a] = ta.rel[b];
        if (ta.war[b]) { ta.war[b] = tb.war[a] = false; this.addLog(`${TRIBES[a].name} and ${TRIBES[b].name} drift apart; the war ends.`, 'good'); }
        ta.trade[b] = tb.trade[a] = false; continue;
      }
      const law = (ta.techs['law'] ? 1 : 0) + (tb.techs['law'] ? 1 : 0);
      let delta: number;
      if (ta.war[b]) delta = 1.6 + law * 1.0 + (warlike ? -0.5 : 0);
      else {
        const friendly = 1.7 + law * 0.8 + (a === 4 || b === 4 ? 0.7 : 0);
        const tension = link.crowd * 2.6 + (a === 3 || b === 3 ? 1.5 : 0) + (warlike ? 1.9 : 0);
        delta = friendly - tension + (Math.random() - 0.5) * 3.2;
      }
      const rel = Math.max(-100, Math.min(100, ta.rel[b] + delta));
      ta.rel[b] = rel; tb.rel[a] = rel;
      if (!ta.war[b] && rel < -55 && (law === 0 || Math.random() < 0.5)) {
        ta.war[b] = tb.war[a] = true; this.stats.wars++;
        this.addLog(`WAR! ${TRIBES[a].name} and ${TRIBES[b].name} take up arms.`, 'war');
        this.warn(`${TRIBES[a].name} vs ${TRIBES[b].name}: war!`);
        this.audio.sfx('war');
        this.floatText((link.a.x + link.b.x) / 2, (link.a.y + link.b.y) / 2, '⚔ WAR', '#ff6a4d', 1.4);
      } else if (ta.war[b] && rel > -18) {
        ta.war[b] = tb.war[a] = false; this.addLog(`${TRIBES[a].name} and ${TRIBES[b].name} sign a truce.`, 'good');
      }
      const trade = !ta.war[b] && rel > 25;
      ta.trade[b] = tb.trade[a] = trade;
      if (trade) { this.nTrade[a]++; this.nTrade[b]++; }
      if (rel > 70 && !ta.war[b]) { ta.knowledge += 0.6; tb.knowledge += 0.6; }
      if (ta.war[b]) this.skirmish(link, ta, tb);
    }
  }
  military(t: Tribe) {
    let pop = 0; for (const s of this.settlements) if (s.tribe === t.id) pop += s.pop;
    return pop * (1 + (t.techs['bronze'] ? 0.3 : 0) + (t.techs['iron'] ? 0.5 : 0) + (t.id === 3 ? 0.3 : 0));
  }
  skirmish(l: GLink, ta: Tribe, tb: Tribe) {
    const ma = this.military(ta), mb = this.military(tb);
    const ratio = ma / Math.max(1, ma + mb);
    const aWins = Math.random() < ratio;
    const win = aWins ? l.a : l.b, lose = aWins ? l.b : l.a;
    const wr = aWins ? ratio : 1 - ratio;
    if (this.shielded(lose.x, lose.y)) { this.floatText(lose.x, lose.y - 1, 'Sanctuary!', '#9be7ff'); return; }
    this.hurt(lose, lose.pop * (0.07 + Math.abs(wr - 0.5) * 0.12), 'war');
    this.hurt(win, win.pop * 0.015, 'war');
    this.burst(lose.x, lose.y, 10, '#ff5a3a', 3, 0.7, true);
    this.audio.sfx('war');
    if (lose.pop > 0 && lose.pop < 10 && wr > 0.58 && Math.random() < 0.45) {
      this.addLog(`${TRIBES[win.tribe].name} capture ${lose.name}!`, 'war');
      lose.tribe = win.tribe; this.floatText(lose.x, lose.y - 1.4, 'CAPTURED', TRIBES[win.tribe].color, 1.2);
    }
    for (const t of [ta, tb]) t.danger.war += 3;
  }

  // ---------- main update ----------
  loop = (ts: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, Math.max(0, (ts - this.last) / 1000)); this.last = ts;
    this.time = ts / 1000;
    const running = this.state === 'attract' || (this.state === 'playing' && !this.paused);
    if (running) this.update(dt * (this.state === 'attract' ? 1 : this.speed));
    else this.updateFx(dt);
    this.audio.music(dt, this.state === 'playing' ? this.tension : 0.05, this.state === 'playing' ? this.era : 0, this.state === 'playing' && !this.paused);
    renderGame(this, dt);
  };

  updateFx(dt: number) {
    for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.life -= dt; }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) { f.life -= dt; f.y -= dt * 1.2; }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const r of this.rings) { r.life -= dt; r.r = r.max * (1 - r.life / r.maxLife); }
    this.rings = this.rings.filter((r) => r.life > 0);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    this.energyFlash = Math.max(0, this.energyFlash - dt * 2);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    this.warnings = this.warnings.filter((w) => (w.t -= dt) > 0);
  }

  update(dt: number) {
    const attract = this.state === 'attract';
    this.t += dt; this.stats.time += dt; this.eraTime += dt;
    this.updateFx(dt);
    for (const k of Object.keys(this.cd)) this.cd[k] = Math.max(0, this.cd[k] - dt);
    // energy
    const regen = 5 * this.diff.regen * (1 + this.upg('springs') * 0.1);
    this.energy = Math.min(this.maxEnergy(), this.energy + regen * dt);
    // plates: drag + drift
    this.impulse = 0;
    let moved = 0;
    if (this.drag) {
      const p = this.drag.p; const vx = this.drag.tx - p.ox, vy = this.drag.ty - p.oy;
      const L = Math.hypot(vx, vy); const maxStep = 15 * dt;
      if (L > 0.001) {
        const k = Math.min(1, maxStep / L);
        moved = this.movePlate(p, vx * k, vy * k);
      }
      this.stats.dist += moved;
    }
    const drift = this.hasMod('restless') ? 2 : 1;
    for (const p of this.plates) {
      if (this.drag && this.drag.p === p) continue;
      const nx = p.ox + p.dx * drift * dt; let ny = p.oy + p.dy * drift * dt;
      if (ny < p.minOy || ny > p.maxOy) { p.dy = -p.dy; ny = Math.max(p.minOy, Math.min(p.maxOy, ny)); }
      p.ox = nx; p.oy = ny;
    }
    this.impulse = moved + 0.0;
    this.moveSpeed += ((moved / Math.max(dt, 1e-4)) / 15 - this.moveSpeed) * Math.min(1, dt * 8);
    this.audio.setRumble(this.drag ? Math.min(1, this.moveSpeed * 1.2 + 0.1) : 0);
    this.shake = Math.max(this.shake, this.drag ? Math.min(0.12, this.moveSpeed * 0.1) : 0);

    this.compose();
    this.tectonics(dt);
    // sea
    this.seaTarget += (this.seaBase - this.seaTarget) * Math.min(1, 0.004 * dt);
    if (this.hasMod('tides')) this.seaBase = Math.min(0.28, this.seaBase + 0.0007 * dt);
    this.sea += Math.max(-0.012 * dt, Math.min(0.012 * dt, this.seaTarget - this.sea));
    if (this.glacialT > 0) { this.glacialT -= dt; if (this.glacialT <= 0) { this.tempOff = 0; this.addLog('The glaciers retreat.', 'info'); } }
    if (this.droughtT > 0) { this.droughtT -= dt; if (this.droughtT <= 0) this.addLog('Rains return; the drought ends.', 'good'); }

    updateVolcanoes(this, dt);
    updateTsunamis(this, dt);
    if (!attract) { updateEvents(this, dt); updateTitan(this, dt); }
    for (const s of this.sanctuaries) s.t -= dt;
    this.sanctuaries = this.sanctuaries.filter((s) => s.t > 0);
    for (const s of this.settlements) { s.hit = Math.max(0, s.hit - dt * 2); }
    for (const p of this.prayers) p.t += dt;
    this.prayers = this.prayers.filter((p) => { if (p.t < p.ttl) return true; const s = this.settlements.find((q) => q.id === p.sid); if (s) this.tribes[s.tribe].devotion = Math.max(0, this.tribes[s.tribe].devotion - 0.5); return false; });

    this.climAcc += dt;
    if (this.climAcc > 0.25) { this.climAcc = 0; this.climate(); }
    this.ecoAcc += dt;
    while (this.ecoAcc >= 0.5) { this.ecoAcc -= 0.5; this.ecoTick(0.5); }
    this.dipAcc += dt;
    while (this.dipAcc >= 2) { this.dipAcc -= 2; this.diplomacy(); }
    if (!attract) this.updateTutorial();
    // tension
    let ms = 0; for (let i = 0; i < N; i += 3) if (this.stress[i] > ms) ms = this.stress[i];
    const wars = this.tribes.reduce((n, t) => n + t.war.filter(Boolean).length, 0) / 2;
    const tt = 0.35 * Math.min(1, Math.max(0, (ms - 50) / 50)) + 0.12 * Math.min(2, wars) + (this.volcanoes.some((v) => v.state === 'erupting') ? 0.2 : 0)
      + (this.tsunamis.length ? 0.2 : 0) + (this.titan && !this.titan.dead ? 0.45 : 0) + this.shake * 0.3;
    this.tension += (Math.min(1, tt) - this.tension) * Math.min(1, dt * 0.8);
    if (!attract) {
      this.endTimer += dt;
      if (this.tribes.every((t) => !t.alive)) this.finish(false, 'Every tribe has perished beneath the shifting earth.');
    }
  }

  tectonics(dt: number) {
    const { cnt, stress, oro, extra, ash, bless, flood, lavaT } = this;
    const sm = (this.hasMod('restless') ? 1.6 : 1) * (this.diff.freq > 1 ? 1.15 : this.diff.freq < 1 ? 0.8 : 1);
    const imp = this.impulse * 1.6;
    const cap = this.tutShield ? 90 : 140;
    const extraDecay = 1 - 0.0015 * dt, ashDecay = 0.004 * dt, blDecay = dt / 60;
    for (let i = 0; i < N; i++) {
      const c = cnt[i];
      if (c >= 2) {
        oro[i] = Math.min(1.1, oro[i] + 0.035 * dt * (1 + (c - 2) * 0.5));
        stress[i] += 1.1 * sm * dt + imp;
      } else {
        if (oro[i] > 0) oro[i] = Math.max(0, oro[i] - 0.006 * dt);
        if (c === 0) stress[i] += 0.45 * sm * dt + imp;
      }
      let s = stress[i];
      if (s > 0) { s -= 0.12 * dt; if (s < 0) s = 0; if (s > cap) s = cap; stress[i] = s; }
      if (extra[i] !== 0) extra[i] *= extraDecay;
      if (ash[i] > 0) ash[i] = Math.max(0, ash[i] - ashDecay);
      if (bless[i] > 0) bless[i] = Math.max(0, bless[i] - blDecay);
      if (flood[i] > 0) flood[i] -= dt;
      if (lavaT[i] > 0) { lavaT[i] -= dt; if (lavaT[i] <= 0) { lavaT[i] = 0; extra[i] += 0.06; ash[i] = 1; } }
    }
  }

  ecoTick(dt: number) {
    const ss = this.settlements;
    for (const t of this.tribes) { t.pop = 0; t.nset = 0; }
    for (const s of ss.slice()) {
      if (s.pop <= 0) continue;
      const i = this.idx(s.x, s.y);
      const t = this.tribes[s.tribe];
      s.K = this.capacity(s);
      // hazards on the cell
      const e = this.h[i] - this.sea;
      const protectedS = this.shielded(s.x, s.y);
      let bad = false;
      if (this.top[i] !== s.plate) bad = true; // buried under another plate
      else if (e < -0.005) bad = true; // drowned
      else if (this.lavaT[i] > 0) {
        const lm = (t.techs['volcanology'] ? 0.4 : 1) * (s.tribe === 3 ? 0.5 : 1) * (1 - this.upg('foundations') * 0.1) * this.diff.dmg;
        if (!protectedS) { this.hurt(s, s.pop * 0.35 * lm + 0.4, 'lava'); bad = true; }
      }
      if (bad && !protectedS && s.pop > 0) {
        s.bad += dt;
        const lm = (t.techs['levees'] ? 0.5 : 1) * (s.tribe === 1 ? 0.7 : 1);
        if (this.top[i] === s.plate && e < -0.005) this.hurt(s, s.pop * 0.12 * lm * this.diff.dmg + 0.3, 'flood');
        else if (this.top[i] !== s.plate) this.hurt(s, s.pop * 0.15 * this.diff.dmg + 0.3, 'quake');
        if (s.pop > 0 && s.bad >= 1) this.flee(s);
      } else s.bad = 0;
      if (s.pop <= 0) continue;
      // growth
      const dev = t.devotion;
      const r = 0.07 * (0.7 + dev / 200);
      let dp = r * s.pop * (1 - s.pop / s.K) * dt;
      dp = Math.max(dp, -0.1 * s.pop * dt * 2);
      s.pop = Math.max(0.5, s.pop + dp);
      if (s.pop > 1 && s.K < 8 && s.pop > s.K * 1.6) this.hurt(s, s.pop * 0.03, 'dry');
      // prayers
      s.prayCd -= dt * (0.5 + dev / 100);
      if (s.prayCd <= 0) {
        s.prayCd = 20 + Math.random() * 22;
        if (this.prayers.length < 10 && !this.prayers.some((p) => p.sid === s.id)) this.prayers.push({ id: this.nextId++, sid: s.id, t: 0, ttl: 16 });
      }
      // expansion
      s.expandCd -= dt;
      if (s.expandCd <= 0 && s.pop > Math.max(18, s.K * 0.75)) { s.expandCd = 14 + Math.random() * 8; this.expand(s); }
      t.pop += s.pop; t.nset++;
    }
    let total = 0;
    for (const t of this.tribes) {
      if (!t.alive) continue;
      total += t.pop; t.peakPop = Math.max(t.peakPop, t.pop);
      // devotion drift
      const target = 60 + (t.techs['works'] ? 10 : 0) - (t.war.some(Boolean) ? 15 : 0);
      t.devotion += (target - t.devotion) * 0.02 * dt * (t.techs['works'] ? 1.4 : 1);
      for (const k of Object.keys(t.danger) as (keyof Tribe['danger'])[]) t.danger[k] *= 1 - 0.004 * dt;
      // research
      const tr = this.nTrade[t.id];
      t.rate = t.pop * 0.006 * (1 + (t.techs['writing'] ? 0.3 : 0) + this.upg('elders') * 0.1 + (t.id === 4 ? 0.2 : 0) + tr * (t.techs['navigation'] ? 0.18 : 0.1)) * (0.8 + t.devotion / 250);
      t.knowledge += t.rate * dt;
      if (t.current) {
        const d = TECH_BY_ID[t.current];
        if (t.knowledge >= d.cost) {
          t.knowledge -= d.cost; t.techs[d.id] = true; this.stats.techs++;
          this.addLog(`${TRIBES[t.id].name} discover ${d.name}.`, 'good');
          const s0 = ss.find((q) => q.tribe === t.id);
          if (s0) { this.floatText(s0.x, s0.y - 2.6, `${d.icon} ${d.name}`, TRIBES[t.id].color, 1.2); this.burst(s0.x, s0.y, 14, TRIBES[t.id].color, 3, 1, true); }
          this.audio.sfx('chime');
          t.current = null; if (t.focus === d.id) t.focus = null; this.chooseTech(t);
        }
      } else this.chooseTech(t);
    }
    this.stats.peakPop = Math.max(this.stats.peakPop, total);
    this.stats.tribesAlive = this.tribes.filter((t) => t.alive).length;
    if (this.state === 'playing') { naturalHazards(this, dt); this.checkEra(); }
  }

  flee(s: Settlement) {
    // look for nearby valid land
    let best: { x: number; y: number } | null = null, bd = 99;
    for (let k = 0; k < 60; k++) {
      const a = Math.random() * 6.283, r = 1 + Math.random() * 5;
      const x = mod(Math.round(s.x + Math.cos(a) * r), W), y = Math.round(s.y + Math.sin(a) * r);
      if (y < 0 || y >= H) continue;
      const i = y * W + x;
      if (this.top[i] < 0 || this.h[i] < this.sea + 0.03 || this.lavaT[i] > 0 || this.h[i] - this.sea > 0.6) continue;
      const d = this.dist(s.x, s.y, x, y);
      if (d < bd) { bd = d; best = { x, y }; }
    }
    if (!best) return;
    const pid = this.top[this.idx(best.x, best.y)]; const p = this.plates[pid];
    this.floatText(s.x, s.y - 1.5, 'Refugees flee!', '#ffd28a');
    s.pop *= 0.75; s.plate = pid; s.bad = 0;
    s.lx = wrapDX(best.x, p.sx + Math.round(p.ox)); s.ly = best.y - (p.sy + Math.round(p.oy));
    s.x = best.x; s.y = best.y;
    this.addLog(`${s.name} relocates to safer ground.`, 'info');
  }

  expand(s: Settlement) {
    const t = this.tribes[s.tribe];
    const cap = 6 + (t.techs['agri'] ? 2 : 0) + (t.techs['works'] ? 2 : 0);
    if (this.settlements.filter((q) => q.tribe === s.tribe).length >= cap) return;
    const seaf = !!t.techs['seafaring'], irr = !!t.techs['irrigation'];
    let best: { x: number; y: number } | null = null, bs = -1;
    for (let k = 0; k < 30; k++) {
      const a = Math.random() * 6.283, r = 4 + Math.random() * 5;
      const x = mod(Math.round(s.x + Math.cos(a) * r), W), y = Math.round(s.y + Math.sin(a) * r);
      if (y < 0 || y >= H) continue;
      const i = y * W + x; const e = this.h[i] - this.sea;
      if (this.top[i] < 0 || e < 0.03 || e > 0.55 || this.lavaT[i] > 0) continue;
      if (this.fert[i] < (irr ? 0.1 : 0.3)) continue;
      let ok = true;
      for (const o of this.settlements) if (this.dist(x, y, o.x, o.y) < 4.2) { ok = false; break; }
      if (!ok) continue;
      if (this.waterCross(s.x, s.y, x, y) > this.crossMax(s.tribe)) continue;
      const sc = this.fert[i] + Math.random() * 0.25 + (seaf && this.dw[i] <= 1.5 ? 0.2 : 0);
      if (sc > bs) { bs = sc; best = { x, y }; }
    }
    if (!best) return;
    const pop = s.pop * 0.35;
    const n = this.foundAt(s.tribe, best.x, best.y, pop);
    if (n) {
      s.pop -= pop; t.nset++;
      this.floatText(n.x, n.y - 1.4, 'New settlement', TRIBES[s.tribe].color);
      this.burst(n.x, n.y, 8, TRIBES[s.tribe].color, 2, 0.7, true);
      this.audio.sfx('found');
    }
  }

  totals() {
    let pop = 0, techs = 0, tier3 = false;
    for (const t of this.tribes) { pop += t.pop; for (const k of Object.keys(t.techs)) { if (t.techs[k]) { techs++; if (TECH_BY_ID[k].tier === 3) tier3 = true; } } }
    return { pop, settlements: this.settlements.length, techs, tier3 };
  }
  checkEra() {
    if (this.era >= 4) return;
    const e = ERAS[this.era], g = this.diff.goal, tt = this.totals();
    const ok = tt.pop >= e.pop * g && tt.settlements >= Math.ceil(e.settlements * Math.min(1, g)) && tt.techs >= Math.ceil(e.techs * g) && (!e.tier3 || tt.tier3) && this.eraTime >= e.min;
    if (!ok) return;
    this.era++; this.eraTime = 0;
    const n = ERAS[this.era];
    this.banner_(n.name, n.blurb); this.addLog(`${n.name} begins. ${n.blurb}`, 'era'); this.audio.sfx('era');
    this.favor = Math.min(100, this.favor + 20); this.energy = this.maxEnergy();
    for (const p of this.plates) { p.dx *= 1.15; p.dy *= 1.15; }
    this.shake = Math.max(this.shake, 0.4);
    if (this.era === 4) spawnTitan(this);
  }

  // ---------- powers ----------
  useTool(tool: ToolId, mx: number, my: number, alt: boolean) {
    const def = TOOLS.find((d) => d.id === tool)!;
    if (def.unlock > 0 && !this.meta.unlocked.includes(tool)) { this.audio.sfx('error'); return; }
    if ((this.cd[tool] || 0) > 0) { this.floatText(mx, my, 'Recharging', '#aab'); this.audio.sfx('error'); return; }
    const have = def.resource === 'energy' ? this.energy : def.resource === 'favor' ? this.favor : 99;
    if (have < def.cost) { this.floatText(mx, my, def.resource === 'energy' ? 'Not enough energy' : 'Not enough favor', '#ff9a9a'); this.energyFlash = 1; this.audio.sfx('error'); return; }
    let ok = true;
    switch (tool) {
      case 'tremor':
        quake(this, mx, my, null, { player: true }); this.tutTremor = true; break;
      case 'volcano':
        spawnVolcano(this, mx, my, true); break;
      case 'bless': {
        const cx = Math.floor(mx), cy = Math.floor(my);
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
          const y = cy + dy; if (y < 0 || y >= H) continue;
          const d = Math.hypot(dx, dy); if (d > 6) continue;
          this.bless[y * W + mod(cx + dx, W)] = 1;
        }
        for (const s of this.settlements) if (this.dist(mx, my, s.x, s.y) < 6.5) {
          s.pop = Math.min(Math.max(s.pop, s.K), s.pop * 1.1 + 1);
          const t = this.tribes[s.tribe]; t.devotion = Math.min(100, t.devotion + 8);
          this.floatText(s.x, s.y - 1.6, 'Blessed', '#9dff8a');
        }
        this.burst(mx, my, 40, '#9dff8a', 5, 1.2, true, -1); this.ring(mx, my, 6.5, '#9dff8a', 0.9);
        this.audio.sfx('bless'); this.climate(); break;
      }
      case 'tide': {
        const lower = this.tideLower !== alt;
        this.seaTarget = Math.max(-0.3, Math.min(0.4, this.seaTarget + (lower ? -0.045 : 0.045)));
        this.floatText(mx, my, lower ? 'Waters recede' : 'Waters rise', '#7fd6ff', 1.2);
        this.audio.sfx('tide'); this.shake = Math.max(this.shake, 0.15); break;
      }
      case 'omen': {
        const s = this.nearestSettlement(mx, my, 4);
        if (!s) { this.floatText(mx, my, 'Click a settlement', '#ff9a9a'); this.audio.sfx('error'); ok = false; break; }
        const t = this.tribes[s.tribe];
        for (const o of this.tribes) if (o.id !== t.id && o.alive) {
          if (t.contact[o.id]) { t.rel[o.id] = Math.min(100, t.rel[o.id] + 38); o.rel[t.id] = t.rel[o.id]; }
          if (t.war[o.id]) { t.war[o.id] = o.war[t.id] = false; this.addLog(`An omen ends the war between ${TRIBES[t.id].name} and ${TRIBES[o.id].name}.`, 'good'); }
        }
        t.devotion = Math.min(100, t.devotion + 5);
        this.ring(s.x, s.y, 9, '#ffffff', 1.4); this.burst(s.x, s.y, 25, '#ffffff', 3, 1.2, true, -0.6);
        this.floatText(s.x, s.y - 2, '🕊 Peace', '#fff', 1.3); this.audio.sfx('omen'); break;
      }
      case 'sanct':
        this.sanctuaries.push({ x: mx, y: my, r: 7, t: 25, max: 25 });
        this.ring(mx, my, 7, '#9be7ff', 1); this.audio.sfx('sanct'); break;
      default: ok = false;
    }
    if (!ok) return;
    if (def.resource === 'energy') this.energy -= def.cost; else if (def.resource === 'favor') this.favor -= def.cost;
    this.cd[tool] = def.cd; this.cdMax[tool] = def.cd;
  }

  // ---------- tutorial ----------
  updateTutorial() {
    if (!this.tut.active) return;
    const s = this.tut.step;
    const adv = () => { this.tut.step++; this.audio.sfx('chime'); this.onTutStep(); };
    if (s === 0 && this.stats.dist >= 8) adv();
    else if (s === 1 && this.overlay === 2) adv();
    else if (s === 2 && this.tutTremor) adv();
    else if (s === 3 && this.stats.prayers >= 1) adv();
    else if (s === 4 && this.tutPanelOpen && this.tutFocusSet) adv();
    if (this.tut.step >= 4) this.tutShield = false;
  }
  onTutStep() {
    const s = this.tut.step;
    if (s === 2) {
      // plant a visible stress blob
      for (let tries = 0; tries < 60; tries++) {
        const x = Math.floor(Math.random() * W), y = 8 + Math.floor(Math.random() * (H - 16));
        const i = y * W + x;
        if (this.h[i] < this.sea || this.nearestSettlement(x, y, 8)) continue;
        for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
          const d = Math.hypot(dx, dy); if (d > 5) continue;
          const yy = y + dy; if (yy < 0 || yy >= H) continue;
          this.stress[yy * W + mod(x + dx, W)] = Math.max(this.stress[yy * W + mod(x + dx, W)], 85 * (1 - d / 7));
        }
        this.floatText(x, y, 'Stress!', '#ff6b6b', 1.4); this.ring(x, y, 6, '#ff6b6b', 1.2);
        this.mouse.mx = x; break;
      }
    }
    if (s === 3 && this.settlements.length) {
      const sl = this.settlements[0];
      this.prayers.push({ id: this.nextId++, sid: sl.id, t: 0, ttl: 60 });
    }
    if (s === 5) this.tutShield = false;
  }

  // ---------- end ----------
  computeScore(victory: boolean) {
    const s = this.stats;
    let sc = s.peakPop * 2 + s.techs * 40 + this.era * 250 + s.founded * 5 + s.tribesAlive * 200 + s.prayers * 3 + s.titanDmg * 8 - s.deaths * 0.3 + (victory ? 3000 : 0);
    sc = Math.max(0, sc) * this.diff.score * (1 + MODS.filter((m) => this.modSet.has(m.id)).reduce((a, m) => a + m.bonus, 0));
    return Math.round(sc);
  }
  finish(victory: boolean, reason: string) {
    if (this.state !== 'playing') return;
    this.state = 'ended'; this.drag = null; this.audio.setRumble(0);
    const score = this.computeScore(victory);
    const insight = Math.max(3, Math.floor(score / 90) + (victory ? 25 : 0));
    this.result = { victory, score, insight, stats: { ...this.stats }, era: this.era, diff: this.diffId, mods: Array.from(this.modSet), newBest: score > this.meta.best, reason };
    this.audio.sfx(victory ? 'victory' : 'defeat');
    this.onEnd(this.result);
  }
  win() { this.finish(true, 'The Titan sleeps. The tribes endure upon a world you shaped.'); }

  // ---------- UI snapshot ----------
  snapshot() {
    const tt = this.totals(); const e = ERAS[Math.min(this.era, 4)]; const g = this.diff.goal;
    const goals = this.era >= 4 ? [] : [
      { label: 'Population', cur: Math.floor(tt.pop), need: Math.ceil(e.pop * g) },
      { label: 'Settlements', cur: tt.settlements, need: Math.ceil(e.settlements * Math.min(1, g)) },
      ...(e.techs ? [{ label: 'Discoveries', cur: tt.techs, need: Math.ceil(e.techs * g) }] : []),
      ...(e.tier3 ? [{ label: 'Tier III tech', cur: tt.tier3 ? 1 : 0, need: 1 }] : []),
      ...(this.eraTime < e.min ? [{ label: 'Patience (s)', cur: Math.floor(this.eraTime), need: e.min }] : []),
    ];
    let hover: { text: string; sub: string } | null = null;
    if (this.mouse.inside && this.state === 'playing') {
      const i = this.idx(this.mouse.mx, this.mouse.my);
      const s = this.nearestSettlement(this.mouse.mx, this.mouse.my, 1.6);
      const pl = this.top[i] >= 0 ? this.plates[this.top[i]].name : 'Rift';
      hover = s
        ? { text: `${s.name} · ${TRIBES[s.tribe].name}`, sub: `Pop ${Math.floor(s.pop)}/${Math.floor(s.K)} · ${BIOME_NAMES[this.biome[i]]} · Plate ${pl}` }
        : { text: `${BIOME_NAMES[this.biome[i]]} · Plate ${pl}`, sub: `Elev ${Math.round((this.h[i] - this.sea) * 1000)}m · Fertility ${this.fert[i].toFixed(2)} · Stress ${Math.round(this.stress[i])}` };
    }
    const cds: Record<string, number> = {};
    for (const k of Object.keys(this.cd)) cds[k] = this.cdMax[k] ? this.cd[k] / this.cdMax[k] : 0;
    return {
      state: this.state, paused: this.paused, speed: this.speed, time: this.stats.time, era: this.era, eraName: e.name, goals,
      energy: this.energy, maxEnergy: this.maxEnergy(), favor: this.favor, tool: this.tool, tideLower: this.tideLower, overlay: this.overlay, cds,
      pop: Math.floor(tt.pop), settlements: tt.settlements, sea: this.sea, tension: this.tension, endless: this.endless,
      diff: this.diffId, mods: Array.from(this.modSet), energyFlash: this.energyFlash,
      titan: this.titan ? { hp: Math.max(0, this.titan.hp), max: this.titan.max, phase: this.titan.phase, tele: this.titan.tele, dead: this.titan.dead } : null,
      tribes: this.tribes.map((t) => ({
        id: t.id, alive: t.alive, pop: Math.floor(t.pop), nset: t.nset, devotion: Math.round(t.devotion), current: t.current,
        progress: t.current ? Math.min(1, t.knowledge / TECH_BY_ID[t.current].cost) : 0, focus: t.focus, techs: Object.keys(t.techs).filter((k) => t.techs[k]),
        rate: t.rate, rel: t.rel.map((v) => Math.round(v)), war: t.war.slice(), contact: t.contact.slice(), trade: t.trade.slice(),
      })),
      log: this.log.slice(0, 40), banner: this.banner ? { text: this.banner.text, sub: this.banner.sub } : null,
      warnings: this.warnings.map((w) => w.text), tut: { ...this.tut }, hover,
      prayers: this.prayers.length, score: this.computeScore(false), plates: this.plates.length,
    };
  }
}

export type Snapshot = ReturnType<Game['snapshot']>;
export { DIFFS };
