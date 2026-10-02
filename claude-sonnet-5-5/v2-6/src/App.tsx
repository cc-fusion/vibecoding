import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type Snapshot, type Overlay } from './game/game';
import { TOOLS, UPGRADES, upgradeCost, defaultSave, loadSave, writeSave, type EndResult, type RunConfig, type SaveData, type Settings, type ToolId } from './game/data';
import { Hud } from './game/hud';
import { EndScreen, HelpModal, NewGameModal, PauseMenu, SanctumModal, SettingsModal, TitleScreen } from './game/screens';

type Tab = 'tribes' | 'diplomacy' | 'log';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [stack, setStack] = useState<string[]>([]);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<EndResult | null>(null);
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1280);
  const [panelOpen, setPanelOpen] = useState(typeof window !== 'undefined' && window.innerWidth >= 1280);
  const [tab, setTab] = useState<Tab>('tribes');
  const [selTribe, setSelTribe] = useState(0);
  const [topH, setTopH] = useState(56);
  const [dockH, setDockH] = useState(64);
  const lastCfg = useRef<RunConfig>({ diff: 'standard', mods: [], tutorial: false });
  const desktop = vw >= 1024;

  const persist = useCallback((s: SaveData) => {
    saveRef.current = s; setSave(s); writeSave(s); gameRef.current?.setMeta(s);
  }, []);

  // engine lifecycle
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const g = new Game(canvas, saveRef.current);
    gameRef.current = g;
    g.onEnd = (r) => {
      const s = saveRef.current;
      persist({ ...s, insight: s.insight + r.insight, best: Math.max(s.best, r.score), runs: s.runs + 1, wins: s.wins + (r.victory ? 1 : 0) });
      setResult(r);
    };
    g.onAutoPause = () => setStack((st) => (st.length ? st : ['pause']));
    const iv = window.setInterval(() => { if (g.state !== 'attract') setSnap(g.snapshot()); }, 100);
    const onResize = () => setVw(window.innerWidth);
    const onGesture = () => g.audio.init();
    const onClick = (e: MouseEvent) => { if ((e.target as HTMLElement)?.closest?.('button')) g.audio.sfx('click', 1, true); };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onGesture);
    window.addEventListener('keydown', onGesture);
    document.addEventListener('click', onClick, true);
    return () => {
      window.clearInterval(iv); window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onGesture); window.removeEventListener('keydown', onGesture);
      document.removeEventListener('click', onClick, true);
      g.destroy(); gameRef.current = null;
    };
  }, [persist]);

  // layout insets
  useEffect(() => {
    const g = gameRef.current; if (!g) return;
    if (screen === 'title') g.setInsets({ top: 0, right: 0, bottom: 0, left: 0 });
    else if (desktop) g.setInsets({ top: topH + 8, left: 68, right: panelOpen ? 340 : 0, bottom: 28 });
    else g.setInsets({ top: topH + 8, left: 4, right: 4, bottom: dockH + 12 });
  }, [screen, desktop, panelOpen, topH, dockH]);

  useEffect(() => { const g = gameRef.current; if (g) g.tutPanelOpen = panelOpen && screen === 'game'; }, [panelOpen, screen]);

  // actions
  const startGame = useCallback((cfg: RunConfig) => {
    const g = gameRef.current; if (!g) return;
    lastCfg.current = cfg; g.audio.init(); g.start(cfg);
    setScreen('game'); setStack([]); setResult(null); setSnap(g.snapshot());
    setPanelOpen(window.innerWidth >= 1280); setTab('tribes');
  }, []);
  const openPause = useCallback(() => { const g = gameRef.current; if (!g || g.state !== 'playing') return; g.setPaused(true); setStack(['pause']); }, []);
  const resume = useCallback(() => { gameRef.current?.setPaused(false); setStack([]); }, []);
  const push = (k: string) => setStack((s) => [...s, k]);
  const closeTop = useCallback(() => {
    setStack((s) => {
      const n = s.slice(0, -1);
      if (n.length === 0 && screen === 'game') gameRef.current?.setPaused(false);
      return n;
    });
  }, [screen]);
  const quit = () => { gameRef.current?.toAttract(); setScreen('title'); setStack([]); setResult(null); setSnap(null); };
  const setSettings = (st: Settings) => persist({ ...saveRef.current, settings: st });
  const toggleMute = () => { const s = saveRef.current; persist({ ...s, settings: { ...s.settings, muted: !s.settings.muted } }); };
  const setTool = (t: ToolId) => gameRef.current?.setTool(t);
  const setOverlay = (o: Overlay) => gameRef.current?.setOverlay(o);
  const cycleSpeed = () => { const g = gameRef.current; if (g) g.setSpeed(g.speed >= 3 ? 1 : g.speed + 1); };
  const tutDone = () => { gameRef.current?.finishTutorial(); persist({ ...saveRef.current, tutorialDone: true }); };

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current; if (!g) return;
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = e.key;
      if (k === 'Escape') {
        e.preventDefault();
        if (stack.length) { if (stack[stack.length - 1] === 'pause') resume(); else closeTop(); }
        else if (screen === 'game' && !result) openPause();
        return;
      }
      if (k === 'm' || k === 'M') { toggleMute(); return; }
      if (screen !== 'game' || result) return;
      if (k === ' ') { e.preventDefault(); if (stack.length === 0) openPause(); else if (stack.length === 1 && stack[0] === 'pause') resume(); return; }
      if (stack.length) return;
      if (k === 'Tab') { e.preventDefault(); g.cycleOverlay(); return; }
      if (k === 't' || k === 'T') { setPanelOpen((v) => !v); return; }
      if (k === 'f' || k === 'F') { cycleSpeed(); return; }
      if (k === 'h' || k === 'H') { g.setPaused(true); setStack(['pause', 'help']); return; }
      const tool = TOOLS.find((t) => t.key === k);
      if (tool) setTool(tool.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stack, screen, result, openPause, resume, closeTop]);

  const top = stack[stack.length - 1];
  const g = gameRef.current;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07091a]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {screen === 'game' && snap && (
        <Hud
          snap={snap} save={save} topH={topH} onTopH={setTopH} onDockH={setDockH} desktop={desktop}
          panelOpen={panelOpen} setPanelOpen={setPanelOpen} tab={tab} setTab={setTab} selTribe={selTribe} setSelTribe={setSelTribe}
          onTool={setTool} onOverlay={setOverlay} onPause={openPause} onSpeed={cycleSpeed} onMute={toggleMute}
          onResearch={(t, id) => gameRef.current?.selectResearch(t, id)} onTutSkip={tutDone} onTutFinish={tutDone}
        />
      )}
      {screen === 'title' && !top && (
        <TitleScreen save={save} onPlay={() => push('newgame')} onTutorial={() => startGame({ diff: 'gentle', mods: [], tutorial: true })} onHelp={() => push('help')} onSettings={() => push('settings')} onSanctum={() => push('sanctum')} />
      )}
      {screen === 'game' && result && !top && (
        <EndScreen r={result} save={save}
          onRetry={() => startGame({ ...lastCfg.current, tutorial: false })}
          onTitle={quit} onSanctum={() => push('sanctum')}
          onContinue={() => { g?.continueEndless(); setResult(null); }} />
      )}
      {top === 'pause' && <PauseMenu onResume={resume} onHelp={() => push('help')} onSettings={() => push('settings')} onRestart={() => startGame(lastCfg.current)} onQuit={quit} />}
      {top === 'help' && <HelpModal onClose={closeTop} />}
      {top === 'newgame' && (
        <NewGameModal save={save} onClose={closeTop} onStart={(diff, mods) => { persist({ ...saveRef.current, diff, mods }); startGame({ diff, mods, tutorial: false }); }} />
      )}
      {top === 'settings' && (
        <SettingsModal save={save} onSettings={setSettings} inGame={screen === 'game'} diff={snap?.diff ?? save.diff} mods={snap?.mods ?? save.mods}
          onDifficulty={(diff, mods) => { gameRef.current?.setDifficulty(diff, mods); persist({ ...saveRef.current, diff, mods }); if (gameRef.current) setSnap(gameRef.current.snapshot()); }}
          onClose={closeTop} onReset={() => persist(defaultSave())} />
      )}
      {top === 'sanctum' && (
        <SanctumModal save={save} onClose={closeTop}
          onBuyUpgrade={(id) => {
            const s = saveRef.current;
            const u = UPGRADES.find((x) => x.id === id); if (!u) return;
            const lvl = s.upgrades[id] || 0; const c = upgradeCost(u, lvl);
            if (lvl >= u.max || s.insight < c) return;
            persist({ ...s, insight: s.insight - c, upgrades: { ...s.upgrades, [id]: lvl + 1 } });
          }}
          onUnlock={(id) => {
            const s = saveRef.current; const t = TOOLS.find((x) => x.id === id);
            if (!t || s.insight < t.unlock || s.unlocked.includes(id)) return;
            persist({ ...s, insight: s.insight - t.unlock, unlocked: [...s.unlocked, id] });
          }} />
      )}
    </div>
  );
}
