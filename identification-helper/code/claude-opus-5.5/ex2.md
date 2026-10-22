Ran cat package.json vite.config.ts; ls; ls src

Ran npm install @kitware/vtk.js fflate uplot 2>&1 | ta…

Ran npm install -D vitest@3 2>&1 | tail -2; ls node_mo…
Now the core types and the plotfile parser.


Created src/lib/types.ts

Created src/lib/parsers/plotfile.ts
Now VTK-format parsers (legacy structured points and XML ImageData).


Created src/lib/parsers/vtk.ts

Edited src/lib/parsers/vtk.ts
+4
-7
Now the numerical analysis module.


Created src/lib/analysis.ts

Edited src/lib/analysis.ts
+1
-2
Now the loader, demo generator, and worker.


Created src/lib/parsers/index.ts

Created src/lib/demo.ts

Created src/worker/loader.worker.ts

Edited src/lib/demo.ts
+2
-3

Created src/lib/loaderClient.ts

Created src/vite-env.d.ts
Let me write tests now to validate the parsers before building UI.


Created src/lib/__tests__/parsers.test.ts

Created tests/fixtures/tiny.vtk

Created src/lib/memory.ts

Edited src/lib/__tests__/parsers.test.ts
+1
-1

Ran npx vitest run 2>&1 | tail -40
The Header grid lines are physical coordinates; I'll fix that and the budget floor.


Edited src/lib/parsers/plotfile.ts
+13
-12

Ran sed -i 's/Math.max(4096, Math.min(maxCells, budget…
Tests pass. Now the visualization geometry helpers (streamlines, glyphs, AMR boxes).


Created src/viz/geometry.ts

Ran cd node_modules/@kitware/vtk.js; cat package.json …

Ran cd node_modules/@kitware/vtk.js; grep -oE 'Name: *…
I'll define colormaps myself (simpler and gives exact legend parity), then the VTK engine.


Created src/viz/colormaps.ts

Created src/viz/settings.ts

Created src/viz/engine.ts
Ran cat >> src/vite-env.d.ts <<'EOF' declare module '@…
Now UI building blocks: shared controls, chart, and drop handling.


Created src/components/ui.tsx

Created src/components/Chart.tsx

Created src/lib/dropFiles.ts
Now time-series analysis and the Viewport component.


Created src/lib/series.ts

Created src/components/Viewport.tsx
Now the left (controls) panel.


Created src/components/LeftPanel.tsx

Created src/components/RightPanel.tsx
Now Timeline, Welcome, Help, and the App.


Created src/components/Timeline.tsx

Created src/components/Welcome.tsx

Created src/components/HelpModal.tsx

Created src/App.tsx

Ran sed -i 's#<title>.*</title>#<title>FluidScope 3D —…
Typecheck clean. Building:


Ran npm run build 2>&1 | tail -15
Build succeeds. Let me check whether a headless browser is available to verify the viewport actually renders.


Ran which chromium chromium-browser google-chrome 2>/d…

Ran cd /tmp && mkdir -p pw && cd pw && npm init -y >/d…

Running cd /tmp/pw && cat > shot.mjs <<'EOF' import { chro… failed

Ran cd /tmp/pw && (npx playwright install-deps chromiu…

Ran cd /tmp/pw && node shot.mjs $OLDPWD/dist/index.htm…

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
a.png
Ran mkdir -p shots && cp /tmp/pw/a.png /tmp/pw/b.png s…

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
a.png
The volume renders real parsed data. Checking the blowup view:


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
b.png
Everything renders. Last steps: write the README and delete the screenshots.


Created README.md

Ran rm -rf shots; npx vitest run 2>&1 | grep -E "Tests…
I've built FluidScope 3D, a static, browser-only viewer for IAMR/AMReX plotfiles and VTK image data. All 25 automated tests pass and the build produces a single self-contained dist/index.html. I also loaded the synthetic demo in headless Chromium: the volume rendering, isosurface, streamlines, AMR box outlines and time-history charts all appeared, drawn from data that went through the real plotfile parser. I haven't tested it with real IAMR output, only with plotfiles the app itself writes.

What it reads

IAMR/AMReX plotfiles (3D, all AMR levels), as a folder or ZIP. A ZIP of several plotfiles becomes a time series, ordered by the physical time in each file.
Legacy .vtk, uniform grids only (STRUCTURED_POINTS), ASCII or binary.
.vti, plain text or embedded binary, optionally compressed.
ZIPs of .vtk/.vti files as a time series.
Rejected with a message saying what to do instead: .vtu, .vtp, .vtr, .vts, .pvd, .pvti, .vti files with appended data, HDF5, and 2D plotfiles.
Biggest limitation: AMR data is combined onto one uniform grid (128³ cells per frame by default, adjustable up to 256³). Where levels overlap the finer one is used. If the data is finer than the grid it is averaged down, so peak velocity and vorticity can be underestimated. The app shows a warning when this happens.
