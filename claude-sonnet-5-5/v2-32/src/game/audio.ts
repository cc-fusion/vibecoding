import { SCALE, midiFreq } from './data';
import type { InstId } from './data';

interface ToneOpts {
  type?: OscillatorType;
  f: number;
  f2?: number;
  dur: number;
  vol: number;
  att?: number;
  bus?: GainNode;
  filt?: { type: BiquadFilterType; f: number; f2?: number; q?: number };
  detune?: number;
  vib?: number;
  t?: number;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private active = 0;
  private lastHit = 0;
  private pad: { oscs: OscillatorNode[]; filt: BiquadFilterNode; gain: GainNode } | null = null;
  private menuTimer: number | null = null;
  vol = { master: 0.8, music: 0.7, sfx: 0.8, muted: false };

  ensure(): boolean {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return false;
        const ctx = new AC();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        this.master = ctx.createGain();
        this.music = ctx.createGain();
        this.sfxBus = ctx.createGain();
        this.music.connect(this.master);
        this.sfxBus.connect(this.master);
        this.master.connect(comp);
        comp.connect(ctx.destination);
        const len = ctx.sampleRate * 2;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this.applyVol();
      } catch {
        this.ctx = null;
        return false;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
    return !!this.ctx;
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVol();
  }

  private applyVol() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.vol.muted ? 0 : this.vol.master, t, 0.03);
    this.music.gain.setTargetAtTime(this.vol.music, t, 0.03);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
  }

  private tone(o: ToneOpts) {
    const ctx = this.ctx;
    if (!ctx || this.active > 60) return;
    const t = o.t ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const att = o.att ?? 0.008;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol, t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node: AudioNode = osc;
    if (o.filt) {
      const f = ctx.createBiquadFilter();
      f.type = o.filt.type;
      f.frequency.setValueAtTime(o.filt.f, t);
      if (o.filt.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.filt.f2), t + o.dur);
      f.Q.value = o.filt.q ?? 1;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.bus ?? this.sfxBus);
    let lfo: OscillatorNode | null = null;
    if (o.vib) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const lg = ctx.createGain();
      lg.gain.value = o.vib;
      lfo.connect(lg);
      lg.connect(osc.detune);
      lfo.start(t);
      lfo.stop(t + o.dur + 0.05);
    }
    this.active++;
    osc.onended = () => { this.active--; };
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }

  private noise(dur: number, vol: number, ftype: BiquadFilterType, f: number, f2?: number, bus?: GainNode, q = 1, t0?: number) {
    const ctx = this.ctx;
    if (!ctx || this.active > 60) return;
    const t = t0 ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = ftype;
    flt.frequency.setValueAtTime(f, t);
    if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    flt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt);
    flt.connect(g);
    g.connect(bus ?? this.sfxBus);
    this.active++;
    src.onended = () => { this.active--; };
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /** play a composed note from an instrument */
  playInst(inst: InstId, midi: number, accent: boolean, vol = 1) {
    if (!this.ensure()) return;
    const f = midiFreq(midi);
    const v = (accent ? 1.25 : 0.85) * vol;
    const m = this.music;
    switch (inst) {
      case 'timpani':
        this.tone({ f: f * 2.2, f2: f, dur: 0.55, vol: 0.5 * v, bus: m, att: 0.004 });
        this.noise(0.08, 0.25 * v, 'lowpass', 900, 200, m);
        break;
      case 'violin':
        this.tone({ type: 'sawtooth', f, dur: 0.38, vol: 0.12 * v, att: 0.05, bus: m, vib: 18, filt: { type: 'lowpass', f: 2400, q: 2 } });
        break;
      case 'horn':
        this.tone({ type: 'sawtooth', f, dur: 0.5, vol: 0.14 * v, att: 0.03, bus: m, filt: { type: 'lowpass', f: 500, f2: 1500, q: 3 } });
        this.tone({ type: 'sawtooth', f: f * 1.005, dur: 0.5, vol: 0.1 * v, att: 0.03, bus: m, filt: { type: 'lowpass', f: 400, f2: 1300, q: 3 } });
        break;
      case 'flute':
        this.tone({ f, dur: 0.4, vol: 0.2 * v, att: 0.04, bus: m, vib: 10 });
        this.noise(0.25, 0.05 * v, 'bandpass', f * 2, undefined, m, 4);
        break;
      case 'harp':
        this.tone({ type: 'triangle', f, dur: 1.0, vol: 0.28 * v, att: 0.004, bus: m });
        this.tone({ f: f * 2, dur: 0.5, vol: 0.08 * v, att: 0.004, bus: m });
        break;
      case 'cymbal':
        this.noise(0.6, 0.18 * v, 'highpass', 6500, undefined, m);
        this.noise(0.25, 0.1 * v, 'bandpass', 9000, undefined, m, 2);
        break;
      case 'musicbox':
        this.tone({ f, dur: 0.7, vol: 0.2 * v, att: 0.002, bus: m });
        this.tone({ f: f * 3.01, dur: 0.25, vol: 0.07 * v, att: 0.002, bus: m });
        break;
    }
  }

  sfx(name: string) {
    if (!this.ensure() || !this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    switch (name) {
      case 'click':
        this.tone({ type: 'square', f: 520, f2: 760, dur: 0.06, vol: 0.06 });
        break;
      case 'hover':
        this.tone({ type: 'sine', f: 900, dur: 0.03, vol: 0.025 });
        break;
      case 'place':
        this.tone({ type: 'triangle', f: 220, f2: 440, dur: 0.15, vol: 0.2 });
        this.noise(0.08, 0.12, 'bandpass', 2400, undefined, undefined, 3);
        break;
      case 'sell':
        this.tone({ type: 'triangle', f: 500, f2: 150, dur: 0.22, vol: 0.18 });
        break;
      case 'upgrade':
        [0, 4, 7, 12].forEach((s, i) => this.tone({ type: 'triangle', f: midiFreq(72 + s), dur: 0.25, vol: 0.14, t: t + i * 0.06 }));
        break;
      case 'deny':
        this.tone({ type: 'square', f: 140, dur: 0.15, vol: 0.09 });
        break;
      case 'hit': {
        const now = performance.now();
        if (now - this.lastHit < 45) return;
        this.lastHit = now;
        this.noise(0.05, 0.1, 'bandpass', 1800 + Math.random() * 900, undefined, undefined, 2);
        this.tone({ type: 'square', f: 300 + Math.random() * 100, f2: 120, dur: 0.06, vol: 0.05 });
        break;
      }
      case 'deflect':
        this.tone({ type: 'sine', f: 1700, f2: 2400, dur: 0.12, vol: 0.09 });
        this.tone({ type: 'sine', f: 2550, dur: 0.1, vol: 0.05 });
        break;
      case 'kill':
        this.tone({ type: 'sawtooth', f: 400, f2: 60, dur: 0.18, vol: 0.1, filt: { type: 'lowpass', f: 1800 } });
        this.noise(0.12, 0.1, 'lowpass', 2500, 400);
        break;
      case 'autoHit': {
        const now = performance.now();
        if (now - this.lastHit < 60) return;
        this.lastHit = now;
        this.tone({ type: 'square', f: 110, f2: 70, dur: 0.12, vol: 0.1 });
        break;
      }
      case 'autoDie':
        this.noise(0.4, 0.2, 'lowpass', 2000, 200);
        this.tone({ type: 'sawtooth', f: 200, f2: 40, dur: 0.4, vol: 0.12 });
        break;
      case 'perfect':
        [0, 7, 12].forEach((s, i) => this.tone({ type: 'sine', f: midiFreq(84 + s), dur: 0.22, vol: 0.12, t: t + i * 0.035 }));
        break;
      case 'good':
        this.tone({ type: 'sine', f: midiFreq(79), dur: 0.15, vol: 0.1 });
        break;
      case 'miss':
        this.tone({ type: 'sawtooth', f: 90, f2: 60, dur: 0.18, vol: 0.09, filt: { type: 'lowpass', f: 400 } });
        break;
      case 'fizzle':
        this.noise(0.1, 0.04, 'bandpass', 700, 300, undefined, 2);
        break;
      case 'mute':
        this.tone({ type: 'sine', f: 400, f2: 80, dur: 0.3, vol: 0.12 });
        break;
      case 'chord':
        [0, 4, 7].forEach((s) => this.tone({ type: 'triangle', f: midiFreq(79 + s), dur: 0.3, vol: 0.05 }));
        break;
      case 'breach':
        this.tone({ type: 'sawtooth', f: 180, f2: 40, dur: 0.6, vol: 0.25, filt: { type: 'lowpass', f: 700 } });
        this.noise(0.5, 0.25, 'lowpass', 1500, 100);
        break;
      case 'wave':
        [0, 7, 12].forEach((s, i) => this.tone({ type: 'sawtooth', f: midiFreq(55 + s), dur: 0.5, vol: 0.09, att: 0.04, t: t + i * 0.1, filt: { type: 'lowpass', f: 1200 } }));
        break;
      case 'boss':
        this.tone({ type: 'sawtooth', f: 90, f2: 35, dur: 1.6, vol: 0.28, att: 0.1, filt: { type: 'lowpass', f: 600, f2: 150 } });
        this.tone({ type: 'sawtooth', f: 93, f2: 38, dur: 1.6, vol: 0.2, att: 0.1, filt: { type: 'lowpass', f: 500, f2: 120 } });
        this.noise(1.4, 0.15, 'lowpass', 600, 80);
        break;
      case 'bossDie':
        this.noise(1.2, 0.3, 'lowpass', 3000, 100);
        [0, 3, 7, 10, 12].forEach((s, i) => this.tone({ type: 'triangle', f: midiFreq(60 + s), dur: 0.5, vol: 0.12, t: t + 0.2 + i * 0.07 }));
        break;
      case 'forte':
        this.tone({ type: 'sawtooth', f: 120, f2: 900, dur: 0.6, vol: 0.14, att: 0.2, filt: { type: 'lowpass', f: 3000 } });
        [0, 4, 7, 12, 16].forEach((s, i) => this.tone({ type: 'triangle', f: midiFreq(60 + s), dur: 0.9, vol: 0.1, t: t + 0.3 + i * 0.02 }));
        break;
      case 'ready':
        [0, 12].forEach((s, i) => this.tone({ type: 'sine', f: midiFreq(88 + s), dur: 0.2, vol: 0.09, t: t + i * 0.08 }));
        break;
      case 'tick':
        this.tone({ type: 'sine', f: 1500, dur: 0.025, vol: 0.05 });
        break;
      case 'boon':
        [0, 4, 7, 11, 14].forEach((s, i) => this.tone({ type: 'triangle', f: midiFreq(67 + s), dur: 0.4, vol: 0.1, t: t + i * 0.07 }));
        break;
      case 'victory':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone({ type: 'triangle', f: midiFreq(60 + s), dur: 1.2, vol: 0.12, att: 0.02, t: t + i * 0.13 }));
        [0, 7].forEach((s, i) => this.tone({ type: 'sawtooth', f: midiFreq(48 + s), dur: 1.8, vol: 0.08, t: t + 0.4 + i * 0.1, filt: { type: 'lowpass', f: 900 } }));
        break;
      case 'defeat':
        [0, -3, -5, -8, -12].forEach((s, i) => this.tone({ type: 'sawtooth', f: midiFreq(60 + s), dur: 1.0, vol: 0.1, att: 0.02, t: t + i * 0.25, filt: { type: 'lowpass', f: 900 } }));
        break;
    }
  }

  // ---------- reactive backing music (driven by the game's sequencer) ----------
  startAmbient(root: number) {
    if (!this.ensure() || !this.ctx) return;
    this.stopAmbient();
    const ctx = this.ctx;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2);
    filt.connect(gain);
    gain.connect(this.music);
    const oscs = [0, 7, 12].map((s, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sawtooth' : 'triangle';
      o.frequency.value = midiFreq(36 + root + s);
      o.detune.value = (i - 1) * 6;
      o.connect(filt);
      o.start();
      return o;
    });
    this.pad = { oscs, filt, gain };
  }

  stopAmbient() {
    if (!this.pad || !this.ctx) return;
    const p = this.pad;
    this.pad = null;
    const t = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setTargetAtTime(0.0001, t, 0.15);
    window.setTimeout(() => {
      p.oscs.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
    }, 900);
  }

  musicStep(step: number, intensity: number, root: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.pad) this.pad.filt.frequency.setTargetAtTime(300 + intensity * 1700, t, 0.3);
    const m = this.music;
    if (step % 8 === 0) this.tone({ type: 'triangle', f: midiFreq(36 + root), dur: 0.5, vol: 0.2, bus: m });
    else if (step % 8 === 4 && intensity > 0.2) this.tone({ type: 'triangle', f: midiFreq(36 + root + SCALE[step % 16 === 4 ? 4 : 2]), dur: 0.35, vol: 0.12, bus: m });
    if (step % 2 === 0) this.noise(0.04, 0.025 + 0.04 * intensity, 'highpass', 7000, undefined, m);
    if (intensity > 0.5 && step % 2 === 1) {
      const deg = [0, 2, 4, 2, 6, 4][(step >> 1) % 6];
      this.tone({ type: 'triangle', f: midiFreq(72 + root + SCALE[deg]), dur: 0.18, vol: 0.035 * intensity, bus: m });
    }
  }

  // ---------- menu ambience ----------
  startMenu() {
    if (this.menuTimer !== null) return;
    if (!this.ensure()) return;
    let i = 0;
    const seq = [0, 2, 4, 7, 4, 2, 3, 5, 7, 5, 4, 2];
    this.menuTimer = window.setInterval(() => {
      if (!this.ctx) return;
      const deg = seq[i % seq.length];
      this.tone({ type: 'sine', f: midiFreq(72 + deg + (i % 24 > 11 ? 5 : 0)), dur: 1.4, vol: 0.09, att: 0.004, bus: this.music });
      this.tone({ f: midiFreq(72 + deg + 12), dur: 0.5, vol: 0.025, att: 0.002, bus: this.music });
      if (i % 4 === 0) this.tone({ type: 'triangle', f: midiFreq(41 + (i % 24 > 11 ? 5 : 0)), dur: 2, vol: 0.12, att: 0.1, bus: this.music });
      i++;
    }, 520);
  }

  stopMenu() {
    if (this.menuTimer !== null) {
      window.clearInterval(this.menuTimer);
      this.menuTimer = null;
    }
  }
}

export const audio = new AudioEngine();
