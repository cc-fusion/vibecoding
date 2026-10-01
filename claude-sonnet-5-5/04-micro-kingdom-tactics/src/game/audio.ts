let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let musicTimer: number | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
  if (m) stopMusic();
}
export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, delay = 0, slideTo?: number) {
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol = 0.2, delay = 0, freq = 1200, type: BiquadFilterType = "lowpass") {
  const c = ensure();
  if (!c || !master) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t0);
}

export function sfx(name: string) {
  if (muted) return;
  switch (name) {
    case "click":
      tone(520, 0.06, "triangle", 0.12);
      break;
    case "select":
      tone(440, 0.07, "triangle", 0.12);
      tone(660, 0.09, "triangle", 0.1, 0.05);
      break;
    case "deny":
      tone(150, 0.15, "sawtooth", 0.1, 0, 90);
      break;
    case "place":
      tone(180, 0.18, "square", 0.12, 0, 70);
      noise(0.12, 0.15, 0, 600);
      break;
    case "spell":
      tone(500, 0.25, "sine", 0.14, 0, 1100);
      tone(750, 0.3, "triangle", 0.08, 0.04, 1500);
      break;
    case "terra":
      noise(0.45, 0.22, 0.05, 400);
      tone(90, 0.4, "sawtooth", 0.1, 0.05, 50);
      break;
    case "attack":
      noise(0.08, 0.15, 0, 3000, "highpass");
      tone(300, 0.1, "sawtooth", 0.08, 0, 120);
      break;
    case "hit":
      noise(0.14, 0.25, 0, 1500);
      tone(140, 0.12, "square", 0.12, 0, 60);
      break;
    case "keep":
      noise(0.4, 0.35, 0, 500);
      tone(80, 0.4, "sawtooth", 0.2, 0, 35);
      break;
    case "die":
      tone(330, 0.3, "triangle", 0.14, 0, 70);
      noise(0.2, 0.15, 0, 800);
      break;
    case "heal":
      tone(660, 0.12, "sine", 0.1);
      tone(880, 0.16, "sine", 0.1, 0.09);
      break;
    case "react":
      noise(0.6, 0.2, 0, 4000, "highpass");
      tone(220, 0.5, "sine", 0.08, 0, 880);
      break;
    case "turn":
      tone(392, 0.12, "triangle", 0.1);
      tone(523, 0.16, "triangle", 0.1, 0.1);
      break;
    case "win":
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, "triangle", 0.16, i * 0.14));
      break;
    case "lose":
      [392, 349, 311, 262].forEach((f, i) => tone(f, 0.45, "sawtooth", 0.11, i * 0.22));
      break;
    default:
      break;
  }
}

// Gentle generative ambient loop
const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
export function startMusic() {
  if (musicTimer !== null || muted) return;
  const c = ensure();
  if (!c) return;
  let step = 0;
  const base = 196;
  musicTimer = window.setInterval(() => {
    if (muted) return;
    const n = SCALE[Math.floor(Math.random() * SCALE.length)];
    const f = base * Math.pow(2, n / 12);
    if (step % 4 === 0) tone(base / 2 * Math.pow(2, [0, -3, -5, -2][(step / 4) % 4 | 0] / 12), 2.2, "sine", 0.05);
    if (Math.random() < 0.65) tone(f, 1.2, "triangle", 0.03);
    step++;
  }, 600);
}
export function stopMusic() {
  if (musicTimer !== null) {
    window.clearInterval(musicTimer);
    musicTimer = null;
  }
}
