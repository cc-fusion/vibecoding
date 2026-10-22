I'll start by inspecting the project.


Running cat package.json; ls; ls src; ls node_modules | gr… failed

Ran npm install three @types/three 2>&1 | tail -2; cat…

Created src/game/noise.ts
Now the block/item registry with procedural textures, icons, and recipes.


Created src/game/blocks.ts
Now the world: generation, lighting, meshing, and streaming.


Created src/game/world.ts
Now synthesized audio.


Created src/game/audio.ts
Next, inventory and container logic.


Created src/game/inventory.ts
Now entities: shared physics, mobs, item drops, TNT, particles.


Created src/game/entities.ts
Storage helpers for world persistence:


Created src/game/storage.ts
Now the core game engine tying everything together.


Created src/game/game.ts

Ran cd src/game && python3 - <<'E' p='game.ts';s=open(…

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 read
Read
game.ts L488-499

Edited src/game/game.ts
+2
-2
Ran npx tsc --noEmit -p . 2>&1 | grep -v "TS6133" | he…
Engine type-checks. Now the React UI layer.


Created src/ui/Slot.tsx

Created src/ui/GameUI.tsx

Created src/ui/Settings.tsx
Now App.tsx (menu + game host), CSS, and index.html.


Created src/App.tsx

Created src/index.css

Ran cat index.html; sed -i "s/ const creative = thi…

Ran sed -i "434d" src/game/game.ts cat > index.html <<…

Generated public/title-bg.jpg
It builds. Now let me test it in a real browser runtime.


Running ls ~/.cache/ms-playwright 2>/dev/null; which chrom… failed

Ran cd /tmp && mkdir -p pw && cd pw && npm init -y >/d…
Ran cd /tmp/pw && cat > test.mjs <<'E' import { chromi…

Ran (npx vite preview --port 4173 > /tmp/preview.log 2…

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 read
Read
game1.png
Ran mkdir -p shots && cp /tmp/pw/*.png shots/

Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 read
Read
game1.png
Rendering, lighting, AO, water, and clouds all work. Problems: the arm model is too large, the player spawns inside trees, and mining didn't register. Let me debug the mining.


Running cd /tmp/pw && cat > t2.mjs <<'E' import { chromium… failed

Ran cd /tmp/pw && sed -i "s/await p.click('text=Play >…

Ran cd src/game && python3 - <<'E' s=open('entities.ts…
Let me check the other screenshots (sunset, night/rain, inventory).


Exploring
Explored
,
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
0
1
2
3
4
5
6
7
8
9
 reads
Read
night.png
Read
inv.png
The inventory and recipe UI render cleanly. One last runtime check of crafting, placement, saving, and errors on the new build:


Ran cd /tmp/pw && cat > t3.mjs <<'E' import { chromium…

Ran rm -rf shots && npm run build 2>&1 | tail -2
VoxelCraft is a Minecraft-style voxel sandbox built with Three.js, React and TypeScript, and the final build succeeds. I tested it in headless Chromium: world creation, terrain loading, rendering, mining, crafting and saving all worked with no errors in the last run. A real person hasn't played it yet. All gameplay tests were driven through code, and the test browser used software rendering, so I couldn't measure real frame rates.

Launch: npm run build, then npx vite preview and open the URL it prints (or npm run dev while developing). Click into the game to lock the mouse.

Controls: WASD to move, Space to jump, Shift to sneak, double-tap W or Ctrl to sprint, E for inventory, Q to drop, 1–9 or the mouse wheel for the hotbar, left-click to break or attack, right-click to place or use, middle-click to pick a block, F3 for debug info. In creative, double-tap Space or press F to fly.

What's in it
World: a random or typed-in seed generates six biomes (plains, forest, desert, snowy tundra, mountains, ocean/beach), plus caves, ores that get rarer with depth, oak/birch/spruce trees, cacti and plants.
Chunk streaming: the world loads and unloads in 16×16×96 sections around you within a per-frame time budget. Render distance is adjustable from 3 to 12 chunks.
