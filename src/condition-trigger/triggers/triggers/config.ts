import { isEqual } from 'lodash-es';
import { getConfigValue } from '../../../config/management';
import { ConditionState } from '../../conditions/types';
import { CardStateTriggerBase } from './card-state-base';
import { TriggerOfType } from './types';

// Triggers when the card configuration changes. With `paths`, only a change to
// one of those config paths triggers; without `paths`, any config change does.
export class ConfigTrigger extends CardStateTriggerBase<TriggerOfType<'config'>> {
  protected _shouldTrigger(oldState: ConditionState, newState: ConditionState): boolean {
    const newConfig = newState.config;
    const oldConfig = oldState.config;

    // Compare by value: config (and any subtree `getConfigValue` returns) is
    // rebuilt fresh on each change, so a reference check would over-trigger.
    if (!newConfig || isEqual(newConfig, oldConfig)) {
      return false;
    }
    const paths = this._trigger.paths;
    return (
      !paths?.length ||
      paths.some(
        (path) =>
          !isEqual(
            getConfigValue(newConfig, path),
            oldConfig ? getConfigValue(oldConfig, path) : undefined,
          ),
      )
    );
  }
}
