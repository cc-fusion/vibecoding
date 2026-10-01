// Fully synthesized audio: SFX + generative synthwave music. No assets needed.

type SfxName =
  | "shoot"
  | "hit"
  | "kill"
  | "big"
  | "dash"
  | "reflect"
  | "hurt"
  | "pickup"
  | "orb"
  | "wave"
  | "boss"
  | "ui"
  | "buy"
  | "nova"
  | "lose"
  | "win"
  | "shock"
  | "spawn";

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  muted = false;
  intensity = 0;
  lastKick = -10;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private last: Record<string, number> = {};

  init() {
    if (!this.ctx) {
      const AC: typeof AudioContext | undefined =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.8;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.3;
      this.musicBus.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.startMusic();
  }

  suspend() {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.7;
  }

  private throttle(name: string, ms: number): boolean {
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < ms) return false;
    this.last[name] = now;
    return true;
  }

  tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.1, slide = 0, delay = 0, bus?: GainNode | null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus || this.sfxBus!);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  noise(dur: number, vol = 0.1, freq = 1000, type: BiquadFilterType = "lowpass", delay = 0, bus?: GainNode | null) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    const t = this.ctx.currentTime + Math.max(0, delay);
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(bus || this.sfxBus!);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.03);
  }

  play(name: SfxName, pitch = 1) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case "shoot":
        if (!this.throttle("shoot", 45)) return;
        this.tone((520 + Math.random() * 80) * pitch, 0.07, "square", 0.035, 0.45);
        break;
      case "hit":
        if (!this.throttle("hit", 35)) return;
        this.tone(240 + Math.random() * 60, 0.05, "square", 0.04, 0.6);
        break;
      case "kill":
        if (!this.throttle("kill", 30)) return;
        this.noise(0.2, 0.12, 1400);
        this.tone(160, 0.18, "sawtooth", 0.07, 0.35);
        break;
      case "big":
        this.noise(0.9, 0.3, 700);
        this.tone(80, 0.7, "sawtooth", 0.22, 0.25);
        this.tone(50, 0.9, "sine", 0.3, 0.5);
        break;
      case "dash":
        this.noise(0.18, 0.1, 2800, "bandpass");
        this.tone(260, 0.16, "sine", 0.09, 3.2);
        break;
      case "reflect":
        if (!this.throttle("reflect", 50)) return;
        this.tone(1300 * pitch, 0.16, "triangle", 0.12, 1.6);
        this.tone(1900 * pitch, 0.1, "sine", 0.07, 1, 0.02);
        break;
      case "hurt":
        this.tone(120, 0.35, "sawtooth", 0.2, 0.4);
        this.noise(0.25, 0.18, 900);
        break;
      case "pickup":
        if (!this.throttle("pickup", 40)) return;
        this.tone(880 * pitch, 0.06, "square", 0.05);
        this.tone(1320 * pitch, 0.08, "square", 0.05, 1, 0.05);
        break;
      case "orb":
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, "triangle", 0.12, 1, i * 0.055));
        break;
      case "wave":
        this.tone(110, 0.6, "sawtooth", 0.12, 4);
        this.noise(0.6, 0.08, 4000, "highpass");
        break;
      case "boss":
        this.tone(55, 1.6, "sawtooth", 0.25, 0.6);
        this.tone(58, 1.6, "square", 0.12, 0.6);
        this.noise(1.2, 0.15, 400);
        break;
      case "ui":
        this.tone(660, 0.05, "square", 0.05);
        break;
      case "buy":
        this.tone(660, 0.07, "square", 0.07);
        this.tone(990, 0.12, "square", 0.07, 1, 0.07);
        break;
      case "nova":
        this.noise(1, 0.3, 2000);
        this.tone(200, 0.9, "sawtooth", 0.2, 5);
        break;
      case "lose":
        [440, 370, 311, 247, 185, 131].forEach((f, i) => this.tone(f, 0.3, "sawtooth", 0.14, 0.9, i * 0.14));
        break;
      case "win":
        [392, 494, 587, 784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.14, 1, i * 0.1));
        break;
      case "shock":
        this.tone(900, 0.2, "sawtooth", 0.1, 0.3);
        this.noise(0.15, 0.1, 5000, "highpass");
        break;
      case "spawn":
        if (!this.throttle("spawn", 120)) return;
        this.tone(300, 0.15, "sine", 0.05, 2);
        break;
    }
  }

  private startMusic() {
    if (this.timer !== null || !this.ctx) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 30);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05;
    const stepDur = 60 / (this.intensity >= 3 ? 140 : 124) / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const offs = [0, -2, -4, -5];
    const root = 55 * Math.pow(2, offs[bar] / 12);
    const d = t - ctx.currentTime;
    const mb = this.musicBus;
    const lvl = this.intensity;

    if (lvl === 0) {
      if (s === 0) {
        [1, 1.189, 1.498].forEach((m) => this.tone(root * 4 * m, 1.8, "sine", 0.07, 1, d, mb));
        this.tone(root * 2, 1.8, "triangle", 0.15, 1, d, mb);
      }
      if (s % 4 === 2) this.tone(root * 8 * [1, 1.498, 1.189, 1.782][(s / 4) | 0], 0.3, "triangle", 0.05, 1, d, mb);
      if (s === 0 || s === 8) this.lastKick = t;
      return;
    }
    if (s % 4 === 0) {
      this.tone(150, 0.14, "sine", 0.5, 0.25, d, mb);
      this.lastKick = t;
    }
    if (s === 4 || s === 12) this.noise(0.14, 0.12, 1800, "bandpass", d, mb);
    if (s % 2 === 1) this.noise(0.04, 0.05, 7000, "highpass", d, mb);
    if (s % 2 === 0) {
      const oct = s % 8 === 6 ? 2 : 1;
      this.tone(root * oct, 0.2, "sawtooth", 0.11, 0.9, d, mb);
    }
    if (lvl >= 2) {
      const pent = [0, 3, 7, 10, 12, 10, 7, 3];
      const n = root * 4 * Math.pow(2, pent[(s + bar * 2) % 8] / 12);
      this.tone(n, 0.11, "square", 0.04, 1, d, mb);
    }
    if (lvl >= 3 && s % 4 === 0) {
      this.tone(root * 8, 0.35, "sawtooth", 0.05, 0.98, d, mb);
      this.tone(root * 8 * 1.498, 0.35, "sawtooth", 0.04, 0.98, d, mb);
    }
  }
}

export const audio = new AudioEngine();
