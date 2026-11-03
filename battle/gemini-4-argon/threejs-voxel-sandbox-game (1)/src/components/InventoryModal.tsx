import React, { useEffect, useState } from 'react';
import { Flame, Hammer, Package, Sparkles, X } from 'lucide-react';
import { VoxelEngine } from '../game/engine';
import { CREATIVE_PALETTE, ITEMS } from '../game/items';
import {
  CRAFTING_RECIPES,
  SMELTING_RECIPES,
  canCraftRecipe,
  countMatchingItems,
} from '../game/recipes';
import { getItemIconUrl } from '../game/textures';
import { EngineHUDState } from '../game/types';
import { ItemSlotView } from './ItemSlotView';

interface InventoryModalProps {
  hud: EngineHUDState;
  engine: VoxelEngine;
  onClose: () => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  engine,
  onClose,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<'craft' | 'furnace' | 'creative'>(
    hud.activeFurnace ? 'furnace' : 'craft'
  );
  const [filterCat, setFilterCat] = useState<
    'all' | 'craftable' | 'basics' | 'tools' | 'building' | 'utility'
  >('all');

  useEffect(() => {
    if (hud.activeFurnace) setRightTab('furnace');
  }, [hud.activeFurnaceKey]);

  const handleSlotClick = (idx: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      engine.quickTransferInventorySlot(idx);
      setSelectedSlot(null);
      return;
    }

    if (selectedSlot === null) {
      if (hud.inventory[idx]) {
        setSelectedSlot(idx);
      }
    } else {
      engine.moveInventorySlot(selectedSlot, idx, false);
      setSelectedSlot(null);
    }
  };

  const handleSlotRightClick = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (selectedSlot !== null && !hud.inventory[idx]) {
      engine.moveInventorySlot(selectedSlot, idx, true);
      setSelectedSlot(null);
    } else if (hud.inventory[idx]) {
      setSelectedSlot(idx);
    }
  };

  const filteredRecipes = CRAFTING_RECIPES.filter((r) => {
    if (filterCat === 'craftable') {
      return canCraftRecipe(r, hud.inventory, hud.nearCraftingTable);
    }
    if (filterCat === 'all') return true;
    return r.category === filterCat;
  });

  const activeSelectedData =
    selectedSlot !== null ? hud.inventory[selectedSlot] : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3">
      <div className="w-full max-w-5xl bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950/90 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-amber-400" />
            <h2 className="font-bold text-base text-white">
              Workshop & Backpack
            </h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                hud.nearCraftingTable
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {hud.nearCraftingTable
                ? '3×3 Crafting Table Active ✓'
                : '2×2 Hand Crafting (Stand near Crafting Table for Tools)'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5 overflow-y-auto">
          {/* Left Column: 27-Slot Backpack + 9-Slot Hotbar */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Backpack Storage (27 Slots)
                </span>
                <span className="text-[11px] text-slate-400">
                  Click: Move/Merge · Right-Click: Half · Shift+Click: Quick Swap
                </span>
              </div>

              <div className="grid grid-cols-9 gap-1.5 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                {Array.from({ length: 27 }).map((_, i) => {
                  const idx = i + 9;
                  return (
                    <ItemSlotView
                      key={idx}
                      slot={hud.inventory[idx]}
                      selected={selectedSlot === idx}
                      size="sm"
                      onClick={(e) => handleSlotClick(idx, e)}
                      onContextMenu={(e) => handleSlotRightClick(idx, e)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Active Hotbar Row */}
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400/90 mb-2">
                Equipped Hotbar (Keys 1 – 9)
              </div>
              <div className="grid grid-cols-9 gap-1.5 bg-slate-950/90 p-2.5 rounded-xl border border-amber-500/30">
                {Array.from({ length: 9 }).map((_, idx) => (
                  <ItemSlotView
                    key={idx}
                    slot={hud.inventory[idx]}
                    selected={selectedSlot === idx}
                    highlightRing={hud.selectedHotbar === idx && selectedSlot !== idx}
                    keyBadge={String(idx + 1)}
                    size="sm"
                    onClick={(e) => handleSlotClick(idx, e)}
                    onContextMenu={(e) => handleSlotRightClick(idx, e)}
                  />
                ))}
              </div>
            </div>

            {/* Selected Slot Action Helper Bar */}
            <div className="min-h-[52px] bg-slate-950/70 border border-slate-800 rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs">
              {activeSelectedData ? (
                <>
                  <div>
                    <span className="font-semibold text-amber-300">
                      {ITEMS[activeSelectedData.itemId]?.name}
                    </span>
                    <span className="text-slate-400 ml-2">
                      ×{activeSelectedData.count} selected — click any slot to place/swap
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hud.activeFurnace && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            engine.transferToFurnace(selectedSlot!, 'input');
                            setSelectedSlot(null);
                          }}
                          className="px-2 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium cursor-pointer"
                        >
                          → Smelt Input
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            engine.transferToFurnace(selectedSlot!, 'fuel');
                            setSelectedSlot(null);
                          }}
                          className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium cursor-pointer"
                        >
                          → Fuel
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedSlot(null)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <span className="text-slate-400">
                  Tip: Chop any tree for Logs → Craft Planks &amp; Sticks → Craft a Crafting Table &amp; right-click it in the world to unlock Pickaxes, Axes, Swords &amp; Furnaces!
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Crafting / Furnace / Creative Tabs */}
          <div className="lg:col-span-6 flex flex-col gap-3 min-h-[370px]">
            {/* Tab Switcher */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRightTab('craft')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                  rightTab === 'craft'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Hammer className="w-3.5 h-3.5" />
                Crafting ({CRAFTING_RECIPES.length})
              </button>

              {hud.activeFurnace && (
                <button
                  type="button"
                  onClick={() => setRightTab('furnace')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    rightTab === 'furnace'
                      ? 'bg-orange-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  Stone Furnace
                </button>
              )}

              {hud.mode === 'creative' && (
                <button
                  type="button"
                  onClick={() => setRightTab('creative')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                    rightTab === 'creative'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Creative Palette
                </button>
              )}
            </div>

            {/* TAB 1: Smart Crafting Recipe Book */}
            {rightTab === 'craft' && (
              <>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ['all', 'All'],
                      ['craftable', 'Craftable'],
                      ['basics', 'Basics'],
                      ['tools', 'Tools & Weapons'],
                      ['utility', 'Stations & Light'],
                      ['building', 'Blocks'],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilterCat(key)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                        filterCat === key
                          ? 'bg-slate-200 text-slate-950 font-semibold'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto max-h-[330px] pr-1 space-y-1.5">
                  {filteredRecipes.map((recipe) => {
                    const affordable = canCraftRecipe(
                      recipe,
                      hud.inventory,
                      hud.nearCraftingTable
                    );
                    const outIcon = getItemIconUrl(recipe.output.itemId);
                    const needsTableBlocked =
                      recipe.requiresTable && !hud.nearCraftingTable;

                    return (
                      <div
                        key={recipe.id}
                        className={`flex items-center justify-between p-2 rounded-xl border transition ${
                          affordable
                            ? 'bg-slate-800/90 border-emerald-500/45 hover:border-emerald-400'
                            : 'bg-slate-950/60 border-slate-800/80 opacity-80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-950 border border-slate-700 flex items-center justify-center shrink-0 relative">
                            {outIcon && (
                              <img
                                src={outIcon}
                                alt={recipe.name}
                                className="w-7 h-7 pixelated"
                              />
                            )}
                            {recipe.output.count > 1 && (
                              <span className="absolute bottom-0 right-1 text-[10px] font-bold text-white">
                                ×{recipe.output.count}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {recipe.name}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              {recipe.ingredients.map((ing, i) => {
                                const have = countMatchingItems(
                                  hud.inventory,
                                  ing.itemId
                                );
                                const ok = have >= ing.count;
                                return (
                                  <span
                                    key={i}
                                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                                      ok
                                        ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/50'
                                        : 'bg-rose-950/70 text-rose-300 border border-rose-800/50'
                                    }`}
                                  >
                                    {ITEMS[ing.itemId]?.name}: {have}/{ing.count}
                                  </span>
                                );
                              })}
                              {needsTableBlocked && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/50">
                                  Needs Crafting Table
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <button
                            type="button"
                            disabled={!affordable}
                            onClick={() => engine.craft(recipe.id, 1)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                              affordable
                                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            Craft
                          </button>
                          {affordable && (
                            <button
                              type="button"
                              onClick={() => engine.craft(recipe.id, 5)}
                              className="px-2 py-1.5 rounded-lg text-xs font-bold bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                              title="Craft up to 5x"
                            >
                              ×5
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* TAB 2: Working Stone Furnace Smelter */}
            {rightTab === 'furnace' && hud.activeFurnace && (
              <div className="flex-1 bg-slate-950/75 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-orange-300 flex items-center gap-2">
                    <Flame className="w-4 h-4 text-orange-400" />
                    Stone Furnace Smelting Chamber
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select an ore/sand/clay/meat slot on the left and click{' '}
                    <span className="text-sky-300 font-medium">→ Smelt Input</span>, then load Coal or Wood into{' '}
                    <span className="text-amber-300 font-medium">→ Fuel</span>!
                  </p>
                </div>

                <div className="flex items-center justify-center gap-6 py-4 bg-slate-900/90 rounded-xl border border-slate-800">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[11px] text-sky-300 font-medium">Input Ore</span>
                    <ItemSlotView
                      slot={hud.activeFurnace.input}
                      size="lg"
                      onClick={() => {
                        if (selectedSlot !== null) {
                          engine.transferToFurnace(selectedSlot, 'input');
                          setSelectedSlot(null);
                        } else {
                          engine.collectFromFurnace('input');
                        }
                      }}
                    />

                    {/* Burn Flame Indicator */}
                    <div className="flex items-center gap-1 text-xs text-orange-400 font-mono">
                      <Flame
                        className={`w-4 h-4 ${
                          hud.activeFurnace.burnRemaining > 0
                            ? 'text-orange-400 animate-pulse'
                            : 'text-slate-600'
                        }`}
                      />
                      {hud.activeFurnace.burnRemaining > 0
                        ? `${Math.ceil(hud.activeFurnace.burnRemaining)}s`
                        : 'Idle'}
                    </div>

                    <ItemSlotView
                      slot={hud.activeFurnace.fuel}
                      size="lg"
                      onClick={() => {
                        if (selectedSlot !== null) {
                          engine.transferToFurnace(selectedSlot, 'fuel');
                          setSelectedSlot(null);
                        } else {
                          engine.collectFromFurnace('fuel');
                        }
                      }}
                    />
                    <span className="text-[11px] text-amber-300 font-medium">
                      Fuel (Coal / Wood)
                    </span>
                  </div>

                  {/* Smelting Progress Bar */}
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-24 h-3 bg-slate-950 rounded-full border border-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all"
                        style={{
                          width: `${Math.round(hud.activeFurnace.cookProgress * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {Math.round(hud.activeFurnace.cookProgress * 100)}%
                    </span>
                  </div>

                  {/* Output Slot */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[11px] text-emerald-300 font-semibold">
                      Smelted Output
                    </span>
                    <ItemSlotView
                      slot={hud.activeFurnace.output}
                      highlightRing={Boolean(hud.activeFurnace.output)}
                      size="lg"
                      onClick={() => engine.collectFromFurnace('output')}
                    />
                    <span className="text-[10px] text-slate-400">Click to Collect</span>
                  </div>
                </div>

                {/* Smelting Recipes Reference */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {SMELTING_RECIPES.map((sr) => (
                    <div
                      key={sr.id}
                      className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-slate-300 flex items-center justify-between"
                    >
                      <span>{ITEMS[sr.input]?.name}</span>
                      <span className="text-emerald-400 font-semibold">
                        → {ITEMS[sr.output]?.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: Creative Infinite Block & Tool Palette */}
            {rightTab === 'creative' && (
              <div className="flex-1 bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 overflow-y-auto max-h-[340px]">
                <div className="text-xs text-emerald-300 font-medium mb-2.5">
                  Click any block or tool to add a full stack directly to your inventory:
                </div>
                <div className="grid grid-cols-7 sm:grid-cols-9 gap-1.5">
                  {CREATIVE_PALETTE.map((itemId) => (
                    <ItemSlotView
                      key={itemId}
                      slot={{
                        itemId,
                        count: ITEMS[itemId].maxStack === 1 ? 1 : 64,
                      }}
                      size="sm"
                      onClick={() => engine.giveCreativeItem(itemId, 64)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
