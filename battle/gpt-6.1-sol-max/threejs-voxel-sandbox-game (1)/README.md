# Wildwood

A complete single-player, Minecraft-inspired voxel sandbox. The game and interface are implemented in plain JavaScript, HTML, and CSS with Three.js. The existing project entry component only mounts the game.

## Launch

```sh
npm install
npm run dev -- --host 0.0.0.0
```

Open the URL printed by the development server and choose **Enter the world**. A WebGL-capable modern browser is required. Click the world to capture your mouse; Escape releases it.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Look |
| Space | Jump or swim up |
| Shift | Sprint |
| Hold left click | Mine and collect |
| Right click | Place a block or eat a held apple |
| 1-9 / mouse wheel | Select hotbar slot |
| E | Backpack and crafting |
| F | Use a nearby crafting table or feed a sheep an apple |
| J | Progression journal |
| V | Toggle Creative flight |
| Space / C (or Ctrl) | Rise / descend while flying |
| Escape | Pause and save |

Touch devices get a movement stick, drag-to-look, jump, mining, placement, and backpack controls.

## Included

- Seeded Meadow, Woodland, Alpine, and Dunes biomes, a winding river, caves, ores, trees, wildflowers, and distant terrain.
- Streamed 16x16x64 chunks, culled-face geometry, vertex ambient occlusion, a procedural pixel atlas, frustum culling, bounded chunk retention, and distant terrain LOD.
- Fixed-step first-person physics, AABB collisions, jumping, sprint stamina, swimming, fall damage, air management, apples, regeneration, and respawning without inventory loss.
- Voxel DDA targeting, hold-to-mine, building with collision checks, nine-slot hotbar, 36-slot inventory, dragging, swapping, stacking, and shift-click transfers.
- Ten actual crafting recipes, nearby-table requirements, three pickaxe tiers, resource gathering, and five automatically rewarded progression goals.
- Named persistent worlds, custom seeds, Survival and Creative modes, Creative block supply and flight, automatic saving, manual saving, continuing, and deleting worlds.
- A 12-minute day/night cycle, moon and stars, moving block clouds, rain, fireflies, local torch lighting, wandering sheep, synthesized audio, block particles, and feedback animations.
- Adjustable sound, sensitivity, FOV, view distance, shadows, coordinates, weather, and fullscreen.

## Verification

```sh
node tests/core.mjs
npx playwright install --with-deps chromium
node tests/smoke.mjs
node tests/gameplay.mjs
node tests/immersion.mjs
npm run build
npx tsc --noEmit
```

Run the browser tests while the dev server is running. Set `GAME_URL` to test another server, including a production preview. Test screenshots are written to `artifacts/`.

## Scope

Worlds are single-player and stored in this browser's local storage; they do not sync between devices. Clearing browser storage deletes saved worlds, and very large edits can reach the browser storage quota. Water has animated surfaces and local flood-in behavior, not a full fluid simulation. Wildlife is peaceful; there are no hostile mobs, multiplayer, or electrical automation. Graphics performance depends on the device; view distance and shadows are adjustable. Pointer-lock support depends on browser/embed permissions, with drag-to-look as a fallback.