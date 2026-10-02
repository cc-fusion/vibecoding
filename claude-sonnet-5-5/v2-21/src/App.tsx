import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteSave, loadSave, loadSettings, newSave, persistSave, persistSettings, settleRun,
} from './game/data';
import type { Contract, RunSummary, Save, Settings } from './game/data';
import type { RouteLeg, RunResult } from './game/engine';
import { audio } from './game/audio';
import { GameView } from './ui/GameView';
import { MapScreen, Planner, TitleScreen } from './ui/Menus';
import { Factions, GameOver, Results, Shop, Victory } from './ui/Menus2';
import { HelpPanel, SettingsPanel } from './ui/Settings';
import { Btn, Modal } from './ui/common';

type Screen = 'title' | 'map' | 'plan' | 'shop' | 'factions' | 'play' | 'results' | 'gameover' | 'victory';
const TUT: Contract = { id: 'tutorial', district: 0, client: 'chrome', pkg: 'fragile', legs: 1, seed: 1, base: 0, title: 'Training Yard', boss: false };

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [save, setSave] = useState<Save | null>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('title');
  const [contract, setContract] = useState<Contract | null>(null);
  const [route, setRoute] = useState<RouteLeg[]>([]);
  const [runKey, setRunKey] = useState(0);
  const [tut, setTut] = useState(false);
  const [res, setRes] = useState<{ r: RunResult; s: RunSummary; c: Contract } | null>(null);
  const [dead, setDead] = useState<Save | null>(null);
  const [modal, setModal] = useState<null | 'settings' | 'help'>(null);
  const fresh = useMemo(() => newSave(), []);

  // audio unlock on first gesture
  useEffect(() => {
    const unlock = () => { audio.init(); };
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  useEffect(() => { audio.setVolumes(settings.master, settings.music, settings.sfx, settings.muted); persistSettings(settings); }, [settings]);
  useEffect(() => { if (screen !== 'play') { audio.setMode('menu'); audio.setIntensity(0, 0); audio.setMuffle(false); } }, [screen]);

  const updateSave = useCallback((s: Save) => { persistSave(s); setSave(s); }, []);
  const go = (s: Screen) => setScreen(s);

  const newCampaign = () => { deleteSave(); const s = newSave(); persistSave(s); setSave(s); setDead(null); go('map'); };
  const startTutorial = () => { setContract(TUT); setTut(true); setRoute([]); setRunKey((k) => k + 1); go('play'); };
  const startRun = (r: RouteLeg[]) => { setRoute(r); setTut(false); setRunKey((k) => k + 1); go('play'); };

  const onEnd = useCallback((r: RunResult) => {
    const c = tut ? TUT : contract!;
    if (tut && r.outcome === 'abandoned') { go(save ? 'map' : 'title'); return; }
    if (tut && r.outcome !== 'delivered') {
      setRes({ r, c, s: { outcome: r.outcome, payout: 0, fine: 0, lines: ['Training interrupted. Try again anytime from the title screen.'], repDelta: {}, notoDelta: 0, heatDelta: 0, burned: false, victory: false, unlocked: [] } });
      go('results'); return;
    }
    const { save: ns, summary } = settleRun(save ?? fresh, c, r, settings);
    setSave(ns); setRes({ r, c, s: summary }); go('results');
  }, [tut, contract, save, fresh, settings]);

  const cfg = contract ? { contract, route, save: save ?? fresh, settings, tutorial: tut } : null;
  const afterResults = () => {
    if (!res) return go('map');
    if (res.s.burned) { setDead(save); deleteSave(); setSave(null); go('gameover'); }
    else if (res.s.victory) go('victory');
    else go(save ? 'map' : 'title');
  };

  return (
    <div className="h-full w-full relative overflow-hidden">
      {screen === 'title' && (
        <TitleScreen save={save} onContinue={() => go('map')} onNew={newCampaign} onTutorial={startTutorial}
          onSettings={() => setModal('settings')} onHelp={() => setModal('help')} />
      )}
      {screen === 'map' && save && (
        <>
          <MapScreen save={save} settings={settings} onPlan={(c) => { setContract(c); go('plan'); }} onShop={() => go('shop')} onFactions={() => go('factions')}
            onMenu={() => go('title')} onSettings={() => setModal('settings')} onHelp={() => setModal('help')} />
          {!save.tutorialDone && <div className="fixed bottom-3 left-3 z-30 anim-float"><Btn solid color="#7dff6b" onClick={startTutorial}>▶ Training Yard (recommended)</Btn></div>}
        </>
      )}
      {screen === 'plan' && save && contract && (
        <Planner contract={contract} save={save} settings={settings} onSettings={setSettings} onGo={startRun} onBack={() => go('map')} />
      )}
      {screen === 'shop' && save && <Shop save={save} onSave={updateSave} onBack={() => go('map')} />}
      {screen === 'factions' && save && <Factions save={save} onBack={() => go('map')} />}
      {screen === 'play' && cfg && (
        <GameView key={runKey} cfg={cfg} settings={settings} onSettings={setSettings} onEnd={onEnd} onRestart={() => setRunKey((k) => k + 1)} />
      )}
      {screen === 'results' && res && (
        <Results result={res.r} summary={res.s} contract={res.c} onContinue={afterResults}
          onRetry={() => { setRunKey((k) => k + 1); go('play'); }} />
      )}
      {screen === 'gameover' && dead && <GameOver save={dead} onNew={newCampaign} onTitle={() => go('title')} />}
      {screen === 'victory' && save && <Victory save={save} onFree={() => go('map')} onNew={newCampaign} onTitle={() => go('title')} />}
      {modal === 'settings' && <Modal onClose={() => setModal(null)}><SettingsPanel settings={settings} onChange={setSettings} onClose={() => setModal(null)} /></Modal>}
      {modal === 'help' && <Modal onClose={() => setModal(null)} wide><HelpPanel onClose={() => setModal(null)} /></Modal>}
    </div>
  );
}
