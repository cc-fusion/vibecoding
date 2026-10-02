import type { ReactNode } from 'react';
import { audio } from '../game/audio';

export function Btn({
  children,
  onClick,
  variant = 'default',
  disabled,
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'danger' | 'ghost' | 'gold';
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base = 'rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-95 select-none disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ';
  const v = {
    default: 'bg-slate-700/80 hover:bg-slate-600 text-slate-100 border border-slate-500/40',
    primary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.35)]',
    gold: 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.35)]',
    danger: 'bg-rose-600/90 hover:bg-rose-500 text-white',
    ghost: 'bg-transparent hover:bg-white/10 text-slate-200 border border-white/10',
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      className={base + v + ' ' + className}
      onClick={() => {
        audio.ensure();
        audio.sfx('ui');
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function Modal({ children, title, onClose, wide }: { children: ReactNode; title: string; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 overflow-auto">
      <div className={`relative w-full ${wide ? 'max-w-5xl' : 'max-w-lg'} max-h-full overflow-auto rounded-2xl border border-cyan-400/20 bg-slate-900/95 p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-wide text-cyan-200">{title}</h2>
          {onClose && (
            <button
              className="rounded-md px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => {
                audio.sfx('ui');
                onClose();
              }}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, fmt }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; fmt?: (v: number) => string }) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums text-cyan-200">{fmt ? fmt(value) : Math.round(value * 100) + '%'}</span>
      </div>
      <input type="range" className="w-full accent-cyan-400" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-slate-800/60 px-3 py-2 text-left hover:bg-slate-700/60"
      onClick={() => {
        audio.sfx('ui');
        onChange(!value);
      }}
    >
      <span>
        <span className="block text-sm text-slate-100">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      <span className={`h-5 w-9 rounded-full p-0.5 transition ${value ? 'bg-cyan-500' : 'bg-slate-600'}`}>
        <span className={`block h-4 w-4 rounded-full bg-white transition ${value ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}
