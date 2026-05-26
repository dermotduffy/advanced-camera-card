import { HassEvent } from 'home-assistant-js-websocket';
import { HomeAssistant, SubscriptionUnsubscribe } from '../../ha/types';

export interface EventSubscriptionRequest {
  event_type: string;
  callback: (data: unknown) => void;

  // Optional payload filter. Receives the event's `data`; if it returns false
  // the event is dropped for this request.
  matcher?: (data: unknown) => boolean;
}

export interface EventWatcherSubscriptionInterface {
  subscribe(hass: HomeAssistant, request: EventSubscriptionRequest): Promise<void>;
  unsubscribe(request: EventSubscriptionRequest): Promise<void>;
}

/**
 * Subscribes to HA bus events via the WebSocket connection. Refcounted per
 * `event_type`: the first subscriber for a type opens the WS subscription, the
 * last to unsubscribe tears it down. Each fired event is fanned out to every
 * registered request whose `event_type` matches and whose `matcher` accepts the
 * payload.
 */
export class EventWatcher implements EventWatcherSubscriptionInterface {
  private _requests: EventSubscriptionRequest[] = [];

  // Stored as a promise so an unsubscribe that races against an in-flight
  // subscribe can await completion before tearing down -- otherwise the unsub
  // func is unavailable and the subscription would leak (via hass.connection's
  // internal subscription map).
  private _unsubscribers = new Map<string, Promise<SubscriptionUnsubscribe>>();

  public async subscribe(
    hass: HomeAssistant,
    request: EventSubscriptionRequest,
  ): Promise<void> {
    const isFirst = !this._hasSubscribers(request.event_type);
    this._requests.push(request);
    if (isFirst) {
      const pendingSubscription = hass.connection.subscribeEvents<HassEvent>(
        (event) => this._receiveEvent(event),
        request.event_type,
      );
      this._unsubscribers.set(request.event_type, pendingSubscription);
      await pendingSubscription;
    }
  }

  public async unsubscribe(request: EventSubscriptionRequest): Promise<void> {
    this._requests = this._requests.filter((r) => r !== request);
    if (!this._hasSubscribers(request.event_type)) {
      const pendingSubscription = this._unsubscribers.get(request.event_type);
      this._unsubscribers.delete(request.event_type);
      const unsubscribeCallback = await pendingSubscription;
      await unsubscribeCallback?.();
    }
  }

  private _hasSubscribers(eventType: string): boolean {
    return this._requests.some((r) => r.event_type === eventType);
  }

  private _receiveEvent(event: HassEvent): void {
    for (const request of this._requests) {
      if (
        request.event_type === event.event_type &&
        (!request.matcher || request.matcher(event.data))
      ) {
        request.callback(event.data);
      }
    }
  }
}
