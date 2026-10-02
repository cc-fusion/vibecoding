// Fully synthesized audio: SFX plus generative, state-reactive ambient music.

type Wave = OscillatorType;

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicG: GainNode | null = null;
  sfxG: GainNode | null = null;
  ambG: GainNode | null = null;
  delay: DelayNode | null = null;
  vol = { master: 0.7, music: 0.55, sfx: 0.7, muted: false };
  noiseBuf: AudioBuffer | null = null;

  // music state
  timer: number | null = null;
  nextBeat = 0;
  beat = 0;
  mood = { h: 0, tension: 0, rain: 0, wind: 0.2 };
  drone: { o: OscillatorNode[]; f: BiquadFilterNode; g: GainNode } | null = null;
  windN: { src: AudioBufferSourceNode; g: GainNode; f: BiquadFilterNode } | null = null;
  rainN: { src: AudioBufferSourceNode; g: GainNode } | null = null;
  tensN: { o: OscillatorNode; g: GainNode } | null = null;

  init() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        this.master = ctx.createGain();
        this.musicG = ctx.createGain();
        this.sfxG = ctx.createGain();
        this.ambG = ctx.createGain();
        this.musicG.connect(this.master);
        this.sfxG.connect(this.master);
        this.ambG.connect(this.master);
        this.master.connect(comp);
        comp.connect(ctx.destination);
        this.delay = ctx.createDelay(1);
        this.delay.delayTime.value = 0.42;
        const fb = ctx.createGain();
        fb.gain.value = 0.38;
        const dl = ctx.createBiquadFilter();
        dl.type = 'lowpass';
        dl.frequency.value = 2400;
        this.delay.connect(dl);
        dl.connect(fb);
        fb.connect(this.delay);
        dl.connect(this.musicG);
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.noiseBuf = buf;
        this.applyVolumes();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx || !this.master || !this.musicG || !this.sfxG || !this.ambG) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.05);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.6, t, 0.05);
    this.ambG.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  tone(freq: number, dur: number, type: Wave = 'sine', vol = 0.2, slideTo?: number, delay = 0, dest?: AudioNode, attack = 0.005) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxG) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest ?? this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, ftype: BiquadFilterType, f0: number, vol = 0.2, f1?: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxG || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = ftype;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.sfxG);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  sfx(name: string) {
    if (!this.ctx || this.vol.muted) return;
    switch (name) {
      case 'click': this.tone(880, 0.05, 'square', 0.08); break;
      case 'tab': this.tone(520, 0.05, 'triangle', 0.1); this.tone(780, 0.06, 'triangle', 0.08, undefined, 0.04); break;
      case 'build':
        this.tone(180, 0.14, 'triangle', 0.22, 360);
        this.tone(660, 0.12, 'sine', 0.12, undefined, 0.07);
        this.noise(0.1, 'lowpass', 900, 0.12);
        break;
      case 'error': this.tone(150, 0.2, 'sawtooth', 0.14, 85); break;
      case 'demolish': this.noise(0.28, 'lowpass', 700, 0.25, 160); this.tone(130, 0.25, 'sine', 0.2, 45); break;
      case 'research': [523, 659, 784, 1047].forEach((f, k) => this.tone(f, 0.28, 'triangle', 0.14, undefined, k * 0.07)); break;
      case 'milestone':
        [392, 523, 659, 784, 1047].forEach((f, k) => { this.tone(f, 0.5, 'sine', 0.16, undefined, k * 0.08); this.tone(f * 2, 0.4, 'triangle', 0.05, undefined, k * 0.08); });
        break;
      case 'stage':
        [262, 330, 392, 523, 659].forEach((f, k) => this.tone(f, 1.1, 'sine', 0.15, undefined, k * 0.12));
        this.noise(1.2, 'highpass', 3000, 0.04);
        break;
      case 'warn': this.tone(620, 0.16, 'square', 0.1); this.tone(460, 0.22, 'square', 0.1, undefined, 0.18); break;
      case 'alarm': for (let k = 0; k < 4; k++) this.tone(k % 2 ? 480 : 720, 0.18, 'sawtooth', 0.11, undefined, k * 0.2); break;
      case 'impact':
        this.noise(0.9, 'lowpass', 500, 0.5, 60);
        this.tone(80, 0.8, 'sine', 0.5, 24);
        this.tone(40, 1.0, 'sine', 0.35, 20, 0.05);
        break;
      case 'comet': this.noise(1.2, 'bandpass', 3500, 0.2, 250); this.tone(900, 1.1, 'sawtooth', 0.05, 120); break;
      case 'rumble': this.noise(1.8, 'lowpass', 140, 0.5, 50); this.tone(48, 1.8, 'sawtooth', 0.15, 30); break;
      case 'seed': this.tone(380, 0.18, 'sine', 0.15, 820); this.tone(990, 0.14, 'sine', 0.08, undefined, 0.12); break;
      case 'lance': this.tone(1500, 0.22, 'sawtooth', 0.12, 160); this.noise(0.15, 'highpass', 4000, 0.1); break;
      case 'cloud': this.noise(0.8, 'bandpass', 1200, 0.15, 400); break;
      case 'fire': this.noise(0.7, 'highpass', 2500, 0.12); this.noise(0.5, 'lowpass', 400, 0.12); break;
      case 'win': [262, 330, 392, 523, 659, 784, 1047].forEach((f, k) => { this.tone(f, 1.4, 'triangle', 0.17, undefined, k * 0.14); this.tone(f / 2, 1.6, 'sine', 0.1, undefined, k * 0.14); }); break;
      case 'lose': [392, 349, 311, 262, 196].forEach((f, k) => this.tone(f, 1.0, 'sawtooth', 0.09, f * 0.97, k * 0.28)); this.noise(2, 'lowpass', 300, 0.1, 60); break;
      default: break;
    }
  }

  setMood(h: number, tension: number, rain: number, wind: number) {
    this.mood = { h, tension, rain, wind };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.drone) {
      this.drone.f.frequency.setTargetAtTime(220 + h * 1800, t, 0.8);
      this.drone.g.gain.setTargetAtTime(0.09 + 0.05 * (1 - h), t, 0.8);
    }
    if (this.windN) {
      this.windN.g.gain.setTargetAtTime(clamp01(wind) * 0.22, t, 0.6);
      this.windN.f.frequency.setTargetAtTime(300 + wind * 900, t, 0.6);
    }
    if (this.rainN) this.rainN.g.gain.setTargetAtTime(clamp01(rain) * 0.2, t, 0.6);
    if (this.tensN) this.tensN.g.gain.setTargetAtTime(clamp01(tension) * 0.12, t, 0.5);
  }

  startMusic() {
    this.init();
    const ctx = this.ctx;
    if (!ctx || !this.musicG || !this.ambG || !this.noiseBuf) return;
    this.stopMusic();
    // drone: two detuned saws through a lowpass
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 300;
    const g = ctx.createGain();
    g.gain.value = 0.12;
    const os = [55, 55.4, 82.5].map((fr) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.connect(f);
      o.start();
      return o;
    });
    f.connect(g);
    g.connect(this.musicG);
    this.drone = { o: os, f, g };
    // wind
    const mkNoise = (ftype: BiquadFilterType, freq: number) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const fl = ctx.createBiquadFilter();
      fl.type = ftype;
      fl.frequency.value = freq;
      const gn = ctx.createGain();
      gn.gain.value = 0;
      src.connect(fl);
      fl.connect(gn);
      gn.connect(this.ambG as GainNode);
      src.start(0, Math.random());
      return { src, g: gn, f: fl };
    };
    this.windN = mkNoise('bandpass', 500);
    const r = mkNoise('highpass', 3500);
    this.rainN = { src: r.src, g: r.g };
    // tension pulse
    const to = ctx.createOscillator();
    to.type = 'sawtooth';
    to.frequency.value = 41;
    const tl = ctx.createBiquadFilter();
    tl.type = 'lowpass';
    tl.frequency.value = 160;
    const tg = ctx.createGain();
    tg.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.6;
    const lg = ctx.createGain();
    lg.gain.value = 0.04;
    lfo.connect(lg);
    lg.connect(tg.gain);
    to.connect(tl);
    tl.connect(tg);
    tg.connect(this.musicG);
    to.start();
    lfo.start();
    this.tensN = { o: to, g: tg };
    this.drone.o.push(lfo);
    this.nextBeat = ctx.currentTime + 0.2;
    this.beat = 0;
    this.timer = window.setInterval(() => this.schedule(), 200);
    this.applyVolumes();
    this.setMood(this.mood.h, this.mood.tension, this.mood.rain, this.mood.wind);
  }

  stopMusic() {
    if (this.timer !== null) { window.clearInterval(this.timer); this.timer = null; }
    const stop = (n?: AudioScheduledSourceNode) => { try { n?.stop(); } catch { /* already stopped */ } };
    this.drone?.o.forEach(stop);
    stop(this.windN?.src);
    stop(this.rainN?.src);
    stop(this.tensN?.o);
    this.drone = null; this.windN = null; this.rainN = null; this.tensN = null;
  }

  schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.musicG) return;
    const spb = 0.55 - this.mood.h * 0.12;
    while (this.nextBeat < ctx.currentTime + 1.2) {
      this.playBeat(this.nextBeat, this.beat);
      this.nextBeat += spb;
      this.beat++;
    }
  }

  note(freq: number, t: number, dur: number, type: Wave, vol: number, wet = false, attack = 0.01) {
    const ctx = this.ctx;
    if (!ctx || !this.musicG) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.musicG);
    if (wet && this.delay) g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  playBeat(t: number, beat: number) {
    const h = this.mood.h;
    const minor = [0, 3, 7, 10, 14];
    const major = [0, 4, 7, 11, 14];
    const prog = h < 0.35 ? [0, -4, -2, -5] : [0, -3, -7, -5];
    const bar = Math.floor(beat / 8) % prog.length;
    const root = 110 * Math.pow(2, prog[bar] / 12);
    const chord = h < 0.4 ? minor : major;
    const f = (semi: number, oct = 1) => root * oct * Math.pow(2, semi / 12);
    if (beat % 8 === 0) {
      chord.slice(0, 4).forEach((s, k) => this.note(f(s), t + k * 0.04, 4.2, 'triangle', 0.05 + h * 0.03, false, 1.4));
      this.note(f(0, 0.5), t, 4.4, 'sine', 0.09, false, 0.6);
    }
    const pent = h < 0.4 ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14];
    if (h > 0.08 && beat % 2 === 0 && Math.random() < 0.25 + h * 0.6) {
      const s = pent[Math.floor(Math.random() * pent.length)];
      this.note(f(s, 2), t, 1.2, 'sine', 0.05 + h * 0.04, true, 0.005);
    }
    if (h > 0.45 && Math.random() < (h - 0.4) * 0.35) {
      const base = 2200 + Math.random() * 1400;
      const ctx = this.ctx;
      if (ctx && this.musicG) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.08);
        o.frequency.exponentialRampToValueAtTime(base * 1.1, t + 0.18);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.025, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g);
        g.connect(this.musicG);
        o.start(t);
        o.stop(t + 0.3);
      }
    }
    if (this.mood.tension > 0.3 && beat % 2 === 0) this.note(55, t, 0.3, 'square', 0.05 * this.mood.tension);
  }

  dispose() {
    this.stopMusic();
  }
}

function clamp01(v: number) { return v < 0 ? 0 : v > 1 ? 1 : v; }

export const audio = new AudioEngine();
