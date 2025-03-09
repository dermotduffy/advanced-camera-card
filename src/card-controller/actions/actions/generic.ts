import { handleActionConfig } from '../../../ha/handle-action';
import { ActionConfig } from '../../../ha/types';
import { CardActionsAPI } from '../../types';
import { BaseAction } from './base';

/**
 * Handles generic HA actions (e.g. 'more-info')
 */
export class GenericAction extends BaseAction<ActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    const hass = api.getHASSManager().getHASS();
    if (hass) {
      handleActionConfig(
        api.getCardElementManager().getElement(),
        hass,
        this._config ?? {},
        this._action,
      );
    }
  }
}
