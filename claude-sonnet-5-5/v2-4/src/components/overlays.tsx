import { useState } from "react";
import { CITIES, DIFFS, fmt, MODS } from "../game/data";
import { getEventDef, resolveEvent } from "../game/events";
import type { computeResult } from "../game/sim";
import type { Settings } from "../game/storage";
import type { Sim } from "../game/types";
import { Chart } from "./panels";
import { ControlsTable, HelpContent, Modal, SettingsPanel } from "./ui";
import { audio } from "../game/audio";

export function EventModal({ s, bump }: { s: Sim; bump: () => void }) {
  const ev = s.pendingEvent;
  if (!ev) return null;
  const def = getEventDef(ev.id);
  const d = s.districts[ev.did];
  if (!def || !d) return null;
  return (
    <Modal z={40}>
      <div className="text-center">
        <div className="text-5xl mb-1">{def.icon}</div>
        <div className="font-title text-xl text-[#e0a53f]">{def.title}</div>
        <div className="text-xs text-[#a8977a] font-ui mb-2">Day {s.day} · {d.name}</div>
        <p className="text-[#e8d9b5] mb-4 italic">{def.text(s, d)}</p>
      </div>
      <div className="flex flex-col gap-2">
        {def.choices.map((c, i) => {
          const ok = !c.can || c.can(s);
          return (
            <button key={i} className="btn text-left" disabled={!ok} onClick={() => { resolveEvent(s, i); bump(); }}>
              <div className="font-title">{c.label}</div>
              <div className="text-xs text-[#a8977a] font-normal" style={{ fontFamily: "IM Fell English, serif" }}>{ok ? c.desc : `${c.desc} (unavailable)`}</div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

export function PauseMenu({ s, settings, onSettings, onResume, onRestart, onQuit, bump }: {
  s: Sim; settings: Settings; onSettings: (s: Settings) => void; onResume: () => void; onRestart: () => void; onQuit: () => void; bump: () => void;
}) {
  const [tab, setTab] = useState<"menu" | "settings" | "help" | "controls">("menu");
  const [confirm, setConfirm] = useState<"restart" | "quit" | null>(null);
  return (
    <Modal wide={tab === "help"} onClose={onResume} z={60}>
      <div className="flex gap-1 mb-3 flex-wrap">
        {(["menu", "settings", "controls", "help"] as const).map((t) => (
          <button key={t} className={`btn !py-1 ${tab === t ? "btn-on" : ""}`} onClick={() => { setTab(t); setConfirm(null); audio.sfx("click"); }}>
            {t === "menu" ? "⏸ Paused" : t === "settings" ? "⚙ Settings" : t === "controls" ? "⌨ Controls" : "❓ Help"}
          </button>
        ))}
      </div>
      {tab === "menu" && (
        <div>
          <div className="text-sm text-[#a8977a] mb-1 font-ui">Difficulty (changes apply immediately)</div>
          <div className="grid grid-cols-2 gap-1 mb-4">
            {DIFFS.map((d) => (
              <button key={d.id} className={`btn !py-1 ${s.cfg.diffId === d.id ? "btn-on" : ""}`} style={{ color: d.color }} onClick={() => { s.cfg.diffId = d.id; bump(); audio.sfx("click"); }}>{d.name}</button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <button className="btn btn-primary" onClick={onResume}>▶ Resume</button>
            {confirm === "restart" ? (
              <div className="flex gap-2"><button className="btn flex-1 btn-primary" onClick={onRestart}>Yes, restart the city</button><button className="btn" onClick={() => setConfirm(null)}>No</button></div>
            ) : <button className="btn" onClick={() => setConfirm("restart")}>↻ Restart this city</button>}
            {confirm === "quit" ? (
              <div className="flex gap-2"><button className="btn flex-1 btn-primary" onClick={onQuit}>Yes, abandon the vigil</button><button className="btn" onClick={() => setConfirm(null)}>No</button></div>
            ) : <button className="btn" onClick={() => setConfirm("quit")}>⌂ Quit to title</button>}
          </div>
        </div>
      )}
      {tab === "settings" && <SettingsPanel settings={settings} onChange={onSettings} />}
      {tab === "controls" && <ControlsTable />}
      {tab === "help" && <HelpContent />}
    </Modal>
  );
}

export function EndScreen({ s, result, lp, unlocked, onRetry, onNext, onMap, onTitle }: {
  s: Sim; result: ReturnType<typeof computeResult>; lp: number; unlocked: string | null;
  onRetry: () => void; onNext: (() => void) | null; onMap: () => void; onTitle: () => void;
}) {
  const o = s.over!;
  const st = s.stats;
  const t = result.totals;
  const rows: [string, string][] = [
    ["Days endured", String(s.day)],
    ["Survivors", `${fmt(t.alive)} (${Math.round(result.survivors * 100)}%)`],
    ["Dead", fmt(t.dead)],
    ["Peak active infections", fmt(st.peakActive)],
    ["Total infected", fmt(st.totalInfected)],
    ["Recovered", fmt(st.recovered)],
    ["Hospitals built", String(st.hospBuilt)],
    ["Districts sealed", String(st.quarantines)],
    ["Contact traces", String(st.traces)],
    ["Roads barricaded", String(st.roadsClosed)],
    ["Events decided", String(st.events)],
    ["Research completed", String(st.researchDone)],
    ["Riots", String(st.riots)],
    ["Lowest trust", String(Math.round(st.minTrust))],
    ["Cures given", String(st.cures)],
    ["Peak panic", `${Math.round(st.peakPanic)}%`],
  ];
  return (
    <Modal wide z={70}>
      <div className="text-center">
        <div className="text-5xl">{o.win ? "🕊️" : "💀"}</div>
        <h2 className="font-title font-black text-3xl mt-1" style={{ color: o.win ? "#8fcf74" : "#d8452f" }}>{o.win ? "VICTORY" : "DEFEAT"}</h2>
        <div className="font-title text-xl text-[#e8d9b5]">{o.title}</div>
        <p className="italic text-[#cdbd9a] mt-1 mb-2 max-w-xl mx-auto">{o.reason}</p>
        {o.win && <div className="text-3xl text-[#e0a53f] tracking-widest anim-pop">{[0, 1, 2].map((i) => (i < result.stars ? "★" : "☆"))}</div>}
        <div className="font-ui text-sm text-[#a8977a]">{CITIES[s.cfg.cityIdx].name} · {DIFFS.find((d) => d.id === s.cfg.diffId)?.name}{s.cfg.mods.length ? ` · ${s.cfg.mods.map((m) => MODS.find((x) => x.id === m)?.name).join(", ")}` : ""}</div>
      </div>
      <div className="grid sm:grid-cols-2 gap-4 mt-3">
        <div>
          <div className="card p-2 text-center mb-2">
            <div className="text-xs text-[#a8977a] font-ui">SCORE (x{result.mult.toFixed(2)})</div>
            <div className="font-title text-3xl text-[#e0a53f]">{result.score.toLocaleString()}</div>
            <div className="text-sm text-[#8fcf74]">+{lp} Legacy Points</div>
            {unlocked && <div className="text-sm text-[#55b3b0] mt-1 anim-pulse">🔓 Unlocked: {unlocked}</div>}
          </div>
          <Chart s={s} showActual />
        </div>
        <div className="card p-2 text-[13px]">
          {rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-[#2a2118] py-0.5"><span className="text-[#a8977a]">{k}</span><span className="font-ui">{v}</span></div>)}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        <button className="btn btn-primary" onClick={onRetry}>↻ {o.win ? "Play again" : "Try again"}</button>
        {onNext && <button className="btn btn-good" onClick={onNext}>Next city →</button>}
        <button className="btn" onClick={onMap}>🗺 City map</button>
        <button className="btn" onClick={onTitle}>⌂ Title</button>
      </div>
    </Modal>
  );
}

export interface TutStep { title: string; text: (s: Sim) => string; done: (s: Sim) => boolean; manual?: boolean }
export const TUT: TutStep[] = [
  { title: "Welcome, Doctor", text: (s) => `Plague has been confirmed in ${s.districts[s.seedId].name}. Click the district pulsing red on the map to select it. Time is frozen until you start it.`, done: (s) => !!s.flags.selectedSeed },
  { title: "Trace the Contagion", text: () => "Press T or click 'Trace contacts'. Tracers reveal the exact numbers, expose which roads carry infection (red arrows), and uncover hidden outbreaks in neighbouring districts.", done: (s) => !!s.flags.traced },
  { title: "Build a Hospital", text: () => "Press H or click 'Build hospital'. Beds isolate the sick and cut deaths, but patients consume medicine. Construction takes 3 days.", done: (s) => !!s.flags.hospital },
  { title: "Let Time Flow", text: () => "Press Space (or the ▶ button) to start time. 1, 2, 3 change speed. Watch the dots on the roads: red ones are plague travelling between districts. Run for a few days.", done: (s) => s.time >= 3 },
  { title: "Calm the People", text: () => "Fear spreads as fast as plague. Select a district and press A for a Public Address. High panic makes people flee, break quarantines, and riot.", done: (s) => !!s.flags.addressed },
  { title: "Seal a District", text: () => "Press Q to quarantine the selected district: roads are cut, but production stops and trust drains. Seal infected wards, not the farms that feed you.", done: (s) => !!s.flags.quarantined },
  { title: "Research a Cure", text: () => "Press R to open Research. Pick a project. Universities generate points; the Cure path (Cure branch) is long, but it wins the war.", done: (s) => !!s.flags.research },
  { title: "Edicts & Supplies", text: () => "Press P to see the Edicts & Ledger. Watch food, medicine and funds balances. Famine, no medicine, or an empty treasury all hurt trust.", done: (s) => !!s.flags.policiesOpen },
  { title: "Your Vigil Begins", text: () => "The plague will mutate, and later the Crimson Mutation will emerge. Eradicate every case after that to win. Lose all trust or 45% of the city and you fail. Good luck, Doctor.", done: () => false, manual: true },
];

export function TutorialCard({ s, onSkip, onFinish }: { s: Sim; onSkip: () => void; onFinish: () => void }) {
  const step = TUT[s.tutStep];
  if (!step) return null;
  return (
    <div className="absolute left-2 right-2 bottom-12 sm:right-auto sm:left-3 sm:bottom-3 sm:max-w-sm card p-3 anim-pop z-20 !border-[#55b3b0]" style={{ boxShadow: "0 0 24px rgba(85,179,176,0.3)" }}>
      <div className="flex justify-between items-center">
        <div className="font-title text-[#55b3b0]">{step.title}</div>
        <div className="text-[11px] text-[#7d6e57] font-ui">{s.tutStep + 1}/{TUT.length}</div>
      </div>
      <p className="text-sm text-[#e8d9b5] my-1.5 leading-snug">{step.text(s)}</p>
      <div className="flex gap-2">
        {step.manual ? <button className="btn btn-good !py-1" onClick={onFinish}>Begin</button> : <button className="btn !py-1 !text-xs" onClick={() => { s.tutStep++; audio.sfx("click"); }}>Skip step</button>}
        <button className="btn !py-1 !text-xs" onClick={onSkip}>Skip tutorial</button>
      </div>
    </div>
  );
}
