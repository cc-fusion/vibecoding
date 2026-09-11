import { ANT_STATE_LABELS } from '@/sim/types';
import type { World } from '@/sim/world';
import { Btn, Section, Slider, Stat } from './ui';

export type Selection = { kind: 'ant' | 'food' | 'nest'; id: number } | null;

interface Props {
  world: World;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onChange: () => void;
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded bg-stone-800">
      <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  );
}

export function InspectorPanel({ world, selection, onSelect, onChange }: Props) {
  if (!selection) {
    return (
      <Section title="Inspector">
        <p className="text-xs leading-relaxed text-stone-400">
          Use the <b className="text-stone-200">Select</b> tool and click an ant, food source or nest to inspect it.
          Selected ants show their state, energy, and the pheromone concentrations they currently perceive — all
          behaviour comes from this local information.
        </p>
      </Section>
    );
  }

  if (selection.kind === 'ant') {
    const a = world.antById(selection.id);
    const c = a && world.colonyById(a.colonyId);
    if (!a || !c) {
      return (
        <Section title="Inspector">
          <p className="text-xs text-stone-400">This ant is no longer alive.</p>
          <Btn className="mt-2" onClick={() => onSelect(null)}>
            Clear selection
          </Btn>
        </Section>
      );
    }
    const T = c.traits;
    const speed = T.speed * (0.55 + 0.45 * (a.health / T.maxHealth)) * (a.carrying > 0 ? 0.85 : 1) * (a.energy <= 0 ? 0.6 : 1);
    const deg = Math.round((((a.heading * 180) / Math.PI) % 360 + 360) % 360);
    const memLen = Math.hypot(a.memX, a.memY);
    return (
      <div className="space-y-3">
        <Section
          title={`Ant #${a.id}`}
          right={
            <Btn variant="ghost" onClick={() => onSelect(null)}>
              ✕
            </Btn>
          }
        >
          <div className="mb-2 flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-full" style={{ background: T.color }} />
            <span className="font-medium text-stone-100">{T.name}</span>
          </div>
          <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5">
            <div className="text-[10px] tracking-wide text-amber-300/80 uppercase">Current behaviour</div>
            <div className="text-sm font-semibold text-amber-100">
              {a.avoidTimer > 0 && a.state !== 'resting' ? 'Avoiding obstacle' : ANT_STATE_LABELS[a.state]}
            </div>
            {a.avoidTimer > 0 && a.state !== 'resting' && (
              <div className="text-[10px] text-amber-200/70">while {ANT_STATE_LABELS[a.state].toLowerCase()}</div>
            )}
          </div>
          <div className="space-y-2 text-xs">
            <div>
              <div className="flex justify-between text-stone-300">
                <span>Health</span>
                <span className="font-mono">
                  {a.health.toFixed(0)} / {T.maxHealth}
                </span>
              </div>
              <Bar value={a.health / T.maxHealth} color="#f87171" />
            </div>
            <div>
              <div className="flex justify-between text-stone-300">
                <span>Energy</span>
                <span className="font-mono">{Math.round(a.energy * 100)}%</span>
              </div>
              <Bar value={a.energy} color="#fbbf24" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <Stat label="Carrying" value={a.carrying > 0 ? `${a.carrying} food` : '—'} />
            <Stat label="Speed" value={`${speed.toFixed(2)} u/t`} />
            <Stat label="Strength" value={T.strength} />
            <Stat label="Heading" value={`${deg}°`} />
            <Stat label="Age" value={`${Math.round(a.age / 60)}s`} />
            <Stat label="Home memory" value={world.pathMemory ? `${Math.round(memLen)}u est.` : 'off'} />
          </div>
        </Section>

        <Section title="Perceived pheromones (own colony)">
          <div className="space-y-1.5 text-xs">
            {(
              [
                ['Food trail', a.senseFood, T.color],
                ['Home signal', a.senseHome, '#bfdbfe'],
                ['Alarm', a.senseAlarm, '#f87171'],
                ['Exploration', a.senseExplore, '#a8a29e'],
              ] as const
            ).map(([label, v, col]) => (
              <div key={label}>
                <div className="flex justify-between text-stone-300">
                  <span>{label}</span>
                  <span className="font-mono text-stone-400">{v.toFixed(3)}</span>
                </div>
                <Bar value={Math.min(1, v / 1.5)} color={col} />
              </div>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-stone-500">
            Internal signals — food: {a.foodSignal.toFixed(2)} · home: {a.homeSignal.toFixed(2)}
          </div>
        </Section>

        <Section title="Currently perceived">
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="Food" value={a.seesFood ? 'yes' : 'no'} color={a.seesFood ? '#a3e635' : undefined} />
            <Stat label="Nest" value={a.seesNest ? 'yes' : 'no'} color={a.seesNest ? T.color : undefined} />
            <Stat label="Enemies" value={a.seesEnemies} color={a.seesEnemies > 0 ? '#f87171' : undefined} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Btn
              variant="danger"
              onClick={() => {
                a.health = 0;
                onChange();
              }}
            >
              Remove ant
            </Btn>
            <Btn
              onClick={() => {
                a.health = T.maxHealth;
                a.energy = 1;
                onChange();
              }}
            >
              Heal & feed
            </Btn>
          </div>
        </Section>
      </div>
    );
  }

  if (selection.kind === 'food') {
    const f = world.foodById(selection.id);
    if (!f)
      return (
        <Section title="Inspector">
          <p className="text-xs text-stone-400">This food source is gone (depleted or removed).</p>
          <Btn className="mt-2" onClick={() => onSelect(null)}>
            Clear selection
          </Btn>
        </Section>
      );
    return (
      <Section
        title={`Food source #${f.id}`}
        right={
          <Btn variant="ghost" onClick={() => onSelect(null)}>
            ✕
          </Btn>
        }
      >
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          <Stat label="Remaining" value={Math.round(f.amount)} color="#a3e635" />
          <Stat label="Position" value={`${Math.round(f.x)}, ${Math.round(f.y)}`} />
        </div>
        <Slider
          label="Food quantity"
          min={0}
          max={600}
          step={5}
          value={Math.round(f.amount)}
          onChange={(v) => {
            f.amount = v;
            if (v > f.maxAmount) f.maxAmount = v;
            onChange();
          }}
        />
        <p className="mt-1 text-[10px] text-stone-500">Drag it with the Move food tool. Depleted food disappears.</p>
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Btn
            onClick={() => {
              f.amount = f.maxAmount;
              onChange();
            }}
          >
            Refill
          </Btn>
          <Btn
            variant="danger"
            onClick={() => {
              world.removeFood(f.id);
              onSelect(null);
              onChange();
            }}
          >
            Remove
          </Btn>
        </div>
      </Section>
    );
  }

  const n = world.nests.find((k) => k.id === selection.id);
  if (!n)
    return (
      <Section title="Inspector">
        <p className="text-xs text-stone-400">This nest no longer exists.</p>
        <Btn className="mt-2" onClick={() => onSelect(null)}>
          Clear selection
        </Btn>
      </Section>
    );
  const c = world.colonyById(n.colonyId);
  return (
    <Section
      title={`Nest #${n.id}`}
      right={
        <Btn variant="ghost" onClick={() => onSelect(null)}>
          ✕
        </Btn>
      }
    >
      <label className="block text-xs text-stone-300">
        Owner colony
        <select
          value={n.colonyId}
          onChange={(e) => {
            n.colonyId = parseInt(e.target.value);
            onChange();
          }}
          className="mt-1 w-full rounded border border-stone-700 bg-stone-950/60 px-2 py-1 text-xs text-stone-100"
        >
          {world.colonies.map((k) => (
            <option key={k.id} value={k.id}>
              {k.traits.name}
            </option>
          ))}
        </select>
      </label>
      {c && (
        <div className="mt-3 grid grid-cols-2 gap-1.5">
          <Stat label="Stored food" value={Math.round(c.storedFood)} color={c.traits.color} />
          <Stat label="Total collected" value={Math.round(c.totalCollected)} />
          <Stat label="Living ants" value={c.stats.living} />
          <Stat label="Position" value={`${Math.round(n.x)}, ${Math.round(n.y)}`} />
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Btn
          onClick={() => {
            if (c) world.spawnAnts(c, 10, n.x, n.y);
            onChange();
          }}
        >
          +10 ants here
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            world.removeNest(n.id);
            onSelect(null);
            onChange();
          }}
        >
          Remove nest
        </Btn>
      </div>
    </Section>
  );
}
