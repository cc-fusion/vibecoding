import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Game } from './game/game';
import { listWorlds, deleteWorld, saveMeta, loadSettings, saveSettings, type WorldMeta, type Settings } from './game/storage';
import { GameUI } from './ui/GameUI';
import { SettingsPanel } from './ui/Settings';

function GameView({ meta, settings, setSettings, onQuit }: { meta: WorldMeta; settings: Settings; setSettings: (s: Settings) => void; onQuit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  useEffect(() => {
    const g = new Game(ref.current!, meta, settings);
    setGame(g);
    (window as unknown as { game: Game }).game = g;
    const unload = () => g.save();
    window.addEventListener('beforeunload', unload);
    return () => { window.removeEventListener('beforeunload', unload); g.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.id]);
  useEffect(() => { game?.applySettings(settings); }, [settings, game]);
  return (
    <div className="fixed inset-0 bg-black">
      <div ref={ref} className="absolute inset-0" />
      {game && <UIHost game={game} onQuit={onQuit} settings={settings} setSettings={setSettings} />}
    </div>
  );
}

function UIHost({ game, onQuit, settings, setSettings }: { game: Game; onQuit: () => void; settings: Settings; setSettings: (s: Settings) => void }) {
  const ui = useSyncExternalStore(game.subscribe, game.getUI);
  return <GameUI game={game} ui={ui} onQuit={onQuit} settings={settings} setSettings={setSettings} />;
}

function Menu({ onPlay, settings, setSettings }: { onPlay: (m: WorldMeta) => void; settings: Settings; setSettings: (s: Settings) => void }) {
  const [worlds, setWorlds] = useState(listWorlds());
  const [view, setView] = useState<'home' | 'create' | 'settings'>(worlds.length ? 'home' : 'home');
  const [name, setName] = useState('New World');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<'survival' | 'creative'>('survival');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const create = () => {
    const s = seed.trim();
    const numSeed = s === '' ? Math.floor(Math.random() * 2 ** 31) : /^-?\d+$/.test(s) ? parseInt(s) : [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 7);
    const meta: WorldMeta = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim() || 'World', seed: numSeed, mode, created: Date.now(), lastPlayed: Date.now() };
    saveMeta(meta);
    onPlay(meta);
  };

  return (
    <div className="fixed inset-0 overflow-hidden font-pixel text-white">
      <div className="absolute inset-0 bg-cover bg-center scale-110 animate-[pan_60s_ease-in-out_infinite_alternate]" style={{ backgroundImage: 'url(/title-bg.jpg)' }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/60" />
      <div className="relative h-full flex flex-col items-center pt-[8vh] gap-6">
        <div className="text-center">
          <h1 className="mc-title text-7xl md:text-8xl tracking-wide">VOXELCRAFT</h1>
          <div className="text-[#ffff55] text-2xl -rotate-6 animate-pulse translate-x-48 -translate-y-3" style={{ textShadow: '2px 2px 0 #3f3f00' }}>Now with TNT!</div>
        </div>

        {view === 'home' && (
          <div className="w-[min(560px,92vw)] flex flex-col gap-3">
            <div className="mc-panel-dark p-3 max-h-[40vh] overflow-auto flex flex-col gap-2">
              {worlds.length === 0 && <div className="text-center text-gray-300 text-xl py-6">No worlds yet — create one to begin your adventure.</div>}
              {worlds.map(w => (
                <div key={w.id} className="flex items-center gap-3 bg-black/40 border-2 border-white/10 hover:border-white/60 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl truncate">{w.name}</div>
                    <div className="text-gray-400 text-lg">{w.mode === 'creative' ? 'Creative' : 'Survival'} · Seed {w.seed} · Day {(w.days ?? 0) + 1} · {new Date(w.lastPlayed).toLocaleDateString()}</div>
                  </div>
                  {confirmDel === w.id ? (
                    <>
                      <button className="mc-btn !px-3 !bg-[#8a2020]" onClick={() => { deleteWorld(w.id); setWorlds(listWorlds()); setConfirmDel(null); }}>Delete</button>
                      <button className="mc-btn !px-3" onClick={() => setConfirmDel(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button className="mc-btn !px-5" onClick={() => onPlay(w)}>Play</button>
                      <button className="mc-btn !px-3" title="Delete world" onClick={() => setConfirmDel(w.id)}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
            <button className="mc-btn w-full" onClick={() => setView('create')}>Create New World</button>
            <button className="mc-btn w-full" onClick={() => setView('settings')}>Options…</button>
          </div>
        )}

        {view === 'create' && (
          <div className="mc-panel-dark p-5 w-[min(480px,92vw)] flex flex-col gap-3 text-xl">
            <label className="flex flex-col gap-1">World Name<input className="mc-input" value={name} onChange={e => setName(e.target.value)} maxLength={32} /></label>
            <label className="flex flex-col gap-1">Seed (blank for random)<input className="mc-input" value={seed} onChange={e => setSeed(e.target.value)} placeholder="e.g. 12345 or 'mountains'" /></label>
            <div className="flex gap-2">
              {(['survival', 'creative'] as const).map(m => (
                <button key={m} className={`mc-btn flex-1 ${mode === m ? '!border-white !bg-[#5a7a3a]' : ''}`} onClick={() => setMode(m)}>{m === 'survival' ? 'Survival' : 'Creative'}</button>
              ))}
            </div>
            <div className="text-gray-300 text-lg leading-tight">{mode === 'survival' ? 'Gather resources, craft tools, manage health and hunger, and survive zombies at night.' : 'Unlimited blocks, instant breaking, flight, and no damage. Build freely.'}</div>
            <div className="flex gap-2 mt-2">
              <button className="mc-btn flex-1" onClick={create}>Create World</button>
              <button className="mc-btn flex-1" onClick={() => setView('home')}>Cancel</button>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="mc-panel p-5 w-[min(460px,92vw)] text-[#3f3f3f]">
            <SettingsPanel settings={settings} onChange={setSettings} />
            <button className="mc-btn w-full mt-3" onClick={() => setView('home')}>Done</button>
          </div>
        )}
        <div className="absolute bottom-2 left-3 text-white/70 text-lg">VoxelCraft v1.0 · Three.js</div>
        <div className="absolute bottom-2 right-3 text-white/70 text-lg">Worlds save in your browser</div>
      </div>
    </div>
  );
}

export default function App() {
  const [playing, setPlaying] = useState<WorldMeta | null>(null);
  const [settings, setSettingsState] = useState<Settings>(loadSettings());
  const setSettings = (s: Settings) => { setSettingsState(s); saveSettings(s); };
  if (playing) return <GameView meta={playing} settings={settings} setSettings={setSettings} onQuit={() => setPlaying(null)} />;
  return <Menu onPlay={setPlaying} settings={settings} setSettings={setSettings} />;
}
