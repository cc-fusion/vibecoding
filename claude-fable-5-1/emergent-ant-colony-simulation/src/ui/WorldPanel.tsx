import { useState } from 'react';
import { exportSetupFile, hasLocalSave, importSetupFile, loadFromLocal, saveToLocal } from '../sim/persistence';
import { buildDefaultScenario, buildRandomMap } from '../sim/world';
import { Button, Section, Slider } from './primitives';
import type { SimHandle } from './useSimulation';

export function WorldPanel({ sim }: { sim: SimHandle }) {
  const { world } = sim;
  const [seedText, setSeedText] = useState(String(world.seed));
  const [msg, setMsg] = useState<string | null>(null);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2500); };
  const afterStructural = () => {
    sim.setSelectedAnt(null); sim.setSelectedFood(null); sim.setSelectedNest(null);
    if (world.colonies.length) sim.setActiveColonyId(world.colonies[0].id);
    setSeedText(String(world.seed));
    sim.refresh();
  };
  const parseSeed = () => {
    const n = parseInt(seedText);
    return Number.isFinite(n) ? n >>> 0 : world.seed;
  };

  return (
    <div className="space-y-3 p-3">
      <Section title="Randomness">
        <div className="flex gap-1">
          <input
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            className="w-28 rounded border border-stone-700 bg-stone-800 px-2 py-1 font-mono text-xs text-stone-100"
            title="Seed for the pseudo-random generator"
          />
          <Button onClick={() => { sim.reset(parseSeed()); flash('Reset with seed ' + parseSeed()); }} title="Reset the run using this seed">Apply & reset</Button>
          <Button onClick={() => { const s = (Math.random() * 0xffffffff) >>> 0; setSeedText(String(s)); sim.reset(s); }}>Random</Button>
        </div>
        <p className="mt-1 text-[10px] text-stone-500">Same seed + same setup ≈ reproducible run (until you interact).</p>
      </Section>

      <Section title="World parameters">
        <div className="space-y-2">
          <Slider label="Evaporation ×" min={0.2} max={4} step={0.1} value={world.params.evaporation} onChange={(v) => { world.params.evaporation = v; sim.refresh(); }} hint="Global pheromone evaporation multiplier" />
          <Slider label="Diffusion ×" min={0} max={2.5} step={0.1} value={world.params.diffusion} onChange={(v) => { world.params.diffusion = v; sim.refresh(); }} hint="Global pheromone diffusion multiplier" />
          <Slider label="New food quantity" min={20} max={1500} step={10} value={world.params.foodQuantity} onChange={(v) => { world.params.foodQuantity = v; sim.refresh(); }} />
          <Slider label="Wall brush" min={6} max={40} step={2} value={world.params.wallBrush} onChange={(v) => { world.params.wallBrush = v; sim.refresh(); }} />
          <Slider label="Ants per click" min={1} max={50} step={1} value={world.params.antBrush} onChange={(v) => { world.params.antBrush = v; sim.refresh(); }} />
        </div>
      </Section>

      <Section title="Scenarios">
        <div className="flex flex-wrap gap-1">
          <Button variant="primary" onClick={() => { buildDefaultScenario(world); afterStructural(); }}>Default scenario</Button>
          <Button onClick={() => { const s = (Math.random() * 0xffffffff) >>> 0; buildRandomMap(world, s); afterStructural(); }}>Random map</Button>
        </div>
      </Section>

      <Section title="Clear">
        <div className="flex flex-wrap gap-1">
          <Button onClick={() => { world.clearPheromones(); }}>Pheromones</Button>
          <Button onClick={() => { world.clearFood(); sim.setSelectedFood(null); }}>Food</Button>
          <Button onClick={() => { world.clearWalls(); }}>Walls</Button>
          <Button onClick={() => { world.ants = []; sim.setSelectedAnt(null); }}>Ants</Button>
          <Button variant="danger" onClick={() => { world.clearWorld(); afterStructural(); }} title="Remove ants, food, nests, walls and pheromones (colonies are kept)">Clear world</Button>
        </div>
      </Section>

      <Section title="Save / load setup">
        <div className="flex flex-wrap gap-1">
          <Button onClick={() => flash(saveToLocal(world) ? 'Setup saved to this browser' : 'Save failed')}>Save</Button>
          <Button disabled={!hasLocalSave()} onClick={() => { if (loadFromLocal(world)) { afterStructural(); flash('Setup loaded'); } else flash('Nothing to load'); }}>Load</Button>
          <Button onClick={() => exportSetupFile(world)}>Export JSON</Button>
          <Button onClick={() => importSetupFile(world).then((ok) => { if (ok) { afterStructural(); flash('Imported'); } else flash('Import failed'); })}>Import JSON</Button>
        </div>
        <p className="mt-1 text-[10px] text-stone-500">Saves colonies (traits + neural weights), nests, food, walls, parameters and seed. Ants respawn at nests on load.</p>
        {msg && <div className="mt-2 rounded bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">{msg}</div>}
      </Section>

      <Section title="How it works">
        <ul className="list-disc space-y-1 pl-4 text-[11px] leading-snug text-stone-400">
          <li>Every ant only knows its own body state and what it samples within a small radius: 3 pheromone probes, 3 obstacle rays, and objects/ants in sensory range.</li>
          <li>Outbound ants lay a <span className="text-sky-100">home</span> signal that weakens with distance walked; ants carrying food lay a <span className="text-amber-200">food</span> signal that weakens the same way, so gradients point toward food and home.</li>
          <li>Trails only persist while successful trips keep reinforcing them; evaporation erases the rest.</li>
          <li><span className="text-red-300">Alarm</span> is short-lived and local; <span className="text-stone-300">exploration</span> marks recent activity (territory).</li>
        </ul>
      </Section>
    </div>
  );
}
