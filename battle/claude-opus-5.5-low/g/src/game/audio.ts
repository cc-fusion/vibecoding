import type { SoundKind } from './blocks';

/** Procedural WebAudio sound engine – no asset files required. */
export class Audio {
  ctx: AudioContext | null = null;
  master!: GainNode;
  noiseBuf!: AudioBuffer;
  rainGain: GainNode | null = null;
  windGain: GainNode | null = null;
  volume = 0.6;
  musicTimer = 0;

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
    // ambient loops
    this.rainGain = this.loopNoise('highpass', 900, 0);
    this.windGain = this.loopNoise('lowpass', 400, 0.02);
  }
  setVolume(v: number) { this.volume = v; if (this.ctx) this.master.gain.value = v; }

  private loopNoise(type: BiquadFilterType, freq: number, vol: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
    return g;
  }
  setAmbience(rain: number, wind: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.rainGain?.gain.setTargetAtTime(rain * 0.18, t, 0.5);
    this.windGain?.gain.setTargetAtTime(0.01 + wind * 0.04, t, 0.5);
  }

  private noise(dur: number, freq: number, q: number, vol: number, type: BiquadFilterType = 'bandpass', pan = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    src.connect(f); f.connect(g); g.connect(p); p.connect(this.master);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  private tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', slide = 0, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  private matParams(kind: SoundKind): [number, number] {
    switch (kind) {
      case 'stone': return [700, 1.2];
      case 'wood': return [380, 3];
      case 'grass': return [2200, 0.6];
      case 'sand': return [3200, 0.4];
      case 'glass': return [4200, 6];
      case 'snow': return [1600, 0.5];
    }
  }
  dig(kind: SoundKind) { const [f, q] = this.matParams(kind); this.noise(0.08, f, q, 0.25); }
  breakBlock(kind: SoundKind) {
    const [f, q] = this.matParams(kind); this.noise(0.25, f, q, 0.6); this.noise(0.15, f * 0.6, q, 0.4);
    if (kind === 'glass') { this.tone(2400, 0.2, 0.1, 'triangle', 800); this.tone(3100, 0.25, 0.08, 'triangle', -600, 0.04); }
  }
  place(kind: SoundKind) { const [f, q] = this.matParams(kind); this.noise(0.12, f * 0.8, q, 0.5); }
  step(kind: SoundKind) { const [f, q] = this.matParams(kind); this.noise(0.09, f, q, 0.12, 'bandpass', (Math.random() - 0.5) * 0.3); }
  pickup() { this.tone(900 + Math.random() * 400, 0.08, 0.12, 'sine', 600); }
  hurt() { this.tone(220, 0.18, 0.3, 'square', -120); this.noise(0.1, 800, 1, 0.2); }
  mobHurt(pitch = 1) { this.tone(300 * pitch, 0.15, 0.2, 'sawtooth', -150); }
  pig() { this.tone(330, 0.12, 0.12, 'sawtooth', -80); this.tone(280, 0.14, 0.1, 'sawtooth', -60, 0.15); }
  sheep() { this.tone(500, 0.35, 0.08, 'triangle', -40); }
  zombie() { this.tone(110, 0.6, 0.12, 'sawtooth', -30); this.noise(0.5, 300, 2, 0.08); }
  eat() { for (let i = 0; i < 3; i++) setTimeout(() => this.noise(0.08, 1500, 1, 0.3), i * 120); }
  splash() { this.noise(0.4, 1200, 0.5, 0.4, 'lowpass'); }
  explode() { this.noise(1.4, 200, 0.4, 1.2, 'lowpass'); this.tone(60, 0.8, 0.5, 'sine', -40); }
  fuse() { this.noise(2.5, 5000, 0.5, 0.15, 'highpass'); }
  click() { this.tone(1200, 0.04, 0.08, 'square'); }
  achievement() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 0.12, 'triangle', 0, i * 0.09)); }
  levelUp() { this.tone(660, 0.15, 0.1, 'triangle', 200); }
  thunder() { this.noise(3, 120, 0.3, 1.0, 'lowpass'); }
  toolBreak() { this.tone(1800, 0.2, 0.15, 'square', -1200); this.noise(0.2, 3000, 2, 0.3); }
  /** Sparse ambient generative music: soft pentatonic notes */
  music(dt: number, night: boolean) {
    if (!this.ctx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 2 + Math.random() * 5;
    if (Math.random() < 0.35) return;
    const scale = night ? [220, 261.6, 293.7, 329.6, 392] : [261.6, 293.7, 329.6, 392, 440, 523.3];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 2 : 1);
      this.tone(f, 2.5, 0.035, 'sine', 0, i * 0.6);
      this.tone(f * 2, 1.8, 0.01, 'triangle', 0, i * 0.6);
    }
  }
}
