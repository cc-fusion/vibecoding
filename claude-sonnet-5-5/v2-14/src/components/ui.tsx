import type { ReactNode } from 'react';
import { audio } from '../game/audio';

export function cx(...a: (string | false | null | undefined)[]): string {
  return a.filter(Boolean).join(' ');
}

export function Btn(props: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'good';
  disabled?: boolean;
  className?: string;
  title?: string;
  small?: boolean;
}) {
  const v = props.variant ?? 'ghost';
  const base = 'rounded-lg font-semibold transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300';
  const sizes = props.small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
  const colors =
    v === 'primary' ? 'bg-gradient-to-b from-cyan-400 to-teal-500 text-slate-900 hover:from-cyan-300 hover:to-teal-400 shadow-lg shadow-cyan-900/30'
    : v === 'danger' ? 'bg-rose-600/80 text-white hover:bg-rose-500'
    : v === 'good' ? 'bg-emerald-500/90 text-slate-900 hover:bg-emerald-400'
    : 'bg-white/8 text-slate-100 hover:bg-white/15 border border-white/10';
  return (
    <button
      type="button"
      title={props.title}
      disabled={props.disabled}
      className={cx(base, sizes, colors, props.className)}
      onClick={() => {
        audio.init();
        audio.sfx('click');
        props.onClick?.();
      }}
    >
      {props.children}
    </button>
  );
}

export function Modal(props: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm">
      <div className={cx('max-h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 shadow-2xl flex flex-col', props.wide ? 'max-w-4xl' : 'max-w-lg')}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <h2 className="text-lg font-bold tracking-wide text-cyan-100">{props.title}</h2>
          {props.onClose && (
            <button type="button" aria-label="Close" onClick={() => { audio.sfx('click'); props.onClose?.(); }} className="rounded-md px-2 py-1 text-slate-300 hover:bg-white/10">✕</button>
          )}
        </div>
        <div className="overflow-y-auto p-5">{props.children}</div>
      </div>
    </div>
  );
}

export function Slider(props: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  const min = props.min ?? 0, max = props.max ?? 1;
  return (
    <label className="block text-sm">
      <div className="mb-1 flex justify-between text-slate-300">
        <span>{props.label}</span>
        <span className="tabular-nums text-slate-400">{props.suffix ?? Math.round(((props.value - min) / (max - min)) * 100) + '%'}</span>
      </div>
      <input
        type="range" min={min} max={max} step={props.step ?? 0.01} value={props.value}
        onChange={(e) => props.onChange(parseFloat(e.target.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}

export function Bar(props: { v: number; color?: string; className?: string; marks?: number[] }) {
  const v = Math.max(0, Math.min(1, props.v));
  return (
    <div className={cx('relative h-2 overflow-hidden rounded-full bg-white/10', props.className)}>
      <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${v * 100}%`, background: props.color ?? '#5ee0ff' }} />
      {props.marks?.map((m) => (
        <div key={m} className="absolute top-0 h-full w-px bg-white/60" style={{ left: `${m * 100}%` }} />
      ))}
    </div>
  );
}

export function Toggle(props: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => { audio.sfx('click'); props.onChange(!props.value); }}
      className="flex w-full items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
    >
      <span>{props.label}</span>
      <span className={cx('h-5 w-9 rounded-full p-0.5 transition', props.value ? 'bg-cyan-400' : 'bg-slate-600')}>
        <span className={cx('block h-4 w-4 rounded-full bg-white transition', props.value && 'translate-x-4')} />
      </span>
    </button>
  );
}

export function fmt(n: number, d = 0): string {
  if (!isFinite(n)) return '–';
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-cyan-100">{children}</kbd>;
}
