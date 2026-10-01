// Tiny WebAudio synthesizer – every sound in the game is generated procedurally.
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: OscillatorNode[] = [];
  muted = false;

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.05);
  }

  startDrone() {
    if (!this.ctx || !this.master || this.drone.length) return;
    const c = this.ctx;
    const g = c.createGain();
    g.gain.value = 0.035;
    g.connect(this.master);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoG = c.createGain();
    lfoG.gain.value = 0.02;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    lfo.start();
    [55, 55.6, 82.4].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.connect(g);
      o.start();
      this.drone.push(o);
    });
    this.drone.push(lfo);
  }

  stopDrone() {
    this.drone.forEach((o) => {
      try {
        o.stop();
      } catch {
        /* already stopped */
      }
    });
    this.drone = [];
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.15, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, vol = 0.15, filter = 1800, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + delay;
    const len = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filter;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t0);
  }

  attack() {
    this.noise(0.1, 0.12, 4000);
    this.tone(320, 0.09, 'sawtooth', 0.06, 120);
  }
  ghostAttack() {
    this.tone(500, 0.06, 'sine', 0.03, 300);
  }
  hit() {
    this.tone(180, 0.12, 'square', 0.12, 70);
    this.noise(0.08, 0.1, 1200);
  }
  kill() {
    this.tone(260, 0.25, 'square', 0.12, 40);
    this.noise(0.2, 0.15, 900);
  }
  hurt() {
    this.tone(150, 0.35, 'sawtooth', 0.2, 40);
    this.noise(0.25, 0.2, 700);
  }
  dash() {
    this.noise(0.15, 0.1, 6000);
    this.tone(700, 0.12, 'sine', 0.05, 1400);
  }
  plate(on: boolean) {
    this.tone(on ? 520 : 330, 0.09, 'triangle', 0.12, on ? 780 : 220);
  }
  door(open: boolean) {
    this.tone(open ? 200 : 300, 0.3, 'sawtooth', 0.07, open ? 420 : 130);
    this.noise(0.25, 0.06, 500);
  }
  shoot() {
    this.tone(880, 0.08, 'square', 0.03, 440);
  }
  rewind() {
    for (let i = 0; i < 9; i++) {
      this.tone(1400 - i * 130, 0.09, 'sawtooth', 0.05, 500 - i * 40, i * 0.05);
    }
    this.noise(0.6, 0.06, 3000);
  }
  echo() {
    this.tone(660, 0.4, 'sine', 0.12, 330);
    this.tone(990, 0.5, 'sine', 0.08, 495, 0.1);
  }
  deny() {
    this.tone(120, 0.15, 'square', 0.1);
    this.tone(90, 0.2, 'square', 0.1, undefined, 0.12);
  }
  select() {
    this.tone(660, 0.07, 'square', 0.07);
    this.tone(880, 0.09, 'square', 0.07, undefined, 0.06);
  }
  clear() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.14, undefined, i * 0.11));
  }
  bossHit() {
    this.tone(90, 0.18, 'square', 0.14, 50);
    this.noise(0.1, 0.12, 2000);
  }
  shield() {
    this.tone(1200, 0.08, 'triangle', 0.05, 1800);
  }
  bossDie() {
    this.noise(1.2, 0.3, 1500);
    this.tone(200, 1.2, 'sawtooth', 0.2, 30);
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, undefined, 0.8 + i * 0.12));
  }
  warn() {
    this.tone(440, 0.12, 'square', 0.06);
    this.tone(330, 0.16, 'square', 0.06, undefined, 0.12);
  }
}

export const sfx = new Sfx();
