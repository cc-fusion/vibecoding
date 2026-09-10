import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="border-b border-zinc-800/80 pb-3 mb-3 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
        {right}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">{children}</div>
    </section>
  );
}

export function Row({ children, full }: { children: ReactNode; full?: boolean }) {
  return <div className={cn('flex items-center gap-2', full && 'col-span-2')}>{children}</div>;
}

interface NumProps {
  label: string; value: number | null; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; digits?: number; full?: boolean; unit?: string; title?: string; disabled?: boolean;
}

/** Numeric input that commits only finite, clamped values. `value === null` renders as "mixed". */
export function NumField({ label, value, onChange, step = 1, min = -Infinity, max = Infinity, digits = 2, full, unit, title, disabled }: NumProps) {
  const fmt = (v: number | null) => (v === null ? '' : String(Math.round(v * 10 ** digits) / 10 ** digits));
  const [text, setText] = useState(fmt(value));
  const [focus, setFocus] = useState(false);
  useEffect(() => { if (!focus) setText(fmt(value)); }, [value, focus]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (raw: string) => {
    const v = parseFloat(raw);
    if (!Number.isFinite(v)) return;
    onChange(Math.min(max, Math.max(min, v)));
  };
  return (
    <label className={cn('flex flex-col gap-0.5 min-w-0', full && 'col-span-2')} title={title}>
      <span className="text-[10.5px] text-zinc-500 truncate">{label}{unit ? <span className="text-zinc-600"> ({unit})</span> : null}</span>
      <input
        type="number" inputMode="decimal" step={step} value={text} placeholder={value === null ? 'mixed' : ''} disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => { setFocus(false); commit(text); }}
        onChange={e => { setText(e.target.value); commit(e.target.value); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="num-input"
      />
    </label>
  );
}

export function SliderField({ label, value, onChange, min, max, step = 0.01, digits = 2, full = true, title }: { label: string; value: number | null; onChange: (v: number) => void; min: number; max: number; step?: number; digits?: number; full?: boolean; title?: string }) {
  return (
    <div className={cn('flex flex-col gap-0.5', full && 'col-span-2')} title={title}>
      <div className="flex justify-between text-[10.5px] text-zinc-500"><span>{label}</span><span className="tabular-nums text-zinc-300">{value === null ? 'mixed' : value.toFixed(digits)}</span></div>
      <input type="range" min={min} max={max} step={step} value={value ?? min} onChange={e => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }} className="w-full accent-amber-400 h-4" />
    </div>
  );
}

export function Toggle({ label, value, onChange, full, title }: { label: string; value: boolean | null; onChange: (v: boolean) => void; full?: boolean; title?: string }) {
  return (
    <label className={cn('flex items-center gap-2 text-[11.5px] text-zinc-300 cursor-pointer select-none min-h-6', full && 'col-span-2')} title={title}>
      <input type="checkbox" checked={!!value} ref={el => { if (el) el.indeterminate = value === null; }} onChange={e => onChange(e.target.checked)} className="accent-amber-400 w-3.5 h-3.5" />
      <span className="truncate">{label}</span>
    </label>
  );
}

export function SelectField<T extends string>({ label, value, options, onChange, full }: { label: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void; full?: boolean }) {
  return (
    <label className={cn('flex flex-col gap-0.5 min-w-0', full && 'col-span-2')}>
      <span className="text-[10.5px] text-zinc-500 truncate">{label}</span>
      <select value={value ?? '__mixed'} onChange={e => { if (e.target.value !== '__mixed') onChange(e.target.value as T); }} className="num-input">
        {value === null && <option value="__mixed">mixed</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

export function Btn({ children, onClick, active, danger, title, className, disabled, small }: { children: ReactNode; onClick?: () => void; active?: boolean; danger?: boolean; title?: string; className?: string; disabled?: boolean; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={title} disabled={disabled} aria-pressed={active}
      className={cn('btn', small && 'btn-sm', active && 'btn-active', danger && 'btn-danger', className)}>
      {children}
    </button>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10.5px] text-zinc-500">{label}</span>
      <input type="color" value={value ?? '#888888'} onChange={e => onChange(e.target.value)} className="h-7 w-full bg-zinc-900 border border-zinc-700 rounded cursor-pointer p-0.5" />
    </label>
  );
}
