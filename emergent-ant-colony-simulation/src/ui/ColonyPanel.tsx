import { useState } from 'react';
import { COLONY_PRESETS, TRAIT_META, type Colony } from '../sim/colony';
import { Button, Section, Slider, Stat } from './primitives';
import type { SimHandle } from './useSimulation';
import { cn } from '../utils/cn';

export function ColonyPanel({ sim }: { sim: SimHandle }) {
  const { world } = sim;
  const colony = world.colonyById(sim.activeColonyId) ?? world.colonies[0];
  const [presetIdx, setPresetIdx] = useState(2);
  if (!colony) return <div className="p-3 text-xs text-stone-400">No colonies. Add one below.</div>;

  const setTrait = (key: keyof Colony['traits'], v: number | boolean) => {
    (colony.traits as unknown as Record<string, number | boolean>)[key] = v;
    if (key === 'population') world.syncPopulation(colony);
    sim.refresh();
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex flex-wrap gap-1.5">
        {world.colonies.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => sim.setActiveColonyId(c.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]',
              c.id === colony.id ? 'border-stone-300 bg-stone-800 text-stone-100' : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:text-stone-200',
            )}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      <Section
        title="Identity"
        right={
          <div className="flex gap-1">
            <Button onClick={() => { const c = world.duplicateColony(colony.id); if (c) sim.setActiveColonyId(c.id); }} title="Duplicate this colony with a slightly mutated policy">Duplicate</Button>
            <Button variant="danger" disabled={world.colonies.length <= 1} onClick={() => { world.removeColony(colony.id); sim.setActiveColonyId(world.colonies[0].id); }}>Delete</Button>
          </div>
        }
      >
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={colony.color}
            onChange={(e) => { world.setColonyColor(colony, e.target.value); sim.refresh(); }}
            className="h-8 w-10 cursor-pointer rounded border border-stone-700 bg-transparent"
            title="Colony colour"
          />
          <input
            value={colony.name}
            onChange={(e) => { colony.name = e.target.value; sim.refresh(); }}
            className="flex-1 rounded border border-stone-700 bg-stone-800 px-2 py-1 text-xs text-stone-100"
          />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
          <Stat label="Living" value={colony.stats.living} />
          <Stat label="Stored food" value={colony.storedFood.toFixed(1)} />
          <Stat label="Collected" value={colony.collected.toFixed(0)} />
          <Stat label="Deaths" value={colony.deaths} />
        </div>
      </Section>

      <Section title="Traits">
        <div className="space-y-2">
          {TRAIT_META.map((m) => (
            <Slider
              key={m.key}
              label={m.label}
              hint={m.hint}
              min={m.min}
              max={m.max}
              step={m.step}
              value={colony.traits[m.key] as number}
              onChange={(v) => setTrait(m.key, v)}
            />
          ))}
          <label className="flex items-center justify-between text-[11px] text-stone-400" title="Spend stored food to gradually spawn new ants (4 food each, capped at 2x population).">
            <span>Population growth</span>
            <input
              type="checkbox"
              checked={colony.traits.autoGrow}
              onChange={(e) => setTrait('autoGrow', e.target.checked)}
              className="accent-amber-400"
            />
          </label>
        </div>
      </Section>

      <Section title="Neural policy">
        <p className="mb-2 text-[11px] leading-snug text-stone-400">
          A 24→20→8 network shared by every ant of this colony turns local senses into steering and behaviour biases.
          Base profile: <span className="text-stone-200">{colony.profileName}</span>.
        </p>
        <div className="flex flex-wrap gap-1">
          <Button onClick={() => { world.mutateColonyPolicy(colony, 0.15); sim.refresh(); }} title="Add small gaussian noise to all weights">Mutate</Button>
          <Button onClick={() => { world.mutateColonyPolicy(colony, 0.4); sim.refresh(); }} title="Larger mutation">Mutate ×3</Button>
          <Button onClick={() => { world.randomizeColonyPolicy(colony); sim.refresh(); }} title="Random policy within safe bounds">Randomize</Button>
          <Button onClick={() => { world.resetColonyPolicy(colony); sim.refresh(); }} title="Restore this colony's default policy">Reset</Button>
        </div>
      </Section>

      <Section title="Add colony">
        <div className="flex gap-1">
          <select
            value={presetIdx}
            onChange={(e) => setPresetIdx(parseInt(e.target.value))}
            className="flex-1 rounded border border-stone-700 bg-stone-800 px-2 py-1 text-xs text-stone-100"
          >
            {COLONY_PRESETS.map((p, i) => (
              <option key={p.name} value={i}>{p.name} — {p.description}</option>
            ))}
          </select>
          <Button
            variant="primary"
            onClick={() => {
              const c = world.addColony(COLONY_PRESETS[presetIdx]);
              sim.setActiveColonyId(c.id);
              sim.setTool('addNest');
            }}
            title="Adds the colony, then place its nest with the Nest tool"
          >
            Add
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-stone-500">After adding, place a nest for it (tool switches automatically). Ants spawn when population is synced or with the Ants tool.</p>
      </Section>
    </div>
  );
}
