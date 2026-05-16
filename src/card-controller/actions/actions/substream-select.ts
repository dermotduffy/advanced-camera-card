import { SubstreamViewModifier } from '../../../components-lib/live/substream';
import { SubstreamSelectActionConfig } from '../../../config/schema/actions/custom/substream-select';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class SubstreamSelectAction extends AdvancedCameraCardAction<SubstreamSelectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamViewModifier(this._action.camera)],
    });
  }
}
