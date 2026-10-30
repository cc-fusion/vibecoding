# MPM Studio documentation

The complete vanilla HTML guide is served at [`/docs.html`](../../docs.html). The browser-native library is the ES module [`/taichi-mpm.mjs`](../taichi-mpm.mjs), which re-exports the runtime modules under `/src/lib/`.

Inline JavaScript scenes are trusted executable code and are not sandboxed. They are loaded as Blob ES modules; this implementation does not use `eval()`.
