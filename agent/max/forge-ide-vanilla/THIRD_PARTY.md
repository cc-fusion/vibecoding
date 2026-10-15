# Third-party runtime notices

The application UI is vanilla JavaScript. The following external libraries and runtime binaries are not claimed as original work of this conversion. Their licenses/terms remain applicable.

## Included in this ZIP

| Component | Version | License / notice location |
|---|---|---|
| AssemblyScript | 0.27.31 | Apache-2.0; `vendor/assemblyscript/assemblyscript-LICENSE` |
| Binaryen | 116.0.0-nightly.20240114 | Apache-2.0; `vendor/assemblyscript/binaryen-LICENSE` |
| Long.js | 5.3.2 | Apache-2.0; `vendor/assemblyscript/long-LICENSE` |
| WasmSharp | 0.10.2 | Apache-2.0; `vendor/wasmsharp/LICENSE` |
| .NET browser runtime and libraries | package-supplied .NET 10 preview assets | MIT; `vendor/wasmsharp/DOTNET-LICENSE`; preserve embedded notices |
| Comlink | 4.4.2 | Apache-2.0; `vendor/wasmsharp/COMLINK-LICENSE` |
| fake-indexeddb | 6.2.4 | Apache-2.0; `vendor/fake-indexeddb/LICENSE` |

WasmSharp also contains its published Roslyn and supporting .NET assemblies. Their upstream terms and notices apply (https://github.com/JakeYallop/WasmSharp, https://github.com/dotnet/runtime, https://github.com/dotnet/roslyn).

### Browser-compatibility modifications to included assets

- AssemblyScript `asc.js` and `assemblyscript.js`: bare imports resolve to adjacent bundled `binaryen.js`, `long.js` and `assemblyscript.js`. Otherwise published distribution code is retained.
- WasmSharp `dotnet.js`: imports of `.wasm`, `.dll` and `.dat` assets changed from bundler-only imports into `new URL(..., import.meta.url).href` expressions. This lets an ordinary static server serve the runtime without a build.
- WasmSharp modules: extensionless imports receive `.js`; Comlink resolves to the included version rather than an unpinned external URL. Inline source maps and TypeScript declaration files are omitted from this runtime-only distribution.
- fake-indexeddb: the published ESM library was bundled once as an IIFE (`vendor/fake-indexeddb.js`) to initialize an in-memory IndexedDB inside Java's opaque iframe without special host CORS headers. The application itself does not require a bundler.

## Downloaded by the browser, not redistributed here

- **Monaco Editor 0.52.2** — Microsoft, MIT: https://github.com/microsoft/monaco-editor
- **Pyodide 0.27.7** — Pyodide project, MPL-2.0 and underlying CPython/dependency licenses: https://github.com/pyodide/pyodide
- **wasm-clang**, commit `648c4a89997a351eef75cdaec3ef5b89d4937dec` — https://github.com/binji/wasm-clang and upstream LLVM/WASI terms.
- **Wasmer SDK 0.10.0 / clang registry package** — retained optional adapter; see https://github.com/wasmerio/wasmer-js and the relevant registry package terms. Not exercised by the supplied server's compatibility-mode tests.
- **CheerpJ 4.3** — Leaning Technologies. Community Edition is for personal/non-business use; other use requires a suitable license: https://cheerpj.com/docs/licensing/
- **Java 8 tools.jar** — fetched from the original JavaFiddle endpoint. Review the Java/OpenJDK distribution's terms, including applicable GPLv2/ClassPath Exception notices. This archive is not included in the ZIP.

## Test tooling

Playwright 1.64.1 is a development dependency only (Apache-2.0). Browsers and `node_modules` are not included. They are installed separately to rerun tests.

## Original application

The original application is by the contributors to `cc-fusion/vibecoding`. See `docs/PROVENANCE.md`. This conversion does not relicense the upstream project.
