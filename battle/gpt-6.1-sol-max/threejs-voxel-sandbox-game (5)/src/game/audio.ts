export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private volume = 0.45;
  private lastBird = 0;

  start() {
    if (this.context) { void this.context.resume(); return; }
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * 0.5;
      this.master.connect(this.context.destination);
      const buffer = this.context.createBuffer(1, this.context.sampleRate * 3, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02; data[i] = previous * 3; }
      const source = this.context.createBufferSource();
      source.buffer = buffer; source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 500;
      this.ambient = this.context.createGain(); this.ambient.gain.value = 0.13;
      source.connect(filter); filter.connect(this.ambient); this.ambient.connect(this.master); source.start();
    } catch { /* Browsers without Web Audio still have the complete game. */ }
  }

  setVolume(volume: number) {
    this.volume = volume / 100;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume * 0.5, this.context.currentTime, 0.1);
  }

  tone(frequency: number, duration: number, gain = 0.2, type: OscillatorType = 'sine', delay = 0) {
    if (!this.context || !this.master || this.context.state !== 'running') return;
    const oscillator = this.context.createOscillator(), envelope = this.context.createGain();
    const time = this.context.currentTime + delay;
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.65, time + duration);
    envelope.gain.setValueAtTime(0.001, time); envelope.gain.exponentialRampToValueAtTime(gain, time + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.001, time + duration);
    oscillator.connect(envelope); envelope.connect(this.master); oscillator.start(time); oscillator.stop(time + duration + 0.01);
  }

  noise(duration: number, gain: number, frequency = 1200) {
    if (!this.context || !this.master || this.context.state !== 'running') return;
    const length = Math.floor(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), envelope = this.context.createGain();
    source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency; envelope.gain.value = gain;
    source.connect(filter); filter.connect(envelope); envelope.connect(this.master); source.start();
  }

  play(kind: 'step' | 'break' | 'place' | 'craft' | 'pickup' | 'hurt' | 'click' | 'splash' | 'achievement') {
    if (kind === 'step') this.noise(0.08, 0.13, 500 + Math.random() * 400);
    if (kind === 'break') { this.noise(0.2, 0.32, 2100); this.tone(90, 0.1, 0.16, 'triangle'); }
    if (kind === 'place') { this.noise(0.07, 0.18, 700); this.tone(180, 0.06, 0.13, 'triangle'); }
    if (kind === 'craft' || kind === 'achievement') [523, 659, 784, ...(kind === 'achievement' ? [1047] : [])].forEach((f, i) => this.tone(f, 0.24, 0.13, 'sine', i * 0.09));
    if (kind === 'pickup') this.tone(720, 0.1, 0.11);
    if (kind === 'hurt') { this.noise(0.16, 0.23, 450); this.tone(110, 0.18, 0.2, 'triangle'); }
    if (kind === 'click') this.tone(600, 0.04, 0.05);
    if (kind === 'splash') this.noise(0.25, 0.25, 3000);
  }

  update(time: number, rain: boolean, active: boolean) {
    if (this.ambient && this.context) this.ambient.gain.setTargetAtTime(active ? (rain ? 0.4 : 0.13) : 0.04, this.context.currentTime, 1);
    if (active && !rain && time - this.lastBird > 9 + Math.random() * 9) {
      this.lastBird = time;
      [1900, 2400, 2100].forEach((f, i) => this.tone(f, 0.08, 0.025, 'sine', i * 0.13));
    }
  }
  dispose() { void this.context?.close(); this.context = null; }
}