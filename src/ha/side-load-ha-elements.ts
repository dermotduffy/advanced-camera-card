import { localize } from '../localize/localize';
import {
  AdvancedCameraCardError,
  type CardHelpers,
  type LovelaceCardWithEditor,
} from '../types';

class HomeAssistantElementsLoadError extends AdvancedCameraCardError {
  constructor() {
    super(localize('error.home_assistant_elements_load_failed'));
  }
}

/**
 * The Home Assistant elements this card renders and expects to already be
 * registered.
 */
export const SIDE_LOADED_ELEMENTS = [
  'ha-alert',
  'ha-button',
  'ha-camera-stream',
  'ha-card',
  'ha-combo-box',
  'ha-dropdown-item',
  'ha-dropdown',
  'ha-expansion-panel',
  'ha-form',
  'ha-hls-player',
  'ha-icon-button-prev',
  'ha-icon-button',
  'ha-icon',
  'ha-md-list-item',
  'ha-md-list',
  'ha-menu-button',
  'ha-selector',
  'ha-sortable',
  'ha-spinner',
  'ha-state-icon',
  'ha-web-rtc-player',

  'hui-conditional-element',

  'mwc-list-item',
  'state-badge',
];

/**
 * Side loads the HA elements this card needs. This trickery is unfortunate
 * necessary, see:
 *  - https://github.com/thomasloven/hass-config/wiki/PreLoading-Lovelace-Elements
 */
export const sideLoadHomeAssistantElements = async (): Promise<void> => {
  if (SIDE_LOADED_ELEMENTS.every((element) => customElements.get(element))) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const helpers: CardHelpers = await (window as any).loadCardHelpers();

  // This bizarre combination of hacks creates a dummy picture glance card, then
  // waits for it to be fully loaded/upgraded as a custom element, so it will
  // have the getConfigElement() method which is necessary to load all the
  // elements this card requires.
  await helpers.createCardElement({
    type: 'picture-glance',
    entities: [],
    camera_image: 'dummy-to-load-editor-components',
  });

  // Some cast devices have a bug that causes whenDefined to return
  // undefined instead of a constructor.
  // See related: https://issues.chromium.org/issues/40846966
  await customElements.whenDefined('hui-picture-glance-card');
  const pgcConstructor = customElements.get('hui-picture-glance-card');
  if (!pgcConstructor) {
    throw new HomeAssistantElementsLoadError();
  }

  const pgc = new pgcConstructor() as LovelaceCardWithEditor;

  await pgc.constructor.getConfigElement();
};
