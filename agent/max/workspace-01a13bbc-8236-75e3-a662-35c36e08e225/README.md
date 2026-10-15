# PARALLAX

A complete, standalone Canvas 2D portal puzzle-platformer. Open **index.html** in a modern browser. No build, CDN, images, fonts, or audio downloads are required.

## Play
- **A / D** or **Left / Right**: move
- **Space / W / Up**: jump
- **Left click**: cyan portal; **right click**: amber portal
- **E**: pick up / drop cube; **Q**: throw
- **R**: restart; **Escape / P**: pause
- **Touch**: choose a portal color, tap a surface; use movement, jump, and carry buttons. Landscape recommended.

## Included
30 chambers in six sections; momentum-preserving portal transforms; weighted cubes and pressure plates; turrets and cube cover; portal-routing energy pellets and continuous beams; energy catchers; speed and bounce gels; corrosive pools; companion escort; a three-step final core shutdown; reactive M.O.R.A. dialogue; five-chamber time trials; three adjustable difficulties; 90 campaign medals; six unlockable suit colors; synthesized music and effects; settings, help, pause, victory, defeat, and restart flows.

Campaign unlocks, best times, medals, colors, and settings save locally when the browser allows storage. A blocked storage API falls back to in-session progress. Time trials pause with the simulation; tab switching automatically pauses play.

## Technical notes
Vanilla HTML, CSS, and JavaScript in one file. Fixed 120 Hz physics with a requestAnimationFrame accumulator; capped particle and projectile counts; scaled canvas input coordinates; bounded Web Audio envelopes. Velocity transforms conserve magnitude between every pair of orthogonal portal normals.

## Verification
`tests/verify.cjs` is a Playwright regression suite; `tests/verification-results.json` records its results. The suite exercises real keyboard/mouse input for the first chamber, portal transforms, fling physics, cubes, plates, beams and pellets, gels, turrets, companion recovery, final core phases, all 30 exit-state transitions, victory/defeat, pause, restart, settings, timeouts, and mobile resizing. It is a mechanics and flow regression suite, not an assertion of human playtesting every puzzle solution.

For an optional local server: `python -m http.server 8080 --bind 0.0.0.0`.
