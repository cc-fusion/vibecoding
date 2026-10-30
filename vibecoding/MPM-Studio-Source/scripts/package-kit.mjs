import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const files = [
  'README.md', 'index.html', 'docs.html', 'package.json',
  'src/app.js', 'src/app.css', 'src/docs.css',
  'src/lib/client.js', 'src/lib/engine.js', 'src/lib/global.js', 'src/lib/index.js',
  'src/lib/renderer.js', 'src/lib/scene-builder.js', 'src/lib/scenes.js',
  'src/lib/worker.js', 'src/lib/wasm/mpmWasm.js',
  'public/taichi-mpm.mjs', 'public/favicon.svg', 'public/docs/taichi-mpm.md',
  'public/examples/quickstart.html', 'public/examples/my-first-scene.json',
  'public/examples/scenes/water-pulse.js',
  'scripts/build.mjs', 'scripts/serve.mjs', 'scripts/package-kit.mjs', 'scripts/test-worker.mjs', 'scripts/test-integration.mjs'
];
const staging = 'dist-source';
await fs.rm(staging, { recursive: true, force: true });
for (const file of files) {
  const target = `${staging}/${file}`;
  await fs.mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true });
  await fs.copyFile(file, target);
}
await fs.mkdir('public/downloads', { recursive: true });
execFileSync('python3', ['-c', `import zipfile,pathlib\np=pathlib.Path('${staging}')\nz=zipfile.ZipFile('public/downloads/mpm-studio-source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9)\nfor f in sorted(p.rglob('*')):\n if f.is_file(): z.write(f, 'mpm-studio/'+str(f.relative_to(p)))\nz.close()`], { stdio: 'inherit' });
const stat = await fs.stat('public/downloads/mpm-studio-source.zip');
console.log(`Source kit: public/downloads/mpm-studio-source.zip (${Math.round(stat.size / 1024)} KB)`);
await fs.rm(staging, { recursive: true, force: true });
