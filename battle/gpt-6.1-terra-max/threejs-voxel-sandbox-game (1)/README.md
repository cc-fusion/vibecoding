# Blockhaven

A single-player, first-person voxel sandbox built with React and Three.js.

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Node.js 20.19+ or 22.12+ and a browser with WebGL enabled are required.

## Play

- Click the world to capture the mouse. Use WASD to move, Shift to sprint, and Space to jump or swim upward.
- Hold left click to gather blocks; right click to place the selected block. Use 1-9 or the mouse wheel to select a hotbar slot.
- Press E for the inventory and recipes. Drag items between slots, or select a hotbar slot and click a backpack slot to swap them.
- Craft and place a crafting table to unlock tools and a furnace. Right click either workstation to open crafting; Shift + right click places a block against it. A furnace turns iron ore and coal into iron ingots.
- A stone pickaxe is needed to collect iron ore. Use an axe on a sheep to gather renewable wool.
- Press Escape for the pause menu. On touch devices, drag the world to look and use the on-screen movement and action buttons.

The world, inventory, position, time, and progress save automatically in this browser's local storage. The menu can save manually or replace the current world with a new seed.

## Testing

```sh
npm run build
npx playwright install chromium
node tests/smoke.mjs
```

On Linux, Playwright may also require its system dependencies (`npx playwright install-deps chromium`). The smoke test starts its own Vite server and exercises desktop and touch play in Chromium.

## Scope

Worlds stream horizontally in chunks and have a fixed vertical height. This is a local, single-player experience: there is one saved world per browser, no multiplayer or server sync, and clearing browser storage deletes the save. Wildlife is peaceful; there are no hostile mobs, generated caves, hunger, or tool durability.