import { useEffect, useRef, useState, type PointerEvent } from 'react';

// A complete brick-breaker in one artifact: rendering, physics, audio, and interface.
const W = 960, H = 600, LEFT = 34, RIGHT = 926, PADDLE_Y = 548;
const NAMES = ['FIRST CONTACT', 'CROSSCURRENT', 'THE LAST SIGNAL'];
const COLORS = ['#d9f77a', '#abe7a0', '#79d9b8', '#63c8c4', '#73acc4', '#a0a4d0'];
type Phase = 'start' | 'playing' | 'paused' | 'level' | 'won' | 'lost';
type Brick = { x: number; y: number; hp: number; max: number; row: number };
type Ball = { x: number; y: number; vx: number; vy: number; stuck: boolean; trail: { x: number; y: number }[] };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
type Drop = { x: number; y: number; kind: 'wide' | 'slow' | 'life' };
type Game = { phase: Phase; level: number; score: number; best: number; lives: number; combo: number; destroyed: number;
  paddleX: number; paddleW: number; balls: Ball[]; bricks: Brick[]; particles: Particle[]; drops: Drop[];
  time: number; wideUntil: number; slowUntil: number; shake: number; flash: number; left: boolean; right: boolean };

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
function bricksFor(level: number): Brick[] {
  const bricks: Brick[] = [];
  for (let row = 0; row < (level === 3 ? 6 : 5); row++) for (let col = 0; col < 11; col++) {
    if (level === 1 && ((row === 0 && (col === 0 || col === 10)) || (row === 4 && col % 2 === 1))) continue;
    if (level === 2 && ((row === 0 && col % 3 === 1) || (row === 3 && (col === 0 || col === 10)))) continue;
    if (level === 3 && (row === 1 || row === 4) && (col === 2 || col === 8)) continue;
    const hp = level === 1 ? (row === 0 && col >= 4 && col <= 6 ? 2 : 1) : level === 2 ? ((row + col) % 4 === 0 ? 2 : 1) : ((row + col) % 5 === 0 ? 3 : (row + col) % 2 === 0 ? 2 : 1);
    bricks.push({ x: 56 + col * 77, y: 112 + row * 33, hp, max: hp, row });
  }
  return bricks;
}
function ballFor(x: number, level: number, stuck = true): Ball {
  const speed = 355 + (level - 1) * 45;
  return { x, y: PADDLE_Y - 14, vx: speed * .48, vy: -speed * .88, stuck, trail: [] };
}
function newGame(best = 0): Game {
  return { phase: 'start', level: 1, score: 0, best, lives: 4, combo: 0, destroyed: 0, paddleX: W / 2, paddleW: 108,
    balls: [ballFor(W / 2, 1)], bricks: bricksFor(1), particles: [], drops: [], time: 0, wideUntil: 0, slowUntil: 0,
    shake: 0, flash: 0, left: false, right: false };
}
function burst(g: Game, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 40 + Math.random() * 145, life = .25 + Math.random() * .5;
    g.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, color });
  }
  if (g.particles.length > 180) g.particles.splice(0, g.particles.length - 180);
}
function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 3) {
  c.beginPath(); c.roundRect(x, y, w, h, r);
}
function draw(c: CanvasRenderingContext2D, g: Game) {
  c.fillStyle = '#07131a'; c.fillRect(0, 0, W, H);
  const glow = c.createRadialGradient(480, 270, 10, 480, 300, 560);
  glow.addColorStop(0, '#13343b'); glow.addColorStop(.6, '#0a2028'); glow.addColorStop(1, '#07131a');
  c.fillStyle = glow; c.fillRect(0, 0, W, H);
  c.save(); c.translate((Math.random() - .5) * g.shake, (Math.random() - .5) * g.shake);
  c.strokeStyle = 'rgba(114,178,171,.065)'; c.lineWidth = 1;
  for (let x = 34; x < W; x += 44) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
  for (let y = 22; y < H; y += 44) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
  c.strokeStyle = 'rgba(162,218,195,.25)'; c.beginPath(); c.moveTo(LEFT, 0); c.lineTo(LEFT, H); c.moveTo(RIGHT, 0); c.lineTo(RIGHT, H); c.stroke();
  c.font = '11px monospace'; c.fillStyle = 'rgba(155,211,188,.38)'; c.textAlign = 'left'; c.fillText(`// GRID 0${g.level}`, 52, 51);
  c.textAlign = 'right'; c.fillText('CLEAR ALL TARGETS', 908, 51);
  for (const b of g.bricks) {
    const color = COLORS[b.row]; c.shadowColor = color; c.shadowBlur = 10;
    c.fillStyle = b.hp < b.max ? '#426767' : color; rect(c, b.x, b.y, 68, 23); c.fill(); c.shadowBlur = 0;
    c.fillStyle = 'rgba(3,23,28,.22)'; c.fillRect(b.x + 4, b.y + 18, 60, 2);
    if (b.hp > 1) { c.fillStyle = 'rgba(7,27,31,.7)'; for (let i = 0; i < b.hp; i++) c.fillRect(b.x + 60 - i * 7, b.y + 5, 3, 3); }
  }
  for (const d of g.drops) {
    const color = d.kind === 'life' ? '#ff9e87' : d.kind === 'wide' ? '#d9f77a' : '#82d4ef';
    c.save(); c.translate(d.x, d.y); c.rotate(Math.PI / 4); c.shadowColor = color; c.shadowBlur = 17;
    c.strokeStyle = color; c.lineWidth = 2; c.fillStyle = '#102d32'; rect(c, -11, -11, 22, 22); c.fill(); c.stroke(); c.restore();
    c.fillStyle = color; c.textAlign = 'center'; c.font = 'bold 12px monospace'; c.fillText(d.kind === 'life' ? '+' : d.kind === 'wide' ? 'W' : 'S', d.x, d.y + 4);
  }
  const paddleColor = g.wideUntil > g.time ? '#d9f77a' : '#e5f0dc';
  c.shadowColor = paddleColor; c.shadowBlur = 22; c.fillStyle = paddleColor;
  rect(c, g.paddleX - g.paddleW / 2, PADDLE_Y, g.paddleW, 12, 5); c.fill(); c.shadowBlur = 0;
  c.fillStyle = '#83aa9d'; c.fillRect(g.paddleX - 13, PADDLE_Y + 14, 26, 2);
  for (const ball of g.balls) {
    ball.trail.forEach((p, i) => { c.beginPath(); c.arc(p.x, p.y, 7 * (i + 1) / (ball.trail.length + 2), 0, Math.PI * 2); c.fillStyle = `rgba(218,248,139,${.05 + i * .06})`; c.fill(); });
    c.shadowColor = '#e2fb98'; c.shadowBlur = 24; c.beginPath(); c.arc(ball.x, ball.y, 7, 0, Math.PI * 2); c.fillStyle = '#f4ffd1'; c.fill(); c.shadowBlur = 0;
  }
  for (const p of g.particles) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.color; c.fillRect(p.x, p.y, 3, 3); }
  c.globalAlpha = 1;
  if (g.phase === 'playing' && g.balls.some(b => b.stuck)) { c.textAlign = 'center'; c.font = '12px monospace'; c.fillStyle = 'rgba(213,238,217,.85)'; c.fillText('PRESS SPACE OR CLICK TO LAUNCH', 480, 506); }
  c.restore();
  if (g.flash > 0) { c.fillStyle = `rgba(226,255,192,${g.flash * .18})`; c.fillRect(0, 0, W, H); }
}

const styles = `
*{box-sizing:border-box}body{margin:0;background:#071016;color:#eaf0e6;font-family:'DM Sans',sans-serif}button{font:inherit;cursor:pointer}
.app{min-height:100vh;background:radial-gradient(ellipse 80% 75% at 50% 48%,#14272b 0%,#0a171d 54%,#071016 100%);overflow:hidden}
.shell{max-width:1320px;margin:auto;padding:28px 48px 30px}
.top{display:flex;align-items:center;justify-content:space-between;gap:20px;padding-bottom:24px;border-bottom:1px solid #29413e}
.brand{display:flex;align-items:center;gap:13px;font-family:'Barlow Condensed',Impact,sans-serif;font-weight:800;font-size:25px;letter-spacing:.09em;line-height:1}
.brand-mark{width:27px;height:27px;display:block;border:5px solid #d8f77c;border-right-color:transparent;transform:skew(-12deg) rotate(-28deg)}.brand span:last-child{color:#d8f77c}
.top-right{display:flex;align-items:center;gap:29px}.top-note,.top-button,.eyebrow,.arena-head,.metric-label,.arena-foot,.micro,.overlay-kicker,.help-line{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.14em}
.top-note{color:#77918b}.top-button{border:0;background:transparent;color:#b8d4c6;padding:8px 0;transition:color .2s}.top-button:hover{color:#d8f77c}
.intro{display:flex;justify-content:space-between;align-items:end;padding:30px 0 22px;gap:20px}.intro h1{font-family:'Barlow Condensed',Impact,sans-serif;font-size:clamp(42px,5.2vw,72px);font-weight:800;letter-spacing:-.035em;line-height:.88;margin:6px 0 0}.intro h1 span{color:#d8f77c}.eyebrow{color:#9bb7a8}.intro-copy{color:#8ba49b;font-size:13px;margin:0 2px 3px 0;text-align:right;line-height:1.6}
.arena-frame{border:1px solid #3c6257;background:#091b20;box-shadow:0 22px 80px #0007,0 0 45px #7aae7930}.arena-head{height:43px;padding:0 18px;display:flex;justify-content:space-between;align-items:center;color:#8caf9e;border-bottom:1px solid #304c45}.arena-head .signal{display:flex;align-items:center;gap:9px;color:#d8f77c}.signal-dot{width:6px;height:6px;border-radius:50%;background:#d8f77c;box-shadow:0 0 11px #d8f77c;animation:pulse 2.2s infinite}
.game-wrap{position:relative;width:100%;aspect-ratio:8/5;overflow:hidden}canvas{display:block;width:100%;height:100%;touch-action:none;cursor:crosshair}
.overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(4,16,20,.75);backdrop-filter:blur(5px);animation:appear .25s ease both;text-align:center;padding:22px}.overlay.start{background:linear-gradient(90deg,rgba(4,16,20,.92),rgba(4,16,20,.67) 51%,rgba(4,16,20,.55));justify-content:flex-start;text-align:left;padding-left:9%}.overlay-inner{max-width:550px}.overlay-kicker{color:#d8f77c;margin:0 0 14px}.overlay-title{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:800;letter-spacing:-.025em;line-height:.82;font-size:clamp(56px,9.2vw,126px);margin:0}.overlay-title em{color:#d8f77c;font-style:normal}.overlay-title.small{font-size:clamp(58px,8vw,104px)}.overlay-desc{color:#b3c7bb;font-size:15px;line-height:1.65;max-width:360px;margin:27px auto 25px}.start .overlay-desc{margin-left:0}.overlay-actions{display:flex;gap:11px;align-items:center;justify-content:center;flex-wrap:wrap}.start .overlay-actions{justify-content:flex-start}
.primary{background:#d8f77c;color:#102322;border:1px solid #d8f77c;min-width:176px;padding:15px 21px;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;letter-spacing:.1em;transition:transform .18s,background .18s,box-shadow .18s}.primary:hover{transform:translateY(-3px);background:#edffa9;box-shadow:0 8px 25px #c5fa6550}.secondary{background:transparent;color:#e6eee2;border:1px solid #799487;padding:15px 21px;min-width:144px;font-family:'DM Mono',monospace;font-size:12px;letter-spacing:.1em;transition:border-color .18s,color .18s}.secondary:hover{border-color:#d8f77c;color:#d8f77c}.overlay-score{font-family:'Barlow Condensed',Impact,sans-serif;font-size:38px;font-weight:700;color:#d8f77c;margin:15px 0 -12px}
.hud{display:grid;grid-template-columns:1.1fr 1fr 1fr 1fr auto;min-height:92px;border-top:1px solid #304c45;align-items:center}.metric{padding:15px 27px;border-right:1px solid #304c45;min-height:58px}.metric:first-child{padding-left:23px}.metric-label{color:#809b8e;margin-bottom:5px}.metric-value{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:700;font-size:30px;line-height:1;letter-spacing:.02em}.metric-value.accent{color:#d8f77c}.lives{display:flex;gap:6px;height:30px;align-items:center}.life{width:14px;height:14px;background:#d8f77c;transform:rotate(45deg) scale(.8);box-shadow:0 0 10px #d8f77c55}.life.empty{background:#3e5952;box-shadow:none}.hud-actions{display:flex;gap:8px;padding:0 18px}.icon-button{width:39px;height:39px;display:grid;place-items:center;border:1px solid #426256;background:transparent;color:#c6d9c5;transition:background .2s,color .2s}.icon-button:hover{background:#29483e;color:#d8f77c}.icon-button:disabled{opacity:.35;cursor:not-allowed}
.arena-foot{display:flex;justify-content:space-between;gap:12px;padding-top:18px;color:#79958a}.arena-foot strong{color:#bdd5c3;font-weight:400}.bottom{display:flex;justify-content:space-between;align-items:end;gap:20px;border-top:1px solid #29413e;margin-top:29px;padding-top:19px}.bottom p{color:#6f8b80;font-size:12px;margin:0}.bottom .micro{color:#526e64}
.help-backdrop{position:fixed;inset:0;z-index:20;background:#020a0bc9;display:grid;place-items:center;padding:22px}.help{position:relative;width:min(100%,510px);background:#10262a;border:1px solid #6b9d75;padding:38px;box-shadow:0 25px 100px #000a}.help h2{font-family:'Barlow Condensed',Impact,sans-serif;font-size:56px;line-height:.9;margin:12px 0 24px}.help p{color:#b1cabe;line-height:1.6;font-size:14px}.help-line{border-top:1px solid #36534b;padding:13px 0;color:#b4cbbd;display:flex;justify-content:space-between;gap:12px}.help-line span:first-child{color:#d8f77c}.help-close{position:absolute;right:20px;top:18px;background:none;border:0;color:#cde0d0;font-size:24px}
@keyframes pulse{50%{opacity:.4;box-shadow:0 0 3px #d8f77c}}@keyframes appear{from{opacity:0}to{opacity:1}}
@media(max-width:800px){.shell{padding:18px 18px 25px}.top{padding-bottom:17px}.top-note{display:none}.intro{padding:25px 0 17px}.intro-copy{display:none}.overlay-desc{font-size:12px;margin-top:14px;margin-bottom:16px}.overlay-kicker{font-size:9px;margin-bottom:8px}.primary,.secondary{padding:10px 13px;min-width:120px;font-size:10px}.hud{grid-template-columns:repeat(4,1fr)}.metric{padding:12px}.metric:first-child{padding-left:12px}.metric-value{font-size:25px}.hud-actions{grid-column:1/-1;border-top:1px solid #304c45;padding:10px 12px;justify-content:flex-end}.arena-foot{font-size:9px}}
@media(max-width:550px){.brand{font-size:22px}.top-right{gap:13px}.top-button{font-size:9px}.intro h1{font-size:48px}.eyebrow{font-size:9px}.arena-head{font-size:8px;height:34px;padding:0 8px}.game-wrap{aspect-ratio:4/5}.overlay.start{padding-left:7%;background:rgba(4,16,20,.8)}.overlay-title{font-size:clamp(55px,17vw,88px)}.overlay-title.small{font-size:61px}.overlay-desc{max-width:270px;line-height:1.4}.overlay-actions{gap:7px}.metric-label{font-size:8px}.metric-value{font-size:21px}.metric{padding:10px 7px}.metric:first-child{padding-left:8px}.life{width:10px;height:10px}.lives{gap:3px;height:21px}.arena-foot span:last-child{display:none}.bottom .micro{display:none}}
`;

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(newGame());
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(true);
  const actions = useRef({ start: () => {}, pause: () => {}, launch: () => {}, next: () => {} });
  const [ui, setUi] = useState(() => ({ phase: 'start' as Phase, level: 1, score: 0, best: 0, lives: 4, remaining: game.current.bricks.length }));
  const [sound, setSound] = useState(true);
  const [help, setHelp] = useState(false);
  const helpOpen = useRef(false);
  helpOpen.current = help;

  const sync = () => { const g = game.current; setUi({ phase: g.phase, level: g.level, score: g.score, best: g.best, lives: g.lives, remaining: g.bricks.length }); };
  const beep = (hz: number, length = .07, type: OscillatorType = 'sine', volume = .035) => {
    if (!soundOn.current) return;
    try {
      if (!audio.current) audio.current = new AudioContext();
      const a = audio.current; if (a.state === 'suspended') void a.resume();
      const o = a.createOscillator(), v = a.createGain(); o.type = type; o.frequency.setValueAtTime(hz, a.currentTime);
      o.frequency.exponentialRampToValueAtTime(Math.max(50, hz * .72), a.currentTime + length);
      v.gain.setValueAtTime(volume, a.currentTime); v.gain.exponentialRampToValueAtTime(.001, a.currentTime + length);
      o.connect(v); v.connect(a.destination); o.start(); o.stop(a.currentTime + length);
    } catch { /* Audio is optional when blocked by the browser. */ }
  };
  const saveBest = () => { const g = game.current; if (g.score > g.best) { g.best = g.score; try { localStorage.setItem('breakline-best', String(g.best)); } catch { /* Storage is optional. */ } } };
  const start = () => { const best = game.current.best; game.current = newGame(best); game.current.phase = 'playing'; game.current.balls[0].stuck = false; beep(520, .13, 'triangle'); sync(); };
  const next = () => { const g = game.current; g.level++; g.phase = 'playing'; g.bricks = bricksFor(g.level); g.balls = [ballFor(g.paddleX, g.level, false)]; g.drops = []; g.particles = []; g.paddleW = 108; g.wideUntil = 0; g.slowUntil = 0; g.combo = 0; g.destroyed = 0; beep(640, .14, 'triangle'); sync(); };
  const launch = () => { const g = game.current; if (g.phase !== 'playing') return; const b = g.balls.find(b => b.stuck); if (b) { b.stuck = false; beep(500, .1, 'triangle'); } };
  const pause = () => { const g = game.current; if (g.phase === 'playing') g.phase = 'paused'; else if (g.phase === 'paused') g.phase = 'playing'; else return; beep(300); sync(); };
  actions.current = { start, pause, launch, next };

  useEffect(() => {
    try { const best = Number(localStorage.getItem('breakline-best')) || 0; game.current.best = best; sync(); } catch { /* Storage is optional. */ }
    const down = (e: KeyboardEvent) => {
      const g = game.current;
      if (helpOpen.current) {
        if (e.code === 'Escape') setHelp(false);
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') g.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') g.right = true;
      if (e.repeat) return;
      if (e.code === 'KeyP' || e.code === 'Escape') actions.current.pause();
      if (e.code === 'Space' || e.code === 'Enter') {
        if (g.phase === 'start' || g.phase === 'lost' || g.phase === 'won') actions.current.start();
        else if (g.phase === 'paused') actions.current.pause();
        else if (g.phase === 'level') actions.current.next();
        else actions.current.launch();
      }
    };
    const up = (e: KeyboardEvent) => { if (e.code === 'ArrowLeft' || e.code === 'KeyA') game.current.left = false; if (e.code === 'ArrowRight' || e.code === 'KeyD') game.current.right = false; };
    const blur = () => { game.current.left = false; game.current.right = false; if (game.current.phase === 'playing') actions.current.pause(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  useEffect(() => {
    const c = canvas.current?.getContext('2d'); if (!c) return;
    let frame = 0, previous = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - (previous || now)) / 1000, .033); previous = now;
      const g = game.current;
      if (g.phase === 'playing') {
        g.time += dt; g.paddleW = g.wideUntil > g.time ? 158 : 108;
        if (g.left) g.paddleX -= 680 * dt; if (g.right) g.paddleX += 680 * dt;
        g.paddleX = clamp(g.paddleX, LEFT + g.paddleW / 2, RIGHT - g.paddleW / 2);
        for (const b of g.balls) {
          if (b.stuck) { b.x = g.paddleX; b.y = PADDLE_Y - 14; continue; }
          b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 6) b.trail.shift();
          const oldX = b.x, oldY = b.y, factor = g.slowUntil > g.time ? .72 : 1;
          b.x += b.vx * dt * factor; b.y += b.vy * dt * factor;
          if (b.x - 7 < LEFT) { b.x = LEFT + 7; b.vx = Math.abs(b.vx); beep(240, .045); }
          if (b.x + 7 > RIGHT) { b.x = RIGHT - 7; b.vx = -Math.abs(b.vx); beep(240, .045); }
          if (b.y - 7 < 68) { b.y = 75; b.vy = Math.abs(b.vy); beep(240, .045); }
          if (b.vy > 0 && oldY + 7 <= PADDLE_Y + 4 && b.y + 7 >= PADDLE_Y && Math.abs(b.x - g.paddleX) < g.paddleW / 2 + 7) {
            b.y = PADDLE_Y - 7;
            const hit = clamp((b.x - g.paddleX) / (g.paddleW / 2), -.95, .95);
            const speed = clamp(Math.hypot(b.vx, b.vy) + 6, 355, 560 + g.level * 35), angle = hit * 1.06;
            b.vx = Math.sin(angle) * speed; b.vy = -Math.cos(angle) * speed;
            if (Math.abs(b.vx) < 60) b.vx = (hit >= 0 ? 1 : -1) * 60;
            g.combo = 0; burst(g, b.x, PADDLE_Y, '#dcfa92', 9); beep(340, .08, 'triangle');
          }
          for (let i = 0; i < g.bricks.length; i++) {
            const block = g.bricks[i], nearX = clamp(b.x, block.x, block.x + 68), nearY = clamp(b.y, block.y, block.y + 23);
            if ((b.x - nearX) ** 2 + (b.y - nearY) ** 2 > 49) continue;
            // The previous position identifies the entry side and prevents sticking inside blocks.
            if (oldY + 7 <= block.y || oldY - 7 >= block.y + 23) b.vy *= -1;
            else if (oldX + 7 <= block.x || oldX - 7 >= block.x + 68) b.vx *= -1;
            else b.vy *= -1;
            b.x = oldX; b.y = oldY; block.hp--; g.shake = 3; g.flash = .12;
            burst(g, b.x, b.y, COLORS[block.row], block.hp === 0 ? 13 : 5);
            if (block.hp <= 0) {
              g.bricks.splice(i, 1); g.destroyed++; g.combo++;
              g.score += 100 * g.level + Math.min(g.combo, 10) * 15;
              if (g.destroyed % 9 === 0) g.drops.push({ x: block.x + 34, y: block.y + 12, kind: g.destroyed % 27 === 0 ? 'life' : g.destroyed % 18 === 0 ? 'slow' : 'wide' });
              saveBest(); sync(); beep(540 + Math.min(g.combo, 12) * 38, .09, 'triangle');
              if (g.bricks.length === 0) { g.phase = g.level === 3 ? 'won' : 'level'; g.flash = 1; saveBest(); sync(); beep(900, .3, 'triangle'); }
            } else beep(410, .06, 'square', .015);
            break;
          }
        }
        g.balls = g.balls.filter(b => b.y - 7 < H + 15);
        if (!g.balls.length && g.phase === 'playing') {
          g.lives--; g.combo = 0; g.shake = 9; g.flash = .6; beep(145, .3, 'sawtooth', .045);
          if (g.lives <= 0) { g.phase = 'lost'; saveBest(); } else g.balls = [ballFor(g.paddleX, g.level)];
          sync();
        }
        for (let i = g.drops.length - 1; i >= 0; i--) {
          const d = g.drops[i]; d.y += 140 * dt;
          if (d.y >= PADDLE_Y - 10 && d.y <= PADDLE_Y + 16 && Math.abs(d.x - g.paddleX) < g.paddleW / 2 + 12) {
            if (d.kind === 'wide') g.wideUntil = g.time + 14;
            if (d.kind === 'slow') g.slowUntil = g.time + 14;
            if (d.kind === 'life') { g.lives = Math.min(6, g.lives + 1); sync(); }
            burst(g, d.x, d.y, '#d8f77c', 20); beep(760, .18); g.drops.splice(i, 1);
          } else if (d.y > H + 20) g.drops.splice(i, 1);
        }
      }
      if (g.phase === 'playing' || g.particles.length) for (let i = g.particles.length - 1; i >= 0; i--) {
        const p = g.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt;
        if (p.life <= 0) g.particles.splice(i, 1);
      }
      g.shake = Math.max(0, g.shake - dt * 24); g.flash = Math.max(0, g.flash - dt * 2.8);
      draw(c, g); frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const move = (e: PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(), g = game.current; g.paddleX = clamp((e.clientX - r.left) / r.width * W, LEFT + g.paddleW / 2, RIGHT - g.paddleW / 2); };
  return <div className="app"><style>{styles}</style><div className="shell">
    <header className="top"><div className="brand"><span className="brand-mark" />BREAK<span>LINE</span></div><div className="top-right"><span className="top-note">AN ARCADE GAME / VOL. 01</span><button className="top-button" onClick={() => { soundOn.current = !soundOn.current; setSound(soundOn.current); }}>SOUND {sound ? 'ON' : 'OFF'}</button><button className="top-button" onClick={() => setHelp(true)}>HOW TO PLAY ↗</button></div></header>
    <div className="intro"><div><div className="eyebrow">THE SIGNAL IS YOURS TO BREAK</div><h1>BREAK<span>LINE.</span></h1></div><p className="intro-copy">One paddle. Three sectors.<br />Nothing gets through.</p></div>
    <main className="arena-frame"><div className="arena-head"><span className="signal"><span className="signal-dot" /> SYSTEM {ui.phase === 'paused' ? 'PAUSED' : ui.phase === 'start' ? 'STANDBY' : 'ONLINE'}</span><span>SECTOR 0{ui.level} / 03 &nbsp;·&nbsp; {NAMES[ui.level - 1]}</span><span>BRK-0{ui.level} // {String(ui.remaining).padStart(2, '0')} LEFT</span></div>
      <div className="game-wrap"><canvas ref={canvas} width={W} height={H} onPointerMove={move} onPointerDown={(e) => { move(e); launch(); }} aria-label="Breakline game field. Move the paddle with mouse, touch, arrows, or A and D." />
        {ui.phase !== 'playing' && <div className={`overlay ${ui.phase}`}>
          {ui.phase === 'start' && <div className="overlay-inner"><p className="overlay-kicker">// READY, PLAYER ONE?</p><h2 className="overlay-title">BREAK<br /><em>THE LINE.</em></h2><p className="overlay-desc">A precision brick-breaker. Keep the signal alive, clear every target, and make it through all three sectors.</p><div className="overlay-actions"><button className="primary" onClick={start}>START GAME &nbsp; ↗</button><button className="secondary" onClick={() => setHelp(true)}>CONTROLS</button></div></div>}
          {ui.phase === 'paused' && <div className="overlay-inner"><p className="overlay-kicker">// SIGNAL INTERRUPTED</p><h2 className="overlay-title small">PAUSED.</h2><p className="overlay-desc">Take a breath. The grid will be right here.</p><div className="overlay-actions"><button className="primary" onClick={pause}>RESUME &nbsp; ↗</button><button className="secondary" onClick={start}>RESTART</button></div></div>}
          {ui.phase === 'level' && <div className="overlay-inner"><p className="overlay-kicker">// SECTOR 0{ui.level} COMPLETE</p><h2 className="overlay-title small">LINE<br /><em>CLEARED.</em></h2><p className="overlay-desc">Nice work. The next sector has tougher targets and a faster signal.</p><div className="overlay-actions"><button className="primary" onClick={next}>NEXT SECTOR &nbsp; ↗</button></div></div>}
          {ui.phase === 'won' && <div className="overlay-inner"><p className="overlay-kicker">// ALL SECTORS CLEARED</p><h2 className="overlay-title small">YOU<br /><em>BROKE IT.</em></h2><div className="overlay-score">FINAL SCORE: {ui.score.toLocaleString()}</div><p className="overlay-desc">Every line down. The grid is yours.</p><div className="overlay-actions"><button className="primary" onClick={start}>PLAY AGAIN &nbsp; ↗</button></div></div>}
          {ui.phase === 'lost' && <div className="overlay-inner"><p className="overlay-kicker">// SIGNAL LOST</p><h2 className="overlay-title small">GAME<br /><em>OVER.</em></h2><div className="overlay-score">SCORE: {ui.score.toLocaleString()}</div><p className="overlay-desc">The line held this time. Give it another shot.</p><div className="overlay-actions"><button className="primary" onClick={start}>TRY AGAIN &nbsp; ↗</button></div></div>}
        </div>}
      </div>
      <div className="hud"><div className="metric"><div className="metric-label">01 / SCORE</div><div className="metric-value accent">{ui.score.toLocaleString().padStart(6, '0')}</div></div><div className="metric"><div className="metric-label">02 / BEST</div><div className="metric-value">{ui.best.toLocaleString().padStart(6, '0')}</div></div><div className="metric"><div className="metric-label">03 / SECTOR</div><div className="metric-value">0{ui.level} <span style={{ color: '#658479', fontSize: 18 }}>/ 03</span></div></div><div className="metric"><div className="metric-label">04 / LIVES</div><div className="lives">{Array.from({ length: Math.max(4, ui.lives) }, (_, i) => <span key={i} className={`life ${i >= ui.lives ? 'empty' : ''}`} />)}</div></div><div className="hud-actions"><button className="icon-button" title={ui.phase === 'paused' ? 'Resume (P)' : 'Pause (P)'} aria-label={ui.phase === 'paused' ? 'Resume' : 'Pause'} onClick={pause} disabled={ui.phase !== 'playing' && ui.phase !== 'paused'}>{ui.phase === 'paused' ? '▶' : 'Ⅱ'}</button><button className="icon-button" title="Restart game" aria-label="Restart game" onClick={start}>↺</button></div></div>
    </main><div className="arena-foot"><span><strong>MOVE</strong> &nbsp; ← → / A D / MOUSE / TOUCH &nbsp;&nbsp;&nbsp; <strong>LAUNCH</strong> &nbsp; SPACE / CLICK</span><span><strong>PAUSE</strong> &nbsp; P / ESC</span></div><footer className="bottom"><p>Built for the love of one more try.</p><span className="micro">BREAKLINE © 2026 &nbsp; / &nbsp; INSERT COURAGE</span></footer>
  </div>
    {help && <div className="help-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setHelp(false); }}><div className="help" role="dialog" aria-modal="true" aria-label="How to play"><button className="help-close" aria-label="Close instructions" onClick={() => setHelp(false)}>×</button><div className="overlay-kicker">// FIELD MANUAL</div><h2>HOW TO PLAY.</h2><p>Keep the ball in play with your paddle. Break every block to reach the next sector. Clear all three sectors to win. Lose all your lives and the run ends.</p><div className="help-line"><span>MOVE PADDLE</span><span>← → / A D / MOUSE / TOUCH</span></div><div className="help-line"><span>LAUNCH BALL</span><span>SPACE / CLICK / TAP</span></div><div className="help-line"><span>PAUSE GAME</span><span>P / ESC</span></div><p>Catch falling diamonds: <b style={{ color: '#d8f77c' }}>W</b> widens the paddle, <b style={{ color: '#82d4ef' }}>S</b> slows the ball, and <b style={{ color: '#ff9e87' }}>+</b> restores a life. Chain brick hits before returning to the paddle for bonus points.</p><button className="primary" onClick={() => setHelp(false)}>GOT IT &nbsp; ↗</button></div></div>}
  </div>;
}
