import { useEffect, useState } from 'react';
import type { Game } from '../game/game';
import { useGame } from './common';
import { listWorlds, saveWorld, deleteWorld, type WorldMeta, type Settings, defaultSettings } from '../game/storage';
import { hashString } from '../game/noise';

const Btn = ({ children, onClick, kind = '', disabled }: { children: React.ReactNode; onClick?: () => void; kind?: string; disabled?: boolean }) => (
  <button className={'btn ' + kind} disabled={disabled} onClick={() => onClick?.()}>{children}</button>
);

function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-1"><span>{label}</span><span className="text-yellow-200">{fmt ? fmt(value) : value}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <button className="btn" onClick={() => onChange(!value)}>{label}: {value ? 'ON' : 'OFF'}</button>;
}

export function Options({ g, onBack }: { g: Game; onBack: () => void }) {
  useGame(g);
  const s = g.settings;
  const set = (p: Partial<Settings>) => g.applySettings({ ...s, ...p });
  return (
    <div className="panel p-6 w-[460px] fade">
      <div className="text-2xl mc-text text-center mb-4">Options</div>
      <div className="flex flex-col gap-3">
        <Slider label="Render distance" value={s.renderDist} min={3} max={12} step={1} fmt={(v) => `${v} chunks`} onChange={(v) => set({ renderDist: v })} />
        <Slider label="Field of view" value={s.fov} min={55} max={110} step={1} fmt={(v) => `${v}°`} onChange={(v) => set({ fov: v })} />
        <Slider label="Mouse sensitivity" value={s.sens} min={0.2} max={2.5} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ sens: v })} />
        <Slider label="Master volume" value={s.master} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ master: v })} />
        <Slider label="Music" value={s.music} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ music: v })} />
        <Slider label="Effects" value={s.sfx} min={0} max={1} step={0.05} fmt={(v) => `${Math.round(v * 100)}%`} onChange={(v) => set({ sfx: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Clouds" value={s.clouds} onChange={(v) => set({ clouds: v })} />
          <Toggle label="View bobbing" value={s.bob} onChange={(v) => set({ bob: v })} />
          <Toggle label="Show FPS" value={s.fps} onChange={(v) => set({ fps: v })} />
          <Btn onClick={() => g.applySettings({ ...defaultSettings })}>Reset</Btn>
        </div>
        <Btn kind="primary" onClick={onBack}>Done</Btn>
      </div>
    </div>
  );
}

const KEYS: [string, string][] = [
  ['W A S D', 'Move'], ['Space', 'Jump / swim up / fly up'], ['Shift', 'Sneak (no edge falls) / fly down'], ['Double-tap W / R', 'Sprint'],
  ['Mouse L', 'Hold to break / attack'], ['Mouse R', 'Place block / use item / eat / open'], ['Mouse M', 'Pick block'],
  ['1-9 / Wheel', 'Select hotbar slot'], ['E', 'Inventory & crafting'], ['Q  (Ctrl+Q)', 'Drop item (stack)'],
  ['T or /', 'Chat & commands'], ['L', 'Goals'], ['M', 'Toggle minimap'], ['F3', 'Debug info'], ['F1', 'Hide HUD'],
  ['Space ×2', 'Toggle flight (creative)'],
];
export function Controls({ onBack }: { onBack: () => void }) {
  return (
    <div className="panel p-6 w-[520px] fade">
      <div className="text-2xl mc-text text-center mb-4">Controls</div>
      <div className="flex flex-col gap-[3px] mb-4">
        {KEYS.map(([k, v]) => (
          <div key={k} className="flex justify-between text-[14px] border-b border-white/10 py-[3px]"><span className="text-yellow-200">{k}</span><span className="text-white/80">{v}</span></div>
        ))}
      </div>
      <Btn onClick={onBack}>Back</Btn>
    </div>
  );
}

function fmtTime(s: number) { const m = Math.floor(s / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`; }

function Worlds({ g, onBack }: { g: Game; onBack: () => void }) {
  const [worlds, setWorlds] = useState<WorldMeta[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('New World');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<'survival' | 'creative'>('survival');
  const [confirm, setConfirm] = useState('');
  const refresh = () => listWorlds().then(setWorlds);
  useEffect(() => { refresh(); }, []);
  const create = async () => {
    const trimmed = seed.trim();
    const s = trimmed === '' ? (Math.random() * 2 ** 31) | 0 : /^-?\d+$/.test(trimmed) ? parseInt(trimmed) | 0 : hashString(trimmed);
    const meta: WorldMeta = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name.trim() || 'New World', seedStr: trimmed || String(s), seed: s, mode, created: Date.now(), lastPlayed: Date.now(), playTime: 0 };
    await saveWorld(meta);
    g.startWorld(meta);
  };
  if (creating) {
    return (
      <div className="panel p-6 w-[460px] fade">
        <div className="text-2xl mc-text text-center mb-4">Create New World</div>
        <div className="flex flex-col gap-3">
          <div><div className="text-[13px] mb-1">World name</div><input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={28} /></div>
          <div><div className="text-[13px] mb-1">Seed (optional)</div><input className="field" value={seed} placeholder="leave blank for random" onChange={(e) => setSeed(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <button className={'btn ' + (mode === 'survival' ? 'primary' : '')} onClick={() => setMode('survival')}>⚔ Survival</button>
            <button className={'btn ' + (mode === 'creative' ? 'primary' : '')} onClick={() => setMode('creative')}>✦ Creative</button>
          </div>
          <div className="text-[12px] text-white/60 min-h-[32px]">{mode === 'survival' ? 'Gather resources, craft tools, manage hunger and fight monsters at night.' : 'Unlimited blocks, flight, instant mining and no threats. Build freely.'}</div>
          <Btn kind="primary" onClick={create}>Create & Play</Btn>
          <Btn onClick={() => setCreating(false)}>Cancel</Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="panel p-6 w-[560px] fade">
      <div className="text-2xl mc-text text-center mb-4">Select World</div>
      <div className="scroll flex flex-col gap-2 overflow-y-auto mb-4" style={{ maxHeight: 300 }}>
        {worlds === null && <div className="text-center text-white/60 py-6">Loading…</div>}
        {worlds && worlds.length === 0 && <div className="text-center text-white/60 py-6">No saved worlds yet. Create one to begin!</div>}
        {worlds?.map((w) => (
          <div key={w.id} className="flex items-center gap-3 p-3 bg-black/30 border-2 border-white/10 hover:border-white/40">
            <div className="flex-1 min-w-0">
              <div className="truncate text-[16px]">{w.name}</div>
              <div className="text-[11px] text-white/55">{w.mode === 'creative' ? 'Creative' : 'Survival'} · seed {w.seedStr} · {new Date(w.lastPlayed).toLocaleDateString()} · {fmtTime(w.playTime || 0)} played</div>
            </div>
            <div className="w-24"><Btn kind="primary" onClick={() => g.startWorld(w)}>Play</Btn></div>
            <div className="w-24"><Btn kind="danger" onClick={() => { if (confirm === w.id) { deleteWorld(w.id).then(() => { setConfirm(''); refresh(); }); } else setConfirm(w.id); }}>{confirm === w.id ? 'Sure?' : 'Delete'}</Btn></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2"><Btn kind="primary" onClick={() => setCreating(true)}>+ New World</Btn><Btn onClick={onBack}>Back</Btn></div>
    </div>
  );
}

export function MainMenu({ g }: { g: Game }) {
  const [page, setPage] = useState<'main' | 'worlds' | 'options' | 'controls'>('main');
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center fade" style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,.05), rgba(0,0,0,.6))' }}>
      <div className="text-center mb-8">
        <div className="title-logo text-7xl">TERRACRAFT</div>
        <div className="mc-text text-yellow-200 text-lg mt-3 pulse">Mine · Craft · Survive · Explore</div>
      </div>
      {page === 'main' && (
        <div className="w-80 flex flex-col gap-3">
          <Btn kind="primary" onClick={() => setPage('worlds')}>Singleplayer</Btn>
          <Btn onClick={() => setPage('options')}>Options</Btn>
          <Btn onClick={() => setPage('controls')}>How to Play</Btn>
        </div>
      )}
      {page === 'worlds' && <Worlds g={g} onBack={() => setPage('main')} />}
      {page === 'options' && <Options g={g} onBack={() => setPage('main')} />}
      {page === 'controls' && <Controls onBack={() => setPage('main')} />}
      <div className="absolute bottom-3 text-[11px] text-white/50 mc-text">Procedural worlds · chunk streaming in Web Workers · saved in your browser</div>
    </div>
  );
}

const TIPS = ['Punch trees to collect logs, then craft planks and a crafting table.', 'Zombies burn in sunlight - but night is dangerous. Place torches!', 'Hold Shift while at a ledge to avoid falling.', 'Sand and gravel fall when unsupported.', 'Smelt iron ore in a furnace using coal or wood as fuel.', 'Press L to see your goals, M to toggle the minimap.', 'Diamonds are found deep underground, near lava.', 'Boomers explode - strike them from range and back away.'];
export function Loading({ g }: { g: Game }) {
  useGame(g);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#16110d]">
      <div className="title-logo text-5xl mb-8">TERRACRAFT</div>
      <div className="w-96 h-5 bg-black border-2 border-[#6b5f52] p-[2px]"><div className="h-full bg-[#6cc24a] transition-all" style={{ width: `${Math.round(g.loadProgress * 100)}%` }} /></div>
      <div className="mt-3 mc-text">{g.loadText}… {Math.round(g.loadProgress * 100)}%</div>
      <div className="mt-8 text-white/50 text-sm max-w-md text-center">{tip}</div>
    </div>
  );
}

export function PauseMenu({ g }: { g: Game }) {
  const [page, setPage] = useState<'main' | 'options' | 'controls'>('main');
  useGame(g);
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/55">
      {page === 'main' && (
        <div className="panel p-6 w-80 flex flex-col gap-3">
          <div className="text-2xl mc-text text-center mb-1">Game Paused</div>
          <Btn kind="primary" onClick={() => g.resume()}>Back to Game</Btn>
          <Btn onClick={() => g.openScreen('adv')}>Goals ({g.achieved.size}/15)</Btn>
          <Btn onClick={() => setPage('options')}>Options</Btn>
          <Btn onClick={() => setPage('controls')}>Controls</Btn>
          <Btn kind="danger" onClick={() => g.returnToMenu()}>Save & Quit to Title</Btn>
          <div className="text-[11px] text-white/50 text-center">{g.meta?.name} · Day {g.days + 1} · progress saved automatically</div>
        </div>
      )}
      {page === 'options' && <Options g={g} onBack={() => setPage('main')} />}
      {page === 'controls' && <Controls onBack={() => setPage('main')} />}
    </div>
  );
}

export function Death({ g }: { g: Game }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center fade" style={{ background: 'radial-gradient(ellipse at center, rgba(120,10,10,.55), rgba(40,0,0,.9))' }}>
      <div className="text-6xl mc-text mb-2" style={{ color: '#ff5a5a' }}>You died!</div>
      <div className="text-white/70 mb-6">Blocks mined: {g.stats.mined} · Mobs defeated: {g.stats.killed} · Day {g.days + 1}</div>
      <div className="w-72 flex flex-col gap-3"><Btn kind="primary" onClick={() => g.respawn()}>Respawn</Btn><Btn kind="danger" onClick={() => g.returnToMenu()}>Title Screen</Btn></div>
    </div>
  );
}
