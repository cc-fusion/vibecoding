import { iconFor, getName, ITEMS } from '../game/blocks';
import type { Slot } from '../game/inventory';

export function ItemIcon({ id, size = 32 }: { id: number; size?: number }) {
  return <img src={iconFor(id)} width={size} height={size} draggable={false} style={{ imageRendering: 'pixelated' }} alt="" />;
}

export function SlotView({ slot, onClick, selected, big, onHover }: {
  slot: Slot | null; onClick?: (e: React.MouseEvent) => void; selected?: boolean; big?: boolean; onHover?: (s: Slot | null) => void;
}) {
  const tool = slot ? ITEMS[slot.id]?.tool : undefined;
  const dur = tool && slot?.dur !== undefined ? slot.dur / tool.durability : 1;
  const sz = big ? 52 : 40;
  return (
    <div
      className={`mc-slot relative flex items-center justify-center select-none ${selected ? 'mc-slot-sel' : ''}`}
      style={{ width: sz, height: sz }}
      onMouseDown={(e) => { e.preventDefault(); onClick?.(e); }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => onHover?.(slot)}
      onMouseLeave={() => onHover?.(null)}
      title={slot ? getName(slot.id) : ''}
    >
      {slot && <ItemIcon id={slot.id} size={big ? 40 : 32} />}
      {slot && slot.count > 1 && <span className="mc-count absolute right-0.5 bottom-0 text-[13px]">{slot.count}</span>}
      {slot && tool && dur < 1 && (
        <div className="absolute left-1 right-1 bottom-1 h-[3px] bg-black">
          <div className="h-full" style={{ width: `${dur * 100}%`, background: `hsl(${dur * 120},90%,50%)` }} />
        </div>
      )}
    </div>
  );
}
