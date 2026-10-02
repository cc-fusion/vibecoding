export type Sfx =
  | 'click' | 'select' | 'order' | 'attach' | 'deliver' | 'sell' | 'buy' | 'hire' | 'error' | 'laser' | 'shot'
  | 'hit' | 'boom' | 'alarm' | 'win' | 'lose' | 'warn' | 'bid' | 'sector' | 'thunder' | 'level';

const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [48, 52, 55, 59],
  [55, 59, 62, 65],
];

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  intensity = 0;
  target = 0;
  private timer: number | null = null;
  private nextT = 0;
  private step = 0;
  private bar = 0;
  private musicOn = false;
  private last: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      this.master = c.createGain();
      this.sfxBus = c.createGain();
      this.musicBus = c.createGain();
      const comp = c.createDynamicsCompressor();
      this.sfxBus.connect(this.master);
      // music goes through a gentle echo for space
      const delay = c.createDelay(1);
      delay.delayTime.value = 0.375;
      const fb = c.createGain();
      fb.gain.value = 0.35;
      const wet = c.createGain();
      wet.gain.value = 0.4;
      this.musicBus.connect(this.master);
      this.musicBus.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(this.master);
      this.master.connect(comp);
      comp.connect(c.destination);
      const len = c.sampleRate;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.applyVol();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVol();
  }

  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.vol.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.03);
  }

  private tone(f: number, d: number, type: OscillatorType, v: number, slide = 0, delay = 0, bus?: GainNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + Math.min(0.01, d / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t);
    o.stop(t + d + 0.03);
  }

  private noise(d: number, v: number, freq: number, delay = 0, type: BiquadFilterType = 'lowpass', bus?: GainNode) {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, v), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f);
    f.connect(g);
    g.connect(bus || this.sfxBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + d + 0.03);
  }

  play(name: Sfx) {
    const c = this.ctx;
    if (!c || this.vol.muted) return;
    const now = c.currentTime;
    const gap = name === 'laser' || name === 'shot' || name === 'hit' ? 0.07 : 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'click': this.tone(900, 0.05, 'square', 0.06); break;
      case 'select': this.tone(660, 0.07, 'triangle', 0.12); this.tone(990, 0.07, 'triangle', 0.08, 0, 0.05); break;
      case 'order': this.tone(440, 0.09, 'square', 0.06, 1.6); break;
      case 'attach': this.tone(260, 0.3, 'sawtooth', 0.05, 2.4); this.noise(0.15, 0.05, 2400, 0, 'highpass'); break;
      case 'deliver': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.13, 0, i * 0.07)); break;
      case 'sell': this.tone(1200, 0.08, 'square', 0.06); this.tone(1800, 0.2, 'square', 0.06, 0, 0.07); break;
      case 'buy': this.tone(500, 0.1, 'triangle', 0.1); this.tone(750, 0.14, 'triangle', 0.1, 0, 0.08); break;
      case 'hire': [392, 494, 587].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.12, 0, i * 0.08)); break;
      case 'error': this.tone(150, 0.22, 'sawtooth', 0.1, 0.6); break;
      case 'laser': this.tone(1100, 0.13, 'sawtooth', 0.035, 0.3); break;
      case 'shot': this.tone(700, 0.1, 'square', 0.04, 0.4); this.noise(0.05, 0.03, 3000, 0, 'highpass'); break;
      case 'hit': this.noise(0.08, 0.08, 1800); break;
      case 'boom': this.noise(0.55, 0.22, 700); this.tone(90, 0.45, 'sine', 0.25, 0.3); break;
      case 'alarm': for (let i = 0; i < 4; i++) this.tone(i % 2 ? 660 : 880, 0.14, 'square', 0.07, 0, i * 0.16); break;
      case 'win': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.14, 0, i * 0.12)); break;
      case 'lose': [440, 392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.1, 0.9, i * 0.18)); break;
      case 'warn': this.tone(220, 0.3, 'sawtooth', 0.09, 0.8); break;
      case 'bid': this.tone(660, 0.06, 'square', 0.06); this.tone(880, 0.08, 'square', 0.06, 0, 0.07); break;
      case 'sector': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.13, 0, i * 0.1)); break;
      case 'thunder': this.noise(0.8, 0.18, 400); this.tone(55, 0.7, 'sine', 0.2, 0.5); break;
      case 'level': [659, 784, 988].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.12, 0, i * 0.06)); break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextT = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
    this.timer = window.setInterval(() => this.schedule(), 70);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  setIntensity(x: number) {
    this.target = Math.max(0, Math.min(1, x));
  }

  private schedule() {
    const c = this.ctx;
    if (!c || !this.musicOn) return;
    if (c.state === 'suspended') return;
    const sd = 60 / 84 / 4;
    this.intensity += (this.target - this.intensity) * 0.04;
    while (this.nextT < c.currentTime + 0.25) {
      this.note(this.nextT - c.currentTime, this.step, this.bar);
      this.nextT += sd;
      this.step++;
      if (this.step >= 16) {
        this.step = 0;
        this.bar = (this.bar + 1) % 4;
      }
    }
  }

  private note(delay: number, step: number, bar: number) {
    const ch = CHORDS[bar];
    const I = this.intensity;
    const mb = this.musicBus;
    if (step === 0) {
      ch.forEach((m, i) => this.tone(mf(m) * (i === 0 ? 0.5 : 1), 3.1, 'sawtooth', 0.016 + I * 0.006, 0, delay, mb));
      ch.forEach((m) => this.tone(mf(m) * 1.004, 3.1, 'triangle', 0.02, 0, delay, mb));
    }
    if (step === 0 || step === 6 || step === 10 || (I > 0.5 && step === 14)) this.tone(mf(ch[0] - 12), 0.45, 'sine', 0.13 + I * 0.05, 0.9, delay, mb);
    if (step % 2 === 0 && Math.random() < 0.3 + I * 0.45) {
      const m = ch[Math.floor(Math.random() * ch.length)] + (Math.random() < 0.5 ? 12 : 24);
      this.tone(mf(m), 0.28, 'triangle', 0.04, 0, delay, mb);
    }
    if (I > 0.28) {
      if (step === 0 || step === 8 || (I > 0.65 && (step === 4 || step === 12))) this.tone(130, 0.18, 'sine', 0.2, 0.3, delay, mb);
      if (step % 2 === 1) this.noise(0.04, 0.025 + I * 0.02, 7000, delay, 'highpass', mb);
    }
    if (I > 0.5 && (step === 4 || step === 12)) this.noise(0.12, 0.05, 2400, delay, 'bandpass', mb);
  }
}

export const audio = new AudioEngine();
