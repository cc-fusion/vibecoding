# Terravox — Voxel Sandbox Game Architecture & Implementation Plan

## 1. Core Stack & Entry Structure
- **Plain HTML, CSS, and Vanilla JavaScript (ES Modules)** with **Three.js** (`three`).
- No React runtime or JSX; `index.html` mounts the semantic HUD/menus directly and loads `/src/main.js` and `/src/styles.css`.
- Compatible with `npm run dev`, `npm run preview`, and `npm run build` (single-file bundle in `dist/index.html`).

## 2. Module Breakdown (`src/game/`)
1. `constants.js` — World dimensions (`CHUNK_SIZE = 16`, `WORLD_HEIGHT = 128`, `SEA_LEVEL = 42`), physics constants, game modes, lighting curves.
2. `noise.js` — Deterministic seeded PRNG (`Mulberry32`) + 2D/3D Simplex/Perlin FBM & ridged multifractal noise generators.
3. `textures.js` — Procedural `16x16` pixel-art texture generator with 8px extruded border padding per `32x32` cell (eliminates UV seam bleeding under `NearestFilter`) + crisp UI icon data URLs for blocks, tools, materials, and food.
4. `blocks.js` — Complete registry of ~40 blocks, flora, fluids, light emitters, tools, weapons, ores, and food items with hardness, preferred tool type, harvest tier, light emission, translucency, and drop tables.
5. `recipes.js` — Crafting recipes (Hand Crafting vs. Crafting Table tiers) and Furnace smelting recipes (instant/timed fuel-assisted smelting for ores, glass, bricks, and cooked food).
6. `terrain.js` — Multi-biome procedural generator (Emerald Plains, Forest/Birch Grove, Desert Canyon, Boreal Taiga, Snowy Alpine Peaks, Azure Coast), 3D caves, stratified ore veins, trees/flora, and wilderness ruins.
7. `lighting.js` — Packed nibble skylight (`0..15`) and blocklight (`0..15`) propagation for real cave darkness and warm glowing torches, lanterns, crystals, and lava.
8. `mesher.js` — High-performance 3-pass chunk mesher (opaque/cutout solids with neighbor face culling & 4-corner smooth Voxel AO, crossed-quad flora & 3D torches, translucent animated water) outputting GPU-ready `BufferGeometry` with `aLight` (`vec2(sky, block)`).
9. `materials.js` — Custom Three.js shader materials supporting dynamic day-night sky/torch lighting without chunk remeshing, horizon & underwater fog, foliage wind sway, and animated water waves.
10. `world.js` — Chunk manager, spiral streaming queue within frame budgets, voxel read/write, cellular water flow updates, cross-chunk neighbor remeshing, and delta tracking for persistence.
11. `physics.js` — Sub-stepped axis-separated AABB collision solver, gravity, jumping, sprinting, crouch edge-guard, water buoyancy/swimming, creative flight, and exact 3D DDA voxel raycasting.
12. `entities.js` — Dropped 3D rotating magnetic items + articulated 3D voxel creatures (Sheep, Pigs, Cows, Night Stalkers) with AI steering, animations, combat knockback, and loot drops.
13. `environment.js` — Dynamic sky dome shader, orbiting 3D Sun & Moon, twinkling stars, drifting 3D voxel clouds, and biome-aware Rain/Snow particle weather.
14. `particles.js` — Pooled 3D voxel burst particles for block mining/breaking, water splashes, torch flames, and combat hits.
15. `hand.js` — First-person 3D held block/tool viewmodel with walk bobbing, mining swing, and placement animations + 3D crack stage overlay mesh.
16. `audio.js` — Procedural WebAudio synthesizer for footsteps, material-specific mining/placing, splashes, combat, item pickup, crafting, eating, and weather ambiance.
17. `storage.js` — IndexedDB persistent storage for multiple saved worlds (metadata, player state, inventory, time, milestones, and compressed chunk deltas).
18. `ui.js` — Friendly, uncluttered plain-DOM UI controller (Title/World Manager over live 3D flyover, clean HUD, Hotbar, unified Inventory + Recipe Book + Furnace UI, Pause/Settings, and milestone progression).

## 3. UI Organization Principles
- Clean, friendly, organized panels over dense clutter.
- Zero static unused status chips (every HUD indicator reflects live state: biome, sun/moon cycle, weather, health, hunger, oxygen underwater, flight status).
- No filler legal/browser boilerplate text.

## 4. Testing & Verification Plan
- Automated headless Chromium + WebGL verification via Playwright (`scripts/verify-game.mjs`):
  - Verify zero console errors and zero uncaught page errors.
  - Test Title Screen live 3D flyover -> World Creation -> Pointer lock / gameplay HUD.
  - Test player physics, movement, raycast targeting, block breaking, item drop collection, block placement, inventory & crafting, furnace smelting, time/weather transitions, and world save/reload persistence.
  - Capture and visually inspect screenshots across title screen, daytime biomes, inventory/crafting UI, and night/torchlight scenes.
- Final `npm run build` verification producing clean `dist/index.html`.
