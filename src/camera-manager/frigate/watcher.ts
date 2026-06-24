import { z } from 'zod';

import { HASSConnectionSubscriptionManager } from '../../ha/connection/subscription-manager';
import { HASSSource } from '../../ha/source';
import {
  FrigateEventChange,
  frigateEventChangeSchema,
  FrigateReviewChange,
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
  subscribe(request: FrigateWatcherRequest<T>): void;
  unsubscribe(request: FrigateWatcherRequest<T>): void;
}

/**
 * Base class for Frigate WebSocket watchers. Thin wrapper over
 * `HASSConnectionSubscriptionManager`: keys by `instanceID`, parses and
 * schema-validates each message, then fans out to every registered request
 * whose `instanceID` matches and whose optional `matcher` accepts the payload.
 */
abstract class FrigateWatcher<T> implements FrigateWatcherSubscriptionInterface<T> {
  protected abstract _type: string;
  protected abstract _schema: z.ZodType<T>;

  private _manager: HASSConnectionSubscriptionManager<string, FrigateWatcherRequest<T>>;

  constructor(source: HASSSource) {
    this._manager = new HASSConnectionSubscriptionManager(
      (request) => request.instanceID,
      source,
    );
  }

  public subscribe(request: FrigateWatcherRequest<T>): void {
    this._manager.subscribe(request, (connection, liveness) =>
      connection.subscribeMessage<string>(
        (data) => {
          if (!liveness.isConnected()) {
            return;
          }
          this._receive(request.instanceID, data);
        },
        { type: this._type, instance_id: request.instanceID },
      ),
    );
  }

  public unsubscribe(request: FrigateWatcherRequest<T>): void {
    this._manager.unsubscribe(request);
  }

  private _receive(instanceID: string, data: string): void {
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

    for (const request of this._manager.getRequestsForKey(instanceID)) {
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
