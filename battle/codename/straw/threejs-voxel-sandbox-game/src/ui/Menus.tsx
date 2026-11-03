import { useMemo, useState } from 'react';
import {
  Play, Trash2, Dices, Sword, Sparkles, Settings as SettingsIcon, HelpCircle, X,
  Home, RotateCcw, Clock, Pickaxe, Blocks, Skull, Route, Timer, Cuboid,
} from 'lucide-react';
import type { Game, UIState } from '../game/game';
import type { Settings } from '../game/save';
import { cn } from '../utils/cn';

const SPLASHES = [
  'Now with 100% more cubes!', 'Punch trees, get wood!', 'Beware the hiss…',
  'Procedurally generated!', 'Runs in your browser!', 'Diamonds are deep down!',
  'Build a house before dark!', 'Also try sleeping—wait, no beds!', 'Handcrafted pixels!',
  'Chunky!', 'Every world is unique!', 'Watch out for lava!',
];

const TIPS = [
  'Torches keep monsters away — craft them from coal and sticks.',
  'Stone pickaxes mine iron. Iron pickaxes mine gold and diamonds.',
  'Creepers explode! Keep your distance or strike first.',
  'Cook meat in a furnace to restore much more hunger.',
  'Saplings dropped by leaves grow into new trees.',
  'Sneak with C to avoid walking off edges.',
  'Ruins scattered across the world hide treasure chests.',
];

function McButton({ children, onClick, variant = 'gray', className }: { children: React.ReactNode; onClick?: () => void; variant?: 'green' | 'gray' | 'red'; className?: string }) {
  return (
    <button onClick={onClick} className={cn(variant === 'green' ? 'mc-btn-green' : variant === 'red' ? 'mc-btn-red' : 'mc-btn', 'font-pixel text-[13px] tracking-wide', className)}>
      {children}
    </button>
  );
}

// ---------------- Title ----------------
export function TitleScreen({ ui, game, onSettings, onHelp }: { ui: UIState; game: Game; onSettings: () => void; onHelp: () => void }) {
  const [name, setName] = useState('');
  const [seed, setSeed] = useState('');
  const [mode, setMode] = useState<'survival' | 'creative'>('survival');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const splash = useMemo(() => SPLASHES[(Math.random() * SPLASHES.length) | 0], []);

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center overflow-y-auto bg-gradient-to-b from-black/60 via-black/25 to-black/70 px-4 py-8">
      <div className="relative mt-2 mb-1 text-center select-none">
        <div className="mb-1 flex items-center justify-center gap-2 text-emerald-300/90">
          <Cuboid size={20} />
          <span className="font-pixel text-[11px] tracking-[0.3em]">A TINY VOXEL SANDBOX</span>
        </div>
        <h1 className="logo-text font-pixel text-[54px] leading-none sm:text-[72px]">VOXELCRAFT</h1>
        <div className="splash font-pixel absolute -right-6 -bottom-3 rotate-[-8deg] text-[13px] text-yellow-300 sm:-right-16" style={{ textShadow: '2px 2px 0 #3f3000' }}>
          {splash}
        </div>
      </div>
      <p className="mb-6 max-w-xl text-center text-[13px] text-white/65">
        Explore endless procedural worlds. Mine, craft, build and survive the night — entirely in your browser.
      </p>

      <div className="grid w-full max-w-3xl gap-4 md:grid-cols-5">
        {/* world list */}
        <div className="mc-panel p-4 md:col-span-3">
          <h2 className="font-pixel mb-3 text-[13px] text-white">Your Worlds</h2>
          {ui.worlds.length === 0 ? (
            <div className="rounded-lg border border-dashed border-white/15 px-4 py-8 text-center">
              <Blocks className="mx-auto mb-2 text-white/30" size={28} />
              <p className="text-sm text-white/55">No worlds yet.<br />Create your first world to start playing!</p>
            </div>
          ) : (
            <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
              {ui.worlds.map(w => (
                <div key={w.id} className="flex items-center gap-3 rounded-lg bg-black/30 px-3 py-2.5 ring-1 ring-white/10 transition hover:bg-black/45">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-pixel text-[13px] text-white">{w.name}</span>
                      <span className={cn('rounded px-1.5 py-px text-[9px] font-bold tracking-wider', w.mode === 'creative' ? 'bg-violet-500/80 text-white' : 'bg-emerald-600/80 text-white')}>
                        {w.mode.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-white/45">
                      Seed {w.seed} · Last played {new Date(w.lastPlayed).toLocaleDateString()}
                    </div>
                  </div>
                  {confirmDelete === w.id ? (
                    <>
                      <button className="rounded bg-red-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-red-500" onClick={() => { game.deleteWorldById(w.id); setConfirmDelete(null); }}>Delete?</button>
                      <button className="rounded bg-white/10 px-2 py-1.5 text-[11px] text-white hover:bg-white/20" onClick={() => setConfirmDelete(null)}>Keep</button>
                    </>
                  ) : (
                    <>
                      <button className="rounded-md p-2 text-white/45 transition hover:bg-red-500/20 hover:text-red-300" onClick={() => setConfirmDelete(w.id)} aria-label="Delete world">
                        <Trash2 size={16} />
                      </button>
                      <McButton variant="green" onClick={() => game.loadWorldById(w.id)}>
                        <span className="flex items-center gap-1.5"><Play size={14} /> Play</span>
                      </McButton>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* create world */}
        <div className="mc-panel p-4 md:col-span-2">
          <h2 className="font-pixel mb-3 text-[13px] text-white">Create New World</h2>
          <label className="mb-1 block text-[11px] font-semibold tracking-wide text-white/50">WORLD NAME</label>
          <input
            value={name} onChange={e => setName(e.target.value)} placeholder="My World" maxLength={28}
            className="mc-input mb-3 w-full"
          />
          <label className="mb-1 block text-[11px] font-semibold tracking-wide text-white/50">SEED (OPTIONAL)</label>
          <div className="mb-3 flex gap-2">
            <input
              value={seed} onChange={e => setSeed(e.target.value)} placeholder="Random" maxLength={32}
              className="mc-input min-w-0 flex-1"
            />
            <button
              className="rounded-md bg-white/10 px-2.5 text-white/75 transition hover:bg-white/20" title="Random seed"
              onClick={() => setSeed(String((Math.random() * 1e9) | 0))}
            ><Dices size={16} /></button>
          </div>
          <label className="mb-1 block text-[11px] font-semibold tracking-wide text-white/50">GAME MODE</label>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button onClick={() => setMode('survival')} className={cn('rounded-lg px-3 py-2.5 text-left ring-1 transition', mode === 'survival' ? 'bg-emerald-600/35 ring-emerald-400/70' : 'bg-black/30 ring-white/10 hover:bg-black/45')}>
              <span className="flex items-center gap-1.5 font-pixel text-[12px] text-white"><Sword size={14} className="text-emerald-300" /> Survival</span>
              <span className="mt-1 block text-[11px] leading-snug text-white/50">Gather, craft, eat and survive the night.</span>
            </button>
            <button onClick={() => setMode('creative')} className={cn('rounded-lg px-3 py-2.5 text-left ring-1 transition', mode === 'creative' ? 'bg-violet-600/35 ring-violet-400/70' : 'bg-black/30 ring-white/10 hover:bg-black/45')}>
              <span className="flex items-center gap-1.5 font-pixel text-[12px] text-white"><Sparkles size={14} className="text-violet-300" /> Creative</span>
              <span className="mt-1 block text-[11px] leading-snug text-white/50">Unlimited blocks &amp; flight (press F).</span>
            </button>
          </div>
          <McButton variant="green" className="w-full" onClick={() => game.newWorld(name, seed, mode)}>
            Create &amp; Play
          </McButton>
        </div>
      </div>

      <div className="mt-5 flex gap-3">
        <McButton onClick={onHelp}><span className="flex items-center gap-2"><HelpCircle size={15} /> How to Play</span></McButton>
        <McButton onClick={onSettings}><span className="flex items-center gap-2"><SettingsIcon size={15} /> Settings</span></McButton>
      </div>
      <p className="mt-6 text-[11px] text-white/35">VoxelCraft · A fan-made tribute built with Three.js · Best played with mouse &amp; keyboard</p>
    </div>
  );
}

// ---------------- Loading ----------------
export function LoadingScreen({ ui }: { ui: UIState }) {
  const tip = useMemo(() => TIPS[(Math.random() * TIPS.length) | 0], []);
  const pct = ui.loading?.pct ?? 0;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4">
      <div className="mc-panel w-[440px] p-6 text-center">
        <h2 className="font-pixel mb-1 text-lg text-white">Entering {ui.worldName || 'world'}…</h2>
        <p className="mb-4 text-[12px] text-white/50">{ui.loading?.label ?? 'Generating terrain…'}</p>
        <div className="h-4 overflow-hidden rounded-md bg-black/60 ring-1 ring-white/15">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-lime-400 transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1.5 font-pixel text-[12px] text-emerald-300">{pct}%</div>
        <p className="mt-4 text-[12px] leading-relaxed text-amber-200/80">Tip: {tip}</p>
      </div>
    </div>
  );
}

// ---------------- Pause ----------------
function StatCell({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-3 py-2 ring-1 ring-white/10">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-white/45">{icon}{label}</div>
      <div className="font-pixel mt-0.5 text-[15px] text-white">{value}</div>
    </div>
  );
}

export function formatStats(ui: UIState) {
  const mins = Math.floor(ui.stats.playSeconds / 60);
  return [
    { icon: <Clock size={12} />, label: 'DAYS', value: String(ui.day) },
    { icon: <Pickaxe size={12} />, label: 'MINED', value: String(ui.stats.mined) },
    { icon: <Blocks size={12} />, label: 'PLACED', value: String(ui.stats.placed) },
    { icon: <Sword size={12} />, label: 'KILLS', value: String(ui.stats.kills) },
    { icon: <Route size={12} />, label: 'TRAVELED', value: ui.stats.distance > 1000 ? `${(ui.stats.distance / 1000).toFixed(1)} km` : `${Math.round(ui.stats.distance)} m` },
    { icon: <Timer size={12} />, label: 'PLAY TIME', value: mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m` },
  ];
}

export function PauseScreen({ ui, game, onSettings, onHelp }: { ui: UIState; game: Game; onSettings: () => void; onHelp: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]">
      <div className="mc-panel w-[440px] p-5">
        <h2 className="font-pixel mb-0.5 text-center text-lg text-white">Game Paused</h2>
        <p className="mb-4 text-center text-[12px] text-white/50">{ui.worldName} · {ui.mode} · Day {ui.day}</p>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {formatStats(ui).map(s => <StatCell key={s.label} {...s} />)}
        </div>
        <div className="flex flex-col gap-2">
          <McButton variant="green" onClick={() => game.resume()}><span className="flex items-center justify-center gap-2"><Play size={15} /> Back to Game</span></McButton>
          <div className="grid grid-cols-2 gap-2">
            <McButton onClick={onSettings}><span className="flex items-center justify-center gap-2"><SettingsIcon size={15} /> Settings</span></McButton>
            <McButton onClick={onHelp}><span className="flex items-center justify-center gap-2"><HelpCircle size={15} /> How to Play</span></McButton>
          </div>
          <McButton onClick={() => game.toTitle()}><span className="flex items-center justify-center gap-2"><Home size={15} /> Save &amp; Exit to Title</span></McButton>
        </div>
        <p className="mt-3 text-center text-[11px] text-white/35">Progress autosaves every few seconds.</p>
      </div>
    </div>
  );
}

// ---------------- Death ----------------
export function DeathScreen({ ui, game }: { ui: UIState; game: Game }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-950/60 px-4">
      <div className="w-[440px] text-center">
        <Skull size={44} className="mx-auto mb-2 text-red-300" />
        <h2 className="font-pixel text-4xl text-red-200" style={{ textShadow: '3px 3px 0 rgba(0,0,0,0.5)' }}>You Died!</h2>
        <p className="mt-2 text-sm text-white/75">{ui.deathCause}</p>
        <p className="mt-1 text-[12px] text-white/45">You survived {ui.day} day{ui.day === 1 ? '' : 's'} · Your items were dropped where you fell.</p>
        <div className="mc-panel mx-auto mt-5 grid grid-cols-3 gap-2 p-3">
          {formatStats(ui).map(s => <StatCell key={s.label} {...s} />)}
        </div>
        <div className="mx-auto mt-5 flex max-w-sm flex-col gap-2">
          <McButton variant="green" onClick={() => game.respawn()}><span className="flex items-center justify-center gap-2"><RotateCcw size={15} /> Respawn</span></McButton>
          <McButton onClick={() => game.toTitle()}><span className="flex items-center justify-center gap-2"><Home size={15} /> Title Screen</span></McButton>
        </div>
      </div>
    </div>
  );
}

// ---------------- Settings ----------------
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-[13px] font-medium text-white/80">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={cn('h-6 w-11 rounded-full p-1 transition', value ? 'bg-emerald-500' : 'bg-white/15')}>
      <span className={cn('block h-4 w-4 rounded-full bg-white transition-transform', value && 'translate-x-5')} />
    </button>
  );
}

export function SettingsModal({ ui, game, onClose }: { ui: UIState; game: Game; onClose: () => void }) {
  const s = ui.settings;
  const set = (p: Partial<Settings>) => game.setSettings(p);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-4" onMouseDown={onClose}>
      <div className="mc-panel w-[460px] p-5" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-pixel text-[15px] text-white">Settings</h2>
          <button className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="divide-y divide-white/5">
          <Row label={`Render distance — ${s.renderDistance} chunks`}>
            <input type="range" min={3} max={10} step={1} value={s.renderDistance} onChange={e => set({ renderDistance: +e.target.value })} className="w-36 accent-emerald-400" />
          </Row>
          <Row label={`Field of view — ${s.fov}°`}>
            <input type="range" min={60} max={100} step={1} value={s.fov} onChange={e => set({ fov: +e.target.value })} className="w-36 accent-emerald-400" />
          </Row>
          <Row label={`Mouse sensitivity — ${s.sensitivity.toFixed(1)}×`}>
            <input type="range" min={0.3} max={2} step={0.1} value={s.sensitivity} onChange={e => set({ sensitivity: +e.target.value })} className="w-36 accent-emerald-400" />
          </Row>
          <Row label={`Volume — ${Math.round(s.volume * 100)}%`}>
            <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={e => set({ volume: +e.target.value })} className="w-36 accent-emerald-400" />
          </Row>
          <Row label="Ambient music"><Toggle value={s.music} onChange={v => set({ music: v })} /></Row>
          <Row label="Clouds"><Toggle value={s.clouds} onChange={v => set({ clouds: v })} /></Row>
          <Row label="Minimap"><Toggle value={s.minimap} onChange={v => set({ minimap: v })} /></Row>
          <Row label="Invert mouse Y"><Toggle value={s.invertY} onChange={v => set({ invertY: v })} /></Row>
          <Row label="Graphics quality">
            <div className="flex overflow-hidden rounded-md ring-1 ring-white/15">
              {([['Low', 1], ['Med', 1.5], ['High', 2]] as const).map(([label, v]) => (
                <button key={label} onClick={() => set({ quality: v })} className={cn('px-3 py-1.5 text-[12px] font-semibold', s.quality === v ? 'bg-emerald-500 text-white' : 'bg-black/30 text-white/60 hover:bg-black/50')}>
                  {label}
                </button>
              ))}
            </div>
          </Row>
        </div>
        <McButton variant="green" className="mt-4 w-full" onClick={onClose}>Done</McButton>
      </div>
    </div>
  );
}

// ---------------- Help ----------------
const CONTROLS: [string, string][] = [
  ['W A S D', 'Move'], ['Mouse', 'Look around'], ['Left Click (hold)', 'Mine block / attack'],
  ['Right Click', 'Place block / use / eat (hold)'], ['Space', 'Jump · swim · fly up'],
  ['Shift', 'Sprint · fly down'], ['C', 'Sneak (edge-safe)'], ['E', 'Inventory & crafting'],
  ['1–9 / Scroll', 'Choose hotbar slot'], ['Middle Click', 'Pick targeted block'],
  ['Q', 'Drop held item (Ctrl+Q: all)'], ['F', 'Toggle flight (Creative)'],
  ['M', 'Toggle minimap'], ['F3', 'Debug overlay'], ['Esc', 'Pause menu'],
];

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6" onMouseDown={onClose}>
      <div className="mc-panel max-h-full w-[620px] overflow-y-auto p-5" onMouseDown={e => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-pixel text-[15px] text-white">How to Play</h2>
          <button className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose}><X size={18} /></button>
        </div>
        <h3 className="font-pixel mb-2 text-[12px] text-emerald-300">Survive your first day</h3>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-white/75">
          <li>Punch tree trunks to collect logs. Craft planks, then a <b className="text-white">Crafting Table</b>.</li>
          <li>Make a <b className="text-white">wooden pickaxe</b>, mine stone and coal, and craft <b className="text-white">torches</b>.</li>
          <li>Build a small shelter before dark — zombies and creepers come out at night!</li>
          <li>Hunt animals and cook their meat in a <b className="text-white">furnace</b> to stay fed.</li>
          <li>Upgrade to stone, then iron tools. Diamonds hide deep below y=15… so does lava.</li>
        </ol>
        <h3 className="font-pixel mb-2 text-[12px] text-emerald-300">Controls</h3>
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-1">
          {CONTROLS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 text-[12.5px]">
              <kbd className="rounded bg-black/50 px-1.5 py-0.5 font-mono text-[11px] text-amber-200 ring-1 ring-white/15">{k}</kbd>
              <span className="flex-1 text-right text-white/70">{v}</span>
            </div>
          ))}
        </div>
        <h3 className="font-pixel mb-2 text-[12px] text-emerald-300">The world</h3>
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-white/75">
          <li>Six biomes — plains, forests, deserts, snowy tundra, mountains and oceans — plus caves, lava pools and buried ruins with loot.</li>
          <li>Tool tiers matter: you need a stone pickaxe for iron, iron for gold &amp; diamonds.</li>
          <li>Sand and gravel fall. Water flows. Saplings grow into trees.</li>
          <li>Zombies burn at sunrise. Creepers hiss, then boom — run or fight fast.</li>
          <li>Your world (and every block you change) saves automatically in this browser.</li>
        </ul>
        <McButton variant="green" className="mt-5 w-full" onClick={onClose}>Got it!</McButton>
      </div>
    </div>
  );
}
