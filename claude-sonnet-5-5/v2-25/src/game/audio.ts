// Fully synthesized audio: sound effects + generative reactive music (Web Audio API)

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export interface Volumes { master: number; music: number; sfx: number; muted: boolean }

const NIGHT_PROG: { root: number; chord: number[] }[] = [
  { root: 45, chord: [0, 3, 7] },
  { root: 41, chord: [0, 4, 7] },
  { root: 38, chord: [0, 3, 7] },
  { root: 40, chord: [0, 4, 7] },
];
const DAY_PROG: { root: number; chord: number[] }[] = [
  { root: 48, chord: [0, 4, 7] },
  { root: 43, chord: [0, 4, 7] },
  { root: 45, chord: [0, 3, 7] },
  { root: 41, chord: [0, 4, 7] },
];
const NIGHT_SCALE = [0, 2, 3, 5, 7, 8, 11, 12, 14];
const DAY_SCALE = [0, 2, 4, 6, 7, 9, 11, 12, 14];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  vol: Volumes = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private musicOn = false;
  mood = { sun: 0, intensity: 0, boss: false };
  private lastSfx: Record<string, number> = {};

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.musicG = this.ctx.createGain();
        this.sfxG = this.ctx.createGain();
        this.musicG.connect(this.master);
        this.sfxG.connect(this.master);
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.apply();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: Partial<Volumes>) {
    this.vol = { ...this.vol, ...v };
    this.apply();
  }

  private apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.vol.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.03);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number, dest?: AudioNode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, q = 1, type: BiquadFilterType = 'lowpass', delay = 0, dest?: AudioNode) {
    if (!this.ctx || !this.noiseBuf) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxG);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  sfx(name: string) {
    if (!this.ctx || this.vol.muted) return;
    const now = this.ctx.currentTime;
    const minGap: Record<string, number> = { hit: 0.05, shoot: 0.06, bolt: 0.08, kill: 0.05, coin: 0.06, work: 0.2, siphon: 0.4, burn: 0.3 };
    const gap = minGap[name] ?? 0;
    if (gap && this.lastSfx[name] && now - this.lastSfx[name] < gap) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'square', 0.08); break;
      case 'select': this.tone(520, 0.05, 'triangle', 0.12); this.tone(780, 0.07, 'triangle', 0.1, 0.04); break;
      case 'place':
        this.noise(0.18, 0.3, 500, 1);
        this.tone(140, 0.2, 'sine', 0.35, 0, 70);
        this.tone(330, 0.1, 'triangle', 0.12, 0.05);
        break;
      case 'error': this.tone(150, 0.18, 'sawtooth', 0.14, 0, 90); break;
      case 'coin': this.tone(1320, 0.08, 'square', 0.06); this.tone(1760, 0.14, 'square', 0.06, 0.06); break;
      case 'raise':
        this.tone(90, 0.8, 'sawtooth', 0.18, 0, 220);
        this.tone(330, 0.6, 'sine', 0.14, 0.15, 660);
        this.noise(0.6, 0.15, 900, 2, 'bandpass');
        break;
      case 'hit': this.noise(0.07, 0.2, 1400, 1, 'bandpass'); this.tone(180, 0.06, 'square', 0.07, 0, 90); break;
      case 'kill': this.noise(0.2, 0.2, 700, 1); this.tone(220, 0.18, 'triangle', 0.14, 0, 70); break;
      case 'shoot': this.tone(520, 0.1, 'sawtooth', 0.07, 0, 180); this.noise(0.05, 0.1, 2400, 1, 'highpass'); break;
      case 'bolt': this.tone(900, 0.16, 'sine', 0.08, 0, 300); break;
      case 'horn':
        this.tone(110, 1.1, 'sawtooth', 0.2, 0, 98);
        this.tone(165, 1.1, 'sawtooth', 0.12, 0, 147);
        this.tone(110, 0.9, 'sawtooth', 0.2, 1.2, 82);
        this.tone(165, 0.9, 'sawtooth', 0.1, 1.2, 123);
        break;
      case 'storm':
        this.noise(1.0, 0.4, 600, 3, 'bandpass');
        this.tone(70, 0.9, 'sawtooth', 0.22, 0, 40);
        for (let i = 0; i < 6; i++) this.tone(900 + Math.random() * 700, 0.08, 'square', 0.05, i * 0.1);
        break;
      case 'eclipse': this.tone(300, 1.6, 'sine', 0.22, 0, 40); this.tone(150, 1.6, 'sawtooth', 0.12, 0, 30); break;
      case 'rally': [0, 4, 7, 12].forEach((n, i) => this.tone(midi(60 + n), 0.5, 'triangle', 0.14, i * 0.07)); break;
      case 'militia': this.tone(120, 0.5, 'sawtooth', 0.2, 0, 300); this.noise(0.4, 0.2, 400, 1); break;
      case 'boom': this.noise(0.8, 0.5, 300, 1); this.tone(60, 0.7, 'sine', 0.5, 0, 28); break;
      case 'smite': this.tone(1400, 0.5, 'sawtooth', 0.12, 0, 200); this.noise(0.4, 0.3, 3000, 1, 'highpass'); break;
      case 'day': [0, 4, 7].forEach((n, i) => this.tone(midi(72 + n), 0.9, 'sine', 0.1, i * 0.12)); break;
      case 'night': [0, 3, 7].forEach((n, i) => this.tone(midi(57 + n), 1.2, 'sine', 0.14, i * 0.15)); break;
      case 'siphon': this.tone(240, 0.5, 'sine', 0.06, 0, 700); break;
      case 'burn': this.noise(0.25, 0.1, 1800, 1, 'highpass'); break;
      case 'consecrate': this.tone(880, 1.0, 'sine', 0.12, 0, 440); this.tone(1320, 1.0, 'sine', 0.08, 0.1, 660); break;
      case 'collapse': this.tone(200, 0.5, 'triangle', 0.15, 0, 50); break;
      case 'upgrade': [0, 4, 7, 12, 16].forEach((n, i) => this.tone(midi(64 + n), 0.3, 'triangle', 0.12, i * 0.06)); break;
      case 'victory': [0, 4, 7, 12, 7, 12, 16, 19].forEach((n, i) => this.tone(midi(60 + n), 0.55, 'triangle', 0.18, i * 0.16)); break;
      case 'defeat': [0, -2, -5, -9, -14].forEach((n, i) => this.tone(midi(57 + n), 1.0, 'sawtooth', 0.14, i * 0.35)); break;
      case 'boss': this.tone(55, 1.8, 'sawtooth', 0.3, 0, 40); this.tone(58, 1.8, 'square', 0.1, 0, 43); this.noise(1.5, 0.2, 200, 1); break;
      case 'work': this.tone(300 + Math.random() * 60, 0.04, 'square', 0.025); break;
      default: break;
    }
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  setMood(sun: number, intensity: number, boss: boolean) {
    this.mood.sun = sun;
    this.mood.intensity = intensity;
    this.mood.boss = boss;
  }

  private schedule() {
    if (!this.ctx || !this.musicOn) return;
    if (this.ctx.state !== 'running') return;
    const bpm = 64 + this.mood.intensity * 34 + (this.mood.boss ? 10 : 0);
    const stepDur = 60 / bpm / 2;
    if (this.nextTime < this.ctx.currentTime - 0.4) this.nextTime = this.ctx.currentTime + 0.05;
    let guard = 0;
    while (this.nextTime < this.ctx.currentTime + 0.3 && guard++ < 16) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private mtone(freq: number, t: number, dur: number, type: OscillatorType, vol: number, lp?: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.9, dur * 0.35));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      o.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.musicG);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private playStep(step: number, t: number, sd: number) {
    const m = this.mood;
    const day = m.sun > 0.5;
    const prog = day ? DAY_PROG : NIGHT_PROG;
    const bar = Math.floor(step / 16);
    const ch = prog[bar % 4];
    const s = step % 16;
    if (s === 0) {
      const dur = sd * 16;
      ch.chord.forEach((n) => {
        const f = midi(ch.root + 12 + n);
        this.mtone(f, t, dur, 'sawtooth', 0.05, 380 + m.sun * 500 + m.intensity * 500);
        this.mtone(f * 1.006, t, dur, 'triangle', 0.06);
      });
      this.mtone(midi(ch.root - 12), t, dur, 'sine', 0.16);
    }
    if (s % 8 === 0 || (m.intensity > 0.25 && s % 8 === 6)) this.mtone(midi(ch.root), t, sd * 1.8, 'triangle', 0.15, 600);
    const scale = day ? DAY_SCALE : NIGHT_SCALE;
    const chance = (day ? 0.22 : 0.34) + m.intensity * 0.12;
    if (s % 2 === 0 && Math.random() < chance) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      this.mtone(midi(ch.root + 24 + n), t, sd * 3, 'sine', 0.05);
    }
    if (m.intensity > 0.2) {
      if (s === 0 || s === 8 || (m.intensity > 0.6 && (s === 4 || s === 12))) {
        this.tone(110, 0.22, 'sine', 0.5 * (0.5 + m.intensity * 0.5), t - (this.ctx?.currentTime ?? 0), 38, this.musicG);
      }
      if (m.intensity > 0.45 && s % 2 === 1) this.noise(0.04, 0.06, 7000, 1, 'highpass', t - (this.ctx?.currentTime ?? 0), this.musicG);
      if (m.boss && (s === 3 || s === 11)) this.tone(80, 0.3, 'triangle', 0.35, t - (this.ctx?.currentTime ?? 0), 50, this.musicG);
    }
  }
}

export const audio = new AudioEngine();
