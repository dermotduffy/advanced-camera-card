import { SubstreamSelectActionConfig } from '../../../config/schema/actions/custom/substream-select';
import { CardActionsAPI } from '../../types';
import { SubstreamSelectViewModifier } from '../../view/modifiers/substream-select';
import { AdvancedCameraCardAction } from './base';

export class SubstreamSelectAction extends AdvancedCameraCardAction<SubstreamSelectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamSelectViewModifier(this._action.camera)],
    });
  }
}
