import type { Settings } from './types';

type Scene = 'off' | 'menu' | 'plan' | 'run';

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicG: GainNode | null = null;
  sfxG: GainNode | null = null;
  settings: Settings = { master: 0.7, music: 0.6, sfx: 0.8, muted: false, shake: true, speedDefault: 1 };
  scene: Scene = 'off';
  intensity = 0;
  timer: number | null = null;
  nextT = 0;
  step = 0;
  siren: { o: OscillatorNode; g: GainNode; l: OscillatorNode } | null = null;
  noiseBuf: AudioBuffer | null = null;
  lastPlay: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicG = this.ctx.createGain();
      this.sfxG = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      this.musicG.connect(this.master);
      this.sfxG.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
      this.nextT = this.ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 40);
    } catch { this.ctx = null; }
  }

  apply() {
    if (!this.ctx || !this.master || !this.musicG || !this.sfxG) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.05);
    this.musicG.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
    this.sfxG.gain.setTargetAtTime(s.sfx, t, 0.05);
  }
  set(s: Settings) { this.settings = s; this.apply(); }
  setScene(sc: Scene) { this.scene = sc; if (sc !== 'run') this.sirenOff(); }
  setIntensity(v: number) { this.intensity = Math.max(0, Math.min(1, v)); }
  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume(); }

  tone(f: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, when = 0, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur: number, vol: number, freq: number, dest: AudioNode, when = 0, type: BiquadFilterType = 'lowpass') {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    src.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t); src.stop(t + dur + 0.05);
  }

  play(name: string) {
    if (!this.ctx || !this.sfxG || this.settings.muted) return;
    const now = this.ctx.currentTime;
    if (this.lastPlay[name] && now - this.lastPlay[name] < 0.06) return;
    this.lastPlay[name] = now;
    const d = this.sfxG;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'square', 0.08, d); break;
      case 'hover': this.tone(880, 0.03, 'sine', 0.04, d); break;
      case 'back': this.tone(330, 0.08, 'square', 0.07, d, 0, -100); break;
      case 'tick': this.tone(1800 + Math.random() * 300, 0.02, 'square', 0.04, d); break;
      case 'unlock': this.tone(520, 0.08, 'triangle', 0.15, d); this.tone(780, 0.14, 'triangle', 0.15, d, 0.07); break;
      case 'coin': this.tone(1200, 0.07, 'square', 0.08, d); this.tone(1800, 0.14, 'square', 0.08, d, 0.06); break;
      case 'cash': [0, 0.07, 0.14, 0.21].forEach((w, i) => this.tone(900 + i * 220, 0.12, 'triangle', 0.12, d, w)); break;
      case 'prize': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, d, i * 0.08)); break;
      case 'ping': this.tone(1000, 0.18, 'sine', 0.1, d); break;
      case 'spot': this.tone(300, 0.25, 'sawtooth', 0.1, d, 0, 500); break;
      case 'alert': this.tone(440, 0.12, 'square', 0.1, d); this.tone(330, 0.2, 'square', 0.1, d, 0.12); break;
      case 'punch': this.noise(0.12, 0.5, 600, d); this.tone(120, 0.12, 'sine', 0.3, d, 0, -60); break;
      case 'hit': this.noise(0.1, 0.4, 900, d); this.tone(90, 0.15, 'sine', 0.3, d, 0, -40); break;
      case 'whisper': this.noise(0.25, 0.15, 3000, d, 0, 'highpass'); break;
      case 'boom': this.noise(0.9, 0.9, 400, d); this.tone(70, 0.7, 'sine', 0.5, d, 0, -45); break;
      case 'emp': this.tone(1400, 0.5, 'sawtooth', 0.12, d, 0, -1200); this.noise(0.4, 0.2, 5000, d, 0, 'highpass'); break;
      case 'smoke': this.noise(0.5, 0.25, 1500, d, 0, 'bandpass'); break;
      case 'arrest': this.tone(300, 0.35, 'sawtooth', 0.14, d, 0, -200); this.tone(200, 0.4, 'sawtooth', 0.14, d, 0.2, -120); break;
      case 'police': for (let i = 0; i < 4; i++) { this.tone(760, 0.25, 'sawtooth', 0.1, d, i * 0.5); this.tone(960, 0.25, 'sawtooth', 0.1, d, i * 0.5 + 0.25); } break;
      case 'siren': this.sirenOn(); break;
      case 'win': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.16, d, i * 0.12)); break;
      case 'lose': [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.12, d, i * 0.2)); break;
      case 'upgrade': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.13, d, i * 0.06)); break;
      case 'go': [196, 262, 330].forEach((f, i) => this.tone(f, 0.25, 'square', 0.1, d, i * 0.1)); break;
      case 'error': this.tone(160, 0.2, 'square', 0.12, d); break;
    }
  }

  sirenOn() {
    if (!this.ctx || !this.sfxG || this.siren) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain(), l = this.ctx.createOscillator(), lg = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 620; l.frequency.value = 1.3; lg.gain.value = 180;
    g.gain.value = 0.045;
    l.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(this.sfxG);
    o.start(); l.start();
    this.siren = { o, g, l };
  }
  sirenOff() {
    if (!this.siren || !this.ctx) return;
    const { o, g, l } = this.siren;
    g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    o.stop(this.ctx.currentTime + 0.5); l.stop(this.ctx.currentTime + 0.5);
    this.siren = null;
  }

  // reactive procedural noir score
  schedule() {
    if (!this.ctx || !this.musicG || this.scene === 'off' || this.settings.muted || this.ctx.state !== 'running') return;
    const sc = this.scene;
    const I = sc === 'run' ? this.intensity : sc === 'plan' ? 0.12 : 0.05;
    const bpm = sc === 'menu' ? 78 : sc === 'plan' ? 92 : 100 + I * 44;
    const stepDur = 60 / bpm / 4;
    while (this.nextT < this.ctx.currentTime + 0.15) {
      this.beat(this.step, this.nextT - this.ctx.currentTime, I, sc, stepDur);
      this.nextT += stepDur;
      this.step++;
    }
  }
  beat(n: number, when: number, I: number, sc: Scene, sd: number) {
    const m = this.musicG!;
    const s = n % 16, bar = Math.floor(n / 16) % 4;
    const roots = [45, 41, 38, 40];
    const root = roots[bar];
    const mf = (x: number) => 440 * Math.pow(2, (x - 69) / 12);
    const minor = [0, 3, 7, 10, 12, 15];
    // bass
    if (s % 4 === 0 || (I > 0.4 && s % 4 === 2) || (s === 14 && I > 0.2)) {
      const note = root + (s === 14 ? 7 : s === 8 ? 12 : 0);
      this.tone(mf(note), sd * 3, sc === 'run' && I > 0.6 ? 'sawtooth' : 'triangle', sc === 'run' && I > 0.6 ? 0.09 : 0.18, m, when);
    }
    // pad at bar start
    if (s === 0) {
      [0, 3, 7, 10].forEach(iv => this.tone(mf(root + 24 + iv), sd * 15, 'sine', 0.035, m, when));
    }
    // hats
    if (sc !== 'menu' && (s % 2 === 0 || I > 0.5)) this.noise(0.04, 0.05 + I * 0.05, 8000, m, when, 'highpass');
    // kick & snare when tense
    if (sc === 'run' && I > 0.3) {
      if (s % 4 === 0) { this.tone(110, 0.15, 'sine', 0.3, m, when, -70); }
      if (I > 0.55 && s % 8 === 4) this.noise(0.12, 0.2, 1800, m, when, 'bandpass');
    }
    // vibes / arp
    const arpOn = sc === 'menu' ? s % 4 === 2 : sc === 'plan' ? s % 8 === 3 || s === 10 : I > 0.2 ? s % 2 === 1 : s % 8 === 6;
    if (arpOn) {
      const iv = minor[(n * 3 + bar * 2) % minor.length];
      this.tone(mf(root + 36 + iv), sd * 2.5, sc === 'run' && I > 0.5 ? 'square' : 'sine', sc === 'run' && I > 0.5 ? 0.04 : 0.06, m, when);
    }
    // alarm stab
    if (sc === 'run' && I > 0.85 && s % 4 === 0) this.tone(mf(root + 48), sd * 2, 'sawtooth', 0.035, m, when, -20);
  }
}

export const audio = new AudioEngine();
