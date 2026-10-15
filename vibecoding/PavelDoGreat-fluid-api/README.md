# WebGL Fluid Simulation API

A self-contained, GPU-accelerated fluid simulation packaged as a reusable
JavaScript API. Based on the classic single-file **WebGL Fluid Simulation**,
rebuilt around a clean `FluidSimulation` class with full configuration,
events, and programmatic control.

The solver implements Jos Stam's *Stable Fluids* method entirely on the GPU:
semi-Lagrangian advection, vorticity confinement, a Jacobi pressure solve,
and gradient subtraction — running in half-float WebGL framebuffers.

---

## Quick start

```html
<canvas id="fluid" style="position:fixed; inset:0; width:100%; height:100%"></canvas>

<script src="path/to/fluid-simulation.js"></script>
<script>
    const fluid = new FluidSimulation(document.getElementById('fluid'));
</script>
```

That's it — drag on the canvas to stir the fluid.

If you don't pass a canvas, one is created for you:

```js
const fluid = new FluidSimulation();          // creates its own canvas
document.body.appendChild(fluid.canvas);      // you decide where it goes
```

Works with ES modules / bundlers too (`module.exports` / AMD are supported):

```js
import FluidSimulation from './fluid-simulation.js';
```

---

## Constructor

```js
new FluidSimulation(canvas?, options?)
```

| Parameter | Type | Description |
|---|---|---|
| `canvas` | `HTMLCanvasElement \| null` | Target canvas. If omitted, a detached canvas is created (accessible via `fluid.canvas`). |
| `options` | `Object` | Any keys from the [configuration table](#configuration-reference). Unknown keys are ignored. |

If WebGL is unavailable, `fluid.supported` will be `false` and an `error`
event is emitted asynchronously.

---

## Instance properties

| Property | Type | Description |
|---|---|---|
| `fluid.canvas` | `HTMLCanvasElement` | The canvas being rendered to. |
| `fluid.supported` | `boolean` | `false` if the browser can't run the simulation. |
| `fluid.paused` | `boolean` | Live pause state (settable). |

---

## Methods

| Method | Returns | Description |
|---|---|---|
| `splat(x, y, dx, dy, color?)` | `this` | Inject dye + momentum at a point (see [Coordinates](#coordinate-system)). |
| `randomSplats(count, options?)` | `this` | Fire `count` splats at random positions/directions. Options: `{ color, intensity }`. |
| `setConfig(options)` | `this` | Merge validated options into the live config. Resolution changes reallocate buffers; `SHADING` recompiles the display shader. |
| `getConfig()` | `Object` | Snapshot of the current config. |
| `start()` / `resume()` | `this` | Unpause. |
| `pause()` | `this` | Pause the simulation step (rendering continues). |
| `togglePaused()` | `boolean` | Flip pause state; returns the new state. |
| `clear()` | `this` | Wipe all dye and velocity. |
| `resize()` | `this` | Force a size check (also happens automatically each frame). |
| `screenshot(type?, quality?)` | `string` | Renders the current frame and returns a data URL (default `'image/png'`). |
| `destroy()` | — | Cancels the loop, removes listeners, frees all GL resources. |
| `on(event, fn)` / `once(event, fn)` / `off(event, fn)` | `this` | Event subscription (see [Events](#events)). |

### Static members

| Member | Description |
|---|---|
| `FluidSimulation.VERSION` | Library version string. |
| `FluidSimulation.DEFAULT_CONFIG` | Copy of the default configuration. |
| `FluidSimulation.generateColor()` | Returns a random vibrant `{r, g, b}` color. |
| `FluidSimulation.hsvToRgb(h, s, v)` | HSV → RGB helper (all channels 0..1). |

---

## Configuration reference

Pass options to the constructor or `fluid.setConfig({...})`.

| Option | Type | Default | Description |
|---|---|---|---|
| `SIM_RESOLUTION` | int | `128` | Velocity/pressure grid resolution (short side). Higher = more accurate, slower. |
| `DYE_RESOLUTION` | int | `1024` (512 on touch devices) | Color grid resolution. The biggest performance lever. |
| `DENSITY_DISSIPATION` | 0–10 | `1` | How quickly the dye fades. `0` = dye persists forever. |
| `VELOCITY_DISSIPATION` | 0–10 | `0.2` | How quickly motion decays. |
| `PRESSURE` | 0–1 | `0.8` | Pressure retained between frames. Lower = softer, "smooshier" fluid. |
| `PRESSURE_ITERATIONS` | 1–60 | `20` | Jacobi solver iterations. More = more incompressible, costlier. |
| `CURL` | 0–100 | `30` | Vorticity confinement strength — how swirly/turbulent it looks. |
| `SPLAT_RADIUS` | 0.01–1 | `0.25` | Size of splats. |
| `SPLAT_FORCE` | 0–20000 | `6000` | Multiplier converting pointer movement speed into fluid force. |
| `SHADING` | bool | `true` | Fake directional lighting on the dye. |
| `COLORFUL` | bool | `true` | Periodically cycle pointer colors. |
| `COLOR_UPDATE_SPEED` | 0–100 | `10` | Color cycling speed. |
| `PAUSED` | bool | `false` | Start paused. |
| `BACK_COLOR` | `{r,g,b}` \| `'#hex'` | `{r:0,g:0,b:0}` | Background color (channels 0..1). |
| `TRANSPARENT` | bool | `true` | Alpha-blend the dye over the background. |
| `INTERACTIVE` | bool | `true` | Master switch for pointer/touch input. |
| `INTERACT_ON_HOVER` | bool | `false` | Stir the fluid by hovering (no click required). |
| `AUTO_SPLATS` | bool | `true` | Fire a random burst on startup so it's alive immediately. |

---

## Coordinate system

`splat()` uses **normalized coordinates in `[0, 1]` with the origin at the
bottom-left corner** (matching OpenGL):

```
(0,1) ────────── (1,1)
  │                 │
  │   (0.5, 0.5)    │
  │                 │
(0,0) ────────── (1,0)
```

- `dx`, `dy` are velocity impulses in simulation units. Pointer drags apply
  roughly `movement × SPLAT_FORCE`, so for visible manual splats use values
  around **±200 to ±2000**. `+dx` pushes right, `+dy` pushes **up**.
- Colors are `{r, g, b}` floats. `generateColor()` output is ~0.15 intensity;
  multiply by ~6–10 for bright splats. Values > 1 are fine (brighter dye).

---

## Events

```js
fluid.on('frame', (dt) => { /* every animation frame */ });
```

| Event | Payload | Fires when |
|---|---|---|
| `init` | instance | First frame rendered (WebGL ready). |
| `frame` | `dt` (seconds) | Every animation frame. |
| `splat` | `{x, y, dx, dy, color}` | Every splat applied (pointer or programmatic). |
| `error` | `Error` | WebGL not supported / init failed. |
| `destroy` | instance | `destroy()` was called. |

---

## Examples

### 1 · Custom configuration

```html
<script src="fluid-simulation.js"></script>
<script>
const fluid = new FluidSimulation(document.getElementById('fluid'), {
    DYE_RESOLUTION: 1024,
    CURL: 45,                 // extra turbulence
    SPLAT_RADIUS: 0.4,
    BACK_COLOR: '#0a0a12',
    INTERACT_ON_HOVER: true,
    AUTO_SPLATS: false
});
</script>
```

### 2 · Programmatic splats

```js
// A single colorful burst from the center pushing right
fluid.splat(0.5, 0.5, 900, 0, { r: 1.2, g: 0.3, b: 0.1 });

// Rain of random splats
fluid.randomSplats(15);

// Orbiting emitter driven by the frame loop
let t = 0;
fluid.on('frame', (dt) => {
    t += dt;
    const x = 0.5 + 0.3 * Math.cos(t * 1.3);
    const y = 0.5 + 0.3 * Math.sin(t * 1.7);
    const c = FluidSimulation.generateColor();
    fluid.splat(x, y,
        -Math.sin(t * 1.3) * 500,   // tangent direction
         Math.cos(t * 1.7) * 500,
        { r: c.r * 6, g: c.g * 6, b: c.b * 6 });
});
```

### 3 · UI controls (pause / clear / live config)

```js
pauseBtn.onclick = () => {
    pauseBtn.textContent = fluid.togglePaused() ? 'Resume' : 'Pause';
};
clearBtn.onclick = () => fluid.clear();
burstBtn.onclick = () => fluid.randomSplats(12);

slider.oninput = () => fluid.setConfig({ CURL: Number(slider.value) });
```

### 4 · Screenshot / PNG download

```js
saveBtn.onclick = () => {
    const a = document.createElement('a');
    a.download = 'fluid.png';
    a.href = fluid.screenshot();
    a.click();
};
```

### 5 · Events (FPS + splat counter)

```js
let frames = 0, splats = 0, last = performance.now();
fluid.on('frame', () => frames++);
fluid.on('splat', () => splats++);
setInterval(() => {
    const now = performance.now();
    console.log(`FPS ${Math.round(frames * 1000 / (now - last))} · splats ${splats}`);
    frames = 0; last = now;
}, 1000);
```

### 6 · Multiple instances

```js
const left  = new FluidSimulation(document.getElementById('left'));
const right = new FluidSimulation(document.getElementById('right'), {
    CURL: 60, BACK_COLOR: '#100818'
});
```

### 7 · Graceful fallback

```js
const fluid = new FluidSimulation(canvas);
fluid.on('error', (err) => {
    canvas.replaceWith(Object.assign(document.createElement('p'), {
        textContent: 'Fluid effects are not supported on this device.'
    }));
});
```

---

## Browser support & performance notes

- **WebGL2** preferred; falls back to WebGL1 + `OES_texture_half_float`
  (with a manual-bilerp advection path when linear filtering of half-float
  textures is unavailable).
- Requires renderable half-float textures (`EXT_color_buffer_float` on WebGL2).
  Effectively all modern desktop and mobile browsers qualify.
- Performance levers, in order of impact: `DYE_RESOLUTION` →
  `PRESSURE_ITERATIONS` → `SIM_RESOLUTION` → `SHADING`.
- The canvas backing store tracks its CSS size × devicePixelRatio (capped at 2×).

## License

MIT. Based on the technique popularized by Pavel Dobryakov's
*WebGL Fluid Simulation* and Jos Stam's *Stable Fluids* (SIGGRAPH 1999).
