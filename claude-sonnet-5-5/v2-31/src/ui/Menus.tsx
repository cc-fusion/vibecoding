import { useState } from "react";
import { BRANCHES, DIFFICULTIES, MUTATORS, RESEARCH } from "../game/data";
import type { SaveData } from "../game/save";

export function Backdrop({ children, dim }: { children: React.ReactNode; dim?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "linear-gradient(180deg,#05081a 0%,#0e1a3a 55%,#1b2a52 100%)" }}>
      <div className="sky-flash pointer-events-none absolute inset-0" />
      <div className="snow-layer pointer-events-none absolute inset-0" />
      <svg className="pointer-events-none absolute bottom-0 left-0 w-full" viewBox="0 0 1200 400" preserveAspectRatio="none" style={{ height: "52%" }}>
        <polygon fill="#16223f" points="0,400 0,230 120,120 220,210 340,70 470,220 580,140 700,240 820,90 950,230 1070,150 1200,250 1200,400" />
        <polygon fill="#0d162c" points="0,400 0,300 150,210 260,290 400,180 540,300 680,230 800,310 940,200 1080,300 1200,240 1200,400" />
        <polygon fill="#070d1c" points="0,400 0,350 200,290 330,350 520,280 700,360 900,300 1100,360 1200,330 1200,400" />
        <polygon fill="#cfe2ff" opacity="0.5" points="340,70 310,110 340,100 365,118" />
        <polygon fill="#cfe2ff" opacity="0.5" points="820,90 790,130 820,120 848,138" />
      </svg>
      {dim && <div className="absolute inset-0 bg-black/40" />}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}

export function Title({ save, onPlay, onTutorial, onResearch, onHelp, onSettings }: {
  save: SaveData; onPlay: () => void; onTutorial: () => void; onResearch: () => void; onHelp: () => void; onSettings: () => void;
}) {
  const best = Math.max(0, ...Object.values(save.best));
  return (
    <Backdrop>
      <div className="flex h-full flex-col items-center justify-center gap-5 overflow-y-auto px-4 py-6 text-center">
        <div className="fade-in">
          <div className="mb-1 text-sm tracking-[0.5em] text-sky-300/80">⚡ A MOUNTAIN DEFENSE ROGUELITE ⚡</div>
          <h1 className="font-title text-5xl font-black leading-tight text-sky-50 sm:text-7xl" style={{ textShadow: "0 0 30px rgba(120,170,255,0.8), 0 4px 0 #0a1230" }}>
            Stormcaller's<br />Pass
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-slate-300">Raise stone. Summon storms. Freeze, shatter and burn the armies sieging the mountain gate.</p>
        </div>
        <div className="pop-in flex w-full max-w-xs flex-col gap-3">
          <button className="btn primary !py-3 text-lg" onClick={onPlay}>⚔️ Defend the Pass</button>
          <button className={`btn ${!save.tutorialDone ? "gold pulse-glow" : ""}`} onClick={onTutorial}>📖 Training Grounds</button>
          <button className="btn" onClick={onResearch}>🔮 Sanctum <span className="text-amber-200">({save.aether} Aether)</span></button>
          <div className="flex gap-3">
            <button className="btn flex-1" onClick={onHelp}>❓ Help</button>
            <button className="btn flex-1" onClick={onSettings}>⚙️ Settings</button>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-slate-400">
          <span>Best wave: <b className="text-sky-200">{best || "—"}</b></span>
          <span>Victories: <b className="text-amber-200">{save.wins}</b></span>
          <span>Runs: <b className="text-sky-200">{save.runs}</b></span>
          <span>Foes slain: <b className="text-sky-200">{save.totalKills}</b></span>
          <span>Bosses: <b className="text-red-300">{save.bossKills}</b></span>
        </div>
        {!save.tutorialDone && <div className="text-sm text-amber-200/90">New here? The Training Grounds teach the elemental reactions in two minutes.</div>}
      </div>
    </Backdrop>
  );
}

export function Setup({ save, onStart, onBack }: { save: SaveData; onStart: (diff: string, muts: string[]) => void; onBack: () => void }) {
  const [diff, setDiff] = useState(save.lastDifficulty || "stormcaller");
  const [muts, setMuts] = useState<string[]>(save.mutators || []);
  const d = DIFFICULTIES.find((x) => x.id === diff) || DIFFICULTIES[1];
  const mutBonus = muts.reduce((s, id) => s + (MUTATORS.find((m) => m.id === id)?.aether || 0), 0);
  const mult = d.aether * (1 + mutBonus);
  return (
    <Backdrop dim>
      <div className="flex h-full flex-col items-center overflow-y-auto px-4 py-6">
        <h2 className="font-title mb-4 text-3xl font-bold text-sky-50">Choose Your Stand</h2>
        <div className="mb-5 grid w-full max-w-4xl gap-3 sm:grid-cols-3">
          {DIFFICULTIES.map((x) => (
            <button key={x.id} onClick={() => setDiff(x.id)} className={`panel p-4 text-left transition hover:-translate-y-1 ${diff === x.id ? "ring-2" : "opacity-80"}`} style={diff === x.id ? { boxShadow: `0 0 28px ${x.color}55`, borderColor: x.color } : {}}>
              <div className="font-title text-xl font-bold" style={{ color: x.color }}>{x.name}</div>
              <div className="mb-2 text-sm text-slate-300">{x.desc}</div>
              <div className="text-xs text-slate-400">Gate {x.gate} HP · Foes ×{x.hp.toFixed(1)} HP · ×{x.count.toFixed(2)} count · Aether ×{x.aether}</div>
              <div className="mt-1 text-xs text-sky-200">Best wave: {save.best[x.id] || "—"}</div>
            </button>
          ))}
        </div>
        <h3 className="font-title mb-2 text-xl text-sky-100">Mutators <span className="text-sm text-slate-400">(optional, earn bonus Aether)</span></h3>
        <div className="mb-5 grid w-full max-w-4xl gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MUTATORS.map((m) => {
            const on = muts.includes(m.id);
            return (
              <button key={m.id} onClick={() => setMuts(on ? muts.filter((x) => x !== m.id) : [...muts, m.id])} className={`panel flex items-center gap-3 px-3 py-2 text-left transition ${on ? "ring-2 ring-amber-300" : "opacity-75 hover:opacity-100"}`}>
                <span className="text-2xl">{m.icon}</span>
                <span className="flex-1"><span className="block font-semibold text-slate-100">{m.name}</span><span className="block text-xs text-slate-400">{m.desc}</span></span>
                <span className="text-xs font-bold text-amber-200">+{Math.round(m.aether * 100)}%</span>
              </button>
            );
          })}
        </div>
        <div className="mb-4 text-slate-300">Aether reward multiplier: <b className="text-amber-200">×{mult.toFixed(2)}</b></div>
        <div className="flex gap-3">
          <button className="btn" onClick={onBack}>← Back</button>
          <button className="btn primary !px-8" onClick={() => onStart(diff, muts)}>Begin ⚡</button>
        </div>
      </div>
    </Backdrop>
  );
}

export function Research({ save, onBuy, onRefund, onBack }: { save: SaveData; onBuy: (id: string) => void; onRefund: () => void; onBack: () => void }) {
  const lv = save.research;
  const spent = RESEARCH.reduce((s, n) => { let t = 0; for (let i = 0; i < (lv[n.id] || 0); i++) t += n.costs[i]; return s + t; }, 0);
  return (
    <Backdrop dim>
      <div className="flex h-full flex-col px-3 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-title text-3xl font-bold text-sky-50">The Sanctum</h2>
            <div className="text-sm text-slate-400">Permanent research. Aether is earned from every run, win or lose.</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="panel px-4 py-2 text-lg font-bold text-amber-200">🔮 {save.aether} Aether</div>
            <button className="btn !px-3 !py-2 text-sm" disabled={spent === 0} onClick={onRefund} title="Refund every purchase so you can re-spend">Respec</button>
            <button className="btn" onClick={onBack}>← Back</button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 gap-3 overflow-auto md:grid-cols-5">
          {BRANCHES.map((b) => (
            <div key={b.id} className="flex min-w-[210px] flex-col gap-2">
              <div className="font-title rounded-lg px-3 py-1 text-center text-lg font-bold" style={{ color: b.color, background: b.color + "1a", border: `1px solid ${b.color}55` }}>{b.icon} {b.name}</div>
              {RESEARCH.filter((n) => n.branch === b.id).map((n) => {
                const cur = lv[n.id] || 0;
                const max = n.costs.length;
                const reqOk = !n.req || (lv[n.req] || 0) >= 1;
                const cost = cur < max ? n.costs[cur] : 0;
                const can = reqOk && cur < max && save.aether >= cost;
                const reqName = n.req ? RESEARCH.find((x) => x.id === n.req)?.name : "";
                return (
                  <button key={n.id} disabled={!can} onClick={() => onBuy(n.id)}
                    className={`panel p-3 text-left transition ${can ? "hover:-translate-y-0.5 hover:brightness-125 cursor-pointer" : "cursor-default"} ${!reqOk ? "opacity-40" : ""} ${cur >= max ? "ring-1 ring-amber-300/60" : ""}`}
                    style={can ? { boxShadow: `0 0 16px ${b.color}44` } : {}}>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{n.icon}</span>
                      <span className="flex-1 text-sm font-bold text-slate-100">{n.name}</span>
                      <span className="flex gap-0.5">{n.costs.map((_, i) => <span key={i} className="h-2 w-2 rounded-full" style={{ background: i < cur ? b.color : "#33405f" }} />)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-300">{n.desc}</div>
                    <div className="mt-1 text-xs font-semibold">
                      {cur >= max ? <span className="text-amber-300">✔ Mastered</span> : !reqOk ? <span className="text-slate-400">🔒 Requires {reqName}</span> : <span className={save.aether >= cost ? "text-amber-200" : "text-red-300"}>🔮 {cost} Aether</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Backdrop>
  );
}
