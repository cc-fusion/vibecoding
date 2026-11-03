import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SimViewport from "./components/SimViewport";
import Method, { type EnergySample } from "./components/Method";
import { ControlRail, TelemetryRail, type RailProps } from "./components/Rails";
import { Btn, LED } from "./components/widgets";
import { COLORMAPS } from "./solver/colormaps";
import {
  PRESETS,
  defaultParams,
  type DisplayMode,
  type SolverParams,
  type SpectralSolver,
  type Telemetry,
} from "./solver/SpectralNS";
import { cn } from "./utils/cn";

const EMPTY_TEL: Telemetry = {
  fps: 0, stepMs: 0, frameMs: 16, stages: [], rmsDivergence: 0, relDivergence: 0,
  uMax: 0, rmsU: 0, rmsOmega: 0, energy: 0, enstrophy: 0, reynolds: 0, cfl: 0,
  diffusionNumber: 0, diffusionSubsteps: 0, N: 512, steps: 0, simTime: 0, fftMs: 0, gpuMB: 0, modes: 262144,
};

export default function App() {
  const [params, setParams] = useState<SolverParams>({ ...defaultParams, displayMode: "dye" });
  const [N, setN] = useState(512);
  const [running, setRunning] = useState(true);
  const [preset, setPreset] = useState(2);
  const [seed, setSeed] = useState(1.7);
  const [colormap, setColormap] = useState(COLORMAPS[0]);
  const [profiling, setProfiling] = useState(true);
  const [tel, setTel] = useState<Telemetry>(EMPTY_TEL);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState({ fps: [] as number[], ms: [] as number[], energy: [] as number[] });
  const [series, setSeries] = useState<EnergySample[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const solverRef = useRef<SpectralSolver | null>(null);
  const histRef = useRef({ fps: [] as number[], ms: [] as number[], energy: [] as number[], series: [] as EnergySample[] });
  const e0Ref = useRef(0);

  const set = useCallback((patch: Partial<SolverParams>) => setParams((prev) => ({ ...prev, ...patch })), []);

  const onTelemetry = useCallback((t: Telemetry) => {
    const h = histRef.current;
    const push = (arr: number[], v: number, cap = 130) => {
      arr.push(v);
      if (arr.length > cap) arr.shift();
    };
    push(h.fps, t.fps);
    push(h.ms, t.stepMs);
    push(h.energy, t.energy);
    if (t.energy > e0Ref.current) e0Ref.current = t.energy;
    h.series.push({ t: t.simTime, e: e0Ref.current > 0 ? t.energy / e0Ref.current : 0 });
    if (h.series.length > 320) h.series.shift();
    setTel(t);
    setHistory({ fps: [...h.fps], ms: [...h.ms], energy: [...h.energy] });
    setSeries([...h.series]);
  }, []);

  const onReady = useCallback((s: SpectralSolver) => {
    solverRef.current = s;
    s.params = { ...params };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSeries = () => {
    histRef.current.series = [];
    histRef.current.energy = [];
    e0Ref.current = 0;
    setSeries([]);
  };

  const applyPreset = useCallback(
    (id: number, newSeed?: number) => {
      const s = solverRef.current;
      const sd = newSeed ?? seed;
      setPreset(id);
      if (newSeed !== undefined) setSeed(newSeed);
      const spec = PRESETS.find((x) => x.id === id)!;
      setParams((prev) => ({
        ...prev,
        viscosity: spec.viscosity || prev.viscosity,
        // the analytic Taylor–Green reference needs pure physics: no stirring, no drag
        stirring: id === 0 ? false : prev.stirring,
        velDissipation: id === 0 ? 1 : prev.velDissipation,
      }));
      resetSeries();
      s?.initPreset(id, sd);
    },
    [seed],
  );

  const reseed = useCallback(() => {
    const sd = Math.round(Math.random() * 9000 + 100) / 100;
    setSeed(sd);
    resetSeries();
    solverRef.current?.initPreset(preset, sd);
  }, [preset]);

  const clearField = useCallback(() => {
    resetSeries();
    solverRef.current?.clearAll();
  }, []);

  const stepOnce = useCallback(() => {
    const s = solverRef.current;
    if (!s) return;
    setRunning(false);
    s.step();
    s.requestStats();
    s.render(performance.now() / 1000);
  }, []);

  const snapshot = useCallback(() => {
    const s = solverRef.current;
    if (!s) return;
    const url = s.snapshot();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `chorin-spectral-${s.N}x${s.N}-step${s.steps}.png`;
    a.click();
    setFlash("frame exported");
    window.setTimeout(() => setFlash(null), 1600);
  }, []);

  /* keyboard transport */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        setRunning((r) => !r);
      } else if (e.key === "r" || e.key === "R") {
        applyPreset(preset);
      } else if (e.key === "b" || e.key === "B") {
        setParams((p) => ({ ...p, bfecc: !p.bfecc }));
      } else if (e.key >= "1" && e.key <= "6") {
        const modes: DisplayMode[] = ["dye", "speed", "vorticity", "pressure", "divergence", "spectrum"];
        setParams((p) => ({ ...p, displayMode: modes[parseInt(e.key, 10) - 1] }));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyPreset, preset]);

  const railProps: RailProps = useMemo(
    () => ({
      params, set, N, setN, running, setRunning, preset, seed, colormap, setColormap,
      applyPreset, reseed, clearField, stepOnce, tel, history,
      gpuName: solverRef.current?.caps.renderer ?? "WebGL2 device",
    }),
    [params, set, N, running, preset, seed, colormap, applyPreset, reseed, clearField, stepOnce, tel, history],
  );

  const divOk = tel.relDivergence < 2e-2;

  return (
    <div className="min-h-screen">
      {/* ---------------- top bar ---------------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-void/88 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
          <div className="flex items-baseline gap-2.5">
            <h1 className="font-display text-[19px] leading-none font-extrabold tracking-[-0.02em] text-chalk">
              CHORIN<span className="text-cyan">//</span>SPECTRAL
            </h1>
            <span className="hidden font-mono text-[9px] tracking-[0.24em] text-mist/50 uppercase sm:inline">
              2-D incompressible navier–stokes · direct fourier projection
            </span>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] tracking-[0.1em]">
            <span className="hidden items-center gap-1.5 text-mist/60 md:flex">
              <span className="text-mist/40">GRID</span>
              <span className="tabular text-cyan">{N}²</span>
            </span>
            <span className="hidden items-center gap-1.5 text-mist/60 lg:flex">
              <span className="text-mist/40">∇·u</span>
              <span className={cn("tabular", divOk ? "text-lime" : "text-magenta")}>
                {tel.rmsDivergence > 0 ? tel.rmsDivergence.toExponential(1) : "—"}
              </span>
              <LED on={divOk} color={divOk ? "#b6f24a" : "#ff5d8f"} />
            </span>
            <span className="flex items-center gap-1.5 text-mist/60">
              <span className="text-mist/40">FPS</span>
              <span className="tabular text-chalk/90">{tel.fps.toFixed(0)}</span>
            </span>
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="text-mist/40">STEP</span>
              <span className="tabular text-amber">{tel.stepMs.toFixed(1)} ms</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Btn onClick={() => setRunning(!running)} variant="primary">{running ? "hold" : "run"}</Btn>
              <Btn onClick={snapshot} title="download the current frame as PNG">export</Btn>
              <Btn onClick={() => setProfiling(!profiling)} title="toggle per-stage GPU timing">
                {profiling ? "prof ✓" : "prof"}
              </Btn>
            </div>
          </div>
        </div>
        <div className="hairline h-px w-full opacity-60" />
      </header>

      {/* ---------------- instrument ---------------- */}
      <main className="mx-auto grid max-w-[1700px] grid-cols-1 gap-2.5 p-2.5 lg:h-[calc(100vh-50px)] lg:min-h-[640px] lg:grid-cols-[286px_minmax(0,1fr)_330px]">
        <div className="order-2 max-h-[46vh] lg:order-1 lg:max-h-none">
          <ControlRail {...railProps} />
        </div>

        <div className="relative order-1 min-h-[58vh] overflow-hidden rounded-sm border border-line bg-ink lg:order-2 lg:min-h-0">
          <SimViewport
            params={params}
            N={N}
            colormap={colormap}
            running={running && !error}
            preset={preset}
            seed={seed}
            profiling={profiling}
            tel={tel}
            onReady={onReady}
            onTelemetry={onTelemetry}
            onError={setError}
          />
          {flash && (
            <div className="pointer-events-none absolute top-1/2 left-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-[3px] border border-cyan/50 bg-ink/90 px-4 py-2 font-mono text-[11px] tracking-[0.2em] text-cyan uppercase">
              {flash}
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-void/92 p-8">
              <div className="max-w-[520px] rounded-sm border border-magenta/40 bg-panel p-5">
                <div className="font-mono text-[10px] tracking-[0.24em] text-magenta uppercase">initialisation failed</div>
                <p className="mt-3 text-[13px] leading-relaxed text-chalk/85">{error}</p>
                <p className="mt-3 text-[11.5px] leading-relaxed text-mist/60">
                  This solver requires WebGL2 with floating-point render targets (<span className="font-mono">EXT_color_buffer_float</span>).
                  Try a desktop browser with hardware acceleration enabled.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="order-3 max-h-[52vh] lg:max-h-none">
          <TelemetryRail {...railProps} />
        </div>
      </main>

      <div className="mx-auto max-w-[1700px] px-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2.5 pb-3 font-mono text-[9px] tracking-[0.18em] text-mist/40 uppercase">
          <span>[space] run / hold</span>
          <span>[r] reset field</span>
          <span>[b] bfecc</span>
          <span>[1…6] dye · |u| · ω · p · ∇·u · f̂(k)</span>
          <span className="ml-auto text-mist/30">drag inside the lattice to inject momentum</span>
        </div>
      </div>

      <Method energySeries={series} nu={params.viscosity} tgActive={preset === 0} N={N} />
    </div>
  );
}
