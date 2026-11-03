import { useEffect, useRef } from "react";
import { SpectralSolver, type SolverParams, type Telemetry } from "../solver/SpectralNS";
import { DIVERGING, cssGradient, hueRGB, type ColorMap } from "../solver/colormaps";
import { ColorBar, LED } from "./widgets";
import { cn } from "../utils/cn";

interface Props {
  params: SolverParams;
  N: number;
  colormap: ColorMap;
  running: boolean;
  preset: number;
  seed: number;
  profiling: boolean;
  tel: Telemetry;
  onReady: (s: SpectralSolver) => void;
  onTelemetry: (t: Telemetry) => void;
  onError: (msg: string) => void;
}

const LEGEND: Record<string, { label: string; unit: string; diverging: boolean }> = {
  dye: { label: "ink concentration", unit: "c", diverging: false },
  speed: { label: "speed |u|", unit: "L·t⁻¹", diverging: false },
  vorticity: { label: "vorticity ω = ẑ·(∇×u)", unit: "t⁻¹", diverging: true },
  pressure: { label: "pressure p/ρ", unit: "L²·t⁻²", diverging: true },
  divergence: { label: "|∇·u|·h/|u| (log)", unit: "relative", diverging: false },
  spectrum: { label: "|div̂(k)| (log)", unit: "mode", diverging: false },
};

export default function SimViewport({
  params,
  N,
  colormap,
  running,
  preset,
  seed,
  profiling,
  tel,
  onReady,
  onTelemetry,
  onError,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const solverRef = useRef<SpectralSolver | null>(null);
  const runningRef = useRef(running);
  const profileRef = useRef(profiling);
  const telRef = useRef(onTelemetry);
  const crossRef = useRef<HTMLDivElement>(null);

  runningRef.current = running;
  profileRef.current = profiling;
  telRef.current = onTelemetry;

  /* ---- boot ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let solver: SpectralSolver;
    try {
      solver = new SpectralSolver(canvas, N);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
      return;
    }
    solverRef.current = solver;
    solver.setColormap(colormap);
    solver.initPreset(preset, seed);
    onReady(solver);

    const dpr = () => Math.min(2, window.devicePixelRatio || 1);
    const fit = () => solver.resizeCanvas(wrap.clientWidth, wrap.clientHeight, dpr());
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);

    let raf = 0;
    let last = performance.now();
    let fps = 60;
    let frameMs = 16;
    let lastTel = 0;
    let frame = 0;
    let stages: { label: string; ms: number }[] = [];
    let stepMs = 0;

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const rawDt = now - last;
      last = now;
      frameMs = frameMs * 0.9 + rawDt * 0.1;
      fps = 1000 / Math.max(1e-3, frameMs);
      frame++;

      const t0 = performance.now();
      if (runningRef.current) {
        const sub = Math.max(1, Math.min(4, solver.params.stepsPerFrame));
        if (profileRef.current && frame % 48 === 0) {
          solver.beginProfile();
          for (let i = 0; i < sub; i++) solver.step();
          stages = solver.endProfile();
        } else {
          for (let i = 0; i < sub; i++) solver.step();
        }
      }
      stepMs = stepMs * 0.85 + (performance.now() - t0) * 0.15;

      if (!runningRef.current) solver.flushSplats();
      solver.render(now / 1000);
      if (frame % 6 === 0) solver.requestStats();
      solver.pollStats();

      if (now - lastTel > 110) {
        lastTel = now;
        solver.tel.fps = fps;
        solver.tel.frameMs = frameMs;
        solver.tel.stepMs = stepMs;
        solver.tel.stages = stages;
        telRef.current({ ...solver.tel });
      }
    };
    raf = requestAnimationFrame(loop);

    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
      onError("The WebGL context was lost (GPU reset or memory pressure). Reload to restart the solver.");
    };
    canvas.addEventListener("webglcontextlost", onLost);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("webglcontextlost", onLost);
      solver.destroy();
      solverRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- live parameter sync ---- */
  useEffect(() => {
    const s = solverRef.current;
    if (s) s.params = { ...params };
  }, [params]);

  useEffect(() => {
    const s = solverRef.current;
    if (s) s.setColormap(colormap);
  }, [colormap]);

  useEffect(() => {
    const s = solverRef.current;
    if (!s || s.N === N) return;
    try {
      s.allocate(N);
      s.initPreset(preset, seed);
    } catch (e) {
      onError(
        `Could not allocate the ${N}×${N} lattice — ${e instanceof Error ? e.message : String(e)} Pick a smaller grid.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [N]);

  /* ---- pointer forcing ---- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let down = false;
    let px = 0;
    let py = 0;
    let lastT = 0;
    let hue = 0.55;

    const moveCross = (cx: number, cy: number, visible: boolean) => {
      const el = crossRef.current;
      const wrap = wrapRef.current;
      if (!el || !wrap) return;
      const r = wrap.getBoundingClientRect();
      el.style.opacity = visible ? "1" : "0";
      el.style.transform = `translate3d(${cx - r.left}px, ${cy - r.top}px, 0)`;
    };

    const onDown = (e: PointerEvent) => {
      down = true;
      lastT = performance.now();
      canvas.setPointerCapture(e.pointerId);
      const s = solverRef.current;
      if (!s) return;
      const p = s.clientToUV(e.clientX, e.clientY);
      px = p.x;
      py = p.y;
      hue = (hue + 0.13) % 1;
      const rad = Math.min(0.09, Math.max(0.009, 13 / s.N));
      if (p.inside) s.queueSplat(p.x, p.y, 0, 0, hueRGB(hue, 0.95, 0.55), rad * 1.35, 0.85);
    };

    const onMove = (e: PointerEvent) => {
      const s = solverRef.current;
      moveCross(e.clientX, e.clientY, true);
      if (!s || !down) return;
      const p = s.clientToUV(e.clientX, e.clientY);
      const now = performance.now();
      const dtms = Math.max(8, now - lastT);
      lastT = now;
      const dx = p.x - px;
      const dy = p.y - py;
      px = p.x;
      py = p.y;
      if (!p.inside) return;
      const gain = 26;
      const f = (16.7 / dtms) * gain;
      const rad = Math.min(0.09, Math.max(0.009, 13 / s.N));
      s.queueSplat(p.x, p.y, dx * f, dy * f, hueRGB((hue + Math.hypot(dx, dy) * 6) % 1, 0.95, 0.56), rad, 0.5);
    };

    const onUp = (e: PointerEvent) => {
      down = false;
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
    };
    const onLeave = () => moveCross(0, 0, false);

    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", onLeave);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const leg = LEGEND[params.displayMode];
  const grad = leg.diverging ? cssGradient(DIVERGING) : cssGradient(colormap.stops);
  const divOk = tel.relDivergence < 2e-2 || tel.rmsDivergence === 0;
  const divText = tel.rmsDivergence > 0 ? tel.rmsDivergence.toExponential(1).replace("e", "×10^") : "—";
  const divClass = divOk ? "text-lime" : "text-magenta";

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none" />

      {/* instrument reticle */}
      <div
        ref={crossRef}
        className="pointer-events-none absolute top-0 left-0 z-20 h-0 w-0 opacity-0 transition-opacity duration-200"
      >
        <div className="absolute -top-[13px] -left-[13px] h-[26px] w-[26px] rounded-full border border-cyan/40" />
        <div className="absolute top-[-1px] left-[-19px] h-[2px] w-[12px] bg-cyan/60" />
        <div className="absolute top-[-1px] left-[7px] h-[2px] w-[12px] bg-cyan/60" />
        <div className="absolute top-[-19px] left-[-1px] h-[12px] w-[2px] bg-cyan/60" />
        <div className="absolute top-[7px] left-[-1px] h-[12px] w-[2px] bg-cyan/60" />
      </div>

      {/* corner brackets */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {(
          [
            ["top-2 left-2", "border-t border-l"],
            ["top-2 right-2", "border-t border-r"],
            ["bottom-2 left-2", "border-b border-l"],
            ["bottom-2 right-2", "border-b border-r"],
          ] as const
        ).map(([pos, b]) => (
          <span key={pos} className={cn("absolute h-4 w-4 border-cyan/35", pos, b)} />
        ))}
      </div>

      {/* HUD */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 font-mono">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-[3px] border border-line/80 bg-ink/70 px-2.5 py-1.5 backdrop-blur-sm">
            <div className="text-[9px] tracking-[0.22em] text-mist/60 uppercase">lattice</div>
            <div className="tabular text-[15px] leading-tight font-medium text-cyan">
              {tel.N || N}<span className="text-mist/50">×</span>{tel.N || N}
            </div>
            <div className="tabular text-[8.5px] tracking-[0.14em] text-mist/45 uppercase">
              {((tel.N || N) ** 2 / 1e6).toFixed(2)} M cells · t = {tel.simTime.toFixed(2)} · n = {tel.steps}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2 rounded-[3px] border border-line/80 bg-ink/70 px-2.5 py-1.5 backdrop-blur-sm">
              <LED on={running} color="#b6f24a" />
              <span className="tabular text-[11px] text-chalk/90">
                {running ? "RUNNING" : "HELD"}
              </span>
              <span className="text-mist/30">|</span>
              <span className="tabular text-[11px] text-amber">{params.bfecc ? "BFECC" : "SL-1"}</span>
            </div>
            <div className="flex items-center gap-2 rounded-[3px] border border-line/80 bg-ink/70 px-2.5 py-1 text-right backdrop-blur-sm">
              <span className="text-[8.5px] tracking-[0.18em] text-mist/55 uppercase">∇·u</span>
              <span className={cn("tabular text-[11px]", divClass)}>{divText}</span>
              <LED on={divOk} color={divOk ? "#b6f24a" : "#ff5d8f"} />
            </div>
            <div className="flex items-center gap-2 rounded-[3px] border border-line/80 bg-ink/70 px-2.5 py-1 text-right backdrop-blur-sm">
              <span className="text-[8.5px] tracking-[0.18em] text-mist/55 uppercase">fps</span>
              <span className="tabular text-[11px] text-chalk/90">{tel.fps.toFixed(0)}</span>
              <span className="text-mist/30">·</span>
              <span className="tabular text-[11px] text-amber">{tel.stepMs.toFixed(1)}ms</span>
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-3">
          <ColorBar gradient={grad} lo={leg.diverging ? "−max" : "0"} hi={leg.diverging ? "+max" : "max"} label={leg.label} unit={leg.unit} />
          <div className="rounded-[3px] border border-line/80 bg-ink/70 px-2.5 py-1.5 text-right text-[9.5px] tracking-[0.12em] text-mist/70 uppercase backdrop-blur-sm">
            <div className="text-chalk/80">{params.displayMode.replace("spectrum", "fourier |div̂(k)|")}</div>
            <div className="mt-[2px] text-mist/50 normal-case">drag inside the field to inject momentum + ink</div>
          </div>
        </div>
      </div>
    </div>
  );
}
