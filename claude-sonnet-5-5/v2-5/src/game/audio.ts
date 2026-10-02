export type Sfx =
  | 'ui'
  | 'place'
  | 'remove'
  | 'error'
  | 'sell'
  | 'shoot'
  | 'laser'
  | 'hit'
  | 'explode'
  | 'alarm'
  | 'boss'
  | 'research'
  | 'powerdown'
  | 'flip'
  | 'clear'
  | 'victory'
  | 'defeat'
  | 'shield'
  | 'emp'
  | 'step'
  | 'lost'
  | 'repair';

const CHORDS = [
  [110, 130.81, 164.81], // Am
  [87.31, 110, 130.81], // F
  [130.81, 164.81, 196], // C
  [98, 123.47, 146.83], // G
];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private last: Record<string, number> = {};
  vol = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  intensity = 0;
  spin = 1;
  private musicOn = false;

  ensure(): boolean {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return false;
        const ctx = new AC();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        this.master = ctx.createGain();
        this.musicGain = ctx.createGain();
        this.sfxGain = ctx.createGain();
        this.musicFilter = ctx.createBiquadFilter();
        this.musicFilter.type = 'lowpass';
        this.musicFilter.frequency.value = 900;
        this.musicFilter.Q.value = 0.8;
        this.musicFilter.connect(this.musicGain);
        this.musicGain.connect(this.master);
        this.sfxGain.connect(this.master);
        this.master.connect(comp);
        comp.connect(ctx.destination);
        const len = ctx.sampleRate;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.vol.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.vol.music * 0.9, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slide = 0, dest?: AudioNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.01, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType = 'lowpass', when = 0, dest?: AudioNode, sweep = 0) {
    if (!this.ctx || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxGain);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  sfx(name: Sfx, pitch = 1) {
    if (!this.ctx || this.vol.muted) return;
    const now = this.ctx.currentTime;
    const gap = name === 'shoot' || name === 'hit' || name === 'laser' || name === 'step' ? 0.06 : name === 'sell' ? 0.05 : 0.02;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const p = pitch;
    switch (name) {
      case 'ui':
        this.tone(660 * p, 0.07, 'triangle', 0.18);
        break;
      case 'place':
        this.tone(320 * p, 0.09, 'square', 0.12, 0, 520 * p);
        this.noise(0.05, 0.12, 2500, 'highpass');
        break;
      case 'remove':
        this.tone(420, 0.12, 'sawtooth', 0.1, 0, 140);
        break;
      case 'error':
        this.tone(140, 0.18, 'square', 0.16);
        this.tone(110, 0.2, 'square', 0.14, 0.08);
        break;
      case 'sell':
        this.tone(880 * p, 0.07, 'sine', 0.13);
        this.tone(1320 * p, 0.12, 'sine', 0.11, 0.06);
        break;
      case 'shoot':
        this.tone(900 * p, 0.09, 'square', 0.07, 0, 200);
        this.noise(0.05, 0.07, 3000, 'highpass');
        break;
      case 'laser':
        this.tone(1400, 0.08, 'sawtooth', 0.05, 0, 900);
        break;
      case 'hit':
        this.noise(0.08, 0.14, 1800, 'bandpass');
        this.tone(200 * p, 0.06, 'square', 0.07);
        break;
      case 'explode':
        this.noise(0.5, 0.35, 1200, 'lowpass', 0, undefined, 120);
        this.tone(90, 0.4, 'sine', 0.3, 0, 35);
        break;
      case 'alarm':
        for (let i = 0; i < 4; i++) this.tone(i % 2 ? 520 : 760, 0.22, 'sawtooth', 0.14, i * 0.25);
        break;
      case 'boss':
        this.tone(70, 1.4, 'sawtooth', 0.28, 0, 40);
        this.tone(75, 1.4, 'square', 0.18, 0, 45);
        this.noise(1.2, 0.2, 400, 'lowpass');
        break;
      case 'research':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.16, i * 0.07));
        break;
      case 'powerdown':
        this.tone(400, 0.7, 'sawtooth', 0.18, 0, 50);
        break;
      case 'flip':
        this.tone(200, 0.6, 'sine', 0.25, 0, 800);
        this.tone(800, 0.6, 'sine', 0.18, 0.1, 200);
        break;
      case 'clear':
        [440, 554, 659].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.15, i * 0.08));
        break;
      case 'victory':
        [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.18, i * 0.14));
        break;
      case 'defeat':
        [392, 330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.15, i * 0.22));
        this.noise(1.5, 0.2, 600, 'lowpass', 0.3);
        break;
      case 'shield':
        this.tone(1200, 0.12, 'sine', 0.08, 0, 700);
        break;
      case 'emp':
        this.noise(0.9, 0.25, 6000, 'bandpass', 0, undefined, 200);
        this.tone(900, 0.9, 'sine', 0.2, 0, 60);
        break;
      case 'step':
        this.tone(740 * p, 0.12, 'triangle', 0.1);
        this.tone(988 * p, 0.14, 'triangle', 0.1, 0.07);
        break;
      case 'lost':
        this.tone(300, 0.1, 'triangle', 0.06, 0, 120);
        break;
      case 'repair':
        this.tone(500, 0.08, 'sine', 0.12);
        this.tone(750, 0.1, 'sine', 0.12, 0.07);
        break;
    }
  }

  startMusic() {
    if (!this.ensure() || !this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setIntensity(i: number, spin: number) {
    this.intensity += (Math.max(0, Math.min(1, i)) - this.intensity) * 0.1;
    this.spin = spin;
    if (this.ctx && this.musicOn) {
      const f = 500 + this.intensity * 2600 + spin * 350;
      this.musicFilter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4);
    }
  }

  private schedule() {
    if (!this.ctx || !this.musicOn) return;
    const spb = 60 / (92 + this.intensity * 14);
    const s16 = spb / 4;
    while (this.nextTime < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime - this.ctx.currentTime, s16);
      this.nextTime += s16;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, when: number, s16: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const chord = CHORDS[bar];
    const inten = this.intensity;
    const dest = this.musicFilter;
    if (s === 0) {
      chord.forEach((f, i) => {
        this.tone(f * 2, s16 * 15, i % 2 ? 'sawtooth' : 'triangle', 0.045, when, 0, dest);
        this.tone(f * 2.005, s16 * 15, 'sawtooth', 0.025, when, 0, dest);
      });
    }
    if (s === 0 || s === 6 || s === 10 || (inten > 0.5 && s === 14)) {
      this.tone(chord[0] / 2, s16 * 3, 'sine', 0.22, when, 0, dest);
    }
    const arpEvery = inten > 0.55 ? 1 : 2;
    if (s % arpEvery === 0 && (inten > 0.05 || s % 4 === 0)) {
      const pattern = [0, 1, 2, 1, 2, 1, 0, 2];
      const note = chord[pattern[(s / arpEvery) % pattern.length | 0] % 3] * (s % 8 === 0 ? 4 : 2);
      const pitchMod = 1 + (this.spin - 1) * 0.01;
      this.tone(note * pitchMod, s16 * 1.6, 'triangle', 0.05 + inten * 0.04, when, 0, dest);
    }
    if (inten > 0.3) {
      if (s === 0 || s === 8 || (inten > 0.6 && (s === 4 || s === 12))) this.tone(120, 0.15, 'sine', 0.35, when, 40, dest);
      if (s % 2 === 1) this.noise(0.04, 0.05 + inten * 0.04, 7000, 'highpass', when, dest);
      if (inten > 0.5 && (s === 4 || s === 12)) this.noise(0.12, 0.12, 1800, 'bandpass', when, dest);
    }
  }
}

export const audio = new AudioEngine();
