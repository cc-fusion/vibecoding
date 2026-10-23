# Parameter reference

All options are plain JavaScript objects. Constructor options can be passed to `new MLSMPM.Simulation(...)` or `new MLSMPM.World(...)`. Runtime physics updates use `simulation.setParameters(...)` or `world.configure(...)`.

Nested objects are **merged**. For example, `{ gravity: { y: -2 } }` changes only the Y component.

## World construction

| Option | Type | Default | Runtime editable | Description |
| --- | --- | ---: | --- | --- |
| `gridSize` | integer | `96` | No | Background grid is `gridSize × gridSize`; allowed range 8–512. |
| `maxParticles` | integer | `50000` | No | Allocated particle capacity. |
| `particleVolume` | number | `(0.5 / gridSize)²` | No | Default rest area for newly added particles. Existing particles store their own volume. |
| `timeStep` | number | `0.0001` | Yes | Simulation seconds per solver substep. Must be positive. |
| `gravity` | `{x, y}` | `{x: 0, y: -9.8}` | Yes | Acceleration in domain units per second². Partial vectors are merged. |
| `density` | number | `1` | Yes | Global density; particle mass is `volume × density`. |
| `viscosity` | number | `0.30` | Yes | Local grid-velocity diffusion. `0` disables it; values above `0.45` are clamped. |
| `boundaryWidth` | integer | `3` | Yes | Number of boundary grid nodes. `0` disables velocity boundary enforcement. |

Example:

```js
const simulation = new MLSMPM.Simulation({
  canvas: '#simulation',
  gridSize: 80,
  maxParticles: 25000,
  particleVolume: (0.5 / 80) ** 2,
  timeStep: 0.00008,
  gravity: { x: 0.1, y: -9.8 },
  density: 1,
  viscosity: 0.2,
  boundaryWidth: 3,
});
```

### Changing runtime physics

```js
simulation.setParameters({
  timeStep: 0.0001,
  gravity: { x: 0, y: -4 },
  viscosity: 0.1,
});
```

Changing `particleVolume` is a construction-time setting. To assign volume per particle, use `volume` in any particle/shape method.

## Material parameters

### Fluid

| Option | Default | Description |
| --- | ---: | --- |
| `fluid.bulkModulus` | `400` | Weakly compressible fluid bulk modulus. |

```js
simulation.setParameters({ fluid: { bulkModulus: 300 } });
```

### Elastic

| Option | Default | Description |
| --- | ---: | --- |
| `elastic.youngsModulus` | `5000` | Corotated elastic stiffness. |
| `elastic.poissonRatio` | `0.2` | Poisson ratio; must be between `-1` and `0.5`. |

```js
simulation.setParameters({
  elastic: { youngsModulus: 3500, poissonRatio: 0.25 },
});
```

### Snow

Snow supports the elastic options plus plasticity and hardening:

| Option | Default | Description |
| --- | ---: | --- |
| `snow.youngsModulus` | `5000` | Base snow stiffness before hardening. |
| `snow.poissonRatio` | `0.2` | Snow Poisson ratio. |
| `snow.hardening` | `10` | Exponential compression-hardening coefficient. |
| `snow.minStretch` | `0.975` | Lower singular-value plastic clamp. |
| `snow.maxStretch` | `1.0045` | Upper singular-value plastic clamp. |

```js
simulation.setParameters({
  snow: {
    youngsModulus: 4500,
    hardening: 7,
    minStretch: 0.96,
    maxStretch: 1.005,
  },
});
```

## Particle and shape options

Every `addParticle` call accepts:

| Option | Description |
| --- | --- |
| `x`, `y` | Initial position in `[0, 1]`. |
| `material` | `'fluid'`, `'elastic'`, `'snow'`, or the corresponding `MLSMPM.Material` value. |
| `vx`, `vy` | Optional initial velocity; defaults to zero. |
| `volume` | Optional rest area; defaults to the world's `particleVolume`. |

Shape methods additionally accept `spacing`. If omitted, spacing is `sqrt(particleVolume)`. Generated particles default to `volume = spacing²`.

```js
simulation.addRectangle({
  x: 0.1, y: 0.05, width: 0.2, height: 0.4,
  material: 'fluid', spacing: 0.005, volume: 0.005 ** 2,
});

simulation.addEllipse({
  x: 0.7, y: 0.7, radiusX: 0.12, radiusY: 0.06,
  material: 'snow', vx: -0.1, vy: 0,
});
```

## Simulation options

| Option | Default | Description |
| --- | --- | --- |
| `canvas` | required | Canvas element or selector. |
| `substepsPerFrame` | `30` | Fixed solver steps per animation frame. Change with `setSubstepsPerFrame(n)`. |
| `renderer` | `{}` | Rendering options below. |
| `interaction` | see below | Pointer impulse options. |
| `onFrame(info)` | none | Called after stepping and rendering. |
| `onError(error)` | none | Animation-loop error handler. |

`onFrame` receives:

```js
{
  simulationTime,   // Simulated seconds
  totalSteps,       // Solver steps since reset
  substeps,         // Steps advanced by this frame
  frameMilliseconds // CPU time for stepping + rendering
}
```

## Renderer options

Pass through `renderer` in the constructor or `setRendererOptions()` later.

| Option | Default | Description |
| --- | --- | --- |
| `particleSize` | `2.2` | Particle radius in CSS pixels. |
| `colorMode` | `'material'` | `'material'` or `'speed'`. |
| `showGrid` | `false` | Draw the background grid overlay. |
| `gridDivisions` | `24` | Number of displayed grid divisions. |
| `background` | `'#08131b'` | Canvas background CSS color. |
| `domainColor` | `'#0a151e'` | Simulation domain CSS color. |
| `boundaryColor` | translucent blue | Domain boundary CSS color. |
| `colors.fluid` | `'#28a9ff'` | Fluid particle CSS color. |
| `colors.elastic` | `'#ffad42'` | Elastic particle CSS color. |
| `colors.snow` | `'#72e69b'` | Snow particle CSS color. |
| `maxSpeed` | `3.5` | Speed at the top of the speed-color scale. |
| `padding` | `24` | Domain padding in CSS pixels. |

```js
simulation.setRendererOptions({
  colorMode: 'material',
  particleSize: 3,
  background: '#10141c',
  colors: { fluid: '#65d9ff', snow: '#ffffff' },
});
```

## Pointer interaction

| Option | Default | Description |
| --- | --- | --- |
| `interaction.enabled` | `true` | Enable drag-to-stir pointer events. |
| `interaction.radius` | `0.11` | Impulse radius in domain units. |
| `interaction.strength` | `0.32` | Pointer-to-particle velocity gain. Set `0` for visual-only pointer tracking. |

```js
const simulation = new MLSMPM.Simulation({
  canvas: '#simulation',
  interaction: { enabled: true, radius: 0.16, strength: 0.2 },
});
```

You can bypass pointer handling and apply impulses directly:

```js
simulation.world.applyImpulse({
  x: 0.5,
  y: 0.5,
  vx: 1,
  vy: 0,
  radius: 0.15,
});
```
