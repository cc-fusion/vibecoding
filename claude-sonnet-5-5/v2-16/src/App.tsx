import { useEffect, useState } from 'react';
import { TitleScreen, SetupScreen, LegacyScreen, HelpModal, SettingsModal } from './ui/Screens';
import GameView from './ui/GameView';
import type { GameOpts } from './game/sim';
import { audio } from './game/audio';

type Screen = 'title' | 'setup' | 'legacy' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [opts, setOpts] = useState<GameOpts | null>(null);
  const [key, setKey] = useState(0);
  const [modal, setModal] = useState<null | 'help' | 'settings'>(null);

  // unlock audio on first gesture and start ambient music
  useEffect(() => {
    const unlock = () => { audio.init(); audio.startMusic(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  const start = (o: GameOpts) => { setOpts(o); setKey((k) => k + 1); setScreen('game'); };
  const defaults = (tutorial: boolean): GameOpts => ({ seed: 1865, diffId: tutorial ? 'settler' : 'railroader', mods: [], name: 'Frontier & Western', tutorial });

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1b120b]">
      {screen === 'title' && <TitleScreen onNew={() => setScreen('setup')} onTutorial={() => start(defaults(true))} onLegacy={() => setScreen('legacy')} onHelp={() => setModal('help')} onSettings={() => setModal('settings')} />}
      {screen === 'setup' && <SetupScreen onStart={start} onBack={() => setScreen('title')} />}
      {screen === 'legacy' && <LegacyScreen onBack={() => setScreen('title')} />}
      {screen === 'game' && opts && (
        <GameView key={key} opts={opts} onAgain={() => setKey((k) => k + 1)} onSetup={() => setScreen('setup')} onTitle={() => setScreen('title')} />
      )}
      {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
      {modal === 'settings' && <SettingsModal onClose={() => setModal(null)} />}
    </div>
  );
}
