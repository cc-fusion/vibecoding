import { DIFFS, ISSUES, ISSUE_META } from "../game/data";
import { ROMAN } from "../game/flow";
import { Bar, Btn } from "./ui";
import type { Game } from "../game/core";

export default function Hud({ g, muted, onPause, onHelp, onMute }: { g: Game; muted: boolean; onPause: () => void; onHelp: () => void; onMute: () => void }) {
  const s = g.sitting; const heatHot = g.heat >= 70;
  return (
    <div className="panel px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-2">
      <div className="min-w-[120px]">
        <div className="font-display text-sm text-[color:var(--color-gold)] font-bold">TERM {ROMAN[g.term]} · {g.sitting.kind === "boss" ? `READING ${s.reading}/3` : `SITTING ${Math.min(4, g.idx + 1)}/4`}</div>
        <div className="text-[11px] text-slate-400 uppercase tracking-wider">{DIFFS[g.diff].emoji} {DIFFS[g.diff].name}</div>
      </div>
      <div title="Action Points" className="flex items-center gap-1">
        <span className="font-display text-xs text-slate-400 mr-1">AP</span>
        {Array.from({ length: s.apMax }).map((_, i) => (
          <span key={i} className="inline-block w-4 h-4 rounded-full border transition-all duration-300" style={{ background: i < s.ap ? "#f2c14e" : "transparent", borderColor: "#f2c14e", boxShadow: i < s.ap ? "0 0 8px #f2c14e" : "none", transform: i < s.ap ? "scale(1)" : "scale(.7)" }} />
        ))}
      </div>
      <div id="hud-shinies" className="flex items-center gap-1 font-display text-lg font-bold text-amber-300" title="Shinies — currency for bribes, riders and cover-ups">✦ {Math.round(g.shinies)}</div>
      <div className="w-32" id="hud-heat" title="Heat: public suspicion. 100 = impeachment!">
        <div className={`flex justify-between text-[11px] font-display ${heatHot ? "text-rose-300 danger-blink" : "text-slate-300"}`}><span>🔥 HEAT</span><span>{Math.round(g.heat)}</span></div>
        <Bar v={g.heat} color={g.heat > 70 ? "#f43f5e" : g.heat > 40 ? "#fb923c" : "#fbbf24"} danger={heatHot} />
      </div>
      <div className="w-28" id="hud-renown" title="Renown: public standing. Boosts speeches and elections.">
        <div className="flex justify-between text-[11px] font-display text-slate-300"><span>⭐ RENOWN</span><span>{Math.round(g.renown)}</span></div>
        <Bar v={g.renown} color="#a78bfa" />
      </div>
      <div className="flex gap-3 flex-wrap">
        {ISSUES.map(k => {
          const v = Math.round(g.stats[k]); const low = v <= 25;
          return (
            <div key={k} id={`stat-${k}`} className="w-[68px]" title={`${ISSUE_META[k].name}: nation stat. Reaching 0 collapses the realm!`}>
              <div className={`flex justify-between text-[11px] font-display ${low ? "text-rose-300 danger-blink" : "text-slate-300"}`}><span>{ISSUE_META[k].emoji}</span><span>{v}</span></div>
              <Bar v={v} color={low ? "#f43f5e" : ISSUE_META[k].color} h={6} danger={low} />
            </div>
          );
        })}
      </div>
      <div className="ml-auto flex gap-2">
        <Btn onClick={onMute} title="Mute (M)">{muted ? "🔇" : "🔊"}</Btn>
        <Btn onClick={onHelp} title="Help">❓</Btn>
        <Btn onClick={onPause} title="Pause (Esc)">⏸ Pause</Btn>
      </div>
    </div>
  );
}
