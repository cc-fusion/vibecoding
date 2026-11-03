// Synthesized WebAudio sound engine — no external assets
export class SoundEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  muted = false;
  volume = 0.7;
  ambientNodes: OscillatorNode[] = [];
  rainNode: AudioBufferSourceNode | null = null;

  ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setValueAtTime(m ? 0 : this.volume, this.ctx.currentTime);
  }
  setVolume(v: number) {
    this.volume = v;
    if (this.master && this.ctx && !this.muted) this.master.gain.setValueAtTime(v, this.ctx.currentTime);
  }
  private noiseBuffer(dur: number) {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  private playNoise(dur: number, freq: number, gain: number, type: BiquadFilterType = 'lowpass', sweep = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + sweep), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); src.stop(ctx.currentTime + dur);
  }
  private playTone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  breakBlock() { this.playNoise(0.18, 800, 0.35, 'lowpass', -500); this.playTone(120, 0.1, 0.15, 'triangle', -60); }
  placeBlock() { this.playNoise(0.08, 1200, 0.25, 'bandpass'); this.playTone(220, 0.06, 0.12, 'square', -80); }
  step() { this.playNoise(0.06, 500, 0.08, 'lowpass'); }
  hurt() { this.playTone(180, 0.2, 0.3, 'sawtooth', -100); this.playNoise(0.15, 600, 0.2); }
  splash() { this.playNoise(0.35, 900, 0.3, 'bandpass', -400); }
  eat() { this.playNoise(0.12, 700, 0.2, 'lowpass'); setTimeout(() => this.playNoise(0.12, 600, 0.18, 'lowpass'), 140); }
  levelup() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.playTone(f, 0.25, 0.18, 'sine'), i * 90)); }
  pickup() { this.playTone(880, 0.08, 0.12, 'sine', 220); }
  explode() { this.playNoise(0.7, 300, 0.6, 'lowpass', -200); this.playTone(60, 0.6, 0.4, 'sine', -30); }
  click() { this.playTone(600, 0.05, 0.1, 'square'); }
  craft() { this.playTone(440, 0.08, 0.12, 'triangle'); setTimeout(() => this.playTone(660, 0.1, 0.12, 'triangle'), 80); }
  zombieHit() { this.playTone(140, 0.15, 0.2, 'sawtooth', -60); }
  bowShoot() { this.playNoise(0.12, 2000, 0.2, 'highpass'); }
  door() { this.playTone(300, 0.15, 0.1, 'triangle', -150); }
  rainStart() {
    if (!this.ctx || !this.master || this.rainNode) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(); this.rainNode = src;
  }
  rainStop() { try { this.rainNode?.stop(); } catch { /* noop */ } this.rainNode = null; }
  startAmbient() {
    if (!this.ctx || this.ambientNodes.length) return;
    // gentle wind: filtered noise loop via oscillator LFO on gain — simplified: periodic bird chirps handled by engine timer
  }
  birdChirp() {
    if (!this.ctx || this.muted) return;
    const base = 1800 + Math.random() * 1200;
    for (let i = 0; i < 3; i++) setTimeout(() => this.playTone(base + Math.random() * 400, 0.08, 0.05, 'sine', 300), i * 110);
  }
  thunder() { this.playNoise(1.2, 200, 0.5, 'lowpass', -120); setTimeout(() => this.playNoise(0.8, 150, 0.35, 'lowpass'), 200); }
}
