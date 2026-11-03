# TerraCraft — Three.js Voxel Sandbox Engineering Plan

## 1. Architecture & UI Philosophy
- **Pure Plain HTML, CSS, and Modular Vanilla ES JavaScript** (`index.html`, `styles/main.css`, `js/...`), bundled cleanly into `dist/index.html` with `three` as the 3D engine (no React runtime or JSX UI).
- **Clean, Friendly, Uncluttered UI**:
  - Clean Title / World Manager screen: Play / Continue World, Create New World (Name, Seed or Biome Preset, Survival vs Creative mode), Saved Worlds list, and clear Controls modal.
  - Minimal in-game HUD: Dynamic health & hunger bars (hidden automatically in Creative mode), clean 9-slot hotbar with true 3D isometric rendered block icons, dynamic contextual key prompts only when relevant, toggleable compact debug/coordinates overlay (`F3`), and clean pause menu (`Esc`).
  - Friendly Inventory & Crafting interface (`E`): Split layout pairing the 27-slot backpack + 9-slot hotbar with a categorized, searchable one-click Recipe Book (auto-highlighting craftable items with clear ingredient counts) plus Furnace smelting support.
  - Zero static fake chips or boilerplate filler text.

## 2. Core Modules (`js/`)
1. `js/constants.js` — World dimensions (`16x96x16` chunks), physics constants, game modes, weather states, keybindings.
2. `js/math/noise.js` — Deterministic seeded PRNG, 2D & 3D Simplex/Perlin multi-octave fractional Brownian motion & ridged multifractal noise.
3. `js/math/raycast.js` — Exact Amanatides & Woo DDA 3D voxel raycaster for block targeting, mining progress, and placement normal calculation.
4. `js/game/blocks.js` — Complete block registry (36+ distinct terrain, flora, ore, wood, masonry, glass, light, functional, and fluid blocks) with hardness, preferred tool type/tier, light emission, drop rules, sound class, and render pass type (`solid`, `flora`, `fluid`).
5. `js/game/items.js` — Complete item & tool registry (Wooden, Stone, Iron, Diamond Pickaxes, Axes, Shovels, Swords; resources; food; buckets; blocks) with durability, mining speed multipliers, attack power, and food restoration.
6. `js/graphics/textures.js` — Procedural 16x16 pixel-art texture generator packed into a gutter-padded 32x32-per-slot texture atlas (zero UV bleeding) + true 3D isometric block icon & crisp pixel-art tool icon renderer for UI DOM slots.
7. `js/world/worldGen.js` — Multi-biome procedural terrain (Plains, Forest, Desert, Snowy Taiga/Peaks, Beaches/Lagoons), 3D caves with surface entrances, ore strata (Coal, Iron, Gold, Diamond, Glow Crystal), cross-chunk trees/cacti/flora, and safe scenic spawn finder.
8. `js/world/mesher.js` — High-performance culled face mesher with smooth 4-level per-vertex Ambient Occlusion, anisotropy-free quad flipping, directional face shading, local torch/crystal light propagation, flora cross-quads, and animated translucent water pass.
9. `js/world/chunkManager.js` — Chunk lifecycle, streaming queue with frame-time budget, instant synchronous dirty remeshing for player edits, delta tracking for persistence, and voxel query API.
10. `js/player/player.js` — First-person camera controller, sub-stepped axis-separated AABB collision, coyote time, jump buffering, sneak edge-guard (`Shift`), swimming buoyancy, fall damage, Survival/Creative flight (`F` / double-space), first-person animated held item/hand viewmodel, block breaking & placement, and combat swing.
11. `js/game/inventory.js` & `js/game/recipes.js` — Stack management, tool durability, 1-click & bulk crafting recipes across all progression tiers, and furnace smelting system.
12. `js/entities/drops.js` & `js/entities/mobs.js` — Spinning 3D dropped item entities with magnetic pickup; articulated 3D voxel creatures (Sheep, Cows, Pigs, Chickens, Zombies, Slimes) with limb animation, AI steering, day/night spawning, combat knockback, and drops.
13. `js/graphics/particles.js` & `js/world/atmosphere.js` — Voxel block-break/hit/splash/smoke particles; dynamic sky dome shader, orbiting 3D sun & moon, drifting 3D cloud layer, starfield, fog sync, and Rain/Snow weather systems.
14. `js/audio/sound.js` — Synthesized Web Audio sound effects (material-specific footsteps/dig/break, water splashes, pickups, crafting, combat, creature vocalizations, rain/wind, and gentle toggleable ambient music notes).
15. `js/storage/persistence.js` — `IndexedDB` multi-world persistence storing chunk deltas, inventory, player state, seed, time, weather, and auto-save.
16. `js/ui/uiManager.js` & `js/main.js` — Clean UI binding, pointer lock management, fixed-timestep simulation loop, settings controls, and runtime diagnostics hook (`window.__TERRACRAFT__`) for automated headless verification.

## 3. Completed Implementation & Runtime Verification Summary
- [x] **Plain HTML, CSS & Modular Vanilla ES JavaScript Architecture**: Zero React dependency in the application runtime; runs cleanly both via direct ES module static serving (`index.html` + `importmap`) and single-file production bundle (`npm run build` -> `dist/index.html`).
- [x] **Performance Optimization Passes**:
  - Upgraded 3D cave generation to trilinear `5×25×5` grid interpolation + spatial mineral vein generation (`generateChunk`: **~0.8 ms** per `16×96×16` chunk).
  - Refactored `mesher.js` to zero-allocation typed corner buffers + 6-neighbor buried solid block culling (`rebuildChunkMesh`: **~14.4 ms** including 4-block 3D BFS torchlight flood-fill and smooth per-vertex AO).
- [x] **End-to-End Automated Playwright + WebGL Suite (`tests/verify.mjs`)**:
  - Verified live WebGL sky & terrain rendering, grounded spawn & vista alignment, `120 Hz` sub-stepped AABB movement & jumping, `Shift` sneak edge-fall protection, block mining & magnetic 3D drop pickup, full crafting & furnace smelting (`Wood Logs -> Planks -> Sticks -> Wooden Pickaxe`, `Iron Ore + Coal -> Iron Ingot -> Iron Sword`), creature combat & ruin chest loot bursts, warm night torch/lantern light propagation in rain, zero broken UI icons, and `IndexedDB` world delta persistence across full page reloads.
