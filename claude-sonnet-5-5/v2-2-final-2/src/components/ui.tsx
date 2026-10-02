import { useEffect, useRef } from 'react';
import type { ReactNode, PointerEvent as RPE } from 'react';
import { audio } from '../game/audio';
import { layoutView, toTile } from '../game/render';
import type { View } from '../game/render';
import type { P } from '../game/types';

export const money = (n: number) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

type Variant = 'primary' | 'ghost' | 'danger' | 'gold' | 'dark';
const VAR: Record<Variant, string> = {
  primary: 'bg-cyan-500/90 hover:bg-cyan-400 text-slate-950 border-cyan-300',
  ghost: 'bg-slate-800/70 hover:bg-slate-700 text-slate-100 border-slate-600',
  danger: 'bg-red-600/90 hover:bg-red-500 text-white border-red-400',
  gold: 'bg-amber-400 hover:bg-amber-300 text-slate-950 border-amber-200',
  dark: 'bg-slate-950/80 hover:bg-slate-800 text-slate-200 border-slate-700',
};

export function Btn({ children, onClick, variant = 'ghost', disabled, className = '', title, active }: { children: ReactNode; onClick?: () => void; variant?: Variant; disabled?: boolean; className?: string; title?: string; active?: boolean }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onMouseEnter={() => { if (!disabled) audio.play('hover'); }}
      onClick={() => { if (disabled) return; audio.init(); audio.play('click'); onClick?.(); }}
      className={`px-3 py-1.5 rounded-md border text-sm font-semibold tracking-wide transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${VAR[variant]} ${active ? 'ring-2 ring-white/80' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

export function Panel({ title, children, className = '', right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <div className={`rounded-lg border border-cyan-900/60 bg-slate-900/80 backdrop-blur p-3 ${className}`}>
      {title && (
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-[0.2em] text-cyan-300 font-bold">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Meter({ value, max = 100, color = '#22d3ee', h = 8, className = '' }: { value: number; max?: number; color?: string; h?: number; className?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <div className={`w-full rounded-full bg-slate-800 overflow-hidden ${className}`} style={{ height: h }}>
      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${p * 100}%`, background: color }} />
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className={`w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[92vh] overflow-y-auto rounded-xl border border-cyan-700/60 bg-slate-950 shadow-2xl shadow-cyan-900/40 p-5`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black tracking-widest text-cyan-300 uppercase">{title}</h2>
          {onClose && <button className="text-slate-400 hover:text-white text-xl leading-none px-2" onClick={() => { audio.play('back'); onClose(); }}>✕</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Toasts({ items }: { items: { id: number; msg: string; kind: string }[] }) {
  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 items-center pointer-events-none">
      {items.map(t => (
        <div key={t.id} className={`px-4 py-2 rounded-md text-sm font-semibold shadow-lg border animate-[toast_0.25s_ease-out] ${t.kind === 'bad' ? 'bg-red-950/95 border-red-500 text-red-200' : t.kind === 'good' ? 'bg-emerald-950/95 border-emerald-500 text-emerald-200' : 'bg-slate-900/95 border-cyan-600 text-cyan-100'}`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

interface CanvasProps { w: number; h: number; onFrame: (dt: number, ctx: CanvasRenderingContext2D, v: View) => void; onPointer?: (kind: 'move' | 'down' | 'leave', tile: P, e: RPE) => void }
export function GameCanvas({ w, h, onFrame, onPointer }: CanvasProps) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ cw: 100, ch: 100, ts: 10, ox: 0, oy: 0 });
  const cb = useRef({ onFrame, onPointer });
  cb.current = { onFrame, onPointer };
  useEffect(() => {
    const c = cvs.current, b = box.current;
    if (!c || !b) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0, last = performance.now(), dpr = 1;
    const resize = () => {
      const r = b.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      c.width = Math.max(10, Math.floor(r.width * dpr)); c.height = Math.max(10, Math.floor(r.height * dpr));
      c.style.width = r.width + 'px'; c.style.height = r.height + 'px';
      view.current = layoutView(r.width, r.height, w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(b);
    window.addEventListener('resize', resize);
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cb.current.onFrame(dt, ctx, view.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener('resize', resize); };
  }, [w, h]);
  const handler = (kind: 'move' | 'down' | 'leave') => (e: RPE) => {
    const c = cvs.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    cb.current.onPointer?.(kind, toTile(view.current, e.clientX - r.left, e.clientY - r.top), e);
  };
  return (
    <div ref={box} className="relative w-full h-full min-h-[280px]">
      <canvas ref={cvs} className="absolute inset-0 touch-none cursor-crosshair" onPointerMove={handler('move')} onPointerDown={handler('down')} onPointerLeave={handler('leave')} />
    </div>
  );
}
