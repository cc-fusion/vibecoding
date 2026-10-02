import { useEffect, useRef, useState } from 'react';
import { PERKS, WORLDS } from './game/data';
import { audio } from './game/audio';
import { loadMeta, saveMeta } from './game/save';
import type { Meta, Settings } from './game/save';
import type { RunConfig } from './game/sim';
import GameView from './components/GameView';
import { HelpModal, SettingsModal } from './components/Overlays';
import type { EndSummary } from './components/Overlays';
import { LegacyScreen, SetupScreen, TitleScreen } from './components/Screens';

type Screen = 'title' | 'setup' | 'legacy' | 'game';

export default function App() {
  const [meta, setMeta] = useState<Meta>(loadMeta);
  const [screen, setScreen] = useState<Screen>('title');
  const [cfg, setCfg] = useState<RunConfig | null>(null);
  const [runId, setRunId] = useState(0);
  const [modal, setModal] = useState<null | 'help' | 'settings'>(null);
  const cfgRef = useRef<RunConfig | null>(null);
  cfgRef.current = cfg;

  const update = (fn: (m: Meta) => Meta) => {
    setMeta((prev) => {
      const next = fn(prev);
      saveMeta(next);
      return next;
    });
  };

  useEffect(() => { audio.setVolumes(meta.settings); }, [meta.settings]);

  // title ambience (only after a user gesture has created the audio context)
  useEffect(() => {
    if (screen !== 'game' && audio.ctx) {
      audio.setMood(0.12, 0, 0, 0.25);
      audio.startMusic();
    }
  }, [screen]);

  const onFirstGesture = () => {
    if (!audio.ctx) {
      audio.init();
      audio.setVolumes(meta.settings);
      if (screen !== 'game') {
        audio.setMood(0.12, 0, 0, 0.25);
        audio.startMusic();
      }
    }
  };

  const setSettings = (s: Settings) => update((m) => ({ ...m, settings: s }));

  const startRun = (c: RunConfig, diff: string, mods: string[], world: string) => {
    update((m) => ({ ...m, lastDiff: diff, lastMods: mods, lastWorld: world }));
    setCfg(c);
    setRunId((r) => r + 1);
    setScreen('game');
  };

  const onRunEnd = (s: EndSummary) => {
    const c = cfgRef.current;
    update((m) => {
      const key = `${c?.world ?? 'x'}|${c?.diff ?? 'x'}`;
      const prev = m.bests[key];
      const bests = { ...m.bests };
      if (!prev || s.score > prev.score) {
        bests[key] = { world: s.world, diff: s.diff, years: s.years, peakH: s.peakH, pop: s.peakPop, win: s.win || (prev?.win ?? false), score: s.score };
      }
      let unlocked = m.unlocked;
      if (s.win && c) {
        const next = WORLDS.find((w) => w.unlockBy === c.world);
        if (next && !unlocked.includes(next.id)) unlocked = [...unlocked, next.id];
      }
      return { ...m, lp: m.lp + s.lp, runs: m.runs + 1, wins: m.wins + (s.win ? 1 : 0), totalYears: m.totalYears + s.years, bests, unlocked };
    });
  };

  const buyPerk = (id: string) => {
    const p = PERKS.find((q) => q.id === id);
    if (!p) return;
    update((m) => {
      const lvl = m.perks[id] ?? 0;
      const cost = p.cost * (lvl + 1);
      if (lvl >= p.max || m.lp < cost) return m;
      audio.sfx('research');
      return { ...m, lp: m.lp - cost, spent: m.spent + cost, perks: { ...m.perks, [id]: lvl + 1 } };
    });
  };

  const unlockWorld = (id: string) => {
    const w = WORLDS.find((q) => q.id === id);
    if (!w) return;
    update((m) => {
      if (m.unlocked.includes(id) || m.lp < w.unlockCost) return m;
      audio.sfx('milestone');
      return { ...m, lp: m.lp - w.unlockCost, spent: m.spent + w.unlockCost, unlocked: [...m.unlocked, id] };
    });
  };

  return (
    <div className="relative h-full w-full" onPointerDownCapture={onFirstGesture}>
      {screen === 'title' && (
        <TitleScreen meta={meta} onNew={() => setScreen('setup')} onLegacy={() => setScreen('legacy')} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} />
      )}
      {screen === 'setup' && <SetupScreen meta={meta} onStart={startRun} onBack={() => setScreen('title')} onUnlock={unlockWorld} />}
      {screen === 'legacy' && <LegacyScreen meta={meta} onBuy={buyPerk} onUnlock={unlockWorld} onBack={() => setScreen('title')} />}
      {screen === 'game' && cfg && (
        <GameView
          key={runId}
          cfg={{ ...cfg, perks: meta.perks }}
          settings={meta.settings}
          onSettings={setSettings}
          tutorial={!meta.settings.tutorialDone}
          onTutorialDone={() => setSettings({ ...meta.settings, tutorialDone: true })}
          onRunEnd={onRunEnd}
          onRestart={() => setRunId((r) => r + 1)}
          onQuit={() => setScreen('title')}
        />
      )}
      {screen !== 'game' && modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
      {screen !== 'game' && modal === 'settings' && <SettingsModal settings={meta.settings} onChange={setSettings} onClose={() => setModal(null)} />}
    </div>
  );
}
