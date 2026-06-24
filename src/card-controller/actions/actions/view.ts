import type { ViewActionConfig } from '../../../config/schema/actions/custom/view';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ViewAction extends AdvancedCameraCardAction<ViewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();
    await api.getViewManager().setViewByParametersWithNewQuery({
      params: {
        view: action.advanced_camera_card_action,
      },
      ...(action.folder && {
        queryExecutorOptions: {
          folder: action.folder,
        },
      }),
    });
  }
}
