Building your Swarm Intelligence Lab — boids, predators, pheromone foraging, PSO optimization, and a sheepdog capstone, all in one interactive simulation.


Created index.html
The main lab is built — now fixing a canvas transform issue to keep rendering smooth during predator strikes.


Edited index.html
+3
-2

Edited index.html
+3
-3

Edited index.html
+1
-1
Selected simulation: #15 Swarm Intelligence Lab.

Controls: Mouse/touch to steer, place obstacles/roosts/food, gust and scatter; WASD/arrows to steer the dog/predator; keyboard shortcuts for tools, pause, mute and help; live sliders for separation, alignment, cohesion, perception, speed, wind and PSO inertia; ½×–4× speed controls.

Core interacting systems: Boids flocking forces, species traits, predator straggler-hunting, energy/roost recovery, wind/turbulence/storms, obstacles, pheromone diffusion/evaporation for ant foraging, PSO personal/global-best search over a landscape, and sheepdog pressure dynamics — each visibly affecting order φ, spacing, energy and score, charted live.

Progression: Six-experiment campaign (Murmuration → Crosswind → ACO → PSO → Predator Gauntlet → Sheepdog Capstone) with three difficulties, stars, unlocks and best scores saved in localStorage.

Success/failure: Meet each experiment's goal before the timer for stars; fail by timeout, excessive predator losses, or losing over two sheep in the capstone.Building simulation #15 — Swarm Intelligence Lab: a multi-species boids laboratory with flocking forces, predators, wind, foraging, PSO optimization, and a sheepdog capstone. Creating the complete single-file application now.


Created index.html
The core lab is created. Now I'll apply a small polish fix so quitting mid-run banks partial research (matching the "Save & quit" promise) instead of silently losing it.


Edited index.html
+1
-1
Fix applied. Doing a final structural check of the file for completeness.


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
(TODO|btnEndNext|startScenario|requestAnimationFrame|localStorage|AudioSys)
Selected simulation: #15 — Swarm Intelligence Lab, built as a complete single-file simulation in index.html.

Controls: Mouse/touch tools (inspect, food, rocks, roosts, wind, erase), live flocking sliders, wind controls, 0.5×–4× speed, pause, keyboard shortcuts (Space, 1–6, WASD, B to bark, H help), plus a steerable sheepdog in the capstone.

Core interacting systems: Separation/alignment/cohesion drive measured order φ; predators scatter flocks and reduce population; energy links feeding, roosting, and speed; wind, gusts, turbulence, and obstacles reshape movement and synchrony.

Progression: Five unlockable campaign experiments with stars, persistent research, Lab Level, achievements, sandbox mode, three difficulties, live charts, event log, synthesized audio, and guided tour.

Success/failure: Meet each experiment’s objective before time expires; failure occurs through timeout, flock collapse, excessive hawk losses, or failing the sheepdog herding trial.

Show LessBuilding Swarm Intelligence Lab (#15) — a multi-mode boids simulation with flocking physics, evolving predators, foraging, PSO optimization, and a sheepdog herding capstone, complete with charts, progression, and synthesized audio.


Created index.html
Selected Simulation: Swarm Intelligence Lab (#15) — a live boids laboratory with starlings, reef fish, insects, and fireflies, each with distinct flocking physics.

Controls: Mouse/touch tools (inspect, spawn, food, rocks, roosts, predators, erase), flocking sliders, wind controls, gusts (G), food (F), pause/speed (Space, +/−, 0.5×–4×), and WASD/mouse sheepdog steering. Synthesized Web Audio provides wind ambience, chirps, predator, and success sounds with mute/volume settings.

Core Systems: Separation/alignment/cohesion interact with energy, food, reproduction and mutated genes, straggler-hunting predators, wind/gusts, obstacles, roosts, pheromone trails, day/night cycles, and PSO particles sharing personal/global bests.

Progression: Sandbox quests and scenarios earn RP for evolution upgrades and lab levels, unlocking Foraging Frenzy, PSO Optima, and the Sheepdog Capstone; stars, best scores, and settings persist in localStorage.

Success/Failure: Complete collection, optimization, or 80% herding targets for stars; fail through flock collapse or timer expiry.

Show LessBuilding Simulation #16 — the Cellular Automata Workshop — with seven automaton modes (Life-like B/S rules, Brian's Brain, WireWorld, Langton's Ant, sandpiles, elementary CA, and a Lenia-style continuous mode), a pattern library, rule-mutation search, five challenge scenarios plus a glider-gun capstone, XP progression, live population/entropy charts, synthesized audio, and full title/pause/settings/end-state flow, all in one self-contained page.


Created index.html
The core workshop is built. Now I'll fix a placement issue I spotted in the Capstone: the Gosper Glider Gun is 36 cells wide, so centering it at x=16 would clip its left stabilizing blocks off-grid and break the gun — I'll shift it right so the full gun assembles intact.


Edited index.html
+1
-1
Capstone placement fixed. Let me run a quick sanity check over the file for key wiring — main loop, scenario setup, and event handlers — to make sure everything is present and connected.


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
requestAnimationFrame\(loop\)|setupScenario\(scenarioId\)|addEventListener\('pointerdown'|function succeed|function fail|localStorage
Search
id="(gridCanvas|overlayCanvas|chartCanvas|startBtn|playBtn|endModal|pauseModal|helpModal|settingsModal|tutorialModal)"
Built Cellular Automata Workshop (Simulation #16) as a complete single-page lab in index.html.

Controls: Mouse/touch painting with brush, eraser, stamp, line, spray, and probe tools; keyboard shortcuts for run/step, speed, tools, clear, soup, grid, and mute. Time controls include pause and 0.5×–4× speeds.

Core systems: Seven interacting engines—Life-like B/S rules, Brian’s Brain, WireWorld, Langton’s Ant, abelian sandpiles, elementary Wolfram rules, and continuous Lenia-lite—linked to population, entropy, activity, births/deaths, charts, particles, events, and synthesized Web Audio feedback.

Progression: Six scenarios across three difficulties, XP levels, achievements, unlockable patterns/palettes, rule-mutation previews, snapshots, and persistent local storage.

End states: Complete targets, oscillators, circuits, basins, or the 300-generation Glider Gun Capstone for stars and score; extinction, dead electrons, or generation limits trigger failure and retry flows.

Show LessBuilding your Market Microstructure simulation — a live limit-order-book trading floor with competing agent strategies, flash-crash dynamics, margin risk, and a player trading desk.


Created index.html
The core trading floor is built. Now I'll tune the market-maker spread model so quoted spreads stay realistic instead of blowing out under volatility.


Edited index.html
+1
-1

Edited index.html
+1
-1
Spread model tuned. Now I'll run a quick consistency check over the file for any mismatched element references or leftover issues.


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
\$\('([A-Za-z0-9_]+)'\)
Search
id="(buyBtn|sellBtn|pauseBtn|startBtn|endNext|mainChart|depthChart|volChart|equityChart|tutorialPanel|upgradeList)"
Consistency checks pass. I'll make two final refinements — clearer mute labeling and a fuller save snapshot that restores upgrades and leverage.


Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+1
-1
Built Simulation #17: Market Microstructure Sim as a complete single-page trading simulation in index.html.

Controls: Mouse/touch order entry, chart-click limit pricing, bot parameter sliders, keyboard shortcuts (Space, B/S, F, 1–4, arrows, H, Esc), pause/speed controls, settings, mute and volume.

Core systems: A live limit order book with depth and time-and-sales; 58 agents across six strategies; a hidden fundamental driven by news; GARCH-style volatility clustering and market-maker withdrawal; spread, slippage, fees, margin and liquidation; plus a configurable player algo-bot and circuit breakers.

Progression: Four escalating scenarios and three difficulties, with campaign unlocks, best-P&L records, XP, saved snapshots, and Edge-funded desk upgrades.

End states: Win by reaching the equity target before the close; fail through target misses or margin liquidation.

Show Less
Building Simulation #20 — Erosion & Watershed Sim: a heightfield watershed with rainfall, hydraulic/thermal erosion, sediment transport, groundwater, vegetation stabilization, dams/levees/terraces, farms and settlements at flood risk, storm and megaflood events, a 3-scenario campaign plus sandbox, tech upgrades, charts, synthesized audio, and full title/pause/help/end flows.


Created index.html
The core simulation is built. Now I'll verify a few logic details — weather forecast symbols, structure damage during the safe time-lapse mode, and a hardcoded town name in a failure message — and fix them.


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
⛈|☀|Millbrook was destroyed|geoMode>0\?0:1

Edited index.html
+1
-1

Edited index.html
+2
-2

Edited index.html
+1
-1

Edited index.html
+6
-4
I spotted a tuning issue: the physics runs many substeps per second, so the original per-step rain, inflow and erosion rates would melt terrain and flood the map far too fast. I'll rescale those rates for stable, readable behaviour.


Edited index.html
+2
-2

Edited index.html
+2
-2

Edited index.html
+3
-3

Edited index.html
+2
-2

Edited index.html
+2
-2

Edited index.html
+2
-2

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
linear-gradient|TODO|placeholder
Search
function (newGame|physicsStep|endScenario|saveRun|loadRun|render)
No forbidden gradients or placeholders remain. I'll do a final structural scan of the script's key sections to catch any syntax or wiring issues.


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
index.html L520-649
Read
index.html L1320-1450

Edited index.html
+1
-1
Built Simulation #20: Erosion & Watershed Sim — “Watershed Command” as a complete single-file interactive simulation in index.html.

Controls: Mouse/touch drag with 11 tools (inspect, raise, dig, rain-seed, plant, dam, levee, terrace, farm, repair, clear), brush sizing, overlays, pause and 0.5×–4× speeds, plus full keyboard shortcuts.

Core systems: A seeded procedural heightfield drives shallow-water flow, hydraulic and thermal erosion, sediment transport/deposition, groundwater moisture, vegetation stabilization/regrowth, weather and river inflow, farms, towns, dam/levee integrity, budget, harvests, and flood damage — all visibly coupled on the map, cross-section, and telemetry charts.

Progression: Three-difficulty campaign — Verdant Valley tutorial → Sediment Delta → Ashen Canyon’s 100-year megaflood capstone — with unlocks, stars, best scores, research upgrades, save/load, and an endless sandbox.

End states: Win by surviving the season with town, farm, vegetation, and solvency objectives met; lose through town destruction, farm collapse, ecological collapse, or bankruptcy.

Show LessBuilding your Approach Control simulation — a full radar-scope ATC game with escalating shifts, weather, emergencies, and separation management.


Created index.html
The core simulation is built — now I'll verify the code for any syntax or logic issues before final polish.


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
function (updateSim|drawRadar|initGame|loop|checkConflicts)
Search
TODO|placeholder|&lt;|&gt;
Structure verified. I'll apply a few gameplay fixes — storm closures forcing go-arounds, preventing simulation steps after a shift ends, and syncing the weather overlay toggle correctly.


Edited index.html
+2
-2

Edited index.html
+3
-2

Edited index.html
+1
-1

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
index.html L740-859
Built Approach Control Sim (#23) as a complete single-file simulation in index.html.

Controls: Click/tap aircraft or traffic rows to select them, then adjust heading, altitude, and speed via buttons, sliders, or keyboard. Use Direct Final, Clear to Land, Enter Hold, Direct Exit Gate, takeoff clearances, pause, and 0.5×–4× speed controls.

Core systems: Arrival/departure sequencing interacts with runway occupancy and wake turbulence, 3 NM/1,000 ft separation and safety ratings, drifting storm cells and shifting winds, fuel burn, holding, emergencies, scoring, delays, and go-arounds.

Progression: Four escalating shifts—from First Light to the locked Tempest Rush capstone—with traffic/weather modifiers, unlocks, grades, best scores, and campaign persistence via localStorage.

End states: Meet landing/departure quotas before time expires with safety ≥60 to succeed. Collisions, fuel exhaustion, safety collapse, or missed quotas end the shift in failure.

Show LessBuilding Spiking Neural Lab (#26) — an Izhikevich network sandbox with STDP plasticity, multiple topologies, raster/spectrum analytics, seizure/silence failure states, and a 4-mission progression campaign. Creating the complete simulation now.


Created index.html
The core lab is built. Now polishing two details — the rate-chart legend and preventing the spacebar from toggling pause behind the end-of-mission modal.


Edited index.html
+1
-1

Edited index.html
+1
-1
Verifying all DOM references line up with the markup before finalizing.


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
id="(titleScreen|scenarioGrid|launchBtn|app|mainCanvas|rasterCanvas|rateCanvas|traceCanvas|specCanvas|eventLog|endModal|pauseModal|helpModal|settingsModal|tutorialCard)"
Summary
Selected simulation: #26 — Spiking Neural Lab, a real-time Izhikevich neuron network simulator with RS excitatory and FS inhibitory cells, synaptic currents, STDP plasticity, synaptic decay, and live E/I rebalancing.

Controls: Click neurons to inspect, stimulate, inhibit, place 2 Hz electrodes, or lesion/restore cells. Sliders tune topology (modular, small-world, random, ring), neuron count, inhibitory fraction, drive, noise, learning rate, and decay. Supports pause, 0.5×–4× speed, keyboard shortcuts, touch input, settings, volume/mute, and synthesized spike, stimulation, alarm, success, and ambient audio.

Interacting systems: Neural activity drives STDP; STDP reshapes connectivity; topology channels rhythm; drive/noise/inhibition alter firing and synchrony; excessive synchrony causes seizures while inactivity causes silence, both draining Lab Integrity. Raster plots, firing-rate charts, membrane traces, synchrony, and oscillation spectra visualize every effect.

Progression: Four unlockable missions — Awaken, Pattern Memory, Central Pattern Generator, and the Classifier Gauntlet capstone — plus Sandbox mode, three difficulties, saved progress, and best scores.

End states: Complete mission objectives to succeed and unlock the next challenge; lose all integrity through seizure or silence to fail.

Show LessBuilding Spiking Neural Lab (#26) — an Izhikevich network sandbox with STDP plasticity, multiple topologies, raster/spectrum analytics, seizure/silence failure states, and a 4-mission progression campaign. Creating the complete simulation now.


Created index.html
The core lab is built. Now polishing two details — the rate-chart legend and preventing the spacebar from toggling pause behind the end-of-mission modal.


Edited index.html
+1
-1

Edited index.html
+1
-1
Verifying all DOM references line up with the markup before finalizing.


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
id="(titleScreen|scenarioGrid|launchBtn|app|mainCanvas|rasterCanvas|rateCanvas|traceCanvas|specCanvas|eventLog|endModal|pauseModal|helpModal|settingsModal|tutorialCard)"
Summary
Selected simulation: #26 — Spiking Neural Lab, a real-time Izhikevich neuron network simulator with RS excitatory and FS inhibitory cells, synaptic currents, STDP plasticity, synaptic decay, and live E/I rebalancing.

Controls: Click neurons to inspect, stimulate, inhibit, place 2 Hz electrodes, or lesion/restore cells. Sliders tune topology (modular, small-world, random, ring), neuron count, inhibitory fraction, drive, noise, learning rate, and decay. Supports pause, 0.5×–4× speed, keyboard shortcuts, touch input, settings, volume/mute, and synthesized spike, stimulation, alarm, success, and ambient audio.

Interacting systems: Neural activity drives STDP; STDP reshapes connectivity; topology channels rhythm; drive/noise/inhibition alter firing and synchrony; excessive synchrony causes seizures while inactivity causes silence, both draining Lab Integrity. Raster plots, firing-rate charts, membrane traces, synchrony, and oscillation spectra visualize every effect.

Progression: Four unlockable missions — Awaken, Pattern Memory, Central Pattern Generator, and the Classifier Gauntlet capstone — plus Sandbox mode, three difficulties, saved progress, and best scores.

End states: Complete mission objectives to succeed and unlock the next challenge; lose all integrity through seizure or silence to fail.

Show LessBuilding your Genetics Breeding Lab (simulation #30) — a complete diploid breeding simulation with Mendelian, codominant, epistatic, sex-linked and polygenic inheritance, linkage, inbreeding, pedigree, Punnett and Hardy–Weinberg tools, campaign scenarios, sandbox, economy, upgrades, events, audio and full screen flows.


Created index.html
The core file is created — now I'll audit the genome/position data model and fix a field collision I spotted before testing the full flow.


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
ind\.x|dam\.x|sire\.x|\.tx|px|makeIndividual
Read
index.html L520-569

Edited index.html
+6
-6

Edited index.html
+1
-1

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
(dam\.x|ind\.x|ind\.y|a\.y|b\.y|ind\.tx|G\.pop\.forEach\(ind=>\{ind\.wander)
Fixed the core data model — now correcting every world-position reference to use the new coordinates.


Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+3
-3

Edited index.html
+1
-1

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
index.html L832-856
Position references are fixed. Now I'll do a final syntax and wiring scan of the interaction, pedigree and main-loop code.


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
index.html L1000-1164
Read
index.html L600-779
The main logic checks out. I'll make the mutation event and sandbox mutagen actually raise gamete mutation rates (so their text matches real mechanics), and align the Scanner upgrade description with its real effect.


Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+3
-3

Edited index.html
+1
-1

Edited index.html
+1
-1
Mutation systems are now real. One last polish: surface the mutagen state in the enclosure status bar.


Edited index.html
+1
-1
Selected simulation: #30 — Genetics Breeding Lab. You breed diploid “Chromalopes” in a live animated enclosure across a 5-programme campaign (Dominance → Epistasis → Sex-Linkage → Polygenic Giants → the Aurora Chimera capstone) plus an open Sandbox, with Novice/Standard/Expert difficulties.

Controls: Click/tap animals to inspect, set Sire/Dam, breed (mouse or B), quick-pair search, contracts, releases, pedigree viewer, Punnett/Hardy–Weinberg tools; Space pause, 1–4 speed, H help, Esc menu, Ctrl+S save.

Interacting systems: Mendelian dominance, codominance, recessive epistasis, X-linkage, A–B linkage with recombination, 3-locus polygenic size with environmental noise, pedigree-computed inbreeding depression, mutation/drift, allele-frequency dynamics, and a credits/contracts economy — all feeding health, litter size, and survival.

Progression: Milestones earn Research Points for permanent upgrades (habitat, incubator, nutrition, scanner, cryobank champion genomes); progress, champions, settings and the in-progress lab persist in localStorage, with synthesized Web Audio, charts, events, and pause/settings flows.

End states: Win by producing the lab-born target before generation/day limits; lose through timeout, bankruptcy (<−50 cr), extinction, or loss of a breeding population — each ending shows scored statistics.Building simulation #32 — Granular Matter Lab: a particle-physics sandbox with angle-of-repose piles, hopper arching/jams, Brazil-nut segregation, Janssen silo pressure with collapse, a rotary mixer, moisture/cohesion, vibration and compaction, six scenarios (including a mega-silo capstone), research progression, charts, synthesized audio, and full title/pause/end flows.


Created index.html
The core lab is built. Now I'll verify a few risky areas — prefill densities (so scenario targets aren't pre-satisfied or particle-capped), mixing/segregation calibration, and the keyboard pause handler.


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
prefillScenario|case "mixer":return|compaction=clamp|k===" "
Found calibration issues to fix: Brazil-nut prefill would hit the particle cap before nuts spawn, the silo starts nearly at target, mixer target is too strict for granular radial segregation, and compaction saturates instantly. I'll also add a working conveyor belt toggle (using the existing floor-surface physics) and clean up the pause handler.


Edited index.html
+2
-1

Edited index.html
+8
-7

Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+1
-3

Edited index.html
+1
-1

Edited index.html
+3
-2

Edited index.html
+2
-1

Edited index.html
+3
-2

Edited index.html
+2
-1

Edited index.html
+2
-1

Edited index.html
+2
-1

Edited index.html
+1
-1

Edited index.html
+2
-1
Now fixing deeper gameplay issues I spotted: a robust column-based repose-angle measurement (stray grains shouldn't flatten the reading), a less over-packed mixer drum, hum audio that must stop on pause, and a "keep playing" free-play flag so completed scenarios don't instantly re-trigger the end screen.


Edited index.html
+17
-11

Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+6
-2

Edited index.html
+1
-1

Edited index.html
+1
-1

Edited index.html
+4
-3
Let me scan for any remaining inconsistencies — undefined state fields, duplicate handlers, or references to removed elements.


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
 searches
Search
conveyorOn|S\.stats\.vibeTime|endFreeBtn|freePlay
Search
id="(gateBtn|feederBtn|conveyorBtn|mixerBtn|vibeBtn|shakeBtn|dryBtn|clearBtn|saveRunBtn|restartBtn|simCanvas|chartCanvas|titleCanvas)"
Read
index.html L440-629
Read
index.html L1140-1269
Spotted a stale-state bug: scenario geometry fields (silo bounds, sensor, feeder, mixer centre) aren't cleared when switching scenarios, so a hopper sensor could leak into a later repose run. Fixing that plus a missing rush-bonus reset.


Edited index.html
+3
-2

Edited index.html
+2
-1
Strengthening the Brazil-nut ratchet slightly so sustained vibration reliably floats large nuts within the time limit (still gated by neighbour density, so it only works in a real shaken bed).


Edited index.html
+7
-7

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
index.html L1380-1552
One rendering correctness fix: the canvas backing store can have a different aspect ratio than the 960×600 world, which would stretch grains. I'll switch to a letterboxed contain-fit transform and make mouse coordinates use the same mapping.


Edited index.html
+1
-1

Edited index.html
+5
-4

Edited index.html
+5
-3

Edited index.html
+5
-4

Edited index.html
+1
-1

Edited index.html
+2
-2
Making the "motor surge" event mechanically real (it currently only logs) by routing it into the vibration acceleration, and adding a ResizeObserver so the canvas fit stays correct when layout shifts.


Edited index.html
+3
-2

Edited index.html
+2
-1

Edited index.html
+1
-1
Final integrity check: verifying every $("...") reference in the script resolves to a real element ID in the markup.


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
\$\("[A-Za-z0-9]+"\)
Search
id="[A-Za-z0-9]+"

Edited index.html
+1
-1

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
gradient|TODO|FIXME|placeholder
Stability guard for slow frames: substep count should scale with the actual simulated delta (not just speed setting) so grains can't tunnel through walls when the frame rate dips at 4×.


Edited index.html
+3
-3
Granular Matter Lab (#32) is complete in index.html.

Controls: Mouse/touch to pour, draw walls, stir, wet, dry, erase and probe grains; sliders for moisture, vibration amplitude/frequency, gravity and mixer speed; equipment toggles for gate, feeder, conveyor, vibration table and mixer; keyboard shortcuts (1–7 tools, Space pause, G/V/F/C/S/D/M), with 0.5×–4× simulation speeds.

Core systems: A spatial-hash particle engine (6 materials with distinct size, density, friction, cohesion) interacts with moisture-driven cohesion and hopper arching, vibration-driven compaction and Brazil-nut segregation, Janssen silo pressure with wall fatigue/cracking/collapse, rotary mixing entropy, and random weather/motor/feeder events — all charted live.

Progression: Seven scenarios (Repose, Hopper, Brazil-Nut, Silo, Mixer, Mega-Silo capstone, Sandbox) across three difficulties, with a guided tutorial, Research Points, unlockable materials, ranks, best scores, milestones, and snapshot save/load via localStorage.

End states: Success by meeting each discharge/angle/segregation/fill/mixing target before the timer ends; failure by timeout or catastrophic silo collapse, with full statistics on the resolution screen.
