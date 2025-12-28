import { z } from 'zod';
import { HomeAssistant } from '../../ha/types';
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
  unsubscribe(request: FrigateWatcherRequest<T>): void;
}

type SubscriptionUnsubscribe = () => Promise<void>;

/**
 * Base class for Frigate WebSocket watchers.
 * Handles subscription management and message routing to callbacks.
 */
abstract class FrigateWatcher<T> implements FrigateWatcherSubscriptionInterface<T> {
  protected abstract _type: string;
  protected abstract _schema: z.ZodType<T>;

  protected _requests: FrigateWatcherRequest<T>[] = [];
  protected _unsubscribeCallback: Record<string, SubscriptionUnsubscribe> = {};

  public async subscribe(
    hass: HomeAssistant,
    request: FrigateWatcherRequest<T>,
  ): Promise<void> {
    const shouldSubscribe = !this._hasSubscribers(request.instanceID);
    this._requests.push(request);
    if (shouldSubscribe) {
      this._unsubscribeCallback[request.instanceID] =
        await hass.connection.subscribeMessage<string>(
          (data) => this._receiveHandler(request.instanceID, data),
          { type: this._type, instance_id: request.instanceID },
        );
    }
  }

  public async unsubscribe(request: FrigateWatcherRequest<T>): Promise<void> {
    this._requests = this._requests.filter(
      (existingRequest) => existingRequest !== request,
    );

    if (!this._hasSubscribers(request.instanceID)) {
      await this._unsubscribeCallback[request.instanceID]();
      delete this._unsubscribeCallback[request.instanceID];
    }
  }

  protected _hasSubscribers(instanceID: string): boolean {
    return !!this._requests.filter((request) => request.instanceID === instanceID)
      .length;
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

    for (const request of this._requests) {
      if (
        request.instanceID === instanceID &&
        (!request.matcher || request.matcher(parseResult.data))
      ) {
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
