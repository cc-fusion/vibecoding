import { useMemo, useState } from 'react';
import { ARCH, CONTRACT_MODS, GADGETS, GadgetId, SKILLS, TPLS, heatTier } from '../game/data';
import { Contract, Meta, crewSlots, gadgetSlots, worldOpts } from '../game/meta';
import { buildWorld } from '../game/mapgen';
import { audio } from '../game/audio';
import { money } from './common';

interface Props {
  meta: Meta; contract: Contract; act: (fn: (m: Meta) => void) => void;
  onStart: (crewIds: string[], loadout: Partial<Record<GadgetId, number>>) => void; onBack: () => void;
}

export default function Brief({ meta, contract, act, onStart, onBack }: Props) {
  const tpl = TPLS[contract.tpl];
  const avail = meta.crew.filter(c => c.jail <= 0);
  const slots = crewSlots(meta);
  const [crew, setCrew] = useState<string[]>(() => avail.slice(0, Math.min(slots, 3)).map(c => c.id));
  const [load, setLoad] = useState<Partial<Record<GadgetId, number>>>({});
  const [msg, setMsg] = useState('');
  const world = useMemo(() => buildWorld(tpl, contract.seed, worldOpts(meta, contract)), [tpl, contract.seed, meta.heat, contract.mod]);
  const tier = tpl.tier;
  const l1 = 250 * tier, l2 = 450 * tier;
  const gTotal = Object.values(load).reduce((a, b) => a + (b || 0), 0);
  const gMax = gadgetSlots(meta);
  const cnt = (t: string) => world.guards.filter(g => g.type === t).length;
  const ht = heatTier(meta.heat);

  const buyRecon = (lvl: number, cost: number) => {
    if (meta.cash < cost) { audio.sfx('error'); setMsg('Not enough cash for recon.'); return; }
    audio.sfx('buy'); act(m => { m.cash -= cost; const c = m.contracts.find(x => x.id === contract.id); if (c) c.recon = lvl; });
    setMsg(lvl === 1 ? 'Scouts report back: guards and security systems mapped.' : 'Full surveillance complete: patrol routes mapped.');
  };
  const toggleCrew = (id: string) => {
    audio.sfx('click');
    setCrew(c => c.includes(id) ? c.filter(x => x !== id) : c.length >= slots ? (setMsg(`Only ${slots} crew fit in the van.`), c) : [...c, id]);
  };
  const adj = (g: GadgetId, d: number) => {
    const have = meta.gadgets[g] || 0, cur = load[g] || 0, n = cur + d;
    if (n < 0 || n > have) return;
    if (d > 0 && gTotal >= gMax) { setMsg(`Bandolier full (${gMax}). Upgrade at the hideout.`); audio.sfx('error'); return; }
    audio.sfx('click'); setLoad(l => ({ ...l, [g]: n }));
  };
  const owned = (Object.keys(GADGETS) as GadgetId[]).filter(g => (meta.gadgets[g] || 0) > 0);

  return (
    <div className="blueprint-bg h-full w-full overflow-y-auto p-3 md:p-6">
      <div className="mx-auto max-w-5xl space-y-3">
        <div className="flex items-center justify-between">
          <button className="btn" onClick={() => { audio.sfx('click'); onBack(); }}>← Back</button>
          <div className="text-sm text-slate-400">💰 {money(meta.cash)} · <span style={{ color: ht.c }}>Heat {ht.n}</span></div>
        </div>
        <div className={`panel p-4 ${contract.capstone ? '!border-amber-400/80' : ''}`}>
          <div className="font-display text-3xl font-bold text-amber-100">{tpl.icon} {tpl.name}</div>
          <div className="text-sm text-slate-400">Client: {contract.client} · Fee {money(contract.fee)} · {contract.mod !== 'none' ? `⚠ ${CONTRACT_MODS[contract.mod].name}: ${CONTRACT_MODS[contract.mod].desc}` : 'No special conditions'}</div>
          <p className="mt-2 text-slate-300">{tpl.blurb}</p>
          <div className="mt-2 text-xs text-slate-400">Police response baseline ≈ {Math.round(tpl.eta)}s (modified by difficulty, heat, scanner). Heat is {Math.round(meta.heat)}: {meta.heat >= 50 ? 'expect extra security.' : 'security is standard.'}</div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="panel p-3">
            <div className="font-display text-xl text-sky-200">🔍 Recon</div>
            <div className="mt-1 text-sm text-slate-300">
              {contract.recon === 0 && 'You only have the floor plan. Cameras, lasers, guards and lock grades are unknown.'}
              {contract.recon === 1 && 'Security systems and guard positions known. Patrol routes unknown.'}
              {contract.recon >= 2 && 'Everything mapped, including patrol routes.'}
            </div>
            {contract.recon >= 1 && (
              <div className="mt-2 flex flex-wrap gap-1 text-xs">
                <span className="rounded bg-red-900/40 px-2 py-0.5">🛡️ {cnt('guard')} guards</span>
                {cnt('heavy') > 0 && <span className="rounded bg-red-900/40 px-2 py-0.5">🦺 {cnt('heavy')} heavy</span>}
                {cnt('drone') > 0 && <span className="rounded bg-violet-900/40 px-2 py-0.5">🤖 {cnt('drone')} drone</span>}
                {cnt('civilian') > 0 && <span className="rounded bg-amber-900/40 px-2 py-0.5">🧍 {cnt('civilian')} civilians</span>}
                {cnt('warden') > 0 && <span className="rounded bg-fuchsia-900/50 px-2 py-0.5">👑 The Warden</span>}
                <span className="rounded bg-amber-900/40 px-2 py-0.5">📹 {world.cams.length} cams</span>
                <span className="rounded bg-red-900/40 px-2 py-0.5">🔦 {world.lasers.length} laser grids</span>
                <span className="rounded bg-sky-900/40 px-2 py-0.5">🖥️ {world.terms.length} terminals</span>
                <span className="rounded bg-sky-900/40 px-2 py-0.5">🔐 {world.safes.length} safes</span>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button className="btn flex-1" disabled={contract.recon >= 1} onClick={() => buyRecon(1, l1)}>Scout ({money(l1)})</button>
              <button className="btn flex-1" disabled={contract.recon >= 2} onClick={() => buyRecon(2, contract.recon >= 1 ? l2 - l1 / 2 : l2)}>Full casing ({money(contract.recon >= 1 ? l2 - l1 / 2 : l2)})</button>
            </div>
          </div>

          <div className="panel p-3">
            <div className="font-display text-xl text-sky-200">🧰 Loadout <span className="text-sm text-slate-400">({gTotal}/{gMax})</span></div>
            {!owned.length && <div className="mt-2 text-sm text-slate-400">You own no gadgets. Visit the Armory in the hideout.</div>}
            <div className="mt-1 space-y-1">
              {owned.map(g => (
                <div key={g} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1 text-sm">
                  <span className="text-xl">{GADGETS[g].icon}</span>
                  <div className="flex-1"><div>{GADGETS[g].name} <span className="text-xs text-slate-500">(own {meta.gadgets[g]})</span></div><div className="text-[11px] text-slate-400">{GADGETS[g].desc}</div></div>
                  <button className="btn !px-2 !py-0" onClick={() => adj(g, -1)}>−</button><b className="w-4 text-center">{load[g] || 0}</b><button className="btn !px-2 !py-0" onClick={() => adj(g, 1)}>+</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel p-3">
          <div className="font-display text-xl text-sky-200">👥 Choose your crew <span className="text-sm text-slate-400">({crew.length}/{slots})</span></div>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {meta.crew.map(c => {
              const a = ARCH[c.arch]; const on = crew.includes(c.id); const jailed = c.jail > 0;
              return (
                <button key={c.id} disabled={jailed} onClick={() => toggleCrew(c.id)} className={`btn !text-left !normal-case ${on ? 'btn-on' : ''}`} style={{ borderColor: on ? a.color : undefined }}>
                  <div className="flex items-center justify-between"><span className="font-display text-lg" style={{ color: a.color }}>{a.icon} {c.name} <span className="text-xs text-slate-400">{a.name} Lv{c.lvl}</span></span>{jailed && <span className="text-xs text-red-300">⛓ jail {c.jail}d</span>}</div>
                  <div className="flex gap-3 text-xs text-slate-300">{SKILLS.map(s => <span key={s.id}>{s.icon}{c.skills[s.id]}</span>)}</div>
                  <div className="text-[11px] normal-case text-amber-200/70">★ {a.perk}</div>
                </button>
              );
            })}
          </div>
          {!avail.length && <div className="mt-2 text-sm text-red-300">All of your crew are in jail. Bail someone out or hire new talent.</div>}
        </div>

        {msg && <div className="text-center text-sm text-amber-300">{msg}</div>}
        <div className="flex justify-end">
          <button className="btn btn-gold !px-8 !py-2 text-xl" disabled={!crew.length} onClick={() => { audio.sfx('select'); onStart(crew, load); }}>Open the blueprints →</button>
        </div>
      </div>
    </div>
  );
}
