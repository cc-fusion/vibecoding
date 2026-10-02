import { useEffect, useRef, useState } from 'react';
import { BIOMES, BUILDINGS, BUILD_MAP, EVENT_INFO, MILESTONES, SIM_DT, SOIL_CAP, STAGES, TIERS, W } from '../game/data';
import type { ToolId } from '../game/data';
import { World } from '../game/sim';
import type { Fx, RunConfig } from '../game/sim';
import { Renderer } from '../game/render';
import type { Overlay } from '../game/render';
import { audio } from '../game/audio';
import type { Settings } from '../game/save';
import { BuildPanel, LedgerPanel, PlanetPanel, TechPanel } from './Panels';
import { EndModal, HelpModal, PauseModal, SettingsModal } from './Overlays';
import type { EndSummary } from './Overlays';
import { Bar, Btn, cx, fmt } from './ui';

interface Props {
  cfg: RunConfig;
  settings: Settings;
  onSettings: (s: Settings) => void;
  tutorial: boolean;
  onTutorialDone: () => void;
  onRunEnd: (s: EndSummary) => void;
  onRestart: () => void;
  onQuit: () => void;
}

type Tab = 'build' | 'tech' | 'planet' | 'ledger';
type Menu = null | 'pause' | 'settings' | 'help';
interface Toast { id: number; s: string; kind: 'good' | 'bad' | 'info' | 'warn' }

const OVERLAYS: { id: Overlay; label: string; key: string; icon: string }[] = [
  { id: 'surface', label: 'Surface', key: 'S', icon: '🗺️' },
  { id: 'temp', label: 'Temp', key: 'T', icon: '🌡️' },
  { id: 'moist', label: 'Moisture', key: 'M', icon: '💧' },
  { id: 'veg', label: 'Life', key: 'V', icon: '🌿' },
  { id: 'hab', label: 'Habitable', key: 'H', icon: '🏠' },
  { id: 'cloud', label: 'Clouds', key: 'C', icon: '☁️' },
  { id: 'wind', label: 'Wind', key: 'F', icon: '🌬️' },
];

const TABS: { id: Tab; label: string; icon: string; key: string }[] = [
  { id: 'build', label: 'Build', icon: '🏗️', key: 'B' },
  { id: 'tech', label: 'Tech', icon: '🔬', key: 'R' },
  { id: 'planet', label: 'Planet', icon: '🪐', key: 'G' },
  { id: 'ledger', label: 'Ledger', icon: '📒', key: 'L' },
];

const TUT = [
  { t: 'Welcome, Chief Engineer', d: 'Your dome sits on a dead world. This quick tour shows the loop: power → warm the sky → research → life. The sim keeps running, so take your time. (Space pauses.)', next: true },
  { t: 'Read the planet', d: 'Press T or click 🌡️ Temp under the map to see temperatures. Try the other overlays later: Moisture, Life, Habitable, Clouds, Wind.' },
  { t: 'Power first', d: 'Open the Build tab, pick ☀️ Solar Array and click land near your dome. Build one more (you have 2 already). Energy runs every other machine.' },
  { t: 'Warm the sky', d: 'Pick 🏭 Gas Works and place two. They emit super-greenhouse PFC gas — watch the Planet tab to see it raise temperatures and melt the polar ice.' },
  { t: 'Invest in research', d: 'Open the Tech tab (R) and research ⚙ Nitrogen Extraction (45🔬). Labs and colonists produce research. Cometary Capture comes next.' },
  { t: 'Watch the atmosphere', d: 'Open the Planet tab (G): pressure, oxygen and CO₂ decide habitability. The Ledger tab shows exactly where each gas comes from and goes.' },
  { t: 'Your charter', d: 'Reach the habitability target, grow your population, and survive THE RECKONING — a boss cataclysm that arrives as the world blooms. Use [ ] to change speed. Good luck!', next: true },
];

export default function GameView(props: Props) {
  const { cfg, settings } = props;
  const [world] = useState(() => new World(cfg));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rendRef = useRef<Renderer | null>(null);

  const [, setVer] = useState(0);
  const [paused, setPausedS] = useState(false);
  const [speed, setSpeedS] = useState(1);
  const [menu, setMenuS] = useState<Menu>(null);
  const [tab, setTabS] = useState<Tab>('build');
  const [overlay, setOverlayS] = useState<Overlay>('surface');
  const [tool, setToolS] = useState<ToolId>('inspect');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hint, setHint] = useState<{ s: string; ok: boolean } | null>(null);
  const [tut, setTut] = useState<number | null>(props.tutorial ? 0 : null);
  const [ended, setEnded] = useState<EndSummary | null>(null);
  const [diffId, setDiffId] = useState(cfg.diff);
  const [goalsOpen, setGoalsOpen] = useState(true);

  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const menuRef = useRef<Menu>(null);
  const toolRef = useRef<ToolId>('inspect');
  const endedRef = useRef(false);
  const recordedRef = useRef(false);
  const toastId = useRef(1);
  const timers = useRef<number[]>([]);
  const keys = useRef<Set<string>>(new Set());
  const drag = useRef<{ x: number; y: number; lx: number; ly: number; moved: boolean } | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const bump = () => setVer((v) => v + 1);
  const setPaused = (p: boolean) => { pausedRef.current = p; setPausedS(p); };
  const setSpeed = (s: number) => { speedRef.current = s; setSpeedS(s); };
  const setMenu = (m: Menu) => { menuRef.current = m; setMenuS(m); };
  const setOverlay = (o: Overlay) => { setOverlayS(o); if (rendRef.current) { rendRef.current.overlay = o; rendRef.current.dirty = true; } };
  const updateToolErr = (t: ToolId) => {
    const r = rendRef.current;
    if (!r) return;
    r.tool = t;
    r.toolErr = r.hover ? world.canUse(t, r.hover.x, r.hover.y) : null;
  };
  const setTool = (t: ToolId) => { toolRef.current = t; setToolS(t); updateToolErr(t); };
  const setTab = (t: Tab) => { audio.sfx('tab'); setTabS(t); };
  const showHint = (s: string, ok: boolean) => {
    setHint({ s, ok });
    const id = window.setTimeout(() => setHint((h) => (h && h.s === s ? null : h)), 2600);
    timers.current.push(id);
  };

  const buildSummary = (): EndSummary => ({
    win: world.ended?.win ?? false,
    reason: world.ended?.reason ?? '',
    years: world.time, charter: world.charter, peakH: world.stats.peakH, finalH: world.H, pop: world.pop, peakPop: world.stats.peakPop,
    score: world.computeScore(), lp: world.lpEarned(), milestones: world.milestones.size, stats: { ...world.stats },
    world: world.wd.name, diff: world.diff.name, techs: world.techs.size, recorded: !recordedRef.current,
  });

  // settings -> renderer flags
  useEffect(() => {
    const r = rendRef.current;
    if (r) { r.shakeOn = settings.shake; r.particlesOn = settings.particles; }
  }, [settings.shake, settings.particles]);

  // main loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const r = new Renderer(canvas, world);
    rendRef.current = r;
    r.shakeOn = propsRef.current.settings.shake;
    r.particlesOn = propsRef.current.settings.particles;
    r.overlay = 'surface';
    const measure = () => { const b = wrap.getBoundingClientRect(); r.resize(b.width, b.height); };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);

    const pushToast = (s: string, kind: Toast['kind']) => {
      const id = toastId.current++;
      setToasts((p) => [...p.slice(-3), { id, s, kind }]);
      const t = window.setTimeout(() => setToasts((p) => p.filter((q) => q.id !== id)), kind === 'good' ? 4500 : 6000);
      timers.current.push(t);
    };
    world.emit = (e: Fx) => {
      if (e.t === 'sfx') audio.sfx(e.n);
      else if (e.t === 'toast') pushToast(e.s, e.kind);
      else r.fx(e);
    };

    audio.init();
    audio.startMusic();

    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let lastHud = 0;
    let lastMood = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const running = !pausedRef.current && !menuRef.current && !endedRef.current;
      if (running) {
        acc += dt * speedRef.current;
        let n = 0;
        while (acc >= SIM_DT && n < 10) { world.step(); acc -= SIM_DT; n++; }
        if (n >= 10) acc = 0;
      }
      const ks = keys.current;
      if (ks.size) {
        const sp = 520 * dt;
        let dx = 0, dy = 0;
        if (ks.has('ArrowLeft')) dx += sp;
        if (ks.has('ArrowRight')) dx -= sp;
        if (ks.has('ArrowUp')) dy += sp;
        if (ks.has('ArrowDown')) dy -= sp;
        if (dx || dy) r.pan(dx, dy);
      }
      r.update(dt);
      r.draw(now);
      if (world.ended && !endedRef.current) {
        endedRef.current = true;
        const s = buildSummary();
        recordedRef.current = true;
        audio.sfx(s.win ? 'win' : 'lose');
        r.fx({ t: 'flash', c: s.win ? '#7cf3ff' : '#ff3b3b' });
        setEnded(s);
        propsRef.current.onRunEnd(s);
      }
      if (now - lastHud > 200) { lastHud = now; setVer((v) => v + 1); }
      if (now - lastMood > 500) {
        lastMood = now;
        const b = world.boss.state;
        const tension = b === 'p1' || b === 'p2' || b === 'p3' ? 1 : b === 'warn' ? 0.6 : world.events.some((e) => e.phase === 'active') ? 0.35 : 0;
        audio.setMood(world.H, tension, Math.min(1, world.cnt.rain / 400), Math.min(1, world.P / 70) * 0.8);
      }
    };
    raf = requestAnimationFrame(frame);

    const onVis = () => { if (document.hidden && !endedRef.current) { pausedRef.current = true; setPausedS(true); } };
    document.addEventListener('visibilitychange', onVis);

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const b = canvas.getBoundingClientRect();
      r.zoomAt(e.clientX - b.left, e.clientY - b.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      r.dirty = true;
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const onKeyDown = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      audio.init();
      const k = e.key;
      if (endedRef.current) return;
      if (k === 'Escape') {
        e.preventDefault();
        if (menuRef.current) { setMenu(null); }
        else if (toolRef.current !== 'inspect') setTool('inspect');
        else setMenu('pause');
        return;
      }
      if (menuRef.current) return;
      if (k.startsWith('Arrow')) { keys.current.add(k); e.preventDefault(); return; }
      if (k === ' ') { e.preventDefault(); setPaused(!pausedRef.current); return; }
      if (k === '[') { setSpeed(speedRef.current === 4 ? 2 : 1); return; }
      if (k === ']') { setSpeed(speedRef.current === 1 ? 2 : 4); return; }
      if (k === '=' || k === '+') { r.zoomAt(r.cw / 2, r.ch / 2, 1.25); r.dirty = true; return; }
      if (k === '-' || k === '_') { r.zoomAt(r.cw / 2, r.ch / 2, 0.8); r.dirty = true; return; }
      if (k === '?' || k === 'F1') { e.preventDefault(); setMenu('help'); return; }
      if (/^[0-9]$/.test(k)) {
        const list = BUILDINGS.filter((b) => world.has(b.tech));
        const idx = k === '0' ? 9 : parseInt(k, 10) - 1;
        if (list[idx]) { audio.sfx('tab'); setTool(list[idx].id); }
        return;
      }
      const lk = k.toLowerCase();
      const ov = OVERLAYS.find((o) => o.key.toLowerCase() === lk);
      if (ov) { setOverlay(ov.id); audio.sfx('tab'); return; }
      const tb = TABS.find((t) => t.key.toLowerCase() === lk);
      if (tb) { setTab(tb.id); return; }
      if (lk === 'q') setTool('inspect');
      else if (lk === 'x') setTool('demolish');
    };
    const onKeyUp = (e: KeyboardEvent) => { keys.current.delete(e.key); };
    const onBlur = () => keys.current.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
      world.emit = () => {};
      audio.stopMusic();
      rendRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  // ----- pointer input -----
  const localPos = (e: React.PointerEvent) => {
    const b = (canvasRef.current as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  const updateHover = (px: number, py: number) => {
    const r = rendRef.current;
    if (!r) return;
    const c = r.screenToCell(px, py);
    r.hover = c;
    r.toolErr = c ? world.canUse(toolRef.current, c.x, c.y) : null;
  };
  const onDown = (e: React.PointerEvent) => {
    audio.init();
    if (e.button === 2) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    const p = localPos(e);
    updateHover(p.x, p.y);
  };
  const onMove = (e: React.PointerEvent) => {
    const r = rendRef.current;
    if (!r) return;
    const p = localPos(e);
    updateHover(p.x, p.y);
    const d = drag.current;
    if (d) {
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) d.moved = true;
      if (d.moved) { r.pan(e.clientX - d.lx, e.clientY - d.ly); r.dirty = true; }
      d.lx = e.clientX; d.ly = e.clientY;
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    const r = rendRef.current;
    if (!d || d.moved || !r || e.button !== 0) return;
    if (menuRef.current || endedRef.current) return;
    const p = localPos(e);
    const inc = r.incomingAt(p.x, p.y);
    if (inc !== null) {
      const res = world.intercept(inc);
      if (!res.ok && res.msg) showHint(res.msg, false);
      bump();
      return;
    }
    const c = r.screenToCell(p.x, p.y);
    if (!c) return;
    const t = toolRef.current;
    if (t === 'inspect') { r.selected = c; audio.sfx('click'); bump(); return; }
    const res = world.useTool(t, c.x, c.y);
    if (!res.ok) showHint(res.msg, false);
    updateToolErr(t);
    bump();
  };
  const onContext = (e: React.MouseEvent) => { e.preventDefault(); setTool('inspect'); };

  const r = rendRef.current;
  const wd = world.wd;
  const st = STAGES[world.stage];
  const active = world.events;
  const boss = world.boss;
  const nextMs = MILESTONES.filter((m) => !world.milestones.has(m.id) && world.relevant(m.id)).slice(0, 3);

  // tutorial progression
  const cnt = (k: string) => world.bld.filter((b) => b.kind === k).length;
  const tutDone = (step: number): boolean => {
    switch (step) {
      case 1: return overlay !== 'surface';
      case 2: return cnt('solar') >= 3;
      case 3: return cnt('pfc') >= 2;
      case 4: return world.techs.has('n2x');
      case 5: return tab === 'planet';
      default: return false;
    }
  };
  useEffect(() => {
    if (tut === null) return;
    if (tut < TUT.length && !TUT[tut].next && tutDone(tut)) {
      audio.sfx('milestone');
      setTut(tut + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });
  const finishTut = () => { setTut(null); props.onTutorialDone(); };

  const cell = r ? r.hover ?? r.selected : null;
  const ci = cell ? cell.y * W + cell.x : -1;

  const net = world.netEnergy;
  const h = world.H;

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#04060c] text-slate-100 md:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* ---------- HUD ---------- */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 bg-slate-950/95 px-2 py-1.5 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 font-bold text-cyan-100"><span>{wd.icon}</span><span className="hidden sm:inline">{wd.name}</span></div>
          <div className="w-28 sm:w-40" title="Years elapsed / charter">
            <div className="flex justify-between text-[11px] text-slate-300"><span>Year {Math.floor(world.time)}</span><span>{world.charter - Math.floor(world.time)}y left</span></div>
            <Bar v={world.time / world.charter} color={world.charter - world.time < 15 ? '#ff6a5a' : '#8fb3ff'} />
          </div>
          <div className={cx('rounded bg-white/5 px-2 py-0.5', world.effPower < 0.9 && 'pulse-red text-rose-200')} title="Energy stored (net per year)">
            ⚡ {fmt(world.energy)} <span className={net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{net >= 0 ? '+' : ''}{net.toFixed(1)}</span>
          </div>
          <div className="rounded bg-white/5 px-2 py-0.5" title="Materials">⛏ {fmt(world.mats)}</div>
          <div className="rounded bg-white/5 px-2 py-0.5" title="Research points">🔬 {fmt(world.research)}</div>
          <div className="hidden rounded bg-white/5 px-2 py-0.5 md:block" title="Average temperature">🌡️ {world.avgT.toFixed(0)}°C</div>
          <div className="hidden rounded bg-white/5 px-2 py-0.5 md:block" title="Pressure / oxygen">🌫️ {world.P.toFixed(0)}kPa · O₂ {world.gas.o2.toFixed(0)}</div>
          <div className="rounded bg-white/5 px-2 py-0.5" title="Population / goal">👥 {fmt(world.pop)}<span className="text-slate-400">/{world.diff.popGoal}</span></div>
          <div className="flex min-w-[7rem] items-center gap-2" title="Planetary habitability">
            <span className="font-bold" style={{ color: st.color }}>{Math.round(h * 100)}%</span>
            <div className="flex-1"><div className="text-[10px] leading-none" style={{ color: st.color }}>{st.name}</div><Bar v={h} color={st.color} marks={[world.diff.winH]} /></div>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Btn small title="Pause (Space)" onClick={() => setPaused(!paused)}>{paused ? '▶' : '⏸'}</Btn>
            {[1, 2, 4].map((s) => (
              <Btn key={s} small variant={speed === s && !paused ? 'primary' : 'ghost'} title={`Speed ${s}×`} onClick={() => { setSpeed(s); setPaused(false); }}>{s}×</Btn>
            ))}
            <Btn small title={settings.muted ? 'Unmute' : 'Mute'} onClick={() => props.onSettings({ ...settings, muted: !settings.muted })}>{settings.muted ? '🔇' : '🔊'}</Btn>
            <Btn small title="Menu (Esc)" onClick={() => setMenu('pause')}>☰</Btn>
          </div>
        </div>

        {/* ---------- map ---------- */}
        <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
          <canvas
            ref={canvasRef}
            className={cx('h-full w-full', tool === 'inspect' ? 'cursor-crosshair' : 'cursor-cell')}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerLeave={() => { if (rendRef.current) rendRef.current.hover = null; }}
            onContextMenu={onContext}
          />

          {/* goals */}
          <div className="pointer-events-auto absolute left-2 top-2 hidden w-56 rounded-xl border border-white/10 bg-slate-950/80 p-2.5 text-xs backdrop-blur sm:block">
            <button type="button" className="flex w-full items-center justify-between font-bold text-cyan-100" onClick={() => setGoalsOpen(!goalsOpen)}>
              <span>🎯 Charter goals</span><span className="text-slate-400">{goalsOpen ? '–' : '+'}</span>
            </button>
            {goalsOpen && (
              <div className="mt-2 space-y-1.5">
                <Goal ok={world.reckoningDone} label={`Survive the Reckoning`} sub={world.reckoningDone ? 'Done' : boss.state === 'idle' ? 'Awaits a flourishing world' : 'In progress!'} />
                <Goal ok={h >= world.diff.winH} label={`Habitability ≥ ${Math.round(world.diff.winH * 100)}%`} sub={`${Math.round(h * 100)}%`} />
                <Goal ok={world.pop >= world.diff.popGoal} label={`Population ≥ ${world.diff.popGoal}`} sub={fmt(world.pop)} />
                <div>
                  <div className="flex justify-between text-slate-400"><span>Certification hold</span><span>{world.holdT.toFixed(1)}/{world.holdYears}y</span></div>
                  <Bar v={world.holdT / world.holdYears} color="#5ee0ff" />
                </div>
                {nextMs.length > 0 && (
                  <div className="border-t border-white/10 pt-1.5 text-slate-300">
                    <div className="mb-0.5 text-[10px] uppercase tracking-wider text-slate-500">Next milestones</div>
                    {nextMs.map((m) => <div key={m.id} className="truncate" title={m.desc}>☆ {m.name} <span className="text-slate-500">— {m.desc}</span></div>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* banners */}
          <div className="pointer-events-none absolute left-1/2 top-2 flex w-[min(30rem,92%)] -translate-x-1/2 flex-col gap-1.5 sm:ml-16">
            {boss.state !== 'idle' && boss.state !== 'done' && (
              <div className="pop-in rounded-xl border border-rose-400/60 bg-rose-950/85 p-2 text-xs shadow-lg shadow-rose-900/50 backdrop-blur">
                <div className="flex items-center justify-between font-bold text-rose-100">
                  <span>☄️ THE RECKONING — {boss.state === 'warn' ? 'Approaching' : boss.state === 'p1' ? 'Phase 1: Fragment Storm' : boss.state === 'p2' ? 'Phase 2: Impact Winter' : 'Phase 3: Superflare'}</span>
                  <span className="tabular-nums">{boss.t.toFixed(1)}y</span>
                </div>
                <Bar v={boss.dur > 0 ? 1 - boss.t / boss.dur : 0} color="#ff5a5a" className="mt-1" />
                {boss.state === 'p1' && <div className="mt-1 text-rose-200">Incoming fragments: {world.incoming.filter((q) => q.src === 'boss').length} · stopped {world.stats.stopped} · click red reticles (18⚡)</div>}
                {boss.state === 'warn' && <div className="mt-1 text-rose-200">Bank energy ({fmt(world.energy)}⚡) and protect your colonies.</div>}
              </div>
            )}
            {active.map((ev) => (
              <div key={ev.id} className={cx('toast-in flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs backdrop-blur', ev.phase === 'warn' ? 'border-amber-300/50 bg-amber-950/80 text-amber-100' : 'border-rose-400/60 bg-rose-950/80 text-rose-100')}>
                <span className="text-base">{EVENT_INFO[ev.kind].icon}</span>
                <span className="flex-1"><b>{world.eventName(ev)}</b> {ev.phase === 'warn' ? 'forecast' : 'in progress'}</span>
                <span className="tabular-nums">{ev.phase === 'warn' ? 'in ' : ''}{Math.max(0, ev.t).toFixed(1)}y</span>
              </div>
            ))}
          </div>

          {/* inspector */}
          {cell && ci >= 0 && (
            <div className="pointer-events-none absolute right-2 top-2 hidden w-56 rounded-xl border border-white/10 bg-slate-950/85 p-2.5 text-[11px] leading-tight backdrop-blur md:block">
              <div className="mb-1 flex justify-between font-bold text-cyan-100"><span>Tile ({cell.x},{cell.y})</span><span>{BIOMES[world.classify(ci)]}</span></div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-300">
                <span>🌡️ {world.tmp[ci].toFixed(1)}°C</span><span>⛰️ elev {Math.round(world.hgt[ci] * 100)}</span>
                <span>💧 water {(world.wat[ci] * 100).toFixed(1)}</span><span>🧊 ice {(world.ice[ci] * 100).toFixed(1)}</span>
                <span>🟤 soil {Math.round((world.soil[ci] / SOIL_CAP) * 100)}%</span><span>🏠 hab {Math.round(world.hab[ci] * 100)}%</span>
                <span className="col-span-2">🌿 {world.vtier[ci] ? `${TIERS[world.vtier[ci]].name} ${Math.round(world.veg[ci] * 100)}%` : 'no life'}</span>
                {world.has('bio1') && <span className="col-span-2 text-emerald-300">🧬 viable: {world.bestTier(ci) ? TIERS[world.bestTier(ci)].name : 'none yet'}</span>}
                {world.vent[ci] > 0 && <span className="col-span-2 text-orange-300">♨ volcanic vent</span>}
                {world.fire[ci] > 0 && <span className="col-span-2 text-orange-300">🔥 burning</span>}
              </div>
              {world.bmap[ci] >= 0 && (() => {
                const b = world.bld[world.bmap[ci]];
                return <div className="mt-1 border-t border-white/10 pt-1 text-slate-200">{BUILD_MAP[b.kind].icon} <b>{BUILD_MAP[b.kind].name}</b> · hp {Math.round(b.hp)}%{b.out > 0 ? ` · out ${b.out.toFixed(1)}` : ''}{b.kind === 'dome' || b.kind === 'settle' ? ` · 👥 ${Math.floor(b.pop)}` : ''}</div>;
              })()}
              {r && r.toolErr && tool !== 'inspect' && <div className="mt-1 border-t border-white/10 pt-1 text-rose-300">✖ {r.toolErr}</div>}
            </div>
          )}

          {/* toasts */}
          <div className="pointer-events-none absolute bottom-14 right-2 flex w-[min(20rem,70%)] flex-col gap-1.5">
            {toasts.map((t) => (
              <div key={t.id} className={cx('toast-in rounded-lg border px-3 py-1.5 text-xs shadow-lg backdrop-blur', t.kind === 'good' ? 'border-emerald-400/50 bg-emerald-950/85 text-emerald-100' : t.kind === 'bad' ? 'border-rose-400/50 bg-rose-950/85 text-rose-100' : t.kind === 'warn' ? 'border-amber-400/50 bg-amber-950/85 text-amber-100' : 'border-sky-400/40 bg-slate-900/90 text-sky-100')}>
                {t.s}
              </div>
            ))}
          </div>

          {/* bottom-left: tutorial + hint + overlay chips */}
          <div className="absolute bottom-2 left-2 right-28 flex flex-col gap-1.5">
            {tut !== null && tut < TUT.length && (
              <div className="pop-in pointer-events-auto max-w-sm rounded-xl border border-cyan-300/50 bg-slate-950/90 p-3 text-xs shadow-xl backdrop-blur">
                <div className="mb-1 flex items-center justify-between">
                  <b className="text-cyan-200">📘 {TUT[tut].t}</b>
                  <span className="text-slate-500">{tut + 1}/{TUT.length}</span>
                </div>
                <p className="text-slate-200">{TUT[tut].d}</p>
                <div className="mt-2 flex justify-between">
                  <Btn small onClick={finishTut}>Skip tour</Btn>
                  {TUT[tut].next && <Btn small variant="primary" onClick={() => { if (tut + 1 >= TUT.length) finishTut(); else setTut(tut + 1); }}>{tut + 1 >= TUT.length ? 'Begin!' : 'Next'}</Btn>}
                </div>
              </div>
            )}
            {hint && <div className={cx('pop-in w-fit max-w-md rounded-lg px-3 py-1.5 text-xs font-semibold', hint.ok ? 'bg-emerald-600/90' : 'bg-rose-700/90')}>{hint.s}</div>}
            <div className="pointer-events-auto flex flex-wrap gap-1">
              {OVERLAYS.map((o) => (
                <button key={o.id} type="button" title={`${o.label} (${o.key})`} onClick={() => { audio.sfx('tab'); setOverlay(o.id); }}
                  className={cx('rounded-md border px-2 py-1 text-[11px] font-semibold backdrop-blur transition', overlay === o.id ? 'border-cyan-300 bg-cyan-400/25 text-cyan-50' : 'border-white/10 bg-slate-950/70 text-slate-300 hover:bg-white/10')}>
                  {o.icon}<span className="hidden sm:inline"> {o.label}</span> <span className="hidden text-slate-500 lg:inline">{o.key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* zoom + tool indicator */}
          <div className="pointer-events-auto absolute bottom-2 right-2 flex flex-col items-end gap-1">
            {tool !== 'inspect' && <div className="rounded-md bg-amber-500/90 px-2 py-0.5 text-[11px] font-bold text-slate-900">Tool: {BUILD_MAP[tool]?.name ?? tool} · Esc</div>}
            <div className="flex gap-1">
              <Btn small onClick={() => { const rr = rendRef.current; if (rr) { rr.zoomAt(rr.cw / 2, rr.ch / 2, 0.8); rr.dirty = true; } }}>−</Btn>
              <Btn small onClick={() => { const rr = rendRef.current; if (rr) { rr.zoomAt(rr.cw / 2, rr.ch / 2, 1.25); rr.dirty = true; } }}>＋</Btn>
              <Btn small title="Field manual (?)" onClick={() => setMenu('help')}>?</Btn>
            </div>
          </div>

          {paused && !menu && !ended && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-black/55 px-6 py-2 text-xl font-bold tracking-[0.3em] text-white/90">PAUSED</div>
          )}
        </div>
      </div>

      {/* ---------- sidebar ---------- */}
      <aside className="flex h-[42%] min-h-0 w-full flex-col border-t border-white/10 bg-slate-950/95 md:h-full md:w-[22.5rem] md:border-l md:border-t-0">
        <div className="grid grid-cols-4 border-b border-white/10">
          {TABS.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} title={`${t.label} (${t.key})`}
              className={cx('px-1 py-2 text-xs font-semibold transition sm:text-sm', tab === t.id ? 'border-b-2 border-cyan-300 bg-white/5 text-cyan-100' : 'text-slate-400 hover:bg-white/5')}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {tab === 'build' && <BuildPanel world={world} bump={bump} tool={tool} setTool={setTool} />}
          {tab === 'tech' && <TechPanel world={world} bump={bump} />}
          {tab === 'planet' && <PlanetPanel world={world} bump={bump} />}
          {tab === 'ledger' && <LedgerPanel world={world} bump={bump} />}
        </div>
      </aside>

      {/* ---------- modals ---------- */}
      {menu === 'pause' && !ended && (
        <PauseModal onResume={() => setMenu(null)} onSettings={() => setMenu('settings')} onHelp={() => setMenu('help')} onRestart={props.onRestart} onQuit={props.onQuit} />
      )}
      {menu === 'settings' && (
        <SettingsModal settings={settings} onChange={props.onSettings} onClose={() => setMenu('pause')} diff={diffId}
          onDiff={(d) => { world.setDiff(d); setDiffId(d); bump(); }} />
      )}
      {menu === 'help' && <HelpModal onClose={() => setMenu(ended ? null : 'pause')} />}
      {ended && menu !== 'help' && (
        <EndModal
          s={ended}
          onRetry={props.onRestart}
          onMenu={props.onQuit}
          onContinue={ended.win ? () => {
            world.continueAfterWin();
            endedRef.current = false;
            setEnded(null);
            setPaused(false);
          } : undefined}
        />
      )}
    </div>
  );
}

function Goal({ ok, label, sub }: { ok: boolean; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className={ok ? 'text-emerald-300' : 'text-slate-500'}>{ok ? '✔' : '○'}</span>
      <div className="flex-1"><div className={ok ? 'text-emerald-200' : 'text-slate-200'}>{label}</div></div>
      <span className="text-slate-400">{sub}</span>
    </div>
  );
}

