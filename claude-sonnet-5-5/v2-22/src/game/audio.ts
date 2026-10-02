/* Fully synthesized audio: SFX, ambient plant hum and adaptive music. No external assets. */

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);


export interface AudioVolumes { master: number; music: number; sfx: number; muted: boolean }

class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicG!: GainNode;
  private sfxG!: GainNode;
  private ambG!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private vol: AudioVolumes = { master: 0.7, music: 0.6, sfx: 0.8, muted: false };

  private humA: OscillatorNode | null = null;
  private humB: OscillatorNode | null = null;
  private humF: BiquadFilterNode | null = null;
  private whine: OscillatorNode | null = null;
  private whineG: GainNode | null = null;
  private flowSrc: AudioBufferSourceNode | null = null;
  private flowG: GainNode | null = null;
  private flowF: BiquadFilterNode | null = null;
  private ambOn = false;

  private musicOn = false;
  private musicTimer: number | null = null;
  private step = 0;
  private nextT = 0;
  tension = 0;
  private lastHorn = 0;

  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") void this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.musicG = ctx.createGain();
      this.sfxG = ctx.createGain();
      this.ambG = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      this.musicG.connect(this.master);
      this.sfxG.connect(this.master);
      this.ambG.connect(this.master);
      this.master.connect(comp);
      comp.connect(ctx.destination);
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

  setVolumes(v: AudioVolumes) {
    this.vol = v;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.vol.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.05);
    this.ambG.gain.setTargetAtTime(0.5, t, 0.05);
  }

  // ---------- primitives ----------
  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, slideTo?: number, delay = 0, dest?: AudioNode) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest || this.sfxG);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol = 0.2, freq = 1000, type: BiquadFilterType = "lowpass", delay = 0, dest?: AudioNode, slideTo?: number) {
    const ctx = this.ctx; if (!ctx || !this.noiseBuf) return;
    const t0 = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.setValueAtTime(freq, t0);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG);
    s.start(t0, Math.random()); s.stop(t0 + dur + 0.05);
  }

  // ---------- SFX ----------
  play(kind: string, mag = 1) {
    const ctx = this.ctx; if (!ctx || ctx.state !== "running") return;
    switch (kind) {
      case "click": this.tone(900, 0.05, "square", 0.08); this.tone(450, 0.04, "sine", 0.1, undefined, 0.01); break;
      case "ui": this.tone(660, 0.07, "triangle", 0.12); break;
      case "ack": this.tone(520, 0.08, "triangle", 0.14); this.tone(780, 0.1, "triangle", 0.12, undefined, 0.06); break;
      case "deny": this.tone(130, 0.18, "sawtooth", 0.14, 90); break;
      case "tick": this.tone(1400, 0.015, "square", 0.04); break;
      case "alarm1": this.tone(660, 0.14, "square", 0.1); this.tone(880, 0.14, "square", 0.1, undefined, 0.16); break;
      case "alarm2": for (let i = 0; i < 3; i++) this.tone(988, 0.1, "square", 0.13, undefined, i * 0.14); break;
      case "horn": this.tone(220, 0.45, "sawtooth", 0.12); this.tone(223, 0.45, "sawtooth", 0.1); break;
      case "warn": this.tone(440, 0.18, "triangle", 0.15, 330); break;
      case "advisory": this.tone(784, 0.4, "sine", 0.12); this.tone(1175, 0.5, "sine", 0.08, undefined, 0.12); break;
      case "scram":
        for (let i = 0; i < 6; i++) this.tone(i % 2 ? 420 : 760, 0.22, "sawtooth", 0.16, undefined, i * 0.22);
        this.noise(0.6, 0.35, 200, "lowpass"); this.tone(70, 0.8, "sine", 0.3, 40);
        break;
      case "fail": this.tone(300, 0.5, "sawtooth", 0.18, 70); this.noise(0.35, 0.18, 2500, "bandpass"); break;
      case "hit": this.tone(110, 0.2, "sine", 0.25, 50); this.noise(0.15, 0.2, 800); break;
      case "good": [60, 64, 67, 72].forEach((n, i) => this.tone(NOTE(n), 0.25, "triangle", 0.14, undefined, i * 0.08)); break;
      case "repair": this.tone(NOTE(76), 0.3, "sine", 0.14); this.tone(NOTE(83), 0.4, "sine", 0.12, undefined, 0.1); break;
      case "loop": this.tone(400, 1.6, "sawtooth", 0.2, 40); this.noise(1.2, 0.15, 800, "lowpass", 0, undefined, 60); break;
      case "quake": this.noise(2.2 * mag + 0.6, 0.55 * Math.min(1, mag + 0.3), 180, "lowpass"); this.tone(45, 2, "sine", 0.35, 30); break;
      case "boom":
        this.noise(3, 0.8, 600, "lowpass", 0, undefined, 40); this.tone(55, 2.5, "sine", 0.5, 25); this.tone(220, 1, "sawtooth", 0.2, 30);
        break;
      case "banner": this.tone(NOTE(45), 1.4, "sawtooth", 0.2, NOTE(43)); this.tone(NOTE(57), 1.2, "triangle", 0.15); break;
      case "win": [60, 64, 67, 72, 76, 79].forEach((n, i) => this.tone(NOTE(n), 0.45, "triangle", 0.16, undefined, i * 0.12)); break;
      case "lose": [67, 63, 60, 55, 48].forEach((n, i) => this.tone(NOTE(n), 0.55, "sawtooth", 0.14, undefined, i * 0.25)); break;
      case "buy": this.tone(NOTE(72), 0.1, "square", 0.1); this.tone(NOTE(79), 0.2, "square", 0.1, undefined, 0.08); break;
      default: break;
    }
  }

  handleSimEvent(kind: string, mag?: number) {
    const now = performance.now();
    switch (kind) {
      case "alarm1": this.play("alarm1"); break;
      case "alarm2": this.play("alarm2"); break;
      case "horn": if (now - this.lastHorn > 1500) { this.lastHorn = now; this.play("horn"); } break;
      case "scram": case "fail": case "hit": case "good": case "repair": case "loop": case "quake": case "boom": case "banner":
      case "ack": case "deny": case "click": case "warn": case "advisory":
        this.play(kind, mag); break;
      default: break;
    }
  }

  // ---------- ambient ----------
  startAmbient() {
    const ctx = this.ctx; if (!ctx || this.ambOn || !this.noiseBuf) return;
    this.ambOn = true;
    this.humF = ctx.createBiquadFilter(); this.humF.type = "lowpass"; this.humF.frequency.value = 220;
    const hg = ctx.createGain(); hg.gain.value = 0.12;
    this.humA = ctx.createOscillator(); this.humA.type = "sawtooth"; this.humA.frequency.value = 50;
    this.humB = ctx.createOscillator(); this.humB.type = "sawtooth"; this.humB.frequency.value = 50.6;
    this.humA.connect(this.humF); this.humB.connect(this.humF); this.humF.connect(hg); hg.connect(this.ambG);
    this.humA.start(); this.humB.start();
    this.whine = ctx.createOscillator(); this.whine.type = "sine"; this.whine.frequency.value = 600;
    this.whineG = ctx.createGain(); this.whineG.gain.value = 0;
    this.whine.connect(this.whineG); this.whineG.connect(this.ambG); this.whine.start();
    this.flowSrc = ctx.createBufferSource(); this.flowSrc.buffer = this.noiseBuf; this.flowSrc.loop = true;
    this.flowF = ctx.createBiquadFilter(); this.flowF.type = "bandpass"; this.flowF.frequency.value = 500; this.flowF.Q.value = 0.8;
    this.flowG = ctx.createGain(); this.flowG.gain.value = 0;
    this.flowSrc.connect(this.flowF); this.flowF.connect(this.flowG); this.flowG.connect(this.ambG); this.flowSrc.start();
  }

  stopAmbient() {
    if (!this.ambOn) return;
    this.ambOn = false;
    for (const n of [this.humA, this.humB, this.whine]) { try { n?.stop(); n?.disconnect(); } catch { /* already stopped */ } }
    try { this.flowSrc?.stop(); this.flowSrc?.disconnect(); } catch { /* already stopped */ }
    this.humA = this.humB = this.whine = null; this.flowSrc = null;
  }

  updateAmbient(P: number, MWe: number, flow: number) {
    const ctx = this.ctx; if (!ctx || !this.ambOn) return;
    const t = ctx.currentTime;
    this.humA?.frequency.setTargetAtTime(48 + P * 14, t, 0.3);
    this.humB?.frequency.setTargetAtTime(48.7 + P * 14, t, 0.3);
    this.humF?.frequency.setTargetAtTime(160 + P * 260, t, 0.3);
    this.whine?.frequency.setTargetAtTime(400 + (MWe / 1000) * 500, t, 0.3);
    this.whineG?.gain.setTargetAtTime(Math.min(0.03, (MWe / 1000) * 0.03), t, 0.3);
    this.flowG?.gain.setTargetAtTime(Math.min(0.06, flow * 0.05), t, 0.3);
    this.flowF?.frequency.setTargetAtTime(300 + flow * 500, t, 0.3);
  }

  // ---------- adaptive music ----------
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.schedule(), 60);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer !== null) { window.clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  setTension(v: number) { this.tension = Math.max(0, Math.min(1, v)); }

  private schedule() {
    const ctx = this.ctx; if (!ctx || !this.musicOn) return;
    if (ctx.state !== "running") return;
    const roots = [45, 41, 48, 43]; // A F C G
    const chords: number[][] = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]];
    while (this.nextT < ctx.currentTime + 0.25) {
      const tn = this.tension;
      const bpm = 62 + tn * 52;
      const eighth = 60 / bpm / 2;
      const s = this.step;
      const bar = Math.floor(s / 8) % 4;
      const root = roots[bar];
      const ch = chords[bar];
      const t = this.nextT - ctx.currentTime;
      if (s % 8 === 0) {
        for (const iv of ch) this.musicTone(NOTE(root + 12 + iv), eighth * 7.5, "triangle", 0.08, t, 0.4);
        this.musicTone(NOTE(root), eighth * 7.5, "sine", 0.2, t, 0.1);
      }
      if (tn > 0.2 && s % 2 === 0) this.musicTone(NOTE(root), eighth * 0.9, "sawtooth", 0.06 + tn * 0.05, t, 0.05, 280 + tn * 500);
      if (tn < 0.5 && s % 4 === 2 && Math.random() < 0.6) {
        const pent = [0, 3, 5, 7, 10, 12];
        this.musicTone(NOTE(root + 24 + pent[Math.floor(Math.random() * pent.length)]), eighth * 3, "sine", 0.05, t, 0.02);
      }
      if (tn > 0.3) {
        const iv = ch[(s * 3) % ch.length];
        this.musicTone(NOTE(root + 24 + iv + (s % 4 === 3 ? 12 : 0)), eighth * 0.7, "square", 0.025 + tn * 0.025, t, 0.01, 1800);
      }
      if (tn > 0.5 && s % 2 === 0) this.kick(t, 0.25 + tn * 0.2);
      if (tn > 0.65 && s % 2 === 1) this.hat(t, 0.06 + tn * 0.05);
      this.nextT += eighth;
      this.step++;
    }
  }

  private musicTone(freq: number, dur: number, type: OscillatorType, vol: number, delay: number, attack = 0.02, lp = 1500) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + Math.max(0, delay);
    const o = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = "lowpass"; f.frequency.value = lp;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, attack + 0.05));
    o.connect(f); f.connect(g); g.connect(this.musicG);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }

  private kick(delay: number, vol: number) {
    const ctx = this.ctx; if (!ctx) return;
    const t0 = ctx.currentTime + Math.max(0, delay);
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.frequency.setValueAtTime(130, t0); o.frequency.exponentialRampToValueAtTime(40, t0 + 0.15);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.2);
    o.connect(g); g.connect(this.musicG); o.start(t0); o.stop(t0 + 0.25);
  }

  private hat(delay: number, vol: number) {
    const ctx = this.ctx; if (!ctx || !this.noiseBuf) return;
    const t0 = ctx.currentTime + Math.max(0, delay);
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
    s.connect(f); f.connect(g); g.connect(this.musicG); s.start(t0, Math.random()); s.stop(t0 + 0.08);
  }

  /** Stops everything that loops (used when leaving a shift). */
  silence() {
    this.stopMusic();
    this.stopAmbient();
  }
}

export const audio = new AudioEngine();
