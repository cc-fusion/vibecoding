import type { ReactNode } from 'react';
import type { Cost, ResKey } from '../game/data';
import type { Game } from '../game/sim';
import { audio } from '../game/audio';

export const RES_ICON: Record<ResKey, string> = { stone: '🪨', iron: '⚙️', gold: '🪙' };

export function Btn(props: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'good'; disabled?: boolean; small?: boolean; title?: string; className?: string; active?: boolean }) {
  const { children, onClick, kind = 'ghost', disabled, small, title, className = '', active } = props;
  const base = 'rounded-md font-semibold transition active:scale-95 select-none whitespace-nowrap ' + (small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm');
  const k = kind === 'primary'
    ? 'bg-gradient-to-b from-amber-300 to-amber-500 text-slate-900 hover:from-amber-200 hover:to-amber-400 shadow shadow-amber-900/40'
    : kind === 'danger'
      ? 'bg-rose-700/80 hover:bg-rose-600 text-white'
      : kind === 'good'
        ? 'bg-emerald-600/80 hover:bg-emerald-500 text-white'
        : active
          ? 'bg-cyan-500/30 border border-cyan-300/70 text-cyan-100'
          : 'bg-slate-800/80 hover:bg-slate-700 border border-slate-600/60 text-slate-100';
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={() => { if (disabled) { audio.sfx('err'); return; } audio.sfx('ui'); onClick?.(); }}
      className={`${base} ${k} ${disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
    >
      {children}
    </button>
  );
}

export function CostChips({ cost, g }: { cost: Cost; g: Game }) {
  const keys = (['stone', 'iron', 'gold'] as ResKey[]).filter((k) => cost[k]);
  if (!keys.length) return <span className="text-xs text-slate-400">free</span>;
  return (
    <span className="inline-flex flex-wrap gap-x-2 gap-y-0.5">
      {keys.map((k) => (
        <span key={k} className={`text-xs font-semibold ${g.res[k] >= (cost[k] || 0) ? 'text-slate-100' : 'text-rose-400'}`}>
          {RES_ICON[k]} {cost[k]}
        </span>
      ))}
    </span>
  );
}

export function Meter({ v, max, color, className = '' }: { v: number; max: number; color: string; className?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
  return (
    <div className={`h-2 rounded-full bg-slate-900/80 overflow-hidden border border-white/10 ${className}`}>
      <div className="h-full rounded-full transition-[width] duration-150" style={{ width: `${p * 100}%`, background: color }} />
    </div>
  );
}

export function Modal({ title, children, onClose, wide }: { title?: string; children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 overflow-y-auto" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`my-auto w-full ${wide ? 'max-w-4xl' : 'max-w-md'} rounded-xl border border-cyan-800/60 bg-gradient-to-b from-slate-900/95 to-slate-950/95 p-5 shadow-2xl shadow-black/60 anim-pop`}
      >
        {title && <h2 className="font-display text-2xl text-amber-200 mb-3 tracking-wide">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-20 text-slate-300">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 accent-cyan-400" />
      <span className="w-9 text-right text-slate-400 tabular-nums">{Math.round(value * 100)}</span>
    </label>
  );
}

export function Toggle({ label, value, onChange, desc }: { label: string; value: boolean; onChange: (v: boolean) => void; desc?: string }) {
  return (
    <button onClick={() => { audio.sfx('ui'); onChange(!value); }} className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white/5">
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        {desc && <span className="block text-xs text-slate-400">{desc}</span>}
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${value ? 'bg-cyan-500' : 'bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export const fmt = (n: number) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.floor(n)));
