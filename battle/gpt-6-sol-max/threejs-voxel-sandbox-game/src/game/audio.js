import { B } from "./blocks.js";

export class AudioEngine {
  constructor(volume = 0.55) {
    this.volume = volume;
    this.context = null;
    this.lastBird = 0;
    this.rainGain = null;
  }

  start() {
    if (this.context) {
      if (this.context.state === "suspended") this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume * 0.52;
      this.master.connect(this.context.destination);
      const length = this.context.sampleRate * 2;
      this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const values = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) values[i] = Math.random() * 2 - 1;
      const source = this.context.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1150;
      this.rainGain = this.context.createGain();
      this.rainGain.gain.value = 0;
      source.connect(filter).connect(this.rainGain).connect(this.master);
      source.start();
      this.rainSource = source;
    } catch (error) {
      console.warn("Audio is unavailable:", error);
    }
  }

  setVolume(value) {
    this.volume = value;
    if (this.master && this.context) this.master.gain.setTargetAtTime(value * 0.52, this.context.currentTime, 0.08);
  }

  tone(frequency, duration, waveform = "sine", gain = 0.1, endFrequency = frequency) {
    if (!this.context || !this.master || !this.volume) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), now + duration);
    envelope.gain.setValueAtTime(Math.max(0.0001, gain), now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(envelope).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.01);
  }

  noise(duration, frequency = 800, gain = 0.1) {
    if (!this.context || !this.noiseBuffer || !this.volume) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.7 + Math.random() * 0.6;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = frequency;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(gain, now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.01);
  }

  step(block) {
    const sandy = block === B.SAND || block === B.GRAVEL;
    const wooden = block === B.PLANKS || block === B.LOG;
    this.noise(0.1, sandy ? 1250 : wooden ? 580 : 900, 0.085);
    this.tone(wooden ? 135 : 90, 0.065, "sine", 0.048, 65);
  }

  mine(block) {
    const stone = [B.STONE, B.COBBLE, B.COAL_ORE, B.IRON_ORE].includes(block);
    this.noise(0.11, stone ? 1350 : 680, 0.09);
    this.tone(stone ? 195 : 120, 0.095, "triangle", 0.045, stone ? 100 : 72);
  }

  break(block) {
    this.noise(0.26, block === B.LOG ? 720 : 1600, 0.19);
    this.tone(185, 0.18, "triangle", 0.07, 85);
  }

  place() {
    this.noise(0.09, 470, 0.11);
    this.tone(145, 0.09, "sine", 0.07, 93);
  }

  pickup() { this.tone(690, 0.12, "sine", 0.06, 900); }
  craft() { this.tone(440, 0.18, "sine", 0.075, 660); setTimeout(() => this.tone(660, 0.2, "sine", 0.065, 880), 85); }
  click() { this.tone(380, 0.06, "sine", 0.035, 290); }
  jump() { this.tone(130, 0.1, "sine", 0.035, 155); }
  hurt() { this.noise(0.35, 380, 0.17); this.tone(190, 0.28, "sawtooth", 0.08, 70); }
  creature() { this.tone(280, 0.24, "triangle", 0.075, 190); }
  sleep() { this.tone(420, 0.8, "sine", 0.07, 620); }

  update(time, weather, daylight) {
    if (!this.context) return;
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(weather === "rain" ? 0.13 : 0, this.context.currentTime, 0.8);
    if (time > this.lastBird && weather !== "rain" && daylight > 0.45) {
      this.lastBird = time + 9 + Math.random() * 16;
      this.tone(1220 + Math.random() * 250, 0.12, "sine", 0.025, 1730);
      setTimeout(() => this.tone(1460, 0.12, "sine", 0.018, 1060), 130);
    }
  }

  dispose() {
    if (this.rainSource) this.rainSource.stop();
    if (this.context) this.context.close();
    this.context = null;
  }
}