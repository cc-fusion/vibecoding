export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.rainGain = null;
    this.volume = 0.65;
    this.muted = false;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : this.volume;
        this.masterGain.connect(this.ctx.destination);

        // Precompute 1.5s white/pinkish noise buffer
        const len = Math.floor(this.ctx.sampleRate * 1.5);
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < len; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.997 * b0 + white * 0.029;
          b1 = 0.985 * b1 + white * 0.032;
          b2 = 0.950 * b2 + white * 0.048;
          data[i] = (b0 + b1 + b2 + white * 0.18) * 1.8;
        }
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
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.02);
    }
  }

  getMaterialParams(soundType) {
    switch (soundType) {
      case 'grass':
        return { freq: 520, q: 1.4, tone: 110, dur: 0.075, gain: 0.22 };
      case 'snow':
        return { freq: 950, q: 1.1, tone: 180, dur: 0.08, gain: 0.2 };
      case 'sand':
        return { freq: 780, q: 1.6, tone: 140, dur: 0.075, gain: 0.2 };
      case 'wood':
        return { freq: 340, q: 2.8, tone: 145, dur: 0.085, gain: 0.28 };
      case 'glass':
        return { freq: 1850, q: 4.5, tone: 880, dur: 0.11, gain: 0.24 };
      case 'water':
        return { freq: 620, q: 2.0, tone: 210, dur: 0.14, gain: 0.25 };
      case 'dirt':
        return { freq: 410, q: 1.5, tone: 105, dur: 0.075, gain: 0.22 };
      case 'stone':
      default:
        return { freq: 680, q: 2.4, tone: 190, dur: 0.07, gain: 0.25 };
    }
  }

  playNoiseBurst({ freq = 600, q = 1.5, dur = 0.08, gain = 0.2, type = 'bandpass' }) {
    if (!this.ctx || !this.noiseBuffer) return;
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
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    src.start(now, Math.random() * 0.6, dur + 0.02);
  }

  playTone({ freqStart = 220, freqEnd = 110, dur = 0.08, gain = 0.16, type = 'triangle' }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(25, freqEnd), now + dur);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(env);
    env.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }

  playStep(soundType = 'grass') {
    this.unlock();
    const p = this.getMaterialParams(soundType);
    this.playNoiseBurst({ freq: p.freq, q: p.q, dur: p.dur * 0.75, gain: p.gain * 0.42 });
  }

  playHitBlock(soundType = 'stone') {
    this.unlock();
    const p = this.getMaterialParams(soundType);
    this.playNoiseBurst({ freq: p.freq * 1.1, q: p.q, dur: p.dur * 0.7, gain: p.gain * 0.55 });
    this.playTone({ freqStart: p.tone * 1.25, freqEnd: p.tone * 0.8, dur: 0.045, gain: 0.08 });
  }

  playBreakBlock(soundType = 'stone') {
    this.unlock();
    const p = this.getMaterialParams(soundType);
    this.playNoiseBurst({ freq: p.freq, q: p.q * 0.8, dur: p.dur * 1.65, gain: p.gain * 1.15 });
    this.playTone({ freqStart: p.tone * 1.15, freqEnd: p.tone * 0.55, dur: 0.11, gain: 0.15 });
  }

  playPlaceBlock(soundType = 'stone') {
    this.unlock();
    const p = this.getMaterialParams(soundType);
    this.playNoiseBurst({ freq: p.freq * 0.85, q: p.q, dur: p.dur * 1.1, gain: p.gain * 0.85 });
    this.playTone({ freqStart: p.tone * 0.95, freqEnd: p.tone * 1.18, dur: 0.075, gain: 0.14 });
  }

  playPickup() {
    this.unlock();
    const pitch = 0.92 + Math.random() * 0.25;
    this.playTone({ freqStart: 420 * pitch, freqEnd: 880 * pitch, dur: 0.068, gain: 0.18, type: 'sine' });
  }

  playCraft() {
    this.unlock();
    this.playTone({ freqStart: 523.25, freqEnd: 659.25, dur: 0.12, gain: 0.16, type: 'triangle' });
    setTimeout(() => {
      this.playTone({ freqStart: 659.25, freqEnd: 783.99, dur: 0.14, gain: 0.16, type: 'triangle' });
    }, 65);
  }

  playEat() {
    this.unlock();
    this.playNoiseBurst({ freq: 520, q: 1.4, dur: 0.09, gain: 0.22 });
    this.playTone({ freqStart: 360, freqEnd: 540, dur: 0.11, gain: 0.12, type: 'sine' });
  }

  playSwing() {
    this.unlock();
    this.playNoiseBurst({ freq: 420, q: 0.9, dur: 0.09, gain: 0.14, type: 'lowpass' });
  }

  playHurt() {
    this.unlock();
    this.playNoiseBurst({ freq: 320, q: 1.2, dur: 0.13, gain: 0.3 });
    this.playTone({ freqStart: 195, freqEnd: 82, dur: 0.14, gain: 0.24, type: 'sawtooth' });
  }

  playSplash() {
    this.unlock();
    this.playNoiseBurst({ freq: 540, q: 1.1, dur: 0.24, gain: 0.32 });
    this.playTone({ freqStart: 280, freqEnd: 460, dur: 0.14, gain: 0.1, type: 'sine' });
  }

  setWeatherRain(intensity = 0) {
    if (!this.ctx || !this.noiseBuffer) return;
    if (intensity > 0.02 && !this.rainGain) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 950;

      const gain = this.ctx.createGain();
      gain.gain.value = 0;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();

      this.rainSource = src;
      this.rainGain = gain;
    }

    if (this.rainGain) {
      const target = Math.min(0.11, intensity * 0.09);
      this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.35);
    }
  }
}
