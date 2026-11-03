import { SoundMaterial } from './types';

const PENTATONIC_HZ = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  volume = 0.65;
  musicEnabled = true;
  private nextMusicTime = 0;

  unlock(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  playMaterialSound(
    material: SoundMaterial,
    kind: 'step' | 'hit' | 'break' | 'place'
  ): void {
    if (!this.ctx || !this.noiseBuffer || this.volume <= 0.01) return;
    const now = this.ctx.currentTime;
    const gainScale =
      (kind === 'step' ? 0.14 : kind === 'hit' ? 0.2 : 0.34) * this.volume;

    // Filtered noise burst for tactile crunch/thud
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.playbackRate.value = 0.85 + Math.random() * 0.4;

    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    let freq = 900;
    let q = 1.2;
    let duration = kind === 'break' ? 0.16 : 0.085;
    let toneHz = 140;

    switch (material) {
      case 'grass':
      case 'leaves':
        filter.type = 'bandpass';
        freq = 1650 + Math.random() * 450;
        q = 0.9;
        toneHz = 115;
        break;
      case 'dirt':
      case 'sand':
        filter.type = 'lowpass';
        freq = material === 'sand' ? 2200 : 850;
        q = 0.8;
        toneHz = 95;
        break;
      case 'snow':
        filter.type = 'bandpass';
        freq = 2800;
        q = 0.7;
        toneHz = 210;
        break;
      case 'stone':
        filter.type = 'bandpass';
        freq = 1250 + Math.random() * 350;
        q = 2.4;
        toneHz = 210 + Math.random() * 60;
        break;
      case 'wood':
        filter.type = 'bandpass';
        freq = 720 + Math.random() * 180;
        q = 3.2;
        toneHz = 175 + Math.random() * 40;
        break;
      case 'glass':
        filter.type = 'highpass';
        freq = 2600;
        q = 2.0;
        toneHz = 980 + Math.random() * 320;
        duration = kind === 'break' ? 0.22 : 0.08;
        break;
      case 'water':
        filter.type = 'bandpass';
        freq = 650;
        q = 1.6;
        duration = 0.24;
        toneHz = 240;
        break;
    }

    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(q, now);

    env.gain.setValueAtTime(gainScale, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.ctx.destination);
    noise.start(now);
    noise.stop(now + duration);

    // Subtle body resonance oscillator
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = material === 'glass' ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(toneHz * (kind === 'place' ? 0.85 : 1.0), now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, toneHz * 0.5), now + duration * 0.8);
    oscGain.gain.setValueAtTime(gainScale * 0.55, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  playPickup(): void {
    if (!this.ctx || this.volume <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const base = 460 + Math.random() * 140;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.9, now + 0.075);
    gain.gain.setValueAtTime(0.2 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  playChime(chord = false): void {
    if (!this.ctx || this.volume <= 0.01) return;
    const now = this.ctx.currentTime;
    const notes = chord ? [523.25, 659.25, 783.99, 1046.5] : [587.33, 880.0];
    notes.forEach((hz, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      g.gain.setValueAtTime(0.14 * this.volume, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  playHurt(): void {
    if (!this.ctx || this.volume <= 0.01) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.16);
    g.gain.setValueAtTime(0.26 * this.volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playHiss(): void {
    if (!this.ctx || !this.noiseBuffer || this.volume <= 0.01) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(2200, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18 * this.volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 0.65);
  }

  playExplosion(): void {
    if (!this.ctx || !this.noiseBuffer || this.volume <= 0.01) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(520, now);
    filter.frequency.exponentialRampToValueAtTime(65, now + 0.95);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.6 * this.volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.ctx.destination);
    src.start(now);
    src.stop(now + 1.05);
  }

  updateAmbientMusic(dt: number): void {
    if (!this.ctx || !this.musicEnabled || this.volume <= 0.01 || this.ctx.state !== 'running') {
      return;
    }
    this.nextMusicTime -= dt;
    if (this.nextMusicTime <= 0) {
      this.nextMusicTime = 2.6 + Math.random() * 3.8;
      const now = this.ctx.currentTime;
      const count = Math.random() > 0.6 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const hz = PENTATONIC_HZ[Math.floor(Math.random() * PENTATONIC_HZ.length)] * (i === 1 ? 0.5 : 1);
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(hz, now + i * 0.14);
        g.gain.setValueAtTime(0.0001, now + i * 0.14);
        g.gain.linearRampToValueAtTime(0.045 * this.volume, now + i * 0.14 + 0.18);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.14 + 2.8);
        osc.connect(g);
        g.connect(this.ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 2.9);
      }
    }
  }

  dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
