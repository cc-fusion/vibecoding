// Fully synthesized audio: SFX + adaptive generative music (Web Audio API). No asset files.
type Mode = "menu" | "game" | "boss";

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxG!: GainNode; musG!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };
  timer: number | null = null;
  step = 0; nextTime = 0;
  tension = 0; targetTension = 0; mode: Mode = "menu";
  playing = false;
  padNodes: { o: OscillatorNode[]; g: GainNode } | null = null;
  lastPad = -1;

  init() {
    if (this.ctx) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC() as AudioContext;
      const c = this.ctx;
      this.master = c.createGain(); this.sfxG = c.createGain(); this.musG = c.createGain();
      this.sfxG.connect(this.master); this.musG.connect(this.master);
      const comp = c.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(c.destination);
      const len = c.sampleRate;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVol();
    } catch { this.ctx = null; }
  }
  resume() { this.init(); if (this.ctx && this.ctx.state === "suspended") this.ctx.resume().catch(() => {}); }
  setHidden(h: boolean) {
    if (!this.ctx) return;
    if (h) this.ctx.suspend().catch(() => {});
    else if (this.playing || true) this.ctx.resume().catch(() => {});
  }
  setVolumes(v: Partial<typeof this.vol>) { this.vol = { ...this.vol, ...v }; this.applyVol(); }
  applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.03);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musG.gain.setTargetAtTime(this.vol.music * 0.55, t, 0.03);
  }

  // ─── primitives ───
  tone(f: number, dur: number, type: OscillatorType = "sine", vol = 0.2, delay = 0, slide = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dur: number, vol = 0.2, freq = 1000, q = 1, type: BiquadFilterType = "bandpass", delay = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c || !this.noiseBuf) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t); s.stop(t + dur + 0.05);
  }

  // ─── SFX ───
  click() { this.tone(520, 0.06, "triangle", 0.15); this.tone(780, 0.05, "sine", 0.08, 0.02); }
  hover() { this.tone(900, 0.03, "sine", 0.04); }
  error() { this.tone(160, 0.18, "square", 0.14, 0, 0.7); this.tone(120, 0.2, "square", 0.12, 0.08, 0.7); }
  coin() { [1318, 1760, 2093].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.13, i * 0.055)); this.noise(0.05, 0.05, 6000, 1, "highpass"); }
  speech() { this.tone(330, 0.12, "sawtooth", 0.07, 0, 1.3); this.tone(392, 0.16, "triangle", 0.1, 0.07); this.tone(494, 0.2, "triangle", 0.1, 0.15); }
  snoop() { this.noise(0.25, 0.1, 2500, 3, "bandpass"); this.tone(220, 0.25, "sine", 0.07, 0, 1.6); }
  blackmail() { this.tone(110, 0.4, "sawtooth", 0.15, 0, 0.6); this.tone(117, 0.4, "sawtooth", 0.12); }
  caw(pitch = 1, vol = 0.14) {
    const c = this.ctx; if (!c) return;
    for (let i = 0; i < 2; i++) {
      const t = c.currentTime + i * 0.14;
      const o = c.createOscillator(); const g = c.createGain(); const f = c.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(720 * pitch, t); o.frequency.exponentialRampToValueAtTime(330 * pitch, t + 0.12);
      f.type = "bandpass"; f.frequency.value = 1100 * pitch; f.Q.value = 2.5;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(f); f.connect(g); g.connect(this.sfxG); o.start(t); o.stop(t + 0.16);
    }
  }
  gavel() { this.tone(130, 0.18, "sine", 0.4, 0, 0.4); this.noise(0.09, 0.35, 1800, 1.2); this.tone(70, 0.3, "sine", 0.3, 0.02, 0.5); }
  tick(yes: boolean, n = 0) { const base = yes ? 520 : 260; this.tone(base + (n % 12) * (yes ? 14 : -6), 0.045, yes ? "triangle" : "square", yes ? 0.07 : 0.04); }
  pass() { this.gavel(); [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.45, "triangle", 0.16, 0.12 + i * 0.1)); this.tone(196, 0.9, "sawtooth", 0.06, 0.1); }
  fail() { this.gavel(); [330, 277, 233, 196].forEach((f, i) => this.tone(f, 0.5, "sawtooth", 0.09, 0.1 + i * 0.16, 0.95)); this.noise(0.6, 0.06, 300, 0.7, "lowpass", 0.1); }
  scandal() { this.caw(0.7, 0.18); [233, 220, 208].forEach((f, i) => this.tone(f, 0.5, "sawtooth", 0.08, i * 0.15)); this.noise(0.4, 0.08, 4000, 1, "highpass", 0.1); }
  heat() { this.tone(440, 0.1, "square", 0.06); this.tone(466, 0.1, "square", 0.06, 0.1); }
  whoosh() { this.noise(0.35, 0.12, 900, 0.8, "bandpass"); }
  unlock() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.3, "triangle", 0.12, i * 0.07)); }
  boss() { this.tone(55, 1.4, "sawtooth", 0.22, 0, 0.5); this.tone(58, 1.4, "sawtooth", 0.2); this.caw(0.5, 0.2); this.noise(1, 0.1, 200, 0.5, "lowpass"); }
  election() { [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.25, "square", 0.07, i * 0.12)); }
  victory() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.16, i * 0.14)); this.gavel(); }
  defeat() { [220, 196, 175, 147, 110].forEach((f, i) => this.tone(f, 0.9, "sawtooth", 0.1, i * 0.3, 0.9)); this.caw(0.45, 0.2); }

  // ─── adaptive music ───
  setTension(t: number) { this.targetTension = Math.max(0, Math.min(1, t)); }
  setMode(m: Mode) { this.mode = m; }
  startMusic() {
    this.resume();
    if (!this.ctx || this.playing) return;
    this.playing = true; this.step = 0; this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }
  stopMusic() {
    this.playing = false;
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    if (this.padNodes && this.ctx) {
      const { g, o } = this.padNodes; const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0.0001, t, 0.3);
      o.forEach(x => { try { x.stop(t + 1.5); } catch { /* already stopped */ } });
      this.padNodes = null;
    }
    this.lastPad = -1;
  }
  schedule() {
    const c = this.ctx; if (!c || !this.playing) return;
    this.tension += (this.targetTension - this.tension) * 0.1;
    if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;
    while (this.nextTime < c.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime);
      const bpm = (this.mode === "menu" ? 58 : 66) + this.tension * 26 + (this.mode === "boss" ? 14 : 0);
      this.nextTime += 60 / bpm / 4; this.step++;
    }
  }
  playStep(s: number, t: number) {
    const c = this.ctx!; const T = this.tension; const boss = this.mode === "boss";
    const roots = boss ? [110, 103.8, 98, 116.5] : [146.8, 116.5, 130.8, 110];
    const bar = Math.floor(s / 16) % 4; const sb = s % 16; const root = roots[bar];
    const minor = [0, 3, 5, 7, 10, 12, 15, 17];
    if (sb === 0) this.pad(root, t, bar);
    if (sb === 0 || sb === 8 || (T > 0.4 && sb === 6)) this.note(root / 2, t, 0.5, "sine", 0.28);
    // arpeggio
    const prob = 0.28 + T * 0.45 + (this.mode === "menu" ? 0.1 : 0);
    if (sb % 2 === 0 && Math.random() < prob) {
      const n = minor[Math.floor(Math.random() * minor.length)];
      const f = root * 2 * Math.pow(2, n / 12);
      this.note(f, t, 0.35, "triangle", 0.1 + T * 0.05, 0.25);
    }
    if (T > 0.3 || boss) { if (sb % 4 === 0) this.kick(t, 0.4 + T * 0.3); if (boss && sb === 10) this.kick(t, 0.5); }
    if (T > 0.55 && sb % 4 === 2) this.hat(t, 0.05 + T * 0.04);
    if (T > 0.75 && sb % 8 === 4) this.note(root * 4, t, 0.2, "square", 0.04);
    void c;
  }
  pad(root: number, t: number, bar: number) {
    const c = this.ctx!;
    if (this.lastPad === bar && this.padNodes) return;
    this.lastPad = bar;
    if (this.padNodes) {
      const old = this.padNodes; old.g.gain.setTargetAtTime(0.0001, t, 0.5);
      old.o.forEach(x => { try { x.stop(t + 3); } catch { /* ok */ } });
    }
    const g = c.createGain(); const f = c.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 500 + this.tension * 900; f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.11, t + 1.2);
    const o: OscillatorNode[] = [];
    [1, 1.5, 2.0].forEach((m, i) => {
      for (const d of [-7, 7]) {
        const os = c.createOscillator(); os.type = i === 0 ? "sawtooth" : "triangle";
        os.frequency.value = root * m; os.detune.value = d + i * 3; os.connect(f); os.start(t); o.push(os);
      }
    });
    f.connect(g); g.connect(this.musG);
    this.padNodes = { o, g };
  }
  note(f: number, t: number, dur: number, type: OscillatorType, vol: number, echo = 0) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musG); o.start(t); o.stop(t + dur + 0.05);
    if (echo) {
      const o2 = c.createOscillator(); const g2 = c.createGain(); o2.type = type; o2.frequency.value = f;
      g2.gain.setValueAtTime(0.0001, t + 0.22); g2.gain.exponentialRampToValueAtTime(vol * echo, t + 0.23); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.22 + dur);
      o2.connect(g2); g2.connect(this.musG); o2.start(t + 0.22); o2.stop(t + 0.3 + dur);
    }
  }
  kick(t: number, v: number) {
    const c = this.ctx!; const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.15);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g); g.connect(this.musG); o.start(t); o.stop(t + 0.25);
  }
  hat(t: number, v: number) { this.noise(0.04, v, 7000, 1, "highpass", t - (this.ctx?.currentTime || 0), this.musG); }
}

export const audio = new AudioEngine();
