// Civilization Micro — fully synthesized audio (Web Audio API). No asset files.

let ac = null;
let master = null;
let sfxBus = null;
let musBus = null;
let noiseBuf = null;
let musicTimer = null;
let nextBeat = 0;
let beat = 0;
let era = 0;
let tense = false;
let settings = { vol: 0.7, music: true, sfx: true };

const PROGS = [
  [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], // Ancient — A minor, modal
  [[50, 53, 57], [48, 52, 55], [55, 59, 62], [57, 60, 64]], // Classical — dorian
  [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], // Medieval — dark
  [[48, 52, 55], [57, 60, 64], [53, 57, 60], [55, 59, 62]], // Renaissance — bright
  [[52, 55, 59], [48, 52, 55], [45, 48, 52], [50, 54, 57]], // Industrial — driving
  [[50, 53, 57], [46, 50, 53], [57, 60, 64], [53, 57, 60]], // Modern — electric
];
const TEMPO = [78, 92, 74, 100, 112, 120];

export function audioReady() { return !!ac; }

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  try {
    ac = new C();
  } catch (e) { ac = null; return; }
  master = ac.createGain();
  master.connect(ac.destination);
  sfxBus = ac.createGain();
  sfxBus.connect(master);
  musBus = ac.createGain();
  musBus.connect(master);
  const len = ac.sampleRate; // 1s of white noise
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  applyVolumes();
}

export function applyVolumes(s) {
  if (s) settings = { ...settings, ...s };
  if (!ac) return;
  master.gain.setTargetAtTime(settings.vol, ac.currentTime, 0.02);
  sfxBus.gain.setTargetAtTime(settings.sfx ? 0.55 : 0, ac.currentTime, 0.02);
  musBus.gain.setTargetAtTime(settings.music ? 0.22 : 0, ac.currentTime, 0.05);
}

export function suspendAudio(on) {
  if (!ac) return;
  try { on ? ac.suspend() : ac.resume(); } catch (e) { /* ignore */ }
}

function tone(f, d, type = 'sine', v = 0.2, when = 0, bend = 0, bus = null) {
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * bend), t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + Math.min(0.02, d * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  o.connect(g);
  g.connect(bus || sfxBus);
  o.start(t0);
  o.stop(t0 + d + 0.05);
}

function noise(d, v = 0.2, when = 0, freq = 1200, q = 0.8) {
  if (!ac) return;
  const t0 = ac.currentTime + when;
  const s = ac.createBufferSource();
  s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  s.connect(f);
  f.connect(g);
  g.connect(sfxBus);
  s.start(t0, Math.random() * 0.5, d);
  s.stop(t0 + d + 0.02);
}

const mf = (m) => 440 * Math.pow(2, (m - 69) / 12);

const SFX = {
  click: () => tone(880, 0.05, 'square', 0.04),
  select: () => { tone(520, 0.06, 'triangle', 0.12); tone(780, 0.06, 'triangle', 0.08, 0.04); },
  move: () => tone(300, 0.09, 'triangle', 0.08, 0, 1.4),
  hit: () => { noise(0.12, 0.25, 0, 900); tone(190, 0.12, 'sawtooth', 0.09, 0, 0.5); },
  kill: () => { noise(0.3, 0.3, 0, 500, 0.5); tone(240, 0.35, 'square', 0.1, 0, 0.4); },
  found: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.18, i * 0.08)),
  build: () => { tone(660, 0.12, 'triangle', 0.16); tone(880, 0.16, 'triangle', 0.16, 0.1); },
  tech: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.07)),
  wonder: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.9, 'sawtooth', 0.05, i * 0.12)); [1046, 1318].forEach((f, i) => tone(f, 0.8, 'sine', 0.12, 0.45 + i * 0.12)); },
  turn: () => tone(440, 0.16, 'sine', 0.1),
  war: () => { tone(110, 0.8, 'sawtooth', 0.14, 0, 0.8); tone(116, 0.8, 'sawtooth', 0.1, 0, 0.8); },
  alert: () => { tone(740, 0.12, 'square', 0.06); tone(740, 0.12, 'square', 0.06, 0.2); },
  coin: () => { tone(1200, 0.08, 'triangle', 0.12); tone(1600, 0.12, 'triangle', 0.1, 0.06); },
  error: () => tone(150, 0.18, 'square', 0.07),
  claim: () => tone(500, 0.25, 'sine', 0.12, 0, 1.4),
  growth: () => [392, 494, 587].forEach((f, i) => tone(f, 0.18, 'sine', 0.1, i * 0.06)),
  barb: () => { noise(0.5, 0.2, 0, 300, 0.4); tone(90, 0.5, 'square', 0.08, 0, 0.6); },
  victory: () => {
    const seq = [523, 659, 784, 1046, 784, 1046, 1318];
    seq.forEach((f, i) => tone(f, 0.35, 'triangle', 0.2, i * 0.18));
    tone(262, 1.4, 'sawtooth', 0.05, 0.1);
  },
  defeat: () => [392, 370, 330, 262].forEach((f, i) => tone(f, 0.6, 'triangle', 0.18, i * 0.35)),
  deal: () => { tone(660, 0.1, 'sine', 0.12); tone(990, 0.14, 'sine', 0.1, 0.09); },
};

export function sfx(name) {
  if (!ac || !settings.sfx) return;
  const f = SFX[name];
  if (f) { try { f(); } catch (e) { /* ignore */ } }
}

/* ---------- Generative music ---------- */

function scheduleBeat() {
  const prog = PROGS[era] || PROGS[0];
  const bpm = (TEMPO[era] || 90) * (tense ? 1.15 : 1);
  const spb = 60 / bpm;
  const bar = Math.floor(beat / 4) % prog.length;
  const chord = prog[bar];
  const when = nextBeat - ac.currentTime;
  if (beat % 4 === 0) {
    chord.forEach((m) => {
      tone(mf(m), spb * 3.6, 'triangle', 0.035, Math.max(0, when), 0, musBus);
    });
    tone(mf(chord[0] - 24), spb * 3.8, 'sine', 0.09, Math.max(0, when), 0, musBus);
  }
  const arpNote = chord[(beat * 2) % 3] + (beat % 8 >= 4 ? 12 : 0);
  if (beat % 2 === 0) tone(mf(arpNote), spb * 0.9, 'triangle', tense ? 0.045 : 0.03, Math.max(0, when), 0, musBus);
  if (tense && beat % 4 === 2) noise(0.06, 0.05, Math.max(0, when), 3000, 1);
  beat++;
  nextBeat += spb;
}

function musicTick() {
  if (!ac || !settings.music) return;
  if (nextBeat < ac.currentTime) nextBeat = ac.currentTime + 0.05;
  while (nextBeat < ac.currentTime + 0.25) scheduleBeat();
}

export function startMusic() {
  if (!ac || musicTimer) return;
  nextBeat = ac.currentTime + 0.1;
  musicTimer = setInterval(musicTick, 90);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}

export function setMusicEra(e, isTense = false) {
  era = Math.max(0, Math.min(PROGS.length - 1, e | 0));
  tense = !!isTense;
}
