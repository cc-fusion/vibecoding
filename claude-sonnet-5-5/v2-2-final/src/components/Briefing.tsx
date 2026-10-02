import { useState } from 'react';
import { Btn, Panel, Stars } from './ui';
import { audio } from '../game/audio';
import { CREW, GADGETS, GADGET_IDS, LOOT, VENUES, fmt, heatTier, HEAT_TIERS } from '../game/data';
import type { Contract } from '../game/data';
import { casingCost, readyCrew } from '../game/meta';
import type { Campaign } from '../game/meta';

export function Briefing({ camp, ct, onBegin, onBack }: { camp: Campaign; ct: Contract; onBegin: (crewIds: string[], recon: number) => void; onBack: () => void }) {
  const V = VENUES[ct.venue]; const ready = readyCrew(camp);
  const [sel, setSel] = useState<string[]>(() => ready.slice(0, ct.tutorial ? 2 : 3).map((m) => m.id));
  const [recon, setRecon] = useState(ct.tutorial ? 1 : 0);
  const toggle = (id: string) => { audio.sfx('click'); setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id])); };
  const cost = casingCost(camp, ct, recon); const can = camp.cash >= cost && sel.length > 0;
  const opts = [
    { l: 0, n: 'Walk in blind', d: 'Only room layout and the target location. Doors, cameras, lasers and guards are discovered the hard way.' },
    { l: 1, n: 'Scout the joint', d: 'Reveals doors, cameras, lasers, terminals and loot.' },
    { l: 2, n: 'Full casing', d: 'Everything above plus guard patrol routes and live guard tracking.' },
  ];
  const tier = heatTier(camp.heat);
  return (
    <div className="h-full overflow-auto scroll grid-bg p-3">
      <div className="max-w-5xl mx-auto grid lg:grid-cols-5 gap-3">
        <Panel className="lg:col-span-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="text-5xl">{V.icon}</div>
            <div className="flex-1 min-w-[200px]"><div className="noir text-3xl text-white">{V.name}</div><div className="text-sm opacity-80">{V.blurb} Client: {ct.client}.</div><div className="mt-1"><Stars n={ct.tier} max={5} /> <span className="text-xs opacity-60 ml-2">Target: ★ {ct.targetName}</span></div></div>
            <div className="text-right"><div className="text-xs opacity-60 uppercase tracking-widest">Payout</div><div className="text-3xl font-bold text-[#5cf0a8]">{fmt(ct.fee)}</div><div className="text-xs opacity-60">+20% per bonus star</div></div>
          </div>
          <div className="mt-2 text-xs flex flex-wrap gap-x-4 gap-y-1 opacity-80">
            <span>Loot: {V.loot.map((l) => `${LOOT[l].icon} ${LOOT[l].name}`).join(', ')}</span>
            <span style={{ color: HEAT_TIERS[tier].color }}>Heat {HEAT_TIERS[tier].name}: {camp.heat >= 25 ? `+${(camp.heat >= 25 ? 1 : 0) + (camp.heat >= 60 ? 1 : 0)} guard(s)` : 'no extra guards'}{camp.heat >= 40 ? `, +${(camp.heat >= 40 ? 1 : 0) + (camp.heat >= 70 ? 1 : 0)} camera(s)` : ''}</span>
            <span>Time limit before neighbors call the cops: {Math.round(V.time / 60 * 10) / 10} min</span>
          </div>
        </Panel>
        <Panel title={`Crew (${sel.length}/4)`} className="lg:col-span-3">
          <div className="grid sm:grid-cols-2 gap-2">
            {camp.crew.map((m) => {
              const d = CREW[m.kind]; const on = sel.includes(m.id); const dis = m.status !== 'ready';
              return (
                <button key={m.id} disabled={dis} onClick={() => toggle(m.id)} className={`panel p-2 text-left flex gap-2 items-center transition ${on ? 'ring-2 ring-[#ffb347]' : ''} ${dis ? 'opacity-40' : 'hover:brightness-125'}`}>
                  <span className="text-2xl w-10 h-10 rounded-full flex items-center justify-center" style={{ background: d.color + '33', border: `2px solid ${d.color}` }}>{d.icon}</span>
                  <span className="flex-1 text-xs"><b className="text-white text-sm">{m.name}</b> Lv{m.level}<br />{d.name} · carry {d.cap} · HP {d.hp}<br /><span className="opacity-60">{dis ? `In custody (${m.custodyDays}d)` : d.perk}</span></span>
                  <span className="text-lg">{on ? '☑' : '☐'}</span>
                </button>
              );
            })}
          </div>
          <div className="text-xs opacity-70 mt-2">Tip: bring a Hacker for electronics, a Ghost for locks, and someone who can carry. Gadgets owned: {GADGET_IDS.map((g) => `${GADGETS[g].icon}×${camp.gadgets[g]}`).join('  ')}</div>
        </Panel>
        <Panel title="Intel" className="lg:col-span-2">
          <div className="space-y-2">
            {opts.map((o) => (
              <button key={o.l} onClick={() => { audio.sfx('select'); setRecon(o.l); }} className={`panel p-2 w-full text-left ${recon === o.l ? 'ring-2 ring-[#6ee7ff]' : 'opacity-80'}`}>
                <div className="flex justify-between"><b className="text-white">{o.n}</b><span className="text-[#ffd35c]">{casingCost(camp, ct, o.l) === 0 ? 'Free' : fmt(casingCost(camp, ct, o.l))}</span></div>
                <div className="text-xs opacity-75">{o.d}</div>
              </button>
            ))}
          </div>
        </Panel>
        <div className="lg:col-span-5 flex justify-between gap-2 flex-wrap">
          <Btn variant="ghost" onClick={onBack}>◀ Back to HQ</Btn>
          <Btn variant="primary" disabled={!can} onClick={() => onBegin(sel, recon)}>{!sel.length ? 'Pick at least one crew' : !can ? 'Cannot afford casing' : `Open Blueprint ▶ ${cost ? `(${fmt(cost)})` : ''}`}</Btn>
        </div>
      </div>
    </div>
  );
}
