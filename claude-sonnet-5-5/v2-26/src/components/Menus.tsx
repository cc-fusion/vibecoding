import { useMemo, useState } from "react";
import { audio } from "../game/audio";
import { DIFFS, HOUSE_NAMES, MECH_INFO } from "../game/data";
import type { DiffId, Meta, MechType } from "../game/types";

function Emblem() {
  return (
    <svg viewBox="0 0 200 220" className="anim-float mx-auto h-36 w-auto drop-shadow-[0_0_24px_rgba(214,168,76,0.45)] sm:h-48">
      <defs>
        <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff0b8" />
          <stop offset="0.5" stopColor="#d6a84c" />
          <stop offset="1" stopColor="#6a4a14" />
        </linearGradient>
      </defs>
      <path d="M55 95 V65 a45 45 0 0 1 90 0 V95" fill="none" stroke="url(#gold)" strokeWidth="14" strokeLinecap="round" />
      <rect x="30" y="92" width="140" height="108" rx="16" fill="url(#gold)" stroke="#2a1d08" strokeWidth="4" />
      <circle cx="100" cy="138" r="17" fill="#15110a" />
      <path d="M92 146 L100 175 L108 146 Z" fill="#15110a" />
      <circle cx="100" cy="138" r="26" fill="none" stroke="#2a1d08" strokeWidth="2" strokeDasharray="4 5" />
      <g stroke="#2a1d08" strokeWidth="2" opacity="0.5">
        <path d="M42 108 H60 M140 108 H158 M42 186 H60 M140 186 H158" />
      </g>
    </svg>
  );
}

interface TitleProps {
  hasSave: boolean;
  meta: Meta;
  onContinue: () => void;
  onNew: () => void;
  onAcademy: () => void;
  onHelp: () => void;
  onSettings: () => void;
}

export function Title(p: TitleProps) {
  const btn = (label: string, fn: () => void, cls = "") => (
    <button className={`btn w-full py-3 text-base ${cls}`} onMouseEnter={() => audio.hover()} onClick={() => { audio.init(); audio.ui(); fn(); }}>
      {label}
    </button>
  );
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_20%,#2a2036_0%,#120e18_55%,#07060a_100%)] p-4">
      <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, rgba(214,168,76,0.12) 0, transparent 40%), radial-gradient(circle at 80% 70%, rgba(70,207,160,0.08) 0, transparent 40%)" }} />
      <div className="relative z-10 w-full max-w-sm text-center">
        <Emblem />
        <h1 className="font-display title-shimmer mt-2 text-4xl font-black leading-none tracking-wider sm:text-5xl">LOCKPICK</h1>
        <h1 className="font-display title-shimmer text-4xl font-black leading-tight tracking-[0.25em] sm:text-5xl">DYNASTY</h1>
        <p className="mb-6 mt-2 text-sm italic text-[#bfb496]">Crack the vaults of the city. Found a legacy in lock and shadow.</p>
        <div className="flex flex-col gap-2.5">
          {p.hasSave && btn("▶  Continue Dynasty", p.onContinue, "btn-primary")}
          {btn("✦  New Dynasty", p.onNew, p.hasSave ? "" : "btn-primary")}
          {btn("🎓  Academy (Practice)", p.onAcademy)}
          {btn("📖  Handbook & Controls", p.onHelp)}
          {btn("⚙  Settings", p.onSettings)}
        </div>
        <div className="mt-5 text-[11px] text-[#7d7566]">
          {p.meta.generation > 0 || p.meta.victories > 0
            ? `Generation ${p.meta.generation + 1} · Sovereign's Vaults breached: ${p.meta.victories} · Best renown: ${p.meta.bestRenown}`
            : "Keyboard & mouse · touch friendly · progress saved in your browser"}
        </div>
      </div>
    </div>
  );
}

export function NewGame({ meta, hasSave, onStart, onBack }: { meta: Meta; hasSave: boolean; onStart: (house: string, diff: DiffId) => void; onBack: () => void }) {
  const [name, setName] = useState(() => HOUSE_NAMES[Math.floor(Math.random() * HOUSE_NAMES.length)]);
  const [diff, setDiff] = useState<DiffId>(meta.settings.difficulty);
  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto bg-[radial-gradient(ellipse_at_50%_20%,#2a2036_0%,#120e18_60%,#07060a_100%)] p-4">
      <div className="panel anim-pop w-full max-w-lg p-6">
        <h2 className="font-display mb-1 text-center text-2xl font-black text-[#f3d88d]">Found Your Dynasty</h2>
        <p className="mb-4 text-center text-xs text-[#9d9484]">
          {meta.generation > 0 ? `Generation ${meta.generation + 1} — your heirs inherit better tools, a fatter purse and steadier hands.` : "Every great house starts with a single stolen coin."}
        </p>
        <label className="mb-1 block text-sm font-semibold text-[#d6a84c]">House name</label>
        <input
          value={name}
          maxLength={18}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 w-full rounded-lg border border-[#d6a84c]/40 bg-black/50 px-3 py-2 font-display text-lg text-[#f3d88d] outline-none focus:border-[#f3d88d]"
        />
        <label className="mb-1 block text-sm font-semibold text-[#d6a84c]">Difficulty</label>
        <div className="mb-4 space-y-2">
          {(Object.keys(DIFFS) as DiffId[]).map((d) => (
            <button key={d} onClick={() => { audio.ui(); setDiff(d); }} className={`w-full rounded-lg border px-3 py-2 text-left transition ${diff === d ? "border-[#f3d88d] bg-[#d6a84c]/15" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
              <div className="flex justify-between">
                <span className="font-display font-bold text-[#f3d88d]">{DIFFS[d].name}</span>
                <span className="text-[11px] text-[#9d9484]">pay ×{DIFFS[d].pay} · rent ×{DIFFS[d].rent}</span>
              </div>
              <div className="text-[11px] text-[#bfb496]">{DIFFS[d].desc}</div>
            </button>
          ))}
        </div>
        {hasSave && <p className="mb-3 rounded-lg bg-red-950/40 p-2 text-center text-xs text-red-200">A dynasty is already saved. Founding a new one will overwrite it.</p>}
        <div className="flex gap-2">
          <button className="btn flex-1" onClick={() => { audio.back(); onBack(); }}>Back</button>
          <button className="btn btn-primary flex-[2]" onClick={() => { audio.ui(); onStart(name.trim() || "Nameless", diff); }}>Open the Workshop</button>
        </div>
      </div>
    </div>
  );
}

export function Academy({ meta, onPick, onBack }: { meta: Meta; onPick: (t: MechType) => void; onBack: () => void }) {
  const types = useMemo(() => Object.keys(MECH_INFO) as MechType[], []);
  const done = types.filter((t) => meta.academy[t]).length;
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_50%_0%,#2a2036_0%,#120e18_60%,#07060a_100%)] p-4">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-black text-[#f3d88d]">The Academy</h2>
            <p className="text-xs text-[#9d9484]">Risk-free practice. No alarms, no snapping picks, no clock. Completed: {done}/{types.length}</p>
          </div>
          <button className="btn" onClick={() => { audio.back(); onBack(); }}>← Back</button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {types.map((t) => (
            <button key={t} onClick={() => { audio.ui(); onPick(t); }} className="panel group p-4 text-left transition hover:-translate-y-0.5 hover:border-[#f3d88d]">
              <div className="flex items-center justify-between">
                <div className="font-display text-lg font-bold text-[#f3d88d]">{MECH_INFO[t].icon} {MECH_INFO[t].name}</div>
                {meta.academy[t] && <span className="rounded-full bg-emerald-700/60 px-2 py-0.5 text-[10px] font-bold">✓ DONE</span>}
              </div>
              <p className="mt-1 text-sm text-[#d8d0bc]">{MECH_INFO[t].short}</p>
              <p className="mt-2 text-[11px] text-[#9d9484]">{MECH_INFO[t].help}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
