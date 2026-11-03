import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';

const root='taichi-mpm-javascript';
const work='.source/package';
const dest=path.join(work,root);
await fs.rm(work,{recursive:true,force:true});await fs.mkdir(dest,{recursive:true});
const copy=async(from,to)=>{await fs.mkdir(path.dirname(path.join(dest,to)),{recursive:true});await fs.copyFile(from,path.join(dest,to));};
const write=async(name,text)=>{await fs.mkdir(path.dirname(path.join(dest,name)),{recursive:true});await fs.writeFile(path.join(dest,name),text);};
// All web-facing source is copied in JavaScript, never TypeScript.
await copy('src/Playground.jsx','src/Playground.jsx');
await copy('src/Playground.jsx','src/App.jsx');
await copy('src/index.css','src/index.css');
await copy('src/main.jsx','src/main.jsx');
let main=await fs.readFile('src/main.jsx','utf8');main=main.replace("import App from './Playground.jsx';","import App from './App.jsx';");await write('src/main.jsx',main);
for(const file of (await fs.readdir('src/components')))await copy('src/components/'+file,'src/components/'+file);
await copy('src/content.js','src/content.js');
for(const file of (await fs.readdir('src/lib'))){
 if(file==='wasm')continue;
 if((await fs.stat('src/lib/'+file)).isFile())await copy('src/lib/'+file,'src/lib/'+file);
}
await copy('src/lib/wasm/mpmWasm.js','src/lib/wasm/mpmWasm.js');
for(const file of ['cn.js','original-renderer.js']){
 try{await copy('src/lib/'+file,'src/lib/'+file);}catch{}
}
const cn=ts.transpileModule(await fs.readFile('src/utils/cn.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;await write('src/utils/cn.js',cn);
// Original source is retained in the converted engine/scene modules and native kit.
for(const file of ['README.md','build.sh']){let text=await fs.readFile('.source/original/native/'+file,'utf8');text=text.replaceAll('src/sim/engine.ts','src/lib/engine.js').replaceAll('src/sim/worker.ts','src/lib/worker.js').replaceAll('src/sim/wasm/mpmWasm.ts','src/lib/wasm/mpmWasm.js').replaceAll('native/tools/test-scenes.ts','native/tools/test-scenes.js');text=text.replaceAll('engine.ts','engine.js').replaceAll('scenes.ts','scenes.js');if(file==='build.sh')text=text.replaceAll('mpmWasm.ts','mpmWasm.js');await write('native/'+file,text);}
for(const file of ['api.cpp','mpm.h','taichi_lite.h'])await copy('.source/original/native/'+file,'native/'+file);
const testTS=await fs.readFile('.source/original/native/tools/test-scenes.ts','utf8');
let nativeTest=ts.transpileModule(testTS,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext}}).outputText;
nativeTest=nativeTest.replaceAll("../../src/sim/engine", "../../src/lib/engine.js").replaceAll("../../src/sim/scenes", "../../src/lib/scenes.js");
await write('native/tools/test-scenes.js',nativeTest);
await copy('README.md','README.md');await copy('README.md','docs/taichi-mpm.md');await copy('README.md','public/docs/taichi-mpm.md');
await copy('public/favicon.svg','public/favicon.svg');await copy('public/taichi-mpm.js','public/taichi-mpm.js');
await copy('public/examples/quickstart.html','public/examples/quickstart.html');await copy('public/examples/my-first-scene.json','public/examples/my-first-scene.json');
await copy('scripts/build-library.mjs','scripts/build-library.mjs');await copy('scripts/test-worker.mjs','scripts/test-worker.mjs');await copy('scripts/test-browser.mjs','scripts/test-browser.mjs');await copy('scripts/test-runtime.mjs','scripts/test-runtime.mjs');
// Use the host's installed package manifest and lockfile; do not hand-edit dependencies.
await copy('package.json','package.json');await copy('package-lock.json','package-lock.json');
const config=await fs.readFile('vite.config.ts','utf8');await write('vite.config.mjs',config.replace("import { defineConfig } from 'vite';", "import { defineConfig } from 'vite';"));
let index=await fs.readFile('index.html','utf8');await write('index.html',index);
// Keep the archive self-contained and omit the original TS archive, build output, screenshots and test browser binaries.
await fs.mkdir('public/downloads',{recursive:true});await fs.mkdir('public/docs',{recursive:true});
await fs.copyFile('README.md','public/docs/taichi-mpm.md');
execFileSync('python3',['-c',`import zipfile,pathlib\np=pathlib.Path('${dest}')\nz=zipfile.ZipFile('public/downloads/taichi-mpm-javascript.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9)\nfor f in sorted(p.rglob('*')):\n if f.is_file():z.write(f, '${root}/'+str(f.relative_to(p)))\nz.close()`],{stdio:'inherit'});
const stat=await fs.stat('public/downloads/taichi-mpm-javascript.zip');
console.log(`JavaScript kit: public/downloads/taichi-mpm-javascript.zip (${Math.round(stat.size/1024)} KB)`);
