import type { HassEntity } from 'home-assistant-js-websocket';

import type { Icon } from '../config/schema/common/icon';
import { CUSTOM_ICON_NAMES, CUSTOM_ICONSET_PREFIX } from '../ha/custom-icons';
import type { HomeAssistant } from '../ha/types';

export class IconController {
  public getIconName(icon?: Icon): string | null {
    const name = icon?.icon ?? null;

    // Bare legacy names (`frigate`) resolve to the same icon as the iconset
    // form (`advanced-camera-card:frigate`).
    return name && CUSTOM_ICON_NAMES.includes(name)
      ? `${CUSTOM_ICONSET_PREFIX}:${name}`
      : name;
  }

  public createStateObjectForStateBadge(
    hass: HomeAssistant,
    entityID: string,
  ): HassEntity | null {
    if (!hass.states[entityID]) {
      return null;
    }
    return {
      ...hass.states[entityID],
      attributes: {
        ...hass.states[entityID].attributes,

        // State badge is the only available component that will allow the
        // Home Assistant frontend to correctly color based on the state, but
        // it also will render an image (instead of an icon) if one is present
        // in the attributes. By overriding the below attributes, we avoid
        // that behavior.
        entity_picture: undefined,
        entity_picture_local: undefined,
      },
    };
  }
}
