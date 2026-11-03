// Procedural WebAudio: SFX synthesis, positional panning, ambience, rain, generative music.
type Prof = { f: number; q: number; tone: number; tt: OscillatorType; dur: number; g: number; hp?: boolean; crunch?: boolean };
const MAT: Record<string, Prof> = {
  stone: { f: 1200, q: 0.9, tone: 130, tt: 'sine', dur: 0.1, g: 0.5 },
  grass: { f: 2800, q: 0.5, tone: 0, tt: 'sine', dur: 0.1, g: 0.32, hp: true },
  dirt: { f: 700, q: 0.7, tone: 90, tt: 'sine', dur: 0.1, g: 0.5 },
  sand: { f: 3400, q: 0.4, tone: 0, tt: 'sine', dur: 0.12, g: 0.25, hp: true },
  wood: { f: 650, q: 1.6, tone: 210, tt: 'triangle', dur: 0.09, g: 0.5 },
  glass: { f: 5200, q: 2, tone: 2600, tt: 'sine', dur: 0.12, g: 0.35 },
  gravel: { f: 1600, q: 0.6, tone: 0, tt: 'sine', dur: 0.14, g: 0.4, crunch: true },
  snow: { f: 4200, q: 0.3, tone: 0, tt: 'sine', dur: 0.12, g: 0.2, hp: true },
  leaves: { f: 3600, q: 0.4, tone: 0, tt: 'sine', dur: 0.1, g: 0.2, hp: true },
  cloth: { f: 900, q: 0.4, tone: 0, tt: 'sine', dur: 0.1, g: 0.3 },
  water: { f: 1800, q: 0.5, tone: 0, tt: 'sine', dur: 0.2, g: 0.25 },
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfx!: GainNode; music!: GainNode; amb!: GainNode; filt!: BiquadFilterNode; verb!: ConvolverNode; verbSend!: GainNode;
  noiseBuf!: AudioBuffer;
  rainGain!: GainNode; windGain!: GainNode; caveGain!: GainNode; lavaGain!: GainNode;
  vol = { master: 0.7, music: 0.5, sfx: 1 };
  lx = 0; ly = 0; lz = 0; lyaw = 0;
  nextMusic = 25; nextDrip = 5; underwaterFilter = 0;

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.filt = ctx.createBiquadFilter(); this.filt.type = 'lowpass'; this.filt.frequency.value = 20000;
    this.master = ctx.createGain(); this.master.gain.value = this.vol.master;
    this.filt.connect(this.master); this.master.connect(ctx.destination);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.vol.sfx; this.sfx.connect(this.filt);
    this.music = ctx.createGain(); this.music.gain.value = this.vol.music * 0.5; this.music.connect(this.filt);
    this.amb = ctx.createGain(); this.amb.gain.value = 0.8; this.amb.connect(this.filt);
    const n = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    // reverb impulse
    const len = ctx.sampleRate * 2.4, imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const ch = imp.getChannelData(c); for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    this.verb = ctx.createConvolver(); this.verb.buffer = imp;
    this.verbSend = ctx.createGain(); this.verbSend.gain.value = 0.5;
    this.verbSend.connect(this.verb); this.verb.connect(this.filt);
    const loop = (type: BiquadFilterType, f: number, q: number) => {
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const bf = ctx.createBiquadFilter(); bf.type = type; bf.frequency.value = f; bf.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      s.connect(bf); bf.connect(g); g.connect(this.amb); s.start();
      return g;
    };
    this.rainGain = loop('bandpass', 5200, 0.35);
    this.windGain = loop('bandpass', 420, 0.6);
    this.caveGain = loop('lowpass', 90, 1);
    this.lavaGain = loop('lowpass', 260, 2);
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.vol = { master, music, sfx };
    if (!this.ctx) return;
    this.master.gain.value = master; this.music.gain.value = music * 0.5; this.sfx.gain.value = sfx;
  }
  setListener(x: number, y: number, z: number, yaw: number) { this.lx = x; this.ly = y; this.lz = z; this.lyaw = yaw; }

  private out(pos?: { x: number; y: number; z: number }, vol = 1): AudioNode | null {
    if (!this.ctx) return null;
    const g = this.ctx.createGain();
    let v = vol;
    if (pos) {
      const dx = pos.x - this.lx, dy = pos.y - this.ly, dz = pos.z - this.lz;
      const dist = Math.hypot(dx, dy, dz);
      v *= Math.max(0, 1 / (1 + dist * 0.18)) * (dist > 48 ? 0 : 1);
      const p = this.ctx.createStereoPanner();
      // right vector for yaw (camera looks along -z rotated by yaw)
      const rx = Math.cos(this.lyaw), rz = -Math.sin(this.lyaw);
      p.pan.value = dist < 0.5 ? 0 : Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist)) * 0.85;
      g.connect(p); p.connect(this.sfx);
    } else g.connect(this.sfx);
    g.gain.value = v;
    return g;
  }

  noise(dest: AudioNode, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, gain: number, delay = 0, attack = 0.004) {
    const ctx = this.ctx!, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const bf = ctx.createBiquadFilter(); bf.type = type; bf.Q.value = q;
    bf.frequency.setValueAtTime(f0, t); bf.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bf); bf.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  tone(dest: AudioNode, f0: number, f1: number, dur: number, type: OscillatorType, gain: number, delay = 0, vib = 0, attack = 0.01, lp = 0) {
    const ctx = this.ctx!, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let last: AudioNode = o;
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f); last = f; }
    if (vib) { const l = ctx.createOscillator(); l.frequency.value = vib; const lg = ctx.createGain(); lg.gain.value = f0 * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
    last.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }

  block(kind: 'dig' | 'break' | 'place' | 'step', mat: string, pos?: { x: number; y: number; z: number }) {
    const o = this.out(pos, kind === 'step' ? 0.45 : 0.9); if (!o) return;
    const p = MAT[mat] || MAT.stone;
    const k = kind === 'break' ? 1.6 : kind === 'step' ? 0.7 : 1, pitch = 0.85 + Math.random() * 0.3;
    const dur = p.dur * k;
    this.noise(o, dur, p.hp ? 'highpass' : 'bandpass', p.f * pitch * (kind === 'break' ? 0.7 : 1), p.f * 0.35 * pitch, p.q, p.g * (kind === 'step' ? 0.6 : 1));
    if (p.tone) this.tone(o, p.tone * pitch * (kind === 'place' ? 1.15 : 1), p.tone * 0.6, dur, p.tt, p.g * 0.9);
    if (p.crunch) this.noise(o, dur, 'bandpass', p.f * 1.3, p.f * 0.5, 1, p.g * 0.8, 0.045);
    if (kind === 'break' && mat === 'glass') for (let i = 0; i < 4; i++) this.tone(o, 3000 + Math.random() * 3000, 1500, 0.1, 'sine', 0.15, Math.random() * 0.1);
  }

  play(name: string, pos?: { x: number; y: number; z: number }, vol = 1, pitch = 1) {
    if (!this.ctx) return;
    const o = this.out(pos, vol); if (!o) return;
    const p = pitch * (0.93 + Math.random() * 0.14);
    switch (name) {
      case 'pop': this.tone(o, 500 * p, 1100 * p, 0.09, 'sine', 0.3); break;
      case 'click': this.tone(o, 900, 700, 0.04, 'square', 0.08); break;
      case 'hurt': this.tone(o, 260 * p, 110, 0.22, 'sawtooth', 0.3, 0, 0, 0.005, 900); this.noise(o, 0.1, 'bandpass', 800, 300, 1, 0.3); break;
      case 'death': this.tone(o, 200, 50, 0.7, 'sawtooth', 0.35, 0, 6, 0.01, 700); break;
      case 'eat': for (let i = 0; i < 3; i++) this.noise(o, 0.07, 'bandpass', 1500 * p, 700, 1.5, 0.45, i * 0.11); break;
      case 'burp': this.tone(o, 110, 70, 0.35, 'sawtooth', 0.25, 0, 18, 0.02, 400); break;
      case 'splash': this.noise(o, 0.35, 'bandpass', 2500, 500, 0.7, 0.5); this.noise(o, 0.2, 'highpass', 3000, 1500, 0.5, 0.2, 0.05); break;
      case 'swim': this.noise(o, 0.2, 'bandpass', 1800, 900, 0.6, 0.2); break;
      case 'bubble': this.tone(o, 400 * p, 900 * p, 0.08, 'sine', 0.15); break;
      case 'fizz': this.noise(o, 0.3, 'highpass', 4000, 3000, 0.5, 0.25); break;
      case 'explode': this.noise(o, 2.2, 'lowpass', 1400, 60, 0.8, 1.0, 0, 0.005); this.tone(o, 90, 30, 1.1, 'sine', 0.9); this.noise(o, 0.5, 'bandpass', 3000, 400, 0.5, 0.5); break;
      case 'fuse': this.noise(o, 1.4, 'highpass', 4500, 6000, 0.4, 0.25, 0, 0.1); break;
      case 'shoot': this.noise(o, 0.18, 'bandpass', 3000, 900, 1, 0.3); this.tone(o, 300, 150, 0.1, 'triangle', 0.2); break;
      case 'arrow_hit': this.tone(o, 320, 180, 0.06, 'triangle', 0.3); this.noise(o, 0.05, 'bandpass', 2500, 1500, 1, 0.2); break;
      case 'thunder': this.noise(o, 4.5, 'lowpass', 420, 50, 0.7, 1.2, 0, 0.12); this.noise(o, 2.2, 'lowpass', 200, 40, 1, 0.9, 0.6, 0.2); break;
      case 'fire': this.noise(o, 0.4, 'bandpass', 2200, 1200, 1, 0.25); break;
      case 'achieve': [523, 659, 784, 1046].forEach((f, i) => this.tone(o, f, f, 0.5, 'triangle', 0.18, i * 0.1)); break;
      case 'levelup': [392, 523, 659, 784].forEach((f, i) => this.tone(o, f, f, 0.3, 'sine', 0.2, i * 0.07)); break;
      case 'pig': this.tone(o, 250 * p, 150 * p, 0.14, 'square', 0.18, 0, 14, 0.01, 1100); this.tone(o, 200 * p, 140, 0.12, 'square', 0.14, 0.14, 12, 0.01, 1000); break;
      case 'cow': this.tone(o, 140 * p, 90 * p, 0.9, 'sawtooth', 0.25, 0, 5, 0.1, 480); break;
      case 'sheep': this.tone(o, 420 * p, 330 * p, 0.7, 'sawtooth', 0.12, 0, 26, 0.05, 1500); break;
      case 'chicken': this.tone(o, 900 * p, 650 * p, 0.07, 'square', 0.1, 0, 0, 0.005, 3000); this.tone(o, 1000 * p, 700, 0.06, 'square', 0.1, 0.1, 0, 0.005, 3000); break;
      case 'zombie': this.tone(o, 100 * p, 62, 1.0, 'sawtooth', 0.3, 0, 7, 0.1, 380); this.noise(o, 0.8, 'bandpass', 300, 150, 2, 0.12); break;
      case 'skeleton': for (let i = 0; i < 4; i++) this.noise(o, 0.04, 'bandpass', 3200 * p, 2000, 3, 0.35, i * 0.07); break;
      case 'boomer': this.noise(o, 0.5, 'highpass', 4000, 5500, 0.4, 0.25, 0, 0.05); break;
      case 'mob_hurt': this.tone(o, 330 * p, 160, 0.18, 'sawtooth', 0.22, 0, 0, 0.005, 1000); break;
      case 'mob_die': this.tone(o, 260 * p, 70, 0.45, 'sawtooth', 0.25, 0, 0, 0.005, 800); break;
      case 'hit': this.noise(o, 0.07, 'bandpass', 1300, 600, 1.2, 0.5); this.tone(o, 160, 90, 0.07, 'square', 0.15); break;
      case 'door': this.tone(o, 180, 120, 0.1, 'triangle', 0.3); break;
    }
  }

  update(dt: number, env: { rain: number; underwater: boolean; cave: boolean; night: number; altitude: number; nearLava: boolean; daylight: number; flash?: number }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sm = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.4);
    sm(this.rainGain, env.rain * (env.cave ? 0.05 : 0.22) * (env.underwater ? 0.3 : 1));
    sm(this.windGain, (0.025 + Math.max(0, env.altitude - 50) * 0.003 + env.rain * 0.05) * (env.cave ? 0.1 : 1));
    sm(this.caveGain, env.cave ? 0.5 : 0);
    sm(this.lavaGain, env.nearLava ? 0.35 : 0);
    this.filt.frequency.setTargetAtTime(env.underwater ? 500 : 20000, t, 0.1);
    this.nextDrip -= dt;
    if (env.cave && this.nextDrip <= 0) {
      this.nextDrip = 2 + Math.random() * 6;
      const f = 700 + Math.random() * 900;
      const g = this.ctx.createGain(); g.gain.value = 0.25; g.connect(this.verbSend); g.connect(this.sfx);
      this.tone(g, f * 1.4, f, 0.12, 'sine', 0.3);
    }
    this.nextMusic -= dt;
    if (this.nextMusic <= 0) { this.nextMusic = 90 + Math.random() * 120; if (!env.cave || Math.random() < 0.5) this.playMusic(env.daylight < 0.3); }
  }

  playMusic(night: boolean) {
    if (!this.ctx || this.vol.music <= 0.001) return;
    const ctx = this.ctx;
    const scale = night ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
    const root = (night ? 196 : 262) * Math.pow(2, Math.floor(Math.random() * 4) / 12);
    let t = 0;
    const notes = 14 + Math.floor(Math.random() * 10);
    let idx = 2;
    for (let i = 0; i < notes; i++) {
      idx = Math.max(0, Math.min(11, idx + Math.floor(Math.random() * 5) - 2));
      const deg = scale[idx % 5] + 12 * Math.floor(idx / 5);
      const f = root * Math.pow(2, deg / 12);
      const dur = 1.4 + Math.random() * 1.6;
      const g = ctx.createGain(); g.gain.value = 0.16; g.connect(this.music); const s = ctx.createGain(); s.gain.value = 0.7; g.connect(s); s.connect(this.verbSend);
      this.tone(g, f, f, dur * 1.8, 'sine', 1, t, 0, 0.02);
      this.tone(g, f * 2, f * 2, dur, 'triangle', 0.25, t, 0, 0.02);
      if (i % 4 === 0) this.tone(g, f / 2, f / 2, dur * 3, 'sine', 0.5, t, 0, 0.3);
      t += dur * (0.55 + Math.random() * 0.5) + (Math.random() < 0.25 ? 1.2 : 0);
    }
  }
}
