import type { Settings } from "./save";

export type MusicMode = "off" | "menu" | "forge" | "battle" | "boss";
const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const SCALE = [0, 1, 3, 5, 7, 8, 10]; // phrygian: dark and ominous
const ROOTS = [0, 5, 3, 7];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  settings: Settings | null = null;
  mode: MusicMode = "off";
  intensity = 0;
  step = 0;
  nextT = 0;
  timer: number | null = null;
  last: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.apply();
      this.startTimer();
    } catch { this.ctx = null; }
  }

  configure(s: Settings) { this.settings = s; this.apply(); }
  apply() {
    if (!this.ctx || !this.settings) return;
    const s = this.settings, t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.mute ? 0 : s.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
  }
  suspend() { if (this.ctx && this.ctx.state === "running") void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === "suspended") { void this.ctx.resume(); } }

  setMode(m: MusicMode) { if (m !== this.mode) { this.mode = m; this.step = 0; if (this.ctx) this.nextT = this.ctx.currentTime + 0.1; } }
  setIntensity(i: number) { this.intensity = Math.max(0, Math.min(1, i)); }

  private startTimer() {
    if (this.timer != null) return;
    this.nextT = (this.ctx?.currentTime ?? 0) + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 90);
  }
  stopAll() { if (this.timer != null) { clearInterval(this.timer); this.timer = null; } }

  // ---------- primitives ----------
  private tone(f: number, t: number, dur: number, type: OscillatorType, vol: number, bus: GainNode, slideTo?: number, lp?: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) { const fl = this.ctx.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = lp; o.connect(fl); node = fl; }
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(t: number, dur: number, vol: number, freq: number, bus: GainNode, type: BiquadFilterType = "lowpass", sweep?: number) {
    if (!this.ctx || !this.noiseBuf) return;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain(), f = this.ctx.createBiquadFilter();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t);
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweep), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  // ---------- SFX ----------
  sfx(name: string, p = 1) {
    if (!this.ctx || !this.settings || this.settings.mute) return;
    const c = this.ctx, now = c.currentTime;
    const minGap: Record<string, number> = { hit: 0.04, crit: 0.06, poison: 0.2, miss: 0.1, death: 0.1, heal: 0.15, shield: 0.15 };
    const gap = minGap[name] ?? 0.015;
    if (now - (this.last[name] ?? -1) < gap) return;
    this.last[name] = now;
    const b = this.sfxBus, t = now + 0.005;
    const r = () => 0.92 + Math.random() * 0.16;
    switch (name) {
      case "click": this.tone(660 * p, t, 0.06, "square", 0.12, b, 880 * p); break;
      case "hover": this.tone(900, t, 0.03, "sine", 0.04, b); break;
      case "buy": this.tone(784, t, 0.08, "square", 0.14, b); this.tone(1175, t + 0.07, 0.16, "square", 0.14, b); break;
      case "sell": this.tone(700, t, 0.08, "triangle", 0.2, b, 300); this.noise(t, 0.08, 0.15, 3000, b, "highpass"); break;
      case "reroll": for (let i = 0; i < 4; i++) this.tone(400 + i * 120, t + i * 0.04, 0.05, "square", 0.08, b); this.noise(t, 0.2, 0.1, 1200, b, "bandpass", 4000); break;
      case "equip": this.tone(140, t, 0.12, "triangle", 0.35, b, 70); this.noise(t, 0.05, 0.2, 1500, b); break;
      case "error": this.tone(140, t, 0.18, "sawtooth", 0.14, b, 100, 600); break;
      case "upgrade": [0, 4, 7, 12].forEach((n, i) => this.tone(mtof(60 + n), t + i * 0.07, 0.25, "triangle", 0.2, b)); break;
      case "merge": [0, 4, 7, 12, 16, 19].forEach((n, i) => { this.tone(mtof(64 + n), t + i * 0.06, 0.4, "triangle", 0.2, b); this.tone(mtof(76 + n), t + i * 0.06, 0.3, "sine", 0.08, b); }); this.noise(t, 0.6, 0.15, 500, b, "highpass", 6000); break;
      case "hit": this.noise(t, 0.09, 0.35, 2500 * r(), b, "lowpass", 300); this.tone(130 * r() * p, t, 0.11, "triangle", 0.35, b, 55); break;
      case "crit": this.noise(t, 0.14, 0.45, 5000, b, "bandpass", 500); this.tone(220, t, 0.18, "sawtooth", 0.25, b, 70, 2000); this.tone(1400, t, 0.1, "square", 0.08, b, 600); break;
      case "miss": this.noise(t, 0.12, 0.12, 800, b, "bandpass", 3000); break;
      case "stun": this.tone(300, t, 0.1, "square", 0.2, b, 100); this.tone(500, t + 0.05, 0.08, "square", 0.12, b); break;
      case "poison": this.tone(300 * r(), t, 0.18, "sine", 0.12, b, 500); this.tone(380 * r(), t + 0.05, 0.14, "sine", 0.1, b, 250); break;
      case "heal": this.tone(520, t, 0.2, "sine", 0.1, b, 780); break;
      case "shield": this.tone(900, t, 0.25, "triangle", 0.1, b, 1400); this.tone(1350, t + 0.04, 0.25, "sine", 0.06, b); break;
      case "breath": this.noise(t, 0.5, 0.35, 600, b, "bandpass", 3000); this.tone(90, t, 0.5, "sawtooth", 0.2, b, 200, 500); break;
      case "death": this.tone(300, t, 0.5, "sawtooth", 0.25, b, 40, 1200); this.noise(t, 0.4, 0.25, 1800, b, "lowpass", 100); break;
      case "blast": this.noise(t, 0.8, 0.6, 1800, b, "lowpass", 60); this.tone(80, t, 0.7, "sine", 0.6, b, 25); break;
      case "warn": this.tone(220, t, 0.25, "sawtooth", 0.22, b, 220, 900); this.tone(233, t + 0.3, 0.25, "sawtooth", 0.22, b, 233, 900); break;
      case "boss": [0, 1, 0].forEach((n, i) => this.tone(mtof(34 + n), t + i * 0.35, 0.9, "sawtooth", 0.3, b, undefined, 500)); this.noise(t, 1.2, 0.3, 200, b, "lowpass", 2000); break;
      case "fight": this.tone(70, t, 0.3, "sine", 0.7, b, 35); this.noise(t, 0.2, 0.3, 900, b); this.tone(mtof(50), t + 0.08, 0.5, "sawtooth", 0.16, b, undefined, 700); break;
      case "win": [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => this.tone(mtof(60 + n), t + i * 0.11, 0.35, "square", 0.14, b, undefined, 3000)); break;
      case "lose": [7, 5, 3, 0].forEach((n, i) => this.tone(mtof(52 + n), t + i * 0.22, 0.5, "sawtooth", 0.2, b, undefined, 900)); break;
      case "victory": [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => { this.tone(mtof(60 + n), t + i * 0.14, 0.7, "triangle", 0.22, b); this.tone(mtof(72 + n), t + i * 0.14, 0.5, "square", 0.07, b); }); break;
      case "coin": this.tone(1318, t, 0.05, "square", 0.1, b); this.tone(1760, t + 0.05, 0.12, "square", 0.1, b); break;
      case "life": this.tone(200, t, 0.5, "sine", 0.6, b, 40); this.noise(t, 0.3, 0.3, 700, b); break;
      default: break;
    }
  }

  // ---------- music ----------
  private schedule() {
    if (!this.ctx || !this.settings || this.mode === "off" || this.ctx.state !== "running") return;
    const bpm = { menu: 72, forge: 86, battle: 124, boss: 140, off: 100 }[this.mode] + this.intensity * 10;
    const sixteenth = 60 / bpm / 4;
    if (this.nextT < this.ctx.currentTime - 0.5) this.nextT = this.ctx.currentTime + 0.05;
    while (this.nextT < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextT, sixteenth);
      this.nextT += sixteenth;
      this.step++;
    }
  }
  private playStep(s: number, t: number, sx: number) {
    const b = this.musicBus, mode = this.mode, it = this.intensity;
    const pos = s % 16, bar = Math.floor(s / 16);
    const root = 38 + ROOTS[bar % 4];
    const fight = mode === "battle" || mode === "boss";
    // pad
    if (pos === 0) {
      [0, 3, 7].forEach((n) => this.tone(mtof(root + 12 + n + (n === 3 && bar % 4 === 1 ? 0 : 0)), t, sx * 16, "triangle", fight ? 0.05 : 0.07, b, undefined, 900));
    }
    // bass
    if (fight) {
      if (pos % 2 === 0) this.tone(mtof(root - (pos % 8 === 6 ? 0 : 0)), t, sx * 1.8, "sawtooth", 0.11 + it * 0.04, b, undefined, 400 + it * 500);
    } else if (pos === 0 || pos === 8 || (mode === "forge" && pos === 11)) {
      this.tone(mtof(root), t, sx * 5, "sine", 0.2, b);
    }
    // arp
    const arpEvery = fight ? 2 : mode === "forge" ? 4 : 8;
    if (pos % arpEvery === 0 && (fight ? it > 0.15 || mode === "boss" : true)) {
      const idx = (pos / arpEvery + bar * 3 + (pos > 7 ? 2 : 0)) % SCALE.length;
      const oct = fight ? 24 : 36;
      this.tone(mtof(root + oct + SCALE[Math.floor(idx)]), t, sx * 2.5, fight ? "square" : "triangle", fight ? 0.04 + it * 0.03 : 0.045, b, undefined, 2600);
    }
    if (mode === "boss" && pos % 4 === 2) this.tone(mtof(root + 36 + SCALE[(bar + pos) % 7]), t, sx * 2, "sawtooth", 0.035, b, undefined, 3000);
    // drums
    if (fight) {
      if (pos % 4 === 0 || (mode === "boss" && pos === 10)) this.tone(110, t, 0.14, "sine", 0.5, b, 40);
      if (pos === 4 || pos === 12) this.noise(t, 0.12, 0.22, 1800, b, "bandpass");
      if (pos % 2 === 0 && it > 0.25) this.noise(t, 0.04, 0.07 + it * 0.05, 7000, b, "highpass");
    } else if (mode === "forge" && (pos === 0 || pos === 8)) {
      this.noise(t, 0.06, 0.05, 900, b, "bandpass"); // anvil-ish tick
      if (pos === 8) this.tone(mtof(root + 48), t, 0.4, "sine", 0.03, b);
    }
  }
}

export const audio = new AudioEngine(); // singleton shared by all screens
