import { ReactiveController, ReactiveControllerHost } from 'lit';
import { Timer } from '../utils/timer';

export class CachedValueController<T> implements ReactiveController {
  private _value?: T;
  private _host: ReactiveControllerHost;
  private _timerSeconds: number;
  private _callback: () => T;
  private _timerStartCallback?: () => void;
  private _timerStopCallback?: () => void;
  private _timer = new Timer();

  constructor(
    host: ReactiveControllerHost,
    timerSeconds: number,
    callback: () => T,
    timerStartCallback?: () => void,
    timerStopCallback?: () => void,
  ) {
    this._timerSeconds = timerSeconds;
    this._callback = callback;
    this._timerStartCallback = timerStartCallback;
    this._timerStopCallback = timerStopCallback;
    (this._host = host).addController(this);
  }

  /**
   * Remove the controller for the host.
   */
  public removeController(): void {
    this.stopTimer();
    this._host.removeController(this);
  }

  /**
   * Get the value.
   */
  get value(): T | undefined {
    return this._value;
  }

  /**
   * Update the cached value.
   */
  public updateValue(): void {
    this._value = this._callback();
  }

  /**
   * Clear the cached value.
   */
  public clearValue(): void {
    this._value = undefined;
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

    this._timerStartCallback?.();
    this._timer.startRepeated(this._timerSeconds, () => {
      this.updateValue();
      this._host.requestUpdate();
    });
  }

  public hasTimer(): boolean {
    return this._timer.isRunning();
  }

  /**
   * Host has connected to the cache.
   */
  hostConnected(): void {
    this.updateValue();
    this.startTimer();
    this._host.requestUpdate();
  }

  /**
   * Host has disconnected from the cache.
   */
  hostDisconnected(): void {
    this.clearValue();
    this.stopTimer();
  }
}
