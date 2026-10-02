/* Fully synthesized audio: SFX + reactive generative music. No assets. */

type Wave = OscillatorType;

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private noiseBuf: AudioBuffer | null = null;
  private vol = { master: 0.8, sfx: 0.9, music: 0.55, muted: false };
  private musicTimer: number | null = null;
  private musicMode: "none" | "menu" | "hub" | "job" = "none";
  private nextBeat = 0;
  private beat = 0;
  private intensity = 0;
  private drone: { o: OscillatorNode[]; g: GainNode } | null = null;
  private lastTick = 0;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 5;
      this.master = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 900;
      this.musicFilter.Q.value = 0.7;
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.master);
      this.sfxBus.connect(this.master);
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
      if (this.musicMode !== "none") {
        const m = this.musicMode;
        this.musicMode = "none";
        this.startMusic(m);
      }
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: { master: number; sfx: number; music: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.05);
  }

  private get ok() {
    return !!this.ctx && !this.vol.muted;
  }

  /* ---------- primitives ---------- */
  private tone(freq: number, dur: number, type: Wave = "sine", vol = 0.2, opts: { slide?: number; delay?: number; attack?: number; dest?: AudioNode; detune?: number } = {}) {
    if (!this.ctx || !this.ok) return;
    const t0 = this.ctx.currentTime + (opts.delay || 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * opts.slide), t0 + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const a = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(opts.dest || this.sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol = 0.2, filt: { type?: BiquadFilterType; freq?: number; q?: number; delay?: number; sweep?: number } = {}) {
    if (!this.ctx || !this.noiseBuf || !this.ok) return;
    const t0 = this.ctx.currentTime + (filt.delay || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filt.type || "bandpass";
    f.frequency.setValueAtTime(filt.freq || 2000, t0);
    if (filt.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, (filt.freq || 2000) * filt.sweep), t0 + dur);
    f.Q.value = filt.q ?? 1;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  /* ---------- SFX ---------- */
  ui() {
    this.tone(660, 0.07, "triangle", 0.12);
    this.tone(990, 0.06, "sine", 0.06, { delay: 0.02 });
  }
  hover() {
    this.tone(1200, 0.03, "sine", 0.035);
  }
  back() {
    this.tone(420, 0.09, "triangle", 0.12, { slide: 0.7 });
  }
  /** mechanical tick; pitch 0..1 */
  tick(p = 0.3, vol = 0.12) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastTick < 0.012) return;
    this.lastTick = now;
    this.noise(0.025, vol, { type: "highpass", freq: 2500 + p * 3500, q: 0.8 });
    this.tone(900 + p * 1400, 0.03, "square", vol * 0.25);
  }
  creak(closeness: number) {
    const f = 260 + closeness * 700;
    this.tone(f, 0.06, "sawtooth", 0.05 + closeness * 0.05, { slide: 1.15 });
    this.noise(0.04, 0.04, { type: "bandpass", freq: f * 2, q: 4 });
  }
  setPin() {
    this.noise(0.05, 0.3, { type: "highpass", freq: 3000 });
    this.tone(1760, 0.14, "triangle", 0.2, { slide: 0.8 });
    this.tone(220, 0.12, "sine", 0.28, { slide: 0.5 });
  }
  clunk() {
    this.tone(150, 0.2, "sine", 0.4, { slide: 0.45 });
    this.noise(0.08, 0.3, { type: "lowpass", freq: 900 });
    this.tone(1320, 0.1, "triangle", 0.1, { delay: 0.01 });
  }
  grind(v = 0.06) {
    this.noise(0.07, v, { type: "bandpass", freq: 500, q: 2 });
  }
  fault() {
    this.tone(150, 0.25, "sawtooth", 0.22, { slide: 0.6 });
    this.tone(160, 0.25, "square", 0.1, { slide: 0.6, detune: 30 });
    this.noise(0.12, 0.18, { type: "bandpass", freq: 700, q: 1 });
  }
  snap() {
    this.noise(0.1, 0.4, { type: "highpass", freq: 4000 });
    this.tone(2400, 0.2, "triangle", 0.2, { slide: 0.4 });
    this.tone(120, 0.3, "sine", 0.3, { slide: 0.6, delay: 0.05 });
  }
  stageClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.28, "triangle", 0.17, { delay: i * 0.07 }));
    this.noise(0.3, 0.08, { type: "highpass", freq: 5000, delay: 0.2 });
  }
  vaultOpen() {
    this.tone(90, 1.2, "sawtooth", 0.2, { slide: 0.7 });
    this.noise(1.1, 0.12, { type: "lowpass", freq: 600, sweep: 0.4 });
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, "triangle", 0.15, { delay: 0.5 + i * 0.12 }));
  }
  coin() {
    this.tone(1568, 0.08, "square", 0.08);
    this.tone(2093, 0.18, "square", 0.08, { delay: 0.06 });
  }
  alarm() {
    for (let i = 0; i < 6; i++) {
      this.tone(880, 0.15, "square", 0.2, { delay: i * 0.3 });
      this.tone(620, 0.15, "square", 0.2, { delay: i * 0.3 + 0.15 });
    }
  }
  patrolWarn() {
    this.tone(330, 0.18, "triangle", 0.2);
    this.tone(247, 0.3, "triangle", 0.2, { delay: 0.18 });
  }
  footstep(v = 0.1) {
    this.tone(70, 0.1, "sine", v, { slide: 0.6 });
    this.noise(0.05, v * 0.4, { type: "lowpass", freq: 500 });
  }
  hide(on: boolean) {
    this.noise(0.18, 0.12, { type: "bandpass", freq: on ? 600 : 1200, q: 0.6, sweep: on ? 0.5 : 1.6 });
  }
  item() {
    this.tone(440, 0.1, "sine", 0.15);
    this.tone(660, 0.14, "triangle", 0.15, { delay: 0.07 });
    this.noise(0.15, 0.08, { type: "highpass", freq: 3000, delay: 0.05 });
  }
  win() {
    [392, 494, 587, 784, 988, 1175].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.2, { delay: i * 0.13 }));
    [196, 247].forEach((f, i) => this.tone(f, 1.4, "sine", 0.2, { delay: 0.2 + i * 0.1 }));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.5, "sawtooth", 0.12, { delay: i * 0.22, slide: 0.95 }));
  }
  buy() {
    this.coin();
    this.tone(330, 0.12, "triangle", 0.1, { delay: 0.1 });
  }
  rune(i: number) {
    const scale = [261.63, 311.13, 349.23, 392.0, 466.16, 523.25, 587.33, 698.46];
    const f = scale[i % scale.length];
    this.tone(f, 0.42, "triangle", 0.22);
    this.tone(f * 2, 0.3, "sine", 0.07);
  }
  pulse(v = 0.1) {
    this.tone(55, 0.22, "sine", v, { slide: 0.6 });
  }
  needleHit() {
    this.tone(880, 0.1, "square", 0.1, { slide: 1.5 });
    this.tone(1320, 0.14, "triangle", 0.14, { delay: 0.05 });
  }

  /* ---------- Music ---------- */
  startMusic(mode: "menu" | "hub" | "job") {
    if (this.musicMode === mode && this.musicTimer !== null) return;
    this.stopMusic(false);
    this.musicMode = mode;
    if (!this.ctx) return;
    this.beat = 0;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.startDrone(mode);
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 80);
  }

  stopMusic(clearMode = true) {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
    if (this.drone && this.ctx) {
      const d = this.drone;
      const t = this.ctx.currentTime;
      d.g.gain.cancelScheduledValues(t);
      d.g.gain.setTargetAtTime(0, t, 0.25);
      window.setTimeout(() => d.o.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } }), 1200);
      this.drone = null;
    }
    if (clearMode) this.musicMode = "none";
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
    if (this.ctx && this.musicFilter) {
      this.musicFilter.frequency.setTargetAtTime(700 + this.intensity * 3200, this.ctx.currentTime, 0.2);
    }
  }

  private startDrone(mode: string) {
    if (!this.ctx) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.0001;
    g.gain.setTargetAtTime(mode === "job" ? 0.11 : 0.09, this.ctx.currentTime, 0.8);
    g.connect(this.musicBus);
    const root = mode === "hub" ? 73.42 : 65.41; // D2 / C2
    const oscs: OscillatorNode[] = [];
    [1, 1.5, 2.005].forEach((m, i) => {
      const o = this.ctx!.createOscillator();
      o.type = i === 2 ? "triangle" : "sawtooth";
      o.frequency.value = root * m;
      o.detune.value = (i - 1) * 6;
      const lg = this.ctx!.createGain();
      lg.gain.value = i === 0 ? 0.6 : 0.25;
      o.connect(lg);
      lg.connect(g);
      o.start();
      oscs.push(o);
    });
    this.drone = { o: oscs, g };
  }

  private scheduleMusic() {
    if (!this.ctx || this.musicMode === "none") return;
    const mode = this.musicMode;
    const bpm = mode === "job" ? 78 + this.intensity * 54 : mode === "hub" ? 70 : 62;
    const stepLen = 60 / bpm / 2;
    const minorScale = [0, 2, 3, 5, 7, 8, 10];
    const root = mode === "hub" ? 146.83 : 130.81;
    // after a throttled/background tab, don't replay a burst of missed beats
    if (this.nextBeat < this.ctx.currentTime - 0.5) this.nextBeat = this.ctx.currentTime + 0.05;
    while (this.nextBeat < this.ctx.currentTime + 0.25) {
      const t = this.nextBeat;
      const b = this.beat;
      const chordShift = [0, 0, 3, 0, 5, 3, -2, 0][Math.floor(b / 8) % 8];
      if (b % 2 === 0 || this.intensity > 0.5) {
        const sparse = mode === "job" ? 0.55 + this.intensity * 0.4 : 0.4;
        if (Math.random() < sparse) {
          const deg = minorScale[Math.floor(Math.random() * minorScale.length)] + chordShift;
          const oct = Math.random() < 0.3 ? 2 : 1;
          const f = root * Math.pow(2, deg / 12) * oct;
          this.pluck(f, t, mode === "job" ? 0.1 : 0.08);
        }
      }
      if (b % 8 === 0) this.pad(root * Math.pow(2, chordShift / 12) * 0.5, t, stepLen * 8);
      if (mode === "job") {
        if (b % 4 === 0 && this.intensity > 0.25) this.kick(t, 0.1 + this.intensity * 0.12);
        if (this.intensity > 0.6 && b % 2 === 1) this.hat(t, 0.05);
        // soft clock tick
        if (b % 2 === 0) this.hat(t, 0.02 + this.intensity * 0.02);
      }
      this.nextBeat += stepLen;
      this.beat++;
    }
  }

  private pluck(f: number, t: number, v: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 1);
  }
  private pad(f: number, t: number, dur: number) {
    if (!this.ctx) return;
    [1, 1.2, 1.5].forEach((m) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.type = "sine";
      o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(this.musicBus);
      o.start(t);
      o.stop(t + dur + 0.1);
    });
  }
  private kick(t: number, v: number) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g);
    g.connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.25);
  }
  private hat(t: number, v: number) {
    if (!this.ctx || !this.noiseBuf) return;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f);
    f.connect(g);
    g.connect(this.musicBus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + 0.08);
  }
}

export const audio = new AudioEngine();
