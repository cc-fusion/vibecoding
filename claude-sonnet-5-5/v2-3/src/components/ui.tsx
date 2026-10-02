import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Game } from "../game/engine";

export function useGameSync(g: Game) {
  const [, set] = useState(0);
  useEffect(() => {
    let pending = false;
    g.onChange = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        set((v) => v + 1);
      });
    };
    return () => {
      g.onChange = null;
    };
  }, [g]);
}

export function Bar({ value, max, color, label, icon, warn }: { value: number; max: number; color: string; label?: string; icon: string; warn?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-lg leading-none w-6 text-center shrink-0">{icon}</span>
      <div className="flex-1 min-w-[70px]">
        <div className="flex justify-between text-[11px] leading-none mb-0.5 opacity-90">
          <span>{label}</span>
          <span className={warn ? "text-red-300 font-bold" : ""}>{Math.round(value)}/{max}</span>
        </div>
        <div className="bar">
          <i style={{ width: pct + "%", background: color }} className={warn ? "animate-pulse" : ""} />
        </div>
      </div>
    </div>
  );
}

export function Modal({ children, wide, dark, z = 40 }: { children: ReactNode; wide?: boolean; dark?: boolean; z?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 bg-black/55 backdrop-blur-[2px]" style={{ zIndex: z }}>
      <div className={`${dark ? "panel-dark" : "panel"} anim-pop w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-full overflow-y-auto scroll-thin p-4 sm:p-6`}>{children}</div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>;
}

export function Title({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="text-center mb-3">
      <h2 className="font-title text-2xl sm:text-3xl font-black tracking-wide">{children}</h2>
      {sub && <p className="italic opacity-75 text-sm">{sub}</p>}
    </div>
  );
}
