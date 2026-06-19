import { PerformActionActionConfig } from '../../../config/schema/actions/stock/perform-action';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class PerformActionAction extends AdvancedCameraCardAction<PerformActionActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const hass = api.getHASSManager().getHASS();
    if (!hass) {
      return;
    }

    const action = this._getAction();
    const [domain, service] = action.perform_action.split('.', 2);
    await hass.callService(domain, service, action.data, action.target);
  }
}
