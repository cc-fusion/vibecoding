# Voxel Core

A developer-friendly, framework-free **voxel rendering engine** and interactive 3D workbench, adapted from [cc-fusion's complete voxel sandbox](https://github.com/cc-fusion/vibecoding/tree/main/claude-fable-5-1/complete-voxel-sandbox-game).

**HTML + CSS + JavaScript ES modules. No React. No TypeScript. No build step.** Three.js r185 and OrbitControls are included locally, so there are no CDN, font, texture, or runtime network dependencies.

## Run

From this folder:

```sh
python3 -m http.server 3000 --bind 0.0.0.0
# Open http://localhost:3000
```

Alternatively, `npm start` runs the same Python command. Node/npm are not needed to run the app. Any static HTTP server works. Use HTTP rather than opening `index.html` with `file://`: browser ES modules and module workers require a server. A current browser with WebGL 2 is required.

- `index.html` — full workbench
- `minimal.html` — minimal engine integration, without the workbench
- `npm test` or `node --test tests/*.test.js` — core tests (Node 20+, no packages to install)

## What's included

- Sparse 16 × 16 × 16 `Uint8Array` voxel chunks, including negative coordinates
- Hidden-face culling **across chunk boundaries**
- Conservative greedy meshing: merge matching material/uniform-AO faces; preserve non-uniform AO corners
- Vertex ambient occlusion, sampled through a one-voxel neighbor halo
- Neighbor and diagonal invalidation after boundary edits
- Module-worker mesh generation with transferable buffers, bounded concurrent work, revision/epoch checks to discard stale jobs, and a synchronous fallback
- One indexed mesh per nonempty render chunk, shared material, frustum culling, geometry disposal
- Perspective orbit/pan/zoom controls, voxel raycasting, shadows, fog, exposure, capped device pixel ratio
- Seeded simplex noise, retained from the source and converted to JavaScript
- Stats and events, direct access to Three.js for ordinary non-voxel objects
- Scene JSON import/export, PNG viewport export, three separate example scenes

**Not included:** crafting, recipes, inventory, hotbars, mining progression, health, hunger, survival, enemies, item drops, player controller, first-person hands, game audio, game saves, or game menus. The trees, terrain, pavilion, and water are optional **demo scene content**, not systems in the engine.

## Quick start

Your container must have a nonzero height.

```html
<div id="viewport" style="width:100%;height:600px"></div>
<script type="module">
  import { VoxelEngine, VoxelWorld } from './engine/engine.js';

  const engine = new VoxelEngine(document.querySelector('#viewport'), {
    palette: ['#000000', '#8aaa69', '#c3ba91'],
    pixelRatio: 1.5, // maximum, clamped to devicePixelRatio
    workers: 2      // 0 = main thread, up to 4 workers
  });
  const world = new VoxelWorld();
  for (let x = -16; x < 16; x++) {
    for (let z = -16; z < 16; z++) world.set(x, 0, z, 1);
  }
  engine.setWorld(world);
  let firstBuild = true;
  engine.on('ready', () => {
    if (firstBuild) { engine.frameWorld(); firstBuild = false; }
  });

  // Later: edits rebuild only affected chunks, including halo neighbors.
  world.set(0, 1, 0, 2);
  // world.set(0, 1, 0, 0); // remove
  // engine.dispose();     // when unmounting your application
</script>
```

### API

| API | Behavior |
| --- | --- |
| `new VoxelWorld()` | Empty sparse voxel data. No Three.js or DOM required. |
| `world.get(x,y,z)` | Returns material ID, or 0 for empty/unallocated space. Use integer coordinates. |
| `world.set(x,y,z,id)` | Writes a voxel. Integer coordinates ±1,000,000; IDs 0–255. 0 is empty. |
| `world.invalidate()` | Mark all existing chunks dirty, for palette/mesher changes. |
| `world.toJSON()` | Versioned chunk data, not application objects. |
| `VoxelWorld.fromJSON(data)` | Validated new world, max 512 chunks per import. Does not mutate an existing world. |
| `engine.setWorld(world)` | Replace voxel world, dispose old chunk geometry, invalidate pending results. |
| `engine.setPalette(colors)` | Up to 256 `#rrggbb` strings indexed by voxel ID; trigger remesh. Unmapped IDs are magenta. |
| `engine.setMeshing({greedy,ao})` | Toggle boolean meshing options and rebuild. |
| `engine.pick(x,y)` | Canvas-relative CSS pixel coordinates → `{position, normal, id, distance}` or `null`. |
| `engine.frameWorld()` | Frame completed voxel meshes in the current perspective camera. |
| `engine.setPaused(bool)` | Pause/resume the animation loop. Camera controls and explicit rendering still work; queued meshes finish but no new jobs are dispatched while paused. |
| `engine.render()` | Render immediately, useful while paused or before capture. |
| `engine.resize()` | Normally automatic through `ResizeObserver`. |
| `engine.on(event,callback)` | Subscribe; returns an unsubscribe function. |
| `engine.dispose()` | Stop loop, terminate workers, disconnect observers/controls, dispose scene geometry/materials and renderer, remove canvas. Call before releasing engine. |

`engine.scene`, `camera`, `renderer`, `controls`, `root`, `sun`, `ambient`, `grid`, `material`, and `world` are directly accessible. The engine owns the scene; avoid sharing its resources with another engine instance. Dispose any custom textures you introduce yourself. Keep the voxel root transform at identity if using `pick()`; normal Three.js objects can be added freely alongside it.

Events:

```js
const offFrame = engine.on('frame', ({ dt, now }) => {
  // Application behavior belongs here; dt is seconds, capped at 0.1.
});
engine.on('ready', ({ chunks }) => console.log('Current mesh queue drained', chunks));
engine.on('stats', stats => console.log(stats)); // ~400 ms sampling interval
engine.on('worldchange', world => {});
engine.on('warning', message => {});
engine.on('error', message => {});
offFrame();
```

`ready` can occur after initial construction, a voxel edit, or a settings change: it is not a one-time application-loading event. Stats are observed, not performance guarantees. `drawCalls` / `triangles` are Three.js renderer counters (including shadow passes); `bufferBytes` sums voxel position/normal/color/index typed arrays, **not total GPU or browser memory**. `visibleChunks` measures camera-frustum intersections even when culling is disabled. `meshMs` is the last mesher execution time, not end-to-end scheduling latency.

### Ordinary Three.js objects

```js
import { THREE } from './engine/engine.js';
const marker = new THREE.Mesh(
  new THREE.SphereGeometry(1, 16, 8),
  new THREE.MeshStandardMaterial({ color: '#d7a56e' })
);
marker.position.set(4, 8, 4);
engine.scene.add(marker);
```

## Architecture

```text
engine/
  engine.js        Renderer, controls, lighting, worker scheduling, picking, events
  world.js         Generic sparse voxel data, dirty tracking, JSON validation
  mesher.js        Pure typed-array face culling + greedy merging + corner AO
  mesh-worker.js   Worker protocol and transferable output
  noise.js         Seeded PRNG + simplex / fractal / ridged noise

demo/
  app.js           DOM UI, scene switching, import/export, stats, commands
  scenes.js        Optional terrain, pavilion, and geometry-study generators
  icons.js         Inline SVG icons (no icon/font dependencies)

vendor/            Local Three.js r185 modules, OrbitControls, MIT notice
index.html         Workbench markup
styles.css         Workbench styles (no CSS framework)
minimal.html       Small embeddable-engine example
```

The mesher does not import Three.js. It receives an 18³ padded snapshot plus a linear RGB palette and returns transferable typed arrays. The engine installs completed geometry only when the job's world epoch and chunk revision still match. CPU voxel storage is authoritative; changing geometry alone does not change voxel data. Always use `world.set`, not direct writes to chunk buffers, for tracked edits.

## Workbench

Drag to orbit; right-drag to pan; scroll to zoom. Double-click a voxel to inspect its coordinates. Toolbar buttons provide pan mode, scene framing, wireframe, grid, and auto-orbit. X/Y/Z buttons select front/top/isometric-direction camera views (all remain perspective). The tree supports visibility and search. The inspector adjusts rendering/meshing; the console shows actual events and measured performance.

Keyboard: **F** frame, **G** grid, **W** wireframe, **Space** pause/resume, **?** guide. Text fields and dialogs suppress shortcuts. Expanded viewport exits with **Esc**.

Export downloads `voxel-core-scene.json`: voxel chunks, palette, camera, supported renderer settings/visibility, demo water geometry and seed. Import via the explorer's import icon. Import is capped at 20 MB / 512 chunks, validates before replacing the world, and does not execute scripts. This is not a generic Three.js scene serializer: custom application meshes, lights, textures, callbacks, and other runtime state are not automatically exported. The PNG button exports only the rendered viewport, not UI chrome. Workbench changes are not autosaved; export to preserve them.

## Scope and tradeoffs

This is a focused voxel rendering foundation, **not a complete general-purpose engine**:

- No automatic infinite-world generation/streaming, LOD, physics, ECS, animation system, network replication, or undo stack. A sparse chunk map is not an automatic streaming system.
- Chunk generation for the small demo is synchronous; **meshing** runs in workers. JSON export/import is also synchronous after file reading. Large scenes need application-level job budgets/streaming.
- All nonzero voxel IDs are opaque cube geometry. Transparent demo water is a separate ordinary mesh, not a fluid simulation. No original texture atlas, cross-shaped foliage, emissive block light, or flood-fill skylight system is carried over.
- Corner AO replaces the source's game-specific light-field coupling. Greedy merging is deliberately conservative to preserve AO interpolation.
- Dirty chunks coalesce in a set; at most one in-flight job per chunk per world epoch. Replacing a world discards old results but lets already-running worker jobs finish.
- Empty chunk data remains allocated after voxel removal. Application-scale chunk eviction is not implemented.
- One mesh per rendered chunk. This is **not** one draw call per voxel, but thousands of visible chunks would still require batching/LOD work.
- Workbench is desktop-first. Narrow screens prioritize the viewport and hide side panels.

## Attribution

See [PROVENANCE.md](PROVENANCE.md) for source mapping and licensing caveats, and `vendor/THREE-LICENSE.txt` for the Three.js MIT license.
