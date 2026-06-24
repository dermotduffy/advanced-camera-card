import type { RingtoneConfig } from '../../config/schema/live';
import { ArpeggioTone } from './tones/arpeggio';
import { ChimeTone } from './tones/chime';
import { CustomTone } from './tones/custom';
import { MelodyTone } from './tones/melody';
import type { Tone } from './tones/types';
import { WestminsterTone } from './tones/westminster';

// Module-level singleton lock: only one `Ringtone` plays at a time across all
// card instances on the page. The HA dashboard can render multiple card
// instances simultaneously (e.g. dashboard card + editor preview, or the same
// card placed twice), all of which may independently react to the same trigger
// state change -- with no lock, every instance would start its own AudioContext
// and the audio would layer. First-to-start wins; subsequent `start()` calls
// from other holders are no-ops until the active one releases via `stop()`.
// The `isPlaying()` sweep below is defensive against a future code path that
// clears `_tone` without removing from the lock -- today every such path keeps
// them in sync, but the sweep prevents a regression from wedging the lock.
const sharedLock = new Set<Ringtone>();

export class Ringtone {
  private _tone: Tone | null = null;
  private readonly lock: Set<Ringtone>;

  // The `lock` parameter defaults to the module-level singleton so production
  // callers (`new Ringtone()`) get cross-instance coordination automatically.
  // Test callers can pass `new Set()` per test to isolate state without
  // touching a process-wide value.
  constructor(lock: Set<Ringtone> = sharedLock) {
    this.lock = lock;
  }

  public start(config: RingtoneConfig): void {
    if (this._tone) {
      return;
    }

    // Drop any stale holders before checking the lock.
    for (const other of this.lock) {
      if (!other.isPlaying()) {
        this.lock.delete(other);
      }
    }

    // Another tone is already ringing.
    if (this.lock.size) {
      return;
    }

    this._tone = this._createTone(config);
    if (this._tone) {
      this.lock.add(this);
      this._tone.start(() => this._handleToneEnd());
    }
  }

  public stop(): void {
    this._tone?.stop();
    this._tone = null;
    this.lock.delete(this);
  }

  public isPlaying(): boolean {
    return !!this._tone;
  }

  private _handleToneEnd(): void {
    this._tone = null;
    this.lock.delete(this);
  }

  private _createTone(config: RingtoneConfig): Tone | null {
    switch (config.type) {
      case 'chime':
        return new ChimeTone(config.repeat);
      case 'westminster':
        return new WestminsterTone(config.repeat);
      case 'arpeggio':
        return new ArpeggioTone(config.repeat);
      case 'melody':
        return new MelodyTone(config.repeat);
      case 'custom':
        return config.url ? new CustomTone(config.url, config.repeat) : null;
      case 'none':
        return null;
    }
  }
}
