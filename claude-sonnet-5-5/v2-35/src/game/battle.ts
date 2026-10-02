import { CLASSES, ENEMIES, TERRAIN, TECH, WEATHER_INFO, type Difficulty, type MissionDef, type Terrain, type Weather } from './data';
import { baseStatsFor, maxHpFor, levelForXp, techLevel, type Fallen, type Meta, type RosterUnit } from './campaign';
import { dirBetween, dist, key, makeRng, neighborAt, neighbors, toPixel, type Hex, type Rng } from './hex';
import { audio } from './audio';

export type Phase = 'player' | 'enemy' | 'hazard' | 'over';
export type WarnKind = 'collapse' | 'flood' | 'ignite';

export interface Warn {
  kind: WarnKind;
  eta: number;
}
export interface Tile {
  c: number;
  r: number;
  t: Terrain;
  flood: number;
  burn: number;
  warn: Warn | null;
  stable: boolean;
  depot: null | { owner: 'player' | 'enemy' | 'neutral'; hq: boolean; obj: boolean };
  seed: number;
  anim: number;
}

export interface BUnit {
  id: number;
  rid: number;
  team: 'player' | 'enemy';
  kind: string;
  name: string;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  perks: string[];
  gear: string | null;
  pendingPerks: number;
  kills: number;
  atkBonus: number;
  c: number;
  r: number;
  mp: number;
  acted: boolean;
  moved: boolean;
  cd: number;
  starve: number;
  supplied: boolean;
  undo: { c: number; r: number; mp: number } | null;
  x: number;
  y: number;
  path: { x: number; y: number }[];
  flash: number;
  lunge: { dx: number; dy: number; t: number } | null;
  dead: boolean;
  deathT: number;
  boss: boolean;
  flags: Record<string, boolean>;
  participated: boolean;
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
  g: number;
  shape: 'c' | 's';
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
interface Proj {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  color: string;
}
interface Ring {
  x: number;
  y: number;
  t: number;
  color: string;
  max: number;
}

export interface BattleResult {
  won: boolean;
  reason: string;
  rounds: number;
  kills: number;
  envKills: number;
  dealt: number;
  taken: number;
  shores: number;
  depots: number;
  collapsed: number;
  lost: number;
  crowns: number;
  laurels: number;
  units: RosterUnit[];
  fallen: Fallen[];
  mercy: string[];
}

export interface BattleConfig {
  mission: MissionDef;
  diff: Difficulty;
  mods: string[];
  meta: Meta;
  roster: RosterUnit[];
  seed: number;
  tutorial?: boolean;
  rewardMult: number;
  chestBonus: number;
}

const FIRE_IMMUNE = new Set(['pyromancer', 'colossus', 'warden']);
const PRIORITY: Record<string, number> = { medic: 3, sapper: 3, mortar: 2.5, ranger: 2, scout: 1.5, fusilier: 1, vanguard: 0.5 };

export class Battle {
  cfg: BattleConfig;
  mission: MissionDef;
  diff: Difficulty;
  meta: Meta;
  w: number;
  h: number;
  tiles: Tile[][] = [];
  units: BUnit[] = [];
  rng: Rng;
  round = 1;
  phase: Phase = 'player';
  weather: Weather = 'clear';
  wind = 0;
  selected: BUnit | null = null;
  inspected: BUnit | null = null;
  mode: 'move' | 'ability' = 'move';
  hover: Hex | null = null;
  reachMap = new Map<number, { cost: number; prev: number }>();
  showThreat = false;
  showSupply = true;
  threat = new Set<number>();
  supplySet = new Set<number>();
  supplyParent = new Map<number, number>();
  pending: { t: number; fn: () => void; idle: boolean }[] = [];
  parts: Particle[] = [];
  floats: FloatText[] = [];
  projs: Proj[] = [];
  rings: Ring[] = [];
  banner: { text: string; sub: string; t: number; dur: number; color: string } | null = null;
  shakeAmt = 0;
  time = 0;
  ver = 0;
  paused = false;
  view = { size: 30, ox: 0, oy: 0 };
  queue: BUnit[] = [];
  nextId = 1;
  stats = { kills: 0, envKills: 0, dealt: 0, taken: 0, shores: 0, depots: 0, lost: 0, collapsed: 0 };
  fallen: Fallen[] = [];
  result: BattleResult | null = null;
  onOver?: (r: BattleResult) => void;
  fxScale = 1;
  shakeOn = true;
  numbersOn = true;
  tutorial = false;
  movedEver = false;
  attackedEver = false;
  bossSeen = false;
  hqHold = 0;

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    this.mission = cfg.mission;
    this.diff = cfg.diff;
    this.meta = cfg.meta;
    this.w = cfg.mission.w;
    this.h = cfg.mission.h;
    this.rng = makeRng(cfg.seed);
    this.tutorial = !!cfg.tutorial;
    const s = cfg.meta.settings;
    this.fxScale = s.particles === 'low' ? 0.4 : 1;
    this.shakeOn = s.shake;
    this.numbersOn = s.numbers;
    if (this.tutorial) this.genTutorial();
    else {
      this.genMap();
      this.spawnPlayers(cfg.roster);
      this.spawnEnemies();
    }
    this.recalcSupply();
    this.weather = this.tutorial ? 'clear' : this.rng.pick(this.mission.weather);
    this.wind = this.rng.int(6);
    if (!this.tutorial) this.planHazards();
    this.startPlayerPhase(true);
    audio.intensity = 0.35;
  }

  // ---------- helpers ----------
  changed() {
    this.ver++;
  }
  inb(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.w && r < this.h;
  }
  tile(c: number, r: number): Tile {
    return this.tiles[r][c];
  }
  px(c: number, r: number) {
    return toPixel(c, r, 1);
  }
  unitAt(c: number, r: number): BUnit | null {
    for (const u of this.units) if (!u.dead && u.c === c && u.r === r) return u;
    return null;
  }
  alive(team: 'player' | 'enemy'): BUnit[] {
    return this.units.filter((u) => !u.dead && u.team === team);
  }
  tech(id: string) {
    return techLevel(this.meta, id);
  }
  later(t: number, fn: () => void, idle = false) {
    this.pending.push({ t, fn, idle });
  }
  animating() {
    return this.units.some((u) => !u.dead && (u.path.length > 0 || u.lunge));
  }
  busy() {
    return this.pending.length > 0 || this.animating();
  }
  shake(n: number) {
    if (this.shakeOn) this.shakeAmt = Math.min(24, Math.max(this.shakeAmt, n));
  }
  burst(x: number, y: number, color: string, n: number, speed: number, life: number, size: number, g = 0, shape: 'c' | 's' = 'c') {
    const cnt = Math.ceil(n * this.fxScale);
    for (let i = 0; i < cnt; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (g ? speed * 0.3 : 0), life: life * (0.6 + Math.random() * 0.6), max: life, size: size * (0.5 + Math.random()), color, g, shape });
    }
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
  }
  ring(x: number, y: number, color: string, max = 1.2) {
    this.rings.push({ x, y, t: 0, color, max });
  }
  float(x: number, y: number, text: string, color: string, size = 0.5) {
    if (!this.numbersOn && /^[-+]?\d+$/.test(text)) return;
    this.floats.push({ x: x + (Math.random() - 0.5) * 0.3, y: y - 0.6, text, color, life: 1.3, max: 1.3, size });
  }
  say(text: string, sub = '', color = '#f5d78a') {
    this.banner = { text, sub, t: 0, dur: 1.7, color };
  }

  // ---------- stats ----------
  statsOf(u: BUnit) {
    const tl = this.tile(u.c, u.r);
    if (u.team === 'player') {
      const b = baseStatsFor(u as { kind: string; level: number; perks: string[]; gear: string | null });
      let atk = b.atk;
      let move = b.move;
      let rmax = b.rmax;
      const penal = !u.supplied && !u.perks.includes('forager') && u.gear !== 'rations';
      if (penal) {
        atk -= 1;
        move -= 1;
      }
      if (tl.flood > 0 && !u.perks.includes('amphib') && u.gear !== 'waders') atk -= 1;
      if (b.rmax > 1 && tl.t === 'hill') rmax += 1;
      return { atk: Math.max(1, atk), move: Math.max(1, move), armor: b.armor, rmin: b.rmin, rmax, penal };
    }
    const d = ENEMIES[u.kind];
    let atk = d.atk + u.atkBonus;
    let move = d.move;
    let armor = d.armor;
    if (u.flags.enraged) {
      atk += 2;
      move += 1;
      armor += u.kind === 'colossus' ? 0 : 1;
    }
    if (tl.flood > 0) atk -= 1;
    let rmax = d.rmax;
    if (d.rmax > 1 && tl.t === 'hill') rmax += 1;
    return { atk: Math.max(1, atk), move, armor, rmin: d.rmin, rmax, penal: false };
  }

  hazardDmg(u: BUnit, base: number, kind: 'fire' | 'fall'): number {
    if (kind === 'fire') {
      if (FIRE_IMMUNE.has(u.kind) || u.perks.includes('pyreborn')) return 0;
      let d = u.gear === 'oilskin' ? 1 : base;
      if (u.team === 'player') d = Math.max(1, d - this.tech('hazmat'));
      return d;
    }
    let d = u.perks.includes('steady') || u.gear === 'hobnails' ? 1 : base;
    if (u.team === 'player') d = Math.max(1, d - this.tech('hazmat'));
    return d;
  }

  moveCost(u: BUnit, t: Tile): number {
    const info = TERRAIN[t.t];
    if (!info.passable) return 99;
    let c = info.cost;
    if (t.t === 'hill' && u.gear === 'hobnails') c = 1;
    if (t.flood > 0 && !(u.team === 'player' && (u.perks.includes('amphib') || u.gear === 'waders'))) c += 1;
    if (t.burn > 0) c += 2;
    return c;
  }

  computeReach(u: BUnit, mp: number) {
    const out = new Map<number, { cost: number; prev: number }>();
    const start = key(u.c, u.r);
    out.set(start, { cost: 0, prev: -1 });
    const open = [start];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (out.get(open[i])!.cost < out.get(open[bi])!.cost) bi = i;
      const k = open.splice(bi, 1)[0];
      const cur = out.get(k)!;
      const c = k % 64;
      const r = Math.floor(k / 64);
      for (const n of neighbors(c, r)) {
        if (!this.inb(n.c, n.r)) continue;
        const cost = this.moveCost(u, this.tile(n.c, n.r));
        if (cost >= 99) continue;
        const occ = this.unitAt(n.c, n.r);
        if (occ && occ.team !== u.team) continue;
        const nc = cur.cost + cost;
        if (nc > mp) continue;
        const nk = key(n.c, n.r);
        const ex = out.get(nk);
        if (!ex || nc < ex.cost) {
          out.set(nk, { cost: nc, prev: k });
          if (!open.includes(nk)) open.push(nk);
        }
      }
    }
    return out;
  }

  // ---------- map generation ----------
  private newTile(c: number, r: number): Tile {
    return { c, r, t: 'plain', flood: 0, burn: 0, warn: null, stable: false, depot: null, seed: this.rng.next(), anim: 0 };
  }

  private genMap() {
    const { w, h } = this;
    const rng = this.rng;
    const biome = this.mission.biome;
    this.tiles = [];
    for (let r = 0; r < h; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < w; c++) row.push(this.newTile(c, r));
      this.tiles.push(row);
    }
    const blob = (t: Terrain, n: number, rmin: number, rmax: number, p = 0.85) => {
      const safe = t === 'forest' || t === 'hill' || t === 'ash';
      for (let i = 0; i < n; i++) {
        const cc = safe ? rng.int(w) : rng.range(2, w - 3);
        const rr = rng.int(h);
        const rad = rng.range(rmin, rmax);
        for (let r = 0; r < h; r++)
          for (let c = 0; c < w; c++) {
            if (dist({ c, r }, { c: cc, r: rr }) <= rad && rng.next() < p) {
              if (!safe && (c < 2 || c > w - 3)) continue;
              this.tiles[r][c].t = t;
            }
          }
      }
    };
    if (biome === 'ash') {
      blob('forest', 7, 1, 2);
      blob('hill', 2, 1, 1);
      blob('mountain', 2, 0, 1);
      blob('ash', 3, 1, 1);
    } else if (biome === 'marsh') {
      blob('forest', 3, 1, 2);
      blob('hill', 3, 1, 2);
      blob('mountain', 1, 0, 0);
      let rc = Math.floor(w / 2) + rng.range(-1, 1);
      const riverRows: Tile[][] = [];
      for (let r = 0; r < h; r++) {
        const rowT: Tile[] = [];
        this.tiles[r][rc].t = 'water';
        rowT.push(this.tiles[r][rc]);
        if (rng.chance(0.4) && rc + 1 < w - 2) {
          this.tiles[r][rc + 1].t = 'water';
          rowT.push(this.tiles[r][rc + 1]);
        }
        riverRows.push(rowT);
        rc = Math.max(3, Math.min(w - 4, rc + rng.range(-1, 1)));
      }
      const fordRows = new Set<number>();
      while (fordRows.size < 3) fordRows.add(rng.int(h));
      fordRows.forEach((r) => riverRows[r].forEach((t) => (t.t = 'plain')));
      blob('water', 2, 0, 1);
    } else if (biome === 'fault') {
      blob('forest', 2, 1, 2);
      blob('hill', 3, 1, 1);
      blob('mountain', 3, 0, 1);
      blob('fault', 9, 1, 2, 0.9);
      blob('chasm', 3, 0, 0, 1);
    } else {
      blob('forest', 4, 1, 2);
      blob('hill', 3, 1, 2);
      blob('mountain', 2, 0, 1);
      blob('water', 2, 0, 1);
      blob('fault', 5, 1, 2, 0.9);
      blob('chasm', 1, 0, 0, 1);
    }
    const mid = Math.floor(h / 2);
    const setDepot = (c: number, r: number, owner: 'player' | 'enemy' | 'neutral', hq: boolean, obj: boolean) => {
      const t = this.tile(c, r);
      t.t = 'plain';
      t.flood = 0;
      t.stable = true;
      t.depot = { owner, hq, obj };
    };
    setDepot(1, mid, 'player', true, false);
    setDepot(w - 2, mid, 'enemy', false, false);
    const depots: Hex[] = [{ c: w - 2, r: mid }];
    if (this.mission.objective === 'seize') {
      const mc = Math.floor(w / 2) + rng.range(-1, 0);
      const a = { c: mc, r: Math.max(1, Math.floor(h / 4)) };
      const b = { c: mc + rng.range(0, 1), r: Math.min(h - 2, Math.floor((3 * h) / 4)) };
      setDepot(a.c, a.r, 'neutral', false, true);
      setDepot(b.c, b.r, 'neutral', false, true);
      depots.push(a, b);
    } else {
      const d = { c: Math.floor(w / 3) + rng.range(0, 1), r: rng.range(1, h - 2) };
      if (!(d.c === 1 && d.r === mid)) {
        setDepot(d.c, d.r, 'neutral', false, false);
        depots.push(d);
      }
    }
    // clear spawn areas of blockers
    for (let r = 0; r < h; r++)
      for (let c = 0; c < w; c++) {
        if ((c < 2 || c > w - 3) && !TERRAIN[this.tiles[r][c].t].passable) this.tiles[r][c].t = 'plain';
      }
    depots.forEach((d) => this.ensurePath({ c: 1, r: mid }, d));
  }

  private reachableTiles(a: Hex): Set<number> {
    const seen = new Set<number>([key(a.c, a.r)]);
    const open = [a];
    while (open.length) {
      const cur = open.pop()!;
      for (const n of neighbors(cur.c, cur.r)) {
        if (!this.inb(n.c, n.r)) continue;
        const k = key(n.c, n.r);
        if (seen.has(k) || !TERRAIN[this.tile(n.c, n.r).t].passable) continue;
        seen.add(k);
        open.push(n);
      }
    }
    return seen;
  }

  private ensurePath(a: Hex, b: Hex) {
    if (this.reachableTiles(a).has(key(b.c, b.r))) return;
    let cur = { ...a };
    let guard = 0;
    while ((cur.c !== b.c || cur.r !== b.r) && guard++ < 200) {
      const ns = neighbors(cur.c, cur.r).filter((n) => this.inb(n.c, n.r));
      ns.sort((p, q) => dist(p, b) - dist(q, b) + (this.rng.next() - 0.5) * 0.6);
      const nx = ns[0];
      const t = this.tile(nx.c, nx.r);
      if (!TERRAIN[t.t].passable) t.t = 'plain';
      cur = nx;
    }
  }

  private mkPlayer(ru: RosterUnit, c: number, r: number): BUnit {
    const maxHp = maxHpFor(ru);
    const p = this.px(c, r);
    return {
      id: this.nextId++, rid: ru.id, team: 'player', kind: ru.kind, name: ru.name, hp: maxHp, maxHp, level: ru.level, xp: ru.xp,
      perks: [...ru.perks], gear: ru.gear, pendingPerks: ru.pendingPerks, kills: ru.kills, atkBonus: 0, c, r, mp: 0, acted: false, moved: false,
      cd: 0, starve: 0, supplied: true, undo: null, x: p.x, y: p.y, path: [], flash: 0, lunge: null, dead: false, deathT: 0, boss: false, flags: {}, participated: true,
    };
  }

  mkEnemy(kind: string, c: number, r: number): BUnit {
    const d = ENEMIES[kind];
    const elite = this.cfg.mods.includes('elite');
    const lvl = 1 + (this.mission.eLevel - 1) * 0.08;
    const hp = Math.round(d.hp * this.diff.hp * (d.boss ? 1 : lvl)) + (elite ? 2 : 0);
    const p = this.px(c, r);
    if (d.boss) this.bossSeen = true;
    return {
      id: this.nextId++, rid: -1, team: 'enemy', kind, name: d.name, hp, maxHp: hp, level: this.mission.eLevel, xp: 0, perks: [], gear: null, pendingPerks: 0,
      kills: 0, atkBonus: (this.mission.eLevel >= 3 ? 1 : 0) + (elite ? 1 : 0), c, r, mp: 0, acted: false, moved: false, cd: d.ability ? 1 : 0, starve: 0, supplied: true,
      undo: null, x: p.x, y: p.y, path: [], flash: 0, lunge: null, dead: false, deathT: 0, boss: !!d.boss, flags: {}, participated: false,
    };
  }

  private freeTiles(filter: (t: Tile) => boolean): Tile[] {
    const out: Tile[] = [];
    for (const row of this.tiles) for (const t of row) if (TERRAIN[t.t].passable && !this.unitAt(t.c, t.r) && filter(t)) out.push(t);
    return out;
  }

  private spawnPlayers(roster: RosterUnit[]) {
    const mid = Math.floor(this.h / 2);
    const cands = this.freeTiles((t) => t.c <= 2).sort((a, b) => Math.abs(a.r - mid) + (2 - a.c) * 0.8 - (Math.abs(b.r - mid) + (2 - b.c) * 0.8));
    const order = ['vanguard', 'fusilier', 'scout', 'ranger', 'mortar', 'sapper', 'medic'];
    const list = [...roster].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
    const tiles = cands.slice(0, list.length).sort((a, b) => b.c - a.c || Math.abs(a.r - mid) - Math.abs(b.r - mid));
    list.forEach((ru, i) => {
      const t = tiles[i] || cands[i];
      if (t) this.units.push(this.mkPlayer(ru, t.c, t.r));
    });
  }

  private pickEnemyKinds(budget: number, kinds: string[]): string[] {
    const out: string[] = [];
    let b = budget;
    let guard = 0;
    while (b > 0 && guard++ < 60) {
      const opts = kinds.filter((k) => (ENEMIES[k].pts || 1) <= b);
      if (!opts.length) break;
      const k = this.rng.pick(opts);
      out.push(k);
      b -= ENEMIES[k].pts || 1;
    }
    return out;
  }

  private spawnEnemies() {
    const m = this.mission;
    const n = this.units.length;
    const budget = Math.max(3, Math.round(m.budget * this.diff.budget * (0.65 + 0.09 * n)));
    const kinds = this.pickEnemyKinds(budget, m.kinds);
    const cands = this.freeTiles((t) => t.c >= this.w - 3 && !t.depot).sort(() => this.rng.next() - 0.5);
    if (m.boss) {
      const bt = this.freeTiles((t) => t.c === this.w - 3 && Math.abs(t.r - Math.floor(this.h / 2)) <= 1)[0] || cands[0];
      if (bt) {
        this.units.push(this.mkEnemy(m.boss, bt.c, bt.r));
        const i = cands.indexOf(bt);
        if (i >= 0) cands.splice(i, 1);
      }
    }
    kinds.forEach((k, i) => {
      const t = cands[i];
      if (t) this.units.push(this.mkEnemy(k, t.c, t.r));
    });
  }

  private genTutorial() {
    this.w = 8;
    this.h = 6;
    this.tiles = [];
    for (let r = 0; r < 6; r++) {
      const row: Tile[] = [];
      for (let c = 0; c < 8; c++) row.push(this.newTile(c, r));
      this.tiles.push(row);
    }
    [[3, 1], [3, 2], [4, 4], [5, 4], [2, 4]].forEach(([c, r]) => (this.tile(c, r).t = 'forest'));
    [[4, 1], [5, 1]].forEach(([c, r]) => (this.tile(c, r).t = 'hill'));
    [[4, 2], [4, 3]].forEach(([c, r]) => (this.tile(c, r).t = 'fault'));
    this.tile(1, 3).t = 'plain';
    this.tile(1, 3).depot = { owner: 'player', hq: true, obj: false };
    this.tile(1, 3).stable = true;
    this.tile(6, 3).depot = { owner: 'enemy', hq: false, obj: false };
    this.tile(6, 3).stable = true;
    this.tile(2, 2).warn = { kind: 'collapse', eta: 1 };
    this.tile(2, 2).t = 'fault';
    const mk = (kind: string, name: string, id: number) =>
      ({ id, kind, name, level: 1, xp: 0, perks: [], gear: null, pendingPerks: 0, kills: 0, missions: 0, deploy: true }) as RosterUnit;
    this.units.push(this.mkPlayer(mk('fusilier', 'Rowan Pike', 1), 2, 3));
    this.units.push(this.mkPlayer(mk('sapper', 'Wren Kettle', 2), 2, 2));
    const e = this.mkEnemy('raider', 5, 3);
    e.hp = e.maxHp = 7;
    this.units.push(e);
  }

  // ---------- supply ----------
  supplyRange() {
    return Math.max(2, 5 + this.tech('quartermaster') - (this.cfg.mods.includes('famine') ? 2 : 0));
  }

  recalcSupply() {
    this.supplySet.clear();
    this.supplyParent.clear();
    const R = this.supplyRange();
    const open: { c: number; r: number; d: number }[] = [];
    for (const row of this.tiles)
      for (const t of row) {
        if (t.depot && t.depot.owner === 'player' && t.burn === 0) {
          const e = this.unitAt(t.c, t.r);
          if (e && e.team === 'enemy') continue;
          const k = key(t.c, t.r);
          this.supplySet.add(k);
          this.supplyParent.set(k, -1);
          open.push({ c: t.c, r: t.r, d: 0 });
        }
      }
    let i = 0;
    while (i < open.length) {
      const cur = open[i++];
      if (cur.d >= R) continue;
      for (const n of neighbors(cur.c, cur.r)) {
        if (!this.inb(n.c, n.r)) continue;
        const k = key(n.c, n.r);
        if (this.supplySet.has(k)) continue;
        const t = this.tile(n.c, n.r);
        if (!TERRAIN[t.t].passable || t.burn > 0 || t.flood > 0) continue;
        const e = this.unitAt(n.c, n.r);
        if (e && e.team === 'enemy') continue;
        this.supplySet.add(k);
        this.supplyParent.set(k, key(cur.c, cur.r));
        open.push({ c: n.c, r: n.r, d: cur.d + 1 });
      }
    }
    for (const u of this.units) if (u.team === 'player' && !u.dead) u.supplied = this.supplySet.has(key(u.c, u.r));
  }

  // ---------- hazards: planning ----------
  private setWarn(t: Tile, kind: WarnKind, eta: number): boolean {
    if (t.warn) return false;
    if (t.t === 'mountain' || t.t === 'water') return false;
    if (kind === 'collapse' && (t.stable || t.t === 'chasm' || t.depot)) return false;
    if (kind === 'ignite' && (t.t === 'chasm' || t.flood > 0 || t.burn > 0)) return false;
    if (kind === 'flood' && (t.t === 'hill' || t.flood > 0)) return false;
    t.warn = { kind, eta };
    const p = this.px(t.c, t.r);
    this.ring(p.x, p.y, kind === 'collapse' ? '#d8b48a' : kind === 'flood' ? '#5ec8ff' : '#ff9a3c', 0.9);
    return true;
  }

  private weightedPick<T>(items: { v: T; w: number }[], n: number): T[] {
    const pool = items.filter((i) => i.w > 0);
    const out: T[] = [];
    while (out.length < n && pool.length) {
      const total = pool.reduce((a, b) => a + b.w, 0);
      let x = this.rng.next() * total;
      let idx = 0;
      for (; idx < pool.length; idx++) {
        x -= pool[idx].w;
        if (x <= 0) break;
      }
      idx = Math.min(idx, pool.length - 1);
      out.push(pool[idx].v);
      pool.splice(idx, 1);
    }
    return out;
  }

  planHazards() {
    const m = this.mission;
    const grow = this.round - 1;
    const cat = this.cfg.mods.includes('cataclysm') ? 1 : 0;
    const roll = (k: 'collapse' | 'flood' | 'fire') => {
      if (m.haz[k] <= 0) return 0;
      return Math.floor((m.haz[k] + grow * m.hazGrow) * this.diff.haz + cat + this.rng.next());
    };
    let nCol = Math.max(0, roll('collapse') - this.tech('survey'));
    let nFlood = roll('flood');
    let nFire = roll('fire');
    const hasWater = this.tiles.some((row) => row.some((t) => t.t === 'water' || t.flood > 0));
    const hasForest = this.tiles.some((row) => row.some((t) => t.t === 'forest'));
    const wt = this.weather;
    if ((wt === 'rain' || wt === 'storm') && hasWater) nFlood += 1;
    if (wt === 'rain' || wt === 'storm') nFire = 0;
    if (wt === 'drought' && hasForest) nFire += 1;
    if (wt === 'storm' && m.haz.collapse > 0) nCol += 1;
    const early = (t: Tile) => this.round === 1 && t.c <= 2;
    // collapse
    const colC: { v: Tile; w: number }[] = [];
    for (const row of this.tiles)
      for (const t of row) {
        if (t.warn || t.stable || t.depot || early(t) || !TERRAIN[t.t].passable) continue;
        const nearChasm = neighbors(t.c, t.r).some((n) => this.inb(n.c, n.r) && this.tile(n.c, n.r).t === 'chasm');
        let w = t.t === 'fault' ? 5 : nearChasm ? 3 : 0.25;
        if (nearChasm && t.t === 'fault') w = 8;
        colC.push({ v: t, w });
      }
    this.weightedPick(colC, nCol).forEach((t) => this.setWarn(t, 'collapse', 1));
    // flood
    const floC: { v: Tile; w: number }[] = [];
    for (const row of this.tiles)
      for (const t of row) {
        if (t.warn || t.flood > 0 || t.t === 'hill' || t.t === 'mountain' || t.t === 'water' || early(t)) continue;
        const ns = neighbors(t.c, t.r).filter((n) => this.inb(n.c, n.r)).map((n) => this.tile(n.c, n.r));
        const wet = ns.some((n) => n.t === 'water' || n.flood > 0);
        floC.push({ v: t, w: wet ? (t.t === 'chasm' ? 2 : 4) : 0 });
      }
    this.weightedPick(floC, nFlood).forEach((t) => this.setWarn(t, 'flood', 1));
    // fire
    const burning: Tile[] = [];
    for (const row of this.tiles) for (const t of row) if (t.burn > 0) burning.push(t);
    const fireC = new Map<Tile, number>();
    const addF = (t: Tile, w: number) => fireC.set(t, Math.max(fireC.get(t) || 0, w));
    const spreadAny = wt === 'wind' || wt === 'drought' || wt === 'storm';
    burning.forEach((b) => {
      for (let d = 0; d < 6; d++) {
        const n = neighborAt(b.c, b.r, d);
        if (!this.inb(n.c, n.r)) continue;
        const t = this.tile(n.c, n.r);
        if (t.warn || t.burn > 0 || t.flood > 0 || !TERRAIN[t.t].passable) continue;
        const down = d === this.wind ? 3 : 1;
        if (TERRAIN[t.t].flammable) addF(t, 5 * down);
        else if (spreadAny && t.t !== 'ash' && t.t !== 'bridge') addF(t, 1.2 * down);
        if ((wt === 'wind' || wt === 'storm') && d === this.wind) {
          const n2 = neighborAt(n.c, n.r, d);
          if (this.inb(n2.c, n2.r)) {
            const t2 = this.tile(n2.c, n2.r);
            if (!t2.warn && t2.burn === 0 && t2.flood === 0 && TERRAIN[t2.t].flammable) addF(t2, 4);
          }
        }
      }
    });
    const fireItems = [...fireC.entries()].map(([v, w]) => ({ v, w }));
    if (nFire > 0 && burning.length === 0) {
      for (const row of this.tiles)
        for (const t of row) if (!early(t) && !t.warn && t.flood === 0 && TERRAIN[t.t].flammable && t.c > 2 && t.c < this.w - 2) fireItems.push({ v: t, w: 1 });
    }
    const rainy = wt === 'rain' || wt === 'storm';
    const spreadN = rainy ? 0 : burning.length ? Math.max(nFire, Math.ceil(burning.length / 2)) : nFire;
    this.weightedPick(fireItems, Math.min(spreadN, fireItems.length)).forEach((t) => this.setWarn(t, 'ignite', 1));
    if (wt === 'storm') {
      const cand = this.freeTiles((t) => !t.warn && t.flood === 0 && t.c > 1 && !t.depot);
      if (cand.length) this.setWarn(this.rng.pick(cand), 'ignite', 1);
    }
  }

  forecast() {
    const f = { collapse: 0, flood: 0, ignite: 0, enemyCast: 0 };
    for (const row of this.tiles) for (const t of row) if (t.warn) f[t.warn.kind]++;
    return f;
  }

  // ---------- round flow ----------
  startPlayerPhase(initial = false) {
    this.phase = 'player';
    for (const u of this.alive('player')) {
      u.mp = this.statsOf(u).move;
      u.acted = false;
      u.moved = false;
      u.undo = null;
      if (!initial && u.cd > 0) u.cd--;
    }
    this.selected = null;
    this.mode = 'move';
    this.reachMap.clear();
    const wi = WEATHER_INFO[this.weather];
    this.say(`ROUND ${this.round}`, `Tonight: ${wi.icon} ${wi.name}`, '#f5d78a');
    if (!initial) audio.sfx('newround');
    audio.intensity = 0.35;
    this.refreshThreat();
    this.changed();
  }

  endTurn() {
    if (this.phase !== 'player' || this.busy()) return;
    audio.sfx('endturn');
    this.selected = null;
    this.reachMap.clear();
    this.mode = 'move';
    this.phase = 'enemy';
    this.say('ENEMY PHASE', 'They advance…', '#ff7a6a');
    audio.sfx('enemyphase');
    audio.intensity = 0.7;
    const players = this.alive('player');
    this.queue = this.alive('enemy').sort((a, b) => {
      const da = Math.min(...players.map((p) => dist(a, p)), 99);
      const db = Math.min(...players.map((p) => dist(b, p)), 99);
      return da - db;
    });
    this.queue.forEach((e) => {
      if (e.cd > 0) e.cd--;
    });
    this.later(1.1, () => this.enemyStep(), true);
    this.changed();
  }

  private enemyStep() {
    if (this.phase !== 'enemy') return;
    if (this.checkEnd()) return;
    let e = this.queue.shift();
    while (e && e.dead) e = this.queue.shift();
    if (!e) {
      this.startHazard();
      return;
    }
    this.aiAct(e);
  }

  // ---------- AI ----------
  private danger(e: BUnit, t: Tile): number {
    let d = 0;
    if (t.burn > 0 && !FIRE_IMMUNE.has(e.kind)) d += 12;
    if (t.warn) {
      if (t.warn.kind === 'collapse') d += 6;
      else if (t.warn.kind === 'ignite' && !FIRE_IMMUNE.has(e.kind)) d += 4;
      else if (t.warn.kind === 'flood') d += 1.5;
    }
    if (t.flood > 0) d += 1;
    return d * this.diff.smart;
  }

  private aiAct(e: BUnit) {
    const def = ENEMIES[e.kind];
    this.bossCheck(e);
    const players = this.alive('player');
    if (!players.length) {
      this.later(0.1, () => this.enemyStep(), true);
      return;
    }
    const st = this.statsOf(e);
    const R = this.computeReach(e, st.move);
    type Cand = { c: number; r: number; score: number; act: null | { type: 'attack'; target: BUnit } | { type: 'cast'; at: Tile; target: BUnit | null } };
    let best: Cand | null = null;
    const ai = def.ai || 'rush';
    const nearestDist = (c: number, r: number) => Math.min(...players.map((p) => dist({ c, r }, p)));
    const wantsDepot = ai === 'flank' || ai === 'rush' || ai === 'boss';
    for (const [k] of R) {
      const c = k % 64;
      const r = Math.floor(k / 64);
      const occ = this.unitAt(c, r);
      if (occ && occ !== e) continue;
      const tl = this.tile(c, r);
      let score = -this.danger(e, tl) + TERRAIN[tl.t].cover * 1.2;
      let act: Cand['act'] = null;
      let actScore = 0;
      for (const p of players) {
        const d = dist({ c, r }, p);
        const rmax = st.rmax + (def.rmax > 1 && tl.t === 'hill' ? 0 : 0);
        if (d >= st.rmin && d <= rmax) {
          const pst = this.statsOf(p);
          const cover = TERRAIN[this.tile(p.c, p.r).t].cover;
          const dmg = Math.max(1, st.atk - pst.armor - cover);
          const kill = dmg >= p.hp;
          const counter = !kill && d >= pst.rmin && d <= pst.rmax ? Math.max(1, pst.atk - st.armor - TERRAIN[tl.t].cover) : 0;
          const s = dmg * 1.5 + (kill ? 10 : 0) + (PRIORITY[p.kind] || 1) * (ai === 'flank' ? 2 : 1) - counter * 1.1;
          if (s > actScore) {
            actScore = s;
            act = { type: 'attack', target: p };
          }
        }
        if (def.ability && e.cd === 0 && d >= def.ability.rmin && d <= def.ability.rmax) {
          const around = players.filter((q) => dist(q, p) <= 1).length;
          let v = 3 + around * 2.5;
          if (def.ability.id === 'firebolt') v += TERRAIN[this.tile(p.c, p.r).t].flammable ? 2 : 0;
          if (def.ability.id === 'fissure') v += around * 1.5;
          const s = v * 1.4;
          if (s > actScore) {
            actScore = s;
            act = { type: 'cast', at: this.tile(p.c, p.r), target: p };
          }
        }
      }
      score += actScore;
      const nd = nearestDist(c, r);
      if (ai === 'ranged' || ai === 'caster') {
        const want = def.ability ? def.ability.rmax - 1 : st.rmax;
        score -= Math.abs(nd - want) * 0.9;
        if (nd < 2) score -= 3;
      } else if (ai === 'flank') {
        let g = 99;
        for (const p of players) g = Math.min(g, dist({ c, r }, p) / (PRIORITY[p.kind] || 1));
        score -= g * 0.7;
      } else {
        score -= nd * 0.8;
      }
      if (wantsDepot && tl.depot && tl.depot.owner !== 'enemy') score += tl.depot.hq ? 14 : ai === 'flank' ? 9 : 4;
      if (wantsDepot && tl.depot && tl.depot.hq) score += 6;
      score += Math.random() * 0.25;
      if (!best || score > best.score) best = { c, r, score, act };
    }
    if (!best) {
      this.later(0.1, () => this.enemyStep(), true);
      return;
    }
    const chosen = best;
    if (chosen.c !== e.c || chosen.r !== e.r) this.startMove(e, chosen.c, chosen.r, R, false);
    this.later(0.05, () => {
      if (!e.dead) {
        const a = chosen.act;
        if (a && a.type === 'attack' && !a.target.dead) this.attack(e, a.target, 0);
        else if (a && a.type === 'cast') this.castSpell(e, def.ability!.id, a.at);
        if (def.ability && a && a.type === 'cast') e.cd = def.ability.cd;
        if (e.kind === 'warden') this.wardenSpells(e);
      }
      this.later(0.85, () => this.enemyStep(), true);
    }, true);
  }

  private bossCheck(e: BUnit) {
    if (!e.boss || e.dead) return;
    const pct = e.hp / e.maxHp;
    if (e.kind === 'colossus' && pct < 0.5 && !e.flags.enraged) {
      e.flags.enraged = true;
      this.say('THE COLOSSUS ENRAGES', '+2 attack, +1 move, wilder flames', '#ff5a3a');
      audio.sfx('boss');
      this.shake(14);
    }
    if (e.kind === 'warden') {
      if (pct < 0.66 && !e.flags.s1) {
        e.flags.s1 = true;
        this.summon(2);
      }
      if (pct < 0.33 && !e.flags.s2) {
        e.flags.s2 = true;
        e.flags.enraged = true;
        this.say('THE WARDEN UNLEASHED', 'Double spellcasting', '#ff5a3a');
        this.summon(2);
      }
    }
  }

  private summon(n: number) {
    const w = this.units.find((u) => u.kind === 'warden' && !u.dead);
    if (!w) return;
    audio.sfx('boss');
    this.shake(10);
    let spawned = 0;
    for (const nb of neighbors(w.c, w.r).concat(neighbors(w.c - 1, w.r))) {
      if (spawned >= n) break;
      if (!this.inb(nb.c, nb.r)) continue;
      const t = this.tile(nb.c, nb.r);
      if (!TERRAIN[t.t].passable || this.unitAt(nb.c, nb.r)) continue;
      const u = this.mkEnemy('raider', nb.c, nb.r);
      this.units.push(u);
      const p = this.px(nb.c, nb.r);
      this.burst(p.x, p.y, '#b04aff', 16, 4, 0.8, 0.16);
      this.ring(p.x, p.y, '#b04aff');
      spawned++;
    }
    this.say('REINFORCEMENTS', 'The Warden summons raiders!', '#c77dff');
  }

  private wardenSpells(w: BUnit) {
    const players = this.alive('player');
    if (!players.length || w.dead) return;
    const n = w.flags.enraged ? 2 : 1;
    const spells = ['firebolt', 'fissure', 'surge'];
    for (let i = 0; i < n; i++) {
      const p = players[this.rng.int(players.length)];
      const sp = spells[this.rng.int(3)];
      this.later(0.4 + i * 0.4, () => {
        if (!w.dead) this.castSpell(w, sp, this.tile(p.c, p.r));
      });
    }
  }

  castSpell(caster: BUnit, id: string, at: Tile) {
    const from = this.px(caster.c, caster.r);
    const to = this.px(at.c, at.r);
    const color = id === 'firebolt' ? '#ff8a3c' : id === 'fissure' ? '#c9a070' : '#4fc3ff';
    this.projs.push({ x0: from.x, y0: from.y - 0.3, x1: to.x, y1: to.y, t: 0, dur: 0.4, color });
    audio.sfx(id === 'firebolt' ? 'ignite' : id === 'fissure' ? 'collapse' : 'flood');
    this.later(0.4, () => {
      const nbs = neighbors(at.c, at.r).filter((n) => this.inb(n.c, n.r)).map((n) => this.tile(n.c, n.r));
      this.burst(to.x, to.y, color, 18, 4, 0.7, 0.14);
      this.ring(to.x, to.y, color);
      if (id === 'firebolt') {
        const u = this.unitAt(at.c, at.r);
        if (u && u.team === 'player') this.damageUnit(u, Math.max(1, this.statsOf(caster).atk - this.statsOf(u).armor), caster, 'spell', `${caster.name}'s Firebolt`);
        this.setWarn(at, 'ignite', 2);
        const flam = nbs.filter((t) => TERRAIN[t.t].flammable && !t.warn);
        if (flam.length) this.setWarn(this.rng.pick(flam), 'ignite', 2);
      } else if (id === 'fissure') {
        this.setWarn(at, 'collapse', 2);
        const ok = nbs.filter((t) => !t.warn && !t.stable && !t.depot);
        ok.sort(() => this.rng.next() - 0.5)
          .slice(0, 2)
          .forEach((t) => this.setWarn(t, 'collapse', 2));
      } else {
        this.setWarn(at, 'flood', 2);
        nbs
          .filter((t) => !t.warn)
          .sort(() => this.rng.next() - 0.5)
          .slice(0, 3)
          .forEach((t) => this.setWarn(t, 'flood', 2));
      }
      this.changed();
    });
  }

  // ---------- movement ----------
  private startMove(u: BUnit, c: number, r: number, R: Map<number, { cost: number; prev: number }>, spend: boolean) {
    const dest = key(c, r);
    const info = R.get(dest);
    if (!info) return;
    const chain: number[] = [];
    let k = dest;
    let guard = 0;
    while (k !== -1 && guard++ < 100) {
      chain.push(k);
      k = R.get(k)!.prev;
    }
    chain.reverse();
    chain.shift();
    if (spend && !u.undo && !u.acted) u.undo = { c: u.c, r: u.r, mp: u.mp };
    u.path = chain.map((kk) => this.px(kk % 64, Math.floor(kk / 64)));
    u.c = c;
    u.r = r;
    u.moved = true;
    if (spend) u.mp -= info.cost;
    audio.sfx('move');
    this.recalcSupply();
    this.changed();
  }

  moveSelected(c: number, r: number) {
    const u = this.selected;
    if (!u || u.team !== 'player' || this.busy()) return;
    if (!this.reachMap.has(key(c, r)) || this.unitAt(c, r)) return;
    this.movedEver = true;
    this.startMove(u, c, r, this.reachMap, true);
    this.mode = 'move';
    this.refreshReach();
    this.later(0.05, () => this.afterAction(u), true);
  }

  undoMove() {
    const u = this.selected;
    if (!u || !u.undo || u.acted || this.busy() || this.phase !== 'player') return;
    u.c = u.undo.c;
    u.r = u.undo.r;
    u.mp = u.undo.mp;
    const p = this.px(u.c, u.r);
    u.x = p.x;
    u.y = p.y;
    u.path = [];
    u.undo = null;
    u.moved = false;
    audio.sfx('click');
    this.recalcSupply();
    this.refreshReach();
    this.refreshThreat();
    this.changed();
  }

  private afterAction(u: BUnit) {
    this.recalcSupply();
    this.refreshReach();
    this.refreshThreat();
    // capture preview not needed
    if (u.dead) this.selected = null;
    this.changed();
  }

  refreshReach() {
    this.reachMap.clear();
    const u = this.selected;
    if (u && u.team === 'player' && !u.dead && this.phase === 'player' && u.mp > 0) this.reachMap = this.computeReach(u, u.mp);
  }

  refreshThreat() {
    this.threat.clear();
    if (!this.showThreat) return;
    for (const e of this.alive('enemy')) {
      const st = this.statsOf(e);
      const R = this.computeReach(e, st.move);
      for (const [k] of R) {
        const c = k % 64;
        const r = Math.floor(k / 64);
        for (let rr = 0; rr < this.h; rr++) for (let cc = 0; cc < this.w; cc++) if (dist({ c, r }, { c: cc, r: rr }) <= st.rmax && dist({ c, r }, { c: cc, r: rr }) >= st.rmin) this.threat.add(key(cc, rr));
      }
    }
  }

  toggleThreat() {
    this.showThreat = !this.showThreat;
    this.refreshThreat();
    this.changed();
  }

  // ---------- selection / input ----------
  select(u: BUnit | null) {
    this.selected = u && u.team === 'player' ? u : null;
    this.inspected = u;
    this.mode = 'move';
    this.refreshReach();
    if (u) audio.sfx('select');
    this.changed();
  }

  cycleUnit() {
    const list = this.alive('player').filter((u) => !u.acted || u.mp > 0);
    if (!list.length) return;
    const i = this.selected ? list.indexOf(this.selected) : -1;
    this.select(list[(i + 1) % list.length]);
  }

  pick(px: number, py: number): Hex | null {
    const { size, ox, oy } = this.view;
    const wx = (px - ox) / size;
    const wy = (py - oy) / size;
    let best: Hex | null = null;
    let bd = 0.98;
    for (let r = 0; r < this.h; r++)
      for (let c = 0; c < this.w; c++) {
        const p = this.px(c, r);
        const d = Math.hypot(p.x - wx, p.y - wy);
        if (d < bd) {
          bd = d;
          best = { c, r };
        }
      }
    return best;
  }

  setMode(m: 'move' | 'ability') {
    const u = this.selected;
    if (!u) return;
    if (m === 'ability' && !this.abilityReady(u)) {
      audio.sfx('error');
      return;
    }
    this.mode = this.mode === m ? 'move' : m;
    audio.sfx('click');
    this.changed();
  }

  abilityReady(u: BUnit): boolean {
    const a = CLASSES[u.kind]?.ability;
    if (!a || u.team !== 'player') return false;
    if (u.cd > 0 || u.acted) return false;
    if (CLASSES[u.kind].passive === 'setup' && u.moved) return false;
    return this.abilityTargets(u).length > 0;
  }

  shoreRange() {
    return 2 + (this.tech('engineers') >= 1 ? 1 : 0);
  }

  abilityCd(u: BUnit): number {
    const a = CLASSES[u.kind]?.ability;
    if (!a) return 0;
    if (a.id === 'shore' && this.tech('engineers') >= 2) return Math.max(0, a.cd - 1);
    return a.cd;
  }

  abilityTargets(u: BUnit): Hex[] {
    const a = CLASSES[u.kind]?.ability;
    if (!a) return [];
    const out: Hex[] = [];
    const rmax = a.id === 'shore' ? this.shoreRange() : a.rmax;
    for (let r = 0; r < this.h; r++)
      for (let c = 0; c < this.w; c++) {
        const d = dist(u, { c, r });
        if (d < a.rmin || d > rmax) continue;
        const t = this.tile(c, r);
        const o = this.unitAt(c, r);
        switch (a.id) {
          case 'shove':
            if (o && o.team === 'enemy' && !o.boss) out.push({ c, r });
            break;
          case 'snipe':
            if (o && o.team === 'enemy') out.push({ c, r });
            break;
          case 'shore':
            if (t.warn || t.burn > 0 || t.flood > 0 || t.t === 'chasm' || (t.t === 'fault' && !t.stable)) out.push({ c, r });
            break;
          case 'mend':
            if (o && o.team === 'player' && o !== u && o.hp < o.maxHp) out.push({ c, r });
            break;
          case 'incendiary':
            if (TERRAIN[t.t].passable && t.flood === 0 && t.burn === 0) out.push({ c, r });
            break;
        }
      }
    return out;
  }

  attackTargets(u: BUnit): BUnit[] {
    if (u.team !== 'player' || u.acted || u.dead || this.phase !== 'player') return [];
    if (CLASSES[u.kind].passive === 'setup' && u.moved) return [];
    const st = this.statsOf(u);
    return this.alive('enemy').filter((e) => {
      const d = dist(u, e);
      return d >= st.rmin && d <= st.rmax;
    });
  }

  clickHex(c: number, r: number) {
    if (this.phase !== 'player' || this.busy() || this.result) return;
    const u = this.unitAt(c, r);
    const sel = this.selected;
    if (sel && this.mode === 'ability') {
      const ok = this.abilityTargets(sel).some((t) => t.c === c && t.r === r);
      if (ok) {
        this.useAbility(sel, this.tile(c, r));
        return;
      }
      this.mode = 'move';
    }
    if (sel && u && u.team === 'enemy') {
      if (this.attackTargets(sel).includes(u)) {
        this.attackedEver = true;
        this.attack(sel, u, 0);
        return;
      }
      this.inspected = u;
      audio.sfx('click');
      this.changed();
      return;
    }
    if (sel && !u && this.reachMap.has(key(c, r))) {
      this.moveSelected(c, r);
      return;
    }
    if (u && u.team === 'player') {
      this.select(u);
      return;
    }
    if (u) {
      this.inspected = u;
      this.changed();
      return;
    }
    if (sel) {
      this.select(null);
    }
  }

  // ---------- combat ----------
  flankBonus(att: BUnit, def: BUnit): number {
    return this.units.some((u) => !u.dead && u !== att && u.team === att.team && dist(u, def) === 1) ? 1 : 0;
  }

  calcDamage(att: BUnit, def: BUnit, bonus = 0): number {
    const as = this.statsOf(att);
    const ds = this.statsOf(def);
    let cover = TERRAIN[this.tile(def.c, def.r).t].cover;
    if (att.kind === 'mortar') cover = 0;
    let d = as.atk + bonus - ds.armor - cover + this.flankBonus(att, def);
    if (att.perks.includes('exec') && def.hp <= def.maxHp / 2) d += 2;
    return Math.max(1, d);
  }

  preview(att: BUnit, def: BUnit, bonus = 0) {
    const dmg = this.calcDamage(att, def, bonus);
    const ds = this.statsOf(def);
    const d = dist(att, def);
    let counter = 0;
    if (dmg < def.hp && d >= ds.rmin && d <= ds.rmax) counter = Math.max(1, ds.atk - this.statsOf(att).armor - TERRAIN[this.tile(att.c, att.r).t].cover);
    return { dmg, counter, kill: dmg >= def.hp };
  }

  attack(att: BUnit, def: BUnit, bonus: number) {
    att.acted = true;
    att.undo = null;
    att.participated = true;
    const ranged = dist(att, def) > 1;
    const a = this.px(att.c, att.r);
    const b = this.px(def.c, def.r);
    if (att.team === 'player') {
      att.mp = CLASSES[att.kind].passive === 'hitrun' ? Math.min(att.mp, 2) : 0;
    }
    audio.sfx(ranged ? 'shot' : 'counter');
    if (ranged) {
      this.projs.push({ x0: a.x, y0: a.y - 0.2, x1: b.x, y1: b.y - 0.2, t: 0, dur: 0.28, color: att.kind === 'mortar' ? '#ffb347' : '#fff1b8' });
    } else {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l = Math.hypot(dx, dy) || 1;
      att.lunge = { dx: dx / l, dy: dy / l, t: 0 };
    }
    this.later(ranged ? 0.3 : 0.16, () => this.strike(att, def, bonus));
    this.refreshReach();
    this.changed();
  }

  private strike(att: BUnit, def: BUnit, bonus: number) {
    if (att.dead || def.dead) return;
    const crit = bonus >= 3;
    const dmg = this.calcDamage(att, def, bonus);
    audio.sfx(crit ? 'crit' : 'hit');
    this.damageUnit(def, dmg, att, 'attack', `${att.name} (${CLASSES[att.kind]?.name || ENEMIES[att.kind].name})`);
    if (att.team === 'player') this.gainXp(att, def.dead ? 2 : 2);
    if (!def.dead) {
      const ds = this.statsOf(def);
      const d = dist(att, def);
      if (d >= ds.rmin && d <= ds.rmax && bonus !== -1) {
        this.later(0.3, () => {
          if (def.dead || att.dead) return;
          const cd = Math.max(1, ds.atk - this.statsOf(att).armor - TERRAIN[this.tile(att.c, att.r).t].cover);
          const b = this.px(att.c, att.r);
          const a = this.px(def.c, def.r);
          const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          def.lunge = { dx: (b.x - a.x) / l, dy: (b.y - a.y) / l, t: 0 };
          this.later(0.12, () => {
            if (def.dead || att.dead) return;
            audio.sfx('counter');
            this.float(b.x, b.y - 0.3, 'COUNTER', '#ffd27a', 0.34);
            this.damageUnit(att, cd, def, 'counter', `${def.name}'s counter`);
            if (def.team === 'player') this.gainXp(def, 1);
          });
        });
      }
    }
    this.afterAction(att);
  }

  gainXp(u: BUnit, amt: number) {
    if (u.team !== 'player' || u.dead) return;
    const mult = 1 + 0.25 * this.tech('academy') + (u.perks.includes('scholar') ? 0.5 : 0);
    u.xp += Math.max(1, Math.round(amt * mult));
    const lvl = Math.min(5, levelForXp(u.xp));
    while (u.level < lvl) {
      u.level++;
      u.pendingPerks++;
      const oldMax = u.maxHp;
      u.maxHp = maxHpFor(u as { kind: string; level: number; perks: string[]; gear: string | null });
      u.hp += u.maxHp - oldMax;
      const p = this.px(u.c, u.r);
      this.float(p.x, p.y - 0.3, 'LEVEL UP!', '#ffe14d', 0.6);
      this.burst(p.x, p.y, '#ffe14d', 24, 5, 0.9, 0.14);
      this.ring(p.x, p.y, '#ffe14d');
      audio.sfx('levelup');
    }
  }

  damageUnit(u: BUnit, amt: number, src: BUnit | null, cause: string, label: string) {
    if (u.dead) return;
    const p = this.px(u.c, u.r);
    u.hp -= amt;
    u.flash = 0.22;
    if (amt > 0) {
      this.float(p.x, p.y, `-${amt}`, u.team === 'player' ? '#ff6a6a' : '#ffffff', 0.55);
      this.burst(p.x, p.y, u.team === 'player' ? '#ff5050' : '#ffcf8a', 10, 3.5, 0.5, 0.1);
      this.shake(amt >= 5 ? 8 : 4);
    }
    if (u.team === 'player') this.stats.taken += amt;
    else this.stats.dealt += amt;
    if (u.hp <= 0) {
      u.hp = 0;
      this.killUnit(u, src, cause, label);
    } else this.bossCheck(u);
    this.changed();
  }

  killUnit(u: BUnit, src: BUnit | null, cause: string, label: string) {
    if (u.dead) return;
    u.dead = true;
    u.deathT = 0.6;
    u.path = [];
    const p = this.px(u.c, u.r);
    this.burst(p.x, p.y, u.team === 'player' ? '#7ad7ff' : '#ff8a5a', 28, 5, 1, 0.16, 4);
    this.ring(p.x, p.y, '#ffffff', 1);
    this.shake(u.boss ? 18 : 9);
    audio.sfx('death');
    if (u.team === 'enemy') {
      this.stats.kills++;
      const env = cause === 'hazard' || cause === 'push';
      if (env) {
        this.stats.envKills++;
        this.float(p.x, p.y - 0.5, 'ENVIRONMENT KILL!', '#7fffd4', 0.45);
      }
      if (src && src.team === 'player') {
        src.kills++;
        this.gainXp(src, ENEMIES[u.kind].xp || 4);
        if (src.perks.includes('drinker') && src.hp < src.maxHp) {
          const h = Math.min(3, src.maxHp - src.hp);
          src.hp += h;
          const sp = this.px(src.c, src.r);
          this.float(sp.x, sp.y, `+${h}`, '#7dff9a', 0.45);
        }
      }
    } else {
      this.stats.lost++;
      this.fallen.push({ name: u.name, kind: u.kind, level: u.level, mission: this.mission.name, cause: label, kills: u.kills });
      this.float(p.x, p.y - 0.5, `${u.name} has fallen`, '#ff8080', 0.4);
    }
    this.recalcSupply();
    if (this.selected === u) {
      this.selected = null;
      this.reachMap.clear();
    }
    this.changed();
  }

  // ---------- abilities ----------
  useAbility(u: BUnit, t: Tile) {
    const a = CLASSES[u.kind].ability;
    if (!a || u.acted || u.cd > 0) return;
    u.participated = true;
    const target = this.unitAt(t.c, t.r);
    const p = this.px(t.c, t.r);
    const me = this.px(u.c, u.r);
    this.mode = 'move';
    switch (a.id) {
      case 'snipe':
        if (!target) return;
        u.cd = this.abilityCd(u);
        this.attack(u, target, 3);
        return;
      case 'shove':
        if (!target) return;
        u.acted = true;
        u.mp = 0;
        u.undo = null;
        u.cd = this.abilityCd(u);
        audio.sfx('shove');
        u.lunge = { dx: p.x - me.x, dy: p.y - me.y, t: 0 };
        this.later(0.15, () => this.doShove(u, target));
        break;
      case 'shore':
        u.acted = true;
        u.undo = null;
        u.mp = 0;
        u.cd = this.abilityCd(u);
        this.doShore(u, t);
        break;
      case 'mend':
        if (!target) return;
        u.acted = true;
        u.undo = null;
        u.mp = 0;
        {
          const h = Math.min(4, target.maxHp - target.hp);
          target.hp += h;
          target.starve = 0;
          this.float(p.x, p.y, `+${h}`, '#7dff9a', 0.6);
          this.burst(p.x, p.y, '#7dff9a', 16, 3, 0.8, 0.12, -1);
          this.ring(p.x, p.y, '#7dff9a');
          audio.sfx('heal');
          this.gainXp(u, 2);
        }
        break;
      case 'incendiary':
        u.acted = true;
        u.undo = null;
        u.mp = 0;
        u.cd = this.abilityCd(u);
        this.projs.push({ x0: me.x, y0: me.y - 0.3, x1: p.x, y1: p.y, t: 0, dur: 0.45, color: '#ff9a3c' });
        audio.sfx('shot');
        this.later(0.45, () => {
          this.igniteTile(t, 'Incendiary');
          if (target) this.damageUnit(target, 2, u, 'attack', `${u.name}'s Incendiary`);
          this.afterAction(u);
        });
        break;
    }
    this.afterAction(u);
  }

  private doShove(u: BUnit, def: BUnit) {
    if (def.dead) return;
    const d = neighborAt(def.c, def.r, this.dirOf(u, def));
    const p = this.px(def.c, def.r);
    this.burst(p.x, p.y, '#ffffff', 10, 3, 0.4, 0.1);
    this.shake(6);
    if (!this.inb(d.c, d.r)) {
      this.damageUnit(def, 1, u, 'attack', 'Shoved');
      this.afterAction(u);
      return;
    }
    const t = this.tile(d.c, d.r);
    const occ = this.unitAt(d.c, d.r);
    if (t.t === 'chasm') {
      this.float(p.x, p.y - 0.3, 'INTO THE ABYSS!', '#ffd27a', 0.45);
      def.c = d.c;
      def.r = d.r;
      def.path = [this.px(d.c, d.r)];
      this.later(0.3, () => this.damageUnit(def, def.boss ? 8 : 999, u, 'push', 'Hurled into a chasm'));
    } else if (t.t === 'water') {
      this.float(p.x, p.y - 0.3, 'DROWNED!', '#7fd4ff', 0.45);
      def.c = d.c;
      def.r = d.r;
      def.path = [this.px(d.c, d.r)];
      audio.sfx('splash');
      this.later(0.3, () => this.damageUnit(def, 999, u, 'push', 'Pushed into deep water'));
    } else if (t.t === 'mountain' || (occ && occ !== def)) {
      this.damageUnit(def, 2, u, 'push', 'Slammed');
      if (occ) this.damageUnit(occ, 2, u, 'push', 'Collision');
    } else {
      def.c = d.c;
      def.r = d.r;
      def.path = [this.px(d.c, d.r)];
      this.damageUnit(def, 1, u, 'attack', 'Shoved');
      if (t.burn > 0) {
        const fd = this.hazardDmg(def, 3, 'fire');
        if (fd > 0) this.later(0.3, () => this.damageUnit(def, fd, u, 'push', 'Shoved into flames'));
      }
    }
    this.gainXp(u, 2);
    this.recalcSupply();
    this.afterAction(u);
  }

  private dirOf(a: Hex, b: Hex): number {
    return Math.max(0, dirBetween(a, b));
  }

  private doShore(u: BUnit, t: Tile) {
    const p = this.px(t.c, t.r);
    let msg = 'SHORED';
    if (t.t === 'chasm') {
      t.t = 'bridge';
      t.anim = 1;
      msg = 'BRIDGE BUILT';
    }
    if (t.burn > 0) {
      t.burn = 0;
      if (t.t !== 'bridge') t.t = 'ash';
      msg = 'FIREBREAK';
    }
    if (t.flood > 0) {
      t.flood = 0;
      msg = 'DRAINED';
    }
    if (t.warn) {
      t.warn = null;
      msg = 'HAZARD CANCELLED';
    }
    t.stable = true;
    this.stats.shores++;
    this.float(p.x, p.y - 0.2, msg, '#9dffb0', 0.45);
    this.burst(p.x, p.y, '#caa66a', 16, 3, 0.7, 0.12, 4, 's');
    this.ring(p.x, p.y, '#9dffb0');
    audio.sfx('shore');
    this.gainXp(u, 3);
    this.recalcSupply();
  }

  private igniteTile(t: Tile, label: string) {
    const p = this.px(t.c, t.r);
    if (!TERRAIN[t.t].passable || t.flood > 0) {
      this.float(p.x, p.y, 'FIZZLE', '#9ec9ff', 0.4);
      return;
    }
    t.burn = t.t === 'forest' ? 4 : 3;
    t.warn = null;
    this.burst(p.x, p.y, '#ff8a2a', 20, 3.5, 0.8, 0.14, -1);
    this.ring(p.x, p.y, '#ff8a2a');
    this.float(p.x, p.y - 0.4, label.toUpperCase(), '#ffae5a', 0.4);
    audio.sfx('ignite');
    this.shake(5);
    this.recalcSupply();
  }

  // ---------- hazards: execution ----------
  private startHazard() {
    if (this.checkEnd()) return;
    this.phase = 'hazard';
    this.say('HAZARD PHASE', 'The land answers…', '#ffb04a');
    audio.sfx('warn');
    audio.intensity = 0.9;
    const col: Tile[] = [];
    const flo: Tile[] = [];
    const ign: Tile[] = [];
    for (const row of this.tiles)
      for (const t of row)
        if (t.warn) {
          t.warn.eta--;
          if (t.warn.eta <= 0) (t.warn.kind === 'collapse' ? col : t.warn.kind === 'flood' ? flo : ign).push(t);
        }
    let tm = 1.1;
    if (col.length) {
      this.later(tm, () => {
        audio.sfx('collapse');
        col.forEach((t, i) => this.later(i * 0.12, () => this.collapseTile(t)));
      });
      tm += 0.9 + col.length * 0.12;
    }
    if (flo.length) {
      this.later(tm, () => {
        audio.sfx('flood');
        flo.forEach((t, i) => this.later(i * 0.1, () => this.floodTile(t)));
      });
      tm += 0.9 + flo.length * 0.1;
    }
    if (ign.length) {
      this.later(tm, () => {
        audio.sfx('ignite');
        ign.forEach((t, i) => this.later(i * 0.1, () => this.igniteWarn(t)));
      });
      tm += 0.7 + ign.length * 0.1;
    }
    this.later(tm, () => this.upkeep(), true);
    this.changed();
  }

  private collapseTile(t: Tile) {
    t.warn = null;
    if (t.stable || t.t === 'chasm' || t.t === 'water' || t.t === 'mountain' || t.depot) return;
    t.t = 'chasm';
    t.burn = 0;
    t.flood = 0;
    t.anim = 1;
    this.stats.collapsed++;
    const p = this.px(t.c, t.r);
    this.burst(p.x, p.y, '#8a7a6a', 26, 4, 1, 0.18, 6, 's');
    this.ring(p.x, p.y, '#d9b38c');
    this.shake(12);
    const u = this.unitAt(t.c, t.r);
    if (u) {
      const dmg = this.hazardDmg(u, 5, 'fall');
      const dest = this.nearestFree(u);
      this.float(p.x, p.y - 0.3, 'FALLING!', '#ffcf8a', 0.5);
      if (dest) {
        u.c = dest.c;
        u.r = dest.r;
        const q = this.px(dest.c, dest.r);
        u.x = q.x;
        u.y = q.y;
        u.path = [];
      }
      this.damageUnit(u, dest ? dmg : 999, null, 'hazard', 'Fell in a collapse');
    }
    this.recalcSupply();
  }

  private nearestFree(u: BUnit): Tile | null {
    let best: Tile | null = null;
    let bd = 99;
    for (const row of this.tiles)
      for (const t of row) {
        if (!TERRAIN[t.t].passable || t.warn?.kind === 'collapse' || t.burn > 0 || this.unitAt(t.c, t.r)) continue;
        const d = dist(u, t) + (t.flood > 0 ? 0.5 : 0);
        if (d < bd) {
          bd = d;
          best = t;
        }
      }
    return best;
  }

  private floodTile(t: Tile) {
    t.warn = null;
    if (t.t === 'water' || t.t === 'mountain') return;
    const p = this.px(t.c, t.r);
    if (t.t === 'chasm') {
      t.t = 'water';
      this.float(p.x, p.y - 0.2, 'LAKE FORMED', '#8fdcff', 0.4);
    } else {
      t.flood = 3;
      t.burn = 0;
    }
    t.anim = 1;
    this.burst(p.x, p.y, '#6ecbff', 16, 3, 0.8, 0.12, 2);
    this.ring(p.x, p.y, '#6ecbff');
    this.shake(3);
    this.recalcSupply();
  }

  private igniteWarn(t: Tile) {
    t.warn = null;
    if (t.flood > 0 || t.t === 'chasm' || t.t === 'water' || t.t === 'mountain') return;
    t.burn = t.t === 'forest' ? 4 : 3;
    const p = this.px(t.c, t.r);
    this.burst(p.x, p.y, '#ff8a2a', 18, 3.5, 0.8, 0.14, -1);
    this.ring(p.x, p.y, '#ff8a2a');
    this.shake(3);
    this.recalcSupply();
  }

  private upkeep() {
    const rain = this.weather === 'rain' || this.weather === 'storm';
    // burn tick
    for (const row of this.tiles)
      for (const t of row) {
        if (t.burn > 0) {
          if (rain) {
            t.burn = 0;
            const p = this.px(t.c, t.r);
            this.burst(p.x, p.y, '#cfd8e0', 8, 2, 0.8, 0.14, -1);
            continue;
          }
          const u = this.unitAt(t.c, t.r);
          if (u) {
            const d = this.hazardDmg(u, 3, 'fire');
            if (d > 0) this.damageUnit(u, d, null, 'hazard', 'Burned alive');
            else {
              const p = this.px(t.c, t.r);
              this.float(p.x, p.y, 'IMMUNE', '#ffcf8a', 0.35);
            }
          }
          t.burn--;
          if (t.burn <= 0) {
            if (t.t !== 'bridge' && t.t !== 'water') t.t = 'ash';
            t.stable = t.stable || false;
          }
        }
        if (t.flood > 0) {
          if (!rain) t.flood -= this.weather === 'drought' ? 2 : 1;
          if (t.flood < 0) t.flood = 0;
        }
      }
    // boss passive
    const col = this.units.find((u) => u.kind === 'colossus' && !u.dead);
    if (col) {
      const n = col.flags.enraged ? 3 : 2;
      const cands = this.freeTiles(() => true).filter((t) => dist(t, col) <= 2 && !t.warn && t.flood === 0 && t.burn === 0);
      this.weightedPick(cands.map((v) => ({ v, w: 1 })), n).forEach((t) => this.setWarn(t, 'ignite', 1));
      this.float(this.px(col.c, col.r).x, this.px(col.c, col.r).y - 0.5, 'EMBER AURA', '#ff9a4a', 0.4);
    }
    this.recalcSupply();
    // depots
    for (const row of this.tiles)
      for (const t of row) {
        if (!t.depot || t.depot.hq) continue;
        const u = this.unitAt(t.c, t.r);
        if (!u) continue;
        const want = u.team === 'player' ? 'player' : 'enemy';
        if (t.depot.owner !== want) {
          t.depot.owner = want;
          const p = this.px(t.c, t.r);
          this.float(p.x, p.y - 0.4, want === 'player' ? 'DEPOT CAPTURED' : 'DEPOT LOST', want === 'player' ? '#8dffb0' : '#ff8080', 0.45);
          this.ring(p.x, p.y, want === 'player' ? '#8dffb0' : '#ff8080');
          audio.sfx('depot');
          if (want === 'player') this.stats.depots++;
        }
      }
    // HQ overrun
    const hq = this.tiles.flat().find((t) => t.depot?.hq);
    if (hq) {
      const u = this.unitAt(hq.c, hq.r);
      if (u && u.team === 'enemy') {
        this.hqHold++;
        if (this.hqHold >= 2) {
          this.finish(false, 'Your headquarters was overrun!');
          return;
        }
        const p = this.px(hq.c, hq.r);
        this.float(p.x, p.y - 0.6, 'HQ UNDER ATTACK!', '#ff5a5a', 0.55);
        this.say('HQ UNDER ATTACK', 'Dislodge the enemy this round or the war is lost!', '#ff5a5a');
        audio.sfx('boss');
      } else this.hqHold = 0;
    }
    this.recalcSupply();
    // supply attrition & healing
    const heal = 1 + this.tech('hospital');
    for (const u of this.alive('player')) {
      const p = this.px(u.c, u.r);
      if (u.supplied) {
        u.starve = 0;
        if (u.hp < u.maxHp) {
          const h = Math.min(heal, u.maxHp - u.hp);
          u.hp += h;
          this.float(p.x, p.y - 0.2, `+${h}`, '#7dff9a', 0.4);
        }
      } else if (!u.perks.includes('forager') && u.gear !== 'rations') {
        u.starve++;
        if (u.starve >= 2 && u.hp > 1) {
          u.hp -= 1;
          this.float(p.x, p.y - 0.2, 'STARVING -1', '#ffb36a', 0.38);
          this.stats.taken += 1;
        } else this.float(p.x, p.y - 0.2, 'NO SUPPLY', '#ffb36a', 0.34);
      }
    }
    if (this.checkEnd()) return;
    // objective checks
    const m = this.mission;
    if (m.objective === 'seize') {
      const objs = this.tiles.flat().filter((t) => t.depot?.obj);
      if (objs.length && objs.every((t) => t.depot!.owner === 'player')) {
        this.finish(true, 'All beacons seized!');
        return;
      }
    }
    this.round++;
    if (m.objective === 'survive' && m.turns && this.round > m.turns) {
      this.finish(true, `You held for ${m.turns} rounds!`);
      return;
    }
    this.reinforce();
    if (this.rng.chance(0.45)) this.wind = this.rng.int(6);
    this.weather = this.tutorial ? 'clear' : this.rng.pick(m.weather);
    if (!this.tutorial) this.planHazards();
    this.startPlayerPhase();
  }

  private reinforce() {
    const m = this.mission;
    if (this.tutorial) return;
    let pts = 0;
    if (m.objective === 'survive' && this.round % 2 === 0) pts = Math.round((3 + this.round) * this.diff.budget);
    if (m.objective === 'boss' && m.boss === 'colossus' && this.round % 3 === 0) pts = 4;
    if (!pts) return;
    const kinds = this.pickEnemyKinds(pts, m.kinds);
    const cands = this.freeTiles((t) => t.c >= this.w - 2 && !t.depot).sort(() => this.rng.next() - 0.5);
    let n = 0;
    kinds.forEach((k, i) => {
      const t = cands[i];
      if (!t) return;
      this.units.push(this.mkEnemy(k, t.c, t.r));
      const p = this.px(t.c, t.r);
      this.burst(p.x, p.y, '#ff4a4a', 12, 3, 0.7, 0.12);
      n++;
    });
    if (n) {
      this.float(this.px(this.w - 2, Math.floor(this.h / 2)).x, this.px(this.w - 2, Math.floor(this.h / 2)).y, 'REINFORCEMENTS', '#ff6a6a', 0.5);
      audio.sfx('boss');
    }
  }

  // ---------- end conditions ----------
  checkEnd(): boolean {
    if (this.phase === 'over' || this.result) return true;
    if (!this.alive('player').length) {
      this.finish(false, 'Your company has been destroyed.');
      return true;
    }
    const m = this.mission;
    const en = this.alive('enemy');
    if (m.objective === 'boss') {
      if (this.bossSeen && !this.units.some((u) => u.boss && !u.dead)) {
        this.finish(true, 'The boss has fallen!');
        return true;
      }
    } else if (m.objective === 'rout' && !en.length) {
      this.finish(true, 'The field is yours!');
      return true;
    }
    return false;
  }

  finish(won: boolean, reason: string) {
    if (this.result) return;
    this.phase = 'over';
    this.selected = null;
    this.reachMap.clear();
    audio.sfx(won ? 'victory' : 'defeat');
    audio.intensity = won ? 0.5 : 0.15;
    this.say(won ? 'VICTORY' : 'DEFEAT', reason, won ? '#8dffb0' : '#ff7a6a');
    const mercy: string[] = [];
    const units: RosterUnit[] = [];
    const rosterById = new Map(this.cfg.roster.map((r) => [r.id, r]));
    for (const u of this.units) {
      if (u.team !== 'player') continue;
      let keep = !u.dead;
      if (u.dead && won && this.diff.mercy && Math.random() < 0.5) {
        keep = true;
        mercy.push(u.name);
        this.fallen = this.fallen.filter((f) => f.name !== u.name);
        this.stats.lost--;
      }
      const base = rosterById.get(u.rid);
      if (keep && base) {
        units.push({ ...base, level: u.level, xp: u.xp, perks: [...u.perks], pendingPerks: u.pendingPerks, kills: u.kills, missions: base.missions + (u.participated ? 1 : 0) });
      }
    }
    const surv = this.alive('player').length;
    const crowns = won
      ? Math.round((this.mission.crowns * this.diff.crowns * (1 + 0.1 * this.tech('chest')) + this.stats.kills + this.stats.envKills * 2 + this.stats.depots * 2 + surv) * 1)
      : 0;
    const laurels = won ? Math.max(1, Math.ceil(this.mission.laurels * this.cfg.rewardMult)) : 0;
    this.result = {
      won, reason, rounds: this.round, kills: this.stats.kills, envKills: this.stats.envKills, dealt: this.stats.dealt, taken: this.stats.taken,
      shores: this.stats.shores, depots: this.stats.depots, collapsed: this.stats.collapsed, lost: this.stats.lost, crowns, laurels, units, fallen: [...this.fallen], mercy,
    };
    this.later(2.2, () => {
      if (this.onOver && this.result) this.onOver(this.result);
    });
    this.changed();
  }

  // ---------- info helpers ----------
  objectiveText(): string {
    const m = this.mission;
    switch (m.objective) {
      case 'rout':
        return `Rout: destroy all enemies (${this.alive('enemy').length} left)`;
      case 'boss': {
        const b = this.units.find((u) => u.boss && !u.dead);
        return b ? `Slay the ${b.name} (${b.hp}/${b.maxHp})` : 'Boss defeated';
      }
      case 'survive':
        return `Survive until round ${(m.turns || 0) + 1} (now ${Math.min(this.round, m.turns || 0)}/${m.turns})`;
      case 'seize': {
        const objs = this.tiles.flat().filter((t) => t.depot?.obj);
        const got = objs.filter((t) => t.depot!.owner === 'player').length;
        return `Seize beacons ⚑ ${got}/${objs.length} (hold at round end)`;
      }
    }
  }

  tileInfo(c: number, r: number): string {
    const t = this.tile(c, r);
    const parts = [TERRAIN[t.t].name];
    if (TERRAIN[t.t].cover) parts.push(`+${TERRAIN[t.t].cover} cover`);
    if (t.flood > 0) parts.push(`flooded (${t.flood})`);
    if (t.burn > 0) parts.push(`BURNING (${t.burn})`);
    if (t.stable) parts.push('stable');
    if (t.warn) parts.push(`${t.warn.kind === 'collapse' ? 'COLLAPSE' : t.warn.kind === 'flood' ? 'FLOOD' : 'IGNITION'} in ${t.warn.eta}`);
    if (t.depot) parts.push(`${t.depot.hq ? 'HQ' : 'Depot'} (${t.depot.owner})`);
    return parts.join(' · ');
  }

  // ---------- update ----------
  update(dt: number) {
    if (this.paused) return;
    dt = Math.min(dt, 0.05);
    this.time += dt;
    // tasks
    if (this.pending.length) {
      for (const p of this.pending) p.t -= dt;
      const anim = this.animating();
      const ready = this.pending.filter((p) => p.t <= 0 && (!p.idle || !anim));
      if (ready.length) {
        this.pending = this.pending.filter((p) => !ready.includes(p));
        for (const p of ready) p.fn();
      }
    }
    // unit animation
    for (const u of this.units) {
      if (u.flash > 0) u.flash -= dt;
      if (u.lunge) {
        u.lunge.t += dt / 0.22;
        if (u.lunge.t >= 1) u.lunge = null;
      }
      if (u.dead) {
        u.deathT -= dt;
        continue;
      }
      if (u.path.length) {
        const tgt = u.path[0];
        const dx = tgt.x - u.x;
        const dy = tgt.y - u.y;
        const d = Math.hypot(dx, dy);
        const step = 8.5 * dt;
        if (d <= step) {
          u.x = tgt.x;
          u.y = tgt.y;
          u.path.shift();
        } else {
          u.x += (dx / d) * step;
          u.y += (dy / d) * step;
        }
      } else {
        const p = this.px(u.c, u.r);
        u.x += (p.x - u.x) * Math.min(1, dt * 12);
        u.y += (p.y - u.y) * Math.min(1, dt * 12);
      }
    }
    if (this.units.length > 40) this.units = this.units.filter((u) => !u.dead || u.deathT > 0);
    // tile anim
    for (const row of this.tiles) for (const t of row) if (t.anim > 0) t.anim = Math.max(0, t.anim - dt * 1.4);
    // fx
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= dt * 0.7;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    for (const p of this.projs) p.t += dt / p.dur;
    this.projs = this.projs.filter((p) => p.t < 1);
    for (const r of this.rings) r.t += dt / r.max;
    this.rings = this.rings.filter((r) => r.t < 1);
    this.shakeAmt *= Math.pow(0.002, dt);
    if (this.shakeAmt < 0.1) this.shakeAmt = 0;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    // ambient fire particles
    if (this.fxScale > 0.5 || Math.random() < 0.4) {
      for (const row of this.tiles)
        for (const t of row) {
          if (t.burn > 0 && Math.random() < 3 * dt * this.fxScale) {
            const p = this.px(t.c, t.r);
            this.parts.push({ x: p.x + (Math.random() - 0.5) * 0.8, y: p.y + 0.1, vx: (Math.random() - 0.5) * 0.4, vy: -0.8 - Math.random(), life: 0.7, max: 0.7, size: 0.1 + Math.random() * 0.1, color: Math.random() < 0.5 ? '#ff7a1a' : '#ffd24a', g: 0, shape: 'c' });
          }
        }
    }
    if (this.phase === 'player' && !this.busy() && !this.result) this.checkEnd();
  }
}

export { TECH };
