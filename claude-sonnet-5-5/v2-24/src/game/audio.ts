// Fully synthesized audio: SFX + generative, mood-reactive ambient music.
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export type Sfx =
  | 'place' | 'error' | 'splash' | 'coin' | 'harvest' | 'alarm' | 'thunder' | 'quake' | 'research'
  | 'win' | 'lose' | 'click' | 'toggle' | 'demolish' | 'warn' | 'cough' | 'upgrade' | 'drip';

const CALM: number[][] = [[57, 60, 64], [53, 57, 60], [48, 55, 60], [55, 59, 62]];
const DARK: number[][] = [[57, 60, 63], [56, 59, 62], [53, 56, 60], [52, 56, 59]];
const PENT_CALM = [69, 72, 74, 76, 79, 81, 84];
const PENT_DARK = [69, 72, 75, 77, 79, 81, 84];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private rainG!: GainNode;
  private delay!: DelayNode;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextT = 0;
  private stepN = 0;
  private playing = false;
  vol = { master: 0.7, music: 0.5, sfx: 0.8 };
  muted = false;
  danger = 0;
  rain = 0;
  private lastSfx: Record<string, number> = {};

  init() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.musicG = ctx.createGain();
        this.sfxG = ctx.createGain();
        this.rainG = ctx.createGain();
        this.rainG.gain.value = 0;
        this.musicG.connect(this.master);
        this.sfxG.connect(this.master);
        this.rainG.connect(this.master);
        const comp = ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(ctx.destination);
        this.delay = ctx.createDelay(1);
        this.delay.delayTime.value = 0.36;
        const fb = ctx.createGain();
        fb.gain.value = 0.38;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2400;
        this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay);
        lp.connect(this.musicG);
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        // rain bed
        const src = ctx.createBufferSource();
        src.buffer = buf; src.loop = true;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.5;
        src.connect(f); f.connect(this.rainG); src.start();
        this.applyVolumes();
      } catch { this.ctx = null; return; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  setVolumes(master: number, music: number, sfx: number, muted: boolean) {
    this.vol = { master, music, sfx };
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.05);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.8, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  setMood(danger: number, rain: number) {
    this.danger = Math.max(0, Math.min(1, danger));
    this.rain = rain;
    if (this.ctx) this.rainG.gain.setTargetAtTime(Math.min(0.5, rain) * 0.5, this.ctx.currentTime, 0.4);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => undefined); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined); }

  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.nextT = this.ctx.currentTime + 0.1;
    this.stepN = 0;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  stopMusic() {
    this.playing = false;
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    if (this.ctx) this.rainG.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    while (this.nextT < ctx.currentTime + 0.4) {
      const bpm = 64 + this.danger * 34;
      const eighth = 60 / bpm / 2;
      this.playStep(this.nextT, this.stepN, eighth);
      this.nextT += eighth;
      this.stepN++;
    }
  }

  private playStep(t: number, n: number, eighth: number) {
    const ctx = this.ctx!;
    const dark = this.danger > 0.35;
    const prog = dark ? DARK : CALM;
    const scale = dark ? PENT_DARK : PENT_CALM;
    const bar = Math.floor(n / 8) % 4;
    const stepIn = n % 8;
    const chord = prog[bar];
    if (stepIn === 0) {
      chord.forEach((m, i) => {
        const o = ctx.createOscillator();
        const o2 = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle'; o2.type = 'sine';
        o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 1.004;
        const dur = eighth * 8;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.07 - i * 0.012, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0, t + dur * 1.05);
        o.connect(g); o2.connect(g); g.connect(this.musicG);
        o.start(t); o2.start(t); o.stop(t + dur * 1.1); o2.stop(t + dur * 1.1);
      });
      // bass
      const b = ctx.createOscillator(); const bg = ctx.createGain();
      b.type = 'sine'; b.frequency.value = mtof(chord[0] - 24);
      bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.16, t + 0.1);
      bg.gain.linearRampToValueAtTime(0, t + eighth * 7);
      b.connect(bg); bg.connect(this.musicG); b.start(t); b.stop(t + eighth * 7.2);
    }
    // water-drop plucks
    const prob = 0.32 + this.danger * 0.25;
    if (Math.random() < prob) {
      const m = scale[Math.floor(Math.random() * scale.length)];
      this.pluck(t, mtof(m), 0.07, true);
    }
    // danger pulse
    if (this.danger > 0.25 && stepIn % 2 === 0) {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = mtof(chord[0] - 24);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260 + this.danger * 300;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09 * this.danger, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + eighth * 1.6);
      o.connect(f); f.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + eighth * 1.8);
    }
  }

  private pluck(t: number, f: number, v: number, echo: boolean) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(this.musicG);
    if (echo) g.connect(this.delay);
    o.start(t); o.stop(t + 0.75);
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(dur: number, type: BiquadFilterType, f0: number, f1: number, vol: number, delay = 0, q = 1) {
    const ctx = this.ctx; if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfxG);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  sfx(name: Sfx) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap: Partial<Record<Sfx, number>> = { splash: 0.25, place: 0.03, drip: 0.15, coin: 0.05, cough: 0.4, error: 0.15, thunder: 0.8 };
    const g = gap[name] ?? 0;
    if (g && this.lastSfx[name] && now - this.lastSfx[name] < g) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'place': this.tone(190, 0.12, 'triangle', 0.35, 0.6); this.noise(0.08, 'lowpass', 1400, 300, 0.25); break;
      case 'demolish': this.noise(0.28, 'lowpass', 900, 120, 0.5); this.tone(110, 0.2, 'square', 0.12, 0.5); break;
      case 'error': this.tone(130, 0.18, 'sawtooth', 0.2, 0.7); break;
      case 'click': this.tone(660, 0.05, 'square', 0.08); break;
      case 'toggle': this.tone(300, 0.07, 'square', 0.14, 0.6); this.noise(0.06, 'bandpass', 1500, 800, 0.2); break;
      case 'splash': this.noise(0.35, 'bandpass', 1800, 500, 0.4, 0, 0.8); break;
      case 'drip': this.tone(1200, 0.12, 'sine', 0.12, 0.5); break;
      case 'coin': this.tone(988, 0.09, 'square', 0.1); this.tone(1318, 0.18, 'square', 0.1, 1, 0.07); break;
      case 'harvest': [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.2, 1, i * 0.06)); break;
      case 'research': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.22, 1, i * 0.08)); break;
      case 'upgrade': [392, 523, 659].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.2, 1, i * 0.07)); break;
      case 'warn': this.tone(440, 0.2, 'triangle', 0.2); this.tone(330, 0.3, 'triangle', 0.2, 1, 0.18); break;
      case 'alarm': for (let i = 0; i < 4; i++) this.tone(i % 2 ? 520 : 700, 0.16, 'square', 0.13, 1, i * 0.18); break;
      case 'thunder': this.noise(1.6, 'lowpass', 500, 60, 0.9); this.noise(0.5, 'bandpass', 2500, 400, 0.35); break;
      case 'quake': this.noise(1.8, 'lowpass', 160, 40, 1.0); this.tone(55, 1.4, 'sawtooth', 0.25, 0.6); break;
      case 'cough': this.noise(0.12, 'bandpass', 900, 500, 0.3, 0, 3); this.noise(0.1, 'bandpass', 800, 400, 0.25, 0.14, 3); break;
      case 'win': [392, 523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.25, 1, i * 0.14)); break;
      case 'lose': [392, 330, 262, 196, 147].forEach((f, i) => this.tone(f, 0.55, 'sawtooth', 0.14, 0.97, i * 0.22)); break;
    }
  }
}
