import type { ReactNode } from 'react';
import type { Game } from '../game/engine';
import {
  RES_LIST, RES_INFO, SHIPS, BUILDABLE, FACTIONS, LAB, labCost, labData, fmt, fmtTime, SPEC_INFO, TRAITS, WRECK_INFO, bagValue,
} from '../game/data';
import type { Res } from '../game/data';
import * as Sys from '../game/systems';
import { Bar } from './common';

function Card({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div className="rounded border bg-slate-900/50 p-2" style={{ borderColor: color ? color + '66' : 'rgba(77,225,255,0.18)' }}>
      {children}
    </div>
  );
}
const H = ({ children, right }: { children: ReactNode; right?: ReactNode }) => (
  <div className="mb-1 mt-3 flex items-center justify-between first:mt-0">
    <h3 className="font-title text-xs uppercase tracking-widest text-amber-200">{children}</h3>
    {right}
  </div>
);

function orderText(g: Game, id: number): string {
  const s = g.shipMap.get(id);
  if (!s) return '';
  const o = s.order;
  if (s.attached) return s.kind === 'tug' || s.kind === 'hauler' ? 'Towing' : 'Busy';
  switch (o.t) {
    case 'move': return 'Moving';
    case 'tow': return 'En route to tow';
    case 'cut': return 'Cutting';
    case 'attack': return 'Attacking';
    case 'return': return 'Returning';
    default: return s.auto ? 'Auto · idle' : 'Holding';
  }
}

/* ================= Fleet ================= */
export function FleetPanel({ g }: { g: Game }) {
  const fleet = g.fleet();
  const cap = Sys.fleetCap(g);
  return (
    <div>
      <H right={<span className="text-xs text-slate-400">{fleet.length}/{cap} ships</span>}>Shipyard</H>
      <div className="grid gap-2">
        {BUILDABLE.map((k) => {
          const d = SHIPS[k];
          const locked = Sys.shipLocked(g, k);
          const cost = Sys.shipCost(g, k);
          return (
            <Card key={k} color={d.color}>
              <div className="flex items-start gap-2">
                <div className="text-2xl">{d.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: d.color }}>{d.name}</span>
                    <span className="text-xs text-slate-400">HP {d.hp} · Spd {d.speed}{d.tow ? ` · Tow ${d.tow}` : ''}{d.cut ? ` · Cut ${d.cut}/s` : ''}{d.dps ? ` · DPS ${d.dps}` : ''}</span>
                  </div>
                  <div className="text-xs text-slate-400">{d.desc}</div>
                </div>
                <button className="btn shrink-0" disabled={locked || g.credits < cost || fleet.length >= cap} onClick={() => Sys.buyShip(g, k)}>
                  {locked ? '🔒 Archives' : `${fmt(cost)} cr`}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <H>Your fleet</H>
      <div className="grid gap-1">
        {fleet.map((s) => {
          const d = SHIPS[s.kind];
          const c = g.crewOf(s);
          const sel = g.sel.includes(s.id);
          return (
            <div
              key={s.id}
              className={`flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-sm hover:bg-cyan-400/10 ${sel ? 'border-emerald-400/70 bg-emerald-400/10' : 'border-cyan-400/15'}`}
              onClick={() => { g.selectIds([s.id]); g.focusSel(); }}
            >
              <span>{d.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between">
                  <span className="truncate">{d.name} <span className="text-slate-400">“{s.name}”</span></span>
                  <span className="text-xs text-slate-400">{orderText(g, s.id)}</span>
                </div>
                <Bar v={s.hp} max={s.maxHp} color={s.hp / s.maxHp > 0.5 ? '#7dffb0' : s.hp / s.maxHp > 0.25 ? '#ffd36e' : '#ff6b57'} />
                <div className="text-xs text-slate-400">{c ? `${SPEC_INFO[c.spec].icon} ${c.name} ★${c.skill}` : <span className="text-orange-300">No captain!</span>}</div>
              </div>
              <button className="btn" title={`Scrap for ${Math.round(d.cost * 0.35)}cr`} onClick={(e) => { e.stopPropagation(); Sys.scrapShip(g, s.id); }}>♻</button>
            </div>
          );
        })}
        {fleet.length === 0 && <div className="text-sm text-slate-400">No ships. Buy one above!</div>}
      </div>
    </div>
  );
}

/* ================= Market ================= */
function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <div className="h-4 w-16" />;
  const mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 60},${17 - ((v - mn) / rg) * 16}`).join(' ');
  return (
    <svg viewBox="0 0 60 18" className="h-4 w-16">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
export function MarketPanel({ g }: { g: Game }) {
  const m = g.market;
  const mods = Sys.priceMods(g);
  const fuelP = Sys.fuelPrice(g);
  return (
    <div>
      <H right={<button className="btn" onClick={() => Sys.sellAll(g)}>Sell everything</button>}>Commodity exchange</H>
      {mods.length > 0 && <div className="mb-1 text-xs text-emerald-300">Bonuses: {mods.join(' · ')}</div>}
      <div className="grid gap-1">
        {RES_LIST.map((r: Res) => {
          const info = RES_INFO[r];
          const p = Sys.sellPrice(g, r);
          const ratio = p / info.base;
          const hist = m.hist[r];
          const up = hist.length > 1 && hist[hist.length - 1] >= hist[hist.length - 2];
          return (
            <div key={r} className="flex items-center gap-2 rounded border border-cyan-400/15 px-2 py-1">
              <span className="text-lg">{info.icon}</span>
              <div className="w-16 text-xs leading-tight">
                <div style={{ color: info.color }}>{info.name}</div>
                <div className="text-slate-400">×{fmt(g.stock[r])}</div>
              </div>
              <div className="w-14 text-right text-sm tabular-nums" style={{ color: ratio >= 1 ? '#7dffb0' : '#ff9a6b' }}>
                {p.toFixed(p < 10 ? 2 : 1)}{up ? '▲' : '▼'}
              </div>
              <Spark data={hist} color={ratio >= 1 ? '#7dffb0' : '#ff9a6b'} />
              <div className="ml-auto flex gap-1">
                <button className="btn" disabled={g.stock[r] < 1} onClick={() => Sys.sellRes(g, r, 10)}>10</button>
                <button className="btn" disabled={g.stock[r] < 1} onClick={() => Sys.sellRes(g, r, g.stock[r])}>All</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 text-xs text-slate-400">Selling pushes the price down; it recovers over about a minute.</div>
      {m.events.length > 0 && (
        <div className="mt-2 grid gap-1">
          {m.events.map((e) => (
            <div key={e.id} className="rounded border border-amber-300/30 bg-amber-300/5 px-2 py-0.5 text-xs text-amber-200">📰 {e.text} · {fmtTime(e.until - g.time)}</div>
          ))}
        </div>
      )}
      <H>Fuel depot</H>
      <Card>
        <div className="flex items-center justify-between text-sm">
          <span>⛽ {fmt(g.fuel)} units <span className="text-xs text-slate-400">· {fuelP.toFixed(1)} cr each</span></span>
          <span className="flex gap-1">
            <button className="btn" onClick={() => Sys.buyFuel(g, 50)}>+50</button>
            <button className="btn" onClick={() => Sys.buyFuel(g, 150)}>+150</button>
          </span>
        </div>
        <Bar v={g.fuel} max={400} color={g.fuel < 40 ? '#ff6b57' : '#ffd36e'} />
        <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
          <span>Refine Power Cores into 9 fuel each</span>
          <span className="flex gap-1">
            <button className="btn" disabled={g.stock.cores < 1} onClick={() => Sys.refine(g, 1)}>1</button>
            <button className="btn" disabled={g.stock.cores < 1} onClick={() => Sys.refine(g, 999)}>All</button>
          </span>
        </div>
      </Card>
      <H>Contracts</H>
      <div className="grid gap-1">
        {g.contracts.map((c) => {
          const f = FACTIONS[c.faction];
          const ok = g.stock[c.res] >= c.qty;
          return (
            <Card key={c.id} color={f.color}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <div style={{ color: f.color }}>{f.name}</div>
                  <div className="text-xs">Deliver {RES_INFO[c.res].icon} {c.qty} {RES_INFO[c.res].name} <span className="text-slate-400">({fmt(g.stock[c.res])} in stock)</span></div>
                  <div className="text-xs text-slate-400">⏱ {fmtTime(c.deadline - g.time)} · +{c.rel} relations</div>
                </div>
                <button className="btn btn-gold shrink-0" disabled={!ok} onClick={() => Sys.fulfill(g, c.id)}>+{fmt(c.reward)} cr</button>
              </div>
            </Card>
          );
        })}
        {g.contracts.length === 0 && <div className="text-sm text-slate-400">No contracts right now. New offers arrive regularly.</div>}
      </div>
    </div>
  );
}

/* ================= Rights ================= */
export function RightsPanel({ g }: { g: Game }) {
  const owned = Sys.claimsOwned(g);
  const claimable = g.wrecks.filter((w) => w.revealed && w.fade === 0 && w.owner === -1 && w.special !== 'leviathan' && w.special !== 'debris').sort((a, b) => g.wreckValue(b) - g.wreckValue(a)).slice(0, 8);
  const loc = (x: number, y: number) => g.focusAt(x, y);
  return (
    <div>
      <H>Prize auctions</H>
      <div className="grid gap-2">
        {g.auctions.map((a) => {
          const w = g.wreckMap.get(a.wreckId);
          if (!w) return null;
          const left = a.end - g.time;
          const nb = Sys.nextBid(a);
          const big = Math.round(a.bid * 1.3 + 20);
          const mine = a.bidder === 0;
          return (
            <Card key={a.id} color="#ffd36e">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-200">{w.name}</span>
                <button className="btn" onClick={() => loc(w.x, w.y)}>📍</button>
              </div>
              <div className="text-xs text-slate-300">Worth ≈ {fmt(g.wreckValue(w))} cr · mass {Math.round(w.mass)}</div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span>Bid: <b className="text-amber-200">{fmt(a.bid)}</b> <span className="text-xs" style={{ color: mine ? '#7dffb0' : '#ff9a6b' }}>{a.bidder === -1 ? 'no bids' : mine ? 'YOU lead' : a.bidderName}</span></span>
                <span className={left < 10 ? 'text-red-300' : 'text-slate-300'}>⏱ {Math.max(0, left).toFixed(0)}s</span>
              </div>
              <Bar v={left} max={45} color="#ffd36e" />
              <div className="mt-1 flex gap-1">
                <button className="btn btn-gold flex-1" disabled={mine || g.credits < nb} onClick={() => Sys.bidAuction(g, a.id, false)}>Bid {fmt(nb)}</button>
                <button className="btn btn-gold flex-1" disabled={mine || g.credits < big} onClick={() => Sys.bidAuction(g, a.id, true)}>Raise {fmt(big)}</button>
              </div>
            </Card>
          );
        })}
        {g.auctions.length === 0 && <div className="text-sm text-slate-400">{g.sd.id >= 1 ? 'No auctions open. A new prize wreck is listed about every minute.' : 'Auctions begin in the campaign.'}</div>}
      </div>
      <H right={<span className="text-xs text-slate-400">{owned.length}/{Sys.maxClaims()}</span>}>Your claims</H>
      <div className="grid gap-1">
        {owned.map((w) => (
          <div key={w.id} className="flex items-center gap-2 rounded border border-cyan-400/20 px-2 py-1 text-sm">
            <span className="min-w-0 flex-1 truncate" style={{ color: WRECK_INFO[w.kind].glow }}>{w.name} <span className="text-slate-400">{fmt(g.wreckValue(w))}cr</span></span>
            <button className="btn" onClick={() => loc(w.x, w.y)}>📍</button>
            <button className="btn" title="Sell the rights to the friendliest rival" onClick={() => Sys.sellClaim(g, w.id)}>Sell</button>
          </div>
        ))}
        {owned.length === 0 && <div className="text-sm text-slate-400">You hold no claims. Stake one below.</div>}
      </div>
      <H>Open wrecks (unclaimed)</H>
      <div className="grid gap-1">
        {claimable.map((w) => {
          const cost = Sys.claimCost(g, w);
          return (
            <div key={w.id} className="flex items-center gap-2 rounded border border-cyan-400/15 px-2 py-1 text-sm">
              <span className="min-w-0 flex-1 truncate" style={{ color: WRECK_INFO[w.kind].glow }}>{w.name} <span className="text-slate-400">{fmt(bagValue(w.loot))}cr</span></span>
              <button className="btn" onClick={() => loc(w.x, w.y)}>📍</button>
              <button className="btn" disabled={g.credits < cost || owned.length >= Sys.maxClaims()} onClick={() => Sys.stakeClaim(g, w.id)}>Stake {fmt(cost)}</button>
            </div>
          );
        })}
        {claimable.length === 0 && <div className="text-sm text-slate-400">No unclaimed revealed wrecks. Send a scout to explore.</div>}
      </div>
    </div>
  );
}

/* ================= Crew ================= */
function Stars({ n }: { n: number }) {
  return <span className="text-amber-300">{'★'.repeat(n)}<span className="text-slate-600">{'★'.repeat(5 - n)}</span></span>;
}
export function CrewPanel({ g }: { g: Game }) {
  const fleet = g.fleet();
  const pays = ['Skimp', 'Standard', 'Bonus'];
  return (
    <div>
      <H>Pay policy</H>
      <Card>
        <div className="flex gap-1">
          {pays.map((p, i) => (
            <button key={p} className={`btn flex-1 ${g.payIdx === i ? 'btn-gold' : ''}`} onClick={() => { g.payIdx = i; }}>{p} ×{[0.7, 1, 1.4][i]}</button>
          ))}
        </div>
        <div className="mt-1 text-xs text-slate-400">Next payday in {Math.ceil(g.wageT)}s: <b className="text-amber-200">{fmt(Sys.wageTotal(g))} cr</b>. Better pay lifts morale; fear of losses lowers it.</div>
      </Card>
      <H right={<span className="text-xs text-slate-400">{g.crew.length} crew</span>}>Roster</H>
      <div className="grid gap-1">
        {g.crew.map((c) => (
          <Card key={c.id} color={c.origin > 0 ? FACTIONS[c.origin].color : undefined}>
            <div className="flex items-center justify-between text-sm">
              <span>{SPEC_INFO[c.spec].icon} <b>{c.name}</b> <Stars n={c.skill} /></span>
              <span className="text-xs text-slate-400">{fmt(c.wage)} cr/pay</span>
            </div>
            <div className="text-xs text-slate-400">{TRAITS[c.trait].name}: {TRAITS[c.trait].desc}{c.origin > 0 ? ` · ex-${FACTIONS[c.origin].tag}` : ''}</div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1">
                <Bar v={c.morale} max={100} color={c.morale > 60 ? '#7dffb0' : c.morale > 30 ? '#ffd36e' : '#ff6b57'} />
                <div className="text-[10px] text-slate-500">Morale {Math.round(c.morale)} · XP {Math.round(c.xp)}/{c.skill * 100}{c.skill >= 5 ? ' (max)' : ''} · kills {c.kills}</div>
              </div>
              <select className="sel" value={c.ship ?? ''} onChange={(e) => Sys.assignCrew(g, c.id, e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">Reserve</option>
                {fleet.map((s) => <option key={s.id} value={s.id}>{SHIPS[s.kind].name} “{s.name}”</option>)}
              </select>
              <button className="btn" onClick={() => Sys.fireCrew(g, c.id)}>Fire</button>
            </div>
          </Card>
        ))}
        {g.crew.length === 0 && <div className="text-sm text-orange-300">No crew! Ships run at 65% efficiency. Hire below.</div>}
      </div>
      <H right={<button className="btn" onClick={() => Sys.refreshPool(g)}>Reroll 60cr</button>}>Candidates ({Math.ceil(g.poolT)}s)</H>
      <div className="grid gap-1">
        {g.pool.map((c) => {
          const cost = Sys.hireCost(g, c);
          return (
            <Card key={c.id} color={c.origin > 0 ? FACTIONS[c.origin].color : undefined}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <div>{SPEC_INFO[c.spec].icon} <b>{c.name}</b> <Stars n={c.skill} /></div>
                  <div className="text-xs text-slate-400">{SPEC_INFO[c.spec].name}: {SPEC_INFO[c.spec].desc} · {TRAITS[c.trait].name}{c.origin > 0 ? ` · ex-${FACTIONS[c.origin].name}` : ''}</div>
                  <div className="text-xs text-slate-500">{TRAITS[c.trait].desc} · wage {c.wage}</div>
                </div>
                <button className="btn btn-gold shrink-0" disabled={g.credits < cost} onClick={() => Sys.hire(g, c.id)}>Hire {fmt(cost)}</button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ================= Lab ================= */
export function LabPanel({ g }: { g: Game }) {
  const st = g.station;
  return (
    <div>
      <H right={<span className="text-xs text-slate-300">💾 {fmt(g.stock.data)} data</span>}>Research lab</H>
      <div className="grid gap-2">
        {LAB.map((d) => {
          const lvl = g.l(d.id);
          const maxed = lvl >= d.max;
          const cc = labCost(lvl), dd = labData(lvl);
          return (
            <Card key={d.id}>
              <div className="flex items-start gap-2">
                <div className="text-xl">{d.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <b>{d.name}</b>
                    <span className="text-amber-300">{'●'.repeat(lvl)}<span className="text-slate-600">{'●'.repeat(d.max - lvl)}</span></span>
                  </div>
                  <div className="text-xs text-slate-400">{d.desc}</div>
                </div>
                <button className="btn btn-gold shrink-0" disabled={maxed || g.credits < cc || g.stock.data < dd} onClick={() => Sys.buyLab(g, d.id)}>
                  {maxed ? 'MAX' : `${fmt(cc)} + ${dd}💾`}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <H>Station</H>
      <Card>
        <div className="flex items-center justify-between text-sm">
          <span>🏰 Hull {fmt(st.hp)} / {fmt(st.maxHp)}</span>
          <button className="btn" disabled={st.hp >= st.maxHp - 1 || g.credits < 150} onClick={() => Sys.repairStation(g)}>Repair 25% · 150cr</button>
        </div>
        <Bar v={st.hp} max={st.maxHp} color="#7dffb0" />
      </Card>
    </div>
  );
}

/* ================= Diplomacy ================= */
export function DiploPanel({ g }: { g: Game }) {
  return (
    <div>
      <H>Rival syndicates</H>
      <div className="grid gap-2">
        {[1, 2, 3].map((id) => {
          const f = FACTIONS[id];
          const rel = g.rel[id];
          const hostile = g.hostile(0, id);
          const status = g.treaty[id] > 0 ? 'Treaty' : hostile ? 'HOSTILE' : rel >= 40 ? 'Allied' : rel >= 10 ? 'Friendly' : rel <= -15 ? 'Cold' : 'Neutral';
          const sc = hostile ? '#ff6b57' : rel >= 40 ? '#7dffb0' : '#9ab';
          const ships = g.ships.filter((s) => s.faction === id).length;
          return (
            <Card key={id} color={f.color}>
              <div className="flex items-center justify-between">
                <b style={{ color: f.color }}>{f.name}</b>
                <span className="text-xs font-bold" style={{ color: sc }}>{status}{g.treaty[id] > 0 ? ` ${Math.ceil(g.treaty[id])}s` : ''}</span>
              </div>
              <div className="text-xs text-slate-400">{f.desc}</div>
              <div className="relative my-1 h-2 rounded bg-white/10">
                <div className="absolute left-1/2 top-0 h-2 w-px bg-white/40" />
                <div className="absolute top-0 h-2 rounded" style={{ left: rel >= 0 ? '50%' : `${50 + rel / 2}%`, width: `${Math.abs(rel) / 2}%`, background: rel >= 0 ? '#7dffb0' : '#ff6b57' }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-400"><span>Relations {Math.round(rel)}</span><span>{ships} ships · {fmt(g.rivals[id].credits)} cr</span></div>
              <div className={`text-[11px] ${rel >= 40 ? 'text-emerald-300' : 'text-slate-500'}`}>{f.friendly}</div>
              <div className={`text-[11px] ${hostile ? 'text-red-300' : 'text-slate-500'}`}>{f.hostile}</div>
              <div className="mt-1 grid grid-cols-2 gap-1">
                <button className="btn" disabled={g.credits < Sys.GIFT_COST} onClick={() => Sys.giftCredits(g, id)}>Gift {Sys.GIFT_COST}cr (+10)</button>
                <button className="btn" disabled={g.stock.relics < 1} onClick={() => Sys.giftRelic(g, id)}>Gift 🏺 (+18)</button>
                <button className="btn" disabled={g.credits < Sys.TREATY_COST || rel <= -70} onClick={() => Sys.signTreaty(g, id)}>Treaty {Sys.TREATY_COST}cr</button>
                <button className="btn" disabled={g.credits < Sys.MERC_COST || rel < 5} onClick={() => Sys.hireMercs(g, id)}>Mercs {Sys.MERC_COST}cr</button>
                <button className="btn btn-red col-span-2" disabled={g.credits < Sys.SABOTAGE_COST || g.cool[id] > 0} onClick={() => Sys.sabotage(g, id)}>
                  {g.cool[id] > 0 ? `Sabotage ready in ${Math.ceil(g.cool[id])}s` : `Sabotage ${Sys.SABOTAGE_COST}cr (-30 rel, freezes fleet)`}
                </button>
              </div>
            </Card>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-slate-400">
        Treaty: 180s of no hostilities. Mercs need relations ≥ 5 and fight for 120s. Poaching claims, shooting rivals, and unpaid contracts hurt relations; gifts, contracts and selling them rights improve them.
      </div>
    </div>
  );
}
