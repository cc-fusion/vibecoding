# Source and conversion notes

Original project: https://github.com/cc-fusion/vibecoding/tree/main/claude-fable-5-1/browser-based-multi-language-ide%202

Repository commit inspected: `3776b79a13c61a7da5e14c1855b85ac4d100e5ba`.

The original used React only as a mount point. Its framework-independent TypeScript managers and CSS were retained and converted to readable native JavaScript modules. The new project has no React, JSX, TypeScript application sources, Vite, Tailwind, bundling requirement, or compilation backend. The application starts from `index.html`, `styles.css` and `js/main.js`.

## Conversion work

- Replaced the React mount with direct DOM initialization.
- Removed TypeScript annotations/interfaces and added explicit `.js` module specifiers.
- Replaced Vite `?raw` worker imports with standard `fetch` + Blob workers.
- Preserved the original layout, themes, Monaco editor, explorer, tabs, diagnostics, autosave, preview and keyboard shortcuts.
- Added a dependency-free Node static server, automated tests, runtime fixes and documentation.

## Runtime defects found and fixed by actual browser testing

1. **AssemblyScript:** the original esm.sh import loaded a Node shim and failed with `module.require is not implemented`. Bundled the published browser-compatible AssemblyScript/Binaryen/Long ESM assets and resolved their imports locally.
2. **C#:** the original CDN path pointed into the package's source/build directory, not its published runtime. Bundled the published WasmSharp assets; replaced bundler-only binary imports with native URL references and pinned/bundled Comlink.
3. **C# initialization:** .NET mistook the existing worker message handler for a pthread and waited indefinitely. Explicitly marks the worker as a .NET sidecar before initialization.
4. **C# execution:** upstream WasmSharp always passed `string[]` into `Main`, including parameterless `Main`, and marked compilation success as execution success. A Roslyn-compiled launcher now invokes the original, unmodified user assembly with the correct parameter list and returns real runtime exceptions/nonzero exit codes. Top-level statements and multi-file projects are tested as well.
5. **Java:** CheerpJ's origin-specific CDN cache messaging and persistent IndexedDB are incompatible with an opaque-origin sandbox. Uses CheerpJ's direct downloader and a fresh in-memory IndexedDB implementation **inside** that sandbox; no `allow-same-origin` relaxation.
6. **Java compiler archive:** the upstream archive endpoint did not expose the Content-Range headers expected by CheerpJ. Download the complete archive and mount it in the runtime's in-memory `/str/` filesystem instead.
7. **Python:** deleted files survived in the warm Pyodide filesystem. Synchronize deletions and invalidate import caches; disable project bytecode caching so same-size edits are visible on repeated runs.
8. **Editor diagnostics:** create project TypeScript models before initial validation, so unopened imported modules are available to Monaco.
9. **Lifecycle:** do not dispose the editor when a page is retained in the browser back/forward cache.

No original ownership or license rights are claimed by this conversion. No standalone license was found in the reviewed original project directory or at the repository root. Consult the original owner regarding source redistribution/use permissions. Third-party runtimes have their own licenses; see `THIRD_PARTY.md`.
