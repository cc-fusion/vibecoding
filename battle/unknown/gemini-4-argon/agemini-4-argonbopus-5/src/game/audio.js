export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.rainGain = null;
    this.volume = 0.65;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;
        this.masterGain.connect(this.ctx.destination);

        // Prebuild 1.5s white-noise buffer for organic percussion & rain
        const len = Math.floor(this.ctx.sampleRate * 1.5);
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        // Continuous filtered rain loop (gain starts at 0)
        const rainSrc = this.ctx.createBufferSource();
        rainSrc.buffer = this.noiseBuffer;
        rainSrc.loop = true;
        const rainFilter = this.ctx.createBiquadFilter();
        rainFilter.type = 'bandpass';
        rainFilter.frequency.value = 1100;
        rainFilter.Q.value = 0.7;
        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0.0;
        rainSrc.connect(rainFilter);
        rainFilter.connect(this.rainGain);
        this.rainGain.connect(this.masterGain);
        rainSrc.start();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
  }

  playNoiseBurst({ freq = 900, q = 1.2, duration = 0.08, gain = 0.18, type = 'bandpass' }) {
    if (!this.ctx || !this.noiseBuffer || this.volume <= 0.01) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = 0.85 + Math.random() * 0.3;

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
    src.start(now, Math.random() * 0.5, duration);
  }

  playTone({ freq = 440, endFreq = null, duration = 0.1, gain = 0.15, type = 'triangle', delay = 0 }) {
    if (!this.ctx || this.volume <= 0.01) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    }

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playStep(group = 'grass') {
    if (group === 'grass') {
      this.playNoiseBurst({ freq: 1400, q: 0.9, duration: 0.065, gain: 0.09 });
    } else if (group === 'sand') {
      this.playNoiseBurst({ freq: 2100, q: 1.1, duration: 0.07, gain: 0.08 });
    } else if (group === 'wood') {
      this.playTone({ freq: 165, endFreq: 95, duration: 0.055, gain: 0.11 });
    } else if (group === 'water') {
      this.playNoiseBurst({ freq: 650, q: 1.5, duration: 0.12, gain: 0.11 });
    } else {
      this.playNoiseBurst({ freq: 950, q: 1.6, duration: 0.05, gain: 0.09 });
    }
  }

  playMineHit(group = 'stone') {
    if (group === 'wood') {
      this.playTone({ freq: 210, endFreq: 110, duration: 0.06, gain: 0.13 });
    } else if (group === 'grass' || group === 'sand') {
      this.playNoiseBurst({ freq: 1500, q: 1.0, duration: 0.06, gain: 0.11 });
    } else {
      this.playTone({ freq: 520 + Math.random() * 80, endFreq: 240, duration: 0.05, gain: 0.09 });
      this.playNoiseBurst({ freq: 1800, q: 2.0, duration: 0.04, gain: 0.08 });
    }
  }

  playBlockBreak(group = 'stone') {
    if (group === 'glass') {
      this.playTone({ freq: 1450, endFreq: 880, duration: 0.12, gain: 0.14, type: 'sine' });
      this.playTone({ freq: 1920, endFreq: 1100, duration: 0.10, gain: 0.10, type: 'sine', delay: 0.03 });
      this.playNoiseBurst({ freq: 3400, q: 1.8, duration: 0.11, gain: 0.14 });
      return;
    }
    if (group === 'wood') {
      this.playTone({ freq: 195, endFreq: 75, duration: 0.13, gain: 0.20 });
      this.playNoiseBurst({ freq: 850, q: 1.1, duration: 0.12, gain: 0.16 });
      return;
    }
    this.playNoiseBurst({ freq: group === 'grass' ? 1200 : 820, q: 0.9, duration: 0.15, gain: 0.22 });
    this.playTone({ freq: 180, endFreq: 68, duration: 0.12, gain: 0.16 });
  }

  playBlockPlace(group = 'stone') {
    const base = group === 'wood' ? 230 : (group === 'grass' ? 190 : 280);
    this.playTone({ freq: base, endFreq: base * 0.65, duration: 0.075, gain: 0.16 });
    this.playNoiseBurst({ freq: 1100, q: 1.3, duration: 0.06, gain: 0.11 });
  }

  playPickup() {
    this.playTone({ freq: 520, endFreq: 920, duration: 0.085, gain: 0.14, type: 'sine' });
  }

  playCraft() {
    this.playTone({ freq: 523.25, duration: 0.11, gain: 0.12, type: 'triangle' });
    this.playTone({ freq: 659.25, duration: 0.14, gain: 0.12, type: 'triangle', delay: 0.06 });
    this.playTone({ freq: 783.99, duration: 0.18, gain: 0.12, type: 'triangle', delay: 0.12 });
  }

  playEat() {
    this.playNoiseBurst({ freq: 950, q: 1.1, duration: 0.08, gain: 0.16 });
    setTimeout(() => this.playNoiseBurst({ freq: 1150, q: 1.1, duration: 0.08, gain: 0.14 }), 90);
  }

  playSplash(intensity = 0.8) {
    this.playNoiseBurst({ freq: 560, q: 0.8, duration: 0.24, gain: 0.24 * intensity, type: 'lowpass' });
  }

  playAttack() {
    this.playNoiseBurst({ freq: 1600, q: 0.7, duration: 0.09, gain: 0.14 });
    this.playTone({ freq: 260, endFreq: 110, duration: 0.09, gain: 0.15 });
  }

  playHurt() {
    this.playTone({ freq: 175, endFreq: 72, duration: 0.18, gain: 0.24, type: 'sawtooth' });
  }

  updateWeather(rainIntensity, isSnow = false) {
    if (!this.rainGain || !this.ctx) return;
    const target = isSnow ? rainIntensity * 0.015 : rainIntensity * 0.085;
    this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.2);
  }
}
