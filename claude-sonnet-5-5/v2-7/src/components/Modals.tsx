import { useEffect, useState } from "react";
import { BOSSES, DIFFS, FACTION_ORDER, FACTIONS, HELP_PAGES, ISSUE_META, ISSUES, TUTORIAL } from "../game/data";
import type { DiffId, FId } from "../game/data";
import { RIVALS, SAVE, satisfaction } from "../game/core";
import type { Game } from "../game/core";
import { changeDifficulty, chooseBoon, closeEvent, continueElection, continueFlow, electionCost, resolveEvent, runElection, setSmear, skipReveal, togglePick, tutNext, tutSkip } from "../game/flow";
import { setSetting } from "../game/settings";
import { Btn, Modal, Title, VolumeRow, toneColor } from "./ui";

export function EventModal({ g }: { g: Game }) {
  const e = g.event!; const scandal = e.kind === "scandal";
  return (
    <Modal>
      <div className="text-center"><div className="text-5xl floaty">{e.emoji}</div></div>
      <Title sub={e.text}>{e.title}</Title>
      {e.outcome === null ? (
        <div className="flex flex-col gap-2">
          {e.options.map((o, i) => (
            <button key={i} disabled={o.disabled} onClick={() => resolveEvent(i)} className={`btn !text-left !p-3 ${scandal ? "btn-red" : ""}`}>
              <div className="font-display text-base">{o.label}</div><div className="text-xs opacity-80 font-[family-name:var(--font-body)]">{o.desc}</div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center slide-up">
          <p className="text-lg text-amber-200 italic mb-4">{e.outcome}</p>
          <Btn kind="gold" className="!px-6 !py-2 !text-base" onClick={() => closeEvent()}>Continue (Enter)</Btn>
        </div>
      )}
    </Modal>
  );
}

export function ResultSheet({ g }: { g: Game }) {
  const r = g.result!; const good = g.sitting.kind === "rival" && g.sitting.dir === -1 && r.title !== "ADJOURNED" ? !r.passed : r.passed;
  return (
    <div className="fixed left-0 right-0 bottom-0 z-[55] flex justify-center p-2 pointer-events-none">
      <div className="panel slide-up pointer-events-auto w-full max-w-xl p-4" style={{ borderColor: good ? "#4ade80" : "#fb7185", boxShadow: `0 0 40px ${good ? "rgba(74,222,128,.25)" : "rgba(251,113,133,.25)"}` }}>
        <div className={`font-display text-2xl font-black text-center ${good ? "text-emerald-300" : "text-rose-300"}`}>{r.title}</div>
        <div className="my-2 space-y-1">{r.lines.map((l, i) => <div key={i} className={`${toneColor(l.tone)} text-sm slide-up`} style={{ animationDelay: `${i * 90}ms` }}>• {l.text}</div>)}</div>
        <Btn kind={r.passed ? "green" : "gold"} className="w-full !py-2 !text-base" onClick={() => continueFlow()}>{r.next === "over" ? "See the Verdict" : "Continue"} (Enter)</Btn>
      </div>
    </div>
  );
}

export function VotingOverlay({ g }: { g: Game }) {
  const s = g.sitting;
  return (
    <div className="fixed left-0 right-0 bottom-3 z-[55] flex justify-center pointer-events-none">
      <div className="panel pointer-events-auto px-4 py-2 flex items-center gap-3 fade-in">
        <span className="font-display text-sm animate-pulse">🗳️ The House is voting on “{s.kind === "confidence" ? BOSSES[s.boss!].title : s.title}”…</span>
        <Btn onClick={() => skipReveal()}>Skip ⏩</Btn>
      </div>
    </div>
  );
}

export function ElectionModal({ g }: { g: Game }) {
  const e = g.election!;
  const opts = [
    { id: "rally", emoji: "📣", name: "Rally the Roost", cost: "Free", desc: "Stump tour: your approval +0.25." },
    { id: "gild", emoji: "🪙", name: "Gild the Nests", cost: "25 ✦", desc: "Hand out trinkets: approval +0.4, +4 Heat." },
    { id: "smear", emoji: "🗞️", name: "Smear Campaign", cost: "10 ✦", desc: "Cut a rival's approval (−0.5; −0.9 if you hold Dirt). +8 Heat." },
    { id: "bury", emoji: "🧹", name: "Bury Old Stories", cost: "12 ✦", desc: "Heat −10 before the ballots are counted." },
  ];
  const cost = electionCost(e.picks);
  return (
    <Modal wide>
      <Title sub="Voters weigh the nation’s mood against each party’s ideals. Choose up to two campaign moves.">🗳️ Election Day — End of Term {g.term}</Title>
      <div className="grid sm:grid-cols-2 gap-2 mb-3">
        {FACTION_ORDER.map(f => {
          const sat = satisfaction(g, f); const F = g.factions[f];
          return <div key={f} className="flex items-center gap-2 rounded-lg bg-black/25 p-2 border border-white/10" style={{ borderLeft: `4px solid ${FACTIONS[f].color}` }}>
            <span className="text-xl">{FACTIONS[f].emoji}</span><span className="font-display text-sm flex-1">{FACTIONS[f].name} <span className="text-slate-400 text-xs">({F.seats})</span></span>
            <span className={`text-sm font-display ${sat >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{sat >= 0 ? "▲ pleased" : "▼ angry"} {Math.round(sat * 100)}%</span></div>;
        })}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {opts.map(o => {
          const on = e.picks.includes(o.id);
          return <div key={o.id} className={`btn !p-3 !text-left cursor-pointer ${on ? "btn-gold" : ""}`} onClick={() => togglePick(o.id)}>
            <div className="font-display">{o.emoji} {o.name} <span className="float-right text-xs">{o.cost}</span></div><div className="text-xs opacity-80">{o.desc}</div>
            {o.id === "smear" && on && <div className="flex flex-wrap gap-1 mt-2" onClick={ev => ev.stopPropagation()}>{RIVALS.map(f => <button key={f} onClick={() => setSmear(f)} className={`btn !text-[11px] !px-2 ${e.smear === f ? "btn-red" : ""}`}>{FACTIONS[f].emoji} {FACTIONS[f].name}</button>)}</div>}
          </div>;
        })}
      </div>
      <div className="text-center mt-4"><Btn kind="gold" className="!px-8 !py-3 !text-lg" onClick={() => runElection()}>Open the Polls {cost > 0 ? `(${cost} ✦)` : ""}</Btn></div>
    </Modal>
  );
}

export function ElectionResult({ g }: { g: Game }) {
  const r = g.election!.result!; const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 150); return () => clearTimeout(t); }, []);
  return (
    <Modal wide>
      <Title sub={r.lost ? "The Murder have been routed." : "The ballots are counted."}>{r.lost ? "💀 Routed at the Polls" : "🏛️ Election Results"}</Title>
      <div className="space-y-2">
        {r.rows.map(row => {
          const d = row.after - row.before;
          return <div key={row.f} className="flex items-center gap-2">
            <span className="w-28 font-display text-sm">{FACTIONS[row.f].emoji} {FACTIONS[row.f].name}</span>
            <div className="flex-1 h-5 rounded bg-white/10 overflow-hidden"><div style={{ width: `${Math.min(100, ((shown ? row.after : row.before) / 45) * 100)}%`, background: FACTIONS[row.f].color, height: "100%", transition: "width 1.4s cubic-bezier(.2,.9,.3,1)" }} /></div>
            <span className="w-24 text-right font-display text-sm">{row.after} <span className={d >= 0 ? "text-emerald-300" : "text-rose-300"}>({d >= 0 ? "+" : ""}{d})</span></span>
          </div>;
        })}
      </div>
      {r.news.length > 0 && <div className="mt-3 text-sm space-y-0.5">{r.news.map((n, i) => <div key={i} className="text-fuchsia-300">• {n}</div>)}</div>}
      {r.lost && <div className="mt-2 text-rose-300 text-center">You hold {g.factions.crows.seats} seats — below the {DIFFS[g.diff].minSeats} required to govern.</div>}
      <div className="text-center mt-4"><Btn kind="gold" className="!px-8 !py-2 !text-base" onClick={() => continueElection()}>{r.lost ? "Accept Defeat" : "Choose a Boon →"}</Btn></div>
    </Modal>
  );
}

export function BoonModal({ g }: { g: Game }) {
  return (
    <Modal wide>
      <Title sub="A Term ends — a new Term begins. Adopt one permanent boon for the rest of this run.">🎁 Choose Your Boon</Title>
      <div className="grid sm:grid-cols-3 gap-3">
        {g.boons!.map((b, i) => (
          <button key={b.id} onClick={() => chooseBoon(i)} className="btn !p-4 text-center slide-up" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="text-4xl mb-1 floaty">{b.emoji}</div><div className="font-display text-base text-[color:var(--color-gold)]">{b.name}</div><div className="text-sm text-slate-200 mt-1 font-[family-name:var(--font-body)]">{b.desc}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function SettingsPanel() {
  const st = SAVE.settings;
  return (
    <div>
      <VolumeRow label="Master" v={st.master} onChange={v => setSetting({ master: v })} />
      <VolumeRow label="Music" v={st.music} onChange={v => setSetting({ music: v })} />
      <VolumeRow label="Effects" v={st.sfx} onChange={v => setSetting({ sfx: v })} />
      <div className="flex gap-2 flex-wrap mt-3">
        <Btn onClick={() => setSetting({ muted: !st.muted })}>{st.muted ? "🔇 Muted" : "🔊 Sound On"}</Btn>
        <Btn onClick={() => setSetting({ shake: !st.shake })}>{st.shake ? "📳 Screen Shake: On" : "📴 Screen Shake: Off"}</Btn>
      </div>
    </div>
  );
}

export function PauseMenu({ g, onResume, onHelp, onQuit, onRestart }: { g: Game; onResume: () => void; onHelp: () => void; onQuit: () => void; onRestart: () => void }) {
  const [view, setView] = useState<"main" | "settings" | "confirm">("main");
  return (
    <Modal z={80}>
      <Title sub={`Term ${g.term}, Sitting ${g.idx + 1}`}>⏸ The House Is Adjourned</Title>
      {view === "main" && (
        <div className="flex flex-col gap-2">
          <Btn kind="gold" className="!py-3 !text-base" onClick={onResume}>▶ Resume (Esc)</Btn>
          <Btn onClick={() => setView("settings")} className="!py-2.5">⚙️ Settings & Difficulty</Btn>
          <Btn onClick={onHelp} className="!py-2.5">❓ How to Play & Controls</Btn>
          <Btn onClick={onRestart} className="!py-2.5">🔄 Restart Run</Btn>
          <Btn kind="red" onClick={() => setView("confirm")} className="!py-2.5">🚪 Abandon to Title</Btn>
        </div>
      )}
      {view === "settings" && (
        <div>
          <SettingsPanel />
          <div className="mt-4 font-display text-sm">Difficulty (applies immediately)</div>
          <div className="grid grid-cols-3 gap-2 mt-1">
            {(Object.keys(DIFFS) as DiffId[]).map(d => <Btn key={d} kind={g.diff === d ? "gold" : ""} onClick={() => changeDifficulty(d)}>{DIFFS[d].emoji} {DIFFS[d].name}</Btn>)}
          </div>
          <div className="text-xs text-slate-400 mt-1">{DIFFS[g.diff].desc}</div>
          <Btn className="mt-4 w-full" onClick={() => setView("main")}>← Back</Btn>
        </div>
      )}
      {view === "confirm" && (
        <div className="text-center"><p className="mb-4">Abandon this run? Progress in this run is lost (no feathers earned).</p>
          <div className="flex gap-2 justify-center"><Btn onClick={() => setView("main")}>Stay</Btn><Btn kind="red" onClick={onQuit}>Abandon</Btn></div></div>
      )}
    </Modal>
  );
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState(0); const page = HELP_PAGES[p];
  return (
    <Modal wide z={90}>
      <Title>❓ How to Play</Title>
      <div className="flex flex-wrap gap-1 justify-center mb-3">{HELP_PAGES.map((h, i) => <button key={i} onClick={() => setP(i)} className={`btn !text-xs ${i === p ? "btn-gold" : ""}`}>{h.title}</button>)}</div>
      <div className="min-h-[170px] space-y-3 text-[17px] leading-relaxed">{page.body.map((t, i) => <p key={i}>{t}</p>)}</div>
      <div className="flex justify-between mt-4"><Btn disabled={p === 0} onClick={() => setP(p - 1)}>← Prev</Btn><Btn kind="gold" onClick={onClose}>Close</Btn><Btn disabled={p === HELP_PAGES.length - 1} onClick={() => setP(p + 1)}>Next →</Btn></div>
    </Modal>
  );
}

export function Banner({ g }: { g: Game }) {
  const [show, setShow] = useState<number | null>(null);
  const key = g.banner?.key;
  useEffect(() => { if (key == null) return; setShow(key); const t = setTimeout(() => setShow(null), 2600); return () => clearTimeout(t); }, [key]);
  if (!g.banner || show !== g.banner.key) return null;
  return (
    <div className="fixed top-24 left-0 right-0 z-[58] flex justify-center pointer-events-none">
      <div key={g.banner.key} className="panel pop-in px-8 py-3 text-center" style={{ borderColor: "#f2c14e" }}>
        <div className="font-display text-xl font-black text-[color:var(--color-gold)]">{g.banner.text}</div>
        <div className="text-sm text-slate-200 italic">{g.banner.sub}</div>
      </div>
    </div>
  );
}

export function TutorialCoach({ g }: { g: Game }) {
  const st = TUTORIAL[g.tut.step]; if (!st) return null;
  return (
    <div className="fixed left-2 right-2 sm:right-auto bottom-3 z-[56] sm:max-w-sm">
      <div className="panel pop-in p-3 pulse-glow" style={{ borderColor: "#f2c14e" }}>
        <div className="flex justify-between items-center mb-1"><span className="font-display text-xs text-[color:var(--color-gold)]">📜 TUTORIAL {g.tut.step + 1}/{TUTORIAL.length}</span><button className="text-xs text-slate-400 underline" onClick={() => tutSkip()}>Skip</button></div>
        <div className="text-[15px] leading-snug">{st.text}</div>
        {st.wait === "next" && <Btn kind="gold" className="mt-2" onClick={() => tutNext()}>Got it →</Btn>}
      </div>
    </div>
  );
}

export function FactionChip({ f }: { f: FId }) { return <span style={{ color: FACTIONS[f].color }}>{FACTIONS[f].emoji} {FACTIONS[f].name}</span>; }
void ISSUES; void ISSUE_META;
