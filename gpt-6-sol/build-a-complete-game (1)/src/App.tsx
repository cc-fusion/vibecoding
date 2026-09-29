import { useEffect, useRef, useState } from 'react';

type Point = { x: number; y: number };
type Phase = 'start' | 'playing' | 'paused' | 'lost' | 'won';
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };
type Game = {
  snake: Point[]; direction: Point; queued: Point; food: Point; obstacles: Point[];
  level: number; eaten: number; score: number; lives: number; lastTick: number;
  lastFrame: number; bannerUntil: number; flash: number; particles: Particle[];
};

const SIZE = 20;
const CELL = 30;
const GOAL = 5;
const FINAL_LEVEL = 5;
const RIGHT = { x: 1, y: 0 };
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const initialSnake = (): Point[] => [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];

function obstaclesFor(level: number): Point[] {
  const result: Point[] = [];
  if (level >= 2) result.push(...[[4, 4], [5, 4], [14, 4], [15, 4], [4, 15], [5, 15], [14, 15], [15, 15]].map(([x, y]) => ({ x, y })));
  if (level >= 3) result.push(...[[3, 9], [3, 10], [16, 9], [16, 10]].map(([x, y]) => ({ x, y })));
  if (level >= 4) result.push(...[[8, 4], [9, 4], [10, 4], [11, 4], [8, 15], [9, 15], [10, 15], [11, 15]].map(([x, y]) => ({ x, y })));
  if (level >= 5) result.push(...[[6, 7], [6, 8], [13, 7], [13, 8], [6, 12], [13, 12]].map(([x, y]) => ({ x, y })));
  return result;
}

function makeGame(): Game {
  return { snake: initialSnake(), direction: RIGHT, queued: RIGHT, food: { x: 14, y: 10 }, obstacles: [], level: 1, eaten: 0, score: 0, lives: 3, lastTick: 0, lastFrame: 0, bannerUntil: 0, flash: 0, particles: [] };
}

function placeFood(game: Game): Point {
  const free: Point[] = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const point = { x, y };
    if (!game.snake.some((part) => same(part, point)) && !game.obstacles.some((wall) => same(wall, point))) free.push(point);
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 14, y: 10 };
}

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}

function drawBoard(ctx: CanvasRenderingContext2D, game: Game, time: number, phase: Phase) {
  const delta = game.lastFrame ? Math.min((time - game.lastFrame) / 16.67, 2.5) : 1;
  game.lastFrame = time;
  ctx.fillStyle = '#0d1b1e'; ctx.fillRect(0, 0, 600, 600);
  ctx.strokeStyle = 'rgba(122, 168, 160, 0.075)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let i = 1; i < SIZE; i++) { const p = i * CELL + 0.5; ctx.moveTo(p, 0); ctx.lineTo(p, 600); ctx.moveTo(0, p); ctx.lineTo(600, p); }
  ctx.stroke();
  ctx.fillStyle = 'rgba(151, 226, 198, 0.12)';
  [[12, 12], [588, 12], [12, 588], [588, 588]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill(); });
  game.obstacles.forEach(({ x, y }) => {
    ctx.fillStyle = '#28413e'; rounded(ctx, x * CELL + 2, y * CELL + 2, 26, 26, 3);
    ctx.fillStyle = '#527269'; ctx.fillRect(x * CELL + 7, y * CELL + 7, 16, 2);
    ctx.fillStyle = '#142c2b'; ctx.fillRect(x * CELL + 7, y * CELL + 21, 16, 2);
  });
  const fx = game.food.x * CELL + 15; const fy = game.food.y * CELL + 15;
  const pulse = 1 + Math.sin(time / 180) * 0.12;
  ctx.save(); ctx.translate(fx, fy); ctx.rotate(Math.PI / 4);
  ctx.shadowColor = '#ff805d'; ctx.shadowBlur = 24 + Math.sin(time / 190) * 7;
  ctx.fillStyle = '#ff8967'; rounded(ctx, -8 * pulse, -8 * pulse, 16 * pulse, 16 * pulse, 3);
  ctx.shadowBlur = 0; ctx.fillStyle = '#ffd6a7'; ctx.fillRect(-2, -2, 4, 4); ctx.restore();
  for (let i = game.snake.length - 1; i >= 0; i--) {
    const part = game.snake[i]; const x = part.x * CELL; const y = part.y * CELL;
    ctx.fillStyle = i === 0 ? '#d8fba2' : i % 2 === 0 ? '#8ddeae' : '#a7eab8';
    if (i === 0) { ctx.shadowColor = '#a7f0b5'; ctx.shadowBlur = 18; }
    rounded(ctx, x + 2, y + 2, 26, 26, i === 0 ? 7 : 5); ctx.shadowBlur = 0;
    if (i === 0) {
      ctx.fillStyle = '#17312b'; const d = game.direction;
      const eyes = d.x !== 0 ? [[d.x > 0 ? 20 : 10, 9], [d.x > 0 ? 20 : 10, 21]] : [[9, d.y > 0 ? 20 : 10], [21, d.y > 0 ? 20 : 10]];
      eyes.forEach(([ex, ey]) => { ctx.beginPath(); ctx.arc(x + ex, y + ey, 2, 0, Math.PI * 2); ctx.fill(); });
    }
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  game.particles.forEach((p) => { p.x += p.vx * delta; p.y += p.vy * delta; p.life -= 0.028 * delta; ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 4, 4); });
  ctx.globalAlpha = 1;
  if (game.flash > 0) { ctx.fillStyle = `rgba(255, 116, 96, ${game.flash * 0.2})`; ctx.fillRect(0, 0, 600, 600); game.flash = Math.max(0, game.flash - 0.045 * delta); }
  if (phase === 'playing' && game.bannerUntil > time) {
    ctx.fillStyle = 'rgba(8, 26, 27, 0.78)'; ctx.fillRect(0, 251, 600, 98);
    ctx.textAlign = 'center'; ctx.fillStyle = '#dbfca9'; ctx.font = '600 14px monospace'; ctx.fillText('NEW SECTOR UNLOCKED', 300, 284);
    ctx.fillStyle = '#f0f5e9'; ctx.font = 'bold 32px sans-serif'; ctx.fillText(`SECTOR 0${game.level}`, 300, 325);
  }
}

function readBest() { try { return Number(localStorage.getItem('gridline-best')) || 0; } catch { return 0; } }

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game>(makeGame());
  const phaseRef = useRef<Phase>('start');
  const soundRef = useRef(true);
  const audioRef = useRef<AudioContext | null>(null);
  const touchRef = useRef<Point | null>(null);
  const [phase, setPhase] = useState<Phase>('start');
  const [hud, setHud] = useState({ score: 0, level: 1, eaten: 0, lives: 3 });
  const [best, setBest] = useState(readBest);
  const [soundOn, setSoundOn] = useState(true);

  function changePhase(next: Phase) { phaseRef.current = next; setPhase(next); }

  function tone(frequency: number, duration = 0.1, waveform: OscillatorType = 'sine', volume = 0.045) {
    if (!soundRef.current) return;
    try {
      if (!audioRef.current) audioRef.current = new AudioContext();
      const audio = audioRef.current;
      if (audio.state === 'suspended') void audio.resume();
      const oscillator = audio.createOscillator(); const gain = audio.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.65), audio.currentTime + duration);
      gain.gain.setValueAtTime(volume, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + duration);
    } catch { /* Audio is optional when blocked by the browser. */ }
  }

  function syncHud() {
    const { score, level, eaten, lives } = gameRef.current;
    setHud({ score, level, eaten, lives });
    if (score > readBest()) {
      try { localStorage.setItem('gridline-best', String(score)); } catch { /* Private browsing may block storage. */ }
      setBest(score);
    }
  }

  function burst(point: Point, color: string, count = 14) {
    const game = gameRef.current;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count; const speed = 1.5 + Math.random() * 2.8;
      game.particles.push({ x: point.x * CELL + 15, y: point.y * CELL + 15, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }

  function startGame() {
    gameRef.current = makeGame(); gameRef.current.lastTick = performance.now() + 200;
    setHud({ score: 0, level: 1, eaten: 0, lives: 3 }); changePhase('playing'); tone(500, 0.16);
  }

  function togglePause() {
    if (phaseRef.current === 'playing') { changePhase('paused'); tone(310, 0.09); }
    else if (phaseRef.current === 'paused') { gameRef.current.lastTick = performance.now(); changePhase('playing'); tone(570, 0.09); }
  }

  function setDirection(direction: Point) {
    if (phaseRef.current !== 'playing') return;
    const current = gameRef.current.direction;
    if (direction.x !== -current.x || direction.y !== -current.y) gameRef.current.queued = direction;
  }

  function step() {
    const game = gameRef.current;
    game.direction = game.queued;
    const next = { x: game.snake[0].x + game.direction.x, y: game.snake[0].y + game.direction.y };
    const eating = same(next, game.food);
    const body = eating ? game.snake : game.snake.slice(0, -1);
    const collision = next.x < 0 || next.y < 0 || next.x >= SIZE || next.y >= SIZE || game.obstacles.some((wall) => same(wall, next)) || body.some((part) => same(part, next));
    if (collision) {
      burst(game.snake[0], '#ff8967', 22); game.flash = 1; game.lives--; tone(180, 0.32, 'sawtooth', 0.035);
      if (game.lives <= 0) changePhase('lost');
      else { game.snake = initialSnake(); game.direction = RIGHT; game.queued = RIGHT; game.food = placeFood(game); game.lastTick = performance.now() + 650; }
      syncHud(); return;
    }
    game.snake.unshift(next);
    if (!eating) { game.snake.pop(); return; }
    burst(game.food, '#ffad76'); tone(720 + game.eaten * 90, 0.12, 'triangle');
    game.score += game.level * 10; game.eaten++;
    if (game.eaten >= GOAL) {
      if (game.level === FINAL_LEVEL) { syncHud(); changePhase('won'); tone(1050, 0.45, 'triangle'); return; }
      game.level++; game.eaten = 0; game.snake = initialSnake(); game.direction = RIGHT; game.queued = RIGHT;
      game.obstacles = obstaclesFor(game.level); game.bannerUntil = performance.now() + 1400; game.lastTick = performance.now() + 450; tone(980, 0.3, 'triangle');
    }
    game.food = placeFood(game); syncHud();
  }

  // Draw every frame, but move the snake on a level-dependent clock.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d'); if (!ctx) return;
    let frame = 0;
    const loop = (time: number) => {
      const game = gameRef.current;
      if (phaseRef.current === 'playing' && time - game.lastTick >= 166 - (game.level - 1) * 18) { game.lastTick = time; step(); }
      drawBoard(ctx, gameRef.current, time, phaseRef.current);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(frame); void audioRef.current?.close(); };
  }, []);

  useEffect(() => {
    const directions: Record<string, Point> = {
      arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 }, arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
      arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
    };
    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (directions[key]) { event.preventDefault(); setDirection(directions[key]); return; }
      if (key === ' ' || key === 'enter') {
        event.preventDefault();
        if (phaseRef.current === 'playing' || phaseRef.current === 'paused') togglePause(); else startGame();
      } else if (key === 'escape' || key === 'p') { event.preventDefault(); togglePause(); }
    };
    window.addEventListener('keydown', onKey);
    const onVisibility = () => { if (document.hidden && phaseRef.current === 'playing') togglePause(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  const overlayContent = {
    start: { eyebrow: 'WELCOME TO THE GRID', title: 'Find your flow.', description: 'Collect the glowing nodes. Dodge the walls. Never cross your own trail.', button: 'START RUN', hint: 'PRESS ENTER TO START' },
    playing: { eyebrow: '', title: '', description: '', button: '', hint: '' },
    paused: { eyebrow: 'TAKE A BREATH', title: 'On hold.', description: 'Your run is right where you left it. The grid can wait.', button: 'RESUME RUN', hint: 'PRESS SPACE TO RESUME' },
    lost: { eyebrow: 'SIGNAL LOST', title: 'One more run?', description: 'Every great line starts with a fresh turn. Go again.', button: 'TRY AGAIN', hint: 'PRESS ENTER TO RESTART' },
    won: { eyebrow: 'ALL SECTORS CLEARED', title: 'Beautifully done.', description: 'You made it through the grid. There is always another line to draw.', button: 'PLAY AGAIN', hint: 'PRESS ENTER TO RESTART' },
  }[phase];

  return (
    <div className="app-shell">
      <style>{styles}</style>
      <div className="page">
        <header className="topbar">
          <div className="top-brand"><span className="brand-glyph"><i /><i /><i /><i /></span><span>G / L</span><span className="top-divider" /><span className="top-muted">THE LITTLE ARCADE</span></div>
          <div className="top-right"><span className="top-edition">VOL. 01 <span className="edition-slash">/</span> EST. 2025</span><button className="sound-button" onClick={() => { soundRef.current = !soundRef.current; setSoundOn(soundRef.current); if (soundRef.current) tone(640, 0.08); }} aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}><span className="sound-icon">{soundOn ? '◖))' : '◖×'}</span> SOUND {soundOn ? 'ON' : 'OFF'}</button></div>
        </header>
        <main>
          <section className="intro">
            <div className="intro-copy"><div className="eyebrow"><span className="eyebrow-line" /> A GAME OF QUICK THINKING & SHARP TURNS</div><h1>GRIDLINE<span className="title-dot">.</span></h1><p>Chase the signal. Trust your instincts. Just don't hit the edge.</p></div>
            <div className="intro-index"><span>01 — 05</span><small>SECTORS TO CLEAR</small></div>
          </section>
          <section className="game-layout" aria-label="Gridline game">
            <div className="arena-column">
              <div className="arena-heading"><div className="arena-label"><span className="live-dot" /> <span>{phase === 'playing' ? 'RUN IN PROGRESS' : phase === 'paused' ? 'RUN PAUSED' : phase === 'won' ? 'RUN COMPLETE' : phase === 'lost' ? 'RUN ENDED' : 'AWAITING PLAYER'}</span></div><div className="arena-actions">{(phase === 'playing' || phase === 'paused') && <button onClick={togglePause}>{phase === 'playing' ? 'Ⅱ PAUSE' : '▶ RESUME'}</button>}<button onClick={startGame}>↻ RESTART</button></div></div>
              <div className="arena-frame">
                <canvas ref={canvasRef} width={600} height={600} aria-label="Snake game board" onTouchStart={(event) => { const t = event.touches[0]; touchRef.current = { x: t.clientX, y: t.clientY }; }} onTouchEnd={(event) => { if (!touchRef.current) return; const t = event.changedTouches[0]; const dx = t.clientX - touchRef.current.x; const dy = t.clientY - touchRef.current.y; if (Math.max(Math.abs(dx), Math.abs(dy)) > 18) setDirection(Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) }); touchRef.current = null; }} />
                {phase !== 'playing' && <div className="game-overlay"><div className="overlay-content" key={phase}><div className="overlay-mark"><span /><span /><span /><span /></div><div className="overlay-eyebrow">{overlayContent.eyebrow}</div><h2>{overlayContent.title}</h2><p>{overlayContent.description}</p>{(phase === 'lost' || phase === 'won') && <div className="final-score">FINAL SCORE <strong>{hud.score.toString().padStart(4, '0')}</strong></div>}<button className="primary-button" onClick={phase === 'paused' ? togglePause : startGame}><span>{overlayContent.button}</span><span className="button-arrow">↗</span></button><div className="overlay-hint">{overlayContent.hint}</div></div></div>}
                <span className="corner corner-tl" /><span className="corner corner-tr" /><span className="corner corner-bl" /><span className="corner corner-br" />
              </div>
              <div className="arena-caption"><span>THE GRID IS YOURS TO NAVIGATE.</span><span>GOOD LUCK OUT THERE <span className="caption-star">✳</span></span></div>
              <div className="touch-controls"><div className="touch-title">TOUCH CONTROLS <span>OR SWIPE THE GRID</span></div><div className="dpad"><button className="dpad-up" aria-label="Move up" onPointerDown={() => setDirection({ x: 0, y: -1 })}>↑</button><button className="dpad-left" aria-label="Move left" onPointerDown={() => setDirection({ x: -1, y: 0 })}>←</button><button className="dpad-down" aria-label="Move down" onPointerDown={() => setDirection({ x: 0, y: 1 })}>↓</button><button className="dpad-right" aria-label="Move right" onPointerDown={() => setDirection({ x: 1, y: 0 })}>→</button></div></div>
            </div>
            <aside className="sidebar">
              <div className="sidebar-top"><span className="section-number">/ YOUR RUN</span><span className="small-cross">✳</span></div>
              <div className="score-section"><div className="stat-label">CURRENT SCORE</div><div className="big-score" aria-live="polite">{hud.score.toString().padStart(4, '0')}</div><div className="best-score"><span>PERSONAL BEST</span><strong>{best.toString().padStart(4, '0')}</strong></div></div>
              <div className="side-rule" />
              <div className="sector-section"><div className="side-row"><span className="stat-label">SECTOR</span><span className="sector-count">0{hud.level} <em>/ 0{FINAL_LEVEL}</em></span></div><div className="sector-bars">{Array.from({ length: FINAL_LEVEL }, (_, index) => <span key={index} className={index < hud.level ? 'active' : ''} />)}</div><div className="progress-row"><span>NODES COLLECTED</span><span>{hud.eaten.toString().padStart(2, '0')} / 0{GOAL}</span></div><div className="progress-track"><div style={{ width: `${(hud.eaten / GOAL) * 100}%` }} /></div></div>
              <div className="side-rule" />
              <div className="life-section"><div className="stat-label">INTEGRITY</div><div className="lives"><div className="life-marks">{Array.from({ length: 3 }, (_, index) => <span key={index} className={index < hud.lives ? 'filled' : ''}>◆</span>)}</div><span>{hud.lives} / 3 LIVES</span></div></div>
              <div className="side-rule" />
              <div className="how-to"><div className="stat-label">HOW TO PLAY</div><p>Collect <span className="orange-word">orange nodes</span> to advance. Avoid the walls, obstacles, and your own tail.</p><div className="control-row"><div className="key-group"><kbd>↑</kbd><div><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></div></div><span>or <strong>W A S D</strong><br />to move</span></div><div className="space-control"><kbd>SPACE</kbd><span>to pause / resume</span></div></div>
              <div className="sidebar-foot">KEEP MOVING. KEEP THINKING. <span>↗</span></div>
            </aside>
          </section>
        </main>
        <footer><span>GRIDLINE © 2025</span><span>BUILT FOR THE JOY OF ONE MORE TRY.</span><span>PLAY NICE. PLAY AGAIN.</span></footer>
      </div>
    </div>
  );
}

const styles = `
*{box-sizing:border-box}html{background:#091517}body{margin:0}button{font:inherit;cursor:pointer}button:focus-visible{outline:2px solid #d9fca7;outline-offset:4px}
.app-shell{min-height:100vh;background:#091517;color:#e8eee8;font-family:'Space Grotesk',Arial,sans-serif;overflow:hidden}.page{max-width:1390px;margin:auto;padding:0 58px}.topbar{height:77px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #29403d;font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.08em}.top-brand,.top-right{display:flex;align-items:center;gap:18px}.top-brand>span:nth-child(2){font-weight:500;color:#ecf8e7;font-size:15px;letter-spacing:-.08em}.brand-glyph{width:25px;height:25px;display:grid;grid-template-columns:repeat(2,8px);grid-template-rows:repeat(2,8px);gap:3px;transform:rotate(-10deg)}.brand-glyph i{background:#bdf3a5;border-radius:2px}.brand-glyph i:nth-child(2){opacity:.55}.brand-glyph i:nth-child(3){opacity:.35}.top-divider{height:19px;width:1px;background:#3b514c}.top-muted,.top-edition{color:#819792}.edition-slash{color:#d8fba2;margin:0 5px}.sound-button{background:none;color:#c4d3ca;border:1px solid #3b534d;padding:9px 13px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.05em;transition:background .2s,color .2s}.sound-button:hover{background:#d9fca7;color:#14221d}.sound-icon{color:#c5f5a6;margin-right:8px;font-size:13px}.intro{display:flex;justify-content:space-between;align-items:flex-end;padding:50px 0 37px}.eyebrow{font-family:'DM Mono',monospace;color:#b2d5bd;font-size:10px;letter-spacing:.14em;display:flex;align-items:center;gap:12px}.eyebrow-line{width:22px;height:1px;background:#b9eba8}.intro h1{font-size:clamp(72px,8.2vw,126px);line-height:.94;letter-spacing:-.09em;font-weight:700;margin:18px 0 19px;color:#eff5eb}.title-dot{color:#bdf0a3}.intro p{font-size:16px;color:#aabcb5;margin:0;letter-spacing:-.025em}.intro-index{text-align:right;margin-bottom:3px;display:flex;flex-direction:column;gap:5px;font-family:'DM Mono',monospace}.intro-index span{color:#c6e4bd;font-size:17px;letter-spacing:.07em}.intro-index small{font-size:9px;color:#78928b;letter-spacing:.12em}.game-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:57px;align-items:start}.arena-column{min-width:0}.arena-heading{height:43px;display:flex;align-items:flex-start;justify-content:space-between;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em}.arena-label{display:flex;align-items:center;gap:10px;color:#a5bdaf;padding-top:5px}.live-dot{width:7px;height:7px;border-radius:50%;background:#c4f3a5;box-shadow:0 0 12px #b9ed9d;animation:blink 2s ease-in-out infinite}.arena-actions{display:flex;gap:20px}.arena-actions button{border:0;background:none;color:#a6bbb0;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.06em;padding:4px 0;transition:color .2s}.arena-actions button:hover{color:#d8fba2}.arena-frame{position:relative;border:1px solid #4c6b5e;background:#0d1b1e;padding:7px;box-shadow:0 25px 65px #0005;max-width:716px;aspect-ratio:1}.arena-frame canvas{display:block;width:100%;height:100%;touch-action:none}.corner{position:absolute;width:13px;height:13px;pointer-events:none;border-color:#d0f9a2;border-style:solid}.corner-tl{top:-2px;left:-2px;border-width:2px 0 0 2px}.corner-tr{top:-2px;right:-2px;border-width:2px 2px 0 0}.corner-bl{bottom:-2px;left:-2px;border-width:0 0 2px 2px}.corner-br{bottom:-2px;right:-2px;border-width:0 2px 2px 0}.game-overlay{position:absolute;inset:8px;background:rgba(6,20,22,.78);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}.overlay-content{max-width:420px;animation:rise .38s ease both}.overlay-mark{width:42px;height:42px;display:grid;grid-template-columns:repeat(2,15px);grid-template-rows:repeat(2,15px);gap:5px;transform:rotate(-10deg);margin:0 auto 32px}.overlay-mark span{background:#d2f5aa;border-radius:3px}.overlay-mark span:nth-child(2){opacity:.6}.overlay-mark span:nth-child(3){opacity:.35}.overlay-eyebrow{color:#c2efa9;font:500 11px 'DM Mono',monospace;letter-spacing:.15em}.overlay-content h2{font-size:clamp(38px,4.1vw,61px);letter-spacing:-.07em;line-height:1.05;margin:15px 0;color:#f3f8ed}.overlay-content p{color:#b0c4b7;font-size:15px;line-height:1.55;max-width:340px;margin:0 auto 28px}.primary-button{width:236px;height:53px;background:#d4f6a5;color:#142820;border:1px solid #d4f6a5;display:inline-flex;align-items:center;justify-content:space-between;padding:0 19px;font:500 12px 'DM Mono',monospace;letter-spacing:.07em;transition:transform .2s,background .2s,box-shadow .2s}.primary-button:hover{transform:translateY(-3px);background:#e7ffbf;box-shadow:0 9px 27px #baf7a533}.button-arrow{font-size:22px;font-family:Arial}.overlay-hint{font:10px 'DM Mono',monospace;letter-spacing:.12em;color:#708b7f;margin-top:19px}.final-score{font:10px 'DM Mono',monospace;letter-spacing:.1em;color:#91a99b;margin:-8px 0 23px}.final-score strong{color:#e8f6df;font-size:17px;margin-left:9px}.arena-caption{display:flex;justify-content:space-between;max-width:716px;padding-top:16px;font:9px 'DM Mono',monospace;letter-spacing:.1em;color:#728b81}.caption-star{color:#c9f2a4;font-size:13px}.sidebar{padding-top:1px;min-height:700px;display:flex;flex-direction:column}.sidebar-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:31px}.section-number,.stat-label{font:10px 'DM Mono',monospace;letter-spacing:.12em;color:#9db7a9}.small-cross{color:#d6f5a7;font-size:17px}.big-score{font-size:75px;line-height:1.15;font-weight:600;letter-spacing:-.085em;color:#eff5ea;margin:10px 0 11px;font-variant-numeric:tabular-nums}.best-score,.progress-row,.lives,.space-control,.control-row{display:flex;justify-content:space-between;align-items:center}.best-score{font:10px 'DM Mono',monospace;letter-spacing:.07em;color:#7e978b}.best-score strong{font-size:13px;color:#c7f2a5;font-weight:500}.side-rule{height:1px;width:100%;background:#30463e;margin:32px 0}.side-row{display:flex;justify-content:space-between;align-items:center}.sector-count{font:18px 'DM Mono',monospace;color:#e6f5df}.sector-count em{font-size:12px;color:#71897e;font-style:normal}.sector-bars{display:flex;gap:5px;margin:21px 0 24px}.sector-bars span{height:6px;flex:1;background:#2a4039;transform:skewX(-22deg)}.sector-bars span.active{background:#c7efa3;box-shadow:0 0 12px #b6f29a33}.progress-row{font:10px 'DM Mono',monospace;letter-spacing:.07em;color:#9bb3a5}.progress-row span:last-child{color:#e0f2d7}.progress-track{height:3px;background:#2a4039;margin-top:13px}.progress-track div{height:100%;background:#f69a78;transition:width .25s}.lives{margin-top:18px;font:10px 'DM Mono',monospace;color:#9cb0a3;letter-spacing:.06em}.life-marks{display:flex;gap:10px;color:#3e554b;font-size:23px;line-height:1}.life-marks .filled{color:#f49b7a;text-shadow:0 0 12px #f49b7a66}.how-to p{font-size:13px;line-height:1.6;color:#9aafa4;margin:15px 0 22px;max-width:260px}.orange-word{color:#f7a586}.control-row{justify-content:flex-start;gap:19px}.control-row>span,.space-control>span{font:11px/1.7 'DM Mono',monospace;color:#80998b}.control-row strong{font-weight:500;color:#d5e6d5}.key-group{display:flex;flex-direction:column;align-items:center;gap:3px}.key-group>div{display:flex;gap:3px}kbd{height:25px;min-width:25px;display:inline-flex;align-items:center;justify-content:center;border:1px solid #577064;background:#1b2d2a;color:#dcebdd;font:12px 'DM Mono',monospace;border-radius:3px;box-shadow:0 2px 0 #40594c}.space-control{justify-content:flex-start;gap:15px;margin-top:17px}.space-control kbd{font-size:9px;padding:0 15px}.sidebar-foot{margin-top:auto;padding-top:31px;color:#658073;font:9px 'DM Mono',monospace;letter-spacing:.07em;display:flex;justify-content:space-between}.sidebar-foot span{font-size:18px;color:#a8d998}footer{display:flex;justify-content:space-between;gap:15px;margin-top:74px;padding:23px 0 30px;border-top:1px solid #29403d;color:#698277;font:9px 'DM Mono',monospace;letter-spacing:.1em}.touch-controls{display:none}@keyframes blink{50%{opacity:.45;box-shadow:0 0 3px #b9ed9d}}@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:1050px){.page{padding:0 32px}.game-layout{gap:30px;grid-template-columns:minmax(0,1fr) 255px}.big-score{font-size:61px}.intro h1{font-size:90px}.sidebar{min-height:0}.sidebar-foot{margin-top:24px}}
@media(max-width:760px){.page{padding:0 20px}.topbar{height:66px}.top-edition,.top-muted,.top-divider{display:none}.intro{padding:39px 0 31px}.intro h1{font-size:clamp(58px,13vw,90px)}.intro p{font-size:14px}.intro-index{display:none}.game-layout{display:flex;flex-direction:column;gap:45px}.arena-column{width:100%}.arena-frame{width:100%}.sidebar{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:0 28px}.sidebar-top{grid-column:1/-1;margin-bottom:20px}.score-section{grid-column:1/-1}.big-score{font-size:65px}.sidebar .side-rule{grid-column:1/-1;margin:27px 0}.sidebar-foot{grid-column:1/-1}.how-to{grid-column:1/-1}.touch-controls{display:block;margin-top:26px}.touch-title{display:flex;justify-content:space-between;font:10px 'DM Mono',monospace;letter-spacing:.08em;color:#a9c5af}.touch-title span{color:#6d897b}.dpad{display:grid;grid-template-columns:repeat(3,55px);grid-template-rows:repeat(2,48px);justify-content:center;gap:5px;margin:14px auto 0}.dpad button{background:#1b322e;color:#d4f5af;border:1px solid #52735d;font-size:24px;touch-action:manipulation}.dpad button:active{background:#d4f5af;color:#183024}.dpad-up{grid-column:2}.dpad-left{grid-column:1;grid-row:2}.dpad-down{grid-column:2;grid-row:2}.dpad-right{grid-column:3;grid-row:2}footer{margin-top:55px}footer span:nth-child(2){display:none}}
@media(max-width:480px){.page{padding:0 15px}.top-brand,.top-right{gap:10px}.topbar{font-size:10px}.sound-button{padding:8px}.eyebrow{font-size:8px}.intro{padding:36px 0 30px}.intro h1{font-size:clamp(58px,14vw,75px);margin:15px 0}.intro p{font-size:13px;max-width:260px;line-height:1.5}.arena-heading{font-size:8px}.arena-actions{gap:12px}.arena-actions button{font-size:9px}.arena-frame{padding:4px}.game-overlay{inset:5px;padding:14px}.overlay-mark{transform:scale(.75) rotate(-10deg);margin-bottom:12px}.overlay-eyebrow{font-size:9px}.overlay-content h2{font-size:36px;margin:10px 0}.overlay-content p{font-size:12px;margin-bottom:18px}.primary-button{height:44px;width:190px;font-size:10px}.overlay-hint{font-size:8px;margin-top:13px}.arena-caption{font-size:7px}.arena-caption span:last-child{display:none}.sidebar{display:block}.sidebar .side-rule{margin:25px 0}.sidebar-top{margin-bottom:15px}.big-score{font-size:66px}}
`;