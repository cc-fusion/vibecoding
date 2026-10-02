export type MusicMode = "off" | "menu" | "prep" | "battle" | "boss";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const ROOTS = [38, 34, 31, 33];
const SCALE = [0, 2, 3, 5, 7, 8, 10];

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxG!: GainNode;
  private musicG!: GainNode;
  private noiseBuf!: AudioBuffer;
  private delayIn!: GainNode;
  vol = { master: 0.7, sfx: 0.8, music: 0.5, muted: false };
  mode: MusicMode = "off";
  intensity = 0;
  private timer: number | null = null;
  private nextT = 0;
  private step = 0;
  private last: Record<string, number> = {};

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const c = this.ctx;
        const comp = c.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 5;
        comp.connect(c.destination);
        this.master = c.createGain();
        this.master.connect(comp);
        this.sfxG = c.createGain();
        this.sfxG.connect(this.master);
        this.musicG = c.createGain();
        this.musicG.connect(this.master);
        // echo for music
        const d = c.createDelay(1);
        d.delayTime.value = 0.36;
        const fb = c.createGain();
        fb.gain.value = 0.38;
        const lp = c.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 1800;
        this.delayIn = c.createGain();
        this.delayIn.gain.value = 0.5;
        this.delayIn.connect(d);
        d.connect(lp);
        lp.connect(fb);
        fb.connect(d);
        lp.connect(this.musicG);
        // noise buffer
        const len = c.sampleRate * 2;
        this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.applyVol();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      if (this.mode !== "off" && this.timer === null) {
        this.nextT = this.ctx.currentTime + 0.1;
        this.step = 0;
        this.timer = window.setInterval(() => this.pump(), 40);
      }
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: { master: number; sfx: number; music: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVol();
  }

  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.03);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.8, t, 0.03);
  }

  suspend() {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  /* ---------- primitives ---------- */
  private tone(f: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, dest?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1: number, delay = 0, q = 1, dest?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = ftype;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest || this.sfxG);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  /* ---------- sound effects ---------- */
  sfx(name: string, pitch = 1) {
    const c = this.ctx;
    if (!c || this.vol.muted || c.state !== "running") return;
    const now = c.currentTime;
    const gap = name === "hit" || name === "kill" ? 0.045 : name === "tick" ? 0.1 : 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case "click": this.tone(660, 0.07, "triangle", 0.12); break;
      case "back": this.tone(400, 0.08, "triangle", 0.1, 280); break;
      case "error": this.tone(140, 0.16, "sawtooth", 0.1, 90); break;
      case "lightning":
        this.noise(0.5, 0.5, "bandpass", 3500, 200, 0, 0.8);
        this.tone(90, 0.7, "sawtooth", 0.25, 35);
        this.tone(1800 * pitch, 0.12, "square", 0.08, 300);
        break;
      case "zap": this.tone(1400 * pitch, 0.1, "square", 0.05, 400); break;
      case "rain": this.noise(1.2, 0.3, "highpass", 1500, 4500, 0, 0.5); this.tone(520, 0.4, "sine", 0.07, 780); break;
      case "blizzard": this.noise(1.1, 0.28, "bandpass", 5000, 900, 0, 2); this.tone(1320, 0.5, "sine", 0.06, 880); this.tone(1760, 0.5, "sine", 0.04, 1320, 0.08); break;
      case "fire": this.noise(0.9, 0.38, "lowpass", 2400, 250, 0, 1); this.tone(110, 0.5, "sawtooth", 0.12, 55); break;
      case "gale": this.noise(0.9, 0.4, "bandpass", 300, 2600, 0, 1.4); break;
      case "rockwarn": this.tone(120, 0.5, "sine", 0.18, 70); break;
      case "rockfall": this.tone(70, 0.6, "sine", 0.5, 28); this.noise(0.6, 0.55, "lowpass", 900, 90); break;
      case "wall": this.tone(100, 0.12, "square", 0.12, 60); this.noise(0.12, 0.15, "lowpass", 1000, 200); break;
      case "dig": this.noise(0.22, 0.2, "bandpass", 700, 200, 0, 1); break;
      case "wallbreak": this.noise(0.4, 0.35, "lowpass", 1200, 100); this.tone(80, 0.3, "square", 0.12, 40); break;
      case "hit": this.tone((300 + Math.random() * 80) * pitch, 0.05, "square", 0.04, 120); break;
      case "kill": this.tone(220 * pitch, 0.12, "triangle", 0.09, 80); break;
      case "boom": this.tone(60, 0.7, "sine", 0.6, 25); this.noise(0.5, 0.5, "lowpass", 1400, 70); break;
      case "gate": this.tone(55, 0.8, "sine", 0.65, 22); this.noise(0.6, 0.4, "lowpass", 700, 60); this.tone(180, 0.3, "sawtooth", 0.1, 90); break;
      case "freeze": this.tone(1900, 0.25, "sine", 0.1, 2600); this.tone(2400, 0.3, "sine", 0.07, 3200, 0.05); break;
      case "shatter": this.noise(0.35, 0.35, "highpass", 3000, 7000); this.tone(1400, 0.2, "triangle", 0.1, 300); break;
      case "steam": this.noise(0.5, 0.22, "highpass", 3000, 6000, 0, 0.5); break;
      case "conduct": this.tone(900, 0.18, "sawtooth", 0.1, 2200); this.tone(1800, 0.2, "square", 0.05, 600, 0.04); break;
      case "reaction": this.tone(660, 0.1, "triangle", 0.1); this.tone(990, 0.16, "triangle", 0.1, 0, 0.07); break;
      case "horn": this.tone(147, 1.2, "sawtooth", 0.14, 0); this.tone(220, 1.2, "sawtooth", 0.1, 0, 0.0); this.tone(196, 1.0, "sawtooth", 0.1, 0, 0.5); break;
      case "boss":
        this.tone(55, 1.6, "sawtooth", 0.3, 40); this.tone(58, 1.6, "square", 0.15, 38);
        this.noise(1.4, 0.4, "lowpass", 900, 60);
        break;
      case "relic": [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(74 + s), 0.5, "triangle", 0.12, 0, i * 0.08)); break;
      case "wave": [0, 7, 12].forEach((s, i) => this.tone(mtof(62 + s), 0.6, "sine", 0.14, 0, i * 0.1)); break;
      case "tempest":
        this.noise(2.2, 0.55, "bandpass", 200, 3000, 0, 0.7);
        this.tone(50, 2, "sawtooth", 0.35, 120);
        break;
      case "ready": this.tone(880, 0.2, "sine", 0.1, 1320); break;
      case "victory": [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => { this.tone(mtof(62 + s), 0.7, "triangle", 0.14, 0, i * 0.13); this.tone(mtof(50 + s), 0.7, "sawtooth", 0.05, 0, i * 0.13); }); break;
      case "defeat": [0, -2, -5, -9, -14].forEach((s, i) => this.tone(mtof(62 + s), 0.9, "sawtooth", 0.12, 0, i * 0.28)); break;
      case "buy": this.tone(784, 0.1, "triangle", 0.12); this.tone(1175, 0.18, "triangle", 0.12, 0, 0.08); break;
      default: break;
    }
  }

  /* ---------- reactive music ---------- */
  setMode(mode: MusicMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    if (mode === "off") {
      this.stopTimer();
      return;
    }
    if (this.ctx && this.timer === null) {
      this.nextT = this.ctx.currentTime + 0.1;
      this.step = 0;
      this.timer = window.setInterval(() => this.pump(), 40);
    }
  }
  setIntensity(v: number) {
    this.intensity += (Math.max(0, Math.min(1, v)) - this.intensity) * 0.08;
  }
  private stopTimer() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  stopAll() {
    this.mode = "off";
    this.stopTimer();
  }

  private pump() {
    const c = this.ctx;
    if (!c || c.state !== "running" || this.mode === "off") return;
    const boss = this.mode === "boss";
    const inten = this.mode === "battle" || boss ? Math.max(0.3, this.intensity) : this.mode === "prep" ? 0.15 : 0.1;
    const bpm = 64 + inten * 48 + (boss ? 10 : 0);
    const sd = 60 / bpm / 2;
    let guard = 0;
    while (this.nextT < c.currentTime + 0.2 && guard++ < 8) {
      this.schedule(this.step, this.nextT, sd, inten, boss);
      this.nextT += sd;
      this.step++;
    }
  }

  private schedule(step: number, t: number, sd: number, inten: number, boss: boolean) {
    const c = this.ctx!;
    const bar = Math.floor(step / 16);
    const root = ROOTS[bar % 4];
    if (step % 16 === 0) this.pad(root, t, sd * 16 + 1.5, inten);
    // arpeggio
    const pattern = [0, 2, 4, 2, 5, 4, 2, 1];
    const everyN = this.mode === "menu" || this.mode === "prep" ? 2 : inten > 0.6 ? 1 : 2;
    if (step % everyN === 0 && (this.mode !== "prep" || step % 4 === 0)) {
      const deg = pattern[(step / everyN) % pattern.length | 0];
      const note = root + 24 + SCALE[deg % 7] + (deg >= 7 ? 12 : 0);
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = boss ? "sawtooth" : "triangle";
      o.frequency.value = mtof(note);
      const v = 0.035 + inten * 0.04;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + sd * 1.8);
      o.connect(g);
      g.connect(this.musicG);
      g.connect(this.delayIn);
      o.start(t);
      o.stop(t + sd * 2);
    }
    if (this.mode === "battle" || boss) {
      if (inten > 0.3 && step % 4 === 0) this.drum(t, 1);
      if (inten > 0.55 && step % 8 === 4) this.drum(t, 2);
      if (inten > 0.75 && step % 2 === 1) this.drum(t, 3);
      if (boss && step % 16 === 8) {
        this.tone(mtof(root + 12), sd * 4, "sawtooth", 0.1, 0, t - c.currentTime, this.musicG);
        this.tone(mtof(root + 18), sd * 4, "sawtooth", 0.07, 0, t - c.currentTime, this.musicG);
      }
    }
  }

  private pad(root: number, t: number, len: number, inten: number) {
    const c = this.ctx!;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(350 + inten * 700, t);
    lp.frequency.linearRampToValueAtTime(700 + inten * 1400, t + len * 0.5);
    lp.frequency.linearRampToValueAtTime(350 + inten * 700, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.1, t + len * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    lp.connect(g);
    g.connect(this.musicG);
    [0, 7, 15, 19].forEach((iv, i) => {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(root + iv + (i === 0 ? 0 : 12));
        o.detune.value = det;
        const og = c.createGain();
        og.gain.value = i === 0 ? 0.5 : 0.22;
        o.connect(og);
        og.connect(lp);
        o.start(t);
        o.stop(t + len + 0.1);
      }
    });
  }

  private drum(t: number, kind: number) {
    const c = this.ctx!;
    const d = t - c.currentTime;
    if (kind === 1) {
      this.tone(110, 0.28, "sine", 0.45, 38, d, this.musicG);
      this.noise(0.08, 0.1, "lowpass", 800, 200, d, 1, this.musicG);
    } else if (kind === 2) {
      this.noise(0.18, 0.2, "bandpass", 2200, 1200, d, 0.8, this.musicG);
      this.tone(180, 0.12, "triangle", 0.15, 100, d, this.musicG);
    } else {
      this.noise(0.04, 0.07, "highpass", 7000, 8000, d, 1, this.musicG);
    }
  }
}
