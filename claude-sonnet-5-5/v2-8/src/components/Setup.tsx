import { audio } from "../game/audio";
import { DIFFS, MODS } from "../game/data";

interface Props {
  diff: number; mods: string[]; onDiff: (i: number) => void; onMod: (id: string) => void;
  onBegin: () => void; onBack: () => void;
}

export default function Setup({ diff, mods, onDiff, onMod, onBegin, onBack }: Props) {
  const d = DIFFS[diff] ?? DIFFS[1];
  const modBonus = mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus ?? 0), 0);
  const mult = d.renown * (1 + modBonus);
  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin bg-gradient-to-b from-[#041024] to-[#0c3156] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-display text-4xl sm:text-5xl text-amber-300">PLAN YOUR EXPEDITION</h2>
        <p className="text-sky-100/70 text-sm mb-4">Choose a difficulty and optional modifiers. Harder settings earn more Renown. You can adjust difficulty from the pause menu mid-run.</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {DIFFS.map((x, i) => (
            <button key={x.id} onClick={() => { onDiff(i); audio.sfx("click"); }}
              className={`panel p-4 text-left transition-transform hover:-translate-y-1 ${i === diff ? "ring-2" : "opacity-80"}`} style={{ boxShadow: i === diff ? `0 0 0 2px ${x.color}` : undefined }}>
              <div className="font-display text-2xl" style={{ color: x.color }}>{x.name}</div>
              <div className="text-sm text-white/70 mt-1">{x.desc}</div>
              <div className="text-[11px] text-white/50 mt-2 space-y-0.5">
                <div>Crevasses ×{x.crev} · Cold ×{x.cold}</div>
                <div>Raiders ×{x.raid} · Fuel burn ×{x.fuel}</div>
                <div>Starting scrip ×{x.credits} · Renown ×{x.renown}</div>
              </div>
            </button>
          ))}
        </div>
        <h3 className="font-display text-2xl text-sky-200 mt-6 mb-2">MODIFIERS</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {MODS.map((m) => {
            const on = mods.includes(m.id);
            return (
              <button key={m.id} onClick={() => { onMod(m.id); audio.sfx("click"); }} className={`panel p-3 text-left flex items-center gap-3 ${on ? "ring-2 ring-amber-400" : "opacity-85"}`}>
                <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${on ? "bg-amber-400 text-black border-amber-200" : "border-white/40"}`}>{on ? "✔" : ""}</span>
                <span className="flex-1">
                  <span className="font-bold">{m.name}</span> <span className="text-amber-300 text-xs">+{Math.round(m.bonus * 100)}% renown</span>
                  <span className="block text-xs text-white/60">{m.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 justify-between">
          <div className="text-sm text-sky-100">Renown multiplier: <b className="text-amber-300">×{mult.toFixed(2)}</b></div>
          <div className="flex gap-3">
            <button className="btn" onClick={() => { audio.sfx("back"); onBack(); }}>← Back</button>
            <button className="btn btn-primary text-lg !px-8" onClick={() => { audio.sfx("click"); onBegin(); }}>To the Depot ➜</button>
          </div>
        </div>
      </div>
    </div>
  );
}
