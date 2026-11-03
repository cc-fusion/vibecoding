// Procedural Web Audio Sound & Ambient Music Engine

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxVolume = 0.7;
    this.musicEnabled = true;
    this.noiseBuffer = null;
    this.rainNode = null;
    this.rainGain = null;
    this.ambientTimer = 12;
  }

  ensureContext() {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.sfxVolume;
      this.masterGain.connect(this.ctx.destination);
      this.buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  setVolume(vol) {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 1.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  playNoiseBurst({ freq = 900, q = 1.5, duration = 0.08, gain = 0.22, type = 'bandpass' }) {
    if (!this.ensureContext() || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85 + Math.random() * 0.35;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq * (0.9 + Math.random() * 0.2), now);
    filter.Q.value = q;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    src.start(now, Math.random() * 0.6, duration);
  }

  playTone({ freq = 320, endFreq = null, duration = 0.1, gain = 0.18, type = 'triangle' }) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  playMaterial(material = 'stone', intensity = 1.0) {
    const g = 0.2 * intensity;
    switch (material) {
      case 'grass':
        this.playNoiseBurst({ freq: 1450, q: 1.2, duration: 0.075, gain: g * 0.85 });
        this.playTone({ freq: 115, endFreq: 70, duration: 0.055, gain: g * 0.45 });
        break;
      case 'wood':
        this.playTone({ freq: 195 + Math.random() * 35, endFreq: 95, duration: 0.08, gain: g, type: 'triangle' });
        this.playNoiseBurst({ freq: 720, q: 2.2, duration: 0.05, gain: g * 0.55 });
        break;
      case 'sand':
      case 'snow':
      case 'gravel':
        this.playNoiseBurst({ freq: 2100, q: 0.9, duration: 0.08, gain: g * 0.75 });
        break;
      case 'glass':
        this.playTone({ freq: 1350 + Math.random() * 280, endFreq: 920, duration: 0.11, gain: g * 0.7, type: 'sine' });
        this.playNoiseBurst({ freq: 3400, q: 2.8, duration: 0.07, gain: g * 0.5, type: 'highpass' });
        break;
      case 'water':
        this.playNoiseBurst({ freq: 650, q: 1.1, duration: 0.18, gain: g * 0.95 });
        this.playTone({ freq: 260, endFreq: 480, duration: 0.12, gain: g * 0.4, type: 'sine' });
        break;
      default: // stone
        this.playTone({ freq: 240 + Math.random() * 40, endFreq: 110, duration: 0.065, gain: g * 0.75, type: 'triangle' });
        this.playNoiseBurst({ freq: 1150, q: 1.8, duration: 0.065, gain: g * 0.8 });
        break;
    }
  }

  playStep(material) {
    this.playMaterial(material, 0.42);
  }

  playDig(material) {
    this.playMaterial(material, 0.65);
  }

  playBreak(material) {
    this.playMaterial(material, 1.15);
  }

  playPlace(material) {
    this.playMaterial(material, 0.9);
  }

  playPickup() {
    const base = 460 + Math.random() * 110;
    this.playTone({ freq: base, endFreq: base * 1.65, duration: 0.085, gain: 0.18, type: 'sine' });
  }

  playSwing() {
    this.playNoiseBurst({ freq: 520, q: 0.9, duration: 0.09, gain: 0.11 });
  }

  playHurt() {
    this.playTone({ freq: 190, endFreq: 75, duration: 0.16, gain: 0.28, type: 'sawtooth' });
    this.playNoiseBurst({ freq: 680, q: 1.4, duration: 0.1, gain: 0.18 });
  }

  playEat() {
    this.playNoiseBurst({ freq: 1200, q: 1.4, duration: 0.09, gain: 0.18 });
    setTimeout(() => this.playNoiseBurst({ freq: 1050, q: 1.4, duration: 0.09, gain: 0.16 }), 95);
  }

  playSplash() {
    this.playMaterial('water', 1.25);
  }

  playClick() {
    this.playTone({ freq: 620, endFreq: 480, duration: 0.04, gain: 0.1, type: 'sine' });
  }

  playMob(type = 'sheep', hurt = false) {
    if (hurt) {
      this.playTone({ freq: 290, endFreq: 140, duration: 0.13, gain: 0.2, type: 'sawtooth' });
      return;
    }
    if (type === 'sheep') {
      this.playTone({ freq: 310, endFreq: 270, duration: 0.18, gain: 0.08, type: 'sawtooth' });
    } else if (type === 'pig') {
      this.playTone({ freq: 165, endFreq: 130, duration: 0.12, gain: 0.09, type: 'triangle' });
    } else if (type === 'zombie') {
      this.playTone({ freq: 105, endFreq: 78, duration: 0.28, gain: 0.11, type: 'sawtooth' });
    }
  }

  updateWeather(isRaining, dt) {
    if (!this.ctx || !this.noiseBuffer) return;

    if (isRaining && !this.rainNode) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1350;
      filter.Q.value = 0.65;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.001;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();

      this.rainNode = src;
      this.rainGain = gain;
    }

    if (this.rainGain) {
      const target = isRaining ? 0.055 : 0.0001;
      const cur = this.rainGain.gain.value;
      const next = cur + (target - cur) * Math.min(1, dt * 2.0);
      this.rainGain.gain.value = next;
      if (!isRaining && next < 0.001 && this.rainNode) {
        try { this.rainNode.stop(); } catch (_) {}
        this.rainNode.disconnect();
        this.rainNode = null;
        this.rainGain = null;
      }
    }

    // Gentle calm C418-inspired pentatonic ambient chord notes
    if (this.musicEnabled && this.sfxVolume > 0.02) {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = 18 + Math.random() * 18;
        this.playAmbientChord();
      }
    }
  }

  playAmbientChord() {
    if (!this.ctx) return;
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const now = this.ctx.currentTime;
    const notes = 2 + ((Math.random() * 2) | 0);
    for (let i = 0; i < notes; i++) {
      const freq = scale[(Math.random() * scale.length) | 0] * (i === 0 ? 0.5 : 1.0);
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const env = this.ctx.createGain();
      const start = now + i * 0.55;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.032, start + 1.4);
      env.gain.exponentialRampToValueAtTime(0.0005, start + 5.2);

      osc.connect(env);
      env.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 5.3);
    }
  }
}
