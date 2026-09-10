import { useEffect, useMemo, useRef, useState } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { Sandbox } from './sim/Sandbox';
import { Renderer } from './sim/Renderer';
import { InputController } from './sim/Input';
import { SandboxContext, useSandbox } from './sim/useSandbox';
import { Toolbar } from './components/Toolbar';
import { Inspector } from './components/Inspector';
import { StatusBar } from './components/StatusBar';
import { cn } from './utils/cn';

export default function App() {
  const sandbox = useMemo(() => new Sandbox(), []);
  return (
    <SandboxContext.Provider value={sandbox}>
      <Shell />
    </SandboxContext.Provider>
  );
}

function Shell() {
  const [panelOpen, setPanelOpen] = useState(() => (typeof window !== 'undefined' ? window.innerWidth >= 900 : true));
  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden bg-[#0b0f14] text-slate-200 antialiased">
      <Toolbar />
      <div className="relative flex min-h-0 flex-1">
        <SimulationView />
        <button
          type="button"
          title={panelOpen ? 'Hide inspector' : 'Show inspector'}
          onClick={() => setPanelOpen((v) => !v)}
          className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-md border border-slate-700 bg-[#0f141b]/90 text-slate-300 backdrop-blur hover:text-white"
        >
          {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
        </button>
        <div
          className={cn(
            'shrink-0 border-l border-slate-800 transition-[width] duration-200',
            panelOpen ? 'w-[300px]' : 'w-0 overflow-hidden border-l-0',
            'max-md:absolute max-md:inset-y-0 max-md:right-0 max-md:z-[5] max-md:shadow-2xl',
          )}
        >
          {panelOpen && <Inspector />}
        </div>
      </div>
      <StatusBar />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SimulationView() {
  const sb = useSandbox();
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<InputController | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const renderer = new Renderer(canvas);
    const input = new InputController(sb, canvas);
    inputRef.current = input;

    let initialised = false;
    const applySize = () => {
      const r = host.getBoundingClientRect();
      const w = Math.max(200, Math.floor(r.width));
      const h = Math.max(200, Math.floor(r.height));
      renderer.setSize(w, h);
      sb.resize(w, h);
      if (!initialised) {
        initialised = true;
        sb.loadInitialScene();
      }
    };
    applySize();
    const ro = new ResizeObserver(() => applySize());
    ro.observe(host);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      sb.advance(dt);
      renderer.render(sb);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      input.dispose();
      inputRef.current = null;
    };
  }, [sb]);

  const drawingPolygon = sb.draft?.kind === 'polygon';
  const polyPoints = drawingPolygon && sb.draft?.kind === 'polygon' ? sb.draft.points.length : 0;

  return (
    <div ref={hostRef} className="relative min-w-0 flex-1 overflow-hidden">
      <canvas ref={canvasRef} className="block touch-none select-none" style={{ touchAction: 'none' }} />

      {/* polygon drawing helper (also gives touch users a way to close/cancel) */}
      {drawingPolygon && (
        <div className="pointer-events-auto absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-md border border-slate-700 bg-[#0f141b]/90 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
          <span className="font-mono text-sky-300">{polyPoints}</span>
          <span>{polyPoints === 1 ? 'vertex' : 'vertices'}</span>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400">
            becomes <span className="text-slate-200">{sb.tools.polyTarget}</span>
          </span>
          <button
            type="button"
            disabled={polyPoints < 3}
            onClick={() => inputRef.current?.closePolygon()}
            className="rounded bg-sky-500/20 px-2 py-0.5 font-medium text-sky-200 hover:bg-sky-500/30 disabled:opacity-40"
          >
            Close shape
          </button>
          <button type="button" onClick={() => inputRef.current?.cancelPolygon()} className="rounded px-2 py-0.5 text-slate-400 hover:bg-slate-800 hover:text-white">
            Cancel
          </button>
        </div>
      )}

      {sb.tools.tool !== 'select' && !drawingPolygon && (
        <div className="pointer-events-none absolute left-3 top-3 rounded border border-slate-800 bg-[#0f141b]/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-sky-300/80">
          {sb.tools.tool === 'soft'
            ? `soft · ${sb.tools.softPreset}`
            : sb.tools.tool === 'polygon'
              ? `polygon · ${sb.tools.polyTarget}`
              : `${sb.tools.tool} · ${sb.tools.bodyMode}`}
        </div>
      )}
    </div>
  );
}
