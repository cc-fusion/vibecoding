# Forge IDE — a browser-only multi-language IDE

A desktop-style IDE that runs entirely inside a normal browser tab: real **Monaco Editor**, a virtual
project filesystem persisted to **IndexedDB** with automatic debounced autosave, and isolated
in-browser execution for **JavaScript**, **TypeScript**, **Python (Pyodide)**, **AssemblyScript → WebAssembly**
and **HTML preview**. There is no application backend of any kind: nothing you type is ever sent to a server.

## Prerequisites

* Node.js ≥ 18 and npm (only for building/serving the static bundle)
* A modern browser (Chrome/Edge ≥ 100, Firefox ≥ 114, Safari ≥ 16) with internet access on first run so the
  pinned static runtime assets (Monaco, Pyodide, AssemblyScript compiler) can be downloaded from their CDNs

## Commands

```bash
npm install          # install build tooling (Vite)
npm run dev          # static dev server with hot reload → http://localhost:5173
npm run build        # production build → dist/index.html (a single self-contained static file)
npm run preview      # serve the production build statically
```

Any static file server can serve `dist/` — the server only delivers files; it performs no compilation,
execution, persistence or IDE logic. (The build uses `vite-plugin-singlefile`, which is why execution
workers are created from in-bundle Blob URLs and heavy runtimes come from pinned CDN URLs.)

## Browser-runtime dependencies (all client-side, pinned)

| Dependency | Version | Loaded from | Used for |
| --- | --- | --- | --- |
| Monaco Editor (AMD build) | 0.52.2 | `cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min` | editor, language services, **TypeScript compiler** (hosted in Monaco's TS worker) |
| Pyodide | 0.27.7 | `cdn.jsdelivr.net/pyodide/v0.27.7/full/` | CPython in a Web Worker (lazy) |
| AssemblyScript `asc` (+ binaryen) | 0.27.31 | `esm.sh/assemblyscript@0.27.31/dist/asc.js` | AssemblyScript → WebAssembly compiler in a Web Worker (lazy) |

The `monaco-editor` entry in `package.json` is only there for TypeScript type information during development; the
runtime always uses the pinned CDN build so the bundle stays a small static file.

## Which compiler adapters are bundled

| Language | Status | Where it runs |
| --- | --- | --- |
| JavaScript | ✅ bundled | dedicated Web Worker with a tiny CommonJS loader (multi-file `require`) |
| TypeScript | ✅ bundled | project-wide compile in Monaco's TypeScript worker → emitted JS runs in the JS worker |
| Python | ✅ bundled (lazy) | Pyodide inside a module Web Worker; project `.py` files are written to its FS |
| AssemblyScript | ✅ bundled (lazy) | `asc` compiler worker → `.wasm` instantiated in a separate WebAssembly worker |
| HTML / CSS / JS pages | ✅ bundled | sandboxed `<iframe sandbox="allow-scripts allow-modals allow-forms">` (no `allow-same-origin`) |
| C / C++ | ⛔ adapter boundary only | requires local browser assets (see below) — reports "not installed", never fakes success |
| C# | ⛔ adapter boundary only | requires local browser assets (see below) |
| Java | ⛔ adapter boundary only | requires local browser assets (see below) |

### Enabling C/C++, C#, Java (browser-side only)

`src/ide/runners/BrowserToolchainRunners.ts` defines `BrowserToolchainProvider` and a `ToolchainRegistry`.
A provider must download/instantiate its compiler **as local static assets inside a Worker** and both compile
and execute there. Register it with `ToolchainRegistry.register("<cpp|csharp|java>", provider)` before the
IDE starts. Required assets:

* **C/C++**: `clang` + `wasm-ld` compiled to WebAssembly, a wasm32 sysroot (libc/libc++ headers + libraries,
  e.g. wasi-libc/libc++ for `wasm32-wasi`), and a WASI-capable in-Worker runtime to execute the linked module.
* **C#**: the .NET runtime built for WebAssembly (`dotnet.js`/`dotnet.wasm` + framework assemblies),
  Roslyn (`Microsoft.CodeAnalysis.CSharp`) plus reference assemblies, and an in-Worker host that loads the emitted
  assembly and captures `Console` output.
* **Java**: a browser-executable Java compiler (e.g. `javac`/`ecj` compiled with TeaVM to JS/WebAssembly),
  a browser-executable JVM/bytecode interpreter or Java→WebAssembly pipeline, and the class-library subset.

There is intentionally **no HTTP/remote compilation abstraction** anywhere in the codebase.

## Architecture

```
src/App.tsx                 React mount point only (the scaffold requires it); mounts IDE once
src/ide/IDE.ts              Composition root: creates managers, wires events, startup sequence
src/ide/core/               EventEmitter, path utilities, single language/extension registry, static icons
src/ide/project/
  ProjectManager.ts         In-memory virtual filesystem (files/dirs, nested ops, rename/move, duplicate)
  PersistenceManager.ts     IndexedDB store + debounced autosave queue + save-state machine
  defaultProject.ts         Example project created on first launch
src/ide/state/
  SettingsManager.ts        Persistent settings (localStorage)
  UIStateManager.ts         Explicit UI state (tabs, active file, panels, preview, run state…)
src/ide/editor/
  monacoLoader.ts           Pinned CDN AMD loader + cross-origin worker proxy
  EditorManager.ts          One Monaco model per file, view-state preservation, themes, AS language
  TabManager.ts             Tab strip (state lives in UIState)
src/ide/runners/
  types.ts                  LanguageRunner / RunContext / Diagnostic contracts
  RunnerManager.ts          runFile / runProject / buildProject / stop, adapter selection
  WorkerHost.ts             Blob-URL Web Worker sessions
  JavaScriptRunner.ts       Isolated JS execution (worker per run)
  TypeScriptCompiler.ts     Browser TypeScript compiler service (Monaco TS worker, project-wide program)
  TypeScriptRunner.ts       tsc diagnostics → Problems/Build → run emitted JS in the JS worker
  PythonRunner.ts           Pyodide worker (lazy, warm between runs, terminated by Stop)
  AssemblyScriptRunner.ts   asc compiler worker → wasm execution worker
  BrowserToolchainRunners.ts ClangRunner / CSharpRunner / JavaRunner adapter boundaries + registry
src/ide/workers/*.js        Worker sources (imported as raw strings, spawned via Blob URLs)
src/ide/output/
  OutputManager.ts          Output / Terminal (IDE command console) / Problems / Build panel
  DiagnosticsManager.ts     Merges Monaco markers + compiler/runtime diagnostics; click-to-navigate
src/ide/preview/PreviewManager.ts  Sandboxed iframe preview with virtual-resource inlining
src/ide/ui/                 Shell (layout, menus, resizers), Explorer, QuickOpen, SettingsPanel,
                            StatusBar, Shortcuts, overlays (context menu, dialogs, toasts)
src/index.css               CSS-variable theme system (dark / dimmed / light) and layout
```

Boundaries are event-driven: `ProjectManager` emits `created/deleted/renamed/contentChanged`;
`PersistenceManager`, `EditorManager`, `TabManager`, `Explorer`, `PreviewManager` and `DiagnosticsManager`
subscribe independently. UI is rendered from `UIStateManager`, never derived from DOM classes.

## Autosave / persistence architecture

1. Every Monaco model change immediately updates the virtual filesystem (`ProjectManager.updateContent`).
2. `PersistenceManager` marks the path dirty and (re)starts a debounce timer (default 600 ms, configurable
   150–3000 ms in Settings; autosave itself cannot be disabled).
3. When the timer fires, all dirty paths are written in one IndexedDB transaction (`forge-ide` DB, `nodes` store).
4. State transitions `editing → saving → saved` (or `error`) are shown in the status bar and as per-tab dots.
   Failures are surfaced as a red "Save Error" state plus a toast/Output line — never hidden.
5. Structural operations (create/rename/delete) are written immediately; delete/rename flush pending writes
   first so no queued write can resurrect a removed path. Deleting a file/folder asks for confirmation.
6. `visibilitychange` (hidden) and `pagehide` flush pending writes. No `beforeunload` dialogs are used.
7. Settings and UI layout (tabs, active file, panel sizes, preview state) persist in `localStorage`.

Closing a tab never loses edits: the content is already in the virtual filesystem and queued for persistence.
There is no Save / Save All command and Ctrl/Cmd+S is not intercepted.

## Security / isolation architecture

* User code **never** executes in the IDE window. JavaScript/TypeScript output, Python and WebAssembly run in
  dedicated Web Workers created from Blob URLs; Stop calls `worker.terminate()`.
* HTML preview runs in an `<iframe sandbox="allow-scripts allow-modals allow-forms">` via `srcdoc`
  (opaque origin, no access to the parent window, IndexedDB or localStorage). Project CSS/JS/images are
  inlined from the virtual filesystem; page-to-page links are routed back through `postMessage`.
* All compiler/runtime/user text is rendered with `textContent`. `innerHTML` is only used for static,
  source-authored SVG icons.
* No `eval`/`new Function` in the IDE window (the JS *worker* uses the Function constructor by design,
  because that is the sandbox).
* Blob URLs are revoked after worker start; preview documents are regenerated per refresh.
* File names are validated (`< > : " | ? *`, control characters, `.`/`..`) and paths normalized.
* No network calls carry user source. Network is used only to fetch the pinned static runtimes above.

## Keyboard shortcuts

`Ctrl/Cmd+P` Quick Open · `Ctrl/Cmd+F` Find · `Ctrl/Cmd+H` Replace · `Ctrl/Cmd+B` Sidebar ·
`Ctrl/Cmd+J` Bottom panel · `Ctrl/Cmd+Enter` Run current file · `F5` Run project · `F2` Rename (explorer) ·
`Esc` close overlays / exit full-screen preview.

## Known limitations

* Renaming a file recreates its Monaco model under the new URI (Monaco URIs are immutable), so undo history
  does not survive a rename; cursor/scroll state does.
* Stopping Python terminates the Pyodide worker; the next Python run re-initializes the runtime.
* The Terminal tab is an IDE command console (`help`, `ls`, `cat`, `run`, `build`, …), not an OS shell.
* Runtime error line numbers for JS/TS are derived from worker stack traces (accurate on V8/SpiderMonkey).
