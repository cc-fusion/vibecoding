import { useReducer, useState } from "react";
import { audio } from "../game/audio";
import { DIFFS, GOODS, GOOD_IDS, LEGS, MODULES, MODULE_IDS, ROLES, STATIONS, TRAITS, VTYPES, type ModuleId, type VType } from "../game/data";
import {
  acceptContract, buyGood, buySupply, buyVehicle, buyPrice, claimContract, derive, dismissCrew, feast, goodsTotal, hireCrew,
  hullMax, installModule, repairCost, repairVehicle, sellGood, sellPrice, sellVehicle, type Run,
} from "../game/run";
import CrewPanel from "./CrewPanel";
import { Bar } from "./ui";

type Tab = "market" | "outfit" | "crew" | "board";

export default function Station({ run, onDepart, onHelp }: { run: Run; onDepart: () => void; onHelp: () => void }) {
  const [tab, setTab] = useState<Tab>("market");
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [pick, setPick] = useState<{ v: number; slot: number } | null>(null);
  const st = STATIONS[Math.min(run.station, STATIONS.length - 1)];
  const levels = run.levels;
  const d = derive(run);
  const nextLeg = LEGS[Math.min(run.station, LEGS.length - 1)];
  const diff = DIFFS[run.diffIdx] ?? DIFFS[1];

  const act = (r: string | null, okMsg?: string) => {
    if (r) { setMsg({ t: r, ok: false }); audio.sfx("deny"); }
    else { if (okMsg) setMsg({ t: okMsg, ok: true }); audio.sfx("buy"); }
    bump();
  };

  const Tabs = (
    <div className="flex gap-1.5 flex-wrap">
      {([["market", "🛒 Market"], ["outfit", "🔧 Outfit"], ["crew", "👥 Crew"], ["board", "📜 Board"]] as [Tab, string][]).map(([k, l]) => (
        <button key={k} className={`btn ${tab === k ? "btn-primary" : ""}`} onClick={() => { setTab(k); audio.sfx("click"); }}>{l}</button>
      ))}
    </div>
  );

  const goodsHeld = goodsTotal(run);
  const hasContractHere = run.contract && run.contract.dest === run.station;

  return (
    <div className="absolute inset-0 z-40 bg-[#030b17]/92 flex flex-col">
      <div className="p-3 sm:p-4 border-b border-white/10 flex flex-wrap items-center gap-3 justify-between">
        <div>
          <div className="text-[11px] tracking-widest text-sky-300">{run.station === 0 ? "DEPARTURE DEPOT" : `STATION ${run.station}/6`}</div>
          <h2 className="font-display text-3xl sm:text-4xl leading-none text-amber-300">{st.name}</h2>
          <div className="text-xs text-sky-100/70 mt-1 max-w-xl">{st.blurb}</div>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="panel px-3 py-1.5 flex gap-4 flex-wrap">
            <span>💰 <b className="text-amber-300 tabular-nums">{run.credits}</b></span>
            <span>⛽ {Math.round(run.fuel)}/{d.fuelCap}</span>
            <span>🍖 {Math.round(run.food)}</span>
            <span>🪵 {run.planks}/{d.plankCap}</span>
            <span>🧨 {run.flares}</span>
            <span>📦 {goodsHeld}/{d.cargoCap}</span>
          </div>
          <button className="btn btn-sm" onClick={onHelp}>❓ Help</button>
        </div>
      </div>

      <div className="px-3 sm:px-4 pt-3 flex flex-wrap items-center justify-between gap-2">
        {Tabs}
        {msg && <div className={`text-sm px-3 py-1 rounded-lg pop-in ${msg.ok ? "bg-emerald-900/60 text-emerald-200" : "bg-red-900/60 text-red-200"}`}>{msg.t}</div>}
      </div>

      <div className="flex-1 overflow-y-auto scroll-thin p-3 sm:p-4">
        {tab === "market" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="panel p-3 sm:p-4">
              <h3 className="font-display text-xl text-sky-200 mb-2">SUPPLIES</h3>
              {([
                ["fuel", "⛽ Fuel", `${Math.round(run.fuel)}/${d.fuelCap}`, [10, 9999]],
                ["food", "🍖 Food", `${Math.round(run.food)}`, [10, 25]],
                ["plank", "🪵 Planks", `${run.planks}/${d.plankCap}`, [1, 9999]],
                ["flare", "🧨 Flares", `${run.flares}/8`, [1, 9999]],
              ] as ["fuel" | "food" | "plank" | "flare", string, string, number[]][]).map(([k, name, have, amts]) => (
                <div key={k} className="flex items-center gap-2 py-1.5 border-b border-white/5">
                  <div className="w-24">{name}</div>
                  <div className="w-20 text-white/60 text-sm">{have}</div>
                  <div className="text-amber-300 w-14 text-sm">{run.market[k]}💰</div>
                  <div className="flex gap-1 ml-auto">
                    {amts.map((a) => (
                      <button key={a} className="btn btn-sm" onClick={() => act(buySupply(run, k, a))}>{a >= 9999 ? "Fill" : `+${a}`}</button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="text-[11px] text-white/45 mt-2">Tip: crews eat ~0.045 food/s each. Longer legs need more fuel than one tank holds — add tanks in Outfit.</div>
            </div>

            <div className="panel p-3 sm:p-4">
              <h3 className="font-display text-xl text-sky-200 mb-1">TRADE GOODS <span className="text-sm text-white/50">({goodsHeld}/{d.cargoCap} cargo)</span></h3>
              {run.market.shock && <div className="text-xs mb-2 px-2 py-1 rounded bg-amber-900/50 text-amber-200">📣 {run.market.shock.text}</div>}
              {GOOD_IDS.map((g) => {
                const bp = buyPrice(run, g), sp = sellPrice(run, g), base = GOODS[g].base;
                const trend = bp > base * 1.1 ? "▲" : bp < base * 0.9 ? "▼" : "•";
                const avg = run.goods[g] > 0 ? Math.round(run.goodsCost[g] / run.goods[g]) : 0;
                return (
                  <div key={g} className="flex items-center gap-2 py-1.5 border-b border-white/5 text-sm">
                    <div className="w-36">{GOODS[g].icon} {GOODS[g].name}</div>
                    <div className="w-16 text-white/60">×{run.goods[g]}{run.goods[g] > 0 && <span className="text-[10px] block text-white/40">avg {avg}</span>}</div>
                    <div className={`w-20 ${bp > base * 1.1 ? "text-red-300" : bp < base * 0.9 ? "text-emerald-300" : "text-white/80"}`}>{trend} {bp}💰</div>
                    <div className="flex gap-1 ml-auto">
                      <button className="btn btn-sm" onClick={() => act(buyGood(run, g, 1))}>Buy</button>
                      <button className="btn btn-sm" onClick={() => act(buyGood(run, g, 5))}>×5</button>
                      <button className="btn btn-sm btn-primary" onClick={() => act(sellGood(run, g, 1))}>Sell {sp}</button>
                      <button className="btn btn-sm btn-primary" onClick={() => act(sellGood(run, g, 99))}>All</button>
                    </div>
                  </div>
                );
              })}
              <div className="text-[11px] text-white/45 mt-2">Buy where a good is cheap (▼ green), sell where it is dear. Cargo adds weight and burns fuel — and falls into crevasses.</div>
            </div>
          </div>
        )}

        {tab === "outfit" && (
          <div className="space-y-4">
            <div className="panel p-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
              {[
                ["Top speed", `${Math.round(d.top * 0.45)} km/h`], ["Weight", `${Math.round(d.weight)}`], ["Fuel cap", `${d.fuelCap}`], ["Cargo cap", `${d.cargoCap}`],
                ["Planks cap", `${d.plankCap}`], ["Grip", `${d.grip.toFixed(2)}`], ["Detect radius", `${Math.round(d.reveal)}`], ["Heating", `+${d.heat}°C`],
              ].map(([a, b]) => (
                <div key={a} className="rounded-lg bg-black/30 p-2"><div className="text-white/50">{a}</div><div className="font-bold text-sm">{b}</div></div>
              ))}
            </div>
            <div className="flex justify-between items-center">
              <h3 className="font-display text-xl text-sky-200">CARAVAN ({run.vehicles.length}/5)</h3>
              <button className="btn btn-sm" onClick={() => {
                let any = false; let err: string | null = null;
                for (const v of run.vehicles) { if (repairCost(v) > 0) { any = true; const e = repairVehicle(run, v); if (e) err = e; } }
                act(any ? err : "Everything is already repaired.", "Repairs done.");
              }}>🔧 Repair all</button>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
              {run.vehicles.map((v, vi) => {
                const def = VTYPES[v.type];
                return (
                  <div key={v.id} className="panel p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-display text-lg">{def.icon} {def.name}{vi === 0 && <span className="text-xs text-amber-300 ml-1">(lead)</span>}</div>
                      {vi > 0 && <button className="btn btn-sm btn-danger" onClick={() => { act(sellVehicle(run, vi), "Wagon sold."); setPick(null); }}>Sell</button>}
                    </div>
                    <div className="text-[11px] text-white/50">{def.desc}</div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className="w-12">Hull</span>
                      <div className="flex-1"><Bar value={v.hull} max={hullMax(v)} color="#7fe0a0" h={8} /></div>
                      <span>{Math.round(v.hull)}/{hullMax(v)}</span>
                      <button className="btn btn-sm" disabled={repairCost(v) <= 0} onClick={() => act(repairVehicle(run, v))}>Fix {repairCost(v)}💰</button>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {v.modules.map((m, si) => (
                        <button key={si} onClick={() => { setPick({ v: vi, slot: si }); audio.sfx("click"); }}
                          className={`flex-1 h-16 rounded-lg border text-center text-xs ${pick && pick.v === vi && pick.slot === si ? "border-amber-300 bg-amber-900/30" : "border-white/20 bg-black/25"} hover:bg-white/10`}>
                          <div className="text-xl">{m ? MODULES[m].icon : "＋"}</div>
                          <div className="text-[10px] text-white/60 leading-tight">{m ? MODULES[m].name : "empty"}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {pick && run.vehicles[pick.v] && (
              <div className="panel p-3 pop-in">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-display text-lg text-amber-300">Module for {VTYPES[run.vehicles[pick.v].type].name} · slot {pick.slot + 1}</h3>
                  <div className="flex gap-2">
                    {run.vehicles[pick.v].modules[pick.slot] && <button className="btn btn-sm btn-danger" onClick={() => act(installModule(run, run.vehicles[pick.v], pick.slot, null, levels), "Module removed (50% refund).")}>Remove</button>}
                    <button className="btn btn-sm" onClick={() => setPick(null)}>Close</button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {MODULE_IDS.map((mid: ModuleId) => {
                    const m = MODULES[mid]; const locked = !!m.unlock && !levels[m.unlock];
                    const cur = run.vehicles[pick.v].modules[pick.slot] === mid;
                    return (
                      <button key={mid} disabled={locked || cur} onClick={() => act(installModule(run, run.vehicles[pick.v], pick.slot, mid, levels), `${m.name} installed.`)}
                        className="btn text-left !p-2 flex gap-2 items-start">
                        <span className="text-2xl">{locked ? "🔒" : m.icon}</span>
                        <span className="flex-1">
                          <span className="font-bold block">{m.name} <span className="text-amber-300 font-normal">{m.cost}💰</span></span>
                          <span className="text-[11px] font-normal text-sky-100/70 block">{locked ? "Unlock in the Expedition Archive." : m.desc}</span>
                          <span className="text-[10px] text-white/40 font-normal">weight +{m.weight}{cur ? " · installed" : ""}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <h3 className="font-display text-xl text-sky-200 mb-2">BUY A WAGON</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {(["sled", "crawler", "cabin"] as VType[]).map((t) => {
                  const def = VTYPES[t]; const locked = !!def.unlock && !levels[def.unlock];
                  return (
                    <div key={t} className="panel p-3">
                      <div className="font-display text-lg">{locked ? "🔒" : def.icon} {def.name}</div>
                      <div className="text-[11px] text-white/60 min-h-[2.2rem]">{locked ? "Unlock in the Expedition Archive." : def.desc}</div>
                      <div className="text-[11px] text-white/45">Hull {def.hull} · {def.slots} slot{def.slots > 1 ? "s" : ""} · cargo +{def.cargo} · weight {def.weight}</div>
                      <button className="btn btn-sm btn-primary mt-2" disabled={locked || run.vehicles.length >= 5} onClick={() => act(buyVehicle(run, t, levels), `${def.name} added.`)}>Buy {def.cost}💰</button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {tab === "crew" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-display text-xl text-sky-200">YOUR CREW ({run.crew.filter((c) => c.alive).length}/{d.crewCap} bunks)</h3>
              <button className="btn btn-sm btn-primary" disabled={run.market.feasted} onClick={() => act(feast(run), "A grand feast! Morale and bonds soar.")}>🍗 Hold a feast (40💰 + 6🍖)</button>
            </div>
            <CrewPanel run={run} onDismiss={(id) => act(dismissCrew(run, id), "Crew member dismissed.")} />
            <h3 className="font-display text-xl text-sky-200">FOR HIRE</h3>
            {run.market.candidates.length === 0 && <div className="text-white/50 text-sm">No one else is looking for work here.</div>}
            <div className="grid sm:grid-cols-3 gap-3">
              {run.market.candidates.map((c, i) => (
                <div key={c.crew.id} className="panel p-3">
                  <div className="text-3xl">{c.crew.icon}</div>
                  <div className="font-display text-lg">{c.crew.name}</div>
                  <div className="text-xs text-sky-200">{ROLES[c.crew.role].icon} {ROLES[c.crew.role].name}</div>
                  <div className="text-[11px] text-white/60">{ROLES[c.crew.role].desc}</div>
                  <div className="text-[11px] text-amber-200 mt-1">★ {TRAITS[c.crew.trait].name}: <span className="text-white/60">{TRAITS[c.crew.trait].desc}</span></div>
                  <button className="btn btn-sm btn-primary mt-2" onClick={() => act(hireCrew(run, i), `${c.crew.name} joined the caravan.`)}>Hire {c.cost}💰</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "board" && (
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="panel p-4">
              <h3 className="font-display text-xl text-sky-200 mb-2">CONTRACTS</h3>
              {run.contract && (
                <div className="rounded-xl bg-black/30 border border-sky-400/30 p-3 mb-3">
                  <div className="text-xs text-sky-300">ACTIVE CONTRACT</div>
                  <div className="text-lg">Deliver {run.contract.qty}× {GOODS[run.contract.good].icon} {GOODS[run.contract.good].name}</div>
                  <div className="text-sm text-white/60">to {STATIONS[run.contract.dest].name} · reward <b className="text-amber-300">{run.contract.reward}💰</b></div>
                  {hasContractHere && <button className="btn btn-primary mt-2" onClick={() => act(claimContract(run), "Contract fulfilled!")}>Deliver now</button>}
                  {!hasContractHere && <div className="text-xs text-white/45 mt-1">You have {run.goods[run.contract.good]} in the hold.</div>}
                </div>
              )}
              {run.market.offer ? (
                <div className="rounded-xl bg-black/30 border border-white/10 p-3">
                  <div className="text-xs text-amber-300">NEW OFFER</div>
                  <div className="text-lg">Deliver {run.market.offer.qty}× {GOODS[run.market.offer.good].icon} {GOODS[run.market.offer.good].name}</div>
                  <div className="text-sm text-white/60">to {STATIONS[run.market.offer.dest].name} · reward <b className="text-amber-300">{run.market.offer.reward}💰</b></div>
                  <button className="btn btn-primary mt-2" disabled={!!run.contract} onClick={() => act(acceptContract(run), "Contract accepted.")}>{run.contract ? "Finish your current contract first" : "Accept"}</button>
                </div>
              ) : <div className="text-white/50 text-sm">No contracts on offer here.</div>}
            </div>
            <div className="panel p-4">
              <h3 className="font-display text-xl text-sky-200 mb-1">NEXT: {run.station >= 6 ? "—" : nextLeg.name.toUpperCase()}</h3>
              <div className="text-sm text-sky-50/80">{nextLeg.blurb}</div>
              <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                <div className="rounded-lg bg-black/30 p-2">Distance<br /><b>{(nextLeg.length / 100).toFixed(0)} km</b></div>
                <div className="rounded-lg bg-black/30 p-2">Base temperature<br /><b>{Math.round(nextLeg.temp * diff.cold)}°C</b></div>
                <div className="rounded-lg bg-black/30 p-2">Crevasse density<br /><b>{"▮".repeat(Math.round(nextLeg.density * 3))}</b></div>
                <div className="rounded-lg bg-black/30 p-2">Storm odds<br /><b>{Math.round(nextLeg.storm * 100)}%</b></div>
                <div className="rounded-lg bg-black/30 p-2">Raider risk<br /><b>{nextLeg.raid === 0 ? "none" : "▮".repeat(Math.round(nextLeg.raid * 3))}</b></div>
                <div className="rounded-lg bg-black/30 p-2">Hidden cracks<br /><b>{nextLeg.hidden < 0.08 ? "few" : nextLeg.hidden < 0.2 ? "some" : "many"}</b></div>
              </div>
              <div className="text-xs mt-3 text-white/55">
                Estimated fuel for this leg: ~{Math.round((nextLeg.length / Math.max(60, d.top * 0.85)) * 0.6 * d.loadFactor * diff.fuel)} units. You carry {Math.round(run.fuel)}.
              </div>
              {run.station === 5 && <div className="text-xs mt-2 text-red-300">⚠ The final leg: a chasm blocks the finish line (needs ~5 planks) and the Maw chases you. No camping!</div>}
            </div>
          </div>
        )}
      </div>

      <div className="p-3 border-t border-white/10 flex items-center justify-between gap-3">
        <div className="text-xs text-white/50 hidden sm:block">Difficulty: <span style={{ color: diff.color }}>{diff.name}</span> · Fuel {Math.round(run.fuel)}/{d.fuelCap} · Crew {run.crew.filter((c) => c.alive).length}</div>
        <button className="btn btn-primary text-lg !px-8 ml-auto" onClick={onDepart}>
          {run.station === 0 ? "Depart on the Expedition ➜" : "Depart for the next leg ➜"}
        </button>
      </div>
    </div>
  );
}
