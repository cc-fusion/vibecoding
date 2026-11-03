import { SOUND_GROUPS } from '../constants.js';

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;

    this.masterVolume = 0.75;
    this.sfxVolume = 0.85;
    this.musicVolume = 0.40;

    this._rainGain = null;
    this._rainTarget = 0;
    this._musicTimer = 8.0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this._buildNoiseBuffer();
        this._setupRainLoop();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const len = sampleRate * 1.5;
    const buffer = this.ctx.createBuffer(1, len, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.35) * 0.6;
    }
    this.noiseBuffer = buffer;
  }

  _setupRainLoop() {
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.6;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    this._rainGain = gain;
  }

  _sfxGainVal(mult = 1.0) {
    return Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume * mult));
  }

  _playNoiseBurst(freq, q, duration, vol, filterType = 'bandpass', pitchDrop = 1.0) {
    if (!this.ctx || !this.noiseBuffer) return;
    const gVal = this._sfxGainVal(vol);
    if (gVal <= 0.001) return;

    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.setValueAtTime(0.85 + Math.random() * 0.3, now);
    if (pitchDrop !== 1.0) {
      src.playbackRate.exponentialRampToValueAtTime(Math.max(0.2, pitchDrop), now + duration);
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq * (0.9 + Math.random() * 0.2), now);
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 0.7, duration + 0.02);
  }

  _playTone(freqStart, freqEnd, duration, vol, type = 'triangle') {
    if (!this.ctx) return;
    const gVal = this._sfxGainVal(vol);
    if (gVal <= 0.001) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playStep(group = SOUND_GROUPS.GRASS) {
    switch (group) {
      case SOUND_GROUPS.STONE:
        this._playNoiseBurst(950, 1.8, 0.06, 0.16);
        this._playTone(170, 95, 0.05, 0.08, 'sine');
        break;
      case SOUND_GROUPS.WOOD:
        this._playTone(195 * (0.92 + Math.random() * 0.16), 110, 0.065, 0.16, 'triangle');
        this._playNoiseBurst(600, 1.4, 0.05, 0.1);
        break;
      case SOUND_GROUPS.SAND:
        this._playNoiseBurst(1600, 0.9, 0.08, 0.15);
        break;
      case SOUND_GROUPS.SNOW:
        this._playNoiseBurst(2400, 1.2, 0.075, 0.14);
        break;
      case SOUND_GROUPS.WATER:
        this._playNoiseBurst(700, 1.5, 0.14, 0.18, 'bandpass', 0.6);
        break;
      case SOUND_GROUPS.GLASS:
        this._playTone(900, 650, 0.045, 0.09, 'sine');
        break;
      default:
        // Grass / foliage
        this._playNoiseBurst(1250, 1.0, 0.07, 0.15);
        break;
    }
  }

  playDig(group = SOUND_GROUPS.STONE) {
    this.playStep(group);
  }

  playBreak(group = SOUND_GROUPS.STONE) {
    switch (group) {
      case SOUND_GROUPS.GLASS:
        this._playNoiseBurst(3200, 1.6, 0.18, 0.32, 'highpass');
        this._playTone(1450, 720, 0.11, 0.18, 'sine');
        break;
      case SOUND_GROUPS.WOOD:
        this._playTone(220, 90, 0.14, 0.28, 'triangle');
        this._playNoiseBurst(750, 1.2, 0.15, 0.26);
        break;
      case SOUND_GROUPS.STONE:
        this._playNoiseBurst(1100, 1.3, 0.16, 0.30);
        this._playTone(165, 65, 0.13, 0.22, 'triangle');
        break;
      default:
        this._playNoiseBurst(1400, 0.9, 0.15, 0.28);
        this._playTone(140, 75, 0.10, 0.14, 'sine');
        break;
    }
  }

  playPlace(group = SOUND_GROUPS.STONE) {
    this._playTone(185 * (0.94 + Math.random() * 0.12), 115, 0.08, 0.22, 'triangle');
    this.playStep(group);
  }

  playPickup() {
    const base = 520 + Math.random() * 120;
    this._playTone(base, base * 1.85, 0.085, 0.22, 'sine');
  }

  playSwing() {
    this._playNoiseBurst(900, 0.8, 0.09, 0.12, 'bandpass', 0.55);
  }

  playHit(isPlayer = false) {
    this._playTone(isPlayer ? 160 : 210, 62, 0.14, 0.32, 'sawtooth');
    this._playNoiseBurst(600, 1.0, 0.11, 0.26);
  }

  playEat() {
    this._playNoiseBurst(1300, 1.1, 0.09, 0.24);
    this._playTone(230, 150, 0.07, 0.12, 'triangle');
  }

  playFuse() {
    this._playNoiseBurst(2600, 1.4, 0.45, 0.24, 'highpass');
  }

  playToolBreak() {
    this._playNoiseBurst(1900, 1.2, 0.22, 0.35);
    this._playTone(320, 95, 0.20, 0.28, 'sawtooth');
  }

  playSplash() {
    this._playNoiseBurst(850, 0.9, 0.28, 0.32, 'bandpass', 0.5);
  }

  playExplosion() {
    this._playTone(95, 24, 0.65, 0.55, 'sawtooth');
    this._playNoiseBurst(340, 0.6, 0.75, 0.55, 'lowpass', 0.35);
  }

  playClick() {
    this._playTone(680, 520, 0.035, 0.12, 'sine');
  }

  playMob(type) {
    if (type === 'sheep') {
      this._playTone(310, 275, 0.22, 0.11, 'sawtooth');
    } else if (type === 'pig') {
      this._playTone(175, 130, 0.13, 0.11, 'triangle');
    } else if (type === 'chicken') {
      this._playTone(620, 480, 0.08, 0.09, 'sine');
    } else if (type === 'zombie') {
      this._playTone(115, 82, 0.32, 0.14, 'sawtooth');
    } else if (type === 'spider') {
      this._playNoiseBurst(2800, 1.8, 0.14, 0.12, 'highpass');
    }
  }

  _playAmbientPhrase() {
    if (!this.ctx) return;
    const baseGain = this.masterVolume * this.musicVolume * 0.09;
    if (baseGain <= 0.002) return;

    // Gentle C-major / A-minor pentatonic frequencies
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    const count = 3 + Math.floor(Math.random() * 3);
    const now = this.ctx.currentTime;

    for (let i = 0; i < count; i++) {
      const t = now + i * (1.1 + Math.random() * 0.9);
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const dur = 3.2 + Math.random() * 1.8;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      const overtone = this.ctx.createOscillator();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(baseGain, t + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      const overGain = this.ctx.createGain();
      overGain.gain.value = 0.15;

      osc.connect(gain);
      overtone.connect(overGain);
      overGain.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      overtone.start(t);
      osc.stop(t + dur + 0.05);
      overtone.stop(t + dur + 0.05);
    }
  }

  update(dt, isRaining = false) {
    if (!this.ctx) return;

    // Smooth rain ambience fade
    if (this._rainGain) {
      const target = isRaining ? this._sfxGainVal(0.11) : 0.0;
      this._rainTarget += (target - this._rainTarget) * Math.min(1, dt * 2.5);
      this._rainGain.gain.value = this._rainTarget;
    }

    // Sparse peaceful music phrases
    this._musicTimer -= dt;
    if (this._musicTimer <= 0) {
      this._musicTimer = 15 + Math.random() * 14;
      this._playAmbientPhrase();
    }
  }
}
