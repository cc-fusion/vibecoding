# API reference

Loading `dist/mls-mpm.js` creates the global **`MLSMPM`** object.

## Exports

| Export | Purpose |
| --- | --- |
| `MLSMPM.Simulation` | Canvas renderer, animation loop, reset state, resizing, and pointer interaction. |
| `MLSMPM.World` | Headless physics solver and particle/state API. |
| `MLSMPM.Renderer` | Standalone Canvas 2D renderer for a `World`. |
| `MLSMPM.Material` | Numeric material IDs: `Fluid`, `Elastic`, `Snow`. |
| `MLSMPM.DEFAULT_WORLD_PARAMETERS` | Default physics/material values. Treat as read-only. |
| `MLSMPM.VERSION` | Library version string. |

## `new MLSMPM.Simulation(options)`

Creates a `World` and `Renderer`. The canvas must have a CSS size; the renderer handles device-pixel ratio and resizes automatically.

```js
const simulation = new MLSMPM.Simulation({
  canvas: '#simulation',
  gridSize: 96,
  substepsPerFrame: 30,
  onFrame(info) {
    console.log(info.simulationTime, info.frameMilliseconds);
  },
  onError(error) {
    console.error(error);
  },
});
```

See [PARAMETERS.md](./PARAMETERS.md) for all options.

### Properties

- `simulation.world`: the underlying `World`.
- `simulation.renderer`: the underlying `Renderer`.
- `simulation.canvas`: resolved canvas element.
- `simulation.substepsPerFrame`: current fixed substeps per animation frame.
- `simulation.running`: read-only playback boolean.

### Playback and lifecycle

| Method | Description |
| --- | --- |
| `start()` | Capture an initial state if needed, then begin or resume the animation loop. |
| `stop()` | Pause the animation loop without advancing or clearing the world. |
| `step(substeps = 1)` | Manually advance and render. Usually used while stopped. |
| `reset()` | Restore the last captured initial state. Continues running if already running. |
| `captureInitialState()` | Replace the state used by `reset()` with the world's current complete state. |
| `clear()` | Remove all particles, clear the captured state, and reset time. |
| `destroy()` | Stop playback and disconnect resize/pointer listeners. |

Typical scene replacement:

```js
simulation.stop();
simulation.clear();
simulation.addCircle({ x: 0.5, y: 0.7, radiusX: 0.15, material: 'elastic' });
simulation.captureInitialState();
simulation.start();
```

If you add particles after the initial state was captured, call `captureInitialState()` if `reset()` should return to the new scene.

### Runtime updates

```js
simulation.setParameters({ gravity: { y: -3 }, viscosity: 0.2 });
simulation.setRendererOptions({ colorMode: 'speed', showGrid: true });
simulation.setSubstepsPerFrame(15);
```

### Particle and shape helpers

These methods are forwarded from the world. `addParticle` returns a particle index; the others return the number of particles added:

```js
simulation.addParticle(options);
simulation.addParticles(options);
simulation.addRectangle(options);
simulation.addCircle(options);
simulation.addEllipse(options);
```

`Simulation` exposes these methods directly for convenience; their implementations and particle arrays live on `simulation.world`.

## `new MLSMPM.World(options)`

A standalone solver with no DOM dependency. See [PARAMETERS.md](./PARAMETERS.md) for construction/runtime options.

### Particle methods

#### `addParticle(options): number`

Adds one particle and returns its index.

```js
const index = world.addParticle({
  x: 0.5,
  y: 0.7,
  vx: 0.1,
  vy: 0,
  volume: 0.000025,
  material: 'elastic',
});
```

#### `addParticles(options): number`

Adds a flat XY array and returns the number added.

```js
world.addParticles({
  positions: [0.2, 0.3, 0.22, 0.3, 0.24, 0.3],
  velocities: [0, 0, 0.1, 0, -0.1, 0],
  volume: 0.000025,
  material: 'fluid',
});
```

The velocity array is optional but, when supplied, must have the same length as `positions`.

#### `addRectangle(options): number`

Samples a rectangle centered on a regular local lattice. `x`, `y` are its lower-left corner.

#### `addEllipse(options): number`

Samples an ellipse centered at `x`, `y`. `radiusY` defaults to `radiusX`.

#### `addCircle(options): number`

Equivalent to `addEllipse` with `radiusY = radiusX`.

#### `clear(): void`

Removes all active particles and resets simulation time/step counters.

### Physics methods

- `step(): void` — advance one solver substep.
- `configure(parameters): void` — merge runtime physics/material parameters.
- `getParameters(): object` — return a defensive deep copy of the current parameters.
- `applyImpulse({x, y, vx, vy, radius}): void` — add a smooth local particle impulse.

### State snapshots

`getState()` copies all active particle state and time counters. `restore(state)` restores a snapshot into the same capacity world.

```js
const checkpoint = world.getState();
for (let i = 0; i < 100; i++) world.step();
world.restore(checkpoint);
```

A state includes positions, velocities, affine matrices `C`, deformation gradients `F`, plastic/elastic volume ratios `Jp`, fluid volume ratios `Jf`, per-particle volumes, materials, time, and total steps.

### Public data

Typed arrays are allocated to `maxParticles`; only entries for `world.count` particles are active:

- `positions`, `velocities`: `2 × maxParticles` entries, flat XY.
- `C`, `F`: `4 × maxParticles` entries, row-major 2×2 matrices.
- `Jp`, `Jf`, `volumes`, `materials`: one entry per allocated particle.
- `materialCounts`: computed `[fluid, elastic, snow]` tuple.
- `simulationTime`, `totalSteps`, `lastGridMass`: scalar diagnostics.
- `gridSize`, `dx`, `invDx`, `timeStep`, `defaultParticleVolume`: grid/particle metadata.

These arrays are exposed for advanced customization and rendering. Do not resize them; use particle methods to preserve consistent state.

## `new MLSMPM.Renderer(canvas, options)`

A standalone renderer for applications that drive their own loop:

```js
const renderer = new MLSMPM.Renderer(document.querySelector('canvas'), {
  particleSize: 2,
  colorMode: 'material',
});

function frame() {
  world.step();
  renderer.render(world);
  requestAnimationFrame(frame);
}
frame();
```

Methods:

- `render(world, pointerVisual?)`
- `resize()`
- `setOptions(options)`
- `screenToDomain(clientX, clientY)` — convert pointer coordinates to unit-domain coordinates.

When using `Renderer` directly, call `resize()` whenever the canvas CSS size changes. `Simulation` installs a `ResizeObserver` for you.

## Coordinates and units

- The simulation domain is `[0, 1] × [0, 1]`.
- +X points right and **+Y points up**.
- Gravity defaults to `{x: 0, y: -9.8}`.
- Canvas rendering flips Y only at display time.
- Particle `volume` is rest **area** in 2D; mass is `volume × density`.
- `timeStep` is simulated seconds per substep, not wall-clock frame time.

## Errors and numerical stability

Configuration and particle methods throw descriptive errors for invalid values, malformed arrays, and capacity overflow. During animation, `Simulation` stops and calls `onError` if a solver step throws.

Use smaller timesteps for unusually stiff materials or large velocities. Numerical viscosity can reduce grid-scale splash noise; set it to zero only when you specifically need the undamped equations.
