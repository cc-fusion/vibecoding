import { useState } from "react";
import type { ReactNode } from "react";
import { audio } from "../audio";
import type { Game, Save } from "../game";
import { persist } from "../game";
import { CASE_META, DIFFS, MODS, UPGRADES, buildCase, type DiffId } from "../data";

const panel = "rounded-2xl border border-cyan-400/40 bg-[#08101d]/92 shadow-[0_0_50px_rgba(92,200,255,0.16)]";
export function Btn({ children, onClick, kind = "main", disabled, className = "" }: { children: ReactNode; onClick?: () => void; kind?: "main" | "ghost" | "danger" | "gold"; disabled?: boolean; className?: string }) {
  const k = {
    main: "border-cyan-400/60 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/30",
    ghost: "border-slate-600 bg-slate-800/50 text-slate-200 hover:bg-slate-700",
    danger: "border-red-500/60 bg-red-500/15 text-red-100 hover:bg-red-500/30",
    gold: "border-amber-300/70 bg-amber-300/20 text-amber-100 hover:bg-amber-300/35",
  }[kind];
  return (
    <button disabled={disabled} onClick={() => { audio.resume(); audio.sfx("click"); onClick?.(); }}
      className={`rounded-xl border px-5 py-3 text-sm font-bold tracking-widest transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 ${k} ${className}`}>{children}</button>
  );
}
const Screen = ({ children, wide }: { children: ReactNode; wide?: boolean }) => (
  <div className="absolute inset-0 overflow-auto bg-[radial-gradient(ellipse_at_top,#0d1b33,#04070f_70%)]">
    <div className={`mx-auto flex min-h-full w-full ${wide ? "max-w-5xl" : "max-w-2xl"} flex-col items-stretch justify-center p-4 sm:p-8`}>{children}</div>
  </div>
);

export function Title({ save, onPlay, onArchive, onHelp, onSettings }: { save: Save; onPlay: () => void; onArchive: () => void; onHelp: () => void; onSettings: () => void }) {
  const solved = Object.keys(save.solved).length;
  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(ellipse_at_center,#0d1b33,#03050a_75%)]">
      <div className="title-ring absolute left-1/2 top-1/2 h-[90vmin] w-[90vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/20" />
      <div className="title-ring2 absolute left-1/2 top-1/2 h-[65vmin] w-[65vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-300/20" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-2 font-mono text-sm tracking-[0.5em] text-cyan-300/80">19:00 → 19:00 → 19:00</div>
        <h1 className="glitch text-5xl font-black leading-none tracking-[0.12em] text-white sm:text-7xl md:text-8xl" data-text="LOOP STATION ZERO">LOOP STATION ZERO</h1>
        <p className="mt-4 max-w-lg text-slate-300">A time-loop murder mystery. The crew keeps a schedule. The killer keeps a secret. You keep your memory.</p>
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Btn kind="gold" onClick={onPlay}>▶ CASE FILES</Btn>
          <Btn onClick={onArchive}>🗄 ARCHIVE · UPGRADES</Btn>
          <div className="grid grid-cols-2 gap-3"><Btn kind="ghost" onClick={onHelp}>HOW TO PLAY</Btn><Btn kind="ghost" onClick={onSettings}>SETTINGS</Btn></div>
        </div>
        <div className="mt-6 text-xs text-slate-400">Insight: <b className="text-amber-300">{save.insight}</b> · Cases solved: <b className="text-emerald-300">{solved}/3</b></div>
      </div>
    </div>
  );
}

export function CaseSelect({ save, onStart, onBack, onChange }: { save: Save; onStart: (id: string, d: DiffId, mods: string[]) => void; onBack: () => void; onChange: () => void }) {
  const [diff, setDiff] = useState<DiffId>("normal");
  const [mods, setMods] = useState<string[]>([]);
  const unlocked = (i: number) => i === 0 || !!save.solved[CASE_META[i - 1].id];
  const next = CASE_META.findIndex((c, i) => unlocked(i) && !save.solved[c.id]);
  const [sel, setSel] = useState(next < 0 ? 0 : next);
  const meta = CASE_META[sel];
  const preview = buildCase(meta.id, 1);
  const d = DIFFS[diff];
  const pool = Math.max(3, Math.round(preview.pool * d.pool) + (save.ups.stab || 0) * 2 - (mods.includes("fragile") ? 3 : 0));
  return (
    <Screen wide>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-black tracking-[0.2em] text-cyan-200">CASE FILES</h2>
        <Btn kind="ghost" onClick={onBack}>← BACK</Btn>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {CASE_META.map((c, i) => {
          const ok = unlocked(i);
          const s = save.solved[c.id];
          return (
            <button key={c.id} disabled={!ok} onClick={() => { audio.sfx("click"); setSel(i); }}
              className={`rounded-2xl border p-4 text-left transition ${sel === i ? "border-amber-300 bg-amber-300/10 shadow-[0_0_30px_rgba(255,209,102,0.2)]" : "border-cyan-400/30 bg-[#08101d]/80 hover:bg-cyan-500/10"} ${ok ? "" : "opacity-40"}`}>
              <div className="flex items-center justify-between text-xs uppercase tracking-widest text-slate-400"><span>Case {c.num}{c.num === 3 ? " · FINALE" : ""}</span><span>{ok ? (s ? <b className="text-emerald-300">SOLVED · {s.rank}</b> : "OPEN") : "🔒 LOCKED"}</span></div>
              <div className="mt-1 text-xl font-bold text-white">{c.title}</div>
              <div className="text-sm text-slate-400">{c.tagline}</div>
            </button>
          );
        })}
      </div>
      <div className={`${panel} mt-4 p-4 sm:p-5`}>
        <p className="text-sm leading-relaxed text-slate-300">{preview.brief}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Difficulty</div>
            <div className="space-y-2">
              {(Object.keys(DIFFS) as DiffId[]).map((k) => (
                <button key={k} onClick={() => { audio.sfx("click"); setDiff(k); }} className={`w-full rounded-lg border px-3 py-2 text-left ${diff === k ? "border-cyan-300 bg-cyan-400/15" : "border-slate-700 bg-slate-900/50"}`}>
                  <b className="text-cyan-100">{DIFFS[k].name}</b><span className="ml-2 text-xs text-slate-400">{DIFFS[k].desc}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-widest text-slate-400">Modifiers (+25% Insight each)</div>
            <div className="space-y-2">
              {MODS.map((m) => {
                const on = mods.includes(m.id);
                return (
                  <button key={m.id} onClick={() => { audio.sfx("click"); setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id]); }} className={`w-full rounded-lg border px-3 py-2 text-left ${on ? "border-amber-300 bg-amber-300/15" : "border-slate-700 bg-slate-900/50"}`}>
                    <b className="text-amber-100">{on ? "☑" : "☐"} {m.name}</b><span className="ml-2 text-xs text-slate-400">{m.desc}</span>
                  </button>
                );
              })}
              <button onClick={() => { save.set.tutorial = !save.set.tutorial; persist(save); onChange(); }} className="w-full rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-left">
                <b className="text-slate-200">{save.set.tutorial ? "☑" : "☐"} Tutorial hints</b><span className="ml-2 text-xs text-slate-400">Case 1 guidance</span>
              </button>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-300">Loops available: <b className="text-cyan-200">{pool}</b> · Clock: <b className="text-cyan-200">{(d.spm * (mods.includes("short") ? 0.75 : 1)).toFixed(2)}s/min</b></div>
          <Btn kind="gold" disabled={!unlocked(sel)} onClick={() => onStart(meta.id, diff, mods)}>OPEN CASE ▶</Btn>
        </div>
      </div>
    </Screen>
  );
}

export function Brief({ g, onBegin, onBack }: { g: Game; onBegin: () => void; onBack: () => void }) {
  const cd = g.cd;
  return (
    <Screen>
      <div className={`${panel} p-6 sm:p-8`}>
        <div className="text-xs uppercase tracking-[0.4em] text-amber-300">Case {cd.num} · Briefing</div>
        <h2 className="mt-1 text-4xl font-black text-white">{cd.title}</h2>
        <p className="mt-4 leading-relaxed text-slate-300">{cd.brief}</p>
        <ul className="mt-4 space-y-1 text-sm text-slate-300">
          <li>⏱ Loops available: <b className="text-cyan-200">{g.pool}</b> — every rewind spends one. Run out and the timeline collapses.</li>
          <li>🔎 Find <b className="text-amber-300">{cd.evidence.length}</b> pieces of evidence, then confront the killer.</li>
          <li>👁 Don't be seen doing illegal things. Suspicion above 70% brings Security running.</li>
        </ul>
        <div className="mt-6 flex gap-3"><Btn kind="ghost" onClick={onBack}>← BACK</Btn><Btn kind="gold" className="flex-1" onClick={onBegin}>WAKE UP AT 19:00 ▶</Btn></div>
      </div>
    </Screen>
  );
}

export function Archive({ save, onBack, onChange }: { save: Save; onBack: () => void; onChange: () => void }) {
  const buy = (id: string, cost: number) => {
    if (save.insight < cost) { audio.sfx("bad"); return; }
    save.insight -= cost;
    save.ups[id] = (save.ups[id] || 0) + 1;
    persist(save); audio.sfx("evidence"); onChange();
  };
  return (
    <Screen wide>
      <div className="mb-4 flex items-center justify-between">
        <div><h2 className="text-2xl font-black tracking-[0.2em] text-cyan-200">THE ARCHIVE</h2><p className="text-sm text-slate-400">Spend Insight on permanent temporal upgrades.</p></div>
        <div className="flex items-center gap-3"><div className="rounded-lg border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-lg font-bold text-amber-200">✦ {save.insight}</div><Btn kind="ghost" onClick={onBack}>← BACK</Btn></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {UPGRADES.map((u) => {
          const lvl = save.ups[u.id] || 0;
          const maxed = lvl >= u.max;
          const cost = u.cost[Math.min(lvl, u.cost.length - 1)];
          return (
            <div key={u.id} className={`${panel} flex items-center gap-4 p-4`}>
              <div className="text-4xl">{u.icon}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2"><b className="text-white">{u.name}</b><span className="text-xs text-cyan-300">{"■".repeat(lvl)}{"□".repeat(u.max - lvl)}</span></div>
                <p className="text-xs text-slate-400">{u.desc}</p>
              </div>
              <Btn kind={maxed ? "ghost" : "gold"} disabled={maxed || save.insight < cost} onClick={() => buy(u.id, cost)}>{maxed ? "MAX" : `✦ ${cost}`}</Btn>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}

export function SettingsPanel({ save, onChange }: { save: Save; onChange: () => void }) {
  const s = save.set;
  const apply = () => { audio.setVolumes(s, s.muted); persist(save); onChange(); };
  const slider = (label: string, key: "master" | "music" | "sfx") => (
    <label className="block">
      <div className="flex justify-between text-sm text-slate-300"><span>{label}</span><span>{Math.round(s[key] * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.05} value={s[key]} onChange={(e) => { s[key] = parseFloat(e.target.value); apply(); }} onPointerUp={() => audio.sfx("beep")} className="w-full accent-cyan-400" />
    </label>
  );
  const toggle = (label: string, v: boolean, f: () => void) => (
    <button onClick={() => { f(); apply(); }} className="flex w-full items-center justify-between rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
      <span>{label}</span><span className={v ? "text-emerald-300" : "text-slate-500"}>{v ? "ON" : "OFF"}</span>
    </button>
  );
  return (
    <div className="space-y-3">
      {slider("Master volume", "master")}
      {slider("Music", "music")}
      {slider("Sound effects", "sfx")}
      {toggle("Mute all audio (M)", s.muted, () => (s.muted = !s.muted))}
      {toggle("Screen shake", s.shake, () => (s.shake = !s.shake))}
      {toggle("Tutorial hints (Case 1)", s.tutorial, () => (s.tutorial = !s.tutorial))}
    </div>
  );
}

export function SettingsScreen({ save, onBack, onChange }: { save: Save; onBack: () => void; onChange: () => void }) {
  return (
    <Screen>
      <div className={`${panel} p-6`}>
        <h2 className="mb-4 text-2xl font-black tracking-[0.2em] text-cyan-200">SETTINGS</h2>
        <SettingsPanel save={save} onChange={onChange} />
        <div className="mt-5 flex gap-3">
          <Btn kind="danger" onClick={() => { if (confirm("Erase all progress, upgrades and Insight?")) { save.insight = 0; save.ups = {}; save.solved = {}; save.seen = {}; persist(save); onChange(); } }}>RESET PROGRESS</Btn>
          <Btn className="flex-1" onClick={onBack}>← BACK</Btn>
        </div>
      </div>
    </Screen>
  );
}

export function HelpContent() {
  const row = (k: string, d: string) => (<tr key={k}><td className="whitespace-nowrap pr-4 font-mono text-amber-200">{k}</td><td className="text-slate-300">{d}</td></tr>);
  return (
    <div className="space-y-4 text-sm text-slate-300">
      <section>
        <h3 className="mb-1 font-bold tracking-widest text-cyan-300">THE PREMISE</h3>
        <p>You relive the same two hours on Meridian Zero Station. At a fixed time someone is murdered, and the clock snaps back to 19:00. Only you remember. Each loop spends one of a limited number of <b>rewinds</b>. Use them to learn, prove, and stop the crime.</p>
      </section>
      <section>
        <h3 className="mb-1 font-bold tracking-widest text-cyan-300">HOW A CASE WORKS</h3>
        <ul className="list-disc space-y-1 pl-5">
          <li><b>Schedules:</b> every crew member follows a fixed routine. Watch them; the <b>Timeline</b> tab in your Journal records what you've seen. Hold <b>F</b> to fast-forward while standing still.</li>
          <li><b>Knowledge:</b> codes, overheard secrets and testimony persist across loops in your Journal. Items and physical changes do not (unless you own a Chrono-Pocket).</li>
          <li><b>Gated actions:</b> hack terminals, crack safes, pick locks, flip breakers — but only when nobody is watching. Actions cost station minutes.</li>
          <li><b>Suspicion:</b> being seen doing something illicit, or lingering in a RESTRICTED room under eyes or cameras, raises suspicion. At 70% Sgt. Quill hunts you; if she touches you the loop ends.</li>
          <li><b>Trust:</b> small talk (+1) and gifts like coffee (+2) open up testimony. Trust resets each loop — but you remember what works.</li>
          <li><b>Blackouts:</b> power failures kill cameras and unlock doors — and send crew running toward the problem.</li>
          <li><b>The confrontation:</b> collect Means, Motive and Opportunity evidence, then Confront the killer. In the interrogation, present the evidence that contradicts each lie. Let true statements slide. Wrong moves cost composure.</li>
          <li><b>Insight</b> (earned from discoveries and solving cases) buys permanent upgrades in the Archive.</li>
        </ul>
      </section>
      <section>
        <h3 className="mb-1 font-bold tracking-widest text-cyan-300">CONTROLS</h3>
        <table className="w-full"><tbody>
          {row("WASD / Arrows", "Move")}
          {row("Shift", "Sprint (louder near observers)")}
          {row("Mouse click", "Walk to a point / click an object or person to interact")}
          {row("E / Enter", "Interact with the highlighted object or person")}
          {row("1-9", "Pick menu options, topics or evidence")}
          {row("J / Tab", "Journal: evidence, notes, timeline, cast")}
          {row("F (hold)", "Fast-forward time (while standing still)")}
          {row("Q", "Sensor Pulse (after buying the upgrade)")}
          {row("Space / Enter", "Set a tumbler in lock picking")}
          {row("X", "Let a statement slide in interrogations")}
          {row("H", "Open this help")}
          {row("M", "Mute / unmute")}
          {row("Esc", "Pause / close windows")}
          {row("Touch", "On-screen stick + E button; tap to walk")}
          {row("Gamepad", "Left stick move · A interact · Y journal · X pulse · Start pause")}
        </tbody></table>
      </section>
    </div>
  );
}

export function HelpScreen({ onBack }: { onBack: () => void }) {
  return (
    <Screen>
      <div className={`${panel} p-6`}>
        <h2 className="mb-4 text-2xl font-black tracking-[0.2em] text-cyan-200">HOW TO PLAY</h2>
        <HelpContent />
        <div className="mt-5"><Btn className="w-full" onClick={onBack}>← BACK</Btn></div>
      </div>
    </Screen>
  );
}

export function Pause({ g, onQuit }: { g: Game; onQuit: () => void }) {
  const [view, setView] = useState<"main" | "help" | "settings">(g.overlay === "help" ? "help" : g.overlay === "settings" ? "settings" : "main");
  const [confirm, setConfirm] = useState<"" | "rewind" | "quit">("");
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className={`${panel} max-h-full w-full max-w-lg overflow-auto p-6`}>
        {view === "main" && (
          <>
            <h2 className="mb-1 text-center text-2xl font-black tracking-[0.3em] text-cyan-200">PAUSED</h2>
            <p className="mb-4 text-center text-xs text-slate-400">{g.cd.title} · Loop {g.loopNo}/{g.pool} · {g.modLabel() || "no modifiers"}</p>
            <div className="flex flex-col gap-3">
              <Btn kind="gold" onClick={() => { g.overlay = null; g.notify(); }}>▶ RESUME</Btn>
              <Btn onClick={() => { g.overlay = "journal"; g.stats.journal = true; g.notify(); }}>📓 JOURNAL</Btn>
              <Btn kind="ghost" onClick={() => setView("help")}>HOW TO PLAY / CONTROLS</Btn>
              <Btn kind="ghost" onClick={() => setView("settings")}>SETTINGS</Btn>
              {confirm === "rewind" ? (
                <div className="flex gap-2"><Btn kind="danger" className="flex-1" onClick={() => { g.overlay = null; g.startRewind("manual"); }}>Spend a loop</Btn><Btn kind="ghost" onClick={() => setConfirm("")}>Cancel</Btn></div>
              ) : <Btn kind="ghost" onClick={() => setConfirm("rewind")}>⟲ REWIND NOW (costs a loop)</Btn>}
              {confirm === "quit" ? (
                <div className="flex gap-2"><Btn kind="danger" className="flex-1" onClick={onQuit}>Abandon case</Btn><Btn kind="ghost" onClick={() => setConfirm("")}>Cancel</Btn></div>
              ) : <Btn kind="danger" onClick={() => setConfirm("quit")}>✖ ABANDON CASE</Btn>}
            </div>
          </>
        )}
        {view === "help" && (<><h2 className="mb-3 text-xl font-black tracking-[0.2em] text-cyan-200">HOW TO PLAY</h2><HelpContent /><Btn className="mt-4 w-full" onClick={() => setView("main")}>← BACK</Btn></>)}
        {view === "settings" && (<><h2 className="mb-3 text-xl font-black tracking-[0.2em] text-cyan-200">SETTINGS</h2><SettingsPanel save={g.save} onChange={() => g.notify()} /><Btn className="mt-4 w-full" onClick={() => setView("main")}>← BACK</Btn></>)}
      </div>
    </div>
  );
}

function fmtDur(s: number) { return `${Math.floor(s / 60)}m ${Math.floor(s % 60)}s`; }
function StatGrid({ g }: { g: Game }) {
  const items: [string, string | number][] = [
    ["Loops used", `${g.loopNo}/${g.pool}`], ["Evidence", `${g.evidenceKnown().length}/${g.cd.evidence.length}`], ["Facts learned", g.known.size],
    ["Time in loops", fmtDur(g.stats.playTime)], ["Detentions", g.stats.detained], ["Wrong moves", g.stats.wrong + g.stats.falseAcc],
    ["Hints used", g.hintsUsed], ["Murders witnessed", g.stats.crimes], ["Insight earned", `✦ ${g.runInsight}`],
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(([k, v]) => (<div key={k} className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-center"><div className="text-lg font-bold text-white">{v}</div><div className="text-[10px] uppercase tracking-widest text-slate-400">{k}</div></div>))}
    </div>
  );
}

export function Victory({ g, onNext, onMenu }: { g: Game; onNext: (() => void) | null; onMenu: () => void }) {
  const rank = g.endReason;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-auto bg-[radial-gradient(ellipse_at_center,#0b2a2a,#02080c_75%)] p-4">
      <div className={`${panel} w-full max-w-xl p-6 text-center`}>
        <div className="text-xs uppercase tracking-[0.5em] text-emerald-300">{g.cd.final ? "The loop is broken" : "Case closed"}</div>
        <h2 className="mt-1 text-4xl font-black text-white">{g.cd.final ? "FREEDOM" : "SOLVED"}</h2>
        <div className="my-3 text-6xl font-black text-amber-300 drop-shadow-[0_0_20px_rgba(255,209,102,0.6)]">{rank}</div>
        <p className="mb-4 text-slate-300">{g.cd.winText}</p>
        <StatGrid g={g} />
        <div className="mt-5 flex flex-col gap-2">
          {onNext && <Btn kind="gold" onClick={onNext}>NEXT CASE ▶</Btn>}
          <Btn onClick={onMenu}>{g.cd.final ? "RETURN TO CASE FILES (REPLAY ON HARDER SETTINGS)" : "CASE FILES"}</Btn>
        </div>
      </div>
    </div>
  );
}

export function GameOver({ g, onRetry, onMenu }: { g: Game; onRetry: () => void; onMenu: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center overflow-auto bg-[radial-gradient(ellipse_at_center,#2a0b12,#05020a_75%)] p-4">
      <div className={`${panel} w-full max-w-xl border-red-500/40 p-6 text-center`}>
        <div className="text-xs uppercase tracking-[0.5em] text-red-300">Timeline collapsed</div>
        <h2 className="mt-1 text-4xl font-black text-white">GAME OVER</h2>
        <p className="my-3 text-slate-300">The loop frayed beyond repair. {g.cd.title === "Loop Zero" ? "The killer's day goes on forever." : "The murder stands. Time moves on without you."} Insight you gained is kept — spend it in the Archive and try again.</p>
        <StatGrid g={g} />
        <div className="mt-5 flex flex-col gap-2"><Btn kind="gold" onClick={onRetry}>↻ RETRY CASE</Btn><Btn onClick={onMenu}>CASE FILES</Btn></div>
      </div>
    </div>
  );
}
