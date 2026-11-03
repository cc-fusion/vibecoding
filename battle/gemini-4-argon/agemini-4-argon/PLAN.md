# TerraCraft — Voxel Sandbox Architecture & Implementation Plan

## 1. Architecture & Technical Stack
- **Core Stack**: Plain HTML (`index.html`), Plain CSS (`src/style.css`), and Modular Vanilla JavaScript ES Modules (`src/main.js` + `src/**/*.js`) powered by **Three.js (`0.186.x`)**. No React/JSX framework layer.
- **Build Compatibility**: Compatible with Vite's build pipeline (`npm run build` -> `dist/index.html`) without modifying `package.json` or `vite.config.ts`.

## 2. Core Engine Modules
- [x] `src/utils/noise.js`: Deterministic seeded PRNG (`mulberry32`), 2D/3D Simplex noise, FBM, ridged multifractal, and domain warping.
- [x] `src/world/blocks.js`: Block & item registry (~45 blocks + tools, weapons, ores, ingots, food, utilities) with properties (opacity, light emission, hardness, preferred tool, drops, sound group, render type: solid, cutout, cross-flora, fluid).
- [x] `src/world/textures.js`: Procedural 16x16 pixel-art texture atlas generator (`DataTexture` with `NearestFilter` & `SRGBColorSpace` + UV padding to prevent bleeding), crack animation frames (`0..9`), and crisp 2D item/block UI icon renderer.
- [x] `src/world/biomes.js` & `src/world/worldgen.js`: Seeded multi-biome terrain generator (Emerald Meadows, Whispering Taiga, Golden Dunes, Frostpeak Tundra, Shorelines/Rivers, Glowing Caves) with strata, 3D caves, ore veins, trees, flora, and water/lava levels.
- [x] `src/world/chunk.js` & `src/world/mesher.js`: `16x96x16` chunk storage (`Uint8Array` voxels + packed 4-bit Skylight / 4-bit Blocklight), cross-chunk face culling, per-vertex smooth Ambient Occlusion (4-sample corner AO), cross-mesh flora/torches, and animated translucent water mesh.
- [x] `src/world/world.js`: Dynamic chunk streaming around player with frame-budgeted generation/remeshing queue, BFS light propagation (sunlight columns + torch/lava/crystal light), 3D DDA voxel raycasting, fluid settling, and sparse chunk edit deltas.

## 3. Gameplay, Physics & Entities
- [x] `src/physics/player.js`: First-person camera & sub-stepped axis-separated AABB collision, sprint, coyote-time jumping, edge-safe crouching/sneaking, swimming & buoyancy, fall damage, Survival vs Creative/Fly modes, and depth-cleared 3D first-person held arm/extruded-tool/block viewmodel.
- [x] `src/gameplay/inventory.js` & `src/gameplay/recipes.js`: 9-slot hotbar + 27-slot backpack, tool durability & mining speed multipliers, smart categorized crafting (Hand, Workbench, and Furnace smelting), cursor-slot & shift-click item management, and Creative palette.
- [x] `src/entities/drops.js` & `src/entities/mobs.js`: Rotating 3D dropped item entities with magnetic pickup; articulated 3D voxel creatures (passive Sheep & Boars, hostile night Stalkers & Cave Slimes, dusk Fireflies) with terrain-aware AI, combat knockback, and loot drops.
- [x] `src/effects/sky.js` & `src/effects/particles.js`: Dynamic day-night sky dome, sun/moon arcs, stars, drifting 3D voxel clouds, biome-aware weather (clear, rain, snow), block debris particles, mining chips, water splashes, and handheld torchlight shader illumination.
- [x] `src/audio/sound.js`: Web Audio API procedural sound engine (material-specific footsteps, dig/break/place SFX, UI clicks, item pickup chimes, sword swing, splashes, ambient weather).
- [x] `src/storage/save.js`: Persistent multi-world storage in IndexedDB (with `localStorage` fallback), saving chunk modification deltas, seed, inventory, player transform, vitals, milestones, and world clock.

## 4. UI & Polish Principles
- [x] Clean, friendly, uncluttered HTML/CSS UI (`index.html` + `src/style.css`):
  - Live orbiting 3D world background on Title/Pause menu.
  - Streamlined HUD showing only live dynamic state (time/day, biome, hotbar, dynamic vitals, contextual interaction prompt, optional F3 debug stats).
  - Friendly two-pane Inventory + Smart Crafting/Smelting modal with zero static filler text or fake status chips.

## 5. Verification & Testing
- [x] Automated Node verification suites (`tests/verify_engine.mjs` + full-stack JSDOM UI/crafting/save suite) testing worldgen determinism, DDA raycasting, chunk meshing & CCW face winding, BFS skylight & cross-chunk torchlight, crafting/smelting progression, collision physics, and save serialization.
- [x] Production `npm run build` validation (`dist/index.html` generated cleanly).
