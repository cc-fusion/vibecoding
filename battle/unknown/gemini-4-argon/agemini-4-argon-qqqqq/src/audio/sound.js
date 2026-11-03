import { SOUND_GROUP } from '../world/constants.js';

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.rainGain = null;
    this.volume = 0.65;
    this.enabled = true;
  }

  ensureContext() {
    if (!this.enabled || typeof window === 'undefined') return false;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return false;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.buildNoiseBuffer();
      this.setupRainAmbience();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return true;
  }

  buildNoiseBuffer() {
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.9;
    }
    this.noiseBuffer = buf;
  }

  setupRainAmbience() {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1150;
    filter.Q.value = 0.7;

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;

    src.connect(filter);
    filter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    src.start();
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  updateAmbience(weatherIntensity, underwater = false) {
    if (!this.rainGain || !this.ctx) return;
    const target = underwater ? 0.03 : weatherIntensity * 0.14;
    this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }

  noiseBurst(freq, q, duration, gainVal, type = 'bandpass') {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq * (0.9 + Math.random() * 0.2);
    filter.Q.value = q;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(this.masterGain);

    src.start(now, Math.random() * 0.8, duration);
  }

  tone(freqStart, freqEnd, duration, gainVal, wave = 'triangle') {
    if (!this.ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = wave;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration);
  }

  getGroupProfile(group) {
    switch (group) {
      case SOUND_GROUP.GRASS: return { freq: 950, q: 1.4, tone: 140 };
      case SOUND_GROUP.WOOD: return { freq: 520, q: 2.8, tone: 195 };
      case SOUND_GROUP.SAND: return { freq: 1650, q: 1.1, tone: 120 };
      case SOUND_GROUP.SNOW: return { freq: 2100, q: 1.2, tone: 160 };
      case SOUND_GROUP.GLASS: return { freq: 2800, q: 4.0, tone: 880 };
      case SOUND_GROUP.WATER: return { freq: 700, q: 1.6, tone: 240 };
      case SOUND_GROUP.STONE:
      default: return { freq: 780, q: 2.4, tone: 230 };
    }
  }

  playStep(group) {
    const p = this.getGroupProfile(group);
    this.noiseBurst(p.freq, p.q, 0.065, 0.11);
  }

  playMineHit(group) {
    const p = this.getGroupProfile(group);
    this.noiseBurst(p.freq * 1.1, p.q, 0.055, 0.14);
    this.tone(p.tone * 1.2, p.tone * 0.7, 0.045, 0.07, 'triangle');
  }

  playBlockBreak(group) {
    const p = this.getGroupProfile(group);
    this.noiseBurst(p.freq, p.q * 0.8, 0.17, 0.32);
    this.tone(p.tone * 1.35, p.tone * 0.55, 0.12, 0.14, group === SOUND_GROUP.GLASS ? 'sine' : 'triangle');
  }

  playBlockPlace(group) {
    const p = this.getGroupProfile(group);
    this.noiseBurst(p.freq * 0.85, p.q, 0.08, 0.22);
    this.tone(p.tone * 0.9, p.tone * 1.15, 0.07, 0.12, 'triangle');
  }

  playPickup() {
    const base = 520 + Math.random() * 140;
    this.tone(base, base * 1.65, 0.09, 0.16, 'sine');
  }

  playCraft(isFurnace = false) {
    if (isFurnace) {
      this.noiseBurst(1400, 1.2, 0.24, 0.22);
      this.tone(360, 540, 0.15, 0.12, 'sine');
    } else {
      this.tone(440, 660, 0.1, 0.15, 'triangle');
      setTimeout(() => this.tone(660, 880, 0.11, 0.13, 'sine'), 55);
    }
  }

  playSwing() {
    this.noiseBurst(550, 0.9, 0.08, 0.1);
  }

  playHitMob() {
    this.noiseBurst(420, 1.5, 0.11, 0.26);
    this.tone(210, 95, 0.11, 0.18, 'sawtooth');
  }

  playHurt() {
    this.noiseBurst(380, 1.4, 0.14, 0.3);
    this.tone(185, 82, 0.16, 0.22, 'sawtooth');
  }

  playEat() {
    this.noiseBurst(1100, 1.3, 0.09, 0.22);
    setTimeout(() => this.noiseBurst(950, 1.4, 0.09, 0.2), 95);
  }

  playSplash() {
    this.noiseBurst(680, 1.1, 0.28, 0.3);
    this.tone(280, 140, 0.18, 0.1, 'sine');
  }

  playToolBreak() {
    this.noiseBurst(1800, 2.2, 0.22, 0.32);
    this.tone(340, 110, 0.2, 0.2, 'sawtooth');
  }

  playUiClick() {
    this.tone(620, 780, 0.035, 0.08, 'sine');
  }
}
