import { useSandbox } from '../sim/useSandbox';
import { cn } from '../utils/cn';

export function StatusBar() {
  const sb = useSandbox();
  const s = sb.stats;
  const p = sb.params;
  const hint = toolHint(sb.tools.tool, sb.draft?.kind === 'polygon');
  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 overflow-hidden border-t border-slate-800 bg-[#0f141b] px-3 font-mono text-[10.5px] text-slate-400">
      <span className={cn('flex items-center gap-1.5', p.paused ? 'text-amber-300' : 'text-emerald-300')}>
        <span className={cn('inline-block h-1.5 w-1.5 rounded-full', p.paused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse')} />
        {p.paused ? 'PAUSED' : 'RUNNING'}
      </span>
      <Stat k="fps" v={String(s.fps)} />
      <Stat k="step" v={`${s.stepMs.toFixed(2)}ms`} />
      <Stat k="bodies" v={String(s.bodies)} />
      <Stat k="nodes" v={String(s.particles)} />
      <Stat k="springs" v={String(s.constraints)} />
      <Stat k="g" v={`${p.gravityX.toFixed(2)}, ${p.gravityY.toFixed(2)}`} />
      <Stat k="speed" v={`${p.speed.toFixed(2)}×`} />
      <Stat k="t" v={`${(s.simTime / 1000).toFixed(1)}s`} />
      {sb.pointer && <Stat k="xy" v={`${sb.pointer.x.toFixed(0)}, ${sb.pointer.y.toFixed(0)}`} />}
      <span className="ml-auto hidden truncate text-slate-500 md:inline">{hint}</span>
    </footer>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <span className="hidden whitespace-nowrap sm:inline">
      <span className="text-slate-600">{k} </span>
      <span className="text-slate-300 tabular-nums">{v}</span>
    </span>
  );
}

function toolHint(tool: string, drawing: boolean) {
  switch (tool) {
    case 'select':
      return 'Drag objects to move them · release while moving to throw · click empty space to deselect';
    case 'soft':
      return 'Drag to size a soft body (click for default size) · choose a preset in the toolbar';
    case 'rect':
    case 'circle':
      return 'Drag to size the shape · click for default size · toggle Dynamic / Static in the toolbar';
    case 'polygon':
      return drawing ? 'Click to add vertices · click the first vertex or press Enter to close · Backspace removes last · Esc cancels' : 'Click to start drawing a polygon outline';
    default:
      return '';
  }
}
