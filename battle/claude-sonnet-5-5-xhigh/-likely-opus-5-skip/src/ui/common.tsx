import { useSyncExternalStore, useEffect, useState } from 'react';
import type { Game } from '../game/game';
import { getIcon } from '../game/textures';
import { ITEMDEF, type Stack } from '../game/items';
import { maxDur } from '../game/items';

export function useGame(g: Game) {
  return useSyncExternalStore(g.subscribe, g.getVersion);
}
export function useTick(ms: number) {
  const [, f] = useState(0);
  useEffect(() => { const id = setInterval(() => f((x) => x + 1), ms); return () => clearInterval(id); }, [ms]);
}

export function Icon({ id, size = 32 }: { id: number; size?: number }) {
  return <img className="px" src={getIcon(id)} width={size} height={size} draggable={false} style={{ imageRendering: 'pixelated', pointerEvents: 'none' }} />;
}

export function Slot({ stack, onClick, size = 44, kind, onHover }: { stack: Stack | null; onClick?: (button: number, shift: boolean) => void; size?: number; kind?: 'out'; onHover?: (s: Stack | null) => void }) {
  const md = stack ? maxDur(stack.id) : 0;
  return (
    <div
      className={'slot ' + (kind || '')}
      style={{ width: size, height: size }}
      onMouseDown={(e) => { e.preventDefault(); onClick?.(e.button, e.shiftKey); }}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={() => onHover?.(stack)}
      onMouseLeave={() => onHover?.(null)}
    >
      {stack && (
        <>
          <Icon id={stack.id} size={size - 12} />
          {stack.n > 1 && <span className="count">{stack.n}</span>}
          {md > 0 && stack.d ? (
            <div className="absolute left-1 right-1 bottom-0.5 h-[3px] bg-black/80">
              <div style={{ width: `${100 - (stack.d / md) * 100}%`, background: `hsl(${(1 - stack.d / md) * 120},80%,50%)`, height: '100%' }} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export const itemTitle = (s: Stack) => ITEMDEF[s.id]?.name ?? '?';

const HEART = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
const MEAT = ['....XXX..', '...XXXXX.', '..XXXXXXX', '..XXXXXXX', '..XXXXXX.', '.XXXXXX..', 'WWXXXX...', 'WWW......', '.W.......'];
function Pix({ map, fill, hi, w, h, clip = 1 }: { map: string[]; fill: string; hi?: string; w: number; h: number; clip?: number }) {
  return (
    <svg width={w * 2} height={h * 2} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" style={{ overflow: 'visible' }}>
      {map.map((row, y) => row.split('').map((c, x) => (c === '.' ? null : (x + 1 <= w * clip + 0.01 || x < w * clip) ? <rect key={x + ',' + y} x={x} y={y} width={1} height={1} fill={c === 'W' ? '#efe4d0' : hi && x === 1 && y === 1 ? hi : fill} /> : null)))}
    </svg>
  );
}
export function Bar({ value, kind }: { value: number; kind: 'heart' | 'food' }) {
  const items = [];
  for (let i = 0; i < 10; i++) {
    const v = value - i * 2;
    const full = v >= 2, half = v >= 1 && v < 2;
    const map = kind === 'heart' ? HEART : MEAT, w = 9, h = kind === 'heart' ? 8 : 9;
    items.push(
      <div key={i} className="relative" style={{ width: 18, height: h * 2 + 1 }}>
        <div className="absolute inset-0 opacity-90"><Pix map={map} fill={kind === 'heart' ? '#3a1414' : '#3b2a18'} w={w} h={h} /></div>
        {(full || half) && <div className="absolute inset-0"><Pix map={map} fill={kind === 'heart' ? '#e4262b' : '#c98a46'} hi={kind === 'heart' ? '#ff9a9a' : undefined} w={w} h={h} clip={full ? 1 : 0.5} /></div>}
      </div>,
    );
  }
  return <div className={'flex gap-[1px] ' + (kind === 'heart' && value <= 4 ? 'low' : '')}>{items}</div>;
}
