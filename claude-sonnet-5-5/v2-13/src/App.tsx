import { useCallback, useEffect, useRef, useState } from 'react';
import GameView from './GameView';
import { HelpPanel, LedgerPanel, Modal, SetupPanel, SettingsPanel, TitleScreen } from './ui';
import type { SaveUpdater } from './ui';
import { loadSave, resetSave, writeSave } from './storage';
import type { Save } from './storage';
import type { GameConfig } from './engine';
import { sound } from './audio';

type Screen = 'title' | 'setup' | 'ledger' | 'help' | 'settings' | 'game';

export default function App() {
  const [save, setSave] = useState<Save>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>('title');
  const [cfg, setCfg] = useState<GameConfig | null>(null);
  const [runKey, setRunKey] = useState(0);

  const updateSave: SaveUpdater = useCallback((fn) => {
    const next = fn(saveRef.current);
    saveRef.current = next;
    writeSave(next);
    setSave(next);
  }, []);

  // keep audio volumes in sync with settings
  useEffect(() => {
    const s = save.settings;
    sound.setVolumes({ master: s.master, sfx: s.sfx, music: s.music, muted: s.muted });
  }, [save.settings]);

  // music mood for menus
  useEffect(() => {
    if (screen !== 'game') sound.setMood('menu');
  }, [screen]);

  // first user gesture unlocks audio
  useEffect(() => {
    const f = () => sound.init();
    window.addEventListener('pointerdown', f);
    window.addEventListener('keydown', f);
    return () => {
      window.removeEventListener('pointerdown', f);
      window.removeEventListener('keydown', f);
    };
  }, []);

  const start = (diffId: string, mods: string[], tutorial: boolean) => {
    sound.init();
    setCfg({ diffId, mods, tutorial, levels: { ...saveRef.current.levels }, shake: saveRef.current.settings.shake });
    setRunKey((k) => k + 1);
    setScreen('game');
  };

  const restart = () => {
    if (!cfg) return;
    // levels may have changed in the ledger; refresh them, tutorial only once
    setCfg({ ...cfg, tutorial: false, levels: { ...saveRef.current.levels } });
    setRunKey((k) => k + 1);
  };

  const back = () => setScreen('title');

  if (screen === 'game' && cfg) {
    return (
      <GameView
        key={runKey}
        save={save}
        updateSave={updateSave}
        cfg={cfg}
        onRestart={restart}
        onQuit={(to) => setScreen(to)}
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <TitleScreen save={save} go={(s) => setScreen(s)} />
      {screen === 'setup' && (
        <Modal title="Prepare the Descent" wide onClose={back}>
          <SetupPanel save={save} updateSave={updateSave} onStart={start} />
        </Modal>
      )}
      {screen === 'ledger' && (
        <Modal title="📖 The Ledger of Souls" wide onClose={back}>
          <LedgerPanel save={save} updateSave={updateSave} onReset={() => { const d = resetSave(); saveRef.current = d; setSave(d); }} />
        </Modal>
      )}
      {screen === 'help' && (
        <Modal title="❓ Dungeon Lord's Handbook" wide onClose={back}>
          <HelpPanel />
        </Modal>
      )}
      {screen === 'settings' && (
        <Modal title="⚙️ Settings" onClose={back}>
          <SettingsPanel save={save} updateSave={updateSave} />
        </Modal>
      )}
    </div>
  );
}
