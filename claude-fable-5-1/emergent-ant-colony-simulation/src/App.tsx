import { useEffect, useState } from 'react';
import { ColonyPanel } from './ui/ColonyPanel';
import { InspectorPanel } from './ui/InspectorPanel';
import { StatsPanel } from './ui/StatsPanel';
import { Toolbar } from './ui/Toolbar';
import { ToolPalette } from './ui/ToolPalette';
import { useSimulation } from './ui/useSimulation';
import { WorldCanvas } from './ui/WorldCanvas';
import { WorldPanel } from './ui/WorldPanel';
import { cn } from './utils/cn';

type Tab = 'colonies' | 'inspector' | 'stats' | 'world';

export default function App() {
  const sim = useSimulation();
  const [tab, setTab] = useState<Tab>('colonies');

  // switch to inspector when something gets selected
  useEffect(() => {
    if (sim.selectedAnt || sim.selectedFood || sim.selectedNest) setTab('inspector');
  }, [sim.selectedAnt, sim.selectedFood, sim.selectedNest]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') { e.preventDefault(); sim.setRunning(!sim.running); }
      else if (e.key === 'p') sim.setShowPheromones(!sim.showPheromones);
      else if (e.key === 'Escape') { sim.setSelectedAnt(null); sim.setSelectedFood(null); sim.setSelectedNest(null); sim.setTool('select'); }
      else if (e.key === '1') sim.setTool('select');
      else if (e.key === '2') sim.setTool('addFood');
      else if (e.key === '3') sim.setTool('addNest');
      else if (e.key === '4') sim.setTool('addAnts');
      else if (e.key === '5') sim.setTool('wall');
      else if (e.key === '6') sim.setTool('erase');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sim]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'colonies', label: 'Colonies' },
    { id: 'inspector', label: 'Inspector' },
    { id: 'stats', label: 'Statistics' },
    { id: 'world', label: 'World' },
  ];

  return (
    <div className="flex h-screen flex-col bg-[#0f120d] text-stone-200 font-sans">
      <header className="shrink-0 border-b border-stone-800 bg-stone-950/70 backdrop-blur">
        <Toolbar sim={sim} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav className="shrink-0 border-b border-stone-800 bg-stone-950/50 md:border-b-0 md:border-r">
          <ToolPalette sim={sim} />
        </nav>
        <main className="relative min-h-[45vh] flex-1 bg-black">
          <WorldCanvas sim={sim} />
          {/* legend */}
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border border-stone-800/80 bg-stone-950/70 px-2.5 py-1.5 text-[10px] text-stone-300 backdrop-blur">
            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
              <span><span className="inline-block h-2 w-2 rounded-full bg-lime-400 mr-1" />food</span>
              <span><span className="inline-block h-2 w-2 rounded-sm bg-[#7d6a55] mr-1" />wall</span>
              <span><span className="inline-block h-2 w-2 rounded-full bg-red-500 mr-1" />fighting</span>
              <span>pheromone: colony colour = food trail · pale = home · red = alarm · grey = exploration</span>
            </div>
          </div>
          {!sim.running && (
            <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-amber-500/40 bg-stone-950/70 px-2 py-1 text-[11px] text-amber-200">
              paused — editing still works
            </div>
          )}
          <div className="pointer-events-none absolute bottom-2 right-2 rounded-md bg-stone-950/60 px-2 py-1 text-[10px] text-stone-400">
            tool: <span className="text-stone-100">{sim.tool}</span> · space = start/pause · 1–6 tools · esc = select
          </div>
        </main>
        <aside className="flex max-h-[45vh] w-full shrink-0 flex-col border-t border-stone-800 bg-stone-950/60 md:max-h-none md:w-[340px] md:border-l md:border-t-0 xl:w-[370px]">
          <div className="flex shrink-0 border-b border-stone-800">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex-1 px-2 py-2 text-[11px] font-medium uppercase tracking-wide transition-colors',
                  tab === t.id ? 'border-b-2 border-amber-400 text-amber-200' : 'text-stone-500 hover:text-stone-300',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'colonies' && <ColonyPanel sim={sim} />}
            {tab === 'inspector' && <InspectorPanel sim={sim} />}
            {tab === 'stats' && <StatsPanel sim={sim} />}
            {tab === 'world' && <WorldPanel sim={sim} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
