import { COLS, ROWS, CS, SKY, W, H, BUILDINGS, LEVELS, TOOL_COST } from './data';
import type { BuildingDef, BuildingKind, LevelDef, Upgrades, ToolId } from './data';
import { sfx } from './audio';

export interface EndInfo {
  won: boolean;
  spores: number;
  bonus: number;
  time: number;
  kills: number;
  collapsed: number;
  total: number;
}

export interface Snapshot {
  nutrients: number;
  income: number;
  left: number;
  total: number;
  heartHp: number;
  heartMax: number;
  time: number;
  ext: number;
  hint: string;
  msg: string;
  spores: number;
  kills: number;
  warning: boolean;
  over: boolean;
}

type ExtType = 'sprayer' | 'fumigator' | 'prober';

interface Building {
  id: number;
  def: BuildingDef;
  x: number;
  state: 'standing' | 'collapsing' | 'ruin';
  integrity: number;
  max: number;
  t: number;
  rate: number;
  seed: number;
  spawnTimer: number;
}

interface Ext {
  id: number;
  type: ExtType;
  x: number;
  hp: number;
  maxhp: number;
  speed: number;
  state: 'idle' | 'walk' | 'work';
  timer: number;
  work: number;
  tx: number;
  tr: number;
  dir: number;
  infect: number;
  stun: number;
  anim: number;
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
  grav: number;
  kind: 0 | 1 | 2; // dot, smoke, spark
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SOIL_YIELD = [0.08, 0.5, 0.8, 0, 0.1];
// soil: 0 dirt, 1 humus, 2 water, 3 rock, 4 carcass

function hash(i: number) {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class Game {
  levelIdx: number;
  level: LevelDef;
  up: Upgrades;
  onEnd: (e: EndInfo) => void;

  soil = new Uint8Array(COLS * ROWS);
  found = new Int16Array(COLS * ROWS).fill(-1);
  rt = new Uint8Array(COLS * ROWS); // 0 none 1 hypha 2 rhizomorph 3 heart
  hp = new Float32Array(COLS * ROWS);
  mod = new Uint8Array(COLS * ROWS); // 0 none 1 antidote 2 acid 3 fruit
  grow = new Float32Array(COLS * ROWS).fill(-1);
  conn = new Uint8Array(COLS * ROWS);
  timers = new Float32Array(COLS * ROWS);
  poison = new Float32Array(COLS * ROWS);
  poison2 = new Float32Array(COLS * ROWS);
  growing = new Set<number>();
  heartI = 0;

  buildings: Building[] = [];
  exts: Ext[] = [];
  parts: Particle[] = [];
  floats: FloatText[] = [];

  nutrients: number;
  income = 0;
  sporesEarned = 0;
  kills = 0;
  time = 0;
  paused = false;
  over: '' | 'won' | 'lost' = '';
  endTimer = 0;
  ended = false;
  shake = 0;
  tAnim = 0;
  dirty = true;
  connTimer = 0;
  poisonTimer = 0;
  extId = 1;
  msg = '';
  msgT = 0;
  antidotes: number[] = [];

  tool: ToolId = 'grow';
  hover: { c: number; r: number } | null = null;
  lastGrowSfx = 0;
  lastErodeSfx = 0;
  flags = { foundation: false, fruit: false, firstExt: false, poisoned: false, antidote: false };

  duster = { state: 'idle' as 'idle' | 'warn' | 'fly', timer: 0, x: -4, lastCol: -1 };
  rubble: { x: number; seed: number; w: number }[] = [];
  clouds: { x: number; y: number; s: number; v: number }[] = [];
  rand: () => number;

  constructor(levelIdx: number, up: Upgrades, onEnd: (e: EndInfo) => void) {
    this.levelIdx = levelIdx;
    this.level = LEVELS[levelIdx];
    this.up = up;
    this.onEnd = onEnd;
    this.rand = mulberry32(levelIdx * 7919 + Math.floor(Math.random() * 100000));
    this.nutrients = this.level.startNutrients + up.seed * 40;
    for (let i = 0; i < 7; i++) {
      this.clouds.push({ x: Math.random() * W, y: 14 + Math.random() * 60, s: 0.6 + Math.random() * 0.9, v: 3 + Math.random() * 6 });
    }
    this.generate();
    this.duster.timer = this.level.duster > 0 ? this.level.duster : 0;
    this.say('Grow your mycelium toward the foundations. Good luck, little spore.');
  }

  // ---------------------------------------------------------------- generation
  idx(c: number, r: number) {
    return r * COLS + c;
  }

  generate() {
    const lvl = this.level;
    // layout buildings
    const kinds: BuildingKind[] = [...lvl.buildings];
    const lr = mulberry32(this.levelIdx * 31 + 7 + Math.floor(Math.random() * 1000));
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(lr() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const totalW = kinds.reduce((s, k) => s + BUILDINGS[k].w, 0);
    let gap = COLS - totalW;
    const slots = new Array(kinds.length + 1).fill(0);
    for (let i = 1; i < kinds.length && gap > 0; i++) {
      slots[i] = 1;
      gap--;
    }
    while (gap > 0) {
      slots[Math.floor(lr() * slots.length)]++;
      gap--;
    }
    let x = 0;
    kinds.forEach((k, i) => {
      x += slots[i];
      const def = BUILDINGS[k];
      this.buildings.push({
        id: i,
        def,
        x,
        state: 'standing',
        integrity: def.hp,
        max: def.hp,
        t: 0,
        rate: 0,
        seed: Math.floor(lr() * 1000),
        spawnTimer: 12 + lr() * 10,
      });
      for (let c = x; c < x + def.w; c++) for (let r = 0; r < def.d; r++) this.found[this.idx(c, r)] = i;
      x += def.w;
    });

    // soil, with reachability check
    const hc = 7 + Math.floor(lr() * 16);
    const hr = 8;
    this.heartI = this.idx(hc, hr);
    let ok = false;
    for (let attempt = 0; attempt < 25 && !ok; attempt++) {
      const rng = mulberry32(this.levelIdx * 1013 + attempt * 77 + Math.floor(lr() * 100000));
      this.soil.fill(0);
      const blob = (type: number, count: number, minR: number, maxR: number, size: number, avoidHeart: boolean) => {
        for (let k = 0; k < count; k++) {
          let c = Math.floor(rng() * COLS);
          let r = minR + Math.floor(rng() * (maxR - minR + 1));
          const cells: [number, number][] = [[c, r]];
          for (let s = 0; s < size; s++) {
            const [bc, br] = cells[Math.floor(rng() * cells.length)];
            const d = DIRS[Math.floor(rng() * 4)];
            c = bc + d[0];
            r = br + d[1];
            if (c < 0 || c >= COLS || r < minR || r > maxR) continue;
            cells.push([c, r]);
          }
          for (const [cc, rr] of cells) {
            const i = this.idx(cc, rr);
            if (this.found[i] >= 0) continue;
            if (avoidHeart && Math.abs(cc - hc) + Math.abs(rr - hr) < 4) continue;
            if (this.soil[i] === 0) this.soil[i] = type;
          }
        }
      };
      blob(1, lvl.humus, 1, ROWS - 2, 8, false);
      blob(2, lvl.water, 3, ROWS - 2, 6, false);
      blob(3, lvl.rocks, 2, ROWS - 1, 7, true);
      for (let k = 0; k < lvl.carcass; k++) {
        const c = Math.floor(rng() * COLS);
        const r = 4 + Math.floor(rng() * (ROWS - 5));
        const i = this.idx(c, r);
        if (this.soil[i] === 0 && this.found[i] < 0) this.soil[i] = 4;
      }
      ok = this.reachable();
    }
    if (!ok) {
      for (let i = 0; i < this.soil.length; i++) if (this.soil[i] === 3) this.soil[i] = 0;
    }

    // heart and starter roots
    this.rt[this.heartI] = 3;
    this.hp[this.heartI] = this.hpMax(3);
    this.soil[this.heartI] = 0;
    for (const [dc, dr] of DIRS) {
      const c = hc + dc;
      const r = hr + dr;
      const i = this.idx(c, r);
      this.soil[i] = this.soil[i] === 3 ? 0 : this.soil[i];
      this.rt[i] = 1;
      this.hp[i] = this.hpMax(1);
    }
    this.recompute();
  }

  reachable() {
    const seen = new Uint8Array(COLS * ROWS);
    const q = [this.heartI];
    seen[this.heartI] = 1;
    while (q.length) {
      const i = q.pop() as number;
      const c = i % COLS;
      const r = (i / COLS) | 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const j = this.idx(nc, nr);
        if (seen[j] || this.soil[j] === 3) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
    for (let i = 0; i < this.found.length; i++) if (this.found[i] >= 0 && !seen[i]) return false;
    return true;
  }

  // ---------------------------------------------------------------- helpers
  hpMax(type: number) {
    const v = 1 + this.up.vigor * 0.2;
    if (type === 3) return 300 * (1 + this.up.heart * 0.5);
    return (type === 2 ? 90 : 30) * v;
  }

  resist(i: number) {
    return Math.min(0.85, this.up.antibodies * 0.12 + (this.rt[i] === 2 ? 0.5 : 0));
  }

  say(text: string) {
    this.msg = text;
    this.msgT = 5;
  }

  addFloat(x: number, y: number, text: string, color: string) {
    this.floats.push({ x, y, text, color, life: 1.6 });
  }

  burst(x: number, y: number, n: number, color: string, speed: number, grav = 120, size = 3, life = 0.8, kind: 0 | 1 | 2 = 0) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * speed;
      this.parts.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.3,
        life: life * (0.5 + Math.random() * 0.8),
        max: life * 1.3,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        grav,
        kind,
      });
    }
  }

  cellCenter(i: number): [number, number] {
    return [(i % COLS) * CS + CS / 2, SKY + ((i / COLS) | 0) * CS + CS / 2];
  }

  // ---------------------------------------------------------------- tools
  canUse(tool: ToolId, c: number, r: number): { ok: boolean; reason: string; cost: number } {
    const i = this.idx(c, r);
    let cost = TOOL_COST[tool];
    const no = (reason: string) => ({ ok: false, reason, cost });
    switch (tool) {
      case 'grow': {
        if (this.rt[i] > 0 || this.grow[i] >= 0) return no('Already rooted');
        if (this.soil[i] === 3) return no('Bedrock! Use an Acid Cyst');
        let adj = false;
        for (const [dc, dr] of DIRS) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
          const j = this.idx(nc, nr);
          if (this.rt[j] > 0 || this.grow[j] >= 0) adj = true;
        }
        if (!adj) return no('Must touch the network');
        cost = this.found[i] >= 0 ? 10 : this.soil[i] === 2 ? 3 : 5;
        break;
      }
      case 'thicken':
        if (this.rt[i] === 0) return no('No root here');
        if (this.rt[i] !== 1) return no('Already thick');
        break;
      case 'antidote':
      case 'acid':
        if (this.rt[i] === 0) return no('Needs a root');
        if (this.rt[i] === 3) return no('Not on the heart');
        if (this.mod[i] !== 0) return no('Cell already specialised');
        break;
      case 'fruit':
        if (r !== 0) return no('Surface row only');
        if (this.rt[i] !== 1 && this.rt[i] !== 2) return no('Needs a root');
        if (this.mod[i] !== 0) return no('Cell already specialised');
        break;
    }
    if (this.nutrients < cost) return { ok: false, reason: `Need ${cost} nutrients`, cost };
    return { ok: true, reason: '', cost };
  }

  useTool(c: number, r: number, drag: boolean) {
    if (this.over || this.paused) return;
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    const i = this.idx(c, r);
    const res = this.canUse(this.tool, c, r);
    const [x, y] = this.cellCenter(i);
    if (!res.ok) {
      if (!drag) {
        this.addFloat(x, y - 8, res.reason, '#ff8a7a');
        sfx.error();
      }
      return;
    }
    this.nutrients -= res.cost;
    switch (this.tool) {
      case 'grow':
        this.grow[i] = 0;
        this.growing.add(i);
        if (this.tAnim - this.lastGrowSfx > 0.07) {
          sfx.grow();
          this.lastGrowSfx = this.tAnim;
        }
        break;
      case 'thicken': {
        const ratio = this.hp[i] / this.hpMax(1);
        this.rt[i] = 2;
        this.hp[i] = Math.max(this.hpMax(2) * ratio, this.hpMax(2) * 0.5);
        this.burst(x, y, 10, '#ffd88a', 70, 0, 3, 0.6);
        sfx.thicken();
        break;
      }
      case 'antidote':
        this.mod[i] = 1;
        this.dirty = true;
        this.flags.antidote = true;
        this.burst(x, y, 14, '#5ff0d0', 80, -10, 3, 0.9);
        sfx.place();
        break;
      case 'acid':
        this.mod[i] = 2;
        this.timers[i] = 1.2;
        this.burst(x, y, 14, '#d4ff4a', 80, -10, 3, 0.9);
        sfx.place();
        break;
      case 'fruit':
        this.mod[i] = 3;
        this.timers[i] = 1.5;
        this.flags.fruit = true;
        this.burst(x, SKY - 6, 14, '#ff9ad0', 80, 20, 3, 0.9);
        sfx.place();
        break;
    }
  }

  // ---------------------------------------------------------------- simulation
  recompute() {
    this.conn.fill(0);
    const q = [this.heartI];
    this.conn[this.heartI] = 1;
    while (q.length) {
      const i = q.pop() as number;
      const c = i % COLS;
      const r = (i / COLS) | 0;
      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const j = this.idx(nc, nr);
        if (this.conn[j] || this.rt[j] === 0) continue;
        this.conn[j] = 1;
        q.push(j);
      }
    }
    const absorb = 1 + this.up.absorb * 0.2;
    let inc = 0;
    this.antidotes = [];
    for (let i = 0; i < this.rt.length; i++) {
      if (this.rt[i] === 0) continue;
      if (this.mod[i] === 1) this.antidotes.push(i);
      if (!this.conn[i]) continue;
      if (this.rt[i] === 3) inc += 1.4;
      else if (this.found[i] < 0) inc += SOIL_YIELD[this.soil[i]] * (this.rt[i] === 2 ? 1.5 : 1);
    }
    this.income = inc * absorb;
    this.dirty = false;
  }

  killCell(i: number) {
    const [x, y] = this.cellCenter(i);
    if (this.rt[i] === 3) {
      this.hp[i] = 0;
      this.burst(x, y, 40, '#ffe9a0', 200, 80, 4, 1.2);
      if (!this.over) {
        this.over = 'lost';
        this.endTimer = 2.4;
        this.shake = 22;
        sfx.lose();
        this.say('The Mother Heart has been poisoned...');
      }
      return;
    }
    this.burst(x, y, 6, this.poison[i] > 0.3 ? '#b6ff3a' : '#cfc8a0', 60, 40, 2.5, 0.6);
    this.rt[i] = 0;
    this.mod[i] = 0;
    this.hp[i] = 0;
    this.dirty = true;
  }

  collapse(b: Building) {
    b.state = 'collapsing';
    b.t = 0;
    b.integrity = 0;
    const d = b.def;
    for (let c = b.x; c < b.x + d.w; c++) for (let r = 0; r < d.d; r++) this.found[this.idx(c, r)] = -1;
    this.rubble.push({ x: b.x, seed: b.seed, w: d.w });
    const gain = Math.ceil(5 + d.hp / 10);
    this.sporesEarned += gain;
    const nut = Math.floor(25 + d.hp / 6);
    this.nutrients += nut;
    this.shake = Math.max(this.shake, 10 + d.hp / 25);
    sfx.collapse();
    const cx = (b.x + d.w / 2) * CS;
    this.burst(cx, SKY - 10, 50, '#b5a58a', 220, 260, 5, 1.5);
    this.burst(cx, SKY - 20, 18, '#6b5a4d', 130, 0, 14, 2.4, 1);
    this.addFloat(cx, SKY - d.height - 20, `${d.name} collapses!`, '#ffe28a');
    this.addFloat(cx, SKY - d.height + 2, `+${gain} spores  +${nut} nutrients`, '#9dffb0');
    this.say(`${d.name} has collapsed! +${gain} spores`);
    const reach = d.w / 2 + 3;
    for (const e of this.exts) {
      if (Math.abs(e.x - (b.x + d.w / 2)) < reach) {
        e.stun = 2.5;
        this.hurtExt(e, 90);
      }
    }
    this.dirty = true;
  }

  hurtExt(e: Ext, dmg: number) {
    e.hp -= dmg;
    if (e.hp <= 0 && e.hp > -9999) {
      e.hp = -10000;
      this.kills++;
      this.nutrients += 6;
      const x = e.x * CS;
      this.burst(x, SKY - 20, 18, '#c6ff6a', 150, 200, 3.5, 0.9);
      this.addFloat(x, SKY - 50, '+6', '#9dffb0');
      sfx.die();
    }
  }

  spawnExt(b: Building) {
    const types = this.level.types;
    const type = types[Math.floor(Math.random() * types.length)];
    const base = {
      sprayer: { hp: 34, speed: 1.5, work: 1.4 },
      fumigator: { hp: 72, speed: 0.95, work: 2.4 },
      prober: { hp: 48, speed: 1.3, work: 3.0 },
    }[type];
    const scale = 1 + this.levelIdx * 0.06;
    const e: Ext = {
      id: this.extId++,
      type,
      x: b.x + b.def.w / 2 + (Math.random() - 0.5) * 1.5,
      hp: base.hp * scale,
      maxhp: base.hp * scale,
      speed: base.speed,
      state: 'idle',
      timer: 0.8,
      work: base.work,
      tx: 0,
      tr: -1,
      dir: 1,
      infect: 0,
      stun: 0,
      anim: Math.random() * 6,
    };
    this.exts.push(e);
    this.flags.firstExt = true;
    sfx.spawn();
    this.burst(e.x * CS, SKY - 10, 8, '#e8d88a', 60, 40, 3, 0.5);
  }

  pickTarget(e: Ext) {
    const rts: number[] = [];
    for (let i = 0; i < this.rt.length; i++) if (this.rt[i] > 0) rts.push(i);
    const colOf = (i: number) => (i % COLS) + 0.5;
    const rowOf = (i: number) => (i / COLS) | 0;
    const sortNear = (arr: number[]) => arr.sort((a, b) => Math.abs(colOf(a) - e.x) - Math.abs(colOf(b) - e.x));
    // 1) fruiting bodies (probers are cleverer and often ignore them)
    const fruits = sortNear(rts.filter((i) => this.mod[i] === 3));
    if (fruits.length && (e.type !== 'prober' || Math.random() < 0.4)) {
      const i = fruits[0];
      e.tx = colOf(i);
      e.tr = 0;
      return;
    }
    // 2) buildings being undermined
    const hurt = this.buildings.filter((b) => b.state === 'standing' && b.rate > 0);
    if (hurt.length) {
      hurt.sort((a, b) => Math.abs(a.x + a.def.w / 2 - e.x) - Math.abs(b.x + b.def.w / 2 - e.x));
      const b = hurt[Math.random() < 0.7 ? 0 : Math.min(1, hurt.length - 1)];
      const inside = rts.filter((i) => this.found[i] === b.id);
      if (inside.length) {
        inside.sort((p, q) => rowOf(q) - rowOf(p));
        const i = inside[0];
        e.tx = colOf(i);
        e.tr = rowOf(i);
      } else {
        e.tx = b.x + b.def.w / 2;
        e.tr = 0;
      }
      return;
    }
    // 3) detectable roots
    const depth = this.level.detect + (e.type === 'prober' ? 4 : 0);
    const seen = rts.filter((i) => rowOf(i) <= depth && this.rt[i] !== 3);
    if (seen.length) {
      if (e.type === 'prober' && Math.random() < 0.5) {
        seen.sort((a, b) => rowOf(b) - rowOf(a));
        const i = seen[Math.floor(Math.random() * Math.min(3, seen.length))];
        e.tx = colOf(i);
        e.tr = rowOf(i);
        return;
      }
      sortNear(seen);
      const i = seen[Math.floor(Math.random() * Math.min(3, seen.length))];
      e.tx = colOf(i);
      e.tr = rowOf(i);
      return;
    }
    // 4) wander and sniff around
    e.tx = 1 + Math.random() * (COLS - 2);
    e.tr = -1;
  }

  inject(e: Ext) {
    if (e.tr < 0) return;
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(e.tx)));
    let row = e.tr;
    let amount = 11;
    if (e.type === 'sprayer') row = Math.min(row, 1);
    if (e.type === 'fumigator') {
      row = Math.min(row, 2);
      amount = 26;
    }
    if (e.type === 'prober') {
      row = Math.min(row, ROWS - 3);
      amount = 20;
    }
    while (row > 0 && this.soil[this.idx(col, row)] === 3) row--;
    const i = this.idx(col, row);
    this.poison[i] += amount;
    if (e.type === 'fumigator') {
      if (col > 0) this.poison[this.idx(col - 1, row)] += 8;
      if (col < COLS - 1) this.poison[this.idx(col + 1, row)] += 8;
    }
    const [x, y] = this.cellCenter(i);
    this.burst(x, y, 16, '#b6ff3a', 90, -10, 4, 1.1);
    sfx.poison();
    this.flags.poisoned = true;
  }

  update(dt: number) {
    if (this.paused) return;
    this.tAnim += dt;
    this.updateFx(dt);
    if (this.over) {
      this.endTimer -= dt;
      if (this.endTimer <= 0 && !this.ended) {
        this.ended = true;
        this.finish();
      }
      return;
    }
    this.time += dt;
    const lvl = this.level;

    // growth
    const growMult = 1 - this.up.growth * 0.15;
    for (const i of Array.from(this.growing)) {
      let t = 1.3 * growMult;
      if (this.found[i] >= 0) t *= 1.6;
      if (this.soil[i] === 1) t *= 0.8;
      this.grow[i] += dt / t;
      if (this.grow[i] >= 1) {
        this.grow[i] = -1;
        this.growing.delete(i);
        this.rt[i] = 1;
        this.hp[i] = this.hpMax(1);
        this.dirty = true;
        const [x, y] = this.cellCenter(i);
        this.burst(x, y, 4, '#e9f5c0', 40, 0, 2.5, 0.5);
        if (this.soil[i] === 4) {
          this.soil[i] = 1;
          this.nutrients += 50;
          this.addFloat(x, y - 10, '+50 carcass feast!', '#9dffb0');
          this.burst(x, y, 16, '#fff5cc', 100, 40, 3, 0.9);
          sfx.coin();
        }
        if (this.found[i] >= 0 && !this.flags.foundation) {
          this.flags.foundation = true;
          this.say('Roots inside foundation stone erode the building above. Thick roots erode faster!');
        }
      }
    }

    // connectivity / income
    this.connTimer -= dt;
    if (this.dirty || this.connTimer <= 0) {
      this.recompute();
      this.connTimer = 0.4;
    }
    this.nutrients += this.income * dt;

    // erosion
    const enz = 1 + this.up.enzymes * 0.25;
    for (const b of this.buildings) {
      if (b.state !== 'standing') continue;
      let rate = 0;
      for (let c = b.x; c < b.x + b.def.w; c++) {
        for (let r = 0; r < b.def.d; r++) {
          const i = this.idx(c, r);
          if (this.rt[i] === 0 || !this.conn[i]) continue;
          let k = 2.2 * (this.rt[i] === 2 ? 2 : 1);
          let acid = false;
          for (let dc = -1; dc <= 1 && !acid; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
              const nc = c + dc;
              const nr = r + dr;
              if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
              const j = this.idx(nc, nr);
              if (this.mod[j] === 2 && this.rt[j] > 0 && this.conn[j]) {
                acid = true;
                break;
              }
            }
          }
          if (acid) k *= 1.6;
          rate += k * enz;
          if (Math.random() < dt * 2.5) {
            const [x, y] = this.cellCenter(i);
            this.burst(x, y, 1, '#b9ad98', 30, 60, 2, 0.6);
          }
        }
      }
      b.rate = rate;
      if (rate > 0) {
        b.integrity -= rate * dt;
        if (this.tAnim - this.lastErodeSfx > 0.35) {
          sfx.erode();
          this.lastErodeSfx = this.tAnim;
        }
        if (Math.random() < dt * 4) {
          this.parts.push({
            x: (b.x + Math.random() * b.def.w) * CS,
            y: SKY - 2,
            vx: (Math.random() - 0.5) * 30,
            vy: -20 - Math.random() * 20,
            life: 0.7,
            max: 0.9,
            size: 2.5,
            color: '#b09a7c',
            grav: 80,
            kind: 0,
          });
        }
        if (b.integrity <= 0) this.collapse(b);
      }
    }

    // salt wards
    for (const b of this.buildings) {
      if (b.state !== 'standing' || b.def.ward <= 0) continue;
      const wx = (b.x + b.def.w / 2) * CS;
      const wy = SKY + b.def.d * CS;
      const rad = b.def.ward * CS;
      for (let i = 0; i < this.rt.length; i++) {
        if (this.rt[i] === 0) continue;
        const [x, y] = this.cellCenter(i);
        const dx = x - wx;
        const dy = y - wy;
        if (dx * dx + dy * dy > rad * rad) continue;
        let k = 3.4 * (1 - this.resist(i));
        for (const a of this.antidotes) {
          const [ax, ay] = this.cellCenter(a);
          if ((ax - x) * (ax - x) + (ay - y) * (ay - y) < 2.6 * CS * 2.6 * CS) {
            k *= 0.5;
            break;
          }
        }
        this.hp[i] -= k * dt;
        if (Math.random() < dt * 2) this.burst(x, y, 1, '#ffffff', 30, 0, 2, 0.5);
      }
    }

    // poison diffusion
    this.poisonTimer -= dt;
    if (this.poisonTimer <= 0) {
      this.poisonTimer = 0.15;
      this.stepPoison();
    }
    // poison damage
    for (let i = 0; i < this.rt.length; i++) {
      const p = this.poison[i];
      if (this.rt[i] > 0 && p > 0.25) {
        this.hp[i] -= p * 3 * (1 - this.resist(i)) * dt;
      }
    }

    // cell upkeep
    let dead = false;
    for (let i = 0; i < this.rt.length; i++) {
      if (this.rt[i] === 0) continue;
      const max = this.hpMax(this.rt[i]);
      if (!this.conn[i] && this.rt[i] !== 3) this.hp[i] -= 4 * dt;
      else if (this.poison[i] < 0.25) this.hp[i] = Math.min(max, this.hp[i] + (this.rt[i] === 3 ? 1.5 : 0.6) * dt);
      if (this.hp[i] <= 0) {
        this.killCell(i);
        dead = true;
      }
      if ((this.over as string) === 'lost') return;
    }
    if (dead) this.dirty = true;

    // specialised cells
    const sporeMult = 1 + this.up.spores * 0.3;
    for (let i = 0; i < this.rt.length; i++) {
      if (this.rt[i] === 0 || this.mod[i] === 0) continue;
      const m = this.mod[i];
      const [x, y] = this.cellCenter(i);
      if (m === 1) {
        if (Math.random() < dt * 1.5) this.burst(x, y, 1, '#5ff0d0', 25, -30, 2.5, 1);
        for (const j of this.poisonNear(i, 2.2)) this.poison[j] *= Math.pow(0.8, dt * 6.67);
      } else if (m === 2) {
        this.timers[i] -= dt;
        if (this.timers[i] <= 0) {
          this.timers[i] = 3.2;
          const c = i % COLS;
          const r = (i / COLS) | 0;
          for (const [dc, dr] of DIRS) {
            const nc = c + dc;
            const nr = r + dr;
            if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
            const j = this.idx(nc, nr);
            if (this.soil[j] === 3) {
              this.soil[j] = 0;
              const [jx, jy] = this.cellCenter(j);
              this.burst(jx, jy, 14, '#d4ff4a', 90, 20, 3, 0.8);
              this.addFloat(jx, jy, 'Rock dissolved', '#d4ff4a');
              sfx.place();
              break;
            }
          }
        }
        if (Math.random() < dt * 1.5) this.burst(x, y, 1, '#d4ff4a', 25, -30, 2.5, 1);
      } else if (m === 3) {
        this.timers[i] -= dt;
        if (this.timers[i] <= 0) {
          const cx = x / CS;
          const targets = this.exts.filter((e) => e.hp > 0 && Math.abs(e.x - cx) < 3.6);
          if (targets.length) {
            this.timers[i] = 2.2;
            for (const e of targets) {
              this.hurtExt(e, 8 * sporeMult);
              e.infect = Math.max(e.infect, 4);
            }
            this.burst(x, SKY - 22, 26, '#ffb3e0', 130, -20, 3, 1.1);
            sfx.puff();
          } else this.timers[i] = 0.3;
        }
      }
    }

    // exterminators
    for (const e of this.exts) {
      if (e.hp <= 0) continue;
      e.anim += dt;
      if (e.infect > 0) {
        e.infect -= dt;
        e.hp -= 6 * sporeMult * dt;
        if (Math.random() < dt * 10) this.burst(e.x * CS, SKY - 28, 1, '#ffb3e0', 20, -30, 2.5, 0.7);
        if (e.hp <= 0) {
          this.hurtExt(e, 0);
          continue;
        }
      }
      if (e.stun > 0) {
        e.stun -= dt;
        continue;
      }
      if (e.state === 'idle') {
        e.timer -= dt;
        if (e.timer <= 0) {
          this.pickTarget(e);
          e.state = 'walk';
        }
      } else if (e.state === 'walk') {
        const dx = e.tx - e.x;
        const step = e.speed * dt;
        if (Math.abs(dx) <= step) {
          e.x = e.tx;
          e.state = 'work';
          e.timer = e.tr < 0 ? 1.4 : e.work;
        } else {
          e.x += Math.sign(dx) * step;
          e.dir = dx > 0 ? 1 : -1;
        }
      } else {
        e.timer -= dt;
        if (e.tr >= 0 && e.type !== 'prober' && Math.random() < dt * 30) {
          this.parts.push({
            x: e.x * CS + e.dir * 16,
            y: SKY - 10,
            vx: e.dir * (10 + Math.random() * 20),
            vy: 30 + Math.random() * 30,
            life: 0.6,
            max: 0.8,
            size: 3,
            color: e.type === 'fumigator' ? '#d9ff7a' : '#b6ff3a',
            grav: 100,
            kind: 1,
          });
        }
        if (e.timer <= 0) {
          this.inject(e);
          e.state = 'idle';
          e.timer = 0.6 + Math.random() * 0.8;
        }
      }
    }
    this.exts = this.exts.filter((e) => e.hp > -9999);

    // guilds
    const cap = 5 + this.levelIdx;
    const rampDown = Math.max(0.55, 1 - this.time / 700);
    for (const b of this.buildings) {
      if (b.state !== 'standing' || !b.def.spawner) continue;
      b.spawnTimer -= dt;
      if (b.spawnTimer <= 0) {
        if (this.exts.length < cap) this.spawnExt(b);
        b.spawnTimer = lvl.spawnBase * (0.85 + Math.random() * 0.3) * rampDown;
      }
    }

    // crop duster
    if (lvl.duster > 0) {
      const d = this.duster;
      d.timer -= dt;
      if (d.state === 'idle' && d.timer <= 0) {
        d.state = 'warn';
        d.timer = 3.5;
        sfx.warn();
        this.say('Crop duster inbound! Shallow roots are in danger.');
      } else if (d.state === 'warn' && d.timer <= 0) {
        d.state = 'fly';
        d.x = -3;
        d.lastCol = -1;
        sfx.plane();
      } else if (d.state === 'fly') {
        d.x += 6.5 * dt;
        while (d.lastCol < Math.floor(d.x)) {
          d.lastCol++;
          if (d.lastCol >= 0 && d.lastCol < COLS) {
            this.poison[this.idx(d.lastCol, 0)] += 4.5;
            this.poison[this.idx(d.lastCol, 1)] += 1.5;
            this.burst(d.lastCol * CS + CS / 2, SKY - 4, 6, '#b6ff3a', 60, 50, 4, 1, 1);
          }
        }
        if (d.x > COLS + 3) {
          d.state = 'idle';
          d.timer = lvl.duster;
        }
      }
    }

    // building collapse animation & smoke
    for (const b of this.buildings) {
      if (b.state === 'collapsing') {
        b.t += dt;
        if (b.t >= 1.3) b.state = 'ruin';
      } else if (b.state === 'standing' && (b.def.kind === 'cottage' || b.def.kind === 'guild') && Math.random() < dt * 0.9) {
        this.parts.push({
          x: (b.x + b.def.w - 0.7) * CS,
          y: SKY - b.def.height - 4,
          vx: 8,
          vy: -18,
          life: 2.4,
          max: 2.6,
          size: 5,
          color: '#9aa0a8',
          grav: -4,
          kind: 1,
        });
      }
    }

    // victory
    if (!this.over && this.buildings.every((b) => b.state === 'ruin')) {
      this.over = 'won';
      this.endTimer = 2.2;
      sfx.win();
      this.say('Every fortification has fallen!');
    }
  }

  poisonNear(i: number, rad: number) {
    const c = i % COLS;
    const r = (i / COLS) | 0;
    const out: number[] = [];
    const k = Math.ceil(rad);
    for (let dc = -k; dc <= k; dc++) {
      for (let dr = -k; dr <= k; dr++) {
        if (dc * dc + dr * dr > rad * rad) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        out.push(this.idx(nc, nr));
      }
    }
    return out;
  }

  stepPoison() {
    const p = this.poison;
    const n = this.poison2;
    n.fill(0);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        let a = p[i];
        if (a < 0.02) continue;
        a *= this.soil[i] === 2 ? 0.95 : 0.985;
        let keep = a;
        const give = (j: number, share: number) => {
          const amt = a * share;
          n[j] += amt;
          keep -= amt;
        };
        if (r + 1 < ROWS && this.soil[i + COLS] !== 3) give(i + COLS, 0.12);
        if (c > 0 && this.soil[i - 1] !== 3) give(i - 1, 0.05);
        if (c < COLS - 1 && this.soil[i + 1] !== 3) give(i + 1, 0.05);
        if (r > 0 && this.soil[i - COLS] !== 3) give(i - COLS, 0.015);
        n[i] += keep;
      }
    }
    this.poison = n;
    this.poison2 = p;
  }

  updateFx(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      if (p.kind === 1) p.size += dt * 6;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.parts.length > 900) this.parts.splice(0, this.parts.length - 900);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 22 * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);
    this.shake = Math.max(0, this.shake - dt * 22);
    if (this.msgT > 0) this.msgT -= dt;
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x > W + 80) c.x = -120;
    }
  }

  finish() {
    const won = this.over === 'won';
    const total = this.buildings.length;
    const collapsed = this.buildings.filter((b) => b.state !== 'standing').length;
    let bonus = 0;
    let spores = this.sporesEarned;
    if (won) {
      bonus = 20 * (this.levelIdx + 1) + Math.max(0, 40 - Math.floor(this.time / 15));
      spores += bonus;
    } else {
      spores = Math.floor(spores * 0.5);
    }
    this.onEnd({ won, spores, bonus, time: this.time, kills: this.kills, collapsed, total });
  }

  snapshot(): Snapshot {
    let hint = 'Collapse every building to win. Guilds spawn exterminators — topple them first.';
    if (!this.flags.foundation) hint = 'Tunnel toward the grey foundation stones under the buildings. Click or drag next to your roots.';
    else if (this.flags.firstExt && !this.flags.fruit && this.time < 240)
      hint = 'Exterminators! Fruiting Bodies (5) on the surface row lure and sicken them.';
    else if (this.flags.poisoned && !this.flags.antidote && this.time < 300)
      hint = 'Poison seeps downward. Antidote Glands (3) neutralise it. Rock and water also block or dilute it.';
    return {
      nutrients: Math.floor(this.nutrients),
      income: this.income,
      left: this.buildings.filter((b) => b.state === 'standing').length,
      total: this.buildings.length,
      heartHp: Math.max(0, this.hp[this.heartI]),
      heartMax: this.hpMax(3),
      time: this.time,
      ext: this.exts.filter((e) => e.hp > 0).length,
      hint,
      msg: this.msgT > 0 ? this.msg : '',
      spores: this.sporesEarned,
      kills: this.kills,
      warning: this.duster.state === 'warn',
      over: this.over !== '',
    };
  }

  // ---------------------------------------------------------------- rendering
  draw(g: CanvasRenderingContext2D) {
    g.fillStyle = '#0b0807';
    g.fillRect(0, 0, W, H);
    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawSky(g);
    for (const r of this.rubble) this.drawRubble(g, r);
    for (const b of this.buildings) if (b.state !== 'ruin') this.drawBuilding(g, b);
    this.drawSoil(g);
    this.drawWards(g);
    this.drawPoison(g);
    this.drawRoots(g);
    this.drawFruits(g);
    for (const e of this.exts) this.drawExt(g, e);
    this.drawDuster(g);
    this.drawParticles(g);
    this.drawHover(g);
    this.drawFloats(g);
    g.restore();
    this.drawOverlay(g);
  }

  drawSky(g: CanvasRenderingContext2D) {
    const [top, bot] = this.level.sky;
    const grad = g.createLinearGradient(0, 0, 0, SKY);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    g.fillStyle = grad;
    g.fillRect(-20, -20, W + 40, SKY + 20);
    // sun
    const sg = g.createRadialGradient(W * 0.78, SKY - 8, 4, W * 0.78, SKY - 8, 90);
    sg.addColorStop(0, 'rgba(255,230,170,0.9)');
    sg.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = sg;
    g.fillRect(0, 0, W, SKY);
    // hills
    g.fillStyle = 'rgba(30,30,50,0.45)';
    g.beginPath();
    g.moveTo(-10, SKY);
    for (let x = -10; x <= W + 10; x += 20) g.lineTo(x, SKY - 22 - Math.sin(x * 0.012) * 12 - Math.sin(x * 0.031 + 1) * 6);
    g.lineTo(W + 10, SKY);
    g.fill();
    // clouds
    g.fillStyle = 'rgba(255,255,255,0.16)';
    for (const c of this.clouds) {
      g.beginPath();
      g.ellipse(c.x, c.y, 34 * c.s, 9 * c.s, 0, 0, Math.PI * 2);
      g.ellipse(c.x + 18 * c.s, c.y - 5 * c.s, 22 * c.s, 8 * c.s, 0, 0, Math.PI * 2);
      g.fill();
    }
    // grass line
    g.fillStyle = '#3f7a3a';
    g.fillRect(-20, SKY - 4, W + 40, 6);
    g.fillStyle = '#5aa04a';
    for (let x = 0; x < W; x += 6) g.fillRect(x, SKY - 6 - hash(x) * 3, 2, 4);
  }

  drawRubble(g: CanvasRenderingContext2D, r: { x: number; seed: number; w: number }) {
    const x0 = r.x * CS;
    for (let k = 0; k < r.w * 4; k++) {
      const h1 = hash(r.seed + k * 3.1);
      const h2 = hash(r.seed + k * 7.7);
      g.fillStyle = h1 > 0.5 ? '#80766a' : '#5c534b';
      const px = x0 + (k / (r.w * 4)) * r.w * CS + h2 * 8;
      const sz = 5 + h1 * 9;
      g.beginPath();
      g.moveTo(px, SKY);
      g.lineTo(px + sz * 0.3, SKY - sz * 0.9);
      g.lineTo(px + sz, SKY - sz * 0.3);
      g.lineTo(px + sz * 1.2, SKY);
      g.fill();
    }
    g.fillStyle = 'rgba(60,40,30,0.5)';
    g.fillRect(x0, SKY - 3, r.w * CS, 4);
  }

  bricks(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, step = 10) {
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 1;
    g.beginPath();
    let row = 0;
    for (let yy = y; yy < y + h; yy += step * 0.7) {
      g.moveTo(x, yy);
      g.lineTo(x + w, yy);
      for (let xx = x + (row % 2) * step * 0.5; xx < x + w; xx += step) {
        g.moveTo(xx, yy);
        g.lineTo(xx, Math.min(y + h, yy + step * 0.7));
      }
      row++;
    }
    g.stroke();
  }

  drawBuilding(g: CanvasRenderingContext2D, b: Building) {
    const d = b.def;
    const x0 = b.x * CS;
    const w = d.w * CS;
    g.save();
    g.beginPath();
    g.rect(x0 - 60, 0, w + 120, SKY);
    g.clip();
    let ox = 0;
    let oy = 0;
    let rot = 0;
    if (b.state === 'collapsing') {
      const k = Math.min(1, b.t / 1.2);
      oy = k * k * (d.height + 10);
      rot = (b.seed % 2 ? 1 : -1) * k * 0.14;
      ox = (Math.random() - 0.5) * (1 - k) * 8;
    } else if (b.rate > 0) {
      ox = Math.sin(this.tAnim * 55 + b.seed) * Math.min(1.8, 0.4 + b.rate * 0.1);
    }
    const cr = 1 - b.integrity / b.max;
    g.translate(x0 + w / 2 + ox, SKY + oy);
    g.rotate(rot + Math.sin(b.seed) * cr * 0.03);
    g.translate(-w / 2, 0);
    const h = d.height;
    const flag = (fx: number, fy: number, col: string) => {
      g.strokeStyle = '#3a3a3a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(fx, fy - 20);
      g.stroke();
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(fx, fy - 20);
      g.lineTo(fx + 15 + Math.sin(this.tAnim * 4 + fx) * 3, fy - 15);
      g.lineTo(fx, fy - 9);
      g.fill();
    };
    switch (d.kind) {
      case 'cottage': {
        g.fillStyle = '#d9c19a';
        g.fillRect(6, -30, w - 12, 30);
        g.fillStyle = '#a8412f';
        g.beginPath();
        g.moveTo(-2, -28);
        g.lineTo(w / 2, -h - 8);
        g.lineTo(w + 2, -28);
        g.fill();
        g.fillStyle = '#6b5a4d';
        g.fillRect(w - 20, -h + 2, 8, 16);
        g.fillStyle = '#5a3a22';
        g.fillRect(w / 2 - 6, -18, 12, 18);
        g.fillStyle = '#ffd36b';
        g.fillRect(13, -23, 10, 10);
        g.fillRect(w - 24, -23, 10, 10);
        break;
      }
      case 'granary': {
        g.fillStyle = '#c9a15a';
        g.fillRect(8, -38, w - 16, 38);
        g.strokeStyle = 'rgba(80,50,20,0.35)';
        g.lineWidth = 1;
        for (let xx = 14; xx < w - 8; xx += 8) {
          g.beginPath();
          g.moveTo(xx, -38);
          g.lineTo(xx, 0);
          g.stroke();
        }
        g.fillStyle = '#7a5a2a';
        g.beginPath();
        g.moveTo(2, -36);
        g.lineTo(w / 2, -h);
        g.lineTo(w - 2, -36);
        g.fill();
        g.fillStyle = '#3d2a14';
        g.fillRect(w / 2 - 7, -22, 14, 22);
        g.fillStyle = '#e8d070';
        g.beginPath();
        g.arc(w / 2, -45, 4, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'barn': {
        g.fillStyle = '#a8453a';
        g.fillRect(4, -38, w - 8, 38);
        g.fillStyle = '#5b3a2e';
        g.beginPath();
        g.moveTo(-2, -38);
        g.lineTo(12, -52);
        g.lineTo(w / 2, -h - 4);
        g.lineTo(w - 12, -52);
        g.lineTo(w + 2, -38);
        g.fill();
        g.fillStyle = '#7d3028';
        g.fillRect(w / 2 - 16, -28, 32, 28);
        g.strokeStyle = '#f0e6d0';
        g.lineWidth = 2;
        g.strokeRect(w / 2 - 16, -28, 32, 28);
        g.beginPath();
        g.moveTo(w / 2 - 16, -28);
        g.lineTo(w / 2 + 16, 0);
        g.moveTo(w / 2 + 16, -28);
        g.lineTo(w / 2 - 16, 0);
        g.stroke();
        break;
      }
      case 'tower': {
        g.fillStyle = '#9a9aa8';
        g.fillRect(12, -h + 14, w - 24, h - 14);
        this.bricks(g, 12, -h + 14, w - 24, h - 14);
        g.fillStyle = '#85858f';
        g.fillRect(6, -h + 8, w - 12, 10);
        for (let xx = 6; xx < w - 8; xx += 12) g.fillRect(xx, -h, 7, 9);
        g.fillStyle = '#20202a';
        g.fillRect(w / 2 - 2, -h + 34, 4, 14);
        g.fillRect(w / 2 - 2, -h + 60, 4, 14);
        g.fillRect(w / 2 - 6, -18, 12, 18);
        flag(w / 2, -h, '#c33');
        // salt lantern
        const gl = 0.5 + Math.sin(this.tAnim * 3) * 0.3;
        g.fillStyle = `rgba(255,255,255,${gl})`;
        g.beginPath();
        g.arc(w / 2, -h + 22, 6, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'chapel': {
        g.fillStyle = '#e6dcc8';
        g.fillRect(4, -40, w - 8, 40);
        g.fillStyle = '#6a7388';
        g.beginPath();
        g.moveTo(-2, -38);
        g.lineTo(w / 2 - 14, -56);
        g.lineTo(w / 2 + 14, -56);
        g.lineTo(w + 2, -38);
        g.fill();
        g.fillStyle = '#d6cbb4';
        g.fillRect(w / 2 - 14, -h + 20, 28, h - 40);
        g.fillStyle = '#6a7388';
        g.beginPath();
        g.moveTo(w / 2 - 17, -h + 20);
        g.lineTo(w / 2, -h - 4);
        g.lineTo(w / 2 + 17, -h + 20);
        g.fill();
        g.strokeStyle = '#f5e7a0';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(w / 2, -h - 4);
        g.lineTo(w / 2, -h - 18);
        g.moveTo(w / 2 - 5, -h - 12);
        g.lineTo(w / 2 + 5, -h - 12);
        g.stroke();
        g.fillStyle = '#7ab0e8';
        g.beginPath();
        g.arc(w / 2, -h + 36, 6, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#4a3a2a';
        g.beginPath();
        g.moveTo(w / 2 - 7, 0);
        g.lineTo(w / 2 - 7, -14);
        g.arc(w / 2, -14, 7, Math.PI, 0);
        g.lineTo(w / 2 + 7, 0);
        g.fill();
        g.fillStyle = `rgba(255,255,255,${0.4 + Math.sin(this.tAnim * 3) * 0.25})`;
        g.beginPath();
        g.arc(w / 2, -h + 12, 4, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'wall': {
        g.fillStyle = '#8b8f99';
        g.fillRect(0, -38, w, 38);
        this.bricks(g, 0, -38, w, 38);
        g.fillStyle = '#7b7f89';
        for (let xx = 0; xx < w; xx += 16) g.fillRect(xx + 2, -47, 10, 9);
        g.fillStyle = '#26262e';
        g.beginPath();
        g.moveTo(w / 2 - 12, 0);
        g.lineTo(w / 2 - 12, -16);
        g.arc(w / 2, -16, 12, Math.PI, 0);
        g.lineTo(w / 2 + 12, 0);
        g.fill();
        g.fillStyle = '#b03a3a';
        g.fillRect(10, -34, 10, 22);
        g.fillRect(w - 20, -34, 10, 22);
        break;
      }
      case 'guild': {
        g.fillStyle = '#4a3a34';
        g.fillRect(4, -40, w - 8, 40);
        g.strokeStyle = 'rgba(0,0,0,0.3)';
        for (let xx = 10; xx < w - 4; xx += 10) {
          g.beginPath();
          g.moveTo(xx, -40);
          g.lineTo(xx, 0);
          g.stroke();
        }
        g.fillStyle = '#2e2524';
        g.fillRect(-2, -46, w + 4, 8);
        g.fillStyle = '#6b5a4d';
        g.fillRect(w - 24, -h + 4, 10, 22);
        g.fillStyle = '#242020';
        g.fillRect(w / 2 - 8, -24, 16, 24);
        g.fillStyle = '#b02828';
        g.fillRect(10, -38, 12, 26);
        g.beginPath();
        g.moveTo(10, -12);
        g.lineTo(16, -6);
        g.lineTo(22, -12);
        g.fill();
        g.font = '16px sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#d4ff6a';
        g.fillText('☠', w / 2, -50);
        g.font = 'bold 8px sans-serif';
        g.fillStyle = '#e8d88a';
        g.fillText('GUILD', w / 2, -28);
        break;
      }
      case 'keep': {
        g.fillStyle = '#7e808c';
        g.fillRect(20, -h + 34, w - 40, h - 34);
        this.bricks(g, 20, -h + 34, w - 40, h - 34, 12);
        for (const tx of [0, w - 32]) {
          g.fillStyle = '#8c8e9a';
          g.fillRect(tx, -h + 6, 32, h - 6);
          this.bricks(g, tx, -h + 6, 32, h - 6, 12);
          g.fillStyle = '#6e707c';
          g.fillRect(tx - 3, -h, 38, 8);
          for (let xx = tx - 3; xx < tx + 34; xx += 12) g.fillRect(xx, -h - 7, 7, 8);
          g.fillStyle = '#ffd36b';
          g.fillRect(tx + 12, -h + 30, 8, 12);
          g.fillRect(tx + 12, -h + 62, 8, 12);
        }
        g.fillStyle = '#6e707c';
        for (let xx = 20; xx < w - 22; xx += 14) g.fillRect(xx, -h + 26, 9, 9);
        g.fillStyle = '#1e1e26';
        g.beginPath();
        g.moveTo(w / 2 - 16, 0);
        g.lineTo(w / 2 - 16, -28);
        g.arc(w / 2, -28, 16, Math.PI, 0);
        g.lineTo(w / 2 + 16, 0);
        g.fill();
        g.fillStyle = '#b03a3a';
        g.fillRect(w / 2 - 9, -h + 44, 18, 30);
        g.beginPath();
        g.moveTo(w / 2 - 9, -h + 74);
        g.lineTo(w / 2, -h + 66);
        g.lineTo(w / 2 + 9, -h + 74);
        g.fill();
        flag(16, -h - 7, '#d8b030');
        flag(w - 16, -h - 7, '#d8b030');
        break;
      }
    }
    // cracks
    if (cr > 0.25) {
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 1.5;
      const n = Math.floor(cr * 6) + 1;
      for (let k = 0; k < n; k++) {
        let px = 8 + hash(b.seed + k * 5) * (w - 16);
        let py = 0;
        g.beginPath();
        g.moveTo(px, py);
        for (let s = 0; s < 5; s++) {
          px += (hash(b.seed + k * 9 + s) - 0.5) * 10;
          py -= 6 + hash(b.seed + k + s * 3) * 6;
          g.lineTo(px, py);
        }
        g.stroke();
      }
    }
    g.restore();
    if (b.state === 'standing') {
      // integrity bar & markers
      const bx = x0 + w / 2 - 22;
      const by = SKY - d.height - (d.kind === 'chapel' ? 28 : d.kind === 'tower' || d.kind === 'keep' ? 30 : 16);
      if (b.integrity < b.max || d.spawner) {
        g.fillStyle = 'rgba(0,0,0,0.55)';
        g.fillRect(bx - 1, by - 1, 46, 7);
        g.fillStyle = b.integrity / b.max > 0.4 ? '#e8b64a' : '#e8644a';
        g.fillRect(bx, by, 44 * Math.max(0, b.integrity / b.max), 5);
      }
    }
  }

  drawSoil(g: CanvasRenderingContext2D) {
    g.fillStyle = '#2a1c15';
    g.fillRect(0, SKY, W, ROWS * CS);
    for (let r = 0; r < ROWS; r++) {
      const depthT = r / (ROWS - 1);
      const br = lerp(104, 44, depthT);
      const bg = lerp(72, 30, depthT);
      const bb = lerp(46, 24, depthT);
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const x = c * CS;
        const y = SKY + r * CS;
        const hsh = hash(i);
        const sh = (hsh - 0.5) * 12;
        const s = this.soil[i];
        const f = this.found[i];
        if (f >= 0) {
          g.fillStyle = '#6f7480';
          g.fillRect(x, y, CS, CS);
          this.bricks(g, x, y, CS, CS, 16);
          g.strokeStyle = 'rgba(255,255,255,0.12)';
          g.strokeRect(x + 0.5, y + 0.5, CS - 1, CS - 1);
          const b = this.buildings[f];
          if (b.integrity < b.max * 0.6) {
            g.strokeStyle = 'rgba(0,0,0,0.5)';
            g.beginPath();
            g.moveTo(x + 6 + hsh * 10, y);
            g.lineTo(x + 14, y + 12);
            g.lineTo(x + 8 + hsh * 8, y + CS);
            g.stroke();
          }
          continue;
        }
        if (s === 3) {
          g.fillStyle = '#4a4a52';
          g.fillRect(x, y, CS, CS);
          g.fillStyle = '#62626c';
          g.beginPath();
          g.moveTo(x + 3, y + CS - 4);
          g.lineTo(x + 8 + hsh * 6, y + 5);
          g.lineTo(x + CS - 8, y + 8);
          g.lineTo(x + CS - 3, y + CS - 5);
          g.fill();
          g.fillStyle = '#3a3a42';
          g.beginPath();
          g.moveTo(x + 10, y + CS - 5);
          g.lineTo(x + 14, y + 14);
          g.lineTo(x + CS - 6, y + CS - 6);
          g.fill();
          continue;
        }
        g.fillStyle = `rgb(${br + sh},${bg + sh * 0.8},${bb + sh * 0.6})`;
        g.fillRect(x, y, CS, CS);
        if (s === 1) {
          g.fillStyle = 'rgba(40,24,12,0.55)';
          g.fillRect(x, y, CS, CS);
          g.fillStyle = 'rgba(190,150,70,0.6)';
          for (let k = 0; k < 4; k++) g.fillRect(x + 4 + hash(i + k) * 22, y + 4 + hash(i * 3 + k) * 22, 2, 2);
        } else if (s === 2) {
          g.fillStyle = 'rgba(60,140,210,0.5)';
          g.fillRect(x, y, CS, CS);
          g.strokeStyle = 'rgba(190,230,255,0.45)';
          g.lineWidth = 1;
          g.beginPath();
          const wy = y + 12 + Math.sin(this.tAnim * 2 + c) * 2;
          g.moveTo(x + 2, wy);
          g.quadraticCurveTo(x + 10, wy - 4, x + 16, wy);
          g.quadraticCurveTo(x + 24, wy + 4, x + CS - 2, wy);
          g.stroke();
        } else if (s === 4) {
          g.fillStyle = '#f0e8d0';
          g.beginPath();
          g.ellipse(x + 16, y + 12, 7, 6, 0, 0, Math.PI * 2);
          g.fill();
          g.fillRect(x + 12, y + 16, 8, 4);
          g.fillStyle = '#2a1c15';
          g.fillRect(x + 12, y + 10, 3, 3);
          g.fillRect(x + 17, y + 10, 3, 3);
          g.strokeStyle = '#f0e8d0';
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x + 6, y + 26);
          g.lineTo(x + 26, y + 22);
          g.stroke();
        } else if (hsh > 0.6) {
          g.fillStyle = `rgba(0,0,0,0.22)`;
          g.beginPath();
          g.arc(x + 6 + hash(i + 1) * 20, y + 6 + hash(i + 2) * 20, 2 + hsh * 2, 0, Math.PI * 2);
          g.fill();
        } else if (hsh < 0.12) {
          g.fillStyle = 'rgba(200,170,130,0.25)';
          g.fillRect(x + hash(i + 5) * 24, y + hash(i + 6) * 24, 4, 3);
        }
      }
    }
    // subtle grid
    g.strokeStyle = 'rgba(0,0,0,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= COLS; c++) {
      g.moveTo(c * CS + 0.5, SKY);
      g.lineTo(c * CS + 0.5, H);
    }
    for (let r = 0; r <= ROWS; r++) {
      g.moveTo(0, SKY + r * CS + 0.5);
      g.lineTo(W, SKY + r * CS + 0.5);
    }
    g.stroke();
    // depth vignette
    const vg = g.createLinearGradient(0, SKY, 0, H);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,0.35)');
    g.fillStyle = vg;
    g.fillRect(0, SKY, W, ROWS * CS);
  }

  drawWards(g: CanvasRenderingContext2D) {
    g.save();
    g.beginPath();
    g.rect(0, SKY, W, ROWS * CS);
    g.clip();
    for (const b of this.buildings) {
      if (b.state !== 'standing' || b.def.ward <= 0) continue;
      const wx = (b.x + b.def.w / 2) * CS;
      const wy = SKY + b.def.d * CS;
      const rad = b.def.ward * CS;
      const grad = g.createRadialGradient(wx, wy, rad * 0.2, wx, wy, rad);
      grad.addColorStop(0, 'rgba(255,255,255,0.04)');
      grad.addColorStop(1, 'rgba(255,255,255,0.2)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(wx, wy, rad, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `rgba(255,255,255,${0.35 + Math.sin(this.tAnim * 3) * 0.15})`;
      g.setLineDash([6, 6]);
      g.lineDashOffset = -this.tAnim * 10;
      g.lineWidth = 2;
      g.stroke();
      g.setLineDash([]);
      // salt crystals
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + b.seed;
        const px = wx + Math.cos(a) * rad * 0.97;
        const py = wy + Math.sin(a) * rad * 0.97;
        g.beginPath();
        g.moveTo(px, py - 5);
        g.lineTo(px + 3, py);
        g.lineTo(px, py + 5);
        g.lineTo(px - 3, py);
        g.fill();
      }
    }
    g.restore();
  }

  drawPoison(g: CanvasRenderingContext2D) {
    for (let i = 0; i < this.poison.length; i++) {
      const p = this.poison[i];
      if (p < 0.08) continue;
      const a = Math.min(0.72, 0.1 + p * 0.07);
      const c = i % COLS;
      const r = (i / COLS) | 0;
      g.fillStyle = p > 3 ? `rgba(200,255,40,${a})` : `rgba(150,230,50,${a})`;
      g.fillRect(c * CS, SKY + r * CS, CS, CS);
      if (p > 1.2) {
        g.fillStyle = 'rgba(255,255,200,0.35)';
        g.beginPath();
        g.arc(c * CS + 8 + ((this.tAnim * 20 + i * 7) % 16), SKY + r * CS + 6 + ((this.tAnim * 12 + i * 5) % 20), 2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  rootColor(i: number): [string, string] {
    if (!this.conn[i] && this.rt[i] !== 3) return ['#8d8a78', 'rgba(0,0,0,0)'];
    const ratio = this.hp[i] / this.hpMax(this.rt[i]);
    if (ratio < 0.5 || this.poison[i] > 0.4) {
      const k = Math.floor(this.tAnim * 8) % 2;
      return [k ? '#ff9a7a' : '#ffcfa0', 'rgba(255,90,60,0.28)'];
    }
    if (this.rt[i] === 2) return ['#ffe0a0', 'rgba(255,170,70,0.3)'];
    return ['#f4f1d0', 'rgba(130,255,200,0.26)'];
  }

  drawRoots(g: CanvasRenderingContext2D) {
    g.lineCap = 'round';
    // edges
    for (let i = 0; i < this.rt.length; i++) {
      if (this.rt[i] === 0) continue;
      const c = i % COLS;
      const r = (i / COLS) | 0;
      const [x, y] = this.cellCenter(i);
      for (let k = 0; k < 2; k++) {
        const nc = c + (k === 0 ? 1 : 0);
        const nr = r + (k === 1 ? 1 : 0);
        if (nc >= COLS || nr >= ROWS) continue;
        const j = this.idx(nc, nr);
        if (this.rt[j] === 0) continue;
        const [x2, y2] = this.cellCenter(j);
        const thick = Math.max(this.rt[i], this.rt[j]) >= 2;
        const worse = this.hp[i] / this.hpMax(this.rt[i]) < this.hp[j] / this.hpMax(this.rt[j]) ? i : j;
        const [col, glow] = this.rootColor(worse);
        const mx = (x + x2) / 2 + (hash(i * 2 + k) - 0.5) * 7;
        const my = (y + y2) / 2 + (hash(i * 3 + k) - 0.5) * 7;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(mx, my, x2, y2);
        g.strokeStyle = glow;
        g.lineWidth = thick ? 12 : 7;
        g.stroke();
        g.strokeStyle = col;
        g.lineWidth = thick ? 4.5 : 2.2;
        g.stroke();
      }
    }
    // growing edges and bulbs
    for (const i of this.growing) {
      const c = i % COLS;
      const r = (i / COLS) | 0;
      const [x, y] = this.cellCenter(i);
      const p = this.grow[i];
      for (const [dc, dr] of DIRS) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
        const j = this.idx(nc, nr);
        if (this.rt[j] === 0) continue;
        const [x2, y2] = this.cellCenter(j);
        g.strokeStyle = 'rgba(244,241,208,0.85)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x2, y2);
        g.lineTo(lerp(x2, x, p), lerp(y2, y, p));
        g.stroke();
      }
      g.strokeStyle = 'rgba(200,255,220,0.7)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(x, y, 3 + p * 5, 0, Math.PI * 2);
      g.stroke();
    }
    // nodes & mods
    for (let i = 0; i < this.rt.length; i++) {
      const t = this.rt[i];
      if (t === 0) continue;
      const [x, y] = this.cellCenter(i);
      const [col] = this.rootColor(i);
      if (t === 3) {
        this.drawHeart(g, x, y, i);
        continue;
      }
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, t === 2 ? 5 : 3, 0, Math.PI * 2);
      g.fill();
      const m = this.mod[i];
      if (m === 1) {
        g.strokeStyle = `rgba(95,240,208,${0.25 + Math.sin(this.tAnim * 3 + i) * 0.1})`;
        g.lineWidth = 1.5;
        g.setLineDash([4, 5]);
        g.beginPath();
        g.arc(x, y, 2.2 * CS, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = '#2fd8b8';
        g.beginPath();
        g.arc(x, y, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#d8fff4';
        g.fillRect(x - 1.5, y - 5, 3, 10);
        g.fillRect(x - 5, y - 1.5, 10, 3);
      } else if (m === 2) {
        g.fillStyle = '#b6e030';
        g.beginPath();
        g.arc(x, y, 8, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#eaffa0';
        g.beginPath();
        g.arc(x - 2, y - 2, 3, 0, Math.PI * 2);
        g.arc(x + 3, y + 3, 2, 0, Math.PI * 2);
        g.fill();
      } else if (m === 3) {
        g.fillStyle = '#e870b0';
        g.beginPath();
        g.arc(x, y, 7, 0, Math.PI * 2);
        g.fill();
      }
      // hp bar when damaged
      const ratio = this.hp[i] / this.hpMax(t);
      if (ratio < 0.98) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(x - 10, y + 9, 20, 3);
        g.fillStyle = ratio > 0.5 ? '#9be36a' : '#ff6a4a';
        g.fillRect(x - 10, y + 9, 20 * Math.max(0, ratio), 3);
      }
    }
  }

  drawHeart(g: CanvasRenderingContext2D, x: number, y: number, i: number) {
    const pulse = 1 + Math.sin(this.tAnim * 3) * 0.08;
    const rg = g.createRadialGradient(x, y, 2, x, y, 30 * pulse);
    rg.addColorStop(0, 'rgba(255,240,180,0.85)');
    rg.addColorStop(1, 'rgba(255,200,100,0)');
    g.fillStyle = rg;
    g.beginPath();
    g.arc(x, y, 30 * pulse, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff2c0';
    g.beginPath();
    g.arc(x, y, 11 * pulse, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffb04a';
    g.beginPath();
    g.arc(x, y, 6 * pulse, 0, Math.PI * 2);
    g.fill();
    const ratio = this.hp[i] / this.hpMax(3);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x - 17, y + 17, 34, 5);
    g.fillStyle = ratio > 0.5 ? '#9be36a' : ratio > 0.25 ? '#ffd24a' : '#ff5a3a';
    g.fillRect(x - 16, y + 18, 32 * Math.max(0, ratio), 3);
  }

  drawFruits(g: CanvasRenderingContext2D) {
    for (let c = 0; c < COLS; c++) {
      const i = this.idx(c, 0);
      if (this.rt[i] === 0 || this.mod[i] !== 3) continue;
      const x = c * CS + CS / 2;
      const sway = Math.sin(this.tAnim * 2 + c) * 1.5;
      g.fillStyle = '#efe4d0';
      g.fillRect(x - 3 + sway * 0.4, SKY - 18, 6, 18);
      g.fillStyle = '#d8509a';
      g.beginPath();
      g.ellipse(x + sway, SKY - 20, 15, 11, 0, Math.PI, 0);
      g.fill();
      g.fillStyle = '#fbd0ea';
      g.beginPath();
      g.arc(x - 6 + sway, SKY - 24, 2.5, 0, Math.PI * 2);
      g.arc(x + 3 + sway, SKY - 27, 2, 0, Math.PI * 2);
      g.arc(x + 8 + sway, SKY - 22, 2, 0, Math.PI * 2);
      g.fill();
      // range hint while hovering
      if (this.hover && this.hover.c === c && this.hover.r === 0) {
        g.strokeStyle = 'rgba(255,170,220,0.4)';
        g.setLineDash([5, 5]);
        g.beginPath();
        g.arc(x, SKY - 10, 3.6 * CS, Math.PI, 0);
        g.stroke();
        g.setLineDash([]);
      }
    }
  }

  drawExt(g: CanvasRenderingContext2D, e: Ext) {
    const x = e.x * CS;
    if (e.state === 'work' && e.type === 'prober' && e.tr >= 0) {
      const p = 1 - e.timer / e.work;
      const depth = p * (e.tr + 0.5) * CS + 4;
      const rx = x + e.dir * 14;
      g.strokeStyle = '#b8c4d0';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(rx, SKY - 14);
      g.lineTo(rx, SKY + depth);
      g.stroke();
      g.fillStyle = '#b6ff3a';
      g.beginPath();
      g.arc(rx, SKY + depth, 4, 0, Math.PI * 2);
      g.fill();
    }
    const s = e.type === 'fumigator' ? 1.3 : 1;
    g.save();
    g.translate(x, SKY - 2);
    g.scale(e.dir * s, s);
    const walk = e.state === 'walk' && e.stun <= 0 ? Math.sin(e.anim * 10) : 0;
    const body = e.type === 'sprayer' ? '#e3c63a' : e.type === 'fumigator' ? '#e07a2a' : '#5fa4d6';
    g.fillStyle = '#2b2b33';
    g.fillRect(-6 + walk * 3, -12, 5, 12);
    g.fillRect(1 - walk * 3, -12, 5, 12);
    g.fillStyle = body;
    g.fillRect(-8, -30, 16, 19);
    g.fillStyle = '#8a8f98';
    g.fillRect(-14, -29, 7, 17);
    g.fillStyle = e.type === 'fumigator' ? '#d9ff7a' : '#c33';
    g.fillRect(-13, -32, 5, 3);
    g.fillStyle = body;
    g.beginPath();
    g.arc(1, -36, 7, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1b2b2e';
    g.fillRect(2, -39, 7, 5);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.fillRect(3, -39, 2, 2);
    g.strokeStyle = '#3a3a40';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(6, -24);
    if (e.state === 'work') {
      g.lineTo(13, -8);
      g.stroke();
      g.strokeStyle = '#999';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(13, -8);
      g.lineTo(15, -3);
    } else g.lineTo(15, -20);
    g.stroke();
    if (e.type === 'fumigator') {
      g.fillStyle = '#555a63';
      g.fillRect(-18, -24, 8, 12);
    }
    g.restore();
    // hp bar
    if (e.hp < e.maxhp) {
      g.fillStyle = 'rgba(0,0,0,0.6)';
      g.fillRect(x - 12, SKY - 56, 24, 4);
      g.fillStyle = '#ff6a4a';
      g.fillRect(x - 11, SKY - 55, 22 * Math.max(0, e.hp / e.maxhp), 2);
    }
    if (e.infect > 0) {
      g.fillStyle = 'rgba(255,150,220,0.3)';
      g.beginPath();
      g.arc(x, SKY - 24, 22, 0, Math.PI * 2);
      g.fill();
    }
    if (e.stun > 0) {
      g.fillStyle = '#ffe28a';
      g.font = '12px sans-serif';
      g.textAlign = 'center';
      g.fillText('✦ ✦', x, SKY - 56 + Math.sin(this.tAnim * 10) * 2);
    }
  }

  drawDuster(g: CanvasRenderingContext2D) {
    const d = this.duster;
    if (d.state === 'warn') {
      const f = Math.floor(this.tAnim * 5) % 2;
      g.fillStyle = f ? 'rgba(255,60,40,0.9)' : 'rgba(255,200,60,0.9)';
      g.beginPath();
      g.moveTo(6, 52);
      g.lineTo(36, 36);
      g.lineTo(36, 68);
      g.fill();
      g.font = 'bold 13px sans-serif';
      g.textAlign = 'left';
      g.fillText('CROP DUSTER INBOUND', 44, 58);
    }
    if (d.state === 'fly') {
      const px = d.x * CS;
      const py = 46 + Math.sin(this.tAnim * 3) * 2;
      g.save();
      g.translate(px, py);
      g.fillStyle = '#c7452e';
      g.beginPath();
      g.ellipse(0, 0, 28, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#e8d8a0';
      g.fillRect(-6, -3, 18, 12);
      g.fillStyle = '#9a2e1e';
      g.fillRect(-34, -14, 8, 14);
      g.fillStyle = '#d9d0b8';
      g.fillRect(-10, 6, 24, 3);
      g.fillStyle = '#7ec2e0';
      g.beginPath();
      g.arc(10, -5, 6, Math.PI, 0);
      g.fill();
      g.fillStyle = '#333';
      g.fillRect(26, -12 + Math.sin(this.tAnim * 60) * 3, 3, 24);
      g.restore();
      // mist trail
      const grd = g.createLinearGradient(px - 200, 0, px, 0);
      grd.addColorStop(0, 'rgba(180,255,60,0)');
      grd.addColorStop(1, 'rgba(180,255,60,0.35)');
      g.fillStyle = grd;
      g.fillRect(px - 200, py + 8, 200, SKY - py - 8);
    }
  }

  drawParticles(g: CanvasRenderingContext2D) {
    for (const p of this.parts) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      g.globalAlpha = p.kind === 1 ? a * 0.5 : a;
      g.fillStyle = p.color;
      if (p.kind === 2) g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      else {
        g.beginPath();
        g.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
  }

  drawHover(g: CanvasRenderingContext2D) {
    if (!this.hover || this.over) return;
    const { c, r } = this.hover;
    const res = this.canUse(this.tool, c, r);
    const x = c * CS;
    const y = SKY + r * CS;
    g.strokeStyle = res.ok ? 'rgba(160,255,190,0.95)' : 'rgba(255,120,100,0.9)';
    g.fillStyle = res.ok ? 'rgba(160,255,190,0.16)' : 'rgba(255,120,100,0.14)';
    g.lineWidth = 2;
    g.fillRect(x, y, CS, CS);
    g.strokeRect(x + 1, y + 1, CS - 2, CS - 2);
    // tooltip
    const lines: string[] = [];
    const cost = res.cost;
    lines.push(res.ok ? `${cost} nutrients` : res.reason);
    const i = this.idx(c, r);
    if (this.poison[i] > 0.25) lines.push(`☣ poison ${this.poison[i].toFixed(1)}`);
    if (this.found[i] >= 0) lines.push(`${this.buildings[this.found[i]].def.name} foundation`);
    g.font = 'bold 12px sans-serif';
    g.textAlign = 'left';
    const tw = Math.max(...lines.map((l) => g.measureText(l).width)) + 12;
    let tx = x + CS + 6;
    if (tx + tw > W) tx = x - tw - 6;
    let ty = y - 4;
    if (ty < 4) ty = 4;
    g.fillStyle = 'rgba(10,8,8,0.85)';
    g.fillRect(tx, ty, tw, lines.length * 16 + 6);
    lines.forEach((l, k) => {
      g.fillStyle = k === 0 ? (res.ok ? '#b6ffc8' : '#ff9a8a') : '#e8e0c0';
      g.fillText(l, tx + 6, ty + 16 + k * 16);
    });
  }

  drawFloats(g: CanvasRenderingContext2D) {
    g.font = 'bold 13px sans-serif';
    g.textAlign = 'center';
    for (const f of this.floats) {
      g.globalAlpha = Math.min(1, f.life * 1.5);
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillText(f.text, f.x + 1, f.y + 1);
      g.fillStyle = f.color;
      g.fillText(f.text, f.x, f.y);
    }
    g.globalAlpha = 1;
  }

  drawOverlay(g: CanvasRenderingContext2D) {
    if (this.over === 'lost') {
      const k = Math.min(1, 1 - this.endTimer / 2.4);
      g.fillStyle = `rgba(30,60,0,${k * 0.5})`;
      g.fillRect(0, 0, W, H);
    } else if (this.over === 'won') {
      const k = Math.min(1, 1 - this.endTimer / 2.2);
      g.fillStyle = `rgba(255,240,180,${k * 0.25})`;
      g.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------- input
  cellAt(px: number, py: number): { c: number; r: number } | null {
    const c = Math.floor(px / CS);
    const r = Math.floor((py - SKY) / CS);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { c, r };
  }
}
