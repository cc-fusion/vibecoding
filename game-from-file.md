# Objective

Review the attached image. Design and build it as a complete, playable, feature-rich game using standard HTML (along with CSS and JavaScript) for the main body. React is only permitted as an outer wrapper if required for deployment; do not write the core game logic or main body of the application using React or TypeScript.

Treat the selected idea as a launchpad. Expand it with deep interlocking mechanics, progression, and polish so the result feels like a finished commercial indie title, not a prototype.

---

# Context & Scope

## Background
- Make all design decisions yourself (mechanics, balance, controls, difficulty curve, art direction, sound direction). Do not ask clarifying questions, pause for confirmation, or stop partway.

## Minimum Feature Bar
The finished game must include all of the following:
- **Core loop**: a moment-to-moment loop that is fun within a reasonable amount of time.
- **Systems depth**: multiple interacting systems, where changing one visibly affects the others.
- **Progression**: a meta layer such as upgrades, unlocks, a tech tree, a campaign map, or a lineage. It must persist within the session and, where sensible, via `localStorage`.
- **Difficulty scaling**: escalating waves, levels, or events.
- **Content variety**: at multiple distinct enemy, obstacle, puzzle, or scenario types.
- **Onboarding**: an interactive tutorial or a clear in-game help screen, plus a controls reference.
- **Game feel**: screen shake, particle effects, animation easing, hit feedback, floating text or UI juice.
- **Audio**: fully synthesized sound (Web Audio API) for effects and reactive or ambient music, with a mute/volume control.
- **UI/UX**: a title screen, pause menu, settings, HUD, game-over screen, victory screen, and restart flow. The layout must be responsive to window size.
- **Input**: keyboard and mouse supported. Add touch or gamepad support if feasible.
- **Win and lose states**: both reachable and clearly communicated, with a stats summary at the end.

---

# Tools & Action Boundaries

## Allowed
- Any design, mechanic, art style, or system expansion that improves the game.
- Procedural generation, Canvas 2D, WebGL, or SVG rendering, and the Web Audio API for synthesized audio.
- External libraries via standard CDN links (e.g., Three.js, Phaser, Matter.js, Tone.js) if they load reliably from a single file. Vanilla JS is equally acceptable.
- Combining or modifying ideas from the list, as long as the selected game stays the clear foundation.
- Procedural or code-drawn graphics and emoji, in place of image assets.

## Not Allowed
- Placeholder comments, TODO stubs, unimplemented menu items, or dead buttons.
- Asking for clarification or delivering partial work.

## Priority Order (if constraints conflict)
1. A fully working, complete game.
2. Feature richness and depth.
3. Code brevity.

---

# Output

## Deliverable
- HTML, CSS, and JavaScript
- A brief summary after the code (maximum 150 words, in bullet points) covering: the selected game, the controls, the core systems, and the progression structure.

## Definition of Done (verify each item before presenting)
- [ ] **Launch**: the file opens with no console errors, and the title screen appears and responds to input.
- [ ] **Start → play**: starting a new game initializes all states correctly, with tutorial or help accessible.
- [ ] **Core loop**: the main gameplay loop runs continuously with no soft-locks and no unreachable UI states.
- [ ] **Progression**: upgrades, unlocks, or campaign advancement work, and their effects are applied in play.
- [ ] **Win state**: it is reachable, triggers the victory screen, and offers continue or restart.
- [ ] **Lose state**: it is reachable, triggers the game-over screen with stats, and offers retry.
- [ ] **Restart**: restarting fully resets state, timers, listeners, and audio with no leaks or duplicate loops.
- [ ] **Pause/Settings**: pause, resume, volume or mute, and settings all work mid-game.
- [ ] **Performance**: the game uses `requestAnimationFrame` with delta-time, stays smooth under heavy particle or entity counts, and handles window resize.
- [ ] **Robustness**: edge cases are guarded (empty arrays, division by zero, rapid input, tab blur, `localStorage` unavailable).

Build idea #1
