import { COLONY_PALETTE, DEFAULT_TRAITS, TRAIT_META } from '@/sim/scenarios';
import type { ColonyTraits } from '@/sim/types';
import type { World } from '@/sim/world';
import { cn } from '@/utils/cn';
import { Btn, Section, Slider, Toggle } from './ui';

interface Props {
  world: World;
  activeColonyId: number;
  onSelectColony: (id: number) => void;
  onChange: () => void; // request UI refresh
}

export function ColonyPanel({ world, activeColonyId, onSelectColony, onChange }: Props) {
  const colony = world.colonyById(activeColonyId) ?? world.colonies[0];

  const setTrait = <K extends keyof ColonyTraits>(key: K, value: ColonyTraits[K]) => {
    if (!colony) return;
    colony.traits[key] = value; // live edit: subsequent ant decisions use the new value
    onChange();
  };

  const addColony = () => {
    const used = new Set(world.colonies.map((c) => c.traits.color));
    const color = COLONY_PALETTE.find((c) => !used.has(c)) ?? COLONY_PALETTE[world.colonies.length % COLONY_PALETTE.length];
    const c = world.addColony({ ...DEFAULT_TRAITS, name: `Colony ${world.colonies.length + 1}`, color, startPopulation: 60 });
    onSelectColony(c.id);
    onChange();
  };

  return (
    <div className="space-y-3">
      <Section
        title="Colonies"
        right={
          <div className="flex gap-1">
            <Btn onClick={addColony} title="Add a new colony (then place a nest for it)">
              + New
            </Btn>
          </div>
        }
      >
        <div className="space-y-1">
          {world.colonies.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelectColony(c.id)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors',
                c.id === colony?.id
                  ? 'border-amber-400/60 bg-amber-400/10'
                  : 'border-stone-800 bg-stone-900/40 hover:bg-stone-800/60',
              )}
            >
              <span className="h-3 w-3 rounded-full ring-2 ring-black/40" style={{ background: c.traits.color }} />
              <span className="flex-1 truncate font-medium text-stone-200">{c.traits.name}</span>
              <span className="font-mono text-[10px] text-stone-400">
                {c.stats.living} ants · {Math.round(c.storedFood)} food
              </span>
            </button>
          ))}
          {world.colonies.length === 0 && <p className="text-xs text-stone-500">No colonies. Add one to begin.</p>}
        </div>
      </Section>

      {colony && (
        <Section
          title="Colony settings"
          right={
            <div className="flex gap-1">
              <Btn
                title="Duplicate this colony's traits into a new colony"
                onClick={() => {
                  const d = world.duplicateColony(colony.id);
                  if (d) onSelectColony(d.id);
                  onChange();
                }}
              >
                Duplicate
              </Btn>
              <Btn
                variant="danger"
                title="Delete colony, its nests and ants"
                onClick={() => {
                  world.removeColony(colony.id);
                  onSelectColony(world.colonies[0]?.id ?? -1);
                  onChange();
                }}
              >
                Delete
              </Btn>
            </div>
          }
        >
          {!world.nests.some((n) => n.colonyId === colony.id) && (
            <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-100">
              This colony has no nest yet. Pick the <b>Add nest</b> tool and click the map — its starting population will
              emerge there.
            </div>
          )}
          <div className="mb-3 flex items-center gap-2">
            <input
              type="color"
              value={colony.traits.color}
              onChange={(e) => setTrait('color', e.target.value)}
              className="h-7 w-9 cursor-pointer rounded border border-stone-700 bg-transparent p-0.5"
              title="Colony color"
            />
            <input
              value={colony.traits.name}
              onChange={(e) => setTrait('name', e.target.value)}
              className="flex-1 rounded border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-100 outline-none focus:border-amber-400/60"
            />
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {COLONY_PALETTE.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setTrait('color', p)}
                className={cn('h-4 w-4 rounded-full', colony.traits.color === p && 'ring-2 ring-white')}
                style={{ background: p }}
              />
            ))}
          </div>
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
                onChange={(v) => setTrait(m.key, v as never)}
              />
            ))}
            <div className="pt-1">
              <Toggle
                label="Auto-grow population (costs 4 food per ant)"
                checked={colony.traits.autoGrow}
                onChange={(v) => setTrait('autoGrow', v)}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <Btn
              onClick={() => {
                world.spawnAnts(colony, 20);
                onChange();
              }}
              title="Spawn 20 ants at this colony's nests"
            >
              +20 ants at nest
            </Btn>
            <Btn
              onClick={() => {
                colony.storedFood += 50;
                onChange();
              }}
              title="Gift 50 food to the colony store"
            >
              +50 stored food
            </Btn>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-stone-500">
            Changes apply immediately to living ants. Start population applies on reset.
          </p>
        </Section>
      )}
    </div>
  );
}
