export class SoundManager {
  constructor() {
    this.ctx = null;
    this.noiseBuffer = null;
    this.sfxVolume = 0.75;
    this.musicVolume = 0.35;
    this.musicTimer = 7.0;
  }

  _ensureContext() {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        const len = this.ctx.sampleRate * 0.5;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      } catch {
        return false;
      }
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx.state === 'running';
  }

  unlock() {
    this._ensureContext();
  }

  _playNoise(duration, filterFreq, filterType = 'bandpass', gainVal = 0.18, q = 1.2) {
    if (this.sfxVolume <= 0.01 || !this._ensureContext()) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq * (0.9 + Math.random() * 0.2), now);
    filter.Q.value = q;

    const gain = this.ctx.createGain();
    const peak = gainVal * this.sfxVolume;
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    src.start(now);
    src.stop(now + duration);
  }

  _playTone(freq, endFreq, duration, type = 'triangle', gainVal = 0.16) {
    if (this.sfxVolume <= 0.01 || !this._ensureContext()) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal * this.sfxVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  playStep(surface = 'grass') {
    if (surface === 'stone') {
      this._playNoise(0.06, 1100, 'bandpass', 0.11, 1.8);
      this._playTone(150, 95, 0.05, 'sine', 0.07);
    } else if (surface === 'wood') {
      this._playTone(190 + Math.random() * 25, 110, 0.07, 'triangle', 0.13);
      this._playNoise(0.05, 700, 'lowpass', 0.08);
    } else if (surface === 'sand') {
      this._playNoise(0.09, 2100, 'bandpass', 0.09, 0.9);
    } else if (surface === 'water') {
      this._playNoise(0.14, 750, 'bandpass', 0.12, 1.5);
    } else {
      // Grass / turf
      this._playNoise(0.075, 1450, 'bandpass', 0.09, 1.1);
      this._playTone(115, 75, 0.045, 'sine', 0.05);
    }
  }

  playHit(surface = 'stone') {
    const freqMap = { stone: 950, wood: 520, grass: 1300, sand: 1650 };
    this._playNoise(0.06, freqMap[surface] || 900, 'bandpass', 0.14, 1.6);
    this._playTone(surface === 'wood' ? 220 : 280, 140, 0.055, 'triangle', 0.09);
  }

  playBreak(surface = 'stone') {
    const freqMap = { stone: 780, wood: 480, grass: 1200, sand: 1500 };
    this._playNoise(0.18, freqMap[surface] || 820, 'lowpass', 0.28, 1.0);
    this._playTone(210, 72, 0.14, 'triangle', 0.18);
  }

  playPlace(surface = 'stone') {
    const base = surface === 'wood' ? 230 : surface === 'grass' ? 180 : 260;
    this._playTone(base, base * 0.65, 0.085, 'triangle', 0.18);
    this._playNoise(0.06, 900, 'lowpass', 0.12);
  }

  playPickup() {
    this._playTone(520, 880, 0.09, 'sine', 0.16);
  }

  playCraft() {
    this._playTone(440, 660, 0.12, 'triangle', 0.16);
    setTimeout(() => this._playTone(660, 880, 0.14, 'sine', 0.14), 55);
  }

  playMilestone() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      setTimeout(() => this._playTone(f, f, 0.28, 'sine', 0.13), idx * 80);
    });
  }

  playEat() {
    this._playNoise(0.11, 1100, 'bandpass', 0.2, 1.2);
    setTimeout(() => this._playNoise(0.1, 950, 'bandpass', 0.18, 1.2), 90);
  }

  playSplash() {
    this._playNoise(0.28, 650, 'bandpass', 0.26, 0.8);
    this._playTone(240, 90, 0.18, 'sine', 0.12);
  }

  playHurt() {
    this._playTone(190, 68, 0.18, 'sawtooth', 0.18);
    this._playNoise(0.12, 550, 'lowpass', 0.2);
  }

  playMobHit() {
    this._playTone(260, 120, 0.12, 'triangle', 0.18);
    this._playNoise(0.08, 800, 'lowpass', 0.15);
  }

  playToolBreak() {
    this._playNoise(0.22, 1400, 'bandpass', 0.25, 1.4);
    this._playTone(300, 90, 0.22, 'sawtooth', 0.16);
  }

  playClick() {
    this._playTone(620, 480, 0.035, 'sine', 0.08);
  }

  updateAmbientMusic(dt) {
    if (this.musicVolume <= 0.01) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;

    this.musicTimer = 13 + Math.random() * 11;
    if (!this._ensureContext()) return;

    // Gentle C-major / A-minor pentatonic ambient chord
    const chords = [
      [261.63, 329.63, 392.0, 493.88], // Cmaj7
      [220.0, 261.63, 329.63, 392.0],  // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [196.0, 246.94, 293.66, 392.0],  // G6
    ];
    const chord = chords[Math.floor(Math.random() * chords.length)];
    const now = this.ctx.currentTime;

    chord.forEach((freq, i) => {
      if (Math.random() < 0.18 && i > 1) return;
      const start = now + i * 0.36 + Math.random() * 0.12;
      const dur = 4.2 + Math.random() * 1.6;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const gain = this.ctx.createGain();
      const peak = 0.048 * this.musicVolume;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.05);
    });
  }
}
