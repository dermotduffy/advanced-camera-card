import type { ReadonlyDeep } from 'type-fest';

import type { MediaLoadedBase } from '../../../config/schema/condition-trigger/common/media-loaded';
import type { ConditionsEvaluationResult, ConditionState } from '../types';
import type { ConditionEvaluator } from './types';

export class MediaLoadedConditionEvaluator implements ConditionEvaluator {
  private _condition: ReadonlyDeep<MediaLoadedBase>;

  constructor(condition: ReadonlyDeep<MediaLoadedBase>) {
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
