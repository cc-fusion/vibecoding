# Validation

## Automated core tests

Run `npm test` (Node 20+; no package installation). All **15 tests pass**:

- Negative coordinates and 3D chunk boundaries
- No-op write counts / dirty state
- Coordinate / material-ID validation
- Single cube face and index counts
- Shared-face removal
- Full-chunk greedy reduction (1,536 exposed unit faces → 6 quads)
- Material boundaries preserved
- Face culling across chunk boundaries
- Diagonal AO neighbor invalidation
- Outward-facing triangle winding on all six directions
- Corner AO and disabled-AO behavior
- Empty geometry after voxel removal
- Lossless voxel-world JSON round-trip
- Invalid / oversized / duplicate imports rejected
- Deterministic noise and seeded PRNG

## Browser validation performed

Headless Chromium with software WebGL, desktop 1280 × 800 and 1440 × 950, and narrow 390 × 844 viewport:

- All three example scenes rendered and meshing queues drained
- Wireframe / shaded modes, grid shortcut, fog and shadow controls
- AO and greedy toggles triggered completed remeshes
- Scene JSON download and reimport preserved all voxel chunk bytes
- Invalid import preserved the active scene
- PNG download produced a nonempty image
- Pause/resume, object visibility, tree search, documentation dialog
- Performance tab, expanded viewport and Escape restoration
- Voxel edits during in-flight worker work completed without a stuck queue
- Narrow layout had no horizontal page overflow
- Minimal integration page loaded and its voxel-add control ran
- No JavaScript or WebGL errors were observed during these checks

Headless software-rendering FPS is not representative of GPU-accelerated browser performance. No fixed frame-rate guarantee is made. Browser checks above were run as a separate Playwright smoke script; the dependency-free, repeatable tests included in the deliverable are the core Node tests.
