import { useMemo, useState } from "react";
import { CITIES, DIFFS, MODS, PERKS, perkCost } from "../game/data";
import { audio } from "../game/audio";
import type { SaveData } from "../game/storage";
import { MaskLogo } from "./ui";

export function TitleScreen({ save, onPlay, onLegacy, onHelp, onSettings }: {
  save: SaveData; onPlay: () => void; onLegacy: () => void; onHelp: () => void; onSettings: () => void;
}) {
  const spores = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37) % 100, size: 3 + (i % 5) * 2, dur: 9 + (i % 7) * 2.5, delay: -(i * 1.3), op: 0.15 + (i % 4) * 0.08,
  })), []);
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden" style={{ background: "radial-gradient(ellipse at 50% 35%, #2d241a 0%, #120f0d 70%)" }}>
      <style>{`@keyframes rise { from { transform: translateY(105vh) translateX(0); } to { transform: translateY(-10vh) translateX(40px); } }`}</style>
      {spores.map((s, i) => (
        <div key={i} className="absolute rounded-full" style={{ left: `${s.left}%`, bottom: 0, width: s.size, height: s.size, background: "#8fcf74", opacity: s.op, filter: "blur(1px)", animation: `rise ${s.dur}s linear ${s.delay}s infinite` }} />
      ))}
      <div className="vignette" />
      <div className="relative z-10 flex flex-col items-center text-center px-4 anim-fade">
        <MaskLogo size={150} />
        <h1 className="font-title font-black text-4xl sm:text-6xl text-[#e8d9b5] mt-2" style={{ textShadow: "0 0 30px rgba(143,207,116,0.35), 0 4px 0 #000" }}>Plague Doctor's</h1>
        <h2 className="font-title font-bold text-2xl sm:text-4xl text-[#d8452f] tracking-[0.3em] -mt-1" style={{ textShadow: "0 3px 0 #000" }}>QUARANTINE</h2>
        <p className="italic text-[#a8977a] mt-3 max-w-md">Trace the contagion. Seal the wards. Calm the mob. Find the cure before the city forgets how to be afraid of you.</p>
        <div className="flex flex-col gap-2 mt-7 w-64">
          <button className="btn btn-primary text-lg py-3" onClick={() => { audio.sfx("ok"); onPlay(); }}>⚕ Begin the Vigil</button>
          <button className="btn" onClick={() => { audio.sfx("click"); onLegacy(); }}>📜 Legacy ({save.legacy} LP)</button>
          <button className="btn" onClick={() => { audio.sfx("click"); onHelp(); }}>❓ How to Play</button>
          <button className="btn" onClick={() => { audio.sfx("click"); onSettings(); }}>⚙ Settings</button>
        </div>
        <div className="mt-6 text-sm text-[#7d6e57] font-ui">
          Cities saved: {save.wins} won · {save.runs} vigils kept · {Math.round(save.totalSaved).toLocaleString()} lives saved
        </div>
      </div>
    </div>
  );
}

export function CitySelect({ save, onStart, onBack }: {
  save: SaveData; onStart: (cfg: { cityIdx: number; diffId: string; mods: string[]; tutorial: boolean }) => void; onBack: () => void;
}) {
  const [cityIdx, setCity] = useState(Math.min(save.unlocked - 1, CITIES.length - 1));
  const [diffId, setDiff] = useState(save.lastDiff);
  const [mods, setMods] = useState<string[]>(save.lastMods);
  const [tut, setTut] = useState(!save.tutorialDone);
  const diff = DIFFS.find((d) => d.id === diffId) || DIFFS[1];
  const mult = diff.mult * (1 + mods.reduce((a, id) => a + (MODS.find((m) => m.id === id)?.mult || 0), 0));
  const showTut = CITIES[cityIdx].tutorial;
  return (
    <div className="absolute inset-0 overflow-y-auto p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a2118 0%, #120f0d 75%)" }}>
      <div className="max-w-5xl mx-auto anim-fade">
        <div className="flex items-center justify-between mb-4">
          <button className="btn" onClick={() => { audio.sfx("click"); onBack(); }}>← Back</button>
          <h2 className="font-title text-2xl sm:text-3xl text-[#e8d9b5]">Choose a City</h2>
          <div className="w-16" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CITIES.map((c, i) => {
            const locked = i >= save.unlocked;
            const best = save.best[c.id];
            return (
              <button key={c.id} disabled={locked} onClick={() => { audio.sfx("select"); setCity(i); }}
                className={`card text-left p-3 transition ${cityIdx === i ? "!border-[#e0a53f] anim-pulse" : ""} ${locked ? "opacity-40" : "hover:-translate-y-1 hover:!border-[#8a6c45]"}`}>
                <div className="flex justify-between items-center">
                  <span className="font-title text-lg text-[#e8d9b5]">{locked ? "🔒 " : ""}{c.name}</span>
                  <span className="text-[#e0a53f] tracking-widest">{[0, 1, 2].map((k) => (best && best.stars > k ? "★" : "☆"))}</span>
                </div>
                <div className="text-xs text-[#a8977a] font-ui">{c.count} districts · {c.seeds} outbreak{c.seeds > 1 ? "s" : ""}</div>
                <p className="text-sm text-[#cdbd9a] mt-1">{locked ? "Win the previous city to unlock." : c.blurb}</p>
                {best && <div className="text-xs text-[#8fcf74] mt-1">Best score {best.score.toLocaleString()}</div>}
              </button>
            );
          })}
        </div>

        <h3 className="font-title text-lg text-[#e0a53f] mt-5 mb-2">Difficulty</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DIFFS.map((d) => (
            <button key={d.id} onClick={() => { audio.sfx("click"); setDiff(d.id); }} className={`card p-3 text-left ${diffId === d.id ? "!border-[#e0a53f]" : ""}`}>
              <div className="font-title" style={{ color: d.color }}>{d.name}</div>
              <div className="text-xs text-[#a8977a]">{d.desc}</div>
              <div className="text-xs text-[#cdbd9a] mt-1">Score x{d.mult} · Crimson on day {d.bossDay}</div>
            </button>
          ))}
        </div>

        <h3 className="font-title text-lg text-[#e0a53f] mt-5 mb-2">Modifiers <span className="text-sm text-[#a8977a]">(optional, boost score)</span></h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {MODS.map((m) => {
            const on = mods.includes(m.id);
            return (
              <button key={m.id} onClick={() => { audio.sfx("click"); setMods(on ? mods.filter((x) => x !== m.id) : [...mods, m.id]); }} className={`card p-2 text-left ${on ? "!border-[#d8452f] bg-[#2a1511]" : ""}`}>
                <div className="font-ui text-sm">{m.icon} {m.name} <span className="text-[#e0a53f]">+{Math.round(m.mult * 100)}%</span></div>
                <div className="text-xs text-[#a8977a]">{m.desc}</div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-6 card p-3">
          <div className="text-sm">
            <div>Total score &amp; Legacy multiplier: <b className="text-[#e0a53f] font-ui">x{mult.toFixed(2)}</b></div>
            {showTut && (
              <label className="flex items-center gap-2 mt-1 cursor-pointer"><input type="checkbox" checked={tut} onChange={(e) => setTut(e.target.checked)} /> Interactive tutorial</label>
            )}
          </div>
          <button className="btn btn-primary text-lg px-8 py-3" onClick={() => { audio.sfx("ok"); onStart({ cityIdx, diffId, mods, tutorial: !!showTut && tut }); }}>
            Enter {CITIES[cityIdx].name} →
          </button>
        </div>
      </div>
    </div>
  );
}

export function LegacyScreen({ save, onBuy, onBack }: { save: SaveData; onBuy: (id: string) => void; onBack: () => void }) {
  return (
    <div className="absolute inset-0 overflow-y-auto p-3 sm:p-6" style={{ background: "radial-gradient(ellipse at 50% 0%, #2a2118 0%, #120f0d 75%)" }}>
      <div className="max-w-4xl mx-auto anim-fade">
        <div className="flex items-center justify-between mb-4">
          <button className="btn" onClick={() => { audio.sfx("click"); onBack(); }}>← Back</button>
          <h2 className="font-title text-2xl sm:text-3xl text-[#e8d9b5]">Legacy</h2>
          <div className="font-ui text-[#e0a53f]">{save.legacy} LP</div>
        </div>
        <p className="text-[#a8977a] mb-4">Every vigil teaches you something. Spend Legacy Points on permanent advantages that apply to every future city.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERKS.map((p) => {
            const lvl = save.perks[p.id] || 0;
            const maxed = lvl >= p.max;
            const cost = perkCost(lvl);
            return (
              <div key={p.id} className="card p-3 flex gap-3 items-center">
                <div className="text-3xl">{p.icon}</div>
                <div className="flex-1">
                  <div className="font-title text-[#e8d9b5]">{p.name}</div>
                  <div className="text-sm text-[#a8977a]">{p.desc}</div>
                  <div className="flex gap-1 mt-1">{Array.from({ length: p.max }, (_, i) => <span key={i} className={`h-2 w-6 rounded ${i < lvl ? "bg-[#e0a53f]" : "bg-[#3a2e22]"}`} />)}</div>
                </div>
                <button className={`btn ${maxed ? "" : "btn-good"}`} disabled={maxed || save.legacy < cost} onClick={() => onBuy(p.id)}>{maxed ? "Max" : `${cost} LP`}</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
