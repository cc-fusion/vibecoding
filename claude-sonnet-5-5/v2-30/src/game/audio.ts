// Fully synthesized audio: SFX + reactive generative music (Web Audio API)

type Mode = "menu" | "play" | "coup";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export interface AudioSettings { master: number; music: number; sfx: number; muted: boolean }
let settings: AudioSettings = { master: 0.7, music: 0.5, sfx: 0.8, muted: false };

let mode: Mode = "menu";
let intensity = 0;
let musicOn = false;
let step = 0;
let nextT = 0;
let timer: number | null = null;

export function initAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 4;
      musicBus = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus.connect(master);
      sfxBus.connect(master);
      master.connect(comp);
      comp.connect(ctx.destination);
      const len = ctx.sampleRate * 1.5;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes(settings);
    }
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export function applyVolumes(s: AudioSettings) {
  settings = { ...s };
  if (!ctx || !master || !musicBus || !sfxBus) return;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.03);
  musicBus.gain.setTargetAtTime(s.music * 0.55, t, 0.05);
  sfxBus.gain.setTargetAtTime(s.sfx, t, 0.05);
}

export function suspendAudio() {
  if (ctx && ctx.state === "running") void ctx.suspend();
}
export function resumeAudio() {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

interface ToneOpts { slide?: number; attack?: number; delay?: number; bus?: GainNode | null; lp?: number; detune?: number }

function tone(freq: number, dur: number, type: OscillatorType, vol: number, o: ToneOpts = {}) {
  if (!ctx) return;
  const bus = o.bus ?? sfxBus;
  if (!bus) return;
  const t = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (o.detune) osc.detune.value = o.detune;
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, dur));
  let node: AudioNode = osc;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lp;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(bus);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, o: { lp?: number; hp?: number; delay?: number; bus?: GainNode | null; sweep?: number } = {}) {
  if (!ctx || !noiseBuf) return;
  const bus = o.bus ?? sfxBus;
  if (!bus) return;
  const t = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = src;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(o.lp, t);
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, o.sweep), t + dur);
    node.connect(f);
    node = f;
  }
  if (o.hp) {
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = o.hp;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(bus);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

export type SfxName =
  | "click" | "select" | "coin" | "success" | "fail" | "whisper" | "alarm" | "stab" | "drum"
  | "gong" | "horn" | "hit" | "clash" | "event" | "bell" | "unlock" | "arrest" | "rumor" | "capture" | "win" | "lose" | "post";

let lastSfx: Record<string, number> = {};

export function sfx(name: SfxName) {
  if (!ctx || settings.muted) return;
  const now = ctx.currentTime;
  if (lastSfx[name] && now - lastSfx[name] < 0.04) return;
  lastSfx[name] = now;
  switch (name) {
    case "click": tone(620, 0.06, "square", 0.06, { lp: 2400 }); break;
    case "select": tone(440, 0.08, "triangle", 0.12); tone(660, 0.1, "triangle", 0.08, { delay: 0.04 }); break;
    case "post": tone(300, 0.1, "triangle", 0.15, { slide: 220 }); tone(500, 0.08, "sine", 0.08, { delay: 0.06 }); break;
    case "coin": tone(1320, 0.1, "square", 0.07, { lp: 3500 }); tone(1760, 0.18, "square", 0.07, { delay: 0.07, lp: 3500 }); break;
    case "success": [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, "triangle", 0.14, { delay: i * 0.07 })); break;
    case "fail": tone(220, 0.35, "sawtooth", 0.12, { slide: 110, lp: 900 }); tone(165, 0.4, "sawtooth", 0.1, { delay: 0.1, slide: 80, lp: 700 }); break;
    case "whisper": noise(0.45, 0.14, { hp: 2500, lp: 6000, sweep: 3500 }); break;
    case "rumor": noise(0.3, 0.1, { hp: 3000, lp: 7000 }); tone(880, 0.2, "sine", 0.05, { slide: 1320 }); break;
    case "alarm": for (let i = 0; i < 3; i++) { tone(880, 0.14, "square", 0.1, { delay: i * 0.22, lp: 2000 }); tone(660, 0.14, "square", 0.1, { delay: i * 0.22 + 0.11, lp: 2000 }); } break;
    case "stab": noise(0.12, 0.3, { hp: 1500 }); tone(180, 0.2, "sawtooth", 0.18, { slide: 60 }); break;
    case "drum": tone(110, 0.4, "sine", 0.4, { slide: 45 }); noise(0.08, 0.1, { lp: 800 }); break;
    case "gong": tone(110, 2.2, "sine", 0.25, { attack: 0.01 }); tone(165, 2, "sine", 0.18); tone(233, 1.6, "triangle", 0.1); noise(0.6, 0.08, { lp: 3000 }); break;
    case "horn": tone(147, 1.1, "sawtooth", 0.15, { attack: 0.2, lp: 700 }); tone(220, 1.1, "sawtooth", 0.12, { attack: 0.25, lp: 800 }); break;
    case "hit": noise(0.1, 0.22, { lp: 3000, hp: 400 }); tone(140, 0.1, "square", 0.08, { slide: 70 }); break;
    case "clash": noise(0.18, 0.2, { hp: 2200 }); tone(1900, 0.12, "triangle", 0.06, { slide: 1200 }); break;
    case "event": tone(392, 0.4, "triangle", 0.15); tone(587, 0.5, "triangle", 0.12, { delay: 0.12 }); break;
    case "bell": tone(660, 1.4, "sine", 0.2); tone(1320, 1, "sine", 0.08); tone(990, 1.2, "sine", 0.06); break;
    case "unlock": [392, 494, 587, 784].forEach((f, i) => tone(f, 0.4, "sine", 0.16, { delay: i * 0.09 })); break;
    case "arrest": tone(150, 0.3, "square", 0.14, { lp: 600 }); noise(0.25, 0.2, { hp: 3500, lp: 8000 }); tone(100, 0.4, "sawtooth", 0.1, { delay: 0.2, lp: 400 }); break;
    case "capture": tone(262, 0.5, "sawtooth", 0.14, { attack: 0.05, lp: 1200 }); tone(392, 0.6, "sawtooth", 0.12, { delay: 0.1, attack: 0.05, lp: 1400 }); tone(523, 0.7, "triangle", 0.12, { delay: 0.2 }); break;
    case "win": [262, 330, 392, 523, 659, 784, 1046].forEach((f, i) => { tone(f, 0.7, "triangle", 0.15, { delay: i * 0.12 }); tone(f / 2, 0.8, "sawtooth", 0.06, { delay: i * 0.12, lp: 900 }); }); break;
    case "lose": [392, 349, 311, 262, 196].forEach((f, i) => tone(f, 0.8, "sawtooth", 0.12, { delay: i * 0.25, lp: 800 })); tone(65, 2, "sine", 0.3, { delay: 0.5 }); break;
  }
}

/* ---------------- Music ---------------- */

const CHORDS: { root: number; third: number }[] = [
  { root: 50, third: 3 }, // Dm
  { root: 46, third: 4 }, // Bb
  { root: 43, third: 3 }, // Gm
  { root: 45, third: 4 }, // A
];
const SCALE = [0, 2, 3, 5, 7, 8, 11, 12, 14]; // D harmonic minor
const mf = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function bpm() {
  if (mode === "coup") return 104 + intensity * 24;
  if (mode === "menu") return 58;
  return 62 + intensity * 36;
}

function playStep(s: number, t: number) {
  if (!ctx || !musicBus) return;
  const bar = Math.floor(s / 16);
  const inBar = s % 16;
  const ch = CHORDS[bar % 4];
  const bus = musicBus;
  const delay = t - ctx.currentTime;
  const sd = 60 / bpm() / 2;
  if (inBar === 0) {
    // pad
    [0, ch.third, 7].forEach((iv, i) => {
      tone(mf(ch.root + 12 + iv), sd * 15, "sawtooth", 0.035, { attack: 1.1, delay, bus, lp: 520 + intensity * 500, detune: i * 6 - 6 });
    });
    tone(mf(ch.root - 12), sd * 14, "triangle", 0.2, { attack: 0.03, delay, bus, lp: 400 });
  }
  if (inBar === 8 && (mode !== "menu")) tone(mf(ch.root - 12), sd * 6, "triangle", 0.14, { delay, bus, lp: 400 });
  // arpeggio pluck
  const pat = [0, 2, 1, 3, 2, 1, 3, 2];
  const prob = mode === "menu" ? 0.45 : 0.55 + intensity * 0.3;
  if (Math.random() < prob) {
    const iv = [0, ch.third, 7, 12][pat[inBar % 8]];
    tone(mf(ch.root + 24 + iv), 0.45, "triangle", 0.06 + intensity * 0.03, { delay, bus, lp: 2600 });
  }
  // sparse melody
  if (inBar % 4 === 2 && Math.random() < (mode === "menu" ? 0.5 : 0.28 + intensity * 0.2)) {
    const n = SCALE[Math.floor(Math.random() * SCALE.length)];
    tone(mf(62 + 12 + n), 0.9, "sine", 0.07, { attack: 0.02, delay, bus });
    tone(mf(62 + 12 + n) * 1.005, 0.9, "sine", 0.04, { attack: 0.02, delay, bus });
  }
  // drums
  const driving = mode === "coup" || intensity > 0.35;
  if (driving && inBar % 4 === 0) {
    tone(120, 0.3, "sine", 0.38, { slide: 40, delay, bus });
    if (mode === "coup") noise(0.06, 0.07, { lp: 900, delay, bus });
  }
  if (mode === "coup" && inBar % 4 === 2) tone(90, 0.35, "sine", 0.3, { slide: 38, delay, bus });
  if ((mode === "coup" || intensity > 0.6) && inBar % 2 === 1) noise(0.04, 0.05, { hp: 6500, delay, bus });
  if (mode === "coup" && inBar === 0) {
    tone(mf(ch.root + 12), sd * 6, "sawtooth", 0.07, { attack: 0.1, delay, bus, lp: 1100 });
    tone(mf(ch.root + 19), sd * 6, "sawtooth", 0.05, { attack: 0.1, delay, bus, lp: 1100 });
  }
}

function pump() {
  if (!ctx || !musicOn) return;
  if (ctx.state !== "running") { nextT = ctx.currentTime + 0.1; return; }
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05;
  while (nextT < ctx.currentTime + 0.3) {
    playStep(step, nextT);
    nextT += 60 / bpm() / 2;
    step++;
  }
}

export function startMusic(m: Mode) {
  mode = m;
  if (!ctx) return;
  if (musicOn) return;
  musicOn = true;
  step = 0;
  nextT = ctx.currentTime + 0.1;
  if (timer === null) timer = window.setInterval(pump, 40);
}
export function stopMusic() {
  musicOn = false;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}
export function setMusicMode(m: Mode) { mode = m; }
export function setIntensity(v: number) { intensity = Math.max(0, Math.min(1, v)); }
export function audioReady() { return !!ctx; }
