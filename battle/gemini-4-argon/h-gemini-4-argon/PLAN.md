# Smart Text Editor — Architecture & Implementation Plan

## 1. Archive
- Previous VoxelWilds project archived in `archive/voxelwilds/`.

## 2. Core Modules (Plain HTML, CSS & Vanilla ES JavaScript + `decimal.js`)
1. `index.html` & `src/styles.css`
   - Full-screen multiline monospace editor with synchronized backdrop renderer (supporting inline ghost completions and hiding replaced trailing characters prior to acceptance while keeping `<textarea>.value` untouched).
   - Minimal white default aesthetic (with Light/Dark theme support), no header/logo/sidebar.
   - Top-right settings button opening a partially sized modal that blurs the editor and bottom bar; clicking outside closes and saves changes.
   - Fixed bottom bar with dynamic autocomplete chips, conditional target-unit dropdown (shown only when a unit suggestion is active), and rightmost `rad` / `deg` quick switch.
2. `src/logger.js`
   - Structured debug event ring buffer for the Developer Menu console.
3. `src/units.js`
   - 7-SI-base-unit representation (`coeff` + `[m, kg, s, A, K, mol, cd]` exponents).
   - Unit arithmetic, dimensional compatibility validation, derived unit simplification (`J`, `N`, `W`, `Pa`, `Hz`, `V`, `C`, `Ohm`, `F`), metric/imperial normalization ladders, exponent style preservation (`2 kg3` vs `2m**2`), and live JSON import/export.
4. `src/mathEngine.js`
   - Arbitrary-precision arithmetic powered by `decimal.js` plus arbitrary-precision Gauss-Legendre/Machin $\pi$ & Taylor series beyond 1,000 digits.
   - 6-level parser handling standard operators, parentheses, constants, `fn(x)` and prefix `fn x`, implicit multiplication, and unit expressions (`2m**2`, `1 kg m2 s-2`, `10**-6 kg`).
   - Radians/degrees evaluation with automatic sensitivity detection (`rad`/`deg` chip tags shown only when angle mode changes the result).
   - 4-significant-digit rounding, small-addend precision preservation (`pi + 0.000001`), scientific notation thresholds ($10^{\pm 4}$ alternative, $10^{\pm 1000}$ exclusive), `...` preview truncation, and unlimited precision continuation.
5. `src/autocomplete.js`
   - Contextual line & cursor scanner handling embedded prose (`other text 1+1 | other text`, `text.1+1=`, rejecting `text1+1`), Markdown bullets (`- 1+1` bar-only vs `- 1+1=` inline), operator whitespace mirroring, and targeted replacement (`deleteBefore`, `insertText`).
6. `src/main.js`
   - UI state, keyboard handling (`Tab`, `ArrowLeft`/`ArrowRight` boundary-preserving candidate cycling, unmodified `Enter`/`ArrowUp`/`ArrowDown`), chip clicks, unit dropdown switching, settings persistence, and Developer Menu.
