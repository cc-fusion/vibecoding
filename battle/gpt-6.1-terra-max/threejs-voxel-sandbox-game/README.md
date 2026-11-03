# Wilds

A first-person, Minecraft-inspired voxel sandbox built with React and Three.js.

## Launch

```sh
npm install
npm run dev
```

Open the local URL Vite prints. A WebGL-capable browser is required. `npm run build` creates the production build.

## Play

- Move with WASD, look with the mouse, jump or swim up with Space, and sprint with Shift.
- Hold left click to gather blocks; right click places the selected block. Use 1-9 or the mouse wheel to change hotbar slots.
- Press E to open the pack and craft. Select two inventory slots to swap them, or select a stack and discard it. Esc or P pauses.
- On touch devices, drag the world to look and use the on-screen controls. The field guide and settings are in the top-right corner.
- Terrain, edits, inventory, position, health, and time are saved in browser storage. Starting a new world replaces the current local save.

The world includes seeded biomes and terrain, a starter kit, gathering and crafting, swimming, fall damage, passive wildlife, day and night, weather, torch light, particles, and synthesized sound effects. Crafting works anywhere; placed crafting tables are decorative.

## Verification

```sh
npx tsc --noEmit
npm run build
npx playwright install --with-deps chromium
node tests/smoke.mjs
```

The smoke test launches a local Vite server and checks movement, collisions, jumping, swimming, mining, crafting, placement, lighting, saved edits, reset, weather, and touch movement in Chromium.

## Scope

Worlds are local to one browser and device; there is no multiplayer or cloud sync. Water is static rather than a flowing fluid simulation, animals are ambient and non-interactive, and the game does not include hostile mobs, caves, hunger, or tool durability.