import { TemplateRenderer } from '../../card-controller/templates';
import { Trigger } from '../../config/schema/condition-trigger/triggers/types';
import { ConditionStateManagerReadonlyInterface } from '../conditions/types';
import { createTriggerEvaluator } from './factory';
import { TriggerEvaluator, TriggerFireCallback } from './triggers/types';
import { TriggerData } from './types';

/**
 * Orchestrates an array of triggers (e.g. for one automation) and notifies
 * listeners whenever ANY of them fires (the top-level triggers list is an
 * implicit OR). This is the push-based sibling of `ConditionsManager`.
 */
export class TriggersManager {
  private _evaluators: TriggerEvaluator[];
  private _listeners: TriggerFireCallback[] = [];

  constructor(
    triggers: Trigger[],
    stateManager: ConditionStateManagerReadonlyInterface,
  ) {
    const context = { stateManager, templateRenderer: new TemplateRenderer() };
    this._evaluators = triggers.map((trigger) =>
      createTriggerEvaluator(trigger, context),
    );
    this._evaluators.forEach((evaluator) => evaluator.subscribe(this._fire));
  }

  public destroy(): void {
    this._evaluators.forEach((evaluator) => evaluator.destroy());
    this._evaluators = [];
    this._listeners = [];
  }

  public addListener(listener: TriggerFireCallback): void {
    if (!this._listeners.includes(listener)) {
      this._listeners.push(listener);
    }
  }

  public removeListener(listener: TriggerFireCallback): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  private _fire = (data: TriggerData): void => {
    this._listeners.forEach((listener) => listener(data));
  };
}
