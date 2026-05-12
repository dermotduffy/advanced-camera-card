import { ActionConfig, Actions } from '../../config/schema/actions/types';
import { arrayify } from '../../utils/basic';
import { CardLockAPI } from '../types';
import { MicrophoneLockPolicy } from './microphone-policy';
import type { LockManagerEpoch, LockPolicy } from './types';

export class LockManager {
  private _policies: LockPolicy[];
  private _epoch: LockManagerEpoch | null = null;

  constructor(api: CardLockAPI) {
    this._policies = [new MicrophoneLockPolicy(api)];
  }

  public isLocked(): boolean {
    return this._policies.some((policy) => policy.isActive());
  }

  public getEpoch(): LockManagerEpoch {
    const locked = this.isLocked();
    if (!this._epoch || this._epoch.locked !== locked) {
      this._epoch = { manager: this, locked };
    }
    return this._epoch;
  }

  public getAllowedActions(actions: ActionConfig | ActionConfig[]): ActionConfig[] {
    if (!this.isLocked()) {
      return arrayify(actions);
    }

    return arrayify(actions).filter((action) => {
      return !this._isActionBlocked(action);
    });
  }

  public areAllActionsBlocked(actions: Actions): boolean {
    if (!this.isLocked()) {
      return false;
    }

    const all = [
      ...arrayify(actions.tap_action),
      ...arrayify(actions.hold_action),
      ...arrayify(actions.double_tap_action),
      ...arrayify(actions.start_tap_action),
      ...arrayify(actions.end_tap_action),
    ];

    return (
      all.length > 0 &&
      all.every((action) => {
        return this._isActionBlocked(action);
      })
    );
  }

  private _isActionBlocked(action: ActionConfig): boolean {
    return this._policies.some((policy) => {
      return policy.isActive() && policy.shouldBlockAction(action);
    });
  }
}
