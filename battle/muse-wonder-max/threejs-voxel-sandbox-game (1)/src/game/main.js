import * as THREE from 'three';
import { World, SEA, HEIGHT } from './world.js';
import { BLOCKS, ITEMS, defOf, isBlock, makeAtlasTexture, iconFor } from './blocks.js';
import { MobManager } from './mobs.js';
import { GameAudio } from './audio.js';
import { stringSeed } from './noise.js';

const $=s=>document.querySelector(s);
const SAVE_KEY='voxelcraft-save-v1';
const audio=new GameAudio();

/* ---------------- state ---------------- */
let S=null;
function defaultState(seedStr, mode){
  return {
    seedStr, seed: seedStr? stringSeed(seedStr): (Math.random()*1e9)|0,
    mode, day:1, time:0.18, weather:'clear', weatherT:120,
    health:20, hunger:20, xp:0, level:0, air:10,
    selected:0,
    inv:new Array(36).fill(null),
    stats:{mined:0,placed:0,kills:0,crafted:0,deaths:0},
    quests:{}, edited:{}, spawn:null, playerPos:null,
    settings:{rd:5, sens:1, sound:true},
  };
}
function giveStartingKit(){
  if(S.mode==='survival'){ addItem(101,1,true); }
}
const RECIPES=[
 {out:8,count:4,cost:{6:1},name:'Oak Planks'},
 {out:100,count:4,cost:{8:2},name:'Sticks'},
 {out:19,count:1,cost:{8:4},name:'Crafting Table'},
 {out:110,count:1,cost:{8:3,100:2},name:'Wooden Pickaxe', needTable:true},
 {out:113,count:1,cost:{8:2,100:1},name:'Wooden Sword', needTable:true},
 {out:111,count:1,cost:{14:3,100:2},name:'Stone Pickaxe', needTable:true, needPick:1},
 {out:114,count:1,cost:{14:2,100:1},name:'Stone Sword', needTable:true, needPick:1},
 {out:112,count:1,cost:{204:3,100:2},name:'Iron Pickaxe', needTable:true, needPick:2},
 {out:26,count:4,cost:{200:1,100:1},name:'Torches'},
 {out:9,count:1,cost:{},name:'—', hidden:true},
 {out:21,count:4,cost:{201:0},name:'—', hidden:true}, // placeholder filtered
 {out:21,count:1,cost:{3:0},name:'—', hidden:true},
 {out:22,count:4,cost:{3:4},name:'Stone Bricks', needTable:true},
 {out:20,count:1,cost:{14:8},name:'Furnace', needTable:true, needPick:1},
].filter(r=>!r.hidden);
RECIPES.push({out:21,count:1,cost:{14:0},name:'—',hidden:true});
RECIPES.pop();
RECIPES.push({out:206,count:1,cost:{101:0},name:'—',hidden:true}); RECIPES.pop();
// extra clean recipes appended properly
RECIPES.push({out:8,count:1,cost:{},name:'—',hidden:true}); RECIPES.pop();
const SMELT=[
 {inp:4,out:9,name:'Glass (from Sand)'},
 {inp:103,out:102,name:'Cooked Pork (from Raw Pork)'},
 {inp:201,out:204,name:'Iron Ingot (from Raw Iron)'},
 {inp:202,out:205,name:'Gold Ingot (from Raw Gold)'},
 {inp:14,out:3,name:'Stone (from Cobblestone)'},
 {inp:6,out:200,name:'Charcoal (from Oak Log)'},
];
const QUESTS=[
 {id:'wood',label:'Gather an Oak Log', check:()=>countItem(6)>=1||S.stats.mined>=1, hint:'Punch a tree trunk'},
 {id:'planks',label:'Craft Oak Planks', check:()=>S.stats.crafted>=1||countItem(8)>=1},
 {id:'table',label:'Craft a Crafting Table', check:()=>countItem(19)>=1||hasPlaced(19)},
 {id:'pick',label:'Craft a Wooden Pickaxe', check:()=>hasItemAny([110,111,112])},
 {id:'stone',label:'Mine 10 stone or cobblestone', check:()=>countItem(14)+countItem(3)>=10||S.stats.stone>=10},
 {id:'iron',label:'Find Raw Iron', check:()=>countItem(201)>=1||countItem(204)>=1},
 {id:'diamond',label:'Unearth a Diamond', check:()=>countItem(203)>=1},
 {id:'night',label:'Survive a full night', check:()=>!!S.quests.nightDone},
 {id:'build',label:'Place 25 blocks', check:()=>S.stats.placed>=25},
 {id:'hunter',label:'Defeat 3 monsters', check:()=>S.stats.monsterKills>=3},
];
function hasPlaced(id){ return Object.values(S.edited).includes(id); }
function hasItemAny(ids){ return ids.some(id=>countItem(id)>0); }

/* ---------------- three setup ---------------- */
const canvas=$('#game-canvas');
const renderer=new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(innerWidth,innerHeight);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x87ceeb);
scene.fog=new THREE.Fog(0x87ceeb, 40, 140);
const camera=new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 400);
scene.add(camera);
const hemi=new THREE.HemisphereLight(0xcfe8ff, 0x4a3b28, 0.9); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xfff2d8, 1.6); scene.add(sun); scene.add(sun.target);
const sunBall=new THREE.Mesh(new THREE.SphereGeometry(3,12,12), new THREE.MeshBasicMaterial({color:0xffe98a, fog:false})); scene.add(sunBall);
const moonBall=new THREE.Mesh(new THREE.SphereGeometry(2.2,12,12), new THREE.MeshBasicMaterial({color:0xdfe8ff, fog:false})); scene.add(moonBall);
// stars
{ const n=700, pos=new Float32Array(n*3); for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2,e=Math.random()*Math.PI-Math.PI/2,r=320; pos[i*3]=Math.cos(a)*Math.cos(e)*r; pos[i*3+1]=Math.abs(Math.sin(e)*r)*0.9+4; pos[i*3+2]=Math.sin(a)*Math.cos(e)*r; } const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3)); window._stars=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:1.4,sizeAttenuation:false,transparent:true,opacity:0})); scene.add(window._stars); }
// clouds
const clouds=new THREE.Group(); scene.add(clouds);
{ const cm=new THREE.MeshLambertMaterial({color:0xffffff, transparent:true, opacity:0.75});
  for(let i=0;i<36;i++){ const w=10+Math.random()*22; const m=new THREE.Mesh(new THREE.BoxGeometry(w,1.6,6+Math.random()*10), cm); m.position.set((Math.random()-0.5)*260, 56+Math.random()*5, (Math.random()-0.5)*260); clouds.add(m); } }
// weather particles
const WEATHER_N=900;
const wGeo=new THREE.BufferGeometry(); const wPos=new Float32Array(WEATHER_N*3);
for(let i=0;i<WEATHER_N;i++){ wPos[i*3]=(Math.random()-0.5)*44; wPos[i*3+1]=Math.random()*28; wPos[i*3+2]=(Math.random()-0.5)*44; }
wGeo.setAttribute('position', new THREE.BufferAttribute(wPos,3));
const weatherPts=new THREE.Points(wGeo, new THREE.PointsMaterial({color:0xaaccee,size:0.14,transparent:true,opacity:0.85}));
weatherPts.visible=false; scene.add(weatherPts);
// hand viewmodel
const handGroup=new THREE.Group(); handGroup.position.set(0.52,-0.52,-0.85); handGroup.rotation.set(0.15,-0.25,0); camera.add(handGroup);
const handCube=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.26,0.26), new THREE.MeshLambertMaterial({color:0xb08a4f})); handGroup.add(handCube);
const highlight=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002,1.002,1.002)), new THREE.LineBasicMaterial({color:0xffffff, transparent:true, opacity:0.85}));
highlight.visible=false; scene.add(highlight);

let atlasTex=null, atlasCanvas=null, world=null, mobs=null;
const iconCache=new Map();
function icon(id){ if(!iconCache.has(id)) iconCache.set(id, iconFor(id, atlasCanvas)); return iconCache.get(id); }

/* ---------------- player ---------------- */
const player={ pos:new THREE.Vector3(0,30,0), vel:new THREE.Vector3(), yaw:0, pitch:0, onGround:false, fly:false, inWater:false, headWater:false, fallStart:null };
const keys={};
let playing=false, locked=false, panelOpen=null, carrySlot=null;
let mining={target:null, progress:0};
let placeHold=false, placeTimer=0, swingT=0;
const particles=[];
const particleGeo=new THREE.BoxGeometry(0.09,0.09,0.09);
function spawnParticles(x,y,z,color,n=16){
  for(let i=0;i<n;i++){
    const m=new THREE.Mesh(particleGeo, new THREE.MeshLambertMaterial({color}));
    m.position.set(x+(Math.random()-0.5)*0.7, y+(Math.random()-0.5)*0.7, z+(Math.random()-0.5)*0.7);
    scene.add(m);
    particles.push({m, v:new THREE.Vector3((Math.random()-0.5)*4, Math.random()*4.5+1, (Math.random()-0.5)*4), life:0.55+Math.random()*0.3});
  }
}

/* ---------------- inventory ---------------- */
function addItem(id,count=1,silent=false){
  if(!id||count<=0) return;
  if(S.mode==='creative' && isBlock(id)) { /* still stack */ }
  let remaining=count;
  for(let pass=0;pass<2 && remaining>0;pass++){
    for(let i=0;i<36 && remaining>0;i++){
      const s=S.inv[i];
      if(pass===0 && s && s.id===id && s.count<64){ const take=Math.min(64-s.count,remaining); s.count+=take; remaining-=take; }
      if(pass===1 && !s){ const take=Math.min(64,remaining); S.inv[i]={id,count:take}; remaining-=take; }
    }
  }
  if(!silent) audio.pop();
  renderHotbar(); if(panelOpen==='inv') renderInventory();
}
function countItem(id){ return S.inv.reduce((a,s)=>a+(s&&s.id===id?s.count:0),0); }
function consumeItem(id,count=1){
  let rem=count;
  for(let i=0;i<36&&rem>0;i++){ const s=S.inv[i]; if(s&&s.id===id){ const t=Math.min(s.count,rem); s.count-=t; rem-=t; if(s.count<=0)S.inv[i]=null; } }
  renderHotbar(); if(panelOpen==='inv') renderInventory();
  return rem===0;
}
function heldSlot(){ return S.inv[S.selected]; }
function heldToolTier(kind){
  const s=heldSlot(); if(!s) return 0; const d=defOf(s.id); if(!d||!d.tool) return 0;
  if(kind==='pick') return d.tool.tier||0; return 0;
}
function heldDamage(){ const s=heldSlot(); if(!s) return 3; const d=defOf(s.id); return d&&d.tool&&d.tool.damage? d.tool.damage:3; }

/* ---------------- UI: hotbar / hearts ---------------- */
const heartSVG=(frac)=>{ const col=frac>=1?'#e83a3a':(frac>0?'url(#hg)':'#3a3f3a'); return `<svg class="heart" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.6 2.3 5 5.7 5c2 0 3.4 1.1 4.3 2.4h4c.9-1.3 2.3-2.4 4.3-2.4 3.4 0 5.3 3.6 3.7 6.7C19.5 16.4 12 21 12 21z" fill="${frac>0&&frac<1?'#e88a8a':'#e83a3a'}" opacity="${frac<=0?0.25:1}"/></svg>`; };
const drumSVG=(full)=>`<svg class="drum" viewBox="0 0 24 24"><path d="M15 3c3 1 5 4 5 8 0 5-4 9-9 10-1-3 0-5 1-7-2 0-4-1-5-3C6 8 9 4 15 3z" fill="${full?'#c97b3f':'#3a3f3a'}" opacity="${full?1:0.3}"/><circle cx="15" cy="8" r="1.6" fill="#8a5a28" opacity="${full?1:0.2}"/></svg>`;
function renderVitals(){
  let h=''; for(let i=0;i<10;i++){ const frac=Math.max(0,Math.min(1,(S.health-i*2)/2)); h+=heartSVG(frac); }
  $('#hearts').innerHTML = S.mode==='creative' ? '<span style="font-size:12px;color:#8fd14f;font-weight:800">CREATIVE</span>' : h;
  let hu=''; for(let i=0;i<10;i++) hu+=drumSVG(S.hunger>= (i+1)*2);
  $('#hunger').innerHTML = S.mode==='creative' ? '' : hu;
  const need=S.level*20+20; $('#xpfill').style.width=Math.min(100,(S.xp/need)*100)+'%';
  $('#lvltext').textContent='Level '+S.level+(S.mode==='creative'?' · fly with F':'');
}
function renderHotbar(){
  const bar=$('#hotbar'); bar.innerHTML='';
  for(let i=0;i<9;i++){
    const s=S.inv[i]; const d=document.createElement('div'); d.className='slot'+(i===S.selected?' sel':'');
    d.innerHTML=`<span class="key">${i+1}</span>`+(s?`<img src="${icon(s.id)}" alt=""><span class="cnt">${S.mode==='creative'&&isBlock(s.id)?'∞':s.count}</span>`:'');
    d.title=s?defOf(s.id).name:'';
    d.onclick=()=>{ selectSlot(i); };
    bar.appendChild(d);
  }
  const s=heldSlot(); if(s){ handCube.material.color.set(defOf(s.id)?.color||'#fff'); handCube.visible=true; } else handCube.visible=true;
}
let selNameTimer=null;
function selectSlot(i){ S.selected=i; renderHotbar(); const s=heldSlot(); const el=$('#selname'); if(s){ el.textContent=defOf(s.id).name; el.style.opacity=1; clearTimeout(selNameTimer); selNameTimer=setTimeout(()=>el.style.opacity=0,1100); } else el.style.opacity=0; }
function renderInventory(){
  const grid=$('#invgrid'); grid.innerHTML='';
  const order=[...Array(27).keys()].map(i=>i+9).concat([...Array(9).keys()]);
  for(const i of order){
    const s=S.inv[i]; const d=document.createElement('div'); d.className='slot'+(carrySlot===i?' carry':'');
    d.innerHTML=s?`<img src="${icon(s.id)}"><span class="cnt">${s.count}</span>`:'';
    d.title=s?defOf(s.id).name:'';
    d.onclick=()=>{
      if(carrySlot===null){ if(S.inv[i]) carrySlot=i; }
      else { const tmp=S.inv[carrySlot]; S.inv[carrySlot]=S.inv[i]; S.inv[i]=tmp; carrySlot=null; }
      renderInventory(); renderHotbar();
    };
    grid.appendChild(d);
  }
  $('#creative-palette').classList.toggle('hidden', S.mode!=='creative');
  if(S.mode==='creative'){
    const pal=$('#palette'); pal.innerHTML='';
    for(const id of Object.keys(BLOCKS).map(Number).filter(id=>id!==10)){
      const d=document.createElement('div'); d.className='slot'; d.innerHTML=`<img src="${icon(id)}">`; d.title=BLOCKS[id].name;
      d.onclick=()=>{ addItem(id,64); };
      pal.appendChild(d);
    }
    for(const id of [110,111,112,113,114,101,102]){ const d=document.createElement('div'); d.className='slot'; d.innerHTML=`<img src="${icon(id)}">`; d.title=defOf(id).name; d.onclick=()=>addItem(id, id<200&&id>=110?1:16); pal.appendChild(d); }
  }
}
function canCraft(r){
  for(const [id,c] of Object.entries(r.cost)) if(Number(c)>0 && countItem(Number(id))<Number(c)) return false;
  if(r.needTable && !nearBlock(19) && !(countItem(19)>0 && nearPlacedTableFallback())) return false;
  if(r.needPick && heldToolTier('pick')<0) return false;
  if(r.needPick && !hasItemAny([110,111,112].slice(0, r.needPick+1)) && heldToolTier('pick')<r.needPick) {
    // require owning appropriate pick
    if(r.out!==110 && !hasItemAny([110,111,112])) return false;
  }
  return true;
}
function nearPlacedTableFallback(){ return false; }
function nearBlock(id){
  const p=player.pos;
  for(let x=-4;x<=4;x++)for(let y=-3;y<=4;y++)for(let z=-4;z<=4;z++) if(world.getBlock(Math.floor(p.x)+x,Math.floor(p.y)+y,Math.floor(p.z)+z)===id) return true;
  return false;
}
function recipeReason(r){
  const parts=[];
  for(const [id,c] of Object.entries(r.cost)) if(Number(c)>0) parts.push(`${defOf(Number(id)).name} ×${c} (have ${countItem(Number(id))})`);
  if(r.needTable && !nearBlock(19)) parts.push('needs a placed Crafting Table nearby');
  return parts.join(' · ');
}
function renderRecipes(kind){
  const list = kind==='smelt'? $('#smelt-list') : $('#recipes');
  const arr = kind==='smelt'? SMELT : RECIPES;
  const hasFurnace = nearBlock(20);
  list.innerHTML='';
  for(const r of arr){
    let ok, costHtml;
    if(kind==='smelt'){
      ok = hasFurnace && countItem(r.inp)>=1 && countItem(200)>=1 && !(r.inp===6&&false);
      costHtml=`${defOf(r.inp).name} ×1 + Coal ×1 (have ${countItem(r.inp)} / ${countItem(200)})${hasFurnace?'':' · needs placed Furnace nearby'}`;
    } else {
      ok=canCraft(r);
      costHtml=recipeReason(r)||'free';
    }
    const d=document.createElement('div'); d.className='recipe '+(ok?'can':'locked');
    d.innerHTML=`<img src="${icon(r.out)}"><div><b>${r.name||defOf(r.out).name}</b><div style="color:var(--dim);font-size:11px">Makes ${defOf(r.out).name} ×${r.count||1}</div></div><div class="cost">${costHtml}</div>`;
    if(ok) d.onclick=()=>{
      if(kind==='smelt'){ consumeItem(r.inp,1); consumeItem(200,1); addItem(r.out,1); }
      else { for(const [id,c] of Object.entries(r.cost)) if(Number(c)>0) consumeItem(Number(id),Number(c)); addItem(r.out, r.count||1); }
      S.stats.crafted++; audio.craft(); checkQuests(); renderRecipes(kind); renderVitals();
    };
    list.appendChild(d);
  }
}
function renderQuests(){
  $('#objlist').innerHTML=QUESTS.map(q=>{
    const done=!!S.quests[q.id];
    return `<div class="${done?'done':'todo'}">${done?'✓':'○'} ${q.label}${q.hint&&!done?` <span style="font-size:12px">— ${q.hint}</span>`:''}</div>`;
  }).join('');
}
let toastTimer=null;
function toast(msg){ const el=$('#objtoast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2600); }
function checkQuests(){
  for(const q of QUESTS){
    if(!S.quests[q.id] && q.check()){
      S.quests[q.id]=true; gainXP(5); toast('Quest complete: '+q.label); audio.level();
    }
  }
  if(panelOpen==='obj') renderQuests();
}
function gainXP(n){ S.xp+=n; const need=S.level*20+20; if(S.xp>=need){ S.xp-=need; S.level++; toast('Level up! You are level '+S.level); audio.level(); } renderVitals(); }

/* ---------------- save / load ---------------- */
function save(){
  if(!S) return;
  S.playerPos={x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:player.yaw,pitch:player.pitch};
  if(!S.spawn && S.playerPos) S.spawn={...S.playerPos};
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){}
  const sub=$('#pause-sub'); if(sub) sub.textContent=`Saved · Day ${S.day} · ${S.stats.mined} blocks mined`;
}
function loadSave(){
  try{ const raw=localStorage.getItem(SAVE_KEY); return raw? JSON.parse(raw):null; }catch(e){ return null; }
}

/* ---------------- world start ---------------- */
function startGame(state){
  S=state;
  if(!atlasTex){ atlasTex=makeAtlasTexture(); atlasCanvas=atlasTex.userData.canvas; }
  if(world) world.dispose();
  for(const p of particles){ scene.remove(p.m); } particles.length=0;
  // rebuild edited map
  const edited=new Map(Object.entries(S.edited||{}).map(([k,v])=>[k,Number(v)]));
  S.edited = S.edited||{};
  // wrap edited sync: World holds map; we mirror on edits via callback below
  world=new World(scene, S.seed, atlasTex, edited);
  world._editedRef=edited;
  if(mobs) mobs.clear();
  mobs=new MobManager(scene, world, audio);
  // spawn
  if(S.playerPos){ player.pos.set(S.playerPos.x,S.playerPos.y,S.playerPos.z); player.yaw=S.playerPos.yaw||0; player.pitch=S.playerPos.pitch||0; }
  else { player.pos.set(2.5, 40, 2.5); const y=world.heightAt(2,2); /* chunk not gen yet */ }
  // generate around spawn synchronously
  world.queueAround(player.pos.x, player.pos.z, S.settings.rd);
  let guard=0; while(world.queue.length && guard++<400){ const {cx,cz}=world.queue.shift(); const ch=world.ensureChunk(cx,cz); if(ch.dirty){ world.buildMesh(ch); ch.dirty=false; } }
  if(!S.playerPos){
    const gy=world.surfaceY(2,2)+1; player.pos.set(2.5, gy+0.1, 2.5); S.spawn={x:player.pos.x,y:player.pos.y,z:player.pos.z,yaw:0,pitch:0};
  }
  if(S.inv.every(s=>!s)) giveStartingKit();
  $('#menu-main').classList.add('hidden'); $('#menu-pause').classList.add('hidden'); $('#menu-death').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if('ontouchstart' in window) $('#touchui').classList.remove('hidden');
  playing=true;
  renderHotbar(); renderVitals(); renderQuests(); checkQuests();
  if(S.mode==='survival' && countItem(6)===0 && !S.quests.wood) setTimeout(()=>toast('Tip: punch a tree to gather wood'),700);
  save();
  requestLock();
  lastBiome='';
  minimapT=0;
}
function worldSetBlock(x,y,z,id){
  world.setBlock(x,y,z,id,true);
  S.edited[x+','+y+','+z]=id;
}
function requestLock(){ if(!('ontouchstart' in window)) canvas.requestPointerLock(); }

/* ---------------- input ---------------- */
document.addEventListener('pointerlockchange', ()=>{
  locked=document.pointerLockElement===canvas;
  if(!locked && playing && !panelOpen && !anyOverlayOpen()) openPause();
});
function anyOverlayOpen(){ return !$('#menu-pause').classList.contains('hidden')||!$('#menu-death').classList.contains('hidden')||!$('#menu-main').classList.contains('hidden'); }
canvas.addEventListener('click', ()=>{ if(playing && !locked && !panelOpen && !anyOverlayOpen()) requestLock(); });
document.addEventListener('mousemove', e=>{
  if(!locked||!playing) return;
  player.yaw -= e.movementX*0.0022*S.settings.sens;
  player.pitch -= e.movementY*0.0022*S.settings.sens;
  player.pitch=Math.max(-1.55,Math.min(1.55,player.pitch));
});
let mouseDown={left:false,right:false};
document.addEventListener('mousedown', e=>{
  if(!playing||!locked) return;
  audio.init();
  if(e.button===0){ mouseDown.left=true; swingT=0.35; tryAttackOrMineStart(); }
  if(e.button===2){ mouseDown.right=true; doPlace(); placeTimer=0.24; }
});
document.addEventListener('mouseup', e=>{ if(e.button===0){mouseDown.left=false; mining.progress=0; mining.target=null; $('#breakbar').classList.add('hidden');} if(e.button===2) mouseDown.right=false; });
document.addEventListener('contextmenu', e=>{ if(playing) e.preventDefault(); });
document.addEventListener('wheel', e=>{ if(!playing) return; selectSlot((S.selected + (e.deltaY>0?1:-1) +9)%9); }, {passive:true});
document.addEventListener('keydown', e=>{
  keys[e.code]=true;
  if(!playing) return;
  if(e.code.startsWith('Digit')){ const n=Number(e.code.slice(5)); if(n>=1&&n<=9) selectSlot(n-1); }
  if(e.code==='KeyE'){ panelOpen==='inv'&&currentTab==='inv'? closePanels() : openPanel('inv','inv'); }
  if(e.code==='KeyC'){ panelOpen==='inv'&&currentTab==='craft'? closePanels() : openPanel('inv','craft'); }
  if(e.code==='KeyQ'){ panelOpen==='obj'? closePanels() : openPanel('obj'); }
  if(e.code==='KeyF'){
    if(S.mode==='creative'){ player.fly=!player.fly; player.vel.y=0; toast(player.fly?'Flying enabled':'Flying disabled'); }
    else eatSelected();
  }
  if(e.code==='Space') e.preventDefault();
});
document.addEventListener('keyup', e=>keys[e.code]=false);
function eatSelected(){
  const s=heldSlot(); if(!s) return; const d=defOf(s.id);
  if(d&&d.food){ if(S.hunger>=20){ toast('You are full'); return; } S.hunger=Math.min(20,S.hunger+d.food); if(S.inv[S.selected].count<=1)S.inv[S.selected]=null; else S.inv[S.selected].count--; audio.eat(); renderHotbar(); renderVitals(); toast('Ate '+d.name); }
  else toast('Select food in your hotbar, then press F');
}

/* panels */
let currentTab='inv';
function openPanel(kind, tab='inv'){
  panelOpen=kind; carrySlot=null;
  document.exitPointerLock && document.exitPointerLock();
  if(kind==='inv'){ $('#panel-inv').classList.remove('hidden'); switchTab(tab); }
  else { $('#panel-obj').classList.remove('hidden'); renderQuests(); }
}
function closePanels(){ panelOpen=null; $('#panel-inv').classList.add('hidden'); $('#panel-obj').classList.add('hidden'); if(playing) requestLock(); }
function switchTab(tab){ currentTab=tab; document.querySelectorAll('#inv-tabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
  $('#tab-inv').classList.toggle('hidden',tab!=='inv'); $('#tab-craft').classList.toggle('hidden',tab!=='craft'); $('#tab-smelt').classList.toggle('hidden',tab!=='smelt');
  $('#inv-title').textContent= tab==='craft'?'Crafting':(tab==='smelt'?'Smelting':'Inventory');
  if(tab==='inv') renderInventory(); else renderRecipes(tab);
}
document.querySelectorAll('#inv-tabs button').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('#btn-close-inv').onclick=closePanels; $('#btn-close-obj').onclick=closePanels;
$('#btn-inv').onclick=()=>openPanel('inv','inv'); $('#btn-craft').onclick=()=>openPanel('inv','craft'); $('#btn-obj').onclick=()=>openPanel('obj');
$('#btn-sound').onclick=()=>{ S.settings.sound=!S.settings.sound; audio.setEnabled(S.settings.sound); toast(S.settings.sound?'Sound on':'Sound off'); save(); };
$('#btn-pause').onclick=()=>openPause();
function openPause(){ if(!playing) return; save(); document.exitPointerLock&&document.exitPointerLock(); renderStats(); $('#menu-pause').classList.remove('hidden'); $('#pause-sub').textContent=`Saved · Day ${S.day} · Seed “${S.seedStr||S.seed}”`; }
function renderStats(){ $('#statgrid').innerHTML=[['Blocks mined',S.stats.mined],['Blocks placed',S.stats.placed],['Monsters defeated',S.stats.monsterKills||0],['Creatures hunted',Math.max(0,(S.stats.kills||0)-(S.stats.monsterKills||0))],['Items crafted',S.stats.crafted],['Days survived',S.day]].map(([k,v])=>`<div>${k}<b>${v}</b></div>`).join(''); }
$('#btn-resume').onclick=()=>{ $('#menu-pause').classList.add('hidden'); requestLock(); };
$('#btn-save').onclick=()=>{ save(); toast('World saved'); };
$('#btn-quit').onclick=()=>{ save(); playing=false; $('#menu-pause').classList.add('hidden'); $('#hud').classList.add('hidden'); $('#menu-main').classList.remove('hidden'); refreshMenu(); };
$('#btn-respawn').onclick=()=>{ $('#menu-death').classList.add('hidden'); respawn(); requestLock(); };
function respawn(){
  S.health=20; S.hunger=14; const sp=S.spawn||{x:2.5,y:30,z:2.5};
  world.queueAround(sp.x,sp.z,S.settings.rd); let g=0; while(world.queue.length&&g++<200){ const {cx,cz}=world.queue.shift(); const ch=world.ensureChunk(cx,cz); if(ch.dirty){world.buildMesh(ch);ch.dirty=false;} }
  player.pos.set(sp.x, world.surfaceY(Math.floor(sp.x),Math.floor(sp.z))+1.1, sp.z); player.vel.set(0,0,0);
}

/* menu wiring */
let menuMode='survival';
function refreshMenu(){
  const sv=loadSave();
  $('#btn-continue').disabled=!sv;
  $('#btn-continue').textContent= sv? `Continue · ${sv.mode==='creative'?'Creative':'Survival'} · Day ${sv.day||1}` : 'Continue World';
  if(sv){ $('#inp-rd').value=sv.settings?.rd||5; $('#rd-val').textContent=sv.settings?.rd||5; }
}
document.querySelectorAll('#seg-mode button').forEach(b=>b.onclick=()=>{ menuMode=b.dataset.mode; document.querySelectorAll('#seg-mode button').forEach(x=>x.classList.toggle('on',x===b)); });
$('#btn-new').onclick=()=>{ $('#new-form').classList.toggle('hidden'); if(!$('#new-form').classList.contains('hidden')) $('#inp-seed').focus(); else confirmNew(); };
function confirmNew(){
  const seedStr=$('#inp-seed').value.trim();
  const st=defaultState(seedStr, menuMode);
  st.settings.rd=Number($('#inp-rd').value); st.settings.sens=Number($('#inp-sens').value)/100;
  if(loadSave() && !confirm('Create a new world? Your saved world will be replaced.')) return;
  localStorage.removeItem(SAVE_KEY);
  startGame(st);
}
$('#btn-continue').onclick=()=>{
  const sv=loadSave(); if(!sv) return;
  sv.settings=Object.assign({rd:5,sens:1,sound:true}, sv.settings);
  sv.settings.rd=Number($('#inp-rd').value); sv.settings.sens=Number($('#inp-sens').value)/100;
  // ensure arrays
  if(!Array.isArray(sv.inv)||sv.inv.length!==36) sv.inv=new Array(36).fill(null);
  startGame(sv);
};
$('#inp-rd').addEventListener('input', e=>{ $('#rd-val').textContent=e.target.value; $('#inp-rd2').value=e.target.value; $('#rd-val2').textContent=e.target.value; if(S){S.settings.rd=Number(e.target.value);} });
$('#inp-rd2').addEventListener('input', e=>{ $('#rd-val2').textContent=e.target.value; $('#inp-rd').value=e.target.value; $('#rd-val').textContent=e.target.value; if(S){S.settings.rd=Number(e.target.value); world&&world.queueAround(player.pos.x,player.pos.z,S.settings.rd);} });
$('#inp-sens').addEventListener('input', e=>{ $('#sens-val').textContent=e.target.value; if(S) S.settings.sens=Number(e.target.value)/100; });

/* touch */
const touchMove={x:0,z:0};
if('ontouchstart' in window){
  const joy=$('#joy'), stick=$('#joystick'); let joyId=null;
  joy.addEventListener('touchstart',e=>{ joyId=e.changedTouches[0].identifier; },{passive:true});
  document.addEventListener('touchmove',e=>{
    for(const t of e.changedTouches){
      if(t.identifier===joyId){ const r=joy.getBoundingClientRect(); let dx=t.clientX-(r.left+r.width/2), dy=t.clientY-(r.top+r.height/2); const len=Math.hypot(dx,dy), max=38; if(len>max){dx*=max/len;dy*=max/len;} stick.style.transform=`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; touchMove.x=dx/max; touchMove.z=dy/max; }
      else if(lookId===t.identifier){ player.yaw-=(t.clientX-lookLast.x)*0.005; player.pitch=Math.max(-1.55,Math.min(1.55,player.pitch-(t.clientY-lookLast.y)*0.005)); lookLast={x:t.clientX,y:t.clientY}; }
    }
  },{passive:true});
  document.addEventListener('touchend',e=>{ for(const t of e.changedTouches){ if(t.identifier===joyId){joyId=null; touchMove.x=touchMove.z=0; stick.style.transform='translate(-50%,-50%)';} if(t.identifier===lookId) lookId=null; } });
  let lookId=null, lookLast={x:0,y:0};
  canvas.addEventListener('touchstart',e=>{ const t=e.changedTouches[0]; lookId=t.identifier; lookLast={x:t.clientX,y:t.clientY}; audio.init(); },{passive:true});
  const hold=(id,down,up)=>{ const el=$(id); el.addEventListener('touchstart',e=>{e.preventDefault();down();},{passive:false}); el.addEventListener('touchend',e=>{e.preventDefault();up&&up();},{passive:false}); };
  hold('#t-jump',()=>keys['Space']=true,()=>keys['Space']=false);
  hold('#t-break',()=>{mouseDown.left=true; tryAttackOrMineStart();},()=>{mouseDown.left=false; mining.progress=0;});
  hold('#t-place',()=>doPlace());
}

/* ---------------- actions ---------------- */
function eyePos(){ return player.pos.clone().add(new THREE.Vector3(0,1.62,0)); }
function lookDir(){ return new THREE.Vector3(-Math.sin(player.yaw)*Math.cos(player.pitch), Math.sin(player.pitch), -Math.cos(player.yaw)*Math.cos(player.pitch)).normalize(); }
// Note yaw convention: forward vector computed to match movement below
function forwardVec(){ return new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw)); }
function tryAttackOrMineStart(){
  // attack mobs first if closer than block
  const hit=world.raycast(eyePos(), lookDir(), 6);
  const mob=mobs.tryHit(eyePos(), lookDir(), hit? Math.max(2,hit.dist+0.4):4.5, heldDamage());
  if(mob){ if(mob.hp<=0){} mining.progress=0; return true; }
  return false;
}
function doBreak(x,y,z,id){
  worldSetBlock(x,y,z,0);
  S.stats.mined++; if(id===3||id===14) S.stats.stone=(S.stats.stone||0)+1;
  const b=BLOCKS[id];
  spawnParticles(x+0.5,y+0.5,z+0.5, b.color, 18);
  audio.breakBlock();
  // drops
  let drop=b.drop;
  if(S.mode!=='creative'){
    const need=b.needTool||0; const tier=heldToolTier('pick');
    if(need && tier<need){ drop = (id===15&&tier>=1)?200:0; if(id===3) drop=0; if(id===16||id===17||id===18) drop=0; if(id===14) drop=14; }
    if(id===7 && Math.random()<0.12) drop=101; // apple from leaves
    if(drop) addItem(drop,1);
    gainXP(id>=15&&id<=18?3:1);
  }
  checkQuests();
}
function doPlace(){
  if(panelOpen) return;
  const hit=world.raycast(eyePos(), lookDir(), 6); if(!hit) return;
  const s=heldSlot(); if(!s) return;
  if(!isBlock(s.id)){ if(ITEMS[s.id]&&ITEMS[s.id].food) eatSelected(); return; }
  if(s.id===10) return;
  const x=hit.x+hit.nx, y=hit.y+hit.ny, z=hit.z+hit.nz;
  if(world.getBlock(x,y,z)!==0 && world.getBlock(x,y,z)!==10) return;
  // don't place inside player
  const pb={minX:player.pos.x-0.3,maxX:player.pos.x+0.3,minY:player.pos.y,maxY:player.pos.y+1.8,minZ:player.pos.z-0.3,maxZ:player.pos.z+0.3};
  if(x+1>pb.minX&&x<pb.maxX&&y+1>pb.minY&&y<pb.maxY&&z+1>pb.minZ&&z<pb.maxZ) return;
  worldSetBlock(x,y,z,s.id);
  S.stats.placed++; audio.place(); swingT=0.25;
  spawnParticles(x+0.5,y+0.5,z+0.5, BLOCKS[s.id].color, 5);
  if(S.mode!=='creative'){ s.count--; if(s.count<=0) S.inv[S.selected]=null; renderHotbar(); }
  checkQuests();
}

/* ---------------- physics ---------------- */
function collides(px,py,pz){
  const r=0.3, h=1.8;
  const x0=Math.floor(px-r), x1=Math.floor(px+r), y0=Math.floor(py), y1=Math.floor(py+h-0.001), z0=Math.floor(pz-r), z1=Math.floor(pz+r);
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++) if(world.isSolid(x,y,z)) return true;
  return false;
}
function moveAxis(axis, amount){
  if(amount===0) return;
  const p=player.pos; const steps=Math.max(1, Math.ceil(Math.abs(amount)/0.4));
  const step=amount/steps;
  for(let i=0;i<steps;i++){
    const np=p.clone(); np[axis]+=step;
    if(!collides(np.x,np.y,np.z)){ p.copy(np); }
    else { if(axis==='y'){ if(amount<0) player.onGround=true; player.vel.y=0; } break; }
  }
}
function updatePlayer(dt){
  const fwd=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
  const right=new THREE.Vector3(-fwd.z,0,fwd.x);
  let ix=0,iz=0;
  if(keys['KeyW']) iz+=1; if(keys['KeyS']) iz-=1; if(keys['KeyD']) ix+=1; if(keys['KeyA']) ix-=1;
  if(touchMove.x||touchMove.z){ ix+=touchMove.x; iz-=touchMove.z; }
  const move=new THREE.Vector3().addScaledVector(fwd,iz).addScaledVector(right,ix);
  if(move.lengthSq()>1) move.normalize();
  const feetBlock=world.getBlock(Math.floor(player.pos.x),Math.floor(player.pos.y),Math.floor(player.pos.z));
  const eyeBlock=world.getBlock(Math.floor(player.pos.x),Math.floor(player.pos.y+1.5),Math.floor(player.pos.z));
  player.inWater = feetBlock===10||eyeBlock===10; player.headWater=eyeBlock===10;
  const sprint=keys['ShiftLeft']||keys['ShiftRight'];
  const baseSpeed= player.fly?11:(player.inWater?3.4:(sprint&&S.hunger>6?6.4:4.4));
  const accel=player.onGround||player.fly?1:0.55;
  player.vel.x += (move.x*baseSpeed - player.vel.x)*Math.min(1, dt* (player.onGround?14:4));
  player.vel.z += (move.z*baseSpeed - player.vel.z)*Math.min(1, dt* (player.onGround?14:4));
  if(player.fly){
    player.vel.y=0;
    if(keys['Space']) player.vel.y=8; if(keys['ShiftLeft']) player.vel.y=-8;
  } else if(player.inWater){
    player.vel.y -= 7*dt; player.vel.y*=0.92;
    if(keys['Space']) player.vel.y=Math.min(player.vel.y+38*dt, 3.2);
    if(player.vel.y<-3) player.vel.y=-3;
  } else {
    player.vel.y -= 26*dt; if(player.vel.y<-42) player.vel.y=-42;
    if(keys['Space'] && player.onGround){ player.vel.y=8.6; player.onGround=false; }
  }
  const prevVy=player.vel.y; const wasGround=player.onGround; player.onGround=false;
  moveAxis('x', player.vel.x*dt); moveAxis('z', player.vel.z*dt); moveAxis('y', player.vel.y*dt);
  if(player.onGround && !wasGround && prevVy<-16 && S.mode==='survival'){
    const dmg=Math.floor((-prevVy-16)/3); if(dmg>0) damagePlayer(dmg,true);
  }
  if(keys['Space'] && player.inWater && player.onGround) player.vel.y=5;
  if(player.pos.y<-12){ player.pos.y=world.surfaceY(Math.floor(player.pos.x),Math.floor(player.pos.z))+2; player.vel.set(0,0,0); if(S.mode==='survival') damagePlayer(4,true); }
}
function damagePlayer(n, ignoreArmor=false){
  if(S.mode==='creative'||!playing) return;
  S.health-=n; audio.hurt();
  const v=$('#dmgvin'); v.style.opacity=1; setTimeout(()=>v.style.opacity=0,180);
  // knockback upward a touch
  player.vel.y=Math.max(player.vel.y,2.5);
  renderVitals();
  if(S.health<=0){ S.stats.deaths++; save(); $('#death-sub').textContent=`You survived to Day ${S.day} · ${S.stats.mined} blocks mined, ${S.stats.kills||0} creatures defeated.`; document.exitPointerLock&&document.exitPointerLock(); $('#menu-death').classList.remove('hidden'); }
}

/* ---------------- mining update ---------------- */
function updateMining(dt){
  if(!mouseDown.left||panelOpen){ return; }
  // re-check mob occasionally handled on click; mining blocks:
  const hit=world.raycast(eyePos(), lookDir(), 6);
  if(!hit){ mining.progress=0; mining.target=null; highlight.visible=false; return; }
  const key=hit.x+','+hit.y+','+hit.z;
  if(mining.target!==key){ mining.target=key; mining.progress=0; }
  const b=BLOCKS[hit.id];
  let hard=b.hard;
  if(!isFinite(hard)){ mining.progress=0; return; }
  let mult=1;
  const s=heldSlot(); const d=s?defOf(s.id):null;
  if(d&&d.tool&&d.tool.speed) mult=d.tool.speed;
  if(S.mode==='creative') mult=100;
  if(b.needTool && heldToolTier('pick')<b.needTool) mult*=0.35;
  mining.progress += dt*mult/hard;
  swingT=Math.max(swingT,0.18);
  const bar=$('#breakbar'); bar.classList.remove('hidden'); bar.firstElementChild.style.width=Math.min(100,mining.progress*100)+'%';
  if(mining.progress>=1){ doBreak(hit.x,hit.y,hit.z,hit.id); mining.progress=0; mining.target=null; bar.classList.add('hidden'); }
}

/* ---------------- ambient / weather / sky ---------------- */
let birdT=4, hungerT=0, regenT=0, saveT=0, streamT=0, minimapT=0, lastBiome='';
function updateEnvironment(dt){
  S.time += dt/600; // 10-min full cycle
  if(S.time>=1){ S.time-=1; S.day++; if(!isNightNow()) S.quests.nightDone = S.quests.nightDone; }
  // track survived night: if time crosses sunrise after being night
  const phi=S.time*Math.PI*2; const elev=Math.sin(phi);
  if(wasNight && elev>0.05){ S.quests.nightDone=true; checkQuests(); }
  wasNight = elev<-0.08;
  const dayF=THREE.MathUtils.clamp((elev+0.25)/0.9,0,1);
  const skyDay=new THREE.Color(0x87ceeb), skyNight=new THREE.Color(0x0a1128), skyDawn=new THREE.Color(0xf2a65e);
  const sky=skyNight.clone().lerp(skyDay, dayF);
  if(elev>-0.15&&elev<0.22) sky.lerp(skyDawn, 1-Math.abs(elev-0.03)/0.2*0.55);
  if(player.headWater){ scene.background.set(0x14365e); scene.fog.color.set(0x14365e); scene.fog.near=1; scene.fog.far=16; }
  else if(S.weather==='rain'){ sky.lerp(new THREE.Color(0x6b7f92),0.55); scene.background.copy(sky); scene.fog.color.copy(sky); scene.fog.near=28; scene.fog.far=95; }
  else { scene.background.copy(sky); scene.fog.color.copy(sky); scene.fog.near=42; scene.fog.far= 60+S.settings.rd*22; }
  sun.intensity=0.25+dayF*1.35; hemi.intensity=0.25+dayF*0.75;
  sun.color.setHSL(0.11, 0.55, 0.72+dayF*0.2);
  const sunDir=new THREE.Vector3(Math.cos(phi)*0.7, elev, 0.35).normalize();
  sun.position.copy(player.pos).addScaledVector(sunDir,80); sun.target.position.copy(player.pos);
  sunBall.position.copy(player.pos).addScaledVector(sunDir,260); sunBall.material.opacity=1;
  moonBall.position.copy(player.pos).addScaledVector(sunDir,-260);
  window._stars.material.opacity=THREE.MathUtils.clamp(-elev*1.4,0,0.95);
  window._stars.position.set(player.pos.x,0,player.pos.z);
  clouds.children.forEach((c,i)=>{ c.position.x+=dt*(1.1+(i%3)*0.3); if(c.position.x-player.pos.x>160)c.position.x-=320; if(c.position.z-player.pos.z>160)c.position.z-=320; if(c.position.z-player.pos.z<-160)c.position.z+=320; });
  clouds.position.x=player.pos.x*0; // clouds positioned absolute, drift handled above relative wrap
  const hours=(6+S.time*24)%24; const hh=Math.floor(hours), mm=Math.floor((hours-hh)*60);
  // weather
  S.weatherT-=dt;
  if(S.weatherT<=0){ S.weatherT=90+Math.random()*120; S.weather= Math.random()<0.26?'rain':'clear'; if(S.weather==='rain') audio.splash(); }
  weatherPts.visible=S.weather==='rain';
  if(weatherPts.visible){
    const isSnow=world.biomeAt(Math.floor(player.pos.x),Math.floor(player.pos.z))==='Snowy Tundra';
    weatherPts.material.color.set(isSnow?0xffffff:0x9fc4ee); weatherPts.material.size=isSnow?0.18:0.13;
    weatherPts.position.set(player.pos.x, player.pos.y, player.pos.z);
    const arr=wGeo.attributes.position.array; const fall=isSnow?4.5:17;
    for(let i=0;i<WEATHER_N;i++){ arr[i*3+1]-=fall*dt*(0.7+((i%7)/10)); arr[i*3]+=dt*(isSnow?Math.sin(perfNow*0.001+i)*0.6:1.2); if(arr[i*3+1]<0) arr[i*3+1]=26; }
    wGeo.attributes.position.needsUpdate=true;
  }
  $('#clocktext').textContent=`Day ${S.day} · ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}${S.weather==='rain'?' · Rain':''}`;
  $('#weatherdot').style.background= elev>0.05?'#ffd23e':(elev<-0.08?'#8fb4ff':'#f2a65e');
  const biome=world.biomeAt(Math.floor(player.pos.x),Math.floor(player.pos.z));
  if(biome!==lastBiome){ lastBiome=biome; $('#biometext').textContent=biome; if(playing&&streamT>1) toast(biome); }
  $('#coordtext').textContent=`${Math.floor(player.pos.x)}, ${Math.floor(player.pos.y)}, ${Math.floor(player.pos.z)} · FPS ${fps}`;
  birdT-=dt; if(birdT<=0){ birdT=3+Math.random()*6; if(elev>0.1&&S.weather==='clear') audio.bird(); }
  // hunger / regen
  if(S.mode==='survival'){
    hungerT+=dt; const sprinting=(keys['KeyW']&&(keys['ShiftLeft'])) ;
    if(hungerT> (sprinting?10:22)){ hungerT=0; S.hunger=Math.max(0,S.hunger-1); renderVitals(); }
    regenT+=dt;
    if(regenT>3.5){ regenT=0; if(S.hunger>=16&&S.health<20){ S.health=Math.min(20,S.health+1); renderVitals(); } else if(S.hunger<=0&&S.health>1){ damagePlayer(1); } }
    if(player.headWater){ S.air-=dt; if(S.air<=-1){ S.air=0; damagePlayer(1); } }
    else S.air=Math.min(10,S.air+dt*4);
  }
}
let wasNight=false;
function isNightNow(){ return Math.sin(S.time*Math.PI*2)<-0.08; }

/* minimap */
function drawMinimap(){
  const cv=$('#minimap'); if(!cv) return; const g=cv.getContext('2d'); const R=66, size=cv.width, scale=size/(R*2);
  g.fillStyle='#22331f'; g.fillRect(0,0,size,size);
  const px=Math.floor(player.pos.x), pz=Math.floor(player.pos.z);
  for(let dz=-R;dz<R;dz+=2) for(let dx=-R;dx<R;dx+=2){
    const x=px+dx,z=pz+dz; const idTop=world.getBlock(x, world.surfaceY(x,z), z);
    let col='#5da83a';
    if(idTop===10||world.getBlock(x,SEA,z)===10 && world.surfaceY(x,z)<SEA) col='#2f6fd0';
    else if(idTop===4||idTop===11) col='#dcd29b'; else if(idTop===5||idTop===23) col='#eef4f4'; else if(idTop===3||idTop===14) col='#7d7d7d'; else if(idTop===7) col='#2d6e1c'; else if(idTop===6) col='#6b4a2b';
    // cheap water check
    if(world.getBlock(x,SEA,z)===10 && world.surfaceY(x,z)<SEA) col='#2f6fd0';
    g.fillStyle=col; g.fillRect((dx+R)*scale,(dz+R)*scale,scale*2+1,scale*2+1);
  }
  // mobs dots
  if(mobs) for(const m of mobs.mobs){ const dx=m.mesh.position.x-px, dz=m.mesh.position.z-pz; if(Math.abs(dx)<R&&Math.abs(dz)<R){ g.fillStyle=m.hostile?'#ff4b3e':'#ffd23e'; g.fillRect((dx+R)*scale-2,(dz+R)*scale-2,4,4); } }
  g.fillStyle='#fff'; g.beginPath(); g.arc(size/2,size/2,4,0,7); g.fill(); g.strokeStyle='#000'; g.stroke();
  // facing tick
  g.strokeStyle='#fff'; g.beginPath(); g.moveTo(size/2,size/2); g.lineTo(size/2 - Math.sin(player.yaw)*11, size/2 - Math.cos(player.yaw)*11); g.stroke();
}

/* mobs callbacks */
function onMobKill(m){
  S.stats.kills=(S.stats.kills||0)+1; if(m.hostile) S.stats.monsterKills=(S.stats.monsterKills||0)+1;
  gainXP(m.hostile?6:2);
  const drops={pig:103,cow:103,sheep:null,chicken:101,zombie:200,skeleton:200};
  const d=drops[m.type];
  // drop as particles + direct add (simple, satisfying pickup)
  if(d && Math.random()<0.85){ addItem(d,1); toast('Picked up '+defOf(d).name); }
  spawnParticles(m.mesh.position.x,m.mesh.position.y+0.7,m.mesh.position.z, m.hostile?0x5da84f:0xe89bb0, 14);
  checkQuests();
}

/* ---------------- main loop ---------------- */
const clock=new THREE.Clock();
let fps=60, perfNow=0, fpsAcc=0, fpsN=0, fpsT=0;
function loop(){
  requestAnimationFrame(loop);
  const dt=Math.min(clock.getDelta(),0.05); perfNow=performance.now();
  fpsAcc+=dt; fpsN++; fpsT+=dt; if(fpsT>0.5){ fps=Math.round(fpsN/fpsAcc); fpsAcc=0;fpsN=0;fpsT=0; }
  if(playing && world){
    if(!panelOpen && !anyOverlayOpen()) updatePlayer(dt);
    // camera
    camera.position.copy(player.pos).add(new THREE.Vector3(0,1.62,0));
    camera.rotation.order='YXZ'; camera.rotation.y=player.yaw; camera.rotation.x=player.pitch;
    // mining / placing holds
    updateMining(dt);
    if(mouseDown.right){ placeTimer-=dt; if(placeTimer<=0){ doPlace(); placeTimer=0.24; } }
    // highlight
    const hit=world.raycast(eyePos(), lookDir(), 6);
    if(hit){ highlight.visible=true; highlight.position.set(hit.x+0.5,hit.y+0.5,hit.z+0.5); } else highlight.visible=false;
    // swing
    if(swingT>0){ swingT-=dt; handGroup.rotation.x=0.15-Math.sin((0.35-Math.max(0,swingT))/0.35*Math.PI)*0.75; handGroup.position.y=-0.52+Math.sin((0.35-Math.max(0,swingT))/0.35*Math.PI)*0.08; }
    else { handGroup.rotation.x=0.15+Math.sin(perfNow*0.0022)*0.025; handGroup.position.y=-0.52+Math.sin(perfNow*0.0018)*0.012; }
    // particles
    for(let i=particles.length-1;i>=0;i--){ const p=particles[i]; p.life-=dt; p.v.y-=16*dt; p.m.position.addScaledVector(p.v,dt); p.m.rotation.x+=dt*4; if(p.life<=0){ scene.remove(p.m); p.m.material.dispose(); particles.splice(i,1); } }
    // environment + mobs
    updateEnvironment(dt);
    if(mobs) mobs.update(dt, eyePos(), isNightNow(), (n)=>{ damagePlayer(n); }, onMobKill);
    // streaming
    streamT+=dt;
    if(streamT>0.35){ streamT=0; world.queueAround(player.pos.x,player.pos.z,S.settings.rd); world.unloadFar(player.pos.x,player.pos.z,S.settings.rd); }
    world.processQueue(3);
    minimapT+=dt; if(minimapT>0.6){ minimapT=0; drawMinimap(); }
    saveT+=dt; if(saveT>6){ saveT=0; save(); }
  }
  renderer.render(scene,camera);
}
addEventListener('resize', ()=>{ camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth,innerHeight); });
refreshMenu();
loop();
