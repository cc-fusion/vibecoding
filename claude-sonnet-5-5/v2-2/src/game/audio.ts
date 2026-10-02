export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicG!: GainNode; sfxG!: GainNode;
  set: AudioSettings = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  tension = 0;
  private timer: number | null = null;
  private nextT = 0;
  private stepN = 0;
  private running = false;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicG = this.ctx.createGain();
      this.sfxG = this.ctx.createGain();
      this.musicG.connect(this.master); this.sfxG.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    } catch { this.ctx = null; }
  }

  setSettings(s: Partial<AudioSettings>) { this.set = { ...this.set, ...s }; this.apply(); }
  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.set.muted ? 0 : this.set.master, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.set.music * 0.8, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.set.sfx, t, 0.03);
  }
  suspend() { this.ctx?.suspend().catch(() => {}); }
  resume() { this.ctx?.resume().catch(() => {}); }

  // ------------------------------------------------------------ primitives
  private tone(f: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfxG);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol = 0.2, freq = 2000, type: BiquadFilterType = 'lowpass', delay = 0, dest?: AudioNode, q = 0.7) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest ?? this.sfxG);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  sfx(name: string, vol = 1) {
    if (!this.ctx || this.set.muted) return;
    const now = this.ctx.currentTime;
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.05) return;
    this.lastSfx[name] = now;
    const v = vol;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'square', 0.06 * v); break;
      case 'select': this.tone(520, 0.05, 'triangle', 0.12 * v); this.tone(780, 0.07, 'triangle', 0.1 * v, 0, 0.04); break;
      case 'place': this.tone(330, 0.08, 'triangle', 0.15 * v, 160); this.tone(990, 0.05, 'sine', 0.07 * v, 0, 0.05); break;
      case 'remove': this.tone(400, 0.1, 'sawtooth', 0.07 * v, -250); break;
      case 'error': this.tone(140, 0.18, 'sawtooth', 0.12 * v, -40); this.tone(120, 0.18, 'square', 0.06 * v, 0, 0.05); break;
      case 'unlock': this.tone(900, 0.04, 'square', 0.07 * v); this.tone(1300, 0.05, 'square', 0.07 * v, 0, 0.08); this.noise(0.06, 0.12 * v, 4000, 'highpass', 0.14); break;
      case 'breach': this.noise(0.5, 0.5 * v, 700, 'lowpass'); this.tone(90, 0.35, 'sawtooth', 0.3 * v, -50); break;
      case 'hack': for (let i = 0; i < 6; i++) this.tone(600 + Math.random() * 900, 0.04, 'square', 0.05 * v, 0, i * 0.045); break;
      case 'hackdone': this.tone(440, 0.08, 'triangle', 0.14 * v); this.tone(660, 0.08, 'triangle', 0.14 * v, 0, 0.08); this.tone(990, 0.18, 'triangle', 0.14 * v, 0, 0.16); break;
      case 'drill': this.noise(0.5, 0.3 * v, 1500, 'bandpass'); this.tone(120, 0.5, 'sawtooth', 0.12 * v, 40); break;
      case 'crack': this.tone(1500, 0.03, 'square', 0.05 * v); this.tone(1900, 0.03, 'square', 0.05 * v, 0, 0.1); break;
      case 'grab': this.tone(700, 0.06, 'triangle', 0.16 * v, 300); this.tone(1100, 0.12, 'sine', 0.14 * v, 0, 0.06); break;
      case 'cash': this.tone(1200, 0.08, 'square', 0.08 * v); this.tone(1600, 0.2, 'square', 0.08 * v, 0, 0.07); this.noise(0.1, 0.1 * v, 6000, 'highpass', 0.07); break;
      case 'ko': this.noise(0.15, 0.4 * v, 500, 'lowpass'); this.tone(150, 0.2, 'sine', 0.3 * v, -80); break;
      case 'caught': this.tone(300, 0.5, 'sawtooth', 0.2 * v, -220); this.tone(200, 0.5, 'square', 0.1 * v, -120, 0.1); break;
      case 'sus': this.tone(520, 0.12, 'sine', 0.1 * v, 140); break;
      case 'alert': this.tone(880, 0.1, 'square', 0.12 * v); this.tone(660, 0.18, 'square', 0.12 * v, 0, 0.1); break;
      case 'alarm': for (let i = 0; i < 4; i++) { this.tone(900, 0.2, 'square', 0.12 * v, 0, i * 0.4); this.tone(600, 0.2, 'square', 0.12 * v, 0, i * 0.4 + 0.2); } break;
      case 'soft': this.tone(500, 0.1, 'triangle', 0.16 * v); this.tone(500, 0.1, 'triangle', 0.16 * v, 0, 0.16); break;
      case 'laser': this.tone(1800, 0.25, 'sawtooth', 0.15 * v, -1400); break;
      case 'smoke': this.noise(0.8, 0.3 * v, 1200, 'lowpass'); break;
      case 'emp': this.tone(60, 0.6, 'sawtooth', 0.3 * v, 600); this.noise(0.4, 0.3 * v, 3000, 'bandpass', 0.05); break;
      case 'flash': this.noise(0.25, 0.5 * v, 6000, 'highpass'); this.tone(2400, 0.3, 'sine', 0.12 * v, -1800); break;
      case 'dart': this.tone(1400, 0.08, 'triangle', 0.12 * v, -900); break;
      case 'noisemaker': this.tone(1000, 0.1, 'square', 0.15 * v); this.tone(800, 0.1, 'square', 0.15 * v, 0, 0.12); this.tone(1000, 0.1, 'square', 0.15 * v, 0, 0.24); break;
      case 'jam': this.noise(0.6, 0.25 * v, 2500, 'bandpass'); break;
      case 'escape': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.14 * v, 0, i * 0.07)); break;
      case 'win': [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => { this.tone(f, 0.35, 'triangle', 0.15 * v, 0, i * 0.12); this.tone(f / 2, 0.35, 'sine', 0.1 * v, 0, i * 0.12); }); break;
      case 'lose': [440, 392, 349, 262].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.12 * v, -20, i * 0.22)); break;
      case 'levelup': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.2, 'square', 0.08 * v, 0, i * 0.08)); break;
      case 'tick': this.tone(1500, 0.02, 'square', 0.04 * v); break;
      case 'buy': this.tone(800, 0.06, 'square', 0.08 * v); this.tone(1200, 0.12, 'square', 0.08 * v, 0, 0.06); break;
      case 'step': this.noise(0.03, 0.04 * v, 800, 'lowpass'); break;
      case 'police': for (let i = 0; i < 6; i++) this.tone(i % 2 ? 700 : 950, 0.3, 'sine', 0.14 * v, 0, i * 0.3); break;
      case 'whoosh': this.noise(0.3, 0.15 * v, 1500, 'bandpass'); break;
      default: this.tone(600, 0.05, 'sine', 0.1 * v);
    }
  }

  setAlarm(on: boolean) {
    if (!this.ctx) return;
    if (on && !this.sirenOsc) {
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain(); const lfo = this.ctx.createOscillator(); const lg = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 760; lfo.frequency.value = 1.4; lg.gain.value = 180;
      lfo.connect(lg); lg.connect(o.frequency);
      g.gain.value = 0.0001; g.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.3);
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800;
      o.connect(f); f.connect(g); g.connect(this.musicG);
      o.start(); lfo.start();
      this.sirenOsc = o; this.sirenGain = g;
      (o as any)._lfo = lfo;
    } else if (!on && this.sirenOsc) {
      const o = this.sirenOsc, g = this.sirenGain!;
      g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.1);
      const lfo = (o as any)._lfo as OscillatorNode;
      setTimeout(() => { try { o.stop(); lfo.stop(); } catch { /* already stopped */ } }, 600);
      this.sirenOsc = null; this.sirenGain = null;
    }
  }

  // ------------------------------------------------------------ music
  startMusic() {
    if (!this.ctx || this.running) return;
    this.running = true;
    this.nextT = this.ctx.currentTime + 0.1;
    this.stepN = 0;
    this.timer = window.setInterval(() => this.schedule(), 50);
  }
  stopMusic() {
    this.running = false;
    if (this.timer != null) { clearInterval(this.timer); this.timer = null; }
    this.setAlarm(false);
  }
  setTension(t: number) { this.tension = Math.max(0, Math.min(1, t)); }

  private schedule() {
    if (!this.ctx || !this.running) return;
    while (this.nextT < this.ctx.currentTime + 0.2) {
      this.playStep(this.stepN, this.nextT);
      const bpm = 84 + 52 * this.tension;
      this.nextT += 60 / bpm / 4;
      this.stepN++;
    }
  }

  private mTone(f: number, t: number, dur: number, type: OscillatorType, vol: number, lp = 0) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) { const f2 = this.ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp; o.connect(f2); node = f2; }
    node.connect(g); g.connect(this.musicG);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private mNoise(t: number, dur: number, vol: number, freq: number, type: BiquadFilterType) {
    if (!this.ctx || !this.noiseBuf) return;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.musicG);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  private playStep(n: number, t: number) {
    const tn = this.tension;
    const s = n % 16, bar = Math.floor(n / 16);
    // chord roots (A minor noir): Am, F, Dm, E
    const roots = [45, 41, 38, 40];
    const root = roots[bar % 4];
    const minor = [0, 3, 7, 10];
    const chord = bar % 4 === 3 ? [0, 4, 7, 10] : minor;
    // bass
    const bassPat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
    if (bassPat[s]) this.mTone(NOTE(root), t, 0.28, 'triangle', 0.22, 700);
    // pad
    if (s === 0) chord.slice(0, 3).forEach(iv => this.mTone(NOTE(root + 24 + iv), t, 1.9 / (0.6 + tn), 'sine', 0.05));
    // brushes / hats
    if (s % 2 === 0 || tn > 0.4) { const accent = s % 4 === 0 ? 1 : 0.5; this.mNoise(t, 0.04, (0.025 + 0.04 * tn) * accent, 7000, 'highpass'); }
    // kick
    if (tn > 0.35 && s % 4 === 0) { this.mTone(70, t, 0.18, 'sine', 0.3 + 0.2 * tn); }
    // snare
    if (tn > 0.6 && (s === 4 || s === 12)) this.mNoise(t, 0.12, 0.12, 2200, 'bandpass');
    // arp
    if (tn > 0.5 && s % 2 === 0) { const iv = chord[(s / 2 + bar) % chord.length]; this.mTone(NOTE(root + 36 + iv), t, 0.12, 'sawtooth', 0.045 * tn, 1800 + tn * 1500); }
    // vibraphone melody for calm moments
    if (tn < 0.55 && (s === 2 || s === 7 || s === 11 || s === 14) && Math.random() < 0.55 - tn * 0.5) {
      const pent = [0, 3, 5, 7, 10, 12, 15];
      const iv = pent[Math.floor(Math.random() * pent.length)];
      this.mTone(NOTE(root + 36 + iv), t, 0.9, 'sine', 0.07);
      this.mTone(NOTE(root + 48 + iv), t, 0.4, 'sine', 0.025);
    }
    // alarm stinger bass pulse
    if (tn > 0.8 && s % 2 === 1) this.mTone(NOTE(root - 12), t, 0.1, 'square', 0.06, 500);
  }
}

export const audio = new AudioEngine();
