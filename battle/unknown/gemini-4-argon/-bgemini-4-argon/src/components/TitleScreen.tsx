import React, { useState } from 'react';
import {
  Compass,
  Flame,
  Hammer,
  Mountain,
  Play,
  Plus,
  Shuffle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { GameMode, WorldSaveMeta } from '../engine/constants';
import { hashSeedString } from '../engine/noise';

interface TitleScreenProps {
  savedWorlds: WorldSaveMeta[];
  onCreateWorld: (name: string, seedText: string, mode: GameMode) => void;
  onLoadWorld: (meta: WorldSaveMeta) => void;
  onDeleteWorld: (id: string) => void;
}

const PRESET_SEEDS = [
  { label: 'Emerald Valley', seed: 'emerald-valley-2026', desc: 'Lush meadows, forest groves & nearby caves' },
  { label: 'Shattered Peaks', seed: 'alpine-crags-777', desc: 'Towering snow-capped ridges & mountain ores' },
  { label: 'Golden Oasis', seed: 'sunbaked-dunes-42', desc: 'Warm sand dunes bordering coastal turquoise waters' },
  { label: 'Frostpine Fjord', seed: 'frostpeak-taiga-99', desc: 'Frozen ice lakes, tall spruce pines & snowy hills' },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  savedWorlds,
  onCreateWorld,
  onLoadWorld,
  onDeleteWorld,
}) => {
  const [worldName, setWorldName] = useState('New Frontier');
  const [seedText, setSeedText] = useState('emerald-valley-2026');
  const [gameMode, setGameMode] = useState<GameMode>('survival');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateWorld(worldName.trim() || 'Untitled Realm', seedText, gameMode);
  };

  const randomizeSeed = () => {
    setSeedText(`realm-${Math.floor(100000 + Math.random() * 900000)}`);
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-y-auto bg-slate-950 p-4 md:p-8">
      {/* Atmospheric layered backdrop */}
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.22), transparent 45%), radial-gradient(circle at 80% 18%, rgba(56, 189, 248, 0.22), transparent 45%), radial-gradient(circle at 50% 85%, rgba(245, 158, 11, 0.16), transparent 50%), linear-gradient(180deg, #070d19 0%, #0f172a 60%, #111827 100%)',
        }}
      />

      <div className="relative z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch my-auto">
        {/* Left Hero & New World Card */}
        <div className="lg:col-span-7 mc-panel rounded-2xl p-6 md:p-8 flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold tracking-wider uppercase mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              Three.js Procedural Voxel Sandbox
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-2">
              VOXEL<span className="text-emerald-400">REALMS</span>
            </h1>
            <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-6">
              Explore infinite multi-biome terrain, mine deep ore caverns, craft tools & weapons, smelt ingots, wire TNT quarries, and build illuminated strongholds across dynamic day-night cycles and weather.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    World Name
                  </label>
                  <input
                    type="text"
                    value={worldName}
                    onChange={(e) => setWorldName(e.target.value)}
                    maxLength={28}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-400 transition"
                    placeholder="New Frontier"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    World Seed
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={seedText}
                      onChange={(e) => setSeedText(e.target.value)}
                      maxLength={32}
                      className="w-full px-3 py-2.5 rounded-lg bg-slate-900/90 border border-slate-700 text-emerald-300 font-mono text-xs focus:outline-none focus:border-emerald-400 transition"
                      placeholder="Any word or number"
                    />
                    <button
                      type="button"
                      onClick={randomizeSeed}
                      title="Randomize Seed"
                      className="px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 transition cursor-pointer"
                    >
                      <Shuffle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Preset Biomes / Seeds */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Scenic Seed Presets (Numeric Hash: {hashSeedString(seedText)})
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {PRESET_SEEDS.map((preset) => {
                    const active = seedText === preset.seed;
                    return (
                      <button
                        key={preset.seed}
                        type="button"
                        onClick={() => {
                          setSeedText(preset.seed);
                          setWorldName(preset.label);
                        }}
                        className={`text-left p-2.5 rounded-lg border transition cursor-pointer ${
                          active
                            ? 'bg-emerald-500/15 border-emerald-400/70 text-white'
                            : 'bg-slate-900/60 border-slate-700/70 text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center gap-1.5">
                          <Mountain className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          {preset.label}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{preset.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Game Mode Selector */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setGameMode('survival')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    gameMode === 'survival'
                      ? 'bg-amber-500/15 border-amber-400 text-white'
                      : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <Hammer className="w-4 h-4 text-amber-400" />
                    Survival Mode
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Gather resources, craft gear, smelt ores & brave the night
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setGameMode('creative')}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                    gameMode === 'creative'
                      ? 'bg-sky-500/15 border-sky-400 text-white'
                      : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="text-sm font-bold flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-sky-400" />
                    Creative Mode
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Unlimited blocks, instant mining & free sky flight (F)
                  </div>
                </button>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-base tracking-wide shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition transform active:scale-[0.99] cursor-pointer"
              >
                <Plus className="w-5 h-5 stroke-[2.6]" />
                Generate & Enter World
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Saved Worlds & Controls Guide */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="mc-panel rounded-2xl p-6 flex-1 flex flex-col">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center justify-between">
              <span>Saved Worlds ({savedWorlds.length})</span>
              <span className="text-[11px] font-normal text-emerald-400">Persistent IndexedDB</span>
            </h2>

            {savedWorlds.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8 px-4 rounded-xl bg-slate-900/50 border border-dashed border-slate-700/80">
                <Compass className="w-9 h-9 text-slate-500 mb-2" />
                <p className="text-sm font-medium text-slate-300">No saved realms yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Every block mined, torch placed, and chest of ingots you craft auto-saves automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {savedWorlds.map((w) => (
                  <div
                    key={w.id}
                    className="group p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-emerald-400/60 flex items-center justify-between gap-3 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm text-white truncate">{w.name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span
                          className={`uppercase font-semibold text-[10px] px-1.5 py-0.5 rounded ${
                            w.gameMode === 'creative'
                              ? 'bg-sky-500/20 text-sky-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {w.gameMode}
                        </span>
                        <span>Day {w.dayCount || 1}</span>
                        <span>•</span>
                        <span>{new Date(w.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onLoadWorld(w)}
                        className="px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Play
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteWorld(w.id)}
                        title="Delete Saved World"
                        className="p-2 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Controls Reference */}
          <div className="mc-panel rounded-2xl p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-amber-400" />
              Essential Controls
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-300">
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">WASD</kbd> Move / Swim</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">Space</kbd> Jump / Ascend</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">Shift</kbd> Sprint</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">C / Ctrl</kbd> Sneak Bridge</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">L-Click</kbd> Mine / Attack</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">R-Click</kbd> Place / Eat / Use</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">E</kbd> Crafting & Smelting</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">F</kbd> Toggle Flight</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">[ / ]</kbd> Shift Time</div>
              <div><kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-amber-300 font-mono">V</kbd> Cycle Weather</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
