import { useState } from "react";
import { CREATURES, DIFFS, GOODS, GOOD_IDS, PERKS, REGIONS } from "../game/data";
import { calcRenown, perkCost } from "../game/state";
import type { Campaign, Meta, SortieResult } from "../game/state";
import { Btn, Panel, Pips } from "./ui";
import { cn } from "../utils/cn";

function Sky({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-[#0b1236] via-[#27407e] to-[#f0a770]">
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white/20 blur-xl" style={{ top: `${8 + i * 12}%`, width: 200 + (i % 3) * 120, height: 50 + (i % 2) * 30, animation: `drift ${50 + i * 13}s linear infinite`, animationDelay: `-${i * 9}s` }} />
        ))}
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="absolute w-0.5 h-0.5 bg-white rounded-full opacity-60" style={{ top: `${(i * 37) % 45}%`, left: `${(i * 61) % 100}%` }} />
        ))}
      </div>
      <div className="relative h-full w-full scroll-y">{children}</div>
    </div>
  );
}

export function Airship({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 170" className={className}>
      <ellipse cx="120" cy="60" rx="95" ry="52" fill="#c8453a" stroke="#4a2e18" strokeWidth="3" />
      {[-60, -30, 0, 30, 60].map((x) => <path key={x} d={`M${120 + x} 10 Q${120 + x * 1.3} 60 ${120 + x} 110`} stroke="#f2e4c4" strokeWidth="9" fill="none" opacity="0.9" />)}
      <ellipse cx="120" cy="60" rx="95" ry="52" fill="url(#g)" />
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.28" /><stop offset="1" stopColor="#001" stopOpacity="0.3" /></linearGradient></defs>
      <path d="M70 108 L96 135 M170 108 L144 135 M120 112 L120 135" stroke="#4a2e18" strokeWidth="3" />
      <path d="M78 132 H162 Q158 162 134 164 H104 Q80 160 78 132Z" fill="#7b5330" stroke="#3a2615" strokeWidth="3" />
      {[96, 120, 144].map((x) => <circle key={x} cx={x} cy="148" r="5" fill="#ffd98a" />)}
      <rect x="62" y="140" width="8" height="12" fill="#444" /><rect x="58" y="132" width="3" height="28" fill="#ccd" />
      <path d="M108 8 V-8" stroke="#3a2615" strokeWidth="3" /><path d="M108 -8 L84 -2 L108 4Z" fill="#ffd23f" />
      <rect x="162" y="138" width="40" height="8" rx="3" fill="#2d2d33" transform="rotate(-18 162 138)" />
    </svg>
  );
}

export function TitleScreen({ hasSave, meta, onContinue, onNew, onHelp, onSettings, onLegacy }: {
  hasSave: boolean; meta: Meta; onContinue: () => void; onNew: () => void; onHelp: () => void; onSettings: () => void; onLegacy: () => void;
}) {
  return (
    <Sky>
      <div className="min-h-full flex flex-col items-center justify-center py-8 px-4 text-center">
        <Airship className="w-56 sm:w-72 bob drop-shadow-2xl" />
        <h1 className="title-text text-5xl sm:text-7xl font-black tracking-wider mt-2" style={{ fontVariant: "small-caps" }}>Sky Whaler Fleet</h1>
        <p className="text-amber-100/90 italic mt-1 mb-6 text-lg">Hunt the leviathans of the high winds. Pay the Guild. Don't fall.</p>
        <div className="flex flex-col gap-2.5 w-72">
          {hasSave && <Btn onClick={onContinue} className="!py-3 text-lg glow">⚓ Continue Voyage</Btn>}
          <Btn variant={hasSave ? "steel" : "gold"} onClick={onNew} className="!py-3 text-lg">{hasSave ? "New Voyage" : "⚓ Begin Voyage"}</Btn>
          <Btn variant="steel" onClick={onLegacy}>🏅 Guild Legacy <span className="text-amber-300">({meta.renown} renown)</span></Btn>
          <Btn variant="steel" onClick={onHelp}>📖 How to Play</Btn>
          <Btn variant="steel" onClick={onSettings}>⚙ Settings</Btn>
        </div>
        <div className="mt-6 text-xs text-amber-100/70 max-w-md">
          WASD fly · Mouse aim · Hold LMB to charge, release to throw · Hold SPACE to reel · R to return · P pause<br />
          Campaigns: {meta.campaigns} · Victories: {meta.wins}{meta.bestDays ? ` · Fastest victory: ${meta.bestDays} days` : ""}
        </div>
      </div>
    </Sky>
  );
}

export function NewGameScreen({ onStart, onBack }: { onStart: (diff: number, storm: boolean, iron: boolean) => void; onBack: () => void }) {
  const [diff, setDiff] = useState(1); const [storm, setStorm] = useState(false); const [iron, setIron] = useState(false);
  return (
    <Sky>
      <div className="min-h-full flex items-center justify-center p-4">
        <Panel title="Chart Your Voyage" className="w-full max-w-3xl">
          <div className="grid sm:grid-cols-3 gap-3">
            {DIFFS.map((d, i) => (
              <button key={d.name} onClick={() => setDiff(i)} className={cn("text-left p-3 rounded-xl border-2 transition", diff === i ? "border-amber-300 bg-amber-400/15" : "border-white/15 bg-black/30 hover:border-white/40")}>
                <div className="font-bold text-lg text-amber-200">{["🌤", "🌬", "🌩"][i]} {d.name}</div>
                <div className="text-sm text-amber-100/80 mb-2">{d.desc}</div>
                <div className="text-xs text-amber-100/70">Start {d.crowns}¢ · Beast damage ×{d.dmg} · Tribute ×{d.tribute}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-3">
            <button onClick={() => setStorm(!storm)} className={cn("text-left p-3 rounded-xl border-2", storm ? "border-violet-300 bg-violet-400/15" : "border-white/15 bg-black/30")}>
              <div className="font-bold text-violet-200">{storm ? "☑" : "☐"} ⛈ Storm Season</div>
              <div className="text-xs text-amber-100/80">Fronts form far more often, oil sells +25%, fuel costs more.</div>
            </button>
            <button onClick={() => setIron(!iron)} className={cn("text-left p-3 rounded-xl border-2", iron ? "border-rose-300 bg-rose-400/15" : "border-white/15 bg-black/30")}>
              <div className="font-bold text-rose-200">{iron ? "☑" : "☐"} ☠ Iron Crew</div>
              <div className="text-xs text-amber-100/80">A wreck can kill a crew member. +30% renown.</div>
            </button>
          </div>
          <div className="flex gap-2 mt-5">
            <Btn variant="steel" onClick={onBack}>← Back</Btn>
            <Btn className="flex-1 !py-3 text-lg" onClick={() => onStart(diff, storm, iron)} sfx="bell">Set Sail</Btn>
          </div>
        </Panel>
      </div>
    </Sky>
  );
}

export function LegacyScreen({ meta, onBuy, onBack }: { meta: Meta; onBuy: (id: string) => void; onBack: () => void }) {
  return (
    <Sky>
      <div className="min-h-full flex items-center justify-center p-4">
        <Panel title="Guild Legacy" className="w-full max-w-2xl" right={<span className="text-amber-300 font-bold">🏅 {meta.renown} renown</span>}>
          <p className="text-sm text-amber-100/80 mb-3">Renown is earned at the end of every voyage — win or lose — and buys permanent perks that apply to all future campaigns.</p>
          {PERKS.map((p) => {
            const lv = meta.perks[p.id] || 0; const maxed = lv >= p.max; const cost = perkCost(p.id, lv);
            return (
              <div key={p.id} className="flex items-center gap-3 py-2 border-b border-white/10">
                <div className="flex-1"><div className="font-bold text-amber-200">{p.name}</div><div className="text-xs text-amber-100/70">{p.desc}</div></div>
                <Pips n={lv} max={p.max} />
                <Btn className="!px-3 !py-1 text-sm w-24" disabled={maxed || meta.renown < cost} onClick={() => onBuy(p.id)} sfx="buy">{maxed ? "MAX" : `${cost} 🏅`}</Btn>
              </div>
            );
          })}
          <Btn variant="steel" className="mt-4" onClick={onBack}>← Back</Btn>
        </Panel>
      </div>
    </Sky>
  );
}

export function ResultScreen({ res, msgs, fresh, camp, onContinue }: { res: SortieResult; msgs: string[]; fresh: string[]; camp: Campaign; onContinue: () => void }) {
  const title = { return: "Safe Return", wreck: "Shipwrecked!", adrift: "Towed Home", apex: "APEX SLAIN!" }[res.outcome];
  const color = res.outcome === "wreck" ? "text-rose-300" : res.outcome === "apex" ? "text-yellow-200" : res.outcome === "adrift" ? "text-orange-300" : "text-emerald-300";
  const kills = Object.entries(res.kills);
  const total = kills.reduce((a, [, n]) => a + n, 0);
  const mins = Math.floor(res.time / 60), secs = Math.floor(res.time % 60);
  return (
    <Sky>
      <div className="min-h-full flex items-center justify-center p-4">
        <Panel className="w-full max-w-2xl">
          <h2 className={cn("text-4xl font-black text-center mb-1", color)}>{title}</h2>
          <div className="text-center text-amber-100/70 text-sm mb-4">{REGIONS[camp.loc].name} · hunt lasted {mins}:{secs.toString().padStart(2, "0")}</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <div className="font-bold text-amber-200 mb-1">Hunt Summary</div>
              <div className="text-sm space-y-0.5">
                <div className="flex justify-between"><span>Creatures slain</span><b>{total}</b></div>
                <div className="flex justify-between"><span>Plunder</span><b className="text-yellow-300">{res.crowns}¢</b></div>
                <div className="flex justify-between"><span>Harpoons hit / thrown</span><b>{res.hits}/{res.harpoons}</b></div>
                <div className="flex justify-between"><span>Bullseyes</span><b>{res.bullseyes}</b></div>
                <div className="flex justify-between"><span>Ropes snapped</span><b>{res.snaps}</b></div>
                <div className="flex justify-between"><span>Hull damage taken</span><b>{Math.round(res.damage)}</b></div>
                <div className="flex justify-between"><span>Loot lost</span><b>{res.lost}</b></div>
              </div>
              <div className="font-bold text-amber-200 mt-3 mb-1">Kills</div>
              <div className="flex flex-wrap gap-1.5">{kills.length === 0 ? <span className="text-sm text-amber-100/60">None.</span> : kills.map(([k, n]) => <span key={k} className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-sm">{CREATURES[k as keyof typeof CREATURES].name} ×{n}</span>)}</div>
            </div>
            <div>
              <div className="font-bold text-amber-200 mb-1">Loot Landed</div>
              <div className="flex flex-wrap gap-2 mb-3">{GOOD_IDS.filter((g) => res.gained[g] > 0).map((g) => <span key={g} className="px-2 py-1 rounded bg-black/30 border border-white/10" style={{ color: GOODS[g].color }}>{GOODS[g].icon} {GOODS[g].name} ×{res.gained[g]}</span>)}{GOOD_IDS.every((g) => !res.gained[g]) && <span className="text-sm text-amber-100/60">Nothing.</span>}</div>
              <div className="font-bold text-amber-200 mb-1">Dispatches</div>
              <div className="text-sm space-y-1 text-amber-50/90 max-h-40 scroll-y">{msgs.map((m, i) => <div key={i}>• {m}</div>)}{msgs.length === 0 && <div className="text-amber-100/60">A quiet day.</div>}</div>
              {fresh.length > 0 && <div className="mt-2 text-sm text-yellow-200">{fresh.map((f) => <div key={f}>🏆 Achievement: <b>{f}</b></div>)}</div>}
            </div>
          </div>
          <Btn className="w-full mt-5 !py-3 text-lg" onClick={onContinue}>Continue</Btn>
        </Panel>
      </div>
    </Sky>
  );
}

export function EndScreen({ kind, camp, renownGain, onNew, onTitle, onContinue }: {
  kind: "win" | "lose"; camp: Campaign; renownGain: number; onNew: () => void; onTitle: () => void; onContinue?: () => void;
}) {
  const win = kind === "win"; const s = camp.stats;
  const reason = win ? "The Leviathan Aurelion falls from the sky. The Storm Heart is yours, and your name will be sung in every port." : camp.over === "tribute" ? "The Guild collectors arrived for their tribute and found your coffers empty. They seized the Merry Leviathan and her fleet." : "Your voyage has ended.";
  return (
    <Sky>
      <div className="min-h-full flex items-center justify-center p-4">
        <Panel className="w-full max-w-2xl text-center">
          <div className="text-6xl mb-1">{win ? "👑" : "💀"}</div>
          <h2 className={cn("text-5xl font-black mb-2", win ? "title-text" : "text-rose-300")}>{win ? "VICTORY" : "GAME OVER"}</h2>
          <p className="text-amber-100/90 mb-4">{reason}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-4">
            {[["Days", camp.day], ["Beasts slain", s.kills], ["Apex slain", `${s.apex}/6`], ["Hunts", s.sorties], ["Crowns earned", s.earned], ["Tribute paid", s.tribute], ["Wrecks", s.wrecks], ["Bullseyes", s.bullseyes]].map(([k, v]) => (
              <div key={String(k)} className="rounded-lg bg-black/30 border border-white/10 p-2"><div className="text-xs text-amber-100/60">{k}</div><div className="font-bold text-lg">{v}</div></div>
            ))}
          </div>
          <div className="text-lg mb-1 text-amber-200">🏅 Renown earned: <b>+{renownGain}</b></div>
          <div className="text-xs text-amber-100/60 mb-4">Score {calcRenown(camp)} · spend renown in Guild Legacy for permanent perks.</div>
          <div className="flex flex-wrap gap-2 justify-center">
            {win && onContinue && <Btn variant="green" onClick={onContinue}>⛵ Keep Sailing (free play)</Btn>}
            <Btn onClick={onNew}>🔄 New Voyage</Btn>
            <Btn variant="steel" onClick={onTitle}>🏠 Title</Btn>
          </div>
        </Panel>
      </div>
    </Sky>
  );
}
