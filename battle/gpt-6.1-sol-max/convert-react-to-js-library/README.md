# mpm.js

The supplied simulation archive has been converted into a standalone JavaScript library, with a separate interactive documentation website.

## Deliverables

- `public/downloads/mpm-js-1.0.0.zip`: the modified archive, including readable JavaScript, original C++ source, two ready-to-use distributions, and a framework-free demo.
- `public/downloads/mpm.js`: the classic script build, exposing `window.MPM`.
- `public/downloads/mpm.esm.js`: the ES module build.
- `DOCUMENTATION.md`: the complete API and integration guide.
- `MIGRATION.md`: conversion notes, architecture, provenance, and compatibility.
- `library/UPSTREAM.json`: original archive URL and solver integrity checksums.

The library archive has no React, JSX, TypeScript source, or package-install requirement. The website uses React with JavaScript/JSX; `src/App.tsx` is only the required hosting shim. The real simulation and all ten original scene definitions remain intact.

## Development

```bash
npm install
npm run dev
```

Open the preview's root for the documentation website. Open `/examples/index.html` for the framework-free classic-script demonstration.

## Rebuild

```bash
node scripts/build-library.mjs
npm run build
```

The first command regenerates the classic/ES-module bundles, downloadable Markdown, and source ZIP. The second builds the documentation website into `dist/`, including the downloads, fonts, and examples. Serve `dist/` with any static HTTP server; no application server is required.

## Verification

```bash
node tests/library.mjs
node tests/browser.mjs
npx esbuild library/native/tools/test-scenes.js --bundle --platform=node --format=esm --outfile=/tmp/mpm-scenes.mjs
node /tmp/mpm-scenes.mjs all 2 low
npx tsc --noEmit
```

The browser test requires the preview at `http://localhost:5173`, or set `TEST_BASE_URL`. Install the Chromium testing browser with `npx playwright install chromium` and its OS dependencies with `npx playwright install-deps chromium` if needed.

Browser verification covers custom scene definitions, callbacks, all six high-level materials, runtime wheel and gravity controls, frame stepping, particle emission, script-tag loading without React, ES module loading, downloads, navigation, code copying, and actual touchscreen pouring. The native scene test covers all ten original 2D/3D scenes. The library test checks the retained WASM payloads against the recorded SHA-256 values.

## Important Notes

The solver binaries are preserved, not recompiled. Built-in pointer interaction pours new particles; it is not a grab or force tool. The new high-level wrapper advances WASM in time-sliced main-thread batches to support page-defined callbacks without evaluating strings. Heavy scenes can still be computationally expensive.

The supplied archive has no top-level license file. See the attribution and licensing section in `DOCUMENTATION.md` before redistributing inherited code or binaries.
