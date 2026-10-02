import { useEffect, useRef, useState } from 'react';
import { Game } from '../game/engine';
import type { GameConfig, Result, Snap } from '../game/engine';
import type { AudioEngine } from '../game/audio';
import { Renderer, computeLayout, tileAt } from '../game/render';
import type { Layout } from '../game/render';
import { TOOLS, SCENARIOS } from '../game/data';
import type { ToolId } from '../game/data';
import type { Settings } from '../game/storage';
import { TopBar, Palette, SidePanel, OmenBar } from './Hud';
import { PauseMenu, EndScreen } from './Overlays';

const DRAGGABLE = new Set<ToolId>(['canal', 'bridge', 'drain', 'house', 'farm', 'demolish']);

interface Props {
  cfg: GameConfig; audio: AudioEngine; settings: Settings; onSettings: (s: Settings) => void;
  onFinish: (r: Result) => number; onRestart: () => void; onNext?: () => void; onQuit: () => void; onLegacy: () => void;
}

export function GameView({ cfg, audio, settings, onSettings, onFinish, onRestart, onNext, onQuit, onLegacy }: Props) {
  const [game] = useState(() => new Game(cfg, audio));
  const [renderer] = useState(() => new Renderer());
  const [snap, setSnap] = useState<Snap>(() => game.snapshot());
  const [tab, setTab] = useState<'city' | 'tech' | 'log'>('city');
  const [menu, setMenu] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [savedLP, setSavedLP] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const layout = useRef<Layout>({ ts: 20, ox: 0, oy: 0, cw: 800, ch: 500 });
  const dprRef = useRef(1);
  const menuRef = useRef(false);
  const finished = useRef(false);
  const dragRef = useRef<{ tool: ToolId; last: number } | null>(null);
  const finishCb = useRef(onFinish);
  finishCb.current = onFinish;

  const refresh = () => setSnap(game.snapshot());

  useEffect(() => { game.settingsShake = settings.shake; }, [game, settings.shake]);

  const openMenu = () => { if (game.status !== 'playing') return; game.paused = true; menuRef.current = true; setMenu(true); audio.sfx('click'); refresh(); };
  const closeMenu = () => { game.paused = false; menuRef.current = false; setMenu(false); audio.resume(); audio.sfx('click'); refresh(); };

  // main loop
  useEffect(() => {
    audio.setMood(0, 0);
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0, alive = true, last = performance.now(), lastSnap = 0;
    const resize = () => {
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      dprRef.current = dpr;
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      layout.current = computeLayout(r.width, r.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const frame = (now: number) => {
      if (!alive) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      game.update(dt);
      renderer.draw(ctx, game, layout.current, dprRef.current);
      if (game.status !== 'playing' && game.result && !finished.current) {
        finished.current = true;
        setSavedLP(finishCb.current(game.result));
        setSnap(game.snapshot());
      }
      if (now - lastSnap > 110) { lastSnap = now; setSnap(game.snapshot()); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const onBlur = () => { if (game.status === 'playing' && !game.paused) { game.paused = true; menuRef.current = true; setMenu(true); } };
    const onVis = () => { if (document.hidden) { onBlur(); audio.suspend(); } else audio.resume(); };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect();
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      audio.setMood(0, 0);
    };
  }, [game, renderer, audio]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const k = e.key.toLowerCase();
      if (game.status !== 'playing') return;
      if (k === 'escape' || k === 'p' || k === ' ') {
        e.preventDefault();
        if (menuRef.current) closeMenu(); else openMenu();
        return;
      }
      if (menuRef.current) return;
      if (k === 'h') toggleOverlay('height');
      else if (k === 'c') toggleOverlay('health');
      else if (k === 'v') toggleOverlay('happy');
      else if (k === 't') setTab('tech');
      else if (k === 'r') rotate();
      else if (k === 's') { game.setSpeed(game.speed >= 3 ? 1 : game.speed + 1); audio.sfx('click'); refresh(); }
      else {
        const t = TOOLS.find(x => x.key.toLowerCase() === k);
        if (t) pick(t.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const pick = (t: ToolId) => { game.tool = t; audio.sfx('click'); refresh(); };
  const toggleOverlay = (o: 'none' | 'height' | 'health' | 'happy') => { game.overlay = game.overlay === o ? 'none' : o; audio.sfx('click'); refresh(); };
  const rotate = () => { game.pumpDir = (game.pumpDir + 1) % 4; audio.sfx('toggle'); refresh(); };
  const tileOf = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return tileAt(layout.current, e.clientX - r.left, e.clientY - r.top);
  };
  const onDown = (e: React.PointerEvent) => {
    audio.init();
    if (menuRef.current) return;
    e.preventDefault();
    try { canvasRef.current?.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const i = tileOf(e);
    game.hover = i;
    const tool: ToolId = e.button === 2 ? 'demolish' : game.tool;
    game.act(i, tool, false);
    dragRef.current = DRAGGABLE.has(tool) && i >= 0 ? { tool, last: i } : null;
    refresh();
  };
  const onMove = (e: React.PointerEvent) => {
    const i = tileOf(e);
    game.hover = i;
    const d = dragRef.current;
    if (d && i >= 0 && i !== d.last) {
      let x0 = d.last % 36, y0 = Math.floor(d.last / 36);
      const x1 = i % 36, y1 = Math.floor(i / 36);
      const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx - dy, guard = 0;
      while ((x0 !== x1 || y0 !== y1) && guard++ < 80) {
        const e2 = 2 * err;
        if (e2 > -dy) { err -= dy; x0 += sx; }
        if (e2 < dx) { err += dx; y0 += sy; }
        game.act(y0 * 36 + x0, d.tool, true);
      }
      d.last = i;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { canvasRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    refresh();
  };

  const r = game.result;
  const showEnd = snap.status !== 'playing' && r;
  const sc = SCENARIOS[cfg.scenario];

  return (
    <div className="water-bg absolute inset-0 flex flex-col">
      <TopBar s={snap} onSpeed={n => { game.setSpeed(n); audio.sfx('click'); refresh(); }} onMenu={openMenu} onTogglePanel={() => setPanelOpen(o => !o)} />
      <div className="flex min-h-0 flex-1 gap-0 max-md:flex-col">
        <div className="max-md:order-2"><Palette game={game} s={snap} onPick={pick} /></div>
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden max-md:order-1" ref={wrapRef}>
          <canvas ref={canvasRef} className="cursor-crosshair"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            onPointerLeave={() => { if (!dragRef.current) game.hover = -1; }} onContextMenu={e => e.preventDefault()} />
          <OmenBar s={snap} />
          {snap.banner && (
            <div key={snap.banner.text} className="pop-in pointer-events-none absolute left-1/2 top-14 z-10 -translate-x-1/2 text-center">
              <div className={`font-display rounded-lg border px-5 py-2 text-lg font-black shadow-2xl sm:text-2xl ${snap.banner.kind === 'boss' ? 'border-[var(--bad)] bg-[#3c0d0a]/95 text-[#ffb3a0]' : snap.banner.kind === 'good' ? 'border-[var(--good)] bg-[#12341a]/95 text-[#c8ffc0]' : 'border-[var(--gold)] bg-[#2b2210]/95 text-[var(--gold)]'}`}>{snap.banner.text}</div>
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 left-2 z-10 flex max-w-[60%] flex-col gap-1">
            {snap.log.filter(l => l.age < 6).slice(-4).map(l => (
              <div key={l.id} className={`fade-in rounded px-2 py-1 text-xs shadow ${l.kind === 'bad' ? 'bg-[#4a1410]/90' : l.kind === 'good' ? 'bg-[#12341a]/90' : l.kind === 'warn' ? 'bg-[#3a2c0e]/90' : 'bg-[#10242b]/90'}`}>{l.msg}</div>
            ))}
          </div>
          {snap.tut && !menu && (
            <div className="pop-in absolute bottom-2 right-2 z-10 w-[min(26rem,60%)] rounded-lg border border-[var(--gold)] bg-[#10242b]/95 p-2.5 shadow-2xl">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-[var(--gold)]"><span>Tutorial {snap.tut.i + 1}/{snap.tut.total}</span>
                <span className="flex gap-1"><button className="btn btn-alt btn-sm !px-1.5 !py-0 !text-[10px]" onClick={() => { game.nextTutorial(); refresh(); }}>Next ▸</button><button className="btn btn-alt btn-sm !px-1.5 !py-0 !text-[10px]" onClick={() => { game.skipTutorial(); refresh(); }}>Skip</button></span></div>
              <div className="mt-1 text-sm leading-snug">{snap.tut.text}</div>
            </div>
          )}
          {snap.speed > 1 && <div className="pointer-events-none absolute right-2 top-2 chip">⏩ {snap.speed}×</div>}
        </div>
        <div className={`${panelOpen ? 'flex' : 'hidden'} z-20 w-72 shrink-0 p-1.5 max-md:absolute max-md:bottom-24 max-md:right-0 max-md:top-24 max-md:w-[85%] md:flex`}>
          <SidePanel s={snap} tab={tab} setTab={setTab} onResearch={id => { game.research(id); refresh(); }} onOverlay={toggleOverlay} onRotate={rotate} />
        </div>
      </div>
      {menu && !showEnd && (
        <PauseMenu settings={settings} onSettings={onSettings} diff={game.cfg.diff} onDiff={n => { game.setDifficulty(n); refresh(); }}
          onResume={closeMenu} onRestart={onRestart} onQuit={onQuit} scName={`${sc.name} · ${game.diff.name}`} />
      )}
      {showEnd && r && (
        <EndScreen r={r} savedLP={savedLP} onRetry={onRestart} onNext={r.win ? onNext : undefined}
          onContinue={r.win ? () => { finished.current = false; game.continueAfterWin(); refresh(); } : undefined}
          onLegacy={onLegacy} onQuit={onQuit} />
      )}
    </div>
  );
}
