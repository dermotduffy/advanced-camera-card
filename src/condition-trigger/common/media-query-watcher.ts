export type MediaQueryWatcherUnsubscribeCallback = () => void;

// Watches a single CSS media query via `window.matchMedia`. The shared change
// source for the `screen` condition and trigger, whose match state lives
// outside the card's `ConditionState`.
export class MediaQueryWatcher {
  private _query: string;
  private _mediaQuery: MediaQueryList | null = null;
  private _callback: (() => void) | null = null;

  constructor(query: string) {
    this._query = query;
  }

  public matches(): boolean {
    return window.matchMedia(this._query).matches;
  }

  public subscribe(callback: () => void): MediaQueryWatcherUnsubscribeCallback {
    this._callback = callback;
    this._mediaQuery = window.matchMedia(this._query);
    this._mediaQuery.addEventListener('change', this._handler);

    return (): void => {
      this._mediaQuery?.removeEventListener('change', this._handler);
      this._mediaQuery = null;
      this._callback = null;
    };
  }

  private _handler = (): void => this._callback?.();
}
