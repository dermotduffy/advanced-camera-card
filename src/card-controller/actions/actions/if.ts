import { ActionContext } from 'action';
import { ConditionEvaluator } from '../../../condition-trigger/conditions/conditions/types';
import { createConditionEvaluator } from '../../../condition-trigger/conditions/factory';
import { IfActionConfig } from '../../../config/schema/actions/stock/if';
import { AuxillaryActionConfig } from '../../../config/schema/actions/types';
import { TemplateRenderer } from '../../templates/index';
import { CardActionsAPI } from '../../types';
import { BaseAction } from './base';

export class IfAction extends BaseAction<IfActionConfig> {
  private _ifEvaluators: ConditionEvaluator[];

  constructor(
    context: ActionContext,
    action: IfActionConfig,
    config?: AuxillaryActionConfig,
  ) {
    super(context, action, config);

    const evaluatorContext = { templateRenderer: new TemplateRenderer() };
    this._ifEvaluators = action.if.map((condition) =>
      createConditionEvaluator(condition, evaluatorContext),
    );
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const conditionsHold = this._ifEvaluators.every(
      (evaluator) =>
        evaluator.evaluate(api.getConditionStateManager().getState()).result,
    );

    const branch = conditionsHold ? this._action.then : this._action.else;
    if (!branch?.length) {
      return;
    }

    await api.getActionsManager().executeActions(
      { actions: branch, config: this._config },
      // No need to render templates for nested actions, they were already
      // rendered as part of this action's config.
      false,
    );
  }
}
