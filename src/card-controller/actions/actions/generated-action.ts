import type { ActionContext } from 'action';
import type { ReadonlyDeep } from 'type-fest';

import type { TriggerData } from '../../../condition-trigger/triggers/types';
import type { GeneratedActionConfig } from '../../../config/schema/actions/custom/generated-action';
import type { AuxillaryActionConfig } from '../../../config/schema/actions/types';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class GeneratedAction extends AdvancedCameraCardAction<
  ReadonlyDeep<GeneratedActionConfig>
> {
  private _triggerData?: TriggerData;

  constructor(
    context: ActionContext,
    action: ReadonlyDeep<GeneratedActionConfig>,
    config?: AuxillaryActionConfig,
    triggerData?: TriggerData,
  ) {
    super(context, action, config);

    this._triggerData = triggerData;
  }

  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    // A null return means generate nothing (e.g. the firing trigger supplied no
    // usable value).
    const generated = this._getAction().generator({
      api,
      triggerData: this._triggerData,
    });
    if (!generated) {
      return;
    }

    await api.getActionsManager().executeNestedActions({
      actions: generated,
      config: this._config,
      triggerData: this._triggerData,
    });
  }
}
