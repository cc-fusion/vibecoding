// ---------- Fully synthesized audio: SFX + reactive noir-jazz / tension music ----------
export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }
export type MusicMode = 'off' | 'menu' | 'plan' | 'heist';

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Engine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicG!: GainNode; sfxG!: GainNode; noiseBuf!: AudioBuffer;
  s: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.8, muted: false };
  mode: MusicMode = 'off'; intensity = 0; step = 0; nextT = 0; timer: number | null = null;
  siren: { gain: GainNode; lfo: OscillatorNode; osc: OscillatorNode } | null = null; sirenLevel = 0;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
      this.master = this.ctx.createGain(); this.musicG = this.ctx.createGain(); this.sfxG = this.ctx.createGain();
      this.musicG.connect(this.master); this.sfxG.connect(this.master); this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
      if (this.mode !== 'off') this.runMusic();
    } catch { this.ctx = null; }
  }
  set(s: Partial<AudioSettings>) { this.s = { ...this.s, ...s }; this.apply(); }
  private apply() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.s.muted ? 0 : this.s.master, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.s.music * 0.5, t, 0.05); this.sfxG.gain.setTargetAtTime(this.s.sfx * 0.9, t, 0.03);
  }
  suspend(on: boolean) { if (!this.ctx) return; if (on) void this.ctx.suspend(); else void this.ctx.resume(); }

  // ----- primitives -----
  private tone(f: number, dur: number, type: OscillatorType, vol: number, when = 0, slide?: number, dest?: AudioNode) {
    if (!this.ctx) return; const c = this.ctx; const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest ?? this.sfxG); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, freq: number, kind: BiquadFilterType = 'highpass', when = 0, dest?: AudioNode, q = 0.7) {
    if (!this.ctx) return; const c = this.ctx; const t = c.currentTime + when;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = kind; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest ?? this.sfxG); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  sfx(name: string) {
    if (!this.ctx || this.s.muted) return;
    const now = this.ctx.currentTime; if (this.lastSfx[name] && now - this.lastSfx[name] < 0.05) return; this.lastSfx[name] = now;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'square', 0.08); this.tone(990, 0.05, 'square', 0.05, 0.03); break;
      case 'hover': this.tone(1200, 0.03, 'sine', 0.03); break;
      case 'select': this.tone(520, 0.08, 'triangle', 0.14); this.tone(780, 0.1, 'triangle', 0.1, 0.05); break;
      case 'add': this.tone(440, 0.06, 'square', 0.07); this.tone(880, 0.09, 'triangle', 0.1, 0.04); break;
      case 'error': this.tone(160, 0.18, 'sawtooth', 0.12, 0, 90); break;
      case 'grab': this.tone(1100, 0.08, 'triangle', 0.16); this.tone(1650, 0.14, 'triangle', 0.12, 0.06); break;
      case 'cash': for (let i = 0; i < 4; i++) this.tone(1200 + i * 220, 0.12, 'triangle', 0.1, i * 0.05); break;
      case 'buy': this.tone(500, 0.08, 'square', 0.08); this.tone(750, 0.12, 'triangle', 0.12, 0.06); break;
      case 'sell': for (let i = 0; i < 3; i++) this.tone(900 + i * 300, 0.1, 'triangle', 0.1, i * 0.06); break;
      case 'escape': this.tone(392, 0.12, 'triangle', 0.14); this.tone(523, 0.12, 'triangle', 0.14, 0.1); this.tone(784, 0.2, 'triangle', 0.14, 0.2); break;
      case 'hack': for (let i = 0; i < 6; i++) this.tone(800 + Math.random() * 1400, 0.04, 'square', 0.05, i * 0.04); break;
      case 'crack': this.tone(1800, 0.03, 'square', 0.08); this.tone(2300, 0.03, 'square', 0.08, 0.07); break;
      case 'door': this.noise(0.12, 0.2, 400, 'lowpass'); this.tone(120, 0.14, 'square', 0.1, 0, 70); break;
      case 'vault': this.noise(0.8, 0.3, 200, 'lowpass'); this.tone(70, 0.9, 'sawtooth', 0.2, 0, 40); this.tone(440, 0.5, 'triangle', 0.12, 0.5); break;
      case 'alert': this.tone(880, 0.12, 'sawtooth', 0.2); this.tone(660, 0.2, 'sawtooth', 0.2, 0.1); break;
      case 'susp': this.tone(500, 0.18, 'triangle', 0.1, 0, 700); break;
      case 'siren': for (let i = 0; i < 4; i++) { this.tone(700, 0.2, 'sawtooth', 0.12, i * 0.4, 950); this.tone(950, 0.2, 'sawtooth', 0.12, i * 0.4 + 0.2, 700); } break;
      case 'camera': this.tone(2400, 0.06, 'square', 0.1); this.tone(2400, 0.06, 'square', 0.1, 0.1); this.tone(1800, 0.2, 'sawtooth', 0.1, 0.2); break;
      case 'laser': this.tone(1600, 0.35, 'sawtooth', 0.14, 0, 200); break;
      case 'takedown': this.noise(0.1, 0.35, 300, 'lowpass'); this.tone(90, 0.16, 'sine', 0.3, 0, 50); break;
      case 'hit': this.noise(0.1, 0.3, 500, 'bandpass'); this.tone(140, 0.12, 'square', 0.15, 0, 60); break;
      case 'arrest': this.tone(300, 0.2, 'sawtooth', 0.18, 0, 120); this.tone(220, 0.4, 'sawtooth', 0.18, 0.15, 80); break;
      case 'gadget': this.tone(300, 0.2, 'triangle', 0.12, 0, 900); this.noise(0.2, 0.12, 2000); break;
      case 'smoke': this.noise(0.6, 0.15, 800, 'lowpass'); break;
      case 'emp': this.noise(0.5, 0.3, 1200, 'bandpass'); this.tone(2000, 0.6, 'sawtooth', 0.15, 0, 80); break;
      case 'ping': this.tone(1500, 0.14, 'sine', 0.08); break;
      case 'day': this.tone(330, 0.3, 'triangle', 0.12); this.tone(247, 0.5, 'triangle', 0.12, 0.2); break;
      case 'success': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.16, i * 0.12)); this.tone(1047, 0.8, 'sine', 0.12, 0.5); break;
      case 'fail': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.12, i * 0.2)); break;
      case 'start': this.tone(110, 0.5, 'sawtooth', 0.12, 0, 220); this.tone(330, 0.3, 'square', 0.08, 0.3); this.tone(495, 0.3, 'square', 0.08, 0.4); break;
      default: this.tone(600, 0.05, 'sine', 0.05);
    }
  }

  // ----- siren loop -----
  setSiren(level: number) {
    if (!this.ctx) return; if (level === this.sirenLevel) return; this.sirenLevel = level; const c = this.ctx;
    if (level >= 2 && !this.siren) {
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 780; lfo.type = 'sine'; lfo.frequency.value = 0.9; lg.gain.value = 170; lfo.connect(lg); lg.connect(o.frequency);
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1800; g.gain.value = 0.0001; o.connect(f); f.connect(g); g.connect(this.sfxG);
      o.start(); lfo.start(); g.gain.setTargetAtTime(0.035, c.currentTime, 0.2); this.siren = { gain: g, lfo, osc: o };
    }
    if (this.siren) {
      if (level >= 2) this.siren.lfo.frequency.setTargetAtTime(level >= 3 ? 2.0 : 0.9, c.currentTime, 0.1);
      else { const sr = this.siren; sr.gain.gain.setTargetAtTime(0.0001, c.currentTime, 0.15); window.setTimeout(() => { try { sr.lfo.stop(); sr.osc.stop(); } catch { /* noop */ } }, 800); this.siren = null; }
    }
  }

  // ----- music -----
  startMusic(mode: MusicMode) {
    if (mode === this.mode) return; this.mode = mode;
    if (mode === 'off') { if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } return; }
    if (!this.ctx) return; this.runMusic();
  }
  private runMusic() {
    if (!this.ctx || this.mode === 'off') return;
    if (this.timer !== null) clearInterval(this.timer);
    this.nextT = this.ctx.currentTime + 0.1; this.step = 0;
    this.timer = window.setInterval(() => this.pump(), 60);
  }
  setIntensity(n: number) { this.intensity = n; }
  private bpm() { return this.mode === 'menu' ? 62 : this.mode === 'plan' ? 74 : 86 + this.intensity * 17; }
  private pump() {
    const c = this.ctx; if (!c || this.mode === 'off') return;
    while (this.nextT < c.currentTime + 0.25) {
      const sd = 60 / this.bpm() / 4; this.sched(this.step, this.nextT, sd); this.nextT += sd; this.step++;
    }
  }
  private sched(step: number, t: number, sd: number) {
    const c = this.ctx as AudioContext; const when = Math.max(0, t - c.currentTime);
    const bar = Math.floor(step / 16) % 4, st = step % 16; const heist = this.mode === 'heist'; const I = this.intensity;
    const rootOff = heist && I >= 1 ? [0, 0, 1, 0][bar] : [0, 5, 7, 0][bar];
    const minor = heist || bar !== 2; const chord = minor ? [0, 3, 7, 10] : [0, 4, 7, 10];
    const root = 38 + rootOff; const swing = !heist && st % 2 === 1 ? sd * 0.2 : 0; const w = when + swing;
    // bass
    if (st % 4 === 0) {
      const b = st / 4; const walk = [0, chord[2], chord[1], chord[2] + (b === 3 ? 2 : 0)][b];
      this.tone(mtof(root + walk), sd * 3.4, heist ? 'sawtooth' : 'triangle', heist ? 0.1 : 0.2, w, undefined, this.musicG);
    }
    if (st === 0) for (const n of chord) this.tone(mtof(root + 24 + n), sd * 15, 'triangle', heist ? 0.025 : 0.04, w, undefined, this.musicG);
    // hats / brushes
    if (!heist) { if (st % 2 === 0) this.noise(0.05, st % 4 === 0 ? 0.03 : 0.018, 7000, 'highpass', w, this.musicG); if (this.mode === 'plan' && (st === 4 || st === 12)) this.tone(1400, 0.04, 'square', 0.025, w, 900, this.musicG); }
    else {
      if (I === 0) { if (st % 4 === 0) this.tone(900, 0.03, 'square', 0.025, w, undefined, this.musicG); if (st % 8 === 6) this.noise(0.04, 0.02, 6000, 'highpass', w, this.musicG); }
      if (I >= 1) this.noise(0.04, st % 2 === 0 ? 0.035 : 0.018, 7500, 'highpass', w, this.musicG);
      if (I >= 1 && st % 4 === 0) this.tone(mtof(root + 12), 0.1, 'sine', 0.05, w, undefined, this.musicG);
      if (I >= 2) {
        if (st % 4 === 0) { this.tone(120, 0.15, 'sine', 0.3, w, 45, this.musicG); }
        if (st % 8 === 4) this.noise(0.12, 0.09, 1800, 'bandpass', w, this.musicG);
        this.tone(mtof(root + 36 + chord[(st * 3) % 4]), sd * 0.8, 'square', 0.022, w, undefined, this.musicG);
      }
      if (I >= 3 && st % 8 === 0) { this.tone(mtof(root + 48), sd * 4, 'sawtooth', 0.035, w, mtof(root + 49), this.musicG); }
    }
    // vibes melody
    if (!heist && st % 2 === 0 && Math.random() < (this.mode === 'plan' ? 0.2 : 0.14)) {
      const pent = [0, 3, 5, 7, 10, 12, 15]; this.tone(mtof(root + 36 + pent[Math.floor(Math.random() * pent.length)] + rootOff * 0), sd * 5, 'sine', 0.05, w, undefined, this.musicG);
    }
  }
}

export const audio = new Engine();
