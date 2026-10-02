type SfxName =
  | 'click' | 'select' | 'move' | 'hit' | 'kill' | 'beam' | 'lob' | 'pulse' | 'repel' | 'hole'
  | 'drift' | 'promote' | 'win' | 'lose' | 'turn' | 'error' | 'warn' | 'boom' | 'shock' | 'brace' | 'spawn' | 'buy';

export interface Volumes {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

const PROG = [
  { r: 110, t: [0, 3, 7, 12] },
  { r: 87.31, t: [0, 4, 7, 12] },
  { r: 130.81, t: [0, 4, 7, 11] },
  { r: 98, t: [0, 4, 7, 12] },
];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  delayIn!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  vol: Volumes = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  intensity = 0.2;
  musicOn = false;
  timer: number | null = null;
  nextT = 0;
  step = 0;
  lastSfx: Record<string, number> = {};

  init() {
    try {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(comp);
      comp.connect(ctx.destination);
      // spacey echo for the music
      this.delayIn = ctx.createGain();
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.36;
      const fb = ctx.createGain();
      fb.gain.value = 0.4;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      this.delayIn.connect(delay);
      delay.connect(lp);
      lp.connect(fb);
      fb.connect(delay);
      lp.connect(this.musicBus);
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.applyVol();
      if (this.musicOn) this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  suspend() {
    try {
      if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
    } catch { /* ignore */ }
  }
  resume() {
    try {
      if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* ignore */ }
  }

  setVolumes(v: Volumes) {
    this.vol = { ...v };
    this.applyVol();
  }
  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.8, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }
  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, when = 0, slide = 0, bus?: AudioNode, send = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(this.delayIn);
    }
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol = 0.2, freq = 1200, when = 0, type: BiquadFilterType = 'lowpass', bus?: AudioNode) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(Math.max(0.0002, vol), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  sfx(name: SfxName) {
    if (!this.ctx || this.vol.muted) return;
    const now = this.ctx.currentTime;
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.04) return; // anti-spam
    this.lastSfx[name] = now;
    switch (name) {
      case 'click': this.tone(660, 0.05, 'square', 0.06); break;
      case 'select': this.tone(520, 0.1, 'triangle', 0.14, 0, 820); break;
      case 'move': this.noise(0.14, 0.1, 900, 0, 'bandpass'); this.tone(200, 0.12, 'triangle', 0.12, 0, 340); break;
      case 'hit': this.noise(0.15, 0.3, 1800); this.tone(160, 0.15, 'square', 0.16, 0, 60); break;
      case 'kill': this.noise(0.4, 0.35, 1200); this.tone(110, 0.4, 'sawtooth', 0.2, 0, 30); this.tone(440, 0.2, 'square', 0.08, 0.02, 120); break;
      case 'beam': this.tone(1000, 0.25, 'sawtooth', 0.09, 0, 220); this.tone(1500, 0.2, 'sine', 0.06, 0, 400); break;
      case 'lob': this.tone(320, 0.25, 'triangle', 0.14, 0, 110); this.noise(0.1, 0.1, 600, 0.18); break;
      case 'pulse': this.tone(90, 0.55, 'sine', 0.3, 0, 700); this.tone(220, 0.55, 'triangle', 0.12, 0, 1500); break;
      case 'repel': this.tone(900, 0.5, 'sine', 0.22, 0, 90); this.noise(0.4, 0.1, 2400, 0, 'highpass'); break;
      case 'hole': this.tone(500, 0.9, 'sawtooth', 0.18, 0, 28); this.noise(0.7, 0.18, 300); break;
      case 'drift': this.noise(0.7, 0.22, 260); this.tone(62, 0.7, 'sine', 0.22, 0, 44); break;
      case 'brace': this.tone(110, 0.25, 'square', 0.14, 0, 70); this.tone(220, 0.2, 'triangle', 0.1); break;
      case 'spawn': this.tone(220, 0.3, 'triangle', 0.14, 0, 660); this.tone(330, 0.3, 'sine', 0.1, 0.08, 990); break;
      case 'buy': this.tone(880, 0.08, 'square', 0.08); this.tone(1320, 0.12, 'square', 0.08, 0.07); break;
      case 'promote': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.16, i * 0.09, 0, undefined, 0.2)); break;
      case 'win': [392, 523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.18, i * 0.13, 0, undefined, 0.3)); break;
      case 'lose': [440, 392, 330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.12, i * 0.2)); break;
      case 'turn': this.tone(587, 0.2, 'sine', 0.14); this.tone(880, 0.3, 'sine', 0.12, 0.1); break;
      case 'error': this.tone(130, 0.14, 'square', 0.12, 0, 90); break;
      case 'warn': this.tone(240, 0.15, 'square', 0.1); this.tone(240, 0.15, 'square', 0.1, 0.2); break;
      case 'boom': this.noise(0.8, 0.5, 700); this.tone(70, 0.8, 'sine', 0.4, 0, 25); break;
      case 'shock': this.noise(0.6, 0.35, 500); this.tone(50, 0.7, 'sine', 0.35, 0, 140); break;
    }
  }

  startMusic() {
    this.musicOn = true;
    if (!this.ctx || this.timer !== null) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.pump(), 90);
  }
  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') {
      if (ctx) this.nextT = Math.max(this.nextT, ctx.currentTime);
      return;
    }
    let guard = 0;
    while (this.nextT < ctx.currentTime + 0.35 && guard++ < 16) {
      this.schedule(this.step, this.nextT);
      const bpm = 74 + 46 * this.intensity;
      this.nextT += 60 / bpm / 2;
      this.step++;
    }
  }

  private schedule(step: number, t: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const I = this.intensity;
    const bpm = 74 + 46 * I;
    const sd = 60 / bpm / 2;
    const chord = PROG[Math.floor(step / 16) % PROG.length];
    const delay = Math.max(0, t - ctx.currentTime);
    const s16 = step % 16;
    if (s16 === 0) {
      // pad
      const dur = sd * 16;
      [0, 7, 12, chord.t[1]].forEach((semi, i) => {
        for (let k = 0; k < 2; k++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          const f = ctx.createBiquadFilter();
          o.type = i % 2 ? 'sawtooth' : 'triangle';
          o.frequency.value = chord.r * Math.pow(2, semi / 12) * 2 * (k ? 1.004 : 0.996);
          f.type = 'lowpass';
          f.frequency.value = 350 + 1300 * I;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.05, t + dur * 0.35);
          g.gain.linearRampToValueAtTime(0.0001, t + dur);
          o.connect(f);
          f.connect(g);
          g.connect(this.musicBus);
          o.start(t);
          o.stop(t + dur + 0.1);
        }
      });
    }
    const bassSteps = I > 0.4 ? [0, 3, 6, 8, 11, 14] : [0, 8];
    if (bassSteps.includes(s16)) this.tone(chord.r / 2, sd * 1.8, 'triangle', 0.2, delay, 0, this.musicBus);
    if (Math.random() < 0.22 + 0.5 * I && s16 % 2 === 0 || (I > 0.6 && Math.random() < 0.3)) {
      const semi = chord.t[Math.floor(Math.random() * chord.t.length)];
      const oct = Math.random() < 0.5 ? 4 : 2;
      this.tone(chord.r * Math.pow(2, semi / 12) * oct, sd * 2.2, 'triangle', 0.07 + 0.04 * I, delay, 0, this.musicBus, 0.5);
    }
    if (I > 0.5) {
      if (s16 === 0 || s16 === 8) this.tone(130, 0.18, 'sine', 0.35, delay, 40, this.musicBus);
      if (s16 % 2 === 1) this.noise(0.05, 0.05 + 0.04 * I, 7000, delay, 'highpass', this.musicBus);
    }
  }
}

export const audio = new AudioEngine();
