# Test report — Forge IDE vanilla conversion

**Result: 50 tests passed, 0 failed, 0 skipped.**

- **40/40 Chromium integration tests** passed; zero retries/flaky passes.
- **10/10 Node unit tests** passed.
- Syntax and static module-import checks passed for **39 application JavaScript files**.

## Environment and execution

- Date: October 14, 2026.
- Browser: headless Chromium **156.0.8078.4**, Playwright **1.64.1**.
- Node: **20.20.2**; Linux x86-64.
- Host: supplied static server at `http://localhost:5173`, without cross-origin isolation.
- C/C++ engine actually tested: **LLVM 8 Clang/LLD WASI compatibility runtime**, C17/C++17.
- Browser integration runtime: **292.6 seconds**.
- `IGNORE_HTTPS_ERRORS=1` was used for test-browser certificate handling in this environment. Browser CORS, iframe sandboxing, worker isolation and normal runtime downloads were not disabled. The application does not disable TLS verification.

Commands executed:

```sh
npm run check
npm run test:unit
IGNORE_HTTPS_ERRORS=1 npm run test:browser
```

## What “passed” means

Each positive execution case used the real compiler/runtime inside Chromium, via the IDE's Run toolbar button. Tests asserted completion, exit code 0 and the expected computed output—not merely that a language was present in a menu. Positive cases also rejected runtime error/stderr records and uncaught browser/console errors.

JavaScript, TypeScript, Python, AssemblyScript, C, C++, C# and Java all passed. HTML/CSS/JavaScript preview passed rendering, style, interaction, navigation, isolation and refresh assertions. All 13 editor language IDs were verified.

Negative tests intentionally use invalid programs and verify failure/diagnostics, followed by a successful corrected rerun. These **expected program failures** are successful test assertions, not application regressions. Stop/re-run tests cover every executable language and exercise cancellation of running/loading runtimes. No runtime is mocked; no native OS compiler/interpreter is substituted.

Storage tests modify a Monaco model, create/rename files, wait for IndexedDB data, reload the page, and check both content and saved theme. The final screenshot asserts zero Problems errors.

## Browser integration cases

| Test | Result | Seconds |
|---|---|---:|
| JavaScript: shipped example runs through the toolbar with expected output | PASS | 0.41 |
| TypeScript: shipped example runs through the toolbar with expected output | PASS | 2.02 |
| Python: shipped example runs through the toolbar with expected output | PASS | 2.52 |
| AssemblyScript: shipped example runs through the toolbar with expected output | PASS | 1.64 |
| C: shipped example runs through the toolbar with expected output | PASS | 1.95 |
| C++: shipped example runs through the toolbar with expected output | PASS | 2.03 |
| C#: shipped example runs through the toolbar with expected output | PASS | 4.89 |
| Java: shipped example runs through the toolbar with expected output | PASS | 12.40 |
| Build compiles all five compiler targets without executing user programs | PASS | 6.39 |
| HTML + CSS + JavaScript: sandbox, style, interactivity, navigation and auto-refresh | PASS | 1.78 |
| All 13 editor modes load, including CSS, JSON, Markdown and plain text | PASS | 0.34 |
| JavaScript: CommonJS modules, JSON and asynchronous console output | PASS | 0.51 |
| Python: imports see edits on repeated runs and deleted modules are unavailable | PASS | 0.75 |
| AssemblyScript: multi-file WebAssembly compilation | PASS | 0.57 |
| C: multi-file linking with a nested project header | PASS | 0.44 |
| C++: multi-file linking with a nested project header | PASS | 1.37 |
| C#: multiple files and Main(string[] args) | PASS | 0.40 |
| C#: top-level statements execute unchanged | PASS | 0.62 |
| C#: runtime exceptions are failures, never false successes | PASS | 0.35 |
| C#: nonzero Main exit codes are preserved | PASS | 0.45 |
| Java: multiple source files and warm repeated execution | PASS | 10.58 |
| JavaScript: intentional error is reported and a corrected rerun succeeds | PASS | 0.40 |
| TypeScript: intentional error is reported and a corrected rerun succeeds | PASS | 0.68 |
| Python: intentional error is reported and a corrected rerun succeeds | PASS | 0.49 |
| AssemblyScript: intentional error is reported and a corrected rerun succeeds | PASS | 1.49 |
| C: intentional error is reported and a corrected rerun succeeds | PASS | 1.35 |
| C++: intentional error is reported and a corrected rerun succeeds | PASS | 3.08 |
| C#: intentional error is reported and a corrected rerun succeeds | PASS | 2.72 |
| Java: intentional error is reported and a corrected rerun succeeds | PASS | 13.90 |
| JavaScript: Stop terminates execution and the next run succeeds | PASS | 9.68 |
| TypeScript: Stop terminates execution and the next run succeeds | PASS | 4.73 |
| Python: Stop terminates execution and the next run succeeds | PASS | 138.92 |
| AssemblyScript: Stop terminates execution and the next run succeeds | PASS | 4.93 |
| C: Stop terminates execution and the next run succeeds | PASS | 6.46 |
| C++: Stop terminates execution and the next run succeeds | PASS | 14.01 |
| C#: Stop terminates execution and the next run succeeds | PASS | 13.20 |
| Java: Stop terminates execution and the next run succeeds | PASS | 14.36 |
| Editor edits and structural changes survive a real page reload | PASS | 6.30 |
| Quick Open, themes, panel shortcuts and command console work | PASS | 0.29 |
| Final clean desktop screenshot | PASS | 0.47 |

## Unit coverage

Path normalization; traversal clamping; segment-aware path helpers; invalid filename/path validation; language IDs/detection; executable-language coverage in the example project; nested file create/rename/delete; collision rejection; serialized language overrides; event subscription/unsubscription.

## Evidence

- `reports/browser-results.json` — machine-readable Playwright results.
- `reports/test-run.log` — final browser-test console log.
- `reports/unit-results.txt` — Node TAP results.
- `reports/static-checks.txt` — application syntax/import check result.
- `reports/desktop.png` — screenshot from the passing final browser test.

## Boundaries of this verification

This verifies the recorded programs and regression scenarios in one Chromium environment. It does not certify every possible program or guarantee future third-party CDN availability. Firefox, Safari, offline execution, arbitrary external package installation, fully asynchronous C# entry points and the optional cross-origin-isolated Wasmer/C++20 path were not verified. See `README.md` for runtime/API limitations and licensing requirements.
