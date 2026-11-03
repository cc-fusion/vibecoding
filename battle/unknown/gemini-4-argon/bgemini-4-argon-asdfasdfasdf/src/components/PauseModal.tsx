import React from 'react';
import {
  CloudRain,
  CloudSnow,
  LogOut,
  Moon,
  Play,
  Save,
  Sun,
  Sunrise,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { GameHUDState, GameMode, WeatherType } from '../engine/constants';

interface PauseModalProps {
  hud: GameHUDState;
  onResume: () => void;
  onSave: () => void;
  onExitToTitle: () => void;
  onSetRenderDistance: (rd: number) => void;
  onSetFov: (fov: number) => void;
  onSetTime: (t: number) => void;
  onSetWeather: (w: WeatherType) => void;
  onSetGameMode: (mode: GameMode) => void;
  onSetSound: (enabled: boolean) => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  hud,
  onResume,
  onSave,
  onExitToTitle,
  onSetRenderDistance,
  onSetFov,
  onSetTime,
  onSetWeather,
  onSetGameMode,
  onSetSound,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="mc-panel rounded-2xl w-full max-w-lg p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-700/70 pb-3.5">
          <div>
            <h2 className="text-xl font-black text-white">{hud.worldName}</h2>
            <p className="text-xs text-slate-400 font-mono">
              Seed: {hud.seed} • Day {hud.dayCount} • {hud.loadedChunks} Chunks Active
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSetSound(!hud.soundEnabled)}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            title="Toggle Synthesized Audio"
          >
            {hud.soundEnabled ? (
              <Volume2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-rose-400" />
            )}
          </button>
        </div>

        {/* Game Mode Toggle */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Game Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['survival', 'creative'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onSetGameMode(m)}
                className={`py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                  hud.gameMode === m
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200'
                    : 'bg-slate-900/70 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {m} Mode
              </button>
            ))}
          </div>
        </div>

        {/* Time of Day & Weather Atmosphere Director */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Time of Day
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onSetTime(0.03)}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-amber-200 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Sunrise className="w-3.5 h-3.5" /> Dawn
              </button>
              <button
                type="button"
                onClick={() => onSetTime(0.25)}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-yellow-200 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Sun className="w-3.5 h-3.5" /> Noon
              </button>
              <button
                type="button"
                onClick={() => onSetTime(0.49)}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-orange-300 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Sunrise className="w-3.5 h-3.5" /> Sunset
              </button>
              <button
                type="button"
                onClick={() => onSetTime(0.75)}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-indigo-300 flex items-center justify-center gap-1 cursor-pointer"
              >
                <Moon className="w-3.5 h-3.5" /> Night
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Weather System
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onSetWeather('clear')}
                className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer ${
                  hud.weather === 'clear'
                    ? 'bg-amber-500/25 border border-amber-400 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <Sun className="w-4 h-4 text-yellow-300" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => onSetWeather('rain')}
                className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer ${
                  hud.weather === 'rain'
                    ? 'bg-sky-500/25 border border-sky-400 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <CloudRain className="w-4 h-4 text-sky-300" />
                Rain
              </button>
              <button
                type="button"
                onClick={() => onSetWeather('snow')}
                className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex flex-col items-center gap-1 cursor-pointer ${
                  hud.weather === 'snow'
                    ? 'bg-slate-200/20 border border-white text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <CloudSnow className="w-4 h-4 text-white" />
                Snow
              </button>
            </div>
          </div>
        </div>

        {/* Graphics Sliders */}
        <div className="grid grid-cols-2 gap-4 pt-1">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Render Distance</span>
              <span className="font-mono text-emerald-400">{hud.renderDistance} chunks</span>
            </div>
            <input
              type="range"
              min={3}
              max={8}
              value={hud.renderDistance}
              onChange={(e) => onSetRenderDistance(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span>Field of View</span>
              <span className="font-mono text-emerald-400">{hud.fov}°</span>
            </div>
            <input
              type="range"
              min={60}
              max={100}
              value={hud.fov}
              onChange={(e) => onSetFov(Number(e.target.value))}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5 pt-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Resume Playing
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onSave}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              Save World Now
            </button>

            <button
              type="button"
              onClick={onExitToTitle}
              className="py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Save & Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
