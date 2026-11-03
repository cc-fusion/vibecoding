export class GameAudio {
  enabled = true;
  private context: AudioContext | null = null;

  private getContext() {
    if (!this.enabled) return null;
    try {
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    } catch {
      return null;
    }
  }

  play(type: 'break' | 'place' | 'step' | 'craft' | 'click' | 'shear') {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const duration = type === 'craft' ? 0.24 : type === 'step' ? 0.055 : 0.11;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    oscillator.type = type === 'craft' || type === 'click' ? 'sine' : 'triangle';
    const frequency = { break: 145, place: 190, step: 95, craft: 520, click: 420, shear: 300 }[type];
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(type === 'craft' ? frequency * 1.5 : frequency * 0.55, now + duration);
    filter.type = 'lowpass';
    filter.frequency.value = type === 'craft' ? 1200 : 550;
    gain.gain.setValueAtTime(type === 'step' ? 0.025 : 0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(filter).connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  dispose() {
    if (this.context) void this.context.close();
    this.context = null;
  }
}