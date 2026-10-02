import { useState } from 'react';
import { ACTIONS, BIOMES, BUILDINGS, BUILD_MAP, MILESTONES, TECHS, TECH_MAP, TIERS, STAGES, SOIL_CAP, EVENT_INFO } from '../game/data';
import type { ToolId } from '../game/data';
import type { World } from '../game/sim';
import { audio } from '../game/audio';
import { Bar, Btn, cx, fmt, Slider } from './ui';

export const BIOME_COLORS = ['#0b2f6a', '#3fa3c9', '#e2eff9', '#8a6a55', '#9fb3c4', '#d2a15f', '#62826e', '#80965a', '#96b846', '#4c8c4a', '#28703a', '#0e5c3e', '#4e8f7a', '#4a2f2a'];

interface PanelProps { world: World; bump: () => void }

export function BuildPanel({ world, tool, setTool }: PanelProps & { tool: ToolId; setTool: (t: ToolId) => void }) {
  const [hint, setHint] = useState<ToolId | null>(null);
  const unlocked = BUILDINGS.filter((b) => world.has(b.tech));
  const hotkey = (id: string) => {
    const k = unlocked.findIndex((b) => b.id === id);
    return k < 0 ? '' : k === 9 ? '0' : k < 9 ? String(k + 1) : '';
  };
  const sel = hint ?? tool;
  const bdef = BUILD_MAP[sel];
  const adef = ACTIONS.find((a) => a.id === sel);
  const comet = world.cometCost();
  const pick = (t: ToolId) => { audio.sfx('tab'); setTool(t); };
  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
          <span>Structures</span>
          <span>⛏ {fmt(world.mats)}</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {BUILDINGS.map((b) => {
            const locked = !world.has(b.tech);
            const cost = world.costOf(b);
            const afford = world.mats >= cost;
            return (
              <button
                key={b.id}
                type="button"
                onMouseEnter={() => setHint(b.id)}
                onMouseLeave={() => setHint(null)}
                onClick={() => (locked ? audio.sfx('error') : pick(b.id))}
                className={cx(
                  'relative flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition',
                  tool === b.id ? 'border-cyan-300 bg-cyan-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10',
                  locked && 'opacity-45',
                )}
              >
                <span className="text-xl leading-none">{locked ? '🔒' : b.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold leading-tight">{b.name}</span>
                  <span className={cx('block text-[11px]', afford || locked ? 'text-slate-400' : 'text-rose-300')}>
                    ⛏{cost}{b.energy > 0 ? ` · −${b.energy}⚡` : b.energy < 0 ? ` · +${-b.energy}⚡` : ''}
                  </span>
                </span>
                {!locked && hotkey(b.id) && <span className="absolute right-1 top-0.5 text-[10px] text-slate-500">{hotkey(b.id)}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Planetary actions</div>
        <div className="grid grid-cols-2 gap-1.5">
          {ACTIONS.map((a) => {
            const locked = !world.has(a.tech);
            return (
              <button
                key={a.id}
                type="button"
                onMouseEnter={() => setHint(a.id)}
                onMouseLeave={() => setHint(null)}
                onClick={() => (locked ? audio.sfx('error') : pick(a.id))}
                className={cx(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition',
                  tool === a.id ? 'border-amber-300 bg-amber-400/15' : 'border-white/10 bg-white/5 hover:bg-white/10',
                  locked && 'opacity-45',
                )}
              >
                <span className="text-xl leading-none">{locked ? '🔒' : a.icon}</span>
                <span className="truncate text-[13px] font-semibold">{a.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-[13px] leading-snug text-slate-300">
        {bdef && (
          <>
            <div className="mb-1 flex items-center gap-2 font-bold text-white"><span className="text-lg">{bdef.icon}</span>{bdef.name}</div>
            <p>{bdef.desc}</p>
            <p className="mt-1 text-xs text-slate-400">
              Cost ⛏{world.costOf(bdef)}{bdef.energy > 0 ? ` · upkeep ${bdef.energy}⚡/yr` : ''}
              {!world.has(bdef.tech) && ` · requires ${TECH_MAP[bdef.tech ?? '']?.name}`}
            </p>
          </>
        )}
        {adef && (
          <>
            <div className="mb-1 flex items-center gap-2 font-bold text-white"><span className="text-lg">{adef.icon}</span>{adef.name}</div>
            <p>{adef.desc}</p>
            {adef.id === 'comet' && <p className="mt-1 text-xs text-slate-400">Cost ⛏{comet.m} + {comet.e}⚡ · {world.cometCd > 0 ? `recharging ${Math.ceil(world.cometCd / 10)}s` : 'ready'}</p>}
            {adef.tech && !world.has(adef.tech) && <p className="mt-1 text-xs text-slate-400">Requires {TECH_MAP[adef.tech].name}</p>}
          </>
        )}
        <p className="mt-2 text-[11px] text-slate-500">Right-click or Esc cancels the active tool. Click an incoming reticle to intercept (Orbital Lance).</p>
      </div>
    </div>
  );
}

export function TechPanel({ world, bump }: PanelProps) {
  const tiers = [1, 2, 3, 4, 5];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
        <span className="text-slate-300">Research points</span>
        <span className="text-lg font-bold text-sky-300">🔬 {fmt(world.research)}</span>
      </div>
      {tiers.map((tier) => {
        const list = TECHS.filter((t) => t.tier === tier);
        if (!list.length) return null;
        return (
          <div key={tier}>
            <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Tier {tier}</div>
            <div className="space-y-1.5">
              {list.map((t) => {
                const owned = world.techs.has(t.id);
                const reqOk = t.req.every((r) => world.techs.has(r));
                const afford = world.research >= t.cost;
                return (
                  <div key={t.id} className={cx('rounded-lg border p-2.5', owned ? 'border-emerald-400/40 bg-emerald-400/10' : reqOk ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-60')}>
                    <div className="flex items-start gap-2">
                      <span className="text-xl">{t.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">{t.name}</span>
                          {owned ? <span className="text-xs text-emerald-300">✔ Done</span> : <span className={cx('text-xs', afford ? 'text-sky-300' : 'text-rose-300')}>🔬 {t.cost}</span>}
                        </div>
                        <p className="text-xs text-slate-400">{t.desc}</p>
                        {!owned && t.req.length > 0 && <p className="text-[11px] text-slate-500">Requires: {t.req.map((r) => TECH_MAP[r].name).join(', ')}</p>}
                      </div>
                    </div>
                    {!owned && (
                      <div className="mt-1.5 flex justify-end">
                        <Btn small variant={reqOk && afford ? 'primary' : 'ghost'} disabled={!reqOk || !afford} onClick={() => { world.researchTech(t.id); bump(); }}>
                          Research
                        </Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function GasRow({ label, v, max, color, note }: { label: string; v: number; max: number; color: string; note: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="text-slate-300">{label}</span><span className="tabular-nums text-slate-200">{v.toFixed(2)} kPa</span></div>
      <Bar v={v / max} color={color} />
      <div className="text-[10px] text-slate-500">{note}</div>
    </div>
  );
}

function FactorRow({ label, v, good }: { label: string; v: number; good: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-slate-300">{label}</span>
      <Bar v={v} className="flex-1" color={v > 0.85 ? '#5ee0ff' : v > 0.4 ? '#e6c84f' : '#ff7a5a'} />
      <span className="w-9 text-right tabular-nums">{Math.round(v * 100)}%</span>
      <span className="hidden w-24 text-[10px] text-slate-500 xl:block">{good}</span>
    </div>
  );
}

export function PlanetPanel({ world, bump }: PanelProps) {
  const g = world.gas;
  const total = Math.max(1, world.biomeCount.reduce((a, b) => a + b, 0));
  const waterTotal = world.inv.ocean + world.inv.ice + world.inv.vap + world.aquifer;
  const colonies = world.bld.filter((b) => b.kind === 'dome' || b.kind === 'settle');
  const st = STAGES[world.stage];
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-lg bg-white/5 p-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-slate-400">Habitability</div>
            <div className="text-3xl font-bold" style={{ color: st.color }}>{Math.round(world.H * 100)}%</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-400">Stage {world.stage}</div>
            <div className="font-semibold" style={{ color: st.color }}>{st.name}</div>
          </div>
        </div>
        <div className="mt-2 space-y-1.5">
          <FactorRow label="Pressure" v={world.fP} good="≥ 45 kPa" />
          <FactorRow label="Oxygen" v={world.fO} good="16–30 kPa" />
          <FactorRow label="CO₂ safety" v={world.fC} good="< 0.6 kPa" />
          <FactorRow label="Livable land" v={world.cnt.land ? Math.min(1, world.cnt.hab / world.cnt.land / 0.5) : 0} good="≥ 50% land" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs uppercase tracking-wider text-slate-400">
          <span>Atmosphere</span><span>{world.P.toFixed(1)} kPa · {world.avgT.toFixed(1)}°C</span>
        </div>
        <GasRow label="Nitrogen N₂" v={g.n2} max={80} color="#8fb3ff" note="Buffer gas — sets pressure, wind and heat transport" />
        <GasRow label="Carbon dioxide CO₂" v={g.co2} max={20} color="#b5a6ff" note="Greenhouse + toxic above 0.6 kPa · plants eat it" />
        <GasRow label="Oxygen O₂" v={g.o2} max={40} color="#7fe0ff" note="Breathable 16–30 · fire risk climbs past 25" />
        <GasRow label="Halocarbons PFC" v={g.pfc} max={3} color="#ff8a5c" note="Super-greenhouse, decays 1.2%/yr" />
        <div className="text-[11px] text-slate-400">Greenhouse warming: <b className="text-orange-300">+{world.greenhouse.toFixed(1)} K</b> · Humidity {Math.round(world.humidity * 100)}% · Dust {Math.round(world.dust * 100)}%</div>
      </div>

      <div className="rounded-lg bg-white/5 p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
          <span>Orbital mirrors</span>
          <span className="text-slate-200">{world.mirror > 0 ? '+' : ''}{Math.round(world.mirror * 100)}% sun</span>
        </div>
        {world.has('mirror') ? (
          <>
            <Slider label="Insolation dial" value={world.mirror} min={-0.5} max={0.4} step={0.05} suffix={`${Math.round(world.mirror * 100)}% · −${Math.round(Math.abs(world.mirror) * 60)}⚡/yr`} onChange={(v) => { world.setMirror(v); bump(); }} />
            <p className="mt-1 text-[11px] text-slate-500">Positive values warm the whole planet and boost solar output. Negative values shade it — essential on Cinderia.</p>
          </>
        ) : (
          <p className="text-xs text-slate-400">🔒 Research Orbital Mirrors to adjust solar flux.</p>
        )}
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Water inventory</div>
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          {[
            ['🌊 Liquid', world.inv.ocean], ['🧊 Ice', world.inv.ice], ['☁️ Vapor', world.inv.vap], ['🕳️ Aquifer', world.aquifer],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded bg-white/5 px-2 py-1">
              <div className="flex justify-between"><span>{l}</span><span className="tabular-nums">{fmt(v as number, 1)}</span></div>
              <Bar v={(v as number) / Math.max(1, waterTotal)} color="#4aa8ff" />
            </div>
          ))}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">Soil moisture {fmt((world.inv.soil / (SOIL_CAP * 2304)) * 100)}% · Lakes/oceans {world.cnt.water} tiles · Rain {world.cnt.rain} tiles · Burning {world.cnt.fire}</div>
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Biomes</div>
        <div className="flex h-3 overflow-hidden rounded-full">
          {world.biomeCount.map((n, k) => (n > 0 ? <div key={k} title={`${BIOMES[k]}: ${n}`} style={{ width: `${(n / total) * 100}%`, background: BIOME_COLORS[k] }} /> : null))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-slate-400">
          {world.biomeCount.map((n, k) => (n >= 10 ? <span key={k}><i className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: BIOME_COLORS[k] }} />{BIOMES[k]} {n}</span> : null))}
        </div>
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs uppercase tracking-wider text-slate-400">
          <span>Colonies</span><span>👥 {fmt(world.pop)} / {fmt(world.popCap)}</span>
        </div>
        <div className="space-y-1.5">
          {colonies.map((b) => (
            <div key={b.id} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs">
              <div className="flex justify-between">
                <span className="font-semibold">{BUILD_MAP[b.kind].icon} {BUILD_MAP[b.kind].name} ({b.x},{b.y})</span>
                <span className="tabular-nums">👥 {Math.floor(b.pop)}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-slate-400">
                <span>Comfort</span>
                <Bar v={b.eff} className="flex-1" color={b.eff > 0.5 ? '#6bd36b' : b.eff > 0.3 ? '#e6c84f' : '#ff7a5a'} />
                {b.kind === 'settle' && <span className={b.food < 0.7 ? 'text-rose-300' : ''}>🌾 {Math.round(Math.min(1, b.food) * 100)}%</span>}
              </div>
            </div>
          ))}
          {colonies.length === 0 && <div className="text-xs text-rose-300">No colonies remain!</div>}
        </div>
        <div className="mt-1 text-[11px] text-slate-500">Immigration ≈ {world.immigration.toFixed(1)} colonists/yr (grows with habitability)</div>
      </div>
    </div>
  );
}

function Chart({ series, height = 64, min, max }: { series: { d: number[]; c: string }[]; height?: number; min?: number; max?: number }) {
  const w = 300;
  const all = series.flatMap((s) => s.d);
  if (all.length < 2) return <div className="flex h-16 items-center justify-center rounded bg-black/30 text-[11px] text-slate-500">Collecting data…</div>;
  const lo = min ?? Math.min(...all);
  const hi = max ?? Math.max(...all);
  const span = hi - lo || 1;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full rounded bg-black/30" preserveAspectRatio="none" style={{ height }}>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={height * f} y2={height * f} stroke="rgba(255,255,255,0.06)" />)}
      {series.map((s, k) => (
        <polyline
          key={k}
          fill="none"
          stroke={s.c}
          strokeWidth={1.6}
          vectorEffect="non-scaling-stroke"
          points={s.d.map((v, i) => `${(i / (s.d.length - 1)) * w},${height - 3 - ((v - lo) / span) * (height - 6)}`).join(' ')}
        />
      ))}
      <text x={3} y={10} fontSize={9} fill="#8aa">{hi.toFixed(1)}</text>
      <text x={3} y={height - 3} fontSize={9} fill="#8aa">{lo.toFixed(1)}</text>
    </svg>
  );
}

export function LedgerPanel({ world }: PanelProps) {
  const h = world.history;
  const gases: { k: 'n2' | 'co2' | 'o2' | 'pfc'; name: string }[] = [
    { k: 'n2', name: 'N₂' }, { k: 'co2', name: 'CO₂' }, { k: 'o2', name: 'O₂' }, { k: 'pfc', name: 'PFC' },
  ];
  const flowRows = (g: string) => Object.entries(world.flows).filter(([k, v]) => k.startsWith(g + '|') && Math.abs(v) > 0.0005).map(([k, v]) => [k.split('|')[1], v] as [string, number]);
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-slate-400">Climate record</div>
        <div><div className="text-[11px] text-slate-400">Mean temperature °C</div><Chart series={[{ d: h.map((s) => s.T), c: '#ff9a5c' }]} /></div>
        <div><div className="text-[11px] text-slate-400"><span className="text-sky-300">■</span> Pressure kPa · <span className="text-cyan-200">■</span> O₂ · <span className="text-violet-300">■</span> CO₂</div>
          <Chart series={[{ d: h.map((s) => s.P), c: '#7aa8ff' }, { d: h.map((s) => s.o2), c: '#7fe9ff' }, { d: h.map((s) => s.co2), c: '#b5a6ff' }]} min={0} /></div>
        <div><div className="text-[11px] text-slate-400"><span className="text-emerald-300">■</span> Habitability % · <span className="text-amber-200">■</span> Population (scaled)</div>
          <Chart series={[{ d: h.map((s) => s.H * 100), c: '#6bf0a0' }, { d: h.map((s) => Math.min(100, (s.pop / Math.max(1, world.diff.popGoal)) * 100)), c: '#ffd37a' }]} min={0} max={100} /></div>
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Atmospheric balance sheet (kPa / yr)</div>
        <div className="space-y-1.5">
          {gases.map(({ k, name }) => {
            const rows = flowRows(k);
            const net = rows.reduce((a, [, v]) => a + v, 0);
            if (!rows.length) return null;
            return (
              <div key={k} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs">
                <div className="flex justify-between font-semibold"><span>{name}</span><span className={net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>net {net >= 0 ? '+' : ''}{net.toFixed(3)}</span></div>
                {rows.map(([l, v]) => (
                  <div key={l} className="flex justify-between text-slate-400"><span>{l}</span><span className={v >= 0 ? 'text-emerald-300/80' : 'text-rose-300/80'}>{v >= 0 ? '+' : ''}{v.toFixed(3)}</span></div>
                ))}
              </div>
            );
          })}
          {Object.keys(world.flows).length === 0 && <div className="text-xs text-slate-500">Ledger fills in after a year of play.</div>}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-wider text-slate-400">
          <span>Milestones {world.milestones.size}/{MILESTONES.length}</span>
          <button type="button" className="text-cyan-300 hover:underline" onClick={() => setShowAll(!showAll)}>{showAll ? 'hide done' : 'show all'}</button>
        </div>
        <div className="space-y-1">
          {MILESTONES.filter((m) => world.relevant(m.id) && (showAll || !world.milestones.has(m.id))).map((m) => {
            const done = world.milestones.has(m.id);
            return (
              <div key={m.id} className={cx('flex items-start gap-2 rounded px-2 py-1 text-xs', done ? 'bg-emerald-500/10 text-emerald-200' : 'bg-white/5 text-slate-300')}>
                <span>{done ? '★' : '☆'}</span>
                <div className="flex-1"><b>{m.name}</b> <span className="text-slate-400">— {m.desc}</span></div>
                {!done && (m.rewardR > 0 || m.rewardM > 0) && <span className="text-slate-400">{m.rewardR ? `+${m.rewardR}🔬` : ''}{m.rewardM ? ` +${m.rewardM}⛏` : ''}</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wider text-slate-400">Captain's log</div>
        <div className="space-y-1">
          {world.log.slice(0, 25).map((l, k) => (
            <div key={k} className={cx('rounded px-2 py-1 text-xs', l.k === 'bad' ? 'bg-rose-500/10 text-rose-200' : l.k === 'good' ? 'bg-emerald-500/10 text-emerald-200' : l.k === 'warn' ? 'bg-amber-500/10 text-amber-200' : 'bg-white/5 text-slate-300')}>
              <span className="mr-1 tabular-nums text-slate-500">Y{l.y.toFixed(1)}</span>{l.s}
            </div>
          ))}
        </div>
      </div>
      <div className="text-[11px] text-slate-500">Species ladder: {TIERS.slice(1).map((t) => t.name).join(' → ')}. Disasters: {Object.values(EVENT_INFO).map((e) => e.icon).join(' ')}</div>
    </div>
  );
}
