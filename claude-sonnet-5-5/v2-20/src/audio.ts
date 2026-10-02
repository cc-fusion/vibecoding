// Fully synthesized audio: SFX + reactive generative music (Web Audio API)
type Wave = OscillatorType;

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicG!: GainNode;
  sfxG!: GainNode;
  filter!: BiquadFilterNode;
  vol = { master: 0.7, music: 0.5, sfx: 0.8 };
  muted = false;
  tension = 0;
  duck = false;
  private timer: number | null = null;
  private step = 0;
  private nextT = 0;
  private rootMidi = 45;

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicG = this.ctx.createGain();
      this.sfxG = this.ctx.createGain();
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 900;
      this.filter.Q.value = 3;
      this.musicG.connect(this.filter);
      this.filter.connect(this.master);
      this.sfxG.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.apply();
    } catch {
      this.ctx = null;
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolumes(v: { master: number; music: number; sfx: number }, muted: boolean) {
    this.vol = { ...v };
    this.muted = muted;
    this.apply();
  }

  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.55 * (this.duck ? 0.4 : 1), t, 0.1);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }

  setDuck(d: boolean) {
    this.duck = d;
    this.apply();
  }

  setTension(x: number) {
    this.tension = Math.max(0, Math.min(1, x));
    if (this.ctx) this.filter.frequency.setTargetAtTime((this.duck ? 400 : 650) + this.tension * 2600, this.ctx.currentTime, 0.2);
  }

  private hz(m: number) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  tone(f: number, dur: number, type: Wave = "sine", vol = 0.15, delay = 0, slideTo?: number, dest?: AudioNode) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, vol = 0.1, freq = 1000, delay = 0, dest?: AudioNode, type: BiquadFilterType = "bandpass") {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxG);
    s.start(t);
  }

  sfx(name: string) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case "click": this.tone(760, 0.05, "square", 0.05); break;
      case "open": this.tone(380, 0.14, "sine", 0.12, 0, 760); break;
      case "close": this.tone(600, 0.1, "sine", 0.1, 0, 300); break;
      case "step": this.noise(0.05, 0.035, 300 + Math.random() * 120); break;
      case "beep": this.tone(1250, 0.06, "sine", 0.1); break;
      case "key": this.tone(900 + Math.random() * 300, 0.05, "square", 0.05); break;
      case "learn": [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, "sine", 0.14, i * 0.07)); break;
      case "evidence": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.16, i * 0.08)); break;
      case "right": this.tone(660, 0.12, "triangle", 0.16); this.tone(990, 0.2, "triangle", 0.16, 0.08); break;
      case "bad": this.tone(130, 0.28, "sawtooth", 0.14, 0, 70); break;
      case "zap": this.noise(0.35, 0.22, 2400); this.tone(70, 0.3, "sawtooth", 0.15, 0, 40); break;
      case "alert": for (let i = 0; i < 4; i++) this.tone(i % 2 ? 660 : 990, 0.12, "square", 0.09, i * 0.13); break;
      case "notice": this.tone(500, 0.1, "square", 0.1); this.tone(750, 0.16, "square", 0.1, 0.1); break;
      case "blackout": this.tone(420, 0.9, "sawtooth", 0.14, 0, 40); this.noise(0.6, 0.12, 200, 0, undefined, "lowpass"); break;
      case "crime":
        this.tone(55, 2.4, "sine", 0.4, 0, 30);
        this.tone(233, 1.6, "sawtooth", 0.12);
        this.tone(247, 1.6, "sawtooth", 0.12);
        this.noise(1.2, 0.3, 180, 0, undefined, "lowpass");
        break;
      case "rewind":
        this.tone(1400, 1.5, "sawtooth", 0.1, 0, 60);
        this.tone(80, 1.2, "triangle", 0.12, 1.1, 900);
        this.noise(1.6, 0.12, 3000);
        break;
      case "detain": this.noise(0.25, 0.3, 900); this.tone(110, 0.5, "square", 0.16, 0, 55); break;
      case "win": [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.16, i * 0.12)); break;
      case "lose": [392, 330, 262, 196, 147].forEach((f, i) => this.tone(f, 0.5, "sawtooth", 0.1, i * 0.18)); break;
      case "pulse": this.tone(300, 0.6, "sine", 0.14, 0, 1400); break;
      case "tick": this.tone(1900, 0.02, "square", 0.03); break;
      default: break;
    }
  }

  startMusic(rootMidi = 45) {
    this.resume();
    if (!this.ctx) return;
    this.rootMidi = rootMidi;
    this.stopMusic();
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  stopMusic() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedule() {
    const c = this.ctx;
    if (!c) return;
    if (this.nextT < c.currentTime - 0.5) this.nextT = c.currentTime + 0.05;
    const spb = 60 / (78 + this.tension * 68) / 4;
    while (this.nextT < c.currentTime + 0.3) {
      this.playStep(this.step, this.nextT - c.currentTime);
      this.nextT += spb;
      this.step++;
    }
  }

  private playStep(s: number, delay: number) {
    const pos = s % 16;
    const bar = Math.floor(s / 16);
    const prog = [0, -2, -4, -5][bar % 4];
    const root = this.rootMidi + prog;
    const scale = [0, 2, 3, 5, 7, 8, 10];
    const tn = this.tension;
    const dest = this.musicG;
    if (pos === 0 || (pos === 10 && tn > 0.3)) this.tone(this.hz(root), 0.55, "triangle", 0.3, delay, undefined, dest);
    if (pos === 0 && bar % 2 === 0) {
      this.tone(this.hz(root + 12), 3.2, "sawtooth", 0.05, delay, undefined, dest);
      this.tone(this.hz(root + 19) * 1.004, 3.2, "sawtooth", 0.045, delay, undefined, dest);
    }
    const pat = [0, 2, 4, 2, 5, 4, 2, 1];
    if (pos % 2 === 0 && (tn > 0.12 || pos % 4 === 0)) {
      const idx = pat[(pos / 2 + bar) % 8];
      this.tone(this.hz(root + 24 + scale[idx % 7]), 0.16, "square", 0.05, delay, undefined, dest);
    }
    if (tn > 0.4 && pos % 2 === 1) this.noise(0.04, 0.05, 7000, delay, dest, "highpass");
    if (tn > 0.6 && pos % 4 === 0) this.tone(120, 0.18, "sine", 0.3, delay, 40, dest);
  }
}

export const audio = new AudioEngine();
