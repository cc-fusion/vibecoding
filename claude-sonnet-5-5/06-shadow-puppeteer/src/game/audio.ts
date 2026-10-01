// Tiny WebAudio synthesizer for Shadow Puppeteer — no assets required.

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private burnGain: GainNode | null = null;
  private burnFilter: BiquadFilterNode | null = null;
  private timer: number | null = null;
  private nextNote = 0;
  muted = false;
  private ambientOn = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AC: typeof AudioContext =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(ctx.destination);

    // noise buffer
    const len = ctx.sampleRate * 1.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

    // continuous burn sizzle
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    this.burnFilter = ctx.createBiquadFilter();
    this.burnFilter.type = "bandpass";
    this.burnFilter.frequency.value = 3200;
    this.burnFilter.Q.value = 0.8;
    this.burnGain = ctx.createGain();
    this.burnGain.gain.value = 0;
    src.connect(this.burnFilter);
    this.burnFilter.connect(this.burnGain);
    this.burnGain.connect(this.master);
    src.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  startAmbient() {
    if (!this.ctx || !this.master || this.ambientOn) return;
    this.ambientOn = true;
    const ctx = this.ctx;
    const mk = (freq: number, type: OscillatorType, vol: number, lfoRate: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = vol;
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = 420;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = lfoRate;
      const lg = ctx.createGain();
      lg.gain.value = vol * 0.5;
      lfo.connect(lg);
      lg.connect(g.gain);
      o.connect(f);
      f.connect(g);
      g.connect(this.master!);
      o.start();
      lfo.start();
    };
    mk(55, "sawtooth", 0.05, 0.07);
    mk(82.6, "triangle", 0.05, 0.11);
    mk(110.4, "sine", 0.04, 0.05);
    this.nextNote = ctx.currentTime + 1;
    this.timer = window.setInterval(() => this.scheduler(), 300);
  }

  private scheduler() {
    if (!this.ctx || !this.master) return;
    const scale = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];
    while (this.nextNote < this.ctx.currentTime + 0.6) {
      if (Math.random() < 0.65) {
        const f = scale[Math.floor(Math.random() * scale.length)];
        this.tone(f, "sine", 0.045, 2.2, this.nextNote, 0.01);
        if (Math.random() < 0.3) this.tone(f * 1.5, "sine", 0.02, 2.6, this.nextNote + 0.05, 0.01);
      }
      this.nextNote += 1.2 + Math.random() * 1.6;
    }
  }

  stopAmbient() {
    // keep drones running (cheap); just silence the plucks
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.ambientOn = false;
  }

  private tone(freq: number, type: OscillatorType, vol: number, dur: number, when?: number, attack = 0.005, slideTo?: number) {
    if (!this.ctx || !this.master) return;
    const t = when ?? this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(vol: number, dur: number, filterType: BiquadFilterType, f0: number, f1?: number) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  setBurn(amount: number) {
    if (!this.ctx || !this.burnGain || !this.burnFilter) return;
    const a = Math.max(0, Math.min(1, amount));
    this.burnGain.gain.setTargetAtTime(a * 0.12, this.ctx.currentTime, 0.04);
    this.burnFilter.frequency.setTargetAtTime(2200 + a * 2500, this.ctx.currentTime, 0.05);
  }

  sfx(name: string) {
    if (!this.ctx) return;
    switch (name) {
      case "step":
        this.noise(0.06, 0.05, "lowpass", 500);
        break;
      case "jump":
        this.tone(260, "sine", 0.12, 0.18, undefined, 0.005, 620);
        break;
      case "land":
        this.noise(0.12, 0.09, "lowpass", 300);
        this.tone(90, "sine", 0.12, 0.12, undefined, 0.003, 50);
        break;
      case "dash":
        this.noise(0.14, 0.22, "bandpass", 900, 3600);
        break;
      case "shard":
        this.tone(880, "sine", 0.14, 0.5);
        this.tone(1320, "sine", 0.1, 0.7, this.ctx.currentTime + 0.08);
        this.tone(1760, "triangle", 0.05, 0.8, this.ctx.currentTime + 0.16);
        break;
      case "lever":
        this.tone(160, "square", 0.08, 0.08);
        this.tone(110, "square", 0.08, 0.14, this.ctx.currentTime + 0.07);
        this.noise(0.08, 0.3, "bandpass", 2000, 400);
        break;
      case "check":
        this.tone(523, "sine", 0.1, 0.6);
        this.tone(784, "sine", 0.08, 0.9, this.ctx.currentTime + 0.1);
        break;
      case "die":
        this.tone(440, "sawtooth", 0.12, 0.7, undefined, 0.005, 50);
        this.noise(0.2, 0.6, "bandpass", 4000, 300);
        break;
      case "respawn":
        this.tone(330, "sine", 0.1, 0.5, undefined, 0.02, 660);
        break;
      case "lose":
        this.tone(330, "triangle", 0.15, 1.4, undefined, 0.01, 60);
        this.tone(196, "sawtooth", 0.08, 1.8, this.ctx.currentTime + 0.2, 0.01, 40);
        break;
      case "win": {
        const n = [392, 493.9, 587.3, 784, 987.8, 1174.7];
        n.forEach((f, i) => this.tone(f, "triangle", 0.12, 1.2, this.ctx!.currentTime + i * 0.11));
        break;
      }
      case "ui":
        this.tone(660, "sine", 0.07, 0.12);
        break;
      case "warn":
        this.tone(180, "square", 0.04, 0.12);
        break;
    }
  }
}
