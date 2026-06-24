import type { DisplayModeActionConfig } from '../../../config/schema/actions/custom/display-mode';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class DisplayModeSelectAction extends AdvancedCameraCardAction<DisplayModeActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await api.getViewManager().setViewByParametersWithNewQuery({
      params: {
        displayMode: this._getAction().display_mode,
      },
    });
  }
}
