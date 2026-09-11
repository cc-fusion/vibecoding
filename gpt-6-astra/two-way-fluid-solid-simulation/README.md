# Flux — a physics playground

A browser-only, real-time 2D FLIP / XPBD fluid–solid experiment. The working application uses React, TypeScript (compiled to browser JavaScript), Canvas 2D, and CSS. `src/App.tsx` is the application entry point. No backend, external physics service, or GPU extension is required.

## 1. Architecture overview

A dense staggered MAC grid carries incompressibility, Lagrangian particles carry fluid transport, and a filled triangular mesh carries the deformable solid. The partitioned interface is bidirectional: pressure traction and contact drag change solid velocities, while the deformed mesh and interpolated solid velocities change fluid grid boundaries. XPBD compliance was chosen over explicit springs so material stiffness can vary without an explicit spring-frequency timestep restriction.

    solid.ts: predict + XPBD constraints
        | deformed polygon + moving boundary velocity
        v
    grid.ts: P2G -> save old grid -> forces -> PCG pressure projection
        | pressure traction reaction -> solid.ts
        v
    grid.ts: blended PIC/FLIP G2P
        v
    engine.ts: particle advection -> two-way particle/solid contact
        | equal-and-opposite normal / tangential impulses
        +----> next adaptive substep

`renderer.ts` reads solver state but never modifies physics. `App.tsx` controls playback, presets, material parameters, and pointer forcing. `checks.ts` runs implementation-level numerical sanity checks. `components/Guide.tsx` exposes this architecture, defaults, limitations, diagnostics, and downloadable actual module source within the application.

## 2. Core algorithm steps

1. Predict solid nodes with gravity and prior interface impulses. Solve compliant distances and signed triangle areas using ten XPBD sweeps. Reconstruct velocities from corrected positions.
2. Resolve fluid overlaps introduced by the moving solid before transfer. Boundary contacts interpolate velocity and distribute impulses to their two endpoint nodes.
3. Deposit fluid velocities bilinearly to MAC faces, normalize weights, extrapolate two air layers, and save the pre-force grid for FLIP.
4. Apply gravity. Set stationary tank face velocities and moving solid boundary velocities.
5. Solve `A p = -rho h^2 div(u*) / dt` using Jacobi-preconditioned conjugate gradients. Air pressure is zero. Solid/wall neighbors use Neumann conditions and are excluded from the pressure diagonal.
6. Apply pressure gradients to fluid faces. Apply pressure traction `J = p h dt` (unit depth) to the neighboring solid, weighted onto its boundary nodes. The fluid and solid use the same rasterized interface face.
7. Transfer corrected velocity to particles: `v_new = (1 - flip) v_PIC + flip (v_old + grid_new - grid_old)`. Advect particles with their updated Lagrangian velocities.
8. Resolve particle–solid contact again. Project positions outside the polygon. Normal impulses have zero restitution. Coulomb-limited tangential impulses model dissipative drag, and the solid receives the opposite impulse.
9. Validate the resulting relative CFL, finiteness, signed areas, and nonpenetration. Roll back all particle/node positions and velocities on failure, halve dt, and retry. Seven unsuccessful trials produce a safety pause. At most eight accepted substeps are processed per rendered frame; unmet simulation time is discarded rather than caught up with an unsafe dt.

## 3. Code modules

- `src/simulation/grid.ts`: MAC storage, bilinear transfers, pressure assembly, matrix-vector product, PCG, projection, and pressure reaction.
- `src/simulation/solid.ts`: triangular filled body, contact geometry, weighted impulses, and XPBD constraints.
- `src/simulation/engine.ts`: deterministic particle seeding, parameters, adaptive substeps, rollback, two-way collisions, and pointer forcing.
- `src/simulation/renderer.ts`: Canvas visualization and pointer coordinate mapping.
- `src/simulation/checks.ts`: actual-solver sanity checks, including coupled-versus-uncoupled comparisons.
- `src/components/Guide.tsx`: architecture, parameter table, limitations, diagnostics, and source viewer/downloads.
- `src/App.tsx` and `src/index.css`: functional responsive simulation lab.

Non-obvious numerical choices are commented inline. Use the **View source** control to inspect or download each solver module. Use **Solver time** / **Diagnostics** for tests and measured workspace values.

## 4. Parameter table

| Parameter | Default | Rationale |
| --- | --- | --- |
| Domain | 10 × 5.5 m, unit depth | Explicit 2D assumption |
| Grid | 80 × 44; h = 0.125 m | Small dense CPU grid |
| Particles | 4,096 | Fixed mass, deterministic low-discrepancy seeding |
| Water density | 1,000 kg/m³ | Incompressible water |
| Solid density | 650 kg/m³ | Buoyant, moderately light body |
| PIC / FLIP | 0.05 / 0.95 | Some noise damping without pure PIC diffusion |
| Stiffness s | 0.72 | Edge compliance = 10^(-3 - 5s) m/N |
| Solid mesh | 61 nodes, 100 triangles | Filled, not a thin shell |
| XPBD iterations | 10 | Distance + area constraints |
| Area compliance | 1e-9 | Strong resistance to volume/area loss |
| Maximum nominal dt | 1/120 s | Reduced by relative CFL and retry validation |
| Substeps | 2 nominal, 8 accepted maximum/frame | Prefer slow motion to unsafe catch-up |
| Pressure iterations | 60; relative tolerance 1e-4 | Accuracy/performance compromise, adjustable to 120 |
| Relative CFL | ≤ 0.4 | Uses maximum fluid + solid speed; checked after trial |
| Contact restitution / friction | 0 / 0.12 | Dissipative effective-mass impulse |
| Pointer actuator speed | ≤ 4 m/s toward target | No node teleportation |

The predictive bound is `dt <= min(1/(60 * nominalSubsteps), 0.4 h / (maxFluidSpeed + maxSolidSpeed + gravityAllowance + dragAllowance))`. The gravity allowance is `sqrt(2 g h)`. Actual post-step speeds are validated against the same relative CFL limit.

## 5. Verification and limitations

### What is checked

The in-app diagnostics execute the actual pressure operator on a small mixed fluid/air/solid grid. They test bilinear symmetry, a positive quadratic form, divergence reduction, weighted impulse conservation, changes in BOTH fluid and solid when coupling is toggled, particle mass retention, finite state/nonpenetration, and CFL. These are smoke tests, not a substitute for convergence studies or experimental validation.

The pressure matrix has symmetric -1 entries for shared fluid neighbors. Its quadratic form is a sum of squared neighbor differences plus nonnegative air-boundary terms and a positive 1e-8 gauge regularizer. It is consequently SPD on the active fluid subspace; inactive rows are zero and are excluded by the PCG preconditioner. The regularizer handles isolated sealed pockets but does not make incompatible sealed-pocket flux physically meaningful.

Fixed particle mass and count preserve fluid mass. A particle contact's impulse uses the combined inverse effective mass; barycentric endpoint weights sum to one, so the opposite solid impulse conserves interface linear momentum to floating-point precision. Pressure uses matching face traction and moving boundary conditions in the two systems. **Exact global particle momentum is not claimed:** PIC blending, grid normalization/extrapolation, solid damping, rasterization and position corrections are dissipative or approximate. Gravity, walls and pointer forcing are external impulses. Displayed contact momentum error audits contact impulses only.

### Failure modes and mitigation

- **Added-mass effects:** partitioned pressure feedback can struggle with very light solids or violent forcing. Smaller timesteps, denser bodies and more PIC damping help. A production high-density-ratio solver should iterate coupling or use a monolithic solve. Rollback protects the displayed state but does not prove unconditional coupled stability.
- **Thin shells / subcell detail:** the grid uses cell-center polygon rasterization, not cut cells. The solver targets a thick filled body. Post-step collision checks and rollback reject detected overlaps, but they are not swept continuous collision detection. Use CCD and cut-cell boundaries for fast thin geometry.
- **Self-intersection:** signed-area checks reject inverted triangles; solid self-contact is not implemented. Non-inverted meshes can still have more complex global overlap. Add barrier energies and robust self-collision for extreme deformation.
- **Fluid volume drift / clumping:** no reseeding, density correction, or particle–particle separation. Mass retention is not the same as exact represented fluid-volume retention. Add conservative reseeding and density correction for long runs.
- **Finite pressure iterations:** PCG may hit its cap. Check the live residual and divergence, and increase iterations. A tolerance target is not a guarantee.
- **Energy:** this is not an energy-conserving integrator. Damping and zero-restitution contacts are intentional. Use an energy/momentum-aware monolithic method where those invariants are essential.
- **Performance:** CPU JavaScript on the main thread, one deformable body, dense grid. FPS and solver time are measured, not promised. Web Workers and WebGPU are natural scaling paths.

## Build

Use the project's standard `npm run build` script. Vite produces the deployable application in `dist/`. The production build has been checked through the provided build tool. Browser diagnostic results are computed locally when the guide opens, not hardcoded pass labels.
