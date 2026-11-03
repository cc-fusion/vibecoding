type Sound = 'break' | 'place' | 'step' | 'craft' | 'select' | 'shear' | 'hurt'

export class GameAudio {
  enabled = true
  private context: AudioContext | null = null

  unlock() {
    if (!this.context) this.context = new AudioContext()
    if (this.context.state === 'suspended') void this.context.resume()
  }

  play(sound: Sound) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return
    const ctx = this.context
    const settings: Record<Sound, [number, number, number, OscillatorType]> = {
      break: [125, 62, 0.11, 'triangle'],
      place: [190, 105, 0.09, 'sine'],
      step: [95, 65, 0.045, 'sine'],
      craft: [440, 680, 0.16, 'sine'],
      select: [380, 310, 0.035, 'sine'],
      shear: [530, 280, 0.11, 'triangle'],
      hurt: [160, 75, 0.18, 'sawtooth'],
    }
    const [start, end, duration, type] = settings[sound]
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(start, ctx.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(end, ctx.currentTime + duration)
    gain.gain.setValueAtTime(sound === 'step' ? 0.025 : 0.045, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + duration)
  }

  dispose() {
    if (this.context) void this.context.close()
  }
}