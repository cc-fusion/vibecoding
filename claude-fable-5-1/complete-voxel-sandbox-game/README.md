# VoxelCraft

A complete, browser-based voxel sandbox game inspired by the core appeal of Minecraft — mine, craft, build and explore an infinite procedurally generated world. Built with React, Vite, Tailwind CSS and three.js. Every texture, sound and icon is generated at runtime; there are no external assets to download.

## Run it

```bash
npm install
npm run dev      # development server (opens on http://localhost:5173)
```

Production build (outputs a single self-contained `dist/index.html`):

```bash
npm run build
npm run preview  # serve the built file locally
```

Requires a modern desktop browser with WebGL2 (Chrome, Edge, Firefox, Safari). A mouse and keyboard are needed (pointer lock is used for mouse look).

## How to play

1. **Create a world** from the title screen (choose a name, optional seed and Survival or Creative mode).
2. **Click the canvas** to capture the mouse. `Esc` releases it / pauses.
3. Punch trees for logs → open the inventory (`E`) → craft planks, sticks and a crafting table → place it and craft tools.
4. Dig down for coal, iron, gold and diamonds. Torches (stick + coal) light up the caves — beware of lava and deep water.
5. Build anything you like. The world autosaves to your browser's local storage; you can keep several worlds.

### Controls

| Key | Action |
| --- | --- |
| `W A S D` | Move |
| Mouse | Look |
| `Space` | Jump / swim up |
| `Shift` | Sneak (can't fall off edges) |
| `Ctrl` or double-tap `W` | Sprint |
| Left click (hold) | Mine block |
| Right click | Place block / open crafting table & furnace / eat |
| Middle click | Pick block |
| `1`–`9` / scroll wheel | Select hotbar slot |
| `E` | Inventory & crafting |
| `Q` / `Ctrl+Q` | Drop item / whole stack |
| `F` or double-tap `Space` | Toggle flying (Creative) |
| `F3` | Debug overlay |
| `Esc` | Pause menu |

## Features

- **Infinite procedural terrain** with nine biomes (plains, forest, birch forest, taiga, snowy tundra, desert, mountains, beaches, ocean), rivers of height variation, snow-capped peaks and frozen seas.
- **Caves and ores**: cheese & spaghetti caves carved by 3D noise, lava lakes at the bottom of the world, coal/iron/gold/diamond veins distributed by depth, cave mushrooms.
- **Trees & decoration**: oak, birch and spruce trees (spanning chunk borders), cacti, flowers, tall grass, pumpkins, dead bushes, clay deposits.
- **Real voxel lighting**: flood-fill sunlight and coloured block light (torches, lava, glowstone) with smooth per-vertex lighting and ambient occlusion; leaves and water attenuate light so trees cast soft shadows.
- **Day/night cycle** with sun, moon, stars, dusk colouring, drifting clouds and distance fog; underwater fog and muffled audio.
- **Survival gameplay**: health, fall damage, drowning, lava and cactus damage, tool tiers (wood → stone → iron → gold → diamond) with durability and mining levels, item drops with pickup magnetism, food (apples), death with item drops and respawn.
- **Crafting**: 60+ recipes; basic recipes anywhere, advanced ones near a crafting table, smelting near a furnace.
- **Creative mode**: instant mining, unlimited blocks, flying, full block palette.
- **First-person hand** with swing animation, block-breaking cracks, break particles, view bobbing, sprint FOV.
- **Fully synthesized audio**: material-specific dig/place/step sounds, splashes, hurt, pickups, UI clicks, ambient wind and gentle generative music.
- **Saving**: multiple worlds stored in localStorage (only edited blocks are stored, so saves stay tiny), autosave every 45 s, on pause and on tab close.
- **Settings**: render distance, FOV, mouse sensitivity, sound & music volume, view bobbing.

## Project structure

```
src/
  App.tsx              React root: menu / loading / play phases
  game/
    Game.ts            Main orchestrator: rendering, chunk streaming, input, interaction, sky
    world.ts           Chunk storage, block edits, flood-fill lighting
    worldgen.ts        Biomes, terrain, caves, ores, trees, decorations
    mesher.ts          Chunk mesh builder (culling, smooth lighting, AO)
    shaders.ts         Custom chunk shader (baked light + fog)
    player.ts          AABB physics, swimming, flying, damage
    inventory.ts       Inventory stacks & crafting
    blocks.ts          Block / item / tool / recipe definitions
    textures.ts        Procedural 16×16 texture atlas
    entities.ts        Item drops & particles
    audio.ts           Web Audio synthesized SFX & music
    save.ts            localStorage persistence
    icons.ts           Isometric inventory icons
    noise.ts           Seeded PRNG & simplex noise
  ui/                  HUD, inventory/crafting screen, menus
```
