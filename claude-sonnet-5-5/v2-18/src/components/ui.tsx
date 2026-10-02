import type { ReactNode } from "react";
import { PILLARS, PILLAR_ICON, PILLAR_LABEL } from "../lib/types";
import { proven, skey } from "../lib/store";
import type { Run } from "../lib/store";

export function Kw({ text, k }: { text: string; k: string }) {
  const i = text.indexOf(k);
  if (i < 0 || !k) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b className="kw">{k}</b>
      {text.slice(i + k.length)}
    </>
  );
}

export function Bar({ value, max, color, label, icon }: { value: number; max: number; color: string; label?: string; icon?: ReactNode }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return (
    <div className="flex items-center gap-1.5 min-w-[120px] flex-1" title={label}>
      {icon && <span className="text-sm">{icon}</span>}
      <div className="relative h-4 flex-1 rounded-full bg-black/50 border border-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150" style={{ width: `${pct}%`, background: color }} />
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white/90 drop-shadow">
          {label ? `${label} ` : ""}
          {Math.round(value)}
        </span>
      </div>
    </div>
  );
}

export function PillarRow({ run, s }: { run: Run; s: number }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {PILLARS.map((p) => {
        const pv = proven(run, s, p);
        const cl = run.claims[skey(s, p)];
        let cls = "border-white/15 text-white/50 bg-white/5";
        let txt = "?";
        if (pv === true) { cls = "border-red-400 text-red-200 bg-red-900/50"; txt = "proven"; }
        else if (pv === false) { cls = "border-emerald-400 text-emerald-200 bg-emerald-900/40"; txt = "cleared"; }
        else if (cl) { cls = "border-dashed border-amber-300/50 text-amber-200/80 bg-amber-900/10 italic"; txt = `says ${cl.value ? "yes" : "no"}${cl.src === "exposed" ? "*" : ""}`; }
        return (
          <span key={p} title={`${PILLAR_LABEL[p]}: ${txt}`} className={`text-[10px] px-1.5 py-0.5 rounded-md border ${cls}`}>
            {PILLAR_ICON[p]} {txt}
          </span>
        );
      })}
    </div>
  );
}
