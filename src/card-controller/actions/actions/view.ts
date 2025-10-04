import { ViewActionConfig } from '../../../config/schema/actions/custom/view';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ViewAction extends AdvancedCameraCardAction<ViewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    await api.getViewManager().setViewByParametersWithNewQuery({
      params: {
        view: this._action.advanced_camera_card_action,
      },
      ...(this._action.folder && {
        queryExecutorOptions: {
          folder: this._action.folder,
        },
      }),
    });
  }
}
