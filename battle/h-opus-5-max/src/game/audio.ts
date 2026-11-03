// ───────────────────────────────────────────────────────────────────────────
//  Fully procedural audio (WebAudio) - no asset files
// ───────────────────────────────────────────────────────────────────────────

type Mat = "grass" | "stone" | "wood" | "sand" | "gravel" | "glass" | "wool" | "liquid";

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  ambientBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private rainGain: GainNode | null = null;
  private underwaterFilter: BiquadFilterNode | null = null;
  enabled = true;
  musicVolume = 0.32;
  sfxVolume = 0.7;
  private nextNote = 0;
  private musicOn = true;

  init() {
    if (this.ctx) return;
    const AC: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.underwaterFilter = this.ctx.createBiquadFilter();
    this.underwaterFilter.type = "lowpass";
    this.underwaterFilter.frequency.value = 20000;
    this.master.connect(this.underwaterFilter);
    this.underwaterFilter.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);
    this.ambientBus = this.ctx.createGain();
    this.ambientBus.gain.value = 0.5;
    this.ambientBus.connect(this.master);

    // white noise buffer
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;

    // rain loop (filtered noise, gain controlled)
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    const rf = this.ctx.createBiquadFilter();
    rf.type = "bandpass";
    rf.frequency.value = 1400;
    rf.Q.value = 0.35;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(rf);
    rf.connect(this.rainGain);
    this.rainGain.connect(this.ambientBus);
    src.start();
  }

  resume() {
    this.init();
    if (this.ctx?.state === "suspended") this.ctx.resume();
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (!this.ctx) return;
    this.master.gain.value = master;
    this.musicBus.gain.value = music;
    this.sfxBus.gain.value = sfx;
  }

  setUnderwater(on: boolean) {
    if (!this.ctx || !this.underwaterFilter) return;
    this.underwaterFilter.frequency.setTargetAtTime(on ? 420 : 20000, this.ctx.currentTime, 0.1);
  }

  setRain(intensity: number) {
    if (!this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(intensity * 0.22, this.ctx.currentTime, 0.6);
  }

  private env(
    node: AudioNode,
    gain: number,
    attack: number,
    decay: number,
    dest: AudioNode = this.sfxBus,
  ) {
    const g = this.ctx!.createGain();
    const t = this.ctx!.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g);
    g.connect(dest);
    return g;
  }

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass") {
    if (!this.ctx || !this.noiseBuf || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    this.env(f, gain, 0.005, dur);
    src.start();
    src.stop(this.ctx.currentTime + dur + 0.05);
  }

  private tone(
    freq: number,
    dur: number,
    gain: number,
    type: OscillatorType = "sine",
    slideTo?: number,
    dest?: AudioNode,
  ) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    this.env(o, gain, 0.008, dur, dest);
    o.start();
    o.stop(t + dur + 0.05);
  }

  step(mat: Mat) {
    if (!this.ctx) return;
    switch (mat) {
      case "grass": this.noise(0.11, 900 + Math.random() * 300, 1.2, 0.12); break;
      case "sand": this.noise(0.13, 1600 + Math.random() * 400, 0.8, 0.1); break;
      case "gravel": this.noise(0.1, 600 + Math.random() * 300, 2, 0.15); break;
      case "wood": this.noise(0.08, 420 + Math.random() * 120, 4, 0.16); break;
      case "wool": this.noise(0.1, 350, 1.4, 0.08); break;
      case "glass":
      case "stone": this.noise(0.07, 1200 + Math.random() * 500, 3, 0.13); break;
      case "liquid": this.noise(0.18, 700, 0.7, 0.1); break;
    }
  }

  dig(mat: Mat) {
    if (!this.ctx) return;
    switch (mat) {
      case "stone": this.noise(0.08, 2200, 2, 0.1); break;
      case "wood": this.noise(0.08, 500, 3, 0.11); break;
      case "grass": this.noise(0.09, 1100, 1, 0.09); break;
      default: this.noise(0.08, 1300, 1.5, 0.09);
    }
  }

  breakBlock(mat: Mat) {
    if (!this.ctx) return;
    this.noise(0.25, mat === "stone" ? 1500 : mat === "wood" ? 420 : 900, 1.1, 0.26);
    if (mat === "glass") this.noise(0.3, 4200, 2.5, 0.3, "highpass");
  }

  place(mat: Mat) {
    if (!this.ctx) return;
    this.noise(0.1, mat === "stone" ? 900 : 520, 2.4, 0.22);
    this.tone(mat === "wood" ? 180 : 140, 0.07, 0.1, "square");
  }

  pickup() {
    this.tone(880, 0.07, 0.07, "triangle", 1320);
  }
  craft() {
    this.tone(520, 0.08, 0.08, "triangle", 780);
    setTimeout(() => this.tone(780, 0.1, 0.07, "triangle", 1040), 60);
  }
  hurt() {
    this.tone(180, 0.22, 0.2, "sawtooth", 90);
    this.noise(0.12, 300, 0.8, 0.14);
  }
  splash() {
    this.noise(0.4, 900, 0.6, 0.22, "lowpass");
  }
  eat() {
    for (let i = 0; i < 3; i++)
      setTimeout(() => this.noise(0.07, 400 + Math.random() * 300, 3, 0.1), i * 110);
  }
  explode() {
    this.noise(0.7, 150, 0.4, 0.5, "lowpass");
  }
  thunder() {
    if (!this.ctx) return;
    this.noise(1.6, 180, 0.25, 0.45, "lowpass");
    setTimeout(() => this.noise(2.2, 90, 0.2, 0.3, "lowpass"), 180);
  }
  mob(kind: "pig" | "cow" | "sheep" | "chicken" | "zombie" | "spider") {
    if (!this.ctx) return;
    switch (kind) {
      case "pig": this.tone(300, 0.18, 0.1, "sawtooth", 180); break;
      case "cow": this.tone(140, 0.5, 0.11, "sawtooth", 110); break;
      case "sheep": this.tone(420, 0.3, 0.08, "square", 360); break;
      case "chicken": this.tone(900, 0.1, 0.07, "square", 1200); break;
      case "zombie": this.tone(110, 0.6, 0.12, "sawtooth", 80); break;
      case "spider": this.noise(0.25, 2600, 4, 0.1); break;
    }
  }
  levelUp() {
    [523, 659, 784, 1046].forEach((f, i) =>
      setTimeout(() => this.tone(f, 0.25, 0.09, "triangle"), i * 90),
    );
  }

  /** ambient generative music: slow pentatonic pads */
  tickMusic(time: number, night: boolean) {
    if (!this.ctx || !this.musicOn || !this.enabled) return;
    if (time < this.nextNote) return;
    this.nextNote = time + 2.4 + Math.random() * 5.2;
    const scale = night ? [220, 261.6, 293.7, 349.2, 392] : [261.6, 293.7, 329.6, 392, 440];
    const root = scale[Math.floor(Math.random() * scale.length)];
    const oct = Math.random() < 0.35 ? 2 : 1;
    const f = root * oct;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [mul, g] of [
      [1, 0.14],
      [2, 0.05],
      [3, 0.02],
    ] as [number, number][]) {
      const o = this.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mul;
      const gn = this.ctx.createGain();
      gn.gain.setValueAtTime(0, t);
      gn.gain.linearRampToValueAtTime(g, t + 0.6);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + 4.5);
      o.connect(gn);
      gn.connect(this.musicBus);
      o.start();
      o.stop(t + 4.6);
    }
  }
  setMusic(on: boolean) {
    this.musicOn = on;
  }
}

export const audio = new AudioEngine();
