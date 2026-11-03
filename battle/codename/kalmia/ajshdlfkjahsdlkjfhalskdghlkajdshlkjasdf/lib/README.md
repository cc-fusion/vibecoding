# MPM.js — the JavaScript conversion of the original React/TypeScript app

The original project (`i-opus-55-max.zip`) was a React + TypeScript + Vite
application wrapping the `taichi_mpm` full solver (C++ → WebAssembly).
This package is the **complete conversion to dependency-free JavaScript**,
restructured as a **library** that is loaded with a single `<script>` tag.

## What changed

| Original (React / TS)                    | Converted (plain JS)                          |
|------------------------------------------|-----------------------------------------------|
| `src/sim/engine.ts`                      | `src/01-engine.js` — WASM host + solver classes |
| `src/sim/scenes.ts`                      | `src/02-scenes.js` — 10 scenes + declarative compiler |
| `src/sim/worker.ts`                      | `src/03-host.js` — `SimHost` (worker **or** main thread) |
| `src/render/renderer.ts`                 | `src/04-renderer.js` — WebGL2 renderer        |
| `src/App.tsx` + `src/main.tsx` (React UI)| `src/05-simulation.js` — public `MPM.Simulation` API |
| `src/sim/wasm/mpmWasm.ts` (base64)       | `src/06-data.js` (embedded WASM, unchanged)   |
| Vite worker (`new Worker(import.meta…)`) | self-spawning Blob worker from the library's own source |
| scenes editable only in source           | declarative scenes, `setup(ctx)` scripts, `MPM.registerScene`, full runtime API |

All TypeScript types, React components, JSX and build-tool imports were
removed. The WASM solver itself is byte-identical.

## Build

```bash
./build.sh          # concatenates src/*.js -> mpm.js (single file)
```

## Use

```html
<script src="mpm.js"></script>
<div id="sim" style="width:640px;height:480px"></div>
<script>
  const sim = MPM.create('#sim', { scene: 'sand-wheel', loop: true });
  sim.addWheel({ center: [0.3, 0.6], mode: 'motor', speed: 160 }); // live!
  sim.setPointer({ mode: 'push' });                                // touch!
</script>
```

See `example.html` for a complete framework-free page and `docs.md` for the
full API (scenes without source edits, runtime modification, pointer tools,
sources, wheels, articulations, events, performance).

MIT licensed. Solver: taichi_mpm by Yuanming Hu.
