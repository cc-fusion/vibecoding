import type { ReactNode } from 'react';

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
export const short = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}k` : Math.round(a).toLocaleString();
  return `${n < 0 ? '-' : ''}$${s}`;
};

export function Bar({ v, max = 100, color = '#e0b050', title }: { v: number; max?: number; color?: string; title?: string }) {
  const p = Math.max(0, Math.min(100, (v / (max || 1)) * 100));
  return <div className="bar" title={title}><div style={{ width: `${p}%`, background: color }} /></div>;
}

export function Spark({ data, color = '#e0b050', w = 80, h = 24 }: { data: number[]; color?: string; w?: number; h?: number }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const mn = Math.min(...data), mx = Math.max(...data);
  const r = mx - mn || 1;
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * w},${h - 2 - ((d - mn) / r) * (h - 4)}`).join(' ');
  return <svg width={w} height={h}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></svg>;
}

export function LineChart({ series, h = 110 }: { series: { data: number[]; color: string; name: string }[]; h?: number }) {
  const w = 340;
  const all = series.flatMap((s) => s.data);
  if (all.length < 2) return <div className="text-xs opacity-60 p-2">Not enough history yet...</div>;
  const mn = Math.min(0, ...all), mx = Math.max(...all);
  const r = mx - mn || 1;
  const n = Math.max(...series.map((s) => s.data.length));
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
      <rect x="0" y="0" width={w} height={h} fill="rgba(0,0,0,0.25)" rx="4" />
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={w} y1={h * f} y2={h * f} stroke="rgba(255,255,255,0.07)" />)}
      {series.map((s) => (
        <polyline key={s.name} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round"
          points={s.data.map((d, i) => `${(i / Math.max(1, n - 1)) * (w - 4) + 2},${h - 4 - ((d - mn) / r) * (h - 8)}`).join(' ')} />
      ))}
    </svg>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="font-western text-[13px] text-[#e0b050] tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="px-1.5 py-0.5 rounded bg-black/50 border border-[#7a5a30] text-[11px] text-[#ffe08a] font-mono">{children}</kbd>;
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/65 backdrop-blur-[2px]" onClick={onClose}>
      <div className={`panel anim-pop rounded-lg p-5 max-h-[92vh] overflow-y-auto scroll ${wide ? 'w-[860px]' : 'w-[520px]'} max-w-full`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
