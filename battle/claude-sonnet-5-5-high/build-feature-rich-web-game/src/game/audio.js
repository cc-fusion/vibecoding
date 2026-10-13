// ===== Web Audio synth: SFX + generative music =====
const MODES = {
  title: { root: 60, minor: 0, bpm: 78, mel: 0.4, prog: [0, -3, -7, -5], wave: 'triangle', drum: 0 },
  spring: { root: 62, minor: 0, bpm: 88, mel: 0.4, prog: [0, -3, -7, -5], wave: 'triangle', drum: 0 },
  summer: { root: 65, minor: 0, bpm: 100, mel: 0.5, prog: [0, -5, -3, -7], wave: 'triangle', drum: 1 },
  fall: { root: 57, minor: 1, bpm: 76, mel: 0.35, prog: [0, -4, -2, -5], wave: 'triangle', drum: 0 },
  winter: { root: 64, minor: 0, bpm: 60, mel: 0.25, prog: [0, -4, -7, -2], wave: 'sine', drum: 0, bell: 1 },
  night: { root: 57, minor: 1, bpm: 54, mel: 0.15, prog: [0, -4, -7, -2], wave: 'sine', drum: 0 },
  mine: { root: 48, minor: 1, bpm: 72, mel: 0.2, prog: [0, -2, -4, -5], wave: 'square', drum: 1, dark: 1 },
  boss: { root: 45, minor: 1, bpm: 142, mel: 0.5, prog: [0, 0, -2, -4], wave: 'sawtooth', drum: 2, dark: 1 },
  festival: { root: 67, minor: 0, bpm: 120, mel: 0.7, prog: [0, -5, -3, -7], wave: 'triangle', drum: 2 },
  win: { root: 67, minor: 0, bpm: 110, mel: 0.8, prog: [0, -5, -3, -7], wave: 'triangle', drum: 1 },
  lose: { root: 50, minor: 1, bpm: 50, mel: 0.2, prog: [0, -2, -4, -5], wave: 'sine', drum: 0 },
};
const PENT = [0, 2, 4, 7, 9], PENTM = [0, 3, 5, 7, 10];
const mf = m => 440 * Math.pow(2, (m - 69) / 12);

export function createSound(vol) {
  let ctx = null, master, sfxG, musG, noiseBuf, rainG, mode = 'title', timer = null, step = 0, nextT = 0, melIdx = 2, lastStep = 0;
  let wasOn = false;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; return; }
    master = ctx.createGain(); sfxG = ctx.createGain(); musG = ctx.createGain();
    sfxG.connect(master); musG.connect(master); master.connect(ctx.destination);
    const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const rs = ctx.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 0.4;
    rainG = ctx.createGain(); rainG.gain.value = 0; rs.connect(bp); bp.connect(rainG); rainG.connect(sfxG); rs.start();
    apply(); timer = setInterval(tick, 50); nextT = ctx.currentTime + 0.1; wasOn = true;
  }
  function apply() {
    if (!ctx) return;
    const t = ctx.currentTime;
    master.gain.setTargetAtTime(vol.mute ? 0 : vol.master, t, 0.03);
    musG.gain.setTargetAtTime(vol.music * 0.5, t, 0.05);
    sfxG.gain.setTargetAtTime(vol.sfx, t, 0.03);
  }
  function tone(f, d, type, v, slide, delay, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0), o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v || 0.2, t + Math.min(0.02, d / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || sfxG); o.start(t); o.stop(t + d + 0.05);
  }
  function noise(d, v, fq, type, delay, dest) {
    if (!ctx) return;
    const t = ctx.currentTime + (delay || 0), s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type || 'lowpass'; f.frequency.value = fq || 1000;
    g.gain.setValueAtTime(v || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(dest || sfxG); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  function sfx(n) {
    if (!ctx) return;
    switch (n) {
      case 'click': tone(660, 0.06, 'square', 0.08); break;
      case 'open': tone(440, 0.08, 'triangle', 0.12); tone(660, 0.1, 'triangle', 0.1, 0, 0.06); break;
      case 'close': tone(660, 0.08, 'triangle', 0.1); tone(440, 0.1, 'triangle', 0.1, 0, 0.06); break;
      case 'hoe': noise(0.14, 0.35, 500); tone(110, 0.12, 'sine', 0.25, -50); break;
      case 'water': noise(0.3, 0.25, 2500, 'bandpass'); tone(500, 0.2, 'sine', 0.06, 300); break;
      case 'chop': noise(0.08, 0.4, 1800, 'highpass'); tone(150, 0.1, 'square', 0.18, -80); break;
      case 'mine': noise(0.07, 0.4, 3000, 'highpass'); tone(900, 0.06, 'square', 0.12, -400); tone(200, 0.1, 'triangle', 0.2, -100); break;
      case 'break': noise(0.3, 0.5, 900); tone(180, 0.2, 'sawtooth', 0.15, -120); break;
      case 'pickup': tone(880, 0.07, 'triangle', 0.15); tone(1320, 0.1, 'triangle', 0.12, 0, 0.05); break;
      case 'coin': tone(988, 0.07, 'square', 0.1); tone(1319, 0.2, 'square', 0.1, 0, 0.07); break;
      case 'swing': noise(0.14, 0.2, 2500, 'bandpass'); tone(300, 0.12, 'sawtooth', 0.06, 500); break;
      case 'hit': noise(0.1, 0.4, 1200); tone(220, 0.12, 'square', 0.2, -120); break;
      case 'hurt': tone(300, 0.25, 'sawtooth', 0.22, -200); noise(0.15, 0.3, 700); break;
      case 'splash': noise(0.4, 0.35, 1800, 'bandpass'); tone(300, 0.2, 'sine', 0.1, -150); break;
      case 'cast': noise(0.25, 0.15, 4000, 'highpass'); tone(500, 0.2, 'sine', 0.06, -300); break;
      case 'bite': tone(1200, 0.08, 'square', 0.15); tone(1500, 0.12, 'square', 0.15, 0, 0.09); break;
      case 'reel': tone(700 + Math.random() * 100, 0.04, 'square', 0.04); break;
      case 'catch': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.16, 0, i * 0.08)); break;
      case 'lost': tone(300, 0.35, 'sawtooth', 0.14, -200); break;
      case 'levelup': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.1, 0, i * 0.09)); break;
      case 'fanfare': [392, 523, 659, 784, 659, 784, 1047].forEach((f, i) => { tone(f, 0.3, 'triangle', 0.2, 0, i * 0.13); tone(f / 2, 0.3, 'square', 0.06, 0, i * 0.13); }); break;
      case 'step': noise(0.05, 0.05, 700); break;
      case 'door': noise(0.15, 0.2, 400); tone(120, 0.2, 'triangle', 0.2, -30); break;
      case 'eat': noise(0.05, 0.3, 1500, 'bandpass'); noise(0.05, 0.3, 1500, 'bandpass', 0.1); tone(400, 0.1, 'sine', 0.08, 200, 0.18); break;
      case 'error': tone(160, 0.2, 'square', 0.15); tone(120, 0.25, 'square', 0.15, 0, 0.1); break;
      case 'gift': [660, 880, 1100].forEach((f, i) => tone(f, 0.2, 'sine', 0.15, 0, i * 0.07)); break;
      case 'heart': [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, 'sine', 0.14, 0, i * 0.08)); break;
      case 'craft': noise(0.1, 0.3, 2000, 'bandpass'); tone(520, 0.1, 'square', 0.1); tone(780, 0.15, 'square', 0.1, 0, 0.1); break;
      case 'plant': noise(0.1, 0.2, 600); tone(250, 0.1, 'sine', 0.15, 80); break;
      case 'harvest': tone(600, 0.08, 'triangle', 0.18, 300); tone(900, 0.12, 'triangle', 0.14, 0, 0.06); break;
      case 'boom': noise(0.7, 0.8, 500); tone(70, 0.5, 'sine', 0.5, -40); break;
      case 'bossroar': tone(80, 0.9, 'sawtooth', 0.3, -30); noise(0.8, 0.4, 300); break;
      case 'shoot': tone(700, 0.15, 'square', 0.08, -400); break;
      case 'sleep': [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, 'sine', 0.12, 0, i * 0.25)); break;
      case 'lose': [330, 262, 196, 147].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.13, 0, i * 0.3)); break;
      case 'thunder': noise(1.2, 0.5, 250); tone(55, 1, 'sine', 0.3, -20); break;
      case 'egg': tone(1000 + Math.random() * 400, 0.1, 'sine', 0.12, 300); break;
      case 'dash': noise(0.15, 0.2, 3000, 'bandpass'); break;
      case 'stairs': [300, 250, 200, 150].forEach((f, i) => tone(f, 0.1, 'triangle', 0.12, 0, i * 0.07)); break;
      case 'moo': tone(150, 0.5, 'sawtooth', 0.12, -30); tone(120, 0.4, 'sawtooth', 0.08, 0, 0.1); break;
      case 'cluck': tone(700, 0.05, 'square', 0.08); tone(600, 0.06, 'square', 0.08, 0, 0.07); break;
      default: tone(440, 0.05, 'sine', 0.05);
    }
  }

  // ---- music ----
  function tick() {
    if (!ctx) return;
    const m = MODES[mode] || MODES.title;
    const sd = 60 / m.bpm / 2;
    if (nextT < ctx.currentTime - 1) nextT = ctx.currentTime + 0.05;
    while (nextT < ctx.currentTime + 0.3) { play(m, step, nextT); nextT += sd; step++; }
  }
  function mtone(f, d, type, v, t) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + Math.min(0.05, d / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(musG); o.start(t); o.stop(t + d + 0.05);
  }
  function mnoise(d, v, fq, type, t) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = fq;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(f); f.connect(g); g.connect(musG); s.start(t, Math.random()); s.stop(t + d + 0.05);
  }
  function play(m, s, t) {
    const sd = 60 / m.bpm / 2, bar = Math.floor(s / 8) % m.prog.length, base = m.root + m.prog[bar];
    const triad = m.minor ? [0, 3, 7] : [0, 4, 7];
    const sc = m.minor ? PENTM : PENT;
    if (s % 8 === 0) triad.forEach(iv => mtone(mf(base + iv), sd * 8, m.wave === 'sawtooth' ? 'triangle' : (m.wave === 'square' ? 'triangle' : 'sine'), 0.09, t));
    if (s % 4 === 0) mtone(mf(base - 12), sd * 3, m.dark ? 'sawtooth' : 'triangle', m.dark ? 0.1 : 0.14, t);
    // arpeggio
    const arpP = m.dark ? 0.7 : 0.45;
    if (Math.random() < arpP) mtone(mf(base + 12 + triad[(s * 7) % 3]), sd * 1.6, m.wave === 'sawtooth' ? 'square' : m.wave, m.dark ? 0.035 : 0.05, t);
    // melody
    if (s % 2 === 0 && Math.random() < m.mel) {
      melIdx = Math.max(0, Math.min(9, melIdx + (Math.floor(Math.random() * 3) - 1) * (Math.random() < 0.3 ? 2 : 1)));
      const note = base + 12 + sc[melIdx % 5] + (melIdx >= 5 ? 12 : 0);
      mtone(mf(note), sd * (m.bell ? 4 : 2.4), m.bell ? 'sine' : (m.wave === 'sawtooth' ? 'square' : 'triangle'), m.bell ? 0.07 : 0.08, t);
      if (m.bell) mtone(mf(note + 12), sd * 3, 'sine', 0.03, t);
    }
    // drums
    if (m.drum) {
      if (s % 4 === 0 || (m.drum === 2 && s % 8 === 6)) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(0.28, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(g); g.connect(musG); o.start(t); o.stop(t + 0.2); }
      if (s % 2 === 1) mnoise(0.04, m.drum === 2 ? 0.1 : 0.05, 7000, 'highpass', t);
      if (m.drum === 2 && s % 8 === 4) mnoise(0.12, 0.18, 1800, 'bandpass', t);
    }
    lastStep = s;
  }
  return {
    init, apply, sfx, tone,
    setMode(m) { if (MODES[m]) mode = m; },
    getMode() { return mode; },
    setRain(a) { if (!ctx) return; rainG.gain.setTargetAtTime(a * 0.06, ctx.currentTime, 0.5); },
    destroy() { if (timer) clearInterval(timer); timer = null; if (ctx) { try { ctx.close(); } catch (e) { /* ignore */ } } ctx = null; wasOn = false; void lastStep; void wasOn; },
  };
}
