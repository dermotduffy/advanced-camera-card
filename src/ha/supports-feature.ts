import { HassEntity } from 'home-assistant-js-websocket';

/**
 * Determine if a state object supports a given feature.
 * @param stateObj The state object.
 * @param feature The feature to check.
 * @returns `true` if the feature is supported, `false` otherwise.
 */

export const supportsFeature = (stateObj: HassEntity, feature: number): boolean =>
  ((stateObj.attributes.supported_features ?? 0) & feature) !== 0;
