// ============ TETRIS ULTIMATE — CORE ENGINE (vanilla JS) ============
export const COLS = 10, ROWS = 22, HIDDEN = 2;

// Seeded RNG (mulberry32)
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Piece definitions (base = rotation 0, generated clockwise) ----
const BASE = {
  I: { n: 4, c: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 3, c: [[1, 0], [2, 0], [1, 1], [2, 1]] },
  T: { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};
export const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
export const PIECE_INDEX = { I: 0, O: 1, T: 2, S: 3, Z: 4, J: 5, L: 6 };
export const GARBAGE_INDEX = 7;

export const SHAPES = {};
for (const t of TYPES) {
  const { n, c } = BASE[t];
  const rots = [c];
  for (let r = 1; r < 4; r++) {
    rots.push(rots[r - 1].map(([x, y]) => [n - 1 - y, x]));
  }
  if (t === 'O') { rots[1] = rots[2] = rots[3] = rots[0]; }
  SHAPES[t] = rots;
}

// ---- SRS wall kicks (dy already converted: + is DOWN) ----
const K_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};
const K_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};
const K_180 = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0]];

// Guideline gravity: seconds per row at a given level
export function gravitySpeed(level) {
  const l = Math.min(level, 19);
  const sec = Math.pow(0.8 - (l - 1) * 0.007, l - 1);
  return 1 / Math.max(sec, 0.008); // cells per second
}

const CLEAR_NAMES = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS'];
const BASE_PTS = [0, 100, 300, 500, 800];
const TS_PTS = [400, 800, 1200, 1600];        // full T-spin: 0,1,2,3 lines
const TSM_PTS = [100, 200, 400, 400];         // mini T-spin
const ATK = [0, 0, 1, 2, 4];                  // normal clears
const ATK_TS = [0, 2, 4, 6];                  // full T-spin clears
const COMBO_ATK = [0, 0, 1, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];

export class Game {
  /**
   * cfg: { seed, gravityMult, startLevel, linesPerLevel, lockDelay, zen,
   *        levelCap, gravityLevelCap }
   */
  constructor(cfg) {
    this.cfg = Object.assign({
      seed: (Math.random() * 1e9) | 0, gravityMult: 1, startLevel: 1,
      linesPerLevel: 10, lockDelay: 500, zen: false,
      levelCap: 99, gravityLevelCap: 19,
    }, cfg);
    this.rng = mulberry32(this.cfg.seed);
    this.grid = [];
    for (let y = 0; y < ROWS; y++) this.grid.push(new Array(COLS).fill(null));
    this.bag = []; this.queue = [];
    while (this.queue.length < 5) this.queue.push(this._fromBag());
    this.hold = null; this.canHold = true;
    this.level = this.cfg.startLevel; this.lines = 0; this.score = 0;
    this.combo = -1; this.b2b = false;
    this.pending = 0; this.garbHole = (this.rng() * COLS) | 0;
    this.over = false; this.events = [];
    this.lastAction = 'spawn'; this.lastKick = 0;
    this.gravAcc = 0; this.lockTimer = 0; this.lockResets = 0; this.maxYReached = -99;
    this.softActive = false;
    this.stats = { pieces: 0, holds: 0, tetris: 0, tspins: 0, maxCombo: 0, attack: 0, clears: [0, 0, 0, 0, 0], pcs: 0, zenResets: 0 };
    this.cur = null;
    this._spawn();
  }

  _fromBag() {
    if (this.bag.length === 0) {
      this.bag = TYPES.slice();
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = (this.rng() * (i + 1)) | 0;
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
    }
    return this.bag.pop();
  }

  cellsOf(p) { return SHAPES[p.type][p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy]); }

  collides(type, rot, x, y) {
    for (const [cx, cy] of SHAPES[type][rot]) {
      const ax = x + cx, ay = y + cy;
      if (ax < 0 || ax >= COLS || ay >= ROWS) return true;
      if (ay >= 0 && this.grid[ay][ax] !== null) return true;
    }
    return false;
  }

  _spawn(forcedType) {
    const type = forcedType !== undefined ? forcedType : this.queue.shift();
    if (forcedType === undefined) this.queue.push(this._fromBag());
    this.cur = { type, rot: 0, x: 3, y: 0 };
    this.gravAcc = 0; this.lockTimer = 0; this.lockResets = 0; this.maxYReached = -99;
    this.lastAction = 'spawn';
    if (this.collides(type, 0, 3, 0)) {
      // try one row up
      if (!this.collides(type, 0, 3, -1)) { this.cur.y = -1; }
      else { this._topOut(); }
    }
  }

  _topOut() {
    if (this.cfg.zen) {
      for (let y = 0; y < ROWS; y++) this.grid[y].fill(null);
      this.pending = 0;
      this.stats.zenResets++;
      this.events.push({ type: 'zenreset' });
      this.cur = { type: this.cur ? this.cur.type : this.queue[0], rot: 0, x: 3, y: 0 };
    } else {
      this.over = true;
      this.events.push({ type: 'topout' });
    }
  }

  grounded() {
    const c = this.cur;
    return c ? this.collides(c.type, c.rot, c.x, c.y + 1) : false;
  }

  _onSuccessMove(kind) {
    this.lastAction = kind;
    if (this.grounded() && this.lockResets < 15) {
      this.lockTimer = 0; this.lockResets++;
    }
  }

  move(dx) {
    const c = this.cur;
    if (!c || this.over) return false;
    if (!this.collides(c.type, c.rot, c.x + dx, c.y)) {
      c.x += dx; this._onSuccessMove('move');
      this.events.push({ type: 'move' });
      return true;
    }
    return false;
  }

  rotate(dir) { // dir: 1 cw, -1 ccw, 2 = 180
    const c = this.cur;
    if (!c || this.over || c.type === 'O') { if (c && c.type === 'O') this.events.push({ type: 'rotate' }); return c ? c.type === 'O' : false; }
    const nr = ((c.rot + dir) % 4 + 4) % 4;
    let kicks;
    if (dir === 2) kicks = K_180;
    else kicks = (c.type === 'I' ? K_I : K_JLSTZ)[c.rot + '>' + nr];
    for (let i = 0; i < kicks.length; i++) {
      const [dx, dy] = kicks[i];
      if (!this.collides(c.type, nr, c.x + dx, c.y + dy)) {
        c.rot = nr; c.x += dx; c.y += dy;
        this.lastKick = i;
        this._onSuccessMove('rotate');
        this.events.push({ type: 'rotate' });
        return true;
      }
    }
    return false;
  }

  holdPiece() {
    if (!this.canHold || !this.cur || this.over) return false;
    const held = this.hold;
    this.hold = this.cur.type;
    this.canHold = false;
    this.stats.holds++;
    if (held) this._spawn(held); else this._spawn();
    this.events.push({ type: 'hold' });
    return true;
  }

  hardDrop() {
    const c = this.cur;
    if (!c || this.over) return;
    let d = 0;
    while (!this.collides(c.type, c.rot, c.x, c.y + 1)) { c.y++; d++; }
    this.score += d * 2;
    if (d > 0) this.lastAction = 'drop';
    this.events.push({ type: 'harddrop', dist: d, cells: this.cellsOf(c) });
    this._lock();
  }

  update(dt) {
    if (this.over || !this.cur) return;
    const base = gravitySpeed(Math.min(this.level, this.cfg.gravityLevelCap)) * this.cfg.gravityMult;
    const g = this.softActive ? Math.max(30, base * 20) : base;
    this.gravAcc += g * (dt / 1000);
    let steps = Math.min(30, Math.floor(this.gravAcc));
    this.gravAcc -= Math.floor(this.gravAcc);
    const c = this.cur;
    while (steps-- > 0) {
      if (!this.collides(c.type, c.rot, c.x, c.y + 1)) {
        c.y++;
        if (this.softActive) this.score += 1;
        if (c.y > this.maxYReached) { this.maxYReached = c.y; this.lockTimer = 0; this.lockResets = 0; }
        this.lastAction = 'drop';
      } else { this.gravAcc = 0; break; }
    }
    if (this.grounded()) {
      this.lockTimer += dt;
      const delay = this.softActive ? Math.min(this.cfg.lockDelay, 120) : this.cfg.lockDelay;
      if (this.lockTimer >= delay || this.lockResets >= 15) this._lock();
    } else {
      this.lockTimer = 0;
    }
  }

  _detectTSpin() {
    const c = this.cur;
    if (c.type !== 'T' || this.lastAction !== 'rotate') return 0;
    const corners = [[c.x, c.y], [c.x + 2, c.y], [c.x, c.y + 2], [c.x + 2, c.y + 2]];
    const occ = corners.map(([x, y]) =>
      x < 0 || x >= COLS || y >= ROWS || (y >= 0 && this.grid[y][x] !== null) ? 1 : 0);
    // front corner pairs by rotation: 0 up, 1 right, 2 down, 3 left
    const FRONT = [[0, 1], [1, 3], [2, 3], [0, 2]];
    const f = FRONT[c.rot];
    const front = occ[f[0]] + occ[f[1]];
    const total = occ[0] + occ[1] + occ[2] + occ[3];
    if (total < 3) return 0;
    if (front === 2) return 2;                      // full
    if (this.lastKick === 4) return 2;              // kick-upgraded
    return 1;                                        // mini
  }

  _lock() {
    const c = this.cur;
    if (!c) return;
    const tspin = this._detectTSpin();
    const cells = this.cellsOf(c);
    let allHidden = true;
    for (const [x, y] of cells) {
      if (y >= HIDDEN) allHidden = false;
      if (y >= 0 && y < ROWS) this.grid[y][x] = PIECE_INDEX[c.type];
    }
    this.stats.pieces++;
    // clear detection
    const rows = [];
    for (let y = 0; y < ROWS; y++) {
      if (this.grid[y].every(v => v !== null)) rows.push(y);
    }
    const rowData = rows.map(y => ({ y, cells: this.grid[y].slice() }));
    for (const y of rows) {
      this.grid.splice(y, 1);
      this.grid.unshift(new Array(COLS).fill(null));
    }
    const n = rows.length;
    let points = 0, attack = 0, text = '', b2bNow = false, pc = false;

    if (n > 0) this.combo++; else this.combo = -1;
    if (this.combo > this.stats.maxCombo) this.stats.maxCombo = this.combo;

    if (n > 0 || tspin > 0) {
      if (tspin === 2) {
        points = TS_PTS[n]; attack = ATK_TS[n];
        text = n > 0 ? 'T-SPIN ' + CLEAR_NAMES[n] : 'T-SPIN';
        if (n > 0) this.stats.tspins++;
      } else if (tspin === 1) {
        points = TSM_PTS[n]; attack = n >= 2 ? 1 : 0;
        text = 'T-SPIN MINI' + (n > 0 ? ' ' + CLEAR_NAMES[n] : '');
        if (n > 0) this.stats.tspins++;
      } else {
        points = BASE_PTS[n]; attack = ATK[n];
        text = CLEAR_NAMES[n];
        if (n === 4) this.stats.tetris++;
      }
      // back-to-back
      const difficult = n === 4 || (tspin > 0 && n > 0);
      if (difficult) {
        if (this.b2b) { b2bNow = true; points = Math.floor(points * 1.5); attack += 1; }
        this.b2b = true;
      } else if (n > 0) {
        this.b2b = false;
      }
      // combo
      if (this.combo > 0) {
        points += 50 * this.combo;
        attack += COMBO_ATK[Math.min(this.combo, COMBO_ATK.length - 1)];
      }
      points *= this.level;
      // perfect clear
      if (n > 0 && this.grid.every(r => r.every(v => v === null))) {
        pc = true; points += 3000 * this.level; attack += 10;
        this.stats.pcs++;
      }
      this.score += points;
      if (n > 0) this.stats.clears[n]++;
      this.stats.attack += attack;
    }

    const prevLevel = this.level;
    this.lines += n;
    const newLevel = Math.min(this.cfg.levelCap,
      this.cfg.startLevel + Math.floor(this.lines / this.cfg.linesPerLevel));
    if (newLevel > this.level) this.level = newLevel;

    if (n > 0 || tspin > 0) {
      this.events.push({ type: 'clear', n, rows: rowData, tspin, text, points, combo: this.combo, b2b: b2bNow, pc, attack });
    } else {
      this.events.push({ type: 'lock', cells });
    }
    if (this.level > prevLevel) this.events.push({ type: 'levelup', level: this.level });

    if (allHidden && n === 0) { this._topOut(); if (this.over) return; }

    // garbage lands only when you don't clear
    if (n === 0 && this.pending > 0) {
      const apply = Math.min(this.pending, 8);
      this.pending -= apply;
      this._applyGarbage(apply);
      if (this.over) return;
    }
    this.canHold = true;
    this._spawn();
  }

  _applyGarbage(n) {
    let overflow = false;
    for (let y = 0; y < n; y++) {
      if (this.grid[y].some(v => v !== null)) overflow = true;
    }
    this.grid.splice(0, n);
    for (let i = 0; i < n; i++) {
      if (this.rng() < 0.25) this.garbHole = (this.rng() * COLS) | 0;
      const row = new Array(COLS).fill(GARBAGE_INDEX);
      row[this.garbHole] = null;
      this.grid.push(row);
    }
    this.events.push({ type: 'garbage', n });
    if (overflow) this._topOut();
  }

  ghostY() {
    const c = this.cur;
    if (!c) return 0;
    let y = c.y;
    while (!this.collides(c.type, c.rot, c.x, y + 1)) y++;
    return y;
  }
}
