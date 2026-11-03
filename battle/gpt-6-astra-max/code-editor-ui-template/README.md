# Code Editor

The application is **`public/code-editor.html`**: one standalone file containing plain HTML, CSS, and JavaScript. Open it directly or serve it from any static server. Monaco and the optional fonts load from a CDN. A basic textarea editor remains usable if Monaco cannot load.

`src/App.tsx` is only the project preview host. The standalone application does not use React or require Vite.

## Customize

Edit the `CONFIG` object near the start of the script in `public/code-editor.html`.

- `language`, `languages`, and `defaultCode`: initial language, language picker, file names, and starter source. Set `defaultCode` to `''` for an empty editor.
- `themes.light` and `themes.dark`: Monaco theme names, or `{ name, data }` custom themes.
- `editor`: Monaco construction options. Indentation is detected from the document rather than forced to a tab or space size.
- `colorMode`, `fontFamilies`, `fontSize`, and `layout`: default appearance, allowed fonts, size limits, and responsive pane settings.
- `buttons` and `result.buttons`: built-in button names or custom `{ id, label, icon, onClick(api), disabled(api) }` definitions. `spacer` and `separator` are optional layout items.
- `storage`: storage keys and save debounce. Saved user preferences override configured defaults. Reset preferences from the settings drawer or use fresh storage keys when changing defaults.
- `onRun`: intentionally `null`. Replace it with an asynchronous `(code, api)` function when connecting a compiler. No compiler is included and code is never run on startup, edits, theme changes, or language changes.

## Integration API

`window.CodeEditor` exposes `getCode`, `setCode`, `setLanguage`, `run`, `save`, `setResult`, `setText`, `setError`, `clearResult`, `openResult`, `notify`, `getSettings`, `updateSettings`, and `renderToolbar`, plus access to the Monaco editor and configuration. Use `setText` for escaped plain-text output, or `setResult` for an HTML document inside the sandboxed result iframe.

The API is on the standalone document's window. When using the project preview wrapper, access it through the `.application-frame` iframe's `contentWindow`.

Results are never stored or restored. Opening a result in a new tab preserves its sandbox. Do not add `allow-same-origin` to an untrusted result's sandbox.

## Development

- `npm run dev`: run the project preview.
- `npm run build`: build the preview and copy the standalone HTML file into `dist/`.
- `npx playwright test tests/editor.spec.ts --workers=1`: run browser tests against a running development server. Set `TEST_URL` to test a different server.
- First-time browser test setup: `npx playwright install --with-deps chromium`.

The tests cover persistence, non-execution, Monaco options, theme changes, settings, keyboard and pointer resizing, mobile layout, sandboxed results, developer buttons, CDN recovery, and unavailable storage.