# MPM.js Documentation

**MPM.js** packs the full `taichi_mpm` multi-physics solver (MLS-MPM + CPIC, compiled to WebAssembly) into a single, zero-dependency JavaScript file. Drop it on a page with one `<script>` tag and get real-time water, sand, snow, jelly, plastic and rigid bodies — in 2D and 3D — that you can **author and modify entirely at runtime**. No React, no TypeScript, no build step, no source edits.

```html
<script src="mpm.js"></script>
<div id="sim" style="width: 640px; height: 480px"></div>
<script>
  const sim = MPM.create('#sim', { scene: 'sand-wheel' });
</script>
```

- **File:** `mpm.js` (~1.1 MB, WASM embedded — SIMD + baseline fallback)
- **Dependencies:** none
- **Rendering:** WebGL2 (bundled)
- **Threading:** self-spawning Web Worker with a main-thread fallback
- **License:** MIT · Solver: [taichi_mpm](https://github.com/taichi-dev/taichi_mpm) by Yuanming Hu

---

## Table of contents

1. [Installation](#installation)
2. [Quick start](#quick-start)
3. [Core concepts](#core-concepts)
4. [Built-in scenes](#built-in-scenes)
5. `MPM.create` [options](#mpmcreate-target-options)
6. [Declarative scenes](#declarative-scenes)
7. [Scripted scenes](#scripted-scenes)
8. [Materials](#materials)
9. [Textures](#textures)
10. [Rigid bodies & shapes](#rigid-bodies-shapes)
11. [Wheels](#wheels)
12. [Articulations](#articulations)
13. [Level sets (containers & walls)](#level-sets)
14. [Sources (emitters)](#sources)
15. [Live simulation control](#live-simulation-control)
16. [Pointer & touch interaction](#pointer-touch-interaction)
17. [Per-frame scripting with `onUpdate`](#per-frame-scripting)
18. [Events](#events)
19. [Rendering options](#rendering-options)
20. [Recipes](#recipes)
21. [Performance guide](#performance-guide)
22. [Architecture](#architecture)
23. [Browser support & CSP](#browser-support-csp)
24. [Low-level API](#low-level-api)

---

<a id="installation"></a>
## 1. Installation

### Script tag (recommended)

```html
<script src="/path/to/mpm.js"></script>
<script>
  console.log(MPM.version); // "1.0.0"
</script>
```

The library attaches a single global, `window.MPM`. The WASM payload is embedded, so **one file is all you need** — there is nothing else to serve.

### CommonJS / bundlers

```js
const MPM = require('./mpm.js');       // Node / CJS
// or
import './mpm.js';                     // side-effect import, then use window.MPM
```

### Serving requirements

- Serve over `http(s)` for the worker fast-path. On `file://` the library automatically falls back to running the solver on the main thread.
- The worker is created **from the library's own source** (fetched via its `<script src>` URL, or from `MPM.__inlineSource` if you set it). No separate worker file exists.
- To force main-thread mode: `MPM.create(el, { worker: false })`.

---

<a id="quick-start"></a>
## 2. Quick start

```html
<!doctype html>
<html>
<body>
  <div id="sim" style="width: 100%; height: 70vh"></div>
  <script src="mpm.js"></script>
  <script>
    const sim = MPM.create('#sim', {
      scene: 'water-wheel-2d',   // built-in scene id
      quality: 'medium',         // 'low' | 'medium' | 'high'
      loop: true,                // restart when the scene duration ends
      pointer: { mode: 'push' }, // touch / mouse pushes material around
    });

    sim.on('loaded', (info) => console.log('scene ready:', info.name));

    // ...later, while it is running:
    sim.addWheel({ center: [0.3, 0.6], radius: 0.12, mode: 'motor', speed: 160 });
    sim.setGravity([0, -3]);     // moon-ish
  </script>
</body>
</html>
```

The target can be a CSS selector, a DOM element, or an existing `<canvas>`. When it is a container, MPM.js appends a canvas that fills it — **give the container a size**.

---

<a id="core-concepts"></a>
## 3. Core concepts

### Units

The simulation domain is the unit square/cube `[0, 1]ᵈ`. `y` points **up**. Gravity defaults to `[0, -10]`. Densities are in kg/m³-ish solver units (water = 1000). All positions you pass (`center`, `position`, level-set planes…) are in this 0–1 world space.

### Frames vs. substeps

Each rendered frame advances `frameDt` seconds (default `0.01`) of simulated time, split into CFL-safe substeps internally. The worker time-slices substeps so controls stay responsive even when a frame is expensive; `stats.simSpeed` tells you how many simulated seconds pass per wall-clock second.

### Deletion band

Particles that leave a margin of ~7 grid cells inside the domain border are deleted. Keep containers at least `8 / res` away from the domain edge (e.g. `0.06` at `res ≥ 128`). This is why built-in scenes use walls at `0.06`.

### Where your code runs

Scene `setup` functions, scripted values and `onUpdate` hooks execute **inside the worker**, next to the WASM engine. They are serialized with `Function.prototype.toString`, so they must be self-contained (no closure variables from your page). They *can* use all library globals (`Solver`, `constant`, `circleSegments`, `Helpers`, …) and `Math`.

---

<a id="built-in-scenes"></a>
## 4. Built-in scenes

| id | dim | What it shows |
|---|---|---|
| `cutting` | 2D | Jelly / snow / von Mises blocks sliced by fixed knives and a spinning blade (CPIC codimensional cutting) |
| `sand-wheel` | 2D | Sand stream driving a free thin-shell wheel with a rotation articulation |
| `water-wheel-2d` | 2D | Water jet spinning a pinned paddle wheel |
| `buoyancy` | 2D | Rigid bodies of density 300–2500 floating / sinking in water |
| `sand-car` | 2D | Motor-articulation crawler climbing a sand hill |
| `materials` | 2D | All six constitutive models side by side + a rigid hammer |
| `water-wheel-3d` | 3D | The paper's water wheel: thin-shell paddles + side plates |
| `sand-stir-3d` | 3D | Scripted cross-paddle stirrer in a cylindrical sand tank |
| `jelly-cut-3d` | 3D | Jelly cube and snowball sliced by zero-thickness blades |
| `rigid-pile-3d` | 3D | Rigid boxes splashing into a water pool (MPR contacts) |

```js
MPM.listScenes();   // [{ id, name, dim, description, features, duration }, ...]
sim.loadScene('buoyancy');
sim.loadScene('jelly-cut-3d', { quality: 'high' });
```

3D scenes support **orbit** (drag), **zoom** (wheel) and **double-click** to reset the camera.

---

<a id="mpmcreate-target-options"></a>
## 5. `MPM.create(target, options)`

Returns a [`Simulation`](#live-simulation-control).

| option | type | default | meaning |
|---|---|---|---|
| `scene` | `string \| object` | — | Built-in id, declarative scene, or scripted scene. Loaded immediately when present. |
| `quality` | `'low' \| 'medium' \| 'high'` | `'medium'` | Grid resolution preset (per scene). |
| `autostart` | `boolean` | `true` | Play as soon as the scene is loaded. |
| `loop` | `boolean` | `false` | Automatically rebuild + play when `duration` is reached. |
| `worker` | `boolean` | `true` | Run the solver in a dedicated worker. |
| `colorMode` | `string \| number` | `'material'` | `'material'`, `'velocity'`, `'cpic'`, `'default'`, `'plasticity'` (or 0–4). |
| `pointer` | `object` | `{ mode: 'off' }` | Pointer tool config, see [§16](#pointer-touch-interaction). |
| `background` | `'#rrggbb' \| [r,g,b]` | `#0B0F17` | Canvas clear color (floats 0–1 for arrays). |
| `pointScale` | `number` | `1` | Particle sprite size multiplier. |
| `showBlocks` | `boolean` | `false` | Debug-overlay of the adaptive sparse blocks. |

Other statics: `MPM.version`, `MPM.registerScene(id, def)`, `MPM.listScenes()`, `MPM.colorModes`.

---

<a id="declarative-scenes"></a>
## 6. Declarative scenes

The simplest way to build your own scene — **plain data, no functions required**. Pass it to `MPM.create({ scene })` or `sim.loadScene(...)`:

```js
sim.loadScene({
  name: 'My first scene',
  dim: 2,
  res: { low: 128, medium: 192, high: 256 },  // or a single number
  frameDt: 0.01,
  duration: 8,              // 0 = run forever
  gravity: [0, -10],
  solver: { penalty: 0, base_delta_t: 2e-4 },

  levelset: {               // container walls; omit for a default open box
    planes: [ { normal: [0, 1], d: -0.06 },   // floor  (dot(n, p) + d >= 0)
              { normal: [1, 0], d: -0.06 },
              { normal: [-1, 0], d: 0.94 } ],
    friction: 0.4,
  },

  materials: [
    { type: 'water', rect: { center: [0.5, 0.3], size: [0.8, 0.3] },
      ppc: 2, density: 1000, color: [0.3, 0.6, 1] },
    { type: 'jelly', sphere: { center: [0.5, 0.75], radius: 0.09 },
      ppc: 4, E: 2e4, nu: 0.3, density: 400, color: [0.96, 0.42, 0.56] },
  ],

  bodies: [
    { type: 'rigid', codimensional: false, initial_position: [0.5, 0.9],
      density: 600, friction: 0.3, shape: { box: [0.06, 0.03] },
      color: [0.85, 0.65, 0.4] },
  ],

  wheels: [ { center: [0.3, 0.55], radius: 0.13, blades: 8,
              mode: 'motor', speed: 140 } ],

  sources: [ { type: 'sand', position: [0.75, 0.92], size: [0.06, 0.03],
               velocity: [0, -1.2], density: 1200, until: 5,
               color: [0.93, 0.76, 0.45] } ],
});
```

**Field reference**

- `dim` — `2` (default) or `3`.
- `res` — number, or `{low, medium, high}` picked by the active quality.
- `solver` — raw engine config (`base_delta_t`, `penalty`, `pushing_force`, `rigid_penalty`, `gravity`, …).
- `levelset` — see [§13](#level-sets). Omit for a sensible default container; `container: false` for none.
- `materials` / `bodies` — arrays of `add_particles` configs. Material entries accept texture shorthands `rect`, `sphere`, `cylinder`, `polygon` plus `ppc` (particles per cell density multiplier).
- `wheels`, `sources`, `articulations` — same schemas as the runtime methods.

Everything here also works **while the simulation is running** through the corresponding live methods.

---

<a id="scripted-scenes"></a>
## 7. Scripted scenes

For full control, give the scene a `setup(ctx)` function. It runs in the worker with the engine API in scope:

```js
MPM.registerScene('fountain', {
  name: 'Fountain',
  dim: 2,
  frameDt: 0.01,
  duration: 0,
  setup(ctx) {
    const mpm = ctx.mpm({ res: 192, penalty: 0 });   // creates the solver
    ctx.levelset({ planes: [ { normal: [0, 1], d: -0.06 } ], friction: 0.3 });

    ctx.add({ type: 'water', density: 1000, color: [0.3, 0.6, 1],
              density_tex: { type: 'rect', center: [0.5, 0.15],
                             size: [0.8, 0.16], mul: 2 } });

    // scripted rigid: expression strings are evaluated with t (seconds)
    ctx.add({ type: 'rigid', codimensional: true,
              scripted_position: [0.5, 0.4],
              scripted_rotation: '90 * t',           // deg; or a function
              shape: { segment: [[-0.15, 0], [0.15, 0]] },
              friction: 0.1, color: [0.95, 0.8, 0.4] });

    ctx.wheel({ center: [0.5, 0.62], radius: 0.12, mode: 'free' });
    ctx.source({ type: 'water', position: [0.5, 0.9], velocity: [0, -2] });

    // optional per-frame hook (runs before each frame):
    return { mpm, frameUpdate(t, dt) { /* ... */ } };
  },
});

sim.loadScene('fountain');
```

**`ctx` contents**

| member | description |
|---|---|
| `ctx.mpm(resOrConfig)` | Create the solver. Number → `res`. Returns a `Solver`. |
| `ctx.add(cfg)` | `add_particles` with declarative sugar resolved (textures, shapes, scripts). |
| `ctx.levelset(spec)` | Build + activate a level set from a declarative spec. |
| `ctx.wheel(opts)` / `ctx.source(opts)` | Same as the runtime methods. |
| `ctx.engine`, `ctx.tex` | Raw engine + `TextureFactory` (`rect/sphere/cylinder/ring/polygon`). |
| `ctx.quality`, `ctx.dim` | Active quality string, scene dimension. |
| `ctx.H`, `ctx.constant`, `ctx.pick` | Geometry helpers (see below). |
| `Solver`, `Texture`, `SegmentMesh`, `TriangleMesh`, `LevelSet` | Classes, also reachable as free variables inside `setup`. |

**Helpers (`MPM.Helpers` / `ctx.H`)** — `circle(n, r)`, `polygon(pts)`, `box(hw, hh)`, `regular(n, r)`, `star(n, ro, ri)`, `wheel(r, blades)`, `boxMesh(hx, hy, hz)`, `paddleWheel(blades, rIn, rOut, hz)`, `sidePlates(rIn, rOut, hz)`, `crossPaddle(hw, hh)`, `blade(hh, hz)`, `constant(v)`, `pick(q, low, med, high)`.

**Scripted values** (`scripted_position`, `scripted_rotation`) accept:

```js
scripted_rotation: 90                       // constant (deg, or vec3 in 3D)
scripted_rotation: '90 * t'                 // expression string in t
scripted_rotation: { spin: 120 }            // deg/s sugar
scripted_rotation: (t) => 120 * t           // function (serialized to worker)
scripted_position: (t) => [0.5 + 0.2 * Math.sin(t * 2), 0.5]
```

> Functions are transported with `.toString()` — do not reference variables from your page's scope. Library helpers and `Math` are available.

---

<a id="materials"></a>
## 8. Materials

`type` in any particle config:

| type | model | key parameters (defaults) |
|---|---|---|
| `water` | Weakly-compressible EOS fluid | `density` (1000), `bulk_modulus` |
| `sand` | Drucker–Prager granular | `density` (1500), `friction_angle` (35°), `cohesion` |
| `snow` | Stomakhin 2013 hardening snow | `youngs_modulus` (3e4), `hardening` (10), `density` (400) |
| `jelly` | Fixed corotated elasticity | `E` (2e4), `nu` (0.3), `density` (400) |
| `elastic` | Hencky elasticity | `E`, `nu`, `density` |
| `von_mises` | Von Mises plasticity | `youngs_modulus`, `yield_stress` (150), `density` |
| `rigid` | Rigid body (solid or thin-shell) | see [§10](#rigid-bodies-shapes) |

Common options: `color: [r, g, b]` (0–1), `density_tex` (spawn region — see [§9](#textures)), `initial_velocity`, `pd_source: true` + `delta_t` for emission (handled for you by [sources](#sources)).

`ppc` (in declarative material entries / texture `mul`) scales how many particles spawn per grid cell — 2–4 for fluids, 4–8 for solids in 3D.

---

<a id="textures"></a>
## 9. Textures

Textures define *where* material spawns (and with what density multiplier). Declarative form:

```js
{ type: 'rect',     center: [0.5, 0.5], size: [0.2, 0.1], mul: 4 }
{ type: 'sphere',   center: [0.5, 0.6], radius: 0.1, mul: 4 }
{ type: 'cylinder', center: [0.5, 0.3, 0.5], radius: 0.2, height: 0.1, axis: 1 }
{ type: 'ring',     center: [0.5, 0.5], outer: 0.2, inner: 0.15 }
{ type: 'polygon',  points: [[0.2, 0.2], [0.8, 0.2], [0.5, 0.7]] }
{ type: 'union', a: {...}, b: {...} }        // also intersect / subtract
```

Modifiers: `mul`, `translate: [dx, dy]`, `rotate: { angle, center, axis }`, `bound: { axis, lo, hi }`.

Programmatic form (inside `setup`): `ctx.tex.rect(...).mul(4).union(ctx.tex.sphere(...))`.

---

<a id="rigid-bodies-shapes"></a>
## 10. Rigid bodies & shapes

```js
sim.addRigid({
  codimensional: false,          // false = solid, true = zero-thickness shell
  initial_position: [0.5, 0.8],  // dynamic body...
  initial_rotation: 15,          // degrees (vec3 in 3D)
  density: 600, friction: 0.3, restitution: 0.1,
  shape: { box: [0.06, 0.03] },
  color: [0.85, 0.65, 0.4],
});
```

- **Dynamic** bodies use `initial_position` / `initial_velocity` and are pushed by gravity, contacts and material momentum.
- **Scripted (kinematic)** bodies use `scripted_position` / `scripted_rotation` instead — infinite mass, they drive the material (blades, stirrers, pistons).
- `codimensional: true` shells **cut** materials cleanly (CPIC). Negative `friction` makes a sticky/tangential-driving surface.

**Shape sugar** (`shape:`): `{ circle: r }`, `{ box: [hw, hh] }`, `{ polygon: pts }`, `{ star: [n, ro, ri] }`, `{ wheel: [r, blades] }`, `{ segment: [a, b] }`; 3D: `{ boxMesh: [hx, hy, hz] }`, `{ paddleWheel: [blades, rIn, rOut, hz] }`, `{ blade: [hh, hz] }`. Or pass raw `segments: [[a, b], ...]` / `triangles: [[[x,y,z]×3], ...]`.

`addRigid`/`addParticles` resolve to the **rigid body id** (needed by articulations) or the number of particles added.

---

<a id="wheels"></a>
## 11. Wheels

`sim.addWheel(opts)` — a paddle wheel, added **live** to any scene:

```js
await sim.addWheel({
  center: [0.5, 0.5],
  radius: 0.14,
  blades: 8,
  mode: 'motor',   // 'motor' = scripted rotation | 'free' = driven by material
  speed: 120,      // deg/s (motor only), sign = direction
  density: 60, friction: 0.2, damping: 0.3,
  color: [0.95, 0.75, 0.4],
});
```

- **`motor`** — an automatic wheel: rotation is scripted as `speed × (t − t₀)` starting from the moment you add it. Works in 2D and 3D (spins about z).
- **`free`** — pinned center, free rotation: pour water/sand on it and it spins from two-way coupling. In 3D it is built as paddles + side plates joined by a rotation articulation.

---

<a id="articulations"></a>
## 12. Articulations

```js
const wheel = await sim.addRigid({ ... });
const chassis = await sim.addRigid({ ... });
sim.addArticulation({ type: 'rotation', obj0: wheel, obj1: chassis });
sim.addArticulation({ type: 'motor', obj0: wheel, obj1: chassis,
                      power: -0.8, penalty: 1e4 });
```

- `rotation` — pins relative rotation origins while allowing spin (axial constraint). `obj1` defaults to the static world body.
- `motor` — rotation constraint + constant torque (`power`).
- `distance` — keeps body origins at a fixed distance.

See the `sand-car` built-in for a two-motor crawler.

---

<a id="level-sets"></a>
## 13. Level sets

Signed-distance containers. Inside the solid (`sd < 0`) material is pushed out; walls have friction.

```js
levelset: {
  planes:   [ { normal: [0, 1], d: -0.06 } ],      // dot(n, p) + d >= 0 is free
  box:      { lower: [0.06, 0.06], upper: [0.94, 1.5], inside_out: true },
  sphere:   { center: [0.5, 0.5], radius: 0.3, inside_out: true },
  cylinder: { center: [0.5, 0.5, 0.5], radius: 0.28, inside_out: true },
  polygon:  { points: [[0.2, 0.1], [0.8, 0.1], [0.5, 0.4]] },
  friction: 0.4,
}
```

`inside_out: true` flips the solid — a box becomes a tank, a cylinder becomes a pipe. At runtime, build a new one with `sim.generalAction({ action: 'create_levelset' })` + `levelset_op` / `set_levelset`, or reload with a different declarative `levelset`.

---

<a id="sources"></a>
## 14. Sources

Continuous emitters (Poisson-disk sources evaluated every frame):

```js
const id = await sim.addSource({
  type: 'sand',
  position: [0.3, 0.9],       // or an explicit `texture` spec
  size: [0.06, 0.03],
  velocity: [0.4, -1],        // required non-zero inflow for emission
  ppc: 3,
  density: 1200, friction_angle: 30,
  color: [0.93, 0.76, 0.45],
  until: 5,                   // stop at t = 5 s (0 = forever)
  every: 1,                   // emit every Nth frame
});
sim.removeSource(id);
sim.clearSources();
```

> **Physics note:** PD sources emit on the *inflow shell* of the texture, so a non-zero `velocity` is what makes them flow. MPM.js defaults it to `[0, -1]`.

---

<a id="live-simulation-control"></a>
## 15. Live simulation control

Everything below can be called **while the simulation is running**.

| method | effect |
|---|---|
| `sim.play()` / `sim.pause()` / `sim.toggle()` | Transport. |
| `sim.step()` | Advance exactly one frame while paused. |
| `sim.reset({ autostart })` | Rebuild the current scene from scratch. |
| `sim.loadScene(scene, { quality, autostart, loop })` | Swap scene (id / declarative / scripted). |
| `sim.setQuality('high')` | Reload at a different resolution. |
| `sim.setGravity([x, y])` | Live gravity (also `[x, y, z]` in 3D). |
| `sim.setConfig({ gravity, penalty, pushing_force })` | Live solver parameters. |
| `sim.addParticles(cfg)` → `Promise<count\|id>` | Inject material (see §8–9). |
| `sim.addRigid(cfg)` → `Promise<id>` | Inject a rigid body (§10). |
| `sim.addWheel(opts)` → `Promise<id>` | §11. |
| `sim.addSource(opts)` → `Promise<id>` / `removeSource` / `clearSources` | §14. |
| `sim.addArticulation(cfg)` | §12. |
| `sim.generalAction(cfg)` | Any raw engine action. |
| `sim.onUpdate(fn \| null)` | Per-frame hook (§17). |
| `sim.energy()` → `Promise<number>` | Total mechanical energy. |
| `sim.setPointer(opts)` | Configure the pointer tool (§16). |
| `sim.setColorMode(mode)` / `setShowBlocks` / `setPointScale` / `setBackground` / `setShowRigids` | §19. |
| `sim.stats` / `sim.time` / `sim.state` | Latest telemetry. |
| `sim.destroy()` | Stop everything and remove the canvas. |

Runtime particle/rigid insertion is queued and applied at the **next frame boundary**, so it is always safe. Promises resolve with the engine's return value.

---

<a id="pointer-touch-interaction"></a>
## 16. Pointer & touch interaction

Built-in tools for 2D scenes (mouse, pen and touch — pointer events):

```js
sim.setPointer({ mode: 'push' });                       // drag a paddle through material
sim.setPointer({ mode: 'spawn',                         // paint material
                 material: { type: 'sand', density: 1200,
                             color: [0.93, 0.76, 0.45] },
                 size: 0.025 });
sim.setPointer({ mode: 'tilt', strength: 12 });         // gravity follows your finger
sim.setPointer({ mode: 'off' });
```

| mode | what happens while pressed |
|---|---|
| `off` | Nothing (3D orbit controls unaffected). |
| `push` | A kinematic disc follows the pointer with rate-limited velocity — shove, stir, and (thanks to CPIC) **cut** soft bodies. |
| `spawn` | Emits `material` at the pointer, inheriting some pointer velocity. |
| `tilt` | Gravity points from the domain center toward the pointer, magnitude `strength`. Restored on release. |

The paddle is created with every 2D scene and parked outside the domain when idle. `sim.on('pointer', e => …)` reports world-space coordinates for your own UI. For anything custom, drive a scripted rigid from `onUpdate` (§17) — that is exactly how the built-in tools work.

---

<a id="per-frame-scripting"></a>
## 17. Per-frame scripting

`sim.onUpdate(fn)` installs a hook that runs **inside the simulation loop**, before every frame:

```js
sim.onUpdate(function (t, dt, api) {
  // wobble gravity like a boat
  api.setConfig({ gravity: [6 * Math.sin(t * 1.5), -10] });

  // move a scripted body with your own state
  // (create it with scripted_position: (t) => ...)

  // pulse a source every 2 seconds
  if (Math.floor(t / 2) !== Math.floor((t - dt) / 2)) {
    api.addParticles({ type: 'jelly', E: 2e4, nu: 0.3, density: 400,
      color: [0.96, 0.42, 0.56],
      density_tex: { type: 'sphere', center: [0.2 + 0.6 * api.random(), 0.85],
                     radius: 0.05, mul: 4 } });
  }
});
sim.onUpdate(null); // remove
```

`api`: `addParticles`, `addWheel`, `addSource`, `removeSource`, `setConfig`, `pointer` (live pointer state), `random`. Same serialization rules as scene functions — no page-scope closures.

---

<a id="events"></a>
## 18. Events

```js
sim.on('ready',    ({ simd, mode }) => {});   // engine compiled; mode 'worker'|'main'
sim.on('loaded',   (info) => {});             // { name, dim, res, frameDt, duration, ... }
sim.on('frame',    (stats) => {});            // telemetry, every rendered frame
sim.on('state',    ({ running, finished }) => {});
sim.on('finished', () => {});                 // duration reached
sim.on('pointer',  ({ x, y, down }) => {});   // world-space pointer
sim.on('log',      ({ line, level }) => {});  // solver logs
sim.on('error',    ({ message }) => {});
sim.off('frame', handler);
```

`stats` fields: `t`, `frame`, `particles`, `rigids`, `substeps`, `dt`, `msPerSubstep`, `substepsPerSec`, `simSpeed`, `blocks`, `fatBlocks`, `rigidBlocks`, `cutting`, `nearBoundary`, `memoryMB`, …

`sim.ready` is a promise that resolves when the engine is compiled.

---

<a id="rendering-options"></a>
## 19. Rendering options

- `setColorMode('material' | 'velocity' | 'cpic' | 'default' | 'plasticity')` — per-particle coloring. `cpic` shows which side of a cutting shell each particle lives on.
- `setPointScale(1.4)` — bigger/smaller sprites.
- `setBackground('#101828')`.
- `setShowBlocks(true)` — the solver's adaptive sparse blocks (orange = rigid).
- `setShowRigids(false)` — hide rigid geometry.
- `sim.renderer.camera` — 3D orbit camera `{ target, distance, yaw, pitch }`; drag/wheel/dblclick are wired automatically.
- The renderer is WebGL2, DPI-aware, and re-renders on demand (also while paused).

---

<a id="recipes"></a>
## 20. Recipes

### Automatic wheel in any scene

```js
const sim = MPM.create('#sim', { scene: 'buoyancy' });
sim.on('loaded', () => {
  sim.addWheel({ center: [0.5, 0.55], radius: 0.16, mode: 'motor', speed: 100 });
});
```

### Sand faucet + free wheel (a working sand mill)

```js
sim.loadScene({
  name: 'Sand mill', dim: 2, duration: 0,
  materials: [],
  wheels: [{ center: [0.5, 0.4], radius: 0.2, blades: 10, mode: 'free',
             friction: -2, damping: 1.5 }],
  sources: [{ type: 'sand', position: [0.36, 0.92], size: [0.05, 0.03],
              velocity: [0.2, -1], ppc: 3, density: 1200,
              color: [0.93, 0.76, 0.45] }],
});
```

### Touch painting

```js
sim.setPointer({ mode: 'spawn', size: 0.03,
  material: { type: 'jelly', E: 2e4, nu: 0.3, density: 400,
              color: [0.96, 0.42, 0.56], ppc: 3 } });
```

### Oscillating piston (scripted body)

```js
sim.addRigid({
  codimensional: true, friction: 0.1, color: [0.7, 0.8, 0.95],
  scripted_position: '(function(){ return [0.5, 0.3 + 0.12 * Math.sin(t * 4)]; })()',
  shape: { box: [0.12, 0.015] },
});
// or with a function: scripted_position: (t) => [0.5, 0.3 + 0.12*Math.sin(t*4)]
```

### Gravity slider

```js
input.addEventListener('input', () => {
  const a = Number(input.value) * Math.PI / 180;
  sim.setGravity([10 * Math.sin(a), -10 * Math.cos(a)]);
});
```

---

<a id="performance-guide"></a>
## 21. Performance guide

- **Quality = resolution.** Cost scales ~`res²` (2D) / `res³` (3D) and with particle count. Start `medium`; use `low` on phones.
- Watch `stats.simSpeed` — `1.0` means real-time. Below ~0.5, drop quality or particle density (`ppc`).
- `stats.msPerSubstep` × substeps/frame ≈ frame cost. The worker keeps the UI at 60 fps regardless.
- Prefer `sources` over giant initial fills; cap them with `until`.
- 3D at `high` (72³) is demanding — it is a showcase preset.
- SIMD is auto-detected (`stats`/`ready.simd`); the baseline WASM fallback is ~2× slower.

---

<a id="architecture"></a>
## 22. Architecture

```
mpm.js  (single IIFE, no imports)
├─ Engine        WASM host: WASI shim, config marshalling, script callbacks
├─ Solver / Texture / LevelSet / SegmentMesh / TriangleMesh   (tc.* analogues)
├─ Scenes        10 built-ins + declarative compiler + registry
├─ SimHost       frame loop, sources, pointer tools, runtime action queue
├─ Renderer      WebGL2 points / shells / meshes, orbit camera
└─ Simulation    public API + worker bridge (Blob worker of this same file)
```

The worker is spawned by fetching the library's own `<script>` source and wrapping it in a `Blob` — inside a worker the same file boots `SimHost` instead of the public API. Particle buffers are transferred (zero-copy) each frame with an ack-based flow control, so a slow renderer never queues stale frames.

---

<a id="browser-support-csp"></a>
## 23. Browser support & CSP

- Needs **WebGL2** + **WebAssembly** (all evergreen browsers, Safari 15+).
- SIMD is used when available (`WebAssembly.validate`).
- Worker mode needs `blob:` workers and the ability to `fetch` the script URL (same-origin or CORS). Otherwise it falls back to the main thread automatically.
- Scene *functions* and expression strings are compiled with `eval` in the library scope: a strict CSP must allow `'unsafe-eval'` for scripted scenes (purely declarative scenes still need it for scripted-value compilation only if used).
- `MPM.__inlineSource = "<library source text>"` lets bundler users provide the worker source explicitly.

---

<a id="low-level-api"></a>
## 24. Low-level API

For tooling and tests, the internals are exposed:

```js
const eng = await MPM.Engine.create(console.log);
const solver = new MPM.Solver(eng, 2, { res: [128, 128] });
const ls = solver.create_levelset();
ls.add_plane([0, 1], -0.06).set_friction(0.4);
solver.set_levelset(ls);
const tex = new MPM.TextureFactory(eng, 2).rect([0.5, 0.5], [0.2, 0.2]).mul(4);
solver.add_particles({ type: 'water', density: 1000, density_tex: tex });
eng.beginStep(0.01);
while (!eng.advance(16)) {}
const { data, count } = eng.exportParticles(0);  // xyz + packed RGBA per particle
```

`MPM.Engine`, `MPM.Solver`, `MPM.Texture`, `MPM.TextureFactory`, `MPM.SegmentMesh`, `MPM.TriangleMesh`, `MPM.LevelSet`, `MPM.Helpers`, `MPM.Renderer`, `MPM.Simulation`.

---

*MPM.js — the taichi_mpm full solver (MLS-MPM, CPIC, MPR rigid contacts, articulations) ported to WebAssembly and packaged for the open web. MIT licensed.*