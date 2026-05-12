import type { ActionConfig } from '../../config/schema/actions/types';
import type { LockManager } from './manager';

export interface LockPolicy {
  isActive(): boolean;
  shouldBlockAction(action: ActionConfig): boolean;
}

export interface LockManagerEpoch {
  manager: LockManager;
  locked: boolean;
}
