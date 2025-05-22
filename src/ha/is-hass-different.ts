import { getHassDifferences } from './get-hass-differences';
import { HomeAssistant } from './types';

/**
 * Determine if two hass objects are different for a list of entities.
 * @param newHass The new HA object.
 * @param oldHass The old HA object.
 * @param entities The entities to examine for changes.
 * @param options An options object. stateOnly: whether or not to compare state strings only.
 * @returns An array of HassStateDifference objects.
 */
export function isHassDifferent(
  newHass: HomeAssistant | undefined | null,
  oldHass: HomeAssistant | undefined | null,
  entities: string[] | null,
  options?: {
    stateOnly?: boolean;
  },
): boolean {
  return !!getHassDifferences(newHass, oldHass, entities, {
    ...options,
    firstOnly: true,
  }).length;
}
