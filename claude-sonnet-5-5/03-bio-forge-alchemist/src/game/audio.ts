// Tiny WebAudio synth: sfx + procedural music. No assets required.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let musicTimer: number | null = null;
let musicMode: "calm" | "tense" | "off" = "off";
let step = 0;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}
export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15, slide = 0, delay = 0) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.2, filt = 1200, delay = 0) {
  if (!ctx || !master) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filt;
  const g = ctx.createGain();
  g.gain.value = vol;
  s.connect(f);
  f.connect(g);
  g.connect(master);
  s.start(t0);
}

export const sfx = {
  click: () => tone(520, 0.06, "triangle", 0.1),
  select: () => tone(700, 0.07, "triangle", 0.1, 120),
  place: () => {
    tone(330, 0.08, "sine", 0.14, 90);
    noise(0.05, 0.05, 2000);
  },
  remove: () => tone(260, 0.07, "sine", 0.1, -80),
  buy: () => {
    tone(880, 0.08, "square", 0.06);
    tone(1175, 0.1, "square", 0.06, 0, 0.07);
  },
  coin: () => {
    tone(988, 0.08, "square", 0.07);
    tone(1319, 0.22, "square", 0.07, 0, 0.07);
  },
  brew: () => {
    for (let i = 0; i < 7; i++) tone(180 + Math.random() * 260, 0.12, "sine", 0.12, 160, i * 0.07);
    noise(0.5, 0.08, 900);
    tone(523, 0.3, "triangle", 0.1, 0, 0.55);
    tone(784, 0.4, "triangle", 0.1, 0, 0.65);
  },
  throw: () => {
    noise(0.12, 0.08, 3000);
    tone(400, 0.15, "sine", 0.08, 400);
  },
  swat: () => {
    noise(0.08, 0.1, 1800);
    tone(180, 0.08, "square", 0.06, -60);
  },
  hit: () => {
    noise(0.18, 0.18, 1500);
    tone(140, 0.15, "sawtooth", 0.1, -60);
  },
  boom: () => {
    noise(0.6, 0.35, 700);
    tone(90, 0.5, "sawtooth", 0.18, -60);
  },
  zap: () => {
    tone(1400, 0.15, "sawtooth", 0.07, -1100);
    noise(0.1, 0.08, 4000);
  },
  hurt: () => {
    noise(0.35, 0.3, 500);
    tone(110, 0.3, "sawtooth", 0.2, -50);
  },
  error: () => {
    tone(200, 0.12, "square", 0.08);
    tone(150, 0.18, "square", 0.08, 0, 0.1);
  },
  enrage: () => {
    tone(300, 0.3, "sawtooth", 0.1, -200);
    tone(220, 0.3, "sawtooth", 0.1, -120, 0.12);
  },
  kill: () => {
    tone(440, 0.1, "square", 0.07);
    tone(660, 0.1, "square", 0.07, 0, 0.08);
    tone(880, 0.16, "square", 0.07, 0, 0.16);
  },
  boss: () => {
    tone(70, 1.2, "sawtooth", 0.25, -25);
    tone(74, 1.2, "square", 0.12, -25);
    noise(0.8, 0.2, 400);
  },
  open: () => {
    tone(392, 0.15, "triangle", 0.12);
    tone(523, 0.15, "triangle", 0.12, 0, 0.12);
    tone(659, 0.3, "triangle", 0.12, 0, 0.24);
  },
  win: () => {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, "triangle", 0.14, 0, i * 0.14));
  },
  lose: () => {
    [392, 330, 262, 196, 131].forEach((f, i) => tone(f, 0.5, "sawtooth", 0.1, -10, i * 0.25));
  },
  dayEnd: () => {
    [523, 659, 784].forEach((f, i) => tone(f, 0.3, "triangle", 0.12, 0, i * 0.12));
  },
};

const SCALE = [220, 261.6, 293.7, 329.6, 392, 440, 523.3, 587.3];

function musicStep() {
  if (!ctx || musicMode === "off") return;
  const tense = musicMode === "tense";
  const bar = Math.floor(step / 8) % 4;
  const roots = [0, 3, 2, 4];
  const r = roots[bar];
  if (step % 4 === 0) tone(SCALE[r] / 2, tense ? 0.35 : 0.6, tense ? "sawtooth" : "triangle", tense ? 0.05 : 0.06);
  const pat = [0, 2, 4, 2, 5, 4, 2, 1];
  if (tense || step % 2 === 0) {
    const n = SCALE[(r + pat[step % 8]) % SCALE.length];
    tone(n, tense ? 0.14 : 0.35, tense ? "square" : "sine", tense ? 0.025 : 0.035);
  }
  if (tense && step % 2 === 1) noise(0.04, 0.03, 6000);
  step++;
}

export function startMusic(mode: "calm" | "tense") {
  musicMode = mode;
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = window.setInterval(musicStep, mode === "tense" ? 170 : 300);
}
export function stopMusic() {
  musicMode = "off";
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
}
