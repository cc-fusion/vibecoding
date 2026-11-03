# TerraVox — 3D Voxel Sandbox Engine & Game Plan

## 1. Architecture Overview
TerraVox is a full-featured, single-file-bundle-compatible 3D voxel sandbox built with **Three.js**, **TypeScript**, **React 19**, and **Tailwind CSS**. The architecture strictly decouples simulation data and pure voxel algorithms (`src/game/*`) from Three.js rendering orchestration (`src/game/engine.ts`) and React UI overlays (`src/components/*`), allowing both smooth 60+ FPS browser gameplay and direct headless Node.js runtime verification of core game systems.

## 2. Planned Directory & Module Structure
- `src/game/constants.ts` — World dimensions (`CHUNK_SIZE = 16`, `WORLD_HEIGHT = 96`, `SEA_LEVEL = 34`), physics constants, day length, light levels.
- `src/game/types.ts` — Core TypeScript types for blocks, items, tools, recipes, biomes, mobs, particles, UI snapshots, and world saves.
- `src/game/math/noise.ts` — Seeded PRNG (`mulberry32`), hash helpers, 2D & 3D Perlin/Simplex noise, fractional Brownian motion (`fbm2`, `fbm3`), ridged multifractal noise.
- `src/game/blocks.ts` — Registry of 36 voxel block types (terrain, ores, woods, leaves, flora cross-quads, glass, crafting table, furnace, chest, bookshelf, torch, glowstone, TNT, water, ice) with hardness, tool affinity, light emission, transparency, and drop tables.
- `src/game/items.ts` — Item & tool definitions (5 tiers × 4 tool classes, food items, refined ingots, raw materials, placeable blocks), stack limits, durability, damage, and mining multipliers.
- `src/game/textures.ts` — Procedural 16×16 pixel-art texture atlas generator (256×256 `NearestFilter` atlas with half-texel UV inset) + crisp 32×32 standalone item/tool/block icon data URLs for HUD and held viewmodels.
- `src/game/worldGen.ts` — Multi-biome procedural terrain (Emerald Plains, Whispering Forest, Sunbaked Desert, Frostpeak Mountains, River Valleys & Beaches), 3D caves, depth-stratified ores, cross-chunk deterministic trees (Oak, Birch, Spruce, Cactus), flora, and ancient stone ruins.
- `src/game/lighting.ts` — Chunk sky-light column pass + 3D BFS block-light propagation across chunk boundaries for Torches, Glowstone, and Lit Furnaces.
- `src/game/mesher.ts` — High-performance 3-pass chunk mesher (Opaque + Cutout Flora/Glass/Torch + Translucent Water/Ice) with face culling, directional shading, smooth 4-neighbor vertex Ambient Occlusion (AO) with quad diagonal flip fix, and per-vertex sky/block light attributes.
- `src/game/materials.ts` — Custom `ShaderMaterial` / `MeshLambertMaterial.onBeforeCompile` voxel shaders combining day-night skylight curves, warm flickering block light, vertex wind sway on leaves/flora, and animated water ripples.
- `src/game/raycast.ts` — Exact 3D Amanatides & Woo DDA voxel raycaster returning hit block coords, normal face, hit point, and distance.
- `src/game/physics.ts` — Fixed-timestep axis-separated AABB collision solver with coyote time, jump buffer, sneak edge-guard, sprinting, water buoyancy/swimming, creative flight, and fall damage.
- `src/game/recipes.ts` — 32+ crafting recipes (hand 2×2 & Crafting Table 3×3) + Furnace smelting recipes & fuels, with helper functions for inventory affordability, crafting execution, and smelting simulation.
- `src/game/mobs.ts` — Articulated 3D voxel creatures (Sheep, Pig, Cow, Chicken, Zombie, Creeper) with AI state machines (wander, flee, chase, creeper fuse & explosion), voxel physics, animations, combat knockback, and loot drops.
- `src/game/particles.ts` — Instanced/pooled 3D voxel particle bursts (mining chips, block break bursts, torch flames, explosions, splashes) + weather precipitation (Rain & Snow).
- `src/game/audio.ts` — Procedural Web Audio synthesizer for material-specific footsteps/mining sounds, pickups, crafting chimes, explosions, mob cues, thunder, and optional calm ambient piano melodies.
- `src/game/storage.ts` — IndexedDB persistent multi-world storage (with `localStorage` fallback) storing world metadata, sparse chunk modification deltas, player state, inventory, furnaces, and progression milestones.
- `src/game/engine.ts` — Main `VoxelEngine` coordinator managing Three.js scene, sky dome, sun/moon/stars, first-person 3D held viewmodel, chunk streaming queue, game loop, input bindings, combat, TNT fuses, progression tracker, and throttled UI state snapshots.
- `src/components/*` — Clean React UI layer: Title/World Manager screen, HUD (crosshair, hearts, hunger, breath, hotbar, active item tooltip, biome/clock/coords badge, milestone toast, underwater & damage vignettes), Inventory/Crafting/Smelting modal, Pause/Settings modal, Controls reference, and Game Over respawn overlay.
- `tests/engine.test.ts` — Automated runtime verification test suite executed via `esbuild` + `node --test` validating noise determinism, world generation, caves/ores, block breaking/placement, lighting propagation, meshing & AO, DDA raycasting, AABB physics & swimming, crafting & smelting, mob AI, and serialization persistence.

## 3. Execution Order & Verification Milestones
1. Build pure data & math foundations (`constants.ts`, `types.ts`, `math/noise.ts`, `blocks.ts`, `items.ts`, `recipes.ts`).
2. Build procedural pixel-art atlas & icons (`textures.ts`) and custom voxel shaders (`materials.ts`).
3. Build world generation (`worldGen.ts`), skylight/blocklight propagation (`lighting.ts`), and 3-pass AO chunk mesher (`mesher.ts`).
4. Build DDA raycaster (`raycast.ts`), player AABB physics (`physics.ts`), Web Audio synth (`audio.ts`), particles (`particles.ts`), articulated mobs (`mobs.ts`), and IndexedDB save manager (`storage.ts`).
5. Assemble `VoxelEngine` (`engine.ts`) with sky dome, sun/moon/stars, handheld 3D viewmodel, dropped 3D items, TNT physics, and progression milestones.
6. Build responsive React HUD, Inventory/Crafting/Smelting station UI, World Selector, and Settings (`src/components/*`, `src/App.tsx`).
7. Write and run `tests/engine.test.ts` via Node `node:test`, fix any edge cases discovered, verify `tsc --noEmit` and `npm run build` succeed cleanly.
