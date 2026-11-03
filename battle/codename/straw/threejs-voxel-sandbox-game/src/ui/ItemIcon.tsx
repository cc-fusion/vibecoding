import { memo } from 'react';
import { getItemIcon } from '../game/textures';
import { itemDef, type Stack } from '../game/items';
import { cn } from '../utils/cn';

export const ItemIcon = memo(function ItemIcon({ id, size = 40 }: { id: number; size?: number }) {
  return (
    <img
      src={getItemIcon(id)}
      alt={itemDef(id).name}
      width={size}
      height={size}
      draggable={false}
      className="pixelated pointer-events-none"
      style={{ width: size, height: size }}
    />
  );
});

interface SlotProps {
  stack: Stack | null;
  size?: number;
  selected?: boolean;
  hotkey?: string;
  dim?: boolean;
  onClick?: (button: 0 | 2, shift: boolean) => void;
  onHover?: () => void;
}

export function Slot({ stack, size = 48, selected, hotkey, dim, onClick, onHover }: SlotProps) {
  const def = stack ? itemDef(stack.id) : null;
  const durFrac = stack && def?.durability && stack.dur !== undefined ? stack.dur / def.durability : null;
  return (
    <div
      className={cn('mc-slot group relative shrink-0', selected && 'mc-slot-selected', onClick && 'cursor-pointer')}
      style={{ width: size, height: size }}
      title={stack ? def!.name : undefined}
      onMouseDown={onClick ? (e) => {
        if (e.button === 0 || e.button === 2) { e.preventDefault(); onClick(e.button as 0 | 2, e.shiftKey); }
      } : undefined}
      onMouseEnter={onHover}
      onContextMenu={(e) => e.preventDefault()}
    >
      {stack && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ItemIcon id={stack.id} size={size - 8} />
        </div>
      )}
      {stack && stack.count > 1 && (
        <span className="absolute right-0.5 bottom-0 font-pixel text-[13px] leading-none text-white" style={{ textShadow: '1px 1px 0 #222, -1px 0 0 #222, 0 -1px 0 #222' }}>
          {stack.count}
        </span>
      )}
      {durFrac !== null && (
        <div className="absolute inset-x-1 bottom-[3px] h-[4px] rounded-sm bg-black/70">
          <div
            className="h-full rounded-sm"
            style={{ width: `${Math.round(durFrac * 100)}%`, backgroundColor: durFrac > 0.5 ? '#57d93d' : durFrac > 0.25 ? '#e8c832' : '#e23c2a' }}
          />
        </div>
      )}
      {hotkey && <span className="absolute top-0 left-0.5 text-[9px] font-semibold text-white/40">{hotkey}</span>}
      {dim && <div className="absolute inset-0 bg-black/35" />}
      {onClick && <div className="pointer-events-none absolute inset-0 bg-white/0 group-hover:bg-white/15" />}
    </div>
  );
}
