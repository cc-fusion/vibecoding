import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import './index.css';

const W = 960, H = 540, TOTAL = 5, TARGET = 4;
type Mode = 'menu' | 'playing' | 'paused' | 'won' | 'lost';
type Point = { x: number; y: number };
type Particle = Point & { vx: number; vy: number; life: number; max: number; size: number; color: string };
type Enemy = Point & { id: number; speed: number; phase: number; dead?: boolean };
type Player = Point & { health: number; invuln: number; dash: number; cooldown: number; dirX: number; dirY: number };
type Game = { player: Player; enemies: Enemy[]; particles: Particle[]; core: Point | null; sector: number; collected: number; score: number; time: number; spawn: number; transition: number; shake: number; nextId: number };
type Hud = { sector: number; collected: number; score: number; health: number; time: number; cooldown: number };
type EventName = 'pickup' | 'dash' | 'hit' | 'kill' | 'sector' | 'win' | 'lose';
const initialHud: Hud = { sector: 1, collected: 0, score: 0, health: 3, time: 0, cooldown: 0 };
const stars = Array.from({ length: 85 }, (_, i) => ({ x: (i * 173.71 + 59) % W, y: (i * 239.43 + 81) % H, r: i % 7 ? .65 : 1.2, a: .15 + (i % 5) * .055 }));

function distance(a: Point, b: Point) { return Math.hypot(a.x - b.x, a.y - b.y); }

function newCore(game: Game): Point {
  for (let i = 0; i < 80; i++) {
    const p = { x: 72 + Math.random() * (W - 144), y: 72 + Math.random() * (H - 144) };
    if (distance(p, game.player) > 165 && game.enemies.every(e => distance(p, e) > 95)) return p;
  }
  return { x: game.player.x < W / 2 ? W - 105 : 105, y: game.player.y < H / 2 ? H - 105 : 105 };
}

function addEnemy(game: Game) {
  const edge = Math.floor(Math.random() * 4);
  const x = 35 + Math.random() * (W - 70), y = 35 + Math.random() * (H - 70);
  const p = edge === 0 ? { x, y: 32 } : edge === 1 ? { x: W - 32, y } : edge === 2 ? { x, y: H - 32 } : { x: 32, y };
  game.enemies.push({ ...p, id: game.nextId++, speed: 62 + game.sector * 12 + Math.random() * 15, phase: Math.random() * 6.28 });
}

function newGame(): Game {
  const game: Game = { player: { x: W / 2, y: H / 2, health: 3, invuln: 0, dash: 0, cooldown: 0, dirX: 0, dirY: -1 }, enemies: [], particles: [], core: null, sector: 1, collected: 0, score: 0, time: 0, spawn: 4.5, transition: 0, shake: 0, nextId: 0 };
  game.core = newCore(game);
  addEnemy(game); addEnemy(game);
  return game;
}

function burst(game: Game, x: number, y: number, color: string, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 55 + Math.random() * 170, life = .3 + Math.random() * .5;
    game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, size: 1.5 + Math.random() * 3, color });
  }
}

// All gameplay changes happen in one fixed-coordinate world, independent of canvas display size.
function update(game: Game, dt: number, keys: Set<string>, pointer: { active: boolean; x: number; y: number }, dashRequested: boolean, emit: (event: EventName) => void) {
  const p = game.player;
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt * 28);
  game.particles = game.particles.filter(v => v.life > 0);
  for (const v of game.particles) { v.x += v.vx * dt; v.y += v.vy * dt; v.life -= dt; }
  if (game.transition > 0) {
    game.transition -= dt;
    if (game.transition <= 0) {
      game.sector++; game.collected = 0; game.core = newCore(game);
      game.spawn = Math.max(2.2, 4.6 - game.sector * .35);
      for (let i = 0; i < Math.min(game.sector + 1, 5); i++) addEnemy(game);
    }
    return;
  }
  p.invuln = Math.max(0, p.invuln - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.dash = Math.max(0, p.dash - dt);
  let dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
  let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
  if (!dx && !dy && pointer.active) {
    const tx = pointer.x - p.x, ty = pointer.y - p.y;
    if (Math.hypot(tx, ty) > 15) { dx = tx; dy = ty; }
  }
  const len = Math.hypot(dx, dy);
  if (len) { dx /= len; dy /= len; if (!p.dash) { p.dirX = dx; p.dirY = dy; } }
  if (dashRequested && !p.cooldown) {
    p.dash = .22; p.cooldown = 2.2;
    burst(game, p.x, p.y, '#75f4e0', 12); emit('dash');
  }
  const speed = p.dash ? 680 : 245;
  p.x = Math.max(19, Math.min(W - 19, p.x + (p.dash ? p.dirX : dx) * speed * dt));
  p.y = Math.max(19, Math.min(H - 19, p.y + (p.dash ? p.dirY : dy) * speed * dt));
  if (p.dash && Math.random() < .85) game.particles.push({ x: p.x - p.dirX * 13, y: p.y - p.dirY * 13, vx: -p.dirX * 30, vy: -p.dirY * 30, life: .22, max: .22, size: 3, color: '#75f4e0' });

  if (game.core && distance(p, game.core) < 29) {
    burst(game, game.core.x, game.core.y, '#e7ff8e', 24);
    game.score += 100 * game.sector; game.collected++; emit('pickup');
    if (game.collected >= TARGET) {
      game.core = null; game.enemies = [];
      if (game.sector === TOTAL) { game.score += 1000 + p.health * 250; emit('win'); return; }
      game.transition = 1.6; p.health = Math.min(3, p.health + 1); p.invuln = 1.7; emit('sector'); return;
    }
    game.core = newCore(game);
  }
  game.spawn -= dt;
  if (game.spawn <= 0) {
    if (game.enemies.length < Math.min(3 + game.sector, 8)) addEnemy(game);
    game.spawn = Math.max(1.8, 4.8 - game.sector * .48);
  }
  for (const enemy of game.enemies) {
    enemy.phase += dt * 3;
    const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x) + Math.sin(enemy.phase + enemy.id) * .19;
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;
    if (distance(p, enemy) < 25) {
      if (p.dash) { burst(game, enemy.x, enemy.y, '#ff798e', 18); game.score += 50; enemy.dead = true; emit('kill'); }
      else if (!p.invuln) {
        p.health--; p.invuln = 1.5; game.shake = 8; enemy.dead = true;
        burst(game, p.x, p.y, '#ff798e', 20); emit(p.health <= 0 ? 'lose' : 'hit');
        if (p.health <= 0) break;
      }
    }
  }
  game.enemies = game.enemies.filter(e => !e.dead);
}

function draw(ctx: CanvasRenderingContext2D, game: Game, tick: number, mode: Mode) {
  ctx.fillStyle = '#08151b'; ctx.fillRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W * .53, H * .43, 30, W * .53, H * .43, 550);
  bg.addColorStop(0, '#102d33'); bg.addColorStop(1, '#08151b'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.save();
  if (mode === 'playing' && game.shake) ctx.translate((Math.random() - .5) * game.shake, (Math.random() - .5) * game.shake);
  ctx.strokeStyle = 'rgba(118,214,210,.065)'; ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  for (const s of stars) { ctx.globalAlpha = s.a + Math.sin(tick * 1.3 + s.x) * .07; ctx.fillStyle = '#b5efe9'; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.28); ctx.fill(); }
  ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(133,228,219,.25)'; ctx.lineWidth = 1.5;
  for (const [x, y, sx, sy] of [[16, 16, 1, 1], [W - 16, 16, -1, 1], [16, H - 16, 1, -1], [W - 16, H - 16, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + sx * 24, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * 24); ctx.stroke();
  }
  if (game.core) {
    const { x, y } = game.core;
    ctx.strokeStyle = 'rgba(223,255,146,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 31 + Math.sin(tick * 3.6) * 3, 0, 6.28); ctx.stroke();
    ctx.save(); ctx.translate(x, y); ctx.rotate(tick * .8); ctx.shadowColor = '#dfff84'; ctx.shadowBlur = 28;
    ctx.fillStyle = '#e8ff9e'; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(13, 0); ctx.lineTo(0, 13); ctx.lineTo(-13, 0); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for (const e of game.enemies) {
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(game.player.y - e.y, game.player.x - e.x));
    ctx.shadowColor = '#ff6884'; ctx.shadowBlur = 18; ctx.fillStyle = e.id % 3 ? '#fb718b' : '#ff8f83';
    ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-9, -12); ctx.lineTo(-5, 0); ctx.lineTo(-9, 12); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#571e30'; ctx.beginPath(); ctx.arc(1, 0, 3, 0, 6.28); ctx.fill(); ctx.restore();
  }
  for (const v of game.particles) { ctx.globalAlpha = Math.max(0, v.life / v.max); ctx.fillStyle = v.color; ctx.beginPath(); ctx.arc(v.x, v.y, v.size * ctx.globalAlpha, 0, 6.28); ctx.fill(); }
  ctx.globalAlpha = 1;
  const p = game.player;
  if (!p.invuln || Math.floor(tick * 12) % 2 === 0 || p.dash) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(p.dirY, p.dirX) + Math.PI / 2);
    ctx.shadowColor = '#71f2df'; ctx.shadowBlur = p.dash ? 35 : 20; ctx.fillStyle = '#7cf5e3';
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(12, 12); ctx.lineTo(0, 7); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = '#0c4449'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(4, 4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ddffad'; ctx.fillRect(-3, 10, 6, p.dash ? 15 : 8); ctx.restore();
  }
  if (game.transition > 0) {
    ctx.fillStyle = 'rgba(5,19,25,.45)'; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#e7ff9d'; ctx.font = '600 12px monospace'; ctx.fillText('SIGNAL RESTORED', W / 2, H / 2 - 14);
    ctx.fillStyle = '#f4faf7'; ctx.font = '700 32px sans-serif'; ctx.fillText('SECTOR CLEAR', W / 2, H / 2 + 28);
  }
  ctx.restore();
}

function formatTime(t: number) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(newGame());
  const modeRef = useRef<Mode>('menu');
  const keysRef = useRef(new Set<string>());
  const pointerRef = useRef({ active: false, x: 0, y: 0 });
  const dashRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const soundRef = useRef(true);
  const bestRef = useRef<number>(0);
  const [mode, setMode] = useState<Mode>('menu');
  const [soundOn, setSoundOn] = useState(true);
  const [hud, setHud] = useState<Hud>(initialHud);
  const [best, setBest] = useState(() => { try { return Number(localStorage.getItem('neon-relay-best') || 0); } catch { return 0; } });
  bestRef.current = best;

  function changeMode(next: Mode) { modeRef.current = next; setMode(next); }
  function play(name: EventName) {
    if (!soundRef.current) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const audio = audioRef.current;
      if (audio.state === 'suspended') void audio.resume();
      const now = audio.currentTime;
      const notes: Record<EventName, [number, number, OscillatorType][]> = {
        pickup: [[660, 0, 'sine'], [880, .09, 'sine']], dash: [[210, 0, 'sawtooth']], hit: [[145, 0, 'sawtooth']], kill: [[370, 0, 'triangle']],
        sector: [[500, 0, 'sine'], [670, .13, 'sine'], [900, .26, 'sine']], win: [[520, 0, 'sine'], [660, .15, 'sine'], [780, .3, 'sine'], [1040, .45, 'sine']], lose: [[320, 0, 'triangle'], [220, .17, 'triangle']],
      };
      for (const [frequency, delay, type] of notes[name]) {
        const osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = type; osc.frequency.setValueAtTime(frequency, now + delay);
        if (name === 'dash' || name === 'hit') osc.frequency.exponentialRampToValueAtTime(frequency * .45, now + delay + .18);
        gain.gain.setValueAtTime(.0001, now + delay); gain.gain.exponentialRampToValueAtTime(name === 'hit' ? .095 : .055, now + delay + .012); gain.gain.exponentialRampToValueAtTime(.0001, now + delay + .2);
        osc.connect(gain); gain.connect(audio.destination); osc.start(now + delay); osc.stop(now + delay + .21);
      }
    } catch { /* The game remains playable if Web Audio is unavailable. */ }
  }
  function finish(result: 'won' | 'lost') {
    changeMode(result);
    const score = gameRef.current.score;
    if (score > bestRef.current) { bestRef.current = score; setBest(score); try { localStorage.setItem('neon-relay-best', String(score)); } catch { /* Storage may be disabled. */ } }
  }
  function startGame() {
    gameRef.current = newGame(); keysRef.current.clear(); pointerRef.current.active = false; dashRef.current = false;
    setHud(initialHud); changeMode('playing'); play('sector');
  }
  function togglePause() {
    if (modeRef.current === 'playing') { keysRef.current.clear(); pointerRef.current.active = false; changeMode('paused'); }
    else if (modeRef.current === 'paused') changeMode('playing');
  }

  // Window-level listeners keep movement responsive even when focus leaves the canvas.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'shift', 'w', 'a', 's', 'd', 'p', 'escape'].includes(k)) e.preventDefault();
      if (k === 'escape' || k === 'p') { if (!e.repeat) togglePause(); return; }
      if (k === 'enter' && !e.repeat) {
        if (modeRef.current === 'menu' || modeRef.current === 'won' || modeRef.current === 'lost') startGame();
        else if (modeRef.current === 'paused') togglePause();
      }
      if ((k === ' ' || k === 'shift') && !e.repeat && modeRef.current === 'playing') dashRef.current = true;
      keysRef.current.add(k);
    };
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase());
    const blur = () => { keysRef.current.clear(); pointerRef.current.active = false; if (modeRef.current === 'playing') changeMode('paused'); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, []);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    let frame = 0, last = performance.now(), lastHud = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, .035); last = now;
      const game = gameRef.current;
      if (modeRef.current === 'playing') {
        update(game, dt, keysRef.current, pointerRef.current, dashRef.current, name => { play(name); if (name === 'win') finish('won'); if (name === 'lose') finish('lost'); });
        dashRef.current = false;
        if (now - lastHud > 80 || modeRef.current !== 'playing') {
          setHud({ sector: game.sector, collected: game.collected, score: game.score, health: game.player.health, time: game.time, cooldown: game.player.cooldown }); lastHud = now;
        }
      }
      draw(ctx, game, now / 1000, modeRef.current); frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  function movePointer(e: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    pointerRef.current.x = (e.clientX - rect.left) * W / rect.width;
    pointerRef.current.y = (e.clientY - rect.top) * H / rect.height;
  }

  return <div className="site-shell">
    <header className="site-header"><div className="site-logo"><span className="logo-mark"><span /></span><span>AFTERHOURS <b>ARCADE</b></span></div><div className="header-right"><span className="header-edition">AN ORIGINAL ONE-SCREEN GAME</span><button className="sound-button" onClick={() => { soundRef.current = !soundRef.current; setSoundOn(soundRef.current); }} aria-label={soundOn ? 'Mute sound' : 'Enable sound'}><span className="sound-glyph">{soundOn ? '[))' : '[x'}</span><span>SOUND {soundOn ? 'ON' : 'OFF'}</span></button></div></header>
    <main className="main-content">
      <div className="game-heading"><div><div className="overline"><span className="live-dot" /> THE SIGNAL IS FADING</div><h1>NEON <span>RELAY</span><span className="heading-period">.</span></h1></div><p>Recover the cores. Outrun the swarm.<br />Make it through all five sectors.</p></div>
      <section className="game-frame" aria-label="Neon Relay game">
        <div className="game-hud">
          <div className="hud-sector"><span className="hud-label">SECTOR</span><strong>{String(hud.sector).padStart(2, '0')} <span>/ 05</span></strong></div>
          <div className="hud-progress"><span className="hud-label">CORES RECOVERED</span><div className="progress-pips" aria-label={`${hud.collected} of ${TARGET} cores recovered`}>{Array.from({ length: TARGET }, (_, i) => <span key={i} className={i < hud.collected ? 'filled' : ''} />)}</div></div>
          <div className="hud-value"><span className="hud-label">SCORE</span><strong>{hud.score.toLocaleString()}</strong></div>
          <div className="hud-value hud-time"><span className="hud-label">TIME</span><strong>{formatTime(hud.time)}</strong></div>
          <div className="hud-health"><span className="hud-label">SHIELDS</span><div className="health-pips" aria-label={`${hud.health} shields remaining`}>{Array.from({ length: 3 }, (_, i) => <span key={i} className={i < hud.health ? 'active' : ''}>&lt;&gt;</span>)}</div></div>
          <button className="pause-button" onClick={togglePause} disabled={mode !== 'playing' && mode !== 'paused'} aria-label={mode === 'paused' ? 'Resume game' : 'Pause game'}>{mode === 'paused' ? '>' : '||'}</button>
        </div>
        <div className="arena">
          <canvas ref={canvasRef} width={W} height={H} onPointerDown={e => { if (modeRef.current !== 'playing') return; e.currentTarget.setPointerCapture(e.pointerId); pointerRef.current.active = true; movePointer(e); }} onPointerMove={e => { if (pointerRef.current.active) movePointer(e); }} onPointerUp={() => { pointerRef.current.active = false; }} onPointerCancel={() => { pointerRef.current.active = false; }} aria-label="Game arena. Use arrow keys or WASD to move and Space to dash." />
          {mode === 'playing' && <div className="arena-actions"><div className="dash-meter"><span>DASH</span><div className="meter-track"><div style={{ width: `${Math.max(0, (1 - hud.cooldown / 2.2) * 100)}%` }} /></div><span>{hud.cooldown <= 0 ? 'READY' : `${hud.cooldown.toFixed(1)}S`}</span></div><button className="touch-dash" onPointerDown={e => { e.preventDefault(); dashRef.current = true; }} disabled={hud.cooldown > 0} aria-label="Dash">DASH <span>+</span></button></div>}
          {mode !== 'playing' && <div className="screen-overlay">
            {mode === 'menu' && <div className="overlay-content intro-content"><span className="overlay-kicker">// TRANSMISSION INCOMING</span><div className="intro-emblem"><span className="emblem-core" /></div><h2>THE GRID IS<br /><em>GOING DARK.</em></h2><p>Collect four signal cores per sector. Dash through the hunters.<br className="desktop-break" /> Keep your shields up and restore all five sectors.</p><button className="primary-button" onClick={startGame}>START MISSION <span>+</span></button><span className="overlay-hint">PRESS ENTER TO START</span></div>}
            {mode === 'paused' && <div className="overlay-content result-content"><span className="overlay-kicker">// CONNECTION INTERRUPTED</span><h2>PAUSED<span className="accent-period">.</span></h2><p>Take a breath. The signal will wait.</p><button className="primary-button" onClick={togglePause}>RESUME MISSION <span>+</span></button><button className="text-button" onClick={startGame}>RESTART FROM SECTOR 01</button></div>}
            {mode === 'won' && <div className="overlay-content result-content"><span className="overlay-kicker">// ALL SECTORS ONLINE</span><h2>SIGNAL<br /><em>RESTORED.</em></h2><p>You made it through the grid. The light is back on.</p><div className="result-score"><span>FINAL SCORE</span><strong>{hud.score.toLocaleString()}</strong><small>BEST {best.toLocaleString()}</small></div><button className="primary-button" onClick={startGame}>PLAY AGAIN <span>+</span></button></div>}
            {mode === 'lost' && <div className="overlay-content result-content"><span className="overlay-kicker danger">// SIGNAL LOST</span><h2>GRID<br /><em>OFFLINE.</em></h2><p>You reached sector {String(hud.sector).padStart(2, '0')}. Every run takes you further.</p><div className="result-score"><span>FINAL SCORE</span><strong>{hud.score.toLocaleString()}</strong><small>BEST {best.toLocaleString()}</small></div><button className="primary-button" onClick={startGame}>TRY AGAIN <span>+</span></button></div>}
          </div>}
        </div>
      </section>
      <div className="game-footer"><div className="control-guide"><span className="guide-label">HOW TO PLAY</span><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or <kbd>ARROWS</kbd> <b>MOVE</b></span><span><kbd>SPACE</kbd> <b>DASH / DESTROY</b></span><span><kbd>P</kbd> <b>PAUSE</b></span></div><div className="touch-guide">ON TOUCH: HOLD TO MOVE / TAP DASH</div><div className="best-score">PERSONAL BEST <strong>{best.toLocaleString()}</strong></div></div>
    </main><footer className="page-footer"><span>AFTERHOURS ARCADE / 001</span><span>BUILT FOR THE HIGH SCORE</span></footer>
  </div>;
}
