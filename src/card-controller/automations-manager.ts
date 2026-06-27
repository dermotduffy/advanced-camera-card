import type { ConditionEvaluator } from '../condition-trigger/conditions/conditions/types.js';
import { createConditionEvaluator } from '../condition-trigger/conditions/factory.js';
import { TriggersManager } from '../condition-trigger/triggers/manager.js';
import type { TriggerData } from '../condition-trigger/triggers/types.js';
import type { Automation, AutomationActions } from '../config/schema/automations.js';
import { localize } from '../localize/localize.js';
import type { CardAutomationsAPI, TaggedAutomation } from './types.js';

const MAX_NESTED_AUTOMATION_EXECUTIONS = 10;

export class AutomationsManager {
  private _api: CardAutomationsAPI;

  private _automations = new Map<TaggedAutomation, TriggersManager>();

  // A counter to avoid infinite loops, increases every time actions are run,
  // decreases every time actions are complete.
  private _nestedAutomationExecutions = 0;

  constructor(api: CardAutomationsAPI) {
    this._api = api;
  }

  public deleteAutomations(tag?: unknown) {
    for (const [automation, triggers] of this._automations) {
      if (automation.tag === tag) {
        this._automations.delete(automation);
        triggers.destroy();
      }
    }
  }

  public addAutomations(automations: TaggedAutomation[]): void {
    const context = { templateRenderer: this._api.getTemplateManager() };
    for (const automation of automations) {
      const triggers = new TriggersManager(
        automation.triggers,
        this._api.getConditionStateManager(),
        this._api.getHASSManager(),
        this._api.getTemplateManager(),
      );

      // The ongoing `conditions:` block is pull-evaluated at trigger time, so
      // its evaluators are never subscribed and hold no resources to tear down.
      // They live in the trigger callback and are released when `triggers` is
      // destroyed.
      const conditions = (automation.conditions ?? []).map((condition) =>
        createConditionEvaluator(condition, context),
      );
      triggers.addListener((data) => this._execute(automation, conditions, data));
      this._automations.set(automation, triggers);

      // When the card is already initialized (e.g. a runtime automation
      // addition via configuration override), subscribe immediately. For
      // "static" automations the InitializationManager subscribes every
      // automation once initialization completes so that the trigger evaluators
      // baseline their initial pre-trigger value against a card whose template
      // renderer has loaded.
      if (this._api.getInitializationManager().isInitializedMandatory()) {
        triggers.subscribe();
      }
    }
  }

  /**
   * Subscribe every registered automation's triggers. Called by the
   * InitializationManager when initialization completes (idempotent, so
   * automations subscribed eagerly on a runtime config change are unaffected).
   */
  public subscribe(): void {
    for (const triggers of this._automations.values()) {
      triggers.subscribe();
    }
  }

  private _execute(
    automation: Automation,
    conditions: ConditionEvaluator[],
    triggerData: TriggerData,
  ): void {
    if (
      !this._api.getHASSManager().hasHASS() ||
      // Never execute automations if the card hasn't finished initializing, as
      // it could cause a view change when camera loads are not finished.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1407
      !this._api.getInitializationManager().isInitializedMandatory() ||
      // Never execute automations if there's an error (as our automation loop
      // avoidance -- which shows as an error -- would not work!).
      this._api.getIssueManager().getStateManager().hasFullCardIssue()
    ) {
      return;
    }

    // Evaluate the ongoing conditions against the current state at the instant
    // the automation is triggered. The state manager updates its stored state
    // before dispatching to listeners, so this already reflects the triggering
    // change.
    const state = this._api.getConditionStateManager().getState();
    const ongoingConditionsHold = conditions.every(
      (evaluator) => evaluator.evaluate(state).result,
    );

    if (!ongoingConditionsHold || !automation.actions.length) {
      return;
    }

    const runActions = async (actions: AutomationActions): Promise<void> => {
      // Check the limit *before* incrementing, so the overflow path holds no
      // increment to leak; the `finally` then guarantees the decrement even if
      // executing the actions throws. Either leak would permanently inflate the
      // counter and eventually block all automations.
      if (this._nestedAutomationExecutions >= MAX_NESTED_AUTOMATION_EXECUTIONS) {
        this._api.getNotificationManager().setNotification({
          heading: {
            text: localize('error.too_many_automations'),
            icon: 'mdi:alert',
            severity: 'high',
          },
        });
        return;
      }

      ++this._nestedAutomationExecutions;
      try {
        await this._api.getActionsManager().executeActions({ actions, triggerData });
      } finally {
        --this._nestedAutomationExecutions;
      }
    };
    void runActions(automation.actions);
  }
}
