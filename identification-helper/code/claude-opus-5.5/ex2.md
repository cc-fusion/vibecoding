I'm building Voxel Biosphere (idea #1) in a single index.html file. It uses Three.js for the 3D voxel world, and the simulation, UI, audio and save/load are all plain JavaScript.


Created index.html
I've built Voxel Biosphere as a single index.html. I haven't run it in a browser, so it hasn't been checked for console errors, frame rate or game balance. Population numbers in particular may need tuning after a few playthroughs.

Controls: Right-drag to orbit the camera (or left-drag with the 🎥 tool), use the wheel or two-finger pinch to zoom, and pan with WASD or middle-drag. Space pauses, keys 1–5 set the speed (0.5× to 8×), Esc opens the pause menu, H opens help and M mutes. The tools are camera, inspect/follow, raise and lower terrain, seed, water, spawn, cull and disease.

Core systems:

Day–night, seasons, weather and a climate dial set the temperature.
Soil moisture and fertility control plant growth and seed spread.
Bees pollinate flowers, which helps plants spread.
Hares, foxes, crows, bees and beetles act on hunger, thirst, rest and mating, and pass mutated genes to offspring.
Dead animals become carcasses and then detritus, which turns back into fertility.
Random events: storms and floods, drought, heatwaves, cold snaps, wildfires, disease outbreaks and super blooms.
Progression: Diversity earns ✨ Insight, which you spend on tools and 8 research upgrades. There are 5 scenarios from Easy to Brutal plus a Sandbox, with harder ones unlocking as you win. Milestones, settings and a saved world persist
