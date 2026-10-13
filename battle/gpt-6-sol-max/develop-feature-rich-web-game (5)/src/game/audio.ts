export class SynthAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private nextNote = 0;
  private step = 0;
  volume = 0.45;
  muted = false;

  wake() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume * 0.55;
        this.master.connect(this.ctx.destination);
        this.nextNote = this.ctx.currentTime;
      } catch {
        return;
      }
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.55, this.ctx.currentTime, 0.035);
  }

  setMuted(value: boolean) {
    this.muted = value;
    this.setVolume(this.volume);
  }

  private tone(frequency: number, duration: number, type: OscillatorType, gain: number, when = 0, ending?: number) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = Math.max(this.ctx.currentTime, when || this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (ending) osc.frequency.exponentialRampToValueAtTime(Math.max(25, ending), now + duration);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), now + Math.min(0.025, duration * 0.2));
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(envelope).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.025);
  }

  private noise(duration: number, gain: number, highpass = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const count = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, count, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < count; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / count);
    const source = this.ctx.createBufferSource();
    const envelope = this.ctx.createGain();
    source.buffer = buffer;
    envelope.gain.setValueAtTime(gain, this.ctx.currentTime);
    envelope.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
    if (highpass) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = highpass;
      source.connect(filter).connect(envelope).connect(this.master);
    } else source.connect(envelope).connect(this.master);
    source.start();
  }

  play(name: "mine" | "wood" | "collect" | "craft" | "swing" | "hit" | "hurt" | "eat" | "place" | "jump" | "arrow" | "explosion" | "boss" | "win" | "level" | "ui") {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case "mine": this.noise(0.08, 0.045, 340); this.tone(150 + Math.random() * 45, 0.08, "triangle", 0.085, t, 65); break;
      case "wood": this.tone(125 + Math.random() * 35, 0.095, "triangle", 0.11, t, 75); break;
      case "collect": this.tone(420, 0.09, "sine", 0.10); this.tone(630, 0.16, "sine", 0.07, t + 0.065); break;
      case "craft": [330, 415, 554, 660].forEach((n, i) => this.tone(n, 0.2, "triangle", 0.11, t + i * 0.075)); break;
      case "swing": this.noise(0.12, 0.025, 800); break;
      case "hit": this.noise(0.12, 0.08, 180); this.tone(105, 0.13, "sawtooth", 0.08, t, 50); break;
      case "hurt": this.tone(180, 0.31, "sawtooth", 0.11, t, 58); this.noise(0.2, 0.06); break;
      case "eat": this.tone(235, 0.12, "triangle", 0.065, t, 155); this.tone(205, 0.1, "triangle", 0.05, t + 0.12, 140); break;
      case "place": this.tone(210, 0.09, "triangle", 0.085, t, 120); break;
      case "jump": this.tone(195, 0.12, "sine", 0.035, t, 260); break;
      case "arrow": this.noise(0.17, 0.04, 1600); this.tone(780, 0.18, "sine", 0.04, t, 230); break;
      case "explosion": this.noise(0.6, 0.21); this.tone(90, 0.55, "sawtooth", 0.17, t, 32); break;
      case "boss": this.tone(92, 1.4, "sawtooth", 0.13, t, 45); this.tone(138, 1.1, "triangle", 0.08, t + 0.12, 58); break;
      case "win": [330, 392, 494, 659, 784, 988].forEach((n, i) => this.tone(n, 0.7, "sine", 0.1, t + i * 0.16)); break;
      case "level": [330, 440, 554].forEach((n, i) => this.tone(n, 0.3, "sine", 0.1, t + i * 0.09)); break;
      case "ui": this.tone(480, 0.08, "sine", 0.035); break;
    }
  }

  update(night: boolean, danger: boolean, boss: boolean) {
    if (!this.ctx || this.ctx.state !== "running" || this.muted) return;
    const interval = boss ? 0.23 : danger ? 0.34 : 0.55;
    if (this.nextNote < this.ctx.currentTime - 1) this.nextNote = this.ctx.currentTime;
    const scale = night ? [146.83, 174.61, 196, 220, 261.63, 293.66, 349.23, 392] : [164.81, 196, 220, 246.94, 293.66, 329.63, 392, 440];
    while (this.nextNote < this.ctx.currentTime + 0.12) {
      const pattern = [0, 2, 4, 2, 5, 4, 2, 1, 0, 3, 5, 3, 6, 5, 3, 2];
      const note = scale[pattern[this.step % pattern.length]];
      if (this.step % (boss ? 1 : 2) === 0 || danger) this.tone(note * (boss ? 1 : 0.5), interval * 1.7, "triangle", boss ? 0.026 : 0.018, this.nextNote);
      if (this.step % 8 === 0) this.tone(scale[0] / 4, interval * 7, "sine", 0.022, this.nextNote);
      if (danger && this.step % 4 === 0) this.tone(60, 0.18, "sine", 0.055, this.nextNote, 37);
      this.step++;
      this.nextNote += interval;
    }
  }

  resetMusic() {
    this.step = 0;
    if (this.ctx) this.nextNote = this.ctx.currentTime + .08;
  }

  dispose() {
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
  }
}