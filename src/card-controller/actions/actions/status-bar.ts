import type { ReadonlyDeep } from 'type-fest';

import type { StatusBarActionConfig } from '../../../config/schema/actions/types';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class StatusBarAction extends AdvancedCameraCardAction<
  ReadonlyDeep<StatusBarActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();
    switch (action.status_bar_action) {
      case 'reset':
        api.getStatusBarItemManager().removeAllDynamicStatusBarItems();
        break;
      case 'add':
        action.items?.forEach((item) =>
          api.getStatusBarItemManager().addDynamicStatusBarItem(item),
        );
        break;
      case 'remove':
        action.items?.forEach((item) =>
          api.getStatusBarItemManager().removeDynamicStatusBarItem(item),
        );
        break;
    }
  }
}
