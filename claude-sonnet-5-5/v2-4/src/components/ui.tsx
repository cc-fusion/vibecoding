import type { ReactNode } from "react";
import { audio } from "../game/audio";
import type { Settings } from "../game/storage";

export function MaskLogo({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className="anim-float" aria-label="Plague doctor mask">
      <defs>
        <radialGradient id="glow" cx="50%" cy="40%" r="60%"><stop offset="0%" stopColor="#8fcf74" stopOpacity="0.35" /><stop offset="100%" stopColor="#8fcf74" stopOpacity="0" /></radialGradient>
        <linearGradient id="hat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2a2119" /><stop offset="100%" stopColor="#14100c" /></linearGradient>
        <linearGradient id="beak" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#d9c9a0" /><stop offset="100%" stopColor="#8a7650" /></linearGradient>
      </defs>
      <circle cx="60" cy="58" r="56" fill="url(#glow)" />
      <ellipse cx="60" cy="30" rx="44" ry="7" fill="url(#hat)" stroke="#5a4630" />
      <path d="M36 30 Q38 8 60 6 Q82 8 84 30 Z" fill="url(#hat)" stroke="#5a4630" />
      <path d="M40 30 Q36 70 52 90 L68 90 Q84 70 80 30 Z" fill="#1a140f" stroke="#5a4630" />
      <path d="M52 52 Q30 56 14 98 Q44 90 62 72 Z" fill="url(#beak)" stroke="#5a4630" strokeWidth="1.5" />
      <circle cx="56" cy="46" r="9" fill="#0d0a08" stroke="#c8b27a" strokeWidth="2" />
      <circle cx="56" cy="46" r="5" fill="#8fcf74" className="flicker" />
      <circle cx="74" cy="46" r="7" fill="#0d0a08" stroke="#c8b27a" strokeWidth="2" />
      <circle cx="74" cy="46" r="3.5" fill="#8fcf74" className="flicker" />
      <path d="M30 100 Q60 86 90 100 L98 118 L22 118 Z" fill="#1a140f" stroke="#5a4630" />
    </svg>
  );
}

export function Modal({ children, onClose, wide, z = 50 }: { children: ReactNode; onClose?: () => void; wide?: boolean; z?: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center p-3 anim-fade" style={{ background: "rgba(5,3,2,0.8)", zIndex: z }} onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
      <div className={`card anim-pop w-full ${wide ? "max-w-3xl" : "max-w-md"} max-h-full overflow-y-auto p-5 shadow-2xl`} style={{ boxShadow: "0 0 60px rgba(0,0,0,0.8)" }}>
        {children}
      </div>
    </div>
  );
}

export function Bar({ value, max = 100, color, h }: { value: number; max?: number; color: string; h?: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return <div className="bar" style={h ? { height: h } : undefined}><div style={{ width: `${pct}%`, background: color }} /></div>;
}

export function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block mb-3">
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><span className="text-[#a8977a]">{Math.round(value * 100)}%</span></div>
      <input type="range" min={0} max={1} step={0.01} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </label>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const set = (p: Partial<Settings>) => { const n = { ...settings, ...p }; audio.setVol(n); onChange(n); };
  return (
    <div>
      <Slider label="Master volume" value={settings.master} onChange={(v) => set({ master: v })} />
      <Slider label="Music" value={settings.music} onChange={(v) => set({ music: v })} />
      <Slider label="Sound effects" value={settings.sfx} onChange={(v) => { set({ sfx: v }); }} />
      <div className="flex gap-2 flex-wrap">
        <button className={`btn ${settings.muted ? "btn-on" : ""}`} onClick={() => { set({ muted: !settings.muted }); }}>{settings.muted ? "🔇 Muted" : "🔊 Sound on"}</button>
        <button className={`btn ${settings.shake ? "btn-on" : ""}`} onClick={() => set({ shake: !settings.shake })}>{settings.shake ? "📳 Screen shake: on" : "Screen shake: off"}</button>
        <button className="btn" onClick={() => audio.sfx("bell")}>Test bell</button>
      </div>
    </div>
  );
}

const KEYS: [string, string][] = [
  ["Click district", "Select it. Click a road between districts to select the road."],
  ["Space", "Pause / resume time"],
  ["1 / 2 / 3", "Time speed x1 / x2 / x4"],
  ["Q", "Seal / unseal selected district (30 funds)"],
  ["H", "Build or upgrade a hospital"],
  ["T", "Dispatch / recall a contact tracer team (20 funds)"],
  ["A", "Public Address - calm panic and rumours (15 funds)"],
  ["F", "Fumigate & disinfect (25 funds + 3 medicine)"],
  ["C", "Administer the cure (after Cure Prototype)"],
  ["X", "Close / open the selected road"],
  ["Tab / Shift+Tab", "Cycle through districts"],
  ["R / P / L / D", "Research / Policies / Chronicle / District tabs"],
  ["V", "Cycle map lens: infection, panic, rumour, hunger"],
  ["M", "Mute / unmute"],
  ["Esc", "Pause menu"],
  ["Touch", "Tap to select. All actions are also available as buttons in the side panel."],
];

export function ControlsTable() {
  return (
    <div className="grid gap-x-4 gap-y-1 text-sm" style={{ gridTemplateColumns: "auto 1fr" }}>
      {KEYS.map(([k, v]) => (
        <div key={k} className="contents"><kbd className="font-ui text-[#e0a53f] whitespace-nowrap">{k}</kbd><span className="text-[#cdbd9a]">{v}</span></div>
      ))}
    </div>
  );
}

export function HelpContent() {
  const H = ({ children }: { children: ReactNode }) => <h3 className="font-title text-[#e0a53f] mt-4 mb-1 text-lg">{children}</h3>;
  return (
    <div className="text-[15px] leading-snug text-[#d8c9a6]">
      <H>Your goal</H>
      <p>Guide the city through the plague. The Black Cough spreads along the roads of a contact graph. Around the midpoint it mutates, and the <b className="text-[#ff6a4a]">Crimson Mutation</b> is the final challenge. <b>Win</b> by eradicating every case after the Crimson Mutation emerges. <b>Lose</b> if public trust hits zero or more than 45% of the city dies.</p>
      <H>Reading the map</H>
      <p>Each node is a district. Its ring shows <span className="text-[#d8452f]">reported infected</span>, <span className="text-[#55b3b0]">recovered</span>, <span className="text-gray-400">dead</span>. Dashed rings mean no reports yet: the plague is spreading unseen. Reports are estimates (~) until you <b>trace</b> a district. Tracing reveals true counts and exposes <span className="text-[#ff5a3a]">transmission arrows</span> along roads, which uncovers hidden outbreaks.</p>
      <H>Systems that feed each other</H>
      <ul className="list-disc pl-5 space-y-1">
        <li><b>Epidemic:</b> susceptible → exposed → infected → recovered/dead. Dense districts spread faster; busy roads carry the plague to neighbours.</li>
        <li><b>Hospitals:</b> beds isolate patients and cut deaths, but burn medicine. No beds or no medicine means more deaths.</li>
        <li><b>Quarantine:</b> sealing a district cuts road spread, but it stops production, drains trust, and needs food. Low compliance makes seals leak.</li>
        <li><b>Panic &amp; rumour:</b> fear rises with deaths, bodies, hunger and rumours. Panic makes people flee (carrying plague), breaks quarantines, and sparks riots. Calm districts with Public Address.</li>
        <li><b>Supplies:</b> farms feed the city, apothecaries make medicine, markets and nobles pay taxes. Starvation raises mortality and panic.</li>
        <li><b>Research:</b> universities generate research toward better masks, hospitals, tracing, and finally a cure.</li>
        <li><b>Policies:</b> masks, curfew, corpse carts and rationing all trade one resource for another.</li>
        <li><b>Events:</b> merchants, nobles, quacks and mobs demand decisions. There is rarely a free answer.</li>
      </ul>
      <H>Between runs</H>
      <p>Earn <b>Legacy Points</b> every run (more for winning and saving lives) and spend them on permanent perks. Winning unlocks the next city. Harder difficulties and modifiers multiply your score and Legacy.</p>
      <H>Controls</H>
      <ControlsTable />
    </div>
  );
}
