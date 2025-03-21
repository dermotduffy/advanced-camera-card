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

    const [domain, service] = this._action.perform_action.split('.', 2);
    await hass.callService(domain, service, this._action.data, this._action.target);
  }
}
