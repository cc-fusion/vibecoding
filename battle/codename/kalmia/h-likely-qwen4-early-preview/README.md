# Voxelheim

A Minecraft-inspired voxel sandbox that runs entirely in the browser. The game is
written in plain JavaScript + CSS on top of Three.js (`src/game/*`); the React
component in `src/App.tsx` is only a mounting shim required by the build pipeline.

## Run

```bash
npm install
npm run dev       # development server
npm run build     # production build → dist/index.html (single file)
npm run preview   # serve the production build
```

Open the page, create a world (optionally with a seed), and click to enter.

## Controls

| Input | Action |
| --- | --- |
| W A S D / Mouse | Move / look |
| Space | Jump, swim up (double-tap: fly in creative) |
| Shift | Sprint, fly down |
| Left click | Break block / attack |
| Right click | Place block / eat / open table & furnace |
| Middle click | Pick block |
| 1–9 / scroll | Hotbar |
| E | Inventory + crafting + smelting |
| Q (Ctrl+Q) | Drop one (whole stack) |
| F3 | Debug overlay |
| Esc | Pause |

## Features

- Infinite chunked terrain (16×96 chunks), 7 biomes, caves, ores, trees, oceans
- Face-culled meshing with per-vertex ambient occlusion and biome tinting
- First-person physics: collision, swimming, sprinting, fall/drown/cactus damage, creative flight
- Mining with tool tiers, break progress cracks, particles and drops; block placement with support rules
- 36-slot inventory with drag & drop, splitting, quick-move; 22 crafting recipes; fuel-based furnace smelting
- Pigs, sheep and night zombies with AI, combat, drops and item magnetism
- Day/night cycle, sun/moon/stars, clouds, rain/snow, lightning, flickering torch lights
- Procedural WebAudio SFX, ambient wind/rain, generative music
- Hunger, health regen, eating, 13 achievements
- Persistent world (edits, inventory, time, weather, achievements) in localStorage with autosave

## Testing

- Node-level logic tests were run for world gen, physics, raycasts, crafting, and meshing.
- `scripts/rt.mjs` and `scripts/final.mjs` are headless-browser (Puppeteer) end-to-end
  tests covering world creation, movement, mining/placing, crafting, smelting,
  swimming/drowning, mob AI, death/respawn, save/continue, and menu navigation.
  They expect `puppeteer` + `pngjs` installed in `/tmp` (see file headers).

## Known limitations

- One save slot; worlds live in localStorage (cleared if site data is cleared).
- No multiplayer, redstone, doors, or chests.
- Water is static (no flow simulation); rain passes through roofs visually.
- Software-rendered environments run slowly; a GPU is recommended.