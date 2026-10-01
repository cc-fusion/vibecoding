// Procedural WebAudio sound effects & machine hum. No external assets.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let muted = false;
try {
  muted = localStorage.getItem('clockwork_muted') === '1';
} catch {
  /* ignore */
}

function ensure() {
  if (muted) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    const len = ctx.sampleRate * 1.5;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.15, slideTo?: number, delay = 0) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.15, freq = 3000, q = 0.7, type: BiquadFilterType = 'bandpass', delay = 0, sweepTo?: number) {
  const c = ensure();
  if (!c || !master || !noiseBuf) return;
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t, Math.random());
  s.stop(t + dur + 0.05);
}

let humNodes: { o1: OscillatorNode; o2: OscillatorNode; g: GainNode; f: BiquadFilterNode } | null = null;

export const sfx = {
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem('clockwork_muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (m) sfx.stopHum();
  },
  unlock() {
    ensure();
  },
  click() {
    tone(660, 0.05, 'square', 0.06);
  },
  place() {
    tone(180, 0.09, 'square', 0.12, 90);
    noise(0.06, 0.08, 1800, 1);
  },
  rotate() {
    tone(420, 0.04, 'square', 0.07);
    tone(560, 0.04, 'square', 0.07, undefined, 0.04);
  },
  salvage() {
    tone(300, 0.12, 'sawtooth', 0.08, 120);
  },
  toggle() {
    tone(110, 0.08, 'square', 0.14);
    tone(880, 0.05, 'triangle', 0.08, undefined, 0.05);
  },
  bolted() {
    tone(90, 0.12, 'square', 0.12, 70);
  },
  error() {
    tone(150, 0.18, 'sawtooth', 0.12, 90);
  },
  hint() {
    tone(784, 0.1, 'sine', 0.12);
    tone(1175, 0.18, 'sine', 0.12, undefined, 0.1);
  },
  hiss(vol = 0.08) {
    noise(0.35, vol, 5000, 0.5, 'highpass');
  },
  vent() {
    noise(1.1, 0.3, 6000, 0.5, 'highpass', 0, 1500);
    tone(220, 0.8, 'sawtooth', 0.05, 90);
  },
  tick(high = false) {
    tone(high ? 1400 : 1000, 0.02, 'square', 0.04);
  },
  alarm() {
    tone(900, 0.12, 'square', 0.1);
    tone(700, 0.12, 'square', 0.1, undefined, 0.13);
  },
  grind() {
    noise(0.25, 0.12, 400, 2, 'bandpass');
    tone(70, 0.2, 'sawtooth', 0.08, 50);
  },
  start() {
    tone(220, 0.15, 'sawtooth', 0.1, 330);
    tone(330, 0.2, 'sawtooth', 0.1, 440, 0.12);
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, undefined, i * 0.1));
    noise(0.6, 0.08, 4000, 0.5, 'highpass', 0.1);
  },
  boom() {
    noise(1.8, 0.5, 900, 0.7, 'lowpass', 0, 60);
    tone(120, 1.2, 'sawtooth', 0.25, 30);
    noise(0.5, 0.3, 7000, 0.5, 'highpass');
  },
  buy() {
    tone(988, 0.08, 'square', 0.1);
    tone(1319, 0.16, 'square', 0.1, undefined, 0.08);
  },
  startHum() {
    const c = ensure();
    if (!c || !master || humNodes) return;
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o1.type = 'sawtooth';
    o2.type = 'square';
    o1.frequency.value = 55;
    o2.frequency.value = 55.7;
    f.type = 'lowpass';
    f.frequency.value = 180;
    g.gain.value = 0.0;
    g.gain.linearRampToValueAtTime(0.05, c.currentTime + 1);
    o1.connect(f);
    o2.connect(f);
    f.connect(g);
    g.connect(master);
    o1.start();
    o2.start();
    humNodes = { o1, o2, g, f };
  },
  setHum(pressure: number) {
    if (!humNodes || !ctx) return;
    const k = Math.min(1, pressure / 100);
    humNodes.o1.frequency.setTargetAtTime(55 + k * 45, ctx.currentTime, 0.2);
    humNodes.o2.frequency.setTargetAtTime(55.7 + k * 46, ctx.currentTime, 0.2);
    humNodes.f.frequency.setTargetAtTime(180 + k * 500, ctx.currentTime, 0.2);
    humNodes.g.gain.setTargetAtTime(0.04 + k * 0.05, ctx.currentTime, 0.2);
  },
  stopHum() {
    if (!humNodes || !ctx) return;
    const h = humNodes;
    humNodes = null;
    h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    setTimeout(() => {
      try {
        h.o1.stop();
        h.o2.stop();
      } catch {
        /* ignore */
      }
    }, 500);
  },
};
