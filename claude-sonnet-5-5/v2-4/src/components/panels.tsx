import type { ReactNode } from "react";
import { DTYPES, fmt, POLICIES, TECHS, type Branch } from "../game/data";
import { alive, compliance, hospitalCost, leak, totals } from "../game/helpers";
import {
  administerCure, buildHospital, commissionScholars, cureCost, cureEffect, disinfect, publicAddress,
  selectDistrict, startResearch, startTrace, toggleEdge, togglePolicy, toggleQuarantine,
} from "../game/sim";
import type { Sim } from "../game/types";
import { Bar } from "./ui";

export type Run = (fn: () => string | null) => void;

function ActBtn({ k, icon, label, sub, onClick, disabled, on }: { k: string; icon: string; label: string; sub: string; onClick: () => void; disabled?: boolean; on?: boolean }) {
  return (
    <button className={`btn text-left !p-2 flex gap-2 items-center ${on ? "btn-on" : ""}`} onClick={onClick} disabled={disabled} title={`${label} [${k}]`}>
      <span className="text-xl">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] leading-tight">{label}</span>
        <span className="block text-[11px] text-[#a8977a] font-normal leading-tight" style={{ fontFamily: "IM Fell English, serif" }}>{sub}</span>
      </span>
      <kbd className="text-[10px] border border-[#6b5640] rounded px-1 text-[#a8977a]">{k}</kbd>
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: ReactNode; color?: string }) {
  return <div className="flex justify-between text-[13px]"><span className="text-[#a8977a]">{label}</span><span style={{ color }} className="font-ui">{value}</span></div>;
}

function MeterRow({ label, value, color, text }: { label: string; value: number; color: string; text?: string }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[12px] text-[#a8977a]"><span>{label}</span><span>{text ?? `${Math.round(value)}%`}</span></div>
      <Bar value={value} color={color} />
    </div>
  );
}

export function DistrictPanel({ s, run }: { s: Sim; run: Run }) {
  const sel = s.selected;
  if (sel.kind === "e") {
    const e = s.edges[sel.id];
    if (!e) return null;
    const A = s.districts[e.a], B = s.districts[e.b];
    const known = e.revealed || A.trace > 0 || B.trace > 0;
    return (
      <div className="anim-fade">
        <div className="font-title text-lg text-[#e8d9b5]">Road</div>
        <div className="text-sm text-[#cdbd9a] mb-2">{A.name} ⟷ {B.name}</div>
        <Stat label="Traffic" value={`${Math.round(e.traffic * 100)}%`} />
        <Stat label="Status" value={e.closed ? "Barricaded" : "Open"} color={e.closed ? "#d8452f" : "#8fcf74"} />
        {known ? (
          <>
            <Stat label={`Infections ${A.name} → ${B.name}`} value={`${e.fab.toFixed(1)}/day`} color="#ff8a6a" />
            <Stat label={`Infections ${B.name} → ${A.name}`} value={`${e.fba.toFixed(1)}/day`} color="#ff8a6a" />
          </>
        ) : <p className="text-sm text-[#a8977a] mt-2 italic">Transmission along this road is unknown. Trace either end to reveal it.</p>}
        <div className="mt-3">
          <ActBtn k="X" icon={e.closed ? "🔓" : "🚧"} label={e.closed ? "Reopen road" : "Barricade road"} sub={e.closed ? "Free" : "8 funds · trust -0.3 · traffic -96%"} onClick={() => run(() => toggleEdge(s, e.id))} on={e.closed} />
        </div>
        <p className="text-xs text-[#7d6e57] mt-2">Barricades are cheaper than sealing a district but only block this one link. Panicked crowds may still slip through.</p>
      </div>
    );
  }
  if (sel.kind !== "d") return <SituationBoard s={s} />;
  const d = s.districts[sel.id];
  if (!d) return null;
  const info = DTYPES[d.type];
  const a = alive(d);
  const traced = d.trace > 0;
  const hcost = hospitalCost(s, d);
  const comp = compliance(s, d);
  const origins = d.tracedEver
    ? (() => {
      const total = d.srcLocal + Object.values(d.srcFrom).reduce((x, y) => x + y, 0);
      if (total < 1) return [] as { name: string; pct: number }[];
      const arr = [{ name: "Local spread", pct: d.srcLocal / total }];
      for (const [k, v] of Object.entries(d.srcFrom)) if (v / total > 0.02) arr.push({ name: s.districts[+k].name, pct: v / total });
      return arr.sort((x, y) => y.pct - x.pct).slice(0, 4);
    })()
    : null;
  return (
    <div className="anim-fade">
      <div className="flex items-center gap-2">
        <span className="text-3xl">{info.icon}</span>
        <div>
          <div className="font-title text-lg text-[#e8d9b5] leading-tight">{d.name}</div>
          <div className="text-xs text-[#a8977a] font-ui">{info.label}</div>
        </div>
      </div>
      <p className="text-xs text-[#7d6e57] italic my-1">{info.desc}</p>
      <div className="flex gap-1 flex-wrap mb-2">
        {d.quarantine && <span className="text-[11px] px-1.5 rounded bg-[#4a2a10] text-[#ff9a4a]">🔒 Sealed {Math.floor(d.qDays)}d</span>}
        {traced && <span className="text-[11px] px-1.5 rounded bg-[#10343a] text-[#55b3b0]">🔍 Tracing {d.trace.toFixed(1)}d</span>}
        {d.hosp > 0 && <span className="text-[11px] px-1.5 rounded bg-[#1f3a1a] text-[#8fcf74]">✚ Hospital L{d.hosp}</span>}
        {d.build && <span className="text-[11px] px-1.5 rounded bg-[#4a3a10] text-[#e0a53f]">⚒ Building {d.build.left.toFixed(1)}d</span>}
        {d.disinfect > 0 && <span className="text-[11px] px-1.5 rounded bg-[#2a3a1a] text-[#c8e6a0]">🧴 Disinfected</span>}
        {d.bodies > 20 && <span className="text-[11px] px-1.5 rounded bg-[#3a2020] text-[#d89090]">⚰ {fmt(d.bodies)} bodies</span>}
      </div>

      <div className="card p-2 mb-2">
        <Stat label="Living" value={`${fmt(a)} / ${fmt(d.pop0)}`} />
        {traced ? (
          <>
            <Stat label="Healthy" value={fmt(d.S)} color="#8fcf74" />
            <Stat label="Incubating" value={fmt(d.E)} color="#e0a53f" />
            <Stat label="Infectious" value={fmt(d.I)} color="#d8452f" />
            <Stat label="In hospital" value={fmt(d.H)} color="#8fcf74" />
            <Stat label="Recovered" value={fmt(d.R)} color="#55b3b0" />
            <Stat label="Dead" value={fmt(d.D)} color="#9a968c" />
          </>
        ) : d.detected ? (
          <>
            <Stat label="Reported ill" value={`~${fmt(d.seenI)}`} color="#d8452f" />
            <Stat label="Dead" value={fmt(d.D)} color="#9a968c" />
            {d.hosp > 0 && <Stat label="In hospital" value={`${fmt(d.H)} / ${fmt(d.beds)}`} color="#8fcf74" />}
            <p className="text-[11px] text-[#7d6e57] italic mt-1">Estimates only. Trace for exact figures.</p>
          </>
        ) : (
          <p className="text-sm text-[#a8977a] italic">No reports from this district. {d.D > 0 ? `${fmt(d.D)} dead.` : "Is it safe, or merely silent?"}</p>
        )}
      </div>

      <MeterRow label="Panic" value={d.panic} color="#e0a53f" />
      <MeterRow label="Rumour" value={d.rumor} color="#a77bd0" />
      <MeterRow label="Hunger" value={d.hunger * 100} color="#e08a3f" />
      <MeterRow label={d.quarantine ? `Compliance (leak ${Math.round(leak(s, d) * 100)}%)` : "Compliance"} value={comp * 100} color="#55b3b0" />
      {d.hosp > 0 && <MeterRow label="Hospital beds" value={d.beds > 0 ? (d.H / d.beds) * 100 : 0} color="#8fcf74" text={`${fmt(d.H)} / ${fmt(d.beds)}`} />}

      <div className="grid grid-cols-1 gap-1.5 mt-3">
        <ActBtn k="Q" icon={d.quarantine ? "🔓" : "🔒"} label={d.quarantine ? "Unseal district" : "Seal district"} sub={d.quarantine ? "Free" : "30 funds · cuts roads, halts production, drains trust"} on={d.quarantine} onClick={() => run(() => toggleQuarantine(s, d.id))} />
        <ActBtn k="H" icon="🏥" label={d.hosp >= 3 ? "Hospital maxed" : d.hosp === 0 ? "Build hospital" : `Upgrade hospital to L${d.hosp + 1}`} sub={d.hosp >= 3 ? "—" : `${hcost} funds · 3 days`} disabled={d.hosp >= 3 || !!d.build} onClick={() => run(() => buildHospital(s, d.id))} />
        <ActBtn k="T" icon="🔍" label={traced ? "Recall tracers" : "Trace contacts"} sub={traced ? "Free" : `20 funds · ${s.districts.filter((x) => x.trace > 0).length}/${s.teamsMax} teams busy`} on={traced} onClick={() => run(() => startTrace(s, d.id))} />
        <ActBtn k="A" icon="📣" label="Public Address" sub={d.addrCd > 0 ? `Cooldown ${d.addrCd.toFixed(1)}d` : "15 funds · calm panic & rumours here and nearby"} disabled={d.addrCd > 0} onClick={() => run(() => publicAddress(s, d.id))} />
        <ActBtn k="F" icon="🧴" label="Disinfect & clear bodies" sub={d.disCd > 0 ? `Cooldown ${d.disCd.toFixed(1)}d` : "25 funds + 3 medicine · -22% local spread"} disabled={d.disCd > 0} onClick={() => run(() => disinfect(s, d.id))} />
        {s.techs.prototype && <ActBtn k="C" icon="💉" label="Administer Cure" sub={d.cureCd > 0 ? `Cooldown ${d.cureCd.toFixed(1)}d` : `${cureCost(d)} medicine · ${Math.round(cureEffect(s) * 100)}% effective`} disabled={d.cureCd > 0} onClick={() => run(() => administerCure(s, d.id))} />}
      </div>

      {origins && (
        <div className="card p-2 mt-3">
          <div className="font-title text-sm text-[#55b3b0] mb-1">🕸️ Contact trace: where infections came from</div>
          {origins.length === 0 ? <p className="text-xs text-[#7d6e57] italic">No infections recorded here yet.</p> : origins.map((o) => (
            <div key={o.name} className="mb-1"><div className="flex justify-between text-xs"><span>{o.name}</span><span>{Math.round(o.pct * 100)}%</span></div><Bar value={o.pct * 100} color="#d8452f" h={5} /></div>
          ))}
        </div>
      )}
    </div>
  );
}

function SituationBoard({ s }: { s: Sim }) {
  const list = [...s.districts].sort((a, b) => (b.detected ? b.seenI : -1) - (a.detected ? a.seenI : -1));
  const t = totals(s);
  return (
    <div className="anim-fade">
      <div className="font-title text-lg text-[#e8d9b5]">Situation Board</div>
      <p className="text-xs text-[#a8977a] italic mb-2">Select a district or road on the map. Worst-reported districts first.</p>
      <div className="card p-2 mb-2">
        <Stat label="Reported ill" value={`~${fmt(t.seen)}`} color="#d8452f" />
        <Stat label="Dead" value={fmt(t.dead)} color="#9a968c" />
        <Stat label="Beds in use" value={`${fmt(t.hospitalized)} / ${fmt(t.beds)}`} color="#8fcf74" />
        <Stat label="Districts reporting" value={`${s.districts.filter((d) => d.detected).length} / ${s.districts.length}`} />
      </div>
      <div className="flex flex-col gap-1">
        {list.map((d) => (
          <button key={d.id} className="btn !p-1.5 text-left flex items-center gap-2" onClick={() => selectDistrict(s, d.id)}>
            <span>{DTYPES[d.type].icon}</span>
            <span className="flex-1 truncate text-[13px]">{d.name}</span>
            <span className="text-xs" style={{ color: d.detected ? "#ff8a6a" : "#7d6e57" }}>{d.detected ? `~${fmt(d.seenI)}` : "?"}</span>
            <span className="w-10"><Bar value={d.panic} color="#e0a53f" h={4} /></span>
          </button>
        ))}
      </div>
    </div>
  );
}

const BRANCH_COLORS: Record<Branch, string> = { Surveillance: "#55b3b0", Medicine: "#8fcf74", Society: "#e0a53f", Cure: "#a77bd0" };

export function ResearchPanel({ s, run }: { s: Sim; run: Run }) {
  const cur = TECHS.find((t) => t.id === s.research.current);
  return (
    <div className="anim-fade">
      <div className="font-title text-lg text-[#e8d9b5]">Research</div>
      <div className="card p-2 my-2">
        {cur ? (
          <>
            <div className="flex justify-between text-sm"><span>{cur.icon} {cur.name}</span><span className="font-ui">{Math.floor(s.research.progress)} / {cur.cost}</span></div>
            <Bar value={s.research.progress} max={cur.cost} color={BRANCH_COLORS[cur.branch]} h={9} />
          </>
        ) : <p className="text-sm text-[#e0a53f] anim-pulse rounded p-1">No active project! {s.rp > 0 ? `${s.rp.toFixed(1)} points waiting.` : ""} Choose below.</p>}
        <div className="flex justify-between text-xs text-[#a8977a] mt-1"><span>Rate: +{s.rates.rp.toFixed(1)}/day</span><span>Banked: {s.rp.toFixed(1)}</span></div>
        <button className="btn w-full mt-2 !text-xs" onClick={() => run(() => commissionScholars(s))}>📜 Commission scholars: 50 funds → +6 RP</button>
      </div>
      {(Object.keys(BRANCH_COLORS) as Branch[]).map((b) => (
        <div key={b} className="mb-3">
          <div className="font-title text-sm mb-1" style={{ color: BRANCH_COLORS[b] }}>{b}</div>
          <div className="flex flex-col gap-1.5">
            {TECHS.filter((t) => t.branch === b).map((t) => {
              const done = s.techs[t.id];
              const avail = t.req.every((r) => s.techs[r]);
              const isCur = s.research.current === t.id;
              const part = s.research.partial[t.id] || 0;
              return (
                <div key={t.id} className={`card p-2 ${done ? "opacity-60" : ""} ${isCur ? "!border-[#e0a53f]" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-ui leading-tight">{t.name} {done && <span className="text-[#8fcf74]">✓</span>}</div>
                      <div className="text-[11px] text-[#a8977a] leading-tight">{t.desc}</div>
                      {!done && !avail && <div className="text-[10px] text-[#d8742f]">Requires: {t.req.filter((r) => !s.techs[r]).map((r) => TECHS.find((x) => x.id === r)?.name).join(", ")}</div>}
                      {!done && part > 0 && !isCur && <div className="text-[10px] text-[#a8977a]">Progress saved: {Math.floor(part)}/{t.cost}</div>}
                    </div>
                    {!done && <button className="btn !py-1 !px-2 !text-xs" disabled={!avail || isCur} onClick={() => run(() => startResearch(s, t.id))}>{isCur ? "Active" : `${t.cost} RP`}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PolicyPanel({ s, run }: { s: Sim; run: Run }) {
  const r = s.rates;
  const net = (v: number) => <span style={{ color: v >= 0 ? "#8fcf74" : "#d8452f" }}>{v >= 0 ? "+" : ""}{v.toFixed(1)}/day</span>;
  return (
    <div className="anim-fade">
      <div className="font-title text-lg text-[#e8d9b5]">Edicts & Ledger</div>
      <div className="flex flex-col gap-1.5 my-2">
        {POLICIES.map((p) => {
          const locked = !!p.req && !s.techs[p.req];
          const on = !!s.policies[p.id];
          return (
            <button key={p.id} className={`btn text-left !p-2 flex gap-2 items-center ${on ? "btn-on" : ""}`} onClick={() => run(() => togglePolicy(s, p.id))} disabled={locked}>
              <span className="text-xl">{p.icon}</span>
              <span className="flex-1">
                <span className="block text-[13px]">{p.name} {on && "· ENACTED"}</span>
                <span className="block text-[11px] text-[#a8977a] font-normal" style={{ fontFamily: "IM Fell English, serif" }}>{locked ? "Locked: research Beaked Masks" : p.desc}{p.upkeep ? ` (${p.upkeep}/day)` : ""}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="font-title text-sm text-[#e0a53f] mb-1">Daily ledger</div>
      <div className="card p-2">
        <Stat label="🪙 Taxes" value={`+${r.income.toFixed(1)}`} color="#8fcf74" />
        <Stat label="🪙 Upkeep (hospitals, edicts, guards)" value={`-${r.upkeep.toFixed(1)}`} color="#d8452f" />
        <Stat label="🪙 Net" value={net(r.income - r.upkeep)} />
        <Stat label="🌾 Food balance" value={net(r.food)} />
        <Stat label="⚗️ Medicine balance" value={net(r.med)} />
        <Stat label="📜 Research" value={net(r.rp)} />
        <Stat label="Tracer teams" value={`${s.districts.filter((d) => d.trace > 0).length} / ${s.teamsMax}`} />
        {s.foodRatio < 1 && <p className="text-xs text-[#d8452f] mt-1">⚠ Famine! Only {Math.round(s.foodRatio * 100)}% of food needs are met.</p>}
        {s.med <= 0 && <p className="text-xs text-[#d8452f] mt-1">⚠ No medicine: hospital deaths are doubled.</p>}
        {s.broke && <p className="text-xs text-[#d8452f] mt-1">⚠ Treasury empty: trust is draining.</p>}
      </div>
      <p className="text-xs text-[#7d6e57] mt-2 italic">Sealed districts produce nothing. Farms feed the city, apothecaries brew medicine, universities fuel research.</p>
    </div>
  );
}

export function Chart({ s, showActual }: { s: Sim; showActual?: boolean }) {
  const h = s.history;
  const W = 300, H = 110;
  const lastDay = Math.max(10, h[h.length - 1]?.day || 10);
  const max = Math.max(10, ...h.map((p) => Math.max(p.seen, p.dead, showActual ? p.actual : 0)));
  const X = (d: number) => 6 + (d / lastDay) * (W - 12);
  const line = (f: (p: (typeof h)[number]) => number, m: number) => h.map((p) => `${X(p.day).toFixed(1)},${(H - 8 - (f(p) / m) * (H - 16)).toFixed(1)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full bg-[#0f0c09] rounded border border-[#3a2e22]">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={6} x2={W - 6} y1={H - 8 - g * (H - 16)} y2={H - 8 - g * (H - 16)} stroke="#2a2118" />)}
        {s.bossEmerged && <line x1={X(s.bossDay)} x2={X(s.bossDay)} y1={4} y2={H - 4} stroke="#ff3b2a" strokeDasharray="3 3" />}
        <polyline fill="none" stroke="#a77bd0" strokeWidth={1} opacity={0.6} points={line((p) => p.panic, 100)} />
        <polyline fill="none" stroke="#9a968c" strokeWidth={1.5} points={line((p) => p.dead, max)} />
        {showActual && <polyline fill="none" stroke="#ff3b2a" strokeWidth={1.2} strokeDasharray="4 2" points={line((p) => p.actual, max)} />}
        <polyline fill="none" stroke="#e0a53f" strokeWidth={2} points={line((p) => p.seen, max)} />
      </svg>
      <div className="flex flex-wrap gap-x-3 text-[11px] text-[#a8977a] mt-1">
        <span style={{ color: "#e0a53f" }}>━ reported ill</span><span style={{ color: "#9a968c" }}>━ dead</span><span style={{ color: "#a77bd0" }}>━ panic</span>
        {showActual && <span style={{ color: "#ff3b2a" }}>┅ actual infected</span>}
      </div>
    </div>
  );
}

const KIND_COLOR = { info: "#cdbd9a", warn: "#e0a53f", bad: "#ff6a4a", good: "#8fcf74", event: "#a77bd0" } as const;

export function ChroniclePanel({ s }: { s: Sim }) {
  return (
    <div className="anim-fade">
      <div className="font-title text-lg text-[#e8d9b5] mb-1">Chronicle</div>
      <Chart s={s} />
      <div className="mt-3 flex flex-col gap-1">
        {s.log.map((l, i) => (
          <div key={`${s.log.length - i}-${l.day}-${l.text}`} className="text-[13px] leading-snug border-l-2 pl-2" style={{ borderColor: KIND_COLOR[l.kind], color: KIND_COLOR[l.kind] }}>
            <span className="text-[#7d6e57] font-ui text-[11px]">Day {l.day} </span>{l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
