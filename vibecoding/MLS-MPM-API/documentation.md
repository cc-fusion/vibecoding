# MLS-MPM Documentation

## Contents

- [At a glance](#at-a-glance)
- [Getting started](#getting-started)
- [Coordinate system and colors](#coordinate-system-and-colors)
- [Materials](#materials)
- [Constructor options](#constructor-options)
- [Instance properties and getters](#instance-properties-and-getters)
- [Particle creation and management](#particle-creation-and-management)
- [Simulation stepping](#simulation-stepping)
- [Rendering](#rendering)
- [Interaction extensions](#interaction-extensions)
- [Static helpers](#static-helpers)
- [Common recipes](#common-recipes)
- [Performance and tuning](#performance-and-tuning)
- [Troubleshooting and gotchas](#troubleshooting-and-gotchas)
- [API quick reference](#api-quick-reference)
- [Implementation notes and attribution](#implementation-notes-and-attribution)

## Getting started

### 1. Load the file

Place the source file next to your HTML file and load it as a classic script. 

```html
<canvas id="sim" width="800" height="800"></canvas>
<script src="./v1.js"></script>
<script>
  const canvas = document.getElementById('sim');
  const sim = new MLSMPM();

  // Add a block of snow particles. Color is 0xRRGGBB.
  sim.add_object([0.5, 0.7], 0xE8F4FF, {
    size: [0.12, 0.08],
    material: 'snow'
  });

  function frame() {
    sim.advance_frame();
    sim.render(canvas);
    requestAnimationFrame(frame);
  }

  frame();
</script>
```

The simulation container spans normalized coordinates from `0` to `1`. The default boundary handling keeps particles inside the box. `add_object()` accepts the center of the object, and its `size` values are **half-extents**: `size: 0.08` creates a block spanning approximately `0.16 × 0.16` units.

### 2. CommonJS

```js
const MLSMPM = require('./v1.js');
const sim = new MLSMPM({ seed: 123 });

sim.add_object([0.5, 0.7], 0xE8F4FF, { material: 'snow' });
sim.advance_frame();
console.log(sim.get_particle(0));
```

The module uses CommonJS when `module.exports` is available; otherwise it attaches the class to the global object as `MLSMPM`.

## Coordinate system and colors

### Simulation coordinates

- `x` and `y` are normalized values, usually between `0` and `1`.
- The lower-left corner is approximately `[0, 0]`; the upper-right is `[1, 1]`.
- **Simulation y points upward.** Canvas pixel y points downward, so `render()` flips y when drawing.
- Positions outside the valid particle range are clamped when particles are created and after each particle update. The effective limits are approximately `0.5 * dx` and `1 - 0.5 * dx`.
- `dx = 1 / n`, where `n` is the number of grid cells per axis. The grid has `(n + 1) × (n + 1)` nodes.

### Colors

Colors are integer RGB values in `0xRRGGBB` form, **not CSS color strings**.

```js
sim.add_particle([0.5, 0.5], 0xFF8844); // orange
sim.add_particle([0.6, 0.5], 0x44CC88); // green
sim.add_particle([0.7, 0.5]);          // defaults to white (0xFFFFFF)
```

For a CSS hex string such as `"#ff8844"`, convert it first, or supply the equivalent integer `0xFF8844`.

## Materials

The source exports these static constants and accepts these names in the `material` option:

| Material | ID | Behavior in this implementation |
|---|---:|---|
| `MLSMPM.SNOW` / `"snow"` | `0` | Uses the fixed-corotated elastic model and, when `plastic: true`, clamps singular values of the deformation gradient to model plastic compression/stretch. |
| `MLSMPM.JELLY` / `"jelly"` | `1` | Uses the fixed-corotated elastic model without the snow-specific plastic projection. |
| `MLSMPM.WATER` / `"water"` | `2` | Sets the shear modulus contribution to zero and resets the deformation gradient to an isotropic form each step while preserving a bounded positive volume measure. |

Material names are case-insensitive (`"Snow"`, `"SNOW"`, and `"snow"` resolve to the same ID). If `material` is `undefined` or `null`, the implementation defaults to snow. An unrecognized **string** throws an error such as `MLSMPM: unknown material "sand"`.

```js
sim.add_object([0.25, 0.7], 0xDCEEFF, { material: 'snow' });
sim.add_object([0.50, 0.7], 0xFF70B0, { material: 'jelly' });
sim.add_object([0.75, 0.7], 0x65C9FF, { material: 'water' });
```

### What about sand or a generic solid?

They are not enumerated in this source. Numeric material IDs other than the named constants are not validated, but that does **not** create a proper sand or solid model; unknown IDs generally fall through the non-snow/non-water branch and behave like the elastic jelly path. For a real sand model or a distinct solid model, the constitutive update needs to be implemented explicitly.

## Constructor options

Create a simulation with `new MLSMPM(options)`. The whole `options` object is optional.

| Option | Default | Meaning / notes |
|---|---:|---|
| `n` | `80` | Grid resolution in cells per axis. The source clamps values to a minimum of `4` and converts the supplied value to an integer. |
| `dt` | `1e-4 * 80 / n` | Simulation substep duration. The default is reduced as grid resolution increases. |
| `frame_dt` | `1e-3` | Target simulated time advanced by `advance_frame()` before its step-count rounding. |
| `particle_mass` | `1` | Mass assigned to each particle. |
| `vol` | `1` | Particle volume scale used in the stress calculation. |
| `hardening` | `10` | Exponential hardening coefficient used with the plastic volume ratio `Jp`. |
| `E` | `1e4` | Young's modulus used to compute the base Lamé parameters. |
| `nu` | `0.2` | Poisson's ratio used to compute the base Lamé parameters. Avoid values that make the denominator `1 - 2 * nu` zero. |
| `plastic` | `true` | Enables snow's plastic deformation projection. It does not turn the jelly or water branches into snow. |
| `theta_c` | `2.5e-2` | Snow critical compression parameter; lower singular-value limit is `1 - theta_c`. |
| `theta_s` | `7.5e-3` | Snow critical stretch parameter; upper singular-value limit is `1 + theta_s`. |
| `gravity` | `[0, -200]` | Acceleration added to occupied grid-node velocities each substep. Uses simulation coordinates; negative y is downward. |
| `boundary` | `0.05` | Boundary-band width used by grid-node collision handling. |
| `seed` | not set | If supplied, seeds a deterministic `mulberry32` random generator for repeatable `add_object()` placement. Without it, `Math.random` is used. |
| `max_particles` | `1024` | Initial particle-array capacity hint. Arrays grow automatically if more particles are added. |

Example configuration:

```js
const sim = new MLSMPM({
  n: 100,
  dt: 8e-5,
  frame_dt: 1 / 120,
  gravity: [0, -120],
  boundary: 0.04,
  E: 1e4,
  nu: 0.2,
  plastic: true,
  seed: 42,
  max_particles: 5000
});
```

Changing material parameters can substantially alter the motion and stability. The table lists the values used by the implementation; it is not a guarantee that every combination is numerically stable.

## Instance properties and getters

The implementation exposes a number of instance fields directly. Most are intended for tuning, inspection, or extensions.

| Property / getter | Description |
|---|---|
| `version` | Version is exposed on the class as `MLSMPM.version`, not as an instance-only setting. Current value: `"1.0.0"`. |
| `n` | Grid cell resolution. |
| `dx` | Grid cell size, `1 / n`. |
| `inv_dx` | Inverse cell size, `n`. |
| `dt` | Default substep size used by `advance_frame()`. |
| `frame_dt` | Frame time setting used to calculate the number of substeps. |
| `steps_per_frame` | Getter: `max(1, round(frame_dt / dt))`. |
| `t` | Accumulated simulation time; increases by each `advance(dt)` substep. `clear()` resets it to `0`. |
| `num_particles` | Number of active particles. |
| `capacity` | Allocated particle capacity. It may be larger than `num_particles`. |
| `particle_mass`, `vol`, `hardening`, `E`, `nu`, `plastic`, `theta_c`, `theta_s`, `boundary` | Material/physics settings described above. |
| `gravity` | Two-element acceleration array `[gx, gy]`. |
| `mu_0` | Getter: `E / (2 * (1 + nu))`. Base shear modulus. |
| `lambda_0` | Getter: `E * nu / ((1 + nu) * (1 - 2 * nu))`. Base first Lamé parameter. |
| `grid` | Flat `Float64Array` containing each grid node's `[velocityX, velocityY, mass]`. It is reset at the beginning of each substep. |
| `x` | Flat `Float64Array`; particle position pairs `[x0, y0, x1, y1, ...]`. |
| `v` | Flat `Float64Array`; particle velocity pairs. |
| `F` | Flat `Float64Array`; four row-major deformation-gradient values per particle. |
| `C` | Flat `Float64Array`; four row-major affine velocity/APIC values per particle. |
| `Jp` | `Float64Array`; plastic volume ratio per particle. |
| `c` | `Uint32Array`; particle RGB color integers. |
| `material` | `Uint8Array`; material ID per particle. |
| `attractor` | Optional attraction/repulsion settings object; see [Interaction extensions](#interaction-extensions). |
| `grid_hook` | Optional callback invoked for occupied grid nodes during grid velocity update. |
| `random` | Random-number function used by `add_object()`. With a `seed`, this is the seeded generator. |

### Internal array layout

Arrays are stored as **structure-of-arrays** typed buffers instead of one JavaScript object per particle. For particle `p`:

- Position/velocity offset: `2 * p` (`x`, `y` pairs).
- Matrix offset: `4 * p` (`m00`, `m01`, `m10`, `m11`).
- Grid node offset: `((i * (n + 1) + j) * 3)`; the three values are velocity x, velocity y, and mass.

Direct array access is fast, but the layout is low-level. Prefer `get_particle(i)` for a convenient snapshot when performance is not critical.

## Particle creation and management

### `add_particle(position, color, options)`

Add one particle.

```js
const index = sim.add_particle([0.5, 0.8], 0xFFFFFF, {
  velocity: [1.0, -2.0],
  material: 'jelly'
});
```

| Argument | Type | Description |
|---|---|---|
| `position` | `[x, y]` | Initial normalized simulation position. It is clamped to the valid grid interior. |
| `color` | integer or omitted | `0xRRGGBB`; defaults to white (`0xFFFFFF`). |
| `options.velocity` | `[vx, vy]` or omitted | Initial velocity; defaults to `[0, 0]`. |
| `options.material` | string or material ID | `"snow"`, `"jelly"`, `"water"`, or the exported numeric constants. Defaults to snow. |

**Returns:** the newly assigned particle index (zero-based).

### `add_object(center, color, options)`

Add a randomly sampled rectangular block of particles. This is the most convenient method for creating a pile, blob, or object.

```js
const firstIndex = sim.add_object([0.5, 0.75], 0xDCEEFF, {
  size: [0.12, 0.06],
  count: 1500,
  velocity: [0, 0],
  material: 'snow'
});
```

| Argument / option | Default | Description |
|---|---|---|
| `center` | required | Center `[x, y]` of the block. |
| `color` | white if omitted | Integer `0xRRGGBB`. |
| `options.size` | `0.08` | Half-width/half-height. A number applies to both axes; `[sx, sy]` sets each separately. Positions are sampled from `center ± size`. |
| `options.count` | calculated | Explicit particle count. If omitted, the count is scaled by object area and by `n²` to approximate the original particle density as resolution changes. |
| `options.velocity` | `[0, 0]` | Initial velocity shared by all particles in the object. |
| `options.material` | snow | Material name or ID. |

**Returns:** the index of the first particle added by this call, not the number of particles added.

Default-count formula used by the implementation:

```js
k = n / 80;
count = round(1000 * (sx * sy) / 0.0064 * k * k);
```

For the default `size: 0.08` at `n: 80`, this creates about `1000` particles in a rectangle with full dimensions `0.16 × 0.16`.

### `get_particle(index)`

Returns a **copy/snapshot** of one particle's state. Editing the returned arrays does not update the simulation.

```js
const p = sim.get_particle(0);
console.log(p.x, p.v, p.material, p.Jp);
```

Returned object:

```js
{
  x: [x, y],
  v: [vx, vy],
  F: [m00, m01, m10, m11],
  C: [m00, m01, m10, m11],
  Jp: number,
  c: number,        // RGB integer
  material: number  // 0, 1, or 2 for built-in materials
}
```

The method does not perform an explicit index-range check. Make sure `0 <= index < sim.num_particles`.

### `reserve(capacity)`

Ensure the particle buffers can hold at least `capacity` particles.

```js
sim.reserve(10000);
```

- Grows arrays only; it does not shrink them.
- Preserves existing typed-array contents when growing.
- Returns the simulation instance, so it can be chained.
- Usually unnecessary because particle storage expands automatically, but it can avoid array growth while building a known-size scene.

### `clear()`

Remove all active particles and reset the simulation clock and grid.

```js
sim.clear();
```

- Sets `num_particles` to `0`, `t` to `0`, and fills the grid with zeros.
- Does **not** shrink allocated arrays or reset the simulation's constructor settings.
- Returns the simulation instance.

This API has no individual-particle removal method. To remove everything, call `clear()`; to selectively remove particles, you would need to manage the arrays and counts yourself or extend the API.

## Simulation stepping

### `advance(dt?)`

Run one MLS-MPM substep.

```js
sim.advance();       // uses sim.dt
sim.advance(0.00005); // uses this dt for this call only
```

The step performs these phases:

1. Reset the grid.
2. Transfer particle momentum/stress to nearby grid nodes (P2G).
3. Update occupied grid-node velocities with gravity, the optional attractor, the optional `grid_hook`, and boundary constraints.
4. Transfer grid velocities back to particles (G2P), update position and deformation, and apply material-specific deformation handling.
5. Add the chosen `dt` to `sim.t`.

**Returns:** the simulation instance.

Passing an explicit `dt` does not modify `sim.dt`. Use care when choosing a substep size: very large values or aggressive material settings can produce unstable motion.

### `advance_frame()`

Advance the simulation by the configured number of substeps for one visual frame.

```js
sim.advance_frame();
```

The step count is computed by the getter:

```js
Math.max(1, Math.round(sim.frame_dt / sim.dt))
```

So the actual accumulated time per call is `steps_per_frame * dt`, which may differ slightly from `frame_dt` because the ratio is rounded. It always performs at least one substep. Returns the simulation instance.

### Recommended animation loop

```js
function frame() {
  sim.advance_frame();
  sim.render(canvas);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

This example uses simulation-controlled time steps, not the real elapsed time passed by `requestAnimationFrame`. To pause, stop scheduling frames; to reset the particles and clock, call `sim.clear()` and recreate the scene.

## Rendering

### `render(target, options?)`

Draw the current particles into a Canvas 2D canvas or a Canvas 2D context.

```js
sim.render(canvas);
// Or:
const ctx = canvas.getContext('2d');
sim.render(ctx, { background: 0x112F41, box: 0x4FB99F, radius: 2 });
```

`target` can be either:

- an HTML `<canvas>` (the method obtains its `2d` context), or
- an existing 2D rendering context.

| Render option | Default | Behavior |
|---|---|---|
| `background` | `0x112F41` | Canvas background color as `0xRRGGBB`. Set to `null` for a zeroed/transparent pixel buffer. |
| `box` | `0x4FB99F` | Draw the rectangular boundary outline. Set to `null` to omit it. |
| `radius` | `max(0.5, 2 * min(width, height) / 800)` | Particle stamp radius in **pixels**, not simulation units. |

Implementation details:

- The box outline is drawn at approximately `4%` and `96%` of canvas width/height.
- The renderer maps simulation x to `x * canvas.width` and simulation y to `(1 - y) * canvas.height`.
- Pixels are written into an `ImageData` buffer through a `Uint32Array` view, then committed with `putImageData()`.
- The image buffer is reused until the canvas dimensions change.
- Particle circles are cached per radius to avoid rebuilding the same pixel stamp repeatedly.
- The renderer overwrites the pixel buffer each call; it is not a compositing renderer for other canvas layers.

The canvas can be rectangular, but simulation coordinates are square-normalized and the renderer scales x and y independently to the canvas dimensions. Use a square canvas for an undistorted square simulation view.

## Interaction extensions

Two optional instance properties extend the original simulation logic: `attractor` and `grid_hook`.

### Attractor: pull particles toward or away from a point

Set `sim.attractor` to an object with `x`, `y`, `strength`, and optional `radius` fields.

```js
sim.attractor = {
  x: 0.5,
  y: 0.5,
  strength: 40,
  radius: 0.35
};

// Disable the attractor:
sim.attractor = null;
```

| Field | Meaning |
|---|---|
| `x`, `y` | Target point in normalized simulation coordinates (y up). |
| `strength` | Signed influence scaled by `dt`. A positive value attracts toward the target; a negative value pushes away. A falsy strength disables the effect. |
| `radius` | Optional influence radius in simulation-coordinate units. If positive, influence fades linearly to zero at this radius. If omitted, zero, or negative, the implementation uses an infinite radius. |

The attractor is applied to **occupied grid nodes** during grid velocity update, not directly to each particle. The code uses a distance-based falloff with a small `0.01` offset to avoid division by zero.

### `grid_hook(x, y, grid, k)`: customize grid-node velocity

The optional callback is invoked for each grid node with positive mass, after gravity and attractor handling but before built-in boundary constraints.

```js
sim.grid_hook = (x, y, grid, k) => {
  // x and y are normalized node coordinates; y increases upward.
  // grid[k] is vx, grid[k + 1] is vy, grid[k + 2] is mass.
  if (x > 0.45 && x < 0.55 && y < 0.5) {
    grid[k + 1] += 2; // example: add upward velocity
  }
};

// Disable custom grid logic:
sim.grid_hook = null;
```

Important details:

- Callback arguments are `(x, y, grid, k)`.
- `grid` is the simulation's flat `Float64Array`; `k` is the offset of that node's 3-value record.
- The hook should generally modify only `grid[k]` and `grid[k + 1]`; `grid[k + 2]` stores node mass.
- The source applies boundary constraints after the hook, so boundary rules can override a velocity change.
- The callback runs inside the hot simulation loop. Keep it fast.
- Avoid calling `advance()` recursively from inside the hook. The implementation reuses module-level scratch buffers, so re-entrant simulation stepping can interfere with an active step.

### Pointer-to-simulation conversion

`MLSMPM.pointer(event, canvas)` converts a pointer/mouse event into normalized simulation coordinates.

```js
canvas.addEventListener('pointermove', (event) => {
  const [x, y] = MLSMPM.pointer(event, canvas);
  sim.attractor = { x, y, strength: 25, radius: 0.3 };
});

canvas.addEventListener('pointerleave', () => {
  sim.attractor = null;
});
```

It uses `canvas.getBoundingClientRect()` and returns:

```js
[
  (event.clientX - rect.left) / rect.width,
  1 - (event.clientY - rect.top) / rect.height
]
```

This maps the pointer to the displayed canvas rectangle, with y flipped to match simulation coordinates. It does not itself check whether the pointer is inside the simulation box.

## Static helpers

These are static properties of the class, not instance methods.

### Material constants and version

```js
MLSMPM.version; // "1.0.0"
MLSMPM.SNOW;    // 0
MLSMPM.JELLY;   // 1
MLSMPM.WATER;   // 2
```

### `MLSMPM.svd(m, U?, sig?, V?)`

Computes a 2×2 singular value decomposition for a row-major matrix `m` and returns `{ U, sig, V }`, representing `m = U * diag(sig) * Vᵀ`.

```js
const result = MLSMPM.svd([1, 0, 0, 2]);
console.log(result.U, result.sig, result.V);
```

- `m`: four numbers in row-major order `[m00, m01, m10, m11]`.
- `U`: optional output array of four numbers; allocated as a regular array by default.
- `sig`: optional output array of two singular values; allocated as a regular array by default.
- `V`: optional output array of four numbers; allocated as a regular array by default.
- Returns references to the output arrays in `{ U, sig, V }`.
- The values are sorted so `sig[0] >= sig[1]`; the second singular value can be negative for an inverted matrix, as noted in the source.

You can pass reusable output arrays when calling this repeatedly to reduce allocations.

### `MLSMPM.polar_decomp(m, R?, S?)`

Computes a 2×2 polar decomposition `m = R * S`, where `R` is the rotation matrix and `S` is the corresponding symmetric factor, using the implementation's closed-form formula.

```js
const result = MLSMPM.polar_decomp([1, 0, 0, 1]);
console.log(result.R, result.S);
```

- `m`: four numbers in row-major order.
- `R`, `S`: optional output arrays of four numbers each.
- Returns `{ R, S }` and mutates the provided output arrays when supplied.

These helpers are primarily useful for testing, diagnostics, or custom material-model work; ordinary simulations do not need to call them directly.

## Common recipes

### Create a three-material comparison

```js
const sim = new MLSMPM({ seed: 7 });

sim.add_object([0.25, 0.75], 0xE7F5FF, {
  size: [0.09, 0.06], material: 'snow'
});
sim.add_object([0.50, 0.75], 0xFF78B7, {
  size: [0.09, 0.06], material: 'jelly'
});
sim.add_object([0.75, 0.75], 0x61CBFF, {
  size: [0.09, 0.06], material: 'water'
});
```

### Make a repeatable scene

```js
const sim = new MLSMPM({ seed: 12345 });
```

The seed controls `add_object()`'s random particle placement. The same seed and same sequence of setup calls produce repeatable initial samples, provided the runtime behavior remains the same.

### Start with a chosen initial velocity

```js
sim.add_object([0.5, 0.8], 0xF4E18A, {
  size: 0.07,
  velocity: [2, -1],
  material: 'jelly'
});
```

The same initial velocity is assigned to all particles in the block.

### Use custom resolution and manually inspect timing

```js
const sim = new MLSMPM({ n: 120, frame_dt: 1 / 60 });
console.log('dx:', sim.dx);
console.log('dt:', sim.dt);
console.log('substeps/frame:', sim.steps_per_frame);
```

Since the default `dt` depends on `n`, increasing grid resolution increases the default number of substeps per frame. The auto particle count for `add_object()` also scales approximately with `n²`, so higher resolution can become much more expensive.

### Change rendering style

```js
sim.render(canvas, {
  background: 0x101820,
  box: 0xE0E7EE,
  radius: 2.5
});

// Transparent background and no box outline:
sim.render(canvas, { background: null, box: null, radius: 2 });
```

### Reset and repopulate

```js
sim.clear();
sim.add_object([0.5, 0.7], 0xFFFFFF, { material: 'snow' });
```

`clear()` resets active particles and time but preserves the current configuration and allocated capacity.

## Performance and tuning

1. **Particle count dominates cost.** Each particle participates in both transfer phases and touches a 3×3 neighborhood of grid nodes.
2. **Grid resolution affects multiple costs.** Grid storage grows with approximately `n²`; default time step shrinks with `n`; and automatically calculated object particle counts scale with `n²`.
3. **Set `count` explicitly when needed.** For scenes with many objects or high `n`, explicit `options.count` prevents the automatic density rule from producing more particles than expected.
4. **Preallocate with `reserve()`.** If the final particle count is known, reserve enough capacity before creating particles to reduce growth copies.
5. **Keep `grid_hook` lightweight.** It runs once for each occupied grid node on each substep.
6. **Reuse a simulation instance.** `clear()` allows scene resets without throwing away the typed-array capacity.
7. **Avoid excessively large `dt`.** The source does not add adaptive time stepping or automatic stability checks.
8. **Keep rendering dimensions reasonable.** `render()` writes a full `ImageData` buffer and stamps each visible particle into that buffer every frame.
9. **Do not over-interpret `frame_dt`.** Actual time advanced per call is `steps_per_frame * dt`, with `steps_per_frame` rounded and clamped to at least one.

The implementation uses typed arrays for persistent particle/grid data and reusable scratch buffers in the hot `advance()` path. Some API calls still allocate regular objects or arrays: for example, `get_particle()` creates a new object and new small arrays.

## Troubleshooting and gotchas

| Symptom / mistake | Explanation / fix |
|---|---|
| `MLSMPM is not defined` | Make sure the script has loaded before the code that uses it, and use a classic script tag as shown above. The file does not use an ES-module `export` statement. |
| `unknown material "sand"` | Only `snow`, `jelly`, and `water` string names are supported. |
| Object is twice the expected size | `size` means half-extents. `size: 0.08` gives a full width/height of about `0.16`. |
| Particles appear in the wrong vertical direction | Simulation coordinates use y-up; DOM pointer coordinates use y-down. Use `MLSMPM.pointer()` for mouse/pointer input. |
| A particle color is wrong or ignored | Supply an integer RGB value such as `0xFF8844`, not a CSS string such as `"#ff8844"`. |
| `get_particle(i)` returns unexpected values | Check that `i` is a valid active index (`i < num_particles`). The method does not validate it. |
| `advance_frame()` moves by a slightly different amount of time than `frame_dt` | The number of steps is rounded; actual time per call is `steps_per_frame * dt`. |
| A `grid_hook` velocity change appears to be ignored | The hook runs before boundary constraints, so the built-in wall handling can override it. |
| Rendering stretches the scene | Use a square canvas for square simulation coordinates; the renderer scales x and y independently. |
| Performance drops after increasing `n` | Grid storage scales as `(n + 1)²`; default particle count per object and steps per frame can also rise with resolution. |
| Calling a step inside `grid_hook` causes odd results | Do not re-enter `advance()` from the hook; scratch buffers are shared by calls to the module. |

## API quick reference

| API | Purpose | Return value |
|---|---|---|
| `new MLSMPM(options?)` | Create a simulation and allocate initial buffers. | `MLSMPM` instance |
| `sim.add_particle([x, y], color?, options?)` | Add one particle. | New particle index |
| `sim.add_object([x, y], color?, options?)` | Add a randomly sampled rectangle of particles. | First added particle index |
| `sim.get_particle(i)` | Snapshot one particle's state. | Object with `x`, `v`, `F`, `C`, `Jp`, `c`, `material` |
| `sim.reserve(capacity)` | Ensure capacity for at least this many particles. | `sim` |
| `sim.clear()` | Remove active particles and reset clock/grid. | `sim` |
| `sim.advance(dt?)` | Run one simulation substep. | `sim` |
| `sim.advance_frame()` | Run `steps_per_frame` substeps. | `sim` |
| `sim.render(canvasOrContext, options?)` | Draw background, box, and particles. | `sim` |
| `sim.steps_per_frame` | Get substep count per visual frame. | Number |
| `sim.mu_0`, `sim.lambda_0` | Read derived base material parameters. | Number |
| `sim.attractor = { x, y, strength, radius? }` | Apply an attraction/repulsion influence to grid velocities. | Set property |
| `sim.grid_hook = (x, y, grid, k) => {}` | Customize occupied grid-node velocities. | Set property |
| `MLSMPM.pointer(event, canvas)` | Convert a DOM pointer event to normalized y-up coordinates. | `[x, y]` |
| `MLSMPM.svd(m, U?, sig?, V?)` | 2×2 SVD helper. | `{ U, sig, V }` |
| `MLSMPM.polar_decomp(m, R?, S?)` | 2×2 polar decomposition helper. | `{ R, S }` |

## Implementation notes and attribution

The source identifies itself as a high-performance vanilla-JavaScript port of `mls-mpm88.cpp` from [yuanming-hu/taichi_mpm](https://github.com/yuanming-hu/taichi_mpm), based on the SIGGRAPH 2018 paper *A Moving Least Squares Material Point Method with Displacement Discontinuity and Two-Way Rigid Body Coupling* by Yuanming Hu, Yu Fang, Ziheng Ge, Ziyin Qu, Yixin Zhu, Andre Pradhana, and Chenfanfu Jiang.

The source header states that the original 88-line C++ code is MIT-licensed and that this JavaScript port is also MIT-licensed. Keep the applicable license notice with redistributed copies.
