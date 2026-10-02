import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { audio } from '../game/audio';
import { HEAT_TIERS, heatTier } from '../game/data';

export function Btn({ children, onClick, variant = '', disabled, className = '', title, sm, on, silent }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'danger' | 'ghost' | ''; disabled?: boolean; className?: string; title?: string; sm?: boolean; on?: boolean; silent?: boolean;
}) {
  const cls = ['btn', variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : variant === 'ghost' ? 'btn-ghost' : '', sm ? 'btn-sm' : '', on ? 'btn-on' : '', className].join(' ');
  return (
    <button className={cls} disabled={disabled} title={title} onClick={() => { if (!silent) audio.sfx('click'); onClick?.(); }}>{children}</button>
  );
}

export function Panel({ title, children, className = '', right }: { title?: string; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <div className={`panel p-3 ${className}`}>
      {(title || right) && <div className="flex items-center justify-between mb-2"><div className="panel-h">{title}</div>{right}</div>}
      {children}
    </div>
  );
}

export function Modal({ children, onClose, title, wide }: { children: ReactNode; onClose?: () => void; title?: string; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div data-modal="1" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" style={{ background: 'rgba(2,6,14,0.78)', backdropFilter: 'blur(3px)' }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`panel rise w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="noir text-xl text-white">{title}</div>
          {onClose && <button className="btn btn-sm btn-ghost" onClick={() => { audio.sfx('click'); onClose(); }}>✕ Close</button>}
        </div>
        <div className="p-4 overflow-auto scroll">{children}</div>
      </div>
    </div>
  );
}

export function Pips({ n, max, color = '#ff4d5e' }: { n: number; max: number; color?: string }) {
  return <span className="inline-flex gap-[2px]">{Array.from({ length: max }, (_, i) => <span key={i} style={{ width: 8, height: 8, borderRadius: 2, background: i < n ? color : 'rgba(255,255,255,0.12)' }} />)}</span>;
}

export function Stars({ n, max = 3 }: { n: number; max?: number }) {
  return <span className="tracking-widest">{Array.from({ length: max }, (_, i) => <span key={i} style={{ color: i < n ? '#ffd35c' : '#34507a' }}>★</span>)}</span>;
}

export function HeatMeter({ heat, compact }: { heat: number; compact?: boolean }) {
  const tier = HEAT_TIERS[heatTier(heat)];
  return (
    <div className="w-full">
      <div className="flex justify-between text-[11px] uppercase tracking-widest mb-1"><span style={{ color: tier.color }}>🔥 Heat: {tier.name}</span><span>{Math.round(heat)}/100</span></div>
      <div className="h-2.5 rounded bg-black/40 overflow-hidden border" style={{ borderColor: 'var(--line)' }}>
        <div className="h-full transition-all duration-500" style={{ width: `${Math.min(100, heat)}%`, background: `linear-gradient(90deg,#6ee7ff,${tier.color})`, boxShadow: `0 0 10px ${tier.color}` }} />
      </div>
      {!compact && <div className="text-[11px] opacity-70 mt-1">{tier.desc}</div>}
    </div>
  );
}

export function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm py-[2px]"><span className="opacity-70 text-xs uppercase tracking-wider">{label}</span><span style={{ color }} className="font-semibold">{value}</span></div>
  );
}
