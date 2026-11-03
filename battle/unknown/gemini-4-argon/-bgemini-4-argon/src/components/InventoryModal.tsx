import React, { useState } from 'react';
import { Flame, Hammer, Sparkles, X } from 'lucide-react';
import { ALL_CREATIVE_ITEMS, BLOCK, ITEMS } from '../engine/blocks';
import { GameHUDState } from '../engine/constants';
import {
  ANY_PLANKS,
  canCraftRecipe,
  countIngredientInInventory,
  CRAFTING_RECIPES,
  findFuelSlotIndex,
  SMELT_RECIPES,
} from '../engine/recipes';
import { getItemIconUrl } from '../engine/textureAtlas';

interface InventoryModalProps {
  hud: GameHUDState;
  onClose: () => void;
  onSwapSlots: (a: number, b: number) => void;
  onCraft: (recipeId: string) => void;
  onSmelt: (smeltId: string) => void;
  onGiveCreative: (itemId: number) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  hud,
  onClose,
  onSwapSlots,
  onCraft,
  onSmelt,
  onGiveCreative,
}) => {
  const [tab, setTab] = useState<'craft' | 'smelt' | 'creative'>(
    hud.gameMode === 'creative' ? 'creative' : 'craft'
  );
  const [craftFilter, setCraftFilter] = useState<'all' | 'craftable' | 'tools' | 'building'>('all');
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<number | null>(null);

  const handleSlotClick = (idx: number) => {
    if (selectedSlot === null) {
      if (hud.inventory[idx]) setSelectedSlot(idx);
    } else {
      onSwapSlots(selectedSlot, idx);
      setSelectedSlot(null);
    }
  };

  const fuelIdx = findFuelSlotIndex(hud.inventory);
  const fuelSlot = fuelIdx >= 0 ? hud.inventory[fuelIdx] : null;
  const hoveredDef = hoveredItemId ? ITEMS[hoveredItemId] : null;

  const filteredRecipes = CRAFTING_RECIPES.filter((r) => {
    if (craftFilter === 'craftable') return canCraftRecipe(hud.inventory, r);
    if (craftFilter === 'tools') return r.category === 'tools';
    if (craftFilter === 'building') return r.category === 'building' || r.category === 'functional';
    return true;
  });

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 md:p-6">
      <div className="mc-panel rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Tabs */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-700/70 bg-slate-900/70">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('craft')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                tab === 'craft'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Hammer className="w-3.5 h-3.5" />
              Crafting Workshop
            </button>

            <button
              type="button"
              onClick={() => setTab('smelt')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                tab === 'smelt'
                  ? 'bg-orange-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Smelting Furnace
            </button>

            {hud.gameMode === 'creative' && (
              <button
                type="button"
                onClick={() => setTab('creative')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  tab === 'creative'
                    ? 'bg-sky-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Creative Catalog
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Grid: Top Workshop Panel + Bottom Backpack & Hotbar */}
        <div className="p-5 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 Cols: Workshop / Furnace / Creative */}
          <div className="lg:col-span-7 flex flex-col">
            {tab === 'craft' && (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex gap-1.5">
                    {(
                      [
                        ['all', 'All'],
                        ['craftable', 'Ready'],
                        ['tools', 'Tools & Swords'],
                        ['building', 'Blocks'],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setCraftFilter(id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                          craftFilter === id
                            ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-200'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {filteredRecipes.map((recipe) => {
                    const outDef = ITEMS[recipe.outputId];
                    const ready = canCraftRecipe(hud.inventory, recipe);
                    return (
                      <div
                        key={recipe.id}
                        onMouseEnter={() => setHoveredItemId(recipe.outputId)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 transition ${
                          ready
                            ? 'bg-slate-900/90 border-emerald-500/50'
                            : 'bg-slate-900/45 border-slate-800 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-10 rounded-lg mc-slot flex items-center justify-center shrink-0">
                            <img
                              src={getItemIconUrl(recipe.outputId)}
                              alt={outDef?.name}
                              className="w-7 h-7 pixelated"
                            />
                            {recipe.outputCount > 1 && (
                              <span className="absolute bottom-0.5 right-1 text-[10px] font-bold text-white">
                                x{recipe.outputCount}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">{outDef?.name}</div>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {recipe.ingredients.map((req, idx) => {
                                const have = countIngredientInInventory(hud.inventory, req.id);
                                const ok = have >= req.count;
                                const iconId = req.id === ANY_PLANKS ? BLOCK.OAK_PLANKS : req.id;
                                const reqName =
                                  req.label ?? ITEMS[req.id]?.name ?? 'Material';
                                return (
                                  <span
                                    key={idx}
                                    className={`inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded ${
                                      ok
                                        ? 'bg-emerald-500/15 text-emerald-300'
                                        : 'bg-rose-500/15 text-rose-300'
                                    }`}
                                  >
                                    <img
                                      src={getItemIconUrl(iconId)}
                                      alt={reqName}
                                      className="w-3.5 h-3.5 pixelated"
                                    />
                                    {have}/{req.count} {reqName}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!ready}
                          onClick={() => onCraft(recipe.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold shrink-0 transition ${
                            ready
                              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Craft
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {tab === 'smelt' && (
              <div>
                <div className="mb-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-orange-200">
                    <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                    <span>
                      Furnace Fuel:{' '}
                      {fuelSlot ? (
                        <strong className="text-white">
                          {ITEMS[fuelSlot.id]?.name} (x{fuelSlot.count} available)
                        </strong>
                      ) : (
                        <strong className="text-rose-300">
                          Need Coal, Logs, Planks, or Sticks!
                        </strong>
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {SMELT_RECIPES.map((s) => {
                    const inDef = ITEMS[s.inputId];
                    const outDef = ITEMS[s.outputId];
                    const haveInput = countIngredientInInventory(hud.inventory, s.inputId);
                    const canSmelt = haveInput >= 1 && !!fuelSlot;
                    return (
                      <div
                        key={s.id}
                        onMouseEnter={() => setHoveredItemId(s.outputId)}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 ${
                          canSmelt
                            ? 'bg-slate-900/90 border-orange-400/50'
                            : 'bg-slate-900/45 border-slate-800 opacity-75'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={getItemIconUrl(s.inputId)}
                            alt={inDef?.name}
                            className="w-7 h-7 pixelated"
                          />
                          <span className="text-orange-400 font-bold text-xs">→</span>
                          <img
                            src={getItemIconUrl(s.outputId)}
                            alt={outDef?.name}
                            className="w-7 h-7 pixelated"
                          />
                          <div>
                            <div className="text-xs font-bold text-white">
                              {outDef?.name} {s.outputCount > 1 ? `x${s.outputCount}` : ''}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Input: {inDef?.name} ({haveInput} owned) + 1 Fuel
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={!canSmelt}
                          onClick={() => onSmelt(s.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
                            canSmelt
                              ? 'bg-orange-500 hover:bg-orange-400 text-slate-950 cursor-pointer'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                          }`}
                        >
                          Smelt
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {tab === 'creative' && (
              <div>
                <p className="text-xs text-slate-400 mb-2.5">
                  Click any block, mineral, weapon, or tool to add a full stack directly into your inventory:
                </p>
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 max-h-72 overflow-y-auto pr-1">
                  {ALL_CREATIVE_ITEMS.map((id) => {
                    const def = ITEMS[id];
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onGiveCreative(id)}
                        onMouseEnter={() => setHoveredItemId(id)}
                        title={def?.name}
                        className="h-11 rounded-lg mc-slot hover:brightness-125 flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={getItemIconUrl(id)}
                          alt={def?.name}
                          className="w-7 h-7 pixelated"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Cols: Player Backpack + Hotbar + Item Details */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                <span>Backpack (Click two slots to move/merge)</span>
                {selectedSlot !== null && (
                  <span className="text-amber-300">Slot #{selectedSlot + 1} selected</span>
                )}
              </div>

              {/* 27 Backpack Slots (indices 9..35) */}
              <div className="grid grid-cols-9 gap-1 mb-3">
                {Array.from({ length: 27 }).map((_, i) => {
                  const slotIdx = i + 9;
                  const slot = hud.inventory[slotIdx];
                  const def = slot ? ITEMS[slot.id] : null;
                  const picked = selectedSlot === slotIdx;
                  return (
                    <button
                      key={slotIdx}
                      type="button"
                      onClick={() => handleSlotClick(slotIdx)}
                      onMouseEnter={() => setHoveredItemId(slot?.id ?? null)}
                      className={`relative aspect-square rounded-md flex items-center justify-center cursor-pointer ${
                        picked ? 'mc-slot-active' : 'mc-slot hover:brightness-125'
                      }`}
                    >
                      {slot && def && (
                        <>
                          <img
                            src={getItemIconUrl(slot.id)}
                            alt={def.name}
                            className="w-6 h-6 pixelated"
                          />
                          {slot.count > 1 && (
                            <span className="absolute bottom-0 right-0.5 text-[9px] font-bold text-white">
                              {slot.count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Hotbar (Keys 1 – 9)
              </div>
              <div className="grid grid-cols-9 gap-1">
                {Array.from({ length: 9 }).map((_, slotIdx) => {
                  const slot = hud.inventory[slotIdx];
                  const def = slot ? ITEMS[slot.id] : null;
                  const picked = selectedSlot === slotIdx;
                  return (
                    <button
                      key={slotIdx}
                      type="button"
                      onClick={() => handleSlotClick(slotIdx)}
                      onMouseEnter={() => setHoveredItemId(slot?.id ?? null)}
                      className={`relative aspect-square rounded-md flex items-center justify-center cursor-pointer ${
                        picked ? 'mc-slot-active' : 'mc-slot hover:brightness-125'
                      }`}
                    >
                      {slot && def && (
                        <>
                          <img
                            src={getItemIconUrl(slot.id)}
                            alt={def.name}
                            className="w-6 h-6 pixelated"
                          />
                          {slot.count > 1 && (
                            <span className="absolute bottom-0 right-0.5 text-[9px] font-bold text-white">
                              {slot.count}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Item Tooltip Inspector */}
            <div className="p-3 rounded-xl bg-slate-900/85 border border-slate-800 min-h-[76px]">
              {hoveredDef ? (
                <div>
                  <div className="text-xs font-extrabold text-white flex items-center justify-between">
                    <span>{hoveredDef.name}</span>
                    <span className="text-[10px] uppercase text-emerald-400">{hoveredDef.category}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {hoveredDef.description ??
                      (hoveredDef.isBlock
                        ? 'Placeable voxel building block.'
                        : 'Valuable survival resource.')}
                  </p>
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  Hover over any recipe, block, or inventory slot to inspect its stats and uses.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
