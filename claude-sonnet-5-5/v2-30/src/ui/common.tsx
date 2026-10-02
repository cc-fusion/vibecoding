import type { ReactNode } from "react";
import { sfx } from "../game/audio";

export function Btn({
  children, onClick, disabled, variant = "gold", className = "", title, sound = true,
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: "gold" | "dark" | "red" | "ghost" | "purple"; className?: string; title?: string; sound?: boolean;
}) {
  const base = "btn font-display rounded-md border px-4 py-2 text-sm sm:text-base cursor-pointer select-none ";
  const v = {
    gold: "bg-gradient-to-b from-[#e3b95a] to-[#9b6f26] text-[#1a1008] border-[#ffe9a8] font-bold shadow-[0_0_14px_rgba(227,185,90,0.35)]",
    dark: "bg-[#241c2e] text-[#e9dcc0] border-[#5a4a34] hover:border-[#e3b95a]",
    red: "bg-gradient-to-b from-[#b3263e] to-[#6e1626] text-[#ffe9ec] border-[#ff7a8c] font-bold shadow-[0_0_14px_rgba(179,38,62,0.45)]",
    ghost: "bg-transparent text-[#cdbd9a] border-[#3c3046] hover:border-[#a8823a]",
    purple: "bg-gradient-to-b from-[#6b4ba0] to-[#3d2870] text-[#f0e6ff] border-[#b99aff]",
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      className={`${base}${v} ${className}`}
      onClick={() => {
        if (disabled) return;
        if (sound) sfx("click");
        onClick?.();
      }}
    >
      {children}
    </button>
  );
}

export function Bar({ value, max = 100, color = "#e3b95a", h = 6, className = "" }: { value: number; max?: number; color?: string; h?: number; className?: string }) {
  const p = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  return (
    <div className={`w-full rounded-full bg-black/60 overflow-hidden border border-white/10 ${className}`} style={{ height: h }}>
      <div className="h-full rounded-full transition-[width] duration-300 ease-out" style={{ width: `${p * 100}%`, background: color }} />
    </div>
  );
}

export function Overlay({ children, z = 50, onBack }: { children: ReactNode; z?: number; onBack?: () => void }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center p-3 bg-black/70 backdrop-blur-[2px] anim-fadeup"
      style={{ zIndex: z }}
      onClick={(e) => { if (e.target === e.currentTarget) onBack?.(); }}
    >
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-[#5a4a34] bg-gradient-to-b from-[#1d1626] to-[#130e18] shadow-[0_10px_40px_rgba(0,0,0,0.6)] ${className}`}>{children}</div>
  );
}

export function Chip({ children, color = "#cdbd9a", title }: { children: ReactNode; color?: string; title?: string }) {
  return (
    <span title={title} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold border" style={{ color, borderColor: `${color}55`, background: `${color}14` }}>
      {children}
    </span>
  );
}
