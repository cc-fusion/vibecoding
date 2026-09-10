import { useState } from 'react';
import type { HistorySample } from '@/sim/types';
import type { World } from '@/sim/world';
import { cn } from '@/utils/cn';
import { Section, Stat } from './ui';

type Metric = keyof Omit<HistorySample, 'tick'>;
const METRICS: { key: Metric; label: string }[] = [
  { key: 'population', label: 'Population' },
  { key: 'stored', label: 'Stored food' },
  { key: 'collected', label: 'Collected' },
  { key: 'deaths', label: 'Deaths' },
];

/** Minimal SVG multi-line chart. History is bounded by the world so memory stays flat. */
function Chart({ world, metric }: { world: World; metric: Metric }) {
  const W = 300;
  const H = 90;
  let max = 1;
  let minTick = Infinity;
  let maxTick = -Infinity;
  for (const c of world.colonies)
    for (const h of c.history) {
      if (h[metric] > max) max = h[metric];
      if (h.tick < minTick) minTick = h.tick;
      if (h.tick > maxTick) maxTick = h.tick;
    }
  if (!isFinite(minTick)) return <div className="h-[90px] text-center text-[10px] leading-[90px] text-stone-600">collecting samples…</div>;
  const span = Math.max(1, maxTick - minTick);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[90px] w-full">
      <line x1={0} y1={H - 1} x2={W} y2={H - 1} stroke="#44403c" strokeWidth={1} />
      <text x={2} y={9} fontSize={8} fill="#78716c" fontFamily="monospace">
        {Math.round(max)}
      </text>
      {world.colonies.map((c) => {
        if (c.history.length < 2) return null;
        const d = c.history
          .map((h, i) => {
            const x = ((h.tick - minTick) / span) * W;
            const y = H - 2 - (h[metric] / max) * (H - 12);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');
        return <path key={c.id} d={d} fill="none" stroke={c.traits.color} strokeWidth={1.5} />;
      })}
    </svg>
  );
}

export function StatsPanel({ world }: { world: World }) {
  const [metric, setMetric] = useState<Metric>('population');
  return (
    <div className="space-y-3">
      <Section title="Time series">
        <div className="mb-1 flex gap-1">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetric(m.key)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px]',
                metric === m.key ? 'bg-amber-400/20 text-amber-100' : 'text-stone-400 hover:bg-stone-800',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <Chart world={world} metric={metric} />
        <div className="mt-1 text-[10px] text-stone-500">Sampled once per second of sim time; the last 240 samples are kept.</div>
      </Section>

      {world.colonies.map((c) => {
        const s = c.stats;
        const T = c.traits;
        return (
          <Section
            key={c.id}
            title={T.name}
            right={<span className="h-3 w-3 rounded-full" style={{ background: T.color }} />}
          >
            <div className="grid grid-cols-3 gap-1.5">
              <Stat label="Living" value={s.living} color={T.color} />
              <Stat label="Stored" value={Math.round(c.storedFood)} />
              <Stat label="Collected" value={Math.round(c.totalCollected)} />
              <Stat label="Deaths" value={c.deaths} />
              <Stat label="Kills" value={c.kills} />
              <Stat label="Avg health" value={`${Math.round(s.avgHealth * 100)}%`} />
              <Stat label="Explorers" value={s.explorers} />
              <Stat label="Carrying" value={s.carrying} />
              <Stat label="Fighting" value={s.fighting} />
            </div>
            <div className="mt-1.5 text-[10px] text-stone-400">
              Activity area ≈ <span className="font-mono text-stone-200">{s.territoryCells}</span> cells (
              {((s.territoryArea / (world.width * world.height)) * 100).toFixed(1)}% of map, last 15 s)
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
              <span>spd {T.speed.toFixed(2)}</span>
              <span>hp {T.maxHealth}</span>
              <span>str {T.strength}</span>
              <span>carry {T.carryCapacity}</span>
              <span>sense {T.senseRange}</span>
              <span>explore {T.exploration.toFixed(2)}</span>
              <span>aggr {T.aggression.toFixed(2)}</span>
              <span>energy {T.energyUse.toFixed(2)}</span>
            </div>
          </Section>
        );
      })}
    </div>
  );
}
