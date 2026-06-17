import { ConditionEvaluator } from '../../conditions/conditions/types';
import { createConditionEvaluatorForTrigger } from '../../conditions/factory';
import { buildCardTriggerData } from '../build-trigger-data';
import { TriggerCallback, TriggerEvaluator, TriggerOfType } from './types';

// `screen` watches a matchMedia query, whose state lives outside the card's
// `ConditionState`, so it owns its subscription (via the screen condition
// evaluator) rather than watching the state manager. It fires on the rising
// edge of the query match -- consistent with "value present => fire on change
// to that value".
export class ScreenTrigger implements TriggerEvaluator {
  private _trigger: TriggerOfType<'screen'>;

  private _callback: TriggerCallback | null = null;
  private _condition: ConditionEvaluator | null = null;
  private _matched = false;

  constructor(trigger: TriggerOfType<'screen'>) {
    this._trigger = trigger;
  }

  public subscribe(callback: TriggerCallback): void {
    this._callback = callback;
    this._condition = createConditionEvaluatorForTrigger(this._trigger);
    this._matched = !!this._condition?.evaluate().result;
    this._condition?.subscribe?.(this._handler);
  }

  public destroy(): void {
    this._condition?.destroy?.();
    this._condition = null;
    this._callback = null;
  }

  private _handler = (): void => {
    const matched = !!this._condition?.evaluate().result;
    if (matched && !this._matched) {
      this._callback?.(buildCardTriggerData(this._trigger.trigger));
    }
    this._matched = matched;
  };
}
