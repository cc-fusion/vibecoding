import { defineConfig } from 'vite';

/**
 * Build the native ES-module source in `src/` into a single classic-script
 * bundle that exposes `window.MLSMPM`. No runtime dependencies or assets.
 */
export default defineConfig({
  build: {
    target: 'es2019',
    sourcemap: true,
    emptyOutDir: true,
    lib: {
      entry: 'src/index.js',
      name: 'MLSMPM',
      formats: ['iife'],
      fileName: () => 'mls-mpm.js',
    },
  },
});
