// TEMPORARY scratch hook: runs headless simulation diagnostics during `vite build`.
import { buildSync } from 'esbuild';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const outfile = path.join(root, 'scratch', 'diag.bundle.mjs');
try {
  buildSync({
    entryPoints: [path.join(root, 'scratch', 'diag.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    logLevel: 'silent',
  });
  const mod = await import(pathToFileURL(outfile).href);
  writeFileSync(path.join(root, 'scratch', 'diag-output.txt'), mod.output);
} catch (e) {
  writeFileSync(path.join(root, 'scratch', 'diag-output.txt'), 'HOOK ERROR: ' + (e && e.stack ? e.stack : String(e)));
}

export default { plugins: [] };
