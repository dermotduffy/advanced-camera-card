import { HomeAssistant } from './types';

/**
 * Get the title of an entity.
 * @param entity The entity id.
 * @param hass The Home Assistant object.
 * @returns The title or undefined.
 */
export function getEntityTitle(hass?: HomeAssistant, entity?: string): string | null {
  return entity ? hass?.states[entity]?.attributes?.friendly_name ?? null : null;
}
