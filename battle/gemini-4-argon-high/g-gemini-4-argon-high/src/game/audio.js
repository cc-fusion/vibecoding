// Procedural Web Audio API synthesizer for voxel sound effects & calm ambience

export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.volume = 0.65;
    this._musicTimer = 0;
  }

  _ensureCtx() {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          this.ctx = null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playStep(material = 'grass') {
    const ctx = this._ensureCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const profiles = {
      grass: { freq: 120, endFreq: 55, dur: 0.065, type: 'triangle', vol: 0.14 },
      stone: { freq: 240, endFreq: 95, dur: 0.05, type: 'sine', vol: 0.16 },
      wood: { freq: 165, endFreq: 75, dur: 0.06, type: 'square', vol: 0.12 },
      sand: { freq: 190, endFreq: 90, dur: 0.07, type: 'triangle', vol: 0.11 },
      snow: { freq: 310, endFreq: 140, dur: 0.06, type: 'sine', vol: 0.12 },
      glass: { freq: 520, endFreq: 280, dur: 0.05, type: 'sine', vol: 0.14 },
      water: { freq: 180, endFreq: 320, dur: 0.11, type: 'sine', vol: 0.15 },
    };

    const p = profiles[material] || profiles.grass;
    osc.type = p.type;
    osc.frequency.setValueAtTime(p.freq * (0.92 + Math.random() * 0.16), now);
    osc.frequency.exponentialRampToValueAtTime(p.endFreq, now + p.dur);

    gain.gain.setValueAtTime(p.vol * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + p.dur);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + p.dur);
  }

  playMineTick(material = 'stone', progress = 0) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = material === 'stone' ? 'triangle' : 'sine';
    const baseFreq = material === 'stone' ? 280 : material === 'wood' ? 190 : 210;
    osc.frequency.setValueAtTime(baseFreq + progress * 90, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.045);

    gain.gain.setValueAtTime(0.15 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playBlockBreak(material = 'stone') {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Noise burst + low thud
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = material === 'glass' ? 1400 : material === 'stone' ? 650 : 480;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  playBlockPlace(material = 'stone') {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    const base = material === 'wood' ? 150 : material === 'stone' ? 210 : 175;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.075);

    gain.gain.setValueAtTime(0.24 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playPickup() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.075);

    gain.gain.setValueAtTime(0.22 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playCraft() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      gain.gain.setValueAtTime(0.18 * this.volume, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.16);
    });
  }

  playEat() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160 + i * 35, now + i * 0.06);
      gain.gain.setValueAtTime(0.15 * this.volume, now + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.05);
    }
  }

  playHit(isHostile = false) {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isHostile ? 160 : 290, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);
    gain.gain.setValueAtTime(0.26 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playFuse() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.6);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  playExplosion() {
    const ctx = this._ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.55);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.32));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 340;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.55 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.55);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
  }

  updateAmbientMusic(dt) {
    if (!this.enabled || !this.musicEnabled) return;
    this._musicTimer -= dt;
    if (this._musicTimer > 0) return;

    this._musicTimer = 4.5 + Math.random() * 4.5;
    const ctx = this._ensureCtx();
    if (!ctx || ctx.state !== 'running') return;

    // Gentle C418-style pentatonic ambient note
    const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.045 * this.volume, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 3.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 3.3);
  }
}
