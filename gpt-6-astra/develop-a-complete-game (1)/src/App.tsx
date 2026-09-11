import { useEffect, useRef, useState } from 'react';
import { OrbitGame, SECTORS, W, type Snapshot } from './game';

type IconName = 'sound' | 'mute' | 'help' | 'arrow' | 'pause' | 'restart' | 'heart' | 'expand' | 'clock' | 'close' | 'trophy' | 'play' | 'home';
function Icon({ name, size = 18, className = '' }: { name: IconName; size?: number; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    sound: <><path d="m11 4-6 5H2v6h3l6 5z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    mute: <><path d="m11 4-6 5H2v6h3l6 5z"/><path d="m16 9 6 6m0-6-6 6"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-1.1.7-1.8 1.1-1.8 2.8M12 17h.01"/></>,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6"/></>,
    pause: <><path d="M8 5v14M16 5v14"/></>,
    restart: <><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
    expand: <><path d="M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    trophy: <><path d="M7 3h10v6a5 5 0 0 1-10 0zM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 2v6m-4 0h8"/></>,
    play: <path d="m8 4 12 8-12 8z"/>,
    home: <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={name === 'heart' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{paths[name]}</svg>;
}
function OrbitalArt() {
  return <div className="orbital-art" aria-hidden="true">
    <svg viewBox="0 0 470 470" className="planet-svg">
      <defs><radialGradient id="planetFill" cx="28%" cy="25%"><stop offset="0" stopColor="#aec977" stopOpacity=".16"/><stop offset="1" stopColor="#b6da77" stopOpacity=".025"/></radialGradient><clipPath id="sphereClip"><circle cx="248" cy="241" r="111"/></clipPath><linearGradient id="orbitLine"><stop stopColor="#bfed88" stopOpacity=".08"/><stop offset=".5" stopColor="#d2fca5"/><stop offset="1" stopColor="#b9ec82" stopOpacity=".2"/></linearGradient></defs>
      <g transform="rotate(-25 248 241)"><circle cx="248" cy="241" r="111" fill="url(#planetFill)" stroke="#c7ec96" strokeWidth="1.2"/><g clipPath="url(#sphereClip)" fill="none" stroke="#c7ec96" strokeOpacity=".43" strokeWidth=".8"><ellipse cx="248" cy="241" rx="80" ry="111"/><ellipse cx="248" cy="241" rx="39" ry="111"/><path d="M248 130v222M137 241h222"/><ellipse cx="248" cy="195" rx="110" ry="28"/><ellipse cx="248" cy="239" rx="112" ry="35"/><ellipse cx="248" cy="284" rx="110" ry="28"/><ellipse cx="248" cy="151" rx="81" ry="18"/><ellipse cx="248" cy="329" rx="81" ry="18"/></g><ellipse cx="248" cy="241" rx="200" ry="53" fill="none" stroke="url(#orbitLine)" strokeWidth="1.5"/><ellipse cx="248" cy="241" rx="184" ry="63" fill="none" stroke="#bfe68e" strokeOpacity=".16" strokeDasharray="3 7"/><circle cx="62" cy="220" r="7" fill="#d0fa9c"/><circle cx="62" cy="220" r="13" fill="none" stroke="#c6ee93" strokeOpacity=".25"/></g>
      <g transform="rotate(-13 326 71)"><rect x="254" y="49" width="53" height="20" rx="3" fill="#bfe990"/><rect x="313" y="49" width="53" height="20" rx="3" fill="#899e7d"/><rect x="372" y="49" width="53" height="20" rx="3" fill="#526b57"/><rect x="284" y="76" width="53" height="20" rx="3" fill="#758d68"/><rect x="343" y="76" width="53" height="20" rx="3" fill="#b9cd9d"/></g>
      <g stroke="#c9ed9c" strokeWidth="1.5"><path d="M104 116v14m-7-7h14M382 333v12m-6-6h12M326 401v8m-4-4h8"/></g><circle cx="393" cy="156" r="2.5" fill="#c8eca3"/><circle cx="120" cy="335" r="2" fill="#c8eca3"/><path d="M160 390h58" stroke="#a9d37b" strokeWidth="6" strokeLinecap="round"/><circle cx="189" cy="372" r="4" fill="#e6ffd0"/>
      <text x="279" y="437" fill="#728570" fontSize="9" fontFamily="monospace" letterSpacing="2">LESS NOISE. MORE ORBIT.</text>
    </svg>
  </div>;
}
const initial: Snapshot = { mode: 'ready', score: 0, best: 0, sector: 1, lives: 3, destroyed: 0, total: 27, time: 0, docked: true, combo: 0, wide: 0, slow: 0 };
const number = (n: number) => n.toLocaleString('en-US').padStart(5, '0');
const time = (n: number) => `${Math.floor(n / 60).toString().padStart(2, '0')}:${Math.floor(n % 60).toString().padStart(2, '0')}`;
export default function App() {
  const canvas = useRef<HTMLCanvasElement>(null), engine = useRef<OrbitGame | null>(null);
  const [state, setState] = useState<Snapshot>(initial);
  const [sound, setSound] = useState(true), [help, setHelp] = useState(false), [restart, setRestart] = useState(false);
  const helpRef = useRef(false), restartRef = useRef(false), resumeAfterHelp = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null), previousFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const game = new OrbitGame(canvas.current!, setState); engine.current = game; setSound(game.sound);
    const keydown = (e: KeyboardEvent) => {
      if (helpRef.current || restartRef.current) return;
      if ((e.target as HTMLElement)?.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
      const key = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', ' ', 'p', 'escape', 'a', 'd'].includes(key)) e.preventDefault();
      game.keys.add(key);
      if (e.repeat) return;
      if (key === ' ') {
        if (game.state.mode === 'ready' || game.state.mode === 'lost' || game.state.mode === 'won') game.start();
        else if (game.state.mode === 'sector') game.next();
        else if (game.state.mode === 'paused') game.pause();
        else game.launch();
      }
      if (key === 'p' || key === 'escape') game.pause();
    };
    const keyup = (e: KeyboardEvent) => game.keys.delete(e.key.toLowerCase());
    const blur = () => { game.keys.clear(); if (game.state.mode === 'playing') game.pause(); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    return () => { game.destroy(); window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  const closeHelp = () => { setHelp(false); helpRef.current = false; if (resumeAfterHelp.current && engine.current?.state.mode === 'paused') engine.current.pause(); };
  const cancelRestart = () => { setRestart(false); restartRef.current = false; };
  useEffect(() => {
    if (!help && !restart) return;
    previousFocus.current = document.activeElement as HTMLElement;
    const el = dialogRef.current; const items = el?.querySelectorAll<HTMLElement>('button, [tabindex="0"]'); items?.[0]?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (helpRef.current) closeHelp(); else cancelRestart(); }
      if (e.key === 'Tab' && items?.length) { const first = items[0], last = items[items.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
    };
    window.addEventListener('keydown', trap); return () => { window.removeEventListener('keydown', trap); previousFocus.current?.focus(); };
  }, [help, restart]);
  const openHelp = () => { resumeAfterHelp.current = engine.current?.state.mode === 'playing'; if (resumeAfterHelp.current) engine.current?.pause(); helpRef.current = true; setHelp(true); };
  const requestRestart = () => { if (engine.current?.state.mode === 'playing') engine.current.pause(); restartRef.current = true; setRestart(true); };
  const start = () => { engine.current?.start(); (document.activeElement as HTMLElement)?.blur(); };
  const next = () => { engine.current?.next(); (document.activeElement as HTMLElement)?.blur(); };
  const active = state.mode === 'playing' || state.mode === 'paused';
  const progress = Math.round(state.destroyed / state.total * 100);
  const movePaddle = (e: React.PointerEvent<HTMLCanvasElement>) => { const r = e.currentTarget.getBoundingClientRect(); engine.current?.move((e.clientX - r.left) / r.width * W); };
  return <div className="app-shell">
    <header className="site-header"><a className="brand" href="./" aria-label="Orbit Arcade home"><span className="brand-mark"><i/><i/><i/><i/></span><span>orbit<span className="brand-light">arcade</span><span className="brand-dot">®</span></span></a><div className="header-center"><span className="status-dot"/> SMALL GAMES. GOOD TIMES.</div><nav aria-label="Game utilities"><button className="sound-button" onClick={() => { engine.current?.setSound(!sound); setSound(!sound); }} aria-label={sound ? 'Mute sound' : 'Enable sound'} aria-pressed={sound}><Icon name={sound ? 'sound' : 'mute'}/><span>Sound {sound ? 'on' : 'off'}</span></button><span className="nav-divider"/><button className="help-button" onClick={openHelp}><Icon name="help"/><span>How to play</span></button></nav></header>
    <main>
      <section className="page-intro"><div><div className="eyebrow"><span className="tiny-star">✳</span> YOUR NEXT FIVE-MINUTE OBSESSION</div><h1>Enter your flow state<span>.</span></h1></div><p>A familiar classic. A fresh little universe.<br/>Just you, a paddle, and one more try.</p></section>
      <div className="game-layout">
        <section className="game-panel" aria-label="Orbit Breaker game">
          <div className="game-topbar"><div className="game-title"><span className="orbit-mini">◎</span><h2>ORBIT BREAKER</h2><span className="edition">01</span></div><div className="game-top-right"><span className="classic-label"><span/> CLASSIC MODE</span><div className="game-actions"><button title={state.mode === 'paused' ? 'Resume (P)' : 'Pause (P)'} aria-label={state.mode === 'paused' ? 'Resume game' : 'Pause game'} disabled={!active} onClick={() => engine.current?.pause()}><Icon name={state.mode === 'paused' ? 'play' : 'pause'} size={16}/></button><button title="Restart game" aria-label="Restart game" disabled={state.mode === 'ready'} onClick={requestRestart}><Icon name="restart" size={16}/></button></div></div></div>
          <div className={`arena-stage ${state.mode === 'ready' ? 'is-ready' : ''}`}>
            <canvas ref={canvas} aria-label="Brick breaker playfield. Use your mouse, touch, or arrow keys to move. Space to launch, P to pause." onPointerMove={movePaddle} onPointerDown={e => { movePaddle(e); e.currentTarget.setPointerCapture(e.pointerId); engine.current?.launch(); }} />
            {state.mode === 'ready' && <div className="start-screen"><div className="start-copy"><div className="game-eyebrow"><span/> THE CLASSIC. RECHARGED.</div><h3>BREAK OUT.<br/><span>ZONE IN.</span></h3><p>Clear the bricks. Catch the power-ups.<br/>Keep the good thing going.</p><button className="primary-button start-button" onClick={start}>Let's play <Icon name="arrow" size={20}/></button><div className="start-meta"><span>5 sectors</span><i/><span>3 lives</span><i/><span>Endless “one more”</span></div></div><OrbitalArt/><span className="arena-coordinate">EST. 2026 / NO DOWNLOADS. JUST PLAY.</span><span className="corner-cross">+</span></div>}
            {state.mode === 'playing' && <><div className="live-sector">SECTOR 0{state.sector} <span>/ {SECTORS[state.sector - 1].toUpperCase()}</span></div>{(state.wide > 0 || state.slow > 0) && <div className="active-powers">{state.wide > 0 && <span><Icon name="expand" size={13}/> WIDE {Math.ceil(state.wide)}s</span>}{state.slow > 0 && <span><Icon name="clock" size={13}/> SLOW {Math.ceil(state.slow)}s</span>}</div>}</>}
            {state.mode === 'paused' && <div className="state-overlay"><div className="overlay-symbol"><Icon name="pause" size={25}/></div><div className="game-eyebrow">TAKE A BREATHER</div><h3>Orbit on hold.</h3><p>Your universe will be right here.</p><button className="primary-button" onClick={() => engine.current?.pause()}>Back to it <Icon name="play" size={17}/></button><button className="text-button" onClick={requestRestart}><Icon name="restart" size={14}/> Start a fresh run</button></div>}
            {state.mode === 'sector' && <div className="state-overlay"><div className="overlay-symbol">✳</div><div className="game-eyebrow">SECTOR 0{state.sector} COMPLETE</div><h3>Space, cleared.</h3><p>+{500 * state.sector} sector bonus. Your next orbit awaits.</p><div className="result-score">{number(state.score)}<span>POINTS SO FAR</span></div><button className="primary-button" onClick={next}>Enter sector 0{state.sector + 1} <Icon name="arrow"/></button><small className="next-sector">{SECTORS[state.sector]} · {state.sector >= 2 ? 'Armored bricks ahead' : 'More bricks. More momentum.'}</small></div>}
            {(state.mode === 'lost' || state.mode === 'won') && <div className="state-overlay"><div className="overlay-symbol"><Icon name={state.mode === 'won' ? 'trophy' : 'heart'} size={26}/></div><div className="game-eyebrow">{state.mode === 'won' ? 'ALL FIVE SECTORS COMPLETE' : 'END OF ORBIT. NOT THE END.'}</div><h3>{state.mode === 'won' ? 'Universe conquered.' : 'One more orbit?'}</h3><p>{state.mode === 'won' ? 'A clear universe. A very well-earned high five.' : 'Every great run starts with another try.'}</p><div className="result-score">{number(state.score)}<span>{state.score > 0 && state.score >= state.best ? 'YOUR PERSONAL BEST ✦' : 'FINAL SCORE'}</span></div><div className="result-details"><span>Sector 0{state.sector} / 05</span><span>{time(state.time)} flight time</span></div><button className="primary-button" onClick={start}>Play again <Icon name="restart" size={18}/></button><button className="text-button" onClick={() => engine.current?.menu()}>Back to the launchpad</button></div>}
          </div>
          <div className="game-bottom-bar"><div className="control-hint"><span className="mouse-outline"/><span>Move mouse</span><span className="or">or</span><kbd>←</kbd><kbd>→</kbd><span>to move</span></div><div className="control-hint"><kbd className="space-key">space</kbd><span>to launch</span><span className="bottom-divider"/><kbd>P</kbd><span>to pause</span></div><span className="touch-hint">Drag to move · Tap to launch</span></div>
        </section>
        <aside className="sidebar">
          <section className="telemetry-card"><div className="card-heading"><h2>YOUR MISSION</h2><span className={`live-indicator ${state.mode === 'playing' ? 'live' : ''}`}>{state.mode === 'ready' ? 'STANDBY' : state.mode === 'playing' ? 'LIVE' : state.mode === 'won' ? 'COMPLETE' : state.mode === 'lost' ? 'FINISHED' : 'ON HOLD'}</span></div><div className="score-label">SCORE <span><Icon name="clock" size={12}/>{time(state.time)}</span></div><div className="score-value">{number(state.score)}</div><div className="lives-row"><span>LIVES</span><div aria-label={`${state.lives} lives remaining`}>{Array.from({ length: Math.max(3, state.lives) }, (_, i) => <Icon key={i} name="heart" size={19} className={i < state.lives ? '' : 'empty-heart'}/>)}</div></div><div className="sector-info"><div><span>SECTOR</span><strong>0{state.sector}<small> / 05</small></strong></div><span className="sector-orbit">◎</span></div><div className="sector-name">{SECTORS[state.sector - 1]}<span>{progress}%</span></div><div className="progress-track" role="progressbar" aria-label="Sector cleared" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div style={{ width: `${progress}%` }}/></div><div className="brick-count">{state.destroyed} of {state.total} bricks cleared</div></section>
          <section className="power-card"><div className="card-heading"><h2>A LITTLE EXTRA POWER</h2><span className="small-plus">+</span></div><div className={`power-row ${state.wide > 0 ? 'power-on' : ''}`}><span className="power-icon green"><Icon name="expand" size={20}/></span><div><h3>Wide paddle {state.wide > 0 && <em>{Math.ceil(state.wide)}s</em>}</h3><p>A little more room for error.</p></div></div><div className={`power-row ${state.slow > 0 ? 'power-on' : ''}`}><span className="power-icon purple"><Icon name="clock" size={19}/></span><div><h3>Slow motion {state.slow > 0 && <em>{Math.ceil(state.slow)}s</em>}</h3><p>Find a calmer kind of chaos.</p></div></div><div className="power-row"><span className="power-icon peach"><Icon name="heart" size={17}/></span><div><h3>Extra life</h3><p>Because we all need a second.</p></div></div><div className="power-note">Catch the falling icons to power up.</div></section>
          <section className="best-card"><span className="trophy-icon"><Icon name="trophy" size={21}/></span><div><span>PERSONAL BEST</span><strong>{number(state.best)}</strong></div><span className="saved-tag">SAVED<br/>LOCALLY ↗</span></section>
        </aside>
      </div>
      <section className="quick-guide" aria-label="Quick game guide"><div className="guide-item"><span className="guide-number">01</span><div><h3>Keep it in play.</h3><p>Move your paddle. Don't let the ball drop.</p></div><span className="guide-art paddle-art"><i/></span></div><div className="guide-item"><span className="guide-number">02</span><div><h3>Make a clean break.</h3><p>Clear every brick to unlock the next sector.</p></div><span className="guide-art bricks-art"><i/><i/><i/><i/><i/><i/></span></div><div className="guide-item"><span className="guide-number">03</span><div><h3>Get into the rhythm.</h3><p>Chain your hits. Chase your personal best.</p></div><span className="guide-art combo-art">×5</span></div></section>
      <footer><span><span className="footer-star">✳</span> BUILT FOR THE JOY OF IT.</span><p>No sign-ups. No leaderboards. Just your next best.</p><span className="footer-version">ORBIT ARCADE <i/> V.1.0</span></footer>
    </main>
    {(help || restart) && <div className="modal-backdrop" onPointerDown={e => { if (e.target === e.currentTarget) { if (help) closeHelp(); else cancelRestart(); } }}><div className="modal" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><button className="modal-close" aria-label="Close dialog" onClick={help ? closeHelp : cancelRestart}><Icon name="close"/></button>{help ? <><div className="eyebrow">A QUICK FLIGHT MANUAL</div><h2 id="dialog-title">Small paddle. Big mission.</h2><p className="modal-intro">Break every brick across all five sectors to win. You have three lives to get there. Make them count.</p><div className="help-controls"><div><kbd>←</kbd><kbd>→</kbd><span>Move · or use your mouse / drag on touch</span></div><div><kbd>space</kbd><span>Launch the ball · or click / tap the arena</span></div><div><kbd>P</kbd><kbd>esc</kbd><span>Pause and resume your game</span></div></div><div className="help-tips"><h3>A few things worth knowing</h3><p><b>Find your angle.</b> The edge of the paddle sends the ball sideways. The center sends it upward.</p><p><b>Keep the streak.</b> Each brick is worth 100 points. Consecutive hits before the paddle build a multiplier, up to 5×.</p><p><b>Catch a boost.</b> Every seventh broken brick drops a power-up: wide paddle (14s), slow motion (12s), or an extra life (up to 5).</p><p><b>Go deeper.</b> Each sector is faster. From sector 3, armored bricks take two hits. Clearing a sector earns 500 × sector bonus points.</p></div><button className="primary-button modal-primary" onClick={closeHelp}>Got it. Let's orbit. <Icon name="arrow"/></button></> : <><div className="eyebrow">A FRESH START</div><h2 id="dialog-title">Reset your orbit?</h2><p className="modal-intro">Your current run will end and you'll return to sector 01 with three lives. Your personal best stays safe.</p><div className="modal-buttons"><button className="secondary-button" onClick={cancelRestart}>Keep this run</button><button className="primary-button" onClick={() => { cancelRestart(); start(); }}>Start fresh <Icon name="restart" size={17}/></button></div></>}</div></div>}
  </div>;
}
