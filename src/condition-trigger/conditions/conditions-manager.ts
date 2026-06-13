import { TemplateRenderer } from '../../card-controller/templates';
import { Condition } from '../../config/schema/condition-trigger/conditions/types';
import { isEnabled } from '../common/is-enabled';
import { ConditionEvaluator } from './conditions/types';
import { createConditionEvaluator } from './factory';
import {
  ConditionsEvaluationResult,
  ConditionsListener,
  ConditionsManagerReadonlyInterface,
  ConditionStateChange,
  ConditionStateManagerReadonlyInterface,
  ConditionsTriggerData,
} from './types';

// A condition evaluator paired with its config, so `enabled` can be re-checked
// against the config each time conditions are evaluated.
interface ManagedCondition {
  config: Condition;
  evaluator: ConditionEvaluator;
}

/**
 * A class to evaluate an array of conditions, and notify listeners when the
 * evaluation changes (a change is either the result changing, or the data
 * associated with a result).
 */
export class ConditionsManager implements ConditionsManagerReadonlyInterface {
  private _stateManager: ConditionStateManagerReadonlyInterface | null;
  private _templateRenderer = new TemplateRenderer();
  private _conditions: ManagedCondition[];

  private _listeners: ConditionsListener[] = [];
  private _evaluation: ConditionsEvaluationResult = { result: false };

  constructor(
    conditions: Condition[],
    stateManager?: ConditionStateManagerReadonlyInterface | null,
  ) {
    const context = { templateRenderer: this._templateRenderer };
    this._conditions = conditions.map((config) => ({
      config,
      evaluator: createConditionEvaluator(config, context),
    }));

    this._stateManager = stateManager ?? null;

    // Subscribe evaluators that have external change sources (currently
    // `screen`), including nested evaluators inside composites.
    this._conditions.forEach(({ evaluator }) =>
      evaluator.subscribe?.(() => this._evaluate()),
    );

    // Do an initial condition evaluation, but without calling listeners.
    this._evaluate({ callListeners: false });

    this._stateManager?.addListener(this._stateManagerHandler);
  }

  public destroy(): void {
    this._stateManager?.removeListener(this._stateManagerHandler);

    this._listeners.forEach((l) => this.removeListener(l));

    this._conditions.forEach(({ evaluator }) => evaluator.destroy?.());
    this._conditions = [];
  }

  public addListener(listener: ConditionsListener): void {
    if (!this._listeners.includes(listener)) {
      this._listeners.push(listener);
    }
  }

  public removeListener(listener: ConditionsListener): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  public getEvaluation(): ConditionsEvaluationResult {
    return this._evaluation;
  }

  private _stateManagerHandler = (stateChange: ConditionStateChange): void => {
    this._evaluate({ stateChange });
  };

  private _evaluate(options?: {
    stateChange?: ConditionStateChange;
    callListeners?: boolean;
  }): void {
    const state = options?.stateChange?.new ?? this._stateManager?.getState();

    let result = true;
    let triggerData: ConditionsTriggerData = {};

    for (const { config, evaluator } of this._conditions) {
      if (!isEnabled(this._templateRenderer, config.enabled, state)) {
        continue;
      }
      const evaluation = evaluator.evaluate(state, options?.stateChange?.old);
      if (!evaluation.result) {
        result = false;
        break;
      }
      triggerData = {
        ...triggerData,
        ...evaluation.triggerData,
      };
    }

    const evaluation: ConditionsEvaluationResult = result
      ? { result, triggerData }
      : { result };

    if (
      evaluation.result !== this._evaluation.result ||
      (evaluation.triggerData && Object.keys(evaluation.triggerData).length)
    ) {
      this._evaluation = evaluation;
      if (options?.callListeners ?? true) {
        this._listeners.forEach(
          (listener) =>
            this._evaluation && listener(this._evaluation, options?.stateChange),
        );
      }
    }
  }
}
