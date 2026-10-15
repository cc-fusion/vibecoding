# Source provenance and migration notes

Inspected source:
- Repository: https://github.com/cc-fusion/vibecoding
- Project: `claude-fable-5-1/complete-voxel-sandbox-game`
- Inspected commit: `ffe4a1638ec08f2dc7d46694beef08f876fec3a4`

This is a focused extraction/rewrite, not a rename of the original game.

| Original | Result |
| --- | --- |
| `src/game/noise.ts` | Converted to `engine/noise.js` by removing TypeScript annotations/access modifiers. Seeded random, coordinate hashing, simplex noise, fBm, and ridged noise algorithms preserved. The original header credits Stefan Gustavson's public-domain algorithm. |
| `src/game/mesher.ts` | Exposed-face testing, indexed quads, neighbor sampling, and vertex-corner AO concepts adapted into a new pure JavaScript, worker-compatible mesher. Added conservative greedy merging. Removed atlas/block/game/light-field coupling. |
| `src/game/world.ts` | Chunk storage and dirty-neighbor concepts rewritten as generic 3D 16³ chunks. Removed collision/player rules, biome metadata, block definitions, edits-save coupling and game-specific flood-fill lighting. Added validation and negative 3D addressing. |
| `src/game/Game.ts` | Replaced with `VoxelEngine`: reusable scene/camera/renderer, resource lifecycle, worker scheduler, stats/events, controls and raycast API. No player, game loop rules, hand rendering, breaking overlays, or survival systems. |
| `src/game/worldgen.ts` | Game terrain/biomes/ores/caves generation removed; small illustrative generators live only in `demo/scenes.js`. |
| `blocks.ts`, `inventory.ts`, `player.ts`, `entities.ts`, `audio.ts`, `save.ts`, textures/game shaders/icons | Removed. A simple color palette and standard Three.js materials replace game assets. |
| React app and TSX UI | Replaced by semantic HTML, CSS, and DOM event handlers. |
| Vite/React/TypeScript/Tailwind | Removed. Browser-native ES modules; static serving only. |

## Third-party code

`vendor/three.module.js`, `vendor/three.core.js`, and `vendor/OrbitControls.js` are from the source project's included Three.js r185 dependency (MIT). OrbitControls' import is changed from the npm bare specifier `three` to the local `./three.module.js`. The MIT notice is preserved in `vendor/THREE-LICENSE.txt` and upstream headers remain in the modules.

## Licensing caveat

No project-wide license was found in the inspected repository root or supplied project directory. Public availability is not, by itself, a permissive license. This deliverable does not grant rights to upstream code beyond its existing terms. Confirm upstream permissions before redistribution or commercial reuse of source-derived material. The noise header's public-domain algorithm attribution is preserved; that attribution does not determine the licensing of the whole original project. No blanket replacement license has been applied here.
