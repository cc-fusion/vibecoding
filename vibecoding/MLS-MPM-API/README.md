# MLS–MPM 2D API — JavaScript edition

A standalone, asset-independent **plain JavaScript** library for two-dimensional MLS–MPM simulations. This edition contains no TypeScript source, TypeScript configuration, or TypeScript dependency.

Load one classic JavaScript file, create particles, and start the simulation.

- **JavaScript `.js` source, tests, examples, and configuration**
- **No OBJ files, meshes, images, or other runtime assets**
- **No runtime dependencies or network requests**
- **No bundler, Python, Taichi, or backend required**
- Procedural shapes and custom XY particle arrays
- Customizable fluid, corotated elastic, and plastic snow materials
- Optional headless solver, Canvas 2D renderer, animation loop, and pointer interaction
- Native ES-module source and a prebuilt classic-script bundle

## Quick start

Copy **`dist/mls-mpm.js`** into your site, then load it with a normal script tag:

```html
<canvas id="simulation" style="width: 800px; height: 600px"></canvas>

<script src="/path/to/mls-mpm.js"></script>
<script>
  const simulation = new MLSMPM.Simulation({
    canvas: '#simulation',
    gridSize: 96,
    substepsPerFrame: 30,
    gravity: { x: 0, y: -9.8 },
    viscosity: 0.3,
    fluid: { bulkModulus: 400 },
    elastic: { youngsModulus: 5000, poissonRatio: 0.2 },
    snow: { youngsModulus: 5000, poissonRatio: 0.2 },
    renderer: {
      particleSize: 2.2,
      colors: {
        fluid: '#28a9ff',
        elastic: '#ffad42',
        snow: '#72e69b',
      },
    },
  });

  simulation.addRectangle({
    x: 0.08,
    y: 0.05,
    width: 0.25,
    height: 0.45,
    material: 'fluid',
  });

  simulation.addCircle({
    x: 0.7,
    y: 0.75,
    radiusX: 0.1,
    material: 'elastic',
  });

  simulation.addEllipse({
    x: 0.46,
    y: 0.72,
    radiusX: 0.11,
    radiusY: 0.075,
    material: 'snow',
  });

  simulation.start();
</script>
```

The classic script defines **`window.MLSMPM`**. `start()` captures the current scene for `reset()` and begins the animation loop. Drag on the canvas to apply a local impulse.

### Use the JavaScript source as native modules

The readable source in `src/` uses standard JavaScript ES modules with explicit `.js` imports:

```html
<script type="module">
  import { Simulation } from './src/index.js';

  const simulation = new Simulation({ canvas: '#simulation' });
  simulation.addCircle({
    x: 0.5,
    y: 0.7,
    radiusX: 0.15,
    material: 'elastic',
  });
  simulation.start();
</script>
```

Native module source should be served over HTTP(S). The prebuilt classic script also works from `file://`.

## Change parameters at runtime

Nested parameters are merged, so unspecified values are preserved:

```js
simulation.setParameters({
  gravity: { y: -4 },
  viscosity: 0.15,
  fluid: { bulkModulus: 250 },
  snow: { hardening: 7, minStretch: 0.96 },
});

simulation.setRendererOptions({
  colorMode: 'speed',
  showGrid: true,
  particleSize: 2.8,
});
```

See **[Parameter reference](./docs/PARAMETERS.md)** for every physics, material, rendering, and interaction option.

## Custom particles

Use a flat XY array for arbitrary geometry. An optional velocity array uses the same layout:

```js
const positions = [0.3, 0.4, 0.32, 0.4, 0.34, 0.4];
const velocities = [0, 0, 0.1, 0, -0.1, 0];

simulation.addParticles({
  positions,
  velocities,
  material: 'fluid',
  volume: 0.00002,
});
```

For a custom sampling spacing, a typical default volume is `spacing * spacing`. Particle coordinates use the unit domain `[0, 1]`; **+Y points upward**.

## Headless usage

`World` contains no DOM or rendering code and can be imported directly into a JavaScript application or Web Worker:

```js
import { World } from './src/world.js';

const world = new World({
  gridSize: 64,
  gravity: { x: 0, y: -9.8 },
});

world.addCircle({ x: 0.5, y: 0.7, radiusX: 0.12, material: 'elastic' });

for (let i = 0; i < 100; i++) world.step();

console.log(world.simulationTime, world.positions.slice(0, world.count * 2));
```

See **[API reference](./docs/API.md)** for methods, state snapshots, manual stepping, callbacks, and lifecycle details.

## Examples

- **[Basic example](./examples/basic.html)** — procedural mixed-material scene, playback, gravity/viscosity controls, and grid display.
- **[Custom particles](./examples/custom-particles.html)** — custom position/velocity arrays and colors.
- **[Native module](./examples/native-module.html)** — imports `src/index.js` directly without a bundle.

The basic and custom-particle examples load `../dist/mls-mpm.js` with a classic `<script>` tag and can be opened directly from disk. The native-module example should be served over HTTP(S), like any browser ES-module application.

## Files

```text
dist/
  mls-mpm.js              Standalone minified classic script
  mls-mpm.js.map          Source map
src/
  index.js                Public JavaScript exports
  world.js                Headless solver
  simulation.js           Canvas/animation wrapper
  renderer.js             Canvas 2D renderer
  math2d.js               2×2 SVD and kernel weights
  types.js                Runtime constants and default parameters
examples/                Asset-free classic-script examples
docs/                    API and parameter references
tests/                   JavaScript numerical and API tests
vite.config.js            JavaScript build configuration
```

The generated `dist/` files are included so consumers do not need Node.js or a build step.

## Develop the library

Only modifying or rebuilding the library requires Node.js:

```bash
npm ci
npm test
npm run build
npm run dev
```

`npm run build` bundles the native JavaScript modules into the classic-script IIFE and source map. `npm run dev` builds once and starts Vite; the root URL redirects to the basic example.

## Numerical notes

- The solver uses a 2D P2G → grid operation → G2P pipeline with quadratic B-spline weights and an analytic 2×2 SVD.
- Default numerical viscosity is `0.30`; this preserves uniform motion while damping grid-scale velocity gradients. Set it to `0` for the original undamped update equations.
- `timeStep` controls simulation time per solver step. `substepsPerFrame` controls how many steps run per rendered animation frame.
- Lower `substepsPerFrame`, `gridSize`, or particle counts when targeting slower devices. The convenience animation loop runs on the main thread; `World` can also be driven inside your own worker.

## License and attribution

MIT; see [LICENSE](./LICENSE). This API is derived from [CzzzzH/MLS-MPM](https://github.com/CzzzzH/MLS-MPM), with the 2D/browser conversion and standalone JavaScript API layered on top. Original mesh files are deliberately not included or required.
