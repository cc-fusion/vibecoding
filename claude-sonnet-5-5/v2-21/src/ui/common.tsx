import type { CSSProperties, ReactNode } from 'react';
import { audio } from '../game/audio';

export function Btn({ children, color = '#28e0ff', solid, onClick, disabled, className = '', title, silent }: {
  children: ReactNode; color?: string; solid?: boolean; onClick?: () => void; disabled?: boolean; className?: string; title?: string; silent?: boolean;
}) {
  return (
    <button
      className={`btn ${solid ? 'solid' : ''} ${className}`}
      style={{ ['--c' as string]: color } as CSSProperties}
      disabled={disabled} title={title}
      onClick={() => { if (!silent) audio.sfx('confirm'); onClick?.(); }}
      onMouseEnter={() => { if (!disabled) audio.sfx('ui'); }}
    >{children}</button>
  );
}

export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <div className={`panel ${className}`} style={style}>{children}</div>;
}

export function Bar({ v, color = '#28e0ff', h = 8, bg = 'rgba(255,255,255,0.1)' }: { v: number; color?: string; h?: number; bg?: string }) {
  return (
    <div style={{ height: h, background: bg, borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%`, height: '100%', background: color, transition: 'width .35s ease' }} />
    </div>
  );
}

export function Stars({ n, max = 5, color = '#ffb02e' }: { n: number; max?: number; color?: string }) {
  return (
    <span className="tracking-tight" aria-label={`${n} of ${max}`}>
      {Array.from({ length: max }, (_, i) => <span key={i} style={{ color: i < n ? color : 'rgba(255,255,255,0.18)' }}>★</span>)}
    </span>
  );
}

export function Title({ children, color = '#28e0ff', size = 'text-2xl' }: { children: ReactNode; color?: string; size?: string }) {
  return <h2 className={`font-display font-black ${size} neon-text`} style={{ color }}>{children}</h2>;
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <Panel className={`anim-pop w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] overflow-y-auto scroll-thin p-5 sm:p-6`}>{children}</Panel>
    </div>
  );
}
