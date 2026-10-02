import { useState } from "react";
import { DIFFS, HELP_SECTIONS, KEYS_REF, MODS, SHIFTS, STORY_RANKS, UPGRADES, type DiffId, type ModId } from "../game/data";
import type { ShiftResult } from "../game/sim";
import type { SaveData, Settings } from "../game/storage";
import { Btn, Panel, Slider, Toggle, cx } from "./ui";

export const totalStars = (s: SaveData) => s.stars.reduce((a, b) => a + b, 0);

export const rankOf = (s: SaveData) => STORY_RANKS[Math.min(STORY_RANKS.length - 1, Math.floor(totalStars(s) / 4))];
export const isUnlocked = (s: SaveData, id: number) => {
  if (id <= 1) return true;
  if (id === 0) return true;
  if (id === 8) return s.stars[7] > 0;
  return s.stars[id - 1] > 0;
};

// ---------------- Settings ----------------
export function SettingsPanel(p: { settings: Settings; onChange: (v: Partial<Settings>) => void; liveDiff?: boolean; onWipe?: () => void }) {
  const s = p.settings;
  const [confirm, setConfirm] = useState(false);
  return (
    <div>
      <Slider label="Master volume" value={s.master} onChange={(v) => p.onChange({ master: v })} />
      <Slider label="Music" value={s.music} onChange={(v) => p.onChange({ music: v })} />
      <Slider label="Sound effects" value={s.sfx} onChange={(v) => p.onChange({ sfx: v })} />
      <div className="flex flex-wrap gap-2 my-3">
        <Toggle on={s.muted} tone="red" onClick={() => p.onChange({ muted: !s.muted })}>{s.muted ? "🔇 Muted" : "🔊 Sound on"}</Toggle>
        <Toggle on={s.shake} onClick={() => p.onChange({ shake: !s.shake })}>Screen shake {s.shake ? "ON" : "OFF"}</Toggle>
      </div>
      <div className="text-[11px] uppercase tracking-widest text-cyan-400 mb-1">{p.liveDiff ? "Difficulty (applies immediately)" : "Default difficulty"}</div>
      <div className="grid gap-1.5">
        {(Object.keys(DIFFS) as DiffId[]).map((d) => (
          <Btn key={d} tone="cyan" active={s.diff === d} onClick={() => p.onChange({ diff: d })} className="text-left">
            <div className="font-bold">{DIFFS[d].name} <span className="text-[10px] font-normal opacity-70">· payout ×{DIFFS[d].credit}</span></div>
            <div className="text-[11px] font-normal opacity-80">{DIFFS[d].desc}</div>
          </Btn>
        ))}
      </div>
      {p.onWipe && (
        <div className="mt-4 border-t border-slate-700 pt-3">
          {confirm ? (
            <div className="flex gap-2 items-center"><span className="text-xs text-red-300">Erase all progress?</span><Btn small tone="red" onClick={() => { p.onWipe?.(); setConfirm(false); }}>Yes, erase</Btn><Btn small tone="slate" onClick={() => setConfirm(false)}>Cancel</Btn></div>
          ) : <Btn small tone="red" onClick={() => setConfirm(true)}>Reset career</Btn>}
        </div>
      )}
    </div>
  );
}

// ---------------- Help ----------------
export function HelpPanel() {
  const [i, setI] = useState(0);
  const sections = [...HELP_SECTIONS.map((h) => h.title), "Controls"];
  return (
    <div>
      <h2 className="text-xl font-black text-white mb-2">Operator's Handbook</h2>
      <div className="flex flex-wrap gap-1 mb-3">
        {sections.map((t, k) => <Btn key={t} small active={i === k} onClick={() => setI(k)}>{t}</Btn>)}
      </div>
      {i < HELP_SECTIONS.length ? (
        <div className="space-y-2 text-sm text-slate-300 leading-relaxed">{HELP_SECTIONS[i].body.map((b) => <p key={b}>{b}</p>)}</div>
      ) : (
        <div className="text-sm">
          <table className="w-full"><tbody>
            {KEYS_REF.map(([k, v]) => <tr key={k} className="border-b border-slate-800"><td className="py-1 pr-3 font-mono text-cyan-300 whitespace-nowrap">{k}</td><td className="py-1 text-slate-300">{v}</td></tr>)}
          </tbody></table>
        </div>
      )}
    </div>
  );
}

// ---------------- Title ----------------
export function TitleScreen(p: { save: SaveData; go: (s: "campaign" | "shop" | "help" | "settings") => void; onTutorial: () => void }) {
  const s = p.save;
  return (
    <div className="relative h-full w-full overflow-auto bg-[#040a10] flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 35%, rgba(34,211,238,0.14), transparent 55%), radial-gradient(circle at 80% 90%, rgba(251,191,36,0.07), transparent 40%)" }} />
      <div className="absolute inset-0 pointer-events-none opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#5cc 1px, transparent 1px), linear-gradient(90deg, #5cc 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div className="relative z-10 w-full max-w-xl text-center">
        <svg viewBox="0 0 120 120" className="w-28 h-28 mx-auto mb-2">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#164e63" strokeWidth="3" />
          <circle cx="60" cy="60" r="38" fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="6 6" opacity="0.7"><animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="12s" repeatCount="indefinite" /></circle>
          <circle cx="60" cy="60" r="22" fill="#0e7490" opacity="0.5"><animate attributeName="r" values="20;26;20" dur="2.4s" repeatCount="indefinite" /></circle>
          <circle cx="60" cy="60" r="10" fill="#67e8f9"><animate attributeName="opacity" values="1;0.5;1" dur="1.6s" repeatCount="indefinite" /></circle>
          {[0, 120, 240].map((a) => <path key={a} d="M60 60 L60 22 A38 38 0 0 1 93 41 Z" fill="#fbbf24" opacity="0.8" transform={`rotate(${a} 60 60)`} />)}
        </svg>
        <div className="text-[11px] tracking-[0.5em] text-cyan-400 uppercase">Unit 2 · Pressurized Water Reactor</div>
        <h1 className="text-4xl sm:text-5xl font-black text-white mt-1 leading-tight" style={{ textShadow: "0 0 24px rgba(34,211,238,0.5)" }}>REACTOR<br />SHIFT SUPERVISOR</h1>
        <p className="text-slate-400 text-sm mt-2">Follow the grid. Respect the xenon. Never lose the core.</p>
        <div className="grid gap-2 mt-6 max-w-sm mx-auto">
          <Btn tone="green" className="py-3 text-base" onClick={() => p.go("campaign")}>▶ {totalStars(s) > 0 ? "Continue career" : "Start career"}</Btn>
          <Btn tone={s.tutorialDone ? "slate" : "amber"} onClick={p.onTutorial}>🎓 Orientation shift (interactive tutorial){s.tutorialDone ? " ✔" : " — recommended"}</Btn>
          <Btn onClick={() => p.go("shop")}>🏢 Plant Office — upgrades <span className="text-amber-300">({s.credits}¢)</span></Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn tone="slate" onClick={() => p.go("help")}>❓ How to play</Btn>
            <Btn tone="slate" onClick={() => p.go("settings")}>⚙ Settings</Btn>
          </div>
        </div>
        <div className="mt-6 text-xs text-slate-500 font-mono">
          Rank: <span className="text-cyan-300">{rankOf(s)}</span> · ★ {totalStars(s)}/24 · Shifts {s.stats.shifts} · Scrams {s.stats.scrams} · Meltdowns {s.stats.meltdowns}
          {s.bestEndless > 0 && <> · Endless best {s.bestEndless.toFixed(1)} h</>}
        </div>
      </div>
    </div>
  );
}

// ---------------- Campaign ----------------
export function CampaignScreen(p: {
  save: SaveData; settings: Settings; onSettings: (v: Partial<Settings>) => void; onBack: () => void; onStart: (id: number, mods: ModId[]) => void; initial?: number;
}) {
  const firstOpen = () => {
    for (let i = 1; i <= 7; i++) if (p.save.stars[i] === 0) return i;
    return 7;
  };
  const [sel, setSel] = useState(p.initial ?? firstOpen());
  const [mods, setMods] = useState<ModId[]>(p.settings.mods);
  const sh = SHIFTS[sel];
  const diff = DIFFS[p.settings.diff];
  const modBonus = mods.length * 0.2;
  const toggleMod = (m: ModId) => {
    const n = mods.includes(m) ? mods.filter((x) => x !== m) : [...mods, m];
    setMods(n); p.onSettings({ mods: n });
  };
  const quota = Math.min(0.95, sh.quota * diff.quota);
  return (
    <div className="h-full w-full overflow-auto bg-[#050c12] p-3 md:p-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-black text-white tracking-wide">Shift Roster</h2>
          <div className="flex gap-2 items-center"><span className="text-amber-300 font-mono text-sm">{p.save.credits}¢</span><Btn tone="slate" onClick={p.onBack}>← Menu</Btn></div>
        </div>
        <div className="grid md:grid-cols-[1fr_1.1fr] gap-4">
          <div className="grid gap-2 content-start">
            {SHIFTS.slice(1).map((s) => {
              const open = isUnlocked(p.save, s.id);
              const st = p.save.stars[s.id];
              return (
                <button key={s.id} type="button" disabled={!open} onClick={() => setSel(s.id)}
                  className={cx("text-left rounded-lg border p-2.5 transition", sel === s.id ? "border-cyan-300 bg-cyan-500/15" : "border-slate-700 bg-slate-900/50 hover:border-cyan-600", !open && "opacity-40 cursor-not-allowed")}>
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-sm text-white">{open ? "" : "🔒 "}{s.endless ? "∞" : s.id}. {s.name}{s.boss && <span className="ml-2 text-[10px] text-red-300 border border-red-500 rounded px-1">CAPSTONE</span>}</div>
                    <div className="text-amber-300 text-sm tracking-widest">{s.endless ? (p.save.bestEndless > 0 ? `${p.save.bestEndless.toFixed(1)}h` : "—") : "★".repeat(st) + "☆".repeat(3 - st)}</div>
                  </div>
                  <div className="text-[11px] text-slate-400">{s.subtitle}{!open && " · clear the previous shift to unlock"}</div>
                </button>
              );
            })}
          </div>
          <Panel title={`Briefing — ${sh.name}`} className="h-fit">
            <div className="text-sm text-slate-300 leading-relaxed">{sh.brief}</div>
            <ul className="mt-2 text-xs text-amber-100/90 list-disc pl-5 space-y-0.5">{sh.tips.map((t) => <li key={t}>{t}</li>)}</ul>
            <div className="text-xs text-slate-400 mt-2 font-mono">{sh.endless ? "Unlimited length" : `${(sh.duration / 30).toFixed(0)} h shift (${sh.duration} s)`}{!sh.boss && !sh.endless && ` · grid quota ${(quota * 100).toFixed(0)}%`}{sh.boss && " · survival objective"}</div>
            <div className="mt-3 text-[11px] uppercase tracking-widest text-cyan-400">Difficulty</div>
            <div className="grid grid-cols-3 gap-1.5 mt-1">
              {(Object.keys(DIFFS) as DiffId[]).map((d) => <Btn key={d} small active={p.settings.diff === d} onClick={() => p.onSettings({ diff: d })} title={DIFFS[d].desc}>{DIFFS[d].name}<div className="text-[9px] opacity-70">×{DIFFS[d].credit}</div></Btn>)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">{diff.desc}</div>
            <div className="mt-3 text-[11px] uppercase tracking-widest text-cyan-400">Modifiers <span className="normal-case text-amber-300">(+20% payout each, now ×{(diff.credit * (1 + modBonus)).toFixed(2)})</span></div>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {MODS.map((m) => <Toggle key={m.id} on={mods.includes(m.id)} tone="amber" onClick={() => toggleMod(m.id)} title={m.desc}>{m.name}</Toggle>)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">{mods.length ? mods.map((m) => MODS.find((x) => x.id === m)!.desc).join(" ") : "No modifiers — standard rules."}</div>
            <Btn tone="green" className="w-full mt-4 py-3 text-base" onClick={() => p.onStart(sh.id, mods)}>▶ Begin shift</Btn>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ---------------- Shop ----------------
export function ShopScreen(p: { save: SaveData; onBuy: (id: string) => void; onBack: () => void }) {
  return (
    <div className="h-full w-full overflow-auto bg-[#050c12] p-3 md:p-5">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-2xl font-black text-white tracking-wide">Plant Office</h2>
            <div className="text-xs text-slate-400">Spend shift earnings on plant upgrades. Effects apply to every future shift.</div>
          </div>
          <div className="flex gap-2 items-center"><span className="text-amber-300 font-mono text-lg">{p.save.credits}¢</span><Btn tone="slate" onClick={p.onBack}>← Back</Btn></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {UPGRADES.map((u) => {
            const lvl = p.save.upgrades[u.id] || 0;
            const maxed = lvl >= u.max;
            const cost = u.costs[lvl];
            return (
              <div key={u.id} className="rounded-lg border border-cyan-900/70 bg-[#0a141c] p-3">
                <div className="flex justify-between items-start">
                  <div className="font-bold text-white">{u.icon} {u.name}</div>
                  <div className="flex gap-1">{Array.from({ length: u.max }, (_, i) => <span key={i} className={cx("w-3 h-3 rounded-sm border", i < lvl ? "bg-cyan-400 border-cyan-200" : "border-slate-600")} />)}</div>
                </div>
                <div className="text-xs text-slate-400 mt-1 min-h-[32px]">{u.desc}</div>
                <Btn tone="amber" className="w-full mt-2" disabled={maxed || p.save.credits < cost} onClick={() => p.onBuy(u.id)} silent>
                  {maxed ? "MAX LEVEL" : `Buy level ${lvl + 1} — ${cost}¢`}
                </Btn>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- Result ----------------
const FAIL_TEXT: Record<string, [string, string]> = {
  meltdown: ["CORE MELTDOWN", "Fuel temperature stayed above damage limits until the core melted. Keep coolant flowing, keep the core covered (ECCS), and SCRAM early."],
  breach: ["CONTAINMENT BREACH", "Building pressure passed 4 bar. Use containment spray, isolate leaks quickly, and vent (filtered) only as a last resort."],
  rupture: ["VESSEL RUPTURE", "Primary pressure exceeded 200 bar. Spray, open the steam path, and don't run hot and dry."],
  license: ["LICENSE REVOKED", "Regulator compliance hit zero after repeated limit violations and releases."],
  abort: ["SHIFT ABORTED", ""],
};

export function ResultScreen(p: {
  result: ShiftResult; save: SaveData; credited: number; hasNext: boolean; onRetry: () => void; onNext: () => void; onMenu: () => void; onShop: () => void; onEndless: () => void; firstCapstone: boolean;
}) {
  const r = p.result;
  const shift = SHIFTS[r.shiftId];
  const complete = r.outcome === "complete" || r.outcome === "tutorial";
  let title = "SHIFT COMPLETE", sub = "The oncoming crew takes the conn.", good = true;
  if (r.outcome === "tutorial") { title = "TRAINING COMPLETE"; sub = "You're certified for supervised operation."; }
  else if (complete && r.success && shift.boss) { title = "BLACK SWAN SURVIVED"; sub = "The plant is safe. Your career is complete — Chief Nuclear Officer."; }
  else if (complete && !r.quotaMet) { title = "QUOTA MISSED"; sub = `Grid compliance ${(r.gridPct * 100).toFixed(0)}% — needed ${(r.quota * 100).toFixed(0)}%. The plant survived but the utility is furious.`; good = false; }
  else if (!complete) { [title, sub] = FAIL_TEXT[r.outcome] || ["SHIFT FAILED", ""]; good = false; }
  const rows: [string, string][] = [
    ["Shift time", `${r.hours.toFixed(1)} h`],
    ["Grid compliance", shift.boss || shift.tutorial ? "—" : `${(r.gridPct * 100).toFixed(0)}% (need ${(r.quota * 100).toFixed(0)}%)`],
    ["Energy delivered", `${r.mwh.toFixed(0)} MWh`],
    ["Net revenue", `$${r.revenue.toFixed(0)}k`],
    ["Reactor trips", String(r.scrams)],
    ["Min compliance", `${r.minCompliance.toFixed(0)}%`],
    ["Peak power", `${(r.peakP * 100).toFixed(0)}%`],
    ["Peak fuel temp", `${r.peakTf.toFixed(0)} °C`],
    ["Peak containment", `${r.peakPc.toFixed(2)} bar`],
    ["Fuel integrity", `${(r.fuel * 100).toFixed(1)}%`],
    ["Activity released", r.release.toFixed(1)],
    ["Repairs / alarms", `${r.repairs} / ${r.alarms}`],
    ["Difficulty", DIFFS[r.diff].name],
    ["Score", String(r.score)],
  ];
  return (
    <div className="h-full w-full overflow-auto bg-[#050c12] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-xl border bg-[#08121a] p-5 shadow-2xl" style={{ borderColor: good ? "#10b981" : "#ef4444", boxShadow: `0 0 40px ${good ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.3)"}` }}>
        <div className="text-center">
          <div className="text-[11px] tracking-[0.4em] text-slate-400 uppercase">{shift.name}</div>
          <h2 className={cx("text-3xl sm:text-4xl font-black tracking-wider mt-1", good ? "text-emerald-300" : "text-red-400")}>{title}</h2>
          <p className="text-sm text-slate-300 mt-2">{sub}</p>
          {r.success && r.outcome !== "tutorial" && <div className="text-4xl text-amber-300 tracking-[0.3em] mt-3">{"★".repeat(r.stars)}<span className="text-slate-700">{"☆".repeat(3 - r.stars)}</span></div>}
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-4 text-sm font-mono">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-slate-800 py-0.5"><span className="text-slate-400">{k}</span><span className="text-cyan-100">{v}</span></div>)}
        </div>
        <div className="mt-3 text-center text-amber-300 font-bold">+{p.credited}¢ earned <span className="text-slate-500 font-normal">· balance {p.save.credits}¢</span></div>
        {shift.endless && <div className="text-center text-xs text-cyan-300 mt-1">Best endless run: {p.save.bestEndless.toFixed(1)} h</div>}
        {p.firstCapstone && (
          <div className="mt-3 rounded-lg border border-amber-400/60 bg-amber-950/30 p-3 text-sm text-amber-100">
            🏆 <b>Victory!</b> You brought the plant through the Black Swan. The <b>Endless Shift</b> is now unlocked — see how many hours you can last.
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-2 mt-5">
          {r.success && p.hasNext && r.outcome !== "tutorial" && <Btn tone="green" onClick={p.onNext}>Next shift ▶</Btn>}
          {r.success && r.outcome === "tutorial" && <Btn tone="green" onClick={p.onNext}>Begin Shift 1 ▶</Btn>}
          {r.success && shift.boss && <Btn tone="purple" onClick={p.onEndless}>∞ Endless shift</Btn>}
          <Btn tone="amber" onClick={p.onRetry}>↻ {r.success ? "Replay for better score" : "Retry shift"}</Btn>
          <Btn onClick={p.onShop}>🏢 Plant Office</Btn>
          <Btn tone="slate" onClick={p.onMenu}>Main menu</Btn>
        </div>
      </div>
    </div>
  );
}
