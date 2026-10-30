import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
await fs.rm(out, { recursive: true, force: true });
await fs.mkdir(out, { recursive: true });
async function copyTree(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name), to = path.join(dest, entry.name);
    if (entry.isDirectory()) { await fs.mkdir(to, { recursive: true }); await copyTree(from, to); }
    else await fs.copyFile(from, to);
  }
}
for (const file of ['index.html', 'docs.html', 'README.md']) await fs.copyFile(path.join(root, file), path.join(out, file));
for (const dir of ['src', 'public']) {
  if (dir === 'src') await copyTree(path.join(root, dir), path.join(out, dir));
  else await copyTree(path.join(root, dir), out);
}
console.log(`Static build written to ${out}`);
