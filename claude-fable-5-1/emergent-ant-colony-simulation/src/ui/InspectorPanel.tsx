import { STATE_LABELS, foodRadius } from '../sim/ant';
import { NN_OUTPUT_LABELS, TUNING } from '../sim/constants';
import { Bar, Button, Section, Slider, Stat } from './primitives';
import type { SimHandle } from './useSimulation';

function dirLabel(L: number, A: number, R: number, thr: number): string {
  const m = Math.max(L, A, R);
  if (m < thr) return 'none';
  if (m === A) return 'ahead';
  return m === L ? 'left' : 'right';
}

export function InspectorPanel({ sim }: { sim: SimHandle }) {
  const { world, selectedAnt: a, selectedFood: f, selectedNest: n } = sim;

  if (a && a.alive) {
    const col = world.colonyById(a.colonyId)!;
    const s = a.senses;
    const t = col.traits;
    const g = t.pheromoneSensitivity;
    const thr = TUNING.trailThreshold / g;
    const deg = (r: number) => `${Math.round((r * 180) / Math.PI)}°`;
    return (
      <div className="space-y-3 p-3">
        <Section
          title={`Ant #${a.id}`}
          right={<span className="flex items-center gap-1 text-[11px]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />{col.name}</span>}
        >
          <div className="mb-2 rounded bg-stone-800/80 px-2 py-1 text-xs font-semibold text-amber-200">{STATE_LABELS[a.state]}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            <Stat label="Health" value={`${a.health.toFixed(0)} / ${t.maxHealth}`} />
            <Stat label="Energy" value={`${(a.energy * 100).toFixed(0)}%`} />
            <Stat label="Carrying" value={a.carrying.toFixed(1)} />
            <Stat label="Speed" value={`${a.effectiveSpeed.toFixed(0)} u/s`} />
            <Stat label="Strength" value={t.strength.toFixed(1)} />
            <Stat label="Heading" value={deg(a.heading)} />
            <Stat label="Steer intent" value={`${a.lastTurn >= 0 ? '→' : '←'} ${Math.abs(a.lastTurn).toFixed(2)}`} />
            <Stat label="Age" value={`${a.age.toFixed(0)}s`} />
            <Stat label="Food signal" value={a.foodBudget.toFixed(2)} />
            <Stat label="Home signal" value={a.homeBudget.toFixed(2)} />
            <Stat label="Stuck" value={a.stuck.toFixed(2)} />
            <Stat label="Avoid dir" value={a.avoidDir === 0 ? '–' : a.avoidDir > 0 ? 'right' : 'left'} />
          </div>
        </Section>

        <Section title="Local pheromone samples">
          <div className="space-y-1">
            <Bar label={`Food (${dirLabel(s.foodL, s.foodA, s.foodR, thr)})`} value={Math.max(s.foodL, s.foodA, s.foodR)} color={col.color} />
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-stone-400">
              <span>L {s.foodL.toFixed(3)}</span><span className="text-center">A {s.foodA.toFixed(3)}</span><span className="text-right">R {s.foodR.toFixed(3)}</span>
            </div>
            <Bar label={`Home (${dirLabel(s.homeL, s.homeA, s.homeR, thr)})`} value={Math.max(s.homeL, s.homeA, s.homeR)} color="#dbeafe" />
            <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-stone-400">
              <span>L {s.homeL.toFixed(3)}</span><span className="text-center">A {s.homeA.toFixed(3)}</span><span className="text-right">R {s.homeR.toFixed(3)}</span>
            </div>
            <Bar label="Alarm" value={Math.max(s.alarmHere, s.alarmL, s.alarmA, s.alarmR)} color="#f87171" />
            <Bar label="Exploration" value={s.exploreHere} color="#a8a29e" />
          </div>
        </Section>

        <Section title="Perception (within sensory range)">
          <div className="space-y-1">
            <Bar label="Obstacle ahead" value={s.obsF} color="#fb923c" />
            <Bar label="Obstacle left" value={s.obsL} color="#fb923c" />
            <Bar label="Obstacle right" value={s.obsR} color="#fb923c" />
            <Stat label="Food" value={s.foodSeen ? `${s.foodDist.toFixed(0)}u at ${deg(s.foodBearing)}` : 'not in range'} />
            <Stat label="Own nest" value={s.nestSeen ? `${s.nestDist.toFixed(0)}u at ${deg(s.nestBearing)}` : 'not in range'} />
            <Stat label="Rival" value={s.rivalSeen ? `${s.rivalDist.toFixed(0)}u at ${deg(s.rivalBearing)}` : 'none'} />
            <Stat label="Friends / rivals near" value={`${s.friends} / ${s.rivals}`} />
          </div>
        </Section>

        <Section title="Neural policy outputs">
          <div className="space-y-1">
            {NN_OUTPUT_LABELS.map((l, i) => (
              <Bar key={l} label={l} value={a.outputs[i]} signed color={i === 0 ? '#fbbf24' : '#60a5fa'} />
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-stone-500">
            Inputs are only the samples above plus body state (health, energy, carrying, home-signal budget, stuck, noise).
            No world coordinates enter the network. Influence: {t.neuralInfluence.toFixed(2)}.
          </p>
        </Section>
        <Button variant="danger" onClick={() => { world.killAnt(a); sim.setSelectedAnt(null); }}>Remove this ant</Button>
      </div>
    );
  }

  if (f && world.foods.includes(f)) {
    return (
      <div className="space-y-3 p-3">
        <Section title={`Food source #${f.id}`} right={<Button variant="danger" onClick={() => { world.removeFood(f.id); sim.setSelectedFood(null); }}>Remove</Button>}>
          <div className="space-y-2">
            <Stat label="Position" value={`${f.x.toFixed(0)}, ${f.y.toFixed(0)}`} />
            <Stat label="Radius" value={foodRadius(f).toFixed(1)} />
            <Slider label="Quantity" min={0} max={1500} step={5} value={f.quantity} onChange={(v) => { f.quantity = v; if (v > f.maxQuantity) f.maxQuantity = v; f.depletedAt = v <= 0 ? world.time : -1; sim.refresh(); }} />
            <Slider label="Extra radius" min={0} max={30} step={1} value={f.radiusBonus} onChange={(v) => { f.radiusBonus = v; sim.refresh(); }} />
            <p className="text-[10px] text-stone-500">Drag the source with the Select tool to move it (works while running).</p>
          </div>
        </Section>
      </div>
    );
  }

  if (n && world.nests.includes(n)) {
    const col = world.colonyById(n.colonyId);
    return (
      <div className="space-y-3 p-3">
        <Section title={`Nest #${n.id}`} right={<Button variant="danger" onClick={() => { world.removeNest(n.id); sim.setSelectedNest(null); }}>Remove</Button>}>
          <div className="space-y-2">
            <label className="block text-[11px] text-stone-400">
              Owner
              <select
                value={n.colonyId}
                onChange={(e) => { n.colonyId = parseInt(e.target.value); sim.refresh(); }}
                className="mt-1 w-full rounded border border-stone-700 bg-stone-800 px-2 py-1 text-xs text-stone-100"
              >
                {world.colonies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <Stat label="Stored food" value={col?.storedFood.toFixed(1) ?? '–'} />
            <Slider label="Radius" min={12} max={40} step={1} value={n.radius} onChange={(v) => { n.radius = v; sim.refresh(); }} />
            <Button onClick={() => { if (col) world.spawnAnts(col.id, n.x, n.y, 20); }}>Spawn 20 ants here</Button>
            <p className="text-[10px] text-stone-500">Drag the nest with the Select tool to move it.</p>
          </div>
        </Section>
      </div>
    );
  }

  return (
    <div className="p-3 text-xs text-stone-400 space-y-2">
      <p>Nothing selected.</p>
      <p>Use the <span className="text-stone-200">Select</span> tool and click an ant to inspect its state, local senses and neural outputs, or click food / nests to edit them.</p>
      <p className="text-[11px] text-stone-500">Tip: enable <span className="text-stone-300">Sensors</span> in the toolbar to see the selected ant's sensory radius, pheromone probes and obstacle rays in the world.</p>
    </div>
  );
}
