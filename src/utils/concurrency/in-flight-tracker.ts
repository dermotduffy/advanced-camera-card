import type { UnsubscribeCallback } from '../../types';

type SettledCallback = () => void;

/**
 * Tracks promises that have not yet settled (resolved or rejected), and
 * notifies subscribers when the last one does.
 */
export class InFlightTracker {
  private _inFlight = 0;
  private _settledCallbacks = new Set<SettledCallback>();

  public isInFlight(): boolean {
    return this._inFlight > 0;
  }

  public track(promise: Promise<unknown>): void {
    ++this._inFlight;

    const settle = (): void => {
      --this._inFlight;
      if (!this.isInFlight()) {
        this._settledCallbacks.forEach((callback) => callback());
      }
    };
    promise.then(settle, settle);
  }

  /**
   * Subscribe to the moment the last tracked promise settles.
   */
  public subscribe(callback: SettledCallback): UnsubscribeCallback {
    this._settledCallbacks.add(callback);
    return () => {
      this._settledCallbacks.delete(callback);
    };
  }
}
