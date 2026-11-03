# Voxterra — Voxel Sandbox Game Architecture & Implementation Plan

## 1. Core Technical Approach
- **Stack**: Plain HTML (`index.html`), Plain CSS (`src/styles/main.css`), and Modular Vanilla JavaScript (`src/js/...`) powered by **Three.js** (`^0.186.1`). No React runtime or component framework used in the application body.
- **Build & Delivery**: Bundled cleanly via Vite into `dist/index.html` while keeping pure semantic HTML, CSS, and standard ES module JavaScript throughout.

## 2. Core Subsystems & Engineering Design

### A. Graphics, Textures & Custom Voxel Shaders
1. **Procedural Pixel-Art Texture Atlas (`TextureAtlas.js`)**:
   - Crisp 16×16 procedural pixel-art textures for 40+ block types and 25+ tools/items/materials.
   - 4-pixel extruded border padding per cell (24×24 stride) with `NearestFilter` to completely prevent UV seam bleeding at grazing angles.
   - Offscreen isometric 3D block icon & 2D item sprite renderer so every UI slot shows crisp, recognizable icons.
   - 10-stage pixel-art block breaking crack overlay textures.
2. **Real-Time GPU Voxel Lighting (`VoxelMaterials.js`)**:
   - Custom shader injection storing per-vertex smooth Ambient Occlusion + directional face shading, biome tint RGB, normalized skylight (`0..1`), and emissive block light (`0..1`).
   - Dynamic uniforms (`uSkyBrightness`, `uSkyColor`, `uTorchFlicker`, `uTime`) allow smooth day-to-night transitions and warm flickering torch/furnace/glowstone illumination at 60 FPS with **zero chunk re-meshing**.
   - Animated water surface ripples and clean cutout/translucent passes.

### B. Procedural World, Biomes & Streaming
1. **Seeded Noise & Biomes (`Noise.js`, `BiomeManager.js`, `TerrainGenerator.js`)**:
   - Deterministic seeded PRNG and 2D/3D Simplex/Perlin FBM + ridged noise.
   - 6 distinct biomes: **Emerald Plains**, **Whispering Forest**, **Golden Desert**, **Snowy Taiga**, **Alpine Peaks**, and **Azure Ocean / Sandy Beach**.
   - 3D cave carving, depth-stratified ores (Coal, Iron, Gold, Diamond), cross-chunk trees (Oak, Birch, Spruce, Cactus), surface flora (flowers, tall grass, mushrooms, dead bushes), and rare **Ruined Outposts** containing loot chests.
2. **Efficient Voxel Meshing & Streaming (`Chunk.js`, `ChunkMesher.js`, `World.js`)**:
   - `16 × 96 × 16` TypedArray chunk storage with skylight columns and BFS emissive block-light propagation across chunk boundaries.
   - Face-culled meshing with 4-corner smooth Ambient Occlusion and quad-flip anisotropy correction.
   - Radial priority chunk streaming & disposal around the player within configurable render distance.

### C. First-Person Gameplay, Physics & Progression
1. **Player Controller & Physics (`Player.js`, `ViewModel.js`)**:
   - Pointer Lock mouse look, `WASD` movement, sprinting with FOV response, jumping, buoyant water swimming with underwater visuals, ice sliding, Creative flight mode, and **Shift sneak edge-guard** (prevents walking off ledges while building).
   - Swept axis-separated AABB collision detection (`0.6 × 1.8 × 0.6`), accurate DDA voxel raycasting, progressive block mining with tool-tier speed multipliers, and 3D held item/block viewmodel with bobbing and swing animations.
   - Survival mechanics: Health, Hunger, Food consumption, Fall damage, Respawn Bed (sets spawn & sleeps through night).
2. **Inventory, Crafting, Smelting & Storage (`Inventory.js`, `recipes.js`, `UIManager.js`)**:
   - 9-slot Hotbar + 27-slot Inventory with stack splitting, drag/place, Shift-click transfer, and tool durability bars.
   - 2×2 Personal Crafting + 3×3 Crafting Table with **both** manual grid placement **and** an intuitive 1-Click Craftable Recipe Book.
   - Functional **Furnace** (smelts ores, sand, clay, cobblestone, and raw food using fuel over time with live world glow) and persistent **Chests** + Creative mode searchable block palette.
3. **Entities, Atmosphere, Audio & Persistence**:
   - **Creatures (`MobManager.js`)**: Articulated 3D Sheep, Pigs, Chickens (passive daytime) and Zombies & Spiders (hostile night/cave AI with combat, knockback, drops, and morning sun burn).
   - **Dropped Items & Primed TNT (`ItemDropManager.js`, `PrimedTNT.js`)**: Physical 3D item drops with magnetic pickup; ignitable TNT with fuse animation and crater explosions.
   - **Sky & Weather (`SkyWeather.js`, `ParticleSystem.js`)**: Full day-night celestial cycle (Sun, Moon, Stars, 3D Clouds), dynamic Rain & Snow weather, and pooled 3D particles.
   - **Procedural Web Audio (`SoundManager.js`)**: Synthesized material-accurate footsteps/mining/placing, combat, item pops, weather ambience, and gentle procedural music.
   - **Persistent Worlds (`WorldPersistence.js`)**: Multi-world management (Create with custom seed & Survival/Creative mode, Load, Delete, Autosave) stored cleanly in IndexedDB.

## 3. UI Organization & Friendliness Guidelines
- Clean, uncluttered title screen and modals with clear hierarchy and friendly controls.
- No static filler chips (e.g., no static "Ready" badges) and no clouding boilerplate disclaimers.
- Technical stats hidden cleanly behind `F3` toggle so the core HUD stays immersive and readable.

## 4. Verification & Iteration Plan
- Build incrementally and test with `npm run build` + Playwright headless Chromium WebGL runtime checks.
- Verify zero console/page errors, visual rendering via screenshots, chunk meshing, physics collisions, block breaking/placing, crafting, smelting, saving/reloading persistence, and responsive frame pacing.
