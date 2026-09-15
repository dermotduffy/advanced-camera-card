import type { HassEntity } from 'home-assistant-js-websocket';
import type { HomeAssistant } from './types';

type HassWithEntityNames = HomeAssistant & {
  formatEntityName: (stateObj: HassEntity, name?: undefined) => string;
};

/**
 * Whether hass can resolve an entity's name from its registry context.
 *
 * The helper has existed since HA 2025.10, but with an incompatible signature -
 * bare type strings then, and only structured items between 2025.11 and 2026.3 -
 * so feature detection is not enough and the version has to be checked.
 */
const supportsEntityNames = (hass: HomeAssistant): boolean => {
  const [major, minor] = (hass.config?.version ?? '').split('.', 2);
  return Number(major) > 2026 || (Number(major) === 2026 && Number(minor) >= 4);
};

/**
 * Get the title of an entity.
 *
 * On HA 2026.4 and later this is the name composed from the entity's registry
 * context (entity, device, area, floor), matching what the built-in cards show.
 * Older versions fall back to the friendly name.
 *
 * @param entity The entity id.
 * @param hass The Home Assistant object.
 * @returns The title or null.
 */
export function getEntityTitle(hass?: HomeAssistant, entity?: string): string | null {
  const stateObj = entity ? hass?.states[entity] : undefined;
  if (!hass || !stateObj) {
    return null;
  }
  if (supportsEntityNames(hass)) {
    return (hass as HassWithEntityNames).formatEntityName(stateObj) || null;
  }
  return stateObj.attributes?.friendly_name ?? null;
}
