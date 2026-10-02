import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Game } from './game/engine';
import type { AbilityId } from './game/engine';
import { DEFS, DEF_ORDER } from './game/data';
import { audio } from './game/audio';
import { TopBar, BriefingPanel, AttackPanel, ClaimsPanel, CityPanel } from './ui/Panels';
import { TitleScreen, SetupModal, HelpModal, SettingsModal, PauseModal, ResearchModal, PerksModal, ReportModal, EndModal } from './ui/Overlays';

type Ov = null | 'help' | 'settings' | 'pause' | 'research' | 'perks' | 'setup';

export default function App() {
  const gRef = useRef<Game | null>(null);
  if (!gRef.current) gRef.current = new Game();
  const g = gRef.current;
  const [, force] = useReducer((x: number) => x + 1, 0);
  const [ov, setOv] = useState<Ov>(null);
  const [back, setBack] = useState<Ov>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ovRef = useRef<Ov>(null);
  const backRef = useRef<Ov>(null);

  useEffect(() => { ovRef.current = ov; backRef.current = back; }, [ov, back]);

  const openOv = useCallback((o: Ov) => {
    setBack(ovRef.current === 'pause' ? 'pause' : null);
    setOv(o);
  }, []);
  const closeOv = useCallback(() => {
    setOv(backRef.current);
    setBack(null);
  }, []);

  // pause the simulation whenever an overlay is open
  useEffect(() => { g.setPaused(ov !== null); }, [ov, g]);

  // canvas + engine lifecycle
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    g.onChange = force;
    g.attach(c);
    const ro = new ResizeObserver(() => g.resize());
    ro.observe(c);
    if (g.status === 'title') audio.setMode('title');
    return () => {
      ro.disconnect();
      g.detach();
      g.onChange = null;
    };
  }, [g]);

  // first gesture unlocks audio; blur / hidden auto-pauses
  useEffect(() => {
    const unlock = () => audio.init();
    const autoPause = () => {
      if (g.status === 'playing' && g.phase === 'attack' && !ovRef.current) setOv('pause');
    };
    const vis = () => {
      if (document.hidden) { autoPause(); audio.suspend(); } else audio.resume();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('blur', autoPause);
    document.addEventListener('visibilitychange', vis);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('blur', autoPause);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [g]);

  const startRun = useCallback((diff: string, mods: string[]) => {
    const first = !g.meta.seenHelp;
    g.newRun(diff, mods);
    setBack(null);
    if (first) { g.markHelpSeen(); setOv('help'); } else setOv(null);
  }, [g]);

  const restartRun = useCallback(() => {
    const d = g.diff.id, m = [...g.mods];
    if (g.status === 'playing' && (g.day > 1 || g.phase !== 'briefing')) g.finalizeRun(false, 'Restarted the campaign.', true);
    g.newRun(d, m);
    setBack(null);
    setOv(null);
  }, [g]);

  const quit = useCallback(() => {
    g.quitToTitle();
    setBack(null);
    setOv(null);
  }, [g]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      audio.init();
      const k = e.key.toLowerCase();
      if (e.repeat) { if (k === ' ') e.preventDefault(); return; }
      const ae = document.activeElement;
      if (ae instanceof HTMLButtonElement && (k === ' ' || k === 'enter')) ae.blur();
      const o = ovRef.current;
      if (k === 'escape') {
        e.preventDefault();
        if (o) { if (o === 'pause') setOv(null); else closeOv(); return; }
        if (g.status === 'playing') {
          if (g.selDef || g.sellMode || g.armed || g.inspect) { g.cancelTool(); return; }
          setOv('pause');
        }
        return;
      }
      if (k === 'm' && !e.ctrlKey && !e.metaKey) { g.setSetting({ muted: !g.settings.muted }); return; }
      if (o) return;
      if (g.status !== 'playing') return;
      if (k === ' ') e.preventDefault();
      if (k === 'p') { setOv('pause'); return; }
      if (k === 'h' || k === '?') { openOv('help'); return; }
      if (k === 'r' && g.phase !== 'attack') { openOv('research'); return; }
      if (g.phase === 'briefing') {
        const t = DEF_ORDER.find((d) => DEFS[d].key === k);
        if (t) g.selectDef(t);
        else if (k === 'x') { if (g.inspect) g.sellDef(g.inspect); else { g.sellMode = !g.sellMode; g.selDef = null; g.notify(); } }
        else if (k === 'f') g.deployProbe();
        else if (k === ' ' || k === 'enter') g.launch();
      } else if (g.phase === 'attack') {
        const ab: AbilityId[] = ['flare', 'strike', 'siren'];
        const n = parseInt(k, 10);
        if (n >= 1 && n <= 3) g.armAbility(ab[n - 1]);
        else if (k === ' ') g.setSpeed(g.speed === 1 ? 2 : 1);
      } else if (g.phase === 'claims') {
        if (k === 'a') g.decide('approve');
        else if (k === 's') g.decide('settle');
        else if (k === 'd') g.decide('deny');
        else if (k === 'i') g.investigate();
      } else if (g.phase === 'report') {
        if (k === ' ' || k === 'enter') g.nextDay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [g, openOv, closeOv]);

  const playing = g.status === 'playing';
  let hint = '';
  if (playing && g.phase === 'briefing') {
    if (g.selDef) hint = `Placing ${DEFS[g.selDef].name} — click a road or park tile. Esc / right-click to cancel.`;
    else if (g.sellMode) hint = 'Sell mode — click a defense to sell it for 50%.';
    else hint = 'Study the red forecast, build defenses, order evacuations, then launch.';
  } else if (playing && g.phase === 'attack') {
    hint = g.armed ? `Armed: ${g.armed.toUpperCase()} — click the map. Esc to cancel.` : 'Incident in progress — use emergency actions (1/2/3). Watch the warning zones!';
  } else if (playing && g.phase === 'claims') hint = 'Adjudicate each claim — the highlighted building is the one under review.';

  return (
    <div className="flex h-[100dvh] w-screen select-none flex-col overflow-hidden bg-slate-950 text-slate-100">
      {g.status !== 'title' && (
        <TopBar g={g} onHelp={() => openOv('help')} onSettings={() => openOv('settings')} onPause={() => setOv('pause')} onResearch={() => openOv('research')} />
      )}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[220px] flex-1">
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />
          {hint && (
            <div className="pointer-events-none absolute bottom-2 left-1/2 max-w-[92%] -translate-x-1/2 rounded-full border border-amber-500/30 bg-slate-950/80 px-3 py-1 text-center text-[11px] text-amber-100 backdrop-blur sm:text-xs">
              {hint}
            </div>
          )}
          {g.status === 'title' && (
            <TitleScreen g={g} onNew={() => { audio.init(); audio.sfx('click'); setOv('setup'); }} onPerks={() => openOv('perks')} onHelp={() => openOv('help')} onSettings={() => openOv('settings')} />
          )}
        </div>
        {g.status !== 'title' && (
          <aside className="h-[46%] shrink-0 overflow-y-auto border-t border-amber-500/20 bg-slate-950/95 lg:h-auto lg:w-[390px] lg:border-l lg:border-t-0">
            {g.phase === 'briefing' && playing && <BriefingPanel g={g} onResearch={() => openOv('research')} />}
            {g.phase === 'attack' && playing && <AttackPanel g={g} />}
            {g.phase === 'claims' && playing && <ClaimsPanel g={g} />}
            {(g.phase === 'report' || !playing) && <CityPanel g={g} />}
          </aside>
        )}
      </div>

      {playing && g.phase === 'report' && <ReportModal g={g} onNext={() => g.nextDay()} onResearch={() => openOv('research')} />}
      {(g.status === 'won' || g.status === 'lost') && ov === null && (
        <EndModal g={g} onContinue={() => g.continueEndless()} onRetry={() => openOv('setup')} onTitle={quit} onPerks={() => openOv('perks')} />
      )}
      {ov === 'setup' && <SetupModal g={g} onStart={startRun} onClose={closeOv} />}
      {ov === 'help' && <HelpModal onClose={closeOv} />}
      {ov === 'settings' && <SettingsModal g={g} onClose={closeOv} />}
      {ov === 'research' && <ResearchModal g={g} onClose={closeOv} />}
      {ov === 'perks' && <PerksModal g={g} onClose={closeOv} />}
      {ov === 'pause' && (
        <PauseModal
          g={g}
          onResume={() => setOv(null)}
          onHelp={() => openOv('help')}
          onSettings={() => openOv('settings')}
          onRestart={restartRun}
          onQuit={quit}
        />
      )}
    </div>
  );
}
