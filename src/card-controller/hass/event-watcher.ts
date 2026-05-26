import { HassEvent } from 'home-assistant-js-websocket';
import { HomeAssistant } from '../../ha/types';
import { KeyedSubscriptionManager } from '../../utils/keyed-subscription-manager';

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
  private _subscriptions = new KeyedSubscriptionManager<
    string,
    EventSubscriptionRequest
  >((request) => request.event_type);

  public async subscribe(
    hass: HomeAssistant,
    request: EventSubscriptionRequest,
  ): Promise<void> {
    await this._subscriptions.subscribe(request, () =>
      hass.connection.subscribeEvents<HassEvent>(
        (event) => this._receiveEvent(event),
        request.event_type,
      ),
    );
  }

  public async unsubscribe(request: EventSubscriptionRequest): Promise<void> {
    await this._subscriptions.unsubscribe(request);
  }

  private _receiveEvent(event: HassEvent): void {
    for (const request of this._subscriptions.getRequestsForKey(event.event_type)) {
      if (!request.matcher || request.matcher(event.data)) {
        request.callback(event.data);
      }
    }
  }
}
