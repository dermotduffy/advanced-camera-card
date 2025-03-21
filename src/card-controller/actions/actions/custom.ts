import { CustomActionConfig } from '../../../config/schema/actions/stock/custom';
import { fireHASSEvent } from '../../../ha/fire-hass-event';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CustomAction extends AdvancedCameraCardAction<CustomActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    fireHASSEvent(api.getCardElementManager().getElement(), 'll-custom', this._action);
  }
}
