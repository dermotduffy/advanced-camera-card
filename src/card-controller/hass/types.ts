import type { HASSSource } from '../../ha/source';
import type { EventWatcherSubscriptionInterface } from './event-watcher';
import type { StateWatcherSubscriptionInterface } from './state-watcher';

// The card's view of HA's readiness:
//   - 'disconnected' : WebSocket is down
//   - 'starting'     : connected, but HA has not finished loading integrations
//   - 'ready'        : connected and fully running
export type HASSReadiness = 'disconnected' | 'starting' | 'ready';

export interface HASSManagerReadonlyInterface extends HASSSource {
  getStateWatcher(): StateWatcherSubscriptionInterface;
  getEventWatcher(): EventWatcherSubscriptionInterface;
}
