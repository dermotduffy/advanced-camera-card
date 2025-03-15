import { ViewActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ViewAction extends AdvancedCameraCardAction<ViewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await api.getViewManager().setViewByParametersWithNewQuery({
      params: {
        view: this._action.advanced_camera_card_action,
      },
    });
  }
}
