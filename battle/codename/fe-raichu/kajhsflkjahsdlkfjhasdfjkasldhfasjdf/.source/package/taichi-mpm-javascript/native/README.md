# taichi_mpm full solver → WebAssembly

C++17 port of the high-performance MLS-MPM + CPIC solver from
[yuanming-hu/taichi_mpm](https://github.com/yuanming-hu/taichi_mpm) (`src/`, **not** the
88-line version), compiled to a `wasm32-wasi` reactor module.

| File | Contents |
| --- | --- |
| `taichi_lite.h` | Re-implementation of the legacy Taichi pieces the solver needs: `VectorND`/`MatrixND`, McAdams 3×3 SVD + polar decomposition, `Rotation`/`AngularVelocity`, `Element` meshes, `Config`, `LevelSet`/`DynamicLevelSet`, procedural density textures, periodic Poisson-disk sampler |
| `mpm.h` | Port of `mpm_fwd.h`, `kernel.h`, `particles.*`, `boundary_particle.h`, `particle_allocator.h`, `articulation.*`, `rigid_body_solver.h` (with libccd's MPR re-implemented), legacy `rigid_body.*`, `mpm.*`, `transfer.cpp`, `rigid_transfer.cpp`, `mpm_rigid_body.cpp` |
| `api.cpp` | Exported C API used by `src/lib/engine.js` + a native test harness (`g++ -O2 api.cpp`) |
| `build.sh` | Builds SIMD128 and scalar modules and embeds them (base64) into `src/lib/wasm/mpmWasm.js` |
| `tools/test-scenes.js` | Headless regression of every scene in Node (bundle with esbuild) |

Porting notes
* SPGrid's virtual-memory sparse grid → block-sparse dense allocation (8×8 / 4×4×4 blocks) with
  active / fat / rigid page maps; particles are radix-sorted by block every substep.
* TBB loops run serially (no shared-memory threads without COOP/COEP headers); SSE kernels are
  scalar code auto-vectorised to wasm SIMD. Non-rigid blocks take the optimized transfer path
  without CPIC checks, as in the original 3D implementation.
* Scripted positions/rotations (Python callables) are imported from JavaScript (`env.script_eval`).
* The 3×3 SVD performs up to two extra Jacobi sweeps when the original four have not converged.

Rebuild (requires [wasi-sdk](https://github.com/WebAssembly/wasi-sdk) 25):

```bash
WASI_SDK=/path/to/wasi-sdk ./native/build.sh
npx esbuild native/tools/test-scenes.js --bundle --platform=node --format=esm --outfile=/tmp/t.mjs && node /tmp/t.mjs all 25 low
```
