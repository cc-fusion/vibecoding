// Fully synthesised sound: no audio files needed.
export class Sfx {
  ctx: AudioContext | null = null;
  muted = false;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private drillGain: GainNode | null = null;
  private drillOsc: OscillatorNode | null = null;
  private drillOsc2: OscillatorNode | null = null;
  private drillFilt: BiquadFilterNode | null = null;
  private last: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.8;
    master.connect(ctx.destination);
    this.master = master;

    // noise buffer
    const len = ctx.sampleRate * 1.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // drill loop
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0;
    const o1 = ctx.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 70;
    const o2 = ctx.createOscillator();
    o2.type = "square";
    o2.frequency.value = 35;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 27;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    o1.connect(filt);
    o2.connect(filt);
    filt.connect(g);
    g.connect(master);
    o1.start();
    o2.start();
    lfo.start();
    this.drillGain = g;
    this.drillOsc = o1;
    this.drillOsc2 = o2;
    this.drillFilt = filt;

    // ambient drone
    const amb = ctx.createGain();
    amb.gain.value = 0.05;
    amb.connect(master);
    [55, 82.5, 110.3].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const l = ctx.createOscillator();
      l.frequency.value = 0.05 + i * 0.04;
      const lg = ctx.createGain();
      lg.gain.value = 1.2;
      l.connect(lg);
      lg.connect(o.detune);
      o.connect(amb);
      o.start();
      l.start();
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  private ok(key: string, gap: number) {
    if (!this.ctx) return false;
    const t = performance.now();
    if (this.last[key] && t - this.last[key] < gap) return false;
    this.last[key] = t;
    return true;
  }

  setDrill(level: number, pitch: number) {
    if (!this.ctx || !this.drillGain || !this.drillOsc || !this.drillOsc2 || !this.drillFilt) return;
    const t = this.ctx.currentTime;
    this.drillGain.gain.setTargetAtTime(level * 0.13, t, 0.05);
    const f = 55 + pitch * 40;
    this.drillOsc.frequency.setTargetAtTime(f, t, 0.08);
    this.drillOsc2.frequency.setTargetAtTime(f / 2, t, 0.08);
    this.drillFilt.frequency.setTargetAtTime(300 + pitch * 500, t, 0.08);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(dur: number, vol: number, freq: number, type: BiquadFilterType = "lowpass") {
    if (!this.ctx || !this.master || !this.noise) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * 0.15), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  laser() {
    if (!this.ok("laser", 40)) return;
    this.tone(1000, 0.13, "square", 0.04, 220);
  }
  pickup(pitch = 0) {
    if (!this.ok("pickup", 45)) return;
    this.tone(620 + pitch * 120, 0.09, "triangle", 0.07, 1100 + pitch * 150);
  }
  boom(size = 1) {
    if (!this.ok("boom", 30)) return;
    this.burst(0.35 + size * 0.35, 0.3 * Math.min(1.3, 0.6 + size * 0.4), 1400 - size * 300);
    this.tone(110, 0.3 + size * 0.2, "sine", 0.25, 30);
  }
  hit() {
    if (!this.ok("hit", 60)) return;
    this.burst(0.18, 0.25, 2200, "bandpass");
    this.tone(150, 0.18, "sawtooth", 0.1, 60);
  }
  thud() {
    if (!this.ok("thud", 80)) return;
    this.burst(0.15, 0.2, 500);
    this.tone(80, 0.15, "sine", 0.2, 40);
  }
  jam() {
    this.tone(1200, 0.5, "sawtooth", 0.07, 100);
    this.tone(900, 0.5, "square", 0.04, 70, 0.05);
  }
  alarm() {
    if (!this.ok("alarm", 350)) return;
    this.tone(880, 0.14, "square", 0.05);
    this.tone(660, 0.14, "square", 0.05, undefined, 0.16);
  }
  warn() {
    if (!this.ok("warn", 900)) return;
    this.tone(440, 0.12, "square", 0.04);
  }
  deny() {
    if (!this.ok("deny", 120)) return;
    this.tone(150, 0.14, "square", 0.06, 100);
  }
  click() {
    if (!this.ok("click", 30)) return;
    this.tone(520, 0.05, "square", 0.04, 780);
  }
  dock() {
    this.tone(440, 0.25, "triangle", 0.1);
    this.tone(660, 0.3, "triangle", 0.1, undefined, 0.12);
    this.tone(880, 0.4, "triangle", 0.1, undefined, 0.24);
  }
  core() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.1, undefined, i * 0.07));
    this.boom(1.2);
  }
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.4, "triangle", 0.1, undefined, i * 0.12));
  }
  lose() {
    this.tone(220, 1.2, "sawtooth", 0.1, 40);
  }
}
