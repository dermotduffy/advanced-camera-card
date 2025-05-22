import { HomeAssistant } from './types';

/**
 * Get entities from the HASS object.
 * @param hass
 * @param domain
 * @returns A list of entities ids.
 */
export const getEntitiesFromHASS = (hass: HomeAssistant, domain?: string): string[] => {
  const entities = Object.keys(hass.states).filter(
    (eid) => !domain || eid.substring(0, eid.indexOf('.')) === domain,
  );
  return entities.sort();
};
