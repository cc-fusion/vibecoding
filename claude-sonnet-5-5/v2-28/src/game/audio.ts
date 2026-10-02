// Fully synthesized audio: sfx, ambience (rain / wind) and generative reactive music.

type OscT = OscillatorType;

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [48, 52, 55, 59], // Cmaj7
  [55, 59, 62, 65], // G7
];

class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicG: GainNode | null = null;
  sfxG: GainNode | null = null;
  ambG: GainNode | null = null;
  noiseBuf: AudioBuffer | null = null;
  rainG: GainNode | null = null;
  windG: GainNode | null = null;
  windF: BiquadFilterElement | null = null;
  delay: DelayNode | null = null;
  vol = { master: 0.7, music: 0.55, sfx: 0.8, muted: false };
  intensity = 0.15;
  musicOn = false;
  timer: number | null = null;
  nextT = 0;
  step = 0;
  last: Record<string, number> = {};
  suspended = false;

  init() {
    if (this.ctx) {
      this.resume();
      return;
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.connect(ctx.destination);
      this.musicG = ctx.createGain();
      this.sfxG = ctx.createGain();
      this.ambG = ctx.createGain();
      this.musicG.connect(this.master);
      this.sfxG.connect(this.master);
      this.ambG.connect(this.master);
      // noise buffer
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      let b0 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.97 * b0 + 0.03 * w;
        d[i] = w * 0.6 + b0 * 3;
      }
      this.noiseBuf = buf;
      // echo for music
      this.delay = ctx.createDelay(1);
      this.delay.delayTime.value = 0.36;
      const fb = ctx.createGain();
      fb.gain.value = 0.34;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800;
      this.delay.connect(lp);
      lp.connect(fb);
      fb.connect(this.delay);
      lp.connect(this.musicG);
      // ambient loops
      const mk = (type: BiquadFilterType, f: number, q: number) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const fl = ctx.createBiquadFilter();
        fl.type = type;
        fl.frequency.value = f;
        fl.Q.value = q;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(fl);
        fl.connect(g);
        g.connect(this.ambG!);
        src.start();
        return { g, fl };
      };
      const rain = mk("bandpass", 3200, 0.6);
      this.rainG = rain.g;
      const wind = mk("bandpass", 420, 1.2);
      this.windG = wind.g;
      this.windF = wind.fl as unknown as BiquadFilterElement;
      this.applyVolume();
    } catch {
      this.ctx = null;
    }
  }

  applyVolume() {
    if (!this.ctx || !this.master || !this.musicG || !this.sfxG || !this.ambG) return;
    const t = this.ctx.currentTime;
    const m = this.vol.muted ? 0 : this.vol.master;
    this.master.gain.setTargetAtTime(m, t, 0.03);
    this.musicG.gain.setTargetAtTime(this.vol.music * 0.5, t, 0.05);
    this.sfxG.gain.setTargetAtTime(this.vol.sfx * 0.8, t, 0.05);
    this.ambG.gain.setTargetAtTime(this.vol.sfx * 0.5, t, 0.05);
  }

  setVolumes(v: { master: number; music: number; sfx: number; muted: boolean }) {
    this.vol = { ...v };
    this.applyVolume();
  }

  pause() {
    if (this.ctx && this.ctx.state === "running") {
      this.suspended = true;
      this.ctx.suspend().catch(() => undefined);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state !== "running") {
      this.ctx.resume().catch(() => undefined);
    }
    this.suspended = false;
  }

  // ---- primitives ----
  private ok(key: string, gap: number): boolean {
    if (!this.ctx) return false;
    const now = performance.now();
    if (now - (this.last[key] || 0) < gap) return false;
    this.last[key] = now;
    return true;
  }

  tone(f: number, dur: number, type: OscT = "sine", vol = 0.2, slide = 0, delay = 0, dest?: AudioNode, attack = 0.005) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxG) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(dest || this.sfxG);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  noise(dur: number, type: BiquadFilterType, f: number, vol = 0.2, slide = 0, delay = 0, q = 0.8) {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.sfxG) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.Q.value = q;
    fl.frequency.setValueAtTime(f, t);
    if (slide) fl.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(this.sfxG);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
  }

  // ---- sfx ----
  click() {
    if (this.ok("click", 40)) this.tone(660, 0.06, "square", 0.06, 880);
  }
  deny() {
    if (this.ok("deny", 150)) this.tone(150, 0.16, "sawtooth", 0.1, 90);
  }
  rain() {
    if (!this.ok("rainc", 80)) return;
    this.noise(0.7, "bandpass", 2400, 0.14, 4200);
    this.tone(520, 0.3, "sine", 0.08, 300);
    this.tone(780, 0.25, "sine", 0.05, 420, 0.05);
  }
  gust() {
    if (!this.ok("gust", 80)) return;
    this.noise(0.9, "bandpass", 300, 0.25, 1400, 0, 1.5);
    this.noise(0.7, "bandpass", 1200, 0.1, 400, 0.15, 1);
  }
  bolt(big = true) {
    if (!this.ok(big ? "bolt" : "bolts", big ? 60 : 90)) return;
    this.noise(0.18, "highpass", 3000, big ? 0.35 : 0.18);
    this.tone(big ? 160 : 260, 0.2, "sawtooth", big ? 0.22 : 0.1, 40);
    if (big) {
      this.noise(1.6, "lowpass", 380, 0.4, 70, 0.12, 0.5);
      this.tone(60, 1.0, "sine", 0.3, 28, 0.1);
    }
  }
  zap() {
    if (this.ok("zap", 60)) this.tone(900, 0.07, "square", 0.05, 220);
  }
  heat() {
    if (!this.ok("heat", 100)) return;
    this.noise(0.9, "lowpass", 900, 0.22, 200, 0, 0.5);
    this.tone(200, 0.6, "triangle", 0.1, 420);
  }
  frost() {
    if (!this.ok("frost", 100)) return;
    [1318, 1760, 2349, 2637].forEach((f, i) => this.tone(f, 0.5, "sine", 0.08, 0, i * 0.06));
    this.noise(0.4, "highpass", 5000, 0.08);
  }
  shatter() {
    if (!this.ok("shatter", 80)) return;
    this.noise(0.35, "highpass", 4500, 0.3, 1500);
    this.tone(2200, 0.25, "triangle", 0.12, 300);
    this.tone(1500, 0.2, "square", 0.05, 200, 0.04);
  }
  steam() {
    if (this.ok("steam", 250)) this.noise(0.6, "highpass", 3500, 0.12, 1500);
  }
  fire() {
    if (this.ok("fire", 300)) this.noise(0.5, "lowpass", 1200, 0.1, 400, 0, 0.4);
  }
  hit() {
    if (this.ok("hit", 45)) this.tone(240 + Math.random() * 80, 0.06, "triangle", 0.1, 120);
  }
  kill(big = false) {
    if (!this.ok("kill", 35)) return;
    this.tone(big ? 130 : 420 + Math.random() * 160, big ? 0.5 : 0.09, big ? "sawtooth" : "triangle", big ? 0.25 : 0.09, big ? 40 : 180);
    if (big) this.noise(0.8, "lowpass", 600, 0.3, 80);
  }
  harvest() {
    if (!this.ok("harv", 70)) return;
    this.tone(880, 0.12, "sine", 0.09);
    this.tone(1318, 0.18, "sine", 0.09, 0, 0.07);
  }
  alarm() {
    if (this.ok("alarm", 1200)) {
      this.tone(220, 0.14, "square", 0.08, 0, 0);
      this.tone(165, 0.2, "square", 0.08, 0, 0.16);
    }
  }
  build() {
    this.tone(260, 0.1, "square", 0.08, 520);
    this.tone(520, 0.15, "triangle", 0.1, 780, 0.08);
  }
  sell() {
    this.tone(500, 0.1, "triangle", 0.08, 250);
  }
  combo(n: number) {
    if (!this.ok("combo", 60)) return;
    const base = 523 * Math.pow(2, Math.min(n, 12) / 12);
    this.tone(base, 0.18, "sine", 0.12);
    this.tone(base * 1.5, 0.22, "sine", 0.08, 0, 0.05);
  }
  horn() {
    if (!this.ctx) return;
    const f = [110, 165, 220];
    f.forEach((x, i) => this.tone(x, 1.2, "sawtooth", 0.09, x * 0.97, i * 0.03, undefined, 0.15));
    this.noise(1.2, "lowpass", 400, 0.1, 200);
  }
  boss() {
    if (!this.ctx) return;
    this.tone(70, 2, "sawtooth", 0.22, 35, 0, undefined, 0.2);
    this.tone(73, 2, "square", 0.1, 38, 0.05, undefined, 0.2);
    this.noise(1.8, "lowpass", 300, 0.3, 60, 0, 0.5);
  }
  stomp() {
    this.tone(90, 0.35, "sine", 0.35, 30);
    this.noise(0.3, "lowpass", 300, 0.25, 80);
  }
  event() {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, "triangle", 0.1, 0, i * 0.14));
  }
  win() {
    [523, 659, 784, 1047, 1318, 1568].forEach((f, i) => {
      this.tone(f, 0.6, "triangle", 0.14, 0, i * 0.13);
      this.tone(f / 2, 0.6, "sine", 0.1, 0, i * 0.13);
    });
  }
  lose() {
    [392, 349, 311, 262, 196].forEach((f, i) => this.tone(f, 0.8, "sawtooth", 0.1, f * 0.9, i * 0.25, undefined, 0.03));
  }

  // ---- ambience ----
  setAmbient(rain: number, wind: number) {
    if (!this.ctx || !this.rainG || !this.windG || !this.windF) return;
    const t = this.ctx.currentTime;
    this.rainG.gain.setTargetAtTime(Math.min(0.55, rain * 0.55), t, 0.25);
    this.windG.gain.setTargetAtTime(Math.min(0.5, wind * 0.5), t, 0.25);
    (this.windF as unknown as BiquadFilterNode).frequency.setTargetAtTime(260 + wind * 700, t, 0.3);
  }

  // ---- music ----
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextT = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.setAmbient(0, 0);
  }

  setIntensity(v: number) {
    this.intensity += (Math.max(0, Math.min(1, v)) - this.intensity) * 0.15;
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.musicOn || ctx.state !== "running") return;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    const tempo = 78 + this.intensity * 40;
    const stepDur = 60 / tempo / 2;
    while (this.nextT < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextT);
      this.nextT += stepDur;
      this.step++;
    }
  }

  private mnote(f: number, t: number, dur: number, type: OscT, vol: number, attack: number, echo = false) {
    const ctx = this.ctx;
    if (!ctx || !this.musicG) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.musicG);
    if (echo && this.delay) g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private playStep(s: number, t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicG) return;
    const chord = CHORDS[Math.floor(s / 16) % 4];
    const it = this.intensity;
    if (s % 16 === 0) {
      chord.forEach((m, i) => this.mnote(mtof(m - 12 + (i === 3 ? 0 : 0)), t, 7, "sine", 0.1, 1.2));
      this.mnote(mtof(chord[0] - 24), t, 6, "triangle", 0.12, 0.3);
    }
    if (Math.random() < 0.3 + it * 0.45) {
      const m = chord[Math.floor(Math.random() * chord.length)] + (Math.random() < 0.4 ? 12 : 0) + (Math.random() < 0.15 ? 12 : 0);
      this.mnote(mtof(m), t, 0.9, "triangle", 0.07 + it * 0.04, 0.01, true);
    }
    if (it > 0.25 && s % 4 === 0) this.mnote(mtof(chord[0] - 24), t, 0.5, "sine", 0.18, 0.01);
    if (it > 0.45 && s % 4 === 0) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(130, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g);
      g.connect(this.musicG);
      o.start(t);
      o.stop(t + 0.25);
    }
    if (it > 0.55 && s % 2 === 1 && this.noiseBuf) {
      const n = ctx.createBufferSource();
      n.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter();
      f.type = "highpass";
      f.frequency.value = 7000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      n.connect(f);
      f.connect(g);
      g.connect(this.musicG);
      n.start(t, Math.random());
      n.stop(t + 0.08);
    }
    if (it > 0.7 && s % 8 === 4) this.mnote(mtof(chord[2] + 12), t, 0.4, "square", 0.04, 0.01, true);
  }
}

// Local alias so that filter handle can be stored without strict-typing noise
type BiquadFilterElement = BiquadFilterNode;

export const audio = new AudioEngine();
