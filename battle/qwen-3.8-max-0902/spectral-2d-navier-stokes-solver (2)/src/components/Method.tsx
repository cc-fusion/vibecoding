import { useMemo } from "react";
import { Reveal } from "./widgets";
import { cn } from "../utils/cn";

export interface EnergySample {
  t: number;
  e: number;
}

/* ------------------------------------------------------------------ */
/* typeset equations                                                  */
/* ------------------------------------------------------------------ */

function Eq({ n, children, note }: { n: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="group flex items-start gap-3 border-l border-line py-[7px] pl-3 transition-colors hover:border-cyan">
      <span className="tabular mt-[2px] w-6 shrink-0 font-mono text-[9px] text-mist/40">{n}</span>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[12.5px] leading-relaxed tracking-tight text-chalk/90">{children}</div>
        {note && <div className="mt-[3px] text-[11px] leading-relaxed text-mist/60">{note}</div>}
      </div>
    </div>
  );
}

const V = ({ children }: { children: React.ReactNode }) => <span className="text-cyan italic">{children}</span>;
const Op = ({ children }: { children: React.ReactNode }) => <span className="text-amber">{children}</span>;
const Sub = ({ children }: { children: React.ReactNode }) => <sub className="text-[9px] text-mist/70">{children}</sub>;
const Sup = ({ children }: { children: React.ReactNode }) => <sup className="text-[9px] text-mist/70">{children}</sup>;

/* ------------------------------------------------------------------ */
/* pipeline diagram                                                   */
/* ------------------------------------------------------------------ */

function Pipeline() {
  const nodes = [
    { t: "uⁿ", s: "divergence-free", c: "#43dfe6" },
    { t: "A(uⁿ)", s: "semi-Lagrangian", c: "#b6f24a" },
    { t: "+νΔt∇²u +Δt f", s: "explicit", c: "#b6f24a" },
    { t: "u*", s: "intermediate", c: "#ffb454" },
    { t: "∇·u*", s: "central diff", c: "#ffb454" },
    { t: "ℱ₂ᴰ", s: `${" "}log₂N passes`, c: "#8f7bff" },
    { t: "×G(k)", s: "direct inverse", c: "#8f7bff" },
    { t: "ℱ₂ᴰ⁻¹", s: "log₂N passes", c: "#8f7bff" },
    { t: "p", s: "pressure", c: "#ff5d8f" },
    { t: "uⁿ⁺¹", s: "u* − Δt∇p", c: "#43dfe6" },
  ];
  return (
    <div className="relative overflow-x-auto rounded-sm border border-line bg-ink/60 p-4">
      <div className="flex min-w-[880px] items-stretch gap-1.5">
        {nodes.map((nd, i) => (
          <div key={i} className="flex flex-1 items-center gap-1.5">
            <div
              className="group relative flex-1 rounded-[3px] border bg-panel2/80 px-2 py-2 text-center transition-all duration-200 hover:-translate-y-[2px]"
              style={{ borderColor: `${nd.c}55`, boxShadow: `inset 0 -14px 22px -18px ${nd.c}` }}
            >
              <div className="font-mono text-[12px] leading-tight font-medium" style={{ color: nd.c }}>
                {nd.t.trim()}
              </div>
              <div className="mt-[2px] font-mono text-[8px] tracking-[0.1em] text-mist/50 uppercase">{nd.s.trim()}</div>
              <span className="absolute -top-[3px] -left-[3px] h-[6px] w-[6px] rounded-full" style={{ background: nd.c }} />
            </div>
            {i < nodes.length - 1 && (
              <svg width="14" height="10" viewBox="0 0 14 10" className="shrink-0 text-line2">
                <path d="M0 5 H10 M8 2 L11 5 L8 8" stroke="currentColor" strokeWidth="1.2" fill="none" />
              </svg>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[9px] tracking-[0.14em] uppercase">
        {[
          ["#43dfe6", "state"],
          ["#b6f24a", "explicit transport"],
          ["#ffb454", "operator"],
          ["#8f7bff", "fourier core"],
          ["#ff5d8f", "pressure"],
        ].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5 text-mist/60">
            <span className="h-[6px] w-[6px] rotate-45" style={{ background: c }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Taylor–Green validation plot                                       */
/* ------------------------------------------------------------------ */

function DecayPlot({ series, nu, active }: { series: EnergySample[]; nu: number; active: boolean }) {
  const W = 560;
  const H = 210;
  const pad = { l: 46, r: 14, t: 14, b: 28 };
  const geo = useMemo(() => {
    const pts = series.filter((s) => s.e > 0 && s.t > 0);
    const e0 = series.length ? Math.max(...series.map((s) => s.e)) : 1;
    const tMax = Math.max(0.25, ...(pts.length ? pts.map((p) => p.t) : [0]));
    const X = (t: number) => pad.l + (t / tMax) * (W - pad.l - pad.r);
    const Y = (v: number) => {
      const lv = Math.log10(Math.max(v, 1e-12) / e0);
      return pad.t + ((lv - -3) / 3) * (H - pad.t - pad.b);
    };
    const meas = pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.e).toFixed(1)}`).join(" ");
    const an = active
      ? Array.from({ length: 60 }, (_, i) => {
          const t = (i / 59) * tMax;
          const e = e0 * Math.exp(-16 * Math.PI * Math.PI * nu * t);
          return `${i ? "L" : "M"}${X(t).toFixed(1)},${Y(e).toFixed(1)}`;
        }).join(" ")
      : "";
    return { meas, an, tMax, e0, X, Y };
  }, [series, nu, active]);

  return (
    <div className="rounded-sm border border-line bg-ink/70 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0, -1, -2, -3].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={geo.Y(Math.pow(10, v) * geo.e0)} y2={geo.Y(Math.pow(10, v) * geo.e0)}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={pad.l - 6} y={geo.Y(Math.pow(10, v) * geo.e0) + 3} textAnchor="end"
              className="fill-[#89a3b2] font-mono" fontSize="8">
              10^{v}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={geo.X(f * geo.tMax)} x2={geo.X(f * geo.tMax)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.035)" />
            <text x={geo.X(f * geo.tMax)} y={H - pad.b + 13} textAnchor="middle" className="fill-[#89a3b2] font-mono" fontSize="8">
              {(f * geo.tMax).toFixed(2)}
            </text>
          </g>
        ))}
        {geo.an && <path d={geo.an} fill="none" stroke="#ffb454" strokeWidth="1.4" strokeDasharray="4 3" opacity="0.9" />}
        {geo.meas && <path d={geo.meas} fill="none" stroke="#43dfe6" strokeWidth="1.8" />}
        <text x={W - pad.r} y={pad.t + 8} textAnchor="end" className="fill-[#89a3b2] font-mono" fontSize="8.5">
          E(t)/E₀  ·  t
        </text>
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-4 border-t border-line/70 pt-2 font-mono text-[9.5px] tracking-wide">
        <span className="flex items-center gap-1.5 text-cyan"><span className="h-[2px] w-5 bg-cyan" />measured (GPU)</span>
        <span className="flex items-center gap-1.5 text-amber"><span className="h-[2px] w-5 border-t-2 border-dashed border-amber" />analytic e<sup>−16π²νt</sup></span>
        <span className={cn("ml-auto", active ? "text-lime" : "text-mist/40")}>
          {active ? "Taylor–Green mode (1,1) · k² = 8π²" : "select the Taylor–Green preset to arm the reference"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* scaling table                                                      */
/* ------------------------------------------------------------------ */

function ScalingTable({ N }: { N: number }) {
  const rows = [128, 256, 512, 1024, 2048].map((n) => {
    const cells = n * n;
    const butterflies = 2 * cells * Math.log2(n) * 2; // 2 axes × (forward + inverse)
    return {
      n,
      cells,
      passes: 4 * Math.log2(n),
      butterflies,
      mb: (6 * cells * 8 + 4 * cells * 8 + (cells / 3) * 16) / 1048576,
      ratio: Math.pow(n / 128, 2) * (Math.log2(n) / Math.log2(128)),
    };
  });
  return (
    <div className="overflow-hidden rounded-sm border border-line">
      <table className="w-full border-collapse font-mono text-[10.5px]">
        <thead>
          <tr className="bg-panel2/70 text-[8.5px] tracking-[0.18em] text-mist/60 uppercase">
            {["N", "cells", "fft passes", "butterflies / step", "vram", "work vs 128²", ""].map((h) => (
              <th key={h} className="border-b border-line px-2 py-2 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.n} className={cn("transition-colors", r.n === N ? "bg-cyan/[0.07]" : "hover:bg-white/[0.02]")}>
              <td className="tabular border-b border-line/50 px-2 py-[7px]" style={{ color: r.n === N ? "#43dfe6" : "#e8f3f7" }}>
                {r.n}²{r.n === N && <span className="ml-1 text-[8px] text-cyan/70">●</span>}
              </td>
              <td className="tabular border-b border-line/50 px-2 py-[7px] text-mist/80">{(r.cells / 1e6).toFixed(3)}M</td>
              <td className="tabular border-b border-line/50 px-2 py-[7px] text-mist/80">{r.passes}</td>
              <td className="tabular border-b border-line/50 px-2 py-[7px] text-amber">{(r.butterflies / 1e6).toFixed(1)}M</td>
              <td className="tabular border-b border-line/50 px-2 py-[7px] text-mist/80">{r.mb.toFixed(0)} MB</td>
              <td className="tabular border-b border-line/50 px-2 py-[7px] text-lime">{r.ratio.toFixed(0)}×</td>
              <td className="w-[26%] border-b border-line/50 px-2 py-[7px]">
                <span className="block h-[5px] rounded-[1px] bg-white/[0.05]">
                  <span className="block h-full rounded-[1px] bg-gradient-to-r from-cyan to-violetish"
                    style={{ width: `${Math.min(100, (Math.log2(r.ratio) / Math.log2(rows[rows.length - 1].ratio)) * 100)}%` }} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Method({
  energySeries,
  nu,
  tgActive,
  N,
}: {
  energySeries: EnergySample[];
  nu: number;
  tgActive: boolean;
  N: number;
}) {
  return (
    <div className="mx-auto max-w-[1500px] px-4 pt-14 pb-20">
      <Reveal>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          <div>
            <div className="font-mono text-[10px] tracking-[0.34em] text-cyan/80 uppercase">§ 01 — numerical method</div>
            <h2 className="mt-2 font-display text-[clamp(30px,4.6vw,60px)] leading-[0.92] font-extrabold tracking-tight text-chalk">
              Chorin's projection,
              <br />
              <span className="text-mist/55">solved in Fourier space.</span>
            </h2>
          </div>
          <p className="max-w-[420px] text-[13px] leading-relaxed text-mist/70">
            One time step = one advection, one explicit diffusion, one <em>direct</em> Poisson inversion and one
            gradient subtraction. There is no iteration anywhere in the pipeline: the incompressibility constraint is
            satisfied mode-by-mode, exactly, in <span className="text-cyan">O(N² log N)</span>.
          </p>
        </div>
      </Reveal>

      <Reveal>
        <Pipeline />
      </Reveal>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_1fr]">
        <Reveal>
          <div>
            <h3 className="mb-3 font-display text-[19px] font-bold tracking-tight text-chalk">The splitting scheme</h3>
            <div className="rounded-sm border border-line bg-panel/70 px-3 py-2">
              <Eq n="1" note="Back-trace each cell centre along the velocity field and interpolate. Unconditionally stable for any Δt — the price is O(Δx²) numerical diffusion.">
                <V>u</V><Sub>1</Sub> = <Op>A</Op>(<V>u</V><Sub>n</Sub>) &nbsp;·&nbsp; semi-Lagrangian, bilinear
              </Eq>
              <Eq n="2" note="Explicit forward-Euler Laplacian. Stability requires νΔt/h² ≤ ¼; the solver clamps and flags it in the telemetry rail.">
                <V>u</V><Sub>2</Sub> = <V>u</V><Sub>1</Sub> + νΔt <Op>∇²</Op><V>u</V><Sub>1</Sub>
              </Eq>
              <Eq n="3" note="Pointer splats and the optional large-scale Kolmogorov stirring, both applied as divergence-free impulses.">
                <V>u</V><Sup>*</Sup> = <V>u</V><Sub>2</Sub> + Δt <V>f</V>
              </Eq>
              <Eq n="4" note="Second-order central differences on the collocated lattice. Periodicity is exact — the texture wrap mode does the halo exchange.">
                <Op>∇²</Op>p = <Op>∇·</Op><V>u</V><Sup>*</Sup> / Δt
              </Eq>
              <Eq n="5" note="The whole Poisson problem becomes a pointwise division by the symbol of the operator that was actually discretised. Four modes have λ = 0 and are pinned to zero — the mean fixes the pressure gauge ⟨p⟩ = 0.">
                p̂ = <Op>ℱ</Op>[∇·u<Sup>*</Sup>] / (λ<Sub>k</Sub> Δt N²)
              </Eq>
              <Eq n="6" note="∇· and ∇ are the same central difference, so ∇·uⁿ⁺¹ = ∇·u* − Δt·(∇·∇)p = 0 identically for every mode with λ ≠ 0. Measured on this GPU: float32 round-off, not truncation error.">
                <V>u</V><Sub>n+1</Sub> = <V>u</V><Sup>*</Sup> − Δt <Op>∇</Op>p
              </Eq>
            </div>
            <div className="mt-3 rounded-sm border border-line bg-panel/70 p-3">
              <div className="font-mono text-[9.5px] tracking-[0.2em] text-mist/50 uppercase">the symbol that matters</div>
              <div className="mt-1.5 font-mono text-[14px] text-cyan">
                λ<Sub>k,l</Sub> = −h<Sup>−2</Sup>[ sin²(2πk/N) + sin²(2πl/N) ]
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-mist/65">
                Composing two central first differences yields the <em>wide</em> stencil
                (p<Sub>i+2</Sub>−2p<Sub>i</Sub>+p<Sub>i−2</Sub>)/4h², whose symbol is sin²(2πk/N) — not the compact
                5-point Laplacian's 4sin²(πk/N). Inverting the wrong one leaves an O(h²) divergence residue
                (≈1e-3 relative); inverting the right one drives it to <span className="text-lime">2e-16</span> in
                double-precision reference runs.
              </p>
              <p className="mt-2 border-t border-line/60 pt-2 text-[11.5px] leading-relaxed text-mist/65">
                The price of a <em>collocated</em> layout: λ vanishes on the four modes with k, l ∈ {"{0, N/2}"}. The
                mean mode is the usual pressure gauge; the three checkerboard modes are invisible to a central
                difference pair — the classical odd–even decoupling. They are pinned to zero by an exact integer test,
                and bilinear semi-Lagrangian transport damps them anyway. A staggered MAC layout would remove the
                degeneracy entirely at the cost of four interpolations per projection.
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div>
            <h3 className="mb-3 font-display text-[19px] font-bold tracking-tight text-chalk">
              Direct spectral core <span className="text-mist/45">— no iterations</span>
            </h3>
            <div className="space-y-3">
              <div className="rounded-sm border border-line bg-panel/70 p-3">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-[9.5px] tracking-[0.2em] text-violetish uppercase">stockham auto-sort</span>
                  <span className="ml-auto font-mono text-[9px] text-mist/45">radix-2 · natural order</span>
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-mist/70">
                  Each of the 2·log₂N passes is a single full-screen draw: one fragment computes one butterfly output.
                  The invariant is that after pass <span className="font-mono text-chalk/85">s</span> the texture holds
                  N/2<Sup>s</Sup> contiguous blocks of length 2<Sup>s</Sup>, block R being the DFT of the strided samples{" "}
                  <span className="font-mono text-chalk/85">x[R + j·N/2<Sup>s</Sup>]</span> — so the output arrives in
                  natural order and the bit-reversal permutation, with all of its scattered memory traffic, simply
                  never happens.
                </p>
                <div className="mt-2 rounded-[3px] border border-line/70 bg-void/60 p-2 font-mono text-[10.5px] leading-relaxed text-mist/80">
                  m = 2<Sup>s</Sup>, mh = m/2, &nbsp;R ∈ [0,N/m), t ∈ [0,mh)<br />
                  a = X[R·mh + t] &nbsp; b = X[R·mh + t + N/2]<br />
                  w = exp(σ·2πi·t/m)<br />
                  <span className="text-cyan">Y[R·m + t] = a + w·b</span> &nbsp;{" "}
                  <span className="text-magenta">Y[R·m + t + mh] = a − w·b</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-mist/55">
                  On the GPU the two branches are folded into one output index q: R = q/m, t = q mod mh, and the sign is
                  decided by which half of the block q falls in — one conditional, two texture fetches, zero barriers.
                </p>
              </div>
              <div className="rounded-sm border border-line bg-panel/70 p-3">
                <div className="font-mono text-[9.5px] tracking-[0.2em] text-lime uppercase">separable 2-D transform</div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-mist/70">
                  log₂N passes along <span className="text-chalk/85">x</span>, then log₂N along <span className="text-chalk/85">y</span>,
                  ping-ponging between two RG32F targets. No transpose texture, no shared-memory tiling, no barriers —
                  the row/column split is just a swapped <span className="font-mono text-chalk/85">ivec2</span> in{" "}
                  <span className="font-mono text-chalk/85">texelFetch</span>.
                </p>
              </div>
              <div className="rounded-sm border border-line bg-panel/70 p-3">
                <div className="font-mono text-[9.5px] tracking-[0.2em] text-amber uppercase">BFECC limiter</div>
                <div className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-mist/80">
                  <div>φ₁ = A(φ₀, −Δt) <span className="text-mist/40">// back-trace</span></div>
                  <div>φ₂ = A(φ₁, +Δt) <span className="text-mist/40">// undo</span></div>
                  <div className="text-lime">φ̃₀ = φ₀ + ½(φ₀ − φ₂) <span className="text-mist/40">// 2nd-order fix</span></div>
                  <div>φ<Sup>n+1</Sup> = A(clamp<Sub>AABB</Sub>(φ̃₀), −Δt)</div>
                </div>
                <p className="mt-2 text-[11.5px] leading-relaxed text-mist/70">
                  Three advections instead of one buys second-order temporal accuracy and removes most of the
                  numerical diffusion, while the 3×3 local bounding-box clamp kills the overshoot ringing that plain
                  BFECC produces at sharp vorticity fronts.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      <Reveal>
        <div className="mt-12 grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div>
            <h3 className="mb-3 font-display text-[19px] font-bold tracking-tight text-chalk">Validation · Taylor–Green decay</h3>
            <p className="mb-3 text-[12px] leading-relaxed text-mist/70">
              For the single mode (1,1) on the unit torus the exact solution is{" "}
              <span className="font-mono text-chalk/85">u(x,t) = u₀(x)e^(−8π²νt)</span>, so the kinetic energy must
              fall as <span className="font-mono text-amber">e^(−16π²νt)</span>. The plot compares that closed form
              against what the GPU actually produces, live.
            </p>
            <DecayPlot series={energySeries} nu={nu} active={tgActive} />
          </div>
          <div>
            <h3 className="mb-3 font-display text-[19px] font-bold tracking-tight text-chalk">Cost of resolution</h3>
            <p className="mb-3 text-[12px] leading-relaxed text-mist/70">
              Doubling N multiplies the work by ≈4·(log₂N+1)/log₂N — the hallmark of an N² log N method. A dense
              factorisation of the same Poisson matrix would cost N⁴.
            </p>
            <ScalingTable N={N} />
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-12 grid gap-3 md:grid-cols-3">
          {[
            {
              t: "Collocated lattice, periodic torus",
              d: "Velocity and pressure share the same N×N grid. The wrap-around halo is handled by GL_REPEAT texture addressing, so every stencil — including the advection back-trace — is periodic for free with zero branching.",
              c: "#43dfe6",
            },
            {
              t: "Fully vectorised, zero explicit loops",
              d: "Advection is one bilinear texture fetch per cell per step; the GPU's sampler hardware performs the 2×2 interpolation. The host never touches a field array — everything stays resident in VRAM between frames.",
              c: "#b6f24a",
            },
            {
              t: "Asynchronous diagnostics",
              d: "Global integrals (‖∇·u‖, E, Z, u_max) are accumulated in a single pass and folded to 1×1 by a texelFetch box-reduction, then read back through a pixel-pack buffer with a GPU fence — no pipeline stall in the render loop.",
              c: "#ffb454",
            },
          ].map((card) => (
            <div key={card.t} className="group relative overflow-hidden rounded-sm border border-line bg-panel/70 p-4 transition-colors hover:border-line2">
              <span className="absolute inset-x-0 top-0 h-[2px] opacity-60 transition-opacity group-hover:opacity-100" style={{ background: card.c }} />
              <h4 className="font-display text-[14.5px] font-bold tracking-tight text-chalk">{card.t}</h4>
              <p className="mt-2 text-[11.5px] leading-relaxed text-mist/65">{card.d}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <footer className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 font-mono text-[9.5px] tracking-[0.16em] text-mist/40 uppercase">
        <span>chorin//spectral · webgl2 · rg32f · stockham fft</span>
        <span>drag the field to inject momentum · scroll to explore the method</span>
      </footer>
    </div>
  );
}
