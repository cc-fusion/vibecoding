import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint?: string;
  format?: (v: number) => string;
}) {
  return (
    <label className="block" title={hint}>
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-stone-300">{label}</span>
        <span className="font-mono text-amber-200/90">{format ? format(value) : formatNum(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="slider mt-0.5 w-full"
      />
    </label>
  );
}

export function formatNum(v: number) {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/\.?0+$/, '');
}

export function Btn({
  children,
  onClick,
  active,
  variant = 'default',
  className,
  title,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
  className?: string;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors select-none',
        'disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'default' &&
          'border-stone-700 bg-stone-800/70 text-stone-200 hover:bg-stone-700/80 hover:border-stone-600',
        variant === 'primary' && 'border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30',
        variant === 'danger' && 'border-rose-700/60 bg-rose-900/30 text-rose-200 hover:bg-rose-800/40',
        variant === 'ghost' && 'border-transparent bg-transparent text-stone-300 hover:bg-stone-800',
        active && 'border-amber-400/80 bg-amber-400/20 text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.4)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-800 bg-stone-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-wider text-stone-400 uppercase">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-stone-300">
      <span>{label}</span>
      <span
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-block h-4 w-7 rounded-full transition-colors',
          checked ? 'bg-amber-500' : 'bg-stone-700',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </label>
  );
}

export function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded border border-stone-800 bg-stone-950/50 px-2 py-1">
      <div className="text-[10px] tracking-wide text-stone-500 uppercase">{label}</div>
      <div className="font-mono text-sm" style={{ color: color ?? '#e7e5e4' }}>
        {value}
      </div>
    </div>
  );
}
