import type { ReactNode } from "react";
import { audio } from "../game/audio";

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");


const TONES: Record<string, string> = {
  cyan: "border-cyan-500/60 text-cyan-200 hover:bg-cyan-500/20 bg-cyan-500/5",
  amber: "border-amber-500/60 text-amber-200 hover:bg-amber-500/20 bg-amber-500/5",
  red: "border-red-500/70 text-red-100 hover:bg-red-500/30 bg-red-500/10",
  green: "border-emerald-500/60 text-emerald-200 hover:bg-emerald-500/20 bg-emerald-500/5",
  slate: "border-slate-500/50 text-slate-300 hover:bg-slate-500/20 bg-slate-500/5",
  purple: "border-fuchsia-500/60 text-fuchsia-200 hover:bg-fuchsia-500/20 bg-fuchsia-500/5",
};
const ON_TONES: Record<string, string> = {
  cyan: "bg-cyan-500/30 border-cyan-300 text-white shadow-[0_0_12px_rgba(34,211,238,0.4)]",
  amber: "bg-amber-500/30 border-amber-300 text-white shadow-[0_0_12px_rgba(251,191,36,0.4)]",
  red: "bg-red-500/40 border-red-300 text-white shadow-[0_0_12px_rgba(248,113,113,0.5)]",
  green: "bg-emerald-500/30 border-emerald-300 text-white shadow-[0_0_12px_rgba(52,211,153,0.4)]",
  slate: "bg-slate-500/30 border-slate-300 text-white",
  purple: "bg-fuchsia-500/30 border-fuchsia-300 text-white",
};

export function Btn(p: {
  children: ReactNode; onClick?: () => void; tone?: keyof typeof TONES; disabled?: boolean; className?: string; title?: string; active?: boolean; small?: boolean; silent?: boolean;
}) {
  const tone = p.tone || "cyan";
  return (
    <button
      type="button"
      title={p.title}
      disabled={p.disabled}
      onClick={(e) => {
        const el = e.currentTarget;
        audio.init();
        if (!p.silent) audio.play("ui");
        p.onClick?.();
        el.blur();
      }}
      className={cx(
        "border rounded-md font-semibold tracking-wide transition select-none active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed",
        p.small ? "px-2 py-1 text-[11px]" : "px-3 py-2 text-sm",
        p.active ? ON_TONES[tone] : TONES[tone],
        p.className,
      )}
    >
      {p.children}
    </button>
  );
}

export function Panel(p: { title: string; right?: ReactNode; children: ReactNode; className?: string; glow?: string }) {
  return (
    <section className={cx("rounded-lg border border-cyan-900/70 bg-[#0a141c]/90 backdrop-blur p-2.5 shadow-lg", p.glow, p.className)}>
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-[0.18em] text-cyan-400/90 font-bold">{p.title}</h3>
        {p.right}
      </header>
      {p.children}
    </section>
  );
}

export function Slider(p: {
  label: string; value: number; onChange: (v: number) => void; right?: string; color?: string; disabled?: boolean; actual?: number; hint?: string; step?: number;
}) {
  return (
    <div className={cx("mb-2", p.disabled && "opacity-50")} title={p.hint}>
      <div className="flex justify-between text-[11px] text-slate-300 mb-0.5">
        <span>{p.label}</span>
        <span className="font-mono text-cyan-200">{p.right ?? `${Math.round(p.value * 100)}%`}</span>
      </div>
      <input
        type="range" min={0} max={100} step={p.step ?? 1} disabled={p.disabled}
        value={Math.round(p.value * 100)}
        onChange={(e) => p.onChange(Number(e.target.value) / 100)}
        onPointerUp={(e) => e.currentTarget.blur()}
        className={cx("w-full h-2 cursor-pointer", p.color || "accent-cyan-400")}
      />
      {p.actual !== undefined && (
        <div className="h-1 bg-slate-800 rounded mt-0.5 overflow-hidden">
          <div className="h-full bg-cyan-300/80" style={{ width: `${Math.round(p.actual * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export function Bar(p: { label: string; value: number; max?: number; right?: string; color?: string; low?: boolean; marker?: number }) {
  const pct = Math.max(0, Math.min(1, p.value / (p.max ?? 1))) * 100;
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[11px] text-slate-300">
        <span>{p.label}</span>
        <span className="font-mono text-slate-100">{p.right ?? `${pct.toFixed(0)}%`}</span>
      </div>
      <div className="relative h-2 bg-slate-800 rounded overflow-hidden">
        <div className={cx("h-full transition-[width] duration-150", p.color || "bg-cyan-400")} style={{ width: `${pct}%` }} />
        {p.marker !== undefined && <div className="absolute top-0 h-full w-0.5 bg-white/80" style={{ left: `${Math.max(0, Math.min(1, p.marker / (p.max ?? 1))) * 100}%` }} />}
      </div>
    </div>
  );
}

export function Toggle(p: { on: boolean; onClick: () => void; children: ReactNode; tone?: keyof typeof TONES; title?: string; disabled?: boolean; className?: string }) {
  return (
    <Btn small active={p.on} tone={p.tone || "cyan"} onClick={p.onClick} title={p.title} disabled={p.disabled} className={p.className}>
      {p.children}
    </Btn>
  );
}

export function Modal(p: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 overflow-auto">
      <div className={cx("w-full rounded-xl border border-cyan-700/60 bg-[#08121a] shadow-2xl p-5 max-h-[94vh] overflow-auto", p.wide ? "max-w-4xl" : "max-w-lg")}>{p.children}</div>
    </div>
  );
}
