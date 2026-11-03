// Procedural WebAudio sound engine — no assets required.
type Mat = 'stone' | 'wood' | 'grass' | 'sand' | 'glass' | 'snow';

export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  noiseBuf!: AudioBuffer;
  rainGain: GainNode | null = null;
  windGain: GainNode | null = null;
  musicTimer = 0;
  volume = 0.7;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.rainGain = this.loopNoise(800, 0.0, 'lowpass');
    this.windGain = this.loopNoise(300, 0.0, 'bandpass');
  }
  setVolume(v: number) { this.volume = v; if (this.ctx) this.master.gain.value = v; }

  private loopNoise(freq: number, vol: number, type: BiquadFilterType) {
    const c = this.ctx!;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain(); g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master); src.start();
    return g;
  }
  setAmbient(rain: number, wind: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain?.gain.setTargetAtTime(rain * 0.22, t, 0.5);
    this.windGain?.gain.setTargetAtTime(wind * 0.08, t, 0.8);
  }

  private noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const p = c.createStereoPanner(); p.pan.value = pan;
    src.connect(f).connect(g).connect(p).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }
  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }

  private matParams(m: Mat): [number, number, BiquadFilterType] {
    switch (m) {
      case 'stone': return [1400, 1.2, 'bandpass'];
      case 'wood': return [600, 3, 'bandpass'];
      case 'grass': return [2500, 0.6, 'highpass'];
      case 'sand': return [3500, 0.5, 'highpass'];
      case 'snow': return [1800, 0.8, 'bandpass'];
      case 'glass': return [4000, 6, 'bandpass'];
    }
  }
  dig(m: Mat) { const [f, q, t] = this.matParams(m); this.noise(0.09, f * (0.9 + Math.random() * 0.2), q, 0.35, t); }
  breakBlock(m: Mat) {
    const [f, q, t] = this.matParams(m);
    this.noise(0.25, f * 0.8, q, 0.6, t);
    if (m === 'glass') { for (let i = 0; i < 4; i++) this.tone(2000 + Math.random() * 3000, 0.15, 0.06, 'triangle', 0, i * 0.03); }
    if (m === 'wood') this.tone(140, 0.12, 0.15, 'triangle', -40);
  }
  place(m: Mat) { const [f, q, t] = this.matParams(m); this.noise(0.12, f * 0.7, q, 0.5, t); this.tone(m === 'wood' ? 180 : 110, 0.07, 0.12, 'triangle'); }
  step(m: Mat) { const [f, q, t] = this.matParams(m); this.noise(0.07, f * (0.7 + Math.random() * 0.3), q, 0.12, t, (Math.random() - 0.5) * 0.4); }
  splash() { this.noise(0.5, 900, 0.7, 0.4, 'lowpass'); }
  swim() { this.noise(0.25, 600, 0.8, 0.12, 'lowpass'); }
  hurt() { this.tone(220, 0.18, 0.35, 'square', -120); this.noise(0.1, 800, 1, 0.3); }
  eat() { for (let i = 0; i < 3; i++) setTimeout(() => this.noise(0.08, 1200 + Math.random() * 800, 1.5, 0.3), i * 140); }
  burp() { this.tone(120, 0.3, 0.25, 'sawtooth', -50); }
  pickup() { this.tone(900 + Math.random() * 400, 0.08, 0.12, 'sine', 600); }
  craft() { this.tone(520, 0.08, 0.15, 'triangle'); this.tone(780, 0.12, 0.15, 'triangle', 0, 0.07); }
  click() { this.tone(700, 0.04, 0.1, 'square'); }
  hit() { this.noise(0.12, 500, 1, 0.5, 'lowpass'); this.tone(160, 0.1, 0.2, 'square', -60); }
  pig() { this.tone(300 + Math.random() * 60, 0.25, 0.12, 'sawtooth', -120); this.tone(320, 0.18, 0.08, 'square', -80, 0.12); }
  cow() { this.tone(140, 0.6, 0.12, 'sawtooth', -40); }
  sheep() { this.tone(400, 0.4, 0.08, 'sawtooth', 20); this.tone(390, 0.3, 0.05, 'triangle', -20, 0.1); }
  zombie() { this.tone(90 + Math.random() * 20, 0.7, 0.15, 'sawtooth', -30); this.noise(0.5, 300, 2, 0.08); }
  thunder() {
    if (!this.ctx) return;
    this.noise(2.5, 120, 0.5, 0.9, 'lowpass');
    setTimeout(() => this.noise(1.8, 80, 0.5, 0.6, 'lowpass'), 300);
  }
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 0.12, 'triangle', 0, i * 0.09)); }

  // Gentle generative ambient music: sparse pentatonic notes
  tickMusic(dt: number, night: boolean) {
    if (!this.ctx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 2.5 + Math.random() * 5;
    const scale = night ? [220, 261.6, 293.7, 349.2, 392, 440] : [261.6, 293.7, 329.6, 392, 440, 523.3];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 0.5 : 1);
      this.tone(f, 2.8, 0.035, 'sine', 0, i * 0.45);
      this.tone(f * 2, 1.6, 0.01, 'triangle', 0, i * 0.45);
    }
  }
}
export const audio = new Audio();
