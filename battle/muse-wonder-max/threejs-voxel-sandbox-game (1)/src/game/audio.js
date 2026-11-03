// Procedural WebAudio: no external files needed
export class GameAudio {
  constructor(){ this.ctx=null; this.master=null; this.enabled=true; this.ambientNodes=[]; }
  init(){
    if(this.ctx) { if(this.ctx.state==='suspended') this.ctx.resume(); return; }
    try{
      this.ctx=new (window.AudioContext||window.webkitAudioContext)();
      this.master=this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination);
      this.startAmbient();
    }catch(e){}
  }
  setEnabled(v){ this.enabled=v; if(this.master) this.master.gain.value=v?0.5:0; }
  tone(freq, dur=0.12, type='square', vol=0.2, slide=0){
    if(!this.ctx||!this.enabled) return;
    const t=this.ctx.currentTime; const o=this.ctx.createOscillator(); const g=this.ctx.createGain();
    o.type=type; o.frequency.setValueAtTime(freq,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,freq+slide), t+dur);
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur);
  }
  noise(dur=0.15, vol=0.25, freq=800){
    if(!this.ctx||!this.enabled) return;
    const t=this.ctx.currentTime; const len=this.ctx.sampleRate*dur; const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
    const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*(1-i/len);
    const src=this.ctx.createBufferSource(); src.buffer=buf;
    const f=this.ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq;
    const g=this.ctx.createGain(); g.gain.value=vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
  }
  breakBlock(){ this.noise(0.12,0.3,500+Math.random()*400); this.tone(90,0.08,'triangle',0.15,-40); }
  place(){ this.tone(220,0.07,'square',0.12,80); this.noise(0.05,0.1,1200); }
  pop(){ this.tone(520,0.08,'sine',0.18,240); }
  hurt(){ this.tone(160,0.18,'sawtooth',0.2,-60); }
  eat(){ this.noise(0.1,0.2,400); setTimeout(()=>this.noise(0.1,0.18,350),110); }
  level(){ [440,554,659,880].forEach((f,i)=>setTimeout(()=>this.tone(f,0.22,'sine',0.16),i*90)); }
  craft(){ this.tone(660,0.09,'sine',0.15,120); this.tone(880,0.12,'sine',0.12,60); }
  splash(){ this.noise(0.3,0.2,700); }
  startAmbient(){
    if(!this.ctx) return;
    // gentle wind: filtered looping noise, very quiet
    const len=this.ctx.sampleRate*2; const buf=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
    const d=buf.getChannelData(0); let last=0; for(let i=0;i<len;i++){ const w=Math.random()*2-1; last=(last+0.02*w)/1.02; d[i]=last*3; }
    const src=this.ctx.createBufferSource(); src.buffer=buf; src.loop=true;
    const f=this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=400;
    const g=this.ctx.createGain(); g.gain.value=0.035;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    this.ambientNodes=[src,g];
  }
  bird(){ if(Math.random()<0.5) return; const f=1800+Math.random()*800; this.tone(f,0.09,'sine',0.04,300); setTimeout(()=>this.tone(f+200,0.08,'sine',0.035,200),130); }
}
