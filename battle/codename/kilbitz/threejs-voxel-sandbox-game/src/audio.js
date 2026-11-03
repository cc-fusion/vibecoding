export class AudioManager {
  constructor(volume = 0.65) {
    this.volume = volume;
    this.context = null;
    this.master = null;
    this.musicTimer = 5;
    this.enabled = true;
  }

  ensure() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    this.context = new Context();
    this.master = this.context.createGain();
    this.master.gain.value = this.volume;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.ratio.value = 5;
    this.master.connect(compressor).connect(this.context.destination);

    const length = this.context.sampleRate * 2;
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.82 + white * 0.18;
      data[i] = last;
    }
    const ambient = this.context.createBufferSource();
    ambient.buffer = this.noiseBuffer;
    ambient.loop = true;
    const windFilter = this.context.createBiquadFilter();
    windFilter.type = 'lowpass'; windFilter.frequency.value = 480;
    this.windGain = this.context.createGain(); this.windGain.gain.value = 0.025;
    ambient.connect(windFilter).connect(this.windGain).connect(this.master);
    const rainFilter = this.context.createBiquadFilter();
    rainFilter.type = 'highpass'; rainFilter.frequency.value = 1500;
    this.rainGain = this.context.createGain(); this.rainGain.gain.value = 0;
    ambient.connect(rainFilter).connect(this.rainGain).connect(this.master);
    ambient.start();
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.enabled = this.volume > 0;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.03);
  }

  tone(frequency, duration = 0.1, type = 'sine', volume = 0.1, endFrequency = null, delay = 0) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + Math.min(0.02, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now); oscillator.stop(now + duration + 0.02);
  }

  noise(duration = 0.1, volume = 0.1, frequency = 800, type = 'lowpass') {
    if (!this.context || !this.enabled || !this.noiseBuffer) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = type; filter.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(now, Math.random()); source.stop(now + duration + 0.01);
  }

  play(name, material = '') {
    if (!this.context || !this.enabled) return;
    switch (name) {
      case 'break':
        this.noise(0.15, 0.17, material === 'stone' ? 950 : 520);
        this.tone(95, 0.08, 'square', 0.035, 60);
        break;
      case 'mine': this.noise(0.045, 0.055, 900); break;
      case 'place': this.tone(125, 0.07, 'square', 0.07, 82); this.noise(0.05, 0.05, 600); break;
      case 'pickup': this.tone(610, 0.07, 'sine', 0.07, 850); break;
      case 'craft':
        this.tone(330, 0.12, 'triangle', 0.07);
        this.tone(440, 0.13, 'triangle', 0.07, null, 0.08);
        this.tone(660, 0.18, 'triangle', 0.06, null, 0.16);
        break;
      case 'hit': this.noise(0.09, 0.2, 420); this.tone(110, 0.08, 'square', 0.06, 75); break;
      case 'swing': this.noise(0.08, 0.045, 1200, 'highpass'); break;
      case 'hurt': this.tone(120, 0.22, 'sawtooth', 0.11, 55); break;
      case 'eat': this.noise(0.1, 0.09, 750); this.tone(160, 0.06, 'triangle', 0.025); break;
      case 'level':
        [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.07, null, i * 0.1));
        break;
      case 'boss':
        this.tone(65, 1.2, 'sawtooth', 0.15, 35);
        this.tone(98, 1, 'square', 0.05, 48, 0.12);
        break;
      case 'summon':
        this.tone(110, 1.1, 'sine', 0.1, 440);
        this.tone(165, 1.3, 'triangle', 0.07, 660, 0.1);
        break;
      case 'splash': this.noise(0.22, 0.1, 1300); break;
      case 'step': {
        const soft = material === 'sand' || material === 'grass_block' || material === 'dirt' || material === 'snow' || material === 'mud';
        this.noise(0.055, 0.035, soft ? 380 : 850);
        break;
      }
      case 'death': this.tone(220, 1.4, 'triangle', 0.1, 45); break;
      case 'click': this.tone(420, 0.035, 'sine', 0.035); break;
      case 'error': this.tone(150, 0.12, 'square', 0.045, 115); break;
      case 'thunder': this.noise(1.4, 0.22, 260); this.tone(48, 1.1, 'sawtooth', 0.08, 25); break;
    }
  }

  update(dt, { rain = 0, underwater = false, night = false, active = true } = {}) {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.rainGain?.gain.setTargetAtTime(active ? rain * 0.12 : 0, now, 0.5);
    this.windGain?.gain.setTargetAtTime(active ? (underwater ? 0.055 : 0.025) : 0, now, 0.5);
    if (!active || !this.enabled) return;
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 10 + Math.random() * 12;
      const scale = night ? [220, 261.6, 293.7, 329.6] : [261.6, 329.6, 392, 440];
      const root = scale[Math.floor(Math.random() * scale.length)];
      this.tone(root, 2.8, 'sine', underwater ? 0.012 : 0.018);
      this.tone(root * 1.5, 2.4, 'sine', 0.012, null, 0.3);
    }
  }
}
