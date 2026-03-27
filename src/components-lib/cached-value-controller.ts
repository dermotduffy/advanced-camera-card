import { ReactiveController, ReactiveControllerHost } from 'lit';
import { Timer } from '../utils/timer';

export class CachedValueController<T> implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;

  private _value: T | null = null;

  private _timerSeconds: number | null = null;

  private _callback: () => T;

  private _getTimerSecondsCallback: () => number | null;

  private _timerStartCallback?: () => void;
  private _timerStopCallback?: () => void;
  private _timerTickCallback?: () => void;
  private _timer = new Timer();

  constructor(
    host: ReactiveControllerHost & HTMLElement,
    getTimerSecondsCallback: () => number | null,
    callback: () => T,
    timerStartCallback?: () => void,
    timerStopCallback?: () => void,
    timerTickCallback?: () => void,
  ) {
    this._getTimerSecondsCallback = getTimerSecondsCallback;
    this._timerSeconds = getTimerSecondsCallback();
    this._callback = callback;
    this._timerStartCallback = timerStartCallback;
    this._timerStopCallback = timerStopCallback;
    this._timerTickCallback = timerTickCallback;
    (this._host = host).addController(this);
  }

  /**
   * Get the value.
   */
  public getValue(): T | null {
    return this._value;
  }

  /**
   * Update the cached value.
   */
  public updateValue(): void {
    this._value = this._callback();
    this._host.requestUpdate();
  }

  /**
   * Clear the cached value.
   */
  public clearValue(): void {
    this._value = null;
  }

  /**
   * Disable the timer.
   */
  public stopTimer(): void {
    if (this._timer.isRunning()) {
      this._timer.stop();
      this._timerStopCallback?.();
    }
  }

  /**
   * Enable the timer. Repeated calls will have no effect.
   */
  public startTimer(): void {
    this.stopTimer();

    if (!this._timerSeconds || this._timerSeconds <= 0) {
      return;
    }

    this._timerStartCallback?.();
    this._timer.startRepeated(this._timerSeconds, () => {
      this._timerTickCallback?.();
      this.updateValue();
    });
  }

  public hasTimer(): boolean {
    return this._timer.isRunning();
  }

  public hostUpdate(): void {
    const newTimerSeconds = this._getTimerSecondsCallback();
    if (newTimerSeconds !== this._timerSeconds) {
      this._timerSeconds = newTimerSeconds;
      if (this._host.isConnected) {
        this.startTimer();
      }
    }
  }

  /**
   * Host has connected to the cache.
   */
  hostConnected(): void {
    this.updateValue();
    this.startTimer();
  }

  /**
   * Host has disconnected from the cache.
   */
  hostDisconnected(): void {
    this.clearValue();
    this.stopTimer();
  }
}
