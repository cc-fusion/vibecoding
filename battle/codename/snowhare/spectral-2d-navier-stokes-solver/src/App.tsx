import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import coreRaw from "./solver/core.js?raw";
import workerRaw from "./solver/worker.js?raw";
import templateRaw from "./solver/standalone-template.html?raw";
import standaloneRaw from "./solver/standalone-app.js?raw";

/* ------------------------------------------------------------------ types */

type Params = {
  N: number;
  viscosity: number;
  cfl: number;
  autoDt: boolean;
  dt: number;
  bfecc: boolean;
  implicitDiffusion: boolean;
  confinement: number;
  forceX: number;
  forceY: number;
  colorMode: string;
  showDye: boolean;
  autoSteps: boolean;
  stepsPerFrame: number;
  dyeAmount: number;
  stirRadius: number;
};

type Stats = {
  fps: number;
  stepMs: number;
  renderMs: number;
  steps: number;
  N: number;
  dt: number;
  maxDiv: number;
  energy: number;
  vmax: number;
  simTime: number;
};

type Backend = {
  setParams: (p: Partial<Params>) => void;
  resize: (w: number, h: number) => void;
  pointer: (x: number, y: number, dx: number, dy: number, down: boolean) => void;
  command: (cmd: "play" | "pause" | "step" | "reset") => void;
  stats: () => Stats | null;
  mode: "worker" | "main-thread";
};

const INITIAL: Params = {
  N: 512,
  viscosity: 1.5e-4,
  cfl: 0.45,
  autoDt: true,
  dt: 0.02,
  bfecc: true,
  implicitDiffusion: false,
  confinement: 0,
  forceX: 0,
  forceY: 0,
  colorMode: "vorticity",
  showDye: true,
  autoSteps: true,
  stepsPerFrame: 1,
  dyeAmount: 0.9,
  stirRadius: 0.03,
};

/* ---------------------------------------------------------------- backend
 * The solver core is a classic script (it publishes `globalThis.NS`).
 * It is instantiated twice:
 *   • inside a Web Worker built from a Blob URL (no extra asset is needed,
 *     so this keeps working when the whole app is inlined in one file),
 *   • on the main thread as a fallback when OffscreenCanvas is missing.
 * ------------------------------------------------------------------------- */

let backend: Backend | null = null;

function createBackend(
  canvas: HTMLCanvasElement,
  params: Params,
  onStats: (s: Stats) => void,
): Backend {
  const canUseWorker =
    typeof Worker !== "undefined" &&
    typeof (canvas as unknown as { transferControlToOffscreen?: unknown })
      .transferControlToOffscreen === "function";

  if (canUseWorker) {
    try {
      const blob = new Blob([coreRaw, "\n", workerRaw], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);
      const offscreen = (
        canvas as unknown as {
          transferControlToOffscreen: () => OffscreenCanvas;
        }
      ).transferControlToOffscreen();
      worker.postMessage(
        { type: "init", canvas: offscreen, width: 800, height: 600, params },
        [offscreen],
      );
      let last: Stats | null = null;
      worker.onmessage = (e: MessageEvent) => {
        if (e.data?.type === "stats") {
          last = e.data.stats as Stats;
          onStats(last);
        }
      };
      return {
        setParams: (p) => worker.postMessage({ type: "params", params: p }),
        resize: (w, h) => worker.postMessage({ type: "resize", width: w, height: h }),
        pointer: (x, y, dx, dy, down) =>
          worker.postMessage({ type: "pointer", x, y, dx, dy, down }),
        command: (cmd) => worker.postMessage({ type: "command", cmd }),
        stats: () => last,
        mode: "worker",
      };
    } catch (err) {
      console.warn("worker backend unavailable, falling back to main thread", err);
    }
  }

  // ---- main thread fallback
  const script = document.createElement("script");
  script.textContent = coreRaw;
  document.head.appendChild(script);
  const NS = (window as unknown as { NS: any }).NS;
  let last: Stats | null = null;
  const engine = new NS.Engine({
    ctx: canvas.getContext("2d"),
    params,
    onStats: (s: Stats) => {
      last = s;
      onStats(s);
    },
  });
  engine.start();
  return {
    setParams: (p) => engine.setParams(p),
    resize: () => {},
    pointer: (x, y, dx, dy, down) => engine.pointer(x, y, dx, dy, down),
    command: (cmd) => {
      if (cmd === "play") engine.start();
      else if (cmd === "pause") engine.stop();
      else if (cmd === "step") {
        engine.stop();
        engine.stepOnce();
      } else if (cmd === "reset") engine.reset();
    },
    stats: () => last,
    mode: "main-thread",
  };
}

/* ------------------------------------------------------------- components */

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-3 py-1">
      <span className="w-24 shrink-0 text-[11.5px] text-slate-400">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="min-w-0 flex-1 cursor-pointer accent-cyan-400"
      />
      <span className="w-16 shrink-0 text-right font-mono text-[11.5px] tabular-nums text-slate-200">
        {display}
      </span>
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
    >
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition ${
          checked ? "bg-cyan-500/80" : "bg-slate-600/70"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
            checked ? "left-3.5" : "left-0.5"
          }`}
        />
      </span>
      <span className="text-[12px] text-slate-300">{label}</span>
      {hint ? (
        <span className="ml-auto font-mono text-[10.5px] text-slate-500">{hint}</span>
      ) : null}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-slate-800/70 bg-slate-950/50 px-2.5 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={`font-mono text-[12.5px] tabular-nums ${
          tone ?? "text-slate-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- app */

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const statsRef = useRef<Stats | null>(null);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const [params, setParams] = useState<Params>(INITIAL);
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<"worker" | "main-thread">("worker");
  const [showInfo, setShowInfo] = useState(true);

  /* --- one-time backend bootstrap (outside React's effect lifecycle so
         that StrictMode's double mount cannot transfer the canvas twice) */
  useEffect(() => {
    if (backend || !canvasRef.current) return;
    const b = createBackend(canvasRef.current, INITIAL, (s) => {
      statsRef.current = s;
    });
    backend = b;
    setMode(b.mode);
  }, []);

  /* --- poll the stats for the UI */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (statsRef.current) setStats({ ...statsRef.current });
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  /* --- keep the drawing buffer in sync with the container */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const apply = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = stage.getBoundingClientRect();
      const w = Math.max(320, Math.floor(r.width * dpr));
      const h = Math.max(240, Math.floor(r.height * dpr));
      if (backend?.mode === "worker") {
        backend.resize(w, h);
      } else if (canvasRef.current) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
      }
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(stage);
    return () => ro.disconnect();
  }, [mode]);

  const patch = useCallback((p: Partial<Params>) => {
    setParams((old) => ({ ...old, ...p }));
    backend?.setParams(p);
  }, []);

  const toggleRun = useCallback(() => {
    setRunning((r) => {
      const next = !r;
      backend?.command(next ? "play" : "pause");
      return next;
    });
  }, []);

  /* --- pointer interaction: stir the flow and inject dye */
  const toField = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: 1 - (e.clientY - r.top) / r.height,
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toField(e);
    lastPointer.current = p;
    backend?.pointer(p.x, p.y, 0, 0, true);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!lastPointer.current) return;
    const p = toField(e);
    backend?.pointer(p.x, p.y, p.x - lastPointer.current.x, p.y - lastPointer.current.y, true);
    lastPointer.current = p;
  };
  const onPointerUp = () => {
    lastPointer.current = null;
  };

  /* --- download the self contained HTML/JS/CSS build */
  const downloadStandalone = useCallback(() => {
    const html = templateRaw
      .replace("/*__CORE__*/", () => coreRaw)
      .replace("/*__APP__*/", () => standaloneRaw);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "navier-stokes-2d-solver.html";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, []);

  const openStandalone = useCallback(() => {
    const html = templateRaw
      .replace("/*__CORE__*/", () => coreRaw)
      .replace("/*__APP__*/", () => standaloneRaw);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 20000);
  }, []);

  const n = params.N;
  const re = params.viscosity > 0 ? 1 / params.viscosity : Infinity;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#05070d] text-slate-200">
      {/* ---------------------------------------------------------- header */}
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-800/80 bg-[#0a0f1a] px-5 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/20">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-white" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M3 12c3-6 6 6 9 0s6 6 9 0" strokeLinecap="round" />
              <path d="M3 17c3-4 6 4 9 0s6 4 9 0" strokeLinecap="round" opacity=".5" />
            </svg>
          </div>
          <div>
            <h1 className="text-[13.5px] font-semibold leading-tight tracking-tight text-slate-100">
              2D Incompressible Navier–Stokes
            </h1>
            <p className="text-[10.5px] leading-tight text-slate-500">
              Chorin projection · spectral FFT Poisson solve · staggered MAC · periodic
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {[
            ["splitting", "Chorin"],
            ["pressure", "FFT · O(N log N)"],
            ["advection", "semi-Lagrangian"],
            ["layout", "MAC staggered"],
            ["BC", "periodic"],
          ].map(([k, v]) => (
            <span
              key={k}
              className="rounded-full border border-slate-800 bg-slate-900/60 px-2.5 py-[3px] text-[10px] uppercase tracking-wider text-slate-500"
            >
              {k} <span className="text-cyan-400">{v}</span>
            </span>
          ))}
          <span className="rounded-full border border-emerald-900/60 bg-emerald-950/30 px-2.5 py-[3px] text-[10px] uppercase tracking-wider text-emerald-400/90">
            {mode === "worker" ? "web worker" : "main thread"}
          </span>
          <button
            onClick={openStandalone}
            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11.5px] text-slate-200 transition hover:border-cyan-500/60 hover:text-white"
          >
            open standalone
          </button>
          <button
            onClick={downloadStandalone}
            className="rounded-lg border border-cyan-600/50 bg-cyan-500/10 px-3 py-1.5 text-[11.5px] text-cyan-200 transition hover:bg-cyan-500/20"
          >
            download .html
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------ body */}
      <div className="flex min-h-0 flex-1">
        {/* ------------------------------------------------------ controls */}
        <aside className="w-[268px] shrink-0 overflow-y-auto border-r border-slate-800/80 bg-[#080c15] px-3 py-3">
          <div className="mb-3 flex gap-2">
            <button
              onClick={toggleRun}
              className={`flex-1 rounded-lg px-3 py-2 text-[12px] font-medium transition ${
                running
                  ? "bg-cyan-600/20 text-cyan-200 border border-cyan-600/50"
                  : "bg-slate-800/70 text-slate-200 border border-slate-700"
              }`}
            >
              {running ? "⏸ pause" : "▶ run"}
            </button>
            <button
              onClick={() => {
                setRunning(false);
                backend?.command("step");
              }}
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[12px] text-slate-200 transition hover:border-slate-500"
            >
              step
            </button>
            <button
              onClick={() => backend?.command("reset")}
              className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-[12px] text-slate-200 transition hover:border-slate-500"
            >
              reset
            </button>
          </div>

          <Group title="discretisation">
            <label className="mb-1 flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11.5px] text-slate-400">grid</span>
              <select
                value={params.N}
                onChange={(e) => patch({ N: parseInt(e.target.value, 10) })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-[12px] text-slate-100 outline-none focus:border-cyan-500"
              >
                <option value={256}>256 × 256</option>
                <option value={512}>512 × 512</option>
                <option value={1024}>1024 × 1024</option>
                <option value={2048}>2048 × 2048</option>
              </select>
            </label>
            <p className="mb-1 pl-1 text-[10.5px] leading-snug text-slate-600">
              {n <= 1024
                ? "double precision fields · ~120 MB at 1024²"
                : "single precision fields (memory) · ~300 MB at 2048²"}
            </p>
            <Slider
              label="viscosity ν"
              min={0}
              max={100}
              value={Math.round(
                (Math.log10(params.viscosity) + 5) * (100 / 3),
              )}
              display={params.viscosity.toExponential(1)}
              onChange={(v) => patch({ viscosity: Math.pow(10, -5 + (v / 100) * 3) })}
            />
            <Slider
              label="CFL"
              min={5}
              max={100}
              value={Math.round(params.cfl * 100)}
              display={params.cfl.toFixed(2)}
              onChange={(v) => patch({ cfl: v / 100 })}
            />
            <Toggle
              label="BFECC advection"
              checked={params.bfecc}
              onChange={(v) => patch({ bfecc: v })}
              hint={params.bfecc ? "on" : "off"}
            />
            <Toggle
              label="implicit diffusion"
              checked={params.implicitDiffusion}
              onChange={(v) => patch({ implicitDiffusion: v })}
              hint={params.implicitDiffusion ? "spectral" : "explicit"}
            />
            <Slider
              label="vorticity conf."
              min={0}
              max={200}
              value={Math.round(params.confinement * 100)}
              display={params.confinement.toFixed(2)}
              onChange={(v) => patch({ confinement: v / 100 })}
            />
          </Group>

          <Group title="forcing & interaction">
            <Slider
              label="force x"
              min={-100}
              max={100}
              value={Math.round(params.forceX * 100)}
              display={params.forceX.toFixed(2)}
              onChange={(v) => patch({ forceX: v / 100 })}
            />
            <Slider
              label="force y"
              min={-100}
              max={100}
              value={Math.round(params.forceY * 100)}
              display={params.forceY.toFixed(2)}
              onChange={(v) => patch({ forceY: v / 100 })}
            />
            <Slider
              label="stir radius"
              min={5}
              max={120}
              value={Math.round(params.stirRadius * 1000)}
              display={`${(params.stirRadius * 100).toFixed(1)}%`}
              onChange={(v) => patch({ stirRadius: v / 1000 })}
            />
          </Group>

          <Group title="time stepping">
            <Toggle
              label="automatic Δt (CFL)"
              checked={params.autoDt}
              onChange={(v) => patch({ autoDt: v })}
              hint={params.autoDt ? "on" : "fixed"}
            />
            <Toggle
              label="adaptive steps / frame"
              checked={params.autoSteps}
              onChange={(v) => patch({ autoSteps: v })}
              hint={params.autoSteps ? "auto" : `${params.stepsPerFrame}`}
            />
            <Slider
              label="steps / frame"
              min={1}
              max={8}
              value={params.stepsPerFrame}
              display={String(params.stepsPerFrame)}
              onChange={(v) => patch({ stepsPerFrame: v })}
            />
          </Group>

          <Group title="rendering">
            <label className="mb-1 flex items-center gap-2">
              <span className="w-24 shrink-0 text-[11.5px] text-slate-400">field</span>
              <select
                value={params.colorMode}
                onChange={(e) => patch({ colorMode: e.target.value })}
                className="w-full rounded-lg border border-slate-700 bg-slate-950/70 px-2 py-1.5 text-[12px] text-slate-100 outline-none focus:border-cyan-500"
              >
                <option value="vorticity">vorticity ω</option>
                <option value="speed">speed |u|</option>
                <option value="pressure">pressure p</option>
                <option value="dye">dye</option>
                <option value="divergence">divergence</option>
              </select>
            </label>
            <Toggle
              label="dye overlay"
              checked={params.showDye}
              onChange={(v) => patch({ showDye: v })}
            />
          </Group>
        </aside>

        {/* --------------------------------------------------------- stage */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div
            ref={stageRef}
            className="relative min-h-0 flex-1 bg-[radial-gradient(1200px_700px_at_30%_15%,#0c1424_0%,#04060c_75%)]"
          >
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
              className="block h-full w-full cursor-crosshair touch-none"
            />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1 rounded-lg border border-slate-800/70 bg-slate-950/70 px-2.5 py-1.5 font-mono text-[10.5px] text-slate-400 backdrop-blur">
              <span>
                {n}² MAC grid · h = {(1 / n).toExponential(2)} · Re ≈{" "}
                {re > 0 ? re.toFixed(0) : "∞"}
              </span>
              <span>drag to stir · dye follows the cursor</span>
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg border border-slate-800/70 bg-slate-950/70 px-2.5 py-1.5 font-mono text-[10.5px] text-slate-400 backdrop-blur">
              max |∇·u| ={" "}
              <span className="text-emerald-400">
                {stats ? stats.maxDiv.toExponential(1) : "—"}
              </span>
            </div>
          </div>

          {/* ------------------------------------------------------ stats */}
          <div className="grid grid-cols-2 gap-2 border-t border-slate-800/80 bg-[#080c15] px-4 py-2.5 sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="frames / s" value={stats ? stats.fps.toFixed(1) : "—"} />
            <Stat label="time step" value={stats ? `${stats.stepMs.toFixed(1)} ms` : "—"} />
            <Stat label="render" value={stats ? `${stats.renderMs.toFixed(1)} ms` : "—"} />
            <Stat label="Δt" value={stats ? stats.dt.toExponential(2) : "—"} />
            <Stat
              label="max |div u|"
              value={stats ? stats.maxDiv.toExponential(1) : "—"}
              tone="text-emerald-400"
            />
            <Stat label="kinetic energy" value={stats ? stats.energy.toExponential(2) : "—"} />
            <Stat label="max |u|" value={stats ? stats.vmax.toFixed(3) : "—"} />
            <Stat label="sim time" value={stats ? `${stats.simTime.toFixed(2)} s` : "—"} />
          </div>
        </main>
      </div>

      {/* ------------------------------------------------------ method note */}
      <footer className="border-t border-slate-800/80 bg-[#0a0f1a] px-5 py-2">
        <button
          onClick={() => setShowInfo((s) => !s)}
          className="flex w-full items-center gap-2 text-left text-[11.5px] text-slate-400 transition hover:text-slate-200"
        >
          <span className="text-cyan-400">{showInfo ? "▾" : "▸"}</span>
          <span className="font-semibold uppercase tracking-wider text-slate-300">
            numerical method
          </span>
          <span className="hidden truncate sm:inline">
            {showInfo
              ? "splitting: advect (semi-Lagrangian + BFECC) → diffuse → project (direct FFT Poisson) → u ← u* − ∇φ, periodic BC, no iterative solvers"
              : ""}
          </span>
        </button>
        {showInfo && (
          <div className="mt-2 grid gap-3 text-[11.5px] leading-relaxed text-slate-400 md:grid-cols-3">
            <p>
              <b className="text-slate-200">Staggered MAC grid.</b> u lives on the x-faces,
              v on the y-faces, p at the cell centres and ω on the corners. All boundaries are
              periodic, so no ghost cells and no boundary treatment are needed.
            </p>
            <p>
              <b className="text-slate-200">Spectral projection.</b> The discrete divergence
              of the discrete gradient is exactly the 5-point Laplacian, whose Fourier symbol
              κ = 4[sin²(πm/N)+sin²(πn/N)]/h² is known analytically. The pressure is obtained
              with a direct 2D FFT (radix-2 DIF, permutation free) in O(N log N) — no
              relaxation, no iterations, no multigrid.
            </p>
            <p>
              <b className="text-slate-200">Advection.</b> Semi-Lagrangian backtracing with
              bilinear interpolation on flat typed arrays (branch free, wrap-around by bit
              masking). BFECC adds a forward/backward round trip that removes most of the
              numerical diffusion. The projection then restores an exactly divergence-free
              field (max |∇·u| stays at round-off level).
            </p>
          </div>
        )}
      </footer>
    </div>
  );
}
