import {
  MediaQueryWatcher,
  type MediaQueryWatcherUnsubscribeCallback,
} from '../../common/media-query-watcher';
import { buildCardTriggerData } from '../build-trigger-data';
import type { TriggerCallback, TriggerEvaluator, TriggerOfType } from './types';

// `screen` watches a matchMedia query, whose state lives outside the card's
// `ConditionState`, so it owns a `MediaQueryWatcher` (the same watcher the
// screen condition uses). It fires on the rising edge of the query match --
// consistent with "value present => fire on change to that value".
export class ScreenTrigger implements TriggerEvaluator {
  private _trigger: TriggerOfType<'screen'>;

  private _callback: TriggerCallback | null = null;
  private _watcher: MediaQueryWatcher | null = null;
  private _unsubscribeCallback: MediaQueryWatcherUnsubscribeCallback | null = null;
  private _matched = false;

  constructor(trigger: TriggerOfType<'screen'>) {
    this._trigger = trigger;
  }

  public subscribe(callback: TriggerCallback): void {
    if (!this._trigger.media_query) {
      return;
    }
    this._callback = callback;
    this._watcher = new MediaQueryWatcher(this._trigger.media_query);
    this._matched = this._watcher.matches();
    this._unsubscribeCallback = this._watcher.subscribe(this._handler);
  }

  public destroy(): void {
    this._unsubscribeCallback?.();
    this._unsubscribeCallback = null;
    this._watcher = null;
    this._callback = null;
  }

  private _handler = (): void => {
    const matched = !!this._watcher?.matches();
    if (matched && !this._matched) {
      this._callback?.(buildCardTriggerData(this._trigger.trigger));
    }
    this._matched = matched;
  };
}
