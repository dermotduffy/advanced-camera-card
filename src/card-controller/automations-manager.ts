import { ConditionsManager } from '../conditions/conditions-manager.js';
import { ConditionsEvaluationResult } from '../conditions/types.js';
import { Automation, AutomationActions } from '../config/schema/automations.js';
import { localize } from '../localize/localize.js';
import { CardAutomationsAPI, TaggedAutomation } from './types.js';

const MAX_NESTED_AUTOMATION_EXECUTIONS = 10;

export class AutomationsManager {
  private _api: CardAutomationsAPI;

  private _automations = new Map<TaggedAutomation, ConditionsManager>();

  // A counter to avoid infinite loops, increases every time actions are run,
  // decreases every time actions are complete.
  private _nestedAutomationExecutions = 0;

  constructor(api: CardAutomationsAPI) {
    this._api = api;
  }

  public deleteAutomations(tag?: unknown) {
    for (const [automation, conditionManager] of this._automations) {
      if (automation.tag === tag) {
        this._automations.delete(automation);
        conditionManager.destroy();
      }
    }
  }

  public addAutomations(automations: TaggedAutomation[]): void {
    for (const automation of automations) {
      const conditionManager = new ConditionsManager(
        automation.conditions,
        this._api.getConditionStateManager(),
      );
      conditionManager.addListener((result: ConditionsEvaluationResult) =>
        this._execute(automation, result),
      );
      this._automations.set(automation, conditionManager);
    }
  }

  private _execute(automation: Automation, result: ConditionsEvaluationResult): void {
    if (
      !this._api.getHASSManager().hasHASS() ||
      // Never execute automations if the card hasn't finished initializing, as
      // it could cause a view change when camera loads are not finished.
      // See: https://github.com/dermotduffy/advanced-camera-card/issues/1407
      !this._api.getInitializationManager().isInitializedMandatory() ||
      // Never execute automations if there's an error (as our automation loop
      // avoidance -- which shows as an error -- would not work!).
      this._api.getProblemManager().getStateManager().hasFullCardProblem()
    ) {
      return;
    }

    const shouldExecute = result.result;
    const actions = shouldExecute ? automation.actions : automation.actions_not;

    if (!actions?.length) {
      return;
    }

    const runActions = async (actions: AutomationActions): Promise<void> => {
      ++this._nestedAutomationExecutions;

      if (this._nestedAutomationExecutions > MAX_NESTED_AUTOMATION_EXECUTIONS) {
        this._api.getNotificationManager().setNotification({
          heading: {
            text: localize('error.too_many_automations'),
            icon: 'mdi:alert',
            severity: 'high',
          },
        });
        return;
      }

      await this._api
        .getActionsManager()
        .executeActions({ actions, triggerData: result.triggerData });

      --this._nestedAutomationExecutions;
    };
    runActions(actions);
  }
}
