import { useMemo, useState } from 'react';
import { Btn, HeatMeter, Panel, Stars, Stat, Pips } from './ui';
import { audio } from '../game/audio';
import { CREW, CREW_KINDS, FENCES, GADGETS, GADGET_IDS, LOOT, LOOT_CATS, UPGRADES, UPGRADE_IDS, VENUES, fmt } from '../game/data';
import type { Contract, Skill } from '../game/data';
import {
  bailCost, bribe, bribeCost, buyGadget, buyUpgrade, deadline, fenceCut, gadgetCost, hire, hireCost, layLow, lootTotal, payBail, quote, readyCrew, sellLoot, train, trainCost,
} from '../game/meta';
import type { Campaign, Res } from '../game/meta';

type Tab = 'contracts' | 'crew' | 'fence' | 'syndicate' | 'gear';
const SKILLS: Skill[] = ['lock', 'tech', 'crack', 'force', 'grab'];

export function Hub({ camp, act, onPlan, onHelp, onSettings, onTitle }: {
  camp: Campaign; act: (fn: (c: Campaign) => Res | void, sfx?: string) => void; onPlan: (c: Contract) => void; onHelp: () => void; onSettings: () => void; onTitle: () => void;
}) {
  const [tab, setTab] = useState<Tab>('contracts');
  const ready = readyCrew(camp).length;
  const left = deadline(camp) - camp.day;
  const tabs: [Tab, string][] = [['contracts', '📋 Contracts'], ['crew', '🕴 Crew'], ['fence', '💰 Fence'], ['syndicate', '🏚 Syndicate'], ['gear', '🎒 Gear']];
  return (
    <div className="h-full flex flex-col grid-bg">
      <div className="panel m-2 p-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div><div className="noir text-xl text-white leading-none">DAY {camp.day}</div><div className="text-[11px]" style={{ color: camp.won ? '#5cf0a8' : left <= 5 ? '#ff4d5e' : '#ffb347' }}>{camp.won || camp.freePlay ? 'Free play' : `${Math.max(0, left)} days until the vault closes`}</div></div>
        <div><div className="text-[10px] uppercase tracking-widest opacity-60">Cash</div><div className="text-lg font-bold" style={{ color: camp.cash < 0 ? '#ff4d5e' : '#5cf0a8' }}>{fmt(camp.cash)}</div></div>
        <div><div className="text-[10px] uppercase tracking-widest opacity-60">Stash</div><div className="text-lg font-bold text-[#ffd35c]">{fmt(lootTotal(camp.stash))}</div></div>
        <div><div className="text-[10px] uppercase tracking-widest opacity-60">Notoriety</div><div className="text-lg font-bold text-[#6ee7ff]">{camp.rep}</div></div>
        <div className="min-w-[170px] flex-1 max-w-xs"><HeatMeter heat={camp.heat} compact /></div>
        <div className="min-w-[150px]"><div className="text-[10px] uppercase tracking-widest opacity-60 mb-1">Road to Meridian {Math.min(6, camp.jobsDone)}/6</div><Pips n={Math.min(6, camp.jobsDone)} max={6} color="#ffd35c" /></div>
        <div className="ml-auto flex gap-2"><Btn sm onClick={onHelp}>? Help</Btn><Btn sm onClick={onSettings}>⚙</Btn><Btn sm variant="ghost" onClick={onTitle}>⏏ Menu</Btn></div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 px-2 pb-2">
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex gap-2 mb-2 flex-wrap">{tabs.map(([k, n]) => <Btn key={k} on={tab === k} onClick={() => setTab(k)}>{n}</Btn>)}</div>
          <div className="flex-1 min-h-0 overflow-auto scroll pr-1">
            {tab === 'contracts' && <Contracts camp={camp} ready={ready} onPlan={onPlan} />}
            {tab === 'crew' && <CrewTab camp={camp} act={act} />}
            {tab === 'fence' && <FenceTab camp={camp} act={act} />}
            {tab === 'syndicate' && <SyndTab camp={camp} act={act} />}
            {tab === 'gear' && <GearTab camp={camp} act={act} />}
          </div>
        </div>
        <div className="lg:w-72 flex flex-col gap-2 lg:overflow-auto scroll">
          <Panel title="Time & Heat">
            <div className="flex flex-col gap-2">
              <Btn onClick={() => act((c) => { const m = layLow(c); return { ok: true, msg: m[0] ?? 'A quiet day passes.' }; }, 'day')}>🌙 Lay Low (-9 heat, 1 day)</Btn>
              <Btn onClick={() => act((c) => bribe(c))} disabled={camp.bribedDay === camp.day || camp.heat < 5}>💼 Bribe Commissioner ({fmt(bribeCost(camp))}) -25 heat</Btn>
              <div className="text-[11px] opacity-60">Crew upkeep is {fmt(40 * camp.crew.length)} per day. Heat cools by about {(2 + 1.5 * camp.upgrades.safehouse).toFixed(1)}/day on its own.</div>
            </div>
          </Panel>
          <Panel title="Black Market News"><div className="text-sm text-[#ffd35c]">{camp.market.news}</div></Panel>
          <Panel title="Syndicate Log"><div className="text-xs space-y-1 max-h-48 overflow-auto scroll">{camp.news.map((n, i) => <div key={i} className="opacity-80">• {n}</div>)}</div></Panel>
        </div>
      </div>
    </div>
  );
}

function Contracts({ camp, ready, onPlan }: { camp: Campaign; ready: number; onPlan: (c: Contract) => void }) {
  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
      {camp.contracts.map((ct) => {
        const V = VENUES[ct.venue];
        return (
          <Panel key={ct.id} className={ct.final ? 'ring-2 ring-[#ffd35c]' : ''}>
            <div className="flex items-start gap-3">
              <div className="text-4xl">{V.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="noir text-lg text-white leading-tight">{V.name}</div>
                <div className="text-xs opacity-70">Client: {ct.client}</div>
                <div className="mt-1 flex items-center gap-2 text-xs"><Stars n={ct.tier} max={5} />{ct.tutorial && <span className="tag" style={{ color: '#5cf0a8' }}>Training</span>}{ct.final && <span className="tag blink" style={{ color: '#ffd35c' }}>Capstone</span>}</div>
              </div>
            </div>
            <p className="text-xs opacity-80 mt-2">{V.blurb}</p>
            <div className="text-xs mt-2">Target: <b style={{ color: '#ffd35c' }}>★ {ct.targetName}</b></div>
            <div className="text-xs mt-1 flex gap-2 flex-wrap opacity-90">
              {V.cams[1] > 0 && <span title="Cameras">📷</span>}{V.lasers[1] > 0 && <span title="Laser grids">⚡</span>}{V.dogs > 0 && <span title="Guard dogs">🐕</span>}{V.heavy > 0 && <span title="Heavy guards">🛡</span>}{V.keycards > 0 && <span title="Keycard doors">💳</span>}{V.vault && <span title="Vault">🏦</span>}
              <span>Loot: {V.loot.map((l) => LOOT[l].icon).join('')}</span>
            </div>
            <div className="flex items-center justify-between mt-3">
              <div><div className="text-lg font-bold text-[#5cf0a8]">{fmt(ct.fee)}</div><div className="text-[10px] opacity-60">{ct.tutorial || ct.final ? 'Always open' : `Expires day ${ct.expires}`}</div></div>
              <Btn variant="primary" disabled={ready === 0} onClick={() => onPlan(ct)}>{ready === 0 ? 'No crew' : 'Plan Job ▶'}</Btn>
            </div>
          </Panel>
        );
      })}
      {camp.contracts.length === 0 && <Panel>No contracts today. Lay low for a day.</Panel>}
    </div>
  );
}

function CrewTab({ camp, act }: { camp: Campaign; act: (fn: (c: Campaign) => Res | void, sfx?: string) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {camp.crew.map((m) => {
          const d = CREW[m.kind];
          return (
            <Panel key={m.id} className={m.status === 'custody' ? 'opacity-80' : ''}>
              <div className="flex items-center gap-3"><div className="text-3xl w-12 h-12 flex items-center justify-center rounded-full" style={{ background: d.color + '33', border: `2px solid ${d.color}` }}>{d.icon}</div>
                <div className="flex-1"><div className="text-white font-semibold">{m.name} <span className="text-xs opacity-60">Lv{m.level}</span></div><div className="text-xs opacity-70">{d.name} · {d.title}</div></div>
                {m.status === 'custody' ? <span className="tag" style={{ color: '#ff4d5e' }}>Custody {m.custodyDays}d</span> : <span className="tag" style={{ color: '#5cf0a8' }}>Ready</span>}
              </div>
              <div className="grid grid-cols-5 gap-1 mt-3 text-[10px] text-center">
                {SKILLS.map((k) => (<div key={k}><div className="h-1.5 rounded bg-black/40 overflow-hidden"><div style={{ width: `${Math.min(100, (d.skills[k] * (1 + 0.25 * (m.level - 1)) / 2.2) * 100)}%`, background: d.color, height: '100%' }} /></div><div className="opacity-60 mt-0.5">{k}</div></div>))}
              </div>
              <div className="text-[11px] opacity-70 mt-2">{d.perk}</div>
              <div className="text-[11px] mt-1">HP {d.hp + (m.level >= 3 ? 1 : 0)} · Carry {d.cap} · Jobs {m.jobs}</div>
              <div className="flex gap-2 mt-2">
                {m.status === 'custody' ? <Btn sm variant="danger" onClick={() => act((c) => payBail(c, m.id), 'buy')} disabled={camp.cash < bailCost(camp, m)}>Pay bail {fmt(bailCost(camp, m))}</Btn>
                  : <Btn sm onClick={() => act((c) => train(c, m.id), 'buy')} disabled={m.level >= 3 || camp.cash < trainCost(m)}>{m.level >= 3 ? 'Maxed' : `Train → Lv${m.level + 1} ${fmt(trainCost(m))}`}</Btn>}
              </div>
            </Panel>
          );
        })}
      </div>
      <Panel title={`Hire Specialists (${camp.crew.length}/8)`}>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {CREW_KINDS.map((k) => {
            const d = CREW[k];
            return (
              <div key={k} className="flex gap-3 items-center p-2 rounded border" style={{ borderColor: 'var(--line)' }}>
                <div className="text-2xl">{d.icon}</div><div className="flex-1 text-xs"><div className="text-white font-semibold">{d.name}</div><div className="opacity-70">{d.blurb}</div></div>
                <Btn sm onClick={() => act((c) => hire(c, k), 'buy')} disabled={camp.cash < hireCost(camp, k) || camp.crew.length >= 8}>{fmt(hireCost(camp, k))}</Btn>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function FenceTab({ camp, act }: { camp: Campaign; act: (fn: (c: Campaign) => Res | void, sfx?: string) => void }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const stash = camp.stash; const chosen = stash.filter((l) => sel.has(l.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const totals = useMemo(() => FENCES.map((f) => ({ f, total: chosen.reduce((a, l) => a + quote(camp, f, l), 0) })), [camp, chosen]);
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <div className="space-y-3">
        <Panel title="Market Prices (today)">
          <div className="space-y-1.5">
            {LOOT_CATS.map((k) => {
              const m = camp.market.mul[k]; const sat = camp.market.sat[k];
              return (
                <div key={k} className="flex items-center gap-2 text-xs"><span className="w-24">{LOOT[k].icon} {LOOT[k].name}</span>
                  <div className="flex-1 h-2 bg-black/40 rounded overflow-hidden"><div style={{ width: `${(m / 1.9) * 100}%`, background: m >= 1.1 ? '#5cf0a8' : m < 0.9 ? '#ff4d5e' : '#ffd35c', height: '100%' }} /></div>
                  <span className="w-12 text-right font-semibold">{Math.round(m * 100)}%</span>{sat > 0.01 && <span className="text-[#ff9a4d]" title="Saturated by your recent sales">-{Math.round(sat * 100)}%</span>}
                </div>
              );
            })}
          </div>
        </Panel>
        {FENCES.map((f) => (
          <Panel key={f.id}>
            <div className="flex items-center gap-3"><div className="text-3xl">{f.icon}</div><div className="flex-1"><div className="text-white font-semibold">{f.name}</div><div className="text-xs opacity-70">{f.blurb}</div>
              <div className="text-[11px] mt-1">Cut: <b style={{ color: '#ffb347' }}>{Math.round(fenceCut(camp, f) * 100)}%</b> · Trust: {fmt(camp.market.sold[f.id] ?? 0)} sold {f.heatProof && <span style={{ color: '#5cf0a8' }}>· ignores heat</span>}</div></div></div>
          </Panel>
        ))}
      </div>
      <Panel title={`Stash (${stash.length} items · ${fmt(lootTotal(stash))})`} right={<div className="flex gap-1"><Btn sm onClick={() => setSel(new Set(stash.map((l) => l.id)))}>All</Btn><Btn sm onClick={() => setSel(new Set())}>None</Btn></div>}>
        {stash.length === 0 ? <div className="text-sm opacity-70 py-6 text-center">Nothing stashed. Steal something shiny.</div> : (
          <>
            <div className="space-y-1 max-h-[44vh] overflow-auto scroll mb-3">
              {stash.map((l) => {
                const hot = (l.hotUntil ?? 0) > camp.day;
                return (
                  <label key={l.id} className={`flex items-center gap-2 text-sm p-1.5 rounded cursor-pointer ${sel.has(l.id) ? 'bg-[#1f5aa8]/40' : 'hover:bg-white/5'}`}>
                    <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} /><span>{LOOT[l.cat].icon}</span><span className="flex-1 truncate">{l.name}{l.primary && ' ★'}</span>
                    {hot && <span className="tag" style={{ color: '#ff9a4d' }} title="Hot loot sells at -30% until day {l.hotUntil}">hot</span>}<span className="text-[#ffd35c]">{fmt(l.value)}</span>
                  </label>
                );
              })}
            </div>
            <div className="space-y-2">
              {totals.map(({ f, total }) => (
                <Btn key={f.id} className="w-full" disabled={chosen.length === 0} onClick={() => { act((c) => sellLoot(c, f.id, chosen.map((l) => l.id)), 'sell'); setSel(new Set()); }}>
                  {f.icon} Sell {chosen.length} to {f.name.split(' ')[0]}: {fmt(total)}
                </Btn>
              ))}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function SyndTab({ camp, act }: { camp: Campaign; act: (fn: (c: Campaign) => Res | void, sfx?: string) => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {UPGRADE_IDS.map((id) => {
        const u = UPGRADES[id]; const lvl = camp.upgrades[id]; const req = u.requires; const locked = !!req && camp.upgrades[req[0]] < req[1];
        return (
          <Panel key={id}>
            <div className="flex gap-3 items-center"><div className="text-3xl">{u.icon}</div><div className="flex-1"><div className="text-white font-semibold">{u.name}</div><div className="text-xs opacity-70">{u.desc}</div></div><Pips n={lvl} max={3} color="#ffb347" /></div>
            <div className="text-xs mt-2">{lvl > 0 ? <span style={{ color: '#5cf0a8' }}>Now: {u.effect[lvl - 1]}</span> : <span className="opacity-60">Not built</span>}</div>
            {lvl < 3 && <div className="text-xs opacity-80">Next: {u.effect[lvl]}</div>}
            {req && <div className="text-[11px] mt-1" style={{ color: locked ? '#ff9a4d' : '#5cf0a8' }}>Requires {UPGRADES[req[0]].name} Lv{req[1]}</div>}
            <div className="mt-2"><Btn sm onClick={() => act((c) => buyUpgrade(c, id), 'buy')} disabled={lvl >= 3 || locked || camp.cash < u.costs[lvl]}>{lvl >= 3 ? 'Maxed' : `Upgrade ${fmt(u.costs[lvl])}`}</Btn></div>
          </Panel>
        );
      })}
      <Panel title="Campaign Stats">
        <Stat label="Jobs won / run" value={`${camp.stats.wins}/${camp.stats.jobs}`} /><Stat label="Ghost runs" value={camp.stats.ghosts} /><Stat label="Total stolen" value={fmt(camp.stats.stolen)} /><Stat label="Spent on growth" value={fmt(camp.stats.spent)} /><Stat label="Arrests" value={camp.stats.arrests} />
      </Panel>
    </div>
  );
}

function GearTab({ camp, act }: { camp: Campaign; act: (fn: (c: Campaign) => Res | void, sfx?: string) => void }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {GADGET_IDS.map((id) => {
        const g = GADGETS[id];
        return (
          <Panel key={id}>
            <div className="flex gap-3 items-center"><div className="text-4xl">{g.icon}</div><div className="flex-1"><div className="text-white font-semibold">{g.name}</div><div className="text-xs opacity-75">{g.desc}</div></div><div className="text-2xl font-bold text-[#ffd35c]">×{camp.gadgets[id]}</div></div>
            <div className="mt-2 flex items-center gap-2"><Btn sm onClick={() => act((c) => buyGadget(c, id), 'buy')} disabled={camp.gadgets[id] >= 6 || camp.cash < gadgetCost(camp, id)}>Buy {fmt(gadgetCost(camp, id))}</Btn><span className="text-[11px] opacity-60">Deployed live during a heist (key {g.key}).</span></div>
          </Panel>
        );
      })}
    </div>
  );
}

export const _audio = audio;
