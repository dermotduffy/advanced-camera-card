import { ActionContext } from 'action';
import { createConditionEvaluator } from '../../../condition-trigger/conditions/factory';
import { TriggerData } from '../../../condition-trigger/triggers/types';
import {
  AuxillaryActionConfig,
  IfActionConfig,
} from '../../../config/schema/actions/types';
import { TemplateRenderer } from '../../templates/index';
import { CardActionsAPI } from '../../types';
import { ActionPrepareCallback } from '../types';
import { BaseAction } from './base';

export class IfAction extends BaseAction<IfActionConfig> {
  private _triggerData?: TriggerData;

  constructor(
    context: ActionContext,
    action: IfActionConfig,
    config?: AuxillaryActionConfig,
    triggerData?: TriggerData,
  ) {
    super(context, action, config);

    this._triggerData = triggerData;
  }

  public prepare(actionPrepareCallback: ActionPrepareCallback): void {
    // Render this action's own fields (including the `if` conditions, so their
    // `trigger.*` templates resolve), but leave `then`/`else` raw: they are
    // nested action sequences that render per-step when their own branch runs.
    const { then: thenBranch, else: elseBranch, ...rest } = this._rawAction;
    this._preparedAction = {
      ...actionPrepareCallback(rest),
      then: thenBranch,
      ...(elseBranch !== undefined && { else: elseBranch }),
    };
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();
    const evaluatorContext = { templateRenderer: new TemplateRenderer() };
    const state = api.getConditionStateManager().getState();
    const conditionsHold = action.if.every(
      (condition) =>
        createConditionEvaluator(condition, evaluatorContext).evaluate(state).result,
    );

    const branch = conditionsHold ? action.then : action.else;
    if (!branch?.length) {
      return;
    }

    // The branch renders per-step as it runs, so each action observes state an
    // earlier branch action changed. The trigger data is forwarded so the
    // branch can still resolve `trigger.*` templates.
    await api.getActionsManager().executeActions({
      actions: branch,
      config: this._config,
      triggerData: this._triggerData,
    });
  }
}
