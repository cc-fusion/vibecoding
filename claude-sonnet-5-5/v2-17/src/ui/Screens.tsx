import { BOONS, DIFFICULTIES, REALMS, RELICS, STAT_INFO, STAT_KEYS } from "../game/data";
import { ageGroup, dynastyScore, effStats, heroTitle, marksFor, type Dynasty, type Hero } from "../game/lineage";
import type { RunState } from "../game/engine";
import { Btn, Portrait, TraitChip, fmtTime } from "./common";

export interface Report {
  outcome: "died" | "retreat" | "victory";
  run: RunState;
  bosses: number;
  relics: string[];
  realm: number;
  room: number;
  goldKept: number;
  renown: number;
  born: Hero[];
  note: string;
  next: "home" | "succession" | "end";
}

export function ReportScreen({ r, d, onContinue }: { r: Report; d: Dynasty; onContinue: () => void }) {
  const title = r.outcome === "died" ? "Fallen in the Depths" : r.outcome === "victory" ? "The Hollow King Falls!" : "A Safe Return";
  const color = r.outcome === "died" ? "text-red-300" : "text-amber-200";
  const stat = (label: string, v: string | number) => (
    <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center"><div className="text-xs text-violet-300">{label}</div><div className="text-lg font-bold text-amber-100">{v}</div></div>
  );
  return (
    <div className="h-full w-full scroll-y flex justify-center p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #3a1a2a 0%, #0d0916 70%)" }}>
      <div className="panel w-full max-w-3xl p-5 h-fit anim-up">
        <div className="text-center mb-4">
          <div className="text-5xl">{r.outcome === "died" ? "🪦" : r.outcome === "victory" ? "👑" : "🏠"}</div>
          <h2 className={`font-title text-3xl sm:text-4xl ${color}`}>{title}</h2>
          <p className="text-violet-300 text-sm">{d.hero.name !== undefined && r.note}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {stat("Realm", REALMS[Math.min(4, r.realm)].name.split(" ").slice(-1)[0])}
          {stat("Rooms cleared", r.run.rooms)}
          {stat("Foes slain", r.run.kills)}
          {stat("Bosses", r.run.bosses)}
          {stat("Damage dealt", Math.round(r.run.damage))}
          {stat("Damage taken", Math.round(r.run.taken))}
          {stat("Time", fmtTime(r.run.time))}
          {stat("Deflects", r.run.deflects)}
          {stat("Gold collected", Math.floor(r.run.gold))}
          {stat("Gold banked", r.goldKept)}
          {stat("Renown gained", `+${r.renown}`)}
          {stat("Roars", r.run.specials)}
        </div>
        {Object.keys(r.run.boons).length > 0 && (
          <div className="mb-3 text-sm"><span className="text-violet-300">Boons: </span>{Object.entries(r.run.boons).map(([id, lv]) => BOONS[id] && <span key={id} className="mr-2" title={BOONS[id].name}>{BOONS[id].icon}×{lv}</span>)}</div>
        )}
        {r.relics.length > 0 && <div className="mb-3 text-sm text-amber-200">🏺 Heirlooms recovered: {r.relics.map((id) => `${RELICS[id].icon} ${RELICS[id].name}`).join(", ")}</div>}
        {r.born.length > 0 && <div className="mb-3 text-sm text-emerald-300">👶 Born while you were away: {r.born.map((b) => b.name).join(" & ")}</div>}
        {r.run.rooms === 0 && r.outcome === "died" && <p className="text-xs text-violet-400 mb-2">Tip: Dash through red telegraphs and deflect bullets with a melee swing.</p>}
        <div className="flex justify-end"><Btn variant="primary" onClick={onContinue} className="!px-8">{r.next === "succession" ? "Mourn & Choose an Heir →" : r.next === "end" ? "The End of the Line →" : "Return to the Homestead →"}</Btn></div>
      </div>
    </div>
  );
}

export function SuccessionScreen({ d, onCrown }: { d: Dynasty; onCrown: (id: number) => void }) {
  const last = d.ancestors[d.ancestors.length - 1];
  return (
    <div className="h-full w-full scroll-y flex justify-center p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a2040 0%, #0d0916 70%)" }}>
      <div className="panel w-full max-w-4xl p-5 h-fit anim-up">
        <h2 className="font-title text-3xl text-amber-200 text-center">The Crown Passes</h2>
        {last && <p className="text-center text-violet-300 text-sm mb-4">{last.name} {last.cause}. Ancestors now fighting at your side: <b className="text-amber-200">{d.ancestors.length}</b>. Heirlooms carried have grown stronger.</p>}
        <p className="text-sm text-violet-200 mb-3">Choose who will take up the family blade. Heirs younger than 16 will be raised in regency, and the years pass for everyone. Remember to train them and to find them a spouse.</p>
        <div className="grid md:grid-cols-2 gap-3">
          {d.children.map((c) => {
            const e = effStats(c);
            return (
              <div key={c.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex gap-3 items-center">
                  <Portrait hero={c} size={56} />
                  <div className="flex-1 min-w-0">
                    <div className="font-title text-xl text-amber-100">{heroTitle(c)}</div>
                    <div className="text-xs text-violet-300">{ageGroup(c.age)}, age {c.age}{c.age < 16 ? ` · regency ${16 - c.age} yrs` : ""}{c.parents[0] === "Distant Kin" ? " · distant kin" : ""}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 my-2">{c.traits.map((t) => <TraitChip key={t} id={t} />)}</div>
                <div className="grid grid-cols-5 gap-1 text-center text-xs mb-2">
                  {STAT_KEYS.map((k) => <div key={k} className="rounded bg-black/30 p-1" title={STAT_INFO[k].desc}>{STAT_INFO[k].icon}<div className="font-bold text-amber-100">{c.stats[k]}{e[k] !== c.stats[k] && c.age >= 16 ? <span className="text-violet-300">→{e[k]}</span> : ""}</div></div>)}
                </div>
                <Btn variant="primary" className="w-full" onClick={() => onCrown(c.id)}>👑 Crown {c.name}</Btn>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EndScreen({ d, won, marks, onNew, onTitle, onContinue }: { d: Dynasty; won: boolean; marks: number; onNew: () => void; onTitle: () => void; onContinue?: () => void }) {
  const score = dynastyScore(d);
  const reason = won ? "The Hollow King lies dead, and House " + d.house + " is legend." : d.endReason || "The line ends.";
  const stat = (label: string, v: string | number) => (
    <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-center"><div className="text-xs text-violet-300">{label}</div><div className="text-lg font-bold text-amber-100">{v}</div></div>
  );
  return (
    <div className="h-full w-full scroll-y flex justify-center p-3 sm:p-6" style={{ background: won ? "radial-gradient(ellipse at 50% 0%, #5a4a10 0%, #150f20 70%)" : "radial-gradient(ellipse at 50% 0%, #3a1020 0%, #0a060f 70%)" }}>
      <div className="panel w-full max-w-3xl p-5 h-fit anim-up">
        <div className="text-center mb-4">
          <div className="text-6xl anim-float">{won ? "👑" : "🪦"}</div>
          <h2 className={`font-title text-4xl sm:text-5xl font-black ${won ? "shimmer-text" : "text-red-300"}`}>{won ? "DYNASTY TRIUMPHANT" : "THE LINE ENDS"}</h2>
          <p className="text-violet-200 mt-2">{reason}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {stat("Generations", d.gen)}
          {stat("Years", d.year)}
          {stat("Expeditions", d.stats.runs)}
          {stat("Foes slain", d.stats.kills)}
          {stat("Bosses slain", d.stats.bosses)}
          {stat("Realms cleared", `${d.realmsCleared}/5`)}
          {stat("Gold earned", Math.floor(d.stats.goldEarned))}
          {stat("Difficulty", DIFFICULTIES[d.difficulty].name.split(" ")[0])}
        </div>
        <div className="rounded-xl bg-amber-300/10 border border-amber-300/40 p-3 text-center mb-4">
          <div className="text-sm text-violet-200">Dynasty score</div>
          <div className="font-title text-4xl text-amber-200">{score}</div>
          <div className="text-sm text-amber-300 mt-1">🪙 +{marks} Legacy Marks (spend them in the Ancestral Hall)</div>
        </div>
        <div className="mb-4 text-xs text-violet-300 flex flex-wrap gap-1">Bloodline: {[...d.ancestors, d.hero].map((h) => <span key={h.id} className="rounded bg-white/5 px-1.5 py-0.5">{h.gen}. {h.name}</span>)}</div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Btn variant="ghost" onClick={onTitle}>Title Screen</Btn>
          {onContinue && <Btn onClick={onContinue}>Keep Ruling (free play)</Btn>}
          <Btn variant="primary" onClick={onNew}>⚔️ New Dynasty</Btn>
        </div>
      </div>
    </div>
  );
}

export const previewMarks = (d: Dynasty) => marksFor(d);
