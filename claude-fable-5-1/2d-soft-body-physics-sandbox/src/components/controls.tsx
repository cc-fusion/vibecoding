import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';

/* ---------------------------------------------------------------- */
/* Slider with numeric readout                                        */
/* ---------------------------------------------------------------- */

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  tip?: string;
  disabled?: boolean;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  /** fired on release (for expensive updates such as re-meshing) */
  onCommit?: (v: number) => void;
}

export function Slider({ label, value, min, max, step = 0.01, unit, tip, disabled, format, onChange, onCommit }: SliderProps) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const shown = format ? format(local) : step >= 1 ? String(Math.round(local)) : local.toFixed(2);
  const pct = ((local - min) / (max - min)) * 100;
  return (
    <label className={cn('block select-none', disabled && 'opacity-40 pointer-events-none')} title={tip}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">{label}</span>
        <span className="font-mono text-[11px] text-slate-200 tabular-nums">
          {shown}
          {unit && <span className="text-slate-500 ml-0.5">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        className="lab-range w-full"
        style={{ ['--pct' as string]: `${pct}%` }}
        min={min}
        max={max}
        step={step}
        value={local}
        disabled={disabled}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setLocal(v);
          if (!onCommit) onChange(v);
          else onChange(v);
        }}
        onPointerUp={() => onCommit?.(local)}
        onKeyUp={() => onCommit?.(local)}
      />
    </label>
  );
}

/* ---------------------------------------------------------------- */
/* Segmented control                                                  */
/* ---------------------------------------------------------------- */

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: ReactNode; tip?: string }[];
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', className }: SegmentedProps<T>) {
  return (
    <div className={cn('inline-flex rounded-md bg-slate-900/80 border border-slate-700/70 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.tip}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-[5px] font-medium transition-colors whitespace-nowrap',
            size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
            value === o.value ? 'bg-sky-500/20 text-sky-200 shadow-inner' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Toggle switch                                                      */
/* ---------------------------------------------------------------- */

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tip?: string;
}

export function Toggle({ label, checked, onChange, tip }: ToggleProps) {
  return (
    <button
      type="button"
      title={tip}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between py-1 group"
    >
      <span className="text-xs text-slate-300 group-hover:text-slate-100">{label}</span>
      <span
        className={cn(
          'relative inline-block h-4 w-7 rounded-full transition-colors border',
          checked ? 'bg-sky-500/70 border-sky-400/70' : 'bg-slate-800 border-slate-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

/* ---------------------------------------------------------------- */
/* Number field                                                       */
/* ---------------------------------------------------------------- */

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  unit?: string;
  disabled?: boolean;
  tip?: string;
}

export function NumberField({ label, value, onChange, step = 1, unit, disabled, tip }: NumberFieldProps) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(String(Math.round(value * 100) / 100));
  }, [value, focused]);
  return (
    <label className={cn('block', disabled && 'opacity-40 pointer-events-none')} title={tip}>
      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</span>
      <div className="flex items-center rounded border border-slate-700 bg-slate-900/70 focus-within:border-sky-500/60">
        <input
          type="number"
          className="w-full bg-transparent px-2 py-1 font-mono text-xs text-slate-100 outline-none"
          value={text}
          step={step}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            const v = parseFloat(text);
            if (!Number.isNaN(v)) onChange(v);
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
        {unit && <span className="pr-2 text-[10px] text-slate-500">{unit}</span>}
      </div>
    </label>
  );
}

/* ---------------------------------------------------------------- */
/* Icon button (toolbar)                                              */
/* ---------------------------------------------------------------- */

interface IconButtonProps {
  icon: ReactNode;
  label?: string;
  tip: string;
  active?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
  shortcut?: string;
}

export function IconButton({ icon, label, tip, active, disabled, danger, onClick, shortcut }: IconButtonProps) {
  return (
    <button
      type="button"
      title={shortcut ? `${tip} (${shortcut})` : tip}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors border border-transparent',
        'disabled:opacity-35 disabled:cursor-not-allowed',
        active
          ? 'bg-sky-500/20 text-sky-200 border-sky-500/40'
          : danger
            ? 'text-slate-300 hover:bg-red-500/15 hover:text-red-300'
            : 'text-slate-300 hover:bg-slate-700/60 hover:text-white active:bg-slate-700',
      )}
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {label && <span className="hidden lg:inline">{label}</span>}
    </button>
  );
}

export function Divider() {
  return <span className="mx-1 h-5 w-px bg-slate-700/80" />;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-slate-800/80 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
        {right}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
      <span className="font-mono text-[11px] text-slate-300 tabular-nums">{value}</span>
    </div>
  );
}
