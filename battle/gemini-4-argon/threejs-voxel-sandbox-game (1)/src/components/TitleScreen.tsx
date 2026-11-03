import React, { useState } from 'react';
import {
  Compass,
  Download,
  Pickaxe,
  Play,
  Plus,
  Shuffle,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { hashSeedString } from '../game/constants';
import { GameMode, WorldSaveData, WorldSaveMeta } from '../game/types';

interface TitleScreenProps {
  savedWorlds: WorldSaveMeta[];
  onCreateWorld: (name: string, seedText: string, mode: GameMode) => void;
  onLoadWorld: (id: string) => void;
  onDeleteWorld: (id: string) => void;
  onExportWorld: (id: string) => void;
  onImportWorld: (data: WorldSaveData) => void;
}

const PRESET_WORLDS: Array<{
  title: string;
  subtitle: string;
  seedText: string;
  mode: GameMode;
  accent: string;
}> = [
  {
    title: 'Emerald Frontier',
    subtitle: 'Lush meadows, oak & birch woods, winding rivers & shallow coal caves',
    seedText: '774901',
    mode: 'survival',
    accent: 'from-emerald-500/20 to-teal-900/30 border-emerald-500/40',
  },
  {
    title: 'Frostpeak Alps',
    subtitle: 'Towering snow-capped ridges, spruce taiga & exposed mountain ores',
    seedText: '902188',
    mode: 'survival',
    accent: 'from-sky-500/20 to-indigo-900/30 border-sky-400/40',
  },
  {
    title: 'Sunbaked Oasis',
    subtitle: 'Golden desert dunes, sandstone strata, cacti & ancient mossy shrines',
    seedText: '441029',
    mode: 'survival',
    accent: 'from-amber-500/20 to-orange-950/30 border-amber-500/40',
  },
  {
    title: 'Architect’s Sandbox',
    subtitle: 'Creative flight enabled, infinite building blocks, sunstone & TNT!',
    seedText: '133700',
    mode: 'creative',
    accent: 'from-purple-500/20 to-fuchsia-950/30 border-purple-400/40',
  },
];

export const TitleScreen: React.FC<TitleScreenProps> = ({
  savedWorlds,
  onCreateWorld,
  onLoadWorld,
  onDeleteWorld,
  onExportWorld,
  onImportWorld,
}) => {
  const [worldName, setWorldName] = useState('New Frontier');
  const [seedText, setSeedText] = useState(() =>
    String(Math.floor(100000 + Math.random() * 899999))
  );
  const [mode, setMode] = useState<GameMode>('survival');

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as WorldSaveData;
        if (parsed?.meta?.id && parsed?.player) {
          onImportWorld(parsed);
        }
      } catch {
        // ignore invalid file
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950 via-slate-950 to-black text-slate-100 overflow-y-auto p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-6xl space-y-6">
        {/* Hero Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold tracking-wide">
            <Pickaxe className="w-3.5 h-3.5" />
            PROCEDURAL THREE.JS VOXEL SANDBOX ENGINE
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-amber-200 to-sky-300 drop-shadow">
            TERRAVOX
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl mx-auto">
            Explore infinite seeded biomes, carve deep ore caverns, craft tools &amp; torches, smelt ingots in glowing furnaces, survive moonlit nights, and build persistent 3D worlds.
          </p>
        </div>

        {/* Instant Preset Launch Cards */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            1-Click Featured Expedition Seeds
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {PRESET_WORLDS.map((preset) => (
              <button
                key={preset.title}
                type="button"
                onClick={() =>
                  onCreateWorld(preset.title, preset.seedText, preset.mode)
                }
                className={`text-left p-4 rounded-2xl border bg-gradient-to-br ${preset.accent} hover:scale-[1.02] transition flex flex-col justify-between gap-3 cursor-pointer shadow-lg`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white">
                      {preset.title}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        preset.mode === 'creative'
                          ? 'bg-purple-400/25 text-purple-200'
                          : 'bg-emerald-400/25 text-emerald-200'
                      }`}
                    >
                      {preset.mode}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {preset.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-amber-300 font-semibold pt-1 border-t border-white/10">
                  <span className="font-mono text-slate-400">
                    Seed #{preset.seedText}
                  </span>
                  <span className="flex items-center gap-1">
                    Launch <Play className="w-3 h-3 fill-current" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Split: Custom World Builder + Saved Worlds */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Custom World Creator */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h2 className="font-bold text-base text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-400" />
              Create Custom World
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  World Name
                </label>
                <input
                  type="text"
                  value={worldName}
                  onChange={(e) => setWorldName(e.target.value)}
                  placeholder="My Voxel Kingdom"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  World Seed (Number or Phrase)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={seedText}
                    onChange={(e) => setSeedText(e.target.value)}
                    placeholder="Enter any seed..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-400"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSeedText(String(Math.floor(100000 + Math.random() * 899999)))
                    }
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                    title="Randomize Seed"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[10px] text-slate-500 mt-1 font-mono">
                  Numeric Seed Hash: {hashSeedString(seedText || 'terravox')}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Gameplay Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('survival')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                      mode === 'survival'
                        ? 'bg-emerald-500/20 border-emerald-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold">Survival</div>
                    <div className="text-[10px] text-slate-300">
                      Gather, craft, smelt, health &amp; night creatures
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMode('creative')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer ${
                      mode === 'creative'
                        ? 'bg-purple-500/20 border-purple-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold">Creative</div>
                    <div className="text-[10px] text-slate-300">
                      Free flight, instant break &amp; full block palette
                    </div>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onCreateWorld(
                    worldName.trim() || 'Untitled World',
                    seedText || '774901',
                    mode
                  )
                }
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-2 cursor-pointer transition"
              >
                <Play className="w-4 h-4 fill-current" />
                Generate &amp; Enter World
              </button>
            </div>
          </div>

          {/* Saved Persistent Worlds List */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-xl">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-base text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  Saved Persistent Worlds ({savedWorlds.length})
                </h2>

                <label className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-sky-400" />
                  Import JSON
                  <input
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={handleImportFile}
                  />
                </label>
              </div>

              {savedWorlds.length === 0 ? (
                <div className="py-14 text-center border border-dashed border-slate-800 rounded-xl text-xs text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">
                    No saved worlds yet
                  </div>
                  <div>
                    Pick any Featured Expedition above or click{' '}
                    <span className="text-emerald-400 font-semibold">
                      Generate &amp; Enter World
                    </span>{' '}
                    — worlds auto-save every 20 seconds to IndexedDB!
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {savedWorlds.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/85 border border-slate-800 hover:border-slate-600 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">
                            {w.name}
                          </span>
                          <span className="text-[10px] uppercase px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold">
                            {w.mode}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Day {w.dayCount}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Seed: {w.seed} · Saved{' '}
                          {new Date(w.updatedAt).toLocaleString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onLoadWorld(w.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" /> Play
                        </button>
                        <button
                          type="button"
                          onClick={() => onExportWorld(w.id)}
                          title="Export World JSON Backup"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteWorld(w.id)}
                          title="Delete Saved World"
                          className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800/80 rounded-xl px-3.5 py-2.5 flex flex-wrap justify-between gap-2">
              <span>WASD Move · Space Jump · Shift Sneak · Ctrl Sprint</span>
              <span>Left-Click Mine/Attack · Right-Click Place/Use · E Craft</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
