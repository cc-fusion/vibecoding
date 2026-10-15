# Crown & Compass

A complete, single-file 4X strategy game inspired by **Civilization Revolution (idea #22)**. Built with vanilla HTML, CSS, Canvas 2D, JavaScript, and synthesized Web Audio. No game libraries, external assets, or network connection required.

## Play

Open **index.html** in a modern browser, or use the live preview. Click **Found an empire**, choose your civilization, and follow the interactive guide. Download and open the file directly, or use the live server, for persistent local saves. Sandboxed viewers without storage support still support a complete session.

## Controls

- **Click / tap:** select a company, city, or tile; move to dotted tiles; attack hostile targets in range.
- **Right-click:** order movement or attack.
- **Drag:** pan. **Scroll / + / −:** zoom.
- **Space:** end turn. **Tab:** next ready company. **F:** fortify.
- **R / D:** research / diplomacy. **H:** capital. **M:** mute.
- **Escape:** pause/settings. **?:** field guide.
- On small screens, **Details / Fold** controls the bottom inspection panel; the city icon opens all cities and companies.

## The world

Four civilizations with distinct bonuses, three adjustable difficulties, 24 technologies, nine unit types, automatic citizen management, land improvements, wonders, great people, trade, alliances, war, veteran promotions, barbarian camps, ancient ruins, and world events.

Win through **domination, science, culture, or economics**. A turn-100 World Council resolves unfinished campaigns by legacy score. Victorious empires can continue in free play. Campaigns, preferences, medals, and past results save locally when storage is available.

## Optional local server & tests

The game itself has no dependencies.

```sh
npm start
# http://localhost:3000
```

For the optional browser regression suite, leave the server running, then in another terminal:

```sh
npm install
npx playwright install --with-deps chromium
npm test
```

The suite covers 30 mechanics/state-flow assertions, seeded full campaigns, settings, responsive touch UI, synthesized audio startup, and operation in a storage-restricted sandbox. Tests use isolated browser storage and do not modify your saved campaign.
