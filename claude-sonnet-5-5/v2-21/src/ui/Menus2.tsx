import {
  DISTRICTS, FACTIONS, FACTION_IDS, GADGETS, REP_TIERS, UPGRADES, deriveStats, repLabel, repTier, upgradeCost,
} from '../game/data';
import type { Contract, Save, RunSummary } from '../game/data';
import type { RunResult } from '../game/engine';
import { audio } from '../game/audio';
import { Bar, Btn, Panel, Title } from './common';

// ===== Safehouse =====
export function Shop({ save, onSave, onBack }: { save: Save; onSave: (s: Save) => void; onBack: () => void }) {
  const stats = deriveStats(save);
  const buyUp = (id: string) => {
    const u = UPGRADES.find((x) => x.id === id)!; const lvl = save.upgrades[id] || 0; const cost = upgradeCost(save, u);
    if (lvl >= u.max || save.cash < cost) { audio.sfx('deny'); return; }
    audio.sfx('buy'); onSave({ ...save, cash: save.cash - cost, upgrades: { ...save.upgrades, [id]: lvl + 1 } });
  };
  const buyG = (id: 'emp' | 'smoke' | 'key', cost: number) => {
    if (save.cash < cost || save.gadgets[id] >= stats.cap) { audio.sfx('deny'); return; }
    audio.sfx('buy'); onSave({ ...save, cash: save.cash - cost, gadgets: { ...save.gadgets, [id]: save.gadgets[id] + 1 } });
  };
  const bribe = 150 + Math.round(save.notoriety * 3);
  const doBribe = () => { if (save.notoriety <= 0 || save.cash < bribe) { audio.sfx('deny'); return; } audio.sfx('buy'); onSave({ ...save, cash: save.cash - bribe, notoriety: Math.max(0, save.notoriety - 15) }); };
  const doCool = () => { if (save.cash < 120 || save.heat.every((h) => h <= 0)) { audio.sfx('deny'); return; } audio.sfx('buy'); onSave({ ...save, cash: save.cash - 120, heat: save.heat.map((h) => Math.max(0, h - 30)) }); };
  return (
    <div className="h-full w-full overflow-y-auto scroll-thin bg-[radial-gradient(ellipse_at_top,#2a2208,#06050d_70%)]">
      <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-3">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div><Title color="#ffe04a" size="text-xl">Safehouse Workshop</Title><div className="text-xs text-indigo-300/70">Upgrades persist across the whole campaign.</div></div>
          <div className="flex items-center gap-4"><div className="font-display text-yellow-300 text-xl">¤ {save.cash.toLocaleString()}</div><Btn color="#c9c4ff" onClick={onBack}>← Back to map</Btn></div>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {UPGRADES.map((u) => {
            const lvl = save.upgrades[u.id] || 0, maxed = lvl >= u.max, cost = upgradeCost(save, u);
            const locked = !!u.excl && repTier(save.rep[u.excl]) < 3;
            const fc = u.excl ? FACTIONS[u.excl].color : '#ffe04a';
            const disc = !u.excl && FACTION_IDS.some((f) => FACTIONS[f].cat === u.cat && repTier(save.rep[f]) >= 2);
            return (
              <Panel key={u.id} className="p-3 flex gap-3 items-center" style={{ opacity: locked ? 0.6 : 1, borderColor: u.excl ? fc + '66' : undefined }}>
                <div className="text-3xl w-10 text-center">{locked ? '🔒' : u.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between"><span className="font-display font-bold text-sm" style={{ color: u.excl ? fc : '#fff' }}>{u.name}</span>
                    <span className="text-xs text-indigo-300">{u.max > 1 ? `Lv ${lvl}/${u.max}` : lvl ? 'Owned' : ''}</span></div>
                  <div className="text-[11px] text-indigo-100/70 leading-tight">{u.desc}</div>
                  {u.max > 1 && <div className="flex gap-1 mt-1">{Array.from({ length: u.max }, (_, i) => <div key={i} className="h-1.5 flex-1 rounded" style={{ background: i < lvl ? fc : 'rgba(255,255,255,0.12)' }} />)}</div>}
                </div>
                <Btn color={fc} disabled={maxed || locked || save.cash < cost} onClick={() => buyUp(u.id)} title={disc ? 'Faction discount applied' : ''}>
                  {maxed ? 'Max' : locked ? 'Locked' : `¤${cost}${disc ? '*' : ''}`}</Btn>
              </Panel>
            );
          })}
        </div>
        <Title size="text-base" color="#42a5ff">Gadgets (carry cap {stats.cap})</Title>
        <div className="grid md:grid-cols-3 gap-2">
          {GADGETS.map((g) => (
            <Panel key={g.id} className="p-3 space-y-1">
              <div className="flex justify-between"><span className="font-display font-bold text-sm">{g.icon} {g.name}</span><span className="text-xs text-yellow-300">{save.gadgets[g.id]}/{stats.cap}</span></div>
              <div className="text-[11px] text-indigo-100/70 min-h-[30px]">{g.desc} <span className="text-cyan-300">[{g.key}]</span></div>
              <Btn color="#42a5ff" disabled={save.cash < g.cost || save.gadgets[g.id] >= stats.cap} onClick={() => buyG(g.id, g.cost)}>Buy ¤{g.cost}</Btn>
            </Panel>
          ))}
        </div>
        <Title size="text-base" color="#ff6b8b">Fixer Services</Title>
        <div className="grid md:grid-cols-2 gap-2 pb-6">
          <Panel className="p-3 flex justify-between items-center gap-2"><div><div className="font-bold text-sm">🕶 Pay off Sentinel officers</div><div className="text-[11px] text-indigo-100/70">−15% notoriety (now {Math.round(save.notoriety)}%)</div></div>
            <Btn color="#ff6b8b" disabled={save.notoriety <= 0 || save.cash < bribe} onClick={doBribe}>¤{bribe}</Btn></Panel>
          <Panel className="p-3 flex justify-between items-center gap-2"><div><div className="font-bold text-sm">🧊 Cool every district</div><div className="text-[11px] text-indigo-100/70">−30 district heat everywhere (fewer guards, lower starting heat)</div></div>
            <Btn color="#ff6b8b" disabled={save.cash < 120 || save.heat.every((h) => h <= 0)} onClick={doCool}>¤120</Btn></Panel>
        </div>
      </div>
    </div>
  );
}

// ===== Factions =====
export function Factions({ save, onBack }: { save: Save; onBack: () => void }) {
  return (
    <div className="h-full w-full overflow-y-auto scroll-thin bg-[radial-gradient(ellipse_at_top,#0c2a1a,#06050d_70%)]">
      <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-3">
        <div className="flex justify-between items-center"><Title color="#7dff6b" size="text-xl">Faction Standing</Title><Btn color="#c9c4ff" onClick={onBack}>← Back to map</Btn></div>
        <div className="grid md:grid-cols-3 gap-3">
          {FACTION_IDS.map((fid) => {
            const f = FACTIONS[fid], rep = save.rep[fid], tier = repTier(rep);
            return (
              <Panel key={fid} className="p-4 space-y-2" style={{ borderColor: f.color + '77' }}>
                <div className="font-display font-black text-lg" style={{ color: f.color }}>{f.icon} {f.name}</div>
                <div className="text-xs text-indigo-100/70">{f.blurb}</div>
                <div className="flex justify-between text-xs"><span className="font-display" style={{ color: rep < -24 ? '#ff5577' : f.color }}>{repLabel(rep)}</span><span>{Math.round(rep)}</span></div>
                <div className="relative"><Bar v={(rep + 100) / 200} color={rep < 0 ? '#ff3355' : f.color} h={10} />
                  {REP_TIERS.map((t) => <div key={t} className="absolute top-0 h-[10px] w-px bg-white/50" style={{ left: `${((t + 100) / 200) * 100}%` }} />)}
                  <div className="absolute top-0 h-[10px] w-px bg-white/50" style={{ left: '50%' }} /></div>
                <div className="space-y-1 text-xs">
                  {f.perks.map((p, i) => <div key={i} style={{ color: tier > i ? '#42ffa8' : '#8a85bd' }}>{tier > i ? '✔' : '🔒'} <b>{REP_TIERS[i]}+</b> {p}</div>)}
                </div>
                <div className="text-[11px] text-red-300/90 border-t border-white/10 pt-2">Rival: <b>{FACTIONS[f.rival].name}</b>. Working for {f.name} lowers their standing.
                  <br />At −25: hunters patrol their turf. At −60: Kill Order — contracts refused, double hunters.</div>
              </Panel>
            );
          })}
        </div>
        <Panel className="p-4 grid md:grid-cols-2 gap-4">
          <div>
            <div className="font-display font-bold text-red-300">Sentinel Notoriety — {Math.round(save.notoriety)}%</div>
            <Bar v={save.notoriety / 100} color={save.notoriety >= 70 ? '#ff3355' : '#ffb02e'} h={12} />
            <ul className="text-xs text-indigo-100/80 mt-2 space-y-0.5 list-disc pl-4">
              <li>≥ 50%: every run starts with +1★ heat</li><li>≥ 70%: the pack runs 8% faster</li><li>At 100%: the Sentinels raid your safehouse — campaign over.</li>
              <li>Heavy-heat runs raise it; clean runs and bribes lower it.</li>
            </ul>
          </div>
          <div>
            <div className="font-display font-bold text-orange-300 mb-1">District Heat</div>
            {DISTRICTS.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs mb-1"><span className="w-32 truncate">{d.name}</span><div className="flex-1"><Bar v={save.heat[d.id] / 100} color="#ff5a1f" h={6} /></div><span className="w-8 text-right">{Math.round(save.heat[d.id])}</span></div>
            ))}
            <div className="text-[11px] text-indigo-300/70">Hot districts spawn more guards and start you with heat. They cool as you work elsewhere.</div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ===== Results =====
const GCOL: Record<string, string> = { S: '#ffe04a', A: '#42ffa8', B: '#28e0ff', C: '#c9c4ff', D: '#ff9a7a', '-': '#ff3355' };
export function Results({ result: r, summary: s, contract: c, onContinue, onRetry }: {
  result: RunResult; summary: RunSummary; contract: Contract; onContinue: () => void; onRetry: () => void;
}) {
  const ok = r.outcome === 'delivered';
  const title = ok ? 'DELIVERED' : r.outcome === 'busted' ? 'BUSTED' : r.outcome === 'destroyed' ? 'CARGO LOST' : 'ABANDONED';
  const col = ok ? '#42ffa8' : '#ff3355';
  const cell = (k: string, v: string) => <div className="rounded bg-black/30 border border-white/10 p-2"><div className="text-[10px] font-display uppercase text-indigo-300">{k}</div><div className="font-display text-sm">{v}</div></div>;
  return (
    <div className="h-full w-full overflow-y-auto scroll-thin bg-[radial-gradient(ellipse_at_top,#1b0f3a,#06050d_70%)]">
      <div className="max-w-3xl mx-auto p-3 sm:p-6 space-y-4">
        <div className="text-center anim-pop">
          <div className="font-display font-black text-4xl sm:text-5xl neon-text" style={{ color: col }}>{r.tutorial ? (ok ? 'TRAINING COMPLETE' : 'TRAINING ENDED') : title}</div>
          {!r.tutorial && <div className="text-sm text-indigo-200/80 mt-1">{c.title} — {r.cause || (ok ? 'Package handed over.' : '')}</div>}
        </div>
        {ok && !r.tutorial && (
          <div className="text-center"><span className="font-display text-xs text-indigo-300 mr-2">GRADE</span>
            <span className="font-display font-black text-7xl neon-text anim-pop" style={{ color: GCOL[r.grade] }}>{r.grade}</span></div>
        )}
        <Panel className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {cell('Time', `${r.time.toFixed(1)}s / par ${r.par.toFixed(0)}s`)}{cell('Score', Math.round(r.score).toLocaleString())}
          {cell('Integrity', `${Math.round(r.integrity)}%`)}{cell('Damage taken', Math.round(r.damage).toString())}
          {cell('Chips', `${r.chips} (¤${r.chipCash})`)}{cell('Hacks', `${r.hacksOk} ok / ${r.hacksFail} fail`)}
          {cell('Stunts', `${r.stunts} · best chain ${r.bestCombo}`)}{cell('Top speed', `${Math.round(r.topSpeed * 0.2)} km/h`)}
          {cell('Distance', `${Math.round(r.distance / 10)} m`)}{cell('Peak heat', `${r.heatPeak.toFixed(1)}★`)}
          {cell('Takedowns', String(r.takedowns))}{cell('Falls', String(r.falls))}
        </Panel>
        {!r.tutorial && (
          <Panel className="p-4 space-y-2">
            <div className="font-display font-bold text-yellow-300 text-lg">{s.payout - s.fine >= 0 ? '+' : ''}¤{s.payout - s.fine}</div>
            {s.lines.map((l, i) => <div key={i} className="text-sm text-indigo-100/85">• {l}</div>)}
            <div className="flex flex-wrap gap-3 text-xs pt-1">
              {FACTION_IDS.filter((f) => s.repDelta[f]).map((f) => <span key={f} style={{ color: (s.repDelta[f] || 0) > 0 ? FACTIONS[f].color : '#ff6b7a' }}>{FACTIONS[f].icon} {FACTIONS[f].name} {(s.repDelta[f] || 0) > 0 ? '+' : ''}{s.repDelta[f]}</span>)}
              <span className={s.notoDelta > 0 ? 'text-red-300' : 'text-green-300'}>Notoriety {s.notoDelta > 0 ? '+' : ''}{s.notoDelta}%</span>
              {s.heatDelta > 0 && <span className="text-orange-300">District heat +{s.heatDelta}</span>}
            </div>
            {s.unlocked.map((u) => <div key={u} className="text-green-300 font-display text-sm anim-pop">🔓 District unlocked: {u}</div>)}
          </Panel>
        )}
        {r.tutorial && <Panel className="p-4 text-sm">{s.lines.map((l, i) => <div key={i}>• {l}</div>)}<div className="mt-2 text-indigo-300">Head to the city map and pick your first contract. Deliver 2 packages per district to unlock the next.</div></Panel>}
        <div className="flex justify-center gap-3 pb-6 flex-wrap">
          {!ok && !r.tutorial && r.outcome !== 'abandoned' && !s.burned && <Btn color="#ffb02e" onClick={onRetry}>↻ Retry contract</Btn>}
          <Btn solid color={s.burned ? '#ff3355' : s.victory ? '#ffe04a' : '#28e0ff'} onClick={onContinue}>{s.burned ? 'Face the raid…' : s.victory ? 'Claim victory ▶' : 'Continue ▶'}</Btn>
        </div>
      </div>
    </div>
  );
}

function StatsList({ save }: { save: Save }) {
  const st = save.stats;
  const rows: [string, string][] = [['Days survived', String(save.day)], ['Deliveries', String(st.delivered)], ['Failed jobs', `${st.failed} (${st.busted} busted)`], ['Credits earned', `¤${st.earned.toLocaleString()}`],
    ['Chips', String(st.chips)], ['Hacks cracked', String(st.hacks)], ['Stunts', String(st.stunts)], ['Distance', `${(st.distance / 1000).toFixed(1)} km`], ['Top speed', `${Math.round(st.topSpeed * 0.2)} km/h`], ['Best score', st.bestScore.toLocaleString()]];
  return <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between border-b border-white/10 py-0.5"><span className="text-indigo-300">{k}</span><b>{v}</b></div>)}</div>;
}

export function GameOver({ save, onNew, onTitle }: { save: Save; onNew: () => void; onTitle: () => void }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,#3a0a14,#06050d_75%)] overflow-y-auto">
      <Panel className="max-w-xl w-full p-6 space-y-4 anim-pop" style={{ borderColor: '#ff3355' }}>
        <div className="text-center"><div className="font-display font-black text-4xl text-red-500 neon-text">GAME OVER</div>
          <div className="text-indigo-200 mt-1">Notoriety hit 100%. Sentinel strike teams burst into your safehouse and the grid goes dark for you. Your courier career is over.</div></div>
        <StatsList save={save} />
        <div className="flex justify-center gap-3"><Btn solid color="#ff3355" onClick={onNew}>New campaign</Btn><Btn color="#c9c4ff" onClick={onTitle}>Title screen</Btn></div>
      </Panel>
    </div>
  );
}

export function Victory({ save, onFree, onNew, onTitle }: { save: Save; onFree: () => void; onNew: () => void; onTitle: () => void }) {
  return (
    <div className="h-full w-full flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_center,#2b2a08,#06050d_75%)] overflow-y-auto">
      <Panel className="max-w-xl w-full p-6 space-y-4 anim-pop" style={{ borderColor: '#ffe04a' }}>
        <div className="text-center"><div className="font-display font-black text-4xl text-yellow-300 neon-text">GRID LIBERATED</div>
          <div className="text-indigo-100 mt-2">The Warden's override falls. Across the city, cameras blink off and the Sentinels stand down. The couriers own the night — and you delivered the key.</div></div>
        <StatsList save={save} />
        <div className="flex justify-center gap-3 flex-wrap"><Btn solid color="#ffe04a" onClick={onFree}>Continue free-play</Btn><Btn color="#ff2fd6" onClick={onNew}>New campaign</Btn><Btn color="#c9c4ff" onClick={onTitle}>Title</Btn></div>
      </Panel>
    </div>
  );
}
