import React from 'react';
import { ITEMS } from '../game/items';
import { getItemIconUrl } from '../game/textures';
import { InventorySlot } from '../game/types';

interface ItemSlotViewProps {
  slot: InventorySlot | null;
  selected?: boolean;
  highlightRing?: boolean;
  keyBadge?: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  titleOverride?: string;
}

export const ItemSlotView: React.FC<ItemSlotViewProps> = ({
  slot,
  selected = false,
  highlightRing = false,
  keyBadge,
  size = 'md',
  onClick,
  onContextMenu,
  titleOverride,
}) => {
  const def = slot ? ITEMS[slot.itemId] : null;
  const iconUrl = slot ? getItemIconUrl(slot.itemId) : '';

  const dims =
    size === 'lg'
      ? 'w-14 h-14'
      : size === 'sm'
      ? 'w-10 h-10'
      : 'w-12 h-12';

  const imgDims =
    size === 'lg'
      ? 'w-9 h-9'
      : size === 'sm'
      ? 'w-7 h-7'
      : 'w-8 h-8';

  const durabilityRatio =
    slot && def?.maxDurability && slot.durability !== undefined
      ? Math.max(0, Math.min(1, slot.durability / def.maxDurability))
      : null;

  const tooltip =
    titleOverride ??
    (def
      ? `${def.name}${
          def.toolCategory !== 'none'
            ? ` • ${def.miningSpeed}x Speed • ${def.attackDamage} ATK`
            : def.foodRestore
            ? ` • Restores +${def.foodRestore} Hunger`
            : ''
        }`
      : 'Empty Slot');

  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative ${dims} flex items-center justify-center rounded-md border transition-all duration-75 cursor-pointer ${
        selected
          ? 'bg-slate-800/95 border-amber-400 ring-2 ring-amber-400/70 scale-105 z-10 shadow-lg shadow-amber-500/20'
          : highlightRing
          ? 'bg-emerald-900/50 border-emerald-400 ring-2 ring-emerald-400/60'
          : 'bg-slate-900/80 border-slate-700/85 hover:border-slate-400/90 hover:bg-slate-800/85'
      }`}
    >
      {keyBadge && (
        <span className="absolute top-0.5 left-1 text-[10px] font-mono leading-none text-slate-400 pointer-events-none">
          {keyBadge}
        </span>
      )}

      {slot && iconUrl && (
        <img
          src={iconUrl}
          alt={def?.name ?? slot.itemId}
          className={`${imgDims} pixelated pointer-events-none drop-shadow-[0_2px_2px_rgba(0,0,0,0.85)]`}
          draggable={false}
        />
      )}

      {slot && slot.count > 1 && (
        <span className="absolute bottom-0.5 right-1 text-[11px] font-bold leading-none text-white drop-shadow-[0_1px_2px_rgba(0,0,0,1)] pointer-events-none">
          {slot.count}
        </span>
      )}

      {durabilityRatio !== null && durabilityRatio < 1 && (
        <div className="absolute bottom-1 left-1.5 right-1.5 h-1 bg-slate-950 rounded-full overflow-hidden pointer-events-none">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.round(durabilityRatio * 100)}%`,
              backgroundColor:
                durabilityRatio > 0.55
                  ? '#22c55e'
                  : durabilityRatio > 0.25
                  ? '#eab308'
                  : '#ef4444',
            }}
          />
        </div>
      )}
    </button>
  );
};
