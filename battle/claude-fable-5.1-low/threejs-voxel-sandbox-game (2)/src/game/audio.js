// Procedural WebAudio sound effects + ambience (no external assets)
export class AudioSys {
  constructor() {
    this.ctx = null; this.master = null; this.volume = 0.6; this.ambGain = null; this.rainGain = null;
    this.lastStep = 0;
  }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
    // noise buffer
    const len = this.ctx.sampleRate * 2; const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // wind ambience
    const wind = this.ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
    const wf = this.ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 300;
    this.ambGain = this.ctx.createGain(); this.ambGain.gain.value = 0.03;
    wind.connect(wf); wf.connect(this.ambGain); this.ambGain.connect(this.master); wind.start();
    this.windLfo = this.ctx.createOscillator(); this.windLfo.frequency.value = 0.08;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 150; this.windLfo.connect(lfoG); lfoG.connect(wf.frequency); this.windLfo.start();
    // rain
    const rain = this.ctx.createBufferSource(); rain.buffer = buf; rain.loop = true;
    const rf = this.ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 1200;
    this.rainGain = this.ctx.createGain(); this.rainGain.gain.value = 0;
    rain.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.master); rain.start();
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setRain(level) { if (this.rainGain) this.rainGain.gain.setTargetAtTime(level * 0.12, this.ctx.currentTime, 0.5); }
  setUnderwater(u) { if (this.ambGain) this.ambGain.gain.setTargetAtTime(u ? 0.0 : 0.03, this.ctx.currentTime, 0.3); }

  _env(gainNode, t, a, d, peak = 1) { const g = gainNode.gain; g.cancelScheduledValues(t); g.setValueAtTime(0.0001, t); g.linearRampToValueAtTime(peak, t + a); g.exponentialRampToValueAtTime(0.0001, t + a + d); }
  tone(freq, dur, type = 'square', vol = 0.2, slide = 0) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = this.ctx.createGain(); this._env(g, t, 0.005, dur, vol); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  burst(dur, freq, q, vol = 0.3, type = 'bandpass') {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.5 + Math.random();
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain(); this._env(g, t, 0.003, dur, vol);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  // material-aware block sounds
  blockSound(kind, id) {
    const m = materialOf(id);
    const v = kind === 'break' ? 0.5 : kind === 'place' ? 0.35 : 0.14;
    switch (m) {
      case 'stone': this.burst(kind === 'hit' ? 0.05 : 0.12, 900, 1.5, v); if (kind !== 'hit') this.tone(180, 0.08, 'triangle', v * 0.4, -100); break;
      case 'wood': this.burst(0.08, 500, 2, v); this.tone(220, 0.06, 'triangle', v * 0.5, -80); break;
      case 'grass': this.burst(0.1, 1200, 0.8, v * 0.9, 'lowpass'); break;
      case 'sand': this.burst(0.12, 2500, 0.6, v * 0.7, 'highpass'); break;
      case 'leaves': this.burst(0.09, 3000, 0.5, v * 0.6, 'highpass'); break;
      case 'glass': this.burst(0.15, 4000, 3, v); this.tone(1800, 0.1, 'sine', v * 0.3, -600); break;
      case 'wool': this.burst(0.1, 600, 0.7, v * 0.6, 'lowpass'); break;
      default: this.burst(0.1, 1000, 1, v);
    }
  }
  step(id, running) {
    if (!this.ctx) return; const now = performance.now();
    if (now - this.lastStep < (running ? 300 : 420)) return; this.lastStep = now;
    this.blockSound('hit', id);
  }
  pickup() { this.tone(900 + Math.random() * 300, 0.08, 'sine', 0.15, 600); setTimeout(() => this.tone(1400, 0.1, 'sine', 0.12, 300), 40); }
  hurt() { this.tone(200, 0.18, 'sawtooth', 0.3, -120); this.burst(0.15, 400, 1, 0.3); }
  eat() { this.burst(0.08, 800, 1, 0.2); setTimeout(() => this.burst(0.08, 700, 1, 0.2), 140); setTimeout(() => this.burst(0.08, 900, 1, 0.2), 280); }
  craft() { this.tone(500, 0.08, 'square', 0.1); setTimeout(() => this.tone(750, 0.1, 'square', 0.1), 70); }
  click() { this.tone(1200, 0.03, 'square', 0.06); }
  splash() { this.burst(0.3, 1500, 0.5, 0.35, 'lowpass'); }
  swing() { this.burst(0.08, 600, 0.3, 0.08, 'lowpass'); }
  hitMob() { this.burst(0.1, 300, 1, 0.3, 'lowpass'); this.tone(150, 0.1, 'triangle', 0.2, -60); }
  mob(kind) {
    if (!this.ctx) return;
    if (kind === 'pig') { this.tone(300, 0.15, 'sawtooth', 0.08, 120); setTimeout(() => this.tone(260, 0.12, 'sawtooth', 0.08, -60), 150); }
    else if (kind === 'sheep') { this.tone(440, 0.35, 'sawtooth', 0.06, -40); }
    else if (kind === 'chicken') { this.tone(900, 0.08, 'square', 0.04, 200); setTimeout(() => this.tone(1000, 0.08, 'square', 0.04, 150), 120); }
    else if (kind === 'zombie') { this.tone(120, 0.5, 'sawtooth', 0.12, -40); this.burst(0.4, 300, 0.7, 0.1, 'lowpass'); }
    else if (kind === 'skeleton') { this.burst(0.06, 2000, 3, 0.1); setTimeout(() => this.burst(0.06, 2400, 3, 0.1), 90); }
  }
  thunder() { this.burst(1.6, 120, 0.5, 0.6, 'lowpass'); setTimeout(() => this.burst(1.0, 80, 0.5, 0.4, 'lowpass'), 300); }
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, 'triangle', 0.12), i * 90)); }
}

function materialOf(id) {
  const stone = [3, 4, 10, 11, 12, 13, 14, 21, 22, 23, 32, 40, 42, 29];
  const wood = [7, 9, 19, 27, 33, 41, 45, 46, 20, 43, 44];
  const grass = [1, 2, 35, 15, 24, 25, 26, 36, 37];
  const sand = [5, 16, 30];
  const leaves = [8, 28, 34, 17];
  if (stone.includes(id)) return 'stone'; if (wood.includes(id)) return 'wood'; if (grass.includes(id)) return 'grass';
  if (sand.includes(id)) return 'sand'; if (leaves.includes(id)) return 'leaves'; if (id === 18 || id === 31) return 'glass'; if (id === 38) return 'wool';
  return 'stone';
}
