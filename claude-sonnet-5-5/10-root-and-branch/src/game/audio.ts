// Tiny WebAudio synthesizer — all sounds are generated procedurally.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let droneNodes: { osc: OscillatorNode[]; gain: GainNode } | null = null;

function ensure(): AudioContext | null {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  ensure();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noise(dur: number, vol: number, lp: number, delay = 0, hpSweep?: number) {
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.setValueAtTime(lp, t);
  if (hpSweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, hpSweep), t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export const sfx = {
  click() {
    tone(520, 0.06, 'triangle', 0.18, 700);
  },
  grow() {
    tone(300 + Math.random() * 80, 0.12, 'sine', 0.16, 520);
  },
  thicken() {
    tone(180, 0.18, 'sawtooth', 0.12, 360);
    tone(360, 0.2, 'sine', 0.12, 540, 0.05);
  },
  place() {
    tone(440, 0.1, 'triangle', 0.2, 880);
    tone(660, 0.18, 'sine', 0.14, 990, 0.07);
  },
  error() {
    tone(150, 0.15, 'square', 0.12, 90);
  },
  collapse() {
    noise(1.4, 0.9, 900, 0, 60);
    tone(90, 1.1, 'sine', 0.5, 28);
    tone(60, 0.9, 'sawtooth', 0.2, 30, 0.1);
  },
  erode() {
    noise(0.12, 0.08, 500);
  },
  poison() {
    noise(0.6, 0.18, 3500, 0, 800);
  },
  puff() {
    noise(0.25, 0.14, 2200, 0, 500);
    tone(700, 0.15, 'sine', 0.06, 300);
  },
  spawn() {
    tone(220, 0.25, 'square', 0.07, 180);
  },
  die() {
    tone(400, 0.2, 'sawtooth', 0.1, 80);
  },
  warn() {
    tone(660, 0.18, 'square', 0.12);
    tone(500, 0.18, 'square', 0.12, undefined, 0.22);
    tone(660, 0.18, 'square', 0.12, undefined, 0.44);
  },
  plane() {
    noise(2.5, 0.12, 700, 0, 300);
  },
  hurt() {
    tone(120, 0.25, 'sawtooth', 0.15, 60);
  },
  win() {
    [392, 494, 587, 784, 988].forEach((f, i) => tone(f, 0.4, 'triangle', 0.2, undefined, i * 0.12));
  },
  lose() {
    [392, 330, 262, 196, 130].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.14, undefined, i * 0.2));
  },
  buy() {
    tone(660, 0.1, 'triangle', 0.2);
    tone(990, 0.2, 'triangle', 0.2, undefined, 0.08);
  },
  coin() {
    tone(900, 0.05, 'square', 0.04, 1300);
  },
};

export function startDrone() {
  const c = ensure();
  if (!c || !master || droneNodes) return;
  const g = c.createGain();
  g.gain.value = 0.05;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 260;
  const oscs: OscillatorNode[] = [];
  [55, 82.5, 110.7].forEach((fr, i) => {
    const o = c.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = fr;
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 0.07 + i * 0.05;
    lg.gain.value = 1.2;
    lfo.connect(lg);
    lg.connect(o.frequency);
    lfo.start();
    o.connect(f);
    o.start();
    oscs.push(o, lfo);
  });
  f.connect(g);
  g.connect(master);
  droneNodes = { osc: oscs, gain: g };
}

export function stopDrone() {
  if (!droneNodes) return;
  droneNodes.osc.forEach((o) => {
    try {
      o.stop();
    } catch {
      /* already stopped */
    }
  });
  droneNodes.gain.disconnect();
  droneNodes = null;
}
