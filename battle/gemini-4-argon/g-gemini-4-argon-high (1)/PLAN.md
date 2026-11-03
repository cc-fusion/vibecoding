# VoxelCraft — Engineering & Implementation Plan

## 1. Architecture Overview
- **Tech Stack**: Plain HTML (`index.html`), modular Vanilla JavaScript ES Modules (`src/main.js`, `src/game/*.js`), Vanilla CSS (`src/style.css`), and **Three.js** (`three`). Built cleanly via Vite (`npm run build`) into `dist/index.html`.
- **Design Goals**: High visual polish, 60 FPS chunk meshing & streaming, reliable axis-separated AABB collision physics, intuitive & uncluttered UI, cohesive survival + creative loops, living creatures, dynamic day-night/weather/lighting, procedural Web Audio, and persistent IndexedDB world saves.

## 2. Module Breakdown
1. `src/game/constants.js` — World dimensions (`CHUNK_SIZE = 16`, `CHUNK_HEIGHT = 96`, `SEA_LEVEL = 34`), physics constants, game modes, biome definitions.
2. `src/game/noise.js` — Deterministic seeded PRNG (`mulberry32`) + fast 2D/3D Simplex/Perlin FBM & ridge noise for terrain, biomes, caves, and ore veins.
3. `src/game/items.js` — Block & item registry (35+ blocks, tools across Wood/Stone/Iron/Diamond tiers, food, utility items), block properties (hardness, preferred tool, transparency, light emission, cross-mesh flora, drops), and categorized crafting recipes.
4. `src/game/textures.js` — Procedural 16x16 pixel-art texture atlas generator with 8px extruded edge padding per cell (`NearestFilter`, zero seam bleeding) + crisp 2D item/block icon canvases for UI slots.
5. `src/game/shader.js` — Custom Three.js voxel materials (Opaque, Alpha-Test Flora/Torch, Translucent Water/Glass) supporting smooth per-vertex Ambient Occlusion, directional face shading, dual-channel `skyLight` + `blockLight` (warm flickering torch/glowstone light), underwater tint, and atmospheric horizon fog without remeshing chunks during day/night transitions.
6. `src/game/terrain.js` — Biome-driven procedural chunk generator (Emerald Plains, Forest, Golden Desert, Snowy Taiga, Alpine Peaks, Underground Caves), stratified ores (Coal, Iron, Gold, Diamond, Glowstone/Crystal), procedural trees (Oak, Birch, Pine, Cactus), surface flora, and rare oasis/ruin features.
7. `src/game/mesher.js` — Culled chunk geometry builder generating separate opaque, flora/torch, and translucent water meshes with quad-flip-corrected smooth voxel AO and cross-chunk light/neighbor sampling.
8. `src/game/world.js` — Chunk manager, time-budgeted spiral chunk streaming & disposal, BFS local block-light propagation, cellular water spread updates, and 3D DDA voxel raycasting.
9. `src/game/player.js` — First-person camera & PointerLock controls, axis-separated AABB collision resolution, walking, sprinting (dynamic FOV), jumping, sneaking with ledge-fall protection, swimming/buoyancy, Creative flight mode, fall damage, health & hunger/regen, block breaking progression, block placement, and held 3D item/hand viewmodel with swing & walk-bob animations.
10. `src/game/entities.js` — Dropped 3D item entities (gravity, bounce, spin, magnetic pickup) and articulated 3D voxel creatures (Sheep, Pig, Cow, Chicken, plus nighttime Zombie/Slime in Survival) with AI wandering/fleeing/pursuing, animations, combat knockback, and loot drops.
11. `src/game/particles.js` & `src/game/sky.js` — Instanced/pooled voxel debris particles, splashes, torch embers; dynamic sky dome, orbiting Sun & Moon, 3D starfield, drifting voxel clouds, and biome-aware Rain/Snow weather.
12. `src/game/audio.js` — Synthesized Web Audio sound effects (material-specific footsteps, dig/break/place sounds, splash, pickup pop, tool swing, eat, UI click, rain ambiance, and optional gentle ambient music notes).
13. `src/game/storage.js` — IndexedDB persistent storage saving multiple worlds (seed, mode, player state, inventory, time, and sparse chunk modification deltas) + JSON world export/import.
14. `src/game/ui.js` & `src/style.css` & `index.html` — Friendly, clean, well-organized UI: Title screen with world manager & seed/mode picker, minimal HUD (crosshair, hotbar, hearts, live biome/time pill), 2-column Inventory + 1-Click Recipe Book & Creative Palette (`E`), Pause & Settings menu (`Esc`).

## 3. Execution & Verification Phases
- **Phase 1**: Install `three` and set up clean HTML/CSS/JS entry structure.
- **Phase 2**: Implement core math/noise, block/item registry, procedural pixel-art atlas, and custom AO + dual-light voxel shaders.
- **Phase 3**: Implement chunk terrain generation, lighting, culled AO mesher, water flow, and streaming world manager.
- **Phase 4**: Implement player physics/collisions, DDA raycast, block mining/placement, held viewmodel, inventory, and crafting progression.
- **Phase 5**: Implement sky/day-night/weather, particles, dropped items, creatures, Web Audio, and IndexedDB persistence.
- **Phase 6**: Polish friendly UI/UX, run headless/unit & runtime verification tests, fix any issues, and confirm clean `npm run build`.
