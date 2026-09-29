import { useEffect, useRef, useState } from 'react';

// Single-file arcade game: rules, renderer, interface, and styling live together.
const W = 960, H = 600, PY = 548, TOTAL = 4;
const colors = ['#74e4dc', '#f7c96e', '#ff8c94', '#a99af7'];
type Mode = 'start' | 'playing' | 'paused' | 'between' | 'won' | 'lost';
type Brick = { x: number; y: number; w: number; h: number; hp: number; max: number; color: string; special: boolean; alive: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string };
type Drop = { x: number; y: number; kind: 'wide' | 'slow' | 'life' };
type Game = {
  mode: Mode; level: number; score: number; best: number; lives: number; time: number; combo: number;
  px: number; pw: number; pointer: number | null; left: boolean; right: boolean; wide: number;
  ball: { x: number; y: number; vx: number; vy: number; docked: boolean; trail: { x: number; y: number }[] };
  bricks: Brick[]; particles: Particle[]; drops: Drop[]; shake: number; flash: number; clock: number;
};

function bricksFor(level: number): Brick[] {
  const result: Brick[] = [], gap = 9, width = (796 - 9 * gap) / 10;
  for (let row = 0; row < level + 3; row++) for (let col = 0; col < 10; col++) {
    if (level === 2 && row === 1 && (col === 2 || col === 7)) continue;
    if (level === 3 && row > 1 && (col + row) % 7 === 0) continue;
    if (level === 4 && row > 0 && (col + row * 2) % 9 === 0) continue;
    const hp = level > 1 && (col * 3 + row * 2 + level) % (level === 4 ? 4 : 6) === 0 ? 2 : 1;
    result.push({ x: 82 + col * (width + gap), y: 94 + row * 33, w: width, h: 23,
      hp, max: hp, color: colors[(row + level - 1) % 4], special: (col + row * 4 + level) % 13 === 0, alive: true });
  }
  return result;
}
const ballAt = (x: number) => ({ x, y: PY - 18, vx: 0, vy: 0, docked: true, trail: [] as { x: number; y: number }[] });
function newGame(best = 0): Game {
  return { mode: 'start', level: 1, score: 0, best, lives: 3, time: 0, combo: 0,
    px: W / 2, pw: 112, pointer: null, left: false, right: false, wide: 0, ball: ballAt(W / 2),
    bricks: bricksFor(1), particles: [], drops: [], shake: 0, flash: 0, clock: 0 };
}
function burst(g: Game, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 45 + Math.random() * 170, life = .3 + Math.random() * .5;
    g.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, color });
  }
}
function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}
function paint(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.clearRect(0, 0, W, H); ctx.save();
  if (g.shake) ctx.translate((Math.random() - .5) * g.shake * 7, (Math.random() - .5) * g.shake * 7);
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#101d2d'); bg.addColorStop(.6, '#0d1726'); bg.addColorStop(1, '#111424');
  ctx.fillStyle = bg; ctx.fillRect(-10, -10, W + 20, H + 20);
  const glow = ctx.createRadialGradient(W / 2, 180, 30, W / 2, 260, 520);
  glow.addColorStop(0, 'rgba(48,100,111,.17)'); glow.addColorStop(1, 'rgba(12,20,35,0)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(166,205,214,.055)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y + .5); ctx.lineTo(W, y + .5); ctx.stroke(); }
  for (let i = 0; i < 58; i++) {
    ctx.fillStyle = `rgba(170,220,226,${.12 + .12 * Math.sin(g.clock * 1.8 + i * .87)})`;
    ctx.fillRect((i * 197.47 + 43) % W, (i * 131.93 + 37) % H, i % 7 === 0 ? 1.5 : .8, 1);
  }
  ctx.font = '600 11px monospace'; ctx.fillStyle = 'rgba(181,215,220,.36)';
  ctx.fillText(`SECTOR 0${g.level} / 0${TOTAL}`, 35, 42);
  ctx.textAlign = 'right'; ctx.fillText('NOVA // FIELD 01', W - 35, 42); ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(155,211,216,.16)'; ctx.fillRect(34, 57, W - 68, 1); ctx.fillRect(34, H - 36, W - 68, 1);
  for (const b of g.bricks) {
    if (!b.alive) continue;
    ctx.globalAlpha = b.hp < b.max ? .58 : 1; ctx.shadowColor = b.color; ctx.shadowBlur = 12;
    ctx.fillStyle = b.color; rect(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.25)'; rect(ctx, b.x + 3, b.y + 3, b.w - 6, 3, 1.5); ctx.fill();
    if (b.hp === 2) { ctx.fillStyle = 'rgba(14,25,38,.32)'; ctx.fillRect(b.x + b.w / 2 - 8, b.y + 11, 16, 2); }
    if (b.special) { ctx.fillStyle = 'rgba(15,29,42,.75)'; ctx.beginPath(); ctx.arc(b.x + b.w - 11, b.y + 12, 2.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  for (const d of g.drops) {
    const color = d.kind === 'wide' ? colors[0] : d.kind === 'slow' ? colors[3] : colors[2];
    ctx.shadowColor = color; ctx.shadowBlur = 19; ctx.fillStyle = color; rect(ctx, d.x - 14, d.y - 14, 28, 28, 7); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#142033'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
    ctx.fillText(d.kind === 'wide' ? 'W' : d.kind === 'slow' ? 'S' : '+', d.x, d.y + 5); ctx.textAlign = 'left';
  }
  for (const p of g.particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1; ctx.shadowColor = '#74e4dc'; ctx.shadowBlur = 22;
  const paddle = ctx.createLinearGradient(g.px - g.pw / 2, 0, g.px + g.pw / 2, 0);
  paddle.addColorStop(0, '#4abcb9'); paddle.addColorStop(.5, '#bdfff0'); paddle.addColorStop(1, '#4abcb9');
  ctx.fillStyle = paddle; rect(ctx, g.px - g.pw / 2, PY, g.pw, 12, 6); ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(116,228,220,.24)'; rect(ctx, g.px - g.pw / 2 + 9, PY + 18, g.pw - 18, 2, 1); ctx.fill();
  g.ball.trail.forEach((t, i) => { ctx.globalAlpha = (i + 1) / g.ball.trail.length * .32; ctx.fillStyle = '#e8fff9'; ctx.beginPath(); ctx.arc(t.x, t.y, 7 * (i + 1) / g.ball.trail.length, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1; ctx.shadowColor = '#baffee'; ctx.shadowBlur = 26;
  ctx.fillStyle = '#f7fff1'; ctx.beginPath(); ctx.arc(g.ball.x, g.ball.y, 7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  if (g.flash) { ctx.fillStyle = `rgba(238,255,246,${g.flash * .15})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}
const formatTime = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null), game = useRef<Game>(newGame());
  const [mode, setMode] = useState<Mode>('start');
  const [hud, setHud] = useState({ score: 0, best: 0, lives: 3, level: 1, time: 0, combo: 0, remaining: 40, wide: 0, docked: true });
  const [muted, setMuted] = useState(false), muteRef = useRef(false), audio = useRef<AudioContext | null>(null);
  const actions = useRef({ primary: () => {}, pause: () => {}, restart: () => {} });
  const sync = () => { const g = game.current; setHud({ score: g.score, best: g.best, lives: g.lives, level: g.level, time: g.time, combo: g.combo, remaining: g.bricks.filter(b => b.alive).length, wide: g.wide, docked: g.ball.docked }); };
  const changeMode = (next: Mode) => { game.current.mode = next; setMode(next); sync(); };
  function beep(freq: number, duration = .08, shape: OscillatorType = 'sine', volume = .035) {
    if (muteRef.current) return;
    try {
      if (!audio.current) audio.current = new AudioContext();
      const a = audio.current; if (a.state === 'suspended') void a.resume();
      const osc = a.createOscillator(), gain = a.createGain(); osc.type = shape;
      osc.frequency.setValueAtTime(freq, a.currentTime); osc.frequency.exponentialRampToValueAtTime(Math.max(50, freq * .65), a.currentTime + duration);
      gain.gain.setValueAtTime(volume, a.currentTime); gain.gain.exponentialRampToValueAtTime(.001, a.currentTime + duration);
      osc.connect(gain); gain.connect(a.destination); osc.start(); osc.stop(a.currentTime + duration);
    } catch { /* Sound is optional when browser audio is unavailable. */ }
  }
  function launch() {
    const g = game.current; if (g.mode !== 'playing' || !g.ball.docked) return;
    g.ball.docked = false; g.ball.vx = (Math.random() < .5 ? -1 : 1) * (105 + g.level * 14);
    g.ball.vy = -(345 + g.level * 24); beep(580, .13); sync();
  }
  function restart() { game.current = newGame(game.current.best); game.current.mode = 'playing'; setMode('playing'); sync(); beep(480, .15); }
  function primary() {
    const g = game.current;
    if (g.mode === 'start' || g.mode === 'lost' || g.mode === 'won') restart();
    else if (g.mode === 'paused') changeMode('playing');
    else if (g.mode === 'between') {
      g.level++; g.bricks = bricksFor(g.level); g.drops = []; g.particles = []; g.pw = 112; g.wide = 0; g.combo = 0; g.ball = ballAt(g.px);
      changeMode('playing'); beep(660, .2);
    } else launch();
  }
  function pause() { if (game.current.mode === 'playing') changeMode('paused'); else if (game.current.mode === 'paused') changeMode('playing'); }
  actions.current = { primary, pause, restart };

  useEffect(() => {
    try { const best = Number(localStorage.getItem('nova-break-best') || 0); if (Number.isFinite(best)) { game.current.best = best; sync(); } } catch { /* Storage is optional. */ }
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(); if (['arrowleft', 'arrowright', ' ', 'arrowup'].includes(k)) e.preventDefault();
      if (k === 'arrowleft' || k === 'a') { game.current.left = true; game.current.pointer = null; }
      if (k === 'arrowright' || k === 'd') { game.current.right = true; game.current.pointer = null; }
      if (e.repeat) return;
      if (k === ' ' || k === 'enter') actions.current.primary();
      if (k === 'p' || k === 'escape') actions.current.pause();
      if (k === 'r') actions.current.restart();
    };
    const up = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (k === 'arrowleft' || k === 'a') game.current.left = false; if (k === 'arrowright' || k === 'd') game.current.right = false; };
    const blur = () => { game.current.left = false; game.current.right = false; if (game.current.mode === 'playing') actions.current.pause(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d'); if (!ctx) return;
    let frame = 0, previous = 0, hudClock = 0;
    const tick = (now: number) => {
      const dt = Math.min((now - (previous || now)) / 1000, .033); previous = now;
      const g = game.current; g.clock += dt; g.shake = Math.max(0, g.shake - dt * 3.5); g.flash = Math.max(0, g.flash - dt * 3);
      g.particles = g.particles.filter(p => p.life > 0);
      for (const p of g.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 90 * dt; p.life -= dt; }
      if (g.mode === 'playing') {
        g.time += dt;
        if (g.left !== g.right) g.px += (g.left ? -1 : 1) * 750 * dt;
        else if (g.pointer !== null) g.px += (g.pointer - g.px) * Math.min(1, dt * 21);
        g.px = Math.max(35 + g.pw / 2, Math.min(W - 35 - g.pw / 2, g.px));
        if (g.wide > 0) { g.wide -= dt; if (g.wide <= 0) { g.wide = 0; g.pw = 112; } }
        if (g.ball.docked) { g.ball.x = g.px; g.ball.y = PY - 18; }
        else {
          const b = g.ball, oldX = b.x, oldY = b.y;
          b.x += b.vx * dt; b.y += b.vy * dt; b.trail.push({ x: oldX, y: oldY }); if (b.trail.length > 7) b.trail.shift();
          if (b.x < 41) { b.x = 41; b.vx = Math.abs(b.vx); beep(230, .045, 'triangle', .012); }
          if (b.x > W - 41) { b.x = W - 41; b.vx = -Math.abs(b.vx); beep(230, .045, 'triangle', .012); }
          if (b.y < 75) { b.y = 75; b.vy = Math.abs(b.vy); beep(230, .045, 'triangle', .012); }
          if (b.vy > 0 && oldY + 7 <= PY + 9 && b.y + 7 >= PY && b.x >= g.px - g.pw / 2 - 7 && b.x <= g.px + g.pw / 2 + 7) {
            b.y = PY - 7;
            const offset = Math.max(-1, Math.min(1, (b.x - g.px) / (g.pw / 2)));
            const speed = Math.min(660, Math.hypot(b.vx, b.vy) + 8);
            b.vx = speed * Math.sin(offset * 1.05); b.vy = -Math.sqrt(speed * speed - b.vx * b.vx);
            if (Math.abs(b.vx) < 65) b.vx = b.vx < 0 ? -65 : 65;
            g.combo = 0; burst(g, b.x, PY, colors[0], 5); beep(360, .085, 'triangle', .028);
          }
          for (const brick of g.bricks) {
            if (!brick.alive || b.x + 7 < brick.x || b.x - 7 > brick.x + brick.w || b.y + 7 < brick.y || b.y - 7 > brick.y + brick.h) continue;
            if (oldX + 7 <= brick.x || oldX - 7 >= brick.x + brick.w) b.vx *= -1; else b.vy *= -1;
            brick.hp--; burst(g, b.x, b.y, brick.color, brick.hp ? 5 : 11);
            g.shake = brick.hp ? .35 : .8; g.flash = brick.hp ? .15 : .35; beep(brick.hp ? 280 : 500 + g.combo * 24, .09, 'triangle', .025);
            if (!brick.hp) {
              brick.alive = false; g.combo++; g.score += 100 * g.level + Math.min(g.combo, 15) * 15;
              if (g.score > g.best) { g.best = g.score; try { localStorage.setItem('nova-break-best', String(g.best)); } catch { /* Optional persistence. */ } }
              if (brick.special) { const kinds: Drop['kind'][] = ['wide', 'slow', 'life']; g.drops.push({ x: brick.x + brick.w / 2, y: brick.y + 12, kind: kinds[(g.level + g.combo) % 3] }); }
              if (g.bricks.every(item => !item.alive)) { burst(g, b.x, b.y, colors[1], 35); changeMode(g.level === TOTAL ? 'won' : 'between'); beep(750, .28, 'sine', .055); }
            }
            break;
          }
          if (g.mode === 'playing' && b.y > H + 7) {
            g.lives--; g.combo = 0; g.shake = 1.3; g.flash = .8;
            burst(g, Math.max(40, Math.min(W - 40, b.x)), H - 25, colors[2], 22); beep(160, .35, 'sawtooth', .035);
            if (g.lives <= 0) changeMode('lost'); else { g.ball = ballAt(g.px); sync(); }
          }
        }
        g.drops = g.drops.filter(d => {
          d.y += 155 * dt;
          if (d.y + 14 >= PY && d.y - 14 <= PY + 13 && Math.abs(d.x - g.px) < g.pw / 2 + 12) {
            if (d.kind === 'wide') { g.pw = 174; g.wide = 13; }
            if (d.kind === 'slow' && !g.ball.docked) { g.ball.vx *= .78; g.ball.vy *= .78; }
            if (d.kind === 'life') g.lives = Math.min(5, g.lives + 1);
            burst(g, d.x, d.y, '#fff2bd', 16); beep(900, .2); return false;
          }
          return d.y < H + 20;
        });
        hudClock += dt; if (hudClock > .12) { sync(); hudClock = 0; }
      }
      paint(ctx, g); frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, []);

  const movePointer = (e: React.PointerEvent<HTMLCanvasElement>) => { const bounds = e.currentTarget.getBoundingClientRect(); game.current.pointer = (e.clientX - bounds.left) / bounds.width * W; };
  const copy = {
    start: { tag: 'AN ARCADE ODYSSEY', title: <>Light up<br /><em>the void.</em></>, text: 'Break the wall. Catch the light. Make it through all four sectors.', button: 'Begin mission' },
    paused: { tag: 'TAKE A BREATH', title: <>Game<br /><em>paused.</em></>, text: 'The universe can wait. Your run is right where you left it.', button: 'Resume game' },
    between: { tag: `SECTOR 0${hud.level} CLEARED`, title: <>Keep the<br /><em>light alive.</em></>, text: `${TOTAL - hud.level} sector${TOTAL - hud.level === 1 ? '' : 's'} remain. The wall gets tougher from here.`, button: 'Next sector' },
    won: { tag: 'MISSION COMPLETE', title: <>You broke<br /><em>through.</em></>, text: `All four sectors cleared. Final score: ${hud.score.toLocaleString()}. The stars are yours.`, button: 'Play again' },
    lost: { tag: 'SIGNAL LOST', title: <>The light<br /><em>fades.</em></>, text: `You reached sector 0${hud.level} and scored ${hud.score.toLocaleString()}. Give it another shot.`, button: 'Try again' },
    playing: { tag: '', title: <></>, text: '', button: '' },
  }[mode];

  return <div className="app-shell"><style>{styles}</style><div className="page-glow" />
    <header className="topbar"><div className="brand"><span className="brand-mark"><span /></span>NOVA<span>BREAK</span></div>
      <div className="top-right"><span className="edition">THE ARCADE SERIES <b>/</b> NO. 001</span><button className="icon-button" onClick={() => { muteRef.current = !muteRef.current; setMuted(muteRef.current); }} aria-label={muted ? 'Enable sound' : 'Mute sound'}>{muted ? '◌' : '♫'}</button></div></header>
    <main className="layout"><aside className="sidebar"><div className="intro"><div className="eyebrow"><span>✦</span> YOUR MISSION STARTS HERE</div><h1>NOVA<br /><span>BREAK<span className="period">.</span></span></h1><p>A little light goes a long way. Smash through the cosmos, one brick at a time.</p></div>
      <div className="instructions"><div className="rule" /><div className="section-label">HOW TO PLAY</div>
        <div className="control"><span>Move paddle</span><span className="keys"><kbd>←</kbd><kbd>→</kbd><i>or</i><kbd>A</kbd><kbd>D</kbd></span></div>
        <div className="control"><span>Launch ball</span><span className="keys"><kbd className="space">SPACE</kbd></span></div>
        <div className="control"><span>Pause game</span><span className="keys"><kbd>P</kbd></span></div>
        <p className="mouse-note">Mouse and touch work too. Move to steer, tap to launch.</p><div className="rule lower" />
        <div className="power-label">CATCH THE FALLING LIGHTS</div><div className="powerups"><span><b className="aqua">W</b> Wider paddle</span><span><b className="purple">S</b> Slow ball</span><span><b className="coral">+</b> Extra life</span></div>
      </div></aside>
      <section className="game-column" aria-label="Nova Break game"><div className="hud">
        <div className="hud-item"><small>SCORE</small><strong className="score">{String(hud.score).padStart(6, '0')}</strong></div>
        <div className="hud-item best"><small>BEST</small><strong>{String(hud.best).padStart(6, '0')}</strong></div>
        <div className="hud-item sector"><small>SECTOR</small><strong>0{hud.level}<span> / 0{TOTAL}</span></strong></div>
        <div className="hud-item lives"><small>LIVES</small><strong aria-label={`${hud.lives} lives remaining`}>{Array.from({ length: 5 }, (_, i) => <span className={i < hud.lives ? 'life on' : 'life'} key={i}>◆</span>)}</strong></div>
        <button className="icon-button pause" onClick={pause} disabled={mode !== 'playing' && mode !== 'paused'} aria-label={mode === 'paused' ? 'Resume game' : 'Pause game'}>{mode === 'paused' ? '▶' : 'Ⅱ'}</button>
      </div>
      <div className="stage"><canvas ref={canvas} width={W} height={H} onPointerMove={movePointer} onPointerDown={e => { movePointer(e); launch(); }} aria-label="Move the paddle to keep the ball in play and break all bricks" />
        {mode !== 'playing' && <div className="overlay"><div className="overlay-inner" key={mode}><div className="overlay-tag"><span />{copy.tag}</div><h2>{copy.title}</h2><p>{copy.text}</p><button className="main-button" onClick={primary}>{copy.button}<span>→</span></button>{mode === 'paused' && <button className="restart-link" onClick={restart}>↻ &nbsp; Start over</button>}</div><div className="overlay-corner">EST. IN THE STARS <span>✳</span> 2026</div></div>}
        {mode === 'playing' && hud.docked && <div className="launch-hint">PRESS SPACE OR TAP TO LAUNCH <span>↑</span></div>}
      </div>
      <div className="status"><div><span className="led" />{mode === 'playing' ? hud.docked ? 'AWAITING LAUNCH' : 'SIGNAL ACTIVE' : mode === 'paused' ? 'SIGNAL PAUSED' : mode === 'between' ? 'SECTOR COMPLETE' : mode === 'won' ? 'MISSION COMPLETE' : mode === 'lost' ? 'SIGNAL LOST' : 'STANDING BY'}</div><div className="status-middle">{hud.wide > 0 ? `WIDE PADDLE  ${Math.ceil(hud.wide)}S` : mode === 'playing' && hud.combo > 1 ? `COMBO X${hud.combo}` : `BRICKS LEFT  ${String(hud.remaining).padStart(2, '0')}`}</div><div>TIME <span>{formatTime(hud.time)}</span></div></div>
      <div className="mobile-help">DRAG TO MOVE <b>·</b> TAP TO LAUNCH {mode === 'playing' && <button onClick={pause}>PAUSE</button>}</div>
      </section></main><footer><span>BUILT FOR THE JOY OF ONE MORE TRY.</span><span>© NOVA BREAK / ARCADE 001</span></footer>
  </div>;
}

const styles = `
* { box-sizing: border-box; } html { background: #080e18; } body { margin: 0; } button { font: inherit; }
.app-shell { min-height: 100vh; color: #e7efe9; background: #080e18; font-family: Arial, 'Helvetica Neue', sans-serif; position: relative; overflow: hidden; padding: 0 52px; }
.page-glow { position: absolute; width: 820px; height: 820px; right: -290px; top: -360px; background: radial-gradient(circle, rgba(37,93,103,.17), transparent 68%); pointer-events: none; }
.topbar { height: 88px; border-bottom: 1px solid rgba(164,207,210,.13); display: flex; align-items: center; justify-content: space-between; position: relative; max-width: 1560px; margin: 0 auto; }
.brand { display: flex; align-items: center; gap: 0; font-weight: 900; letter-spacing: -.05em; font-size: 20px; line-height: 1; }.brand > span:last-child { color: #75d9d2; margin-left: 3px; }
.brand-mark { width: 29px; height: 29px; border: 3px solid #79ded5; transform: rotate(45deg); display: grid; place-items: center; margin-right: 18px; box-shadow: 0 0 16px rgba(116,228,220,.18); }.brand-mark span { width: 9px; height: 9px; background: #79ded5; display: block; }
.top-right { display: flex; align-items: center; gap: 30px; }.edition { color: #7e929e; font: 600 10px monospace; letter-spacing: .19em; }.edition b { color: #4b6772; padding: 0 7px; }
.icon-button { border: 1px solid rgba(153,199,204,.22); background: rgba(255,255,255,.025); color: #b9d6d6; width: 38px; height: 38px; display: grid; place-items: center; cursor: pointer; transition: color .2s, background .2s, border-color .2s; font-size: 19px; }.icon-button:hover:not(:disabled) { color: #79e5d9; background: rgba(116,228,220,.1); border-color: #75d9d2; }.icon-button:disabled { opacity: .35; cursor: default; }
.layout { max-width: 1560px; margin: 0 auto; display: grid; grid-template-columns: minmax(255px, 315px) minmax(0, 1fr); gap: clamp(35px, 5vw, 88px); padding: 45px 0 32px; position: relative; }
.sidebar { display: flex; flex-direction: column; justify-content: space-between; padding-top: 22px; padding-bottom: 17px; }.eyebrow,.section-label,.power-label { color: #77dcd2; font: 700 10px/1.5 monospace; letter-spacing: .19em; }.eyebrow span { font-size: 16px; vertical-align: -2px; margin-right: 7px; }
h1 { font-size: clamp(62px, 6.1vw, 96px); line-height: .88; letter-spacing: -.09em; margin: 31px 0 25px -5px; font-weight: 900; } h1 > span { color: #78e2d8; }.period { color: #f9cb73; }.intro p { color: #9aadb6; font-size: 16px; line-height: 1.65; max-width: 275px; margin: 0; }
.instructions { margin-top: 80px; }.rule { height: 1px; background: rgba(163,203,207,.18); width: 100%; margin-bottom: 25px; }.section-label { color: #e3ebe7; margin-bottom: 20px; }.control { display: flex; justify-content: space-between; align-items: center; color: #9bacb6; font-size: 13px; margin-bottom: 13px; gap: 8px; }.keys { display: flex; align-items: center; gap: 4px; white-space: nowrap; } kbd { display: inline-flex; height: 25px; min-width: 25px; align-items: center; justify-content: center; border: 1px solid #33454f; border-bottom-color: #546c75; color: #d8e6e4; background: #17232e; border-radius: 4px; font: 11px monospace; }.keys i { color: #60737d; font: normal 10px monospace; margin: 0 5px; }.space { padding: 0 9px; font-size: 9px; letter-spacing: .06em; }.mouse-note { color: #657e89; font-size: 12px; line-height: 1.5; margin: 16px 0 0; }.lower { margin-top: 27px; margin-bottom: 22px; }.power-label { color: #8199a1; font-size: 9px; margin-bottom: 17px; }.powerups { display: flex; flex-direction: column; gap: 11px; color: #a9bac0; font-size: 12px; }.powerups > span { display: flex; align-items: center; gap: 10px; }.powerups b { width: 20px; height: 20px; display: inline-grid; place-items: center; border-radius: 5px; color: #101c28; font: bold 12px monospace; }.aqua { background: #74e4dc; }.purple { background: #a99af7; }.coral { background: #ff8c94; }
.game-column { min-width: 0; }.hud { height: 58px; display: flex; align-items: flex-start; gap: clamp(22px, 3vw, 54px); }.hud-item { display: flex; flex-direction: column; gap: 6px; white-space: nowrap; }.hud-item small { color: #778e98; font: 700 9px monospace; letter-spacing: .19em; }.hud-item strong { color: #eaf4ed; font: 600 20px monospace; letter-spacing: .015em; }.hud-item .score { color: #82eadd; }.sector strong span { color: #738a92; font-size: 14px; }.lives strong { display: flex; gap: 5px; padding-top: 2px; }.life { font-size: 16px; color: #33434d; line-height: 1; }.life.on { color: #ff989c; text-shadow: 0 0 13px rgba(255,140,148,.35); }.pause { margin-left: auto; margin-top: -4px; flex: none; font: 17px Arial; }
.stage { width: 100%; aspect-ratio: 8 / 5; position: relative; background: #101b29; border: 1px solid rgba(145,205,210,.3); box-shadow: 0 22px 80px rgba(0,0,0,.28), 0 0 45px rgba(70,175,170,.06); overflow: hidden; }.stage canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: crosshair; }
.overlay { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(7,16,27,.94) 0%, rgba(9,20,31,.86) 41%, rgba(10,19,30,.38) 78%, rgba(10,19,30,.2) 100%); display: flex; align-items: center; pointer-events: none; }.overlay-inner { width: min(70%, 560px); padding-left: 8.5%; pointer-events: auto; animation: appear .55s cubic-bezier(.2,.7,.2,1) both; }.overlay-tag { color: #80dfd6; font: 700 clamp(8px,.76vw,11px) monospace; letter-spacing: .23em; display: flex; align-items: center; gap: 12px; }.overlay-tag span { display: block; width: 22px; height: 1px; background: #80dfd6; }.overlay h2 { color: #f1f6ef; font-size: clamp(36px,5.3vw,78px); line-height: .98; letter-spacing: -.075em; margin: 22px 0 18px; font-weight: 800; }.overlay h2 em { color: #87e2d7; font-style: normal; }.overlay p { color: #adbec4; font-size: clamp(12px,1vw,15px); line-height: 1.6; max-width: 330px; margin: 0 0 28px; }.main-button { background: #b8f4df; color: #0c2630; border: 0; min-height: 51px; padding: 0 19px 0 23px; display: inline-flex; align-items: center; justify-content: space-between; gap: 32px; font-size: 13px; font-weight: 800; cursor: pointer; transition: transform .2s, background .2s, box-shadow .2s; }.main-button span { font-size: 21px; font-weight: 400; }.main-button:hover { transform: translateY(-3px); background: #dcffed; box-shadow: 0 10px 30px rgba(103,233,205,.18); }.main-button:active { transform: translateY(0); }.restart-link { display: block; border: 0; background: transparent; color: #b4c8c7; cursor: pointer; padding: 16px 0 0; font-size: 12px; }.restart-link:hover { color: white; }.overlay-corner { position: absolute; right: 31px; bottom: 28px; color: rgba(185,220,220,.45); font: 9px monospace; letter-spacing: .15em; }.overlay-corner span { color: #84d9d0; margin: 0 8px; }.launch-hint { position: absolute; left: 50%; bottom: 15%; transform: translateX(-50%); white-space: nowrap; color: #b9e8dd; font: 700 clamp(10px,1vw,13px) monospace; letter-spacing: .14em; text-shadow: 0 2px 12px #07121c; pointer-events: none; animation: pulse 1.8s ease-in-out infinite; }.launch-hint span { font-size: 20px; vertical-align: -2px; margin-left: 8px; }
.status { display: flex; align-items: center; justify-content: space-between; gap: 10px; height: 50px; color: #8198a1; font: 700 10px monospace; letter-spacing: .12em; border-bottom: 1px solid rgba(164,207,210,.13); }.status > div:first-child { display: flex; align-items: center; gap: 9px; }.led { width: 6px; height: 6px; background: #79e3d5; border-radius: 50%; box-shadow: 0 0 10px #79e3d5; }.status-middle { color: #a6babe; }.status > div:last-child span { color: #d3e3df; margin-left: 8px; }.mobile-help { display: none; } footer { max-width: 1560px; margin: 0 auto; display: flex; justify-content: space-between; color: #526a73; font: 700 9px monospace; letter-spacing: .17em; padding: 13px 0 25px; position: relative; }
@keyframes appear { from { opacity: 0; transform: translateY(17px); } to { opacity: 1; transform: translateY(0); } } @keyframes pulse { 50% { opacity: .42; } }
@media (max-width: 1180px) { .app-shell { padding: 0 30px; }.layout { grid-template-columns: 240px minmax(0,1fr); gap: 35px; } h1 { font-size: 68px; }.hud { gap: 22px; }.hud-item strong { font-size: 16px; }.life { font-size: 13px; }.overlay h2 { font-size: clamp(38px,5vw,60px); } }
@media (max-width: 850px) { .topbar { height: 70px; }.layout { display: flex; flex-direction: column; gap: 28px; padding-top: 30px; }.sidebar { display: block; padding: 0; }.intro { display: grid; grid-template-columns: 1fr auto; align-items: end; }.eyebrow { grid-column: 1 / -1; } h1 { margin: 16px 0 0 -3px; font-size: 62px; }.intro p { margin: 0 0 4px 20px; max-width: 240px; font-size: 13px; }.instructions { display: none; }.game-column { width: 100%; }.overlay h2 { font-size: clamp(43px,7vw,68px); } footer { padding-bottom: 20px; } }
@media (max-width: 560px) { .app-shell { padding: 0 16px; }.topbar { height: 62px; }.brand { font-size: 17px; }.brand-mark { width: 23px; height: 23px; border-width: 2px; }.brand-mark span { width: 7px; height: 7px; }.edition { display: none; }.layout { padding-top: 25px; gap: 25px; }.intro { display: block; } h1 { font-size: clamp(54px,16vw,75px); margin: 14px 0 12px -3px; }.intro p { margin: 0; max-width: 350px; font-size: 13px; line-height: 1.45; }.hud { height: 51px; gap: 15px; }.hud-item small { font-size: 8px; }.hud-item { gap: 5px; }.hud-item strong { font-size: 13px; }.best,.sector { display: none; }.lives { margin-left: auto; }.pause { width: 30px; height: 30px; margin: -2px 0 0; }.stage { aspect-ratio: 8 / 5; }.overlay { background: linear-gradient(90deg,rgba(7,16,27,.96),rgba(7,16,27,.72)); }.overlay-inner { padding-left: 8%; width: 95%; }.overlay h2 { font-size: clamp(27px,8vw,44px); margin: 9px 0 7px; }.overlay p { font-size: 9px; line-height: 1.3; max-width: 220px; margin-bottom: 9px; }.overlay-tag { font-size: 7px; }.overlay-corner { display: none; }.main-button { min-height: 32px; font-size: 10px; padding: 0 10px; }.status { height: 43px; font-size: 8px; }.status-middle { display: none; }.mobile-help { display: flex; justify-content: space-between; align-items: center; color: #78949b; font: 700 9px monospace; letter-spacing: .09em; padding: 14px 0; }.mobile-help b { color: #74e4dc; padding: 0 5px; }.mobile-help button { border: 0; background: transparent; color: #a6c6c6; font: inherit; cursor: pointer; } footer { font-size: 8px; padding-top: 4px; } footer span:first-child { display: none; }.launch-hint { font-size: 8px; bottom: 16%; } }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
`;