import { useState } from 'react';
import { Btn, Panel, Stardust, UnitIcon } from './ui';
import { Save, nameFor } from '../game/save';
import { PROMOS, PROMO_BY_ID, PROMO_COST, PlayableType, RESEARCH, UNITS, XP_TIERS, computeStats, Promo } from '../game/data';
import { audio } from '../game/audio';

const ROSTER_CAP = 14;
const BUYABLE: PlayableType[] = ['mote', 'sling', 'prism', 'bulwark', 'singularity'];

export function Barracks({ save, update, onBack, onHelp }: { save: Save; update: (fn: (s: Save) => Save) => void; onBack: () => void; onHelp: () => void }) {
  const [selId, setSelId] = useState<string>(save.roster[0]?.id || '');
  const sel = save.roster.find((r) => r.id === selId) || save.roster[0];
  const tier = sel ? sel.promo.length : 0;
  const nextXp = sel && tier < XP_TIERS.length ? XP_TIERS[tier] : null;
  const ready = !!sel && nextXp !== null && sel.xp >= nextXp;
  const cost = PROMO_COST[tier] ?? 0;

  const promote = (p: Promo) => {
    if (!sel || !ready || save.stardust < cost) return;
    audio.sfx('promote');
    update((s) => ({
      ...s,
      stardust: s.stardust - cost,
      roster: s.roster.map((r) => (r.id === sel.id ? { ...r, promo: [...r.promo, p.id] } : r)),
    }));
  };
  const buy = (t: PlayableType) => {
    const d = UNITS[t];
    if (save.stardust < d.cost || save.roster.length >= ROSTER_CAP) {
      audio.sfx('error');
      return;
    }
    audio.sfx('buy');
    update((s) => ({
      ...s,
      stardust: s.stardust - d.cost,
      nextId: s.nextId + 1,
      roster: [...s.roster, { id: 'u' + s.nextId, type: t, name: nameFor(s.nextId), xp: 0, promo: [], kills: 0 }],
    }));
  };
  const dismiss = () => {
    if (!sel || sel.type === 'core') return;
    audio.sfx('buy');
    const refund = Math.floor(UNITS[sel.type].cost / 2);
    update((s) => ({ ...s, stardust: s.stardust + refund, roster: s.roster.filter((r) => r.id !== sel.id) }));
    setSelId(save.roster[0]?.id || '');
  };

  const stats = sel ? computeStats(sel.type, sel.promo) : null;
  const tree = sel ? PROMOS[sel.type] : null;
  const branch = sel && sel.promo.length ? (sel.promo[0].endsWith('a1') ? 'a' : 'b') : null;

  const node = (p: Promo, b: 'a' | 'b', idx: number) => {
    const taken = !!sel && sel.promo.includes(p.id);
    const canPick = !!sel && ready && idx === tier && (branch === null || branch === b);
    const affordable = save.stardust >= cost;
    return (
      <button
        key={p.id}
        disabled={!canPick || !affordable}
        onClick={() => promote(p)}
        className={`w-full rounded-lg border p-2 text-left text-xs transition ${
          taken ? 'border-amber-300 bg-amber-300/15' : canPick && affordable ? 'border-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/25' : 'border-slate-700 bg-slate-900/50 opacity-70'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{taken ? '★ ' : ''}{p.name}</span>
          <span className="text-slate-400">Tier {idx + 1}</span>
        </div>
        <div className="text-slate-300">{p.desc}</div>
        {canPick && <div className={`mt-1 font-semibold ${affordable ? 'text-amber-200' : 'text-rose-300'}`}>Promote: ✦ {cost}</div>}
      </button>
    );
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top,#141a3d,#05060f_70%)] p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold tracking-widest text-white sm:text-3xl">BARRACKS</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-amber-300/40 bg-slate-900/70 px-3 py-1.5 text-lg"><Stardust n={save.stardust} /></span>
            <Btn onClick={onHelp}>Help</Btn>
            <Btn variant="primary" onClick={onBack}>← Map</Btn>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Panel title={`Roster ${save.roster.length}/${ROSTER_CAP}`} className="p-3">
            <div className="mt-1 flex max-h-[420px] flex-col gap-1.5 overflow-y-auto pr-1">
              {save.roster.map((r) => {
                const rdy = r.promo.length < XP_TIERS.length && r.xp >= XP_TIERS[r.promo.length];
                return (
                  <button
                    key={r.id}
                    onClick={() => { audio.sfx('click'); setSelId(r.id); }}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left ${sel?.id === r.id ? 'border-cyan-300 bg-cyan-400/15' : 'border-slate-700 bg-slate-900/60 hover:border-slate-400'}`}
                  >
                    <UnitIcon type={r.type} size={30} />
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">{r.name} <span className="text-xs font-normal text-slate-400">{UNITS[r.type].name}</span></div>
                      <div className="text-[11px] text-slate-400">XP {r.xp} · {r.kills} kills</div>
                    </div>
                    <span className="text-amber-300">{'★'.repeat(r.promo.length)}</span>
                    {rdy && <span className="animate-pulse rounded bg-emerald-400/20 px-1.5 text-[10px] font-bold text-emerald-300">PROMO</span>}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 border-t border-slate-700 pt-2">
              <div className="mb-1 text-xs uppercase tracking-widest text-slate-400">Recruit</div>
              <div className="grid grid-cols-1 gap-1.5">
                {BUYABLE.map((t) => {
                  const d = UNITS[t];
                  const locked = save.cleared < d.unlock;
                  return (
                    <div key={t} className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/50 p-1.5">
                      <UnitIcon type={t} size={26} />
                      <div className="flex-1 text-xs">
                        <span className="font-semibold text-white">{d.name}</span>{' '}
                        <span className="text-slate-400">m{d.mass} HP{d.hp} ATK{d.atk}</span>
                      </div>
                      {locked ? (
                        <span className="text-[11px] text-slate-500">Clear battle {d.unlock}</span>
                      ) : (
                        <Btn small variant="gold" disabled={save.stardust < d.cost || save.roster.length >= ROSTER_CAP} onClick={() => buy(t)}>✦ {d.cost}</Btn>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </Panel>
          {sel && stats && tree && (
            <Panel title="Service Record" className="p-4">
              <div className="mt-2 flex items-center gap-4">
                <UnitIcon type={sel.type} size={64} />
                <div className="flex-1">
                  <div className="font-display text-xl font-bold text-white">{sel.name}</div>
                  <div className="text-sm text-slate-400">{UNITS[sel.type].name} ({UNITS[sel.type].role}) · {sel.kills} kills</div>
                  <div className="mt-1 text-sm text-cyan-200">Mass {stats.mass} · HP {stats.hp} · ATK {stats.atk} · Move {stats.move.toFixed(1)} · Range {UNITS[sel.type].adirs === 'knight' ? 'L' : stats.range} · Armor {stats.armor}</div>
                  {stats.flags.length > 0 && <div className="text-xs text-fuchsia-300">Traits: {stats.flags.join(', ')}</div>}
                </div>
                {sel.type !== 'core' && <Btn small variant="danger" onClick={dismiss}>Dismiss +✦{Math.floor(UNITS[sel.type].cost / 2)}</Btn>}
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>XP {sel.xp}{nextXp !== null ? ` / ${nextXp}` : ' (max rank)'}</span>
                  <span>{sel.promo.map((p) => PROMO_BY_ID[p]?.name).join(' → ') || 'Unpromoted'}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded bg-slate-800">
                  <div className="h-full bg-gradient-to-r from-cyan-400 to-fuchsia-400 transition-all" style={{ width: `${nextXp ? Math.min(100, (sel.xp / nextXp) * 100) : 100}%` }} />
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="text-xs uppercase tracking-widest text-cyan-300">Branch A</div>
                  {tree.a.map((p, i) => node(p, 'a', i))}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="text-xs uppercase tracking-widest text-fuchsia-300">Branch B</div>
                  {tree.b.map((p, i) => node(p, 'b', i))}
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500">Earn XP by hitting and killing enemies. Tier 1 needs {XP_TIERS[0]} XP, tier 2 needs {XP_TIERS[1]} XP. Branches cannot be mixed.</p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

export function Research({ save, update, onBack, onHelp }: { save: Save; update: (fn: (s: Save) => Save) => void; onBack: () => void; onHelp: () => void }) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top,#141a3d,#05060f_70%)] p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold tracking-widest text-white sm:text-3xl">GRAVITY LAB</h2>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-amber-300/40 bg-slate-900/70 px-3 py-1.5 text-lg"><Stardust n={save.stardust} /></span>
            <Btn onClick={onHelp}>Help</Btn>
            <Btn variant="primary" onClick={onBack}>← Map</Btn>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {RESEARCH.map((r) => {
            const lvl = save.research[r.id] || 0;
            const maxed = lvl >= r.max;
            const cost = r.cost[lvl];
            return (
              <Panel key={r.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="font-display text-base font-bold text-white">{r.name}</div>
                  <div className="flex gap-1">
                    {Array.from({ length: r.max }).map((_, i) => (
                      <span key={i} className={`h-3 w-3 rounded-full border ${i < lvl ? 'border-cyan-200 bg-cyan-300 shadow-[0_0_8px_#4ff0ff]' : 'border-slate-500'}`} />
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-sm text-slate-300">{r.desc}</p>
                <div className="mt-3 flex justify-end">
                  {maxed ? (
                    <span className="text-sm font-semibold text-emerald-300">MAXED</span>
                  ) : (
                    <Btn
                      variant="gold"
                      disabled={save.stardust < cost}
                      onClick={() => {
                        audio.sfx('buy');
                        update((s) => ({ ...s, stardust: s.stardust - cost, research: { ...s.research, [r.id]: (s.research[r.id] || 0) + 1 } }));
                      }}
                    >
                      Research ✦ {cost}
                    </Btn>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
