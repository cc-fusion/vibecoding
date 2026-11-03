import * as THREE from 'three';

function box(w,h,d,color,x=0,y=0,z=0){
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshLambertMaterial({color}));
  m.position.set(x,y,z); return m;
}
export function createMobMesh(type){
  const g=new THREE.Group();
  if(type==='pig'){
    const body=box(0.9,0.6,0.55,0xe89bb0,0,0.55,0); g.add(body);
    g.add(box(0.45,0.45,0.45,0xe89bb0,0.55,0.65,0));
    g.add(box(0.18,0.18,0.08,0xd97f96,0.79,0.6,0)); // snout
    [[-0.3,-0.18],[0.3,-0.18],[-0.3,0.18],[0.3,0.18]].forEach(([x,z])=>g.add(box(0.16,0.35,0.16,0xd98aa2,x,0.17,z)));
    g.userData.eyeY=0.65;
  } else if(type==='cow'){
    const body=box(1.0,0.65,0.6,0x6b4a35,0,0.6,0); g.add(body);
    g.add(box(0.42,0.45,0.45,0x7d5a40,0.6,0.68,0));
    g.add(box(0.5,0.2,0.3,0xe8d8c8,0.62,0.5,0));
    [[-0.35,-0.2],[0.35,-0.2],[-0.35,0.2],[0.35,0.2]].forEach(([x,z])=>g.add(box(0.16,0.4,0.16,0x4a3423,x,0.2,z)));
    g.add(box(0.2,0.35,0.2,0xffffff,-0.2,0.75,0.1)); // patch
    g.userData.eyeY=0.68;
  } else if(type==='sheep'){
    g.add(box(0.9,0.6,0.6,0xf0ede6,0,0.6,0));
    g.add(box(0.38,0.4,0.4,0x3a3330,0.55,0.65,0));
    [[-0.3,-0.18],[0.3,-0.18],[-0.3,0.18],[0.3,0.18]].forEach(([x,z])=>g.add(box(0.15,0.35,0.15,0x3a3330,x,0.17,z)));
    g.userData.eyeY=0.65;
  } else if(type==='zombie'){
    g.add(box(0.55,0.75,0.3,0x3f6d3a,0,1.05,0)); // torso teal-ish green shirt
    g.children[0].material.color.set(0x2a7d8c);
    g.add(box(0.42,0.42,0.42,0x5da84f,0,1.65,0)); // head
    const armL=box(0.16,0.6,0.16,0x5da84f,0.15,1.05,0.36); armL.rotation.x=-1.4; g.add(armL);
    const armR=box(0.16,0.6,0.16,0x5da84f,-0.15,1.05,0.36); armR.rotation.x=-1.4; g.add(armR);
    g.add(box(0.2,0.65,0.22,0x3a3a7d,0.16,0.32,0)); g.add(box(0.2,0.65,0.22,0x3a3a7d,-0.16,0.32,0));
    g.userData.eyeY=1.65;
  } else if(type==='skeleton'){
    g.add(box(0.5,0.7,0.28,0xdcdcdc,0,1.05,0));
    g.add(box(0.42,0.42,0.42,0xf0f0f0,0,1.65,0));
    g.add(box(0.13,0.6,0.13,0xdcdcdc,0.34,1.05,0)); g.add(box(0.13,0.6,0.13,0xdcdcdc,-0.34,1.05,0));
    g.add(box(0.16,0.65,0.16,0xdcdcdc,0.14,0.32,0)); g.add(box(0.16,0.65,0.16,0xdcdcdc,-0.14,0.32,0));
    g.userData.eyeY=1.65;
  } else { // chicken
    g.add(box(0.45,0.45,0.4,0xffffff,0,0.5,0));
    g.add(box(0.3,0.3,0.3,0xffffff,0.3,0.75,0));
    g.add(box(0.16,0.08,0.12,0xf2a71b,0.48,0.7,0));
    [[-0.12],[0.12]].forEach(([z])=>g.add(box(0.06,0.3,0.06,0xf2a71b,0,0.15,z)));
    g.userData.eyeY=0.75;
  }
  g.traverse(o=>{ if(o.isMesh){ o.castShadow=false; }});
  return g;
}

export class MobManager {
  constructor(scene, world, audio){
    this.scene=scene; this.world=world; this.audio=audio;
    this.mobs=[]; this.spawnTimer=0;
  }
  spawn(type, x,z){
    const y=this.world.surfaceY(Math.floor(x),Math.floor(z))+1;
    if(this.world.getBlock(Math.floor(x),y,Math.floor(z))===10) return;
    const mesh=createMobMesh(type);
    mesh.position.set(x,y,z);
    this.scene.add(mesh);
    const hostile=(type==='zombie'||type==='skeleton');
    this.mobs.push({type, mesh, hp: hostile?20:10, maxHp: hostile?20:10, hostile,
      vel:new THREE.Vector3(), yaw:Math.random()*Math.PI*2, wanderT:0, attackCd:0, hurtT:0, walkPhase:Math.random()*6});
  }
  update(dt, playerPos, isNight, onDamagePlayer, onKill){
    this.spawnTimer-=dt;
    if(this.spawnTimer<=0){
      this.spawnTimer=2.5;
      const passives=this.mobs.filter(m=>!m.hostile).length;
      const hostiles=this.mobs.filter(m=>m.hostile).length;
      const ang=Math.random()*Math.PI*2, dist=14+Math.random()*16;
      const x=playerPos.x+Math.cos(ang)*dist, z=playerPos.z+Math.sin(ang)*dist;
      if(!isNight && passives<7) this.spawn(['pig','cow','sheep','chicken'][(Math.random()*4)|0], x,z);
      if(isNight && hostiles<6) this.spawn(Math.random()<0.7?'zombie':'skeleton', x,z);
    }
    for(let i=this.mobs.length-1;i>=0;i--){
      const m=this.mobs[i]; const p=m.mesh.position;
      const toPlayer=new THREE.Vector3().subVectors(playerPos,p); toPlayer.y=0;
      const distP=toPlayer.length();
      if(distP>56){ this.scene.remove(m.mesh); this.mobs.splice(i,1); continue; }
      if(!m.hostile && isNight && false) {}
      m.wanderT-=dt; m.attackCd-=dt; if(m.hurtT>0)m.hurtT-=dt;
      let speed=0, desiredYaw=m.yaw;
      if(m.hostile && distP<18 && distP>0.01){ desiredYaw=Math.atan2(-toPlayer.z, toPlayer.x); speed= distP<1.4?0:2.1; if(distP<1.6 && m.attackCd<=0){ m.attackCd=1.0; onDamagePlayer(m.type==='skeleton'?2:3); } }
      else if(m.hurtT>0 && distP<10){ desiredYaw=Math.atan2(toPlayer.z, toPlayer.x); speed=3.2; } // flee-ish (away via yaw+pi handled below)
      else { if(m.wanderT<=0){ m.wanderT=1.5+Math.random()*2.5; m.yaw=Math.random()*Math.PI*2; } speed=0.7; desiredYaw=m.yaw; }
      // smooth yaw
      let dy=desiredYaw-m.mesh.rotation.y; while(dy>Math.PI)dy-=Math.PI*2; while(dy<-Math.PI)dy+=Math.PI*2;
      m.mesh.rotation.y += dy*Math.min(1,dt*6);
      const yaw=m.mesh.rotation.y;
      const mx=Math.cos(yaw)*speed, mz=-Math.sin(yaw)*speed;
      // gravity + ground
      m.vel.y-=22*dt; if(m.vel.y<-30)m.vel.y=-30;
      let nx=p.x+mx*dt, nz=p.z+mz*dt;
      // simple collision: if blocked step up 1
      const groundAt=(x,z)=>this.world.surfaceY(Math.floor(x),Math.floor(z));
      let gy=groundAt(nx,nz)+1;
      if(gy>p.y+1.2){ nx=p.x; nz=p.z; m.yaw+=1.2; } // turn away from wall
      p.x=nx; p.z=nz;
      p.y+=m.vel.y*dt;
      gy=groundAt(p.x,p.z)+1;
      if(p.y<=gy){ p.y=gy; m.vel.y=0; }
      // walk bob + leg swing via slight body bob
      if(speed>0.1){ m.walkPhase+=dt*speed*3.4; p.y+=Math.abs(Math.sin(m.walkPhase))*0.04; m.mesh.rotation.z=Math.sin(m.walkPhase)*0.03; }
      // hurt flash
      const flash=m.hurtT>0;
      m.mesh.traverse(o=>{ if(o.isMesh && o.material.emissive) o.material.emissive.setHex(flash?0x661111:0x000000); });
      if(m.hp<=0){
        onKill(m);
        this.scene.remove(m.mesh); this.mobs.splice(i,1);
      }
    }
  }
  // returns mob hit within reach in front
  tryHit(origin, dir, reach=4.5, damage=5, knock=6){
    let best=null, bestD=reach;
    for(const m of this.mobs){
      const c=m.mesh.position.clone(); c.y+=(m.mesh.userData.eyeY||0.8);
      const to=new THREE.Vector3().subVectors(c,origin); const d=to.length();
      if(d<bestD && to.normalize().dot(dir)>0.82){ best=m; bestD=d; }
    }
    if(best){
      best.hp-=damage; best.hurtT=0.9;
      const k=new THREE.Vector3().subVectors(best.mesh.position,origin); k.y=0; k.normalize();
      best.mesh.position.addScaledVector(k,0.55); best.mesh.position.y+=0.15;
      this.audio.noise(0.08,0.2,300); this.audio.tone(140,0.07,'square',0.1,-40);
    }
    return best;
  }
  clear(){ for(const m of this.mobs) this.scene.remove(m.mesh); this.mobs=[]; }
}
