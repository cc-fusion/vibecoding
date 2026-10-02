import type { SaveData } from '../game/storage';

export function Title({ save, onPlay, onLegacy, onHelp, onSettings }: { save: SaveData; onPlay: () => void; onLegacy: () => void; onHelp: () => void; onSettings: () => void }) {
  return (
    <div className="water-bg fade-in absolute inset-0 overflow-hidden">
      <svg className="absolute inset-x-0 bottom-0 h-[55%] w-full" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice" aria-hidden>
        <defs>
          <linearGradient id="stone" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d9c9a0" /><stop offset="1" stopColor="#8f7d5b" /></linearGradient>
        </defs>
        <path d="M0 330 Q200 250 400 300 T800 280 T1200 300 V400 H0Z" fill="#1b4a3c" opacity="0.8" />
        <rect x="0" y="120" width="1200" height="34" fill="url(#stone)" opacity="0.9" />
        <rect x="0" y="132" width="1200" height="10" fill="#5cc3e8" opacity="0.9" />
        <line x1="0" y1="137" x2="1200" y2="137" stroke="#e8f8ff" strokeWidth="3" strokeDasharray="14 22" opacity="0.9">
          <animate attributeName="stroke-dashoffset" from="72" to="0" dur="2.2s" repeatCount="indefinite" />
        </line>
        {Array.from({ length: 9 }, (_, i) => (
          <g key={i}>
            <rect x={i * 150 + 4} y="154" width="142" height="190" fill="url(#stone)" />
            <path d={`M${i * 150 + 22} 344 V250 A53 53 0 0 1 ${i * 150 + 128} 250 V344Z`} fill="#10242b" />
          </g>
        ))}
        <rect x="0" y="344" width="1200" height="60" fill="#0e3b4c" />
        <rect x="0" y="352" width="1200" height="4" fill="#5cc3e8" opacity="0.5">
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite" />
        </rect>
      </svg>
      <div className="relative z-10 flex h-full flex-col items-center justify-start gap-5 px-4 pt-[7vh]">
        <div className="text-center">
          <div className="text-4xl sm:text-5xl">🏛️💧</div>
          <h1 className="font-display mt-2 text-4xl font-black leading-tight text-[var(--gold)] drop-shadow-[0_3px_0_rgba(0,0,0,0.5)] sm:text-6xl">Aqueduct<br />Architects</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--ink)]/85 sm:text-base">Carry water over valleys and under hills. Feed a growing city, drain its waste, and weather flood, drought and plague.</p>
        </div>
        <div className="panel pop-in flex w-64 flex-col gap-3 p-4">
          <button className="btn btn-gold" onClick={onPlay}>▶ Campaign</button>
          <button className="btn" onClick={onLegacy}>🏺 Legacy Hall <span className="chip ml-1">{save.legacyPoints} LP</span></button>
          <button className="btn btn-alt" onClick={onHelp}>📖 How to Play</button>
          <button className="btn btn-alt" onClick={onSettings}>⚙ Settings</button>
        </div>
        <div className="text-xs text-[var(--ink-dim)]">
          Maps cleared: {Math.max(0, save.unlocked - 1)}/4 · Victories {save.totals.wins} · Defeats {save.totals.losses}
        </div>
      </div>
    </div>
  );
}
