import type { HomeAssistant } from './types';

/**
 * `HASSSource` is the observer-pattern API that `HASSManager` exposes for any
 * long-lived code that needs to react to HASS changes. The listener fires on
 * every non-null HASS push; `oldHass` is the previous value (null on first
 * fire).
 */
export type HASSListener = (hass: HomeAssistant, oldHass: HomeAssistant | null) => void;

export type HASSUnlistenCallback = () => void;

export interface HASSSource {
  getHASS(): HomeAssistant | null;
  addListener(listener: HASSListener): HASSUnlistenCallback;
}
