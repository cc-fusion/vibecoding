import type { ReactNode } from "react";
import { TRAITS, STAT_INFO, type StatKey } from "../game/data";
import { ageGroup, type Hero } from "../game/lineage";
import { audio } from "../game/audio";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "good";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-gradient-to-b from-amber-300 to-amber-500 text-stone-900 hover:from-amber-200 hover:to-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.25)]",
  secondary: "bg-gradient-to-b from-violet-800/80 to-violet-950/90 text-violet-100 hover:from-violet-700 border border-violet-400/30",
  danger: "bg-gradient-to-b from-red-700 to-red-900 text-red-50 hover:from-red-600 border border-red-300/20",
  ghost: "bg-white/5 text-violet-100 hover:bg-white/10 border border-white/10",
  good: "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white hover:from-emerald-400 border border-emerald-200/20",
};

export function Btn({ children, onClick, variant = "secondary", disabled, className = "", title }: { children: ReactNode; onClick?: () => void; variant?: Variant; disabled?: boolean; className?: string; title?: string }) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={() => {
        if (disabled) { audio.sfx("error"); return; }
        audio.init();
        audio.sfx("ui");
        onClick?.();
      }}
      className={`rounded-lg px-4 py-2 font-bold text-sm sm:text-base transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, wide, z = 50 }: { title?: string; onClose?: () => void; children: ReactNode; wide?: boolean; z?: number }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3" style={{ zIndex: z }}>
      <div className={`panel anim-pop w-full ${wide ? "max-w-4xl" : "max-w-xl"} max-h-[94vh] flex flex-col`}>
        {(title || onClose) && (
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-title text-2xl text-amber-200">{title}</h2>
            {onClose && <Btn variant="ghost" onClick={onClose} className="!px-3 !py-1">✕</Btn>}
          </div>
        )}
        <div className="scroll-y px-5 pb-5 pt-2 flex-1">{children}</div>
      </div>
    </div>
  );
}

export function Portrait({ hero, size = 56, dead = false }: { hero: Hero; size?: number; dead?: boolean }) {
  const g = ageGroup(hero.age);
  const face = dead ? "💀" : g === "Child" ? "🧒" : g === "Youthful" ? "🧑" : g === "Prime" ? "🧔" : "🧓";
  const mythic = hero.traits.some((t) => TRAITS[t]?.kind === "mythic");
  return (
    <div
      className="relative shrink-0 rounded-full flex items-center justify-center"
      style={{ width: size, height: size, background: `radial-gradient(circle at 30% 25%, hsl(${hero.hue},70%,68%), hsl(${hero.hue},55%,28%))`, border: `2px solid ${mythic ? "#fcd34d" : "rgba(255,255,255,0.25)"}`, fontSize: size * 0.5, boxShadow: mythic ? "0 0 14px rgba(252,211,77,0.6)" : "none" }}
    >
      <span style={{ filter: dead ? "grayscale(1)" : "none" }}>{face}</span>
      {mythic && <span className="absolute -top-2" style={{ fontSize: size * 0.32 }}>👑</span>}
    </div>
  );
}

const KIND_COLOR: Record<string, string> = {
  good: "border-emerald-400/50 bg-emerald-900/40 text-emerald-100",
  mythic: "border-amber-300/70 bg-amber-800/40 text-amber-100",
  mixed: "border-sky-400/50 bg-sky-900/40 text-sky-100",
  bad: "border-red-400/50 bg-red-900/40 text-red-100",
};
export function TraitChip({ id, onClick, selected }: { id: string; onClick?: () => void; selected?: boolean }) {
  const t = TRAITS[id];
  if (!t) return null;
  return (
    <span
      onClick={onClick}
      title={`${t.name}: ${t.desc}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${KIND_COLOR[t.kind]} ${onClick ? "cursor-pointer hover:brightness-125" : ""} ${selected ? "ring-2 ring-amber-300" : ""}`}
    >
      <span>{t.icon}</span>
      <span>{t.name}</span>
    </span>
  );
}

export function StatPips({ k, value, cap, eff }: { k: StatKey; value: number; cap: number; eff?: number }) {
  const info = STAT_INFO[k];
  return (
    <div className="flex items-center gap-2 text-xs" title={`${info.label}: ${info.desc}`}>
      <span className="w-5 text-center">{info.icon}</span>
      <span className="w-14 text-violet-200">{info.label}</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: cap }).map((_, i) => (
          <span key={i} className={`h-2 w-2 rounded-sm ${i < value ? "bg-amber-300" : "bg-white/10"}`} />
        ))}
      </div>
      <span className="font-bold text-amber-100">{value}</span>
      {eff !== undefined && eff !== value && <span className={eff > value ? "text-emerald-300" : "text-red-300"}>({eff > value ? "+" : ""}{eff - value})</span>}
    </div>
  );
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1">
      <span>{label}</span>
      <button onClick={() => { audio.sfx("ui"); onChange(!on); }} className={`w-12 h-6 rounded-full relative transition ${on ? "bg-amber-400" : "bg-white/20"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${on ? "left-6" : "left-0.5"}`} />
      </button>
    </label>
  );
}
