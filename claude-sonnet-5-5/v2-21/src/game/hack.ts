// ===== Hacking minigames (rendered on the game canvas, slow-motion world behind) =====
import { audio } from './audio';
import { clamp } from './data';

export type HackKind = 'seq' | 'timing' | 'code';
interface Btn { x: number; y: number; w: number; h: number; act: string }
const ARROWS = ['▲', '▶', '▼', '◀'];
const SYM = ['◆', '●', '▲', '■'];
const SYMC = ['#28e0ff', '#ff2fd6', '#ffd23f', '#7dff6b'];

export class HackGame {
  kind: HackKind; diff: number; rounds: number; round = 0; t: number; tmax: number;
  done = false; success = false; aborted = false; penalty: number; keys: number; keyUsed = false; title: string; accent: string;
  seq: number[] = []; inv: boolean[] = []; idx = 0;
  pos = 0; dir = 1; spd = 1; zc = 0.5; zw = 0.2; locks = 0; need = 3;
  code: number[] = []; cur: number[] = []; guesses: { g: number[]; hit: number; near: number }[] = []; maxG = 6; len = 3;
  btns: Btn[] = []; flash = 0; flashCol = '#fff'; age = 0;

  constructor(kind: HackKind, diff: number, rounds: number, timeBonus: number, penalty: number, keys: number, title: string, accent: string) {
    this.kind = kind; this.diff = diff; this.rounds = Math.max(1, rounds); this.penalty = penalty; this.keys = keys; this.title = title; this.accent = accent;
    const base = kind === 'seq' ? 7.5 : kind === 'timing' ? 9 : 17;
    this.tmax = Math.max(5, base + timeBonus - diff * 0.35);
    this.t = this.tmax;
    this.newRound();
  }

  newRound() {
    const d = this.diff, r = this.round;
    if (this.kind === 'seq') {
      const n = clamp(3 + Math.floor(d * 0.6) + r, 3, 8);
      this.seq = Array.from({ length: n }, () => Math.floor(Math.random() * 4));
      this.inv = this.seq.map(() => d >= 3 && Math.random() < 0.25);
      this.idx = 0;
    } else if (this.kind === 'timing') {
      this.spd = 0.8 + d * 0.12 + r * 0.1;
      this.zw = clamp(0.26 - d * 0.02 - r * 0.02, 0.09, 0.26);
      this.locks = 0; this.need = 3; this.newZone();
    } else {
      this.len = d >= 3 ? 4 : 3;
      this.code = Array.from({ length: this.len }, () => Math.floor(Math.random() * 4));
      this.cur = []; this.guesses = [];
    }
  }
  newZone() { this.zc = this.zw / 2 + 0.05 + Math.random() * (0.9 - this.zw); }

  private bad(pen = 1) {
    this.t -= pen * this.penalty; this.flash = 0.35; this.flashCol = '#ff3355'; audio.sfx('hackFail');
  }
  private roundDone() {
    this.round++; audio.sfx('hackOk'); this.flash = 0.3; this.flashCol = '#42ffa8';
    if (this.round >= this.rounds) { this.done = true; this.success = true; return; }
    this.t = Math.min(this.tmax, this.t + 2.5); this.newRound();
  }
  act(a: string) {
    if (this.done) return;
    if (a === 'abort') { this.done = true; this.aborted = true; return; }
    if (a === 'key') { if (this.keys > 0) { this.keyUsed = true; this.done = true; this.success = true; audio.sfx('hackOk'); } return; }
    if (this.kind === 'seq') {
      const m: Record<string, number> = { up: 0, right: 1, down: 2, left: 3 };
      if (!(a in m)) return;
      const want = this.inv[this.idx] ? (this.seq[this.idx] + 2) % 4 : this.seq[this.idx];
      if (m[a] === want) { this.idx++; audio.sfx('hackKey', this.idx); if (this.idx >= this.seq.length) this.roundDone(); }
      else { this.idx = 0; this.bad(1); }
    } else if (this.kind === 'timing') {
      if (a !== 'lock') return;
      if (Math.abs(this.pos - this.zc) <= this.zw / 2) {
        this.locks++; audio.sfx('hackKey', this.locks * 3); this.flash = 0.15; this.flashCol = '#42ffa8';
        if (this.locks >= this.need) this.roundDone(); else this.newZone();
      } else this.bad(1.2);
    } else {
      const sm: Record<string, number> = { s0: 0, s1: 1, s2: 2, s3: 3, up: 0, right: 1, down: 2, left: 3 };
      if (a === 'clear') { this.cur = []; return; }
      if (!(a in sm)) return;
      this.cur.push(sm[a]); audio.sfx('hackKey', this.cur.length);
      if (this.cur.length >= this.len) {
        const g = this.cur.slice();
        let hit = 0; const cc = [0, 0, 0, 0], gc = [0, 0, 0, 0];
        g.forEach((s, i) => { if (s === this.code[i]) hit++; cc[this.code[i]]++; gc[s]++; });
        let tot = 0; for (let i = 0; i < 4; i++) tot += Math.min(cc[i], gc[i]);
        this.guesses.push({ g, hit, near: tot - hit }); this.cur = [];
        if (hit === this.len) this.roundDone();
        else if (this.guesses.length >= this.maxG) { this.t = 0; this.bad(0); }
        else { audio.sfx('hackKey', 1); }
      }
    }
  }
  key(code: string) {
    const m: Record<string, string> = {
      ArrowUp: 'up', KeyW: 'up', ArrowRight: 'right', KeyD: 'right', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left',
      Space: 'lock', Enter: 'lock', Backspace: 'clear', KeyK: 'key', Escape: 'abort', Digit1: 's0', Digit2: 's1', Digit3: 's2', Digit4: 's3',
    };
    if (m[code]) this.act(m[code]);
  }
  click(px: number, py: number) {
    for (const b of this.btns) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { this.act(b.act); return true; }
    return false;
  }
  update(dt: number) {
    if (this.done) return;
    this.age += dt; this.flash = Math.max(0, this.flash - dt);
    this.t -= dt;
    if (this.kind === 'timing') {
      this.pos += this.dir * this.spd * dt;
      if (this.pos >= 1) { this.pos = 1; this.dir = -1; } else if (this.pos <= 0) { this.pos = 0; this.dir = 1; }
    }
    if (this.t <= 0) { this.t = 0; this.done = true; this.success = false; }
  }

  draw(c: CanvasRenderingContext2D, W: number, H: number) {
    const u = clamp(Math.min(W / 900, H / 600), 0.5, 2);
    this.btns = [];
    c.save();
    c.fillStyle = 'rgba(2,0,10,0.55)'; c.fillRect(0, 0, W, H);
    const pw = 580 * u, ph = 420 * u, px = (W - pw) / 2, py = (H - ph) / 2;
    c.fillStyle = 'rgba(8,6,24,0.94)'; c.fillRect(px, py, pw, ph);
    c.strokeStyle = this.flash > 0 ? this.flashCol : this.accent; c.lineWidth = 2 * u; c.shadowColor = c.strokeStyle; c.shadowBlur = 18 * u;
    c.strokeRect(px, py, pw, ph); c.shadowBlur = 0;
    // scanlines
    c.fillStyle = 'rgba(255,255,255,0.025)';
    for (let y = py; y < py + ph; y += 4 * u) c.fillRect(px, y, pw, 1.5 * u);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = this.accent; c.font = `700 ${18 * u}px Orbitron, sans-serif`;
    c.fillText(`BREACH // ${this.title}`, W / 2, py + 28 * u);
    c.fillStyle = '#9d98d8'; c.font = `600 ${13 * u}px Rajdhani, sans-serif`;
    c.fillText(`Round ${Math.min(this.round + 1, this.rounds)} / ${this.rounds}`, W / 2, py + 52 * u);
    // timer
    const tw = pw - 80 * u, tx = px + 40 * u, ty = py + 68 * u, fr = clamp(this.t / this.tmax, 0, 1);
    c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(tx, ty, tw, 8 * u);
    c.fillStyle = fr > 0.3 ? this.accent : '#ff3355'; c.fillRect(tx, ty, tw * fr, 8 * u);
    c.fillStyle = '#fff'; c.font = `700 ${12 * u}px Orbitron, sans-serif`; c.textAlign = 'right';
    c.fillText(this.t.toFixed(1) + 's', tx + tw, ty + 20 * u);
    c.textAlign = 'center';
    const btn = (x: number, y: number, w: number, h: number, label: string, act: string, col: string, fs = 22) => {
      c.fillStyle = 'rgba(20,16,50,0.9)'; c.fillRect(x, y, w, h);
      c.strokeStyle = col; c.lineWidth = 1.5 * u; c.strokeRect(x, y, w, h);
      c.fillStyle = col; c.font = `700 ${fs * u}px Orbitron, sans-serif`; c.fillText(label, x + w / 2, y + h / 2 + 1);
      this.btns.push({ x, y, w, h, act });
    };
    const cy = py + 110 * u;
    if (this.kind === 'seq') {
      c.fillStyle = '#c9c4ff'; c.font = `600 ${15 * u}px Rajdhani, sans-serif`;
      c.fillText('Repeat the sequence with ARROWS / WASD.  Red ⇄ = press the OPPOSITE.', W / 2, cy);
      const n = this.seq.length, cell = 54 * u, total = n * cell, sx = W / 2 - total / 2;
      for (let i = 0; i < n; i++) {
        const x = sx + i * cell;
        const done = i < this.idx, cur = i === this.idx;
        c.fillStyle = done ? 'rgba(66,255,168,0.25)' : cur ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)';
        c.fillRect(x + 3 * u, cy + 24 * u, cell - 6 * u, cell - 6 * u);
        c.strokeStyle = cur ? '#fff' : 'rgba(255,255,255,0.15)'; c.lineWidth = 1.5 * u; c.strokeRect(x + 3 * u, cy + 24 * u, cell - 6 * u, cell - 6 * u);
        c.fillStyle = done ? '#42ffa8' : this.inv[i] ? '#ff5577' : '#fff';
        c.font = `700 ${26 * u}px sans-serif`; c.fillText(ARROWS[this.seq[i]], x + cell / 2, cy + 24 * u + cell / 2 - 3 * u);
        if (this.inv[i]) { c.font = `700 ${11 * u}px sans-serif`; c.fillText('⇄', x + cell / 2, cy + 24 * u + cell - 12 * u); }
      }
      const by = py + 270 * u, bw = 64 * u, gx = W / 2 - 2 * bw - 1.5 * 8 * u;
      (['left', 'up', 'down', 'right'] as const).forEach((d, i) => btn(gx + i * (bw + 8 * u), by, bw, 52 * u, ARROWS[{ up: 0, right: 1, down: 2, left: 3 }[d]], d, '#c9c4ff', 24));
    } else if (this.kind === 'timing') {
      c.fillStyle = '#c9c4ff'; c.font = `600 ${15 * u}px Rajdhani, sans-serif`;
      c.fillText('Press SPACE / click LOCK when the marker is inside the green window.', W / 2, cy);
      const bx = px + 50 * u, bw = pw - 100 * u, by = cy + 40 * u, bh = 46 * u;
      c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(bx, by, bw, bh);
      c.fillStyle = 'rgba(66,255,168,0.45)'; c.fillRect(bx + (this.zc - this.zw / 2) * bw, by, this.zw * bw, bh);
      c.strokeStyle = '#42ffa8'; c.lineWidth = 2 * u; c.strokeRect(bx + (this.zc - this.zw / 2) * bw, by, this.zw * bw, bh);
      c.fillStyle = '#fff'; c.shadowColor = '#fff'; c.shadowBlur = 12 * u; c.fillRect(bx + this.pos * bw - 2 * u, by - 8 * u, 4 * u, bh + 16 * u); c.shadowBlur = 0;
      for (let i = 0; i < this.need; i++) {
        c.fillStyle = i < this.locks ? '#42ffa8' : 'rgba(255,255,255,0.15)';
        c.beginPath(); c.arc(W / 2 + (i - 1) * 34 * u, by + bh + 36 * u, 10 * u, 0, 6.3); c.fill();
      }
      btn(W / 2 - 100 * u, py + 285 * u, 200 * u, 54 * u, 'LOCK', 'lock', this.accent, 22);
    } else {
      c.fillStyle = '#c9c4ff'; c.font = `600 ${14 * u}px Rajdhani, sans-serif`;
      c.fillText(`Crack the ${this.len}-symbol code. ● hit = right spot, ○ = right symbol, wrong spot. Keys 1-4.`, W / 2, cy - 6 * u);
      const rowH = 27 * u, ry = cy + 14 * u;
      for (let i = 0; i < this.maxG; i++) {
        const y = ry + i * rowH, g = this.guesses[i];
        c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(W / 2 - 150 * u, y, 300 * u, rowH - 3 * u);
        if (g) {
          g.g.forEach((s, k) => { c.fillStyle = SYMC[s]; c.font = `700 ${17 * u}px sans-serif`; c.fillText(SYM[s], W / 2 - 130 * u + k * 30 * u, y + rowH / 2 - 1 * u); });
          c.textAlign = 'left'; c.font = `700 ${14 * u}px Orbitron, sans-serif`;
          c.fillStyle = '#42ffa8'; c.fillText('●'.repeat(g.hit), W / 2 + 6 * u, y + rowH / 2 - 1);
          c.fillStyle = '#ffd23f'; c.fillText('○'.repeat(g.near), W / 2 + 6 * u + g.hit * 15 * u, y + rowH / 2 - 1);
          c.textAlign = 'center';
        } else if (i === this.guesses.length) {
          for (let k = 0; k < this.len; k++) {
            const s = this.cur[k];
            c.fillStyle = s === undefined ? 'rgba(255,255,255,0.2)' : SYMC[s]; c.font = `700 ${17 * u}px sans-serif`;
            c.fillText(s === undefined ? '_' : SYM[s], W / 2 - 130 * u + k * 30 * u, y + rowH / 2 - 1 * u);
          }
        }
      }
      const by = py + 332 * u, bw = 54 * u;
      for (let i = 0; i < 4; i++) btn(W / 2 - 2 * bw - 12 * u + i * (bw + 8 * u) - 20 * u, by, bw, 44 * u, SYM[i], 's' + i, SYMC[i], 22);
      btn(W / 2 + 2 * bw - 8 * u + 8 * u, by, 70 * u, 44 * u, 'CLR', 'clear', '#ff7788', 13);
    }
    c.font = `600 ${12 * u}px Rajdhani, sans-serif`; c.fillStyle = '#7f7aba'; c.textAlign = 'left';
    c.fillText('ESC — abort (locks terminal briefly)', px + 20 * u, py + ph - 18 * u);
    if (this.keys > 0) {
      c.textAlign = 'right';
      const kx = px + pw - 150 * u, ky = py + ph - 36 * u;
      c.fillStyle = 'rgba(40,30,0,0.8)'; c.fillRect(kx, ky, 134 * u, 26 * u); c.strokeStyle = '#ffd23f'; c.strokeRect(kx, ky, 134 * u, 26 * u);
      c.textAlign = 'center'; c.fillStyle = '#ffd23f'; c.font = `700 ${11 * u}px Orbitron, sans-serif`;
      c.fillText(`🗝 KEY [K] ×${this.keys}`, kx + 67 * u, ky + 14 * u);
      this.btns.push({ x: kx, y: ky, w: 134 * u, h: 26 * u, act: 'key' });
    }
    c.restore();
  }
}
