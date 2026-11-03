# everwild.

A complete, single-player voxel sandbox built with React, TypeScript, and Three.js. All textures, geometry, creatures, particles, and audio are generated locally. No accounts, API keys, or external assets are required.

## Launch

- Run `npm install` and `npm run dev`, then open the Vite URL.
- Click **Enter your world**. The nearby terrain loads first; the rest streams in behind it.
- Run `npm run build` for the production build. `npm run preview` serves it locally.

## Controls

- **WASD / arrows:** move. **Mouse:** look. **Space:** jump or swim up. **Shift:** sprint.
- **Hold left mouse:** mine and collect. **Right mouse:** place or eat the selected apple.
- **1-9 / mouse wheel:** choose a quick slot. **E:** backpack and crafting.
- **R:** use a workbench, set a home at a campfire, or pet a nearby sheep.
- **Q:** eat an apple. **J:** field guide. **Esc:** pause. **F1:** hide the interface.
- In **Creative**, **F** toggles flight. **Space / Shift** rise and descend.
- Phones and tablets have native touch-look, a movement pad, and action buttons, including creative flight.
- If a browser or iframe blocks pointer lock, click and drag to look instead.

## The World

Seeded terrain features five biomes, rivers, sandy banks, forests, highlands, caves, coal, and iron. Chunks use indexed, face-culled meshes, per-vertex ambient occlusion, a shared pixel texture atlas, distance-based streaming, and an inexpensive distant-terrain LOD. Lighting includes optimized dynamic shadows, torch lights, a day-night cycle, stars, fireflies, clouds, rain, and animated water. Sheep wander and birds circle overhead.

Explorer mode connects resource gathering, tools, 15 recipes, workbenches, furnaces, food, fall damage, swimming, breath, and six rewarded milestones. Creative mode offers unlimited materials and free flight. The field guide contains controls, progress, and a real local terrain atlas with compass-linked trail markers.

World edits, inventory, progress, health, home, position, and time are saved in this browser every 15 active seconds, when pausing, and when leaving. Multiple named, seeded worlds are supported. Export/import world files from the pause menu to back up or move a world. Clearing browser storage deletes unexported worlds.

## Verification

Start the development server on port 5173, install Chromium with `npx playwright install --with-deps chromium`, then run:

- `npx tsc --noEmit`
- `npm run build`
- `node tests/gameplay.mjs` for deterministic generation, negative-coordinate chunks, actual keyboard input, collision and jumping, mining and placement, inventory, crafting, progression, food, lighting, weather, reload persistence, and world file workflows.
- `node tests/mobile.mjs` for native touch controls, responsive layout, mobile crafting and preferences, flight, and the pointer-lock fallback.
- `node tests/visual.mjs` for screenshots of the welcome scene, gameplay, backpack, guide, and atlas.
- With `npm run preview -- --port 4173` running, `node tests/production.mjs` checks the actual built release, saved crafting, pointer capture, and runtime errors.

Verification completed with 30 gameplay checks, 11 mobile and fallback checks, and 4 production checks passing. TypeScript and the production build pass, and the production dependency audit reports no known vulnerabilities.

Tests use Chromium's software WebGL renderer, so their frame rates and loading times do not represent hardware-accelerated play. Screenshots and exported test worlds are written to `artifacts/`.

## Scope

This is a local, single-player experience, not a multiplayer Minecraft clone. Water bodies are generated and animated, not a fluid simulation. Furnaces craft instantly; tools do not wear out. There are no hostile mobs, hunger system, or server synchronization. Audio is synthesized. Vertical building is limited to 72 blocks; horizontal exploration streams procedurally. Trail markers and creature positions are session-local. A browser with WebGL 2 is required.

## Code

- `src/game/world.ts`: deterministic generation, chunks, meshing, edits, and voxel raycasting.
- `src/game/engine.ts`: scene, controls, fixed-step collision physics, gameplay, creatures, atmosphere, and lifecycle.
- `src/game/blocks.ts`: items, pixel texture atlas, recipes, and milestones.
- `src/game/storage.ts`: validated world files and preferences.
- `src/game/audio.ts`: synthesized soundscape and interaction feedback.
- `src/App.tsx`: game HUD and complete interactive menus.