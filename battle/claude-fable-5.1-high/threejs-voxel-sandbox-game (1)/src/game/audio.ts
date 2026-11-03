// Procedural Web Audio: SFX, ambience, generative music. No external assets.
import type { SoundMat } from "./blocks";

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxGain!: GainNode;
  musicGain!: GainNode;
  ambGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private rainNode: { gain: GainNode; src: AudioBufferSourceNode } | null = null;
  private windNode: { gain: GainNode; filter: BiquadFilterNode } | null = null;
  private musicTimer = 0;
  private musicEnabled = true;
  volumes = { master: 0.8, sfx: 1, music: 0.5, ambient: 0.7 };
  listener = { x: 0, y: 0, z: 0, yaw: 0 };

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.ambGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain.connect(this.master);
    this.ambGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    // noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbience();
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.volumes.master;
    this.sfxGain.gain.value = this.volumes.sfx;
    this.musicGain.gain.value = this.volumes.music;
    this.ambGain.gain.value = this.volumes.ambient;
  }

  private startAmbience() {
    const ctx = this.ctx!;
    // wind: filtered noise with slow LFO
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.03;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.08;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    src.connect(filter).connect(gain).connect(this.ambGain);
    src.start();
    this.windNode = { gain, filter };
    // rain
    const rs = ctx.createBufferSource();
    rs.buffer = this.noiseBuf;
    rs.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = "highpass";
    rf.frequency.value = 1200;
    const rg = ctx.createGain();
    rg.gain.value = 0;
    rs.connect(rf).connect(rg).connect(this.ambGain);
    rs.start(0, 0.7);
    this.rainNode = { gain: rg, src: rs };
  }

  /** Update ambience based on environment */
  updateAmbience(dt: number, rain: number, underground: boolean, underwater: boolean, night: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.rainNode) this.rainNode.gain.gain.setTargetAtTime(underwater ? 0 : rain * 0.25 * (underground ? 0.2 : 1), t, 0.5);
    if (this.windNode) {
      this.windNode.gain.gain.setTargetAtTime(underwater ? 0.01 : underground ? 0.015 : night ? 0.05 : 0.035, t, 1);
      this.windNode.filter.frequency.setTargetAtTime(underground ? 150 : underwater ? 100 : 400, t, 1);
    }
    // generative music
    this.musicTimer -= dt;
    if (this.musicTimer <= 0 && this.musicEnabled && this.volumes.music > 0) {
      this.musicTimer = 12 + Math.random() * 20;
      this.playMusicPhrase(night || underground);
    }
  }

  private playMusicPhrase(minor: boolean) {
    const ctx = this.ctx!;
    const scale = minor ? [0, 3, 5, 7, 10, 12, 15] : [0, 2, 4, 7, 9, 12, 14];
    const root = minor ? 220 : 261.63;
    const notes = 3 + Math.floor(Math.random() * 5);
    let t = ctx.currentTime + 0.1;
    // pad chord
    for (const deg of [0, minor ? 3 : 4, 7]) {
      this.tone(root * Math.pow(2, scale[deg % scale.length] / 12) / 2, t, 6, 0.035, "sine", this.musicGain, 2.5);
    }
    for (let i = 0; i < notes; i++) {
      const deg = scale[Math.floor(Math.random() * scale.length)];
      const f = root * Math.pow(2, deg / 12);
      this.tone(f, t, 1.8 + Math.random(), 0.06, "triangle", this.musicGain, 0.02);
      t += 0.5 + Math.random() * 0.9;
    }
  }

  private tone(freq: number, when: number, dur: number, vol: number, type: OscillatorType, out: AudioNode, attack = 0.01, detune = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g).connect(out);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  private noise(when: number, dur: number, vol: number, filterType: BiquadFilterType, freq: number, q: number, out: AudioNode, pitchEnv = 0) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.setValueAtTime(freq, when);
    if (pitchEnv) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * pitchEnv), when + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(out);
    src.start(when, Math.random() * 1.5);
    src.stop(when + dur + 0.05);
  }

  /** Creates a spatialized output node for a world position (simple distance + pan). */
  private spatial(x?: number, y?: number, z?: number): AudioNode {
    const ctx = this.ctx!;
    if (x === undefined || y === undefined || z === undefined) return this.sfxGain;
    const dx = x - this.listener.x, dy = y - this.listener.y, dz = z - this.listener.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const g = ctx.createGain();
    g.gain.value = 1 / (1 + d * d * 0.02);
    const pan = ctx.createStereoPanner();
    // pan relative to yaw
    const rx = dx * Math.cos(this.listener.yaw) - dz * Math.sin(this.listener.yaw);
    pan.pan.value = Math.max(-1, Math.min(1, rx / (d + 1)));
    g.connect(pan).connect(this.sfxGain);
    return g;
  }

  play(name: string, x?: number, y?: number, z?: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.spatial(x, y, z);
    const r = Math.random();
    switch (name) {
      case "dig_stone": this.noise(t, 0.12, 0.35, "lowpass", 900 + r * 300, 1, out, 0.4); break;
      case "dig_wood": this.noise(t, 0.1, 0.3, "bandpass", 500 + r * 150, 2, out); this.tone(180 + r * 40, t, 0.08, 0.15, "triangle", out); break;
      case "dig_grass": this.noise(t, 0.12, 0.25, "bandpass", 1800 + r * 400, 1.5, out, 0.5); break;
      case "dig_sand": this.noise(t, 0.15, 0.22, "highpass", 2500 + r * 500, 1, out); break;
      case "dig_gravel": this.noise(t, 0.12, 0.3, "bandpass", 1200 + r * 300, 1, out, 0.6); break;
      case "dig_glass": this.noise(t, 0.2, 0.3, "highpass", 4000, 2, out); this.tone(2400 + r * 800, t, 0.15, 0.08, "sine", out); break;
      case "dig_cloth": this.noise(t, 0.12, 0.2, "lowpass", 1500, 0.5, out); break;
      case "dig_snow": this.noise(t, 0.12, 0.2, "bandpass", 3000, 1, out); break;
      case "dig_liquid": this.noise(t, 0.2, 0.2, "bandpass", 800, 1, out, 2); break;
      case "break": this.noise(t, 0.25, 0.4, "lowpass", 1400, 0.8, out, 0.3); this.tone(120, t, 0.12, 0.2, "square", out); break;
      case "place": this.noise(t, 0.08, 0.3, "lowpass", 1200, 1, out, 0.5); this.tone(200 + r * 60, t, 0.06, 0.12, "triangle", out); break;
      case "step_stone": this.noise(t, 0.07, 0.12, "lowpass", 800 + r * 300, 1, out, 0.5); break;
      case "step_wood": this.noise(t, 0.07, 0.1, "bandpass", 400 + r * 100, 2, out); break;
      case "step_grass": this.noise(t, 0.09, 0.08, "bandpass", 2000 + r * 500, 1, out, 0.6); break;
      case "step_sand": this.noise(t, 0.1, 0.08, "highpass", 2500, 1, out); break;
      case "step_gravel": this.noise(t, 0.08, 0.1, "bandpass", 1300, 1, out, 0.6); break;
      case "step_snow": this.noise(t, 0.1, 0.08, "bandpass", 2800, 1, out); break;
      case "step_cloth": this.noise(t, 0.08, 0.06, "lowpass", 1500, 0.5, out); break;
      case "step_glass": this.noise(t, 0.07, 0.1, "highpass", 3000, 1, out); break;
      case "step_liquid": this.noise(t, 0.15, 0.08, "bandpass", 900, 1, out, 1.5); break;
      case "splash": this.noise(t, 0.5, 0.35, "bandpass", 700, 0.8, out, 2.5); break;
      case "swim": this.noise(t, 0.3, 0.1, "bandpass", 600, 1, out, 1.8); break;
      case "hurt": this.tone(300, t, 0.25, 0.3, "sawtooth", out, 0.005); this.tone(200, t + 0.05, 0.25, 0.2, "square", out); break;
      case "death": for (let i = 0; i < 4; i++) this.tone(300 - i * 60, t + i * 0.15, 0.3, 0.25, "sawtooth", out); break;
      case "eat": for (let i = 0; i < 3; i++) this.noise(t + i * 0.18, 0.1, 0.25, "lowpass", 600, 1, out, 0.5); break;
      case "burp": this.tone(90, t, 0.3, 0.3, "sawtooth", out, 0.02); break;
      case "pickup": this.tone(900 + r * 300, t, 0.12, 0.15, "sine", out); this.tone(1400 + r * 300, t + 0.06, 0.12, 0.12, "sine", out); break;
      case "craft": this.noise(t, 0.1, 0.2, "bandpass", 1000, 2, out); this.tone(600, t + 0.05, 0.1, 0.1, "triangle", out); break;
      case "click": this.tone(800, t, 0.04, 0.15, "square", out); break;
      case "open": this.noise(t, 0.12, 0.15, "bandpass", 700, 1, out); break;
      case "levelup": for (let i = 0; i < 4; i++) this.tone(523 * Math.pow(2, [0, 4, 7, 12][i] / 12), t + i * 0.09, 0.4, 0.12, "triangle", out); break;
      case "achievement": for (let i = 0; i < 3; i++) this.tone(660 * Math.pow(2, [0, 5, 9][i] / 12), t + i * 0.12, 0.6, 0.1, "sine", out); break;
      case "hit": this.noise(t, 0.08, 0.3, "lowpass", 500, 1, out); this.tone(150, t, 0.08, 0.2, "square", out); break;
      case "swing": this.noise(t, 0.12, 0.08, "bandpass", 1500, 1, out, 0.3); break;
      case "thunder": this.noise(t + 0.1, 2.5, 0.6, "lowpass", 250, 0.7, out, 0.3); this.noise(t, 0.3, 0.4, "lowpass", 2000, 0.5, out, 0.1); break;
      case "fire": this.noise(t, 0.3, 0.1, "bandpass", 2500, 1, out); break;
      case "tool_break": this.noise(t, 0.2, 0.3, "highpass", 2000, 1, out); this.tone(400, t, 0.15, 0.2, "sawtooth", out); this.tone(250, t + 0.1, 0.2, 0.2, "sawtooth", out); break;
      case "pig": this.tone(240 + r * 40, t, 0.18, 0.2, "sawtooth", out, 0.02); this.tone(320, t + 0.12, 0.15, 0.15, "sawtooth", out, 0.02); break;
      case "pig_hurt": this.tone(400, t, 0.2, 0.25, "sawtooth", out, 0.01); break;
      case "sheep": { const o = this.vibrato(330 + r * 30, t, 0.6, 0.18, "sawtooth", out, 9, 12); void o; break; }
      case "sheep_hurt": this.vibrato(420, t, 0.4, 0.25, "sawtooth", out, 12, 20); break;
      case "cow": this.vibrato(110 + r * 15, t, 1.0, 0.25, "sawtooth", out, 4, 6); break;
      case "cow_hurt": this.vibrato(170, t, 0.5, 0.25, "sawtooth", out, 8, 10); break;
      case "chicken": for (let i = 0; i < 3; i++) this.tone(900 + r * 200 - i * 80, t + i * 0.12, 0.1, 0.1, "square", out); break;
      case "chicken_hurt": this.tone(1200, t, 0.15, 0.15, "square", out); break;
      case "zombie": this.vibrato(90 + r * 20, t, 1.2, 0.25, "sawtooth", out, 3, 10); this.noise(t, 1.0, 0.08, "lowpass", 400, 1, out); break;
      case "zombie_hurt": this.vibrato(140, t, 0.5, 0.3, "sawtooth", out, 6, 15); break;
      case "zombie_attack": this.noise(t, 0.15, 0.3, "lowpass", 600, 1, out); this.vibrato(120, t, 0.4, 0.3, "sawtooth", out, 8, 20); break;
      case "bed": for (let i = 0; i < 3; i++) this.tone(440 * Math.pow(2, [0, -5, -12][i] / 12), t + i * 0.2, 0.6, 0.1, "sine", out); break;
      case "fizz": this.noise(t, 0.5, 0.25, "highpass", 3000, 1, out); break;
      case "bubble": this.tone(600 + r * 400, t, 0.1, 0.05, "sine", out); break;
    }
  }

  private vibrato(freq: number, when: number, dur: number, vol: number, type: OscillatorType, out: AudioNode, rate: number, depth: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = rate;
    const lg = ctx.createGain();
    lg.gain.value = depth;
    lfo.connect(lg).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq * 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.05);
    g.gain.setValueAtTime(vol, when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f).connect(g).connect(out);
    o.start(when);
    lfo.start(when);
    o.stop(when + dur + 0.05);
    lfo.stop(when + dur + 0.05);
    return o;
  }

  playMat(prefix: "dig" | "step", mat: SoundMat, x?: number, y?: number, z?: number) {
    this.play(`${prefix}_${mat}`, x, y, z);
  }
}
