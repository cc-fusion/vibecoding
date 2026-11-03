type SoundName = 'break' | 'place' | 'step' | 'jump' | 'craft' | 'select' | 'hurt';

export class GameAudio {
  enabled = true;
  private context: AudioContext | null = null;

  start() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
    } catch { /* Audio is optional when a browser does not support it. */ }
  }

  play(name: SoundName) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const context = this.context;
    const now = context.currentTime;
    const presets: Record<SoundName, [number, number, number, OscillatorType]> = {
      break: [165, 68, 0.13, 'triangle'], place: [260, 135, 0.09, 'triangle'],
      step: [120, 75, 0.045, 'sine'], jump: [220, 320, 0.09, 'sine'],
      craft: [430, 660, 0.13, 'sine'], select: [420, 510, 0.045, 'sine'],
      hurt: [180, 90, 0.2, 'sawtooth'],
    };
    const [from, to, duration, type] = presets[name];
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(name === 'step' ? 0.025 : 0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain); gain.connect(context.destination);
    oscillator.start(now); oscillator.stop(now + duration);
  }

  dispose() { if (this.context) void this.context.close(); }
}