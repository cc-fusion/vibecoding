import { useState } from 'react';
import type { Campaign, GadgetId, HeistDef, LootCat, Skill } from '../game/types';
import { CATS, SKILLS, GADGET_IDS } from '../game/types';
import { CAT_INFO, DIFF_NAMES, FENCES, GADGETS, HEAT_COLORS, HEAT_NAMES, HEISTS, MOD_INFO, ROLE_INFO, SKILL_INFO, TRAITS, UPGRADES, heatTier, xpNeeded } from '../game/data';
import { advanceDays as _adv, bail, bailCost, buyGadget, buyIntel, buyUpgrade, completed, fencePrice, freeCrew, gadgetCost, hire, layLow, loadoutSlots, maxRaids, reconCost, sellItem, slots, spendPerk, stashValue } from '../game/store';
import { extraGuards } from '../game/sim';
import { audio } from '../game/audio';
import { Btn, Meter, Panel, money } from './ui';

void _adv;
type Act = (fn: (c: Campaign) => string | null | void, ok?: string) => boolean;
type Tab = 'jobs' | 'crew' | 'fence' | 'hideout' | 'ledger';

export function HeatBar({ heat }: { heat: number }) {
  const t = heatTier(heat);
  return (
    <div className="min-w-[120px]">
      <div className="flex justify-between text-[10px] uppercase tracking-widest" style={{ color: HEAT_COLORS[t] }}><span>Heat · {HEAT_NAMES[t]}</span><span>{Math.round(heat)}</span></div>
      <Meter value={heat} color={HEAT_COLORS[t]} h={7} />
    </div>
  );
}

export function Hub({ camp, act, onPlan, onSettings, onHelp, onTitle, toast }: { camp: Campaign; act: Act; onPlan: (d: HeistDef) => void; onSettings: () => void; onHelp: () => void; onTitle: () => void; toast: (m: string, k?: string) => void }) {
  const [tab, setTab] = useState<Tab>('jobs');
  const tabs: [Tab, string][] = [['jobs', '🗺️ Jobs'], ['crew', '👥 Crew'], ['fence', '💱 Fence'], ['hideout', '🏚️ Hideout'], ['ledger', '📒 Ledger']];
  const jailed = camp.crew.filter(m => m.jailed > 0).length;
  return (
    <div className="min-h-screen bg-[#060e1e] text-slate-100">
      <header className="sticky top-0 z-30 bg-slate-950/95 border-b border-cyan-900/60 px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="font-black tracking-widest text-sm"><span className="text-amber-400">MERIDIAN</span> SYNDICATE</div>
        <div className="text-sm">📅 Day <b>{camp.day}</b></div>
        <div className="text-sm text-emerald-300 font-bold">💰 {money(camp.cash)}</div>
        <HeatBar heat={camp.heat} />
        <div className="text-xs text-slate-400">Raids {camp.raids}/{maxRaids(camp)} · {DIFF_NAMES[camp.diff]}</div>
        <div className="ml-auto flex gap-2"><Btn onClick={onHelp}>? Help</Btn><Btn onClick={onSettings}>⚙ Settings</Btn><Btn onClick={onTitle}>⏏ Title</Btn></div>
      </header>
      <nav className="flex gap-1 px-3 pt-3 flex-wrap">
        {tabs.map(([k, l]) => <Btn key={k} variant={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>{l}{k === 'crew' && jailed ? ` (${jailed} 🔒)` : ''}{k === 'fence' && camp.stash.length ? ` (${camp.stash.length})` : ''}</Btn>)}
      </nav>
      <main className="p-3 max-w-7xl mx-auto">
        {tab === 'jobs' && <Jobs camp={camp} act={act} onPlan={onPlan} toast={toast} />}
        {tab === 'crew' && <CrewTab camp={camp} act={act} />}
        {tab === 'fence' && <Fence camp={camp} act={act} toast={toast} />}
        {tab === 'hideout' && <Hideout camp={camp} act={act} />}
        {tab === 'ledger' && <Ledger camp={camp} />}
      </main>
    </div>
  );
}

function Jobs({ camp, act, onPlan, toast }: { camp: Campaign; act: Act; onPlan: (d: HeistDef) => void; toast: (m: string, k?: string) => void }) {
  const first = HEISTS.find(h => !camp.jobs[h.id]?.done && completed(camp) >= h.unlock) || HEISTS[0];
  const [sel, setSel] = useState<string>(first.id);
  const def = HEISTS.find(h => h.id === sel)!;
  const locked = completed(camp) < def.unlock;
  const job = camp.jobs[def.id];
  const free = freeCrew(camp).length;
  const feeMult = [1, 1, 1.3][camp.diff] * (camp.mods.hot ? 1.4 : 1);
  const eg = extraGuards(camp);
  const guards = Math.max(1, def.guards + eg);
  return (
    <div className="grid lg:grid-cols-5 gap-3">
      <Panel title="Meridian City · Contract Map" className="lg:col-span-3">
        <div className="relative w-full aspect-[16/10] rounded-md overflow-hidden bg-[#0a2140] border border-cyan-900/60">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
            <defs><pattern id="mg" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M4 0H0V4" fill="none" stroke="#1d4f8f" strokeWidth="0.15" /></pattern></defs>
            <rect width="100" height="100" fill="url(#mg)" />
            <path d="M0 55 C 20 48, 35 70, 55 58 S 85 52, 100 62 L100 70 C 85 62, 60 70, 55 66 S 20 58, 0 63Z" fill="#12407a" opacity="0.6" />
            {Array.from({ length: 28 }).map((_, i) => <rect key={i} x={(i * 37) % 92 + 2} y={(i * 53) % 90 + 3} width={5 + (i % 4) * 2} height={4 + (i % 3) * 2} fill="none" stroke="#2a68b0" strokeWidth="0.25" opacity="0.6" />)}
            {HEISTS.slice(0, -1).map((h, i) => <line key={h.id} x1={h.map.x} y1={h.map.y} x2={HEISTS[i + 1].map.x} y2={HEISTS[i + 1].map.y} stroke="#38bdf8" strokeWidth="0.3" strokeDasharray="1.2 1.2" opacity="0.5" />)}
          </svg>
          {HEISTS.map((h, i) => {
            const lk = completed(camp) < h.unlock, jb = camp.jobs[h.id], done = jb && jb.done > 0;
            return (
              <button key={h.id} onClick={() => { audio.play('click'); setSel(h.id); }} className="absolute -translate-x-1/2 -translate-y-1/2 group" style={{ left: `${h.map.x}%`, top: `${h.map.y}%` }}>
                <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center font-black text-sm transition ${sel === h.id ? 'scale-125 ring-4 ring-white/40' : ''} ${lk ? 'bg-slate-800 border-slate-600 text-slate-500' : done ? 'bg-emerald-600 border-emerald-300 text-white' : 'bg-cyan-500 border-cyan-200 text-slate-950 animate-pulse'}`}>{lk ? '🔒' : done ? jb.best : i + 1}</div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-0.5 whitespace-nowrap text-[10px] sm:text-xs font-semibold text-cyan-100 bg-slate-950/80 px-1.5 rounded">{h.id === 'meridian' ? '★ ' : ''}{h.name}</div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2 flex-wrap items-center">
          <Btn onClick={() => act(c => layLow(c), 'Three quiet days pass. Heat cools.')} disabled={camp.cash < 250}>🛌 Lay Low (3 days · $250 · −heat)</Btn>
          <span className="text-xs text-slate-400">Completed {completed(camp)}/{HEISTS.length}. Finale needs 6.</span>
        </div>
      </Panel>
      <Panel title={`Briefing${def.id === 'meridian' ? ' · CAPSTONE' : ''}`} className="lg:col-span-2">
        <h3 className="text-xl font-black text-white">{def.name}</h3>
        <div className="text-xs text-cyan-300 mb-2">{def.district} · Client: {def.client}</div>
        <p className="text-sm text-slate-300">{def.blurb}</p>
        <div className="grid grid-cols-2 gap-1.5 mt-3 text-sm">
          <div>💵 Fee <b className="text-emerald-300">{money(def.fee * feeMult)}</b></div>
          <div>⏱ Par <b>{def.par}s</b></div>
          <div>🛡 Guards <b>{guards}</b>{eg !== 0 && <span className="text-xs text-amber-300"> ({eg > 0 ? '+' : ''}{eg} heat/diff)</span>}</div>
          <div>📷 Cameras <b>{def.cams}</b></div>
          <div>🔴 Laser grids <b>{def.lasers}</b></div>
          <div>🧍 Sentinels <b>{def.sentinels}</b></div>
          <div>🐕 K9 <b>{def.k9}</b></div>
          <div>🛸 Drones <b>{def.drones}</b></div>
          {def.captain && <div className="col-span-2 text-red-300 font-bold">⚠ Boss: Captain Voss + 3-stage vault protocol</div>}
        </div>
        <div className="text-xs text-slate-400 mt-2">Intel: {['None', 'Casing', 'Casing + Inside man'][camp.intel[def.id] || 0]}{job ? ` · Best ${job.best} · Best haul ${money(job.bestLoot)} · Done ×${job.done}` : ''}</div>
        <div className="text-xs italic text-amber-200/80 mt-2">Tip: {def.hint}</div>
        <div className="mt-3">
          {locked ? <div className="text-sm text-red-300">🔒 Complete {def.unlock} job{def.unlock === 1 ? '' : 's'} to unlock.</div> : free === 0 ? <div className="text-sm text-red-300">No crew available. Pay bail or hire someone.</div> : <Btn variant="gold" className="w-full py-2.5 text-base" onClick={() => onPlan(def)}>📐 Plan This Heist</Btn>}
        </div>
        {camp.heat >= 75 && <div className="mt-2 text-xs text-red-300">🔥 Heat is critical. One more messy job could trigger a Task Force raid.</div>}
        <div className="hidden">{toast.length}</div>
      </Panel>
    </div>
  );
}

function CrewTab({ camp, act }: { camp: Campaign; act: Act }) {
  return (
    <div className="grid lg:grid-cols-3 gap-3">
      <div className="lg:col-span-2 grid sm:grid-cols-2 gap-3 content-start">
        {camp.crew.map(m => (
          <Panel key={m.id} className={m.jailed > 0 ? 'opacity-80 border-red-800' : ''}>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl" style={{ background: m.color + '33', border: `2px solid ${m.color}` }}>{m.icon}</div>
              <div className="flex-1"><div className="font-bold text-white">{m.name} <span className="text-xs text-slate-400">Lv {m.level}</span></div><div className="text-xs" style={{ color: m.color }}>{ROLE_INFO[m.role].label} · {TRAITS[m.trait].name}</div></div>
              <div className="text-right text-xs text-slate-400">Salary<br /><b className="text-slate-200">{money(m.salary * (m.trait === 'loyal' ? 0.7 : 1))}</b></div>
            </div>
            <div className="mt-2"><Meter value={m.xp} max={xpNeeded(m.level)} color="#a78bfa" h={5} /><div className="text-[10px] text-slate-500">XP {m.xp}/{xpNeeded(m.level)} · {m.heists} heists</div></div>
            <div className="mt-2 space-y-1">
              {SKILLS.map((sk: Skill) => (
                <div key={sk} className="flex items-center gap-2 text-xs"><span className="w-24 text-slate-300">{SKILL_INFO[sk].icon} {SKILL_INFO[sk].label}</span>
                  <div className="flex gap-0.5 flex-1">{[1, 2, 3, 4, 5].map(i => <div key={i} className={`h-2 flex-1 rounded-sm ${i <= m.skills[sk] ? 'bg-cyan-400' : 'bg-slate-800'}`} />)}</div>
                  {m.perks > 0 && m.skills[sk] < 5 && <button className="px-1.5 rounded bg-amber-400 text-slate-950 font-black" onClick={() => { audio.play('upgrade'); act(c => spendPerk(c, m.id, sk)); }}>+</button>}
                </div>))}
            </div>
            <div className="text-[11px] text-slate-400 mt-2">{TRAITS[m.trait].desc} · Special: <b className="text-amber-300">{ROLE_INFO[m.role].special}</b></div>
            {m.perks > 0 && <div className="text-xs text-amber-300 mt-1">★ {m.perks} perk point{m.perks > 1 ? 's' : ''} to spend</div>}
            {m.jailed > 0 && <div className="mt-2 flex items-center gap-2 text-sm text-red-300">🔒 In custody ({m.jailed}d) <Btn variant="danger" disabled={camp.cash < bailCost(camp, m)} onClick={() => act(c => bail(c, m.id), 'Bail paid.')}>Bail {money(bailCost(camp, m))}</Btn></div>}
          </Panel>
        ))}
      </div>
      <Panel title="Recruits (refresh every 4 days)" className="content-start h-fit">
        <div className="space-y-2">
          {camp.recruits.length === 0 && <div className="text-sm text-slate-400">Nobody is looking for work right now.</div>}
          {camp.recruits.map(r => (
            <div key={r.id} className="p-2 rounded border border-slate-700 bg-slate-950/60">
              <div className="flex items-center gap-2"><span className="text-xl">{r.icon}</span><div className="flex-1"><div className="font-bold text-sm">{r.name} <span className="text-xs text-slate-400">Lv {r.level}</span></div><div className="text-xs" style={{ color: r.color }}>{ROLE_INFO[r.role].label} · {TRAITS[r.trait].name}</div></div>
                <Btn variant="gold" disabled={camp.cash < r.hire} onClick={() => { audio.play('cash'); act(c => hire(c, r.id), `${r.name} hired!`); }}>{money(r.hire)}</Btn></div>
              <div className="flex flex-wrap gap-1 mt-1">{SKILLS.filter(sk => r.skills[sk] > 0).map(sk => <span key={sk} className="text-[10px] bg-slate-800 px-1.5 rounded">{SKILL_INFO[sk].icon}{r.skills[sk]}</span>)}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Fence({ camp, act, toast }: { camp: Campaign; act: Act; toast: (m: string, k?: string) => void }) {
  const [fid, setFid] = useState(FENCES[0].id);
  const f = FENCES.find(x => x.id === fid)!;
  const sellOne = (i: number) => {
    const it = camp.stash[i];
    if (!it) return;
    let res: { price: number; traced: boolean } | null = null;
    act(c => { res = sellItem(c, fid, i); return res ? null : 'Item missing'; });
    if (res) { const r = res as { price: number; traced: boolean }; audio.play('cash'); toast(`Sold ${it.name} for ${money(r.price)}${r.traced ? ' (traced! +4 heat)' : ''}`, r.traced ? 'bad' : 'good'); }
  };
  const sellAll = () => {
    if (!camp.stash.length) return;
    let total = 0, traced = 0;
    act(c => { while (c.stash.length) { const r = sellItem(c, fid, 0); if (r) { total += r.price; if (r.traced) traced++; } else break; } });
    audio.play('cash');
    toast(`Sold everything for ${money(total)}${traced ? ` (${traced} traced)` : ''}`, 'good');
  };
  return (
    <div className="grid lg:grid-cols-5 gap-3">
      <div className="lg:col-span-2 space-y-3">
        <Panel title="Market Index">
          {camp.market.event && <div className="text-sm text-amber-300 mb-2">📰 {camp.market.event}</div>}
          <div className="grid grid-cols-2 gap-2">
            {CATS.map((k: LootCat) => { const v = camp.market.idx[k], t = camp.market.trend[k]; return (
              <div key={k} className="p-2 rounded bg-slate-950/60 border border-slate-800"><div className="text-sm">{CAT_INFO[k].icon} {CAT_INFO[k].label}</div>
                <div className={`text-lg font-black ${v >= 1.05 ? 'text-emerald-300' : v <= 0.9 ? 'text-red-300' : 'text-slate-200'}`}>{Math.round(v * 100)}% {t > 0.03 ? '▲' : t < -0.03 ? '▼' : '•'}</div></div>); })}
          </div>
        </Panel>
        <Panel title="Fences">
          <div className="space-y-2">{FENCES.map(x => (
            <button key={x.id} onClick={() => { audio.play('click'); setFid(x.id); }} className={`w-full text-left p-2 rounded border ${fid === x.id ? 'border-amber-400 bg-amber-400/10' : 'border-slate-700 bg-slate-950/60'}`}>
              <div className="font-bold text-sm">{x.icon} {x.name} <span className="text-cyan-300 text-xs">×{x.rate.toFixed(2)}</span></div><div className="text-xs text-slate-400">{x.desc}</div>
              <div className="text-[10px] text-slate-500">Saturation: {CATS.map(k => `${CAT_INFO[k].icon}${Math.round(camp.market.sat[x.id][k] * 100)}%`).join(' ')}</div></button>))}</div>
          <div className="text-xs text-slate-400 mt-2">Heat {Math.round(camp.heat)} cuts hot-goods prices by up to {Math.round(Math.min(40, camp.heat * f.heatPen * 100))}% at this fence.</div>
        </Panel>
      </div>
      <Panel title={`Stash · ${camp.stash.length} items · ${money(stashValue(camp))} nominal`} className="lg:col-span-3" right={<Btn variant="gold" disabled={!camp.stash.length} onClick={sellAll}>Sell all to {f.name}</Btn>}>
        {camp.stash.length === 0 ? <div className="text-slate-400 text-sm py-8 text-center">Your stash is empty. Pull a job and bring home some loot.</div> : (
          <div className="grid sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto pr-1">
            {camp.stash.map((it, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border border-slate-700 bg-slate-950/60">
                <span className="text-2xl">{it.icon}</span><div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{it.name}</div><div className="text-[11px] text-slate-400">{CAT_INFO[it.cat].label} · base {money(it.value)}</div></div>
                <Btn variant="primary" onClick={() => sellOne(i)}>{money(fencePrice(camp, fid, it))}</Btn>
              </div>))}
          </div>)}
      </Panel>
    </div>
  );
}

function Hideout({ camp, act }: { camp: Campaign; act: Act }) {
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Panel title="Hideout Upgrades">
        <div className="space-y-2">{UPGRADES.map(u => { const lvl = camp.upg[u.id] || 0, max = lvl >= u.costs.length; return (
          <div key={u.id} className="p-2 rounded border border-slate-700 bg-slate-950/60 flex items-center gap-3">
            <div className="text-2xl">{u.icon}</div>
            <div className="flex-1"><div className="font-bold text-sm">{u.name} <span className="text-cyan-300 text-xs">Lv {lvl}/{u.costs.length}</span></div><div className="text-xs text-slate-400">{u.desc}</div>
              <div className="flex gap-1 mt-1">{u.costs.map((_, i) => <div key={i} className={`h-1.5 w-8 rounded ${i < lvl ? 'bg-amber-400' : 'bg-slate-700'}`} />)}</div></div>
            <Btn variant="gold" disabled={max || camp.cash < u.costs[lvl]} onClick={() => { audio.play('upgrade'); act(c => buyUpgrade(c, u.id, u.costs), `${u.name} upgraded!`); }}>{max ? 'MAX' : money(u.costs[lvl])}</Btn>
          </div>); })}</div>
        <div className="text-xs text-slate-400 mt-3">Crew slots: <b>{slots(camp)}</b> · Gadget loadout: <b>{loadoutSlots(camp)}</b> · Improvise orders: <b>{3 + (camp.upg.comms || 0) + [1, 0, -1][camp.diff]}</b></div>
      </Panel>
      <Panel title="Workshop · Gadgets">
        <div className="space-y-2">{GADGET_IDS.map((g: GadgetId) => (
          <div key={g} className="p-2 rounded border border-slate-700 bg-slate-950/60 flex items-center gap-3">
            <div className="text-2xl">{GADGETS[g].icon}</div>
            <div className="flex-1"><div className="font-bold text-sm">{GADGETS[g].name} <span className="text-xs text-cyan-300">in stock: {camp.gadgets[g]}</span></div><div className="text-xs text-slate-400">{GADGETS[g].desc}</div></div>
            <Btn variant="primary" disabled={camp.cash < gadgetCost(camp, g) || camp.gadgets[g] >= 6} onClick={() => { audio.play('upgrade'); act(c => buyGadget(c, g)); }}>{money(gadgetCost(camp, g))}</Btn>
          </div>))}</div>
        <div className="text-xs text-slate-400 mt-3">Consumed gadgets are used up when thrown. Unused gadgets return to stock.</div>
      </Panel>
    </div>
  );
}

function Ledger({ camp }: { camp: Campaign }) {
  const s = camp.stats;
  const rows: [string, string][] = [['Heists run', String(s.heists)], ['Total earned', money(s.earned)], ['Loot hauled', money(s.loot)], ['Ghost runs', String(s.ghosts)], ['Alarms raised', String(s.alarms)], ['Guards downed', String(s.guards)], ['Bodies found', String(s.bodies)], ['Arrests', String(s.arrests)], ['Time on jobs', `${Math.round(s.time / 60)} min`], ['Fenced', money(s.sold)]];
  return (
    <div className="grid lg:grid-cols-2 gap-3">
      <Panel title="Newswire">{camp.news.map((n, i) => <div key={i} className="text-sm py-1 border-b border-slate-800 text-slate-300">{n}</div>)}</Panel>
      <div className="space-y-3">
        <Panel title="Campaign Stats"><div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between"><span className="text-slate-400">{k}</span><b>{v}</b></div>)}</div></Panel>
        <Panel title="Rules in Effect">
          <div className="text-sm text-slate-300">Difficulty: <b>{DIFF_NAMES[camp.diff]}</b> · Raids allowed: <b>{maxRaids(camp)}</b></div>
          <div className="text-sm text-slate-300 mt-1">Modifiers: {(Object.keys(MOD_INFO) as (keyof typeof MOD_INFO)[]).filter(k => camp.mods[k]).map(k => `${MOD_INFO[k].icon} ${MOD_INFO[k].name}`).join(', ') || 'none'}</div>
          <div className="text-xs text-slate-400 mt-2">Heat effects: tier {heatTier(camp.heat) + 1}/4. Extra guards +{heatTier(camp.heat)}, police ETA −{Math.round(camp.heat * 0.3)}s, fence prices lower, recon costs up.</div>
        </Panel>
      </div>
    </div>
  );
}

export { reconCost, buyIntel };
