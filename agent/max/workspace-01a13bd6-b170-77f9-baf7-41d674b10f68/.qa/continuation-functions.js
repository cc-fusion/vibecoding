// Checkpoints preserve entity identity: an order, a carrier, and a relic refer to
// the same objects after loading, rather than independent JSON copies.
const CHECKPOINT_KEY='crownTimber_checkpoint_v2';
let checkpointText=null,checkpointPersistent=true,lastSaveTime=null,nextAutosave=45,intelOpen=false,backupText='';
try {checkpointText=localStorage.getItem(CHECKPOINT_KEY)} catch(e) {checkpointPersistent=false}
function checkpointMeta(){try{const s=JSON.parse(checkpointText);return s?.format==='crown-timber-skirmish'&&s.version===2&&Number.isFinite(s.meta?.time)&&['verdant','river','highlands'].includes(s.mapType)&&DIFF[s.diff]?s.meta:null}catch(e){return null}}
function packSkirmish(){
 const registry=new Map(),queue=[];
 function encode(value){
  if(value===null||typeof value!=='object')return value;
  if(value.entity&&Number.isInteger(value.id)){if(!registry.has(value.id)){registry.set(value.id,value);queue.push(value)}return {$entity:value.id}}
  if(Array.isArray(value)||ArrayBuffer.isView(value))return Array.from(value,encode);
  return fields(value);
 }
 function fields(value){const result={};for(const [k,v] of Object.entries(value))if(!['plannedPath'].includes(k))result[k]=encode(v);return result}
 const data={format:'crown-timber-skirmish',version:2,meta:{time:G.time,age:G.players[0].age,date:new Date().toISOString()},mapType,diff:settings.diff,seed,nextId,cam:{...cam},groups,selection:selection.map(e=>e.id),tutorialOn,game:fields(G),missiles:encode(missiles),entities:[]};
 for(let i=0;i<queue.length;i++)data.entities.push(fields(queue[i]));
 return JSON.stringify(data);
}
function unpackSkirmish(text){
 if(typeof text!=='string'||text.length>4_000_000)throw Error('This save is too large or unreadable.');
 const data=JSON.parse(text);
 if(data.format!=='crown-timber-skirmish'||data.version!==2||!Array.isArray(data.entities)||data.entities.length>12000)throw Error('Choose a Crown & Timber skirmish save.');
 if(!['verdant','river','highlands'].includes(data.mapType)||!DIFF[data.diff])throw Error('Unknown map or difficulty.');
 const refs=new Map();
 for(const e of data.entities){
  if(!Number.isInteger(e.id)||e.id<1||refs.has(e.id)||!['unit','building','resource','relic'].includes(e.entity))throw Error('Invalid entity table.');
  if(!Number.isFinite(e.x)||!Number.isFinite(e.y))throw Error('Invalid entity position.');
  if(e.entity==='unit'&&(!Object.hasOwn(U,e.type)||![0,1].includes(e.owner)||!Array.isArray(e.path)||!Number.isFinite(e.hp)))throw Error('Invalid unit.');
  if(e.entity==='building'&&(!Object.hasOwn(B,e.type)||![0,1].includes(e.owner)||!Array.isArray(e.queue)||!Array.isArray(e.relics)||!Number.isFinite(e.progress)||!Number.isFinite(e.hp)))throw Error('Invalid building.');
  if(e.entity==='resource'&&(!['wood','food','gold','stone'].includes(e.type)||!Number.isFinite(e.amount)))throw Error('Invalid resource.');
  if(['building','resource'].includes(e.entity)&&(!Number.isInteger(e.tx)||!Number.isInteger(e.ty)||e.tx<0||e.ty<0||e.tx>=W||e.ty>=H))throw Error('Invalid site.');
  refs.set(e.id,{});
 }
 function decode(v,depth=0){
  if(depth>30)throw Error('This save is too deeply nested.');
  if(v===null||typeof v!=='object')return v;
  if(Object.hasOwn(v,'$entity')){if(!refs.has(v.$entity))throw Error('A saved entity is missing.');return refs.get(v.$entity)}
  if(Array.isArray(v))return v.map(x=>decode(x,depth+1));
  const o={};for(const[k,x]of Object.entries(v)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe save field.');o[k]=decode(x,depth+1)}return o;
 }
 for(const e of data.entities)Object.assign(refs.get(e.id),decode(e));
 const game=decode(data.game);
 if(!game||game.ended||!Number.isFinite(game.time)||game.time<0||!Array.isArray(game.players)||game.players.length!==2||!game.ai||!game.stats||!game.tutorial||!game.prices)throw Error('No active skirmish in this file.');
 for(const k of ['units','buildings','resources','relics'])if(!Array.isArray(game[k])||game[k].some(e=>!e?.entity))throw Error('Incomplete world data.');
 if(game.relics.length!==3||!Array.isArray(game.relicTimer)||game.relicTimer.length!==2)throw Error('Invalid relic state.');
 if(!Array.isArray(game.terrain)||game.terrain.length!==W*H||game.terrain.some(t=>![0,1,2].includes(t))||!Array.isArray(game.explored)||game.explored.length!==W*H)throw Error('Incomplete map.');
 for(const p of game.players){if(!Number.isInteger(p.age)||p.age<0||p.age>3||!p.res||!p.tech)throw Error('Invalid kingdom.');for(const k of ['food','wood','gold','stone'])if(!Number.isFinite(p.res[k])||p.res[k]<0)throw Error('Invalid treasury.');}
 for(const u of game.units){if(u.entity!=='unit'||u.path.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y))||!Number.isFinite(u.max)||!Number.isFinite(u.cd))throw Error('Invalid unit orders.');if(u.order&&(!['move','attackmove','attack','gather','build','repair','relic'].includes(u.order.type)||(['attack','gather','build','repair','relic'].includes(u.order.type)&&!u.order.target)))throw Error('Incomplete order.');}
 for(const b of game.buildings){if(b.entity!=='building'||b.tx+B[b.type].w>W||b.ty+B[b.type].h>H)throw Error('Invalid building footprint.');for(const q of b.queue)if(!['unit','tech'].includes(q.kind)||!Number.isFinite(q.time)||!Number.isFinite(q.total)||(q.kind==='unit'&&!Object.hasOwn(U,q.type))||(q.kind==='tech'&&q.type!=='age'&&!Object.hasOwn(TECH,q.type)))throw Error('Invalid production queue.');}
 game.explored=Uint8Array.from(game.explored,x=>x?1:0);game.visible=new Uint8Array(W*H);game.block=Array(W*H).fill(0);
 for(const r of game.resources)if(r.amount>0)game.block[r.ty*W+r.tx]=r.id;
 for(const b of game.buildings)if(!b.dead)for(let y=b.ty;y<b.ty+B[b.type].h;y++)for(let x=b.tx;x<b.tx+B[b.type].w;x++)game.block[y*W+x]=b.id;
 game.formation=Object.hasOwn(FORMATIONS,game.formation)?game.formation:'block';game.ledger=Array.isArray(game.ledger)?game.ledger.filter(v=>Number.isFinite(v.t)&&['wood','food','gold','stone'].includes(v.type)&&Number.isFinite(v.amount)).slice(-1500):[];game.log=Array.isArray(game.log)?game.log.filter(v=>Number.isFinite(v.t)&&typeof v.text==='string').slice(-24):[];game.attackPings=Array.isArray(game.attackPings)?game.attackPings.filter(p=>Number.isFinite(p.t)&&Number.isFinite(p.x)&&Number.isFinite(p.y)).slice(-8):[];
 game.perks=Object.assign({stores:0,heart:0,craft:0},game.perks);for(const k of Object.keys(game.perks))game.perks[k]=clamp(Number(game.perks[k])||0,0,4);
 const shots=decode(data.missiles||[]);if(!Array.isArray(shots)||shots.some(m=>!m.source||!m.target||![m.x,m.y,m.sx,m.sy,m.tx,m.ty,m.life,m.total,m.damage].every(Number.isFinite)||m.total<=0))throw Error('Invalid projectile state.');
 if(!data.cam||![data.cam.x,data.cam.y,data.cam.z].every(Number.isFinite)||!Number.isInteger(data.seed)||!Number.isInteger(data.nextId))throw Error('Invalid simulation state.');
 return {data,game,refs,shots};
}
function saveSkirmish(manual=true){
 if(!G||G.ended||state==='title')return false;
 try{const text=packSkirmish();checkpointText=text;lastSaveTime=G.time;nextAutosave=G.time+45;
  try{localStorage.setItem(CHECKPOINT_KEY,text);checkpointPersistent=true}catch(e){checkpointPersistent=false}
  if(manual){notify(checkpointPersistent?'Skirmish saved. Your kingdom will be here when you return.':'Saved for this session. Browser storage is blocked; export a backup to keep it.');sfx('complete')}
  refreshIntel();return true;
 }catch(e){if(manual)notify('Could not save this skirmish. Please export a backup.',true);return false}
}
function restoreSkirmish(text=checkpointText){
 try{
  const {data,game,refs,shots}=unpackSkirmish(text);
  for(const o of activeVoices){try{o.stop()}catch(e){}}activeVoices.clear();
  G=game;mapType=data.mapType;settings.diff=data.diff;seed=data.seed>>>0;nextId=Math.max(data.nextId,...[...refs.keys()].map(n=>n+1));
  cam={x:data.cam.x,y:data.cam.y,z:clamp(data.cam.z,.65,1.8)};groups=data.groups&&typeof data.groups==='object'?data.groups:{};
  for(const k of Object.keys(groups))if(!/^[1-5]$/.test(k)||!Array.isArray(groups[k]))delete groups[k];
  selection=(Array.isArray(data.selection)?data.selection:[]).map(id=>refs.get(id)).filter(e=>e&&!e.dead);
  tutorialOn=data.tutorialOn!==false;missiles=shots;particles=[];floats=[];keys={};drag=null;touches.clear();pinch=null;miniDrag=false;placing=null;commandMode=null;actionPage='main';shake=0;musicTick=0;uiTimer=0;
  checkpointText=text;lastSaveTime=G.time;nextAutosave=G.time+45;$('#toast').replaceChildren();state='paused';overlay='pause';lastActionKey='';centerCamera();updateFog();refreshUI(true);drawMinimap();showPause();persist();
  notify('Skirmish restored at '+timefmt(G.time)+'. Resume when you are ready.');return true;
 }catch(e){notify('Could not load: '+(e.message||'invalid save file.'),true);return false}
}
function clearCheckpoint(){checkpointText=null;lastSaveTime=null;try{localStorage.removeItem(CHECKPOINT_KEY)}catch(e){}}
function showBackup(){
 if(!G||G.ended||state==='title')return;
 saveSkirmish(false);backupText=checkpointText;returnOverlay=overlay||'game';state='paused';keys={};drag=null;overlay='backup';
 showPanel(`<div class="eyebrow">A KINGDOM WORTH KEEPING</div><h2>Carry your story with you.</h2><p>Download a portable skirmish save, or copy the data below. Import it from the title screen or pause menu. The file viewer may block downloads; copying the text is the fallback.</p><textarea id="backupData" readonly aria-label="Skirmish backup data" spellcheck="false"></textarea><div class="buttons"><button class="primary" data-do="downloadBackup">Download .json ↓</button><button data-do="copyBackup">Copy save data</button><button data-do="backSub">Return</button></div>`);
 $('#backupData').value=backupText;
}
function downloadBackup(){const blob=new Blob([backupText],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='crown-and-timber-'+Math.floor(G.time)+'s.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function showImport(){returnOverlay=overlay||'game';if(state==='playing'){state='paused';keys={};drag=null}overlay='import';showPanel(`<div class="eyebrow">RETURN TO YOUR FRONTIER</div><h2>Restore a skirmish.</h2><p>Choose an exported JSON file, or paste its contents. A valid save replaces the current skirmish. Your dynasty upgrades and records are kept.</p><input id="importFile" type="file" accept=".json,application/json"><textarea id="importData" placeholder="Paste skirmish save data here…" aria-label="Import skirmish save data" spellcheck="false"></textarea><div class="buttons"><button class="primary" data-do="importData">Restore pasted save →</button><button data-do="backSub">Cancel</button></div>`);$('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>4_000_000){notify('Please choose a save smaller than 4 MB.',true);return}try{const text=await f.text();if(restoreSkirmish(text))saveSkirmish(false)}catch(e){notify('This file could not be read.',true)}}}
const FORMATIONS={block:{name:'Battle block',icon:'▦',desc:'Compact, balanced ranks. Melee troops lead; ranged troops and healers stay behind.'},line:{name:'Battle line',icon:'▬',desc:'A broad front, up to twelve units wide. Bring more weapons to bear at once.'},wedge:{name:'Spearhead',icon:'⋀',desc:'A pointed advance led by your strongest melee troops, with support behind.'},loose:{name:'Loose ranks',icon:'⠿',desc:'Wide spacing helps limit losses to mangonel splash damage.'}};
function formationPositions(units,x,y,resolve=true){
 if(!units.length)return[];
 let cx=units.reduce((n,u)=>n+u.x,0)/units.length,cy=units.reduce((n,u)=>n+u.y,0)/units.length,dx=x-cx,dy=y-cy,length=Math.hypot(dx,dy);if(length<1){dx=0;dy=-1;length=1}dx/=length;dy/=length;
 const rank={cavalry:0,camel:0,infantry:0,spear:0,worker:1,archer:2,skirm:2,siege:3,monk:4};
 const sorted=[...units].sort((a,b)=>rank[U[a.type].kind]-rank[U[b.type].kind]||((a.x-cx)*dy-(a.y-cy)*dx)-((b.x-cx)*dy-(b.y-cy)*dx));
 const type=G.formation||'block',spacing=type==='loose'?46:26,columns=type==='line'?Math.min(12,units.length):Math.ceil(Math.sqrt(units.length)),slots=[];
 if(type==='wedge'){let row=0;while(slots.length<units.length){const n=Math.min(2*row+1,units.length-slots.length);for(let j=0;j<n;j++)slots.push({side:(j-(n-1)/2)*spacing,back:row*spacing});row++}}
 else{for(let i=0;i<units.length;i++){const row=Math.floor(i/columns),count=Math.min(columns,units.length-row*columns);slots.push({side:(i%columns-(count-1)/2)*spacing,back:row*spacing})}}
 const middle=slots.reduce((n,s)=>n+s.back,0)/slots.length;
 return sorted.map((u,i)=>{const s=slots[i],back=s.back-middle;let p={x:clamp(x+dy*s.side-dx*back,16,WW-16),y:clamp(y-dx*s.side-dy*back,16,WH-16)};if(resolve)p=nearFree(p.x,p.y);return {unit:u,x:p.x,y:p.y}});
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function nearbyThreats(){const bases=ownBuildings(0);return G.units.filter(u=>u.owner===1&&!u.dead&&G.visible[Math.floor(u.y/T)*W+Math.floor(u.x/T)]&&bases.some(b=>dist(u,b)<520))}
function refreshIntel(){
 if(!G)return;$('#intel').hidden=!intelOpen;$('#intelToggle').setAttribute('aria-expanded',String(intelOpen));$('#saveStatus').textContent=lastSaveTime===null?'No checkpoint':(checkpointPersistent?'Saved ':'Session save ')+timefmt(lastSaveTime);
 if(!intelOpen)return;
 const all=G.units.filter(u=>u.owner===0&&!u.dead),workers=all.filter(u=>u.type==='villager'),idle=workers.filter(u=>!u.order),army=all.filter(u=>!['villager','monk'].includes(u.type)),threats=nearbyThreats();
 const treasury={};for(const k of ['food','wood','gold','stone']){const count=workers.filter(u=>u.order?.type==='gather'&&(u.order.target.type===k||(k==='food'&&u.order.target.type==='farm'))).length;const total=(G.ledger||[]).filter(e=>e.type===k&&e.t>=G.time-60).reduce((n,e)=>n+e.amount,0);treasury[k]={count,rate:Math.round(total*60/Math.max(15,Math.min(60,G.time)))}}
 const hp=army.reduce((n,u)=>n+u.hp,0),max=army.reduce((n,u)=>n+u.max,0),minutes=Math.max(0,45-(G.time-(lastSaveTime||0)));
 $('#intelBody').innerHTML=`<div class="intel-metrics"><button data-do="idle"><strong>${idle.length}</strong><small>IDLE WORKERS</small></button><button data-do="army"><strong>${army.length}</strong><small>ARMY UNITS</small></button><button data-do="threat" class="${threats.length?'danger':''}"><strong>${threats.length}</strong><small>NEARBY FOES</small></button></div><div class="intel-health"><span>Army vitality</span><b>${max?Math.round(hp/max*100):0}%</b></div><div class="bar"><span style="width:${max?hp/max*100:0}%"></span></div><table><tr><th>WORKFORCE</th><th>PEOPLE</th><th>/ MIN</th></tr>${Object.entries(treasury).map(([k,v])=>`<tr><td>${k[0].toUpperCase()+k.slice(1)}</td><td>${v.count}</td><td>+${v.rate}</td></tr>`).join('')}</table><p class="intel-note">Delivered resources over the last minute. Relic income is additional. ${workers.length} total workers.</p><div class="threat-report ${threats.length?'danger':''}">${threats.length?'⚔ '+threats.length+' spotted enemies are near your settlements.':'◇ No enemies spotted near your settlements.'}<button data-do="threat">View last threat ↗</button></div><div class="caps" style="font-size:8px;margin:14px 0 8px">MESSAGES FROM THE MARCH</div><div class="intel-log">${(G.log||[]).slice(-5).reverse().map(e=>`<div class="${e.bad?'danger':''}"><time>${timefmt(e.t)}</time>${esc(e.text)}</div>`).join('')||'<div>A new chapter begins.</div>'}</div><div class="intel-save"><span>${settings.autosave!==false?'Auto-checkpoint every 45s':'Autosave is off'}</span><button data-do="save">Save now</button></div>`;
}
function jumpToThreat(){const list=nearbyThreats(),home=ownBuildings(0,'town')[0],t=home?nearest(home,list):list[0],ping=(G.attackPings||[]).filter(p=>G.time-p.t<90).at(-1),point=t||ping;if(point){cam.x=point.x;cam.y=point.y;centerCamera();if(t)select([t])}else notify('No nearby threats have been spotted.');if(view.w<760){intelOpen=false;refreshIntel()}}
