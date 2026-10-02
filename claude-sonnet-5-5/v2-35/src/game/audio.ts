// Fully synthesized audio: SFX + reactive generative music (Web Audio API only).
export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

type OscType = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  settings: AudioSettings = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private playing = false;
  intensity = 0.25;
  private curIntensity = 0.25;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applySettings();
    } catch {
      this.ctx = null;
    }
  }

  setSettings(s: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...s };
    this.applySettings();
  }

  private applySettings() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.settings;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.03);
    this.musicGain.gain.setTargetAtTime(s.music * 0.6, t, 0.03);
    this.sfxGain.gain.setTargetAtTime(s.sfx, t, 0.03);
  }

  private tone(freq: number, dur: number, type: OscType, vol: number, delay = 0, slideTo?: number, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType, delay = 0, sweepTo?: number, dest?: AudioNode) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  sfx(name: string) {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.04) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'click':
        this.tone(660, 0.07, 'square', 0.08);
        break;
      case 'select':
        this.tone(520, 0.08, 'triangle', 0.18);
        this.tone(780, 0.1, 'triangle', 0.14, 0.05);
        break;
      case 'move':
        this.noise(0.08, 0.12, 500, 'bandpass');
        this.tone(140, 0.07, 'sine', 0.15);
        break;
      case 'hit':
        this.noise(0.14, 0.4, 1800, 'lowpass', 0, 300);
        this.tone(160, 0.14, 'square', 0.25, 0, 60);
        break;
      case 'crit':
        this.noise(0.25, 0.5, 3000, 'lowpass', 0, 200);
        this.tone(220, 0.25, 'sawtooth', 0.3, 0, 50);
        this.tone(880, 0.1, 'square', 0.12, 0.02);
        break;
      case 'shot':
        this.noise(0.12, 0.25, 4000, 'highpass', 0, 1500);
        this.tone(900, 0.14, 'triangle', 0.15, 0, 300);
        break;
      case 'counter':
        this.noise(0.1, 0.25, 1500, 'lowpass', 0, 300);
        this.tone(300, 0.08, 'square', 0.12, 0, 120);
        break;
      case 'heal':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'sine', 0.16, i * 0.07));
        break;
      case 'death':
        this.tone(300, 0.5, 'sawtooth', 0.22, 0, 40);
        this.noise(0.4, 0.3, 900, 'lowpass', 0, 100);
        break;
      case 'collapse':
        this.noise(0.9, 0.7, 600, 'lowpass', 0, 60);
        this.tone(70, 0.8, 'sine', 0.5, 0, 28);
        this.tone(45, 1.0, 'triangle', 0.3, 0.05, 25);
        break;
      case 'flood':
        this.noise(1.0, 0.35, 400, 'bandpass', 0, 1800);
        this.tone(200, 0.6, 'sine', 0.1, 0.1, 380);
        break;
      case 'ignite':
        this.noise(0.5, 0.35, 1200, 'highpass', 0, 3500);
        this.tone(120, 0.4, 'sawtooth', 0.12, 0, 260);
        break;
      case 'fire':
        for (let i = 0; i < 4; i++) this.noise(0.06, 0.15, 3000 + Math.random() * 2000, 'highpass', i * 0.09);
        break;
      case 'warn':
        this.tone(440, 0.12, 'square', 0.1);
        this.tone(330, 0.16, 'square', 0.1, 0.12);
        break;
      case 'shore':
        this.tone(220, 0.1, 'square', 0.2);
        this.tone(330, 0.1, 'square', 0.2, 0.08);
        this.noise(0.2, 0.25, 800, 'bandpass', 0.05);
        this.tone(660, 0.25, 'triangle', 0.15, 0.16);
        break;
      case 'shove':
        this.noise(0.15, 0.4, 700, 'lowpass', 0, 200);
        this.tone(100, 0.2, 'sine', 0.4, 0, 50);
        break;
      case 'splash':
        this.noise(0.5, 0.45, 2500, 'bandpass', 0, 400);
        break;
      case 'levelup':
        [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, i * 0.09));
        break;
      case 'endturn':
        this.tone(196, 0.35, 'sawtooth', 0.12, 0, 180);
        this.tone(294, 0.35, 'sawtooth', 0.1, 0.02, 280);
        break;
      case 'enemyphase':
        this.tone(110, 0.5, 'sawtooth', 0.2, 0, 90);
        this.noise(0.4, 0.15, 300, 'lowpass');
        break;
      case 'newround':
        this.tone(392, 0.2, 'triangle', 0.2);
        this.tone(587, 0.3, 'triangle', 0.2, 0.12);
        break;
      case 'depot':
        this.tone(440, 0.1, 'square', 0.14);
        this.tone(554, 0.1, 'square', 0.14, 0.09);
        this.tone(659, 0.2, 'square', 0.14, 0.18);
        break;
      case 'coin':
        this.tone(988, 0.08, 'square', 0.1);
        this.tone(1319, 0.2, 'square', 0.1, 0.07);
        break;
      case 'error':
        this.tone(130, 0.18, 'square', 0.15, 0, 90);
        break;
      case 'victory':
        [392, 392, 392, 523, 659, 784, 1047].forEach((f, i) => this.tone(f, i > 3 ? 0.5 : 0.2, 'triangle', 0.22, i * 0.15));
        [196, 261, 329, 392].forEach((f, i) => this.tone(f, 1.0, 'sine', 0.2, 0.6 + i * 0.05));
        break;
      case 'defeat':
        [392, 349, 311, 261, 196].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.14, i * 0.3, f * 0.9));
        break;
      case 'boss':
        this.tone(55, 1.4, 'sawtooth', 0.3, 0, 40);
        this.noise(1.2, 0.3, 200, 'lowpass', 0, 80);
        this.tone(82, 1.4, 'square', 0.1, 0.1, 60);
        break;
    }
  }

  // ---- Music ----
  private chords = [
    [50, 53, 57], // Dm
    [46, 50, 53], // Bb
    [43, 46, 50], // Gm
    [45, 49, 52], // A
    [50, 53, 57],
    [46, 50, 53],
    [48, 52, 55], // C
    [45, 49, 52],
  ];

  private mtof(m: number) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stopMusic() {
    this.playing = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    if (!this.ctx || !this.playing) return;
    if (this.ctx.state !== 'running') return;
    const stepDur = 60 / 86 / 2;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.curIntensity += (this.intensity - this.curIntensity) * 0.08;
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private mtone(freq: number, t: number, dur: number, type: OscType, vol: number, cutoff?: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.08, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last: AudioNode = o;
    if (cutoff) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f);
      last = f;
    }
    last.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private playStep(step: number, t: number, sd: number) {
    const I = this.curIntensity;
    const bar = Math.floor(step / 8) % this.chords.length;
    const s = step % 8;
    const chord = this.chords[bar];
    if (s === 0) {
      chord.forEach((n, i) => {
        this.mtone(this.mtof(n + 12), t, sd * 8.2, 'sawtooth', 0.05 + i * 0.004, 500 + I * 700);
        this.mtone(this.mtof(n + 24), t, sd * 8.2, 'triangle', 0.025);
      });
    }
    if (I > 0.28 && (s === 0 || s === 4 || (I > 0.7 && s === 6))) {
      this.mtone(this.mtof(chord[0] - 12), t, sd * 3.5, 'triangle', 0.16, 400);
    }
    if (I > 0.45) {
      const n = chord[(s * 2 + (bar % 2)) % 3] + 24 + (s % 4 === 3 ? 12 : 0);
      if (s % 2 === 0 || I > 0.7) this.mtone(this.mtof(n), t, sd * 1.5, 'triangle', 0.045 + (I - 0.4) * 0.04);
    }
    if (I > 0.35 && (s === 0 || s === 4)) {
      this.tone(110, 0.18, 'sine', 0.22 * Math.min(1, I + 0.2), t - (this.ctx?.currentTime || 0), 40, this.musicGain);
    }
    if (I > 0.6 && s % 2 === 1) {
      this.noise(0.05, 0.05 + (I - 0.5) * 0.06, 7000, 'highpass', t - (this.ctx?.currentTime || 0), undefined, this.musicGain);
    }
    if (I > 0.8 && (s === 2 || s === 6)) {
      this.tone(80, 0.2, 'triangle', 0.2, t - (this.ctx?.currentTime || 0), 50, this.musicGain);
    }
    if (I < 0.4 && s === 4 && bar % 2 === 0) {
      this.mtone(this.mtof(chord[2] + 36), t, sd * 4, 'sine', 0.03);
    }
  }
}

export const audio = new AudioEngine();
