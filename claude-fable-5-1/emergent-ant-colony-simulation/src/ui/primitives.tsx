import type { ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Button({
  children, onClick, active, variant = 'default', title, className, disabled,
}: {
  children: ReactNode; onClick?: () => void; active?: boolean; variant?: 'default' | 'primary' | 'danger' | 'ghost';
  title?: string; className?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors select-none',
        'border border-stone-700/70 bg-stone-800/60 text-stone-200 hover:bg-stone-700/70 disabled:opacity-40 disabled:pointer-events-none',
        variant === 'primary' && 'border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30',
        variant === 'danger' && 'border-red-500/50 bg-red-500/10 text-red-200 hover:bg-red-500/25',
        variant === 'ghost' && 'border-transparent bg-transparent hover:bg-stone-800/70',
        active && 'border-amber-400 bg-amber-400/25 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.4)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Slider({
  label, value, min, max, step, onChange, hint, format,
}: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; hint?: string; format?: (v: number) => string;
}) {
  return (
    <label className="block" title={hint}>
      <div className="flex items-center justify-between text-[11px] text-stone-400">
        <span>{label}</span>
        <span className="font-mono text-stone-200">{format ? format(value) : formatNum(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-400 h-1.5"
      />
    </label>
  );
}

export function formatNum(v: number): string {
  if (Number.isInteger(v)) return v.toString();
  return Math.abs(v) < 10 ? v.toFixed(2).replace(/\.?0+$/, '') : v.toFixed(1);
}

export function Bar({ label, value, max = 1, color = '#fbbf24', signed = false }: { label: string; value: number; max?: number; color?: string; signed?: boolean }) {
  const frac = Math.max(-1, Math.min(1, value / max));
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-24 shrink-0 truncate text-stone-400">{label}</span>
      <div className="relative h-2 flex-1 rounded bg-stone-800 overflow-hidden">
        {signed ? (
          <>
            <div className="absolute left-1/2 top-0 h-full w-px bg-stone-600" />
            <div
              className="absolute top-0 h-full rounded"
              style={{
                left: frac >= 0 ? '50%' : `${50 + frac * 50}%`,
                width: `${Math.abs(frac) * 50}%`,
                background: color,
              }}
            />
          </>
        ) : (
          <div className="h-full rounded" style={{ width: `${Math.max(0, frac) * 100}%`, background: color }} />
        )}
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-stone-300">{value.toFixed(2)}</span>
    </div>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border border-stone-800 bg-stone-900/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, mono = true }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px]">
      <span className="text-stone-400">{label}</span>
      <span className={cn('text-stone-100', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
