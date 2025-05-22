import { StatusBarActionConfig } from '../../../config/schema/actions/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class StatusBarAction extends AdvancedCameraCardAction<StatusBarActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    switch (this._action.status_bar_action) {
      case 'reset':
        api.getStatusBarItemManager().removeAllDynamicStatusBarItems();
        break;
      case 'add':
        this._action.items?.forEach((item) =>
          api.getStatusBarItemManager().addDynamicStatusBarItem(item),
        );
        break;
      case 'remove':
        this._action.items?.forEach((item) =>
          api.getStatusBarItemManager().removeDynamicStatusBarItem(item),
        );
        break;
    }
  }
}
