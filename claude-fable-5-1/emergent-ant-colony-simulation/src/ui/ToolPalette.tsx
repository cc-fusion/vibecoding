import { cn } from '../utils/cn';
import type { SimHandle, Tool } from './useSimulation';

const TOOLS: { id: Tool; icon: string; label: string; hint: string }[] = [
  { id: 'select', icon: '⌖', label: 'Select', hint: 'Select / inspect ants, drag food and nests to move them' },
  { id: 'addFood', icon: '🍃', label: 'Food', hint: 'Add a food source (quantity set in World tab)' },
  { id: 'removeFood', icon: '⊘', label: 'Rm food', hint: 'Remove a food source' },
  { id: 'addNest', icon: '⌂', label: 'Nest', hint: 'Place a nest for the active colony' },
  { id: 'removeNest', icon: '⌂✕', label: 'Rm nest', hint: 'Remove a nest' },
  { id: 'addAnts', icon: '+🐜', label: 'Ants', hint: 'Spawn ants of the active colony (click or drag)' },
  { id: 'removeAnts', icon: '−🐜', label: 'Rm ants', hint: 'Remove ants under the brush' },
  { id: 'wall', icon: '▮', label: 'Wall', hint: 'Draw walls by dragging' },
  { id: 'erase', icon: '◫', label: 'Erase', hint: 'Erase walls by dragging' },
];

export function ToolPalette({ sim }: { sim: SimHandle }) {
  return (
    <div className="flex md:flex-col gap-1 p-1.5 overflow-x-auto md:overflow-visible">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          type="button"
          title={t.hint}
          onClick={() => sim.setTool(t.id)}
          className={cn(
            'flex w-14 shrink-0 flex-col items-center justify-center rounded-md border px-1 py-1.5 text-[10px] leading-tight transition-colors',
            sim.tool === t.id
              ? 'border-amber-400 bg-amber-400/20 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.5)]'
              : 'border-stone-800 bg-stone-900/60 text-stone-400 hover:bg-stone-800 hover:text-stone-200',
          )}
        >
          <span className="text-base leading-none mb-1">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  );
}
