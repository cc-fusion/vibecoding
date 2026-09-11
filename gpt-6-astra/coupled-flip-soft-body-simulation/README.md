# Fluid / Lab

A browser-native, interactive 2D FLIP–XPBD fluid/solid experiment. React + TypeScript (compiled to JavaScript), Vite, HTML, and CSS. Canvas 2D draws the result. No physics dependencies or remote computation.

## 1. Architecture overview

A dense staggered MAC grid couples Lagrangian fluid particles to a compliant spring lattice. The design draws on shared-boundary FLIP/mass-spring and FLIP/PBD approaches, but uses XPBD compliance for a practical stiffness range. This is **not** a unified MPM solver or a shape-matching solid.

    Fluid particles --P2G--> MAC grid --forces / pressure solve--> projected grid
         ^                         ^                                   |
         |                         | moving boundary velocities        | G2P
         |                         |                                   v
         +---- advection / contact +--------------------------- fluid particles
                                   |
                            XPBD solid constraint solve
                                   ^
                                   | pressure traction + opposite contact impulses
                                   +---------------------- fluid–solid interface

Module boundaries:
- `src/sim/solver.ts`: numerical state, FLIP transfers, pressure projection, XPBD constraints, contact, and checks.
- `src/sim/render.ts`: read-only Canvas rendering and viewport coordinate conversion.
- `src/App.tsx`: animation lifecycle, inputs, live parameters, presets, export, and diagnostics.
- `src/components/Guide.tsx`: design, parameter table, verification UI, and actual downloadable solver source.
- `src/index.css`: responsive presentation.

Assumptions: 2D, metre units, unit depth, fluid density 1, one deformable solid of density 0.65, free surface, closed tank walls, no surface tension. Density units can be scaled consistently; this demo does not model physical SI water pressure magnitudes.

## 2. Core algorithm steps

For each adaptive substep:
1. Select `dt <= min(frameDt / minimumSubsteps, 0.45*h / (maxSpeed + sqrt(g*h) + 0.001))`. The maximum includes fluid and solid velocities. At most 24 substeps are processed per frame; excess time is dropped, never caught up using an oversized step.
2. Apply solid gravity; predict positions; solve structural, diagonal shear, and two-hop XPBD distance constraints for 12 iterations. Recover velocities from corrected positions. Compliance is `10^(-2 - 5*stiffness)` and its constraint denominator contribution is compliance/dt². Springs preserve local shape approximately, not exact volume.
3. Resolve existing fluid/solid overlap, then bilinearly transfer particle velocity to staggered grid faces, normalize by weights, and extrapolate three cell layers. Save this pre-force grid for FLIP deltas. Uniform particle masses cancel in normalization.
4. Apply grid gravity and exponential damping. Rasterize the current solid polygon; set blocked face velocities from the nearest edge nodes. Tank normal velocities are zero.
5. Solve pressure using red-black Gauss–Seidel. `q = pressure*dt/density`; the right side is `-h*(uRight-uLeft+vTop-vBottom)`. Air pressure is zero. Solid and wall neighbours do not contribute to the diagonal (prescribed normal velocity).
6. Project unblocked face velocities by `(qLeft-qRight)/h`. Apply solid pressure impulses `J = q*density*h` along fluid/solid faces, distributed to edge nodes using barycentric weights. These changes affect the next substep's boundary conditions: the coupling is genuinely bidirectional, but partitioned.
7. Perform G2P: `velocity = 0.05*PIC + 0.95*(oldParticleVelocity + gridDelta)` by default. Advect with the updated particle velocity. Pointer stirring is an explicitly external force.
8. Project embedded or near-contact particles to the exterior polygon. Solve an inelastic normal impulse with particle and interpolated edge inverse masses; apply the opposite impulse to solid nodes. Apply tangential contact drag, limited to 8% of the normal impulse. Clamp particles to tank walls. No collision response uses an explicit stiff penalty spring.

## 3. Code

The complete implementation is in the modules above, with inline comments for non-obvious choices. In the running app, **Code** displays the actual bundled `solver.ts` and `render.ts` source and offers copy/download actions, not pseudocode.

Run the existing Vite development script or build using the project's build script. `index.html` mounts `src/App.tsx` via `src/main.tsx`.

Controls:
- Drag: stir the fluid; Shift + drag: pull the solid.
- Space: pause/resume; right arrow: single frame; R: reset.
- Fluid, Solid, and Solver tabs: live tuning. Particle density changes restart the scene.
- View options: particles, mesh, MAC grid, velocity arrows, pressure cells.
- Presets: dam break, wave tank, and solid drop.
- Save snapshot: export the current canvas as PNG.
- Disable two-way coupling for a one-way comparison: the solid still imposes boundaries but receives no fluid impulses.

## 4. Recommended defaults

| Parameter | Default | Rationale |
|---|---|---|
| Domain | 12 × 7 m, unit depth | Explicit scale; compact dense grid |
| Grid | 72 × 42 MAC cells | Simple transfers and pressure stencil |
| Cell size | 1/6 m | Practical CPU cost |
| Particle density | 4/cell (approximately 4–5k particles) | Count varies by scene; no reseeding |
| Particle mass | h² / particlesPerCell | Constant within each reset scene |
| FLIP / PIC | 95% / 5% | Retain motion, damp transfer noise |
| Solid | 9 × 5 nodes; density 0.65 | Moderate added mass, deformable lattice |
| Stiffness | 80%; compliance 10^-6 | XPBD avoids explicit stiff-spring timestep restriction |
| Frame timestep | 1/60 s | Simulation time, independent of slow wall-clock frames |
| Minimum substeps | 3 (nominal dt 1/180 s) | Partitioned interface feedback at a smaller step |
| CFL number | At most 0.45 before each step | Both fluid and solid speeds included |
| Pressure iterations | 40 | Bounded CPU cost; finite residual |
| Solid iterations | 12 | Compliant constraints, not an exact implicit solve |
| Gravity | 9.81 m/s² | Familiar behaviour |
| Velocity damping | 0.015 s^-1 | Exponential bulk drag, not a viscous stress solve |

## 5. Verification and limitations

### Checks provided
The Documentation / How it works panel runs `FluidSolver.verify()` on demand. It does not mutate the user's scene. It checks Cholesky pivots of a small representative symmetric pressure matrix, reference contact-impulse balance, constant particle count, finite numerical state, final polygon overlap, and CFL over an independent eight-frame smoke test. These are **not** exhaustive stability or conservation tests. The app also measures actual frame rate, solver milliseconds, timestep CFL, pressure residual, divergence, and kinetic energy internally.

### Conservation
Particle mass is constant (no emission/deletion). Contact uses equal-and-opposite impulses with barycentric weights summing to one, including contact drag. Pressure traction uses the pressure from the same moving-boundary projection. However, finite pressure iterations, rasterized boundaries, PIC blending, extrapolation, positional corrections, and lagged partitioned exchange introduce errors. Exact global momentum or fluid-volume conservation is **not** claimed. Pinned nodes, walls, gravity, bulk damping, and pointer input exchange momentum with the external world. A production validation should isolate an unforced periodic/interface test and record fluid + solid momentum and angular momentum over long runs.

### Failure modes and mitigations
- **Thin or folded solids / tunnelling:** CFL and polygon projection reduce overlap, but do not guarantee continuous contact. The mesh has no self-collision or triangle inversion constraints. Use swept triangle contact, a minimum solid thickness, inversion barriers, and solid self-collision before supporting arbitrary geometry or violent pulling.
- **Added-mass instability:** coupling is partitioned, not a monolithic pressure/solid solve. Extremely light solids can oscillate. Use more substeps, interface iterations, or a coupled implicit solve. Moderate fixed solid density is deliberate.
- **Stiff constraints:** XPBD does not have an explicit penalty-spring stiffness limit, but finite iterations can leave error. It does not guarantee stability for arbitrary degenerate geometry or impulsive loads. Increase constraint iterations and use volume/inversion constraints for more demanding materials.
- **Pressure nullspace:** the discrete operator is symmetric and positive-definite if every fluid component reaches a zero-pressure air cell. Entirely enclosed all-Neumann regions need a gauge and compatible right-hand side. The included partially filled tank provides a free surface; arbitrary sealed pockets are not robustly handled.
- **Pressure residual / volume drift:** fixed iterations do not solve to a tolerance. Raise iterations or use preconditioned CG/multigrid; add particle regularization and volume tracking for long runs. There is no particle reseeding or density correction here.
- **Approximate viscosity:** the control is correctly labelled velocity damping. Tangential contact drag exists, but no physical fluid viscous stress or no-slip boundary layer is resolved.
- **CFL is necessary, not sufficient:** the displayed CFL is based on velocities before each substep; pressure and contact can change velocity during it. For production guarantees, use rejected-step rollback on post-step CFL/energy failure and swept contact. The demo slows time under load rather than enlarging timesteps.
- **Browser CPU budget:** performance varies by device. Choose low particle density or fewer pressure iterations; pause while inspecting pressure. Canvas rendering is deliberately lightweight and independent of physics.

This is an educational, working simulation—not a claim of production-grade fluid–structure robustness.
