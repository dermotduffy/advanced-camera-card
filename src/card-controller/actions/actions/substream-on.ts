import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { SubstreamOnViewModifier } from '../../view/modifiers/substream-on';
import { AdvancedCameraCardAction } from './base';

export class SubstreamOnAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamOnViewModifier(api)],
    });
  }
}
