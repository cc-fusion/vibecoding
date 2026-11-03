# VoxelRealms (Three.js Sandbox Game) — Architecture & Implementation Plan

## 1. Core Voxel Engine (`src/engine/`)
- **`constants.ts`**: World dimensions (`CHUNK_SIZE = 16`, `WORLD_HEIGHT = 96`, `SEA_LEVEL = 34`), physics constants, render distance, lighting constants, and TypeScript interfaces.
- **`blocks.ts`**: Complete registry of 36+ voxel blocks (Terrain, Flora, Ores, Building blocks, Functional blocks like Torch, Crafting Table, Furnace, TNT, Glowstone, Water, Lava) and tools/consumables (Wooden, Stone, Iron, Diamond Pickaxes, Axes, Shovels, Swords, Ingots, Food). Defines hardness, preferred tool type, light emission (`0..15`), transparency, fluid flags, and texture atlas tile indices.
- **`textureAtlas.ts`**: Procedural 16x16 crisp pixel-art texture generator producing both a `THREE.CanvasTexture` (`NearestFilter`, `SRGBColorSpace`) for 3D chunk/entity rendering and individual data-URL sprites for crisp HUD & inventory icons (blocks + custom pixel-art tools, ingots, weapons, and food).
- **`noise.ts`**: Deterministic seeded PRNG (`mulberry32`), 2D/3D Simplex/Perlin gradient noise, fBm, and ridged multifractal noise functions.
- **`worldGen.ts`**: Multi-biome terrain generator (Emerald Plains, Whispering Forest, Golden Desert, Frostpeak Taiga, Shattered Crags, Sunlit Coast/Ocean), 3D cave networks, depth-graded ore veins (Coal, Iron, Gold, Diamond, Emerald), trees (Oak, Birch, Pine, Cactus), surface flora, and ancient stone shrines.
- **`chunkMesher.ts`**: High-performance zero-GC typed buffer mesher generating 3 passes per chunk (Opaque/Cutout, Cross-Quad Flora & 3D Torches, Translucent Water/Ice). Computes 4-neighbor smooth vertex Ambient Occlusion (AO), directional face shading, and BFS-propagated voxel block light (Torches, Lava, Glowstone, Lit Furnace).
- **`shaders.ts`**: Custom Three.js shader materials blending dynamic Day/Night sky light with warm local voxel block lighting, distance fog, animated water ripples, and underwater tinting.
- **`world.ts`**: Chunk store, radial priority streaming queue, sparse modification tracking for persistence, BFS light propagation updates on block edits, and TNT explosion craters.

## 2. Physics, Controls, Entities & Audio
- **`raycast.ts`**: Exact 3D DDA voxel raycaster returning hit block coordinates, face normal, exact hit point, and distance.
- **`physics.ts`**: Axis-separated AABB collision resolution (`X`, `Y`, `Z`), walking, sprinting, jumping with coyote grace, crouch edge-guard for safe bridging, creative/free flight toggle, swimming buoyancy, fall damage, and lava/drowning mechanics.
- **`entities.ts`**: 3D bobbing/spinning dropped item entities with gravity, collision, and magnetic pickup; plus articulated 3D voxel creatures (Sheep, Pigs, Cows, Zombies, Slimes) with AI state machines, day/night spawning, combat knockback, and loot drops.
- **`particles.ts`**: Pooled lightweight 3D voxel particle system for block break debris, torch flames, water splashes, and TNT explosions.
- **`audio.ts`**: Zero-dependency Web Audio synthesizer generating material-specific footsteps & mining sounds, item pickup pops, sword swings, mob audio, rain/wind ambience, explosions, and sparse peaceful piano chords.
- **`recipes.ts`**: Crafting recipes (Planks, Sticks, Crafting Table, Furnace, Torches, Tools/Weapons across tiers, Bricks, Stone Bricks, Glowstone, TNT, Bread) and Furnace smelting recipes (Iron, Gold, Glass, Cooked Meat).
- **`storage.ts`**: IndexedDB persistence saving multiple named worlds, seeds, sparse chunk diffs, inventory, player state, time/weather, and progression milestones.
- **`gameEngine.ts`**: Master orchestrator linking Three.js scene, sky dome (sun, moon, stars, 3D clouds, weather particles), first-person held item/arm rig, game loop, input bindings, and clean reactive state snapshot callbacks for React UI.

## 3. User Interface (`src/components/`)
- **`TitleScreen.tsx`**: Atmospheric main menu with saved worlds list, New World creator (World Name, Seed input + scenic seed presets, Survival/Creative mode), and controls overview.
- **`HUD.tsx`**: Crisp crosshair, target block indicator, 9-slot hotbar with durability/stack counts, health hearts, hunger drumsticks, underwater air bubbles, active biome/coordinates/time readout, Explorer's Codex milestone tracker, and toast notifications.
- **`InventoryModal.tsx`**: Full inventory management, one-click & filterable Crafting Workshop + Furnace Smelter with fuel/ore slots, stack swapping, and item tooltips.
- **`PauseModal.tsx`**: World settings (Render Distance, FOV, Audio volume, Day/Night & Weather quick controls, Game Mode switch, Save World, Return to Title).
- **`ControlsHelp.tsx`**: Compact toggleable keybind overlay (`H` key) so every mechanic is immediately discoverable.
