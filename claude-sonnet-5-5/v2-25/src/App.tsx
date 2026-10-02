import { useCallback, useEffect, useRef, useState } from 'react';
import { Game } from './game/engine';
import { DIFFICULTIES, UPGRADES } from './game/data';
import { audio } from './game/audio';
import { loadSave, writeSave } from './game/save';
import type { SaveData } from './game/save';
import { Title, Setup, DarkArts, Help, SettingsPanel } from './ui/Menus';
import GameView from './ui/GameView';

type Screen = 'title' | 'setup' | 'dark' | 'play';

export default function App() {
  const [save, setSaveState] = useState<SaveData>(() => loadSave());
  const saveRef = useRef(save);
  const [screen, setScreen] = useState<Screen>('title');
  const [overlay, setOverlay] = useState<null | 'help' | 'settings'>(null);
  const [diffId, setDiffId] = useState('necromancer');
  const [mods, setMods] = useState<string[]>([]);
  const [game, setGame] = useState<Game | null>(null);
  const [runKey, setRunKey] = useState(0);
  const cfg = useRef({ diffId: 'necromancer', mods: [] as string[], tutorial: false });

  const persist = useCallback((s: SaveData) => {
    saveRef.current = s;
    setSaveState(s);
    writeSave(s);
  }, []);

  // first user gesture unlocks audio; title ambience
  useEffect(() => {
    const unlock = () => {
      const s = saveRef.current.settings;
      audio.init();
      audio.setVolumes({ master: s.master, music: s.music, sfx: s.sfx, muted: s.muted });
      audio.startMusic();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => {
    if (screen !== 'play') audio.setMood(0, 0.05, false);
  }, [screen]);

  const startRun = useCallback((tutorial: boolean, reuse = false) => {
    if (!reuse) cfg.current = { diffId: tutorial ? 'apprentice' : diffId, mods: tutorial ? [] : mods, tutorial };
    const c = cfg.current;
    const diff = DIFFICULTIES.find((d) => d.id === c.diffId) || DIFFICULTIES[1];
    const s = saveRef.current;
    if (c.tutorial && !s.settings.tutorialSeen) persist({ ...s, settings: { ...s.settings, tutorialSeen: true } });
    audio.init();
    const g = new Game({ diff, mods: c.mods, upgrades: { ...saveRef.current.upgrades }, tutorial: c.tutorial });
    setGame(g);
    setRunKey((k) => k + 1);
    setScreen('play');
    audio.sfx('select');
  }, [diffId, mods, persist]);

  const buy = (id: string) => {
    const u = UPGRADES.find((x) => x.id === id);
    const s = saveRef.current;
    if (!u) return;
    const lvl = s.upgrades[id] || 0;
    if (lvl >= u.max || (u.requires && !(s.upgrades[u.requires] > 0))) return;
    const cost = u.cost[lvl];
    if (s.shards < cost) { audio.sfx('error'); return; }
    persist({ ...s, shards: s.shards - cost, upgrades: { ...s.upgrades, [id]: lvl + 1 } });
    audio.sfx('upgrade');
  };

  const toggleMod = (id: string) => setMods((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0d10]">
      {screen === 'title' && (
        <Title save={save} onPlay={() => setScreen('setup')} onTutorial={() => startRun(true)} onDark={() => setScreen('dark')}
          onHelp={() => setOverlay('help')} onSettings={() => setOverlay('settings')} />
      )}
      {screen === 'setup' && (
        <Setup save={save} diffId={diffId} mods={mods} setDiff={setDiffId} toggleMod={toggleMod} onStart={() => startRun(false)} onBack={() => setScreen('title')} />
      )}
      {screen === 'dark' && <DarkArts save={save} onBuy={buy} onBack={() => setScreen('title')} />}
      {screen === 'play' && game && (
        <GameView key={runKey} game={game} save={save} onSave={persist}
          onRetry={() => startRun(cfg.current.tutorial, true)}
          onTitle={() => { setScreen('title'); setGame(null); }}
          onDark={() => { setScreen('dark'); setGame(null); }} />
      )}
      {screen !== 'play' && overlay === 'help' && <Help onClose={() => setOverlay(null)} />}
      {screen !== 'play' && overlay === 'settings' && <SettingsPanel save={save} onChange={persist} onClose={() => setOverlay(null)} />}
    </div>
  );
}
