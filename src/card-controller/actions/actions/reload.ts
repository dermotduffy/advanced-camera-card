import { GeneralActionConfig } from '../../../config/schema/actions/custom/general';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ReloadAction extends AdvancedCameraCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    window.location.reload();
  }
}
