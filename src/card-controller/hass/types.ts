import type { HASSSource } from '../../ha/source';
import type { EventWatcherSubscriptionInterface } from './event-watcher';
import type { StateWatcherSubscriptionInterface } from './state-watcher';

export interface HASSManagerReadonlyInterface extends HASSSource {
  getStateWatcher(): StateWatcherSubscriptionInterface;
  getEventWatcher(): EventWatcherSubscriptionInterface;
}
