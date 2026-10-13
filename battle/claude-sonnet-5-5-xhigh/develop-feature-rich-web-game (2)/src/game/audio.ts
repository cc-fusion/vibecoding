// Fully synthesized audio: SFX + generative, reactive music (Web Audio API)
const NOTE = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Mood { tempo: number; root: number; scale: number[]; prog: number[][]; arp: number; lead: OscillatorType; drums: number; bass: number; pad: number; }
const MOODS: Record<string, Mood> = {
  title: { tempo: 76, root: 57, scale: [0, 3, 5, 7, 10], prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], arp: 0.5, lead: 'triangle', drums: 0, bass: 1, pad: 1 },
  day: { tempo: 92, root: 60, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]], arp: 0.5, lead: 'triangle', drums: 0, bass: 1, pad: 0.8 },
  night: { tempo: 64, root: 57, scale: [0, 3, 5, 7, 10], prog: [[0, 3, 7], [-5, -2, 2], [-4, 0, 3], [-2, 2, 5]], arp: 0.28, lead: 'sine', drums: 0, bass: 0.6, pad: 1.2 },
  cave: { tempo: 54, root: 50, scale: [0, 3, 5, 6, 7, 10], prog: [[0, 3, 7], [1, 5, 8], [0, 3, 6], [-2, 2, 5]], arp: 0.22, lead: 'sine', drums: 0, bass: 0.5, pad: 1.3 },
  hell: { tempo: 100, root: 45, scale: [0, 1, 4, 5, 7, 8], prog: [[0, 4, 7], [1, 5, 8], [0, 4, 7], [-2, 2, 5]], arp: 0.45, lead: 'sawtooth', drums: 1, bass: 1.4, pad: 1 },
  boss: { tempo: 142, root: 52, scale: [0, 3, 5, 7, 8, 10], prog: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]], arp: 0.7, lead: 'square', drums: 2, bass: 2, pad: 0.7 },
  event: { tempo: 112, root: 50, scale: [0, 3, 5, 6, 8, 10], prog: [[0, 3, 6], [1, 4, 8], [0, 3, 6], [-2, 1, 5]], arp: 0.5, lead: 'sawtooth', drums: 2, bass: 1.5, pad: 0.9 },
  desert: { tempo: 80, root: 57, scale: [0, 2, 3, 6, 7, 8], prog: [[0, 3, 7], [-2, 2, 5], [0, 3, 7], [-4, 0, 3]], arp: 0.45, lead: 'triangle', drums: 0, bass: 1, pad: 0.8 },
  snow: { tempo: 70, root: 62, scale: [0, 2, 4, 7, 9], prog: [[0, 4, 7], [-3, 0, 4], [-5, -1, 2], [-7, -3, 0]], arp: 0.4, lead: 'sine', drums: 0, bass: 0.5, pad: 1.2 },
  jungle: { tempo: 104, root: 55, scale: [0, 2, 4, 5, 7, 9], prog: [[0, 4, 7], [-2, 2, 5], [-3, 0, 4], [-5, -1, 2]], arp: 0.5, lead: 'triangle', drums: 1, bass: 1, pad: 0.6 },
  blight: { tempo: 60, root: 48, scale: [0, 1, 3, 6, 7], prog: [[0, 3, 6], [1, 4, 7]], arp: 0.25, lead: 'sawtooth', drums: 0, bass: 0.8, pad: 1.2 },
  victory: { tempo: 120, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: 0.8, lead: 'triangle', drums: 1, bass: 1, pad: 1 },
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode; sfxG!: GainNode; musG!: GainNode; comp!: DynamicsCompressorNode; delayIn!: GainNode;
  noiseBuf: AudioBuffer | null = null;
  vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  muted = false; ducked = false;
  mood = 'title'; intensity = 0;
  private timer: any = null; private nextTime = 0; private step = 0; private bar = 0; private last: Record<string, number> = {};

  init() {
    if (this.ctx) return;
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = new AC(); this.ctx = ctx;
      this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 6;
      this.master = ctx.createGain(); this.sfxG = ctx.createGain(); this.musG = ctx.createGain();
      this.sfxG.connect(this.master); this.musG.connect(this.master); this.master.connect(this.comp); this.comp.connect(ctx.destination);
      const nb = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate); const d = nb.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
      // delay send for music
      this.delayIn = ctx.createGain(); const dl = ctx.createDelay(1.0); dl.delayTime.value = 0.34; const fb = ctx.createGain(); fb.gain.value = 0.38;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      this.delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.musG);
      this.applyVolumes();
    } catch { this.ctx = null; }
  }
  resume() { this.init(); if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  applyVolumes() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol.master, t, 0.03);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx, t, 0.03);
    this.musG.gain.setTargetAtTime(this.vol.music * 0.55 * (this.ducked ? 0.35 : 1), t, 0.1);
  }
  setVolumes(master: number, music: number, sfx: number, muted: boolean) { this.vol = { master, music, sfx }; this.muted = muted; this.applyVolumes(); }
  setDuck(d: boolean) { this.ducked = d; this.applyVolumes(); }

  private tone(f: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxG); o.start(t); o.stop(t + dur + 0.02);
  }
  private noise(dur: number, vol: number, ftype: BiquadFilterType, f0: number, f1: number, delay = 0, dest?: AudioNode) {
    const c = this.ctx; if (!c || !this.noiseBuf) return; const t = c.currentTime + delay;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfxG); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  sfx(name: string, p = 1) {
    const c = this.ctx; if (!c || this.muted) return;
    const now = c.currentTime; if (this.last[name] && now - this.last[name] < 0.035) return; this.last[name] = now;
    const v = 0.9 + Math.random() * 0.2; const f = p * v;
    const T = (fr: number, d: number, ty: OscillatorType, vo: number, sl = 0, de = 0) => this.tone(fr * f, d, ty, vo, sl * f, de);
    switch (name) {
      case 'dig_dirt': this.noise(0.09, 0.5, 'lowpass', 500, 200); T(90, 0.07, 'sine', 0.35); break;
      case 'dig_stone': this.noise(0.06, 0.4, 'highpass', 2200, 1500); T(520, 0.05, 'square', 0.1); T(300, 0.06, 'triangle', 0.2); break;
      case 'dig_wood': T(190, 0.08, 'triangle', 0.4, 120); this.noise(0.05, 0.25, 'bandpass', 900, 500); break;
      case 'dig_metal': T(900, 0.12, 'sine', 0.2); T(1350, 0.1, 'sine', 0.12); this.noise(0.03, 0.2, 'highpass', 3000, 2000); break;
      case 'dig_glass': T(2200, 0.07, 'sine', 0.15); T(3300, 0.05, 'sine', 0.08); break;
      case 'dig_plant': this.noise(0.08, 0.25, 'bandpass', 3000, 1800); break;
      case 'break': this.noise(0.2, 0.55, 'lowpass', 1100, 150); T(70, 0.15, 'sine', 0.4); break;
      case 'place': T(260, 0.07, 'triangle', 0.35, 170); this.noise(0.04, 0.2, 'lowpass', 900, 400); break;
      case 'jump': T(260, 0.1, 'square', 0.08, 520); break;
      case 'land': this.noise(0.09, 0.4, 'lowpass', 400, 120); break;
      case 'swing': this.noise(0.14, 0.22, 'bandpass', 1000, 3200); break;
      case 'hit': this.noise(0.09, 0.45, 'bandpass', 700, 300); T(170, 0.1, 'sawtooth', 0.2, 80); break;
      case 'crit': this.noise(0.1, 0.5, 'bandpass', 900, 300); T(170, 0.12, 'sawtooth', 0.25, 80); T(950, 0.18, 'triangle', 0.2, 1400); break;
      case 'hurt': T(320, 0.24, 'sawtooth', 0.3, 110); this.noise(0.1, 0.3, 'lowpass', 800, 200); break;
      case 'die': [400, 320, 240, 160, 100].forEach((x, i) => T(x, 0.25, 'sawtooth', 0.25, x * 0.8, i * 0.12)); break;
      case 'kill': T(220, 0.14, 'square', 0.12, 90); break;
      case 'shoot': this.noise(0.08, 0.3, 'highpass', 3000, 900); T(700, 0.1, 'square', 0.1, 200); break;
      case 'gun': this.noise(0.16, 0.6, 'lowpass', 4500, 250); T(110, 0.12, 'square', 0.25, 50); break;
      case 'magic': T(600, 0.16, 'sine', 0.2, 1200); T(900, 0.14, 'triangle', 0.1, 1500, 0.04); break;
      case 'fire': this.noise(0.25, 0.3, 'bandpass', 1500, 400); T(300, 0.2, 'sawtooth', 0.12, 120); break;
      case 'explosion': this.noise(0.7, 0.85, 'lowpass', 2000, 80); T(60, 0.6, 'sine', 0.6, 30); break;
      case 'coin': T(1320, 0.07, 'square', 0.08); T(1760, 0.14, 'square', 0.08, 0, 0.06); break;
      case 'pickup': T(700, 0.08, 'sine', 0.18, 1000); break;
      case 'craft': [523, 659, 784].forEach((x, i) => T(x, 0.14, 'triangle', 0.2, 0, i * 0.07)); this.noise(0.05, 0.2, 'highpass', 2500, 2000); break;
      case 'ui': T(820, 0.04, 'square', 0.06); break;
      case 'open': T(480, 0.08, 'triangle', 0.15, 720); break;
      case 'close': T(720, 0.08, 'triangle', 0.15, 480); break;
      case 'error': T(160, 0.15, 'square', 0.12, 120); break;
      case 'boss': T(70, 1.0, 'sawtooth', 0.4, 38); T(75, 1.0, 'square', 0.15, 40); this.noise(0.9, 0.4, 'lowpass', 600, 80); break;
      case 'roar': T(110, 0.7, 'sawtooth', 0.35, 50); this.noise(0.6, 0.35, 'bandpass', 500, 120); break;
      case 'level': [523, 659, 784, 1047].forEach((x, i) => T(x, 0.22, 'triangle', 0.22, 0, i * 0.09)); break;
      case 'splash': this.noise(0.25, 0.35, 'bandpass', 1400, 500); break;
      case 'heal': [440, 554, 659, 880].forEach((x, i) => T(x, 0.14, 'sine', 0.18, 0, i * 0.06)); break;
      case 'mana': [660, 880, 1100].forEach((x, i) => T(x, 0.12, 'sine', 0.15, 0, i * 0.05)); break;
      case 'drink': [300, 250, 300].forEach((x, i) => T(x, 0.08, 'sine', 0.2, x * 0.7, i * 0.07)); break;
      case 'star': [1800, 2400, 3000, 2400].forEach((x, i) => T(x, 0.2, 'sine', 0.1, 0, i * 0.07)); break;
      case 'npc': T(500, 0.06, 'triangle', 0.15); T(650, 0.08, 'triangle', 0.15, 0, 0.07); break;
      case 'laser': T(1400, 0.22, 'sawtooth', 0.12, 200); break;
      case 'win': [523, 659, 784, 1047, 784, 1047, 1319].forEach((x, i) => T(x, 0.3, 'triangle', 0.25, 0, i * 0.14)); break;
      case 'lose': [330, 311, 294, 262, 196].forEach((x, i) => T(x, 0.4, 'sawtooth', 0.15, x * 0.97, i * 0.22)); break;
      case 'door': this.noise(0.1, 0.25, 'lowpass', 700, 250); T(130, 0.1, 'triangle', 0.2); break;
      case 'recall': [880, 1100, 1320, 1760].forEach((x, i) => T(x, 0.3, 'sine', 0.14, x * 1.2, i * 0.1)); break;
      case 'grapple': T(300, 0.08, 'square', 0.1, 800); this.noise(0.06, 0.3, 'highpass', 2500, 4000); break;
      case 'bed': [330, 392, 330].forEach((x, i) => T(x, 0.3, 'sine', 0.12, 0, i * 0.15)); break;
    }
  }

  setMood(m: string) { if (MOODS[m] && this.mood !== m) { this.mood = m; this.bar = 0; this.step = 0; } }
  setIntensity(x: number) { this.intensity = Math.max(0, Math.min(1, x)); }
  startMusic() {
    this.init(); if (!this.ctx || this.timer) return;
    this.nextTime = this.ctx.currentTime + 0.1; this.step = 0; this.bar = 0;
    this.timer = setInterval(() => this.tick(), 40);
  }
  stopMusic() { if (this.timer) { clearInterval(this.timer); this.timer = null; } }
  private tick() {
    const c = this.ctx; if (!c) return;
    if (c.state !== 'running') { this.nextTime = c.currentTime + 0.1; return; }
    const m = MOODS[this.mood];
    while (this.nextTime < c.currentTime + 0.22) {
      const sd = 60 / m.tempo / 2; this.sched(m, this.nextTime, sd); this.nextTime += sd; this.step++; if (this.step % 8 === 0) this.bar++;
    }
  }
  private sched(m: Mood, t: number, sd: number) {
    const c = this.ctx!; const s = this.step % 8; const chord = m.prog[this.bar % m.prog.length];
    const inten = this.intensity; const R = Math.random;
    const osc = (f: number, type: OscillatorType, t0: number, dur: number, vol: number, dest: AudioNode, a = 0.005, send = 0, lpf = 0, det = 0) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; o.detune.value = det;
      g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      let node: AudioNode = o;
      if (lpf) { const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lpf; o.connect(fl); node = fl; }
      node.connect(g); g.connect(dest); if (send) { const sg = c.createGain(); sg.gain.value = send; g.connect(sg); sg.connect(this.delayIn); }
      o.start(t0); o.stop(t0 + dur + 0.05);
    };
    if (s === 0) { // pad
      const dur = sd * 8;
      for (const iv of chord) { const f = NOTE(m.root + iv); osc(f, 'sawtooth', t, dur * 1.05, 0.05 * m.pad, this.musG, dur * 0.35, 0.15, 800 + inten * 600, -7); osc(f * 2, 'sine', t, dur * 1.05, 0.03 * m.pad, this.musG, dur * 0.4, 0.2, 0, 7); }
    }
    // bass
    const bassHit = m.bass >= 2 ? true : m.bass >= 1.4 ? s % 2 === 0 : m.bass >= 1 ? (s === 0 || s === 4 || (inten > 0.5 && s === 6)) : (s === 0 || (m.bass > 0.55 && s === 4));
    if (bassHit) osc(NOTE(m.root + chord[0] - 24 + (s === 6 ? 7 : 0)), m.bass >= 2 ? 'sawtooth' : 'triangle', t, sd * (m.bass >= 2 ? 0.9 : 1.8), 0.16, this.musG, 0.01, 0, m.bass >= 2 ? 500 : 0);
    // arp/lead
    const p = m.arp + inten * 0.25;
    if (R() < p && (s % 2 === 0 || R() < 0.45)) {
      const sc = m.scale; const idx = Math.floor(R() * sc.length); const oct = R() < 0.3 ? 24 : 12;
      const note = m.root + chord[0] + sc[idx] + oct;
      osc(NOTE(note), m.lead, t, sd * (m.lead === 'sine' ? 3 : 1.4), m.lead === 'square' ? 0.045 : 0.09, this.musG, 0.006, 0.45, m.lead === 'sawtooth' ? 1800 : 0);
    }
    // drums
    const dl = Math.max(m.drums, inten > 0.65 ? 1 : 0);
    if (dl > 0) {
      const kick = dl >= 2 ? (s === 0 || s === 3 || s === 4 || s === 6) : (s === 0 || s === 4);
      if (kick) { this.tone(110, 0.14, 'sine', 0.35, 40, t - c.currentTime, this.musG); }
      if (dl >= 2 && (s === 2 || s === 6)) this.noise(0.12, 0.28, 'bandpass', 1800, 900, t - c.currentTime, this.musG);
      if (dl >= 1 && (s % 2 === 1 || dl >= 2)) this.noise(0.04, 0.1, 'highpass', 7000, 6000, t - c.currentTime, this.musG);
    }
  }
}
export const audio = new AudioEngine();
