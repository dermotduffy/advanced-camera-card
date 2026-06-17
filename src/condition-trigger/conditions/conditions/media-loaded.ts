import { MediaLoadedBase } from '../../../config/schema/condition-trigger/common/media-loaded';
import { ConditionsEvaluationResult, ConditionState } from '../types';
import { ConditionEvaluator } from './types';

export class MediaLoadedConditionEvaluator implements ConditionEvaluator {
  private _condition: MediaLoadedBase;

  constructor(condition: MediaLoadedBase) {
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
