import React from 'react';
import {
  CloudRain,
  CloudSnow,
  Compass,
  Feather,
  Flame,
  HelpCircle,
  Moon,
  Pickaxe,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';
import { ITEMS } from '../game/items';
import { BiomeId, EngineHUDState } from '../game/types';
import { ItemSlotView } from './ItemSlotView';

interface HUDProps {
  hud: EngineHUDState;
  onSelectHotbar: (slot: number) => void;
  onOpenInventory: () => void;
  onOpenPause: () => void;
  onToggleHelp: () => void;
  onCapturePointer: () => void;
}

const BIOME_LABELS: Record<BiomeId, { label: string; badgeClass: string }> = {
  plains: { label: 'Emerald Meadows', badgeClass: 'text-emerald-300 border-emerald-500/40' },
  forest: { label: 'Whispering Woods', badgeClass: 'text-green-300 border-green-500/40' },
  desert: { label: 'Sunbaked Dunes', badgeClass: 'text-amber-300 border-amber-500/40' },
  mountains: { label: 'Frostpeak Alps', badgeClass: 'text-sky-200 border-sky-400/40' },
  river: { label: 'Crystal River', badgeClass: 'text-cyan-300 border-cyan-500/40' },
  beach: { label: 'Golden Shore', badgeClass: 'text-yellow-200 border-yellow-400/40' },
};

function formatClock(timeOfDay: number): string {
  const totalMinutes = Math.floor(timeOfDay * 24 * 60);
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const h12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${h12}:${mins.toString().padStart(2, '0')} ${suffix}`;
}

export const HUD: React.FC<HUDProps> = ({
  hud,
  onSelectHotbar,
  onOpenInventory,
  onOpenPause,
  onToggleHelp,
  onCapturePointer,
}) => {
  const activeSlot = hud.inventory[hud.selectedHotbar];
  const activeDef = activeSlot ? ITEMS[activeSlot.itemId] : null;
  const biomeMeta = BIOME_LABELS[hud.biome] ?? BIOME_LABELS.plains;
  const completedCount = hud.milestones.filter((m) => m.completed).length;
  const nextMilestone = hud.milestones.find((m) => !m.completed);

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between">
      {/* Underwater & Damage Screen Tints */}
      {hud.underwater && (
        <div className="fixed inset-0 bg-sky-700/35 backdrop-blur-[1px] pointer-events-none transition-opacity" />
      )}
      {hud.damageFlash > 0.02 && (
        <div
          className="fixed inset-0 pointer-events-none border-[18px] border-red-600/70 bg-red-600/20"
          style={{ opacity: hud.damageFlash }}
        />
      )}

      {/* Top Bar */}
      <div className="relative flex items-start justify-between p-3.5 gap-3">
        {/* Top-Left World Status Pill */}
        <div className="flex flex-col gap-2">
          <div className="pointer-events-auto flex flex-wrap items-center gap-2.5 bg-slate-950/75 backdrop-blur-md border border-slate-700/70 px-3 py-1.5 rounded-lg shadow-lg text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              {hud.worldName}
            </span>
            <span className="text-slate-500">•</span>
            <span className={`px-2 py-0.5 rounded border bg-slate-900/80 font-medium ${biomeMeta.badgeClass}`}>
              {biomeMeta.label}
            </span>
            <span className="flex items-center gap-1 text-slate-200 font-mono">
              {hud.weather === 'rain' ? (
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
              ) : hud.weather === 'snow' ? (
                <CloudSnow className="w-3.5 h-3.5 text-slate-100" />
              ) : hud.isNight ? (
                <Moon className="w-3.5 h-3.5 text-indigo-300" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-300" />
              )}
              Day {hud.dayCount} · {formatClock(hud.timeOfDay)}
            </span>
            <span className="text-slate-400 font-mono">
              XYZ: {Math.floor(hud.x)}, {Math.floor(hud.y)}, {Math.floor(hud.z)}
            </span>
            {hud.flying && (
              <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/50 text-sky-200 text-[11px]">
                <Feather className="w-3 h-3" /> Fly
              </span>
            )}
          </div>

          {/* F3 Technical Debug Panel */}
          {hud.debugOpen && (
            <div className="bg-slate-950/85 border border-slate-700/80 rounded-lg p-3 text-[11px] font-mono text-slate-200 space-y-1 max-w-xs shadow-xl">
              <div className="text-emerald-400 font-bold">TerraVox Engine Telemetry (F3)</div>
              <div>FPS: {hud.fps} | Mode: {hud.mode.toUpperCase()}</div>
              <div>Seed: {hud.seed}</div>
              <div>
                Pos: {hud.x.toFixed(2)} / {hud.y.toFixed(2)} / {hud.z.toFixed(2)}
              </div>
              <div>
                Chunk: [{hud.chunkX}, {hud.chunkZ}] ({hud.loadedChunks} active)
              </div>
              <div>Entities: {hud.entityCount} | Weather: {hud.weather}</div>
            </div>
          )}
        </div>

        {/* Top-Center Target Block Indicator */}
        {hud.targetBlockName && hud.pointerLocked && (
          <div className="hidden md:flex items-center gap-2 bg-slate-950/75 backdrop-blur-sm border border-slate-700/70 px-3 py-1 rounded-full text-xs text-slate-200 shadow">
            <Pickaxe className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-medium">{hud.targetBlockName}</span>
            {hud.targetBlockCoords && (
              <span className="text-slate-400 font-mono text-[11px]">
                [{hud.targetBlockCoords[0]}, {hud.targetBlockCoords[1]}, {hud.targetBlockCoords[2]}]
              </span>
            )}
          </div>
        )}

        {/* Top-Right Quick Actions & Milestone Guide */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenInventory}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 cursor-pointer shadow"
            >
              <span className="px-1 rounded bg-slate-800 text-amber-300 font-mono text-[10px]">E</span>
              Craft & Bag
            </button>
            <button
              type="button"
              onClick={onToggleHelp}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer shadow"
            >
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Controls</span>
            </button>
            <button
              type="button"
              onClick={onOpenPause}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1 cursor-pointer shadow"
            >
              <Settings className="w-3.5 h-3.5 text-slate-300" />
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>

          {hud.mode === 'survival' && nextMilestone && (
            <div className="bg-slate-950/80 backdrop-blur-md border border-amber-500/35 rounded-lg px-3 py-2 max-w-[270px] shadow-lg">
              <div className="flex items-center justify-between text-[11px] text-amber-300 font-semibold">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Goal: {nextMilestone.title}
                </span>
                <span className="font-mono text-slate-400">
                  {completedCount}/{hud.milestones.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                {nextMilestone.hint}
              </p>
            </div>
          )}

          {hud.helpOpen && (
            <div className="bg-slate-950/90 backdrop-blur-md border border-slate-700 rounded-lg p-3 text-xs text-slate-200 w-64 space-y-1 shadow-xl">
              <div className="font-semibold text-sky-300 mb-1">Controls Reference (H)</div>
              <div className="flex justify-between"><span>Move / Strafe</span><span className="font-mono text-amber-300">W A S D</span></div>
              <div className="flex justify-between"><span>Jump / Swim Up</span><span className="font-mono text-amber-300">Space</span></div>
              <div className="flex justify-between"><span>Sneak (Edge Safe)</span><span className="font-mono text-amber-300">Shift</span></div>
              <div className="flex justify-between"><span>Sprint</span><span className="font-mono text-amber-300">Ctrl + W</span></div>
              <div className="flex justify-between"><span>Mine / Attack</span><span className="font-mono text-amber-300">Left Click</span></div>
              <div className="flex justify-between"><span>Place / Use / Eat</span><span className="font-mono text-amber-300">Right Click</span></div>
              <div className="flex justify-between"><span>Inventory & Craft</span><span className="font-mono text-amber-300">E</span></div>
              <div className="flex justify-between"><span>Toggle Flight</span><span className="font-mono text-amber-300">F</span></div>
              <div className="flex justify-between"><span>Drop Held Item</span><span className="font-mono text-amber-300">Q</span></div>
              <div className="flex justify-between"><span>Debug Telemetry</span><span className="font-mono text-amber-300">F3</span></div>
            </div>
          )}
        </div>
      </div>

      {/* Center Crosshair & Click-to-Capture Prompt */}
      <div className="relative flex flex-col items-center justify-center">
        {!hud.pointerLocked && !hud.inventoryOpen && !hud.paused && !hud.gameOver && (
          <button
            type="button"
            onClick={onCapturePointer}
            className="pointer-events-auto mb-6 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-950/60 transition transform hover:scale-105 cursor-pointer"
          >
            Click to Capture Mouse & Play
          </button>
        )}

        {/* Crisp Crosshair */}
        {!hud.inventoryOpen && !hud.paused && (
          <div className="relative flex items-center justify-center">
            <div className="w-4 h-[2px] bg-white/90 shadow-[0_0_2px_#000]" />
            <div className="h-4 w-[2px] bg-white/90 shadow-[0_0_2px_#000] absolute" />
            {hud.breakProgress > 0.02 && (
              <div className="absolute top-5 w-12 h-1.5 bg-slate-950/90 rounded-full overflow-hidden border border-white/30">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.min(100, Math.round(hud.breakProgress * 100))}%` }}
                />
              </div>
            )}
          </div>
        )}

        {/* Toast Notification Banner */}
        {hud.toastMessage && (
          <div className="mt-6 px-4 py-1.5 rounded-full bg-slate-950/85 border border-amber-400/60 text-amber-200 text-xs font-semibold shadow-lg flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-amber-400" />
            {hud.toastMessage}
          </div>
        )}
      </div>

      {/* Bottom Vitals + Hotbar */}
      <div className="flex flex-col items-center pb-3 gap-1.5">
        {/* Held Item Name */}
        <div className="h-5 text-xs font-medium text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]">
          {activeDef ? (
            <span>
              {activeDef.name}
              {activeDef.toolCategory !== 'none' && (
                <span className="text-amber-300 ml-1.5 text-[11px]">
                  ({activeDef.miningSpeed}× Mine · {activeDef.attackDamage} ATK)
                </span>
              )}
              {activeDef.foodRestore && (
                <span className="text-emerald-300 ml-1.5 text-[11px]">
                  (Right-Click to Eat +{activeDef.healthRestore ?? 2} HP)
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 text-[11px]">Bare Hand</span>
          )}
        </div>

        {/* Survival Health, Breath & Hunger Bars */}
        {hud.mode === 'survival' && (
          <div className="flex items-center justify-between w-[460px] max-w-[94vw] px-1">
            {/* Hearts */}
            <div className="flex items-center gap-0.5" title={`Health: ${hud.health}/${hud.maxHealth}`}>
              {Array.from({ length: 10 }).map((_, i) => {
                const full = hud.health >= (i + 1) * 2;
                const half = !full && hud.health >= i * 2 + 1;
                return (
                  <span
                    key={i}
                    className={`text-sm leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${
                      full
                        ? 'text-rose-500'
                        : half
                        ? 'text-rose-400 opacity-75'
                        : 'text-slate-700'
                    }`}
                  >
                    ♥
                  </span>
                );
              })}
            </div>

            {/* Breath Bubbles when Underwater */}
            {hud.underwater && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 10 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border ${
                      i < Math.ceil(hud.breath)
                        ? 'bg-sky-300 border-sky-100'
                        : 'bg-slate-900/50 border-slate-600'
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Hunger Bolts */}
            <div className="flex items-center gap-0.5" title={`Hunger: ${hud.hunger}/${hud.maxHunger}`}>
              {Array.from({ length: 10 }).map((_, i) => {
                const filled = hud.hunger >= (i + 1) * 2;
                return (
                  <span
                    key={i}
                    className={`text-xs leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] ${
                      filled ? 'text-amber-400' : 'text-slate-700'
                    }`}
                  >
                    ◆
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 9-Slot Hotbar */}
        <div className="pointer-events-auto flex items-center gap-1.5 bg-slate-950/85 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-2xl">
          {Array.from({ length: 9 }).map((_, idx) => (
            <ItemSlotView
              key={idx}
              slot={hud.inventory[idx]}
              selected={hud.selectedHotbar === idx}
              keyBadge={String(idx + 1)}
              onClick={() => onSelectHotbar(idx)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
