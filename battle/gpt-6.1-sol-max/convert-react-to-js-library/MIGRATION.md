# JavaScript Migration

## What Changed

The supplied `i-opus-55-max.zip` has been repackaged as `mpm-js-1.0.0.zip`.

The TypeScript engine, ten scene definitions, worker, renderer, embedded WASM module, and native scene test were transpiled to readable ES2022 `.js` files. Type-only imports, interfaces, annotations, parameter properties, and assertions were removed. Relative imports now have explicit `.js` extensions.

The original React/TSX control application and its TypeScript entry point were replaced by the framework-free `examples/app.js` and `examples/index.html`. There are no React imports, JSX files, TypeScript files, type declarations, Tailwind dependencies, or bundler requirements in the downloadable JavaScript library. The documentation website is a separate React application; its hosting entry point is not included in the library archive.

`src/mpm.js` is the new public library entry point. It retains the original WebAssembly engine and renderer and adds declarative scenes, direct user callbacks, validated high-level materials, frame-boundary mutations, live gravity/configuration controls, automatic wheels, and pointer-event pouring. Both classic-script and ES-module distributions are included with all WASM data embedded.

The original native C++ source is preserved unchanged. Native build/test helper paths now point to the converted JavaScript modules. The original scalar/SIMD WebAssembly payloads are preserved unchanged. The original solver's lower-level behaviors, limitations, numerical characteristics, and native build requirements still apply.

## Runtime Architecture

The original React UI used an inline Web Worker and a fixed scene registry. The new library advances the same solver in short main-thread animation-frame batches. This permits page-defined setup/update callbacks and runtime object handles without serializing functions, editing a registry, or evaluating strings. Heavy scenes may still reduce page responsiveness; lower resolution and particle density when needed.

The converted worker is preserved in `src/core/worker.js` as an advanced reference, but it is not started by the new public API. A worker-based integration would need its own message protocol for custom user data.

## Compatibility

All ten original scene IDs remain available via `MPM.scenes` and `sim.loadScene(id)`. The original Python-like solver API is exported as `MPM.Solver`, with its snake_case methods intact. The old React UI and its internal worker messages are not the public API of the new library.

Native source was not recompiled as part of this JavaScript conversion. Existing native solver tests were converted to JavaScript. Licensing provenance and upstream links are recorded in `UPSTREAM.json` and `DOCUMENTATION.md`.
