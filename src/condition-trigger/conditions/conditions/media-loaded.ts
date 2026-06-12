import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator, ConditionOfType } from './types';

export class MediaLoadedConditionEvaluator implements ConditionEvaluator {
  private _condition: ConditionOfType<'media_loaded'>;

  constructor(condition: ConditionOfType<'media_loaded'>) {
    this._condition = condition;
  }

  public evaluate(newState?: ConditionState): ConditionsEvaluationResult {
    return {
      result:
        newState?.mediaLoadedInfo !== undefined &&
        this._condition.media_loaded === !!newState.mediaLoadedInfo,
    };
  }
}
