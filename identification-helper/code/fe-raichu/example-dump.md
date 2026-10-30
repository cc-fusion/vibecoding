I’ll inspect the project and the referenced archive, then build a script-importable simulation library, a scene editor, and documentation for both the library and its live controls.


Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 reads
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 list
List
/
Read
package.json L1-29
Read
App.tsx L1-29
Read
index.css L1-2
Read
main.tsx L1-11
Read
index.html L1-13
Read
vite.config.ts L1-20
Read
tsconfig.json L1-32
Fetched

raw.githubusercontent.com
The project is a clean starter. The archive contains a Taichi MLS-MPM physics simulation; I’m retrieving its source to preserve the solver and convert the application to JavaScript.


Ran mkdir -p .source && curl -fL --retry 2 'https://ra…

Ran unzip -q .source/original.zip -d .source/original …

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 reads
Read
engine.ts L1-415
Read
worker.ts L1-272
Read
scenes.ts L1-425
Read
renderer.ts L1-485
Read
package.json L1-29
Read
mpmWasm.ts L1-4
I’ve confirmed the archive includes the full WebAssembly solver and ten scene presets. I’m preserving those, adding a JavaScript-only scene API and live controls, and designing a light, focused playground with an interactive simulation viewport.


Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 reads
Read
api.cpp L1-277
Read
App.tsx L220-361
Read
README.md L1-30
Read
test-scenes.ts L1-37

Ran grep -nE 'script_eval|scripted_position|scripted_r…

Ran sed -n '3010,3145p' .source/original/native/mpm.h …
The solver supports live gravity changes and scripted rigid-body motion, so the wheel and touch controls can operate without restarting a scene. I’ll now convert the original source files to JavaScript, add the reusable runtime, and prepare the standalone library build.


Ran npm install lucide-react esbuild && mkdir -p src/l…
The original solver, renderer, worker, and scene modules are now JavaScript. Next I’m adding declarative scene construction, live physics controls, and the public TaichiMPM API; the WebAssembly binary remains unchanged.


Created src/lib/scene-builder.js
The declarative scene builder is in place, including JSON-defined materials, rigid bodies, boundaries, and automatic wheels. I’m now wiring the worker protocol so these controls and particle emitters can change safely while the simulation is running.


Created src/lib/worker.js
The worker now supports scene loading, pause/step, live configuration, and touch-based particle emission. I’m tightening the motion hooks and adding the browser API, which will handle worker messages, canvas rendering, scene changes, and cleanup.

Ran python3 - <<'PY' p='src/lib/worker.js' s=open(p).r…
Live wheel motion is now connected to the original script callbacks, so speed changes are continuous rather than scene resets. Next I’m implementing the single-file script API and the client-side interaction handlers.


Created src/lib/client.js
The public runtime is in place. I’m adding the build step that embeds the worker and both WebAssembly variants inside one distributable JavaScript file, so consumers only need one <script> tag.


Created scripts/build-library.mjs

Created src/lib/global.js

Created src/lib/index.js
The standalone build configuration is ready. I’m now refining the renderer’s grid, camera behavior, and touch handling, then generating the embeddable worker before connecting the application interface.


Running python3 - <<'PY' p='src/lib/client.js';s=open(p).r… failed

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 reads
Read
renderer.js L155-224
Read
client.js L100-149
Read
worker.js L90-189
The first bundle check found two integration issues—a duplicate method name and a misplaced renderer method. I’m correcting them before building the interface.


Ran python3 - <<'PY' p='src/lib/client.js';s=open(p).r…
The standalone bundle now builds successfully. I’m building the interface next: a live playground, scene browser, JSON scene editor, and searchable documentation with copyable examples and downloads.


Created src/components/ui.jsx

Created src/content.js
The shared UI components and examples are ready. I’m now implementing the main workspace, including live scene selection, playback controls, physics settings, performance metrics, and touch/orbit interaction modes.


Created src/components/PlaygroundView.jsx

Created src/Playground.jsx
The live workspace is connected to the engine. I’m adding the scene catalog and JSON editor now, so developers can browse presets, import/export scenes, add objects, and apply changes without touching source files.


Created src/components/SceneLibrary.jsx

Created src/components/SceneEditor.jsx
The catalog and scene editor are functional, including JSON validation, object creation, and import/export. I’m now adding the documentation site with a quick start, scene schema, runtime API, examples, and downloadable assets.


Created src/components/Documentation.jsx
The documentation pages and runnable examples are in place. I’m applying the final visual system now: a quiet light workspace, violet accents, a dark particle viewport, responsive layouts, and accessible controls.


Created src/index.css

Created src/main.jsx

Created src/App.tsx

Created index.html

Created public/favicon.svg
The visual layout is complete. I’m checking the JavaScript bundle and browser runtime next, with particular attention to scene loading, live wheel changes, touch emission, and export downloads.


Running npm run build && node -e "try {console.log('playwr… failed
The first production build caught an icon export removed by the current icon package. I’m replacing it with a local SVG and checking the library in a real browser, not just at compile time.


Ran python3 - <<'PY' p='src/Playground.jsx';s=open(p).…
The application and standalone library now build successfully. I’m adding browser regression checks and a minimal script-tag example to verify the live solver, scene editor, and public API end to end.


Created public/examples/quickstart.html

Created scripts/test-browser.mjs

Created scripts/test-worker.mjs

Created src/App.tsx

Running npx playwright install chromium && node scripts/te… failed
The worker initializes correctly. The first solver check also confirmed that particle color is packed into a float field, so I’m correcting the test to validate only position coordinates and continuing with browser testing.


Ran python3 - <<'PY' p='scripts/test-worker.mjs';s=ope…

Running python3 - <<'PY' p='scripts/test-worker.mjs';s=ope… failed

Running ps -eo pid,ppid,etime,args | grep -E 'test-worker|… failed

Ran kill 2241 2>/dev/null || true; sed -n '2940,3020p'…
The browser test environment is missing Linux graphics libraries, so I’m installing Chromium’s dependencies. I also found a native stepping edge case in the diagnostic test and am checking the solver’s frame timing separately.


Ran npx playwright install-deps chromium

Ran timeout 150 node scripts/test-browser.mjs > .sourc…

Ran node --input-type=module <<'NODE' import {chromium…
The browser check exposed an initialization error that was hidden by the generic fallback screen. I’m surfacing the actual error message and checking the WebGL and worker initialization independently.


Ran python3 - <<'PY' p='src/Playground.jsx';s=open(p).…

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 read
Read
renderer.js L65-129
The issue is isolated: an interaction flag was initialized outside the renderer’s instance properties. I’m correcting that and rerunning the production bundle and browser checks.


Edited src/lib/renderer.js
+1
-1

Ran node scripts/build-library.mjs && timeout 150 node…

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 read
Read
playground-desktop.png
The live canvas is now rendering correctly, with 9,246 particles in the initial scene. I’m improving text contrast and control sizing, and adjusting the playback test to wait for the worker’s final queued frame.


Ran python3 - <<'PY' p='scripts/test-browser.mjs';s=op…
The pause check now passes, and the updated layout is rendering correctly. I’m finishing the editor and standalone-library tests, then I’ll package the converted JavaScript source, documentation, and working examples.


Ran python3 - <<'PY' p='scripts/test-browser.mjs';s=op…

Ran python3 - <<'PY' p='scripts/test-browser.mjs';s=op…

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 reads
Read
SceneEditor.jsx L1-24
Read
Playground.jsx L58-108
Read
worker.js L100-141
Read
client.js L50-119

Ran python3 - <<'PY' p='src/Playground.jsx';s=open(p).…
The custom scene is loading and running correctly; the test found a UI-only dropdown issue when selecting a custom scene. I’m fixing that selection state and finishing the library’s scene-switching checks.


Ran python3 - <<'PY' p='src/components/PlaygroundView.…
All ten scenes also pass direct WebAssembly checks, including 2D and 3D particle sources. I’m now completing the browser regression run and preparing the downloadable JavaScript kit.


Ran cat > scripts/test-worker.mjs <<'NODE' import { MP…
The editor, presets, and custom JSON scenes are working. I’m adding one final runtime capability—creating a moving wheel in an already running scene—then finalizing the guide and source archive.


Ran python3 - <<'PY' p='src/lib/worker.js';s=open(p).r…
The browser checks now pass for playback, custom scenes, the catalog, documentation, mobile navigation, and the standalone script API, with no browser errors. I’m writing the final Markdown guide and packaging the JavaScript-only version of the original archive.


Created README.md

Created scripts/package-kit.mjs

Created public/examples/my-first-scene.json
The complete guide is written. I’m finalizing the package’s JavaScript-only file structure, checking the downloadable assets, and tightening the documentation’s navigation before the final production build.


Ran python3 - <<'PY' p='scripts/build-library.mjs';s=o…
The source kit is ready and contains zero TypeScript/TSX files. I’m doing the last checks on the packaged build, downloadable documentation, and live wheel creation, then rebuilding the final site.


Created scripts/test-runtime.mjs

Created public/docs/taichi-mpm.md
The standalone library, JSON editor, and live controls are complete. I’m verifying the final archive’s own build and the production website, including the actual download URLs and runtime wheel test.


Ran python3 - <<'PY' p='scripts/package-kit.mjs';s=ope…

Ran TEST_URL=http://127.0.0.1:4173 node scripts/test-b…
Implemented and verified.

JavaScript source kit (.zip) — zero TS/TSX files
Standalone script library
Documentation (.md)
Includes the interactive website, JSON scene editor, live wheel and gravity controls, touch/orbit interactions, and all ten original scenes.

The archive and website both build successfully. Browser, runtime, and solver checks pass.I’ll build a live 2D playground with readable documentation, a reusable vanilla-JavaScript engine, and a downloadable .js file for script-tag use. First, I’ll check the reference simulation so the implementation preserves its MLS-MPM structure.

Fetching https://raw.githubusercontent.com/yuanming-hu/taichi_mpm/master/mpm88.py failed
Fetched

https://api.github.com/repos/yuanming-hu/taichi_mpm/contents
api.github.com

github yuanming-hu taichi_mpm mpm88.py 3 results
Fetched

raw.githubusercontent.com
Fetched

raw.githubusercontent.com
Fetched

raw.githubusercontent.com
Fetched

raw.githubusercontent.com
Fetched

raw.githubusercontent.com
The reference uses quadratic particle-to-grid transfers, an APIC update, and snow deformation/plasticity. I’ll preserve those stages in a typed-array solver, then build the interactive playground and documentation around it. The download will provide a standalone mls-mpm.js file that exposes window.MLSMPM.


Created index.html
The single-file site is created, including the live playground, material presets, documentation, examples, and standalone engine download. I’m now checking the solver and UI for correctness, particularly boundary handling, example loading, and the exported API.


Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 read
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 search
Search
Fyy|height =|const material|materialIds|grid =|step\(|substep|performance|friction|simulation-canvas
Read
index.html L790-934
The source review caught a few refinements worth making: more readable documentation text, a tighter desktop layout, and stronger validation around particle and material inputs. I’ll also correct the world’s cell spacing so the renderer and solver use the same geometry.


Edited index.html
+8
-1
The documentation is now easier to read, and the desktop layout is more compact. Next I’ll align the world height to the actual grid dimensions and validate constructor settings before allocation.


Edited index.html
+27
-25
The solver now uses square grid cells for every aspect ratio. I’ll tighten the remaining API edge cases—invalid material names, step counts, and parameter values—so the downloaded script is safe to use independently.


Edited index.html
+3
-3
Unknown material names now produce a clear error. I’ll apply the same validation to material switching and prevent invalid timestep or substep values from entering the simulation loop.


Edited index.html
+39
-38
The engine’s public methods now reject invalid substep counts and keep timestep settings consistent. I’ll finish with keyboard and download handling, plus a few small documentation corrections.


Edited index.html
+12
-8
Keyboard shortcuts now work after interacting with the controls, while Space still respects native button activation. I’ll make file downloads work more reliably across browsers and ensure material switching clears stale affine momentum.


Edited index.html
+10
-9
Material switching now clears stale affine momentum as well as deformation. Next I’ll finalize the download handler and add a small-screen layout safeguard.


Edited index.html
+3
-2
The download now attaches the temporary link to the page before saving the engine. I’ll make the narrowest layouts easier to use and increase contrast in the documentation.


Edited index.html
+3
-1
The small-screen controls and documentation contrast are updated. I’ll now align the help text with the resize behavior, so users know when a scene will restart.


Edited index.html
+1
-1
The resize help now describes the actual behavior. I’ll finish the benchmark wording and dialog positioning, then check the file for structural issues.


Edited index.html
+1
-1
The benchmark now reports solver work only, without implying that the live demo’s playback state has changed. I’ll ensure dialogs stay centered and the simulation canvas is keyboard-focusable.


Edited index.html
+2
-1
Dialogs now have explicit centering and the canvas has a visible focus style. I’ll add the canvas’s keyboard entry point next.


Edited index.html
+1
-1
The canvas can now receive keyboard focus and supports the documented shortcuts. I’ll make one final source check for the script boundaries, download behavior, and placeholder content.


Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 reads
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 search
Search
<script|</script>|TODO|FIXME|&lt;|&gt;
Read
index.html L210-374
Read
index.html L950-1001
Implemented in index.html with:

A typed-array MLS-MPM solver supporting water, snow, and jelly.
Interactive controls, pointer stirring, snapshots, and keyboard shortcuts.
Algorithm explanations, API documentation, and copyable examples.
Get the engine downloads standalone mls-mpm.js, exposing MLSMPM.Simulation and MLSMPM.Renderer for script-tag use.
No React, TypeScript, or build step required.
