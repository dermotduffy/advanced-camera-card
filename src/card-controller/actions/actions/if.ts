import type { ActionContext } from 'action';
import type { ReadonlyDeep } from 'type-fest';

import { createConditionEvaluator } from '../../../condition-trigger/conditions/factory';
import type { TriggerData } from '../../../condition-trigger/triggers/types';
import type {
  AuxillaryActionConfig,
  IfActionConfig,
} from '../../../config/schema/actions/types';
import type { CardActionsAPI } from '../../types';
import type { ActionPrepareCallback } from '../types';
import { BaseAction } from './base';

export class IfAction extends BaseAction<ReadonlyDeep<IfActionConfig>> {
  private _triggerData?: TriggerData;

  constructor(
    context: ActionContext,
    action: ReadonlyDeep<IfActionConfig>,
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
    const evaluatorContext = { templateRenderer: api.getTemplateManager() };
    const state = api.getConditionStateManager().getState();
    const conditionsHold = action.if.every(
      (condition) =>
        createConditionEvaluator(condition, evaluatorContext).evaluate(state).result,
    );

    const branch = conditionsHold ? action.then : action.else;
    if (!branch?.length) {
      return;
    }

    await api.getActionsManager().executeNestedActions({
      actions: branch,
      config: this._config,
      triggerData: this._triggerData,
    });
  }
}
