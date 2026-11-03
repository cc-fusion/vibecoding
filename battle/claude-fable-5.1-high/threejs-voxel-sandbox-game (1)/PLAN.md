# Voxelcraft — Implementation Plan

## Environment
- React 19 + Vite 7 + Tailwind 4, TypeScript strict, single-file build (vite-plugin-singlefile).
- three.js installed (0.186). Headless Chromium available via Playwright for runtime testing.
- Single-file bundle → no separate worker files; chunk generation/meshing runs on the main thread with a per-frame time budget and distance-priority queues.

## Architecture (src/game)
| Module | Responsibility |
|---|---|
| `noise.ts` | Seeded simplex 2D/3D + fBm/ridged helpers |
| `blocks.ts` | Block & item registry (shape, hardness, tool tier, drops, light, sounds) |
| `textures.ts` | Procedural 16px pixel-art atlas (canvas) + isometric item icons for UI |
| `worldgen.ts` | Column-deterministic terrain: continental/erosion/peak noise, biomes (ocean, beach, desert, plains, forest, birch, taiga, mountains, rivers), caves, ores, lava, trees/cacti/flora |
| `world.ts` | Chunk storage (16×128×16), streaming, dirty tracking, diff persistence hooks |
| `mesher.ts` | Culled face meshing w/ smooth per-vertex AO, flood-fill sky + block light (BFS, 16-block margin), opaque/cutout + water passes |
| `materials.ts` | Custom ShaderMaterials: sun-scaled sky light, warm block light, fog, water waves |
| `physics.ts` | AABB voxel collision, swept axis resolution, DDA raycast |
| `player.ts` | First-person controller (walk/sprint/sneak/jump/swim/fly), health/hunger/air/fall damage |
| `inventory.ts` / `crafting.ts` | Stacks, hotbar, recipe book crafting (hand / table / furnace smelting) |
| `mobs.ts` | Pig/Sheep/Cow/Zombie: box models, wander/chase AI, spawning, drops, daylight burning |
| `entities.ts` | Dropped item entities with physics + magnet pickup |
| `particles.ts` | Pooled point particles (block break, hits, splash, fire) |
| `sky.ts` | Day/night cycle, gradient sky dome, sun/moon/stars, clouds, weather (rain/snow/storm) |
| `audio.ts` | Procedural Web Audio SFX, ambience, generative music |
| `save.ts` | localStorage worlds index + per-world save (chunk diffs, player, time) |
| `store.ts` | Tiny observable store bridging game → React HUD |
| `game.ts` | Orchestrates loop, input, interaction, streaming, achievements |

## UI (src/ui)
Main menu (world list / create with seed, mode, difficulty), loading screen, HUD (hotbar, health, hunger, air, crosshair, target info, toasts, debug), inventory + crafting screen, pause/settings, death screen.

## Verification
- `npm run build` must pass.
- Playwright headless run: load, create world, screenshot, check for console errors, simulate input.
