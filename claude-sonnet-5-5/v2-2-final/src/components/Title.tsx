import { Btn } from './ui';
import type { Best } from '../game/meta';
import { fmt } from '../game/data';

export function Title({ hasSave, best, onNew, onContinue, onHelp, onSettings }: {
  hasSave: boolean; best: Best; onNew: () => void; onContinue: () => void; onHelp: () => void; onSettings: () => void;
}) {
  return (
    <div className="h-full w-full grid-bg relative overflow-auto scan">
      <style>{`@keyframes dashmove{to{stroke-dashoffset:-80}} @keyframes sweep{0%,100%{transform:rotate(-25deg)}50%{transform:rotate(25deg)}}`}</style>
      <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="#6ee7ff" strokeWidth="2">
          <rect x="120" y="90" width="560" height="320" />
          <line x1="120" y1="230" x2="680" y2="230" /><line x1="120" y1="270" x2="680" y2="270" />
          <line x1="260" y1="90" x2="260" y2="230" /><line x1="410" y1="90" x2="410" y2="230" /><line x1="560" y1="90" x2="560" y2="230" />
          <line x1="300" y1="270" x2="300" y2="410" /><line x1="480" y1="270" x2="480" y2="410" />
          <path d="M60 250 H200 V140 H340 V250 H520 V350 H620 V250 H740" stroke="#ffb347" strokeDasharray="10 10" style={{ animation: 'dashmove 2.5s linear infinite' }} />
        </g>
        <g transform="translate(560,160)"><g style={{ transformOrigin: '0 0', animation: 'sweep 4s ease-in-out infinite' }}><path d="M0 0 L120 -40 L120 40 Z" fill="rgba(255,77,94,0.35)" /></g><circle r="6" fill="#ff4d5e" /></g>
      </svg>
      <div className="relative z-10 min-h-full flex flex-col items-center justify-center px-4 py-10 text-center">
        <div className="text-xs tracking-[0.5em] text-[#6ee7ff] mb-3 uppercase">Plan it. Watch it burn. Fence the loot.</div>
        <h1 className="noir text-6xl sm:text-8xl leading-none text-white" style={{ textShadow: '0 0 30px rgba(110,231,255,0.5), 4px 4px 0 #0b1e3a' }}>MERIDIAN</h1>
        <h2 className="noir text-2xl sm:text-4xl mt-1 tracking-[0.35em]" style={{ color: '#ffb347' }}>HEIST SYNDICATE</h2>
        <div className="mt-10 flex flex-col gap-3 w-64">
          {hasSave && <Btn variant="primary" onClick={onContinue}>▶ Continue Campaign</Btn>}
          <Btn variant={hasSave ? '' : 'primary'} onClick={onNew}>★ New Syndicate</Btn>
          <Btn onClick={onHelp}>? How to Play</Btn>
          <Btn onClick={onSettings}>⚙ Settings & Audio</Btn>
        </div>
        <div className="mt-8 text-xs opacity-70 space-x-4">
          <span>Runs: {best.runs}</span><span>Vaults cracked: {best.wins}</span>{best.bestDay > 0 && <span>Fastest win: day {best.bestDay}</span>}<span>Best cash: {fmt(best.bestCash)}</span>
        </div>
        <div className="mt-3 text-[11px] opacity-50 max-w-md">Mouse / touch to plan. Space pause · B bail · 1-4 gadgets. Press any button to enable sound.</div>
      </div>
    </div>
  );
}
