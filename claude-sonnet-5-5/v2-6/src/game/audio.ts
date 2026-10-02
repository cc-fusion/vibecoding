// Fully synthesized audio: SFX + reactive generative music (Web Audio API)

export class AudioEngine {
  ctx: AudioContext | null = null;
  vol = { master: 0.7, music: 0.55, sfx: 0.8 };
  muted = false;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private rumbleGain: GainNode | null = null;
  private rumbleFilt: BiquadFilterNode | null = null;
  private droneOscs: OscillatorNode[] = [];
  private droneFilt: BiquadFilterNode | null = null;
  private dissGain: GainNode | null = null;
  private nextNote = 0;
  private nextBeat = 0;
  private root = 55;
  private lastSfx: Record<string, number> = {};

  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        this.master = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.sfxBus = ctx.createGain();
        this.musicBus.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(comp);
        comp.connect(ctx.destination);
        // echo for music
        const delay = ctx.createDelay(1.5);
        delay.delayTime.value = 0.42;
        const fb = ctx.createGain(); fb.gain.value = 0.38;
        const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
        delay.connect(dl); dl.connect(fb); fb.connect(delay);
        delay.connect(this.musicBus);
        this.echo = delay;
        // noise
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        // rumble loop
        const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
        this.rumbleFilt = ctx.createBiquadFilter(); this.rumbleFilt.type = 'lowpass'; this.rumbleFilt.frequency.value = 120;
        this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0;
        src.connect(this.rumbleFilt); this.rumbleFilt.connect(this.rumbleGain); this.rumbleGain.connect(this.sfxBus);
        src.start();
        this.startDrone();
        this.apply();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { this.ctx = null; }
  }
  private echo: DelayNode | null = null;

  apply() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  dispose() {
    try { this.ctx?.close(); } catch { /* ignore */ }
    this.ctx = null; this.droneOscs = [];
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume(); }

  private startDrone() {
    const ctx = this.ctx!;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 300; filt.Q.value = 2;
    const g = ctx.createGain(); g.gain.value = 0.16;
    const mk = (type: OscillatorType, mult: number, det: number) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = this.root * mult; o.detune.value = det;
      o.connect(filt); o.start(); this.droneOscs.push(o);
    };
    mk('sawtooth', 1, -6); mk('sawtooth', 1.003, 7); mk('sine', 0.5, 0); mk('triangle', 1.5, 3);
    // dissonant layer
    const dg = ctx.createGain(); dg.gain.value = 0;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = this.root * 1.0595 * 2; o2.connect(dg); o2.start();
    this.droneOscs.push(o2);
    dg.connect(filt);
    this.dissGain = dg;
    filt.connect(g); g.connect(this.musicBus);
    this.droneFilt = filt;
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, slideTo = 0, delay = 0, bus?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private noise(dur: number, type: BiquadFilterType, f0: number, f1: number, vol = 0.3, delay = 0, q = 1) {
    const ctx = this.ctx; if (!ctx || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  setRumble(level: number) {
    if (!this.ctx || !this.rumbleGain || !this.rumbleFilt) return;
    const t = this.ctx.currentTime;
    this.rumbleGain.gain.setTargetAtTime(Math.min(1, level) * 0.55, t, 0.08);
    this.rumbleFilt.frequency.setTargetAtTime(70 + level * 220, t, 0.1);
  }

  sfxOff = false;

  sfx(name: string, v = 1, force = false) {
    if (!this.ctx || this.muted || (this.sfxOff && !force)) return;
    const now = this.ctx.currentTime;
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.06) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'click': this.tone(620, 0.07, 'triangle', 0.12); break;
      case 'select': this.tone(520, 0.08, 'triangle', 0.14); this.tone(780, 0.1, 'triangle', 0.1, 0, 0.05); break;
      case 'error': this.tone(160, 0.18, 'sawtooth', 0.14, 110); break;
      case 'tremor':
        this.noise(0.9, 'lowpass', 400, 60, 0.7 * v, 0, 1); this.tone(70, 0.7, 'sine', 0.5, 35); break;
      case 'quake':
        this.noise(1.4 + v, 'lowpass', 500, 50, 0.9, 0); this.tone(55, 1.2 + v * 0.5, 'sine', 0.7, 28);
        this.tone(90, 0.8, 'triangle', 0.25 * v, 40, 0.05); break;
      case 'volcano':
        this.noise(1.8, 'bandpass', 1400, 200, 0.7, 0, 0.7); this.tone(48, 1.6, 'sawtooth', 0.35, 30);
        this.noise(0.4, 'highpass', 3000, 5000, 0.2, 0.05); break;
      case 'tsunami': this.noise(3.2, 'bandpass', 200, 900, 0.5, 0, 0.5); this.noise(2.5, 'lowpass', 1500, 200, 0.45, 1.2); break;
      case 'chime':
        [880, 1109, 1319, 1760].forEach((f, i) => this.tone(f, 0.7, 'sine', 0.13, 0, i * 0.07, this.sfxBus)); break;
      case 'prayer': this.tone(1046, 0.25, 'sine', 0.16); this.tone(1568, 0.3, 'sine', 0.12, 0, 0.07); break;
      case 'bless': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.14, 0, i * 0.06)); break;
      case 'omen': this.tone(440, 0.9, 'sine', 0.2); this.tone(660, 0.9, 'sine', 0.16, 0, 0.1); this.tone(880, 1, 'sine', 0.12, 0, 0.2); break;
      case 'sanct': this.tone(220, 1.4, 'sine', 0.25, 440); this.tone(330, 1.4, 'triangle', 0.15, 660, 0.05); break;
      case 'tide': this.noise(1.5, 'lowpass', 300, 1200, 0.5); break;
      case 'found': this.tone(392, 0.15, 'triangle', 0.14); this.tone(523, 0.2, 'triangle', 0.14, 0, 0.1); break;
      case 'war': this.tone(80, 0.25, 'sine', 0.5, 50); this.tone(80, 0.25, 'sine', 0.5, 50, 0.3); this.noise(0.3, 'bandpass', 600, 300, 0.2); break;
      case 'warn': this.tone(330, 0.3, 'square', 0.1); this.tone(247, 0.4, 'square', 0.1, 0, 0.25); break;
      case 'era': [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 1.2, 'triangle', 0.16, 0, i * 0.12)); this.tone(65, 2, 'sine', 0.3); break;
      case 'titan': this.tone(40, 2.5, 'sawtooth', 0.4, 25); this.noise(2.5, 'lowpass', 800, 40, 0.8); break;
      case 'pulse': this.tone(60, 0.9, 'sine', 0.6, 25); this.noise(1, 'lowpass', 600, 80, 0.7); break;
      case 'victory': [392, 494, 587, 784, 988, 1175].forEach((f, i) => this.tone(f, 1.6, 'triangle', 0.17, 0, i * 0.18)); break;
      case 'defeat': [440, 370, 311, 247, 185].forEach((f, i) => this.tone(f, 1.4, 'sawtooth', 0.1, f * 0.9, i * 0.3)); break;
      case 'death': this.tone(200, 0.3, 'sine', 0.08, 120); break;
      case 'splash': this.noise(0.5, 'bandpass', 2000, 600, 0.2); break;
      case 'limit': this.tone(110, 0.1, 'square', 0.08); break;
      default: break;
    }
  }

  // called every frame
  music(dt: number, tension: number, era: number, active: boolean) {
    const ctx = this.ctx; if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const roots = [55, 49, 58.27, 43.65, 36.71];
    const target = roots[Math.max(0, Math.min(4, era))];
    this.root += (target - this.root) * Math.min(1, dt * 0.4);
    const mults = [1, 1.003, 0.5, 1.5, 2.119];
    this.droneOscs.forEach((o, i) => o.frequency.setTargetAtTime(this.root * mults[i], t, 0.5));
    if (this.droneFilt) this.droneFilt.frequency.setTargetAtTime(160 + tension * 900 + (active ? 120 : 0), t, 0.4);
    if (this.dissGain) this.dissGain.gain.setTargetAtTime(Math.max(0, tension - 0.35) * 0.14, t, 0.5);
    if (!this.nextNote) this.nextNote = t + 1;
    if (t >= this.nextNote) {
      const calm = [0, 2, 4, 7, 9, 12, 14];
      const dark = [0, 1, 3, 5, 7, 8, 12];
      const scale = tension > 0.4 ? dark : calm;
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const oct = Math.random() < 0.4 ? 8 : 4;
      const f = this.root * oct * Math.pow(2, deg / 12);
      const bus = this.echo || this.musicBus;
      this.tone(f, 1.8, 'sine', 0.1, 0, 0, bus);
      this.tone(f * 2.001, 0.6, 'triangle', 0.035, 0, 0, bus);
      if (Math.random() < 0.3 + tension * 0.3) this.tone(f * 1.5, 1.4, 'sine', 0.05, 0, 0.35, bus);
      this.nextNote = t + 1.2 + (1 - tension) * 2.8 + Math.random() * 1.8;
    }
    if (tension > 0.42 && active) {
      if (!this.nextBeat) this.nextBeat = t;
      if (t >= this.nextBeat) {
        const vv = 0.12 + tension * 0.3;
        this.tone(75, 0.25, 'sine', vv, 38, 0, this.musicBus);
        this.tone(75, 0.2, 'sine', vv * 0.6, 38, 0.2, this.musicBus);
        this.nextBeat = t + 1.5 - tension * 0.8;
      }
    } else this.nextBeat = 0;
  }
}
