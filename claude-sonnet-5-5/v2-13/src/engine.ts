import {
  GW, GH, ENTRANCE, HEART, MAX_WAVES, STRUCTS, LAIRS, MONSTERS, ADVS, ADV_POOL, SPELLS, EDICTS, DIFFICULTIES, MODIFIERS,
  defaultMods, repTier,
} from './data';
import type { StructKind, MonsterType, AdvClass, SpellId, Mods, Difficulty } from './data';
import { sound } from './audio';

export type Tool = 'inspect' | 'dig' | 'fill' | StructKind;
export type Phase = 'prep' | 'raid' | 'result' | 'won' | 'lost';
type Pt = { x: number; y: number };

export interface Struct {
  kind: StructKind; x: number; y: number; level: number; cd: number; disabled: number; loot: number; hp: number; maxHp: number;
  flash: number; invested: number; monster: Monster | null; respawn: number; seed: number;
}
export interface Monster {
  id: number; type: MonsterType; x: number; y: number; hx: number; hy: number; hp: number; maxHp: number; dmg: number; atkCd: number;
  buffT: number; flash: number; lair: Struct; revived: boolean; bob: number; face: number; dead: boolean;
}
export interface Adv {
  id: number; cls: AdvClass; x: number; y: number; hp: number; maxHp: number; dmg: number; atkCd: number;
  slowT: number; weakT: number; stunT: number; poisonT: number; poisonDps: number; burnT: number; burnDps: number; flash: number;
  path: Pt[]; goalKey: string; pathVer: number; goalT: number; fleeing: boolean; stolen: number; carry: number; vet: number;
  shield: number; off: Pt; special: number; healCd: number; checked: Set<number>; enraged: boolean; face: number; bob: number;
  stuck: number; age: number; dead: boolean; gone: boolean; moving: boolean; dotT: number;
}
interface Proj { x: number; y: number; target: Adv | Monster | null; tx: number; ty: number; speed: number; dmg: number; side: 'adv' | 'mon'; color: string; aoe: number; kind: string; life: number; weak: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; size: number; grav: number }
interface FText { x: number; y: number; life: number; max: number; text: string; color: string; size: number }
interface Ring { x: number; y: number; r: number; max: number; life: number; maxLife: number; color: string }
interface Bolt { pts: Pt[]; life: number; color: string }

export interface LogEntry { id: number; text: string; color: string }
export interface SelInfo {
  kind: StructKind; name: string; icon: string; level: number; upCost: number; sellValue: number; lines: string[]; x: number; y: number; canUp: boolean;
}
export interface Snapshot {
  gold: number; mana: number; maxMana: number; regen: number; heart: number; maxHeart: number; rep: number; repTier: string; morale: number;
  wave: number; maxWaves: number; phase: Phase; speed: number; tool: Tool; paused: boolean; endless: boolean; enemiesLeft: number;
  sel: SelInfo | null; preview: { cls: AdvClass; n: number; vet: boolean }[]; previewBoss: AdvClass | null; vetCount: number;
  spells: { id: SpellId; cd: number; cdMax: number; cost: number; unlocked: boolean }[]; castMode: SpellId | null;
  log: LogEntry[]; edictChoices: string[]; owned: string[]; stats: Stats; notice: { id: number; text: string } | null;
  counts: { trap: number; lair: number; cache: number; well: number; mons: number }; connected: boolean; soulsPreview: number;
  bossWave: boolean; time: number; modsView: { label: string; value: string }[];
}
export interface Stats {
  kills: number; bossKills: number; escaped: number; goldEarned: number; goldLost: number; trapsFired: number; spells: number; digs: number;
  upgrades: number; monstersLost: number; heartDamage: number; built: number; wavesCleared: number; thievesStopped: number; time: number; peakRep: number;
  byClass: Record<string, number>;
}
export interface WaveSummary { wave: number; kills: number; escaped: number; heartLost: number; gold: number; bonus: number; repDelta: number; vets: number }
export type GameEvent =
  | { type: 'wave'; summary: WaveSummary }
  | { type: 'won' } | { type: 'lost' } | { type: 'autopause' } | { type: 'sel' };

export interface GameConfig {
  diffId: string; mods: string[]; levels: Record<string, number>; tutorial: boolean; shake: number;
}

const TRAP_KINDS: StructKind[] = ['spike', 'dart', 'flame', 'curse'];
const RANGED: AdvClass[] = ['cleric', 'mage', 'ranger', 'vexara'];
const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const hash = (x: number, y: number, k = 0) => {
  let h = (x * 73856093) ^ (y * 19349663) ^ (k * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  emit: (e: GameEvent) => void;
  cfg: GameConfig;
  diff: Difficulty;
  mods: Mods = defaultMods();
  modIds: Set<string>;
  levels: Record<string, number>;
  ts = 40;
  dpr = 1;
  grid = new Uint8Array(GW * GH);
  structs = new Map<number, Struct>();
  advs: Adv[] = [];
  mons: Monster[] = [];
  projs: Proj[] = [];
  parts: Particle[] = [];
  texts: FText[] = [];
  rings: Ring[] = [];
  bolts: Bolt[] = [];
  gold = 0; mana = 0; heart = 0; rep = 0; morale = 100;
  heartBonus = 0; maxManaBonus = 0;
  wave = 1; phase: Phase = 'prep'; speed = 1; paused = false; endless = false;
  tool: Tool = 'inspect';
  castMode: SpellId | null = null;
  spellCd: Record<SpellId, number> = { smite: 0, rally: 0, terrify: 0, cavein: 0 };
  selected: Struct | null = null;
  owned: string[] = [];
  edictChoices: string[] = [];
  vets: { cls: AdvClass; vet: number }[] = [];
  nextComp: { cls: AdvClass; vet: number }[] = [];
  spawnQ: { cls: AdvClass; vet: number; t: number }[] = [];
  waveT = 0;
  time = 0;
  shakeMag = 0;
  freeze = 0;
  flashRed = 0;
  flashWhite = 0;
  banner: { text: string; sub: string; t: number; color: string } | null = null;
  noticeObj: { id: number; text: string } | null = null;
  log: LogEntry[] = [];
  stats: Stats;
  waveStats = { kills: 0, escaped: 0, heartLost: 0, gold: 0 };
  banked = { souls: 0, kills: 0, bosses: 0 };
  mapVer = 1;
  route: Pt[] = [];
  routeVer = 0;
  mouse = { x: -1, y: -1, inside: false };
  dragging = false;
  lastTile = -1;
  uid = 1;
  logId = 1;
  raf = 0;
  lastT = 0;
  destroyed = false;
  victoryDone = false;
  private cleanup: (() => void)[] = [];
  private heartBeat = 0;
  private sfxHeartCd = 0;

  constructor(canvas: HTMLCanvasElement, cfg: GameConfig, emit: (e: GameEvent) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.cfg = cfg;
    this.emit = emit;
    this.levels = cfg.levels;
    this.diff = DIFFICULTIES.find((d) => d.id === cfg.diffId) || DIFFICULTIES[1];
    this.modIds = new Set(cfg.mods);
    this.stats = this.freshStats();
    this.reset();
    this.bindInput();
    this.lastT = performance.now();
    const loop = (t: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (t - this.lastT) / 1000));
      this.lastT = t;
      this.update(dt);
      this.draw();
    };
    this.raf = requestAnimationFrame(loop);
  }

  private freshStats(): Stats {
    return {
      kills: 0, bossKills: 0, escaped: 0, goldEarned: 0, goldLost: 0, trapsFired: 0, spells: 0, digs: 0, upgrades: 0, monstersLost: 0,
      heartDamage: 0, built: 0, wavesCleared: 0, thievesStopped: 0, time: 0, peakRep: 0, byClass: {},
    };
  }

  lv(id: string) { return this.levels[id] || 0; }
  unlocked(id?: string) { return !id || this.lv(id) > 0; }

  reset() {
    this.grid.fill(0);
    for (let x = 0; x < GW; x++) this.grid[ENTRANCE.y * GW + x] = 1;
    this.structs.clear();
    this.advs = []; this.mons = []; this.projs = []; this.parts = []; this.texts = []; this.rings = []; this.bolts = [];
    this.mods = defaultMods();
    this.heartBonus = 0; this.maxManaBonus = 0;
    this.gold = Math.round((250 + this.lv('purse') * 40) * this.diff.gold) + (this.cfg.tutorial ? 100 : 0);
    this.mana = this.maxMana();
    this.heart = this.maxHeart();
    this.rep = 0; this.morale = 100;
    this.wave = 1; this.phase = 'prep'; this.speed = 1; this.endless = false; this.victoryDone = false;
    this.owned = []; this.edictChoices = []; this.vets = [];
    this.spellCd = { smite: 0, rally: 0, terrify: 0, cavein: 0 };
    this.selected = null; this.tool = 'inspect'; this.castMode = null;
    this.stats = this.freshStats();
    this.log = [];
    this.banked = { souls: 0, kills: 0, bosses: 0 };
    this.waveStats = { kills: 0, escaped: 0, heartLost: 0, gold: 0 };
    this.mapVer++;
    this.prepareWave();
    this.say('The Dungeon awakens. Dig, build, and bait the heroes.', '#f4c453');
    sound.setMood('prep');
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.cleanup.forEach((f) => f());
    this.cleanup = [];
  }

  /* ───────────── derived stats ───────────── */
  maxMana() { return 100 + this.lv('mana') * 15 + this.maxManaBonus; }
  maxHeart() { return Math.round((200 + this.lv('heart') * 30) * this.diff.heart) + this.heartBonus; }
  regenRate() {
    let base = 2.5 * (this.modIds.has('drought') ? 0.6 : 1) + this.lv('mana') * 0.4 + this.mods.manaRegen;
    base *= this.diff.regen;
    let wells = 0;
    this.structs.forEach((s) => {
      if (s.kind === 'well' && s.disabled <= 0) wells += 1.4 * (1 + 0.4 * (s.level - 1));
    });
    return base + wells;
  }
  buildCost(kind: StructKind) { return Math.max(1, Math.round(STRUCTS[kind].cost * this.mods.buildCost * (this.phase === 'raid' ? 1.5 : 1))); }
  digCost() { return Math.max(1, Math.round(10 * (1 - 0.15 * this.lv('dig')) * this.mods.buildCost * (this.phase === 'raid' ? 1.5 : 1))); }
  upCost(s: Struct) { return Math.round(STRUCTS[s.kind].cost * 0.7 * s.level * this.mods.buildCost); }
  fullLoot(s: Struct) { return Math.round(50 * (1 + 0.5 * (s.level - 1)) * this.mods.cacheMul); }
  trapPow(s: Struct) { return (1 + 0.3 * (s.level - 1)) * this.mods.trapDmg * (1 + 0.08 * this.lv('trap')); }
  spellCost(id: SpellId) { return Math.round(SPELLS.find((s) => s.id === id)!.cost * this.mods.spellCost); }
  spellPow() { return this.mods.spellPow * (1 + 0.1 * this.lv('arcana')); }
  soulMult() {
    let m = 0;
    this.modIds.forEach((id) => { m += MODIFIERS.find((x) => x.id === id)?.souls || 0; });
    return this.diff.souls * (1 + m);
  }
  calcSouls() {
    const s = this.stats;
    const base = s.kills + s.wavesCleared * 8 + s.bossKills * 15 + (this.victoryDone ? 80 : 0);
    return Math.floor(base * this.soulMult());
  }
  bank() {
    const total = this.calcSouls();
    const d = { souls: total - this.banked.souls, kills: this.stats.kills - this.banked.kills, bosses: this.stats.bossKills - this.banked.bosses };
    this.banked = { souls: total, kills: this.stats.kills, bosses: this.stats.bossKills };
    return d;
  }

  /* ───────────── helpers ───────────── */
  idx(x: number, y: number) { return y * GW + x; }
  isFloor(x: number, y: number) { return x >= 0 && y >= 0 && x < GW && y < GH && this.grid[y * GW + x] === 1; }
  structAt(x: number, y: number) { return this.structs.get(y * GW + x) || null; }
  say(text: string, color = '#d9cfe8') {
    this.log.push({ id: this.logId++, text, color });
    if (this.log.length > 40) this.log.shift();
  }
  notify(text: string) {
    this.noticeObj = { id: this.uid++, text };
    sound.sfx('error');
  }
  shake(m: number) { this.shakeMag = Math.min(1.6, this.shakeMag + m); }
  setPaused(p: boolean) { this.paused = p; }
  setTool(t: Tool) {
    if (t !== 'inspect' && t !== 'dig' && t !== 'fill') {
      const def = STRUCTS[t];
      if (!this.unlocked(def.unlock)) { this.notify(`${def.name} is locked — unlock it in the Ledger.`); return; }
    }
    this.tool = t;
    this.castMode = null;
    if (t !== 'inspect') this.selected = null;
    sound.sfx('click');
  }
  setDifficulty(id: string) {
    const d = DIFFICULTIES.find((x) => x.id === id);
    if (!d || d === this.diff) return;
    const ratio = this.heart / Math.max(1, this.maxHeart());
    this.diff = d;
    if (this.phase !== 'lost') this.heart = Math.max(1, ratio * this.maxHeart());
    this.mana = Math.min(this.mana, this.maxMana());
    this.prepareWave();
    this.say(`Difficulty changed to ${d.name}.`, '#ffe9a8');
  }
  setSpeed(s: number) { this.speed = s; sound.sfx('click'); }
  cycleSpeed() { this.setSpeed(this.speed >= 3 ? 1 : this.speed + 1); }

  los(x0: number, y0: number, x1: number, y1: number) {
    const d = dist(x0, y0, x1, y1);
    const n = Math.ceil(d * 4);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!this.isFloor(Math.floor(x0 + (x1 - x0) * t), Math.floor(y0 + (y1 - y0) * t))) return false;
    }
    return true;
  }

  findPath(sx: number, sy: number, gx: number, gy: number): Pt[] | null {
    if (!this.isFloor(sx, sy) || !this.isFloor(gx, gy)) return null;
    const N = GW * GH;
    const dd = new Float32Array(N).fill(Infinity);
    const prev = new Int16Array(N).fill(-1);
    const done = new Uint8Array(N);
    const s = sy * GW + sx;
    const g = gy * GW + gx;
    dd[s] = 0;
    for (;;) {
      let u = -1;
      let b = Infinity;
      for (let i = 0; i < N; i++) if (!done[i] && dd[i] < b) { b = dd[i]; u = i; }
      if (u < 0 || u === g) break;
      done[u] = 1;
      const ux = u % GW;
      const uy = (u / GW) | 0;
      const nb = [[ux + 1, uy], [ux - 1, uy], [ux, uy + 1], [ux, uy - 1]];
      for (const [nx, ny] of nb) {
        if (!this.isFloor(nx, ny)) continue;
        const v = ny * GW + nx;
        const st = this.structs.get(v);
        const c = 1 + (st && st.kind === 'door' ? 6 : 0);
        if (dd[u] + c < dd[v]) { dd[v] = dd[u] + c; prev[v] = u; }
      }
    }
    if (dd[g] === Infinity) return null;
    const out: Pt[] = [];
    let c = g;
    while (c !== s && c >= 0) { out.push({ x: c % GW, y: (c / GW) | 0 }); c = prev[c]; }
    return out.reverse();
  }

  connected() { return this.findPath(ENTRANCE.x, ENTRANCE.y, HEART.x, HEART.y) !== null; }

  /* ───────────── player actions ───────────── */
  applyTool(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= GW || ty >= GH) return;
    const i = this.idx(tx, ty);
    const t = this.tool;
    const s = this.structs.get(i) || null;
    if (t === 'inspect') {
      this.selected = s;
      sound.sfx('click');
      this.emit({ type: 'sel' });
      return;
    }
    if (t === 'dig') {
      if (this.grid[i] === 1) return;
      const adj = this.isFloor(tx + 1, ty) || this.isFloor(tx - 1, ty) || this.isFloor(tx, ty + 1) || this.isFloor(tx, ty - 1);
      if (!adj) { this.notify('You can only dig next to existing tunnels.'); return; }
      const c = this.digCost();
      if (this.gold < c) { this.notify('Not enough gold to dig.'); return; }
      this.gold -= c;
      this.grid[i] = 1;
      this.mapVer++;
      this.stats.digs++;
      sound.sfx('dig');
      this.burst(tx + 0.5, ty + 0.5, '#8a7f9a', 10, 2.5, 0.5, 0.06, 4);
      this.text(tx + 0.5, ty + 0.3, `-${c}g`, '#f4c453', 0.26);
      return;
    }
    if (t === 'fill') {
      if (this.grid[i] !== 1) return;
      if ((tx === ENTRANCE.x && ty === ENTRANCE.y) || (tx === HEART.x && ty === HEART.y)) { this.notify('The entrance and the Heart cannot be sealed.'); return; }
      if (s) { this.notify('Remove the structure first (inspect → sell).'); return; }
      if (this.advs.some((a) => !a.dead && Math.floor(a.x) === tx && Math.floor(a.y) === ty) || this.mons.some((m) => Math.floor(m.x) === tx && Math.floor(m.y) === ty)) { this.notify('Something is standing there.'); return; }
      this.grid[i] = 0;
      if (!this.connected()) { this.grid[i] = 1; this.notify('That would cut the route to your Heart.'); return; }
      this.mapVer++;
      this.gold += 5;
      sound.sfx('dig');
      this.burst(tx + 0.5, ty + 0.5, '#8a7f9a', 8, 2, 0.4, 0.06, 4);
      return;
    }
    // build
    const def = STRUCTS[t];
    if (this.grid[i] !== 1) { this.notify('Dig a tunnel first — structures go on floor tiles.'); return; }
    if ((tx === ENTRANCE.x && ty === ENTRANCE.y) || (tx === HEART.x && ty === HEART.y)) { this.notify('Cannot build on the entrance or the Heart.'); return; }
    if (s) { this.selected = s; this.emit({ type: 'sel' }); this.notify('Tile occupied. Select it with Inspect to upgrade or sell.'); return; }
    if (!this.unlocked(def.unlock)) { this.notify('Locked — unlock it in the Ledger.'); return; }
    if (t === 'door' && this.advs.some((a) => !a.dead && Math.floor(a.x) === tx && Math.floor(a.y) === ty)) { this.notify('A hero is standing there.'); return; }
    const c = this.buildCost(t);
    if (this.gold < c) { this.notify(`Need ${c} gold for ${def.name}.`); return; }
    this.gold -= c;
    const ns: Struct = {
      kind: t, x: tx, y: ty, level: 1, cd: 0, disabled: 0, loot: 0, hp: 80, maxHp: 80, flash: 0.3, invested: c, monster: null, respawn: 0, seed: Math.random(),
    };
    if (t === 'cache') ns.loot = this.fullLoot(ns);
    this.structs.set(i, ns);
    this.stats.built++;
    this.mapVer++;
    sound.sfx('build');
    this.burst(tx + 0.5, ty + 0.5, def.color, 14, 3, 0.6, 0.07, 2);
    this.ring(tx + 0.5, ty + 0.5, 0.9, def.color, 0.4);
    this.text(tx + 0.5, ty + 0.3, `-${c}g`, '#f4c453', 0.26);
  }

  removeStruct(s: Struct, refund: boolean) {
    if (s.monster) { this.killMonster(s.monster, true); }
    this.structs.delete(this.idx(s.x, s.y));
    if (this.selected === s) this.selected = null;
    if (refund) {
      const v = Math.round(s.invested * 0.6);
      this.gold += v;
      this.text(s.x + 0.5, s.y + 0.3, `+${v}g`, '#f4c453', 0.26);
    }
    this.mapVer++;
  }

  sellSelected() {
    const s = this.selected;
    if (!s) return;
    this.removeStruct(s, true);
    sound.sfx('sell');
    this.burst(s.x + 0.5, s.y + 0.5, '#f4c453', 10, 2.5, 0.5, 0.06, 2);
    this.emit({ type: 'sel' });
  }

  upgradeSelected() {
    const s = this.selected;
    if (!s) return;
    if (s.level >= 3) { this.notify('Already at maximum level.'); return; }
    const c = this.upCost(s);
    if (this.gold < c) { this.notify(`Need ${c} gold to upgrade.`); return; }
    this.gold -= c;
    s.invested += c;
    s.level++;
    s.flash = 0.5;
    this.stats.upgrades++;
    if (s.kind === 'cache') s.loot = this.fullLoot(s);
    if (s.kind === 'door') { s.maxHp = 80 * s.level; s.hp = s.maxHp; }
    if (s.monster) {
      const m = s.monster;
      const r = m.hp / m.maxHp;
      this.initMonStats(m, s);
      m.hp = m.maxHp * r;
    }
    sound.sfx('upgrade');
    this.ring(s.x + 0.5, s.y + 0.5, 1.2, '#ffe9a8', 0.5);
    this.burst(s.x + 0.5, s.y + 0.5, '#ffe9a8', 16, 3, 0.7, 0.07, -1);
    this.text(s.x + 0.5, s.y + 0.2, `Level ${s.level}!`, '#ffe9a8', 0.3);
  }

  startWave() {
    if (this.phase !== 'prep') return;
    if (!this.connected()) { this.notify('The path to your Heart is blocked!'); return; }
    // restock caches
    let cost = 0;
    this.structs.forEach((s) => {
      if (s.kind === 'cache') {
        const full = this.fullLoot(s);
        if (s.loot < full) {
          const c = Math.round((full - s.loot) * 0.5);
          if (this.gold >= c) { this.gold -= c; cost += c; s.loot = full; }
        }
      }
    });
    if (cost > 0) this.say(`Caches restocked for ${cost}g.`, '#f4c453');
    this.phase = 'raid';
    this.waveT = 0;
    this.time += 0;
    this.waveStats = { kills: 0, escaped: 0, heartLost: 0, gold: 0 };
    this.morale = Math.max(55, 100 - this.rep * 0.25);
    const n = this.wave;
    const interval = Math.max(0.7, 1.4 - n * 0.05);
    const list = this.nextComp.slice();
    this.vets = [];
    this.spawnQ = list.map((c, i) => ({ ...c, t: 1 + i * interval }));
    const boss = this.nextComp.some((c) => ADVS[c.cls].boss);
    this.banner = { text: boss ? `Wave ${n} — BOSS` : `Wave ${n}`, sub: boss ? 'A champion approaches!' : 'The heroes descend…', t: 2.4, color: boss ? '#ff6b6b' : '#f4c453' };
    sound.sfx(boss ? 'boss' : 'wave');
    sound.setMood(boss ? 'boss' : 'raid');
    this.say(`Wave ${n} begins: ${list.length} heroes enter.`, '#ff9fb0');
    this.selected = null;
    this.emit({ type: 'sel' });
  }

  cancel(): boolean {
    if (this.castMode) { this.castMode = null; return true; }
    if (this.tool !== 'inspect') { this.tool = 'inspect'; return true; }
    if (this.selected) { this.selected = null; this.emit({ type: 'sel' }); return true; }
    return false;
  }

  beginCast(id: SpellId) {
    const def = SPELLS.find((s) => s.id === id)!;
    if (!this.unlocked(def.unlock)) { this.notify(`${def.name} is locked — unlock it in the Ledger.`); return; }
    if (this.phase !== 'raid') { this.notify('Spells can only be cast during a raid.'); return; }
    this.castMode = this.castMode === id ? null : id;
    sound.sfx('click');
  }

  cast(id: SpellId, tx: number, ty: number) {
    const def = SPELLS.find((s) => s.id === id)!;
    if (this.phase !== 'raid') { this.castMode = null; return; }
    if (this.spellCd[id] > 0) { this.notify(`${def.name} is recharging.`); return; }
    const cost = this.spellCost(id);
    if (this.mana < cost) { this.notify(`Need ${cost} mana.`); return; }
    this.mana -= cost;
    this.spellCd[id] = def.cd;
    this.stats.spells++;
    const pow = this.spellPow();
    const r = def.radius;
    sound.sfx(id);
    this.ring(tx, ty, r, def.color, 0.5);
    this.flashWhite = Math.max(this.flashWhite, 0.25);
    if (id === 'smite') {
      const pts: Pt[] = [];
      let cx = tx + rnd(-0.6, 0.6);
      for (let y = -0.5; y < ty; y += 0.35) { pts.push({ x: cx, y }); cx += rnd(-0.25, 0.25); }
      pts.push({ x: tx, y: ty });
      this.bolts.push({ pts, life: 0.3, color: '#fff7a8' });
      this.advs.forEach((a) => { if (!a.dead && dist(a.x, a.y, tx, ty) <= r) this.hurtAdv(a, 55 * pow, 'spell'); });
      this.burst(tx, ty, '#ffe86b', 24, 5, 0.6, 0.07, 3);
      this.shake(0.5);
    } else if (id === 'rally') {
      this.mons.forEach((m) => {
        if (dist(m.x, m.y, tx, ty) <= r) {
          m.buffT = 6 * pow;
          m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.25);
          this.text(m.x, m.y - 0.5, 'Frenzy!', '#ff7b8c', 0.26);
          this.burst(m.x, m.y, '#ff5b6e', 8, 2.5, 0.6, 0.05, -2);
        }
      });
      this.shake(0.25);
    } else if (id === 'terrify') {
      let hit = 0;
      this.advs.forEach((a) => {
        if (!a.dead && dist(a.x, a.y, tx, ty) <= r) { a.slowT = Math.max(a.slowT, 4); hit++; this.text(a.x, a.y - 0.5, '😱', '#fff', 0.34); }
      });
      if (hit > 0) this.moraleHit(14 * pow);
      this.burst(tx, ty, '#b46bff', 22, 3, 0.8, 0.06, -1);
    } else if (id === 'cavein') {
      this.advs.forEach((a) => {
        if (!a.dead && dist(a.x, a.y, tx, ty) <= r) { this.hurtAdv(a, 45 * pow, 'spell'); a.stunT = Math.max(a.stunT, 3); }
      });
      this.burst(tx, ty, '#c9a36b', 34, 5, 0.9, 0.09, 8);
      this.shake(0.9);
    }
    this.castMode = null;
  }

  pickEdict(id: string) {
    if (this.phase !== 'result') return;
    const e = EDICTS.find((x) => x.id === id);
    if (!e) return;
    e.apply(this.mods, {
      gold: (n) => { this.gold += n; },
      heart: (max, heal) => { this.heartBonus += max; this.heart = Math.min(this.maxHeart(), this.heart + heal); },
      mana: (max, fill) => { this.maxManaBonus += max; if (fill) this.mana = this.maxMana(); },
      rep: (n) => { this.rep = Math.max(0, Math.min(100, this.rep + n)); },
      refreshCaches: () => { this.structs.forEach((s) => { if (s.kind === 'cache') s.loot = this.fullLoot(s); }); },
    });
    this.owned.push(id);
    sound.sfx('edict');
    this.say(`Edict enacted: ${e.name}.`, '#ffe9a8');
    this.nextWave();
  }

  nextWave() {
    this.wave++;
    this.phase = 'prep';
    this.edictChoices = [];
    this.prepareWave();
    sound.setMood('prep');
  }

  continueEndless() {
    if (this.phase !== 'won') return;
    this.endless = true;
    this.chooseEdicts();
    this.phase = 'result';
  }

  prepareWave() {
    this.nextComp = this.compose(this.wave);
  }

  chooseEdicts() {
    const pool = EDICTS.filter((e) => !this.owned.includes(e.id));
    const out: string[] = [];
    const p = pool.slice();
    while (out.length < 3 && p.length) out.push(p.splice(Math.floor(Math.random() * p.length), 1)[0].id);
    this.edictChoices = out;
  }

  compose(n: number): { cls: AdvClass; vet: number }[] {
    let count = Math.round((3 + n * 0.85) * this.diff.count) + Math.floor(this.rep / 30);
    const isBoss = n % 4 === 0;
    const bosses: AdvClass[] = ['aldric', 'vexara', 'hero'];
    const boss = isBoss ? bosses[(n / 4 - 1) % 3] : null;
    if (isBoss) count = Math.max(2, Math.round(count * 0.6));
    const pool = ADV_POOL.filter((c) => ADVS[c].minWave <= n + (this.rep >= 60 ? 2 : 0));
    const greedy = this.modIds.has('greedy');
    const weights = pool.map((c) => ADVS[c].weight * (c === 'thief' && greedy ? 2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const list: { cls: AdvClass; vet: number }[] = [];
    for (let i = 0; i < count; i++) {
      if (n === 1 && i === 0) { list.push({ cls: 'warrior', vet: 0 }); continue; }
      let r = Math.random() * total;
      let pick = pool[0];
      for (let k = 0; k < pool.length; k++) { r -= weights[k]; if (r <= 0) { pick = pool[k]; break; } }
      list.push({ cls: pick, vet: 0 });
    }
    if (n >= 2 && !list.some((c) => c.cls === 'thief') && list.length > 2 && (greedy || Math.random() < 0.7)) list[list.length - 1] = { cls: 'thief', vet: 0 };
    this.vets.slice(0, 6).forEach((v) => list.push({ ...v }));
    if (boss) list.splice(Math.floor(list.length * 0.6), 0, { cls: boss, vet: 0 });
    return list;
  }

  /* ───────────── input ───────────── */
  tileFromEvent(e: PointerEvent | MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * GW, y: ((e.clientY - r.top) / r.height) * GH };
  }

  bindInput() {
    const c = this.canvas;
    const down = (e: PointerEvent) => {
      sound.init();
      const p = this.tileFromEvent(e);
      this.mouse = { x: p.x, y: p.y, inside: true };
      if (this.paused || this.phase === 'result' || this.phase === 'won' || this.phase === 'lost') return;
      if (e.button === 2) { this.cancel(); return; }
      if (this.castMode) { this.cast(this.castMode, p.x, p.y); return; }
      this.dragging = true;
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      this.lastTile = ty * GW + tx;
      this.applyTool(tx, ty);
      try { c.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    };
    const move = (e: PointerEvent) => {
      const p = this.tileFromEvent(e);
      this.mouse = { x: p.x, y: p.y, inside: true };
      if (this.dragging && !this.paused && !this.castMode && this.tool !== 'inspect') {
        const tx = Math.floor(p.x);
        const ty = Math.floor(p.y);
        const k = ty * GW + tx;
        if (k !== this.lastTile) { this.lastTile = k; this.applyTool(tx, ty); }
      }
    };
    const up = () => { this.dragging = false; this.lastTile = -1; };
    const leave = () => { this.mouse.inside = false; };
    const ctxm = (e: Event) => e.preventDefault();
    const vis = () => { if (document.hidden) this.emit({ type: 'autopause' }); };
    const blur = () => this.emit({ type: 'autopause' });
    c.addEventListener('pointerdown', down);
    c.addEventListener('pointermove', move);
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', leave);
    c.addEventListener('contextmenu', ctxm);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', blur);
    this.cleanup.push(() => {
      c.removeEventListener('pointerdown', down);
      c.removeEventListener('pointermove', move);
      c.removeEventListener('pointerup', up);
      c.removeEventListener('pointercancel', up);
      c.removeEventListener('pointerleave', leave);
      c.removeEventListener('contextmenu', ctxm);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', blur);
    });
  }

  handleKey(key: string): boolean {
    if (this.phase === 'result' || this.phase === 'won' || this.phase === 'lost') return false;
    const k = key.toLowerCase();
    if (k === ' ' || k === 'enter') { if (this.phase === 'prep') this.startWave(); return true; }
    if (k === 'x') { this.cycleSpeed(); return true; }
    const sp = SPELLS.find((s) => s.key === k);
    if (sp) { this.beginCast(sp.id); return true; }
    if (k === 'd') { this.setTool('dig'); return true; }
    if (k === 'f') { this.setTool('fill'); return true; }
    if (k === 'v') { this.setTool('inspect'); return true; }
    if (k === 'u') { this.upgradeSelected(); return true; }
    if (k === 'delete' || k === 'backspace') { this.sellSelected(); return true; }
    const st = (Object.keys(STRUCTS) as StructKind[]).find((id) => STRUCTS[id].key === k);
    if (st) { this.setTool(st); return true; }
    return false;
  }

  resize(cw: number, ch: number) {
    const ts = Math.max(16, Math.floor(Math.min(cw / GW, ch / GH)));
    this.ts = ts;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(ts * GW * this.dpr);
    this.canvas.height = Math.floor(ts * GH * this.dpr);
    this.canvas.style.width = `${ts * GW}px`;
    this.canvas.style.height = `${ts * GH}px`;
  }

  /* ───────────── fx helpers ───────────── */
  burst(x: number, y: number, color: string, n: number, speed: number, life: number, size: number, grav = 0) {
    for (let i = 0; i < n && this.parts.length < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rnd(0.2, 1) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.5, 1) * life, max: life, color, size: size * rnd(0.6, 1.3), grav });
    }
  }
  text(x: number, y: number, text: string, color: string, size = 0.3) {
    if (this.texts.length > 70) this.texts.shift();
    this.texts.push({ x: x + rnd(-0.12, 0.12), y, life: 1, max: 1, text, color, size });
  }
  ring(x: number, y: number, r: number, color: string, life: number) {
    this.rings.push({ x, y, r: 0, max: r, life, maxLife: life, color });
  }

  /* ───────────── simulation ───────────── */
  update(dt: number) {
    if (this.paused) return;
    // fx always run (but not when paused)
    this.fxUpdate(dt);
    if (this.phase === 'result' || this.phase === 'won' || this.phase === 'lost') return;
    let step = dt * (this.phase === 'raid' ? this.speed : 1);
    if (this.freeze > 0) { this.freeze -= dt; step *= 0.12; }
    while (step > 0) {
      const s = Math.min(step, 0.05);
      this.sim(s);
      step -= s;
      if (this.phase !== 'raid' && this.phase !== 'prep') break;
    }
  }

  fxUpdate(dt: number) {
    this.shakeMag = Math.max(0, this.shakeMag - dt * 2.2);
    this.flashRed = Math.max(0, this.flashRed - dt * 1.6);
    this.flashWhite = Math.max(0, this.flashWhite - dt * 2.5);
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt * 1.1;
      t.y -= dt * 0.55;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - r.life / r.maxLife;
      r.r = r.max * (1 - Math.pow(1 - Math.min(1, k), 3));
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
    for (const k of Object.keys(this.spellCd) as SpellId[]) if (this.spellCd[k] > 0) this.spellCd[k] = Math.max(0, this.spellCd[k] - dt * (this.phase === 'raid' ? this.speed : 1));
  }

  sim(dt: number) {
    this.stats.time += dt;
    this.heartBeat += dt * (1 + (1 - this.heart / Math.max(1, this.maxHeart())) * 2);
    this.sfxHeartCd -= dt;
    this.mana = Math.min(this.maxMana(), this.mana + this.regenRate() * dt);
    // structures
    this.structs.forEach((s) => {
      s.cd = Math.max(0, s.cd - dt);
      s.disabled = Math.max(0, s.disabled - dt);
      s.flash = Math.max(0, s.flash - dt);
      if (s.kind === 'door' && this.phase !== 'raid') s.hp = Math.min(s.maxHp, s.hp + 40 * dt);
      if (LAIRS.includes(s.kind)) this.updateLair(s, dt);
      if (s.kind === 'altar' && s.disabled <= 0) {
        for (const m of this.mons) if (dist(m.x, m.y, s.x + 0.5, s.y + 0.5) <= 2.2 && m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + 5 * s.level * dt);
      }
    });
    for (const m of this.mons) this.updateMon(m, dt);
    if (this.phase === 'raid') this.raidStep(dt);
    this.mons = this.mons.filter((m) => !m.dead);
  }

  updateLair(s: Struct, dt: number) {
    if (s.monster) return;
    s.respawn -= dt * (this.phase === 'raid' ? 1 : 4);
    if (s.respawn > 0 || s.disabled > 0) return;
    const cost = STRUCTS[s.kind].mana * this.mods.lairMana;
    if (this.mana < cost) return;
    this.mana -= cost;
    const m: Monster = {
      id: this.uid++, type: s.kind as MonsterType, x: s.x + 0.5, y: s.y + 0.5, hx: s.x + 0.5, hy: s.y + 0.5, hp: 1, maxHp: 1, dmg: 1, atkCd: 0.5,
      buffT: 0, flash: 0, lair: s, revived: false, bob: Math.random() * 6, face: 1, dead: false,
    };
    this.initMonStats(m, s);
    m.hp = m.maxHp;
    s.monster = m;
    this.mons.push(m);
    sound.sfx('spawn');
    this.burst(m.x, m.y, STRUCTS[s.kind].color, 10, 2, 0.5, 0.05, -1);
  }

  initMonStats(m: Monster, s: Struct) {
    const d = MONSTERS[m.type];
    const beast = 1 + 0.08 * this.lv('beast');
    const lvl = s.level - 1;
    m.maxHp = d.hp * (1 + 0.35 * lvl) * beast * this.mods.monHp;
    m.dmg = d.dmg * (1 + 0.25 * lvl) * beast * this.mods.monDmg;
  }

  killMonster(m: Monster, silent = false) {
    if (m.dead) return;
    if (!silent && m.type === 'skeleton' && !m.revived) {
      m.revived = true;
      m.hp = m.maxHp * 0.4;
      this.text(m.x, m.y - 0.5, 'Rattle!', '#e8e2d0', 0.28);
      this.burst(m.x, m.y, '#e8e2d0', 12, 3, 0.6, 0.06, 4);
      return;
    }
    m.dead = true;
    if (m.lair.monster === m) {
      m.lair.monster = null;
      m.lair.respawn = 16 * this.mods.respawn;
    }
    if (!silent) {
      this.stats.monstersLost++;
      sound.sfx('mdeath');
      this.burst(m.x, m.y, MONSTERS[m.type].color, 16, 3.5, 0.7, 0.07, 4);
      this.say(`Your ${MONSTERS[m.type].name} was slain.`, '#9c8fb5');
    }
  }

  updateMon(m: Monster, dt: number) {
    if (m.dead) return;
    const d = MONSTERS[m.type];
    m.atkCd -= dt;
    m.flash -= dt;
    m.bob += dt;
    if (m.buffT > 0) m.buffT -= dt;
    const buff = m.buffT > 0 ? 1.4 : 1;
    let target: Adv | null = null;
    if (this.phase === 'raid') {
      const aggro = d.ranged ? d.range + 0.8 : 2.6;
      let best = aggro;
      if (dist(m.x, m.y, m.hx, m.hy) <= 3.6) {
        for (const a of this.advs) {
          if (a.dead || a.gone) continue;
          const dd = dist(m.x, m.y, a.x, a.y);
          if (dd < best && (dd < 1.2 || this.los(m.x, m.y, a.x, a.y))) { best = dd; target = a; }
        }
      }
    }
    if (target) {
      const dd = dist(m.x, m.y, target.x, target.y);
      m.face = target.x >= m.x ? 1 : -1;
      if (dd <= d.range) {
        if (m.atkCd <= 0) {
          m.atkCd = d.cd / (m.buffT > 0 ? 1.4 : 1);
          this.monAttack(m, target, buff);
        }
      } else {
        this.moveEnt(m, target.x, target.y, d.speed * buff * dt, false);
      }
    } else {
      const dd = dist(m.x, m.y, m.hx, m.hy);
      if (dd > 0.06) this.moveEnt(m, m.hx, m.hy, d.speed * dt, false);
    }
  }

  monAttack(m: Monster, a: Adv, buff: number) {
    const d = MONSTERS[m.type];
    const dmg = m.dmg * buff;
    if (d.ranged) {
      this.projs.push({ x: m.x, y: m.y - 0.1, target: a, tx: a.x, ty: a.y, speed: 7, dmg, side: 'mon', color: '#ff7a3d', aoe: 0, kind: 'fire', life: 3, weak: false });
      sound.sfx('fire');
      return;
    }
    this.hurtAdv(a, dmg, 'monster');
    if (m.type === 'slime') a.slowT = Math.max(a.slowT, 1.5);
    if (m.type === 'wraith') { this.moraleHit(1.8); this.burst(a.x, a.y, '#8fd3ff', 5, 1.5, 0.5, 0.05, -2); }
    if (m.type === 'golem') this.shake(0.12);
    this.burst(a.x, a.y, '#ff4d6d', 4, 2, 0.35, 0.05, 3);
  }

  moveEnt(e: { x: number; y: number; face?: number }, tx: number, ty: number, step: number, isAdv: boolean) {
    const dx = tx - e.x;
    const dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-5 || step <= 0) return;
    const s = Math.min(step, d);
    const nx = e.x + (dx / d) * s;
    const ny = e.y + (dy / d) * s;
    if (this.walkable(nx, ny, isAdv)) { e.x = nx; e.y = ny; }
    else if (this.walkable(nx, e.y, isAdv)) e.x = nx;
    else if (this.walkable(e.x, ny, isAdv)) e.y = ny;
    if (Math.abs(dx) > 0.02) e.face = dx > 0 ? 1 : -1;
  }

  walkable(x: number, y: number, isAdv: boolean) {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (!this.isFloor(tx, ty)) return false;
    if (isAdv) {
      const s = this.structs.get(ty * GW + tx);
      if (s && s.kind === 'door' && s.hp > 0) return false;
    }
    return true;
  }

  moraleHit(n: number) {
    let v = n * this.mods.moraleLoss;
    if (this.modIds.has('zealots')) v *= 0.5;
    if (this.advs.some((a) => !a.dead && !a.fleeing && (a.cls === 'paladin' || ADVS[a.cls].boss))) v *= 0.7;
    this.morale = Math.max(0, this.morale - v);
  }

  hurtAdv(a: Adv, dmg: number, src: string, silent = false) {
    if (a.dead || a.gone) return;
    if (src === 'trap' && a.cls === 'paladin') dmg *= 0.6;
    if (a.shield > 0) { const ab = Math.min(a.shield, dmg); a.shield -= ab; dmg -= ab; }
    a.hp -= dmg;
    a.flash = 0.12;
    if (!silent && dmg > 0.5) {
      this.text(a.x, a.y - 0.45, `${Math.round(dmg)}`, src === 'spell' ? '#ffe86b' : src === 'trap' ? '#ffa94d' : '#ff6b81', src === 'spell' ? 0.34 : 0.27);
      sound.sfx('hit');
    }
    if (a.hp <= 0) this.killAdv(a);
  }

  killAdv(a: Adv) {
    if (a.dead) return;
    a.dead = true;
    const d = ADVS[a.cls];
    const st = this.stats;
    st.kills++;
    this.waveStats.kills++;
    st.byClass[a.cls] = (st.byClass[a.cls] || 0) + 1;
    const bounty = Math.round(a.carry * this.mods.bounty * (1 + this.rep * 0.004));
    const back = a.stolen;
    this.gold += bounty + back;
    st.goldEarned += bounty + back;
    this.waveStats.gold += bounty + back;
    if (a.stolen > 0) { st.thievesStopped++; this.say(`${d.name} slain — ${back}g of loot recovered!`, '#f4c453'); }
    this.text(a.x, a.y - 0.2, `+${bounty + back}g`, '#f4c453', 0.3);
    this.burst(a.x, a.y, '#f4c453', 8 + Math.min(10, (bounty + back) / 8), 3.5, 0.8, 0.06, 5);
    this.burst(a.x, a.y, d.color, 14, 3, 0.7, 0.07, 3);
    this.mana = Math.min(this.maxMana(), this.mana + this.mods.manaPerKill);
    this.addRep(d.boss ? 8 : a.cls === 'thief' ? 1.5 : 1);
    this.moraleHit(d.boss ? 25 : 9);
    sound.sfx('death');
    if (back > 0 || bounty > 5) sound.sfx('coin');
    if (d.boss) {
      st.bossKills++;
      this.shake(1.2);
      this.freeze = 0.5;
      this.flashWhite = 0.6;
      this.ring(a.x, a.y, 3, '#ffd24a', 0.8);
      this.say(`${d.name} has FALLEN!`, '#ffd24a');
    }
  }

  addRep(n: number) {
    this.rep = Math.max(0, Math.min(100, this.rep + n));
    this.stats.peakRep = Math.max(this.stats.peakRep, this.rep);
  }

  /* ───────────── raid ───────────── */
  spawnAdv(q: { cls: AdvClass; vet: number }) {
    const d = ADVS[q.cls];
    const n = this.wave;
    const iron = this.modIds.has('iron') ? 1.35 : 1;
    const sc = d.boss ? (1 + 0.04 * (n - 1)) * this.diff.hp * iron : (1 + 0.11 * (n - 1)) * this.diff.hp * iron * (1 + this.rep * 0.003);
    const vetMul = 1 + 0.2 * q.vet;
    const hp = d.hp * sc * vetMul;
    const dmgSc = (1 + 0.05 * (n - 1)) * vetMul;
    const greedy = this.modIds.has('greedy');
    const carry = (d.boss ? d.carry * 4 : (6 + n * 1.5) * d.carry) * (greedy ? 1.5 : 1);
    const a: Adv = {
      id: this.uid++, cls: q.cls, x: ENTRANCE.x + 0.3, y: ENTRANCE.y + 0.5, hp, maxHp: hp, dmg: d.dmg * dmgSc, atkCd: 0.5,
      slowT: 0, weakT: 0, stunT: 0, poisonT: 0, poisonDps: 0, burnT: 0, burnDps: 0, flash: 0, path: [], goalKey: '', pathVer: -1, goalT: 0,
      fleeing: false, stolen: 0, carry: Math.round(carry), vet: q.vet, shield: 0, off: { x: rnd(-0.16, 0.16), y: rnd(-0.16, 0.16) },
      special: d.boss ? 4 : 0, healCd: 1, checked: new Set(), enraged: false, face: 1, bob: Math.random() * 6, stuck: 0, age: 0,
      dead: false, gone: false, moving: false, dotT: 0,
    };
    this.advs.push(a);
    this.burst(a.x, a.y, d.color, 8, 2, 0.5, 0.05, -1);
    if (d.boss) { this.say(`${d.name} enters the dungeon!`, '#ff6b6b'); this.shake(0.5); }
  }

  raidStep(dt: number) {
    this.waveT += dt;
    while (this.spawnQ.length && this.spawnQ[0].t <= this.waveT) this.spawnAdv(this.spawnQ.shift()!);
    // morale regen
    const cleric = this.advs.some((a) => !a.dead && a.cls === 'cleric');
    this.morale = Math.min(100, this.morale + (0.35 + (cleric ? 0.5 : 0)) * dt);
    for (const a of this.advs) this.updateAdv(a, dt);
    // projectiles
    this.updateProjs(dt);
    // heart thorns
    const thorn = this.lv('pulse') * 4 + this.mods.thorns;
    const hx = HEART.x + 0.5;
    const hy = HEART.y + 0.5;
    if (thorn > 0) {
      for (const a of this.advs) {
        if (!a.dead && dist(a.x, a.y, hx, hy) <= 2.2) {
          this.hurtAdv(a, thorn * dt, 'heart', true);
          if (Math.random() < dt * 6) this.burst(a.x, a.y, '#ff4d8d', 1, 1.5, 0.4, 0.05, 0);
        }
      }
    }
    this.advs = this.advs.filter((a) => !a.dead && !a.gone);
    if (this.heart <= 0) { this.lose(); return; }
    if (this.waveT > 420) this.advs.forEach((a) => { if (!ADVS[a.cls].boss) a.fleeing = true; });
    if (this.spawnQ.length === 0 && this.advs.length === 0) this.endWave();
  }

  updateAdv(a: Adv, dt: number) {
    if (a.dead || a.gone) return;
    const d = ADVS[a.cls];
    a.atkCd -= dt; a.flash -= dt; a.age += dt; a.bob += dt; a.goalT -= dt;
    if (a.slowT > 0) a.slowT -= dt;
    if (a.weakT > 0) a.weakT -= dt;
    if (a.poisonT > 0) { a.poisonT -= dt; this.hurtAdv(a, a.poisonDps * dt, 'dot', true); if (Math.random() < dt * 4) this.burst(a.x, a.y, '#6fdc6f', 1, 1, 0.4, 0.05, -1); }
    if (a.burnT > 0) { a.burnT -= dt; this.hurtAdv(a, a.burnDps * dt, 'dot', true); if (Math.random() < dt * 8) this.burst(a.x, a.y, '#ff9a3d', 1, 1.2, 0.4, 0.06, -3); }
    if (a.dead) return;
    a.dotT -= dt;
    a.moving = false;
    if (a.stunT > 0) { a.stunT -= dt; return; }
    if (a.cls === 'cleric') {
      a.healCd -= dt;
      if (a.healCd <= 0) {
        let t: Adv | null = null;
        let lowest = 0.85;
        for (const o of this.advs) {
          if (o.dead || o.gone) continue;
          const r = o.hp / o.maxHp;
          if (r < lowest && dist(o.x, o.y, a.x, a.y) <= 3.2) { lowest = r; t = o; }
        }
        if (t) {
          const amt = 16 + this.wave * 2;
          t.hp = Math.min(t.maxHp, t.hp + amt);
          this.text(t.x, t.y - 0.45, `+${Math.round(amt)}`, '#7bf5a5', 0.26);
          this.burst(t.x, t.y, '#7bf5a5', 8, 1.5, 0.6, 0.05, -2);
          this.ring(t.x, t.y, 0.6, '#7bf5a5', 0.4);
          sound.sfx('heal');
          a.healCd = 2.4;
        } else a.healCd = 0.5;
      }
    }
    if (d.boss) this.bossSpecial(a, dt);
    if (!a.fleeing && !d.boss && this.morale < 25) {
      a.fleeing = true;
      this.text(a.x, a.y - 0.6, 'Retreat!', '#fff', 0.28);
      sound.sfx('flee');
      if (!this.log.length || !this.log[this.log.length - 1].text.startsWith('Morale broken')) this.say('Morale broken — the heroes are retreating!', '#7bd8ff');
    }
    const spd = d.speed * (a.slowT > 0 ? 0.55 : 1) * (a.enraged ? 1.35 : 1) * (a.fleeing ? 1.25 : 1);
    const tx = Math.floor(a.x);
    const ty = Math.floor(a.y);
    const here = this.structs.get(ty * GW + tx);
    // traps
    if (here && TRAP_KINDS.includes(here.kind) && here.cd <= 0 && here.disabled <= 0) this.fireTrap(here, a);
    if (a.dead || a.gone) return;
    // rogue sense
    if (a.cls === 'rogue') {
      this.structs.forEach((s, key) => {
        if (!TRAP_KINDS.includes(s.kind) || a.checked.has(key) || s.disabled > 0) return;
        if (dist(a.x, a.y, s.x + 0.5, s.y + 0.5) < 1.5) {
          a.checked.add(key);
          if (Math.random() < 0.55) {
            s.disabled = 9;
            this.text(s.x + 0.5, s.y + 0.2, 'Disarmed!', '#c9b8ff', 0.26);
            sound.sfx('disarm');
          }
        }
      });
    }
    // cache pickup
    if (!a.fleeing) {
      this.structs.forEach((s) => {
        if (s.kind === 'cache' && s.loot > 0 && dist(a.x, a.y, s.x + 0.5, s.y + 0.5) < 0.6) {
          a.stolen += s.loot;
          this.text(s.x + 0.5, s.y + 0.1, `Stolen ${s.loot}g!`, '#ff9a9a', 0.3);
          this.say(`${d.name} stole ${s.loot}g from a cache!`, '#ffb36b');
          s.loot = 0;
          s.flash = 0.4;
          this.burst(s.x + 0.5, s.y + 0.5, '#f4c453', 12, 3, 0.7, 0.06, 4);
          sound.sfx('steal');
          this.morale = Math.min(100, this.morale + 10);
          a.goalT = 0;
        }
      });
    }
    // goal
    if (a.goalT <= 0) {
      a.goalT = 0.7 + Math.random() * 0.3;
      this.pickGoal(a);
    }
    if (a.pathVer !== this.mapVer) { a.pathVer = this.mapVer; this.pickGoal(a); }
    // fleeing
    if (a.fleeing) {
      if (this.bashDoor(a, d)) return;
      this.follow(a, spd, dt);
      if (a.x < ENTRANCE.x + 0.55 && a.age > 1) this.escape(a);
      return;
    }
    // heart
    const hx = HEART.x + 0.5;
    const hy = HEART.y + 0.5;
    const dh = dist(a.x, a.y, hx, hy);
    const hRange = Math.max(1.1, Math.min(d.range * 0.8, 2.6));
    // monsters
    let tm: Monster | null = null;
    let tmD = Infinity;
    const reach = RANGED.includes(a.cls) ? d.range : d.range + 0.1;
    let near: Monster | null = null;
    let nearD = Infinity;
    for (const m of this.mons) {
      if (m.dead) continue;
      const dd = dist(a.x, a.y, m.x, m.y);
      if (dd <= reach && dd < tmD && (dd < 1 || this.los(a.x, a.y, m.x, m.y))) { tm = m; tmD = dd; }
      if (dd < nearD && dd < 1.9) { near = m; nearD = dd; }
    }
    if (tm === null && this.bashDoor(a, d)) return;
    if (tm) {
      a.face = tm.x >= a.x ? 1 : -1;
      if (a.atkCd <= 0) this.advAttack(a, tm);
      return;
    }
    if (dh <= hRange && this.los(a.x, a.y, hx, hy)) {
      a.face = 1;
      if (a.atkCd <= 0) {
        a.atkCd = d.cd;
        const dmg = a.dmg * (a.weakT > 0 ? 0.7 : 1);
        this.heart -= dmg;
        this.stats.heartDamage += dmg;
        this.waveStats.heartLost += dmg;
        this.flashRed = Math.min(0.7, this.flashRed + 0.35);
        this.shake(0.35);
        this.text(hx, hy - 0.5, `-${Math.round(dmg)}`, '#ff4d6d', 0.34);
        this.burst(hx, hy, '#ff4d8d', 10, 3, 0.6, 0.07, 2);
        if (this.sfxHeartCd <= 0) { sound.sfx('heart'); this.sfxHeartCd = 0.35; }
        if (RANGED.includes(a.cls)) this.projs.push({ x: a.x, y: a.y, target: null, tx: hx, ty: hy, speed: 12, dmg: 0, side: 'adv', color: d.color, aoe: 0, kind: 'magic', life: 0.5, weak: false });
        if (this.heart <= 0) this.lose();
      }
      return;
    }
    if (near && !RANGED.includes(a.cls) && !this.nextDoor(a)) {
      this.moveEnt(a, near.x, near.y, spd * dt, true);
      a.moving = true;
      return;
    }
    this.follow(a, spd, dt);
  }

  bashDoor(a: Adv, d: { cd: number }): boolean {
    const door = this.nextDoor(a);
    if (!door) return false;
    a.face = door.x + 0.5 > a.x ? 1 : -1;
    if (a.atkCd <= 0) {
      a.atkCd = d.cd;
      door.hp -= a.dmg * (a.weakT > 0 ? 0.7 : 1) * (RANGED.includes(a.cls) ? 0.6 : 1);
      door.flash = 0.15;
      sound.sfx('door');
      this.burst(door.x + 0.5, door.y + 0.5, '#b0b8c8', 3, 2, 0.3, 0.05, 3);
      if (door.hp <= 0) {
        sound.sfx('doorbreak');
        this.shake(0.4);
        this.burst(door.x + 0.5, door.y + 0.5, '#b0b8c8', 22, 4, 0.7, 0.08, 6);
        this.say('An Iron Door was smashed!', '#9c8fb5');
        this.removeStruct(door, false);
      }
    }
    return true;
  }

  nextDoor(a: Adv): Struct | null {
    const n = a.path[0];
    if (!n) return null;
    const s = this.structs.get(n.y * GW + n.x);
    if (s && s.kind === 'door' && s.hp > 0 && dist(a.x, a.y, n.x + 0.5, n.y + 0.5) < 1.25) return s;
    return null;
  }

  follow(a: Adv, spd: number, dt: number) {
    while (a.path.length) {
      const n = a.path[0];
      const s = this.structs.get(n.y * GW + n.x);
      if (s && s.kind === 'door' && s.hp > 0) break;
      if (dist(a.x, a.y, n.x + 0.5 + a.off.x, n.y + 0.5 + a.off.y) < 0.09) a.path.shift();
      else break;
    }
    if (!a.path.length) return;
    const n = a.path[0];
    const s = this.structs.get(n.y * GW + n.x);
    if (s && s.kind === 'door' && s.hp > 0 && dist(a.x, a.y, n.x + 0.5, n.y + 0.5) < 1.25) return;
    this.moveEnt(a, n.x + 0.5 + a.off.x, n.y + 0.5 + a.off.y, spd * dt, true);
    a.moving = true;
  }

  pickGoal(a: Adv) {
    const d = ADVS[a.cls];
    const tx = Math.max(0, Math.min(GW - 1, Math.floor(a.x)));
    const ty = Math.max(0, Math.min(GH - 1, Math.floor(a.y)));
    let gx = HEART.x;
    let gy = HEART.y;
    let key = 'heart';
    let path: Pt[] | null = null;
    if (a.fleeing || (a.stolen > 0 && d.greed >= 0.9)) {
      gx = ENTRANCE.x; gy = ENTRANCE.y; key = 'exit';
    } else if (!d.boss) {
      const greed = d.greed * (this.modIds.has('greedy') ? 2 : 1);
      const reach = 4 + greed * 10;
      let bestLen = Infinity;
      this.structs.forEach((s, k) => {
        if (s.kind !== 'cache' || s.loot <= 0) return;
        const p = this.findPath(tx, ty, s.x, s.y);
        if (p && p.length <= reach && p.length < bestLen) { bestLen = p.length; gx = s.x; gy = s.y; key = `cache${k}`; path = p; }
      });
    }
    if (!path) path = this.findPath(tx, ty, gx, gy);
    if (!path && key !== 'heart') path = this.findPath(tx, ty, HEART.x, HEART.y);
    if (path) { a.path = path; a.stuck = 0; } else a.stuck += 0.7;
    a.goalKey = key;
    a.pathVer = this.mapVer;
    if (a.stuck > 8) { a.gone = true; }
  }

  escape(a: Adv) {
    a.gone = true;
    const d = ADVS[a.cls];
    this.stats.escaped++;
    this.waveStats.escaped++;
    const lost = a.stolen;
    if (lost > 0) { this.stats.goldLost += lost; this.say(`${d.name} escaped with ${lost}g of your gold!`, '#ff8f8f'); this.addRep(-3); }
    else { this.addRep(-1.5); this.say(`${d.name} fled alive — they will return stronger.`, '#9ad0ff'); }
    this.text(a.x + 0.3, a.y - 0.4, lost > 0 ? `Escaped! -${lost}g` : 'Escaped', '#9ad0ff', 0.28);
    if (!d.boss && this.vets.length < 8) this.vets.push({ cls: a.cls, vet: Math.min(3, a.vet + 1) });
  }

  advAttack(a: Adv, m: Monster) {
    const d = ADVS[a.cls];
    a.atkCd = d.cd;
    const dmg = a.dmg * (a.weakT > 0 ? 0.7 : 1);
    if (RANGED.includes(a.cls)) {
      const aoe = a.cls === 'mage' ? 1.0 : a.cls === 'vexara' ? 1.3 : 0;
      const kind = a.cls === 'ranger' ? 'arrow' : a.cls === 'cleric' ? 'zap' : 'magic';
      this.projs.push({ x: a.x, y: a.y - 0.1, target: m, tx: m.x, ty: m.y, speed: a.cls === 'ranger' ? 14 : 9, dmg, side: 'adv', color: d.color, aoe, kind, life: 3, weak: false });
      sound.sfx(kind === 'arrow' ? 'arrow' : 'zap');
    } else {
      this.hitMonster(m, dmg);
    }
  }

  hitMonster(m: Monster, dmg: number) {
    if (m.dead) return;
    m.hp -= dmg;
    m.flash = 0.12;
    this.text(m.x, m.y - 0.45, `${Math.round(dmg)}`, '#9ad0ff', 0.24);
    this.burst(m.x, m.y, '#cfd8ff', 3, 2, 0.3, 0.05, 3);
    sound.sfx('mhit');
    if (m.hp <= 0) this.killMonster(m);
  }

  updateProjs(dt: number) {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      p.life -= dt;
      if (p.target && !(p.target as { dead?: boolean }).dead && !(p.target as Adv).gone) { p.tx = p.target.x; p.ty = p.target.y; }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (d <= step + 0.05 || p.life <= 0) {
        if (p.life > 0 || d < 0.3) this.projHit(p);
        this.projs.splice(i, 1);
        continue;
      }
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
      if (Math.random() < 0.6) this.parts.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.25, max: 0.25, color: p.color, size: 0.05, grav: 0 });
    }
  }

  projHit(p: Proj) {
    if (p.side === 'mon') {
      const t = p.target as Adv | null;
      if (t && !t.dead && !t.gone && dist(t.x, t.y, p.tx, p.ty) < 0.6) {
        this.hurtAdv(t, p.dmg, 'monster');
        t.burnT = Math.max(t.burnT, 1.5);
        t.burnDps = Math.max(t.burnDps, 2);
      }
      this.burst(p.tx, p.ty, '#ff7a3d', 6, 2.5, 0.4, 0.06, 0);
    } else {
      if (p.dmg <= 0) return;
      if (p.aoe > 0) {
        for (const m of this.mons) if (!m.dead && dist(m.x, m.y, p.tx, p.ty) <= p.aoe) this.hitMonster(m, p.dmg * (m === p.target ? 1 : 0.6));
        this.ring(p.tx, p.ty, p.aoe, p.color, 0.3);
      } else {
        const t = p.target as Monster | null;
        if (t && !t.dead && dist(t.x, t.y, p.tx, p.ty) < 0.7) this.hitMonster(t, p.dmg);
      }
      this.burst(p.tx, p.ty, p.color, 6, 2.5, 0.4, 0.06, 0);
    }
  }

  bossSpecial(a: Adv, dt: number) {
    a.special -= dt;
    if (a.cls === 'hero' && !a.enraged && a.hp < a.maxHp * 0.5) {
      a.enraged = true;
      this.text(a.x, a.y - 0.8, 'ENRAGED!', '#ff6b6b', 0.4);
      this.shake(0.7);
      this.say('The Hero of Dawn is enraged!', '#ff6b6b');
      this.ring(a.x, a.y, 2, '#ff6b6b', 0.6);
    }
    if (a.special > 0) return;
    if (a.cls === 'aldric') {
      a.special = 9;
      for (const o of this.advs) if (!o.dead && dist(o.x, o.y, a.x, a.y) <= 3.5) { o.shield = Math.min(80, o.shield + 50); this.burst(o.x, o.y, '#9ad0ff', 6, 1.5, 0.6, 0.05, -2); }
      this.ring(a.x, a.y, 3.5, '#9ad0ff', 0.7);
      this.text(a.x, a.y - 0.8, 'Shield Wall!', '#9ad0ff', 0.32);
      sound.sfx('shield');
    } else if (a.cls === 'vexara') {
      a.special = 6;
      let best: Struct | null = null;
      let bd = 4.2;
      this.structs.forEach((s) => {
        const dd = dist(a.x, a.y, s.x + 0.5, s.y + 0.5);
        if (s.kind !== 'door' && s.disabled <= 0 && dd < bd) { bd = dd; best = s; }
      });
      const t = best as Struct | null;
      if (t) {
        t.disabled = 8;
        this.bolts.push({ pts: [{ x: a.x, y: a.y }, { x: (a.x + t.x + 0.5) / 2 + rnd(-0.3, 0.3), y: (a.y + t.y + 0.5) / 2 + rnd(-0.3, 0.3) }, { x: t.x + 0.5, y: t.y + 0.5 }], life: 0.35, color: '#e08bff' });
        this.text(t.x + 0.5, t.y + 0.2, 'Dispelled!', '#e08bff', 0.28);
        this.ring(t.x + 0.5, t.y + 0.5, 1, '#e08bff', 0.5);
        sound.sfx('dispel');
      }
    } else if (a.cls === 'hero') {
      a.special = a.enraged ? 5.5 : 8;
      for (const m of this.mons) if (!m.dead && dist(m.x, m.y, a.x, a.y) <= 3.4) this.hitMonster(m, 45);
      for (const o of this.advs) if (!o.dead && dist(o.x, o.y, a.x, a.y) <= 3.4) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.08);
      this.morale = Math.min(100, this.morale + 8);
      this.ring(a.x, a.y, 3.4, '#fff3a0', 0.7);
      this.flashWhite = 0.4;
      this.text(a.x, a.y - 0.9, 'DAWN NOVA!', '#fff3a0', 0.36);
      this.shake(0.4);
      sound.sfx('nova');
    }
  }

  fireTrap(s: Struct, a: Adv) {
    const def = STRUCTS[s.kind];
    if (this.mana < def.mana) {
      s.cd = 1.5;
      this.text(s.x + 0.5, s.y + 0.2, 'No mana!', '#7fb4ff', 0.24);
      return;
    }
    this.mana -= def.mana;
    this.stats.trapsFired++;
    const pow = this.trapPow(s);
    const cx = s.x + 0.5;
    const cy = s.y + 0.5;
    s.flash = 0.3;
    sound.sfx(s.kind);
    if (s.kind === 'spike') {
      s.cd = 3.5;
      this.hurtAdv(a, 22 * pow, 'trap');
      this.burst(cx, cy, '#cfd6e6', 8, 3, 0.4, 0.05, 4);
      this.shake(0.12);
      this.moraleHit(1.5);
    } else if (s.kind === 'dart') {
      s.cd = 2.5;
      this.hurtAdv(a, 11 * pow, 'trap');
      a.poisonT = 5;
      a.poisonDps = Math.max(a.poisonDps, 4 * pow);
      this.burst(cx, cy, '#7bd88f', 8, 3, 0.4, 0.05, 1);
      this.moraleHit(1);
    } else if (s.kind === 'flame') {
      s.cd = 6;
      for (const o of this.advs) {
        if (!o.dead && dist(o.x, o.y, cx, cy) <= 1.3) { this.hurtAdv(o, 28 * pow, 'trap'); o.burnT = 3; o.burnDps = Math.max(o.burnDps, 3 * pow); }
      }
      this.burst(cx, cy, '#ff8a3d', 28, 4, 0.7, 0.09, -3);
      this.ring(cx, cy, 1.3, '#ff8a3d', 0.4);
      this.shake(0.25);
      this.moraleHit(3);
    } else if (s.kind === 'curse') {
      s.cd = 8;
      for (const o of this.advs) {
        if (!o.dead && dist(o.x, o.y, cx, cy) <= 1.6) { o.slowT = Math.max(o.slowT, 4); o.weakT = 6; this.text(o.x, o.y - 0.5, 'Cursed!', '#c58bff', 0.24); }
      }
      this.burst(cx, cy, '#b46bff', 20, 2.5, 0.8, 0.07, -1);
      this.ring(cx, cy, 1.6, '#b46bff', 0.6);
      this.moraleHit(6);
    }
  }

  lose() {
    if (this.phase === 'lost') return;
    this.phase = 'lost';
    this.heart = 0;
    this.shake(1.4);
    this.flashRed = 1;
    sound.sfx('defeat');
    sound.setMood('menu');
    this.say('The Dungeon Heart has been shattered…', '#ff4d6d');
    this.emit({ type: 'lost' });
  }

  endWave() {
    const n = this.wave;
    const ws = this.waveStats;
    this.stats.wavesCleared++;
    const flawless = ws.heartLost <= 0;
    const bonus = Math.max(10, Math.round((40 + n * 12 - ws.escaped * 8 + (flawless ? 25 : 0)) * (1 + this.rep * 0.004)));
    this.gold += bonus;
    this.stats.goldEarned += bonus;
    const rep0 = this.rep;
    if (flawless) this.addRep(4);
    this.heart = Math.min(this.maxHeart(), this.heart + this.maxHeart() * 0.25);
    this.mana = Math.min(this.maxMana(), this.mana + 20);
    this.say(`Wave ${n} repelled! Bonus ${bonus}g.`, '#8ff0a4');
    const summary: WaveSummary = { wave: n, kills: ws.kills, escaped: ws.escaped, heartLost: Math.round(ws.heartLost), gold: Math.round(ws.gold), bonus, repDelta: Math.round((this.rep - rep0) * 10) / 10, vets: this.vets.length };
    this.vets = this.vets.slice(0, 8);
    // vets list for next wave is the ones that escaped during this wave; those carried into this wave were already spawned
    if (n >= MAX_WAVES && !this.endless) {
      this.phase = 'won';
      this.victoryDone = true;
      sound.sfx('victory');
      sound.setMood('menu');
      this.emit({ type: 'won' });
      return;
    }
    this.chooseEdicts();
    this.phase = 'result';
    sound.setMood('prep');
    this.emit({ type: 'wave', summary });
  }

  /* ───────────── snapshot ───────────── */
  snapshot(): Snapshot {
    const counts = { trap: 0, lair: 0, cache: 0, well: 0, mons: this.mons.length };
    this.structs.forEach((s) => {
      if (TRAP_KINDS.includes(s.kind) || s.kind === 'door') counts.trap++;
      else if (LAIRS.includes(s.kind)) counts.lair++;
      else if (s.kind === 'cache') counts.cache++;
      else if (s.kind === 'well') counts.well++;
    });
    const prev: Record<string, { cls: AdvClass; n: number; vet: boolean }> = {};
    let pb: AdvClass | null = null;
    for (const c of this.nextComp) {
      if (ADVS[c.cls].boss) { pb = c.cls; continue; }
      const k = c.cls + (c.vet ? 'v' : '');
      if (!prev[k]) prev[k] = { cls: c.cls, n: 0, vet: c.vet > 0 };
      prev[k].n++;
    }
    let sel: SelInfo | null = null;
    const s = this.selected;
    if (s && this.structs.get(this.idx(s.x, s.y)) === s) {
      const def = STRUCTS[s.kind];
      const lines: string[] = [def.desc];
      if (TRAP_KINDS.includes(s.kind)) lines.push(`Power ×${this.trapPow(s).toFixed(2)} · rearm ${s.cd > 0 ? s.cd.toFixed(1) + 's' : 'ready'}${s.disabled > 0 ? ' · DISABLED ' + s.disabled.toFixed(0) + 's' : ''}`);
      if (LAIRS.includes(s.kind)) {
        const m = s.monster;
        lines.push(m ? `Monster HP ${Math.round(m.hp)}/${Math.round(m.maxHp)} · DMG ${m.dmg.toFixed(1)}` : `Respawning… ${Math.max(0, s.respawn).toFixed(0)}s (needs ${Math.round(def.mana * this.mods.lairMana)} mana)`);
      }
      if (s.kind === 'cache') lines.push(`Loot ${s.loot}/${this.fullLoot(s)}g`);
      if (s.kind === 'door') lines.push(`Door HP ${Math.round(s.hp)}/${s.maxHp}`);
      if (s.kind === 'well') lines.push(`+${(1.4 * (1 + 0.4 * (s.level - 1))).toFixed(1)} mana/s`);
      if (s.kind === 'altar') lines.push(`Heals ${5 * s.level} HP/s nearby`);
      sel = { kind: s.kind, name: def.name, icon: def.icon, level: s.level, upCost: this.upCost(s), sellValue: Math.round(s.invested * 0.6), lines, x: s.x, y: s.y, canUp: s.level < 3 };
    }
    const ru = Math.round(this.rep);
    return {
      gold: Math.floor(this.gold), mana: this.mana, maxMana: this.maxMana(), regen: this.regenRate(), heart: Math.max(0, this.heart), maxHeart: this.maxHeart(),
      rep: this.rep, repTier: repTier(this.rep), morale: this.morale, wave: this.wave, maxWaves: MAX_WAVES, phase: this.phase, speed: this.speed,
      tool: this.tool, paused: this.paused, endless: this.endless, enemiesLeft: this.advs.length + this.spawnQ.length, sel,
      preview: Object.values(prev), previewBoss: pb, vetCount: this.nextComp.filter((c) => c.vet > 0).length,
      spells: SPELLS.map((sp) => ({ id: sp.id, cd: this.spellCd[sp.id], cdMax: sp.cd, cost: this.spellCost(sp.id), unlocked: this.unlocked(sp.unlock) })),
      castMode: this.castMode, log: this.log.slice(-7), edictChoices: this.edictChoices, owned: this.owned, stats: this.stats, notice: this.noticeObj,
      counts, connected: this.connected(), soulsPreview: this.calcSouls(), bossWave: this.wave % 4 === 0, time: this.stats.time,
      modsView: [
        { label: 'Trap dmg', value: `×${(this.mods.trapDmg * (1 + 0.08 * this.lv('trap'))).toFixed(2)}` },
        { label: 'Monster power', value: `×${(this.mods.monHp * (1 + 0.08 * this.lv('beast'))).toFixed(2)}` },
        { label: 'Spell power', value: `×${this.spellPow().toFixed(2)}` },
        { label: 'Bounty', value: `×${(this.mods.bounty * (1 + ru * 0.004)).toFixed(2)}` },
      ],
    };
  }

  /* ───────────── rendering ───────────── */
  emoji(ch: string, x: number, y: number, size: number, alpha = 1) {
    const c = this.ctx;
    c.globalAlpha = alpha;
    c.font = `${size}px ${EMOJI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(ch, x, y);
    c.globalAlpha = 1;
  }

  draw() {
    const c = this.ctx;
    const ts = this.ts;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, ts * GW, ts * GH);
    c.save();
    if (this.shakeMag > 0 && this.cfg.shake > 0) {
      const m = this.shakeMag * ts * 0.12 * this.cfg.shake;
      c.translate(rnd(-m, m), rnd(-m, m));
    }
    this.drawMap();
    this.drawRoute();
    this.drawGhost();
    this.drawStructs();
    this.drawHeart();
    // units sorted by y
    const units: { y: number; f: () => void }[] = [];
    for (const m of this.mons) units.push({ y: m.y, f: () => this.drawMon(m) });
    for (const a of this.advs) units.push({ y: a.y, f: () => this.drawAdv(a) });
    units.sort((a, b) => a.y - b.y);
    units.forEach((u) => u.f());
    this.drawFx();
    this.drawLighting();
    c.restore();
    this.drawOverlay();
  }

  drawMap() {
    const c = this.ctx;
    const ts = this.ts;
    c.fillStyle = '#0a0710';
    c.fillRect(0, 0, ts * GW, ts * GH);
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const px = x * ts;
        const py = y * ts;
        const h = hash(x, y);
        if (this.grid[y * GW + x] === 0) {
          const v = 16 + Math.floor(h * 12);
          c.fillStyle = `rgb(${v + 6},${v},${v + 14})`;
          c.fillRect(px, py, ts, ts);
          c.strokeStyle = 'rgba(0,0,0,0.35)';
          c.lineWidth = 1;
          c.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
          if (h > 0.6) {
            c.strokeStyle = 'rgba(255,255,255,0.05)';
            c.beginPath();
            c.moveTo(px + ts * h * 0.5, py + ts * 0.2);
            c.lineTo(px + ts * 0.5, py + ts * 0.55);
            c.lineTo(px + ts * (0.4 + h * 0.4), py + ts * 0.9);
            c.stroke();
          }
        } else {
          const chk = (x + y) % 2 === 0;
          c.fillStyle = chk ? '#3a3349' : '#363045';
          c.fillRect(px, py, ts, ts);
          c.strokeStyle = 'rgba(255,255,255,0.06)';
          c.strokeRect(px + 0.5, py + 0.5, ts - 1, ts - 1);
          if (h > 0.75) {
            c.fillStyle = 'rgba(0,0,0,0.12)';
            c.fillRect(px + ts * h * 0.6, py + ts * 0.3, ts * 0.12, ts * 0.12);
          }
          // wall shadow
          const sh = ts * 0.2;
          const shadow = (x0: number, y0: number, x1: number, y1: number, w: number, hh: number) => {
            const g = c.createLinearGradient(x0, y0, x1, y1);
            g.addColorStop(0, 'rgba(0,0,0,0.5)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            c.fillStyle = g;
            c.fillRect(x0 < x1 ? x0 : x1, y0 < y1 ? y0 : y1, w, hh);
          };
          if (y > 0 && this.grid[(y - 1) * GW + x] === 0) shadow(px, py, px, py + sh, ts, sh);
          if (y < GH - 1 && this.grid[(y + 1) * GW + x] === 0) shadow(px, py + ts, px, py + ts - sh, ts, sh);
          if (x > 0 && this.grid[y * GW + x - 1] === 0) shadow(px, py, px + sh, py, sh, ts);
          if (x < GW - 1 && this.grid[y * GW + x + 1] === 0) shadow(px + ts, py, px + ts - sh, py, sh, ts);
        }
      }
    }
    // entrance arch
    const ex = ENTRANCE.x * ts;
    const ey = ENTRANCE.y * ts;
    const g = c.createLinearGradient(ex, 0, ex + ts * 1.2, 0);
    g.addColorStop(0, 'rgba(255,240,190,0.55)');
    g.addColorStop(1, 'rgba(255,240,190,0)');
    c.fillStyle = g;
    c.fillRect(ex, ey, ts * 1.2, ts);
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.font = `bold ${Math.max(8, ts * 0.17)}px sans-serif`;
    c.textAlign = 'left';
    c.textBaseline = 'top';
    c.fillText('ENTRANCE', ex + 3, ey + 3);
  }

  drawRoute() {
    if (this.phase !== 'prep' && this.phase !== 'raid') return;
    if (this.routeVer !== this.mapVer) {
      this.routeVer = this.mapVer;
      this.route = this.findPath(ENTRANCE.x, ENTRANCE.y, HEART.x, HEART.y) || [];
    }
    if (!this.route.length) return;
    const c = this.ctx;
    const ts = this.ts;
    c.save();
    c.strokeStyle = this.phase === 'prep' ? 'rgba(244,196,83,0.5)' : 'rgba(244,196,83,0.16)';
    c.lineWidth = Math.max(2, ts * 0.06);
    c.setLineDash([ts * 0.2, ts * 0.18]);
    c.lineDashOffset = -this.time * 0 - performance.now() / 40;
    c.beginPath();
    c.moveTo((ENTRANCE.x + 0.5) * ts, (ENTRANCE.y + 0.5) * ts);
    for (const p of this.route) c.lineTo((p.x + 0.5) * ts, (p.y + 0.5) * ts);
    c.stroke();
    c.restore();
  }

  drawGhost() {
    if (!this.mouse.inside || this.paused) return;
    const c = this.ctx;
    const ts = this.ts;
    const tx = Math.floor(this.mouse.x);
    const ty = Math.floor(this.mouse.y);
    if (tx < 0 || ty < 0 || tx >= GW || ty >= GH) return;
    const px = tx * ts;
    const py = ty * ts;
    const floor = this.grid[ty * GW + tx] === 1;
    const occ = this.structs.has(ty * GW + tx);
    if (this.castMode) return;
    if (this.tool === 'inspect') {
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      c.lineWidth = 2;
      c.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
      return;
    }
    let ok = false;
    if (this.tool === 'dig') ok = !floor && (this.isFloor(tx + 1, ty) || this.isFloor(tx - 1, ty) || this.isFloor(tx, ty + 1) || this.isFloor(tx, ty - 1));
    else if (this.tool === 'fill') ok = floor && !occ && !(tx === ENTRANCE.x && ty === ENTRANCE.y) && !(tx === HEART.x && ty === HEART.y);
    else ok = floor && !occ && !(tx === ENTRANCE.x && ty === ENTRANCE.y) && !(tx === HEART.x && ty === HEART.y);
    c.fillStyle = ok ? 'rgba(120,255,160,0.25)' : 'rgba(255,90,110,0.28)';
    c.fillRect(px, py, ts, ts);
    c.strokeStyle = ok ? '#7dffa8' : '#ff5a6e';
    c.lineWidth = 2;
    c.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
    if (this.tool !== 'dig' && this.tool !== 'fill' && ok) this.emoji(STRUCTS[this.tool].icon, px + ts / 2, py + ts / 2, ts * 0.55, 0.65);
    if (this.tool === 'dig') this.emoji('⛏️', px + ts / 2, py + ts / 2, ts * 0.5, 0.6);
  }

  drawStructs() {
    const c = this.ctx;
    const ts = this.ts;
    const t = performance.now() / 1000;
    this.structs.forEach((s) => {
      const def = STRUCTS[s.kind];
      const px = s.x * ts;
      const py = s.y * ts;
      const cx = px + ts / 2;
      const cy = py + ts / 2;
      const pulse = 1 + Math.sin(t * 3 + s.seed * 6) * 0.04;
      // plate
      const pad = ts * 0.09;
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.fillRect(px + pad, py + pad + 2, ts - pad * 2, ts - pad * 2);
      c.fillStyle = def.color + '33';
      c.strokeStyle = def.color + (s.flash > 0 ? 'ff' : '99');
      c.lineWidth = s.flash > 0 ? 3 : 1.5;
      c.beginPath();
      c.roundRect(px + pad, py + pad, ts - pad * 2, ts - pad * 2, ts * 0.12);
      c.fill();
      c.stroke();
      if (s.kind === 'well' && s.disabled <= 0) {
        const g = c.createRadialGradient(cx, cy, 2, cx, cy, ts * 0.8);
        g.addColorStop(0, 'rgba(90,169,255,0.5)');
        g.addColorStop(1, 'rgba(90,169,255,0)');
        c.fillStyle = g;
        c.fillRect(px - ts * 0.4, py - ts * 0.4, ts * 1.8, ts * 1.8);
      }
      if (s.kind === 'altar') {
        c.strokeStyle = 'rgba(224,68,92,0.25)';
        c.lineWidth = 1;
        c.beginPath();
        c.arc(cx, cy, 2.2 * ts, 0, Math.PI * 2);
        c.stroke();
      }
      const gray = (s.kind === 'cache' && s.loot <= 0) || s.disabled > 0 || (LAIRS.includes(s.kind) && !s.monster && s.respawn > 0);
      this.emoji(def.icon, cx, cy + (s.kind === 'door' ? 0 : 0), ts * 0.52 * pulse * (s.kind === 'cache' ? 0.9 + 0.1 * Math.min(1, s.loot / 50) : 1), gray ? 0.35 : 1);
      // cooldown arc
      if (TRAP_KINDS.includes(s.kind) && s.cd > 0) {
        const max = s.kind === 'spike' ? 3.5 : s.kind === 'dart' ? 2.5 : s.kind === 'flame' ? 6 : 8;
        c.strokeStyle = 'rgba(255,255,255,0.6)';
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(cx, cy, ts * 0.38, -Math.PI / 2, -Math.PI / 2 + (s.cd / max) * Math.PI * 2);
        c.stroke();
      }
      if (s.kind === 'door') {
        c.fillStyle = 'rgba(0,0,0,0.6)';
        c.fillRect(px + ts * 0.15, py + ts * 0.82, ts * 0.7, 4);
        c.fillStyle = '#b0b8c8';
        c.fillRect(px + ts * 0.15, py + ts * 0.82, ts * 0.7 * Math.max(0, s.hp / s.maxHp), 4);
      }
      if (s.disabled > 0) {
        c.strokeStyle = '#d36bff';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(px + ts * 0.2, py + ts * 0.2); c.lineTo(px + ts * 0.8, py + ts * 0.8);
        c.moveTo(px + ts * 0.8, py + ts * 0.2); c.lineTo(px + ts * 0.2, py + ts * 0.8);
        c.stroke();
      }
      // level pips
      c.fillStyle = '#ffe9a8';
      for (let i = 0; i < s.level; i++) {
        c.beginPath();
        c.arc(px + ts * 0.2 + i * ts * 0.12, py + ts * 0.14, Math.max(1.5, ts * 0.04), 0, Math.PI * 2);
        c.fill();
      }
      if (this.selected === s) {
        c.strokeStyle = '#ffe9a8';
        c.lineWidth = 2.5;
        c.setLineDash([5, 4]);
        c.strokeRect(px + 1, py + 1, ts - 2, ts - 2);
        c.setLineDash([]);
      }
      if (LAIRS.includes(s.kind) && !s.monster && s.respawn <= 0 && s.disabled <= 0) {
        // waiting for mana
        this.emoji('💤', px + ts * 0.8, py + ts * 0.2, ts * 0.22);
      }
    });
  }

  drawHeart() {
    const c = this.ctx;
    const ts = this.ts;
    const cx = (HEART.x + 0.5) * ts;
    const cy = (HEART.y + 0.5) * ts;
    const beat = Math.pow(Math.max(0, Math.sin(this.heartBeat * 4)), 6);
    const s = ts * (0.3 + beat * 0.05);
    const ratio = Math.max(0, this.heart / Math.max(1, this.maxHeart()));
    const g = c.createRadialGradient(cx, cy, 2, cx, cy, ts * (1.1 + beat * 0.2));
    g.addColorStop(0, `rgba(255,70,140,${0.55 + beat * 0.3})`);
    g.addColorStop(1, 'rgba(255,70,140,0)');
    c.fillStyle = g;
    c.fillRect(cx - ts * 1.5, cy - ts * 1.5, ts * 3, ts * 3);
    c.save();
    c.translate(cx, cy + s * 0.1);
    c.beginPath();
    c.moveTo(0, s * 0.9);
    c.bezierCurveTo(-s * 1.5, -s * 0.1, -s * 0.8, -s * 1.1, 0, -s * 0.4);
    c.bezierCurveTo(s * 0.8, -s * 1.1, s * 1.5, -s * 0.1, 0, s * 0.9);
    const gg = c.createLinearGradient(0, -s, 0, s);
    gg.addColorStop(0, ratio > 0.3 ? '#ff6fae' : '#ff9a6f');
    gg.addColorStop(1, '#8f1f55');
    c.fillStyle = gg;
    c.fill();
    c.strokeStyle = '#ffd1e6';
    c.lineWidth = 2;
    c.stroke();
    c.restore();
    if (this.lv('pulse') > 0 || this.mods.thorns > 0) {
      c.strokeStyle = `rgba(255,77,141,${0.12 + beat * 0.2})`;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(cx, cy, 2.2 * ts, 0, Math.PI * 2);
      c.stroke();
    }
  }

  drawBar(x: number, y: number, w: number, ratio: number, color: string) {
    const c = this.ctx;
    const h = Math.max(3, this.ts * 0.07);
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    c.fillStyle = color;
    c.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, ratio)), h);
  }

  drawMon(m: Monster) {
    const c = this.ctx;
    const ts = this.ts;
    const d = MONSTERS[m.type];
    const px = m.x * ts;
    const py = m.y * ts + Math.sin(m.bob * 6) * ts * 0.02;
    c.fillStyle = 'rgba(0,0,0,0.4)';
    c.beginPath();
    c.ellipse(px, py + ts * 0.25, ts * d.size * 0.4, ts * 0.1, 0, 0, Math.PI * 2);
    c.fill();
    const grad = c.createRadialGradient(px, py, 2, px, py, ts * d.size * 0.55);
    grad.addColorStop(0, d.color + (m.buffT > 0 ? 'ff' : '88'));
    grad.addColorStop(1, d.color + '00');
    c.fillStyle = grad;
    c.fillRect(px - ts, py - ts, ts * 2, ts * 2);
    c.save();
    c.translate(px, py);
    if (m.face < 0) c.scale(-1, 1);
    this.emoji(d.icon, 0, 0, ts * d.size * (m.flash > 0 ? 1.15 : 1));
    c.restore();
    if (m.flash > 0) { c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(px, py, ts * d.size * 0.4, 0, Math.PI * 2); c.fill(); }
    this.drawBar(px, py - ts * (d.size * 0.5 + 0.1), ts * 0.55, m.hp / m.maxHp, '#4ee08a');
    if (m.buffT > 0) this.emoji('💢', px + ts * 0.25, py - ts * 0.35, ts * 0.2);
  }

  drawAdv(a: Adv) {
    const c = this.ctx;
    const ts = this.ts;
    const d = ADVS[a.cls];
    const px = a.x * ts;
    const py = a.y * ts + (a.moving ? Math.sin(a.bob * 14) * ts * 0.03 : 0);
    const r = ts * d.size * 0.5;
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath();
    c.ellipse(px, py + ts * 0.26, r * 0.9, ts * 0.1, 0, 0, Math.PI * 2);
    c.fill();
    // body disc
    c.fillStyle = a.stunT > 0 ? '#555' : '#1b1424';
    c.strokeStyle = d.color;
    c.lineWidth = d.boss ? 3.5 : 2.5;
    c.beginPath();
    c.arc(px, py, r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    if (d.boss) {
      c.strokeStyle = d.color + '66';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(px, py, r + 4 + Math.sin(performance.now() / 200) * 2, 0, Math.PI * 2);
      c.stroke();
    }
    if (a.shield > 0) {
      c.strokeStyle = 'rgba(154,208,255,0.9)';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(px, py, r + 3, 0, Math.PI * 2);
      c.stroke();
    }
    this.emoji(d.icon, px, py + 1, r * 1.35);
    if (a.flash > 0) { c.fillStyle = 'rgba(255,60,80,0.5)'; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); }
    this.drawBar(px, py - r - ts * 0.13, Math.max(ts * 0.5, r * 1.8), a.hp / a.maxHp, d.boss ? '#ffd24a' : '#ff5d73');
    if (a.shield > 0) {
      const h = Math.max(3, ts * 0.07);
      c.fillStyle = '#9ad0ff';
      c.fillRect(px - r, py - r - ts * 0.13 - h - 2, Math.min(2 * r, (a.shield / 80) * 2 * r), h * 0.7);
    }
    // status icons
    let ix = px - r;
    const iy = py + r + ts * 0.06;
    const ic = ts * 0.18;
    if (a.fleeing) { this.emoji('💨', ix, iy, ic); ix += ic; }
    if (a.stolen > 0) { this.emoji('💰', ix, iy, ic); ix += ic; }
    if (a.poisonT > 0) { this.emoji('🟢', ix, iy, ic * 0.8); ix += ic; }
    if (a.burnT > 0) { this.emoji('🔥', ix, iy, ic); ix += ic; }
    if (a.slowT > 0) { this.emoji('🧊', ix, iy, ic); ix += ic; }
    if (a.stunT > 0) { this.emoji('💫', px, py - r - ts * 0.3, ic * 1.4); }
    if (a.vet > 0) { c.fillStyle = '#ffd24a'; c.font = `bold ${Math.max(8, ts * 0.2)}px sans-serif`; c.textAlign = 'right'; c.textBaseline = 'middle'; c.fillText('★'.repeat(a.vet), px + r + ts * 0.15, py - r); }
    if (d.boss) {
      c.fillStyle = '#fff';
      c.font = `bold ${Math.max(9, ts * 0.2)}px sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.fillText(d.name, px, py - r - ts * 0.22);
    }
  }

  drawFx() {
    const c = this.ctx;
    const ts = this.ts;
    for (const r of this.rings) {
      c.strokeStyle = r.color;
      c.globalAlpha = Math.max(0, r.life / r.maxLife);
      c.lineWidth = Math.max(2, ts * 0.06);
      c.beginPath();
      c.arc(r.x * ts, r.y * ts, r.r * ts, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 0.12 * Math.max(0, r.life / r.maxLife);
      c.fillStyle = r.color;
      c.fill();
    }
    c.globalAlpha = 1;
    for (const b of this.bolts) {
      c.strokeStyle = b.color;
      c.lineWidth = Math.max(2, ts * 0.09);
      c.shadowColor = b.color;
      c.shadowBlur = 16;
      c.globalAlpha = Math.min(1, b.life * 4);
      c.beginPath();
      b.pts.forEach((p, i) => (i ? c.lineTo(p.x * ts, p.y * ts) : c.moveTo(p.x * ts, p.y * ts)));
      c.stroke();
    }
    c.shadowBlur = 0;
    c.globalAlpha = 1;
    for (const p of this.projs) {
      c.fillStyle = p.color;
      c.shadowColor = p.color;
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(p.x * ts, p.y * ts, p.kind === 'arrow' ? ts * 0.05 : ts * 0.1, 0, Math.PI * 2);
      c.fill();
    }
    c.shadowBlur = 0;
    for (const p of this.parts) {
      c.globalAlpha = Math.max(0, p.life / p.max);
      c.fillStyle = p.color;
      const s = p.size * ts;
      c.fillRect(p.x * ts - s / 2, p.y * ts - s / 2, s, s);
    }
    c.globalAlpha = 1;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const t of this.texts) {
      const k = Math.min(1, t.life);
      const sc = 1 + Math.max(0, t.life - 0.8) * 2;
      c.globalAlpha = k;
      c.font = `bold ${Math.max(10, t.size * ts * sc)}px sans-serif`;
      c.lineWidth = 3;
      c.strokeStyle = 'rgba(0,0,0,0.8)';
      c.strokeText(t.text, t.x * ts, t.y * ts);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x * ts, t.y * ts);
    }
    c.globalAlpha = 1;
  }

  drawLighting() {
    const c = this.ctx;
    const ts = this.ts;
    const w = ts * GW;
    const h = ts * GH;
    const fl = 0.9 + Math.sin(performance.now() / 170) * 0.05 + Math.random() * 0.05;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const g1 = c.createRadialGradient(ts * 0.3, ts * 5.5, 2, ts * 0.3, ts * 5.5, ts * 3.2);
    g1.addColorStop(0, `rgba(255,220,150,${0.22 * fl})`);
    g1.addColorStop(1, 'rgba(255,220,150,0)');
    c.fillStyle = g1;
    c.fillRect(0, 0, w, h);
    this.structs.forEach((s) => {
      if (s.kind === 'flame' || s.kind === 'imp' || s.kind === 'altar') {
        const g = c.createRadialGradient((s.x + 0.5) * ts, (s.y + 0.5) * ts, 2, (s.x + 0.5) * ts, (s.y + 0.5) * ts, ts * 1.6);
        g.addColorStop(0, `rgba(255,120,60,${0.16 * fl})`);
        g.addColorStop(1, 'rgba(255,120,60,0)');
        c.fillStyle = g;
        c.fillRect((s.x - 1.5) * ts, (s.y - 1.5) * ts, ts * 4, ts * 4);
      }
    });
    c.restore();
    const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,10,0)');
    v.addColorStop(1, 'rgba(0,0,10,0.6)');
    c.fillStyle = v;
    c.fillRect(0, 0, w, h);
  }

  drawOverlay() {
    const c = this.ctx;
    const ts = this.ts;
    const w = ts * GW;
    const h = ts * GH;
    if (this.flashRed > 0) {
      const g = c.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, `rgba(255,0,40,${Math.min(0.6, this.flashRed)})`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
    if (this.flashWhite > 0) {
      c.fillStyle = `rgba(255,250,220,${Math.min(0.35, this.flashWhite * 0.5)})`;
      c.fillRect(0, 0, w, h);
    }
    if (this.castMode && this.mouse.inside) {
      const sp = SPELLS.find((s) => s.id === this.castMode)!;
      c.strokeStyle = sp.color;
      c.lineWidth = 2;
      c.setLineDash([6, 5]);
      c.beginPath();
      c.arc(this.mouse.x * ts, this.mouse.y * ts, sp.radius * ts, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = sp.color + '22';
      c.fill();
      this.emoji(sp.icon, this.mouse.x * ts, this.mouse.y * ts, ts * 0.5);
    }
    if (this.banner) {
      const b = this.banner;
      const k = Math.min(1, b.t / 0.5, (2.4 - b.t) / 0.3 + 0.01);
      c.globalAlpha = Math.max(0, Math.min(1, k));
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `bold ${ts * 0.9}px Georgia, serif`;
      c.lineWidth = 6;
      c.strokeStyle = 'rgba(0,0,0,0.85)';
      c.strokeText(b.text, w / 2, h * 0.38);
      c.fillStyle = b.color;
      c.fillText(b.text, w / 2, h * 0.38);
      c.font = `${ts * 0.32}px Georgia, serif`;
      c.fillStyle = '#fff';
      c.strokeText(b.sub, w / 2, h * 0.38 + ts * 0.7);
      c.fillText(b.sub, w / 2, h * 0.38 + ts * 0.7);
      c.globalAlpha = 1;
    }
  }
}
