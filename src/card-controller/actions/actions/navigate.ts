import { NavigateActionConfig } from '../../../config/schema/actions/stock/navigate';
import { fireHASSEvent } from '../../../ha/fire-hass-event';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class NavigateAction extends AdvancedCameraCardAction<NavigateActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    if (!!this._action.navigation_replace) {
      history.replaceState(null, '', this._action.navigation_path);
    } else {
      history.pushState(null, '', this._action.navigation_path);
    }
    fireHASSEvent(window, 'location-changed', {
      replace: !!this._action.navigation_replace,
    });
  }
}
