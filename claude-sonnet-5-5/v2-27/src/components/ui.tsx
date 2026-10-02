import { useEffect, useRef, ReactNode } from "react";
import { ModId, MODS } from "../game/data";
import { drawModule } from "../game/render";
import { audio } from "../game/audio";

export function Btn({ children, onClick, variant = "default", disabled, className = "", title, small }: {
  children: ReactNode; onClick?: () => void; variant?: "default" | "primary" | "danger" | "ghost" | "gold"; disabled?: boolean; className?: string; title?: string; small?: boolean;
}) {
  const base = "font-display tracking-widest uppercase transition-all duration-150 border rounded-sm select-none active:scale-95 disabled:opacity-35 disabled:cursor-not-allowed ";
  const sz = small ? "text-[10px] px-2.5 py-1.5 " : "text-xs px-5 py-2.5 ";
  const v = {
    default: "border-slate-600 bg-slate-800/70 hover:bg-slate-700 hover:border-cyan-400 text-slate-100",
    primary: "border-cyan-400 bg-cyan-500/20 hover:bg-cyan-400/40 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.35)]",
    danger: "border-rose-500 bg-rose-600/20 hover:bg-rose-500/40 text-rose-100",
    ghost: "border-transparent hover:border-slate-600 hover:bg-slate-800/60 text-slate-300",
    gold: "border-amber-400 bg-amber-500/20 hover:bg-amber-400/40 text-amber-100 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={() => { audio.init(); audio.sfx("ui"); onClick?.(); }}
      className={base + sz + v + " " + className}
    >
      {children}
    </button>
  );
}

/** Framed HUD-style container with optional title bar. */
export function Panel({ children, className = "", title, right }: { children: ReactNode; className?: string; title?: string; right?: ReactNode }) {
  return (
    <div className={"border border-slate-700/80 bg-slate-900/80 backdrop-blur-sm rounded-sm " + className}>
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-slate-700/80 bg-slate-800/50">
          <span className="font-display text-[10px] tracking-[0.25em] uppercase text-cyan-300">{title}</span>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 text-slate-300">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1" />
      <span className="w-10 text-right text-cyan-200 tabular-nums">{Math.round((value / max) * 100)}%</span>
    </label>
  );
}

export function Toggle({ on, onChange, label, desc, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; desc?: string; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={() => { audio.sfx("ui"); onChange(!on); }}
      className={"w-full text-left flex items-center gap-3 p-2 border rounded-sm transition-colors disabled:opacity-40 " + (on ? "border-amber-400/70 bg-amber-500/10" : "border-slate-700 hover:border-slate-500")}
    >
      <span className={"w-9 h-5 rounded-full relative shrink-0 transition-colors " + (on ? "bg-amber-400" : "bg-slate-600")}>
        <span className={"absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all " + (on ? "left-[18px]" : "left-0.5")} />
      </span>
      <span>
        <span className="block text-sm font-bold text-slate-100">{label}</span>
        {desc && <span className="block text-xs text-slate-400">{desc}</span>}
      </span>
    </button>
  );
}

export function Bar({ label, value, pct, color = "#22d3ee", warn }: { label: string; value: string; pct: number; color?: string; warn?: boolean }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] leading-none mb-0.5">
        <span className="text-slate-400 uppercase tracking-wider">{label}</span>
        <span className={warn ? "text-rose-400 font-bold" : "text-slate-200"}>{value}</span>
      </div>
      <div className="h-1.5 bg-slate-800 rounded-sm overflow-hidden">
        <div className="h-full transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%`, background: warn ? "#f43f5e" : color }} />
      </div>
    </div>
  );
}

export function ModIcon({ id, size = 28 }: { id: ModId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    drawModule(ctx, id, size / 2, size / 2, size - 1, { t: 0.5 });
  }, [id, size]);
  return <canvas ref={ref} style={{ width: size, height: size }} aria-label={MODS[id].name} />;
}

export function Overlay({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={"fade-up max-h-[94vh] overflow-y-auto scroll-thin w-full " + (wide ? "max-w-4xl" : "max-w-xl")}>{children}</div>
    </div>
  );
}
