# TerraCraft — a Three.js voxel sandbox

A Minecraft-inspired survival/creative sandbox that runs entirely in the browser (React + Vite + Tailwind + Three.js).
Everything — terrain, textures, mobs, sounds, music — is generated procedurally; there are no external assets.

## Launch

```bash
npm install
npm run dev        # development server
# or
npm run build      # produces a single self-contained dist/index.html
npm run preview    # serve the production build
```

`dist/index.html` is a single file (JS, CSS and the Web Worker are inlined) and also works when opened directly.
Pick **Singleplayer → New World**, choose Survival or Creative, and click to capture the mouse.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Space | Jump / swim up / fly up |
| Shift | Sneak (won't walk off ledges) / fly down |
| Double-tap W, or R, or Ctrl | Sprint |
| Left mouse (hold) | Break blocks / attack |
| Right mouse | Place block, use item, eat (hold), open table / furnace / chest |
| Middle mouse | Pick block |
| 1-9 / wheel | Hotbar |
| E | Inventory + crafting (recipe book auto-fills the grid) |
| Q / Ctrl+Q | Drop item / stack |
| T or / | Chat & commands (`/help`) |
| L | Goals · M minimap · F3 debug · F1 hide HUD |
| Space ×2 | Toggle flight (creative) |

Commands: `/time set <day|noon|night|midnight|0-1>`, `/gamemode <s|c>`, `/tp x y z`, `/give <item> [n]`,
`/weather <clear|rain|thunder>`, `/summon <pig|cow|sheep|chicken|zombie|skeleton|boomer>`, `/spawn`, `/heal`, `/kill`, `/seed`, `/clear`.

## Features

**World**
- Seeded procedural terrain: continents/oceans, beaches, plains, forests, birch forests, deserts, snowy tundra, taiga and snow-capped mountains.
- Spaghetti caves + caverns, lava lakes, coal / iron / gold / diamond ore veins, gravel/dirt pockets, bedrock.
- Trees (oak, birch, spruce) generated deterministically across chunk borders, cacti, flowers, tall grass, dead bushes.
- 16×16×128 chunks streamed around the player; terrain generation **and** meshing run in Web Workers.
- Voxel mesher with face culling, per-vertex ambient occlusion and smooth light; flood-fill sky + block light that works across chunks, updates incrementally when you edit blocks.
- Biome-tinted grass and foliage, animated water surface, swaying plants, flowing lava glow, flat drifting clouds, sun/moon/stars.

**Gameplay**
- Survival: health, hunger/saturation, regeneration, starvation, fall damage, drowning, lava and fire, cactus damage, respawn with item drop on death.
- Creative: infinite items palette with search, flight, instant mining, no threats.
- Mining with hardness / tool tier / tool speed, crack overlay, durable tools (wood → stone → iron → diamond), drops, falling sand & gravel, plants that pop off, torches that need support.
- Inventory with drag/split/shift-click, 2×2 and 3×3 crafting (shaped, mirrored and shapeless recipes), crafting-table, furnace (fuel, smelting, lit-state lighting), chests, bread/farming (hoe → farmland → seeds → wheat), sapling growth, grass spread, TNT + flint & steel with chain reactions.
- Mobs with procedural skinned models and walk animations: pig, cow, sheep, chicken (drops, flee when hit), zombie (burns in sunlight), skeleton (shoots arrows), boomer (fuse + block-destroying explosion). Dynamic spawning by light level, despawning, persistence.
- Day/night cycle (16 min), weather (rain, snow in cold biomes, thunder with lightning flashes), underwater and lava fog.
- 15 goals ("advancements"), minimap, debug overlay, chat/commands, toasts.

**Audio** (WebAudio synthesis, no samples): material-aware dig/break/place/footsteps, mob voices, explosions, thunder, rain, wind, cave drips and drones, positional panning, underwater muffling, generative ambient music.

**Persistence**: multiple worlds in IndexedDB — only modified chunks are stored (RLE-compressed); player, inventory, furnaces/chests, mobs, time, weather and goals are saved on autosave (30 s), pause and tab hide. Settings live in localStorage.

## Code map (`src/game`)

`blocks.ts` registry · `items.ts` items/recipes/drops · `terrain.ts` + `noise.ts` generation · `mesher.ts` meshing ·
`world.ts` chunk data + lighting · `chunks.ts` streaming, worker pool, shaders · `physics.ts` collision/raycast ·
`player.ts` · `mobs.ts` · `entities.ts` · `inventory.ts` · `sky.ts` (sky + weather) · `particles.ts` · `audio.ts` ·
`textures.ts` (procedural atlas + icons) · `storage.ts` · `game.ts` (engine/loop/interaction). UI is in `src/ui`.

## Known limitations

- No stairs/slabs/doors/beds/ladders, no flowing water/lava physics, no armor/bows, no multiplayer, no touch/gamepad controls.
- Furnaces, chests and tables have no facing direction (same texture on all four sides).
- Verified in headless software-rendered Chromium (5–25 FPS); performance on real GPUs should be far higher but wasn't measured.
  Lower *Render distance* in Options on weak hardware.
