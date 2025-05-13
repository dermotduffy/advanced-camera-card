import { HassEntity } from 'home-assistant-js-websocket';
import { computeDomain } from './compute-domain.js';
import { Entity } from './registry/entity/types.js';
import { HomeAssistant } from './types.js';

/**
 * Get the translation of an entity state. Inspired by:
 * https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_state_display.ts#L204-L218
 *
 * This may no longer be necessary to custom implement if `custom-card-helpers`
 * is updated to reflect how the Home Assistant frontend now [as of 2023-03-04]
 * computes state display (e.g. supports usage of `translation_key`).
 *
 * https://github.com/custom-cards/custom-card-helpers/blob/master/src/compute-state-display.ts
 *
 */
export const getEntityStateTranslation = (
  hass: HomeAssistant,
  entityID: string,
  options?: {
    entity?: Entity;
    state?: string;
  },
): string | null => {
  const stateObj: HassEntity | undefined = hass.states[entityID];
  const state = options?.state ? options.state : stateObj ? stateObj.state : null;

  if (!state) {
    return null;
  }

  const domain = computeDomain(entityID);
  const attributes = stateObj ? stateObj.attributes : null;

  return (
    // Return the translation_key translation.
    (options?.entity?.translation_key &&
      hass.localize(
        `component.${options.entity.platform}.entity.${domain}` +
          `.${options.entity.translation_key}.state.${state}`,
      )) ||
    // Return device class translation
    (attributes?.device_class &&
      hass.localize(`component.${domain}.state.${attributes.device_class}.${state}`)) ||
    // Return default translation
    hass.localize(`component.${domain}.state._.${state}`) ||
    // We don't know! Return the raw state.
    state
  );
};
