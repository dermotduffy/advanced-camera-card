import type { ScreenBase } from '../../../config/schema/condition-trigger/common/screen';
import { MediaQueryWatcher } from '../../common/media-query-watcher';
import type { ConditionsEvaluationResult } from '../types';
import type { ConditionEvaluator, ExternalInvalidationSource } from './types';

export class ScreenConditionEvaluator implements ConditionEvaluator {
  private _watcher: MediaQueryWatcher | null;

  constructor(condition: ScreenBase) {
    this._watcher = condition.media_query
      ? new MediaQueryWatcher(condition.media_query)
      : null;
  }

  public evaluate(): ConditionsEvaluationResult {
    return { result: this._watcher?.matches() ?? false };
  }

  public get externalSources(): ExternalInvalidationSource[] {
    return this._watcher ? [this._watcher] : [];
  }
}
