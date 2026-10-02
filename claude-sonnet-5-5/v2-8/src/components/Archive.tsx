import { useState } from "react";
import { audio } from "../game/audio";
import { META } from "../game/data";
import type { SaveData } from "../game/save";

interface Props { save: SaveData; onBuy: (id: string) => void; onReset: () => void; onBack: () => void; }

export default function Archive({ save, onBuy, onReset, onBack }: Props) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="absolute inset-0 overflow-y-auto scroll-thin bg-gradient-to-b from-[#07101f] to-[#14304f] p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap justify-between items-end gap-2">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl text-amber-300">EXPEDITION ARCHIVE</h2>
            <p className="text-sky-100/70 text-sm">Spend Renown earned from expeditions on permanent upgrades and unlocks.</p>
          </div>
          <div className="panel px-4 py-2 text-right"><div className="text-xs text-white/50">RENOWN</div><div className="font-display text-3xl text-amber-300">{save.renown}</div></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-5">
          {META.map((m) => {
            const lvl = save.levels[m.id] || 0;
            const maxed = lvl >= m.max;
            const cost = m.costs[Math.min(lvl, m.costs.length - 1)];
            const can = !maxed && save.renown >= cost;
            return (
              <div key={m.id} className="panel p-3 flex gap-3 items-center">
                <div className="text-3xl">{m.icon}</div>
                <div className="flex-1">
                  <div className="font-bold">{m.name}</div>
                  <div className="text-xs text-white/60">{m.desc}</div>
                  <div className="flex gap-1 mt-1">
                    {Array.from({ length: m.max }).map((_, i) => <span key={i} className={`w-3 h-3 rounded-full ${i < lvl ? "bg-amber-400" : "bg-white/15"}`} />)}
                  </div>
                </div>
                <button className="btn btn-sm btn-primary" disabled={!can} onClick={() => { onBuy(m.id); audio.sfx("buy"); }}>
                  {maxed ? (m.unlock ? "Unlocked" : "Max") : `${cost} ★`}
                </button>
              </div>
            );
          })}
        </div>
        <div className="panel p-3 mt-5 text-sm grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div><div className="text-white/50 text-xs">Expeditions</div><b>{save.life.runs}</b></div>
          <div><div className="text-white/50 text-xs">Victories</div><b>{save.life.wins}</b></div>
          <div><div className="text-white/50 text-xs">Best score</div><b>{save.life.bestScore}</b></div>
          <div><div className="text-white/50 text-xs">Best legs</div><b>{save.life.bestLegs}/6</b></div>
          <div><div className="text-white/50 text-xs">Raiders downed</div><b>{save.life.raiders}</b></div>
        </div>
        <div className="mt-5 flex justify-between items-center">
          <button className="btn" onClick={() => { audio.sfx("back"); onBack(); }}>← Back</button>
          {!confirm ? (
            <button className="btn btn-sm btn-danger" onClick={() => setConfirm(true)}>Reset all progress</button>
          ) : (
            <div className="flex gap-2 items-center text-sm">Really erase everything?
              <button className="btn btn-sm btn-danger" onClick={() => { onReset(); setConfirm(false); }}>Yes, erase</button>
              <button className="btn btn-sm" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
