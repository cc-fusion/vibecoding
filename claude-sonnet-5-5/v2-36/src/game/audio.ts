export type Sfx =
  | 'click' | 'coin' | 'buy' | 'sell' | 'whisper' | 'listen' | 'plant' | 'forge' | 'alarm' | 'bust' | 'steal'
  | 'catch' | 'toast' | 'success' | 'fail' | 'bell' | 'dash' | 'deny' | 'dawn' | 'event' | 'debunk' | 'perk';

const SCALE = [0, 1, 4, 5, 7, 8, 10, 12, 13, 16, 17, 19];
const ROOT = 50;
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private crowdG!: GainNode;
  private delay!: DelayNode;
  private noiseBuf!: AudioBuffer;
  private timer: number | null = null;
  private step = 0;
  private nextT = 0;
  private motif: (number | null)[] = [];
  private lastNote = 4;
  vol = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  mood = { heat: 0, crowd: 0.5, boss: false, night: false };
  private lastPlay: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(ctx.destination);
      this.musicG = ctx.createGain(); this.musicG.connect(this.master);
      this.sfxG = ctx.createGain(); this.sfxG.connect(this.master);
      this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.34;
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(this.musicG);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = (b + 0.04 * w) / 1.04; d[i] = b * 6; }
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 650; bp.Q.value = 0.5;
      this.crowdG = ctx.createGain(); this.crowdG.gain.value = 0;
      src.connect(bp); bp.connect(this.crowdG); this.crowdG.connect(this.musicG); src.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.23;
      const lg = ctx.createGain(); lg.gain.value = 180; lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
      this.applyVol();
      this.newMotif();
    } catch { this.ctx = null; }
  }

  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.vol.music, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }
  setVol(v: Partial<typeof this.vol>) { Object.assign(this.vol, v); this.applyVol(); }

  setMood(m: Partial<typeof this.mood>) {
    Object.assign(this.mood, m);
    if (this.ctx && this.crowdG) {
      const lvl = this.mood.night ? 0.05 + this.mood.crowd * 0.09 : 0.03;
      this.crowdG.gain.setTargetAtTime(lvl, this.ctx.currentTime, 0.6);
    }
  }

  startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.sched(), 30);
  }
  stopMusic() { if (this.timer !== null) { clearInterval(this.timer); this.timer = null; } }

  private newMotif() {
    this.motif = [];
    for (let i = 0; i < 8; i++) this.motif.push(Math.random() < 0.38 ? null : Math.floor(Math.random() * 7));
  }
  private sched() {
    const ctx = this.ctx; if (!ctx) return;
    while (this.nextT < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextT);
      const bpm = 74 + this.mood.heat * 0.28 + (this.mood.boss ? 16 : 0) + (this.mood.night ? 6 : 0);
      this.nextT += 60 / bpm / 2;
      this.step++;
    }
  }
  private playStep(s: number, t: number) {
    const ctx = this.ctx; if (!ctx) return;
    const night = this.mood.night;
    if (s % 16 === 0) { this.newMotifMaybe(s); }
    if (s % 8 === 0) this.voice(ROOT - 12, t, 60 / 80 * 4, 'sawtooth', 0.07, 260, this.musicG);
    if (night) {
      if (s % 8 === 0 || s % 8 === 3 || (s % 8 === 6 && this.mood.heat > 20)) this.kick(t);
      if (this.mood.heat > 25 && s % 2 === 1) this.tick(t, 0.05);
      else if (s % 4 === 2) this.tick(t, 0.03);
    }
    const mi = this.motif[s % 8];
    const prob = night ? 0.9 : 0.6;
    if (mi !== null && mi !== undefined && Math.random() < prob) {
      this.lastNote = Math.max(0, Math.min(SCALE.length - 1, (mi + (s % 16 >= 8 ? 2 : 0))));
      const note = ROOT + 12 + SCALE[this.lastNote];
      this.pluck(note, t, night ? 0.12 : 0.09);
      if (Math.random() < 0.25) this.pluck(note + 12, t + 0.02, 0.04);
    }
    if (this.mood.heat > 55 && s % 16 === 14) this.voice(ROOT + 1, t, 0.5, 'square', 0.04, 900, this.musicG);
    if (this.mood.boss && s % 8 === 4) this.voice(ROOT - 24, t, 0.4, 'sine', 0.2, 200, this.musicG);
  }
  private newMotifMaybe(s: number) {
    if (s % 32 === 0) this.newMotif();
    else { const i = Math.floor(Math.random() * 8); this.motif[i] = Math.random() < 0.3 ? null : Math.floor(Math.random() * 7); }
  }
  private voice(m: number, t: number, d: number, type: OscillatorType, v: number, cutoff: number, out: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f); f.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.05);
  }
  private pluck(m: number, t: number, v: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(f); f.connect(g); g.connect(this.musicG); g.connect(this.delay); o.start(t); o.stop(t + 0.5);
  }
  private kick(t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g); g.connect(this.musicG); o.start(t); o.stop(t + 0.25);
  }
  private tick(t: number, v: number) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicG); s.start(t, Math.random()); s.stop(t + 0.06);
  }

  // ---------- SFX ----------
  private tone(f: number, d: number, type: OscillatorType = 'sine', v = 0.2, slide = 0, delay = 0) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + d + 0.05);
  }
  private noise(d: number, f: number, q: number, v: number, slide = 0, delay = 0, type: BiquadFilterType = 'bandpass') {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(40, f + slide), t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + d * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(this.sfxG); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }

  play(name: Sfx) {
    if (!this.ctx || this.vol.muted) return;
    const now = performance.now();
    if (this.lastPlay[name] && now - this.lastPlay[name] < 40) return;
    this.lastPlay[name] = now;
    switch (name) {
      case 'click': this.tone(520, 0.06, 'triangle', 0.12); break;
      case 'coin': this.tone(1318, 0.09, 'square', 0.07); this.tone(1760, 0.18, 'square', 0.07, 0, 0.07); break;
      case 'buy': this.tone(440, 0.08, 'triangle', 0.16); this.tone(660, 0.12, 'triangle', 0.14, 0, 0.06); break;
      case 'sell': this.tone(660, 0.08, 'triangle', 0.16); this.tone(990, 0.1, 'triangle', 0.16, 0, 0.06); this.tone(1320, 0.2, 'triangle', 0.14, 0, 0.12); break;
      case 'whisper': this.noise(0.5, 2400, 1.5, 0.18, -1200); break;
      case 'listen': this.noise(0.9, 1500, 2, 0.14, 900); this.tone(300, 0.9, 'sine', 0.05, 200); break;
      case 'plant': this.noise(0.4, 3200, 2, 0.15, -2000); this.tone(220, 0.35, 'sine', 0.18, 240); break;
      case 'forge': this.tone(180, 0.1, 'square', 0.12); this.tone(240, 0.1, 'square', 0.12, 0, 0.1); this.noise(0.3, 4000, 1, 0.1, 0, 0.15); break;
      case 'alarm': this.tone(740, 0.18, 'square', 0.14); this.tone(560, 0.18, 'square', 0.14, 0, 0.2); this.tone(740, 0.18, 'square', 0.14, 0, 0.4); break;
      case 'bust': this.tone(200, 0.6, 'sawtooth', 0.22, -120); this.noise(0.5, 300, 1, 0.3, 0, 0, 'lowpass'); break;
      case 'steal': this.tone(900, 0.25, 'sawtooth', 0.12, -600); break;
      case 'catch': this.tone(520, 0.1, 'square', 0.14); this.tone(780, 0.14, 'square', 0.14, 0, 0.08); this.tone(1040, 0.2, 'square', 0.12, 0, 0.16); break;
      case 'toast': this.tone(880, 0.1, 'sine', 0.08); break;
      case 'success': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.15, 0, i * 0.09)); break;
      case 'fail': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.12, 0, i * 0.2)); break;
      case 'bell': this.tone(660, 1.6, 'sine', 0.2); this.tone(990, 1.2, 'sine', 0.1); this.tone(1320, 0.8, 'sine', 0.06); break;
      case 'dash': this.noise(0.18, 1200, 0.8, 0.2, 2200); break;
      case 'deny': this.tone(160, 0.14, 'square', 0.12); this.tone(130, 0.18, 'square', 0.12, 0, 0.1); break;
      case 'dawn': [392, 494, 587, 784, 988].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.12, 0, i * 0.13)); break;
      case 'event': this.tone(330, 0.5, 'triangle', 0.18); this.tone(440, 0.5, 'triangle', 0.18, 0, 0.12); this.tone(554, 0.8, 'triangle', 0.18, 0, 0.24); break;
      case 'debunk': this.tone(700, 0.15, 'sawtooth', 0.12, -400); this.noise(0.2, 800, 1, 0.1); break;
      case 'perk': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.14, 0, i * 0.07)); break;
    }
  }
}

export const audio = new AudioEngine();
