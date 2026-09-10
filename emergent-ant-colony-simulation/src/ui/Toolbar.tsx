import { PHEROMONE_DEFS } from '../sim/constants';
import { Button } from './primitives';
import type { SimHandle } from './useSimulation';
import { cn } from '../utils/cn';

const SPEEDS = [0.5, 1, 2, 4];

export function Toolbar({ sim }: { sim: SimHandle }) {
  const { world } = sim;
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="flex items-center gap-2 mr-2">
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-inner">
          <span className="text-sm">🐜</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight text-stone-100">Ant Colony Lab</div>
          <div className="text-[10px] text-stone-500">emergent foraging sandbox</div>
        </div>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-stone-800 bg-stone-900/60 p-1">
        <Button variant="primary" onClick={() => sim.setRunning(!sim.running)} title="Space">
          {sim.running ? '⏸ Pause' : '▶ Start'}
        </Button>
        <Button onClick={() => sim.reset()} title="Restart with the same setup and seed">↺ Reset</Button>
        <div className="mx-1 h-5 w-px bg-stone-700" />
        {SPEEDS.map((s) => (
          <Button key={s} active={sim.speed === s} onClick={() => sim.setSpeed(s)} className="px-2">
            {s}x
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-stone-800 bg-stone-900/60 p-1">
        <Button active={sim.showPheromones} onClick={() => sim.setShowPheromones(!sim.showPheromones)} title="Toggle pheromone overlay">
          Pheromones
        </Button>
        {PHEROMONE_DEFS.map((d, i) => (
          <Button
            key={d.key}
            active={sim.channels[i]}
            disabled={!sim.showPheromones}
            onClick={(() => {
              const c = [...sim.channels];
              c[i] = !c[i];
              sim.setChannels(c);
            })}
            title={`Show ${d.label} pheromone (click to combine several)`}
            className="px-2"
          >
            <span className={cn('inline-block h-2 w-2 rounded-full', i === 0 && 'bg-amber-300', i === 1 && 'bg-sky-100', i === 2 && 'bg-red-500', i === 3 && 'bg-stone-400')} />
            {d.label}
          </Button>
        ))}
        <input
          type="range" min={0.2} max={1} step={0.05} value={sim.pheromoneOpacity}
          onChange={(e) => sim.setPheromoneOpacity(parseFloat(e.target.value))}
          className="w-16 accent-amber-400" title="Overlay opacity"
        />
        <Button active={sim.showSensors} onClick={() => sim.setShowSensors(!sim.showSensors)} title="Draw the selected ant's sensory radius and probes">
          Sensors
        </Button>
      </div>

      <div className="flex items-center gap-1 rounded-lg border border-stone-800 bg-stone-900/60 p-1">
        <span className="px-1 text-[11px] text-stone-400">Colony</span>
        <select
          value={sim.activeColonyId}
          onChange={(e) => sim.setActiveColonyId(parseInt(e.target.value))}
          className="rounded bg-stone-800 px-2 py-1 text-xs text-stone-100 border border-stone-700"
          title="Colony used by Add Nest / Add Ants tools"
        >
          {world.colonies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <span className="ml-1 inline-block h-3 w-3 rounded-full border border-black/40" style={{ background: world.colonyById(sim.activeColonyId)?.color }} />
      </div>

      <div className="ml-auto flex items-center gap-3 text-[11px] font-mono text-stone-400">
        <span title="Simulated time">t={world.time.toFixed(0)}s</span>
        <span>{world.ants.length} ants</span>
        <span title="frames per second / simulated seconds per real second">{sim.fps} fps · {sim.simRate}x</span>
      </div>
    </div>
  );
}
