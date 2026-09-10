import { useEffect, useRef, useState } from 'react';
import type { HistorySeries } from '../sim/world';
import { CELL } from '../sim/constants';
import { Button, Section, Stat } from './primitives';
import type { SimHandle } from './useSimulation';

type Metric = keyof Omit<HistorySeries, 'time'>;
const METRICS: { key: Metric; label: string }[] = [
  { key: 'living', label: 'Population' },
  { key: 'stored', label: 'Stored food' },
  { key: 'collected', label: 'Collected' },
  { key: 'deaths', label: 'Deaths' },
];

function Graph({ sim, metric }: { sim: SimHandle; metric: Metric }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const { world } = sim;
    let maxV = 1, minT = Infinity, maxT = -Infinity;
    for (const c of world.colonies) {
      const h = world.history.get(c.id);
      if (!h || h.time.length === 0) continue;
      for (const v of h[metric]) if (v > maxV) maxV = v;
      minT = Math.min(minT, h.time[0]);
      maxT = Math.max(maxT, h.time[h.time.length - 1]);
    }
    if (!isFinite(minT) || maxT - minT < 1) {
      ctx.fillStyle = '#57534e';
      ctx.font = '10px ui-monospace, monospace';
      ctx.fillText('collecting samples…', 6, H / 2);
      return;
    }
    // grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (H * i) / 4); ctx.lineTo(W, (H * i) / 4); ctx.stroke();
    }
    for (const c of world.colonies) {
      const h = world.history.get(c.id);
      if (!h || h.time.length < 2) continue;
      ctx.beginPath();
      for (let i = 0; i < h.time.length; i++) {
        const x = ((h.time[i] - minT) / (maxT - minT)) * (W - 2) + 1;
        const y = H - 2 - (h[metric][i] / maxV) * (H - 6);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#a8a29e';
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillText(maxV.toFixed(0), 3, 9);
    ctx.fillText(`${(maxT - minT).toFixed(0)}s`, W - 26, H - 3);
  }, [sim, metric, sim.uiTick]);
  return <canvas ref={ref} className="h-24 w-full rounded bg-stone-950/60" />;
}

export function StatsPanel({ sim }: { sim: SimHandle }) {
  const { world } = sim;
  const [metric, setMetric] = useState<Metric>('collected');
  return (
    <div className="space-y-3 p-3">
      {world.colonies.map((c) => {
        const s = c.stats;
        const terrPct = ((s.territory * CELL * CELL) / (1600 * 1000)) * 100;
        return (
          <Section
            key={c.id}
            title={c.name}
            right={<span className="h-3 w-3 rounded-full" style={{ background: c.color }} />}
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <Stat label="Living ants" value={s.living} />
              <Stat label="Stored food" value={s.storedFood.toFixed(1)} />
              <Stat label="Collected" value={s.collected.toFixed(0)} />
              <Stat label="Trips" value={s.trips} />
              <Stat label="Deaths" value={s.deaths} />
              <Stat label="Kills" value={s.kills} />
              <Stat label="Avg health" value={`${(s.avgHealth * 100).toFixed(0)}%`} />
              <Stat label="Exploring" value={s.explorers} />
              <Stat label="On trail" value={s.followers} />
              <Stat label="Carrying" value={s.carrying} />
              <Stat label="Fighting" value={s.fighting} />
              <Stat label="Territory" value={`${terrPct.toFixed(1)}%`} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-stone-500">
              <span>spd {c.traits.speed}</span>
              <span>hp {c.traits.maxHealth}</span>
              <span>str {c.traits.strength}</span>
              <span>carry {c.traits.carryCapacity}</span>
              <span>expl {c.traits.exploration.toFixed(2)}</span>
              <span>aggr {c.traits.aggression.toFixed(2)}</span>
              <span>sense {c.traits.sensoryRange}</span>
            </div>
          </Section>
        );
      })}

      <Section
        title="Time series"
        right={
          <div className="flex gap-0.5">
            {METRICS.map((m) => (
              <Button key={m.key} active={metric === m.key} onClick={() => setMetric(m.key)} className="px-1.5 py-0.5 text-[10px]">{m.label}</Button>
            ))}
          </div>
        }
      >
        <Graph sim={sim} metric={metric} />
      </Section>

      <Section title="Events">
        <div className="max-h-40 space-y-0.5 overflow-y-auto text-[10px] font-mono">
          {world.events.length === 0 && <div className="text-stone-500">No notable events yet.</div>}
          {[...world.events].reverse().map((e, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-stone-500">{e.time.toFixed(0)}s</span>
              <span style={{ color: e.color }}>{e.text}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
