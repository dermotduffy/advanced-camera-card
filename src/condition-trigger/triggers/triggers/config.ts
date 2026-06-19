import { getConfigValue } from '../../../config/management';
import { ConditionState } from '../../conditions/types';
import { ConditionStateTriggerBase } from './condition-state-base';
import { TriggerOfType } from './types';

// Triggers when the card configuration changes. With `paths`, only a change to
// one of those config paths triggers; without `paths`, any config change does.
// `config` is trigger-only (it has no matching condition), so the watched value
// is the whole of its behavior.
export class ConfigTrigger extends ConditionStateTriggerBase<TriggerOfType<'config'>> {
  protected _getValue(state: ConditionState): unknown {
    const config = state.config;
    if (!config) {
      return null;
    }
    // The watched value: detecting a change in these path values *is* the
    // `paths` filter. Without `paths`, the whole config is watched.
    const paths = this._trigger.paths;
    return paths?.length ? paths.map((path) => getConfigValue(config, path)) : config;
  }
}
