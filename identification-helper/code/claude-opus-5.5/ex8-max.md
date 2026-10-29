I'll start by exploring the project structure and the source repository.


Ran cd ~ 2>/dev/null; pwd; ls -la; cat package.json; c…
Fetched

GitHub - yuanming-hu/taichi_mpm: High-performance moving least squares material point method (MLS-MPM) solver. (ACM Transactions on Graphics, SIGGRAPH 2018)
github.com
The project appears to live in ~/sandbox. Let me check it and clone the source repo to study the full solver.


Ran cd ~/sandbox && ls -la && cat package.json && cat …

Ran cd /tmp && git clone --depth 1 https://github.com/…

Ran cd /tmp && (wget -q https://github.com/WebAssembly…

Ran cd /tmp/taichi_mpm/src && cat mpm_fwd.h mpm.h
wasi-sdk (clang 19, wasm32-wasi + libc++) is ready. Let me continue reading the solver core.


Ran cd /tmp/taichi_mpm/src && sed -n 240,491p mpm.h

Ran cd /tmp/taichi_mpm/src && sed -n 1,230p mpm.cpp

Ran cd /tmp/taichi_mpm/src && sed -n 230,560p mpm.cpp

Ran cd /tmp/taichi_mpm/src && sed -n 560,860p mpm.cpp

Ran cd /tmp/taichi_mpm/src && sed -n 478,562p mpm.cpp …
Now the core transfer kernels (P2G/G2P with CPIC):


Ran cd /tmp/taichi_mpm/src && sed -n 1,330p transfer.c…

Ran cd /tmp/taichi_mpm/src && sed -n 330,640p transfer…

Ran cd /tmp/taichi_mpm/src && awk 'NR>=600 && NR<=800'…

Ran cd /tmp/taichi_mpm/src && awk 'NR>=575 && NR<=600'…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" rigid_tr…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" rigid_tr…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" mpm_rigi…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" mpm_rigi…
Now materials, boundary particles, kernels, and Taichi's RigidBody (lives in the legacy Taichi repo):


Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" particle…

Ran cd /tmp && (curl -sL https://raw.githubusercontent…

Ran cd /tmp/taichi_legacy/include/taichi/dynamics && g…

Ran cd /tmp/taichi_legacy/include/taichi && grep -v "^…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" boundary…
Now the material models (particles.cpp):


Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" particle…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" particle…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" particle…
Now articulations and rigid–rigid collision solver:


Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" articula…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" rigid_bo…

Ran sed -n 40,60p /tmp/taichi_legacy/include/taichi/ma…

Ran cd /tmp/taichi_mpm/scripts/mls-cpic && sed -n '/de…

Ran cd /tmp/taichi_legacy && grep -rn "def create_leve…

Ran cd /tmp/taichi_legacy && grep -n "DynamicLevelSet"…

Ran cd /tmp/taichi_legacy && grep -v "^\s*$" include/t…

Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" poisson_…
I have a solid understanding of the core. Let me check the remaining pieces: rigid-rigid collision detection, remaining articulations, and the 3D solid inertia path.


Ran cd /tmp/taichi_mpm/src && grep -v "^\s*$" rigid_bo…

Ran cd /tmp/taichi_legacy/include/taichi && grep -v "^…

Ran cd /tmp/taichi_legacy && grep -rn "world_to_elemen…

Created native/taichi_lite.h

Created native/mpm.h
Now the C API exported to JavaScript, plus a native test harness (compiled only for the host) so I can validate the SVD and run 2D/3D smoke tests with g++ before targeting WASM:


Created native/api.cpp

Ran cd ~/sandbox/native && time g++ -std=c++17 -O2 -ma…

Ran cd /tmp && cat > svdtest.cpp <<'EOF' #include "tai…
The algorithm is correct — it just needs 6 Jacobi sweeps instead of 4 to reach ~1e-6 accuracy in all cases. Fixing that:


Edited native/taichi_lite.h
+3
-2
Ran cd ~/sandbox/native && sed -i 's/std::memset(&grid…

Ran cd ~/sandbox/native && sed -i 's/std::memset(&grid…

Ran cd ~/sandbox/native && python3 - <<'EOF' import re…

Created src/sim/engine.ts

Created src/sim/scenes.ts

Ran cd ~/sandbox && mkdir -p native/tools && cat > nat…
The WASM build runs all 2D scenes stably, but three 3D scenes end with 0 particles. Let me trace where the particles disappear (creation vs. deletion):


Ran cd ~/sandbox && cat > /tmp/dbg.ts <<'EOF' import {…

Ran cd ~/sandbox && python3 - <<'EOF' p='native/mpm.h'…

Created src/sim/worker.ts

Created src/render/renderer.ts

Edited src/render/renderer.ts
+1
-1

Ran cd ~/sandbox && cat src/main.tsx && cat src/index.…
Now the React UI. I'll also add Vite client typings for the inline-worker import and drop the conflicting webworker lib reference:


Ran cd ~/sandbox && printf '/// <reference types="vite…

Created src/App.tsx
Now let me add a base background style and run the production build:


Ran cd ~/sandbox && cat > src/index.css <<'EOF' @impor…

Ran cd ~/sandbox && (timeout 250 node /tmp/test-scenes…

Ran cd ~/sandbox && sed -i "s/density: 500, friction: …

Ran cd ~/sandbox && python3 - <<'EOF' p='src/sim/scene…

Ran cd ~/sandbox && sed -i "s/for (const P of \[-0.15,…

Ran cd ~/sandbox && python3 - <<'EOF' p='src/sim/scene…

Ran cd ~/sandbox && python3 - <<'EOF' import re p='src…
Sand-stir keeps all its particles, but jelly-cut-3d still loses them, so something else is involved. Let me count particles per material over time to isolate it:


Ran cd ~/sandbox && cat > /tmp/jc.ts <<'EOF' import { …

Ran cd ~/sandbox && python3 - <<'EOF' p='src/sim/scene…

Ran cd ~/sandbox && python3 - <<'EOF' p='src/App.tsx';…

Created native/README.md

Ran cd ~/sandbox && npm run build 2>&1 | tail -6 && ls…
I've ported the full taichi_mpm solver to WebAssembly and built a browser app around it. The page builds to a single self-contained dist/index.html (1.3 MB, 478 KB gzipped). I tested the WASM module, all 10 scenes and the worker message flow in Node. I could not open the page in a real browser here, so the WebGL drawing and React UI haven't actually been run yet.

What was ported

Scope: the high-performance solver in src/ (the 88-line version and the separate async solver in src/async/ are not included). That covers MLS-MPM transfers, CPIC cutting through thin shells, two-way rigid-body coupling, collisions between rigid bodies, articulations, all 8 materials, level-set boundaries, Poisson-disk seeding, continuous particle sources, and scripted rigid motion.
Dependencies: the pieces of the old Taichi library the solver needs (vector/matrix math, 3×3 SVD, rotations, level sets, textures, config) are rewritten in native/taichi_lite.h. The collision-detection routine from libccd is rewritten too.
Sparse grid: SPGrid relies on OS memory tricks a browser can't do, so it's replaced with a block-based grid that keeps the same structure of active, neighbour and rigid-body block maps.
Build: compiled with clang 19 (wasi-sdk), in a SIMD and a plain version; the page picks whichever the browser supports. It runs in a Web Worker, and the JavaScript API mirrors the original Python one (add_particles, add_articulation, level sets, scripted motion, per-frame particle sources).
The app has 6 2D and 4 3D scenes, ported from the repo's demo scripts (sand wheel, water wheel, sand stirring, motorised crawler, buoyancy) plus cutting and rigid-collision showcases. The .obj meshes those scripts load aren't in the repo, so the geometry is generated in code. You can colour particles by velocity, by which side of a blade they're on (CPIC), or by plastic state. There's also an overlay of the active grid blocks, a per-stage timing breakdown, and the solver's log.

Things that behave differently from the original

Speed: it's single-threaded, because browser multithreading needs server headers a static page can't set. The default 2D scene (CPIC cutting, about 9K particles) takes under a minute for its 4 seconds. 3D runs at roughly 1–6% of real time, so use "Low" quality for quick previews.
Low resolutions: the solver deletes particles within 7 grid cells of the domain edge. At browser resolutions that band is large, so the 3D scenes keep everything in the middle 60% of the box.
Tuning: the solver's contact defaults (penalty, pushing_force) were tuned for the original high-resolution runs and are about 100× too strong at these resolutions. At full strength they launched light rigid bodies and crushed particles until they were deleted. I scaled penalty with resolution or set it to 0, and set pushing_force to 0 as the original scripts do.
Material swap: in the 3D cutting scene the ball uses snow instead of the "elastic" material. The elastic model breaks down when particles are sheared through a blade edge, and the solver deletes them; the original would do the same.
SVD: it takes up to two extra iterations when the original four haven't converged. With four, the worst-case error was about 1%.
Bug fixed: thin-shell moment of inertia in 3D subtracted the centre of mass twice in the original; I corrected it.
Not ported: file output (.bgeo/.obj), snapshot save/load, MPI, and a few experiment-specific hacks in the solver code (e.g. sand_climb, hack_velocity).
To rebuild the WASM after changing the C++, run native/build.sh (wasi-sdk 25 is currently unpacked in /tmp, not the project). native/README.md covers this and the Node regression test.

Show Less
