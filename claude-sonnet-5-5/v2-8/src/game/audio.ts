/* Fully synthesized audio: SFX, wind, engine hum and reactive generative music. */
type Ctx = AudioContext;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private engGain!: GainNode;
  private engOsc!: OscillatorNode;
  private engOsc2!: OscillatorNode;
  private engFilter!: BiquadFilterNode;
  private delay!: DelayNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private nextTime = 0;
  private beat = 0;
  private vol = { master: 0.8, music: 0.6, sfx: 0.8, muted: false };
  private tension = 0;
  private night = 0;
  private aurora = false;
  private lastSfx: Record<string, number> = {};

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicBus = ctx.createGain();
      this.sfxBus = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.musicBus.connect(this.master); this.sfxBus.connect(this.master);
      this.master.connect(comp); comp.connect(ctx.destination);
      // echo for music
      this.delay = ctx.createDelay(1.5);
      this.delay.delayTime.value = 0.45;
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      const dl = ctx.createBiquadFilter(); dl.type = "lowpass"; dl.frequency.value = 2200;
      this.delay.connect(dl); dl.connect(fb); fb.connect(this.delay); dl.connect(this.musicBus);
      // noise buffer
      const len = ctx.sampleRate * 2;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      // wind
      const ns = ctx.createBufferSource(); ns.buffer = this.noise; ns.loop = true;
      this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = "bandpass"; this.windFilter.frequency.value = 400; this.windFilter.Q.value = 0.7;
      this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
      ns.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
      ns.start();
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lg = ctx.createGain(); lg.gain.value = 220;
      lfo.connect(lg); lg.connect(this.windFilter.frequency); lfo.start();
      // engine
      this.engOsc = ctx.createOscillator(); this.engOsc.type = "sawtooth"; this.engOsc.frequency.value = 45;
      this.engOsc2 = ctx.createOscillator(); this.engOsc2.type = "square"; this.engOsc2.frequency.value = 22.5;
      this.engFilter = ctx.createBiquadFilter(); this.engFilter.type = "lowpass"; this.engFilter.frequency.value = 220;
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engOsc.connect(this.engFilter); this.engOsc2.connect(this.engFilter);
      this.engFilter.connect(this.engGain); this.engGain.connect(this.master);
      this.engOsc.start(); this.engOsc2.start();
      this.applyVol();
    } catch {
      this.ctx = null;
    }
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVol();
  }
  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.vol.music * 0.9, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
  }

  suspend() { if (this.ctx && this.ctx.state === "running") void this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume(); }

  setEnvironment(wind: number, speedFrac: number, engineOn: boolean, tension: number, night: number, aurora: boolean) {
    this.tension = tension; this.night = night; this.aurora = aurora;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(Math.min(0.5, 0.04 + wind * 0.22) * (this.vol.sfx), t, 0.3);
    this.windFilter.Q.setTargetAtTime(0.5 + wind * 1.4, t, 0.3);
    this.engGain.gain.setTargetAtTime(engineOn ? 0.05 + speedFrac * 0.07 : 0, t, 0.2);
    this.engOsc.frequency.setTargetAtTime(38 + speedFrac * 42, t, 0.25);
    this.engOsc2.frequency.setTargetAtTime(19 + speedFrac * 21, t, 0.25);
    this.engFilter.frequency.setTargetAtTime(160 + speedFrac * 260, t, 0.25);
  }

  silenceLoops() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(0, t, 0.2);
    this.engGain.gain.setTargetAtTime(0, t, 0.2);
  }

  /* ---------- music ---------- */
  startMusic() {
    if (!this.ctx || this.timer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.beat = 0;
    this.timer = window.setInterval(() => this.schedule(), 200);
  }
  stopMusic() {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const beatLen = 0.62 - this.tension * 0.14;
    while (this.nextTime < ctx.currentTime + 0.9) {
      this.playBeat(this.nextTime, this.beat);
      this.nextTime += beatLen;
      this.beat++;
    }
  }

  private playBeat(t: number, b: number) {
    const ctx = this.ctx!;
    const chords = [
      [57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 66],
    ];
    const bar = Math.floor(b / 8) % chords.length;
    const chord = chords[bar];
    const beatLen = 0.62 - this.tension * 0.14;
    if (b % 8 === 0) {
      const shift = this.night > 0.5 ? -12 : 0;
      for (const n of chord) {
        this.pad(t, mtof(n + shift - 12 + (n === chord[0] ? 0 : 12)), beatLen * 9);
      }
      if (this.aurora) this.pad(t, mtof(chord[2] + 12), beatLen * 9, 0.03);
    }
    // bell arpeggio
    const pent = [69, 72, 74, 76, 79, 81, 84];
    const auroraScale = [72, 76, 79, 83, 84, 88];
    const sc = this.aurora ? auroraScale : pent;
    const p = 0.28 + (this.aurora ? 0.25 : 0) - this.tension * 0.15;
    if (b % 2 === 0 && Math.random() < p) {
      const n = sc[Math.floor(Math.random() * sc.length)] + (bar === 3 && !this.aurora ? -1 : 0);
      this.bell(t, mtof(n), 0.05 + Math.random() * 0.03);
    }
    // tension pulse + dissonance
    if (this.tension > 0.25) {
      if (b % 2 === 0) this.kick(t, 0.12 + this.tension * 0.2);
      if (b % 4 === 1) this.bell(t, mtof(chord[0] + 18), 0.04 * this.tension);
      if (this.tension > 0.6 && b % 8 === 4) this.stab(t, mtof(chord[0] + 6), 0.05);
    }
    void ctx;
  }

  private pad(t: number, f: number, dur: number, vol = 0.045) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 700 + this.tension * 600;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, t + dur);
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
    lp.connect(g); g.connect(this.musicBus);
  }

  private bell(t: number, f: number, vol: number) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = "sine"; o2.frequency.value = f * 2.76;
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(this.musicBus); g.connect(this.delay);
    o.start(t); o2.start(t); o.stop(t + 2.3); o2.stop(t + 2.3);
  }

  private kick(t: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = "sine";
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.35);
  }

  private stab(t: number, f: number, vol: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = "sawtooth"; o.frequency.value = f;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1800, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    o.connect(lp); lp.connect(g); g.connect(this.musicBus); o.start(t); o.stop(t + 0.85);
  }

  /* ---------- sfx ---------- */
  private tone(f0: number, dur: number, type: OscillatorType, vol: number, f1?: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  private burst(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, delay = 0, q = 1) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  sfx(name: string, k = 1) {
    if (!this.ctx || this.vol.muted) return;
    const now = this.ctx.currentTime;
    if (this.lastSfx[name] && now - this.lastSfx[name] < 0.04) return;
    this.lastSfx[name] = now;
    switch (name) {
      case "click": this.tone(720, 0.07, "triangle", 0.18, 980); break;
      case "back": this.tone(520, 0.08, "triangle", 0.16, 320); break;
      case "deny": this.tone(160, 0.18, "square", 0.14, 110); break;
      case "buy": this.tone(660, 0.08, "square", 0.1); this.tone(990, 0.12, "square", 0.1, undefined, 0.07); break;
      case "coin": this.tone(1200, 0.1, "sine", 0.16); this.tone(1800, 0.2, "sine", 0.14, undefined, 0.06); break;
      case "jump": this.burst(0.25, 0.25, "highpass", 600, 2400); this.tone(180, 0.22, "sine", 0.2, 420); break;
      case "land": this.burst(0.3, 0.35 * k, "lowpass", 900, 80); this.tone(70, 0.25, "sine", 0.35 * k, 35); break;
      case "crack": this.burst(0.5, 0.5, "bandpass", 3000, 200, 0, 2); this.tone(90, 0.5, "sawtooth", 0.18, 40); break;
      case "bridge": this.tone(220, 0.1, "square", 0.14, 150); this.burst(0.15, 0.3, "bandpass", 1500, 900, 0.1); this.tone(180, 0.1, "square", 0.14, 130, 0.2); this.tone(260, 0.12, "triangle", 0.14, undefined, 0.32); break;
      case "fall": this.tone(420, 0.8, "sawtooth", 0.2, 50); this.burst(0.7, 0.4, "lowpass", 1400, 90, 0.3); break;
      case "hit": this.burst(0.2, 0.45 * k, "lowpass", 1600, 200); this.tone(110, 0.18, "square", 0.2, 60); break;
      case "shot": this.burst(0.08, 0.25, "highpass", 2000, 4000); this.tone(900, 0.06, "square", 0.08, 300); break;
      case "flare": this.burst(0.7, 0.3, "bandpass", 800, 3500, 0, 3); this.tone(500, 0.6, "sawtooth", 0.1, 1400); break;
      case "pickup": this.tone(880, 0.08, "triangle", 0.2); this.tone(1320, 0.14, "triangle", 0.2, undefined, 0.07); break;
      case "ping": this.tone(1568, 0.5, "sine", 0.22); this.tone(2093, 0.7, "sine", 0.12, undefined, 0.05); break;
      case "warn": this.tone(880, 0.12, "square", 0.12); this.tone(880, 0.12, "square", 0.12, undefined, 0.2); break;
      case "quake": this.burst(1.6, 0.6, "lowpass", 300, 40); this.tone(48, 1.6, "sawtooth", 0.28, 30); break;
      case "storm": this.burst(1.8, 0.4, "bandpass", 300, 1800, 0, 0.6); break;
      case "chime": [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.9, "sine", 0.12, undefined, i * 0.12)); break;
      case "die": this.tone(330, 1.2, "triangle", 0.2, 80); this.tone(247, 1.4, "sine", 0.18, 60, 0.15); break;
      case "camp": this.tone(392, 0.6, "triangle", 0.14); this.tone(523, 0.8, "triangle", 0.14, undefined, 0.15); this.tone(659, 1, "triangle", 0.14, undefined, 0.3); break;
      case "event": this.tone(523, 0.3, "triangle", 0.16); this.tone(392, 0.4, "triangle", 0.16, undefined, 0.16); break;
      case "thin": this.burst(0.35, 0.18, "bandpass", 1800, 700, 0, 6); break;
      case "maw": this.burst(1.2, 0.6, "lowpass", 220, 30); this.tone(36, 1.4, "sawtooth", 0.32, 24); break;
      case "win": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 1.2, "triangle", 0.16, undefined, i * 0.18)); break;
      case "lose": [440, 392, 330, 262, 196].forEach((f, i) => this.tone(f, 1.2, "sawtooth", 0.1, f * 0.9, i * 0.25)); break;
      case "avalanche": this.burst(1.5, 0.5, "lowpass", 900, 80, 0, 0.5); break;
      case "kill": this.burst(0.25, 0.3, "bandpass", 1200, 300); this.tone(300, 0.2, "square", 0.12, 80); break;
      default: break;
    }
  }
}

export const audio = new AudioEngine();
