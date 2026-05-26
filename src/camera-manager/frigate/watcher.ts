import { z } from 'zod';
import { HomeAssistant } from '../../ha/types';
import { KeyedSubscriptionManager } from '../../utils/keyed-subscription-manager';
import {
  FrigateEventChange,
  FrigateReviewChange,
  frigateEventChangeSchema,
  frigateReviewChangeSchema,
} from './types';

// Generic request interface for Frigate watchers
export interface FrigateWatcherRequest<T> {
  instanceID: string;
  matcher?(item: T): boolean;
  callback(item: T): void;
}

// Generic subscription interface
export interface FrigateWatcherSubscriptionInterface<T> {
  subscribe(hass: HomeAssistant, request: FrigateWatcherRequest<T>): Promise<void>;
  unsubscribe(request: FrigateWatcherRequest<T>): Promise<void>;
}

/**
 * Base class for Frigate WebSocket watchers. Counted per `instanceID`: the
 * first subscriber for an instance opens the WS subscription, the last to
 * unsubscribe tears it down. Each message is parsed, schema-validated, and
 * fanned out to every registered request whose `instanceID` matches and whose
 * `matcher` accepts the payload.
 */
abstract class FrigateWatcher<T> implements FrigateWatcherSubscriptionInterface<T> {
  protected abstract _type: string;
  protected abstract _schema: z.ZodType<T>;

  private _subscriptions = new KeyedSubscriptionManager<
    string,
    FrigateWatcherRequest<T>
  >((request) => request.instanceID);

  public async subscribe(
    hass: HomeAssistant,
    request: FrigateWatcherRequest<T>,
  ): Promise<void> {
    await this._subscriptions.subscribe(request, () =>
      hass.connection.subscribeMessage<string>(
        (data) => this._receiveHandler(request.instanceID, data),
        { type: this._type, instance_id: request.instanceID },
      ),
    );
  }

  public async unsubscribe(request: FrigateWatcherRequest<T>): Promise<void> {
    await this._subscriptions.unsubscribe(request);
  }

  protected _receiveHandler(instanceID: string, data: string): void {
    let json: unknown;
    try {
      json = JSON.parse(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      console.warn(`Received non-JSON payload from subscription: ${this._type}`, data);
      return;
    }

    const parseResult = this._schema.safeParse(json);
    if (!parseResult.success) {
      console.warn(`Received malformed message from subscription: ${this._type}`, data);
      return;
    }

    for (const request of this._subscriptions.getRequestsForKey(instanceID)) {
      if (!request.matcher || request.matcher(parseResult.data)) {
        request.callback(parseResult.data);
      }
    }
  }
}

/**
 * Watcher for Frigate event updates via WebSocket.
 */
export class FrigateEventWatcher extends FrigateWatcher<FrigateEventChange> {
  protected _type = 'frigate/events/subscribe';
  protected _schema = frigateEventChangeSchema;
}

/**
 * Watcher for Frigate review updates via WebSocket.
 */
export class FrigateReviewWatcher extends FrigateWatcher<FrigateReviewChange> {
  protected _type = 'frigate/reviews/subscribe';
  protected _schema = frigateReviewChangeSchema;
}
