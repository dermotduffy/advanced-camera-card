import { ToggleActionConfig } from '../../../config/schema/actions/stock/toggle';
import { computeDomain } from '../../../ha/compute-domain';
import { STATES_OFF } from '../../../ha/const';
import { CardActionsAPI } from '../../types';
import { AdvancedCameraCardAction } from './base';

export class ToggleAction extends AdvancedCameraCardAction<ToggleActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await super.execute(api);

    const hass = api.getHASSManager().getHASS();
    const entityID = this._config?.entity;
    if (!hass || !entityID) {
      return;
    }
    const entityState = hass.states[entityID]?.state;
    if (!entityState) {
      return;
    }

    const turnOn = STATES_OFF.includes(entityState);
    const stateDomain = computeDomain(entityID);
    const serviceDomain = stateDomain === 'group' ? 'homeassistant' : stateDomain;
    const service =
      stateDomain === 'lock'
        ? turnOn
          ? 'unlock'
          : 'lock'
        : stateDomain === 'cover'
          ? turnOn
            ? 'open_cover'
            : 'close_cover'
          : turnOn
            ? 'turn_on'
            : 'turn_off';
    await hass.callService(serviceDomain, service, { entity_id: entityID });
  }
}
