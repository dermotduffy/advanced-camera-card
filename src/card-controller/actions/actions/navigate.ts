import type { ReadonlyDeep } from 'type-fest';

import type { NavigateActionConfig } from '../../../config/schema/actions/stock/navigate';
import { fireHASSEvent } from '../../../ha/fire-hass-event';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class NavigateAction extends AdvancedCameraCardAction<
  ReadonlyDeep<NavigateActionConfig>
> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const action = this._getAction();
    if (!!action.navigation_replace) {
      history.replaceState(null, '', action.navigation_path);
    } else {
      history.pushState(null, '', action.navigation_path);
    }
    fireHASSEvent(window, 'location-changed', {
      replace: !!action.navigation_replace,
    });
  }
}
