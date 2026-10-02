import { useState } from "react";
import type { ReactNode } from "react";
import { CREATURES, ESCORTS, FRONT_INFO, GOODS, GOOD_IDS, REGIONS, ROLES, ROLE_INFO, TRIBUTE_INTERVAL, UPGRADES } from "../game/data";
import type { EscortKind } from "../game/data";
import {
  ACHIEVEMENTS, MAX_CREW, MAX_ESCORTS, begRelief, buyChum, buyEscort, buyGood, buyPrice, buyRations, buyUpgrade, cargoCap, cargoUsed,
  crewPower, dismissCrew, escortRepairCost, fuelPrice, hireCost, hireCrew, isBroke, maxFuel, maxHull, price, refuel, repairCost, repairEscort, repairHull,
  sellAllHunt, sellEscort, sellGood, sellQuote, shoreLeave, trainCost, trainCrew, travelFuel, tributeAmount, tributeDue, upgCost, wageOf, wagesTotal,
} from "../game/state";
import type { Campaign, Meta } from "../game/state";
import { Btn, Meter, Panel, Pips } from "./ui";
import { cn } from "../utils/cn";

type Act = (fn: (c: Campaign) => string | string[] | void, sfx?: string) => void;
interface Props { camp: Campaign; meta: Meta; act: Act; onLaunch: (apex: boolean) => void; onTravel: (to: number) => void; onMenu: () => void; onHelp: () => void }

const TABS = ["Harbor", "Market", "Shipyard", "Crew", "Fleet", "Voyage", "Ledger"] as const;
const TAB_ICONS = ["⚓", "💰", "🔨", "👥", "🚢", "🗺️", "📜"];

export default function Port({ camp, meta, act, onLaunch, onTravel, onMenu, onHelp }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Harbor");
  const reg = REGIONS[camp.loc];
  const due = tributeDue(camp) - camp.day;
  const amt = tributeAmount(camp);
  const urgent = due <= 2;
  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-[#101a3c] via-[#16224d] to-[#2a1f3d]">
      {/* header */}
      <div className="px-3 pt-2 pb-2 border-b border-amber-700/30 bg-black/30">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <div className="mr-auto">
            <div className="text-xl font-bold text-amber-200 leading-tight">⚓ {reg.port}</div>
            <div className="text-xs text-amber-100/70">{reg.name} · Day {camp.day}</div>
          </div>
          <Stat label="Crowns" value={`${camp.crowns}¢`} color="text-yellow-300" />
          <Stat label="Fuel" value={`${Math.floor(camp.fuel)}/${maxFuel(camp)}`} color={camp.fuel < 30 ? "text-rose-300" : "text-amber-200"} />
          <Stat label="Hull" value={`${Math.ceil(camp.hull)}/${maxHull(camp)}`} color={camp.hull < maxHull(camp) * 0.5 ? "text-rose-300" : "text-emerald-300"} />
          <Stat label="Hold" value={`${cargoUsed(camp)}/${cargoCap(camp)}`} color="text-sky-200" />
          <Stat label="Rations" value={`${camp.rations}`} color={camp.rations < camp.crew.length * 2 ? "text-rose-300" : "text-amber-200"} />
          <div className={cn("rounded-lg px-3 py-1 border text-sm", urgent ? "border-rose-400 bg-rose-900/50 glow" : "border-amber-700/40 bg-black/30")}>
            <div className="text-[11px] uppercase tracking-wider text-amber-100/70">Guild tribute</div>
            <div className={cn("font-bold", urgent ? "text-rose-200" : "text-amber-100")}>{amt}¢ · day {tributeDue(camp)} ({due}d)</div>
          </div>
          <div className="flex gap-1">
            <Btn variant="steel" onClick={onHelp} className="!px-3 !py-1">?</Btn>
            <Btn variant="steel" onClick={onMenu} className="!px-3 !py-1">Menu</Btn>
          </div>
        </div>
        <div className="flex gap-1 mt-2 overflow-x-auto">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(t)} className={cn("px-3 py-1.5 rounded-t-lg font-bold text-sm whitespace-nowrap border border-b-0 transition", tab === t ? "bg-amber-400 text-slate-950 border-amber-200" : "bg-slate-800/80 text-amber-100 border-slate-600 hover:bg-slate-700")}>
              {TAB_ICONS[i]} {t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 scroll-y p-3">
        <div className="max-w-6xl mx-auto">
          {tab === "Harbor" && <Harbor camp={camp} act={act} onLaunch={onLaunch} />}
          {tab === "Market" && <Market camp={camp} act={act} />}
          {tab === "Shipyard" && <Shipyard camp={camp} act={act} />}
          {tab === "Crew" && <CrewTab camp={camp} act={act} />}
          {tab === "Fleet" && <Fleet camp={camp} act={act} />}
          {tab === "Voyage" && <Voyage camp={camp} onTravel={onTravel} />}
          {tab === "Ledger" && <Ledger camp={camp} meta={meta} />}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-wider text-amber-100/60">{label}</div>
      <div className={cn("font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0", className)}>{children}</div>;
}

// ---------------- Harbor ----------------
function Harbor({ camp, act, onLaunch }: { camp: Campaign; act: Act; onLaunch: (a: boolean) => void }) {
  const reg = REGIONS[camp.loc]; const rs = camp.regions[camp.loc];
  const nav = crewPower(camp, "navigator");
  const apex = CREATURES[reg.apex];
  const canGo = camp.fuel >= 15 && camp.hull > 5;
  const fp = fuelPrice(camp);
  const apexReady = rs.threat >= 50 && !rs.cleared;
  const ambush = rs.threat >= 100 && !rs.cleared;
  const warnings: string[] = [];
  if (camp.fuel < 40) warnings.push("Low fuel — a hunt burns ~1 fuel/second.");
  if (camp.hull < maxHull(camp) * 0.6) warnings.push("Hull damaged — repair before a hard fight.");
  if (camp.rations < camp.crew.length * 2) warnings.push("Rations nearly gone — hungry crews lose morale.");
  if (crewPower(camp, "gunner") === 0 && camp.loc >= 1) warnings.push("No Gunner aboard — hire one for stronger cannon fire.");
  return (
    <div className="grid lg:grid-cols-3 gap-3">
      <Panel title="Launch" className="lg:col-span-1">
        <p className="text-sm text-amber-100/80 mb-3">{reg.blurb}</p>
        <Btn onClick={() => onLaunch(false)} disabled={!canGo} variant="gold" className="w-full !py-3 text-lg" sfx="launch">🚀 Launch Hunt</Btn>
        {!canGo && <div className="text-rose-300 text-sm mt-1">You need at least 15 fuel and a seaworthy hull.</div>}
        <div className="mt-3 rounded-lg bg-black/30 border border-white/10 p-3">
          <div className="font-bold text-amber-200">👑 Apex: {apex.name}</div>
          <div className="text-xs text-amber-100/70 mb-2">{apex.desc}</div>
          <Meter v={rs.threat} max={100} color={rs.threat >= 100 ? "#ff5a4a" : "linear-gradient(90deg,#e0a030,#ff6a4a)"} label="Apex Threat (50 to challenge, 100 = ambush)" />
          {rs.cleared ? <div className="mt-2 text-emerald-300 font-bold">✔ Slain — this region is yours.</div> : (
            <Btn variant="red" disabled={!apexReady || !canGo} onClick={() => onLaunch(true)} className="w-full mt-2" sfx="roar">⚔ Challenge the Apex</Btn>
          )}
          {ambush && <div className="text-rose-300 text-xs mt-1">⚠ Threat at max: the apex will ambush any hunt launched here.</div>}
        </div>
        {warnings.map((w) => <div key={w} className="text-amber-300 text-sm mt-2">⚠ {w}</div>)}
      </Panel>

      <Panel title="Services" className="lg:col-span-1">
        <Row><span className="flex-1">⛽ Fuel <span className="text-xs text-amber-100/60">({fp}¢ each)</span></span>
          <Btn variant="steel" className="!px-2 !py-1 text-sm" onClick={() => act((c) => refuel(c, 10), "buy")}>+10</Btn>
          <Btn variant="steel" className="!px-2 !py-1 text-sm" onClick={() => act((c) => refuel(c, 9999), "buy")}>Fill ({Math.round((maxFuel(camp) - camp.fuel) * fp)}¢)</Btn></Row>
        <Row><span className="flex-1">🔧 Hull repair</span>
          <Btn variant="steel" className="!px-2 !py-1 text-sm" disabled={repairCost(camp) <= 0} onClick={() => act((c) => repairHull(c), "buy")}>Repair ({repairCost(camp)}¢)</Btn></Row>
        <Row><span className="flex-1">🍞 Rations <span className="text-xs text-amber-100/60">(4¢, crew eats {camp.crew.length}/day)</span></span>
          <Btn variant="steel" className="!px-2 !py-1 text-sm" onClick={() => act((c) => buyRations(c, 10), "buy")}>+10</Btn>
          <Btn variant="steel" className="!px-2 !py-1 text-sm" onClick={() => act((c) => buyRations(c, 30), "buy")}>+30</Btn></Row>
        <Row><span className="flex-1">🍻 Shore leave <span className="text-xs text-amber-100/60">(+25 morale, +10% hull, 1 day)</span></span>
          <Btn variant="green" className="!px-2 !py-1 text-sm" onClick={() => act((c) => shoreLeave(c), "bell")}>{15 * camp.crew.length}¢</Btn></Row>
        <Row><span className="flex-1">🪣 Chum barrel <span className="text-xs text-amber-100/60">(+25 apex threat)</span></span>
          <Btn variant="steel" className="!px-2 !py-1 text-sm" onClick={() => act((c) => buyChum(c), "buy")}>80¢</Btn></Row>
        <Row><span className="flex-1 text-sm text-amber-100/80">Daily upkeep: wages + escorts</span><span className="font-bold text-rose-200">-{wagesTotal(camp)}¢/day</span></Row>
        {isBroke(camp) && (
          <div className="mt-3 p-3 rounded-lg bg-rose-900/40 border border-rose-400/40">
            <div className="text-sm mb-2">You're penniless and dry. The Guild offers a humiliating dole.</div>
            <Btn variant="red" onClick={() => act((c) => begRelief(c), "deny")}>Beg the Guild for relief</Btn>
          </div>
        )}
        <div className="mt-3 text-xs text-amber-100/60">Tribute is due every {TRIBUTE_INTERVAL} days and escalates. If you can't pay, the Guild seizes your cargo — and if that's not enough, your fleet.</div>
      </Panel>

      <Panel title="Skies & Sea" className="lg:col-span-1">
        <div className="mb-3">
          <div className="text-sm font-bold text-amber-200 mb-1">Today's forecast</div>
          {nav > 0 ? (
            <div className="flex flex-wrap gap-2">
              {rs.forecast.map((k) => (
                <div key={k} className="px-2 py-1 rounded-md bg-black/30 border border-white/10 text-sm" title={FRONT_INFO[k].desc} style={{ color: FRONT_INFO[k].color }}>{FRONT_INFO[k].icon} {FRONT_INFO[k].name}</div>
              ))}
              {rs.forecast.length === 0 && <span className="text-sm text-emerald-300">Clear skies.</span>}
            </div>
          ) : <div className="text-sm text-amber-100/70">🔭 Unknown. Hire a <b>Navigator</b> to read the winds.</div>}
        </div>
        <Meter v={rs.pop} max={100} color="linear-gradient(90deg,#4ade80,#22c55e)" label="Creature population" />
        <div className="text-xs text-amber-100/60 mt-1 mb-3">Overhunting thins the herds and stirs the apex. Populations regrow +4/day.</div>
        <div className="text-sm font-bold text-amber-200 mb-1">Common prey here</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {reg.spawn.map(([id]) => <span key={id} className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-sm">{CREATURES[id].name}</span>)}
        </div>
        <div className="text-sm font-bold text-amber-200 mb-1">Harbor log</div>
        <div className="text-xs text-amber-100/80 space-y-1 max-h-40 scroll-y pr-1">
          {camp.log.map((l, i) => <div key={i} className={i === 0 ? "text-amber-100" : "text-amber-100/60"}>• {l}</div>)}
        </div>
      </Panel>
    </div>
  );
}

// ---------------- Market ----------------
function Market({ camp, act }: { camp: Campaign; act: Act }) {
  const space = cargoCap(camp) - cargoUsed(camp);
  return (
    <div className="grid lg:grid-cols-3 gap-3">
      <Panel title="Exchange" className="lg:col-span-2" right={<Btn variant="green" className="!py-1 text-sm" onClick={() => act((c) => sellAllHunt(c), "coin")}>Sell all hunt goods</Btn>}>
        <div className="text-xs text-amber-100/60 mb-2">Hold {cargoUsed(camp)}/{cargoCap(camp)} · Selling lowers a good's price here for a few days. Spice, Ore and Silk can be bought and hauled between ports.</div>
        <div className="overflow-x-auto">
          {GOOD_IDS.map((g) => {
            const d = GOODS[g]; const p = price(camp, camp.loc, g); const norm = d.base * d.demand[camp.loc];
            const ratio = p / norm;
            let best = { p: 0, port: -1 };
            for (let i = 0; i <= camp.unlocked; i++) { const pr = price(camp, i, g); if (pr > best.p) best = { p: pr, port: i }; }
            return (
              <Row key={g} className="min-w-[560px]">
                <div className="w-8 text-2xl">{d.icon}</div>
                <div className="w-36">
                  <div className="font-bold" style={{ color: d.color }}>{d.name}</div>
                  <div className="text-[11px] text-amber-100/60">{best.port !== camp.loc && best.p > p * 1.08 ? `Best: ${best.p}¢ @ ${REGIONS[best.port].port}` : best.port === camp.loc ? "Best price here" : d.hunt ? "Hunt good" : "Trade good"}</div>
                </div>
                <div className="w-24 tabular-nums">
                  <span className="font-bold text-lg">{p}¢</span> <span className={ratio >= 1 ? "text-emerald-300" : "text-rose-300"}>{ratio >= 1.02 ? "▲" : ratio <= 0.98 ? "▼" : "■"}</span>
                </div>
                <div className="w-14 text-center text-sky-200">x{camp.cargo[g]}</div>
                <div className="flex gap-1 flex-wrap">
                  <Btn variant="steel" className="!px-2 !py-1 text-xs" disabled={camp.cargo[g] < 1} onClick={() => act((c) => sellGood(c, g, 1), "coin")}>Sell 1</Btn>
                  <Btn variant="steel" className="!px-2 !py-1 text-xs" disabled={camp.cargo[g] < 1} onClick={() => act((c) => sellGood(c, g, 5), "coin")}>Sell 5</Btn>
                  <Btn variant="green" className="!px-2 !py-1 text-xs" disabled={camp.cargo[g] < 1} onClick={() => act((c) => sellGood(c, g, 999), "coin")}>All ({sellQuote(camp, g, camp.cargo[g])}¢)</Btn>
                  {!d.hunt && (<>
                    <Btn variant="gold" className="!px-2 !py-1 text-xs" disabled={space < 1 || camp.crowns < buyPrice(camp, g)} onClick={() => act((c) => buyGood(c, g, 1), "buy")}>Buy 1 ({buyPrice(camp, g)})</Btn>
                    <Btn variant="gold" className="!px-2 !py-1 text-xs" disabled={space < 1 || camp.crowns < buyPrice(camp, g)} onClick={() => act((c) => buyGood(c, g, 5), "buy")}>Buy 5</Btn>
                    <Btn variant="gold" className="!px-2 !py-1 text-xs" disabled={space < 1 || camp.crowns < buyPrice(camp, g)} onClick={() => act((c) => buyGood(c, g, 999), "buy")}>Max</Btn>
                  </>)}
                </div>
              </Row>
            );
          })}
        </div>
      </Panel>
      <Panel title="Market Whispers">
        {camp.events.length === 0 && <div className="text-sm text-amber-100/70">Quiet markets. Prices drift on their own.</div>}
        {camp.events.map((e, i) => (
          <div key={i} className={cn("text-sm py-1.5 border-b border-white/10", e.mult > 1 ? "text-emerald-300" : "text-rose-300")}>
            {e.mult > 1 ? "📈" : "📉"} {e.label} ({e.mult > 1 ? "+" : ""}{Math.round((e.mult - 1) * 100)}%, {e.days}d left)
          </div>
        ))}
        <div className="mt-3 text-sm font-bold text-amber-200">Trade routes</div>
        <div className="text-xs text-amber-100/70 space-y-1 mt-1">
          {(["spice", "ore", "silk"] as const).map((g) => {
            let lo = { p: 1e9, i: 0 }, hi = { p: 0, i: 0 };
            for (let i = 0; i <= camp.unlocked; i++) { const pr = price(camp, i, g); if (pr < lo.p) lo = { p: pr, i }; if (pr > hi.p) hi = { p: pr, i }; }
            return <div key={g}>{GOODS[g].icon} Buy at {REGIONS[lo.i].port} ({lo.p}¢) → sell at {REGIONS[hi.i].port} ({hi.p}¢)</div>;
          })}
        </div>
      </Panel>
    </div>
  );
}

// ---------------- Shipyard ----------------
function Shipyard({ camp, act }: { camp: Campaign; act: Act }) {
  const cur = (id: string, lv: number) => {
    switch (id) {
      case "hull": return `${100 + 30 * lv} hull`;
      case "engine": return `+${12 * lv}% thrust`;
      case "tank": return `${100 + 25 * lv} fuel`;
      case "hold": return `${20 + 8 * lv} slots`;
      case "gun": return `+${12 * lv}% damage`;
      case "winch": return `+${12 * lv}% reel, ${120 + 14 * lv} rope`;
      case "launcher": return `${1 + lv} harpoons`;
      case "cannon": return `${5 + 2 * lv} dmg`;
      default: return `-${15 * lv}% shock`;
    }
  };
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {UPGRADES.map((u) => {
        const lv = camp.upg[u.id]; const maxed = lv >= u.max; const cost = upgCost(camp, u.id);
        return (
          <Panel key={u.id}>
            <div className="flex items-center gap-2 mb-1"><span className="text-2xl">{u.icon}</span><div className="font-bold text-amber-200 flex-1">{u.name}</div><Pips n={lv} max={u.max} /></div>
            <div className="text-sm text-amber-100/80 mb-2">{u.desc}</div>
            <div className="text-xs text-sky-200 mb-2">Now: {cur(u.id, lv)}{!maxed && <> → Next: {cur(u.id, lv + 1)}</>}</div>
            <Btn className="w-full" disabled={maxed || camp.crowns < cost} onClick={() => act((c) => buyUpgrade(c, u.id), "buy")}>{maxed ? "MAX LEVEL" : `Upgrade — ${cost}¢`}</Btn>
          </Panel>
        );
      })}
    </div>
  );
}

// ---------------- Crew ----------------
function CrewTab({ camp, act }: { camp: Campaign; act: Act }) {
  const effect = (r: (typeof ROLES)[number]) => {
    const p = crewPower(camp, r);
    switch (r) {
      case "pilot": return `+${(6 * p).toFixed(0)}% thrust`;
      case "harpooner": return `+${(7 * p).toFixed(0)}% harpoon dmg, +${(5 * p).toFixed(0)}% lance`;
      case "gunner": return `+${(10 * p).toFixed(0)}% cannon rate`;
      case "engineer": return `-${(5 * p).toFixed(0)}% fuel burn, +${(0.25 * p).toFixed(1)} hull/s`;
      default: return `+${(12 * p).toFixed(0)}% radar, forecasts ${p > 0 ? "on" : "off"}`;
    }
  };
  return (
    <div className="grid lg:grid-cols-3 gap-3">
      <Panel title={`Crew (${camp.crew.length}/${MAX_CREW})`} className="lg:col-span-2">
        <div className="grid sm:grid-cols-2 gap-2">
          {camp.crew.map((m) => (
            <div key={m.id} className="rounded-lg bg-black/30 border border-white/10 p-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{ROLE_INFO[m.role].icon}</span>
                <div className="flex-1"><div className="font-bold text-amber-100">{m.name}</div><div className="text-xs text-amber-200/70">{ROLE_INFO[m.role].name} · {wageOf(m.level)}¢/day</div></div>
                <Pips n={m.level} max={5} />
              </div>
              <div className="mt-2"><Meter v={m.morale} max={100} h="h-2" color={m.morale > 60 ? "#4ade80" : m.morale > 30 ? "#facc15" : "#f87171"} label="Morale" /></div>
              <div className="flex gap-2 mt-2">
                <Btn variant="steel" className="!px-2 !py-1 text-xs flex-1" disabled={m.level >= 5 || camp.crowns < trainCost(m.level)} onClick={() => act((c) => trainCrew(c, m.id), "buy")}>{m.level >= 5 ? "Master" : `Train (${trainCost(m.level)}¢)`}</Btn>
                <Btn variant="red" className="!px-2 !py-1 text-xs" onClick={() => act((c) => dismissCrew(c, m.id), "deny")}>Dismiss</Btn>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm font-bold text-amber-200">Station effects</div>
        <div className="grid sm:grid-cols-2 gap-1 mt-1">
          {ROLES.map((r) => (
            <div key={r} className="text-sm flex gap-2 py-1 border-b border-white/5"><span>{ROLE_INFO[r].icon}</span><span className="w-24 font-bold">{ROLE_INFO[r].name}</span><span className={crewPower(camp, r) > 0 ? "text-emerald-300" : "text-rose-300"}>{crewPower(camp, r) > 0 ? effect(r) : "vacant"}</span></div>
          ))}
        </div>
        <div className="text-xs text-amber-100/60 mt-2">Effect = skill × morale. Low morale cuts effectiveness by up to 40%. A second crew in the same role adds 40%.</div>
      </Panel>
      <Panel title="Hiring Hall">
        <div className="text-xs text-amber-100/60 mb-2">New faces arrive every few days and whenever you sail.</div>
        {camp.hire.length === 0 && <div className="text-sm">No one is looking for work.</div>}
        {camp.hire.map((m) => (
          <div key={m.id} className="rounded-lg bg-black/30 border border-white/10 p-3 mb-2">
            <div className="flex items-center gap-2"><span className="text-2xl">{ROLE_INFO[m.role].icon}</span>
              <div className="flex-1"><div className="font-bold">{m.name}</div><div className="text-xs text-amber-200/70">{ROLE_INFO[m.role].name} · {wageOf(m.level)}¢/day</div></div><Pips n={m.level} max={5} /></div>
            <div className="text-xs text-amber-100/70 mt-1">{ROLE_INFO[m.role].desc}</div>
            <Btn className="w-full mt-2 !py-1 text-sm" disabled={camp.crowns < hireCost(m.level) || camp.crew.length >= MAX_CREW} onClick={() => act((c) => hireCrew(c, m.id), "buy")}>Hire — {hireCost(m.level)}¢</Btn>
          </div>
        ))}
      </Panel>
    </div>
  );
}

// ---------------- Fleet ----------------
function Fleet({ camp, act }: { camp: Campaign; act: Act }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Panel title={`Your Fleet (${camp.escorts.length}/${MAX_ESCORTS})`}>
        <div className="rounded-lg bg-black/30 border border-white/10 p-3 mb-2 flex items-center gap-3"><span className="text-3xl">🎈</span><div><div className="font-bold text-amber-200">Flagship — "Merry Leviathan"</div><div className="text-xs text-amber-100/70">Hull {Math.ceil(camp.hull)}/{maxHull(camp)}</div></div></div>
        {camp.escorts.length === 0 && <div className="text-sm text-amber-100/70">No escorts yet. Each escort adds +10% fuel burn and 12¢/day upkeep, but changes how you fight.</div>}
        {camp.escorts.map((e) => {
          const d = ESCORTS[e.kind]; const rc = escortRepairCost(e);
          return (
            <div key={e.id} className="rounded-lg bg-black/30 border border-white/10 p-3 mb-2">
              <div className="flex items-center gap-3"><span className="text-2xl">{d.icon}</span><div className="flex-1"><div className="font-bold">{d.name}</div><div className="text-xs text-amber-100/70">{d.desc}</div></div></div>
              <div className="mt-2"><Meter v={e.hp} max={d.hp} h="h-2" color={e.hp > 0 ? "#4ade80" : "#f87171"} label={e.hp <= 0 ? "Wrecked" : "Hull"} /></div>
              <div className="flex gap-2 mt-2">
                <Btn variant="steel" className="!px-2 !py-1 text-xs flex-1" disabled={rc <= 0 || camp.crowns < rc} onClick={() => act((c) => repairEscort(c, e.id), "buy")}>{rc <= 0 ? "Seaworthy" : `Repair (${rc}¢)`}</Btn>
                <Btn variant="red" className="!px-2 !py-1 text-xs" onClick={() => act((c) => sellEscort(c, e.id), "coin")}>Sell ({Math.round(d.price * 0.5)}¢)</Btn>
              </div>
            </div>
          );
        })}
      </Panel>
      <Panel title="Shipwright's Berth">
        {(Object.keys(ESCORTS) as EscortKind[]).map((k) => {
          const d = ESCORTS[k];
          return (
            <div key={k} className="rounded-lg bg-black/30 border border-white/10 p-3 mb-2">
              <div className="flex items-center gap-3"><span className="text-3xl">{d.icon}</span><div className="flex-1"><div className="font-bold text-amber-200">{d.name}</div><div className="text-sm text-amber-100/80">{d.desc}</div><div className="text-xs text-sky-200">Hull {d.hp}</div></div></div>
              <Btn className="w-full mt-2 !py-1" disabled={camp.crowns < d.price || camp.escorts.length >= MAX_ESCORTS} onClick={() => act((c) => buyEscort(c, k), "buy")}>Commission — {d.price}¢</Btn>
            </div>
          );
        })}
      </Panel>
    </div>
  );
}

// ---------------- Voyage ----------------
function Voyage({ camp, onTravel }: { camp: Campaign; onTravel: (to: number) => void }) {
  const [sel, setSel] = useState(camp.loc);
  const r = REGIONS[sel]; const rs = camp.regions[sel];
  const hops = Math.abs(sel - camp.loc);
  const fuel = travelFuel(camp) * hops;
  const locked = sel > camp.unlocked;
  const xs = REGIONS.map((_, i) => 70 + i * 152);
  return (
    <div className="grid lg:grid-cols-3 gap-3">
      <Panel title="Sky Chart" className="lg:col-span-2">
        <svg viewBox="0 0 860 190" className="w-full">
          <defs><linearGradient id="chart" x1="0" x2="1"><stop offset="0" stopColor="#1f3a6e" /><stop offset="1" stopColor="#3a2b5e" /></linearGradient></defs>
          <rect x="0" y="0" width="860" height="190" rx="12" fill="url(#chart)" opacity="0.55" />
          {xs.slice(0, -1).map((x, i) => <line key={i} x1={x} y1={95 + (i % 2 ? 22 : -22)} x2={xs[i + 1]} y2={95 + ((i + 1) % 2 ? 22 : -22)} stroke={i < camp.unlocked ? "#ffd27a" : "#556"} strokeWidth="3" strokeDasharray={i < camp.unlocked ? "0" : "6 6"} />)}
          {REGIONS.map((rg, i) => {
            const y = 95 + (i % 2 ? 22 : -22); const lock = i > camp.unlocked; const here = i === camp.loc;
            return (
              <g key={i} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
                <circle cx={xs[i]} cy={y} r={sel === i ? 30 : 26} fill={lock ? "#2a2f45" : camp.regions[i].cleared ? "#2f7a55" : "#8a5a2a"} stroke={sel === i ? "#fff" : "#ffd27a"} strokeWidth={sel === i ? 4 : 2} />
                <text x={xs[i]} y={y + 8} textAnchor="middle" fontSize="24">{lock ? "🔒" : camp.regions[i].cleared ? "👑" : "⚓"}</text>
                {here && <text x={xs[i]} y={y - 38} textAnchor="middle" fontSize="22">🎈</text>}
                <text x={xs[i]} y={y + 52} textAnchor="middle" fontSize="13" fill="#f4ead2" fontWeight="bold">{rg.port}</text>
              </g>
            );
          })}
        </svg>
        <div className="text-xs text-amber-100/60">Slay a region's apex to unlock the next. Sailing 1 hop = 1 day + {travelFuel(camp)} fuel and risks an encounter.</div>
      </Panel>
      <Panel title={r.name}>
        <div className="text-sm text-amber-100/80 mb-2">{r.blurb}</div>
        <div className="text-xs mb-1">Port: <b>{r.port}</b> · Danger {"★".repeat(r.danger)}</div>
        <div className="text-xs mb-2">Climate: {(Object.keys(r.weather) as (keyof typeof r.weather)[]).filter((k) => r.weather[k] >= 1.2).map((k) => FRONT_INFO[k].icon + " " + FRONT_INFO[k].name).join(", ") || "mild"}</div>
        <div className="text-xs mb-2">Prey: {r.spawn.map(([id]) => CREATURES[id].name).join(", ")}</div>
        {!locked && <Meter v={rs.pop} max={100} h="h-2" color="#4ade80" label="Population" />}
        {!locked && <div className="mt-1"><Meter v={rs.threat} max={100} h="h-2" color="#fb923c" label="Apex threat" /></div>}
        <div className="text-xs mt-2">Apex: <b>{CREATURES[r.apex].name}</b> {rs.cleared && "✔"}</div>
        <div className="mt-3">
          {sel === camp.loc ? <div className="text-sm text-emerald-300">You are docked here.</div> : locked ? <div className="text-sm text-rose-300">Sealed — slay {CREATURES[REGIONS[sel - 1].apex].name} first.</div> : (
            <Btn className="w-full" disabled={camp.fuel < fuel} onClick={() => onTravel(sel)} sfx="launch">Sail to {r.port} ({fuel} fuel, {hops}d)</Btn>
          )}
          {camp.fuel < fuel && sel !== camp.loc && !locked && <div className="text-xs text-rose-300 mt-1">Not enough fuel.</div>}
        </div>
      </Panel>
    </div>
  );
}

// ---------------- Ledger ----------------
function Ledger({ camp, meta }: { camp: Campaign; meta: Meta }) {
  const s = camp.stats;
  const items: [string, string | number][] = [
    ["Days at sea", s.days], ["Hunts launched", s.sorties], ["Creatures slain", s.kills], ["Apex slain", `${s.apex}/6`],
    ["Harpoons thrown", s.harpoons], ["Harpoons hit", s.hits], ["Bullseyes", s.bullseyes], ["Ropes snapped", s.snaps],
    ["Ships wrecked", s.wrecks], ["Crowns earned", s.earned], ["Crowns spent", s.spent], ["Tribute paid", s.tribute], ["Ambergris landed", s.amber],
  ];
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Panel title="Captain's Ledger">
        <div className="grid grid-cols-2 gap-x-6">
          {items.map(([k, v]) => <div key={k} className="flex justify-between border-b border-white/5 py-1 text-sm"><span className="text-amber-100/70">{k}</span><b className="tabular-nums">{v}</b></div>)}
        </div>
        <div className="mt-3 text-sm font-bold text-amber-200">Kills by species</div>
        <div className="flex flex-wrap gap-1.5 mt-1">{Object.keys(s.byType).length === 0 ? <span className="text-sm text-amber-100/60">None yet.</span> : Object.entries(s.byType).map(([k, v]) => <span key={k} className="px-2 py-0.5 rounded bg-black/30 border border-white/10 text-sm">{CREATURES[k as keyof typeof CREATURES]?.name ?? k} ×{v}</span>)}</div>
      </Panel>
      <Panel title="Achievements" right={<span className="text-sm text-amber-200">{meta.ach.length}/{ACHIEVEMENTS.length}</span>}>
        <div className="grid sm:grid-cols-2 gap-2">
          {ACHIEVEMENTS.map((a) => {
            const got = meta.ach.includes(a.id);
            return <div key={a.id} className={cn("rounded-lg p-2 border text-sm", got ? "bg-amber-400/15 border-amber-300/50" : "bg-black/30 border-white/10 opacity-60")}><div className="font-bold">{got ? "🏆" : "🔒"} {a.name}</div><div className="text-xs text-amber-100/70">{a.desc}</div></div>;
          })}
        </div>
      </Panel>
    </div>
  );
}
