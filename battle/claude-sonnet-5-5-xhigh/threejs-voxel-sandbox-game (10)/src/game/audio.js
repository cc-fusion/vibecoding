// Fully synthesised audio: block/foot/creature SFX, ambience (rain, wind, caves, birds) and generative music.
import { DEFS } from './blocks.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const SOUND_MAT = {
  stone: { f0: 1100, f1: 380, type: 'bandpass', dur: 0.2, q: 0.8, tone: [190, 80, 'square'], vol: 1 },
  wood: { f0: 520, f1: 220, type: 'lowpass', dur: 0.16, q: 1, tone: [150, 85, 'sine'], vol: 1.2 },
  grass: { f0: 2800, f1: 1500, type: 'highpass', dur: 0.16, q: 0.5, vol: 0.55 },
  sand: { f0: 1900, f1: 900, type: 'bandpass', dur: 0.2, q: 0.6, vol: 0.6 },
  gravel: { f0: 1300, f1: 500, type: 'bandpass', dur: 0.22, q: 0.7, tone: [120, 70, 'square'], vol: 0.8 },
  glass: { f0: 3500, f1: 2400, type: 'highpass', dur: 0.22, q: 2, ring: true, vol: 0.7 },
  cloth: { f0: 500, f1: 300, type: 'lowpass', dur: 0.14, q: 0.5, vol: 0.5 },
  snow: { f0: 3200, f1: 1800, type: 'bandpass', dur: 0.14, q: 0.5, vol: 0.5 },
  water: { f0: 700, f1: 1800, type: 'bandpass', dur: 0.3, q: 3, vol: 0.5 },
};

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.ready = false;
    this.listener = { x: 0, y: 0, z: 0, rx: 1, rz: 0 };
    this.musicTimer = 20;
    this.dripTimer = 6;
    this.birdTimer = 5;
    this.playing = 0;
    this.last = {};
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this.build();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass'; this.lp.frequency.value = 22000;
    this.lp.connect(this.master); this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.connect(this.lp);
    this.music = ctx.createGain(); this.music.connect(this.lp);
    this.amb = ctx.createGain(); this.amb.connect(this.lp);
    // noise buffer
    const len = ctx.sampleRate * 3;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // reverb impulse
    const ir = ctx.createBuffer(2, ctx.sampleRate * 3, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 2.8);
    }
    this.reverb = ctx.createConvolver(); this.reverb.buffer = ir;
    this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.music);
    // looping ambient beds
    const loopNoise = (type, f, q) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(g); g.connect(this.amb); s.start(0, Math.random() * 2);
      return { g, fl };
    };
    this.rainBed = loopNoise('bandpass', 3200, 0.4);
    this.windBed = loopNoise('bandpass', 420, 0.7);
    this.underBed = loopNoise('lowpass', 260, 0.7);
    this.caveBed = loopNoise('lowpass', 110, 1.2);
    this.applySettings();
  }

  applySettings() {
    if (!this.ctx) return;
    const s = this.settings;
    this.master.gain.value = s.master;
    this.sfx.gain.value = s.sfx;
    this.amb.gain.value = s.sfx;
    this.music.gain.value = s.music * 0.9;
  }

  setListener(x, y, z, rx, rz) { Object.assign(this.listener, { x, y, z, rx, rz }); }
  setUnderwater(on) {
    if (!this.ctx) return;
    this.lp.frequency.setTargetAtTime(on ? 520 : 22000, this.ctx.currentTime, 0.08);
  }

  // output node for a (possibly positional) sound; returns null if inaudible
  out(pos, vol = 1) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let v = vol;
    if (pos) {
      const l = this.listener;
      const dx = pos[0] - l.x, dy = pos[1] - l.y, dz = pos[2] - l.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 48) return null;
      v *= 1 / (1 + dist * 0.16);
      if (ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-0.9, Math.min(0.9, (dx * l.rx + dz * l.rz) / Math.max(dist, 1)));
        g.connect(p); p.connect(this.sfx);
      } else g.connect(this.sfx);
    } else g.connect(this.sfx);
    g.gain.value = v;
    return g;
  }

  burst(dest, { type = 'bandpass', f0 = 1000, f1 = 500, q = 1, dur = 0.2, gain = 1, attack = 0.005, delay = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(20, f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
  }

  tone(dest, { type = 'sine', f0 = 440, f1 = null, dur = 0.2, gain = 0.3, attack = 0.005, delay = 0, vib = 0, lp = 0 }) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); node = f; }
    node.connect(g); g.connect(dest);
    if (vib) {
      const l = ctx.createOscillator(); l.frequency.value = vib; const lg = ctx.createGain(); lg.gain.value = f0 * 0.05;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    o.start(t); o.stop(t + dur + 0.05);
  }

  matSound(mat, kind, pos, vol = 1) {
    const m = SOUND_MAT[mat] || SOUND_MAT.stone;
    const k = kind === 'step' ? 0.35 : kind === 'place' ? 0.75 : 1;
    const o = this.out(pos, vol * k * (m.vol || 1) * 0.8);
    if (!o) return;
    const p = rnd(0.88, 1.12) * (kind === 'place' ? 0.9 : 1);
    const dur = m.dur * (kind === 'step' ? 0.55 : 1);
    this.burst(o, { type: m.type, f0: m.f0 * p, f1: m.f1 * p, q: m.q, dur, gain: 1 });
    if (m.tone && kind !== 'step') this.tone(o, { type: m.tone[2], f0: m.tone[0] * p, f1: m.tone[1], dur: dur * 0.8, gain: 0.5 });
    if (m.ring) for (let i = 0; i < 3; i++) this.tone(o, { f0: rnd(2200, 4200), dur: 0.18, gain: 0.12, delay: i * 0.025 });
  }

  blockSound(id, kind, pos, vol = 1) {
    if (!this.ctx) return;
    const d = DEFS[id];
    this.matSound(d ? d.sound : 'stone', kind, pos, vol);
  }

  play(name, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this.last[name] && now - this.last[name] < 0.04) return;
    this.last[name] = now;
    const o = this.out(opts.pos || null, opts.vol === undefined ? 1 : opts.vol);
    if (!o) return;
    const p = (opts.pitch || 1) * rnd(0.94, 1.06);
    switch (name) {
      case 'hurt':
        this.tone(o, { type: 'sawtooth', f0: 260 * p, f1: 110, dur: 0.28, gain: 0.35, lp: 1400 });
        this.burst(o, { type: 'lowpass', f0: 900, f1: 200, dur: 0.2, gain: 0.5 });
        break;
      case 'death':
        this.tone(o, { type: 'sawtooth', f0: 200, f1: 50, dur: 0.7, gain: 0.4, lp: 800 });
        this.burst(o, { type: 'lowpass', f0: 600, f1: 80, dur: 0.6, gain: 0.5 });
        break;
      case 'hit':
        this.burst(o, { type: 'lowpass', f0: 700 * p, f1: 150, dur: 0.12, gain: 0.9 });
        this.tone(o, { f0: 140, f1: 60, dur: 0.1, gain: 0.5 });
        break;
      case 'crit':
        this.burst(o, { type: 'highpass', f0: 2500, f1: 4000, dur: 0.18, gain: 0.5 });
        this.tone(o, { type: 'triangle', f0: 900, f1: 1500, dur: 0.12, gain: 0.25 });
        break;
      case 'eat':
        for (let i = 0; i < 3; i++) this.burst(o, { type: 'bandpass', f0: rnd(1800, 2800), f1: 900, q: 2, dur: 0.07, gain: 0.8, delay: i * 0.11 });
        break;
      case 'burp': this.tone(o, { type: 'sawtooth', f0: 110, f1: 70, dur: 0.35, gain: 0.3, lp: 500 }); break;
      case 'pickup': this.tone(o, { f0: 500 * p, f1: 1100 * p, dur: 0.11, gain: 0.25 }); break;
      case 'click': this.tone(o, { type: 'square', f0: 900, f1: 600, dur: 0.035, gain: 0.08 }); break;
      case 'craft': this.burst(o, { type: 'bandpass', f0: 900, f1: 500, q: 2, dur: 0.06, gain: 0.5 }); this.tone(o, { f0: 700, f1: 900, dur: 0.07, gain: 0.12, delay: 0.05 }); break;
      case 'explode':
        this.burst(o, { type: 'lowpass', f0: 1400, f1: 50, dur: 1.5, gain: 1.4, attack: 0.01 });
        this.tone(o, { f0: 90, f1: 28, dur: 1.2, gain: 0.9 });
        break;
      case 'fuse': this.burst(o, { type: 'highpass', f0: 3500, f1: 6000, dur: 1.3, gain: 0.18, attack: 0.1 }); break;
      case 'hiss': this.burst(o, { type: 'highpass', f0: 2500, f1: 5000, dur: 1.3, gain: 0.3, attack: 0.15 }); break;
      case 'splash':
        this.burst(o, { type: 'bandpass', f0: 500, f1: 2600, q: 1.5, dur: 0.4, gain: 0.9 });
        this.burst(o, { type: 'lowpass', f0: 900, f1: 200, dur: 0.3, gain: 0.5 });
        break;
      case 'swim': this.burst(o, { type: 'bandpass', f0: 900, f1: 1600, q: 2, dur: 0.18, gain: 0.35 }); break;
      case 'bubble': this.tone(o, { f0: rnd(500, 800), f1: rnd(1000, 1600), dur: 0.08, gain: 0.12 }); break;
      case 'pig':
        this.tone(o, { type: 'square', f0: 240 * p, f1: 150 * p, dur: 0.22, gain: 0.16, lp: 900, vib: 25 });
        this.tone(o, { type: 'square', f0: 260 * p, f1: 160 * p, dur: 0.16, gain: 0.12, lp: 900, delay: 0.2, vib: 25 });
        break;
      case 'cow': this.tone(o, { type: 'sawtooth', f0: 120 * p, f1: 85 * p, dur: 0.85, gain: 0.25, lp: 600, vib: 5, attack: 0.08 }); break;
      case 'sheep': this.tone(o, { type: 'sawtooth', f0: 420 * p, f1: 330 * p, dur: 0.6, gain: 0.15, lp: 1400, vib: 22, attack: 0.04 }); break;
      case 'chicken':
        for (let i = 0; i < 2; i++) this.tone(o, { type: 'square', f0: 900 * p, f1: 650, dur: 0.07, gain: 0.1, delay: i * 0.1, lp: 2500 });
        break;
      case 'zombie':
        this.tone(o, { type: 'sawtooth', f0: 95 * p, f1: 62, dur: 0.9, gain: 0.3, lp: 420, vib: 7, attack: 0.1 });
        this.burst(o, { type: 'bandpass', f0: 300, f1: 160, q: 2, dur: 0.7, gain: 0.25 });
        break;
      case 'skeleton':
        for (let i = 0; i < 4; i++) this.burst(o, { type: 'highpass', f0: 3000, f1: 2000, dur: 0.04, gain: 0.5, delay: i * 0.045 });
        break;
      case 'bow': this.tone(o, { type: 'triangle', f0: 240, f1: 120, dur: 0.12, gain: 0.3 }); this.burst(o, { type: 'bandpass', f0: 2000, f1: 700, dur: 0.14, gain: 0.3 }); break;
      case 'thunder':
        this.burst(o, { type: 'lowpass', f0: 500, f1: 60, dur: 4.2, gain: 1.2, attack: 0.15 });
        this.burst(o, { type: 'lowpass', f0: 300, f1: 50, dur: 3, gain: 0.8, attack: 0.5, delay: 0.5 });
        break;
      case 'achievement':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(o, { type: 'triangle', f0: f, dur: 0.5, gain: 0.18, delay: i * 0.1 }));
        break;
      case 'levelup': [392, 523, 659].forEach((f, i) => this.tone(o, { f0: f, dur: 0.3, gain: 0.15, delay: i * 0.08 })); break;
      case 'drip':
        this.tone(o, { f0: 1500, f1: 900, dur: 0.1, gain: 0.2 });
        this.tone(o, { f0: 1500, f1: 900, dur: 0.12, gain: 0.08, delay: 0.18 });
        break;
      case 'lava': this.burst(o, { type: 'lowpass', f0: 400, f1: 120, dur: 0.15, gain: 0.5 }); break;
      case 'door': this.tone(o, { type: 'square', f0: 120, f1: 80, dur: 0.1, gain: 0.2, lp: 500 }); break;
      case 'sleep': this.tone(o, { f0: 330, f1: 220, dur: 1.2, gain: 0.1, attack: 0.3 }); break;
      case 'ignite': this.burst(o, { type: 'bandpass', f0: 3000, f1: 1500, q: 2, dur: 0.12, gain: 0.5 }); this.tone(o, { type: 'square', f0: 1800, f1: 900, dur: 0.05, gain: 0.1 }); break;
      case 'break_tool': this.burst(o, { type: 'highpass', f0: 2000, f1: 900, dur: 0.15, gain: 0.8 }); this.tone(o, { type: 'square', f0: 300, f1: 100, dur: 0.12, gain: 0.2 }); break;
      default: break;
    }
  }

  // ---- continuous ambience & music ---------------------------------------------------------
  // env: {rain (0..1), outdoors (0..1), underwater, altitude, underground (bool), day (0..1), grassy (bool), playerPos}
  updateAmbient(dt, env) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const sm = (p, v) => p.g.gain.setTargetAtTime(v, t, 0.3);
    sm(this.rainBed, env.rain * env.outdoors * 0.22 + env.rain * (1 - env.outdoors) * 0.04);
    this.rainBed.fl.frequency.setTargetAtTime(env.outdoors > 0.5 ? 3200 : 1200, t, 0.3);
    const windAmt = (0.025 + Math.max(0, (env.altitude - 55) / 70) * 0.12 + env.rain * 0.05) * env.outdoors;
    sm(this.windBed, windAmt * (0.75 + 0.25 * Math.sin(t * 0.37) * Math.sin(t * 0.91)));
    this.windBed.fl.frequency.setTargetAtTime(360 + 220 * (0.5 + 0.5 * Math.sin(t * 0.23)), t, 0.5);
    sm(this.underBed, env.underwater ? 0.22 : 0);
    sm(this.caveBed, env.underground ? 0.16 : 0);
    // drips
    if (env.underground) {
      this.dripTimer -= dt;
      if (this.dripTimer <= 0) { this.dripTimer = rnd(3, 11); this.play('drip', { vol: 0.5, pos: [env.pos[0] + rnd(-6, 6), env.pos[1], env.pos[2] + rnd(-6, 6)] }); }
    }
    // birdsong by day / crickets by night on grassland
    if (env.grassy && env.outdoors > 0.6 && env.rain < 0.2 && !env.underwater) {
      this.birdTimer -= dt;
      if (this.birdTimer <= 0) {
        this.birdTimer = rnd(4, 12);
        const o = this.out([env.pos[0] + rnd(-12, 12), env.pos[1] + rnd(2, 8), env.pos[2] + rnd(-12, 12)], 0.4);
        if (o) {
          if (env.day > 0.5) {
            const base = rnd(2600, 4200), n = 2 + ((Math.random() * 4) | 0);
            for (let i = 0; i < n; i++) this.tone(o, { f0: base * rnd(0.9, 1.15), f1: base * rnd(1.1, 1.5), dur: 0.08, gain: 0.07, delay: i * rnd(0.09, 0.14) });
          } else {
            for (let i = 0; i < 12; i++) this.tone(o, { f0: 4300, dur: 0.03, gain: 0.025, delay: i * 0.055 });
          }
        }
      }
    }
    // music
    this.musicTimer -= dt;
    if (this.musicTimer <= 0 && !env.underwater && this.settings.music > 0.01) {
      this.musicTimer = rnd(110, 260);
      this.playTrack(env);
    }
  }

  playTrack(env) {
    const ctx = this.ctx;
    const dark = env.day < 0.3 || env.underground;
    const roots = dark ? [110, 98, 123.47, 82.41] : [146.83, 164.81, 130.81, 174.61, 196];
    const root = roots[(Math.random() * roots.length) | 0];
    const scale = dark ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14, 16];
    const f = (deg, oct = 0) => root * Math.pow(2, (scale[deg] + oct * 12) / 12);
    const dur = rnd(26, 42);
    const t0 = ctx.currentTime + 0.5;
    const dest = ctx.createGain(); dest.gain.value = 1; dest.connect(this.music); dest.connect(this.reverb);
    const pad = (freq, start, len, vol) => {
      for (const det of [-5, 6]) {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq; o.detune.value = det;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 900;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0 + start);
        g.gain.linearRampToValueAtTime(vol, t0 + start + len * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t0 + start + len);
        o.connect(fl); fl.connect(g); g.connect(dest);
        o.start(t0 + start); o.stop(t0 + start + len + 0.1);
      }
    };
    const piano = (freq, start, vol) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.linearRampToValueAtTime(vol, t0 + start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 3.2);
      g.connect(dest);
      [[1, 'sine', 1], [2, 'sine', 0.28], [3, 'triangle', 0.1]].forEach(([m, type, a]) => {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * m;
        const ga = ctx.createGain(); ga.gain.value = a;
        o.connect(ga); ga.connect(g); o.start(t0 + start); o.stop(t0 + start + 3.3);
      });
    };
    // chords every ~7s
    const chordDegs = [[0, 2, 4], [3, 5, 7], [1, 3, 5], [4, 6, 8]];
    let ci = 0;
    for (let s = 0; s < dur; s += 7) {
      const ch = chordDegs[ci++ % chordDegs.length];
      ch.forEach((d, k) => pad(f(d % scale.length, d >= scale.length ? 1 : 0) / 2, s + k * 0.05, 9, 0.035));
    }
    let time = 0, deg = (Math.random() * 4) | 0;
    while (time < dur - 3) {
      if (Math.random() < 0.72) {
        deg = Math.max(0, Math.min(scale.length - 1, deg + ((Math.random() * 5) | 0) - 2));
        piano(f(deg, dark ? 0 : 1), time, rnd(0.07, 0.12));
        if (Math.random() < 0.18) piano(f((deg + 2) % scale.length, dark ? 0 : 1), time + 0.02, 0.05);
      }
      time += [1.1, 1.6, 2.2, 3.0][(Math.random() * 4) | 0] * (dark ? 1.35 : 1);
    }
  }
}
