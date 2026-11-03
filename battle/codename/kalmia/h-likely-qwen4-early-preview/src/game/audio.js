// Procedural WebAudio: SFX synthesis, ambient wind/rain, gentle generative music.
import { B } from './blocks.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.8;
    this.musicOn = true;
    this.musicTimer = 0;
    this.ambient = null;
    this.rainGain = null;
  }

  init() {
    if (this.ctx) { this.ctx.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.startAmbient();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  noiseBuffer() {
    if (this._nb) return this._nb;
    const len = this.ctx.sampleRate * 1.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._nb = buf;
    return buf;
  }

  tone({ freq = 440, end = freq, dur = 0.15, type = 'sine', vol = 0.2, delay = 0, attack = 0.005 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(this.master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  noise({ dur = 0.15, vol = 0.25, freq = 1000, q = 1, type = 'bandpass', end = freq, delay = 0 }) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0); f.Q.value = q;
    if (end !== freq) f.frequency.exponentialRampToValueAtTime(Math.max(30, end), t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  startAmbient() {
    // wind: looped filtered noise
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(); src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.4;
    const g = this.ctx.createGain(); g.gain.value = 0.025;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this.ambient = { src, filter: f, gain: g };
    // rain layer
    const rsrc = this.ctx.createBufferSource();
    rsrc.buffer = this.noiseBuffer(); rsrc.loop = true; rsrc.playbackRate.value = 1.4;
    const rf = this.ctx.createBiquadFilter();
    rf.type = 'highpass'; rf.frequency.value = 1400;
    const rg = this.ctx.createGain(); rg.gain.value = 0;
    rsrc.connect(rf); rf.connect(rg); rg.connect(this.master);
    rsrc.start();
    this.rainGain = rg;
  }

  // called each frame
  update(dt, { rain = 0, altitude = 50, night = false }) {
    if (!this.ctx) return;
    if (this.ambient) {
      const target = 0.015 + Math.max(0, altitude - 55) * 0.0012;
      this.ambient.gain.gain.value += (target - this.ambient.gain.gain.value) * dt * 2;
      this.ambient.filter.frequency.value = 280 + Math.sin(performance.now() * 0.0003) * 120;
    }
    if (this.rainGain) {
      const target = rain * 0.11;
      this.rainGain.gain.value += (target - this.rainGain.gain.value) * dt * 1.5;
    }
    // generative music: sparse pentatonic plucks
    if (this.musicOn) {
      this.musicTimer -= dt;
      if (this.musicTimer <= 0) {
        this.musicTimer = 2.5 + Math.random() * 5;
        this.playMusicNote(night);
      }
    }
    // occasional birds by day / crickets at night
    this.natureTimer = (this.natureTimer ?? 6) - dt;
    if (this.natureTimer <= 0 && rain < 0.3) {
      this.natureTimer = 7 + Math.random() * 14;
      if (night) {
        for (let i = 0; i < 4; i++) this.tone({ freq: 4200, dur: 0.04, vol: 0.012, type: 'sine', delay: i * 0.09 });
      } else {
        const f = 2200 + Math.random() * 1200;
        this.tone({ freq: f, end: f * 1.4, dur: 0.09, vol: 0.02, type: 'sine' });
        this.tone({ freq: f * 1.1, end: f * 0.9, dur: 0.08, vol: 0.016, type: 'sine', delay: 0.14 });
      }
    }
  }

  playMusicNote(night) {
    const scale = night ? [220, 261.6, 293.7, 329.6, 392] : [261.6, 293.7, 329.6, 392, 440, 523.3];
    const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 0.5 : 1);
    const dur = 2.2 + Math.random() * 1.6;
    this.tone({ freq: f, dur, vol: 0.035, type: 'sine', attack: 0.08 });
    this.tone({ freq: f * 2, dur: dur * 0.7, vol: 0.012, type: 'sine', attack: 0.1 });
    if (Math.random() < 0.4) this.tone({ freq: f * 1.5, dur, vol: 0.02, type: 'sine', attack: 0.12, delay: 0.4 });
  }

  // ---------- named SFX ----------
  step(blockId) {
    const soft = [B.GRASS, B.DIRT, B.SAND, B.SNOW, B.SNOW_GRASS, B.GRAVEL, B.LEAVES].includes(blockId);
    const wool = blockId === B.WOOL;
    if (wool) return;
    this.noise({
      dur: 0.07, vol: soft ? 0.09 : 0.07,
      freq: soft ? 700 + Math.random() * 300 : 1300 + Math.random() * 500,
      q: 0.8, type: soft ? 'lowpass' : 'bandpass',
    });
  }

  dig(blockId) {
    this.noise({ dur: 0.06, vol: 0.07, freq: 900 + Math.random() * 400, q: 1 });
  }

  breakBlock(blockId) {
    const glass = blockId === B.GLASS;
    this.noise({ dur: glass ? 0.3 : 0.18, vol: 0.28, freq: glass ? 3200 : 800, end: glass ? 1800 : 300, q: 0.7, type: glass ? 'highpass' : 'lowpass' });
    if (!glass) this.tone({ freq: 180, end: 90, dur: 0.12, vol: 0.1, type: 'triangle' });
  }

  place() {
    this.noise({ dur: 0.08, vol: 0.2, freq: 1000, end: 400, type: 'lowpass' });
    this.tone({ freq: 260, end: 180, dur: 0.07, vol: 0.08, type: 'triangle' });
  }

  hurt() {
    this.tone({ freq: 320, end: 130, dur: 0.22, vol: 0.22, type: 'sawtooth' });
    this.noise({ dur: 0.12, vol: 0.1, freq: 500, type: 'lowpass' });
  }

  eat() {
    for (let i = 0; i < 3; i++) this.noise({ dur: 0.07, vol: 0.14, freq: 800 + i * 150, q: 2, delay: i * 0.16 });
  }

  splash() {
    this.noise({ dur: 0.4, vol: 0.24, freq: 1400, end: 500, type: 'lowpass' });
  }

  pickup() {
    this.tone({ freq: 620, end: 940, dur: 0.09, vol: 0.1, type: 'sine' });
    this.tone({ freq: 940, end: 1240, dur: 0.08, vol: 0.07, type: 'sine', delay: 0.06 });
  }

  craft() {
    this.noise({ dur: 0.06, vol: 0.12, freq: 1600, q: 2 });
    this.tone({ freq: 520, end: 660, dur: 0.1, vol: 0.08, type: 'triangle', delay: 0.03 });
  }

  achievement() {
    const notes = [523.3, 659.3, 784, 1046.5];
    notes.forEach((f, i) => this.tone({ freq: f, dur: 0.35, vol: 0.09, type: 'triangle', delay: i * 0.09 }));
  }

  hit() {
    this.noise({ dur: 0.09, vol: 0.18, freq: 600, end: 250, type: 'lowpass' });
  }

  mobHurt(kind) {
    if (kind === 'pig') this.tone({ freq: 480, end: 280, dur: 0.18, vol: 0.12, type: 'square' });
    else if (kind === 'sheep') this.tone({ freq: 380, end: 300, dur: 0.3, vol: 0.1, type: 'sawtooth' });
    else this.tone({ freq: 140, end: 80, dur: 0.35, vol: 0.16, type: 'sawtooth' });
  }

  mobAmbient(kind) {
    if (kind === 'pig') {
      this.tone({ freq: 420, end: 330, dur: 0.1, vol: 0.05, type: 'square' });
      this.tone({ freq: 460, end: 340, dur: 0.09, vol: 0.045, type: 'square', delay: 0.13 });
    } else if (kind === 'sheep') {
      this.tone({ freq: 360, end: 320, dur: 0.4, vol: 0.04, type: 'sawtooth' });
    } else {
      this.tone({ freq: 110, end: 70, dur: 0.6, vol: 0.07, type: 'sawtooth' });
    }
  }

  zombieAttack() {
    this.tone({ freq: 160, end: 90, dur: 0.25, vol: 0.16, type: 'sawtooth' });
  }

  thunder() {
    this.noise({ dur: 1.6, vol: 0.4, freq: 220, end: 60, type: 'lowpass', q: 0.5 });
    this.noise({ dur: 0.4, vol: 0.25, freq: 900, end: 200, type: 'lowpass', delay: 0.08 });
  }

  furnace() {
    this.noise({ dur: 0.3, vol: 0.06, freq: 500, end: 900, type: 'bandpass', q: 2 });
  }

  toolBreak() {
    this.noise({ dur: 0.25, vol: 0.2, freq: 2000, end: 400, q: 1 });
    this.tone({ freq: 400, end: 120, dur: 0.2, vol: 0.1, type: 'square' });
  }

  uiClick() {
    this.tone({ freq: 700, end: 500, dur: 0.05, vol: 0.06, type: 'square' });
  }
}