import { ROLES, TRAITS } from "../game/data";
import { getBond, type Run } from "../game/run";
import { Bar, heatColor, moraleColor } from "./ui";

export default function CrewPanel({ run, onDismiss }: { run: Run; onDismiss?: (id: number) => void }) {
  const crew = run.crew;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {crew.map((c) => {
        const others = crew.filter((o) => o.id !== c.id && o.alive);
        return (
          <div key={c.id} className={`rounded-xl border border-white/10 bg-black/25 p-3 ${c.alive ? "" : "opacity-40"}`}>
            <div className="flex items-start gap-3">
              <div className="text-3xl">{c.alive ? c.icon : "💀"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-lg leading-none">{c.name}</div>
                  <div className="text-xs text-sky-200">{ROLES[c.role].icon} {ROLES[c.role].name}</div>
                </div>
                <div className="text-[11px] text-white/60 mt-0.5">{ROLES[c.role].desc}</div>
                <div className="text-[11px] text-amber-200 mt-0.5">★ {TRAITS[c.trait].name}: <span className="text-white/60">{TRAITS[c.trait].desc}</span></div>
              </div>
            </div>
            <div className="mt-2 space-y-1 text-[11px]">
              <div className="flex items-center gap-2"><span className="w-14 text-white/60">Morale</span><div className="flex-1"><Bar value={c.morale} color={moraleColor(c.morale)} /></div><span className="w-7 text-right">{Math.round(c.morale)}</span></div>
              <div className="flex items-center gap-2"><span className="w-14 text-white/60">Warmth</span><div className="flex-1"><Bar value={c.warmth} color={heatColor(c.warmth)} /></div><span className="w-7 text-right">{Math.round(c.warmth)}</span></div>
              <div className="flex items-center gap-2"><span className="w-14 text-white/60">Health</span><div className="flex-1"><Bar value={c.health} color="#ff8fa3" /></div><span className="w-7 text-right">{Math.round(c.health)}</span></div>
            </div>
            {c.alive && others.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {others.map((o) => {
                  const b = getBond(run, c.id, o.id);
                  return (
                    <span key={o.id} title={`Bond with ${o.name}: ${Math.round(b)}`} className="text-[10px] px-1.5 py-0.5 rounded-full border"
                      style={{ borderColor: b > 20 ? "#7fe0a0" : b < -20 ? "#ff6b6b" : "#ffffff30", color: b > 20 ? "#b6f5cc" : b < -20 ? "#ffb0b0" : "#cbd5e1" }}>
                      {b > 40 ? "💞" : b > 10 ? "🙂" : b < -40 ? "💢" : b < -10 ? "😠" : "😐"} {o.name} {Math.round(b)}
                    </span>
                  );
                })}
              </div>
            )}
            {onDismiss && c.alive && (
              <div className="mt-2 text-right"><button className="btn btn-sm btn-danger" onClick={() => onDismiss(c.id)}>Dismiss</button></div>
            )}
          </div>
        );
      })}
    </div>
  );
}
