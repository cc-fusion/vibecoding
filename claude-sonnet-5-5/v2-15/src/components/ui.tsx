import { useState } from "react";
import type { ReactNode } from "react";
import { audio } from "../game/audio";
import { CREATURES, FRONT_INFO, GOODS, GOOD_IDS, ROLES, ROLE_INFO } from "../game/data";
import type { Settings } from "../game/state";
import { cn } from "../utils/cn";

export function Btn({ children, onClick, variant = "gold", disabled, className, sfx = "click", title }: {
  children: ReactNode; onClick?: () => void; variant?: "gold" | "steel" | "red" | "green"; disabled?: boolean; className?: string; sfx?: string; title?: string;
}) {
  const v = {
    gold: "bg-gradient-to-b from-amber-300 to-amber-600 text-slate-950 border-amber-200/60 hover:from-amber-200 hover:to-amber-500",
    steel: "bg-gradient-to-b from-slate-600 to-slate-800 text-amber-50 border-slate-400/40 hover:from-slate-500 hover:to-slate-700",
    red: "bg-gradient-to-b from-rose-500 to-rose-800 text-white border-rose-300/50 hover:from-rose-400 hover:to-rose-700",
    green: "bg-gradient-to-b from-emerald-400 to-emerald-700 text-slate-950 border-emerald-200/50 hover:from-emerald-300 hover:to-emerald-600",
  }[variant];
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={() => { audio.init(); if (disabled) return; audio.sfx(sfx); onClick?.(); }}
      className={cn("px-4 py-2 rounded-lg border font-bold shadow-md active:translate-y-px transition disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-50", v, className)}
    >
      {children}
    </button>
  );
}

export function Panel({ title, children, className, right }: { title?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <div className={cn("brass-panel p-4 pop-in", className)}>
      {title && (
        <div className="flex items-center justify-between mb-3 border-b border-amber-700/30 pb-2">
          <h3 className="text-lg font-bold text-amber-200 tracking-wide">{title}</h3>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Meter({ v, max, color, label, h = "h-3" }: { v: number; max: number; color: string; label?: string; h?: string }) {
  const p = max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0;
  return (
    <div className="w-full">
      {label && <div className="text-xs text-amber-100/80 mb-0.5 flex justify-between"><span>{label}</span><span>{Math.round(v)}/{Math.round(max)}</span></div>}
      <div className={cn("w-full rounded-full bg-black/50 overflow-hidden border border-white/10", h)}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${p}%`, background: color }} />
      </div>
    </div>
  );
}

export function Pips({ n, max }: { n: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} className={cn("w-3 h-3 rounded-sm border", i < n ? "bg-amber-400 border-amber-200" : "bg-black/40 border-white/20")} />
      ))}
    </div>
  );
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className={cn("brass-panel p-5 max-h-[92vh] w-full scroll-y pop-in", wide ? "max-w-3xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const Row = ({ label, k }: { label: string; k: "master" | "music" | "sfx" }) => (
    <label className="flex items-center gap-3">
      <span className="w-28 text-amber-100">{label}</span>
      <input type="range" min={0} max={1} step={0.05} value={settings[k]} onChange={(e) => onChange({ ...settings, [k]: parseFloat(e.target.value) })} className="flex-1" />
      <span className="w-10 text-right text-sm tabular-nums">{Math.round(settings[k] * 100)}</span>
    </label>
  );
  return (
    <div className="space-y-3">
      <Row label="Master" k="master" />
      <Row label="Music" k="music" />
      <Row label="Effects" k="sfx" />
      <div className="flex flex-wrap gap-2 pt-1">
        <Btn variant={settings.muted ? "red" : "steel"} onClick={() => onChange({ ...settings, muted: !settings.muted })}>{settings.muted ? "🔇 Muted" : "🔊 Sound On"}</Btn>
        <Btn variant={settings.shake ? "green" : "steel"} onClick={() => onChange({ ...settings, shake: !settings.shake })}>Screen Shake: {settings.shake ? "On" : "Off"}</Btn>
        <Btn variant={settings.tips ? "green" : "steel"} onClick={() => onChange({ ...settings, tips: !settings.tips })}>Tutorial Hints: {settings.tips ? "On" : "Off"}</Btn>
      </div>
    </div>
  );
}

const CONTROLS: [string, string][] = [
  ["W A S D / Arrows", "Fly the airship (thrust)"],
  ["Mouse", "Aim the harpoon gun"],
  ["Hold Left Click", "Charge a harpoon — release to throw. Longer charge = faster, harder throw"],
  ["Space / Right Click (hold)", "Reel in the rope. Keep tension in the amber zone"],
  ["Shift", "Afterburner boost (burns lots of fuel)"],
  ["E", "Cut all ropes (escape a runaway beast)"],
  ["R (hold)", "Return to port with your cargo"],
  ["P / Esc", "Pause menu"],
  ["M", "Mute / unmute"],
  ["Gamepad", "L-stick fly · R-stick aim · RT throw · A/LT reel · B boost · X cut · Y return · Start pause"],
  ["Touch", "Left thumb: virtual stick · drag anywhere else to aim, release to throw · REEL / BOOST / HOME buttons"],
];

export function HelpPanel() {
  const [tab, setTab] = useState(0);
  const tabs = ["The Voyage", "Hunting", "Controls", "Port & Systems", "Bestiary", "Weather"];
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-3">
        {tabs.map((t, i) => (
          <button key={t} onClick={() => { audio.sfx("click"); setTab(i); }} className={cn("px-3 py-1 rounded-md text-sm font-bold border", tab === i ? "bg-amber-400 text-slate-950 border-amber-200" : "bg-slate-800 text-amber-100 border-slate-600 hover:bg-slate-700")}>{t}</button>
        ))}
      </div>
      <div className="text-amber-50/90 text-[15px] leading-relaxed space-y-2 max-h-[55vh] scroll-y pr-2">
        {tab === 0 && (<>
          <p><b className="text-amber-300">Goal:</b> slay the apex creature of every region and finally the <b>Leviathan Aurelion</b> in the Storm Heart — while paying the Guild's tribute every 10 days.</p>
          <p><b className="text-amber-300">The loop:</b> prepare in port (fuel, rations, repairs, crew) → launch a hunt → harpoon beasts, collect loot → return and sell at the market → upgrade your ship and fleet → repeat. Each hunt costs a day.</p>
          <p><b className="text-amber-300">Apex hunts:</b> killing creatures raises a region's <i>Apex Threat</i>. At 50% you can challenge its apex creature; if it reaches 100%, the apex ambushes your next hunt. Slaying it opens the next region.</p>
          <p><b className="text-amber-300">You lose</b> if the Guild's collectors find you short on tribute. Wrecks cost your cargo, so don't gamble a full hold on a bad fight.</p>
          <p><b className="text-amber-300">Legacy:</b> every campaign earns Guild Renown, spent on permanent perks for future voyages.</p>
        </>)}
        {tab === 1 && (<>
          <p><b className="text-amber-300">Throwing:</b> hold the mouse to charge, release to throw. The harpoon arcs under gravity and is pushed by wind — the dotted preview includes wind. Hit near the centre for a <b>BULLSEYE</b> (x2 damage).</p>
          <p><b className="text-amber-300">The rope:</b> a hooked beast pulls away. Hold <b>Space</b> to reel. Rope tension shows on the gauge: <span className="text-emerald-400">green</span> is slack, <span className="text-amber-300">amber</span> drains the beast's stamina, <span className="text-rose-400">red</span> will snap the rope. The winch slips on its own near the limit.</p>
          <p><b className="text-amber-300">Exhaustion:</b> when stamina hits zero the beast is exhausted. Reel it within lance range and your crew spears it to death. Apex beasts recover after a few seconds, so be quick!</p>
          <p><b className="text-amber-300">Loot:</b> kills drop barrels — fly over them. Your hold is limited. Jellies burst when slain; eels and bulls charge; pirates shoot and can plunder your cargo.</p>
          <p><b className="text-amber-300">Fuel:</b> drains constantly and faster when thrusting or boosting. Run dry and you drift, then get towed home at a price.</p>
        </>)}
        {tab === 2 && (
          <table className="w-full text-sm"><tbody>
            {CONTROLS.map(([k, d]) => (<tr key={k} className="border-b border-white/10"><td className="py-1.5 pr-3 font-bold text-amber-300 whitespace-nowrap align-top">{k}</td><td className="py-1.5">{d}</td></tr>))}
          </tbody></table>
        )}
        {tab === 3 && (<>
          <p><b className="text-amber-300">Market:</b> prices drift daily, fall as you sell (saturation) and vary by port. Buy Spice, Ore and Silk where they're cheap and sell where they're dear — but they eat hold space. Shortages and gluts appear as events.</p>
          <p><b className="text-amber-300">Crew:</b> five roles — {ROLES.map((r) => `${ROLE_INFO[r].icon} ${ROLE_INFO[r].name}`).join(", ")}. Skill × morale sets their effect. A second crew in the same role adds 40%. Morale rises with shore leave, kills and victories; falls with hunger, unpaid wages, wrecks and losses.</p>
          <p><b className="text-amber-300">Fleet:</b> up to three escorts: Harrier (guns), Chaser (tags beasts, slowing and exhausting them), Hauler (+hold, tractor beam). Escorts burn extra fuel and cost daily upkeep.</p>
          <p><b className="text-amber-300">Ecosystem:</b> hunting depletes a region's population (fewer beasts) and raises apex threat. Populations slowly recover over days.</p>
          <p><b className="text-amber-300">Voyage:</b> sailing between ports costs fuel and days, and may trigger events.</p>
        </>)}
        {tab === 4 && (
          <div className="grid sm:grid-cols-2 gap-2">
            {Object.values(CREATURES).map((c) => (
              <div key={c.id} className="rounded-lg bg-black/30 border border-white/10 p-2">
                <div className="font-bold text-amber-200">{c.apexRegion !== undefined ? "👑 " : ""}{c.name}</div>
                <div className="text-xs text-amber-50/80">{c.desc}</div>
                <div className="text-xs mt-1 text-amber-300/80">{c.loot.map(([g]) => GOODS[g].icon).join(" ")} {c.crowns[1] > 0 ? `· ${c.crowns[0]}-${c.crowns[1]}¢` : ""}</div>
              </div>
            ))}
          </div>
        )}
        {tab === 5 && (<>
          {(Object.keys(FRONT_INFO) as (keyof typeof FRONT_INFO)[]).map((k) => (
            <p key={k}><b style={{ color: FRONT_INFO[k].color }}>{FRONT_INFO[k].icon} {FRONT_INFO[k].name}:</b> {FRONT_INFO[k].desc}</p>
          ))}
          <p>Forecasts for each region are shown in port — hire a <b>Navigator</b> to read them. Fronts drift across the sky; the radar bar shows where they lie.</p>
          <p className="text-xs text-amber-200/60">Goods: {GOOD_IDS.map((g) => `${GOODS[g].icon} ${GOODS[g].name}`).join(" · ")}</p>
        </>)}
      </div>
    </div>
  );
}
