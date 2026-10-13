import type { ReactNode } from 'react';
import { ITEMS, itemDesc } from '../game/data';
import { iconURL } from '../game/gfx';
import type { Stack } from '../game/world';

export const Icon = ({ id, className = '' }: { id: string; className?: string }) => (
  <img src={iconURL(id)} alt="" draggable={false} className={`[image-rendering:pixelated] select-none ${className}`} />
);

export const btn = 'px-4 py-2 rounded border-2 border-amber-950 bg-gradient-to-b from-amber-600 to-amber-800 text-amber-50 font-bold tracking-wide shadow-[0_3px_0_#3a1f0a] active:translate-y-[2px] active:shadow-none hover:from-amber-500 hover:to-amber-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer select-none';
export const btn2 = 'px-3 py-1.5 rounded border-2 border-stone-900 bg-gradient-to-b from-stone-600 to-stone-800 text-stone-100 font-semibold shadow-[0_2px_0_#111] active:translate-y-[1px] active:shadow-none hover:from-stone-500 hover:to-stone-700 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer select-none';
export const btnRed = 'px-3 py-1.5 rounded border-2 border-red-950 bg-gradient-to-b from-red-700 to-red-900 text-red-50 font-semibold shadow-[0_2px_0_#300] active:translate-y-[1px] active:shadow-none hover:from-red-600 hover:to-red-800 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer select-none';

export function itemTitle(s: Stack): string {
  if (!s) return ''; const d = ITEMS[s.id]; if (!d) return '';
  return `${d.name}${s.n > 1 ? ` (${s.n})` : ''}\n${itemDesc(s.id)}${d.value ? `\nValue: ${Math.max(1, Math.floor(d.value * 0.2))} copper` : ''}`;
}

export function Slot({ s, sel, active, onClick, onContext, onHover, size = 'w-11 h-11', hint, label }: {
  s: Stack; sel?: boolean; active?: boolean; onClick?: () => void; onContext?: () => void; onHover?: (id: string | null) => void; size?: string; hint?: string; label?: string;
}) {
  return (
    <div
      onClick={onClick} onContextMenu={e => { e.preventDefault(); onContext && onContext(); }}
      onMouseEnter={() => onHover && onHover(s ? s.id : null)} onMouseLeave={() => onHover && onHover(null)}
      className={`relative ${size} shrink-0 rounded-sm border-2 ${sel ? 'border-yellow-300 bg-yellow-900/50 shadow-[0_0_8px_#fde047]' : active ? 'border-amber-300 bg-amber-900/50' : 'border-[#4a3520] bg-[#1b140c]/90 hover:border-amber-600'} cursor-pointer select-none`}
      title={itemTitle(s)}
    >
      {s && <Icon id={s.id} className="absolute inset-[10%] w-[80%] h-[80%]" />}
      {s && s.n > 1 && <span className="absolute right-0.5 bottom-0 text-[10px] font-bold text-white [text-shadow:1px_1px_0_#000,-1px_-1px_0_#000,1px_-1px_0_#000,-1px_1px_0_#000]">{s.n}</span>}
      {hint && <span className="absolute left-0.5 top-0 text-[9px] font-bold text-amber-200/90 [text-shadow:1px_1px_0_#000]">{hint}</span>}
      {!s && label && <span className="absolute inset-0 grid place-items-center text-[9px] text-amber-200/40 text-center leading-none">{label}</span>}
    </div>
  );
}

export function Coins({ c }: { c: number }) {
  c = Math.max(0, Math.floor(c)); const g = Math.floor(c / 10000), s = Math.floor((c % 10000) / 100), cu = c % 100;
  return (
    <span className="inline-flex items-center gap-1.5 font-bold text-sm">
      <span className="text-yellow-300">{g}<span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-700 ml-0.5 align-middle" /></span>
      <span className="text-slate-200">{s}<span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-300 border border-slate-600 ml-0.5 align-middle" /></span>
      <span className="text-orange-400">{cu}<span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500 border border-orange-900 ml-0.5 align-middle" /></span>
    </span>
  );
}

export function Panel({ title, onClose, children, className = '', z = 'z-30' }: { title: string; onClose?: () => void; children: ReactNode; className?: string; z?: string }) {
  return (
    <div className={`pointer-events-auto ${z} rounded-lg border-4 border-[#5a3d1e] bg-[#1d150c]/95 text-amber-50 shadow-[0_0_0_2px_#000,0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm ${className}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b-2 border-[#5a3d1e] bg-gradient-to-b from-[#3a2815] to-[#2a1c0e] rounded-t">
        <h2 className="font-extrabold tracking-widest uppercase text-amber-200 text-sm">{title}</h2>
        {onClose && <button onClick={onClose} className="w-7 h-7 rounded bg-red-900 hover:bg-red-700 border-2 border-red-950 text-white font-bold leading-none cursor-pointer" aria-label="Close">✕</button>}
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

export const fmtTime = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60); return h > 0 ? `${h}h ${m}m` : `${m}m ${sec}s`; };
