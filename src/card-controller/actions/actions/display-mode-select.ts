import { DisplayModeActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class DisplayModeSelectAction extends AdvancedCameraCardAction<DisplayModeActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await api.getViewManager().setViewByParametersWithNewQuery({
      params: {
        displayMode: this._action.display_mode,
      },
    });
  }
}
