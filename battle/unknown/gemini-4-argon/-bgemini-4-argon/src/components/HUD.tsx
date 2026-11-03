import React, { useState } from 'react';
import {
  Award,
  Backpack,
  CloudRain,
  CloudSnow,
  Compass,
  Feather,
  HelpCircle,
  Moon,
  Pause,
  Sun,
  Sunrise,
} from 'lucide-react';
import { ITEMS } from '../engine/blocks';
import { GameHUDState } from '../engine/constants';
import { GameEngine } from '../engine/gameEngine';
import { getItemIconUrl } from '../engine/textureAtlas';
import { Minimap } from './Minimap';

interface HUDProps {
  hud: GameHUDState;
  engine: GameEngine | null;
  onSelectHotbar: (idx: number) => void;
  onOpenInventory: () => void;
  onOpenPause: () => void;
  onLockPointer: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  engine,
  onSelectHotbar,
  onOpenInventory,
  onOpenPause,
  onLockPointer,
}) => {
  const [showCodex, setShowCodex] = useState(true);
  const [showKeys, setShowKeys] = useState(false);

  const selectedSlot = hud.inventory[hud.selectedHotbar];
  const selectedDef = selectedSlot ? ITEMS[selectedSlot.id] : null;

  const unlockedCount = hud.achievements.filter((a) => a.unlocked).length;
  const nextGoal = hud.achievements.find((a) => !a.unlocked);

  const isNight = hud.timeOfDay > 0.54 && hud.timeOfDay < 0.94;
  const isSunset = (hud.timeOfDay >= 0.46 && hud.timeOfDay <= 0.54) || hud.timeOfDay >= 0.94;

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between">
      {/* Underwater / Lava Full-Screen Atmospheric Overlay */}
      {hud.underwater && (
        <div className="fixed inset-0 bg-sky-600/32 backdrop-blur-[1px] transition-opacity" />
      )}
      {hud.inLava && (
        <div className="fixed inset-0 bg-orange-600/50 animate-pulse" />
      )}

      {/* Top HUD Bar */}
      <div className="relative z-10 flex items-start justify-between p-3 md:p-4 gap-3">
        {/* Top-Left World & Coordinates Telemetry + Live Voxel Radar Minimap */}
        <div className="pointer-events-auto flex items-start gap-2.5">
          <Minimap
            engine={engine}
            playerX={hud.position.x}
            playerZ={hud.position.z}
            yaw={hud.yaw}
          />
          <div className="flex flex-col gap-2">
          <div className="mc-panel rounded-xl px-3.5 py-2 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-white">
              {isNight ? (
                <Moon className="w-4 h-4 text-indigo-300" />
              ) : isSunset ? (
                <Sunrise className="w-4 h-4 text-amber-400" />
              ) : (
                <Sun className="w-4 h-4 text-yellow-300" />
              )}
              <span>Day {hud.dayCount}</span>
            </div>

            <span className="text-slate-600">|</span>

            <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
              <Compass className="w-3.5 h-3.5" />
              <span>{hud.biomeLabel}</span>
            </div>

            {hud.weather !== 'clear' && (
              <>
                <span className="text-slate-600">|</span>
                <div className="flex items-center gap-1 text-sky-300 font-medium capitalize">
                  {hud.weather === 'rain' ? (
                    <CloudRain className="w-3.5 h-3.5" />
                  ) : (
                    <CloudSnow className="w-3.5 h-3.5" />
                  )}
                  <span>{hud.weather}</span>
                </div>
              </>
            )}

            <span className="text-slate-600 hidden sm:inline">|</span>
            <span className="text-slate-300 font-mono hidden sm:inline">
              XYZ: {hud.position.x.toFixed(0)}, {hud.position.y.toFixed(0)}, {hud.position.z.toFixed(0)}
            </span>

            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="text-slate-400 font-mono hidden md:inline">{hud.fps} FPS</span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${
                hud.gameMode === 'creative'
                  ? 'bg-sky-500/20 border-sky-400/40 text-sky-300'
                  : 'bg-amber-500/20 border-amber-400/40 text-amber-300'
              }`}
            >
              {hud.gameMode}
            </span>

            {hud.flying && (
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-indigo-500/25 border border-indigo-400/50 text-indigo-200 flex items-center gap-1">
                <Feather className="w-3 h-3" />
                Flying (F)
              </span>
            )}

            {!hud.pointerLocked && !hud.inventoryOpen && !hud.paused && (
              <button
                type="button"
                onClick={onLockPointer}
                className="px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/25 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-200 transition cursor-pointer"
              >
                Click World to Lock Mouse
              </button>
            )}
          </div>
          </div>
        </div>

        {/* Center-Top Targeted Block Inspector Pill */}
        {hud.targetBlock && !hud.inventoryOpen && !hud.paused && (
          <div className="hidden sm:flex items-center gap-2.5 mc-panel rounded-xl px-3.5 py-1.5">
            <img
              src={getItemIconUrl(hud.targetBlock.blockId)}
              alt={hud.targetBlock.name}
              className="w-6 h-6 pixelated"
            />
            <div>
              <div className="text-xs font-bold text-white leading-tight">{hud.targetBlock.name}</div>
              {hud.targetBlock.breakProgress > 0.02 ? (
                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-amber-400 transition-all duration-75"
                    style={{ width: `${Math.round(hud.targetBlock.breakProgress * 100)}%` }}
                  />
                </div>
              ) : (
                <div className="text-[10px] text-slate-400">
                  {hud.targetBlock.blockId === 41
                    ? 'Right-Click to Ignite Fuse!'
                    : hud.targetBlock.blockId === 37 || hud.targetBlock.blockId === 38
                    ? 'Right-Click to Open Workshop'
                    : ITEMS[hud.targetBlock.blockId]?.preferredTool !== 'none'
                    ? `Best tool: ${ITEMS[hud.targetBlock.blockId]?.preferredTool}`
                    : 'Ready to harvest'}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Top-Right Action Buttons & Progression Codex */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenInventory}
              className="mc-panel hover:border-amber-400/70 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              title="Open Inventory, Crafting & Smelting (E)"
            >
              <Backpack className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Workshop</span>
              <kbd className="px-1 bg-slate-800 rounded text-[10px] text-amber-300">E</kbd>
            </button>

            <button
              type="button"
              onClick={() => setShowCodex((v) => !v)}
              className="mc-panel hover:border-emerald-400/70 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition cursor-pointer"
              title="Toggle Progression Goals"
            >
              <Award className="w-4 h-4 text-emerald-400" />
              <span>
                {unlockedCount}/{hud.achievements.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowKeys((v) => !v)}
              className="mc-panel hover:border-sky-400/70 rounded-xl p-2 text-slate-200 transition cursor-pointer"
              title="Controls Cheat-Sheet"
            >
              <HelpCircle className="w-4 h-4 text-sky-400" />
            </button>

            <button
              type="button"
              onClick={onOpenPause}
              className="mc-panel hover:border-slate-400 rounded-xl p-2 text-slate-200 transition cursor-pointer"
              title="World Settings & Save (Esc / P)"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {showCodex && nextGoal && (
            <div className="mc-panel rounded-xl px-3.5 py-2.5 max-w-[250px] text-right">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                Next Milestone ({unlockedCount}/{hud.achievements.length})
              </div>
              <div className="text-xs font-bold text-white mt-0.5">{nextGoal.title}</div>
              <div className="text-[11px] text-slate-400 leading-snug mt-0.5">{nextGoal.description}</div>
            </div>
          )}

          {showKeys && (
            <div className="mc-panel rounded-xl p-3 text-[11px] text-slate-300 space-y-1 w-56">
              <div className="font-bold text-white uppercase tracking-wider text-[10px] mb-1">
                Quick Controls
              </div>
              <div className="flex justify-between"><span>Move / Sprint</span><span className="text-amber-300 font-mono">WASD / Shift</span></div>
              <div className="flex justify-between"><span>Jump / Swim</span><span className="text-amber-300 font-mono">Space</span></div>
              <div className="flex justify-between"><span>Sneak Edge-Guard</span><span className="text-amber-300 font-mono">C / Ctrl</span></div>
              <div className="flex justify-between"><span>Toggle Flight</span><span className="text-amber-300 font-mono">F</span></div>
              <div className="flex justify-between"><span>Mine / Place</span><span className="text-amber-300 font-mono">LMB / RMB</span></div>
              <div className="flex justify-between"><span>Craft & Smelt</span><span className="text-amber-300 font-mono">E</span></div>
              <div className="flex justify-between"><span>Time / Weather</span><span className="text-amber-300 font-mono">[ ] / V</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Center Crosshair + Toast Notifications */}
      {!hud.inventoryOpen && !hud.paused && !hud.isDead && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-5 h-5 flex items-center justify-center">
            <div className="w-4 h-[2px] bg-white/90 shadow-[0_0_2px_#000]" />
            <div className="h-4 w-[2px] bg-white/90 shadow-[0_0_2px_#000] absolute" />
          </div>
        </div>
      )}

      {hud.toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div
            className={`mc-panel rounded-xl px-4 py-2.5 flex items-center gap-3 shadow-2xl border ${
              hud.toast.type === 'achievement'
                ? 'border-amber-400/80'
                : hud.toast.type === 'warning'
                ? 'border-rose-400/80'
                : 'border-emerald-400/60'
            }`}
          >
            <Award
              className={`w-5 h-5 shrink-0 ${
                hud.toast.type === 'achievement'
                  ? 'text-amber-400'
                  : hud.toast.type === 'warning'
                  ? 'text-rose-400'
                  : 'text-emerald-400'
              }`}
            />
            <div>
              <div className="text-xs font-extrabold text-white">{hud.toast.title}</div>
              {hud.toast.subtitle && (
                <div className="text-[11px] text-slate-300">{hud.toast.subtitle}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Survival Status Bars + 9-Slot Hotbar */}
      <div className="relative z-10 flex flex-col items-center pb-3 md:pb-4 px-2">
        {/* Selected Item Name */}
        <div className="h-5 mb-1 text-xs font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
          {selectedDef ? selectedDef.name : ''}
        </div>

        {/* Survival Health Hearts, Oxygen Bubbles & Hunger Bars */}
        {hud.gameMode === 'survival' && (
          <div className="w-full max-w-[468px] flex items-center justify-between mb-1.5 px-1">
            {/* 10 Hearts (20 HP) */}
            <div className="flex items-center gap-0.5" title={`Health: ${hud.health}/${hud.maxHealth}`}>
              {Array.from({ length: 10 }).map((_, i) => {
                const hp = hud.health - i * 2;
                const fill = hp >= 2 ? 'bg-rose-500' : hp === 1 ? 'bg-rose-400/70' : 'bg-slate-800/85';
                return (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-[3px] border border-slate-950 shadow-sm ${fill}`}
                  />
                );
              })}
            </div>

            {/* Underwater Air Bubbles */}
            {hud.underwater && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: Math.ceil(hud.oxygen) }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-sky-300 border border-sky-900"
                  />
                ))}
              </div>
            )}

            {/* 10 Hunger Pips */}
            <div className="flex items-center gap-0.5" title={`Hunger: ${Math.round(hud.hunger)}/20`}>
              {Array.from({ length: 10 }).map((_, i) => {
                const food = hud.hunger - i * 2;
                const fill = food >= 1.2 ? 'bg-amber-500' : food > 0.3 ? 'bg-amber-400/60' : 'bg-slate-800/85';
                return (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full border border-slate-950 shadow-sm ${fill}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* 9-Slot Hotbar */}
        <div className="pointer-events-auto mc-panel p-1.5 rounded-xl flex items-center gap-1.5">
          {Array.from({ length: 9 }).map((_, idx) => {
            const slot = hud.inventory[idx];
            const def = slot ? ITEMS[slot.id] : null;
            const active = hud.selectedHotbar === idx;
            const durRatio =
              slot && slot.durability !== undefined && def?.maxDurability
                ? slot.durability / def.maxDurability
                : null;

            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectHotbar(idx)}
                className={`relative w-11 h-11 md:w-12 md:h-12 rounded-lg flex items-center justify-center transition cursor-pointer ${
                  active ? 'mc-slot-active -translate-y-0.5' : 'mc-slot hover:brightness-125'
                }`}
              >
                <span className="absolute top-0.5 left-1 text-[9px] font-mono text-slate-400">
                  {idx + 1}
                </span>

                {slot && def && (
                  <>
                    <img
                      src={getItemIconUrl(slot.id)}
                      alt={def.name}
                      className="w-8 h-8 pixelated pointer-events-none"
                    />
                    {slot.count > 1 && (
                      <span className="absolute bottom-0.5 right-1 text-[11px] font-extrabold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)]">
                        {slot.count}
                      </span>
                    )}
                    {durRatio !== null && (
                      <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-slate-900 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            durRatio > 0.5
                              ? 'bg-emerald-400'
                              : durRatio > 0.25
                              ? 'bg-amber-400'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${Math.max(6, Math.round(durRatio * 100))}%` }}
                        />
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
