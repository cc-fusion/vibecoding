I'll start by inspecting the project.


Running cat package.json; ls; ls src; ls node_modules | gr… failed

Running npm install three @types/three 2>&1 | tail -2; ls … failed
Three installed. Now the noise module.


Created src/game/noise.ts
Now the block/item registry with the procedural pixel-art atlas.


Created src/game/blocks.ts
Now the world: generation, biomes, caves, ores, trees, lighting, and meshing.


Created src/game/world.ts
Fixing that leftover expression.


Edited src/game/world.ts
+1
-1
Now the audio synthesizer (all procedural WebAudio).


Created src/game/audio.ts
Now inventory, crafting, and smelting logic.


Created src/game/inventory.ts
Now the atmosphere module: sky dome, sun/moon, stars, clouds, rain/snow.


Created src/game/sky.ts
Now entities: shared physics, mobs, item drops, and particles.


Created src/game/entities.ts
Let me check tsconfig strictness before writing the engine.


Ran cat tsconfig.json; cat src/main.tsx; cat index.htm…
Now the core engine tying everything together.


Created src/game/storage.ts

Created src/game/engine.ts
Now add the held-torch dynamic light (uHeld) to the chunk shader.


Ran cd src/game && python3 - <<'EOF' p='world.ts'; s=o…
Engine done. Now the UI — first shared slot/icon components.


Created src/ui/Slot.tsx
Now the in-game view: HUD, inventory/crafting/furnace screens, pause, settings, death.


Created src/ui/GameView.tsx
Now the title menu / world manager and App.


Created src/App.tsx
Now the CSS theme, main.tsx (no StrictMode to avoid double WebGL init), and title.

Ran cat > src/index.css <<'EOF' @import "tailwindcss";…
Typecheck is clean. Building and setting up a headless browser for runtime testing.


Ran npm run build 2>&1 | tail -5; cd /tmp && (npm i pl…

Running mkdir -p /tmp/shots && cat > /tmp/test.mjs <<'EOF'… failed
Missing system libs; trying to install them.


Ran cd /tmp && (sudo -n true 2>/dev/null && echo SUDO)…

Ran node /tmp/test.mjs 2>&1 | tail -20

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
game1.png
Read
menu.png
Ran mkdir -p shots && cp /tmp/shots/*.png shots/ && se…

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
Rendering works with no errors. The first-person arm looks too big, so I'll shrink it. Next I'll run a gameplay test: an aerial view, mining, placing, and save.


Ran sed -i "s/new THREE.BoxGeometry(0.22, 0.22, 0.7), …
Mining didn't register in the test. Debugging:


Ran cat > /tmp/extra2.mjs <<'EOF' export default async…
Mining works; the earlier failure was a timing problem in the test script. I'll set the willReadFrequently hint and look at the screenshots.


Ran sed -i "s/const ctx = cv.getContext('2d')!;/const …

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
aerial.png
The terrain, biomes, fog and clouds look good. The arm still looks big, so I'll check whether my edit applied.


Ran grep -n "arm.position\|BoxGeometry(0.1" src/game/e…
Ran sed -i "s/BoxGeometry(0.14, 0.14, 0.6)/BoxGeometry…

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
night.png
Fall damage and the death screen work; the test caused the death by dropping the player 30 blocks. The night scene is lit by the dynamic light from the held torch. Now checking the inventory UI:


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
inv.png
The inventory works, but the slots are spread too far apart. I'll pack them tightly and do the final build.


Ran sed -i 's/className="grid grid-cols-9 gap-0/classN…
I've built VoxelCraft, a Minecraft-style voxel sandbox using Three.js inside the React + Vite project. The final build succeeds and the game runs in a headless Chrome browser with no console errors. There are no image files: every texture, icon and sound is generated in code.

To launch: run npm run build and open dist/index.html, which is a single file (or use npm run dev). Create a world, click Play, then click the game view to capture the mouse.

What I checked in the browser:

The world finished generating in about 1 second at 6-chunk render distance, at 21–27 fps on software rendering. Real GPUs should be much faster, but I haven't measured that.
Screenshots confirmed the title menu, the terrain (plains, forest and snowy taiga with pine trees), clouds, distance fog, night lighting from a held torch, the inventory screen and the death screen.
Mining worked by hand: breaking tall grass counted as a mined block, and the crack overlay on a grass block filled up over time.
Fall damage killed the player when the test script dropped them 30 blocks, and the death screen followed.
Saving wrote the world to the browser's local storage.
What I didn't check: the test drove the game through code rather than real mouse and keyboard, so mouse capture and controls weren't tested by hand. I also didn't fully check crafting, the furnace, mob fights, water flow, weather visuals or audio in the browser. My test script tried to place a torch, but the result wasn't verified.

What's in the game:

World: worlds come from a seed (number or text) and have 8 biomes: ocean, beach, plains, forest, birch grove, desert, snowy taiga and mountains. There are caves, ore veins (coal, iron, gold, diamond, gravel), several tree types, cacti, flowers and grass. Chunks of 16×16×128 blocks load and unload around you as you move.
Graphics: hidden block faces are skipped, corners get soft shadowing, and a custom shader lights the world from the sky and from torches and glowstone. Holding a torch lights up your surroundings. Water ripples and is see-through, and fog thickens underwater and in rain.
Atmosphere: a 12-minute day/night cycle with sun, moon, stars, sunsets and moving clouds. Weather cycles between clear, rain (snow in cold biomes) and thunderstorms with lightning flashes.
Movement: walk, sprint (Ctrl or double-tap W) with a widening field of view, sneak (Shift, stops you walking off edges), swim, optional auto-jump, and flying in Creative (double-tap Space).
Survival: health, hunger, breath underwater, fall damage, cactus damage and health regeneration.
Mining and items: blocks take time to break depending on hardness and tool, and ores need the right pickaxe tier. Tools wear out. Broken blocks drop items that pull towards you when you're close. Sand and gravel fall when unsupported, and water spreads a short distance into gaps.
Inventory and crafting: 36 slots with Minecraft-style click, split, Shift-click and sort controls. There's 2×2 crafting in the inventory and 3×3 at a crafting table, a furnace with fuel and smelting progress, about 30 recipes, and a built-in recipe book.
Creatures: pigs, cows and sheep wander and run when hit. Zombies spawn at night or in storms, chase and hit you, and burn in daylight. All mobs drop items when killed.
Sound and feedback: sounds for mining, placing, footsteps (varied by material), mobs, getting hurt, eating, rain, wind, thunder and soft background music. Also break and splash particles, torch flames, a swinging held item, head bob and a red flash when hurt.
Progress and saving: 14 achievements with pop-up notifications, plus stats. Multiple saved worlds that autosave every 20 seconds and on quit, survival or creative mode, a settings menu (render distance, field of view, mouse sensitivity, volume, auto-jump, music) and a debug overlay (F3).
Limitations:

Lighting is an approximation. Torch light doesn't follow walls, so it shines through solid blocks, and sky light is worked out per column rather than spreading properly.
Water spreads only a few blocks and has no flow levels or currents.
Terrain generation and mesh building run on the main thread with a per-frame time limit. Flying fast at high render distance may stutter.
You keep your inventory when you die. Dropped items, mobs and furnaces that are still smelting while you're away are not saved between sessions.
Saves use the browser's local storage, which holds roughly 5 MB, so very heavily edited worlds could fill it. You'll get a "Save failed" message if that happens.
There are no beds, farming, armour, multiplayer or underground monsters.
Most of the game is in src/game/, with the engine, terrain and chunk building, textures, mobs, sky and weather, inventory and crafting, audio and saving each in their own file. The interface is in src/ui/ and src/App.tsx.
