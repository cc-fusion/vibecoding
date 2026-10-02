import type { ReactNode } from 'react';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

type Variant = 'default' | 'primary' | 'danger' | 'good' | 'ghost';
const VARIANTS: Record<Variant, string> = {
  default: 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-100',
  primary: 'bg-amber-500 hover:bg-amber-400 border-amber-300 text-slate-950 shadow-lg shadow-amber-500/20',
  danger: 'bg-rose-700 hover:bg-rose-600 border-rose-400 text-white',
  good: 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-white',
  ghost: 'bg-transparent hover:bg-slate-800/70 border-slate-700 text-slate-200',
};

export function Btn({
  children, onClick, disabled, variant = 'default', className, title, small,
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: Variant; className?: string; title?: string; small?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'rounded-lg border font-semibold transition active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300',
        small ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm',
        VARIANTS[variant],
        disabled && 'opacity-40 cursor-not-allowed hover:bg-slate-800 active:scale-100',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-700/70 bg-slate-900/70 p-2.5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-serif text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300/90">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Bar({ value, max, color = 'bg-emerald-500', h = 'h-2' }: { value: number; max: number; color?: string; h?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-slate-800', h)}>
      <div className={cx('h-full rounded-full transition-all duration-200', color)} style={{ width: p + '%' }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-slate-500 bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-200">{children}</kbd>;
}

export function Modal({ children, onClose, wide, z = 50 }: { children: ReactNode; onClose?: () => void; wide?: boolean; z?: number }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm"
      style={{ zIndex: z }}
      onPointerDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}
    >
      <div
        className={cx(
          'anim-pop max-h-[92dvh] w-full overflow-y-auto rounded-2xl border border-amber-500/30 bg-slate-900/95 p-4 shadow-2xl shadow-black sm:p-6',
          wide ? 'max-w-4xl' : 'max-w-xl',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Chip({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' }) {
  const tones = {
    slate: 'bg-slate-800 text-slate-300 border-slate-600',
    green: 'bg-emerald-900/60 text-emerald-300 border-emerald-600/60',
    red: 'bg-rose-900/60 text-rose-300 border-rose-600/60',
    amber: 'bg-amber-900/50 text-amber-300 border-amber-600/60',
    blue: 'bg-sky-900/50 text-sky-300 border-sky-600/60',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold', tones[tone])}>{children}</span>;
}
