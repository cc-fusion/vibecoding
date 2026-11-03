// Synthesized Web Audio Sound Effects + Peaceful Ambient Piano/Marimba Soundscape

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.volume = 0.65;
    this.nextMusicTime = 8;
    this.rainGain = null;
  }

  ensureContext() {
    if (!this.enabled) return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.noiseBuffer = this.buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx.state === 'running';
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  buildNoiseBuffer() {
    const length = this.ctx.sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playBlockSound(material = 'stone', isBreak = false) {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;
    const pitchJitter = 0.9 + Math.random() * 0.22;

    const presets = {
      grass: { freq: 380, type: 'bandpass', q: 1.4, dur: isBreak ? 0.12 : 0.065, gain: isBreak ? 0.24 : 0.11 },
      wood: { freq: 240, type: 'lowpass', q: 2.8, dur: isBreak ? 0.13 : 0.075, gain: isBreak ? 0.30 : 0.16, knock: 165 },
      stone: { freq: 920, type: 'bandpass', q: 2.1, dur: isBreak ? 0.11 : 0.06, gain: isBreak ? 0.28 : 0.14, knock: 310 },
      gravel: { freq: 560, type: 'bandpass', q: 1.1, dur: isBreak ? 0.13 : 0.07, gain: isBreak ? 0.24 : 0.12 },
      sand: { freq: 1150, type: 'bandpass', q: 1.2, dur: isBreak ? 0.10 : 0.055, gain: isBreak ? 0.19 : 0.10 },
      snow: { freq: 1450, type: 'bandpass', q: 1.6, dur: isBreak ? 0.10 : 0.055, gain: isBreak ? 0.18 : 0.09 },
      glass: { freq: 2200, type: 'highpass', q: 3.5, dur: isBreak ? 0.16 : 0.06, gain: isBreak ? 0.28 : 0.13, knock: 1380 },
      water: { freq: 480, type: 'lowpass', q: 1.8, dur: 0.22, gain: 0.25 },
    };

    const p = presets[material] || presets.stone;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = pitchJitter;

    const filter = this.ctx.createBiquadFilter();
    filter.type = p.type;
    filter.frequency.setValueAtTime(p.freq * pitchJitter, t);
    filter.Q.value = p.q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(p.gain, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + p.dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(t, Math.random() * 0.4, p.dur + 0.02);

    if (p.knock) {
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = material === 'glass' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(p.knock * pitchJitter, t);
      osc.frequency.exponentialRampToValueAtTime(p.knock * 0.55, t + p.dur);
      og.gain.setValueAtTime(p.gain * 0.7, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + p.dur);
      osc.connect(og);
      og.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + p.dur + 0.02);
    }
  }

  playFootstep(material = 'grass') {
    if (!this.ensureContext()) return;
    const prev = this.volume;
    if (this.masterGain) {
      this.playBlockSound(material, false);
    }
    return prev;
  }

  playPickup() {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    const base = 520 + Math.random() * 140;
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 1.75, t + 0.085);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.095);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  playCraft() {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + i * 0.045);
      g.gain.setValueAtTime(0.16, t + i * 0.045);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.16);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t + i * 0.045);
      osc.stop(t + i * 0.045 + 0.18);
    });
  }

  playSwing() {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(620, t);
    f.frequency.exponentialRampToValueAtTime(220, t + 0.1);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.13, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(f);
    f.connect(g);
    g.connect(this.masterGain);
    src.start(t, 0, 0.12);
  }

  playHit(isPlayerHurt = false) {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isPlayerHurt ? 190 : 250, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.14);
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  playEat() {
    if (!this.ensureContext()) return;
    for (let i = 0; i < 3; i++) {
      setTimeout(() => this.playBlockSound('grass', false), i * 85);
    }
  }

  playMobVoice(kind = 'sheep') {
    if (!this.ensureContext()) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    if (kind === 'zombie') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(115, t);
      osc.frequency.linearRampToValueAtTime(84, t + 0.35);
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
    } else {
      osc.type = 'triangle';
      const base = kind === 'cow' ? 145 : kind === 'chicken' ? 540 : 290;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * 0.88, t + 0.24);
      g.gain.setValueAtTime(0.10, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
      osc.connect(g);
      g.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.28);
    }
  }

  updateAmbience(dt, weather = 'clear') {
    if (!this.ctx || this.ctx.state !== 'running') return;

    // Gentle rain audio loop
    const wantRain = weather === 'rain' ? 0.08 : 0.0;
    if (wantRain > 0 && !this.rainGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1100;
      const g = this.ctx.createGain();
      g.gain.value = 0.001;
      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start();
      this.rainGain = g;
      this.rainSrc = src;
    }
    if (this.rainGain) {
      this.rainGain.gain.setTargetAtTime(wantRain, this.ctx.currentTime, 0.4);
    }

    // Peaceful ambient pentatonic piano notes inspired by classic sandbox exploration
    if (!this.musicEnabled) return;
    this.nextMusicTime -= dt;
    if (this.nextMusicTime <= 0) {
      this.nextMusicTime = 4.5 + Math.random() * 6.5;
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
      const f1 = scale[(Math.random() * scale.length) | 0];
      const f2 = Math.random() < 0.45 ? scale[(Math.random() * 4) | 0] * 0.5 : null;
      this.playSoftPianoNote(f1, 0);
      if (f2) this.playSoftPianoNote(f2, 0.22);
    }
  }

  playSoftPianoNote(freq, delay = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const overtone = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    overtone.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    overtone.frequency.setValueAtTime(freq * 2, t);

    const overGain = this.ctx.createGain();
    overGain.gain.value = 0.14;

    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 3.4);

    osc.connect(g);
    overtone.connect(overGain);
    overGain.connect(g);
    g.connect(this.masterGain);

    osc.start(t);
    overtone.start(t);
    osc.stop(t + 3.5);
    overtone.stop(t + 3.5);
  }
}
