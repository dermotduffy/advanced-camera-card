import { uniq } from 'lodash-es';

import {
  EventSubscriptionRequest,
  EventWatcherSubscriptionInterface,
} from '../../../card-controller/hass/event-watcher';
import { matchesEventContext, matchesEventData } from '../../../ha/event-match';
import { arrayify } from '../../../utils/basic';
import {
  TriggerCallback,
  TriggerEvaluator,
  TriggerEvaluatorContext,
  TriggerOfType,
} from './types';

// Subscribes via the shared EventWatcher to one or more HA bus event types and
// fires every time a matching event arrives. List-form `event_type` expands
// into one EventWatcher subscription per (de-duplicated) type sharing the same
// data/context matcher; `event_data` and `context` filters are AND-gated.
//
// https://www.home-assistant.io/docs/automation/trigger/#event-trigger
export class EventTrigger implements TriggerEvaluator {
  private _trigger: TriggerOfType<'event'>;

  private _eventWatcher: EventWatcherSubscriptionInterface;
  private _unsubscribeCallback: (() => void) | null = null;

  constructor(trigger: TriggerOfType<'event'>, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._eventWatcher = context.hassManager.getEventWatcher();
  }

  public subscribe(callback: TriggerCallback): void {
    const dataFilter = this._trigger.event_data;
    const contextFilter = this._trigger.context;

    const requests = uniq(arrayify(this._trigger.event_type)).map(
      (eventType): EventSubscriptionRequest => ({
        event_type: eventType,
        ...((dataFilter || contextFilter) && {
          matcher: (evt) =>
            (!dataFilter || matchesEventData(dataFilter, evt.data)) &&
            (!contextFilter || matchesEventContext(contextFilter, evt.context)),
        }),
        callback: (event) => callback({ platform: 'event', event }),
      }),
    );

    requests.forEach((request) => this._eventWatcher.subscribe(request));
    this._unsubscribeCallback = () =>
      requests.forEach((request) => this._eventWatcher.unsubscribe(request));
  }

  public destroy(): void {
    this._unsubscribeCallback?.();
    this._unsubscribeCallback = null;
  }
}
