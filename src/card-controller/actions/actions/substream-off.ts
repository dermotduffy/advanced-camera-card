import { SubstreamOffViewModifier } from '../../../components-lib/live/substream';
import { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class SubstreamOffAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamOffViewModifier()],
    });
  }
}
