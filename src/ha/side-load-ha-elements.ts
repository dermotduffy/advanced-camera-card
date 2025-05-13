import { CardHelpers, LovelaceCardWithEditor } from '../types';

/**
 * Side loads the HA elements this card needs. This trickery is unfortunate
 * necessary, see:
 *  - https://github.com/thomasloven/hass-config/wiki/PreLoading-Lovelace-Elements
 * @returns `true` if the load is successful, `false` otherwise.
 */
export const sideLoadHomeAssistantElements = async (): Promise<boolean> => {
  const neededElements = [
    'ha-button-menu',
    'ha-button',
    'ha-camera-stream',
    'ha-card',
    'ha-combo-box',
    'ha-hls-player',
    'ha-icon-button',
    'ha-icon',
    'ha-menu-button',
    'ha-selector',
    'ha-spinner',
    'ha-state-icon',
    'ha-web-rtc-player',
    'mwc-button',
    'mwc-list-item',
    'state-badge',
  ];

  if (neededElements.every((element) => customElements.get(element))) {
    return true;
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
    return false;
  }

  const pgc = new pgcConstructor() as LovelaceCardWithEditor;

  await pgc.constructor.getConfigElement();

  return true;
};
