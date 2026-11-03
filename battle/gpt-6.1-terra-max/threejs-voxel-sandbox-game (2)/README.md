# LOAM

A cozy, first-person voxel sandbox built with React and Three.js.

## Start

```sh
npm install
npm run dev
```

Open the local URL printed by Vite in a browser with WebGL enabled. The game also has on-screen controls on touch devices.

## Controls

- `W`, `A`, `S`, `D`: move. Hold `Shift` to run.
- Mouse: look around. Hold left click to gather; right click to place the selected block.
- `Space`: jump or swim upward.
- `1` through `9`, or the mouse wheel: select a hotbar item.
- `E`: open inventory and crafting. Click two slots to swap them.
- `H`: open the control guide. `Esc`: pause.

Use the axe for wood and the pickaxe for stone. Gather wool from a friendly sheep, craft building materials in the inventory, and follow the field notes for a few first goals. The world, inventory, position, weather, and progress save automatically in this browser's local storage. Settings can generate a fresh world, replacing that save.

The world streams deterministic, face-culled voxel chunks as you explore. Day and night, weather, swimming, fall damage, particles, and synthesized sound effects are included. Water is a static terrain feature rather than a flowing fluid simulation; creatures are passive and the game is single-player with one local save.

## Smoke Test

After installing the Playwright Chromium browser with `npx playwright install chromium`, run `node tests/smoke.mjs` to exercise gameplay, crafting, persistence, weather, and the touch interface.