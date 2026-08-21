/**
 * The files a Home Assistant dashboard resource may list.
 *
 * Everything else the build emits is hashed, so this is the one name that has to
 * stay put across releases.
 */
export const PUBLIC_ENTRY = 'advanced-camera-card.js';

/**
 * Both names a dashboard resource can name: the current one, and the one the
 * card shipped under previously, kept so an existing resource keeps working.
 */
export const PUBLIC_ENTRIES = [PUBLIC_ENTRY, 'frigate-hass-card.js'];
