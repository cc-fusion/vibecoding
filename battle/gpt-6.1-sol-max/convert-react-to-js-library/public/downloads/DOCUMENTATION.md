# mpm.js 1.0.0

A framework-free JavaScript library for the MLS-MPM + CPIC material simulation in the supplied archive. The original embedded scalar and SIMD WebAssembly solvers, all ten original 2D/3D scenes, and the WebGL2 renderer are retained. The new public API has no React, TypeScript, package manager, or build-step requirement.

## Download Contents

- `dist/mpm.js`: self-contained classic script; exposes the global `MPM` namespace.
- `dist/mpm.esm.js`: the same library as an ES module.
- `src/`: readable JavaScript sources, including the original converted engine, scenes, renderer, and worker.
- `examples/`: runnable plain-HTML and JavaScript demonstrations.
- `native/`: original C++ source, build instructions, and a converted JavaScript solver test.
- `MIGRATION.md`: provenance, conversion details, and implementation tradeoffs.

The WebAssembly binaries are embedded in the JavaScript. There are no separate WASM requests, worker URLs, external CDN dependencies, or cross-origin-isolation headers to configure. The distribution is approximately 1 MB before HTTP compression; it is not a tiny JavaScript-only physics engine.

## Browser Requirements

Use a current Chrome, Edge, Firefox, or Safari with WebAssembly, WebGL2, ResizeObserver, Pointer Events, and ES2022 support. SIMD is detected automatically; the scalar build is selected when SIMD is unavailable. The WebAssembly solver uses the main thread in short, time-sliced batches so that page-defined JavaScript callbacks and live mutations do not require serialization or `eval`.

Serve files over HTTP or HTTPS. For local development, run `python3 -m http.server 8000` in the extracted folder, then visit `http://localhost:8000/examples/`. Do not rely on `file://` for module examples. A strict Content Security Policy must allow WebAssembly compilation (usually `script-src 'self' 'wasm-unsafe-eval'`) and your own application scripts. No JavaScript `unsafe-eval` is needed. Hardware, scene resolution, particle count, and material stiffness determine simulation speed; the rendering FPS is not a promise of real-time physics.

## Quick Start: Script Tag

```html
<!doctype html>
<html lang="en">
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>My first mpm.js scene</title>
  <canvas id="world" style="width:100%;height:420px;display:block"></canvas>
  <script src="./dist/mpm.js"></script>
  <script>
    (async () => {
      const sim = await MPM.create({
        canvas: "#world",
        scene: MPM.demoScene("sand"),
        interactions: { material: "sand" },
      });
      window.sim = sim;
    })().catch(console.error);
  </script>
</html>
```

`MPM.create()` is asynchronous: wait for WebAssembly initialization before calling simulation methods. The canvas must have a nonzero CSS width and height. It is resized automatically for the device-pixel ratio (capped at 2).

## ES Modules

```html
<canvas id="world" style="width:100%;height:420px"></canvas>
<script type="module">
  import { create, createScene } from "./dist/mpm.esm.js";
  const sim = await create({
    canvas: "#world",
    scene: createScene({
      particles: [{ material: "water", center: [0.5, 0.65], radius: 0.12 }],
    }),
  });
</script>
```

## Creating Your Own Scenes

You never need to edit the library. Pass an ordinary JavaScript scene object from your page, application code, or a parsed JSON configuration.

```js
const myScene = MPM.createScene({
  id: "my-scene",
  name: "Sand and water",
  dim: 2,
  resolution: 128,
  world: [1, 1],
  gravity: [0, -5],
  friction: 0.4,
  particles: [
    {
      material: "sand",
      shape: "rect",
      center: [0.3, 0.55],
      size: [0.2, 0.25],
      color: "#edbc72",
    },
    {
      material: "water",
      shape: "circle",
      center: [0.7, 0.7],
      radius: 0.12,
      velocity: [-0.3, 0],
    },
  ],
});
const sim = await MPM.create({ canvas: "#world", scene: myScene });
```

World coordinates use a bottom-left origin. X increases to the right; Y increases upward. X has length 1. `world` sets the physical lengths of the other axes, for example `[1, 0.5]` for a landscape 2D scene. The grid cell width is `1 / resolution`; the other grid dimensions are derived from `world`. Keep particles and rigid bodies at least eight grid cells from the domain edge. Default walls are placed at this safety margin; the upper edge is open. Particles near the outer deletion band may be removed by the original solver.

### Scene Options

| Option                  | Default                  | Meaning                                                                             |
| ----------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `id`, `name`            | `custom`, `Custom scene` | Your scene identifiers.                                                             |
| `dim`                   | `2`                      | `2` or `3`.                                                                         |
| `resolution`            | `128` / `40`             | X grid resolution. Valid 2D range 32..512, 3D range 32..96. Start low.              |
| `world`                 | `[1, 1]` / `[1, 1, 1]`   | Physical domain size; first entry must be 1.                                        |
| `gravity`               | `[0, -5]` / `[0, -5, 0]` | Gravity vector.                                                                     |
| `frameDt`               | `1 / 120`                | Requested simulation time advanced per logical frame.                               |
| `particles`             | `[]`                     | Initial material-shape descriptions.                                                |
| `boundaries`            | `true`                   | Set `false` to define all boundaries yourself.                                      |
| `friction`              | `0.4`                    | Default level-set wall friction.                                                    |
| `config`                | `{}`                     | Additional original solver creation options.                                        |
| `render`                | `{}`                     | Renderer options, documented below.                                                 |
| `setup(context)`        | none                     | Add custom level sets, meshes, and original-solver materials. Called on load/reset. |
| `update(sim, time, dt)` | none                     | Called once before each logical simulation frame.                                   |
| `camera`, `decor`       | none                     | Original 3D camera and decorative geometry options.                                 |

## Materials And Shapes

The high-level material names are `sand`, `water`, `jelly`, `snow`, `elastic`, and `von_mises`. Their defaults are intentionally moderate for interactive scenes. The original solver's additional `linear` and `visco` material types remain accessible through the low-level `sim.solver.add_particles()` API.

Particle descriptions accept:

| Field              | Meaning                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `material`         | One of the six high-level material names. Defaults to `sand`.                                                                |
| `shape`            | `circle` / `sphere`, `rect` / `box`, or `polygon` (2D only).                                                                 |
| `center`           | Two- or three-component position.                                                                                            |
| `radius`           | Circle/sphere radius. Default `0.04`.                                                                                        |
| `size`             | Rectangle/box full dimensions, not half-extents.                                                                             |
| `points`           | Array of polygon vertices; use counterclockwise winding.                                                                     |
| `color`            | `#rgb`, `#rrggbb`, or `[r,g,b]` with values in 0..1.                                                                         |
| `velocity`         | Initial velocity vector. Defaults to zero.                                                                                   |
| `particlesPerCell` | Sampling density, 0.1..16. Default 2. This is not an exact particle count.                                                   |
| `properties`       | Native material parameters such as `density`, `friction_angle`, `E`, `nu`, `youngs_modulus`, `yield_stress`, or `hardening`. |

```js
sim.addParticles({
  material: "jelly",
  shape: "circle",
  center: [0.5, 0.65],
  radius: 0.1,
  color: "#b19de2",
  properties: { E: 9000, nu: 0.3, density: 600 },
});
```

## Runtime Controls

```js
sim.pause();
sim.play();
await sim.step(); // Complete one logical frame while paused.
sim.setGravity([0, -2]); // Change gravity without resetting particles.
sim.setConfig({ penalty: 1000 }); // Supported: gravity, penalty, pushing_force.
sim.addParticles({ material: "water", center: [0.5, 0.7], radius: 0.05 });
sim.loadScene(myScene); // Preserves running/paused state; disables old pointer bindings.
sim.reset(); // Reloads the last scene description.
```

Structural changes requested while a frame is being advanced are queued until the next frame boundary, avoiding mutations inside the solver's substep pipeline. A partial frame paused mid-step is completed before queued structural mutations are applied when playback/stepping resumes. When paused at a complete frame boundary, changes render immediately. `addParticles()` is chainable; inspect the `particlesadded` event for the actual sampled count. The default 35,000-particle soft limit prevents subsequent high-level additions once the reported count reaches the limit; one addition can cross that limit. Initial scene data and low-level calls are not capped.

## Automatic Wheels

Add a rotating, physically coupled thin-shell paddle wheel to any high-level 2D scene, including while it is running:

```js
const wheel = sim.addWheel({
  center: [0.5, 0.3],
  radius: 0.13,
  blades: 8,
  speed: 90, // Degrees per simulation second; negative reverses direction.
  color: "#eae5d9",
});
wheel.setSpeed(-120);
wheel.move([0.6, 0.3]);
wheel.stop();
wheel.start(90);
```

Wheels use scripted rotation, so they are motor-driven rather than torque-limited. Speed changes preserve the current angle. `id` becomes available when the queued rigid-body addition is applied. The helper supports up to ten wheels per scene and 3..24 blades. The underlying solver also limits total rigid bodies, including ones added by custom setup code. Keep the entire wheel inside the safe domain. Load/reset the scene to remove wheels. Original free-spinning and motor-articulated wheels are available in the preserved scenes and through low-level articulations. For a 3D wheel, use `TriangleMesh` and the low-level API or the `water-wheel-3d` preset.

## Mouse, Pen, And Touch

```js
sim.enableInteractions({
  material: "sand",
  radius: 0.028,
  velocity: [0, -0.35],
  interval: 65,
  particlesPerCell: 2,
});
sim.on("pointer", ({ point, pressure, pointerType }) => {
  console.log(point, pressure, pointerType);
});
// Later:
sim.disableInteractions();
```

The built-in 2D interaction pours particles while clicking/touching and moving. It does not grab existing particles or simulate a force brush. Pointer Events, pointer capture, multiple pointer IDs, and `pointercancel` are handled; the canvas temporarily uses `touch-action: none` and restores the previous inline value on disable. Pouring is throttled and clipped to the safe domain. Call it again to change the active material or settings. Reset/load disables the old binding, so re-enable it for the new scene. In 3D, the renderer supports drag-to-orbit, wheel-to-zoom, and double-click-to-reset instead of pouring.

For your own gestures, use the ordinary DOM `pointerdown`, `pointermove`, `pointerup`, and `pointercancel` events, call `sim.renderer.screenToWorld(clientX, clientY)` in 2D, and drive any public simulation method. No source changes are required.

## Custom Animation And Emitters

Callbacks run in your page's JavaScript context. They can close over your application state and use your own UI controls.

```js
let nextEmission = 0;
const unsubscribe = sim.on("beforeStep", ({ time, dt }) => {
  if (time >= nextEmission) {
    nextEmission = time + 0.1;
    sim.addParticles({
      material: "sand",
      center: [0.5 + Math.sin(time) * 0.15, 0.7],
      radius: 0.025,
      velocity: [0, -0.5],
    });
  }
});
// Remove just this callback:
unsubscribe();
```

Events are `beforeStep`, `afterStep`, `stats`, `statechange`, `scenechange`, `particlesadded`, `wheelchange`, `pointer`, `error`, and `destroy`. `on(event, callback)` returns an unsubscribe function. `off(event, callback)` removes the same listener. Callback exceptions during playback stop the simulation and emit `error`; callbacks should be short and avoid unbounded particle emission. Unsubscribe application-specific callbacks before switching scenes if they should not continue in the new scene.

`stats` reports `{ particles, time, frame, fps, memoryMB, simd }` approximately twice per second and on forced updates. `fps` measures submitted render updates, not simulated frames or solver throughput. Current values are also readable from `sim.stats`.

## Rendering

```js
sim.setRenderOptions({ pointScale: 1.4, showRigids: true, showBlocks: false });
```

Other 2D options are `bounds: [xMin,yMin,xMax,yMax]`, `grid`, `showDomain`, and `hideLevelset`. The viewport fits these bounds without distorting world geometry. Example landscape bounds: `[0, 0, 1, 0.5]`. The 3D camera has `target`, `distance`, `yaw`, and `pitch`, matching the original renderer. `canvas` CSS sizing drives automatic resize.

## Original Scenes And Low-Level API

```js
console.table(MPM.scenes.map(({ id, name, dim }) => ({ id, name, dim })));
sim.loadScene("water-wheel-3d");
```

Preserved scene IDs: `cutting`, `sand-wheel`, `water-wheel-2d`, `buoyancy`, `sand-car`, `materials`, `water-wheel-3d`, `sand-stir-3d`, `jelly-cut-3d`, and `rigid-pile-3d`. Pass `quality: 'low'`, `'medium'`, or `'high'` to `create()` for these original presets. Their original source emission timelines remain unchanged. The wrapper continues playback after their original display duration instead of stopping automatically.

Exports include `MPMEngine`, `Solver` (the original MPM class), `TextureFactory`, `Texture`, `SegmentMesh`, `TriangleMesh`, `LevelSet`, and `Renderer`. The active instance exposes `sim.engine`, `sim.solver`, and `sim.textures`.

```js
const scene = MPM.createScene({
  setup({ solver, textures }) {
    solver.add_particles({
      type: "jelly",
      E: 10000,
      nu: 0.3,
      density: 600,
      color: [0.7, 0.6, 0.9],
      density_tex: textures.rect([0.5, 0.65], [0.2, 0.2]).mul(3),
    });
  },
});
```

Low-level calls retain the original snake_case names and behavior. They bypass high-level validation and particle limits; use `sim.mutate(() => { /* low-level edits */ })` for structural changes during playback. The original converted worker is included for reference/advanced integrations; the new high-level library does not instantiate it.

## Lifecycle And Errors

```js
const sim = await MPM.create({
  canvas: "#world",
  autoplay: false,
  budget: 6,
  maxParticles: 35000,
  onLog: (line, level) => console.log(level, line),
});
sim.on("error", (error) => console.error(error));
// When removing the canvas or leaving the page:
sim.destroy();
```

`destroy()` cancels animation, removes renderer and interaction listeners, disconnects resize observation, releases WebGL buffers/textures/programs, resets the solver, and clears application listeners. Do not reuse a destroyed instance. Each instance owns its own WebAssembly memory; create only as many simultaneous instances as needed. A solver trap or invalid low-level operation may require destroying and recreating the instance. If WebGL2 is unavailable, initialization rejects with an explanatory error instead of displaying a fake simulation.

## Rebuilding The Distribution

The downloaded files are ready to use. In this website's source project, run `node scripts/build-library.mjs` to regenerate both JavaScript bundles, Markdown download, and the source ZIP. Run `npm run build` for the documentation website. The solver binaries are unchanged; rebuilding native C++ requires the separate WASI toolchain described in `native/README.md`.

## Attribution And License Notes

Source archive: https://github.com/cc-fusion/vibecoding/blob/main/battle/claude-opus-5.5-max/i-opus-55-max.zip

Original solver lineage: https://github.com/yuanming-hu/taichi_mpm (MLS-MPM + CPIC, Hu et al., SIGGRAPH 2018). The supplied archive contains no top-level LICENSE file. No new license grant is implied for the inherited code or binaries; review the upstream repository's license and attribution requirements before redistribution or commercial use.
