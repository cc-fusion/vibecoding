# FluidSimulation — merged WebGL fluid API

**Version:** 2.0.0  
**Runtime:** browser JavaScript + WebGL  
**Dependencies:** none  
**Model:** real-time 2D, GPU-accelerated fluid/dye simulation, derived from Pavel Dobryakov's WebGL Fluid Simulation

This merged API consolidates the strongest parts of the five supplied implementations: reusable instances, WebGL capability detection and context recovery, observer-based resizing, page-visibility handling, named visual presets, quality presets, custom palettes, manual frame stepping, event subscriptions, scripted splats/strokes, configuration aliases, capture helpers, and explicit resource cleanup.

> **Scope:** this is a visual, real-time 2D fluid effect—not a general-purpose computational-fluid-dynamics solver. Shader behavior remains based on the upstream implementation. This package passed JavaScript syntax checks and Node-level API smoke checks; it has not been benchmarked across a browser/device matrix. Validate GPU behavior and frame rates on your target devices before production rollout.

## 1. Quick start

### Include as a script

```html
<canvas id="fluid" class="fluid-canvas"></canvas>
<script src="fluid-simulation-merged.js"></script>
<script>
  const fluid = FluidSimulation.create({
    canvas: '#fluid',
    preset: 'neon',
    quality: 'high',
    config: {
      bloomIntensity: 1.1,
      curl: 38,
      sunrays: true
    }
  });

  // Optional scripted burst; coordinates are normalized from bottom-left.
  fluid.splat(0.5, 0.5, 700, 300, '#36e4ff');

  // Tear down when the effect is no longer needed:
  // fluid.destroy();
</script>
```

```css
.fluid-canvas {
  display: block;
  width: 100%;
  height: 100%;
  touch-action: none;
}
```

The library accepts both uppercase upstream configuration names (`CURL`) and camelCase aliases (`curl`). String colors support hex (`#rgb`, `#rrggbb`) and `rgb(...)` / `rgba(...)`; RGB arrays are interpreted as 0–255 channels, while `{r,g,b}` objects may use 0–1 or 0–255 channels. `quality` is an initialization shortcut added by this merged wrapper: it applies a named quality preset before the optional `config` overrides. The code above is equivalent to calling `setQuality('high')` after creation, then applying the listed config values.

### Fill a container automatically

```html
<section id="hero" class="hero-fluid">
  <div class="hero-copy">Move your pointer to stir the color.</div>
</section>
<script src="fluid-simulation-merged.js"></script>
<script>
  const fluid = FluidSimulation.create({
    container: '#hero',
    preset: 'ocean',
    autoStart: true,
    input: true
  });
</script>
```

```css
.hero-fluid {
  position: relative;
  min-height: 420px;
  overflow: hidden;
}
.hero-fluid > .fluid-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.hero-copy {
  position: relative;
  z-index: 1;
  pointer-events: none;
}
```

When `container` is supplied, the API appends and owns a canvas that fills the container. A container with `position: static` is made `position: relative` so the canvas can fill it. If you supply an existing `<canvas>`, the API does not own it and will not remove it during `destroy()`.

### Auto-create a full-viewport background

```js
const backgroundFluid = FluidSimulation.create({
  preset: 'calm',
  input: false,
  initialSplats: 8,
  maxPixelRatio: 1.5
});
```

Without `canvas` or `container`, the API appends a full-viewport canvas styled behind page content with pointer events disabled. Use an explicit canvas/container when you need interactive input.

## 2. Creation methods

### `FluidSimulation.create(options)`

Creates and returns an instance. It throws a `FluidSimulationError` when initialization fails.

### `FluidSimulation.attach(target, options)`

Convenience form for an existing target:

```js
const fluid = FluidSimulation.attach('#my-canvas', { preset: 'smoke' });
```

`target` may be a canvas element, selector, or container element.

### `FluidSimulation.createIfSupported(options)`

Progressive-enhancement helper. Returns an instance when WebGL initialization succeeds; otherwise returns `null`. If an `onError` callback is provided, it is called with the error.

```js
const fluid = FluidSimulation.createIfSupported({
  canvas: '#my-canvas',
  onError(error) { console.warn('Fluid effect unavailable:', error.code); }
});
if (!fluid) document.documentElement.classList.add('no-webgl-fluid');
```

### `FluidSimulation.isSupported()`

Performs a WebGL/float-texture capability check. It returns a boolean and does not create a persistent simulation instance. A positive result is a capability check, not a guarantee that every shader or GPU configuration will succeed.

### `FluidSimulation.autoInit(options)`

Creates instances for elements matching `[data-fluid]` by default. Attributes can specify the preset and JSON configuration:

```html
<div data-fluid data-fluid-preset="ocean"
     data-fluid-config='{"CURL":32,"BLOOM":true}'></div>
<script>
  const instances = FluidSimulation.autoInit({ input: true });
</script>
```

Options passed to `autoInit()` are shared defaults. An element's `data-fluid` JSON and `data-fluid-config` JSON override them. `data-fluid-preset` overrides the chosen preset. Invalid JSON produces a warning; it does not stop other elements from initializing. Calling `autoInit()` twice skips elements already initialized by this library.

### `FluidSimulation.destroyAll()`

Destroys all still-registered instances and returns the number destroyed.

## Creation options

Options passed to `create()`, `attach()`, or `autoInit()`:

| Option | Default | Behavior |
|---|---|---|
| `canvas` | `null` | Existing canvas element or selector. If omitted, a full-viewport background canvas is created. |
| `container` | `null` | Element/selector that receives a newly created filling canvas. |
| `config` | `null` | Initial partial simulation config; applied after the visual and quality presets. |
| `preset` | `null` | Named visual preset. |
| `quality` | `null` | Named quality preset or a quality object; applied after `preset` and before `config`. |
| `autoStart` | `true` | Start animation immediately unless `autoUpdate` is false. |
| `autoUpdate` | `true` | If false, do not automatically start the loop; call `frame(dt)` manually. An explicit `start()` still starts the loop. |
| `autoResize` | `true` | Observe canvas and window size changes; set false for fully manual resizing. |
| `pixelRatio` | `null` | Force a pixel ratio; null uses the browser's device pixel ratio. |
| `maxPixelRatio` | `2` | Maximum effective pixel ratio; set `null` to remove the cap. |
| `palette` | `null` | Top-level shortcut for the `PALETTE` config property; overrides a palette from the preset/config. |
| `initialSplats` | `'random'` | `0` disables the initial burst, a number selects the burst count, and `'random'` chooses a random count. |
| `autoDegrade` | `true` | Adapt settings when required float-texture filtering is unavailable. |
| `mobileQuality` | `true` | Caps dye resolution on mobile devices where detected. |
| `input` | `true` | Enable pointer-driven splats. For a generated full-viewport background canvas, provide a canvas/container to make it interactive. |
| `hover` | `false` | Stir the fluid on pointer movement without holding the pointer button. |
| `pointerTarget` / `inputTarget` | `null` | Event target element or selector; default is the canvas. Coordinates are still mapped against the canvas bounds. |
| `keyboard` | `false` | Enable the configured keyboard shortcuts. |
| `hotkeys` | `{ pause: 'KeyP', splat: 'Space' }` | Keyboard `code` values for pause and random splat burst. |
| `pauseWhenHidden` | `true` | Pause physics while the document is hidden, then restore the previous running/paused state. |
| `visibilityPause` | `null` | Legacy alias; when non-null, overrides `pauseWhenHidden`. |
| `preserveDrawingBuffer` | `false` | WebGL context option; capture helpers use their own offscreen buffer. |
| `releaseContext` | `false` | Ask `WEBGL_lose_context` to release the context during `destroy()`. |
| `ditheringUrl` | `null` | Optional URL for a custom bloom dithering texture. `setDithering()` can change it later. |
| `color` | `null` | Fixed color for pointer splats when `COLORFUL` is false. |
| `id` / `className` | `null` / `'fluid-canvas'` | ID and class applied to a created/promoted canvas. |
| `style` | `null` | Object of inline style properties applied to the canvas. |
| `removeCanvasOnDestroy` | `false` | Remove the internally-created canvas during teardown. Externally supplied canvases are retained. |
| `throwOnError` | `true` | Throw initialization errors by default; `onError` is called when supplied. With false, return `null` instead of throwing. |
| `onError` | `null` | Initialization error callback. `createIfSupported()` always returns `null` on failure and invokes this callback once. |

## 3. Visual presets

Use `preset` at creation time or `fluid.applyPreset(name)` at runtime. Presets are starting points; adjust any property after applying one.

| Preset | Intended look |
|---|---|
| `classic` / `default` | Original colorful fluid behavior |
| `calm` | Gentle, slower movement and restrained glow |
| `vivid` | Stronger curl, faster color changes and vivid glow |
| `neon` | High-energy motion and a saturated neon palette |
| `smoke` | Dark, softer smoke-like trails; less colorful input |
| `ink` | More subdued ink with reduced glow and light background |
| `fire` | Warm palette and stronger glow |
| `water` | Cooler palette and slower, broader motion |
| `ocean` | Blue/cyan palette for fluid background effects |

```js
fluid.applyPreset('ocean');
fluid.setConfig({ bloomIntensity: 0.65, curl: 24 });
```

Preset values are intentionally subjective visual starting points—not physical fluid-material presets.

## 4. Quality and performance presets

Use `fluid.setQuality(name)` or `quality: 'medium'` in the creation options. Quality presets configure simulation resolution, dye resolution, pressure iterations, and display effects.

| Quality | Simulation grid | Dye grid | Pressure iterations | Shading / bloom / sunrays |
|---|---:|---:|---:|---|
| `low` | 64 | 256 | 10 | off / off / off |
| `performance` | 64 | 256 | 12 | off / off / off |
| `medium` | 96 | 512 | 16 | on / on / off |
| `high` | 128 | 1024 | 20 | on / on / on |
| `ultra` | 256 | 2048 | 24 | on / on / on |

Higher values usually increase GPU work and framebuffer memory. Start with `medium` for broad compatibility, then benchmark `high` on target devices. For low-end/mobile devices consider `performance`, `pixelRatio: 1`, and disabling bloom/sunrays. The API also degrades some settings automatically when required float-texture filtering support is unavailable; inspect `fluid.degraded` to see whether this occurred.

```js
fluid.setQuality('performance');
// Or tune only the resolution knobs:
fluid.setQuality({ sim: 96, dye: 512, capture: 512 });
```

`fluid.setQuality({ ... })` accepts `sim`, `dye`, `capture`, `pressureIterations`, `effects`, and recognized config keys. `effects: false` disables shading, bloom, and sunrays together.

## 5. Configuration reference

Set configuration at creation with `config: { ... }` or update later with `fluid.setConfig({ ... })`. Changes are applied live. Framebuffer-affecting options trigger framebuffer reallocation; display effect changes rebuild the corresponding shader variant.

| Config key | Default | Meaning |
|---|---:|---|
| `SIM_RESOLUTION` / `simResolution` | `128` | Velocity simulation grid resolution |
| `DYE_RESOLUTION` / `dyeResolution` | `1024` | Dye/detail grid resolution |
| `CAPTURE_RESOLUTION` / `captureResolution` | `512` | Default snapshot resolution |
| `DENSITY_DISSIPATION` / `densityDissipation` | `1` | Rate at which dye fades; lower values retain trails longer |
| `VELOCITY_DISSIPATION` / `velocityDissipation` | `0.2` | Rate at which velocity decays |
| `PRESSURE` / `pressure` | `0.8` | Pressure-solver decay factor |
| `PRESSURE_ITERATIONS` / `pressureIterations` | `20` | Pressure projection iterations |
| `CURL` / `curl` / `vorticity` | `30` | Vorticity confinement strength |
| `SPLAT_RADIUS` / `splatRadius` | `0.25` | Splat radius scale; the upstream solver passes this value divided by 100 to the splat shader |
| `SPLAT_FORCE` / `splatForce` | `6000` | Force applied during pointer movement |
| `SHADING` / `shading` | `true` | Pseudo-3D dye shading |
| `COLORFUL` / `colorful` | `true` | Cycles pointer colors while moving |
| `COLOR_UPDATE_SPEED` / `colorUpdateSpeed` | `10` | Color cycle speed |
| `PAUSED` / `paused` | `false` | Freeze physics while continuing rendering |
| `BACK_COLOR` / `background` / `backgroundColor` | `{r:0,g:0,b:0}` | Opaque background RGB color (0–255 values or supported color input) |
| `TRANSPARENT` / `transparent` | `false` | Render with alpha so page content can show through |
| `CHECKERBOARD` / `checkerboard` | `false` | Draw the test checkerboard behind transparent fluid in the on-screen canvas |
| `PALETTE` / `palette` | `null` | Array of hex/`rgb()`/`rgba()` strings, 0–255 RGB arrays, or `{r,g,b}` objects used for generated splats |
| `BLOOM` / `bloom` | `true` | Glow post-processing |
| `BLOOM_ITERATIONS` / `bloomIterations` | `8` | Bloom blur iterations |
| `BLOOM_RESOLUTION` / `bloomResolution` | `256` | Bloom framebuffer resolution |
| `BLOOM_INTENSITY` / `bloomIntensity` | `0.8` | Glow intensity |
| `BLOOM_THRESHOLD` / `bloomThreshold` | `0.6` | Brightness threshold for bloom |
| `BLOOM_SOFT_KNEE` / `bloomSoftKnee` | `0.7` | Softness around the bloom threshold |
| `SUNRAYS` / `sunrays` | `true` | Light-ray post-processing |
| `SUNRAYS_RESOLUTION` / `sunraysResolution` | `196` | Sunrays framebuffer resolution |
| `SUNRAYS_WEIGHT` / `sunraysWeight` | `1` | Sunrays contribution |
| `DITHERING` / `dithering` | `true` | Dither bloom to help reduce visible banding |

Example:

```js
fluid.setConfig({
  densityDissipation: 0.8,
  velocityDissipation: 0.25,
  pressureIterations: 18,
  palette: ['#32d8ff', '#9b5de5', '#f15bb5'],
  bloom: true,
  bloomIntensity: 0.75,
  sunrays: false
});

const configSnapshot = fluid.getConfig(); // detached configuration snapshot
fluid.resetConfig();                      // restore defaults + creation preset/config
```

`setConfig()` ignores unrecognized keys with a console warning and returns the instance for chaining. Use `getConfig()` for a detached snapshot; do not mutate internal configuration directly. `FluidSimulation.defaultConfig()` returns a fresh copy of the default configuration.

### Color and transparency helpers

```js
fluid.setBackground('#101018');
fluid.setBackground('transparent');
fluid.setTransparent(true);
fluid.setConfig({ checkerboard: true }); // optional on-screen debug background
fluid.setPalette(['#0047ab', '#00c2c7', '#7ef0e2']);
fluid.setColor('#ff3377');              // fixed color when COLORFUL is false
fluid.setColor(null);                   // return to generated colors
```

A custom palette takes precedence for randomly generated colors. Call `setPalette(null)` to restore the default color generator. Calling `setColorGenerator(fn)` installs a custom generator and clears the palette. A generator should return `{ r, g, b }` components in the 0–1 range; values over 1 are accepted for HDR-style highlights.

### Dithering texture

```js
fluid.setDithering(true);            // built-in procedural noise texture
fluid.setDithering(false);           // disable bloom dithering noise
fluid.setDithering('/assets/noise.png');
```

The custom URL must be readable by the page under normal browser image/CORS rules. Dithering mainly affects the bloom pass.

## 6. Simulation controls

```js
fluid.start();       // start/continue requestAnimationFrame loop
fluid.stop();        // stop scheduling frames, retain GPU state
fluid.pause();       // keep rendering, freeze fluid evolution
fluid.resume();      // unpause and start the loop if stopped
fluid.togglePause();
fluid.resize();      // manually resize/rebuild buffers
fluid.clear();       // clear dye/velocity fields
fluid.destroy();     // release listeners and GPU resources
```

`stop()` and `pause()` are different: stop halts the frame loop; pause keeps the canvas rendering but stops simulation stepping. `destroy()` is idempotent. After destruction, methods that need a live simulation throw a `FluidSimulationError` with code `DESTROYED`.

### Automatic resizing and pixel ratio

- `autoResize: true` (default) observes element resizes with `ResizeObserver` and also listens for window resize.
- `autoResize: false` disables automatic resize handling; call `fluid.resize()` after changing the canvas dimensions.
- `pixelRatio: 1` forces a 1× internal drawing buffer. Otherwise the device pixel ratio is used.
- `maxPixelRatio: 2` caps the effective pixel ratio by default to avoid excessive GPU work on very high-DPI displays.

The CSS size of a canvas must be non-zero. A canvas hidden with `display: none` can initialize with a zero size; call `resize()` after it becomes visible.

### Manual stepping

For deterministic external scheduling, set `autoStart: false` and `autoUpdate: false`, then advance frames explicitly:

```js
const fluid = FluidSimulation.create({
  canvas: '#fluid',
  autoStart: false,
  autoUpdate: false,
  input: false
});

function renderOneStep(dt) {
  fluid.frame(dt); // advances physics and renders once
}
renderOneStep(1 / 60);
```

`frame(dt)` clamps the supplied timestep to at most 0.1 seconds. The internal animation loop caps its timestep at roughly 1/60 second. `step(dt)` advances the simulation solver without performing the full public frame/render cycle; prefer `frame(dt)` for host-driven rendering.

## 7. Interaction and scripted input

Input is enabled by default. Existing canvas/container modes support mouse, pen, and touch pointer input. Disable it with `input: false` or call `fluid.disableInput()`. Set `hover: true` to stir the simulation without holding the pointer button. `pointerTarget` (or its alias `inputTarget`) may be an element or selector; coordinates are still measured relative to the simulation canvas, so only use a wider event target when that mapping is intended.

### Inject a splat

```js
// normalized x/y in [0, 1], origin at bottom-left
fluid.splat(0.5, 0.5, 600, -150, '#00d9ff');

// client/pixel coordinates (top-left browser coordinates)
fluid.splatAt(pointerEvent.clientX, pointerEvent.clientY, 10, -6, '#ff4fd8');

fluid.randomSplats(12);  // immediate burst
fluid.queueSplats(6);    // burst on a following frame
```

`dx` and `dy` are velocity impulses, not CSS pixel positions. `splatAt()` converts screen positions and pixel deltas to the simulation coordinate system.

### Script a stroke

```js
fluid.startStroke(0.2, 0.4, '#00d9ff');
fluid.moveStroke(0.3, 0.48);
fluid.moveStroke(0.45, 0.62);
fluid.endStroke();
```

Stroke coordinates use normalized 0–1 values with a bottom-left origin. `startStroke`, `moveStroke`, and `endStroke` are useful for pointer replay, scripted art, or external controls.

### Keyboard shortcuts

`keyboard: true` installs hotkeys while ignoring editable form controls. Defaults are `KeyP` for pause/resume and `Space` for a random splat burst. Customize them with:

```js
FluidSimulation.create({
  canvas: '#fluid',
  keyboard: true,
  hotkeys: { pause: 'KeyP', splat: 'Space' }
});
```

## 8. Events

Register listeners with `.on(name, handler)`, `.once(name, handler)`, and `.off(name, handler)`. Handlers receive `(payload, instance)`. Listener exceptions are caught and reported as warnings so they don't break the frame loop.

```js
fluid
  .on('ready', ({ canvas }) => console.log('ready', canvas))
  .on('frame', ({ dt, drawCalls }) => { /* optional telemetry */ })
  .on('splat', payload => console.log('splat', payload))
  .on('resize', ({ width, height }) => console.log(width, height))
  .on('error', error => console.warn(error.code, error.message))
  .once('destroy', () => console.log('released'));

fluid.off('frame', frameHandler);
fluid.removeAllListeners('splat');
```

Available names (`FluidSimulation.events`): `ready`, `frame`, `splat`, `resize`, `config`, `pause`, `resume`, `visibility`, `capture`, `clear`, `destroy`, `error`.

- `ready`: initialization completed; emitted asynchronously after construction.
- `frame`: one public/internal animation iteration; includes `dt`, `paused`, and `drawCalls`.
- `splat`: a splat or burst occurred.
- `resize`: internal drawing buffer resized.
- `config`: configuration changed; includes current config, changes, and previous config.
- `pause` / `resume`: physics paused or resumed.
- `visibility`: the document visibility state changed.
- `capture`: an image snapshot was produced.
- `clear`: simulation fields cleared.
- `destroy`: teardown completed.
- `error`: WebGL context lost/restoration failed or another recoverable runtime error was reported.

## 9. Capture, export, and diagnostics

```js
const image = fluid.getImageData({ resolution: 512 });
// image = { width, height, data: Uint8ClampedArray (RGBA bytes) }

const canvas = fluid.capture({ resolution: 1024 });
document.body.appendChild(canvas); // optional preview

const dataUrl = fluid.toDataURL('image/png', undefined, { resolution: 512 });
fluid.download('fluid-art.png', { resolution: 1024 });

console.log(fluid.getSize());
console.log(fluid.getContextInfo());
console.log(fluid.isWebGL2, fluid.degraded);
```

Capture reads GPU data back to CPU memory and may be expensive at high resolutions. Use it on demand, not on every animation frame. `getContextInfo()` reports WebGL mode, linear-filtering support, available renderer/vendor information where the browser permits it, degradation flags, and draw-call diagnostics.

`fluid.gl` exposes the WebGL context for advanced work; manipulating it directly can conflict with the simulation's state. `FluidSimulation.shaders` exposes source strings for inspection/custom builds but should be treated as advanced/unstable surface area.

## 10. Browser and lifecycle notes

- Requires WebGL and renderable half-float/float textures. Some devices may disable quality-heavy effects when float-texture linear filtering isn't available.
- The library attempts WebGL 2 first, then WebGL 1. Actual support depends on browser, GPU, driver, and extensions.
- When the document is hidden, `pauseWhenHidden: true` (default) pauses the simulation. If it was already paused by the caller, visibility handling does not automatically unpause it.
- WebGL context loss is reported as an `error` event. The instance attempts to rebuild resources when the context is restored; test this on your target devices.
- `removeCanvasOnDestroy: true` removes a canvas created by this instance. An existing canvas supplied by the caller is not removed.
- `releaseContext: true` asks the browser to release the WebGL context at teardown where `WEBGL_lose_context` is available. This can be useful for repeatedly mounted demos, but is unnecessary for many ordinary page lifecycles.
- If initialization fails, `create()` throws. Use `createIfSupported()` for graceful fallback.

### Error codes

`FluidSimulation.Error` is the error constructor. Errors expose `.code`, `.message`, and optional `.details`. Known codes include `NO_CANVAS`, `NO_WEBGL`, `FLOAT_TEXTURE_UNSUPPORTED`, `SHADER_COMPILE`, `CONTEXT_LOST`, `DESTROYED`, and `INVALID_OPTION`.

## 11. Public static properties

- `FluidSimulation.version`
- `FluidSimulation.instances`
- `FluidSimulation.events`
- `FluidSimulation.errorCodes`
- `FluidSimulation.defaultConfig()` — fresh config copy
- `FluidSimulation.defaultOptions()` — fresh options copy
- `FluidSimulation.presets`
- `FluidSimulation.qualityPresets`
- `FluidSimulation.configAliases`
- `FluidSimulation.shaders`
- `FluidSimulation.helpers`

## 12. License and attribution

The fluid solver and GLSL shader lineage derives from **WebGL Fluid Simulation by Pavel Dobryakov**, originally published under the MIT License. Preserve the upstream copyright and license notice when redistributing derivative code. See `LICENSE-fluid-merged.txt` bundled with this package. The merge wrapper, palette presets, quality controls, and documentation were assembled for this consolidated deliverable; they have not been independently performance-certified.
