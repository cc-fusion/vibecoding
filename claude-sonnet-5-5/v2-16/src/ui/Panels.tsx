import { useState } from 'react';
import { Game, DIV_POLICY, STATION_COST, DEPOT_COST, PLATFORM_COST, type Train } from '../game/sim';
import { CARGOS, CARGO_INFO, LOCOS, TECHS, SABOTAGE, TERRAIN_NAMES, TERRAIN_NOTE, BASE_TRACK, TERRAIN_COST, COMPANY_COLORS, MONTH_LEN, DIFFS, START_YEAR } from '../game/data';
import { money, short, Bar, Spark, LineChart, Section, Kbd } from './common';
import { audio } from '../game/audio';

export interface PanelCtx {
  g: Game;
  toast: (t: string, ok?: boolean) => void;
  tool: string; setTool: (t: string) => void;
  anchor: number | null; previewInfo: { cost: number; ok: boolean } | null; confirmTrack: () => void; cancelAnchor: () => void;
  selStation: number | null; selTrain: number | null; selectStation: (id: number | null) => void; selectTrain: (id: number | null) => void;
  center: (x: number, y: number) => void;
}
type Res = { ok: boolean; msg: string };

const click = () => audio.sfx('click');

/* ------------------------------------------------ BUILD ------------------------------------------------ */
export function BuildPanel(p: PanelCtx) {
  const { g } = p;
  const tools = [
    { id: 'select', label: 'Select', key: 'V', icon: '👆' },
    { id: 'track', label: 'Track', key: 'T', icon: '🛤️' },
    { id: 'station', label: `Station $${STATION_COST}`, key: 'B', icon: '🏠' },
    { id: 'bulldoze', label: 'Demolish', key: 'X', icon: '💣' },
  ];
  const run = (r: Res) => p.toast(r.msg, r.ok);
  const s = p.selStation != null ? g.st(p.selStation) : undefined;
  const mine = g.stations.filter((x) => x.owner === 0);
  const myRuins = g.ruins.filter((r) => r.owner === 0);
  const repairCost = Math.round(myRuins.reduce((a, r) => a + g.ruinCost(r), 0));
  return (
    <div>
      <Section title="Construction Tools">
        <div className="grid grid-cols-2 gap-1.5">
          {tools.map((t) => (
            <button key={t.id} className={`btn ${p.tool === t.id ? 'btn-on' : ''}`} onClick={() => { click(); p.setTool(t.id); }}>
              <span>{t.icon}</span><span>{t.label}</span><Kbd>{t.key}</Kbd>
            </button>
          ))}
        </div>
        {p.tool === 'track' && (
          <div className="card p-2 mt-2 text-xs leading-snug">
            {p.anchor === null ? 'Click a start tile (usually a station).' : 'Click the destination to lay track along the cheapest path. Right-click / Esc cancels.'}
            {p.anchor !== null && p.previewInfo && (
              <div className="mt-1 flex items-center justify-between">
                <span className={p.previewInfo.ok ? 'text-[#9fe08a]' : 'text-[#ff9a8a]'}>Cost: {money(p.previewInfo.cost)}</span>
                <span className="flex gap-1"><button className="btn btn-sm btn-green" onClick={p.confirmTrack}>Build</button><button className="btn btn-sm" onClick={p.cancelAnchor}>Cancel</button></span>
              </div>
            )}
          </div>
        )}
        {p.tool === 'station' && <div className="card p-2 mt-2 text-xs">Stations gather cargo from towns & industries within <b>3 tiles</b> (dashed box). Rival stations in range share the cargo!</div>}
        {p.tool === 'bulldoze' && <div className="card p-2 mt-2 text-xs">Click your own track or station to remove it (station refund $300).</div>}
      </Section>

      {myRuins.length > 0 && (
        <div className="card p-2 mb-3 border-[#b8412e] flex items-center justify-between">
          <span className="text-xs text-[#ff9a8a]">⚠ {myRuins.length} damaged track tiles</span>
          <button className="btn btn-sm btn-red" onClick={() => run(g.repairRuins(0))}>Repair {money(repairCost)}</button>
        </div>
      )}

      {s && s.owner === 0 && (
        <Section title="Selected Station" right={<button className="btn btn-sm" onClick={() => p.selectStation(null)}>✕</button>}>
          <div className="card p-2 text-xs">
            <div className="font-bold text-sm text-[#ffe08a]">{s.name}</div>
            <div className="flex items-center gap-2 mt-1">Rating <div className="flex-1"><Bar v={g.stationRating(s)} color="#8dcf6a" /></div><b>{Math.round(g.stationRating(s))}%</b></div>
            <div className="grid grid-cols-3 gap-1 mt-2">
              {CARGOS.map((c) => {
                const n = s.cargo[c].reduce((a, q) => a + q.n, 0);
                return <div key={c} className="bg-black/30 rounded px-1.5 py-1" title={CARGO_INFO[c].name}>{CARGO_INFO[c].icon} <b>{Math.round(n)}</b></div>;
              })}
            </div>
            <div className="mt-2 opacity-80">
              Serves: {[...g.nodesNear(s).towns.map((t) => t.name), ...g.nodesNear(s).inds.map((t) => t.name)].join(', ') || 'nothing nearby'}
            </div>
            <div className="mt-2 text-[11px] opacity-80">Platforms: {s.platforms}/4 {s.depot ? '· Depot ✔' : ''} {s.closedUntil > g.t ? '· 🔥 CLOSED' : ''}</div>
            <div className="flex flex-wrap gap-1 mt-2">
              <button className="btn btn-sm" disabled={s.platforms >= 4} onClick={() => run(g.upgradePlatform(s.id))}>+ Platform {money(PLATFORM_COST)}</button>
              <button className="btn btn-sm" disabled={s.depot} onClick={() => run(g.buildDepot(s.id))}>Depot {money(DEPOT_COST)}</button>
              <button className="btn btn-sm" onClick={() => p.center(s.x, s.y)}>📍 Center</button>
            </div>
          </div>
        </Section>
      )}

      <Section title="Terrain & Track Costs">
        <div className="grid grid-cols-1 gap-1 text-xs">
          {[0, 1, 5, 2, 3, 4].map((t) => (
            <div key={t} className="flex justify-between card px-2 py-1">
              <span>{TERRAIN_NAMES[t]} <span className="opacity-60">· {TERRAIN_NOTE[t]}</span></span>
              <b className="text-[#ffe08a]">{money(BASE_TRACK * TERRAIN_COST[t] * g.trackMul(0, t))}</b>
            </div>
          ))}
        </div>
        <div className="text-[11px] opacity-70 mt-1">Reputation, research and land grants alter prices. Rival rails cannot be crossed.</div>
      </Section>

      <Section title={`Your Stations (${mine.length})`}>
        {mine.length === 0 && <div className="text-xs opacity-60">None yet. Pick the Station tool and click near a town.</div>}
        <div className="grid gap-1">
          {mine.map((x) => (
            <button key={x.id} className={`btn justify-between text-left ${p.selStation === x.id ? 'btn-on' : ''}`} onClick={() => { p.selectStation(x.id); p.center(x.x, x.y); }}>
              <span className="truncate">{x.name}</span><span className="text-[11px] opacity-80">{Math.round(g.stationRating(x))}%</span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------ TRAINS ------------------------------------------------ */
export function trainStatus(g: Game, tr: Train) {
  const st = g.st(tr.sched[tr.si]?.st ?? -1);
  if (tr.haltUntil > g.t) return '✋ Halted';
  switch (tr.state) {
    case 'broken': return '🔧 Broken down';
    case 'stuck': return '❓ No route';
    case 'queue': return '⏳ Waiting for platform';
    case 'loading': return `📦 Loading at ${g.st(tr.held)?.name ?? '?'}`;
    case 'idle': return '💤 No schedule';
    default: return `➡ ${st?.name ?? '?'}`;
  }
}

export function TrainsPanel(p: PanelCtx) {
  const { g } = p;
  const mine = g.stations.filter((s) => s.owner === 0);
  const [loco, setLoco] = useState('pioneer');
  const [a, setA] = useState<number>(-1);
  const [b, setB] = useState<number>(-1);
  const [addSt, setAddSt] = useState<number>(-1);
  const run = (r: Res) => p.toast(r.msg, r.ok);
  const avail = g.availableLocos();
  const A = a >= 0 && g.st(a) ? a : mine[0]?.id ?? -1;
  const B = b >= 0 && g.st(b) ? b : mine[1]?.id ?? mine[0]?.id ?? -1;
  const trains = g.trains.filter((t) => t.owner === 0);
  const sel = trains.find((t) => t.id === p.selTrain);
  const lc = LOCOS.find((l) => l.id === loco) || LOCOS[0];

  const edit = (tr: Train, fn: () => void) => { fn(); g.fixSchedule(tr); };
  return (
    <div>
      <Section title="Locomotive Works">
        <div className="grid gap-1.5">
          {LOCOS.map((l) => {
            const ok = avail.includes(l);
            const tech = TECHS.find((t) => t.id === l.tech);
            return (
              <button key={l.id} disabled={!ok} onClick={() => { click(); setLoco(l.id); }} className={`btn text-left !justify-between ${loco === l.id ? 'btn-on' : ''}`}>
                <span className="flex flex-col items-start">
                  <span>{ok ? '🚂' : '🔒'} {l.name}</span>
                  <span className="text-[10.5px] font-normal opacity-75">{ok ? l.desc : `Research: ${tech?.name}`}</span>
                </span>
                <span className="text-right text-[11px] leading-tight">{money(l.cost)}<br />⚡{l.speed} 📦{l.cap}</span>
              </button>
            );
          })}
        </div>
        <div className="card p-2 mt-2 text-xs">
          {mine.length < 2 ? <span className="text-[#ffb08a]">Build and connect at least two stations first.</span> : (
            <>
              <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 items-center">
                <span>From</span>
                <select value={A} onChange={(e) => setA(+e.target.value)}>{mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <span>To</span>
                <select value={B} onChange={(e) => setB(+e.target.value)}>{mine.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              </div>
              <button className="btn btn-gold w-full mt-2" disabled={A === B} onClick={() => { const r = g.buyTrain(0, lc.id, A, B); run(r); if (r.ok && 'id' in r) p.selectTrain((r as { id: number }).id); }}>Buy {lc.name} · {money(lc.cost)}</button>
              {g.stations.length > 0 && A !== B && !g.bfs(g.st(A)!.tile, g.st(B)!.tile) && <div className="mt-1 text-[#ff9a8a]">⚠ These stations are not connected by your track.</div>}
            </>
          )}
        </div>
      </Section>

      {sel && (
        <Section title={`Timetable: ${sel.name}`} right={<button className="btn btn-sm" onClick={() => p.selectTrain(null)}>✕</button>}>
          <div className="card p-2 text-xs">
            <div className="flex justify-between"><span>{g.loco(sel.loco).name}</span><span>{trainStatus(g, sel)}</span></div>
            <div className="flex items-center gap-2 mt-1">Load <div className="flex-1"><Bar v={sel.load} max={g.loco(sel.loco).cap} color="#e0a458" /></div><b>{Math.round(sel.load)}/{g.loco(sel.loco).cap}</b></div>
            <div className="flex items-center gap-2 mt-1">Wear <div className="flex-1"><Bar v={sel.wear} color={sel.wear > 60 ? '#d8604a' : '#8dcf6a'} /></div><b>{Math.round(sel.wear)}%</b></div>
            <div className="mt-1 opacity-80">Earned {money(sel.earned)} · {sel.trips} round trips</div>
            <div className="mt-2 grid gap-1">
              {sel.sched.map((sp, i) => (
                <div key={i} className={`flex items-center gap-1 rounded p-1 ${i === sel.si ? 'bg-[#e0b050]/20' : 'bg-black/25'}`}>
                  <span className="w-4 text-center opacity-70">{i + 1}</span>
                  <select className="flex-1 min-w-0" value={sp.st} onChange={(e) => edit(sel, () => { sp.st = +e.target.value; })}>
                    {g.stations.filter((s) => s.owner === 0).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={sp.order} onChange={(e) => edit(sel, () => { sp.order = e.target.value as 'any' | 'full' | 'drop'; })} title="Orders">
                    <option value="any">Load/Unload</option><option value="full">Full load</option><option value="drop">Unload only</option>
                  </select>
                  <select value={sp.dwell} onChange={(e) => edit(sel, () => { sp.dwell = +e.target.value; })} title="Minimum dwell time">
                    {[1, 2, 3, 5, 8, 12].map((d) => <option key={d} value={d}>{d}s</option>)}
                  </select>
                  <button className="btn btn-sm !px-1" onClick={() => edit(sel, () => { if (i > 0) [sel.sched[i - 1], sel.sched[i]] = [sel.sched[i], sel.sched[i - 1]]; })}>↑</button>
                  <button className="btn btn-sm !px-1" onClick={() => edit(sel, () => { sel.sched.splice(i, 1); })}>✕</button>
                </div>
              ))}
            </div>
            <div className="flex gap-1 mt-2">
              <select className="flex-1 min-w-0" value={addSt} onChange={(e) => setAddSt(+e.target.value)}>
                <option value={-1}>Add stop...</option>
                {g.stations.filter((s) => s.owner === 0).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button className="btn btn-sm" disabled={addSt < 0} onClick={() => { edit(sel, () => { sel.sched.push({ st: addSt, order: 'any', dwell: 3 }); }); setAddSt(-1); }}>Add</button>
            </div>
            <div className="flex gap-1 mt-2">
              <button className="btn btn-sm" onClick={() => run(g.serviceTrain(sel.id))}>🔧 Service $300</button>
              <button className="btn btn-sm btn-red" onClick={() => { run(g.sellTrain(sel.id)); p.selectTrain(null); }}>Sell</button>
            </div>
            <div className="mt-2 text-[10.5px] opacity-70">Trains only load cargo that another stop on the timetable will accept. "Full load" waits up to 25s for a full train. A depot station services trains for you.</div>
          </div>
        </Section>
      )}

      <Section title={`Fleet (${trains.length})`}>
        {trains.length === 0 && <div className="text-xs opacity-60">You own no locomotives yet.</div>}
        <div className="grid gap-1">
          {trains.map((t) => (
            <button key={t.id} className={`btn !justify-between text-left ${p.selTrain === t.id ? 'btn-on' : ''}`} onClick={() => { p.selectTrain(t.id); const pos = g.trainXY(t, 0); p.center(pos.x / 24, pos.y / 24); }}>
              <span className="flex flex-col"><span className="truncate">{t.name}</span><span className="text-[10.5px] font-normal opacity-75">{trainStatus(g, t)}</span></span>
              <span className="text-[11px] text-right">{short(t.earned)}<br /><span className={t.wear > 60 ? 'text-[#ff9a8a]' : 'opacity-70'}>🔧{Math.round(t.wear)}%</span></span>
            </button>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------ MARKET ------------------------------------------------ */
export function MarketPanel(p: PanelCtx) {
  const { g } = p;
  const run = (r: Res) => p.toast(r.msg, r.ok);
  const me = g.pl;
  const room = Math.max(0, g.creditLimit(me) - me.loan);
  const stake = (g.hold[0][0] || 0) / me.shares;
  const threat = g.companies.slice(1).filter((c) => c.alive).map((c) => ({ c, pct: (g.hold[0][c.id] || 0) / me.shares })).sort((a, b) => b.pct - a.pct)[0];
  return (
    <div>
      <Section title="Banking">
        <div className="card p-2 text-xs">
          <div className="grid grid-cols-3 gap-1 text-center">
            <div><div className="opacity-60">Cash</div><b className={me.cash < 0 ? 'text-[#ff8a7a]' : ''}>{money(me.cash)}</b></div>
            <div><div className="opacity-60">Debt</div><b>{money(me.loan)}</b></div>
            <div><div className="opacity-60">Credit room</div><b>{money(room)}</b></div>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            <button className="btn btn-sm" onClick={() => run(g.borrow(5000))}>Borrow $5k</button>
            <button className="btn btn-sm" onClick={() => run(g.borrow(20000))}>Borrow $20k</button>
            <button className="btn btn-sm" onClick={() => run(g.repay(5000))}>Repay $5k</button>
            <button className="btn btn-sm" onClick={() => run(g.repay(me.loan))}>Repay all</button>
          </div>
          <div className="opacity-70 mt-1.5 text-[11px]">Interest {g.panicUntil > g.t ? '11%' : '7.5%'} a year, charged monthly. Three straight months overdrawn means bankruptcy.</div>
        </div>
      </Section>

      <Section title={`${me.name} (You)`}>
        <div className="card p-2 text-xs">
          <div className="flex items-center justify-between"><span>Share price <b className="text-[#ffe08a] text-sm">${me.price.toFixed(2)}</b></span><Spark data={me.priceHist} color={me.color} w={110} /></div>
          <div className="flex items-center gap-2 mt-1.5">Your stake <div className="flex-1 relative"><Bar v={stake * 100} color={stake > 0.5 ? '#8dcf6a' : '#d8604a'} /><div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: '50%' }} /></div><b>{(stake * 100).toFixed(0)}%</b></div>
          <div className="opacity-70 text-[11px] mt-0.5">{me.shares.toLocaleString()} shares · {(g.hold[0][-1] || 0).toLocaleString()} public. If a rival owns over 50%, you are ousted!</div>
          {threat && threat.pct > 0.05 && <div className="mt-1 text-[#ffb08a]">⚠ {threat.c.name} owns {(threat.pct * 100).toFixed(0)}% of you.</div>}
          <div className="flex items-center gap-2 mt-2">Dividend policy
            <select value={me.div} onChange={(e) => { me.div = +e.target.value; click(); }}>
              {DIV_POLICY.map((d, i) => <option key={i} value={i}>{d * 100}% of profit</option>)}
            </select>
          </div>
          <div className="opacity-70 text-[11px] mt-0.5">Paid each January to outside shareholders. Higher payouts lift your price.</div>
          <div className="flex flex-wrap gap-1 mt-2">
            <button className="btn btn-sm" onClick={() => run(g.issueShares(0, 100))}>Issue 100 shares</button>
            <button className="btn btn-sm" onClick={() => run(g.buyback(0, 50))}>Buy back 50</button>
            <button className="btn btn-sm" onClick={() => run(g.sellShares(0, 0, 50))}>Sell 50 of yours</button>
            <button className="btn btn-sm" onClick={() => run(g.buyShares(0, 0, 50))}>Buy 50 of yours</button>
          </div>
        </div>
      </Section>

      <Section title="Rival Stock Exchange">
        <div className="grid gap-2">
          {g.companies.slice(1).map((c) => {
            const mine = g.hold[c.id]?.[0] || 0;
            const pct = c.alive ? mine / c.shares : 0;
            const pub = g.hold[c.id]?.[-1] || 0;
            return (
              <div key={c.id} className="card p-2 text-xs" style={{ borderColor: c.color + '88', opacity: c.alive ? 1 : 0.5 }}>
                <div className="flex items-center justify-between">
                  <b style={{ color: c.color }}>{c.name}</b>
                  {c.alive ? <span className="flex items-center gap-2"><Spark data={c.priceHist} color={c.color} w={70} h={20} /><b>${c.price.toFixed(2)}</b></span> : <span>ABSORBED</span>}
                </div>
                {c.alive && (
                  <>
                    <div className="flex items-center gap-2 mt-1">You own <div className="flex-1 relative"><Bar v={pct * 100} color={pct > 0.5 ? '#ffd24a' : c.color} /><div className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: '50%' }} /></div><b>{(pct * 100).toFixed(0)}%</b></div>
                    <div className="opacity-70 text-[11px]">{mine} held · {pub} public · worth {short(c.nw)} · dividend {DIV_POLICY[c.div] * 100}%</div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <button className="btn btn-sm" onClick={() => run(g.buyShares(0, c.id, 10))}>Buy 10</button>
                      <button className="btn btn-sm" onClick={() => run(g.buyShares(0, c.id, 50))}>Buy 50</button>
                      <button className="btn btn-sm" onClick={() => run(g.buyShares(0, c.id, 200))}>Buy 200</button>
                      <button className="btn btn-sm" disabled={mine <= 0} onClick={() => run(g.sellShares(0, c.id, 50))}>Sell 50</button>
                      <button className="btn btn-sm btn-gold" disabled={!g.canAbsorb(0, c.id)} onClick={() => run(g.absorb(0, c.id))}>⚔ Take over</button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[11px] opacity-70 mt-1">Own more than half of a rival and absorb its tracks, stations, trains and cash. Fee {(g.fee() * 100).toFixed(1)}% per trade. Buying lifts the price; selling drops it.</div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------ RIVALS ------------------------------------------------ */
const chainCache: Record<string, number> = {};
export function chainProgress(g: Game, cid: number) {
  const key = `${g.seed}:${cid}:${Math.floor(g.t / 2)}`;
  if (chainCache[key] !== undefined) return chainCache[key];
  const ts = [...g.towns].sort((a, b) => a.x - b.x);
  let n = 0;
  const c = g.comp(cid);
  if (c.tiles > 1) for (let i = 0; i < ts.length - 1; i++) if (g.townsConnected(cid, ts[i], ts[i + 1])) n++;
  chainCache[key] = n;
  return n;
}

export function RivalsPanel(p: PanelCtx) {
  const { g } = p;
  const run = (r: Res) => p.toast(r.msg, r.ok);
  const me = g.pl;
  const total = g.towns.length - 1;
  const secCost = (lv: number) => Math.round(lv * 140 * (g.has('pinkerton') ? 0.6 : 1));
  return (
    <div>
      <Section title="The Golden Spike Race">
        <div className="card p-2 text-xs">
          <div className="mb-1">Connect <b className="text-[#ffe08a]">{g.towns[0].name}</b> to <b className="text-[#ffe08a]">{g.towns[g.towns.length - 1].name}</b> first.</div>
          {g.spike ? <div className="text-[#ffe08a]">🏆 Spike driven by <b>{g.comp(g.spike.by).name}</b>.</div> : (
            g.companies.filter((c) => c.alive && (c.isPlayer || c.def?.boss)).map((c) => (
              <div key={c.id} className="flex items-center gap-2 mt-1"><span className="w-28 truncate" style={{ color: c.color }}>{c.isPlayer ? 'You' : c.name.split(' ')[0]}</span><div className="flex-1"><Bar v={chainProgress(g, c.id)} max={total} color={c.color} /></div><span>{chainProgress(g, c.id)}/{total}</span></div>
            ))
          )}
          <div className="opacity-60 text-[11px] mt-1">Bars count linked town-to-town segments (each segment a station chain in a connected network).</div>
        </div>
      </Section>

      <Section title="Reputation & Security">
        <div className="card p-2 text-xs">
          <div className="flex items-center gap-2">Reputation <div className="flex-1"><Bar v={g.rep} color="#8dcf6a" /></div><b>{Math.round(g.rep)}</b></div>
          <div className="flex items-center gap-2 mt-1">Notoriety <div className="flex-1"><Bar v={g.notoriety} color={g.notoriety > 50 ? '#d8402a' : '#e0a458'} /></div><b>{Math.round(g.notoriety)}</b></div>
          <div className="opacity-70 text-[11px] mt-1">Notoriety fuels rival grudges, triggers audits at 25+ and a federal injunction at 100. Good rep makes track cheaper and shares pricier.</div>
          <div className="flex items-center gap-1 mt-2">Security detail:
            {[0, 1, 2, 3].map((lv) => <button key={lv} className={`btn btn-sm ${me.security === lv ? 'btn-on' : ''}`} onClick={() => g.setSecurity(lv)}>{lv === 0 ? 'None' : `L${lv} ${money(secCost(lv))}/mo`}</button>)}
          </div>
          <div className="opacity-70 text-[11px] mt-1">Each level reduces sabotage and bandit success against you.</div>
        </div>
      </Section>

      {g.companies.slice(1).map((c) => (
        <Section key={c.id} title={c.name}>
          <div className="card p-2 text-xs" style={{ borderColor: c.color + '99', opacity: c.alive ? 1 : 0.5 }}>
            <div className="italic opacity-80">{c.def?.title} - "{c.def?.style}"</div>
            <div className="opacity-70 text-[11px] mb-1">{c.def?.bio}</div>
            {c.alive ? (
              <>
                <div className="grid grid-cols-4 gap-1 text-center mb-2">
                  <div className="bg-black/30 rounded p-1"><div className="opacity-60 text-[10px]">Worth</div><b>{short(c.nw)}</b></div>
                  <div className="bg-black/30 rounded p-1"><div className="opacity-60 text-[10px]">Cash</div><b>{short(c.cash)}</b></div>
                  <div className="bg-black/30 rounded p-1"><div className="opacity-60 text-[10px]">Trains</div><b>{c.trainsN}</b></div>
                  <div className="bg-black/30 rounded p-1"><div className="opacity-60 text-[10px]">Track</div><b>{c.tiles}</b></div>
                </div>
                <div className="grid gap-1">
                  {SABOTAGE.map((s) => (
                    <button key={s.id} className="btn btn-sm !justify-between text-left" title={s.desc} onClick={() => run(g.sabotage(0, c.id, s.id))}>
                      <span>{s.icon} {s.name}</span><span className="text-[10.5px] opacity-80">{money(s.cost)} · {Math.round(g.guardChance(c.id) * 100)}%</span>
                    </button>
                  ))}
                </div>
                <div className="opacity-60 text-[10.5px] mt-1">Success depends on their security. Agents may be caught anyway: fines, notoriety and revenge.</div>
              </>
            ) : <div>This company has been absorbed.</div>}
          </div>
        </Section>
      ))}
    </div>
  );
}

/* ------------------------------------------------ CONTRACTS ------------------------------------------------ */
export function ContractsPanel(p: PanelCtx) {
  const { g } = p;
  const run = (r: Res) => p.toast(r.msg, r.ok);
  const active = g.contracts.filter((c) => c.active);
  const offers = g.contracts.filter((c) => !c.active);
  const mLeft = (t: number) => Math.max(0, Math.ceil((t - g.t) / MONTH_LEN));
  return (
    <div>
      <Section title={`Active Contracts (${active.length}/3)`}>
        {active.length === 0 && <div className="text-xs opacity-60">No active contracts. Accept an offer below.</div>}
        <div className="grid gap-1.5">
          {active.map((k) => (
            <div key={k.id} className="card p-2 text-xs">
              <div className="flex justify-between"><b>{CARGO_INFO[k.cargo].icon} {Math.round(k.qty)} {CARGO_INFO[k.cargo].name} → {k.sinkName}</b><span className={mLeft(k.deadline) <= 2 ? 'text-[#ff9a8a]' : ''}>{mLeft(k.deadline)} mo</span></div>
              <div className="mt-1"><Bar v={k.got} max={k.qty} color="#8dcf6a" /></div>
              <div className="flex justify-between mt-1 opacity-80"><span>{Math.round(k.got)}/{Math.round(k.qty)} delivered</span><span>Reward {money(k.reward)} · Penalty {money(k.penalty)}</span></div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Offers">
        {offers.length === 0 && <div className="text-xs opacity-60">No offers right now. Telegrams arrive every couple of months.</div>}
        <div className="grid gap-1.5">
          {offers.map((k) => (
            <div key={k.id} className="card p-2 text-xs">
              <div className="font-bold">{CARGO_INFO[k.cargo].icon} Deliver {Math.round(k.qty)} {CARGO_INFO[k.cargo].name} to {k.sinkName}</div>
              <div className="opacity-80 mt-0.5">Reward <b className="text-[#9fe08a]">{money(k.reward)}</b> · Penalty if late {money(k.penalty)} · offer expires in {mLeft(k.offerUntil)} mo</div>
              <div className="flex gap-1 mt-1.5"><button className="btn btn-sm btn-green" onClick={() => run(g.acceptContract(k.id))}>Accept</button><button className="btn btn-sm" onClick={() => g.declineContract(k.id)}>Decline</button></div>
            </div>
          ))}
        </div>
        <div className="text-[11px] opacity-70 mt-2">Deliver by any of your stations covering the destination. Completed contracts boost reputation; failures hurt it.</div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------ RESEARCH ------------------------------------------------ */
export function ResearchPanel(p: PanelCtx) {
  const { g } = p;
  const run = (r: Res) => p.toast(r.msg, r.ok);
  return (
    <div>
      <Section title="Engineering Office">
        {g.research ? (() => {
          const t = TECHS.find((x) => x.id === g.research!.id)!;
          return <div className="card p-2 text-xs"><b>{t.icon} {t.name}</b><div className="mt-1"><Bar v={g.research.total - g.research.left} max={g.research.total} color="#9fd3ff" /></div><div className="opacity-70 mt-1">{Math.ceil(g.research.left)}s remaining</div></div>;
        })() : <div className="card p-2 text-xs opacity-80">Idle. Choose a project below (one at a time).</div>}
      </Section>
      <div className="grid gap-1.5">
        {TECHS.map((t) => {
          const done = g.techs.has(t.id);
          const locked = !!t.req && !g.techs.has(t.req);
          const busy = g.research?.id === t.id;
          return (
            <div key={t.id} className={`card p-2 text-xs ${done ? 'border-[#6f9a4a]' : ''}`} style={{ opacity: locked ? 0.55 : 1 }}>
              <div className="flex items-center justify-between">
                <b>{t.icon} {t.name}</b>
                {done ? <span className="text-[#9fe08a]">✔ Done</span> : busy ? <span className="text-[#9fd3ff]">Researching…</span> :
                  <button className="btn btn-sm" disabled={locked || !!g.research} onClick={() => run(g.startResearch(t.id))}>{money(t.cost)} · {t.time}s</button>}
              </div>
              <div className="opacity-80 mt-0.5">{t.desc}</div>
              {locked && <div className="text-[#ffb08a] text-[11px] mt-0.5">Requires {TECHS.find((x) => x.id === t.req)?.name}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------ LEDGER ------------------------------------------------ */
export function LedgerPanel(p: PanelCtx) {
  const { g } = p;
  const ranks = g.rankings();
  const maxW = Math.max(1, ...ranks.map((r) => r.w));
  const w = g.worth(g.pl);
  const diff = DIFFS.find((d) => d.id === g.diff.id) || g.diff;
  const yearsLeft = Math.max(0, g.endYear - g.year);
  const st = g.stats;
  return (
    <div>
      <Section title="Campaign Objectives">
        <div className="card p-2 text-xs grid gap-1.5">
          <div>🏆 <b>Empire:</b> Golden Spike first + net worth {short(diff.target)}</div>
          <div className="flex items-center gap-2"><div className="flex-1"><Bar v={w} max={diff.target} color="#e0b050" /></div><b>{short(w)}</b></div>
          <div className={g.spike ? (g.spike.by === 0 ? 'text-[#9fe08a]' : 'text-[#ff9a8a]') : 'opacity-80'}>🚂 Golden Spike: {g.spike ? (g.spike.by === 0 ? 'YOURS' : `taken by ${g.comp(g.spike.by).name}`) : 'still open'}</div>
          <div>📅 <b>Or</b> be the richest baron when {g.endYear} dawns ({yearsLeft} yrs left, started {START_YEAR}).</div>
          <div>⚔ <b>Or</b> absorb every rival (monopoly).</div>
        </div>
      </Section>
      <Section title="Rankings">
        <div className="grid gap-1">
          {ranks.map((r, i) => (
            <div key={r.c.id} className="text-xs">
              <div className="flex justify-between"><span style={{ color: r.c.color }}>{i + 1}. {r.c.name}{r.c.isPlayer ? ' (You)' : ''}</span><b>{short(r.w)}</b></div>
              <Bar v={Math.max(0, r.w)} max={maxW} color={r.c.color} />
            </div>
          ))}
        </div>
      </Section>
      <Section title="Net Worth History">
        <LineChart series={g.companies.filter((c) => c.alive || c.nwHist.length).map((c) => ({ data: c.nwHist, color: c.color, name: c.name }))} />
      </Section>
      <Section title="Monthly Revenue (you)">
        <div className="flex items-end gap-px h-14 card p-1">
          {g.pl.revHist.slice(-36).map((v, i, a) => <div key={i} className="flex-1 bg-[#e0b050]" style={{ height: `${Math.max(2, (v / Math.max(1, ...a)) * 100)}%` }} title={money(v)} />)}
        </div>
      </Section>
      <Section title="Statistics">
        <div className="grid grid-cols-2 gap-1 text-xs">
          {[['Cargo delivered', Math.round(st.delivered).toLocaleString()], ['Revenue', short(st.revenue)], ['Track laid', `${st.tracks} tiles`], ['Trains bought', st.trainsBought], ['Contracts done', st.contracts], ['Contracts failed', st.contractsFailed], ['Sabotage done', st.sabotageDone], ['Sabotage suffered', st.sabotageHit], ['Times caught', st.caught], ['Rivals absorbed', st.absorbed], ['Events survived', st.events], ['Dividends earned', short(st.stockProfit)]].map(([k, v]) => (
            <div key={String(k)} className="card px-2 py-1 flex justify-between"><span className="opacity-70">{k}</span><b>{v}</b></div>
          ))}
        </div>
      </Section>
      <Section title="News Log">
        <div className="grid gap-1 text-xs">
          {g.news.slice(0, 40).map((n, i) => (
            <div key={i} className="card px-2 py-1" style={{ borderColor: n.kind === 'bad' ? '#b8412e' : n.kind === 'good' ? '#6f9a4a' : n.kind === 'warn' ? '#c8902c' : undefined }}>
              <span className="opacity-60">{n.date} · </span>{n.text}
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export const TABS: { id: string; label: string; icon: string }[] = [
  { id: 'build', label: 'Build', icon: '🛤️' },
  { id: 'trains', label: 'Trains', icon: '🚂' },
  { id: 'market', label: 'Market', icon: '📈' },
  { id: 'rivals', label: 'Rivals', icon: '🎩' },
  { id: 'contracts', label: 'Jobs', icon: '📜' },
  { id: 'research', label: 'Research', icon: '🔬' },
  { id: 'ledger', label: 'Ledger', icon: '📖' },
];
export { COMPANY_COLORS };
