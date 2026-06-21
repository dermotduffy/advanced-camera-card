import { HassEvent } from 'home-assistant-js-websocket';
import { HASSConnectionSubscriptionManager } from '../../ha/connection/subscription-manager';
import { HASSSource } from '../../ha/source';

export interface EventSubscriptionRequest {
  event_type: string;
  callback: (event: HassEvent) => void;

  // Optional filter receiving the full event so callers can match on payload
  // (`event.data`) and/or context (`event.context`). Returning false drops the
  // event for this request.
  matcher?: (event: HassEvent) => boolean;
}

export interface EventWatcherSubscriptionInterface {
  subscribe(request: EventSubscriptionRequest): void;
  unsubscribe(request: EventSubscriptionRequest): void;
}

/**
 * Subscribes to HA bus events via the WebSocket connection. Thin wrapper over
 * `HASSConnectionSubscriptionManager`, which owns the connection-era
 * lifecycle, refcounting, retry budgets, and stale-callback guards. This
 * class only translates the event-specific shape (key by `event_type`, run
 * the request's optional matcher before fan-out).
 */
export class EventWatcher implements EventWatcherSubscriptionInterface {
  private _manager: HASSConnectionSubscriptionManager<string, EventSubscriptionRequest>;

  constructor(source: HASSSource) {
    this._manager = new HASSConnectionSubscriptionManager(
      (request) => request.event_type,
      source,
    );
  }

  public subscribe(request: EventSubscriptionRequest): void {
    this._manager.subscribe(request, (connection, liveness) =>
      connection.subscribeEvents<HassEvent>((event) => {
        if (!liveness.isConnected()) {
          return;
        }
        this._dispatch(event);
      }, request.event_type),
    );
  }

  public unsubscribe(request: EventSubscriptionRequest): void {
    this._manager.unsubscribe(request);
  }

  private _dispatch(event: HassEvent): void {
    for (const request of this._manager.getRequestsForKey(event.event_type)) {
      if (request.matcher && !request.matcher(event)) {
        continue;
      }
      request.callback(event);
    }
  }
}
