import { getConfigValue } from '../../../config/management';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class ConfigConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'config'>;

  constructor(condition: ConditionOfType<'config'>) {
    this._condition = condition;
  }

  public evaluate(
    newState?: ConditionState,
    oldState?: ConditionState,
  ): ConditionsEvaluationResult {
    const newConfig = newState?.config;
    const oldConfig = oldState?.config;
    const changed = newConfig !== oldConfig;

    return {
      result:
        !!newConfig &&
        changed &&
        (!this._condition.paths?.length ||
          this._condition.paths.some(
            (key) =>
              getConfigValue(newConfig, key) !==
              (oldConfig ? getConfigValue(oldConfig, key) : undefined),
          )),
      changed,
    };
  }
}
