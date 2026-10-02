// Fully synthesized audio: SFX + adaptive procedural music (Web Audio API)

export type MusicMode = 'off' | 'title' | 'briefing' | 'attack' | 'claims' | 'report' | 'win' | 'lose';

const mtof = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const PROG: [number, number[]][] = [
  [45, [57, 60, 64]], // Am
  [41, [57, 60, 65]], // F
  [48, [55, 60, 64]], // C
  [43, [55, 59, 62]], // G
];
const PENTA = [69, 72, 74, 76, 79, 81, 84];

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  sfxBus: GainNode | null = null;
  musicBus: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.8, music: 0.55, sfx: 0.8 };
  muted = false;
  mode: MusicMode = 'off';
  intensity = 0;
  step = 0;
  nextTime = 0;
  timer: number | null = null;
  lastSfx: Record<string, number> = {};
  failed = false;

  init() {
    if (this.ctx || this.failed) {
      this.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 6;
      this.master = ctx.createGain();
      this.sfxBus = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.master.connect(comp);
      comp.connect(ctx.destination);
      const len = ctx.sampleRate * 1.5;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.applyVolumes();
      this.nextTime = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.tick(), 40);
    } catch {
      this.failed = true;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => undefined);
  }

  setVolumes(master: number, music: number, sfx: number, muted: boolean) {
    this.vol = { master, music, sfx };
    this.muted = muted;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx || !this.master || !this.sfxBus || !this.musicBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.7, t, 0.03);
  }

  setMode(m: MusicMode) {
    if (this.mode !== m) {
      this.mode = m;
      this.step = 0;
    }
  }
  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  // ---------- primitives ----------
  tone(f: number, dur: number, type: OscillatorType, vol: number, when = 0, opt: { to?: number; att?: number; bus?: GainNode | null; lp?: number; det?: number } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const bus = opt.bus ?? this.sfxBus;
    if (!bus) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, f), t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + dur);
    if (opt.det) o.detune.value = opt.det;
    const att = opt.att ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (opt.lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = opt.lp;
      o.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, vol: number, when = 0, freq = 1000, type: BiquadFilterType = 'lowpass', bus?: GainNode | null, sweepTo?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf) return;
    const b = bus ?? this.sfxBus;
    if (!b) return;
    const t = ctx.currentTime + when;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, sweepTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(b);
    s.start(t, Math.random());
    s.stop(t + dur + 0.05);
  }

  // ---------- SFX ----------
  sfx(name: string) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const gap = name === 'stomp' ? 0.12 : name === 'zap' || name === 'shell' ? 0.06 : 0.02;
    if (this.lastSfx[name] && now - this.lastSfx[name] < gap) return;
    this.lastSfx[name] = now;
    switch (name) {
      case 'click': this.tone(660, 0.06, 'square', 0.07); break;
      case 'hover': this.tone(880, 0.03, 'sine', 0.03); break;
      case 'place':
        this.tone(220, 0.12, 'triangle', 0.25, 0, { to: 110 });
        this.noise(0.1, 0.2, 0, 1800);
        break;
      case 'sell': this.tone(500, 0.15, 'triangle', 0.15, 0, { to: 250 }); break;
      case 'error': this.tone(140, 0.2, 'sawtooth', 0.12, 0, { lp: 600 }); this.tone(120, 0.2, 'sawtooth', 0.1, 0.1, { lp: 600 }); break;
      case 'cash': this.tone(1318, 0.08, 'square', 0.07); this.tone(1760, 0.18, 'square', 0.07, 0.07); break;
      case 'approve': this.noise(0.08, 0.35, 0, 700); this.tone(180, 0.12, 'sine', 0.3, 0, { to: 90 }); this.tone(988, 0.12, 'triangle', 0.1, 0.08); break;
      case 'settle': this.noise(0.08, 0.3, 0, 900); this.tone(150, 0.12, 'sine', 0.28, 0, { to: 80 }); this.tone(660, 0.1, 'triangle', 0.1, 0.07); break;
      case 'deny': this.noise(0.09, 0.4, 0, 500); this.tone(110, 0.16, 'sawtooth', 0.14, 0, { to: 70, lp: 500 }); break;
      case 'probe': this.tone(300, 0.5, 'sine', 0.15, 0, { to: 900 }); this.tone(1200, 0.1, 'sine', 0.08, 0.5); break;
      case 'investigate': this.tone(700, 0.08, 'sine', 0.1); this.tone(900, 0.08, 'sine', 0.1, 0.1); this.tone(1100, 0.12, 'sine', 0.1, 0.2); break;
      case 'launch':
        this.tone(100, 0.8, 'sawtooth', 0.2, 0, { to: 400, lp: 1200 });
        this.noise(0.8, 0.2, 0, 300, 'lowpass', null, 3000);
        break;
      case 'stomp':
        this.tone(90, 0.28, 'sine', 0.55, 0, { to: 35 });
        this.noise(0.18, 0.35, 0, 500, 'lowpass', null, 120);
        break;
      case 'roar':
        this.tone(95, 1.2, 'sawtooth', 0.28, 0, { to: 55, lp: 700 });
        this.tone(140, 1.1, 'square', 0.12, 0, { to: 70, lp: 500, det: 25 });
        this.noise(1.1, 0.2, 0, 900, 'bandpass', null, 200);
        break;
      case 'shell':
        this.noise(0.12, 0.35, 0, 2500, 'highpass');
        this.tone(160, 0.2, 'sine', 0.35, 0, { to: 50 });
        break;
      case 'flak': this.noise(0.05, 0.2, 0, 3000, 'highpass'); this.tone(420, 0.05, 'square', 0.05, 0, { to: 200 }); break;
      case 'boom':
        this.noise(0.7, 0.55, 0, 1200, 'lowpass', null, 80);
        this.tone(70, 0.6, 'sine', 0.5, 0, { to: 28 });
        break;
      case 'crumble': this.noise(0.5, 0.3, 0, 900, 'lowpass', null, 150); this.tone(60, 0.3, 'sine', 0.2, 0, { to: 30 }); break;
      case 'quake':
        this.tone(45, 1.1, 'sine', 0.6, 0, { to: 25 });
        this.noise(1.0, 0.35, 0, 250, 'lowpass', null, 60);
        break;
      case 'siren':
        for (let i = 0; i < 4; i++) this.tone(600, 0.45, 'sine', 0.1, i * 0.45, { to: 900 });
        break;
      case 'flare': this.tone(1400, 0.6, 'sine', 0.12, 0, { to: 400 }); this.noise(0.4, 0.1, 0, 4000, 'highpass'); break;
      case 'strike': this.tone(900, 0.9, 'sawtooth', 0.12, 0, { to: 150, lp: 2500 }); break;
      case 'zap':
        this.tone(1200, 0.12, 'sawtooth', 0.12, 0, { to: 200, lp: 3000 });
        this.noise(0.1, 0.2, 0, 4000, 'bandpass');
        break;
      case 'ignite': this.noise(0.9, 0.4, 0, 500, 'bandpass', null, 2200); this.tone(110, 0.8, 'sawtooth', 0.1, 0, { to: 60, lp: 400 }); break;
      case 'splash': this.noise(0.9, 0.35, 0, 800, 'lowpass', null, 2500); break;
      case 'warn': this.tone(520, 0.12, 'square', 0.1); this.tone(520, 0.12, 'square', 0.1, 0.18); break;
      case 'hit': this.tone(300, 0.06, 'square', 0.05, 0, { to: 150 }); break;
      case 'kill':
        this.noise(1.4, 0.5, 0, 1500, 'lowpass', null, 60);
        this.tone(120, 1.4, 'sawtooth', 0.3, 0, { to: 30, lp: 600 });
        [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.14, 0.5 + i * 0.1));
        break;
      case 'research': [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.16, i * 0.07)); break;
      case 'streak': this.tone(880 + 0, 0.1, 'triangle', 0.1); this.tone(1175, 0.15, 'triangle', 0.1, 0.07); break;
      case 'phase': this.tone(70, 1.5, 'sawtooth', 0.3, 0, { to: 220, lp: 900 }); this.noise(1.2, 0.3, 0, 400, 'bandpass', null, 2500); break;
      case 'win': [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.18, i * 0.15)); break;
      case 'lose': [392, 330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.8, 'sawtooth', 0.12, i * 0.28, { lp: 900 })); break;
      case 'report': [440, 554, 659].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.12, i * 0.1)); break;
      default: break;
    }
  }

  // ---------- music sequencer ----------
  tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.mode === 'off') {
      this.nextTime = ctx.currentTime + 0.1;
      return;
    }
    const bpm = this.bpm();
    const stepDur = 60 / bpm / 4;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.14) {
      this.schedule(this.step, this.nextTime - ctx.currentTime);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  bpm() {
    switch (this.mode) {
      case 'attack': return 118 + this.intensity * 36;
      case 'briefing': return 84;
      case 'claims': return 104;
      case 'win': return 112;
      case 'lose': return 60;
      case 'report': return 72;
      default: return 72;
    }
  }

  schedule(s: number, w: number) {
    const bus = this.musicBus;
    if (!bus) return;
    const bar = Math.floor(s / 16) % 4;
    const [root, chord] = PROG[bar];
    const st = s % 16;
    const I = this.intensity;
    const m = this.mode;
    const rnd = Math.random;
    const dur16 = 60 / this.bpm() / 4;

    // pad
    if (st === 0) {
      const pv = m === 'attack' ? 0.05 : 0.07;
      chord.forEach((n, i) => {
        this.tone(mtof(n), dur16 * 16, m === 'attack' ? 'sawtooth' : 'triangle', pv * (m === 'lose' ? 0.8 : 1), w, {
          att: dur16 * 3, bus, lp: m === 'attack' ? 700 + I * 900 : 1100, det: i * 6 - 6,
        });
      });
    }

    if (m === 'title') {
      if (st % 8 === 0) this.tone(mtof(root), dur16 * 7, 'sine', 0.2, w, { bus, att: 0.05 });
      if (st % 4 === 2 && rnd() < 0.35) this.tone(mtof(PENTA[Math.floor(rnd() * PENTA.length)]), 1.4, 'sine', 0.07, w, { bus });
    } else if (m === 'briefing') {
      if (st % 4 === 0) {
        const walk = [root, root + 7, root + 12, root + 7][(st / 4) % 4];
        this.tone(mtof(walk), dur16 * 3.5, 'triangle', 0.22, w, { bus, att: 0.01 });
      }
      if (st % 8 === 4) this.noise(0.05, 0.05, w, 6000, 'highpass', bus);
      if (st % 2 === 0 && rnd() < 0.18) this.tone(mtof(PENTA[Math.floor(rnd() * 5)]), 0.9, 'sine', 0.09, w, { bus });
    } else if (m === 'claims') {
      if (st % 8 === 0 || st % 8 === 6) this.tone(mtof(root + 12), dur16 * 2, 'square', 0.06, w, { bus, lp: 900 });
      if (st % 2 === 0 && rnd() < 0.55) this.tone(mtof(PENTA[Math.floor(rnd() * PENTA.length)] - 12 + 12), 0.18, 'triangle', 0.1, w, { bus });
      if (st % 4 === 2) this.noise(0.03, 0.05, w, 7000, 'highpass', bus);
    } else if (m === 'attack') {
      // pulsing bass
      if (st % 2 === 0) this.tone(mtof(root), dur16 * 1.6, 'sawtooth', 0.14 + I * 0.08, w, { bus, lp: 300 + I * 500 });
      // kick
      if (st % 4 === 0) this.tone(120, 0.18, 'sine', 0.45, w, { to: 40, bus });
      if (I > 0.5 && st === 10) this.tone(120, 0.18, 'sine', 0.38, w, { to: 40, bus });
      // snare
      if (I > 0.25 && st % 8 === 4) this.noise(0.14, 0.2, w, 1800, 'bandpass', bus);
      // hats
      if (st % 2 === 0 || I > 0.65) this.noise(0.03, 0.04 + I * 0.05, w, 8000, 'highpass', bus);
      // taiko
      if (st === 0) this.tone(70, 0.5, 'sine', 0.4, w, { to: 35, bus });
      if (I > 0.4 && st === 14) this.tone(95, 0.3, 'sine', 0.3, w, { to: 50, bus });
      // arp
      if (I > 0.2 && rnd() < 0.5 + I * 0.3) {
        const n = chord[(st + bar) % 3] + (st % 8 < 4 ? 12 : 24);
        this.tone(mtof(n), dur16 * 1.2, 'square', 0.035 + I * 0.025, w, { bus, lp: 1800 });
      }
    } else if (m === 'report') {
      if (st % 8 === 0) this.tone(mtof(root), dur16 * 7, 'sine', 0.2, w, { bus, att: 0.05 });
      if (st % 8 === 4 && rnd() < 0.5) this.tone(mtof(PENTA[Math.floor(rnd() * PENTA.length)]), 1.2, 'sine', 0.07, w, { bus });
    } else if (m === 'win') {
      if (st % 4 === 0) this.tone(mtof(root + 12), dur16 * 3, 'triangle', 0.16, w, { bus });
      if (st % 2 === 0) this.tone(mtof(PENTA[(st / 2 + bar) % PENTA.length] + 12), 0.25, 'triangle', 0.08, w, { bus });
      if (st % 4 === 0) this.tone(120, 0.18, 'sine', 0.3, w, { to: 45, bus });
    } else if (m === 'lose') {
      if (st % 8 === 0) this.tone(mtof(root - 12), dur16 * 7, 'sawtooth', 0.1, w, { bus, lp: 300 });
      if (st === 0) this.tone(55, 2, 'sine', 0.3, w, { to: 40, bus });
    }
  }
}

export const audio = new AudioEngine();
