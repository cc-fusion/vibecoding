import { ReactNode, useEffect } from "react";
import { LEVEL_COUNT, SPECS, WINGS } from "../game/core";
import { HudSnap, Result } from "../game/engine";
import { DIFFS, MODS, PERMITS, Save, Settings } from "../game/meta";
import { audio } from "../game/audio";

export const WING_COLORS = ["#f4be98", "#86cfc8", "#bd92de", "#8e93c4"];
export const isUnlocked = (save: Save, i: number) => i === 0 || !!save.progress[i - 1];
export const totalStars = (save: Save) => Object.values(save.progress).reduce((a, p) => a + p.stars, 0);

function Dia({ fill, stroke, w = 40, children }: { fill: string; stroke: string; w?: number; children?: ReactNode }) {
  return (
    <svg width={w} height={w * 0.7} viewBox="0 0 40 28" className="shrink-0">
      <polygon points="20,3 38,14 20,25 2,14" fill={fill} stroke={stroke} strokeWidth="3" strokeLinejoin="round" />
      {children}
    </svg>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 bg-[#0b0a18]/70" onPointerDown={(e) => e.stopPropagation()}>
      <div className={`panel pop w-full ${wide ? "max-w-3xl" : "max-w-xl"} max-h-[92vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="serif text-3xl font-bold text-[#ffd166]">{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close">
            ✕ Close
          </button>
        </div>
        <div className="scroll px-5 pb-5 pt-1 flex-1">{children}</div>
      </div>
    </div>
  );
}

// ---------------- Title ----------------
export function TitleScreen(p: {
  save: Save;
  hasProgress: boolean;
  onContinue: () => void;
  onCampaign: () => void;
  onPermits: () => void;
  onHelp: () => void;
  onSettings: () => void;
  onArchive: () => void;
  muted: boolean;
  onMute: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-between py-6 px-4 pointer-events-none">
      <div className="text-center mt-2 sm:mt-6 pointer-events-none">
        <div className="text-xs sm:text-sm tracking-[0.45em] uppercase text-[#ffe9b8]/90 font-semibold">Department of Perspective</div>
        <h1 className="serif font-bold leading-[0.9] text-[#fff4de] drop-shadow-[0_6px_0_rgba(29,27,47,0.55)] text-5xl sm:text-7xl md:text-8xl mt-2">
          Bureau of
          <br />
          <span className="text-[#ffd166]">Impossible</span> Architecture
        </h1>
        <p className="mt-3 text-[#fff4de]/90 text-sm sm:text-lg max-w-xl mx-auto drop-shadow">
          Turn the building. Line up the joints. Walk where no one should.
        </p>
      </div>
      <div className="pointer-events-auto flex flex-col gap-3 items-stretch w-full max-w-xs pop">
        <button className="btn pulse text-lg" onClick={p.onContinue}>
          ▶ {p.hasProgress ? "Continue Case" : "Begin Training"}
        </button>
        <button className="btn ghost" onClick={p.onCampaign}>
          🗺 Case Files ({totalStars(p.save)}★)
        </button>
        <button className="btn ghost" onClick={p.onPermits}>
          🏅 Permits &amp; Upgrades · {p.save.stamps} stamps
        </button>
        <div className="grid grid-cols-3 gap-2">
          <button className="btn ghost small" onClick={p.onHelp}>
            ❓ Help
          </button>
          <button className="btn ghost small" onClick={p.onSettings}>
            ⚙ Settings
          </button>
          <button className="btn ghost small" onClick={p.onArchive}>
            📁 Archive
          </button>
        </div>
      </div>
      <div className="pointer-events-auto flex items-center gap-3 text-xs text-[#fff4de]/80">
        <button className="chip" onClick={p.onMute}>
          {p.muted ? "🔇 Sound off" : "🔊 Sound on"}
        </button>
        <span>Best on a big screen, playable on touch.</span>
      </div>
    </div>
  );
}

// ---------------- Map ----------------
export function MapScreen(p: {
  save: Save;
  wing: number;
  setWing: (w: number) => void;
  onPlay: (id: number) => void;
  onBack: () => void;
  setDifficulty: (d: 0 | 1 | 2) => void;
  toggleMod: (k: "iron" | "tight" | "fog") => void;
}) {
  const s = p.save;
  const ids = SPECS.map((_, i) => i).filter((i) => SPECS[i].wing === p.wing);
  return (
    <div className="absolute inset-0 z-10 flex flex-col p-3 sm:p-6 gap-3 overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button className="btn ghost small" onClick={p.onBack}>
          ← Title
        </button>
        <h2 className="serif text-3xl sm:text-4xl font-bold text-[#fff4de] drop-shadow">Case Files</h2>
        <div className="chip">
          🏅 {s.stamps} · ★ {totalStars(s)}/{LEVEL_COUNT * 3}
        </div>
      </div>
      <div className="panel p-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-[#ffe9b8]/70 mr-1">Difficulty</span>
          {DIFFS.map((d, i) => (
            <button key={d.name} title={d.desc} onClick={() => p.setDifficulty(i as 0 | 1 | 2)} className={`btn small ${s.settings.difficulty === i ? "" : "ghost"}`}>
              {d.name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-[#ffe9b8]/70 mr-1">Modifiers</span>
          {MODS.map((m) => (
            <button key={m.key} title={m.desc} onClick={() => p.toggleMod(m.key)} className={`btn small ${s.settings.mods[m.key] ? "danger" : "ghost"}`}>
              {s.settings.mods[m.key] ? "✔ " : ""}
              {m.name}
            </button>
          ))}
        </div>
        <div className="text-xs text-[#fff4de]/70">{DIFFS[s.settings.difficulty].desc} {MODS.filter((m) => s.settings.mods[m.key]).map((m) => `· ${m.name}: ${m.desc}`).join(" ")}</div>
      </div>
      <div className="flex gap-2 flex-wrap">
        {WINGS.map((w, i) => {
          const done = SPECS.reduce((a, sp, id) => a + (sp.wing === i && s.progress[id] ? 1 : 0), 0);
          const open = isUnlocked(s, SPECS.findIndex((sp) => sp.wing === i));
          return (
            <button
              key={w.name}
              onClick={() => p.setWing(i)}
              className={`btn small ${p.wing === i ? "" : "ghost"}`}
              style={p.wing === i ? { background: WING_COLORS[i] } : undefined}
            >
              {open ? "" : "🔒 "}
              {w.name} <span className="opacity-70">{done}/6</span>
            </button>
          );
        })}
      </div>
      <div className="scroll flex-1 min-h-0">
        <div className="text-[#fff4de]/85 text-sm mb-2 italic">{WINGS[p.wing].sub}</div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {ids.map((id) => {
            const sp = SPECS[id];
            const open = isUnlocked(s, id);
            const pr = s.progress[id];
            return (
              <button
                key={id}
                disabled={!open}
                onClick={() => p.onPlay(id)}
                className={`panel text-left p-4 transition hover:-translate-y-1 disabled:opacity-50 disabled:hover:translate-y-0 ${open && !pr ? "pulse" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="serif text-2xl font-bold" style={{ color: WING_COLORS[sp.wing] }}>
                    {sp.boss ? "★ " : ""}Case {id + 1}
                  </span>
                  <span className="text-lg tracking-widest">
                    {[0, 1, 2].map((k) => (
                      <span key={k} className={pr && pr.stars > k ? "text-[#ffd166]" : "text-white/20"}>
                        ★
                      </span>
                    ))}
                  </span>
                </div>
                <div className="font-semibold text-lg text-[#fff4de]">{open ? sp.name : "Locked"}</div>
                <div className="text-sm text-[#fff4de]/70">{open ? sp.blurb : "Complete the previous case."}</div>
                {open && (
                  <div className="mt-2 flex gap-1 flex-wrap text-[11px]">
                    {sp.boss && <span className="chip !py-0 !bg-[#ef6f5a]/40">{id === LEVEL_COUNT - 1 ? "FINAL BOSS" : "CAPSTONE"}</span>}
                    {sp.insp > 0 && <span className="chip !py-0">🕵 {sp.insp} inspector{sp.insp > 1 ? "s" : ""}</span>}
                    {pr && <span className="chip !py-0">best {pr.best} moves</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------- Permits ----------------
export function PermitsScreen(p: { save: Save; onBuy: (key: string) => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col p-3 sm:p-6 gap-3 overflow-hidden">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button className="btn ghost small" onClick={p.onBack}>
          ← Back
        </button>
        <h2 className="serif text-3xl sm:text-4xl font-bold text-[#fff4de] drop-shadow">Permits &amp; Upgrades</h2>
        <div className="chip text-base">🏅 {p.save.stamps} stamps</div>
      </div>
      <div className="scroll flex-1 min-h-0">
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          {PERMITS.map((pm) => {
            const rank = p.save.permits[pm.key] ?? 0;
            const maxed = rank >= pm.max;
            const cost = pm.cost[rank];
            const can = !maxed && p.save.stamps >= cost;
            return (
              <div key={pm.key} className="panel p-4 flex gap-3 items-center">
                <div className="text-4xl floaty">{pm.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-lg text-[#fff4de]">{pm.name}</div>
                  <div className="text-sm text-[#fff4de]/70">{pm.desc}</div>
                  <div className="mt-1 flex gap-1">
                    {Array.from({ length: pm.max }).map((_, i) => (
                      <span key={i} className={`h-2.5 w-6 rounded-full ${i < rank ? "bg-[#ffd166]" : "bg-white/15"}`} />
                    ))}
                  </div>
                </div>
                <button className={`btn small ${can ? "" : "ghost"}`} disabled={!can} onClick={() => p.onBuy(pm.key)}>
                  {maxed ? "MAX" : `🏅 ${cost}`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-[#fff4de]/70 mt-4">Earn stamps by clearing cases. Higher difficulty and modifiers pay out more. Permits apply to every case, starting immediately.</p>
      </div>
    </div>
  );
}

// ---------------- Help ----------------
export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Field Manual" onClose={onClose} wide>
      <div className="space-y-5 text-[#fff4de]/90 text-sm sm:text-base">
        <section>
          <h3 className="serif text-2xl text-[#ffd166]">The Goal</h3>
          <p>
            Guide the little surveyor to the <b>golden doorway</b>. Every step costs <b>energy</b>; run dry or get caught by an inspector and the case fails. Rotating the building is always free.
          </p>
        </section>
        <section>
          <h3 className="serif text-2xl text-[#ffd166]">The Escher Rule</h3>
          <p>
            Gold-rimmed <b>Joints</b> fuse when two of them touch on screen, even if they are at different depths. Rotate the view until the gap closes, then walk across. Gold lines show joints that are currently aligned.
          </p>
        </section>
        <section>
          <h3 className="serif text-2xl text-[#ffd166]">Tile Guide</h3>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex items-center gap-3">
              <Dia fill="#fff1d8" stroke="#ffc84a" />
              <span>
                <b>Joint</b> - fuses with an aligned joint.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Dia fill="#ffd166" stroke="#1d1b2f">
                <rect x="16" y="6" width="8" height="12" rx="3" fill="#1d1b2f" />
              </Dia>
              <span>
                <b>Goal</b> - the golden doorway.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Dia fill="#fff1d8" stroke="#1d1b2f">
                <path d="M10 18 L16 18 L16 14 L22 14 L22 10 L28 10" fill="none" stroke="#1d1b2f" strokeWidth="2" />
              </Dia>
              <span>
                <b>Stairs</b> - enter from the bottom, exit at the top.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Dia fill="#fff1d8" stroke="#1d1b2f">
                <circle cx="20" cy="14" r="5" fill="#ef6f5a" />
              </Dia>
              <span>
                <b>Button</b> - toggles the bridge of the same colour.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Dia fill="#3fb8af" stroke="#1d1b2f" />
              <span>
                <b>Bridge / Arm</b> - coloured walkway. Dashed outline = retracted.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Dia fill="#fff1d8" stroke="#1d1b2f">
                <circle cx="20" cy="14" r="6" fill="none" stroke="#9d7bff" strokeWidth="3" strokeDasharray="4 3" />
              </Dia>
              <span>
                <b>Gear</b> - step on it to turn the arm of its colour 90°.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Dia fill="#fff1d8" stroke="#1d1b2f">
                <circle cx="20" cy="14" r="6" fill="none" stroke="#6ad6ff" strokeWidth="2.5" />
                <circle cx="20" cy="14" r="3" fill="none" stroke="#6ad6ff" strokeWidth="2" />
              </Dia>
              <span>
                <b>Pneumatic tube</b> - pairs. Enter one, exit the other.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl w-10 text-center">🕵</span>
              <span>
                <b>Inspector</b> - patrols the dotted red route, one tile per move. Joints and illusions do not fool them. Touch = caught.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl w-10 text-center">📄</span>
              <span>
                <b>Documents</b> - collect all three for the third star.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl w-10 text-center">☕</span>
              <span>
                <b>Coffee</b> - restores energy.
              </span>
            </div>
          </div>
        </section>
        <section>
          <h3 className="serif text-2xl text-[#ffd166]">Controls</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <div>
              <kbd>↑</kbd> <kbd>→</kbd> <kbd>↓</kbd> <kbd>←</kbd> / <kbd>W</kbd> <kbd>D</kbd> <kbd>S</kbd> <kbd>A</kbd> - step up-right / down-right / down-left / up-left
            </div>
            <div>
              <b>Click / tap a tile</b> - auto-walk there (from this angle)
            </div>
            <div>
              <kbd>Q</kbd> / <kbd>E</kbd> or <b>drag</b> / <b>mouse wheel</b> - rotate the building
            </div>
            <div>
              <kbd>Space</kbd> - wait a beat (inspectors move)
            </div>
            <div>
              <kbd>Z</kbd> / <kbd>Backspace</kbd> - rewind one move
            </div>
            <div>
              <kbd>H</kbd> - hint (shows the next move of the shortest route)
            </div>
            <div>
              <kbd>Esc</kbd> / <kbd>P</kbd> - pause
            </div>
            <div>
              Touch: <b>tap</b> to walk, <b>drag</b> to rotate, buttons at the bottom.
            </div>
          </div>
        </section>
        <section>
          <h3 className="serif text-2xl text-[#ffd166]">Scoring</h3>
          <p>
            ★ Complete the case. ★★ Finish within about 30% of par. ★★★ Collect every document. Stamps buy permanent permits.
          </p>
        </section>
      </div>
    </Modal>
  );
}

// ---------------- Settings ----------------
export function SettingsModal(p: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
  onReset: () => void;
  inGame: boolean;
}) {
  const s = p.settings;
  const set = (patch: Partial<Settings>) => p.onChange({ ...s, ...patch });
  const slider = (label: string, key: "master" | "music" | "sfx") => (
    <label className="block">
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="opacity-70">{Math.round(s[key] * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={s[key]} onChange={(e) => set({ [key]: parseFloat(e.target.value) } as Partial<Settings>)} onPointerUp={() => audio.play("click")} />
    </label>
  );
  return (
    <Modal title="Settings" onClose={p.onClose}>
      <div className="space-y-4 text-[#fff4de]/90">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Sound</span>
            <button className={`btn small ${s.muted ? "danger" : ""}`} onClick={() => set({ muted: !s.muted })}>
              {s.muted ? "🔇 Muted" : "🔊 On"}
            </button>
          </div>
          {slider("Master volume", "master")}
          {slider("Music volume", "music")}
          {slider("Effects volume", "sfx")}
        </div>
        <div>
          <div className="font-semibold mb-2">Difficulty {p.inGame && <span className="text-xs opacity-70">(applies immediately to your energy and charges)</span>}</div>
          <div className="flex flex-wrap gap-2">
            {DIFFS.map((d, i) => (
              <button key={d.name} className={`btn small ${s.difficulty === i ? "" : "ghost"}`} onClick={() => set({ difficulty: i as 0 | 1 | 2 })}>
                {d.name}
              </button>
            ))}
          </div>
          <div className="text-xs opacity-70 mt-1">{DIFFS[s.difficulty].desc}</div>
        </div>
        <div>
          <div className="font-semibold mb-2">Modifiers</div>
          <div className="flex flex-wrap gap-2">
            {MODS.map((m) => (
              <button key={m.key} title={m.desc} className={`btn small ${s.mods[m.key] ? "danger" : "ghost"}`} onClick={() => set({ mods: { ...s.mods, [m.key]: !s.mods[m.key] } })}>
                {s.mods[m.key] ? "✔ " : ""}
                {m.name}
              </button>
            ))}
          </div>
          <div className="text-xs opacity-70 mt-1">{MODS.map((m) => `${m.name}: ${m.desc}`).join(" · ")}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={`btn small ${s.linkHints ? "" : "ghost"}`} onClick={() => set({ linkHints: !s.linkHints })}>
            {s.linkHints ? "✔" : "✘"} Show fuse lines
          </button>
          <button className={`btn small ${s.shake ? "" : "ghost"}`} onClick={() => set({ shake: !s.shake })}>
            {s.shake ? "✔" : "✘"} Screen shake
          </button>
        </div>
        {!p.inGame && (
          <div className="pt-2 border-t border-white/10">
            <button
              className="btn danger small"
              onClick={() => {
                if (window.confirm("Erase all progress, stamps and permits?")) p.onReset();
              }}
            >
              🗑 Reset all progress
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ---------------- Archive ----------------
export function ArchiveModal({ save, onClose }: { save: Save; onClose: () => void }) {
  const st = save.stats;
  const cleared = Object.keys(save.progress).length;
  const rows: [string, string][] = [
    ["Cases cleared", `${cleared} / ${LEVEL_COUNT}`],
    ["Stars earned", `${totalStars(save)} / ${LEVEL_COUNT * 3}`],
    ["Steps taken", String(st.moves)],
    ["Joints fused", String(st.hops)],
    ["Rotations", String(st.rotations)],
    ["Documents filed", String(st.docs)],
    ["Times caught", String(st.caught)],
    ["Failed cases", String(st.failures)],
    ["Time on duty", `${Math.floor(st.seconds / 60)}m ${Math.floor(st.seconds % 60)}s`],
    ["Stamps in hand", String(save.stamps)],
  ];
  return (
    <Modal title="Bureau Archive" onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/5 p-3">
            <div className="text-xs uppercase tracking-widest text-[#ffe9b8]/60">{k}</div>
            <div className="text-xl font-bold text-[#fff4de]">{v}</div>
          </div>
        ))}
      </div>
      {save.won && <p className="mt-4 text-[#ffd166] serif text-xl">🏆 The Impossible Tower has been audited. The Bureau is in your debt.</p>}
    </Modal>
  );
}

// ---------------- HUD ----------------
export function Hud(p: {
  hud: HudSnap;
  title: string;
  onRotate: (d: number) => void;
  onWait: () => void;
  onUndo: () => void;
  onHint: () => void;
  onPause: () => void;
  onHelp: () => void;
  iron: boolean;
}) {
  const h = p.hud;
  const frac = Math.max(0, Math.min(1, h.energy / Math.max(1, Math.max(h.maxEnergy, h.energy))));
  const col = frac > 0.5 ? "#6bd68a" : frac > 0.25 ? "#ffc247" : "#ef5a4a";
  const low = frac <= 0.25;
  return (
    <div
      className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-2 sm:p-4"
      onPointerUp={() => (document.activeElement as HTMLElement | null)?.blur?.()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2 items-start pointer-events-auto">
          <button className="btn ghost small" onClick={p.onPause}>
            ⏸ Pause
          </button>
          <div className="chip">
            Case {h.levelId + 1}: {p.title}
          </div>
        </div>
        <div className="flex-1 max-w-md mx-auto">
          <div className={`panel !rounded-2xl px-3 py-2 ${low ? "pulse" : ""}`}>
            <div className="flex items-center justify-between text-sm font-bold">
              <span>⚡ Energy</span>
              <span style={{ color: col }}>
                {Math.max(0, h.energy)} / {h.maxEnergy}
              </span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden mt-1">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${frac * 100}%`, background: col }} />
            </div>
            <div className="flex justify-between text-xs mt-1 text-[#fff4de]/80">
              <span>
                Steps {h.steps} · Par {h.par}
              </span>
              <span>
                📄 {h.docs}/{h.docsTotal}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 items-end pointer-events-auto">
          <button className="btn ghost small" onClick={p.onHelp}>
            ❓
          </button>
          <div className="chip hidden sm:inline-flex">View {h.view + 1}/4</div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        {(h.coach || h.hintText) && (
          <div className="panel pop !rounded-2xl px-4 py-2 max-w-xl text-center text-sm sm:text-base border-[#ffd166]/60 text-[#fff4de]">
            {h.hintText ? "💡 " : "📋 "}
            {h.hintText || h.coach}
          </div>
        )}
        <div className="flex gap-2 flex-wrap justify-center pointer-events-auto pb-1">
          <button className="btn small" onClick={() => p.onRotate(-1)} title="Rotate view (Q)">
            ⟲ <span className="hidden sm:inline">Q</span>
          </button>
          <button className="btn small" onClick={() => p.onRotate(1)} title="Rotate view (E)">
            ⟳ <span className="hidden sm:inline">E</span>
          </button>
          <button className="btn small ghost" onClick={p.onWait} title="Wait a beat (Space)">
            ⏳ Wait{h.waitCost === 0 ? " (free)" : ""}
          </button>
          <button className="btn small ghost" disabled={p.iron || h.undo <= 0} onClick={p.onUndo} title="Rewind (Z)">
            ⏪ {h.undo}
          </button>
          <button className="btn small ghost" disabled={p.iron || h.hints <= 0} onClick={p.onHint} title="Hint (H)">
            💡 {h.hints}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Pause ----------------
export function PauseMenu(p: { onResume: () => void; onRestart: () => void; onSettings: () => void; onHelp: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0a18]/60 p-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel pop p-6 w-full max-w-sm flex flex-col gap-3">
        <h2 className="serif text-4xl font-bold text-[#ffd166] text-center">Paused</h2>
        <button className="btn" onClick={p.onResume}>
          ▶ Resume
        </button>
        <button className="btn ghost" onClick={p.onRestart}>
          ↻ Restart Case
        </button>
        <button className="btn ghost" onClick={p.onSettings}>
          ⚙ Settings &amp; Difficulty
        </button>
        <button className="btn ghost" onClick={p.onHelp}>
          ❓ Field Manual
        </button>
        <button className="btn danger" onClick={p.onQuit}>
          ⌂ Quit to Case Files
        </button>
      </div>
    </div>
  );
}

export function MemoCard(p: { title: string; tips: string[]; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0a18]/55 p-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel pop p-6 w-full max-w-md">
        <div className="text-xs tracking-[0.35em] uppercase text-[#ffe9b8]/70">Memo from the Bureau</div>
        <h2 className="serif text-3xl font-bold text-[#ffd166] mb-2">{p.title}</h2>
        {p.tips.map((t, i) => (
          <p key={i} className="text-[#fff4de]/90 mb-2">
            {t}
          </p>
        ))}
        <button className="btn mt-2 w-full" onClick={p.onClose}>
          Understood
        </button>
      </div>
    </div>
  );
}

// ---------------- End panels ----------------
function Stars({ n }: { n: number }) {
  useEffect(() => {
    const ts: number[] = [];
    for (let i = 0; i < n; i++) ts.push(window.setTimeout(() => audio.play("star", i), 350 + i * 350));
    return () => ts.forEach((t) => window.clearTimeout(t));
  }, [n]);
  return (
    <div className="flex justify-center gap-2 text-6xl my-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={i < n ? "text-[#ffd166] starpop drop-shadow-[0_0_14px_rgba(255,209,102,0.8)]" : "text-white/15"}
          style={i < n ? { animationDelay: `${0.3 + i * 0.35}s` } : undefined}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function StatGrid({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 text-left">
      {rows.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-widest text-[#ffe9b8]/60">{k}</div>
          <div className="text-lg font-bold">{v}</div>
        </div>
      ))}
    </div>
  );
}
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function WinPanel(p: {
  r: Result;
  title: string;
  stamps: number;
  newBest: boolean;
  hasNext: boolean;
  onNext: () => void;
  onRetry: () => void;
  onMap: () => void;
}) {
  const r = p.r;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0b0a18]/60 p-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel pop p-6 w-full max-w-md text-center max-h-[95vh] overflow-auto scroll">
        <div className="text-xs tracking-[0.35em] uppercase text-[#6bd68a]">Case Closed</div>
        <h2 className="serif text-4xl font-bold text-[#ffd166]">{p.title}</h2>
        <Stars n={r.stars} />
        <StatGrid
          rows={[
            ["Steps / Par", `${r.steps} / ${r.par}`],
            ["Energy left", String(r.energyLeft)],
            ["Documents", `${r.docs}/${r.docsTotal}`],
            ["Joints fused", String(r.hops)],
            ["Rotations", String(r.rotations)],
            ["Time", fmtTime(r.time)],
          ]}
        />
        <div className="mt-3 text-lg font-bold text-[#ffd166]">+{p.stamps} 🏅 stamps {p.newBest && <span className="text-sm text-[#6bd68a]">· new best!</span>}</div>
        <div className="text-xs text-[#fff4de]/60 mt-1">★ complete · ★★ within ~30% of par · ★★★ all documents</div>
        <div className="flex flex-col gap-2 mt-4">
          {p.hasNext && (
            <button className="btn" onClick={p.onNext}>
              Next Case →
            </button>
          )}
          <button className="btn ghost" onClick={p.onRetry}>
            ↻ Replay for stars
          </button>
          <button className="btn ghost" onClick={p.onMap}>
            🗺 Case Files
          </button>
        </div>
      </div>
    </div>
  );
}

export function LosePanel(p: { r: Result; title: string; canRewind: boolean; onRewind: () => void; onRetry: () => void; onMap: () => void }) {
  const r = p.r;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#2a0b0b]/60 p-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel pop p-6 w-full max-w-md text-center">
        <div className="text-xs tracking-[0.35em] uppercase text-[#ef6f5a]">Case Failed</div>
        <h2 className="serif text-4xl font-bold text-[#ff9a8a]">{r.reason === "caught" ? "Caught by an Inspector" : "Out of Energy"}</h2>
        <p className="text-[#fff4de]/80 mt-1 mb-3">
          {r.reason === "caught"
            ? "Inspectors walk the real floor - illusions don't fool them. Time your moves, or wait a beat."
            : "The budget ran dry. Look for coffee, take the shorter fusion, or ask for a hint."}
        </p>
        <StatGrid
          rows={[
            ["Case", p.title],
            ["Steps / Par", `${r.steps} / ${r.par}`],
            ["Documents", `${r.docs}/${r.docsTotal}`],
            ["Time", fmtTime(r.time)],
          ]}
        />
        <div className="flex flex-col gap-2 mt-4">
          {p.canRewind && (
            <button className="btn" onClick={p.onRewind}>
              ⏪ Rewind last move
            </button>
          )}
          <button className={`btn ${p.canRewind ? "ghost" : ""}`} onClick={p.onRetry}>
            ↻ Retry case
          </button>
          <button className="btn ghost" onClick={p.onMap}>
            🗺 Case Files
          </button>
        </div>
      </div>
    </div>
  );
}

export function VictoryPanel(p: { save: Save; onContinue: () => void; onPermits: () => void }) {
  const st = p.save.stats;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0b0a18]/75 p-3" onPointerDown={(e) => e.stopPropagation()}>
      <div className="panel pop p-6 w-full max-w-lg text-center max-h-[95vh] overflow-auto scroll">
        <div className="text-xs tracking-[0.4em] uppercase text-[#ffd166]">Final Audit Complete</div>
        <h2 className="serif text-5xl font-bold text-[#fff4de] leading-tight">
          The Tower <span className="text-[#ffd166]">Stands</span>
        </h2>
        <p className="text-[#fff4de]/85 my-3">
          The Chief Auditor stamps your file: <i>"Technically impossible. Technically approved."</i> You are promoted to Senior Surveyor of Impossible Architecture.
        </p>
        <StatGrid
          rows={[
            ["Total stars", `${totalStars(p.save)} / ${LEVEL_COUNT * 3}`],
            ["Cases cleared", `${Object.keys(p.save.progress).length} / ${LEVEL_COUNT}`],
            ["Joints fused", String(st.hops)],
            ["Times caught", String(st.caught)],
            ["Steps taken", String(st.moves)],
            ["Time on duty", fmtTime(st.seconds)],
          ]}
        />
        <div className="flex flex-col gap-2 mt-4">
          <button className="btn" onClick={p.onContinue}>
            Keep Surveying (replay for ★★★)
          </button>
          <button className="btn ghost" onClick={p.onPermits}>
            🏅 Spend stamps
          </button>
        </div>
      </div>
    </div>
  );
}
