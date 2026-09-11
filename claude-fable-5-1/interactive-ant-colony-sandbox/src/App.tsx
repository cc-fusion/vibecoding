import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ColonyPanel } from './components/ColonyPanel';
import { InspectorPanel, type Selection } from './components/InspectorPanel';
import { StatsPanel } from './components/StatsPanel';
import { WorldPanel, type EditSettings, type ViewSettings } from './components/WorldPanel';
import { Btn } from './components/ui';
import { SPEEDS } from './sim/config';
import { Renderer } from './sim/render';
import { defaultScenario, paintDefaultWalls, randomScenario } from './sim/scenarios';
import type { WorldSetup } from './sim/types';
import { World } from './sim/world';
import { cn } from './utils/cn';

// ---------------------------------------------------------------- tools
type Tool =
  | 'select'
  | 'foodAdd'
  | 'foodMove'
  | 'foodRemove'
  | 'nestAdd'
  | 'nestMove'
  | 'nestRemove'
  | 'antsAdd'
  | 'antsRemove'
  | 'wallDraw'
  | 'wallErase';

interface ToolDef {
  id: Tool;
  label: string;
  hint: string;
  key: string;
  icon: string; // SVG path data (24x24)
  group: number;
}

const TOOLS: ToolDef[] = [
  { id: 'select', label: 'Select / inspect', hint: 'Click an ant, food source or nest to inspect it.', key: '1', group: 0, icon: 'M4 4l7 16 2-7 7-2z' },
  { id: 'foodAdd', label: 'Add food', hint: 'Click to place a food source (amount set in World tab).', key: '2', group: 1, icon: 'M12 5v14M5 12h14' },
  { id: 'foodMove', label: 'Move food', hint: 'Drag a food source to relocate it. Click to select and edit its quantity.', key: '3', group: 1, icon: 'M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4' },
  { id: 'foodRemove', label: 'Remove food', hint: 'Click a food source to delete it.', key: '4', group: 1, icon: 'M6 6l12 12M18 6L6 18' },
  { id: 'nestAdd', label: 'Add nest', hint: 'Click to place a nest for the active colony.', key: '5', group: 2, icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zm0 5a3 3 0 100 6 3 3 0 000-6zM12 1v3' },
  { id: 'nestMove', label: 'Move nest', hint: 'Drag a nest to relocate it. Click to select.', key: '6', group: 2, icon: 'M12 6a6 6 0 100 12 6 6 0 000-12zM12 2v3M12 19v3M2 12h3M19 12h3' },
  { id: 'nestRemove', label: 'Remove nest', hint: 'Click a nest to delete it (its ants stay alive but homeless).', key: '7', group: 2, icon: 'M12 4a8 8 0 100 16 8 8 0 000-16zM9 9l6 6M15 9l-6 6' },
  { id: 'antsAdd', label: 'Add ants', hint: 'Click or drag to release ants of the active colony.', key: '8', group: 3, icon: 'M12 8a3 3 0 110 6 3 3 0 010-6zM12 14v6M7 12l-3-2M17 12l3-2M8 16l-3 3M16 16l3 3M12 8V5' },
  { id: 'antsRemove', label: 'Remove ants', hint: 'Click or drag to remove ants inside the brush.', key: '9', group: 3, icon: 'M12 8a3 3 0 110 6 3 3 0 010-6zM12 14v6M3 3l18 18' },
  { id: 'wallDraw', label: 'Draw wall', hint: 'Drag to paint rock. Walls block ants and pheromones.', key: 'W', group: 4, icon: 'M3 8h18M3 16h18M3 4v16M21 4v16M9 8v8M15 8v8M12 4v4M12 16v4' },
  { id: 'wallErase', label: 'Erase wall', hint: 'Drag to carve corridors through rock.', key: 'E', group: 4, icon: 'M4 16l9-9 6 6-9 9H6zM13 7l3-3 6 6-3 3' },
];

const STORAGE_KEY = 'formicarium.setup.v1';

export default function App() {
  const world = useMemo(() => {
    const w = new World(1337);
    w.loadSetup(defaultScenario(w));
    paintDefaultWalls(w);
    return w;
  }, []);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [tool, setTool] = useState<Tool>('select');
  const [activeColonyId, setActiveColonyId] = useState<number>(world.colonies[0]?.id ?? -1);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<'colonies' | 'inspector' | 'stats' | 'world'>('colonies');
  const [, setUiTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<ViewSettings>({
    showPheromones: true,
    pheromoneTypes: { food: true, home: false, alarm: true, explore: false },
    pheromoneColony: 'all',
  });
  const [edit, setEdit] = useState<EditSettings>({ brushRadius: 14, antsPerClick: 10, foodAmount: 150 });

  // Refs mirror state so the rAF loop always reads the latest values without resubscribing.
  const runningRef = useRef(running);
  const speedRef = useRef(speed);
  const viewRef = useRef(view);
  const selRef = useRef(selection);
  const toolRef = useRef(tool);
  const editRef = useRef(edit);
  const activeRef = useRef(activeColonyId);
  const cursorRef = useRef({ x: 0, y: 0, radius: 0, visible: false });
  runningRef.current = running;
  speedRef.current = speed;
  viewRef.current = view;
  selRef.current = selection;
  toolRef.current = tool;
  editRef.current = edit;
  activeRef.current = activeColonyId;

  const refresh = useCallback(() => setUiTick((t) => t + 1), []);
  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  // ------------------------------------------------------------ main loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new Renderer(canvas, world);
    rendererRef.current = renderer;
    let raf = 0;
    let acc = 0;
    let lastUi = 0;
    const frame = (t: number) => {
      if (runningRef.current) {
        // semi-fixed timestep: `speed` sim ticks per animation frame, capped to avoid spirals
        acc += speedRef.current;
        let n = 0;
        while (acc >= 1 && n < 8) {
          world.step();
          acc -= 1;
          n++;
        }
        if (acc > 8) acc = 0;
      }
      const v = viewRef.current;
      const s = selRef.current;
      renderer.render({
        showPheromones: v.showPheromones,
        pheromoneTypes: v.pheromoneTypes,
        pheromoneColony: v.pheromoneColony,
        selectedAntId: s?.kind === 'ant' ? s.id : -1,
        selectedFoodId: s?.kind === 'food' ? s.id : -1,
        selectedNestId: s?.kind === 'nest' ? s.id : -1,
        cursor: cursorRef.current,
      });
      // Throttled UI refresh (stats / inspector) — React never re-renders per ant per frame.
      if (t - lastUi > 250) {
        lastUi = t;
        setUiTick((x) => x + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [world]);

  // ------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setRunning((r) => !r);
        return;
      }
      if (e.key === 'Escape') {
        setTool('select');
        setSelection(null);
        return;
      }
      const t = TOOLS.find((td) => td.key.toLowerCase() === e.key.toLowerCase());
      if (t) setTool(t.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ---------------------------------------------------- interactions
  const dragRef = useRef<{ lastX: number; lastY: number; target: { kind: 'food' | 'nest'; id: number } | null; acc: number } | null>(null);

  const toWorld = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return rendererRef.current!.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  };

  const inWorld = (p: { x: number; y: number }) => p.x >= 0 && p.y >= 0 && p.x <= world.width && p.y <= world.height;

  const brushFor = (t: Tool) => (t === 'wallDraw' || t === 'wallErase' || t === 'antsRemove' ? editRef.current.brushRadius : t === 'antsAdd' ? 14 : 0);

  const paintStroke = (x0: number, y0: number, x1: number, y1: number, value: 0 | 1) => {
    const r = editRef.current.brushRadius;
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(d / (r * 0.4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      world.paintWall(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, value);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = toWorld(e);
    if (!inWorld(p)) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const t = toolRef.current;
    const active = world.colonyById(activeRef.current);
    dragRef.current = { lastX: p.x, lastY: p.y, target: null, acc: 0 };

    switch (t) {
      case 'select': {
        const a = world.antAt(p.x, p.y, 10);
        if (a) {
          setSelection({ kind: 'ant', id: a.id });
          setTab('inspector');
          break;
        }
        const f = world.foodAt(p.x, p.y);
        if (f) {
          setSelection({ kind: 'food', id: f.id });
          setTab('inspector');
          break;
        }
        const n = world.nestAt(p.x, p.y);
        if (n) {
          setSelection({ kind: 'nest', id: n.id });
          setActiveColonyId(n.colonyId);
          setTab('inspector');
          break;
        }
        setSelection(null);
        break;
      }
      case 'foodAdd': {
        const f = world.addFood(p.x, p.y, editRef.current.foodAmount);
        setSelection({ kind: 'food', id: f.id });
        break;
      }
      case 'foodMove': {
        const f = world.foodAt(p.x, p.y);
        if (f) {
          dragRef.current.target = { kind: 'food', id: f.id };
          setSelection({ kind: 'food', id: f.id });
        }
        break;
      }
      case 'foodRemove': {
        const f = world.foodAt(p.x, p.y);
        if (f) {
          world.removeFood(f.id);
          if (selection?.kind === 'food' && selection.id === f.id) setSelection(null);
        }
        break;
      }
      case 'nestAdd': {
        if (!active) {
          notify('Create a colony first (Colonies tab).');
          break;
        }
        const n = world.addNest(active.id, p.x, p.y);
        setSelection({ kind: 'nest', id: n.id });
        break;
      }
      case 'nestMove': {
        const n = world.nestAt(p.x, p.y);
        if (n) {
          dragRef.current.target = { kind: 'nest', id: n.id };
          setSelection({ kind: 'nest', id: n.id });
        }
        break;
      }
      case 'nestRemove': {
        const n = world.nestAt(p.x, p.y);
        if (n) {
          world.removeNest(n.id);
          if (selection?.kind === 'nest' && selection.id === n.id) setSelection(null);
        }
        break;
      }
      case 'antsAdd': {
        if (!active) {
          notify('Create a colony first (Colonies tab).');
          break;
        }
        world.spawnAnts(active, editRef.current.antsPerClick, p.x, p.y);
        break;
      }
      case 'antsRemove':
        world.removeAntsNear(p.x, p.y, editRef.current.brushRadius);
        break;
      case 'wallDraw':
        world.paintWall(p.x, p.y, editRef.current.brushRadius, 1);
        break;
      case 'wallErase':
        world.paintWall(p.x, p.y, editRef.current.brushRadius, 0);
        break;
    }
    refresh();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = toWorld(e);
    const t = toolRef.current;
    cursorRef.current = { x: p.x, y: p.y, radius: brushFor(t), visible: inWorld(p) && brushFor(t) > 0 };
    const d = dragRef.current;
    if (!d) return;
    const active = world.colonyById(activeRef.current);
    switch (t) {
      case 'wallDraw':
        paintStroke(d.lastX, d.lastY, p.x, p.y, 1);
        break;
      case 'wallErase':
        paintStroke(d.lastX, d.lastY, p.x, p.y, 0);
        break;
      case 'antsRemove':
        world.removeAntsNear(p.x, p.y, editRef.current.brushRadius);
        break;
      case 'antsAdd': {
        d.acc += Math.hypot(p.x - d.lastX, p.y - d.lastY);
        if (d.acc > 24 && active) {
          d.acc = 0;
          world.spawnAnts(active, Math.max(1, Math.round(editRef.current.antsPerClick / 3)), p.x, p.y);
        }
        break;
      }
      case 'foodMove': {
        if (d.target?.kind === 'food') {
          const f = world.foodById(d.target.id);
          if (f) world.moveFood(f, p.x, p.y);
        }
        break;
      }
      case 'nestMove': {
        if (d.target?.kind === 'nest') {
          const n = world.nests.find((k) => k.id === d.target!.id);
          if (n) world.moveNest(n, p.x, p.y);
        }
        break;
      }
    }
    d.lastX = p.x;
    d.lastY = p.y;
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onPointerLeave = () => {
    cursorRef.current.visible = false;
  };

  // ----------------------------------------------------------- actions
  const handleReset = () => {
    // Restart with the current layout: refill food, respawn ants, clear pheromones.
    const s = world.toSetup();
    for (const f of s.food) f.amount = f.maxAmount;
    world.loadSetup(s);
    setSelection(null);
    refresh();
  };

  const loadDefault = () => {
    world.loadSetup(defaultScenario(world));
    paintDefaultWalls(world);
    setActiveColonyId(world.colonies[0]?.id ?? -1);
    setSelection(null);
    refresh();
  };

  const handleRandom = () => {
    randomScenario(world, Math.floor(Math.random() * 1e9));
    setActiveColonyId(world.colonies[0]?.id ?? -1);
    setSelection(null);
    refresh();
    notify('Random map generated');
  };

  const handleClearWorld = () => {
    world.clearAll(true);
    setSelection(null);
    refresh();
    notify('World cleared — place nests and food, then add ants');
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(world.toSetup()));
    notify('Setup saved to browser storage');
  };

  const applySetup = (s: WorldSetup) => {
    world.loadSetup(s);
    setActiveColonyId(world.colonies[0]?.id ?? -1);
    setSelection(null);
    refresh();
  };

  const handleLoad = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      notify('No saved setup found');
      return;
    }
    try {
      applySetup(JSON.parse(raw));
      notify('Setup loaded');
    } catch {
      notify('Saved setup is corrupted');
    }
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(world.toSetup(), null, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ant-colony-setup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (file: File) => {
    file.text().then((txt) => {
      try {
        applySetup(JSON.parse(txt));
        notify('Setup imported');
      } catch {
        notify('Could not parse setup file');
      }
    });
  };

  const activeColony = world.colonyById(activeColonyId);
  const totalAnts = world.ants.length;
  const secs = Math.floor(world.tick / 60);
  const currentTool = TOOLS.find((t) => t.id === tool)!;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#12100e] text-stone-200">
      {/* ------------------------------------------------------- top bar */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-stone-800 bg-[#1a1613] px-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-500/20 text-amber-300">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
              <ellipse cx="12" cy="17" rx="3.5" ry="4.5" />
              <circle cx="12" cy="10.5" r="2.5" />
              <circle cx="12" cy="6" r="2" />
              <path d="M9.5 10l-4-2M14.5 10l4-2M9 15l-4 1M15 15l4 1M10 19l-3 3M14 19l3 3" stroke="currentColor" strokeWidth="1.2" fill="none" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-wide text-stone-100">Formicarium</div>
            <div className="text-[10px] text-stone-500">emergent ant colony sandbox</div>
          </div>
        </div>

        <div className="mx-2 h-6 w-px bg-stone-800" />

        <Btn variant={running ? 'default' : 'primary'} onClick={() => setRunning((r) => !r)} title="Space" className="w-24">
          {running ? (
            <>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
              Pause
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>
              {world.tick > 0 ? 'Resume' : 'Start'}
            </>
          )}
        </Btn>
        <Btn onClick={handleReset} title="Restart with the current layout">Reset</Btn>

        <div className="ml-1 flex items-center rounded-md border border-stone-700 bg-stone-900/60 p-0.5">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={cn(
                'rounded px-2 py-1 text-[11px] font-medium',
                speed === s ? 'bg-amber-400/25 text-amber-100' : 'text-stone-400 hover:text-stone-200',
              )}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="ml-2 hidden items-center gap-3 font-mono text-[11px] text-stone-400 md:flex">
          <span>
            t=<span className="text-stone-200">{secs}s</span>
          </span>
          <span>
            ants <span className="text-stone-200">{totalAnts}</span>
          </span>
          <span className={cn(running ? 'text-emerald-400' : 'text-stone-500')}>{running ? '● running' : '○ paused'}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-500">Active colony</span>
          <select
            value={activeColonyId}
            onChange={(e) => setActiveColonyId(parseInt(e.target.value))}
            className="rounded border border-stone-700 bg-stone-900 px-2 py-1 text-xs text-stone-100"
            style={{ borderColor: activeColony?.traits.color }}
          >
            {world.colonies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.traits.name}
              </option>
            ))}
          </select>
        </div>
        <Btn onClick={loadDefault} title="Reload the default demonstration scenario">Demo</Btn>
        <Btn onClick={handleRandom}>Random</Btn>
        <Btn
          active={view.showPheromones}
          onClick={() => setView({ ...view, showPheromones: !view.showPheromones })}
          title="Toggle pheromone overlay"
        >
          Pheromones
        </Btn>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ------------------------------------------------------ toolbar */}
        <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-stone-800 bg-[#1a1613] py-2">
          {TOOLS.map((t, i) => (
            <div key={t.id} className="contents">
              {i > 0 && TOOLS[i - 1].group !== t.group && <div className="my-1 h-px w-8 bg-stone-800" />}
              <button
                type="button"
                title={`${t.label} (${t.key})`}
                onClick={() => setTool(t.id)}
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-lg border transition-colors',
                  tool === t.id
                    ? 'border-amber-400/70 bg-amber-400/20 text-amber-100'
                    : 'border-transparent text-stone-400 hover:bg-stone-800 hover:text-stone-100',
                )}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={t.icon} />
                </svg>
              </button>
            </div>
          ))}
        </nav>

        {/* ------------------------------------------------------- world */}
        <main className="relative min-w-0 flex-1 bg-[#12100e]">
          <canvas
            ref={canvasRef}
            className={cn('absolute inset-0 h-full w-full', tool === 'select' ? 'cursor-default' : 'cursor-crosshair')}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
          {/* tool hint */}
          <div className="pointer-events-none absolute top-2 left-2 flex items-center gap-2 rounded-md border border-stone-800/80 bg-[#1a1613]/85 px-2.5 py-1.5 text-[11px] backdrop-blur">
            <span className="font-semibold text-amber-200">{currentTool.label}</span>
            <span className="text-stone-400">{currentTool.hint}</span>
            {(tool === 'nestAdd' || tool === 'antsAdd') && activeColony && (
              <span className="flex items-center gap-1 text-stone-300">
                → <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeColony.traits.color }} />
                {activeColony.traits.name}
              </span>
            )}
          </div>
          {/* legend */}
          <div className="pointer-events-none absolute bottom-2 left-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-stone-800/80 bg-[#1a1613]/85 px-2.5 py-1.5 text-[10px] text-stone-400 backdrop-blur">
            {world.colonies.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded-sm" style={{ background: c.traits.color }} />
                {c.traits.name}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#6fbf3a]" /> food
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-4 rounded-sm bg-[#5f554b]" /> rock
            </span>
            {view.showPheromones && (
              <>
                <span className="text-stone-600">|</span>
                {view.pheromoneTypes.food && <span>food trail = colony glow</span>}
                {view.pheromoneTypes.home && <span>home = pale halo</span>}
                {view.pheromoneTypes.alarm && <span className="text-rose-300">alarm = red</span>}
                {view.pheromoneTypes.explore && <span>exploration = grey</span>}
              </>
            )}
          </div>
          {toast && (
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-md border border-amber-500/40 bg-[#1a1613]/95 px-3 py-1.5 text-xs text-amber-100 shadow-lg">
              {toast}
            </div>
          )}
        </main>

        {/* -------------------------------------------------------- panel */}
        <aside className="flex w-[330px] shrink-0 flex-col border-l border-stone-800 bg-[#171310] xl:w-[360px]">
          <div className="flex shrink-0 border-b border-stone-800">
            {(
              [
                ['colonies', 'Colonies'],
                ['inspector', 'Inspector'],
                ['stats', 'Stats'],
                ['world', 'World'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'flex-1 border-b-2 px-2 py-2 text-xs font-medium transition-colors',
                  tab === id ? 'border-amber-400 text-amber-100' : 'border-transparent text-stone-500 hover:text-stone-200',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-3">
            {tab === 'colonies' && (
              <ColonyPanel world={world} activeColonyId={activeColonyId} onSelectColony={setActiveColonyId} onChange={refresh} />
            )}
            {tab === 'inspector' && <InspectorPanel world={world} selection={selection} onSelect={setSelection} onChange={refresh} />}
            {tab === 'stats' && <StatsPanel world={world} />}
            {tab === 'world' && (
              <WorldPanel
                world={world}
                view={view}
                setView={setView}
                edit={edit}
                setEdit={setEdit}
                onChange={refresh}
                onSave={handleSave}
                onLoad={handleLoad}
                onExport={handleExport}
                onImport={() => fileRef.current?.click()}
                onRandom={handleRandom}
                onClearWorld={handleClearWorld}
                onDefault={loadDefault}
              />
            )}
          </div>
        </aside>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
