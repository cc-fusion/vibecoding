# Forge IDE — vanilla HTML, CSS and JavaScript

A build-free conversion of the linked browser-based multi-language IDE. The interface uses native DOM APIs and ES modules; **no React, TypeScript build, Vite, or application backend is required**. Monaco and real browser-based compilers/runtimes are retained.

## Run it

Extract the ZIP, then open a terminal in `forge-ide/`:

```sh
node server.mjs
```

Open **http://localhost:5173**. Node.js 18+ is sufficient. **You do not need `npm install` to run the IDE.**

Alternatively, use any ordinary static web server, for example:

```sh
python3 -m http.server 5173
```

Serve the **whole folder**, including `js/` and `vendor/`. Do not double-click `index.html`: browsers restrict ES modules/workers on `file://` URLs. For a public deployment use HTTPS, correct JavaScript/WASM MIME types, and avoid blocking the external runtime domains below with CSP or embedding policies.

The included server binds to `0.0.0.0` for preview compatibility. It only delivers static files and performs **no compilation or execution**. Set `PORT=8080` to change its port.

## Languages and verified behavior

| Language | Actual browser runtime | Verified example |
|---|---|---|
| JavaScript | dedicated Web Worker, CommonJS project loader | `fib(20) = 6765` |
| TypeScript | Monaco's TypeScript compiler → JavaScript worker | multi-file sensor summaries |
| Python | Pyodide / CPython WebAssembly | distance `5.0`, primes; imports and edits |
| AssemblyScript | bundled `asc` → WebAssembly | `fib(30) = 832040`, return value `42` |
| C | Clang/LLD → WASI WebAssembly | `factorial(6) = 720` |
| C++ | Clang/LLD → WASI WebAssembly | `sum = 15` |
| C# | Roslyn / .NET WebAssembly (WasmSharp) | `squares: 1, 4, 9, 16, 25` |
| Java | Java 8 `javac` / CheerpJ in a sandboxed iframe | `total = 55` |
| HTML + CSS + JS | sandboxed live preview | rendered styles, click counter, navigation, auto-refresh |

CSS, JSON, Markdown and plain text have editor support; they are not standalone executable languages. CSS is exercised by the HTML preview. All 13 registered editor modes are tested.

Click a file in the explorer, then **Run**. **Build** compiles TypeScript, AssemblyScript, C/C++, C# and Java without executing their entry points. **Stop** terminates the active runtime. First runs can be much slower than subsequent runs.

## Preserved features

- Monaco editor, syntax highlighting, find/replace, completion and per-file models.
- Nested file/folder explorer, create/rename/delete/duplicate, tabs and Quick Open.
- IndexedDB autosave; settings and layout in localStorage.
- Dark, dimmed and light themes; adjustable panels and split preview.
- Output, Build, Problems and an IDE command console (`help`, `ls`, `cat`, `run`, `build`, etc.).
- Sandboxed HTML/CSS/JS preview with project-relative resources and navigation.
- Real multi-file execution/compilation and compiler/runtime diagnostics.

**Shortcuts:** Ctrl/Cmd+P Quick Open; Ctrl/Cmd+Enter Run; F5 Run project; Ctrl/Cmd+B Sidebar; Ctrl/Cmd+J Panel; Ctrl/Cmd+F Find; Ctrl/Cmd+H Replace; F2 explorer Rename; Esc close overlays.

## Tests

Development dependencies are needed **only to rerun the tests**:

```sh
npm ci
npx playwright install chromium
# On a fresh Linux machine, if browser libraries are missing:
# npx playwright install --with-deps chromium
npm run check
npm test
```

`npm test` runs Node unit tests followed by actual Chromium integration tests. Tests drive the real toolbar, runtimes, editor, preview and browser storage; they do not replace compilers with mocks or invoke native OS language interpreters.

See **`TEST_REPORT.md`** for the recorded results and scope. Machine-readable results and the test log are in `reports/`. The negative tests deliberately run invalid programs and check that errors are reported, then verify a corrected rerun.

Tests use port 5173 and a fresh browser context. They do not touch your normal browser's saved project. `IGNORE_HTTPS_ERRORS=1` is an optional test-only escape hatch for an intercepting-proxy environment; it is **not** an application setting or a production security recommendation.

## Internet and hosting requirements

AssemblyScript and C# assets are bundled in `vendor/`. These dependencies are downloaded on demand/from CDN:

- Monaco 0.52.2: `cdn.jsdelivr.net`
- Pyodide 0.27.7: `cdn.jsdelivr.net`
- LLVM 8 / WASI compatibility assets, pinned Git commit: `raw.githubusercontent.com/binji/wasm-clang`
- CheerpJ 4.3 and its Java 8 runtime: `cjrtnc.leaningtech.com`
- Java compiler archive: `javafiddle.leaningtech.com/tools.jar` (the upstream URL is not versioned)
- The retained optional modern C/C++ path, selected on cross-origin-isolated hosts, uses Wasmer SDK 0.10.0 from `unpkg.com` and the Wasmer package registry.

Internet access is required; this is **not an offline-complete ZIP**. Browser caching can reduce repeated downloads but is not an offline guarantee. The normal supplied static server does **not** enable COOP/COEP; the verified C/C++ engine is the LLVM 8 compatibility path (C17/C++17). The optional Wasmer/C++20 path is retained from upstream but is **not part of the recorded test claim**.

## Limits and security

- The supplied examples and regression scenarios passed in the recorded Chromium environment. This is not proof that every program, browser, or future CDN response will be error-free.
- JavaScript Run supports ordinary scripts and CommonJS `require`; it is not a Node.js process and does not supply Node built-ins, npm resolution, JSX transforms or general native ESM project loading. Browser DOM code belongs in HTML preview.
- Python packages must be compatible with Pyodide. No desktop processes or native extensions outside that environment.
- C/C++ use a browser/WASI toolchain, not the host OS. The verified path targets C17/C++17.
- C# uses WasmSharp's **trimmed** .NET libraries, not a full desktop .NET SDK or arbitrary NuGet environment. Some APIs and async/blocking scenarios are unavailable. Synchronous entry points, top-level statements, multiple files, exceptions and nonzero exit codes are covered by tests; arbitrary asynchronous entry points are not claimed as supported.
- Java compilation targets Java 8. Runtime files/classes live in a fresh sandbox filesystem, not your computer's disk. Source files themselves persist in the IDE's IndexedDB.
- Console input is not interactive stdin; the Terminal tab is an IDE command console, not a system shell. Programs that wait for unsupported input may need Stop.
- HTML and Java run in opaque-origin sandboxed iframes. Worker-based runtimes cannot access the IDE's DOM, but same-origin workers **can** access network and browser storage. This is not a hardened environment for hostile code. Run trusted code only. User programs may make network requests of their own.
- No compilation endpoint receives source code. Downloading third-party runtimes still contacts their providers.
- Closing or deleting browser site data removes saved projects. There is no account/cloud sync.
- CheerpJ Community Edition is for personal/non-business use; other use requires an appropriate license. Review https://cheerpj.com/docs/licensing/ before deployment.

## Project map

```text
index.html                 Static entry page
styles.css                 Original theme/layout CSS
js/main.js                 Native JavaScript mount
js/IDE.js                  Application composition root
js/core/                   Events, language registry, path helpers and icons
js/project/                Virtual filesystem, IndexedDB persistence, examples
js/editor/                 Monaco loader, editor and tabs
js/runners/                Runtime adapters, compiler integration, lifecycle
js/workers/                Actual execution/compiler worker sources
js/preview/                Sandboxed HTML preview
js/output/                 Logs and diagnostics
js/state/                  Settings and UI state
js/ui/                     DOM-based shell, explorer, dialogs, settings
vendor/                    Browser-compatible third-party runtime assets
server.mjs                 Optional dependency-free static server
scripts/check.mjs          Syntax/import checks
tests/                    Node + Chromium regression tests
reports/                   Recorded results and desktop screenshot
```

See `docs/PROVENANCE.md` for upstream attribution and the bugs fixed during conversion, and `THIRD_PARTY.md` for runtime notices.
