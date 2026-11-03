# TerraVox — 3D Voxel Sandbox Architecture & Implementation Plan

## 1. Core Architecture & Technology Choices
- **Main Application Body**: Plain HTML (`index.html`), Plain CSS (`src/styles.css`), and Vanilla ES Modules (`src/main.js` + `src/game/...`). Zero React in the application runtime.
- **3D Rendering Engine**: Three.js (`three` r186) with custom procedural pixel-art texture atlas generation, custom vertex-lit/AO chunk `BufferGeometry`, and custom sky shader/dome.
- **Build & Packaging**: Compatible with `npm run build` (`vite build` + `vite-plugin-singlefile`) to output a standalone `dist/index.html` without touching `package.json` or `vite.config.ts`.

## 2. Module Breakdown
1. `src/game/constants.js`
   - Chunk constants (`CHUNK_SIZE = 16`, `CHUNK_HEIGHT = 96`, `SEA_LEVEL = 30`), physics parameters, day-night cycle timing, reach distance, and game mode enums.
2. `src/game/math/noise.js`
   - Seeded deterministic PRNG (`mulberry32` + string seed hashing).
   - 2D & 3D Simplex/Perlin noise, Fractal Brownian Motion (FBM), ridged multifractal noise, and domain warping.
3. `src/game/blocks.js`
   - Complete block and item registry (35+ blocks, ores, flora, crafting stations, lighting blocks, plus tools, weapons, ingots, and food items).
   - Properties: solidity, transparency, fluid flag, cutout cross-mesh flag, hardness, preferred tool type & tier, light emission, drops, and food/fuel values.
4. `src/game/textures.js`
   - Procedural 16x16 pixel-art texture atlas (`CanvasTexture` with `NearestFilter` and UV inset margins to eliminate mipmap/edge bleeding).
   - 2D isometric/icon sprite generator (`dataURL` cache) for crisp UI rendering of blocks, tools, resources, and food.
5. `src/game/world/biomes.js` & `src/game/world/generator.js`
   - Multi-noise climate biomes: Emerald Plains, Whispering Forest, Golden Desert, Frostpeak Taiga, Alpine Peaks, and Sandy Shores.
   - 3D cave carving, depth-stratified ore veins (Coal, Iron, Gold, Diamond), surface trees (Oak, Birch, Spruce, Cactus), flora, and occasional stone ruins/campgrounds.
6. `src/game/world/lighting.js` & `src/game/world/mesher.js`
   - Chunk border-aware face culling.
   - Smooth 4-corner voxel Ambient Occlusion + directional face shading + Torch/Glowstone block-light attenuation + Skylight shafts.
   - Three clean geometry layers per chunk: Solid Opaque, Alpha-Cutout Flora/Torches, and Translucent Animated Water.
7. `src/game/world/world.js`
   - Dynamic chunk streaming around player coordinates with frame-budgeted generation and meshing queues.
   - Delta-based block modification map per chunk for compact persistence.
8. `src/game/player/physics.js` & `src/game/player/controller.js`
   - Swept/axis-separated AABB collision detection, gravity, coyote time, jump buffering, sneak edge-guarding, sprint FOV effect, swimming buoyancy, and creative flight.
   - Fast voxel DDA raycasting for exact block face selection, progressive mining crack overlay, block placement validation, and entity hit detection.
   - First-person 3D held item/block/tool viewmodel with walk bob and swing animations.
9. `src/game/gameplay/inventory.js`, `src/game/gameplay/crafting.js`, & `src/game/gameplay/progression.js`
   - 9-slot Hotbar + 27-slot Backpack with stack splitting, quick-transfer, durability tracking, and hunger/health/oxygen survival loop.
   - Friendly category-based Recipe & Smelting system sensitive to nearby Crafting Tables and Furnaces.
   - Collapsible progression milestones guiding players from gathering wood to forging diamond tools.
10. `src/game/entities/mobs.js`, `src/game/entities/drops.js`, & `src/game/entities/particles.js`
    - Articulated 3D voxel creatures (Sheep, Pigs, Chickens by day; Dusk Zombies & Slimes at night in Survival) with AI wandering/fleeing/chasing and physics collisions.
    - 3D bobbing item drops with magnetic pickup and voxel burst particles on mining, combat, water splashes, and weather.
11. `src/game/atmosphere/sky.js` & `src/game/audio/sound.js`
    - Dynamic day/night cycle (sun, moon, stars, clouds, dynamic hemisphere/directional lighting, fog tinting, and biome-aware rain/snow weather).
    - Web Audio API procedural sound effects (surface-specific footsteps, mining taps, block break crunch, water splash, pickups, combat, and optional gentle ambient chords).
12. `src/game/storage/saveManager.js` & `src/game/ui/uiManager.js`
    - IndexedDB multi-world persistence (seed, deltas, player state, inventory, time, settings) with auto-save.
    - Clean, approachable HTML/CSS UI free of static filler text or unused chips.

## 3. Verification & Iteration Plan
- Build with `npm run build` and verify zero warnings/errors.
- Launch built app in headless Chromium via Playwright with WebGL enabled.
- Verify world generation, chunk meshing, FPS, first-person movement, physics collisions, block breaking/placement, inventory & crafting workflows, day-night lighting, creatures, and IndexedDB world save/reload.
- Capture and inspect screenshots across gameplay states and refine visuals/UX based on runtime testing.
