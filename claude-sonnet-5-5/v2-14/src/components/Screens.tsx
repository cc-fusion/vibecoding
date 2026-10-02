import { useMemo, useState } from 'react';
import { DIFFS, MODS, PERKS, WORLDS } from '../game/data';
import type { Meta } from '../game/save';
import type { RunConfig } from '../game/sim';
import { Btn, cx, fmt } from './ui';

function Stars() {
  const stars = useMemo(
    () => Array.from({ length: 140 }, () => ({ x: Math.random() * 100, y: Math.random() * 100, r: Math.random() * 1.4 + 0.3, o: Math.random() * 0.7 + 0.2 })),
    [],
  );
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
      {stars.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.12} fill="#fff" opacity={s.o} />)}
    </svg>
  );
}

export function TitleScreen(props: { meta: Meta; onNew: () => void; onLegacy: () => void; onHelp: () => void; onSettings: () => void }) {
  const best = Object.values(props.meta.bests).sort((a, b) => b.score - a.score)[0];
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_30%_20%,#14203a,#04060c_70%)]">
      <Stars />
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-8 overflow-y-auto px-6 py-8 md:flex-row md:justify-between">
        <div className="max-w-md space-y-5 text-center md:text-left">
          <div>
            <div className="text-xs uppercase tracking-[0.5em] text-cyan-300/80">Atmospheric Engineering Simulator</div>
            <h1 className="mt-2 bg-gradient-to-r from-amber-200 via-orange-300 to-emerald-300 bg-clip-text text-5xl font-bold leading-tight text-transparent sm:text-6xl">Terraform<br />Ledger</h1>
          </div>
          <p className="text-slate-300">Tune gases, temperature and the water cycle. Melt the ice, thicken the air, seed life, and survive the sky's revenge. Make a dead world live before your charter expires.</p>
          <div className="grid gap-2">
            <Btn variant="primary" className="!py-3 !text-base" onClick={props.onNew}>🚀 New Expedition</Btn>
            <div className="grid grid-cols-3 gap-2">
              <Btn onClick={props.onLegacy}>🏛️ Legacy ({props.meta.lp})</Btn>
              <Btn onClick={props.onHelp}>📖 Manual</Btn>
              <Btn onClick={props.onSettings}>⚙ Settings</Btn>
            </div>
          </div>
          <div className="flex justify-center gap-4 text-xs text-slate-400 md:justify-start">
            <span>Runs {props.meta.runs}</span><span>Wins {props.meta.wins}</span>
            {best && <span>Best {fmt(best.score)} pts</span>}
          </div>
        </div>
        <div className="float-y relative shrink-0">
          <div className="planet h-56 w-56 rounded-full shadow-[0_0_80px_rgba(255,140,80,0.35),inset_-30px_-20px_60px_rgba(0,0,0,0.7)] sm:h-72 sm:w-72 md:h-80 md:w-80" />
          <div className="pointer-events-none absolute -right-6 top-6 text-3xl opacity-80">☄️</div>
          <div className="pointer-events-none absolute -left-4 bottom-10 text-2xl opacity-80">🛰️</div>
        </div>
      </div>
    </div>
  );
}

export function SetupScreen(props: { meta: Meta; onStart: (c: RunConfig, diff: string, mods: string[], world: string) => void; onBack: () => void; onUnlock: (id: string) => void }) {
  const { meta } = props;
  const [world, setWorld] = useState(meta.unlocked.includes(meta.lastWorld) ? meta.lastWorld : 'rusthaven');
  const [diff, setDiff] = useState(meta.lastDiff);
  const [mods, setMods] = useState<string[]>(meta.lastMods);
  const [seed, setSeed] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const wd = WORLDS.find((w) => w.id === world) ?? WORLDS[0];
  const mult = mods.reduce((a, m) => a * (MODS.find((q) => q.id === m)?.lp ?? 1), DIFFS.find((d) => d.id === diff)?.lp ?? 1);
  return (
    <div className="relative h-full w-full overflow-y-auto bg-[radial-gradient(ellipse_at_70%_10%,#14203a,#04060c_70%)]">
      <Stars />
      <div className="relative z-10 mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-cyan-100">Plan your expedition</h2>
          <Btn onClick={props.onBack}>← Back</Btn>
        </div>
        <section>
          <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">World</div>
          <div className="grid gap-3 md:grid-cols-3">
            {WORLDS.map((w) => {
              const open = meta.unlocked.includes(w.id);
              return (
                <div key={w.id} className={cx('rounded-xl border p-3 transition', world === w.id && open ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/10 bg-white/5', !open && 'opacity-80')}>
                  <button type="button" disabled={!open} onClick={() => setWorld(w.id)} className="block w-full text-left disabled:cursor-not-allowed">
                    <div className="flex items-center gap-2 text-lg font-bold"><span className="text-2xl">{w.icon}</span>{w.name}</div>
                    <div className="text-[11px] uppercase tracking-wide text-amber-200">{w.tag}</div>
                    <p className="mt-1 text-xs text-slate-300">{w.desc}</p>
                    <div className="mt-2 flex flex-wrap gap-x-3 text-[11px] text-slate-400">
                      <span>☀ {Math.round(w.s0 * 100)}% flux</span><span>🌫 {w.n2 + w.co2} kPa</span><span>CO₂ {w.co2}</span><span>🌡 {w.startT}°C</span>
                    </div>
                  </button>
                  {!open && (
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-400">🔒 Win {WORLDS.find((q) => q.id === w.unlockBy)?.name} or pay</span>
                      <Btn small variant="good" disabled={meta.lp < w.unlockCost} onClick={() => props.onUnlock(w.id)}>Unlock {w.unlockCost} LP</Btn>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section className="grid gap-5 md:grid-cols-2">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">Difficulty</div>
            <div className="grid gap-2">
              {DIFFS.map((d) => (
                <button key={d.id} type="button" onClick={() => setDiff(d.id)} className={cx('rounded-lg border p-2.5 text-left transition', diff === d.id ? 'border-cyan-300 bg-cyan-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                  <div className="flex justify-between"><b>{d.name}</b><span className="text-xs text-slate-400">{d.charter} yrs · {Math.round(d.winH * 100)}% hab · {d.popGoal} pop · ×{d.lp} LP</span></div>
                  <div className="text-xs text-slate-400">{d.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">Modifiers (bonus Legacy Points)</div>
            <div className="grid gap-2">
              {MODS.map((m) => {
                const on = mods.includes(m.id);
                return (
                  <button key={m.id} type="button" onClick={() => setMods(on ? mods.filter((q) => q !== m.id) : [...mods, m.id])} className={cx('flex items-center gap-3 rounded-lg border p-2.5 text-left transition', on ? 'border-amber-300 bg-amber-400/10' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
                    <span className="text-2xl">{m.icon}</span>
                    <span className="flex-1"><b>{m.name}</b> <span className="text-xs text-amber-200">×{m.lp}</span><div className="text-xs text-slate-400">{m.desc}</div></span>
                    <span className={on ? 'text-amber-300' : 'text-slate-600'}>{on ? '◉' : '○'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <section className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <label className="text-sm">
            <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Planet seed (shareable)</div>
            <div className="flex gap-2">
              <input value={seed} onChange={(e) => setSeed(e.target.value.toUpperCase().slice(0, 12))} className="w-40 rounded-lg border border-white/15 bg-black/40 px-3 py-2 font-mono text-cyan-100 outline-none focus:border-cyan-300" />
              <Btn onClick={() => setSeed(Math.random().toString(36).slice(2, 8).toUpperCase())}>🎲</Btn>
            </div>
          </label>
          <div className="text-right text-xs text-slate-400">
            Perks active: {PERKS.filter((p) => (meta.perks[p.id] ?? 0) > 0).map((p) => `${p.icon}${meta.perks[p.id]}`).join(' ') || 'none'}
            <div className="text-amber-200">Legacy multiplier ×{mult.toFixed(2)}</div>
          </div>
          <Btn variant="primary" className="!px-8 !py-3 !text-base" onClick={() => props.onStart({ world: wd.id, diff, mods, seed: seed || 'MARS', perks: meta.perks }, diff, mods, wd.id)}>
            Begin Terraforming →
          </Btn>
        </section>
      </div>
    </div>
  );
}

export function LegacyScreen(props: { meta: Meta; onBuy: (id: string) => void; onUnlock: (id: string) => void; onBack: () => void }) {
  const { meta } = props;
  const bests = Object.entries(meta.bests);
  return (
    <div className="relative h-full w-full overflow-y-auto bg-[radial-gradient(ellipse_at_50%_0%,#1b2a48,#04060c_70%)]">
      <Stars />
      <div className="relative z-10 mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-cyan-100">🏛️ Legacy Archive</h2>
            <p className="text-sm text-slate-400">Earn Legacy Points from every run — win or lose — and invest them in permanent perks.</p>
          </div>
          <div className="text-right"><div className="text-xs text-slate-400">Available</div><div className="text-3xl font-bold text-amber-200">{meta.lp} LP</div></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PERKS.map((p) => {
            const lvl = meta.perks[p.id] ?? 0;
            const cost = p.cost * (lvl + 1);
            const maxed = lvl >= p.max;
            return (
              <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center gap-2"><span className="text-2xl">{p.icon}</span><b className="flex-1">{p.name}</b>
                  <span className="flex gap-0.5">{Array.from({ length: p.max }, (_, k) => <i key={k} className={cx('h-2 w-4 rounded-sm', k < lvl ? 'bg-cyan-300' : 'bg-white/15')} />)}</span></div>
                <p className="mt-1 text-xs text-slate-400">{p.desc}</p>
                <div className="mt-2 flex justify-end"><Btn small variant="primary" disabled={maxed || meta.lp < cost} onClick={() => props.onBuy(p.id)}>{maxed ? 'Maxed' : `Upgrade · ${cost} LP`}</Btn></div>
              </div>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">Worlds</div>
            {WORLDS.map((w) => {
              const open = meta.unlocked.includes(w.id);
              return (
                <div key={w.id} className="mb-1.5 flex items-center justify-between text-sm"><span>{w.icon} {w.name}</span>
                  {open ? <span className="text-emerald-300">Unlocked</span> : <Btn small variant="good" disabled={meta.lp < w.unlockCost} onClick={() => props.onUnlock(w.id)}>Unlock · {w.unlockCost} LP</Btn>}
                </div>
              );
            })}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="mb-2 text-xs uppercase tracking-wider text-slate-400">Personal bests</div>
            {bests.length === 0 && <div className="text-sm text-slate-500">No runs recorded yet.</div>}
            {bests.map(([k, b]) => (
              <div key={k} className="mb-1 flex justify-between text-xs text-slate-300">
                <span>{b.win ? '🏆' : '·'} {b.world} / {b.diff}</span><span>{fmt(b.score)} pts · {Math.round(b.peakH * 100)}% · {b.years.toFixed(0)}y</span>
              </div>
            ))}
            <div className="mt-2 text-[11px] text-slate-500">Total years terraformed: {fmt(meta.totalYears)} · Wins {meta.wins}/{meta.runs}</div>
          </div>
        </div>
        <div className="flex justify-end"><Btn onClick={props.onBack}>← Back</Btn></div>
      </div>
    </div>
  );
}
