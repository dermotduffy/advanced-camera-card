import type { RingtoneFinishedHandler, Tone } from './types';

export class CustomTone implements Tone {
  private _audio: HTMLAudioElement | null = null;
  private _finishedHandler: RingtoneFinishedHandler | null = null;
  private readonly _url: string;

  private readonly _repeat: number;
  private _remaining = 0;

  constructor(url: string, repeat: number) {
    this._url = url;
    this._repeat = repeat;
  }

  public start(finishedHandler?: RingtoneFinishedHandler): void {
    if (this._audio) {
      return;
    }
    try {
      this._audio = new Audio(this._url);
    } catch {
      this._audio = null;
      // Treat constructor failure as natural completion so the caller can
      // release any lock it holds on our behalf.
      finishedHandler?.();
      return;
    }

    this._finishedHandler = finishedHandler ?? null;

    if (this._repeat === 0) {
      this._audio.loop = true;
    } else {
      this._remaining = this._repeat;
      this._audio.addEventListener('ended', this._handleEnded);
    }

    this._playAudio();
  }

  public stop(): void {
    if (this._audio) {
      this._audio.removeEventListener('ended', this._handleEnded);
      this._audio.pause();
      this._audio = null;
    }

    // Suppress any natural-completion callback -- the caller asked to stop.
    this._finishedHandler = null;
  }

  private _handleEnded = (): void => {
    /* v8 ignore next: stop() removes this listener before nulling
       _audio, so the handler can't fire with a null _audio -- @preserve */
    if (!this._audio) {
      return;
    }
    if (--this._remaining > 0) {
      this._playAudio();
      return;
    }
    this._finishNaturally();
  };

  private _playAudio(): void {
    /* v8 ignore next: callers (start, _handleEnded) only invoke
       _playAudio when _audio is non-null -- @preserve */
    if (!this._audio) {
      return;
    }
    this._audio.currentTime = 0;

    this._audio.play().catch(
      // On `play()` rejection (autoplay block, network failure, decode error) no
      // `ended` event will arrive, so signal completion ourselves to avoid leaks
      // at the higher level (e.g. the ringtone lock).
      () => this._finishNaturally(),
    );
  }

  private _finishNaturally(): void {
    const finishedHandler = this._finishedHandler;
    this.stop();
    finishedHandler?.();
  }
}
