import { useEffect, useMemo, useState } from 'react';
import GameView from './ui/GameView';
import { listWorlds, saveWorldMeta, deleteWorld, loadSettings, WorldMeta, GameMode } from './game/storage';
import { hashString } from './game/noise';
import { buildAtlas, tileOf, ATLAS_COLS, TILE } from './game/blocks';
import { audio } from './game/audio';

function tileDataURL(name: string, dark = 0.55) {
  const atlas = buildAtlas(); const i = tileOf(name);
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d')!; c.imageSmoothingEnabled = false;
  c.drawImage(atlas, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE, 16, 16, 0, 0, 64, 64);
  c.fillStyle = `rgba(0,0,0,${dark})`; c.fillRect(0, 0, 64, 64);
  return cv.toDataURL();
}
const SPLASHES = ['Now with weather!', 'Procedurally painted!', '100% voxels!', 'Mind the zombies!', 'Punch trees!', 'Infinite-ish!', 'Diamonds below Y=16!', 'Torches help!'];

export default function App() {
  const [worlds, setWorlds] = useState<WorldMeta[]>(listWorlds());
  const [playing, setPlaying] = useState<WorldMeta | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('New World');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<GameMode>('survival');
  const [settings] = useState(loadSettings);
  const splash = useMemo(() => SPLASHES[Math.floor(Math.random() * SPLASHES.length)], []);

  useEffect(() => {
    document.documentElement.style.setProperty('--dirt', `url(${tileDataURL('dirt')})`);
    document.documentElement.style.setProperty('--stone', `url(${tileDataURL('stone', 0.2)})`);
  }, []);

  const create = () => {
    const seedText = seed.trim() || String(Math.floor(Math.random() * 1e9));
    const n = /^-?\d+$/.test(seedText) ? Number(seedText) | 0 : hashString(seedText);
    const m: WorldMeta = { id: Date.now().toString(36), name: name.trim() || 'New World', seed: n, seedText, mode, created: Date.now(), played: Date.now() };
    saveWorldMeta(m); setCreating(false); audio.init(); setPlaying(m);
  };

  if (playing) return <GameView meta={playing} settings={settings} onQuit={() => { setPlaying(null); setWorlds(listWorlds()); }} />;

  return (
    <div className="fixed inset-0 mc-dirt flex flex-col items-center overflow-y-auto py-10">
      <div className="relative mb-10 mt-6">
        <h1 className="mc-logo text-6xl md:text-7xl">VOXELCRAFT</h1>
        <div className="absolute -right-6 bottom-0 text-yellow-300 mc-text text-lg rotate-[-18deg] animate-pulse">{splash}</div>
      </div>
      {!creating ? (
        <div className="w-[min(560px,92vw)] flex flex-col gap-2">
          <button className="mc-btn w-full" onClick={() => setCreating(true)}>Create New World</button>
          <div className="mc-label text-white mt-4 mb-1 mc-text">Your Worlds</div>
          {worlds.length === 0 && <div className="mc-text text-sm opacity-70">No worlds yet — create one to begin.</div>}
          {worlds.map((w) => (
            <div key={w.id} className="flex items-center gap-2 bg-black/50 border-2 border-black/70 p-2 hover:border-white/60">
              <div className="flex-1 mc-text">
                <div>{w.name}</div>
                <div className="text-xs opacity-70">{w.mode === 'creative' ? 'Creative' : 'Survival'} · seed {w.seedText} · {new Date(w.played).toLocaleString()}</div>
              </div>
              <button className="mc-btn-sm" onClick={() => { audio.init(); setPlaying(w); }}>Play</button>
              <button className="mc-btn-sm" onClick={() => { if (confirm(`Delete "${w.name}" forever?`)) { deleteWorld(w.id); setWorlds(listWorlds()); } }}>Delete</button>
            </div>
          ))}
          <div className="mc-text text-xs opacity-60 mt-6 text-center">Worlds autosave to your browser's local storage.</div>
        </div>
      ) : (
        <div className="w-[min(480px,92vw)] flex flex-col gap-3 mc-text">
          <label className="text-sm">World Name<input className="mc-input mt-1" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} /></label>
          <label className="text-sm">Seed (blank for random)<input className="mc-input mt-1" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. 12345 or any text" /></label>
          <button className="mc-btn" onClick={() => setMode(mode === 'survival' ? 'creative' : 'survival')}>Game Mode: {mode === 'survival' ? 'Survival' : 'Creative'}</button>
          <div className="text-xs opacity-75 -mt-1">{mode === 'survival' ? 'Gather resources, craft tools, manage hunger and fight off zombies at night.' : 'Unlimited blocks, instant breaking, flight (double-tap Space). No damage.'}</div>
          <div className="flex gap-2 mt-2">
            <button className="mc-btn flex-1" onClick={create}>Create World</button>
            <button className="mc-btn flex-1" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
