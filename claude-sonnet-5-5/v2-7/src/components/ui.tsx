import type { ReactNode } from "react";
import { audio } from "../game/audio";

export const toneColor = (t: string) => t === "good" ? "text-emerald-300" : t === "bad" ? "text-rose-300" : t === "warn" ? "text-amber-300" : t === "ai" ? "text-fuchsia-300" : "text-slate-300";

export function Modal({ children, wide, z = 60 }: { children: ReactNode; wide?: boolean; z?: number }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-3 fade-in" style={{ zIndex: z, background: "rgba(5,4,14,.72)", backdropFilter: "blur(3px)" }}>
      <div className={`panel pop-in w-full ${wide ? "max-w-4xl" : "max-w-xl"} max-h-[94vh] overflow-y-auto p-5 sm:p-7`}>{children}</div>
    </div>
  );
}

export function Btn({ children, onClick, kind = "", disabled, className = "", title, id, hover = true }: { children: ReactNode; onClick?: (e: React.MouseEvent) => void; kind?: "gold" | "red" | "green" | ""; disabled?: boolean; className?: string; title?: string; id?: string; hover?: boolean }) {
  return (
    <button id={id} title={title} disabled={disabled} className={`btn ${kind === "gold" ? "btn-gold" : kind === "red" ? "btn-red" : kind === "green" ? "btn-green" : ""} ${className}`}
      onMouseEnter={() => { if (hover && !disabled) audio.hover(); }}
      onClick={e => { audio.resume(); onClick?.(e); }}>{children}</button>
  );
}

export function Bar({ v, max = 100, color, h = 8, danger }: { v: number; max?: number; color: string; h?: number; danger?: boolean }) {
  const p = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ height: h, background: "rgba(255,255,255,.1)" }}>
      <div className={danger ? "danger-blink" : ""} style={{ width: `${p}%`, height: "100%", background: color, transition: "width .5s cubic-bezier(.2,.9,.3,1)" }} />
    </div>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="text-center mb-4">
      <h2 className="font-display text-2xl sm:text-3xl font-black text-[color:var(--color-gold)] tracking-wide drop-shadow">{children}</h2>
      {sub && <p className="text-slate-300 mt-1 italic">{sub}</p>}
    </div>
  );
}

export function VolumeRow({ label, v, onChange }: { label: string; v: number; onChange: (n: number) => void }) {
  return (
    <label className="flex items-center gap-3 my-2">
      <span className="font-display text-sm w-24">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={v} onChange={e => onChange(parseFloat(e.target.value))} className="flex-1" />
      <span className="w-10 text-right text-sm text-slate-300">{Math.round(v * 100)}</span>
    </label>
  );
}
