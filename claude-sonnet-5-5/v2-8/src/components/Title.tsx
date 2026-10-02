import { audio } from "../game/audio";
import type { SaveData } from "../game/save";

interface Props {
  save: SaveData;
  onStart: () => void; onTutorial: () => void; onHelp: () => void; onArchive: () => void; onSettings: () => void;
  onMute: () => void;
}

export default function Title({ save, onStart, onTutorial, onHelp, onArchive, onSettings, onMute }: Props) {
  const go = (f: () => void) => () => { audio.init(); audio.startMusic(); audio.sfx("click"); f(); };
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ background: "linear-gradient(180deg,#040a1c 0%,#0b2a4a 45%,#2b6a96 75%,#bfe3f7 100%)" }}>
      <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 30% at 30% 18%,rgba(60,255,170,.35),transparent 70%),radial-gradient(50% 25% at 70% 12%,rgba(150,100,255,.3),transparent 70%)", filter: "blur(18px)" }} />
      <div className="absolute inset-0 title-snow" />
      <svg className="absolute bottom-0 left-0 w-full h-[46%]" viewBox="0 0 1200 400" preserveAspectRatio="xMidYMax slice">
        <path d="M0 260 L120 150 L210 220 L330 90 L450 230 L560 140 L700 250 L820 120 L960 240 L1080 160 L1200 230 L1200 400 L0 400Z" fill="#17375a" />
        <path d="M0 300 L150 220 L260 280 L400 190 L540 290 L700 210 L860 300 L1010 230 L1200 300 L1200 400 L0 400Z" fill="#cfe9f8" opacity=".9" />
        <path d="M0 340 Q300 300 600 335 T1200 320 L1200 400 L0 400Z" fill="#eaf7ff" />
        <path d="M-10 365 L1210 345" stroke="#0a2038" strokeWidth="14" strokeLinecap="round" opacity=".85" />
        <g transform="translate(420 322)">
          <rect x="0" y="0" width="70" height="26" rx="6" fill="#e8892b" /><rect x="46" y="4" width="18" height="12" rx="3" fill="#17324d" />
          <rect x="-62" y="4" width="54" height="22" rx="5" fill="#4aa3c7" /><rect x="-124" y="4" width="54" height="22" rx="5" fill="#b05a7a" />
          <rect x="-186" y="4" width="54" height="22" rx="5" fill="#6d7fa8" />
          <circle cx="66" cy="20" r="3" fill="#fff6c0" />
          <path d="M70 18 L220 0 L220 40Z" fill="#fff6c0" opacity=".2" />
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-[6vh] px-4 overflow-y-auto">
        <div className="text-center">
          <div className="text-xs sm:text-sm tracking-[0.5em] text-sky-200/80">A SURVIVAL EXPEDITION ACROSS THE MOVING ICE</div>
          <h1 className="font-display text-6xl sm:text-8xl font-bold leading-none mt-2" style={{ color: "#f4fbff", textShadow: "0 0 30px rgba(120,200,255,.7), 0 4px 0 #0a2d52" }}>
            GLACIER<br />CARAVAN
          </h1>
        </div>
        <div className="mt-6 sm:mt-8 flex flex-col gap-2.5 w-full max-w-xs">
          <button className="btn btn-primary text-lg py-3" onClick={go(onStart)}>▶ New Expedition</button>
          <button className="btn" onClick={go(onTutorial)}>🎓 Tutorial {save.tutorialDone && <span className="text-emerald-300">✔</span>}</button>
          <button className="btn" onClick={go(onArchive)}>🏛 Expedition Archive <span className="text-amber-300">· {save.renown} renown</span></button>
          <button className="btn" onClick={go(onHelp)}>❓ How to Play & Controls</button>
          <button className="btn" onClick={go(onSettings)}>⚙ Settings</button>
          <button className="btn btn-sm" onClick={onMute}>{save.settings.muted ? "🔇 Sound off (M)" : "🔊 Sound on (M)"}</button>
        </div>
        <div className="mt-5 text-[11px] text-sky-100/70 text-center bg-[#04101f]/60 rounded-lg px-3 py-2">
          Expeditions {save.life.runs} · Victories {save.life.wins} · Best score {save.life.bestScore} · Total distance {(save.life.distance / 100).toFixed(0)} km
        </div>
      </div>
    </div>
  );
}
