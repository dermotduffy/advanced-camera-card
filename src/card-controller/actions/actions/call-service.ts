import type { CallServiceActionConfig } from '../../../config/schema/actions/stock/call-service';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class CallServiceAction extends AdvancedCameraCardAction<CallServiceActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const hass = api.getHASSManager().getHASS();
    if (!hass) {
      return;
    }

    const action = this._getAction();
    const [domain, service] = action.service.split('.', 2);
    await hass.callService(domain, service, action.data, action.target);
  }
}
