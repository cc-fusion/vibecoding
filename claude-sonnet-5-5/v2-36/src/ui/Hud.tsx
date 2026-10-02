import { useEffect, useState } from 'react';
import { FACTIONS, FACTION_IDS, GOODS, GOOD_IDS, TUTORIAL, type FactionId, type GoodId } from '../game/data';
import { clockText, type Game, type Rumor } from '../game/engine';
import { audio } from '../game/audio';
import { cn } from '../utils/cn';
import { Bar, click, fmt, Pips } from './Common';
import { FavorTree } from './Favors';
import { Talk, rumorIcon } from './Talk';

type Tab = 'ledger' | 'cargo' | 'market' | 'factions' | 'contacts';
const TABS: [Tab, string, string][] = [['ledger', '📜', 'Ledger'], ['cargo', '🎒', 'Cargo'], ['market', '📊', 'Market'], ['factions', '🏮', 'Favors'], ['contacts', '👥', 'Folk']];

export function Hud({ game }: { game: Game }) {
  const [tab, setTab] = useState<Tab>('ledger');
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 900);
  const run = game.run; const p = game.player;
  const coarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (game.phase !== 'night' || game.paused) return;
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(e.code);
      if (idx >= 0) { setTab(TABS[idx][0]); setOpen(true); }
      if (e.code === 'Tab') { e.preventDefault(); setOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game]);

  const quota = game.quota; const next = game.hasPerk('g_clerk') ? game.nextEvent() : null;
  const talking = !!game.talk;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }}>
      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 p-2 pointer-events-none">
        <div className="panel px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 pointer-events-auto">
          <div className="min-w-[150px]">
            <div className="font-display text-sm text-amber-100 leading-none">{game.bossNight ? '🐦 The Masquerade' : `🌙 Night ${run.night}`} <span className="text-white/50 font-sans text-xs">· {clockText(game.frac)}</span></div>
            <div className="relative mt-1.5 h-2 rounded-full bg-black/50 border border-white/10">
              <div className="h-full rounded-full" style={{ width: `${game.frac * 100}%`, background: 'linear-gradient(90deg,#ff9d5c,#6a5cff,#ff9ab0)' }} />
              {game.events.filter(e => e.started).map((e, i) => <span key={i} className="absolute -top-1.5 text-[11px]" style={{ left: `calc(${e.startT * 100}% - 6px)` }} title={e.def.name}>{e.def.icon}</span>)}
            </div>
          </div>
          <div className="min-w-[150px]">
            <div className="text-sm leading-none">🪙 <b className="text-amber-200">{fmt(run.coins)}</b> <span className="text-xs text-white/50">/ tithe {quota}c</span></div>
            <Bar value={run.coins} max={quota} color={run.coins >= quota ? '#6fe0a8' : '#f2c14e'} className="mt-1.5" />
          </div>
          <Meter label="Credibility" icon="🗝️" value={run.cred} color="#8fd0ff" />
          <Meter label="Heat" icon="🔥" value={p.heat} color={p.heat > 70 ? '#ff4d4d' : '#ff9a4d'} pulse={p.heat > 70} />
          <Meter label="Poise" icon="🌀" value={p.poise} max={game.maxPoise} color="#b79bff" />
          <div className="text-xs leading-tight" title="Three arrests ends the run">⛓️ <Pips n={run.strikes} max={3} color="#ff6a6a" /></div>
          {next && <div className="text-xs text-amber-200/80">🔭 {next.icon} {next.name} in {Math.floor(next.in / 60)}:{String(Math.floor(next.in % 60)).padStart(2, '0')}</div>}
          <div className="ml-auto flex gap-1.5">
            <button className="btn btn-ghost btn-sm" onClick={() => { click(); game.setVol({ muted: !audio.vol.muted }); }} title="Mute (M)">{audio.vol.muted ? '🔇' : '🔊'}</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { click(); window.dispatchEvent(new CustomEvent('bow-help')); game.setPaused(true); }} title="Help">❓</button>
            <button className="btn btn-sm" onClick={() => { click(); game.setPaused(true); }} title="Pause (Esc)">⏸</button>
          </div>
        </div>
        {game.bossNight && (
          <div className="mt-1.5 max-w-xl mx-auto panel px-3 py-1.5 pointer-events-auto">
            <div className="text-xs font-display text-purple-200 mb-1">🐦 The Magpie's Grip on the Market · expose her, debunk her lies, hold until dawn</div>
            <Bar value={game.grip} color="#b070ff" h={10} label={`${Math.round(game.grip)}%`} />
          </div>
        )}
        {game.tut.on && (
          <div className="mt-1.5 max-w-xl mx-auto panel px-3 py-2 flex items-center gap-3 anim-fadeUp pointer-events-auto" style={{ borderColor: '#9ad7ff88' }}>
            <div className="text-2xl">🎓</div>
            <div className="flex-1 text-sm leading-snug"><div className="text-[10px] uppercase tracking-widest text-sky-300">Tutorial {game.tut.step + 1}/{TUTORIAL.length}</div>{TUTORIAL[game.tut.step]}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => game.skipTutorial()}>Skip</button>
          </div>
        )}
        {!talking && (
          <div className="hidden md:block w-64 mt-1.5 pointer-events-auto">
            <div className="font-display text-[11px] uppercase tracking-widest text-amber-200/70 mb-1 pl-1">Commissions</div>
            <div className="space-y-1.5">
              {game.commissions.map(c => (
                <div key={c.id} className={cn('panel p-2', c.done && 'opacity-60')}>
                  <div className="text-xs font-bold flex justify-between"><span>{c.title}</span><span>{c.done ? '✔' : `+${c.coins}c`}</span></div>
                  <div className="text-[11px] text-white/60 leading-snug">{c.desc}</div>
                  <Bar value={c.progress} max={c.target} color={FACTIONS[c.faction].color} h={6} className="mt-1" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* event banner */}
      {game.banner && (
        <div key={game.banner.title} className="absolute left-0 right-0 top-[38%] flex justify-center anim-banner pointer-events-none px-3">
          <div className="panel px-6 py-3 text-center" style={{ borderColor: '#f2c14e', boxShadow: '0 0 40px rgba(242,193,78,.4)' }}>
            <div className="text-3xl">{game.banner.icon}</div>
            <div className="font-display text-xl text-amber-100">{game.banner.title}</div>
            <div className="text-sm text-white/70 max-w-sm">{game.banner.sub}</div>
          </div>
        </div>
      )}

      {/* talk panel */}
      {talking && (
        <div className="absolute pointer-events-auto left-2 right-2 bottom-2 top-[38%] md:right-auto md:w-[420px] md:top-28 md:bottom-3 flex" style={{ zIndex: 20 }}>
          <Talk key={game.talk!.id} game={game} />
        </div>
      )}

      {/* side panel */}
      {!talking && (
        <>
          <button className="md:hidden absolute right-2 bottom-24 btn btn-sm pointer-events-auto" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : '📜 Panels'}</button>
          {open && (
            <div className="absolute pointer-events-auto right-2 left-2 bottom-2 h-[46%] md:left-auto md:w-[350px] md:top-28 md:bottom-3 md:h-auto flex flex-col panel overflow-hidden anim-fadeIn" style={{ zIndex: 12 }}>
              <div className="flex gap-1 p-1.5 border-b border-white/10 overflow-x-auto scroll shrink-0">
                {TABS.map(([k, ic, l], i) => <button key={k} className={cn('tabbtn whitespace-nowrap', tab === k && 'on')} onClick={() => { click(); setTab(k); }} title={`${l} (${i + 1})`}>{ic} {l}</button>)}
                <button className="tabbtn ml-auto" onClick={() => setOpen(false)} title="Hide (Tab)">⟩</button>
              </div>
              <div className="p-2.5 overflow-y-auto scroll flex-1">
                {tab === 'ledger' && <LedgerTab game={game} />}
                {tab === 'cargo' && <CargoTab game={game} />}
                {tab === 'market' && <MarketTab game={game} />}
                {tab === 'factions' && <FactionsTab game={game} />}
                {tab === 'contacts' && <ContactsTab game={game} />}
              </div>
            </div>
          )}
          {!open && <button className="hidden md:block absolute right-2 top-28 btn btn-sm pointer-events-auto" onClick={() => setOpen(true)}>⟨ Panels (Tab)</button>}
        </>
      )}

      {/* prompt */}
      {game.near && !talking && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-3 pointer-events-none anim-pop">
          <div className="panel px-4 py-1.5 text-sm">
            <b className="text-amber-200">E</b> — {game.near.def.role === 'cutpurse' ? <span className="text-red-300">catch {game.near.def.name}!</span> : <>talk to <b style={{ color: FACTIONS[game.near.def.faction].color }}>{game.near.def.name}</b> <span className="text-white/50">({game.near.def.title})</span></>}
          </div>
        </div>
      )}

      {/* toasts */}
      <div className="absolute left-2 bottom-2 w-[min(380px,60vw)] space-y-1 pointer-events-none hidden sm:block" style={{ zIndex: 8, bottom: talking ? 'auto' : 8, top: talking ? 'auto' : undefined }}>
        {!talking && game.toasts.map(t => (
          <div key={t.id} className="anim-slideIn rounded-lg px-3 py-1.5 text-xs leading-snug border" style={{ opacity: Math.min(1, t.life), background: t.kind === 'bad' ? 'rgba(90,20,30,.88)' : t.kind === 'good' ? 'rgba(20,70,50,.88)' : t.kind === 'event' ? 'rgba(70,40,110,.9)' : 'rgba(20,14,44,.88)', borderColor: t.kind === 'bad' ? '#ff7a7a77' : t.kind === 'good' ? '#6fe0a877' : '#f2c14e44' }}>{t.msg}</div>
        ))}
      </div>
      {/* mobile toasts */}
      <div className="sm:hidden absolute left-2 right-2 top-[84px] space-y-1 pointer-events-none" style={{ zIndex: 8 }}>
        {game.toasts.slice(-2).map(t => <div key={t.id} className="rounded-lg px-3 py-1 text-[11px] border border-amber-300/30 bg-[#140e2cdd]">{t.msg}</div>)}
      </div>

      {coarse && !talking && (
        <div className="absolute right-3 bottom-[50%] flex flex-col gap-2 pointer-events-auto" style={{ zIndex: 14 }}>
          <button className="btn btn-gold w-14 h-14 rounded-full" onClick={() => game.interact()}>E</button>
          <button className="btn w-14 h-14 rounded-full" onClick={() => game.dash()}>💨</button>
        </div>
      )}
    </div>
  );
}

function Meter({ label, icon, value, max = 100, color, pulse }: { label: string; icon: string; value: number; max?: number; color: string; pulse?: boolean }) {
  return (
    <div className="w-[96px]" title={label}>
      <div className="text-[10px] text-white/60 leading-none mb-1">{icon} {label} <b className="text-white/90">{Math.round(value)}</b></div>
      <Bar value={value} max={max} color={color} className={pulse ? 'glow-pulse' : ''} />
    </div>
  );
}

function RumorCard({ game, r, from, how }: { game: Game; r: Rumor; from: string; how: string }) {
  const hint = game.hint(r);
  const stateCol = r.state === 'true' ? '#6fe0a8' : r.state === 'false' ? '#ff8a8a' : '#f2c14e';
  return (
    <div className="card p-2" style={{ borderColor: stateCol + '55' }}>
      <div className="flex gap-2 text-xs leading-snug"><span className="text-lg">{rumorIcon(r)}</span><span className="flex-1">{r.text}</span></div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        <span className="chip" style={{ color: stateCol }}>{r.state === 'pending' ? '⏳ unverified' : r.state === 'true' ? '✅ proven' : '❌ debunked'}</span>
        <span className="chip">{how === 'forged' ? '🪶 forged' : `via ${from}`}</span>
        <span className="chip">👥 {game.believers(r)}</span>
        {r.state === 'pending' && <span className="chip">≈ {fmt(game.rumorValue(r))}c</span>}
        {r.kind === 'market' && <span className="chip">{GOODS[r.good!].icon} {r.dir > 0 ? '+' : '−'}{Math.round(r.mag * 100)}%</span>}
        {hint && r.state === 'pending' && <span className="chip" style={{ color: hint.guess ? '#9affc0' : '#ffa0a0' }}>🔍 {hint.guess ? 'likely true' : 'likely false'} ({Math.round(hint.acc * 100)}%)</span>}
        {r.origin === 'magpie' && r.state === 'false' && <span className="chip text-purple-300">🐦 Magpie's work</span>}
      </div>
    </div>
  );
}

function LedgerTab({ game }: { game: Game }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'market' | 'scandal'>('market');
  const [good, setGood] = useState<GoodId>('spice');
  const [dir, setDir] = useState<1 | -1>(1);
  const [mag, setMag] = useState(1);
  const [fac, setFac] = useState<FactionId>('guild');
  const list = game.ledger.slice().reverse();
  const cost = game.forgeCost(kind === 'scandal' ? 1 : mag);
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-white/50">Rumors are merchandise. Sell them, plant them to bend prices, or forge your own. Resolved rumors reveal their truth, so liars get found out.</div>
      <button className="btn btn-sm w-full" onClick={() => { click(); setOpen(o => !o); }}>🪶 Forge a Rumor {open ? '▲' : '▼'}</button>
      {open && (
        <div className="card p-2 space-y-2 anim-fadeIn">
          <div className="flex gap-1">
            <button className={cn('tabbtn flex-1', kind === 'market' && 'on')} onClick={() => setKind('market')}>📈 Market</button>
            <button className={cn('tabbtn flex-1', kind === 'scandal' && 'on')} onClick={() => setKind('scandal')}>🕯️ Scandal</button>
          </div>
          {kind === 'market' ? (
            <>
              <div className="flex flex-wrap gap-1">{GOOD_IDS.map(g => <button key={g} className={cn('tabbtn', good === g && 'on')} onClick={() => setGood(g)} title={GOODS[g].name}>{GOODS[g].icon}</button>)}</div>
              <div className="flex gap-1">
                <button className={cn('tabbtn flex-1', dir === 1 && 'on')} onClick={() => setDir(1)}>▲ Shortage</button>
                <button className={cn('tabbtn flex-1', dir === -1 && 'on')} onClick={() => setDir(-1)}>▼ Glut</button>
              </div>
              <div className="flex gap-1">{['Whisper', 'Murmur', 'Roar'].map((m, i) => <button key={m} className={cn('tabbtn flex-1', mag === i && 'on')} onClick={() => setMag(i)}>{m}</button>)}</div>
              <div className="text-[11px] text-white/50">Stronger lies move prices more, but are harder to sell and sound suspicious. A forged rumor is only TRUE if reality happens to agree within ~80s.</div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-1">{FACTION_IDS.map(f => <button key={f} className={cn('tabbtn', fac === f && 'on')} onClick={() => setFac(f)}>{FACTIONS[f].icon}</button>)}</div>
              <div className="text-[11px] text-white/50">Scandals sell dear to rivals of the target and sap the target's influence over their goods. Usually false...</div>
            </>
          )}
          <button className="btn btn-gold btn-sm w-full" disabled={game.run.coins < cost || game.player.poise < 14} onClick={() => game.forge(kind === 'market' ? { kind, good, dir, mag } : { kind, faction: fac })}>Forge ({cost}c, 14 Poise)</button>
        </div>
      )}
      {list.length === 0 && <div className="text-xs text-white/40 italic">Your ledger is empty. Find a gossip and press E, then Eavesdrop.</div>}
      {list.map(l => { const r = game.rumors.get(l.rid); return r ? <RumorCard key={l.rid} game={game} r={r} from={l.from} how={l.how} /> : null; })}
    </div>
  );
}

function CargoTab({ game }: { game: Game }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm"><span>🎒 {game.cargoCount} / {game.cap} slots</span><span>≈ {fmt(game.worth - game.run.coins)}c of goods</span></div>
      <Bar value={game.cargoCount} max={game.cap} color="#e6c84e" />
      {GOOD_IDS.map(g => {
        const c = game.run.cargo[g]; const val = GOODS[g].base * game.G[g];
        return (
          <div key={g} className={cn('card p-2 flex items-center gap-2', c.qty === 0 && 'opacity-50')}>
            <span className="text-2xl">{GOODS[g].icon}</span>
            <div className="flex-1"><div className="text-xs font-bold">{GOODS[g].name}</div><div className="text-[11px] text-white/55">{c.qty > 0 ? `avg paid ${Math.round(c.cost)}c` : 'none'} · market ≈ {Math.round(val)}c</div></div>
            <div className="font-display text-lg text-amber-200">×{c.qty}</div>
          </div>
        );
      })}
      <div className="text-[11px] text-white/45">Trade at stalls (stand near a vendor, press E). Carrying Dream-Smoke near Wardens builds Heat.</div>
    </div>
  );
}

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <svg width="64" height="20" />;
  const mn = Math.min(...data, 0.8), mx = Math.max(...data, 1.2);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 64},${19 - ((v - mn) / (mx - mn)) * 18}`).join(' ');
  return <svg width="64" height="20"><polyline fill="none" stroke={color} strokeWidth="1.6" points={pts} /></svg>;
}

function MarketTab({ game }: { game: Game }) {
  const vendors = game.vendors; const live = game.hasPerk('g_board');
  const tips: { g: GoodId; buy: string; sell: string; pct: number; a: number; b: number }[] = [];
  GOOD_IDS.forEach(g => {
    const known = vendors.map(v => ({ id: v.id, name: v.def.name.split(' ')[0], s: game.seen[v.id + ':' + g] })).filter(x => !!x.s);
    if (known.length < 2) return;
    const A = known.reduce((a, b) => (b.s.ask < a.s.ask ? b : a));
    const others = known.filter(x => x.id !== A.id);
    const B = others.reduce((a, b) => (b.s.bid > a.s.bid ? b : a));
    if (B.s.bid > A.s.ask * 1.06) tips.push({ g, buy: A.name, sell: B.name, a: A.s.ask, b: B.s.bid, pct: (B.s.bid - A.s.ask) / A.s.ask });
  });
  tips.sort((x, y) => y.pct - x.pct);
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-white/50">{live ? 'Ledger Eyes: prices are live.' : 'Prices you have seen with your own eyes (walk near a stall to refresh). Fade = stale.'}</div>
      <div className="grid grid-cols-3 gap-1.5">
        {GOOD_IDS.map(g => {
          const h = game.hist[g] || []; const prev = h.length > 5 ? h[h.length - 6] : h[0] ?? 1; const now = game.G[g];
          const up = now > prev * 1.01, dn = now < prev * 0.99;
          return (
            <div key={g} className="card p-1.5 text-center">
              <div className="text-xs">{GOODS[g].icon} <b>{Math.round(GOODS[g].base * now)}c</b></div>
              <div className="flex justify-center"><Spark data={h} color={up ? '#ffb347' : dn ? '#6ec6ff' : '#9a93b5'} /></div>
              <div className="text-[10px]" style={{ color: up ? '#ffb347' : dn ? '#6ec6ff' : '#9a93b5' }}>{up ? '▲ rising' : dn ? '▼ falling' : '• steady'}</div>
            </div>
          );
        })}
      </div>
      <div className="font-display text-[11px] uppercase tracking-widest text-amber-200/70">Arbitrage hints</div>
      {tips.length === 0 && <div className="text-xs text-white/40 italic">No clear gap between stalls yet. Rumors create them.</div>}
      {tips.slice(0, 3).map(t => <div key={t.g} className="card p-2 text-xs">{GOODS[t.g].icon} Buy at <b>{t.buy}</b> ({t.a}c) → sell at <b>{t.sell}</b> ({t.b}c) <b className="text-emerald-300">+{Math.round(t.pct * 100)}%</b></div>)}
      <div className="font-display text-[11px] uppercase tracking-widest text-amber-200/70">Price board (ask / bid)</div>
      <div className="overflow-x-auto scroll">
        <table className="text-[11px] w-full border-separate" style={{ borderSpacing: 2 }}>
          <thead><tr><th></th>{vendors.map(v => <th key={v.id} title={v.def.name} className="text-base font-normal">{GOODS[v.def.good!].icon}</th>)}</tr></thead>
          <tbody>
            {GOOD_IDS.map(g => (
              <tr key={g}>
                <td className="text-base">{GOODS[g].icon}</td>
                {vendors.map(v => {
                  const s = game.seen[v.id + ':' + g];
                  if (!s) return <td key={v.id} className="text-center text-white/25 card">—</td>;
                  const ratio = s.ask / (GOODS[g].base * (v.def.good === g ? 0.87 : 1));
                  const stale = !live && game.t - s.t > 25;
                  return <td key={v.id} className="text-center card px-1 py-0.5" style={{ color: ratio > 1.1 ? '#ffb347' : ratio < 0.92 ? '#6ec6ff' : '#e5dcf5', opacity: stale ? 0.5 : 1 }}>{s.ask}/{s.bid}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-[10px] text-white/40">Orange: dearer than usual. Blue: cheaper. Columns follow each stall's specialty.</div>
    </div>
  );
}

function FactionsTab({ game }: { game: Game }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-white/50">Earn favor by selling rumors to a faction's folk, finishing commissions and giving gifts. Every {12} favor = 1 point to spend on perks. Influence sways the price of their goods.</div>
      {FACTION_IDS.map(f => (
        <div key={f} className="card px-2 py-1.5 text-xs flex items-center justify-between">
          <span style={{ color: FACTIONS[f].color }}>{FACTIONS[f].icon} {FACTIONS[f].name}</span>
          <span>influence <b>{Math.round(game.infl[f])}</b> <span className="text-white/45">({game.infl[f] >= 50 ? '+' : ''}{Math.round(((game.infl[f] - 50) / 50) * 20)}% goods)</span></span>
        </div>
      ))}
      <FavorTree game={game} compact />
    </div>
  );
}

function ContactsTab({ game }: { game: Game }) {
  const order = ['vendor', 'informant', 'noble', 'rival', 'warden', 'patron'];
  const list = game.npcs.filter(n => n.def.role !== 'cutpurse').sort((a, b) => order.indexOf(a.def.role) - order.indexOf(b.def.role));
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] text-white/50">Everyone follows a schedule. Talk to someone once to learn their route for the night. Click Walk to head to them.</div>
      {list.map(n => {
        const sched = game.schedText(n); const fac = FACTIONS[n.def.faction];
        const nb = Object.keys(n.beliefs).filter(k => game.rumors.get(+k)?.state === 'pending' && n.beliefs[+k] >= 0.3).length;
        return (
          <div key={n.id} className="card p-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: fac.color }} />
              <div className="flex-1 min-w-0"><div className="text-xs font-bold truncate">{n.def.name} <span className="font-normal text-white/50">· {n.def.title}</span></div>
                <div className="text-[11px] text-white/60">{n.visible ? (n.def.role === 'vendor' && !n.open ? 'away from stall' : `near ${n.moving ? 'on the way to ' : ''}${game.locName(n)}`) : 'out of sight'}{nb > 0 && ` · 💭${nb}`}</div></div>
              <button className="btn btn-sm" disabled={!n.visible} onClick={() => { click(); game.player.target = { x: n.x, y: n.y, npcId: n.id }; }}>Walk</button>
            </div>
            {sched && sched.length > 0 && <div className="text-[10px] text-white/45 mt-1">Next: {sched.map(s => `${s.t} ${s.loc}`).join(' → ')}</div>}
          </div>
        );
      })}
    </div>
  );
}
