// Lightweight sound manager using the Web Audio API.
// Generates retro arcade beeps procedurally — no external audio files needed.
// Supports muting / unmuting and gracefully degrades if audio is unavailable.

type SoundName = 'eat' | 'gameover' | 'move' | 'start';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('snake-muted') === '1';
    } catch {
      // ignore
    }
  }

  /** Lazily create the AudioContext (must be triggered by user gesture). */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      localStorage.setItem('snake-muted', this.muted ? '1' : '0');
    } catch {
      // ignore
    }
    return this.muted;
  }

  /** Resume the audio context after a user interaction (browser autoplay policy). */
  resume(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
  }

  /** Play a short tone with the given frequency, duration, and type. */
  private playTone(freq: number, duration: number, type: OscillatorType = 'square', volume = 0.12): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      // Envelope: quick attack, exponential decay
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
    } catch {
      // ignore playback errors
    }
  }

  play(name: SoundName): void {
    switch (name) {
      case 'eat':
        // Two quick ascending blips
        this.playTone(660, 0.08, 'square', 0.1);
        setTimeout(() => this.playTone(880, 0.08, 'square', 0.1), 60);
        break;
      case 'start':
        this.playTone(440, 0.1, 'square', 0.1);
        setTimeout(() => this.playTone(660, 0.1, 'square', 0.1), 100);
        setTimeout(() => this.playTone(880, 0.15, 'square', 0.1), 200);
        break;
      case 'gameover':
        this.playTone(300, 0.2, 'sawtooth', 0.12);
        setTimeout(() => this.playTone(200, 0.2, 'sawtooth', 0.12), 150);
        setTimeout(() => this.playTone(120, 0.4, 'sawtooth', 0.12), 300);
        break;
      case 'move':
        // Subtle tick — too quiet to be annoying
        this.playTone(200, 0.02, 'square', 0.03);
        break;
      default:
        break;
    }
  }
}
