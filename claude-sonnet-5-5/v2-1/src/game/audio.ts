// Fully synthesized audio: SFX + reactive generative music + tide ambience (Web Audio API)
type OscT = OscillatorType;

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  musicGain!: GainNode;
  sfxGain!: GainNode;
  seaGain!: GainNode;
  seaFilter!: BiquadFilterNode;
  delay!: DelayNode;
  noiseBuf!: AudioBuffer;
  vol = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  intensity = 0;
  boss = false;
  tide = 0.5;
  tideRate = 0;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private last: Record<string, number> = {};
  private padNodes: { o: OscillatorNode; g: GainNode }[] = [];
  private running = false;
  private seaSrc: AudioBufferSourceNode | null = null;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.seaGain = ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.seaGain.connect(this.master);
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.375;
      const fb = ctx.createGain();
      fb.gain.value = 0.35;
      this.delay.connect(fb);
      fb.connect(this.delay);
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      this.delay.connect(wet);
      wet.connect(this.musicGain);
      const len = ctx.sampleRate * 2;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVol();
    } catch { this.ctx = null; }
  }

  applyVol() {
    if (!this.ctx) return;
    const m = this.vol.muted ? 0 : this.vol.master;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxGain.gain.setTargetAtTime(this.vol.sfx * 0.9, t, 0.05);
    this.seaGain.gain.setTargetAtTime(this.vol.music * 0.35, t, 0.05);
  }

  setVol(v: Partial<typeof this.vol>) { this.vol = { ...this.vol, ...v }; this.applyVol(); }

  private tone(f: number, dur: number, type: OscT = 'sine', vol = 0.3, slide = 0, delay = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private noise(dur: number, ftype: BiquadFilterType, f0: number, f1: number, vol = 0.3, delay = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = ftype;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  sfx(name: string) {
    if (!this.ctx || this.vol.muted) return;
    const now = this.ctx.currentTime;
    const gap = name === 'hit' || name === 'splash' || name === 'tick' ? 0.05 : 0.03;
    if (this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    switch (name) {
      case 'ui': this.tone(660, 0.07, 'triangle', 0.2); this.tone(990, 0.06, 'triangle', 0.12, 0, 0.04); break;
      case 'back': this.tone(520, 0.08, 'triangle', 0.18, 320); break;
      case 'err': this.tone(160, 0.18, 'sawtooth', 0.2, 110); break;
      case 'build': this.noise(0.14, 'lowpass', 900, 200, 0.35); this.tone(110, 0.2, 'square', 0.18, 70); this.tone(330, 0.12, 'triangle', 0.18, 0, 0.1); this.tone(495, 0.18, 'triangle', 0.16, 0, 0.18); break;
      case 'upgrade': [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.2, 0, i * 0.06)); break;
      case 'coin': this.tone(1320, 0.07, 'square', 0.1); this.tone(1760, 0.14, 'square', 0.1, 0, 0.06); break;
      case 'pickup': this.tone(880, 0.08, 'sine', 0.22, 1400); this.tone(1320, 0.12, 'sine', 0.2, 0, 0.06); break;
      case 'ballista': this.noise(0.09, 'bandpass', 2400, 600, 0.3); this.tone(180, 0.1, 'sawtooth', 0.15, 80); break;
      case 'cannon': this.noise(0.4, 'lowpass', 1200, 90, 0.7); this.tone(95, 0.35, 'sine', 0.55, 40); break;
      case 'catapult': this.tone(140, 0.3, 'sawtooth', 0.14, 60); this.noise(0.25, 'lowpass', 600, 120, 0.4, 0.05); this.tone(70, 0.3, 'sine', 0.4, 38, 0.06); break;
      case 'jet': this.noise(0.45, 'bandpass', 500, 2400, 0.35); this.tone(240, 0.3, 'sine', 0.15, 520); break;
      case 'hit': this.noise(0.06, 'highpass', 1800, 900, 0.25); this.tone(240, 0.05, 'square', 0.1, 120); break;
      case 'boom': this.noise(0.55, 'lowpass', 1500, 60, 0.75); this.tone(70, 0.5, 'sine', 0.6, 30); break;
      case 'bigboom': this.noise(1.0, 'lowpass', 1800, 50, 0.9); this.tone(55, 0.9, 'sine', 0.8, 24); this.tone(90, 0.6, 'sawtooth', 0.2, 30); break;
      case 'splash': this.noise(0.25, 'bandpass', 1800, 500, 0.22); break;
      case 'gate': this.tone(70, 0.7, 'sawtooth', 0.18, 52); this.noise(0.7, 'bandpass', 300, 900, 0.18); this.tone(120, 0.15, 'square', 0.12, 0, 0.5); break;
      case 'horn': this.tone(110, 1.3, 'sawtooth', 0.28); this.tone(165, 1.3, 'sawtooth', 0.18); this.tone(220, 1.2, 'triangle', 0.12); break;
      case 'boss': this.tone(60, 1.6, 'sawtooth', 0.4, 38); this.tone(90, 1.6, 'square', 0.18, 50); this.noise(1.4, 'lowpass', 500, 80, 0.5); break;
      case 'alarm': for (let i = 0; i < 3; i++) this.tone(740, 0.12, 'square', 0.14, 520, i * 0.18); break;
      case 'rally': [262, 330, 392, 523].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.13, 0, i * 0.09)); break;
      case 'discharge': this.noise(0.6, 'highpass', 4000, 800, 0.5); this.tone(1200, 0.5, 'sawtooth', 0.25, 90); break;
      case 'repair': this.tone(500, 0.06, 'square', 0.12); this.tone(420, 0.06, 'square', 0.12, 0, 0.09); this.tone(600, 0.1, 'triangle', 0.15, 0, 0.18); break;
      case 'ignite': this.noise(0.4, 'bandpass', 700, 2500, 0.3); break;
      case 'shipdie': this.noise(0.5, 'lowpass', 900, 100, 0.5); this.tone(200, 0.45, 'triangle', 0.25, 60); break;
      case 'flood': this.noise(0.9, 'lowpass', 400, 160, 0.4); this.tone(90, 0.8, 'sine', 0.2, 60); break;
      case 'tick': this.tone(1000, 0.03, 'square', 0.06); break;
      case 'victory': [392, 494, 587, 784, 988].forEach((f, i) => { this.tone(f, 0.5, 'triangle', 0.22, 0, i * 0.14); this.tone(f / 2, 0.6, 'sine', 0.2, 0, i * 0.14); }); break;
      case 'defeat': [330, 294, 247, 196, 147].forEach((f, i) => this.tone(f, 0.7, 'sawtooth', 0.18, f * 0.9, i * 0.25)); break;
      case 'wave': this.tone(98, 1.0, 'sawtooth', 0.3); this.tone(147, 1.0, 'sawtooth', 0.2); this.tone(196, 0.9, 'square', 0.1, 0, 0.1); break;
      default: break;
    }
  }

  // ---- music ----
  private roots = [146.83, 116.54, 174.61, 130.81]; // D, Bb, F, C
  private scale = [0, 3, 5, 7, 10, 12, 15, 17]; // D minor pentatonic-ish

  startMusic() {
    if (!this.ctx || this.running) return;
    this.running = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.startSea();
    this.timer = window.setInterval(() => this.schedule(), 40);
  }

  stopMusic() {
    this.running = false;
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    const c = this.ctx;
    if (c) {
      this.padNodes.forEach((p) => { try { p.g.gain.setTargetAtTime(0, c.currentTime, 0.3); p.o.stop(c.currentTime + 1.5); } catch { /* */ } });
      this.padNodes = [];
      if (this.seaSrc) { try { this.seaSrc.stop(c.currentTime + 0.4); } catch { /* */ } this.seaSrc = null; }
    }
  }

  private startSea() {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.Q.value = 0.7;
    this.seaFilter = f;
    s.connect(f); f.connect(this.seaGain);
    s.start();
    this.seaSrc = s;
  }

  setState(intensity: number, boss: boolean, tide01: number, tideRate: number) {
    this.intensity += (intensity - this.intensity) * 0.05;
    this.boss = boss; this.tide = tide01; this.tideRate = tideRate;
    if (this.ctx && this.seaFilter) {
      const t = this.ctx.currentTime;
      this.seaFilter.frequency.setTargetAtTime(260 + tide01 * 900 + Math.abs(tideRate) * 40, t, 0.3);
      this.seaGain.gain.setTargetAtTime(this.vol.music * (0.18 + Math.abs(tideRate) * 0.012 + tide01 * 0.1), t, 0.3);
    }
  }

  private chordChange(root: number, time: number) {
    const c = this.ctx; if (!c) return;
    this.padNodes.forEach((p) => { p.g.gain.setTargetAtTime(0, time, 0.6); p.o.stop(time + 3); });
    this.padNodes = [];
    const ratios = [1, 1.5, 2, 2.378];
    ratios.forEach((r, i) => {
      const o = c.createOscillator(); const g = c.createGain(); const f = c.createBiquadFilter();
      o.type = i % 2 ? 'triangle' : 'sawtooth'; o.frequency.value = root * r; o.detune.value = (i - 1.5) * 6;
      f.type = 'lowpass'; f.frequency.value = 500 + this.tide * 500;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(0.045 + this.intensity * 0.03, time + 1.5);
      o.connect(f); f.connect(g); g.connect(this.musicGain);
      o.start(time);
      this.padNodes.push({ o, g });
    });
  }

  private schedule() {
    const c = this.ctx; if (!c || !this.running) return;
    const tempo = (this.boss ? 104 : 74) + this.intensity * 14;
    const stepDur = 60 / tempo / 2; // 8th notes
    while (this.nextTime < c.currentTime + 0.15) {
      const t = this.nextTime;
      const bar = Math.floor(this.step / 8);
      const root = this.roots[bar % 4];
      const s = this.step % 8;
      if (this.step % 16 === 0) this.chordChange(root, t);
      // arpeggio
      const density = 0.25 + this.intensity * 0.55;
      if (Math.random() < density && (s % 2 === 0 || this.intensity > 0.4)) {
        const deg = this.scale[Math.floor(Math.random() * this.scale.length)];
        const f = root * 2 * Math.pow(2, deg / 12);
        this.toneAt(f, 0.5, 'triangle', 0.07, t, true);
      }
      // bass pulse
      if (s === 0 || (this.intensity > 0.5 && s === 4)) this.toneAt(root / 2, 0.6, 'sine', 0.2, t);
      // drums
      if (this.intensity > 0.25 && (s === 0 || s === 4)) this.kick(t, 0.5 + this.intensity * 0.4);
      if (this.intensity > 0.55 && s % 2 === 1) this.hat(t, 0.06 + this.intensity * 0.05);
      if (this.boss && (s === 2 || s === 6)) this.kick(t, 0.45);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private toneAt(f: number, dur: number, type: OscT, vol: number, t: number, wet = false) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicGain);
    if (wet) g.connect(this.delay);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private kick(t: number, v: number) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.musicGain);
    o.start(t); o.stop(t + 0.35);
  }

  private hat(t: number, v: number) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = c.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicGain);
    s.start(t, Math.random()); s.stop(t + 0.08);
  }
}

export const audio = new AudioEngine();
