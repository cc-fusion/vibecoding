Plan
Design the map-first interface and scenario/title flow.
Implement the atmospheric model, interactive tools, forecast scoring, and progression.
Add audio, persistence, end states, responsive controls, and in-app diagnostics; review the source.
Verify browser rendering, interaction flows, performance, and audio playback end-to-end.
I’m building Isobar, an interactive mesoscale weather lab with a live atmosphere map, forecast challenges, storm evolution, and a supercell capstone.


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
.
Read
index.html

MDN Web Audio API AudioContext createBufferSource GainNode autoplay resume user gesture 3 results

mesoscale weather model specific humidity condensation saturation vapor pressure semi Lagrangian advection simplified 3 results
Fetched

developer.mozilla.org
Fetched

developer.mozilla.org
The lab centers on a living coastal weather map. Ocean warmth, moisture, terrain, fronts, and wind shear will interact in the model; you’ll experiment directly on the map, then commit forecasts and verify them against what actually develops.


Applied patch to index.html
+494
-0

Applied patch to index.html
+358
-0

Applied patch to index.html
+238
-0

Applied patch to index.html
+171
-0

Applied patch to index.html
+95
-0
The atmosphere and forecast scoring are in place, including terrain-driven uplift, a day/night heating cycle, evolving pressure and winds, rain accumulation, storm rotation, and lightning. I’m adding the final mission flows and checks so forecasts, warnings, saves, audio, and restarts all work together.


Applied patch to index.html
+215
-0

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
Read
index.html L390-689
Read
index.html L1140-1569
Search
TODO|placeholder|requestAnimationFrame|addEventListener|data-action=|\?\.[0-9]|&lt;|&gt;

Applied patch to index.html
+63
-38
Applying patch failed

Applied patch to index.html
+29
-14

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
Read
index.html L800-994
Read
index.html L1330-1459
Search
[^\x00-\x7F]|TODO|FIXME|placeholder|&lt;|&gt;|\?\.[0-9]|<script|</script>|data-layer=|case '

Applied patch to index.html
+27
-6

Applied patch to index.html
+9
-3

Applied patch to index.html
+11
-6
The three scenarios, guided walkthrough, research unlocks, forecast verification, regional alerts, synthesized audio, and save/load flows are implemented. I’m reviewing the controls and edge cases now. I’ve also added 18 in-app checks; browser rendering and audio playback can’t be verified with the tools available here.


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
 searches
Read
index.html L1540-1643
Search
function (stepModel|renderMap|initializeSession|saveSession|loadSession|finishMission|frame|boot)|checkpointDue|data-setting=|test\('
Search
TODO|FIXME|placeholder|[^\x00-\x7F]|&lt;|&gt;|\.tsx|React|TypeScript|setInterval|requestAnimationFrame

Applied patch to index.html
+5
-4

Applied patch to index.html
+1
-1
Implemented Isobar in index.html, a map-first mesoscale weather simulation.

Controls: Mouse/touch field tools and atmosphere sliders. Space pauses, 1/2/3 select speeds, and H opens help.
Systems: Coupled temperature, pressure, humidity, wind advection, terrain uplift, clouds, rainfall, rotating storms, lightning, and flood impacts.
Progression: Three seeded scenarios, scored forecasts, persistent research unlocks, save/load, live charts, and CSV export.
Goals: Meet forecast targets while protecting communities. The supercell capstone also requires a verified alert. Excessive damage, lost trust, or missed targets cause failure.
Includes guided onboarding, settings, synthesized ambient audio, mute/volume controls, and restart flows.

Browser behavior, responsive rendering, performance, and audio playback remain unverified here. Eighteen in-app checks are available under Settings.
