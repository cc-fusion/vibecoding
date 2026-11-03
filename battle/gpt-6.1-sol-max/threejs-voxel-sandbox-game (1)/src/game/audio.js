export class GameAudio {
  constructor(volume = 0.45) { this.volume = volume; this.ctx = null; this.lastStep = 0; this.nextBird = 0; }
  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(this.ctx.destination);
      const length = this.ctx.sampleRate * 3;
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.025) / 1.025; data[i] = previous * 5; }
      const wind = this.ctx.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
      const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 280;
      this.windGain = this.ctx.createGain(); this.windGain.gain.value = 0.075;
      wind.connect(filter); filter.connect(this.windGain); this.windGain.connect(this.master); wind.start();
      this.wind = wind;
    } catch { this.ctx = null; }
  }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
  tone(frequency, duration, volume = 0.1, type = 'sine', delay = 0, endFrequency = frequency) {
    if (!this.ctx || !this.volume) return;
    const t = this.ctx.currentTime + delay, osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(frequency, t); osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t + duration);
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + 0.008); gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(this.master); osc.start(t); osc.stop(t + duration + 0.02);
  }
  noiseHit(duration = 0.1, volume = 0.2, frequency = 700) {
    if (!this.ctx || !this.volume) return;
    const source = this.ctx.createBufferSource(), filter = this.ctx.createBiquadFilter(), gain = this.ctx.createGain();
    source.buffer = this.noise; source.playbackRate.value = 2 + Math.random(); filter.type = 'bandpass'; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.ctx.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(); source.stop(this.ctx.currentTime + duration);
  }
  step(water = false) { this.noiseHit(0.12, 0.16, water ? 1700 : 450); this.tone(water ? 160 : 90, 0.08, 0.055, 'triangle', 0, 45); }
  breakBlock() { this.noiseHit(0.2, 0.45, 950); this.tone(145, 0.13, 0.09, 'triangle', 0, 55); }
  place() { this.noiseHit(0.07, 0.2, 420); this.tone(190, 0.09, 0.1, 'triangle', 0, 85); }
  craft() { [440, 554.37, 659.25].forEach((f, i) => this.tone(f, 0.3, 0.09, 'sine', i * 0.09)); }
  ui() { this.tone(460, 0.07, 0.04, 'sine', 0, 600); }
  update(time, daylight, rain, active) {
    if (!this.ctx) return;
    this.windGain.gain.setTargetAtTime(active ? 0.07 + rain * 0.16 : 0.025, this.ctx.currentTime, 1);
    if (active && daylight > 0.2 && time > this.nextBird && rain < 0.4) {
      this.nextBird = time + 6 + Math.random() * 10;
      const f = 1500 + Math.random() * 1000;
      for (let i = 0; i < 3; i++) this.tone(f + i * 160, 0.11, 0.017, 'sine', i * 0.18, f + 650);
    }
  }
  destroy() { this.ctx?.close(); }
}