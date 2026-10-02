import { useState } from 'react';
import { ARCH, CAT_IDS, CATS, CONTRACT_MODS, GADGETS, GadgetId, LOOT, SKILLS, SkillId, TIER_NAMES, TPLS, TRAITS, UPGRADES, REP_STEPS, repTier, heatTier, CAPSTONE_TIER, DIFFS, MODS, ModId } from '../game/data';
import { Contract, Meta, bailCost, crewSlots, fenceCut, gadgetCost, hireCost, needXp, sellItems, stashValue, wageOf, advanceDay } from '../game/meta';
import { audio } from '../game/audio';
import { Bar, money } from './common';

interface Props {
  meta: Meta; act: (fn: (m: Meta) => void) => void;
  onBrief: (c: Contract) => void; onTutorial: () => void; onMenu: () => void; onSettings: () => void; onHelp: () => void;
}
const TABS = [['jobs', '📋 Jobs'], ['crew', '👥 Crew'], ['fence', '💱 Fence'], ['armory', '🧰 Armory'], ['hideout', '🏚️ Hideout'], ['records', '📰 Records']] as const;

function Spark({ data, color }: { data: number[]; color: string }) {
  const mn = Math.min(...data), mx = Math.max(...data), r = mx - mn || 1;
  const pts = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${28 - ((v - mn) / r) * 24}`).join(' ');
  return <svg viewBox="0 0 100 30" className="h-8 w-24"><polyline points={pts} fill="none" stroke={color} strokeWidth="2" /></svg>;
}

export default function Hub({ meta, act, onBrief, onTutorial, onMenu, onSettings, onHelp }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('jobs');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const tier = repTier(meta.rep);
  const next = REP_STEPS[Math.min(5, tier + 1)];
  const ht = heatTier(meta.heat);
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2200); };
  const buy = (cost: number, fn: (m: Meta) => void, ok = 'Purchased.') => {
    if (meta.cash < cost) { audio.sfx('error'); say('Not enough cash.'); return; }
    audio.sfx('buy'); act(m => { m.cash -= cost; fn(m); }); say(ok);
  };

  return (
    <div className="blueprint-bg flex h-full w-full flex-col">
      {/* header */}
      <header className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-sky-500/30 bg-[#06101f]/90 px-3 py-2">
        <div className="font-display text-xl font-bold tracking-widest text-amber-200">🕶️ MERIDIAN SYNDICATE</div>
        <div className="text-sm">📅 Day <b className="text-sky-200">{meta.day}</b></div>
        <div className="text-sm">💰 <b className={meta.cash < 0 ? 'text-red-400' : 'text-emerald-300'}>{money(meta.cash)}</b></div>
        <div className="w-40" title="Heat: at 100 the task force raids you.">
          <div className="flex justify-between text-xs"><span style={{ color: ht.c }}>🔥 Heat: {ht.n}</span><span>{Math.round(meta.heat)}</span></div>
          <Bar value={meta.heat} color={ht.c} h={7} />
        </div>
        <div className="w-40" title="Reputation unlocks contracts and gear.">
          <div className="flex justify-between text-xs"><span className="text-sky-200">⭐ {TIER_NAMES[tier]}</span><span>{meta.rep}{tier < 5 ? `/${next}` : ''}</span></div>
          <Bar value={tier >= 5 ? 1 : meta.rep - REP_STEPS[tier]} max={tier >= 5 ? 1 : next - REP_STEPS[tier]} color="#fbbf24" h={7} />
        </div>
        <div className="ml-auto flex gap-1">
          <button className="btn !px-2 !py-1" onClick={() => { audio.sfx('click'); onHelp(); }}>❓</button>
          <button className="btn !px-2 !py-1" onClick={() => { audio.sfx('click'); onSettings(); }}>⚙️</button>
          <button className="btn !px-2 !py-1" onClick={() => { audio.sfx('click'); onMenu(); }}>☰ Menu</button>
        </div>
      </header>

      {meta.heat >= 75 && <div className="pulse-red bg-red-900/60 px-3 py-1 text-center text-sm font-bold text-red-100">🚨 TASK FORCE CLOSING IN. Lay low or bribe a detective before heat reaches 100!</div>}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-sky-500/20 p-2 md:w-44 md:flex-col md:border-b-0 md:border-r">
          {TABS.map(([id, label]) => <button key={id} className={`btn whitespace-nowrap text-left ${tab === id ? 'btn-on' : ''}`} onClick={() => { audio.sfx('click'); setTab(id); }}>{label}</button>)}
          <div className="hidden flex-1 md:block" />
          <button className="btn whitespace-nowrap text-left" onClick={() => { audio.sfx('click'); act(m => { advanceDay(m, true); }); say('You lay low. Heat falls fast, wages are due.'); }} title="Skip a day: heat -8 or more, wages paid, market moves.">💤 Lay Low (1 day)</button>
          <button className="btn whitespace-nowrap text-left" onClick={() => { const c = Math.round(400 + meta.heat * 15); buy(c, m => { m.heat = Math.max(0, m.heat - 12); }, 'A detective looks the other way. Heat -12.'); }} disabled={meta.heat <= 0}>💸 Bribe ({money(400 + meta.heat * 15)})</button>
        </nav>

        <main className="relative min-h-0 flex-1 overflow-y-auto p-3">
          {flash && <div className="pointer-events-none fixed left-1/2 top-16 z-40 -translate-x-1/2 rounded border border-amber-400/60 bg-black/85 px-3 py-1.5 text-sm text-amber-200 pop-in">{flash}</div>}

          {tab === 'jobs' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-2xl text-sky-200">Job Board</h2>
                <div className="flex gap-2"><button className="btn" onClick={() => { audio.sfx('click'); onTutorial(); }}>🎓 Training Run{meta.flags.tutorialDone ? ' (done)' : ' (+$500)'}</button></div>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {meta.contracts.slice().sort((a, b) => Number(!!b.capstone) - Number(!!a.capstone)).map(c => {
                  const t = TPLS[c.tpl]; const left = c.expires - meta.day;
                  return (
                    <div key={c.id} className={`panel p-3 ${c.capstone ? '!border-amber-400/80 shadow-[0_0_30px_rgba(251,191,36,0.25)]' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-display text-xl font-bold text-amber-100">{t.icon} {t.name}</div>
                          <div className="text-xs text-slate-400">Client: {c.client} · Tier {t.tier}{c.capstone ? ' · CAPSTONE' : ''}</div>
                        </div>
                        <div className="text-right"><div className="font-display text-xl text-emerald-300">{money(c.fee)}</div>{!c.capstone && <div className={`text-xs ${left <= 1 ? 'text-red-300' : 'text-slate-400'}`}>{left} day{left === 1 ? '' : 's'} left</div>}</div>
                      </div>
                      <p className="mt-1 text-sm text-slate-300">{t.blurb}</p>
                      <div className="mt-2 flex flex-wrap gap-1 text-xs">
                        <span className="rounded bg-sky-900/50 px-1.5 py-0.5">🏠 {t.rooms} rooms</span>
                        <span className="rounded bg-sky-900/50 px-1.5 py-0.5">🛡️ ~{t.guards + t.heavy} guards</span>
                        {t.cams > 0 && <span className="rounded bg-sky-900/50 px-1.5 py-0.5">📹 cams</span>}
                        {t.lasers > 0 && <span className="rounded bg-sky-900/50 px-1.5 py-0.5">🔦 lasers</span>}
                        {t.drones > 0 && <span className="rounded bg-sky-900/50 px-1.5 py-0.5">🤖 drones</span>}
                        {t.civs > 0 && <span className="rounded bg-sky-900/50 px-1.5 py-0.5">🧍 witnesses</span>}
                        {t.boss && <span className="rounded bg-fuchsia-900/60 px-1.5 py-0.5">👑 BOSS</span>}
                        {c.mod !== 'none' && <span className="rounded bg-amber-900/60 px-1.5 py-0.5" title={CONTRACT_MODS[c.mod].desc}>⚠ {CONTRACT_MODS[c.mod].name}</span>}
                      </div>
                      <button className="btn btn-gold mt-3 w-full" onClick={() => { audio.sfx('select'); onBrief(c); }}>Plan this job →</button>
                    </div>
                  );
                })}
              </div>
              <div className="panel p-3 text-sm text-slate-400">
                <div className="font-display text-lg text-sky-200">Coming up</div>
                {Object.values(TPLS).filter(t => t.tier > tier && t.tier > 0).sort((a, b) => a.tier - b.tier).map(t => (
                  <div key={t.id}>🔒 {t.icon} {t.name} {t.boss ? '(CAPSTONE) ' : ''}- requires {TIER_NAMES[t.boss ? CAPSTONE_TIER : t.tier]} ({REP_STEPS[t.boss ? CAPSTONE_TIER : t.tier]} rep)</div>
                ))}
                {!Object.values(TPLS).some(t => t.tier > tier && t.tier > 0) && <div>All contracts unlocked.</div>}
              </div>
            </div>
          )}

          {tab === 'crew' && (
            <div className="space-y-4">
              <div className="flex items-baseline justify-between"><h2 className="font-display text-2xl text-sky-200">Your Crew</h2><span className="text-sm text-slate-400">{crewSlots(meta)} per heist · wages paid daily</span></div>
              {!meta.crew.length && <div className="panel p-4 text-slate-300">You have no crew. Hire someone from the board below.</div>}
              <div className="grid gap-3 lg:grid-cols-2">
                {meta.crew.map(c => {
                  const a = ARCH[c.arch];
                  return (
                    <div key={c.id} className="panel p-3" style={{ borderColor: a.color + '88' }}>
                      <div className="flex items-center justify-between">
                        <div className="font-display text-xl font-bold" style={{ color: a.color }}>{a.icon} {c.name} <span className="text-sm text-slate-400">{a.name} · Lv {c.lvl}</span></div>
                        <div className="text-xs text-slate-400">{money(wageOf(meta, c))}/day</div>
                      </div>
                      <div className="text-xs text-amber-200/80">★ {a.perk}: {a.perkDesc}</div>
                      {c.trait && <div className="text-xs text-sky-300">◆ {TRAITS[c.trait].name}: {TRAITS[c.trait].desc}</div>}
                      <div className="mt-1 text-xs text-slate-400">XP {c.xp}/{needXp(c.lvl)} · {c.heists} heists</div>
                      <Bar value={c.xp} max={needXp(c.lvl)} color={a.color} h={4} />
                      <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {SKILLS.map(s => (
                          <div key={s.id} className="flex items-center justify-between rounded bg-white/5 px-2 py-0.5 text-sm" title={s.desc}>
                            <span>{s.icon} {s.name}</span>
                            <span className="flex items-center gap-1">{'●'.repeat(c.skills[s.id])}<span className="opacity-30">{'●'.repeat(6 - c.skills[s.id])}</span>
                              {c.sp > 0 && c.skills[s.id] < 6 && <button className="btn !px-1.5 !py-0 text-xs" onClick={() => { audio.sfx('levelup'); act(m => { const x = m.crew.find(q => q.id === c.id)!; x.skills[s.id as SkillId]++; x.sp--; }); }}>+</button>}</span>
                          </div>
                        ))}
                      </div>
                      {c.sp > 0 && <div className="mt-1 text-xs text-amber-300">★ {c.sp} skill point{c.sp > 1 ? 's' : ''} to spend</div>}
                      {c.jail > 0 ? (
                        <div className="mt-2 flex items-center justify-between rounded bg-red-900/30 p-2 text-sm"><span>⛓ In jail: {c.jail} day(s)</span>
                          <button className="btn btn-red !py-0.5" onClick={() => buy(bailCost(meta, c), m => { m.crew.find(q => q.id === c.id)!.jail = 0; }, `${c.name} is out on bail.`)}>Bail {money(bailCost(meta, c))}</button></div>
                      ) : (
                        <div className="mt-2 text-right"><button className="btn !py-0.5 text-xs" onClick={() => { if (confirm === c.id) { act(m => { m.crew = m.crew.filter(q => q.id !== c.id); }); setConfirm(null); audio.sfx('remove'); } else { setConfirm(c.id); audio.sfx('click'); } }}>{confirm === c.id ? 'Really dismiss?' : 'Dismiss'}</button></div>
                      )}
                    </div>
                  );
                })}
              </div>
              <h3 className="font-display text-2xl text-sky-200">Underworld Board <span className="text-sm text-slate-400">(refreshes every 3 days)</span></h3>
              <div className="grid gap-3 lg:grid-cols-2">
                {meta.recruits.map(c => {
                  const a = ARCH[c.arch];
                  return (
                    <div key={c.id} className="panel p-3">
                      <div className="flex items-center justify-between"><div className="font-display text-lg font-bold" style={{ color: a.color }}>{a.icon} {c.name} <span className="text-sm text-slate-400">{a.name} Lv {c.lvl}</span></div><div className="text-xs">{money(wageOf(meta, c))}/day</div></div>
                      <div className="flex flex-wrap gap-x-3 text-sm">{SKILLS.map(s => <span key={s.id}>{s.icon}{c.skills[s.id]}</span>)}</div>
                      <div className="text-xs text-amber-200/80">★ {a.perk}</div>
                      {c.trait && <div className="text-xs text-sky-300">◆ {TRAITS[c.trait].name}: {TRAITS[c.trait].desc}</div>}
                      <button className="btn btn-gold mt-2 w-full" disabled={meta.crew.length >= 8} onClick={() => buy(hireCost(c), m => { m.crew.push(c); m.recruits = m.recruits.filter(r => r.id !== c.id); }, `${c.name} joins the crew.`)}>{meta.crew.length >= 8 ? 'Roster full (8)' : `Hire for ${money(hireCost(c))}`}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'fence' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-2xl text-sky-200">The Fence</h2><span className="text-sm text-slate-400">Fence cut: <b className="text-amber-300">{Math.round(fenceCut(meta) * 100)}%</b> (heat and Fence Network affect this)</span></div>
              {meta.market.event ? <div className="rounded border border-amber-500/50 bg-amber-900/20 p-2 text-sm text-amber-200">📣 <b>{meta.market.event.name}</b>: {meta.market.event.desc} ({meta.market.event.days} day(s) left)</div> : <div className="text-sm text-slate-500">No special market events right now.</div>}
              <div className="panel divide-y divide-white/5">
                {CAT_IDS.filter(c => c !== 'cash').map(cat => {
                  const idx = meta.market.idx[cat]; const h = meta.market.hist[cat]; const prev = h[h.length - 2] ?? idx;
                  const count = meta.stash.filter(s => LOOT[s.kind].cat === cat).length;
                  return (
                    <div key={cat} className="flex flex-wrap items-center gap-3 p-2">
                      <div className="w-28 font-display text-lg" style={{ color: CATS[cat].color }}>{CATS[cat].icon} {CATS[cat].name}</div>
                      <Spark data={h} color={CATS[cat].color} />
                      <div className="w-24 text-sm">×{idx.toFixed(2)} <span className={idx >= prev ? 'text-emerald-400' : 'text-red-400'}>{idx >= prev ? '▲' : '▼'}</span></div>
                      <div className="flex-1 text-sm text-slate-300">Stash: <b>{count}</b> · worth {money(stashValue(meta, cat))}</div>
                      <button className="btn !py-0.5" disabled={!count} onClick={() => { audio.sfx('cash'); act(m => { sellItems(m, 'one', cat, 1); }); }}>Sell 1</button>
                      <button className="btn btn-gold !py-0.5" disabled={!count} onClick={() => { audio.sfx('cash'); act(m => { sellItems(m, 'cat', cat, 999); }); }}>Sell all</button>
                    </div>
                  );
                })}
              </div>
              <div className="text-xs text-slate-500">Each item sold pushes that price down ~4%. Prices recover over days. Cash loot is laundered automatically at 12%. Lifetime fenced: {money(meta.stats.fenced)}.</div>
            </div>
          )}

          {tab === 'armory' && (
            <div className="space-y-3">
              <h2 className="font-display text-2xl text-sky-200">Armory <span className="text-sm text-slate-400">carry up to {3 + (meta.upgrades.armory || 0)} per heist</span></h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {(Object.keys(GADGETS) as GadgetId[]).map(g => {
                  const d = GADGETS[g]; const locked = d.tier > tier; const cost = gadgetCost(meta, g); const have = meta.gadgets[g] || 0;
                  return (
                    <div key={g} className={`panel flex items-center gap-3 p-3 ${locked ? 'opacity-50' : ''}`}>
                      <div className="text-4xl">{d.icon}</div>
                      <div className="flex-1"><div className="font-display text-lg font-bold text-amber-100">{d.name} <span className="text-sm text-slate-400">owned: {have}</span></div><div className="text-xs text-slate-300">{d.desc}</div></div>
                      <button className="btn btn-gold" disabled={locked || have >= 6} onClick={() => buy(cost, m => { m.gadgets[g] = (m.gadgets[g] || 0) + 1; }, `${d.name} acquired.`)}>{locked ? `🔒 ${TIER_NAMES[d.tier]}` : have >= 6 ? 'Max' : money(cost)}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'hideout' && (
            <div className="space-y-3">
              <h2 className="font-display text-2xl text-sky-200">Hideout Upgrades</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {UPGRADES.map(u => {
                  const lv = meta.upgrades[u.id] || 0; const max = u.costs.length;
                  return (
                    <div key={u.id} className="panel flex items-center gap-3 p-3">
                      <div className="text-4xl">{u.icon}</div>
                      <div className="flex-1"><div className="font-display text-lg font-bold text-amber-100">{u.name}</div><div className="text-xs text-slate-300">{u.desc}</div>
                        <div className="mt-1 text-sm">{Array.from({ length: max }, (_, i) => <span key={i} className={i < lv ? 'text-amber-300' : 'text-slate-600'}>◆</span>)}</div></div>
                      <button className="btn btn-gold" disabled={lv >= max} onClick={() => buy(u.costs[lv], m => { m.upgrades[u.id] = lv + 1; }, `${u.name} upgraded.`)}>{lv >= max ? 'Maxed' : money(u.costs[lv])}</button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'records' && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="panel p-3">
                <h2 className="mb-2 font-display text-2xl text-sky-200">Syndicate Records</h2>
                <div className="mb-2 text-xs text-slate-400">{DIFFS[meta.diff].name}{(Object.keys(MODS) as ModId[]).filter(k => meta.mods[k]).map(k => ` · ${MODS[k].icon} ${MODS[k].name}`)}</div>
                <table className="w-full text-sm"><tbody>
                  {([['Heists attempted', meta.stats.heists], ['Successful', meta.stats.success], ['Total earned', money(meta.stats.earned)], ['Loot stolen (value)', money(meta.stats.stolen)], ['Best score', money(meta.stats.best)], ['Ghost runs', meta.stats.ghosts], ['Hard alarms raised', meta.stats.alarms], ['Guards knocked out', meta.stats.kos], ['Arrests', meta.stats.arrests], ['Items fenced', money(meta.stats.fenced)]] as [string, string | number][]).map(([k, v]) => <tr key={k} className="border-b border-white/5"><td className="py-1 text-slate-400">{k}</td><td className="text-right text-amber-200">{v}</td></tr>)}
                </tbody></table>
              </div>
              <div className="panel p-3"><h2 className="mb-2 font-display text-2xl text-sky-200">Street News</h2>
                <ul className="space-y-1 text-sm text-slate-300">{meta.news.map((n, i) => <li key={i} className="border-b border-white/5 pb-1">• {n}</li>)}</ul></div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
