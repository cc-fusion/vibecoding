## Table of Contents

1. [1-Minute Cheat-Sheet (Copy-Paste Recipes)](#1-1-minute-cheat-sheet-copy-paste-recipes)
2. [All Module Exports at a Glance](#2-all-module-exports-at-a-glance)
3. [Architecture, Hosting & Coordinate System](#3-architecture-hosting--coordinate-system)
4. [Initialization & Top-Level Functions](#4-initialization--top-level-functions)
5. [`Simulation` Class API Reference](#5-simulation-class-api-reference)
6. [Events & Real-Time Interaction](#6-events--real-time-interaction)
7. [Declarative JSON Scene Schema](#7-declarative-json-scene-schema)
8. [Materials & Constitutive Models](#8-materials--constitutive-models)
9. [JavaScript Scene Modules & Inline Scenes](#9-javascript-scene-modules--inline-scenes)
10. [Low-Level Solver, Meshes, Textures & Articulations](#10-low-level-solver-meshes-textures--articulations)
11. [`Renderer` Class & Visual Options](#11-renderer-class--visual-options)
12. [Frame Statistics (`stats`) Reference](#12-frame-statistics-stats-reference)
13. [Performance Tuning, Limitations & Troubleshooting](#13-performance-tuning-limitations--troubleshooting)

---

## 1. 1-Minute Cheat-Sheet (Copy-Paste Recipes)

### A. Minimal Quick Start (HTML + ES Module)

> **Note:** Serve over `http://` or `https://`. WebAssembly and module Web Workers will not load from `file://` URLs.

```html
<div id="simulation" style="width: 100%; height: 520px;"></div>

<script type="module">
  import * as TaichiMPM from './taichi-mpm.mjs';

  const sim = await TaichiMPM.create({
    container: '#simulation', // CSS selector or HTMLElement (or pass `canvas`)
    scene: 'cutting',         // Built-in preset ID, registered ID, or JSON scene object
    quality: 'medium',        // 'low' | 'medium' | 'high'
    autoPlay: true,           // Start simulation immediately after scene load
    renderOptions: {
      grid: true,
      showRigids: true,
      showBlocks: false,
      pointScale: 1
    }
  });

  sim.on('stats', (stats) => {
    console.log(`t=${stats.t.toFixed(2)}s | particles=${stats.particles}`);
  });
  sim.on('error', console.error);
</script>
```

### B. Common Playback & Runtime Controls

```js
// Playback lifecycle
sim.play();                                  // Start continuous simulation
sim.pause();                                 // Pause simulation
sim.step();                                  // Advance exactly one frame (frameDt)
await sim.reset({ autoPlay: false });        // Reload current scene
sim.snapshot();                              // Download current canvas as PNG
sim.dispose();                               // Terminate worker & free WebGL resources

// Live parameter updates
sim.setGravity(-9.81);                       // Or [0, -9.81] / [0, -9.81, 0]
sim.update({
  gravity: -4.0,                             // Vertical gravity component or vector
  speed: 1.5,                                // Simulation time multiplier
  wheelSpeed: 120,                           // Scripted wheel angular speed (deg/s)
  automaticWheel: true,                      // Enable/disable scripted wheel rotation
  gravityEnabled: true
});

// Visual & rendering updates
sim.setOptions({
  colorMode: 1,                              // 0: Material, 1: Velocity, 2: CPIC, 3: Model, 4: Plastic
  grid: false,
  showRigids: true,
  showBlocks: true,
  pointScale: 1.25
});
```

### C. Spawn Objects Live at Runtime

```js
// 1. Spawn a block or sphere of particles
await sim.addParticles({
  material: 'jelly',                         // 'water' | 'jelly' | 'snow' | 'sand' | 'von_mises' | 'elastic'
  shape: 'sphere',                           // 'sphere' | 'rect' | 'box' | 'cylinder' | 'polygon'
  center: [0.5, 0.8],                        // [x, y] in 2D or [x, y, z] in 3D (normalized 0..1)
  radius: 0.06,
  velocity: [0, -0.5],
  density: 4,                                // Sampling density (particles per cell)
  color: '#e68ccf'
});

// 2. Quick particle burst injection
await sim.emitParticles(
  [0.5, 0.75],                               // World position [x, y] (or [x, y, z])
  [0.4, 0.8],                                // Launch velocity vector
  'water',                                   // Material name
  '#57b8f5'                                  // Optional hex or [r, g, b] color
);

// 3. Spawn a spinning rigid wheel
await sim.addWheel({
  center: [0.65, 0.3],
  radius: 0.12,
  blades: 8,
  color: '#e9b870',
  motion: { enabled: true, speed: 90 }
});

// 4. Spawn a continuous particle emitter
await sim.addEmitter({
  material: 'water',
  shape: 'sphere',
  center: [0.5, 0.9],
  radius: 0.025,
  velocity: [0, -1.2],
  duration: 5,                               // Emit for 5 seconds of simulation time
  density: 2
});
```

### D. Load a Declarative JSON Scene

```js
const myScene = {
  id: 'water-wheel-demo',
  name: 'Water Wheel Demo',
  dim: 2,
  resolution: 160,                           // Grid resolution (32..384)
  duration: 0,                               // 0 = run indefinitely
  frameDt: 0.01,
  gravity: [0, -9.81],
  boundaries: { floor: true, walls: true, friction: 0.35 },
  objects: [
    {
      id: 'water-drop',
      type: 'particles',
      material: 'water',
      shape: 'sphere',
      center: [0.35, 0.72],
      radius: 0.10,
      density: 4,
      color: '#57b8f5'
    },
    {
      id: 'paddle-wheel',
      type: 'rigid',
      shape: 'wheel',
      center: [0.65, 0.30],
      radius: 0.14,
      blades: 8,
      color: '#e9b870',
      motion: { enabled: true, speed: 90 }
    },
    {
      id: 'nozzle',
      type: 'emitter',
      material: 'water',
      shape: 'rect',
      center: [0.5, 0.9],
      size: [0.08, 0.025],
      velocity: [0, -1.4],
      duration: 5,
      density: 2
    }
  ]
};

await sim.loadScene(myScene, { autoPlay: true, quality: 'medium' });
```

### E. Load a Programmable JavaScript Scene Module

```js
// File: ./scenes/pulse-scene.js
export const metadata = {
  id: 'pulse-scene',
  name: 'Periodic Pulse Scene',
  dim: 2,
  duration: 0,
  frameDt: 0.01
};

export function setup(ctx) {
  const mpm = ctx.createMPM({ resolution: 160, gravity: [0, -9.81] });

  const bounds = mpm.create_levelset();
  bounds
    .add_plane([0, 1], -0.06)
    .add_plane([1, 0], -0.06)
    .add_plane([-1, 0], 0.94)
    .set_friction(0.4);
  mpm.set_levelset(bounds);

  const waterField = ctx.tex.sphere([0.5, 0.7, 0.5], 0.1).mul(4);
  mpm.add_particles({
    type: 'water',
    density: 1000,
    density_tex: waterField,
    color: [0.34, 0.72, 0.96]
  });

  return {
    mpm,
    update(t, dt, api) {
      // Runs inside the worker prior to each frame step
      if (t > 1.0 && t < 1.0 + dt) {
        api.addParticles({
          material: 'jelly',
          shape: 'sphere',
          center: [0.5, 0.85],
          radius: 0.04
        });
      }
    }
  };
}

export function onMessage(name, payload, api) {
  if (name === 'pointerdown' && payload.position) {
    api.emitParticles(payload.position, [0, 0.5], 'water', '#57b8f5');
  }
}
```

```js
// In host application:
await sim.loadSceneModule('./scenes/pulse-scene.js', { autoPlay: true });
```

---

## 2. All Module Exports at a Glance

`taichi-mpm.mjs` re-exports everything from `./src/lib/index.js`:

| Export Name | Kind | Source Module | Description |
| :--- | :--- | :--- | :--- |
| **`create`** | `async function` | `client.js` | Creates a `Simulation` instance and waits until it is initialized (`ready`). |
| **`Simulation`** | `class` | `client.js` | Main high-level controller managing worker/fallback execution, scenes, and rendering. |
| **`registerScene`** | `function` | `client.js` | Validates and registers a custom JSON scene in the client registry by `scene.id`. |
| **`unregisterScene`** | `function` | `client.js` | Removes a previously registered scene by `id`. Returns `boolean`. |
| **`getRegisteredScenes`**| `function` | `client.js` | Returns deep-cloned array of all scenes registered via `registerScene()`. |
| **`starterScene`** | `object` | `client.js` | Deep clone of `DEFAULT_SCENE` for quick scene editing/bootstrapping. |
| **`COLOR_MODES`** | `string[]` | `client.js` | Labels for the 5 particle coloring modes (`0` through `4`). |
| **`version`** | `string` | `client.js` | Library version string (`'1.1.0'`). |
| **`DEFAULT_SCENE`** | `object` | `scene-builder.js` | Default 2D JSON starter scene (`id: 'my-first-scene'`). |
| **`validateScene`** | `function` | `scene-builder.js` | Validates a declarative JSON scene object; throws a descriptive `Error` if invalid, or returns `true`. |
| **`MATERIALS`** | `string[]` | `scene-builder.js` | Supported material identifiers: `['water', 'jelly', 'snow', 'sand', 'von_mises', 'elastic']`. |
| **`PALETTE`** | `object` | `scene-builder.js` | Default hex color map keyed by material name. |
| **`getScenes`** | `function` | `scene-builder.js` | Returns metadata list of available preset scenes (plus default starter scene). |
| **`addObject`** | `function` | `scene-builder.js` | Low-level helper that adds a JSON object spec (`particles`, `rigid`, `emitter`) to an `MPM` instance. |
| **`buildScene`** | `function` | `scene-builder.js` | Compiles a declarative JSON scene definition into an active `MPM` solver instance on an `MPMEngine`. |
| **`sceneDefToJSON`** | `function` | `scene-builder.js` | Normalizes/serializes a scene definition to formatted JSON. |
| **`makeTextureFactory`** | `function` | `scene-builder.js` | Creates a `TextureFactory` helper bound to `(engine, dim)`. |
| **`SCENES`** | `object[]` | `scenes.js` | Array of built-in programmable preset scenes (e.g., `'cutting'`, `'sand-wheel'`, etc.). |
| **`Renderer`** | `class` | `renderer.js` | Standalone WebGL2 particle, rigid mesh, level-set, and grid block renderer. |
| **`default`** | `object` | `global.js` | Default export namespace containing the client API. |

> **Low-Level Engine Classes (`./src/lib/global.js` & `./src/lib/engine.js`):**  
> `MPMEngine`, `MPM`, `TextureFactory`, `Texture`, `SegmentMesh`, `TriangleMesh`, and `LevelSet` are also provided directly to JavaScript scenes via the `setup(ctx)` context (and exported from `./src/lib/global.js` and `./src/lib/engine.js`).

---

## 3. Architecture, Hosting & Coordinate System

### Execution Pipeline

```text
Application UI (Browser Main Thread)
  │
  ▼
Simulation Client (client.js)  ◄──►  Pointer / Keyboard / Custom Events
  │
  ├──► Dedicated Web Worker (worker.js)      [Preferred: 24ms * speed slice]
  │
  └──► MainThreadWorker (Fallback Adapter)   [Fallback:  7ms * speed slice]
             │
             ▼
     JS Engine Host (engine.js)
             │
             ▼
     WebAssembly Solver (SIMD128 or Scalar WASM)
             │
             ▼ (Zero-copy Transferable ArrayBuffers)
     WebGL2 Renderer (renderer.js)
```

1. **Worker-First Execution:** `new Simulation()` attempts to spawn `./worker.js` as an ES module Web Worker (`new Worker(url, { type: 'module' })`).
2. **Automatic Main-Thread Fallback:** If `Worker` construction fails, or if the worker errors or times out (`12,000 ms`) before emitting `ready`, `Simulation` automatically switches to `MainThreadWorker`, sets `sim.executionMode = 'main-thread'`, and emits a `fallback` event.
3. **SIMD Detection:** `MPMEngine` validates `MPM_WASM_SIMD_BASE64` via `WebAssembly.validate()`. If supported, it runs the SIMD128 binary (`ready` event has `simd: true`); otherwise, it transparently falls back to the scalar WASM binary (`simd: false`).
4. **Backpressure (`ack`):** The worker sends `frame` buffers as transferable `ArrayBuffer`s and waits for the main thread to reply with `{ type: 'ack' }` before posting the next completed frame, preventing message queue flooding.

### Coordinate System & Units

- **Simulation Domain:** Normalized unit box `[0, 1] × [0, 1]` in **2D** and `[0, 1] × [0, 1] × [0, 1]` in **3D**.
- **Axes Convention:**
  - `x`: Horizontal (`0.0` = left wall, `1.0` = right wall)
  - `y`: Vertical (`0.0` = floor, `1.0` = ceiling; **+Y is UP**)
  - `z`: Depth in 3D (`0.0` = back, `1.0` = front)
- **Default Boundaries:** Placed slightly inside `[0, 1]` (typically offset by `0.06` from domain edges, i.e., `0.06` to `0.94`) as required by MLS-MPM B-spline kernels near grid borders.
- **Rotations:**
  - **2D:** Scalar angle in **degrees** (e.g., `90`, or `(t) => 200 * t`).
  - **3D:** 3-component Euler angle vector `[rx, ry, rz]` in **degrees**.
- **Colors:**
  - **High-level JSON / Client API:** Accepts 6-digit hex strings (e.g., `'#57b8f5'`) or normalized RGB arrays `[r, g, b]` in `0..1`.
  - **Low-level `mpm.add_particles` API:** Expects normalized float RGB array `[r, g, b]` in `0..1` (use `hexColor('#57b8f5')` or float arrays).

---

## 4. Initialization & Top-Level Functions

### `create(options)`

```js
const sim = await TaichiMPM.create(options);
```

Creates a `new Simulation(options)` and returns a `Promise<Simulation>` that resolves once the engine and initial scene are ready (or rejects if initialization fails).

### `new Simulation(options)`

Synchronously constructs the `Simulation` instance, creates/attaches the `<canvas>`, initializes the WebGL2 `Renderer`, and starts the worker (which loads `options.scene` automatically once `ready` fires).

#### Constructor / `create()` Options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `container` | `string \| HTMLElement` | `undefined` | DOM element or CSS selector into which a `<canvas class="taichi-canvas">` will be created and appended. Required if `canvas` is not provided. |
| `canvas` | `HTMLCanvasElement` | `undefined` | Existing `<canvas>` element to render into. Required if `container` is not provided. |
| `scene` | `string \| object` | `'cutting'` | Initial scene preset ID (e.g., `'cutting'`, `'sand-wheel'`), registered scene ID, or declarative JSON scene object. |
| `quality` | `'low' \| 'medium' \| 'high'` | `'medium'` | Resolution and timestep preset for built-in scenes and default resolution scaling. |
| `autoPlay` | `boolean` | `false` | If `true`, starts stepping immediately after the initial scene finishes loading. |
| `workerURL` | `string \| URL` | `./worker.js` | Custom URL for the solver module worker script. |
| `camera` | `object` | `undefined` | Optional 3D camera override `{ target: [x,y,z], distance, yaw, pitch }`. |
| `renderOptions`| `object` | `{ showRigids: true, showBlocks: false, pointScale: 1, grid: true }` | Initial options passed to `sim.renderer.options`. |
| `onReady` | `(info) => void` | `undefined` | Shorthand listener for the `'ready'` event (`{ type: 'ready', simd: boolean }`). |
| `onStats` | `(stats) => void` | `undefined` | Shorthand listener for the `'stats'` event (fires every rendered frame). |
| `onError` | `(error) => void` | `undefined` | Shorthand listener for the `'error'` event. |
| `onState` | `(state) => void` | `undefined` | Shorthand listener for the `'state'` event (`{ type: 'state', running, finished }`). |
| `onFrame` | `(frame) => void` | `undefined` | Shorthand listener for the `'frame'` event (`{ particles, count, rigids, blocks, stats, partial }`). |

### Scene Registry & Helper Functions

```js
// Register a reusable custom JSON scene in memory
const cloned = TaichiMPM.registerScene({
  id: 'custom-drop',
  name: 'Custom Drop',
  dim: 2,
  objects: [
    { type: 'particles', material: 'water', shape: 'sphere', center: [0.5, 0.7], radius: 0.1 }
  ]
});
// Now loadable by string ID:
await sim.loadScene('custom-drop', { autoPlay: true });

// Inspect or remove registered scenes
const list = TaichiMPM.getRegisteredScenes(); // Array of cloned scene definitions
TaichiMPM.unregisterScene('custom-drop');     // Returns true if removed

// Validate a JSON scene definition before loading
TaichiMPM.validateScene(mySceneJson);         // Returns true or throws Error

// List all built-in scenes + starter scene metadata
const allPresets = TaichiMPM.getScenes();
```

---

## 5. `Simulation` Class API Reference

### Instance Properties

| Property | Type | Description |
| :--- | :--- | :--- |
| `sim.canvas` | `HTMLCanvasElement` | The WebGL2 canvas element used for rendering and pointer/keyboard capture. |
| `sim.container` | `HTMLElement \| null` | The container element passed to constructor (if any). |
| `sim.renderer` | `Renderer` | The underlying `Renderer` instance (`sim.renderer.camera`, `sim.renderer.options`, etc.). |
| `sim.running` | `boolean` | Whether continuous simulation playback is currently active. |
| `sim.ready` | `boolean` | Whether the WASM engine has finished initializing. |
| `sim.disposed` | `boolean` | Whether `sim.dispose()` has been called. |
| `sim.executionMode`| `'worker' \| 'main-thread'` | Indicates whether physics runs in a dedicated Web Worker or the main-thread fallback. |
| `sim.scene` | `string \| object` | Currently active scene ID or scene definition object. |
| `sim.quality` | `'low' \| 'medium' \| 'high'` | Current quality setting. |
| `sim.stats` | `object \| null` | Most recent frame statistics object (same as `sim.getStats()`). |
| `sim.info` | `object \| null` | Metadata about the currently loaded scene (`dim`, `name`, `sceneId`, `custom`, `camera`, `decor`, etc.). |

### Playback & Lifecycle Methods

| Method | Signature | Returns | Description |
| :--- | :--- | :--- | :--- |
| **`play`** | `sim.play()` | `Promise<any>` | Starts continuous simulation stepping. |
| **`pause`** | `sim.pause()` | `Promise<any>` | Pauses continuous simulation stepping. |
| **`step`** | `sim.step()` | `Promise<any>` | Advances the simulation by exactly one frame (`frameDt`) and pauses. |
| **`reset`** | `sim.reset(options = {})` | `Promise<any>` | Reloads the current scene from `t = 0`. Accepts `{ autoPlay, quality, colorMode, showBlocks }`. |
| **`snapshot`** | `sim.snapshot()` | `void` | Triggers a browser PNG download of the current WebGL2 canvas buffer. |
| **`dispose`** | `sim.dispose()` | `void` | Terminates the worker/fallback runtime, disconnects observers/listeners, and disposes WebGL buffers. |

### Scene Loading Methods

#### `sim.loadScene(scene, options = {})`
Loads a built-in preset ID (e.g., `'cutting'`), a registered scene ID, or a declarative JSON scene object.
- **Parameters:**
  - `scene`: `string | object` — Scene ID or JSON scene definition (validated automatically via `validateScene`).
  - `options`: `{ autoPlay?: boolean, quality?: 'low' | 'medium' | 'high', colorMode?: number, showBlocks?: boolean }`
- **Returns:** `Promise<object>` resolving when the scene is loaded and its initial frame is exported.

#### `sim.loadSceneModule(url, options = {})`
Imports an ES module inside the simulation worker (or fallback runtime) using dynamic `import(url)`.
- **Parameters:**
  - `url`: `string | URL` — URL or data URL of a trusted ES module exporting `metadata` and `setup(ctx)`.
  - `options`: `{ autoPlay?: boolean, quality?: 'low' | 'medium' | 'high', metadata?: object }`
- **Returns:** `Promise<object>`

#### `sim.loadInlineScene(source, metadata = {}, options = {})`
Loads trusted JavaScript module source text by wrapping it in a `Blob` (`type: 'text/javascript'`) and importing its object URL inside the runtime (never uses `eval()`).
- **Parameters:**
  - `source`: `string` — ES module source code exporting `setup(ctx)` (and optionally `metadata` and `onMessage`).
  - `metadata`: `object` — Optional fallback metadata merged if the inline code does not export `metadata`.
  - `options`: `{ autoPlay?: boolean, quality?: 'low' | 'medium' | 'high' }`
- **Returns:** `Promise<object>`

### Runtime Object Spawning & Physics Mutation

| Method | Signature | Description |
| :--- | :--- | :--- |
| **`addParticles`** | `sim.addParticles(config)` | Adds a new particle group (`type: 'particles'`) to the live simulation. See [Object Schemas](#particles-object-type-particles) for `config` fields. |
| **`addRigid`** | `sim.addRigid(config)` | Adds a rigid body (`type: 'rigid'`) to the live simulation. |
| **`addWheel`** | `sim.addWheel(config)` | Convenience wrapper for `addRigid({ shape: 'wheel', ...config })`. |
| **`addEmitter`** | `sim.addEmitter(config)` | Adds a time-based particle emitter (`type: 'emitter'`) to the live simulation. |
| **`emitParticles`**| `sim.emitParticles(position, velocity, material = 'water', color)` | Injects a small sphere (`radius: 0.025`, `density: 3`) of particles at `position` (`[x, y]` or `[x, y, z]`) with `velocity`. |
| **`update`** | `sim.update(patch)` | Updates live runtime controls. Supported keys in `patch`: `gravity` (`number \| number[]`), `gravityEnabled` (`boolean`), `speed` (`number`), `wheelSpeed` (`number`), `automaticWheel` (`boolean`), `frameDt` (`number`), `continuous` (`boolean`), `touch` (`boolean`). |
| **`setGravity`** | `sim.setGravity(value)` | Shorthand for `sim.update({ gravity: value })`. `value` can be a vertical scalar (e.g., `-9.81`) or a full vector (`[0, -9.81]` / `[0, -9.81, 0]`). |
| **`generalAction`**| `sim.generalAction(config)` | Invokes a low-level solver `mpm_general_action` command directly (e.g., `{ action: 'set_config', gravity: [0, -6] }` or `{ action: 'delete_particles', ... }`). |
| **`send`** | `sim.send(name, payload)` | Sends a custom structured-cloneable message to the active JS scene module's exported `onMessage(name, payload, api)` handler inside the worker. Returns a `Promise` with the handler's return value. |
| **`setOptions`** | `sim.setOptions(options)` | Updates renderer and worker visualization settings: `{ grid?: boolean, showRigids?: boolean, showBlocks?: boolean, pointScale?: number, colorMode?: number }`. |
| **`setInteraction`**| `sim.setInteraction(options)` | Configures canvas pointer/keyboard handling: `{ enabled?: boolean, mode?: 'touch' \| 'orbit' \| 'custom', forwardToScene?: boolean, material?: string }`. |
| **`getStats`** | `sim.getStats()` | Returns the latest `stats` object (or `null` if no frame has arrived yet). |

---

## 6. Events & Real-Time Interaction

Register listeners with `sim.on(event, callback)`. It returns an `unsubscribe()` function. You can also remove listeners via `sim.off(event, callback)`.

```js
const offStats = sim.on('stats', (stats) => { /* ... */ });
offStats(); // Unsubscribe when done
```

### Event Reference Table

| Event Name | Payload Structure | When It Fires |
| :--- | :--- | :--- |
| **`ready`** | `{ type: 'ready', simd: boolean }` | Once when the WASM solver binary is compiled and initialized (`simd: true` if SIMD128 is active). |
| **`loaded`** | `info` (`{ sceneId, name, dim, custom, duration, frameDt, camera, decor, ... }`) | Whenever a scene finishes setting up and its initial frame is ready. |
| **`state`** | `{ type: 'state', running: boolean, finished: boolean }` | When simulation starts, pauses, finishes a finite `duration`, or halts on error. |
| **`stats`** | `stats` (see [Section 12](#12-frame-statistics-stats-reference)) | Every exported simulation frame. |
| **`frame`** | `{ type: 'frame', particles: Uint8Array/Float32Array, count: number, rigids: Float32Array, blocks: Float32Array \| null, stats: object, partial: boolean }` | Every exported frame (includes raw render buffers and `stats`). |
| **`controls`** | `controls` (`{ gravity, speed, wheelSpeed, automaticWheel, touch, gravityEnabled, frameDt }`) | When worker control states are synchronized. |
| **`log`** | `{ type: 'log', line: string, level: 'info' \| 'warn' \| 'error' }` | When the WASM solver or runtime emits a diagnostic message over WASI stdout/stderr. |
| **`fallback`** | `{ mode: 'main-thread', reason: string, warning: string }` | If Web Worker startup fails or times out and execution switches to the main thread. |
| **`error`** | `Error` | On scene validation errors, worker errors, or WASM traps. |
| **`pointerdown`** | `{ position: number[], x: number, y: number, button: number, buttons: number, originalEvent?: PointerEvent }` | When pointer is pressed on the simulation canvas (`position` is projected world coordinates `[x, y]` or `[x, y, z]`). |
| **`pointermove`** | `{ position: number[], x: number, y: number, buttons: number, dragging: boolean }` | When pointer moves across the canvas. |
| **`pointerup`** | `{ position: number[], x: number, y: number, button: number }` | When pointer is released. |
| **`pointercancel`**| `{ position: number[], x: number, y: number }` | When pointer capture is canceled. |
| **`interact`** | `{ position: number[], velocity: number[], phase: 'start' \| 'move' \| 'end' }` | When pointer interaction occurs in `'touch'` or `'custom'` mode. |
| **`keydown`** | `{ key: string, code: string, shiftKey: boolean, ctrlKey: boolean, altKey: boolean, metaKey: boolean, originalEvent: KeyboardEvent }` | When the canvas has focus and a key is pressed. |
| **`keyup`** | `{ key: string, code: string, originalEvent: KeyboardEvent }` | When the canvas has focus and a key is released. |

### Interaction Modes (`sim.setInteraction(options)`)

| Mode | Behavior |
| :--- | :--- |
| **`'touch'`** *(Default in 2D)* | Clicking/dragging in the viewport automatically emits particles of `sim.options.material` (default `'water'`) at the pointer's projected world coordinates and fires `interact`. |
| **`'orbit'`** | Dragging rotates the 3D camera (`yaw` / `pitch`), scrolling zooms (`distance`), and double-clicking resets the camera to default. Does not inject particles on drag. |
| **`'custom'`** | Disables automatic particle injection so your app can handle `interact`, `pointerdown`, `pointermove`, `keydown`, etc. directly, or forward them to the worker scene with `forwardToScene: true`. |

#### Forwarding Input Directly to Worker Scenes (`forwardToScene: true`)

```js
sim.setInteraction({
  enabled: true,
  mode: 'custom',
  forwardToScene: true
});
```

When `forwardToScene: true` is set, `pointerdown`, `pointermove`, `pointerup`, `pointercancel`, `interact`, `keydown`, and `keyup` payloads (stripped of non-cloneable DOM references) are automatically sent to the active JavaScript scene's exported `onMessage(name, payload, api)` function inside the worker.

---

## 7. Declarative JSON Scene Schema

Declarative scenes are plain JSON objects validated by `validateScene(scene)` and compiled by `buildScene(engine, scene, quality)`.

### Top-Level Scene Fields

| Field | Type | Required | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `string` | For `registerScene` | `'custom'` | Unique identifier for the scene. |
| `name` | `string` | No | `'Custom scene'` | Human-readable scene title. |
| `description` | `string` | No | `''` | Description text. |
| `dim` | `2 \| 3` | **Yes** | — | Spatial dimension (`2` for 2D, `3` for 3D). |
| `resolution` | `number` | No | `160` (2D) / `64`–`128` (3D) | Solver grid resolution per axis. **Must be between `32` and `384`.** |
| `duration` | `number` | No | `0` | Simulation duration in seconds (`0` = infinite/continuous). |
| `frameDt` | `number` | No | `0.01` | Simulation time advanced per visual frame (in seconds). |
| `gravity` | `number[]` | No | `[0, -9.81]` (2D) / `[0, -9.81, 0]` (3D) | Gravity vector of length `dim`. |
| `boundaries` | `object` | No | `{ floor: true, walls: true, friction: 0.4 }` | Box boundary configuration (`floor: boolean`, `walls: boolean`, `ceiling?: boolean`, `friction?: number`). |
| `levelset` | `object` | No | `undefined` | Custom static collider signed-distance-field geometry (see below). |
| `camera` | `object` | No | `{ target: [0.5,0.35,0.5], distance: 1.4, yaw: 30, pitch: 22 }` | Initial 3D camera parameters. |
| `objects` | `object[]` | No | `[]` | Array of `particles`, `rigid`, and `emitter` definitions. |

---

### `objects[]` Item Schemas

Every entry in `scene.objects` must have `type` set to `'particles'`, `'rigid'`, or `'emitter'`.

#### 1. Particles Object (`type: 'particles'`)

> **Important Distinction:**
> - `density` in a JSON object controls **particles sampled per grid cell** (PPC, default `4`).
> - `massDensity` controls physical material mass density ($\text{kg/m}^3$, e.g. `1000` for water).

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `'particles'` | **Required** | Identifies a deformable continuum body / fluid volume. |
| `material` | `string` | **Required** | One of `'water'`, `'jelly'`, `'snow'`, `'sand'`, `'von_mises'`, `'elastic'`. |
| `shape` | `string` | `'rect'` (2D) / `'box'` (3D) | `'rect'`, `'box'`, `'sphere'`, `'circle'`, `'cylinder'`, or `'polygon'` (2D). |
| `center` | `number[]` | `[0.5, 0.5]` / `[0.5, 0.5, 0.5]` | Center coordinates (`length === dim`). |
| `size` | `number[]` | `[0.16, 0.16]` | Full width/height (and depth in 3D) for `'rect'` / `'box'`. |
| `radius` | `number` | `0.1` | Radius for `'sphere'` / `'circle'` / `'cylinder'` (must be `> 0`). |
| `height` | `number` | `0.2` | Height for `'cylinder'`. |
| `points` | `number[][]` | — | Array of `[x, y]` vertices for `shape: 'polygon'` (minimum 3 points). |
| `velocity` | `number[]` | `[0, 0]` / `[0, 0, 0]` | Initial linear velocity vector (`length === dim`). |
| `density` | `number` | `4` | Sampling density (particles per grid cell). |
| `massDensity` | `number` | Material default | Physical mass density override ($\text{kg/m}^3$). |
| `color` | `string \| number[]` | `PALETTE[material]` | Hex string (`'#57b8f5'`) or `[r, g, b]` in `0..1`. |
| *Constitutive* | `number` | Material default | Optional material overrides: `E`, `nu`, `youngs_modulus`, `hardening`, `friction_angle`, `cohesion`, `yield_stress`, `bulk_modulus`. |

#### 2. Rigid Body Object (`type: 'rigid'`)

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `'rigid'` | **Required** | Identifies a rigid collider/coupled body. |
| `shape` | `string` | `'box'` | `'box'`, `'rect'`, `'blade'`, `'circle'`, `'sphere'`, or `'wheel'`. |
| `center` | `number[]` | `[0.5, 0.3]` | World-space center position (`length === dim`). |
| `size` | `number[]` | `[0.2, 0.03]` | Dimensions for `'box'`, `'rect'`, or `'blade'`. |
| `radius` | `number` | `0.12` | Outer radius for `'circle'`, `'sphere'`, or `'wheel'`. |
| `blades` | `number` | `8` | Number of radial blades when `shape: 'wheel'`. |
| `friction` | `number` | `0.2` | Surface Coulomb friction coefficient (negative values in Taichi MPM indicate sticky friction). |
| `codimensional`| `boolean` | `true` | Uses thin-shell codimensional CPIC representation. |
| `color` | `string \| number[]` | `'#e9b870'` | Display color. |
| `motion` | `object` | `undefined` | Scripted motion config: `{ enabled: boolean, speed: number, velocity?: number[] }` (`speed` in deg/sec). |

#### 3. Particle Emitter Object (`type: 'emitter'`)

| Property | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `type` | `'emitter'` | **Required** | Continuously injects particles over time during frame updates. |
| `material` | `string` | `'water'` | Material to emit (`'water'`, `'sand'`, `'snow'`, `'jelly'`, etc.). |
| `shape` | `string` | `'sphere'` | Source region shape (`'sphere'`, `'rect'`, `'box'`). |
| `center` | `number[]` | `[0.5, 0.85]` | Emitter world position (`length === dim`). |
| `radius` | `number` | `0.025` | Emitter radius (for `'sphere'`). |
| `size` | `number[]` | `[0.08, 0.025]` | Emitter dimensions (for `'rect'` / `'box'`). |
| `velocity` | `number[]` | `[0, -1]` | Initial velocity of emitted particles (`length === dim`). |
| `duration` | `number` | `4` | Active emission duration in seconds (or `startTime` / `endTime` if specified). |
| `density` | `number` | `2` | Sampling density per injection step. |
| `color` | `string \| number[]` | `PALETTE[material]` | Color of emitted particles. |

---

### Custom `levelset` Schema

Use `scene.levelset` to define custom analytic signed-distance boundaries (ramps, funnels, bowls, obstacles).

```js
levelset: {
  includeDefaultBoundaries: false, // Set true to keep default floor/walls in addition to custom shapes
  friction: 0.5,                   // Level-set boundary friction coefficient
  planes: [
    { normal: [0, 1], d: -0.04 }   // Half-space plane: dot(normal, x) + d = 0
  ],
  boxes: [
    { lower: [0.25, 0.2], upper: [0.75, 0.24], insideOut: false }
  ],
  spheres: [
    { center: [0.5, 0.48], radius: 0.12, insideOut: true } // insideOut: true = hollow spherical container
  ],
  cylinders: [
    { center: [0.5, 0.5], radius: 0.08, insideOut: false }
  ],
  polygons: [
    // Supported in 2D ONLY (dim === 2); requires >= 3 vertices
    { points: [[0.2, 0.1], [0.8, 0.1], [0.5, 0.35]], insideOut: false }
  ]
}
```

---

## 8. Materials & Constitutive Models

`MATERIALS` and `PALETTE` define the 6 built-in constitutive models:

| Material ID | Constitutive Model | Default Color (`PALETTE`) | Default Physical Density (`massDensity`) | Default Material Parameters |
| :--- | :--- | :---: | :---: | :--- |
| **`'water'`** | Weakly compressible fluid (EOS) | `#57b8f5` | `1000` | `bulk_modulus: 1e4`, `gamma: 7` (optional) |
| **`'jelly'`** | Corotated / Neo-Hookean hyperelasticity | `#e68ccf` | `400` | `E: 2e4` (Young's modulus), `nu: 0.3` (Poisson's ratio) |
| **`'snow'`** | Stomakhin et al. elasto-plasticity with hardening | `#e3edf9` | `400` | `youngs_modulus: 3e4`, `hardening: 10`, `critical_compression`, `critical_stretch` |
| **`'sand'`** | Drucker-Prager granular elasto-plasticity | `#efbc7e` | `1000` | `friction_angle: 35` (degrees), `cohesion: 0` |
| **`'von_mises'`** | Von Mises associative J2 metal/clay plasticity | `#91d6aa` | `600` | `youngs_modulus: 3e4`, `yield_stress: 150` |
| **`'elastic'`** | Hyperelastic solid | `#f5a17f` | `400` | `E: 3e4`, `nu: 0.3` |

---

## 9. JavaScript Scene Modules & Inline Scenes

For full programmatic control (custom meshes, articulations, procedural textures, per-frame logic, or worker-side input handling), write an ES module scene.

### Module Contract

A scene module exports:
1. **`metadata`** *(or `scene`)*: Object declaring `{ id, name, dim: 2 | 3, duration, frameDt, description, camera, decor }`. **`dim` (`2` or `3`) is required.**
2. **`setup(ctx)`**: Required function that initializes the `MPM` instance and returns `{ mpm, update?, frameUpdate?, decor?, camera? }`.
3. **`onMessage(name, payload, api)`** *(optional)*: Function invoked inside the worker when `sim.send(name, payload)` is called or when pointer/keyboard events are forwarded (`forwardToScene: true`).

### The `ctx` Argument Passed to `setup(ctx)`

| Property / Method | Type | Description |
| :--- | :--- | :--- |
| `ctx.engine` | `MPMEngine` | The low-level WASM engine wrapper instance. |
| `ctx.tex` | `TextureFactory` | Factory for creating spatial density textures (`ctx.tex.sphere(...)`, `ctx.tex.rect(...)`, etc.). |
| `ctx.quality` | `'low' \| 'medium' \| 'high'` | Current quality preset string. |
| `ctx.createMPM(options)`| `function` | Convenience helper that creates and returns a `new MPM(ctx.engine, dim, options)`. Accepts `{ resolution, res, gravity, base_delta_t, penalty, pushing_force }`. |
| `ctx.createLevelSet()` | `function` | Creates a `LevelSet` bound to the active solver. |
| `ctx.addObject(obj)` | `function` | Adds a declarative JSON-style object (`particles`, `rigid`, `emitter`) to the scene's `MPM` instance. |
| `ctx.addParticles(cfg)` | `function` | Adds particles using either JSON-style config or low-level `mpm.add_particles` config. |
| `ctx.MPM` | `class` | Low-level `MPM` class constructor. |
| `ctx.TextureFactory` | `class` | Low-level `TextureFactory` class constructor. |
| `ctx.SegmentMesh` | `class` | 2D segment mesh builder class. |
| `ctx.TriangleMesh` | `class` | 3D triangle mesh builder class. |
| `ctx.LevelSet` | `class` | Level-set signed-distance builder class. |

### The `api` Argument Passed to `update(t, dt, api)` and `onMessage(name, payload, api)`

Inside `update(t, dt, api)` (called once per simulation frame before substeps) and `onMessage(name, payload, api)`:

| Property / Method | Description |
| :--- | :--- |
| `api.engine` | Active `MPMEngine` instance. |
| `api.mpm` | Active `MPM` solver instance. |
| `api.controls` | Snapshot of current worker control values (`{ gravity, speed, wheelSpeed, frameDt, ... }`). |
| `api.addParticles(cfg)` | Spawns a particle object using the declarative JSON object schema. |
| `api.addRigid(cfg)` | Spawns a rigid body using the declarative JSON object schema. |
| `api.emitParticles(pos, vel, material, color)` | Emits a small sphere of particles at `pos` with `vel`. |
| `api.generalAction(cfg)`| Calls `engine.generalAction(cfg)` (e.g., `{ action: 'set_config', gravity: [0, -5] }`). |

### Inline JavaScript Scenes & Security Note

```js
await sim.loadInlineScene(`
  export const metadata = { id: 'inline-demo', name: 'Inline Demo', dim: 2 };
  export function setup(ctx) {
    const mpm = ctx.createMPM({ resolution: 128, gravity: [0, -9.81] });
    const ls = mpm.create_levelset();
    ls.add_plane([0, 1], -0.06).add_plane([1, 0], -0.06).add_plane([-1, 0], 0.94);
    mpm.set_levelset(ls);

    mpm.add_particles({
      type: 'water',
      density: 1000,
      density_tex: ctx.tex.sphere([0.5, 0.65, 0.5], 0.12).mul(4),
      color: [0.34, 0.72, 0.96]
    });
    return { mpm };
  }
`, {}, { autoPlay: true });
```

- **How it works:** The runtime creates a `Blob([source], { type: 'text/javascript' })`, generates a temporary `blob:` URL, imports it with standard ES `import()`, and immediately revokes the `blob:` URL. It **never** calls `eval()` or `new Function()`.
- **Security & CSP:** Inline modules and external scene modules execute with full worker/page privileges and are **not sandboxed**. Only execute trusted code. If your site uses a strict Content Security Policy (CSP), ensure `script-src` / `worker-src` permits `blob:`.

---

## 10. Low-Level Solver, Meshes, Textures & Articulations

When writing programmable scenes in `setup(ctx)` (matching the style of `src/lib/scenes.js` and the original Python `taichi_mpm` scripts), you can use the low-level classes directly.

### 1. `MPM` Class

```js
const r = 200;
const mpm = new ctx.MPM(ctx.engine, 2, {
  res: [r, r],                              // [rx, ry] in 2D or [rx, ry, rz] in 3D
  base_delta_t: 2e-4 * Math.min(1, 200 / r),// Base substep Δt
  gravity: [0, -9.81],                      // Gravity vector
  penalty: 1e4,                             // CPIC rigid penalty stiffness
  pushing_force: 0                          // Optional boundary pushing force
});
```

#### Key `MPM` Methods
- **`mpm.create_levelset()`**: Returns a new `LevelSet` instance.
- **`mpm.set_levelset(ls, build = true)`**: Uploads and binds the `LevelSet` to the solver.
- **`mpm.add_particles(cfg)`**: Adds continuum particles, rigid bodies, or PD sources. Returns the native object ID string (used when linking rigid bodies in `add_articulation`).
- **`mpm.add_articulation(cfg)`**: Links two rigid body IDs (`obj0`, `obj1`) with a constraint (`'rotation'`, `'distance'`, or `'motor'`).
- **`mpm.general_action(cfg)`**: Executes a general solver action (`set_config`, `delete_particles`, etc.).

### 2. `TextureFactory` (`ctx.tex`) & `Texture`

`mpm.add_particles({ ..., density_tex })` takes a `Texture` object whose value determines the number of particles per cell at each spatial location.

> **Coordinate Note:** Low-level `TextureFactory` primitives internally operate in 3D texture space `[x, y, z]` even in 2D scenes (where `z` defaults to `0.5`). Passing `[x, y]` in 2D is automatically padded to `[x, y, 0.5]`.

```js
// Basic shapes
const sphereTex = ctx.tex.sphere([0.5, 0.7, 0.5], 0.12);         // center, radius
const rectTex   = ctx.tex.rect([0.5, 0.5], [0.2, 0.15]);         // center, size
const cylTex    = ctx.tex.cylinder([0.5, 0.5, 0.5], 0.08, 0.25); // center, radius, height
const polyTex   = ctx.tex.polygon([[0.3, 0.3], [0.7, 0.3], [0.5, 0.6]]);

// Chaining multipliers & CSG operations on a Texture instance:
const ppc = 4; // 4 particles per cell
const finalTex = sphereTex.mul(ppc);
```

### 3. `LevelSet` Builder

```js
const ls = mpm.create_levelset();
ls.add_plane([0, 1], -0.06)                 // Normal [nx, ny], offset d
  .add_plane([1, 0], -0.06)
  .add_plane([-1, 0], 0.94)
  .add_sphere([0.5, 0.4], 0.1, false)       // center, radius, inside_out
  .add_box([0.2, 0.1], [0.8, 0.2], false)   // lower, upper, inside_out
  .add_cylinder([0.5, 0.5, 0.5], 0.08, false)
  .add_polygon([[0.2, 0.1], [0.8, 0.1], [0.5, 0.3]], false) // 2D only
  .set_friction(0.5);                       // Friction coefficient
mpm.set_levelset(ls);
```

### 4. Custom Rigid Body Meshes (`SegmentMesh` in 2D, `TriangleMesh` in 3D)

#### 2D Thin-Shell / Rigid Geometry (`SegmentMesh`)
```js
const mesh2d = new ctx.SegmentMesh();
mesh2d
  .add_segment([-0.12, 0.0], [0.12, 0.0])
  .add_segment([0.0, -0.12], [0.0, 0.12]);

const bodyId = mpm.add_particles({
  type: 'rigid',
  codimensional: true,                      // Zero-thickness CPIC shell
  density: 100,
  scale: [1, 1],
  friction: 0.1,                            // Negative value = sticky boundary
  angular_damping: 2.0,
  scripted_position: (t) => [0.5, 0.3],     // Function of time t (seconds)
  scripted_rotation: (t) => 180 * t,        // Degrees in 2D (or omit for free rotation)
  color: [0.95, 0.8, 0.4],
  segment_mesh: mesh2d
});
```

#### 3D Rigid Geometry (`TriangleMesh`)
```js
const triangles = [
  // Each triangle is [v0, v1, v2], where each vertex is [x, y, z] in local space
  [[0, -0.1, -0.1], [0, 0.1, -0.1], [0, 0.1, 0.1]],
  [[0, -0.1, -0.1], [0, 0.1, 0.1],  [0, -0.1, 0.1]]
];
const mesh3d = ctx.TriangleMesh.fromTriangles(triangles);

const rigid3d = mpm.add_particles({
  type: 'rigid',
  codimensional: true,
  scripted_position: () => [0.5, 0.35, 0.5],
  scripted_rotation: (t) => [0, 120 * t, 0], // [rx, ry, rz] in degrees
  friction: 0.2,
  color: [0.85, 0.88, 0.95],
  mesh: mesh3d                               // Or pass directly as `mesh` / `TriangleMesh`
});
```

### 5. Rigid Articulations (`mpm.add_articulation`)

Used to couple multiple rigid bodies together (e.g., hub + blades on a free-spinning water/sand wheel, or a pendulum/hammer):

| Articulation `type` | Parameters | Description |
| :--- | :--- | :--- |
| **`'rotation'`** | `{ type: 'rotation', obj0, obj1 }` | Locks `obj0` and `obj1` to share the same rotation angle. |
| **`'distance'`** | `{ type: 'distance', obj0, obj1, offset0?: number[], offset1?: number[], distance?: number, penalty?: number }` | Maintains a constant target distance between two world-space offsets relative to `obj0` and `obj1` centers of mass (`penalty` default `1e5`). |
| **`'motor'`** | `{ type: 'motor', obj0, obj1, axis: [x,y,z], power: number }` | Constrains `obj0` to rotate about `axis` on `obj1` and applies torque `power`. |

```js
// Example: Link wheel rim (`circleId`) and wheel paddles (`bladesId`)
mpm.add_articulation({
  type: 'rotation',
  obj0: circleId,
  obj1: bladesId
});
```

---

## 11. `Renderer` Class & Visual Options

While `Simulation` creates and manages a `Renderer` automatically (`sim.renderer`), `Renderer` is also exported for custom integrations.

### Particle Color Modes (`COLOR_MODES`)

Pass the index (`0`–`4`) to `sim.setOptions({ colorMode: index })` or `sim.loadScene(scene, { colorMode: index })`:

| Index | Label (`COLOR_MODES[i]`) | Visualizes |
| :---: | :--- | :--- |
| `0` | `'Material colour'` | Per-particle RGB color assigned at creation. |
| `1` | `'Velocity'` | Particle speed magnitude mapped to a color ramp. |
| `2` | `'CPIC side / affinity'` | Discontinuity side bits relative to thin-shell rigid cutters/boundaries. |
| `3` | `'Constitutive model'` | Distinct color per material constitutive law (`water`, `jelly`, `snow`, etc.). |
| `4` | `'Plastic state'` | Accumulated plastic deformation / yield state. |

### `renderOptions` (`sim.setOptions(options)`)

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `showRigids` | `boolean` | `true` | Render 2D rigid segments and 3D rigid triangle meshes. |
| `showBlocks` | `boolean` | `false` | Render active sparse MPM grid blocks (useful for debugging spatial hash occupancy). |
| `pointScale` | `number` | `1` | Multiplier for particle point radius in WebGL2. |
| `grid` | `boolean` | `true` | Render domain bounding box / background coordinate grid and level-set shading. |
| `colorMode` | `0 \| 1 \| 2 \| 3 \| 4` | `0` | Active particle coloring mode (see table above). |

### 3D Camera Control (`sim.renderer.camera`)

In 3D scenes (`dim === 3`), `sim.renderer.camera` holds:
```js
sim.renderer.camera = {
  target: [0.5, 0.35, 0.5], // Look-at target in normalized world space
  distance: 1.4,            // Camera distance from target
  yaw: 30,                  // Horizontal orbit angle in degrees
  pitch: 22                 // Vertical orbit angle in degrees (clamped to -5..85)
};
```

---

## 12. Frame Statistics (`stats`) Reference

Every `stats` event (and `sim.getStats()`) provides real-time telemetry from the WebAssembly solver:

| Field | Type | Description |
| :--- | :--- | :--- |
| `t` | `number` | Current simulation time in seconds. |
| `frame` | `number` | Completed visual frame counter. |
| `dt` | `number` | Current solver substep $\Delta t$ in seconds. |
| `substeps` | `number` | Cumulative solver substeps executed. |
| `particles` | `number` | Active continuum particle count. |
| `rigidParticles` | `number` | Active rigid boundary sample particle count. |
| `rigids` | `number` | Number of rigid bodies in the scene. |
| `blocks` | `number` | Active sparse grid blocks. |
| `fatBlocks` | `number` | Active fat grid blocks. |
| `rigidBlocks` | `number` | Grid blocks overlapping rigid bodies. |
| `totalBlocks` | `number` | Total allocated sparse blocks. |
| `blockSize` | `number` | Grid cells per sparse block axis (typically `4` or `8`). |
| `cutting` | `number` | Active CPIC cutting/compatible cells. |
| `nearBoundary` | `number` | Particles near domain boundaries. |
| `msPerSubstep` | `number` | Average wall-clock milliseconds per solver substep. |
| `substepsPerSec` | `number` | Solver substep throughput per wall-clock second. |
| `simSpeed` | `number` | Ratio of simulated time to wall-clock time (`1.0` = real-time). |
| `memoryMB` | `number` | Current WebAssembly linear memory footprint in megabytes. |
| `prof` | `number[]` | 11-element array of per-substep internal kernel profiling times (ms). |

---

## 13. Performance Tuning, Limitations & Troubleshooting

### Performance Tuning Checklist
1. **Grid Resolution (`resolution`):** Cost scales roughly as $O(R^2)$ in 2D and $O(R^3)$ in 3D, plus an additional factor because the CFL stability condition requires smaller `base_delta_t` at higher resolutions.
   - Recommended **2D** range: `128` – `256`
   - Recommended **3D** range: `48` – `96`
2. **Quality Presets (`quality: 'low' | 'medium' | 'high'`):** Use `'low'` on mobile devices or integrated GPUs, `'medium'` for standard desktop usage, and `'high'` for detailed captures.
3. **Particles Per Cell (`density`):** Default is `4` in 2D and `4`–`8` in 3D. Lowering `density` from `4` to `2` or `3` for emitters and large fluid volumes significantly reduces P2G/G2P transfer cost.
4. **Disable `showBlocks` When Not Debugging:** Exporting sparse block geometry every frame adds extra WASM-to-JS buffer transfers.

### Scope & Known Limitations
- **Read-Only Render Export:** Each frame exports packed particle `[x, y, z, rgba]` buffers for rendering and aggregate `stats`. It does not expose a general read/write per-particle deformation gradient ($\mathbf{F}$) or affine velocity ($\mathbf{C}$) buffer to JavaScript.
- **Polygon Level Sets Are 2D Only:** `levelset.polygons` is supported only when `scene.dim === 2`. Calling `validateScene` with `levelset.polygons` in a 3D scene throws an error.
- **Main-Thread Fallback Responsiveness:** When running in `executionMode === 'main-thread'`, the runtime caps its time slice to `7ms` per tick, but heavy 3D scenes can still cause UI frame drops compared to a dedicated Web Worker.
- **No Native C++ Source Included:** The distribution uses precompiled SIMD128 and scalar WebAssembly binaries embedded in `./src/lib/wasm/mpmWasm.js`.

### Troubleshooting Common Errors

| Symptom / Error Message | Cause | Fix |
| :--- | :--- | :--- |
| `Failed to fetch` / Worker fails on `file://` | Browsers block ES module workers and WASM imports on `file://` origins. | Serve the folder over HTTP(S) (e.g., `npm run dev`, `npx serve`, or `python3 -m http.server`). |
| `Provide container: an element or selector, or a canvas.` | `create()` / `new Simulation()` was called before the target DOM element existed or with a typo in the selector. | Ensure the container/canvas exists in the DOM before calling `TaichiMPM.create()`. |
| `WebGL2 is not available in this browser` | Browser/device has WebGL2 disabled or context creation failed. | Enable hardware acceleration or test in a WebGL2-capable browser. |
| `normal must contain 2 finite numbers` (or `3`) | Vector length in `gravity`, `center`, `size`, `velocity`, or `levelset` does not match `scene.dim`. | Ensure all vectors have length `2` in 2D scenes and length `3` in 3D scenes. |
| `Polygon level sets are supported only in 2D.` | `levelset.polygons` was used in a scene with `dim: 3`. | Use `planes`, `boxes`, `spheres`, or `cylinders` for 3D level sets, or provide a 3D `TriangleMesh` rigid body. |
| `resolution must be between 32 and 384.` | `scene.resolution` is outside the supported solver bounds. | Set `resolution` between `32` and `384` (e.g., `160` for 2D, `64` for 3D). |
| Inline scene fails under strict CSP | Content Security Policy blocks `blob:` module imports inside the worker. | Add `blob:` to `script-src` / `worker-src` in your CSP, or use `sim.loadSceneModule('./path/to/scene.js')` instead. |
| Particles explode or simulation resets (`WasmTrap`) | Substep `base_delta_t` is too large for the chosen grid resolution or stiffness (`E` / `youngs_modulus`). | Lower `E` / `youngs_modulus`, reduce initial `velocity`, or scale `base_delta_t` inversely with `resolution`. |
