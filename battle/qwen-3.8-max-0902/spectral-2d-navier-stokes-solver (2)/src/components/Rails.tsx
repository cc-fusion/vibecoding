import { PRESETS, type SolverParams, type Telemetry } from "../solver/SpectralNS";
import { COLORMAPS, type ColorMap } from "../solver/colormaps";
import type { DisplayMode } from "../solver/SpectralNS";
import { Btn, LED, Metric, Panel, Segmented, Slider, Sparkline, StageBars, Toggle } from "./widgets";
import { cn } from "../utils/cn";

const sci = (x: number, d = 2) => {
  if (!isFinite(x)) return "—";
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  if (e >= -2 && e < 4) return x.toFixed(Math.max(0, d - e));
  return `${(x / 10 ** e).toFixed(d)}e${e}`;
};

export interface RailProps {
  params: SolverParams;
  set: (patch: Partial<SolverParams>) => void;
  N: number;
  setN: (n: number) => void;
  running: boolean;
  setRunning: (b: boolean) => void;
  preset: number;
  seed: number;
  colormap: ColorMap;
  setColormap: (c: ColorMap) => void;
  applyPreset: (id: number, newSeed?: number) => void;
  reseed: () => void;
  clearField: () => void;
  stepOnce: () => void;
  tel: Telemetry;
  history: { fps: number[]; ms: number[]; energy: number[] };
  gpuName: string;
}

const RES = [128, 256, 512, 1024, 2048];

const NONE = "" as DisplayMode;
const FIELDS: { mode: DisplayMode; short: string; label: string }[] = [
  { mode: "dye", short: "ink", label: "passive scalar transport" },
  { mode: "speed", short: "|u|", label: "velocity magnitude" },
  { mode: "vorticity", short: "ω", label: "vorticity ∇×u" },
];
const DIAGS: { mode: DisplayMode; short: string; label: string }[] = [
  { mode: "pressure", short: "p", label: "Poisson solution p/ρ" },
  { mode: "divergence", short: "∇·u", label: "divergence residual, log scale" },
  { mode: "spectrum", short: "f̂(k)", label: "Fourier magnitude of ∇·u*" },
];

export function ControlRail(p: RailProps) {
  const { params, set } = p;
  return (
    <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
      <Panel title="Lattice" accent="cyan" tag={<span>{p.tel.gpuMB.toFixed(0)} MB VRAM</span>}>
        <Segmented
          options={RES.map((r) => ({ value: r, label: r >= 1024 ? `${r / 1024}k` : String(r) }))}
          value={p.N}
          onChange={(v) => p.setN(v)}
        />
        <div className="mt-2 grid grid-cols-2 gap-[3px] font-mono text-[9px] tracking-wide text-mist/60">
          <div className="rounded-[2px] border border-line/60 px-1.5 py-1">
            cells <span className="tabular float-right text-chalk/80">{((p.N * p.N) / 1e6).toFixed(2)}M</span>
          </div>
          <div className="rounded-[2px] border border-line/60 px-1.5 py-1">
            h <span className="tabular float-right text-chalk/80">{sci(1 / p.N)}</span>
          </div>
        </div>
        {p.N >= 2048 && (
          <div className="mt-2 flex items-start gap-1.5 rounded-[2px] border border-amber/30 bg-amber/[0.07] px-2 py-1.5 font-mono text-[9px] leading-relaxed tracking-wide text-amber/90">
            <span className="mt-[1px]">▲</span>
            <span>2048² allocates ≈{Math.round(p.tel.gpuMB || 420)} MB of float render targets. Requires a desktop-class GPU.</span>
          </div>
        )}
      </Panel>

      <Panel title="Integrator" accent="amber" tag={<span>chorin · 1 step</span>}>
        <Slider label="Δt  timestep" value={params.dt} min={0.0005} max={0.04} step={0.0005} accent="#ffb454"
          onChange={(v) => set({ dt: v })} format={(v) => v.toFixed(4)} />
        <Slider label="ν  kinematic viscosity" value={Math.max(params.viscosity, 1e-7)} min={1e-7} max={0.01} step={1e-6}
          log accent="#ff8a5c" onChange={(v) => set({ viscosity: v })} format={(v) => (v < 1e-6 ? "≈0" : sci(v))} />
        <Slider label="substeps / frame" value={params.stepsPerFrame} min={1} max={4} step={1} accent="#8f7bff"
          onChange={(v) => set({ stepsPerFrame: Math.round(v) })} format={(v) => `${v.toFixed(0)}×`} />
        <div className="my-1.5 h-px hairline opacity-40" />
        <Toggle label="BFECC correction" hint="back-and-forth error compensation" value={params.bfecc}
          onChange={(v) => set({ bfecc: v })} accent="#b6f24a" />
        <Toggle label="Vorticity confinement" hint="re-injects dissipated enstrophy" accent="#ff5d8f"
          value={params.vorticityConfinement > 0}
          onChange={(v) => set({ vorticityConfinement: v ? 3.5 : 0 })} />
        {params.vorticityConfinement > 0 && (
          <Slider label="ε  confinement" value={params.vorticityConfinement} min={0.2} max={14} step={0.1}
            accent="#ff5d8f" onChange={(v) => set({ vorticityConfinement: v })} format={(v) => v.toFixed(1)} />
        )}
        <Slider label="ink decay / step" value={params.dyeDissipation} min={0.98} max={1} step={0.0005} accent="#43dfe6"
          onChange={(v) => set({ dyeDissipation: v })} format={(v) => v.toFixed(4)} />
        <Slider label="momentum decay / step" value={params.velDissipation} min={0.98} max={1} step={0.0005} accent="#5ee0a0"
          onChange={(v) => set({ velDissipation: v })} format={(v) => v.toFixed(4)} />
      </Panel>

      <Panel title="Initial field" accent="magenta" tag={<span>ψ-based · ∇·u = 0</span>}>
        <div className="space-y-[3px]">
          {PRESETS.map((pre) => (
            <button
              key={pre.id}
              type="button"
              onClick={() => p.applyPreset(pre.id)}
              className={cn(
                "group flex w-full items-center gap-2 rounded-[3px] border px-2 py-[7px] text-left transition-all duration-150",
                p.preset === pre.id
                  ? "border-magenta/50 bg-magenta/[0.09]"
                  : "border-transparent bg-white/[0.015] hover:border-line2 hover:bg-white/[0.045]",
              )}
            >
              <span className={cn("h-[22px] w-[2px] rounded-full transition-colors", p.preset === pre.id ? "bg-magenta" : "bg-line2 group-hover:bg-mist/60")} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-[12px] font-medium", p.preset === pre.id ? "text-chalk" : "text-chalk/80")}>{pre.name}</span>
                <span className="block truncate font-mono text-[9px] tracking-wide text-mist/55">{pre.blurb}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <Btn onClick={p.reseed} className="flex-1">re-roll seed</Btn>
          <Btn onClick={p.clearField} variant="danger" className="flex-1">purge field</Btn>
        </div>
        <div className="mt-2 flex gap-1.5">
          <Btn onClick={() => p.setRunning(!p.running)} variant="primary" className="flex-1">
            {p.running ? "❚❚ hold" : "▶ run"}
          </Btn>
          <Btn onClick={p.stepOnce} className="flex-1" title="advance exactly one Chorin step">step ⋙ 1</Btn>
        </div>
      </Panel>

      <Panel title="Forcing" accent="lime">
        <Toggle label="Kolmogorov stirring" hint="time-drifting large-scale ψ forcing" accent="#b6f24a"
          value={params.stirring} onChange={(v) => set({ stirring: v })} />
        {params.stirring && (
          <Slider label="stir acceleration" value={params.stirStrength} min={0.005} max={0.6} step={0.005} accent="#b6f24a"
            onChange={(v) => set({ stirStrength: v })} format={(v) => v.toFixed(3)} />
        )}
        <p className="mt-1.5 px-1.5 font-mono text-[9px] leading-relaxed tracking-wide text-mist/45">
          balanced against the momentum-drag slider: the field relaxes to a statistical steady state instead of
          accelerating without bound.
        </p>
      </Panel>

      <Panel title="Render" accent="cyan">
        <Segmented
          options={FIELDS.map((f) => ({ value: f.mode, label: f.short }))}
          value={FIELDS.some((f) => f.mode === params.displayMode) ? params.displayMode : (NONE as DisplayMode)}
          onChange={(v) => set({ displayMode: v })}
        />
        <Segmented
          className="mt-[3px]"
          options={DIAGS.map((f) => ({ value: f.mode, label: f.short, title: f.label }))}
          value={DIAGS.some((f) => f.mode === params.displayMode) ? params.displayMode : (NONE as DisplayMode)}
          onChange={(v) => set({ displayMode: v })}
        />
        <div className="my-2 h-px hairline opacity-40" />
        <div className="grid grid-cols-5 gap-[3px]">
          {COLORMAPS.map((c) => {
            const active = p.colormap.id === c.id;
            return (
              <button key={c.id} type="button" title={c.name} onClick={() => p.setColormap(c)}
                className={cn("h-6 rounded-[2px] border transition-all duration-150",
                  active ? "border-cyan shadow-[0_0_12px_-3px_#43dfe6]" : "border-line hover:border-line2")}
                style={{ background: `linear-gradient(180deg, ${c.stops.map((s, i) => `rgb(${s.join(",")}) ${(i / (c.stops.length - 1)) * 100}%`).join(",")})` }}
              />
            );
          })}
        </div>
        <Slider label="exposure" value={params.exposure} min={0.3} max={3.5} step={0.05} accent="#43dfe6"
          onChange={(v) => set({ exposure: v })} format={(v) => `${v.toFixed(2)}×`} />
        <Toggle label="auto-range scalar fields" value={params.autoScale} onChange={(v) => set({ autoScale: v })} />
        {!params.autoScale && (
          <Slider label="field gain" value={params.fieldScale} min={0.05} max={8} step={0.05} accent="#ffb454"
            onChange={(v) => set({ fieldScale: v })} format={(v) => `${v.toFixed(2)}×`} />
        )}
        <Toggle label="lattice overlay" hint="one square = 32×32 real cells" value={params.showGrid}
          onChange={(v) => set({ showGrid: v })} accent="#8f7bff" />
      </Panel>
    </div>
  );
}

export function TelemetryRail(p: RailProps) {
  const { tel } = p;
  const rel = tel.relDivergence;
  const divQuality = rel === 0 ? 1 : Math.max(0, Math.min(1, 1 - Math.log10(Math.max(rel, 1e-8)) / -8));
  const fftFlops = 2 * 5 * tel.modes * Math.log2(Math.max(2, p.N));
  const directFlops = Math.pow(p.N, 4);

  return (
    <div className="flex flex-col gap-2.5 overflow-y-auto pr-1">
      <Panel title="Throughput" accent="lime" tag={<LED on={p.running} color="#b6f24a" label={p.running ? "live" : "held"} />}>
        <div className="grid grid-cols-2 gap-[3px]">
          <Metric label="frames / s" value={tel.fps.toFixed(1)} accent="#b6f24a" />
          <Metric label="gpu step" value={tel.stepMs.toFixed(2)} unit="ms" accent="#ffb454" />
        </div>
        <div className="mt-2">
          <Sparkline data={p.history.fps} color="#b6f24a" label="fps" height={38} max={Math.max(65, ...p.history.fps)} />
        </div>
        <div className="mt-1">
          <Sparkline data={p.history.ms} color="#ffb454" label="step ms" height={38} min={0} />
        </div>
      </Panel>

      <Panel title="Stage breakdown" accent="amber" tag={<span className="text-mist/45">gl.finish()</span>}>
        {tel.stages.length ? (
          <StageBars stages={tel.stages} total={tel.stages.reduce((a, b) => a + b.ms, 0)} />
        ) : (
          <div className="py-4 text-center font-mono text-[10px] tracking-[0.14em] text-mist/40 uppercase">
            sampling…
          </div>
        )}
      </Panel>

      <Panel title="Incompressibility" accent="cyan" tag={<LED on={rel < 2e-2} color={rel < 2e-2 ? "#b6f24a" : "#ff5d8f"} />}>
        <div className="flex items-end gap-2">
          <span className="tabular font-mono text-[26px] leading-none font-semibold text-cyan">
            {tel.rmsDivergence > 0 ? tel.rmsDivergence.toExponential(2) : "—"}
          </span>
          <span className="mb-[2px] font-mono text-[9.5px] tracking-[0.16em] text-mist/60 uppercase">rms ∇·u</span>
        </div>
        <div className="mt-2 font-mono text-[9px] leading-relaxed tracking-wide text-mist/60">
          relative to U/h · <span className="tabular text-chalk/85">{rel > 0 ? rel.toExponential(2) : "—"}</span>
        </div>
        <div className="mt-2 h-[6px] w-full overflow-hidden rounded-[1px] bg-white/[0.05]">
          <div className="h-full rounded-[1px] bg-gradient-to-r from-lime via-cyan to-magenta transition-[width] duration-500"
            style={{ width: `${Math.max(3, divQuality * 100)}%` }} />
        </div>
        <div className="mt-1 flex justify-between font-mono text-[8px] tracking-[0.14em] text-mist/40 uppercase">
          <span>iterative</span><span>exact projection</span>
        </div>
        <p className="mt-2 border-t border-line/70 pt-2 text-[10.5px] leading-relaxed text-mist/70">
          The Poisson problem is inverted <em>directly</em> in Fourier space — no Jacobi, no Gauss–Seidel, no multigrid.
          All {tel.modes.toLocaleString()} modes are corrected in a single pass; only the four-mode null space of a
          collocated central stencil (the pressure gauge + checkerboard) is left pinned at zero.
        </p>
      </Panel>

      <Panel title="Field integrals" accent="magenta">
        <div className="grid grid-cols-2 gap-[3px]">
          <Metric label="kinetic energy" value={sci(tel.energy, 3)} accent="#ff5d8f" sub="½∫|u|² dA" />
          <Metric label="enstrophy" value={sci(tel.enstrophy, 3)} accent="#ffb454" sub="½∫ω² dA" />
          <Metric label="u max" value={sci(tel.uMax, 3)} unit="L/t" accent="#43dfe6" />
          <Metric label="u rms" value={sci(tel.rmsU, 3)} unit="L/t" accent="#5ee0a0" />
          <Metric label="ω rms" value={sci(tel.rmsOmega, 3)} unit="1/t" accent="#8f7bff" />
          <Metric label="reynolds" value={tel.reynolds > 1e6 ? ">1e6" : sci(tel.reynolds, 3)} accent="#e8f3f7" sub="U·L/ν" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-[3px] font-mono text-[9px]">
          <div className={cn("rounded-[2px] border px-1.5 py-1", tel.cfl > 1 ? "border-magenta/50 bg-magenta/10 text-magenta" : "border-line/60 text-mist/70")}>
            CFL <span className="tabular float-right">{tel.cfl.toFixed(2)}</span>
          </div>
          <div className={cn("rounded-[2px] border px-1.5 py-1", tel.diffusionSubsteps >= 24 ? "border-amber/50 bg-amber/10 text-amber" : "border-line/60 text-mist/70")}>
            νΔt/h² <span className="tabular float-right">
              {tel.diffusionNumber < 1e-6
                ? "≈0"
                : `${tel.diffusionNumber.toFixed(2)}${tel.diffusionSubsteps > 1 ? ` ×${tel.diffusionSubsteps}` : ""}`}
            </span>
          </div>
        </div>
        {(tel.cfl > 1 || tel.diffusionSubsteps >= 24) && (
          <div className="mt-2 rounded-[2px] border border-amber/30 bg-amber/[0.07] px-2 py-1.5 font-mono text-[9px] leading-relaxed text-amber/90">
            {tel.diffusionSubsteps >= 24
              ? "Diffusion sub-cycling hit its cap of 24 explicit Laplacian passes — lower ν or Δt for an exact viscous decay."
              : "CFL > 1: the departure point crosses more than one cell per step. Semi-Lagrangian stays unconditionally stable but smears vorticity — BFECC compensates."}
          </div>
        )}
        <div className="mt-2">
          <Sparkline data={p.history.energy} color="#ff5d8f" label="energy" height={40} min={0} fill />
        </div>
      </Panel>

      <Panel title="Spectral cost" accent="cyan" tag={<span>O(N² log N)</span>}>
        <div className="space-y-[5px] font-mono text-[9.5px]">
          {[
            ["modes solved / step", tel.modes.toLocaleString()],
            ["butterflies / step", `${sci(fftFlops / 10, 2)}`],
            ["fft passes / step", `${2 * Math.log2(p.N) * 2}`],
            ["dense LU equivalent", sci(directFlops, 2)],
            ["speed-up vs dense", `${sci(directFlops / Math.max(1, fftFlops), 2)}×`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-line/50 pb-[3px] last:border-0">
              <span className="tracking-wide text-mist/60">{k}</span>
              <span className="tabular text-cyan">{v}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 truncate border-t border-line/70 pt-2 font-mono text-[8.5px] tracking-wide text-mist/40" title={p.gpuName}>
          {p.gpuName}
        </div>
      </Panel>
    </div>
  );
}
