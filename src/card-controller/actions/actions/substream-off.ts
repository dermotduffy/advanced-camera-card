import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { SubstreamOffViewModifier } from '../../view/modifiers/substream-off';
import { AdvancedCameraCardAction } from './base';

export class SubstreamOffAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamOffViewModifier()],
    });
  }
}
