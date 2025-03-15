import { CallServiceActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CallServiceAction extends AdvancedCameraCardAction<CallServiceActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const hass = api.getHASSManager().getHASS();
    if (!hass) {
      return;
    }

    const [domain, service] = this._action.service.split('.', 2);
    await hass.callService(domain, service, this._action.data, this._action.target);
  }
}
