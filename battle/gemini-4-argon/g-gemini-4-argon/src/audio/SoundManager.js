// Procedural Web Audio synthesizer for crisp, zero-asset voxel feedback

export class SoundManager {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.volume = 0.65;
    this.muted = false;
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
      // Prebuild 1-second white noise buffer for crisp percussion/footsteps
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < sr; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    } catch {
      this.ctx = null;
    }
  }

  getGain() {
    if (this.muted || !this.ctx || this.volume <= 0.001) return 0;
    return this.volume;
  }

  playNoiseBurst(duration, filterType, freq, q, gainAmt, pitchSlide = 1.0) {
    const master = this.getGain();
    if (!master || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.setValueAtTime(0.85 + Math.random() * 0.3, now);
    if (pitchSlide !== 1.0) {
      src.playbackRate.exponentialRampToValueAtTime(Math.max(0.2, pitchSlide), now + duration);
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq * (0.9 + Math.random() * 0.2), now);
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainAmt * master), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    src.start(now, Math.random() * 0.4, duration);
  }

  playTone(freqStart, freqEnd, duration, type = 'triangle', gainAmt = 0.18) {
    const master = this.getGain();
    if (!master) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0001, gainAmt * master), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playStep(material = 'grass') {
    switch (material) {
      case 'stone':
        this.playNoiseBurst(0.055, 'bandpass', 950, 2.2, 0.14);
        break;
      case 'wood':
        this.playTone(155 + Math.random() * 25, 85, 0.06, 'triangle', 0.15);
        this.playNoiseBurst(0.04, 'lowpass', 700, 1.0, 0.08);
        break;
      case 'sand':
      case 'gravel':
        this.playNoiseBurst(0.075, 'bandpass', 1850, 1.2, 0.12);
        break;
      case 'snow':
        this.playNoiseBurst(0.08, 'highpass', 2400, 1.1, 0.11, 0.7);
        break;
      case 'water':
        this.playNoiseBurst(0.12, 'bandpass', 680, 2.5, 0.14, 1.3);
        break;
      case 'glass':
        this.playNoiseBurst(0.045, 'highpass', 3200, 3.0, 0.10);
        break;
      default: // grass
        this.playNoiseBurst(0.065, 'bandpass', 1350, 1.4, 0.11);
        break;
    }
  }

  playMineHit(material = 'stone') {
    if (material === 'stone') {
      this.playTone(320 + Math.random() * 60, 140, 0.055, 'triangle', 0.14);
      this.playNoiseBurst(0.05, 'bandpass', 1500, 2.5, 0.13);
    } else if (material === 'wood') {
      this.playTone(210 + Math.random() * 40, 110, 0.065, 'triangle', 0.18);
    } else {
      this.playNoiseBurst(0.065, 'bandpass', 1200, 1.5, 0.14);
    }
  }

  playBreak(material = 'stone') {
    if (material === 'glass') {
      this.playNoiseBurst(0.16, 'highpass', 3600, 2.2, 0.24, 1.5);
      this.playTone(1450, 780, 0.11, 'sine', 0.15);
    } else if (material === 'wood') {
      this.playTone(230, 82, 0.13, 'sawtooth', 0.18);
      this.playNoiseBurst(0.12, 'lowpass', 950, 1.2, 0.22, 0.65);
    } else if (material === 'stone') {
      this.playNoiseBurst(0.14, 'bandpass', 1100, 1.4, 0.26, 0.6);
      this.playTone(190, 68, 0.11, 'triangle', 0.20);
    } else {
      this.playNoiseBurst(0.13, 'bandpass', 1400, 1.1, 0.24, 0.7);
    }
  }

  playPlace(material = 'stone') {
    const base = material === 'wood' ? 195 : material === 'stone' ? 240 : 170;
    this.playTone(base + Math.random() * 25, base * 0.6, 0.075, 'triangle', 0.19);
    this.playNoiseBurst(0.055, 'lowpass', 950, 1.2, 0.14);
  }

  playPickup() {
    const f = 520 + Math.random() * 140;
    this.playTone(f, f * 1.65, 0.085, 'sine', 0.18);
  }

  playCraft() {
    this.playTone(440, 660, 0.10, 'triangle', 0.16);
    setTimeout(() => this.playTone(660, 880, 0.13, 'triangle', 0.15), 55);
  }

  playEat() {
    this.playNoiseBurst(0.09, 'bandpass', 950, 1.5, 0.20, 0.8);
    setTimeout(() => this.playNoiseBurst(0.08, 'bandpass', 1150, 1.5, 0.18, 0.8), 95);
  }

  playSplash() {
    this.playNoiseBurst(0.28, 'bandpass', 620, 1.4, 0.26, 1.4);
  }

  playHitMob() {
    this.playTone(185, 72, 0.11, 'sawtooth', 0.22);
    this.playNoiseBurst(0.08, 'lowpass', 900, 1.2, 0.20);
  }

  playHurt() {
    this.playTone(260, 105, 0.16, 'sawtooth', 0.26);
    this.playNoiseBurst(0.10, 'bandpass', 800, 1.5, 0.20);
  }

  playToolBreak() {
    this.playNoiseBurst(0.20, 'bandpass', 1800, 2.0, 0.28, 0.45);
    this.playTone(300, 95, 0.18, 'sawtooth', 0.22);
  }

  playFuse() {
    this.playNoiseBurst(0.65, 'highpass', 3200, 1.8, 0.18, 1.2);
  }

  playExplosion() {
    this.playNoiseBurst(0.65, 'lowpass', 420, 0.9, 0.48, 0.35);
    this.playTone(110, 28, 0.55, 'sawtooth', 0.38);
  }

  playClick() {
    this.playTone(620, 480, 0.035, 'sine', 0.09);
  }
}
