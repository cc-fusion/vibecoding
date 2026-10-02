export type SfxName =
  | 'click' | 'paint' | 'dig' | 'pickup' | 'deliver' | 'hit' | 'kill' | 'hatch' | 'alarm' | 'thunder'
  | 'lightning' | 'build' | 'error' | 'win' | 'lose' | 'roar' | 'spit' | 'slam' | 'upgrade' | 'warn'
  | 'queenhit' | 'pause' | 'fanfare';

type MusicMode = 'off' | 'menu' | 'game' | 'boss';

const MIN_GAP: Partial<Record<SfxName, number>> = {
  paint: 0.07, dig: 0.09, pickup: 0.06, deliver: 0.08, hit: 0.05, kill: 0.06, hatch: 0.12, spit: 0.07, queenhit: 0.4, error: 0.15,
};

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicG: GainNode | null = null;
  sfxG: GainNode | null = null;
  rainG: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.7, music: 0.55, sfx: 0.8 };
  muted = false;
  mode: MusicMode = 'off';
  intensity = 0;
  targetIntensity = 0;
  nextT = 0;
  step = 0;
  timer: number | null = null;
  last: Record<string, number> = {};

  ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master = ctx.createGain();
      this.musicG = ctx.createGain();
      this.sfxG = ctx.createGain();
      this.rainG = ctx.createGain();
      this.rainG.gain.value = 0;
      this.musicG.connect(this.master);
      this.sfxG.connect(this.master);
      this.rainG.connect(this.master);
      this.master.connect(comp);
      comp.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      // rain bed
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1800;
      bp.Q.value = 0.5;
      src.connect(bp);
      bp.connect(this.rainG);
      src.start();
      this.ctx = ctx;
      this.applyVolumes();
      return ctx;
    } catch {
      return null;
    }
  }

  setVolumes(master: number, music: number, sfx: number, muted: boolean) {
    this.vol = { master, music, sfx };
    this.muted = muted;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx || !this.master || !this.musicG || !this.sfxG) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.03);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, dest?: GainNode | null, attack = 0.005) {
    const ctx = this.ctx;
    const out = dest || this.sfxG;
    if (!ctx || !out) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1 = 0, delay = 0, dest?: GainNode | null) {
    const ctx = this.ctx;
    const out = dest || this.sfxG;
    if (!ctx || !out || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(out);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  play(name: SfxName) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = MIN_GAP[name] || 0;
    if (gap && this.last[name] !== undefined && now - this.last[name] < gap) return;
    this.last[name] = now;
    const r = Math.random();
    switch (name) {
      case 'click': this.tone(660, 0.05, 'square', 0.08, 880); break;
      case 'pause': this.tone(440, 0.12, 'triangle', 0.12, 300); break;
      case 'paint': this.tone(320 + r * 120, 0.05, 'sine', 0.035); break;
      case 'dig': this.noise(0.07, 0.16, 'bandpass', 500 + r * 300, 250); this.tone(110 + r * 30, 0.06, 'sine', 0.1); break;
      case 'pickup': this.tone(700 + r * 100, 0.07, 'triangle', 0.09, 1000); break;
      case 'deliver': this.tone(520, 0.07, 'triangle', 0.1); this.tone(780, 0.1, 'triangle', 0.1, 0, 0.06); break;
      case 'hit': this.noise(0.05, 0.14, 'highpass', 1500); this.tone(190 + r * 40, 0.06, 'sawtooth', 0.06, 90); break;
      case 'kill': this.tone(300, 0.14, 'sawtooth', 0.09, 60); this.noise(0.1, 0.1, 'lowpass', 1200, 300); break;
      case 'hatch': this.tone(400, 0.06, 'sine', 0.08); this.tone(600, 0.06, 'sine', 0.08, 0, 0.05); this.tone(800, 0.1, 'sine', 0.08, 0, 0.1); break;
      case 'alarm':
        for (let i = 0; i < 3; i++) { this.tone(460, 0.12, 'square', 0.08, 0, i * 0.26); this.tone(340, 0.12, 'square', 0.08, 0, i * 0.26 + 0.13); }
        break;
      case 'warn': this.tone(880, 0.1, 'triangle', 0.1); this.tone(880, 0.1, 'triangle', 0.1, 0, 0.16); break;
      case 'thunder': this.noise(1.6, 0.5, 'lowpass', 260, 50); this.tone(48, 1.2, 'sine', 0.25, 30); break;
      case 'lightning': this.noise(0.18, 0.5, 'highpass', 3000); this.noise(1.4, 0.5, 'lowpass', 300, 45, 0.12); this.tone(55, 1, 'sine', 0.25, 30, 0.12); break;
      case 'build': this.tone(220, 0.2, 'triangle', 0.14, 440); this.noise(0.15, 0.1, 'bandpass', 600, 200); this.tone(660, 0.15, 'sine', 0.08, 0, 0.12); break;
      case 'error': this.tone(150, 0.13, 'square', 0.08, 110); break;
      case 'spit': this.tone(900, 0.1, 'sine', 0.07, 300); break;
      case 'queenhit': this.tone(130, 0.25, 'sawtooth', 0.15, 70); this.tone(90, 0.3, 'square', 0.08, 50); break;
      case 'roar': this.noise(1.3, 0.4, 'lowpass', 600, 80); this.tone(90, 1.2, 'sawtooth', 0.2, 38); this.tone(70, 1.2, 'square', 0.1, 32); break;
      case 'slam': this.noise(0.5, 0.45, 'lowpass', 400, 60); this.tone(70, 0.4, 'sine', 0.35, 30); break;
      case 'upgrade': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.1, 0, i * 0.07)); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.13, 0, i * 0.14)); break;
      case 'fanfare': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'square', 0.07, 0, i * 0.09)); break;
      case 'lose': [440, 370, 311, 220].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.1, f * 0.9, i * 0.25)); break;
    }
  }

  setWeather(w: string) {
    if (!this.ctx || !this.rainG) return;
    const v = w === 'rain' ? 0.2 : w === 'storm' ? 0.38 : 0;
    this.rainG.gain.setTargetAtTime(v, this.ctx.currentTime, 0.6);
  }

  setIntensity(v: number) {
    this.targetIntensity = Math.max(0, Math.min(1, v));
  }

  startMusic(mode: MusicMode) {
    const ctx = this.ensure();
    if (!ctx) return;
    this.mode = mode;
    if (mode === 'off') { this.stopMusic(); return; }
    if (this.timer === null) {
      this.nextT = ctx.currentTime + 0.1;
      this.step = 0;
      this.timer = window.setInterval(() => this.schedule(), 90);
    }
  }

  stopMusic() {
    this.mode = 'off';
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.intensity = 0;
    this.targetIntensity = 0;
    this.setWeather('clear');
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || this.mode === 'off') return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.08;
    if (ctx.state !== 'running') { this.nextT = ctx.currentTime + 0.1; return; }
    let guard = 0;
    while (this.nextT < ctx.currentTime + 0.3 && guard++ < 16) {
      this.playStep(this.step, this.nextT);
      const bpm = this.mode === 'menu' ? 66 : 64 + this.intensity * 40 + (this.mode === 'boss' ? 14 : 0);
      this.nextT += 60 / bpm / 4;
      this.step++;
    }
  }

  private mTone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, attack = 0.01, lp = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.musicG) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.musicG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private mNoise(t: number, dur: number, vol: number, ftype: BiquadFilterType, f0: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicG || !this.noiseBuf) return;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype;
    f.frequency.value = f0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicG);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  private playStep(step: number, t: number) {
    const boss = this.mode === 'boss';
    const menu = this.mode === 'menu';
    const roots = boss ? [41.2, 43.65, 41.2, 36.71] : [55, 43.65, 65.41, 49];
    const scale = boss ? [0, 1, 5, 7, 8] : [0, 3, 5, 7, 10];
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const root = roots[bar];
    const I = this.intensity;
    const sixteenth = 60 / (menu ? 66 : 64 + I * 40) / 4;
    if (s === 0) {
      const dur = sixteenth * 16;
      const third = boss ? 1.0595 : 1.1892;
      this.mTone(root * 4, t, dur, 'triangle', 0.1, 0.9, 900);
      this.mTone(root * 4 * third * 1.0, t, dur, 'sine', 0.07, 1.1, 900);
      this.mTone(root * 6.02, t, dur, 'sine', 0.06, 1.2, 800);
    }
    if (s % 4 === 0 || (I > 0.4 && (s === 6 || s === 10))) {
      this.mTone(root * (s % 8 === 6 ? 2 : 1), t, sixteenth * 3, boss ? 'sawtooth' : 'sine', boss ? 0.12 : 0.2, 0.01, boss ? 300 : 0);
    }
    const arpP = menu ? 0.28 : 0.22 + I * 0.5;
    if (s % 2 === 0 && Math.random() < arpP) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      const oct = Math.random() < 0.3 ? 8 : 4;
      this.mTone(root * oct * Math.pow(2, n / 12), t, sixteenth * 2.5, 'triangle', 0.07 + I * 0.04, 0.005, 2400);
    }
    if (!menu) {
      if (I > 0.3 && s % 2 === 1) this.mNoise(t, 0.05, 0.05 + I * 0.04, 'highpass', 6000);
      if (I > 0.5 && (s === 0 || s === 8 || (I > 0.8 && s === 12))) {
        this.mTone(120, t, 0.18, 'sine', 0.35, 0.002);
        this.mTone(60, t, 0.2, 'sine', 0.3, 0.002);
      }
      if (I > 0.65 && (s === 4 || s === 12)) this.mNoise(t, 0.12, 0.1, 'bandpass', 1800);
    }
  }
}

export const audio = new AudioEngine();
