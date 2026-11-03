# TaichiMPM — JavaScript physics, in your browser

A JavaScript-only distribution of the full MLS-MPM + CPIC solver from the supplied [cc-fusion/vibecoding archive](https://github.com/cc-fusion/vibecoding/blob/main/battle/claude-opus-5.5-max/i-opus-55-max.zip), with a reusable browser library, a visual playground, a JSON scene editor, live runtime controls, and complete documentation.

The native C++/WebAssembly solver is preserved. Both SIMD128 and scalar WASM binaries are embedded in the standalone library. React/TypeScript application files have been converted to JavaScript/JSX; the browser API requires **no React, TypeScript, bundler, framework, or external CDN**.

## 1. What is included

| Asset | Purpose |
| --- | --- |
| `public/taichi-mpm.js` | The standalone IIFE library. Load with `<script src="./taichi-mpm.js"></script>`. |
| `src/lib/` | JavaScript engine, renderer, worker, declarative scene builder, and public API. |
| `src/lib/wasm/mpmWasm.js` | Both original WebAssembly binaries encoded as base64. |
| `src/` (JSX/JS components) | The React-based playground and documentation website. React is **not** a dependency of the standalone library. |
| `native/` | Original C++ sources and build tooling, with JavaScript-aware paths. |
| `public/examples/quickstart.html` | Working, one-script-tag browser example. |
| `public/examples/my-first-scene.json` | A valid JSON scene you can import, edit, and run. |
| `README.md` / `docs/taichi-mpm.md` | This complete, offline Markdown guide. |
| `scripts/build-library.mjs` | Generates the self-contained browser bundle and embedded worker. |
| `scripts/test-worker.mjs` | Native engine regression checks for all ten scenes and the JSON builder. |
| `scripts/test-browser.mjs` | Desktop/mobile, editor, navigation, and standalone-API browser tests. |

The downloadable full source kit is `public/downloads/taichi-mpm-javascript.zip`. The standalone JavaScript library is approximately 2 MB uncompressed, including the worker and both WASM builds. It is not a thin wrapper requiring additional network requests.

## 2. Quick start — one script tag

1. Download `taichi-mpm.js`.
2. Put it next to your HTML file.
3. Serve the folder with a static web server. For local development, `python3 -m http.server 8080` is sufficient.
4. Give the simulation container an explicit height.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    #simulation { width: 100%; height: 480px; }
    #simulation canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="simulation"></div>
  <script src="./taichi-mpm.js"></script>
  <script type="module">
    const sim = await TaichiMPM.create({
      container: '#simulation',
      scene: 'cutting',
      quality: 'medium',
      autoPlay: true
    });
    sim.on('error', error => console.error(error));
  </script>
</body>
</html>
```

In a normal HTML script, use an async function or `.then()` instead of top-level `await`:

```html
<script>
  TaichiMPM.create({
    container: '#simulation',
    scene: 'cutting',
    autoPlay: true
  }).then(sim => {
    window.physics = sim;
  }).catch(console.error);
</script>
```

### Important initialization behavior

`TaichiMPM.create(options)` returns a **Promise of a Simulation instance**. The instance is constructed immediately, and the WebAssembly worker starts asynchronously. `await create()` does not mean that the first frame has loaded. Use `sim.on('loaded', info => ...)` for scene readiness, or inspect `sim.info` and `sim.ready`.

`await sim.loadScene(scene, options)` resolves once the specified scene has initialized. A `ready` event signals that the worker is ready for commands; a `loaded` event signals scene initialization.

## 3. Built-in scenes

| ID | Name | Dimensions | What it demonstrates |
| --- | --- | --- | --- |
| `cutting` | CPIC Cutting | 2D | Jelly, snow, von Mises plasticity, scripted knives and cutting affinity |
| `sand-wheel` | Sand Wheel | 2D | Granular flow, thin-shell CPIC, rotation articulation, PD emitter |
| `water-wheel-2d` | Water Wheel 2D | 2D | Water, momentum transfer, a pinned rotating wheel |
| `buoyancy` | Buoyancy | 2D | Water, different rigid-body densities, floating and sinking |
| `sand-car` | Motorized Crawler | 2D | Sand, motor articulations, a rigid crawler |
| `materials` | Material Zoo | 2D | Water, snow, jelly, sand, elastic, von Mises, a rigid hammer |
| `water-wheel-3d` | 3D Water Wheel | 3D | Paddles, rotation articulation, 3D water |
| `sand-stir-3d` | 3D Sand Stirring | 3D | A cylindrical sand tank and a scripted stirrer |
| `jelly-cut-3d` | 3D Jelly Cutting | 3D | Thin-shell slicing of jelly and snow |
| `rigid-pile-3d` | 3D Rigid Bodies in Water | 3D | Mesh collisions, MPR contacts, buoyancy |

Load any of them without editing source:

```js
await sim.loadScene('sand-wheel', { quality: 'low', autoPlay: true });
```

`TaichiMPM.SCENES` is a list of scene definitions. `TaichiMPM.getScenes()` returns a JSON-safe list of scene names and metadata. The high-level scene editor is designed for JSON scene definitions; the original scripted presets can be loaded by ID.

## 4. Create a scene without source edits

The website's **Scene editor** lets you enter JSON, add and remove objects, change the resolution, choose the boundary conditions, and apply a scene directly. **New scene** starts with a working example. **Import JSON** loads a scene from disk; **Export** downloads a scene to reuse in other applications.

A valid 2D scene:

```json
{
  "id": "my-first-scene",
  "name": "My first scene",
  "dim": 2,
  "resolution": 160,
  "gravity": [0, -9.81],
  "duration": 0,
  "boundaries": {
    "floor": true,
    "walls": true,
    "friction": 0.4
  },
  "objects": [
    {
      "id": "water",
      "type": "particles",
      "material": "water",
      "shape": "sphere",
      "center": [0.35, 0.7],
      "radius": 0.1,
      "color": "#57b8f5",
      "density": 4
    },
    {
      "id": "wheel",
      "type": "rigid",
      "shape": "wheel",
      "center": [0.5, 0.28],
      "radius": 0.15,
      "blades": 8,
      "color": "#e9b870",
      "motion": { "enabled": true, "speed": 90 }
    }
  ]
}
```

Create it from JavaScript:

```js
const definition = await fetch('./scene.json').then(r => r.json());
await sim.loadScene(definition, { autoPlay: true });
```

Register reusable scenes globally for the library:

```js
TaichiMPM.registerScene(definition);
await sim.loadScene(definition.id);
TaichiMPM.unregisterScene(definition.id);
```

The scene registry is shared by instances on the page. Definitions are plain JSON and are cloned before loading; a caller's original object is not mutated by the solver.

### Scene schema

| Field | Value / behavior |
| --- | --- |
| `id` | Unique identifier for your scene. Required when using the registry. |
| `name` | Human-readable scene label. |
| `dim` | Required: `2` or `3`. |
| `resolution` | Grid cells per axis; 32–384. 160 is a useful 2D default; 48 is a useful 3D start. |
| `gravity` | Vector of finite numbers matching the dimension. `gravity: [0, -9.81]` in 2D; `[0, -9.81, 0]` in 3D. |
| `duration` | Automatic scene length in seconds. `0` means unbounded. Built-in presets finish at their documented durations. Press Play to continue beyond a duration. |
| `frameDt` | Optional nominal frame duration; default `0.01` seconds. |
| `boundaries` | `floor`, `walls`, `friction`. The floor is at `y = 0.06`; the side walls are at `x = 0.06` and `x = 0.94`. The floor and walls can be disabled independently. |
| `objects` | Array of particles, rigid bodies, and emitters. |

### Object schema

| Field | Meaning |
| --- | --- |
| `type` | `particles`, `rigid`, or `emitter`. |
| `material` | `water`, `jelly`, `snow`, `sand`, `von_mises`, or `elastic`. Not required for rigid bodies. |
| `shape` | `sphere`, `rect`, `box`, `ring`, `polygon`, `circle`, `blade`, or `wheel`. |
| `center` | World position; vectors have `dim` components. |
| `size` | Full width, height, and optionally depth. Rectangular geometry uses this instead of a radius. |
| `radius` | Positive geometry radius in world units. |
| `innerRadius` | Inner radius for a ring. |
| `points` | Array of world-space polygon points, used with `shape: 'polygon'`. |
| `color` | Six-digit hex string such as `#57b8f5`, or an RGB/RGBA vector of normalized numbers. |
| `density` | Particle sampling density per cell; a small value such as 2–5 is suitable for scenes. |
| `massDensity` | Optional material mass density, distinct from the number of sampled material points. |
| `velocity` | Initial velocity vector, matching `dim`. |
| `motion` | Rigid-body automatic motion: `{ enabled: true, speed: 90 }`. Speed is in **degrees per second**. Negative values reverse direction. |
| `friction` / `restitution` | Optional rigid-body contact parameters. |

World space is normalized to the simulation domain: `[0, 1]` on each axis. For 3D scenes, use three components for centers, gravity, and velocities. The high-level geometry builder supports box, sphere, and wheel meshes in 3D, and the extra 2D shapes above.

The solver has additional lower-level constitutive parameters; `E`, `nu`, `youngs_modulus`, `yield_stress`, `hardening`, and `friction_angle` are selected by material in the declarative builder. If you need the complete raw configuration API, use the included JavaScript engine and scene modules rather than editing the standalone bundle.

## 5. Change the simulation while running

### Physics and playback

```js
sim.update({
  gravity: -4.5,
  gravityEnabled: true,
  wheelSpeed: 120,
  automaticWheel: true,
  speed: 1
});
```

- `gravity` is the vertical acceleration in m/s². `-9.81` is Earth-like. `0` means no vertical gravity.
- `gravityEnabled: false` suspends gravity without losing the current numeric value.
- `wheelSpeed` changes the angle rate of scripted rigid bodies, preserving the current phase. Negative values reverse the rotation.
- `automaticWheel: false` holds scripted rotation; `true` resumes it. This affects scripted/JSON wheels, not unconstrained rigid-body articulation dynamics.
- `speed` scales the simulation time step. It accepts `0.1`–`3`; the playground offers convenient values from `0.25×` to `2×`.

The `update()` method is immediate from the caller's perspective and returns the Simulation instance for chaining. The worker applies the change on its next safe control-message boundary. No scene reload or source modification is needed.

### Add particles to an existing scene

```js
await sim.addParticles({
  material: 'jelly',
  shape: 'sphere',
  center: [0.5, 0.75],
  radius: 0.08,
  color: '#e68ccf',
  density: 3
});
```

The Promise resolves once the worker has accepted the particle configuration and issued its next frame. It does **not** copy or reset the existing scene.

### Add an automatic wheel while running

```js
await sim.addRigid({
  id: 'my-live-wheel',
  shape: 'wheel',
  center: [0.65, 0.35],
  radius: 0.12,
  blades: 8,
  color: '#e9b870',
  motion: { enabled: true, speed: 90 }
});

// Now speed it up, or hold it in place.
sim.update({ wheelSpeed: 180 });
setTimeout(() => sim.update({ automaticWheel: false }), 5000);
```

Live rigid bodies use the same safe worker boundary as particle insertion. New scripted rotations start from the current simulation time, rather than jumping forward by the history of the scene. Reversing a scripted wheel preserves its current phase.

### Playback and reset

```js
sim.pause();
sim.step(); // exactly one nominal simulation frame while paused
sim.play();
await sim.reset({ autoPlay: false });
```

Pausing keeps all particles and rigid bodies intact. Reset recreates the current scene and resets simulation time. The UI's Reset button starts paused, while `reset()` preserves the existing playback state by default.

### Touch, mouse and pen interactions

The default interaction mode emits a small burst of material when the user touches or drags on the canvas:

```js
sim.setInteraction({ enabled: true, mode: 'touch' });
```

Choose a 3D orbit mode for camera controls:

```js
sim.setInteraction({ enabled: true, mode: 'orbit' });
```

In orbit mode, dragging changes yaw and pitch, the mouse wheel changes distance, and double-clicking resets the camera. Pointer capture keeps drag gestures stable when the pointer leaves the canvas. CSS `touch-action: none` is set on the canvas to prevent accidental scrolling during manipulation.

Use custom mode if your app should decide what a touch does:

```js
sim.setInteraction({ enabled: true, mode: 'custom' });
sim.on('interact', ({ position, clientX, clientY }) => {
  sim.emitParticles(position, [0, 0.6], 'jelly', '#e68ccf');
});
```

Custom mode does not also emit the default water burst. The `interact` event reports the normalized **world-space** position of the pointer. For 2D, it is the inverse orthographic camera mapping. For 3D touch mode, it maps to a plane through the camera's target; pass an exact three-component vector to `emitParticles` for explicit placement.

### Visualization

```js
sim.setOptions({
  colorMode: 1,
  pointScale: 1.4,
  showRigids: true,
  showBlocks: false,
  grid: true
});
```

- Color mode `0`: material color.
- Color mode `1`: velocity.
- Color mode `2`: CPIC side / affinity; useful for cutting and shell separation.
- Color mode `3`: constitutive model.
- Color mode `4`: plastic state, including `Jp` / `J` behavior.
- `pointScale`: display size only; does not alter physical particle density.
- `showBlocks`: exposes the sparse solver page map in 2D.

## 6. Complete public API

### Global exports

| Export | Description |
| --- | --- |
| `TaichiMPM.create(options)` | Promise resolving to a Simulation instance. |
| `TaichiMPM.Simulation` | Main high-level browser class. |
| `TaichiMPM.version` | `1.0.0`. |
| `TaichiMPM.starterScene` | A reusable JSON scene with materials and an automatic wheel. |
| `TaichiMPM.COLOR_MODES` | Human-readable visualization modes. |
| `TaichiMPM.registerScene(scene)` | Validate and register a JSON scene by ID. |
| `TaichiMPM.unregisterScene(id)` | Remove a registered scene. |
| `TaichiMPM.getRegisteredScenes()` | Return cloned JSON scene definitions. |
| `TaichiMPM.getScenes()` | Scene metadata, without setup functions. |
| `TaichiMPM.validateScene(scene)` | Validate a declarative scene; throws on invalid data. |
| `TaichiMPM.MATERIALS` / `PALETTE` | Supported material IDs and default color palette. |
| `TaichiMPM.DEFAULT_SCENE` | Original starter definition, safe to clone. |

The bundle also exports `MPMEngine`, `MPM`, `TextureFactory`, `Texture`, `SegmentMesh`, `TriangleMesh`, `LevelSet`, `Renderer`, and the original built-in `SCENES` metadata for advanced integration. Lower-level solver operations should be run on a worker thread, as shown by the included worker source.

### Simulation options

```js
const sim = await TaichiMPM.create({
  container: '#simulation', // Element or CSS selector
  // Alternatively: canvas: document.querySelector('canvas')
  scene: 'cutting',          // Preset ID or a JSON scene definition
  quality: 'medium',         // low | medium | high
  autoPlay: false,
  renderOptions: { pointScale: 1, grid: true },
  // Optional: workerURL: '/my-hosted-worker.js'
  // Optional: camera: { target: [0.5, 0.35, 0.5], distance: 1.4, yaw: 30, pitch: 22 }
  onReady(info) { },
  onState(state) { },
  onStats(stats) { },
  onFrame(frame) { },
  onError(error) { }
});
```

By default the embedded worker is built from a Blob URL. If your CSP disallows `blob:` workers, create a self-hosted worker from the JavaScript worker bundle or use an explicit `workerURL` that matches your policy. The `workerURL` option is also useful for custom native modules and integration into an existing worker infrastructure.

### Instance methods

| Method | Returns | Behavior |
| --- | --- | --- |
| `loadScene(scene, options)` | Promise | Load a preset or JSON scene. Resolves once the scene has initialized. |
| `play()` | Simulation | Start the current simulation. |
| `pause()` | Simulation | Pause, preserving the scene state. |
| `step()` | Simulation | Advance one frame if paused. |
| `reset(options)` | Promise | Recreate the current scene and reset time. |
| `update(patch)` | Simulation | Apply a live physics / playback update. |
| `addParticles(object)` | Promise | Add a material object to the current scene. |
| `addRigid(object)` | Promise | Add a rigid mesh, wheel, or blade. |
| `emitParticles(position, velocity, material, color)` | Simulation | Emit a small particle burst. |
| `setInteraction({ enabled, mode })` | Simulation | Set touch, orbit, or custom pointer behavior. |
| `setOptions(options)` | Simulation | Change particle size, color, grid and body visibility. |
| `setCamera(camera)` | Simulation | Set target, distance, yaw and pitch. |
| `getCamera()` | Object | Return a defensive copy of the camera. |
| `resetCamera()` | Simulation | Restore the current scene's default camera. |
| `snapshot()` | void | Render and download the current canvas as a PNG. |
| `getStats()` | Object or null | Defensive copy of the current metrics. |
| `on(event, callback)` | Function | Subscribe to events. The returned function removes that subscription. |
| `off(event, callback)` | void | Remove a specific subscription. |
| `dispose()` | void | Terminate the worker, disconnect rendering, release listeners and remove owned canvas elements. |

### Events

| Event | Payload |
| --- | --- |
| `ready` | `{ simd: boolean }`, describing the chosen WASM build. |
| `loaded` | Scene dimension, name, resolution, duration, level set and runtime defaults. |
| `state` | `{ running, finished }`. |
| `stats` | Solver metrics, particle count, memory, time, profiling data and simulation speed. |
| `frame` | Latest particle positions, packed colors, rigid-body geometry, block map and stats. |
| `controls` | Applied runtime control values. |
| `log` | Solver log line and severity: `info`, `warn`, or `error`. |
| `error` | Error or descriptive message. |
| `interact` | World-space position and original client pointer coordinates. |
| `pointerdown` / `pointerup` | Pointer interaction events. |

Particle data uses a four-float stride: `[x, y, z, packedColorAsFloat]`. The final float must be interpreted as a **32-bit packed color**, not as a finite physical coordinate. This matters when validating or inspecting raw frames. Data arrays are transferred to the main thread; do not retain or mutate a renderer-owned frame array.

## 7. JavaScript architecture and conversion notes

- `engine.js` is the JavaScript WASI host, config marshaller, and Python-like high-level solver wrappers.
- `scenes.js` contains the original ten scripted scene definitions, converted to JavaScript. Procedural geometry is retained where original external meshes were not included.
- `scene-builder.js` adds validation and a public JSON-based scene vocabulary.
- `worker.js` owns the WASM instance, serializes load/control requests, and advances the solver in bounded worker-side time slices.
- `client.js` exposes the event-driven library and handles the renderer, Blob worker URL, pointer controls, and cleanup.
- `renderer.js` is the WebGL2 2D/3D renderer, including the point, line, rigid mesh and level-set paths.
- `worker-source.js` is a generated, self-contained copy of the worker; it is not handwritten source.
- `src/Playground.jsx`, `src/components/`, and `src/main.jsx` are JavaScript/JSX website components.
- The C++ `native/` implementation is unchanged except for JavaScript-aware comments and build output paths. It is native source, not converted TypeScript.

The original `tsconfig.json` and TypeScript Vite config are unnecessary in the JavaScript kit. The distribution uses a `.mjs` Vite configuration and JavaScript/JSX entry points. The hosted playground's compatibility `App.tsx` entry point is **not** included in the JavaScript kit: its implementation lives in `src/Playground.jsx` and the kit imports `src/App.jsx` directly.

## 8. Build and test

The standalone library and the website are independent:

```sh
npm install
node scripts/build-library.mjs
npm run dev
npm run build
```

`node scripts/build-library.mjs` generates `src/lib/worker-source.js` and `public/taichi-mpm.js`. `npm run build` produces the application in `dist/` and copies the public assets there. The generated Vite application is a single self-contained HTML page, with the standalone library and documentation available alongside it.

Native engine checks:

```sh
node scripts/test-worker.mjs
```

Browser regression checks (with the dev server running):

```sh
npx playwright install chromium
npx playwright install-deps chromium
TEST_URL=http://127.0.0.1:5173 node scripts/test-browser.mjs
```

The test suite covers every original preset, finite particle positions, JSON scene creation, native gravity updates, playback pause/step, the scene editor, catalog search/favorites, mobile navigation, and the independent script-tag library.

To regenerate the WASM binaries, the original native build instructions and WASI SDK requirements are retained in `native/README.md`. Rebuilding native binaries is not needed to use either the library or the scene editor.

## 9. Browser requirements and performance

- A recent browser with WebGL2, WebAssembly and Web Worker support.
- HTTP or HTTPS hosting rather than a `file://` URL.
- `blob:` workers are the default. Configure `workerURL` if the site's CSP disallows blob workers.
- The solver selects the SIMD128 module when `WebAssembly.validate` supports it, and otherwise falls back to the scalar module.
- The original solver targets multi-core native execution. This port is single-threaded and uses a Web Worker to keep the main UI responsive.
- Use **low** for 3D previews and start 2D scenes around 128–200 grid cells. High-resolution scenes, especially 3D, need substantially more memory and CPU.
- Pause simulations that are hidden or off-screen. Call `dispose()` on component/page unmount to free workers and GPU resources.
- A high particle count is useful for scientific visualization but not for every website. Keep a sensible sampling density and avoid unbounded emitters if the scene is left running unattended.
- GPU availability, SwiftShader/CPU rendering, and the browser's power policy affect measured FPS. Frame rate and simulation speed are separate metrics.

## 10. Credits and upstream source

The solver and ten original scenes are derived from the supplied cc-fusion/vibecoding archive and the original [yuanming-hu / taichi_mpm](https://github.com/yuanming-hu/taichi_mpm) project.

The native implementation preserves the solver pipeline: MLS-MPM, APIC/RPIC, CPIC rigid transfer, snow, jelly, sand, water, von Mises and elastic models, rigid-body contact, level sets, textures, meshes and articulations. The supplied README describes the original Taichi/MPM implementation and the WASI reactor conversion in detail.

Keep upstream copyright and license notices with redistributed native source and WebAssembly binaries. No upstream solver code has been replaced by a mock simulation. The original native C++ has been retained rather than rewritten as a JavaScript approximation.

Source archive: [cc-fusion/vibecoding](https://github.com/cc-fusion/vibecoding/tree/main/battle/claude-opus-5.5-max). Original solver: [yuanming-hu/taichi_mpm](https://github.com/yuanming-hu/taichi_mpm).
