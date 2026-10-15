# AFTERGLOW
### A falling-block odyssey

Open **index.html** in a modern browser. All CSS, JavaScript, graphics, and synthesized audio are inside that one file. No build step, library, or internet connection is required.

## Five modes
- **Marathon:** clear 150 lines, completing the fifteenth level.
- **Sprint:** clear 40 lines as quickly as possible.
- **Ultra:** a two-minute score attack.
- **Battle:** outplay the Echo AI; send 30 garbage lines or force a top-out.
- **Zen:** endless play. Finish and save a session from Settings.

## Controls
| Action | Keyboard |
|---|---|
| Move | Left / Right or A / D |
| Rotate clockwise | Up, W, or X |
| Rotate counterclockwise | Z |
| Soft drop | Down or S |
| Hard drop | Space |
| Hold | C or Shift |
| Pause / resume | Escape or P |
| Mute | M |

Mouse and touch: use the on-screen buttons, or tap the field to rotate, drag horizontally to move, swipe down to hard drop, and swipe up to hold.

## Systems
Seven-bag randomizer; full JLSTZ and I-piece SRS kick tables; three-piece preview; hold; ghost projection; progressive gravity; capped lock-delay resets; T-spins and mini T-spins; back-to-back multipliers; combos; all-clear bonuses; garbage cancellation; placement-evaluating AI; three adjustable difficulties.

Earn lifetime glow from completed sessions to unlock two additional color palettes. Collect seven achievements and keep per-mode, per-difficulty local records. Mid-session difficulty changes are saved as unranked runs.

Audio is synthesized through the Web Audio API. The ambient soundtrack intensifies with level. Volume, mute, music, motion, and landing-guide settings are available during play.

Progress is saved through localStorage when available. In a restricted/sandboxed viewer, the game still works, but progress only lasts until that page closes. Open the downloaded HTML in a normal browser for persistent records.

## Verification
37 Chromium browser checks passed, including all five modes, wins and losses, restarts, pauses, settings, T-spins, SRS kicks, lock-delay limits, AI placement, garbage cancellation, responsive layouts, saved records, and opaque-origin operation without localStorage.

Optional regression tests are in `tests/`. To run them from the project root with Node.js and Python installed:

```sh
npm install --no-save playwright
npx playwright install --with-deps chromium
python -m http.server 8000
# In another terminal:
node tests/test-game.cjs
node tests/test-edge-cases.cjs
```

The test suite also writes desktop and mobile screenshots to the current directory.
