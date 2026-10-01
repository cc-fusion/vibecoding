import type { SoundName } from "./types";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambientGain: GainNode | null = null;
let muted = false;
let ambientStarted = false;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  ensure();
  startAmbient();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.6, ctx.currentTime, 0.05);
}
export const isMuted = () => muted;

function noiseBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function startAmbient() {
  const c = ensure();
  if (!c || !master || ambientStarted) return;
  ambientStarted = true;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, 4);
  src.loop = true;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const lfo = c.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 180;
  lfo.connect(lfoGain).connect(lp.frequency);
  ambientGain = c.createGain();
  ambientGain.gain.value = 0.06;
  src.connect(lp).connect(ambientGain).connect(master);
  src.start();
  lfo.start();
}

export function setAmbientLevel(level: number) {
  if (ambientGain && ctx) ambientGain.gain.setTargetAtTime(0.05 + level * 0.12, ctx.currentTime, 0.4);
}

function tone(
  c: AudioContext,
  type: OscillatorType,
  f0: number,
  f1: number,
  dur: number,
  vol: number,
  delay = 0
) {
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master!);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(c: AudioContext, dur: number, vol: number, f0: number, f1: number, q = 1, delay = 0) {
  const t = c.currentTime + delay;
  const s = c.createBufferSource();
  s.buffer = noiseBuffer(c, dur + 0.1);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = q;
  bp.frequency.setValueAtTime(f0, t);
  bp.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(bp).connect(g).connect(master!);
  s.start(t);
  s.stop(t + dur + 0.1);
}

export function sfx(name: SoundName) {
  if (muted) return;
  const c = ensure();
  if (!c || !master) return;
  switch (name) {
    case "sail":
      noise(c, 0.25, 0.25, 500, 1400, 0.8);
      tone(c, "sine", 140, 100, 0.18, 0.12);
      break;
    case "splash":
      noise(c, 0.45, 0.4, 2400, 500, 0.6);
      tone(c, "sine", 320, 110, 0.3, 0.12);
      break;
    case "harpoon":
      noise(c, 0.18, 0.35, 3000, 900, 1.2);
      tone(c, "sawtooth", 520, 90, 0.22, 0.2);
      tone(c, "square", 90, 50, 0.25, 0.25, 0.12);
      break;
    case "hit":
      tone(c, "square", 120, 50, 0.22, 0.25);
      noise(c, 0.18, 0.3, 800, 200, 0.8);
      break;
    case "bite":
      tone(c, "sawtooth", 200, 60, 0.3, 0.28);
      noise(c, 0.25, 0.35, 1500, 300, 1);
      break;
    case "coin":
      tone(c, "sine", 880, 880, 0.12, 0.2);
      tone(c, "sine", 1320, 1320, 0.25, 0.2, 0.09);
      break;
    case "buy":
      tone(c, "triangle", 500, 700, 0.12, 0.2);
      tone(c, "triangle", 700, 900, 0.14, 0.2, 0.08);
      break;
    case "crate":
      tone(c, "triangle", 440, 660, 0.12, 0.22);
      tone(c, "triangle", 660, 990, 0.18, 0.22, 0.1);
      break;
    case "relic":
      [523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, "sine", f, f, 0.5, 0.18, i * 0.09));
      break;
    case "kill":
      tone(c, "sawtooth", 300, 40, 0.6, 0.3);
      noise(c, 0.6, 0.45, 1200, 120, 0.7);
      tone(c, "sine", 880, 1320, 0.25, 0.15, 0.25);
      break;
    case "thunder":
      noise(c, 1.2, 0.6, 400, 60, 0.5);
      tone(c, "sine", 70, 35, 1.0, 0.3);
      break;
    case "click":
      tone(c, "square", 600, 400, 0.05, 0.1);
      break;
    case "oil":
      tone(c, "sawtooth", 90, 160, 0.3, 0.15);
      noise(c, 0.3, 0.15, 300, 900, 0.8);
      break;
    case "win":
      [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(c, "triangle", f, f, 0.6, 0.22, i * 0.14));
      break;
    case "lose":
      [392, 330, 262, 196, 131].forEach((f, i) => tone(c, "sawtooth", f, f * 0.95, 0.6, 0.18, i * 0.25));
      break;
  }
}
