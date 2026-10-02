export type Mood = 'off' | 'menu' | 'prep' | 'raid' | 'boss';

interface ToneOpts { type?: OscillatorType; vol?: number; slide?: number; delay?: number; dest?: AudioNode; attack?: number; lp?: number }
interface NoiseOpts { vol?: number; freq?: number; q?: number; type?: BiquadFilterType; delay?: number; slide?: number }

const SCALE = [0, 1, 3, 5, 7, 8, 10, 12, 13, 15]; // phrygian
const ROOT = 73.42; // D2
const hz = (semi: number, oct = 0) => ROOT * Math.pow(2, (semi + oct * 12) / 12);

class SoundEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxG: GainNode | null = null;
  musG: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.7, sfx: 0.8, music: 0.5, muted: false };
  mood: Mood = 'off';
  private step = 0;
  private nextT = 0;
  private timer: number | null = null;
  private last: Record<string, number> = {};
  private chordRoot = 0;

  init() {
    try {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        return;
      }
      const AC: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const c = new AC();
      this.ctx = c;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = c.createGain();
      this.sfxG = c.createGain();
      this.musG = c.createGain();
      this.sfxG.connect(this.master);
      this.musG.connect(this.master);
      this.master.connect(comp);
      comp.connect(c.destination);
      const len = c.sampleRate * 1.2;
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.applyVol(true);
      if (this.mood !== 'off') this.startScheduler();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: Partial<typeof this.vol>) {
    this.vol = { ...this.vol, ...v };
    this.applyVol(false);
  }

  private applyVol(instant: boolean) {
    if (!this.ctx || !this.master || !this.sfxG || !this.musG) return;
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => {
      if (instant) g.gain.value = v;
      else g.gain.setTargetAtTime(v, t, 0.03);
    };
    set(this.master, this.vol.muted ? 0 : this.vol.master);
    set(this.sfxG, this.vol.sfx);
    set(this.musG, this.vol.music * 0.8);
  }

  tone(f: number, d: number, o: ToneOpts = {}) {
    const c = this.ctx;
    if (!c || !this.sfxG) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(Math.max(20, f), t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f * o.slide), t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol ?? 0.2), t + (o.attack || 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g);
    let out: AudioNode = g;
    if (o.lp) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      g.connect(lp);
      out = lp;
    }
    out.connect(o.dest || this.sfxG);
    osc.start(t);
    osc.stop(t + d + 0.05);
  }

  noise(d: number, o: NoiseOpts = {}) {
    const c = this.ctx;
    if (!c || !this.noiseBuf || !this.sfxG) return;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, (o.freq || 1000) * o.slide), t + d);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxG);
    src.start(t);
    src.stop(t + d + 0.05);
  }

  sfx(name: string) {
    const c = this.ctx;
    if (!c || this.vol.muted) return;
    const now = c.currentTime;
    const gap = name === 'hit' || name === 'mhit' ? 0.07 : 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'click': this.tone(660, 0.06, { type: 'square', vol: 0.08 }); break;
      case 'build': this.tone(220, 0.12, { type: 'triangle', vol: 0.25, slide: 1.8 }); this.noise(0.1, { freq: 600, vol: 0.12 }); break;
      case 'dig': this.noise(0.12, { freq: 380, q: 0.8, vol: 0.2, slide: 0.5 }); this.tone(110, 0.1, { type: 'triangle', vol: 0.12 }); break;
      case 'error': this.tone(140, 0.18, { type: 'sawtooth', vol: 0.15, slide: 0.7 }); break;
      case 'sell': this.tone(520, 0.08, { type: 'triangle', vol: 0.15, slide: 0.6 }); this.tone(330, 0.12, { type: 'triangle', vol: 0.15, delay: 0.07 }); break;
      case 'upgrade': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.16, { type: 'triangle', vol: 0.18, delay: i * 0.06 })); break;
      case 'hit': this.noise(0.08, { freq: 900, q: 1.2, vol: 0.16 }); this.tone(180, 0.07, { type: 'square', vol: 0.08, slide: 0.5 }); break;
      case 'mhit': this.noise(0.07, { freq: 1500, q: 1, vol: 0.12 }); this.tone(300, 0.06, { type: 'square', vol: 0.06, slide: 0.6 }); break;
      case 'spike': this.noise(0.12, { freq: 2400, q: 2, vol: 0.2 }); this.tone(900, 0.1, { type: 'sawtooth', vol: 0.12, slide: 0.4 }); break;
      case 'dart': this.noise(0.08, { freq: 3200, q: 3, vol: 0.14 }); this.tone(1400, 0.08, { type: 'triangle', vol: 0.1, slide: 0.5 }); break;
      case 'flame': this.noise(0.5, { freq: 700, q: 0.7, vol: 0.28, slide: 0.35, type: 'lowpass' }); this.tone(90, 0.4, { type: 'sawtooth', vol: 0.12 }); break;
      case 'curse': this.tone(220, 0.5, { type: 'sine', vol: 0.2, slide: 0.5 }); this.tone(233, 0.5, { type: 'sine', vol: 0.18, slide: 0.5 }); break;
      case 'door': this.noise(0.14, { freq: 300, q: 0.7, vol: 0.25 }); this.tone(80, 0.15, { type: 'square', vol: 0.15, slide: 0.6 }); break;
      case 'doorbreak': this.noise(0.5, { freq: 500, q: 0.5, vol: 0.35, slide: 0.3 }); this.tone(60, 0.4, { type: 'sawtooth', vol: 0.2, slide: 0.5 }); break;
      case 'coin': this.tone(988, 0.07, { type: 'square', vol: 0.09 }); this.tone(1319, 0.14, { type: 'square', vol: 0.09, delay: 0.07 }); break;
      case 'steal': this.tone(700, 0.2, { type: 'triangle', vol: 0.16, slide: 0.4 }); this.tone(500, 0.2, { type: 'triangle', vol: 0.12, delay: 0.08, slide: 0.5 }); break;
      case 'death': this.tone(330, 0.3, { type: 'sawtooth', vol: 0.14, slide: 0.35, lp: 1500 }); this.noise(0.2, { freq: 600, vol: 0.12 }); break;
      case 'mdeath': this.tone(200, 0.3, { type: 'square', vol: 0.12, slide: 0.4, lp: 900 }); break;
      case 'heart': this.tone(55, 0.35, { type: 'sine', vol: 0.5, slide: 0.6 }); this.noise(0.25, { freq: 200, vol: 0.3, type: 'lowpass' }); break;
      case 'wave': [0, 7, 12].forEach((s, i) => this.tone(hz(s, 1), 0.7, { type: 'sawtooth', vol: 0.16, lp: 900, delay: i * 0.12, attack: 0.05 })); break;
      case 'boss': this.tone(hz(0, 0), 1.4, { type: 'sawtooth', vol: 0.3, lp: 600, attack: 0.1 }); this.tone(hz(6, 0), 1.4, { type: 'sawtooth', vol: 0.22, lp: 600, attack: 0.1 }); this.noise(1.2, { freq: 150, vol: 0.3, type: 'lowpass' }); break;
      case 'victory': [0, 4, 7, 12, 16, 19].forEach((s, i) => this.tone(hz(s + 12, 1), 0.5, { type: 'triangle', vol: 0.2, delay: i * 0.13 })); break;
      case 'defeat': [7, 5, 3, 0].forEach((s, i) => this.tone(hz(s, 0), 0.9, { type: 'sawtooth', vol: 0.2, lp: 700, delay: i * 0.28 })); break;
      case 'smite': this.noise(0.4, { freq: 4000, q: 0.5, vol: 0.4, slide: 0.15, type: 'highpass' }); this.tone(1200, 0.25, { type: 'sawtooth', vol: 0.2, slide: 0.15 }); this.tone(60, 0.4, { type: 'sine', vol: 0.4, delay: 0.05 }); break;
      case 'rally': this.tone(160, 0.5, { type: 'sawtooth', vol: 0.22, slide: 2, lp: 900 }); this.tone(240, 0.5, { type: 'sawtooth', vol: 0.15, slide: 2, lp: 900 }); break;
      case 'terrify': this.tone(800, 0.7, { type: 'sine', vol: 0.18, slide: 0.3 }); this.tone(820, 0.7, { type: 'sine', vol: 0.18, slide: 0.3 }); this.noise(0.6, { freq: 1800, vol: 0.12, slide: 0.3 }); break;
      case 'cavein': this.noise(0.8, { freq: 400, q: 0.5, vol: 0.5, slide: 0.3, type: 'lowpass' }); this.tone(45, 0.7, { type: 'sine', vol: 0.5 }); break;
      case 'flee': this.tone(600, 0.15, { type: 'square', vol: 0.1, slide: 1.5 }); this.tone(800, 0.15, { type: 'square', vol: 0.1, delay: 0.1, slide: 1.5 }); break;
      case 'heal': this.tone(880, 0.2, { type: 'sine', vol: 0.1 }); this.tone(1175, 0.25, { type: 'sine', vol: 0.1, delay: 0.08 }); break;
      case 'spawn': this.tone(110, 0.25, { type: 'triangle', vol: 0.15, slide: 2 }); break;
      case 'edict': [0, 3, 7, 10].forEach((s, i) => this.tone(hz(s + 12, 1), 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.07 })); break;
      case 'disarm': this.tone(1000, 0.05, { type: 'square', vol: 0.1 }); this.tone(700, 0.08, { type: 'square', vol: 0.1, delay: 0.06 }); break;
      case 'nova': this.tone(440, 0.8, { type: 'sine', vol: 0.3, slide: 2.5 }); this.noise(0.6, { freq: 2500, vol: 0.2, slide: 0.3 }); break;
      case 'dispel': this.tone(900, 0.4, { type: 'sawtooth', vol: 0.18, slide: 0.25, lp: 2000 }); break;
      case 'shield': this.tone(500, 0.35, { type: 'triangle', vol: 0.18, slide: 1.6 }); break;
      case 'fire': this.noise(0.12, { freq: 1200, q: 0.8, vol: 0.12, slide: 0.5 }); break;
      case 'arrow': this.noise(0.07, { freq: 4000, q: 2, vol: 0.1 }); break;
      case 'zap': this.tone(1100, 0.1, { type: 'square', vol: 0.08, slide: 0.5 }); break;
      default: break;
    }
  }

  setMood(m: Mood) {
    if (this.mood === m) return;
    this.mood = m;
    this.step = 0;
    if (m === 'off') {
      this.stopScheduler();
    } else if (this.ctx) {
      this.startScheduler();
    }
  }

  private startScheduler() {
    if (!this.ctx || this.timer !== null) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  stopScheduler() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pad(t: number, root: number, len: number, vol: number) {
    const c = this.ctx;
    if (!c || !this.musG) return;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(300, t);
    lp.frequency.linearRampToValueAtTime(900, t + len * 0.5);
    lp.frequency.linearRampToValueAtTime(300, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + len * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    lp.connect(g);
    g.connect(this.musG);
    [0, 7, 12].forEach((s, i) => {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(root + s, 1);
      o.detune.value = (i - 1) * 8;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.1);
    });
  }

  private mtone(t: number, f: number, d: number, type: OscillatorType, vol: number, lpf = 2000) {
    const c = this.ctx;
    if (!c || !this.musG) return;
    const o = c.createOscillator();
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = lpf;
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(lp);
    lp.connect(g);
    g.connect(this.musG);
    o.start(t);
    o.stop(t + d + 0.05);
  }

  private mnoise(t: number, d: number, freq: number, vol: number, type: BiquadFilterType) {
    const c = this.ctx;
    if (!c || !this.musG || !this.noiseBuf) return;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f);
    f.connect(g);
    g.connect(this.musG);
    s.start(t);
    s.stop(t + d + 0.02);
  }

  private schedule() {
    const c = this.ctx;
    if (!c || this.mood === 'off') return;
    const tempo = this.mood === 'boss' ? 142 : this.mood === 'raid' ? 118 : this.mood === 'prep' ? 74 : 62;
    const sixteenth = 60 / tempo / 4;
    let guard = 0;
    while (this.nextT < c.currentTime + 0.3 && guard++ < 32) {
      this.playStep(this.nextT, sixteenth);
      this.nextT += sixteenth;
      this.step++;
    }
  }

  private playStep(t: number, s16: number) {
    const st = this.step;
    const m = this.mood;
    const bar = Math.floor(st / 16);
    const inBar = st % 16;
    const prog = [0, 0, 5, 3, 0, 0, 8, 7];
    if (inBar === 0) this.chordRoot = prog[bar % prog.length];
    const root = this.chordRoot;
    if (m === 'menu' || m === 'prep') {
      if (inBar === 0 && bar % 2 === 0) this.pad(t, root, s16 * 32, m === 'menu' ? 0.06 : 0.05);
      if (inBar % 4 === 0 && Math.random() < (m === 'menu' ? 0.45 : 0.3)) {
        const n = SCALE[Math.floor(Math.random() * 7)] + root;
        this.mtone(t, hz(n, 2), s16 * 6, 'triangle', 0.07, 2400);
      }
      if (inBar === 0) this.mtone(t, hz(root, 0), s16 * 14, 'sine', 0.2, 400);
      if (m === 'prep' && inBar % 8 === 4) this.mnoise(t, 0.12, 300, 0.03, 'lowpass');
    } else {
      const boss = m === 'boss';
      if (inBar % 4 === 0) {
        this.mtone(t, 60, 0.2, 'sine', 0.55, 200);
        this.mnoise(t, 0.05, 140, 0.2, 'lowpass');
      }
      if (inBar % 4 === 2) this.mnoise(t, 0.04, 8000, boss ? 0.07 : 0.045, 'highpass');
      if (inBar === 4 || inBar === 12) this.mnoise(t, 0.14, 1800, boss ? 0.16 : 0.09, 'bandpass');
      if (st % 2 === 0) {
        const note = boss && st % 8 === 6 ? root + 6 : root;
        this.mtone(t, hz(note, 0), s16 * 1.8, 'sawtooth', 0.15, boss ? 700 : 480);
      }
      if (inBar === 0) this.pad(t, root, s16 * 16, boss ? 0.07 : 0.05);
      if (Math.random() < (boss ? 0.55 : 0.35) && st % 2 === 1) {
        const n = SCALE[Math.floor(Math.random() * SCALE.length)] + root;
        this.mtone(t, hz(n, 2), s16 * 1.5, 'square', 0.04, 3000);
      }
      if (boss && inBar === 0) this.mtone(t, hz(root + 6, 1), s16 * 12, 'sawtooth', 0.07, 500);
    }
  }
}

export const sound = new SoundEngine();
