import { HASSSource } from '../../ha/source';
import { EventWatcherSubscriptionInterface } from './event-watcher';
import { StateWatcherSubscriptionInterface } from './state-watcher';

export interface HASSManagerReadonlyInterface extends HASSSource {
  getStateWatcher(): StateWatcherSubscriptionInterface;
  getEventWatcher(): EventWatcherSubscriptionInterface;
}
