import type { Run } from "../game/run";

export interface EndInfo { win: boolean; reason: string; score: number; renown: number; best: boolean; }

export default function EndScreen({ run, info, onRetry, onSetup, onTitle, onArchive }: {
  run: Run; info: EndInfo; onRetry: () => void; onSetup: () => void; onTitle: () => void; onArchive: () => void;
}) {
  const s = run.stats;
  const alive = run.crew.filter((c) => c.alive).length;
  const mins = Math.floor(s.time / 60), secs = Math.floor(s.time % 60);
  const rows: [string, string | number][] = [
    ["Distance", `${(s.distance / 100).toFixed(1)} km`], ["Legs completed", `${s.legs}/6`], ["Time", `${mins}m ${secs}s`],
    ["Crew surviving", `${alive}/${run.crew.length}`], ["Crew lost", s.crewLost], ["Vehicles lost", s.vehiclesLost],
    ["Jumps", s.jumps], ["Bridges laid", s.bridges], ["Falls into crevasses", s.falls],
    ["Raiders downed", s.raiders], ["Ice quakes", s.quakes], ["Camps", s.camps],
    ["Trade profit", `${s.profit} 💰`], ["Contracts", s.contracts], ["Crates found", s.pickups],
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3 overflow-y-auto"
      style={{ background: info.win ? "radial-gradient(circle at 50% 30%,rgba(255,200,100,.35),rgba(2,8,19,.95) 70%)" : "radial-gradient(circle at 50% 30%,rgba(255,60,60,.25),rgba(2,8,19,.96) 70%)" }}>
      <div className="panel pop-in max-w-3xl w-full p-5 sm:p-8 my-auto">
        <div className="text-center">
          <div className="text-6xl">{info.win ? "🏁" : "💀"}</div>
          <h2 className={`font-display text-5xl sm:text-6xl ${info.win ? "text-amber-300" : "text-red-400"}`}>{info.win ? "POLARIS REACHED" : "EXPEDITION LOST"}</h2>
          <p className="text-sky-50/85 mt-2">{info.win ? `The caravan rolls into Polaris Station with ${alive} survivor${alive === 1 ? "" : "s"}. The shelf collapses behind you.` : info.reason}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5 text-sm">
          {rows.map(([a, b]) => (
            <div key={a} className="rounded-lg bg-black/30 px-3 py-2 flex justify-between gap-2"><span className="text-white/55">{a}</span><b>{b}</b></div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3 justify-center items-center">
          <div className="panel px-5 py-2 text-center"><div className="text-xs text-white/50">SCORE</div><div className="font-display text-4xl text-amber-300">{info.score}</div>{info.best && <div className="text-xs text-emerald-300">★ New best!</div>}</div>
          <div className="panel px-5 py-2 text-center"><div className="text-xs text-white/50">RENOWN EARNED</div><div className="font-display text-4xl text-sky-200">+{info.renown}</div></div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          <button className="btn btn-primary" onClick={onRetry}>↻ {info.win ? "Play Again" : "Retry"} (same settings)</button>
          <button className="btn" onClick={onSetup}>⚙ Change difficulty</button>
          <button className="btn" onClick={onArchive}>🏛 Spend Renown</button>
          <button className="btn" onClick={onTitle}>Title</button>
        </div>
      </div>
    </div>
  );
}
