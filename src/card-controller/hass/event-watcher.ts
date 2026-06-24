import type { HassEvent } from 'home-assistant-js-websocket';

import {
  SubscriptionHealthMonitor,
  type SubscriptionHealthInterface,
} from '../../ha/connection/subscription-health-monitor';
import { HASSConnectionSubscriptionManager } from '../../ha/connection/subscription-manager';
import type { HASSSource } from '../../ha/source';

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
  getHealth(): SubscriptionHealthInterface<string>;
}

/**
 * Subscribes to HA bus events via the WebSocket connection. Thin wrapper over
 * `HASSConnectionSubscriptionManager` (connection-era lifecycle, refcounting,
 * retry budgets, stale-callback guards): keys by `event_type`, runs each
 * request's optional matcher before fan-out.
 */
export class EventWatcher implements EventWatcherSubscriptionInterface {
  private _manager: HASSConnectionSubscriptionManager<string, EventSubscriptionRequest>;
  private _health: SubscriptionHealthMonitor<string, EventSubscriptionRequest>;

  constructor(source: HASSSource) {
    this._manager = new HASSConnectionSubscriptionManager(
      (request) => request.event_type,
      source,
    );
    this._health = new SubscriptionHealthMonitor((request) =>
      this._manager.retry(request),
    );
  }

  public subscribe(request: EventSubscriptionRequest): void {
    this._manager.subscribe(
      request,
      (connection, liveness) =>
        connection.subscribeEvents<HassEvent>((event) => {
          if (!liveness.isConnected()) {
            return;
          }
          this._dispatch(event);
        }, request.event_type),
      (status) => this._health.update(status),
    );
  }

  public unsubscribe(request: EventSubscriptionRequest): void {
    this._manager.unsubscribe(request);
  }

  public getHealth(): SubscriptionHealthInterface<string> {
    return this._health;
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
