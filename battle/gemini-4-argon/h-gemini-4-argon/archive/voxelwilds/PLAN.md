# VoxelWilds — Engineering & Implementation Plan

## 1. Architecture Overview (Plain HTML, CSS & Modular ES JavaScript + Three.js)
The application uses plain semantic HTML (`index.html`), clean organized CSS (`src/styles.css`), and modular vanilla JavaScript (`src/*.js`) powered by Three.js — with zero React runtime.

### Module Breakdown
1. `src/constants.js` — World dimensions (`CHUNK_SIZE = 16`, `CHUNK_HEIGHT = 96`, `SEA_LEVEL = 30`), physics constants, game modes, tool tiers.
2. `src/blocks.js` — Registry of 35+ block & item types (terrain, wood variants, leaves, ores, stone variants, glass, water, ice, flora, torch, crafting table, furnace, tools, weapons, food, materials) with hardness, tool affinity, light emission, transparency, and drop tables.
3. `src/textures.js` — Procedural crisp pixel-art texture generator (`16x16` per tile with UV inset padding to eliminate mipmap/atlas seam bleeding) + 2D UI icon data URLs for every block, tool, and item.
4. `src/noise.js` — Deterministic seeded PRNG (`mulberry32`) and fast 2D/3D Simplex/Perlin multi-octave fractal noise (`fbm2D`, `fbm3D`).
5. `src/terrain.js` — Biome classification (Emerald Plains, Woodland Forest, Golden Desert, Snowy Taiga, Terracotta Highlands, Ocean/Beach), heightmap shaping, 3D cave carving, depth-stratified ore veins, trees (Oak, Birch, Spruce, Cactus), flora, and rare stone ruins.
6. `src/chunkMesher.js` — High-performance face-culled voxel mesher producing separate opaque, alpha-cutout (crossed flora & 3D torches), and animated water geometries per chunk, complete with smooth 4-neighbor per-vertex Ambient Occlusion (AO) and warm block-light coloring.
7. `src/world.js` — Chunk manager, spiral chunk streaming & disposal, BFS local block light propagation for torches/glowstone/furnaces, fast Amanatides-Woo DDA voxel raycaster, and block modification tracking for persistence.
8. `src/player.js` — First-person controller, Pointer Lock + fallback drag camera, swept axis-separated AABB collision, swimming, sneak edge-guarding, sprinting, Creative flight, health/oxygen/hunger, progressive block mining, block placement, and animated 3D first-person held item/tool rig.
9. `src/inventory.js` & `src/recipes.js` — 9-slot hotbar + 27-slot backpack, stack splitting/quick-transfer, tool durability, Creative catalog, and guided Crafting + Smelting system interacting with placed Crafting Tables and Furnaces.
10. `src/entities.js` — Dropped 3D rotating item pickups with magnetic collection + articulated voxel creatures (Sheep, Pig, Chicken, Zombie, Slime) with AI states, ground/water physics, combat knockback, and drops.
11. `src/particles.js` — Pooled 3D voxel particle bursts for mining debris, water splashes, torch embers, combat hits, and biome-aware rain/snow weather particles.
12. `src/skyWeather.js` — Continuous day-night sky dome shader/gradient, orbiting voxel Sun & Moon, night stars, drifting 3D cloud layer, dynamic fog & hemisphere/directional lighting, and weather transitions.
13. `src/audio.js` — Procedural Web Audio synthesizer for material-specific footsteps, mining, placement, item pickup pops, crafting chimes, tool swings, water splashes, and ambient weather.
14. `src/storage.js` — Persistent multi-world storage via IndexedDB (with localStorage fallback) saving seed, mode, player state, inventory, time, and chunk edits.
15. `src/ui.js` & `src/main.js` — Clean, friendly DOM UI controller (Title Screen & World Selector, HUD, Guided Workshop & Inventory, Pause/Settings Menu, F3 optional debug overlay) and main fixed-step game loop.

## 2. Execution Milestones
1. **Clean Workspace & Foundation**: Remove starter React files; implement constants, block/item definitions, procedural texture atlas + item icons, and seeded noise.
2. **World Generation, Lighting & Meshing**: Implement multi-biome terrain generator, caves, ores, structures, torch light propagation, and AO face-culled chunk mesher.
3. **Player Physics, Interaction & Sky/Audio**: Implement first-person camera, reliable AABB physics, DDA raycasting, progressive mining, placement, 3D held item swing rig, day-night cycle, weather, particles, and Web Audio.
4. **Inventory, Crafting, Mobs & Persistence**: Implement hotbar/backpack, guided crafting & furnace smelting, dropped items, passive/hostile voxel mobs, and IndexedDB multi-world persistence.
5. **Friendly UI & Polish**: Build clean HTML/CSS screens and HUD without clutter or static filler chips.
6. **Build & Runtime Browser Verification**: Build via `npm run build`, launch in headless Chromium with WebGL enabled, inspect rendered screenshots, test gameplay interactions & persistence, fix any issues, and re-verify.
