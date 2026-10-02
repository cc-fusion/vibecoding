export type Sfx =
  | "ui" | "select" | "tick" | "found" | "empty" | "deduce" | "coincidence" | "wrong" | "hurt" | "pulse" | "dash"
  | "tell" | "break" | "accuse" | "win" | "lose" | "door" | "dawn" | "press" | "boss" | "bossdown" | "heal";

type Scene = "menu" | "palace" | "board" | "talk";

const CHORDS = [
  { r: 110.0, t: [0, 3, 7, 10] },
  { r: 87.31, t: [0, 4, 7, 11] },
  { r: 130.81, t: [0, 4, 7, 12] },
  { r: 82.41, t: [0, 4, 7, 10] },
];

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicG: GainNode | null = null;
  sfxG: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  tension = 0;
  scene: Scene = "menu";
  timer: number | null = null;
  step = 0;
  nextT = 0;
  padNodes: { stop: (t: number) => void }[] = [];

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        this.master = ctx.createGain();
        this.musicG = ctx.createGain();
        this.sfxG = ctx.createGain();
        this.musicG.connect(this.master);
        this.sfxG.connect(this.master);
        this.master.connect(comp);
        comp.connect(ctx.destination);
        const len = ctx.sampleRate;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        this.ctx = ctx;
        this.applyVol();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVol();
  }

  private applyVol() {
    if (!this.ctx || !this.master || !this.musicG || !this.sfxG) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.05);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.9, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  setMood(scene: Scene, tension: number) {
    this.scene = scene;
    this.tension = Math.max(0, Math.min(1, tension));
  }

  startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 110);
  }

  stopMusic() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.padNodes.forEach((p) => {
        try { p.stop(t + 0.3); } catch { /* already stopped */ }
      });
    }
    this.padNodes = [];
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const bpm = 72 + this.tension * 34;
    const stepDur = 60 / bpm / 2;
    while (this.nextT < ctx.currentTime + 0.35) {
      this.playStep(this.step, this.nextT, stepDur);
      this.step++;
      this.nextT += stepDur;
    }
  }

  private playStep(step: number, t: number, sd: number) {
    const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
    const s8 = step % 8;
    const ten = this.tension;
    const f = (semi: number, oct = 1) => chord.r * Math.pow(2, semi / 12) * oct;
    if (s8 === 0) {
      chord.t.slice(0, 3).forEach((semi, i) => this.pad(f(semi, 2) * (i === 1 ? 1.003 : 1), t, sd * 8, 0.035 + ten * 0.02, 500 + ten * 1400));
      this.tn(f(0, 0.5), sd * 7, "sine", 0.16, undefined, t, this.musicG);
    }
    const p = this.scene === "talk" ? 0.28 : this.scene === "board" ? 0.4 : 0.38 + ten * 0.3;
    if (Math.random() < p) {
      const semi = chord.t[Math.floor(Math.random() * chord.t.length)];
      const oct = Math.random() < 0.5 ? 4 : 2;
      this.tn(f(semi, oct), sd * 2.2, "triangle", 0.05 + ten * 0.025, undefined, t, this.musicG);
    }
    if (ten > 0.4 && (s8 === 0 || s8 === 3)) {
      this.tn(75, 0.22, "sine", 0.18 * ten + 0.05, 38, t, this.musicG);
    }
    if (ten > 0.7 && s8 % 2 === 1) this.nz(0.04, 0.03 * ten, 6000, t, 1, this.musicG);
  }

  private pad(freq: number, t: number, dur: number, vol: number, cutoff: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicG) return;
    const o = ctx.createOscillator();
    const o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const fl = ctx.createBiquadFilter();
    fl.type = "lowpass";
    fl.frequency.value = cutoff;
    o.type = "sawtooth";
    o2.type = "sawtooth";
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.006;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 1.05);
    o.connect(fl);
    o2.connect(fl);
    fl.connect(g);
    g.connect(this.musicG);
    o.start(t);
    o2.start(t);
    o.stop(t + dur * 1.1);
    o2.stop(t + dur * 1.1);
  }

  private tn(freq: number, dur: number, type: OscillatorType, vol: number, to?: number, delay = 0, dest?: GainNode | null) {
    const ctx = this.ctx;
    const out = dest || this.sfxG;
    if (!ctx || !out) return;
    const t = Math.max(delay, ctx.currentTime);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private nz(dur: number, vol: number, freq: number, delay = 0, q = 1, dest?: GainNode | null, sweepTo?: number) {
    const ctx = this.ctx;
    const out = dest || this.sfxG;
    if (!ctx || !out || !this.noiseBuf) return;
    const t = Math.max(delay, ctx.currentTime);
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const fl = ctx.createBiquadFilter();
    fl.type = "bandpass";
    fl.frequency.setValueAtTime(freq, t);
    if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    fl.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(out);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  play(name: Sfx) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      switch (name) {
        case "ui": this.tn(660, 0.07, "square", 0.05); break;
        case "select": this.tn(520, 0.06, "triangle", 0.12); this.tn(780, 0.09, "triangle", 0.1, undefined, now + 0.05); break;
        case "tick": this.tn(300 + Math.random() * 120, 0.05, "square", 0.04); break;
        case "found":
          [660, 830, 990, 1320].forEach((f, i) => this.tn(f, 0.35, "sine", 0.14, undefined, now + i * 0.07));
          break;
        case "empty": this.tn(140, 0.15, "sine", 0.14, 90); break;
        case "deduce":
          [523, 659, 784, 1047, 1319].forEach((f, i) => this.tn(f, 0.4, "triangle", 0.14, undefined, now + i * 0.06));
          this.tn(131, 0.8, "sine", 0.18);
          break;
        case "coincidence": this.tn(400, 0.3, "sine", 0.1, 300); this.tn(405, 0.3, "sine", 0.1, 290); break;
        case "wrong": this.tn(180, 0.28, "sawtooth", 0.1, 90); this.nz(0.15, 0.08, 400); break;
        case "hurt": this.nz(0.28, 0.25, 900, 0, 0.8, null, 200); this.tn(120, 0.25, "sawtooth", 0.14, 50); break;
        case "pulse": this.tn(220, 0.5, "sine", 0.22, 880); this.nz(0.45, 0.1, 1500, 0, 2, null, 5000); break;
        case "dash": this.nz(0.18, 0.12, 2500, 0, 1, null, 600); break;
        case "tell": this.tn(1500, 0.09, "sine", 0.1); this.tn(1100, 0.12, "sine", 0.08, undefined, now + 0.09); break;
        case "press": this.tn(110, 0.2, "sine", 0.22, 70); this.nz(0.08, 0.1, 700); break;
        case "break":
          this.nz(0.5, 0.25, 4000, 0, 1.5, null, 800);
          [392, 523, 659, 784].forEach((f, i) => this.tn(f, 0.6, "triangle", 0.14, undefined, now + 0.05 + i * 0.05));
          break;
        case "accuse": this.tn(90, 0.5, "sine", 0.35, 45); this.nz(0.2, 0.3, 500); break;
        case "win":
          [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tn(f, 0.5, "triangle", 0.16, undefined, now + i * 0.13));
          break;
        case "lose":
          [392, 349, 311, 233].forEach((f, i) => this.tn(f, 0.7, "sawtooth", 0.1, f * 0.97, now + i * 0.25));
          break;
        case "door": this.tn(180, 0.2, "triangle", 0.12, 360); break;
        case "dawn": [880, 660, 880, 440].forEach((f, i) => this.tn(f, 0.8, "sine", 0.16, undefined, now + i * 0.3)); break;
        case "boss": this.tn(55, 1.4, "sawtooth", 0.2, 40); this.nz(1, 0.15, 200, 0, 0.7); break;
        case "bossdown": this.nz(1.2, 0.3, 3000, 0, 1, null, 100); [262, 330, 392, 523].forEach((f, i) => this.tn(f, 0.8, "triangle", 0.15, undefined, now + 0.3 + i * 0.1)); break;
        case "heal": this.tn(440, 0.3, "sine", 0.12, 880); break;
      }
    } catch {
      /* audio failures never break the game */
    }
  }
}

export const audio = new AudioEngine();
