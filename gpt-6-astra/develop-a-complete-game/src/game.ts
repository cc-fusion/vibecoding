// NEON BREAK — deterministic, frame-rate-independent arcade engine.
export const W = 900;
export const H = 530;
export type Phase = 'start' | 'ready' | 'playing' | 'paused' | 'stage' | 'won' | 'lost';
export type Mode = 'Chill' | 'Classic' | 'Turbo';
export type Power = 'wide' | 'multi' | 'slow';
type Ball = { x: number; y: number; vx: number; vy: number; trail: {x:number;y:number}[] };
type Brick = { x: number; y: number; hp: number; maxHp: number; color: string; alive: boolean };
type Particle = {x:number;y:number;vx:number;vy:number;life:number;color:string};
type Drop = {x:number;y:number;type:Power};
export type Snapshot = { phase:Phase; score:number; lives:number; stage:number; remaining:number; total:number; combo:number; elapsed:number; wide:number; slow:number; mode:Mode };
export const stageNames = ['First contact', 'Split decision', 'The resistance', 'Into the void', 'Final frequency'];
const COLORS = ['#bcf566','#65dfca','#56bacb','#9180da','#c18acf'];
const BW = 68, BH = 20, GAP = 9;
export class Breaker {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  phase: Phase = 'start'; previous: Phase = 'playing'; mode:Mode = 'Classic';
  score=0; lives=3; stage=1; elapsed=0; combo=0;
  paddle=450; target=450; paddleWidth=112; wide=0; slow=0;
  balls:Ball[]=[]; bricks:Brick[]=[]; particles:Particle[]=[]; drops:Drop[]=[];
  keys=new Set<string>(); sound=true; audio:AudioContext|null=null;
  onUpdate:(s:Snapshot)=>void; onFinish:(s:Snapshot)=>void;
  frame=0; last=0; lastPublish=0; disposed=false; hitFlash=0;
  constructor(canvas:HTMLCanvasElement, update:(s:Snapshot)=>void, finish:(s:Snapshot)=>void) {
    this.canvas=canvas; this.ctx=canvas.getContext('2d')!; this.onUpdate=update; this.onFinish=finish;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=W*ratio;canvas.height=H*ratio;this.ctx.scale(ratio,ratio);
    this.layout();this.dock();this.publish();this.frame=requestAnimationFrame(this.loop);
  }
  get speed(){return (this.mode==='Chill'?290:this.mode==='Turbo'?420:350)+this.stage*25;}
  snapshot():Snapshot {return {phase:this.phase,score:this.score,lives:this.lives,stage:this.stage,remaining:this.bricks.filter(b=>b.alive).length,total:this.bricks.length,combo:this.combo,elapsed:this.elapsed,wide:this.wide,slow:this.slow,mode:this.mode};}
  publish(){this.onUpdate(this.snapshot());}
  unlock(){try{if(!this.audio)this.audio=new AudioContext();if(this.audio.state==='suspended')void this.audio.resume();}catch{/* Audio is optional. */}}
  tone(freq:number,duration=.08,type:OscillatorType='sine',volume=.045){
    if(!this.sound||!this.audio)return;
    try{const o=this.audio.createOscillator(),g=this.audio.createGain();o.type=type;o.frequency.setValueAtTime(freq,this.audio.currentTime);o.frequency.exponentialRampToValueAtTime(freq*.6,this.audio.currentTime+duration);g.gain.setValueAtTime(volume,this.audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,this.audio.currentTime+duration);o.connect(g);g.connect(this.audio.destination);o.start();o.stop(this.audio.currentTime+duration);}catch{/* No sound never interrupts play. */}
  }
  layout(){
    this.bricks=[];
    for(let r=0;r<5;r++)for(let col=0;col<10;col++){
      if(this.stage===2 && (col===4||col===5)&&r<3)continue;
      if(this.stage===3 && (r+col)%5===0)continue;
      if(this.stage===4 && (col<Math.abs(2-r)||col>9-Math.abs(2-r)))continue;
      const hp=this.stage>=3&&((r+col)%3===0)?2:this.stage===5&&r<2?3:1;
      this.bricks.push({x:69+col*(BW+GAP),y:57+r*(BH+GAP),hp,maxHp:hp,color:COLORS[r],alive:true});
    }
  }
  dock(){this.balls=[{x:this.paddle,y:H-54,vx:0,vy:0,trail:[]}];}
  start(mode:Mode='Classic'){
    this.unlock();this.mode=mode;this.score=0;this.lives=mode==='Chill'?5:3;this.stage=1;this.elapsed=0;this.combo=0;this.wide=0;this.slow=0;this.paddleWidth=112;this.paddle=450;this.target=450;this.drops=[];this.particles=[];this.layout();this.dock();this.phase='ready';this.publish();
  }
  launch(){if(this.phase!=='ready')return;this.unlock();this.balls[0].vx=this.speed*.38;this.balls[0].vy=-this.speed*.925;this.phase='playing';this.tone(660);this.publish();}
  pause(){if(this.phase==='playing'||this.phase==='ready'){this.previous=this.phase;this.phase='paused';this.keys.clear();this.publish();}else if(this.phase==='paused'){this.phase=this.previous;this.last=0;this.publish();}}
  next(){if(this.phase!=='stage')return;this.stage++;this.wide=0;this.slow=0;this.paddleWidth=112;this.drops=[];this.combo=0;this.layout();this.dock();this.phase='ready';this.publish();}
  move(clientX:number){const rect=this.canvas.getBoundingClientRect();this.target=Math.max(this.paddleWidth/2+14,Math.min(W-this.paddleWidth/2-14,(clientX-rect.left)/rect.width*W));}
  burst(x:number,y:number,color:string,n=12){for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=40+Math.random()*150;this.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.35+Math.random()*.4,color});}}
  power(type:Power){this.tone(900,.25,'triangle');this.burst(this.paddle,H-34,type==='wide'?'#bcf566':type==='multi'?'#bc99ff':'#66dbea',25);
    if(type==='wide')this.wide=15;
    if(type==='slow')this.slow=12;
    if(type==='multi'&&this.balls.length<5){const b=this.balls[0];if(b){for(const sign of [-1,1])this.balls.push({x:b.x,y:b.y,vx:this.speed*.55*sign,vy:-this.speed*.84,trail:[]});}}
  }
  finish(won:boolean){this.phase=won?'won':'lost';if(won)this.score+=this.lives*500;this.tone(won?880:150,.6,'triangle');this.publish();this.onFinish(this.snapshot());}
  // Substeps keep fast balls from tunneling through thin bricks or the paddle.
  update(dt:number){
    const active=this.phase==='playing'||this.phase==='ready';
    if(active){
      const direction=(this.keys.has('ArrowRight')||this.keys.has('d')?1:0)-(this.keys.has('ArrowLeft')||this.keys.has('a')?1:0);
      if(direction)this.target=this.paddle+direction*650*dt;
      this.paddleWidth=this.wide>0?166:112;
      this.target=Math.max(this.paddleWidth/2+14,Math.min(W-this.paddleWidth/2-14,this.target));
      this.paddle+= (this.target-this.paddle)*Math.min(1,dt*24);
    }
    if(this.phase==='ready'){this.dock();return;}
    if(this.phase!=='playing')return;
    this.elapsed+=dt;this.wide=Math.max(0,this.wide-dt);this.slow=Math.max(0,this.slow-dt);this.hitFlash=Math.max(0,this.hitFlash-dt);
    for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=150*dt;p.life-=dt;}this.particles=this.particles.filter(p=>p.life>0);
    for(const d of this.drops){d.y+=115*dt;if(d.y>H-47&&d.y<H-15&&Math.abs(d.x-this.paddle)<this.paddleWidth/2+10){this.power(d.type);d.y=H+50;}}
    this.drops=this.drops.filter(d=>d.y<H+20);
    const steps=Math.ceil(dt/.005),step=dt/steps;
    for(const ball of this.balls){
      ball.trail.unshift({x:ball.x,y:ball.y});if(ball.trail.length>9)ball.trail.pop();
      for(let i=0;i<steps;i++){
        const prevX=ball.x,prevY=ball.y,factor=this.slow>0?.68:1;
        ball.x+=ball.vx*step*factor;ball.y+=ball.vy*step*factor;
        if(ball.x<16){ball.x=16;ball.vx=Math.abs(ball.vx);this.tone(230,.03);}
        if(ball.x>W-16){ball.x=W-16;ball.vx=-Math.abs(ball.vx);this.tone(230,.03);}
        if(ball.y<14){ball.y=14;ball.vy=Math.abs(ball.vy);}
        if(ball.vy>0&&ball.y+6>=H-35&&prevY+6<=H-27&&Math.abs(ball.x-this.paddle)<this.paddleWidth/2+6){
          const angle=Math.max(-1,Math.min(1,(ball.x-this.paddle)/(this.paddleWidth/2)))*1.06;
          const speed=this.speed+Math.min(85,this.combo*3);
          ball.vx=Math.sin(angle)*speed;
          // A tiny minimum angle prevents an endless vertical bounce in a brick gap.
          if(Math.abs(ball.vx)<55)ball.vx=55*(ball.vx<0?-1:1);
          ball.vy=-Math.sqrt(speed*speed-ball.vx*ball.vx);ball.y=H-42;this.combo=0;this.tone(390,.065,'triangle');this.burst(ball.x,H-35,'#bcf566',5);
        }
        for(const b of this.bricks){
          if(!b.alive||ball.x+6<b.x||ball.x-6>b.x+BW||ball.y+6<b.y||ball.y-6>b.y+BH)continue;
          if(prevY+6<=b.y||prevY-6>=b.y+BH){ball.vy=-ball.vy;ball.y=prevY;}else{ball.vx=-ball.vx;ball.x=prevX;}
          b.hp--;this.combo++;this.score+=25;
          if(b.hp<=0){b.alive=false;this.score+=75+Math.min(this.combo-1,9)*10;this.burst(b.x+BW/2,b.y+BH/2,b.color);
            if(Math.random()<.17)this.drops.push({x:b.x+BW/2,y:b.y+BH/2,type:(['wide','multi','slow'] as Power[])[Math.floor(Math.random()*3)]});
          }else this.burst(ball.x,ball.y,b.color,5);
          this.tone(450+Math.min(this.combo,12)*65,.065,'triangle');break;
        }
      }
    }
    this.balls=this.balls.filter(b=>b.y<H+15);
    if(this.bricks.every(b=>!b.alive)){this.burst(W/2,H/2,'#bcf566',50);if(this.stage===5)this.finish(true);else{this.phase='stage';this.score+=250*this.stage;this.tone(880,.4);this.publish();}return;}
    if(!this.balls.length){this.lives--;this.combo=0;this.wide=0;this.slow=0;this.drops=[];this.hitFlash=.4;this.tone(130,.3,'sawtooth',.025);if(this.lives<=0)this.finish(false);else{this.phase='ready';this.dock();this.publish();}}
  }
  loop=(time:number)=>{if(this.disposed)return;const dt=this.last?Math.min((time-this.last)/1000,.035):0;this.last=time;this.update(dt);this.draw(time);if(time-this.lastPublish>100){this.publish();this.lastPublish=time;}this.frame=requestAnimationFrame(this.loop);};
  draw(time:number){
    const c=this.ctx;c.clearRect(0,0,W,H);c.fillStyle='#0c1212';c.fillRect(0,0,W,H);
    const bg=c.createRadialGradient(450,160,10,450,200,550);bg.addColorStop(0,'#14221b');bg.addColorStop(1,'#0b1011');c.fillStyle=bg;c.fillRect(0,0,W,H);
    c.lineWidth=.6;c.strokeStyle='#baf66b08';for(let x=0;x<W;x+=30){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}for(let y=0;y<H;y+=30){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}
    c.strokeStyle='#40513a55';c.setLineDash([3,7]);c.beginPath();c.moveTo(24,H-74);c.lineTo(W-24,H-74);c.stroke();c.setLineDash([]);
    for(const b of this.bricks){if(!b.alive)continue;c.save();c.shadowColor=b.color;c.shadowBlur=8;c.globalAlpha=this.phase==='start'?.62:.88;c.fillStyle=b.color;c.beginPath();c.roundRect(b.x,b.y,BW,BH,3);c.fill();c.shadowBlur=0;c.fillStyle='#ffffff35';c.fillRect(b.x+3,b.y+2,BW-6,2);if(b.hp>1){c.fillStyle='#10191788';for(let j=0;j<b.hp;j++)c.fillRect(b.x+BW/2-6+(j*5),b.y+8,3,4);}c.restore();}
    for(const p of this.particles){c.globalAlpha=Math.min(1,p.life*2);c.fillStyle=p.color;c.fillRect(p.x,p.y,3,3);}c.globalAlpha=1;
    for(const d of this.drops){const color=d.type==='wide'?'#bcf566':d.type==='multi'?'#bc99ff':'#66dbea';c.fillStyle='#15221e';c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=12;c.beginPath();c.roundRect(d.x-13,d.y-12,26,24,5);c.fill();c.stroke();c.shadowBlur=0;c.fillStyle=color;c.font='bold 15px monospace';c.textAlign='center';c.fillText(d.type==='wide'?'↔':d.type==='multi'?'⁙':'ϟ',d.x,d.y+5);}
    const paddleX=this.phase==='start'?450:this.paddle;
    c.save();c.shadowColor='#bafa63';c.shadowBlur=18;c.fillStyle='#c1f779';c.beginPath();c.roundRect(paddleX-this.paddleWidth/2,H-35,this.paddleWidth,9,5);c.fill();c.shadowBlur=0;c.fillStyle='#e4ffbb';c.fillRect(paddleX-20,H-34,40,2);c.restore();
    for(const b of this.balls){for(let i=b.trail.length-1;i>=0;i--){c.globalAlpha=(1-i/9)*.18;c.fillStyle='#d6faa7';c.beginPath();c.arc(b.trail[i].x,b.trail[i].y,6-i*.45,0,Math.PI*2);c.fill();}c.globalAlpha=1;c.save();c.fillStyle='#ecffd8';c.shadowColor='#ccff98';c.shadowBlur=16;c.beginPath();c.arc(b.x,this.phase==='start'?H-90+Math.sin(time/900)*6:b.y,6,0,Math.PI*2);c.fill();c.restore();}
    c.fillStyle='#708174';c.font='9px monospace';c.textAlign='left';c.fillText('SECTOR '+String(this.stage).padStart(2,'0'),24,25);c.textAlign='right';c.fillText('NB–'+(1984+this.stage)+' / GRID ONLINE',W-24,25);
    if(this.hitFlash>0){c.fillStyle=`rgba(255,100,100,${this.hitFlash*.15})`;c.fillRect(0,0,W,H);}
  }
  destroy(){this.disposed=true;cancelAnimationFrame(this.frame);if(this.audio)void this.audio.close();}
}
