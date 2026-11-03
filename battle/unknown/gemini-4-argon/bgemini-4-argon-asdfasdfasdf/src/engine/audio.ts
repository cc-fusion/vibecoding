import { SoundGroup } from './blocks';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  enabled = true;
  private noiseBuffer: AudioBuffer | null = null;
  private nextAmbientNoteTime = 8;

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && !this.noiseBuffer) {
      const len = this.ctx.sampleRate * 1.0;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  unlock(): void {
    this.ensureContext();
  }

  playBlockSound(group: SoundGroup, mode: 'step' | 'hit' | 'break' | 'place'): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;

    const now = ctx.currentTime;
    const volScale = mode === 'step' ? 0.11 : mode === 'hit' ? 0.16 : 0.28;
    const pitchJitter = 0.9 + Math.random() * 0.22;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = pitchJitter;

    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    let dur = 0.09;
    if (group === 'grass') {
      filter.type = 'bandpass';
      filter.frequency.value = 1350 * pitchJitter;
      filter.Q.value = 1.1;
      dur = 0.085;
    } else if (group === 'stone') {
      filter.type = 'lowpass';
      filter.frequency.value = 780 * pitchJitter;
      dur = 0.075;
    } else if (group === 'wood') {
      filter.type = 'bandpass';
      filter.frequency.value = 460 * pitchJitter;
      filter.Q.value = 2.6;
      dur = 0.09;
    } else if (group === 'sand') {
      filter.type = 'highpass';
      filter.frequency.value = 2100 * pitchJitter;
      dur = 0.095;
    } else if (group === 'glass' || group === 'metal') {
      filter.type = 'highpass';
      filter.frequency.value = 2800 * pitchJitter;
      dur = 0.12;
      // Add crystalline chime overtone
      const osc = ctx.createOscillator();
      const og = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime((group === 'glass' ? 1480 : 920) * pitchJitter, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.11);
      og.gain.setValueAtTime(volScale * 0.65, now);
      og.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(og).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.125);
    } else {
      // water splash
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.22);
      dur = 0.22;
    }

    gain.gain.setValueAtTime(volScale, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur + 0.01);
  }

  playPickup(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const base = 520 + Math.random() * 140;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.9, now + 0.075);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playCraft(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const t = now + idx * 0.045;
      gain.gain.setValueAtTime(0.13, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.19);
    });
  }

  playSwing(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680, now);
    filter.frequency.exponentialRampToValueAtTime(240, now + 0.1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.12);
  }

  playHurt(isMob = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isMob ? 240 : 175, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.16);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  playFuse(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.4);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 2.45);
  }

  playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 0.75);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.85);

    const sub = ctx.createOscillator();
    const sg = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(95, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.55);
    sg.gain.setValueAtTime(0.45, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    sub.connect(sg).connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.58);
  }

  updateAmbience(dt: number): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    this.nextAmbientNoteTime -= dt;
    if (this.nextAmbientNoteTime <= 0) {
      this.nextAmbientNoteTime = 11 + Math.random() * 12;
      // Sparse peaceful pentatonic piano-like harmonic note (C418 inspired!)
      const notes = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      const f = notes[Math.floor(Math.random() * notes.length)];
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.045, now + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + 3.6);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 3.7);
    }
  }
}
