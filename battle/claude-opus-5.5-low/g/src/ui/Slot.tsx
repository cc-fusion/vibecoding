import { getIcon, ITEMS } from '../game/blocks';
import type { Stack } from '../game/inventory';

export function ItemIcon({ stack, size = 40 }: { stack: Stack; size?: number }) {
  const tool = ITEMS[stack.id]?.tool;
  return (
    <div className="relative pointer-events-none" style={{ width: size, height: size }}>
      <img src={getIcon(stack.id)} width={size} height={size} draggable={false} style={{ imageRendering: 'pixelated' }} alt="" />
      {stack.count > 1 && (
        <span className="absolute -bottom-0.5 right-0 text-white text-lg leading-none font-pixel" style={{ textShadow: '2px 2px 0 #3f3f3f' }}>{stack.count}</span>
      )}
      {tool && stack.dur !== undefined && stack.dur < tool.durability && (
        <div className="absolute bottom-0.5 left-1 right-1 h-[3px] bg-black">
          <div className="h-full" style={{ width: `${(stack.dur / tool.durability) * 100}%`, background: `hsl(${(stack.dur / tool.durability) * 120},90%,50%)` }} />
        </div>
      )}
    </div>
  );
}

export function Slot({ stack, onClick, highlight, title, big }: {
  stack: Stack | null; onClick?: (right: boolean, shift: boolean) => void; highlight?: boolean; title?: string; big?: boolean;
}) {
  const s = big ? 58 : 46;
  return (
    <div
      title={title ?? (stack ? ITEMS[stack.id]?.name : '')}
      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onClick?.(e.button === 2, e.shiftKey); }}
      onContextMenu={e => e.preventDefault()}
      className={`mc-slot flex items-center justify-center ${highlight ? 'ring-2 ring-white' : ''}`}
      style={{ width: s, height: s }}
    >
      {stack && <ItemIcon stack={stack} size={big ? 44 : 36} />}
    </div>
  );
}
