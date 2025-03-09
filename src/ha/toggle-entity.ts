import { STATES_OFF } from './const.js';
import { turnOnOffEntity } from './turn-on-off-entity.js';
import { HomeAssistant } from './types.js';

export const toggleEntity = (hass: HomeAssistant, entityId: string): Promise<void> => {
  const turnOn = STATES_OFF.includes(hass.states[entityId].state);
  return turnOnOffEntity(hass, entityId, turnOn);
};
