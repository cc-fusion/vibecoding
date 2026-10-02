import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { audio } from "../lib/audio";
import { CASE_COUNT } from "../lib/caseGen";
import { DIFFS, MODS, RANKS, THEMES, TRAIT_INFO, UPGRADES } from "../lib/content";
import { G, applyAudioSettings, buyUpgrade, fmtTime, meta, notify, resetAllProgress, saveMeta, upgradeCost, useStore } from "../lib/store";
import type { Settings } from "../lib/types";

export function Modal({ title, onClose, children, wide }: { title: string; onClose?: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm fade-in">
      <div className={`panel w-full ${wide ? "max-w-4xl" : "max-w-xl"} max-h-full overflow-auto`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-2xl font-serif font-semibold text-amber-100">{title}</h2>
          {onClose && <button className="btn btn-ghost !py-1" onClick={onClose}>✕ Close</button>}
        </div>
        {children}
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-24 text-violet-100/80">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 accent-amber-400" />
      <span className="w-10 text-right text-xs">{Math.round(value * 100)}%</span>
    </label>
  );
}

export function DifficultyPicker() {
  useStore();
  const s = meta.settings;
  const set = (patch: Partial<Settings>) => { Object.assign(meta.settings, patch); saveMeta(); audio.play("ui"); notify(); };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {DIFFS.map((d, i) => (
          <button key={d.name} onClick={() => set({ difficulty: i as 0 | 1 | 2 })} className={`btn ${s.difficulty === i ? "btn-gold" : "btn-ghost"} !flex-col !items-start text-left`}>
            <b>{d.name}</b>
            <span className="text-[10px] opacity-80 font-normal leading-tight">{d.desc} x{d.score} score</span>
          </button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {MODS.map((m) => (
          <button key={m.id} onClick={() => set({ mods: { ...s.mods, [m.id]: !s.mods[m.id] } })}
            className={`btn !justify-start text-left ${s.mods[m.id] ? "btn-gold" : "btn-ghost"}`}>
            <span className="text-lg">{m.icon}</span>
            <span className="flex flex-col"><b className="text-xs">{m.name} {s.mods[m.id] ? "(ON)" : ""}</b><span className="text-[10px] font-normal opacity-80">{m.desc} +{Math.round(m.score * 100)}% score</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  useStore();
  const s = meta.settings;
  const [confirm, setConfirm] = useState(false);
  const set = (patch: Partial<Settings>) => { Object.assign(meta.settings, patch); applyAudioSettings(); saveMeta(); notify(); };
  return (
    <Modal title="⚙️ Settings" onClose={onClose}>
      <div className="space-y-3">
        <Slider label="Master" value={s.master} onChange={(v) => set({ master: v })} />
        <Slider label="Music" value={s.music} onChange={(v) => set({ music: v })} />
        <Slider label="Effects" value={s.sfx} onChange={(v) => set({ sfx: v })} />
        <div className="flex gap-2 flex-wrap">
          <button className={`btn ${s.muted ? "btn-danger" : "btn-ghost"}`} onClick={() => set({ muted: !s.muted })}>{s.muted ? "🔇 Muted (M)" : "🔊 Sound on (M)"}</button>
          <button className={`btn ${s.shake ? "btn-gold" : "btn-ghost"}`} onClick={() => set({ shake: !s.shake })}>📳 Screen shake: {s.shake ? "On" : "Off"}</button>
          <button className="btn btn-ghost" onClick={() => { audio.init(); audio.play("found"); }}>🔔 Test sound</button>
        </div>
        <div>
          <div className="text-sm font-semibold text-amber-100 mb-1">Difficulty and modifiers <span className="text-xs text-violet-200/60">(apply live)</span></div>
          <DifficultyPicker />
        </div>
        <div className="pt-2 border-t border-white/10">
          {!confirm ? (
            <button className="btn btn-ghost !text-red-300" onClick={() => setConfirm(true)}>🗑️ Erase all saved progress…</button>
          ) : (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-red-200">Erase upgrades, career and records?</span>
              <button className="btn btn-danger" onClick={() => { resetAllProgress(); setConfirm(false); }}>Yes, erase</button>
              <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function HelpContent() {
  const rows: [string, string][] = [
    ["WASD / Arrows", "Move through the Palace"],
    ["Hold E / Enter", "Examine the glowing object you stand near"],
    ["Space", "Dash (3 Focus, brief invulnerability)"],
    ["Q", "Lucid Pulse: stun intrusions, clear fog, shoot down bullets, restore clarity"],
    ["H", "Intuition hint (limited charges)"],
    ["1 / 2 / 3", "Palace / Deduction Board / Interrogation"],
    ["F", "File an accusation (opens the accusation dialog)"],
    ["Esc / P", "Pause menu"],
    ["M", "Mute or unmute"],
    ["Mouse / Touch", "Click or tap floor to walk, tap objects to walk and examine, drag clue cards"],
    ["Gamepad", "Left stick move, A examine, B dash, X pulse"],
  ];
  return (
    <div className="space-y-4 text-sm text-violet-100/90">
      <section>
        <h3 className="help-h">🎯 Goal</h3>
        <p>A crime has happened and you must reconstruct it inside your Mind Palace. Find the single culprit and <b>prove all three pillars</b> against them: <b>🗡️ Means</b>, <b>💢 Motive</b> and <b>🕰️ Opportunity</b>, before <b>dawn</b> breaks. Accuse the wrong person and you lose Credibility; at zero Credibility your career ends.</p>
      </section>
      <section>
        <h3 className="help-h">🔁 The Loop</h3>
        <ol className="list-decimal ml-5 space-y-1">
          <li><b>Explore:</b> walk the memory rooms and hold E on objects to recover <b>clues</b>. Search costs Focus. Avoid intrusions.</li>
          <li><b>Deduce:</b> on the Board, link two clues that share a <b className="kw">golden keyword</b>. Valid links become deductions (incriminating or exonerating). Wrong links cost sanity.</li>
          <li><b>Interrogate:</b> each suspect makes statements on three topics. Read the <b>lie detector tell</b>, then Accept, Press, or Present a clue that contradicts a lie. A broken lie yields new evidence.</li>
          <li><b>Accuse:</b> only the culprit can have all three pillars proven. Others are red herrings who may lie about unrelated secrets.</li>
        </ol>
      </section>
      <section>
        <h3 className="help-h">🧠 Systems that feed each other</h3>
        <ul className="list-disc ml-5 space-y-1">
          <li><b>Focus ⚡</b> pays for searching, linking, pressing, dashing and pulsing. It regenerates faster in the Atrium.</li>
          <li><b>Sanity 💜</b> drops from intrusions and bad deductions. Low sanity means more intrusions, slower searching, and false tells. Good deductions restore it. At 0 you break down.</li>
          <li><b>Memory clarity 🌫️</b> decays in every room over time. Foggy rooms search slower and spawn more intrusions. Making deductions, pulsing, and the Memory Anchor upgrade restore or slow it.</li>
          <li><b>Dawn ⏳</b> is the deadline. When it ends you must accuse with what you have.</li>
          <li><b>Patience 😤</b> of suspects: wrong evidence and pressing honest statements burn it. At zero they stop talking.</li>
        </ul>
      </section>
      <section>
        <h3 className="help-h">👻 Intrusions</h3>
        <div className="grid sm:grid-cols-2 gap-1">
          <div>🟣 <b>Doubt Wisp</b>: drifts toward you, drains sanity.</div>
          <div>🐺 <b>Regret Hound</b>: wakes when you stand still or search nearby, then hunts.</div>
          <div>🕵️ <b>Echo</b>: retraces your steps 1.7 seconds behind you.</div>
          <div>👁️ <b>Paranoia Eye</b>: sweeping cone; being seen drains sanity and spawns wisps.</div>
          <div>🌫️ <b>Fog Bank</b>: slows you and hides objects. Pulse to clear.</div>
          <div>🎭 <b>The Architect</b>: capstone boss. Dodge bullet patterns, pulse when near, 8 hits.</div>
        </div>
      </section>
      <section>
        <h3 className="help-h">🫀 Reading suspects</h3>
        <div className="grid sm:grid-cols-2 gap-1">
          {(Object.keys(TRAIT_INFO) as (keyof typeof TRAIT_INFO)[]).map((t) => (
            <div key={t}><b>{TRAIT_INFO[t].label}:</b> {TRAIT_INFO[t].tip}</div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="help-h">⌨️ Controls</h3>
        <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
          {rows.map(([k, v]) => (
            <div key={k} className="flex gap-2"><kbd className="kbd">{k}</kbd><span>{v}</span></div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------ title
export function TitleScreen({ go, onNew, onTutorial, onCold, onContinue }: { go: (s: "help" | "campaign") => void; onNew: () => void; onTutorial: () => void; onCold: () => void; onContinue: () => void }) {
  useStore();
  const [settings, setSettings] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const c = meta.career;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === "Enter" && !settings && document.activeElement === document.body) { if (c) onContinue(); else onNew(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [c, onContinue, onNew, settings]);
  return (
    <div className="absolute inset-0 overflow-auto title-bg">
      <div className="floaters" aria-hidden>
        {["🕵️", "🔍", "🗝️", "📜", "🕰️", "🕯️", "🧠", "🎭", "🚪", "🧩"].map((e, i) => (
          <span key={i} style={{ left: `${(i * 10 + 4) % 100}%`, animationDelay: `${-i * 2.3}s`, animationDuration: `${16 + (i % 4) * 4}s`, fontSize: 24 + (i % 3) * 14 }}>{e}</span>
        ))}
      </div>
      <div className="relative min-h-full flex flex-col items-center justify-center p-6 text-center">
        <div className="text-7xl mb-2 drop-shadow-[0_0_25px_rgba(251,191,36,0.6)]">🧠</div>
        <h1 className="logo">MIND PALACE<br />DETECTIVE</h1>
        <p className="text-violet-200/80 max-w-lg mt-3 mb-6">Walk the halls of your own memory. Collect clues, link deductions, and break the liars before dawn.</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          {c && <button className="btn btn-gold btn-lg" onClick={onContinue}>▶ Continue Career <span className="text-xs opacity-80">(Case {Math.min(c.idx + 1, CASE_COUNT)})</span></button>}
          {!c ? (
            <button className="btn btn-gold btn-lg" onClick={onNew}>🆕 New Career</button>
          ) : !confirm ? (
            <button className="btn btn-ghost" onClick={() => setConfirm(true)}>🆕 New Career</button>
          ) : (
            <button className="btn btn-danger" onClick={() => { setConfirm(false); onNew(); }}>⚠ Click again to overwrite career</button>
          )}
          <button className={`btn ${meta.tutorialDone ? "btn-ghost" : "btn-gold pulse"}`} onClick={onTutorial}>🎓 {meta.tutorialDone ? "Replay" : "Play"} Tutorial (Case Zero)</button>
          <button className="btn btn-ghost" onClick={() => go("campaign")}>🏛️ Mind Gym ({meta.insight} insight)</button>
          {meta.won && <button className="btn btn-ghost" onClick={onCold}>❄️ Cold Case Files (endless)</button>}
          <button className="btn btn-ghost" onClick={() => go("help")}>📖 How to Play and Controls</button>
          <button className="btn btn-ghost" onClick={() => setSettings(true)}>⚙️ Settings</button>
        </div>
        <div className="mt-6 text-xs text-violet-200/50 flex gap-4 flex-wrap justify-center">
          <span>Cases solved: {meta.stats.solved}</span>
          <span>Lies broken: {meta.stats.lies}</span>
          <span>Best score: {meta.stats.bestScore}</span>
          <span>Careers won: {meta.stats.wins}</span>
        </div>
      </div>
      {settings && <SettingsPanel onClose={() => setSettings(false)} />}
    </div>
  );
}

export function HelpScreen({ back }: { back: () => void }) {
  return (
    <div className="absolute inset-0 overflow-auto title-bg p-3 md:p-8">
      <div className="panel max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-3xl font-serif text-amber-100">📖 How to Play</h2>
          <button className="btn btn-gold" onClick={back}>← Back</button>
        </div>
        <HelpContent />
      </div>
    </div>
  );
}

// ------------------------------------------------------------ campaign
export function CampaignScreen({ back, onPlay, onNew, onCold, onSettings }: { back: () => void; onPlay: (idx: number, replay: boolean) => void; onNew: () => void; onCold: () => void; onSettings: () => void }) {
  useStore();
  const c = meta.career;
  const [sel, setSel] = useState(c ? Math.min(c.idx, CASE_COUNT - 1) : 0);
  const idx = Math.min(sel, CASE_COUNT - 1);
  const th = THEMES[idx];
  const unlocked = c ? idx <= c.idx : false;
  const replay = c ? idx < c.idx : false;
  const d = DIFFS[meta.settings.difficulty];
  return (
    <div className="absolute inset-0 overflow-auto title-bg p-3 md:p-6">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <div className="space-y-4">
          <div className="panel">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-3xl font-serif text-amber-100">🏛️ Case Files</h2>
              <div className="flex gap-2 flex-wrap">
                <button className="btn btn-ghost" onClick={onSettings}>⚙️ Settings</button>
                <button className="btn btn-ghost" onClick={back}>← Title</button>
              </div>
            </div>
            {c ? (
              <div className="mt-2 flex gap-4 flex-wrap text-sm">
                <span>Credibility: {"❤️".repeat(c.cred)}{"🖤".repeat(Math.max(0, 3 - c.cred))}</span>
                <span>Score: <b>{c.score}</b></span>
                <span>Cases: <b>{c.solved}/{CASE_COUNT}</b></span>
                <span>Stars: <b>{c.stars}</b>⭐</span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-violet-200/80">No active career. Start one to take on the six-case campaign, or spend insight in the Mind Gym.</div>
            )}
          </div>
          {!c && (
            <div className="panel flex items-center gap-3 flex-wrap">
              <button className="btn btn-gold btn-lg" onClick={onNew}>🆕 Begin New Career</button>
              {meta.won && <button className="btn btn-ghost" onClick={onCold}>❄️ Cold Case Files (endless)</button>}
            </div>
          )}
          {c && (
            <div className="panel">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {THEMES.slice(0, CASE_COUNT).map((t, i) => {
                  const lock = i > c.idx;
                  const stars = c.stars_by[i] || 0;
                  return (
                    <button key={t.id} disabled={lock} onClick={() => setSel(i)} className={`case-tab ${sel === i ? "on" : ""} ${lock ? "opacity-40" : ""}`}>
                      <div className="text-xs opacity-70">Case {i + 1}{i === CASE_COUNT - 1 ? " · FINAL" : ""}</div>
                      <div className="text-sm font-semibold leading-tight">{lock ? "🔒 Locked" : t.title}</div>
                      <div className="text-xs mt-1">{lock ? "" : i < c.idx ? "★".repeat(stars) + "☆".repeat(3 - stars) : "NEW"}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 rounded-xl bg-black/30 border border-white/10 p-4">
                <div className="text-xs uppercase tracking-widest text-amber-300/80">{th.crime} · {th.rooms.length} memory rooms · {[4, 4, 5, 5, 6, 6][idx]} suspects</div>
                <h3 className="text-2xl font-serif mt-1">{th.title}</h3>
                <p className="text-sm text-violet-100/80 mt-2">{th.blurb}</p>
                <div className="text-xs text-violet-200/60 mt-2">Difficulty: <b>{d.name}</b> · Dawn in {fmtTime(d.dawn + ([4, 4, 5, 5, 6, 6][idx] - 4) * 45)}{meta.best[idx] ? ` · Best ${meta.best[idx].score}` : ""}</div>
                {idx >= 1 && <div className="text-xs text-violet-200/60 mt-1">New intrusions: {["", "Regret Hounds", "Fog Banks", "Echoes", "Paranoia Eyes", "THE ARCHITECT (boss)"][idx]}</div>}
                <div className="mt-3 flex gap-2 flex-wrap items-center">
                  <button disabled={!unlocked} className="btn btn-gold btn-lg" onClick={() => onPlay(idx, replay)}>{replay ? "↻ Replay Case (half insight)" : "🔎 Begin Case"}</button>
                  {meta.won && <button className="btn btn-ghost" onClick={onCold}>❄️ Cold Case</button>}
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm font-semibold text-amber-100 mb-1">Difficulty and modifiers</div>
                <DifficultyPicker />
              </div>
            </div>
          )}
        </div>
        <Gym />
      </div>
    </div>
  );
}

function Gym() {
  useStore();
  return (
    <div className="panel h-fit">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif text-amber-100">🏋️ Mind Gym</h2>
        <div className="text-lg font-bold text-amber-300">💎 {meta.insight}</div>
      </div>
      <p className="text-xs text-violet-200/70 mb-3">Spend Insight earned from solved cases. Upgrades are permanent and carry over between careers.</p>
      <div className="space-y-2">
        {UPGRADES.map((u) => {
          const lvl = meta.up[u.id] || 0;
          const maxed = lvl >= u.max;
          const cost = upgradeCost(u.id);
          const can = !maxed && meta.insight >= cost;
          return (
            <div key={u.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 p-2">
              <div className="text-2xl w-9 text-center">{u.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold flex items-center gap-2">
                  {u.name}
                  <span className="flex gap-0.5">{Array.from({ length: u.max }).map((_, i) => <span key={i} className={`h-1.5 w-3 rounded-full ${i < lvl ? "bg-amber-400" : "bg-white/15"}`} />)}</span>
                </div>
                <div className="text-[11px] text-violet-200/70 leading-tight">{maxed ? `MAX: ${u.desc(lvl)}` : `Next: ${u.desc(lvl + 1)}`}</div>
              </div>
              <button disabled={!can} onClick={() => buyUpgrade(u.id)} className={`btn !py-1 !text-xs ${can ? "btn-gold" : "btn-ghost"}`}>{maxed ? "MAX" : `💎 ${cost}`}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------ result / endings
function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-violet-200/60">{k}</div>
      <div className="text-xl font-bold text-amber-100">{v}</div>
    </div>
  );
}

const REASONS = {
  solved: "Case closed!",
  dawn: "Dawn broke and you named the wrong person.",
  breakdown: "Your mind shattered under the strain.",
  fired: "Too many false accusations. Your credibility is gone.",
};

export function ResultScreen({ onNext, onRetry, onMenu }: { onNext: () => void; onRetry: () => void; onMenu: () => void }) {
  const r = G.lastResult;
  if (!r) return null;
  return (
    <div className="absolute inset-0 overflow-auto title-bg p-3 md:p-8">
      <div className="panel max-w-3xl mx-auto text-center">
        <div className="text-6xl">{r.solved ? "🎉" : "💀"}</div>
        <h2 className="text-3xl font-serif mt-1 text-amber-100">{r.title}</h2>
        <div className={`text-xl mt-1 font-semibold ${r.solved ? "text-emerald-300" : "text-red-300"}`}>{REASONS[r.reason]}</div>
        <div className="mt-2 text-violet-100">The culprit was <b className="text-amber-300">{r.culprit}</b>.</div>
        {r.solved && <div className="text-3xl mt-2 tracking-widest text-amber-300">{"★".repeat(r.stars)}<span className="opacity-25">{"★".repeat(3 - r.stars)}</span></div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <Stat k="Score" v={r.score} />
          <Stat k="Insight gained" v={`💎 ${r.insight}`} />
          <Stat k="Evidence" v={`${r.evidence}/3 pillars`} />
          <Stat k="Suspects cleared" v={r.ruledOut} />
          <Stat k="Lies broken" v={r.lies} />
          <Stat k="Wrong accusations" v={r.wrong} />
          <Stat k="Objects searched" v={r.examined} />
          <Stat k="Deductions" v={r.combos} />
          <Stat k="Time" v={fmtTime(r.seconds)} />
          <Stat k="Sanity left" v={r.sanityLeft} />
        </div>
        {!r.solved && meta.career && <div className="mt-3 text-sm">Credibility remaining: {"❤️".repeat(meta.career.cred)}{"🖤".repeat(Math.max(0, 3 - meta.career.cred))}</div>}
        <div className="mt-5 flex gap-2 justify-center flex-wrap">
          {r.solved ? (
            <button className="btn btn-gold btn-lg" onClick={onNext}>{r.tutorial ? "Continue to the Career →" : "Continue →"}</button>
          ) : (
            <>
              <button className="btn btn-gold btn-lg" onClick={onRetry}>↻ Retry Case</button>
              <button className="btn btn-ghost" onClick={onNext}>🏛️ Case Files / Mind Gym</button>
            </>
          )}
          <button className="btn btn-ghost" onClick={onMenu}>Title</button>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen({ onNew, onMenu, onGym }: { onNew: () => void; onMenu: () => void; onGym: () => void }) {
  const c = G.lastCareer;
  const r = G.lastResult;
  return (
    <div className="absolute inset-0 overflow-auto bg-gradient-to-b from-[#1a0610] to-[#05030a] p-3 md:p-8 flex items-center">
      <div className="panel max-w-2xl mx-auto text-center border-red-500/30">
        <div className="text-7xl">🕯️</div>
        <h2 className="text-4xl font-serif text-red-300 mt-2">CAREER OVER</h2>
        <p className="text-violet-100/80 mt-2">{r ? REASONS[r.reason] : "Your credibility is gone."} The culprit of your final case was <b className="text-amber-300">{r?.culprit}</b>.</p>
        {c && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <Stat k="Career score" v={c.score} />
            <Stat k="Cases solved" v={`${c.solved}/${CASE_COUNT}`} />
            <Stat k="Stars" v={c.stars} />
            <Stat k="Lies broken" v={c.lies} />
          </div>
        )}
        <p className="text-xs text-violet-200/60 mt-3">Your upgrades and 💎 {meta.insight} insight are kept. A fresh career awaits, and the culprits will be different.</p>
        <div className="mt-5 flex gap-2 justify-center flex-wrap">
          <button className="btn btn-gold btn-lg" onClick={onNew}>🆕 New Career</button>
          <button className="btn btn-ghost" onClick={onGym}>🏋️ Mind Gym</button>
          <button className="btn btn-ghost" onClick={onMenu}>Title</button>
        </div>
      </div>
    </div>
  );
}

export function VictoryScreen({ onCold, onMenu, onGym }: { onCold: () => void; onMenu: () => void; onGym: () => void }) {
  const c = G.lastCareer;
  const r = G.lastResult;
  const rank = RANKS[Math.min(RANKS.length - 1, Math.floor(((c ? c.stars : 0) / (CASE_COUNT * 3)) * RANKS.length))];
  return (
    <div className="absolute inset-0 overflow-auto bg-gradient-to-b from-[#1b1236] via-[#0d0820] to-[#05030a] p-3 md:p-8 flex items-center">
      <div className="panel max-w-2xl mx-auto text-center border-amber-300/40">
        <div className="text-7xl">🏆</div>
        <h2 className="text-4xl font-serif text-amber-200 mt-2">THE ARCHITECT FALLS</h2>
        <p className="text-violet-100/80 mt-2">{r?.culprit} is unmasked and the Mind Palace is yours. Ilya Penrose is avenged.</p>
        <div className="text-2xl mt-3 font-serif text-amber-300">Rank: {rank}</div>
        {c && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            <Stat k="Career score" v={c.score} />
            <Stat k="Total stars" v={`${c.stars}/${CASE_COUNT * 3}`} />
            <Stat k="Lies broken" v={c.lies} />
            <Stat k="Time" v={fmtTime(c.seconds)} />
          </div>
        )}
        <p className="text-xs text-violet-200/60 mt-3">Cold Case Files are now unlocked: endless procedurally generated cases for more insight.</p>
        <div className="mt-5 flex gap-2 justify-center flex-wrap">
          <button className="btn btn-gold btn-lg" onClick={onCold}>❄️ Continue: Cold Case Files</button>
          <button className="btn btn-ghost" onClick={onGym}>🏋️ Mind Gym</button>
          <button className="btn btn-ghost" onClick={onMenu}>Title</button>
        </div>
      </div>
    </div>
  );
}
