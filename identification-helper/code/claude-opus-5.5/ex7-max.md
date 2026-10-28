I'll start by fetching the original MLS-MPM source so the port matches it closely.

Fetched

raw.githubusercontent.com
Fetched

raw.githubusercontent.com

Created mls-mpm.js

Created index.html
Both files are written. I'll fix one CSS detail: the desktop sticky sidebar still has bottom and left constraints left over from the mobile off-canvas styles.


Edited index.html
+1
-1
Next I'll check the HTML for stray </script> or <!-- sequences inside script blocks, since one of those would break the page.


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
 searches
Search
</script>|<script|<!--
Search
^ advance\(dt\) \{|^ advance_frame\(\) \{|^ this\.t \+= dt;
Both copies have identical line offsets (offset of 989). One more check on the tail of each file:


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
 search
Search
^ return MLSMPM;$|^\}\);$
Both copies of the library match line for line. Now I'll re-read the riskiest part of the page script (the highlighter regexes and the demo runner) to check for syntax errors.


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
index.html L1448-1522
The highlighter and helpers look right. I'll quickly scan the demo runner and playground logic as well.


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
index.html L1655-1714
I've written mls-mpm.js (the 2D simulation) and index.html (the documentation site). I haven't run either in a browser, so the physics, the demos and the editor are untested. I did check the code by reading it through, confirmed the two copies of the library match line for line, and checked that no script block on the page closes early.

mls-mpm.js

Loading: one <script src="mls-mpm.js"></script> tag gives you a single global, MLSMPM. The same file also works in Node.js and in Web Workers; only drawing needs a canvas.
Close to the original: advance() follows mls-mpm88.cpp line by line and keeps its comments and constants (n = 80, dt = 1e-4, E = 1e4, nu = 0.2, hardening = 10, gravity −200, boundary 0.05). Names stay in the original snake_case (advance, add_object, particle_mass, mu_0), and the particle fields keep their C++ names (x, v, F, C, Jp, c).
Particle count: the current upstream source seeds 1000 particles per block, so add_object does the same by default.
Speed:
Particle data is stored in flat typed arrays rather than one object per particle.
Each time step creates no new objects, so the garbage collector never pauses it.
The 2×2 matrix math uses the same direct formulas as taichi.h, and the expensive decomposition is skipped for materials that don't need it.
Drawing writes pixels straight into the canvas buffer.
Additions beyond the C++:
Jelly and water materials.
Starting velocities for particles.
An "attractor" that pulls or pushes material toward a point (for mouse interaction).
grid_hook, which lets your code adjust grid velocities to add obstacles or wind.
A seed option for repeatable scenes.
Where it differs from the C++:

The time step dt gets smaller automatically when you use a finer grid, to keep it stable. It is exactly 1e-4 at the default grid size of 80.
Particles are clamped so they can't leave the grid. This never triggers in normal scenes.
The grid keeps each node's mass after the update so you can visualize it.
index.html contains its own copy of the library, so the page works on its own; its download button produces the same mls-mpm.js. It's plain HTML and JavaScript, styled with Tailwind from a CDN, with no React or TypeScript. It has:

a live hero demo you can click to drop blocks into;
installation and quick-start guides;
an explanation of how the method works;
a table mapping each part of the C++ to its JavaScript counterpart, and the original C++ next to the JS advance();
the full API reference;
seven live examples whose code you can edit and re-run;
a playground with sliders for the material settings;
a speed benchmark you can run on your device, the full source, and credits with the paper citation.
Off-screen demos pause to save CPU.

One thing I couldn't verify: the displayed C++ listing is my reconstruction, because the fetched copy lost some characters. Some spacing or comment alignment may differ slightly from the upstream file.

Show Less
