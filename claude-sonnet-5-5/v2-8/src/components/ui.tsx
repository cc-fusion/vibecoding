import type { ReactNode } from "react";

export function Bar({ value, max = 100, color, h = 7 }: { value: number; max?: number; color: string; h?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="bar" style={{ height: h }}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function Key({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-[1.6rem] h-6 px-1.5 rounded-md border text-[11px] font-bold ${
        dim ? "border-white/15 text-white/40 bg-white/5" : "border-sky-200/60 text-sky-50 bg-sky-900/60"
      }`}
    >
      {children}
    </span>
  );
}

export function Modal({ children, wide, z = 40 }: { children: ReactNode; wide?: boolean; z?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-6 bg-[#020813]/70" style={{ zIndex: z }}>
      <div className={`panel pop-in w-full ${wide ? "max-w-5xl" : "max-w-xl"} max-h-full overflow-y-auto scroll-thin p-4 sm:p-6`}>{children}</div>
    </div>
  );
}

export const moraleColor = (m: number) => (m > 60 ? "#7fe0a0" : m > 30 ? "#ffd166" : "#ff6b6b");
export const heatColor = (w: number) => (w > 60 ? "#8fd0ff" : w > 30 ? "#ffd166" : "#ff6b6b");
