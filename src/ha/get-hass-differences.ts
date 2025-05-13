import { HassEntity } from 'home-assistant-js-websocket';
import { HassStateDifference, HomeAssistant } from './types';

/**
 * Get the difference between two hass objects.
 * @param newHass The new HA object.
 * @param oldHass The old HA object.
 * @param entities The entities to examine for changes.
 * @param options An options object. stateOnly: whether or not to compare state
 * strings only, firstOnly: whether or not to get the first difference only.
 * @returns An array of HassStateDifference objects.
 */

export function getHassDifferences(
  newHass: HomeAssistant | undefined | null,
  oldHass: HomeAssistant | undefined | null,
  entities: string[] | null,
  options?: {
    firstOnly?: boolean;
    stateOnly?: boolean;
  },
): HassStateDifference[] {
  if (!newHass || !entities?.length) {
    return [];
  }

  const differences: HassStateDifference[] = [];
  for (const entity of entities) {
    const oldState: HassEntity | undefined = oldHass?.states[entity];
    const newState: HassEntity | undefined = newHass.states[entity];
    if (
      (options?.stateOnly && oldState?.state !== newState?.state) ||
      (!options?.stateOnly && oldState !== newState)
    ) {
      differences.push({
        entityID: entity,
        oldState: oldState,
        newState: newState,
      });
      if (options?.firstOnly) {
        break;
      }
    }
  }
  return differences;
}
