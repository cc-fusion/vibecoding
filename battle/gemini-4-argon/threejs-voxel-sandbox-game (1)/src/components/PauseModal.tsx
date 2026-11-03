import React, { useState } from 'react';
import {
  CloudRain,
  CloudSnow,
  Feather,
  LogOut,
  Moon,
  Play,
  Save,
  Sun,
  Sunrise,
  Sunset,
  Volume2,
} from 'lucide-react';
import { VoxelEngine } from '../game/engine';
import { EngineHUDState, GameSettings } from '../game/types';

interface PauseModalProps {
  hud: EngineHUDState;
  settings: GameSettings;
  engine: VoxelEngine;
  onUpdateSettings: (patch: Partial<GameSettings>) => void;
  onSaveWorld: () => Promise<void>;
  onSaveAndQuit: () => Promise<void>;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  hud,
  settings,
  engine,
  onUpdateSettings,
  onSaveWorld,
  onSaveAndQuit,
}) => {
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveClick = async () => {
    await onSaveWorld();
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Game Menu &amp; World Controls</h2>
            <p className="text-xs text-slate-400">
              {hud.worldName} · Seed {hud.seed} · Day {hud.dayCount}
            </p>
          </div>
          <button
            type="button"
            onClick={() => engine.resumeGame()}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg"
          >
            <Play className="w-4 h-4 fill-current" />
            Resume Game
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* Quick Sandbox Environment & Mode Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="font-semibold text-amber-300 uppercase tracking-wider text-[11px]">
              World Mode, Time of Day &amp; Weather Controls
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  engine.setGameMode(hud.mode === 'survival' ? 'creative' : 'survival')
                }
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold cursor-pointer"
              >
                Mode: {hud.mode === 'survival' ? 'Survival (Switch to Creative)' : 'Creative (Switch to Survival)'}
              </button>

              <button
                type="button"
                onClick={() => engine.toggleFlight()}
                className={`px-3 py-1.5 rounded-lg border font-semibold flex items-center gap-1.5 cursor-pointer ${
                  hud.flying
                    ? 'bg-sky-500/25 border-sky-400 text-sky-200'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Feather className="w-3.5 h-3.5" />
                Flight: {hud.flying ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-slate-400 mr-1">Time:</span>
              <button
                type="button"
                onClick={() => engine.setTimePreset(0.255, 'Golden Dawn')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-200 flex items-center gap-1 cursor-pointer"
              >
                <Sunrise className="w-3.5 h-3.5" /> Dawn
              </button>
              <button
                type="button"
                onClick={() => engine.setTimePreset(0.5, 'High Noon')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-yellow-200 flex items-center gap-1 cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5" /> Noon
              </button>
              <button
                type="button"
                onClick={() => engine.setTimePreset(0.745, 'Amber Sunset')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-orange-300 flex items-center gap-1 cursor-pointer"
              >
                <Sunset className="w-3.5 h-3.5" /> Sunset
              </button>
              <button
                type="button"
                onClick={() => engine.setTimePreset(0.0, 'Starlit Midnight')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                <Moon className="w-3.5 h-3.5" /> Night
              </button>

              <span className="text-slate-500 mx-1">|</span>
              <span className="text-slate-400 mr-1">Weather:</span>
              <button
                type="button"
                onClick={() => engine.setWeatherPreset('clear')}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  hud.weather === 'clear'
                    ? 'bg-emerald-500 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => engine.setWeatherPreset('rain')}
                className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                  hud.weather === 'rain'
                    ? 'bg-sky-500 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <CloudRain className="w-3.5 h-3.5" /> Rain
              </button>
              <button
                type="button"
                onClick={() => engine.setWeatherPreset('snow')}
                className={`px-2.5 py-1 rounded flex items-center gap-1 cursor-pointer ${
                  hud.weather === 'snow'
                    ? 'bg-slate-200 text-slate-950 font-semibold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <CloudSnow className="w-3.5 h-3.5" /> Snow
              </button>
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex justify-between font-medium text-slate-200">
                <span>Render Distance</span>
                <span className="text-emerald-400 font-mono">{settings.renderDistance} chunks</span>
              </div>
              <input
                type="range"
                min={3}
                max={8}
                step={1}
                value={settings.renderDistance}
                onChange={(e) =>
                  onUpdateSettings({ renderDistance: Number(e.target.value) })
                }
                className="accent-emerald-500 cursor-pointer"
              />
            </label>

            <label className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex justify-between font-medium text-slate-200">
                <span>Field of View (FOV)</span>
                <span className="text-emerald-400 font-mono">{settings.fov}°</span>
              </div>
              <input
                type="range"
                min={65}
                max={105}
                step={1}
                value={settings.fov}
                onChange={(e) => onUpdateSettings({ fov: Number(e.target.value) })}
                className="accent-emerald-500 cursor-pointer"
              />
            </label>

            <label className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex justify-between font-medium text-slate-200">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Master Audio Volume
                </span>
                <span className="text-amber-300 font-mono">
                  {Math.round(settings.soundVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.soundVolume}
                onChange={(e) =>
                  onUpdateSettings({ soundVolume: Number(e.target.value) })
                }
                className="accent-amber-500 cursor-pointer"
              />
            </label>

            <label className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex flex-col gap-1.5">
              <div className="flex justify-between font-medium text-slate-200">
                <span>Mouse Look Sensitivity</span>
                <span className="text-sky-300 font-mono">
                  {settings.mouseSensitivity.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.0}
                step={0.1}
                value={settings.mouseSensitivity}
                onChange={(e) =>
                  onUpdateSettings({ mouseSensitivity: Number(e.target.value) })
                }
                className="accent-sky-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Toggle Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ peacefulMobs: !settings.peacefulMobs })
              }
              className={`p-3 rounded-xl border text-left font-medium cursor-pointer ${
                settings.peacefulMobs
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300'
              }`}
            >
              <div>Peaceful Creatures: {settings.peacefulMobs ? 'ON' : 'OFF'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {settings.peacefulMobs ? 'No hostile night monsters' : 'Zombies & Creepers at night'}
              </div>
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateSettings({ musicEnabled: !settings.musicEnabled })
              }
              className={`p-3 rounded-xl border text-left font-medium cursor-pointer ${
                settings.musicEnabled
                  ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300'
              }`}
            >
              <div>Ambient Piano: {settings.musicEnabled ? 'ON' : 'OFF'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Gentle generative melodies
              </div>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ autoStep: !settings.autoStep })}
              className={`p-3 rounded-xl border text-left font-medium cursor-pointer ${
                settings.autoStep
                  ? 'bg-sky-950/50 border-sky-500/50 text-sky-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-300'
              }`}
            >
              <div>Auto-Step Hills: {settings.autoStep ? 'ON' : 'OFF'}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Walk smoothly up 1-block slopes
              </div>
            </button>
          </div>
        </div>

        {/* Footer Persistence Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSaveClick}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4 text-emerald-400" />
            {savedNotice ? 'World Saved ✓' : 'Save World Now'}
          </button>

          <button
            type="button"
            onClick={onSaveAndQuit}
            className="px-4 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Save &amp; Exit to Worlds Menu
          </button>
        </div>
      </div>
    </div>
  );
};
