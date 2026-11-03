# TerraCraft — Voxel Sandbox Architecture & Implementation Plan

## 1. Environment & Stack Strategy
- **Core Stack**: Plain HTML (`index.html`), Plain CSS (`src/style.css`), and Modular Vanilla JavaScript ES Modules (`src/main.js` + `src/...`) powered by **Three.js**. No React in the application runtime.
- **Build Compatibility**: Compatible directly with Vite's bundler (`npm run build` -> single-file `dist/index.html`) while keeping the entire codebase pure HTML, CSS, and Vanilla JS.

## 2. Module Breakdown
1. `src/constants/Blocks.js`
   - Complete registry of blocks & non-placeable items (tools, weapons, food, ingots, sticks, coal, diamond).
   - Properties: hardness, preferred tool, drops, transparency, cross-mesh flora flag, liquid flag, light emission level, blast resistance, stack size.
2. `src/constants/Recipes.js`
   - Categorized crafting & furnace smelting recipes (`Basics`, `Tools & Combat`, `Building`, `Utility`, `Smelting`), supporting hand-crafting and Crafting Table / Furnace tiers.
3. `src/engine/TextureAtlas.js`
   - Procedural 16x16 pixel-art texture generator with 4px extruded edge padding per slot (eliminating UV seam bleeding) for every block face and item icon, plus separate data URLs for crisp UI inventory icons.
4. `src/engine/Noise.js`
   - Deterministic seeded PRNG (`mulberry32` + string seed hash) and 2D/3D Simplex/Perlin FBM noise.
5. `src/world/WorldGen.js`
   - Multi-parameter biome classification (Plains, Oak/Birch Forest, Desert, Snow Taiga, Alpine Peaks, Ocean/Beach).
   - Heightmap synthesis, 3D cave carving, depth-stratified ore veins (Coal, Iron, Gold, Diamond, Glow Crystal), procedural trees (Oak, Birch, Spruce, Cactus), flora, and rare explorer structures.
6. `src/world/ChunkMesher.js`
   - Culled face mesher producing separate opaque/cutout and translucent water geometries per `16x96x16` chunk.
   - Smooth per-vertex 4-sample Ambient Occlusion with quad diagonal anisotropy fix, directional face shading, biome foliage tinting, and local BFS voxel torch/crystal block lighting.
7. `src/world/World.js`
   - Spiral chunk streaming around the player within frame budgets, cross-chunk voxel editing, BFS voxel light updates, TNT explosions, water flow/surface logic, and dirty-chunk immediate remeshing.
8. `src/physics/PlayerController.js`
   - First-person PointerLock controls, WASD + Sprint (with dynamic FOV) + Shift Sneak (with edge-fall guard) + Jump (coyote time) + Swimming + Creative Flight toggle.
   - Axis-separated (`Y -> X -> Z`) swept AABB voxel collision, fall damage, hunger/health survival mechanics.
   - Exact 3D DDA voxel raycasting + progressive block breaking, crack stage mesh, placement validation, and animated 3D first-person held item/hand.
9. `src/entities/EntityManager.js`
   - Dropped 3D rotating item entities with physics & magnetic pickup.
   - Articulated voxel creatures: Sheep, Pig, Chicken (passive) and Zombie, Cave Slime (hostile at night/caves in Survival), with AI, animations, combat knockback, and loot drops.
   - Ignited TNT entities with fuse animation and crater blast.
   - Voxel particle system (block break debris, torch flames, water splashes, explosion smoke).
10. `src/atmosphere/SkyWeather.js`
    - Smooth day-night cycle with sky dome shader, orbiting voxel Sun & Moon, night starfield, dynamic directional/hemisphere lighting, horizon-matched fog, and Rain/Snow weather particles.
11. `src/audio/SoundManager.js`
    - Web Audio API procedural sound synthesis for material-specific footsteps, mining hits/breaks, block placement, item pickup, splash, combat, crafting, and explosions.
12. `src/storage/SaveManager.js`
    - IndexedDB persistence storing world metadata, player state, inventory, time, and compressed chunk block-modification deltas, plus JSON export/import.
13. `src/ui/UIManager.js` & `src/style.css`
    - Clean, friendly, uncluttered vanilla DOM UI:
      - Title Screen & World Selector over live 3D voxel panorama
      - Crisp HUD (Hotbar, Hearts/Hunger/Oxygen when relevant, Crosshair, Dynamic Biome/Time context, optional `F3` diagnostics)
      - Intuitive Inventory + One-Click Categorized Crafting/Smelting & Creative Palette (`E`)
      - Clean Pause & Settings menu (`Esc`) and Respawn overlay.

## 3. Verification & Iteration Plan
- Install `three` and verify asset/module resolution.
- Write automated Node verification scripts to test world generation determinism, biome coverage, chunk meshing integrity, recipe completeness, AABB collision edge cases, DDA raycasting, and save/load serialization.
- Run dev/preview server and verify clean production bundle with `npm run build`.
