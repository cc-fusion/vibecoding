import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const files=[];
async function walk(dir) {
  for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const file=path.join(dir,entry.name);
    if(entry.isDirectory()) await walk(file);
    else if(file.endsWith('.js')) files.push(file);
  }
}
await walk('js');
for (const file of files) {
  const checked=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(checked.status !== 0) { console.error(checked.stderr);process.exit(1); }
  const source=await fs.readFile(file,'utf8');
  if (/\?raw["']|from\s+["']react["']/.test(source)) throw new Error(`Build-only dependency in ${file}`);
  for(const match of source.matchAll(/^import .+ from ["'](\.[^"']+)["'];/gm)) {
    if(!match[1].endsWith('.js')) throw new Error(`Extensionless module import in ${file}`);
    await fs.access(path.resolve(path.dirname(file),match[1]));
  }
}
console.log(`PASS: syntax and static module imports checked for ${files.length} application JavaScript files. No React or Vite raw imports.`);
