// ============ TETRIS ULTIMATE — AI OPPONENT ============
import { COLS, ROWS, SHAPES } from './core.js';

// Heuristic board evaluation (classic weights, tuned)
function evalBoard(grid, cleared) {
  const heights = new Array(COLS).fill(0);
  let holes = 0;
  for (let x = 0; x < COLS; x++) {
    let found = false;
    for (let y = 0; y < ROWS; y++) {
      if (grid[y][x] !== null) {
        if (!found) { heights[x] = ROWS - y; found = true; }
      } else if (found) {
        holes++;
      }
    }
  }
  let agg = 0, bump = 0;
  for (let x = 0; x < COLS; x++) {
    agg += heights[x];
    if (x > 0) bump += Math.abs(heights[x] - heights[x - 1]);
  }
  let s = -0.51 * agg - 1.15 * holes - 0.18 * bump + 0.9 * cleared;
  if (cleared === 4) s += 2.5;          // love tetrises
  return s;
}

function collideSim(grid, type, rot, x, y) {
  for (const [cx, cy] of SHAPES[type][rot]) {
    const ax = x + cx, ay = y + cy;
    if (ax < 0 || ax >= COLS || ay >= ROWS) return true;
    if (ay >= 0 && grid[ay][ax] !== null) return true;
  }
  return false;
}

function placements(grid, type) {
  const out = [];
  const nRots = type === 'O' ? 1 : (type === 'I' || type === 'S' || type === 'Z') ? 2 : 4;
  for (let rot = 0; rot < nRots; rot++) {
    for (let x = -2; x < COLS; x++) {
      if (collideSim(grid, type, rot, x, 0)) continue;
      let y = 0;
      while (!collideSim(grid, type, rot, x, y + 1)) y++;
      // simulate placement
      const g2 = grid.map(r => r.slice());
      for (const [cx, cy] of SHAPES[type][rot]) {
        const ay = y + cy;
        if (ay >= 0) g2[ay][x + cx] = 1;
      }
      let cleared = 0;
      for (let ry = 0; ry < ROWS; ry++) {
        if (g2[ry].every(v => v !== null)) {
          cleared++;
          g2.splice(ry, 1);
          g2.unshift(new Array(COLS).fill(null));
        }
      }
      out.push({ rot, x, score: evalBoard(g2, cleared), useHold: false });
    }
  }
  return out;
}

export class Bot {
  /** opts: { speed: inputs/sec, err: 0..1, useHold: bool, reaction: ms } */
  constructor(game, opts) {
    this.game = game;
    this.speed = opts.speed || 4;
    this.err = opts.err || 0;
    this.useHold = !!opts.useHold;
    this.reaction = opts.reaction != null ? opts.reaction : 250;
    this.plan = null; this.step = 0; this.timer = 0; this.waiting = true;
    this.lastPieceStamp = -1;
  }

  _computePlan() {
    const g = this.game;
    if (!g.cur) return null;
    const grid = g.grid;
    let options = placements(grid, g.cur.type);
    if (this.useHold) {
      const altType = g.hold || g.queue[0];
      if (altType && altType !== g.cur.type && g.canHold) {
        const alt = placements(grid, altType).map(o => Object.assign({}, o, { useHold: true }));
        options = options.concat(alt);
      }
    }
    if (options.length === 0) return ['drop'];
    options.sort((a, b) => b.score - a.score);
    let pick = options[0];
    if (this.err > 0 && Math.random() < this.err) {
      pick = options[Math.min(options.length - 1, 1 + ((Math.random() * 3) | 0))];
    }
    const inputs = [];
    if (pick.useHold) inputs.push('hold');
    if (pick.rot === 3) inputs.push('ccw');
    else for (let i = 0; i < pick.rot; i++) inputs.push('cw');
    const dx = pick.x - 3;
    for (let i = 0; i < Math.abs(dx); i++) inputs.push(dx < 0 ? 'left' : 'right');
    inputs.push('drop');
    return inputs;
  }

  update(dt) {
    const g = this.game;
    if (g.over || !g.cur) return;
    const stamp = g.stats.pieces;
    if (stamp !== this.lastPieceStamp) {
      this.lastPieceStamp = stamp;
      this.plan = null; this.step = 0; this.timer = 0; this.waiting = true;
    }
    this.timer += dt;
    if (this.waiting) {
      if (this.timer >= this.reaction) {
        this.plan = this._computePlan();
        this.step = 0; this.waiting = false; this.timer = 0;
      }
      return;
    }
    if (!this.plan) return;
    const interval = 1000 / this.speed;
    if (this.timer >= interval) {
      this.timer -= interval;
      const input = this.plan[this.step++];
      if (input === undefined) { this.plan = null; return; }
      switch (input) {
        case 'cw': g.rotate(1); break;
        case 'ccw': g.rotate(-1); break;
        case 'left': g.move(-1); break;
        case 'right': g.move(1); break;
        case 'hold': {
          g.holdPiece();
          // re-plan for the swapped piece
          this.plan = this._computePlan() || ['drop'];
          // strip a possible duplicate hold
          if (this.plan[0] === 'hold') this.plan.shift();
          this.step = 0;
          this.lastPieceStamp = g.stats.pieces;
          break;
        }
        case 'drop': g.hardDrop(); this.plan = null; break;
        default: break;
      }
    }
  }
}
