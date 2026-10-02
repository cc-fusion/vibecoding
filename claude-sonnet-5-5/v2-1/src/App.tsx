import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { ABILITIES, DIFFS, loadSave, writeSave, type Save } from './game/data';
import { Game, type Pick } from './game/sim';
import { render, viewT } from './game/render';
import { audio } from './game/audio';
import { Banner, BossBar, BottomBar, EventLog, SidePanel, TopBar, TutorialCard, WavePreview } from './ui/Hud';
import { CharterModal, EndScreen, HelpModal, NewGameModal, PauseModal, SettingsModal, TitleScreen } from './ui/Screens';

type Modal = '' | 'new' | 'charter' | 'help' | 'settings' | 'pause' | 'end';
type Cfg = { diffId: string; mods: string[]; tutorial: boolean };

function makeDemo(save: Save): Game {
  const d = new Game({ diff: DIFFS[1], mods: [], save: { ...save, charter: {} }, tutorial: false, demo: true });
  d.res = { stone: 9999, iron: 999, gold: 999 };
  d.crew = 40;
  const list: [string, Parameters<Game['build']>[1]][] = [['H0', 'quarry'], ['H1', 'ironworks'], ['H2', 'mess'], ['H3', 'barracks'], ['H4', 'carpenter'], ['T3', 'saltworks'], ['B0', 'fishery'], ['M0', 'ballista'], ['M1', 'ballista'], ['M2', 'ballista'], ['M3', 'ballista']];
  for (const [p, t] of list) d.build(p, t);
  d.gates[0].mode = 2; d.gates[1].mode = 2;
  d.parts = []; d.texts = [];
  return d;
}

function GameView(props: { gameRef: MutableRefObject<Game | null>; pausedRef: MutableRefObject<boolean>; speedRef: MutableRefObject<number>; interactive: boolean; onInteract: () => void; children: ReactNode }) {
  const { gameRef, pausedRef, speedRef } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const hover = useRef<Pick>(null);
  const interactiveRef = useRef(props.interactive);
  interactiveRef.current = props.interactive;

  useEffect(() => {
    const canvas = canvasRef.current!; const wrap = wrapRef.current!;
    const resize = () => {
      const r = wrap.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(r.width * dpr)); canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    let raf = 0; let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      const g = gameRef.current; const ctx = canvas.getContext('2d');
      if (g && ctx) {
        try {
          if (!pausedRef.current) g.update(dt * (g.demo ? 1 : speedRef.current));
          const m = mouse.current;
          hover.current = m && interactiveRef.current ? g.pick(m.x, m.y) : null;
          canvas.style.cursor = hover.current ? 'pointer' : 'default';
          render(ctx, g, canvas.width, canvas.height, hover.current, now / 1000);
        } catch (err) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          console.error(err);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [gameRef, pausedRef, speedRef]);

  const toWorld = (e: RPointerEvent) => {
    const canvas = canvasRef.current!; const r = canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) * canvas.width) / r.width; const py = ((e.clientY - r.top) * canvas.height) / r.height;
    const v = viewT(canvas.width, canvas.height);
    return { x: (px - v.ox) / v.s, y: (py - v.oy) / v.s };
  };
  return (
    <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-hidden">
      <canvas
        ref={canvasRef}
        onPointerMove={(e) => { mouse.current = toWorld(e); }}
        onPointerLeave={() => { mouse.current = null; }}
        onPointerDown={(e) => {
          const w = toWorld(e); mouse.current = w;
          const g = gameRef.current;
          if (g && interactiveRef.current && !pausedRef.current) { g.click(w.x, w.y); props.onInteract(); }
        }}
      />
      {props.children}
    </div>
  );
}

export default function App() {
  const [save, setSaveState] = useState<Save>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<'title' | 'play'>('title');
  const [modal, setModal] = useState<Modal>('');
  const [speed, setSpeedState] = useState(1);
  const [endState, setEndState] = useState<'victory' | 'defeat' | null>(null);
  const [, setTick] = useState(0);
  const gameRef = useRef<Game | null>(null);
  const demoRef = useRef<Game | null>(null);
  if (!demoRef.current) { demoRef.current = makeDemo(saveRef.current); gameRef.current = demoRef.current; }
  const cfgRef = useRef<Cfg>({ diffId: 'open', mods: [], tutorial: false });
  const returnTo = useRef<Modal>('');
  const speedRef = useRef(1);
  const pausedRef = useRef(false);

  const g = gameRef.current!;
  const paused = screen === 'play' && modal !== '' && modal !== 'end';
  pausedRef.current = paused;
  const bump = useCallback(() => setTick((n) => n + 1), []);

  const setSave = useCallback((s: Save) => {
    saveRef.current = s; setSaveState(s);
    if (gameRef.current && !gameRef.current.demo) gameRef.current.save = s;
  }, []);
  const setSpeed = (n: number) => { speedRef.current = n; setSpeedState(n); };

  const ensureAudio = useCallback(() => {
    audio.init();
    const st = saveRef.current.settings;
    audio.setVol({ master: st.master, music: st.music, sfx: st.sfx, muted: st.muted });
    audio.startMusic();
  }, []);

  const startGame = useCallback((cfg: Cfg) => {
    ensureAudio();
    cfgRef.current = cfg;
    const diff = cfg.tutorial ? DIFFS[0] : DIFFS.find((d) => d.id === cfg.diffId) || DIFFS[1];
    const ng = new Game({
      diff, mods: cfg.tutorial ? [] : cfg.mods, save: saveRef.current, tutorial: cfg.tutorial,
      onEnd: (r) => {
        const cur = gameRef.current;
        if (cur) { const ns = { ...cur.save }; saveRef.current = ns; setSaveState(ns); cur.save = ns; }
        setEndState(r); setModal('end');
      },
    });
    gameRef.current = ng; speedRef.current = 1; setSpeedState(1);
    setEndState(null); returnTo.current = ''; setScreen('play'); setModal(''); bump();
  }, [bump, ensureAudio]);

  const quitToTitle = () => { gameRef.current = demoRef.current; setScreen('title'); setModal(''); setEndState(null); };
  const openModal = (m: Modal) => { returnTo.current = screen === 'play' ? modal : ''; setModal(m); };
  const closeModal = () => { const r = returnTo.current; returnTo.current = ''; setModal(screen === 'play' ? r : ''); };

  const toggleMute = () => {
    const ns = { ...saveRef.current, settings: { ...saveRef.current.settings, muted: !saveRef.current.settings.muted } };
    audio.setVol({ muted: ns.settings.muted }); writeSave(ns); setSave(ns);
  };

  // heartbeat for HUD
  useEffect(() => {
    if (screen !== 'play') return;
    const id = window.setInterval(() => setTick((n) => n + 1), 100);
    return () => window.clearInterval(id);
  }, [screen]);

  // global audio unlock
  useEffect(() => {
    const h = () => ensureAudio();
    window.addEventListener('pointerdown', h); window.addEventListener('keydown', h);
    return () => { window.removeEventListener('pointerdown', h); window.removeEventListener('keydown', h); };
  }, [ensureAudio]);

  // auto-pause on blur
  const stateRef = useRef({ screen, modal });
  stateRef.current = { screen, modal };
  useEffect(() => {
    const pause = () => { const s = stateRef.current; if (s.screen === 'play' && s.modal === '' && gameRef.current && gameRef.current.state === 'play') setModal('pause'); };
    const vis = () => { if (document.hidden) pause(); };
    window.addEventListener('blur', pause); document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { screen: sc, modal: md } = stateRef.current; const k = e.key.toLowerCase();
      const gm = gameRef.current;
      if (k === 'm') { toggleMuteRef.current(); return; }
      if (k === 'escape' || (k === 'p' && sc === 'play')) {
        if (sc === 'play') {
          if (md === '') setModal('pause');
          else if (md === 'pause') setModal('');
          else if (md === 'help' || md === 'settings' || md === 'charter') { const r = returnTo.current; returnTo.current = ''; setModal(r); }
        } else if (md !== '') setModal('');
        return;
      }
      if (sc !== 'play' || md !== '' || !gm || gm.state !== 'play') return;
      if (k === '1' || k === '2') { gm.toggleGate(parseInt(k) - 1); setTick((n) => n + 1); }
      else if (k === ' ') { e.preventDefault(); gm.callWave(); }
      else if (k === 'f') { const n = (speedRef.current % 3) + 1; speedRef.current = n; setSpeedState(n); }
      else if (k === 'h') { returnTo.current = ''; setModal('help'); }
      else { const ab = ABILITIES.find((a) => a.key.toLowerCase() === k); if (ab) gm.useAbility(ab.id); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const toggleMuteRef = useRef(toggleMute);
  toggleMuteRef.current = toggleMute;

  const hud = { g, speed, setSpeed, paused: modal === 'pause', onPause: () => setModal(modal === 'pause' ? '' : 'pause'), muted: save.settings.muted, onMute: toggleMute, bump, onMenu: () => setModal('pause') };

  return (
    <div className="flex h-full w-full select-none flex-col overflow-hidden bg-slate-950 text-slate-100">
      {screen === 'play' && <TopBar {...hud} />}
      <GameView gameRef={gameRef} pausedRef={pausedRef} speedRef={speedRef} interactive={screen === 'play'} onInteract={bump}>
        {screen === 'play' && (
          <>
            <WavePreview g={g} />
            <BossBar g={g} />
            <Banner g={g} />
            <EventLog g={g} />
            <SidePanel g={g} bump={bump} />
            <TutorialCard g={g} bump={bump} />
          </>
        )}
        {screen === 'title' && modal === '' && (
          <TitleScreen save={save} onNew={() => setModal('new')} onTutorial={() => startGame({ diffId: 'calm', mods: [], tutorial: true })} onCharter={() => setModal('charter')} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} />
        )}
        {modal === 'new' && <NewGameModal onClose={() => setModal('')} onStart={(d, m) => startGame({ diffId: d, mods: m, tutorial: false })} />}
        {modal === 'charter' && <CharterModal save={save} setSave={setSave} onClose={closeModal} />}
        {modal === 'help' && <HelpModal onClose={closeModal} />}
        {modal === 'settings' && <SettingsModal save={save} setSave={setSave} onClose={closeModal} />}
        {modal === 'pause' && (
          <PauseModal onResume={() => setModal('')} onHelp={() => openModal('help')} onSettings={() => openModal('settings')} onRestart={() => startGame(cfgRef.current)} onQuit={quitToTitle} />
        )}
        {modal === 'end' && endState && (
          <EndScreen g={g} win={endState === 'victory'} onRetry={() => startGame(cfgRef.current)} onContinue={() => { g.continueEndless(); setEndState(null); setModal(''); }} onCharter={() => openModal('charter')} onQuit={quitToTitle} />
        )}
      </GameView>
      {screen === 'play' && <BottomBar {...hud} />}
    </div>
  );
}
