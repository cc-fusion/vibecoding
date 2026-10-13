// ============ TETRIS ULTIMATE — WEB AUDIO SYNTH ============
// Fully synthesized SFX + adaptive chiptune (Korobeiniki, public-domain folk melody).

const M2F = m => 440 * Math.pow(2, (m - 69) / 12);

// [midi (0 = rest), beats]
const MELODY = [
  [76, 1], [71, .5], [72, .5], [74, 1], [72, .5], [71, .5],
  [69, 1], [69, .5], [72, .5], [76, 1], [74, .5], [72, .5],
  [71, 1.5], [72, .5], [74, 1], [76, 1],
  [72, 1], [69, 1], [69, 1], [0, 1],
  [0, .5], [74, 1], [77, .5], [81, 1], [79, .5], [77, .5],
  [76, 1.5], [72, .5], [76, 1], [74, .5], [72, .5],
  [71, 1], [71, .5], [72, .5], [74, 1], [76, 1],
  [72, 1], [69, 1], [69, 1], [0, 1],
];
const LOOP_BEATS = 32;
const BAR_ROOTS = [45, 40, 45, 45, 38, 45, 40, 45]; // Am E Am Am | Dm Am E Am

// flatten melody into onset map keyed by half-beat step
const MEL_STEPS = {};
{
  let pos = 0;
  for (const [m, b] of MELODY) {
    if (m > 0) MEL_STEPS[Math.round(pos * 2)] = { m, b };
    pos += b;
  }
}

export class AudioEngine {
  constructor(settings) {
    this.s = settings;
    this.ctx = null;
    this.playing = false;
    this.level = 1;
    this.step = 0;
    this.nextStepTime = 0;
    this.muffled = false;
  }

  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.musicG = this.ctx.createGain();
        this.musicG.connect(this.master);
        this.sfxG = this.ctx.createGain();
        this.sfxG.connect(this.master);
        const len = this.ctx.sampleRate | 0;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVolumes();
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.s.muted ? 0 : this.s.master;
    this.musicG.gain.value = this.s.music * (this.muffled ? 0.18 : 1);
    this.sfxG.gain.value = this.s.sfx;
  }

  muffle(on) { this.muffled = on; this.applyVolumes(); }

  tone(o) {
    if (!this.ctx) return;
    const t = o.t || this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.dur || 0.1));
    const v = o.vol || 0.15;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.att || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.1));
    osc.connect(g);
    g.connect(o.music ? this.musicG : this.sfxG);
    osc.start(t);
    osc.stop(t + (o.dur || 0.1) + 0.05);
  }

  noise(o) {
    if (!this.ctx) return;
    const t = o.t || this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const g = this.ctx.createGain();
    const v = o.vol || 0.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (o.dur || 0.08));
    let node = src;
    if (o.lp || o.hp) {
      const f = this.ctx.createBiquadFilter();
      f.type = o.lp ? 'lowpass' : 'highpass';
      f.frequency.value = o.lp || o.hp;
      node.connect(f); node = f;
    }
    node.connect(g);
    g.connect(o.music ? this.musicG : this.sfxG);
    src.start(t);
    src.stop(t + (o.dur || 0.08) + 0.05);
  }

  sfx(name) {
    if (!this.ctx || this.s.muted) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case 'move': this.tone({ f: 220, dur: 0.03, vol: 0.06, type: 'square' }); break;
      case 'rotate': this.tone({ f: 320, f2: 420, dur: 0.05, vol: 0.08 }); break;
      case 'hold': this.tone({ f: 520, f2: 660, dur: 0.07, vol: 0.09, type: 'triangle' }); break;
      case 'softdrop': this.tone({ f: 160, dur: 0.02, vol: 0.04 }); break;
      case 'harddrop':
        this.noise({ dur: 0.08, vol: 0.18, lp: 900 });
        this.tone({ f: 130, f2: 60, dur: 0.09, vol: 0.2, type: 'sine' });
        break;
      case 'lock': this.tone({ f: 180, f2: 140, dur: 0.06, vol: 0.12, type: 'square' }); break;
      case 'clear1': [523, 659, 784].forEach((f, i) => this.tone({ f, t: now + i * 0.05, dur: 0.1, vol: 0.12 })); break;
      case 'clear2': [523, 659, 784, 1047].forEach((f, i) => this.tone({ f, t: now + i * 0.045, dur: 0.11, vol: 0.13 })); break;
      case 'tetris':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ f, t: now + i * 0.05, dur: 0.14, vol: 0.15 }));
        this.noise({ dur: 0.3, vol: 0.1, hp: 2000 });
        break;
      case 'tspin':
        this.tone({ f: 700, f2: 250, dur: 0.18, vol: 0.16, type: 'sawtooth' });
        this.tone({ f: 350, f2: 900, dur: 0.18, vol: 0.1, t: now + 0.06 });
        break;
      case 'pc':
        [659, 784, 988, 1319, 1568, 2093].forEach((f, i) => this.tone({ f, t: now + i * 0.07, dur: 0.2, vol: 0.14, type: 'triangle' }));
        break;
      case 'levelup':
        [440, 554, 659, 880].forEach((f, i) => this.tone({ f, t: now + i * 0.08, dur: 0.15, vol: 0.14, type: 'square' }));
        break;
      case 'garbage':
        this.noise({ dur: 0.25, vol: 0.2, lp: 400 });
        this.tone({ f: 80, f2: 45, dur: 0.25, vol: 0.22, type: 'sine' });
        break;
      case 'warn': this.tone({ f: 880, dur: 0.1, vol: 0.14, type: 'sawtooth' }); this.tone({ f: 880, t: now + 0.15, dur: 0.1, vol: 0.14, type: 'sawtooth' }); break;
      case 'count': this.tone({ f: 440, dur: 0.09, vol: 0.14, type: 'square' }); break;
      case 'go': this.tone({ f: 880, dur: 0.25, vol: 0.16, type: 'square' }); break;
      case 'gameover':
        [392, 330, 262, 196].forEach((f, i) => this.tone({ f, t: now + i * 0.18, dur: 0.3, vol: 0.15, type: 'triangle' }));
        break;
      case 'victory':
        [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone({ f, t: now + i * 0.11, dur: 0.22, vol: 0.14, type: 'square' }));
        break;
      case 'menumove': this.tone({ f: 400, dur: 0.035, vol: 0.06 }); break;
      case 'menuselect': this.tone({ f: 600, f2: 900, dur: 0.08, vol: 0.1 }); break;
      case 'unlock': [660, 880, 1320].forEach((f, i) => this.tone({ f, t: now + i * 0.09, dur: 0.18, vol: 0.13, type: 'triangle' })); break;
      default: break;
    }
  }

  setLevel(l) { this.level = l; }

  startMusic() {
    this.ensure();
    if (!this.ctx) return;
    this.playing = true;
    this.step = 0;
    this.nextStepTime = this.ctx.currentTime + 0.1;
  }

  stopMusic() { this.playing = false; }

  _bpm() { return Math.min(192, 120 + this.level * 4); }
  _intensity() {
    const l = this.level;
    return l < 3 ? 1 : l < 5 ? 2 : l < 8 ? 3 : l < 11 ? 4 : 5;
  }

  _scheduleStep(step, t, stepDur) {
    const inten = this._intensity();
    const beatDur = stepDur * 2;
    // melody
    const mel = MEL_STEPS[step];
    if (mel) {
      this.tone({ f: M2F(mel.m), t, dur: mel.b * beatDur * 0.85, vol: 0.085, type: 'square', music: true });
      if (inten >= 4) this.tone({ f: M2F(mel.m + 12), t: t + stepDur * 0.5, dur: mel.b * beatDur * 0.4, vol: 0.03, type: 'square', music: true });
    }
    // bass
    const bar = Math.floor(step / 8) % 8;
    const root = BAR_ROOTS[bar];
    if (inten >= 2 || step % 2 === 0) {
      this.tone({ f: M2F(step % 2 === 0 ? root : root + 12), t, dur: stepDur * 0.8, vol: 0.09, type: 'triangle', music: true });
    }
    // hats
    if (inten >= 2) this.noise({ t, dur: 0.03, vol: step % 2 === 0 ? 0.035 : 0.02, hp: 6000, music: true });
    // kick
    if (inten >= 3 && step % 2 === 0) this.tone({ f: 140, f2: 45, t, dur: 0.1, vol: 0.2, type: 'sine', music: true });
    // snare
    if (inten >= 5 && (step % 8 === 2 || step % 8 === 6)) this.noise({ t, dur: 0.09, vol: 0.09, hp: 1500, music: true });
  }

  update() {
    if (!this.playing || !this.ctx || this.s.muted) return;
    if (this.nextStepTime < this.ctx.currentTime - 0.5) {
      this.nextStepTime = this.ctx.currentTime + 0.05; // recover after tab blur / mute
    }
    const ahead = this.ctx.currentTime + 0.3;
    let guard = 0;
    while (this.nextStepTime < ahead && guard++ < 64) {
      const stepDur = 30 / this._bpm();
      this._scheduleStep(this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % (LOOP_BEATS * 2);
    }
  }
}
