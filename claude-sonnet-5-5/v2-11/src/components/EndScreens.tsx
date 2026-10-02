import { CARD_MAP, DIFF_MAP, ORDER_MAP, RELIC_MAP, type RunState } from "../game/data";
import { cn } from "../utils/cn";

export interface EndInfo { ash: number; newBest: boolean; total: number }

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export default function EndScreen({ run, info, victory, onRetry, onSetup, onTitle, onContinue, onReliquary }: {
  run: RunState; info: EndInfo; victory: boolean;
  onRetry: () => void; onSetup: () => void; onTitle: () => void; onContinue?: () => void; onReliquary: () => void;
}) {
  const s = run.stats;
  const rows: [string, string][] = [
    ["Score", s.score.toLocaleString()],
    ["Time", fmtTime(s.time)],
    ["Foes silenced", String(s.kills)],
    ["Bullets grazed", String(s.grazes)],
    ["Damage dealt", Math.round(s.damage).toLocaleString()],
    ["Cards played", String(s.cardsPlayed)],
    ["Hits taken", String(s.hits)],
    ["Peak Fervor", Math.round(s.maxFervor) + "%"],
    ["Bosses felled", String(s.bosses)],
    ["Bullets purged", String(s.purged)],
  ];
  const counts: Record<string, number> = {};
  run.deck.forEach((c) => { const k = CARD_MAP[c.id].name + (c.up ? "+" : ""); counts[k] = (counts[k] || 0) + 1; });
  return (
    <div className={cn("h-full w-full overflow-y-auto p-3 sm:p-6 flex items-center justify-center", victory ? "glass-bg" : "bg-[#0a0206]")}
      style={victory ? undefined : { background: "radial-gradient(ellipse at 50% 30%, rgba(160,20,50,0.35), transparent 60%), #08030a" }}>
      <div className="panel rounded-lg p-5 sm:p-8 w-[min(96vw,720px)] flex flex-col gap-4 fade-up">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.5em] text-amber-200/70">{victory ? "The Hollow Cardinal is silenced" : run.endless && run.won ? "The Endless Vigil ends" : "Your hymn is cut short"}</div>
          <h2 className={cn("text-4xl sm:text-6xl font-extrabold tracking-[0.15em] title-glow", victory ? "text-amber-100" : "text-rose-300")}>{victory ? "ABSOLVED" : "FALLEN"}</h2>
          <div className="text-sm font-sans text-violet-100/80 mt-1">
            {ORDER_MAP[run.order]?.name} · {DIFF_MAP[run.diff]?.name} · Act {run.act}{run.stage === "boss" ? " (Boss)" : ""}{run.vows.length ? ` · ${run.vows.length} vow(s)` : ""}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-sans text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-white/10 py-0.5"><span className="text-violet-200/80">{k}</span><b className="text-amber-50 tabular-nums">{v}</b></div>
          ))}
        </div>
        <div className="text-center">
          <div className="text-2xl text-amber-200 font-bold">+{info.ash} Ash <span className="text-sm text-violet-200/70 font-normal">(×{run.ashMult.toFixed(2)} · total {info.total})</span></div>
          {info.newBest && <div className="text-yellow-200 text-sm tracking-widest uppercase animate-pulse">★ New best score on this difficulty ★</div>}
        </div>
        <div className="text-xs font-sans text-violet-200/70 text-center leading-relaxed">
          <b>Deck:</b> {Object.entries(counts).map(([k, n]) => `${n > 1 ? n + "× " : ""}${k}`).join(", ")}
          {run.relics.length > 0 && <><br /><b>Relics:</b> {run.relics.map((r) => RELIC_MAP[r].icon + " " + RELIC_MAP[r].name).join(", ")}</>}
        </div>
        <div className="flex flex-wrap gap-2 justify-center">
          {victory && onContinue && <button className="btn btn-primary" onClick={onContinue}>Continue · Endless Vigil</button>}
          <button className={cn("btn", !victory && "btn-primary")} onClick={onRetry}>{victory ? "New Run (same rite)" : "Retry"}</button>
          <button className="btn" onClick={onReliquary}>Reliquary</button>
          <button className="btn" onClick={onSetup}>Change Setup</button>
          <button className="btn" onClick={onTitle}>Title</button>
        </div>
      </div>
    </div>
  );
}
