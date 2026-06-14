import { parseTimePeriodToSeconds } from '../../../ha/parse-time-period';
import { Timer } from '../../../utils/timer';
import { ConditionState, ConditionStateChange } from '../../conditions/types';
import {
  TriggerCallback,
  TriggerEvaluator,
  TriggerEvaluatorContext,
  TriggerOfType,
} from './types';

// https://www.home-assistant.io/docs/automation/trigger/#template-trigger
// Triggers when `value_template` renders true having previously been non-true
// (the rising edge); `for:` requires it to stay true for the duration first.
export class TemplateTrigger implements TriggerEvaluator {
  private _trigger: TriggerOfType<'template'>;
  private _context: TriggerEvaluatorContext;

  private _callback: TriggerCallback | null = null;
  private _forTimer = new Timer();

  private _lastResult = false;

  constructor(trigger: TriggerOfType<'template'>, context: TriggerEvaluatorContext) {
    this._trigger = trigger;
    this._context = context;
  }

  public subscribe(callback: TriggerCallback): void {
    this._callback = callback;

    // Establish the baseline without triggering: a template already true at
    // subscribe must not trigger (HA triggers only on a transition to true).
    this._lastResult = this._render(this._context.stateManager.getState());
    this._context.stateManager.addListener(this._handler);
  }

  public destroy(): void {
    this._context.stateManager.removeListener(this._handler);
    this._forTimer.stop();
    this._callback = null;
  }

  private _handler = (change: ConditionStateChange): void => {
    const result = this._render(change.new);
    const rising = result && !this._lastResult;
    this._lastResult = result;

    if (rising) {
      const forPeriod = this._trigger.for;
      if (!forPeriod) {
        this._callTrigger();
        return;
      }
      const seconds = parseTimePeriodToSeconds(forPeriod);
      if (seconds !== null) {
        this._forTimer.start(seconds, () => this._callTrigger());
      }
    } else if (!result) {
      // No longer holds -- cancel any pending `for:` trigger.
      this._forTimer.stop();
    }
  };

  private _render(state: ConditionState): boolean {
    return (
      !!state.hass &&
      this._context.templateRenderer.renderRecursively(
        state.hass,
        this._trigger.value_template,
        { conditionState: state },
      ) === true
    );
  }

  private _callTrigger(): void {
    this._callback?.({ platform: 'template' });
  }
}
