import { LEGS, ROLES, VTYPES, WEATHER, MODULES } from "../game/data";
import type { Hud as HudData } from "../game/types";
import { Bar, Key, moraleColor } from "./ui";

export default function Hud({ h, onCrew, onPause }: { h: HudData; onCrew: () => void; onPause: () => void }) {
  const fuelPct = h.fuelCap > 0 ? h.fuel / h.fuelCap : 0;
  const wd = WEATHER[h.weather];
  const tod = h.night > 0.55 ? "🌙" : h.night > 0.2 ? "🌆" : "☀️";
  const rangeLeft = (1 - h.progress) * (LEGS[h.leg]?.length ?? 4000);
  const fuelWarn = h.fuelRange < rangeLeft && h.fuelCap > 0 && h.progress > 0.02;
  const gapPct = h.mawGap !== null ? Math.max(0, Math.min(1, h.mawGap / 1000)) : null;

  return (
    <div className="absolute inset-0 pointer-events-none select-none text-[12px] sm:text-sm" style={{ zIndex: 10 }}>
      {/* resources */}
      <div className="absolute left-2 top-2 panel p-2 sm:p-3 w-[168px] sm:w-[210px] space-y-1.5">
        <div className="flex items-center gap-2">
          <span title="Fuel">⛽</span>
          <div className="flex-1">
            <Bar value={h.fuel} max={h.fuelCap} color={fuelPct < 0.2 ? "#ff6b6b" : "#ffb347"} h={8} />
          </div>
          <span className={`tabular-nums w-10 text-right ${fuelPct < 0.2 ? "text-red-300 pulse-warn" : ""}`}>{Math.round(h.fuel)}</span>
        </div>
        {fuelWarn && <div className="text-[10px] text-amber-300 -mt-1">Fuel may not reach the station</div>}
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[12px]">
          <span title="Food (days at current crew)">🍖 {Math.round(h.food)} <span className="text-white/40">({h.foodDays > 99 ? "∞" : Math.round(h.foodDays / 10) * 10 + "s"})</span></span>
          <span title="Bridge planks">🪵 {h.planks}/{h.plankCap}</span>
          <span title="Flares">🧨 {h.flares}</span>
          <span title="Cargo">📦 {h.cargo}/{h.cargoCap}</span>
          <span title="Scrip">💰 {h.credits}</span>
          <span title="Caravan weight">⚖️ {Math.round(h.weight)}</span>
        </div>
        {h.contract && <div className="text-[10px] text-sky-200">📜 {h.contract}</div>}
      </div>

      {/* progress + weather */}
      <div className="absolute left-1/2 -translate-x-1/2 top-2 w-[44vw] min-w-[230px] max-w-[560px]">
        <div className="panel px-3 py-2">
          <div className="flex justify-between items-center font-display text-[13px] sm:text-base">
            <span>{h.legName.toUpperCase()}</span>
            <span className="text-white/60 text-xs">DAY {h.day}</span>
          </div>
          <div className="relative mt-1">
            <Bar value={h.progress * 100} max={100} color="linear-gradient(90deg,#4aa3c7,#dff3ff)" h={9} />
            <div className="absolute top-[-3px] text-sm" style={{ left: `calc(${h.progress * 100}% - 8px)` }}>🚜</div>
            <div className="absolute right-[-4px] top-[-9px] text-base">🏁</div>
          </div>
          {gapPct !== null && (
            <div className="mt-1.5">
              <div className="flex justify-between text-[10px] text-red-300"><span>THE MAW</span><span>{Math.round(h.mawGap ?? 0)} m behind</span></div>
              <Bar value={(1 - gapPct) * 100} max={100} color="linear-gradient(90deg,#ff5d5d,#9b1b3a)" h={6} />
            </div>
          )}
          <div className="flex justify-between mt-1.5 text-xs text-sky-100/90">
            <span>{wd.icon} {wd.label} {h.forecast && <span className="text-white/50">→ {WEATHER[h.forecast.type].icon} in {Math.ceil(h.forecast.inS)}s</span>}</span>
            <span title={`Effective ${Math.round(h.teff)}°C with heating`}>{tod} {Math.round(h.temp)}°C <span className="text-white/50">({Math.round(h.teff)}°)</span></span>
          </div>
        </div>
        {h.tutorial && (
          <div className="panel mt-2 px-3 py-2 border-amber-300/70 text-amber-100 text-center pop-in">
            <div className="text-[10px] tracking-widest text-amber-300">TUTORIAL {Math.min(h.tutorialStep + 1, 7)}/7</div>
            <div>{h.tutorial}</div>
          </div>
        )}
        <div className="mt-2 flex flex-col items-center gap-1">
          {h.alerts.slice(0, 3).map((a) => (
            <div key={a} className="px-3 py-0.5 rounded-full bg-red-900/80 border border-red-400/70 text-red-100 text-xs font-bold pulse-warn">⚠ {a}</div>
          ))}
          {h.camping && <div className="px-3 py-0.5 rounded-full bg-amber-900/80 border border-amber-400/70 text-amber-100 text-xs font-bold">⛺ CAMPING — time flows faster (C or W to break camp)</div>}
        </div>
      </div>

      {/* crew */}
      <div className="absolute right-2 top-2 pointer-events-auto flex flex-col items-end gap-1.5">
        <div className="flex gap-1.5">
          <button className="btn btn-sm" onClick={onCrew} title="Crew panel (Tab)">👥 Crew</button>
          <button className="btn btn-sm" onClick={onPause} title="Pause (Esc)">⏸</button>
        </div>
        <div className="panel p-1.5 grid grid-cols-2 gap-1">
          {h.crew.map((c) => (
            <div key={c.id} title={`${c.name} — ${ROLES[c.role].name}\nMorale ${Math.round(c.morale)}  Warmth ${Math.round(c.warmth)}  Health ${Math.round(c.health)}`} className={`w-[74px] sm:w-[88px] p-1 rounded-lg bg-black/30 ${c.alive ? "" : "opacity-30 grayscale"}`}>
              <div className="flex items-center gap-1">
                <span className="text-base">{c.alive ? c.icon : "💀"}</span>
                <div className="leading-none min-w-0">
                  <div className="truncate text-[10px] font-bold">{c.name}</div>
                  <div className="text-[9px] text-white/50">{ROLES[c.role].icon}</div>
                </div>
              </div>
              <Bar value={c.morale} color={moraleColor(c.morale)} h={3} />
              <div className="h-[2px]" />
              <Bar value={c.warmth} color="#8fd0ff" h={3} />
            </div>
          ))}
        </div>
      </div>

      {/* vehicles + speed */}
      <div className="absolute left-2 bottom-2 flex items-end gap-2">
        <div className="panel p-2 sm:p-3 min-w-[110px]">
          <div className="font-display text-3xl leading-none tabular-nums">{Math.round(h.speed * 0.45)}<span className="text-xs text-white/50 ml-1">km/h</span></div>
          <Bar value={h.speed} max={h.top} color="linear-gradient(90deg,#4aa3c7,#ffb347)" h={5} />
          <div className="text-[10px] text-white/50 mt-0.5">top {Math.round(h.top * 0.45)}</div>
        </div>
        <div className="panel p-2 flex gap-1.5">
          {h.vehicles.map((v) => (
            <div key={v.id} className="w-9 sm:w-11 text-center" title={`${VTYPES[v.type].name}: ${Math.round(v.hull)}/${v.max}\n${v.mods.map((m) => (m ? MODULES[m].name : "—")).join(", ")}`}>
              <div className={`text-base ${v.stuck > 0 ? "pulse-warn" : ""}`}>{VTYPES[v.type].icon}</div>
              <Bar value={v.hull} max={v.max} color={v.hull / v.max < 0.35 ? "#ff6b6b" : "#7fe0a0"} h={4} />
            </div>
          ))}
        </div>
      </div>

      {/* action keys */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-2 panel px-3 py-1.5 hidden md:flex items-center gap-3 text-[11px] text-sky-100">
        <span className="flex items-center gap-1"><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key> drive</span>
        <span className="flex items-center gap-1"><Key dim={h.jumpCd > 0}>SPACE</Key> jump{h.jumpCd > 0 && <span className="text-white/40">{h.jumpCd.toFixed(1)}</span>}</span>
        <span className="flex items-center gap-1"><Key dim={h.planks === 0}>E</Key> bridge</span>
        <span className="flex items-center gap-1"><Key>C</Key> camp</span>
        <span className="flex items-center gap-1"><Key dim={h.flares === 0}>R</Key> flare</span>
        <span className="flex items-center gap-1"><Key>J</Key> burn cargo</span>
        <span className="flex items-center gap-1"><Key>Tab</Key> crew</span>
      </div>

      {/* drift gauge */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-12 hidden md:block text-[10px] text-sky-100/70">
        ICE DRIFT {h.drift < 0 ? "◀" : "▶"} {Math.abs(Math.round(h.drift))}
      </div>

      {/* log */}
      <div className="absolute right-2 bottom-2 w-[min(320px,46vw)] flex flex-col items-end gap-1">
        {h.log.slice(-5).map((l) => (
          <div key={l.id} className="px-2.5 py-1 rounded-lg bg-[#06142a]/80 border border-white/10 text-[11px] sm:text-xs text-right" style={{ color: l.color, opacity: Math.max(0, Math.min(1, (9 - l.age) / 2)) }}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
