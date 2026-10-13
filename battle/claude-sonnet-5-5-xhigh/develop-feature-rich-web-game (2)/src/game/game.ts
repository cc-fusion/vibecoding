import { T, TILES, WALLS, ITEMS, TIERS, DIFFS, ENEMIES, RECIPES, B, TS, Recipe } from './data';
import { World, generate, rleEncode, rleDecode, WW, WH, HELL_TOP, Stack, mulberry } from './world';
import { audio } from './audio';
import { buildTextures, hexRgb } from './gfx';
import * as store from './store';
import type { Player, Enemy, Npc, Proj, Drop, Particle, FText, Room, Settings, Meta, Stats, Body, PStats } from './types';
import * as C from './combat';
import * as N from './npc';
import { render } from './render';

export const CYCLE = 600, DAY_LEN = 360;
export const daylight = (t: number) => (t >= DAY_LEN ? 0 : Math.min(1, Math.sin(Math.PI * t / DAY_LEN) * 2.2));
export const isNight = (t: number) => t >= DAY_LEN;
const approach = (v: number, t: number, d: number) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));

// ---------- physics ----------
export interface MoveOpts { friendly?: boolean; ghost?: boolean; drop?: boolean; step?: number; }
export function collides(w: World, x: number, y: number, bw: number, bh: number, o: MoveOpts, axisY = false, prevBottom = 0, vy = 0): boolean {
  const x0 = Math.floor(x / 16), x1 = Math.floor((x + bw - 0.001) / 16), y0 = Math.floor(y / 16), y1 = Math.floor((y + bh - 0.001) / 16);
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    const d = TILES[w.get(tx, ty)];
    if (d.solid) return true;
    if (d.door && !o.friendly) return true;
    if (d.plat && axisY && vy > 0 && !o.drop && prevBottom <= ty * 16 + 1) return true;
  }
  return false;
}
export function moveBody(w: World, e: Body, dt: number, o: MoveOpts = {}) {
  const maxV = Math.max(Math.abs(e.vx), Math.abs(e.vy));
  const n = Math.max(1, Math.ceil(maxV * dt / 6)), sdt = dt / n;
  const was = e.onGround; e.onGround = false; (e as any).hitWall = 0;
  for (let i = 0; i < n; i++) {
    if (e.vx !== 0) {
      e.x += e.vx * sdt;
      if (!o.ghost && collides(w, e.x, e.y, e.w, e.h, o)) {
        let stepped = false;
        const maxUp = o.step === undefined ? 16.5 : o.step;
        if ((was || e.onGround) && maxUp > 0) for (let up = 1; up <= maxUp; up++) { if (!collides(w, e.x, e.y - up, e.w, e.h, o)) { e.y -= up; stepped = true; break; } }
        if (!stepped) {
          if (e.vx > 0) e.x = Math.floor((e.x + e.w) / 16) * 16 - e.w - 0.001; else e.x = (Math.floor(e.x / 16) + 1) * 16 + 0.001;
          (e as any).hitWall = e.vx > 0 ? 1 : -1; e.vx = 0;
        }
      }
    }
    if (e.vy !== 0 || true) {
      const oy = e.y; e.y += e.vy * sdt;
      if (!o.ghost && collides(w, e.x, e.y, e.w, e.h, o, true, oy + e.h, e.vy)) {
        if (e.vy > 0) { e.y = Math.floor((e.y + e.h) / 16) * 16 - e.h - 0.001; e.onGround = true; } else e.y = (Math.floor(e.y / 16) + 1) * 16 + 0.001;
        e.vy = 0;
      }
    }
  }
}

function newStats(): Stats {
  return { mined: 0, placed: {}, crafted: {}, collected: {}, kills: 0, deaths: 0, dist: 0, dmgDealt: 0, dmgTaken: 0, maxDepth: 0, play: 0, coinsEarned: 0, bosses: {}, npcsMet: 0, chests: 0, events: 0 };
}
const TCOL: number[][] = TILES.map(t => hexRgb(t.c)); const WCOL: number[][] = WALLS.map(w => hexRgb(w.c));

export interface GameOpts { slot: number; name: string; seed: number; diff: string; mods: string[]; settings: Settings; save?: any; }

export class Game {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; settings: Settings; meta: Meta;
  slot: number; name: string; seed: number; diff: typeof DIFFS[0]; mods: string[]; perks: Record<string, number>;
  world!: World; player!: Player;
  enemies: Enemy[] = []; npcs: Npc[] = []; projs: Proj[] = []; drops: Drop[] = []; parts: Particle[] = []; texts: FText[] = [];
  time = 60; day = 1; boss: Enemy | null = null;
  ev: { blood: boolean; rain: number; goblin: { kills: number; total: number; side: number } | null } = { blood: false, rain: 0, goblin: null };
  flags: Record<string, boolean> = { eoc: false, skel: false, wof: false, worm: false, lunar: false, goblin: false, hell: false, wonShown: false };
  stats: Stats = newStats(); uid = 1;
  keys = new Set<string>(); mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, right: false, edge: false, redge: false };
  touch = { left: false, right: false, jump: false, down: false, interact: false };
  cam = { x: 0, y: 0, shake: 0 }; scale = 2; vw = 640; vh = 360; camL = 0; camT = 0;
  panel = 'none'; talk: Npc | null = null; chestKey: number | null = null;
  msgs: { t: string; c: string; life: number }[] = []; ver = 0;
  paused = false; dead = false; won = false; respawnT = 0; permaDead = false; deathCause = '';
  rooms: Room[] = []; stations = new Set<string>(['hand']); hoverRoom: any = null;
  objDone: Record<string, boolean> = {}; runShards = 0; nightCount = 0;
  mapCanvas!: HTMLCanvasElement; mapCtx!: CanvasRenderingContext2D; mapImg!: ImageData; revealed!: Uint8Array; mapDirty = false; mapT = 0;
  cb: { onPause?: () => void; onDeath?: () => void; onWin?: () => void; onChange?: () => void } = {};
  private raf = 0; private lastTs = 0; private acc = 0; private running = false;
  private timers = { amb: 0, liq: 0, st: 0, aud: 0, save: 0, star: 25, map: 0, chest: 0, ui: 0 };
  moodT = 0; hudT = 0; lastSave = 0;
  private handlers: [any, string, any, any?][] = [];

  constructor(canvas: HTMLCanvasElement, opts: GameOpts) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!; this.settings = opts.settings; this.meta = store.loadMeta();
    this.slot = opts.slot; this.name = opts.name; this.seed = opts.seed; this.diff = DIFFS.find(d => d.id === opts.diff) || DIFFS[1]; this.mods = opts.mods;
    this.perks = this.meta.perks;
    buildTextures();
    if (opts.save) this.loadFrom(opts.save); else this.newWorld();
    this.initMap(); this.recalcStats(); this.resize();
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.applyAudio();
  }

  // ----- setup -----
  newWorld() {
    this.world = generate(this.seed, { scarce: this.mods.includes('scarce'), luck: 0.15 + 0.12 * (this.perks.fortune || 0) });
    const hp = Math.round((100 + 20 * (this.perks.hardy || 0)) * (this.mods.includes('glass') ? 0.75 : 1));
    const p: Player = {
      x: this.world.spawn.x * 16, y: this.world.spawn.y * 16 - 30, w: 12, h: 28, vx: 0, vy: 0, onGround: false, dir: 1,
      hp, maxHp: hp, mana: 20, maxMana: 20, inv: Array(40).fill(null), armor: [null, null, null], acc: [null, null, null, null], sel: 0, coins: 0,
      buffs: {}, invT: 0, useCd: 0, swing: null, mine: { x: -1, y: -1, prog: 0, snd: 0, warn: false }, jumps: 0, coyote: 0, jumpBuf: 0, wasJump: false,
      flight: 2.5, peakY: 0, walk: 0, dead: false, regenT: 0, manaT: 0, sleeping: false, recall: 0, hook: null, windLeft: this.perks.wind || 0, lavaT: 0,
      st: { def: 0, speed: 1, dmg: 1, crit: 4, mine: 1, melee: 1, lava: false, noFall: false, doubleJump: false, wings: false, kbImmune: false, regen: 0, owl: false, hermes: false },
      spawnX: this.world.spawn.x * 16, spawnY: this.world.spawn.y * 16 - 30, lightT: 0,
    };
    this.player = p; p.peakY = p.y;
    const kit = this.perks.kit || 0;
    this.addItem('copper_pick', 1, true); this.addItem('copper_sword', 1, true); this.addItem('torch', 6 + (kit >= 1 ? 25 : 0), true);
    if (kit >= 1) this.addItem('bomb', 8, true); if (kit >= 2) this.addItem('iron_pick', 1, true); if (kit >= 3) { this.addItem('magic_mirror', 1, true); this.addItem('grappling_hook', 1, true); }
    N.spawnGuide(this);
    this.time = 60; this.day = 1;
  }
  loadFrom(s: any) {
    const w = new World(s.W, s.H, s.seed); this.world = w;
    w.tiles = rleDecode(s.tiles, s.W * s.H); w.walls = rleDecode(s.walls, s.W * s.H);
    w.chests = new Map(s.chests); w.hardmode = !!s.hardmode; w.spawn = s.spawn;
    const sp = s.player; const p: Player = {
      x: sp.x, y: sp.y, w: 12, h: 28, vx: 0, vy: 0, onGround: false, dir: 1, hp: sp.hp, maxHp: sp.maxHp, mana: sp.mana, maxMana: sp.maxMana,
      inv: sp.inv, armor: sp.armor, acc: sp.acc, sel: sp.sel || 0, coins: sp.coins, buffs: sp.buffs || {}, invT: 1.5, useCd: 0, swing: null,
      mine: { x: -1, y: -1, prog: 0, snd: 0, warn: false }, jumps: 0, coyote: 0, jumpBuf: 0, wasJump: false, flight: 2.5, peakY: sp.y, walk: 0, dead: false,
      regenT: 0, manaT: 0, sleeping: false, recall: 0, hook: null, windLeft: sp.windLeft ?? 0, lavaT: 0,
      st: { def: 0, speed: 1, dmg: 1, crit: 4, mine: 1, melee: 1, lava: false, noFall: false, doubleJump: false, wings: false, kbImmune: false, regen: 0, owl: false, hermes: false },
      spawnX: sp.spawnX, spawnY: sp.spawnY, lightT: 0,
    };
    this.player = p; this.time = s.time; this.day = s.day; this.flags = { ...this.flags, ...s.flags }; this.stats = { ...newStats(), ...s.stats }; this.objDone = s.objDone || {};
    this.runShards = s.runShards || 0; this.nightCount = s.nightCount || 0;
    this.ev = { blood: false, rain: 0, goblin: null };
    this.npcs = [];
    for (const n of s.npcs || []) { const c = N.makeNpc(this, n.id, n.x, n.y); if (c) { c.hp = n.hp; c.home = n.home; c.deadT = n.deadT || 0; this.npcs.push(c); } }
    this.revealed = rleDecode(s.revealed, s.W * s.H);
  }
  serialize() {
    const w = this.world, p = this.player;
    return {
      v: 1, seed: this.seed, W: w.W, H: w.H, tiles: rleEncode(w.tiles), walls: rleEncode(w.walls), chests: Array.from(w.chests.entries()), hardmode: w.hardmode, spawn: w.spawn,
      player: { x: p.x, y: p.y, hp: p.hp, maxHp: p.maxHp, mana: p.mana, maxMana: p.maxMana, inv: p.inv, armor: p.armor, acc: p.acc, sel: p.sel, coins: p.coins, buffs: p.buffs, windLeft: p.windLeft, spawnX: p.spawnX, spawnY: p.spawnY },
      npcs: this.npcs.map(n => ({ id: n.id, hp: n.hp, home: n.home, x: n.x, y: n.y, deadT: n.deadT })),
      time: this.time, day: this.day, flags: this.flags, stats: this.stats, objDone: this.objDone, runShards: this.runShards, nightCount: this.nightCount,
      revealed: rleEncode(this.revealed), diff: this.diff.id, mods: this.mods, name: this.name,
    };
  }
  save(): boolean {
    if (this.permaDead) return false;
    const bosses = Object.keys(this.stats.bosses).length;
    const ok = store.saveSlot(this.slot, this.serialize(), { name: this.name, diff: this.diff.id, day: this.day, play: this.stats.play, bosses, hardmode: this.world.hardmode, saved: Date.now(), mods: this.mods });
    this.lastSave = Date.now();
    const m = this.meta; m.bestDay = Math.max(m.bestDay, this.day); store.saveMeta(m);
    return ok;
  }

  // ----- lifecycle -----
  start() {
    if (this.running) return; this.running = true; this.lastTs = performance.now(); this.bind();
    const loop = (ts: number) => {
      if (!this.running) return; this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (ts - this.lastTs) / 1000); this.lastTs = ts;
      if (!this.paused) { this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n < 4) { this.update(1 / 60); this.acc -= 1 / 60; n++; } if (n === 4) this.acc = 0; }
      render(this);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); this.unbind(); }
  setPaused(p: boolean) { this.paused = p; audio.setDuck(p); if (p) { this.mouse.down = false; this.mouse.right = false; this.keys.clear(); } }
  applyAudio() { const s = this.settings; audio.setVolumes(s.master, s.music, s.sfx, s.muted); }
  resize() {
    const c = this.canvas; const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cw = Math.max(320, c.clientWidth), ch = Math.max(240, c.clientHeight);
    c.width = Math.floor(cw * dpr); c.height = Math.floor(ch * dpr);
    const z = this.settings.zoom || Math.max(2, Math.min(4, Math.round(ch / 540)));
    this.scale = z * dpr; this.vw = c.width / this.scale; this.vh = c.height / this.scale;
  }

  // ----- input -----
  private on(t: any, ev: string, fn: any, opt?: any) { t.addEventListener(ev, fn, opt); this.handlers.push([t, ev, fn, opt]); }
  bind() {
    const c = this.canvas;
    const setPos = (e: PointerEvent) => { const r = c.getBoundingClientRect(); this.mouse.x = (e.clientX - r.left) * (c.width / r.width); this.mouse.y = (e.clientY - r.top) * (c.height / r.height); this.mouse.wx = this.camL + this.mouse.x / this.scale; this.mouse.wy = this.camT + this.mouse.y / this.scale; };
    this.on(c, 'pointerdown', (e: PointerEvent) => {
      audio.resume(); setPos(e); try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const right = e.button === 2 || (e.pointerType === 'touch' && this.touch.interact);
      if (right) { this.mouse.right = true; this.mouse.redge = true; } else if (e.button === 0) { this.mouse.down = true; this.mouse.edge = true; }
    });
    this.on(c, 'pointermove', (e: PointerEvent) => setPos(e));
    this.on(window, 'pointerup', () => { this.mouse.down = false; this.mouse.right = false; });
    this.on(window, 'pointercancel', () => { this.mouse.down = false; this.mouse.right = false; });
    this.on(c, 'contextmenu', (e: Event) => e.preventDefault());
    this.on(c, 'wheel', (e: WheelEvent) => { if (this.paused) return; this.player.sel = (this.player.sel + (e.deltaY > 0 ? 1 : -1) + 10) % 10; audio.sfx('ui'); this.ver++; e.preventDefault(); }, { passive: false });
    this.on(window, 'keydown', (e: KeyboardEvent) => this.keyDown(e));
    this.on(window, 'keyup', (e: KeyboardEvent) => { this.keys.delete(e.key.toLowerCase()); });
    this.on(window, 'blur', () => { this.keys.clear(); this.mouse.down = false; if (!this.paused && !this.dead && !this.won) this.cb.onPause && this.cb.onPause(); });
    this.on(document, 'visibilitychange', () => { if (document.hidden && !this.paused && !this.dead && !this.won) this.cb.onPause && this.cb.onPause(); });
    this.on(window, 'resize', () => this.resize());
    this.on(window, 'beforeunload', () => { try { this.save(); } catch { /* ignore */ } });
  }
  unbind() { for (const [t, ev, fn, opt] of this.handlers) t.removeEventListener(ev, fn, opt); this.handlers = []; }
  keyDown(e: KeyboardEvent) {
    const tg = e.target as HTMLElement; const typing = !!tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA');
    const k = e.key.toLowerCase();
    if (typing) { if (k === 'escape') (tg as HTMLElement).blur(); else return; }
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
    if (k === 'escape') { if (this.panel !== 'none') this.closePanel(); else if (!this.dead && !this.won) this.cb.onPause && this.cb.onPause(); return; }
    if (this.paused || this.dead || this.won) return;
    this.keys.add(k);
    if (e.repeat) return;
    if (k === 'e' || k === 'i' || k === 'tab') { this.panel === 'inventory' ? this.closePanel() : this.openPanel('inventory'); }
    else if (k === 'h') this.panel === 'housing' ? this.closePanel() : this.openPanel('housing');
    else if (k === 'j') this.panel === 'journal' ? this.closePanel() : this.openPanel('journal');
    else if (k === 'm') this.panel === 'map' ? this.closePanel() : this.openPanel('map');
    else if (k === 'q') this.quickHeal(); else if (k === 'r') this.quickMana();
    else if (k >= '0' && k <= '9') { this.player.sel = k === '0' ? 9 : parseInt(k) - 1; audio.sfx('ui'); this.ver++; }
  }
  openPanel(p: string) { if (this.panel === p) return; this.panel = p; if (p !== 'inventory') this.chestKey = null; audio.sfx('open'); this.ver++; this.cb.onChange && this.cb.onChange(); }
  closePanel() { if (this.panel === 'none') return; this.panel = 'none'; this.talk = null; this.chestKey = null; audio.sfx('close'); this.ver++; this.cb.onChange && this.cb.onChange(); }

  // ----- feedback helpers -----
  say(t: string, c = '#ffffff', life = 5) { this.msgs.unshift({ t, c, life }); if (this.msgs.length > 6) this.msgs.pop(); this.ver++; }
  ftext(x: number, y: number, txt: string, col = '#fff', size = 8) { if (!this.settings.numbers && size < 11) return; if (this.texts.length > 80) this.texts.shift(); this.texts.push({ x, y, vy: -38, txt, col, life: 1.0, max: 1.0, size }); }
  burst(x: number, y: number, n: number, col: string, spd = 60, grav = 200, life = 0.6, size = 2, glow = false) {
    const f = [0.25, 0.6, 1][this.settings.particles] ?? 1; n = Math.ceil(n * f);
    for (let i = 0; i < n && this.parts.length < 800; i++) { const a = Math.random() * 6.283, s = spd * (0.3 + Math.random() * 0.8); this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - spd * 0.3, life: life * (0.6 + Math.random() * 0.6), max: life, size, col, grav, glow }); }
  }
  shake(n: number) { if (this.settings.shake) this.cam.shake = Math.min(14, Math.max(this.cam.shake, n)); }
  award(n: number, why: string) { if (n <= 0) return; this.meta.shards += n; store.saveMeta(this.meta); this.runShards += n; this.say(`+${n} Legacy Shards — ${why}`, '#c8a0ff', 7); }

  // ----- stats -----
  recalcStats() {
    const p = this.player; const st: PStats = { def: 0, speed: 1, dmg: 1, crit: 4, mine: 1, melee: 1, lava: false, noFall: false, doubleJump: false, wings: false, kbImmune: false, regen: 0, owl: false, hermes: false };
    const sets: Record<string, number> = {};
    for (const s of p.armor) if (s) { const d = ITEMS[s.id]; st.def += d.def || 0; if (d.set) sets[d.set] = (sets[d.set] || 0) + 1; }
    for (const k in sets) if (sets[k] >= 3) { const b = TIERS.find(t => t.k === k)!.set; st.def += b.def || 0; st.crit += b.crit || 0; st.speed += b.speed || 0; st.mine += b.mine || 0; st.dmg += b.dmg || 0; if (b.lava) st.lava = true; }
    for (const s of p.acc) if (s) switch (ITEMS[s.id].fx) {
      case 'hermes': st.speed += 0.35; st.hermes = true; break; case 'cloud': st.doubleJump = true; break; case 'horseshoe': st.noFall = true; break;
      case 'regen': st.regen += 1.2; break; case 'claws': st.melee *= 0.85; break; case 'shield': st.def += 4; st.kbImmune = true; break;
      case 'wings': st.wings = true; break; case 'emblem': st.dmg += 0.12; break;
    }
    const b = p.buffs;
    if (b.ironskin > 0) st.def += 8; if (b.swift > 0) st.speed += 0.25; if (b.mining > 0) st.mine += 0.3; if (b.wrath > 0) st.dmg += 0.12;
    if (b.obsidian > 0) st.lava = true; if (b.owl > 0) st.owl = true; if (b.regen > 0) st.regen += 2;
    st.speed += 0.06 * (this.perks.fleet || 0); st.mine += 0.1 * (this.perks.quick || 0);
    if (this.mods.includes('glass')) st.dmg += 0.3;
    p.st = st;
  }
  touchInv() { this.ver++; this.recalcStats(); }

  // ----- inventory -----
  slotArr(area: string): Stack[] {
    const p = this.player;
    if (area === 'inv') return p.inv; if (area === 'armor') return p.armor; if (area === 'acc') return p.acc;
    if (area === 'chest' && this.chestKey !== null) return this.world.chests.get(this.chestKey) || [];
    return [];
  }
  roomFor(id: string, n: number): boolean {
    const d = ITEMS[id]; if (!d) return false; let left = n;
    for (const s of this.player.inv) { if (!s) left -= d.stack; else if (s.id === id) left -= d.stack - s.n; if (left <= 0) return true; }
    return false;
  }
  addItem(id: string, n = 1, silent = false): number {
    const d = ITEMS[id]; if (!d || n <= 0) return 0; const inv = this.player.inv; let left = n;
    for (let i = 0; i < inv.length && left > 0; i++) { const s = inv[i]; if (s && s.id === id && s.n < d.stack) { const a = Math.min(left, d.stack - s.n); s.n += a; left -= a; } }
    for (let i = 0; i < inv.length && left > 0; i++) { if (!inv[i]) { const a = Math.min(left, d.stack); inv[i] = { id, n: a }; left -= a; } }
    if (left > 0 && !silent) this.dropItem(this.player.x, this.player.y, id, left);
    this.touchInv(); return left;
  }
  countItem(id: string): number { let c = 0; for (const s of this.player.inv) if (s && s.id === id) c += s.n; return c; }
  removeItem(id: string, n: number): boolean {
    if (this.countItem(id) < n) return false; let left = n; const inv = this.player.inv;
    for (let i = inv.length - 1; i >= 0 && left > 0; i--) { const s = inv[i]; if (s && s.id === id) { const a = Math.min(left, s.n); s.n -= a; left -= a; if (s.n <= 0) inv[i] = null; } }
    this.touchInv(); return true;
  }
  consumeSel(n = 1) { const p = this.player; const s = p.inv[p.sel]; if (!s) return; s.n -= n; if (s.n <= 0) p.inv[p.sel] = null; this.touchInv(); }
  dropItem(x: number, y: number, id: string, n: number, star = false) {
    if (!ITEMS[id] || n <= 0) return;
    for (const d of this.drops) if (d.id === id && d.n < 9999 && Math.abs(d.x - x) < 14 && Math.abs(d.y - y) < 14 && !d.star) { d.n += n; return; }
    if (this.drops.length > 260) this.drops.shift();
    this.drops.push({ x: x - 4, y: y - 4, w: 8, h: 8, vx: (Math.random() - 0.5) * 120, vy: -120 - Math.random() * 80, onGround: false, dir: 1, id, n, t: 0, delay: 0.5, star });
  }
  canPlaceInSlot(area: string, i: number, s: Stack): boolean {
    if (!s) return true; const d = ITEMS[s.id];
    if (area === 'armor') return d.kind === (['head', 'body', 'legs'][i]);
    if (area === 'acc') return d.kind === 'acc';
    return true;
  }
  swapSlots(a: { area: string; i: number }, b: { area: string; i: number }) {
    const A = this.slotArr(a.area), Bb = this.slotArr(b.area); if (!A.length || !Bb.length) return;
    const s1 = A[a.i] || null, s2 = Bb[b.i] || null; if (!s1 && !s2) return;
    if (s1 && s2 && s1.id === s2.id && ITEMS[s1.id].stack > 1) {
      const m = ITEMS[s1.id].stack; const mv = Math.min(s1.n, m - s2.n); s2.n += mv; s1.n -= mv; if (s1.n <= 0) A[a.i] = null; this.touchInv(); audio.sfx('ui'); return;
    }
    if (!this.canPlaceInSlot(b.area, b.i, s1) || !this.canPlaceInSlot(a.area, a.i, s2)) { audio.sfx('error'); return; }
    A[a.i] = s2; Bb[b.i] = s1; audio.sfx('ui'); this.touchInv();
  }
  smartUse(area: string, i: number) {
    const arr = this.slotArr(area); const s = arr[i]; if (!s) return; const d = ITEMS[s.id];
    if (this.panel === 'npc' && this.talk && area === 'inv') { N.sell(this, area, i); return; }
    if (this.chestKey !== null && area === 'inv') { this.moveToChest(i); return; }
    if (area === 'chest') { const left = this.addItem(s.id, s.n, true); if (left === 0) arr[i] = null; else s.n = left; this.touchInv(); audio.sfx('pickup'); return; }
    if (area === 'armor' || area === 'acc') { const left = this.addItem(s.id, s.n, true); if (!left) arr[i] = null; this.touchInv(); return; }
    if (['head', 'body', 'legs'].includes(d.kind)) { const ai = ['head', 'body', 'legs'].indexOf(d.kind); const old = this.player.armor[ai]; this.player.armor[ai] = s; arr[i] = old; audio.sfx('craft'); this.touchInv(); }
    else if (d.kind === 'acc') { let slot = this.player.acc.findIndex(x => !x); if (slot < 0) slot = 0; const old = this.player.acc[slot]; this.player.acc[slot] = s; arr[i] = old; audio.sfx('craft'); this.touchInv(); }
    else if (d.kind === 'potion' || d.kind === 'use') { const keep = this.player.sel; this.player.sel = i; this.useConsumable(d); this.player.sel = keep; }
  }
  moveToChest(i: number) {
    if (this.chestKey === null) return; const ch = this.world.chests.get(this.chestKey); if (!ch) return; const s = this.player.inv[i]; if (!s) return; const d = ITEMS[s.id];
    for (let k = 0; k < ch.length && s.n > 0; k++) { const c = ch[k]; if (c && c.id === s.id && c.n < d.stack) { const a = Math.min(s.n, d.stack - c.n); c.n += a; s.n -= a; } }
    for (let k = 0; k < ch.length && s.n > 0; k++) { if (!ch[k]) { ch[k] = { id: s.id, n: s.n }; s.n = 0; } }
    if (s.n <= 0) this.player.inv[i] = null; audio.sfx('ui'); this.touchInv();
  }
  lootAll() {
    if (this.chestKey === null) return; const ch = this.world.chests.get(this.chestKey); if (!ch) return;
    for (let k = 0; k < ch.length; k++) { const s = ch[k]; if (s) { const left = this.addItem(s.id, s.n, true); if (left === 0) ch[k] = null; else s.n = left; } }
    audio.sfx('pickup'); this.touchInv();
  }
  trash(area: string, i: number) { const arr = this.slotArr(area); if (arr[i]) { arr[i] = null; audio.sfx('close'); this.touchInv(); } }

  // ----- crafting -----
  updateStations() {
    const p = this.player, w = this.world, set = new Set<string>(['hand']);
    const cx = Math.floor((p.x + p.w / 2) / 16), cy = Math.floor((p.y + p.h / 2) / 16);
    for (let y = cy - 4; y <= cy + 4; y++) for (let x = cx - 6; x <= cx + 6; x++) {
      const t = w.get(x, y);
      if (t === T.WORKBENCH) set.add('bench'); else if (t === T.FURNACE) set.add('furnace');
      else if (t === T.ANVIL) set.add('anvil'); else if (t === T.HELLFORGE) { set.add('forge'); set.add('furnace'); }
      else if (t === T.ARCANE) { set.add('arcane'); set.add('anvil'); }
    }
    this.stations = set;
  }
  canCraft(r: Recipe): boolean { if (!this.stations.has(r.st)) return false; return r.ing.every(([id, n]) => this.countItem(id) >= n); }
  craft(r: Recipe) {
    if (!this.canCraft(r)) { audio.sfx('error'); return; }
    for (const [id, n] of r.ing) this.removeItem(id, n);
    this.addItem(r.out, r.n); this.stats.crafted[r.out] = (this.stats.crafted[r.out] || 0) + r.n; audio.sfx('craft');
    this.ftext(this.player.x + 6, this.player.y - 6, `+${r.n} ${ITEMS[r.out].name}`, '#ffe9a0', 9);
  }
  recipes(): Recipe[] { return RECIPES; }

  // ----- update -----
  update(dt: number) {
    const p = this.player; this.stats.play += dt;
    this.updateTime(dt);
    if (p.dead && this.respawnT > 0) { this.respawnT = Math.max(0, this.respawnT - dt); this.ver++; }
    if (!p.dead) { this.updatePlayer(dt); this.handleUse(dt); }
    C.updateEnemies(this, dt); N.updateNpcs(this, dt); C.updateProjs(this, dt); this.updateDrops(dt); this.updateFx(dt);
    C.spawnTick(this, dt); N.updateEvents(this, dt); N.updateHousing(this, dt); N.updateObjectives(this, dt);
    this.ambient(dt);
    const t = this.timers;
    t.liq += dt; if (t.liq >= 0.09) { t.liq = 0; const px = Math.floor(p.x / 16), py = Math.floor(p.y / 16); this.world.stepLiquids(px - 70, py - 45, px + 70, py + 45); }
    t.st += dt; if (t.st >= 0.25) { t.st = 0; this.updateStations(); if (this.chestKey !== null) { const cx = this.chestKey % this.world.W, cy = Math.floor(this.chestKey / this.world.W); if (Math.hypot(cx * 16 - p.x, cy * 16 - p.y) > 150) { this.chestKey = null; this.ver++; } } }
    t.aud += dt; if (t.aud >= 0.5) { t.aud = 0; this.updateAudio(); }
    t.map += dt; if (t.map >= 0.25) { t.map = 0; this.revealAround(Math.floor((p.x + p.w / 2) / 16), Math.floor((p.y + p.h / 2) / 16), 13); if (this.mapDirty) { this.mapCtx.putImageData(this.mapImg, 0, 0); this.mapDirty = false; } }
    t.save += dt; if (t.save >= 60) { t.save = 0; this.save(); }
    for (let i = this.msgs.length - 1; i >= 0; i--) { this.msgs[i].life -= dt; if (this.msgs[i].life <= 0) { this.msgs.splice(i, 1); this.ver++; } }
    // camera
    const k = Math.min(1, dt * 7), tx = p.x + p.w / 2 + p.vx * 0.12 + (this.panel === 'none' ? (this.mouse.wx - (p.x + p.w / 2)) * 0.08 : 0), ty = p.y + p.h / 2 - 8;
    this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
    this.cam.x = Math.max(this.vw / 2, Math.min(this.world.W * 16 - this.vw / 2, this.cam.x)); this.cam.y = Math.max(this.vh / 2 - 120, Math.min(this.world.H * 16 - this.vh / 2, this.cam.y));
    this.cam.shake = Math.max(0, this.cam.shake - dt * 22);
    const sh = this.cam.shake;
    this.camL = Math.round((this.cam.x - this.vw / 2 + (Math.random() - 0.5) * sh) * this.scale) / this.scale; this.camT = Math.round((this.cam.y - this.vh / 2 + (Math.random() - 0.5) * sh) * this.scale) / this.scale;
    this.mouse.wx = this.camL + this.mouse.x / this.scale; this.mouse.wy = this.camT + this.mouse.y / this.scale;
    this.mouse.edge = false; this.mouse.redge = false;
  }

  updateTime(dt: number) {
    const p = this.player; const prevNight = isNight(this.time);
    this.time += dt * (p.sleeping ? 40 : 1);
    if (this.time >= CYCLE) { this.time -= CYCLE; this.day++; if (p.sleeping) { p.sleeping = false; this.say('You wake up refreshed.', '#ffe9a0'); } N.onNewDay(this); }
    const n = isNight(this.time); if (n && !prevNight) { this.nightCount++; N.onDusk(this); }
    if (p.sleeping) { if (!n) p.sleeping = false; }
  }

  updatePlayer(dt: number) {
    const p = this.player, w = this.world, k = this.keys, st = p.st;
    const L = k.has('a') || k.has('arrowleft') || this.touch.left, Rr = k.has('d') || k.has('arrowright') || this.touch.right;
    const J = k.has(' ') || k.has('w') || k.has('arrowup') || this.touch.jump, D = k.has('s') || k.has('arrowdown') || this.touch.down;
    if (p.sleeping && (L || Rr || J)) { p.sleeping = false; this.say('You get out of bed.', '#ffe9a0'); }
    const cxT = Math.floor((p.x + p.w / 2) / 16);
    const inWater = w.get(cxT, Math.floor((p.y + p.h * 0.6) / 16)) === T.WATER;
    const inLava = w.get(cxT, Math.floor((p.y + p.h * 0.6) / 16)) === T.LAVA || w.get(cxT, Math.floor((p.y + p.h - 2) / 16)) === T.LAVA;
    if (inWater && !(p as any).wasWater) { audio.sfx('splash'); this.burst(p.x + p.w / 2, p.y + p.h * 0.6, 10, '#9fd0ff', 70, 300, 0.5, 2); }
    (p as any).wasWater = inWater;
    const max = 150 * st.speed * (inWater ? 0.62 : 1) * (p.sleeping ? 0 : 1), target = (Rr ? 1 : 0) - (L ? 1 : 0);
    const acc = p.onGround ? 2600 : 1400;
    if (target !== 0 && !p.sleeping) { p.vx += target * acc * dt; if (Math.abs(p.vx) > max) p.vx = approach(p.vx, Math.sign(p.vx) * max, acc * 1.2 * dt); if (!this.mouse.down) p.dir = target; }
    else p.vx = approach(p.vx, 0, (p.onGround ? 2800 : 500) * dt);
    if (this.mouse.down && this.panel !== 'map') p.dir = this.mouse.wx < p.x + p.w / 2 ? -1 : 1;
    // jump
    const jp = J && !p.wasJump; p.wasJump = J; if (jp) p.jumpBuf = 0.12; p.jumpBuf -= dt;
    p.coyote = p.onGround ? 0.1 : p.coyote - dt;
    if (p.onGround) { p.jumps = 0; p.flight = 2.5; }
    if (p.hook && p.hook.state === 'hang') {
      if (jp) { p.hook = null; p.vy = -380; audio.sfx('jump'); }
    } else if (inWater) {
      if (J) p.vy = Math.max(p.vy - 1500 * dt, -170);
    } else if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -480; p.jumpBuf = 0; p.coyote = 0; audio.sfx('jump'); this.burst(p.x + p.w / 2, p.y + p.h, 4, '#cccccc', 40, 100, 0.3, 1);
    } else if (jp && !p.onGround && st.doubleJump && p.jumps < 1) {
      p.vy = -430; p.jumps++; p.jumpBuf = 0; audio.sfx('jump', 1.4); this.burst(p.x + p.w / 2, p.y + p.h, 10, '#ffffff', 60, 50, 0.5, 2, true);
    } else if (J && !p.onGround && st.wings && p.flight > 0 && p.vy > -120 && (p.jumps >= 1 || !st.doubleJump || p.vy > 0) && (!jp || p.jumps >= 0)) {
      if (!p.onGround && (p.coyote < 0)) { p.vy = Math.max(p.vy - 2200 * dt, -260); p.flight -= dt; if (Math.random() < 0.4) this.burst(p.x + p.w / 2, p.y + p.h * 0.5, 1, '#ffffff', 30, 30, 0.4, 2, true); }
    }
    // gravity
    if (!(p.hook && p.hook.state === 'hang')) {
      let g = inWater ? 450 : 1500; if (!J && p.vy < -200 && !inWater) g += 1800; p.vy += g * dt; p.vy = Math.min(p.vy, inWater ? 130 : 720);
    }
    // grapple pull
    if (p.hook && p.hook.state === 'hang') {
      const dx = p.hook.x - (p.x + p.w / 2), dy = p.hook.y - (p.y + p.h / 2), d = Math.hypot(dx, dy) || 1;
      if (d < 18) { p.hook = null; } else { p.vx = dx / d * 460; p.vy = dy / d * 460; }
    }
    const wasGround = p.onGround; const vyBefore = p.vy;
    moveBody(w, p, dt, { friendly: true, drop: D });
    if (p.x < 0) p.x = 0;
    if (!wasGround && !p.onGround) p.peakY = Math.min(p.peakY, p.y); else if (wasGround && !p.onGround) p.peakY = p.y;
    if (inWater || (p.hook)) p.peakY = p.y;
    if (p.onGround && !wasGround) {
      const fall = (p.y - p.peakY) / 16;
      if (fall > 25 && !st.noFall && !inWater) C.hurtPlayer(this, Math.round((fall - 25) * 9 * (this.mods.includes('glass') ? 1.25 : 1)), p.x, 'fall');
      if (vyBefore > 250) { audio.sfx('land'); this.burst(p.x + p.w / 2, p.y + p.h, 5, '#bbbbbb', 50, 120, 0.3, 1); }
      p.peakY = p.y;
    }
    if (p.onGround && Math.abs(p.vx) > 20) { p.walk += dt * Math.abs(p.vx) * 0.09; if (st.hermes && Math.random() < 0.3) this.burst(p.x + p.w / 2, p.y + p.h, 1, '#ffd0a0', 20, 20, 0.3, 1); } else if (!p.onGround) p.walk += dt * 2;
    this.stats.dist += Math.abs(p.vx) * dt / 16;
    // lava
    p.lavaT -= dt; if (inLava && !st.lava && p.lavaT <= 0) { C.hurtPlayer(this, 45, p.x, 'lava'); p.lavaT = 0.5; }
    if (inLava && st.lava) p.invT = Math.max(p.invT, 0.1);
    // timers
    p.invT = Math.max(0, p.invT - dt);
    for (const b in p.buffs) { p.buffs[b] -= dt; if (p.buffs[b] <= 0) { delete p.buffs[b]; this.recalcStats(); } }
    p.regenT += dt; if (p.regenT >= 1) { p.regenT = 0; if (p.hp < p.maxHp) { const r = 0.6 + st.regen + (p.vx === 0 ? 0.6 : 0); p.hp = Math.min(p.maxHp, p.hp + Math.max(1, Math.round(r + p.maxHp * 0.004))); } this.recalcStats(); }
    p.manaT += dt; if (p.manaT >= 0.2) { p.manaT = 0; if (p.mana < p.maxMana) p.mana = Math.min(p.maxMana, p.mana + 1 + Math.floor(p.maxMana / 40)); }
    if (p.recall > 0) { p.recall -= dt; if (Math.random() < 0.5) this.burst(p.x + p.w / 2, p.y + p.h / 2, 1, '#9fd3ff', 60, -40, 0.6, 2, true); if (p.recall <= 0) this.teleportHome(); }
    // depth
    const layer = w.layer(p.x / 16, p.y / 16); this.stats.maxDepth = Math.max(this.stats.maxDepth, Math.max(0, Math.floor(p.y / 16 - w.spawn.y)));
    if (layer === 4 && !this.flags.hell) { this.flags.hell = true; this.say('You have entered the Underworld...', '#ff8a5a', 6); audio.sfx('roar'); this.shake(6); }
    // hook update
    C.updateHook(this, dt);
    if (p.y > (w.H - 1) * 16) { p.y = (w.H - 4) * 16; }
  }
  teleportHome() {
    const p = this.player; this.burst(p.x + 6, p.y + 14, 25, '#9fd3ff', 100, 0, 0.8, 2, true);
    p.x = p.spawnX; p.y = p.spawnY; p.vx = 0; p.vy = 0; p.peakY = p.y; p.hook = null; this.cam.x = p.x; this.cam.y = p.y; audio.sfx('recall'); this.burst(p.x + 6, p.y + 14, 25, '#9fd3ff', 100, 0, 0.8, 2, true);
  }

  // ----- using items -----
  selItem() { const s = this.player.inv[this.player.sel]; return s ? ITEMS[s.id] : null; }
  handleUse(dt: number) {
    const p = this.player, m = this.mouse; p.useCd = Math.max(0, p.useCd - dt);
    if (p.swing) { p.swing.t += dt; if (p.swing.t >= p.swing.dur) p.swing = null; else if (p.swing.id !== '_mine') C.swingHit(this); }
    if (this.panel !== 'none' && this.panel !== 'inventory') { p.mine.prog = 0; return; }
    if (m.redge) this.interact();
    const d = this.selItem();
    if (!d || !m.down || d.kind !== 'pick') p.mine.prog = 0;
    if (!d) return; if (p.sleeping) return;
    switch (d.kind) {
      case 'pick': if (m.down) this.mineTick(dt, d); break;
      case 'block': case 'wall': if (m.down && p.useCd <= 0 && this.place(d)) p.useCd = 0.09; break;
      case 'sword': if (m.down && p.useCd <= 0) C.startSwing(this, d); break;
      case 'bow': case 'gun': if (m.down && p.useCd <= 0) C.shootRanged(this, d); break;
      case 'staff': if (m.down && p.useCd <= 0) C.castSpell(this, d); break;
      case 'throw': if (m.edge || (m.down && p.useCd <= 0 && d.fx !== 'purify')) C.throwItem(this, d); break;
      case 'potion': case 'use': case 'summon': case 'tool': if (m.edge) this.useConsumable(d); break;
    }
  }
  useConsumable(d: typeof ITEMS[string]) {
    const p = this.player;
    if (d.kind === 'potion') {
      if (d.heal) { if (p.buffs.sick > 0) { this.say('Potion Sickness! You must wait.', '#ff8080'); audio.sfx('error'); return; } if (p.hp >= p.maxHp) return; p.hp = Math.min(p.maxHp, p.hp + d.heal); p.buffs.sick = 25; this.ftext(p.x + 6, p.y - 8, `+${d.heal}`, '#6aff8a', 10); audio.sfx('heal'); this.burst(p.x + 6, p.y + 14, 10, '#ff6a8a', 50, -30, 0.7, 2, true); }
      else if (d.healMana) { if (p.mana >= p.maxMana) return; p.mana = Math.min(p.maxMana, p.mana + d.healMana); this.ftext(p.x + 6, p.y - 8, `+${d.healMana}`, '#6aa0ff', 10); audio.sfx('mana'); }
      else if (d.buff) { p.buffs[d.buff] = d.dur || 300; audio.sfx('drink'); this.say(`${ITEMS[d.id].name} active`, '#a0e0ff', 3); }
      this.consumeSel(); return;
    }
    if (d.kind === 'use') {
      if (d.fx === 'life') { if (p.maxHp >= 500) { this.say('Your life is at its maximum.', '#ff9090'); return; } p.maxHp += 20; p.hp += 20; this.ftext(p.x, p.y - 10, 'Max life +20', '#ff6a9a', 10); audio.sfx('level'); this.burst(p.x + 6, p.y + 14, 25, '#ff6a9a', 90, 0, 0.9, 2, true); this.shake(3); }
      else if (d.fx === 'mana') { if (p.maxMana >= 200) { this.say('Your mana is at its maximum.', '#9090ff'); return; } p.maxMana += 20; p.mana += 20; this.ftext(p.x, p.y - 10, 'Max mana +20', '#6aa0ff', 10); audio.sfx('level'); this.burst(p.x + 6, p.y + 14, 25, '#6aa0ff', 90, 0, 0.9, 2, true); }
      this.consumeSel(); return;
    }
    if (d.kind === 'summon') { if (C.useSummon(this, d)) this.consumeSel(); return; }
    if (d.kind === 'tool') { if (d.id === 'magic_mirror') { if (p.recall <= 0) { p.recall = 2.5; this.say('Gazing into the mirror...', '#9fd3ff', 2); audio.sfx('recall'); } } else if (d.id === 'grappling_hook') C.fireHook(this); }
  }
  quickHeal() {
    const p = this.player; if (p.hp >= p.maxHp) return; if (p.buffs.sick > 0) { this.say('Potion Sickness!', '#ff8080'); audio.sfx('error'); return; }
    let best: string | null = null; for (const s of p.inv) if (s && ITEMS[s.id].heal) { if (!best || (ITEMS[s.id].heal! > ITEMS[best].heal! && p.maxHp - p.hp > ITEMS[best].heal!)) best = s.id; }
    if (!best) { this.say('No healing potions.', '#ff8080'); audio.sfx('error'); return; }
    const d = ITEMS[best]; p.hp = Math.min(p.maxHp, p.hp + d.heal!); p.buffs.sick = 25; this.removeItem(best, 1); this.ftext(p.x + 6, p.y - 8, `+${d.heal}`, '#6aff8a', 10); audio.sfx('heal'); this.burst(p.x + 6, p.y + 14, 10, '#ff6a8a', 50, -30, 0.7, 2, true);
  }
  quickMana() {
    const p = this.player; if (p.mana >= p.maxMana) return; let best: string | null = null;
    for (const s of p.inv) if (s && ITEMS[s.id].healMana) { if (!best || ITEMS[s.id].healMana! < ITEMS[best].healMana!) best = s.id; }
    if (!best) { this.say('No mana potions.', '#8080ff'); audio.sfx('error'); return; }
    const d = ITEMS[best]; p.mana = Math.min(p.maxMana, p.mana + d.healMana!); this.removeItem(best, 1); this.ftext(p.x + 6, p.y - 8, `+${d.healMana}`, '#6aa0ff', 10); audio.sfx('mana');
  }

  reachOK(tx: number, ty: number, tiles: number): boolean { const p = this.player; return Math.hypot(tx * 16 + 8 - (p.x + p.w / 2), ty * 16 + 8 - (p.y + p.h / 2)) <= tiles * 16; }
  mineTick(dt: number, d: typeof ITEMS[string]) {
    const p = this.player, w = this.world, m = this.mouse; const tx = Math.floor(m.wx / 16), ty = Math.floor(m.wy / 16);
    if (!this.reachOK(tx, ty, 5.5)) { p.mine.prog = 0; return; }
    if (tx !== p.mine.x || ty !== p.mine.y) { p.mine.x = tx; p.mine.y = ty; p.mine.prog = 0; p.mine.warn = false; }
    const t = w.get(tx, ty); const td = TILES[t]; let hp: number, wall = false;
    if (t === T.AIR || td.liquid) { if (!w.wall(tx, ty)) return; hp = 30; wall = true; }
    else { if (td.pick > (d.power || 0)) { if (!p.mine.warn) { p.mine.warn = true; this.say(`${td.name} needs a stronger pickaxe!`, '#ff9a80', 3); audio.sfx('error'); } return; } hp = td.hp; }
    p.mine.prog += (d.power || 35) * 4 * p.st.mine * dt;
    if (!p.swing) p.swing = { t: 0, dur: 0.28, dir: p.dir, hits: new Set(), id: '_mine' };
    p.mine.snd -= dt;
    if (p.mine.snd <= 0) { p.mine.snd = 0.2; audio.sfx('dig_' + (wall ? 'stone' : td.snd)); this.burst(tx * 16 + 8, ty * 16 + 8, 3, wall ? WALLS[w.wall(tx, ty)].c : td.c, 40, 200, 0.4, 1); }
    if (p.mine.prog >= hp) { p.mine.prog = 0; if (wall) this.breakWall(tx, ty); else this.breakTile(tx, ty); }
  }
  breakWall(tx: number, ty: number) {
    const w = this.world, wl = w.wall(tx, ty); const it = WALLS[wl].item; w.setWall(tx, ty, 0);
    if (it) this.dropItem(tx * 16 + 8, ty * 16 + 8, it, 1); audio.sfx('break'); this.burst(tx * 16 + 8, ty * 16 + 8, 6, WALLS[wl].c, 60, 200, 0.5, 1);
  }
  breakTile(tx: number, ty: number, silent = false): boolean {
    const w = this.world; let t = w.get(tx, ty); const td = TILES[t]; if (t === T.AIR) return false;
    const cx = tx * 16 + 8, cy = ty * 16 + 8;
    if (t === T.CHEST) { const key = ty * w.W + tx; const ch = w.chests.get(key); if (ch && ch.some(Boolean)) { this.say('The chest must be empty first.', '#ff9a80', 3); audio.sfx('error'); return false; } w.chests.delete(key); if (this.chestKey === key) this.chestKey = null; }
    if (t === T.TRUNK) { this.chopTree(tx, ty); return true; }
    if (td.door) { if (w.get(tx, ty - 1) === T.DOOR) w.set(tx, ty - 1, T.AIR); if (w.get(tx, ty + 1) === T.DOOR) w.set(tx, ty + 1, T.AIR); }
    w.set(tx, ty, T.AIR);
    if (td.item) this.dropItem(cx, cy, td.item, 1);
    if (t === T.LEAVES && Math.random() < 0.07) this.dropItem(cx, cy, 'acorn', 1);
    if (t === T.CHEST) this.dropItem(cx, cy, 'chest', 1);
    this.stats.mined++;
    if (!silent) { audio.sfx(td.liquid ? 'splash' : 'break'); this.burst(cx, cy, 8, td.c, 70, 220, 0.5, 2); }
    this.settle(tx, ty); return true;
  }
  settle(tx: number, ty: number) {
    const w = this.world; const ta = w.get(tx, ty - 1); const d = TILES[ta];
    if (ta === T.TRUNK) { this.chopTree(tx, ty - 1); return; }
    if (ta === T.CACTUS) { let y = ty - 1; while (w.get(tx, y) === T.CACTUS) { w.set(tx, y, T.AIR); y--; } return; }
    if (d.sup && !d.solid && !d.door) { w.set(tx, ty - 1, T.AIR); if (d.item) this.dropItem(tx * 16 + 8, (ty - 1) * 16 + 8, d.item, 1); if (ta === T.CHEST) w.chests.delete((ty - 1) * w.W + tx); this.settle(tx, ty - 1); }
  }
  chopTree(tx: number, ty: number) {
    const w = this.world; let y = ty, n = 0;
    while (w.get(tx, y) === T.TRUNK) { w.set(tx, y, T.AIR); n++; y--; }
    const top = y + 1; const cx = tx * 16 + 8;
    for (let dy = -5; dy <= 3; dy++) for (let dx = -5; dx <= 5; dx++) { const lt = w.get(tx + dx, top + dy); if (lt === T.LEAVES || lt === T.LEAVES_SNOW || lt === T.LEAVES_BLIGHT) { w.set(tx + dx, top + dy, T.AIR); if (Math.random() < 0.025) this.dropItem((tx + dx) * 16 + 8, (top + dy) * 16 + 8, 'acorn', 1); } }
    this.dropItem(cx, ty * 16, 'wood', n); this.stats.mined++; audio.sfx('break'); this.burst(cx, ty * 16 - n * 8, 14, '#2f9a35', 80, 200, 0.8, 2); this.shake(1.5);
  }
  place(d: typeof ITEMS[string]): boolean {
    const p = this.player, w = this.world, m = this.mouse; const tx = Math.floor(m.wx / 16), ty = Math.floor(m.wy / 16);
    if (!this.reachOK(tx, ty, 6.5)) return false;
    const t = w.get(tx, ty); const solidN = (x: number, y: number) => { const dd = TILES[w.get(x, y)]; return dd.solid || dd.plat; };
    if (d.kind === 'wall') {
      if (TILES[t].solid || w.wall(tx, ty) === d.wall) return false;
      if (!(w.wall(tx - 1, ty) || w.wall(tx + 1, ty) || w.wall(tx, ty - 1) || w.wall(tx, ty + 1) || solidN(tx - 1, ty) || solidN(tx + 1, ty) || solidN(tx, ty - 1) || solidN(tx, ty + 1))) return false;
      w.setWall(tx, ty, d.wall!); this.consumeSel(); audio.sfx('place'); return true;
    }
    const tile = d.tile!; const nd = TILES[tile];
    if (!(t === T.AIR || TILES[t].liquid || t === T.TALLGRASS)) return false;
    if (nd.solid && px_overlap(p, tx, ty)) return false;
    for (const e of this.enemies) if (nd.solid && !e.dead && e.x < tx * 16 + 16 && e.x + e.w > tx * 16 && e.y < ty * 16 + 16 && e.y + e.h > ty * 16) return false;
    if (tile === T.SAPLING) { const b = w.get(tx, ty + 1); if (!(b === T.GRASS || b === T.JGRASS || b === T.BGRASS)) { this.say('Acorns need grass to grow.', '#ffe9a0', 2); return false; } }
    else if (tile === T.DOOR) { if (w.get(tx, ty - 1) !== T.AIR || !solidN(tx, ty + 1)) return false; w.set(tx, ty - 1, T.DOOR); }
    else if (tile === T.TORCH) { if (!(w.wall(tx, ty) || solidN(tx - 1, ty) || solidN(tx + 1, ty) || solidN(tx, ty + 1) || solidN(tx, ty - 1))) return false; }
    else if (nd.sup) { if (!solidN(tx, ty + 1)) return false; }
    else if (!(w.wall(tx, ty) || solidN(tx - 1, ty) || solidN(tx + 1, ty) || solidN(tx, ty - 1) || solidN(tx, ty + 1))) return false;
    w.set(tx, ty, tile);
    if (tile === T.CHEST) w.chests.set(ty * w.W + tx, Array(20).fill(null));
    this.stats.placed[tile] = (this.stats.placed[tile] || 0) + 1; this.consumeSel(); audio.sfx('place'); this.burst(tx * 16 + 8, ty * 16 + 8, 3, nd.c, 30, 100, 0.3, 1);
    return true;
  }
  interact() {
    const p = this.player, w = this.world, m = this.mouse; const tx = Math.floor(m.wx / 16), ty = Math.floor(m.wy / 16);
    for (const n of this.npcs) if (n.deadT <= 0 && m.wx > n.x - 4 && m.wx < n.x + n.w + 4 && m.wy > n.y - 4 && m.wy < n.y + n.h + 4 && Math.hypot(n.x - p.x, n.y - p.y) < 120) { N.talkTo(this, n); return; }
    if (!this.reachOK(tx, ty, 7)) return; const t = w.get(tx, ty);
    if (t === T.CHEST) { this.chestKey = ty * w.W + tx; this.stats.chests++; this.panel = 'inventory'; this.talk = null; audio.sfx('open'); this.ver++; this.cb.onChange && this.cb.onChange(); }
    else if (t === T.BED) {
      p.spawnX = tx * 16 + 2; p.spawnY = ty * 16 - 14; this.say('Spawn point set.', '#ffe9a0', 3); audio.sfx('bed');
      if (isNight(this.time)) { const near = this.enemies.some(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 400); if (near) this.say('You cannot sleep with enemies nearby!', '#ff9a80'); else { p.sleeping = true; p.vx = 0; this.say('Zzz... sleeping until dawn.', '#bcd0ff'); } }
    } else if (t === T.WORKBENCH || t === T.FURNACE || t === T.ANVIL || t === T.HELLFORGE || t === T.ARCANE) this.openPanel('inventory');
    else if (t === T.DOOR) audio.sfx('door');
  }

  // ----- world ambience -----
  updateDrops(dt: number) {
    const p = this.player, w = this.world;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.t += dt; d.delay -= dt;
      d.vy = Math.min(d.vy + 900 * dt, 400); moveBody(w, d, dt, { friendly: true, step: 0 }); if (d.onGround) d.vx *= 0.8;
      if (w.get(Math.floor((d.x + 4) / 16), Math.floor((d.y + 4) / 16)) === T.LAVA) { this.drops.splice(i, 1); this.burst(d.x, d.y, 4, '#ff8a30', 40, 50, 0.4, 1); continue; }
      if (d.star && daylight(this.time) > 0.85) { this.burst(d.x, d.y, 8, '#ffe060', 50, 20, 0.5, 2, true); this.drops.splice(i, 1); continue; }
      if (d.t > 400 && !d.star) { this.drops.splice(i, 1); continue; }
      if (p.dead) continue;
      const dx = p.x + p.w / 2 - (d.x + 4), dy = p.y + p.h / 2 - (d.y + 4), dist = Math.hypot(dx, dy);
      if (d.delay <= 0 && dist < 52 && this.roomFor(d.id, 1)) { const sp = 380 * (1 - dist / 60) + 120; d.vx += dx / (dist || 1) * sp * dt * 6; d.vy += dy / (dist || 1) * sp * dt * 6; d.vx *= 0.94; if (dist < 40) d.vy -= 400 * dt; }
      if (d.delay <= 0 && dist < 16 && this.roomFor(d.id, 1)) {
        const left = this.addItem(d.id, d.n, true); const got = d.n - left;
        if (got > 0) { this.stats.collected[d.id] = (this.stats.collected[d.id] || 0) + got; audio.sfx('pickup'); this.ftext(p.x + 6, p.y - 6, `+${got} ${ITEMS[d.id].name}`, '#fff8c0', 8); if (d.star) audio.sfx('star'); }
        if (left > 0) d.n = left; else this.drops.splice(i, 1);
      }
    }
  }
  updateFx(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) { const q = this.parts[i]; q.life -= dt; if (q.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; } q.vy += q.grav * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.99; }
    for (let i = this.texts.length - 1; i >= 0; i--) { const q = this.texts[i]; q.life -= dt; q.y += q.vy * dt; q.vy *= 0.94; if (q.life <= 0) this.texts.splice(i, 1); }
  }
  ambient(dt: number) {
    const t = this.timers, w = this.world, p = this.player; t.amb += dt;
    if (t.amb >= 1) {
      t.amb = 0;
      // blight spread
      const prob = w.hardmode ? 0.3 : 0.05; const W = w.W;
      for (let k = 0; k < 40; k++) {
        const x = 1 + Math.floor(Math.random() * (W - 2)), y = 40 + Math.floor(Math.random() * (HELL_TOP - 40)); const tt = w.tiles[y * W + x];
        if ((tt === T.EBON || tt === T.BGRASS) && Math.random() < prob) {
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]]; const [dx, dy] = dirs[Math.floor(Math.random() * 4)]; const n = w.get(x + dx, y + dy);
          if (n === T.STONE) w.set(x + dx, y + dy, T.EBON); else if (n === T.GRASS || n === T.JGRASS) w.set(x + dx, y + dy, T.BGRASS); else if (n === T.DIRT && w.get(x + dx, y + dy - 1) === T.AIR) w.set(x + dx, y + dy, T.BGRASS);
        }
      }
      // plants & saplings
      if (Math.random() < 0.5) {
        const x = Math.floor(p.x / 16) + Math.floor(Math.random() * 120 - 60); if (x > 2 && x < W - 2) { const s = w.surf[x]; const tt = w.get(x, s); if (w.get(x, s - 1) === T.AIR) { if (tt === T.GRASS && Math.random() < 0.15) w.set(x, s - 1, T.DAYBLOOM); else if (tt === T.SNOW && Math.random() < 0.15) w.set(x, s - 1, T.SHIVER); } }
      }
      const px = Math.floor(p.x / 16), py = Math.floor(p.y / 16);
      for (let y = py - 40; y < py + 40; y++) for (let x = px - 60; x < px + 60; x++) if (w.get(x, y) === T.SAPLING && Math.random() < 0.06) this.growTree(x, y);
    }
    // falling stars
    if (isNight(this.time)) {
      t.star -= dt;
      if (t.star <= 0) {
        t.star = (14 + Math.random() * 28) / (1 + 0.5 * (this.perks.starry || 0));
        const sx = p.x + (Math.random() - 0.5) * 900, sy = Math.max(-200, p.y - 520);
        this.projs.push({ x: sx, y: sy, vx: (Math.random() - 0.5) * 120, vy: 330, w: 8, h: 8, kind: 'fallstar', dmg: 0, friendly: true, life: 8, grav: 0, pierce: 0, kb: 0, hit: null, rot: 0, col: '#ffe060', t: 0, light: 0.9 });
      }
    }
  }
  growTree(x: number, y: number) {
    const w = this.world; const b = w.get(x, y + 1); if (!(b === T.GRASS || b === T.JGRASS || b === T.BGRASS)) return;
    const h = 5 + Math.floor(Math.random() * 5);
    for (let i = 1; i <= h + 3; i++) { const t = w.get(x, y - i); if (t !== T.AIR && t !== T.TALLGRASS && t !== T.LEAVES && t !== T.SAPLING) return; }
    for (let i = 0; i < h; i++) w.set(x, y - i, T.TRUNK);
    const leaf = b === T.BGRASS ? T.LEAVES_BLIGHT : T.LEAVES;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if ((dx * dx) / 9 + (dy * dy) / 9 <= 1.1 && w.get(x + dx, y - h + dy) === T.AIR) w.set(x + dx, y - h + dy, leaf);
    this.burst(x * 16 + 8, (y - h) * 16, 12, '#58d048', 60, 50, 0.8, 2, true);
  }
  updateAudio() {
    const p = this.player, w = this.world; let mood = 'day';
    const px = p.x / 16, py = p.y / 16; const layer = w.layer(px, py), b = w.biomeAt(px, py);
    if (this.boss && !this.boss.dead) mood = 'boss';
    else if (this.ev.blood || this.ev.goblin) mood = 'event';
    else if (layer === 4) mood = 'hell';
    else if (layer >= 2) mood = b === B.BLIGHT ? 'blight' : 'cave';
    else if (b === B.DESERT) mood = 'desert'; else if (b === B.TUNDRA) mood = 'snow'; else if (b === B.JUNGLE) mood = 'jungle'; else if (b === B.BLIGHT) mood = 'blight';
    else mood = isNight(this.time) ? 'night' : 'day';
    if (this.won) mood = 'victory';
    audio.setMood(mood);
    let near = 0; for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 320) near++;
    audio.setIntensity(Math.min(1, near / 6 + (1 - p.hp / p.maxHp) * 0.3 + (this.boss ? 0.4 : 0)));
  }

  // ----- death -----
  killPlayer(cause: string) {
    const p = this.player; if (p.dead) return;
    p.dead = true; p.hook = null; p.sleeping = false; this.stats.deaths++; this.deathCause = cause; audio.sfx('die'); this.shake(10);
    this.burst(p.x + 6, p.y + 14, 40, '#d03030', 140, 300, 1, 3);
    const loss = Math.floor(p.coins * this.diff.coinLoss); if (loss > 0) { p.coins -= loss; this.say(`You lost ${loss} copper...`, '#ffd070'); }
    this.respawnT = this.diff.respawn;
    if (this.diff.perma) { this.permaDead = true; store.deleteSlot(this.slot); }
    this.mouse.down = false; this.panel = 'none'; this.chestKey = null;
    if (this.boss && !this.boss.dead) C.bossFlee(this);
    const m = this.meta; m.totalKills += 0; store.saveMeta(m);
    this.cb.onDeath && this.cb.onDeath();
  }
  respawn() {
    const p = this.player; if (this.permaDead) return;
    p.dead = false; p.hp = p.maxHp; p.mana = p.maxMana; p.x = p.spawnX; p.y = p.spawnY; p.vx = p.vy = 0; p.invT = 3; p.buffs = {}; p.peakY = p.y; this.cam.x = p.x; this.cam.y = p.y;
    for (const e of this.enemies) if (!e.boss) e.dead = true;
    this.recalcStats(); this.save(); audio.sfx('heal');
  }

  // ----- minimap -----
  initMap() {
    const w = this.world; this.mapCanvas = document.createElement('canvas'); this.mapCanvas.width = w.W; this.mapCanvas.height = w.H; this.mapCtx = this.mapCanvas.getContext('2d')!;
    this.mapImg = this.mapCtx.createImageData(w.W, w.H);
    if (!this.revealed) this.revealed = new Uint8Array(w.W * w.H);
    for (let i = 0; i < w.W * w.H; i++) { if (this.revealed[i]) this.mapPixel(i); }
    this.mapCtx.putImageData(this.mapImg, 0, 0);
    w.onSet = (x: number, y: number) => { const i = y * w.W + x; if (this.revealed[i]) { this.mapPixel(i); this.mapDirty = true; } };
  }
  mapPixel(i: number) {
    const w = this.world, d = this.mapImg.data, t = w.tiles[i], x = i % w.W, y = (i / w.W) | 0; let c: number[];
    if (t) c = TCOL[t]; else if (w.walls[i]) c = WCOL[w.walls[i]]; else c = y < w.surf[x] ? [90, 150, 230] : [20, 18, 24];
    const o = i * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
  }
  revealAround(cx: number, cy: number, r: number) {
    const w = this.world;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r) continue; const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= w.W || y >= w.H) continue;
      const i = y * w.W + x; if (!this.revealed[i]) { this.revealed[i] = 1; this.mapPixel(i); this.mapDirty = true; }
    }
  }
  // ----- helpers for UI -----
  get hardmode() { return this.world.hardmode; }
  mkEnemy(id: string): Enemy | null { return ENEMIES[id] ? null : null; }
  rng() { return mulberry((this.seed ^ this.day * 7919) >>> 0); }
  hasFlag(f: string): boolean { return !!this.flags[f]; }
  worldPlay() { return this.stats.play; }
  get W() { return WW; } get H() { return WH; } get TS() { return TS; }
}

function px_overlap(p: Player, tx: number, ty: number) { return p.x < tx * 16 + 16 && p.x + p.w > tx * 16 && p.y < ty * 16 + 16 && p.y + p.h > ty * 16; }
