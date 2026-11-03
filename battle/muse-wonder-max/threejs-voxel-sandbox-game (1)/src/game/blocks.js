import * as THREE from 'three';

// Tile indices in atlas (8 columns x 8 rows, tile 32px => 256 canvas)
export const TILES = {
  grass_top:0, grass_side:1, dirt:2, stone:3, sand:4, snow_top:5, snow_side:6,
  log_side:7, log_top:8, leaves:9, planks:10, glass:11, water:12, sandstone:13,
  cobble:14, coal:15, iron:16, gold:17, diamond:18, bedrock:19, table_top:20,
  table_side:21, furnace:22, brick:23, stonebrick:24, snow:25, cactus_side:26,
  cactus_top:27, pumpkin_side:28, pumpkin_top:29, torch:30, flower:31, stone_side:32
};

// ids: 0 air
export const BLOCKS = {
  1:{name:'Grass Block', tiles:{top:'grass_top',side:'grass_side',bottom:'dirt'}, hard:0.55, drop:2, color:'#6abe30'},
  2:{name:'Dirt', tiles:{all:'dirt'}, hard:0.45, drop:2, color:'#8a5a32'},
  3:{name:'Stone', tiles:{all:'stone'}, hard:1.4, drop:14, needTool:1, color:'#7d7d7d'},
  4:{name:'Sand', tiles:{all:'sand'}, hard:0.45, drop:4, color:'#dcd29b'},
  5:{name:'Snowy Grass', tiles:{top:'snow_top',side:'snow_side',bottom:'dirt'}, hard:0.55, drop:2, color:'#eef4f4'},
  6:{name:'Oak Log', tiles:{top:'log_top',side:'log_side',bottom:'log_top'}, hard:0.9, drop:6, color:'#6b4a2b'},
  7:{name:'Leaves', tiles:{all:'leaves'}, hard:0.18, drop:7, transparent:true, color:'#3f9e2f'},
  8:{name:'Oak Planks', tiles:{all:'planks'}, hard:0.9, drop:8, color:'#b08a4f'},
  9:{name:'Glass', tiles:{all:'glass'}, hard:0.3, drop:9, transparent:true, color:'#cfeef2'},
  10:{name:'Water', tiles:{all:'water'}, hard:Infinity, drop:0, liquid:true, transparent:true, solid:false, color:'#2f6fd0'},
  11:{name:'Sandstone', tiles:{all:'sandstone'}, hard:1.1, drop:11, color:'#d8cb9e'},
  12:{name:'Rose', tiles:{all:'flower'}, hard:0.05, drop:12, transparent:true, color:'#e5484d'},
  13:{name:'Bedrock', tiles:{all:'bedrock'}, hard:Infinity, drop:0, color:'#3a3a3a'},
  14:{name:'Cobblestone', tiles:{all:'cobble'}, hard:1.4, drop:14, needTool:1, color:'#6f6f6f'},
  15:{name:'Coal Ore', tiles:{all:'coal'}, hard:1.7, drop:200, needTool:1, color:'#5a5a5a'},
  16:{name:'Iron Ore', tiles:{all:'iron'}, hard:2.2, drop:201, needTool:2, color:'#b08a72'},
  17:{name:'Gold Ore', tiles:{all:'gold'}, hard:2.6, drop:202, needTool:3, color:'#d9b93a'},
  18:{name:'Diamond Ore', tiles:{all:'diamond'}, hard:3.2, drop:203, needTool:3, color:'#5fe3d0'},
  19:{name:'Crafting Table', tiles:{top:'table_top',side:'table_side',bottom:'planks'}, hard:0.9, drop:19, color:'#a67c44'},
  20:{name:'Furnace', tiles:{top:'stone',side:'furnace',bottom:'stone'}, hard:1.6, drop:20, needTool:1, color:'#666'},
  21:{name:'Bricks', tiles:{all:'brick'}, hard:1.6, drop:21, color:'#9a4a3a'},
  22:{name:'Stone Bricks', tiles:{all:'stonebrick'}, hard:1.6, drop:22, color:'#7a7a7a'},
  23:{name:'Snow Block', tiles:{all:'snow'}, hard:0.4, drop:23, color:'#ffffff'},
  24:{name:'Cactus', tiles:{top:'cactus_top',side:'cactus_side',bottom:'cactus_top'}, hard:0.4, drop:24, color:'#3d8b37'},
  25:{name:'Pumpkin', tiles:{top:'pumpkin_top',side:'pumpkin_side',bottom:'pumpkin_top'}, hard:0.7, drop:25, color:'#e07b1f'},
  26:{name:'Torch', tiles:{all:'torch'}, hard:0.05, drop:26, transparent:true, emissive:true, color:'#ffb340'},
  27:{name:'Torchflower Grass', tiles:{top:'grass_top',side:'grass_side',bottom:'dirt'}, hard:0.55, drop:2, color:'#6abe30'},
};
// Non-block items
export const ITEMS = {
  100:{name:'Stick', color:'#8a6a3b', icon:'stick'},
  101:{name:'Apple', color:'#d92b2b', food:4, icon:'apple'},
  102:{name:'Cooked Pork', color:'#c97b5a', food:8, icon:'food'},
  103:{name:'Raw Pork', color:'#e8a0a0', food:3, icon:'food'},
  110:{name:'Wooden Pickaxe', color:'#b08a4f', tool:{tier:1,speed:2.2}, icon:'pick'},
  111:{name:'Stone Pickaxe', color:'#888', tool:{tier:2,speed:3.2}, icon:'pick'},
  112:{name:'Iron Pickaxe', color:'#d8d8d8', tool:{tier:3,speed:4.5}, icon:'pick'},
  113:{name:'Wooden Sword', color:'#b08a4f', tool:{tier:0,speed:1,damage:5}, icon:'sword'},
  114:{name:'Stone Sword', color:'#888', tool:{tier:0,speed:1,damage:7}, icon:'sword'},
  200:{name:'Coal', color:'#222', icon:'coal'},
  201:{name:'Raw Iron', color:'#c9a189', icon:'ingot'},
  202:{name:'Raw Gold', color:'#e8c93a', icon:'ingot'},
  203:{name:'Diamond', color:'#5fe3d0', icon:'gem'},
  204:{name:'Iron Ingot', color:'#e6e6e6', icon:'ingot'},
  205:{name:'Gold Ingot', color:'#f2d24b', icon:'ingot'},
  206:{name:'Bread', color:'#d9a45b', food:6, icon:'food'},
};
export function defOf(id){ return BLOCKS[id] || ITEMS[id] || null; }
export function isBlock(id){ return !!BLOCKS[id]; }

function tileUV(tileName){
  const idx = TILES[tileName] ?? 3;
  const col = idx % 8, row = Math.floor(idx/8);
  const s = 1/8;
  // v origin bottom in three; canvas row top -> flip
  return { u0: col*s, v0: 1-(row+1)*s, u1:(col+1)*s, v1:1-row*s };
}
export function faceUV(blockId, face){ // face: 0 px,1 nx,2 py,3 ny,4 pz,5 nz
  const b = BLOCKS[blockId]; if(!b) return tileUV('stone');
  let t;
  if(b.tiles.all) t=b.tiles.all;
  else if(face===2) t=b.tiles.top; else if(face===3) t=b.tiles.bottom; else t=b.tiles.side;
  return tileUV(t);
}

export function makeAtlasTexture(){
  const TILE=32, COLS=8, ROWS=8;
  const c=document.createElement('canvas'); c.width=COLS*TILE; c.height=ROWS*TILE;
  const g=c.getContext('2d');
  let rngState=1234567;
  const rnd=()=>{ rngState=Math.imul(rngState^rngState>>>15,2246822519); rngState^=rngState>>>13; return ((rngState>>>0)/4294967296); };
  const px=(tx,ty,x,y,col)=>{ g.fillStyle=col; g.fillRect(tx*TILE+x, ty*TILE+y,1,1); };
  function fill(tile, base, variants, speck=900){
    const tx=tile%COLS, ty=Math.floor(tile/COLS);
    g.fillStyle=base; g.fillRect(tx*TILE,ty*TILE,TILE,TILE);
    for(let i=0;i<speck;i++){ const x=(rnd()*TILE)|0,y=(rnd()*TILE)|0; px(tx,ty,x,y, variants[(rnd()*variants.length)|0]); }
  }
  function patch(tile, base, patches, n=26, sz=4){
    fill(tile, base, patches, 500);
    const tx=tile%COLS, ty=Math.floor(tile/COLS);
    for(let i=0;i<n;i++){ g.fillStyle=patches[(rnd()*patches.length)|0]; const x=(rnd()* (TILE-sz))|0,y=(rnd()*(TILE-sz))|0; g.fillRect(tx*TILE+x,ty*TILE+y,sz,sz); }
  }
  const inv=(name)=>TILES[name];
  fill(inv('grass_top'),'#67b32e',['#5da828','#76c53a','#8fd14f','#4f9c22']);
  // grass side
  fill(inv('grass_side'),'#8a5a32',['#7a4e2a','#9a6a3c','#6b4423']);
  { const tx=1%COLS, ty=Math.floor(1/COLS); g.fillStyle='#67b32e'; g.fillRect(tx*TILE,ty*TILE,TILE,9); g.fillStyle='#5da828'; for(let x=0;x<TILE;x++){ g.fillRect(tx*TILE+x, ty*TILE+8,1, 2+((rnd()*4)|0)); } }
  fill(inv('dirt'),'#8a5a32',['#7a4e2a','#9a6a3c','#a97a4a','#654321']);
  patch(inv('stone'),'#7d7d7d',['#6e6e6e','#8c8c8c','#5f5f5f'],18,5);
  fill(inv('sand'),'#dcd29b',['#cfc188','#e8dda9','#c2b37f']);
  fill(inv('snow_top'),'#f4f8f8',['#e6eeee','#ffffff','#dde8e8']);
  fill(inv('snow_side'),'#8a5a32',['#7a4e2a','#9a6a3c']); { const tx=6,ty=0; g.fillStyle='#f4f8f8'; g.fillRect(tx*TILE,ty*TILE,TILE,10); }
  // log side vertical bark
  { const tx=7,ty=0; g.fillStyle='#6b4a2b'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); for(let x=0;x<TILE;x+=3){ g.fillStyle= x%6?'#5a3d22':'#7d5a35'; g.fillRect(tx*TILE+x,ty*TILE,2,TILE);} for(let i=0;i<200;i++) px(tx,ty,(rnd()*TILE)|0,(rnd()*TILE)|0,'#4a3018'); }
  // log top rings
  { const tx=0,ty=1; g.fillStyle='#b08a4f'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.strokeStyle='#8a683c'; for(let r=4;r<16;r+=4){ g.strokeRect(tx*TILE+16-r,ty*TILE+16-r,r*2,r*2);} g.fillStyle='#6b4a2b'; g.fillRect(tx*TILE,ty*TILE,TILE,2); g.fillRect(tx*TILE,ty*TILE+TILE-2,TILE,2); g.fillRect(tx*TILE,ty*TILE,2,TILE); g.fillRect(tx*TILE+TILE-2,ty*TILE,2,TILE);}
  patch(inv('leaves'),'#3d9429',['#357f22','#4cab36','#2d6e1c','#5cb84a'],30,4);
  // planks
  { const idx=inv('planks'), tx=idx%COLS, ty=Math.floor(idx/COLS); g.fillStyle='#b08a4f'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#96733f'; for(let y=7;y<TILE;y+=8) g.fillRect(tx*TILE,ty*TILE+y,TILE,1); for(let i=0;i<300;i++) px(tx,ty,(rnd()*TILE)|0,(rnd()*TILE)|0,'#c49a5f'); g.fillStyle='#7a5c30'; g.fillRect(tx*TILE+4,ty*TILE+3,2,2); g.fillRect(tx*TILE+26,ty*TILE+11,2,2); g.fillRect(tx*TILE+10,ty*TILE+19,2,2); g.fillRect(tx*TILE+22,ty*TILE+27,2,2);}
  // glass
  { const idx=inv('glass'), tx=idx%COLS, ty=Math.floor(idx/COLS); g.clearRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='rgba(205,235,240,0.18)'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#dff6fa'; g.fillRect(tx*TILE,ty*TILE,TILE,2); g.fillRect(tx*TILE,ty*TILE+TILE-2,TILE,2); g.fillRect(tx*TILE,ty*TILE,2,TILE); g.fillRect(tx*TILE+TILE-2,ty*TILE,2,TILE); g.fillStyle='rgba(255,255,255,0.7)'; for(let i=0;i<6;i++) g.fillRect(tx*TILE+6+i,ty*TILE+20-i,2,2); }
  fill(inv('water'),'#2f6fd0',['#2a63bd','#3a7de0','#2560ad','#4a90e8'],700);
  fill(inv('sandstone'),'#d8cb9e',['#cbbd8b','#e6dbb0','#bfb180']); { const idx=inv('sandstone'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#bfb180'; g.fillRect(tx*TILE,ty*TILE+4,TILE,1); g.fillRect(tx*TILE,ty*TILE+26,TILE,1);}
  patch(inv('cobble'),'#747474',['#5f5f5f','#8a8a8a','#686868','#828282'],40,6);
  patch(inv('coal'),'#7d7d7d',['#6e6e6e','#8c8c8c'],8,5); { const idx=inv('coal'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#1c1c1c'; [[6,8],[20,14],[12,24],[24,26],[8,18]].forEach(([x,y])=>g.fillRect(tx*TILE+x,ty*TILE+y,5,4)); }
  patch(inv('iron'),'#7d7d7d',['#6e6e6e','#8c8c8c'],8,5); { const idx=inv('iron'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#c9a189'; [[6,8],[20,14],[12,24],[24,26]].forEach(([x,y])=>g.fillRect(tx*TILE+x,ty*TILE+y,5,4)); }
  patch(inv('gold'),'#7d7d7d',['#6e6e6e','#8c8c8c'],8,5); { const idx=inv('gold'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#f2d24b'; [[6,8],[20,14],[12,24]].forEach(([x,y])=>g.fillRect(tx*TILE+x,ty*TILE+y,5,4)); }
  patch(inv('diamond'),'#7d7d7d',['#6e6e6e','#8c8c8c'],8,5); { const idx=inv('diamond'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#5fe3d0'; [[6,8],[20,14],[12,24]].forEach(([x,y])=>g.fillRect(tx*TILE+x,ty*TILE+y,5,4)); }
  patch(inv('bedrock'),'#3a3a3a',['#222','#555','#2e2e2e'],34,6);
  // crafting table top/side
  { const idx=inv('table_top'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#b08a4f'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.strokeStyle='#6b4a2b'; g.lineWidth=2; g.strokeRect(tx*TILE+3,ty*TILE+3,TILE-6,TILE-6); g.beginPath(); g.moveTo(tx*TILE+10,ty*TILE+3); g.lineTo(tx*TILE+10,ty*TILE+29); g.moveTo(tx*TILE+21,ty*TILE+3); g.lineTo(tx*TILE+21,ty*TILE+29); g.stroke(); }
  { const idx=inv('table_side'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#96733f'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#b08a4f'; g.fillRect(tx*TILE,ty*TILE,TILE,8); g.fillStyle='#5a4020'; g.fillRect(tx*TILE+6,ty*TILE+14,8,10); g.fillRect(tx*TILE+18,ty*TILE+14,8,10); }
  { const idx=inv('furnace'),tx=idx%COLS,ty=Math.floor(idx/COLS); patch(99,'#666',['#555','#777'],0,0); g.fillStyle='#6a6a6a'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#222'; g.fillRect(tx*TILE+8,ty*TILE+16,16,12); g.fillStyle='#f08c28'; g.fillRect(tx*TILE+11,ty*TILE+21,10,5); g.fillStyle='#333'; g.fillRect(tx*TILE+10,ty*TILE+6,12,6); }
  // brick
  { const idx=inv('brick'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#c9c0b4'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#9a4a3a'; for(let r=0;r<4;r++){ for(let colI=0;colI<2;colI++){ const off=r%2? -8:0; g.fillRect(tx*TILE+colI*16+off+1, ty*TILE+r*8+1,14,6);} } }
  patch(inv('stonebrick'),'#7a7a7a',['#6a6a6a','#8a8a8a'],16,5); { const idx=inv('stonebrick'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#5a5a5a'; g.fillRect(tx*TILE,ty*TILE+15,TILE,1); g.fillRect(tx*TILE,ty*TILE+7,TILE,1); g.fillRect(tx*TILE+15,ty*TILE,1,16); g.fillRect(tx*TILE+7,ty*TILE+16,1,16); g.fillRect(tx*TILE+23,ty*TILE+16,1,16); }
  fill(inv('snow'),'#f4f8f8',['#e6eeee','#fff']);
  { const idx=inv('cactus_side'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#3d8b37'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#2f7029'; g.fillRect(tx*TILE+4,ty*TILE,3,TILE); g.fillRect(tx*TILE+14,ty*TILE,3,TILE); g.fillRect(tx*TILE+24,ty*TILE,3,TILE); g.fillStyle='#cfe8a0'; for(let i=0;i<16;i++) g.fillRect(tx*TILE+(rnd()*TILE)|0, ty*TILE+(rnd()*TILE)|0,1,2); }
  fill(inv('cactus_top'),'#3d8b37',['#2f7029','#4cab36']);
  { const idx=inv('pumpkin_side'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#e07b1f'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#c96a18'; for(let x=4;x<TILE;x+=7) g.fillRect(tx*TILE+x,ty*TILE,2,TILE); g.fillStyle='#5a4020'; g.fillRect(tx*TILE+13,ty*TILE,6,4); }
  fill(inv('pumpkin_top'),'#e07b1f',['#c96a18','#f08c2e']); { const idx=inv('pumpkin_top'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#5a7d2a'; g.fillRect(tx*TILE+13,ty*TILE+12,6,7); }
  { const idx=inv('torch'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.clearRect(tx*TILE,ty*TILE,TILE,TILE); g.fillStyle='#8a6a3b'; g.fillRect(tx*TILE+14,ty*TILE+12,4,20); g.fillStyle='#ffb340'; g.fillRect(tx*TILE+12,ty*TILE+4,8,9); g.fillStyle='#fff0a0'; g.fillRect(tx*TILE+14,ty*TILE+6,4,4); }
  { const idx=inv('flower'),tx=idx%COLS,ty=Math.floor(idx/COLS); g.fillStyle='#67b32e'; g.fillRect(tx*TILE,ty*TILE,TILE,TILE); for(let i=0;i<300;i++) px(tx,ty,(rnd()*TILE)|0,(rnd()*TILE)|0,'#4f9c22'); g.fillStyle='#3d7d1f'; g.fillRect(tx*TILE+15,ty*TILE+14,2,18); g.fillStyle='#e5484d'; [[10,6],[20,4],[14,12],[22,14],[8,14]].forEach(([x,y])=>g.fillRect(tx*TILE+x,ty*TILE+y,5,5)); g.fillStyle='#ffd23e'; g.fillRect(tx*TILE+15,ty*TILE+8,3,3); }
  fill(inv('stone_side'),'#7d7d7d',['#6e6e6e','#8c8c8c']);
  const tex=new THREE.CanvasTexture(c);
  tex.magFilter=THREE.NearestFilter; tex.minFilter=THREE.NearestFilter; tex.generateMipmaps=false; tex.colorSpace=THREE.SRGBColorSpace;
  tex.userData.canvas=c;
  return tex;
}

// Small canvas icon for inventory UI (data URL) drawn from atlas tile or item glyph colors
export function iconFor(id, atlasCanvas){
  const c=document.createElement('canvas'); c.width=c.height=48; const g=c.getContext('2d');
  const b=BLOCKS[id];
  if(b && atlasCanvas){
    // draw side tile (or top for grass-like)
    const sideName = b.tiles.all || b.tiles.side;
    const idx=TILES[sideName]; const col=idx%8,row=Math.floor(idx/8);
    g.imageSmoothingEnabled=false;
    g.drawImage(atlasCanvas, col*32,row*32,32,32, 4,4,40,40);
    if(!b.tiles.all){ const topName=b.tiles.top; const ti=TILES[topName]; g.drawImage(atlasCanvas,(ti%8)*32,Math.floor(ti/8)*32,32,32, 4,4,40,14); }
  } else {
    const it=ITEMS[id]; const col=it?it.color:'#999';
    g.fillStyle=col;
    if(it && it.icon==='pick'){ g.save(); g.translate(24,24); g.rotate(-0.7); g.fillRect(-2,-18,4,30); g.fillStyle='#d8d8d8'; g.fillRect(-14,-18,28,5); g.restore(); }
    else if(it && it.icon==='sword'){ g.save(); g.translate(24,24); g.rotate(-0.7); g.fillRect(-2,-18,4,26); g.fillStyle='#7a5c30'; g.fillRect(-2,8,4,10); g.fillRect(-7,7,14,3); g.restore(); }
    else if(it && it.icon==='apple'){ g.beginPath(); g.arc(24,27,12,0,7); g.fill(); g.fillStyle='#5a7d2a'; g.fillRect(23,10,3,8); }
    else if(it && it.icon==='gem'){ g.beginPath(); g.moveTo(24,8); g.lineTo(38,22); g.lineTo(24,40); g.lineTo(10,22); g.closePath(); g.fill(); }
    else if(it && it.icon==='stick'){ g.save(); g.translate(24,24); g.rotate(0.7); g.fillRect(-2,-18,5,36); g.restore(); }
    else { g.beginPath(); g.arc(24,24,13,0,7); g.fill(); g.fillStyle='rgba(255,255,255,.35)'; g.beginPath(); g.arc(19,19,5,0,7); g.fill(); }
  }
  return c.toDataURL();
}
