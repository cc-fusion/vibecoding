import type { Settings } from './save';

interface ToneOpts { slide?: number; delay?: number; attack?: number; bus?: GainNode; detune?: number }

const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  musicLP!: BiquadFilterNode;
  reverbSend!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  vol: Settings = { master: 0.7, music: 0.55, sfx: 0.8, muted: false, shake: true, particles: 2 };
  musicOn = false;
  timer: number | null = null;
  nextNote = 0;
  step = 0;
  rootIdx = 0;
  drone: { oscs: OscillatorNode[]; gain: GainNode; lp: BiquadFilterNode } | null = null;
  st = { depth: 0, threat: 0, danger: 0 };
  lastPlay: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const c = new AC();
      this.ctx = c;
      const comp = c.createDynamicsCompressor();
      this.master = c.createGain();
      this.musicBus = c.createGain();
      this.sfxBus = c.createGain();
      this.musicLP = c.createBiquadFilter();
      this.musicLP.type = 'lowpass';
      this.musicLP.frequency.value = 18000;
      this.musicBus.connect(this.musicLP);
      this.musicLP.connect(comp);
      this.sfxBus.connect(comp);
      comp.connect(this.master);
      this.master.connect(c.destination);
      // reverb-ish feedback delay
      const d = c.createDelay(1.5);
      d.delayTime.value = 0.41;
      const fb = c.createGain();
      fb.gain.value = 0.45;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      this.reverbSend = c.createGain();
      this.reverbSend.gain.value = 0.6;
      this.reverbSend.connect(d);
      d.connect(lp);
      lp.connect(fb);
      fb.connect(d);
      lp.connect(this.musicBus);
      const len = c.sampleRate * 1;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.apply(this.vol);
    } catch {
      this.ctx = null;
    }
  }

  apply(s: Settings) {
    this.vol = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.03);
  }

  setMuffle(on: boolean) {
    if (!this.ctx) return;
    this.musicLP.frequency.setTargetAtTime(on ? 500 : 18000, this.ctx.currentTime, 0.1);
  }

  tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, o: ToneOpts = {}) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(o.bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', slide?: number, delay = 0) {
    const c = this.ctx;
    if (!c || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  play(name: string) {
    const c = this.ctx;
    if (!c || this.vol.muted) return;
    const now = c.currentTime;
    const minGap: Record<string, number> = { bubble: 0.1, hit: 0.04, bump: 0.15, pickup: 0.03, boost: 0.15 };
    if (minGap[name] && this.lastPlay[name] && now - this.lastPlay[name] < minGap[name]) return;
    this.lastPlay[name] = now;
    switch (name) {
      case 'click': this.tone(520, 0.06, 'triangle', 0.12); break;
      case 'back': this.tone(340, 0.08, 'triangle', 0.12); break;
      case 'buy': this.tone(660, 0.1, 'triangle', 0.16); this.tone(990, 0.18, 'triangle', 0.14, { delay: 0.08 }); break;
      case 'deny': this.tone(140, 0.18, 'sawtooth', 0.12, { slide: 90 }); break;
      case 'harpoon': this.noise(0.18, 0.2, 2500, 'bandpass', 600); this.tone(300, 0.14, 'square', 0.07, { slide: 120 }); break;
      case 'hit': this.noise(0.08, 0.2, 1400, 'bandpass'); this.tone(180, 0.1, 'square', 0.1, { slide: 90 }); break;
      case 'kill': this.tone(260, 0.25, 'sawtooth', 0.12, { slide: 60 }); this.noise(0.25, 0.18, 900, 'lowpass', 200); break;
      case 'pickup': this.tone(880 + Math.random() * 120, 0.1, 'triangle', 0.13); this.tone(1320, 0.12, 'sine', 0.08, { delay: 0.05 }); break;
      case 'relic': [660, 880, 1100, 1320].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.14, { delay: i * 0.07 })); break;
      case 'tablet': [520, 660, 780].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.12, { delay: i * 0.1 })); break;
      case 'sonar': this.tone(1100, 1.0, 'sine', 0.18, { slide: 500, attack: 0.02 }); this.tone(1650, 0.6, 'sine', 0.06, { slide: 800 }); break;
      case 'flare': this.noise(0.5, 0.18, 3500, 'highpass', 800); this.tone(400, 0.3, 'sawtooth', 0.05, { slide: 900 }); break;
      case 'emp': this.noise(0.6, 0.3, 4000, 'bandpass', 200); this.tone(90, 0.7, 'sawtooth', 0.2, { slide: 600 }); break;
      case 'sting': this.noise(0.2, 0.2, 5000, 'highpass'); this.tone(900, 0.2, 'square', 0.07, { slide: 300 }); break;
      case 'bite': this.noise(0.2, 0.3, 700, 'lowpass', 150); this.tone(120, 0.25, 'sawtooth', 0.18, { slide: 50 }); break;
      case 'hurt': this.noise(0.25, 0.3, 500, 'lowpass', 120); this.tone(100, 0.3, 'square', 0.15, { slide: 50 }); break;
      case 'bump': this.noise(0.12, 0.25, 300, 'lowpass'); this.tone(70, 0.15, 'sine', 0.2, { slide: 40 }); break;
      case 'creak': this.tone(70 + Math.random() * 30, 0.8, 'sawtooth', 0.08, { slide: 50 + Math.random() * 30, attack: 0.1 }); break;
      case 'alarm': this.tone(740, 0.15, 'square', 0.09); this.tone(740, 0.15, 'square', 0.09, { delay: 0.22 }); break;
      case 'bolt': this.tone(500, 0.2, 'sawtooth', 0.07, { slide: 180 }); break;
      case 'roar': this.tone(70, 1.3, 'sawtooth', 0.28, { slide: 35, attack: 0.1 }); this.noise(1.2, 0.3, 400, 'lowpass', 90); this.tone(105, 1.2, 'square', 0.1, { slide: 50 }); break;
      case 'charge': this.tone(120, 0.8, 'sawtooth', 0.13, { slide: 420, attack: 0.3 }); break;
      case 'slam': this.noise(0.5, 0.45, 400, 'lowpass', 60); this.tone(55, 0.6, 'sine', 0.35, { slide: 30 }); break;
      case 'bubble': this.tone(300 + Math.random() * 500, 0.08, 'sine', 0.05, { slide: 900 }); break;
      case 'vent': this.noise(0.3, 0.1, 1800, 'bandpass'); break;
      case 'boost': this.noise(0.2, 0.06, 900, 'lowpass', 400); break;
      case 'good': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.14, { delay: i * 0.1 })); break;
      case 'bad': [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.1, { delay: i * 0.14 })); break;
      case 'win': [392, 494, 587, 784, 988, 1175].forEach((f, i) => this.tone(f, 1.2, 'triangle', 0.14, { delay: i * 0.16 })); break;
      case 'dock': this.tone(220, 0.5, 'sine', 0.2); this.tone(330, 0.7, 'sine', 0.2, { delay: 0.15 }); break;
      case 'node': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.9, 'sine', 0.16, { delay: i * 0.12 })); this.tone(98, 1.4, 'sine', 0.25); break;
      case 'warn': this.tone(880, 0.1, 'square', 0.06); break;
      default: break;
    }
  }

  glyph(i: number) {
    const f = [330, 415, 494, 622][i % 4];
    this.tone(f, 0.35, 'triangle', 0.22);
    this.tone(f * 2, 0.25, 'sine', 0.07);
  }

  startMusic() {
    if (!this.ctx || this.musicOn) return;
    const c = this.ctx;
    this.musicOn = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.16, c.currentTime, 1.5);
    const oscs: OscillatorNode[] = [];
    [['sawtooth', 0], ['sawtooth', 7], ['sine', -1200]].forEach(([type, det]) => {
      const o = c.createOscillator();
      o.type = type as OscillatorType;
      o.frequency.value = midi(38);
      o.detune.value = det as number;
      o.connect(lp);
      o.start();
      oscs.push(o);
    });
    lp.connect(gain);
    gain.connect(this.musicBus);
    this.drone = { oscs, gain, lp };
    this.nextNote = c.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.tick(), 120);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const d = this.drone;
    this.drone = null;
    if (d && this.ctx) {
      const t = this.ctx.currentTime;
      d.gain.gain.setTargetAtTime(0, t, 0.3);
      d.oscs.forEach((o) => o.stop(t + 1.5));
    }
  }

  setState(depth: number, threat: number, danger: number) {
    this.st = { depth, threat, danger };
    if (this.drone && this.ctx) {
      const t = this.ctx.currentTime;
      this.drone.lp.frequency.setTargetAtTime(260 + (1 - depth) * 380 + threat * 700, t, 0.5);
      this.drone.gain.gain.setTargetAtTime(0.12 + depth * 0.06 + threat * 0.05, t, 0.5);
    }
  }

  private tick() {
    const c = this.ctx;
    if (!c || !this.musicOn) return;
    while (this.nextNote < c.currentTime + 0.4) {
      this.schedule(this.nextNote, this.step);
      this.nextNote += 0.5 / (1 + this.st.threat * 0.5);
      this.step++;
    }
  }

  private schedule(t: number, s: number) {
    const c = this.ctx;
    if (!c) return;
    const { depth, threat, danger } = this.st;
    const roots = [38, 36, 33, 41];
    if (s % 32 === 0) {
      this.rootIdx = (this.rootIdx + 1) % roots.length;
      if (this.drone) this.drone.oscs.forEach((o) => o.frequency.setTargetAtTime(midi(roots[this.rootIdx] + (this.drone && o === this.drone.oscs[2] ? 0 : 0)), t, 1.2));
    }
    const scale = [0, 3, 5, 7, 10, 12, 15, 17];
    if (Math.random() < 0.3 - depth * 0.12) {
      const n = scale[Math.floor(Math.random() * scale.length)];
      const m = 62 + n + roots[this.rootIdx] - 38 - (depth > 0.55 ? 12 : 0);
      this.bell(midi(m), t);
    }
    if (threat > 0.2 && s % 4 === 0) this.kick(t, 0.1 + threat * 0.25);
    if (threat > 0.5 && s % 2 === 1) this.tone(midi(50), 0.1, 'square', 0.025 + threat * 0.02, { delay: t - c.currentTime, bus: this.musicBus });
    if (danger > 0.4 && s % 2 === 0) this.kick(t, 0.2 + danger * 0.2);
  }

  private bell(f: number, t: number) {
    const c = this.ctx;
    if (!c) return;
    [[1, 0.12], [2.76, 0.04], [4.1, 0.015]].forEach(([mul, v]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f * mul;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 / mul + 0.3);
      o.connect(g);
      g.connect(this.musicBus);
      g.connect(this.reverbSend);
      o.start(t);
      o.stop(t + 3);
    });
  }

  private kick(t: number, v: number) {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.35);
  }
}

export const audio = new AudioEngine();
