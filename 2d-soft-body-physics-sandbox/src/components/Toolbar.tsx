import {
  Anchor,
  Bug,
  Circle,
  Copy,
  Dices,
  Eraser,
  Hexagon,
  Move,
  MousePointer2,
  Orbit,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Square,
  Trash2,
  Waves,
} from 'lucide-react';
import { useSandbox } from '../sim/useSandbox';
import type { SoftPreset } from '../sim/types';
import { Divider, IconButton, Segmented } from './controls';

export function Toolbar() {
  const sb = useSandbox();
  const { tool, bodyMode, softPreset } = sb.tools;
  const hasSelection = sb.selectedId !== null;
  const debugOn = Object.values(sb.params.debug).some(Boolean);
  const zeroG = sb.params.gravityX === 0 && sb.params.gravityY === 0;

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-slate-800 bg-[#0f141b] px-2 overflow-x-auto no-scrollbar">
      <div className="mr-2 flex items-center gap-2 pl-1 pr-2">
        <span className="grid h-6 w-6 place-items-center rounded bg-gradient-to-br from-teal-400 to-sky-600 text-[10px] font-black text-slate-950">
          SL
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-slate-100 md:inline">SoftLab</span>
      </div>
      <Divider />

      {/* creation tools */}
      <IconButton icon={<MousePointer2 />} label="Select" tip="Select / move / throw objects" shortcut="V" active={tool === 'select'} onClick={() => sb.setTools({ tool: 'select' })} />
      <IconButton icon={<Waves />} label="Soft Body" tip="Drag to create a deformable soft body" shortcut="S" active={tool === 'soft'} onClick={() => sb.setTools({ tool: 'soft' })} />
      {tool === 'soft' && (
        <Segmented<SoftPreset>
          size="sm"
          value={softPreset}
          onChange={(v) => sb.setTools({ softPreset: v })}
          options={[
            { value: 'blob', label: 'Blob' },
            { value: 'circle', label: 'Circle' },
            { value: 'rect', label: 'Rect' },
            { value: 'star', label: 'Star' },
          ]}
        />
      )}
      <IconButton icon={<Square />} label="Rectangle" tip="Drag to create a rigid rectangle" shortcut="R" active={tool === 'rect'} onClick={() => sb.setTools({ tool: 'rect' })} />
      <IconButton icon={<Circle />} label="Circle" tip="Drag to create a rigid circle" shortcut="C" active={tool === 'circle'} onClick={() => sb.setTools({ tool: 'circle' })} />
      <IconButton icon={<Hexagon />} label="Polygon" tip="Click to place vertices, click the first vertex or press Enter to close" shortcut="P" active={tool === 'polygon'} onClick={() => sb.setTools({ tool: 'polygon' })} />

      {(tool === 'rect' || tool === 'circle') && (
        <Segmented
          size="sm"
          value={bodyMode}
          onChange={(v) => sb.setTools({ bodyMode: v })}
          options={[
            { value: 'dynamic', label: <span className="flex items-center gap-1"><Move className="h-3 w-3" />Dynamic</span>, tip: 'New rigid bodies react to gravity and collisions' },
            { value: 'static', label: <span className="flex items-center gap-1"><Anchor className="h-3 w-3" />Static</span>, tip: 'New rigid bodies are fixed in place' },
          ]}
        />
      )}
      {tool === 'polygon' && (
        <Segmented
          size="sm"
          value={sb.tools.polyTarget}
          onChange={(v) => sb.setTools({ polyTarget: v })}
          options={[
            { value: 'soft', label: 'Soft', tip: 'Closed polygon becomes a soft body' },
            { value: 'dynamic', label: 'Dynamic', tip: 'Closed polygon becomes a dynamic rigid body' },
            { value: 'static', label: 'Static', tip: 'Closed polygon becomes a static rigid body' },
          ]}
        />
      )}

      <Divider />

      {/* simulation controls */}
      <IconButton
        icon={sb.params.paused ? <Play /> : <Pause />}
        label={sb.params.paused ? 'Resume' : 'Pause'}
        tip={sb.params.paused ? 'Resume simulation' : 'Pause simulation'}
        shortcut="Space"
        active={sb.params.paused}
        onClick={() => sb.togglePause()}
      />
      <IconButton
        icon={<SkipForward />}
        label="Step"
        tip="Advance one physics step (pauses the simulation)"
        shortcut="."
        onClick={() => {
          if (!sb.params.paused) sb.setWorldParams({ paused: true });
          sb.requestStep();
        }}
      />
      <IconButton icon={<RotateCcw />} label="Reset" tip="Reset to the demo scene" onClick={() => sb.loadInitialScene()} />
      <IconButton icon={<Eraser />} label="Clear" tip="Remove every object" onClick={() => { sb.clear(); sb.refreshStats(); }} />
      <IconButton icon={<Dices />} label="Spawn" tip="Spawn a random object" onClick={() => sb.spawnRandom()} />

      <Divider />

      <IconButton icon={<Copy />} label="Duplicate" tip="Duplicate selected object" shortcut="Ctrl+D" disabled={!hasSelection} onClick={() => { if (sb.selectedId !== null) { sb.duplicate(sb.selectedId); sb.refreshStats(); } }} />
      <IconButton icon={<Trash2 />} label="Delete" tip="Delete selected object" shortcut="Del" danger disabled={!hasSelection} onClick={() => { if (sb.selectedId !== null) { sb.remove(sb.selectedId); sb.refreshStats(); } }} />

      <div className="ml-auto flex items-center gap-1">
        <IconButton
          icon={<Orbit />}
          label="Zero-G"
          tip="Toggle zero gravity"
          active={zeroG}
          onClick={() => (zeroG ? sb.setWorldParams({ gravityX: 0, gravityY: 1 }) : sb.setWorldParams({ gravityX: 0, gravityY: 0 }))}
        />
        <IconButton
          icon={<Bug />}
          label="Debug"
          tip="Toggle debug visualization (nodes, springs, collision shapes, velocities)"
          shortcut="G"
          active={debugOn}
          onClick={() =>
            sb.setWorldParams({
              debug: debugOn
                ? { nodes: false, springs: false, shapes: false, velocities: false }
                : { nodes: true, springs: true, shapes: true, velocities: true },
            })
          }
        />
      </div>
    </header>
  );
}
