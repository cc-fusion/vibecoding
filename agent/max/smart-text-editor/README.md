# Smart Text Editor — vanilla edition

A plain HTML, JavaScript, and CSS version of the supplied calculation notepad. No React, React DOM, Vite, Tailwind, CDN, or runtime package installation. The existing math engine and minimal editor layout are preserved. Decimal.js 10.6.0 is the only runtime library; it is included locally for high-precision arithmetic.

## Open the application

**Open `index.html` directly in a modern browser.** It is fully self-contained and works offline. You can also replace the original deployed HTML with this file or serve it from any static host.

The editor intentionally starts empty. Type an expression; a gray inline completion and bottom suggestion chips appear. Results are only inserted when accepted.

```text
2c to k =               → 275.15k
1 atm to torr =         → 760 torr
760 torr to atm =       → 1 atm
1 inHg to mmHg =        → 25.4 mmHg
1 mmHg to Pa =          → 133.322387415 Pa
1 bar to kPa =          → 100 kPa
```

Spacing and target-unit spelling follow the entered expression. `2c to k =` and `2c to k = ` both show the result inline. `c` and `f` are Celsius/Fahrenheit shorthand; `k` resolves to Kelvin. Standard forms such as `°C`, `°F`, `K`, `degC`, `degF`, and full unit names continue to work. Explicit Kelvin-to-Celsius/Fahrenheit conversions are supported too. Uppercase `C(...)` remains the combinations function.

## Keyboard behavior

| Key | Behavior |
| --- | --- |
| Enter | Native newline only; no suggestion acceptance or custom binding |
| Up / Down | Native cursor movement only; no suggestion switching |
| Left / Right | Previous/next suggestion when available; native movement at the ends |
| Tab | Accept selected suggestion; insert a tab if there are no suggestions |
| Shift+Tab | Native focus navigation |
| Alt+1 … Alt+9 | Accept the corresponding suggestion |
| Escape | Dismiss suggestions |

Clicking a chip also accepts it. Modifier-assisted cursor movement and text selection remain native.

## Pressure units

Conversions work between `torr`, `atm`, `Pa`, `psi`, `mmHg`, `inHg`, `bar`, `mbar`/`mb`, `hPa`, `kPa`, `MPa`, `ksi`, `cmHg`, `Ba`, and `at`. Pascal and bar retain SI-prefix support. Full names include pascal, atmosphere, torr, bar, millibar, and barye, including plurals where appropriate. Conversion syntax supports `to`, `in`, `->`, and `→`.

Use SI casing: **Pa** is pascals; **pA** is picoamperes. The engine preserves exact symbol matches instead of conflating these units.

Pressure conventions:

- 1 atm = 101325 Pa.
- 1 torr = 101325 / 760 Pa.
- 1 psi = 4.4482216152605 / 0.0254² Pa.
- 1 mmHg = 133.322387415 Pa; 1 inHg = 25.4 mmHg.
- Mercury-column units use conventional mercury density at 0 °C and standard gravity. Torr and mmHg are therefore very close, but not artificially made identical.

## Preserved features

- Inline ghost text, horizontal suggestion chips, partial target completion, and precision ladders.
- Arithmetic, functions, trigonometry, combinatorics, and the existing non-pressure units.
- Adaptive decimal precision and existing 1000-digit/1000-decimal display limits.
- Light/dark system theme and mobile layout.
- Local note and angle-preference persistence using the original storage keys (`calc-notes-v1`, `calc-notes-angle-v1`). Storage is per browser and origin; moving the app to a different host does not migrate existing notes. Calculations still work if storage is blocked, but notes cannot persist there.

## Editable source — no build required

- `source.html` — normal HTML entry point using native ES modules and a stylesheet.
- `styles.css` — editor styles.
- `src/main.js` — native DOM initialization.
- `src/controller.js` — editing, suggestions, keyboard handling, persistence.
- `src/units.js` — unit factors and aliases.
- `src/analyze.js`, `src/suggest.js`, etc. — original calculation engine, adapted where needed.
- `vendor/` — Decimal.js and its MIT license.
- `index.html` — ready-to-use single-file edition.

To edit and run the separate source files, use any static server, for example:

```sh
python3 -m http.server 8080 --bind 0.0.0.0
```

Visit `/source.html`. Native ES modules are loaded directly, with no compiler or development framework. For a downloadable single-file edition after changing JS or CSS, optionally run:

```sh
python3 package_html.py
```

The small Python script only packages the existing JS/CSS and vendored library into `index.html`. Python is not part of the application runtime. `package.json` exists only to run Node-based tests and contains no package dependencies.

## Tests

```sh
node --test tests/engine.test.js
```

46 engine tests cover a 225-pair pressure conversion matrix, temperature shorthand and inline eligibility, pressure completions, incompatible units, precision continuation, and existing arithmetic/unit features.

Optional browser tests:

```sh
pip install playwright
python -m playwright install --with-deps chromium
python tests/browser_test.py
```

These exercise the actual standalone HTML: inline rendering, acceptance, native Enter/up/down behavior, left/right switching, Escape, click/Alt-number acceptance, local persistence, mobile/dark rendering, offline operation, and an opaque-origin sandbox like the file preview.

## Original application

Adapted from the user-supplied `cc-fusion/vibecoding` application at:
https://github.com/cc-fusion/vibecoding/tree/3776b79a13c61a7da5e14c1855b85ac4d100e5ba/claude-sonnet-5-5/implement-number-precision-limits

The original editor modules and CSS were retained rather than replacing the calculation engine with a reduced implementation. This deliverable does not change the upstream repository.
