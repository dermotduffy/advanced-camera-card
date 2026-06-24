import { Timer } from '../../../utils/timer';
import type { RingtoneFinishedHandler, Tone, ToneEnvelope } from './types';

// Shared scaffolding for tones generated via the Web Audio API: owns the
// AudioContext lifecycle, the repeat timer, and the bell-shaped note envelope.
// Subclasses implement `_play()` to define one iteration of their pattern, and
// call `_scheduleNext()` to loop.
//
// `repeat` caps how many iterations are played per `start()`. `0` means loop
// indefinitely; otherwise the tone schedules a final no-op timer to let the
// last iteration's decay tail finish audibly, then fires `finishedHandler` and
// self-stops.
export abstract class GeneratedTone implements Tone {
  private _context: AudioContext | null = null;
  private _timer = new Timer();
  private _finishedHandler: RingtoneFinishedHandler | null = null;

  private readonly _repeat: number;
  private _remaining = 0;

  constructor(repeat: number) {
    this._repeat = repeat;
  }

  public start(finishedHandler?: RingtoneFinishedHandler): void {
    if (this._context) {
      return;
    }
    try {
      this._context = new AudioContext();
    } catch {
      this._context = null;
      // Treat AudioContext construction failure as natural completion so the
      // caller can release any lock it holds on our behalf -- otherwise the
      // orchestrator can't tell silent failure from active playback.
      finishedHandler?.();
      return;
    }
    this._finishedHandler = finishedHandler ?? null;
    this._remaining = this._repeat;
    this._play();
  }

  public stop(): void {
    this._timer.stop();
    this._context?.close().catch(() => {});
    this._context = null;

    // Suppress any natural-completion callback -- the caller asked to stop.
    this._finishedHandler = null;
  }

  // Current AudioContext time. Subclasses only read this from inside `_play()`
  // where the context is always set.
  protected get _currentTime(): number {
    /* istanbul ignore next: _currentTime is only read by subclasses from
       _play() during an active context -- @preserve */
    return this._context?.currentTime ?? 0;
  }

  // Schedule the next iteration of `_play()`. Subclasses call this at the end
  // of their pattern to loop. No-ops if the context has already been closed so
  // a stopped tone can never re-arm its loop.
  protected _scheduleNext(intervalSeconds: number): void {
    /* istanbul ignore next: defensive guard against a subclass calling
       _scheduleNext after stop() -- JS single-threading makes this unreachable
       from the existing subclasses -- @preserve */
    if (!this._context) {
      return;
    }
    if (this._repeat > 0 && --this._remaining <= 0) {
      // Schedule one last wait for the decay tail.
      this._timer.start(intervalSeconds, () => {
        const finishedHandler = this._finishedHandler;
        this.stop();
        finishedHandler?.();
      });
      return;
    }
    this._timer.start(intervalSeconds, () => {
      /* istanbul ignore next: Timer.stop() cancels pending callbacks, so this
         re-entry guard is unreachable in practice -- @preserve */
      if (!this._context) {
        return;
      }
      this._play();
    });
  }

  // Plays one note: a smooth tone that rises to peak volume and then fades.
  protected _playNote(freq: number, when: number, envelope: ToneEnvelope): void {
    /* istanbul ignore next: _playNote is only called by subclasses from
       _play() during an active context -- @preserve */
    if (!this._context) {
      return;
    }
    const oscillator = this._context.createOscillator();
    const gain = this._context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    oscillator.connect(gain);
    gain.connect(this._context.destination);

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(envelope.peak, when + envelope.attack);
    gain.gain.setTargetAtTime(0, when + envelope.attack, envelope.decayTau);

    oscillator.start(when);
    oscillator.stop(when + envelope.hold);
  }

  // One iteration of the pattern. Implementations should call `_playNote(...)`
  // for each note and finish with `_scheduleNext(...)` to loop.
  protected abstract _play(): void;
}
