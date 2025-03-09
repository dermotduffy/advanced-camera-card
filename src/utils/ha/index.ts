import { HassEntity } from 'home-assistant-js-websocket';
import { STATES_ON } from '../../ha/const.js';
import { HomeAssistant } from '../../ha/types.js';
import {
  CardHelpers,
  LovelaceCardWithEditor,
  SignedPath,
  signedPathSchema,
} from '../../types.js';
import { homeAssistantWSRequest } from './ws-request.js';

/**
 * Request that HA sign a path. May throw.
 * @param hass The HomeAssistant object used to request the signature.
 * @param path The path to sign.
 * @param expires An optional number of seconds to sign the path for (by default
 * HA will sign for 30 seconds).
 * @returns The signed URL, or null if the response was malformed.
 */
export async function homeAssistantSignPath(
  hass: HomeAssistant,
  path: string,
  expires?: number,
): Promise<string | null> {
  const request = {
    type: 'auth/sign_path',
    path: path,
    expires: expires,
  };
  const response = await homeAssistantWSRequest<SignedPath>(
    hass,
    signedPathSchema,
    request,
  );
  if (!response) {
    return null;
  }
  return hass.hassUrl(response.path);
}

export interface HassStateDifference {
  entityID: string;
  oldState?: HassEntity;
  newState: HassEntity;
}

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
  if (!newHass || !entities || !entities.length) {
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

/**
 * Get the title of an entity.
 * @param entity The entity id.
 * @param hass The Home Assistant object.
 * @returns The title or undefined.
 */
export function getEntityTitle(hass?: HomeAssistant, entity?: string): string | null {
  return entity ? hass?.states[entity]?.attributes?.friendly_name ?? null : null;
}

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
    'ha-circular-progress',
    'ha-combo-box',
    'ha-hls-player',
    'ha-icon-button',
    'ha-icon',
    'ha-menu-button',
    'ha-selector',
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

/**
 * Determine if a given state qualifies as 'triggered'.
 * @param state The HA entity state string.
 * @returns `true` if triggered, `false` otherwise.
 */
export const isTriggeredState = (state?: string): boolean => {
  return !!state && STATES_ON.includes(state);
};

/**
 * Get entities from the HASS object.
 * @param hass
 * @param domain
 * @returns A list of entities ids.
 */
export const getEntitiesFromHASS = (hass: HomeAssistant, domain?: string): string[] => {
  if (!hass) {
    return [];
  }
  const entities = Object.keys(hass.states).filter(
    (eid) => !domain || eid.substr(0, eid.indexOf('.')) === domain,
  );
  entities.sort();
  return entities;
};

/**
 * Determine if a card is in panel mode.
 */
export const isCardInPanel = (card: HTMLElement): boolean => {
  const parent = card.getRootNode();
  return !!(
    parent &&
    parent instanceof ShadowRoot &&
    parent.host.tagName === 'HUI-PANEL-VIEW'
  );
};

export function isHARelativeURL(url?: string): boolean {
  return !!url?.startsWith('/');
}

/**
 * Ensure URLs use the correct HA URL (relevant for Chromecast where the default
 * location will be the Chromecast receiver, not HA).
 * @param url The media URL
 */
export function canonicalizeHAURL(hass: HomeAssistant, url: string): string;
export function canonicalizeHAURL(hass: HomeAssistant, url?: string): string | null;
export function canonicalizeHAURL(hass: HomeAssistant, url?: string): string | null {
  if (isHARelativeURL(url)) {
    return hass.hassUrl(url);
  }
  return url ?? null;
}

/**
 * Determine if HA connection state has changed.
 * @param newHass The new HA object.
 * @param oldHass The old HA object.
 * @returns `true` if the connection state has changed.
 */
export const hasHAConnectionStateChanged = (
  oldHass: HomeAssistant | undefined | null,
  newHass: HomeAssistant | undefined | null,
): boolean => {
  return oldHass?.connected !== newHass?.connected;
};

/**
 * Determine if a state object supports a given feature.
 * @param stateObj The state object.
 * @param feature The feature to check.
 * @returns `true` if the feature is supported, `false` otherwise.
 */
export const supportsFeature = (stateObj: HassEntity, feature: number): boolean =>
  ((stateObj.attributes.supported_features ?? 0) & feature) !== 0;
