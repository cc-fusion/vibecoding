import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { Icon } from './components/Icon';
import { Guide, type GuideTab, downloadText } from './components/Guide';
import { Simulation, defaults, type Preset, type Settings, type Stats } from './simulation/engine';
import { draw, screenToWorld, type ViewMode, type ViewSettings } from './simulation/renderer';

function Range({ label, value, min, max, step = 1, display, onChange, left, right }: { label: string; value: number; min: number; max: number; step?: number; display: string; onChange: (n: number) => void; left?: string; right?: string }) {
  return <div className="range-control"><div className="control-label"><label>{label}</label><output>{display}</output></div><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} style={{ '--range-progress': `${(value - min) / (max - min) * 100}%` } as CSSProperties}/>{left && <div className="range-ends"><span>{left}</span><span>{right}</span></div>}</div>;
}
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) { return <button className={`toggle ${checked ? 'on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span/></button>; }
const initialStats: Stats = { time: 0, stepMs: 0, fps: 60, dt: 1 / 120, cfl: 0, residual: 0, iterations: 0, contacts: 0, momentumError: 0, penetration: 0, divergenceBefore: 0, divergenceAfter: 0, steps: 2 };
const presets: Preset[] = ['Wave tank', 'Dam break', 'Buoyancy test', 'Zero gravity'];
const timeLabel = (time: number) => `${String(Math.floor(time / 60)).padStart(2, '0')}:${(time % 60).toFixed(2).padStart(5, '0')}`;

export default function App() {
  const [settings, setSettings] = useState<Settings>({ ...defaults });
  const [running, setRunning] = useState(true), [preset, setPreset] = useState<Preset>('Wave tank');
  const [particleCount, setParticleCount] = useState(4096), [stats, setStats] = useState(initialStats);
  const [view, setView] = useState<ViewSettings>({ grid: false, mesh: true, mode: 'Particles', trails: false });
  const [guide, setGuide] = useState<GuideTab | null>(null), [advanced, setAdvanced] = useState(false);
  const [toast, setToast] = useState(''), [fullscreen, setFullscreen] = useState(false), [tool, setTool] = useState<'interact' | 'stir'>('interact');
  const [displayMenu, setDisplayMenu] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null), workspaceRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<Simulation | null>(null);
  if (!simRef.current) simRef.current = new Simulation();
  const runningRef = useRef(running), viewRef = useRef(view), guideRef = useRef(guide);
  runningRef.current = running; viewRef.current = view; guideRef.current = guide;
  const pointerRef = useRef<{ x: number; y: number; down: boolean }>({ x: 0, y: 0, down: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notify = useCallback((message: string) => { setToast(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 3000); }, []);
  const closeGuide = useCallback(() => setGuide(null), []);
  useEffect(() => { if (simRef.current) simRef.current.settings = { ...settings }; }, [settings]);
  useEffect(() => {
    let id = 0, last = performance.now(), lastStats = 0, smoothedFPS = 60;
    const frame = (now: number) => {
      const elapsed = (now - last) / 1000; last = now;
      if (elapsed > 0) smoothedFPS += (Math.min(120, 1 / elapsed) - smoothedFPS) * 0.04;
      const sim = simRef.current;
      if (sim && canvasRef.current) {
        if (runningRef.current && !guideRef.current && !document.hidden) {
          sim.advance(Math.min(elapsed, 1 / 30));
          if (sim.failure) { runningRef.current = false; setRunning(false); notify(sim.failure); }
        }
        draw(canvasRef.current, sim, viewRef.current);
        if (now - lastStats > 350) { setStats(sim.stats(Math.round(smoothedFPS))); lastStats = now; }
      }
      id = requestAnimationFrame(frame);
    };
    id = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(id); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (guideRef.current || (e.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName))) return; if (e.code === 'Space') { e.preventDefault(); setRunning(r => !r); } };
    const full = () => setFullscreen(!!document.fullscreenElement);
    window.addEventListener('keydown', key); document.addEventListener('fullscreenchange', full);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('fullscreenchange', full); };
  }, []);
  const update = <K extends keyof Settings,>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }));
  const reset = (nextPreset = preset, nextSettings = settings, count = particleCount, message = 'Scene reset. A fresh start.') => {
    simRef.current = new Simulation(nextSettings, nextPreset, count); setStats(initialStats); notify(message);
  };
  const choosePreset = (next: Preset) => {
    const nextSettings = { ...settings, gravity: next === 'Zero gravity' ? 0 : 9.81 };
    setPreset(next); setSettings(nextSettings); reset(next, nextSettings, particleCount, `${next} loaded. Make some waves.`);
  };
  const singleStep = () => { setRunning(false); simRef.current?.advance(1 / 60); if (simRef.current) setStats(simRef.current.stats(stats.fps)); };
  const exportSnapshot = () => { const canvas = canvasRef.current; if (!canvas) return; const a = document.createElement('a'); a.download = `flux-${preset.toLowerCase().replace(/ /g, '-')}-${stats.time.toFixed(1)}s.png`; a.href = canvas.toDataURL('image/png'); a.click(); notify('Snapshot exported as PNG.'); };
  const toggleFullscreen = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await workspaceRef.current?.requestFullscreen(); } catch { notify('Fullscreen is not available in this browser.'); } };
  const pointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current, sim = simRef.current; if (!canvas || !sim) return;
    const p = screenToWorld(canvas, sim, e.clientX, e.clientY); pointerRef.current = { ...p, down: true }; canvas.setPointerCapture(e.pointerId);
    if (tool === 'interact' && sim.solid.contains(p.x, p.y)) {
      let nearest = 0, d = Infinity; sim.solid.nodes.forEach((n, i) => { const nd = Math.hypot(n.x - p.x, n.y - p.y); if (nd < d) { d = nd; nearest = i; } }); sim.drag = { ...p, node: nearest };
    } else sim.stir(p.x, p.y, 0, 0.09);
  };
  const pointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current, sim = simRef.current; if (!canvas || !sim || !pointerRef.current.down) return;
    const p = screenToWorld(canvas, sim, e.clientX, e.clientY), last = pointerRef.current;
    p.x = Math.max(0.15, Math.min(sim.width - 0.15, p.x)); p.y = Math.max(0.15, Math.min(sim.height - 0.15, p.y));
    if (sim.drag) { sim.drag.x = p.x; sim.drag.y = p.y; } else sim.stir(p.x, p.y, p.x - last.x, p.y - last.y);
    pointerRef.current = { ...p, down: true };
  };
  const pointerUp = () => { pointerRef.current.down = false; if (simRef.current) simRef.current.drag = undefined; };
  const restoreDefaults = () => { const next = { ...defaults }; setSettings(next); setParticleCount(4096); setPreset('Wave tank'); setView({ grid: false, mesh: true, mode: 'Particles', trails: false }); reset('Wave tank', next, 4096, 'Default settings restored.'); };

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setGuide(null); }} aria-label="Flux playground"><span className="brand-mark"><svg viewBox="0 0 32 32" fill="none"><path d="M5 18c5-12 11 12 21-4M5 11c5-12 11 12 21-4M5 25c5-12 11 12 21-4" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round"/></svg></span><span className="brand-name">flux<span className="brand-period">.</span></span><span className="brand-divider"/><span className="brand-descriptor">A PHYSICS PLAYGROUND</span></a>
      <nav className="main-nav" aria-label="Main navigation"><button className={!guide ? 'active' : ''} onClick={() => setGuide(null)}>Playground</button><button className={guide === 'Overview' ? 'active' : ''} onClick={() => setGuide('Overview')}>How it works</button><button className={guide === 'Numerics' ? 'active' : ''} onClick={() => setGuide('Numerics')}>Documentation <Icon name="arrow" size={13}/></button></nav>
      <button className="source-button" onClick={() => setGuide('Source')}><Icon name="code" size={17}/><span>View source</span><Icon name="arrow" size={14}/></button>
    </div></header>
    <main className="page-content">
      <section className="page-heading"><div><div className="eyebrow"><span className="tiny-spark">✳</span> REAL-TIME FLUID × SOFT BODY</div><h1>Fluid meets form<span>.</span></h1><p>Make waves. Bend the rules. Explore the physics in between.</p></div><div className="heading-aside"><span className="browser-badge"><span className="status-dot"/> Running in your browser</span><span className="heading-meta">No installs. Just a little curiosity.</span></div></section>
      <div className="lab-layout">
        <div className="workspace-column">
          <section className={`workspace ${fullscreen ? 'is-fullscreen' : ''}`} ref={workspaceRef} aria-label="Interactive fluid simulation">
            <div className="workspace-toolbar"><div className="workspace-title"><span className="workspace-dot"/><h2>Simulation workspace</h2><span className="dimension-badge">2D</span></div><div className="workspace-actions"><div className="view-select"><Icon name="dots" size={15}/><select aria-label="Visualization mode" value={view.mode} onChange={e => setView(v => ({ ...v, mode: e.target.value as ViewMode }))}>{(['Particles', 'Surface', 'Velocity', 'Pressure'] as ViewMode[]).map(v => <option key={v}>{v}</option>)}</select><Icon name="chevron" size={12}/></div><span className="toolbar-divider"/><button className={`icon-button ${view.grid ? 'selected' : ''}`} title="Toggle grid" aria-label="Toggle grid" aria-pressed={view.grid} onClick={() => setView(v => ({ ...v, grid: !v.grid }))}><Icon name="grid" size={17}/></button><button className="icon-button snapshot-button" title="Export PNG snapshot" aria-label="Export PNG snapshot" onClick={exportSnapshot}><Icon name="camera" size={17}/></button><button className="icon-button" title="Fullscreen" aria-label="Toggle fullscreen" onClick={toggleFullscreen}><Icon name="expand" size={17}/></button></div></div>
            <div className="canvas-container"><canvas ref={canvasRef} aria-label="Real-time FLIP fluid and deformable solid. Drag the water to stir; drag the green solid to deform it." onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/>
              <div className="canvas-topline"><div className="solver-badges"><span>FLIP <span className="badge-plus">+</span> XPBD</span><span className="coupled-badge"><span className={`status-dot ${!settings.coupling ? 'off' : ''}`}/>{settings.coupling ? 'Two-way coupled' : 'Uncoupled'}</span></div><div className="canvas-legend"><span><i className="fluid-dot"/>Fluid</span><span><i className="solid-dot"/>Soft body</span></div></div>
              <div className="canvas-tools"><button className={tool === 'interact' ? 'active' : ''} title="Interact with fluid or drag the solid" aria-label="Interaction tool" aria-pressed={tool === 'interact'} onClick={() => setTool('interact')}><Icon name="cursor" size={17}/></button><button className={tool === 'stir' ? 'active' : ''} title="Stir fluid" aria-label="Stir tool" aria-pressed={tool === 'stir'} onClick={() => setTool('stir')}><Icon name="wind" size={18}/></button><span/><button title="Make a wave" aria-label="Make a wave" onClick={() => { simRef.current?.splash(); notify('A little energy. A whole new wave.'); }}><Icon name="wave" size={18}/></button></div>
              <div className="canvas-instruction"><Icon name="cursor" size={12}/>{simRef.current?.failure ? 'Safety paused · Reset the scene to continue' : running ? (tool === 'stir' ? 'Click & drag to stir the fluid' : 'Drag to stir · Grab the solid to deform') : 'Paused · Press space to keep exploring'}</div>
              <div className="canvas-coordinate">10.0 × 5.5 m</div>
            </div>
            <div className="playback-bar"><div className="playback-left"><button className="play-button" onClick={() => setRunning(r => !r)} title="Play / pause (Space)" aria-label={running ? 'Pause simulation' : 'Play simulation'}><Icon name={running ? 'pause' : 'play'} size={17}/><span>{running ? 'Pause' : 'Play'}</span></button><button className="icon-button" title="Reset simulation" aria-label="Reset simulation" onClick={() => reset()}><Icon name="reset" size={17}/></button><button className="icon-button" title="Advance one frame" aria-label="Advance one frame" onClick={singleStep}><Icon name="step" size={17}/></button><span className="toolbar-divider"/><button className="speed-button" title="Change playback speed" onClick={() => { const speeds = [0.25, 0.5, 1, 1.5, 2]; update('speed', speeds[(speeds.indexOf(settings.speed) + 1) % speeds.length]); }}>{settings.speed}×<Icon name="chevron" size={11}/></button></div><div className="playback-right"><div className="time-counter"><Icon name="clock" size={14}/><span>{timeLabel(stats.time)}</span><small>s</small></div><span className="toolbar-divider"/><span className={`fps-badge ${!running ? 'paused' : ''}`}><span className="status-dot"/>{running ? `${stats.fps} FPS` : 'PAUSED'}</span></div></div>
          </section>
          <div className="metrics-row"><div className="metric-card"><div className="metric-label"><Icon name="dots" size={15}/>Fluid particles</div><div className="metric-value">{particleCount.toLocaleString()}</div><div className="metric-detail">A little organized chaos</div></div><div className="metric-card"><div className="metric-label"><Icon name="grid" size={15}/>Grid resolution</div><div className="metric-value">80 <span className="metric-cross">×</span> 44</div><div className="metric-detail">Staggered MAC grid</div></div><button className="metric-card metric-interactive" onClick={() => setGuide('Overview')}><div className="metric-label"><Icon name="link" size={15}/>Coupling</div><div className="metric-value coupling-value">{settings.coupling ? 'Two-way' : 'Disabled'}<span className={`status-dot ${!settings.coupling ? 'off' : ''}`}/></div><div className="metric-detail">{settings.coupling ? 'Both sides have a say' : 'Independent systems'}<Icon name="arrow" size={12}/></div></button><button className="metric-card metric-interactive" onClick={() => setGuide('Diagnostics')}><div className="metric-label"><Icon name="activity" size={15}/>Solver time</div><div className="metric-value">{stats.stepMs.toFixed(1)} <span className="metric-unit">ms</span></div><div className="metric-detail">Per rendered frame<Icon name="arrow" size={12}/></div></button></div>
          <div className="method-card"><div className="method-icon"><Icon name="cube" size={26}/><span className="method-orbit"/></div><div className="method-copy"><h3>Two systems. One conversation.</h3><p>The fluid pushes the solid. The solid pushes back.<br className="method-break"/> Real two-way coupling, in every single step.</p></div><button onClick={() => setGuide('Overview')}>Explore the method<Icon name="arrow" size={16}/></button></div>
        </div>
        <aside className="controls-panel" aria-label="Simulation controls"><div className="controls-heading"><div><h2>Simulation controls</h2><p>Your experiment. Your rules.</p></div><Icon name="sliders" size={20}/></div>
          <div className="preset-section"><label htmlFor="scene-preset">SCENE PRESET</label><div className="preset-select"><span className="preset-icon"><Icon name={preset === 'Zero gravity' ? 'globe' : preset === 'Buoyancy test' ? 'cube' : 'wave'} size={21}/></span><select id="scene-preset" value={preset} onChange={e => choosePreset(e.target.value as Preset)}>{presets.map(p => <option key={p}>{p}</option>)}</select><Icon name="chevron" size={15}/></div></div>
          <section className="parameter-section"><div className="section-heading"><span><Icon name="drop" size={15}/>FLUID</span><span className="mini-tag blue">FLIP</span></div><Range label="FLIP ratio" value={settings.flip} min={0.75} max={0.99} step={0.01} display={`${Math.round(settings.flip * 100)}%`} onChange={v => update('flip', v)} left="Smoother" right="More lively"/><div className="inline-control"><label htmlFor="particle-count">Particle count</label><div className="compact-select"><select id="particle-count" value={particleCount} onChange={e => { const n = Number(e.target.value); setParticleCount(n); reset(preset, settings, n, `Scene reseeded with ${n.toLocaleString()} particles.`); }}><option value={2048}>2,048</option><option value={4096}>4,096</option><option value={6144}>6,144</option></select><Icon name="chevron" size={12}/></div></div></section>
          <section className="parameter-section"><div className="section-heading"><span><Icon name="cube" size={15}/>SOFT BODY</span><span className="mini-tag green">XPBD</span></div><Range label="Stiffness" value={settings.stiffness} min={0.1} max={1} step={0.01} display={settings.stiffness.toFixed(2)} onChange={v => update('stiffness', v)} left="Jelly" right="Rigid"/><Range label="Density" value={settings.density} min={400} max={1600} step={25} display={`${settings.density} kg/m³`} onChange={v => update('density', v)}/><div className="inline-control coupling-control"><span>Two-way coupling <button className="inline-info" title="How two-way coupling works" aria-label="About two-way coupling" onClick={() => setGuide('Overview')}><Icon name="info" size={12}/></button></span><Toggle label="Two-way coupling" checked={settings.coupling} onChange={() => update('coupling', !settings.coupling)}/></div></section>
          <section className="parameter-section solver-section"><div className="section-heading"><span><Icon name="sliders" size={15}/>WORLD & SOLVER</span><Icon name="shield" size={14}/></div><Range label="Gravity" value={settings.gravity} min={0} max={20} step={0.01} display={`${settings.gravity.toFixed(2)} m/s²`} onChange={v => update('gravity', v)}/><div className="inline-control"><span>Substeps</span><div className="segmented-control">{[2, 3, 4].map(n => <button className={settings.substeps === n ? 'active' : ''} onClick={() => update('substeps', n)} key={n} aria-label={`${n} nominal substeps`} aria-pressed={settings.substeps === n}>{n}</button>)}</div></div><button className={`advanced-button ${advanced ? 'expanded' : ''}`} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}>Advanced settings<Icon name="chevron" size={13}/></button>{advanced && <div className="advanced-settings"><Range label="Pressure iterations" value={settings.iterations} min={30} max={120} step={10} display={String(settings.iterations)} onChange={v => update('iterations', v)}/><div className="advanced-note"><Icon name="shield" size={13}/><span>Adaptive CFL ≤ 0.4<br/>Maximum 8 substeps / frame</span></div><button className="export-settings" onClick={() => { downloadText('flux-experiment.json', JSON.stringify({ version: 1, preset, particleCount, settings, view }, null, 2), 'application/json'); notify('Experiment settings exported.'); }}><Icon name="download" size={13}/>Export experiment settings</button></div>}</section>
          <div className="controls-bottom"><button className="restore-button" onClick={restoreDefaults}><Icon name="reset" size={14}/>Restore defaults</button><span><Icon name="shield" size={12}/>Stability comes first.</span></div>
        </aside>
      </div>
      <footer className="page-footer"><span><span className="footer-mark">✳</span> A little playground for a world in motion.</span><div><button onClick={() => setGuide('Numerics')}><Icon name="book" size={14}/>Solver notes</button><span className="footer-separator">/</span><div className="display-options"><button aria-expanded={displayMenu} onClick={() => setDisplayMenu(!displayMenu)}><Icon name="eye" size={14}/>Display options<Icon name="chevron" size={11}/></button>{displayMenu && <div className="display-popover"><h4>Make it your view</h4><div><span>Solid mesh</span><Toggle label="Show solid mesh" checked={view.mesh} onChange={() => setView(v => ({ ...v, mesh: !v.mesh }))}/></div><div><span>Velocity trails</span><Toggle label="Show velocity trails" checked={view.trails} onChange={() => setView(v => ({ ...v, trails: !v.trails }))}/></div><div><span>Grid overlay</span><Toggle label="Show grid overlay" checked={view.grid} onChange={() => setView(v => ({ ...v, grid: !v.grid }))}/></div></div>}</div><span className="version">v1.0</span></div></footer>
    </main>
    {toast && <div className="toast" role="status"><span className="toast-check"><Icon name="check" size={14}/></span>{toast}<button onClick={() => setToast('')} aria-label="Dismiss notification"><Icon name="close" size={14}/></button></div>}
    {guide && <Guide initialTab={guide} onClose={closeGuide} stats={stats}/>}
  </div>;
}
