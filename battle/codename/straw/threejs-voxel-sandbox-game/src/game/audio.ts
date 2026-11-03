// Synthesized audio: all SFX + ambient music generated with WebAudio (no assets).
import type { SoundType } from './blocks';

export function volAt(dist: number, ref = 14): number {
  return Math.max(0, 1 - dist / ref);
}

interface ToneOpts { f: number; f2?: number; dur: number; type?: OscillatorType; vol?: number; delay?: number }
interface NoiseOpts { dur: number; freq: number; freq2?: number; q?: number; type?: BiquadFilterType; vol?: number; delay?: number }

export class Sfx {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private delaySend!: GainNode;
  private noiseBuf!: AudioBuffer;
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  volume = 0.8;
  musicOn = true;
  private musicIn = 18;
  private birdIn = 6;
  private cricketIn = 4;
  private phraseNotes: { t: number; f: number }[] = [];

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    // echo for music / ambient spaciousness
    const delay = ctx.createDelay(1); delay.delayTime.value = 0.42;
    const fb = ctx.createGain(); fb.gain.value = 0.34;
    const wet = ctx.createGain(); wet.gain.value = 0.3;
    const dFilter = ctx.createBiquadFilter(); dFilter.type = 'lowpass'; dFilter.frequency.value = 2200;
    this.delaySend = ctx.createGain(); this.delaySend.gain.value = 1;
    this.delaySend.connect(delay); delay.connect(dFilter); dFilter.connect(fb); fb.connect(delay);
    dFilter.connect(wet); wet.connect(this.master);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // ambient loops: wind + rain
    const mkLoop = (type: BiquadFilterType, freq: number) => {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      return g;
    };
    this.windGain = mkLoop('lowpass', 380);
    this.rainGain = mkLoop('bandpass', 1400);
    if (this.windGain) this.windGain.gain.value = 0.012;
  }

  setVolume(v: number) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setRain(i: number) { if (this.rainGain && this.ctx) this.rainGain.gain.setTargetAtTime(i * 0.16, this.ctx.currentTime, 0.4); }
  setWind(v: number) { if (this.windGain && this.ctx) this.windGain.gain.setTargetAtTime(0.008 + v * 0.05, this.ctx.currentTime, 0.6); }

  private tone(o: ToneOpts, dest?: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t0 + o.dur);
    const g = ctx.createGain();
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g); g.connect(dest ?? this.master);
    osc.start(t0); osc.stop(t0 + o.dur + 0.05);
  }

  private noise(o: NoiseOpts) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime + (o.delay ?? 0);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = o.type ?? 'lowpass';
    f.frequency.setValueAtTime(o.freq, t0);
    if (o.freq2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freq2), t0 + o.dur);
    f.Q.value = o.q ?? 0.8;
    const g = ctx.createGain();
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0, Math.random() * 1.5); src.stop(t0 + o.dur + 0.05);
  }

  // ---- material-based block sounds ----
  private matHit(s: SoundType, vol: number, heavy: boolean) {
    const v = vol * (heavy ? 1 : 0.55);
    switch (s) {
      case 'stone': this.noise({ dur: heavy ? 0.18 : 0.09, freq: 700, vol: v * 0.5 }); this.tone({ f: 140 + Math.random() * 40, f2: 70, dur: 0.08, type: 'triangle', vol: v * 0.25 }); break;
      case 'wood': this.tone({ f: 190 + Math.random() * 30, f2: 120, dur: 0.09, type: 'square', vol: v * 0.12 }); this.noise({ dur: 0.07, freq: 1100, type: 'bandpass', q: 2, vol: v * 0.3 }); break;
      case 'dirt': case 'grass': this.noise({ dur: heavy ? 0.16 : 0.1, freq: 480, vol: v * 0.5 }); break;
      case 'sand': this.noise({ dur: 0.12, freq: 1600, type: 'highpass', vol: v * 0.22 }); break;
      case 'glass':
        if (heavy) { for (let i = 0; i < 5; i++) this.tone({ f: 1500 + Math.random() * 1600, dur: 0.16, type: 'sine', vol: v * 0.16, delay: i * 0.03 }); }
        else this.tone({ f: 2100, dur: 0.06, vol: v * 0.15 });
        break;
      case 'snow': this.noise({ dur: 0.14, freq: 900, vol: v * 0.4 }); break;
      case 'cloth': this.noise({ dur: 0.08, freq: 700, vol: v * 0.2 }); break;
      case 'plant': this.noise({ dur: 0.09, freq: 2000, type: 'highpass', vol: v * 0.18 }); break;
    }
  }
  dig(s: SoundType, vol = 1) { this.matHit(s, vol, false); }
  breakBlock(s: SoundType, vol = 1) { this.matHit(s, vol, true); if (s !== 'glass') this.noise({ dur: 0.14, freq: 420, vol: vol * 0.25, delay: 0.01 }); }
  place(s: SoundType, vol = 1) { this.matHit(s, vol * 0.8, false); this.tone({ f: 220, f2: 160, dur: 0.05, type: 'triangle', vol: vol * 0.1 }); }
  step(s: SoundType, vol = 0.5) {
    if (s === 'grass' || s === 'dirt' || s === 'snow') this.noise({ dur: 0.07, freq: s === 'snow' ? 800 : 500, vol: vol * 0.16 });
    else if (s === 'sand') this.noise({ dur: 0.07, freq: 1400, type: 'highpass', vol: vol * 0.08 });
    else if (s === 'wood') this.tone({ f: 160 + Math.random() * 30, f2: 110, dur: 0.06, type: 'triangle', vol: vol * 0.12 });
    else this.noise({ dur: 0.05, freq: 800, vol: vol * 0.13 });
  }

  // ---- gameplay sounds ----
  hurt(vol = 1) { this.tone({ f: 300, f2: 140, dur: 0.16, type: 'square', vol: vol * 0.18 }); this.noise({ dur: 0.1, freq: 600, vol: vol * 0.2 }); }
  mobHit(vol = 1) { this.noise({ dur: 0.09, freq: 900, type: 'bandpass', q: 1.5, vol: vol * 0.3 }); }
  mobDie(vol = 1) { this.tone({ f: 240, f2: 50, dur: 0.35, type: 'sawtooth', vol: vol * 0.12 }); this.noise({ dur: 0.25, freq: 500, vol: vol * 0.15 }); }
  eat() { this.noise({ dur: 0.09, freq: 700, vol: 0.25 }); this.noise({ dur: 0.09, freq: 550, vol: 0.22, delay: 0.16 }); this.noise({ dur: 0.1, freq: 800, vol: 0.2, delay: 0.32 }); }
  burp() { this.tone({ f: 180, f2: 90, dur: 0.18, type: 'square', vol: 0.08 }); }
  pickup() { this.tone({ f: 660, f2: 990, dur: 0.09, type: 'sine', vol: 0.16 }); }
  splash(big = false, vol = 1) { this.noise({ dur: big ? 0.5 : 0.22, freq: 1000, freq2: 400, type: 'bandpass', q: 0.7, vol: vol * (big ? 0.5 : 0.25) }); }
  explosion(vol = 1) {
    this.noise({ dur: 0.9, freq: 1000, freq2: 60, vol: vol * 0.9 });
    this.tone({ f: 90, f2: 34, dur: 0.8, type: 'sine', vol: vol * 0.7 });
  }
  fuse() { this.noise({ dur: 1.1, freq: 3000, type: 'highpass', vol: 0.12 }); }
  toolBreak() { this.noise({ dur: 0.15, freq: 1400, type: 'bandpass', q: 2, vol: 0.3 }); this.tone({ f: 500, f2: 200, dur: 0.12, type: 'square', vol: 0.08 }); }
  click() { this.tone({ f: 700, f2: 500, dur: 0.05, type: 'square', vol: 0.06 }); }
  craft() { this.tone({ f: 520, dur: 0.07, type: 'triangle', vol: 0.15 }); this.tone({ f: 780, dur: 0.1, type: 'triangle', vol: 0.15, delay: 0.06 }); }
  achievement() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, dur: 0.35, type: 'triangle', vol: 0.14, delay: i * 0.09 }, this.delaySend)); }
  chest() { this.tone({ f: 240, f2: 330, dur: 0.16, type: 'sawtooth', vol: 0.05 }); this.noise({ dur: 0.1, freq: 900, vol: 0.08 }); }
  thunder() { this.noise({ dur: 1.6, freq: 220, freq2: 50, vol: 0.5 }); this.noise({ dur: 0.25, freq: 1800, vol: 0.2 }); }
  levelup() { [440, 554, 659, 880].forEach((f, i) => this.tone({ f, dur: 0.4, type: 'sine', vol: 0.12, delay: i * 0.08 }, this.delaySend)); }

  // ---- creature voices ----
  zombie(vol = 1) { this.tone({ f: 95 + Math.random() * 30, f2: 65, dur: 0.6, type: 'sawtooth', vol: vol * 0.11 }); }
  pig(vol = 1) { this.tone({ f: 300, f2: 180, dur: 0.12, type: 'square', vol: vol * 0.1 }); this.tone({ f: 280, f2: 160, dur: 0.1, type: 'square', vol: vol * 0.09, delay: 0.16 }); }
  cow(vol = 1) { this.tone({ f: 170, f2: 120, dur: 0.55, type: 'sawtooth', vol: vol * 0.09 }); this.tone({ f: 88, f2: 70, dur: 0.55, type: 'triangle', vol: vol * 0.1 }); }
  sheep(vol = 1) { for (let i = 0; i < 3; i++) this.tone({ f: 330 + Math.random() * 60, f2: 260, dur: 0.11, type: 'sawtooth', vol: vol * 0.07, delay: i * 0.12 }); }
  chicken(vol = 1) { this.tone({ f: 900, f2: 1400, dur: 0.08, type: 'square', vol: vol * 0.07 }); this.tone({ f: 800, f2: 1200, dur: 0.09, type: 'square', vol: vol * 0.06, delay: 0.12 }); }

  // ---- ambience & generative music ----
  update(dt: number, inGame: boolean, isDay: boolean, biome?: string) {
    if (!this.ctx || !inGame) return;
    // scheduled music notes
    for (let i = this.phraseNotes.length - 1; i >= 0; i--) {
      this.phraseNotes[i].t -= dt;
      if (this.phraseNotes[i].t <= 0) {
        this.pluck(this.phraseNotes[i].f);
        this.phraseNotes.splice(i, 1);
      }
    }
    if (this.musicOn) {
      this.musicIn -= dt;
      if (this.musicIn <= 0) {
        this.musicIn = 40 + Math.random() * 60;
        const scale = [261.6, 293.7, 329.6, 392, 440, 523.3, 587.3, 659.3];
        let idxN = 2 + ((Math.random() * 3) | 0);
        const n = 4 + ((Math.random() * 4) | 0);
        let t = 0;
        for (let i = 0; i < n; i++) {
          this.phraseNotes.push({ t, f: scale[idxN] });
          idxN = Math.max(0, Math.min(scale.length - 1, idxN + ((Math.random() * 5) | 0) - 2));
          t += 0.85 + Math.random() * 0.9;
        }
        if (Math.random() < 0.6) this.phraseNotes.push({ t: 0.02, f: scale[0] / 2 });
      }
    }
    if (isDay && biome !== 'desert') {
      this.birdIn -= dt;
      if (this.birdIn <= 0) {
        this.birdIn = 4 + Math.random() * 10;
        const base = 2200 + Math.random() * 800;
        const chirps = 2 + ((Math.random() * 3) | 0);
        for (let i = 0; i < chirps; i++) this.tone({ f: base, f2: base * (1.2 + Math.random() * 0.3), dur: 0.09, type: 'sine', vol: 0.028, delay: i * 0.14 }, this.delaySend);
      }
    } else if (!isDay) {
      this.cricketIn -= dt;
      if (this.cricketIn <= 0) {
        this.cricketIn = 2.5 + Math.random() * 5;
        for (let i = 0; i < 5; i++) this.tone({ f: 4300, dur: 0.03, type: 'sine', vol: 0.014, delay: i * 0.07 });
      }
    }
  }

  private pluck(freq: number) {
    if (!this.ctx) return;
    const ctx = this.ctx, t0 = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = freq;
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = freq * 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(0.07, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400;
    osc.connect(f); osc2.connect(g2); g2.connect(f); f.connect(g);
    g.connect(this.master); g.connect(this.delaySend);
    osc.start(t0); osc2.start(t0); osc.stop(t0 + 2.5); osc2.stop(t0 + 2.5);
  }
}
