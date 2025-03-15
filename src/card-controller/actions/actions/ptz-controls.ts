import { PTZControlsActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class PTZControlsAction extends AdvancedCameraCardAction<PTZControlsActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    api.getViewManager().setViewWithMergedContext({
      ptzControls: { enabled: this._action.enabled },
    });
  }
}
