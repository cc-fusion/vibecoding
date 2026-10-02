import { useState, type ReactNode } from "react";
import { audio } from "../game/audio";
import { CLIENTS, CLIENT_IDS, DIFFS, KINDS, MECH_INFO } from "../game/data";
import type { DiffId, MechType, Settings } from "../game/types";

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className={`panel anim-pop flex max-h-[92vh] w-full flex-col ${wide ? "max-w-3xl" : "max-w-md"}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#d6a84c]/20 px-5 py-3">
          <h2 className="font-display text-xl font-black text-[#f3d88d]">{title}</h2>
          <button className="btn btn-sm" onClick={() => { audio.back(); onClose(); }}>✕ Close</button>
        </div>
        <div className="scroll-y min-h-0 flex-1 p-5">{children}</div>
      </div>
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-3 block">
      <div className="mb-1 flex justify-between text-sm">
        <span>{label}</span>
        <span className="tabular-nums text-[#9d9484]">{Math.round(value * 100)}%</span>
      </div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full" />
    </label>
  );
}

function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-sm hover:bg-white/10" onClick={() => { audio.ui(); onChange(!value); }}>
      <span>
        {label}
        {hint && <span className="block text-[11px] text-[#9d9484]">{hint}</span>}
      </span>
      <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${value ? "bg-emerald-600/70 text-white" : "bg-white/10 text-[#9d9484]"}`}>{value ? "ON" : "OFF"}</span>
    </button>
  );
}

export function SettingsModal({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const set = (p: Partial<Settings>) => onChange({ ...settings, ...p });
  return (
    <Modal title="Settings" onClose={onClose}>
      <h3 className="font-display mb-2 text-sm font-bold text-[#d6a84c]">AUDIO</h3>
      <Toggle label="Mute all audio" value={settings.muted} onChange={(v) => set({ muted: v })} />
      <Slider label="Master volume" value={settings.master} onChange={(v) => set({ master: v })} />
      <Slider label="Sound effects" value={settings.sfx} onChange={(v) => set({ sfx: v })} />
      <Slider label="Music" value={settings.music} onChange={(v) => set({ music: v })} />
      <button className="btn btn-sm mb-4" onClick={() => { audio.init(); audio.setPin(); audio.coin(); }}>🔊 Test sound</button>
      <h3 className="font-display mb-2 text-sm font-bold text-[#d6a84c]">GAME FEEL</h3>
      <Toggle label="Screen shake" value={settings.shake} onChange={(v) => set({ shake: v })} hint="Applies to the next job." />
      <Toggle label="Rich particles" value={settings.particles} onChange={(v) => set({ particles: v })} hint="Turn off on slower devices." />
      <h3 className="font-display mb-2 mt-4 text-sm font-bold text-[#d6a84c]">DIFFICULTY</h3>
      <div className="space-y-2">
        {(Object.keys(DIFFS) as DiffId[]).map((d) => (
          <button
            key={d}
            onClick={() => { audio.ui(); set({ difficulty: d }); }}
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${settings.difficulty === d ? "border-[#f3d88d] bg-[#d6a84c]/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
          >
            <div className="font-display text-sm font-bold text-[#f3d88d]">{DIFFS[d].name}</div>
            <div className="text-[11px] text-[#bfb496]">{DIFFS[d].desc}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[#9d9484]">Difficulty can be changed at any time and applies from the next job. Progress saves automatically to your browser.</p>
    </Modal>
  );
}

const KEYROW = (keys: string, desc: string) => (
  <div className="flex items-start gap-3 border-b border-white/5 py-1.5 text-sm" key={keys + desc}>
    <div className="w-40 shrink-0 font-semibold text-[#f3d88d]">{keys}</div>
    <div className="text-[#d8d0bc]">{desc}</div>
  </div>
);

export function HelpModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"controls" | "play" | "systems" | "locks">("play");
  const tabs: [typeof tab, string][] = [["play", "How to Play"], ["controls", "Controls"], ["locks", "The Locks"], ["systems", "Systems"]];
  return (
    <Modal title="Locksmith's Handbook" onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap border-b border-white/10">
        {tabs.map(([id, label]) => (
          <button key={id} className={`tab ${tab === id ? "tab-active" : ""}`} onClick={() => { audio.ui(); setTab(id); }}>{label}</button>
        ))}
      </div>
      {tab === "play" && (
        <div className="space-y-3 text-sm leading-relaxed text-[#d8d0bc]">
          <p><b className="text-[#f3d88d]">Your goal:</b> build a locksmith dynasty. Take contracts from four rival clients, crack multi-stage vaults before dawn, sell the loot, upgrade your tools — and finally breach <b>The Sovereign's Vault</b>.</p>
          <p><b className="text-[#f3d88d]">Inside a vault:</b> each vault is a chain of different locks. Every mistake makes <b>noise</b>. If the noise bar fills, the alarm sounds and the job fails. Mistakes also wear your pick; when it snaps, you start on a spare. No spares left? The job fails.</p>
          <p><b className="text-[#f3d88d]">Guards:</b> every so often a patrol warns of its approach. <b>Hold SHIFT</b> (or the on-screen Hide button) before it passes — hiding freezes your hands but cools the noise twice as fast. The clock never stops.</p>
          <p><b className="text-[#f3d88d]">Between jobs:</b> take a contract from the Board, buy tools in the Workshop, sell loot at the Fence (prices drift daily), and watch your Ledger: client reputation, Heat, and rent. Heat 100 = arrest. Debt below −150g = bankruptcy.</p>
          <p><b className="text-[#f3d88d]">Not sure where to begin?</b> Visit the Academy from the title screen for guided practice on every lock type. The Odd Job is always available if you're stuck.</p>
        </div>
      )}
      {tab === "controls" && (
        <div>
          {KEYROW("Mouse", "Hover/drag mechanisms; click buttons and glyphs.")}
          {KEYROW("Touch", "Tap and drag work everywhere. Use the on-screen Hide button.")}
          {KEYROW("← → / A D", "Select pin · spin dial · rotate ring")}
          {KEYROW("↑ ↓ / W S", "Lift pin · choose ring")}
          {KEYROW("Space / Enter", "Lock dial number · strike latch · submit cipher · replay runes")}
          {KEYROW("1 – 8", "Cipher glyphs / runes")}
          {KEYROW("Backspace", "Remove last cipher glyph")}
          {KEYROW("Mouse wheel", "Fine-tune dial & rings")}
          {KEYROW("Shift (hold) / H", "Hide from guard patrols")}
          {KEYROW("Q  E  R  F", "Oil flask · Smoke pellet · Sand vial · Skeleton key")}
          {KEYROW("Esc / P", "Pause")}
        </div>
      )}
      {tab === "locks" && (
        <div className="space-y-3">
          {(Object.keys(MECH_INFO) as MechType[]).map((m) => (
            <div key={m} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="font-display font-bold text-[#f3d88d]">{MECH_INFO[m].icon} {MECH_INFO[m].name}</div>
              <div className="text-sm text-[#d8d0bc]">{MECH_INFO[m].short}</div>
              <div className="mt-1 text-xs text-[#9d9484]">{MECH_INFO[m].help}</div>
            </div>
          ))}
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[#d8d0bc]">
            <b className="text-[#f3d88d]">Affixes:</b> ☠ Trapped — mistakes cost double noise · ⛓ Rusted — tolerances −20% · 🚨 Alarmed — a guard comes the moment it opens.
          </div>
        </div>
      )}
      {tab === "systems" && (
        <div className="space-y-3 text-sm text-[#d8d0bc]">
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><b className="text-[#f3d88d]">Noise ↔ Tools:</b> Gloves cut noise from mistakes, Oil kits speed its decay, the Stethoscope helps you avoid mistakes in the first place.</div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><b className="text-[#f3d88d]">Heat ↔ Everything:</b> Alarms, sloppy jobs and caught patrols raise city Heat. High Heat shortens patrol intervals, shaves time, slows noise decay and cuts fence prices. Lay low or bribe the watch to cool down.</div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><b className="text-[#f3d88d]">Reputation:</b> each client has its own rep. Higher rep unlocks higher-tier contracts and bigger pay. But working for one hurts their rival — Ledger vs. Black Lantern, Vael vs. Lumen. At 50+ rep, each client grants a perk.
            <ul className="mt-1 space-y-0.5 text-xs text-[#bfb496]">
              {CLIENT_IDS.map((c) => (<li key={c}>{CLIENTS[c].icon} {CLIENTS[c].name} — {CLIENTS[c].perk}</li>))}
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><b className="text-[#f3d88d]">Economy:</b> Payouts · loot sold at a drifting fence market (selling floods a category) · daily rent that rises with rank · tools and consumables in the Workshop.</div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><b className="text-[#f3d88d]">Contract kinds:</b> {Object.values(KINDS).filter((k) => k.name !== "Odd Job").map((k) => `${k.icon} ${k.name}`).join(" · ")}</div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-3"><b className="text-[#f3d88d]">Dynasty:</b> Renown raises your rank. Reach <b>Grand Artificer</b> to unlock the Sovereign's Vault. Win, and your heir may begin the next generation with inherited tools.</div>
        </div>
      )}
    </Modal>
  );
}
