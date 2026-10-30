# MPM Studio — combined browser implementation

A framework-free browser library and playground for the supplied MLS-MPM + CPIC WebAssembly solver. It combines the useful parts of Kalmia, 6.1, and Raichu:

- **Worker-first runtime** with automatic main-thread fallback when workers are unavailable or fail before initialization.
- **JSON scenes** for portable, declarative setups.
- **JavaScript ES-module scenes** loaded inside the simulation execution context.
- **Inline JavaScript scenes** in the playground, loaded as Blob ES modules rather than `eval()` or function-to-string reconstruction. Inline scripts are trusted executable code, not sandboxed.
- **Emitters, wheels, rigid bodies, articulations, and custom level sets**.
- **Live interaction API** for pointer, touch, keyboard, runtime object creation, physics controls, and low-level solver actions.
- **Vanilla HTML/CSS/JavaScript playground and documentation**. No React, TypeScript, bundler, CDN, or npm dependencies are required.
- **No native C++ source** in the distribution. The existing precompiled SIMD and scalar WASM solver binaries are retained.

## Run locally

Requires Node.js 18+ or any static web server.

```sh
npm run dev
```

Open `http://localhost:5173`. No `npm install` is necessary. For a production-ready static folder:

```sh
npm run build
npm run preview
```

The browser library entry point is `public/taichi-mpm.mjs` (served at `/taichi-mpm.mjs`). The complete API guide is `docs.html`; a runnable one-page example is `public/examples/quickstart.html`.

## Quick start

```html
<div id="simulation" style="height:520px"></div>
<script type="module">
  import * as TaichiMPM from './taichi-mpm.mjs';
  const sim = await TaichiMPM.create({
    container: '#simulation',
    scene: 'water-wheel-2d',
    autoPlay: true,
    quality: 'medium'
  });
  sim.on('error', console.error);
</script>
```

## JavaScript scenes

Preferred: a separate ES module exporting `metadata` and `setup(ctx)`:

```js
export const metadata = { id: 'demo', name: 'Demo', dim: 2 };
export function setup(ctx) {
  const mpm = ctx.createMPM({ resolution: 160, gravity: [0, -9.81] });
  const field = ctx.tex.sphere([0.5, 0.7, 0.5], 0.1).mul(4);
  mpm.add_particles({ type: 'water', density: 1000, density_tex: field });
  return {
    mpm,
    update(t, dt, api) {
      // Worker-side custom behavior; API calls stay inside the worker.
    }
  };
}
```

Load it with:

```js
await sim.loadSceneModule('./scenes/demo.js', { autoPlay: true });
```

Inline source uses the same module contract:

```js
await sim.loadInlineScene(sourceText, {}, { autoPlay: true });
```

Inline scripts are not sandboxed. Only run code you trust. The implementation imports Blob module source and does not invoke `eval()`.

## Runtime interaction

```js
sim.setInteraction({ mode: 'custom', forwardToScene: true });
sim.on('interact', ({ position }) => {
  sim.emitParticles(position, [0, 0.5], 'water');
});
// A scene module can also export onMessage(name, payload, api) to
// handle forwarded pointer/keyboard input beside the solver in its worker.
sim.on('keydown', ({ key, originalEvent }) => {
  if (key === ' ') {
    originalEvent.preventDefault();
    sim.running ? sim.pause() : sim.play();
  }
});

await sim.addParticles({ material: 'jelly', shape: 'sphere', center: [0.5, 0.8], radius: 0.06 });
await sim.addWheel({ center: [0.65, 0.3], radius: 0.12, blades: 8 });
await sim.addEmitter({ material: 'water', shape: 'sphere', center: [0.5, 0.9], radius: 0.02, velocity: [0, -1] });
```

## JSON capabilities

Scene JSON accepts `particles`, `rigid`, and `emitter` objects. Materials include `water`, `jelly`, `snow`, `sand`, `von_mises`, and `elastic`. Rigid shapes include boxes, blades, circles and wheels; wheels can use scripted motion. Custom `levelset` specs accept planes, boxes, spheres, cylinders, and 2D polygons. See `docs.html` for full examples and schema notes.

## Tests

```sh
npm test
```

The engine test advances every built-in scene and checks finite particle positions. The integration test covers the main-thread runtime adapter, JSON level-set validation, ES-module loading, and WASM-backed frame export. Browser performance and numerical accuracy still require tests on the target browser/device and workload.

## Scope

This package intentionally excludes native C++ source. It ships the precompiled SIMD and scalar WASM solver variants with the JavaScript host. The regular frame export is for rendering/statistics; it is not a general writable per-particle state interface. Worker fallback maintains API compatibility but can reduce UI responsiveness for large scenes.
