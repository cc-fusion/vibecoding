// Fully synthesized audio: ambient drone, reactive arpeggio + heartbeat, and effects. No audio files.
type Vol = { master: number; music: number; sfx: number; muted: boolean };

const SCALE = [146.83, 155.56, 174.61, 196.0, 220.0, 233.08, 261.63, 293.66]; // D phrygian

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; musicGain!: GainNode; sfxGain!: GainNode; musicFilter!: BiquadFilterNode;
  noiseBuf: AudioBuffer | null = null;
  vol: Vol = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  tension = 0; targetTension = 0; boss = false; musicOn = false; paused = false;
  timer: number | null = null; nextT = 0; stepN = 0;
  drone: { oscs: OscillatorNode[]; dis: GainNode; sub: GainNode; lfo: OscillatorNode } | null = null;

  ensure(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch { return false; }
      const c = this.ctx;
      const comp = c.createDynamicsCompressor();
      this.master = c.createGain(); this.musicGain = c.createGain(); this.sfxGain = c.createGain();
      this.musicFilter = c.createBiquadFilter(); this.musicFilter.type = "lowpass"; this.musicFilter.frequency.value = 1800;
      this.musicGain.connect(this.musicFilter); this.musicFilter.connect(this.master);
      this.sfxGain.connect(this.master); this.master.connect(comp); comp.connect(c.destination);
      const len = c.sampleRate * 1;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.applyVol();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.vol.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.1);
    this.sfxGain.gain.setTargetAtTime(this.vol.sfx * 0.9, t, 0.05);
  }
  setVol(v: Partial<Vol>) { this.vol = { ...this.vol, ...v }; this.applyVol(); }

  setTension(t: number, boss: boolean) { this.targetTension = Math.max(0, Math.min(1, t)); this.boss = boss; }
  setPaused(p: boolean) {
    this.paused = p;
    if (this.ctx) this.musicFilter.frequency.setTargetAtTime(p ? 380 : 1800, this.ctx.currentTime, 0.15);
  }

  startMusic() {
    if (!this.ensure() || !this.ctx || this.musicOn) return;
    const c = this.ctx;
    this.musicOn = true; this.stepN = 0; this.nextT = c.currentTime + 0.1;
    const o1 = c.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 55;
    const o2 = c.createOscillator(); o2.type = "triangle"; o2.frequency.value = 82.41;
    const o3 = c.createOscillator(); o3.type = "sine"; o3.frequency.value = 77.78; // tritone: grows with tension
    const o4 = c.createOscillator(); o4.type = "sine"; o4.frequency.value = 27.5;
    const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; lp.Q.value = 3;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = c.createGain(); lfoG.gain.value = 140; lfo.connect(lfoG); lfoG.connect(lp.frequency);
    const g1 = c.createGain(); g1.gain.value = 0.16; const g2 = c.createGain(); g2.gain.value = 0.2;
    const dis = c.createGain(); dis.gain.value = 0; const sub = c.createGain(); sub.gain.value = 0.35;
    o1.connect(g1); g1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(dis); dis.connect(lp); o4.connect(sub); sub.connect(this.musicGain);
    lp.connect(this.musicGain);
    [o1, o2, o3, o4, lfo].forEach((o) => o.start());
    this.drone = { oscs: [o1, o2, o3, o4, lfo], dis, sub, lfo };
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 90);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (this.drone && this.ctx) {
      const d = this.drone, t = this.ctx.currentTime;
      d.dis.gain.setTargetAtTime(0, t, 0.2); d.sub.gain.setTargetAtTime(0, t, 0.2);
      d.oscs.forEach((o) => { try { o.stop(t + 0.6); } catch { /* already stopped */ } });
      this.drone = null;
    }
  }

  private schedule() {
    if (!this.ctx || !this.musicOn) return;
    const c = this.ctx;
    this.tension += (this.targetTension - this.tension) * 0.04;
    const T = this.tension;
    if (this.drone) {
      this.drone.dis.gain.setTargetAtTime(this.boss ? 0.2 : T * 0.12, c.currentTime, 0.4);
      this.drone.oscs[0].frequency.setTargetAtTime(this.boss ? 49 : 55, c.currentTime, 1);
    }
    const bpm = 52 + T * 44 + (this.boss ? 16 : 0);
    const beat = 60 / bpm;
    while (this.nextT < c.currentTime + 0.35) {
      const t = this.nextT, n = this.stepN;
      // plucked melody, sparse when calm
      if (!this.paused && (n % 2 === 0 || Math.random() < T * 0.6)) {
        if (Math.random() < 0.55 + T * 0.3) {
          const idx = [0, 2, 4, 3, 1, 5, 2, 6][(n + (Math.random() < 0.3 ? 1 : 0)) % 8];
          const f = SCALE[(idx + (this.boss && Math.random() < 0.3 ? 1 : 0)) % SCALE.length] * (Math.random() < 0.2 ? 2 : 1);
          this.pluck(f, t, 0.5 + T * 0.1, 0.16);
        }
      }
      // heartbeat when tense
      if (T > 0.22 && n % 2 === 0) {
        const hv = Math.min(0.6, (T - 0.15) * 0.8);
        this.thump(t, 62, hv); this.thump(t + beat * 0.28, 52, hv * 0.7);
      }
      if (this.boss && n % 4 === 0) this.pluck(36.7, t, 1.4, 0.25, "sawtooth");
      this.nextT += beat; this.stepN++;
    }
  }

  private dest(): AudioNode { return this.musicGain; }
  private pluck(f: number, t: number, dur: number, vol: number, type: OscillatorType = "triangle") {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.dest()); o.start(t); o.stop(t + dur + 0.05);
  }
  private thump(t: number, f: number, vol: number) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.18);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.dest()); o.start(t); o.stop(t + 0.25);
  }

  /* ---- SFX ---- */
  private tone(f: number, dur: number, type: OscillatorType, vol: number, delay = 0, slide = 0) {
    const c = this.ctx!; const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, vol: number, freq: number, delay = 0, q = 1) {
    const c = this.ctx!; const t = c.currentTime + delay;
    const src = c.createBufferSource(); src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfxGain); src.start(t); src.stop(t + dur + 0.05);
  }
  private bell(f: number, vol: number, delay = 0) {
    [1, 2.01, 2.76, 4.07].forEach((m, i) => this.tone(f * m, 2.4 / (1 + i * 0.6), "sine", vol / (1 + i * 0.9), delay));
  }

  sfx(name: string) {
    if (!this.ensure() || !this.ctx || this.vol.muted) return;
    switch (name) {
      case "click": this.tone(520, 0.06, "square", 0.05); break;
      case "select": this.tone(330, 0.09, "triangle", 0.12); this.tone(495, 0.1, "triangle", 0.09, 0.05); break;
      case "ok": this.tone(440, 0.1, "triangle", 0.14); this.tone(660, 0.14, "triangle", 0.12, 0.08); break;
      case "err": this.tone(150, 0.2, "sawtooth", 0.14, 0, 0.7); this.tone(120, 0.2, "square", 0.08, 0.06); break;
      case "build": this.noise(0.08, 0.35, 900, 0, 2); this.tone(120, 0.14, "sine", 0.3, 0, 0.5); this.noise(0.08, 0.3, 1400, 0.16, 2); this.tone(150, 0.14, "sine", 0.25, 0.16, 0.5); break;
      case "bell": this.bell(98, 0.22); break;
      case "alert": this.tone(660, 0.14, "square", 0.08); this.tone(495, 0.2, "square", 0.08, 0.16); break;
      case "research": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, "sine", 0.14, i * 0.09)); break;
      case "seal": this.tone(70, 0.35, "sine", 0.4, 0, 0.5); this.noise(0.25, 0.25, 300, 0, 1); this.tone(220, 0.1, "square", 0.08, 0.05); break;
      case "cure": [392, 523, 659, 784, 988, 1319].forEach((f, i) => this.tone(f, 0.6, "sine", 0.12, i * 0.07)); this.noise(0.6, 0.06, 5000, 0.1, 0.5); break;
      case "event": this.noise(0.35, 0.18, 2500, 0, 0.7); this.tone(294, 0.4, "triangle", 0.12, 0.05); this.tone(349, 0.5, "triangle", 0.1, 0.2); break;
      case "trace": [880, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, "sine", 0.1, i * 0.06)); break;
      case "calm": this.tone(392, 0.8, "sine", 0.12); this.tone(494, 0.8, "sine", 0.1, 0.1); this.tone(587, 0.9, "sine", 0.09, 0.2); break;
      case "boss": this.tone(55, 2.2, "sawtooth", 0.35, 0, 0.5); this.tone(58, 2.2, "sawtooth", 0.3, 0, 0.5); this.bell(65, 0.3); this.bell(69, 0.25, 0.6); break;
      case "win": [392, 494, 587, 784, 988].forEach((f, i) => { this.tone(f, 1.2, "triangle", 0.15, i * 0.16); this.tone(f / 2, 1.2, "sine", 0.1, i * 0.16); }); break;
      case "lose": [330, 311, 294, 247, 196].forEach((f, i) => this.tone(f, 1.1, "sawtooth", 0.1, i * 0.3, 0.97)); this.bell(82, 0.3, 0.5); break;
      case "hover": this.tone(700, 0.03, "sine", 0.03); break;
      default: this.tone(440, 0.05, "sine", 0.05);
    }
  }
}

export const audio = new AudioEngine();
