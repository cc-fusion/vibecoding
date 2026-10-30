import { MPMEngine, TextureFactory } from '../src/lib/engine.js';
import { SCENES } from '../src/lib/scenes.js';
import { DEFAULT_SCENE, buildScene } from '../src/lib/scene-builder.js';
import assert from 'node:assert/strict';
const engine=await MPMEngine.create((line,level)=>{if(level==='error')throw new Error(line);});
for(const scene of SCENES){
 engine.reset();
 const ctx={engine,tex:new TextureFactory(engine,scene.dim),quality:'low'};
 const {frameUpdate}=scene.setup(ctx);
 for(let f=0;f<2;f++){frameUpdate?.(engine.time(),scene.frameDt);engine.beginStep(scene.frameDt);let safety=0;while(!engine.advance(1000)){if(++safety>100)throw new Error('Substeps did not finish');}}
 const {data,count}=engine.exportParticles(0);
 assert.ok(count>0,scene.id+' has particles');
 for(let i=0;i<count;i++)assert.ok([data[i*4],data[i*4+1],data[i*4+2]].every(Number.isFinite),scene.id+' has finite positions');
 console.log('PASS:',scene.id,`${count} particles`,`${engine.time().toFixed(3)} s`);
}
engine.reset();
const ctx={engine,tex:new TextureFactory(engine,2),quality:'low'};
const {mpm,frameUpdate}=buildScene(DEFAULT_SCENE,ctx);
engine.beginStep(.01);while(!engine.advance(1000));
mpm.general_action({action:'set_config',gravity:[0,-4.5]});
engine.beginStep(.01);while(!engine.advance(1000));
assert.ok(engine.exportParticles(0).count>0);
console.log('PASS: JSON scene definition and live native gravity.');
engine.reset();
