import { useCallback, useEffect, useState } from 'react';
import GameView, { type RunConfig } from './components/GameView';
import Help from './components/Help';
import Legacy from './components/Legacy';
import SettingsPanel from './components/SettingsPanel';
import { SetupModal, Title, type Setup } from './components/Title';
import { audio } from './game/audio';
import { loadSave, resetSave, writeSave, type SaveData, type Settings } from './game/save';

type Screen = 'title' | 'setup' | 'legacy' | 'help' | 'settings' | 'game';

export default function App() {
  const [save, setSave] = useState<SaveData>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('title');
  const [setup, setSetup] = useState<Setup>({ diff: 'engineer', mods: { storm: false, frenzy: false, brown: false } });
  const [cfg, setCfg] = useState<RunConfig | null>(null);
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    audio.setVolumes(save.settings);
  }, [save.settings]);

  const update = useCallback((s: SaveData) => {
    writeSave(s);
    setSave(s);
  }, []);

  const setSettings = useCallback(
    (s: Settings) => {
      const cur = loadSave();
      update({ ...cur, settings: s });
    },
    [update],
  );

  const wake = () => {
    audio.ensure();
    audio.startMusic();
  };

  const start = (c: RunConfig) => {
    wake();
    setCfg(c);
    setRunId((i) => i + 1);
    setScreen('game');
  };

  const retry = () => {
    if (!cfg) return;
    setCfg({ ...cfg, seed: Math.floor(Math.random() * 1e9) });
    setRunId((i) => i + 1);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 select-none" onPointerDown={wake}>
      {screen !== 'game' && (
        <>
          <Title
            save={save}
            onPlay={() => setScreen('setup')}
            onTutorial={() => start({ diff: 'engineer', mods: { storm: false, frenzy: false, brown: false }, tutorial: true, seed: Math.floor(Math.random() * 1e9) })}
            onLegacy={() => setScreen('legacy')}
            onHelp={() => setScreen('help')}
            onSettings={() => setScreen('settings')}
          />
          {screen === 'setup' && (
            <SetupModal
              setup={setup}
              onChange={setSetup}
              onClose={() => setScreen('title')}
              onStart={() => start({ diff: setup.diff, mods: setup.mods, tutorial: false, seed: Math.floor(Math.random() * 1e9) })}
            />
          )}
          {screen === 'legacy' && <Legacy save={save} onChange={update} onClose={() => setScreen('title')} />}
          {screen === 'help' && <Help onClose={() => setScreen('title')} />}
          {screen === 'settings' && (
            <SettingsPanel
              settings={save.settings}
              onChange={setSettings}
              onClose={() => setScreen('title')}
              onReset={() => setSave(resetSave())}
            />
          )}
        </>
      )}
      {screen === 'game' && cfg && (
        <GameView
          key={runId}
          cfg={cfg}
          settings={save.settings}
          onSettings={setSettings}
          save={save}
          onSave={update}
          onRetry={retry}
          onTitle={() => setScreen('title')}
        />
      )}
    </div>
  );
}
