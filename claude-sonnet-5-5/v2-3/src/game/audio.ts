type Vols = { master: number; music: number; sfx: number; muted: boolean };

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const PROG = [
  [57, 60, 64, 67],
  [53, 57, 60, 64],
  [48, 55, 60, 64],
  [52, 55, 59, 62],
];
const SCALE = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79];

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicBus!: GainNode;
  sfxBus!: GainNode;
  revSend!: GainNode;
  delayIn!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  vols: Vols = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  mood = { sanity: 100, night: false, combat: false, boss: false, unwrite: 0 };
  private timer: number | null = null;
  private nextBar = 0;
  private barIdx = 0;
  private musicOn = false;

  ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = ctx.createGain();
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.master);
      // reverb
      const len = Math.floor(ctx.sampleRate * 2.6);
      const imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = imp.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      const conv = ctx.createConvolver();
      conv.buffer = imp;
      this.revSend = ctx.createGain();
      this.revSend.gain.value = 0.55;
      this.revSend.connect(conv);
      const revOut = ctx.createGain();
      revOut.gain.value = 0.6;
      conv.connect(revOut);
      revOut.connect(this.master);
      // echo
      const dl = ctx.createDelay(1.5);
      dl.delayTime.value = 0.42;
      const fb = ctx.createGain();
      fb.gain.value = 0.38;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800;
      this.delayIn = ctx.createGain();
      this.delayIn.connect(dl);
      dl.connect(lp);
      lp.connect(fb);
      fb.connect(dl);
      lp.connect(this.musicBus);
      lp.connect(this.revSend);
      // noise
      const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      this.applyVolumes();
      return ctx;
    } catch {
      this.ctx = null;
      return null;
    }
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === "suspended") c.resume().catch(() => undefined);
  }

  setVolumes(v: Partial<Vols>) {
    this.vols = { ...this.vols, ...v };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vols.muted ? 0 : this.vols.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.9, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx, t, 0.03);
  }

  setMood(m: Partial<{ sanity: number; night: boolean; combat: boolean; boss: boolean; unwrite: number }>) {
    this.mood = { ...this.mood, ...m };
  }

  // ---------- primitives ----------
  private tone(freq: number, t0: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, o: { slide?: number; attack?: number; detune?: number; send?: AudioNode } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const a = o.attack ?? 0.008;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest);
    if (o.send) g.connect(o.send);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(t0: number, dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, dest: AudioNode, q = 1, attack = 0.005) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest);
    src.start(t0, Math.random());
    src.stop(t0 + dur + 0.05);
  }

  // ---------- SFX ----------
  sfx(name: string) {
    const ctx = this.ensure();
    if (!ctx || this.vols.muted) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    const t = ctx.currentTime + 0.005;
    const d = this.sfxBus;
    try {
      switch (name) {
        case "step":
          this.tone(130 + Math.random() * 30, t, 0.12, "sine", 0.35, d, { slide: 55 });
          this.noise(t, 0.06, 0.08, "lowpass", 900, 300, d);
          break;
        case "scribble":
          this.noise(t, 0.09, 0.16, "bandpass", 2400 + Math.random() * 1600, 3200, d, 4);
          this.tone(1800 + Math.random() * 600, t, 0.04, "triangle", 0.03, d);
          break;
        case "pin":
          this.tone(660, t, 0.18, "triangle", 0.25, d, { send: this.revSend });
          this.tone(990, t + 0.06, 0.25, "sine", 0.18, d, { send: this.revSend });
          break;
        case "unpin":
          this.tone(500, t, 0.12, "triangle", 0.2, d, { slide: 300 });
          break;
        case "discover":
          [0, 4, 7, 12].forEach((s, i) => this.tone(mtof(72 + s), t + i * 0.08, 0.7, "sine", 0.22, d, { send: this.revSend }));
          this.tone(mtof(84), t + 0.35, 0.9, "triangle", 0.1, d, { send: this.revSend });
          break;
        case "strike":
          this.noise(t, 0.14, 0.45, "highpass", 3200, 900, d, 0.8);
          this.tone(220, t, 0.15, "square", 0.18, d, { slide: 70 });
          break;
        case "hit":
          this.noise(t, 0.2, 0.5, "lowpass", 2000, 200, d);
          this.tone(150, t, 0.22, "sawtooth", 0.28, d, { slide: 45 });
          break;
        case "hurt":
          this.tone(300, t, 0.35, "sawtooth", 0.25, d, { slide: 80 });
          this.noise(t, 0.25, 0.3, "lowpass", 1500, 150, d);
          break;
        case "heal":
          [0, 4, 7].forEach((s, i) => this.tone(mtof(64 + s), t + i * 0.09, 0.5, "sine", 0.22, d, { send: this.revSend }));
          break;
        case "flare":
          this.tone(300, t, 0.6, "sawtooth", 0.2, d, { slide: 1800, attack: 0.05 });
          this.noise(t, 0.6, 0.25, "bandpass", 500, 5000, d, 2, 0.05);
          this.tone(mtof(88), t + 0.3, 0.6, "sine", 0.14, d, { send: this.revSend });
          break;
        case "whisper": {
          const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
          if (pan) {
            pan.pan.value = Math.random() * 2 - 1;
            pan.connect(d);
          }
          this.noise(t, 1.4, 0.2, "bandpass", 700 + Math.random() * 900, 1200 + Math.random() * 500, pan ?? d, 7, 0.5);
          this.noise(t + 0.2, 1.1, 0.12, "bandpass", 1500, 2400, pan ?? d, 9, 0.4);
          break;
        }
        case "night":
          [0, -3, -7].forEach((s, i) => this.tone(mtof(57 + s), t + i * 0.25, 1.5, "triangle", 0.18, d, { send: this.revSend, attack: 0.2 }));
          break;
        case "dawn":
          [0, 4, 7, 11].forEach((s, i) => this.tone(mtof(60 + s), t + i * 0.18, 1.6, "triangle", 0.16, d, { send: this.revSend, attack: 0.15 }));
          break;
        case "click":
          this.tone(520, t, 0.05, "square", 0.08, d);
          break;
        case "error":
          this.tone(140, t, 0.18, "square", 0.14, d, { slide: 100 });
          break;
        case "coin":
          this.tone(1318, t, 0.12, "square", 0.08, d);
          this.tone(1760, t + 0.07, 0.25, "square", 0.08, d, { send: this.revSend });
          break;
        case "relic":
          [0, 3, 7, 10, 14, 19].forEach((s, i) => this.tone(mtof(67 + s), t + i * 0.07, 1.1, "sine", 0.16, d, { send: this.revSend }));
          break;
        case "blot":
          this.noise(t, 1.1, 0.4, "lowpass", 400, 60, d, 1, 0.1);
          this.tone(55, t, 1, "sawtooth", 0.18, d, { slide: 38 });
          break;
        case "parley":
          [0, 5, 9].forEach((s, i) => this.tone(mtof(62 + s), t + i * 0.1, 0.5, "triangle", 0.16, d, { send: this.revSend }));
          break;
        case "flee":
          this.noise(t, 0.5, 0.25, "bandpass", 3000, 400, d, 1.5);
          break;
        case "camp":
          this.noise(t, 0.9, 0.12, "lowpass", 1200, 500, d, 1, 0.2);
          [0, 7].forEach((s, i) => this.tone(mtof(60 + s), t + i * 0.2, 1.2, "sine", 0.12, d, { send: this.revSend }));
          break;
        case "page":
          this.noise(t, 0.25, 0.2, "highpass", 2500, 6000, d, 0.5, 0.05);
          break;
        case "boss":
          this.tone(55, t, 2.2, "sawtooth", 0.3, d, { slide: 40, attack: 0.3 });
          this.tone(58, t, 2.2, "sawtooth", 0.25, d, { slide: 42, attack: 0.3 });
          this.noise(t, 2, 0.3, "lowpass", 300, 40, d, 1, 0.4);
          break;
        case "phase":
          this.tone(80, t, 1.2, "sawtooth", 0.3, d, { slide: 30 });
          this.noise(t, 1.0, 0.35, "bandpass", 3000, 200, d, 3);
          break;
        case "win":
          [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(mtof(60 + s), t + i * 0.16, 1.8, "triangle", 0.2, d, { send: this.revSend }));
          break;
        case "lose":
          [0, -2, -5, -9, -14].forEach((s, i) => this.tone(mtof(57 + s), t + i * 0.35, 2.2, "sawtooth", 0.1, d, { send: this.revSend, attack: 0.08 }));
          break;
        default:
          this.tone(440, t, 0.1, "sine", 0.1, d);
      }
    } catch {
      /* audio is best-effort */
    }
  }

  // ---------- music ----------
  startMusic() {
    const ctx = this.ensure();
    if (!ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextBar = ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.pump(), 200);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private pump() {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn) return;
    if (ctx.state !== "running") {
      this.nextBar = ctx.currentTime + 0.1;
      return;
    }
    let guard = 0;
    while (this.nextBar < ctx.currentTime + 0.9 && guard++ < 4) {
      const len = this.scheduleBar(this.nextBar);
      this.nextBar += len;
    }
  }

  private scheduleBar(t: number): number {
    const ctx = this.ctx!;
    const m = this.mood;
    const beat = m.boss ? 0.42 : m.combat ? 0.5 : m.night ? 1.05 : 0.9;
    const bar = beat * 4;
    const chord = PROG[this.barIdx % PROG.length];
    this.barIdx++;
    const insane = Math.max(0, Math.min(1, (65 - m.sanity) / 65));
    // pad
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(m.night ? 520 : 1100, t);
    lp.frequency.linearRampToValueAtTime((m.night ? 520 : 1100) * (m.combat ? 1.8 : 1.3), t + bar);
    lp.connect(this.musicBus);
    lp.connect(this.revSend);
    chord.forEach((n) => {
      const nn = m.night ? n - 12 : n;
      this.tone(mtof(nn), t, bar + 1.2, "triangle", 0.05, lp, { attack: 1.1, detune: -6 - insane * 25 });
      this.tone(mtof(nn), t, bar + 1.2, "sine", 0.05, lp, { attack: 1.1, detune: 6 + insane * 25 });
    });
    if (insane > 0.15 && Math.random() < insane) {
      this.tone(mtof(chord[0] + 6), t + beat, bar, "sawtooth", 0.025 + insane * 0.03, lp, { attack: 1.4 });
      this.tone(mtof(chord[1] + 1), t + beat * 2, bar, "sine", 0.05 * insane, lp, { attack: 1 });
    }
    // bass
    this.tone(mtof(chord[0] - 12), t, bar + 0.3, "sine", 0.16, this.musicBus, { attack: 0.3 });
    if (m.boss) this.tone(mtof(chord[0] - 24), t, bar, "sawtooth", 0.05, lp, { attack: 0.2 });
    // melody
    const pNote = m.boss ? 0.8 : m.combat ? 0.65 : m.night ? 0.3 : 0.42;
    const steps = m.combat || m.boss ? 8 : 4;
    for (let i = 0; i < steps; i++) {
      if (Math.random() > pNote) continue;
      let note = SCALE[Math.floor(Math.random() * SCALE.length)];
      if (Math.random() < insane * 0.4) note += Math.random() < 0.5 ? 1 : -1;
      if (m.night) note -= 12;
      this.tone(mtof(note), t + (i * bar) / steps, 1.3, "triangle", 0.075, this.musicBus, { send: this.delayIn });
    }
    // percussion
    if (m.combat || m.boss) {
      for (let i = 0; i < 4; i++) {
        const bt = t + i * beat;
        if (i % 2 === 0) this.tone(120, bt, 0.25, "sine", 0.32, this.musicBus, { slide: 38 });
        else this.noise(bt, 0.14, 0.12, "bandpass", 1800, 1200, this.musicBus, 1);
        this.noise(bt + beat / 2, 0.05, 0.05, "highpass", 6000, 6000, this.musicBus, 0.5);
      }
      if (m.boss) this.tone(70, t + beat * 3.5, 0.4, "sine", 0.3, this.musicBus, { slide: 40 });
    }
    // unwriting rumble
    if (m.unwrite > 0.05) this.noise(t, bar + 0.5, 0.12 * m.unwrite, "lowpass", 160, 70, this.musicBus, 1, 1);
    // whispers when insane
    if (insane > 0.35 && Math.random() < insane * 0.45) setTimeout(() => this.sfx("whisper"), Math.random() * bar * 900);
    return bar;
  }
}

export const audio = new AudioEngine();
