import { isHARelativeURL } from './is-ha-relative-url';
import { HomeAssistant } from './types';

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
