# Voxel Sanctuary — implementation plan

## 1. Runtime and world engine
- Plain HTML/CSS/JavaScript entry point; Three.js for rendering, Vite only as bundler.
- Seeded terrain noise with continental, erosion, temperature and moisture fields.
- Multiple biomes, surface materials, caves, strata, ores, trees and water.
- 16×16 column chunks, face-culled BufferGeometry, separate opaque/cutout/water passes.
- Distance-based streaming and bounded per-frame generation/meshing work.
- Sparse saved block edits and persistent player/world state in localStorage.

## 2. Player and interaction
- Pointer-lock first-person camera with mouse sensitivity and FOV settings.
- Fixed-step gravity, grounded/jump logic, AABB voxel collision, step handling and swimming.
- DDA voxel selection, reach limits, mining hardness/tool tiers, placement validation.
- Stack inventory, hotbar, drops, crafting recipes, tool durability and consumables.

## 3. Living world and progression
- Day/night cycle, sun/moon, stars, fog, clouds, rain and lightning.
- Passive and hostile entities with movement, steering, attacks and loot.
- Health, hunger, regeneration, XP levels and unlockable crafting progression.
- Summonable Ancient Guardian with telegraphed attacks and a useful reward.

## 4. Presentation and usability
- Procedural pixel material atlas with per-block variation and animated water.
- Break particles, hit feedback, camera bob, item animation and synthesized Web Audio.
- Focused title screen, world creation/loading, HUD, inventory/crafting, pause and settings.
- Clear control hints, contextual prompts, save feedback and responsive layouts.

## 5. Verification
- Audit all UI controls and gameplay paths for real implementations.
- Check persistence, collision edge cases, chunk lifecycle and resource cleanup.
- Run the production build and fix all reported errors.
