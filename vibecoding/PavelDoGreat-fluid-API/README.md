# FluidSimulation API Documentation

**Version:** 1.0.0  
**Source:** [`api-v1.0.0.js`](https://cdn.jsdelivr.net/gh/cc-fusion/vibecoding@main/vibecoding/PavelDoGreat-fluid-API/api-v1.0.0.js)  
**Implementation:** Browser JavaScript + WebGL

## Table of contents

- [Overview](#overview)
- [Requirements and setup](#requirements-and-setup)
- [Quick start](#quick-start)
- [Core concepts](#core-concepts)
- [Configuration](#configuration)
- [API reference](#api-reference)
  - [Creation and static properties](#creation-and-static-properties)
  - [Lifecycle and rendering](#lifecycle-and-rendering)
  - [Configuration methods](#configuration-methods)
  - [Fluid interaction](#fluid-interaction)
  - [Field and state I/O](#field-and-state-io)
  - [Custom fields](#custom-fields)
  - [Custom shaders and GPU passes](#custom-shaders-and-gpu-passes)
  - [Simulation pipeline](#simulation-pipeline)
  - [Events](#events)
  - [Extensions](#extensions)
- [Built-in extensions](#built-in-extensions)
- [Examples](#examples)
- [Performance guidance](#performance-guidance)
- [Troubleshooting](#troubleshooting)
- [Implementation notes](#implementation-notes)

## Overview

`FluidSimulation` is a small, GPU-accelerated 2D fluid simulation intended for browser experiences such as interactive backgrounds, cursor-driven fluid effects, visual experiments, and custom WebGL effects.

The script exposes two globals:

- **`FluidSimulation`** — the simulation engine and its static helpers.
- **`FluidExtensions`** — a collection of optional plug-ins that add pointer input, automatic splashes, buoyancy, an obstacle, and a sampling probe.

It is not an HTTP or REST API. You use it from JavaScript in a page with a `<canvas>` element. The main simulation work is implemented as fragment-shader passes over GPU textures.

## Requirements and setup

- A browser with WebGL support.
- A canvas with a non-zero CSS width and height.
- Half-float texture support. In the WebGL 1 fallback, the implementation requires `OES_texture_half_float`; linear filtering support may vary by device.
- The script loaded before code that references `FluidSimulation` or `FluidExtensions`.

### Load the script from jsDelivr

```html
<script src="https://cdn.jsdelivr.net/gh/cc-fusion/vibecoding@main/vibecoding/PavelDoGreat-fluid-API/api-v1.0.0.js"></script>
```

For applications that need reproducible builds, vendor the file or pin a specific repository commit rather than relying on a moving `@main` reference.

## Quick start

This complete example creates a full-window canvas, enables pointer interaction, starts the animation loop, and cleans up when the page is unloaded.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Fluid Simulation</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; }
    canvas { display: block; width: 100%; height: 100%; }
  </style>
</head>
<body>
  <canvas id="fluid"></canvas>

  <script src="https://cdn.jsdelivr.net/gh/cc-fusion/vibecoding@main/vibecoding/PavelDoGreat-fluid-API/api-v1.0.0.js"></script>
  <script>
    const sim = FluidSimulation.create('#fluid', {
      BACK_COLOR: '#07111f',
      SHADING: true,
      COLORFUL: true
    });

    sim.use(FluidExtensions.pointer());
    sim.start();

    // Optional: add occasional fluid bursts.
    // sim.use(FluidExtensions.autoSplats({ interval: 2, count: 2 }));

    window.addEventListener('pagehide', () => sim.destroy(), { once: true });
  </script>
</body>
</html>
```

The engine sets the canvas drawing-buffer size from its CSS size and the device pixel ratio, capped by `MAX_PIXEL_RATIO`. Give the canvas explicit CSS dimensions; setting only its HTML `width` and `height` attributes is not a substitute for sizing it in the layout.

## Core concepts

### Coordinate systems

The high-level API (`splat`, `sample`, and the callback form of `writeField`) uses normalized coordinates:

- `x` and `y` are normally in the range `0` to `1`.
- `(0, 0)` is the **top-left** corner.
- `y` increases **downward**, matching DOM pointer coordinates.
- For `splat`, positive `dy` means motion downward.

Raw field buffers use the GPU texture layout instead:

- Each texel contains four float channels in RGBA order.
- A `Float32Array` passed to or returned by field I/O uses rows in **bottom-to-top** order.
- The raw velocity field's Y component follows the simulation's GPU convention and points upward. `splat()` handles the conversion from the public coordinate convention.

Do not mix normalized top-left API coordinates with raw buffer row order.

### Fields

The engine creates five named fields by default:

| Field | Purpose | Default resolution | Display mode |
|---|---|---|---|
| `velocity` | Fluid velocity vectors | Simulation grid | Vector |
| `dye` | Visible color carried by the fluid | Dye grid | Color |
| `pressure` | Pressure used to project velocity | Simulation grid | Scalar |
| `divergence` | Divergence of the velocity field | Simulation grid | Scalar |
| `curl` | Local rotation / vorticity measure | Simulation grid | Scalar |

Access field objects through `sim.fields`, for example `sim.fields.dye`. They are GPU-backed objects, not ordinary JavaScript arrays.

### Simulation pipeline

Each step runs enabled stages in order. The default sequence is:

1. `curl`
2. `vorticity`
3. `divergence`
4. `clearPressure`
5. `pressure`
6. `gradientSubtract`
7. `advectVelocity`
8. `advectDye`

Extensions and custom code can insert additional stages before or after a named stage.

## Configuration

Pass configuration values to `FluidSimulation.create(canvas, config)` or `new FluidSimulation(canvas, config)`. Unspecified values use the defaults below.

| Option | Default | Description |
|---|---:|---|
| `SIM_RESOLUTION` | `128` | Base size of the velocity/pressure simulation grid. Lower values are faster; higher values preserve more detail. |
| `DYE_RESOLUTION` | `1024` | Base size of the dye/color grid. Higher values produce sharper color but use more GPU memory and work. |
| `DENSITY_DISSIPATION` | `1.0` | Controls how quickly dye fades as it advects. |
| `VELOCITY_DISSIPATION` | `0.2` | Controls how quickly velocity fades as it advects. |
| `PRESSURE` | `0.8` | Multiplier used when clearing pressure before solving; pressure retention/decay control. |
| `PRESSURE_ITERATIONS` | `20` | Number of pressure-solver iterations per step. More iterations cost more GPU time. |
| `CURL` | `30` | Strength of vorticity confinement; larger values generally create stronger swirls. |
| `SPLAT_RADIUS` | `0.25` | Default radius for injected splashes. Passed through an internal percentage-like conversion; use the same scale when overriding it. |
| `SPLAT_FORCE` | `6000` | Multiplier applied to pointer movement to generate velocity. Primarily used by the pointer extension. |
| `SHADING` | `true` | Enables the pseudo-3D lighting treatment for the dye display. |
| `COLORFUL` | `true` | Allows pointer interaction colors to cycle over time. |
| `PAUSED` | `false` | Skips simulation steps while continuing the animation loop and rendering. `update` hooks still run. |
| `BACK_COLOR` | `'#000000'` | Background color as a hex string. |
| `DISPLAY_FIELD` | `'dye'` | Field to display: `dye`, `velocity`, `pressure`, `curl`, `divergence`, or a registered custom field. |
| `FIELD_VIEW_SCALE` | `1` | Additional brightness/scale multiplier for vector and scalar diagnostic views. |
| `MAX_DT` | `1 / 60` | Maximum time step in seconds, used to cap large frame intervals. |
| `MAX_PIXEL_RATIO` | `2` | Upper bound for `window.devicePixelRatio` when sizing the canvas drawing buffer. |

### Updating configuration

Prefer `setConfig()` over modifying `sim.config` directly. `setConfig()` emits a `config` event, and changing either resolution option reinitializes field buffers.

```js
sim.setConfig({
  BACK_COLOR: '#101827',
  SHADING: false,
  DENSITY_DISSIPATION: 0.7
});

console.log(sim.getConfig());
```

`sim.config` is a live object, so direct assignments are possible, but direct edits do not emit the `config` event. Directly changing `SIM_RESOLUTION` or `DYE_RESOLUTION` also bypasses the resource-rebuild logic in `setConfig()`.

## API reference

### Creation and static properties

#### `FluidSimulation.create(canvas, config = {})`

Creates a simulation from either a canvas element or a CSS selector. Returns the new simulation instance.

```js
const sim = FluidSimulation.create('#fluid', { SIM_RESOLUTION: 96 });
```

Throws a `TypeError` if the argument does not resolve to a valid canvas. A missing WebGL context or unsupported required texture capability can also cause initialization to throw.

#### `new FluidSimulation(canvas, config = {})`

The class constructor accepts a canvas element and an optional configuration object. The `create()` helper is convenient when starting from a selector.

#### `FluidSimulation.version`

Static version string. The file sets this to `'1.0.0'`.

#### `FluidSimulation.defaults`

A frozen object containing a copy of the default configuration values.

#### `FluidSimulation.randomColor(intensity = 0.15)`

Returns an RGB array with a randomly chosen hue and the requested intensity. The generated channel values are floating-point values suitable for the simulation's dye shader.

```js
const color = FluidSimulation.randomColor();
sim.splat(0.5, 0.5, 0, 0, color);
```

### Lifecycle and rendering

#### `sim.start()`

Starts the `requestAnimationFrame` loop. Repeated calls while running do not start duplicate loops. Returns `sim` for chaining.

#### `sim.stop()`

Stops the animation loop. It does not destroy fields or GPU resources. Returns `sim`.

#### `sim.step(dt = sim.config.MAX_DT)`

Executes one simulation step using the supplied time delta in seconds. Runs `beforeStep`, every enabled pipeline stage, and `afterStep`; advances `sim.time`; and returns `sim`. It does not itself render the frame.

#### `sim.render()`

Renders the configured display field to the canvas, surrounded by `beforeRender` and `afterRender` events. If `DISPLAY_FIELD` does not refer to a registered field, rendering falls back to `dye`. Returns `sim`.

#### `sim.destroy()`

Stops the loop, removes installed extensions (calling their `destroy` hooks), and disposes the registered fields and built-in programs. Custom programs created by your own code are not tracked in `sim.programs`; delete those with `sim.deleteProgram(program)` during your own cleanup. Call `destroy()` when the simulation is no longer needed, and do not keep using the instance afterward.

#### `sim.aspectRatio`

Read-only getter returning `canvas.width / canvas.height` using the drawing-buffer dimensions.

#### Runtime counters

`sim.time`, `sim.frame`, and `sim.dt` expose the simulation's accumulated time, frame count, and most recently calculated time step. `sim.canvas`, `sim.gl`, and `sim.capabilities` also expose the canvas, WebGL context, and detected context capabilities for advanced use.

### Configuration methods

#### `sim.setConfig(patch)`

Merges a partial configuration object into the current settings. Recreates field buffers if `SIM_RESOLUTION` or `DYE_RESOLUTION` is present in the patch, emits `config` with the patch, and returns `sim`.

#### `sim.getConfig()`

Returns a shallow copy of the current configuration object.

### Fluid interaction

#### `sim.splat(x, y, dx, dy, color, options = {})`

Injects both velocity and dye into the fluid at a point.

| Argument | Meaning |
|---|---|
| `x`, `y` | Normalized position, top-left origin. |
| `dx`, `dy` | Velocity impulse; positive `dy` points down in the public API. |
| `color` | RGB array `[r, g, b]` or object `{ r, g, b }`. If omitted, a random color is generated. Floating-point RGB values in the `0`–`1` range are a sensible starting point. |
| `options.radius` | Optional override for `SPLAT_RADIUS`, using the same scale as that setting. |

Returns `sim` and emits a `splat` event with `{ x, y, dx, dy, color }`.

```js
// A blue splash moving right and slightly upward.
sim.splat(0.45, 0.55, 700, -180, [0.1, 0.35, 1.0], { radius: 0.3 });
```

The default color is `FluidSimulation.randomColor()`. The shader adds the selected color to the dye field and injects the corresponding impulse into the velocity field.

#### `sim.randomSplats(count = 5)`

Adds a specified number of randomly positioned and colored splashes with randomized velocity. Returns `sim`.

```js
sim.randomSplats(3);
```

#### `sim.clear(name)`

Clears one field when `name` is supplied, or all registered fields when called without an argument. Returns `sim`.

```js
sim.clear('dye'); // Clear color only.
sim.clear();      // Clear every field.
```

Clearing the fields does not change configuration values or remove custom field registrations.

### Field and state I/O

#### `sim.readField(name)`

Reads an entire GPU field to the CPU. Returns an object with this shape, or `null` if float readback fails:

```js
{
  width: 128,
  height: 128,
  data: Float32Array // width * height * 4 values, RGBA
}
```

The actual dimensions depend on the selected field and canvas aspect ratio. Readback can be relatively expensive because it transfers data from the GPU to JavaScript.

#### `sim.sample(name, x, y)`

Reads one texel at normalized top-left coordinates. Returns `[r, g, b, a]`, or `null` if the read fails. Coordinates outside the field are clamped to the nearest edge texel.

```js
const dyeAtCenter = sim.sample('dye', 0.5, 0.5);
```

#### `sim.writeField(name, source, width, height)`

Uploads data into a field. `source` can be either:

1. An array-like RGBA buffer. A `Float32Array` is used directly; other array-like values are converted to one. Raw buffer rows must be ordered bottom-to-top, and the buffer must contain exactly `width * height * 4` values.
2. A function `(u, v, px, py) => [r, g, b, a]`, called once for each texel. `u` and `v` are normalized API coordinates with a top-left origin; `px` and `py` are integer pixel indices. Missing RGB components default to zero and a missing alpha defaults to one.

`width` and `height` are optional source dimensions. If omitted, each defaults to the target field's corresponding dimension. When source dimensions differ from the field, the implementation resamples through a GPU copy pass. Returns `sim`.

```js
// Fill dye with a smooth coordinate-based color pattern.
sim.writeField('dye', (u, v) => [u, 0.25, 1 - v, 1]);
```

#### `sim.getState(names = ['velocity', 'dye'])`

Returns a snapshot object keyed by field name. Each value is the result of `readField()`. By default, it snapshots the two persistent fields most useful for a visual save/restore: velocity and dye.

```js
const snapshot = sim.getState();
```

The snapshot is CPU-side data and may consume significant memory at high resolutions.

#### `sim.setState(state)`

Restores fields from a snapshot-like object. For each entry, if the field exists and the supplied value is truthy, its `data`, `width`, and `height` are passed to `writeField()`. Unknown fields and empty entries are skipped. Returns `sim`.

```js
sim.setState(snapshot);
```

### Custom fields

#### `sim.addField(name, options = {})`

Registers and creates an additional GPU field, which will also be recreated during field initialization/resizing. Returns the field object.

Options:

| Option | Default | Description |
|---|---|---|
| `double` | `false` | Whether the field uses ping-pong read/write targets. Useful when a pass reads and writes the same field. |
| `resolution` | `'sim'` | `'sim'`, `'dye'`, or an object such as `{ width: 256, height: 128 }`. |
| `linear` | `true` | Requests linear texture filtering where supported. |
| `view` | `{ mode: 'scalar', scale: 1 }` | How to render the field when selected as `DISPLAY_FIELD`. Modes are `color`, `vector`, and `scalar`. |

```js
sim.addField('temperature', {
  resolution: 'sim',
  double: false,
  linear: true,
  view: { mode: 'scalar', scale: 1 }
});

sim.setConfig({ DISPLAY_FIELD: 'temperature' });
```

Registering a field only allocates it; it does not automatically add update logic to the simulation pipeline. Add a stage or extension to populate it. If a field must be sampled from and written to by the same pass, understand the ping-pong behavior before selecting `double`.

#### `sim.removeField(name)`

Unregisters a custom field and disposes its GPU resource. Returns `sim`. Do not remove one of the built-in fields if the standard pipeline or display still depends on it.

The field registry is available via `sim.fields`; field specifications are held in `sim.fieldSpecs` for advanced use.

### Custom shaders and GPU passes

These methods are intended for developers comfortable with WebGL and GLSL.

#### `sim.createProgram(fragmentSource, defines = [])`

Compiles a custom fragment shader and links it with the engine's shared full-screen vertex shader. The engine automatically prepends a fragment header containing:

- `varying vec2 vUv` — current normalized coordinate.
- `varying vec2 vL`, `vR`, `vT`, `vB` — neighboring coordinates.
- `uniform vec2 texelSize` — target texel size.
- High-precision float and sampler declarations.

The result is a program wrapper containing the WebGL program and a lookup of active uniforms. The `defines` argument is a list of preprocessor define names used by the compiler helper. Shader compilation and program-link failures throw errors containing the WebGL diagnostic.

```js
const invert = sim.createProgram(`
  uniform sampler2D uTexture;
  void main() {
    vec4 c = texture2D(uTexture, vUv);
    gl_FragColor = vec4(1.0 - c.rgb, c.a);
  }
`);
```

#### `sim.runPass(program, uniforms = {}, target = null, options = {})`

Draws one full-screen shader pass. `program` may be a wrapper returned by `createProgram()` or the name of a built-in program in `sim.programs`. `target` may be a field name, field/FBO object, or `null` to draw to the screen.

- Uniform values may be numbers, booleans, vectors/arrays, or GPU field/target objects used as textures.
- Texture-like targets are automatically bound to sampler uniforms.
- `texelSize` is supplied automatically based on the target unless overridden in `uniforms`.
- `{ blend: true }` enables standard source-alpha blending for the pass.
- Double-buffered targets are written to and swapped automatically.

```js
sim.runPass(invert, {
  uTexture: sim.fields.dye
}, sim.fields.dye);
```

The example illustrates the call shape; an in-place transformation should use a ping-pong/double-buffered field so the shader does not sample from the same texture it is writing to.

#### `sim.deleteProgram(program)`

Deletes a program wrapper's underlying WebGL program. Use this to release custom programs when finished with them. Custom shader resources should be cleaned up by the extension or component that created them.

`sim.programs` contains the built-in shader program wrappers. This is an advanced-use surface; relying on internal shader names or implementation details can make custom code more sensitive to future changes.

### Simulation pipeline

#### `sim.pipeline`

An ordered array of stage objects. Each stage has a `name`, a `run(sim, dt)` function, an `enabled` flag, and a `builtin` flag. Most users should modify the pipeline through the methods below rather than editing the array directly.

#### `sim.addStage(name, run, options = {})`

Adds a stage whose callback is `run(sim, dt)`. The optional placement object accepts `{ before: 'stageName' }` or `{ after: 'stageName' }`. With no usable reference, the stage is appended. If a stage with the same name already exists, it is removed before the replacement is inserted. Emits `pipeline` and returns `sim`.

```js
sim.addStage('myForce', (s, dt) => {
  // Update a field or invoke a shader pass here.
}, { before: 'curl' });
```

#### `sim.removeStage(name)`

Removes the first matching stage and emits `pipeline` when a stage was removed. Returns `sim`.

#### `sim.setStageEnabled(name, enabled)`

Enables or disables a named stage. A disabled stage is skipped when `step()` runs. If the name exists, the method emits `pipeline`; the method returns `sim` either way.

### Events

Register listeners with `on()`. Every listener is called with the simulation instance as its first argument, followed by event-specific arguments.

| Event | When it fires | Arguments after `sim` |
|---|---|---|
| `update` | Every animation frame, before stepping/rendering | `dt` |
| `beforeStep` | Immediately before pipeline stages execute | `dt` |
| `afterStep` | After all enabled stages finish | `dt` |
| `beforeRender` | Before drawing the display field | none |
| `afterRender` | After drawing the display field | none |
| `splat` | After `splat()` injects velocity and dye | one object: `{ x, y, dx, dy, color }` |
| `resize` | When the engine changes the drawing-buffer size and reinitializes fields | none |
| `config` | After `setConfig()` | the patch object |
| `pipeline` | After relevant stage-list or enablement changes | none |
| `extensions` | After extension installation/removal | none |

#### `sim.on(event, callback)`

Adds a listener and returns an unsubscribe function.

```js
const unsubscribe = sim.on('splat', (s, info) => {
  console.log('Splash at', info.x, info.y);
});

// Later:
unsubscribe();
```

#### `sim.off(event, callback)`

Removes the specified callback from an event. Returns `sim`.

#### `sim.emit(event, ...args)`

Dispatches an event to installed extensions first, then to registered listeners. This is mainly useful for advanced integration and extension development.

**Pause detail:** `PAUSED: true` prevents `step()` from being called by the animation loop, but `update`, rendering, and `afterRender` still occur. An extension should check `sim.config.PAUSED` in its `update` method if it must also pause its own time-based behavior.

### Extensions

#### Extension contract

An extension is a named object installed with `sim.use(extension)`. It may implement lifecycle hooks and methods whose names match simulation events.

```js
const meter = {
  name: 'meter',
  init(sim) {
    this.unsubscribe = sim.on('afterStep', (s, dt) => {
      // Observe completed simulation steps.
    });
  },
  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  },
  update(sim, dt) {
    // Called through the update event each animation frame.
  }
};

sim.use(meter);
```

- `name` is required and should be unique.
- `init(sim)` is called immediately when installed.
- `destroy(sim)` is called before removal and during `sim.destroy()`.
- An extension may implement event methods such as `update(sim, dt)`, `beforeStep(sim, dt)`, `afterRender(sim)`, or `splat(sim, payload)`.
- Installing an extension with a name already in use removes the old one first.

#### `sim.use(extension)`

Installs the extension, calls its `init` hook if present, emits `extensions`, and returns `sim`. Throws if the object or its `name` is missing.

#### `sim.remove(name)`

Removes an installed extension by name, calling its `destroy` hook when present. Returns `sim`.

#### `sim.getExtension(name)`

Returns the installed extension object for the name, or `undefined` if none is installed.

## Built-in extensions

The library exports the following extension factories on `FluidExtensions`. Each factory returns an extension object; pass that object to `sim.use()`.

### `FluidExtensions.pointer()`

Adds mouse, pen, and touch pointer interaction by tracking pointer movement over the canvas and converting movement into `splat()` calls. This extension is optional; omit or remove it for simulations driven only by code.

```js
sim.use(FluidExtensions.pointer());
```

### `FluidExtensions.autoSplats({ interval = 1.5, count = 2 } = {})`

Adds randomized splashes periodically. `interval` is in seconds and `count` is the number of splashes produced on each interval.

```js
sim.use(FluidExtensions.autoSplats({ interval: 3, count: 1 }));
```

This extension explicitly checks `PAUSED`, so it does not create new random splashes while paused.

### `FluidExtensions.buoyancy({ strength = 800 } = {})`

Adds a custom shader stage before the `curl` stage. The stage applies an upward velocity contribution based on average dye brightness. Larger `strength` values increase the force.

```js
const buoyancy = FluidExtensions.buoyancy({ strength: 500 });
sim.use(buoyancy);
```

### `FluidExtensions.obstacle({ x = 0.5, y = 0.5, radius = 0.08 } = {})`

Adds a circular mask and a translucent white overlay. The starting center is given in normalized coordinates; the returned extension exposes `center` as a mutable `[x, y]` array and `radius` as a mutable number.

```js
const obstacle = FluidExtensions.obstacle({ x: 0.5, y: 0.5, radius: 0.1 });
sim.use(obstacle);

// Move the visual/mask center.
obstacle.center = [0.35, 0.55];
obstacle.radius = 0.12;
```

This is implemented as a mask stage on the velocity and dye fields plus a render overlay. It should not be mistaken for a full rigid-body or physically exact boundary solver.

### `FluidExtensions.probe()`

Tracks the pointer position and samples the `velocity` and `dye` fields after each render. The installed extension exposes `x`, `y`, `velocity`, and `dye` properties.

```js
const probe = FluidExtensions.probe();
sim.use(probe);

// Inspect values sampled beneath the pointer.
console.log(probe.velocity, probe.dye);
```

Sampling uses GPU readback for each field on each rendered frame, so this is best treated as a debugging/inspection extension rather than a free operation for performance-critical production paths.

## Examples

### Programmatically create a splash

```js
sim.splat(0.5, 0.5, 900, 250, [0.15, 0.55, 1.0]);
```

### Add a temporary event listener

```js
const stopListening = sim.on('afterStep', (s, dt) => {
  // e.g. update a UI value based on s.time
});

// Remove it when no longer needed.
stopListening();
```

### Show a diagnostic field

```js
sim.setConfig({
  DISPLAY_FIELD: 'velocity',
  FIELD_VIEW_SCALE: 2
});
```

Return to the normal color rendering with:

```js
sim.setConfig({ DISPLAY_FIELD: 'dye', FIELD_VIEW_SCALE: 1 });
```

### Save and restore the visible fluid state

```js
const saved = sim.getState();

// Later, after modifying the simulation:
sim.setState(saved);
```

This stores the velocity and dye fields by default. Include more fields with `sim.getState(['velocity', 'dye', 'pressure'])` if your use case needs them.

## Performance guidance

- **Start with resolution settings.** Lower `SIM_RESOLUTION` and `DYE_RESOLUTION` first when performance is poor. The dye grid is often the more expensive texture because its default resolution is much higher.
- **Reduce pressure iterations** if you need a faster simulation and can accept less accurate pressure projection.
- **Keep the pixel ratio capped.** `MAX_PIXEL_RATIO` limits how many physical pixels are rendered for high-DPI displays.
- **Avoid unnecessary CPU readbacks.** `readField()`, `sample()`, and especially repeated per-frame sampling can stall or slow the GPU/CPU pipeline.
- **Use events instead of replacing the main loop.** The built-in event and extension mechanisms are designed to hook into updates, steps, and rendering.
- **Clean up resources.** Call `destroy()` when the simulation is permanently removed. Extensions that allocate custom shaders or attach DOM event listeners should release them in `destroy()`.
- **Be careful with in-place shader passes.** Read/write feedback on the same texture can be invalid or undefined. Use a double-buffered field or another ping-pong target when a pass must read previous values and write new ones.

## Troubleshooting

### The page reports that WebGL is unsupported

The constructor throws if it cannot obtain a WebGL context. Try a browser/device with WebGL enabled and up-to-date graphics drivers. In WebGL 1, this implementation also requires half-float texture support.

### The canvas is blank or appears tiny

Check that the canvas has non-zero CSS width and height and is visible in the layout. The engine computes its drawing-buffer size from `clientWidth` and `clientHeight`.

### Pointer input does not affect the fluid

Install the pointer extension explicitly:

```js
sim.use(FluidExtensions.pointer());
```

Also check that another transparent element is not preventing pointer events from reaching the canvas.

### The display shows a diagnostic field instead of color

Check `DISPLAY_FIELD`. Set it to `'dye'` to show the normal color field.

### Reading a field returns `null`

`readField()` and `sample()` may fail on devices where float readback is unsupported or fails at the WebGL level. Treat `null` as a supported failure result rather than assuming every GPU supports readback.

### Configuration changes do not appear to take effect

Use `sim.setConfig({ ... })` rather than changing the live `sim.config` object directly. For resolution changes, `setConfig()` is important because it reinitializes field buffers.

### The effect slows down after adding diagnostics

The `probe` extension samples velocity and dye every frame. Remove it when inspection is finished, and avoid repeatedly calling `readField()` in the render/update loop unless necessary.

## Implementation notes

- The script is an immediately invoked browser script and attaches `FluidSimulation` and `FluidExtensions` to `window`.
- The public API and examples in this guide are based on version `1.0.0` of the linked file. This guide describes behavior implemented by that file, not a guarantee of compatibility with future versions.
- Properties such as `fields`, `pipeline`, `programs`, `fieldSpecs`, `gl`, and `capabilities` are exposed for practical advanced use, but they reveal implementation details. If upgrading the source, review code that depends on those objects.
- The source is based on the approach of [PavelDoGreat/WebGL-Fluid-Simulation](https://github.com/PavelDoGreat/WebGL-Fluid-Simulation) and identifies that project as MIT-licensed in its header. Review the actual source repository and license notice before redistributing a modified bundle.

---

*Documentation generated from the source file linked at the top of this document.*
