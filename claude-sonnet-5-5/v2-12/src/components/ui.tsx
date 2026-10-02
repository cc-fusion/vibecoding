import { ReactNode } from 'react';
import { SHAPES, UType } from '../game/data';
import { audio } from '../game/audio';

export function UnitIcon({ type, team = 'p', size = 32 }: { type: UType; team?: 'p' | 'e'; size?: number }) {
  const fill = team === 'p' ? '#4ff0ff' : '#ff4f9a';
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className="shrink-0">
      {type === 'horizon' ? (
        <>
          <circle r="44" fill="#000" stroke="#c58bff" strokeWidth="6" />
          <circle r="30" fill="none" stroke="#ffb0e0" strokeWidth="3" strokeDasharray="20 12" />
        </>
      ) : (
        <>
          <path d={SHAPES[type]} fill={fill} stroke="#071022" strokeWidth="5" strokeLinejoin="round" />
          {(type === 'mote' || type === 'singularity') && <circle r={type === 'mote' ? 8 : 11} fill="#071022" />}
          {type === 'core' && <circle r="12" fill="#071022" />}
          {type === 'core' && <circle r="7" fill="#d0ffff" />}
          {type === 'warden' && <circle r="12" fill="#ff9b4f" stroke="#220510" strokeWidth="5" />}
        </>
      )}
    </svg>
  );
}

type BtnProps = {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'gold';
  disabled?: boolean;
  className?: string;
  title?: string;
  small?: boolean;
  active?: boolean;
};
export function Btn({ children, onClick, variant = 'ghost', disabled, className = '', title, small, active }: BtnProps) {
  const base = 'font-semibold tracking-wider uppercase rounded-md border transition-all duration-150 select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100';
  const sz = small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  const v = {
    primary: 'bg-cyan-400/20 border-cyan-300 text-cyan-100 hover:bg-cyan-300/35 shadow-[0_0_14px_rgba(79,240,255,0.35)]',
    ghost: 'bg-slate-800/60 border-slate-500/60 text-slate-200 hover:bg-slate-600/60 hover:border-slate-300',
    danger: 'bg-rose-500/20 border-rose-400 text-rose-100 hover:bg-rose-400/35',
    gold: 'bg-amber-400/20 border-amber-300 text-amber-100 hover:bg-amber-300/35 shadow-[0_0_14px_rgba(255,210,79,0.3)]',
  }[variant];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => {
        audio.init();
        audio.sfx('click');
        onClick?.();
      }}
      className={`${base} ${sz} ${v} ${active ? 'ring-2 ring-white/70' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className = '', title }: { children: ReactNode; className?: string; title?: ReactNode }) {
  return (
    <div className={`rounded-xl border border-cyan-400/25 bg-slate-950/75 backdrop-blur-md shadow-[0_0_30px_rgba(40,80,200,0.2)] ${className}`}>
      {title && <div className="px-4 pt-3 pb-1 font-display text-xs tracking-[0.25em] text-cyan-300/90 uppercase">{title}</div>}
      {children}
    </div>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm text-slate-200">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-cyan-400"
      />
      <span className="w-10 text-right tabular-nums">{Math.round(value * 100)}</span>
    </label>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        audio.sfx('click');
        onChange(!value);
      }}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-slate-600/60 bg-slate-800/50 px-3 py-2 text-left text-sm text-slate-200 hover:border-slate-300"
    >
      <span>
        {label}
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={`h-5 w-10 rounded-full p-0.5 transition-colors ${value ? 'bg-cyan-400' : 'bg-slate-600'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function Stars({ n, size = 16 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" style={{ fontSize: size }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={i < n ? 'text-amber-300 drop-shadow-[0_0_6px_rgba(255,210,79,0.8)]' : 'text-slate-600'}>
          ★
        </span>
      ))}
    </span>
  );
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className={`max-h-[94vh] w-full overflow-y-auto rounded-xl ${wide ? 'max-w-4xl' : 'max-w-lg'}`}>{children}</div>
    </div>
  );
}

export function Stardust({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-amber-200">
      <span className="text-amber-300">✦</span>
      {n}
    </span>
  );
}
