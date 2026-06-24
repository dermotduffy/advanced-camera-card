import type { SubstreamOffActionConfig } from '../../../config/schema/actions/custom/substream-off';
import type { CardActionsAPI } from '../../types';
import { SubstreamViewModifier } from '../../view/modifiers/substream';
import { AdvancedCameraCardAction } from './base';

export class SubstreamOffAction extends AdvancedCameraCardAction<SubstreamOffActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamViewModifier({ camera: this._getAction().camera })],
    });
  }
}
