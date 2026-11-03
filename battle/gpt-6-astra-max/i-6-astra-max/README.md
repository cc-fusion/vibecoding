# Taichi MPM Browser Lab

A React/Three.js workspace running the **full synchronous Taichi MPM solver** as real WebAssembly in a dedicated worker. The compact `mls-mpm88.cpp`, `mls-mpm88-explained.cpp`, and `tetris.cpp` programs are not compiled, imported, or used.

## Run

```sh
npm install
npm run dev
```

`npm run build` produces `dist/`. Serve the entire directory, including `simulation-worker.js` and `wasm/`, over HTTP(S). The precompiled WASM is checked in, so normal frontend builds do not require a C++ toolchain. Fonts are bundled locally. No simulation service or external runtime API is used.

## What Is Ported

The build directly compiles these production units from `vendor/taichi_mpm/src/`:

- `mpm.cpp`: initialization, sparse-grid population, integration, boundaries, serialization, actions.
- `transfer.cpp`: reference and optimized particle/grid transfers, APIC and MLS-MPM.
- `particles.cpp`: all eight constitutive models: sand, snow, jelly, water, von Mises, viscoelastic, elastic, and linear.
- `rigid_transfer.cpp`, `boundary_particle.cpp`, `mpm_rigid_body.cpp`: CPIC distance fields, compatibility, rigid boundary particles, two-way coupling, and rigid dynamics.
- `articulation.cpp`: original articulation implementations.
- Legacy Taichi math, SVD, level sets, mesh loading, mass/inertia, and asset registry; SPGrid and libccd.

Both dimension specializations are compiled. Physics is not reimplemented in JavaScript. The TypeScript renderer only reads particle positions and velocities from a copied WASM buffer.

## Rebuild WASM

Install and activate **Emscripten 3.1.64**, then:

```sh
source /path/to/emsdk/emsdk_env.sh
bash wasm/build.sh
node scripts/test-wasm.mjs
```

Alternatively set `EMXX=/path/to/em++`. The build uses C++17, `-O3`, link-time optimization, WASM SIMD, C++ exception support, growable linear memory, and ES-module glue. It generates `public/wasm/taichi-mpm.mjs` and `public/wasm/taichi-mpm.wasm`.

`wasm/platform.h` and `wasm/shims/` adapt platform dependencies. `wasm/bridge.cpp` implements the browser C ABI. `wasm/runtime.cpp` supplies the host logger and browser visualization boundary.

## General Solver API

The compiled module exposes the production configuration and factory APIs, not only the UI presets. See `wasm/API.md` for signatures and a runnable usage example. Custom scenes can add multiple materials, OBJ/segment rigid meshes, analytic boundaries, and articulations through the underlying upstream methods.

## Browser Scope

- The **full synchronous production solver** is included. The separately implemented, experimental asynchronous scheduler in `src/async/` is not ported.
- TBB task scheduling runs serially inside one Web Worker. WASM SIMD replaces the SSE instruction path. There is no multi-worker shared-memory implementation, GPU solver, or MPI.
- SPGrid indexing and active-page logic are retained, but aligned WASM heap storage replaces Linux virtual-memory reservation. Grid memory is physically allocated, not OS-demand-paged.
- The bridge currently uses cubic/square domains, resolutions 32 through 96, and a bounded preset particle count. The UI renders at most 66,000 particles. This is a browser memory/performance budget, not a compact numerical solver.
- Python and native GUI/Partio/Houdini render/export integrations are not shipped. Browser PNG and JSON exports replace presentation output. External assets used by original Python demo scripts are not bundled. Mesh files can be written to the module's in-memory filesystem.
- Uncompressed `.tcb` export uses the upstream binary serializer under the wasm32 ABI. It is not binary-compatible with native 64-bit snapshots. Level-set assets and scripted functions must be reconstructed separately; the UI does not offer checkpoint import. JSON exports contain particle data and scene settings, not all internal state.
- Upstream native zip archives and offline diagnostic image output are not supported. Their entry points report an explicit error instead of silently doing nothing.
- Simulation time is independent of wall-clock time. This is an explicit solver: sufficiently stiff materials or aggressive time steps can become unstable. The browser handles solver errors with a restart path. Bitwise agreement with the native x86 build is not claimed, particularly because baseline WASM has no fused multiply-add.

## Verification

```sh
node scripts/test-wasm.mjs
node scripts/test-api.mjs
npx tsc --noEmit
npm run build
# With a dev or preview server already running:
node scripts/test-browser.mjs
# Test another origin:
APP_URL=http://localhost:4173 node scripts/test-browser.mjs
```

WASM tests exercise all eight models in both dimensions, finite outputs, conserved short-run particle counts, gravity, time advancement, CPIC and rigid scenes, and snapshot serialization. Browser tests exercise worker initialization, playback, stepping, scene changes, parameters, display controls, downloads, dialogs, and responsive layout. These are smoke/integration tests, not a validation of every upstream scene or a native-vs-WASM numerical equivalence study.

## Provenance

- Taichi MPM: `yuanming-hu/taichi_mpm` at `3a680ab0fdc6e95077f08a91bc9079e1ef41478e`.
- Legacy Taichi: `taichi-dev/taichi`, legacy branch, at `387bbc2adab035c644e2b89d8f4bf1d2692268c5`.
- The portability diffs are recorded in `wasm/patches/`.
- Original licenses remain in `vendor/` and distribution notices are copied to `public/licenses/`.

Based on _A Moving Least Squares Material Point Method with Displacement Discontinuity and Two-Way Rigid Body Coupling_, Hu et al., ACM Transactions on Graphics / SIGGRAPH 2018. The app includes a research citation and a link to the original project.
