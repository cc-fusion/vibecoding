type Wave = OscillatorType;
interface Vol { master: number; sfx: number; music: number; muted: boolean }

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioSys {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxG!: GainNode;
  musG!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  vol: Vol = { master: 0.8, sfx: 0.8, music: 0.5, muted: false };
  last: Record<string, number> = {};
  // music
  musicOn = false;
  timer: number | null = null;
  nextT = 0;
  step = 0;
  bar = 0;
  intensity = 0.2;
  targetIntensity = 0.2;
  mood = 0; // 0 calm, 1 boss
  songPad: { stop: () => void }[] = [];

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const c = this.ctx;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    this.master = c.createGain();
    this.sfxG = c.createGain();
    this.musG = c.createGain();
    this.sfxG.connect(this.master);
    this.musG.connect(this.master);
    this.master.connect(comp);
    comp.connect(c.destination);
    const len = c.sampleRate;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVol();
  }

  setVol(v: Partial<Vol>) {
    Object.assign(this.vol, v);
    this.applyVol();
  }

  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master * 0.9, t, 0.03);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musG.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.03);
  }

  tone(freq: number, dur: number, type: Wave = "sine", vol = 0.2, slideTo?: number, when = 0, dest?: AudioNode, attack = 0.005) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, vol = 0.2, f0 = 2000, f1?: number, type: BiquadFilterType = "lowpass", when = 0, dest?: AudioNode) {
    if (!this.ctx || !this.noiseBuf) return;
    const c = this.ctx;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  sfx(name: string, p = 0) {
    if (!this.ctx || this.vol.muted) return;
    const now = performance.now();
    const gap: Record<string, number> = { shoot: 90, hit: 35, graze: 45, kill: 30, bullet: 60, mote: 40 };
    if (gap[name] && now - (this.last[name] || 0) < gap[name]) return;
    this.last[name] = now;
    switch (name) {
      case "shoot": this.tone(780 + Math.random() * 60, 0.05, "square", 0.015, 420); break;
      case "hit": this.tone(220 + Math.random() * 80, 0.05, "triangle", 0.05, 120); break;
      case "kill": this.noise(0.18, 0.12, 3000, 300); this.tone(300, 0.14, "sawtooth", 0.06, 80); break;
      case "bigkill": this.noise(0.6, 0.3, 4000, 120); this.tone(160, 0.6, "sawtooth", 0.15, 40); this.tone(880, 0.5, "sine", 0.08, 220, 0.02); break;
      case "graze": this.tone(1500 + p * 90, 0.06, "sine", 0.05, 2300 + p * 90); break;
      case "mote": this.tone(1000 + Math.random() * 400, 0.07, "sine", 0.03, 1600); break;
      case "hurt": this.noise(0.5, 0.35, 1800, 90); this.tone(120, 0.5, "sawtooth", 0.2, 40); break;
      case "deny": this.tone(140, 0.12, "square", 0.08, 90); break;
      case "draw": this.tone(900, 0.06, "triangle", 0.05, 1300); break;
      case "shuffle": this.noise(0.25, 0.08, 6000, 1500, "highpass"); break;
      case "pop": this.tone(660, 0.3, "triangle", 0.18, 1320); this.noise(0.3, 0.1, 6000, 800, "bandpass"); break;
      case "boom": this.noise(0.9, 0.38, 3500, 60); this.tone(110, 0.8, "sine", 0.3, 30); break;
      case "boss_phase": this.tone(110, 1.8, "sine", 0.28, 100); this.tone(220, 1.6, "triangle", 0.12, 200, 0.02); this.tone(329.6, 1.4, "sine", 0.08, 320, 0.05); this.noise(0.5, 0.15, 800, 100); break;
      case "bell": this.tone(523, 1.2, "sine", 0.1); this.tone(1046 * 1.5, 0.8, "sine", 0.04); break;
      case "beam_warn": this.tone(440, 0.3, "sine", 0.04, 660); break;
      case "beam": this.noise(0.5, 0.12, 5000, 400, "bandpass"); this.tone(90, 0.5, "sawtooth", 0.08, 70); break;
      case "ui": this.tone(660, 0.07, "triangle", 0.08, 880); break;
      case "ui2": this.tone(440, 0.09, "triangle", 0.08, 330); break;
      case "buy": this.tone(660, 0.1, "triangle", 0.1); this.tone(990, 0.2, "sine", 0.1, undefined, 0.07); break;
      case "card_hymn": this.chord([74, 81, 86], 0.5, "triangle", 0.07); this.tone(1200, 0.2, "sine", 0.05, 2000); break;
      case "card_gloss": this.tone(784, 0.3, "sine", 0.1, 1175); this.tone(1175, 0.3, "sine", 0.05, undefined, 0.06); break;
      case "card_ward": this.chord([67, 74, 79], 0.6, "sine", 0.09); this.noise(0.3, 0.05, 3000, 6000, "bandpass"); break;
      case "card_wrath": this.noise(0.7, 0.3, 5000, 100); this.tone(80, 0.7, "sawtooth", 0.2, 30); this.tone(500, 0.4, "square", 0.05, 100); break;
      case "card_vow": this.tone(523, 0.18, "sine", 0.1); this.tone(659, 0.18, "sine", 0.1, undefined, 0.07); this.tone(784, 0.3, "sine", 0.1, undefined, 0.14); break;
      case "trinity": this.chord([74, 78, 81, 86], 1.0, "triangle", 0.1); this.tone(1760, 0.8, "sine", 0.05); break;
      case "victory": [62, 66, 69, 74, 78, 81, 86].forEach((m, i) => this.tone(mtof(m), 0.9, "triangle", 0.12, undefined, i * 0.12)); this.chord([50, 57, 62, 66], 2.5, "sine", 0.1, 0.9); break;
      case "defeat": [62, 61, 58, 55, 50].forEach((m, i) => this.tone(mtof(m), 1.0, "sawtooth", 0.09, mtof(m) * 0.97, i * 0.3)); this.noise(2, 0.15, 900, 60, "lowpass", 0.5); break;
      case "relic": this.chord([71, 76, 83], 1.2, "sine", 0.12); this.tone(1900, 0.7, "sine", 0.05); break;
      case "warn": this.tone(220, 0.25, "square", 0.05, 220); this.tone(220, 0.25, "square", 0.05, 220, 0.3); break;
    }
  }

  chord(midis: number[], dur: number, type: Wave, vol: number, when = 0) {
    midis.forEach((m, i) => this.tone(mtof(m), dur, type, vol, undefined, when + i * 0.02));
  }

  // ---------- MUSIC ----------
  startMusic(mood = 0) {
    this.init();
    if (!this.ctx) return;
    this.mood = mood;
    if (this.musicOn) return;
    this.applyVol();
    this.musicOn = true;
    this.nextT = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.bar = 0;
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (this.ctx && this.musG) {
      // quick fade so cut-offs are not abrupt, then restore
      const t = this.ctx.currentTime;
      this.musG.gain.cancelScheduledValues(t);
      this.musG.gain.setTargetAtTime(0, t, 0.08);
      window.setTimeout(() => this.applyVol(), 600);
    }
  }

  setIntensity(v: number, mood?: number) {
    this.targetIntensity = Math.max(0, Math.min(1, v));
    if (mood !== undefined) this.mood = mood;
  }

  schedule() {
    if (!this.ctx || !this.musicOn) return;
    if (this.ctx.state === "suspended") return;
    if (this.nextT < this.ctx.currentTime - 0.3) this.nextT = this.ctx.currentTime + 0.05;
    this.intensity += (this.targetIntensity - this.intensity) * 0.08;
    while (this.nextT < this.ctx.currentTime + 0.2) {
      this.playStep(this.nextT, this.step);
      const bpm = 64 + this.intensity * 40 + this.mood * 8;
      this.nextT += 60 / bpm / 4;
      this.step++;
      if (this.step % 16 === 0) this.bar++;
    }
  }

  playStep(t: number, step: number) {
    const c = this.ctx!;
    const s = step % 16;
    const bar = this.bar % 8;
    // D phrygian-ish progression
    const roots = [38, 38, 34, 34, 36, 36, 33, 31];
    const minor = [true, true, false, false, false, false, true, false];
    const root = roots[bar];
    const tri = minor[bar] ? [0, 3, 7, 10] : [0, 4, 7, 11];
    const when = t - c.currentTime;
    const I = this.intensity;
    const boss = this.mood > 0.5;

    if (s === 0) {
      // pad
      const barLen = (60 / (64 + I * 40 + this.mood * 8)) * 4;
      tri.slice(0, 3).forEach((iv, i) => {
        for (const det of [-6, 6]) {
          const o = c.createOscillator();
          const g = c.createGain();
          const f = c.createBiquadFilter();
          o.type = i === 0 ? "sawtooth" : "triangle";
          o.frequency.value = mtof(root + 24 + iv);
          o.detune.value = det;
          f.type = "lowpass";
          f.frequency.setValueAtTime(500, t);
          f.frequency.linearRampToValueAtTime(900 + I * 1400, t + barLen * 0.6);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.045, t + barLen * 0.35);
          g.gain.linearRampToValueAtTime(0.0001, t + barLen * 1.05);
          o.connect(f); f.connect(g); g.connect(this.musG);
          o.start(t); o.stop(t + barLen * 1.1);
        }
      });
      // sub bass drone
      this.tone(mtof(root), barLen * 1.0, "sine", 0.22, undefined, when, this.musG, 0.1);
      if (Math.random() < 0.5 + I * 0.3) this.tone(mtof(root + 36 + tri[Math.floor(Math.random() * 3)]), 1.8, "sine", 0.05, undefined, when + 0.02, this.musG, 0.01);
    }
    // arpeggio
    const arpChance = 0.15 + I * 0.6;
    if (s % 2 === 0 && Math.random() < arpChance) {
      const iv = tri[Math.floor(Math.random() * tri.length)] + 12 * (2 + Math.floor(Math.random() * 3));
      this.tone(mtof(root + iv), 0.35, "triangle", 0.05 + I * 0.03, undefined, when, this.musG);
    }
    // bass pulse
    if ((s === 0 || s === 8 || (boss && (s === 6 || s === 14))) && I > 0.25) {
      this.tone(mtof(root + 12), 0.25, "sawtooth", 0.06, mtof(root + 12) * 0.9, when, this.musG);
    }
    // percussion
    if (I > 0.3 && s % 4 === 0) {
      this.tone(120, 0.18, "sine", 0.28, 40, when, this.musG);
    }
    if (I > 0.5 && (s === 4 || s === 12)) {
      this.noise(0.15, 0.1, 2500, 800, "bandpass", when, this.musG);
    }
    if (I > 0.65 && s % 2 === 1) {
      this.noise(0.04, 0.04, 9000, undefined, "highpass", when, this.musG);
    }
    if (boss && s === 0 && bar % 2 === 0) {
      // tolling bell
      this.tone(mtof(root + 36), 2.2, "sine", 0.07, undefined, when, this.musG);
      this.tone(mtof(root + 36) * 2.76, 1.2, "sine", 0.025, undefined, when, this.musG);
    }
  }
}

export const audio = new AudioSys();
