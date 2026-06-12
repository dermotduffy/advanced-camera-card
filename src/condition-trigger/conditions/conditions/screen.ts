import { ConditionsEvaluationResult } from '../types';
import {
  ConditionEvaluator,
  ConditionEvaluatorSubscriptionCallback,
  ConditionOfType,
} from './types';

export class ScreenConditionEvaluator implements ConditionEvaluator {
  private _mediaQuery: MediaQueryList | null = null;
  private _onChange: ConditionEvaluatorSubscriptionCallback | null = null;

  private _condition: ConditionOfType<'screen'>;

  constructor(condition: ConditionOfType<'screen'>) {
    this._condition = condition;
  }

  public evaluate(): ConditionsEvaluationResult {
    return {
      result: this._condition.media_query
        ? window.matchMedia(this._condition.media_query).matches
        : false,
    };
  }

  public subscribe(onChange: ConditionEvaluatorSubscriptionCallback): void {
    if (!this._condition.media_query) {
      return;
    }
    this._onChange = onChange;
    this._mediaQuery = window.matchMedia(this._condition.media_query);
    this._mediaQuery.addEventListener('change', this._handler);
  }

  public destroy(): void {
    this._mediaQuery?.removeEventListener('change', this._handler);
    this._mediaQuery = null;
  }

  private _handler = (): void => this._onChange?.();
}
