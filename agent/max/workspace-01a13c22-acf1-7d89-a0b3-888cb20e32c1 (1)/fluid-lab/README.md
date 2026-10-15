# FLUX — Fluid Dynamics Lab

A GPU-resident, 2D incompressible Navier–Stokes playground in **plain HTML, CSS, JavaScript, and WebGL 2 / GLSL**. Rebuilt from the supplied CPU Canvas2D example for million-cell domains. No React, TypeScript, libraries, build step, external assets, tracking, or runtime network dependencies.

The previous voxel project is archived separately as `../voxel-core.zip`; its unpacked source has been removed. This folder is a new, independent project.

## Run

```sh
cd fluid-lab
python3 -m http.server 3000 --bind 0.0.0.0
```

Open `http://localhost:3000`. Alternatively, `npm start` runs the same Python command. Any static HTTP server works. Serve over HTTP, not `file://`, because the project uses browser ES modules.

Requires **WebGL 2 and EXT_color_buffer_float**. GPU timer queries are optional. Hardware acceleration is strongly recommended. No float-linear texture extension is needed: bilinear interpolation is implemented manually using four nearest texel fetches.

The default domain is **1024 × 1024**, with 256², 512², and 2048² in the selector. `?size=64` is useful on software-rendered browsers and for development. The solver accepts power-of-two sizes from 16 through 2048; arbitrary sizes and larger allocations are deliberately rejected.

## What changed

- CPU cell loops and fresh `ImageData` allocation every frame → reusable GPU Float32 textures and fullscreen numerical kernels.
- Collocated, loosely coupled fields → **staggered MAC** velocity placement with compatible divergence and gradient operators.
- Repeated relaxation pressure solve → **direct Stockham FFT Poisson solver**.
- Advection → parallel semi-Lagrangian bilinear sampling, with an optional **full BFECC** path and donor-extrema clamp.
- Repeated diffusion sweeps → one **explicit five-point diffusion** update with a stability-enforced time step.
- Global mouse listeners → canvas-only pointer capture, touch support, periodic brush injection, and separate dye/stir modes.
- Per-frame scalar fading → exponential decay in simulation time.
- Added meaningful diagnostics, GPU backpressure, allocation limits, pause/single-step, field views, presets, PNG capture, and tests.
- Removed external references, embedded analytics, and unrelated scripts from the supplied example.

## Numerical method

### Domain and MAC layout

The square domain has side length `L = 1`. Let `n` be the grid width, `N = n²` the total cell count, and `h = 1/n`.

At texel `(i,j)`, a packed RGBA32F state stores:

| Channel | Quantity | Physical position |
| --- | --- | --- |
| R | horizontal velocity `uᵢⱼ` | `((i+1)h, (j+1/2)h)` — right face |
| G | vertical velocity `vᵢⱼ` | `((i+1/2)h, (j+1)h)` — top face |
| B | passive dye concentration `cᵢⱼ` | `((i+1/2)h, (j+1/2)h)` — cell center |
| A | unused | — |

Pressure impulse is cell-centered. **Every side is periodic**, including advection interpolation, diffusion, pressure gradients, and divergence. Integer texel access wraps with `index & (n−1)`, valid because `n` is a power of two. The two velocity components are interpolated at their own face locations, not incorrectly treated as collocated data.

### Chorin splitting

One first-order split step is:

1. Apply explicit viscosity, damping, and external brush impulses:
   `w = exp(−γ Δt) [uⁿ + ν Δt Lₕuⁿ] + impulse`.
2. Advect velocity and passive dye using the frozen field `w`, producing intermediate `u*`.
3. Solve for pressure impulse `q = Δt p` with unit mass density:
   `Dₕ Gₕ q = Dₕ u*`.
4. Project:
   `uⁿ⁺¹ = u* − Gₕ q`.

Equivalently, `p` solves `Lₕp = (Dₕu*)/Δt`, and projection subtracts `Δt Gₕp`. Solving for `q` avoids division by a small time step and is sufficient for the correction. The **Pressure view displays this impulse**, not thermodynamic pressure. Divide `q` by the effective time step if physical pressure units are needed.

Divergence is backward and the gradient is forward on the staggered layout:

```text
Dₕ(u,v)ᵢⱼ = (uᵢⱼ − uᵢ₋₁,ⱼ + vᵢⱼ − vᵢ,ⱼ₋₁) / h
Gₕqᵢⱼ    = ((qᵢ₊₁,ⱼ − qᵢⱼ)/h, (qᵢ,ⱼ₊₁ − qᵢⱼ)/h)
```

Their composition is exactly the periodic five-point Laplacian. This compatibility matters: dividing by the continuum `−|k|²` symbol instead would not exactly project this **discrete** divergence.

### Direct spectral pressure solution

For each nonzero Fourier frequency:

```text
λ(kx,ky) = −4/h² [sin²(πkx/n) + sin²(πky/n)]
q̂(k)     = FFT(Dₕu*)(k) / λ(k)
q         = inverseFFT(q̂)
```

The DC coefficient is set to zero: pressure is defined up to a constant, and the periodic Poisson RHS must have zero mean. Discrete divergence telescopes to zero mean in exact arithmetic; its tiny floating-point DC residual is discarded. Mean velocity is preserved by projection.

The implementation is a radix-2 **Stockham autosort FFT**. A 2D transform has `2 log₂(n)` butterfly passes; forward and inverse together use `4 log₂(n)` passes. Inverse butterflies each divide by 2, yielding the final `1/n²` normalization. There is no bit-reversal upload, convergence test, pressure iteration count, Jacobi, Gauss–Seidel, or other iterative linear solver.

FFT roots and the `sin²` eigenvalue factors are prepared once in an **O(n) one-dimensional lookup texture**, using JavaScript's double-precision `Math` functions before Float32 storage. This avoids driver-dependent GLSL trigonometric accuracy and low-frequency cancellation in `1−cos(θ)`.

Complexity is **O(N log N)**, where `N = n²` is the total number of cells. Repeated butterfly **stages are the finite direct transform**, not relaxation iterations.

### Semi-Lagrangian advection

For each face-centered velocity component or cell-centered dye value:

1. Interpolate the staggered transporting velocity at that quantity's physical location.
2. Backtrace explicitly: `x_departure = x − Δt w(x)`.
3. Bilinearly sample the source field at the wrapped departure position.

Every fragment computes its cell independently. There are **no JavaScript loops over simulation cells** and **no loops in the advection shader**. GPU parallelism is the vectorization mechanism; this is not a CPU array implementation disguised as a GPU renderer.

This uses explicit characteristic backtracing, not forward-Euler finite-difference advection. Semi-Lagrangian transport was requested specifically; the pressure correction is implicit/direct, while diffusion remains explicit.

### Optional BFECC

With `AΔt` denoting the semi-Lagrangian operator using the same frozen velocity field:

```text
forward   = AΔt(source)
reverse   = A−Δt(forward)
corrected = source + 1/2 (source − reverse)
result    = AΔt(corrected)
```

Clamp the final result to the original four donor texels' min/max, independently for each transported channel. The same face offsets are used in all passes. This prevents new extrema and negative dye caused by correction. The final pressure projection still runs after velocity advection.

This is **full BFECC** (three advections plus a correction pass), not the cheaper two-pass MacCormack variant. It adds three render passes over basic semi-Lagrangian advection. It reduces numerical diffusion but does not make the split Navier–Stokes integrator globally higher-order or strictly mass-conserving.

### Explicit diffusion stability

The five-point forward-Euler viscosity update requires:

```text
ν Δt / h² ≤ 1/4
```

The engine uses a safety factor of **0.24**:

```js
effectiveDt = Math.min(requestedDt, 0.24 / (viscosity * n * n));
```

Zero viscosity imposes no diffusion time-step bound. The UI reports when the requested step is capped. It does **not** silently solve viscosity implicitly or perform unbounded catch-up substeps. Higher viscosity/resolution can therefore slow simulated time. The application submits at most one simulation step per available GPU frame; simulation time is not locked to wall-clock time.

Dye has no additional physical diffusion term; its transport dissipation comes from the chosen interpolation scheme plus the explicit dissipation setting. Velocity damping and dye dissipation are configurable nonconservative terms, not consequences of incompressibility.

## GPU architecture and performance

| Resource | Format | Purpose |
| --- | --- | --- |
| 4 full-size state textures | RGBA32F | current, forced/source, forward, reverse/final; reused across passes |
| 2 full-size complex textures | RG32F | divergence, FFT ping-pong, pressure impulse |
| Reduction pyramid | RGBA32F | post/pre divergence² mean, maximum stored-face speed², mean dye |
| 1D roots texture | RGBA32F | accurate complex twiddles + Laplacian factors |

Approximate numerical texture allocation:

| Grid | Cells | Texture memory | FFT butterfly passes | Solve passes, SL / BFECC |
| --- | ---: | ---: | ---: | ---: |
| 256² | 65,536 | 5.34 MiB | 32 | 37 / 40 |
| 512² | 262,144 | 21.34 MiB | 36 | 41 / 44 |
| 1024² | 1,048,576 | 85.35 MiB | 40 | 45 / 48 |
| 2048² | 4,194,304 | 341.36 MiB | 44 | 49 / 52 |

These are texture payloads, **not total GPU memory**: canvas surfaces, driver resources, and temporary overlap during resolution changes add overhead. All four state buffers remain allocated when BFECC is off, allowing instant toggling. Resolution changes require confirmation at 2048² and preserve the old field if allocation fails. The browser/driver can still lose a context under memory pressure; the UI offers a lower-resolution reload.

- Display resolution and simulation resolution are independent; device pixel ratio is capped at 1.5 for presentation.
- No per-frame field upload or full-field readback.
- Diagnostics run at most approximately once per second via a GPU reduction pyramid. Only **four floats** are read back through a pixel-pack buffer after a fence signals.
- A nonblocking frame fence limits the app to one submitted GPU frame in flight, avoiding runaway command queues on slower GPUs.
- GPU solve timing uses `EXT_disjoint_timer_query_webgl2` when available; otherwise the value is `—`, not a guessed number. It excludes rendering and diagnostic reduction.
- CPU submission time, FPS, and GPU execution time are different measurements. No fixed frame-rate guarantee is made.

The small production JavaScript loops schedule FFT stages/axes, bind uniforms, allocate texture levels, and construct the one-dimensional root table. The test-only CPU reference deliberately uses cell loops for independent verification.

## Controls

- Drag on the canvas: inject dye and momentum.
- Right-drag or **Stir only**: inject momentum without dye.
- Pause/resume: button or **Space**.
- **N**: pause and advance one step.
- **R**: reset the selected preset (does not reset parameter values).
- **G**: reference grid.
- **?**: numerical notes.
- **Esc**: restore expanded viewport / close mobile controls.
- Snapshot: save the rendered canvas as PNG (not the UI).

Presets: counter-rotating vortex pair with a detailed dye pattern; cellular flow; empty domain. These are initial conditions, not hardcoded animations or continuous emitters. Appearance controls affect only visualization. Vectors interpolate the MAC field; pressure/divergence are signed orange/blue views. A nearly uniform divergence view after projection is expected.

## Reuse the solver

```js
import { FluidSolver } from './src/solver.js';

const solver = new FluidSolver(document.querySelector('canvas'), {
  size: 1024,
  dt: 1 / 60,
  viscosity: 2e-6,
  bfecc: true,
});

solver.step();       // enqueue one split step on the GPU
solver.render();     // draw current fields to the canvas
solver.poll();       // poll optional timing / reduction readbacks; never busy-wait
solver.config.bfecc = false;
solver.reset(0);     // 0: vortex pair, 1: cellular, 2: empty
solver.resize(512);  // reallocates and resets; rejects non-power-of-two sizes
// solver.dispose(); // release programs, textures, framebuffers, fences, query, VAO
```

Your application owns its animation loop, canvas sizing, and GPU backpressure. `src/app.js` contains the complete fence-based example. The solver exposes `config`, `pointer`, `metrics`, `time`, `steps`, `effectiveDt`, `bytes`, and `lastStepPasses`. `window.fluid` is exposed by the workbench for inspection. Density is passive and does not drive buoyancy. No vorticity-confinement force is inserted.

## Source map

```text
index.html                 Workbench markup and numerical-method guide
styles.css                 Responsive dark UI; no framework or external fonts
src/app.js                 Controls, pointer input, timing UI, GPU backpressure
src/solver.js              Resource lifecycle, Chorin/BFECC/FFT pass scheduling
src/shaders.js             Production GLSL numerical kernels and display shader
src/numerics.js            Validated grid / time-step / memory helpers
tests/numerics.test.js     Dependency-free Node tests
tests/reference.js         Test-only CPU FFT / projection reference
tests/gpu.html             Browser test runner for actual production shaders
tests/gpu-tests.js         GPU numerical and large-grid checks
TESTING.md                 Recorded validation and precision notes
```

## Validation and limitations

Run `npm test` (Node 20+, no packages to install). Open `/tests/gpu.html` for actual GPU numerical tests and the optional memory-heavy 1024²/2048² check. See `TESTING.md` for measured results.

This is a **Float32 educational/research playground**, not a validated engineering CFD package. The direct projection is divergence-free in exact arithmetic; finite precision gives a residual, increasingly amplified by derivatives on fine grids. No iterative residual correction is applied. For stricter tolerances, double-precision compute or a higher-precision implementation would be required.

The FFT pressure solve handles a uniform, constant-density, periodic square domain only. Obstacles, walls, open boundaries, adaptive grids, variable density, arbitrary grid sizes, and 3D are not supported. Bilinear semi-Lagrangian/BFECC transport is not conservative and can alter total dye mass even with explicit decay disabled. The integrator is first-order split in time. Snapshots save images, not full simulation state; there is no persistence or hidden network storage.
