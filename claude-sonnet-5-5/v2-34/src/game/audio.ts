export type Sfx =
  | "step"
  | "climb"
  | "hop"
  | "rotate"
  | "switch"
  | "rotor"
  | "portal"
  | "doc"
  | "coffee"
  | "bump"
  | "caught"
  | "win"
  | "lose"
  | "click"
  | "hint"
  | "undo"
  | "star"
  | "buy"
  | "wait"
  | "warn"
  | "fuse";

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const SONGS = [
  { root: 60, bpm: 76, chords: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 4]], scale: [0, 2, 4, 7, 9] },
  { root: 62, bpm: 82, chords: [[0, 3, 7, 10], [5, 9, 12, 15], [-5, -2, 2, 5], [-2, 2, 5, 9]], scale: [0, 2, 3, 5, 7, 9, 10] },
  { root: 65, bpm: 72, chords: [[0, 4, 7, 11], [2, 6, 9, 14], [4, 7, 11, 14], [-3, 0, 4, 7]], scale: [0, 2, 4, 6, 7, 9, 11] },
  { root: 57, bpm: 88, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [-7, -4, 0, 3], [-5, -1, 2, 5]], scale: [0, 2, 3, 5, 7, 8, 10] },
];

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private musicFilter!: BiquadFilterNode;
  private reverbSend!: GainNode;
  private vol = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private song = 0;
  private playing = false;
  private intensity = 0;
  private smooth = 0;
  private paused = false;

  ensure(): boolean {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp);
      comp.connect(ctx.destination);
      this.musicFilter = ctx.createBiquadFilter();
      this.musicFilter.type = "lowpass";
      this.musicFilter.frequency.value = 18000;
      this.musicBus = ctx.createGain();
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.connect(this.master);
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = buf.getChannelData(c);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
      conv.buffer = buf;
      this.reverbSend = ctx.createGain();
      this.reverbSend.gain.value = 0.35;
      this.reverbSend.connect(conv);
      const wet = ctx.createGain();
      wet.gain.value = 0.6;
      conv.connect(wet);
      wet.connect(this.master);
      this.applyVol();
      void ctx.resume();
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVol();
  }
  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.vol.muted ? 0 : this.vol.master * this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.03);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number, bus?: GainNode, wet = 0.2, attack = 0.005) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(bus ?? this.sfxBus);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      g.connect(s);
      s.connect(this.reverbSend);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  private noise(dur: number, vol: number, f0: number, f1: number, when = 0, q = 1, type: BiquadFilterType = "bandpass", bus?: GainNode) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + when;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t0);
    fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(fl);
    fl.connect(g);
    g.connect(bus ?? this.sfxBus);
    src.start(t0);
  }

  play(name: Sfx, p = 0) {
    if (!this.ensure() || !this.ctx) return;
    const r = Math.random();
    switch (name) {
      case "step":
        this.tone(260 + r * 70 + p * 20, 0.09, "triangle", 0.22, 0, undefined, undefined, 0.1);
        this.noise(0.04, 0.05, 3000, 1500);
        break;
      case "climb":
        this.tone(330, 0.09, "triangle", 0.2);
        this.tone(440, 0.1, "triangle", 0.2, 0.07);
        break;
      case "hop":
        this.tone(380, 0.28, "sine", 0.25, 0, 1200);
        this.tone(1500, 0.2, "triangle", 0.08, 0.1, 2200);
        this.noise(0.25, 0.05, 600, 3000, 0, 2);
        break;
      case "fuse":
        this.tone(660, 0.5, "sine", 0.06, 0, 990, undefined, 0.5);
        this.tone(990, 0.5, "sine", 0.05, 0.05, 1320, undefined, 0.5);
        break;
      case "rotate":
        this.noise(0.42, 0.16, 250, 1800, 0, 1.4);
        this.tone(110, 0.35, "sine", 0.12, 0, 160);
        break;
      case "switch":
        this.tone(200, 0.06, "square", 0.12);
        this.tone(880, 0.35, "sine", 0.15, 0.04, undefined, undefined, 0.4);
        this.tone(1320, 0.45, "sine", 0.1, 0.1, undefined, undefined, 0.4);
        break;
      case "rotor":
        this.tone(70, 0.5, "sawtooth", 0.1, 0, 110);
        this.noise(0.5, 0.1, 400, 200, 0, 2);
        this.tone(160, 0.12, "square", 0.1, 0.4);
        break;
      case "portal":
        [400, 600, 900, 1350, 1800].forEach((f, i) => this.tone(f, 0.18, "sine", 0.12, i * 0.045, undefined, undefined, 0.5));
        break;
      case "doc":
        this.tone(988, 0.25, "triangle", 0.2, 0, undefined, undefined, 0.4);
        this.tone(1319, 0.4, "triangle", 0.18, 0.08, undefined, undefined, 0.4);
        break;
      case "coffee":
        for (let i = 0; i < 4; i++) this.tone(300 + i * 90, 0.12, "sine", 0.16, i * 0.06, 500 + i * 120);
        break;
      case "bump":
        this.tone(120, 0.1, "square", 0.12, 0, 70);
        break;
      case "caught":
        this.tone(200, 0.7, "sawtooth", 0.2, 0, 50);
        this.noise(0.4, 0.25, 2000, 200, 0, 0.8);
        this.tone(70, 0.6, "sine", 0.3, 0, 40);
        break;
      case "win":
        [523, 659, 784, 1047, 1319].forEach((f, i) => {
          this.tone(f, 0.5, "triangle", 0.2, i * 0.09, undefined, undefined, 0.5);
          this.tone(f * 2, 0.4, "sine", 0.06, i * 0.09 + 0.02, undefined, undefined, 0.6);
        });
        break;
      case "lose":
        [440, 392, 330, 262].forEach((f, i) => this.tone(f, 0.55, "triangle", 0.2, i * 0.16, f * 0.97, undefined, 0.4));
        break;
      case "click":
        this.tone(740, 0.05, "triangle", 0.12, 0, undefined, undefined, 0.05);
        break;
      case "hint":
        this.tone(660, 0.2, "sine", 0.15, 0, undefined, undefined, 0.5);
        this.tone(880, 0.3, "sine", 0.15, 0.1, undefined, undefined, 0.5);
        break;
      case "undo":
        this.tone(800, 0.3, "sine", 0.18, 0, 300);
        this.noise(0.2, 0.06, 3000, 600);
        break;
      case "star":
        this.tone(660 * Math.pow(1.122, p * 2), 0.5, "triangle", 0.22, 0, undefined, undefined, 0.5);
        this.tone(1320 * Math.pow(1.122, p * 2), 0.5, "sine", 0.1, 0.03, undefined, undefined, 0.5);
        break;
      case "buy":
        this.tone(1175, 0.12, "square", 0.08);
        this.tone(1568, 0.4, "triangle", 0.18, 0.08, undefined, undefined, 0.4);
        break;
      case "wait":
        this.tone(180, 0.1, "sine", 0.12);
        break;
      case "warn":
        this.tone(900, 0.06, "square", 0.08);
        break;
    }
  }

  // ---- adaptive music ----
  startMusic(wing: number) {
    if (!this.ensure() || !this.ctx) return;
    const w = Math.max(0, Math.min(SONGS.length - 1, wing));
    if (this.playing && this.song === w) return;
    this.stopMusic();
    this.song = w;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 70);
  }
  stopMusic() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.playing = false;
  }
  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }
  setPaused(p: boolean) {
    this.paused = p;
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(p ? 380 : 18000, this.ctx.currentTime, 0.12);
  }
  private schedule() {
    if (!this.ctx || !this.playing) return;
    this.smooth += (this.intensity - this.smooth) * 0.08;
    const song = SONGS[this.song];
    const bpm = song.bpm + this.smooth * 26;
    const dur = 60 / bpm / 2;
    let guard = 0;
    while (this.nextTime < this.ctx.currentTime + 0.25 && guard++ < 8) {
      this.playStep(this.step, this.nextTime - this.ctx.currentTime, dur);
      this.nextTime += dur;
      this.step++;
    }
  }
  private playStep(step: number, when: number, dur: number) {
    const song = SONGS[this.song];
    const chord = song.chords[Math.floor(step / 16) % song.chords.length];
    const s16 = step % 16;
    const w = Math.max(0, when);
    const bus = this.musicBus;
    if (s16 === 0) {
      chord.forEach((n, i) => {
        const f = mtof(song.root + n - 12);
        this.tone(f, dur * 16.5, "triangle", 0.1, w, undefined, bus, 0.5, 1.4);
        this.tone(f * 1.004, dur * 16.5, "sine", 0.08, w, undefined, bus, 0.5, 1.6 + i * 0.1);
      });
    }
    if (s16 % 8 === 0) this.tone(mtof(song.root + chord[0] - 24), dur * 4, "sine", 0.34, w, undefined, bus, 0.05, 0.02);
    if (s16 === 6 || (s16 === 14 && this.smooth > 0.3)) this.tone(mtof(song.root + chord[0] - 24 + 7), dur * 2, "sine", 0.2, w, undefined, bus, 0.05, 0.02);
    const p = 0.5 + this.smooth * 0.35;
    if (Math.random() < p) {
      const pool = Math.random() < 0.65 ? chord : song.scale;
      const n = pool[Math.floor(Math.random() * pool.length)];
      const oct = Math.random() < 0.5 ? 12 : 24;
      this.tone(mtof(song.root + n + oct), dur * 3, "triangle", 0.1, w, undefined, bus, 0.55, 0.004);
    }
    if (s16 === 8 && Math.random() < 0.6) {
      const n = song.scale[Math.floor(Math.random() * song.scale.length)];
      this.tone(mtof(song.root + n + 36), dur * 8, "sine", 0.06, w, undefined, bus, 0.8, 0.01);
    }
    if (this.smooth > 0.3 && step % 2 === 1) this.noise(0.04, 0.035 + this.smooth * 0.03, 7000, 6000, w, 1, "highpass", bus);
    if (this.smooth > 0.5 && s16 % 8 === 0) this.tone(130, 0.18, "sine", 0.35, w, 40, bus, 0, 0.003);
    if (this.smooth > 0.75 && step % 4 === 2) this.tone(1800, 0.03, "square", 0.04, w, undefined, bus, 0, 0.002);
  }
  isPaused() {
    return this.paused;
  }
  destroy() {
    this.stopMusic();
  }
}

export const audio = new AudioEngine();
