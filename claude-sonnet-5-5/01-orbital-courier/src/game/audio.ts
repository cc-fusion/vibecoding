type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle';

class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  thrustGain: GainNode | null = null;
  thrustFilt: BiquadFilterNode | null = null;
  muted = false;
  ambientTimer: number | undefined;
  lastAlarm = 0;

  init() {
    if (!this.ctx) {
      const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
      const AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.55;
      master.connect(ctx.destination);
      this.master = master;

      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      const g = ctx.createGain();
      g.gain.value = 0;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start();
      this.thrustGain = g;
      this.thrustFilt = filt;

      this.startAmbient();
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private startAmbient() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const pad = ctx.createGain();
    pad.gain.value = 0.045;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    pad.connect(lp);
    lp.connect(master);
    [55, 82.41, 110.3].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + i * 0.03;
      const lg = ctx.createGain();
      lg.gain.value = 0.6;
      lfo.connect(lg);
      lg.connect(o.frequency);
      o.connect(pad);
      o.start();
      lfo.start();
    });
    const notes = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
    const tick = () => {
      if (this.ctx) {
        const f = notes[Math.floor(Math.random() * notes.length)];
        this.tone(f, 2.4, 'sine', 0.035);
        if (Math.random() < 0.4) this.tone(f * 1.5, 2.8, 'sine', 0.02, 0, 0.25);
      }
      this.ambientTimer = window.setTimeout(tick, 2200 + Math.random() * 3200);
    };
    tick();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  tone(freq: number, dur: number, type: WaveType = 'sine', vol = 0.15, slideTo = 0, delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, freq: number, vol = 0.2, slideTo = 0, type: BiquadFilterType = 'bandpass', delay = 0) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo > 0) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  setThrust(level: number) {
    if (!this.ctx || !this.thrustGain || !this.thrustFilt) return;
    const t = this.ctx.currentTime;
    this.thrustGain.gain.setTargetAtTime(level * 0.22, t, 0.06);
    this.thrustFilt.frequency.setTargetAtTime(260 + level * 380, t, 0.08);
  }

  click() { this.tone(660, 0.06, 'square', 0.06); }
  accept() { this.tone(440, 0.09, 'triangle', 0.14); this.tone(660, 0.12, 'triangle', 0.14, 0, 0.08); this.tone(880, 0.18, 'triangle', 0.12, 0, 0.16); }
  launch() { this.noise(0.7, 300, 0.35, 2400, 'bandpass'); this.tone(120, 0.5, 'sawtooth', 0.12, 420); }
  dock() { this.tone(523, 0.12, 'sine', 0.16); this.tone(659, 0.12, 'sine', 0.16, 0, 0.1); this.tone(784, 0.25, 'sine', 0.16, 0, 0.2); this.noise(0.25, 900, 0.1, 200, 'lowpass'); }
  cash() { [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.22, 'square', 0.07, 0, i * 0.07)); }
  hit(size = 1) { this.noise(0.35, 500, 0.35 * size, 90, 'lowpass'); this.tone(90, 0.25, 'square', 0.15, 40); }
  crash() { this.noise(0.6, 700, 0.5, 60, 'lowpass'); this.tone(70, 0.5, 'sawtooth', 0.22, 30); }
  explode() { this.noise(1.6, 1200, 0.6, 40, 'lowpass'); this.tone(80, 1.2, 'sawtooth', 0.25, 25); }
  shieldHit() { this.tone(1400, 0.15, 'sine', 0.12, 500); this.noise(0.15, 3000, 0.08, 800, 'highpass'); }
  shieldOn() { this.tone(300, 0.2, 'sine', 0.1, 900); }
  warn() { this.tone(880, 0.12, 'square', 0.09); this.tone(660, 0.12, 'square', 0.09, 0, 0.14); }
  flare() { this.noise(1.1, 200, 0.45, 3500, 'bandpass'); this.tone(60, 1.0, 'sawtooth', 0.14, 200); }
  alarm() {
    const now = performance.now();
    if (now - this.lastAlarm < 600) return;
    this.lastAlarm = now;
    this.tone(1000, 0.18, 'square', 0.07);
  }
  clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.14, 0, i * 0.12)); }
  fail() { [392, 311, 262, 196].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.1, 0, i * 0.18)); }
  buy() { this.tone(660, 0.08, 'square', 0.08); this.tone(990, 0.14, 'square', 0.08, 0, 0.07); }
  deny() { this.tone(180, 0.18, 'square', 0.1); }
  refuel() { this.noise(0.5, 1500, 0.12, 500, 'bandpass'); this.tone(300, 0.4, 'triangle', 0.08, 600); }
}

export const sfx = new Sfx();
