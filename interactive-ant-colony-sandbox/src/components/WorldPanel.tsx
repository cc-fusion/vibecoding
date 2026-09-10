import { PHEROMONE_LABELS, PHEROMONE_TYPES, type PheromoneType } from '@/sim/types';
import type { World } from '@/sim/world';
import { cn } from '@/utils/cn';
import { Btn, Section, Slider, Toggle } from './ui';

export interface ViewSettings {
  showPheromones: boolean;
  pheromoneTypes: Record<PheromoneType, boolean>;
  pheromoneColony: number | 'all';
}

export interface EditSettings {
  brushRadius: number;
  antsPerClick: number;
  foodAmount: number;
}

interface Props {
  world: World;
  view: ViewSettings;
  setView: (v: ViewSettings) => void;
  edit: EditSettings;
  setEdit: (e: EditSettings) => void;
  onChange: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: () => void;
  onRandom: () => void;
  onClearWorld: () => void;
  onDefault: () => void;
}

const TYPE_SWATCH: Record<PheromoneType, string> = {
  food: 'colony color',
  home: 'pale tint',
  alarm: 'red',
  explore: 'grey',
};

export function WorldPanel(p: Props) {
  const { world, view, setView, edit, setEdit } = p;
  const setType = (t: PheromoneType, v: boolean) => setView({ ...view, pheromoneTypes: { ...view.pheromoneTypes, [t]: v } });
  const only = (t: PheromoneType) =>
    setView({ ...view, showPheromones: true, pheromoneTypes: { food: false, home: false, alarm: false, explore: false, [t]: true } });

  return (
    <div className="space-y-3">
      <Section title="Pheromone view">
        <Toggle label="Show pheromones" checked={view.showPheromones} onChange={(v) => setView({ ...view, showPheromones: v })} />
        <div className="mt-2 space-y-1">
          {PHEROMONE_TYPES.map((t) => (
            <div key={t} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={view.pheromoneTypes[t]}
                onChange={(e) => setType(t, e.target.checked)}
                className="accent-amber-400"
              />
              <span className="flex-1 text-stone-200">{PHEROMONE_LABELS[t]}</span>
              <span className="text-[10px] text-stone-500">{TYPE_SWATCH[t]}</span>
              <button type="button" onClick={() => only(t)} className="text-[10px] text-amber-300/80 hover:underline">
                only
              </button>
            </div>
          ))}
        </div>
        <label className="mt-2 block text-xs text-stone-300">
          Colony
          <select
            value={view.pheromoneColony}
            onChange={(e) => setView({ ...view, pheromoneColony: e.target.value === 'all' ? 'all' : parseInt(e.target.value) })}
            className="mt-1 w-full rounded border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-100"
          >
            <option value="all">All colonies</option>
            {world.colonies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.traits.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[10px] leading-relaxed text-stone-500">
          Intensity = concentration. Food trails glow in the colony's own color; home signal is a pale halo around
          nests; alarm flashes red; exploration is a faint grey wash.
        </p>
      </Section>

      <Section title="Edit brushes">
        <div className="space-y-2">
          <Slider label="Wall / erase brush radius" min={4} max={60} step={1} value={edit.brushRadius} onChange={(v) => setEdit({ ...edit, brushRadius: v })} />
          <Slider label="Ants per click" min={1} max={50} step={1} value={edit.antsPerClick} onChange={(v) => setEdit({ ...edit, antsPerClick: v })} />
          <Slider label="New food amount" min={10} max={500} step={10} value={edit.foodAmount} onChange={(v) => setEdit({ ...edit, foodAmount: v })} />
        </div>
      </Section>

      <Section title="Simulation">
        <Toggle
          label="Ant path memory (noisy dead-reckoning fallback)"
          checked={world.pathMemory}
          onChange={(v) => {
            world.pathMemory = v;
            p.onChange();
          }}
        />
        <div className="mt-2 flex items-center justify-between text-xs text-stone-300">
          <span>Random seed</span>
          <input
            type="number"
            value={world.seed}
            onChange={(e) => {
              world.seed = parseInt(e.target.value) || 0;
              p.onChange();
            }}
            className="w-24 rounded border border-stone-700 bg-stone-950/60 px-2 py-0.5 text-right font-mono text-xs"
          />
        </div>
        <p className="mt-1 text-[10px] text-stone-500">Seed is applied on Reset; identical setups + seed replay identically.</p>
      </Section>

      <Section title="Clear">
        <div className="grid grid-cols-2 gap-1.5">
          <Btn onClick={() => { world.clearPheromones(); p.onChange(); }}>Pheromones</Btn>
          <Btn onClick={() => { world.clearFood(); p.onChange(); }}>Food</Btn>
          <Btn onClick={() => { world.clearWalls(); p.onChange(); }}>Walls</Btn>
          <Btn onClick={() => { world.ants = []; p.onChange(); }}>All ants</Btn>
          <Btn variant="danger" className="col-span-2" onClick={p.onClearWorld} title="Empty map; keeps colony definitions">
            Clear world (keep colonies)
          </Btn>
        </div>
      </Section>

      <Section title="Setups">
        <div className="grid grid-cols-2 gap-1.5">
          <Btn variant="primary" onClick={p.onSave} title="Save to browser storage">Save setup</Btn>
          <Btn onClick={p.onLoad} title="Load from browser storage">Load setup</Btn>
          <Btn onClick={p.onExport}>Export JSON</Btn>
          <Btn onClick={p.onImport}>Import JSON</Btn>
          <Btn onClick={p.onRandom} className={cn('col-span-1')}>Random map</Btn>
          <Btn onClick={p.onDefault}>Default demo</Btn>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-stone-500">
          Setups store colonies, traits, nests, food, walls and seed (not individual ants). Loading a setup also makes it
          the new Reset point.
        </p>
      </Section>
    </div>
  );
}
