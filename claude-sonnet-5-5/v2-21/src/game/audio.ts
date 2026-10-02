// ===== Fully synthesized audio: SFX + reactive procedural music (Web Audio API) =====
type Mode = 'off' | 'menu' | 'run' | 'boss';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const PROG: Record<'menu' | 'run' | 'boss', { roots: number[]; q: number[][] }> = {
  menu: { roots: [45, 41, 48, 43], q: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]] },
  run: { roots: [45, 41, 48, 43], q: [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]] },
  boss: { roots: [45, 41, 38, 40], q: [[0, 3, 7], [0, 4, 7], [0, 3, 7], [0, 4, 7]] },
};

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode; lp!: BiquadFilterNode;
  vol = { master: 0.7, music: 0.6, sfx: 0.8 };
  muted = false;
  mode: Mode = 'off';
  intensity = 0;
  heat = 0;
  muffled = false;
  private step = 0;
  private nextT = 0;
  timer: number | null = null;
  private noise: AudioBuffer | null = null;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 6;
      this.master = ctx.createGain(); this.musicBus = ctx.createGain(); this.sfxBus = ctx.createGain();
      this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 18000;
      this.musicBus.connect(this.lp); this.lp.connect(this.master); this.sfxBus.connect(this.master);
      this.master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 1;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.applyVol();
      this.nextT = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.tick(), 30);
    } catch { this.ctx = null; }
  }
  setVolumes(master: number, music: number, sfx: number, muted: boolean) {
    this.vol = { master, music, sfx }; this.muted = muted; this.applyVol();
  }
  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }
  setMode(m: Mode) { if (this.mode !== m) { this.mode = m; this.step = 0; if (this.ctx) this.nextT = this.ctx.currentTime + 0.08; } }
  setIntensity(i: number, heat: number) { this.intensity = Math.max(0, Math.min(1, i)); this.heat = heat; }
  setMuffle(on: boolean) {
    if (this.muffled === on || !this.ctx) { this.muffled = on; return; }
    this.muffled = on;
    this.lp.frequency.setTargetAtTime(on ? 500 : 18000, this.ctx.currentTime, 0.08);
  }

  // ---- primitives ----
  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0, bus?: GainNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus ?? this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }
  private nz(dur: number, vol: number, freq: number, type: BiquadFilterType, delay = 0, bus?: GainNode, q = 1) {
    const ctx = this.ctx; if (!ctx || !this.noise) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus ?? this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  sfx(name: string, p = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = name === 'chip' || name === 'hackKey' || name === 'slide' ? 0.03 : 0.045;
    if (this.lastSfx[name] && now - this.lastSfx[name] < gap) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'jump': this.tone(260, 520, 0.16, 'square', 0.12); this.nz(0.08, 0.1, 1800, 'highpass'); break;
      case 'hop': this.tone(420, 840, 0.14, 'triangle', 0.18); break;
      case 'land': this.nz(0.12, 0.25 * Math.min(1.5, p), 400, 'lowpass'); this.tone(120, 50, 0.12, 'sine', 0.3 * Math.min(1.5, p)); break;
      case 'slide': this.nz(0.35, 0.16, 1400, 'bandpass'); break;
      case 'roll': this.nz(0.25, 0.2, 900, 'bandpass'); this.tone(300, 600, 0.12, 'triangle', 0.15); break;
      case 'dash': this.nz(0.22, 0.28, 900, 'bandpass', 0, undefined, 2); this.tone(200, 900, 0.2, 'sawtooth', 0.1); break;
      case 'vault': this.tone(300, 500, 0.1, 'square', 0.1); this.nz(0.06, 0.12, 2000, 'highpass'); break;
      case 'wall': this.tone(180, 360, 0.3, 'sawtooth', 0.09); this.nz(0.3, 0.1, 1200, 'bandpass'); break;
      case 'stunt': { const b = 520 * Math.pow(1.0595, Math.min(12, p) * 2); this.tone(b, b * 1.5, 0.14, 'triangle', 0.16); this.tone(b * 2, b * 2, 0.1, 'sine', 0.08, 0.06); break; }
      case 'hit': this.nz(0.2, 0.4, 700, 'lowpass'); this.tone(160, 40, 0.25, 'sawtooth', 0.3); this.tone(900, 200, 0.1, 'square', 0.1); break;
      case 'stomp': this.tone(300, 80, 0.18, 'square', 0.22); this.nz(0.1, 0.2, 1500, 'bandpass'); break;
      case 'tackle': this.nz(0.2, 0.3, 600, 'bandpass'); this.tone(220, 90, 0.16, 'triangle', 0.25); break;
      case 'chip': { const b = 880 * Math.pow(1.0595, Math.min(12, p)); this.tone(b, b * 1.5, 0.09, 'square', 0.07); break; }
      case 'vent': this.nz(0.4, 0.3, 700, 'bandpass', 0, undefined, 0.7); this.tone(100, 400, 0.35, 'sine', 0.2); break;
      case 'laser': this.tone(1200, 300, 0.2, 'sawtooth', 0.14); this.nz(0.15, 0.2, 3000, 'highpass'); break;
      case 'bolt': this.tone(900, 250, 0.18, 'square', 0.1); break;
      case 'telegraph': this.tone(700, 700, 0.06, 'square', 0.05); break;
      case 'alarm': this.tone(600, 900, 0.22, 'sawtooth', 0.15); this.tone(900, 600, 0.22, 'sawtooth', 0.15, 0.22); break;
      case 'warn': this.tone(300, 300, 0.12, 'square', 0.12); this.tone(300, 300, 0.12, 'square', 0.12, 0.18); break;
      case 'hackKey': this.tone(1000 + p * 100, 1000 + p * 100, 0.05, 'square', 0.08); break;
      case 'hackOk': [0, 1, 2, 3].forEach((i) => this.tone(520 * Math.pow(1.26, i), 520 * Math.pow(1.26, i), 0.14, 'square', 0.1, i * 0.07)); break;
      case 'hackFail': this.tone(300, 60, 0.4, 'sawtooth', 0.22); this.nz(0.3, 0.2, 2500, 'highpass'); break;
      case 'hackOpen': this.tone(200, 1600, 0.3, 'sawtooth', 0.1); this.nz(0.3, 0.12, 4000, 'highpass'); break;
      case 'emp': this.tone(80, 1200, 0.5, 'sawtooth', 0.2); this.nz(0.5, 0.35, 1200, 'bandpass', 0, undefined, 0.5); break;
      case 'smoke': this.nz(0.8, 0.3, 700, 'lowpass'); this.tone(150, 60, 0.5, 'sine', 0.2); break;
      case 'boom': this.nz(0.6, 0.55, 500, 'lowpass'); this.tone(90, 25, 0.5, 'sine', 0.5); break;
      case 'busted': this.tone(500, 100, 0.8, 'sawtooth', 0.25); this.tone(400, 80, 0.8, 'square', 0.18, 0.1); this.nz(0.6, 0.3, 600, 'lowpass'); break;
      case 'deliver': [0, 4, 7, 12, 16].forEach((n, i) => this.tone(mtof(60 + n), mtof(60 + n), 0.35, 'triangle', 0.15, i * 0.09)); break;
      case 'gate': this.tone(400, 800, 0.2, 'triangle', 0.12); this.tone(800, 1200, 0.2, 'triangle', 0.1, 0.1); break;
      case 'ui': this.tone(700, 900, 0.06, 'square', 0.06); break;
      case 'confirm': this.tone(500, 500, 0.07, 'square', 0.08); this.tone(800, 800, 0.1, 'square', 0.08, 0.07); break;
      case 'back': this.tone(500, 300, 0.1, 'square', 0.07); break;
      case 'buy': this.tone(600, 600, 0.06, 'square', 0.09); this.tone(900, 900, 0.06, 'square', 0.09, 0.06); this.tone(1200, 1200, 0.12, 'square', 0.09, 0.12); break;
      case 'deny': this.tone(160, 120, 0.2, 'square', 0.12); break;
      case 'phase': this.tone(60, 30, 1, 'sawtooth', 0.3); this.nz(1, 0.3, 300, 'lowpass'); break;
      case 'heal': this.tone(700, 1400, 0.25, 'sine', 0.14); break;
      case 'pause': this.tone(400, 200, 0.12, 'triangle', 0.1); break;
    }
  }

  // ---- music ----
  private tick() {
    const ctx = this.ctx; if (!ctx || this.mode === 'off') return;
    let guard = 0;
    while (this.nextT < ctx.currentTime + 0.14 && guard++ < 8) {
      const I = this.mode === 'menu' ? 0 : this.mode === 'boss' ? Math.max(0.55, this.intensity) : this.intensity;
      const bpm = this.mode === 'menu' ? 92 : 114 + I * 20;
      this.playStep(this.step, this.nextT, I);
      this.nextT += 60 / bpm / 4;
      this.step++;
    }
  }
  private note(f: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff = 2000) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); const g = ctx.createGain(); const fl = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(cutoff, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  private drum(kind: 'k' | 's' | 'h', t: number, vol: number) {
    const ctx = this.ctx!;
    if (kind === 'k') {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.2);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.26);
    } else if (this.noise) {
      const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); const g = ctx.createGain();
      f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000;
      const d = kind === 's' ? 0.16 : 0.05;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      s.connect(f); f.connect(g); g.connect(this.musicBus); s.start(t, Math.random() * 0.4); s.stop(t + d + 0.02);
    }
  }
  private playStep(step: number, t: number, I: number) {
    const pr = PROG[this.mode === 'off' ? 'menu' : this.mode];
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const root = pr.roots[bar], q = pr.q[bar];
    const sd = 60 / (this.mode === 'menu' ? 92 : 114 + I * 20) / 4;
    if (s === 0) {
      for (const iv of q) { this.note(mtof(root + 12 + iv), t, sd * 15, 'sawtooth', 0.035, 900); this.note(mtof(root + 12 + iv) * 1.004, t, sd * 15, 'sawtooth', 0.03, 700); }
    }
    if (this.mode === 'menu') {
      if (s % 2 === 0) this.note(mtof(root + 24 + q[(s / 2) % 3]), t, sd * 3, 'triangle', 0.05, 2500);
      if (s === 0 || s === 8) this.note(mtof(root - 12), t, sd * 7, 'sine', 0.2, 400);
      return;
    }
    if (I > 0.02 && (s % 2 === 0)) {
      const oct = s === 6 || s === 14 ? 12 : 0;
      this.note(mtof(root - 12 + oct), t, sd * 1.8, 'sawtooth', 0.14 + I * 0.06, 500 + I * 900);
    }
    if (I > 0.12 && s % 4 === 0) this.drum('k', t, 0.6);
    if (I > 0.3 && s % 2 === 1) this.drum('h', t, 0.12);
    if (I > 0.8 && s % 2 === 0) this.drum('h', t, 0.07);
    if (I > 0.5 && (s === 4 || s === 12)) this.drum('s', t, 0.3);
    if (I > 0.62) {
      const idx = [0, 1, 2, 1][s % 4];
      this.note(mtof(root + 24 + q[idx] + (s >= 8 ? 12 : 0)), t, sd * 0.9, 'square', 0.04 + I * 0.025, 3000);
    }
    if (I > 0.85 && s % 8 === 0) this.note(mtof(root + 36 + q[(bar + s) % 3]), t, sd * 6, 'sawtooth', 0.05, 3500);
    if (this.heat >= 2 && s % 4 === 0) this.note(((s / 4) | 0) % 2 === 0 ? 660 : 880, t, sd * 3, 'sawtooth', 0.025 + this.heat * 0.006, 1800);
  }
}
export const audio = new AudioEngine();
