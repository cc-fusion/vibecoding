import { useEffect, useState } from "react";
import { BOSSES, DIFFS, ISSUE_META, ISSUES, LEADERS, MANDATES, META_UPGRADES } from "../game/data";
import type { DiffId } from "../game/data";
import { SAVE, useGame } from "../game/core";
import type { Game } from "../game/core";
import { buyUpgrade, unlockLeader } from "../game/flow";
import { setSetting } from "../game/settings";
import { wipeSave } from "../game/save";
import { Btn, Modal, Title } from "./ui";
import { audio } from "../game/audio";

export interface Setup { leader: string; diff: DiffId; mandates: string[]; tutorial: boolean; }

export function TitleScreen({ onPlay, onRoost, onHelp, onSettings }: { onPlay: () => void; onRoost: () => void; onHelp: () => void; onSettings: () => void }) {
  const { save } = useGame();
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(600px 400px at 50% 35%, rgba(167,139,250,.18), transparent 70%)" }} />
      <div className="text-7xl sm:text-8xl floaty select-none">🐦‍⬛</div>
      <h1 className="font-display font-black text-4xl sm:text-6xl md:text-7xl text-[color:var(--color-gold)] mt-2 leading-tight" style={{ textShadow: "0 0 30px rgba(242,193,78,.45), 0 4px 0 #3b2a05" }}>PARLIAMENT<br />OF CROWS</h1>
      <p className="mt-3 text-lg sm:text-xl text-slate-300 italic max-w-xl">Draft bills. Count votes. Bribe, blackmail and charm a House of 99 feathered politicians — and outwit the Owl Chancellor.</p>
      <div className="mt-8 flex flex-col gap-3 w-64 relative">
        <Btn kind="gold" className="!py-3 !text-lg" onClick={onPlay}>▶ Begin a Campaign</Btn>
        <Btn className="!py-2.5 !text-base" onClick={onRoost}>🪶 The Roost <span className="text-xs opacity-75">({save.feathers} feathers)</span></Btn>
        <Btn className="!py-2.5 !text-base" onClick={onHelp}>❓ How to Play</Btn>
        <Btn className="!py-2.5 !text-base" onClick={onSettings}>⚙️ Settings</Btn>
      </div>
      <div className="mt-6 text-sm text-slate-400">Runs: {save.stats.runs} · Victories: {save.stats.wins} · Best term: {save.stats.bestTerm ? (save.stats.bestTerm >= 5 ? "Victory" : save.stats.bestTerm) : "—"}</div>
      <div className="absolute bottom-2 text-xs text-slate-500">Mouse / touch / keyboard · Headphones recommended</div>
    </div>
  );
}

export function SetupScreen({ onStart, onBack }: { onStart: (s: Setup) => void; onBack: () => void }) {
  const { save } = useGame();
  const st = save.settings;
  const [leader, setLeader] = useState(save.leaders.includes(st.lastLeader) ? st.lastLeader : "schemer");
  const [diff, setDiff] = useState<DiffId>((st.lastDiff in DIFFS ? st.lastDiff : "corvid") as DiffId);
  const [mandates, setMandates] = useState<string[]>([]);
  const [tutorial, setTutorial] = useState(!save.seenTutorial);
  const mult = DIFFS[diff].feather * (1 + mandates.reduce((a, id) => a + (MANDATES.find(m => m.id === id)?.bonus || 0), 0));
  const L = LEADERS.find(l => l.id === leader)!;
  return (
    <div className="h-full overflow-y-auto p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <Title sub="Choose your leader, the difficulty, and any self-imposed mandates.">The Campaign Trail</Title>
        <div className="font-display text-sm text-slate-400 uppercase tracking-widest mb-1">Leader</div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {LEADERS.map(l => {
            const own = save.leaders.includes(l.id);
            return <button key={l.id} onClick={() => own && (audio.click(), setLeader(l.id))} className={`panel p-3 text-left transition ${leader === l.id ? "ring-2 ring-amber-300 scale-[1.02]" : "opacity-90 hover:opacity-100"} ${own ? "" : "grayscale opacity-50"}`}>
              <div className="text-3xl">{l.emoji}</div><div className="font-display text-sm font-bold text-[color:var(--color-gold)]">{l.title}</div><div className="text-xs text-slate-300">{l.name}</div>
              {own ? <ul className="text-[11px] mt-1 text-slate-300 list-disc ml-3">{l.perks.map(p => <li key={p}>{p}</li>)}</ul> : <div className="text-xs mt-2 text-amber-300">🔒 Unlock in the Roost ({l.cost} 🪶)</div>}
            </button>;
          })}
        </div>
        <div className="text-sm text-slate-300 mt-2 italic">{L.blurb} Party ideals: {ISSUES.map(k => <span key={k} className="mr-2" style={{ color: L.prefs[k] > 0 ? "#86efac" : L.prefs[k] < 0 ? "#fca5a5" : "#94a3b8" }}>{ISSUE_META[k].emoji}{L.prefs[k] > 0 ? "+" : ""}{L.prefs[k]}</span>)}</div>
        <div className="font-display text-sm text-slate-400 uppercase tracking-widest mt-4 mb-1">Difficulty</div>
        <div className="grid sm:grid-cols-3 gap-2">
          {(Object.keys(DIFFS) as DiffId[]).map(d => <button key={d} onClick={() => { audio.click(); setDiff(d); }} className={`panel p-3 text-left ${diff === d ? "ring-2 ring-amber-300" : ""}`}><div className="font-display font-bold">{DIFFS[d].emoji} {DIFFS[d].name}</div><div className="text-xs text-slate-300">{DIFFS[d].desc}</div><div className="text-[11px] text-amber-300 mt-1">Feathers ×{DIFFS[d].feather}</div></button>)}
        </div>
        <div className="font-display text-sm text-slate-400 uppercase tracking-widest mt-4 mb-1">Mandates (optional challenge modifiers)</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {MANDATES.map(m => { const on = mandates.includes(m.id); return <button key={m.id} onClick={() => { audio.click(); setMandates(on ? mandates.filter(x => x !== m.id) : [...mandates, m.id]); }} className={`panel p-2 text-left ${on ? "ring-2 ring-rose-400" : ""}`}><div className="font-display text-sm">{m.emoji} {m.name}</div><div className="text-xs text-slate-300">{m.desc}</div><div className="text-[11px] text-amber-300">+{Math.round(m.bonus * 100)}% feathers</div></button>; })}
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-5 justify-between">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={tutorial} onChange={e => setTutorial(e.target.checked)} className="w-5 h-5 accent-amber-400" /> Interactive tutorial in the first sitting</label>
          <div className="text-sm text-amber-300 font-display">Feather multiplier ×{mult.toFixed(2)}</div>
          <div className="flex gap-2"><Btn onClick={onBack} className="!px-5 !py-2.5">← Back</Btn><Btn kind="gold" className="!px-8 !py-2.5 !text-lg" onClick={() => { setSetting({ lastLeader: leader, lastDiff: diff }); onStart({ leader, diff, mandates, tutorial }); }}>Take the Perch ▶</Btn></div>
        </div>
      </div>
    </div>
  );
}

export function RoostScreen({ onBack }: { onBack: () => void }) {
  const { save } = useGame(); const [confirm, setConfirm] = useState(false);
  const branches = ["Cunning", "Charm", "Intel", "Power"] as const;
  const bc: Record<string, string> = { Cunning: "#fbbf24", Charm: "#fb923c", Intel: "#60a5fa", Power: "#f43f5e" };
  return (
    <div className="h-full overflow-y-auto p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <Title sub="Feathers earned in every run are spent here on permanent upgrades.">🪶 The Roost</Title>
        <div className="text-center font-display text-2xl text-amber-300 mb-4">{save.feathers} 🪶 feathers</div>
        <div className="grid md:grid-cols-4 gap-3">
          {branches.map(b => (
            <div key={b} className="panel p-3"><div className="font-display font-bold mb-2" style={{ color: bc[b] }}>{b}</div>
              <div className="flex flex-col gap-2">
                {META_UPGRADES.filter(u => u.branch === b).map(u => {
                  const own = save.upgrades.includes(u.id); const locked = !!u.req && !save.upgrades.includes(u.req); const can = !own && !locked && save.feathers >= u.cost;
                  return <button key={u.id} disabled={own || locked} onClick={() => buyUpgrade(u.id)} className={`btn !text-left !p-2 ${own ? "btn-green" : ""} ${can ? "pulse-glow" : ""}`}>
                    <div className="font-display text-sm">{u.emoji} {u.name}</div><div className="text-[11px] opacity-85 font-[family-name:var(--font-body)]">{u.desc}</div>
                    <div className="text-[11px] mt-0.5">{own ? "✔ Owned" : locked ? "🔒 Needs previous" : `${u.cost} 🪶`}</div></button>;
                })}
              </div></div>
          ))}
        </div>
        <div className="font-display text-sm text-slate-400 uppercase tracking-widest mt-5 mb-1">Leaders</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {LEADERS.map(l => { const own = save.leaders.includes(l.id); return (
            <div key={l.id} className="panel p-2"><div className="text-2xl">{l.emoji}</div><div className="font-display text-sm text-[color:var(--color-gold)]">{l.title}</div>
              <ul className="text-[11px] text-slate-300 list-disc ml-3 mb-1">{l.perks.map(p => <li key={p}>{p}</li>)}</ul>
              {own ? <div className="text-xs text-emerald-300">✔ Unlocked</div> : <Btn disabled={save.feathers < l.cost} onClick={() => unlockLeader(l.id)} className="w-full">Unlock — {l.cost} 🪶</Btn>}</div>); })}
        </div>
        <div className="grid md:grid-cols-2 gap-3 mt-5">
          <div className="panel p-3"><div className="font-display font-bold text-[color:var(--color-gold)] mb-1">Career</div>
            <div className="text-sm grid grid-cols-2 gap-x-3">
              <span>Runs: {save.stats.runs}</span><span>Victories: {save.stats.wins}</span><span>Bills passed: {save.stats.bills}</span><span>Bribes paid: {save.stats.bribes}</span><span>Scandals: {save.stats.scandals}</span><span>Feathers earned: {save.stats.totalFeathers}</span>
              {Object.entries(save.winsByDiff).map(([d, n]) => <span key={d}>🏆 {d} wins: {n}</span>)}</div></div>
          <div className="panel p-3"><div className="font-display font-bold text-[color:var(--color-gold)] mb-1">Recent Runs</div>
            {save.history.length === 0 && <div className="text-sm text-slate-400">No runs yet. The Parliament awaits.</div>}
            <div className="text-xs space-y-0.5 max-h-28 overflow-y-auto">{save.history.map((h, i) => <div key={i} className={h.result === "victory" ? "text-emerald-300" : "text-slate-300"}>{h.result === "victory" ? "🏆" : "💀"} {LEADERS.find(l => l.id === h.leader)?.title} · {h.diff} · Term {h.term} · {h.seats} seats · {h.passed} bills · +{h.feathers}🪶</div>)}</div></div>
        </div>
        <div className="flex justify-between mt-5"><Btn onClick={onBack} className="!px-6 !py-2">← Back</Btn><Btn kind="red" onClick={() => setConfirm(true)}>Reset all progress</Btn></div>
      </div>
      {confirm && <Modal z={95}><Title>Erase Everything?</Title><p className="text-center mb-4">All feathers, upgrades, unlocked leaders and career stats will be erased.</p><div className="flex gap-2 justify-center"><Btn onClick={() => setConfirm(false)}>Cancel</Btn><Btn kind="red" onClick={() => { wipeSave(); setConfirm(false); window.location.reload(); }}>Erase</Btn></div></Modal>}
    </div>
  );
}

function CountUp({ to }: { to: number }) {
  const [v, setV] = useState(0);
  useEffect(() => { let raf = 0; const t0 = performance.now(); const loop = (n: number) => { const k = Math.min(1, (n - t0) / 1400); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf); }, [to]);
  return <>{v}</>;
}

export function OverScreen({ g, onRetry, onRoost, onTitle, onHarder }: { g: Game; onRetry: () => void; onRoost: () => void; onTitle: () => void; onHarder: () => void }) {
  const o = g.over!; const r = g.run; const win = o.win;
  const rows: [string, string | number][] = [["Terms completed", r.termsDone], ["Bills passed", r.passed], ["Bills defeated", r.failed], ["Final seats (The Murder)", g.factions.crows.seats], ["Peak seats", r.peakSeats], ["Bribes paid", r.bribes], ["Speeches given", r.speeches], ["Blackmails", r.blackmails], ["Seat defections", r.defections], ["Scandals weathered", r.scandals], ["Pledges broken", r.betrayals], ["Peak Heat", Math.round(r.peakHeat)], ["Shinies spent", Math.round(r.shiniesSpent)], ["Sittings held", r.sittings]];
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto fade-in" style={{ background: win ? "radial-gradient(900px 600px at 50% 0%, rgba(242,193,78,.25), rgba(8,6,20,.96))" : "radial-gradient(900px 600px at 50% 0%, rgba(244,63,94,.2), rgba(8,6,20,.96))" }}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="panel pop-in w-full max-w-2xl p-6 text-center" style={{ borderColor: win ? "#f2c14e" : "#fb7185" }}>
          <div className="text-6xl floaty">{win ? "👑" : "💀"}</div>
          <h2 className={`font-display font-black text-3xl sm:text-4xl mt-1 ${win ? "text-[color:var(--color-gold)]" : "text-rose-300"}`}>{win ? "VICTORY" : "GAME OVER"}</h2>
          <div className="font-display text-lg mt-1">{o.title}</div>
          <p className="italic text-slate-300 mt-1">{o.text}</p>
          {win && <p className="text-sm text-amber-200 mt-1">{BOSSES.strix.emoji} {BOSSES.strix.name} has been dissolved. The Parliament of Crows is yours.</p>}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 my-4 text-left">{rows.map(([k, v]) => <div key={k} className="bg-black/25 rounded-lg px-2 py-1 border border-white/10"><div className="text-[10px] text-slate-400 uppercase tracking-wider font-display">{k}</div><div className="font-display text-lg">{v}</div></div>)}</div>
          <div className="font-display text-2xl text-amber-300 mb-1">+<CountUp to={o.feathers} /> 🪶 feathers</div>
          <div className="text-xs text-slate-400 mb-4">Spend them in the Roost on permanent upgrades. Total: {SAVE.feathers}</div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Btn kind="gold" className="!px-6 !py-2.5 !text-base" onClick={onRetry}>🔄 {win ? "Play Again" : "Try Again"}</Btn>
            {win && g.diff !== "raven" && <Btn kind="red" className="!px-6 !py-2.5 !text-base" onClick={onHarder}>🦅 Harder Difficulty</Btn>}
            <Btn className="!px-6 !py-2.5 !text-base" onClick={onRoost}>🪶 The Roost</Btn>
            <Btn className="!px-6 !py-2.5 !text-base" onClick={onTitle}>🏠 Title</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
