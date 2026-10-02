export type MusicMode = "off" | "menu" | "port" | "sortie" | "boss";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const PROG: Record<Exclude<MusicMode, "off">, number[][]> = {
  menu: [[50, 53, 57, 60], [46, 50, 53, 57], [53, 57, 60, 64], [48, 55, 60, 64]],
  sortie: [[50, 53, 57, 60], [46, 50, 53, 57], [53, 57, 60, 64], [55, 58, 62, 65]],
  port: [[43, 50, 54, 59], [40, 47, 52, 55], [48, 52, 55, 59], [50, 54, 57, 59]],
  boss: [[50, 53, 57], [46, 50, 53], [55, 58, 62], [45, 49, 52, 57]],
};

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicBus!: GainNode; sfxBus!: GainNode;
  noiseBuf!: AudioBuffer;
  vol = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  mode: MusicMode = "off";
  intensity = 0;
  private step = 0;
  private nextT = 0;
  private timer: number | null = null;
  private engOsc: OscillatorNode | null = null;
  private engGain: GainNode | null = null;
  private engFilter: BiquadFilterNode | null = null;
  private windSrc: AudioBufferSourceNode | null = null;
  private windGain: GainNode | null = null;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
      this.master.connect(comp); comp.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      this.nextT = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.tick(), 100);
    } catch { this.ctx = null; }
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) { this.vol = { ...v }; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  setMode(m: MusicMode) { if (m !== this.mode) { this.mode = m; this.step = 0; } }
  setIntensity(i: number) { this.intensity = Math.max(0, Math.min(1, i)); }

  // ---- primitives ----
  private tone(f: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, bus?: GainNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1: number, delay = 0, bus?: GainNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = ftype;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  sfx(name: string, a = 0) {
    if (!this.ctx || this.vol.muted) return;
    const now = this.ctx.currentTime;
    const gap: Record<string, number> = { reel: 0.07, charge: 0.05, cannon: 0.05, hit: 0.03, coin: 0.03, pickup: 0.04, tick: 0.05 };
    if (gap[name] && now - (this.lastSfx[name] || 0) < gap[name]) return;
    this.lastSfx[name] = now;
    switch (name) {
      case "click": this.tone(660, 0.06, "square", 0.08, 880); break;
      case "back": this.tone(440, 0.08, "square", 0.07, 300); break;
      case "buy": this.tone(520, 0.08, "triangle", 0.15); this.tone(780, 0.12, "triangle", 0.15, 0, 0.07); break;
      case "deny": this.tone(160, 0.18, "sawtooth", 0.1, 110); break;
      case "coin": this.tone(1200 + a * 80, 0.12, "triangle", 0.12); this.tone(1800 + a * 80, 0.18, "sine", 0.1, 0, 0.05); break;
      case "pickup": this.tone(500 + a * 60, 0.1, "sine", 0.14, 900); break;
      case "fire": this.noise(0.28, 0.35, "bandpass", 3000, 400); this.tone(160 + a * 80, 0.2, "sawtooth", 0.1, 60); break;
      case "charge": this.tone(180 + a * 600, 0.07, "sine", 0.05); break;
      case "hit": this.tone(120, 0.18, "square", 0.25, 50); this.noise(0.15, 0.3, "lowpass", 2000, 200); break;
      case "bullseye": this.tone(900, 0.2, "triangle", 0.2, 1500); this.tone(1350, 0.25, "triangle", 0.15, 2000, 0.08); break;
      case "hook": this.tone(300, 0.25, "square", 0.12, 150); this.noise(0.1, 0.2, "highpass", 4000, 2000); break;
      case "snap": this.tone(900, 0.3, "sawtooth", 0.2, 120); this.noise(0.25, 0.3, "highpass", 6000, 800); break;
      case "reel": this.tone(240 + a * 140, 0.03, "square", 0.04); break;
      case "cannon": this.noise(0.2, 0.28, "lowpass", 1800, 200); this.tone(110, 0.15, "sine", 0.2, 45); break;
      case "boom": this.noise(0.8, 0.5, "lowpass", 1500, 60); this.tone(90, 0.6, "sine", 0.4, 30); break;
      case "hurt": this.noise(0.3, 0.4, "lowpass", 1200, 100); this.tone(100, 0.3, "sawtooth", 0.2, 50); break;
      case "zap": this.noise(0.25, 0.3, "bandpass", 5000, 800); this.tone(1400, 0.2, "sawtooth", 0.1, 200); break;
      case "thunder": this.noise(1.6, 0.55, "lowpass", 900, 50); this.tone(55, 1.2, "sine", 0.3, 28); break;
      case "warn": this.tone(440, 0.15, "square", 0.1); this.tone(330, 0.2, "square", 0.1, 0, 0.16); break;
      case "roar": this.tone(110, 1.1, "sawtooth", 0.22, 50); this.tone(165, 1.0, "square", 0.08, 70); this.noise(1, 0.15, "lowpass", 600, 80); break;
      case "whale": this.tone(220, 1.2, "sine", 0.1, 140); this.tone(330, 1.0, "sine", 0.05, 200, 0.1); break;
      case "kill": this.tone(220, 0.4, "sawtooth", 0.15, 80); this.tone(440, 0.3, "triangle", 0.12, 660, 0.1); this.noise(0.4, 0.2, "lowpass", 2500, 200); break;
      case "lance": this.tone(700, 0.1, "sawtooth", 0.08, 300); break;
      case "tick": this.tone(900, 0.03, "square", 0.04); break;
      case "win": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.16, 0, i * 0.14)); break;
      case "lose": [392, 330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.6, "sawtooth", 0.1, 0, i * 0.22)); break;
      case "bell": this.tone(880, 1.0, "sine", 0.12); this.tone(1320, 0.8, "sine", 0.06, 0, 0.02); break;
      case "gust": this.noise(1.2, 0.3, "bandpass", 400, 1500); break;
      case "launch": this.tone(200, 0.4, "sine", 0.15, 600); break;
    }
  }

  // ---- continuous layers ----
  startFlight() {
    const ctx = this.ctx; if (!ctx || this.engOsc) return;
    this.engOsc = ctx.createOscillator(); this.engOsc.type = "sawtooth"; this.engOsc.frequency.value = 55;
    this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = "lowpass"; this.engFilter.frequency.value = 260;
    this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter); this.engFilter.connect(this.engGain); this.engGain.connect(this.sfxBus);
    this.engOsc.start();
    this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = this.noiseBuf; this.windSrc.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 500; wf.Q.value = 0.6;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    this.windSrc.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.sfxBus);
    this.windSrc.start();
  }
  setFlight(throttle: number, wind: number) {
    if (!this.ctx || !this.engOsc || !this.engGain || !this.engFilter || !this.windGain) return;
    const t = this.ctx.currentTime;
    this.engOsc.frequency.setTargetAtTime(52 + throttle * 34, t, 0.12);
    this.engFilter.frequency.setTargetAtTime(220 + throttle * 380, t, 0.12);
    this.engGain.gain.setTargetAtTime(0.05 + throttle * 0.07, t, 0.1);
    this.windGain.gain.setTargetAtTime(Math.min(0.2, 0.015 + Math.abs(wind) / 1800), t, 0.2);
  }
  stopFlight() {
    try { this.engOsc?.stop(); this.windSrc?.stop(); } catch { /* already stopped */ }
    this.engOsc = null; this.engGain = null; this.engFilter = null; this.windSrc = null; this.windGain = null;
  }

  // ---- music scheduler ----
  private tick() {
    const ctx = this.ctx; if (!ctx) return;
    if (ctx.state === "suspended") return;
    if (this.mode === "off") { this.nextT = ctx.currentTime + 0.1; return; }
    const bpm = this.mode === "boss" ? 118 : this.mode === "sortie" ? 78 + this.intensity * 20 : 72;
    const stepDur = 60 / bpm / 2;
    while (this.nextT < ctx.currentTime + 0.35) {
      this.playStep(this.nextT - ctx.currentTime, stepDur);
      this.nextT += stepDur; this.step++;
    }
  }
  private playStep(delay: number, sd: number) {
    const mode = this.mode as Exclude<MusicMode, "off">;
    const prog = PROG[mode];
    const bar = Math.floor(this.step / 8);
    const s = this.step % 8;
    const chord = prog[bar % prog.length];
    const mb = this.musicBus;
    const inten = mode === "boss" ? 1 : mode === "sortie" ? this.intensity : 0;
    if (s === 0) {
      chord.forEach((n, i) => {
        const f = mtof(n + (i > 1 ? 0 : 0));
        this.tone(f, sd * 8 * 1.05, "triangle", 0.05 + 0.02 * (mode === "menu" ? 1 : 0), 0, delay, mb);
        this.tone(f * 1.003, sd * 8 * 1.05, "sine", 0.04, 0, delay, mb);
      });
    }
    if (mode === "boss" || (mode === "sortie" && inten > 0.2)) {
      if (s === 0 || s === 4 || (mode === "boss" && s === 6)) this.tone(mtof(chord[0] - 12), sd * 1.6, "sine", 0.2, 0, delay, mb);
    }
    if (mode === "sortie" && inten <= 0.2 && s === 0) this.tone(mtof(chord[0] - 12), sd * 3, "sine", 0.12, 0, delay, mb);
    // arpeggio
    const density = mode === "menu" ? 0.35 : mode === "port" ? 0.55 : mode === "boss" ? 0.85 : 0.4 + inten * 0.4;
    if (Math.random() < density) {
      const idx = mode === "port" ? [0, 1, 2, 3, 2, 1, 3, 2][s] : Math.floor(Math.random() * chord.length);
      const note = chord[idx % chord.length] + (mode === "boss" ? 24 : 12 + (Math.random() < 0.3 ? 12 : 0));
      this.tone(mtof(note), sd * 2.2, mode === "port" ? "triangle" : "sine", mode === "boss" ? 0.07 : 0.08, 0, delay, mb);
    }
    if (mode === "boss" || (mode === "sortie" && inten > 0.55)) {
      if (s === 0 || s === 4) { this.tone(130, 0.18, "sine", 0.3, 40, delay, mb); }
      if (s % 2 === 1) this.noise(0.05, 0.05, "highpass", 7000, 6000, delay, mb);
      if (mode === "boss" && (s === 2 || s === 6)) this.noise(0.12, 0.12, "bandpass", 1800, 900, delay, mb);
    }
  }

  destroy() {
    if (this.timer) clearInterval(this.timer);
    this.stopFlight();
  }
}

export const audio = new AudioEngine();
