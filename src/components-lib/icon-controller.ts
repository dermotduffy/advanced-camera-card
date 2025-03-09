import { HassEntity } from 'home-assistant-js-websocket';
import frigateSVG from '../camera-manager/frigate/assets/frigate.svg';
import motioneyeSVG from '../camera-manager/motioneye/assets/motioneye.svg';
import reolinkSVG from '../camera-manager/reolink/assets/reolink.svg';
import { HomeAssistant } from '../ha/types';
import irisSVG from '../images/iris.svg';
import { Icon } from '../types';

export class IconController {
  public getCustomIcon(icon?: Icon): string | null {
    switch (icon?.icon) {
      case 'frigate':
        return frigateSVG;
      case 'motioneye':
        return motioneyeSVG;
      case 'reolink':
        return reolinkSVG;
      case 'iris':
        return irisSVG;
      default:
        return null;
    }
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
