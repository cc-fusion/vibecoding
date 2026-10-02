type Mode = "off" | "menu" | "combat";

interface ToneOpts { f0: number; f1?: number; dur: number; type?: OscillatorType; vol?: number; delay?: number; att?: number; dest?: AudioNode }
interface NoiseOpts { dur: number; f0: number; f1?: number; vol?: number; type?: BiquadFilterType; q?: number; delay?: number }

/** MIDI note number to frequency. */
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musBus: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.7, music: 0.55, sfx: 0.8, muted: false };
  last: Record<string, number> = {};
  mode: Mode = "off";
  intensity = 0;
  target = 0;
  boss = false;
  timer: number | null = null;
  nextT = 0;
  step = 0;

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        this.master = this.ctx.createGain();
        this.sfxBus = this.ctx.createGain();
        this.musBus = this.ctx.createGain();
        this.sfxBus.connect(this.master);
        this.musBus.connect(this.master);
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.5;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVol();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      if (this.mode !== "off" && this.timer === null) this.startLoop();
    } catch {
      /* audio unavailable */
    }
  }

  setVolumes(v: Partial<{ master: number; music: number; sfx: number; muted: boolean }>) {
    this.vol = { ...this.vol, ...v };
    this.applyVol();
  }
  private applyVol() {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musBus.gain.setTargetAtTime(this.vol.music * 0.6, t, 0.03);
  }

  private tone(o: ToneOpts) {
    const c = this.ctx;
    if (!c || !this.sfxBus) return;
    const t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t0 + o.dur);
    const v = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(v, t0 + (o.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    osc.connect(g);
    g.connect(o.dest || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.05);
  }
  private noise(o: NoiseOpts, dest?: AudioNode) {
    const c = this.ctx;
    if (!c || !this.noiseBuf || !this.sfxBus) return;
    const t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.type || "lowpass";
    f.Q.value = o.q || 0.7;
    f.frequency.setValueAtTime(o.f0, t0);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t0 + o.dur);
    const g = c.createGain();
    g.gain.setValueAtTime(o.vol ?? 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxBus);
    src.start(t0, Math.random());
    src.stop(t0 + o.dur + 0.05);
  }

  sfx(name: string, v = 1) {
    if (!this.ctx || this.vol.muted) return;
    const now = performance.now();
    const gap = name === "pulse" || name === "turret" || name === "hit" ? 40 : 25;
    if (now - (this.last[name] || 0) < gap) return;
    this.last[name] = now;
    const r = 0.92 + Math.random() * 0.16;
    switch (name) {
      case "pulse": this.tone({ f0: 900 * r, f1: 260, dur: 0.11, type: "square", vol: 0.05 * v }); break;
      case "turret": this.tone({ f0: 1400 * r, f1: 700, dur: 0.05, type: "triangle", vol: 0.04 * v }); break;
      case "rail": this.tone({ f0: 2400, f1: 80, dur: 0.35, type: "sawtooth", vol: 0.12 * v }); this.noise({ dur: 0.25, f0: 6000, f1: 300, vol: 0.2 * v, type: "bandpass" }); break;
      case "missile": this.noise({ dur: 0.4, f0: 800, f1: 3000, vol: 0.12 * v, type: "bandpass", q: 2 }); this.tone({ f0: 200, f1: 600, dur: 0.3, type: "sawtooth", vol: 0.05 * v }); break;
      case "hit": this.tone({ f0: 180 * r, f1: 60, dur: 0.14, type: "square", vol: 0.1 * v }); this.noise({ dur: 0.1, f0: 3000, f1: 500, vol: 0.12 * v }); break;
      case "enemyHit": this.tone({ f0: 500 * r, f1: 300, dur: 0.05, type: "triangle", vol: 0.035 * v }); break;
      case "shield": this.tone({ f0: 700 * r, f1: 1500, dur: 0.18, type: "sine", vol: 0.1 * v }); this.tone({ f0: 350, f1: 900, dur: 0.2, type: "triangle", vol: 0.05 * v }); break;
      case "boom": this.noise({ dur: 0.5, f0: 1800, f1: 80, vol: 0.35 * v }); this.tone({ f0: 120, f1: 30, dur: 0.4, type: "sine", vol: 0.25 * v }); break;
      case "bigboom": this.noise({ dur: 1.4, f0: 2200, f1: 40, vol: 0.5 * v }); this.tone({ f0: 90, f1: 20, dur: 1.1, type: "sine", vol: 0.4 * v }); this.tone({ f0: 300, f1: 40, dur: 0.8, type: "sawtooth", vol: 0.1 * v }); break;
      case "pickup": this.tone({ f0: 660, dur: 0.08, type: "sine", vol: 0.08 * v }); this.tone({ f0: 990, dur: 0.12, type: "sine", vol: 0.08 * v, delay: 0.06 }); break;
      case "ui": this.tone({ f0: 520, f1: 620, dur: 0.06, type: "triangle", vol: 0.08 * v }); break;
      case "place": this.tone({ f0: 300, f1: 500, dur: 0.07, type: "square", vol: 0.06 * v }); this.noise({ dur: 0.05, f0: 4000, vol: 0.06 * v, type: "highpass" }); break;
      case "remove": this.tone({ f0: 400, f1: 150, dur: 0.1, type: "square", vol: 0.06 * v }); break;
      case "error": this.tone({ f0: 160, dur: 0.15, type: "sawtooth", vol: 0.1 * v }); this.tone({ f0: 130, dur: 0.18, type: "sawtooth", vol: 0.1 * v, delay: 0.1 }); break;
      case "warn": this.tone({ f0: 880, dur: 0.12, type: "square", vol: 0.07 * v }); this.tone({ f0: 880, dur: 0.12, type: "square", vol: 0.07 * v, delay: 0.2 }); break;
      case "overheat": this.noise({ dur: 0.8, f0: 5000, f1: 800, vol: 0.2 * v, type: "bandpass" }); this.tone({ f0: 220, f1: 110, dur: 0.6, type: "sawtooth", vol: 0.1 * v }); break;
      case "vent": this.noise({ dur: 1.0, f0: 7000, f1: 1000, vol: 0.28 * v, type: "highpass" }); break;
      case "charge": this.tone({ f0: 100, f1: 1200, dur: 1.0, type: "sawtooth", vol: 0.06 * v, att: 0.5 }); break;
      case "beam": this.tone({ f0: 1800, f1: 90, dur: 0.5, type: "sawtooth", vol: 0.13 * v }); this.noise({ dur: 0.4, f0: 5000, f1: 400, vol: 0.2 * v, type: "bandpass" }); break;
      case "wave": [220, 330, 440].forEach((f, i) => this.tone({ f0: f, dur: 0.3, type: "triangle", vol: 0.1 * v, delay: i * 0.1 })); break;
      case "spawn": this.tone({ f0: 100, f1: 700, dur: 0.4, type: "sine", vol: 0.05 * v }); break;
      case "victory": [392, 494, 587, 784, 988].forEach((f, i) => this.tone({ f0: f, dur: 0.5, type: "triangle", vol: 0.12 * v, delay: i * 0.13, att: 0.02 })); break;
      case "defeat": [330, 262, 196, 131].forEach((f, i) => this.tone({ f0: f, f1: f * 0.9, dur: 0.7, type: "sawtooth", vol: 0.08 * v, delay: i * 0.25 })); break;
      case "research": [523, 659, 784].forEach((f, i) => this.tone({ f0: f, dur: 0.25, type: "sine", vol: 0.1 * v, delay: i * 0.08 })); break;
      case "emp": this.tone({ f0: 1500, f1: 60, dur: 0.7, type: "square", vol: 0.1 * v }); this.noise({ dur: 0.6, f0: 8000, f1: 200, vol: 0.2 * v, type: "bandpass" }); break;
      default: break;
    }
  }

  /* ---------------- music ---------------- */
  startMusic(mode: Mode) {
    this.mode = mode;
    this.step = 0;
    if (mode === "off") { this.stopLoop(); return; }
    if (this.ctx && this.timer === null) this.startLoop();
  }
  stopMusic() { this.mode = "off"; this.stopLoop(); }
  setIntensity(v: number, boss = false) { this.target = Math.max(0, Math.min(1, v)); this.boss = boss; }
  private startLoop() {
    if (!this.ctx) return;
    this.nextT = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 80);
  }
  private stopLoop() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }
  private schedule() {
    const c = this.ctx;
    if (!c || this.mode === "off") return;
    this.intensity += (this.target - this.intensity) * 0.08;
    if (this.mode === "menu") this.intensity = 0.15;
    let guard = 0;
    while (this.nextT < c.currentTime + 0.3 && guard++ < 8) {
      this.playStep(this.step, this.nextT);
      const tempo = this.mode === "menu" ? 76 : 96 + this.intensity * 40 + (this.boss ? 12 : 0);
      this.nextT += 60 / tempo / 4;
      this.step++;
    }
    if (this.nextT < c.currentTime - 0.5) this.nextT = c.currentTime + 0.1;
  }
  private mtone(f: number, t0: number, dur: number, type: OscillatorType, vol: number, cutoff?: number) {
    const c = this.ctx;
    if (!c || !this.musBus) return;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let out: AudioNode = osc;
    if (cutoff) {
      const f2 = c.createBiquadFilter(); f2.type = "lowpass"; f2.frequency.value = cutoff;
      osc.connect(f2); out = f2;
    }
    out.connect(g); g.connect(this.musBus);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  private mnoise(t0: number, dur: number, f: number, vol: number, type: BiquadFilterType) {
    const c = this.ctx;
    if (!c || !this.noiseBuf || !this.musBus) return;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl); fl.connect(g); g.connect(this.musBus);
    src.start(t0, Math.random()); src.stop(t0 + dur + 0.05);
  }
  private playStep(step: number, t0: number) {
    const inten = this.intensity;
    const bar = Math.floor(step / 16) % 4;
    const s16 = step % 16;
    const prog = this.boss ? [0, 1, 0, -2] : [0, -4, 3, -2];
    const root = 45 + prog[bar]; // A2 base
    const minor = this.boss ? bar !== 3 : bar === 0;
    const chord = [0, minor ? 3 : 4, 7];
    const spb = 60 / (this.mode === "menu" ? 76 : 96 + inten * 40);
    if (s16 === 0) {
      for (const iv of chord) {
        this.mtone(midi(root + 12 + iv), t0, spb * 4, "sawtooth", 0.05, 600 + inten * 900);
        this.mtone(midi(root + 12 + iv) * 1.006, t0, spb * 4, "sawtooth", 0.04, 600 + inten * 900);
      }
    }
    if (this.mode === "menu") {
      if (s16 % 8 === 0) this.mtone(midi(root), t0, spb * 2, "sine", 0.18);
      if (s16 % 2 === 0 && Math.random() < 0.55) this.mtone(midi(root + 36 + chord[(s16 / 2 + bar) % 3 | 0]), t0, spb * 1.2, "triangle", 0.05);
      return;
    }
    // combat layers
    if (s16 % 4 === 0 || (inten > 0.4 && s16 % 2 === 0)) {
      this.mtone(midi(root - (s16 % 8 === 6 ? -12 : 0)), t0, spb * 0.45, "sawtooth", 0.09 + inten * 0.05, 300 + inten * 500);
    }
    if (inten > 0.15) {
      const note = chord[(s16 * 3 + bar) % 3] + (s16 % 4 === 3 ? 12 : 0);
      this.mtone(midi(root + 24 + note), t0, spb * 0.3, "triangle", 0.035 + inten * 0.05);
    }
    if (inten > 0.3 && s16 % 4 === 0) {
      this.mtone(160, t0, 0.18, "sine", 0.28 + inten * 0.1);
      this.mtone(60, t0, 0.2, "sine", 0.3);
    }
    if (inten > 0.5 && s16 % 8 === 4) this.mnoise(t0, 0.15, 1800, 0.12, "bandpass");
    if (inten > 0.65 && s16 % 2 === 1) this.mnoise(t0, 0.04, 8000, 0.04, "highpass");
    if (this.boss && s16 % 8 === 0) this.mtone(midi(root - 12), t0, spb * 3, "square", 0.05, 250);
  }
}

export const audio = new AudioEngine();
