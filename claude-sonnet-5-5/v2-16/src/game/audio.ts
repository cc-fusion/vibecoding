// Fully synthesized audio: SFX + generative frontier music (Web Audio API)

export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }

const KEY = 'frb_audio_v1';
function loadSettings(): AudioSettings {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return { master: 0.7, music: 0.5, sfx: 0.8, muted: false, ...JSON.parse(s) };
  } catch { /* ignore */ }
  return { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// A minor folk progression (root midi, chord tones)
const PROG: { root: number; tones: number[] }[] = [
  { root: 45, tones: [57, 60, 64] },
  { root: 41, tones: [53, 57, 60] },
  { root: 48, tones: [55, 60, 64] },
  { root: 43, tones: [55, 59, 62] },
  { root: 45, tones: [57, 60, 64] },
  { root: 38, tones: [53, 57, 62] },
  { root: 40, tones: [52, 56, 59] },
  { root: 45, tones: [57, 60, 64] },
];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  settings: AudioSettings = loadSettings();
  intensity = 0.2;
  playing = false;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const n = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
    } catch { this.ctx = null; }
  }

  apply() {
    if (!this.ctx) return;
    const s = this.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
  }

  set(p: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...p };
    try { localStorage.setItem(KEY, JSON.stringify(this.settings)); } catch { /* ignore */ }
    this.apply();
  }

  // ---------- primitives ----------
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, bus?: GainNode, slideTo?: number, lp?: number) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = o;
    if (lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g);
    g.connect(bus || this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, when = 0, f0 = 2000, f1 = 400, type: BiquadFilterType = 'lowpass', bus?: GainNode) {
    if (!this.ctx || !this.noiseBuf) return;
    const c = this.ctx;
    const t0 = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    s.start(t0, Math.random());
    s.stop(t0 + dur + 0.05);
  }

  // ---------- sfx ----------
  sfx(name: string) {
    if (!this.ctx || this.settings.muted) return;
    const now = this.ctx.currentTime;
    const lim = name === 'coin' ? 0.07 : name === 'chug' ? 0.2 : 0.03;
    if (this.lastSfx[name] && now - this.lastSfx[name] < lim) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'square', 0.08, 0, undefined, 880, 3000); break;
      case 'tab': this.tone(440, 0.05, 'triangle', 0.1); this.tone(660, 0.07, 'triangle', 0.08, 0.04); break;
      case 'error': this.tone(150, 0.22, 'sawtooth', 0.14, 0, undefined, 90, 700); break;
      case 'build': this.noise(0.09, 0.3, 0, 3000, 900, 'bandpass'); this.tone(110, 0.1, 'square', 0.12, 0, undefined, 60, 600); this.noise(0.09, 0.25, 0.11, 3000, 900, 'bandpass'); break;
      case 'station': this.tone(1046, 0.7, 'sine', 0.16); this.tone(1568, 0.5, 'sine', 0.07, 0.01); this.noise(0.08, 0.2, 0, 2500, 700, 'bandpass'); break;
      case 'coin': this.tone(1318, 0.09, 'square', 0.06, 0, undefined, undefined, 5000); this.tone(1760, 0.2, 'square', 0.06, 0.07, undefined, undefined, 5000); break;
      case 'whistle': this.tone(520, 0.9, 'sawtooth', 0.07, 0, undefined, 500, 1400); this.tone(655, 0.9, 'sawtooth', 0.06, 0, undefined, 640, 1400); break;
      case 'chug': this.noise(0.08, 0.07, 0, 1200, 300); break;
      case 'explode': this.noise(1.0, 0.6, 0, 1800, 60); this.tone(70, 0.7, 'sine', 0.35, 0, undefined, 30); break;
      case 'sabotage': this.tone(90, 0.6, 'sawtooth', 0.15, 0, undefined, 45, 400); this.noise(0.5, 0.2, 0.1, 5000, 500, 'highpass'); break;
      case 'caught': this.tone(300, 0.15, 'square', 0.1, 0, undefined, undefined, 1500); this.tone(300, 0.15, 'square', 0.1, 0.2, undefined, undefined, 1500); this.tone(200, 0.4, 'square', 0.1, 0.4, undefined, undefined, 1500); break;
      case 'warn': this.tone(196, 0.5, 'triangle', 0.18); this.tone(185, 0.6, 'triangle', 0.18, 0.4); break;
      case 'event': this.tone(392, 0.2, 'triangle', 0.12); this.tone(523, 0.3, 'triangle', 0.12, 0.15); break;
      case 'research': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.09)); break;
      case 'stock': this.tone(900, 0.04, 'square', 0.05, 0, undefined, undefined, 3500); this.tone(1200, 0.05, 'square', 0.05, 0.05, undefined, undefined, 3500); break;
      case 'cash': this.tone(1200, 0.08, 'triangle', 0.1); this.tone(1600, 0.16, 'triangle', 0.1, 0.06); this.tone(2000, 0.3, 'triangle', 0.08, 0.12); break;
      case 'spike': [392, 523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.5, 'triangle', 0.14, i * 0.12); this.tone(f / 2, 0.5, 'sine', 0.1, i * 0.12); }); this.tone(2093, 1.2, 'sine', 0.1, 0.6); break;
      case 'win': [392, 392, 523, 659, 784, 1046].forEach((f, i) => { this.tone(f, 0.45, 'triangle', 0.15, i * 0.16); this.tone(f / 2, 0.45, 'sawtooth', 0.04, i * 0.16, undefined, undefined, 800); }); break;
      case 'lose': [392, 349, 311, 262, 196].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.1, i * 0.25, undefined, undefined, 900)); break;
      case 'flood': this.noise(1.4, 0.35, 0, 600, 200); break;
      case 'wind': this.noise(1.6, 0.18, 0, 400, 1400, 'bandpass'); break;
      case 'absorb': [196, 247, 294, 392].forEach((f, i) => this.tone(f, 0.5, 'sawtooth', 0.1, i * 0.1, undefined, undefined, 1200)); this.tone(98, 1.0, 'sine', 0.2); break;
    }
  }

  // ---------- music ----------
  startMusic() {
    if (!this.ctx || this.playing) return;
    this.playing = true;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 100);
  }

  stopMusic() {
    this.playing = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private schedule() {
    if (!this.ctx || !this.playing) return;
    const c = this.ctx;
    if (c.state === 'suspended') return;
    const bpm = 88 + this.intensity * 34;
    const eighth = 60 / bpm / 2;
    while (this.nextTime < c.currentTime + 0.35) {
      this.playStep(this.step, this.nextTime - c.currentTime, eighth);
      this.step++;
      this.nextTime += eighth;
    }
  }

  private playStep(step: number, when: number, eighth: number) {
    const bar = Math.floor(step / 8) % PROG.length;
    const pos = step % 8;
    const ch = PROG[bar];
    const I = this.intensity;
    const mb = this.musicBus;
    // bass on 1 and 5 (root, fifth)
    if (pos === 0 || pos === 4) this.tone(mtof(ch.root + (pos === 4 ? 7 : 0)), eighth * 1.8, 'triangle', 0.32, when, mb, undefined, 500);
    // pad swell at bar start
    if (pos === 0) ch.tones.forEach((m) => this.tone(mtof(m - 12), eighth * 7.5, 'sine', 0.045, when, mb));
    // banjo-like arpeggio
    const arp = [0, 1, 2, 1, 0, 2, 1, 2];
    if (pos % 2 === 0 || I > 0.45) {
      const note = ch.tones[arp[pos]] + (pos === 6 && I > 0.3 ? 12 : 0);
      this.tone(mtof(note), eighth * 1.1, 'sawtooth', 0.075 + I * 0.03, when, mb, undefined, 1800 + I * 1500);
    }
    // melody sprinkle (pentatonic)
    if (pos === 3 || (pos === 7 && I > 0.35)) {
      const pent = [69, 72, 74, 76, 79, 81];
      if (Math.random() < 0.55) this.tone(mtof(pent[Math.floor(Math.random() * pent.length)]), eighth * 1.6, 'triangle', 0.08, when, mb);
    }
    // train-chug percussion
    if (I > 0.25) {
      if (pos % 2 === 0) this.noise(0.06, 0.06 + I * 0.05, when, 3200, 800, 'bandpass', mb);
      if (pos === 2 || pos === 6) this.noise(0.1, 0.1 + I * 0.08, when, 2400, 500, 'highpass', mb);
    }
    if (I > 0.6 && pos === 0) this.tone(55, eighth * 2, 'sine', 0.4, when, mb, 35);
  }

  setIntensity(v: number) { this.intensity = Math.max(0, Math.min(1, v)); }
}

export const audio = new AudioEngine();
