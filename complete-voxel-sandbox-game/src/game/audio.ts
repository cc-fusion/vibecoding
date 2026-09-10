// Fully synthesized audio: block sounds, player feedback, UI, ambient wind and generative music.
import type { SoundKind } from "./blocks";

export type Sfx = "dig" | "break" | "place" | "step" | "land" | "splash" | "hurt" | "pickup" | "craft" | "click" | "eat" | "jump" | "toolbreak" | "ding";

const MAT: Record<SoundKind, { type: BiquadFilterType; freq: number; q: number; dur: number; gain: number }> = {
  stone: { type: "bandpass", freq: 900, q: 1.2, dur: 0.09, gain: 0.9 },
  wood: { type: "lowpass", freq: 500, q: 1, dur: 0.11, gain: 1.0 },
  grass: { type: "bandpass", freq: 2200, q: 0.8, dur: 0.12, gain: 0.6 },
  sand: { type: "highpass", freq: 2500, q: 0.7, dur: 0.1, gain: 0.5 },
  gravel: { type: "bandpass", freq: 1300, q: 0.7, dur: 0.13, gain: 0.8 },
  glass: { type: "bandpass", freq: 4000, q: 2, dur: 0.15, gain: 0.7 },
  cloth: { type: "lowpass", freq: 900, q: 1, dur: 0.1, gain: 0.5 },
  snow: { type: "lowpass", freq: 1400, q: 1, dur: 0.12, gain: 0.5 },
};

export class AudioSys {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private filter!: BiquadFilterNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private ambient!: GainNode;
  private noiseBuf!: AudioBuffer;
  private musicTimer = 0;
  private night = false;
  private delay!: DelayNode;
  volume = 0.7;
  musicVolume = 0.5;
  private started = false;
  private underwater = false;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  start() {
    if (this.started) {
      if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 20000;
    this.master.connect(this.filter).connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.music = ctx.createGain();
    this.ambient = ctx.createGain();
    this.sfx.connect(this.master);
    this.ambient.connect(this.master);
    // music through a feedback delay for a spacious feel
    this.delay = ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.4;
    this.music.connect(this.master);
    this.music.connect(this.delay);
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(wet).connect(this.master);

    const len = ctx.sampleRate * 1;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.started = true;
    this.applyVolumes();
    this.startWind();
  }

  setVolumes(volume: number, musicVolume: number) {
    this.volume = volume;
    this.musicVolume = musicVolume;
    this.applyVolumes();
  }
  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volume;
    this.music.gain.value = this.musicVolume * 0.5;
  }

  setUnderwater(u: boolean) {
    if (!this.ctx || u === this.underwater) return;
    this.underwater = u;
    this.filter.frequency.setTargetAtTime(u ? 500 : 20000, this.ctx.currentTime, 0.1);
  }

  setNight(n: boolean) {
    this.night = n;
  }

  private noise(filterType: BiquadFilterType, freq: number, q: number, dur: number, gain: number, pitchVar = 0.15, sweepTo?: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loopStart = 0;
    src.loop = true;
    src.playbackRate.value = 1 + (Math.random() - 0.5) * pitchVar * 2;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq * (1 + (Math.random() - 0.5) * pitchVar);
    f.Q.value = q;
    if (sweepTo !== undefined) {
      f.frequency.setValueAtTime(f.frequency.value, ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    }
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime + delay;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(kind: Sfx, mat: SoundKind = "stone", volume = 1) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const m = MAT[mat] ?? MAT.stone;
    switch (kind) {
      case "dig":
        this.noise(m.type, m.freq * 1.1, m.q, m.dur * 0.7, m.gain * 0.35 * volume, 0.25);
        break;
      case "break":
        this.noise(m.type, m.freq, m.q, m.dur * 1.6, m.gain * 0.9 * volume, 0.1);
        if (mat === "glass") this.tone("sine", 2400, 1800, 0.12, 0.15);
        if (mat === "stone") this.noise("lowpass", 300, 1, 0.12, 0.5);
        break;
      case "place":
        this.noise(m.type, m.freq * 0.9, m.q, m.dur, m.gain * 0.7 * volume, 0.1);
        break;
      case "step":
        this.noise(m.type, m.freq, m.q, m.dur * 0.6, m.gain * 0.18 * volume, 0.3);
        break;
      case "land":
        this.noise(m.type, m.freq * 0.7, m.q, m.dur * 1.2, m.gain * 0.5 * volume, 0.1);
        break;
      case "jump":
        this.noise("lowpass", 600, 1, 0.06, 0.08 * volume, 0.2);
        break;
      case "splash":
        this.noise("lowpass", 2500, 0.8, 0.45, 0.6 * volume, 0.05, 250);
        this.noise("highpass", 1500, 0.8, 0.3, 0.25 * volume, 0.05);
        break;
      case "hurt":
        this.tone("sawtooth", 220, 90, 0.25, 0.25 * volume);
        this.noise("lowpass", 700, 1, 0.2, 0.3 * volume, 0.1);
        break;
      case "pickup":
        this.tone("sine", 900 + Math.random() * 300, 1800, 0.12, 0.18 * volume);
        this.tone("sine", 1400 + Math.random() * 300, 2400, 0.14, 0.12 * volume, 0.06);
        break;
      case "craft":
        this.noise("lowpass", 900, 1, 0.08, 0.4 * volume, 0.1);
        this.noise("lowpass", 700, 1, 0.1, 0.4 * volume, 0.1);
        this.tone("triangle", 600, 900, 0.1, 0.1 * volume, 0.05);
        break;
      case "click":
        this.tone("square", 1200, 900, 0.03, 0.06 * volume);
        break;
      case "eat":
        for (let i = 0; i < 3; i++) setTimeout(() => this.noise("lowpass", 1100, 1, 0.09, 0.4 * volume, 0.3), i * 140);
        break;
      case "toolbreak":
        this.noise("highpass", 2000, 1, 0.2, 0.5 * volume, 0.1);
        this.tone("square", 500, 120, 0.25, 0.12 * volume);
        break;
      case "ding":
        this.tone("sine", 1046, 1046, 0.4, 0.15 * volume);
        this.tone("sine", 1568, 1568, 0.5, 0.1 * volume, 0.12);
        break;
    }
  }

  private startWind() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 350;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.03;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.ambient);
    src.start();
    lfo.start();
  }

  setAmbientLevel(level: number) {
    if (!this.ctx) return;
    this.ambient.gain.setTargetAtTime(level, this.ctx.currentTime, 0.5);
  }

  /** Call every frame; schedules gentle generative music. */
  update(dt: number) {
    if (!this.ctx || this.musicVolume <= 0 || this.ctx.state !== "running") return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 2.5 + Math.random() * 5;
    const day = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99];
    const nightScale = [220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const scale = this.night ? nightScale : day;
    const base = scale[Math.floor(Math.random() * scale.length)] * (this.night ? 0.5 : 1);
    this.pad(base, 0.06);
    if (Math.random() < 0.5) this.pad(base * (Math.random() < 0.5 ? 1.5 : 1.25), 0.035, 0.6 + Math.random());
    if (Math.random() < 0.3) this.pad(base * 2, 0.02, 1.5 + Math.random());
  }

  private pad(freq: number, gain: number, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 1.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
    const o1 = ctx.createOscillator();
    o1.type = "sine";
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = freq * 1.003;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1200;
    o1.connect(f);
    o2.connect(f);
    f.connect(g).connect(this.music);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 6);
    o2.stop(t + 6);
  }
}
