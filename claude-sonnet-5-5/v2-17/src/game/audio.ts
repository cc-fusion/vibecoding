// Fully synthesized audio: SFX + adaptive procedural music (Web Audio API)
import type { Settings } from "./save";

export type Mood = "none" | "hub" | "combat" | "boss" | "victory" | "defeat";

const ROOTS = [73.42, 65.41, 82.41, 87.31, 55];
const SCALES = [
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 8, 10],
  [0, 2, 3, 5, 7, 9, 10],
  [0, 2, 4, 5, 7, 9, 10],
  [0, 1, 3, 5, 7, 8, 10],
];
const hz = (root: number, semis: number) => root * Math.pow(2, semis / 12);

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  settings: Settings = { master: 0.8, music: 0.6, sfx: 0.8, muted: false, shake: true, numbers: true };
  mood: Mood = "none";
  realm = 0;
  step = 0;
  nextTime = 0;
  timer: number | null = null;
  walk = 4;
  dim = false;
  lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      const comp = this.ctx.createDynamicsCompressor();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applySettings(this.settings);
      this.startTimer();
      document.addEventListener("visibilitychange", () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend().catch(() => {});
        else this.ctx.resume().catch(() => {});
      });
    } catch {
      this.ctx = null;
    }
  }

  applySettings(s: Settings) {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.03);
    this.musicGain.gain.setTargetAtTime(s.music * 0.55 * (this.dim ? 0.35 : 1), t, 0.1);
    this.sfxGain.gain.setTargetAtTime(s.sfx * 0.9, t, 0.03);
  }

  setDim(v: boolean) {
    this.dim = v;
    this.applySettings(this.settings);
  }

  setMood(mood: Mood, realm = this.realm) {
    this.mood = mood;
    this.realm = realm;
    if (mood === "victory") this.fanfare(true);
    if (mood === "defeat") this.fanfare(false);
  }

  private startTimer() {
    if (this.timer != null) return;
    this.timer = window.setInterval(() => this.tick(), 40);
  }

  private tick() {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;
    const bpm = this.mood === "boss" ? 134 : this.mood === "combat" ? 108 : 70;
    const dur = 60 / bpm / 4;
    while (this.nextTime < c.currentTime + 0.15) {
      this.scheduleStep(this.step, this.nextTime, dur);
      this.nextTime += dur;
      this.step++;
    }
  }

  private scheduleStep(step: number, t: number, dur: number) {
    const mood = this.mood;
    if (mood === "none" || mood === "victory" || mood === "defeat") return;
    const root = ROOTS[this.realm % ROOTS.length];
    const scale = SCALES[this.realm % SCALES.length];
    const deg = (i: number) => {
      const o = Math.floor(i / 7);
      return scale[((i % 7) + 7) % 7] + o * 12;
    };
    const s16 = step % 32;
    if (s16 === 0) {
      [0, 2, 4].forEach((d, i) => this.voice(hz(root, deg(d) + 12), t, dur * 32, "sawtooth", 0.05 / (1 + i * 0.2), 500 + (mood === "boss" ? 600 : 0), 1.6));
    }
    if (step % 8 === 0) {
      const bassDeg = [0, 0, 3, 4, 0, 5, 3, 4][Math.floor(step / 8) % 8];
      this.voice(hz(root, deg(bassDeg)), t, dur * 7, mood === "hub" ? "sine" : "sawtooth", mood === "hub" ? 0.22 : 0.14, 380, 0.05);
    }
    if (mood === "boss" && step % 4 === 2) this.voice(hz(root, deg(0) + 12), t, dur * 1.5, "square", 0.04, 700, 0.01);
    const arpEvery = mood === "hub" ? 4 : mood === "combat" ? 2 : 1;
    if (step % arpEvery === 0 && Math.random() < (mood === "hub" ? 0.7 : 0.85)) {
      this.walk = Math.max(0, Math.min(12, this.walk + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.3 ? 2 : 1)));
      const f = hz(root * 2, deg(this.walk));
      this.voice(f, t, dur * (mood === "hub" ? 3 : 1.4), mood === "hub" ? "triangle" : "square", mood === "hub" ? 0.07 : mood === "boss" ? 0.045 : 0.03, 2400, 0.002);
    }
    if (mood !== "hub") {
      if (step % 4 === 0) this.kick(t, mood === "boss" ? 0.5 : 0.38);
      if (step % 2 === 1) this.noise(0.04, 0.05, "highpass", 7000, 7000, t);
      if (step % 8 === 4) this.noise(0.14, mood === "boss" ? 0.2 : 0.1, "bandpass", 1800, 1200, t);
    }
  }

  private voice(freq: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, attack: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = type;
    o2.type = type;
    o.frequency.value = freq;
    o2.frequency.value = freq * 1.004;
    f.type = "lowpass";
    f.frequency.value = cutoff;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.max(0.005, Math.min(attack, dur * 0.5)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.musicGain);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  private kick(t: number, vol: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.22);
  }

  private noise(dur: number, vol: number, ft: BiquadFilterType, f0: number, f1: number, t: number, dest?: AudioNode) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    const g = c.createGain();
    f.type = ft;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    s.connect(f); f.connect(g); g.connect(dest ?? this.musicGain);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo = 0, delay = 0) {
    const c = this.ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.03);
  }

  private sn(dur: number, vol: number, ft: BiquadFilterType, f0: number, f1: number, delay = 0) {
    this.noise(dur, vol, ft, f0, f1, this.ctx!.currentTime + delay, this.sfxGain);
  }

  private fanfare(win: boolean) {
    if (!this.ctx) return;
    const notes = win ? [0, 4, 7, 12, 16, 19, 24] : [7, 3, 0, -5];
    notes.forEach((n, i) => {
      const f = 261.63 * Math.pow(2, n / 12);
      this.tone(f, win ? 0.7 : 0.9, win ? "triangle" : "sawtooth", win ? 0.18 : 0.12, 0, i * (win ? 0.14 : 0.35));
      if (win) this.tone(f * 2, 0.6, "sine", 0.08, 0, i * 0.14);
    });
  }

  sfx(name: string, pitch = 1) {
    const c = this.ctx;
    if (!c || c.state !== "running") return;
    const now = c.currentTime;
    const minGap: Record<string, number> = { hit: 0.03, coin: 0.04, shoot: 0.05, swing: 0.05, tick: 0.05 };
    if (minGap[name] && now - (this.lastSfx[name] || 0) < minGap[name]) return;
    this.lastSfx[name] = now;
    const p = pitch;
    switch (name) {
      case "swing": this.sn(0.12, 0.2, "bandpass", 1800 * p, 500, 0); this.tone(220 * p, 0.08, "triangle", 0.06, 120); break;
      case "hit": this.sn(0.08, 0.28, "lowpass", 3000, 300); this.tone(160 * p, 0.09, "square", 0.12, 70); break;
      case "crit": this.sn(0.14, 0.34, "lowpass", 5000, 400); this.tone(520, 0.15, "square", 0.14, 140); this.tone(1040, 0.1, "triangle", 0.08, 700, 0.02); break;
      case "kill": this.tone(300 * p, 0.2, "sawtooth", 0.12, 60); this.sn(0.15, 0.2, "lowpass", 2500, 200); break;
      case "hurt": this.tone(180, 0.25, "sawtooth", 0.22, 50); this.sn(0.2, 0.3, "lowpass", 1800, 150); break;
      case "dash": this.sn(0.22, 0.22, "bandpass", 600, 3000); break;
      case "coin": this.tone(1200 * p, 0.08, "square", 0.05); this.tone(1800 * p, 0.12, "square", 0.05, 0, 0.05); break;
      case "heart": this.tone(520, 0.12, "sine", 0.14); this.tone(780, 0.2, "sine", 0.14, 0, 0.08); break;
      case "boon": [0, 4, 7, 12].forEach((n, i) => this.tone(440 * Math.pow(2, n / 12), 0.3, "triangle", 0.12, 0, i * 0.07)); break;
      case "relic": [0, 7, 12, 19, 24].forEach((n, i) => this.tone(330 * Math.pow(2, n / 12), 0.5, "sine", 0.14, 0, i * 0.1)); break;
      case "special": this.tone(80, 0.7, "sawtooth", 0.3, 400); this.sn(0.6, 0.4, "lowpass", 400, 4000); this.tone(60, 0.8, "sine", 0.4, 30); break;
      case "specialReady": this.tone(660, 0.12, "triangle", 0.12); this.tone(990, 0.2, "triangle", 0.12, 0, 0.1); break;
      case "ui": this.tone(700, 0.05, "square", 0.05); break;
      case "select": this.tone(520, 0.07, "triangle", 0.1); this.tone(780, 0.1, "triangle", 0.1, 0, 0.05); break;
      case "error": this.tone(140, 0.18, "square", 0.12, 100); break;
      case "bossroar": this.tone(70, 1.1, "sawtooth", 0.32, 35); this.tone(75, 1.1, "square", 0.18, 30); this.sn(1, 0.3, "lowpass", 900, 80); break;
      case "explode": this.sn(0.5, 0.5, "lowpass", 2400, 60); this.tone(90, 0.4, "sine", 0.4, 30); break;
      case "shoot": this.tone(500 * p, 0.1, "square", 0.05, 250); break;
      case "arrow": this.sn(0.1, 0.18, "bandpass", 2400, 900); this.tone(380, 0.08, "triangle", 0.08, 700); break;
      case "telegraph": this.tone(330, 0.15, "sine", 0.07, 440); break;
      case "potion": this.sn(0.25, 0.2, "bandpass", 500, 1500); this.tone(400, 0.3, "sine", 0.12, 800); break;
      case "door": this.tone(110, 0.3, "triangle", 0.2, 80); this.sn(0.3, 0.2, "lowpass", 800, 200); break;
      case "deflect": this.tone(1500, 0.1, "triangle", 0.12, 2400); this.sn(0.05, 0.15, "highpass", 4000, 4000); break;
      case "phase": this.tone(60, 1.2, "sawtooth", 0.3, 220); this.sn(1.1, 0.3, "bandpass", 300, 2500); break;
      case "marry": [0, 4, 7, 12, 7, 12, 16].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 0.4, "triangle", 0.12, 0, i * 0.12)); break;
      case "birth": [12, 16, 19].forEach((n, i) => this.tone(392 * Math.pow(2, n / 12), 0.4, "sine", 0.14, 0, i * 0.1)); break;
      case "build": this.tone(120, 0.1, "square", 0.15, 80); this.tone(150, 0.1, "square", 0.15, 90, 0.12); this.tone(800, 0.2, "triangle", 0.1, 0, 0.24); break;
      case "revive": [0, 7, 12, 19].forEach((n, i) => this.tone(220 * Math.pow(2, n / 12), 0.6, "sine", 0.2, 0, i * 0.12)); break;
      case "tick": this.tone(900, 0.03, "square", 0.03); break;
      default: break;
    }
  }

  destroy() {
    if (this.timer != null) clearInterval(this.timer);
    this.timer = null;
  }
}

export const audio = new AudioEngine();
