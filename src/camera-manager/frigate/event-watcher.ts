import { HomeAssistant } from '../../ha/types';
import { FrigateEventChange, frigateEventChangeSchema } from './types';

export interface FrigateEventWatcherRequest {
  instanceID: string;
  matcher?(event: FrigateEventChange): boolean;
  callback(event: FrigateEventChange): void;
}

export interface FrigateEventWatcherSubscriptionInterface {
  subscribe(hass: HomeAssistant, request: FrigateEventWatcherRequest): Promise<void>;
  unsubscribe(callback: FrigateEventWatcherRequest): void;
}

type SubscriptionUnsubscribe = () => Promise<void>;

export class FrigateEventWatcher implements FrigateEventWatcherSubscriptionInterface {
  protected _requests: FrigateEventWatcherRequest[] = [];
  protected _unsubscribeCallback: Record<string, SubscriptionUnsubscribe> = {};

  public async subscribe(
    hass: HomeAssistant,
    request: FrigateEventWatcherRequest,
  ): Promise<void> {
    const shouldSubscribe = !this._hasSubscribers(request.instanceID);
    this._requests.push(request);
    if (shouldSubscribe) {
      this._unsubscribeCallback[request.instanceID] =
        await hass.connection.subscribeMessage<string>(
          (data) => this._receiveHandler(request.instanceID, data),
          { type: 'frigate/events/subscribe', instance_id: request.instanceID },
        );
    }
  }

  public async unsubscribe(request: FrigateEventWatcherRequest): Promise<void> {
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
    } catch (e) {
      console.warn('Received non-JSON payload as Frigate event', data);
      return;
    }

    const parsedEvent = frigateEventChangeSchema.safeParse(json);
    if (!parsedEvent.success) {
      console.warn('Received malformed Frigate event from Home Assistant', data);
      return;
    }

    for (const request of this._requests) {
      if (
        request.instanceID === instanceID &&
        (!request.matcher || request.matcher(parsedEvent.data))
      ) {
        request.callback(parsedEvent.data);
      }
    }
  }
}
