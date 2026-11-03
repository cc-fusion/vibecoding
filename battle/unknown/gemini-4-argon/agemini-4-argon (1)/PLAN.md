# Voxelwild — Implementation Plan

## 1. Architecture & Technology Decisions
- **Core Stack**: Plain HTML (`index.html`), Vanilla CSS (`src/styles.css`), and modular Vanilla JavaScript ES Modules (`src/main.js` + `src/game/**`), powered by **Three.js** (`r186`). No React UI runtime is used as the main body of the application.
- **Build Compatibility**: Entry point wired directly through `index.html` so `npm run build` (`vite build`) produces a self-contained `dist/index.html` cleanly with zero warnings.
- **UI Philosophy**: Friendly, organized, clutter-free interface. Every visible HUD element is dynamic and functional (no static filler badges or unnecessary boilerplate disclaimers).

## 2. Module Breakdown (`src/`)
1. `src/main.js` — Bootstrapper connecting DOM, Settings, World Storage, Input, Audio, UI Manager, and Game Loop.
2. `src/styles.css` — Clean, responsive styling for title/pause screen, HUD, hotbar, crafting/inventory modal, furnace/chest modals, and tooltips.
3. `src/game/constants.js` — World dimensions (`CHUNK_SIZE = 16`, `WORLD_HEIGHT = 128`, `SEA_LEVEL = 44`), physics constants, day-night timings, and enums.
4. `src/game/data/blocks.js` — Registry of 40+ voxel block & item types (properties: solidity, transparency, light emission, hardness, preferred tool, drops, blast/burn/food values, texture faces).
5. `src/game/data/recipes.js` — Complete crafting & furnace smelting recipes organized by friendly categories (`Basics`, `Tools & Weapons`, `Building`, `Utility & Light`, `Food`).
6. `src/game/math/noise.js` — Seeded PRNG (`mulberry32`) + fast 2D/3D Simplex & Fractal Brownian Motion (FBM) noise for deterministic terrain, biomes, caves, and ores.
7. `src/game/rendering/TextureAtlas.js` — Procedural 16×16 pixel-art texture generator packed into a gutter-padded atlas (`CanvasTexture` with `NearestFilter`) plus matching 2D item/block UI icon data URLs.
8. `src/game/world/Chunk.js` — `Uint8Array` block & packed 4-bit sky/block light storage with local/world coordinate helpers.
9. `src/game/world/TerrainGenerator.js` — Multi-biome terrain generator (Emerald Plains, Birch/Oak Forest, Sunscorched Desert, Snowy Taiga, Alpine Peaks, Ocean/Beach), 3D caves, ore veins, trees, flora, and rare ruins with loot chests.
10. `src/game/world/Lighting.js` — Fast BFS skylight columns & 3D flood-fill blocklight propagation (Torches, Glowstone, Lava, Lit Furnaces) across chunk boundaries.
11. `src/game/world/ChunkMesher.js` — Culled-face voxel mesher generating Opaque, Cutout (cross-quads & leaves), and Translucent (animated water/ice/glass) geometries with per-vertex Smooth Ambient Occlusion (AO), anisotropy-corrected quads, and sky/torch light attributes.
12. `src/game/world/World.js` — Dynamic chunk streaming around the player, Spiral load queue, DDA voxel raycasting, block mutation, neighbor remeshing, falling sand/gravel support, active furnaces, and chest state tracking.
13. `src/game/entities/Player.js` — First-person camera controller, AABB swept voxel collision, coyote time & jump buffering, sprinting, sneaking (edge-guard), swimming & underwater air, fall damage, health/hunger/regeneration, and 3D held item/tool viewmodel with swing/bob animations.
14. `src/game/entities/EntityManager.js` — Articulated 3D voxel creatures (Sheep, Pig, Cow, Chicken, Night Zombie, Cave Stalker) with wandering/fleeing/pursuing AI, combat knockback, plus 3D bobbing dropped items with magnetic collection.
15. `src/game/effects/SkyAndWeather.js` — Dynamic sky dome shader, orbiting Sun & Moon, drifting 3D cloud layer, day-night lighting curves, underwater fog transition, and rain/snow GPU particle weather.
16. `src/game/effects/ParticleSystem.js` — 3D voxel block-break debris, torch embers, furnace smoke, and combat hit particles with voxel gravity & collision.
17. `src/game/audio/AudioEngine.js` — Procedural Web Audio API synthesizer for material-aware footsteps, block breaking/placing, tool swings, crafting chimes, water splashes, weather ambience, and sparse serene ambient music.
18. `src/game/systems/Inventory.js` — 36-slot inventory (9 hotbar + 27 backpack), stack management, tool durability, smart recipe evaluation, one-click/stack crafting, chest transfers, and furnace smelting.
19. `src/game/storage/WorldStorage.js` — `IndexedDB` persistence saving modified chunk deltas, player state, inventory, chests, furnaces, world metadata, and user settings.
20. `src/game/ui/UIManager.js` — Clean DOM UI controller for Title/Pause menu, World Selector/Creator, Hotbar, Health/Hunger/Air bars, Smart Crafting Workshop, Furnace & Chest panels, contextual interaction prompts, and optional step-by-step Starter Guide.

## 3. Execution & Verification Phases
1. **Phase 1: Core Data, Math, Audio & Procedural Texture Atlas** — Build deterministic noise, block/item definitions, recipes, procedural pixel-art atlas + UI icons, and Web Audio synthesizer.
2. **Phase 2: World Engine, Lighting, Meshing & Persistence** — Implement Chunk, TerrainGenerator, BFS Lighting, AO ChunkMesher, custom day/night chunk shaders, World streaming, DDA raycast, and IndexedDB storage.
3. **Phase 3: Player Physics, Held Viewmodel, Creatures, Sky/Weather & Particles** — Implement responsive AABB physics, tool mining speeds, 3D viewmodel, passive/hostile creatures, dropped items, sky/clouds/weather, and debris particles.
4. **Phase 4: Friendly Plain HTML/CSS UI & Full Game Integration** — Build `index.html`, `src/styles.css`, `Inventory.js`, `UIManager.js`, and `src/main.js` tying all loops together cleanly.
5. **Phase 5: Automated Testing, Runtime Browser Verification & Build Validation** — Test terrain/meshing/physics/crafting/persistence, inspect in headless browser / runtime harness, fix any defects or visual seams, and verify `npm run build`.
