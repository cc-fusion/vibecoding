# Browser C ABI

Import `public/wasm/taichi-mpm.mjs` from a worker or an ES-module page and await its default factory. The glue exposes direct `_mpm_*` functions, `ccall`, `cwrap`, `HEAPF32`, `HEAPU8`, `UTF8ToString`, and `FS`.

```js
import createMPM from "/wasm/taichi-mpm.mjs";
const m = await createMPM();
const callJSON = (name, config) =>
  m.ccall(name, "number", ["string"], [JSON.stringify(config)]);

const ok = m.ccall(
  "mpm_initialize_json",
  "number",
  ["number", "string"],
  [
    3,
    JSON.stringify({
      res: [64, 64, 64],
      base_delta_t: 0.0001,
      gravity: [0, -9.8, 0],
    }),
  ],
);
if (!ok) throw new Error(m.UTF8ToString(m._mpm_error()));

const result = callJSON("mpm_add_json", {
  type: "sand",
  shape: "box",
  lower: [0.4, 0.4, 0.4],
  upper: [0.6, 0.6, 0.6],
  ppc: 4,
  density: 400,
  friction_angle: 30,
  mu_0: 20000,
  lambda_0: 20000,
});
if (!result) throw new Error(m.UTF8ToString(m._mpm_error()));

if (!m._mpm_step(20)) throw new Error(m.UTF8ToString(m._mpm_error()));
const count = m._mpm_count();
const offset = m._mpm_data() / 4;
const particles = m.HEAPF32.slice(offset, offset + count * 8);
```

## Configuration APIs

- `mpm_initialize_json(dimension, json) -> int`: empty production solver; `res` must be a matching square/cubic vector, with values 32-96. Remaining configuration fields pass to upstream `MPM::initialize`. A default frictional box level set is installed. A custom `delta_x` should not be used with the default normalized browser domain.
- `mpm_add_json(json) -> char*`: forwards to `MPM::add_particles`. Returns the upstream result string; a non-null pointer to an empty string is success for non-rigid materials. `nullptr` signals an error. Material parameters match upstream. The browser density adapter supports `shape: "box"`, `lower`, `upper`, or `shape: "sphere"`, `center`, `radius`; density is `ppc` particles/cell. Sampling defaults to non-Poisson, with periodic asset sampling disabled. Call repeatedly for multi-material or continuous-source scenes.
- For `type: "rigid"`, supply the upstream rigid config. Write an OBJ to `m.FS.writeFile('/mesh.obj', ...)`, then use `mesh_fn: '/mesh.obj'`, `initial_position`, `codimensional`, `scale`, `density`, and optional velocity/friction. For 2D use upstream `segment_mesh` syntax. The maximum is 11 user rigid bodies, reflecting upstream CPIC bit packing.
- `mpm_action_json(json) -> char*`: routes to `MPM::general_action`, including articulations. Example: `{action: "add_articulation", type: "distance", obj0: 1, obj1: 2, target_distance: 0.3, penalty: 10000}`. Preserve upstream action requirements; unsupported native diagnostic/export actions throw descriptive errors. Body indices are checked before dispatch.
- `mpm_config_json(json) -> int`: updates upstream `config_backup` plus live gravity, time step, APIC/RPIC damping, particle gravity, APIC enablement, penalty, and pushing force. Structural grid changes require reinitialization.
- `mpm_levelset_json(json) -> int`: replaces the default boundary with a static level set. Example: `{friction: 0.4, shapes: [{type: "plane", normal: [0,1,0], d: -0.13}]}`. Plane convention is `dot(normal, position) + d`. Sphere fields are `center`, `radius`, and optional `inside_out`. Shape positions/distances are in normalized world units. Both dimension specializations use upstream level-set methods.

## Preset And Runtime APIs

- `mpm_init(dim, scene, material, resolution, count, gravity, E, frictionAngle, dt) -> int`: convenience seeder used by the UI. Scene IDs 0-4 correspond to the five presets. Material IDs 0-7 correspond to the order in `src/simulation.ts`.
- `mpm_step(substeps) -> int`: invokes original `MPM::substep`, capped at 200 iterations per call so a worker can service messages between batches.
- `mpm_count() -> int`: refreshes the render buffer and returns its particle count.
- `mpm_data() -> float*`: interleaved `[x, y, z, vx, vy, vz, material, id]`. 2D particles have `z = 0.5`. Material 8 denotes a rigid boundary particle.
- `mpm_time() -> float`, `mpm_substeps() -> int`, `mpm_grid_blocks() -> int`: measured native state.
- `mpm_impulse(x, y, z, radius, strength)`: radial particle velocity impulse.
- `mpm_gravity(g)`: change vertical gravity.
- `mpm_save() -> int`: upstream uncompressed binary serialization to `/snapshot.tcb`. Read with `m.FS.readFile`. See the snapshot scope in the root README.
- `mpm_error() -> const char*`: most recent caught C++ exception message. Read only after an operation reports failure.

Copy buffers before posting them to another thread, and reacquire `HEAPF32` after any operation that may grow memory. Do not transfer the WASM heap's own buffer. The browser worker follows this pattern in `public/simulation-worker.js`.
