import { HASSManagerReadonlyInterface } from '../../card-controller/hass/types';
import { TemplateRenderer } from '../../card-controller/templates';
import { Trigger } from '../../config/schema/condition-trigger/triggers/types';
import { isEnabled } from '../common/is-enabled';
import { ConditionStateManagerReadonlyInterface } from '../conditions/types';
import { createTriggerEvaluator } from './factory';
import {
  TriggerCallback,
  TriggerEvaluator,
  TriggerEvaluatorContext,
} from './triggers/types';
import { TriggerData } from './types';

// A trigger evaluator paired with its config, so `enabled` can be re-checked
// against the config each time the evaluator triggers.
interface ManagedTrigger {
  config: Trigger;
  evaluator: TriggerEvaluator;
}

/**
 * Orchestrates an array of triggers (e.g. for one automation) and notifies
 * listeners whenever ANY of them triggers (the top-level triggers list is an
 * implicit OR). This is the push-based sibling of `ConditionsManager`.
 */
export class TriggersManager {
  private _context: TriggerEvaluatorContext;
  private _triggers: ManagedTrigger[];
  private _listeners: TriggerCallback[] = [];

  constructor(
    triggers: Trigger[],
    stateManager: ConditionStateManagerReadonlyInterface,
    hassManager: HASSManagerReadonlyInterface,
  ) {
    this._context = {
      stateManager,
      templateRenderer: new TemplateRenderer(),
      hassManager,
    };
    this._triggers = triggers.map((config) => ({
      config,
      evaluator: createTriggerEvaluator(config, this._context),
    }));

    // `enabled` is a live per-trigger gate (re-evaluated each time), UNLIKE
    // HA's once-at-attach: a deliberate deviation to allow dynamic triggering.
    this._triggers.forEach(({ config, evaluator }) =>
      evaluator.subscribe((data) => {
        if (
          isEnabled(
            this._context.templateRenderer,
            config.enabled,
            this._context.stateManager.getState(),
            // Fail closed: with no hass the `enabled` template cannot be
            // evaluated, so the trigger does not fire.
            false,
          )
        ) {
          this._callListeners(data);
        }
      }),
    );
  }

  public destroy(): void {
    this._triggers.forEach(({ evaluator }) => evaluator.destroy());
    this._triggers = [];
    this._listeners = [];
  }

  public addListener(listener: TriggerCallback): void {
    if (!this._listeners.includes(listener)) {
      this._listeners.push(listener);
    }
  }

  public removeListener(listener: TriggerCallback): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  private _callListeners = (data: TriggerData): void => {
    this._listeners.forEach((listener) => listener(data));
  };
}
