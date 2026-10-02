import { Btn, Panel, Stars, Stardust, UnitIcon } from './ui';
import { Save, Settings } from '../game/save';
import { DIFFS, LEVELS, LevelDef, MODS, UNITS, UType, computeStats } from '../game/data';

const OBJ: Record<string, string> = { king: 'Destroy the Core', annihilate: 'Eliminate all', survive: 'Survive' };

export function Campaign({
  save, onSelect, onNav,
}: {
  save: Save;
  onSelect: (l: LevelDef) => void;
  onNav: (s: 'title' | 'barracks' | 'research' | 'help' | 'settings') => void;
}) {
  const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top,#141a3d,#05060f_70%)] p-3 sm:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-widest text-white sm:text-3xl">CAMPAIGN MAP</h2>
            <p className="text-sm text-slate-400">Ten sectors between you and the Event Horizon. ★ {totalStars}/30</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-amber-300/40 bg-slate-900/70 px-3 py-1.5 text-lg"><Stardust n={save.stardust} /></span>
            <Btn onClick={() => onNav('barracks')} variant="gold">Barracks</Btn>
            <Btn onClick={() => onNav('research')} variant="gold">Research</Btn>
            <Btn onClick={() => onNav('help')}>Help</Btn>
            <Btn onClick={() => onNav('settings')}>Settings</Btn>
            <Btn onClick={() => onNav('title')}>Title</Btn>
          </div>
        </div>
        {save.campaignDone && (
          <div className="rounded-lg border border-amber-300/60 bg-amber-300/10 p-3 text-center text-amber-100">
            ★ The Event Horizon is broken. Space is flat again. Replay any sector on Admiral with modifiers for a higher score. ★
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {LEVELS.map((l) => {
            const unlocked = l.id <= save.cleared + 1;
            const cleared = l.id <= save.cleared;
            const stars = save.stars[l.id] || 0;
            const current = l.id === save.cleared + 1;
            return (
              <button
                key={l.id}
                disabled={!unlocked}
                onClick={() => onSelect(l)}
                className={`group relative flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                  unlocked ? 'border-cyan-400/40 bg-slate-900/70 hover:-translate-y-1 hover:border-cyan-200 hover:bg-slate-800/80' : 'cursor-not-allowed border-slate-700/50 bg-slate-900/40 opacity-50'
                } ${current ? 'shadow-[0_0_24px_rgba(79,240,255,0.45)]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl font-black text-cyan-300/90">{String(l.id).padStart(2, '0')}</span>
                  {l.boss && <span className="rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-rose-200">BOSS</span>}
                  {!unlocked && <span className="text-lg">🔒</span>}
                </div>
                <div className="font-semibold leading-tight text-white">{l.name}</div>
                <div className="text-xs text-slate-400">{l.subtitle}</div>
                <div className="mt-1 text-xs text-fuchsia-300">
                  {OBJ[l.obj]}{l.obj === 'survive' ? ` ${l.surviveRounds} rounds` : ''}
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <Stars n={stars} />
                  {cleared && save.bestRounds[l.id] ? <span className="text-[11px] text-slate-500">best {save.bestRounds[l.id]}r</span> : current ? <span className="text-[11px] text-cyan-300">NEXT</span> : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const TCOL: Record<string, string> = { '.': '#111737', '#': '#4a5070', N: '#3a2468', W: '#1b4a9a', R: '#9a5a1b', H: '#000' };
const TSYM: Record<string, string> = { '.': '', '#': '▲', N: '≈', W: '◎', R: '✺', H: '●' };

export function Briefing({
  save, lvl, deployed, setDeployed, setSettings, onStart, onBack, onHelp,
}: {
  save: Save;
  lvl: LevelDef;
  deployed: string[];
  setDeployed: (d: string[]) => void;
  setSettings: (s: Settings) => void;
  onStart: () => void;
  onBack: () => void;
  onHelp: () => void;
}) {
  const s = save.settings;
  const diff = DIFFS.find((d) => d.id === s.diff) || DIFFS[1];
  const mult = diff.reward * (1 + s.mods.reduce((a, m) => a + (MODS.find((x) => x.id === m)?.bonus || 0), 0));
  const counts: Partial<Record<UType, number>> = {};
  lvl.enemies.forEach(([t]) => (counts[t] = (counts[t] || 0) + 1));
  const toggle = (id: string, isCore: boolean) => {
    if (isCore) return;
    if (deployed.includes(id)) setDeployed(deployed.filter((d) => d !== id));
    else if (deployed.length < lvl.deploy) setDeployed([...deployed, id]);
  };
  const enemyAt = new Map(lvl.enemies.map(([t, x, y]) => [x + ',' + y, t]));
  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-[radial-gradient(ellipse_at_top,#141a3d,#05060f_70%)] p-3 sm:p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <Panel className="p-4" title={`Battle ${lvl.id} · ${lvl.subtitle}`}>
          <h2 className="font-display text-2xl font-bold text-white">{lvl.name}</h2>
          <p className="mt-1 text-sm text-slate-300">{lvl.story}</p>
          <p className="mt-2 text-sm text-fuchsia-300">
            Objective: {OBJ[lvl.obj]}{lvl.obj === 'survive' ? ` ${lvl.surviveRounds} rounds` : ''} · Par {lvl.par} rounds
          </p>
          <div className="mx-auto mt-3 grid w-full max-w-[320px] gap-px rounded border border-slate-600 bg-slate-700" style={{ gridTemplateColumns: `repeat(${lvl.map[0].length}, 1fr)` }}>
            {lvl.map.flatMap((row, y) =>
              row.split('').map((c, x) => {
                const e = enemyAt.get(x + ',' + y);
                return (
                  <div key={x + '-' + y} className="relative flex aspect-square items-center justify-center text-[11px] text-slate-200" style={{ background: TCOL[c] }}>
                    {e ? <UnitIcon type={e} team="e" size={20} /> : TSYM[c]}
                    {y >= lvl.map.length - 2 && !e && c === '.' && <span className="absolute inset-0 bg-cyan-400/10" />}
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-1 text-center text-[11px] text-slate-500">▲ asteroid ≈ nebula ◎ well ✺ repulsor ● black hole · cyan-tinted rows = your deployment zone</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(counts) as UType[]).map((t) => (
              <span key={t} className="flex items-center gap-1 rounded bg-slate-800/70 px-2 py-1 text-xs text-slate-200">
                <UnitIcon type={t} team="e" size={18} /> {UNITS[t].name} ×{counts[t]}
              </span>
            ))}
            {lvl.reinf && <span className="rounded bg-rose-500/20 px-2 py-1 text-xs text-rose-200">Reinforcements every {lvl.reinf.every} rounds</span>}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel className="p-4" title={`Deploy (${deployed.length}/${lvl.deploy})`}>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {save.roster.map((r) => {
                const isCore = r.type === 'core';
                const on = isCore || deployed.includes(r.id);
                const st = computeStats(r.type, r.promo);
                return (
                  <button
                    key={r.id}
                    onClick={() => toggle(r.id, isCore)}
                    className={`flex items-center gap-2 rounded-lg border p-2 text-left transition ${on ? 'border-cyan-300 bg-cyan-400/15' : 'border-slate-600/60 bg-slate-900/60 hover:border-slate-300'} ${!on && deployed.length >= lvl.deploy ? 'opacity-40' : ''}`}
                  >
                    <UnitIcon type={r.type} size={34} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">
                        {r.name} <span className="text-xs font-normal text-slate-400">{UNITS[r.type].name}</span>
                      </div>
                      <div className="text-[11px] text-cyan-200">m{st.mass} · HP {st.hp} · ATK {st.atk} · XP {r.xp}</div>
                    </div>
                    <span className="text-amber-300">{'★'.repeat(r.promo.length)}</span>
                    {isCore && <span className="text-[10px] text-slate-400">REQ</span>}
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel className="p-4" title="Difficulty & Modifiers">
            <div className="mt-2 grid grid-cols-3 gap-2">
              {DIFFS.map((d) => (
                <Btn key={d.id} active={s.diff === d.id} variant={s.diff === d.id ? 'primary' : 'ghost'} onClick={() => setSettings({ ...s, diff: d.id })}>{d.name}</Btn>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-400">{diff.desc}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {MODS.map((m) => {
                const on = s.mods.includes(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => setSettings({ ...s, mods: on ? s.mods.filter((x) => x !== m.id) : [...s.mods, m.id] })}
                    className={`rounded-lg border p-2 text-left text-xs transition ${on ? 'border-fuchsia-300 bg-fuchsia-500/15' : 'border-slate-600/60 bg-slate-900/60 hover:border-slate-300'}`}
                  >
                    <div className="text-sm font-semibold text-white">{m.name} <span className="text-amber-300">+{Math.round(m.bonus * 100)}%</span></div>
                    <div className="text-slate-400">{m.desc}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-amber-200">Reward multiplier: ×{mult.toFixed(2)}</p>
          </Panel>
          <div className="flex flex-wrap justify-between gap-2">
            <Btn onClick={onBack}>← Campaign Map</Btn>
            <div className="flex gap-2">
              <Btn onClick={onHelp}>Help</Btn>
              <Btn variant="primary" onClick={onStart} className="px-8 py-3 text-base">Launch</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
