import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vite.dev/config/
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    // Emit a single self-contained index.html (JS + CSS inlined) so the
    // editor works when the file is opened directly, without a dev server.
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
  },
});
