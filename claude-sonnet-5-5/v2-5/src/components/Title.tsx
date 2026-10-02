import { DIFFS, MODS, type DiffId } from '../game/defs';
import type { Mods } from '../game/engine';
import type { SaveData } from '../game/save';
import { Btn, Modal } from './ui';

export interface Setup {
  diff: DiffId;
  mods: Mods;
}

export function Title({
  save,
  onPlay,
  onTutorial,
  onLegacy,
  onHelp,
  onSettings,
}: {
  save: SaveData;
  onPlay: () => void;
  onTutorial: () => void;
  onLegacy: () => void;
  onHelp: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-60" style={{ background: 'radial-gradient(ellipse at 50% 40%, #0b3a52 0%, #050b18 60%, #02040a 100%)' }} />
      <svg className="pointer-events-none absolute left-1/2 top-1/2 h-[140vmin] w-[140vmin] -translate-x-1/2 -translate-y-1/2 opacity-40" viewBox="-100 -100 200 200">
        <g style={{ animation: 'spin 60s linear infinite', transformOrigin: 'center' }}>
          <circle r="90" fill="none" stroke="#22d3ee" strokeWidth="1.2" strokeDasharray="6 4" />
          <circle r="78" fill="none" stroke="#38bdf8" strokeWidth="0.5" />
          <circle r="62" fill="none" stroke="#eab308" strokeWidth="0.6" strokeDasharray="2 6" />
          {Array.from({ length: 24 }).map((_, i) => (
            <rect key={i} x="-2" y="-92" width="4" height="8" fill="#22d3ee" opacity="0.6" transform={`rotate(${i * 15})`} />
          ))}
        </g>
        <g style={{ animation: 'spin 90s linear infinite reverse', transformOrigin: 'center' }}>
          <path d="M -60 0 C -40 -40, 40 -40, 60 0" fill="none" stroke="#f472b6" strokeWidth="0.8" strokeDasharray="3 3" />
          <path d="M -60 10 C -40 -30, 40 -30, 60 10" fill="none" stroke="#a78bfa" strokeWidth="0.5" strokeDasharray="1 3" />
        </g>
      </svg>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
      <div className="relative z-10 flex max-h-full w-full max-w-xl flex-col items-center gap-3 overflow-auto p-6 text-center">
        <div className="text-5xl" style={{ animation: 'floaty 4s ease-in-out infinite' }}>🛰️</div>
        <h1 className="bg-gradient-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-4xl font-black uppercase tracking-widest text-transparent sm:text-5xl">Orbital Foundry</h1>
        <div className="-mt-2 text-sm font-semibold uppercase tracking-[0.5em] text-cyan-400/80">Logistics</div>
        <p className="max-w-md text-sm text-slate-300">
          Automate a factory on a spinning space ring where <b className="text-cyan-300">Coriolis drift</b> bends your conveyors, power is a tug-of-war with the spin, and pirates raid your supply lines.
        </p>
        <div className="mt-2 grid w-full max-w-xs gap-2">
          <Btn variant="primary" className="py-3 text-base" onClick={onPlay}>
            ▶ New Campaign
          </Btn>
          <Btn variant="default" onClick={onTutorial}>
            🎓 {save.tutorialDone ? 'Replay Training' : 'Interactive Training'}
          </Btn>
          <Btn variant="gold" onClick={onLegacy}>
            🏛️ Foundry Legacy · {save.legacy} LP
          </Btn>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="ghost" onClick={onHelp}>
              📘 How to Play
            </Btn>
            <Btn variant="ghost" onClick={onSettings}>
              ⚙️ Settings
            </Btn>
          </div>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          Runs: {save.best.runs} · Victories: {save.best.wins} · Best raid: {save.best.wave}/10 · Best score: {save.best.score} · Pirates downed: {save.best.kills}
        </div>
      </div>
    </div>
  );
}

export function SetupModal({ setup, onChange, onStart, onClose }: { setup: Setup; onChange: (s: Setup) => void; onStart: () => void; onClose: () => void }) {
  const d = DIFFS.find((x) => x.id === setup.diff) || DIFFS[1];
  const nm = (setup.mods.storm ? 1 : 0) + (setup.mods.frenzy ? 1 : 0) + (setup.mods.brown ? 1 : 0);
  const mult = d.lp * (1 + 0.2 * nm);
  return (
    <Modal title="🚀 Mission Briefing" onClose={onClose} wide>
      <p className="mb-3 text-sm text-slate-300">Survive 10 raids and destroy the Dreadnought. Choose how hard the pirates hit.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {DIFFS.map((x) => (
          <button
            key={x.id}
            onClick={() => onChange({ ...setup, diff: x.id })}
            className={`rounded-xl border p-3 text-left transition ${setup.diff === x.id ? 'border-cyan-400 bg-cyan-500/15' : 'border-white/10 bg-slate-800/60 hover:bg-slate-700/60'}`}
          >
            <div className="text-lg font-bold text-slate-100">{x.name}</div>
            <div className="mb-1 text-xs text-slate-400">{x.desc}</div>
            <div className="text-xs text-slate-300">
              Enemy HP ×{x.hp} · Raid size ×{x.count} · Credits ×{x.credits} · Gaps ×{x.interval}
            </div>
            <div className="mt-1 text-xs text-amber-300">Legacy ×{x.lp}</div>
          </button>
        ))}
      </div>
      <h3 className="mb-2 mt-4 font-bold text-cyan-300">Modifiers</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODS.map((m) => {
          const on = setup.mods[m.id];
          return (
            <button
              key={m.id}
              onClick={() => onChange({ ...setup, mods: { ...setup.mods, [m.id]: !on } })}
              className={`rounded-xl border p-3 text-left transition ${on ? 'border-amber-400 bg-amber-400/15' : 'border-white/10 bg-slate-800/60 hover:bg-slate-700/60'}`}
            >
              <div className="font-semibold text-slate-100">
                {m.icon} {m.name} {on && <span className="text-amber-300">· ON</span>}
              </div>
              <div className="text-xs text-slate-400">{m.desc}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Btn variant="primary" className="py-3 text-base" onClick={onStart}>
          Launch ▶
        </Btn>
        <Btn variant="ghost" onClick={onClose}>
          Back
        </Btn>
        <span className="ml-auto text-sm text-amber-300">Total Legacy multiplier ×{mult.toFixed(2)}</span>
      </div>
    </Modal>
  );
}
