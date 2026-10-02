import { useState, type ReactNode } from 'react';
import { FACTIONS, GOODS, GOOD_IDS } from '../game/data';
import type { Game, Rumor } from '../game/engine';
import { cn } from '../utils/cn';
import { Bar, click, fmt } from './Common';

export const rumorIcon = (r: Rumor) => (r.kind === 'scandal' ? '🕯️' : r.dir > 0 ? '📈' : '📉');

export function Talk({ game }: { game: Game }) {
  const npc = game.talk;
  const [tab, setTab] = useState<'rumors' | 'trade' | 'more'>(npc && npc.def.role === 'vendor' ? 'trade' : 'rumors');
  if (!npc) return null;
  const d = npc.def; const fac = FACTIONS[d.faction]; const favor = game.run.favor[d.faction];
  const isVendor = d.role === 'vendor';
  const tabs: ['rumors' | 'trade' | 'more', string][] = [['rumors', '🗣️ Rumors'], ...(isVendor ? [['trade', '⚖️ Trade'] as ['trade', string]] : []), ['more', '✦ More']];
  const dist = Math.hypot(npc.x - game.player.x, npc.y - game.player.y);

  return (
    <div className="panel anim-pop flex flex-col overflow-hidden w-full max-h-full">
      <div className="p-3 flex items-start gap-3 border-b border-white/10" style={{ background: `linear-gradient(90deg, ${fac.color}22, transparent)` }}>
        <div className="w-11 h-11 rounded-full shrink-0 flex items-center justify-center text-xl border-2" style={{ background: d.color, borderColor: fac.color }}>{fac.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-base text-amber-100 truncate">{d.name}</div>
          <div className="text-xs text-white/60 truncate">{d.title} · <span style={{ color: fac.color }}>{fac.name}</span> · favor {Math.round(favor)}</div>
          <div className="text-[11px] italic text-white/45 truncate">"{d.bio}"</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => game.closeTalk()} aria-label="Close">✕</button>
      </div>
      <div className="flex gap-1 p-2 border-b border-white/10">
        {tabs.map(([k, l]) => <button key={k} className={cn('tabbtn', tab === k && 'on')} onClick={() => { click(); setTab(k); }}>{l}</button>)}
        <div className="ml-auto text-[11px] text-white/45 self-center">{dist > 110 ? '⚠ drifting away' : 'time slowed'}</div>
      </div>
      <div className="p-3 overflow-y-auto scroll flex-1 space-y-3">
        {tab === 'rumors' && <RumorsTab game={game} />}
        {tab === 'trade' && isVendor && <TradeTab game={game} />}
        {tab === 'more' && <MoreTab game={game} />}
      </div>
    </div>
  );
}

function RumorsTab({ game }: { game: Game }) {
  const npc = game.talk!; const d = npc.def;
  const offers = game.offers(npc);
  const mine = game.pendingRumors();
  const believes = Object.keys(npc.beliefs).map(k => game.rumors.get(+k)).filter((r): r is Rumor => !!r && r.state === 'pending' && npc.beliefs[r.id] >= 0.2);
  const cost = game.hasPerk('c_quiet') ? 4 : 8;
  const noGossip = ['warden', 'cutpurse', 'rival'].includes(d.role);
  return (
    <>
      <div>
        <button className="btn btn-sm w-full" disabled={!!game.listen || game.player.poise < cost} onClick={() => game.eavesdrop(npc)}>
          👂 Eavesdrop <span className="opacity-70">(−{cost} Poise{d.role === 'warden' ? ', risky!' : ''})</span>
        </button>
        {game.listen && <div className="mt-1"><Bar value={game.listen.p} max={game.listen.dur} color="#d6c2ff" h={6} label="Listening..." /></div>}
        <div className="text-[11px] text-white/45 mt-1">Free rumors, but you might be noticed. Stay close.</div>
      </div>

      <Section title="Rumors they would sell">
        {offers.length === 0 && <Empty>{noGossip ? `${d.name} deals in no gossip.` : 'Nothing new to buy right now.'}</Empty>}
        {offers.map(r => {
          const price = game.buyPrice(npc, r);
          return (
            <div key={r.id} className="card p-2 flex items-center gap-2">
              <span className="text-lg">{rumorIcon(r)}</span>
              <div className="flex-1 text-xs leading-snug">{r.text}</div>
              <button className="btn btn-sm btn-gold shrink-0" disabled={game.run.coins < price} onClick={() => game.buyRumor(npc, r.id)}>{fmt(price)}c</button>
            </div>
          );
        })}
      </Section>

      <Section title="Your ledger: sell or plant">
        {mine.length === 0 && <Empty>No live rumors. Eavesdrop, buy, or forge one.</Empty>}
        {mine.map(l => {
          const r = game.rumors.get(l.rid)!; const belief = npc.beliefs[r.id] || 0;
          const heard = belief >= 0.5; const price = game.sellPrice(npc, r);
          return (
            <div key={r.id} className="card p-2">
              <div className="flex gap-2 text-xs leading-snug"><span className="text-lg">{rumorIcon(r)}</span><span className="flex-1">{r.text}</span></div>
              <div className="mt-1.5 flex gap-1.5 items-center">
                <button className="btn btn-sm btn-gold flex-1" disabled={heard || noGossip && d.role !== 'warden'} onClick={() => game.sellRumor(npc, r.id)}>{heard ? 'Heard it' : `Sell +${fmt(price)}c`}</button>
                <button className="btn btn-sm flex-1" disabled={noGossip || belief >= 0.7 || game.player.poise < game.plantCost()} onClick={() => game.plant(npc, r.id)}>Plant (−{game.plantCost()})</button>
                <span className="chip">{Math.round(belief * 100)}%</span>
              </div>
            </div>
          );
        })}
      </Section>

      <Section title="What they believe">
        {believes.length === 0 && <Empty>Nothing on their mind.</Empty>}
        {believes.map(r => (
          <div key={r.id} className="card p-2 flex items-center gap-2">
            <span className="text-lg">{rumorIcon(r)}</span>
            <div className="flex-1 text-xs leading-snug">{r.text}<div className="text-white/40">belief {Math.round(npc.beliefs[r.id] * 100)}%</div></div>
            <button className="btn btn-sm shrink-0" disabled={game.player.poise < 15 || game.run.coins < 10 + game.run.night * 2} onClick={() => game.debunk(npc, r.id)}>Debunk</button>
          </div>
        ))}
        <div className="text-[11px] text-white/45">Debunk costs 15 Poise + {10 + game.run.night * 2}c. Beware: debunking a true rumor costs credibility later.</div>
      </Section>
    </>
  );
}

function TradeTab({ game }: { game: Game }) {
  const npc = game.talk!;
  const room = game.cap - game.cargoCount;
  const beliefs = Object.keys(npc.beliefs).map(k => game.rumors.get(+k)).filter((r): r is Rumor => !!r && r.state === 'pending' && r.kind === 'market');
  return (
    <>
      <div className="flex items-center justify-between text-xs">
        <span>🎒 Cargo {game.cargoCount}/{game.cap}</span><span>🪙 {fmt(game.run.coins)}c</span>
      </div>
      <div className="space-y-1.5">
        {GOOD_IDS.map(g => {
          const q = game.quote(npc, g); const good = GOODS[g]; const have = game.run.cargo[g];
          const ratio = q.mid / (good.base * (npc.def.good === g ? 0.87 : 1));
          const col = ratio > 1.08 ? '#ffb347' : ratio < 0.92 ? '#6ec6ff' : '#cfc6e6';
          return (
            <div key={g} className="card p-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{good.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">{good.name}{npc.def.good === g && <span className="ml-1 text-[10px] text-emerald-300">specialty</span>}</div>
                  <div className="text-[11px] text-white/55">You hold {have.qty}{have.qty > 0 && ` (avg ${Math.round(have.cost)}c)`}</div>
                </div>
                <div className="text-right text-xs leading-tight" style={{ color: col }}>
                  <div>Ask <b>{q.ask}c</b></div><div>Bid <b>{q.bid}c</b></div>
                </div>
              </div>
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                <button className="btn btn-sm" disabled={room < 1 || game.run.coins < q.ask} onClick={() => game.buyGood(npc, g, 1)}>Buy 1</button>
                <button className="btn btn-sm" disabled={room < 1 || game.run.coins < q.ask} onClick={() => game.buyGood(npc, g, 5)}>Buy 5</button>
                <button className="btn btn-sm btn-gold" disabled={have.qty < 1} onClick={() => game.sellGood(npc, g, 1)}>Sell 1</button>
                <button className="btn btn-sm btn-gold" disabled={have.qty < 1} onClick={() => game.sellGood(npc, g, have.qty)}>Sell all</button>
              </div>
            </div>
          );
        })}
      </div>
      <Section title={`What ${npc.def.name.split(' ')[0]} has heard`}>
        {beliefs.length === 0 && <Empty>No rumor is bending their prices.</Empty>}
        {beliefs.map(r => <div key={r.id} className="text-xs card p-2">{rumorIcon(r)} {r.text} <span className="text-white/45">({r.dir > 0 ? '+' : '−'}{Math.round(r.mag * 60 * (npc.beliefs[r.id] || 0))}% to their {GOODS[r.good!].name} price)</span></div>)}
      </Section>
    </>
  );
}

function MoreTab({ game }: { game: Game }) {
  const npc = game.talk!; const d = npc.def; const sched = game.schedText(npc);
  const gcost = 15 + game.run.night * 2;
  const ev = game.evidence().length;
  return (
    <>
      <Section title="Goodwill">
        <button className="btn btn-sm w-full" disabled={game.run.coins < gcost} onClick={() => game.gift(npc)}>🎁 Give a gift ({gcost}c) → +3 {FACTIONS[d.faction].name} favor</button>
        {d.role === 'warden' && <button className="btn btn-sm w-full" disabled={game.run.coins < game.bribeCost()} onClick={() => game.bribe(npc)}>💰 Bribe ({game.bribeCost()}c) → Heat −35</button>}
        {d.role === 'rival' && (
          <div>
            <button className="btn btn-sm btn-danger w-full" disabled={ev < 2} onClick={() => game.expose(npc)}>🎭 Expose the Magpie ({ev}/2 proofs)</button>
            <div className="text-[11px] text-white/50 mt-1">Collect two Magpie rumors that have been debunked (listen for them, wait for them to be proven false), then confront her.{game.bossNight && ' During the Masquerade, exposing her cuts her Grip by 32.'}</div>
          </div>
        )}
      </Section>
      <Section title="Where will they be?">
        {sched ? (sched.length ? sched.map((s, i) => <div key={i} className="text-xs card p-2 flex justify-between"><span>🕐 {s.t}</span><span>{s.loc}</span></div>) : <Empty>They stay put until dawn.</Empty>) : <Empty>Their movements are unknown.</Empty>}
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <div><div className="font-display text-[11px] uppercase tracking-widest text-amber-200/70 mb-1.5">{title}</div><div className="space-y-1.5">{children}</div></div>;
}
function Empty({ children }: { children: ReactNode }) { return <div className="text-xs text-white/40 italic px-1">{children}</div>; }
