import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSave } from './game/save';
import type { SaveData } from './game/save';
import { audio } from './game/audio';
import type { RunConfig, RunResult } from './game/engine';
import { Conservatory, HelpPanel, ResultScreen, SettingsPanel, TitleScreen, applyAudio } from './ui/Menus';
import GameScreen from './ui/GameScreen';

type Screen = 'title' | 'map' | 'game' | 'result';

export default function App() {
  const saveRef = useRef<SaveData>(null as unknown as SaveData);
  if (!saveRef.current) saveRef.current = loadSave();
  const save = saveRef.current;
  const [, setVer] = useState(0);
  const refresh = useCallback(() => setVer((v) => v + 1), []);
  const [screen, setScreen] = useState<Screen>('title');
  const [cfg, setCfg] = useState<RunConfig>({ levelId: 0, diff: 'allegro', mods: [] });
  const [runKey, setRunKey] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const interacted = useRef(false);
  const screenRef = useRef<Screen>('title');
  screenRef.current = screen;

  useEffect(() => { applyAudio(saveRef.current); }, []);

  // menu music starts after the first user gesture (browser autoplay rules)
  useEffect(() => {
    const first = () => {
      if (interacted.current) return;
      interacted.current = true;
      audio.ensure();
      if (screenRef.current !== 'game') audio.startMenu();
    };
    window.addEventListener('pointerdown', first);
    window.addEventListener('keydown', first);
    return () => {
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
    };
  }, []);

  useEffect(() => {
    if (screen === 'game') audio.stopMenu();
    else if (interacted.current) audio.startMenu();
  }, [screen]);

  // modal Escape handling for menus
  useEffect(() => {
    if (screen === 'game') return;
    const h = (e: KeyboardEvent) => {
      if (e.code === 'Escape') { if (settings) setSettings(false); else if (help) setHelp(false); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [screen, settings, help]);

  const start = (c: RunConfig) => {
    audio.ensure();
    audio.sfx('click');
    setCfg(c);
    setResult(null);
    setRunKey((k) => k + 1);
    setScreen('game');
  };

  const toggleMute = () => {
    save.settings.muted = !save.settings.muted;
    applyAudio(save);
    refresh();
  };

  const nextAvailable = result && result.victory && !result.tutorial && result.levelId < 4;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {screen === 'title' && (
        <TitleScreen
          save={save}
          onPlay={() => { audio.sfx('click'); setScreen('map'); }}
          onTutorial={() => start({ levelId: -1, diff: 'allegro', mods: [], tutorial: true })}
          onHelp={() => { audio.sfx('click'); setHelp(true); }}
          onSettings={() => { audio.sfx('click'); setSettings(true); }}
          onToggleMute={toggleMute}
        />
      )}
      {screen === 'map' && (
        <Conservatory
          save={save}
          refresh={refresh}
          onStart={(levelId, diff, mods) => start({ levelId, diff, mods })}
          onTitle={() => { audio.sfx('click'); setScreen('title'); }}
          onTutorial={() => start({ levelId: -1, diff: 'allegro', mods: [], tutorial: true })}
          onSettings={() => { audio.sfx('click'); setSettings(true); }}
        />
      )}
      {screen === 'game' && (
        <GameScreen
          key={runKey}
          save={save}
          cfg={cfg}
          refresh={refresh}
          onEnd={(r) => { setResult(r); refresh(); setScreen('result'); }}
          onQuit={() => setScreen(cfg.tutorial ? 'title' : 'map')}
          onRestart={() => start(cfg)}
        />
      )}
      {screen === 'result' && result && (
        <ResultScreen
          result={result}
          save={save}
          onRetry={() => start(cfg)}
          onNext={nextAvailable ? () => start({ levelId: result.levelId + 1, diff: cfg.diff, mods: cfg.mods }) : null}
          onMap={() => { audio.sfx('click'); setScreen(result.tutorial ? 'map' : 'map'); }}
          onTitle={() => { audio.sfx('click'); setScreen('title'); }}
        />
      )}
      {screen !== 'game' && settings && <SettingsPanel save={save} onChange={refresh} onClose={() => setSettings(false)} />}
      {screen !== 'game' && help && <HelpPanel onClose={() => setHelp(false)} />}
    </div>
  );
}
