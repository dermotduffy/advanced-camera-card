import type { MoreInfoActionConfig } from '../../../config/schema/actions/stock/more-info';
import { fireHASSEvent } from '../../../ha/fire-hass-event';
import type { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class MoreInfoAction extends AdvancedCameraCardAction<MoreInfoActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const entityID = this._getAction().entity ?? this._config?.entity ?? null;
    if (!entityID) {
      return;
    }

    fireHASSEvent(api.getCardElementManager().getElement(), 'hass-more-info', {
      entityId: entityID,
    });
  }
}
