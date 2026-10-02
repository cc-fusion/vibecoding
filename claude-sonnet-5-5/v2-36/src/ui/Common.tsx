import type { ReactNode } from 'react';
import { cn } from '../utils/cn';
import { audio } from '../game/audio';

export const fmt = (n: number) => Math.round(n).toLocaleString();

export function click() { audio.init(); audio.play('click'); }

export function Bar({ value, max = 100, color = '#f2c14e', label, h = 8, className }: { value: number; max?: number; color?: string; label?: ReactNode; h?: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className={cn('relative w-full rounded-full overflow-hidden bg-black/45 border border-white/10', className)} style={{ height: h }}>
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}aa, ${color})`, boxShadow: `0 0 8px ${color}88` }} />
      {label && <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90" style={{ textShadow: '0 1px 2px #000' }}>{label}</div>}
    </div>
  );
}

export function Overlay({ children, className, z = 40 }: { children: ReactNode; className?: string; z?: number }) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center p-3 anim-fadeIn', className)} style={{ zIndex: z, background: 'rgba(5,3,16,0.72)', backdropFilter: 'blur(3px)' }}>
      {children}
    </div>
  );
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-amber-200/80">{Math.round(value * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={e => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function Toggle({ label, on, onChange, hint }: { label: string; on: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button type="button" onClick={() => { click(); onChange(!on); }} className="w-full flex items-center justify-between gap-3 text-left card px-3 py-2 hover:bg-white/10 transition">
      <span><span className="block text-sm">{label}</span>{hint && <span className="block text-xs text-white/50">{hint}</span>}</span>
      <span className={cn('w-10 h-5 rounded-full relative transition shrink-0', on ? 'bg-amber-400' : 'bg-white/20')}>
        <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all', on ? 'left-5' : 'left-0.5')} />
      </span>
    </button>
  );
}

export function Pips({ n, max, color = '#f2c14e' }: { n: number; max: number; color?: string }) {
  return (
    <span className="inline-flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ background: i < n ? color : 'transparent', boxShadow: i < n ? `0 0 6px ${color}` : 'none' }} />
      ))}
    </span>
  );
}

export function Stat({ k, v, icon }: { k: string; v: ReactNode; icon?: string }) {
  return (
    <div className="card px-3 py-2 flex items-center justify-between gap-2">
      <span className="text-xs text-white/60">{icon} {k}</span>
      <span className="font-display text-amber-200 text-sm">{v}</span>
    </div>
  );
}
