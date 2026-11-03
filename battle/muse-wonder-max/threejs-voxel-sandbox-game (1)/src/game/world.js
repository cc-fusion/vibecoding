import * as THREE from 'three';
import { fbm, hash2, hash3 } from './noise.js';
import { BLOCKS, faceUV } from './blocks.js';

export const CHUNK = 16;
export const HEIGHT = 64;
export const SEA = 15;

const FACES = [
  { dir:[1,0,0],  corners:[[1,1,1],[1,0,1],[1,0,0],[1,1,0]], shade:0.78 },
  { dir:[-1,0,0], corners:[[0,1,0],[0,0,0],[0,0,1],[0,1,1]], shade:0.78 },
  { dir:[0,1,0],  corners:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], shade:1.0 },
  { dir:[0,-1,0], corners:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], shade:0.55 },
  { dir:[0,0,1],  corners:[[0,1,1],[0,0,1],[1,0,1],[1,1,1]], shade:0.88 },
  { dir:[0,0,-1], corners:[[1,1,0],[1,0,0],[0,0,0],[0,1,0]], shade:0.68 },
];

export class World {
  constructor(scene, seed, atlasTex, edited){
    this.scene=scene; this.seed=seed;
    this.chunks=new Map(); // key -> {data, opaque, transp, dirty, generated}
    this.edited = edited || new Map(); // "x,y,z" -> id
    this.matOpaque = new THREE.MeshLambertMaterial({ map: atlasTex });
    this.matTransp = new THREE.MeshLambertMaterial({ map: atlasTex, transparent:true, opacity:0.82, depthWrite:false, side:THREE.DoubleSide });
    this.queue=[]; this.queued=new Set();
  }
  key(cx,cz){ return cx+','+cz; }
  chunkAt(wx,wz){ return this.chunks.get(this.key(Math.floor(wx/CHUNK), Math.floor(wz/CHUNK))); }
  idx(lx,y,lz){ return (y*CHUNK + lz)*CHUNK + lx; }
  getBlock(wx,wy,wz){
    if(wy<0||wy>=HEIGHT) return 0;
    const cx=Math.floor(wx/CHUNK), cz=Math.floor(wz/CHUNK);
    const ch=this.chunks.get(this.key(cx,cz));
    if(!ch) return 0;
    return ch.data[this.idx(wx-cx*CHUNK, wy, wz-cz*CHUNK)];
  }
  isSolid(wx,wy,wz){
    if(wy<0) return true;
    const id=this.getBlock(wx,wy,wz); if(!id) return false;
    const b=BLOCKS[id]; return b && b.solid!==false && !b.liquid;
  }
  isLiquid(wx,wy,wz){ const id=this.getBlock(wx,wy,wz); return id===10; }
  biomeAt(wx,wz){
    const temp = fbm(this.seed+777, wx*0.004, wz*0.004, 3);
    const moist = fbm(this.seed+333, wx*0.005+100, wz*0.005, 3);
    if(temp>0.62 && moist<0.5) return 'Desert';
    if(temp<0.36) return 'Snowy Tundra';
    if(moist>0.58) return 'Forest';
    if(temp>0.58) return 'Savanna';
    return 'Plains';
  }
  heightAt(wx,wz){
    const cont = fbm(this.seed, wx*0.012, wz*0.012, 4);
    const hills = fbm(this.seed+55, wx*0.045, wz*0.045, 3);
    const mount = Math.max(0, fbm(this.seed+99, wx*0.006+50, wz*0.006, 3)-0.58)*46;
    return Math.max(3, Math.min(HEIGHT-14, Math.floor(10 + cont*16 + hills*5 + mount)));
  }
  generateChunk(cx,cz){
    const data=new Uint8Array(CHUNK*HEIGHT*CHUNK);
    const set=(lx,y,lz,id)=>{ if(y>=0&&y<HEIGHT) data[this.idx(lx,y,lz)]=id; };
    for(let lx=0;lx<CHUNK;lx++) for(let lz=0;lz<CHUNK;lz++){
      const wx=cx*CHUNK+lx, wz=cz*CHUNK+lz;
      const h=this.heightAt(wx,wz);
      const biome=this.biomeAt(wx,wz);
      const desert=biome==='Desert', snow=biome==='Snowy Tundra';
      for(let y=0;y<=h;y++){
        let id;
        if(y===0) id=13;
        else if(y<h-3) {
          id=3;
          const r=hash3(this.seed+7, wx,y,wz);
          if(y<h-6){ if(r>0.985) id=15; else if(r>0.972&&y<26) id=16; else if(r>0.966&&y<16) id=17; else if(r>0.962&&y<12) id=18; }
          // caves
          const cave = Math.sin(wx*0.11+y*0.23)*Math.cos(wz*0.13-y*0.17)+Math.sin((wx+wz)*0.07+y*0.31);
          if(y>3 && y<h-4 && cave>1.55) id=0;
        }
        else if(y<h) id= desert?4:2;
        else { // surface
          if(h<=SEA+1) id=4;
          else if(desert) id=4;
          else if(snow) id=5;
          else id=1;
        }
        // beach / underwater floor
        if(y===h && h<=SEA+1 && !desert) id=4;
        if(id) set(lx,y,lz,id);
      }
      if(h>SEA){
        // water fill handled in second pass as blocks at setBlock stage; do here:
        for(let y=h+1;y<=SEA;y++) set(lx,y,lz,10);
      } else {
        for(let y=h+1;y<=SEA;y++) set(lx,y,lz,10);
      }
      // decorations
      const r=hash2(this.seed+21, wx, wz);
      if(h>SEA+1){
        const forest = biome==='Forest', plains=biome==='Plains'||biome==='Savanna';
        const treeChance = forest?0.022:(plains?0.006:0.002);
        if(r<treeChance && lx>1&&lx<14&&lz>1&&lz<14 && !desert && !snow){
          const th=4+Math.floor(hash2(this.seed+31,wx,wz)*3);
          for(let t=1;t<=th;t++) set(lx,h+t,lz,6);
          for(let dy=th-2;dy<=th+1;dy++) for(let dx=-2;dx<=2;dx++) for(let dz=-2;dz<=2;dz++){
            if(Math.abs(dx)===2&&Math.abs(dz)===2&&hash2(this.seed,wx+dx,wz+dz)<0.5) continue;
            if(dx===0&&dz===0&&dy<=th) continue;
            const p=this.idx(lx+dx,h+dy,lz+dz); if(!data[p]) data[p]=7;
          }
          set(lx,h+th+2,lz,7);
        } else if(desert && r>0.995){
          const ch2=1+Math.floor(r*400)%3; for(let t=1;t<=ch2;t++) set(lx,h+t,lz,24);
        } else if(desert && r>0.992){ set(lx,h+1,lz,4); if(hash2(this.seed+3,wx,wz)>0.6) set(lx,h+2,lz,4); }
        else if(!desert && r>0.988 && r<=0.995) set(lx,h+1,lz,12); // rose
        else if(!desert && !snow && r>0.975 && r<=0.982) set(lx,h+1,lz,25); // pumpkin patch rare
      }
    }
    // apply edited
    for(const [k,id] of this.edited){
      const [x,y,z]=k.split(',').map(Number);
      const lx=x-cx*CHUNK, lz=z-cz*CHUNK;
      if(lx>=0&&lx<CHUNK&&lz>=0&&lz<CHUNK&&y>=0&&y<HEIGHT) data[this.idx(lx,y,lz)]=id;
    }
    const ch={data, opaque:null, transp:null, dirty:true, cx, cz};
    this.chunks.set(this.key(cx,cz), ch);
    return ch;
  }
  ensureChunk(cx,cz){
    let ch=this.chunks.get(this.key(cx,cz));
    if(!ch) ch=this.generateChunk(cx,cz);
    return ch;
  }
  setBlock(wx,wy,wz,id, record=true){
    if(wy<0||wy>=HEIGHT) return;
    const cx=Math.floor(wx/CHUNK), cz=Math.floor(wz/CHUNK);
    const ch=this.chunks.get(this.key(cx,cz)); if(!ch) return;
    const lx=wx-cx*CHUNK, lz=wz-cz*CHUNK;
    ch.data[this.idx(lx,wy,lz)]=id;
    if(record) this.edited.set(wx+','+wy+','+wz, id);
    ch.dirty=true;
    if(lx===0) this.markDirty(cx-1,cz); if(lx===CHUNK-1) this.markDirty(cx+1,cz);
    if(lz===0) this.markDirty(cx,cz-1); if(lz===CHUNK-1) this.markDirty(cx,cz+1);
  }
  markDirty(cx,cz){ const ch=this.chunks.get(this.key(cx,cz)); if(ch) ch.dirty=true; }
  queueAround(px,pz,radius){
    const pcx=Math.floor(px/CHUNK), pcz=Math.floor(pz/CHUNK);
    const list=[];
    for(let dx=-radius;dx<=radius;dx++) for(let dz=-radius;dz<=radius;dz++){
      const cx=pcx+dx, cz=pcz+dz, k=this.key(cx,cz);
      const ch=this.chunks.get(k);
      if(!ch || ch.dirty) list.push({cx,cz,d:dx*dx+dz*dz,k});
    }
    list.sort((a,b)=>a.d-b.d);
    this.queue=list;
  }
  processQueue(budget=2){
    let n=0;
    while(this.queue.length && n<budget){
      const {cx,cz}=this.queue.shift();
      const ch=this.ensureChunk(cx,cz);
      if(ch.dirty){ this.buildMesh(ch); ch.dirty=false; }
      n++;
    }
    // also rebuild any dirty existing (edits)
    for(const ch of this.chunks.values()) if(ch.dirty){ this.buildMesh(ch); ch.dirty=false; break; }
  }
  dispose(){
    for(const ch of this.chunks.values()){
      if(ch.opaque){ this.scene.remove(ch.opaque); ch.opaque.geometry.dispose(); }
      if(ch.transp){ this.scene.remove(ch.transp); ch.transp.geometry.dispose(); }
    }
    this.chunks.clear(); this.queue=[];
  }
  unloadFar(px,pz,radius){
    const pcx=Math.floor(px/CHUNK), pcz=Math.floor(pz/CHUNK);
    for(const [k,ch] of this.chunks){
      if(Math.abs(ch.cx-pcx)>radius+2||Math.abs(ch.cz-pcz)>radius+2){
        if(ch.opaque){ this.scene.remove(ch.opaque); ch.opaque.geometry.dispose(); }
        if(ch.transp){ this.scene.remove(ch.transp); ch.transp.geometry.dispose(); }
        this.chunks.delete(k);
      }
    }
  }
  isTransparent(id){
    if(!id) return true;
    const b=BLOCKS[id]; return !!(b && b.transparent);
  }
  buildMesh(ch){
    const posO=[],norO=[],uvO=[],colO=[],idxO=[];
    const posT=[],norT=[],uvT=[],colT=[],idxT=[];
    const {cx,cz,data}=ch;
    for(let y=0;y<HEIGHT;y++) for(let lz=0;lz<CHUNK;lz++) for(let lx=0;lx<CHUNK;lx++){
      const id=data[this.idx(lx,y,lz)]; if(!id) continue;
      const b=BLOCKS[id]; if(!b) continue;
      const wx=cx*CHUNK+lx, wz=cz*CHUNK+lz;
      const isT = b.transparent || b.liquid;
      const P=isT?posT:posO, N=isT?norT:norO, U=isT?uvT:uvO, C=isT?colT:colO, I=isT?idxT:idxO;
      for(let f=0;f<6;f++){
        const face=FACES[f]; const [dx,dy,dz]=face.dir;
        const nlx=lx+dx, nly=y+dy, nlz=lz+dz;
        const nid=(nlx>=0&&nlx<CHUNK&&nlz>=0&&nlz<CHUNK&&nly>=0&&nly<HEIGHT)
          ? data[this.idx(nlx,nly,nlz)]
          : this.getBlock(wx+dx,y+dy,wz+dz);
        if(nid===id && (b.liquid|| (BLOCKS[nid]&&BLOCKS[nid].transparent))) continue;
        if(!this.isTransparent(nid)) continue;
        if(b.liquid && f!==2 && nid===10) continue;
        const uv=faceUV(id,f);
        const base=P.length/3;
        // water surface slightly lower
        const yOff = b.liquid? -0.12:0;
        for(const [vx,vy,vz] of face.corners){
          P.push(wx+vx, y+vy+(vy===1?yOff:0), wz+vz);
          N.push(dx,dy,dz);
          C.push(face.shade,face.shade,face.shade);
        }
        // uv per corner order
        U.push(uv.u0,uv.v1, uv.u0,uv.v0, uv.u1,uv.v0, uv.u1,uv.v1);
        I.push(base,base+1,base+2, base,base+2,base+3);
      }
    }
    const mk=(P,N,U,C,I,mat)=>{
      if(!I.length) return null;
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(P,3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(N,3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(U,2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(C,3));
      geo.setIndex(I);
      const m=new THREE.Mesh(geo, mat);
      m.matrixAutoUpdate=false;
      return m;
    };
    // Need vertexColors via separate materials clone
    if(!this.matOpaque.vertexColors){ this.matOpaque.vertexColors=true; this.matOpaque.needsUpdate=true; this.matTransp.vertexColors=true; this.matTransp.needsUpdate=true; }
    if(ch.opaque){ this.scene.remove(ch.opaque); ch.opaque.geometry.dispose(); }
    if(ch.transp){ this.scene.remove(ch.transp); ch.transp.geometry.dispose(); }
    ch.opaque=mk(posO,norO,uvO,colO,idxO,this.matOpaque);
    ch.transp=mk(posT,norT,uvT,colT,idxT,this.matTransp);
    if(ch.opaque) this.scene.add(ch.opaque);
    if(ch.transp) this.scene.add(ch.transp);
  }
  // Voxel raycast DDA
  raycast(origin, dir, maxDist=7){
    let x=Math.floor(origin.x), y=Math.floor(origin.y), z=Math.floor(origin.z);
    const stepX=Math.sign(dir.x), stepY=Math.sign(dir.y), stepZ=Math.sign(dir.z);
    const tdx=Math.abs(1/(dir.x||1e-9)), tdy=Math.abs(1/(dir.y||1e-9)), tdz=Math.abs(1/(dir.z||1e-9));
    const distX = stepX>0 ? (x+1-origin.x) : (origin.x-x);
    const distY = stepY>0 ? (y+1-origin.y) : (origin.y-y);
    const distZ = stepZ>0 ? (z+1-origin.z) : (origin.z-z);
    let tmx=tdx*distX, tmy=tdy*distY, tmz=tdz*distZ;
    let t=0, nx=0,ny=0,nz=0;
    for(let i=0;i<128;i++){
      const id=this.getBlock(x,y,z);
      if(id && id!==10){ return {x,y,z,id,nx,ny,nz,dist:t}; }
      if(tmx<tmy && tmx<tmz){ x+=stepX; t=tmx; tmx+=tdx; nx=-stepX; ny=0; nz=0; }
      else if(tmy<tmz){ y+=stepY; t=tmy; tmy+=tdy; nx=0; ny=-stepY; nz=0; }
      else { z+=stepZ; t=tmz; tmz+=tdz; nx=0; ny=0; nz=-stepZ; }
      if(t>maxDist) return null;
    }
    return null;
  }
  surfaceY(wx,wz){
    for(let y=HEIGHT-1;y>0;y--){ const id=this.getBlock(wx,y,wz); if(id && id!==10) return y; }
    return SEA;
  }
}
