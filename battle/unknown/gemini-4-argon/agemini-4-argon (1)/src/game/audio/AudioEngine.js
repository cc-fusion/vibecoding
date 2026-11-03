import { SOUND_MATERIAL, WEATHER_TYPES } from '../constants.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.rainNode = null;
    this.rainGain = null;
    this.volume = 0.7;
    this.musicTimer = 14.0;
    this.enabled = true;
  }

  ensureContext() {
    if (!this.enabled || typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.buildNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx.state === 'running';
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.04);
    }
  }

  buildNoiseBuffer() {
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.08 * white) / 1.08;
      data[i] = white * 0.65 + last * 0.35;
    }
    this.noiseBuffer = buffer;
  }

  playNoiseBurst({ duration = 0.09, filterType = 'bandpass', freq = 900, q = 1.4, gain = 0.22, pitchEnd = null }) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.setValueAtTime(0.85 + Math.random() * 0.3, now);

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq * (0.9 + Math.random() * 0.2), now);
    if (pitchEnd) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, pitchEnd), now + duration);
    }
    filter.Q.value = q;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    src.start(now, Math.random() * 1.2);
    src.stop(now + duration + 0.02);
  }

  playTone({ type = 'triangle', freq = 320, freqEnd = null, duration = 0.11, gain = 0.16, delay = 0 }) {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (freqEnd) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), now + duration);
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.001, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  getMaterialParams(material) {
    switch (material) {
      case SOUND_MATERIAL.GRASS:
        return { freq: 1450, q: 1.3, tone: 135, type: 'triangle' };
      case SOUND_MATERIAL.DIRT:
        return { freq: 680, q: 1.1, tone: 110, type: 'sine' };
      case SOUND_MATERIAL.SAND:
        return { freq: 2100, q: 1.0, tone: 170, type: 'sine' };
      case SOUND_MATERIAL.WOOD:
        return { freq: 820, q: 2.2, tone: 195, type: 'triangle' };
      case SOUND_MATERIAL.GLASS:
        return { freq: 3200, q: 3.4, tone: 980, type: 'sine' };
      case SOUND_MATERIAL.WATER:
        return { freq: 580, q: 1.8, tone: 240, type: 'sine' };
      case SOUND_MATERIAL.WOOL:
        return { freq: 440, q: 0.9, tone: 95, type: 'sine' };
      case SOUND_MATERIAL.STONE:
      default:
        return { freq: 1200, q: 2.0, tone: 260, type: 'triangle' };
    }
  }

  playStep(material = SOUND_MATERIAL.GRASS) {
    const p = this.getMaterialParams(material);
    this.playNoiseBurst({
      duration: 0.065,
      freq: p.freq * 0.85,
      q: p.q,
      gain: 0.075,
      pitchEnd: p.freq * 0.5,
    });
  }

  playDig(material = SOUND_MATERIAL.STONE) {
    const p = this.getMaterialParams(material);
    const jitter = 0.9 + Math.random() * 0.22;
    this.playNoiseBurst({
      duration: 0.07,
      freq: p.freq * jitter,
      q: p.q,
      gain: 0.12,
    });
    this.playTone({
      type: p.type,
      freq: p.tone * jitter,
      freqEnd: p.tone * 0.7,
      duration: 0.055,
      gain: 0.07,
    });
  }

  playBreak(material = SOUND_MATERIAL.STONE) {
    const p = this.getMaterialParams(material);
    this.playNoiseBurst({
      duration: 0.16,
      freq: p.freq * 1.15,
      q: p.q * 0.8,
      gain: 0.24,
      pitchEnd: p.freq * 0.45,
    });
    this.playTone({
      type: p.type,
      freq: p.tone * 1.15,
      freqEnd: p.tone * 0.55,
      duration: 0.13,
      gain: 0.13,
    });
    if (material === SOUND_MATERIAL.GLASS) {
      this.playTone({ type: 'sine', freq: 1480, freqEnd: 880, duration: 0.12, gain: 0.1, delay: 0.03 });
    }
  }

  playPlace(material = SOUND_MATERIAL.STONE) {
    const p = this.getMaterialParams(material);
    this.playNoiseBurst({
      duration: 0.085,
      freq: p.freq * 0.9,
      q: p.q,
      gain: 0.17,
    });
    this.playTone({
      type: p.type,
      freq: p.tone * 0.95,
      freqEnd: p.tone * 1.12,
      duration: 0.08,
      gain: 0.12,
    });
  }

  playSwing() {
    this.playNoiseBurst({
      duration: 0.11,
      filterType: 'bandpass',
      freq: 680,
      pitchEnd: 220,
      q: 1.1,
      gain: 0.11,
    });
  }

  playPickup() {
    const base = 540 + Math.random() * 90;
    this.playTone({ type: 'sine', freq: base, freqEnd: base * 1.55, duration: 0.09, gain: 0.14 });
  }

  playCraft() {
    this.playTone({ type: 'triangle', freq: 440, duration: 0.09, gain: 0.12, delay: 0 });
    this.playTone({ type: 'triangle', freq: 659.25, duration: 0.14, gain: 0.13, delay: 0.065 });
  }

  playEat() {
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.playNoiseBurst({ duration: 0.06, freq: 950 + i * 140, q: 1.4, gain: 0.14 });
      }, i * 85);
    }
  }

  playHurt() {
    this.playNoiseBurst({ duration: 0.12, freq: 420, pitchEnd: 140, q: 1.0, gain: 0.24 });
    this.playTone({ type: 'sawtooth', freq: 185, freqEnd: 78, duration: 0.14, gain: 0.15 });
  }

  playSplash() {
    this.playNoiseBurst({ duration: 0.28, filterType: 'bandpass', freq: 720, pitchEnd: 260, q: 1.2, gain: 0.24 });
    this.playTone({ type: 'sine', freq: 210, freqEnd: 380, duration: 0.16, gain: 0.09 });
  }

  playAmbientChord() {
    if (!this.ensureContext()) return;
    // Gentle C-major9 / A-minor pentatonic bell tones
    const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const note = scale[Math.floor(Math.random() * scale.length)];
      const now = this.ctx.currentTime + i * (0.55 + Math.random() * 0.5);
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, now);
      env.gain.linearRampToValueAtTime(0.032, now + 0.45);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 4.2);

      osc.connect(env);
      env.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 4.3);
    }
  }

  updateAmbience(dt, { weather = WEATHER_TYPES.CLEAR, underwater = false, paused = false } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;

    // Gentle rain ambience loop
    const shouldRain = !paused && weather === WEATHER_TYPES.RAIN && !underwater;
    if (shouldRain && !this.rainNode) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1350;
      filter.Q.value = 0.7;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.001;
      gain.gain.setTargetAtTime(0.055, this.ctx.currentTime, 0.8);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();

      this.rainNode = src;
      this.rainGain = gain;
    } else if (!shouldRain && this.rainNode) {
      const node = this.rainNode;
      this.rainGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.35);
      this.rainNode = null;
      this.rainGain = null;
      setTimeout(() => {
        try { node.stop(); } catch (_) {}
      }, 600);
    }

    if (!paused) {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = 24 + Math.random() * 20;
        this.playAmbientChord();
      }
    }
  }
}
