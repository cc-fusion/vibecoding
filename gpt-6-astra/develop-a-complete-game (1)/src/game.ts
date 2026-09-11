// Orbit Breaker: a self-contained, fixed-substep arcade engine.
export type Mode = 'ready' | 'playing' | 'paused' | 'sector' | 'lost' | 'won';
export type PowerKind = 'wide' | 'slow' | 'life';
export interface Snapshot {
  mode: Mode; score: number; best: number; sector: number; lives: number;
  destroyed: number; total: number; time: number; docked: boolean;
  combo: number; wide: number; slow: number;
}
interface Brick { x: number; y: number; w: number; h: number; hp: number; max: number; color: string }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string }
interface Drop { x: number; y: number; kind: PowerKind }
export const W = 900, H = 520;
export const SECTORS = ['First contact', 'Asteroid alley', 'Deep space', 'Event horizon', 'The final frontier'];
const COLORS = ['#b9ed7b', '#90cdb3', '#9ca2e5', '#d5a2c4', '#e7ba91', '#83bcca'];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export class OrbitGame {
  state: Snapshot = { mode: 'ready', score: 0, best: 0, sector: 1, lives: 3, destroyed: 0, total: 0, time: 0, docked: true, combo: 0, wide: 0, slow: 0 };
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; notify: (s: Snapshot) => void;
  bricks: Brick[] = []; particles: Particle[] = []; drops: Drop[] = [];
  paddle = 450; target = 450; ball = { x: 450, y: 458, vx: 0, vy: 0 };
  trail: { x: number; y: number }[] = []; keys = new Set<string>();
  frame = 0; last = 0; clock = 0; publishClock = 0; sound = true;
  audio: AudioContext | null = null; shake = 0; hitCount = 0; disposed = false;
  stars = Array.from({ length: 90 }, (_, i) => ({ x: ((i * 127.3 + 41) % W), y: ((i * 83.7 + 13) % H), size: i % 5 === 0 ? 1.5 : .75, phase: i * .8 }));
  constructor(canvas: HTMLCanvasElement, notify: (s: Snapshot) => void) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d')!; this.notify = notify;
    canvas.width = W * 2; canvas.height = H * 2;
    try { this.state.best = Number(localStorage.getItem('orbit-best') || 0) || 0; this.sound = localStorage.getItem('orbit-sound') !== 'off'; } catch { /* Storage is optional. */ }
    this.layout(); this.emit(); this.frame = requestAnimationFrame(this.loop);
  }
  emit() { this.notify({ ...this.state }); }
  saveBest() {
    if (this.state.score > this.state.best) {
      this.state.best = this.state.score;
      try { localStorage.setItem('orbit-best', String(this.state.best)); } catch { /* Private browsing fallback. */ }
    }
  }
  unlockAudio() {
    if (!this.sound) return;
    try { if (!this.audio) this.audio = new AudioContext(); if (this.audio.state === 'suspended') void this.audio.resume(); } catch { /* Game remains playable without audio. */ }
  }
  tone(freq: number, duration = .08, type: OscillatorType = 'sine', volume = .035) {
    if (!this.sound || !this.audio) return;
    try {
      const o = this.audio.createOscillator(), g = this.audio.createGain(), t = this.audio.currentTime;
      o.type = type; o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * .6), t + duration);
      g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(.0001, t + duration);
      o.connect(g); g.connect(this.audio.destination); o.start(t); o.stop(t + duration);
    } catch { /* Ignore unavailable output devices. */ }
  }
  setSound(on: boolean) { this.sound = on; try { localStorage.setItem('orbit-sound', on ? 'on' : 'off'); } catch {} if (on) { this.unlockAudio(); this.tone(640); } }
  layout() {
    const s = this.state.sector, rows = 3 + Math.floor(s / 2), cols = 9;
    this.bricks = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const hp = s >= 3 && (c + r) % (s === 5 ? 2 : 3) === 0 ? 2 : 1;
      this.bricks.push({ x: 65 + c * 86, y: 66 + r * 33, w: 78, h: 23, hp, max: hp, color: COLORS[(r + s - 1) % COLORS.length] });
    }
    this.state.total = this.bricks.length; this.state.destroyed = 0; this.state.wide = 0; this.state.slow = 0;
    this.drops = []; this.particles = []; this.trail = []; this.paddle = 450; this.target = 450; this.dock();
  }
  dock() { this.state.docked = true; this.state.combo = 0; this.ball = { x: this.paddle, y: 458, vx: 0, vy: 0 }; this.trail = []; }
  start() {
    this.unlockAudio(); this.saveBest();
    Object.assign(this.state, { mode: 'playing', score: 0, sector: 1, lives: 3, time: 0, combo: 0 });
    this.hitCount = 0; this.keys.clear(); this.layout(); this.emit(); this.tone(520, .15);
  }
  launch() {
    if (this.state.mode !== 'playing' || !this.state.docked) return;
    this.unlockAudio(); this.state.docked = false;
    const speed = this.speed(); this.ball.vx = speed * .32; this.ball.vy = -speed * .947; this.emit(); this.tone(780, .12);
  }
  speed() { return 325 + (this.state.sector - 1) * 43; }
  pause() {
    if (this.state.mode === 'playing') { this.state.mode = 'paused'; this.keys.clear(); this.emit(); }
    else if (this.state.mode === 'paused') { this.state.mode = 'playing'; this.emit(); }
  }
  next() {
    if (this.state.mode !== 'sector') return;
    this.state.sector++; this.state.mode = 'playing'; this.layout(); this.emit();
  }
  menu() {
    this.saveBest();
    Object.assign(this.state, { mode: 'ready', score: 0, sector: 1, lives: 3, time: 0, combo: 0 });
    this.keys.clear(); this.layout(); this.emit();
  }
  move(x: number) { this.target = clamp(x, this.paddleWidth() / 2 + 12, W - this.paddleWidth() / 2 - 12); }
  paddleWidth() { return this.state.wide > 0 ? 160 : 108; }
  burst(x: number, y: number, color: string, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2, speed = 35 + Math.random() * 150, life = .3 + Math.random() * .45;
      this.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, color });
    }
  }
  update(dt: number) {
    const s = this.state; s.time += dt; s.wide = Math.max(0, s.wide - dt); s.slow = Math.max(0, s.slow - dt);
    const direction = (this.keys.has('arrowright') || this.keys.has('d') ? 1 : 0) - (this.keys.has('arrowleft') || this.keys.has('a') ? 1 : 0);
    if (direction) this.move(this.target + direction * 660 * dt);
    const half = this.paddleWidth() / 2;
    this.paddle = clamp(this.paddle + (this.target - this.paddle) * Math.min(1, dt * 25), half + 12, W - half - 12);
    if (s.docked) { this.ball.x = this.paddle; this.ball.y = 458; }
    else {
      const b = this.ball, oldX = b.x, oldY = b.y, slow = s.slow > 0 ? .70 : 1;
      b.x += b.vx * dt * slow; b.y += b.vy * dt * slow;
      if (b.x < 17) { b.x = 17; b.vx = Math.abs(b.vx); this.tone(270, .04); }
      if (b.x > W - 17) { b.x = W - 17; b.vx = -Math.abs(b.vx); this.tone(270, .04); }
      if (b.y < 18) { b.y = 18; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && oldY <= 463 && b.y >= 463 && Math.abs(b.x - this.paddle) < half + 7) {
        const angle = clamp((b.x - this.paddle) / half, -.95, .95) * 1.1;
        const speed = this.speed(); b.vx = Math.sin(angle) * speed; b.vy = -Math.cos(angle) * speed; b.y = 462;
        s.combo = 0; this.burst(b.x, 469, '#c5f88a', 5); this.tone(440, .06);
      }
      // Resolve a single brick per substep to avoid double-reflection corner traps.
      for (let i = 0; i < this.bricks.length; i++) {
        const r = this.bricks[i];
        if (b.x + 7 > r.x && b.x - 7 < r.x + r.w && b.y + 7 > r.y && b.y - 7 < r.y + r.h) {
          if (oldY + 7 <= r.y) { b.vy = -Math.abs(b.vy); b.y = r.y - 7; }
          else if (oldY - 7 >= r.y + r.h) { b.vy = Math.abs(b.vy); b.y = r.y + r.h + 7; }
          else if (oldX < r.x + r.w / 2) { b.vx = -Math.abs(b.vx); b.x = r.x - 7; }
          else { b.vx = Math.abs(b.vx); b.x = r.x + r.w + 7; }
          r.hp--; this.burst(b.x, b.y, r.color); this.shake = 1.5;
          if (r.hp <= 0) {
            this.bricks.splice(i, 1); s.destroyed++; s.combo++;
            s.score += 100 * Math.min(s.combo, 5); this.hitCount++;
            if (this.hitCount % 7 === 0) {
              const kinds: PowerKind[] = ['wide', 'slow', 'life'];
              this.drops.push({ x: r.x + r.w / 2, y: r.y + r.h, kind: kinds[(Math.floor(this.hitCount / 7) - 1) % 3] });
            }
          } else s.score += 25;
          this.tone(480 + Math.min(s.combo, 8) * 65, .08, 'triangle'); this.saveBest();
          if (!this.bricks.length) {
            s.score += 500 * s.sector; s.mode = s.sector === 5 ? 'won' : 'sector'; this.saveBest(); this.keys.clear(); this.tone(1040, .5); this.emit(); return;
          }
          break;
        }
      }
      if (b.y > H + 15) {
        s.lives--; this.shake = 6; this.tone(130, .35, 'sawtooth', .025);
        if (s.lives <= 0) { s.mode = 'lost'; this.saveBest(); this.keys.clear(); }
        else { s.wide = 0; s.slow = 0; this.drops = []; this.dock(); }
        this.emit();
      }
    }
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]; d.y += 115 * dt;
      if (d.y >= 461 && d.y <= 493 && Math.abs(d.x - this.paddle) < half + 12) {
        if (d.kind === 'wide') s.wide = 14;
        if (d.kind === 'slow') s.slow = 12;
        if (d.kind === 'life') s.lives = Math.min(5, s.lives + 1);
        s.score += 150; this.saveBest(); this.burst(d.x, d.y, '#c4f58c', 22); this.tone(920, .25); this.drops.splice(i, 1);
      } else if (d.y > H + 20) this.drops.splice(i, 1);
    }
  }
  rounded(x: number, y: number, w: number, h: number, r: number) { this.ctx.beginPath(); this.ctx.roundRect(x, y, w, h, r); }
  draw() {
    const c = this.ctx, s = this.state; c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, W, H);
    c.fillStyle = '#121a1c'; c.fillRect(0, 0, W, H);
    const g = c.createRadialGradient(660, 220, 5, 660, 220, 560); g.addColorStop(0, '#26352b'); g.addColorStop(1, '#121a1c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (const star of this.stars) { c.globalAlpha = .17 + (Math.sin(this.clock * .5 + star.phase) + 1) * .15; c.fillStyle = '#deead8'; c.fillRect(star.x, star.y, star.size, star.size); }
    c.globalAlpha = 1;
    c.strokeStyle = '#d4e9b609'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 45) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 45) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    if (s.mode === 'ready') return;
    c.save(); if (this.shake > .1) c.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
    c.strokeStyle = '#c6ed9b14'; c.strokeRect(10, 10, W - 20, H - 20);
    for (const b of this.bricks) {
      c.fillStyle = b.color; this.rounded(b.x, b.y, b.w, b.h, 4); c.fill();
      c.fillStyle = '#ffffff35'; this.rounded(b.x + 2, b.y + 2, b.w - 4, 3, 2); c.fill();
      if (b.hp > 1) { c.fillStyle = '#1b25284d'; c.fillRect(b.x + b.w / 2 - 8, b.y + 9, 5, 5); c.fillRect(b.x + b.w / 2 + 3, b.y + 9, 5, 5); }
      else if (b.max > 1) { c.strokeStyle = '#1a222655'; c.beginPath(); c.moveTo(b.x + 36, b.y); c.lineTo(b.x + 42, b.y + 11); c.lineTo(b.x + 37, b.y + 23); c.stroke(); }
    }
    for (let i = 0; i < this.trail.length; i++) { c.globalAlpha = i / this.trail.length * .22; c.fillStyle = '#d6ffa3'; c.beginPath(); c.arc(this.trail[i].x, this.trail[i].y, 6 * i / this.trail.length, 0, Math.PI * 2); c.fill(); }
    c.globalAlpha = 1;
    const pw = this.paddleWidth(); c.shadowColor = '#bdf387'; c.shadowBlur = 18; c.fillStyle = '#c4f58c'; this.rounded(this.paddle - pw / 2, 470, pw, 10, 5); c.fill();
    c.shadowBlur = 0; c.fillStyle = '#e5ffc2'; this.rounded(this.paddle - pw / 2 + 9, 471, pw - 18, 2, 1); c.fill();
    c.fillStyle = '#f2ffe4'; c.shadowColor = '#c4f58c'; c.shadowBlur = 15; c.beginPath(); c.arc(this.ball.x, this.ball.y, 6.5, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    for (const d of this.drops) {
      c.fillStyle = d.kind === 'wide' ? '#c4f58c' : d.kind === 'slow' ? '#c2b4ee' : '#f0bf9f'; this.rounded(d.x - 14, d.y - 12, 28, 24, 6); c.fill();
      c.fillStyle = '#202722'; c.font = 'bold 17px monospace'; c.textAlign = 'center'; c.fillText(d.kind === 'wide' ? '↔' : d.kind === 'slow' ? '◷' : '+', d.x, d.y + 6);
    }
    for (const p of this.particles) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.color; c.fillRect(p.x, p.y, 3, 3); }
    c.globalAlpha = 1;
    if (s.docked && s.mode === 'playing') { c.textAlign = 'center'; c.fillStyle = '#bfcbb8'; c.font = '12px monospace'; c.fillText('CLICK OR PRESS SPACE TO LAUNCH', W / 2, 352); c.fillStyle = '#718076'; c.font = '11px monospace'; c.fillText('Move your paddle. Find your angle.', W / 2, 375); }
    if (s.combo >= 3 && !s.docked) { c.fillStyle = '#c4f58c'; c.textAlign = 'right'; c.font = 'bold 13px monospace'; c.fillText(`${Math.min(s.combo, 5)}× COMBO`, W - 35, 38); }
    c.restore();
  }
  loop = (now: number) => {
    if (this.disposed) return;
    const dt = Math.min((now - (this.last || now)) / 1000, .04); this.last = now; this.clock += dt;
    if (this.state.mode === 'playing') {
      // Small physics steps prevent the ball tunneling through thin bricks.
      const steps = Math.max(1, Math.ceil(dt / .006));
      for (let i = 0; i < steps && this.state.mode === 'playing'; i++) this.update(dt / steps);
      if (!this.state.docked) { this.trail.push({ x: this.ball.x, y: this.ball.y }); if (this.trail.length > 12) this.trail.shift(); }
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 80 * dt; p.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0); this.shake *= .87;
    }
    this.publishClock += dt; if (this.publishClock > .1) { this.emit(); this.publishClock = 0; }
    this.draw(); this.frame = requestAnimationFrame(this.loop);
  };
  destroy() { this.disposed = true; cancelAnimationFrame(this.frame); if (this.audio) void this.audio.close(); }
}
