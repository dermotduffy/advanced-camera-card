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

    return {
      result:
        !!newConfig &&
        newConfig !== oldConfig &&
        (!this._condition.paths?.length ||
          this._condition.paths.some(
            (key) =>
              getConfigValue(newConfig, key) !==
              (oldConfig ? getConfigValue(oldConfig, key) : undefined),
          )),
      ...(newConfig !== oldConfig && {
        triggerData: {
          config: {
            ...((oldState?.config || newState?.config) && {
              ...(oldState?.config && { from: oldState?.config }),
              ...(newState?.config && { to: newState?.config }),
            }),
          },
        },
      }),
    };
  }
}
